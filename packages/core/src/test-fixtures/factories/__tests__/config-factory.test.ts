/**
 * @fileoverview Tests for configuration factory functions
 *
 * Comprehensive test suite for configuration-related fixture factories.
 */

import { describe, it, expect } from 'vitest';
import type { ProjectConfig, AutonomyLevel } from '../../../types.js';
import {
  createProjectConfig,
  createIntegratedConfig,
  createFullAutoProjectConfig,
  createReviewBeforeCommitProjectConfig,
  createReviewAllProjectConfig,
  createStageSpecificConfigs,
  createResourceConstrainedConfigs,
  createAgentSpecificConfigs,
  ConfigPresets,
  validateProjectConfig,
  createAutonomyProjectCollection,
  createAutonomyComparisonConfigs,
} from '../config-factory.js';

describe('config-factory', () => {
  describe('createProjectConfig', () => {
    it('should create a basic project config with defaults', () => {
      const config = createProjectConfig();

      expect(config.name).toBe('test-project');
      expect(config.description).toBe('Test project configuration');
      expect(config.autonomy).toBeDefined();
      expect(config.agents).toBeDefined();
      expect(config.workflows).toBeDefined();
    });

    it('should apply overrides correctly', () => {
      const config = createProjectConfig({
        name: 'custom-project',
        description: 'Custom description',
      });

      expect(config.name).toBe('custom-project');
      expect(config.description).toBe('Custom description');
    });

    it('should respect factory options', () => {
      const config = createProjectConfig({}, {
        includeAutonomy: false,
        includeAgents: false,
        includeWorkflows: false,
      });

      expect(config.autonomy).toBeUndefined();
      expect(config.agents).toBeUndefined();
      expect(config.workflows).toBeUndefined();
    });

    it('should set autonomy level based on options', () => {
      const config = createProjectConfig({}, {
        defaultAutonomyLevel: 'full-auto',
      });

      expect(config.autonomy?.level).toBe('full-auto');
    });

    it('should create specified number of agents and workflows', () => {
      const config = createProjectConfig({}, {
        agentCount: 2,
        workflowCount: 1,
      });

      expect(Object.keys(config.agents || {})).toHaveLength(2);
      expect(Object.keys(config.workflows || {})).toHaveLength(1);
    });
  });

  describe('createIntegratedConfig', () => {
    it('should create integrated configuration with all components', () => {
      const config = createIntegratedConfig();

      expect(config.name).toBe('integrated-test-project');
      expect(config.autonomy).toBeDefined();
      expect(config.agents).toBeDefined();
      expect(config.workflows).toBeDefined();
      expect(config.autonomy?.level).toBe('review-before-commit');
    });
  });

  describe('Autonomy level specific configs', () => {
    describe('createFullAutoProjectConfig', () => {
      it('should create full-auto project configuration', () => {
        const config = createFullAutoProjectConfig();

        expect(config.name).toBe('full-auto-project');
        expect(config.autonomy?.level).toBe('full-auto');
        expect(config.autonomy?.gates).toEqual([]);
      });
    });

    describe('createReviewBeforeCommitProjectConfig', () => {
      it('should create review-before-commit project configuration', () => {
        const config = createReviewBeforeCommitProjectConfig();

        expect(config.name).toBe('review-before-commit-project');
        expect(config.autonomy?.level).toBe('review-before-commit');
        expect(config.autonomy?.gates).toBeDefined();
        expect(config.autonomy?.gates?.length).toBeGreaterThan(0);
      });
    });

    describe('createReviewAllProjectConfig', () => {
      it('should create review-all project configuration', () => {
        const config = createReviewAllProjectConfig();

        expect(config.name).toBe('review-all-project');
        expect(config.autonomy?.level).toBe('review-all');
        expect(config.autonomy?.stageOverrides).toBeDefined();
        expect(config.autonomy?.agentOverrides).toBeDefined();
      });
    });
  });

  describe('Environment-specific configurations', () => {
    it('should create stage-specific configurations', () => {
      const configs = createStageSpecificConfigs();

      expect(configs.development.name).toBe('dev-environment');
      expect(configs.staging.name).toBe('staging-environment');
      expect(configs.production.name).toBe('production-environment');

      expect(configs.development.autonomy?.level).toBe('full-auto');
      expect(configs.staging.autonomy?.level).toBe('review-before-commit');
      expect(configs.production.autonomy?.level).toBe('review-all');
    });

    it('should create resource-constrained configurations', () => {
      const configs = createResourceConstrainedConfigs();

      expect(configs.lowResource.autonomy?.limits?.maxCost).toBeLessThan(
        configs.mediumResource.autonomy!.limits!.maxCost
      );
      expect(configs.mediumResource.autonomy?.limits?.maxCost).toBeLessThan(
        configs.highResource.autonomy!.limits!.maxCost
      );
    });

    it('should create agent-specific configurations', () => {
      const configs = createAgentSpecificConfigs();

      expect(configs.developerFocused.autonomy?.agentOverrides?.developer).toBeDefined();
      expect(configs.testerFocused.autonomy?.agentOverrides?.tester).toBeDefined();
      expect(configs.reviewerFocused.autonomy?.agentOverrides?.reviewer).toBeDefined();
    });
  });

  describe('ConfigPresets', () => {
    describe('basic presets', () => {
      it('should provide basic configurations', () => {
        const minimal = ConfigPresets.basic.minimal();
        const standard = ConfigPresets.basic.standard();
        const complete = ConfigPresets.basic.complete();

        expect(minimal.autonomy).toBeUndefined();
        expect(minimal.agents).toBeUndefined();
        expect(minimal.workflows).toBeUndefined();

        expect(standard.autonomy).toBeDefined();
        expect(standard.agents).toBeDefined();
        expect(standard.workflows).toBeDefined();

        expect(complete.autonomy).toBeDefined();
        expect(complete.agents).toBeDefined();
        expect(complete.workflows).toBeDefined();
      });
    });

    describe('autonomy presets', () => {
      it('should provide all autonomy level configurations', () => {
        const fullAuto = ConfigPresets.autonomy.fullAuto();
        const reviewBeforeCommit = ConfigPresets.autonomy.reviewBeforeCommit();
        const reviewAll = ConfigPresets.autonomy.reviewAll();

        expect(fullAuto.autonomy?.level).toBe('full-auto');
        expect(reviewBeforeCommit.autonomy?.level).toBe('review-before-commit');
        expect(reviewAll.autonomy?.level).toBe('review-all');
      });
    });

    describe('environment presets', () => {
      it('should provide environment-specific configurations', () => {
        const envs = ConfigPresets.environments();

        expect(envs.development).toBeDefined();
        expect(envs.staging).toBeDefined();
        expect(envs.production).toBeDefined();
      });
    });

    describe('testing presets', () => {
      it('should provide configurations optimized for testing', () => {
        const unitTest = ConfigPresets.testing.unitTest();
        const integration = ConfigPresets.testing.integration();
        const e2e = ConfigPresets.testing.e2e();

        expect(unitTest.autonomy?.limits?.maxDuration).toBeLessThan(
          integration.autonomy!.limits!.maxDuration
        );
        expect(integration.autonomy?.limits?.maxDuration).toBeLessThan(
          e2e.autonomy!.limits!.maxDuration
        );
      });
    });
  });

  describe('Utility functions', () => {
    describe('validateProjectConfig', () => {
      it('should validate valid project configs', () => {
        const config = createProjectConfig();
        expect(validateProjectConfig(config)).toBe(true);
      });

      it('should reject configs without required properties', () => {
        const invalidConfig = { name: '' } as ProjectConfig;
        expect(validateProjectConfig(invalidConfig)).toBe(false);
      });
    });

    describe('createAutonomyProjectCollection', () => {
      it('should create a collection with all autonomy levels', () => {
        const collection = createAutonomyProjectCollection();

        expect(collection['full-auto'].autonomy?.level).toBe('full-auto');
        expect(collection['review-before-commit'].autonomy?.level).toBe('review-before-commit');
        expect(collection['review-all'].autonomy?.level).toBe('review-all');
      });
    });

    describe('createAutonomyComparisonConfigs', () => {
      it('should create configs for A/B testing autonomy levels', () => {
        const configs = createAutonomyComparisonConfigs();

        expect(configs.conservative.autonomy?.level).toBe('review-all');
        expect(configs.moderate.autonomy?.level).toBe('review-before-commit');
        expect(configs.aggressive.autonomy?.level).toBe('full-auto');
      });
    });
  });

  describe('Type compliance', () => {
    it('should create configs that match ProjectConfig type', () => {
      const config = createProjectConfig();

      expect(typeof config.name).toBe('string');
      expect(typeof config.description).toBe('string');

      if (config.autonomy) {
        expect(typeof config.autonomy.level).toBe('string');
        expect(['full-auto', 'review-before-commit', 'review-all']).toContain(config.autonomy.level);
      }

      if (config.agents) {
        Object.values(config.agents).forEach(agent => {
          expect(typeof agent.name).toBe('string');
          expect(typeof agent.description).toBe('string');
          expect(Array.isArray(agent.tools)).toBe(true);
        });
      }
    });
  });

  describe('Factory consistency', () => {
    it('should create consistent configurations across calls', () => {
      const config1 = createProjectConfig();
      const config2 = createProjectConfig();

      expect(config1.name).toBe(config2.name);
      expect(config1.description).toBe(config2.description);
    });

    it('should respect overrides consistently', () => {
      const override = { name: 'custom-name' };
      const config1 = createProjectConfig(override);
      const config2 = createProjectConfig(override);

      expect(config1.name).toBe(config2.name);
      expect(config1.name).toBe('custom-name');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty overrides', () => {
      const config = createProjectConfig({});
      expect(config).toBeDefined();
      expect(config.name).toBe('test-project');
    });

    it('should handle undefined overrides and options', () => {
      const config = createProjectConfig(undefined, undefined);
      expect(config).toBeDefined();
      expect(config.name).toBe('test-project');
    });

    it('should handle zero counts for agents and workflows', () => {
      const config = createProjectConfig({}, {
        agentCount: 0,
        workflowCount: 0,
      });

      expect(Object.keys(config.agents || {})).toHaveLength(0);
      expect(Object.keys(config.workflows || {})).toHaveLength(0);
    });
  });

  describe('Autonomy integration', () => {
    it('should properly integrate autonomy settings with project config', () => {
      const config = createProjectConfig({}, {
        defaultAutonomyLevel: 'review-all',
        includeAutonomy: true,
      });

      expect(config.autonomy?.level).toBe('review-all');
      expect(config.autonomy?.stageOverrides).toBeDefined();
      expect(config.autonomy?.agentOverrides).toBeDefined();
    });

    it('should exclude autonomy components when requested', () => {
      const config = createProjectConfig({}, {
        includeAutonomy: false,
      });

      expect(config.autonomy).toBeUndefined();
    });
  });
});