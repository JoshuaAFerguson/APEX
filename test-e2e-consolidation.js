#!/usr/bin/env node

/**
 * @fileoverview Comprehensive E2E Test Consolidation Validation Script
 *
 * This script validates that the E2E test consolidation implemented by the developer
 * stage is working correctly. It tests:
 * 1. Configuration files exist and are valid
 * 2. Test discovery works for all E2E patterns
 * 3. Unified test runner can find and categorize tests
 * 4. Marketplace tests are properly included
 * 5. Package.json scripts are correctly configured
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import the unified test runner functionality
let unifiedTestRunner;
try {
  unifiedTestRunner = require('./scripts/unified-test-runner.js');
} catch (error) {
  console.error('❌ Failed to import unified test runner:', error.message);
  process.exit(1);
}

const { discoverTests, TEST_CONFIGS, TEST_DESCRIPTIONS } = unifiedTestRunner;

/**
 * Validation results tracker
 */
class ValidationResults {
  constructor() {
    this.results = [];
    this.passed = 0;
    this.failed = 0;
  }

  addResult(testName, passed, message, details = null) {
    const result = {
      test: testName,
      passed,
      message,
      details,
      timestamp: new Date().toISOString()
    };
    this.results.push(result);

    if (passed) {
      this.passed++;
      console.log(`✅ ${testName}: ${message}`);
      if (details) {
        console.log(`   ${details}`);
      }
    } else {
      this.failed++;
      console.log(`❌ ${testName}: ${message}`);
      if (details) {
        console.log(`   ${details}`);
      }
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 E2E Test Consolidation Validation Summary');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📊 Success Rate: ${((this.passed / this.results.length) * 100).toFixed(1)}%`);

    if (this.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  • ${r.test}: ${r.message}`);
          if (r.details) {
            console.log(`    ${r.details}`);
          }
        });
    }

    return this.failed === 0;
  }

  generateReport() {
    return {
      summary: {
        totalTests: this.results.length,
        passed: this.passed,
        failed: this.failed,
        successRate: ((this.passed / this.results.length) * 100).toFixed(1) + '%',
        timestamp: new Date().toISOString()
      },
      results: this.results
    };
  }
}

async function main() {
  console.log('🧪 E2E Test Consolidation Comprehensive Validation\n');

  const validation = new ValidationResults();

  // Test 1: Validate configuration files exist
  console.log('1️⃣ Validating Vitest configuration files...');
  for (const [testType, configFile] of Object.entries(TEST_CONFIGS)) {
    const configPath = path.join(process.cwd(), configFile);
    if (fs.existsSync(configPath)) {
      validation.addResult(
        `Config-${testType}`,
        true,
        `Configuration file exists: ${configFile}`
      );
    } else {
      validation.addResult(
        `Config-${testType}`,
        false,
        `Configuration file missing: ${configFile}`
      );
    }
  }

  // Test 2: Validate package.json scripts
  console.log('\n2️⃣ Validating package.json test scripts...');
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    const expectedScripts = [
      'test:unified',
      'test:unified:e2e',
      'test:unified:unit',
      'test:unified:integration',
      'test:unified:marketplace',
      'test:unified:list:e2e',
      'validate:e2e-consolidation'
    ];

    expectedScripts.forEach(scriptName => {
      if (packageJson.scripts && packageJson.scripts[scriptName]) {
        validation.addResult(
          `Script-${scriptName}`,
          true,
          `Script exists: ${scriptName}`
        );
      } else {
        validation.addResult(
          `Script-${scriptName}`,
          false,
          `Script missing: ${scriptName}`
        );
      }
    });
  } catch (error) {
    validation.addResult(
      'Package.json',
      false,
      'Failed to read package.json',
      error.message
    );
  }

  // Test 3: Test E2E test discovery
  console.log('\n3️⃣ Testing E2E test discovery...');
  try {
    const e2eTests = await discoverTests('e2e');

    if (e2eTests.length > 0) {
      validation.addResult(
        'E2E-Discovery',
        true,
        `Discovered ${e2eTests.length} E2E test files`
      );

      // Log some examples
      console.log('   📝 Sample E2E tests found:');
      e2eTests.slice(0, 5).forEach(test => {
        console.log(`     • ${test}`);
      });
      if (e2eTests.length > 5) {
        console.log(`     ... and ${e2eTests.length - 5} more`);
      }
    } else {
      validation.addResult(
        'E2E-Discovery',
        false,
        'No E2E tests discovered',
        'This indicates a problem with the test discovery patterns'
      );
    }

    // Test 4: Validate marketplace E2E tests are included
    console.log('\n4️⃣ Validating marketplace E2E tests...');
    const marketplaceTests = e2eTests.filter(file =>
      file.includes('marketplace') || file.includes('mcp-') || file.includes('browse-marketplace')
    );

    if (marketplaceTests.length > 0) {
      validation.addResult(
        'Marketplace-Tests',
        true,
        `Found ${marketplaceTests.length} marketplace E2E tests`
      );

      console.log('   📝 Marketplace E2E tests:');
      marketplaceTests.forEach(test => {
        console.log(`     • ${test}`);
      });
    } else {
      validation.addResult(
        'Marketplace-Tests',
        false,
        'No marketplace E2E tests found in discovery'
      );
    }

  } catch (error) {
    validation.addResult(
      'E2E-Discovery',
      false,
      'E2E test discovery failed',
      error.message
    );
  }

  // Test 5: Test unit test discovery (to ensure separation)
  console.log('\n5️⃣ Testing unit test discovery for proper separation...');
  try {
    const unitTests = await discoverTests('unit');

    validation.addResult(
      'Unit-Discovery',
      unitTests.length > 0,
      `Discovered ${unitTests.length} unit test files`
    );

    // Verify unit tests don't include E2E tests
    const e2eInUnit = unitTests.filter(file =>
      file.includes('.e2e.test.') || file.includes('e2e-')
    );

    validation.addResult(
      'Unit-E2E-Separation',
      e2eInUnit.length === 0,
      e2eInUnit.length === 0
        ? 'Unit tests properly exclude E2E tests'
        : `Found ${e2eInUnit.length} E2E tests in unit discovery`,
      e2eInUnit.length > 0 ? `E2E tests found: ${e2eInUnit.slice(0, 3).join(', ')}` : null
    );

  } catch (error) {
    validation.addResult(
      'Unit-Discovery',
      false,
      'Unit test discovery failed',
      error.message
    );
  }

  // Test 6: Test integration test discovery
  console.log('\n6️⃣ Testing integration test discovery...');
  try {
    const integrationTests = await discoverTests('integration');

    validation.addResult(
      'Integration-Discovery',
      integrationTests.length > 0,
      `Discovered ${integrationTests.length} integration test files`
    );

  } catch (error) {
    validation.addResult(
      'Integration-Discovery',
      false,
      'Integration test discovery failed',
      error.message
    );
  }

  // Test 7: Validate dependencies are available
  console.log('\n7️⃣ Validating dependencies...');
  const requiredDeps = [
    'vitest',
    'fast-glob',
    '@vitest/coverage-v8'
  ];

  requiredDeps.forEach(dep => {
    try {
      require(dep);
      validation.addResult(
        `Dependency-${dep}`,
        true,
        `${dep} is available`
      );
    } catch (error) {
      validation.addResult(
        `Dependency-${dep}`,
        false,
        `${dep} is missing`,
        'Install with: npm install'
      );
    }
  });

  // Test 8: Validate test runner configuration integrity
  console.log('\n8️⃣ Validating test runner configuration integrity...');

  try {
    // Check that all test types have descriptions
    for (const testType of Object.keys(TEST_CONFIGS)) {
      if (TEST_DESCRIPTIONS[testType]) {
        validation.addResult(
          `Description-${testType}`,
          true,
          `${testType} has description: ${TEST_DESCRIPTIONS[testType]}`
        );
      } else {
        validation.addResult(
          `Description-${testType}`,
          false,
          `${testType} missing description`
        );
      }
    }
  } catch (error) {
    validation.addResult(
      'Configuration-Integrity',
      false,
      'Failed to validate configuration integrity',
      error.message
    );
  }

  // Generate final report
  console.log('\n9️⃣ Generating validation report...');
  const report = validation.generateReport();

  try {
    const reportPath = path.join(__dirname, 'e2e-consolidation-validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    validation.addResult(
      'Report-Generation',
      true,
      `Validation report saved to: ${reportPath}`
    );
  } catch (error) {
    validation.addResult(
      'Report-Generation',
      false,
      'Failed to save validation report',
      error.message
    );
  }

  // Final summary
  const success = validation.printSummary();

  if (success) {
    console.log('\n🎉 E2E Test Consolidation Validation: PASSED');
    console.log('\n✅ Key Findings:');
    console.log('✅ All configuration files are present and accessible');
    console.log('✅ E2E tests can be discovered by the unified test runner');
    console.log('✅ Marketplace E2E tests are properly included');
    console.log('✅ Test type separation is working correctly');
    console.log('✅ Package.json scripts are properly configured');
    console.log('✅ Required dependencies are available');
    console.log('\n🚀 Ready to use unified E2E test commands:');
    console.log('  npm run test:unified:e2e              # All E2E tests');
    console.log('  npm run test:unified:marketplace      # Marketplace tests only');
    console.log('  npm run test:unified:list:e2e         # List all E2E tests');
    console.log('  npm run validate:e2e-consolidation   # Run this validation');
  } else {
    console.log('\n❌ E2E Test Consolidation Validation: FAILED');
    console.log('\n⚠️  Please address the issues above before using the unified test runner.');
  }

  return success;
}

// Run the validation
if (require.main === module) {
  main().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Validation failed with error:', error);
    process.exit(1);
  });
}

module.exports = { main };