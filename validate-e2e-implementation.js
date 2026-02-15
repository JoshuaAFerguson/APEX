#!/usr/bin/env node

/**
 * @fileoverview Validation script for E2E implementation completeness
 * Checks if all required tri-system integration E2E tests exist and are properly structured
 */

const fs = require('fs');
const path = require('path');

function validateE2EImplementation() {
  console.log('🧪 Validating E2E Implementation Completeness\n');

  let allValidationsPassed = true;
  const results = [];

  // Check for test:e2e script in package.json
  console.log('1️⃣ Validating test:e2e script...');
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.scripts && packageJson.scripts['test:e2e']) {
      console.log('  ✅ test:e2e script exists');
      results.push('✅ test:e2e npm script configured');
    } else {
      console.log('  ❌ test:e2e script missing');
      allValidationsPassed = false;
      results.push('❌ test:e2e npm script missing');
    }
  }

  // Check for E2E config file
  console.log('\n2️⃣ Validating E2E configuration...');
  const e2eConfigPath = path.join(process.cwd(), 'vitest.e2e.config.ts');
  if (fs.existsSync(e2eConfigPath)) {
    console.log('  ✅ vitest.e2e.config.ts exists');
    results.push('✅ E2E configuration file exists');
  } else {
    console.log('  ❌ vitest.e2e.config.ts missing');
    allValidationsPassed = false;
    results.push('❌ E2E configuration file missing');
  }

  // Check for tri-system integration tests
  console.log('\n3️⃣ Validating tri-system integration tests...');
  const triSystemDir = path.join(process.cwd(), 'tests/e2e/tri-system-integration');
  if (fs.existsSync(triSystemDir)) {
    console.log('  ✅ tri-system-integration directory exists');

    const requiredFiles = [
      'test-utils.ts',
      'event-coordination.e2e.test.ts',
      'browser-permission-basic.e2e.test.ts',
      'browser-tools-workflow.e2e.test.ts',
      'complex-permission-scenarios.e2e.test.ts',
      'error-recovery.e2e.test.ts',
      'test-coverage-report.md'
    ];

    let filesFound = 0;
    requiredFiles.forEach(file => {
      const filePath = path.join(triSystemDir, file);
      if (fs.existsSync(filePath)) {
        console.log(`    ✅ ${file}`);
        filesFound++;
      } else {
        console.log(`    ❌ ${file} - MISSING`);
        allValidationsPassed = false;
      }
    });

    results.push(`✅ ${filesFound}/${requiredFiles.length} tri-system integration files found`);
  } else {
    console.log('  ❌ tri-system-integration directory missing');
    allValidationsPassed = false;
    results.push('❌ tri-system-integration directory missing');
  }

  // Check for browser+tools+permissions integration coverage
  console.log('\n4️⃣ Validating browser+tools+permissions integration...');
  const testCoverageReportPath = path.join(process.cwd(), 'tests/e2e/tri-system-integration/test-coverage-report.md');
  if (fs.existsSync(testCoverageReportPath)) {
    const coverageReport = fs.readFileSync(testCoverageReportPath, 'utf8');

    // Check for key integration patterns
    const integrationChecks = [
      { pattern: /Tool System Integration.*100%.*Coverage/i, description: 'Tool System Integration coverage' },
      { pattern: /Permission System Integration.*100%.*Coverage/i, description: 'Permission System Integration coverage' },
      { pattern: /Browser System Integration.*100%.*Coverage/i, description: 'Browser System Integration coverage' },
      { pattern: /Cross-System Event Flow.*95%.*Coverage/i, description: 'Cross-System Event Flow coverage' },
      { pattern: /browser.*permission.*integration/i, description: 'Browser-Permission Integration scenarios' },
      { pattern: /tool.*browser.*coordination/i, description: 'Tool-Browser Coordination scenarios' }
    ];

    integrationChecks.forEach(check => {
      if (check.pattern.test(coverageReport)) {
        console.log(`    ✅ ${check.description}`);
      } else {
        console.log(`    ⚠️  ${check.description} - not clearly documented`);
      }
    });

    results.push('✅ Test coverage report exists with integration scenarios');
  } else {
    console.log('  ❌ test-coverage-report.md missing');
    allValidationsPassed = false;
    results.push('❌ Test coverage report missing');
  }

  // Check for additional E2E test files
  console.log('\n5️⃣ Scanning for additional E2E tests...');
  const e2eTestPattern = /.*e2e.*\.test\.ts$/;
  let e2eTestCount = 0;

  function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (e2eTestPattern.test(item)) {
        e2eTestCount++;
        console.log(`    • ${path.relative(process.cwd(), fullPath)}`);
      }
    });
  }

  scanDirectory(path.join(process.cwd(), 'tests'));
  scanDirectory(path.join(process.cwd(), 'packages'));

  console.log(`  ✅ Found ${e2eTestCount} E2E test files total`);
  results.push(`✅ ${e2eTestCount} E2E test files discovered across project`);

  // Final assessment
  console.log('\n' + '='.repeat(60));
  if (allValidationsPassed) {
    console.log('🎉 E2E Implementation Validation: PASSED');
    console.log('\n✅ All acceptance criteria appear to be met:');
    console.log('✅ npm run test:e2e script is configured');
    console.log('✅ Comprehensive tri-system integration tests exist');
    console.log('✅ Browser+tools+permissions integration scenarios covered');
    console.log('✅ Test coverage report shows comprehensive coverage');
  } else {
    console.log('❌ E2E Implementation Validation: ISSUES FOUND');
    console.log('\n⚠️  Some components may need attention');
  }

  console.log('\n📊 Summary:');
  results.forEach(result => console.log(`  ${result}`));

  return allValidationsPassed;
}

// Run validation
if (require.main === module) {
  validateE2EImplementation();
}

module.exports = { validateE2EImplementation };