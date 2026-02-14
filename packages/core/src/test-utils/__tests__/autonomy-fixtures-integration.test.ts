/**
 * Integration tests for autonomy fixtures with real workflow scenarios
 *
 * This test suite demonstrates how autonomy fixtures integrate with
 * workflows and provides realistic usage patterns for testing
 * autonomy-aware features across the APEX system.
 */

import { describe, it, expect } from 'vitest';
import {
  AutonomyFixtures,
  createAutonomyConfig,
  createApexConfigWithAutonomy,
  getAutonomyConfigVariations,
} from '../autonomy-fixtures';
import {
  AutonomyConfigSchema,
  ApexConfigSchema,
  AutonomyLevel,
  WorkflowSchema,
  type AutonomyConfig,
  type ApexConfig,
} from '../../types';

describe('Autonomy Fixtures Integration', () => {
  describe('Workflow integration scenarios', () => {
    it('should support feature development workflow with different autonomy levels', () => {
      const workflowStages = ['planning', 'architecture', 'implementation', 'testing', 'review', 'deployment'];

      // Test each autonomy level with a typical feature workflow
      const testCases = [
        { level: 'full-auto' as AutonomyLevel, expectedGates: 0 },
        { level: 'review-before-commit' as AutonomyLevel, expectedGates: 1 },
        { level: 'review-all' as AutonomyLevel, expectedGates: 3 },
      ];

      testCases.forEach(({ level, expectedGates }) => {
        const autonomyConfig = level === 'full-auto'
          ? AutonomyFixtures.fullAuto
          : level === 'review-before-commit'
          ? AutonomyFixtures.reviewBeforeCommit
          : AutonomyFixtures.reviewAll;

        // Verify configuration matches expected pattern
        expect(autonomyConfig.level).toBe(level);
        expect(autonomyConfig.gates?.length || 0).toBe(expectedGates);

        // Should work with all workflow stages
        workflowStages.forEach(stage => {
          const stageAutonomy = autonomyConfig.stageOverrides?.[stage] || autonomyConfig.level;
          expect(['full-auto', 'review-before-commit', 'review-all']).toContain(stageAutonomy);
        });
      });
    });

    it('should support hotfix workflow with different autonomy configurations', () => {
      // Hotfix might need different autonomy than feature development
      const hotfixConfig = createAutonomyConfig({
        level: 'review-before-commit',
        // Hotfixes might be more restrictive for deployments
        stageOverrides: {
          planning: 'full-auto', // Quick planning
          implementation: 'review-before-commit', // Standard review
          testing: 'review-all', // Thorough testing
          deployment: 'review-all', // Extra careful deployment
        },
        // Different agents might have different restrictions for hotfixes
        agentOverrides: {
          developer: 'full-auto', // Experienced dev can work fast
          tester: 'review-all', // But testing needs oversight
          deployer: 'review-all', // Deployment needs extra care
        }
      });

      expect(hotfixConfig.level).toBe('review-before-commit');
      expect(hotfixConfig.stageOverrides?.planning).toBe('full-auto');
      expect(hotfixConfig.stageOverrides?.deployment).toBe('review-all');
      expect(hotfixConfig.agentOverrides?.developer).toBe('full-auto');
      expect(hotfixConfig.agentOverrides?.tester).toBe('review-all');

      expect(() => AutonomyConfigSchema.parse(hotfixConfig)).not.toThrow();
    });

    it('should support experimental feature workflow', () => {
      // Experimental features might have very different autonomy needs
      const experimentalConfig = createAutonomyConfig({
        level: 'review-all', // Conservative by default
        // But allow fast iteration in early stages
        stageOverrides: {
          planning: 'full-auto',
          architecture: 'full-auto',
          implementation: 'review-before-commit',
          testing: 'review-all',
          review: 'review-all',
          deployment: 'review-all',
        },
        // Higher resource limits for experimentation
        limits: {
          maxTokensPerTask: 2000000,
          maxCostPerTask: 20.0,
          timeoutMinutes: 120,
        }
      });

      expect(experimentalConfig.level).toBe('review-all');
      expect(experimentalConfig.stageOverrides?.planning).toBe('full-auto');
      expect(experimentalConfig.stageOverrides?.architecture).toBe('full-auto');
      expect(experimentalConfig.limits?.maxTokensPerTask).toBe(2000000);

      expect(() => AutonomyConfigSchema.parse(experimentalConfig)).not.toThrow();
    });
  });

  describe('Team and project integration', () => {
    it('should support different team configurations', () => {
      const teamConfigs = {
        // Senior team - high autonomy
        seniorTeam: createApexConfigWithAutonomy(
          { level: 'full-auto' },
          {
            project: { name: 'senior-project', language: 'typescript' },
            limits: { dailyBudget: 100.0 },
          }
        ),

        // Junior team - more oversight
        juniorTeam: createApexConfigWithAutonomy(
          {
            level: 'review-all',
            gates: [
              { type: 'planning', description: 'Review plan', required: true, stage: 'planning' },
              { type: 'code_change', description: 'Review code', required: true, stage: 'implementation' },
              { type: 'commit', description: 'Review commit', required: true, stage: 'implementation' },
            ]
          },
          {
            project: { name: 'junior-project', language: 'typescript' },
            limits: { dailyBudget: 25.0, maxCostPerTask: 2.0 },
          }
        ),

        // Mixed team - different autonomy per agent
        mixedTeam: createApexConfigWithAutonomy(
          {
            level: 'review-before-commit',
            agentOverrides: {
              senior_developer: 'full-auto',
              junior_developer: 'review-all',
              tech_lead: 'full-auto',
              intern: 'review-all',
            }
          },
          {
            project: { name: 'mixed-project', language: 'typescript' },
            limits: { dailyBudget: 50.0 },
          }
        ),
      };

      // Senior team config
      expect(teamConfigs.seniorTeam.autonomy?.level).toBe('full-auto');
      expect(teamConfigs.seniorTeam.limits?.dailyBudget).toBe(100.0);
      expect(() => ApexConfigSchema.parse(teamConfigs.seniorTeam)).not.toThrow();

      // Junior team config
      expect(teamConfigs.juniorTeam.autonomy?.level).toBe('review-all');
      expect(teamConfigs.juniorTeam.autonomy?.gates).toHaveLength(3);
      expect(teamConfigs.juniorTeam.limits?.dailyBudget).toBe(25.0);
      expect(() => ApexConfigSchema.parse(teamConfigs.juniorTeam)).not.toThrow();

      // Mixed team config
      expect(teamConfigs.mixedTeam.autonomy?.level).toBe('review-before-commit');
      expect(teamConfigs.mixedTeam.autonomy?.agentOverrides?.senior_developer).toBe('full-auto');
      expect(teamConfigs.mixedTeam.autonomy?.agentOverrides?.intern).toBe('review-all');
      expect(() => ApexConfigSchema.parse(teamConfigs.mixedTeam)).not.toThrow();
    });

    it('should support project type specific configurations', () => {
      const projectTypes = {
        // Critical production system
        criticalSystem: createApexConfigWithAutonomy(
          AutonomyFixtures.comprehensiveGates,
          {
            project: { name: 'banking-api', language: 'java' },
            limits: { maxCostPerTask: 1.0, maxConcurrentTasks: 1 }, // Very conservative
          }
        ),

        // Internal tool
        internalTool: createApexConfigWithAutonomy(
          AutonomyFixtures.reviewBeforeCommit,
          {
            project: { name: 'dev-tools', language: 'python' },
            limits: { maxCostPerTask: 5.0, maxConcurrentTasks: 3 },
          }
        ),

        // Prototype/MVP
        prototype: createApexConfigWithAutonomy(
          AutonomyFixtures.fullAuto,
          {
            project: { name: 'ai-experiment', language: 'python' },
            limits: { maxCostPerTask: 10.0, maxConcurrentTasks: 5 }, // Allow experimentation
          }
        ),
      };

      // Critical system - most restrictive
      expect(projectTypes.criticalSystem.autonomy?.gates?.length).toBeGreaterThan(0);
      expect(projectTypes.criticalSystem.limits?.maxCostPerTask).toBe(1.0);

      // Internal tool - balanced
      expect(projectTypes.internalTool.autonomy?.level).toBe('review-before-commit');
      expect(projectTypes.internalTool.limits?.maxCostPerTask).toBe(5.0);

      // Prototype - most permissive
      expect(projectTypes.prototype.autonomy?.level).toBe('full-auto');
      expect(projectTypes.prototype.limits?.maxCostPerTask).toBe(10.0);

      // All should be valid
      Object.values(projectTypes).forEach(config => {
        expect(() => ApexConfigSchema.parse(config)).not.toThrow();
      });
    });
  });

  describe('Dynamic autonomy adjustment scenarios', () => {
    it('should support time-based autonomy adjustments', () => {
      // Simulate different autonomy levels for different times/conditions
      const timeBasedConfigs = {
        // Business hours - normal oversight
        businessHours: createAutonomyConfig({
          level: 'review-before-commit',
          limits: { timeoutMinutes: 30 }, // Normal timeout
        }),

        // After hours - more autonomy but conservative limits
        afterHours: createAutonomyConfig({
          level: 'full-auto',
          limits: {
            maxCostPerTask: 2.0, // Lower cost limit when no one is watching
            timeoutMinutes: 15, // Shorter timeout
          }
        }),

        // Emergency/incident response - high autonomy, high limits
        emergency: createAutonomyConfig({
          level: 'full-auto',
          rejectionBehavior: 'skip', // Don't block on failures
          limits: {
            maxCostPerTask: 25.0, // Higher limits for emergency
            maxTokensPerTask: 1500000,
            timeoutMinutes: 90,
          }
        }),
      };

      expect(timeBasedConfigs.businessHours.level).toBe('review-before-commit');
      expect(timeBasedConfigs.afterHours.level).toBe('full-auto');
      expect(timeBasedConfigs.afterHours.limits?.maxCostPerTask).toBe(2.0);
      expect(timeBasedConfigs.emergency.rejectionBehavior).toBe('skip');
      expect(timeBasedConfigs.emergency.limits?.maxCostPerTask).toBe(25.0);

      Object.values(timeBasedConfigs).forEach(config => {
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });
    });

    it('should support progressive autonomy based on confidence/success', () => {
      // Simulate autonomy levels that might change based on agent performance
      const progressiveConfigs = {
        // New agent - very restricted
        newAgent: createAutonomyConfig({
          level: 'review-all',
          agentOverrides: {
            new_developer: {
              level: 'review-all',
              approvalTimeout: 5, // Quick timeout - human needs to respond fast
              rejectionBehavior: 'abort', // Stop on any rejection
            }
          },
          limits: { maxCostPerTask: 1.0 }, // Very low limits
        }),

        // Proven agent - more autonomy
        provenAgent: createAutonomyConfig({
          level: 'review-before-commit',
          agentOverrides: {
            experienced_developer: 'full-auto', // Can work autonomously
          },
          limits: { maxCostPerTask: 8.0 }, // Higher limits
        }),

        // Expert agent - full autonomy
        expertAgent: createAutonomyConfig({
          level: 'full-auto',
          limits: {
            maxCostPerTask: 15.0,
            maxTokensPerTask: 1500000,
            timeoutMinutes: 60,
          }
        }),
      };

      expect(progressiveConfigs.newAgent.level).toBe('review-all');
      expect(progressiveConfigs.newAgent.limits?.maxCostPerTask).toBe(1.0);

      const newAgentOverride = progressiveConfigs.newAgent.agentOverrides?.new_developer;
      if (typeof newAgentOverride === 'object' && newAgentOverride !== null) {
        expect(newAgentOverride.level).toBe('review-all');
        expect(newAgentOverride.approvalTimeout).toBe(5);
      }

      expect(progressiveConfigs.provenAgent.level).toBe('review-before-commit');
      expect(progressiveConfigs.provenAgent.agentOverrides?.experienced_developer).toBe('full-auto');

      expect(progressiveConfigs.expertAgent.level).toBe('full-auto');
      expect(progressiveConfigs.expertAgent.limits?.maxCostPerTask).toBe(15.0);

      Object.values(progressiveConfigs).forEach(config => {
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });
    });
  });

  describe('Configuration testing patterns', () => {
    it('should demonstrate parameterized testing across autonomy levels', () => {
      const variations = getAutonomyConfigVariations();

      // Example of testing a feature across all variations
      function mockFeatureTest(config: AutonomyConfig) {
        // Simulate testing some feature behavior based on autonomy
        const requiresApproval = config.level !== 'full-auto' ||
                                (config.gates && config.gates.length > 0);
        const hasResourceLimits = Boolean(config.limits);
        const hasOverrides = Boolean(config.stageOverrides && Object.keys(config.stageOverrides).length > 0) ||
                           Boolean(config.agentOverrides && Object.keys(config.agentOverrides).length > 0);

        return {
          requiresApproval,
          hasResourceLimits,
          hasOverrides,
          level: config.level,
          rejectionBehavior: config.rejectionBehavior,
        };
      }

      // Test across all variations
      const results = Object.entries(variations).map(([name, config]) => ({
        name,
        ...mockFeatureTest(config),
        valid: AutonomyConfigSchema.safeParse(config).success,
      }));

      // All variations should be valid
      expect(results.every(r => r.valid)).toBe(true);

      // Should have diversity in results
      const levels = new Set(results.map(r => r.level));
      expect(levels.size).toBeGreaterThan(1);

      // Should have some with and without approval requirements
      expect(results.some(r => r.requiresApproval)).toBe(true);
      expect(results.some(r => !r.requiresApproval)).toBe(true);

      // Should have some with overrides
      expect(results.some(r => r.hasOverrides)).toBe(true);
    });

    it('should support A/B testing scenarios', () => {
      // Example: testing two different autonomy approaches
      const configA = AutonomyFixtures.reviewBeforeCommit;
      const configB = createAutonomyConfig({
        level: 'review-before-commit',
        // Different approach - use agent overrides instead of gates
        agentOverrides: {
          developer: 'full-auto',
          tester: 'review-all',
        }
      });

      // Both achieve similar oversight but through different mechanisms
      expect(configA.level).toBe(configB.level);
      expect(configA.gates?.length || 0).toBeGreaterThan(0); // A uses gates
      expect(Object.keys(configB.agentOverrides || {}).length).toBeGreaterThan(0); // B uses overrides

      // Both should be valid
      expect(() => AutonomyConfigSchema.parse(configA)).not.toThrow();
      expect(() => AutonomyConfigSchema.parse(configB)).not.toThrow();
    });
  });

  describe('Real world simulation', () => {
    it('should simulate a complete project lifecycle', () => {
      // Simulate how autonomy might change throughout a project
      const projectPhases = {
        // Initial development - high autonomy for fast iteration
        initial: createApexConfigWithAutonomy(
          { level: 'full-auto' },
          { project: { name: 'new-project', language: 'typescript' } }
        ),

        // Pre-production - add some oversight
        preProduction: createApexConfigWithAutonomy(
          {
            level: 'review-before-commit',
            gates: [
              { type: 'commit', description: 'Review before commit', required: true, stage: 'implementation' }
            ]
          },
          { project: { name: 'new-project', language: 'typescript' } }
        ),

        // Production ready - full oversight
        production: createApexConfigWithAutonomy(
          AutonomyFixtures.comprehensiveGates,
          {
            project: { name: 'new-project', language: 'typescript' },
            limits: { maxCostPerTask: 2.0, maxConcurrentTasks: 1 }
          }
        ),
      };

      // Verify progression from permissive to restrictive
      expect(projectPhases.initial.autonomy?.level).toBe('full-auto');
      expect(projectPhases.preProduction.autonomy?.level).toBe('review-before-commit');
      expect(projectPhases.production.autonomy?.level).toBe('review-before-commit');

      // Verify gates increase over time
      expect(projectPhases.initial.autonomy?.gates?.length || 0).toBe(0);
      expect(projectPhases.preProduction.autonomy?.gates?.length || 0).toBe(1);
      expect(projectPhases.production.autonomy?.gates?.length || 0).toBeGreaterThan(1);

      // All phases should be valid
      Object.values(projectPhases).forEach(config => {
        expect(() => ApexConfigSchema.parse(config)).not.toThrow();
      });
    });
  });
});