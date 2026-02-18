#!/usr/bin/env node

/**
 * Simple validation script to check if our enhanced integration test
 * imports and basic structure are correct without running the full test suite
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating enhanced error display integration test...');

// Check if the test file exists and has the expected structure
const testFile = path.join(__dirname, 'error-display-flow.integration.test.ts');

if (!fs.existsSync(testFile)) {
  console.error('❌ Test file not found');
  process.exit(1);
}

const testContent = fs.readFileSync(testFile, 'utf8');

// Check for key test structure elements
const checks = [
  { name: 'Import statements', pattern: /import.*vitest/ },
  { name: 'ApexError import', pattern: /import.*ApexError.*@apexcli\/core/ },
  { name: 'CLI ErrorFormatter import', pattern: /import.*ErrorFormatter.*@apexcli\/cli/ },
  { name: 'Basic Error Flow describe block', pattern: /describe\('Basic Error Flow'/ },
  { name: 'End-to-End Error Flow describe block', pattern: /describe\('End-to-End Error Flow'/ },
  { name: 'Enhanced Error Scenarios describe block', pattern: /describe\('Enhanced Error Scenarios'/ },
  { name: 'Claude SDK error test', pattern: /Claude Agent SDK timeout/ },
  { name: 'Tool integration error test', pattern: /Custom tool registration failed/ },
  { name: 'Dependency error test', pattern: /Package dependency conflict/ },
  { name: 'Error chain propagation test', pattern: /error chain propagation/ },
  { name: 'Concurrent error formatting test', pattern: /concurrent error formatting/ },
  { name: 'Cross-Package Integration describe block', pattern: /describe\('Cross-Package Integration'/ },
];

let passed = 0;
let failed = 0;

checks.forEach(check => {
  if (check.pattern.test(testContent)) {
    console.log(`✅ ${check.name}`);
    passed++;
  } else {
    console.log(`❌ ${check.name}`);
    failed++;
  }
});

// Check for syntax issues by looking for common problems
const syntaxChecks = [
  { name: 'Balanced braces', check: () => {
    const openBraces = (testContent.match(/\{/g) || []).length;
    const closeBraces = (testContent.match(/\}/g) || []).length;
    return openBraces === closeBraces;
  }},
  { name: 'Balanced parentheses', check: () => {
    const openParens = (testContent.match(/\(/g) || []).length;
    const closeParens = (testContent.match(/\)/g) || []).length;
    return openParens === closeParens;
  }},
  { name: 'No obvious syntax errors', check: () => {
    return !testContent.includes('undefined') &&
           !testContent.includes('SyntaxError') &&
           !testContent.includes('ReferenceError');
  }},
];

syntaxChecks.forEach(check => {
  if (check.check()) {
    console.log(`✅ ${check.name}`);
    passed++;
  } else {
    console.log(`❌ ${check.name}`);
    failed++;
  }
});

console.log(`\n📊 Validation Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All validation checks passed! The enhanced integration test appears to be structurally correct.');
  process.exit(0);
} else {
  console.log('⚠️  Some validation checks failed. Please review the test file.');
  process.exit(1);
}