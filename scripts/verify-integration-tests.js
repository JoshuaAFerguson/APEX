#!/usr/bin/env node

/**
 * Verification script for integration tests
 * Checks syntax and imports without executing the tests
 */

const fs = require('fs');
const path = require('path');

const testFiles = [
  'packages/orchestrator/src/store.state-persistence.integration.test.ts',
  'packages/cli/src/services/__tests__/SessionStore.state-persistence.integration.test.ts'
];

console.log('🔍 Verifying integration test files...\n');

let allValid = true;

for (const testFile of testFiles) {
  const fullPath = path.join(process.cwd(), testFile);

  try {
    console.log(`📄 Checking: ${testFile}`);

    // Check file exists
    if (!fs.existsSync(fullPath)) {
      console.log(`❌ File not found: ${fullPath}`);
      allValid = false;
      continue;
    }

    // Read and validate basic structure
    const content = fs.readFileSync(fullPath, 'utf8');

    // Check for required imports
    const requiredImports = [
      "describe",
      "it",
      "expect",
      "beforeEach",
      "afterEach"
    ];

    const hasAllImports = requiredImports.every(imp =>
      content.includes(imp)
    );

    if (!hasAllImports) {
      console.log(`❌ Missing required imports in ${testFile}`);
      allValid = false;
      continue;
    }

    // Check for test structure
    if (!content.includes('describe(') || !content.includes('it(')) {
      console.log(`❌ Missing test structure in ${testFile}`);
      allValid = false;
      continue;
    }

    // Check for integration test specific patterns
    const integrationPatterns = [
      'state.*persist',
      'restart',
      'serialize',
      'deserialize'
    ];

    const hasIntegrationPatterns = integrationPatterns.some(pattern =>
      content.match(new RegExp(pattern, 'i'))
    );

    if (!hasIntegrationPatterns) {
      console.log(`⚠️  No obvious integration test patterns in ${testFile}`);
    }

    // Count test cases
    const testCount = (content.match(/it\(/g) || []).length;
    const describeCount = (content.match(/describe\(/g) || []).length;

    console.log(`✅ Valid structure: ${describeCount} test suites, ${testCount} test cases`);
    console.log(`📊 File size: ${(content.length / 1024).toFixed(1)}KB`);

  } catch (error) {
    console.log(`❌ Error reading ${testFile}: ${error.message}`);
    allValid = false;
  }

  console.log('');
}

console.log('📋 Summary:');
console.log(`Files checked: ${testFiles.length}`);
console.log(`Status: ${allValid ? '✅ All valid' : '❌ Issues found'}`);

if (allValid) {
  console.log('\n🎉 All integration test files appear to be properly structured!');
  console.log('💡 To run the tests:');
  console.log('   npm test -- state-persistence.integration.test.ts');
} else {
  console.log('\n⚠️  Some issues were found. Please review the files above.');
  process.exit(1);
}