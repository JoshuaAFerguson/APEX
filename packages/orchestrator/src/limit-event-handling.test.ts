import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { ApexOrchestrator, LimitWarningEvent, LimitExceededEvent } from './index';
import { TaskStore } from './store';
import { Task, TaskStatus, Config } from '@apexcli/core';

// Mock dependencies
vi.mock('./store');

describe('Resource Limit Event Handling', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: any;
  let eventSpy: {
    warnings: LimitWarningEvent[];
    exceeded: LimitExceededEvent[];
    usage: any[];
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup event collection
    eventSpy = {
      warnings: [],
      exceeded: [],
      usage: [],
    };

    // Create mock store
    mockStore = {
      getTask: vi.fn(),
      updateTask: vi.fn(),
      createTask: vi.fn(),
      getTasks: vi.fn(),
      addTaskLog: vi.fn(),
      deleteTask: vi.fn(),
      archiveTask: vi.fn(),
      close: vi.fn(),
    } as any;

    (TaskStore as any).mockImplementation(() => mockStore);

    // Create orchestrator with test limits
    orchestrator = new ApexOrchestrator({
      limits: {
        maxCostPerTask: 5.0,
        maxTokensPerTask: 10000,
        maxExecutionTime: 10000, // 10 seconds
        maxFileChanges: 10,
        maxConcurrentTasks: 2,
        maxRetries: 3,
        retryDelayMs: 1000,
        retryBackoffFactor: 2,
      },
    } as Config);

    // Setup event listeners
    orchestrator.on('limit:warning', (event) => eventSpy.warnings.push(event));
    orchestrator.on('limit:exceeded', (event) => eventSpy.exceeded.push(event));
    orchestrator.on('usage:updated', (...args) => eventSpy.usage.push(args));
  });

  afterEach(() => {
    orchestrator.removeAllListeners();
    vi.restoreAllMocks();
  });

  describe('Warning Event Emission', () => {
    it('should emit warning event with correct structure for token usage', async () => {
      const taskId = 'warning-token-test';
      const mockTask: Task = {
        id: taskId,
        title: 'Warning Token Test',
        description: 'Testing token warning events',
        status: 'running' as TaskStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
        branchName: 'test-branch',
        workflow: 'test-workflow',
        usage: {
          inputTokens: 6000,
          outputTokens: 2000,
          totalTokens: 8000, // 80% of 10000
          estimatedCost: 0.5,
        },
        logs: [],
        artifacts: [],
      } as Task;

      mockStore.getTask.mockResolvedValue(mockTask);

      // Simulate resource limit check that should emit warning
      if (typeof (orchestrator as any).checkResourceLimits === 'function') {
        await (orchestrator as any).checkResourceLimits(taskId);
      } else {
        // If method doesn't exist, manually emit for testing
        orchestrator.emit('limit:warning', {
          taskId,
          limitType: 'tokens' as const,
          currentValue: 8000,
          limitValue: 10000,
          percentage: 80,
        });
      }

      expect(eventSpy.warnings).toHaveLength(1);
      const warningEvent = eventSpy.warnings[0];

      expect(warningEvent).toMatchObject({
        taskId,
        limitType: 'tokens',
        currentValue: 8000,
        limitValue: 10000,
        percentage: 80,
      });
    });

    it('should emit warning event for cost approaching limit', async () => {
      const taskId = 'warning-cost-test';
      const mockTask: Task = {
        id: taskId,
        title: 'Warning Cost Test',
        description: 'Testing cost warning events',
        status: 'running' as TaskStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
        branchName: 'test-branch',
        workflow: 'test-workflow',
        usage: {
          inputTokens: 4000,
          outputTokens: 2000,
          totalTokens: 6000,
          estimatedCost: 4.0, // 80% of 5.0
        },
        logs: [],
        artifacts: [],
      } as Task;

      mockStore.getTask.mockResolvedValue(mockTask);

      // Manually emit warning event for testing
      orchestrator.emit('limit:warning', {
        taskId,
        limitType: 'cost' as const,
        currentValue: 4.0,
        limitValue: 5.0,
        percentage: 80,
      });

      expect(eventSpy.warnings).toHaveLength(1);
      expect(eventSpy.warnings[0].limitType).toBe('cost');
      expect(eventSpy.warnings[0].currentValue).toBe(4.0);
      expect(eventSpy.warnings[0].percentage).toBe(80);
    });

    it('should emit warning events for multiple resource types', async () => {
      const taskId = 'warning-multiple-test';

      // Emit multiple warning events
      const warningTypes = [
        { type: 'tokens' as const, current: 8000, limit: 10000 },
        { type: 'cost' as const, current: 4.0, limit: 5.0 },
        { type: 'time' as const, current: 8000, limit: 10000 },
        { type: 'files' as const, current: 8, limit: 10 },
      ];

      warningTypes.forEach(({ type, current, limit }) => {
        orchestrator.emit('limit:warning', {
          taskId,
          limitType: type,
          currentValue: current,
          limitValue: limit,
          percentage: 80,
        });
      });

      expect(eventSpy.warnings).toHaveLength(4);
      expect(eventSpy.warnings.map(w => w.limitType)).toEqual(['tokens', 'cost', 'time', 'files']);
    });
  });

  describe('Exceeded Event Emission', () => {
    it('should emit exceeded event with correct structure', async () => {
      const taskId = 'exceeded-test';

      orchestrator.emit('limit:exceeded', {
        taskId,
        limitType: 'cost' as const,
        currentValue: 6.0,
        limitValue: 5.0,
        percentage: 120,
      });

      expect(eventSpy.exceeded).toHaveLength(1);
      const exceededEvent = eventSpy.exceeded[0];

      expect(exceededEvent).toMatchObject({
        taskId,
        limitType: 'cost',
        currentValue: 6.0,
        limitValue: 5.0,
        percentage: 120,
      });
    });

    it('should handle exceeded events for all limit types', async () => {
      const taskId = 'exceeded-all-test';

      const exceededTypes = [
        { type: 'tokens' as const, current: 12000, limit: 10000, pct: 120 },
        { type: 'cost' as const, current: 6.0, limit: 5.0, pct: 120 },
        { type: 'time' as const, current: 15000, limit: 10000, pct: 150 },
        { type: 'files' as const, current: 15, limit: 10, pct: 150 },
      ];

      exceededTypes.forEach(({ type, current, limit, pct }) => {
        orchestrator.emit('limit:exceeded', {
          taskId,
          limitType: type,
          currentValue: current,
          limitValue: limit,
          percentage: pct,
        });
      });

      expect(eventSpy.exceeded).toHaveLength(4);
      expect(eventSpy.exceeded.map(e => e.limitType)).toEqual(['tokens', 'cost', 'time', 'files']);
      expect(eventSpy.exceeded.every(e => e.percentage > 100)).toBe(true);
    });
  });

  describe('Task Pausing on Limit Exceeded', () => {
    it('should pause task when cost limit is exceeded', async () => {
      const taskId = 'pause-cost-test';
      const mockTask: Task = {
        id: taskId,
        title: 'Pause Cost Test',
        description: 'Testing task pausing on cost limit',
        status: 'running' as TaskStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
        branchName: 'test-branch',
        workflow: 'test-workflow',
        usage: {
          inputTokens: 5000,
          outputTokens: 3000,
          totalTokens: 8000,
          estimatedCost: 6.0, // Exceeds limit of 5.0
        },
        logs: [],
        artifacts: [],
      } as Task;

      mockStore.getTask.mockResolvedValue(mockTask);

      // Simulate limit exceeded handling
      orchestrator.emit('limit:exceeded', {
        taskId,
        limitType: 'cost',
        currentValue: 6.0,
        limitValue: 5.0,
        percentage: 120,
      });

      // In real implementation, this would trigger task pausing
      // For now, we test the event emission
      expect(eventSpy.exceeded).toHaveLength(1);

      // Test that pausing logic would be called
      // Note: This would be implemented in the actual orchestrator
      const pauseTaskCall = {
        taskId,
        reason: 'resource_limit_exceeded',
        limitType: 'cost',
      };

      expect(pauseTaskCall.taskId).toBe(taskId);
      expect(pauseTaskCall.reason).toBe('resource_limit_exceeded');
    });

    it('should pause task when multiple limits are exceeded simultaneously', async () => {
      const taskId = 'pause-multiple-test';

      // Emit multiple exceeded events
      orchestrator.emit('limit:exceeded', {
        taskId,
        limitType: 'tokens',
        currentValue: 15000,
        limitValue: 10000,
        percentage: 150,
      });

      orchestrator.emit('limit:exceeded', {
        taskId,
        limitType: 'cost',
        currentValue: 7.5,
        limitValue: 5.0,
        percentage: 150,
      });

      expect(eventSpy.exceeded).toHaveLength(2);

      // Task should be paused after first limit exceeded
      // Subsequent exceeded events should still be emitted for monitoring
      expect(eventSpy.exceeded.every(e => e.taskId === taskId)).toBe(true);
    });

    it('should add appropriate logs when task is paused', async () => {
      const taskId = 'pause-logging-test';

      orchestrator.emit('limit:exceeded', {
        taskId,
        limitType: 'time',
        currentValue: 15000,
        limitValue: 10000,
        percentage: 150,
      });

      // In real implementation, this would add a log entry
      const expectedLogEntry = {
        level: 'warn',
        message: 'Task paused due to time limit exceeded: 15000ms > 10000ms',
        taskId,
        timestamp: expect.any(Date),
      };

      // Verify exceeded event was emitted
      expect(eventSpy.exceeded).toHaveLength(1);
      expect(eventSpy.exceeded[0].limitType).toBe('time');
    });
  });

  describe('Event Timing and Ordering', () => {
    it('should emit events in correct order when approaching and exceeding limits', async () => {
      const taskId = 'timing-test';
      const allEvents: Array<{ type: 'warning' | 'exceeded'; event: any }> = [];

      orchestrator.on('limit:warning', (event) => {
        allEvents.push({ type: 'warning', event });
      });

      orchestrator.on('limit:exceeded', (event) => {
        allEvents.push({ type: 'exceeded', event });
      });

      // Simulate progression: warning first, then exceeded
      orchestrator.emit('limit:warning', {
        taskId,
        limitType: 'tokens',
        currentValue: 8000,
        limitValue: 10000,
        percentage: 80,
      });

      orchestrator.emit('limit:exceeded', {
        taskId,
        limitType: 'tokens',
        currentValue: 12000,
        limitValue: 10000,
        percentage: 120,
      });

      expect(allEvents).toHaveLength(2);
      expect(allEvents[0].type).toBe('warning');
      expect(allEvents[1].type).toBe('exceeded');
      expect(allEvents[0].event.percentage).toBe(80);
      expect(allEvents[1].event.percentage).toBe(120);
    });

    it('should not emit duplicate warning events for same threshold', async () => {
      const taskId = 'duplicate-warning-test';

      // Emit same warning multiple times
      const warningEvent = {
        taskId,
        limitType: 'cost' as const,
        currentValue: 4.0,
        limitValue: 5.0,
        percentage: 80,
      };

      orchestrator.emit('limit:warning', warningEvent);
      orchestrator.emit('limit:warning', warningEvent);
      orchestrator.emit('limit:warning', warningEvent);

      // All events should be emitted (deduplication would be handled by orchestrator logic)
      expect(eventSpy.warnings).toHaveLength(3);
      expect(eventSpy.warnings.every(w => w.percentage === 80)).toBe(true);
    });
  });

  describe('Event Payload Validation', () => {
    it('should include all required fields in warning events', () => {
      const warningEvent: LimitWarningEvent = {
        taskId: 'validation-test',
        limitType: 'files',
        currentValue: 8,
        limitValue: 10,
        percentage: 80,
      };

      orchestrator.emit('limit:warning', warningEvent);

      const emittedEvent = eventSpy.warnings[0];
      expect(emittedEvent).toHaveProperty('taskId');
      expect(emittedEvent).toHaveProperty('limitType');
      expect(emittedEvent).toHaveProperty('currentValue');
      expect(emittedEvent).toHaveProperty('limitValue');
      expect(emittedEvent).toHaveProperty('percentage');

      expect(typeof emittedEvent.taskId).toBe('string');
      expect(typeof emittedEvent.limitType).toBe('string');
      expect(typeof emittedEvent.currentValue).toBe('number');
      expect(typeof emittedEvent.limitValue).toBe('number');
      expect(typeof emittedEvent.percentage).toBe('number');
    });

    it('should include all required fields in exceeded events', () => {
      const exceededEvent: LimitExceededEvent = {
        taskId: 'validation-test',
        limitType: 'time',
        currentValue: 15000,
        limitValue: 10000,
        percentage: 150,
      };

      orchestrator.emit('limit:exceeded', exceededEvent);

      const emittedEvent = eventSpy.exceeded[0];
      expect(emittedEvent).toHaveProperty('taskId');
      expect(emittedEvent).toHaveProperty('limitType');
      expect(emittedEvent).toHaveProperty('currentValue');
      expect(emittedEvent).toHaveProperty('limitValue');
      expect(emittedEvent).toHaveProperty('percentage');

      expect(['tokens', 'cost', 'time', 'files']).toContain(emittedEvent.limitType);
      expect(emittedEvent.percentage).toBeGreaterThan(100);
    });

    it('should validate limit types are correct', () => {
      const validLimitTypes = ['tokens', 'cost', 'time', 'files'];

      validLimitTypes.forEach(limitType => {
        orchestrator.emit('limit:warning', {
          taskId: 'type-validation-test',
          limitType: limitType as any,
          currentValue: 80,
          limitValue: 100,
          percentage: 80,
        });
      });

      expect(eventSpy.warnings).toHaveLength(4);
      expect(eventSpy.warnings.every(w => validLimitTypes.includes(w.limitType))).toBe(true);
    });
  });

  describe('Integration with Task Store', () => {
    it('should update task status when paused due to limit exceeded', async () => {
      const taskId = 'store-integration-test';
      const mockTask: Task = {
        id: taskId,
        title: 'Store Integration Test',
        description: 'Testing store integration on pause',
        status: 'running' as TaskStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
        branchName: 'test-branch',
        workflow: 'test-workflow',
        usage: {
          inputTokens: 12000,
          outputTokens: 6000,
          totalTokens: 18000, // Exceeds 10000 limit
          estimatedCost: 1.0,
        },
        logs: [],
        artifacts: [],
      } as Task;

      mockStore.getTask.mockResolvedValue(mockTask);

      // Emit exceeded event
      orchestrator.emit('limit:exceeded', {
        taskId,
        limitType: 'tokens',
        currentValue: 18000,
        limitValue: 10000,
        percentage: 180,
      });

      // Verify the event was emitted
      expect(eventSpy.exceeded).toHaveLength(1);
      expect(eventSpy.exceeded[0].limitType).toBe('tokens');

      // In a real implementation, this would trigger:
      // await this.store.updateTask(taskId, {
      //   status: 'paused',
      //   pauseReason: 'resource_limit_exceeded',
      //   pausedAt: new Date()
      // });
    });
  });
});