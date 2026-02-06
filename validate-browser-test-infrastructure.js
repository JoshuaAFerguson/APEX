#!/usr/bin/env node

/**
 * Browser Test Infrastructure Validation Script
 *
 * This script validates that the browser automation integration test infrastructure
 * is properly set up and all components are accessible.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Browser Test Infrastructure...\n');

// Helper function to check if file exists
function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

// Helper function to check if directory exists
function dirExists(dirPath) {
  try {
    const stats = fs.statSync(dirPath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}

// Validation results tracker
const results = {
  passed: 0,
  failed: 0,
  errors: []
};

function validateFile(filePath, description) {
  if (fileExists(filePath)) {
    console.log(`✅ ${description}: ${filePath}`);
    results.passed++;
    return true;
  } else {
    console.log(`❌ ${description}: ${filePath} (MISSING)`);
    results.failed++;
    results.errors.push(`Missing file: ${filePath}`);
    return false;
  }
}

function validateDirectory(dirPath, description) {
  if (dirExists(dirPath)) {
    console.log(`✅ ${description}: ${dirPath}`);
    results.passed++;
    return true;
  } else {
    console.log(`❌ ${description}: ${dirPath} (MISSING)`);
    results.failed++;
    results.errors.push(`Missing directory: ${dirPath}`);
    return false;
  }
}

// Core test infrastructure validation
console.log('📁 Core Test Infrastructure:');
validateDirectory('tests', 'Tests directory');
validateDirectory('tests/test-utils', 'Test utilities package');
validateDirectory('tests/browser-integration', 'Browser integration tests');

console.log('\n📦 Test Utils Package:');
validateFile('tests/test-utils/package.json', 'Test utils package.json');
validateFile('tests/test-utils/index.ts', 'Test utils index');
validateFile('tests/test-utils/tsconfig.json', 'Test utils TypeScript config');

console.log('\n🌐 Browser Test Utilities:');
validateFile('tests/test-utils/browser-test-base.ts', 'Browser test base class');
validateFile('tests/test-utils/browser-automation-mocks.ts', 'Browser automation mocks');
validateFile('tests/test-utils/browser-permission-simulator.ts', 'Browser permission simulator');
validateFile('tests/test-utils/browser-test-fixtures.ts', 'Browser test fixtures');
validateFile('tests/test-utils/browser-automation-test-setup.ts', 'Browser automation test setup');
validateFile('tests/test-utils/browser-automation-config.ts', 'Browser automation config');
validateFile('tests/test-utils/browser-error-fixtures.ts', 'Browser error fixtures');
validateFile('tests/test-utils/browser-utils.ts', 'Browser utilities');

console.log('\n🔐 Permission Test Infrastructure:');
validateFile('tests/test-utils/permission-test-helpers.ts', 'Permission test helpers');
validateFile('tests/test-utils/autonomy-test-helpers.ts', 'Autonomy test helpers');
validateFile('tests/test-utils/mcp-permission-helpers.ts', 'MCP permission helpers');

console.log('\n⚙️ Browser Integration Setup:');
validateFile('tests/browser-integration/setup.ts', 'Browser integration setup');
validateFile('tests/browser-integration/vitest.config.ts', 'Browser integration Vitest config');

console.log('\n🛠️ Browser Integration Utilities:');
validateFile('tests/browser-integration/utils/browser-automation-test-helpers.ts', 'Browser automation test helpers');
validateFile('tests/browser-integration/utils/browser-permission-mocks.ts', 'Browser permission mocks');
validateFile('tests/browser-integration/utils/integration-test-context.ts', 'Integration test context');
validateFile('tests/browser-integration/utils/test-helpers.ts', 'Test helpers');

console.log('\n📄 Test Fixtures:');
validateFile('tests/browser-integration/fixtures/common-scenarios.ts', 'Common test scenarios');
validateFile('tests/browser-integration/fixtures/permission-test-scenarios.ts', 'Permission test scenarios');
validateFile('tests/browser-integration/fixtures/error-page-scenarios.ts', 'Error page scenarios');

console.log('\n🌐 HTML Test Fixtures:');
validateFile('tests/browser-integration/fixtures/basic-test-page.html', 'Basic test page HTML');
validateFile('tests/browser-integration/fixtures/form-test-page.html', 'Form test page HTML');
validateFile('tests/browser-integration/fixtures/interactive-test-page.html', 'Interactive test page HTML');
validateFile('tests/browser-integration/fixtures/error-test-page.html', 'Error test page HTML');

console.log('\n📋 New Implementation Files:');
validateFile('tests/browser-integration/test-infrastructure-complete.test.ts', 'Infrastructure completion test');
validateFile('tests/browser-integration/IMPLEMENTATION_FINAL_SUMMARY.md', 'Final implementation summary');
validateFile('validate-browser-test-infrastructure.js', 'Validation script (this file)');

console.log('\n🔧 Project Configuration:');
validateFile('package.json', 'Main package.json');
validateFile('tsconfig.json', 'Main TypeScript config');

// Check package.json for browser test scripts
console.log('\n📜 Package.json Scripts Validation:');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredScripts = [
    'test:browser-integration',
    'test:browser-integration:watch',
    'test:browser-integration:coverage',
    'test:browser-infrastructure'
  ];

  requiredScripts.forEach(script => {
    if (packageJson.scripts && packageJson.scripts[script]) {
      console.log(`✅ Script: ${script}`);
      results.passed++;
    } else {
      console.log(`❌ Script: ${script} (MISSING)`);
      results.failed++;
      results.errors.push(`Missing npm script: ${script}`);
    }
  });
} catch (error) {
  console.log(`❌ Failed to read package.json: ${error.message}`);
  results.failed++;
}

// Check dependencies
console.log('\n📦 Dependencies Validation:');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = [
    'playwright',
    'puppeteer',
    'vitest',
    '@vitest/coverage-v8'
  ];

  requiredDeps.forEach(dep => {
    if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
      console.log(`✅ Dependency: ${dep} (${packageJson.devDependencies[dep]})`);
      results.passed++;
    } else {
      console.log(`❌ Dependency: ${dep} (MISSING)`);
      results.failed++;
      results.errors.push(`Missing dependency: ${dep}`);
    }
  });
} catch (error) {
  console.log(`❌ Failed to read dependencies: ${error.message}`);
  results.failed++;
}

// Check test-utils package.json exports
console.log('\n📤 Test Utils Exports Validation:');
try {
  const testUtilsPackage = JSON.parse(fs.readFileSync('tests/test-utils/package.json', 'utf8'));
  const requiredExports = [
    './browser-test-base',
    './browser-automation-mocks',
    './browser-permission-simulator',
    './browser-test-fixtures',
    './browser-automation-test-setup',
    './browser-automation-config',
    './browser-error-fixtures',
    './browser-utils',
    './permission-test-helpers',
    './autonomy-test-helpers'
  ];

  requiredExports.forEach(exportPath => {
    if (testUtilsPackage.exports && testUtilsPackage.exports[exportPath]) {
      console.log(`✅ Export: ${exportPath}`);
      results.passed++;
    } else {
      console.log(`❌ Export: ${exportPath} (MISSING)`);
      results.failed++;
      results.errors.push(`Missing export: ${exportPath}`);
    }
  });
} catch (error) {
  console.log(`❌ Failed to read test-utils package.json: ${error.message}`);
  results.failed++;
}

// Final summary
console.log('\n' + '='.repeat(60));
console.log('📊 VALIDATION SUMMARY');
console.log('='.repeat(60));

console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);

if (results.failed === 0) {
  console.log('\n🎉 ALL VALIDATIONS PASSED!');
  console.log('✅ Browser automation integration test infrastructure is complete and ready to use.');
  console.log('\n📋 Next Steps:');
  console.log('  • Run: npm run test:browser-integration');
  console.log('  • Run: npm run test:browser-integration:coverage');
  console.log('  • Run: npm run validate:browser-infrastructure');
  process.exit(0);
} else {
  console.log('\n⚠️  SOME VALIDATIONS FAILED');
  console.log('\n❌ Errors found:');
  results.errors.forEach(error => {
    console.log(`   • ${error}`);
  });
  console.log('\n🔧 Please fix the issues above before using the test infrastructure.');
  process.exit(1);
}