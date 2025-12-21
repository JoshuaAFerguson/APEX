import { describe, it, expect } from 'vitest';
import {
  IdleTaskTypeSchema,
  IdleTaskType,
  StrategyWeightsSchema,
  StrategyWeights,
  DaemonConfigSchema,
  DaemonConfig,
} from './types';

describe('IdleTaskTypeSchema', () => {
  it('should validate all valid idle task types', () => {
    const validTypes: IdleTaskType[] = ['maintenance', 'refactoring', 'docs', 'tests'];

    validTypes.forEach(type => {
      expect(() => IdleTaskTypeSchema.parse(type)).not.toThrow();
    });
  });

  it('should reject invalid idle task types', () => {
    const invalidTypes = ['invalid', 'test', 'documentation', 'refactor', '', null, undefined, 123];

    invalidTypes.forEach(type => {
      expect(() => IdleTaskTypeSchema.parse(type)).toThrow();
    });
  });

  it('should have correct type inference', () => {
    const type: IdleTaskType = 'maintenance';
    const parsed = IdleTaskTypeSchema.parse(type);

    // Type should be properly inferred
    expect(parsed).toBe('maintenance');
  });
});

describe('StrategyWeightsSchema', () => {
  it('should validate default strategy weights', () => {
    const defaultWeights = {
      maintenance: 0.25,
      refactoring: 0.25,
      docs: 0.25,
      tests: 0.25,
    };

    const result = StrategyWeightsSchema.parse(defaultWeights);
    expect(result).toEqual(defaultWeights);
  });

  it('should apply default values when fields are missing', () => {
    const partialWeights = { maintenance: 0.5 };
    const result = StrategyWeightsSchema.parse(partialWeights);

    expect(result).toEqual({
      maintenance: 0.5,
      refactoring: 0.25,
      docs: 0.25,
      tests: 0.25,
    });
  });

  it('should apply default values for empty object', () => {
    const result = StrategyWeightsSchema.parse({});

    expect(result).toEqual({
      maintenance: 0.25,
      refactoring: 0.25,
      docs: 0.25,
      tests: 0.25,
    });
  });

  it('should validate custom strategy weights within valid range', () => {
    const customWeights = {
      maintenance: 0.0,
      refactoring: 0.3,
      docs: 0.6,
      tests: 1.0,
    };

    const result = StrategyWeightsSchema.parse(customWeights);
    expect(result).toEqual(customWeights);
  });

  it('should reject weights below 0', () => {
    const invalidWeights = [
      { maintenance: -0.1 },
      { refactoring: -1 },
      { docs: -0.01 },
      { tests: -10 },
    ];

    invalidWeights.forEach(weights => {
      expect(() => StrategyWeightsSchema.parse(weights)).toThrow();
    });
  });

  it('should reject weights above 1', () => {
    const invalidWeights = [
      { maintenance: 1.1 },
      { refactoring: 2 },
      { docs: 1.01 },
      { tests: 10 },
    ];

    invalidWeights.forEach(weights => {
      expect(() => StrategyWeightsSchema.parse(weights)).toThrow();
    });
  });

  it('should reject non-numeric values', () => {
    const invalidWeights = [
      { maintenance: 'high' },
      { refactoring: null },
      { docs: undefined },
      { tests: [] },
      { maintenance: {} },
    ];

    invalidWeights.forEach(weights => {
      expect(() => StrategyWeightsSchema.parse(weights)).toThrow();
    });
  });

  it('should ignore extra fields', () => {
    const weightsWithExtra = {
      maintenance: 0.5,
      refactoring: 0.2,
      docs: 0.2,
      tests: 0.1,
      extraField: 'ignored',
    };

    const result = StrategyWeightsSchema.parse(weightsWithExtra);

    // Extra field should not be present in result
    expect(result).toEqual({
      maintenance: 0.5,
      refactoring: 0.2,
      docs: 0.2,
      tests: 0.1,
    });
    expect(result).not.toHaveProperty('extraField');
  });

  it('should handle decimal precision correctly', () => {
    const preciseWeights = {
      maintenance: 0.123456789,
      refactoring: 0.987654321,
      docs: 0.0,
      tests: 1.0,
    };

    const result = StrategyWeightsSchema.parse(preciseWeights);
    expect(result).toEqual(preciseWeights);
  });

  it('should work with boundary values', () => {
    const boundaryWeights = {
      maintenance: 0,
      refactoring: 1,
      docs: 0.0,
      tests: 1.0,
    };

    const result = StrategyWeightsSchema.parse(boundaryWeights);
    expect(result).toEqual(boundaryWeights);
  });
});

