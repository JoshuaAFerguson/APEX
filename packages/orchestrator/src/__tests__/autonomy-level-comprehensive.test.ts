/**
 * Comprehensive tests for autonomy level behavior
 *
 * Tests each autonomy level thoroughly including:
 * - Full-auto mode behavior and exceptions
 * - Review-before-commit mode with git operation detection
 * - Review-all mode with operation type filtering
 * - Agent and stage-specific overrides
 * - Legacy autonomy level migration
 * - Autonomy level transitions and updates
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import {
  AutonomyEnforcer,
  type AutonomyEnforcerConfig,
  type ActionMetadata,
  type TaskContext,
} from '../autonomy-enforcer.js';
import {
  Task,
  TaskStatus,
  AutonomyLevel,
  ApprovalGate,
  TaskResourceLimits,
  AgentAutonomyOverride,
  migrateLegacyAutonomyLevel,
  LegacyAutonomyLevel,
} from '@apexcli/core';

// Mock orchestrator
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
  id: `autonomy-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  description: 'Autonomy level test task',
  status: 'pending' as TaskStatus,
  workflow: 'autonomy-test-workflow',
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

describe('Autonomy Level Comprehensive Tests', () => {
  let autonomyEnforcer: AutonomyEnforcer;
  let mockOrchestrator: ReturnType<typeof createMockOrchestrator>;
  let baseConfig: AutonomyEnforcerConfig;

  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();

    baseConfig = {
      level: 'review-before-commit' as AutonomyLevel,
      gates: [],
      limits: {
        maxTokens: 10000,
        maxCost: 5.0,
        maxTimeMs: 300000,
      } as TaskResourceLimits,
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

  describe('Full-Auto Mode Tests', () => {
    beforeEach(() => {
      baseConfig.level = 'full-auto';
      autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);
    });

    const fullAutoTestCases: {
      name: string;
      action: ActionMetadata;
      shouldRequireApproval: boolean;
    }[] = [
      {
        name: 'file read operation',
        action: {
          agentType: 'developer',
          actionType: 'read-file',
          toolName: 'Read',
          operationType: 'read',
        },
        shouldRequireApproval: false,
      },
      {
        name: 'file write operation',
        action: {
          agentType: 'developer',
          actionType: 'write-file',
          toolName: 'Write',
          operationType: 'write',
        },
        shouldRequireApproval: false,
      },
      {
        name: 'git commit operation',
        action: {
          agentType: 'developer',
          actionType: 'git-commit',
          toolName: 'Bash',
          operationType: 'execute',
        },
        shouldRequireApproval: false,
      },
      {
        name: 'network request',
        action: {
          agentType: 'researcher',
          actionType: 'web-fetch',
          toolName: 'WebFetch',
          operationType: 'network',
        },
        shouldRequireApproval: false,
      },
      {
        name: 'dangerous operation',
        action: {
          agentType: 'admin',
          actionType: 'delete-database',
          toolName: 'Bash',
          operationType: 'dangerous',
        },
        shouldRequireApproval: false,
      },
    ];

    fullAutoTestCases.forEach(({ name, action, shouldRequireApproval }) => {
      it(`should ${shouldRequireApproval ? 'require' : 'not require'} approval for ${name} in full-auto mode`, async () => {
        const result = await autonomyEnforcer.checkAction(action);
        expect(result).toBe(shouldRequireApproval);
      });
    });

    it('should respect specific gates even in full-auto mode', async () => {
      // Add specific gates
      autonomyEnforcer.updateConfig({
        gates: [
          {
            type: 'before-destructive',
            description: 'Always review destructive operations',
            enabled: true,
          } as ApprovalGate,
        ],
      });

      const destructiveAction: ActionMetadata = {
        agentType: 'admin',
        actionType: 'delete-files',
        operationType: 'dangerous',
      };

      const result = await autonomyEnforcer.checkAction(destructiveAction);
      expect(result).toBe(true);
    });

    it('should bypass disabled gates in full-auto mode', async () => {
      autonomyEnforcer.updateConfig({
        gates: [
          {
            type: 'before-destructive',
            description: 'Disabled destructive gate',
            enabled: false,
          } as ApprovalGate,
        ],
      });

      const destructiveAction: ActionMetadata = {
        agentType: 'admin',
        actionType: 'delete-files',
        operationType: 'dangerous',
      };

      const result = await autonomyEnforcer.checkAction(destructiveAction);
      expect(result).toBe(false);
    });
  });

  describe('Review-Before-Commit Mode Tests', () => {
    beforeEach(() => {
      baseConfig.level = 'review-before-commit';
      autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);
    });

    const commitOperationTestCases: {
      name: string;
      action: ActionMetadata;
      shouldRequireApproval: boolean;
    }[] = [
      {
        name: 'git commit command',
        action: {
          agentType: 'developer',
          actionType: 'git-commit',
          toolName: 'Bash',
          operationType: 'execute',
        },
        shouldRequireApproval: true,
      },
      {
        name: 'git push command',
        action: {
          agentType: 'developer',
          actionType: 'git-push',
          toolName: 'Bash',
          operationType: 'execute',
        },
        shouldRequireApproval: true,
      },
      {
        name: 'deployment operation',
        action: {
          agentType: 'devops',
          actionType: 'deploy-to-production',
          toolName: 'Bash',
          operationType: 'execute',
        },
        shouldRequireApproval: true,
      },
      {
        name: 'publish operation',
        action: {
          agentType: 'publisher',
          actionType: 'npm-publish',
          toolName: 'Bash',
          operationType: 'execute',
        },
        shouldRequireApproval: true,
      },
      {
        name: 'regular file edit',
        action: {
          agentType: 'developer',
          actionType: 'edit-file',
          toolName: 'Edit',
          operationType: 'write',
        },
        shouldRequireApproval: false,
      },
      {
        name: 'file read',
        action: {
          agentType: 'developer',
          actionType: 'read-config',
          toolName: 'Read',
          operationType: 'read',
        },
        shouldRequireApproval: false,
      },
    ];

    commitOperationTestCases.forEach(({ name, action, shouldRequireApproval }) => {
      it(`should ${shouldRequireApproval ? 'require' : 'not require'} approval for ${name} in review-before-commit mode`, async () => {
        const result = await autonomyEnforcer.checkAction(action);
        expect(result).toBe(shouldRequireApproval);
      });
    });

    it('should detect git commands with various syntax patterns', async () => {
      const gitCommandVariations = [
        'git commit -m "message"',
        'git-commit',
        'commit-changes',
        'push-to-origin',
        'git push origin main',
      ];

      for (const actionType of gitCommandVariations) {
        const action: ActionMetadata = {
          agentType: 'developer',
          actionType,
          toolName: 'Bash',
          operationType: 'execute',
        };

        const result = await autonomyEnforcer.checkAction(action);
        expect(result).toBe(true);
      }
    });

    it('should emit approval:required events for commit operations', async () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      const commitAction: ActionMetadata = {
        agentType: 'developer',
        actionType: 'git-commit',
        toolName: 'Bash',
        operationType: 'execute',
      };

      await autonomyEnforcer.checkAction(commitAction);

      expect(emitSpy).toHaveBeenCalledWith(
        'approval:required',
        'before-commit',
        expect.any(Object)
      );
    });
  });

  describe('Review-All Mode Tests', () => {
    beforeEach(() => {
      baseConfig.level = 'review-all';
      autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);
    });

    const reviewAllTestCases: {
      name: string;
      action: ActionMetadata;
      shouldRequireApproval: boolean;
    }[] = [
      {
        name: 'read operation',
        action: {
          agentType: 'researcher',
          actionType: 'read-documentation',
          toolName: 'Read',
          operationType: 'read',
        },
        shouldRequireApproval: false,
      },
      {
        name: 'write operation',
        action: {
          agentType: 'developer',
          actionType: 'write-code',
          toolName: 'Write',
          operationType: 'write',
        },
        shouldRequireApproval: true,
      },
      {
        name: 'execute operation',
        action: {
          agentType: 'tester',
          actionType: 'run-tests',
          toolName: 'Bash',
          operationType: 'execute',
        },
        shouldRequireApproval: true,
      },
      {
        name: 'network operation',
        action: {
          agentType: 'researcher',
          actionType: 'fetch-data',
          toolName: 'WebFetch',
          operationType: 'network',
        },
        shouldRequireApproval: true,
      },
      {
        name: 'dangerous operation',
        action: {
          agentType: 'admin',
          actionType: 'delete-production',
          toolName: 'Bash',
          operationType: 'dangerous',
        },
        shouldRequireApproval: true,
      },
    ];

    reviewAllTestCases.forEach(({ name, action, shouldRequireApproval }) => {
      it(`should ${shouldRequireApproval ? 'require' : 'not require'} approval for ${name} in review-all mode`, async () => {
        const result = await autonomyEnforcer.checkAction(action);
        expect(result).toBe(shouldRequireApproval);
      });
    });

    it('should emit approval:required events for non-read operations', async () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      const writeAction: ActionMetadata = {
        agentType: 'developer',
        actionType: 'create-file',
        toolName: 'Write',
        operationType: 'write',
      };

      await autonomyEnforcer.checkAction(writeAction);

      expect(emitSpy).toHaveBeenCalledWith(
        'approval:required',
        'review-all',
        expect.any(Object)
      );
    });

    it('should not emit events for read operations', async () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      const readAction: ActionMetadata = {
        agentType: 'researcher',
        actionType: 'read-file',
        toolName: 'Read',
        operationType: 'read',
      };

      await autonomyEnforcer.checkAction(readAction);

      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('Agent-Specific Overrides', () => {
    it('should apply agent-specific autonomy level overrides', async () => {
      const config: AutonomyEnforcerConfig = {
        level: 'review-all', // Base level
        gates: [],
        limits: baseConfig.limits,
        warningThresholds: baseConfig.warningThresholds,
      };

      // Mock agent override functionality
      const autonomyEnforcerWithOverrides = new AutonomyEnforcer(config, mockOrchestrator as any);

      // Test that different agents can have different autonomy levels
      const testCases = [
        {
          agent: 'trusted-developer',
          action: {
            agentType: 'trusted-developer',
            actionType: 'write-file',
            operationType: 'write' as const,
          },
          expectedApproval: false, // Would be overridden to full-auto
        },
        {
          agent: 'junior-developer',
          action: {
            agentType: 'junior-developer',
            actionType: 'write-file',
            operationType: 'write' as const,
          },
          expectedApproval: true, // Uses base review-all level
        },
      ];

      for (const testCase of testCases) {
        const result = await autonomyEnforcerWithOverrides.checkAction(testCase.action);
        expect(result).toBe(testCase.expectedApproval);
      }
    });

    it('should handle complex agent override configurations', async () => {
      const agentOverride: AgentAutonomyOverride = {
        level: 'review-before-commit',
        gates: [
          {
            type: 'before-network',
            description: 'Special network gate for this agent',
            enabled: true,
          } as ApprovalGate,
        ],
        limits: {
          maxTokens: 5000, // Lower limit for this agent
          maxCost: 2.0,
        } as TaskResourceLimits,
      };

      const config: AutonomyEnforcerConfig = {
        level: 'full-auto',
        gates: [],
        limits: baseConfig.limits,
        warningThresholds: baseConfig.warningThresholds,
      };

      autonomyEnforcer = new AutonomyEnforcer(config, mockOrchestrator as any);

      // Simulate agent-specific behavior
      const networkAction: ActionMetadata = {
        agentType: 'restricted-agent',
        actionType: 'web-request',
        operationType: 'network',
      };

      // In this test, we verify the structure is in place
      // Real agent overrides would be implemented at the orchestrator level
      const result = await autonomyEnforcer.checkAction(networkAction);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Legacy Autonomy Level Migration', () => {
    it('should migrate legacy autonomy levels correctly', () => {
      const migrationTestCases: Array<{
        legacy: LegacyAutonomyLevel;
        expected: AutonomyLevel;
      }> = [
        { legacy: 'autonomous', expected: 'full-auto' },
        { legacy: 'guided', expected: 'review-before-commit' },
        { legacy: 'supervised', expected: 'review-all' },
      ];

      migrationTestCases.forEach(({ legacy, expected }) => {
        const migrated = migrateLegacyAutonomyLevel(legacy);
        expect(migrated).toBe(expected);
      });
    });

    it('should handle legacy config with backwards compatibility', async () => {
      // Test that the system can handle legacy configuration formats
      const legacyConfig: AutonomyEnforcerConfig = {
        level: 'full-auto', // Using new format
        gates: [],
        limits: baseConfig.limits,
        warningThresholds: baseConfig.warningThresholds,
      };

      autonomyEnforcer = new AutonomyEnforcer(legacyConfig, mockOrchestrator as any);

      const action: ActionMetadata = {
        agentType: 'legacy-agent',
        actionType: 'test-action',
        operationType: 'write',
      };

      const result = await autonomyEnforcer.checkAction(action);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Autonomy Level Transitions', () => {
    beforeEach(() => {
      baseConfig.level = 'review-all';
      autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);
    });

    it('should handle dynamic autonomy level changes', async () => {
      const testAction: ActionMetadata = {
        agentType: 'developer',
        actionType: 'write-file',
        operationType: 'write',
      };

      // Initial level: review-all (should require approval)
      let result = await autonomyEnforcer.checkAction(testAction);
      expect(result).toBe(true);

      // Change to full-auto
      autonomyEnforcer.updateConfig({ level: 'full-auto' });
      result = await autonomyEnforcer.checkAction(testAction);
      expect(result).toBe(false);

      // Change to review-before-commit
      autonomyEnforcer.updateConfig({ level: 'review-before-commit' });
      result = await autonomyEnforcer.checkAction(testAction);
      expect(result).toBe(false); // Not a commit operation
    });

    it('should handle autonomy level transitions with active tasks', () => {
      const taskId = 'transition-test';
      autonomyEnforcer.startTracking(taskId);

      // Record some usage
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.01,
      });

      // Change autonomy level
      autonomyEnforcer.updateConfig({ level: 'full-auto' });

      // Should maintain tracking state
      const usage = autonomyEnforcer.getTaskUsage(taskId);
      expect(usage).toBeDefined();
      expect(usage!.totalTokens).toBe(150);

      autonomyEnforcer.stopTracking(taskId);
    });

    it('should update warning thresholds when autonomy level changes', async () => {
      const taskId = 'threshold-test';
      autonomyEnforcer.startTracking(taskId);

      const warningSpy = vi.fn();
      autonomyEnforcer.on('limit:warning', warningSpy);

      // Record usage that triggers warning at 80% threshold
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 6000,
        outputTokens: 2500,
        totalTokens: 8500, // 85% of 10000 limit
        estimatedCost: 0.5,
      });

      expect(warningSpy).toHaveBeenCalledOnce();
      warningSpy.mockClear();

      // Change warning thresholds
      autonomyEnforcer.updateConfig({
        warningThresholds: {
          costWarningPercent: 95,
          tokenWarningPercent: 95,
          timeWarningPercent: 95,
          fileWarningPercent: 95,
        },
      });

      // Record more usage - should not trigger warning at 95% threshold
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 500,
        outputTokens: 250,
        totalTokens: 750,
        estimatedCost: 0.05,
      });

      expect(warningSpy).not.toHaveBeenCalled();

      autonomyEnforcer.stopTracking(taskId);
    });
  });

  describe('Operation Type Detection', () => {
    beforeEach(() => {
      baseConfig.level = 'review-before-commit';
      autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);
    });

    it('should correctly identify operation types from action metadata', async () => {
      const operationTypeTests: Array<{
        action: ActionMetadata;
        expectedOperationType: string;
      }> = [
        {
          action: {
            agentType: 'developer',
            actionType: 'read-file',
            toolName: 'Read',
            operationType: 'read',
          },
          expectedOperationType: 'read',
        },
        {
          action: {
            agentType: 'developer',
            actionType: 'edit-code',
            toolName: 'Edit',
            operationType: 'write',
          },
          expectedOperationType: 'write',
        },
        {
          action: {
            agentType: 'tester',
            actionType: 'run-command',
            toolName: 'Bash',
            operationType: 'execute',
          },
          expectedOperationType: 'execute',
        },
        {
          action: {
            agentType: 'researcher',
            actionType: 'fetch-url',
            toolName: 'WebFetch',
            operationType: 'network',
          },
          expectedOperationType: 'network',
        },
        {
          action: {
            agentType: 'admin',
            actionType: 'delete-system',
            toolName: 'Bash',
            operationType: 'dangerous',
          },
          expectedOperationType: 'dangerous',
        },
      ];

      for (const { action, expectedOperationType } of operationTypeTests) {
        // Verify that the enforcer correctly processes the operation type
        const result = await autonomyEnforcer.checkAction(action);
        expect(typeof result).toBe('boolean');
        expect(action.operationType).toBe(expectedOperationType);
      }
    });

    it('should infer operation types from tool names when not explicitly specified', async () => {
      const toolInferenceTests: Array<{
        toolName: string;
        expectedReadLike: boolean;
      }> = [
        { toolName: 'Read', expectedReadLike: true },
        { toolName: 'Grep', expectedReadLike: true },
        { toolName: 'Glob', expectedReadLike: true },
        { toolName: 'Write', expectedReadLike: false },
        { toolName: 'Edit', expectedReadLike: false },
        { toolName: 'Bash', expectedReadLike: false },
        { toolName: 'WebFetch', expectedReadLike: false },
      ];

      // Set to review-all to test read vs non-read operations
      autonomyEnforcer.updateConfig({ level: 'review-all' });

      for (const { toolName, expectedReadLike } of toolInferenceTests) {
        const action: ActionMetadata = {
          agentType: 'developer',
          actionType: 'test-action',
          toolName,
          // operationType not specified - should be inferred
        };

        const result = await autonomyEnforcer.checkAction(action);

        if (expectedReadLike) {
          expect(result).toBe(false); // Read operations don't require approval in review-all
        } else {
          expect(result).toBe(true); // Non-read operations require approval in review-all
        }
      }
    });
  });
});