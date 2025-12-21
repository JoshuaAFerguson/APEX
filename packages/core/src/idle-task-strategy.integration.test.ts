import { describe, it, expect } from 'vitest';
import {
  IdleTaskType,
  IdleTaskTypeSchema,
  StrategyWeights,
  StrategyWeightsSchema,
  DaemonConfig,
  DaemonConfigSchema,
  ApexConfig,
  ApexConfigSchema,
} from './types';

describe('IdleTaskStrategy Integration Tests', () => {
  it('should integrate with complete APEX configuration', () => {
    const fullApexConfig: Partial<ApexConfig> = {
      version: '1.0',
      project: {
        name: 'test-project',
        language: 'typescript',
        framework: 'node',
      },
      daemon: {
        pollInterval: 5000,
        autoStart: true,
        logLevel: 'info',
        idleProcessing: {
          enabled: true,
          idleThreshold: 300000, // 5 minutes
          taskGenerationInterval: 3600000, // 1 hour
          maxIdleTasks: 3,
          strategyWeights: {
            maintenance: 0.4,
            refactoring: 0.3,
            docs: 0.2,
            tests: 0.1,
          },
        },
      },
    };

    const validatedConfig = ApexConfigSchema.parse(fullApexConfig);

    expect(validatedConfig.daemon?.idleProcessing?.enabled).toBe(true);
    expect(validatedConfig.daemon?.idleProcessing?.strategyWeights).toEqual({
      maintenance: 0.4,
      refactoring: 0.3,
      docs: 0.2,
      tests: 0.1,
    });
  });

  it('should support runtime configuration management', () => {
    // Simulating a configuration update scenario
    const initialConfig: DaemonConfig = DaemonConfigSchema.parse({
      idleProcessing: {
        enabled: false,
      },
    });

    expect(initialConfig.idleProcessing?.enabled).toBe(false);
    expect(initialConfig.idleProcessing?.strategyWeights).toBeUndefined();

    // Enable idle processing with custom strategy weights
    const updatedConfig: DaemonConfig = DaemonConfigSchema.parse({
      ...initialConfig,
      idleProcessing: {
        enabled: true,
        strategyWeights: {
          maintenance: 0.5,
          refactoring: 0.3,
          docs: 0.15,
          tests: 0.05,
        },
      },
    });

    expect(updatedConfig.idleProcessing?.enabled).toBe(true);
    expect(updatedConfig.idleProcessing?.strategyWeights?.maintenance).toBe(0.5);
    expect(updatedConfig.idleProcessing?.strategyWeights?.refactoring).toBe(0.3);
  });

  it('should validate configuration for different project types', () => {
    // Configuration for documentation-heavy project
    const docsHeavyConfig = {
      idleProcessing: {
        enabled: true,
        strategyWeights: {
          maintenance: 0.1,
          refactoring: 0.1,
          docs: 0.7,
          tests: 0.1,
        },
      },
    };

    const validatedDocsConfig = DaemonConfigSchema.parse(docsHeavyConfig);
    expect(validatedDocsConfig.idleProcessing?.strategyWeights?.docs).toBe(0.7);

    // Configuration for test-driven development
    const testHeavyConfig = {
      idleProcessing: {
        enabled: true,
        strategyWeights: {
          maintenance: 0.15,
          refactoring: 0.15,
          docs: 0.1,
          tests: 0.6,
        },
      },
    };

    const validatedTestConfig = DaemonConfigSchema.parse(testHeavyConfig);
    expect(validatedTestConfig.idleProcessing?.strategyWeights?.tests).toBe(0.6);

    // Configuration for legacy system maintenance
    const maintenanceHeavyConfig = {
      idleProcessing: {
        enabled: true,
        strategyWeights: {
          maintenance: 0.8,
          refactoring: 0.1,
          docs: 0.05,
          tests: 0.05,
        },
      },
    };

    const validatedMaintenanceConfig = DaemonConfigSchema.parse(maintenanceHeavyConfig);
    expect(validatedMaintenanceConfig.idleProcessing?.strategyWeights?.maintenance).toBe(0.8);
  });

  it('should handle dynamic strategy weight calculation', () => {
    // Simulating dynamic weight calculation based on project analysis
    const projectMetrics = {
      codeQuality: 0.6, // 60% code quality
      testCoverage: 0.4, // 40% test coverage
      documentationCoverage: 0.3, // 30% documentation coverage
      technicalDebtRatio: 0.7, // 70% technical debt
    };

    // Calculate weights based on project needs
    const calculateStrategyWeights = (metrics: typeof projectMetrics): StrategyWeights => {
      // Higher technical debt = more refactoring and maintenance
      // Lower test coverage = more testing
      // Lower docs coverage = more documentation
      const refactoringWeight = Math.min(metrics.technicalDebtRatio * 0.6, 0.8);
      const testWeight = Math.min((1 - metrics.testCoverage) * 0.5, 0.5);
      const docsWeight = Math.min((1 - metrics.documentationCoverage) * 0.4, 0.4);
      const maintenanceWeight = Math.max(0.1, 1 - refactoringWeight - testWeight - docsWeight);

      return {
        maintenance: Math.round(maintenanceWeight * 100) / 100,
        refactoring: Math.round(refactoringWeight * 100) / 100,
        docs: Math.round(docsWeight * 100) / 100,
        tests: Math.round(testWeight * 100) / 100,
      };
    };

    const calculatedWeights = calculateStrategyWeights(projectMetrics);
    const validatedWeights = StrategyWeightsSchema.parse(calculatedWeights);

    // Weights should be calculated based on project needs
    expect(validatedWeights.refactoring).toBeGreaterThan(0.3); // High technical debt
    expect(validatedWeights.tests).toBeGreaterThan(0.2); // Low test coverage
    expect(validatedWeights.docs).toBeGreaterThan(0.2); // Low documentation coverage
    expect(validatedWeights.maintenance).toBeGreaterThan(0); // Always some maintenance needed

    // All weights should be valid (0-1 range)
    Object.values(validatedWeights).forEach(weight => {
      expect(weight).toBeGreaterThanOrEqual(0);
      expect(weight).toBeLessThanOrEqual(1);
    });
  });

  it('should support configuration validation chains', () => {
    // Simulating a configuration validation pipeline
    const validateIdleTaskType = (type: string): IdleTaskType => {
      return IdleTaskTypeSchema.parse(type);
    };

    const validateStrategyWeights = (weights: Record<string, number>): StrategyWeights => {
      return StrategyWeightsSchema.parse(weights);
    };

    const validateDaemonConfig = (config: unknown): DaemonConfig => {
      return DaemonConfigSchema.parse(config);
    };

    // Test the validation chain
    const taskTypes = ['maintenance', 'refactoring', 'docs', 'tests'];
    const validatedTypes = taskTypes.map(validateIdleTaskType);
    expect(validatedTypes).toEqual(taskTypes);

    const weights = { maintenance: 0.3, refactoring: 0.3, docs: 0.2, tests: 0.2 };
    const validatedWeights = validateStrategyWeights(weights);
    expect(validatedWeights).toEqual(weights);

    const daemonConfig = {
      idleProcessing: {
        enabled: true,
        strategyWeights: validatedWeights,
      },
    };
    const validatedDaemonConfig = validateDaemonConfig(daemonConfig);
    expect(validatedDaemonConfig.idleProcessing?.strategyWeights).toEqual(weights);
  });

  it('should handle configuration merging scenarios', () => {
    // Base configuration
    const baseConfig: Partial<DaemonConfig> = DaemonConfigSchema.parse({
      pollInterval: 5000,
      autoStart: false,
      logLevel: 'info',
    });

    // User preferences
    const userPreferences = {
      idleProcessing: {
        enabled: true,
        strategyWeights: {
          maintenance: 0.6, // User wants more maintenance
          refactoring: 0.2,
        },
      },
    };

    // Merge configurations
    const mergedConfig = DaemonConfigSchema.parse({
      ...baseConfig,
      ...userPreferences,
    });

    expect(mergedConfig.pollInterval).toBe(5000); // From base
    expect(mergedConfig.idleProcessing?.enabled).toBe(true); // From user
    expect(mergedConfig.idleProcessing?.strategyWeights?.maintenance).toBe(0.6); // From user
    expect(mergedConfig.idleProcessing?.strategyWeights?.docs).toBe(0.25); // Default
    expect(mergedConfig.idleProcessing?.strategyWeights?.tests).toBe(0.25); // Default
  });

  it('should support real-world configuration scenarios', () => {
    // Scenario 1: New project setup (balanced approach)
    const newProjectConfig = {
      idleProcessing: {
        enabled: true,
        idleThreshold: 600000, // 10 minutes for new projects
        maxIdleTasks: 2, // Conservative for new projects
        strategyWeights: {
          maintenance: 0.2,
          refactoring: 0.2,
          docs: 0.3,
          tests: 0.3,
        },
      },
    };

    const validatedNewProject = DaemonConfigSchema.parse(newProjectConfig);
    expect(validatedNewProject.idleProcessing?.maxIdleTasks).toBe(2);

    // Scenario 2: Legacy project maintenance (maintenance-focused)
    const legacyProjectConfig = {
      idleProcessing: {
        enabled: true,
        idleThreshold: 180000, // 3 minutes for urgent legacy issues
        maxIdleTasks: 5, // More aggressive for legacy
        strategyWeights: {
          maintenance: 0.5,
          refactoring: 0.3,
          docs: 0.1,
          tests: 0.1,
        },
      },
    };

    const validatedLegacyProject = DaemonConfigSchema.parse(legacyProjectConfig);
    expect(validatedLegacyProject.idleProcessing?.strategyWeights?.maintenance).toBe(0.5);

    // Scenario 3: Open source project (documentation-focused)
    const openSourceConfig = {
      idleProcessing: {
        enabled: true,
        strategyWeights: {
          maintenance: 0.15,
          refactoring: 0.25,
          docs: 0.45,
          tests: 0.15,
        },
      },
    };

    const validatedOpenSource = DaemonConfigSchema.parse(openSourceConfig);
    expect(validatedOpenSource.idleProcessing?.strategyWeights?.docs).toBe(0.45);
  });
});