#!/usr/bin/env node

/**
 * Test Validation Script
 *
 * This script validates the syntax and structure of our test files
 * without actually running them, to ensure they are properly structured.
 */

const fs = require('fs');
const path = require('path');

function validateTestFile(filePath) {
  console.log(`\n🔍 Validating: ${path.relative(process.cwd(), filePath)}`);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check for basic test structure
    const hasDescribe = content.includes('describe(');
    const hasIt = content.includes('it(');
    const hasExpect = content.includes('expect(');
    const hasImports = content.includes('import');

    // Check for vitest imports
    const hasVitestImports = content.includes('from \'vitest\'');

    // Check for proper async/await usage
    const asyncTests = (content.match(/it\([^,]+,\s*async\s*\(/g) || []).length;
    const awaitCalls = (content.match(/await\s+/g) || []).length;

    // Count test cases
    const testCases = (content.match(/it\s*\(/g) || []).length;
    const describeBlocks = (content.match(/describe\s*\(/g) || []).length;

    console.log(`  ✅ Basic structure: ${hasDescribe && hasIt && hasExpect ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Vitest imports: ${hasVitestImports ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Imports present: ${hasImports ? 'PASS' : 'FAIL'}`);
    console.log(`  📊 Test cases: ${testCases}`);
    console.log(`  📊 Describe blocks: ${describeBlocks}`);
    console.log(`  📊 Async tests: ${asyncTests}`);
    console.log(`  📊 Await calls: ${awaitCalls}`);

    // Check for potential issues
    const issues = [];

    if (!hasDescribe) issues.push('Missing describe blocks');
    if (!hasIt) issues.push('Missing test cases');
    if (!hasExpect) issues.push('Missing assertions');
    if (!hasVitestImports) issues.push('Missing vitest imports');
    if (asyncTests > 0 && awaitCalls === 0) issues.push('Async tests without await calls');

    if (issues.length === 0) {
      console.log(`  ✅ Validation: PASS`);
      return true;
    } else {
      console.log(`  ❌ Issues found: ${issues.join(', ')}`);
      return false;
    }

  } catch (error) {
    console.log(`  ❌ Error reading file: ${error.message}`);
    return false;
  }
}

function validateTestSyntax(filePath) {
  console.log(`\n🔍 Syntax check: ${path.relative(process.cwd(), filePath)}`);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check for common syntax issues
    const syntaxChecks = [
      {
        name: 'Balanced parentheses',
        check: () => {
          const openParens = (content.match(/\(/g) || []).length;
          const closeParens = (content.match(/\)/g) || []).length;
          return openParens === closeParens;
        }
      },
      {
        name: 'Balanced braces',
        check: () => {
          const openBraces = (content.match(/\{/g) || []).length;
          const closeBraces = (content.match(/\}/g) || []).length;
          return openBraces === closeBraces;
        }
      },
      {
        name: 'Balanced brackets',
        check: () => {
          const openBrackets = (content.match(/\[/g) || []).length;
          const closeBrackets = (content.match(/\]/g) || []).length;
          return openBrackets === closeBrackets;
        }
      },
      {
        name: 'No unclosed strings',
        check: () => {
          // Simple check for unclosed strings (this is basic)
          const singleQuotes = (content.match(/'/g) || []).length;
          const doubleQuotes = (content.match(/"/g) || []).length;
          const backticks = (content.match(/`/g) || []).length;
          return singleQuotes % 2 === 0 && doubleQuotes % 2 === 0 && backticks % 2 === 0;
        }
      }
    ];

    let allPassed = true;
    for (const check of syntaxChecks) {
      const passed = check.check();
      console.log(`  ${passed ? '✅' : '❌'} ${check.name}: ${passed ? 'PASS' : 'FAIL'}`);
      if (!passed) allPassed = false;
    }

    return allPassed;

  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }
}

// Main validation
console.log('🧪 MCP Installer Test Validation\n');

const testFiles = [
  'packages/orchestrator/src/mcp-installer.test.ts',
  'packages/orchestrator/src/__tests__/mcp-installer-orchestrator-integration.test.ts',
  'packages/orchestrator/src/__tests__/mcp-installer-database.test.ts',
  'packages/orchestrator/src/__tests__/mcp-installer-performance.test.ts'
];

let allValid = true;
let totalTestCases = 0;

for (const testFile of testFiles) {
  const fullPath = path.join(process.cwd(), testFile);

  if (!fs.existsSync(fullPath)) {
    console.log(`\n❌ File not found: ${testFile}`);
    allValid = false;
    continue;
  }

  const structureValid = validateTestFile(fullPath);
  const syntaxValid = validateTestSyntax(fullPath);

  if (!structureValid || !syntaxValid) {
    allValid = false;
  }

  // Count test cases for summary
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const testCases = (content.match(/it\s*\(/g) || []).length;
    totalTestCases += testCases;
  } catch (error) {
    // Ignore counting errors
  }
}

console.log('\n' + '='.repeat(60));
console.log('📋 VALIDATION SUMMARY');
console.log('='.repeat(60));
console.log(`Overall validation: ${allValid ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Total test files: ${testFiles.length}`);
console.log(`Total test cases: ${totalTestCases}`);
console.log(`Files validated: ${testFiles.filter(f => fs.existsSync(path.join(process.cwd(), f))).length}`);

if (allValid) {
  console.log('\n🎉 All test files are properly structured and ready to run!');
  console.log('\nTo run the tests:');
  console.log('  npm test -- packages/orchestrator/src/mcp-installer.test.ts');
  console.log('  npm test -- packages/orchestrator/src/__tests__/mcp-installer-orchestrator-integration.test.ts');
  console.log('  npm test -- packages/orchestrator/src/__tests__/mcp-installer-database.test.ts');
  console.log('  npm test -- packages/orchestrator/src/__tests__/mcp-installer-performance.test.ts');
} else {
  console.log('\n❌ Some test files have issues that need to be addressed.');
}

process.exit(allValid ? 0 : 1);