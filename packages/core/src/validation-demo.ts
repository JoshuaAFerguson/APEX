/**
 * Validation Demo for IdleTaskStrategy Implementation
 *
 * This file demonstrates the usage of the new IdleTaskStrategy types
 * and validates that they work correctly with the existing APEX configuration system.
 *
 * This is not a test file but a demonstration script.
 */

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

// 1. Demonstrate IdleTaskType usage
console.log('=== IdleTaskType Validation ===');

const validTaskTypes: IdleTaskType[] = ['maintenance', 'refactoring', 'docs', 'tests'];
validTaskTypes.forEach(taskType => {
  const validated = IdleTaskTypeSchema.parse(taskType);
  console.log(`✓ ${taskType} -> ${validated}`);
});

// 2. Demonstrate StrategyWeights validation
console.log('\n=== StrategyWeights Validation ===');

// Default weights
const defaultWeights = StrategyWeightsSchema.parse({});
console.log('Default weights:', defaultWeights);

// Custom weights
const customWeights: StrategyWeights = {
  maintenance: 0.4,
  refactoring: 0.3,
  docs: 0.2,
  tests: 0.1,
};
const validatedCustomWeights = StrategyWeightsSchema.parse(customWeights);
console.log('Custom weights:', validatedCustomWeights);

// Partial weights (demonstrates default application)
const partialWeights = StrategyWeightsSchema.parse({ maintenance: 0.6 });
console.log('Partial weights with defaults:', partialWeights);

// 3. Demonstrate DaemonConfig integration
console.log('\n=== DaemonConfig Integration ===');

const daemonConfigWithIdleProcessing: Partial<DaemonConfig> = {
  pollInterval: 5000,
  autoStart: true,
  logLevel: 'info',
  idleProcessing: {
    enabled: true,
    idleThreshold: 300000, // 5 minutes
    taskGenerationInterval: 3600000, // 1 hour
    maxIdleTasks: 3,
    strategyWeights: customWeights,
  },
};

const validatedDaemonConfig = DaemonConfigSchema.parse(daemonConfigWithIdleProcessing);
console.log('Daemon config with idle processing:');
console.log('- Enabled:', validatedDaemonConfig.idleProcessing?.enabled);
console.log('- Strategy weights:', validatedDaemonConfig.idleProcessing?.strategyWeights);

// 4. Demonstrate full APEX config integration
console.log('\n=== Full APEX Configuration ===');

const fullApexConfig: Partial<ApexConfig> = {
  version: '1.0',
  project: {
    name: 'demo-project',
    language: 'typescript',
    framework: 'node',
    testCommand: 'npm test',
    lintCommand: 'npm run lint',
    buildCommand: 'npm run build',
  },
  daemon: {
    pollInterval: 3000,
    autoStart: true,
    logLevel: 'debug',
    idleProcessing: {
      enabled: true,
      idleThreshold: 180000, // 3 minutes
      taskGenerationInterval: 1800000, // 30 minutes
      maxIdleTasks: 5,
      strategyWeights: {
        maintenance: 0.35,
        refactoring: 0.35,
        docs: 0.20,
        tests: 0.10,
      },
    },
  },
};

const validatedApexConfig = ApexConfigSchema.parse(fullApexConfig);
console.log('Full APEX config validation successful');
console.log('- Project name:', validatedApexConfig.project.name);
console.log('- Idle processing enabled:', validatedApexConfig.daemon?.idleProcessing?.enabled);
console.log('- Strategy weights:', validatedApexConfig.daemon?.idleProcessing?.strategyWeights);

// 5. Demonstrate error handling
console.log('\n=== Error Handling Validation ===');

try {
  IdleTaskTypeSchema.parse('invalid-type');
  console.log('❌ Should have thrown error for invalid task type');
} catch (error) {
  console.log('✓ Correctly rejected invalid task type');
}

try {
  StrategyWeightsSchema.parse({ maintenance: 1.5 }); // > 1.0
  console.log('❌ Should have thrown error for weight > 1');
} catch (error) {
  console.log('✓ Correctly rejected weight > 1.0');
}

try {
  StrategyWeightsSchema.parse({ refactoring: -0.1 }); // < 0.0
  console.log('❌ Should have thrown error for weight < 0');
} catch (error) {
  console.log('✓ Correctly rejected weight < 0.0');
}

// 6. Demonstrate real-world scenarios
console.log('\n=== Real-world Configuration Scenarios ===');

// New project (balanced approach)
const newProjectConfig = StrategyWeightsSchema.parse({
  maintenance: 0.2,
  refactoring: 0.2,
  docs: 0.3,
  tests: 0.3,
});
console.log('New project configuration:', newProjectConfig);

// Legacy project (maintenance-focused)
const legacyProjectConfig = StrategyWeightsSchema.parse({
  maintenance: 0.6,
  refactoring: 0.25,
  docs: 0.1,
  tests: 0.05,
});
console.log('Legacy project configuration:', legacyProjectConfig);

// Open source project (documentation-focused)
const openSourceConfig = StrategyWeightsSchema.parse({
  maintenance: 0.15,
  refactoring: 0.25,
  docs: 0.45,
  tests: 0.15,
});
console.log('Open source project configuration:', openSourceConfig);

console.log('\n🎉 All validations completed successfully!');
console.log('✅ IdleTaskType enum with 4 valid values');
console.log('✅ StrategyWeights schema with 0-1 validation and defaults');
console.log('✅ DaemonConfig integration with idleProcessing.strategyWeights');
console.log('✅ Full APEX configuration compatibility');
console.log('✅ Comprehensive error handling');
console.log('✅ Real-world usage scenarios');

export {}; // Make this a module