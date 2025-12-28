import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { DaemonRunner, type DaemonRunnerOptions } from './runner';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import type { Task, TaskPriority } from '@apex/core';

/**
 * High-Volume Queue Processing Integration Tests
 *
 * These tests verify that the queue processing system can handle high loads:
 * 1. Process 100+ tasks through the queue
 * 2. Verify task ordering is maintained based on priority
 * 3. Verify all tasks complete successfully
 * 4. Test queue throughput metrics and performance
 */
describe('High-Volume Queue Processing Integration Tests', () => {
  const testProjectPath = '/tmp/apex-high-volume-test-' + Date.now();
  const apexDir = join(testProjectPath, '.apex');
  let runner: DaemonRunner;

  // Track task execution for verification
  let executedTaskIds: string[] = [];
  let taskExecutionStartTimes = new Map<string, number>();
  let taskExecutionEndTimes = new Map<string, number>();
  let taskExecutionOrder: Array<{id: string, priority: TaskPriority, timestamp: number}> = [];

  // Mock configuration for high-volume testing
  const mockConfig = {
    project: {
      name: 'high-volume-test',
      version: '1.0.0',
    },
    limits: {
      maxConcurrentTasks: 5, // Allow more concurrent tasks for throughput testing
      maxUsagePerUser: 10000,
      maxUsagePerTask: 1000,
    },
    autonomy: {
      default: 'medium' as const,
      allowed: ['low', 'medium', 'high'] as const,
    },
    daemon: {
      pollInterval: 100, // Fast polling for high-volume tests
      orphanDetection: {
        enabled: false, // Disable for cleaner test environment
      }
    }
  };

  const mockEffectiveConfig = {
    ...mockConfig,
    limits: {
      maxConcurrentTasks: 5,
      maxUsagePerUser: 10000,
      maxUsagePerTask: 1000,
      rateLimitRetryDelay: 5000, // Shorter for tests
    },
  };

  // Helper function to create test tasks with different priorities
  const createTestTask = (
    id: string,
    priority: TaskPriority = 'normal',
    description?: string
  ): Task => ({
    id,
    description: description || `High volume test task ${id}`,
    status: 'pending',
    priority,
    workflow: 'test-workflow',
    autonomy: 'medium',
    effort: 'small',
    projectPath: testProjectPath,
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    dependsOn: [],
    blockedBy: [],
    subtaskIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    logs: [],
    artifacts: [],
  });

  // Helper function to generate large batches of tasks
  const generateTaskBatch = (count: number, priorityDistribution?: {
    urgent?: number;
    high?: number;
    normal?: number;
    low?: number;
  }): Task[] => {
    const tasks: Task[] = [];
    const dist = priorityDistribution || { normal: count };

    let taskIndex = 0;

    // Create urgent tasks
    for (let i = 0; i < (dist.urgent || 0); i++) {
      tasks.push(createTestTask(`urgent-task-${taskIndex++}`, 'urgent'));
    }

    // Create high priority tasks
    for (let i = 0; i < (dist.high || 0); i++) {
      tasks.push(createTestTask(`high-task-${taskIndex++}`, 'high'));
    }

    // Create normal priority tasks
    for (let i = 0; i < (dist.normal || 0); i++) {
      tasks.push(createTestTask(`normal-task-${taskIndex++}`, 'normal'));
    }

    // Create low priority tasks
    for (let i = 0; i < (dist.low || 0); i++) {
      tasks.push(createTestTask(`low-task-${taskIndex++}`, 'low'));
    }

    return tasks;
  };

  beforeEach(async () => {
    // Reset tracking arrays
    executedTaskIds = [];
    taskExecutionStartTimes.clear();
    taskExecutionEndTimes.clear();
    taskExecutionOrder = [];

    // Clear all mocks
    vi.clearAllMocks();

    // Create test directory structure
    await fs.mkdir(apexDir, { recursive: true });

    // Mock the core module functions
    vi.doMock('@apexcli/core', () => ({
      loadConfig: vi.fn().mockResolvedValue(mockConfig),
      getEffectiveConfig: vi.fn().mockReturnValue(mockEffectiveConfig),
      generateTaskId: vi.fn().mockImplementation(() => `task-${Date.now()}-${Math.random()}`),
    }));

    // Mock TaskStore with queue-like behavior
    vi.doMock('./store', () => ({
      TaskStore: vi.fn().mockImplementation(() => {
        let taskQueue: Task[] = [];

        return {
          initialize: vi.fn().mockResolvedValue(undefined),
          close: vi.fn(),

          // Queue management methods
          getNextQueuedTask: vi.fn().mockImplementation(async () => {
            // Return highest priority task first (priority ordering test)
            if (taskQueue.length === 0) return null;

            // Sort by priority: urgent > high > normal > low
            const priorityOrder = { urgent: 1, high: 2, normal: 3, low: 4 };
            taskQueue.sort((a, b) => {
              const aPriority = priorityOrder[a.priority] || 99;
              const bPriority = priorityOrder[b.priority] || 99;
              if (aPriority !== bPriority) {
                return aPriority - bPriority;
              }
              // If same priority, order by creation time
              return a.createdAt.getTime() - b.createdAt.getTime();
            });

            const nextTask = taskQueue.shift();
            return nextTask || null;
          }),

          // Allow tests to add tasks to the queue
          addTasksToQueue: vi.fn().mockImplementation((tasks: Task[]) => {
            taskQueue.push(...tasks);
          }),

          getQueueSize: vi.fn().mockImplementation(() => taskQueue.length),
          clearQueue: vi.fn().mockImplementation(() => { taskQueue = []; }),

          // Other required methods
          updateTaskStatus: vi.fn().mockResolvedValue(undefined),
          addLog: vi.fn().mockResolvedValue(undefined),
        };
      }),
    }));

    // Mock ApexOrchestrator with realistic execution simulation
    const EventEmitter = require('events');
    vi.doMock('./index', () => ({
      ApexOrchestrator: vi.fn().mockImplementation(() => {
        const emitter = new EventEmitter();
        return {
          ...emitter,
          initialize: vi.fn().mockResolvedValue(undefined),
          executeTask: vi.fn().mockImplementation(async (taskId: string) => {
            // Find task to get priority info
            const task = executedTaskIds.length === 0 ?
              createTestTask(taskId) :
              { id: taskId, priority: 'normal' as TaskPriority };

            // Track execution start
            taskExecutionStartTimes.set(taskId, Date.now());
            executedTaskIds.push(taskId);
            taskExecutionOrder.push({
              id: taskId,
              priority: task.priority,
              timestamp: Date.now()
            });

            // Emit start events
            emitter.emit('task:stage-changed', task, 'planning');

            // Simulate realistic execution time (50-200ms per task)
            const executionTime = 50 + Math.random() * 150;
            await new Promise(resolve => setTimeout(resolve, executionTime));

            // Emit progress events
            emitter.emit('task:stage-changed', task, 'implementation');
            emitter.emit('task:stage-changed', task, 'testing');
            emitter.emit('task:completed', task);

            // Track execution end
            taskExecutionEndTimes.set(taskId, Date.now());

            return;
          }),
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

  describe('High-Volume Task Processing', () => {
    it('should process 100+ tasks successfully', async () => {
      // Create 150 test tasks
      const tasks = generateTaskBatch(150);

      const { TaskStore } = await import('./store');
      const mockStore = new TaskStore(testProjectPath) as any;

      // Add tasks to queue
      mockStore.addTasksToQueue(tasks);

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 50, // Very fast polling for high throughput
        maxConcurrentTasks: 8, // High concurrency
        logToStdout: false,
      });

      const startTime = Date.now();
      await runner.start();

      // Wait for all tasks to be processed
      // With 8 concurrent tasks and ~125ms avg execution time, 150 tasks should complete in ~3-4 seconds
      let attempts = 0;
      const maxAttempts = 100; // 10 seconds max

      while (executedTaskIds.length < 150 && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      await runner.stop();

      // Verify all tasks were processed
      expect(executedTaskIds.length).toBe(150);
      expect(new Set(executedTaskIds).size).toBe(150); // All unique

      // Verify reasonable throughput (should complete in under 10 seconds)
      expect(totalDuration).toBeLessThan(10000);

      // Verify metrics
      const metrics = runner.getMetrics();
      expect(metrics.tasksProcessed).toBe(150);
      expect(metrics.tasksSucceeded).toBe(150);
      expect(metrics.tasksFailed).toBe(0);

      // Calculate and verify throughput
      const tasksPerSecond = 150 / (totalDuration / 1000);
      expect(tasksPerSecond).toBeGreaterThan(10); // At least 10 tasks/second

      console.log(`High-volume test completed: 150 tasks in ${totalDuration}ms (${tasksPerSecond.toFixed(1)} tasks/sec)`);
    }, 15000); // 15 second timeout

    it('should maintain proper task ordering by priority', async () => {
      // Create tasks with different priorities
      const tasks = generateTaskBatch(60, {
        urgent: 10,
        high: 15,
        normal: 20,
        low: 15,
      });

      const { TaskStore } = await import('./store');
      const mockStore = new TaskStore(testProjectPath) as any;

      // Shuffle tasks to ensure ordering isn't by insertion order
      const shuffledTasks = [...tasks].sort(() => Math.random() - 0.5);
      mockStore.addTasksToQueue(shuffledTasks);

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 30,
        maxConcurrentTasks: 3, // Lower concurrency to better observe ordering
      });

      await runner.start();

      // Wait for all tasks to complete
      let attempts = 0;
      while (executedTaskIds.length < 60 && attempts < 100) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      await runner.stop();

      // Verify all tasks completed
      expect(executedTaskIds.length).toBe(60);

      // Verify priority ordering is generally maintained
      // Due to concurrency, we can't expect perfect ordering, but urgent tasks
      // should generally execute before normal/low tasks
      const urgentTasksCompleted = taskExecutionOrder
        .filter(t => t.priority === 'urgent')
        .map(t => taskExecutionOrder.indexOf(t));

      const lowTasksCompleted = taskExecutionOrder
        .filter(t => t.priority === 'low')
        .map(t => taskExecutionOrder.indexOf(t));

      // Most urgent tasks should complete before most low priority tasks
      const avgUrgentPosition = urgentTasksCompleted.reduce((a, b) => a + b, 0) / urgentTasksCompleted.length;
      const avgLowPosition = lowTasksCompleted.reduce((a, b) => a + b, 0) / lowTasksCompleted.length;

      expect(avgUrgentPosition).toBeLessThan(avgLowPosition);

      // Verify that urgent tasks started first (within first 20% of executions)
      const firstUrgentTask = Math.min(...urgentTasksCompleted);
      expect(firstUrgentTask).toBeLessThan(12); // Should be in first 20% (60 * 0.2)
    });

    it('should handle queue throughput under sustained load', async () => {
      // Create a large number of small tasks
      const batchSize = 200;
      const tasks = generateTaskBatch(batchSize);

      const { TaskStore } = await import('./store');
      const mockStore = new TaskStore(testProjectPath) as any;

      mockStore.addTasksToQueue(tasks);

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 25, // Very fast polling
        maxConcurrentTasks: 10, // High concurrency for throughput
      });

      const startTime = Date.now();
      await runner.start();

      // Track throughput over time
      const throughputMeasurements: Array<{time: number, completed: number}> = [];
      const measurementInterval = setInterval(() => {
        throughputMeasurements.push({
          time: Date.now() - startTime,
          completed: executedTaskIds.length
        });
      }, 500); // Measure every 500ms

      // Wait for completion
      let attempts = 0;
      while (executedTaskIds.length < batchSize && attempts < 150) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      clearInterval(measurementInterval);

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      await runner.stop();

      // Verify all tasks completed
      expect(executedTaskIds.length).toBe(batchSize);

      // Verify sustained throughput
      const overallThroughput = batchSize / (totalDuration / 1000);
      expect(overallThroughput).toBeGreaterThan(15); // At least 15 tasks/second

      // Verify throughput consistency - shouldn't degrade significantly over time
      if (throughputMeasurements.length >= 3) {
        const earlyThroughput = throughputMeasurements[1].completed / (throughputMeasurements[1].time / 1000);
        const lateThroughput = (
          throughputMeasurements[throughputMeasurements.length - 1].completed -
          throughputMeasurements[throughputMeasurements.length - 2].completed
        ) / 0.5; // 500ms intervals

        // Late throughput shouldn't be less than 50% of early throughput
        expect(lateThroughput).toBeGreaterThan(earlyThroughput * 0.5);
      }

      console.log(`Sustained load test: ${batchSize} tasks in ${totalDuration}ms (${overallThroughput.toFixed(1)} tasks/sec)`);
      console.log('Throughput measurements:', throughputMeasurements);
    }, 20000); // 20 second timeout

    it('should verify queue metrics and statistics', async () => {
      const tasks = generateTaskBatch(100);

      const { TaskStore } = await import('./store');
      const mockStore = new TaskStore(testProjectPath) as any;

      mockStore.addTasksToQueue(tasks);

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 40,
        maxConcurrentTasks: 6,
      });

      await runner.start();

      // Collect metrics during execution
      const metricsSnapshots: Array<{
        time: number;
        metrics: any;
        queueSize: number;
      }> = [];

      const metricsInterval = setInterval(() => {
        const metrics = runner.getMetrics();
        const queueSize = mockStore.getQueueSize();

        metricsSnapshots.push({
          time: Date.now(),
          metrics,
          queueSize,
        });
      }, 200);

      // Wait for all tasks to complete
      let attempts = 0;
      while (executedTaskIds.length < 100 && attempts < 150) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      clearInterval(metricsInterval);
      await runner.stop();

      // Verify final metrics
      const finalMetrics = runner.getMetrics();
      expect(finalMetrics.tasksProcessed).toBe(100);
      expect(finalMetrics.tasksSucceeded).toBe(100);
      expect(finalMetrics.tasksFailed).toBe(0);
      expect(finalMetrics.activeTaskCount).toBe(0); // All should be complete
      expect(finalMetrics.pollCount).toBeGreaterThan(0);

      // Verify metrics progression
      expect(metricsSnapshots.length).toBeGreaterThan(3);

      // Queue size should decrease over time
      const firstSnapshot = metricsSnapshots[0];
      const lastSnapshot = metricsSnapshots[metricsSnapshots.length - 1];

      expect(lastSnapshot.queueSize).toBeLessThan(firstSnapshot.queueSize);
      expect(lastSnapshot.metrics.tasksProcessed).toBeGreaterThan(firstSnapshot.metrics.tasksProcessed);

      // Active task count should stay within concurrency limits
      for (const snapshot of metricsSnapshots) {
        expect(snapshot.metrics.activeTaskCount).toBeLessThanOrEqual(6);
      }

      console.log('Metrics verification completed:', {
        finalMetrics: finalMetrics,
        snapshotCount: metricsSnapshots.length,
        maxActiveTasks: Math.max(...metricsSnapshots.map(s => s.metrics.activeTaskCount)),
      });
    });

    it('should handle mixed priority workloads efficiently', async () => {
      // Create a realistic mixed workload
      const urgentTasks = generateTaskBatch(5, { urgent: 5 });
      const highTasks = generateTaskBatch(15, { high: 15 });
      const normalTasks = generateTaskBatch(50, { normal: 50 });
      const lowTasks = generateTaskBatch(30, { low: 30 });

      const allTasks = [...urgentTasks, ...highTasks, ...normalTasks, ...lowTasks];
      const shuffledTasks = [...allTasks].sort(() => Math.random() - 0.5);

      const { TaskStore } = await import('./store');
      const mockStore = new TaskStore(testProjectPath) as any;

      mockStore.addTasksToQueue(shuffledTasks);

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 35,
        maxConcurrentTasks: 7,
      });

      const startTime = Date.now();
      await runner.start();

      // Wait for all tasks to complete
      let attempts = 0;
      while (executedTaskIds.length < 100 && attempts < 200) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      const endTime = Date.now();
      await runner.stop();

      // Verify completion
      expect(executedTaskIds.length).toBe(100);

      // Verify priority-based execution order
      const completionOrder = taskExecutionOrder.map(t => t.priority);

      // Count early completions by priority (first 25 tasks)
      const early25 = completionOrder.slice(0, 25);
      const urgentInEarly = early25.filter(p => p === 'urgent').length;
      const highInEarly = early25.filter(p => p === 'high').length;
      const lowInEarly = early25.filter(p => p === 'low').length;

      // Most urgent tasks should complete early
      expect(urgentInEarly).toBeGreaterThanOrEqual(3); // At least 60% of urgent tasks in first 25%

      // High priority should be well represented in early completions
      expect(highInEarly).toBeGreaterThanOrEqual(8);

      // Low priority should be underrepresented in early completions
      expect(lowInEarly).toBeLessThanOrEqual(6);

      const totalDuration = endTime - startTime;
      const throughput = 100 / (totalDuration / 1000);

      console.log(`Mixed priority workload: 100 tasks (5 urgent, 15 high, 50 normal, 30 low) in ${totalDuration}ms`);
      console.log(`Throughput: ${throughput.toFixed(1)} tasks/sec`);
      console.log(`Priority distribution in first 25 completions: ${urgentInEarly} urgent, ${highInEarly} high, ${lowInEarly} low`);
    });
  });

  describe('Queue Processing Resilience', () => {
    it('should maintain performance under rapid task additions', async () => {
      const { TaskStore } = await import('./store');
      const mockStore = new TaskStore(testProjectPath) as any;

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 30,
        maxConcurrentTasks: 8,
      });

      await runner.start();

      // Add tasks in multiple batches while processing
      const totalTasks = 120;
      const batchSize = 20;
      let tasksAdded = 0;

      const addTasksInterval = setInterval(() => {
        if (tasksAdded >= totalTasks) {
          clearInterval(addTasksInterval);
          return;
        }

        const remainingToAdd = Math.min(batchSize, totalTasks - tasksAdded);
        const newTasks = generateTaskBatch(remainingToAdd);
        mockStore.addTasksToQueue(newTasks);
        tasksAdded += remainingToAdd;
      }, 300); // Add batch every 300ms

      // Wait for all tasks to be added and processed
      let attempts = 0;
      while (executedTaskIds.length < totalTasks && attempts < 300) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      clearInterval(addTasksInterval);
      await runner.stop();

      // Verify all tasks were processed
      expect(executedTaskIds.length).toBe(totalTasks);

      // Verify metrics
      const metrics = runner.getMetrics();
      expect(metrics.tasksSucceeded).toBe(totalTasks);
      expect(metrics.tasksFailed).toBe(0);

      console.log(`Rapid addition test: ${totalTasks} tasks added in batches during processing`);
    });

    it('should handle queue processing with task execution variations', async () => {
      // Create tasks with simulated varying execution times
      const fastTasks = Array.from({ length: 40 }, (_, i) =>
        createTestTask(`fast-task-${i}`, 'high', 'Fast executing task')
      );

      const slowTasks = Array.from({ length: 20 }, (_, i) =>
        createTestTask(`slow-task-${i}`, 'normal', 'Slower executing task')
      );

      const allTasks = [...fastTasks, ...slowTasks];
      const shuffledTasks = [...allTasks].sort(() => Math.random() - 0.5);

      // Import and configure mocked orchestrator with variable execution times
      const { ApexOrchestrator } = await import('./index');
      const mockOrchestrator = new ApexOrchestrator({ projectPath: testProjectPath }) as any;

      // Override executeTask to have varying execution times
      mockOrchestrator.executeTask.mockImplementation(async (taskId: string) => {
        taskExecutionStartTimes.set(taskId, Date.now());
        executedTaskIds.push(taskId);

        // Fast tasks: 20-60ms, Slow tasks: 200-400ms
        const isFastTask = taskId.includes('fast-task');
        const executionTime = isFastTask ?
          (20 + Math.random() * 40) :
          (200 + Math.random() * 200);

        await new Promise(resolve => setTimeout(resolve, executionTime));

        taskExecutionEndTimes.set(taskId, Date.now());
        return;
      });

      const { TaskStore } = await import('./store');
      const mockStore = new TaskStore(testProjectPath) as any;

      mockStore.addTasksToQueue(shuffledTasks);

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 40,
        maxConcurrentTasks: 6,
      });

      const startTime = Date.now();
      await runner.start();

      // Wait for completion
      let attempts = 0;
      while (executedTaskIds.length < 60 && attempts < 200) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      const endTime = Date.now();
      await runner.stop();

      // Verify completion
      expect(executedTaskIds.length).toBe(60);

      // Calculate execution time statistics
      const fastTaskTimes: number[] = [];
      const slowTaskTimes: number[] = [];

      for (const taskId of executedTaskIds) {
        const startTime = taskExecutionStartTimes.get(taskId);
        const endTime = taskExecutionEndTimes.get(taskId);

        if (startTime && endTime) {
          const duration = endTime - startTime;
          if (taskId.includes('fast-task')) {
            fastTaskTimes.push(duration);
          } else {
            slowTaskTimes.push(duration);
          }
        }
      }

      // Verify execution time distributions
      const avgFastTime = fastTaskTimes.reduce((a, b) => a + b, 0) / fastTaskTimes.length;
      const avgSlowTime = slowTaskTimes.reduce((a, b) => a + b, 0) / slowTaskTimes.length;

      expect(avgFastTime).toBeLessThan(avgSlowTime);
      expect(avgFastTime).toBeLessThan(100); // Fast tasks should average < 100ms
      expect(avgSlowTime).toBeGreaterThan(180); // Slow tasks should average > 180ms

      const totalDuration = endTime - startTime;
      const throughput = 60 / (totalDuration / 1000);

      console.log(`Variable execution test: ${totalDuration}ms total, ${throughput.toFixed(1)} tasks/sec`);
      console.log(`Average times - Fast: ${avgFastTime.toFixed(1)}ms, Slow: ${avgSlowTime.toFixed(1)}ms`);
    });
  });
});