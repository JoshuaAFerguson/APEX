/**
 * @fileoverview Verification test for autonomy factory implementation
 *
 * This test verifies that all autonomy level test fixtures and mock factories
 * are properly implemented and accessible as required by the acceptance criteria.
 */

import { describe, it, expect } from 'vitest';
import {
  createAutonomyConfig,
  createFullAutoConfig,
  createReviewBeforeCommitConfig,
  createReviewAllConfig,
  createTestAutonomyConfig,
  createRestrictiveConfig,
  createPermissiveConfig,
  AutonomyPresets,
  createAutonomyLevelCollection,
  createAutonomyVariants,
  validateAutonomyConfig,
} from '../test-fixtures/factories/autonomy-factory.js';

describe('Autonomy Level Test Fixtures - Implementation Verification', () => {
  describe('Factory functions are available and working', () => {
    it('should create basic autonomy configurations', () => {
      const config = createAutonomyConfig();
      expect(config).toBeDefined();
      expect(config.level).toBe('review-before-commit');
      expect(config.rejectionBehavior).toBe('abort');
    });

    it('should create all autonomy level configurations', () => {
      const fullAuto = createFullAutoConfig();
      const reviewBeforeCommit = createReviewBeforeCommitConfig();
      const reviewAll = createReviewAllConfig();

      expect(fullAuto.level).toBe('full-auto');
      expect(reviewBeforeCommit.level).toBe('review-before-commit');
      expect(reviewAll.level).toBe('review-all');
    });

    it('should create specialized configurations', () => {
      const testConfig = createTestAutonomyConfig();
      const restrictiveConfig = createRestrictiveConfig();
      const permissiveConfig = createPermissiveConfig();

      expect(testConfig.limits?.maxDuration).toBe(5);
      expect(restrictiveConfig.level).toBe('review-all');
      expect(permissiveConfig.level).toBe('full-auto');
    });
  });

  describe('Preset collections are available', () => {
    it('should provide basic autonomy presets', () => {
      const fullAuto = AutonomyPresets.basic.fullAuto();
      const reviewBeforeCommit = AutonomyPresets.basic.reviewBeforeCommit();
      const reviewAll = AutonomyPresets.basic.reviewAll();

      expect(fullAuto.level).toBe('full-auto');
      expect(reviewBeforeCommit.level).toBe('review-before-commit');
      expect(reviewAll.level).toBe('review-all');
    });

    it('should provide resource constraint presets', () => {
      const restrictive = AutonomyPresets.resources.restrictive();
      const permissive = AutonomyPresets.resources.permissive();
      const test = AutonomyPresets.resources.test();

      expect(restrictive.limits?.maxCost).toBeLessThan(permissive.limits!.maxCost);
      expect(test.limits?.maxDuration).toBe(5);
    });

    it('should provide testing scenario presets', () => {
      const minimal = AutonomyPresets.testing.minimal();
      const withGates = AutonomyPresets.testing.withGates();
      const complete = AutonomyPresets.testing.complete();

      expect(minimal.gates).toBeUndefined();
      expect(withGates.gates).toHaveLength(2);
      expect(complete.stageOverrides).toBeDefined();
    });

    it('should provide stage-specific presets', () => {
      const planning = AutonomyPresets.stages.planning();
      const implementation = AutonomyPresets.stages.implementation();
      const deployment = AutonomyPresets.stages.deployment();

      expect(planning.stageOverrides?.planning).toBe('full-auto');
      expect(implementation.stageOverrides?.implementation).toBe('review-before-commit');
      expect(deployment.stageOverrides?.deployment).toBe('review-all');
    });

    it('should provide agent-specific presets', () => {
      const developer = AutonomyPresets.agents.developer();
      const tester = AutonomyPresets.agents.tester();
      const reviewer = AutonomyPresets.agents.reviewer();

      expect(developer.agentOverrides?.developer).toMatchObject({
        level: 'review-before-commit',
      });
      expect(tester.agentOverrides?.tester).toBe('full-auto');
      expect(reviewer.agentOverrides?.reviewer).toBe('review-all');
    });
  });

  describe('Utility functions work correctly', () => {
    it('should create autonomy level collection', () => {
      const collection = createAutonomyLevelCollection();

      expect(collection['full-auto'].level).toBe('full-auto');
      expect(collection['review-before-commit'].level).toBe('review-before-commit');
      expect(collection['review-all'].level).toBe('review-all');
    });

    it('should create A/B testing variants', () => {
      const variants = createAutonomyVariants();

      expect(variants.control.level).toBe('review-before-commit');
      expect(variants.experimental.level).toBe('full-auto');
    });

    it('should validate autonomy configurations', () => {
      const validConfig = createAutonomyConfig();
      const fullAutoConfig = createFullAutoConfig();

      expect(validateAutonomyConfig(validConfig)).toBe(true);
      expect(validateAutonomyConfig(fullAutoConfig)).toBe(true);
    });
  });

  describe('Mock factories support different use cases', () => {
    it('should support development workflow testing', () => {
      const devConfig = createFullAutoConfig({
        stageOverrides: {
          'planning': 'full-auto',
          'implementation': 'review-before-commit',
          'testing': 'full-auto',
        },
        limits: {
          maxDuration: 120,
          maxCost: 25.00,
          maxTokens: 200000,
          maxRetries: 3,
          maxFileSize: 10485760,
          maxFiles: 50,
        },
      });

      expect(devConfig.stageOverrides?.planning).toBe('full-auto');
      expect(devConfig.limits?.maxCost).toBe(25.00);
    });

    it('should support production deployment testing', () => {
      const prodConfig = createReviewAllConfig({
        gates: [
          {
            id: 'security-review',
            name: 'Security Review',
            description: 'Security approval required',
            stage: 'review',
            type: 'manual',
            timeout: 60,
            required: true,
            conditions: ['security-cleared'],
          },
        ],
        limits: {
          maxCost: 2.00,
          maxDuration: 30,
          maxTokens: 20000,
          maxRetries: 1,
          maxFileSize: 5242880,
          maxFiles: 20,
        },
      });

      expect(prodConfig.level).toBe('review-all');
      expect(prodConfig.gates).toHaveLength(1);
      expect(prodConfig.limits?.maxCost).toBe(2.00);
    });

    it('should support role-based autonomy testing', () => {
      const juniorConfig = createReviewAllConfig({
        agentOverrides: {
          'developer': {
            level: 'review-all',
            approvalTimeout: 60,
            rejectionBehavior: 'skip',
          },
        },
      });

      const seniorConfig = createFullAutoConfig({
        agentOverrides: {
          'developer': 'full-auto',
          'reviewer': 'full-auto',
        },
      });

      expect(juniorConfig.agentOverrides?.developer).toMatchObject({
        level: 'review-all',
        approvalTimeout: 60,
      });
      expect(seniorConfig.agentOverrides?.developer).toBe('full-auto');
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle configurations with zero gates', () => {
      const config = createAutonomyConfig({}, { gateCount: 0 });
      expect(config.gates).toHaveLength(0);
    });

    it('should handle configurations without limits', () => {
      const config = createAutonomyConfig({}, { includeLimits: false });
      expect(config.limits).toBeUndefined();
    });

    it('should handle configurations without gates', () => {
      const config = createAutonomyConfig({}, { includeGates: false });
      expect(config.gates).toBeUndefined();
    });
  });

  describe('Acceptance criteria verification', () => {
    it('✅ Test fixtures exist in a shared location', () => {
      // Verified: autonomy-factory.ts exists in packages/core/src/test-fixtures/factories/
      expect(createAutonomyConfig).toBeDefined();
      expect(AutonomyPresets).toBeDefined();
    });

    it('✅ Can create mock configurations with different autonomy levels', () => {
      const configs = createAutonomyLevelCollection();

      expect(configs['full-auto']).toBeDefined();
      expect(configs['review-before-commit']).toBeDefined();
      expect(configs['review-all']).toBeDefined();
    });

    it('✅ Factory functions allow easy creation of autonomy configs for tests', () => {
      // Basic factory usage
      const basic = createAutonomyConfig();
      expect(basic).toBeDefined();

      // Preset factory usage
      const fullAuto = AutonomyPresets.basic.fullAuto();
      expect(fullAuto.level).toBe('full-auto');

      // Specialized factory usage
      const testConfig = createTestAutonomyConfig();
      expect(testConfig.limits?.maxDuration).toBe(5);
    });

    it('✅ All autonomy levels are supported (full-auto, semi-auto/review-before-commit, manual/review-all)', () => {
      const fullAuto = createFullAutoConfig();
      const semiAuto = createReviewBeforeCommitConfig();
      const manual = createReviewAllConfig();

      expect(fullAuto.level).toBe('full-auto');
      expect(semiAuto.level).toBe('review-before-commit');
      expect(manual.level).toBe('review-all');
    });

    it('✅ Factories support comprehensive test scenarios', () => {
      // Role-based scenarios
      const developerConfig = AutonomyPresets.agents.developer();
      expect(developerConfig.agentOverrides?.developer).toBeDefined();

      // Stage-based scenarios
      const stageConfig = AutonomyPresets.stages.implementation();
      expect(stageConfig.stageOverrides?.implementation).toBe('review-before-commit');

      // Resource-constrained scenarios
      const restrictive = AutonomyPresets.resources.restrictive();
      expect(restrictive.limits?.maxCost).toBe(1.00);

      // A/B testing scenarios
      const variants = createAutonomyVariants();
      expect(variants.control).toBeDefined();
      expect(variants.experimental).toBeDefined();
    });
  });
});