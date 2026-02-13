#!/usr/bin/env node
/**
 * Simple validation script to verify parallel utilities are properly exported
 */

console.log('🔍 Validating parallel utilities exports...');

try {
  // Check orchestrator exports
  const orchestrator = require('../../packages/orchestrator/dist/index.js');
  const expectedOrchestratorExports = [
    'getTestWorkerId',
    'isParallelTestExecution',
    'createParallelTestContext',
    'createIsolatedEventEmitter',
    'AsyncMutex',
    'ResourceLockManager',
    'globalResourceLocks',
  ];

  console.log('✅ Checking orchestrator exports...');
  for (const exportName of expectedOrchestratorExports) {
    if (typeof orchestrator[exportName] === 'undefined') {
      throw new Error(`Missing orchestrator export: ${exportName}`);
    }
    console.log(`   ✓ ${exportName}`);
  }

  console.log('✅ All parallel utilities validation passed!');
  console.log('🎉 Parallel test execution utilities are ready for use.');

} catch (error) {
  console.error('❌ Validation failed:', error.message);
  console.log('ℹ️  This is expected if the packages haven\'t been built yet.');
  console.log('   Run `npm run build` to build the packages first.');
  process.exit(1);
}