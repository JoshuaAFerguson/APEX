import { describe, it, expect } from 'vitest';
import { DaemonConfigSchema, type DaemonConfig } from '../types';
import { z } from 'zod';

describe('Time-Based Usage Configuration Schema Validation', () => {
  describe('Valid Configuration Patterns', () => {
    it('should validate minimal enabled configuration', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
        }
      };

      const result = DaemonConfigSchema.parse(config);

      // Should apply defaults for all optional fields
      expect(result.timeBasedUsage!.enabled).toBe(true);
      expect(result.timeBasedUsage!.dayModeHours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
      expect(result.timeBasedUsage!.nightModeHours).toEqual([22, 23, 0, 1, 2, 3, 4, 5, 6]);
      expect(result.timeBasedUsage!.dayModeCapacityThreshold).toBe(0.90);
      expect(result.timeBasedUsage!.nightModeCapacityThreshold).toBe(0.96);
    });

    it('should validate full configuration with all fields', () => {
      const config: DaemonConfig = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
          nightModeHours: [21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7],
          dayModeCapacityThreshold: 0.75,
          nightModeCapacityThreshold: 0.95,
          dayModeThresholds: {
            maxTokensPerTask: 150000,
            maxCostPerTask: 7.5,
            maxConcurrentTasks: 3,
          },
          nightModeThresholds: {
            maxTokensPerTask: 2000000,
            maxCostPerTask: 50.0,
            maxConcurrentTasks: 8,
          },
        },
      };

      const result = DaemonConfigSchema.parse(config);

      expect(result.timeBasedUsage!.dayModeHours).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
      expect(result.timeBasedUsage!.nightModeHours).toEqual([21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7]);
      expect(result.timeBasedUsage!.dayModeCapacityThreshold).toBe(0.75);
      expect(result.timeBasedUsage!.nightModeCapacityThreshold).toBe(0.95);
      expect(result.timeBasedUsage!.dayModeThresholds).toEqual({
        maxTokensPerTask: 150000,
        maxCostPerTask: 7.5,
        maxConcurrentTasks: 3,
      });
      expect(result.timeBasedUsage!.nightModeThresholds).toEqual({
        maxTokensPerTask: 2000000,
        maxCostPerTask: 50.0,
        maxConcurrentTasks: 8,
      });
    });

    it('should validate disabled configuration', () => {
      const config = {
        timeBasedUsage: {
          enabled: false,
        }
      };

      const result = DaemonConfigSchema.parse(config);

      expect(result.timeBasedUsage!.enabled).toBe(false);
      // Should still have defaults even when disabled
      expect(result.timeBasedUsage!.dayModeHours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
    });
  });

  describe('Edge Cases and Boundary Values', () => {
    it('should accept empty time mode arrays', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [],
          nightModeHours: [],
        }
      };

      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage!.dayModeHours).toEqual([]);
      expect(result.timeBasedUsage!.nightModeHours).toEqual([]);
    });

    it('should accept all hours in day mode', () => {
      const allHours = Array.from({ length: 24 }, (_, i) => i);
      const config = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: allHours,
        }
      };

      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage!.dayModeHours).toEqual(allHours);
    });

    it('should accept midnight-spanning time windows', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          nightModeHours: [22, 23, 0, 1, 2, 3, 4], // Spans midnight
        }
      };

      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage!.nightModeHours).toEqual([22, 23, 0, 1, 2, 3, 4]);
    });

    it('should accept overlapping time windows', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
          nightModeHours: [16, 17, 18, 19, 20, 21, 22, 23, 0, 1], // Overlap at 16, 17, 18
        }
      };

      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage!.dayModeHours).toContain(16);
      expect(result.timeBasedUsage!.nightModeHours).toContain(16);
    });

    it('should accept boundary threshold values', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 0.0, // Minimum
          nightModeCapacityThreshold: 1.0, // Maximum
        }
      };

      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage!.dayModeCapacityThreshold).toBe(0.0);
      expect(result.timeBasedUsage!.nightModeCapacityThreshold).toBe(1.0);
    });

    it('should handle partial threshold configurations', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          dayModeThresholds: {
            maxTokensPerTask: 200000,
            // Missing other fields
          },
          nightModeThresholds: {
            maxCostPerTask: 30.0,
            // Missing other fields
          },
        }
      };

      const result = DaemonConfigSchema.parse(config);

      // Should apply defaults for missing fields
      expect(result.timeBasedUsage!.dayModeThresholds!.maxTokensPerTask).toBe(200000);
      expect(result.timeBasedUsage!.dayModeThresholds!.maxCostPerTask).toBe(5.0); // Default
      expect(result.timeBasedUsage!.dayModeThresholds!.maxConcurrentTasks).toBe(2); // Default

      expect(result.timeBasedUsage!.nightModeThresholds!.maxCostPerTask).toBe(30.0);
      expect(result.timeBasedUsage!.nightModeThresholds!.maxTokensPerTask).toBe(1000000); // Default
      expect(result.timeBasedUsage!.nightModeThresholds!.maxConcurrentTasks).toBe(5); // Default
    });
  });

  describe('Invalid Configuration Rejection', () => {
    it('should reject invalid hour values above 23', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 25], // Invalid hour
        }
      };

      expect(() => DaemonConfigSchema.parse(config)).toThrow();
    });

    it('should reject negative hour values', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, -1], // Invalid hour
        }
      };

      expect(() => DaemonConfigSchema.parse(config)).toThrow();
    });

    it('should reject fractional hour values', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11.5], // Invalid fractional hour
        }
      };

      expect(() => DaemonConfigSchema.parse(config)).toThrow();
    });

    it('should reject capacity thresholds above 1.0', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 1.5, // Invalid: > 1.0
        }
      };

      expect(() => DaemonConfigSchema.parse(config)).toThrow();
    });

    it('should reject negative capacity thresholds', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          nightModeCapacityThreshold: -0.1, // Invalid: < 0.0
        }
      };

      expect(() => DaemonConfigSchema.parse(config)).toThrow();
    });

    it('should reject non-boolean enabled values', () => {
      const config = {
        timeBasedUsage: {
          enabled: 'true', // Should be boolean, not string
        }
      };

      expect(() => DaemonConfigSchema.parse(config)).toThrow();
    });

    it('should reject non-numeric threshold values', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          dayModeThresholds: {
            maxTokensPerTask: '100000', // Should be number, not string
          },
        }
      };

      expect(() => DaemonConfigSchema.parse(config)).toThrow();
    });

    it('should reject negative threshold values', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          dayModeThresholds: {
            maxTokensPerTask: -1000, // Invalid negative value
          },
        }
      };

      expect(() => DaemonConfigSchema.parse(config)).toThrow();
    });

    it('should reject non-array hour values', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: 'morning', // Should be array, not string
        }
      };

      expect(() => DaemonConfigSchema.parse(config)).toThrow();
    });
  });

  describe('Type Safety and Coercion', () => {
    it('should not coerce string numbers to numbers', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: '0.8', // String instead of number
        }
      };

      expect(() => DaemonConfigSchema.parse(config)).toThrow();
    });

    it('should preserve exact numeric values', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 0.123456789,
          nightModeCapacityThreshold: 0.987654321,
        }
      };

      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage!.dayModeCapacityThreshold).toBe(0.123456789);
      expect(result.timeBasedUsage!.nightModeCapacityThreshold).toBe(0.987654321);
    });

    it('should preserve integer hour values', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [0, 12, 23], // Boundary hours
        }
      };

      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage!.dayModeHours).toEqual([0, 12, 23]);
    });
  });

  describe('Complex Validation Scenarios', () => {
    it('should validate realistic production configuration', () => {
      const productionConfig = {
        pollInterval: 3000,
        autoStart: true,
        logLevel: 'info' as const,
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
          nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5],
          dayModeCapacityThreshold: 0.60,
          nightModeCapacityThreshold: 0.95,
          dayModeThresholds: {
            maxTokensPerTask: 200000,
            maxCostPerTask: 8.0,
            maxConcurrentTasks: 3,
          },
          nightModeThresholds: {
            maxTokensPerTask: 2000000,
            maxCostPerTask: 50.0,
            maxConcurrentTasks: 8,
          },
        },
        healthCheck: {
          enabled: true,
          interval: 60000,
        },
      };

      const result = DaemonConfigSchema.parse(productionConfig);

      expect(result.pollInterval).toBe(3000);
      expect(result.autoStart).toBe(true);
      expect(result.logLevel).toBe('info');
      expect(result.timeBasedUsage!.enabled).toBe(true);
      expect(result.healthCheck!.enabled).toBe(true);
    });

    it('should validate development configuration', () => {
      const devConfig = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nightModeHours: [], // No night mode in dev
          dayModeCapacityThreshold: 0.50, // Conservative
          dayModeThresholds: {
            maxTokensPerTask: 50000,
            maxCostPerTask: 2.0,
            maxConcurrentTasks: 1,
          },
        },
      };

      const result = DaemonConfigSchema.parse(devConfig);

      expect(result.timeBasedUsage!.nightModeHours).toEqual([]);
      expect(result.timeBasedUsage!.dayModeCapacityThreshold).toBe(0.50);
      expect(result.timeBasedUsage!.dayModeThresholds!.maxConcurrentTasks).toBe(1);
    });

    it('should validate cost-optimized configuration', () => {
      const costOptimizedConfig = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nightModeHours: [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8], // Extended night
          dayModeCapacityThreshold: 0.25, // Very conservative during day
          nightModeCapacityThreshold: 0.98, // Aggressive at night
          dayModeThresholds: {
            maxTokensPerTask: 25000,
            maxCostPerTask: 1.0,
            maxConcurrentTasks: 1,
          },
          nightModeThresholds: {
            maxTokensPerTask: 5000000,
            maxCostPerTask: 100.0,
            maxConcurrentTasks: 10,
          },
        },
      };

      const result = DaemonConfigSchema.parse(costOptimizedConfig);

      expect(result.timeBasedUsage!.dayModeCapacityThreshold).toBe(0.25);
      expect(result.timeBasedUsage!.nightModeCapacityThreshold).toBe(0.98);
      expect(result.timeBasedUsage!.nightModeHours!.length).toBe(13); // Extended night hours
    });
  });

  describe('Schema Evolution and Backward Compatibility', () => {
    it('should handle missing timeBasedUsage section gracefully', () => {
      const config = {
        pollInterval: 5000,
        autoStart: false,
      };

      const result = DaemonConfigSchema.parse(config);

      expect(result.timeBasedUsage).toBeUndefined();
      expect(result.pollInterval).toBe(5000);
      expect(result.autoStart).toBe(false);
    });

    it('should use proper defaults for omitted optional fields', () => {
      const minimalConfig = {
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 0.8,
          // All other fields omitted
        }
      };

      const result = DaemonConfigSchema.parse(minimalConfig);

      expect(result.timeBasedUsage!.enabled).toBe(true);
      expect(result.timeBasedUsage!.dayModeCapacityThreshold).toBe(0.8);
      expect(result.timeBasedUsage!.nightModeCapacityThreshold).toBe(0.96); // Default
      expect(result.timeBasedUsage!.dayModeHours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]); // Default
      expect(result.timeBasedUsage!.nightModeHours).toEqual([22, 23, 0, 1, 2, 3, 4, 5, 6]); // Default
    });

    it('should handle extra unknown fields gracefully', () => {
      const configWithExtraFields = {
        timeBasedUsage: {
          enabled: true,
          unknownField: 'should be ignored',
          dayModeHours: [9, 10, 11, 12],
          anotherUnknownField: 42,
        }
      };

      // Schema should parse successfully and ignore unknown fields
      const result = DaemonConfigSchema.parse(configWithExtraFields);

      expect(result.timeBasedUsage!.enabled).toBe(true);
      expect(result.timeBasedUsage!.dayModeHours).toEqual([9, 10, 11, 12]);
      expect((result.timeBasedUsage as any).unknownField).toBeUndefined();
    });
  });
});