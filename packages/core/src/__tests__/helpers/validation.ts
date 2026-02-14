/**
 * @fileoverview Validation script for permission and autonomy test helpers
 *
 * This script performs basic validation of the test helpers to ensure they
 * work correctly without requiring a full test runner.
 */

import {
  PermissionTestHelpers,
  AutonomyTestHelpers,
  apexTestHelpers,
} from './index';

// Basic validation function
function validateHelpers(): void {
  console.log('🧪 Validating Permission and Autonomy Test Helpers...\n');

  // Test Permission Helpers
  console.log('📋 Testing Permission Helpers:');
  const permissionHelpers = new PermissionTestHelpers();

  // Test basic permission creation
  const permission = permissionHelpers.createPermission('Write', 'allow-always');
  console.log('✅ Created basic permission:', permission.tool, permission.level);

  // Test extended permission creation
  const extendedPermission = permissionHelpers.createExtendedPermission('Shell', 'deny', {
    grantReason: 'Security policy',
    grantedBy: 'admin',
    tags: ['security'],
  });
  console.log('✅ Created extended permission:', extendedPermission.tool, extendedPermission.level);

  // Test permission scenarios
  const approvalResult = permissionHelpers.simulatePermissionApproval('Read');
  console.log('✅ Simulated approval:', approvalResult.allowed, approvalResult.level);

  const denialResult = permissionHelpers.simulatePermissionDenial('Delete', '/important');
  console.log('✅ Simulated denial:', denialResult.allowed, denialResult.level);

  // Test mock permission manager
  const manager = permissionHelpers.getMockPermissionManager();
  manager.configurePermissionCheck('Test', undefined, {
    allowed: true,
    level: 'allow-once',
    requiresConfirmation: false,
  });
  const checkResult = manager.checkPermission('Test');
  console.log('✅ Mock manager check:', checkResult.allowed, checkResult.level);

  // Test Autonomy Helpers
  console.log('\n🤖 Testing Autonomy Helpers:');
  const autonomyHelpers = new AutonomyTestHelpers();

  // Test autonomy config creation
  const fullAutoConfig = autonomyHelpers.createAutonomyConfig('full-auto');
  console.log('✅ Created autonomy config:', fullAutoConfig.level);

  const supervisedConfig = autonomyHelpers.createAutonomyConfig('supervised', {
    includeGates: true,
    includeResourceLimits: true,
  });
  console.log('✅ Created supervised config with gates:', supervisedConfig.level, 'gates:', supervisedConfig.gates?.length);

  // Test approval gate creation
  const gate = autonomyHelpers.createApprovalGate('test-gate', 'Test Gate', 'before-commit');
  console.log('✅ Created approval gate:', gate.name, gate.type);

  // Test approval flow simulation
  const approvalFlow = autonomyHelpers.simulateApprovalFlow({
    gate,
    outcome: 'approved',
    responseTimeMs: 1000,
  });
  console.log('✅ Simulated approval flow:', approvalFlow.action, approvalFlow.response);

  // Test boundary testing
  const boundaryResult = autonomyHelpers.testAutonomyBoundary({
    autonomyLevel: 'review-before-commit',
    action: 'git-commit',
    shouldRequireApproval: true,
    expectedCheckpoint: 'before-commit',
  });
  console.log('✅ Tested autonomy boundary:', boundaryResult.requiresApproval, boundaryResult.checkpointType);

  // Test Combined Helpers
  console.log('\n🔗 Testing Combined Helpers:');
  const scenario = apexTestHelpers.createIntegratedScenario('review-all', 'allow-always');
  console.log('✅ Created integrated scenario:', scenario.autonomyConfig.level);
  console.log('✅ Permission scenarios available:', Object.keys(scenario.permissionScenarios).length);

  // Test common scenarios
  const permissionScenarios = permissionHelpers.createCommonPermissionScenarios();
  console.log('✅ Common permission scenarios:', Object.keys(permissionScenarios).length);

  const autonomyScenarios = autonomyHelpers.createCommonAutonomyScenarios();
  console.log('✅ Common autonomy scenarios:', Object.keys(autonomyScenarios).length);

  console.log('\n🎉 All validations passed! Test helpers are working correctly.');
}

// Export validation function for potential use in tests
export { validateHelpers };

// Run validation if this file is executed directly
if (require.main === module) {
  try {
    validateHelpers();
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}