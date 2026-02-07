#!/usr/bin/env node

/**
 * @fileoverview Integration test setup validation script
 *
 * This script validates that all integration testing infrastructure is properly configured:
 * - Vitest installation
 * - Integration test configuration file
 * - NPM scripts
 * - Test directory structure
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating APEX Integration Test Setup\n');

// Check Vitest installation
try {
  require('vitest');
  console.log('✅ Vitest: installed');
} catch (error) {
  console.log('❌ Vitest: missing');
  process.exit(1);
}

// Check package.json integration scripts
try {
  const pkg = require('../package.json');
  const hasIntegrationScript = pkg.scripts['test:integration'];
  const hasIntegrationWatchScript = pkg.scripts['test:integration:watch'];
  const hasIntegrationCoverageScript = pkg.scripts['test:integration:coverage'];

  console.log(`✅ NPM Scripts:
  - test:integration: ${hasIntegrationScript ? '✅' : '❌'}
  - test:integration:watch: ${hasIntegrationWatchScript ? '✅' : '❌'}
  - test:integration:coverage: ${hasIntegrationCoverageScript ? '✅' : '❌'}`);
} catch (error) {
  console.log('❌ Package.json: could not read scripts');
  process.exit(1);
}

// Check integration config file
const integrationConfigPath = path.join(__dirname, '..', 'vitest.integration.config.ts');
if (fs.existsSync(integrationConfigPath)) {
  console.log('✅ vitest.integration.config.ts: exists');
} else {
  console.log('❌ vitest.integration.config.ts: missing');
  process.exit(1);
}

// Check integration test directory
const integrationTestDir = path.join(__dirname, '..', 'tests', 'integration');
if (fs.existsSync(integrationTestDir)) {
  console.log('✅ tests/integration directory: exists');

  // Count integration tests
  const testFiles = fs.readdirSync(integrationTestDir)
    .filter(file => file.endsWith('.test.ts') || file.endsWith('.integration.test.ts'));
  console.log(`✅ Integration test files: ${testFiles.length} found`);
} else {
  console.log('❌ tests/integration directory: missing');
  process.exit(1);
}

// Check integration test setup file
const setupFilePath = path.join(__dirname, '..', 'tests', 'integration', 'setup.ts');
if (fs.existsSync(setupFilePath)) {
  console.log('✅ Integration test setup file: exists');
} else {
  console.log('❌ Integration test setup file: missing');
  process.exit(1);
}

// Check shared config
const sharedConfigPath = path.join(__dirname, '..', 'vitest.shared.config.ts');
if (fs.existsSync(sharedConfigPath)) {
  console.log('✅ vitest.shared.config.ts: exists');
} else {
  console.log('❌ vitest.shared.config.ts: missing');
  process.exit(1);
}

console.log('\n🎉 Integration test setup validation completed successfully!');
console.log('\n📖 Usage:');
console.log('  npm run test:integration           - Run all integration tests');
console.log('  npm run test:integration:watch     - Run integration tests in watch mode');
console.log('  npm run test:integration:coverage  - Run integration tests with coverage');
console.log('\n🧪 Example integration test run:');
console.log('  npm run test:integration');