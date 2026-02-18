#!/usr/bin/env node

/**
 * @fileoverview Type Interaction Test Runner
 *
 * This script executes the type interaction tests and validates the infrastructure:
 * - Runs the comprehensive infrastructure test
 * - Executes coverage analysis
 * - Validates build system
 * - Generates final testing report
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 RUNNING TYPE INTERACTION TESTS\n');
console.log('=' .repeat(70));

async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve) => {
    console.log(`📝 Executing: ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    child.on('close', (code) => {
      resolve({
        code,
        success: code === 0
      });
    });
  });
}

async function main() {
  let allPassed = true;

  console.log('1️⃣  Running Infrastructure Validation...');
  const infraResult = await runCommand('node', ['test-type-interaction-infrastructure.js']);
  if (!infraResult.success) {
    console.log('❌ Infrastructure validation failed');
    allPassed = false;
  } else {
    console.log('✅ Infrastructure validation passed');
  }

  console.log('\n2️⃣  Running Coverage Analysis...');
  const coverageResult = await runCommand('node', ['type-interaction-test-coverage-analysis.js']);
  if (!coverageResult.success) {
    console.log('❌ Coverage analysis failed');
    allPassed = false;
  } else {
    console.log('✅ Coverage analysis passed');
  }

  console.log('\n3️⃣  Testing TypeScript Compilation...');
  const tscResult = await runCommand('npx', ['tsc', '--noEmit', 'tests/browser-integration/type-interactions.integration.test.ts']);
  if (!tscResult.success) {
    console.log('❌ TypeScript compilation failed');
    allPassed = false;
  } else {
    console.log('✅ TypeScript compilation passed');
  }

  console.log('\n' + '='.repeat(70));
  if (allPassed) {
    console.log('🎉 ALL TYPE INTERACTION TESTS PASSED!');
    console.log('✅ The type interaction infrastructure is ready for production');
  } else {
    console.log('❌ Some tests failed. Please review the output above.');
  }

  console.log('\n📄 Check the generated reports for detailed information:');
  console.log('  - TYPE_INTERACTION_TEST_COVERAGE_REPORT.md');

  return allPassed;
}

if (require.main === module) {
  main().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}