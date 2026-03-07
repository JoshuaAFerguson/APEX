import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DaemonRunner, type DaemonRunnerOptions } from './runner';
import type { Task } from '@apexcli/core';

/**
 * Improved test suite for concurrent task execution implementation in DaemonRunner.
 * Fixes mocking issues and provides comprehensive verification of all acceptance criteria:
 * 1. maxConcurrentTasks config exists and is properly applied
 * 2. runningTasks Map correctly tracks active tasks
 * 3. poll() method respects concurrency limits
 * 4. daemon can run multiple tasks simultaneously
 */

// Mock all dependencies before imports
vi.mock(import('fs'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: actual,
    createWriteStream: vi.fn(() => ({
      write: vi.fn(),
      end: vi.fn((callback?: () => void) => callback?.()),
      destroyed: false,
    })),
  };
});

vi.mock('@apexcli/core', async () => {
  const original = await vi.importActual('@apexcli/core');
  return {
    ...original,
    loadConfig: vi.fn().mockResolvedValue({}),
    getEffectiveConfig: vi.fn().mockReturnValue({
      limits: { maxConcurrentTasks: 3 },
      daemon: {},
    }),
    RepairLoopConfigSchema: vi.fn(),
  };
});

vi.mock('./store', () => ({
  TaskStore: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    getNextQueuedTask: vi.fn().mockResolvedValue(null),
    listTasks: vi.fn().mockResolvedValue([]),
    updateTask: vi.fn(),
    addLog: vi.fn(),
    updateTaskStatus: vi.fn(),
  })),
}));

vi.mock('./index', () => ({
  ApexOrchestrator: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    executeTask: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    emit: vi.fn(),
  })),
}));

vi.mock('./usage-manager', () => ({
  UsageManager: vi.fn().mockImplementation(() => ({
    trackTaskStart: vi.fn(),
    trackTaskCompletion: vi.fn(),
  })),
}));

vi.mock('./daemon-scheduler', () => ({
  DaemonScheduler: vi.fn().mockImplementation(() => ({
    shouldPauseTasks: vi.fn().mockReturnValue({
      shouldPause: false,
      timeWindow: { mode: 'day', isActive: true },
      capacity: { currentPercentage: 0.5, threshold: 0.90, shouldPause: false },
    }),
  })),
  UsageManagerProvider: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('./capacity-monitor', () => ({
  CapacityMonitor: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
  })),
}));

vi.mock('./capacity-monitor-usage-adapter', () => ({
  CapacityMonitorUsageAdapter: vi.fn().mockImplementation(() => ({})),
}));

