/**
 * Comprehensive unit tests for autonomy enforcement system
 *
 * This test suite verifies all acceptance criteria:
 * - Tests cover all three autonomy modes
 * - Tests verify git commit detection for review-before-commit
 * - Tests verify per-task override behavior
 * - Tests verify audit logging occurs correctly
 * - All tests pass
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutonomyEnforcer, type AutonomyEnforcerConfig, type ActionMetadata, type TaskContext } from '../autonomy-enforcer.js';
import { ApexOrchestrator } from '../index.js';
import {
  Task,
  TaskStatus,
  AutonomyLevel,
  ApprovalGate,
  type AutonomyLimits,
  type TaskUsage
} from '@apexcli/core';

// Mock ApexOrchestrator for testing
const createMockOrchestrator = () => ({
  on: vi.fn(),
  emit: vi.fn(),
  store: {
    getTask: vi.fn(),
    addAuditLog: vi.fn().mockResolvedValue(undefined),
  },
});

// Helper to create test task
const createTestTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'test-task-autonomy-' + Date.now(),
  description: 'Test task for autonomy enforcement',
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

describe('Autonomy Enforcement Comprehensive Tests', () => {
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
        maxTimePerTaskMs: 300000, // 5 minutes
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

  describe('All Three Autonomy Modes Tests', () => {
    describe('Full-Auto Mode', () => {
      beforeEach(() => {
        baseConfig.level = 'full-auto';
        autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);
      });

      it('should allow all operations without approval in full-auto mode', async () => {
        const testCases: ActionMetadata[] = [
          {
            agentType: 'developer',
            actionType: 'edit-file',
            toolName: 'Edit',
            operationType: 'write'
          },
          {
            agentType: 'developer',
            actionType: 'run-command',
            toolName: 'Bash',
            operationType: 'execute'
          },
          {
            agentType: 'developer',
            actionType: 'fetch-data',
            toolName: 'WebFetch',
            operationType: 'network'
          },
          {
            agentType: 'developer',
            actionType: 'read-file',
            toolName: 'Read',
            operationType: 'read'
          }
        ];

        for (const actionMetadata of testCases) {
          const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
          expect(requiresApproval).toBe(false);
        }
      });

      it('should respect specific gates even in full-auto mode', async () => {
        // Add a specific gate for destructive operations
        autonomyEnforcer.updateConfig({
          gates: [{
            type: 'before-destructive',
            description: 'Review destructive ops',
            enabled: true
          }]
        });

        const destructiveAction: ActionMetadata = {
          agentType: 'developer',
          actionType: 'delete-database',
          operationType: 'dangerous'
        };

        const requiresApproval = await autonomyEnforcer.checkAction(destructiveAction);
        expect(requiresApproval).toBe(true);
      });

      it('should not require approval for commit operations in full-auto mode', async () => {
        const commitAction: ActionMetadata = {
          agentType: 'developer',
          actionType: 'git-commit',
          toolName: 'Bash',
          operationType: 'execute'
        };

        const requiresApproval = await autonomyEnforcer.checkAction(commitAction);
        expect(requiresApproval).toBe(false);
      });
    });

    describe('Review-Before-Commit Mode', () => {
      beforeEach(() => {
        baseConfig.level = 'review-before-commit';
        autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);
      });

      it('should require approval for git commit operations', async () => {
        const gitCommitActions: ActionMetadata[] = [
          {
            agentType: 'developer',
            actionType: 'git-commit',
            toolName: 'Bash',
            operationType: 'execute'
          },
          {
            agentType: 'developer',
            actionType: 'git-push',
            toolName: 'Bash',
            operationType: 'execute'
          },
          {
            agentType: 'devops',
            actionType: 'deploy',
            toolName: 'Bash',
            operationType: 'execute'
          },
          {
            agentType: 'developer',
            actionType: 'publish',
            toolName: 'Bash',
            operationType: 'execute'
          }
        ];

        for (const action of gitCommitActions) {
          const requiresApproval = await autonomyEnforcer.checkAction(action);
          expect(requiresApproval).toBe(true);
        }
      });

      it('should allow non-commit operations without approval', async () => {
        const allowedActions: ActionMetadata[] = [
          {
            agentType: 'developer',
            actionType: 'edit-file',
            toolName: 'Edit',
            operationType: 'write'
          },
          {
            agentType: 'developer',
            actionType: 'read-file',
            toolName: 'Read',
            operationType: 'read'
          },
          {
            agentType: 'tester',
            actionType: 'run-tests',
            toolName: 'Bash',
            operationType: 'execute'
          }
        ];

        for (const action of allowedActions) {
          const requiresApproval = await autonomyEnforcer.checkAction(action);
          expect(requiresApproval).toBe(false);
        }
      });

      it('should emit approval:required event for commit operations', async () => {
        const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

        const commitAction: ActionMetadata = {
          agentType: 'developer',
          actionType: 'git-commit',
          toolName: 'Bash',
          operationType: 'execute'
        };

        await autonomyEnforcer.checkAction(commitAction);

        expect(emitSpy).toHaveBeenCalledWith(
          'approval:required',
          'before-commit',
          expect.objectContaining({
            agent: 'developer',
            operationType: 'execute'
          })
        );
      });
    });

    describe('Review-All Mode', () => {
      beforeEach(() => {
        baseConfig.level = 'review-all';
        autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);
      });

      it('should allow only read operations without approval', async () => {
        const readAction: ActionMetadata = {
          agentType: 'developer',
          actionType: 'read-file',
          toolName: 'Read',
          operationType: 'read'
        };

        const requiresApproval = await autonomyEnforcer.checkAction(readAction);
        expect(requiresApproval).toBe(false);
      });

      it('should require approval for all non-read operations', async () => {
        const restrictedActions: ActionMetadata[] = [
          {
            agentType: 'developer',
            actionType: 'edit-file',
            toolName: 'Edit',
            operationType: 'write'
          },
          {
            agentType: 'developer',
            actionType: 'run-command',
            toolName: 'Bash',
            operationType: 'execute'
          },
          {
            agentType: 'developer',
            actionType: 'fetch-data',
            toolName: 'WebFetch',
            operationType: 'network'
          },
          {
            agentType: 'developer',
            actionType: 'delete-file',
            toolName: 'Edit',
            operationType: 'dangerous'
          }
        ];

        for (const action of restrictedActions) {
          const requiresApproval = await autonomyEnforcer.checkAction(action);
          expect(requiresApproval).toBe(true);
        }
      });

      it('should emit approval:required event for non-read operations', async () => {
        const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

        const writeAction: ActionMetadata = {
          agentType: 'developer',
          actionType: 'edit-file',
          toolName: 'Edit',
          operationType: 'write'
        };

        await autonomyEnforcer.checkAction(writeAction);

        expect(emitSpy).toHaveBeenCalledWith(
          'approval:required',
          'review-all',
          expect.objectContaining({
            agent: 'developer',
            operationType: 'write'
          })
        );
      });
    });
  });

  describe('Git Commit Detection Tests', () => {
    beforeEach(() => {
      baseConfig.level = 'review-before-commit';
      autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);
    });

    it('should detect git commit operations in action types', async () => {
      const gitCommitDetectionTests = [
        {
          actionType: 'git-commit',
          toolName: 'Bash',
          expected: true,
          description: 'direct git-commit action'
        },
        {
          actionType: 'run-git-commit-command',
          toolName: 'Bash',
          expected: true,
          description: 'git-commit within action type'
        },
        {
          actionType: 'git-push-origin',
          toolName: 'Bash',
          expected: true,
          description: 'git-push operation'
        },
        {
          actionType: 'deploy-to-production',
          toolName: 'Bash',
          expected: true,
          description: 'deploy operation'
        },
        {
          actionType: 'publish-package',
          toolName: 'Bash',
          expected: true,
          description: 'publish operation'
        },
        {
          actionType: 'edit-file-content',
          toolName: 'Edit',
          expected: false,
          description: 'non-commit file edit'
        },
        {
          actionType: 'read-git-status',
          toolName: 'Bash',
          expected: false,
          description: 'git read operation'
        }
      ];

      for (const test of gitCommitDetectionTests) {
        const actionMetadata: ActionMetadata = {
          agentType: 'developer',
          actionType: test.actionType,
          toolName: test.toolName,
          operationType: 'execute'
        };

        const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
        expect(requiresApproval).toBe(test.expected);
      }
    });

    it('should detect git commit operations in tool names', async () => {
      const toolNameTests = [
        {
          actionType: 'execute-command',
          toolName: 'git-commit',
          expected: true
        },
        {
          actionType: 'execute-command',
          toolName: 'git-push',
          expected: true
        },
        {
          actionType: 'run-task',
          toolName: 'deploy',
          expected: true
        },
        {
          actionType: 'execute-command',
          toolName: 'Bash',
          expected: false
        }
      ];

      for (const test of toolNameTests) {
        const actionMetadata: ActionMetadata = {
          agentType: 'developer',
          actionType: test.actionType,
          toolName: test.toolName,
          operationType: 'execute'
        };

        const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
        expect(requiresApproval).toBe(test.expected);
      }
    });

    it('should handle case sensitivity in git commit detection', async () => {
      const caseSensitivityTests = [
        'git-commit',
        'GIT-COMMIT',
        'Git-Commit',
        'git-push',
        'GIT-PUSH',
        'deploy',
        'DEPLOY',
        'Deploy'
      ];

      for (const actionType of caseSensitivityTests) {
        const actionMetadata: ActionMetadata = {
          agentType: 'developer',
          actionType,
          toolName: 'Bash',
          operationType: 'execute'
        };

        const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
        // Should detect regardless of case (includes check is case-insensitive)
        expect(requiresApproval).toBe(true);
      }
    });
  });

  describe('Per-Task Override Behavior Tests', () => {
    let task1: Task, task2: Task;

    beforeEach(() => {
      baseConfig.level = 'review-all'; // Start with strictest mode
      autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);

      task1 = createTestTask({ id: 'task-1' });
      task2 = createTestTask({ id: 'task-2' });
    });

    it('should apply different autonomy levels per task when overrides are configured', async () => {
      // Mock different configurations per task
      const task1Config = { ...baseConfig, level: 'full-auto' as AutonomyLevel };
      const task2Config = { ...baseConfig, level: 'review-before-commit' as AutonomyLevel };

      // Create separate enforcer instances to simulate per-task configuration
      const task1Enforcer = new AutonomyEnforcer(task1Config, mockOrchestrator as any);
      const task2Enforcer = new AutonomyEnforcer(task2Config, mockOrchestrator as any);

      const writeAction: ActionMetadata = {
        agentType: 'developer',
        actionType: 'edit-file',
        toolName: 'Edit',
        operationType: 'write'
      };

      // Task 1 (full-auto) should not require approval for write operations
      const task1RequiresApproval = await task1Enforcer.checkAction(writeAction);
      expect(task1RequiresApproval).toBe(false);

      // Task 2 (review-before-commit) should not require approval for non-commit operations
      const task2RequiresApproval = await task2Enforcer.checkAction(writeAction);
      expect(task2RequiresApproval).toBe(false);

      // But task 2 should require approval for commit operations
      const commitAction: ActionMetadata = {
        agentType: 'developer',
        actionType: 'git-commit',
        toolName: 'Bash',
        operationType: 'execute'
      };

      const task2CommitRequiresApproval = await task2Enforcer.checkAction(commitAction);
      expect(task2CommitRequiresApproval).toBe(true);
    });

    it('should support different limit configurations per task', () => {
      const task1Limits: AutonomyLimits = {
        maxTokensPerTask: 5000,
        maxCostPerTask: 2.50,
        maxTimePerTaskMs: 150000, // 2.5 minutes
      };

      const task2Limits: AutonomyLimits = {
        maxTokensPerTask: 15000,
        maxCostPerTask: 10.00,
        maxTimePerTaskMs: 600000, // 10 minutes
      };

      // Create separate enforcers with different limits
      const task1Config = { ...baseConfig, limits: task1Limits };
      const task2Config = { ...baseConfig, limits: task2Limits };

      const task1Enforcer = new AutonomyEnforcer(task1Config, mockOrchestrator as any);
      const task2Enforcer = new AutonomyEnforcer(task2Config, mockOrchestrator as any);

      // Start tracking for both tasks
      task1Enforcer.startTracking('task-1');
      task2Enforcer.startTracking('task-2');

      // Record usage that exceeds task1 limits but not task2 limits
      const usage: Partial<TaskUsage> = {
        inputTokens: 6000,
        outputTokens: 2000,
        totalTokens: 8000, // Exceeds task1 limit (5000) but not task2 limit (15000)
        estimatedCost: 3.00, // Exceeds task1 limit (2.50) but not task2 limit (10.00)
      };

      task1Enforcer.recordUsage('task-1', usage);
      task2Enforcer.recordUsage('task-2', usage);

      // Check limits for both tasks
      const task1LimitCheck = task1Enforcer.checkLimits('task-1');
      const task2LimitCheck = task2Enforcer.checkLimits('task-2');

      expect(task1LimitCheck.exceeded).toBe(true);
      expect(task1LimitCheck.limitType).toBe('tokens');

      expect(task2LimitCheck.exceeded).toBe(false);
    });

    it('should emit different events based on per-task configurations', async () => {
      const task1Config = { ...baseConfig, level: 'full-auto' as AutonomyLevel };
      const task2Config = { ...baseConfig, level: 'review-all' as AutonomyLevel };

      const task1Enforcer = new AutonomyEnforcer(task1Config, mockOrchestrator as any);
      const task2Enforcer = new AutonomyEnforcer(task2Config, mockOrchestrator as any);

      const task1EmitSpy = vi.spyOn(task1Enforcer, 'emit');
      const task2EmitSpy = vi.spyOn(task2Enforcer, 'emit');

      const writeAction: ActionMetadata = {
        agentType: 'developer',
        actionType: 'edit-file',
        toolName: 'Edit',
        operationType: 'write'
      };

      await task1Enforcer.checkAction(writeAction); // full-auto
      await task2Enforcer.checkAction(writeAction); // review-all

      // Task 1 (full-auto) should not emit approval events for write operations
      expect(task1EmitSpy).not.toHaveBeenCalledWith('approval:required', expect.anything(), expect.anything());

      // Task 2 (review-all) should emit approval events for write operations
      expect(task2EmitSpy).toHaveBeenCalledWith('approval:required', 'review-all', expect.anything());
    });
  });

  describe('Audit Logging Verification Tests', () => {
    beforeEach(() => {
      baseConfig.level = 'review-before-commit';
      autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);
    });

    it('should trigger audit logging when approval is required', async () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      const commitAction: ActionMetadata = {
        agentType: 'developer',
        actionType: 'git-commit',
        toolName: 'Bash',
        operationType: 'execute'
      };

      await autonomyEnforcer.checkAction(commitAction);

      // Verify approval:required event was emitted (this would trigger audit logging in orchestrator)
      expect(emitSpy).toHaveBeenCalledWith(
        'approval:required',
        'before-commit',
        expect.objectContaining({
          agent: 'developer',
          operationType: 'execute'
        })
      );
    });

    it('should trigger audit logging when limits are exceeded', () => {
      const task = createTestTask();
      mockOrchestrator.store.getTask.mockReturnValue(task);

      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');
      const taskId = 'audit-test-task';

      autonomyEnforcer.startTracking(taskId);

      // Record usage that exceeds token limits
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 8000,
        outputTokens: 3000,
        totalTokens: 11000, // Exceeds 10000 limit
        estimatedCost: 1.00,
      });

      // Should emit limit:exceeded event (this would trigger audit logging in orchestrator)
      expect(emitSpy).toHaveBeenCalledWith(
        'limit:exceeded',
        expect.objectContaining({
          exceeded: true,
          limitType: 'tokens'
        }),
        task
      );
    });

    it('should trigger audit logging when warnings are emitted', () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');
      const taskId = 'warning-audit-task';

      autonomyEnforcer.startTracking(taskId);

      // Record usage that triggers 85% warning threshold
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 6000,
        outputTokens: 2500,
        totalTokens: 8500, // 85% of 10000 limit
        estimatedCost: 0.50,
      });

      // Should emit limit:warning event (this would trigger audit logging in orchestrator)
      expect(emitSpy).toHaveBeenCalledWith(
        'limit:warning',
        expect.objectContaining({
          type: 'tokens',
          threshold: 80,
          currentValue: 8500,
          limitValue: 10000
        })
      );
    });

    it('should include complete context information for audit logging', async () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      const destructiveAction: ActionMetadata = {
        agentType: 'developer',
        actionType: 'delete-database',
        toolName: 'Bash',
        operationType: 'dangerous',
        scope: 'production'
      };

      // Add a gate that would trigger for this action
      autonomyEnforcer.updateConfig({
        gates: [{
          type: 'before-destructive',
          description: 'Review destructive operations',
          enabled: true
        }]
      });

      await autonomyEnforcer.checkAction(destructiveAction);

      // Verify that complete context is provided for audit logging
      expect(emitSpy).toHaveBeenCalledWith(
        'approval:required',
        'before-destructive',
        expect.objectContaining({
          task: expect.objectContaining({ id: 'current-task' }),
          currentStage: 'execution',
          agent: 'developer',
          operationType: 'dangerous'
        })
      );
    });

    it('should handle concurrent audit logging scenarios', () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');
      const task1Id = 'concurrent-task-1';
      const task2Id = 'concurrent-task-2';

      // Start tracking multiple tasks simultaneously
      autonomyEnforcer.startTracking(task1Id);
      autonomyEnforcer.startTracking(task2Id);

      // Record different usage patterns for each task
      autonomyEnforcer.recordUsage(task1Id, {
        totalTokens: 8500, // 85% warning
        estimatedCost: 0.50,
      });

      autonomyEnforcer.recordUsage(task2Id, {
        totalTokens: 9500, // 95% warning
        estimatedCost: 4.50, // 90% warning
      });

      // Should emit appropriate warnings for each task
      expect(emitSpy).toHaveBeenCalledWith(
        'limit:warning',
        expect.objectContaining({ currentValue: 8500 })
      );

      expect(emitSpy).toHaveBeenCalledWith(
        'limit:warning',
        expect.objectContaining({ currentValue: 9500 })
      );

      expect(emitSpy).toHaveBeenCalledWith(
        'limit:warning',
        expect.objectContaining({ currentValue: 4.50 })
      );
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex scenarios with multiple modes, overrides, and audit logging', async () => {
      // Test a complex workflow that exercises all aspects of the system
      const complexConfig: AutonomyEnforcerConfig = {
        level: 'review-before-commit',
        gates: [
          { type: 'before-destructive', description: 'Review destructive ops', enabled: true },
          { type: 'before-network', description: 'Review network ops', enabled: true }
        ],
        limits: {
          maxTokensPerTask: 5000,
          maxCostPerTask: 2.00,
          maxTimePerTaskMs: 180000, // 3 minutes
        } as AutonomyLimits,
        warningThresholds: {
          costWarningPercent: 75,
          tokenWarningPercent: 75,
          timeWarningPercent: 75,
          fileWarningPercent: 75,
        },
      };

      const complexEnforcer = new AutonomyEnforcer(complexConfig, mockOrchestrator as any);
      const emitSpy = vi.spyOn(complexEnforcer, 'emit');
      const taskId = 'complex-integration-task';

      // 1. Start tracking with resource limits
      complexEnforcer.startTracking(taskId);

      // 2. Test various action types
      const actions: Array<{ action: ActionMetadata, expectsApproval: boolean }> = [
        {
          action: {
            agentType: 'developer',
            actionType: 'read-file',
            toolName: 'Read',
            operationType: 'read'
          },
          expectsApproval: false
        },
        {
          action: {
            agentType: 'developer',
            actionType: 'edit-file',
            toolName: 'Edit',
            operationType: 'write'
          },
          expectsApproval: false
        },
        {
          action: {
            agentType: 'developer',
            actionType: 'fetch-api-data',
            toolName: 'WebFetch',
            operationType: 'network'
          },
          expectsApproval: true // Should trigger before-network gate
        },
        {
          action: {
            agentType: 'developer',
            actionType: 'git-commit',
            toolName: 'Bash',
            operationType: 'execute'
          },
          expectsApproval: true // Should trigger review-before-commit
        },
        {
          action: {
            agentType: 'developer',
            actionType: 'delete-files',
            operationType: 'dangerous'
          },
          expectsApproval: true // Should trigger before-destructive gate
        }
      ];

      // Test each action and verify expected behavior
      for (const { action, expectsApproval } of actions) {
        const requiresApproval = await complexEnforcer.checkAction(action);
        expect(requiresApproval).toBe(expectsApproval);
      }

      // 3. Test resource usage and warning thresholds
      complexEnforcer.recordUsage(taskId, {
        inputTokens: 3000,
        outputTokens: 1000,
        totalTokens: 4000, // 80% of 5000 limit (above 75% threshold)
        estimatedCost: 1.60, // 80% of 2.00 limit (above 75% threshold)
      });

      // Should emit warning events
      expect(emitSpy).toHaveBeenCalledWith(
        'limit:warning',
        expect.objectContaining({
          type: 'tokens',
          threshold: 75
        })
      );

      expect(emitSpy).toHaveBeenCalledWith(
        'limit:warning',
        expect.objectContaining({
          type: 'cost',
          threshold: 75
        })
      );

      // 4. Test limit exceeded scenario
      const exceedingTask = createTestTask({ id: taskId });
      mockOrchestrator.store.getTask.mockReturnValue(exceedingTask);

      complexEnforcer.recordUsage(taskId, {
        totalTokens: 2000, // Total now 6000, exceeding 5000 limit
        estimatedCost: 0.60, // Total now 2.20, exceeding 2.00 limit
      });

      // Should emit limit exceeded event
      expect(emitSpy).toHaveBeenCalledWith(
        'limit:exceeded',
        expect.objectContaining({
          exceeded: true,
          limitType: expect.stringMatching(/tokens|cost/)
        }),
        exceedingTask
      );
    });
  });
});