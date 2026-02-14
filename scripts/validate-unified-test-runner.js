#!/usr/bin/env node

/**
 * @fileoverview Validate Unified Test Runner Configuration
 *
 * This script validates that the unified test runner is properly configured
 * and that all test configurations are accessible.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Unified Test Runner Configuration...\n');

// Check if unified test runner exists
const unifiedRunnerPath = path.join(process.cwd(), 'scripts/unified-test-runner.js');
console.log('📋 Checking unified test runner...');
if (fs.existsSync(unifiedRunnerPath)) {
  console.log('  ✅ scripts/unified-test-runner.js exists');
} else {
  console.log('  ❌ scripts/unified-test-runner.js not found');
  process.exit(1);
}

// Check test configuration files
const testConfigs = [
  'vitest.config.ts',
  'vitest.unit.config.ts',
  'vitest.integration.config.ts',
  'vitest.e2e.config.ts',
  'vitest.browser.config.ts',
  'tests/browser-integration/vitest.config.ts',
  'tests/keyboard-integration/vitest.config.ts',
  'tests/form-integration/vitest.config.ts',
  'tests/page-navigation/vitest.config.ts',
  'vitest.integration-systems.config.ts'
];

console.log('\n🔧 Checking test configuration files...');
let configsFound = 0;
testConfigs.forEach(config => {
  const configPath = path.join(process.cwd(), config);
  if (fs.existsSync(configPath)) {
    console.log(`  ✅ ${config}`);
    configsFound++;
  } else {
    console.log(`  ❌ ${config} - not found`);
  }
});

// Check package.json for unified test commands
console.log('\n📦 Checking package.json scripts...');
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const unifiedCommands = [
  'test:unified',
  'test:unified:e2e',
  'test:unified:unit',
  'test:unified:integration',
  'test:unified:browser',
  'test:unified:watch',
  'test:unified:coverage',
  'test:unified:validate',
  'test:unified:list',
  'test:unified:list:e2e',
  'validate:unified-tests'
];

let scriptsFound = 0;
unifiedCommands.forEach(command => {
  if (packageJson.scripts[command]) {
    console.log(`  ✅ ${command}: ${packageJson.scripts[command]}`);
    scriptsFound++;
  } else {
    console.log(`  ❌ ${command} - not found`);
  }
});

// Check E2E test files exist
console.log('\n🧪 Checking E2E test files...');
const e2eDir = path.join(process.cwd(), 'tests/e2e');
if (fs.existsSync(e2eDir)) {
  const e2eFiles = fs.readdirSync(e2eDir).filter(file => file.endsWith('.test.ts'));
  console.log(`  ✅ Found ${e2eFiles.length} E2E test files in tests/e2e/`);

  // Show a few examples
  if (e2eFiles.length > 0) {
    console.log('  📝 Example E2E test files:');
    e2eFiles.slice(0, 5).forEach(file => {
      console.log(`    • ${file}`);
    });
    if (e2eFiles.length > 5) {
      console.log(`    ... and ${e2eFiles.length - 5} more`);
    }
  }
} else {
  console.log('  ❌ tests/e2e/ directory not found');
}

// Check vitest.e2e.config.ts content
console.log('\n🔧 Validating vitest.e2e.config.ts...');
const e2eConfigPath = path.join(process.cwd(), 'vitest.e2e.config.ts');
if (fs.existsSync(e2eConfigPath)) {
  const configContent = fs.readFileSync(e2eConfigPath, 'utf8');

  const checks = [
    { pattern: /include:\s*\[/, name: 'include patterns array' },
    { pattern: /\*\*\/\*e2e\*\.test\.ts/, name: 'e2e wildcard pattern' },
    { pattern: /packages\/\*\/src\/\*\*\/\*\.e2e\.test\.ts/, name: 'package e2e pattern' },
    { pattern: /tests\/e2e\/\*\*\/\*\.test\.ts/, name: 'tests/e2e pattern' },
    { pattern: /testTimeout:\s*60000/, name: '60s timeout for E2E' },
    { pattern: /pool:\s*'forks'/, name: 'forked process pool' },
    { pattern: /setupFiles.*setup\.ts/, name: 'setup file configuration' },
    { pattern: /globalTeardown.*teardown\.ts/, name: 'teardown configuration' }
  ];

  checks.forEach(check => {
    if (check.pattern.test(configContent)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ⚠️  ${check.name} - not found (may use different pattern)`);
    }
  });
} else {
  console.log('  ❌ vitest.e2e.config.ts not found');
}

// Summary
console.log('\n📊 Summary:');
console.log(`  Test configurations: ${configsFound}/${testConfigs.length}`);
console.log(`  Unified test scripts: ${scriptsFound}/${unifiedCommands.length}`);
console.log(`  E2E configuration: ${fs.existsSync(e2eConfigPath) ? '✅' : '❌'}`);
console.log(`  E2E tests directory: ${fs.existsSync(e2eDir) ? '✅' : '❌'}`);

if (configsFound >= 8 && scriptsFound >= 8 && fs.existsSync(e2eConfigPath) && fs.existsSync(e2eDir)) {
  console.log('\n🎉 Unified test configuration is properly set up!');
  console.log('\n🚀 You can now run:');
  console.log('   npm run test:unified               # All tests');
  console.log('   npm run test:unified:e2e           # All E2E tests');
  console.log('   npm run test:unified:list:e2e      # List E2E tests');
  console.log('   npm run validate:unified-tests     # Validate configurations');
  process.exit(0);
} else {
  console.log('\n⚠️  Some issues found with unified test configuration.');
  console.log('   Please review the missing components above.');
  process.exit(1);
}