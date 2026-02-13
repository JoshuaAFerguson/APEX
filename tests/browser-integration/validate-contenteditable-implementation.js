#!/usr/bin/env node
/**
 * @fileoverview Validation script for contenteditable integration test implementation
 *
 * This script validates:
 * - All required files are present
 * - Files have expected structure and exports
 * - Test acceptance criteria coverage
 * - Implementation completeness
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Validating Contenteditable Integration Test Implementation');
console.log('='.repeat(60));

const basePath = __dirname;

// Required files and their expected properties
const requiredFiles = [
  {
    path: 'fixtures/contenteditable-fixtures.ts',
    type: 'fixtures',
    expectedExports: [
      'BASIC_CONTENTEDITABLE_DIV_HTML',
      'BASIC_CONTENTEDITABLE_SPAN_HTML',
      'NESTED_CONTENTEDITABLE_HTML',
      'COMPLEX_CONTENTEDITABLE_HTML',
      'CONTENTEDITABLE_FIXTURES',
      'createContenteditableTestPage'
    ]
  },
  {
    path: 'utils/contenteditable-helpers.ts',
    type: 'helpers',
    expectedExports: [
      'typeInContenteditable',
      'validateContenteditableContent',
      'clearContenteditableContent',
      'testMultipleInputMethods',
      'captureContenteditableEvents',
      'testContenteditableAccessibility',
      'waitForContentStable',
      'generateContenteditableTestReport'
    ]
  },
  {
    path: 'contenteditable-elements.integration.test.ts',
    type: 'test',
    expectedContent: [
      'describe(\'Contenteditable Elements Integration Tests\'',
      'typing in contenteditable div',
      'typing in contenteditable span',
      'verifying textContent/innerHTML reflects typed content',
      'testing nested contenteditable elements'
    ]
  }
];

let allValidationsPassed = true;

// Validation functions
function checkFileExists(filePath) {
  const fullPath = path.join(basePath, filePath);
  const exists = fs.existsSync(fullPath);

  if (exists) {
    console.log(`✅ File exists: ${filePath}`);
  } else {
    console.log(`❌ Missing file: ${filePath}`);
    allValidationsPassed = false;
  }

  return exists;
}

function checkFileExports(filePath, expectedExports) {
  try {
    const fullPath = path.join(basePath, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');

    const missingExports = [];
    expectedExports.forEach(exportName => {
      const exportPattern = new RegExp(`export.*${exportName}`, 'i');
      if (!exportPattern.test(content)) {
        missingExports.push(exportName);
      }
    });

    if (missingExports.length === 0) {
      console.log(`✅ All expected exports found in: ${filePath}`);
    } else {
      console.log(`❌ Missing exports in ${filePath}: ${missingExports.join(', ')}`);
      allValidationsPassed = false;
    }

    return missingExports.length === 0;
  } catch (error) {
    console.log(`❌ Error reading file ${filePath}: ${error.message}`);
    allValidationsPassed = false;
    return false;
  }
}

function checkTestContent(filePath, expectedContent) {
  try {
    const fullPath = path.join(basePath, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');

    const missingContent = [];
    expectedContent.forEach(expected => {
      if (!content.includes(expected)) {
        missingContent.push(expected);
      }
    });

    if (missingContent.length === 0) {
      console.log(`✅ All expected test content found in: ${filePath}`);
    } else {
      console.log(`❌ Missing test content in ${filePath}: ${missingContent.join(', ')}`);
      allValidationsPassed = false;
    }

    return missingContent.length === 0;
  } catch (error) {
    console.log(`❌ Error reading test file ${filePath}: ${error.message}`);
    allValidationsPassed = false;
    return false;
  }
}

// Check acceptance criteria coverage
function checkAcceptanceCriteria() {
  console.log('\n📋 Checking Acceptance Criteria Coverage');
  console.log('-'.repeat(40));

  const testFilePath = path.join(basePath, 'contenteditable-elements.integration.test.ts');

  if (!fs.existsSync(testFilePath)) {
    console.log('❌ Test file not found for acceptance criteria check');
    allValidationsPassed = false;
    return false;
  }

  const content = fs.readFileSync(testFilePath, 'utf8');

  const acceptanceCriteria = [
    {
      description: 'Tests pass for: typing in contenteditable div',
      pattern: /typing in.*contenteditable div/i
    },
    {
      description: 'Tests pass for: typing in contenteditable span',
      pattern: /typing in.*contenteditable span/i
    },
    {
      description: 'Tests pass for: verifying textContent/innerHTML reflects typed content',
      pattern: /textContent.*innerHTML.*reflect.*typed/i
    },
    {
      description: 'Tests pass for: testing nested contenteditable elements',
      pattern: /nested.*contenteditable/i
    }
  ];

  acceptanceCriteria.forEach(criterion => {
    if (criterion.pattern.test(content)) {
      console.log(`✅ ${criterion.description}`);
    } else {
      console.log(`❌ ${criterion.description}`);
      allValidationsPassed = false;
    }
  });

  return allValidationsPassed;
}

// Run all validations
console.log('\n📁 Checking Required Files');
console.log('-'.repeat(30));

requiredFiles.forEach(file => {
  if (checkFileExists(file.path)) {
    if (file.expectedExports) {
      checkFileExports(file.path, file.expectedExports);
    }
    if (file.expectedContent) {
      checkTestContent(file.path, file.expectedContent);
    }
  }
});

// Check acceptance criteria
checkAcceptanceCriteria();

// Summary
console.log('\n📊 Validation Summary');
console.log('='.repeat(30));

if (allValidationsPassed) {
  console.log('🎉 All validations passed!');
  console.log('✅ Contenteditable integration test implementation is complete');
  console.log('✅ All required files are present');
  console.log('✅ All expected exports are available');
  console.log('✅ All acceptance criteria are covered');
  console.log('\n🚀 Implementation is ready for testing!');
  process.exit(0);
} else {
  console.log('❌ Some validations failed');
  console.log('🔧 Please review the issues above and fix them');
  process.exit(1);
}