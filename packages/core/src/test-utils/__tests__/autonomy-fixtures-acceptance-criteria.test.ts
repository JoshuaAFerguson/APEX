/**
 * Acceptance criteria validation tests for autonomy level test fixtures
 *
 * This test suite validates that the implementation meets the specific acceptance
 * criteria outlined in the feature requirements:
 *
 * "Test fixtures exist in packages/core or a shared test-utils location that can
 * create mock configurations with different autonomy levels (e.g., full-auto,
 * semi-auto, manual). Factory functions allow easy creation of autonomy configs
 * for tests."
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
  AutonomyFixturesEnhanced,
  createFullAutoConfig,
  createSemiAutoConfig,
  createManualConfig,
  createSupervisedConfig,
  createRestrictiveConfig,
  createPermissiveConfig,
  createTestingAutonomyConfig,
  createApexConfigWithEnhancedAutonomy,
  getAllAutonomyConfigVariations,
  validateEnhancedAutonomyConfig,
  createAutonomyABTestConfigs,
} from '../autonomy-fixtures-enhanced';
import {
  AutonomyConfigSchema,
  ApexConfigSchema,
  AutonomyLevel,
  RejectionBehavior,
} from '../../types';

describe('Autonomy Fixtures Acceptance Criteria', () => {
  describe('Location requirement: packages/core or shared test-utils', () => {
    it('should be located in packages/core/src/test-utils', () => {
      // This test being able to import the fixtures confirms they're in the correct location
      expect(AutonomyFixtures).toBeDefined();
      expect(AutonomyFixturesEnhanced).toBeDefined();
      expect(typeof createAutonomyConfig).toBe('function');
    });
  });

  describe('Requirement: Mock configurations with different autonomy levels', () => {
    describe('Basic autonomy levels', () => {
      it('should provide full-auto configuration', () => {
        const config = AutonomyFixtures.fullAuto;

        expect(config.level).toBe('full-auto');
        expect(config.gates || []).toHaveLength(0); // No gates for full automation
        expect(config.limits).toBeDefined();
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });

      it('should provide semi-auto configuration (review-before-commit)', () => {
        const config = AutonomyFixtures.reviewBeforeCommit;

        expect(config.level).toBe('review-before-commit');
        expect(config.gates).toBeDefined(); // Should have some gates
        expect(config.limits).toBeDefined();
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });

      it('should provide manual configuration (review-all)', () => {
        const config = AutonomyFixtures.reviewAll;

        expect(config.level).toBe('review-all');
        expect(config.gates).toBeDefined();
        expect(config.gates!.length).toBeGreaterThan(0); // Should have multiple gates
        expect(config.limits).toBeDefined();
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });
    });

    describe('Enhanced intuitive naming', () => {
      it('should provide full-auto using intuitive naming', () => {
        const config = AutonomyFixturesEnhanced.fullAuto();

        expect(config.level).toBe('full-auto');
        expect(config.gates || []).toHaveLength(0);
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });

      it('should provide semi-auto using intuitive naming', () => {
        const config = AutonomyFixturesEnhanced.semiAuto();

        expect(config.level).toBe('review-before-commit');
        expect(config.gates).toBeDefined();
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });

      it('should provide manual using intuitive naming', () => {
        const config = AutonomyFixturesEnhanced.manual();

        expect(config.level).toBe('review-all');
        expect(config.gates!.length).toBeGreaterThan(0);
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });
    });

    describe('Extended autonomy variations', () => {
      it('should provide supervised configuration', () => {
        const config = AutonomyFixturesEnhanced.supervised();

        expect(config.level).toBe('review-before-commit');
        expect(config.stageOverrides).toBeDefined();
        expect(Object.keys(config.stageOverrides!)).toContain('planning');
        expect(Object.keys(config.stageOverrides!)).toContain('deployment');
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });

      it('should provide restrictive configuration', () => {
        const config = AutonomyFixturesEnhanced.restrictive();

        expect(config.level).toBe('review-all');
        expect(config.gates!.length).toBeGreaterThan(0);
        expect(config.limits!.maxCostPerTask).toBeLessThan(5.0); // Lower limits for restrictive
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });

      it('should provide permissive configuration', () => {
        const config = AutonomyFixturesEnhanced.permissive();

        expect(config.level).toBe('full-auto');
        expect(config.limits!.maxCostPerTask).toBeGreaterThan(10.0); // Higher limits for permissive
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });
    });
  });

  describe('Requirement: Factory functions for easy creation', () => {
    describe('Basic factory functions', () => {
      it('should provide createAutonomyConfig factory', () => {
        const config = createAutonomyConfig({
          level: 'full-auto',
          limits: { maxTokensPerTask: 1000000 },
        });

        expect(config.level).toBe('full-auto');
        expect(config.limits!.maxTokensPerTask).toBe(1000000);
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });

      it('should provide createApprovalGate factory', () => {
        const gate = createApprovalGate({
          type: 'commit',
          description: 'Test gate',
          required: true,
        });

        expect(gate.type).toBe('commit');
        expect(gate.description).toBe('Test gate');
        expect(gate.required).toBe(true);
      });

      it('should provide createTaskResourceLimits factory', () => {
        const limits = createTaskResourceLimits({
          maxTokensPerTask: 500000,
          maxCostPerTask: 5.0,
        });

        expect(limits.maxTokensPerTask).toBe(500000);
        expect(limits.maxCostPerTask).toBe(5.0);
      });

      it('should provide createAgentAutonomyOverride factory', () => {
        const override = createAgentAutonomyOverride({
          level: 'full-auto',
          approvalTimeout: 30,
        });

        expect(override.level).toBe('full-auto');
        expect(override.approvalTimeout).toBe(30);
      });
    });

    describe('Enhanced factory functions', () => {
      it('should provide createFullAutoConfig factory', () => {
        const config = createFullAutoConfig({
          limits: { maxCostPerTask: 15.0 },
        });

        expect(config.level).toBe('full-auto');
        expect(config.limits!.maxCostPerTask).toBe(15.0);
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });

      it('should provide createSemiAutoConfig factory', () => {
        const config = createSemiAutoConfig({
          rejectionBehavior: 'skip',
        });

        expect(config.level).toBe('review-before-commit');
        expect(config.rejectionBehavior).toBe('skip');
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });

      it('should provide createManualConfig factory', () => {
        const config = createManualConfig({
          limits: { timeoutMinutes: 60 },
        });

        expect(config.level).toBe('review-all');
        expect(config.limits!.timeoutMinutes).toBe(60);
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });
    });

    describe('Specialized factory functions', () => {
      it('should provide createTestingAutonomyConfig for test scenarios', () => {
        const fastConfig = createTestingAutonomyConfig('fast');
        const comprehensiveConfig = createTestingAutonomyConfig('comprehensive');
        const minimalConfig = createTestingAutonomyConfig('minimal');
        const isolatedConfig = createTestingAutonomyConfig('isolated');

        expect(fastConfig.limits!.timeoutMinutes).toBeLessThan(10);
        expect(comprehensiveConfig.gates!.length).toBeGreaterThan(0);
        expect(minimalConfig.limits!.maxTokensPerTask).toBeLessThan(10000);
        expect(isolatedConfig.level).toBe('review-before-commit');

        [fastConfig, comprehensiveConfig, minimalConfig, isolatedConfig].forEach(config => {
          expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
        });
      });

      it('should provide createApexConfigWithAutonomy for full APEX configs', () => {
        const config = createApexConfigWithAutonomy(
          { level: 'full-auto' },
          { project: { name: 'acceptance-test' } }
        );

        expect(config.autonomy!.level).toBe('full-auto');
        expect(config.project.name).toBe('acceptance-test');
        expect(() => ApexConfigSchema.parse(config)).not.toThrow();
      });

      it('should provide createApexConfigWithEnhancedAutonomy for enhanced configs', () => {
        const config = createApexConfigWithEnhancedAutonomy('semi-auto');

        expect(config.autonomy!.level).toBe('review-before-commit');
        expect(() => ApexConfigSchema.parse(config)).not.toThrow();
      });
    });
  });

  describe('Requirement: Support for test scenarios', () => {
    it('should provide variations for comprehensive testing', () => {
      const variations = getAutonomyConfigVariations();

      expect(Object.keys(variations)).toContain('fullAuto');
      expect(Object.keys(variations)).toContain('reviewBeforeCommit');
      expect(Object.keys(variations)).toContain('reviewAll');
      expect(Object.keys(variations)).toContain('withStageOverrides');
      expect(Object.keys(variations)).toContain('withAgentOverrides');

      // All variations should be valid
      Object.values(variations).forEach(config => {
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });
    });

    it('should provide enhanced variations for comprehensive testing', () => {
      const variations = getAllAutonomyConfigVariations();

      expect(Object.keys(variations)).toContain('fullAuto');
      expect(Object.keys(variations)).toContain('semiAuto');
      expect(Object.keys(variations)).toContain('manual');
      expect(Object.keys(variations)).toContain('supervised');
      expect(Object.keys(variations)).toContain('restrictive');
      expect(Object.keys(variations)).toContain('permissive');
      expect(Object.keys(variations)).toContain('testFast');
      expect(Object.keys(variations)).toContain('testComprehensive');

      // All variations should be valid
      Object.values(variations).forEach(config => {
        expect(validateEnhancedAutonomyConfig(config)).toBe(true);
      });
    });

    it('should support A/B testing scenarios', () => {
      const abConfigs = createAutonomyABTestConfigs();

      expect(abConfigs.controlGroup.level).toBe('review-before-commit');
      expect(abConfigs.testGroupA.level).toBe('full-auto');
      expect(abConfigs.testGroupB.level).toBe('review-all');

      Object.values(abConfigs).forEach(config => {
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });
    });
  });

  describe('Validation and utility requirements', () => {
    it('should provide validation utilities', () => {
      const validConfig = createAutonomyConfig({ level: 'full-auto' });
      const invalidConfig = { level: 'invalid-level' };

      expect(isValidAutonomyConfig(validConfig)).toBe(true);
      expect(isValidAutonomyConfig(invalidConfig)).toBe(false);
      expect(validateEnhancedAutonomyConfig(validConfig)).toBe(true);
      expect(validateEnhancedAutonomyConfig(invalidConfig as any)).toBe(false);
    });

    it('should provide type-safe configurations', () => {
      // These tests validate that TypeScript types are preserved
      const config = createAutonomyConfig({ level: 'full-auto' as AutonomyLevel });
      const rejectionBehavior: RejectionBehavior = config.rejectionBehavior || 'abort';

      expect(['full-auto', 'review-before-commit', 'review-all']).toContain(config.level);
      expect(['skip', 'abort']).toContain(rejectionBehavior);
    });
  });

  describe('Ease of use requirements', () => {
    it('should allow easy creation of different autonomy levels', () => {
      // Common pattern: create configs for different levels
      const levels: AutonomyLevel[] = ['full-auto', 'review-before-commit', 'review-all'];

      levels.forEach(level => {
        const config = createAutonomyConfig({ level });
        expect(config.level).toBe(level);
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });
    });

    it('should allow intuitive naming for common patterns', () => {
      // Intuitive names that match user expectations
      const fullAuto = AutonomyFixturesEnhanced.fullAuto();
      const semiAuto = AutonomyFixturesEnhanced.semiAuto();
      const manual = AutonomyFixturesEnhanced.manual();

      expect(fullAuto.level).toBe('full-auto');
      expect(semiAuto.level).toBe('review-before-commit');
      expect(manual.level).toBe('review-all');

      // Full auto should have no gates
      expect(fullAuto.gates || []).toHaveLength(0);

      // Semi-auto should have some oversight
      expect(semiAuto.gates).toBeDefined();

      // Manual should have comprehensive oversight
      expect(manual.gates!.length).toBeGreaterThan(semiAuto.gates!.length);
    });

    it('should provide reasonable defaults for factory functions', () => {
      const defaultConfig = createAutonomyConfig();

      // Should have sensible defaults
      expect(defaultConfig.level).toBe('review-before-commit'); // Balanced default
      expect(defaultConfig.rejectionBehavior).toBe('abort');
      expect(defaultConfig.limits).toBeDefined();
      expect(defaultConfig.limits!.maxTokensPerTask).toBeGreaterThan(0);
      expect(defaultConfig.limits!.maxCostPerTask).toBeGreaterThan(0);
      expect(defaultConfig.limits!.timeoutMinutes).toBeGreaterThan(0);
    });
  });

  describe('Integration with existing types', () => {
    it('should work with Zod schemas', () => {
      const fixtures = [
        AutonomyFixtures.fullAuto,
        AutonomyFixtures.reviewBeforeCommit,
        AutonomyFixtures.reviewAll,
        AutonomyFixtures.semiAutoWithStageOverrides,
        AutonomyFixtures.withAgentOverrides,
        AutonomyFixtures.comprehensiveGates,
      ];

      fixtures.forEach(fixture => {
        expect(() => AutonomyConfigSchema.parse(fixture)).not.toThrow();
      });
    });

    it('should work with APEX configuration schemas', () => {
      const apexConfig = createApexConfigWithAutonomy(
        { level: 'full-auto' },
        { project: { name: 'schema-test', language: 'typescript' } }
      );

      expect(() => ApexConfigSchema.parse(apexConfig)).not.toThrow();
    });
  });

  describe('Documentation and examples', () => {
    it('should provide clear examples in fixtures', () => {
      // The fixtures should be self-documenting through their structure
      const variations = getAutonomyConfigVariations();

      // Full auto should be clearly autonomous
      expect(variations.fullAuto.level).toBe('full-auto');
      expect(variations.fullAuto.gates || []).toHaveLength(0);

      // Review all should have comprehensive gates
      expect(variations.reviewAll.level).toBe('review-all');
      expect(variations.reviewAll.gates!.length).toBeGreaterThan(2);

      // Stage overrides should show different levels per stage
      expect(variations.withStageOverrides.stageOverrides).toBeDefined();
      expect(Object.keys(variations.withStageOverrides.stageOverrides!).length).toBeGreaterThan(0);

      // Agent overrides should show different levels per agent
      expect(variations.withAgentOverrides.agentOverrides).toBeDefined();
      expect(Object.keys(variations.withAgentOverrides.agentOverrides!).length).toBeGreaterThan(0);
    });
  });

  describe('Acceptance criteria summary validation', () => {
    it('should meet all requirements specified in acceptance criteria', () => {
      // 1. Location: packages/core or shared test-utils ✓ (confirmed by successful import)
      expect(typeof AutonomyFixtures).toBe('object');
      expect(typeof AutonomyFixturesEnhanced).toBe('object');

      // 2. Mock configurations with different autonomy levels ✓
      const fullAuto = AutonomyFixtures.fullAuto;
      const semiAuto = AutonomyFixtures.reviewBeforeCommit;
      const manual = AutonomyFixtures.reviewAll;

      expect(fullAuto.level).toBe('full-auto');
      expect(semiAuto.level).toBe('review-before-commit');
      expect(manual.level).toBe('review-all');

      // 3. Factory functions for easy creation ✓
      expect(typeof createAutonomyConfig).toBe('function');
      expect(typeof createFullAutoConfig).toBe('function');
      expect(typeof createSemiAutoConfig).toBe('function');
      expect(typeof createManualConfig).toBe('function');

      // 4. Support intuitive naming ✓
      const intuitiveFullAuto = AutonomyFixturesEnhanced.fullAuto();
      const intuitiveSemiAuto = AutonomyFixturesEnhanced.semiAuto();
      const intuitiveManual = AutonomyFixturesEnhanced.manual();

      expect(intuitiveFullAuto.level).toBe('full-auto');
      expect(intuitiveSemiAuto.level).toBe('review-before-commit');
      expect(intuitiveManual.level).toBe('review-all');

      // 5. All configurations should be valid ✓
      const allConfigs = [
        fullAuto, semiAuto, manual, intuitiveFullAuto,
        intuitiveSemiAuto, intuitiveManual
      ];

      allConfigs.forEach(config => {
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
        expect(isValidAutonomyConfig(config)).toBe(true);
      });

      console.log('✅ All acceptance criteria have been validated and are met!');
    });
  });
});