/**
 * Example usage patterns for autonomy test fixtures
 *
 * This test demonstrates common patterns for using the autonomy fixtures
 * in actual test scenarios, serving as both validation and documentation.
 */

import { describe, it, expect } from 'vitest';
import {
  AutonomyFixtures,
  createAutonomyConfig,
  createApexConfigWithAutonomy,
  getAutonomyConfigVariations,
} from '../autonomy-fixtures';
import { AutonomyConfigSchema } from '../../types';

describe('Autonomy Fixtures Usage Examples', () => {
  describe('Testing feature across all autonomy levels', () => {
    const autonomyLevels = ['full-auto', 'review-before-commit', 'review-all'] as const;

    autonomyLevels.forEach(level => {
      it(`should work with ${level} autonomy`, () => {
        const config = createAutonomyConfig({ level });

        // Example: Test that a feature respects autonomy level
        expect(config.level).toBe(level);

        // Validate the config is well-formed
        const result = AutonomyConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Testing with pre-built fixtures', () => {
    const fixtures = [
      { name: 'fullAuto', config: AutonomyFixtures.fullAuto },
      { name: 'reviewBeforeCommit', config: AutonomyFixtures.reviewBeforeCommit },
      { name: 'reviewAll', config: AutonomyFixtures.reviewAll },
    ];

    fixtures.forEach(({ name, config }) => {
      it(`should work with ${name} fixture`, () => {
        // Example: Test that approval gates are respected
        const hasApprovalGates = config.gates && config.gates.length > 0;

        if (config.level === 'full-auto') {
          expect(hasApprovalGates).toBe(false);
        } else {
          // Other levels may or may not have gates depending on the fixture
          expect(typeof hasApprovalGates).toBe('boolean');
        }

        // Validate the fixture is well-formed
        const result = AutonomyConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Testing with custom configurations', () => {
    it('should handle high-resource scenarios', () => {
      const config = createAutonomyConfig({
        level: 'full-auto',
        limits: {
          maxTokensPerTask: 2000000,
          maxCostPerTask: 20.0,
          timeoutMinutes: 120,
        }
      });

      // Example: Test resource limits are respected
      expect(config.limits?.maxTokensPerTask).toBe(2000000);
      expect(config.limits?.maxCostPerTask).toBe(20.0);
      expect(config.limits?.timeoutMinutes).toBe(120);

      // Validate configuration
      const result = AutonomyConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should handle stage-specific autonomy overrides', () => {
      const config = createAutonomyConfig({
        level: 'review-before-commit',
        stageOverrides: {
          planning: 'full-auto',
          implementation: 'review-before-commit',
          testing: 'review-all',
        }
      });

      // Example: Test stage overrides work correctly
      expect(config.stageOverrides?.planning).toBe('full-auto');
      expect(config.stageOverrides?.implementation).toBe('review-before-commit');
      expect(config.stageOverrides?.testing).toBe('review-all');

      // Validate configuration
      const result = AutonomyConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should handle agent-specific autonomy overrides', () => {
      const config = createAutonomyConfig({
        level: 'review-before-commit',
        agentOverrides: {
          developer: 'full-auto',
          tester: {
            level: 'review-all',
            approvalTimeout: 5,
            rejectionBehavior: 'skip',
          }
        }
      });

      // Example: Test agent overrides work correctly
      expect(config.agentOverrides?.developer).toBe('full-auto');
      expect(typeof config.agentOverrides?.tester).toBe('object');

      const testerOverride = config.agentOverrides?.tester;
      if (typeof testerOverride === 'object' && testerOverride !== null) {
        expect(testerOverride.level).toBe('review-all');
        expect(testerOverride.approvalTimeout).toBe(5);
        expect(testerOverride.rejectionBehavior).toBe('skip');
      }

      // Validate configuration
      const result = AutonomyConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('Integration testing with complete APEX configs', () => {
    it('should create valid APEX config with autonomy settings', () => {
      const config = createApexConfigWithAutonomy(
        { level: 'review-before-commit' },
        {
          project: {
            name: 'test-integration',
            language: 'typescript'
          }
        }
      );

      // Example: Test integration between autonomy and project config
      expect(config.project.name).toBe('test-integration');
      expect(config.project.language).toBe('typescript');
      expect(config.autonomy?.level).toBe('review-before-commit');

      // Should have defaults for other fields
      expect(config.version).toBe('1.0');
      expect(config.git?.branchPrefix).toBe('apex/');
      expect(config.api?.port).toBe(3000);
    });

    it('should preserve defaults when using partial overrides', () => {
      const config = createApexConfigWithAutonomy(
        {
          level: 'full-auto',
          limits: { maxTokensPerTask: 1500000 }
        },
        {
          limits: { maxCostPerTask: 15.0 }
        }
      );

      // Example: Test that deep merging works correctly
      expect(config.autonomy?.level).toBe('full-auto');
      expect(config.autonomy?.limits?.maxTokensPerTask).toBe(1500000);
      expect(config.limits?.maxCostPerTask).toBe(15.0);

      // Should preserve other defaults
      expect(config.limits?.maxConcurrentTasks).toBe(1);
      expect(config.autonomy?.limits?.timeoutMinutes).toBe(30);
    });
  });

  describe('Comprehensive configuration testing', () => {
    it('should test all configuration variations', () => {
      const variations = getAutonomyConfigVariations();

      // Example: Test a feature against all provided variations
      Object.entries(variations).forEach(([name, config]) => {
        // Each variation should be valid
        const result = AutonomyConfigSchema.safeParse(config);
        expect(result.success).toBe(true);

        // Example: Test specific behaviors based on configuration
        if (config.level === 'full-auto') {
          // Full auto should have minimal restrictions
          expect(config.gates?.length || 0).toBe(0);
        }

        if (config.level === 'review-all') {
          // Review all might have multiple gates (depending on variation)
          expect(config.rejectionBehavior).toBeDefined();
        }
      });

      // Should have both pre-built fixtures and custom variations
      expect(variations.fullAuto).toBeDefined();
      expect(variations.customMinimal).toBeDefined();
      expect(variations.customStrict).toBeDefined();
    });
  });

  describe('Error handling and validation', () => {
    it('should validate configurations properly', () => {
      // Valid configurations should pass
      const validConfigs = [
        AutonomyFixtures.fullAuto,
        AutonomyFixtures.reviewBeforeCommit,
        createAutonomyConfig(),
        createAutonomyConfig({ level: 'review-all' }),
      ];

      validConfigs.forEach(config => {
        const result = AutonomyConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    it('should handle edge cases gracefully', () => {
      // Empty overrides should work
      expect(() => createAutonomyConfig({})).not.toThrow();

      // Partial overrides should work
      expect(() => createAutonomyConfig({
        level: 'full-auto'
      })).not.toThrow();

      // Deep partial overrides should work
      expect(() => createAutonomyConfig({
        limits: { maxTokensPerTask: 999999 }
      })).not.toThrow();
    });
  });

  describe('Real-world usage patterns', () => {
    it('should support parameterized testing', () => {
      // Example: Testing a function that behaves differently based on autonomy level
      function mockFeatureBehavior(config: typeof AutonomyFixtures.fullAuto) {
        switch (config.level) {
          case 'full-auto':
            return 'automated';
          case 'review-before-commit':
            return 'semi-automated';
          case 'review-all':
            return 'manual';
          default:
            return 'unknown';
        }
      }

      // Test with different fixtures
      expect(mockFeatureBehavior(AutonomyFixtures.fullAuto)).toBe('automated');
      expect(mockFeatureBehavior(AutonomyFixtures.reviewBeforeCommit)).toBe('semi-automated');
      expect(mockFeatureBehavior(AutonomyFixtures.reviewAll)).toBe('manual');
    });

    it('should support testing resource limit enforcement', () => {
      const strictConfig = createAutonomyConfig({
        limits: {
          maxTokensPerTask: 10000,
          maxCostPerTask: 0.5,
          timeoutMinutes: 5,
        }
      });

      // Example: Test that limits are properly enforced
      function mockResourceCheck(config: typeof strictConfig) {
        const limits = config.limits;
        if (!limits) return false;

        return limits.maxTokensPerTask <= 50000 &&
               limits.maxCostPerTask <= 1.0 &&
               limits.timeoutMinutes <= 10;
      }

      expect(mockResourceCheck(strictConfig)).toBe(true);
      expect(mockResourceCheck(AutonomyFixtures.fullAuto)).toBe(false); // High limits
    });
  });
});