describe('DaemonConfig with idleProcessing.strategyWeights', () => {
  it('should validate daemon config with default idle processing', () => {
    const daemonConfig = {
      idleProcessing: {
        enabled: true,
        strategyWeights: {
          maintenance: 0.3,
          refactoring: 0.3,
          docs: 0.2,
          tests: 0.2,
        },
      },
    };

    const result = DaemonConfigSchema.parse(daemonConfig);

    expect(result.idleProcessing?.enabled).toBe(true);
    expect(result.idleProcessing?.strategyWeights).toEqual({
      maintenance: 0.3,
      refactoring: 0.3,
      docs: 0.2,
      tests: 0.2,
    });
  });

  it('should apply defaults when idleProcessing is minimal', () => {
    const daemonConfig = {
      idleProcessing: {
        strategyWeights: {
          maintenance: 0.6,
        },
      },
    };

    const result = DaemonConfigSchema.parse(daemonConfig);

    // Should apply defaults for missing idleProcessing fields
    expect(result.idleProcessing?.enabled).toBe(false); // default
    expect(result.idleProcessing?.idleThreshold).toBe(300000); // default
    expect(result.idleProcessing?.strategyWeights).toEqual({
      maintenance: 0.6,
      refactoring: 0.25, // default
      docs: 0.25, // default
      tests: 0.25, // default
    });
  });

  it('should work when strategyWeights is completely omitted', () => {
    const daemonConfig = {
      idleProcessing: {
        enabled: true,
      },
    };

    const result = DaemonConfigSchema.parse(daemonConfig);

    expect(result.idleProcessing?.enabled).toBe(true);
    expect(result.idleProcessing?.strategyWeights).toBeUndefined();
  });

  it('should work when entire idleProcessing is omitted', () => {
    const daemonConfig = {};

    const result = DaemonConfigSchema.parse(daemonConfig);

    expect(result.idleProcessing).toBeUndefined();
  });

  it('should validate full daemon config with all fields', () => {
    const fullDaemonConfig: Partial<DaemonConfig> = {
      pollInterval: 3000,
      autoStart: true,
      logLevel: 'debug',
      installAsService: true,
      serviceName: 'custom-apex-daemon',
      healthCheck: {
        enabled: true,
        interval: 60000,
        timeout: 10000,
        retries: 5,
      },
      watchdog: {
        enabled: true,
        restartDelay: 10000,
        maxRestarts: 10,
        restartWindow: 600000,
      },
      timeBasedUsage: {
        enabled: true,
        dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
      },
      sessionRecovery: {
        enabled: true,
        autoResume: false,
        checkpointInterval: 30000,
        contextSummarizationThreshold: 25,
      },
      idleProcessing: {
        enabled: true,
        idleThreshold: 180000, // 3 minutes
        taskGenerationInterval: 1800000, // 30 minutes
        maxIdleTasks: 5,
        strategyWeights: {
          maintenance: 0.4,
          refactoring: 0.3,
          docs: 0.2,
          tests: 0.1,
        },
      },
    };

    const result = DaemonConfigSchema.parse(fullDaemonConfig);

    expect(result.idleProcessing?.strategyWeights).toEqual({
      maintenance: 0.4,
      refactoring: 0.3,
      docs: 0.2,
      tests: 0.1,
    });
  });

  it('should reject invalid strategyWeights in daemon config', () => {
    const invalidConfigs = [
      {
        idleProcessing: {
          strategyWeights: {
            maintenance: 1.5, // > 1
          },
        },
      },
      {
        idleProcessing: {
          strategyWeights: {
            refactoring: -0.1, // < 0
          },
        },
      },
      {
        idleProcessing: {
          strategyWeights: {
            docs: 'invalid', // not a number
          },
        },
      },
    ];

    invalidConfigs.forEach(config => {
      expect(() => DaemonConfigSchema.parse(config)).toThrow();
    });
  });
});

