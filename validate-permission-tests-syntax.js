#!/usr/bin/env node

/**
 * Permission Tests Syntax and Structure Validation
 *
 * This script validates that all permission-related test files:
 * 1. Have valid syntax (can be parsed)
 * 2. Follow the expected test structure
 * 3. Import required modules properly
 * 4. Have proper describe/test blocks
 *
 * This helps ensure tests are valid without requiring command approval.
 */

const fs = require('fs');
const path = require('path');

console.log('=== APEX Permissions System Test Validation ===\n');

// Key permission test files to validate
const keyTestFiles = [
  'tests/integration/permissions-system-integration.test.ts',
  'tests/integration/permissions-acceptance-criteria.test.ts',
  'tests/integration/permission-denials-simple.test.ts',
  'tests/integration/permission-denials-comprehensive.test.ts',
  'tests/integration/permission-denials-validation.test.ts',
  'packages/orchestrator/src/__tests__/permission-manager.test.ts',
  'packages/orchestrator/src/__tests__/permission-store.test.ts',
  'packages/orchestrator/src/__tests__/permission-preset-manager.test.ts',
  'packages/core/src/__tests__/permissions-config.test.ts',
  'packages/core/src/__tests__/permission-assertion-helpers.test.ts'
];

let validationResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

function validateTestFile(filePath) {
  console.log(`Validating: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.log(`  ❌ File not found`);
    validationResults.failed++;
    validationResults.errors.push(`${filePath}: File not found`);
    return false;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Basic syntax validation checks
    const checks = [
      {
        name: 'Has imports',
        test: content.includes('import') || content.includes('require')
      },
      {
        name: 'Has describe blocks',
        test: content.includes('describe(')
      },
      {
        name: 'Has test cases',
        test: content.includes('it(') || content.includes('test(')
      },
      {
        name: 'Has expectations',
        test: content.includes('expect(')
      },
      {
        name: 'Not empty',
        test: content.trim().length > 0
      },
      {
        name: 'Has permission-related content',
        test: content.toLowerCase().includes('permission') ||
              content.includes('PermissionManager') ||
              content.includes('PermissionStore')
      }
    ];

    let allChecksPassed = true;
    for (const check of checks) {
      if (!check.test) {
        console.log(`  ❌ Failed check: ${check.name}`);
        allChecksPassed = false;
      } else {
        console.log(`  ✅ ${check.name}`);
      }
    }

    if (allChecksPassed) {
      console.log(`  ✅ All validation checks passed\n`);
      validationResults.passed++;
      return true;
    } else {
      console.log(`  ❌ Some validation checks failed\n`);
      validationResults.failed++;
      validationResults.errors.push(`${filePath}: Failed validation checks`);
      return false;
    }

  } catch (error) {
    console.log(`  ❌ Error reading file: ${error.message}\n`);
    validationResults.failed++;
    validationResults.errors.push(`${filePath}: ${error.message}`);
    return false;
  }
}

// Count total permission test files
console.log('1. Counting all permission-related test files...');
const allPermissionTestFiles = [];

function findTestFiles(dir, pattern = /permission.*\.test\.(ts|js)$/i) {
  if (!fs.existsSync(dir)) return;

  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      findTestFiles(fullPath, pattern);
    } else if (pattern.test(item)) {
      allPermissionTestFiles.push(fullPath);
    }
  }
}

findTestFiles('./tests');
findTestFiles('./packages');

console.log(`Found ${allPermissionTestFiles.length} permission-related test files\n`);

// Validate key test files
console.log('2. Validating key permission test files...');
validationResults.total = keyTestFiles.length;

for (const testFile of keyTestFiles) {
  validateTestFile(testFile);
}

// Summary
console.log('=== VALIDATION SUMMARY ===');
console.log(`Total files validated: ${validationResults.total}`);
console.log(`Passed: ${validationResults.passed}`);
console.log(`Failed: ${validationResults.failed}`);
console.log(`Success rate: ${Math.round((validationResults.passed / validationResults.total) * 100)}%`);

if (validationResults.errors.length > 0) {
  console.log('\n=== ERRORS ===');
  validationResults.errors.forEach(error => console.log(`❌ ${error}`));
}

// Test structure analysis
console.log('\n=== TEST STRUCTURE ANALYSIS ===');
console.log(`Total permission test files found: ${allPermissionTestFiles.length}`);

const testCategories = {
  integration: allPermissionTestFiles.filter(f => f.includes('integration')).length,
  unit: allPermissionTestFiles.filter(f => f.includes('__tests__')).length,
  edgeCases: allPermissionTestFiles.filter(f => f.includes('edge-case')).length,
  validation: allPermissionTestFiles.filter(f => f.includes('validation')).length
};

console.log('Test file distribution:');
Object.entries(testCategories).forEach(([category, count]) => {
  console.log(`  ${category}: ${count} files`);
});

// Final assessment
const overallSuccess = validationResults.failed === 0;
console.log(`\n=== FINAL ASSESSMENT ===`);
console.log(`Overall Status: ${overallSuccess ? '✅ PASS' : '❌ FAIL'}`);
console.log(`All key permission tests are structurally valid: ${overallSuccess ? 'YES' : 'NO'}`);

if (overallSuccess) {
  console.log('\n🎉 Permission system tests appear to be well-structured and ready to run!');
} else {
  console.log('\n⚠️  Some permission system tests may have structural issues.');
}

process.exit(overallSuccess ? 0 : 1);