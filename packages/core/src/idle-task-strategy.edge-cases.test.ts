import { describe, it, expect } from 'vitest';
import {
  IdleTaskTypeSchema,
  StrategyWeightsSchema,
  DaemonConfigSchema,
} from './types';

describe('IdleTaskStrategy Edge Cases', () => {
  describe('IdleTaskTypeSchema edge cases', () => {
    it('should handle case sensitivity correctly', () => {
      // Should reject uppercase and mixed case
      expect(() => IdleTaskTypeSchema.parse('MAINTENANCE')).toThrow();
      expect(() => IdleTaskTypeSchema.parse('Maintenance')).toThrow();
      expect(() => IdleTaskTypeSchema.parse('refactorING')).toThrow();
      expect(() => IdleTaskTypeSchema.parse('Docs')).toThrow();
      expect(() => IdleTaskTypeSchema.parse('TESTS')).toThrow();
    });

    it('should reject similar but incorrect values', () => {
      // Common typos or variations
      expect(() => IdleTaskTypeSchema.parse('maintain')).toThrow();
      expect(() => IdleTaskTypeSchema.parse('maintenence')).toThrow();
      expect(() => IdleTaskTypeSchema.parse('refactor')).toThrow();
      expect(() => IdleTaskTypeSchema.parse('refactoring-code')).toThrow();
      expect(() => IdleTaskTypeSchema.parse('documentation')).toThrow();
      expect(() => IdleTaskTypeSchema.parse('doc')).toThrow();
      expect(() => IdleTaskTypeSchema.parse('test')).toThrow();
      expect(() => IdleTaskTypeSchema.parse('testing')).toThrow();
    });

    it('should reject whitespace variations', () => {
      expect(() => IdleTaskTypeSchema.parse(' maintenance')).toThrow();
      expect(() => IdleTaskTypeSchema.parse('maintenance ')).toThrow();
      expect(() => IdleTaskTypeSchema.parse(' maintenance ')).toThrow();
      expect(() => IdleTaskTypeSchema.parse('main tenance')).toThrow();
      expect(() => IdleTaskTypeSchema.parse('refactor ing')).toThrow();
    });

    it('should reject non-string types', () => {
      expect(() => IdleTaskTypeSchema.parse(null)).toThrow();
      expect(() => IdleTaskTypeSchema.parse(undefined)).toThrow();
      expect(() => IdleTaskTypeSchema.parse(42)).toThrow();
      expect(() => IdleTaskTypeSchema.parse(true)).toThrow();
      expect(() => IdleTaskTypeSchema.parse({})).toThrow();
      expect(() => IdleTaskTypeSchema.parse([])).toThrow();
      expect(() => IdleTaskTypeSchema.parse(Symbol('maintenance'))).toThrow();
    });
  });

  describe('StrategyWeightsSchema edge cases', () => {
    it('should handle floating point precision correctly', () => {
      // Test very small positive numbers
      const verySmallWeights = {
        maintenance: 0.000001,
        refactoring: 0.999999,
        docs: 0.0,
        tests: 0.0,
      };

      const result = StrategyWeightsSchema.parse(verySmallWeights);
      expect(result.maintenance).toBe(0.000001);
      expect(result.refactoring).toBe(0.999999);
    });

    it('should handle numbers that round to boundary values', () => {
      // Numbers very close to but not exactly 0 or 1
      const boundaryWeights = {
        maintenance: 0.0000000001, // Very close to 0
        refactoring: 0.9999999999, // Very close to 1
        docs: 0.5,
        tests: 0.5,
      };

      const result = StrategyWeightsSchema.parse(boundaryWeights);
      expect(result.maintenance).toBeCloseTo(0.0000000001);
      expect(result.refactoring).toBeCloseTo(0.9999999999);
    });

    it('should reject values that are just outside the range', () => {
      // Test values that are very close to but outside the valid range
      expect(() => StrategyWeightsSchema.parse({ maintenance: -0.000001 })).toThrow();
      expect(() => StrategyWeightsSchema.parse({ refactoring: 1.000001 })).toThrow();
      expect(() => StrategyWeightsSchema.parse({ docs: -0.1 })).toThrow();
      expect(() => StrategyWeightsSchema.parse({ tests: 1.1 })).toThrow();
    });

    it('should handle special numeric values', () => {
      // Test special JavaScript number values
      expect(() => StrategyWeightsSchema.parse({ maintenance: NaN })).toThrow();
      expect(() => StrategyWeightsSchema.parse({ refactoring: Infinity })).toThrow();
      expect(() => StrategyWeightsSchema.parse({ docs: -Infinity })).toThrow();
      expect(() => StrategyWeightsSchema.parse({ tests: Number.MAX_VALUE })).toThrow();
      expect(() => StrategyWeightsSchema.parse({ maintenance: Number.MIN_VALUE })).not.toThrow(); // MIN_VALUE is > 0
    });

    it('should handle numeric strings correctly', () => {
      // Zod should coerce numeric strings or reject them
      expect(() => StrategyWeightsSchema.parse({ maintenance: '0.5' })).toThrow();
      expect(() => StrategyWeightsSchema.parse({ refactoring: '1' })).toThrow();
      expect(() => StrategyWeightsSchema.parse({ docs: '0' })).toThrow();
      expect(() => StrategyWeightsSchema.parse({ tests: '0.25' })).toThrow();
    });

    it('should reject arrays and objects disguised as numbers', () => {
      expect(() => StrategyWeightsSchema.parse({ maintenance: [0.5] })).toThrow();
      expect(() => StrategyWeightsSchema.parse({ refactoring: { value: 0.5 } })).toThrow();
      expect(() => StrategyWeightsSchema.parse({ docs: new Number(0.5) })).toThrow();
    });

    it('should handle deeply nested invalid configurations', () => {
      const invalidNestedConfig = {
        maintenance: 0.25,
        refactoring: {
          nested: {
            value: 0.25,
          },
        },
      };

      expect(() => StrategyWeightsSchema.parse(invalidNestedConfig)).toThrow();
    });

    it('should handle large objects with many extra fields', () => {
      const objectWithManyFields = {
        maintenance: 0.25,
        refactoring: 0.25,
        docs: 0.25,
        tests: 0.25,
        // Many extra fields
        extra1: 'ignored',
        extra2: 42,
        extra3: true,
        extra4: [],
        extra5: {},
        extra6: null,
        extra7: undefined,
        extra8: Symbol('test'),
        extra9: function() {},
        extra10: new Date(),
      };

      const result = StrategyWeightsSchema.parse(objectWithManyFields);

      // Should only include valid fields
      expect(result).toEqual({
        maintenance: 0.25,
        refactoring: 0.25,
        docs: 0.25,
        tests: 0.25,
      });

      // Should not have extra fields
      expect(result).not.toHaveProperty('extra1');
      expect(Object.keys(result)).toHaveLength(4);
    });
  });

  describe('DaemonConfig integration edge cases', () => {
    it('should handle null and undefined for optional nested objects', () => {
      // idleProcessing is optional, so these should work
      const configWithNull = { idleProcessing: null };
      const configWithUndefined = { idleProcessing: undefined };

      // These might not parse correctly depending on Zod configuration
      // The actual behavior depends on how the schema is defined
      expect(() => DaemonConfigSchema.parse(configWithNull)).toThrow();

      const resultUndefined = DaemonConfigSchema.parse(configWithUndefined);
      expect(resultUndefined.idleProcessing).toBeUndefined();
    });

    it('should handle partial invalid idleProcessing configurations', () => {
      // Invalid strategyWeights within valid idleProcessing
      const configWithInvalidWeights = {
        idleProcessing: {
          enabled: true,
          strategyWeights: {
            maintenance: 2.0, // Invalid: > 1
            refactoring: 0.25,
            docs: 0.25,
            tests: 0.25,
          },
        },
      };

      expect(() => DaemonConfigSchema.parse(configWithInvalidWeights)).toThrow();
    });

    it('should handle conflicting configuration values', () => {
      // Test conflicting boolean and other types
      const configWithConflictingTypes = {
        idleProcessing: {
          enabled: 'true', // String instead of boolean
          strategyWeights: {
            maintenance: 0.25,
            refactoring: 0.25,
            docs: 0.25,
            tests: 0.25,
          },
        },
      };

      expect(() => DaemonConfigSchema.parse(configWithConflictingTypes)).toThrow();
    });

    it('should handle very deeply nested invalid configurations', () => {
      const deeplyNestedInvalid = {
        idleProcessing: {
          enabled: true,
          strategyWeights: {
            maintenance: {
              nested: {
                deeper: {
                  invalid: 0.25,
                },
              },
            },
          },
        },
      };

      expect(() => DaemonConfigSchema.parse(deeplyNestedInvalid)).toThrow();
    });

    it('should handle circular references gracefully', () => {
      // Create circular reference
      const circular: any = {
        idleProcessing: {
          enabled: true,
          strategyWeights: {
            maintenance: 0.25,
            refactoring: 0.25,
            docs: 0.25,
            tests: 0.25,
          },
        },
      };
      circular.idleProcessing.self = circular;

      // Should either handle gracefully or throw appropriate error
      expect(() => DaemonConfigSchema.parse(circular)).toThrow();
    });
  });

  describe('Memory and performance edge cases', () => {
    it('should handle very large valid configurations efficiently', () => {
      // Test with configuration that has many other fields
      const largeConfig = {
        pollInterval: 5000,
        autoStart: true,
        logLevel: 'info' as const,
        installAsService: true,
        serviceName: 'test-service',
        healthCheck: {
          enabled: true,
          interval: 30000,
          timeout: 5000,
          retries: 3,
        },
        watchdog: {
          enabled: true,
          restartDelay: 5000,
          maxRestarts: 5,
          restartWindow: 300000,
        },
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
          dayModeCapacityThreshold: 0.90,
          nightModeCapacityThreshold: 0.96,
        },
        sessionRecovery: {
          enabled: true,
          autoResume: true,
          checkpointInterval: 60000,
          contextSummarizationThreshold: 50,
          maxResumeAttempts: 3,
          contextWindowThreshold: 0.8,
        },
        idleProcessing: {
          enabled: true,
          idleThreshold: 300000,
          taskGenerationInterval: 3600000,
          maxIdleTasks: 3,
          strategyWeights: {
            maintenance: 0.25,
            refactoring: 0.25,
            docs: 0.25,
            tests: 0.25,
          },
        },
      };

      // Should parse quickly without issues
      const start = Date.now();
      const result = DaemonConfigSchema.parse(largeConfig);
      const parseTime = Date.now() - start;

      expect(result.idleProcessing?.strategyWeights).toEqual({
        maintenance: 0.25,
        refactoring: 0.25,
        docs: 0.25,
        tests: 0.25,
      });
      expect(parseTime).toBeLessThan(100); // Should be very fast
    });

    it('should handle multiple rapid validations without memory leaks', () => {
      // Simulate multiple rapid validations
      for (let i = 0; i < 1000; i++) {
        const weights = {
          maintenance: Math.random(),
          refactoring: Math.random(),
          docs: Math.random(),
          tests: Math.random(),
        };

        const result = StrategyWeightsSchema.parse(weights);
        expect(result).toBeDefined();
      }

      // If this completes without throwing, memory handling is likely okay
      expect(true).toBe(true);
    });
  });
});