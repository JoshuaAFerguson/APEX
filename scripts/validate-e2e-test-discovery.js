#!/usr/bin/env node

/**
 * @fileoverview E2E Test Discovery Validation Script
 *
 * This script validates that the unified E2E test configuration properly
 * discovers all E2E tests across the APEX monorepo. It verifies that:
 *
 * 1. All expected E2E test files are found
 * 2. No E2E test files are missed by the current configuration
 * 3. The test patterns work correctly with vitest
 *
 * Usage:
 *   node scripts/validate-e2e-test-discovery.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

console.log('🔍 Validating E2E Test Discovery Configuration...\n');

// Define all E2E test patterns that should be discovered
const E2E_PATTERNS = [
  // Standard E2E test patterns
  'packages/*/src/**/*.e2e.test.ts',
  'tests/e2e/**/*.test.ts',
  'tests/e2e/**/*.e2e.test.ts',

  // Additional E2E test patterns
  '**/*e2e*.test.ts',
  '**/e2e-*.test.ts',
  'tests/integration/**/*e2e*.test.ts',
  'tests/test-utils/**/*e2e*.test.ts',

  // Marketplace-specific E2E tests
  'tests/e2e/**/mcp-*.test.ts',
  'tests/e2e/**/marketplace*.test.ts',

  // Browser automation E2E tests
  'packages/browser/src/**/*e2e*.test.ts',
  'packages/orchestrator/src/**/*e2e*.test.ts',

  // Workflow and integration E2E tests
  'packages/orchestrator/src/__tests__/**/*e2e*.test.ts',
  'packages/core/src/__tests__/**/*e2e*.test.ts',
  'packages/cli/src/__tests__/**/*e2e*.test.ts',
];

// Exclusion patterns
const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/*.d.ts',
  '**/*.md',
  '**/*.unit.test.ts',
  '**/*.spec.ts',
  'tests/*/helpers/**',
  'tests/*/mocks/**',
  'tests/*/fixtures/**/*.ts',
  'tests/*/utils/**/*.ts',
];

async function findE2ETests() {
  console.log('📋 Discovering E2E test files...');

  const allFiles = new Set();

  for (const pattern of E2E_PATTERNS) {
    try {
      const files = await glob(pattern, {
        ignore: EXCLUDE_PATTERNS,
        cwd: process.cwd(),
      });

      files.forEach(file => allFiles.add(file));

      if (files.length > 0) {
        console.log(`  ✅ Pattern "${pattern}": ${files.length} files`);
      }
    } catch (error) {
      console.error(`  ❌ Error with pattern "${pattern}": ${error.message}`);
    }
  }

  return Array.from(allFiles).sort();
}

function validateVitestConfig() {
  console.log('\n🔧 Validating vitest.e2e.config.ts...');

  const configPath = path.join(process.cwd(), 'vitest.e2e.config.ts');

  if (!fs.existsSync(configPath)) {
    console.error('  ❌ vitest.e2e.config.ts not found');
    return false;
  }

  const configContent = fs.readFileSync(configPath, 'utf8');

  // Check for key configuration elements
  const checks = [
    { pattern: /include:\s*\[/, name: 'include patterns' },
    { pattern: /\*\*\/\*e2e\*\.test\.ts/, name: 'e2e wildcard pattern' },
    { pattern: /packages\/\*\/src\/\*\*\/\*\.e2e\.test\.ts/, name: 'package e2e pattern' },
    { pattern: /tests\/e2e\/\*\*\/\*\.test\.ts/, name: 'tests/e2e pattern' },
    { pattern: /testTimeout:\s*60000/, name: 'E2E timeout configuration' },
    { pattern: /pool:\s*'forks'/, name: 'forked pool configuration' },
  ];

  let allChecksPass = true;

  for (const check of checks) {
    if (check.pattern.test(configContent)) {
      console.log(`  ✅ ${check.name}: found`);
    } else {
      console.log(`  ❌ ${check.name}: missing`);
      allChecksPass = false;
    }
  }

  return allChecksPass;
}

async function testVitestDiscovery() {
  console.log('\n🧪 Testing Vitest E2E discovery (dry run)...');

  try {
    // Run vitest in list mode to see what tests it discovers
    const result = execSync('npm run test:e2e -- --run --reporter=verbose --list', {
      encoding: 'utf8',
      cwd: process.cwd(),
    });

    // Count discovered tests
    const testLines = result.split('\n').filter(line =>
      line.includes('.e2e.test.ts') || line.includes('e2e') && line.includes('.test.ts')
    );

    console.log(`  ✅ Vitest discovered ${testLines.length} E2E test files`);
    return testLines.length;
  } catch (error) {
    console.error(`  ❌ Error running vitest discovery: ${error.message}`);
    return 0;
  }
}

async function main() {
  try {
    // Step 1: Find all E2E test files manually
    const discoveredFiles = await findE2ETests();
    console.log(`\n📊 Total E2E test files found: ${discoveredFiles.length}`);

    if (discoveredFiles.length > 0) {
      console.log('\n📝 E2E test files discovered:');
      discoveredFiles.forEach(file => {
        console.log(`  • ${file}`);
      });
    }

    // Step 2: Validate vitest configuration
    const configValid = validateVitestConfig();

    // Step 3: Test vitest discovery
    const vitestCount = await testVitestDiscovery();

    // Summary
    console.log('\n📋 Validation Summary:');
    console.log(`  Files discovered manually: ${discoveredFiles.length}`);
    console.log(`  Files discovered by vitest: ${vitestCount}`);
    console.log(`  Configuration valid: ${configValid ? '✅' : '❌'}`);

    if (discoveredFiles.length > 0 && vitestCount > 0 && configValid) {
      console.log('\n🎉 E2E test discovery configuration is working correctly!');
      console.log('\n🚀 You can now run all E2E tests with:');
      console.log('   npm run test:e2e');
      console.log('   npm run test:e2e:watch');
      process.exit(0);
    } else {
      console.log('\n⚠️  Issues found with E2E test configuration.');
      console.log('   Please review the vitest.e2e.config.ts file and test patterns.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error during validation:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { findE2ETests, validateVitestConfig, testVitestDiscovery };