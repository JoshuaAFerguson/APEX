import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { DaemonRunner, type DaemonRunnerOptions } from './runner';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import type { Task } from '@apexcli/core';

/**
 * Comprehensive test suite for concurrent task execution implementation in DaemonRunner.
 * Verifies all acceptance criteria:
 * 1. maxConcurrentTasks config exists and is properly applied
 * 2. runningTasks Map correctly tracks active tasks
 * 3. poll() method respects concurrency limits
 * 4. daemon can run multiple tasks simultaneously
 */

describe('DaemonRunner Concurrent Task Execution', () => {
  const testProjectPath = '/test/project';
  let runner: DaemonRunner;
  let mockStore: any;
  let mockOrchestrator: any;
  let mockStream: any;

  // Sample tasks for testing
  const createMockTask = (id: string, parentTaskId?: string): Task => ({
    id,
    description: `Test task ${id}`,
    status: 'queued' as const,
    workflow: 'test-workflow',
    autonomy: 'medium' as const,
    projectPath: testProjectPath,
    createdAt: new Date(),
    updatedAt: new Date(),
    parentTaskId,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock file system
    mockStream = {
      write: vi.fn(),
      end: vi.fn((callback?: () => void) => callback?.()),
      destroyed: false,
    };

    vi.doMock(import('fs'), async (importOriginal) => {
      const actual = await importOriginal();
      return {
        ...actual,
        default: actual,
        createWriteStream: vi.fn().mockReturnValue(mockStream),
      };
    });

    // Mock store
    mockStore = {
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
      getNextQueuedTask: vi.fn().mockResolvedValue(null),
      listTasks: vi.fn().mockResolvedValue([]),
      updateTask: vi.fn(),
      addLog: vi.fn(),
    };

    vi.doMock('./store', () => ({
      TaskStore: vi.fn().mockImplementation(() => mockStore),
    }));

    // Mock orchestrator
    mockOrchestrator = {
      initialize: vi.fn().mockResolvedValue(undefined),
      executeTask: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      emit: vi.fn(),
    };

    vi.doMock('./index', () => ({
      ApexOrchestrator: vi.fn().mockImplementation(() => mockOrchestrator),
    }));

    // Mock config
    vi.doMock('@apexcli/core', () => ({
      loadConfig: vi.fn().mockResolvedValue({}),
      getEffectiveConfig: vi.fn().mockReturnValue({
        limits: { maxConcurrentTasks: 3 },
        daemon: {},
      }),
    }));

    // Mock other dependencies
    vi.doMock('./usage-manager', () => ({
      UsageManager: vi.fn().mockImplementation(() => ({
        trackTaskStart: vi.fn(),
        trackTaskCompletion: vi.fn(),
      })),
    }));

    vi.doMock('./daemon-scheduler', () => ({
      DaemonScheduler: vi.fn().mockImplementation(() => ({
        shouldPauseTasks: vi.fn().mockReturnValue({
          shouldPause: false,
          timeWindow: { mode: 'day', isActive: true },
          capacity: { currentPercentage: 0.5, threshold: 0.90, shouldPause: false },
        }),
      })),
      UsageManagerProvider: vi.fn().mockImplementation(() => ({})),
    }));

    vi.doMock('./capacity-monitor', () => ({
      CapacityMonitor: vi.fn().mockImplementation(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        on: vi.fn(),
        emit: vi.fn(),
      })),
    }));

    vi.doMock('./capacity-monitor-usage-adapter', () => ({
      CapacityMonitorUsageAdapter: vi.fn().mockImplementation(() => ({})),
    }));
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (runner) {
      try {
        await runner.stop();
      } catch {}
    }
    vi.resetAllMocks();
    vi.doUnmock('fs');
    vi.doUnmock('./store');
    vi.doUnmock('./index');
    vi.doUnmock('@apexcli/core');
    vi.doUnmock('./usage-manager');
    vi.doUnmock('./daemon-scheduler');
    vi.doUnmock('./capacity-monitor');
    vi.doUnmock('./capacity-monitor-usage-adapter');
  });

  describe('Acceptance Criteria 1: maxConcurrentTasks configuration', () => {
    it('should respect maxConcurrentTasks from options', async () => {
      const { DaemonRunner } = await import('./runner');

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 5,
      });

      await runner.start();

      // Should use the explicit value from options, not config
      const metrics = runner.getMetrics();

      // Verify that the daemon is initialized and running
      expect(metrics.isRunning).toBe(true);

      // Test by providing multiple tasks and verifying limit is respected
      const tasks = Array.from({ length: 10 }, (_, i) => createMockTask(`task-${i}`));
      let taskIndex = 0;

      mockStore.getNextQueuedTask.mockImplementation(() => {
        if (taskIndex < tasks.length) {
          return Promise.resolve(tasks[taskIndex++]);
        }
        return Promise.resolve(null);
      });

      // Mock long-running tasks to test concurrency limit
      let runningTaskCount = 0;
      mockOrchestrator.executeTask.mockImplementation(() => {
        runningTaskCount++;
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            runningTaskCount--;
            resolve();
          }, 1000);
        });
      });

      // Trigger polling to start tasks
      await (runner as any).poll();
      await (runner as any).poll();
      await (runner as any).poll();

      // Should respect the maxConcurrentTasks limit (5)
      const currentMetrics = runner.getMetrics();
      expect(currentMetrics.activeTaskCount).toBeLessThanOrEqual(5);
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(Math.min(5, tasks.length));
    });

    it('should use config maxConcurrentTasks when option is 0', async () => {
      const { getEffectiveConfig } = require('@apexcli/core');
      getEffectiveConfig.mockReturnValue({
        limits: { maxConcurrentTasks: 7 },
        daemon: {},
      });

      const { DaemonRunner } = await import('./runner');

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 0, // Use config value
      });

      await runner.start();

      // Should use config.limits.maxConcurrentTasks (7)
      const metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(true);

      // Verify by testing with multiple tasks
      const tasks = Array.from({ length: 15 }, (_, i) => createMockTask(`task-${i}`));
      let taskIndex = 0;

      mockStore.getNextQueuedTask.mockImplementation(() => {
        if (taskIndex < tasks.length) {
          return Promise.resolve(tasks[taskIndex++]);
        }
        return Promise.resolve(null);
      });

      mockOrchestrator.executeTask.mockImplementation(() => {
        return new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 1000);
        });
      });

      // Trigger multiple polls
      for (let i = 0; i < 10; i++) {
        await (runner as any).poll();
      }

      const currentMetrics = runner.getMetrics();
      expect(currentMetrics.activeTaskCount).toBeLessThanOrEqual(7);
    });

    it('should enforce minimum maxConcurrentTasks of 1', async () => {
      const { DaemonRunner } = await import('./runner');

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: -5, // Invalid negative value
      });

      await runner.start();

      // Should handle gracefully and not crash
      const metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(true);

      // Should still be able to process at least one task
      const task = createMockTask('test-task');
      mockStore.getNextQueuedTask.mockResolvedValueOnce(task).mockResolvedValue(null);

      await (runner as any).poll();
      // Should not crash or throw errors with invalid config
    });
  });

  describe('Acceptance Criteria 2: runningTasks Map tracking', () => {
    it('should correctly track active tasks in runningTasks Map', async () => {
      const { DaemonRunner } = await import('./runner');

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 3,
      });

      await runner.start();

      const task1 = createMockTask('task-1');
      const task2 = createMockTask('task-2');
      const task3 = createMockTask('task-3');

      let resolveTask1: () => void;
      let resolveTask2: () => void;
      let resolveTask3: () => void;

      // Create controllable promises for tasks
      mockOrchestrator.executeTask.mockImplementation((taskId: string) => {
        if (taskId === 'task-1') {
          return new Promise<void>((resolve) => { resolveTask1 = resolve; });
        } else if (taskId === 'task-2') {
          return new Promise<void>((resolve) => { resolveTask2 = resolve; });
        } else if (taskId === 'task-3') {
          return new Promise<void>((resolve) => { resolveTask3 = resolve; });
        }
        return Promise.resolve();
      });

      // Start first task
      mockStore.getNextQueuedTask.mockResolvedValueOnce(task1);
      await (runner as any).poll();

      let metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(1);
      expect(metrics.activeTaskIds).toContain('task-1');

      // Start second task
      mockStore.getNextQueuedTask.mockResolvedValueOnce(task2).mockResolvedValue(null);
      await (runner as any).poll();

      metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(2);
      expect(metrics.activeTaskIds).toContain('task-1');
      expect(metrics.activeTaskIds).toContain('task-2');

      // Complete first task
      resolveTask1!();
      await vi.runAllTimersAsync();

      metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(1);
      expect(metrics.activeTaskIds).not.toContain('task-1');
      expect(metrics.activeTaskIds).toContain('task-2');

      // Complete second task
      resolveTask2!();
      await vi.runAllTimersAsync();

      metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(0);
      expect(metrics.activeTaskIds).toEqual([]);
    });

    it('should clean up runningTasks Map on task failure', async () => {
      const { DaemonRunner } = await import('./runner');

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 2,
      });

      await runner.start();

      const task1 = createMockTask('task-1');
      const task2 = createMockTask('task-2');

      // First task succeeds, second fails
      mockOrchestrator.executeTask
        .mockResolvedValueOnce(undefined)  // task-1 succeeds
        .mockRejectedValueOnce(new Error('Task failed')); // task-2 fails

      mockStore.getNextQueuedTask
        .mockResolvedValueOnce(task1)
        .mockResolvedValueOnce(task2)
        .mockResolvedValue(null);

      await (runner as any).poll();
      await (runner as any).poll();

      // Both tasks should be tracked initially
      let metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(2);

      // Wait for tasks to complete/fail
      await vi.runAllTimersAsync();

      // Both tasks should be cleaned up regardless of success/failure
      metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(0);
      expect(metrics.activeTaskIds).toEqual([]);
    });

    it('should prevent duplicate task execution', async () => {
      const { DaemonRunner } = await import('./runner');

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 3,
      });

      await runner.start();

      const task = createMockTask('duplicate-task');

      // Mock store to return the same task multiple times
      mockStore.getNextQueuedTask.mockResolvedValue(task);

      // Mock long-running task execution
      mockOrchestrator.executeTask.mockImplementation(() => {
        return new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 2000);
        });
      });

      // Trigger multiple polls rapidly
      await (runner as any).poll();
      await (runner as any).poll();
      await (runner as any).poll();

      // Task should only be executed once, not multiple times
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(1);
      expect(mockOrchestrator.executeTask).toHaveBeenCalledWith('duplicate-task');

      const metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(1);
      expect(metrics.activeTaskIds).toEqual(['duplicate-task']);
    });
  });

  describe('Acceptance Criteria 3: poll() concurrency limit enforcement', () => {
    it('should respect concurrency limits in poll() method', async () => {
      const { DaemonRunner } = await import('./runner');

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 2,
      });

      await runner.start();

      // Create 5 tasks but limit is 2
      const tasks = Array.from({ length: 5 }, (_, i) => createMockTask(`task-${i}`));
      let taskIndex = 0;

      mockStore.getNextQueuedTask.mockImplementation(() => {
        if (taskIndex < tasks.length) {
          return Promise.resolve(tasks[taskIndex++]);
        }
        return Promise.resolve(null);
      });

      // Mock long-running tasks
      mockOrchestrator.executeTask.mockImplementation(() => {
        return new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 5000); // Long running
        });
      });

      // First poll - should start 2 tasks
      await (runner as any).poll();

      let metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(2);
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(2);

      // Second poll - should not start more tasks (at capacity)
      await (runner as any).poll();

      metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(2); // Still 2, not more
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(2); // No additional calls

      // Third poll - still at capacity
      await (runner as any).poll();

      metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(2);
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(2);
    });

    it('should start new tasks when slots become available', async () => {
      const { DaemonRunner } = await import('./runner');

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 2,
      });

      await runner.start();

      const tasks = Array.from({ length: 4 }, (_, i) => createMockTask(`task-${i}`));
      let taskIndex = 0;
      const resolvers: Array<() => void> = [];

      mockStore.getNextQueuedTask.mockImplementation(() => {
        if (taskIndex < tasks.length) {
          return Promise.resolve(tasks[taskIndex++]);
        }
        return Promise.resolve(null);
      });

      mockOrchestrator.executeTask.mockImplementation((taskId: string) => {
        return new Promise<void>((resolve) => {
          resolvers.push(resolve);
        });
      });

      // Start first batch (2 tasks)
      await (runner as any).poll();

      let metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(2);
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(2);

      // Complete one task to free up a slot
      resolvers[0]();
      await vi.runAllTimersAsync();

      // Poll again - should start one more task
      await (runner as any).poll();

      metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(2); // Still 2 total (1 completed, 1 new, 1 ongoing)
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(3); // One more call

      // Complete another task
      resolvers[1]();
      await vi.runAllTimersAsync();

      // Poll again
      await (runner as any).poll();

      metrics = runner.getMetrics();
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(4); // All 4 tasks processed
    });

    it('should handle zero available slots gracefully', async () => {
      const { DaemonRunner } = await import('./runner');

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 1,
      });

      await runner.start();

      const task = createMockTask('blocking-task');
      mockStore.getNextQueuedTask.mockResolvedValue(task);

      // Mock task that never completes
      mockOrchestrator.executeTask.mockImplementation(() => {
        return new Promise<void>(() => {}); // Never resolves
      });

      // First poll starts the task
      await (runner as any).poll();

      let metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(1);

      // Subsequent polls should not start duplicate tasks
      await (runner as any).poll();
      await (runner as any).poll();

      metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(1); // Still just 1
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(1); // Only called once
    });
  });

  describe('Acceptance Criteria 4: Simultaneous task execution', () => {
    it('should run multiple tasks simultaneously', async () => {
      const { DaemonRunner } = await import('./runner');

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 3,
      });

      await runner.start();

      const tasks = [
        createMockTask('task-1'),
        createMockTask('task-2'),
        createMockTask('task-3'),
      ];

      let taskIndex = 0;
      mockStore.getNextQueuedTask.mockImplementation(() => {
        if (taskIndex < tasks.length) {
          return Promise.resolve(tasks[taskIndex++]);
        }
        return Promise.resolve(null);
      });

      const executionOrder: string[] = [];
      const startTimes: Record<string, number> = {};
      const endTimes: Record<string, number> = {};

      mockOrchestrator.executeTask.mockImplementation((taskId: string) => {
        startTimes[taskId] = Date.now();
        executionOrder.push(`start-${taskId}`);

        return new Promise<void>((resolve) => {
          setTimeout(() => {
            endTimes[taskId] = Date.now();
            executionOrder.push(`end-${taskId}`);
            resolve();
          }, 100 + Math.random() * 100); // Random execution time
        });
      });

      // Start all tasks in one poll
      await (runner as any).poll();

      const metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(3);
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(3);

      // Verify all tasks started before any completed (simultaneous execution)
      expect(executionOrder).toContain('start-task-1');
      expect(executionOrder).toContain('start-task-2');
      expect(executionOrder).toContain('start-task-3');

      // Wait for tasks to complete
      await vi.runAllTimersAsync();

      // Verify execution was truly simultaneous (start times should be very close)
      const startTimeValues = Object.values(startTimes);
      const maxStartDiff = Math.max(...startTimeValues) - Math.min(...startTimeValues);
      expect(maxStartDiff).toBeLessThan(50); // Started within 50ms of each other

      // Verify all tasks completed
      const finalMetrics = runner.getMetrics();
      expect(finalMetrics.activeTaskCount).toBe(0);
      expect(finalMetrics.tasksProcessed).toBe(3);
    });

    it('should handle mixed parent and child tasks simultaneously', async () => {
      const { DaemonRunner } = await import('./runner');

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 3,
      });

      await runner.start();

      const parentTask = createMockTask('parent-task');
      const childTask1 = createMockTask('child-task-1', 'parent-task');
      const childTask2 = createMockTask('child-task-2', 'parent-task');

      const tasks = [parentTask, childTask1, childTask2];
      let taskIndex = 0;

      mockStore.getNextQueuedTask.mockImplementation(() => {
        if (taskIndex < tasks.length) {
          return Promise.resolve(tasks[taskIndex++]);
        }
        return Promise.resolve(null);
      });

      const executionTimes: Record<string, { start: number; end: number }> = {};

      mockOrchestrator.executeTask.mockImplementation((taskId: string) => {
        executionTimes[taskId] = { start: Date.now(), end: 0 };

        return new Promise<void>((resolve) => {
          setTimeout(() => {
            executionTimes[taskId].end = Date.now();
            resolve();
          }, 150);
        });
      });

      await (runner as any).poll();

      const metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(3);
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(3);

      // Verify simultaneous execution of parent and child tasks
      expect(mockOrchestrator.executeTask).toHaveBeenCalledWith('parent-task');
      expect(mockOrchestrator.executeTask).toHaveBeenCalledWith('child-task-1');
      expect(mockOrchestrator.executeTask).toHaveBeenCalledWith('child-task-2');

      await vi.runAllTimersAsync();

      const finalMetrics = runner.getMetrics();
      expect(finalMetrics.activeTaskCount).toBe(0);
      expect(finalMetrics.tasksSucceeded).toBe(3);
    });

    it('should maintain concurrent execution under high load', async () => {
      const { DaemonRunner } = await import('./runner');

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 5,
      });

      await runner.start();

      // Create a large number of tasks
      const tasks = Array.from({ length: 20 }, (_, i) => createMockTask(`load-task-${i}`));
      let taskIndex = 0;

      mockStore.getNextQueuedTask.mockImplementation(() => {
        if (taskIndex < tasks.length) {
          return Promise.resolve(tasks[taskIndex++]);
        }
        return Promise.resolve(null);
      });

      const concurrentCounts: number[] = [];
      let maxConcurrent = 0;

      mockOrchestrator.executeTask.mockImplementation((taskId: string) => {
        return new Promise<void>((resolve) => {
          const currentMetrics = runner.getMetrics();
          const currentCount = currentMetrics.activeTaskCount;
          concurrentCounts.push(currentCount);
          maxConcurrent = Math.max(maxConcurrent, currentCount);

          setTimeout(() => resolve(), 50 + Math.random() * 50);
        });
      });

      // Trigger multiple rapid polls to simulate high load
      for (let i = 0; i < 10; i++) {
        await (runner as any).poll();
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay between polls
      }

      // Wait for initial tasks to start
      await vi.advanceTimersByTime(100);

      // Should maintain proper concurrency limit
      expect(maxConcurrent).toBeLessThanOrEqual(5);

      // Continue processing remaining tasks
      for (let i = 0; i < 10; i++) {
        await (runner as any).poll();
        await vi.advanceTimersByTime(100);
      }

      // Complete all tasks
      await vi.runAllTimersAsync();

      const finalMetrics = runner.getMetrics();
      expect(finalMetrics.activeTaskCount).toBe(0);
      expect(finalMetrics.tasksProcessed).toBe(20);

      // Verify we achieved good utilization (reached the concurrent limit)
      expect(maxConcurrent).toBe(5);
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle task execution errors without affecting other concurrent tasks', async () => {
      const { DaemonRunner } = await import('./runner');

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 3,
      });

      await runner.start();

      const tasks = [
        createMockTask('success-task-1'),
        createMockTask('failure-task'),
        createMockTask('success-task-2'),
      ];

      let taskIndex = 0;
      mockStore.getNextQueuedTask.mockImplementation(() => {
        if (taskIndex < tasks.length) {
          return Promise.resolve(tasks[taskIndex++]);
        }
        return Promise.resolve(null);
      });

      mockOrchestrator.executeTask.mockImplementation((taskId: string) => {
        if (taskId === 'failure-task') {
          return Promise.reject(new Error('Task execution failed'));
        }
        return new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 100);
        });
      });

      await (runner as any).poll();

      const metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(3);

      await vi.runAllTimersAsync();

      const finalMetrics = runner.getMetrics();
      expect(finalMetrics.activeTaskCount).toBe(0);
      expect(finalMetrics.tasksSucceeded).toBe(2);
      expect(finalMetrics.tasksFailed).toBe(1);
    });

    it('should handle rapid shutdown during concurrent task execution', async () => {
      const { DaemonRunner } = await import('./runner');

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 3,
      });

      await runner.start();

      const tasks = Array.from({ length: 3 }, (_, i) => createMockTask(`shutdown-task-${i}`));
      let taskIndex = 0;

      mockStore.getNextQueuedTask.mockImplementation(() => {
        if (taskIndex < tasks.length) {
          return Promise.resolve(tasks[taskIndex++]);
        }
        return Promise.resolve(null);
      });

      mockOrchestrator.executeTask.mockImplementation(() => {
        return new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 2000); // Long running tasks
        });
      });

      await (runner as any).poll();

      const metricsBeforeShutdown = runner.getMetrics();
      expect(metricsBeforeShutdown.activeTaskCount).toBe(3);

      // Initiate shutdown while tasks are running
      const stopPromise = runner.stop();

      // Advance time to allow graceful completion
      vi.advanceTimersByTime(5000);

      await stopPromise;

      const metricsAfterShutdown = runner.getMetrics();
      expect(metricsAfterShutdown.isRunning).toBe(false);
    });
  });
});