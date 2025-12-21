import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { DaemonRunner, type DaemonRunnerOptions } from './runner';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import { CapacityMonitor } from './capacity-monitor';
import { type Task, type TaskStatus, type TaskPriority } from '@apex/core';
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

vi.mock('@apex/core', () => ({
  loadConfig: vi.fn(),
  getEffectiveConfig: vi.fn(),
}));

describe('Priority-Based Parent Task Auto-Resume - Edge Cases', () => {
  const testProjectPath = '/test/project';
  let daemonRunner: DaemonRunner;

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

    // Mock dependencies
    const { UsageManager } = require('./usage-manager');
    const { DaemonScheduler, UsageManagerProvider } = require('./daemon-scheduler');
    const { CapacityMonitorUsageAdapter } = require('./capacity-monitor-usage-adapter');
    const { loadConfig, getEffectiveConfig } = require('@apexcli/core');

    (UsageManager as any).mockImplementation(() => mockUsageManager);
    (DaemonScheduler as any).mockImplementation(() => mockDaemonScheduler);
    (UsageManagerProvider as any).mockImplementation(() => ({}));
    (CapacityMonitorUsageAdapter as any).mockImplementation(() => ({}));

    loadConfig.mockResolvedValue({});
    getEffectiveConfig.mockReturnValue({});

    const options = {
      projectPath: testProjectPath,
      logStream: mockStream,
    };

    daemonRunner = new DaemonRunner(options);

    // Set up required internal state
    (daemonRunner as any).store = mockStore;
    (daemonRunner as any).orchestrator = mockOrchestrator;
    (daemonRunner as any).capacityMonitor = mockCapacityMonitor;
    (daemonRunner as any).usageManager = mockUsageManager;
    (daemonRunner as any).daemonScheduler = mockDaemonScheduler;
    (daemonRunner as any).isShuttingDown = false;
  });

  afterEach(async () => {
    await daemonRunner.stop();
  });

  const createMockParentTask = (id: string, priority: TaskPriority, subtaskIds: string[]): Task => ({
    id,
    description: `Parent task ${id}`,
    workflow: 'feature',
    autonomy: 'full',
    status: 'paused' as TaskStatus,
    priority,
    projectPath: testProjectPath,
    branchName: 'test-branch',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    dependsOn: [],
    blockedBy: [],
    parentTaskId: undefined,
    subtaskIds,
    subtaskStrategy: 'parallel',
    createdAt: new Date(),
    updatedAt: new Date(),
    pausedAt: new Date(),
    pauseReason: 'capacity',
    usage: {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      estimatedCost: 0.05,
    },
    logs: [],
    artifacts: [],
  });

  const createMockEvent = (reason: 'capacity_dropped' | 'budget_reset' | 'mode_switch' | 'usage_limit') => ({
    reason,
    timestamp: new Date(),
    previousUsage: {
      currentTokens: 10000,
      currentCost: 1.0,
      activeTasks: 2,
      maxTokensPerTask: 5000,
      dailyTokens: 50000,
      dailyCost: 10.0,
      monthlyTokens: 1000000,
      monthlyCost: 200.0,
    },
  });

  describe('Edge Cases for Priority-Based Resume', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    it('should handle when findHighestPriorityParentTask throws an error', async () => {
      mockStore.findHighestPriorityParentTask.mockRejectedValue(new Error('Parent task query failed'));
      mockStore.getPausedTasksForResume.mockResolvedValue([]);

      const mockEvent = createMockEvent('capacity_dropped');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should still continue to phase 2 after error in phase 1
      expect(mockStore.getPausedTasksForResume).toHaveBeenCalled();

      // Should log the error
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Auto-resume process failed: Parent task query failed')
      );
    });

    it('should handle when resumeParentSubtasksIfNeeded throws an error during parent resume', async () => {
      const parentTask = createMockParentTask('error-parent', 'urgent', ['subtask-1']);

      mockStore.findHighestPriorityParentTask.mockResolvedValue([parentTask]);
      mockStore.getPausedTasksForResume.mockResolvedValue([parentTask]);
      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      // Mock getTask to throw error for subtask resumption
      mockStore.getTask.mockRejectedValue(new Error('Database connection lost'));

      const mockEvent = createMockEvent('usage_limit');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Parent should still be resumed despite subtask error
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('error-parent');

      // Should log subtask resume error
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Error in resumeParentSubtasksIfNeeded for parent error-parent: Database connection lost')
      );
    });

    it('should handle circular parent-child relationships gracefully', async () => {
      // Create tasks with circular parent-child reference (should not happen in practice)
      const task1 = createMockParentTask('circular-1', 'high', ['circular-2']);
      const task2 = createMockParentTask('circular-2', 'high', ['circular-1']);
      task2.parentTaskId = 'circular-1';

      mockStore.findHighestPriorityParentTask.mockResolvedValue([task1]);
      mockStore.getPausedTasksForResume.mockResolvedValue([task1, task2]);
      mockStore.getTask
        .mockResolvedValueOnce(task1)     // for resumeParentSubtasksIfNeeded
        .mockResolvedValueOnce(task2);    // for circular-2 subtask

      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      const mockEvent = createMockEvent('budget_reset');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should handle this gracefully without infinite loops
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('circular-1');
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('circular-2');
    });

    it('should handle very large numbers of parent tasks and subtasks', async () => {
      // Create many parent tasks
      const parentTasks: Task[] = [];
      for (let i = 0; i < 100; i++) {
        const subtaskIds = [`subtask-${i}-1`, `subtask-${i}-2`, `subtask-${i}-3`];
        parentTasks.push(createMockParentTask(`parent-${i}`, 'normal', subtaskIds));
      }

      mockStore.findHighestPriorityParentTask.mockResolvedValue(parentTasks);
      mockStore.getPausedTasksForResume.mockResolvedValue([...parentTasks]);
      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      // Mock getTask for all parent tasks (for subtask resumption)
      for (const parentTask of parentTasks) {
        mockStore.getTask.mockResolvedValueOnce(parentTask);
        // Mock each subtask as not found to simplify test
        for (const subtaskId of parentTask.subtaskIds!) {
          mockStore.getTask.mockResolvedValueOnce(null);
        }
      }

      const mockEvent = createMockEvent('capacity_dropped');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should handle all parent tasks
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledTimes(100);

      // Should log successful resumption
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Found 100 paused parent task(s) for resume')
      );
    });

    it('should handle priority validation edge cases', async () => {
      // Create parent tasks with undefined/invalid priorities
      const parentWithInvalidPriority = createMockParentTask('invalid-priority', 'normal', ['sub1']);
      (parentWithInvalidPriority as any).priority = 'invalid' as TaskPriority;

      const parentWithUndefinedPriority = createMockParentTask('undefined-priority', 'normal', ['sub2']);
      (parentWithUndefinedPriority as any).priority = undefined;

      const validParent = createMockParentTask('valid-priority', 'high', ['sub3']);

      mockStore.findHighestPriorityParentTask.mockResolvedValue([
        parentWithInvalidPriority,
        parentWithUndefinedPriority,
        validParent
      ]);
      mockStore.getPausedTasksForResume.mockResolvedValue([]);
      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      const mockEvent = createMockEvent('mode_switch');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should attempt to resume all tasks regardless of priority validation
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure during parent task resumption', async () => {
      const successParent = createMockParentTask('success-parent', 'urgent', ['success-sub']);
      const failureParent = createMockParentTask('failure-parent', 'high', ['failure-sub']);

      mockStore.findHighestPriorityParentTask.mockResolvedValue([successParent, failureParent]);
      mockStore.getPausedTasksForResume.mockResolvedValue([successParent, failureParent]);

      // First parent succeeds, second parent fails
      mockOrchestrator.resumePausedTask
        .mockResolvedValueOnce(true)   // success-parent
        .mockRejectedValueOnce(new Error('Resume failed'));  // failure-parent

      // Mock subtask resumption for successful parent
      mockStore.getTask.mockResolvedValueOnce(successParent);
      mockStore.getTask.mockResolvedValueOnce(null); // subtask not found

      const mockEvent = createMockEvent('budget_reset');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should log success for first parent
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Auto-resumed parent task success-parent')
      );

      // Should log error for second parent
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Error resuming parent task failure-parent: Resume failed')
      );

      // Should still emit final event with error details
      expect(mockOrchestrator.emit).toHaveBeenCalledWith('tasks:auto-resumed', {
        reason: 'budget_reset',
        totalTasks: 2,
        resumedCount: 1,
        errors: [{ taskId: 'failure-parent', error: 'Resume failed' }],
        timestamp: expect.any(Date),
      });
    });

    it('should handle orchestrator.resumePausedTask returning false for parent tasks', async () => {
      const nonResumableParent = createMockParentTask('non-resumable', 'urgent', ['sub1']);

      mockStore.findHighestPriorityParentTask.mockResolvedValue([nonResumableParent]);
      mockStore.getPausedTasksForResume.mockResolvedValue([nonResumableParent]);

      // Return false indicating task is not in resumable state
      mockOrchestrator.resumePausedTask.mockResolvedValue(false);

      const mockEvent = createMockEvent('usage_limit');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should log warning about non-resumable parent
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Failed to resume parent task non-resumable: Task not in resumable state')
      );

      // Should not attempt subtask resumption since parent failed
      expect(mockStore.getTask).not.toHaveBeenCalledWith('non-resumable');

      // Should still continue to phase 2
      expect(mockStore.getPausedTasksForResume).toHaveBeenCalled();
    });
  });

  describe('Edge Cases for resumeParentSubtasksIfNeeded', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    it('should handle getTask database errors gracefully', async () => {
      const parentTaskId = 'error-parent';

      mockStore.getTask.mockRejectedValue(new Error('Database timeout'));

      await (daemonRunner as any).resumeParentSubtasksIfNeeded(parentTaskId);

      // Should log error and not crash
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Error in resumeParentSubtasksIfNeeded for parent error-parent: Database timeout')
      );

      expect(mockOrchestrator.resumePausedTask).not.toHaveBeenCalled();
    });

    it('should handle very large subtask arrays', async () => {
      const parentTaskId = 'large-parent';
      const subtaskIds = Array.from({ length: 1000 }, (_, i) => `subtask-${i}`);

      const parentTask = createMockParentTask(parentTaskId, 'high', subtaskIds);

      // Mock parent task retrieval
      mockStore.getTask.mockResolvedValueOnce(parentTask);

      // Mock all subtasks as not found to keep test simple
      for (let i = 0; i < 1000; i++) {
        mockStore.getTask.mockResolvedValueOnce(null);
      }

      await (daemonRunner as any).resumeParentSubtasksIfNeeded(parentTaskId);

      // Should log about checking large number of subtasks
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Checking 1000 subtask(s) for auto-resume')
      );

      // Should not resume any since all are null
      expect(mockOrchestrator.resumePausedTask).not.toHaveBeenCalled();
    });

    it('should handle malformed subtask data', async () => {
      const parentTaskId = 'malformed-parent';

      // Create parent with malformed subtaskIds
      const parentTask = createMockParentTask(parentTaskId, 'high', []);
      (parentTask as any).subtaskIds = 'not-an-array'; // Invalid data type

      mockStore.getTask.mockResolvedValueOnce(parentTask);

      await (daemonRunner as any).resumeParentSubtasksIfNeeded(parentTaskId);

      // Should handle gracefully and log appropriate message
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Parent task malformed-parent has no subtasks to resume')
      );

      expect(mockOrchestrator.resumePausedTask).not.toHaveBeenCalled();
    });
  });
});