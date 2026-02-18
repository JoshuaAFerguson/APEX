#!/usr/bin/env node
/**
 * @fileoverview Playwright Setup Validation Script
 *
 * This script validates that Playwright is correctly set up and configured
 * for browser automation in the APEX project.
 */

const fs = require('fs').promises;
const path = require('path');

async function validatePlaywrightSetup() {
  console.log('🔍 Validating Playwright setup...\n');

  const results = [];
  let hasErrors = false;

  // Check if playwright.config.ts exists
  try {
    const configPath = path.join(process.cwd(), 'playwright.config.ts');
    await fs.access(configPath);
    results.push('✅ playwright.config.ts exists');
  } catch (error) {
    results.push('❌ playwright.config.ts missing');
    hasErrors = true;
  }

  // Check if @playwright/test is in package.json
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    const hasPlaywrightTest = packageJson.devDependencies?.['@playwright/test'];

    if (hasPlaywrightTest) {
      results.push(`✅ @playwright/test dependency found (${hasPlaywrightTest})`);
    } else {
      results.push('❌ @playwright/test dependency missing');
      hasErrors = true;
    }
  } catch (error) {
    results.push('❌ Could not read package.json');
    hasErrors = true;
  }

  // Check if @vitest/browser is in package.json
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    const hasVitestBrowser = packageJson.devDependencies?.['@vitest/browser'];

    if (hasVitestBrowser) {
      results.push(`✅ @vitest/browser dependency found (${hasVitestBrowser})`);
    } else {
      results.push('❌ @vitest/browser dependency missing');
      hasErrors = true;
    }
  } catch (error) {
    results.push('❌ Could not verify @vitest/browser dependency');
    hasErrors = true;
  }

  // Check if vitest.browser.config.ts exists
  try {
    const vitestConfigPath = path.join(process.cwd(), 'vitest.browser.config.ts');
    await fs.access(vitestConfigPath);
    results.push('✅ vitest.browser.config.ts exists');
  } catch (error) {
    results.push('❌ vitest.browser.config.ts missing');
    hasErrors = true;
  }

  // Check if test directories exist
  try {
    const playwrightTestDir = path.join(process.cwd(), 'tests', 'playwright');
    await fs.access(playwrightTestDir);
    results.push('✅ tests/playwright directory exists');
  } catch (error) {
    results.push('❌ tests/playwright directory missing');
    hasErrors = true;
  }

  try {
    const browserTestDir = path.join(process.cwd(), 'tests', 'browser');
    await fs.access(browserTestDir);
    results.push('✅ tests/browser directory exists');
  } catch (error) {
    results.push('❌ tests/browser directory missing');
    hasErrors = true;
  }

  // Check if test files exist
  try {
    const playwrightTestFile = path.join(process.cwd(), 'tests', 'playwright', 'basic-verification.spec.ts');
    await fs.access(playwrightTestFile);
    results.push('✅ Playwright test file exists');
  } catch (error) {
    results.push('❌ Playwright test file missing');
    hasErrors = true;
  }

  try {
    const vitestBrowserTestFile = path.join(process.cwd(), 'tests', 'browser', 'playwright-vitest-integration.test.ts');
    await fs.access(vitestBrowserTestFile);
    results.push('✅ Vitest browser test file exists');
  } catch (error) {
    results.push('❌ Vitest browser test file missing');
    hasErrors = true;
  }

  // Check if required modules can be imported
  try {
    require('playwright');
    results.push('✅ Playwright module can be imported');
  } catch (error) {
    results.push('❌ Playwright module cannot be imported');
    hasErrors = true;
  }

  try {
    require('vitest');
    results.push('✅ Vitest module can be imported');
  } catch (error) {
    results.push('❌ Vitest module cannot be imported');
    hasErrors = true;
  }

  // Print results
  console.log('Validation Results:');
  console.log('==================');
  results.forEach(result => console.log(result));

  console.log('\n' + '='.repeat(50));

  if (hasErrors) {
    console.log('❌ Playwright setup has issues that need to be resolved.');
    console.log('\nTo fix the setup, run:');
    console.log('  npm install');
    console.log('  npm run playwright:install');
    process.exit(1);
  } else {
    console.log('✅ Playwright setup is complete and ready for testing!');
    console.log('\nAvailable commands:');
    console.log('  npm run playwright:test        - Run Playwright tests');
    console.log('  npm run playwright:test:headed - Run with browser UI');
    console.log('  npm run test:browser           - Run Vitest browser tests');
    console.log('  npm run test:browser:watch     - Run Vitest browser tests in watch mode');
    process.exit(0);
  }
}

// Run validation
validatePlaywrightSetup().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});