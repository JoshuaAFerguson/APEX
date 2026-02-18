/**
 * Validation script to check that all test utilities are properly exported
 * and that the module structure is complete.
 */

import * as testFixtures from './index.js';

console.log('Validating test fixtures exports...');

const requiredExports = [
  'createTestSuite',
  'setupTestMocks',
  'cleanupTestState',
  'getTestEnvironment',
  'setTestData',
  'getTestData',
  'addCleanupTask',
  'createMockFunction',
  'flushTimers',
  'advanceTimers',
  'createCLITestSuite',
  'createOrchestratorTestSuite',
  'createCoreTestSuite',
  'createTimerTestSuite'
];

let allExportsPresent = true;

for (const exportName of requiredExports) {
  if (typeof testFixtures[exportName] === 'function') {
    console.log(`✓ ${exportName} - exported as function`);
  } else {
    console.log(`✗ ${exportName} - MISSING or not a function`);
    allExportsPresent = false;
  }
}

if (allExportsPresent) {
  console.log('\n✅ All required exports are present');
  console.log('Test utilities module is ready for adoption');
} else {
  console.log('\n❌ Some exports are missing');
  process.exit(1);
}

console.log('\nAvailable package-specific helpers:');
console.log('- createCLITestSuite: For CLI package tests');
console.log('- createOrchestratorTestSuite: For orchestrator package tests');
console.log('- createCoreTestSuite: For core package tests');
console.log('- createTimerTestSuite: For timer-based tests');

console.log('\nUsage documentation:');
console.log('- USAGE_GUIDE.md: Comprehensive usage examples');
console.log('- MIGRATION_EXAMPLES.md: Before/after migration patterns');
console.log('- QUICK_REFERENCE.md: Quick reference card');