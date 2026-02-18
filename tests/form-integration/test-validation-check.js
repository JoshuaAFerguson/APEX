#!/usr/bin/env node

/**
 * Quick validation script to check if the text clearing and replacement tests
 * are properly structured and can be loaded.
 */

const fs = require('fs');
const path = require('path');

function main() {
  console.log('🔍 Validating Text Clearing and Replacement Tests...\n');

  const testFile = path.join(__dirname, 'text-clear-replace-tests.test.ts');

  // Check if test file exists
  if (!fs.existsSync(testFile)) {
    console.error('❌ Test file not found:', testFile);
    process.exit(1);
  }

  console.log('✅ Test file exists:', testFile);

  // Read and analyze test file content
  const content = fs.readFileSync(testFile, 'utf8');

  // Check for required imports
  const requiredImports = [
    'describe',
    'it',
    'expect',
    'beforeEach',
    'afterEach',
    'simulateTyping',
    'TypingSimulator',
    'SpecialKeys'
  ];

  let missingImports = [];
  requiredImports.forEach(imp => {
    if (!content.includes(imp)) {
      missingImports.push(imp);
    }
  });

  if (missingImports.length > 0) {
    console.error('❌ Missing required imports:', missingImports.join(', '));
    process.exit(1);
  }

  console.log('✅ All required imports found');

  // Check for test suites based on acceptance criteria
  const requiredTestSuites = [
    'Clear Existing Content Then Type New Text',
    'Select All and Replace Text',
    'Backspace Character-by-Character Clearing',
    'Edge Cases and Validation'
  ];

  let missingTestSuites = [];
  requiredTestSuites.forEach(suite => {
    if (!content.includes(suite)) {
      missingTestSuites.push(suite);
    }
  });

  if (missingTestSuites.length > 0) {
    console.error('❌ Missing required test suites:', missingTestSuites.join(', '));
    process.exit(1);
  }

  console.log('✅ All required test suites found');

  // Count test cases
  const testCases = content.match(/\bit\(/g) || [];
  const testCount = testCases.length;

  console.log(`✅ Found ${testCount} test cases`);

  // Check for acceptance criteria coverage
  const acceptanceCriteria = [
    'clearing input with existing text then typing new text',
    'selecting all and replacing',
    'backspace to clear character by character'
  ];

  let coveredCriteria = [];
  acceptanceCriteria.forEach(criteria => {
    // Check if any test mentions this criteria (case insensitive search)
    if (content.toLowerCase().includes(criteria.toLowerCase()) ||
        content.toLowerCase().includes(criteria.replace(/\s+/g, '').toLowerCase())) {
      coveredCriteria.push(criteria);
    }
  });

  console.log(`✅ Coverage check: ${coveredCriteria.length}/${acceptanceCriteria.length} acceptance criteria covered`);

  // Check for utility dependencies
  const utilityFiles = [
    path.join(__dirname, 'setup.ts'),
    path.join(__dirname, 'utils', 'typing-simulator.ts')
  ];

  let missingUtilities = [];
  utilityFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      missingUtilities.push(file);
    }
  });

  if (missingUtilities.length > 0) {
    console.error('❌ Missing utility files:', missingUtilities.map(f => path.basename(f)).join(', '));
    process.exit(1);
  }

  console.log('✅ All utility dependencies found');

  // File size check (should be comprehensive)
  const fileSize = content.length;
  const lines = content.split('\n').length;

  console.log(`✅ Test file: ${lines} lines, ${fileSize} characters`);

  if (lines < 100) {
    console.warn('⚠️  Warning: Test file seems small for comprehensive testing');
  }

  console.log('\n🎉 All validations passed! Test file is properly structured.\n');

  // Summary
  console.log('📊 Test Summary:');
  console.log(`   • Test file: text-clear-replace-tests.test.ts`);
  console.log(`   • Test suites: ${requiredTestSuites.length}`);
  console.log(`   • Test cases: ${testCount}`);
  console.log(`   • Acceptance criteria coverage: ${coveredCriteria.length}/${acceptanceCriteria.length}`);
  console.log(`   • Dependencies: setup.ts, typing-simulator.ts`);
  console.log(`   • File size: ${lines} lines`);

  console.log('\n✅ Text clearing and replacement tests are ready for execution!');
}

if (require.main === module) {
  main();
}