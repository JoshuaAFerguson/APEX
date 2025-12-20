import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { DaemonRunner, type DaemonRunnerOptions } from './runner';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import type { Task } from '@apex/core';

// Integration tests with minimal mocking
describe('DaemonRunner Integration', () => {
  const testProjectPath = '/tmp/apex-test-' + Date.now();
  const apexDir = join(testProjectPath, '.apex');
  let runner: DaemonRunner;

  // Mock the core dependencies while keeping DaemonRunner logic intact
  const mockConfig = {
    project: {
      name: 'test-project',
      version: '1.0.0',
    },
    limits: {
      maxConcurrentTasks: 2,
      maxUsagePerUser: 1000,
      maxUsagePerTask: 500,
    },
    autonomy: {
      default: 'medium' as const,
      allowed: ['low', 'medium', 'high'] as const,
    },
  };

  const mockEffectiveConfig = {
    ...mockConfig,
    limits: {
      maxConcurrentTasks: 2,
      maxUsagePerUser: 1000,
      maxUsagePerTask: 500,
      rateLimitRetryDelay: 60000,
    },
  };

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create test directory structure
    await fs.mkdir(apexDir, { recursive: true });

    // Mock the core module functions
    vi.doMock('@apexcli/core', () => ({
      loadConfig: vi.fn().mockResolvedValue(mockConfig),
      getEffectiveConfig: vi.fn().mockReturnValue(mockEffectiveConfig),
    }));

    // Mock TaskStore with more realistic behavior
    vi.doMock('./store', () => ({
      TaskStore: vi.fn().mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
        getNextQueuedTask: vi.fn().mockResolvedValue(null),
      })),
    }));

    // Mock ApexOrchestrator with event emitter behavior
    const EventEmitter = require('events');
    vi.doMock('./index', () => ({
      ApexOrchestrator: vi.fn().mockImplementation(() => {
        const emitter = new EventEmitter();
        return {
          ...emitter,
          initialize: vi.fn().mockResolvedValue(undefined),
          executeTask: vi.fn().mockResolvedValue(undefined),
        };
      }),
    }));
  });

  afterEach(async () => {
    // Stop the runner if it's running
    if (runner) {
      try {
        await runner.stop();
      } catch {
        // Ignore errors during cleanup
      }
    }

    // Clean up test directory
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Reset all mocks
    vi.resetAllMocks();
    vi.doUnmock('@apexcli/core');
    vi.doUnmock('./store');
    vi.doUnmock('./index');
  });

  describe('full lifecycle integration', () => {
    it('should complete full start-run-stop cycle', async () => {
      const options: DaemonRunnerOptions = {
        projectPath: testProjectPath,
        pollIntervalMs: 1000,
        logToStdout: false,
      };

      runner = new DaemonRunner(options);

      // Start the daemon
      await runner.start();

      // Verify initial state
      let metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(true);
      expect(metrics.tasksProcessed).toBe(0);
      expect(metrics.pollCount).toBe(1); // Initial poll

      // Wait for a few poll cycles
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Check that polling is happening
      metrics = runner.getMetrics();
      expect(metrics.pollCount).toBeGreaterThan(1);
      expect(metrics.lastPollAt).toBeInstanceOf(Date);

      // Stop the daemon
      await runner.stop();

      metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(false);
    });

    it('should handle task execution flow', async () => {
      const mockTask: Task = {
        id: 'test-task-123',
        description: 'Test task',
        status: 'queued',
        workflow: 'test-workflow',
        autonomy: 'medium',
        projectPath: testProjectPath,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Import mocked modules after setup
      const { TaskStore } = await import('./store');
      const { ApexOrchestrator } = await import('./index');

      // Get mock instances
      const mockStore = new TaskStore(testProjectPath) as any;
      const mockOrchestrator = new ApexOrchestrator({ projectPath: testProjectPath }) as any;

      // Setup task store to return a task once
      mockStore.getNextQueuedTask
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValue(null);

      // Setup orchestrator to simulate task execution
      mockOrchestrator.executeTask.mockImplementation(async (taskId: string) => {
        // Simulate some execution time
        await new Promise(resolve => setTimeout(resolve, 100));

        // Emit some events during execution
        mockOrchestrator.emit('task:stage-changed', mockTask, 'planning');
        mockOrchestrator.emit('task:stage-changed', mockTask, 'implementation');
        mockOrchestrator.emit('task:completed', mockTask);

        return;
      });

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 500, // Fast polling for test
      });

      await runner.start();

      // Wait for task to be picked up and executed
      await new Promise(resolve => setTimeout(resolve, 1500));

      const metrics = runner.getMetrics();
      expect(metrics.tasksProcessed).toBe(1);
      expect(metrics.tasksSucceeded).toBe(1);
      expect(metrics.tasksFailed).toBe(0);

      await runner.stop();
    });

    it('should handle task failures correctly', async () => {
      const mockTask: Task = {
        id: 'failing-task-456',
        description: 'Failing task',
        status: 'queued',
        workflow: 'test-workflow',
        autonomy: 'medium',
        projectPath: testProjectPath,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { TaskStore } = await import('./store');
      const { ApexOrchestrator } = await import('./index');

      const mockStore = new TaskStore(testProjectPath) as any;
      const mockOrchestrator = new ApexOrchestrator({ projectPath: testProjectPath }) as any;

      mockStore.getNextQueuedTask
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValue(null);

      // Setup orchestrator to fail
      mockOrchestrator.executeTask.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));

        mockOrchestrator.emit('task:failed', mockTask, new Error('Execution failed'));
        throw new Error('Task execution failed');
      });

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 500,
      });

      await runner.start();

      // Wait for task execution
      await new Promise(resolve => setTimeout(resolve, 1000));

      const metrics = runner.getMetrics();
      expect(metrics.tasksProcessed).toBe(1);
      expect(metrics.tasksSucceeded).toBe(0);
      expect(metrics.tasksFailed).toBe(1);

      await runner.stop();
    });

    it('should respect concurrency limits', async () => {
      const { TaskStore } = await import('./store');
      const { ApexOrchestrator } = await import('./index');

      const mockStore = new TaskStore(testProjectPath) as any;
      const mockOrchestrator = new ApexOrchestrator({ projectPath: testProjectPath }) as any;

      // Create multiple tasks
      const tasks: Task[] = [
        {
          id: 'task-1',
          description: 'Task 1',
          status: 'queued',
          workflow: 'test-workflow',
          autonomy: 'medium',
          projectPath: testProjectPath,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-2',
          description: 'Task 2',
          status: 'queued',
          workflow: 'test-workflow',
          autonomy: 'medium',
          projectPath: testProjectPath,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-3',
          description: 'Task 3',
          status: 'queued',
          workflow: 'test-workflow',
          autonomy: 'medium',
          projectPath: testProjectPath,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Return tasks sequentially
      mockStore.getNextQueuedTask
        .mockResolvedValueOnce(tasks[0])
        .mockResolvedValueOnce(tasks[1])
        .mockResolvedValueOnce(tasks[2])
        .mockResolvedValue(null);

      let concurrentExecutions = 0;
      let maxConcurrentExecutions = 0;

      // Track concurrent executions
      mockOrchestrator.executeTask.mockImplementation(async () => {
        concurrentExecutions++;
        maxConcurrentExecutions = Math.max(maxConcurrentExecutions, concurrentExecutions);

        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 200));

        concurrentExecutions--;
      });

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 100,
        maxConcurrentTasks: 2, // Limit to 2 concurrent tasks
      });

      await runner.start();

      // Wait for all tasks to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should not exceed the concurrency limit
      expect(maxConcurrentExecutions).toBeLessThanOrEqual(2);

      const metrics = runner.getMetrics();
      expect(metrics.tasksProcessed).toBe(3);

      await runner.stop();
    });

    it('should create and use log file correctly', async () => {
      const logFile = join(apexDir, 'test-daemon.log');

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        logFile,
        pollIntervalMs: 1000,
      });

      await runner.start();

      // Wait for some activity
      await new Promise(resolve => setTimeout(resolve, 500));

      await runner.stop();

      // Check that log file was created and contains entries
      const logExists = await fs.access(logFile).then(() => true).catch(() => false);
      expect(logExists).toBe(true);

      const logContent = await fs.readFile(logFile, 'utf-8');
      expect(logContent).toContain('Daemon started');
      expect(logContent).toContain('Daemon stopped');
      expect(logContent).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/); // Timestamp format
    });
  });

  describe('error recovery and resilience', () => {
    it('should continue operating after store errors', async () => {
      const { TaskStore } = await import('./store');
      const mockStore = new TaskStore(testProjectPath) as any;

      // Make store fail intermittently
      let callCount = 0;
      mockStore.getNextQueuedTask.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Store temporarily unavailable');
        }
        return null;
      });

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 200,
      });

      await runner.start();

      // Wait for multiple poll cycles including the error
      await new Promise(resolve => setTimeout(resolve, 1000));

      const metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(true);
      expect(metrics.pollCount).toBeGreaterThan(2);

      await runner.stop();
    });

    it('should handle graceful shutdown with running tasks', async () => {
      const mockTask: Task = {
        id: 'long-running-task',
        description: 'Long running task',
        status: 'queued',
        workflow: 'test-workflow',
        autonomy: 'medium',
        projectPath: testProjectPath,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { TaskStore } = await import('./store');
      const { ApexOrchestrator } = await import('./index');

      const mockStore = new TaskStore(testProjectPath) as any;
      const mockOrchestrator = new ApexOrchestrator({ projectPath: testProjectPath }) as any;

      mockStore.getNextQueuedTask
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValue(null);

      let taskStarted = false;
      let taskCompleted = false;

      mockOrchestrator.executeTask.mockImplementation(async () => {
        taskStarted = true;
        // Simulate a longer-running task
        await new Promise(resolve => setTimeout(resolve, 1500));
        taskCompleted = true;
      });

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 500,
      });

      await runner.start();

      // Wait for task to start
      await new Promise(resolve => setTimeout(resolve, 600));
      expect(taskStarted).toBe(true);

      // Start shutdown while task is running
      const stopPromise = runner.stop();

      // Task should complete before stop finishes
      await stopPromise;
      expect(taskCompleted).toBe(true);

      const metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(false);
      expect(metrics.tasksProcessed).toBe(1);
    });
  });
});