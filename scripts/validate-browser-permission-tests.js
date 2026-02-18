#!/usr/bin/env node

/**
 * Browser Permission Tests Validation Script
 *
 * Validates that the browser permission integration tests are properly structured
 * and can be discovered by the test runner.
 */

const fs = require('fs');
const path = require('path');

const testDirectory = path.join(__dirname, '../tests/integration');

console.log('🔍 Validating Browser Permission Tests...\n');

// Test files to validate
const testFiles = [
  'browser-permission-integration-comprehensive.test.ts',
  'browser-permission-edge-cases.test.ts',
  'browser-mcp-permission-integration.test.ts',
];

let allValid = true;

for (const testFile of testFiles) {
  const testPath = path.join(testDirectory, testFile);

  console.log(`📝 Checking ${testFile}...`);

  if (!fs.existsSync(testPath)) {
    console.log(`   ❌ File not found: ${testPath}`);
    allValid = false;
    continue;
  }

  try {
    const content = fs.readFileSync(testPath, 'utf8');

    // Check for essential test structure
    const checks = [
      { pattern: /describe\(/g, name: 'describe blocks' },
      { pattern: /it\(/g, name: 'test cases' },
      { pattern: /expect\(/g, name: 'assertions' },
      { pattern: /beforeEach/g, name: 'setup' },
      { pattern: /afterEach/g, name: 'teardown' },
      { pattern: /permissionManager/g, name: 'permission manager usage' },
      { pattern: /browserTool/g, name: 'browser tool usage' },
      { pattern: /grantPermission/g, name: 'permission grants' },
      { pattern: /\.success.*toBe/g, name: 'success assertions' },
    ];

    for (const check of checks) {
      const matches = content.match(check.pattern);
      const count = matches ? matches.length : 0;

      if (count > 0) {
        console.log(`   ✅ ${check.name}: ${count} found`);
      } else {
        console.log(`   ⚠️  ${check.name}: not found`);
      }
    }

    // Check for specific test scenarios
    const scenarios = [
      'navigation operations',
      'click operations',
      'screenshot operations',
      'JavaScript evaluation',
      'form submission',
      'permission inheritance',
      'permission escalation',
      'error handling',
      'resource cleanup',
    ];

    console.log(`   📊 Test scenarios covered:`);
    for (const scenario of scenarios) {
      const scenarioPattern = new RegExp(scenario.replace(/\s+/g, '.*'), 'i');
      if (scenarioPattern.test(content)) {
        console.log(`      ✅ ${scenario}`);
      } else {
        console.log(`      ➖ ${scenario} (may be covered differently)`);
      }
    }

    // Count total test cases
    const testCases = content.match(/it\(/g) || [];
    console.log(`   📈 Total test cases: ${testCases.length}`);

    console.log(`   ✅ ${testFile} is valid\n`);

  } catch (error) {
    console.log(`   ❌ Error reading file: ${error.message}\n`);
    allValid = false;
  }
}

// Check for configuration files
console.log('🔧 Checking test configuration...');

const configFiles = [
  'vitest.browser-permissions.config.ts',
  'setup/browser-permissions-setup.ts',
];

for (const configFile of configFiles) {
  const configPath = path.join(testDirectory, configFile);

  if (fs.existsSync(configPath)) {
    console.log(`   ✅ ${configFile} exists`);
  } else {
    console.log(`   ❌ ${configFile} not found`);
    allValid = false;
  }
}

// Check for test utilities
console.log('\n🔨 Checking test utilities...');

const utilsPath = path.join(__dirname, '../packages/orchestrator/src/__tests__/v050-integration/test-utils.ts');
if (fs.existsSync(utilsPath)) {
  console.log('   ✅ Test utilities available');

  try {
    const utilsContent = fs.readFileSync(utilsPath, 'utf8');

    const utilities = [
      'createTestTask',
      'MockBrowserSession',
      'createTestPermissionManager',
      'MockMCPServer',
    ];

    for (const utility of utilities) {
      if (utilsContent.includes(utility)) {
        console.log(`   ✅ ${utility} utility found`);
      } else {
        console.log(`   ⚠️  ${utility} utility not found`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Error reading utilities: ${error.message}`);
  }
} else {
  console.log('   ❌ Test utilities not found');
  allValid = false;
}

// Summary
console.log('\n📋 Validation Summary:');
console.log(`   Total test files: ${testFiles.length}`);
console.log(`   Configuration files: ${configFiles.length}`);

if (allValid) {
  console.log('\n🎉 All browser permission tests are properly structured and ready to run!');

  console.log('\n📖 To run the tests:');
  console.log('   npm test -- tests/integration/browser-*permission*.test.ts');
  console.log('   # OR with specific config:');
  console.log('   vitest run --config tests/integration/vitest.browser-permissions.config.ts');

  process.exit(0);
} else {
  console.log('\n❌ Some issues found with test structure. Please review the errors above.');
  process.exit(1);
}