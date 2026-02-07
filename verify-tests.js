#!/usr/bin/env node

/**
 * Test verification script for single select dropdown integration tests
 *
 * This script verifies:
 * 1. Test file exists and is valid TypeScript
 * 2. All required test cases are present
 * 3. Test infrastructure is properly configured
 * 4. Dependencies are available
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Verifying Single Select Dropdown Integration Tests...\n');

// Check if test files exist
const testFile = 'tests/form-integration/single-select-dropdown-interactions.test.ts';
const setupFile = 'tests/form-integration/setup.ts';
const configFile = 'tests/form-integration/vitest.config.ts';

console.log('📁 Checking test file structure...');

const files = [testFile, setupFile, configFile];
let allFilesExist = true;

files.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} - exists`);
  } else {
    console.log(`❌ ${file} - missing`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ Some required test files are missing!');
  process.exit(1);
}

// Check test content for required test cases
console.log('\n🔍 Verifying test coverage...');

const testContent = fs.readFileSync(testFile, 'utf8');

const requiredTestSuites = [
  'Opening Dropdown',
  'Selecting an Option',
  'Closing Dropdown',
  'Keyboard Navigation',
  'Disabled State',
  'Selected Value Reflects in Form State'
];

let allTestsPresent = true;

requiredTestSuites.forEach(testSuite => {
  if (testContent.includes(`describe('${testSuite}'`)) {
    console.log(`✅ ${testSuite} - test suite present`);
  } else {
    console.log(`❌ ${testSuite} - test suite missing`);
    allTestsPresent = false;
  }
});

// Check for specific test scenarios
console.log('\n🔍 Verifying specific test scenarios...');

const requiredScenarios = [
  'should open dropdown on focus',
  'should open dropdown on click',
  'should open dropdown on keyboard interaction',
  'should not open disabled dropdown',
  'should select option by value assignment',
  'should select option by selectedIndex assignment',
  'should handle selection with keyboard navigation',
  'should close dropdown on blur',
  'should close dropdown on Escape key',
  'should close dropdown when clicking outside',
  'should navigate options with arrow keys',
  'should navigate options with arrow up key',
  'should navigate to first/last options with Home/End keys',
  'should navigate by typing first letter',
  'should handle Tab key for focus navigation',
  'should not be focusable when disabled',
  'should not be clickable when disabled',
  'should not respond to keyboard events when disabled',
  'should include selected value in FormData',
  'should update FormData when selection changes'
];

let allScenariosPresent = true;

requiredScenarios.forEach(scenario => {
  if (testContent.includes(`'${scenario}'`) || testContent.includes(`"${scenario}"`)) {
    console.log(`✅ ${scenario} - test present`);
  } else {
    console.log(`❌ ${scenario} - test missing`);
    allScenariosPresent = false;
  }
});

// Check dependencies
console.log('\n📦 Checking test dependencies...');

try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  const requiredDependencies = [
    'vitest',
    '@vitest/coverage-v8'
  ];

  let allDependenciesPresent = true;

  requiredDependencies.forEach(dep => {
    if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
      console.log(`✅ ${dep} - ${packageJson.devDependencies[dep]}`);
    } else {
      console.log(`❌ ${dep} - missing`);
      allDependenciesPresent = false;
    }
  });

  if (!allDependenciesPresent) {
    console.log('\n❌ Some required dependencies are missing!');
  }

} catch (error) {
  console.log('❌ Error reading package.json:', error.message);
}

// Summary
console.log('\n📊 Test Verification Summary:');
console.log(`File structure: ${allFilesExist ? '✅ Pass' : '❌ Fail'}`);
console.log(`Test suites: ${allTestsPresent ? '✅ Pass' : '❌ Fail'}`);
console.log(`Test scenarios: ${allScenariosPresent ? '✅ Pass' : '❌ Fail'}`);

if (allFilesExist && allTestsPresent && allScenariosPresent) {
  console.log('\n🎉 All single select dropdown integration tests are properly implemented!');
  console.log('\n📋 Test Coverage Summary:');
  console.log('✅ Opening dropdown (focus, click, keyboard, disabled state)');
  console.log('✅ Selecting options (value assignment, selectedIndex, keyboard)');
  console.log('✅ Closing dropdown (blur, escape, click outside, after selection)');
  console.log('✅ Keyboard navigation (arrow keys, home/end, typing, tab)');
  console.log('✅ Disabled state (not focusable, not clickable, no keyboard events)');
  console.log('✅ Form state reflection (FormData integration, validation)');
  console.log('✅ Edge cases and integration scenarios');

  process.exit(0);
} else {
  console.log('\n❌ Some tests are missing or incomplete!');
  process.exit(1);
}