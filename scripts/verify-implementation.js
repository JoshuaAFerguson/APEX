#!/usr/bin/env node

/**
 * @fileoverview Implementation Verification Script
 *
 * Verifies that the consolidated E2E test configuration implementation
 * is complete and working correctly.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Consolidated E2E Test Implementation...\n');

// Expected files that should exist
const expectedFiles = [
  'vitest.e2e.config.ts',
  'vitest.shared.config.ts',
  'scripts/unified-test-runner.js',
  'scripts/validate-e2e-test-discovery.js',
  'scripts/validate-unified-test-runner.js',
  'docs/UNIFIED_TEST_CONFIGURATION.md'
];

// Expected npm scripts
const expectedScripts = [
  'test:unified',
  'test:unified:e2e',
  'test:unified:unit',
  'test:unified:integration',
  'test:unified:browser',
  'test:unified:watch',
  'test:unified:coverage',
  'test:unified:validate',
  'test:unified:marketplace',
  'test:unified:cli',
  'test:unified:list',
  'test:unified:list:e2e',
  'validate:unified-tests'
];

// Expected E2E test directories
const expectedDirectories = [
  'tests/e2e',
  'tests/integration',
  'tests/browser-integration',
  'tests/keyboard-integration',
  'tests/form-integration',
  'tests/page-navigation'
];

let allChecksPass = true;

// Check 1: Verify expected files exist
console.log('📁 Checking implementation files...');
expectedFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    allChecksPass = false;
  }
});

// Check 2: Verify package.json scripts
console.log('\n📦 Checking npm scripts...');
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

expectedScripts.forEach(script => {
  if (packageJson.scripts[script]) {
    console.log(`  ✅ ${script}`);
  } else {
    console.log(`  ❌ ${script} - MISSING`);
    allChecksPass = false;
  }
});

// Check 3: Verify test directories
console.log('\n📂 Checking test directories...');
expectedDirectories.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir);
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    const testFiles = fs.readdirSync(dirPath).filter(f => f.endsWith('.test.ts'));
    console.log(`  ✅ ${dir} (${testFiles.length} test files)`);
  } else {
    console.log(`  ❌ ${dir} - MISSING or not a directory`);
    allChecksPass = false;
  }
});

// Check 4: Verify vitest.e2e.config.ts content
console.log('\n🔧 Verifying E2E configuration...');
const e2eConfigPath = path.join(process.cwd(), 'vitest.e2e.config.ts');
if (fs.existsSync(e2eConfigPath)) {
  const configContent = fs.readFileSync(e2eConfigPath, 'utf8');

  const requiredPatterns = [
    /packages\/\*\/src\/\*\*\/\*\.e2e\.test\.ts/,
    /tests\/e2e\/\*\*\/\*\.test\.ts/,
    /\*\*\/\*e2e\*\.test\.ts/,
    /tests\/e2e\/\*\*\/mcp-\*\.test\.ts/,
    /tests\/e2e\/\*\*\/marketplace\*\.test\.ts/,
    /testTimeout:\s*60000/,
    /pool:\s*'forks'/
  ];

  const patternNames = [
    'package e2e pattern',
    'tests/e2e pattern',
    'e2e wildcard pattern',
    'mcp test pattern',
    'marketplace test pattern',
    '60s timeout',
    'forked pool'
  ];

  requiredPatterns.forEach((pattern, index) => {
    if (pattern.test(configContent)) {
      console.log(`  ✅ ${patternNames[index]}`);
    } else {
      console.log(`  ❌ ${patternNames[index]} - MISSING`);
      allChecksPass = false;
    }
  });
} else {
  console.log('  ❌ vitest.e2e.config.ts not found');
  allChecksPass = false;
}

// Check 5: Count discovered E2E tests
console.log('\n🧪 Checking E2E test discovery...');
const e2eDir = path.join(process.cwd(), 'tests/e2e');
if (fs.existsSync(e2eDir)) {
  const e2eFiles = fs.readdirSync(e2eDir).filter(f => f.endsWith('.test.ts'));
  console.log(`  ✅ Core E2E tests: ${e2eFiles.length} files`);

  // Check for marketplace tests
  const marketplaceTests = e2eFiles.filter(f => f.includes('marketplace') || f.includes('mcp'));
  console.log(`  ✅ Marketplace E2E tests: ${marketplaceTests.length} files`);

  if (marketplaceTests.length === 0) {
    console.log('  ⚠️  No marketplace tests found in tests/e2e/');
  } else {
    console.log('  📝 Marketplace test files:');
    marketplaceTests.forEach(file => {
      console.log(`    • ${file}`);
    });
  }
} else {
  console.log('  ❌ tests/e2e directory not found');
  allChecksPass = false;
}

// Check 6: Validate unified test runner structure
console.log('\n🤖 Checking unified test runner...');
const unifiedRunnerPath = path.join(process.cwd(), 'scripts/unified-test-runner.js');
if (fs.existsSync(unifiedRunnerPath)) {
  const runnerContent = fs.readFileSync(unifiedRunnerPath, 'utf8');

  const runnerChecks = [
    { pattern: /TEST_CONFIGS\s*=/, name: 'test config mapping' },
    { pattern: /parseArguments/, name: 'argument parsing' },
    { pattern: /discoverTests/, name: 'test discovery function' },
    { pattern: /buildVitestCommand/, name: 'command building' },
    { pattern: /validateTestDiscovery/, name: 'validation function' }
  ];

  runnerChecks.forEach(check => {
    if (check.pattern.test(runnerContent)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} - MISSING`);
      allChecksPass = false;
    }
  });
} else {
  console.log('  ❌ unified test runner not found');
  allChecksPass = false;
}

// Final summary
console.log('\n📊 Implementation Verification Summary:');
console.log(`  Files: ${expectedFiles.filter(f => fs.existsSync(path.join(process.cwd(), f))).length}/${expectedFiles.length}`);
console.log(`  Scripts: ${expectedScripts.filter(s => packageJson.scripts[s]).length}/${expectedScripts.length}`);
console.log(`  Directories: ${expectedDirectories.filter(d => fs.existsSync(path.join(process.cwd(), d))).length}/${expectedDirectories.length}`);

if (allChecksPass) {
  console.log('\n🎉 Implementation verification PASSED!');
  console.log('\n✅ Consolidated E2E test configuration is properly implemented.');
  console.log('\n🚀 Next steps:');
  console.log('   1. Run: npm run build (to verify build works)');
  console.log('   2. Run: npm run validate:unified-tests (to validate all configs)');
  console.log('   3. Run: npm run test:unified:list:e2e (to list all E2E tests)');
  console.log('   4. Run: npm run test:unified:e2e (to execute all E2E tests)');
  process.exit(0);
} else {
  console.log('\n❌ Implementation verification FAILED!');
  console.log('\n⚠️  Please address the missing components above.');
  process.exit(1);
}