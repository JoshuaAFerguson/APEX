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

describe('Priority-Based Parent Task Auto-Resume', () => {
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
    const { loadConfig, getEffectiveConfig } = require('@apexcli/core');

    (UsageManager as any).mockImplementation(() => mockUsageManager);
    (DaemonScheduler as any).mockImplementation(() => mockDaemonScheduler);
    (UsageManagerProvider as any).mockImplementation(() => ({}));
    (CapacityMonitorUsageAdapter as any).mockImplementation(() => ({}));

    loadConfig.mockResolvedValue({});
    getEffectiveConfig.mockReturnValue({});

    options = {
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

  const createMockSubtask = (id: string, parentId: string, priority: TaskPriority, status: TaskStatus = 'paused'): Task => ({
    id,
    description: `Subtask ${id}`,
    workflow: 'feature',
    autonomy: 'full',
    status,
    priority,
    projectPath: testProjectPath,
    branchName: 'test-branch',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    dependsOn: [],
    blockedBy: [],
    parentTaskId: parentId,
    subtaskIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    pausedAt: status === 'paused' ? new Date() : undefined,
    pauseReason: status === 'paused' ? 'capacity' : undefined,
    usage: {
      inputTokens: 500,
      outputTokens: 250,
      totalTokens: 750,
      estimatedCost: 0.025,
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

  describe('Priority-Based Parent Task Resume Logic', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    it('should prioritize parent tasks over non-parent tasks during capacity restoration', async () => {
      // Create parent tasks
      const highPriorityParent = createMockParentTask('parent-high', 'high', ['subtask-1', 'subtask-2']);
      const urgentPriorityParent = createMockParentTask('parent-urgent', 'urgent', ['subtask-3']);

      // Create non-parent tasks with high priority
      const urgentRegularTask = createMockSubtask('regular-urgent', undefined!, 'urgent', 'paused');
      urgentRegularTask.parentTaskId = undefined;
      urgentRegularTask.subtaskIds = [];

      // Mock findHighestPriorityParentTask to return parent tasks in priority order
      mockStore.findHighestPriorityParentTask.mockResolvedValue([urgentPriorityParent, highPriorityParent]);

      // Mock getPausedTasksForResume to return all paused tasks including non-parent
      mockStore.getPausedTasksForResume.mockResolvedValue([urgentPriorityParent, highPriorityParent, urgentRegularTask]);

      // Mock orchestrator resume to succeed
      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      const mockEvent = createMockEvent('capacity_dropped');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Verify that findHighestPriorityParentTask was called first (Phase 1)
      expect(mockStore.findHighestPriorityParentTask).toHaveBeenCalled();

      // Verify that parent tasks were resumed first, in priority order
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('parent-urgent');
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('parent-high');

      // Verify that getPausedTasksForResume was called for remaining tasks (Phase 2)
      expect(mockStore.getPausedTasksForResume).toHaveBeenCalled();

      // Verify that regular task was resumed after parent tasks
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('regular-urgent');

      // Verify resume order: parent tasks first, then remaining
      const resumeCalls = mockOrchestrator.resumePausedTask.mock.calls;
      const parentTaskIndex1 = resumeCalls.findIndex(call => call[0] === 'parent-urgent');
      const parentTaskIndex2 = resumeCalls.findIndex(call => call[0] === 'parent-high');
      const regularTaskIndex = resumeCalls.findIndex(call => call[0] === 'regular-urgent');

      expect(parentTaskIndex1).toBeLessThan(regularTaskIndex);
      expect(parentTaskIndex2).toBeLessThan(regularTaskIndex);
      expect(parentTaskIndex1).toBeLessThan(parentTaskIndex2); // urgent before high
    });

    it('should handle case where no parent tasks are found', async () => {
      // Mock no parent tasks available
      mockStore.findHighestPriorityParentTask.mockResolvedValue([]);

      // Mock some regular paused tasks
      const regularTask1 = createMockSubtask('regular-1', undefined!, 'high', 'paused');
      regularTask1.parentTaskId = undefined;
      regularTask1.subtaskIds = [];

      const regularTask2 = createMockSubtask('regular-2', undefined!, 'normal', 'paused');
      regularTask2.parentTaskId = undefined;
      regularTask2.subtaskIds = [];

      mockStore.getPausedTasksForResume.mockResolvedValue([regularTask1, regularTask2]);
      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      const mockEvent = createMockEvent('budget_reset');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should still call findHighestPriorityParentTask
      expect(mockStore.findHighestPriorityParentTask).toHaveBeenCalled();

      // Should proceed to phase 2 with regular tasks
      expect(mockStore.getPausedTasksForResume).toHaveBeenCalled();

      // Should resume regular tasks
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('regular-1');
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('regular-2');

      // Should log about finding remaining tasks
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Found 2 remaining paused task(s) for resume')
      );
    });

    it('should avoid resuming parent tasks twice when they appear in both phases', async () => {
      const parentTask = createMockParentTask('parent-duplicate', 'urgent', ['subtask-1']);
      const regularTask = createMockSubtask('regular-task', undefined!, 'high', 'paused');
      regularTask.parentTaskId = undefined;
      regularTask.subtaskIds = [];

      // Parent task appears in both lists
      mockStore.findHighestPriorityParentTask.mockResolvedValue([parentTask]);
      mockStore.getPausedTasksForResume.mockResolvedValue([parentTask, regularTask]);
      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      const mockEvent = createMockEvent('capacity_dropped');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should only resume parent task once (during phase 1)
      const parentResumeCalls = mockOrchestrator.resumePausedTask.mock.calls.filter(call => call[0] === 'parent-duplicate');
      expect(parentResumeCalls).toHaveLength(1);

      // Should still resume regular task
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('regular-task');
    });

    it('should log phase information during capacity restoration', async () => {
      const parentTask = createMockParentTask('parent-task', 'high', ['subtask-1']);
      const regularTask = createMockSubtask('regular-task', undefined!, 'normal', 'paused');
      regularTask.parentTaskId = undefined;
      regularTask.subtaskIds = [];

      mockStore.findHighestPriorityParentTask.mockResolvedValue([parentTask]);
      mockStore.getPausedTasksForResume.mockResolvedValue([parentTask, regularTask]);
      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      const mockEvent = createMockEvent('usage_limit');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Should log about finding parent tasks
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 paused parent task(s) for resume')
      );

      // Should log about finding remaining tasks
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 remaining paused task(s) for resume')
      );

      // Should log successful parent resume
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Auto-resumed parent task parent-task')
      );
    });
  });

  describe('resumeParentSubtasksIfNeeded', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    it('should resume paused subtasks when parent is resumed', async () => {
      const parentTaskId = 'parent-task';
      const subtask1 = createMockSubtask('subtask-1', parentTaskId, 'normal', 'paused');
      const subtask2 = createMockSubtask('subtask-2', parentTaskId, 'normal', 'paused');

      // Mock parent task with subtasks
      const parentTask = createMockParentTask(parentTaskId, 'high', ['subtask-1', 'subtask-2']);

      mockStore.getTask
        .mockResolvedValueOnce(parentTask) // for parent
        .mockResolvedValueOnce(subtask1)   // for subtask-1
        .mockResolvedValueOnce(subtask2);  // for subtask-2

      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      await (daemonRunner as any).resumeParentSubtasksIfNeeded(parentTaskId);

      // Should get parent task first
      expect(mockStore.getTask).toHaveBeenCalledWith(parentTaskId);

      // Should get each subtask
      expect(mockStore.getTask).toHaveBeenCalledWith('subtask-1');
      expect(mockStore.getTask).toHaveBeenCalledWith('subtask-2');

      // Should resume each paused subtask
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('subtask-1');
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('subtask-2');

      // Should log resumption
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Checking 2 subtask(s) for auto-resume after parent task parent-task resumed')
      );

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Resumed 2 subtask(s) for parent task parent-task')
      );
    });

    it('should only resume subtasks with resumable pause reasons', async () => {
      const parentTaskId = 'parent-task';
      const resumableSubtask = createMockSubtask('resumable-subtask', parentTaskId, 'normal', 'paused');
      resumableSubtask.pauseReason = 'capacity';

      const nonResumableSubtask = createMockSubtask('non-resumable-subtask', parentTaskId, 'normal', 'paused');
      nonResumableSubtask.pauseReason = 'manual';

      const parentTask = createMockParentTask(parentTaskId, 'high', ['resumable-subtask', 'non-resumable-subtask']);

      mockStore.getTask
        .mockResolvedValueOnce(parentTask)
        .mockResolvedValueOnce(resumableSubtask)
        .mockResolvedValueOnce(nonResumableSubtask);

      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      await (daemonRunner as any).resumeParentSubtasksIfNeeded(parentTaskId);

      // Should only resume the subtask with resumable pause reason
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('resumable-subtask');
      expect(mockOrchestrator.resumePausedTask).not.toHaveBeenCalledWith('non-resumable-subtask');

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Resumed 1 subtask(s) for parent task parent-task')
      );
    });

    it('should skip non-paused subtasks', async () => {
      const parentTaskId = 'parent-task';
      const pausedSubtask = createMockSubtask('paused-subtask', parentTaskId, 'normal', 'paused');
      const runningSubtask = createMockSubtask('running-subtask', parentTaskId, 'normal', 'in-progress');
      const completedSubtask = createMockSubtask('completed-subtask', parentTaskId, 'normal', 'completed');

      const parentTask = createMockParentTask(parentTaskId, 'high', ['paused-subtask', 'running-subtask', 'completed-subtask']);

      mockStore.getTask
        .mockResolvedValueOnce(parentTask)
        .mockResolvedValueOnce(pausedSubtask)
        .mockResolvedValueOnce(runningSubtask)
        .mockResolvedValueOnce(completedSubtask);

      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      await (daemonRunner as any).resumeParentSubtasksIfNeeded(parentTaskId);

      // Should only resume the paused subtask
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('paused-subtask');
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledTimes(1);

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Resumed 1 subtask(s) for parent task parent-task')
      );
    });

    it('should handle case where parent has no subtasks', async () => {
      const parentTaskId = 'parent-no-subtasks';
      const parentTask = createMockParentTask(parentTaskId, 'high', []);

      mockStore.getTask.mockResolvedValueOnce(parentTask);

      await (daemonRunner as any).resumeParentSubtasksIfNeeded(parentTaskId);

      // Should log debug message
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Parent task parent-no-subtasks has no subtasks to resume')
      );

      // Should not call resumePausedTask
      expect(mockOrchestrator.resumePausedTask).not.toHaveBeenCalled();
    });

    it('should handle case where parent task is not found', async () => {
      const parentTaskId = 'non-existent-parent';

      mockStore.getTask.mockResolvedValueOnce(null);

      await (daemonRunner as any).resumeParentSubtasksIfNeeded(parentTaskId);

      // Should log debug message
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Parent task non-existent-parent has no subtasks to resume')
      );

      // Should not call resumePausedTask
      expect(mockOrchestrator.resumePausedTask).not.toHaveBeenCalled();
    });

    it('should handle subtask not found gracefully', async () => {
      const parentTaskId = 'parent-task';
      const validSubtask = createMockSubtask('valid-subtask', parentTaskId, 'normal', 'paused');

      const parentTask = createMockParentTask(parentTaskId, 'high', ['valid-subtask', 'missing-subtask']);

      mockStore.getTask
        .mockResolvedValueOnce(parentTask)
        .mockResolvedValueOnce(validSubtask)
        .mockResolvedValueOnce(null); // missing subtask

      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      await (daemonRunner as any).resumeParentSubtasksIfNeeded(parentTaskId);

      // Should resume the valid subtask
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('valid-subtask');
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledTimes(1);

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Resumed 1 subtask(s) for parent task parent-task')
      );
    });

    it('should handle subtask resume failures gracefully', async () => {
      const parentTaskId = 'parent-task';
      const subtask1 = createMockSubtask('subtask-success', parentTaskId, 'normal', 'paused');
      const subtask2 = createMockSubtask('subtask-fail', parentTaskId, 'normal', 'paused');

      const parentTask = createMockParentTask(parentTaskId, 'high', ['subtask-success', 'subtask-fail']);

      mockStore.getTask
        .mockResolvedValueOnce(parentTask)
        .mockResolvedValueOnce(subtask1)
        .mockResolvedValueOnce(subtask2);

      mockOrchestrator.resumePausedTask
        .mockResolvedValueOnce(true)  // first subtask succeeds
        .mockRejectedValueOnce(new Error('Resume failed')); // second subtask fails

      await (daemonRunner as any).resumeParentSubtasksIfNeeded(parentTaskId);

      // Should attempt to resume both
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('subtask-success');
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('subtask-fail');

      // Should log both success and failure
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Auto-resumed subtask subtask-success')
      );

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Error resuming subtask subtask-fail: Resume failed')
      );

      // Should still log final count (only successful ones)
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Resumed 1 subtask(s) for parent task parent-task')
      );
    });

    it('should handle store or orchestrator unavailable', async () => {
      // Test with store unavailable
      (daemonRunner as any).store = null;

      await (daemonRunner as any).resumeParentSubtasksIfNeeded('parent-task');

      expect(mockOrchestrator.resumePausedTask).not.toHaveBeenCalled();

      // Reset and test with orchestrator unavailable
      (daemonRunner as any).store = mockStore;
      (daemonRunner as any).orchestrator = null;

      await (daemonRunner as any).resumeParentSubtasksIfNeeded('parent-task');

      expect(mockStore.getTask).not.toHaveBeenCalled();
    });
  });

  describe('Integration: Priority-Based Resume with Subtask Cascading', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    it('should resume parent tasks first, then cascade to their subtasks', async () => {
      // Setup parent task with paused subtasks
      const parentTask = createMockParentTask('priority-parent', 'urgent', ['subtask-1', 'subtask-2']);
      const subtask1 = createMockSubtask('subtask-1', 'priority-parent', 'normal', 'paused');
      const subtask2 = createMockSubtask('subtask-2', 'priority-parent', 'normal', 'paused');

      // Setup regular task
      const regularTask = createMockSubtask('regular-task', undefined!, 'urgent', 'paused');
      regularTask.parentTaskId = undefined;
      regularTask.subtaskIds = [];

      // Mock store methods
      mockStore.findHighestPriorityParentTask.mockResolvedValue([parentTask]);
      mockStore.getPausedTasksForResume.mockResolvedValue([parentTask, regularTask]);

      // Mock parent task retrieval for subtask resumption
      mockStore.getTask
        .mockResolvedValueOnce(parentTask)  // for resumeParentSubtasksIfNeeded
        .mockResolvedValueOnce(subtask1)    // for subtask-1
        .mockResolvedValueOnce(subtask2);   // for subtask-2

      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      const mockEvent = createMockEvent('capacity_dropped');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Verify execution order
      const resumeCalls = mockOrchestrator.resumePausedTask.mock.calls;

      // Parent should be resumed first
      expect(resumeCalls[0][0]).toBe('priority-parent');

      // Subtasks should be resumed after parent
      expect(resumeCalls).toEqual(
        expect.arrayContaining([
          ['priority-parent'],
          ['subtask-1'],
          ['subtask-2'],
          ['regular-task']
        ])
      );

      // Should log parent resume followed by subtask cascade
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Auto-resumed parent task priority-parent')
      );

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Checking 2 subtask(s) for auto-resume after parent task priority-parent resumed')
      );
    });

    it('should handle mixed scenarios with multiple parent tasks and subtasks', async () => {
      // Multiple parent tasks with different priorities
      const urgentParent = createMockParentTask('urgent-parent', 'urgent', ['urgent-sub1', 'urgent-sub2']);
      const highParent = createMockParentTask('high-parent', 'high', ['high-sub1']);

      // Subtasks
      const urgentSub1 = createMockSubtask('urgent-sub1', 'urgent-parent', 'normal', 'paused');
      const urgentSub2 = createMockSubtask('urgent-sub2', 'urgent-parent', 'normal', 'in-progress'); // not paused
      const highSub1 = createMockSubtask('high-sub1', 'high-parent', 'normal', 'paused');

      // Regular tasks
      const urgentRegular = createMockSubtask('urgent-regular', undefined!, 'urgent', 'paused');
      urgentRegular.parentTaskId = undefined;
      urgentRegular.subtaskIds = [];

      mockStore.findHighestPriorityParentTask.mockResolvedValue([urgentParent, highParent]);
      mockStore.getPausedTasksForResume.mockResolvedValue([urgentParent, highParent, urgentRegular]);

      // Mock subtask retrievals
      mockStore.getTask
        .mockResolvedValueOnce(urgentParent)
        .mockResolvedValueOnce(urgentSub1)
        .mockResolvedValueOnce(urgentSub2)
        .mockResolvedValueOnce(highParent)
        .mockResolvedValueOnce(highSub1);

      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      const mockEvent = createMockEvent('budget_reset');

      await (daemonRunner as any).handleCapacityRestored(mockEvent);

      // Verify urgent parent is resumed before high parent
      const resumeCalls = mockOrchestrator.resumePausedTask.mock.calls.map(call => call[0]);
      const urgentParentIndex = resumeCalls.indexOf('urgent-parent');
      const highParentIndex = resumeCalls.indexOf('high-parent');

      expect(urgentParentIndex).toBeLessThan(highParentIndex);

      // Verify subtasks are resumed appropriately
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('urgent-sub1'); // paused
      expect(mockOrchestrator.resumePausedTask).not.toHaveBeenCalledWith('urgent-sub2'); // not paused
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('high-sub1'); // paused

      // Verify regular task is resumed in phase 2
      expect(mockOrchestrator.resumePausedTask).toHaveBeenCalledWith('urgent-regular');

      // Verify logging for each phase
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Found 2 paused parent task(s) for resume')
      );

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 remaining paused task(s) for resume')
      );
    });
  });
});