/**
 * Edge cases and error scenarios for autonomy test fixtures
 *
 * This test suite focuses on testing boundary conditions, error handling,
 * and edge cases that might not be covered in the main test suite.
 */

import { describe, it, expect } from 'vitest';
import {
  AutonomyFixtures,
  createAutonomyConfig,
  createApprovalGate,
  createTaskResourceLimits,
  createAgentAutonomyOverride,
  createApexConfigWithAutonomy,
  getAutonomyConfigVariations,
  isValidAutonomyConfig,
} from '../autonomy-fixtures';
import {
  AutonomyConfigSchema,
  ApexConfigSchema,
  AutonomyLevel,
  RejectionBehavior,
} from '../../types';

describe('Autonomy Fixtures Edge Cases', () => {
  describe('Boundary value testing', () => {
    it('should handle minimum resource limits', () => {
      const config = createAutonomyConfig({
        limits: {
          maxTokensPerTask: 1, // Minimum possible
          maxCostPerTask: 0.01, // Very small cost
          timeoutMinutes: 1, // Minimum timeout
        }
      });

      expect(config.limits?.maxTokensPerTask).toBe(1);
      expect(config.limits?.maxCostPerTask).toBe(0.01);
      expect(config.limits?.timeoutMinutes).toBe(1);

      // Should still be valid
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });

    it('should handle maximum reasonable resource limits', () => {
      const config = createAutonomyConfig({
        limits: {
          maxTokensPerTask: Number.MAX_SAFE_INTEGER,
          maxCostPerTask: 999999.99,
          timeoutMinutes: 10080, // 1 week
        }
      });

      expect(config.limits?.maxTokensPerTask).toBe(Number.MAX_SAFE_INTEGER);
      expect(config.limits?.maxCostPerTask).toBe(999999.99);
      expect(config.limits?.timeoutMinutes).toBe(10080);

      // Should still be valid
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });

    it('should handle zero timeout for agent overrides', () => {
      const override = createAgentAutonomyOverride({
        approvalTimeout: 1, // Minimum allowed
      });

      expect(override.approvalTimeout).toBe(1);
    });
  });

  describe('Complex nested configurations', () => {
    it('should handle deep agent overrides with all possible fields', () => {
      const config = createAutonomyConfig({
        level: 'review-before-commit',
        rejectionBehavior: 'abort',
        agentOverrides: {
          planner: 'full-auto',
          developer: {
            level: 'review-all',
            approvalTimeout: 30,
            rejectionBehavior: 'skip',
            gates: [
              createApprovalGate({
                type: 'code_change',
                description: 'Review code changes from developer',
                required: true,
                stage: 'implementation',
              })
            ]
          },
          tester: {
            level: 'review-before-commit',
            approvalTimeout: 15,
            rejectionBehavior: 'abort',
          },
          reviewer: 'review-all',
        }
      });

      // Verify nested structure
      expect(config.agentOverrides?.planner).toBe('full-auto');
      expect(typeof config.agentOverrides?.developer).toBe('object');
      expect(config.agentOverrides?.reviewer).toBe('review-all');

      const developerOverride = config.agentOverrides?.developer;
      if (typeof developerOverride === 'object' && developerOverride !== null) {
        expect(developerOverride.level).toBe('review-all');
        expect(developerOverride.approvalTimeout).toBe(30);
        expect(developerOverride.rejectionBehavior).toBe('skip');
        expect(developerOverride.gates).toHaveLength(1);
        expect(developerOverride.gates?.[0].type).toBe('code_change');
      }

      // Should be valid
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });

    it('should handle all stage overrides with different levels', () => {
      const config = createAutonomyConfig({
        level: 'review-before-commit',
        stageOverrides: {
          planning: 'full-auto',
          architecture: 'review-before-commit',
          implementation: 'review-all',
          testing: 'full-auto',
          review: 'review-before-commit',
          deployment: 'review-all',
          monitoring: 'full-auto',
        }
      });

      expect(config.stageOverrides?.planning).toBe('full-auto');
      expect(config.stageOverrides?.architecture).toBe('review-before-commit');
      expect(config.stageOverrides?.implementation).toBe('review-all');
      expect(config.stageOverrides?.testing).toBe('full-auto');
      expect(config.stageOverrides?.review).toBe('review-before-commit');
      expect(config.stageOverrides?.deployment).toBe('review-all');
      expect(config.stageOverrides?.monitoring).toBe('full-auto');

      // Should be valid
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });
  });

  describe('Approval gates edge cases', () => {
    it('should handle gates with all possible types', () => {
      const gateTypes = ['planning', 'architecture', 'code_change', 'commit', 'deployment', 'merge'] as const;

      const gates = gateTypes.map(type => createApprovalGate({
        type,
        description: `${type} gate`,
        required: type !== 'code_change', // Make code_change optional
        stage: type === 'deployment' ? 'deployment' : 'implementation',
      }));

      const config = createAutonomyConfig({
        level: 'review-all',
        gates,
      });

      expect(config.gates).toHaveLength(gateTypes.length);
      expect(config.gates?.map(g => g.type)).toEqual(expect.arrayContaining(gateTypes));

      // Should be valid
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });

    it('should handle gate with minimal required fields only', () => {
      const gate = createApprovalGate({
        type: 'commit',
        // Only providing required fields, testing defaults
      });

      expect(gate.type).toBe('commit');
      expect(gate.description).toBe('Test approval gate'); // Default
      expect(gate.required).toBe(true); // Default
      expect(gate.stage).toBe('implementation'); // Default
    });

    it('should handle gate with all optional fields', () => {
      const gate = createApprovalGate({
        type: 'deployment',
        description: 'Custom deployment approval',
        required: false,
        stage: 'deployment',
      });

      expect(gate.type).toBe('deployment');
      expect(gate.description).toBe('Custom deployment approval');
      expect(gate.required).toBe(false);
      expect(gate.stage).toBe('deployment');
    });
  });

  describe('Factory function robustness', () => {
    it('should handle null and undefined in overrides gracefully', () => {
      // These should not break the factory functions
      expect(() => createAutonomyConfig({
        gates: undefined,
        limits: undefined,
        stageOverrides: undefined,
        agentOverrides: undefined,
      })).not.toThrow();

      expect(() => createApprovalGate({
        description: undefined,
        required: undefined,
        stage: undefined,
      })).not.toThrow();

      expect(() => createTaskResourceLimits({
        maxTokensPerTask: undefined,
        maxCostPerTask: undefined,
        timeoutMinutes: undefined,
      })).not.toThrow();
    });

    it('should preserve types when using factory functions', () => {
      const config = createAutonomyConfig({ level: 'full-auto' });

      // TypeScript should infer the correct types
      const level: AutonomyLevel = config.level;
      const rejectionBehavior: RejectionBehavior = config.rejectionBehavior!;

      expect(level).toBe('full-auto');
      expect(rejectionBehavior).toBe('abort');
    });

    it('should handle partial deep merges correctly', () => {
      const config = createAutonomyConfig({
        limits: { maxTokensPerTask: 999999 }
        // Other limit fields should get defaults
      });

      expect(config.limits?.maxTokensPerTask).toBe(999999);
      expect(config.limits?.maxCostPerTask).toBe(5.0); // Default
      expect(config.limits?.timeoutMinutes).toBe(30); // Default
    });
  });

  describe('APEX configuration edge cases', () => {
    it('should handle APEX config with complex nested overrides', () => {
      const config = createApexConfigWithAutonomy(
        {
          level: 'review-all',
          gates: [
            createApprovalGate({ type: 'planning', stage: 'planning' }),
            createApprovalGate({ type: 'commit', stage: 'implementation' }),
          ],
          stageOverrides: { testing: 'full-auto' },
          agentOverrides: { developer: 'review-before-commit' },
        },
        {
          project: { name: 'complex-test', language: 'rust' },
          git: { defaultBranch: 'develop', branchPrefix: 'feature/' },
          limits: { maxConcurrentTasks: 5, dailyBudget: 100.0 },
        }
      );

      // Verify autonomy config
      expect(config.autonomy?.level).toBe('review-all');
      expect(config.autonomy?.gates).toHaveLength(2);
      expect(config.autonomy?.stageOverrides?.testing).toBe('full-auto');
      expect(config.autonomy?.agentOverrides?.developer).toBe('review-before-commit');

      // Verify project config
      expect(config.project.name).toBe('complex-test');
      expect(config.project.language).toBe('rust');
      expect(config.git?.defaultBranch).toBe('develop');
      expect(config.git?.branchPrefix).toBe('feature/');
      expect(config.limits?.maxConcurrentTasks).toBe(5);
      expect(config.limits?.dailyBudget).toBe(100.0);

      // Should be valid
      expect(() => ApexConfigSchema.parse(config)).not.toThrow();
    });

    it('should handle empty autonomy config in APEX config', () => {
      const config = createApexConfigWithAutonomy({});

      expect(config.autonomy).toBeDefined();
      expect(config.autonomy?.level).toBe('review-before-commit'); // Default

      // Should be valid
      expect(() => ApexConfigSchema.parse(config)).not.toThrow();
    });
  });

  describe('Validation utility edge cases', () => {
    it('should handle edge cases in isValidAutonomyConfig', () => {
      // Test with objects that look like configs but aren't
      expect(isValidAutonomyConfig({ level: 'full-auto', invalid: 'field' })).toBe(true); // Extra fields OK
      expect(isValidAutonomyConfig({ level: 'full-auto', gates: null })).toBe(false); // gates should be array if present
      expect(isValidAutonomyConfig({ level: 'full-auto', limits: 'string' })).toBe(false); // limits should be object
      expect(isValidAutonomyConfig({ level: 'full-auto', stageOverrides: [] })).toBe(false); // should be object not array
      expect(isValidAutonomyConfig({ level: 'full-auto', agentOverrides: 'string' })).toBe(false); // should be object
    });

    it('should handle all valid autonomy levels', () => {
      const validLevels: AutonomyLevel[] = ['full-auto', 'review-before-commit', 'review-all'];

      validLevels.forEach(level => {
        expect(isValidAutonomyConfig({ level })).toBe(true);
      });
    });

    it('should handle all valid rejection behaviors', () => {
      const validBehaviors: RejectionBehavior[] = ['skip', 'abort'];

      validBehaviors.forEach(behavior => {
        expect(isValidAutonomyConfig({
          level: 'full-auto',
          rejectionBehavior: behavior
        })).toBe(true);
      });
    });
  });

  describe('Configuration variations stress test', () => {
    it('should generate distinct and valid variations', () => {
      const variations = getAutonomyConfigVariations();

      // Should have expected number of variations
      expect(Object.keys(variations)).toHaveLength(8);

      // Each should be valid and distinct
      const configs = Object.values(variations);
      configs.forEach(config => {
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
        expect(isValidAutonomyConfig(config)).toBe(true);
      });

      // Should have diversity in levels
      const levels = configs.map(c => c.level);
      expect(new Set(levels).size).toBeGreaterThan(1);

      // Should have diversity in configurations
      const hasGates = configs.some(c => c.gates && c.gates.length > 0);
      const hasStageOverrides = configs.some(c => c.stageOverrides && Object.keys(c.stageOverrides).length > 0);
      const hasAgentOverrides = configs.some(c => c.agentOverrides && Object.keys(c.agentOverrides).length > 0);

      expect(hasGates).toBe(true);
      expect(hasStageOverrides).toBe(true);
      expect(hasAgentOverrides).toBe(true);
    });
  });

  describe('Type safety and schema compliance', () => {
    it('should maintain strict type compliance with all fixtures', () => {
      // All fixtures should pass strict Zod validation
      Object.values(AutonomyFixtures).forEach(fixture => {
        expect(() => AutonomyConfigSchema.parse(fixture)).not.toThrow();
      });
    });

    it('should handle mixed agent override types', () => {
      const config = createAutonomyConfig({
        agentOverrides: {
          // String type override
          planner: 'full-auto' as AutonomyLevel,
          // Object type override
          developer: {
            level: 'review-all' as AutonomyLevel,
            approvalTimeout: 25,
            rejectionBehavior: 'skip' as RejectionBehavior,
          },
          // Another string type
          reviewer: 'review-before-commit' as AutonomyLevel,
        }
      });

      expect(config.agentOverrides?.planner).toBe('full-auto');
      expect(typeof config.agentOverrides?.developer).toBe('object');
      expect(config.agentOverrides?.reviewer).toBe('review-before-commit');

      // Should be valid
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });
  });

  describe('Performance and memory considerations', () => {
    it('should handle large number of gates without issues', () => {
      const manyGates = Array.from({ length: 100 }, (_, i) =>
        createApprovalGate({
          type: i % 2 === 0 ? 'commit' : 'code_change',
          description: `Gate ${i}`,
          required: i % 3 === 0,
          stage: i % 4 === 0 ? 'deployment' : 'implementation',
        })
      );

      const config = createAutonomyConfig({
        level: 'review-all',
        gates: manyGates,
      });

      expect(config.gates).toHaveLength(100);
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });

    it('should handle large number of stage and agent overrides', () => {
      const manyStageOverrides: Record<string, AutonomyLevel> = {};
      const manyAgentOverrides: Record<string, AutonomyLevel> = {};

      for (let i = 0; i < 50; i++) {
        manyStageOverrides[`stage_${i}`] = i % 3 === 0 ? 'full-auto' :
                                          i % 3 === 1 ? 'review-before-commit' : 'review-all';
        manyAgentOverrides[`agent_${i}`] = i % 2 === 0 ? 'full-auto' : 'review-all';
      }

      const config = createAutonomyConfig({
        level: 'review-before-commit',
        stageOverrides: manyStageOverrides,
        agentOverrides: manyAgentOverrides,
      });

      expect(Object.keys(config.stageOverrides || {})).toHaveLength(50);
      expect(Object.keys(config.agentOverrides || {})).toHaveLength(50);
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });
  });
});