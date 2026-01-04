#!/usr/bin/env node

/**
 * Simple validation script to check if error-feedback test files are valid
 */

const fs = require('fs');
const path = require('path');

const testFiles = [
  'packages/orchestrator/src/error-feedback.test.ts',
  'packages/orchestrator/src/error-feedback.stress.test.ts',
  'packages/orchestrator/src/error-feedback.edge.test.ts'
];

console.log('🔍 Validating error-feedback test files...\n');

let validationResults = {
  valid: 0,
  invalid: 0,
  issues: []
};

for (const testFile of testFiles) {
  const fullPath = path.join(__dirname, testFile);
  console.log(`📝 Checking ${testFile}...`);

  try {
    if (!fs.existsSync(fullPath)) {
      validationResults.invalid++;
      validationResults.issues.push(`❌ File not found: ${testFile}`);
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');

    // Basic syntax checks
    if (content.includes('import') && content.includes('describe') && content.includes('it(')) {
      console.log(`  ✅ File structure looks valid`);

      // Count test cases
      const testCases = (content.match(/it\(/g) || []).length;
      const describeCases = (content.match(/describe\(/g) || []).length;
      console.log(`  📊 Found ${testCases} test cases, ${describeCases} describe blocks`);

      validationResults.valid++;
    } else {
      validationResults.invalid++;
      validationResults.issues.push(`❌ File structure invalid: ${testFile}`);
    }
  } catch (error) {
    validationResults.invalid++;
    validationResults.issues.push(`❌ Error reading ${testFile}: ${error.message}`);
  }

  console.log('');
}

console.log('📋 Validation Summary:');
console.log(`✅ Valid test files: ${validationResults.valid}`);
console.log(`❌ Invalid test files: ${validationResults.invalid}`);

if (validationResults.issues.length > 0) {
  console.log('\n🚨 Issues found:');
  validationResults.issues.forEach(issue => console.log(issue));
}

if (validationResults.valid === testFiles.length && validationResults.invalid === 0) {
  console.log('\n🎉 All error-feedback test files appear to be valid!');
  console.log('📝 The test suite includes:');
  console.log('   - Main functionality tests (error-feedback.test.ts)');
  console.log('   - Stress and performance tests (error-feedback.stress.test.ts)');
  console.log('   - Edge case tests (error-feedback.edge.test.ts)');
  process.exit(0);
} else {
  console.log('\n❌ Some test files have issues that need to be addressed.');
  process.exit(1);
}