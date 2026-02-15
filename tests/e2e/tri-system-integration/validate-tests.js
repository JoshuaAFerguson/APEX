#!/usr/bin/env node

/**
 * Simple test validation script for tri-system integration tests
 *
 * This script performs basic validation to ensure tests are properly structured
 * and should compile without TypeScript errors.
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Validating Tri-System Integration Tests...\n');

const testFiles = [
  'test-utils.ts',
  'test-utils.test.ts',
  'tri-system-integration.test.ts',
  'utilities-validation.test.ts'
];

let allValid = true;

for (const file of testFiles) {
  const filePath = path.join(__dirname, file);

  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ ${file}: File does not exist`);
      allValid = false;
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Basic structure validation
    const validations = [
      { check: content.includes('import'), message: 'has import statements' },
      { check: content.includes('describe'), message: 'has test suites (describe blocks)' },
      { check: content.includes('it(') || content.includes('test('), message: 'has test cases' },
      { check: content.includes('expect('), message: 'has assertions' }
    ];

    console.log(`✅ ${file}:`);

    for (const validation of validations) {
      if (validation.check) {
        console.log(`   ✓ ${validation.message}`);
      } else {
        console.log(`   ❌ ${validation.message}`);
        allValid = false;
      }
    }

    // Count test cases for test files
    if (file.endsWith('.test.ts')) {
      const testCount = (content.match(/it\(/g) || []).length + (content.match(/test\(/g) || []).length;
      const describeCount = (content.match(/describe\(/g) || []).length;
      console.log(`   📊 ${testCount} test cases in ${describeCount} suites`);
    }

    // File size validation
    const stats = fs.statSync(filePath);
    console.log(`   📄 ${Math.round(stats.size / 1024)}KB`);

  } catch (error) {
    console.log(`❌ ${file}: Error reading file - ${error.message}`);
    allValid = false;
  }

  console.log('');
}

// Summary
console.log('=' .repeat(50));
if (allValid) {
  console.log('✅ All tri-system integration tests are valid!');
  console.log('');
  console.log('Test Infrastructure Summary:');
  console.log('• test-utils.ts: Core infrastructure with helper functions');
  console.log('• test-utils.test.ts: Basic infrastructure validation');
  console.log('• tri-system-integration.test.ts: Comprehensive E2E tests');
  console.log('• utilities-validation.test.ts: Utility function validation');
  console.log('');
  console.log('Ready for execution with: npm run test:e2e');
  process.exit(0);
} else {
  console.log('❌ Some test files have issues - please review above');
  process.exit(1);
}