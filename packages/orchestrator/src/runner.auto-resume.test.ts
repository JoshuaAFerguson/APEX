import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { DaemonRunner, type DaemonRunnerOptions } from './runner';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import { CapacityMonitor } from './capacity-monitor';
import { UsageManager } from './usage-manager';
import { type Task, type TaskStatus, type TaskPriority } from '@apexcli/core';
import { createWriteStream } from 'fs';

// Mock dependencies
vi.mock('fs', () => ({
  createWriteStream: vi.fn(),
}));

vi.mock('./index', () => ({
  ApexOrchestrator: vi.fn(),
}));

vi.mock('./store', () => ({
  TaskStore: vi.fn(),
}));

vi.mock('./capacity-monitor', () => ({
  CapacityMonitor: vi.fn(),
}));

vi.mock('./capacity-monitor-usage-adapter', () => ({
  CapacityMonitorUsageAdapter: vi.fn(),
}));

vi.mock('./usage-manager', () => ({
  UsageManager: vi.fn(),
}));

vi.mock('./daemon-scheduler', () => ({
  DaemonScheduler: vi.fn(),
  UsageManagerProvider: vi.fn(),
}));

vi.mock('@apexcli/core', () => ({
  loadConfig: vi.fn(),
  getEffectiveConfig: vi.fn(),
}));

