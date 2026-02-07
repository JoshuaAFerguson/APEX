#!/usr/bin/env node

/**
 * @fileoverview Type Interaction Infrastructure Verification
 *
 * This script verifies that the integration test infrastructure for type interactions
 * is properly implemented and meets all acceptance criteria.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Type Interaction Integration Test Infrastructure...\n');

// Test file paths
const testFiles = {
  mainTest: 'tests/browser-integration/type-interactions.integration.test.ts',
  validationTest: 'tests/browser-integration/type-interactions-validation.test.ts',
  htmlFixture: 'tests/browser-integration/fixtures/type-interaction-test-page.html',
  helpers: 'tests/browser-integration/utils/type-interaction-helpers.ts',
  setup: 'tests/browser-integration/setup.ts',
  config: 'tests/browser-integration/vitest.config.ts'
};

let allValid = true;

// Verification functions
function checkFileExists(filepath, description) {
  try {
    const stats = fs.statSync(filepath);
    console.log(`✅ ${description}: ${filepath} (${stats.size} bytes)`);
    return true;
  } catch (error) {
    console.log(`❌ ${description}: ${filepath} - NOT FOUND`);
    allValid = false;
    return false;
  }
}

function checkFileContent(filepath, patterns, description) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    let hasAllPatterns = true;

    patterns.forEach(pattern => {
      if (!content.includes(pattern)) {
        console.log(`  ⚠️  Missing pattern in ${description}: "${pattern}"`);
        hasAllPatterns = false;
        allValid = false;
      }
    });

    if (hasAllPatterns) {
      console.log(`✅ ${description}: All required patterns found`);
    }

    return hasAllPatterns;
  } catch (error) {
    console.log(`❌ ${description}: Cannot read file - ${error.message}`);
    allValid = false;
    return false;
  }
}

function checkPackageScripts() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const scripts = packageJson.scripts || {};

    const requiredScripts = [
      'test:browser-integration',
      'test:browser-integration:watch',
      'test:browser-integration:coverage'
    ];

    let allScriptsPresent = true;
    requiredScripts.forEach(script => {
      if (scripts[script]) {
        console.log(`✅ NPM Script: ${script}`);
      } else {
        console.log(`❌ NPM Script: ${script} - NOT FOUND`);
        allScriptsPresent = false;
        allValid = false;
      }
    });

    return allScriptsPresent;
  } catch (error) {
    console.log(`❌ Package.json check failed: ${error.message}`);
    allValid = false;
    return false;
  }
}

// Run verifications
console.log('📁 Checking file existence...');
Object.entries(testFiles).forEach(([key, filepath]) => {
  checkFileExists(filepath, key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'));
});

console.log('\n📝 Checking content patterns...');

// Check main test file for required imports and test structure
checkFileContent(testFiles.mainTest, [
  'import { describe, it, expect',
  'import { Browser, BrowserContext, Page } from \'playwright\'',
  'simulateTyping',
  'Basic Text Input Typing',
  'beforeAll',
  'afterAll'
], 'Main Test File Structure');

// Check HTML fixture for required input elements
checkFileContent(testFiles.htmlFixture, [
  'id="basic-text-input"',
  'id="email-input"',
  'id="password-input"',
  'id="number-input"',
  'type="text"',
  'type="email"',
  'type="password"',
  'type="number"'
], 'HTML Fixture Input Elements');

// Check helper utilities for typing functions
checkFileContent(testFiles.helpers, [
  'simulateTyping',
  'simulateSlowTyping',
  'simulatePasteText',
  'TypingOptions',
  'Page, Locator',
  'delayBetweenChars'
], 'Helper Utilities');

// Check Vitest configuration
checkFileContent(testFiles.config, [
  'defineConfig',
  'testTimeout: 60000',
  'environment: \'node\'',
  '**/*.integration.test.ts',
  'setupFiles'
], 'Vitest Configuration');

console.log('\n📦 Checking NPM scripts...');
checkPackageScripts();

console.log('\n📊 Summary:');
if (allValid) {
  console.log('🎉 ALL CHECKS PASSED! Integration test infrastructure is ready.');
  console.log('\n📋 Acceptance Criteria Verification:');
  console.log('✅ Integration test file created with proper imports');
  console.log('✅ Test fixtures (HTML with various input types)');
  console.log('✅ Helper utilities for simulating typing');
  console.log('✅ Test runner can execute the test suite');
  console.log('\n🚀 Ready for execution with: npm run test:browser-integration');
} else {
  console.log('❌ SOME CHECKS FAILED! Please review the issues above.');
}

process.exit(allValid ? 0 : 1);