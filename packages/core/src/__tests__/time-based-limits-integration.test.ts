import { describe, it, expect } from 'vitest';
import { ApexConfigSchema, DaemonConfigSchema, LimitsConfigSchema } from '../types';
import type { ApexConfig, DaemonConfig, LimitsConfig } from '../types';

describe('Time-Based Usage Integration with Existing Limits', () => {
  describe('Configuration Schema Integration', () => {
    it('should parse complete APEX configuration with time-based usage', () => {
      const fullConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          language: 'typescript',
          framework: 'nextjs',
        },
        limits: {
          dailyBudget: 200.0,
          maxTokensPerTask: 750000,
          maxCostPerTask: 25.0,
          maxConcurrentTasks: 5,
          maxTurns: 150,
        },
        daemon: {
          timeBasedUsage: {
            enabled: true,
            dayModeHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
            nightModeHours: [21, 22, 23, 0, 1, 2, 3, 4, 5, 6],
            dayModeCapacityThreshold: 0.60,
            nightModeCapacityThreshold: 0.90,
            dayModeThresholds: {
              maxTokensPerTask: 200000,
              maxCostPerTask: 10.0,
              maxConcurrentTasks: 2,
            },
            nightModeThresholds: {
              maxTokensPerTask: 1500000,
              maxCostPerTask: 40.0,
              maxConcurrentTasks: 7,
            },
          },
          pollInterval: 3000,
          autoStart: true,
        },
      };

      const result = ApexConfigSchema.parse(fullConfig);

      // Verify all sections are preserved
      expect(result.project.name).toBe('test-project');
      expect(result.limits!.dailyBudget).toBe(200.0);
      expect(result.daemon!.timeBasedUsage!.enabled).toBe(true);
      expect(result.daemon!.pollInterval).toBe(3000);
    });

    it('should handle missing sections gracefully', () => {
      const minimalConfig: Partial<ApexConfig> = {
        version: '1.0',
        project: {
          name: 'minimal-project',
        },
        daemon: {
          timeBasedUsage: {
            enabled: true,
          },
        },
      };

      const result = ApexConfigSchema.parse(minimalConfig);

      // Should apply defaults where appropriate
      expect(result.project.name).toBe('minimal-project');
      expect(result.limits).toBeUndefined(); // Optional section
      expect(result.daemon!.timeBasedUsage!.enabled).toBe(true);
      expect(result.daemon!.pollInterval).toBe(5000); // Default
    });
  });

  describe('Limits Hierarchy and Precedence', () => {
    it('should demonstrate time-based limits override base limits during active periods', () => {
      const limits: LimitsConfig = {
        dailyBudget: 100.0,
        maxTokensPerTask: 500000,
        maxCostPerTask: 15.0,
        maxConcurrentTasks: 4,
      };

      const daemonConfig: DaemonConfig = {
        timeBasedUsage: {
          enabled: true,
          dayModeThresholds: {
            maxTokensPerTask: 100000, // More restrictive than base (500000)
            maxCostPerTask: 5.0,       // More restrictive than base (15.0)
            maxConcurrentTasks: 2,     // More restrictive than base (4)
          },
          nightModeThresholds: {
            maxTokensPerTask: 1000000, // More permissive than base (500000)
            maxCostPerTask: 25.0,      // More permissive than base (15.0)
            maxConcurrentTasks: 6,     // More permissive than base (4)
          },
        },
      };

      const limitsResult = LimitsConfigSchema.parse(limits);
      const daemonResult = DaemonConfigSchema.parse(daemonConfig);

      // Verify base limits
      expect(limitsResult.maxTokensPerTask).toBe(500000);
      expect(limitsResult.maxCostPerTask).toBe(15.0);
      expect(limitsResult.maxConcurrentTasks).toBe(4);

      // Verify day mode overrides (more restrictive)
      expect(daemonResult.timeBasedUsage!.dayModeThresholds!.maxTokensPerTask).toBe(100000);
      expect(daemonResult.timeBasedUsage!.dayModeThresholds!.maxCostPerTask).toBe(5.0);
      expect(daemonResult.timeBasedUsage!.dayModeThresholds!.maxConcurrentTasks).toBe(2);

      // Verify night mode overrides (more permissive)
      expect(daemonResult.timeBasedUsage!.nightModeThresholds!.maxTokensPerTask).toBe(1000000);
      expect(daemonResult.timeBasedUsage!.nightModeThresholds!.maxCostPerTask).toBe(25.0);
      expect(daemonResult.timeBasedUsage!.nightModeThresholds!.maxConcurrentTasks).toBe(6);
    });

    it('should validate that daily budget is shared across all time modes', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'shared-budget-test' },
        limits: {
          dailyBudget: 150.0, // Shared budget
        },
        daemon: {
          timeBasedUsage: {
            enabled: true,
            dayModeCapacityThreshold: 0.40,   // Can use 40% of shared budget ($60)
            nightModeCapacityThreshold: 0.85, // Can use 85% of shared budget ($127.50)
          },
        },
      };

      const result = ApexConfigSchema.parse(config);

      const dailyBudget = result.limits!.dailyBudget!;
      const dayThreshold = result.daemon!.timeBasedUsage!.dayModeCapacityThreshold!;
      const nightThreshold = result.daemon!.timeBasedUsage!.nightModeCapacityThreshold!;

      expect(dailyBudget).toBe(150.0);
      expect(dayThreshold * dailyBudget).toBe(60.0);   // Day mode budget
      expect(nightThreshold * dailyBudget).toBe(127.5); // Night mode budget
    });

    it('should handle cases where time-based limits exceed base limits', () => {
      // This is allowed by schema - business logic decides precedence
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'limit-precedence-test' },
        limits: {
          maxCostPerTask: 10.0,     // Base limit
          maxConcurrentTasks: 3,    // Base limit
        },
        daemon: {
          timeBasedUsage: {
            enabled: true,
            nightModeThresholds: {
              maxCostPerTask: 50.0,     // Exceeds base limit
              maxConcurrentTasks: 8,    // Exceeds base limit
            },
          },
        },
      };

      // Schema validation should pass
      const result = ApexConfigSchema.parse(config);

      expect(result.limits!.maxCostPerTask).toBe(10.0);
      expect(result.daemon!.timeBasedUsage!.nightModeThresholds!.maxCostPerTask).toBe(50.0);
      expect(result.limits!.maxConcurrentTasks).toBe(3);
      expect(result.daemon!.timeBasedUsage!.nightModeThresholds!.maxConcurrentTasks).toBe(8);
    });
  });

  describe('Configuration Validation Interactions', () => {
    it('should validate that capacity thresholds work with different daily budgets', () => {
      const configs = [
        { dailyBudget: 50.0, dayThreshold: 0.80 },    // $40 day limit
        { dailyBudget: 500.0, dayThreshold: 0.60 },   // $300 day limit
        { dailyBudget: 1000.0, dayThreshold: 0.30 },  // $300 day limit
      ];

      for (const { dailyBudget, dayThreshold } of configs) {
        const config: ApexConfig = {
          version: '1.0',
          project: { name: 'budget-threshold-test' },
          limits: { dailyBudget },
          daemon: {
            timeBasedUsage: {
              enabled: true,
              dayModeCapacityThreshold: dayThreshold,
            },
          },
        };

        const result = ApexConfigSchema.parse(config);
        expect(result.limits!.dailyBudget).toBe(dailyBudget);
        expect(result.daemon!.timeBasedUsage!.dayModeCapacityThreshold).toBe(dayThreshold);
      }
    });

    it('should validate realistic configuration combinations', () => {
      const realisticConfigs = [
        // Small team configuration
        {
          name: 'small-team',
          limits: {
            dailyBudget: 75.0,
            maxCostPerTask: 8.0,
            maxConcurrentTasks: 2,
          },
          timeBasedUsage: {
            enabled: true,
            dayModeCapacityThreshold: 0.70,
            dayModeThresholds: {
              maxCostPerTask: 3.0,
              maxConcurrentTasks: 1,
            },
            nightModeThresholds: {
              maxCostPerTask: 12.0,
              maxConcurrentTasks: 3,
            },
          },
        },
        // Enterprise configuration
        {
          name: 'enterprise',
          limits: {
            dailyBudget: 1000.0,
            maxCostPerTask: 100.0,
            maxConcurrentTasks: 10,
          },
          timeBasedUsage: {
            enabled: true,
            dayModeCapacityThreshold: 0.50,
            nightModeCapacityThreshold: 0.95,
            dayModeThresholds: {
              maxCostPerTask: 25.0,
              maxConcurrentTasks: 4,
            },
            nightModeThresholds: {
              maxCostPerTask: 150.0,
              maxConcurrentTasks: 15,
            },
          },
        },
        // Cost-optimized configuration
        {
          name: 'cost-optimized',
          limits: {
            dailyBudget: 200.0,
            maxCostPerTask: 20.0,
            maxConcurrentTasks: 5,
          },
          timeBasedUsage: {
            enabled: true,
            dayModeCapacityThreshold: 0.25,  // Very conservative day usage
            nightModeCapacityThreshold: 0.98, // Aggressive night usage
            dayModeThresholds: {
              maxCostPerTask: 2.0,    // Small tasks during day
              maxConcurrentTasks: 1,  // Sequential processing
            },
            nightModeThresholds: {
              maxCostPerTask: 75.0,   // Large tasks at night
              maxConcurrentTasks: 8,  // Parallel processing
            },
          },
        },
      ];

      for (const configData of realisticConfigs) {
        const config: ApexConfig = {
          version: '1.0',
          project: { name: configData.name },
          limits: configData.limits,
          daemon: { timeBasedUsage: configData.timeBasedUsage },
        };

        const result = ApexConfigSchema.parse(config);

        expect(result.project.name).toBe(configData.name);
        expect(result.limits!.dailyBudget).toBe(configData.limits.dailyBudget);
        expect(result.daemon!.timeBasedUsage!.enabled).toBe(true);
      }
    });
  });

  describe('Backward Compatibility and Migration', () => {
    it('should handle existing configurations without time-based usage', () => {
      const legacyConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'legacy-project' },
        limits: {
          dailyBudget: 100.0,
          maxTokensPerTask: 500000,
          maxCostPerTask: 15.0,
          maxConcurrentTasks: 4,
        },
        // No daemon.timeBasedUsage section
      };

      const result = ApexConfigSchema.parse(legacyConfig);

      expect(result.project.name).toBe('legacy-project');
      expect(result.limits!.dailyBudget).toBe(100.0);
      expect(result.daemon?.timeBasedUsage).toBeUndefined();
    });

    it('should handle migration from basic daemon config to time-based', () => {
      const basicDaemonConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'migrating-project' },
        limits: {
          dailyBudget: 150.0,
          maxCostPerTask: 20.0,
        },
        daemon: {
          pollInterval: 3000,
          autoStart: true,
          // Adding time-based usage to existing daemon config
          timeBasedUsage: {
            enabled: true,
            dayModeCapacityThreshold: 0.75,
          },
        },
      };

      const result = ApexConfigSchema.parse(basicDaemonConfig);

      expect(result.daemon!.pollInterval).toBe(3000);
      expect(result.daemon!.autoStart).toBe(true);
      expect(result.daemon!.timeBasedUsage!.enabled).toBe(true);
      expect(result.daemon!.timeBasedUsage!.dayModeCapacityThreshold).toBe(0.75);
      // Should get defaults for other time-based fields
      expect(result.daemon!.timeBasedUsage!.dayModeHours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
    });

    it('should preserve all daemon features alongside time-based usage', () => {
      const fullDaemonConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'full-daemon-project' },
        daemon: {
          pollInterval: 2000,
          autoStart: true,
          logLevel: 'debug',
          healthCheck: {
            enabled: true,
            interval: 30000,
            timeout: 5000,
          },
          timeBasedUsage: {
            enabled: true,
            dayModeCapacityThreshold: 0.80,
          },
          sessionRecovery: {
            enabled: true,
            autoResume: true,
            checkpointInterval: 90000,
          },
        },
      };

      const result = ApexConfigSchema.parse(fullDaemonConfig);

      // Verify all daemon features are preserved
      expect(result.daemon!.pollInterval).toBe(2000);
      expect(result.daemon!.autoStart).toBe(true);
      expect(result.daemon!.logLevel).toBe('debug');
      expect(result.daemon!.healthCheck!.enabled).toBe(true);
      expect(result.daemon!.timeBasedUsage!.enabled).toBe(true);
      expect(result.daemon!.sessionRecovery!.enabled).toBe(true);
    });
  });

  describe('Configuration Validation Edge Cases', () => {
    it('should handle missing limits section with time-based usage', () => {
      const config: Partial<ApexConfig> = {
        version: '1.0',
        project: { name: 'no-limits-project' },
        daemon: {
          timeBasedUsage: {
            enabled: true,
            dayModeThresholds: {
              maxCostPerTask: 5.0,
            },
          },
        },
      };

      // Should parse successfully - limits section is optional
      const result = ApexConfigSchema.parse(config);

      expect(result.project.name).toBe('no-limits-project');
      expect(result.limits).toBeUndefined();
      expect(result.daemon!.timeBasedUsage!.enabled).toBe(true);
    });

    it('should validate complex multi-section configuration', () => {
      const complexConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'complex-project',
          language: 'typescript',
          framework: 'nextjs',
          testCommand: 'vitest run',
          buildCommand: 'turbo build',
        },
        autonomy: {
          default: 'review-before-merge',
          overrides: {
            documentation: 'full',
            'security-fixes': 'review-before-commit',
          },
        },
        limits: {
          dailyBudget: 500.0,
          maxTokensPerTask: 1000000,
          maxCostPerTask: 50.0,
          maxConcurrentTasks: 8,
          maxTurns: 200,
        },
        git: {
          branchPrefix: 'feature/',
          commitFormat: 'conventional',
          autoPush: true,
        },
        daemon: {
          pollInterval: 4000,
          autoStart: true,
          logLevel: 'info',
          timeBasedUsage: {
            enabled: true,
            dayModeHours: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
            nightModeHours: [21, 22, 23, 0, 1, 2, 3, 4, 5],
            dayModeCapacityThreshold: 0.65,
            nightModeCapacityThreshold: 0.90,
            dayModeThresholds: {
              maxTokensPerTask: 300000,
              maxCostPerTask: 15.0,
              maxConcurrentTasks: 3,
            },
            nightModeThresholds: {
              maxTokensPerTask: 2000000,
              maxCostPerTask: 80.0,
              maxConcurrentTasks: 12,
            },
          },
          healthCheck: {
            enabled: true,
            interval: 45000,
          },
        },
      };

      const result = ApexConfigSchema.parse(complexConfig);

      // Verify all sections are preserved and valid
      expect(result.project.name).toBe('complex-project');
      expect(result.autonomy!.default).toBe('review-before-merge');
      expect(result.limits!.dailyBudget).toBe(500.0);
      expect(result.git!.branchPrefix).toBe('feature/');
      expect(result.daemon!.pollInterval).toBe(4000);
      expect(result.daemon!.timeBasedUsage!.enabled).toBe(true);
      expect(result.daemon!.healthCheck!.enabled).toBe(true);

      // Verify time-based configuration details
      expect(result.daemon!.timeBasedUsage!.dayModeHours!.length).toBe(13);
      expect(result.daemon!.timeBasedUsage!.nightModeHours!.length).toBe(9);
      expect(result.daemon!.timeBasedUsage!.dayModeCapacityThreshold).toBe(0.65);
      expect(result.daemon!.timeBasedUsage!.nightModeThresholds!.maxConcurrentTasks).toBe(12);
    });
  });
});