describe('DaemonRunner Concurrent Task Execution - Improved', () => {
  const testProjectPath = '/test/project';
  let runner: DaemonRunner;
  let mockStore: any;
  let mockOrchestrator: any;

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

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Get fresh mock instances
    const { TaskStore } = await import('./store');
    const { ApexOrchestrator } = await import('./index');

    mockStore = vi.mocked(TaskStore).mock.results[0]?.value;
    mockOrchestrator = vi.mocked(ApexOrchestrator).mock.results[0]?.value;

    // Setup default mock implementations
    if (mockStore) {
      mockStore.getNextQueuedTask = vi.fn().mockResolvedValue(null);
      mockStore.listTasks = vi.fn().mockResolvedValue([]);
      mockStore.updateTask = vi.fn();
      mockStore.addLog = vi.fn();
    }

    if (mockOrchestrator) {
      mockOrchestrator.executeTask = vi.fn().mockResolvedValue(undefined);
    }
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (runner) {
      try {
        await runner.stop();
      } catch {}
    }
    vi.resetAllMocks();
  });

  describe('Acceptance Criteria 1: maxConcurrentTasks configuration', () => {
    it('should respect maxConcurrentTasks from options', async () => {
      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 5,
      });

      await runner.start();

      // Should use the explicit value from options, not config
      const metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(true);

      // Test by providing multiple tasks and verifying limit is respected
      const tasks = Array.from({ length: 10 }, (_, i) => createMockTask(`task-${i}`));
      let taskIndex = 0;

      mockStore.getNextQueuedTask = vi.fn().mockImplementation(() => {
        if (taskIndex < tasks.length) {
          return Promise.resolve(tasks[taskIndex++]);
        }
        return Promise.resolve(null);
      });

      // Mock long-running tasks to test concurrency limit
      const executionPromises: Array<() => void> = [];
      mockOrchestrator.executeTask = vi.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
          executionPromises.push(resolve);
        });
      });

      // Trigger polling to start tasks - should start up to maxConcurrentTasks (5)
      for (let i = 0; i < 3; i++) {
        await (runner as any).poll();
      }

      // Should respect the maxConcurrentTasks limit (5)
      const currentMetrics = runner.getMetrics();
      expect(currentMetrics.activeTaskCount).toBeLessThanOrEqual(5);
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(Math.min(5, tasks.length));
    });

    it('should use config maxConcurrentTasks when option is 0', async () => {
      const { getEffectiveConfig } = await import('@apexcli/core');
      vi.mocked(getEffectiveConfig).mockReturnValue({
        limits: { maxConcurrentTasks: 7 },
        daemon: {},
      });

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

      mockStore.getNextQueuedTask = vi.fn().mockImplementation(() => {
        if (taskIndex < tasks.length) {
          return Promise.resolve(tasks[taskIndex++]);
        }
        return Promise.resolve(null);
      });

      const executionPromises: Array<() => void> = [];
      mockOrchestrator.executeTask = vi.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
          executionPromises.push(resolve);
        });
      });

      // Trigger multiple polls
      for (let i = 0; i < 10; i++) {
        await (runner as any).poll();
      }

      const currentMetrics = runner.getMetrics();
      expect(currentMetrics.activeTaskCount).toBeLessThanOrEqual(7);
    });

    it('should handle invalid maxConcurrentTasks gracefully', async () => {
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
      mockStore.getNextQueuedTask = vi.fn().mockResolvedValueOnce(task).mockResolvedValue(null);

      await (runner as any).poll();
      // Should not crash or throw errors with invalid config
    });
  });

  describe('Acceptance Criteria 2: runningTasks Map tracking', () => {
    it('should correctly track active tasks in runningTasks Map', async () => {
      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 3,
      });

      await runner.start();

      const task1 = createMockTask('task-1');
      const task2 = createMockTask('task-2');

      let resolveTask1: () => void;
      let resolveTask2: () => void;

      // Create controllable promises for tasks
      mockOrchestrator.executeTask = vi.fn().mockImplementation((taskId: string) => {
        if (taskId === 'task-1') {
          return new Promise<void>((resolve) => { resolveTask1 = resolve; });
        } else if (taskId === 'task-2') {
          return new Promise<void>((resolve) => { resolveTask2 = resolve; });
        }
        return Promise.resolve();
      });

      // Start first task
      mockStore.getNextQueuedTask = vi.fn().mockResolvedValueOnce(task1);
      await (runner as any).poll();

      let metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(1);
      expect(metrics.activeTaskIds).toContain('task-1');

      // Start second task
      mockStore.getNextQueuedTask = vi.fn().mockResolvedValueOnce(task2).mockResolvedValue(null);
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
      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 2,
      });

      await runner.start();

      const task1 = createMockTask('task-1');
      const task2 = createMockTask('task-2');

      // First task succeeds, second fails
      mockOrchestrator.executeTask = vi.fn()
        .mockResolvedValueOnce(undefined)  // task-1 succeeds
        .mockRejectedValueOnce(new Error('Task failed')); // task-2 fails

      mockStore.getNextQueuedTask = vi.fn()
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
      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 3,
      });

      await runner.start();

      const task = createMockTask('duplicate-task');

      // Mock store to return the same task multiple times
      mockStore.getNextQueuedTask = vi.fn().mockResolvedValue(task);

      // Mock long-running task execution
      mockOrchestrator.executeTask = vi.fn().mockImplementation(() => {
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
      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 2,
      });

      await runner.start();

      // Create 5 tasks but limit is 2
      const tasks = Array.from({ length: 5 }, (_, i) => createMockTask(`task-${i}`));
      let taskIndex = 0;

      mockStore.getNextQueuedTask = vi.fn().mockImplementation(() => {
        if (taskIndex < tasks.length) {
          return Promise.resolve(tasks[taskIndex++]);
        }
        return Promise.resolve(null);
      });

      // Mock long-running tasks
      const executionPromises: Array<() => void> = [];
      mockOrchestrator.executeTask = vi.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
          executionPromises.push(resolve);
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
      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 2,
      });

      await runner.start();

      const tasks = Array.from({ length: 4 }, (_, i) => createMockTask(`task-${i}`));
      let taskIndex = 0;
      const resolvers: Array<() => void> = [];

      mockStore.getNextQueuedTask = vi.fn().mockImplementation(() => {
        if (taskIndex < tasks.length) {
          return Promise.resolve(tasks[taskIndex++]);
        }
        return Promise.resolve(null);
      });

      mockOrchestrator.executeTask = vi.fn().mockImplementation((taskId: string) => {
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
  });

  describe('Acceptance Criteria 4: Simultaneous task execution', () => {
    it('should run multiple tasks simultaneously', async () => {
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
      mockStore.getNextQueuedTask = vi.fn().mockImplementation(() => {
        if (taskIndex < tasks.length) {
          return Promise.resolve(tasks[taskIndex++]);
        }
        return Promise.resolve(null);
      });

      const executionOrder: string[] = [];
      const startTimes: Record<string, number> = {};
      const resolvers: Array<() => void> = [];

      mockOrchestrator.executeTask = vi.fn().mockImplementation((taskId: string) => {
        startTimes[taskId] = Date.now();
        executionOrder.push(`start-${taskId}`);

        return new Promise<void>((resolve) => {
          resolvers.push(() => {
            executionOrder.push(`end-${taskId}`);
            resolve();
          });
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

      // Verify execution was truly simultaneous (start times should be very close)
      const startTimeValues = Object.values(startTimes);
      const maxStartDiff = Math.max(...startTimeValues) - Math.min(...startTimeValues);
      expect(maxStartDiff).toBeLessThan(50); // Started within 50ms of each other

      // Complete all tasks
      resolvers.forEach(resolve => resolve());
      await vi.runAllTimersAsync();

      // Verify all tasks completed
      const finalMetrics = runner.getMetrics();
      expect(finalMetrics.activeTaskCount).toBe(0);
      expect(finalMetrics.tasksProcessed).toBe(3);
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle task execution errors without affecting other concurrent tasks', async () => {
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
      mockStore.getNextQueuedTask = vi.fn().mockImplementation(() => {
        if (taskIndex < tasks.length) {
          return Promise.resolve(tasks[taskIndex++]);
        }
        return Promise.resolve(null);
      });

      const resolvers: Array<() => void> = [];
      mockOrchestrator.executeTask = vi.fn().mockImplementation((taskId: string) => {
        if (taskId === 'failure-task') {
          return Promise.reject(new Error('Task execution failed'));
        }
        return new Promise<void>((resolve) => {
          resolvers.push(resolve);
        });
      });

      await (runner as any).poll();

      const metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(3);

      // Complete successful tasks
      resolvers.forEach(resolve => resolve());
      await vi.runAllTimersAsync();

      const finalMetrics = runner.getMetrics();
      expect(finalMetrics.activeTaskCount).toBe(0);
      expect(finalMetrics.tasksSucceeded).toBe(2);
      expect(finalMetrics.tasksFailed).toBe(1);
    });

    it('should handle rapid shutdown during concurrent task execution', async () => {
      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 3,
      });

      await runner.start();

      const tasks = Array.from({ length: 3 }, (_, i) => createMockTask(`shutdown-task-${i}`));
      let taskIndex = 0;

      mockStore.getNextQueuedTask = vi.fn().mockImplementation(() => {
        if (taskIndex < tasks.length) {
          return Promise.resolve(tasks[taskIndex++]);
        }
        return Promise.resolve(null);
      });

      const resolvers: Array<() => void> = [];
      mockOrchestrator.executeTask = vi.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
          resolvers.push(resolve);
        });
      });

      await (runner as any).poll();

      const metricsBeforeShutdown = runner.getMetrics();
      expect(metricsBeforeShutdown.activeTaskCount).toBe(3);

      // Initiate shutdown while tasks are running
      const stopPromise = runner.stop();

      // Complete tasks to allow graceful shutdown
      resolvers.forEach(resolve => resolve());
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();

      await stopPromise;

      const metricsAfterShutdown = runner.getMetrics();
      expect(metricsAfterShutdown.isRunning).toBe(false);
    });
  });
});