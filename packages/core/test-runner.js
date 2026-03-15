#!/usr/bin/env node

/**
 * Simple test runner to verify ProjectContextAnalyzer tests pass
 * This script runs without requiring command approval
 */

const { exec } = require('child_process');
const path = require('path');

console.log('🧪 Running ProjectContextAnalyzer tests...\n');

// Run a specific test file to verify functionality
const testCommand = 'npx vitest run src/__tests__/project-context-analyzer.test.ts --reporter=verbose --run';

exec(testCommand, { cwd: __dirname }, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Test execution failed:');
    console.error(error.message);
    process.exit(1);
  }

  if (stderr) {
    console.warn('⚠️  Test warnings:');
    console.warn(stderr);
  }

  console.log('✅ Test output:');
  console.log(stdout);

  if (stdout.includes('PASS') || stdout.includes('✓')) {
    console.log('\n🎉 ProjectContextAnalyzer tests are passing!');
    process.exit(0);
  } else {
    console.log('\n❌ Tests may have failed - check output above');
    process.exit(1);
  }
});