#!/usr/bin/env node

/**
 * Browser Integration Infrastructure Verification Script
 *
 * This script verifies that all the browser automation test infrastructure
 * components are properly configured and available.
 */

import fs from 'fs/promises';
import path from 'path';

const requiredFiles = [
  // Main setup and configuration
  'setup.ts',
  'vitest.config.ts',

  // Core utilities
  'utils/browser-automation-test-helpers.ts',
  'utils/browser-permission-mocks.ts',
  'utils/integration-test-context.ts',
  'utils/test-helpers.ts',

  // Test files
  'infrastructure-verification.test.ts',

  // Fixtures and scenarios
  'fixtures/common-scenarios.ts',
  'fixtures/permission-test-scenarios.ts',
  'fixtures/error-page-scenarios.ts'
];

const requiredTestUtilsFiles = [
  'browser-test-base.ts',
  'permission-test-helpers.ts',
  'browser-automation-mocks.ts',
  'browser-permission-simulator.ts',
  'browser-test-fixtures.ts',
  'browser-automation-test-setup.ts',
  'browser-automation-config.ts'
];

async function verifyFile(filepath) {
  try {
    await fs.access(filepath);
    return { path: filepath, exists: true, error: null };
  } catch (error) {
    return { path: filepath, exists: false, error: error.message };
  }
}

async function verifyBrowserIntegrationInfrastructure() {
  console.log('🔍 Verifying Browser Integration Infrastructure...\n');

  const baseDir = '/Users/s0v3r1gn/APEX/tests/browser-integration';
  const testUtilsDir = '/Users/s0v3r1gn/APEX/tests/test-utils';

  let allPassed = true;

  // Check browser integration files
  console.log('📁 Checking browser integration files:');
  for (const file of requiredFiles) {
    const result = await verifyFile(path.join(baseDir, file));
    const status = result.exists ? '✅' : '❌';
    console.log(`  ${status} ${file}`);
    if (!result.exists) {
      console.log(`     Error: ${result.error}`);
      allPassed = false;
    }
  }

  console.log('\n📁 Checking test-utils files:');
  for (const file of requiredTestUtilsFiles) {
    const result = await verifyFile(path.join(testUtilsDir, file));
    const status = result.exists ? '✅' : '❌';
    console.log(`  ${status} ${file}`);
    if (!result.exists) {
      console.log(`     Error: ${result.error}`);
      allPassed = false;
    }
  }

  // Check package.json configurations
  console.log('\n📦 Checking package configurations:');

  try {
    const rootPackage = JSON.parse(await fs.readFile('/Users/s0v3r1gn/APEX/package.json', 'utf8'));
    const hasCorrectScripts = [
      'test:browser-integration',
      'test:browser-integration:watch',
      'test:browser-integration:coverage'
    ].every(script => rootPackage.scripts && rootPackage.scripts[script]);

    console.log(`  ${hasCorrectScripts ? '✅' : '❌'} Root package.json browser test scripts`);
    if (!hasCorrectScripts) allPassed = false;

    // Check dependencies
    const hasPlaywright = rootPackage.devDependencies && 'playwright' in rootPackage.devDependencies;
    const hasPuppeteer = rootPackage.devDependencies && 'puppeteer' in rootPackage.devDependencies;
    const hasPixelmatch = rootPackage.devDependencies && 'pixelmatch' in rootPackage.devDependencies;
    const hasPngjs = rootPackage.devDependencies && 'pngjs' in rootPackage.devDependencies;

    console.log(`  ${hasPlaywright ? '✅' : '❌'} Playwright dependency`);
    console.log(`  ${hasPuppeteer ? '✅' : '❌'} Puppeteer dependency`);
    console.log(`  ${hasPixelmatch ? '✅' : '❌'} Pixelmatch dependency`);
    console.log(`  ${hasPngjs ? '✅' : '❌'} Pngjs dependency`);

    if (!hasPlaywright || !hasPuppeteer || !hasPixelmatch || !hasPngjs) allPassed = false;

  } catch (error) {
    console.log(`  ❌ Error reading root package.json: ${error.message}`);
    allPassed = false;
  }

  // Check test-utils package.json
  try {
    const testUtilsPackage = JSON.parse(await fs.readFile(path.join(testUtilsDir, 'package.json'), 'utf8'));
    const hasMainExport = testUtilsPackage.main === './dist/index.js';
    const hasTypesExport = testUtilsPackage.types === './dist/index.d.ts';
    const hasExports = testUtilsPackage.exports && testUtilsPackage.exports['.'];

    console.log(`  ${hasMainExport ? '✅' : '❌'} Test-utils main export`);
    console.log(`  ${hasTypesExport ? '✅' : '❌'} Test-utils types export`);
    console.log(`  ${hasExports ? '✅' : '❌'} Test-utils package exports`);

    if (!hasMainExport || !hasTypesExport || !hasExports) allPassed = false;

  } catch (error) {
    console.log(`  ❌ Error reading test-utils package.json: ${error.message}`);
    allPassed = false;
  }

  // Check browser config files
  console.log('\n🔧 Checking browser configuration files:');

  const configFiles = [
    '/Users/s0v3r1gn/APEX/playwright.config.ts',
    '/Users/s0v3r1gn/APEX/puppeteer.config.js'
  ];

  for (const configFile of configFiles) {
    const result = await verifyFile(configFile);
    const status = result.exists ? '✅' : '❌';
    const fileName = path.basename(configFile);
    console.log(`  ${status} ${fileName}`);
    if (!result.exists) {
      console.log(`     Error: ${result.error}`);
      allPassed = false;
    }
  }

  console.log('\n' + '='.repeat(60));

  if (allPassed) {
    console.log('🎉 All browser integration infrastructure components are properly configured!');
    console.log('✨ Ready for browser automation testing!');
    process.exit(0);
  } else {
    console.log('❌ Some browser integration infrastructure components are missing or misconfigured.');
    console.log('🔧 Please review the errors above and fix the missing components.');
    process.exit(1);
  }
}

// Run verification
verifyBrowserIntegrationInfrastructure().catch(error => {
  console.error('💥 Verification script failed:', error);
  process.exit(1);
});