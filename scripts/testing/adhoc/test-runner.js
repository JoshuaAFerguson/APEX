#!/usr/bin/env node
/**
 * Simple test runner for display modes integration tests
 */

const { execSync } = require('child_process');
const path = require('path');

async function runTests() {
  console.log('🧪 Running v0.3.0 Display Modes Integration Tests...\n');

  try {
    // Change to CLI package directory
    process.chdir(path.join(__dirname, 'packages', 'cli'));

    console.log('📁 Working directory:', process.cwd());

    // Run simple test first
    console.log('\n1️⃣ Running simple display modes test...');
    execSync('npx vitest run src/__tests__/display-modes-simple.test.tsx', {
      stdio: 'inherit',
      timeout: 30000
    });

    console.log('\n2️⃣ Running full v0.3.0 integration tests...');
    execSync('npx vitest run src/__tests__/v030-features.integration.test.tsx', {
      stdio: 'inherit',
      timeout: 60000
    });

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test execution failed:');
    console.error(error.message);

    if (error.stdout) {
      console.error('\nSTDOUT:', error.stdout.toString());
    }

    if (error.stderr) {
      console.error('\nSTDERR:', error.stderr.toString());
    }

    process.exit(1);
  }
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };