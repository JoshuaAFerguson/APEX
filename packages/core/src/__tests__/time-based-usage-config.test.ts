import { describe, it, expect } from 'vitest';
import { DaemonConfigSchema, type DaemonConfig } from '../types';

describe('Time-Based Usage Configuration Validation', () => {
  describe('Schema Validation', () => {
    it('should validate default time-based usage configuration', () => {
      const config: DaemonConfig = {
        timeBasedUsage: {
          enabled: true,
        }
      };

      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage).toBeDefined();
      expect(result.timeBasedUsage!.enabled).toBe(true);
      expect(result.timeBasedUsage!.dayModeHours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
      expect(result.timeBasedUsage!.nightModeHours).toEqual([22, 23, 0, 1, 2, 3, 4, 5, 6]);
      expect(result.timeBasedUsage!.dayModeCapacityThreshold).toBe(0.90);
      expect(result.timeBasedUsage!.nightModeCapacityThreshold).toBe(0.96);
    });

    it('should validate custom time windows', () => {
      const config: DaemonConfig = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
          nightModeHours: [21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7],
        }
      };

      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage!.dayModeHours).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
      expect(result.timeBasedUsage!.nightModeHours).toEqual([21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it('should validate capacity thresholds', () => {
      const config: DaemonConfig = {
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 0.80,
          nightModeCapacityThreshold: 0.95,
        }
      };

      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage!.dayModeCapacityThreshold).toBe(0.80);
      expect(result.timeBasedUsage!.nightModeCapacityThreshold).toBe(0.95);
    });

    it('should validate per-mode resource thresholds', () => {
      const config: DaemonConfig = {
        timeBasedUsage: {
          enabled: true,
          dayModeThresholds: {
            maxTokensPerTask: 50000,
            maxCostPerTask: 2.5,
            maxConcurrentTasks: 1,
          },
          nightModeThresholds: {
            maxTokensPerTask: 2000000,
            maxCostPerTask: 50.0,
            maxConcurrentTasks: 8,
          },
        }
      };

      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage!.dayModeThresholds).toEqual({
        maxTokensPerTask: 50000,
        maxCostPerTask: 2.5,
        maxConcurrentTasks: 1,
      });
      expect(result.timeBasedUsage!.nightModeThresholds).toEqual({
        maxTokensPerTask: 2000000,
        maxCostPerTask: 50.0,
        maxConcurrentTasks: 8,
      });
    });

    it('should use default values for optional threshold fields', () => {
      const config: DaemonConfig = {
        timeBasedUsage: {
          enabled: true,
          dayModeThresholds: {},
          nightModeThresholds: {},
        }
      };

      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage!.dayModeThresholds).toEqual({
        maxTokensPerTask: 100000,
        maxCostPerTask: 5.0,
        maxConcurrentTasks: 2,
      });
      expect(result.timeBasedUsage!.nightModeThresholds).toEqual({
        maxTokensPerTask: 1000000,
        maxCostPerTask: 20.0,
        maxConcurrentTasks: 5,
      });
    });
  });

  describe('Edge Cases and Validation Rules', () => {
    it('should reject invalid hour values', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, 25], // Invalid hour 25
        }
      };

      expect(() => DaemonConfigSchema.parse(config)).toThrow();
    });

    it('should reject negative hour values', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, -1], // Invalid hour -1
        }
      };

      expect(() => DaemonConfigSchema.parse(config)).toThrow();
    });

    it('should reject capacity thresholds outside 0-1 range', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 1.5, // Invalid: > 1
        }
      };

      expect(() => DaemonConfigSchema.parse(config)).toThrow();
    });

    it('should reject negative capacity thresholds', () => {
      const config = {
        timeBasedUsage: {
          enabled: true,
          nightModeCapacityThreshold: -0.1, // Invalid: < 0
        }
      };

      expect(() => DaemonConfigSchema.parse(config)).toThrow();
    });

    it('should allow empty time mode arrays', () => {
      const config: DaemonConfig = {
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

    it('should allow overlapping time windows', () => {
      const config: DaemonConfig = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
          nightModeHours: [16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2], // Overlap at 16, 17, 18
        }
      };

      // Schema validation should pass - business logic validation is separate
      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage!.dayModeHours).toContain(16);
      expect(result.timeBasedUsage!.nightModeHours).toContain(16);
    });

    it('should allow midnight spanning time windows', () => {
      const config: DaemonConfig = {
        timeBasedUsage: {
          enabled: true,
          nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5], // Spans midnight
        }
      };

      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage!.nightModeHours).toEqual([22, 23, 0, 1, 2, 3, 4, 5]);
    });
  });

  describe('Configuration Patterns', () => {
    it('should validate development environment pattern', () => {
      const config: DaemonConfig = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nightModeHours: [], // No night mode
          dayModeCapacityThreshold: 0.70,
          dayModeThresholds: {
            maxTokensPerTask: 50000,
            maxCostPerTask: 2.0,
            maxConcurrentTasks: 1,
          },
        }
      };

      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage!.nightModeHours).toEqual([]);
      expect(result.timeBasedUsage!.dayModeCapacityThreshold).toBe(0.70);
      expect(result.timeBasedUsage!.dayModeThresholds!.maxConcurrentTasks).toBe(1);
    });

    it('should validate production environment pattern', () => {
      const config: DaemonConfig = {
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
        }
      };

      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage!.dayModeCapacityThreshold).toBe(0.60);
      expect(result.timeBasedUsage!.nightModeCapacityThreshold).toBe(0.95);
      expect(result.timeBasedUsage!.nightModeThresholds!.maxCostPerTask).toBe(50.0);
    });

    it('should validate cost-optimized pattern', () => {
      const config: DaemonConfig = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nightModeHours: [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7],
          dayModeCapacityThreshold: 0.30,
          nightModeCapacityThreshold: 0.98,
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
        }
      };

      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage!.dayModeCapacityThreshold).toBe(0.30);
      expect(result.timeBasedUsage!.nightModeThresholds!.maxTokensPerTask).toBe(5000000);
    });
  });

  describe('Disabled Configuration', () => {
    it('should handle disabled time-based usage', () => {
      const config: DaemonConfig = {
        timeBasedUsage: {
          enabled: false,
        }
      };

      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage!.enabled).toBe(false);
      // Other fields should still get defaults even when disabled
      expect(result.timeBasedUsage!.dayModeHours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
    });

    it('should handle missing timeBasedUsage section', () => {
      const config: DaemonConfig = {};

      const result = DaemonConfigSchema.parse(config);
      expect(result.timeBasedUsage).toBeUndefined();
    });
  });

  describe('Integration with Other Daemon Config', () => {
    it('should work alongside other daemon configuration', () => {
      const config: DaemonConfig = {
        pollInterval: 3000,
        autoStart: true,
        logLevel: 'debug',
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 0.75,
        },
        healthCheck: {
          enabled: true,
          interval: 60000,
        },
      };

      const result = DaemonConfigSchema.parse(config);
      expect(result.pollInterval).toBe(3000);
      expect(result.autoStart).toBe(true);
      expect(result.logLevel).toBe('debug');
      expect(result.timeBasedUsage!.enabled).toBe(true);
      expect(result.timeBasedUsage!.dayModeCapacityThreshold).toBe(0.75);
      expect(result.healthCheck!.interval).toBe(60000);
    });
  });
});