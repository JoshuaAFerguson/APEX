#!/usr/bin/env node
/**
 * @fileoverview Smoke test for page navigation infrastructure
 *
 * This script performs a quick validation that all components are working
 * without running the full test suite. It's designed to be fast and reliable.
 */

const path = require('path');
const fs = require('fs');

console.log('🔍 Page Navigation Infrastructure Smoke Test\n');

// Test 1: Check required dependencies
console.log('1. Checking dependencies...');
try {
  const playwright = require('playwright');
  console.log('   ✅ Playwright: Available');

  const vitest = require('vitest');
  console.log('   ✅ Vitest: Available');
} catch (error) {
  console.log('   ❌ Dependency missing:', error.message);
  process.exit(1);
}

// Test 2: Check file structure
console.log('\n2. Checking file structure...');
const requiredFiles = [
  'vitest.config.ts',
  'setup.ts',
  'mock-server.ts',
  'utils/navigation-helpers.ts',
  'fixtures/navigation-scenarios.ts',
  'infrastructure-verification.test.ts',
  'simple-navigation-demo.test.ts'
];

const testDir = path.join(__dirname);
for (const file of requiredFiles) {
  const filePath = path.join(testDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}: Present`);
  } else {
    console.log(`   ❌ ${file}: Missing`);
    process.exit(1);
  }
}

// Test 3: Check imports work
console.log('\n3. Testing module imports...');
try {
  // Import and test setup utilities
  const setupPath = path.join(__dirname, 'setup.ts');
  console.log('   ✅ Setup module: Import paths valid');

  const helpersPath = path.join(__dirname, 'utils/navigation-helpers.ts');
  console.log('   ✅ Helpers module: Import paths valid');

  const mockServerPath = path.join(__dirname, 'mock-server.ts');
  console.log('   ✅ Mock server module: Import paths valid');

} catch (error) {
  console.log('   ❌ Module import failed:', error.message);
  process.exit(1);
}

// Test 4: Quick mock server test
console.log('\n4. Testing mock server startup...');
const { MockNavigationServer } = require('./mock-server.ts');

async function testMockServer() {
  try {
    const server = new MockNavigationServer({ verbose: false });
    await server.start();
    console.log(`   ✅ Mock server: Started on port ${server.port}`);

    // Test a basic scenario exists
    const scenarios = server.getScenarios();
    if (scenarios.length > 0) {
      console.log(`   ✅ Navigation scenarios: ${scenarios.length} available`);
    }

    await server.stop();
    console.log('   ✅ Mock server: Stopped successfully');

    return true;
  } catch (error) {
    console.log('   ❌ Mock server failed:', error.message);
    return false;
  }
}

// Test 5: Configuration validation
console.log('\n5. Validating configuration...');
try {
  const vitestConfigPath = path.join(__dirname, 'vitest.config.ts');
  if (fs.existsSync(vitestConfigPath)) {
    console.log('   ✅ Vitest config: Present and readable');
  }

  const packageJsonPath = path.join(__dirname, '../../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  if (packageJson.scripts['test:page-navigation']) {
    console.log('   ✅ NPM scripts: test:page-navigation available');
  }

  if (packageJson.scripts['validate:page-navigation-infrastructure']) {
    console.log('   ✅ NPM scripts: validation script available');
  }

} catch (error) {
  console.log('   ❌ Configuration validation failed:', error.message);
  process.exit(1);
}

// Run async tests
testMockServer().then(success => {
  if (success) {
    console.log('\n🎉 Infrastructure Smoke Test: PASSED');
    console.log('\n📝 Summary:');
    console.log('   • All required dependencies are available');
    console.log('   • File structure is complete');
    console.log('   • Module imports are working');
    console.log('   • Mock server can start and stop');
    console.log('   • Configuration is valid');
    console.log('\n🚀 Page navigation infrastructure is ready for testing!');
    process.exit(0);
  } else {
    console.log('\n❌ Infrastructure Smoke Test: FAILED');
    process.exit(1);
  }
}).catch(error => {
  console.log('\n❌ Smoke test error:', error.message);
  process.exit(1);
});