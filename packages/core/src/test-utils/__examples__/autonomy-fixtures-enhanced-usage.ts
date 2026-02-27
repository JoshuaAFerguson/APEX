/**
 * Examples of using enhanced autonomy fixtures in tests
 *
 * This file demonstrates practical usage patterns for the enhanced
 * autonomy fixtures with real-world test scenarios.
 */

import {
  AutonomyFixturesEnhanced,
  createSemiAutoConfig,
  createManualConfig,
  createTestingAutonomyConfig,
  createApexConfigWithEnhancedAutonomy,
  getAllAutonomyConfigVariations,
  validateEnhancedAutonomyConfig,
  createAutonomyABTestConfigs,
} from '../autonomy-fixtures-enhanced.js';

// =============================================================================
// Example 1: Basic Usage with Predefined Fixtures
// =============================================================================

export function exampleBasicUsage() {
  console.log('=== Basic Usage Examples ===');

  // Use pre-built fixtures for common scenarios
  const fullAutoConfig = AutonomyFixturesEnhanced.fullAuto();
  console.log('Full Auto Config:', {
    level: fullAutoConfig.level,
    gateCount: fullAutoConfig.gates?.length || 0,
    limits: fullAutoConfig.limits
  });

  const semiAutoConfig = AutonomyFixturesEnhanced.semiAuto();
  console.log('Semi-Auto Config:', {
    level: semiAutoConfig.level,
    gateCount: semiAutoConfig.gates?.length || 0,
    hasCommitGate: semiAutoConfig.gates?.some(g => g.type === 'before-commit')
  });

  const manualConfig = AutonomyFixturesEnhanced.manual();
  console.log('Manual Config:', {
    level: manualConfig.level,
    gateCount: manualConfig.gates?.length || 0,
    gateTypes: manualConfig.gates?.map(g => g.type) || []
  });
}

// =============================================================================
// Example 2: Factory Functions with Customization
// =============================================================================

export function exampleFactoryFunctions() {
  console.log('=== Factory Function Examples ===');

  // Create semi-auto with custom approval timeout
  const customSemiAuto = createSemiAutoConfig({
    approvalTimeout: 60, // 1 hour timeout
    limits: {
      maxTokens: 750000,
      maxCost: 7.5,
      maxTimeMs: 2700000, // 45 minutes
    },
  });
  console.log('Custom Semi-Auto:', {
    timeout: customSemiAuto.approvalTimeout,
    maxCost: customSemiAuto.limits?.maxCost
  });

  // Create manual config with stage overrides
  const customManual = createManualConfig({
    stageOverrides: {
      planning: 'full-auto', // Let planning be autonomous
      testing: 'full-auto',  // Let testing be autonomous
      // Keep implementation and deployment as review-all
    },
    rejectionBehavior: 'skip' // Skip rather than abort on rejection
  });
  console.log('Custom Manual:', {
    planningLevel: customManual.stageOverrides?.planning,
    testingLevel: customManual.stageOverrides?.testing,
    rejectionBehavior: customManual.rejectionBehavior
  });
}

// =============================================================================
// Example 3: Testing Scenarios
// =============================================================================

export function exampleTestingScenarios() {
  console.log('=== Testing Scenario Examples ===');

  // Fast test configuration for unit tests
  const fastTestConfig = createTestingAutonomyConfig('fast');
  console.log('Fast Test Config:', {
    level: fastTestConfig.level,
    maxTokens: fastTestConfig.limits?.maxTokens,
    maxTimeMs: fastTestConfig.limits?.maxTimeMs
  });

  // Comprehensive test configuration for integration tests
  const comprehensiveTestConfig = createTestingAutonomyConfig('comprehensive');
  console.log('Comprehensive Test Config:', {
    level: comprehensiveTestConfig.level,
    gateCount: comprehensiveTestConfig.gates?.length,
    hasStageOverrides: Object.keys(comprehensiveTestConfig.stageOverrides || {}).length > 0
  });

  // Minimal test configuration for quick validation
  const minimalTestConfig = createTestingAutonomyConfig('minimal');
  console.log('Minimal Test Config:', {
    maxTokens: minimalTestConfig.limits?.maxTokens,
    maxCost: minimalTestConfig.limits?.maxCost,
    maxTimeMs: minimalTestConfig.limits?.maxTimeMs
  });

  // Isolated test configuration for parallel execution
  const isolatedTestConfig = createTestingAutonomyConfig('isolated');
  console.log('Isolated Test Config:', {
    level: isolatedTestConfig.level,
    gateCount: isolatedTestConfig.gates?.length,
    maxCost: isolatedTestConfig.limits?.maxCost
  });
}

