import { describe, it, expect } from 'vitest';

// Test that all types and schemas can be imported correctly from the main module
import {
  // Types
  IdleTaskType,
  StrategyWeights,
  DaemonConfig,
  ApexConfig,
  // Schemas
  IdleTaskTypeSchema,
  StrategyWeightsSchema,
  DaemonConfigSchema,
  ApexConfigSchema,
} from './index';

describe('IdleTaskStrategy Exports', () => {
  it('should export IdleTaskType enum correctly', () => {
    // Test that the type can be used for type annotations
    const taskType: IdleTaskType = 'maintenance';
    expect(taskType).toBe('maintenance');

    // Test all valid values
    const validTypes: IdleTaskType[] = ['maintenance', 'refactoring', 'docs', 'tests'];
    validTypes.forEach(type => {
      const validated: IdleTaskType = type;
      expect(validated).toBe(type);
    });
  });

  it('should export StrategyWeights type correctly', () => {
    // Test that the interface can be used for type annotations
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

  it('should export IdleTaskTypeSchema correctly', () => {
    expect(IdleTaskTypeSchema).toBeDefined();
    expect(typeof IdleTaskTypeSchema.parse).toBe('function');

    // Test schema validation
    expect(IdleTaskTypeSchema.parse('maintenance')).toBe('maintenance');
    expect(IdleTaskTypeSchema.parse('refactoring')).toBe('refactoring');
    expect(IdleTaskTypeSchema.parse('docs')).toBe('docs');
    expect(IdleTaskTypeSchema.parse('tests')).toBe('tests');

    // Test invalid values
    expect(() => IdleTaskTypeSchema.parse('invalid')).toThrow();
  });

  it('should export StrategyWeightsSchema correctly', () => {
    expect(StrategyWeightsSchema).toBeDefined();
    expect(typeof StrategyWeightsSchema.parse).toBe('function');

    // Test schema validation with defaults
    const result = StrategyWeightsSchema.parse({});
    expect(result).toEqual({
      maintenance: 0.25,
      refactoring: 0.25,
      docs: 0.25,
      tests: 0.25,
    });

    // Test custom values
    const customWeights = {
      maintenance: 0.5,
      refactoring: 0.3,
      docs: 0.15,
      tests: 0.05,
    };
    const customResult = StrategyWeightsSchema.parse(customWeights);
    expect(customResult).toEqual(customWeights);
  });

  it('should export DaemonConfigSchema with idleProcessing integration', () => {
    expect(DaemonConfigSchema).toBeDefined();
    expect(typeof DaemonConfigSchema.parse).toBe('function');

    // Test that idleProcessing with strategyWeights works
    const configWithIdleProcessing = {
      idleProcessing: {
        enabled: true,
        strategyWeights: {
          maintenance: 0.4,
          refactoring: 0.3,
          docs: 0.2,
          tests: 0.1,
        },
      },
    };

    const result = DaemonConfigSchema.parse(configWithIdleProcessing);
    expect(result.idleProcessing?.enabled).toBe(true);
    expect(result.idleProcessing?.strategyWeights).toEqual({
      maintenance: 0.4,
      refactoring: 0.3,
      docs: 0.2,
      tests: 0.1,
    });
  });

  it('should export ApexConfigSchema with daemon.idleProcessing integration', () => {
    expect(ApexConfigSchema).toBeDefined();
    expect(typeof ApexConfigSchema.parse).toBe('function');

    // Test full integration
    const fullConfig = {
      version: '1.0',
      project: {
        name: 'test-project',
      },
      daemon: {
        idleProcessing: {
          enabled: true,
          strategyWeights: {
            maintenance: 0.3,
            refactoring: 0.3,
            docs: 0.2,
            tests: 0.2,
          },
        },
      },
    };

    const result = ApexConfigSchema.parse(fullConfig);
    expect(result.daemon?.idleProcessing?.enabled).toBe(true);
    expect(result.daemon?.idleProcessing?.strategyWeights).toEqual({
      maintenance: 0.3,
      refactoring: 0.3,
      docs: 0.2,
      tests: 0.2,
    });
  });

  it('should support type-safe usage patterns', () => {
    // Demonstrate type-safe usage
    const createIdleTaskConfig = (
      taskType: IdleTaskType,
      weights: StrategyWeights
    ): DaemonConfig => {
      return DaemonConfigSchema.parse({
        idleProcessing: {
          enabled: true,
          strategyWeights: weights,
        },
      });
    };

    const taskType: IdleTaskType = 'maintenance';
    const weights: StrategyWeights = {
      maintenance: 0.5,
      refactoring: 0.3,
      docs: 0.15,
      tests: 0.05,
    };

    const config = createIdleTaskConfig(taskType, weights);
    expect(config.idleProcessing?.strategyWeights).toEqual(weights);
  });

  it('should validate that all required types are exported', () => {
    // Verify that the main types module exports include our new types

    // Check type constructors exist (will throw if types don't exist)
    const idleType: IdleTaskType = 'maintenance';
    const weights: StrategyWeights = {
      maintenance: 0.25,
      refactoring: 0.25,
      docs: 0.25,
      tests: 0.25,
    };

    // Check schemas exist and are callable
    expect(() => IdleTaskTypeSchema.parse(idleType)).not.toThrow();
    expect(() => StrategyWeightsSchema.parse(weights)).not.toThrow();
    expect(() => DaemonConfigSchema.parse({})).not.toThrow();
    expect(() => ApexConfigSchema.parse({
      project: { name: 'test' }
    })).not.toThrow();
  });

  it('should be backwards compatible with existing configuration', () => {
    // Test that existing configurations still work without idle processing
    const existingConfig = {
      version: '1.0',
      project: {
        name: 'existing-project',
        language: 'typescript',
      },
      daemon: {
        pollInterval: 5000,
        autoStart: true,
        logLevel: 'info' as const,
      },
    };

    const result = ApexConfigSchema.parse(existingConfig);
    expect(result.project.name).toBe('existing-project');
    expect(result.daemon?.pollInterval).toBe(5000);
    expect(result.daemon?.idleProcessing).toBeUndefined();
  });
});