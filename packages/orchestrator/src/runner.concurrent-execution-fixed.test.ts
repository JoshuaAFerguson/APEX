import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import { type WriteStream } from 'fs';

/**
 * Comprehensive Test Suite for Concurrent Task Execution
 *
 * This test suite validates all acceptance criteria for the concurrent task execution feature:
 * 1. ✅ maxConcurrentTasks config exists and is properly handled
 * 2. ✅ runningTasks Map correctly tracks active tasks
 * 3. ✅ poll() method respects concurrency limits
 * 4. ✅ daemon can run multiple tasks simultaneously
 */

// Mock fs module with proper typing
const mockWriteStream = {
  write: vi.fn(),
  end: vi.fn((callback?: () => void) => callback?.()),
  destroyed: false,
} as unknown as WriteStream;

vi.mock('fs', () => ({
  default: {
    createWriteStream: vi.fn(() => mockWriteStream),
  },
  createWriteStream: vi.fn(() => mockWriteStream),
  promises: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    exists: vi.fn(),
    stat: vi.fn(),
  },
}));

// Mock core config
vi.mock('@apexcli/core', () => ({
  loadConfig: vi.fn().mockResolvedValue({}),
  getEffectiveConfig: vi.fn().mockReturnValue({
    limits: { maxConcurrentTasks: 3 },
    daemon: { pollInterval: 1000, logLevel: 'info' },
    git: {},
    projects: {},
  }),
  RepairLoopConfigSchema: {
    parse: vi.fn().mockReturnValue({}),
  },
  TaskStatus: {
    QUEUED: 'queued',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
  },
}));

// Mock TaskStore
const mockStore = {
  initialize: vi.fn().mockResolvedValue(undefined),
  close: vi.fn(),
  getNextQueuedTask: vi.fn().mockResolvedValue(null),
  listTasks: vi.fn().mockResolvedValue([]),
  updateTask: vi.fn(),
  addLog: vi.fn(),
  updateTaskStatus: vi.fn(),
  getTask: vi.fn(),
};

vi.mock('./store', () => ({
  TaskStore: vi.fn().mockImplementation(() => mockStore),
}));

// Mock Orchestrator
const mockOrchestrator = {
  executeTask: vi.fn().mockImplementation(() =>
    new Promise(resolve => setTimeout(resolve, 100))
  ),
};

vi.mock('./orchestrator', () => ({
  Orchestrator: vi.fn().mockImplementation(() => mockOrchestrator),
}));

// Mock usage manager
const mockUsageManager = {
  trackTaskStart: vi.fn(),
  trackTaskCompletion: vi.fn(),
};

vi.mock('./usage', () => ({
  UsageManager: vi.fn().mockImplementation(() => mockUsageManager),
}));

// Now import the module to test
import { DaemonRunner, type DaemonRunnerOptions } from './runner';
import type { Task } from '@apexcli/core';

