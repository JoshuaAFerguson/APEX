#!/usr/bin/env node
/**
 * Simple validation script to check test file structure
 */

const fs = require('fs');
const path = require('path');

function validateTestFile(filePath) {
  console.log(`Validating: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  // Check for basic vitest imports
  if (!content.includes("import { describe, it, expect")) {
    issues.push("Missing vitest imports");
  }

  // Check for describe blocks
  const describeCount = (content.match(/describe\(/g) || []).length;
  if (describeCount === 0) {
    issues.push("No describe blocks found");
  }

  // Check for it blocks
  const itCount = (content.match(/it\(/g) || []).length;
  if (itCount === 0) {
    issues.push("No it blocks found");
  }

  // Check for expect assertions
  const expectCount = (content.match(/expect\(/g) || []).length;
  if (expectCount === 0) {
    issues.push("No expect assertions found");
  }

  // Check for proper mocking
  if (!content.includes("vi.mock")) {
    issues.push("No mocking setup found");
  }

  // Check for async/await usage
  if (content.includes("await ") && !content.includes("async ")) {
    issues.push("Await used without async function");
  }

  if (issues.length === 0) {
    console.log(`✅ ${path.basename(filePath)}: ${itCount} tests, ${expectCount} assertions`);
    return true;
  } else {
    console.log(`⚠️  ${path.basename(filePath)}: Issues found:`);
    issues.forEach(issue => console.log(`   - ${issue}`));
    return false;
  }
}

// Validate all test files
const testFiles = [
  'packages/core/src/npm-registry-utils.test.ts',
  'packages/core/src/npm-registry-utils.edge-cases.test.ts',
  'packages/core/src/npm-registry-utils.integration.test.ts'
];

console.log('NPM Registry Utils Test Validation\n');

let allValid = true;
testFiles.forEach(file => {
  const isValid = validateTestFile(file);
  allValid = allValid && isValid;
  console.log('');
});

console.log(allValid ? '🎉 All test files validated successfully!' : '❌ Some issues found in test files');
process.exit(allValid ? 0 : 1);