describe('DaemonRunner Auto-Resume', () => {
  const testProjectPath = '/test/project';
  let daemonRunner: DaemonRunner;
  let options: DaemonRunnerOptions;

  // Mock instances
  const mockStream = {
    write: vi.fn(),
    end: vi.fn((callback?: () => void) => callback?.()),
    destroyed: false,
  };

  const mockOrchestrator = {
    initialize: vi.fn(),
    executeTask: vi.fn(),
    resumePausedTask: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
  };

  const mockStore = {
    initialize: vi.fn(),
    close: vi.fn(),
    getNextQueuedTask: vi.fn(),
    getPausedTasksForResume: vi.fn(),
    findHighestPriorityParentTask: vi.fn(),
    getTask: vi.fn(),
  };

  const mockCapacityMonitor = {
    start: vi.fn(),
    stop: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
  };

  const mockUsageManager = {
    trackTaskStart: vi.fn(),
    trackTaskCompletion: vi.fn(),
  };

  const mockDaemonScheduler = {
    shouldPauseTasks: vi.fn(),
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock implementations
    (createWriteStream as MockedFunction<typeof createWriteStream>).mockReturnValue(mockStream as any);
    (ApexOrchestrator as any).mockImplementation(() => mockOrchestrator);
    (TaskStore as any).mockImplementation(() => mockStore);
    (CapacityMonitor as any).mockImplementation(() => mockCapacityMonitor);

    // Mock new dependencies
    const { UsageManager } = require('./usage-manager');
    const { DaemonScheduler, UsageManagerProvider } = require('./daemon-scheduler');
    const { CapacityMonitorUsageAdapter } = require('./capacity-monitor-usage-adapter');

    UsageManager.mockImplementation(() => mockUsageManager);
    DaemonScheduler.mockImplementation(() => mockDaemonScheduler);
    UsageManagerProvider.mockImplementation(() => ({}));
    CapacityMonitorUsageAdapter.mockImplementation(() => ({}));

    // Setup default shouldPauseTasks return value
    mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
      shouldPause: false,
      timeWindow: { mode: 'day', isActive: true },
      capacity: { currentPercentage: 0.5, threshold: 0.90, shouldPause: false },
    });

    // Mock loadConfig and getEffectiveConfig
    const { loadConfig, getEffectiveConfig } = require('@apexcli/core');
    loadConfig.mockResolvedValue({});
    getEffectiveConfig.mockReturnValue({
      limits: {
        maxConcurrentTasks: 3,
        maxTokensPerTask: 10000,
        maxCostPerTask: 1.0,
        dailyBudget: 10.0,
      },
      daemon: {
        pollInterval: 5000,
        logLevel: 'info',
      },
    });

    options = {
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
    };

    daemonRunner = new DaemonRunner(options);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('setupCapacityMonitorEvents', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    it('should setup capacity monitor event handlers', () => {
      expect(mockCapacityMonitor.on).toHaveBeenCalledWith('capacity:restored', expect.any(Function));
    });

    it('should not setup events if capacity monitor is not available', async () => {
      const runner = new DaemonRunner(options);

      // Mock capacity monitor to be null
      const originalImpl = (CapacityMonitor as any).mockImplementation;
      (CapacityMonitor as any).mockImplementation(() => null);

      await runner.start();

      // Should not have called on() since capacityMonitor is null
      expect(mockCapacityMonitor.on).not.toHaveBeenCalled();

      await runner.stop();

      // Restore original implementation
      (CapacityMonitor as any).mockImplementation = originalImpl;
    });

    it('should handle capacity monitor event handler errors gracefully', async () => {
      // Get the registered event handler
      const capacityRestoredCall = mockCapacityMonitor.on.mock.calls.find(
        call => call[0] === 'capacity:restored'
      );
      expect(capacityRestoredCall).toBeDefined();
      const eventHandler = capacityRestoredCall![1];

      // Mock handleCapacityRestored to throw an error by making getPausedTasksForResume fail
      mockStore.getPausedTasksForResume.mockRejectedValue(new Error('Store access failed'));

      const mockEvent = {
        reason: 'test_error' as const,
        timestamp: new Date(),
        previousUsage: {
          currentTokens: 10000,
          currentCost: 1.0,
          activeTasks: 2,
          maxTokensPerTask: 5000,
          maxCostPerTask: 0.5,
          maxConcurrentTasks: 1,
          dailyBudget: 5.0,
          dailySpent: 5.0,
        },
        currentUsage: {
          currentTokens: 5000,
          currentCost: 0.5,
          activeTasks: 1,
          maxTokensPerTask: 10000,
          maxCostPerTask: 1.0,
          maxConcurrentTasks: 2,
          dailyBudget: 10.0,
          dailySpent: 2.5,
        },
        modeInfo: {
          mode: 'day' as const,
          modeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nextModeSwitch: new Date(Date.now() + 60000),
          nextMidnight: new Date(Date.now() + 86400000),
        }
      };

      // Call the event handler - should not throw
      await eventHandler(mockEvent);

      // Should have logged the error
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Failed to handle capacity restoration')
      );
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Store access failed')
      );
    });
  });

  describe('handleCapacityRestored', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    const createMockEvent = (reason: 'capacity_dropped' | 'budget_reset' | 'mode_switch' | 'usage_limit') => ({
      reason,
      timestamp: new Date(),
      previousUsage: {
        currentTokens: 10000,
        currentCost: 1.0,
        activeTasks: 2,
        maxTokensPerTask: 5000,
        maxCostPerTask: 0.5,
        maxConcurrentTasks: 1,
        dailyBudget: 5.0,
        dailySpent: 5.0,
      },
      currentUsage: {
        currentTokens: 5000,
        currentCost: 0.5,
        activeTasks: 1,
        maxTokensPerTask: 10000,
        maxCostPerTask: 1.0,
        maxConcurrentTasks: 2,
        dailyBudget: 10.0,
        dailySpent: 2.5,
      },
      modeInfo: {
        mode: 'day' as const,
        modeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        nextModeSwitch: new Date(Date.now() + 60000),
        nextMidnight: new Date(Date.now() + 86400000),
      }
    });

    const createMockTask = (id: string, pauseReason = 'capacity'): Task => ({
      id,
      description: `Test paused task ${id}`,
      acceptanceCriteria: 'Should be auto-resumed',
      workflow: 'test-workflow',
      autonomy: 'autonomous' as const,
      status: 'paused' as TaskStatus,
      priority: 'normal' as TaskPriority,
      projectPath: testProjectPath,
      branchName: 'test-branch',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      pausedAt: new Date(),
      pauseReason,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      }
    });

    it('should return early if daemon is shutting down', async () => {
      // Set shutting down flag
      (daemonRunner as any).isShuttingDown = true;

      const mockEvent = createMockEvent('capacity_dropped');

      // Call handleCapacityRestored directly
      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should not have called any methods
      expect(mockStore.findHighestPriorityParentTask).not.toHaveBeenCalled();
      expect(mockStore.getPausedTasksForResume).not.toHaveBeenCalled();
      expect(mockOrchestrator.resumePausedTask).not.toHaveBeenCalled();
    });

    it('should return early if store is not available', async () => {
      // Set store to null
      (daemonRunner as any).store = null;

      const mockEvent = createMockEvent('capacity_dropped');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should not have called resumePausedTask
      expect(mockOrchestrator.resumePausedTask).not.toHaveBeenCalled();
    });

    it('should return early if orchestrator is not available', async () => {
      // Set orchestrator to null
      (daemonRunner as any).orchestrator = null;

      const mockEvent = createMockEvent('capacity_dropped');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should not have called store methods
      expect(mockStore.findHighestPriorityParentTask).not.toHaveBeenCalled();
      expect(mockStore.getPausedTasksForResume).not.toHaveBeenCalled();
    });

    it('should handle no resumable paused tasks gracefully', async () => {
      mockStore.findHighestPriorityParentTask.mockResolvedValue([]);
      mockStore.getPausedTasksForResume.mockResolvedValue([]);

      const mockEvent = createMockEvent('budget_reset');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      expect(mockStore.findHighestPriorityParentTask).toHaveBeenCalled();
      expect(mockStore.getPausedTasksForResume).toHaveBeenCalled();
      expect(mockOrchestrator.resumePausedTask).not.toHaveBeenCalled();
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('No resumable paused tasks found')
      );
    });

    it('should successfully resume paused tasks', async () => {
      const task1 = createMockTask('task-1', 'capacity');
      const task2 = createMockTask('task-2', 'budget');

      mockStore.findHighestPriorityParentTask.mockResolvedValue([]);
      mockStore.getPausedTasksForResume.mockResolvedValue([task1, task2]);
      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      const mockEvent = createMockEvent('capacity_dropped');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      expect(mockStore.findHighestPriorityParentTask).toHaveBeenCalled();
      expect(mockStore.getPausedTasksForResume).toHaveBeenCalled();
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledTimes(2);
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('task-1');
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('task-2');

      // Should emit auto-resumed event
      expect(mockOrchestrator.emit).toHaveBeenCalledWith('tasks:auto-resumed', {
        reason: 'capacity_dropped',
        totalTasks: 2,
        resumedCount: 2,
        errors: [],
        timestamp: expect.any(Date),
      });

      // Should log success
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Auto-resume completed: 2/2 tasks resumed')
      );
    });

    it('should handle partial resume failures', async () => {
      const task1 = createMockTask('task-1', 'capacity');
      const task2 = createMockTask('task-2', 'budget');
      const task3 = createMockTask('task-3', 'usage_limit');

      mockStore.getPausedTasksForResume.mockResolvedValue([task1, task2, task3]);
      mockOrchestrator.resumePausedTask
        .mockResolvedValueOnce(true)   // task-1 succeeds
        .mockResolvedValueOnce(false)  // task-2 not resumable
        .mockRejectedValueOnce(new Error('Resume failed')); // task-3 throws error

      const mockEvent = createMockEvent('mode_switch');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledTimes(3);

      // Should emit auto-resumed event with error information
      expect(mockOrchestrator.emit).toHaveBeenCalledWith('tasks:auto-resumed', {
        reason: 'mode_switch',
        totalTasks: 3,
        resumedCount: 1, // Only task-1 succeeded
        errors: [
          { taskId: 'task-3', error: 'Resume failed' }
        ],
        timestamp: expect.any(Date),
      });

      // Should log completion with errors
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Auto-resume completed: 1/3 tasks resumed')
      );
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('1 tasks failed to resume during auto-resume')
      );
    });

    it('should handle resumePausedTask returning false', async () => {
      const task = createMockTask('task-not-resumable', 'capacity');

      mockStore.getPausedTasksForResume.mockResolvedValue([task]);
      mockOrchestrator.resumePausedTask.mockResolvedValue(false);

      const mockEvent = createMockEvent('budget_reset');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should log warning about non-resumable task
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Failed to resume task task-not-resumable: Task not in resumable state')
      );

      // Should emit event with 0 resumed tasks
      expect(mockOrchestrator.emit).toHaveBeenCalledWith('tasks:auto-resumed', {
        reason: 'budget_reset',
        totalTasks: 1,
        resumedCount: 0,
        errors: [],
        timestamp: expect.any(Date),
      });
    });

    it('should handle store.getPausedTasksForResume errors', async () => {
      mockStore.getPausedTasksForResume.mockRejectedValue(new Error('Database error'));

      const mockEvent = createMockEvent('capacity_dropped');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should log the error
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Auto-resume process failed: Database error')
      );

      // Should not have called resumePausedTask
      expect(mockOrchestrator.resumePausedTask).not.toHaveBeenCalled();
    });

    it('should handle orchestrator.resumePausedTask exceptions', async () => {
      const task1 = createMockTask('task-1', 'capacity');
      const task2 = createMockTask('task-2', 'budget');

      mockStore.getPausedTasksForResume.mockResolvedValue([task1, task2]);
      mockOrchestrator.resumePausedTask
        .mockRejectedValueOnce(new Error('Orchestrator connection failed'))
        .mockRejectedValueOnce(new Error('Task state invalid'));

      const mockEvent = createMockEvent('usage_limit');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should emit event with all errors captured
      expect(mockOrchestrator.emit).toHaveBeenCalledWith('tasks:auto-resumed', {
        reason: 'usage_limit',
        totalTasks: 2,
        resumedCount: 0,
        errors: [
          { taskId: 'task-1', error: 'Orchestrator connection failed' },
          { taskId: 'task-2', error: 'Task state invalid' }
        ],
        timestamp: expect.any(Date),
      });
    });

    it('should handle different capacity restoration reasons', async () => {
      const task = createMockTask('test-task', 'capacity');
      mockStore.getPausedTasksForResume.mockResolvedValue([task]);
      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      const reasons: Array<'capacity_dropped' | 'budget_reset' | 'mode_switch' | 'usage_limit'> = [
        'capacity_dropped',
        'budget_reset',
        'mode_switch',
        'usage_limit'
      ];

      for (const reason of reasons) {
        vi.clearAllMocks();

        const mockEvent = createMockEvent(reason);
        await (daemonRunner as any).handleCapacityRestored(mockEvent);

        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining(`Capacity restored: ${reason}`)
        );

        expect(mockOrchestrator.emit).toHaveBeenCalledWith('tasks:auto-resumed',
          expect.objectContaining({ reason })
        );
      }
    });

    it('should handle non-Error exceptions gracefully', async () => {
      const task = createMockTask('task-1', 'capacity');
      mockStore.getPausedTasksForResume.mockResolvedValue([task]);

      // Mock resumePausedTask to throw a non-Error object
      mockOrchestrator.resumePausedTask.mockRejectedValue('String error message');

      const mockEvent = createMockEvent('capacity_dropped');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should handle non-Error exceptions
      expect(mockOrchestrator.emit).toHaveBeenCalledWith('tasks:auto-resumed', {
        reason: 'capacity_dropped',
        totalTasks: 1,
        resumedCount: 0,
        errors: [
          { taskId: 'task-1', error: 'Unknown error' }
        ],
        timestamp: expect.any(Date),
      });
    });

    it('should log individual task resume attempts', async () => {
      const task1 = createMockTask('task-success', 'capacity');
      const task2 = createMockTask('task-failure', 'budget');

      mockStore.getPausedTasksForResume.mockResolvedValue([task1, task2]);
      mockOrchestrator.resumePausedTask
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Task resume failed'));

      const mockEvent = createMockEvent('mode_switch');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should log successful resume
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Auto-resumed task task-success')
      );

      // Should log failed resume
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Error resuming task task-failure: Task resume failed')
      );
    });

    it('should include task context in log messages', async () => {
      const task = createMockTask('contextual-task', 'capacity');
      mockStore.getPausedTasksForResume.mockResolvedValue([task]);
      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      const mockEvent = createMockEvent('budget_reset');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should include taskId in log context
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringMatching(/\[contextua\] Auto-resumed task contextual-task/)
      );
    });
  });

  describe('auto-resume integration with capacity monitoring', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    it('should start capacity monitor during daemon startup', () => {
      expect(mockCapacityMonitor.start).toHaveBeenCalled();
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Capacity monitoring started for auto-resume')
      );
    });

    it('should stop capacity monitor during cleanup', async () => {
      await daemonRunner.stop();

      expect(mockCapacityMonitor.stop).toHaveBeenCalled();
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Capacity monitor stopped')
      );
    });

    it('should handle capacity monitor initialization failure gracefully', async () => {
      const runner = new DaemonRunner(options);

      // Mock capacity monitor constructor to throw
      (CapacityMonitor as any).mockImplementation(() => {
        throw new Error('CapacityMonitor initialization failed');
      });

      await expect(runner.start()).rejects.toThrow();

      // Should have attempted cleanup
      expect(mockStream.end).toHaveBeenCalled();
    });

    it('should not start capacity monitor if not available', async () => {
      const runner = new DaemonRunner(options);

      // Mock to return null capacity monitor
      (CapacityMonitor as any).mockImplementation(() => null);

      await runner.start();

      // Should not have called start on null monitor
      expect(mockCapacityMonitor.start).not.toHaveBeenCalled();

      await runner.stop();
    });
  });

  describe('edge cases and error scenarios', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    it('should handle malformed capacity restored events', async () => {
      const capacityRestoredCall = mockCapacityMonitor.on.mock.calls.find(
        call => call[0] === 'capacity:restored'
      );
      const eventHandler = capacityRestoredCall![1];

      // Call with malformed event (missing required fields)
      const malformedEvent = {
        reason: 'test_reason' as const,
        // missing timestamp, previousUsage, currentUsage, modeInfo
      };

      await eventHandler(malformedEvent);

      // Should handle gracefully without crashing
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Capacity restored: test_reason')
      );
    });

    it('should handle empty paused tasks array', async () => {
      mockStore.getPausedTasksForResume.mockResolvedValue([]);

      const mockEvent = createMockEvent('capacity_dropped');
      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should not emit auto-resumed event for empty array
      expect(mockOrchestrator.emit).not.toHaveBeenCalledWith('tasks:auto-resumed', expect.anything());
    });

    it('should handle concurrent capacity restored events', async () => {
      const task = createMockTask('concurrent-task', 'capacity');
      mockStore.getPausedTasksForResume.mockResolvedValue([task]);
      mockOrchestrator.resumePausedTask.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(true), 100))
      );

      const mockEvent = createMockEvent('capacity_dropped');

      // Fire multiple events concurrently
      const promises = [
        (daemonRunner as any).handleCapacityRestored(mockEvent),
        (daemonRunner as any).handleCapacityRestored(mockEvent),
        (daemonRunner as any).handleCapacityRestored(mockEvent),
      ];

      await Promise.all(promises);

      // All should complete without error
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalled();
    });
  });
});