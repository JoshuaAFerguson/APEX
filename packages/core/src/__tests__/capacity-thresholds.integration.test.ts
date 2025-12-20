import { describe, it, expect } from 'vitest';
import { DaemonConfigSchema, ApexConfigSchema } from '../types';

describe('Capacity Thresholds Integration Tests', () => {
  describe('DaemonConfigSchema integration with capacity thresholds', () => {
    it('should integrate capacity thresholds with full daemon configuration', () => {
      const fullConfig = DaemonConfigSchema.parse({
        pollInterval: 8000,
        autoStart: true,
        logLevel: 'debug',
        installAsService: true,
        serviceName: 'apex-daemon-test',
        healthCheck: {
          enabled: true,
          interval: 45000,
          timeout: 8000,
          retries: 5,
        },
        watchdog: {
          enabled: true,
          restartDelay: 3000,
          maxRestarts: 10,
          restartWindow: 600000,
        },
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
          nightModeHours: [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6],
          dayModeCapacityThreshold: 0.82,
          nightModeCapacityThreshold: 0.94,
          dayModeThresholds: {
            maxTokensPerTask: 75000,
            maxCostPerTask: 4.5,
            maxConcurrentTasks: 2,
          },
          nightModeThresholds: {
            maxTokensPerTask: 1500000,
            maxCostPerTask: 18.0,
            maxConcurrentTasks: 6,
          },
        },
        sessionRecovery: {
          enabled: true,
          autoResume: false,
          checkpointInterval: 90000,
          contextSummarizationThreshold: 75,
        },
        idleProcessing: {
          enabled: true,
          idleThreshold: 600000,
          taskGenerationInterval: 7200000,
          maxIdleTasks: 5,
        },
      });

      // Verify all configurations are preserved
      expect(fullConfig.pollInterval).toBe(8000);
      expect(fullConfig.logLevel).toBe('debug');
      expect(fullConfig.installAsService).toBe(true);
      expect(fullConfig.healthCheck?.interval).toBe(45000);
      expect(fullConfig.watchdog?.maxRestarts).toBe(10);
      expect(fullConfig.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.82);
      expect(fullConfig.timeBasedUsage?.nightModeCapacityThreshold).toBe(0.94);
      expect(fullConfig.sessionRecovery?.checkpointInterval).toBe(90000);
      expect(fullConfig.idleProcessing?.maxIdleTasks).toBe(5);
    });

    it('should work with minimal daemon config including capacity thresholds', () => {
      const minimalConfig = DaemonConfigSchema.parse({
        timeBasedUsage: {
          dayModeCapacityThreshold: 0.88,
          nightModeCapacityThreshold: 0.97,
        },
      });

      // Verify defaults are applied while custom thresholds are preserved
      expect(minimalConfig.pollInterval).toBe(5000); // default
      expect(minimalConfig.autoStart).toBe(false); // default
      expect(minimalConfig.logLevel).toBe('info'); // default
      expect(minimalConfig.timeBasedUsage?.enabled).toBe(false); // default
      expect(minimalConfig.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.88);
      expect(minimalConfig.timeBasedUsage?.nightModeCapacityThreshold).toBe(0.97);
    });

    it('should handle multiple capacity threshold configurations in succession', () => {
      const configs = [
        { dayMode: 0.70, nightMode: 0.85 },
        { dayMode: 0.80, nightMode: 0.90 },
        { dayMode: 0.90, nightMode: 0.95 },
        { dayMode: 0.95, nightMode: 0.99 },
        { dayMode: 1.00, nightMode: 1.00 },
      ];

      for (const { dayMode, nightMode } of configs) {
        const config = DaemonConfigSchema.parse({
          timeBasedUsage: {
            enabled: true,
            dayModeCapacityThreshold: dayMode,
            nightModeCapacityThreshold: nightMode,
          },
        });

        expect(config.timeBasedUsage?.dayModeCapacityThreshold).toBe(dayMode);
        expect(config.timeBasedUsage?.nightModeCapacityThreshold).toBe(nightMode);
      }
    });

    it('should validate capacity thresholds are within valid range (0-1)', () => {
      const invalidConfigs = [
        { field: 'dayModeCapacityThreshold', value: -0.01 },
        { field: 'nightModeCapacityThreshold', value: -1.0 },
        { field: 'dayModeCapacityThreshold', value: 1.01 },
        { field: 'nightModeCapacityThreshold', value: 2.0 },
        { field: 'dayModeCapacityThreshold', value: Number.POSITIVE_INFINITY },
        { field: 'nightModeCapacityThreshold', value: Number.NEGATIVE_INFINITY },
        { field: 'dayModeCapacityThreshold', value: Number.NaN },
      ];

      for (const { field, value } of invalidConfigs) {
        expect(() => {
          DaemonConfigSchema.parse({
            timeBasedUsage: {
              enabled: true,
              [field]: value,
            },
          });
        }).toThrow();
      }
    });

    it('should preserve precision for fractional threshold values', () => {
      const precisionTests = [
        0.123456789,
        0.987654321,
        0.555555555,
        0.777777777,
        0.999999999,
      ];

      for (const threshold of precisionTests) {
        const config = DaemonConfigSchema.parse({
          timeBasedUsage: {
            enabled: true,
            dayModeCapacityThreshold: threshold,
            nightModeCapacityThreshold: threshold,
          },
        });

        expect(config.timeBasedUsage?.dayModeCapacityThreshold).toBeCloseTo(threshold, 9);
        expect(config.timeBasedUsage?.nightModeCapacityThreshold).toBeCloseTo(threshold, 9);
      }
    });
  });

  describe('ApexConfig integration with capacity thresholds', () => {
    it('should work within full ApexConfig with daemon capacity thresholds', () => {
      const apexConfig = ApexConfigSchema.parse({
        version: '1.0',
        project: {
          name: 'capacity-test-project',
          language: 'typescript',
          framework: 'nextjs',
        },
        autonomy: {
          default: 'review-before-merge',
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku',
        },
        limits: {
          maxTokensPerTask: 200000,
          maxCostPerTask: 8.0,
          dailyBudget: 60.0,
        },
        daemon: {
          pollInterval: 7000,
          autoStart: true,
          logLevel: 'warn',
          timeBasedUsage: {
            enabled: true,
            dayModeCapacityThreshold: 0.78,
            nightModeCapacityThreshold: 0.93,
            dayModeThresholds: {
              maxTokensPerTask: 80000,
              maxCostPerTask: 4.0,
              maxConcurrentTasks: 2,
            },
            nightModeThresholds: {
              maxTokensPerTask: 1200000,
              maxCostPerTask: 15.0,
              maxConcurrentTasks: 7,
            },
          },
        },
      });

      // Verify the full configuration hierarchy is preserved
      expect(apexConfig.project.name).toBe('capacity-test-project');
      expect(apexConfig.limits?.maxTokensPerTask).toBe(200000);
      expect(apexConfig.daemon?.pollInterval).toBe(7000);
      expect(apexConfig.daemon?.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.78);
      expect(apexConfig.daemon?.timeBasedUsage?.nightModeCapacityThreshold).toBe(0.93);
      expect(apexConfig.daemon?.timeBasedUsage?.dayModeThresholds?.maxTokensPerTask).toBe(80000);
      expect(apexConfig.daemon?.timeBasedUsage?.nightModeThresholds?.maxTokensPerTask).toBe(1200000);
    });

    it('should apply daemon defaults when capacity thresholds are specified in ApexConfig', () => {
      const apexConfig = ApexConfigSchema.parse({
        project: {
          name: 'minimal-capacity-test',
        },
        daemon: {
          timeBasedUsage: {
            dayModeCapacityThreshold: 0.75,
            nightModeCapacityThreshold: 0.87,
          },
        },
      });

      expect(apexConfig.daemon?.pollInterval).toBe(5000); // default
      expect(apexConfig.daemon?.autoStart).toBe(false); // default
      expect(apexConfig.daemon?.logLevel).toBe('info'); // default
      expect(apexConfig.daemon?.timeBasedUsage?.enabled).toBe(false); // default
      expect(apexConfig.daemon?.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.75);
      expect(apexConfig.daemon?.timeBasedUsage?.nightModeCapacityThreshold).toBe(0.87);
    });

    it('should work without daemon configuration in ApexConfig', () => {
      const apexConfig = ApexConfigSchema.parse({
        project: {
          name: 'no-daemon-test',
        },
      });

      expect(apexConfig.daemon).toBeUndefined();
    });
  });

  describe('Real-world usage scenarios', () => {
    it('should handle development vs production threshold configurations', () => {
      const devConfig = DaemonConfigSchema.parse({
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 0.70,    // Lower threshold for dev (more conservative)
          nightModeCapacityThreshold: 0.85,  // Lower threshold for dev
          dayModeThresholds: {
            maxTokensPerTask: 50000,
            maxCostPerTask: 2.0,
            maxConcurrentTasks: 1,
          },
          nightModeThresholds: {
            maxTokensPerTask: 100000,
            maxCostPerTask: 4.0,
            maxConcurrentTasks: 2,
          },
        },
      });

      const prodConfig = DaemonConfigSchema.parse({
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 0.90,    // Higher threshold for prod (more aggressive)
          nightModeCapacityThreshold: 0.96,  // Higher threshold for prod
          dayModeThresholds: {
            maxTokensPerTask: 200000,
            maxCostPerTask: 8.0,
            maxConcurrentTasks: 4,
          },
          nightModeThresholds: {
            maxTokensPerTask: 2000000,
            maxCostPerTask: 25.0,
            maxConcurrentTasks: 10,
          },
        },
      });

      expect(devConfig.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.70);
      expect(devConfig.timeBasedUsage?.nightModeCapacityThreshold).toBe(0.85);
      expect(prodConfig.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.90);
      expect(prodConfig.timeBasedUsage?.nightModeCapacityThreshold).toBe(0.96);
    });

    it('should handle team vs personal threshold configurations', () => {
      const personalConfig = DaemonConfigSchema.parse({
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 0.85,    // Moderate threshold for personal use
          nightModeCapacityThreshold: 0.92,
          dayModeThresholds: {
            maxConcurrentTasks: 2,
          },
          nightModeThresholds: {
            maxConcurrentTasks: 4,
          },
        },
      });

      const teamConfig = DaemonConfigSchema.parse({
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 0.95,    // Higher threshold for team shared resources
          nightModeCapacityThreshold: 0.98,
          dayModeThresholds: {
            maxConcurrentTasks: 8,
          },
          nightModeThresholds: {
            maxConcurrentTasks: 15,
          },
        },
      });

      expect(personalConfig.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.85);
      expect(teamConfig.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.95);
      expect(personalConfig.timeBasedUsage?.dayModeThresholds?.maxConcurrentTasks).toBe(2);
      expect(teamConfig.timeBasedUsage?.dayModeThresholds?.maxConcurrentTasks).toBe(8);
    });

    it('should handle cost-sensitive vs performance-focused configurations', () => {
      const costSensitiveConfig = DaemonConfigSchema.parse({
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 0.60,    // Very conservative to minimize costs
          nightModeCapacityThreshold: 0.75,
          dayModeThresholds: {
            maxTokensPerTask: 25000,
            maxCostPerTask: 1.0,
            maxConcurrentTasks: 1,
          },
          nightModeThresholds: {
            maxTokensPerTask: 75000,
            maxCostPerTask: 3.0,
            maxConcurrentTasks: 2,
          },
        },
      });

      const performanceFocusedConfig = DaemonConfigSchema.parse({
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 0.98,    // Very aggressive for maximum performance
          nightModeCapacityThreshold: 1.00,  // Allow full utilization at night
          dayModeThresholds: {
            maxTokensPerTask: 500000,
            maxCostPerTask: 20.0,
            maxConcurrentTasks: 10,
          },
          nightModeThresholds: {
            maxTokensPerTask: 5000000,
            maxCostPerTask: 100.0,
            maxConcurrentTasks: 25,
          },
        },
      });

      expect(costSensitiveConfig.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.60);
      expect(performanceFocusedConfig.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.98);
      expect(performanceFocusedConfig.timeBasedUsage?.nightModeCapacityThreshold).toBe(1.00);
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle empty timeBasedUsage object', () => {
      const config = DaemonConfigSchema.parse({
        timeBasedUsage: {},
      });

      expect(config.timeBasedUsage?.enabled).toBe(false); // default
      expect(config.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.90); // default
      expect(config.timeBasedUsage?.nightModeCapacityThreshold).toBe(0.96); // default
    });

    it('should validate that capacity thresholds are numbers', () => {
      const invalidTypes = [
        'string',
        true,
        false,
        [],
        {},
        null,
        undefined,
      ];

      for (const invalidValue of invalidTypes) {
        expect(() => {
          DaemonConfigSchema.parse({
            timeBasedUsage: {
              dayModeCapacityThreshold: invalidValue,
            },
          });
        }).toThrow();

        expect(() => {
          DaemonConfigSchema.parse({
            timeBasedUsage: {
              nightModeCapacityThreshold: invalidValue,
            },
          });
        }).toThrow();
      }
    });

    it('should handle scientific notation for threshold values', () => {
      const scientificNotationValues = [
        1e-1,    // 0.1
        9e-1,    // 0.9
        5e-1,    // 0.5
        1e0,     // 1.0
      ];

      for (const value of scientificNotationValues) {
        const config = DaemonConfigSchema.parse({
          timeBasedUsage: {
            dayModeCapacityThreshold: value,
            nightModeCapacityThreshold: value,
          },
        });

        expect(config.timeBasedUsage?.dayModeCapacityThreshold).toBeCloseTo(value, 10);
        expect(config.timeBasedUsage?.nightModeCapacityThreshold).toBeCloseTo(value, 10);
      }
    });

    it('should properly serialize and deserialize capacity threshold configurations', () => {
      const originalConfig = {
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 0.876,
          nightModeCapacityThreshold: 0.943,
        },
      };

      // Simulate serialization/deserialization
      const serialized = JSON.stringify(originalConfig);
      const deserialized = JSON.parse(serialized);
      const parsedConfig = DaemonConfigSchema.parse(deserialized);

      expect(parsedConfig.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.876);
      expect(parsedConfig.timeBasedUsage?.nightModeCapacityThreshold).toBe(0.943);
    });
  });
});