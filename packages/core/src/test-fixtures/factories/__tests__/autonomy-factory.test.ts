/**
 * @fileoverview Tests for autonomy configuration factory functions
 *
 * Comprehensive test suite for autonomy-related fixture factories.
 */

import { describe, it, expect } from 'vitest';
import type { AutonomyLevel, AutonomyConfig, AgentAutonomyOverride } from '../../../types.js';
import {
  createAutonomyConfig,
  createAgentAutonomyOverride,
  createApprovalGate,
  createResourceLimits,
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
} from '../autonomy-factory.js';

describe('autonomy-factory', () => {
  describe('createAutonomyConfig', () => {
    it('should create a basic autonomy config with defaults', () => {
      const config = createAutonomyConfig();

      expect(config.level).toBe('review-before-commit');
      expect(config.rejectionBehavior).toBe('abort');
      expect(config.gates).toBeDefined();
      expect(config.gates).toHaveLength(2);
      expect(config.limits).toBeDefined();
      expect(config.approvalTimeout).toBe(45);
    });

    it('should apply overrides correctly', () => {
      const config = createAutonomyConfig({
        level: 'full-auto',
        rejectionBehavior: 'skip',
        approvalTimeout: 60,
      });

      expect(config.level).toBe('full-auto');
      expect(config.rejectionBehavior).toBe('skip');
      expect(config.approvalTimeout).toBe(60);
    });

    it('should respect factory options', () => {
      const config = createAutonomyConfig({}, {
        includeGates: false,
        includeLimits: false,
        level: 'full-auto',
      });

      expect(config.level).toBe('full-auto');
      expect(config.gates).toBeUndefined();
      expect(config.limits).toBeUndefined();
    });

    it('should include stage overrides when requested', () => {
      const config = createAutonomyConfig({}, {
        includeStageOverrides: true,
      });

      expect(config.stageOverrides).toBeDefined();
      expect(config.stageOverrides?.planning).toBe('full-auto');
      expect(config.stageOverrides?.implementation).toBe('review-before-commit');
    });

    it('should include agent overrides when requested', () => {
      const config = createAutonomyConfig({}, {
        includeAgentOverrides: true,
      });

      expect(config.agentOverrides).toBeDefined();
      expect(config.agentOverrides?.planner).toBe('full-auto');
      expect(config.agentOverrides?.developer).toMatchObject({
        level: 'review-before-commit',
        approvalTimeout: 30,
        rejectionBehavior: 'skip',
      });
    });

    it('should create specified number of gates', () => {
      const config = createAutonomyConfig({}, {
        gateCount: 3,
      });

      expect(config.gates).toHaveLength(3);
    });
  });

  describe('createAgentAutonomyOverride', () => {
    it('should create a basic agent autonomy override', () => {
      const override = createAgentAutonomyOverride();

      expect(override.level).toBe('review-before-commit');
      expect(override.approvalTimeout).toBe(30);
      expect(override.rejectionBehavior).toBe('skip');
    });

    it('should apply overrides correctly', () => {
      const override = createAgentAutonomyOverride({
        level: 'full-auto',
        approvalTimeout: 60,
      });

      expect(override.level).toBe('full-auto');
      expect(override.approvalTimeout).toBe(60);
    });
  });

  describe('createApprovalGate', () => {
    it('should create a basic approval gate', () => {
      const gate = createApprovalGate();

      expect(gate.id).toMatch(/^gate-\d+-[a-z0-9]+$/);
      expect(gate.name).toBe('Test Approval Gate');
      expect(gate.stage).toBe('implementation');
      expect(gate.type).toBe('manual');
      expect(gate.required).toBe(true);
      expect(gate.timeout).toBe(30);
    });

    it('should apply overrides correctly', () => {
      const gate = createApprovalGate({
        id: 'custom-gate',
        name: 'Custom Gate',
        stage: 'deployment',
        required: false,
        timeout: 60,
      });

      expect(gate.id).toBe('custom-gate');
      expect(gate.name).toBe('Custom Gate');
      expect(gate.stage).toBe('deployment');
      expect(gate.required).toBe(false);
      expect(gate.timeout).toBe(60);
    });
  });

  describe('createResourceLimits', () => {
    it('should create default resource limits', () => {
      const limits = createResourceLimits();

      expect(limits.maxDuration).toBe(60);
      expect(limits.maxTokens).toBe(100000);
      expect(limits.maxCost).toBe(10.00);
      expect(limits.maxRetries).toBe(3);
      expect(limits.maxFileSize).toBe(10485760);
      expect(limits.maxFiles).toBe(100);
    });

    it('should apply overrides correctly', () => {
      const limits = createResourceLimits({
        maxDuration: 120,
        maxTokens: 50000,
        maxCost: 5.00,
      });

      expect(limits.maxDuration).toBe(120);
      expect(limits.maxTokens).toBe(50000);
      expect(limits.maxCost).toBe(5.00);
      expect(limits.maxRetries).toBe(3); // Not overridden
    });
  });

  describe('Autonomy level specific factories', () => {
    describe('createFullAutoConfig', () => {
      it('should create full-auto configuration', () => {
        const config = createFullAutoConfig();

        expect(config.level).toBe('full-auto');
        expect(config.gates).toEqual([]);
        expect(config.limits).toBeDefined();
      });
    });

    describe('createReviewBeforeCommitConfig', () => {
      it('should create review-before-commit configuration', () => {
        const config = createReviewBeforeCommitConfig();

        expect(config.level).toBe('review-before-commit');
        expect(config.gates).toHaveLength(1);
        expect(config.limits).toBeDefined();
      });
    });

    describe('createReviewAllConfig', () => {
      it('should create review-all configuration', () => {
        const config = createReviewAllConfig();

        expect(config.level).toBe('review-all');
        expect(config.gates).toHaveLength(3);
        expect(config.limits).toBeDefined();
        expect(config.stageOverrides).toBeDefined();
        expect(config.agentOverrides).toBeDefined();
      });
    });
  });

  describe('Specialized configurations', () => {
    describe('createTestAutonomyConfig', () => {
      it('should create test configuration with short limits', () => {
        const config = createTestAutonomyConfig();

        expect(config.level).toBe('full-auto');
        expect(config.limits?.maxDuration).toBe(5);
        expect(config.limits?.maxTokens).toBe(1000);
        expect(config.limits?.maxCost).toBe(0.50);
        expect(config.approvalTimeout).toBe(5);
      });
    });

    describe('createRestrictiveConfig', () => {
      it('should create restrictive configuration', () => {
        const config = createRestrictiveConfig();

        expect(config.level).toBe('review-all');
        expect(config.limits?.maxDuration).toBe(10);
        expect(config.limits?.maxCost).toBe(1.00);
        expect(config.gates).toHaveLength(3);
      });
    });

    describe('createPermissiveConfig', () => {
      it('should create permissive configuration', () => {
        const config = createPermissiveConfig();

        expect(config.level).toBe('full-auto');
        expect(config.limits?.maxDuration).toBe(240);
        expect(config.limits?.maxCost).toBe(100.00);
        expect(config.gates).toEqual([]);
      });
    });
  });

  describe('AutonomyPresets', () => {
    describe('basic presets', () => {
      it('should provide all basic autonomy levels', () => {
        const fullAuto = AutonomyPresets.basic.fullAuto();
        const reviewBeforeCommit = AutonomyPresets.basic.reviewBeforeCommit();
        const reviewAll = AutonomyPresets.basic.reviewAll();

        expect(fullAuto.level).toBe('full-auto');
        expect(reviewBeforeCommit.level).toBe('review-before-commit');
        expect(reviewAll.level).toBe('review-all');
      });
    });

    describe('resource presets', () => {
      it('should provide different resource configurations', () => {
        const restrictive = AutonomyPresets.resources.restrictive();
        const permissive = AutonomyPresets.resources.permissive();
        const test = AutonomyPresets.resources.test();

        expect(restrictive.limits?.maxCost).toBeLessThan(permissive.limits!.maxCost);
        expect(test.limits?.maxDuration).toBeLessThan(restrictive.limits!.maxDuration);
      });
    });

    describe('testing presets', () => {
      it('should provide configurations for various test scenarios', () => {
        const minimal = AutonomyPresets.testing.minimal();
        const withGates = AutonomyPresets.testing.withGates();
        const withOverrides = AutonomyPresets.testing.withOverrides();
        const complete = AutonomyPresets.testing.complete();

        expect(minimal.gates).toBeUndefined();
        expect(minimal.limits).toBeUndefined();

        expect(withGates.gates).toHaveLength(2);

        expect(withOverrides.stageOverrides).toBeDefined();
        expect(withOverrides.agentOverrides).toBeDefined();

        expect(complete.gates).toBeDefined();
        expect(complete.limits).toBeDefined();
        expect(complete.stageOverrides).toBeDefined();
        expect(complete.agentOverrides).toBeDefined();
      });
    });

    describe('stage presets', () => {
      it('should provide stage-specific configurations', () => {
        const planning = AutonomyPresets.stages.planning();
        const implementation = AutonomyPresets.stages.implementation();
        const deployment = AutonomyPresets.stages.deployment();

        expect(planning.stageOverrides?.planning).toBe('full-auto');
        expect(implementation.stageOverrides?.implementation).toBe('review-before-commit');
        expect(deployment.stageOverrides?.deployment).toBe('review-all');
      });
    });

    describe('agent presets', () => {
      it('should provide agent-specific configurations', () => {
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
  });

  describe('Utility functions', () => {
    describe('createAutonomyLevelCollection', () => {
      it('should create a collection with all autonomy levels', () => {
        const collection = createAutonomyLevelCollection();

        expect(collection['full-auto'].level).toBe('full-auto');
        expect(collection['review-before-commit'].level).toBe('review-before-commit');
        expect(collection['review-all'].level).toBe('review-all');
      });
    });

    describe('createAutonomyVariants', () => {
      it('should create control and experimental variants', () => {
        const variants = createAutonomyVariants();

        expect(variants.control.level).toBe('review-before-commit');
        expect(variants.experimental.level).toBe('full-auto');
        expect(variants.experimental.limits).toBeDefined();
      });
    });

    describe('validateAutonomyConfig', () => {
      it('should validate correct autonomy configs', () => {
        const validConfig = createAutonomyConfig();
        expect(validateAutonomyConfig(validConfig)).toBe(true);
      });

      it('should validate full-auto configs without gates', () => {
        const fullAutoConfig = createFullAutoConfig();
        expect(validateAutonomyConfig(fullAutoConfig)).toBe(true);
      });

      it('should reject configs without required properties', () => {
        const invalidConfig = { level: undefined } as any as AutonomyConfig;
        expect(validateAutonomyConfig(invalidConfig)).toBe(false);
      });
    });
  });

  describe('Type compliance', () => {
    it('should create configs that match AutonomyConfig type', () => {
      const config = createAutonomyConfig();

      // TypeScript compilation validates this, but we can also check at runtime
      expect(typeof config.level).toBe('string');
      expect(typeof config.rejectionBehavior).toBe('string');
      expect(Array.isArray(config.gates)).toBe(true);

      if (config.limits) {
        expect(typeof config.limits.maxDuration).toBe('number');
        expect(typeof config.limits.maxTokens).toBe('number');
        expect(typeof config.limits.maxCost).toBe('number');
      }
    });

    it('should create agent overrides that match AgentAutonomyOverride type', () => {
      const override = createAgentAutonomyOverride();

      expect(typeof override.level).toBe('string');
      expect(typeof override.approvalTimeout).toBe('number');
      expect(typeof override.rejectionBehavior).toBe('string');
    });
  });

  describe('Factory consistency', () => {
    it('should create consistent IDs for approval gates', () => {
      const gate1 = createApprovalGate();
      const gate2 = createApprovalGate();

      expect(gate1.id).not.toBe(gate2.id);
      expect(gate1.id).toMatch(/^gate-\d+-[a-z0-9]+$/);
      expect(gate2.id).toMatch(/^gate-\d+-[a-z0-9]+$/);
    });

    it('should maintain default values across calls', () => {
      const config1 = createAutonomyConfig();
      const config2 = createAutonomyConfig();

      expect(config1.level).toBe(config2.level);
      expect(config1.rejectionBehavior).toBe(config2.rejectionBehavior);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty overrides', () => {
      const config = createAutonomyConfig({});
      expect(config).toBeDefined();
      expect(config.level).toBe('review-before-commit');
    });

    it('should handle undefined options', () => {
      const config = createAutonomyConfig(undefined, undefined);
      expect(config).toBeDefined();
      expect(config.level).toBe('review-before-commit');
    });

    it('should handle zero gate count', () => {
      const config = createAutonomyConfig({}, { gateCount: 0 });
      expect(config.gates).toHaveLength(0);
    });

    it('should handle large gate count', () => {
      const config = createAutonomyConfig({}, { gateCount: 10 });
      expect(config.gates).toHaveLength(3); // Capped at available gates
    });
  });
});