// =============================================================================
// Example 4: Full APEX Configuration
// =============================================================================

export function exampleFullApexConfig() {
  console.log('=== Full APEX Configuration Examples ===');

  // Create development environment config
  const devConfig = createApexConfigWithEnhancedAutonomy('semi-auto', {
    project: {
      name: 'my-development-project',
      language: 'typescript',
      framework: 'nextjs',
    },
    git: {
      branchPrefix: 'feature/',
      defaultBranch: 'develop',
    },
    api: {
      port: 3001,
    },
  });
  console.log('Development Config:', {
    projectName: devConfig.project.name,
    autonomyLevel: devConfig.autonomy.level,
    gateCount: devConfig.autonomy.gates?.length,
    apiPort: devConfig.api.port
  });

  // Create production environment config
  const prodConfig = createApexConfigWithEnhancedAutonomy('manual', {
    project: {
      name: 'my-production-project',
    },
    limits: {
      dailyBudget: 100.0, // Higher budget for production
      maxConcurrentTasks: 2,
    },
  });
  console.log('Production Config:', {
    autonomyLevel: prodConfig.autonomy.level,
    dailyBudget: prodConfig.limits.dailyBudget,
    maxConcurrentTasks: prodConfig.limits.maxConcurrentTasks
  });
}

// =============================================================================
// Example 5: Comprehensive Testing with All Variations
// =============================================================================

export function exampleComprehensiveTesting() {
  console.log('=== Comprehensive Testing Examples ===');

  const allVariations = getAllAutonomyConfigVariations();
  console.log('Available Variations:', Object.keys(allVariations));

  // Simulate testing each variation
  Object.entries(allVariations).forEach(([name, config]) => {
    const isValid = validateEnhancedAutonomyConfig(config);
    console.log(`${name}:`, {
      level: config.level,
      valid: isValid,
      gateCount: config.gates?.length || 0,
      hasLimits: !!config.limits
    });

    // Example test assertion
    if (!isValid) {
      console.error(`Invalid config for ${name}`);
    }
  });
}

// =============================================================================
// Example 6: A/B Testing Configurations
// =============================================================================

export function exampleABTesting() {
  console.log('=== A/B Testing Examples ===');

  const abConfigs = createAutonomyABTestConfigs();

  console.log('A/B Test Configs:');
  console.log('Control Group (Semi-Auto):', {
    level: abConfigs.controlGroup.level,
    gateCount: abConfigs.controlGroup.gates?.length
  });
  console.log('Test Group A (Full Auto):', {
    level: abConfigs.testGroupA.level,
    gateCount: abConfigs.testGroupA.gates?.length
  });
  console.log('Test Group B (Manual):', {
    level: abConfigs.testGroupB.level,
    gateCount: abConfigs.testGroupB.gates?.length
  });

  // Simulate A/B testing metrics
  const scenarios = [
    { name: 'Control', config: abConfigs.controlGroup },
    { name: 'Test A', config: abConfigs.testGroupA },
    { name: 'Test B', config: abConfigs.testGroupB },
  ];

  scenarios.forEach(scenario => {
    // Simulate performance metrics based on autonomy level
    const metrics = simulatePerformanceMetrics(scenario.config);
    console.log(`${scenario.name} Metrics:`, metrics);
  });
}

