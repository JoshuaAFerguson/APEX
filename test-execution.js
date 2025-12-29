#!/usr/bin/env node

/**
 * Test execution script to run CLI tests and capture Windows-related failures
 */

const { spawn } = require('child_process');
const path = require('path');

async function runTests() {
  console.log('Starting CLI test execution...\n');

  const cliPackagePath = path.join(__dirname, 'packages', 'cli');
  console.log(`Running tests in: ${cliPackagePath}\n`);

  // Mock Windows platform detection first
  const originalPlatform = process.platform;

  // Test 1: Run tests with actual platform
  console.log('=== Running tests with actual platform ===');
  try {
    await runTestSuite(cliPackagePath, 'vitest run --reporter=verbose');
  } catch (error) {
    console.error('Test suite failed with actual platform:', error.message);
  }

  // Test 2: Mock Windows platform and run specific Windows tests
  console.log('\n=== Testing Windows-specific functionality ===');
  Object.defineProperty(process, 'platform', {
    value: 'win32',
    writable: true,
  });

  try {
    // Run Windows-specific tests
    await runTestSuite(cliPackagePath, 'vitest run --reporter=verbose src/**/*.windows.test.*');
  } catch (error) {
    console.error('Windows-specific tests failed:', error.message);
  }

  // Test 3: Run cross-platform tests
  console.log('\n=== Testing cross-platform functionality ===');
  try {
    await runTestSuite(cliPackagePath, 'vitest run --reporter=verbose src/**/*cross-platform*.test.*');
  } catch (error) {
    console.error('Cross-platform tests failed:', error.message);
  }

  // Restore original platform
  Object.defineProperty(process, 'platform', {
    value: originalPlatform,
    writable: true,
  });

  console.log('\n=== Test execution completed ===');
}

function runTestSuite(cwd, command) {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');

    console.log(`Executing: ${command}`);

    const child = spawn('npx', [cmd, ...args], {
      cwd,
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✓ Test suite completed successfully`);
        resolve();
      } else {
        reject(new Error(`Test suite exited with code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };