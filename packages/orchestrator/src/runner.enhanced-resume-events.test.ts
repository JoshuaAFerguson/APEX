import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { DaemonRunner, type DaemonRunnerOptions } from './runner';
import { ApexOrchestrator, TaskSessionResumedEvent, TasksAutoResumedEvent } from './index';
import { TaskStore } from './store';
import { CapacityRestoredEvent } from './capacity-monitor';
import { Task, TaskSessionData, AgentMessage } from '@apexcli/core';
import { createContextSummary } from './context';

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

vi.mock('@apexcli/core', () => ({
  loadConfig: vi.fn(),
  getEffectiveConfig: vi.fn(),
}));

vi.mock('./usage-manager', () => ({
  UsageManager: vi.fn(),
}));

vi.mock('./daemon-scheduler', () => ({
  DaemonScheduler: vi.fn(),
  UsageManagerProvider: vi.fn(),
}));

vi.mock('./capacity-monitor', () => ({
  CapacityMonitor: vi.fn(),
}));

vi.mock('./capacity-monitor-usage-adapter', () => ({
  CapacityMonitorUsageAdapter: vi.fn(),
}));

vi.mock('./context', () => ({
  createContextSummary: vi.fn(),
}));

describe('DaemonRunner Enhanced Resume Events', () => {
  const testProjectPath = '/test/project';
  let daemonRunner: DaemonRunner;
  let options: DaemonRunnerOptions;

  // Mock objects
  const mockStream = {
    write: vi.fn(),
    end: vi.fn((callback?: () => void) => callback?.()),
    destroyed: false,
  };

  const mockOrchestrator = {
    initialize: vi.fn(),
    executeTask: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
    resumePausedTask: vi.fn(),
  };

  const mockStore = {
    initialize: vi.fn(),
    close: vi.fn(),
    getNextQueuedTask: vi.fn(),
    findHighestPriorityParentTask: vi.fn(),
    getPausedTasksForResume: vi.fn(),
    getTask: vi.fn(),
  };

  const mockUsageManager = {
    trackTaskStart: vi.fn(),
    trackTaskCompletion: vi.fn(),
  };

  const mockDaemonScheduler = {
    shouldPauseTasks: vi.fn(),
    getUsageStats: vi.fn(),
  };

  const mockCapacityMonitor = {
    start: vi.fn(),
    stop: vi.fn(),
    on: vi.fn(),
  };

  // Sample task data
  const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'test-task-123',
    description: 'Test task for enhanced resume functionality',
    status: 'paused' as const,
    workflow: 'test-workflow',
    autonomy: 'low' as const,
    projectPath: '/test/project',
    createdAt: new Date(),
    updatedAt: new Date(),
    currentStage: 'implementation',
    pauseReason: 'usage_limit',
    priority: 'medium' as const,
    ...overrides,
  });

  const createMockSessionData = (overrides: Partial<TaskSessionData> = {}): TaskSessionData => ({
    lastCheckpoint: new Date(),
    contextSummary: 'Previous task was implementing authentication middleware with JWT tokens',
    conversationHistory: [
      {
        type: 'user',
        content: [{ type: 'text', text: 'Implement JWT authentication' }]
      },
      {
        type: 'assistant',
        content: [{ type: 'text', text: 'I will implement JWT authentication using express-jwt middleware' }]
      }
    ] as AgentMessage[],
    stageState: { currentStep: 2, totalSteps: 5 },
    resumePoint: { stage: 'implementation', stepIndex: 1, metadata: { lastAction: 'created-middleware' } },
    ...overrides,
  });

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mocks
    (createWriteStream as MockedFunction<typeof createWriteStream>).mockReturnValue(mockStream as any);
    (ApexOrchestrator as any).mockImplementation(() => mockOrchestrator);
    (TaskStore as any).mockImplementation(() => mockStore);

    // Mock new dependencies
    const { UsageManager } = require('./usage-manager');
    const { DaemonScheduler, UsageManagerProvider } = require('./daemon-scheduler');
    const { CapacityMonitor } = require('./capacity-monitor');
    const { CapacityMonitorUsageAdapter } = require('./capacity-monitor-usage-adapter');

    UsageManager.mockImplementation(() => mockUsageManager);
    DaemonScheduler.mockImplementation(() => mockDaemonScheduler);
    UsageManagerProvider.mockImplementation(() => ({}));
    CapacityMonitor.mockImplementation(() => mockCapacityMonitor);
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
      },
      daemon: {},
    });

    // Mock createContextSummary
    (createContextSummary as MockedFunction<typeof createContextSummary>).mockReturnValue(
      'Generated context summary from conversation history'
    );

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

  describe('generateAggregatedContextSummary', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    afterEach(async () => {
      await daemonRunner.stop();
    });

    it('should generate comprehensive context summary with multiple resumed tasks', () => {
      const resumedTasks = [
        {
          task: createMockTask({
            id: 'task-1',
            description: 'Implement JWT authentication middleware',
            workflow: 'authentication',
            priority: 'high',
            currentStage: 'implementation'
          }),
          sessionData: createMockSessionData({
            contextSummary: 'Working on JWT token validation and middleware setup with express-jwt library'
          })
        },
        {
          task: createMockTask({
            id: 'task-2',
            description: 'Create user registration endpoint',
            workflow: 'authentication',
            priority: 'medium',
            currentStage: 'testing'
          }),
          sessionData: createMockSessionData({
            contextSummary: 'Implementing user registration with password hashing using bcrypt'
          })
        },
        {
          task: createMockTask({
            id: 'task-3',
            description: 'Setup database connection pooling',
            workflow: 'infrastructure',
            priority: 'low'
          })
        }
      ];

      const failedTasks = [
        { taskId: 'task-4', error: 'Database connection failed - timeout after 5000ms' }
      ];

      const result = (daemonRunner as any).generateAggregatedContextSummary(
        resumedTasks,
        failedTasks,
        'capacity_dropped'
      );

      expect(result).toContain('Auto-resume triggered by: capacity_dropped');
      expect(result).toContain('Successfully resumed 3 task(s)');
      expect(result).toContain('• task-1 (high), Implement JWT authentication middleware');
      expect(result).toContain('• task-2 (medium), Create user registration endpoint');
      expect(result).toContain('• task-3 (low), Setup database connection pooling');
      expect(result).toContain('Context: Working on JWT token validation');
      expect(result).toContain('Context: Implementing user registration with password');
      expect(result).toContain('Stage: implementation');
      expect(result).toContain('Stage: testing');
      expect(result).toContain('Failed to resume 1 task(s)');
      expect(result).toContain('• task-4: Database connection failed - timeout after 5000ms');
    });

    it('should handle tasks without session data gracefully', () => {
      const resumedTasks = [
        {
          task: createMockTask({
            id: 'task-1',
            description: 'Task without session data',
            currentStage: 'planning'
          })
        }
      ];

      const result = (daemonRunner as any).generateAggregatedContextSummary(
        resumedTasks,
        [],
        'budget_reset'
      );

      expect(result).toContain('Auto-resume triggered by: budget_reset');
      expect(result).toContain('Successfully resumed 1 task(s)');
      expect(result).toContain('Stage: planning');
      expect(result).not.toContain('Context:');
    });

    it('should truncate long descriptions and context summaries appropriately', () => {
      const longDescription = 'A'.repeat(80);
      const longContextSummary = 'B'.repeat(120);

      const resumedTasks = [
        {
          task: createMockTask({
            description: longDescription,
          }),
          sessionData: createMockSessionData({
            contextSummary: longContextSummary
          })
        }
      ];

      const result = (daemonRunner as any).generateAggregatedContextSummary(
        resumedTasks,
        [],
        'mode_switch'
      );

      // Description should be truncated at 60 chars
      expect(result).toContain(`${'A'.repeat(57)}...`);
      // Context should be truncated at 100 chars
      expect(result).toContain(`Context: ${'B'.repeat(97)}...`);
    });

    it('should handle empty resumed tasks list', () => {
      const result = (daemonRunner as any).generateAggregatedContextSummary(
        [],
        [],
        'manual_override'
      );

      expect(result).toContain('Auto-resume triggered by: manual_override');
      expect(result).toContain('No tasks were available for resumption');
    });

    it('should limit failed tasks display to 5 items', () => {
      const failedTasks = Array.from({ length: 7 }, (_, i) => ({
        taskId: `failed-task-${i}`,
        error: `Error ${i}: Something went wrong`
      }));

      const result = (daemonRunner as any).generateAggregatedContextSummary(
        [],
        failedTasks,
        'capacity_dropped'
      );

      expect(result).toContain('Failed to resume 7 task(s)');
      expect(result).toContain('failed-task-0: Error 0');
      expect(result).toContain('failed-task-4: Error 4');
      expect(result).toContain('(+2 more failures)');
      expect(result).not.toContain('failed-task-5');
    });
  });

  describe('generateDetailedResumeReason', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    afterEach(async () => {
      await daemonRunner.stop();
    });

    it('should generate detailed reason for mode_switch events', () => {
      const result = (daemonRunner as any).generateDetailedResumeReason('mode_switch');

      expect(result).toContain('Time-based mode switched from day to night mode');
      expect(result).toContain('increasing capacity thresholds');
    });

    it('should generate detailed reason for budget_reset events', () => {
      const result = (daemonRunner as any).generateDetailedResumeReason('budget_reset');

      expect(result).toContain('Daily budget was reset');
      expect(result).toContain('allowing new tasks to be processed');
    });

    it('should generate detailed reason for capacity_dropped events', () => {
      const result = (daemonRunner as any).generateDetailedResumeReason('capacity_dropped');

      expect(result).toContain('System usage dropped below capacity thresholds');
      expect(result).toContain('freeing up resources');
    });

    it('should generate detailed reason for manual_override events', () => {
      const result = (daemonRunner as any).generateDetailedResumeReason('manual_override');

      expect(result).toContain('Capacity limits were manually adjusted or disabled');
    });

    it('should generate detailed reason for usage_expired events', () => {
      const result = (daemonRunner as any).generateDetailedResumeReason('usage_expired');

      expect(result).toContain('Previous high-usage period expired');
      expect(result).toContain('restoring normal capacity');
    });

    it('should handle unknown reason gracefully', () => {
      const result = (daemonRunner as any).generateDetailedResumeReason('unknown_reason');

      expect(result).toContain('Capacity restored: unknown_reason');
    });
  });

  describe('emitTaskSessionResumed', () => {
    let emittedEvents: TaskSessionResumedEvent[];

    beforeEach(async () => {
      emittedEvents = [];
      mockOrchestrator.emit.mockImplementation((eventName: string, event: any) => {
        if (eventName === 'task:session-resumed') {
          emittedEvents.push(event);
        }
      });
      await daemonRunner.start();
    });

    afterEach(async () => {
      await daemonRunner.stop();
    });

    it('should emit task session resumed event with existing context summary', () => {
      const task = createMockTask();
      const sessionData = createMockSessionData({
        contextSummary: 'Existing context from previous session'
      });
      const resumeReason = 'Capacity threshold no longer exceeded, allowing task to continue';

      (daemonRunner as any).emitTaskSessionResumed(task, resumeReason, sessionData);

      expect(emittedEvents).toHaveLength(1);
      const event = emittedEvents[0];

      expect(event.taskId).toBe('test-task-123');
      expect(event.resumeReason).toBe(resumeReason);
      expect(event.contextSummary).toBe('Existing context from previous session');
      expect(event.previousStatus).toBe('paused');
      expect(event.sessionData).toEqual(sessionData);
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should generate context summary from conversation history when not present', () => {
      const task = createMockTask();
      const sessionData = createMockSessionData({
        contextSummary: undefined, // No existing context summary
      });
      const resumeReason = 'Parent task test-task-123 was resumed, allowing dependent subtasks to continue';

      (daemonRunner as any).emitTaskSessionResumed(task, resumeReason, sessionData);

      expect(createContextSummary).toHaveBeenCalledWith(sessionData.conversationHistory);
      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].contextSummary).toBe('Generated context summary from conversation history');
    });

    it('should create fallback context summary when no session data available', () => {
      const task = createMockTask({
        description: 'Complex task for testing fallback context generation',
        currentStage: 'implementation',
        pauseReason: 'usage_limit'
      });
      const resumeReason = 'Daily budget was reset, allowing new tasks to be processed';

      (daemonRunner as any).emitTaskSessionResumed(task, resumeReason, undefined);

      expect(emittedEvents).toHaveLength(1);
      const event = emittedEvents[0];

      expect(event.contextSummary).toContain('Complex task for testing fallback context generation');
      expect(event.contextSummary).toContain('resumed from usage_limit state');
      expect(event.contextSummary).toContain('Previous stage: implementation');
      expect(event.sessionData.lastCheckpoint).toBeInstanceOf(Date);
    });

    it('should handle tasks with long descriptions by truncating', () => {
      const longDescription = 'A'.repeat(150);
      const task = createMockTask({
        description: longDescription,
      });
      const resumeReason = 'Test resume';

      (daemonRunner as any).emitTaskSessionResumed(task, resumeReason, undefined);

      expect(emittedEvents).toHaveLength(1);
      const event = emittedEvents[0];

      // Should truncate at 100 characters and add ellipsis
      expect(event.contextSummary).toContain('A'.repeat(100) + '...');
      expect(event.contextSummary.length).toBeLessThan(longDescription.length + 50);
    });

    it('should handle createContextSummary throwing an error gracefully', () => {
      (createContextSummary as MockedFunction<typeof createContextSummary>)
        .mockImplementation(() => {
          throw new Error('Context generation failed');
        });

      const task = createMockTask({ currentStage: 'testing' });
      const sessionData = createMockSessionData({ contextSummary: undefined });
      const resumeReason = 'Test resume with error handling';

      (daemonRunner as any).emitTaskSessionResumed(task, resumeReason, sessionData);

      expect(emittedEvents).toHaveLength(1);
      const event = emittedEvents[0];

      expect(event.contextSummary).toContain('Task was paused in stage: testing');
      expect(event.contextSummary).toContain('resuming from checkpoint');
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create context summary for task test-task-123')
      );
    });

    it('should not emit event when orchestrator is not available', () => {
      (daemonRunner as any).orchestrator = null;

      const task = createMockTask();
      const resumeReason = 'Test without orchestrator';

      (daemonRunner as any).emitTaskSessionResumed(task, resumeReason, undefined);

      expect(emittedEvents).toHaveLength(0);
    });
  });

  describe('handleCapacityRestored integration', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    afterEach(async () => {
      await daemonRunner.stop();
    });

    it('should emit enhanced TasksAutoResumedEvent with contextSummary', async () => {
      const parentTask = createMockTask({
        id: 'parent-task-1',
        description: 'Parent task with subtasks',
        workflow: 'main-workflow'
      });

      const regularTask = createMockTask({
        id: 'regular-task-1',
        description: 'Regular paused task'
      });

      const sessionDataParent = createMockSessionData({
        contextSummary: 'Parent task was coordinating multiple subtasks'
      });

      parentTask.sessionData = sessionDataParent;
      regularTask.sessionData = createMockSessionData();

      mockStore.findHighestPriorityParentTask.mockResolvedValue([parentTask]);
      mockStore.getPausedTasksForResume.mockResolvedValue([parentTask, regularTask]);
      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      const capacityEvent: CapacityRestoredEvent = {
        reason: 'capacity_dropped',
        timestamp: new Date()
      };

      let emittedAutoResumeEvent: TasksAutoResumedEvent | null = null;
      mockOrchestrator.emit.mockImplementation((eventName: string, event: any) => {
        if (eventName === 'tasks:auto-resumed') {
          emittedAutoResumeEvent = event;
        }
      });

      await (daemonRunner as any).handleCapacityRestored(capacityEvent);

      // Verify enhanced auto-resumed event was emitted
      expect(emittedAutoResumeEvent).not.toBeNull();
      expect(emittedAutoResumeEvent!.reason).toBe('capacity_dropped');
      expect(emittedAutoResumeEvent!.totalTasks).toBe(2);
      expect(emittedAutoResumeEvent!.resumedCount).toBe(2);
      expect(emittedAutoResumeEvent!.resumeReason).toContain('System usage dropped below capacity thresholds');
      expect(emittedAutoResumeEvent!.contextSummary).toContain('Auto-resume triggered by: capacity_dropped');
      expect(emittedAutoResumeEvent!.contextSummary).toContain('Successfully resumed 2 task(s)');
    });

    it('should emit individual task session resumed events for each task', async () => {
      const task1 = createMockTask({ id: 'task-1', description: 'First task' });
      const task2 = createMockTask({ id: 'task-2', description: 'Second task' });

      task1.sessionData = createMockSessionData();
      task2.sessionData = createMockSessionData();

      mockStore.findHighestPriorityParentTask.mockResolvedValue([]);
      mockStore.getPausedTasksForResume.mockResolvedValue([task1, task2]);
      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      const sessionResumedEvents: TaskSessionResumedEvent[] = [];
      mockOrchestrator.emit.mockImplementation((eventName: string, event: any) => {
        if (eventName === 'task:session-resumed') {
          sessionResumedEvents.push(event);
        }
      });

      const capacityEvent: CapacityRestoredEvent = {
        reason: 'budget_reset',
        timestamp: new Date()
      };

      await (daemonRunner as any).handleCapacityRestored(capacityEvent);

      // Verify individual events for each resumed task
      expect(sessionResumedEvents).toHaveLength(2);

      const event1 = sessionResumedEvents.find(e => e.taskId === 'task-1');
      const event2 = sessionResumedEvents.find(e => e.taskId === 'task-2');

      expect(event1).toBeDefined();
      expect(event1!.resumeReason).toContain('Daily budget was reset');
      expect(event1!.contextSummary).toBeDefined();

      expect(event2).toBeDefined();
      expect(event2!.resumeReason).toContain('Daily budget was reset');
      expect(event2!.contextSummary).toBeDefined();
    });

    it('should handle mixed success and failure scenarios', async () => {
      const successTask = createMockTask({ id: 'success-task' });
      const failTask = createMockTask({ id: 'fail-task' });

      successTask.sessionData = createMockSessionData();
      failTask.sessionData = createMockSessionData();

      mockStore.findHighestPriorityParentTask.mockResolvedValue([]);
      mockStore.getPausedTasksForResume.mockResolvedValue([successTask, failTask]);
      mockOrchestrator.resumePausedTask
        .mockResolvedValueOnce(true)  // success-task succeeds
        .mockRejectedValueOnce(new Error('Resume failed')); // fail-task fails

      let emittedAutoResumeEvent: TasksAutoResumedEvent | null = null;
      mockOrchestrator.emit.mockImplementation((eventName: string, event: any) => {
        if (eventName === 'tasks:auto-resumed') {
          emittedAutoResumeEvent = event;
        }
      });

      const capacityEvent: CapacityRestoredEvent = {
        reason: 'mode_switch',
        timestamp: new Date()
      };

      await (daemonRunner as any).handleCapacityRestored(capacityEvent);

      expect(emittedAutoResumeEvent).not.toBeNull();
      expect(emittedAutoResumeEvent!.resumedCount).toBe(1);
      expect(emittedAutoResumeEvent!.errors).toHaveLength(1);
      expect(emittedAutoResumeEvent!.errors[0].taskId).toBe('fail-task');
      expect(emittedAutoResumeEvent!.errors[0].error).toBe('Resume failed');
      expect(emittedAutoResumeEvent!.contextSummary).toContain('Failed to resume 1 task(s)');
    });

    it('should handle scenario with no paused tasks', async () => {
      mockStore.findHighestPriorityParentTask.mockResolvedValue([]);
      mockStore.getPausedTasksForResume.mockResolvedValue([]);

      let emittedAutoResumeEvent: TasksAutoResumedEvent | null = null;
      mockOrchestrator.emit.mockImplementation((eventName: string, event: any) => {
        if (eventName === 'tasks:auto-resumed') {
          emittedAutoResumeEvent = event;
        }
      });

      const capacityEvent: CapacityRestoredEvent = {
        reason: 'manual_override',
        timestamp: new Date()
      };

      await (daemonRunner as any).handleCapacityRestored(capacityEvent);

      expect(emittedAutoResumeEvent).not.toBeNull();
      expect(emittedAutoResumeEvent!.totalTasks).toBe(0);
      expect(emittedAutoResumeEvent!.resumedCount).toBe(0);
      expect(emittedAutoResumeEvent!.contextSummary).toContain('No tasks were available for resumption');
    });

    it('should not process when daemon is shutting down', async () => {
      (daemonRunner as any).isShuttingDown = true;

      const capacityEvent: CapacityRestoredEvent = {
        reason: 'capacity_dropped',
        timestamp: new Date()
      };

      await (daemonRunner as any).handleCapacityRestored(capacityEvent);

      expect(mockStore.findHighestPriorityParentTask).not.toHaveBeenCalled();
      expect(mockStore.getPausedTasksForResume).not.toHaveBeenCalled();
      expect(mockOrchestrator.emit).not.toHaveBeenCalled();
    });
  });

  describe('resumeParentSubtasksIfNeeded with enhanced events', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    afterEach(async () => {
      await daemonRunner.stop();
    });

    it('should emit task session resumed events for resumed subtasks', async () => {
      const parentTaskId = 'parent-123';
      const parentTask = createMockTask({
        id: parentTaskId,
        subtaskIds: ['subtask-1', 'subtask-2']
      });

      const subtask1 = createMockTask({
        id: 'subtask-1',
        status: 'paused',
        pauseReason: 'usage_limit'
      });

      const subtask2 = createMockTask({
        id: 'subtask-2',
        status: 'paused',
        pauseReason: 'capacity'
      });

      subtask1.sessionData = createMockSessionData({
        contextSummary: 'Subtask 1 was processing authentication logic'
      });

      subtask2.sessionData = createMockSessionData({
        contextSummary: 'Subtask 2 was handling database operations'
      });

      mockStore.getTask
        .mockResolvedValueOnce(parentTask) // First call for parent
        .mockResolvedValueOnce(subtask1)   // Second call for subtask-1
        .mockResolvedValueOnce(subtask2);  // Third call for subtask-2

      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      const sessionResumedEvents: TaskSessionResumedEvent[] = [];
      mockOrchestrator.emit.mockImplementation((eventName: string, event: any) => {
        if (eventName === 'task:session-resumed') {
          sessionResumedEvents.push(event);
        }
      });

      await (daemonRunner as any).resumeParentSubtasksIfNeeded(parentTaskId);

      expect(sessionResumedEvents).toHaveLength(2);

      const subtask1Event = sessionResumedEvents.find(e => e.taskId === 'subtask-1');
      const subtask2Event = sessionResumedEvents.find(e => e.taskId === 'subtask-2');

      expect(subtask1Event).toBeDefined();
      expect(subtask1Event!.resumeReason).toContain(`Parent task ${parentTaskId} was resumed`);
      expect(subtask1Event!.contextSummary).toBe('Subtask 1 was processing authentication logic');

      expect(subtask2Event).toBeDefined();
      expect(subtask2Event!.resumeReason).toContain(`Parent task ${parentTaskId} was resumed`);
      expect(subtask2Event!.contextSummary).toBe('Subtask 2 was handling database operations');
    });

    it('should not resume subtasks with non-resumable pause reasons', async () => {
      const parentTaskId = 'parent-123';
      const parentTask = createMockTask({
        id: parentTaskId,
        subtaskIds: ['subtask-1', 'subtask-2']
      });

      const subtask1 = createMockTask({
        id: 'subtask-1',
        status: 'paused',
        pauseReason: 'user_request' // Non-resumable reason
      });

      const subtask2 = createMockTask({
        id: 'subtask-2',
        status: 'completed' // Not paused
      });

      mockStore.getTask
        .mockResolvedValueOnce(parentTask)
        .mockResolvedValueOnce(subtask1)
        .mockResolvedValueOnce(subtask2);

      const sessionResumedEvents: TaskSessionResumedEvent[] = [];
      mockOrchestrator.emit.mockImplementation((eventName: string, event: any) => {
        if (eventName === 'task:session-resumed') {
          sessionResumedEvents.push(event);
        }
      });

      await (daemonRunner as any).resumeParentSubtasksIfNeeded(parentTaskId);

      expect(mockOrchestrator.resumePausedTask).not.toHaveBeenCalled();
      expect(sessionResumedEvents).toHaveLength(0);
    });
  });
});