// =============================================================================
// Example 7: Scenario-Specific Configurations
// =============================================================================

export function exampleScenarioConfigs() {
  console.log('=== Scenario-Specific Examples ===');

  // Emergency hotfix scenario - needs quick deployment with minimal oversight
  const hotfixConfig = createSemiAutoConfig({
    limits: {
      maxTokens: 100000,
      maxCost: 2.0,
      maxTimeMs: 900000, // 15 minutes - Quick timeout for urgency
    },
    approvalTimeout: 5, // Very quick approvals needed
    stageOverrides: {
      planning: 'full-auto',     // Skip planning review for speed
      implementation: 'review-before-commit', // Still review code
      testing: 'full-auto',     // Auto-run tests
      deployment: 'review-all',  // Always review deployment
    },
  });

  // Feature development scenario - balanced oversight
  const featureConfig = createSemiAutoConfig({
    limits: {
      maxTokens: 1000000,
      maxCost: 15.0,
      maxTimeMs: 7200000, // 120 minutes
    },
    approvalTimeout: 30,
    stageOverrides: {
      planning: 'review-before-commit', // Review plans
      implementation: 'review-before-commit', // Review commits
      testing: 'full-auto',     // Auto-run tests
      deployment: 'review-all',  // Always review deployment
    },
  });

  // Security audit scenario - maximum oversight
  const auditConfig = createManualConfig({
    limits: {
      maxTokens: 50000,
      maxCost: 1.0,
      maxTimeMs: 3600000, // 60 minutes
    },
    approvalTimeout: 120, // Longer time for security review
    rejectionBehavior: 'abort', // Strict - abort on any rejection
  });

  console.log('Scenario Configurations:');
  console.log('Hotfix:', {
    approvalTimeout: hotfixConfig.approvalTimeout,
    deploymentLevel: hotfixConfig.stageOverrides?.deployment
  });
  console.log('Feature:', {
    planningLevel: featureConfig.stageOverrides?.planning,
    maxCost: featureConfig.limits?.maxCost
  });
  console.log('Audit:', {
    rejectionBehavior: auditConfig.rejectionBehavior,
    approvalTimeout: auditConfig.approvalTimeout
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

function simulatePerformanceMetrics(config: any) {
  // Simulate different performance characteristics based on autonomy level
  const baseMetrics = {
    speed: 100,
    quality: 100,
    cost: 100,
  };

  switch (config.level) {
    case 'full-auto':
      return {
        speed: baseMetrics.speed * 1.5,  // 50% faster
        quality: baseMetrics.quality * 0.9, // 10% lower quality
        cost: baseMetrics.cost * 0.8,   // 20% lower cost
      };
    case 'review-before-commit':
      return {
        speed: baseMetrics.speed * 1.1,  // 10% faster
        quality: baseMetrics.quality * 1.1, // 10% higher quality
        cost: baseMetrics.cost * 1.0,   // Same cost
      };
    case 'review-all':
      return {
        speed: baseMetrics.speed * 0.7,  // 30% slower
        quality: baseMetrics.quality * 1.3, // 30% higher quality
        cost: baseMetrics.cost * 1.2,   // 20% higher cost
      };
    default:
      return baseMetrics;
  }
}

// =============================================================================
// Main Demo Function
// =============================================================================

export function runAllExamples() {
  console.log('Enhanced Autonomy Fixtures Examples\n');

  try {
    exampleBasicUsage();
    console.log('');

    exampleFactoryFunctions();
    console.log('');

    exampleTestingScenarios();
    console.log('');

    exampleFullApexConfig();
    console.log('');

    exampleComprehensiveTesting();
    console.log('');

    exampleABTesting();
    console.log('');

    exampleScenarioConfigs();
    console.log('');

    console.log('All examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}
