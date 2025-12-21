import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { createWriteStream } from 'fs';
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

describe('DaemonRunner Enhanced Resume Events - Edge Cases', () => {
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

  // Sample task data helper
  const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'test-task-123',
    description: 'Test task for edge case testing',
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

  describe('Context Summary Generation Edge Cases', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    afterEach(async () => {
      await daemonRunner.stop();
    });

    it('should handle tasks with null or undefined sessionData', () => {
      const resumedTasks = [
        {
          task: createMockTask({ id: 'task-null', description: 'Task with null sessionData' }),
          sessionData: null as any
        },
        {
          task: createMockTask({ id: 'task-undefined', description: 'Task with undefined sessionData' })
          // sessionData intentionally omitted
        }
      ];

      const result = (daemonRunner as any).generateAggregatedContextSummary(
        resumedTasks,
        [],
        'capacity_dropped'
      );

      expect(result).toContain('Successfully resumed 2 task(s)');
      expect(result).toContain('task-null');
      expect(result).toContain('task-undefined');
      // Should not crash and should handle missing context gracefully
      expect(result).not.toContain('Context:');
    });

    it('should handle tasks with malformed session data', () => {
      const resumedTasks = [
        {
          task: createMockTask({ id: 'task-malformed' }),
          sessionData: {
            // Missing required fields
            contextSummary: '',
            // Invalid conversation history
            conversationHistory: 'not-an-array' as any
          } as TaskSessionData
        }
      ];

      expect(() => {
        (daemonRunner as any).generateAggregatedContextSummary(
          resumedTasks,
          [],
          'budget_reset'
        );
      }).not.toThrow();
    });

    it('should handle extremely long task descriptions and context summaries', () => {
      const veryLongDescription = 'A'.repeat(500);
      const veryLongContext = 'B'.repeat(1000);

      const resumedTasks = [
        {
          task: createMockTask({
            description: veryLongDescription
          }),
          sessionData: {
            lastCheckpoint: new Date(),
            contextSummary: veryLongContext
          }
        }
      ];

      const result = (daemonRunner as any).generateAggregatedContextSummary(
        resumedTasks,
        [],
        'mode_switch'
      );

      // Should truncate appropriately
      expect(result.includes(veryLongDescription)).toBe(false);
      expect(result.includes(veryLongContext)).toBe(false);
      expect(result).toContain('...');
    });

    it('should handle empty strings and whitespace-only content', () => {
      const resumedTasks = [
        {
          task: createMockTask({
            description: '   ',
            currentStage: ''
          }),
          sessionData: {
            lastCheckpoint: new Date(),
            contextSummary: '\n\t  \n'
          }
        }
      ];

      const result = (daemonRunner as any).generateAggregatedContextSummary(
        resumedTasks,
        [],
        'capacity_dropped'
      );

      // Should handle gracefully without including empty content
      expect(result).toContain('Successfully resumed 1 task(s)');
    });

    it('should handle tasks with special characters and unicode', () => {
      const resumedTasks = [
        {
          task: createMockTask({
            description: '🚀 Task with émojis and spëcial characters (ñ)',
            workflow: 'test-workflow-ßéñø®'
          }),
          sessionData: {
            lastCheckpoint: new Date(),
            contextSummary: 'Context with 中文 and العربية text'
          }
        }
      ];

      const result = (daemonRunner as any).generateAggregatedContextSummary(
        resumedTasks,
        [],
        'manual_override'
      );

      expect(result).toContain('🚀 Task with émojis');
      expect(result).toContain('Context with 中文');
    });
  });

  describe('Error Handling in Enhanced Resume Events', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    afterEach(async () => {
      await daemonRunner.stop();
    });

    it('should handle store errors during capacity restoration gracefully', async () => {
      mockStore.findHighestPriorityParentTask.mockRejectedValue(new Error('Database connection lost'));
      mockStore.getPausedTasksForResume.mockResolvedValue([]);

      let emittedAutoResumeEvent: TasksAutoResumedEvent | null = null;
      mockOrchestrator.emit.mockImplementation((eventName: string, event: any) => {
        if (eventName === 'tasks:auto-resumed') {
          emittedAutoResumeEvent = event;
        }
      });

      const capacityEvent: CapacityRestoredEvent = {
        reason: 'capacity_dropped',
        timestamp: new Date()
      };

      await (daemonRunner as any).handleCapacityRestored(capacityEvent);

      // Should log error but not crash
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Auto-resume process failed: Database connection lost')
      );
      expect(emittedAutoResumeEvent).toBeNull();
    });

    it('should handle orchestrator.emit failures gracefully', async () => {
      const task = createMockTask();
      task.sessionData = { lastCheckpoint: new Date() };

      mockStore.findHighestPriorityParentTask.mockResolvedValue([]);
      mockStore.getPausedTasksForResume.mockResolvedValue([task]);
      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      // Make emit throw an error
      mockOrchestrator.emit.mockImplementation((eventName: string) => {
        if (eventName === 'tasks:auto-resumed') {
          throw new Error('Event emission failed');
        }
      });

      const capacityEvent: CapacityRestoredEvent = {
        reason: 'budget_reset',
        timestamp: new Date()
      };

      // Should not throw despite emit failure
      await expect(
        (daemonRunner as any).handleCapacityRestored(capacityEvent)
      ).resolves.not.toThrow();
    });

    it('should handle partially corrupted task data during resume', async () => {
      const corruptedTask = {
        id: 'corrupted-task',
        // Missing required fields
        status: 'paused',
        pauseReason: 'usage_limit'
      } as any;

      mockStore.findHighestPriorityParentTask.mockResolvedValue([]);
      mockStore.getPausedTasksForResume.mockResolvedValue([corruptedTask]);
      mockOrchestrator.resumePausedTask.mockRejectedValue(new Error('Invalid task data'));

      let emittedAutoResumeEvent: TasksAutoResumedEvent | null = null;
      mockOrchestrator.emit.mockImplementation((eventName: string, event: any) => {
        if (eventName === 'tasks:auto-resumed') {
          emittedAutoResumeEvent = event;
        }
      });

      const capacityEvent: CapacityRestoredEvent = {
        reason: 'capacity_dropped',
        timestamp: new Date()
      };

      await (daemonRunner as any).handleCapacityRestored(capacityEvent);

      expect(emittedAutoResumeEvent).not.toBeNull();
      expect(emittedAutoResumeEvent!.resumedCount).toBe(0);
      expect(emittedAutoResumeEvent!.errors).toHaveLength(1);
      expect(emittedAutoResumeEvent!.errors[0].taskId).toBe('corrupted-task');
    });

    it('should handle createContextSummary throwing multiple different errors', () => {
      const errors = [
        new Error('Memory allocation failed'),
        new TypeError('Cannot read property of undefined'),
        new RangeError('Maximum call stack size exceeded'),
        'String error',
        null,
        undefined
      ];

      errors.forEach((error, index) => {
        vi.clearAllMocks();

        (createContextSummary as MockedFunction<typeof createContextSummary>)
          .mockImplementation(() => {
            if (error === null || error === undefined) {
              throw error;
            }
            throw error;
          });

        const task = createMockTask({
          id: `test-task-${index}`,
          currentStage: 'testing',
          pauseReason: 'capacity'
        });
        const sessionData = {
          lastCheckpoint: new Date(),
          conversationHistory: [] as AgentMessage[]
        };

        expect(() => {
          (daemonRunner as any).emitTaskSessionResumed(task, 'Test resume', sessionData);
        }).not.toThrow();

        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining(`Failed to create context summary for task test-task-${index}`)
        );
      });
    });

    it('should handle missing orchestrator during event emission', () => {
      (daemonRunner as any).orchestrator = null;

      const task = createMockTask();
      const resumeReason = 'Test without orchestrator';

      // Should return early without throwing
      expect(() => {
        (daemonRunner as any).emitTaskSessionResumed(task, resumeReason, undefined);
      }).not.toThrow();
    });

    it('should handle missing store during capacity restoration', async () => {
      (daemonRunner as any).store = null;

      const capacityEvent: CapacityRestoredEvent = {
        reason: 'capacity_dropped',
        timestamp: new Date()
      };

      // Should return early without throwing
      await expect(
        (daemonRunner as any).handleCapacityRestored(capacityEvent)
      ).resolves.not.toThrow();
    });
  });

  describe('Performance and Memory Edge Cases', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    afterEach(async () => {
      await daemonRunner.stop();
    });

    it('should handle large numbers of resumed tasks efficiently', () => {
      const largeTaskList = Array.from({ length: 1000 }, (_, i) => ({
        task: createMockTask({
          id: `task-${i}`,
          description: `Task ${i} with moderate description length for testing`
        }),
        sessionData: {
          lastCheckpoint: new Date(),
          contextSummary: `Context summary for task ${i} with relevant information`
        }
      }));

      const startTime = Date.now();

      const result = (daemonRunner as any).generateAggregatedContextSummary(
        largeTaskList,
        [],
        'capacity_dropped'
      );

      const endTime = Date.now();

      // Should complete within reasonable time (less than 1 second for 1000 tasks)
      expect(endTime - startTime).toBeLessThan(1000);

      // Should include proper truncation
      expect(result).toContain('Successfully resumed 1000 task(s)');

      // Should not be excessively long
      expect(result.length).toBeLessThan(50000); // Reasonable upper bound
    });

    it('should handle circular references in session data gracefully', () => {
      const circularData: any = {
        lastCheckpoint: new Date(),
        contextSummary: 'Circular reference test'
      };
      // Create circular reference
      circularData.self = circularData;

      const resumedTasks = [
        {
          task: createMockTask({ id: 'circular-task' }),
          sessionData: circularData
        }
      ];

      expect(() => {
        (daemonRunner as any).generateAggregatedContextSummary(
          resumedTasks,
          [],
          'capacity_dropped'
        );
      }).not.toThrow();
    });

    it('should handle memory-intensive context summaries', () => {
      const massiveContextSummary = 'A'.repeat(1024 * 1024); // 1MB string

      const resumedTasks = [
        {
          task: createMockTask({ id: 'massive-context-task' }),
          sessionData: {
            lastCheckpoint: new Date(),
            contextSummary: massiveContextSummary
          }
        }
      ];

      const result = (daemonRunner as any).generateAggregatedContextSummary(
        resumedTasks,
        [],
        'budget_reset'
      );

      // Should truncate appropriately and not include the full massive string
      expect(result.includes(massiveContextSummary)).toBe(false);
      expect(result.length).toBeLessThan(10000);
    });
  });

  describe('Concurrent Operation Edge Cases', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    afterEach(async () => {
      await daemonRunner.stop();
    });

    it('should handle concurrent capacity restoration events', async () => {
      const task1 = createMockTask({ id: 'concurrent-task-1' });
      const task2 = createMockTask({ id: 'concurrent-task-2' });

      task1.sessionData = { lastCheckpoint: new Date() };
      task2.sessionData = { lastCheckpoint: new Date() };

      mockStore.findHighestPriorityParentTask.mockResolvedValue([]);
      mockStore.getPausedTasksForResume.mockResolvedValue([task1, task2]);
      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      let emittedEvents = 0;
      mockOrchestrator.emit.mockImplementation((eventName: string) => {
        if (eventName === 'tasks:auto-resumed') {
          emittedEvents++;
        }
      });

      const capacityEvent1: CapacityRestoredEvent = {
        reason: 'capacity_dropped',
        timestamp: new Date()
      };

      const capacityEvent2: CapacityRestoredEvent = {
        reason: 'budget_reset',
        timestamp: new Date()
      };

      // Fire both events concurrently
      await Promise.all([
        (daemonRunner as any).handleCapacityRestored(capacityEvent1),
        (daemonRunner as any).handleCapacityRestored(capacityEvent2)
      ]);

      // Both should complete successfully
      expect(emittedEvents).toBe(2);
    });

    it('should handle rapid succession of task session resume events', () => {
      const tasks = Array.from({ length: 100 }, (_, i) => createMockTask({ id: `rapid-task-${i}` }));

      let emittedEvents = 0;
      mockOrchestrator.emit.mockImplementation((eventName: string) => {
        if (eventName === 'task:session-resumed') {
          emittedEvents++;
        }
      });

      // Emit all events rapidly
      tasks.forEach((task, i) => {
        (daemonRunner as any).emitTaskSessionResumed(task, `Rapid resume ${i}`, undefined);
      });

      expect(emittedEvents).toBe(100);
    });
  });

  describe('Data Integrity Edge Cases', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    afterEach(async () => {
      await daemonRunner.stop();
    });

    it('should preserve event timestamp accuracy during high-frequency operations', async () => {
      const task = createMockTask();
      task.sessionData = { lastCheckpoint: new Date() };

      mockStore.findHighestPriorityParentTask.mockResolvedValue([]);
      mockStore.getPausedTasksForResume.mockResolvedValue([task]);
      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      let capturedTimestamp: Date;
      mockOrchestrator.emit.mockImplementation((eventName: string, event: any) => {
        if (eventName === 'tasks:auto-resumed') {
          capturedTimestamp = event.timestamp;
        }
      });

      const beforeTime = new Date();

      await (daemonRunner as any).handleCapacityRestored({
        reason: 'capacity_dropped',
        timestamp: new Date()
      });

      const afterTime = new Date();

      expect(capturedTimestamp!).toBeInstanceOf(Date);
      expect(capturedTimestamp!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(capturedTimestamp!.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should maintain event ordering during complex resume scenarios', async () => {
      const parentTask = createMockTask({
        id: 'parent-task',
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

      parentTask.sessionData = { lastCheckpoint: new Date() };
      subtask1.sessionData = { lastCheckpoint: new Date() };
      subtask2.sessionData = { lastCheckpoint: new Date() };

      mockStore.findHighestPriorityParentTask.mockResolvedValue([parentTask]);
      mockStore.getPausedTasksForResume.mockResolvedValue([parentTask, subtask1, subtask2]);
      mockStore.getTask
        .mockResolvedValueOnce(parentTask)
        .mockResolvedValueOnce(subtask1)
        .mockResolvedValueOnce(subtask2);
      mockOrchestrator.resumePausedTask.mockResolvedValue(true);

      const eventOrder: string[] = [];
      mockOrchestrator.emit.mockImplementation((eventName: string, event: any) => {
        if (eventName === 'task:session-resumed') {
          eventOrder.push(event.taskId);
        } else if (eventName === 'tasks:auto-resumed') {
          eventOrder.push('auto-resumed-event');
        }
      });

      await (daemonRunner as any).handleCapacityRestored({
        reason: 'capacity_dropped',
        timestamp: new Date()
      });

      // Should emit individual events before the aggregate event
      // Parent task first, then subtasks, then aggregate
      expect(eventOrder).toContain('parent-task');
      expect(eventOrder).toContain('subtask-1');
      expect(eventOrder).toContain('subtask-2');
      expect(eventOrder).toContain('auto-resumed-event');

      // Aggregate event should be last
      expect(eventOrder[eventOrder.length - 1]).toBe('auto-resumed-event');
    });
  });
});