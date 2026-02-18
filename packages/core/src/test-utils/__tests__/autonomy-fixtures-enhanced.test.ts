/**
 * Tests for enhanced autonomy level test fixtures
 *
 * This test suite verifies the enhanced autonomy fixtures that provide
 * intuitive naming for different autonomy levels and comprehensive
 * factory functions for test scenarios.
 */

import { describe, it, expect, test } from 'vitest';
import type { AutonomyLevel, AutonomyConfig, ApexConfig } from '../../types.js';
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
} from '../autonomy-fixtures-enhanced.js';

describe('autonomy-fixtures-enhanced', () => {
  describe('AutonomyFixturesEnhanced', () => {
    describe('fullAuto()', () => {
      it('should create a full automation configuration', () => {
        const config = AutonomyFixturesEnhanced.fullAuto();

        expect(config.level).toBe('full-auto');
        expect(config.rejectionBehavior).toBe('abort');
        expect(config.gates).toEqual([]);
        expect(config.limits).toBeDefined();
        expect(config.limits!.maxTokensPerTask).toBe(1000000);
        expect(config.stageOverrides).toEqual({});
        expect(config.agentOverrides).toEqual({});
      });

      it('should have high resource limits for autonomous operation', () => {
        const config = AutonomyFixturesEnhanced.fullAuto();

        expect(config.limits!.maxCostPerTask).toBe(10.0);
        expect(config.limits!.timeoutMinutes).toBe(60);
      });
    });

    describe('semiAuto()', () => {
      it('should create a semi-automatic configuration', () => {
        const config = AutonomyFixturesEnhanced.semiAuto();

        expect(config.level).toBe('review-before-commit');
        expect(config.rejectionBehavior).toBe('abort');
        expect(config.gates).toHaveLength(1);
        expect(config.gates![0].type).toBe('commit');
        expect(config.gates![0].required).toBe(true);
      });

      it('should have moderate resource limits', () => {
        const config = AutonomyFixturesEnhanced.semiAuto();

        expect(config.limits!.maxTokensPerTask).toBe(500000);
        expect(config.limits!.maxCostPerTask).toBe(5.0);
        expect(config.limits!.timeoutMinutes).toBe(30);
      });
    });

    describe('manual()', () => {
      it('should create a manual configuration with all review gates', () => {
        const config = AutonomyFixturesEnhanced.manual();

        expect(config.level).toBe('review-all');
        expect(config.rejectionBehavior).toBe('skip');
        expect(config.gates).toHaveLength(4);

        const gateTypes = config.gates!.map(g => g.type);
        expect(gateTypes).toContain('planning');
        expect(gateTypes).toContain('code_change');
        expect(gateTypes).toContain('commit');
        expect(gateTypes).toContain('deployment');
      });

      it('should have conservative resource limits', () => {
        const config = AutonomyFixturesEnhanced.manual();

        expect(config.limits!.maxTokensPerTask).toBe(250000);
        expect(config.limits!.maxCostPerTask).toBe(2.5);
        expect(config.limits!.timeoutMinutes).toBe(15);
      });
    });

    describe('supervised()', () => {
      it('should create a supervised configuration with stage overrides', () => {
        const config = AutonomyFixturesEnhanced.supervised();

        expect(config.level).toBe('review-before-commit');
        expect(config.stageOverrides).toBeDefined();
        expect(config.stageOverrides!.planning).toBe('full-auto');
        expect(config.stageOverrides!.implementation).toBe('review-before-commit');
        expect(config.stageOverrides!.testing).toBe('full-auto');
        expect(config.stageOverrides!.deployment).toBe('review-all');
      });

      it('should have balanced resource limits', () => {
        const config = AutonomyFixturesEnhanced.supervised();

        expect(config.limits!.maxTokensPerTask).toBe(750000);
        expect(config.limits!.maxCostPerTask).toBe(7.5);
        expect(config.limits!.timeoutMinutes).toBe(45);
      });
    });

    describe('restrictive()', () => {
      it('should create a highly restrictive configuration', () => {
        const config = AutonomyFixturesEnhanced.restrictive();

        expect(config.level).toBe('review-all');
        expect(config.rejectionBehavior).toBe('abort');
        expect(config.gates).toHaveLength(4);
        expect(config.gates!.every(g => g.required)).toBe(true);

        // All stages should be review-all
        Object.values(config.stageOverrides!).forEach(level => {
          expect(level).toBe('review-all');
        });
      });

      it('should have very low resource limits', () => {
        const config = AutonomyFixturesEnhanced.restrictive();

        expect(config.limits!.maxTokensPerTask).toBe(100000);
        expect(config.limits!.maxCostPerTask).toBe(1.0);
        expect(config.limits!.timeoutMinutes).toBe(10);
      });
    });

    describe('permissive()', () => {
      it('should create a highly permissive configuration', () => {
        const config = AutonomyFixturesEnhanced.permissive();

        expect(config.level).toBe('full-auto');
        expect(config.rejectionBehavior).toBe('skip');
        expect(config.gates).toEqual([]);

        // Most stages should be full-auto, only deployment requires review
        expect(config.stageOverrides!.planning).toBe('full-auto');
        expect(config.stageOverrides!.implementation).toBe('full-auto');
        expect(config.stageOverrides!.testing).toBe('full-auto');
        expect(config.stageOverrides!.deployment).toBe('review-before-commit');
      });

      it('should have very high resource limits', () => {
        const config = AutonomyFixturesEnhanced.permissive();

        expect(config.limits!.maxTokensPerTask).toBe(2000000);
        expect(config.limits!.maxCostPerTask).toBe(20.0);
        expect(config.limits!.timeoutMinutes).toBe(120);
      });
    });
  });

  describe('Factory Functions', () => {
    describe('createFullAutoConfig()', () => {
      it('should create a full auto config with defaults', () => {
        const config = createFullAutoConfig();

        expect(config.level).toBe('full-auto');
        expect(config.gates).toEqual([]);
      });

      it('should apply overrides correctly', () => {
        const config = createFullAutoConfig({
          rejectionBehavior: 'skip',
          limits: { maxCostPerTask: 15.0 },
        });

        expect(config.rejectionBehavior).toBe('skip');
        expect(config.limits!.maxCostPerTask).toBe(15.0);
        // Other limits should be preserved
        expect(config.limits!.maxTokensPerTask).toBe(1000000);
      });
    });

    describe('createSemiAutoConfig()', () => {
      it('should create a semi-auto config with commit gate', () => {
        const config = createSemiAutoConfig();

        expect(config.level).toBe('review-before-commit');
        expect(config.gates).toHaveLength(1);
        expect(config.gates![0].type).toBe('commit');
      });

      it('should allow gate overrides', () => {
        const config = createSemiAutoConfig({
          gates: [],
        });

        expect(config.gates).toEqual([]);
      });
    });

    describe('createManualConfig()', () => {
      it('should create a manual config with all gates', () => {
        const config = createManualConfig();

        expect(config.level).toBe('review-all');
        expect(config.gates).toHaveLength(4);
      });

      it('should apply stage override customizations', () => {
        const config = createManualConfig({
          stageOverrides: { testing: 'full-auto' },
        });

        expect(config.stageOverrides!.testing).toBe('full-auto');
        // Should merge with existing overrides
        expect(config.stageOverrides!.planning).toBe('review-all');
      });
    });

    describe('createSupervisedConfig()', () => {
      it('should create a supervised config with mixed autonomy levels', () => {
        const config = createSupervisedConfig();

        expect(config.level).toBe('review-before-commit');
        expect(config.stageOverrides!.planning).toBe('full-auto');
        expect(config.stageOverrides!.deployment).toBe('review-all');
      });
    });

    describe('createRestrictiveConfig()', () => {
      it('should create a restrictive config', () => {
        const config = createRestrictiveConfig();

        expect(config.level).toBe('review-all');
        expect(config.limits!.maxCostPerTask).toBe(1.0);
      });
    });

    describe('createPermissiveConfig()', () => {
      it('should create a permissive config', () => {
        const config = createPermissiveConfig();

        expect(config.level).toBe('full-auto');
        expect(config.limits!.maxCostPerTask).toBe(20.0);
      });
    });

    describe('createTestingAutonomyConfig()', () => {
      test.each([
        ['fast', { maxTokens: 10000, maxCost: 0.50, timeout: 5 }],
        ['comprehensive', { maxTokens: 100000, maxCost: 2.0, timeout: 30 }],
        ['minimal', { maxTokens: 1000, maxCost: 0.10, timeout: 2 }],
        ['isolated', { maxTokens: 50000, maxCost: 1.0, timeout: 15 }],
      ])('should create %s testing config with appropriate limits', (scenario, expectedLimits) => {
        const config = createTestingAutonomyConfig(scenario as any);

        expect(config.limits!.maxTokensPerTask).toBe(expectedLimits.maxTokens);
        expect(config.limits!.maxCostPerTask).toBe(expectedLimits.maxCost);
        expect(config.limits!.timeoutMinutes).toBe(expectedLimits.timeout);
      });

      it('should apply overrides to testing configs', () => {
        const config = createTestingAutonomyConfig('fast', {
          rejectionBehavior: 'skip',
        });

        expect(config.rejectionBehavior).toBe('skip');
        expect(config.limits!.maxTokensPerTask).toBe(10000); // Base should be preserved
      });
    });

    describe('createApexConfigWithEnhancedAutonomy()', () => {
      test.each([
        'full-auto',
        'semi-auto',
        'manual',
        'supervised',
        'restrictive',
        'permissive',
      ])('should create APEX config with %s autonomy', (autonomyType) => {
        const config = createApexConfigWithEnhancedAutonomy(autonomyType as any);

        expect(config.version).toBe('1.0');
        expect(config.project.name).toBe('test-project');
        expect(config.autonomy).toBeDefined();
        expect(config.agents.enabled).toContain('planner');
        expect(config.agents.enabled).toContain('developer');
      });

      it('should apply config overrides correctly', () => {
        const config = createApexConfigWithEnhancedAutonomy('full-auto', {
          project: { name: 'custom-project', language: 'python' },
          api: { port: 4000 },
        });

        expect(config.project.name).toBe('custom-project');
        expect(config.project.language).toBe('python');
        expect(config.project.framework).toBe('nextjs'); // Should preserve non-overridden fields
        expect(config.api.port).toBe(4000);
        expect(config.api.host).toBe('localhost'); // Should preserve non-overridden fields
      });
    });
  });

  describe('Utility Functions', () => {
    describe('getAllAutonomyConfigVariations()', () => {
      it('should return all predefined autonomy variations', () => {
        const variations = getAllAutonomyConfigVariations();

        expect(variations).toHaveProperty('fullAuto');
        expect(variations).toHaveProperty('semiAuto');
        expect(variations).toHaveProperty('manual');
        expect(variations).toHaveProperty('supervised');
        expect(variations).toHaveProperty('restrictive');
        expect(variations).toHaveProperty('permissive');
        expect(variations).toHaveProperty('testFast');
        expect(variations).toHaveProperty('testComprehensive');
        expect(variations).toHaveProperty('testMinimal');
        expect(variations).toHaveProperty('testIsolated');

        // Verify each variation is a valid autonomy config
        Object.values(variations).forEach(config => {
          expect(validateEnhancedAutonomyConfig(config)).toBe(true);
        });
      });

      it('should have different autonomy levels across variations', () => {
        const variations = getAllAutonomyConfigVariations();

        expect(variations.fullAuto.level).toBe('full-auto');
        expect(variations.semiAuto.level).toBe('review-before-commit');
        expect(variations.manual.level).toBe('review-all');
      });
    });

    describe('validateEnhancedAutonomyConfig()', () => {
      it('should validate correct autonomy configs', () => {
        const validConfig = AutonomyFixturesEnhanced.semiAuto();

        expect(validateEnhancedAutonomyConfig(validConfig)).toBe(true);
      });

      it('should reject invalid autonomy configs', () => {
        const invalidConfigs = [
          null,
          undefined,
          {},
          { level: 'invalid-level' },
          { level: 'full-auto', rejectionBehavior: 'invalid' },
          { level: 'full-auto', gates: 'not-an-array' },
        ];

        invalidConfigs.forEach(config => {
          expect(validateEnhancedAutonomyConfig(config as any)).toBe(false);
        });
      });

      it('should handle configs with optional fields', () => {
        const minimalConfig = {
          level: 'full-auto' as AutonomyLevel,
          rejectionBehavior: 'abort' as const,
        };

        expect(validateEnhancedAutonomyConfig(minimalConfig as AutonomyConfig)).toBe(true);
      });
    });

    describe('createAutonomyABTestConfigs()', () => {
      it('should create A/B test configurations', () => {
        const configs = createAutonomyABTestConfigs();

        expect(configs.controlGroup.level).toBe('review-before-commit');
        expect(configs.testGroupA.level).toBe('full-auto');
        expect(configs.testGroupB.level).toBe('review-all');
      });

      it('should have different characteristics for each group', () => {
        const configs = createAutonomyABTestConfigs();

        // Control group should have moderate settings
        expect(configs.controlGroup.gates).toHaveLength(1);

        // Test group A should be fully automated
        expect(configs.testGroupA.gates).toEqual([]);

        // Test group B should have maximum oversight
        expect(configs.testGroupB.gates!.length).toBeGreaterThan(1);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should create configs that can be used together in test scenarios', () => {
      const fullAuto = createFullAutoConfig();
      const semiAuto = createSemiAutoConfig();
      const manual = createManualConfig();

      // Should all be valid configurations
      [fullAuto, semiAuto, manual].forEach(config => {
        expect(validateEnhancedAutonomyConfig(config)).toBe(true);
      });

      // Should have different levels of oversight
      expect(fullAuto.gates).toEqual([]);
      expect(semiAuto.gates).toHaveLength(1);
      expect(manual.gates!.length).toBeGreaterThan(1);
    });

    it('should support complex test scenarios with mixed configurations', () => {
      const supervisedConfig = createSupervisedConfig({
        stageOverrides: {
          planning: 'full-auto',
          implementation: 'review-before-commit',
          testing: 'full-auto',
          deployment: 'review-all',
        },
        agentOverrides: {
          developer: 'review-before-commit',
          tester: 'full-auto',
        },
      });

      expect(supervisedConfig.stageOverrides!.planning).toBe('full-auto');
      expect(supervisedConfig.stageOverrides!.implementation).toBe('review-before-commit');
      expect(supervisedConfig.stageOverrides!.deployment).toBe('review-all');
      expect(supervisedConfig.agentOverrides!.developer).toBe('review-before-commit');
      expect(supervisedConfig.agentOverrides!.tester).toBe('full-auto');
    });

    it('should work with existing autonomy fixtures', () => {
      // Import existing fixtures to ensure compatibility
      const { AutonomyFixtures } = require('../autonomy-fixtures.js');

      const existingFullAuto = AutonomyFixtures.fullAuto;
      const enhancedFullAuto = AutonomyFixturesEnhanced.fullAuto();

      // Both should have the same autonomy level
      expect(existingFullAuto.level).toBe(enhancedFullAuto.level);

      // Both should be valid
      expect(validateEnhancedAutonomyConfig(existingFullAuto)).toBe(true);
      expect(validateEnhancedAutonomyConfig(enhancedFullAuto)).toBe(true);
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for autonomy levels', () => {
      const configs = getAllAutonomyConfigVariations();

      Object.values(configs).forEach(config => {
        // TypeScript should enforce valid autonomy levels
        expect(['full-auto', 'review-before-commit', 'review-all']).toContain(config.level);
      });
    });

    it('should maintain type safety for rejection behaviors', () => {
      const configs = getAllAutonomyConfigVariations();

      Object.values(configs).forEach(config => {
        if (config.rejectionBehavior) {
          expect(['skip', 'abort']).toContain(config.rejectionBehavior);
        }
      });
    });
  });
});