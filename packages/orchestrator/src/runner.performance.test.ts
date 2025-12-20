import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DaemonRunner, type DaemonRunnerOptions } from './runner';

// Performance and stress tests for DaemonRunner
describe('DaemonRunner Performance', () => {
  const testProjectPath = '/tmp/apex-perf-test-' + Date.now();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock core dependencies
    vi.doMock('@apexcli/core', () => ({
      loadConfig: vi.fn().mockResolvedValue({
        limits: { maxConcurrentTasks: 10 },
      }),
      getEffectiveConfig: vi.fn().mockReturnValue({
        limits: { maxConcurrentTasks: 10 },
      }),
    }));

    vi.doMock('./store', () => ({
      TaskStore: vi.fn().mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
        getNextQueuedTask: vi.fn().mockResolvedValue(null),
      })),
    }));

    vi.doMock('./index', () => ({
      ApexOrchestrator: vi.fn().mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        executeTask: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
      })),
    }));

    vi.doMock('fs', () => ({
      createWriteStream: vi.fn().mockReturnValue({
        write: vi.fn(),
        end: vi.fn((callback?: () => void) => callback?.()),
        destroyed: false,
      }),
    }));
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.doUnmock('@apexcli/core');
    vi.doUnmock('./store');
    vi.doUnmock('./index');
    vi.doUnmock('fs');
  });

  describe('memory usage and cleanup', () => {
    it('should not leak memory with many task executions', async () => {
      const { TaskStore } = await import('./store');
      const { ApexOrchestrator } = await import('./index');

      const mockStore = new TaskStore(testProjectPath) as any;
      const mockOrchestrator = new ApexOrchestrator({ projectPath: testProjectPath }) as any;

      // Create many short-lived tasks
      const tasks = Array.from({ length: 100 }, (_, i) => ({
        id: `task-${i}`,
        description: `Task ${i}`,
        status: 'queued' as const,
        workflow: 'test-workflow',
        autonomy: 'medium' as const,
        projectPath: testProjectPath,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      let taskIndex = 0;
      mockStore.getNextQueuedTask.mockImplementation(async () => {
        if (taskIndex < tasks.length) {
          return tasks[taskIndex++];
        }
        return null;
      });

      // Track execution times to ensure tasks complete quickly
      const executionTimes: number[] = [];
      mockOrchestrator.executeTask.mockImplementation(async () => {
        const start = Date.now();
        await new Promise(resolve => setTimeout(resolve, 1)); // Very short task
        executionTimes.push(Date.now() - start);
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 50, // Fast polling
        maxConcurrentTasks: 5,
      });

      await runner.start();

      // Wait for all tasks to be processed
      await new Promise(resolve => setTimeout(resolve, 3000));

      const metrics = runner.getMetrics();

      // All tasks should be processed
      expect(metrics.tasksProcessed).toBe(100);
      expect(metrics.activeTaskCount).toBe(0); // No memory leaks
      expect(metrics.tasksSucceeded).toBe(100);

      // Average execution time should be reasonable
      const avgExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      expect(avgExecutionTime).toBeLessThan(100); // Should be under 100ms average

      await runner.stop();
    });

    it('should handle rapid polling without performance degradation', async () => {
      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 10, // Very fast polling
      });

      const startTime = Date.now();
      await runner.start();

      // Let it poll rapidly for a short time
      await new Promise(resolve => setTimeout(resolve, 1000));

      const metrics = runner.getMetrics();
      const endTime = Date.now();

      // Should have completed many poll cycles
      expect(metrics.pollCount).toBeGreaterThan(50);

      // Should not take excessively long to stop
      const stopStartTime = Date.now();
      await runner.stop();
      const stopDuration = Date.now() - stopStartTime;

      expect(stopDuration).toBeLessThan(1000); // Should stop quickly
    });

    it('should handle concurrent task execution efficiently', async () => {
      const { TaskStore } = await import('./store');
      const { ApexOrchestrator } = await import('./index');

      const mockStore = new TaskStore(testProjectPath) as any;
      const mockOrchestrator = new ApexOrchestrator({ projectPath: testProjectPath }) as any;

      // Create concurrent tasks
      const concurrentTasks = Array.from({ length: 20 }, (_, i) => ({
        id: `concurrent-task-${i}`,
        description: `Concurrent task ${i}`,
        status: 'queued' as const,
        workflow: 'test-workflow',
        autonomy: 'medium' as const,
        projectPath: testProjectPath,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      let taskIndex = 0;
      mockStore.getNextQueuedTask.mockImplementation(async () => {
        if (taskIndex < concurrentTasks.length) {
          return concurrentTasks[taskIndex++];
        }
        return null;
      });

      let maxConcurrent = 0;
      let currentConcurrent = 0;

      mockOrchestrator.executeTask.mockImplementation(async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);

        // Simulate variable execution time
        await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));

        currentConcurrent--;
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 100,
        maxConcurrentTasks: 5, // Limit concurrency
      });

      const startTime = Date.now();
      await runner.start();

      // Wait for all tasks to complete
      while (true) {
        const metrics = runner.getMetrics();
        if (metrics.tasksProcessed === 20 && metrics.activeTaskCount === 0) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const totalTime = Date.now() - startTime;

      // Should respect concurrency limits
      expect(maxConcurrent).toBeLessThanOrEqual(5);

      // Should complete in reasonable time (parallel execution should be faster than serial)
      expect(totalTime).toBeLessThan(10000); // 10 seconds max

      const metrics = runner.getMetrics();
      expect(metrics.tasksSucceeded).toBe(20);

      await runner.stop();
    });
  });

  describe('stress testing', () => {
    it('should handle high-frequency start/stop operations', async () => {
      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 1000,
      });

      // Rapidly start and stop multiple times
      for (let i = 0; i < 10; i++) {
        await runner.start();
        // Quick stop without waiting
        await runner.stop();
      }

      // Final state should be stopped
      const metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(false);
    });

    it('should handle metrics access under load', async () => {
      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 100,
      });

      await runner.start();

      // Rapidly access metrics while polling
      const metricsPromises = Array.from({ length: 100 }, async () => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        return runner.getMetrics();
      });

      const allMetrics = await Promise.all(metricsPromises);

      // All metrics calls should succeed
      expect(allMetrics).toHaveLength(100);
      allMetrics.forEach(metrics => {
        expect(metrics).toHaveProperty('isRunning');
        expect(metrics).toHaveProperty('tasksProcessed');
        expect(metrics.isRunning).toBe(true);
      });

      await runner.stop();
    });

    it('should handle log pressure without blocking', async () => {
      const mockWriteStream = {
        write: vi.fn().mockImplementation(() => {
          // Simulate slow log writing
          return new Promise(resolve => setTimeout(resolve, 10));
        }),
        end: vi.fn((callback?: () => void) => callback?.()),
        destroyed: false,
      };

      vi.doMock('fs', () => ({
        createWriteStream: vi.fn().mockReturnValue(mockWriteStream),
      }));

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 50, // Fast polling = lots of logs
      });

      const startTime = Date.now();
      await runner.start();

      // Let it generate many logs
      await new Promise(resolve => setTimeout(resolve, 1000));

      await runner.stop();
      const totalTime = Date.now() - startTime;

      // Should not be significantly delayed by log writing
      expect(totalTime).toBeLessThan(2000);

      // Should have generated many log entries
      expect(mockWriteStream.write.mock.calls.length).toBeGreaterThan(10);
    });
  });

  describe('resource cleanup verification', () => {
    it('should properly clean up all resources after multiple cycles', async () => {
      const mockWriteStream = {
        write: vi.fn(),
        end: vi.fn(),
        destroyed: false,
      };

      vi.doMock('fs', () => ({
        createWriteStream: vi.fn().mockReturnValue(mockWriteStream),
      }));

      const { TaskStore } = await import('./store');
      const mockStore = new TaskStore(testProjectPath) as any;

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 500,
      });

      // Run multiple start/stop cycles
      for (let cycle = 0; cycle < 5; cycle++) {
        await runner.start();

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 200));

        await runner.stop();

        // Verify clean state after each cycle
        const metrics = runner.getMetrics();
        expect(metrics.isRunning).toBe(false);
        expect(metrics.activeTaskCount).toBe(0);
      }

      // Should have called stream.end for each cycle
      expect(mockWriteStream.end).toHaveBeenCalledTimes(5);

      // Should have called store.close for each cycle
      expect(mockStore.close).toHaveBeenCalledTimes(5);
    });
  });
});