describe('DaemonRunner Concurrent Task Execution - Fixed', () => {
  let runner: DaemonRunner;
  let options: DaemonRunnerOptions;

  beforeEach(() => {
    vi.clearAllMocks();

    options = {
      projectId: 'test-project',
      workflowId: 'test-workflow',
      projectDir: path.resolve(process.cwd(), 'test-project'),
      logFile: path.resolve(process.cwd(), 'test.log'),
      maxConcurrentTasks: 2,
      pollIntervalMs: 100,
      logLevel: 'info',
    };
  });

  afterEach(async () => {
    if (runner) {
      try {
        await runner.stop();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Acceptance Criteria 1: maxConcurrentTasks Configuration', () => {
    it('should respect maxConcurrentTasks from options', async () => {
      runner = new DaemonRunner(options);
      expect(runner['options'].maxConcurrentTasks).toBe(2);
    });

    it('should use config maxConcurrentTasks when option is 0', async () => {
      const optionsWithZero = { ...options, maxConcurrentTasks: 0 };
      runner = new DaemonRunner(optionsWithZero);

      await runner.start();

      // After start(), should use config value
      expect(runner['options'].maxConcurrentTasks).toBe(3);
    });

    it('should handle invalid maxConcurrentTasks gracefully', async () => {
      const optionsWithNegative = { ...options, maxConcurrentTasks: -1 };
      runner = new DaemonRunner(optionsWithNegative);

      await runner.start();

      // Should fall back to config value since negative is invalid
      expect(runner['options'].maxConcurrentTasks).toBe(3);
    });
  });

  describe('Acceptance Criteria 2: runningTasks Map Tracking', () => {
    beforeEach(async () => {
      runner = new DaemonRunner(options);
      await runner.start();
    });

    it('should correctly track active tasks in runningTasks Map', async () => {
      const mockTasks: Task[] = [
        { id: 'task-1', status: 'queued' as any, title: 'Test Task 1' },
        { id: 'task-2', status: 'queued' as any, title: 'Test Task 2' },
      ];

      // Set up store to return tasks
      mockStore.getNextQueuedTask
        .mockResolvedValueOnce(mockTasks[0])
        .mockResolvedValueOnce(mockTasks[1])
        .mockResolvedValue(null);

      // Mock orchestrator to return pending promises
      const task1Promise = new Promise(resolve => setTimeout(resolve, 200));
      const task2Promise = new Promise(resolve => setTimeout(resolve, 200));

      mockOrchestrator.executeTask
        .mockReturnValueOnce(task1Promise)
        .mockReturnValueOnce(task2Promise);

      // Trigger poll to start tasks
      await runner['poll']();

      // Check that tasks are tracked
      const runningTasks = runner['runningTasks'];
      expect(runningTasks.size).toBe(2);
      expect(runningTasks.has('task-1')).toBe(true);
      expect(runningTasks.has('task-2')).toBe(true);

      // Wait for tasks to complete
      await Promise.all([task1Promise, task2Promise]);

      // Give time for cleanup
      await new Promise(resolve => setTimeout(resolve, 50));

      // Tasks should be cleaned up
      expect(runningTasks.size).toBe(0);
    });

    it('should clean up runningTasks Map on task failure', async () => {
      const mockTask: Task = { id: 'failing-task', status: 'queued' as any, title: 'Failing Task' };

      mockStore.getNextQueuedTask
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValue(null);

      // Mock orchestrator to reject
      const failurePromise = Promise.reject(new Error('Task failed'));
      mockOrchestrator.executeTask.mockReturnValueOnce(failurePromise);

      // Trigger poll
      await runner['poll']();

      // Check that task is tracked initially
      expect(runner['runningTasks'].has('failing-task')).toBe(true);

      // Wait for failure and cleanup
      try {
        await failurePromise;
      } catch {
        // Expected failure
      }
      await new Promise(resolve => setTimeout(resolve, 50));

      // Task should be cleaned up even on failure
      expect(runner['runningTasks'].size).toBe(0);
    });

    it('should prevent duplicate task execution', async () => {
      const mockTask: Task = { id: 'duplicate-task', status: 'queued' as any, title: 'Duplicate Task' };

      // Add task to runningTasks manually to simulate already running
      const existingPromise = new Promise(resolve => setTimeout(resolve, 100));
      runner['runningTasks'].set('duplicate-task', existingPromise);

      mockStore.getNextQueuedTask
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValue(null);

      // Trigger poll
      await runner['poll']();

      // Should not call executeTask since task is already running
      expect(mockOrchestrator.executeTask).not.toHaveBeenCalled();

      // Should still have only one entry
      expect(runner['runningTasks'].size).toBe(1);
    });
  });

  describe('Acceptance Criteria 3: poll() Method Concurrency Limits', () => {
    beforeEach(async () => {
      runner = new DaemonRunner(options);
      await runner.start();
    });

    it('should respect concurrency limits in poll() method', async () => {
      const mockTasks: Task[] = Array.from({ length: 5 }, (_, i) => ({
        id: `task-${i + 1}`,
        status: 'queued' as any,
        title: `Test Task ${i + 1}`,
      }));

      // Set up store to return more tasks than the limit
      mockStore.getNextQueuedTask
        .mockImplementation(() => Promise.resolve(mockTasks.shift() || null));

      // Mock promises that don't resolve immediately
      mockOrchestrator.executeTask.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      // Trigger poll
      await runner['poll']();

      // Should only start tasks up to maxConcurrentTasks (2)
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(2);
      expect(runner['runningTasks'].size).toBe(2);
    });

    it('should start new tasks when slots become available', async () => {
      const mockTasks: Task[] = [
        { id: 'task-1', status: 'queued' as any, title: 'Task 1' },
        { id: 'task-2', status: 'queued' as any, title: 'Task 2' },
        { id: 'task-3', status: 'queued' as any, title: 'Task 3' },
      ];

      let taskIndex = 0;
      mockStore.getNextQueuedTask.mockImplementation(() => {
        return Promise.resolve(taskIndex < mockTasks.length ? mockTasks[taskIndex++] : null);
      });

      // First two tasks complete quickly, third takes longer
      mockOrchestrator.executeTask
        .mockReturnValueOnce(Promise.resolve())
        .mockReturnValueOnce(Promise.resolve())
        .mockReturnValueOnce(new Promise(resolve => setTimeout(resolve, 200)));

      // First poll - should start 2 tasks
      await runner['poll']();
      expect(runner['runningTasks'].size).toBe(2);

      // Wait for first two to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Second poll - should start the third task
      await runner['poll']();
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(3);
    });
  });

  describe('Acceptance Criteria 4: Simultaneous Task Execution', () => {
    beforeEach(async () => {
      runner = new DaemonRunner(options);
      await runner.start();
    });

    it('should run multiple tasks simultaneously', async () => {
      const mockTasks: Task[] = [
        { id: 'concurrent-1', status: 'queued' as any, title: 'Concurrent 1' },
        { id: 'concurrent-2', status: 'queued' as any, title: 'Concurrent 2' },
      ];

      let taskIndex = 0;
      mockStore.getNextQueuedTask.mockImplementation(() => {
        return Promise.resolve(taskIndex < mockTasks.length ? mockTasks[taskIndex++] : null);
      });

      const executionTimes: number[] = [];

      mockOrchestrator.executeTask.mockImplementation(async (taskId: string) => {
        const startTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 100));
        const endTime = Date.now();
        executionTimes.push(endTime - startTime);
        return;
      });

      const startTime = Date.now();
      await runner['poll']();

      // Wait for both tasks to complete
      const runningTasks = Array.from(runner['runningTasks'].values());
      await Promise.all(runningTasks);
      const totalTime = Date.now() - startTime;

      // Both tasks should have been started
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(2);

      // Total time should be closer to 100ms (parallel) than 200ms (sequential)
      expect(totalTime).toBeLessThan(180); // Allow some margin for test timing
    });

    it('should handle task execution errors without affecting other concurrent tasks', async () => {
      const mockTasks: Task[] = [
        { id: 'success-task', status: 'queued' as any, title: 'Success Task' },
        { id: 'failure-task', status: 'queued' as any, title: 'Failure Task' },
      ];

      let taskIndex = 0;
      mockStore.getNextQueuedTask.mockImplementation(() => {
        return Promise.resolve(taskIndex < mockTasks.length ? mockTasks[taskIndex++] : null);
      });

      // One succeeds, one fails
      mockOrchestrator.executeTask
        .mockImplementation((taskId: string) => {
          if (taskId === 'failure-task') {
            return Promise.reject(new Error('Task failed'));
          }
          return new Promise(resolve => setTimeout(resolve, 100));
        });

      await runner['poll']();

      // Both should be tracked initially
      expect(runner['runningTasks'].size).toBe(2);

      // Wait for completion
      const runningTasks = Array.from(runner['runningTasks'].values());
      await Promise.allSettled(runningTasks);

      // Give time for cleanup
      await new Promise(resolve => setTimeout(resolve, 50));

      // Both should be cleaned up regardless of success/failure
      expect(runner['runningTasks'].size).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(async () => {
      runner = new DaemonRunner(options);
      await runner.start();
    });

    it('should handle rapid shutdown during concurrent task execution', async () => {
      const mockTask: Task = { id: 'long-task', status: 'queued' as any, title: 'Long Task' };

      mockStore.getNextQueuedTask
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValue(null);

      // Mock a long-running task
      mockOrchestrator.executeTask.mockReturnValue(
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      // Start task
      await runner['poll']();
      expect(runner['runningTasks'].size).toBe(1);

      // Rapid shutdown
      const stopPromise = runner.stop();

      // Should complete shutdown even with running tasks
      await expect(stopPromise).resolves.toBeUndefined();
    });

    it('should handle metrics correctly during concurrent execution', async () => {
      const mockTasks: Task[] = [
        { id: 'metrics-1', status: 'queued' as any, title: 'Metrics 1' },
        { id: 'metrics-2', status: 'queued' as any, title: 'Metrics 2' },
      ];

      let taskIndex = 0;
      mockStore.getNextQueuedTask.mockImplementation(() => {
        return Promise.resolve(taskIndex < mockTasks.length ? mockTasks[taskIndex++] : null);
      });

      mockOrchestrator.executeTask.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      // Before starting tasks
      let metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(0);
      expect(metrics.activeTaskIds).toEqual([]);

      // Start tasks
      await runner['poll']();

      // During execution
      metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(2);
      expect(metrics.activeTaskIds).toEqual(['metrics-1', 'metrics-2']);

      // Wait for completion
      const runningTasks = Array.from(runner['runningTasks'].values());
      await Promise.all(runningTasks);

      // Give time for cleanup
      await new Promise(resolve => setTimeout(resolve, 50));

      // After completion
      metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(0);
      expect(metrics.activeTaskIds).toEqual([]);
    });
  });
});