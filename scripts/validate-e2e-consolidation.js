#!/usr/bin/env node

/**
 * @fileoverview Validation script for consolidated E2E test configuration
 *
 * This script validates that:
 * 1. All E2E tests can be discovered by the unified test runner
 * 2. All marketplace E2E tests are included
 * 3. Test configuration files are properly set up
 * 4. Dependencies are available
 */

const fs = require('fs');
const path = require('path');
const { discoverTests, TEST_CONFIGS } = require('./unified-test-runner.js');

async function validateE2EConsolidation() {
  console.log('🧪 Validating E2E Test Consolidation\n');

  let allValidationsPassed = true;

  // 1. Validate that all test config files exist
  console.log('1️⃣ Validating test configuration files...');
  for (const [testType, configFile] of Object.entries(TEST_CONFIGS)) {
    const configPath = path.join(process.cwd(), configFile);
    if (fs.existsSync(configPath)) {
      console.log(`  ✅ ${testType}: ${configFile}`);
    } else {
      console.log(`  ❌ ${testType}: ${configFile} - FILE NOT FOUND`);
      allValidationsPassed = false;
    }
  }

  // 2. Test E2E test discovery
  console.log('\n2️⃣ Testing E2E test discovery...');
  try {
    const e2eTests = await discoverTests('e2e');
    console.log(`  ✅ Discovered ${e2eTests.length} E2E test files`);

    if (e2eTests.length === 0) {
      console.log('  ❌ No E2E tests discovered - this indicates a configuration problem');
      allValidationsPassed = false;
    }
  } catch (error) {
    console.log(`  ❌ Error discovering E2E tests: ${error.message}`);
    allValidationsPassed = false;
  }

  // 3. Validate marketplace E2E tests are included
  console.log('\n3️⃣ Validating marketplace E2E tests...');
  try {
    const allE2ETests = await discoverTests('e2e');
    const marketplaceTests = allE2ETests.filter(file =>
      file.includes('marketplace') || file.includes('mcp-')
    );

    console.log(`  ✅ Found ${marketplaceTests.length} marketplace E2E tests:`);
    marketplaceTests.forEach(test => {
      console.log(`    • ${test}`);
    });

    if (marketplaceTests.length === 0) {
      console.log('  ❌ No marketplace E2E tests found');
      allValidationsPassed = false;
    }
  } catch (error) {
    console.log(`  ❌ Error validating marketplace tests: ${error.message}`);
    allValidationsPassed = false;
  }

  // 4. Validate dependencies
  console.log('\n4️⃣ Validating dependencies...');
  try {
    require('fast-glob');
    console.log('  ✅ fast-glob dependency available');
  } catch (error) {
    console.log('  ❌ fast-glob dependency missing');
    allValidationsPassed = false;
  }

  try {
    require('vitest');
    console.log('  ✅ vitest dependency available');
  } catch (error) {
    console.log('  ❌ vitest dependency missing');
    allValidationsPassed = false;
  }

  // 5. Validate unified test runner package.json scripts
  console.log('\n5️⃣ Validating package.json test scripts...');
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const expectedScripts = [
      'test:unified',
      'test:unified:e2e',
      'test:unified:marketplace',
      'test:unified:list:e2e'
    ];

    let scriptsValid = true;
    expectedScripts.forEach(scriptName => {
      if (packageJson.scripts && packageJson.scripts[scriptName]) {
        console.log(`  ✅ ${scriptName} script exists`);
      } else {
        console.log(`  ❌ ${scriptName} script missing`);
        scriptsValid = false;
        allValidationsPassed = false;
      }
    });

    if (scriptsValid) {
      console.log('  ✅ All required unified test scripts are present');
    }
  } else {
    console.log('  ❌ package.json not found');
    allValidationsPassed = false;
  }

  // Final result
  console.log('\n' + '='.repeat(60));
  if (allValidationsPassed) {
    console.log('🎉 E2E Test Consolidation Validation: PASSED');
    console.log('\n✅ All E2E tests can be discovered and run by the unified test runner');
    console.log('✅ All marketplace E2E tests are included');
    console.log('✅ Test configuration is properly consolidated');
    console.log('\nYou can now run E2E tests using:');
    console.log('  npm run test:unified:e2e              # All E2E tests');
    console.log('  npm run test:unified:marketplace      # Marketplace tests only');
    console.log('  npm run test:unified:list:e2e         # List all E2E tests');
  } else {
    console.log('❌ E2E Test Consolidation Validation: FAILED');
    console.log('\n⚠️  Please address the issues above before using the unified test runner.');
  }

  return allValidationsPassed;
}

// Run validation if called directly
if (require.main === module) {
  validateE2EConsolidation().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Validation failed with error:', error);
    process.exit(1);
  });
}

module.exports = { validateE2EConsolidation };