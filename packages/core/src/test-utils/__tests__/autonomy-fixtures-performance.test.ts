/**
 * Performance and concurrency tests for autonomy fixtures
 *
 * This test suite focuses on performance characteristics, memory usage,
 * and concurrent access patterns for autonomy test fixtures.
 */

import { describe, it, expect } from 'vitest';
import {
  AutonomyFixtures,
  createAutonomyConfig,
  createApprovalGate,
  createApexConfigWithAutonomy,
  getAutonomyConfigVariations,
  isValidAutonomyConfig,
} from '../autonomy-fixtures';
import {
  AutonomyConfigSchema,
  AutonomyLevel,
  type AutonomyConfig,
} from '../../types';

describe('Autonomy Fixtures Performance', () => {
  describe('Factory function performance', () => {
    it('should create configurations quickly', () => {
      const start = performance.now();

      // Create many configurations
      const configs = Array.from({ length: 1000 }, (_, i) =>
        createAutonomyConfig({
          level: i % 3 === 0 ? 'full-auto' : i % 3 === 1 ? 'review-before-commit' : 'review-all',
          limits: {
            maxTokensPerTask: 500000 + (i * 1000),
            maxCostPerTask: 5.0 + (i * 0.01),
            timeoutMinutes: 30 + (i % 60),
          }
        })
      );

      const end = performance.now();
      const duration = end - start;

      expect(configs).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second

      // Verify all configs are valid
      configs.forEach(config => {
        expect(isValidAutonomyConfig(config)).toBe(true);
      });
    });

    it('should handle rapid gate creation', () => {
      const start = performance.now();

      // Create many approval gates
      const gates = Array.from({ length: 500 }, (_, i) =>
        createApprovalGate({
          type: i % 2 === 0 ? 'commit' : 'code_change',
          description: `Rapid gate ${i}`,
          required: i % 3 === 0,
          stage: i % 4 === 0 ? 'deployment' : 'implementation',
        })
      );

      const config = createAutonomyConfig({
        level: 'review-all',
        gates,
      });

      const end = performance.now();
      const duration = end - start;

      expect(config.gates).toHaveLength(500);
      expect(duration).toBeLessThan(500); // Should complete quickly
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });

    it('should efficiently create APEX configs with complex autonomy', () => {
      const start = performance.now();

      const configs = Array.from({ length: 100 }, (_, i) =>
        createApexConfigWithAutonomy(
          {
            level: 'review-before-commit',
            gates: Array.from({ length: 10 }, (_, j) =>
              createApprovalGate({
                type: j % 2 === 0 ? 'commit' : 'deployment',
                description: `Gate ${i}-${j}`,
              })
            ),
            stageOverrides: {
              planning: 'full-auto',
              implementation: 'review-all',
              testing: 'review-before-commit',
            },
            agentOverrides: {
              developer: 'full-auto',
              tester: {
                level: 'review-all',
                approvalTimeout: 10 + i,
                rejectionBehavior: 'skip',
              }
            }
          },
          {
            project: { name: `project-${i}`, language: 'typescript' },
            limits: { maxCostPerTask: 5.0 + i, dailyBudget: 50.0 + i },
          }
        )
      );

      const end = performance.now();
      const duration = end - start;

      expect(configs).toHaveLength(100);
      expect(duration).toBeLessThan(2000); // Should complete reasonably quickly

      // Spot check a few configs
      expect(configs[0].autonomy?.gates).toHaveLength(10);
      expect(configs[50].project.name).toBe('project-50');
      expect(configs[99].limits?.maxCostPerTask).toBe(104.0);
    });
  });

  describe('Memory efficiency', () => {
    it('should not create excessive object references', () => {
      // Create configs and verify they don't share unintended references
      const config1 = createAutonomyConfig({
        limits: { maxTokensPerTask: 100000 },
        stageOverrides: { testing: 'full-auto' },
        agentOverrides: { developer: 'review-all' },
      });

      const config2 = createAutonomyConfig({
        limits: { maxTokensPerTask: 200000 },
        stageOverrides: { testing: 'review-all' },
        agentOverrides: { developer: 'full-auto' },
      });

      // Configs should have different values
      expect(config1.limits?.maxTokensPerTask).toBe(100000);
      expect(config2.limits?.maxTokensPerTask).toBe(200000);
      expect(config1.stageOverrides?.testing).toBe('full-auto');
      expect(config2.stageOverrides?.testing).toBe('review-all');

      // Should not share object references
      expect(config1.limits).not.toBe(config2.limits);
      expect(config1.stageOverrides).not.toBe(config2.stageOverrides);
      expect(config1.agentOverrides).not.toBe(config2.agentOverrides);
    });

    it('should efficiently store large configurations', () => {
      // Create a very large configuration
      const largeStageOverrides: Record<string, AutonomyLevel> = {};
      const largeAgentOverrides: Record<string, AutonomyLevel> = {};

      for (let i = 0; i < 1000; i++) {
        largeStageOverrides[`stage_${i}`] = i % 3 === 0 ? 'full-auto' :
                                          i % 3 === 1 ? 'review-before-commit' : 'review-all';
        largeAgentOverrides[`agent_${i}`] = i % 2 === 0 ? 'full-auto' : 'review-all';
      }

      const largeConfig = createAutonomyConfig({
        level: 'review-before-commit',
        stageOverrides: largeStageOverrides,
        agentOverrides: largeAgentOverrides,
      });

      expect(Object.keys(largeConfig.stageOverrides || {})).toHaveLength(1000);
      expect(Object.keys(largeConfig.agentOverrides || {})).toHaveLength(1000);

      // Should still validate quickly
      const start = performance.now();
      const isValid = isValidAutonomyConfig(largeConfig);
      const end = performance.now();

      expect(isValid).toBe(true);
      expect(end - start).toBeLessThan(100); // Should validate quickly even for large configs
    });
  });

  describe('Concurrent access patterns', () => {
    it('should handle concurrent fixture access', async () => {
      // Simulate multiple "threads" accessing fixtures simultaneously
      const concurrentOperations = Array.from({ length: 50 }, async (_, i) => {
        // Each operation accesses different fixtures and creates configs
        const fixture = i % 3 === 0 ? AutonomyFixtures.fullAuto :
                       i % 3 === 1 ? AutonomyFixtures.reviewBeforeCommit :
                       AutonomyFixtures.reviewAll;

        const customConfig = createAutonomyConfig({
          level: fixture.level,
          limits: {
            maxTokensPerTask: 500000 + (i * 1000),
            maxCostPerTask: 5.0 + (i * 0.1),
          }
        });

        return {
          fixtureLevel: fixture.level,
          customLevel: customConfig.level,
          id: i,
        };
      });

      const results = await Promise.all(concurrentOperations);

      expect(results).toHaveLength(50);

      // Verify all results are correct
      results.forEach((result, i) => {
        const expectedLevel = i % 3 === 0 ? 'full-auto' :
                             i % 3 === 1 ? 'review-before-commit' :
                             'review-all';
        expect(result.fixtureLevel).toBe(expectedLevel);
        expect(result.customLevel).toBe(expectedLevel);
        expect(result.id).toBe(i);
      });
    });

    it('should handle concurrent validation operations', async () => {
      const variations = getAutonomyConfigVariations();
      const configs = Object.values(variations);

      // Validate all configurations concurrently
      const validationPromises = configs.map(async config => ({
        config,
        isValid: isValidAutonomyConfig(config),
        zodValid: AutonomyConfigSchema.safeParse(config).success,
      }));

      const results = await Promise.all(validationPromises);

      expect(results).toHaveLength(configs.length);
      results.forEach(result => {
        expect(result.isValid).toBe(true);
        expect(result.zodValid).toBe(true);
      });
    });
  });

  describe('Scalability scenarios', () => {
    it('should handle enterprise-scale configuration variations', () => {
      // Simulate configurations for a large enterprise with many teams/projects
      const enterpriseConfigs: Record<string, AutonomyConfig> = {};

      // Different departments
      const departments = ['engineering', 'data', 'security', 'devops', 'qa'];
      // Different environments
      const environments = ['dev', 'staging', 'prod'];
      // Different project types
      const projectTypes = ['web', 'api', 'mobile', 'ml', 'infrastructure'];

      departments.forEach(dept => {
        environments.forEach(env => {
          projectTypes.forEach(type => {
            const configKey = `${dept}-${env}-${type}`;

            // Different autonomy based on department and environment
            const level = dept === 'security' || env === 'prod' ? 'review-all' :
                         dept === 'devops' && env === 'dev' ? 'full-auto' :
                         'review-before-commit';

            enterpriseConfigs[configKey] = createAutonomyConfig({
              level,
              limits: {
                maxTokensPerTask: env === 'prod' ? 250000 : 750000,
                maxCostPerTask: env === 'prod' ? 2.0 : 8.0,
                timeoutMinutes: dept === 'security' ? 15 : 45,
              },
              stageOverrides: env === 'dev' ? {
                planning: 'full-auto',
                implementation: level,
                testing: level,
              } : undefined,
            });
          });
        });
      });

      const configCount = departments.length * environments.length * projectTypes.length;
      expect(Object.keys(enterpriseConfigs)).toHaveLength(configCount);

      // Validate all configurations
      const start = performance.now();
      const allValid = Object.values(enterpriseConfigs).every(config =>
        isValidAutonomyConfig(config)
      );
      const end = performance.now();

      expect(allValid).toBe(true);
      expect(end - start).toBeLessThan(1000); // Should validate quickly even at scale

      // Spot check some configurations
      expect(enterpriseConfigs['security-prod-web'].level).toBe('review-all');
      expect(enterpriseConfigs['devops-dev-infrastructure'].level).toBe('full-auto');
      expect(enterpriseConfigs['engineering-staging-api'].level).toBe('review-before-commit');
    });

    it('should handle configuration inheritance chains', () => {
      // Simulate complex inheritance where configs build on each other
      const baseConfig = createAutonomyConfig({
        level: 'review-before-commit',
        limits: {
          maxTokensPerTask: 500000,
          maxCostPerTask: 5.0,
          timeoutMinutes: 30,
        }
      });

      // Build increasingly complex configurations
      const configs: AutonomyConfig[] = [baseConfig];

      for (let i = 1; i <= 100; i++) {
        const previousConfig = configs[i - 1];

        const newConfig = createAutonomyConfig({
          ...previousConfig,
          level: i % 10 === 0 ? 'review-all' : previousConfig.level,
          limits: {
            ...previousConfig.limits,
            maxTokensPerTask: (previousConfig.limits?.maxTokensPerTask || 500000) + 1000,
            maxCostPerTask: (previousConfig.limits?.maxCostPerTask || 5.0) + 0.1,
          },
          stageOverrides: {
            ...previousConfig.stageOverrides,
            [`stage_${i}`]: i % 3 === 0 ? 'full-auto' : 'review-before-commit',
          },
        });

        configs.push(newConfig);
      }

      expect(configs).toHaveLength(101); // Base + 100 derived

      // Final config should have accumulated changes
      const finalConfig = configs[100];
      expect(finalConfig.limits?.maxTokensPerTask).toBe(600000); // 500000 + (100 * 1000)
      expect(finalConfig.limits?.maxCostPerTask).toBeCloseTo(15.0, 1); // 5.0 + (100 * 0.1)
      expect(Object.keys(finalConfig.stageOverrides || {})).toHaveLength(100);

      // All configs should be valid
      const start = performance.now();
      const allValid = configs.every(config => isValidAutonomyConfig(config));
      const end = performance.now();

      expect(allValid).toBe(true);
      expect(end - start).toBeLessThan(500); // Should validate efficiently
    });
  });

  describe('Stress testing', () => {
    it('should handle repeated fixture access', () => {
      // Simulate heavy usage of fixtures
      const iterations = 10000;
      const results: any[] = [];

      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        const fixtureKey = Object.keys(AutonomyFixtures)[i % Object.keys(AutonomyFixtures).length] as keyof typeof AutonomyFixtures;
        const fixture = AutonomyFixtures[fixtureKey];

        results.push({
          iteration: i,
          level: fixture.level,
          hasGates: Boolean(fixture.gates && fixture.gates.length > 0),
          hasLimits: Boolean(fixture.limits),
        });
      }

      const end = performance.now();
      const duration = end - start;

      expect(results).toHaveLength(iterations);
      expect(duration).toBeLessThan(1000); // Should complete quickly

      // Verify diversity in results
      const levels = new Set(results.map(r => r.level));
      expect(levels.size).toBeGreaterThan(1);
    });

    it('should handle stress configuration creation and validation', () => {
      const start = performance.now();

      // Create and validate many complex configurations rapidly
      const results = Array.from({ length: 1000 }, (_, i) => {
        const config = createAutonomyConfig({
          level: i % 2 === 0 ? 'full-auto' : 'review-all',
          gates: Array.from({ length: i % 10 }, (_, j) =>
            createApprovalGate({
              type: j % 2 === 0 ? 'commit' : 'deployment',
              description: `Stress gate ${i}-${j}`,
            })
          ),
          limits: {
            maxTokensPerTask: 500000 + (i * 100),
            maxCostPerTask: 5.0 + (i * 0.01),
            timeoutMinutes: 30 + (i % 120),
          },
          stageOverrides: i % 5 === 0 ? {
            planning: 'full-auto',
            testing: 'review-all',
          } : undefined,
        });

        return {
          config,
          isValid: isValidAutonomyConfig(config),
          schemaValid: AutonomyConfigSchema.safeParse(config).success,
        };
      });

      const end = performance.now();
      const duration = end - start;

      expect(results).toHaveLength(1000);
      expect(duration).toBeLessThan(5000); // Should complete in reasonable time

      // All should be valid
      expect(results.every(r => r.isValid)).toBe(true);
      expect(results.every(r => r.schemaValid)).toBe(true);
    });
  });
});