#!/usr/bin/env node

/**
 * @fileoverview Validation script for sample integration test infrastructure
 *
 * This script validates that all components required for the sample integration test
 * are properly configured and accessible.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Sample Integration Test Infrastructure...\n');

const validations = [];
let allValid = true;

// Helper functions
function checkFile(filePath, description) {
  const exists = fs.existsSync(filePath);
  validations.push({
    check: description,
    status: exists ? '✅ PASS' : '❌ FAIL',
    details: exists ? `Found: ${filePath}` : `Missing: ${filePath}`
  });
  if (!exists) allValid = false;
  return exists;
}

function checkPackage(packageName, description) {
  try {
    require.resolve(packageName);
    validations.push({
      check: description,
      status: '✅ PASS',
      details: `Package available: ${packageName}`
    });
    return true;
  } catch (error) {
    validations.push({
      check: description,
      status: '❌ FAIL',
      details: `Package missing: ${packageName}`
    });
    allValid = false;
    return false;
  }
}

// 1. Check core test files
console.log('📁 Checking core test files...');
checkFile('./tests/browser-integration/sample-complete-setup-demonstration.test.ts', 'Sample integration test file');
checkFile('./tests/browser-integration/SAMPLE_INTEGRATION_TEST_GUIDE.md', 'Sample test documentation');
checkFile('./tests/browser-integration/setup.ts', 'Browser test setup file');
checkFile('./tests/browser-integration/vitest.config.ts', 'Vitest configuration');

// 2. Check fixture files
console.log('🎭 Checking fixture files...');
checkFile('./tests/browser-integration/fixtures/common-scenarios.ts', 'Common test scenarios');
checkFile('./tests/browser-integration/utils/test-helpers.ts', 'Test utility helpers');

// 3. Check test utilities
console.log('🔧 Checking test utilities...');
checkFile('./tests/test-utils/mock-server-factory.ts', 'Mock server factory');
checkFile('./tests/test-utils/index.ts', 'Test utilities index');

// 4. Check required packages
console.log('📦 Checking required packages...');
checkPackage('playwright', 'Playwright browser automation');
checkPackage('vitest', 'Vitest testing framework');
checkPackage('@playwright/test', 'Playwright test runner');

// 5. Check package.json scripts
console.log('📜 Checking npm scripts...');
try {
  const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  const scripts = packageJson.scripts || {};

  const requiredScripts = [
    'test:browser-integration',
    'validate:browser-infrastructure',
    'validate:playwright-setup'
  ];

  for (const script of requiredScripts) {
    if (scripts[script]) {
      validations.push({
        check: `NPM Script: ${script}`,
        status: '✅ PASS',
        details: `Script defined: ${scripts[script]}`
      });
    } else {
      validations.push({
        check: `NPM Script: ${script}`,
        status: '⚠️ WARN',
        details: `Script not found: ${script}`
      });
    }
  }
} catch (error) {
  validations.push({
    check: 'Package.json validation',
    status: '❌ FAIL',
    details: `Cannot read package.json: ${error.message}`
  });
  allValid = false;
}

// 6. Check TypeScript configuration
console.log('🔨 Checking TypeScript configuration...');
try {
  const browserTsConfig = './tests/browser-integration/tsconfig.json';
  if (fs.existsSync(browserTsConfig)) {
    validations.push({
      check: 'Browser integration TypeScript config',
      status: '✅ PASS',
      details: `Found: ${browserTsConfig}`
    });
  } else {
    validations.push({
      check: 'Browser integration TypeScript config',
      status: '⚠️ WARN',
      details: `Optional config not found: ${browserTsConfig}`
    });
  }
} catch (error) {
  validations.push({
    check: 'TypeScript configuration',
    status: '❌ FAIL',
    details: `Error checking TypeScript config: ${error.message}`
  });
}

// 7. Check Playwright installation
console.log('🎭 Checking Playwright browsers...');
try {
  const { execSync } = require('child_process');

  // Try to check if playwright browsers are installed
  try {
    execSync('npx playwright --version', { stdio: 'pipe' });
    validations.push({
      check: 'Playwright CLI available',
      status: '✅ PASS',
      details: 'Playwright CLI is accessible'
    });
  } catch (error) {
    validations.push({
      check: 'Playwright CLI available',
      status: '❌ FAIL',
      details: 'Playwright CLI not accessible'
    });
    allValid = false;
  }
} catch (error) {
  validations.push({
    check: 'Playwright installation',
    status: '⚠️ WARN',
    details: 'Cannot verify Playwright installation'
  });
}

// Print validation results
console.log('\n📋 Validation Results:\n');
for (const validation of validations) {
  console.log(`${validation.status} ${validation.check}`);
  console.log(`   ${validation.details}\n`);
}

// Summary
const passCount = validations.filter(v => v.status.includes('PASS')).length;
const failCount = validations.filter(v => v.status.includes('FAIL')).length;
const warnCount = validations.filter(v => v.status.includes('WARN')).length;

console.log('📊 Summary:');
console.log(`   ✅ Passed: ${passCount}`);
console.log(`   ❌ Failed: ${failCount}`);
console.log(`   ⚠️  Warnings: ${warnCount}`);
console.log(`   📝 Total: ${validations.length}\n`);

if (allValid && failCount === 0) {
  console.log('🎉 All critical validations passed! The sample integration test infrastructure is ready.');
  console.log('\n🚀 Next steps:');
  console.log('   1. Install Playwright browsers: npx playwright install');
  console.log('   2. Run the sample test: npm run test:browser-integration');
  console.log('   3. Review the test guide: tests/browser-integration/SAMPLE_INTEGRATION_TEST_GUIDE.md');
  process.exit(0);
} else {
  console.log('⚠️ Some validations failed. Please address the issues above before running tests.');
  console.log('\n🔧 Common fixes:');
  console.log('   - Install dependencies: npm install');
  console.log('   - Install Playwright: npx playwright install');
  console.log('   - Check file paths and ensure all files are present');
  process.exit(1);
}