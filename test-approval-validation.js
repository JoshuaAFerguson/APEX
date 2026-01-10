#!/usr/bin/env node

/**
 * Simple test script to validate ApprovalCheckpointTypeSchema
 */

try {
  console.log('Loading types from compiled core package...');
  const { ApprovalCheckpointTypeSchema } = require('./packages/core/dist/types');

  console.log('\n✅ Successfully imported ApprovalCheckpointTypeSchema');
  console.log('\n🧪 Testing valid approval types...');

  const validTypes = [
    'before-commit',
    'before-deploy',
    'before-destructive',
    'before-network',
    'before-file-write',
    'deployment',
    'custom'
  ];

  let successCount = 0;
  validTypes.forEach(type => {
    try {
      const result = ApprovalCheckpointTypeSchema.parse(type);
      console.log(`  ✅ ${type} -> ${result}`);
      successCount++;
    } catch (error) {
      console.error(`  ❌ ${type} failed: ${error.message}`);
    }
  });

  console.log(`\n🧪 Testing invalid approval types...`);

  const invalidTypes = [
    'invalid-type',
    'code-review',
    'architecture-review',
    'security-review',
    'business-approval',
    '',
    null,
    undefined,
    'before_commit',
    'beforecommit',
    'BEFORE-COMMIT'
  ];

  let rejectionCount = 0;
  invalidTypes.forEach(type => {
    try {
      ApprovalCheckpointTypeSchema.parse(type);
      console.log(`  ❌ ${type} should have been rejected but was accepted`);
    } catch (error) {
      console.log(`  ✅ ${type} correctly rejected`);
      rejectionCount++;
    }
  });

  console.log(`\n📊 Test Results:`);
  console.log(`  Valid types: ${successCount}/${validTypes.length} passed`);
  console.log(`  Invalid types: ${rejectionCount}/${invalidTypes.length} correctly rejected`);

  if (successCount === validTypes.length && rejectionCount === invalidTypes.length) {
    console.log(`\n🎉 All tests passed! ApprovalCheckpointTypeSchema is working correctly.`);
    process.exit(0);
  } else {
    console.log(`\n💥 Some tests failed.`);
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Error running validation tests:', error.message);
  process.exit(1);
}