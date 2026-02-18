#!/usr/bin/env node

/**
 * @fileoverview Infrastructure Validation Script
 *
 * This script validates that the element interaction test infrastructure
 * is properly set up and all dependencies are available.
 */

console.log('🔍 Validating Browser Integration Test Infrastructure...\n');

// Check if required files exist
const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'setup.ts',
  'utils/element-interaction-helpers.ts',
  'utils/test-helpers.ts',
  'fixtures/dom-element-test-fixtures.ts',
  'element-interaction-infrastructure-verification.test.ts',
  'sample-infrastructure-demo.test.ts',
  '../test-utils/browser-test-base.ts'
];

let allFilesExist = true;

console.log('📁 Checking required files:');
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - NOT FOUND`);
    allFilesExist = false;
  }
});

// Check if required dependencies are available
console.log('\n📦 Checking dependencies:');

const requiredDeps = ['playwright', 'vitest', 'pixelmatch', 'pngjs'];

requiredDeps.forEach(dep => {
  try {
    require.resolve(dep);
    console.log(`  ✅ ${dep}`);
  } catch (e) {
    console.log(`  ❌ ${dep} - NOT AVAILABLE`);
    allFilesExist = false;
  }
});

// Check vitest configuration
console.log('\n⚙️  Checking configuration:');

const vitestConfigPath = path.join(__dirname, 'vitest.config.ts');
if (fs.existsSync(vitestConfigPath)) {
  console.log('  ✅ vitest.config.ts exists');
} else {
  console.log('  ❌ vitest.config.ts - NOT FOUND');
  allFilesExist = false;
}

// Summary
console.log('\n📊 Infrastructure Summary:');
console.log('='*50);

if (allFilesExist) {
  console.log('✅ All infrastructure components are in place!');
  console.log('\n🎯 Infrastructure Features Available:');
  console.log('  • Browser automation (Playwright/Puppeteer)');
  console.log('  • Dynamic DOM element creation');
  console.log('  • Element interaction utilities');
  console.log('  • Advanced wait conditions');
  console.log('  • Element state management');
  console.log('  • Form interaction helpers');
  console.log('  • Comprehensive assertions');
  console.log('  • Screenshot capture');
  console.log('  • Test fixtures and scenarios');
  console.log('  • Error handling and recovery');

  console.log('\n🚀 Ready to run tests with:');
  console.log('  npm run test:browser-integration');
  console.log('  npm run test:browser-infrastructure');

  process.exit(0);
} else {
  console.log('❌ Some infrastructure components are missing!');
  console.log('\n🔧 Please ensure all required files and dependencies are available.');

  process.exit(1);
}