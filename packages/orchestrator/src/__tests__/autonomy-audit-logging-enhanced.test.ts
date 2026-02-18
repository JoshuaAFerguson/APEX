/**
 * Enhanced audit logging tests for autonomy enforcement system
 *
 * Tests verify that audit logging occurs correctly for all autonomy
 * enforcement scenarios including approvals, denials, warnings, and violations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutonomyEnforcer, type AutonomyEnforcerConfig, type ActionMetadata } from '../autonomy-enforcer.js';
import {
  AutonomyLevel,
  type AutonomyLimits,
  type Task,
  type TaskUsage,
  TaskStatus
} from '@apexcli/core';

// Mock orchestrator with audit logging capabilities
const createMockOrchestrator = () => ({
  on: vi.fn(),
  emit: vi.fn(),
  store: {
    getTask: vi.fn(),
    addAuditLog: vi.fn().mockResolvedValue(undefined),
    getAuditLogsForTask: vi.fn().mockResolvedValue([]),
    queryAuditLogs: vi.fn().mockResolvedValue([]),
  },
});

// Helper to create test task
const createTestTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'audit-test-task-' + Date.now(),
  description: 'Test task for audit logging verification',
  status: 'pending' as TaskStatus,
  workflow: 'test-workflow',
  agent: 'test-agent',
  priority: 'medium',
  createdAt: new Date(),
  updatedAt: new Date(),
  completedAt: null,
  trashedAt: null,
  archivedAt: null,
  usage: {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
  },
  context: {},
  result: null,
  error: null,
  metadata: {},
  logs: [],
  artifacts: [],
  ...overrides,
});

describe('Autonomy Enforcement Audit Logging', () => {
  let autonomyEnforcer: AutonomyEnforcer;
  let mockOrchestrator: ReturnType<typeof createMockOrchestrator>;
  let baseConfig: AutonomyEnforcerConfig;

  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();

    baseConfig = {
      level: 'review-before-commit' as AutonomyLevel,
      gates: [],
      limits: {
        maxTokensPerTask: 10000,
        maxCostPerTask: 5.00,
        maxTimePerTaskMs: 300000,
      } as AutonomyLimits,
      warningThresholds: {
        costWarningPercent: 80,
        tokenWarningPercent: 80,
        timeWarningPercent: 80,
        fileWarningPercent: 80,
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Approval Request Audit Logging', () => {
    it('should trigger audit logging when approval is required for commit operations', async () => {
      autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      const commitAction: ActionMetadata = {
        agentType: 'developer',
        actionType: 'git-commit',
        toolName: 'Bash',
        operationType: 'execute'
      };

      await autonomyEnforcer.checkAction(commitAction);

      // Verify approval:required event was emitted (triggers audit logging in orchestrator)
      expect(emitSpy).toHaveBeenCalledWith(
        'approval:required',
        'before-commit',
        expect.objectContaining({
          agent: 'developer',
          operationType: 'execute'
        })
      );

      // In a real scenario, the orchestrator would call addAuditLog based on this event
      // We'll simulate this by verifying the event emission which drives audit logging
    });

    it('should provide comprehensive context for approval audit logs', async () => {
      autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      const complexAction: ActionMetadata = {
        agentType: 'senior-developer',
        actionType: 'deploy-to-production',
        toolName: 'Bash',
        operationType: 'execute',
        scope: 'production-deployment'
      };

      await autonomyEnforcer.checkAction(complexAction);

      expect(emitSpy).toHaveBeenCalledWith(
        'approval:required',
        'before-commit',
        expect.objectContaining({
          task: expect.objectContaining({ id: 'current-task' }),
          currentStage: 'execution',
          agent: 'senior-developer',
          operationType: 'execute'
        })
      );
    });

    it('should trigger audit logging for different gate types', async () => {
      const configWithGates = {
        ...baseConfig,
        level: 'full-auto' as AutonomyLevel,
        gates: [
          { type: 'before-destructive', description: 'Review destructive ops', enabled: true },
          { type: 'before-network', description: 'Review network ops', enabled: true },
          { type: 'before-file-write', description: 'Review file writes', enabled: true }
        ]
      };

      autonomyEnforcer = new AutonomyEnforcer(configWithGates, mockOrchestrator as any);
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      const testActions = [
        {
          action: {
            agentType: 'developer',
            actionType: 'delete-database',
            operationType: 'dangerous'
          } as ActionMetadata,
          expectedGate: 'before-destructive'
        },
        {
          action: {
            agentType: 'developer',
            actionType: 'fetch-data',
            toolName: 'WebFetch',
            operationType: 'network'
          } as ActionMetadata,
          expectedGate: 'before-network'
        },
        {
          action: {
            agentType: 'developer',
            actionType: 'edit-file',
            toolName: 'Write',
            operationType: 'write'
          } as ActionMetadata,
          expectedGate: 'before-file-write'
        }
      ];

      for (const { action, expectedGate } of testActions) {
        emitSpy.mockClear();
        await autonomyEnforcer.checkAction(action);

        expect(emitSpy).toHaveBeenCalledWith(
          'approval:required',
          expectedGate,
          expect.objectContaining({
            agent: 'developer'
          })
        );
      }
    });
  });

  describe('Resource Limit Violation Audit Logging', () => {
    let task: Task;

    beforeEach(() => {
      autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);
      task = createTestTask();
      mockOrchestrator.store.getTask.mockReturnValue(task);
    });

    it('should trigger audit logging when token limits are exceeded', () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');
      const taskId = task.id;

      autonomyEnforcer.startTracking(taskId);

      // Record usage that exceeds token limits
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 8000,
        outputTokens: 3500,
        totalTokens: 11500, // Exceeds 10000 limit
        estimatedCost: 1.50,
      });

      // Verify limit:exceeded event was emitted
      expect(emitSpy).toHaveBeenCalledWith(
        'limit:exceeded',
        expect.objectContaining({
          exceeded: true,
          limitType: 'tokens',
          currentValue: 11500,
          limitValue: 10000,
          message: expect.stringContaining('Token limit exceeded')
        }),
        task
      );
    });

    it('should trigger audit logging when cost limits are exceeded', () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');
      const taskId = task.id;

      autonomyEnforcer.startTracking(taskId);

      // Record usage that exceeds cost limits
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 5000,
        outputTokens: 2500,
        totalTokens: 7500,
        estimatedCost: 6.25, // Exceeds 5.00 limit
      });

      // Verify limit:exceeded event was emitted
      expect(emitSpy).toHaveBeenCalledWith(
        'limit:exceeded',
        expect.objectContaining({
          exceeded: true,
          limitType: 'cost',
          currentValue: 6.25,
          limitValue: 5.00,
          message: expect.stringContaining('Cost limit exceeded')
        }),
        task
      );
    });

    it('should trigger audit logging when time limits are exceeded', () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');
      const taskId = task.id;

      // Mock time passage
      const originalNow = Date.now;
      const startTime = 1000000;
      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(startTime) // Start tracking
        .mockReturnValue(startTime + 350000); // 350 seconds later (exceeds 300s limit)

      autonomyEnforcer.startTracking(taskId);

      const result = autonomyEnforcer.checkLimits(taskId);
      expect(result.exceeded).toBe(true);
      expect(result.limitType).toBe('time');

      // Reset Date.now
      Date.now = originalNow;
    });

    it('should include complete task context in limit violation audit logs', () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');
      const complexTask = createTestTask({
        id: 'complex-audit-task',
        description: 'Complex task with metadata',
        agent: 'senior-developer',
        metadata: { priority: 'critical', environment: 'production' }
      });

      mockOrchestrator.store.getTask.mockReturnValue(complexTask);
      const taskId = complexTask.id;

      autonomyEnforcer.startTracking(taskId);

      autonomyEnforcer.recordUsage(taskId, {
        totalTokens: 12000, // Exceeds limit
        estimatedCost: 2.50,
      });

      expect(emitSpy).toHaveBeenCalledWith(
        'limit:exceeded',
        expect.objectContaining({
          exceeded: true,
          limitType: 'tokens'
        }),
        complexTask // Ensure full task object is passed for audit logging
      );
    });
  });

  describe('Warning Threshold Audit Logging', () => {
    beforeEach(() => {
      autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);
    });

    it('should trigger audit logging when warning thresholds are reached', () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');
      const taskId = 'warning-test-task';

      autonomyEnforcer.startTracking(taskId);

      // Record usage that triggers warning thresholds (85% of limits)
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 6000,
        outputTokens: 2500,
        totalTokens: 8500, // 85% of 10000 limit (above 80% threshold)
        estimatedCost: 4.25, // 85% of 5.00 limit (above 80% threshold)
      });

      // Should emit warnings for both tokens and cost
      expect(emitSpy).toHaveBeenCalledWith(
        'limit:warning',
        expect.objectContaining({
          type: 'tokens',
          threshold: 80,
          currentValue: 8500,
          limitValue: 10000,
          message: expect.stringContaining('Token usage at 85.0% of limit')
        })
      );

      expect(emitSpy).toHaveBeenCalledWith(
        'limit:warning',
        expect.objectContaining({
          type: 'cost',
          threshold: 80,
          currentValue: 4.25,
          limitValue: 5.00,
          message: expect.stringContaining('Cost usage at 85.0% of limit')
        })
      );
    });

    it('should trigger time warning audit logging', () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');
      const taskId = 'time-warning-task';

      // Mock time passage to trigger 85% threshold
      const originalNow = Date.now;
      const startTime = 1000000;
      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(startTime) // Start tracking
        .mockReturnValue(startTime + 255000); // 255 seconds = 85% of 300 second limit

      autonomyEnforcer.startTracking(taskId);

      const usage: TaskUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        estimatedCost: 0.50,
      };

      autonomyEnforcer.recordUsage(taskId, usage);

      expect(emitSpy).toHaveBeenCalledWith(
        'limit:warning',
        expect.objectContaining({
          type: 'time',
          threshold: 80,
          currentValue: 255000,
          limitValue: 300000
        })
      );

      // Reset Date.now
      Date.now = originalNow;
    });

    it('should handle multiple simultaneous warning thresholds', () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');
      const taskId = 'multi-warning-task';

      autonomyEnforcer.startTracking(taskId);

      // Record usage that triggers all warning types
      autonomyEnforcer.recordUsage(taskId, {
        totalTokens: 9000, // 90% of limit
        estimatedCost: 4.50, // 90% of limit
      });

      // Should emit warnings for both types
      expect(emitSpy).toHaveBeenCalledTimes(2);
      expect(emitSpy).toHaveBeenCalledWith(
        'limit:warning',
        expect.objectContaining({ type: 'tokens' })
      );
      expect(emitSpy).toHaveBeenCalledWith(
        'limit:warning',
        expect.objectContaining({ type: 'cost' })
      );
    });
  });

  describe('Approval Bypass Audit Logging', () => {
    it('should not emit approval events when gates are disabled', async () => {
      const configWithDisabledGates = {
        ...baseConfig,
        level: 'full-auto' as AutonomyLevel,
        gates: [
          { type: 'before-destructive', description: 'Review destructive ops', enabled: false },
          { type: 'before-network', description: 'Review network ops', enabled: false }
        ]
      };

      autonomyEnforcer = new AutonomyEnforcer(configWithDisabledGates, mockOrchestrator as any);
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      const destructiveAction: ActionMetadata = {
        agentType: 'developer',
        actionType: 'delete-database',
        operationType: 'dangerous'
      };

      const requiresApproval = await autonomyEnforcer.checkAction(destructiveAction);

      expect(requiresApproval).toBe(false);
      expect(emitSpy).not.toHaveBeenCalledWith('approval:required', expect.anything(), expect.anything());
    });

    it('should handle gate bypass scenarios correctly', async () => {
      autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      // Test non-triggering action in review-before-commit mode
      const readAction: ActionMetadata = {
        agentType: 'developer',
        actionType: 'read-file',
        toolName: 'Read',
        operationType: 'read'
      };

      const requiresApproval = await autonomyEnforcer.checkAction(readAction);

      expect(requiresApproval).toBe(false);
      expect(emitSpy).not.toHaveBeenCalledWith('approval:required', expect.anything(), expect.anything());
    });
  });

  describe('Concurrent Audit Logging Scenarios', () => {
    beforeEach(() => {
      autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);
    });

    it('should handle concurrent audit events from multiple tasks', () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');
      const task1Id = 'concurrent-task-1';
      const task2Id = 'concurrent-task-2';
      const task3Id = 'concurrent-task-3';

      // Start tracking multiple tasks
      autonomyEnforcer.startTracking(task1Id);
      autonomyEnforcer.startTracking(task2Id);
      autonomyEnforcer.startTracking(task3Id);

      // Record different usage patterns that trigger various events
      autonomyEnforcer.recordUsage(task1Id, { totalTokens: 8500, estimatedCost: 1.00 }); // Token warning
      autonomyEnforcer.recordUsage(task2Id, { totalTokens: 5000, estimatedCost: 4.50 }); // Cost warning
      autonomyEnforcer.recordUsage(task3Id, { totalTokens: 11000, estimatedCost: 2.00 }); // Token limit exceeded

      // Should emit appropriate events for each task
      expect(emitSpy).toHaveBeenCalledWith(
        'limit:warning',
        expect.objectContaining({ type: 'tokens', currentValue: 8500 })
      );

      expect(emitSpy).toHaveBeenCalledWith(
        'limit:warning',
        expect.objectContaining({ type: 'cost', currentValue: 4.50 })
      );

      // For the limit exceeded case, we need to mock the task retrieval
      const exceedingTask = createTestTask({ id: task3Id });
      mockOrchestrator.store.getTask.mockReturnValue(exceedingTask);

      // The limit exceeded event would have been emitted during recordUsage
      expect(emitSpy).toHaveBeenCalledWith(
        'limit:exceeded',
        expect.objectContaining({ limitType: 'tokens', currentValue: 11000 }),
        expect.any(Object)
      );
    });

    it('should maintain separate audit contexts for different tasks', async () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      // Different actions for different tasks
      const actions = [
        {
          agentType: 'developer-1',
          actionType: 'git-commit',
          toolName: 'Bash',
          operationType: 'execute'
        },
        {
          agentType: 'developer-2',
          actionType: 'deploy-staging',
          toolName: 'Bash',
          operationType: 'execute'
        }
      ];

      for (const action of actions) {
        emitSpy.mockClear();
        await autonomyEnforcer.checkAction(action as ActionMetadata);

        expect(emitSpy).toHaveBeenCalledWith(
          'approval:required',
          'before-commit',
          expect.objectContaining({
            agent: action.agentType
          })
        );
      }
    });
  });

  describe('Audit Log Data Integrity', () => {
    beforeEach(() => {
      autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);
    });

    it('should provide consistent event data for audit logging', async () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      const action: ActionMetadata = {
        agentType: 'test-agent',
        actionType: 'test-action',
        toolName: 'TestTool',
        operationType: 'execute',
        scope: 'test-scope'
      };

      await autonomyEnforcer.checkAction(action);

      const emittedEvents = emitSpy.mock.calls;

      // Verify that all events have consistent structure
      emittedEvents.forEach(([eventType, eventData, context]) => {
        expect(eventType).toBeDefined();
        expect(typeof eventType).toBe('string');

        if (context) {
          expect(context).toHaveProperty('agent');
          expect(context).toHaveProperty('task');
          expect(context).toHaveProperty('currentStage');
          expect(context).toHaveProperty('operationType');
        }
      });
    });

    it('should ensure all audit events include timestamp information', () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');
      const taskId = 'timestamp-test-task';

      autonomyEnforcer.startTracking(taskId);

      // The start tracking should set a timestamp
      const startTime = autonomyEnforcer.getElapsedTime(taskId);
      expect(startTime).toBeDefined();
      expect(typeof startTime).toBe('number');

      // Record usage to trigger events
      autonomyEnforcer.recordUsage(taskId, { totalTokens: 8500, estimatedCost: 1.00 });

      // Verify timing is available for audit context
      const elapsedTime = autonomyEnforcer.getElapsedTime(taskId);
      expect(elapsedTime).toBeGreaterThan(0);
    });

    it('should provide complete error context for failed operations', () => {
      const taskId = 'error-context-task';

      // Test error handling with non-existent task
      const limitCheck = autonomyEnforcer.checkLimits('non-existent-task');
      expect(limitCheck.exceeded).toBe(false);

      // Test graceful handling of missing data
      const usage = autonomyEnforcer.getTaskUsage('non-existent-task');
      expect(usage).toBeUndefined();

      const elapsedTime = autonomyEnforcer.getElapsedTime('non-existent-task');
      expect(elapsedTime).toBeUndefined();
    });
  });
});