describe('Integration: Complete IdleTaskStrategy workflow', () => {
  it('should support creating a complete idle task configuration', () => {
    // Simulate creating a configuration for idle task processing
    const idleTaskTypes: IdleTaskType[] = ['maintenance', 'refactoring', 'docs', 'tests'];
    const strategyWeights: StrategyWeights = {
      maintenance: 0.35,
      refactoring: 0.35,
      docs: 0.20,
      tests: 0.10,
    };

    // Validate individual types
    idleTaskTypes.forEach(type => {
      expect(IdleTaskTypeSchema.parse(type)).toBe(type);
    });

    // Validate strategy weights
    const validatedWeights = StrategyWeightsSchema.parse(strategyWeights);
    expect(validatedWeights).toEqual(strategyWeights);

    // Validate complete daemon configuration
    const daemonConfig = {
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000,
        taskGenerationInterval: 3600000,
        maxIdleTasks: 3,
        strategyWeights: validatedWeights,
      },
    };

    const validatedConfig = DaemonConfigSchema.parse(daemonConfig);
    expect(validatedConfig.idleProcessing?.strategyWeights).toEqual(strategyWeights);
  });

  it('should support balanced strategy weights that sum to 1.0', () => {
    const balancedWeights = {
      maintenance: 0.25,
      refactoring: 0.25,
      docs: 0.25,
      tests: 0.25,
    };

    const total = Object.values(balancedWeights).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBe(1.0);

    const validatedWeights = StrategyWeightsSchema.parse(balancedWeights);
    expect(validatedWeights).toEqual(balancedWeights);
  });

  it('should support unbalanced strategy weights (schema allows but user can choose)', () => {
    // Note: Schema allows weights that don't sum to 1.0
    // This provides flexibility for users to configure different strategies
    const unbalancedWeights = {
      maintenance: 0.8,  // Heavy focus on maintenance
      refactoring: 0.1,
      docs: 0.05,
      tests: 0.05,
    };

    const total = Object.values(unbalancedWeights).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBe(1.0); // This example sums to 1.0 but schema doesn't enforce it

    const validatedWeights = StrategyWeightsSchema.parse(unbalancedWeights);
    expect(validatedWeights).toEqual(unbalancedWeights);
  });

  it('should support minimal weights configuration', () => {
    const minimalWeights = {
      maintenance: 1.0,
      refactoring: 0.0,
      docs: 0.0,
      tests: 0.0,
    };

    const validatedWeights = StrategyWeightsSchema.parse(minimalWeights);
    expect(validatedWeights).toEqual(minimalWeights);
  });
});

describe('Type exports validation', () => {
  it('should properly export IdleTaskType enum values', () => {
    // Ensure all expected enum values are available
    const expectedTypes: IdleTaskType[] = ['maintenance', 'refactoring', 'docs', 'tests'];

    expectedTypes.forEach(type => {
      // This tests that the type can be used as expected
      const validated: IdleTaskType = IdleTaskTypeSchema.parse(type);
      expect(validated).toBe(type);
    });
  });

  it('should properly export StrategyWeights interface', () => {
    // Test that the interface can be used for type checking
    const weights: StrategyWeights = {
      maintenance: 0.25,
      refactoring: 0.25,
      docs: 0.25,
      tests: 0.25,
    };

    expect(weights.maintenance).toBe(0.25);
    expect(weights.refactoring).toBe(0.25);
    expect(weights.docs).toBe(0.25);
    expect(weights.tests).toBe(0.25);
  });

  it('should validate that all schema exports work correctly', () => {
    // Test that all schemas can be imported and used
    expect(IdleTaskTypeSchema).toBeDefined();
    expect(StrategyWeightsSchema).toBeDefined();
    expect(DaemonConfigSchema).toBeDefined();

    // Test basic parsing works
    expect(IdleTaskTypeSchema.parse('maintenance')).toBe('maintenance');
    expect(StrategyWeightsSchema.parse({})).toBeDefined();
    expect(DaemonConfigSchema.parse({})).toBeDefined();
  });
});