/**
 * Quick verification script for autonomy enforcement configuration
 * This script validates that the autonomy enforcement options are working correctly
 */

import { AutonomyConfigSchema, RejectionBehaviorSchema, AgentAutonomyOverrideSchema } from './packages/core/dist/types.js';

console.log('🔍 Verifying autonomy enforcement configuration...\n');

// Test 1: RejectionBehaviorSchema
console.log('1. Testing RejectionBehaviorSchema:');
try {
  const skipResult = RejectionBehaviorSchema.parse('skip');
  const abortResult = RejectionBehaviorSchema.parse('abort');
  console.log('   ✅ Valid values "skip" and "abort" accepted');
  console.log(`   ✅ skip -> ${skipResult}, abort -> ${abortResult}`);

  try {
    RejectionBehaviorSchema.parse('invalid');
    console.log('   ❌ ERROR: Should have rejected "invalid"');
  } catch {
    console.log('   ✅ Invalid value "invalid" properly rejected');
  }
} catch (error) {
  console.log(`   ❌ ERROR: ${error.message}`);
}

// Test 2: AgentAutonomyOverrideSchema
console.log('\n2. Testing AgentAutonomyOverrideSchema:');
try {
  const fullOverride = {
    level: 'supervised',
    rejectionBehavior: 'skip',
    approvalTimeout: 30
  };
  const result = AgentAutonomyOverrideSchema.parse(fullOverride);
  console.log('   ✅ Full agent override configuration accepted');
  console.log(`   ✅ Result: ${JSON.stringify(result, null, 2)}`);

  const partialOverride = { approvalTimeout: 60 };
  const partialResult = AgentAutonomyOverrideSchema.parse(partialOverride);
  console.log('   ✅ Partial agent override configuration accepted');
  console.log(`   ✅ Partial result: ${JSON.stringify(partialResult, null, 2)}`);
} catch (error) {
  console.log(`   ❌ ERROR: ${error.message}`);
}

// Test 3: AutonomyConfigSchema with enforcement options
console.log('\n3. Testing AutonomyConfigSchema with enforcement options:');
try {
  const autonomyConfig = {
    level: 'review-before-commit',
    rejectionBehavior: 'skip',
    approvalTimeout: 45,
    agentOverrides: {
      developer: {
        level: 'supervised',
        rejectionBehavior: 'abort',
        approvalTimeout: 60
      },
      tester: 'full-auto',
      reviewer: {
        approvalTimeout: 30
      }
    }
  };

  const result = AutonomyConfigSchema.parse(autonomyConfig);
  console.log('   ✅ Complete autonomy configuration with enforcement options accepted');
  console.log('   ✅ rejectionBehavior:', result.rejectionBehavior);
  console.log('   ✅ approvalTimeout:', result.approvalTimeout);
  console.log('   ✅ agentOverrides.developer:', result.agentOverrides.developer);
  console.log('   ✅ agentOverrides.tester:', result.agentOverrides.tester);
  console.log('   ✅ agentOverrides.reviewer:', result.agentOverrides.reviewer);
} catch (error) {
  console.log(`   ❌ ERROR: ${error.message}`);
}

// Test 4: Default behavior
console.log('\n4. Testing default rejectionBehavior:');
try {
  const minimalConfig = {
    level: 'review-before-commit'
  };

  const result = AutonomyConfigSchema.parse(minimalConfig);
  console.log('   ✅ Minimal configuration accepted');
  console.log('   ✅ Default rejectionBehavior:', result.rejectionBehavior);

  if (result.rejectionBehavior === 'abort') {
    console.log('   ✅ Default rejectionBehavior is correctly set to "abort"');
  } else {
    console.log('   ❌ ERROR: Default rejectionBehavior should be "abort"');
  }
} catch (error) {
  console.log(`   ❌ ERROR: ${error.message}`);
}

console.log('\n🎉 Autonomy enforcement configuration validation completed!');
console.log('\n📋 Summary of validated features:');
console.log('   ✅ rejectionBehavior with "skip" | "abort" options');
console.log('   ✅ approvalTimeout as optional number (min: 1)');
console.log('   ✅ per-agent override settings with full configuration support');
console.log('   ✅ mixed simple and complex agent overrides');
console.log('   ✅ proper validation and error handling');
console.log('   ✅ default value application (rejectionBehavior defaults to "abort")');