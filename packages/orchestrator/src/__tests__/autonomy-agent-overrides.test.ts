/**
 * Unit tests for per-agent autonomy overrides
 *
 * Tests verify that different agents can have different autonomy levels
 * and enforcement behaviors within the same orchestrator instance.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutonomyEnforcer, type AutonomyEnforcerConfig, type ActionMetadata } from '../autonomy-enforcer.js';
import { AutonomyLevel, type AutonomyLimits } from '@apexcli/core';

// Mock orchestrator for testing
const createMockOrchestrator = () => ({
  on: vi.fn(),
  emit: vi.fn(),
  store: {
    getTask: vi.fn(),
    addAuditLog: vi.fn().mockResolvedValue(undefined),
  },
});

describe('Agent Autonomy Overrides', () => {
  let mockOrchestrator: ReturnType<typeof createMockOrchestrator>;
  let baseConfig: AutonomyEnforcerConfig;

  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();

    baseConfig = {
      level: 'review-all' as AutonomyLevel,
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

  describe('Different Agent Autonomy Levels', () => {
    it('should simulate per-agent autonomy override behavior', async () => {
      // Since the current AutonomyEnforcer doesn't have built-in agent override support,
      // we'll simulate it by creating different enforcer instances for different agents

      // Developer agent has full autonomy
      const developerConfig = { ...baseConfig, level: 'full-auto' as AutonomyLevel };
      const developerEnforcer = new AutonomyEnforcer(developerConfig, mockOrchestrator as any);

      // Reviewer agent has review-before-commit
      const reviewerConfig = { ...baseConfig, level: 'review-before-commit' as AutonomyLevel };
      const reviewerEnforcer = new AutonomyEnforcer(reviewerConfig, mockOrchestrator as any);

      // Junior agent has review-all (strictest)
      const juniorConfig = { ...baseConfig, level: 'review-all' as AutonomyLevel };
      const juniorEnforcer = new AutonomyEnforcer(juniorConfig, mockOrchestrator as any);

      // Test same action across different agent types
      const writeAction: ActionMetadata = {
        agentType: 'developer',
        actionType: 'edit-file',
        toolName: 'Edit',
        operationType: 'write'
      };

      const commitAction: ActionMetadata = {
        agentType: 'developer',
        actionType: 'git-commit',
        toolName: 'Bash',
        operationType: 'execute'
      };

      // Developer (full-auto) - should allow both write and commit operations
      expect(await developerEnforcer.checkAction(writeAction)).toBe(false);
      expect(await developerEnforcer.checkAction(commitAction)).toBe(false);

      // Reviewer (review-before-commit) - should allow write but require approval for commit
      expect(await reviewerEnforcer.checkAction(writeAction)).toBe(false);
      expect(await reviewerEnforcer.checkAction(commitAction)).toBe(true);

      // Junior (review-all) - should require approval for write and commit
      expect(await juniorEnforcer.checkAction(writeAction)).toBe(true);
      expect(await juniorEnforcer.checkAction(commitAction)).toBe(true);
    });

    it('should emit different events based on agent-specific configurations', async () => {
      const seniorConfig = { ...baseConfig, level: 'full-auto' as AutonomyLevel };
      const juniorConfig = { ...baseConfig, level: 'review-all' as AutonomyLevel };

      const seniorEnforcer = new AutonomyEnforcer(seniorConfig, mockOrchestrator as any);
      const juniorEnforcer = new AutonomyEnforcer(juniorConfig, mockOrchestrator as any);

      const seniorEmitSpy = vi.spyOn(seniorEnforcer, 'emit');
      const juniorEmitSpy = vi.spyOn(juniorEnforcer, 'emit');

      const networkAction: ActionMetadata = {
        agentType: 'developer',
        actionType: 'fetch-data',
        toolName: 'WebFetch',
        operationType: 'network'
      };

      await seniorEnforcer.checkAction(networkAction);
      await juniorEnforcer.checkAction(networkAction);

      // Senior agent (full-auto) should not require approval
      expect(seniorEmitSpy).not.toHaveBeenCalledWith('approval:required', expect.anything(), expect.anything());

      // Junior agent (review-all) should require approval
      expect(juniorEmitSpy).toHaveBeenCalledWith('approval:required', 'review-all', expect.anything());
    });
  });

  describe('Agent-Specific Resource Limits', () => {
    it('should support different resource limits per agent type', () => {
      // Senior developers get higher limits
      const seniorLimits: AutonomyLimits = {
        maxTokensPerTask: 20000,
        maxCostPerTask: 10.00,
        maxTimePerTaskMs: 600000, // 10 minutes
      };

      // Junior developers get lower limits
      const juniorLimits: AutonomyLimits = {
        maxTokensPerTask: 5000,
        maxCostPerTask: 2.00,
        maxTimePerTaskMs: 180000, // 3 minutes
      };

      const seniorConfig = { ...baseConfig, limits: seniorLimits };
      const juniorConfig = { ...baseConfig, limits: juniorLimits };

      const seniorEnforcer = new AutonomyEnforcer(seniorConfig, mockOrchestrator as any);
      const juniorEnforcer = new AutonomyEnforcer(juniorConfig, mockOrchestrator as any);

      seniorEnforcer.startTracking('senior-task');
      juniorEnforcer.startTracking('junior-task');

      // Record usage that exceeds junior limits but not senior limits
      const usage = {
        totalTokens: 8000,
        estimatedCost: 3.50,
      };

      seniorEnforcer.recordUsage('senior-task', usage);
      juniorEnforcer.recordUsage('junior-task', usage);

      const seniorLimitCheck = seniorEnforcer.checkLimits('senior-task');
      const juniorLimitCheck = juniorEnforcer.checkLimits('junior-task');

      // Senior should be within limits
      expect(seniorLimitCheck.exceeded).toBe(false);

      // Junior should exceed limits
      expect(juniorLimitCheck.exceeded).toBe(true);
      expect(juniorLimitCheck.limitType).toBe('tokens');
    });

    it('should emit different warning thresholds for different agents', () => {
      const seniorThresholds = {
        costWarningPercent: 90, // More lenient warnings
        tokenWarningPercent: 90,
        timeWarningPercent: 90,
        fileWarningPercent: 90,
      };

      const juniorThresholds = {
        costWarningPercent: 70, // Earlier warnings
        tokenWarningPercent: 70,
        timeWarningPercent: 70,
        fileWarningPercent: 70,
      };

      const seniorConfig = {
        ...baseConfig,
        warningThresholds: seniorThresholds,
        limits: { maxTokensPerTask: 10000, maxCostPerTask: 5.00 } as AutonomyLimits,
      };

      const juniorConfig = {
        ...baseConfig,
        warningThresholds: juniorThresholds,
        limits: { maxTokensPerTask: 10000, maxCostPerTask: 5.00 } as AutonomyLimits,
      };

      const seniorEnforcer = new AutonomyEnforcer(seniorConfig, mockOrchestrator as any);
      const juniorEnforcer = new AutonomyEnforcer(juniorConfig, mockOrchestrator as any);

      const seniorEmitSpy = vi.spyOn(seniorEnforcer, 'emit');
      const juniorEmitSpy = vi.spyOn(juniorEnforcer, 'emit');

      seniorEnforcer.startTracking('senior-task');
      juniorEnforcer.startTracking('junior-task');

      // Usage at 80% of limits
      const usage = {
        totalTokens: 8000, // 80% of 10000
        estimatedCost: 4.00, // 80% of 5.00
      };

      seniorEnforcer.recordUsage('senior-task', usage);
      juniorEnforcer.recordUsage('junior-task', usage);

      // Senior (90% threshold) should not emit warnings at 80%
      expect(seniorEmitSpy).not.toHaveBeenCalledWith('limit:warning', expect.anything());

      // Junior (70% threshold) should emit warnings at 80%
      expect(juniorEmitSpy).toHaveBeenCalledWith(
        'limit:warning',
        expect.objectContaining({
          type: 'tokens',
          threshold: 70
        })
      );

      expect(juniorEmitSpy).toHaveBeenCalledWith(
        'limit:warning',
        expect.objectContaining({
          type: 'cost',
          threshold: 70
        })
      );
    });
  });

  describe('Agent-Specific Gate Configurations', () => {
    it('should support different gate configurations for different agents', async () => {
      // Senior developer has fewer gates
      const seniorConfig = {
        ...baseConfig,
        level: 'full-auto' as AutonomyLevel,
        gates: [
          { type: 'before-destructive', description: 'Review destructive operations', enabled: true }
        ]
      };

      // Junior developer has more restrictive gates
      const juniorConfig = {
        ...baseConfig,
        level: 'full-auto' as AutonomyLevel,
        gates: [
          { type: 'before-destructive', description: 'Review destructive operations', enabled: true },
          { type: 'before-network', description: 'Review network operations', enabled: true },
          { type: 'before-file-write', description: 'Review file modifications', enabled: true }
        ]
      };

      const seniorEnforcer = new AutonomyEnforcer(seniorConfig, mockOrchestrator as any);
      const juniorEnforcer = new AutonomyEnforcer(juniorConfig, mockOrchestrator as any);

      const actions = [
        {
          action: {
            agentType: 'developer',
            actionType: 'edit-file',
            toolName: 'Write',
            operationType: 'write'
          } as ActionMetadata,
          seniorNeedsApproval: false, // No gate for file writes
          juniorNeedsApproval: true   // Has gate for file writes
        },
        {
          action: {
            agentType: 'developer',
            actionType: 'fetch-data',
            toolName: 'WebFetch',
            operationType: 'network'
          } as ActionMetadata,
          seniorNeedsApproval: false, // No gate for network ops
          juniorNeedsApproval: true   // Has gate for network ops
        },
        {
          action: {
            agentType: 'developer',
            actionType: 'delete-files',
            operationType: 'dangerous'
          } as ActionMetadata,
          seniorNeedsApproval: true,  // Both have destructive gate
          juniorNeedsApproval: true
        }
      ];

      for (const { action, seniorNeedsApproval, juniorNeedsApproval } of actions) {
        const seniorResult = await seniorEnforcer.checkAction(action);
        const juniorResult = await juniorEnforcer.checkAction(action);

        expect(seniorResult).toBe(seniorNeedsApproval);
        expect(juniorResult).toBe(juniorNeedsApproval);
      }
    });
  });

  describe('Complex Agent Override Scenarios', () => {
    it('should handle mixed autonomy levels and gates correctly', async () => {
      // Create configurations for different agent types in a team
      const configurations = [
        {
          role: 'architect',
          config: {
            ...baseConfig,
            level: 'full-auto' as AutonomyLevel,
            gates: [] // Architects have no gates
          }
        },
        {
          role: 'senior-developer',
          config: {
            ...baseConfig,
            level: 'review-before-commit' as AutonomyLevel,
            gates: [
              { type: 'before-destructive', description: 'Review destructive ops', enabled: true }
            ]
          }
        },
        {
          role: 'junior-developer',
          config: {
            ...baseConfig,
            level: 'review-all' as AutonomyLevel,
            gates: [
              { type: 'before-destructive', description: 'Review destructive ops', enabled: true },
              { type: 'before-network', description: 'Review network ops', enabled: true }
            ]
          }
        }
      ];

      const enforcers = configurations.map(({ role, config }) => ({
        role,
        enforcer: new AutonomyEnforcer(config, mockOrchestrator as any)
      }));

      // Test various actions across all agent types
      const testActions = [
        {
          action: {
            agentType: 'test',
            actionType: 'read-file',
            operationType: 'read'
          } as ActionMetadata,
          expected: { architect: false, 'senior-developer': false, 'junior-developer': false }
        },
        {
          action: {
            agentType: 'test',
            actionType: 'edit-file',
            operationType: 'write'
          } as ActionMetadata,
          expected: { architect: false, 'senior-developer': false, 'junior-developer': true }
        },
        {
          action: {
            agentType: 'test',
            actionType: 'git-commit',
            operationType: 'execute'
          } as ActionMetadata,
          expected: { architect: false, 'senior-developer': true, 'junior-developer': true }
        },
        {
          action: {
            agentType: 'test',
            actionType: 'fetch-api',
            operationType: 'network'
          } as ActionMetadata,
          expected: { architect: false, 'senior-developer': false, 'junior-developer': true }
        },
        {
          action: {
            agentType: 'test',
            actionType: 'delete-database',
            operationType: 'dangerous'
          } as ActionMetadata,
          expected: { architect: false, 'senior-developer': true, 'junior-developer': true }
        }
      ];

      for (const { action, expected } of testActions) {
        for (const { role, enforcer } of enforcers) {
          const result = await enforcer.checkAction(action);
          expect(result).toBe((expected as any)[role]);
        }
      }
    });

    it('should maintain separate usage tracking for different agent configurations', () => {
      const architectConfig = {
        ...baseConfig,
        limits: {
          maxTokensPerTask: 50000, // Very high limits
          maxCostPerTask: 50.00,
          maxTimePerTaskMs: 3600000, // 1 hour
        } as AutonomyLimits
      };

      const juniorConfig = {
        ...baseConfig,
        limits: {
          maxTokensPerTask: 2000, // Very low limits
          maxCostPerTask: 1.00,
          maxTimePerTaskMs: 60000, // 1 minute
        } as AutonomyLimits
      };

      const architectEnforcer = new AutonomyEnforcer(architectConfig, mockOrchestrator as any);
      const juniorEnforcer = new AutonomyEnforcer(juniorConfig, mockOrchestrator as any);

      const architectEmitSpy = vi.spyOn(architectEnforcer, 'emit');
      const juniorEmitSpy = vi.spyOn(juniorEnforcer, 'emit');

      architectEnforcer.startTracking('architect-task');
      juniorEnforcer.startTracking('junior-task');

      // Record moderate usage
      const usage = {
        totalTokens: 3000,
        estimatedCost: 2.00,
      };

      architectEnforcer.recordUsage('architect-task', usage);
      juniorEnforcer.recordUsage('junior-task', usage);

      // Architect should not have any limit violations
      const architectLimitCheck = architectEnforcer.checkLimits('architect-task');
      expect(architectLimitCheck.exceeded).toBe(false);
      expect(architectEmitSpy).not.toHaveBeenCalledWith('limit:exceeded', expect.anything(), expect.anything());

      // Junior should exceed all limits
      const juniorLimitCheck = juniorEnforcer.checkLimits('junior-task');
      expect(juniorLimitCheck.exceeded).toBe(true);
      expect(juniorLimitCheck.limitType).toBe('tokens'); // First limit hit

      // Verify that the junior enforcer emitted limit exceeded events
      expect(juniorEmitSpy).toHaveBeenCalledWith(
        'limit:exceeded',
        expect.objectContaining({
          exceeded: true,
          limitType: 'tokens'
        }),
        expect.anything()
      );
    });
  });
});