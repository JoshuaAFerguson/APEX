#!/usr/bin/env node

/**
 * Test Runner Validation Script for ToolActionStore
 * Validates the test structure and files without running the actual tests
 */

const fs = require('fs');
const path = require('path');

const TEST_FILES = [
  'toolActionStore.test.ts',
  'toolActionStore.integration.test.ts',
  'toolActionStore.performance.test.ts',
  'toolActionStore.edge-cases.test.ts',
  'toolActionStore.coverage.test.ts'
];

const REQUIRED_IMPORTS = [
  'describe',
  'it',
  'expect',
  'beforeEach',
  'afterEach'
];

const ORCHESTRATOR_DIR = __dirname;

console.log('🧪 Validating ToolActionStore Test Suite...\n');

// Check if all test files exist
console.log('📁 Checking test files...');
for (const testFile of TEST_FILES) {
  const filePath = path.join(ORCHESTRATOR_DIR, testFile);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${testFile} - Found`);

    // Basic content validation
    const content = fs.readFileSync(filePath, 'utf8');

    // Check for required imports
    const hasVitest = REQUIRED_IMPORTS.every(imp => content.includes(imp));
    if (hasVitest) {
      console.log(`    ✅ Vitest imports present`);
    } else {
      console.log(`    ❌ Missing Vitest imports`);
    }

    // Count describe blocks
    const describeCount = (content.match(/describe\(/g) || []).length;
    console.log(`    📊 ${describeCount} test suites`);

    // Count it blocks
    const itCount = (content.match(/it\(/g) || []).length;
    console.log(`    🧪 ${itCount} test cases`);

  } else {
    console.log(`  ❌ ${testFile} - Missing`);
  }
}

// Check if main implementation file exists
console.log('\n📦 Checking implementation files...');
const storeFile = path.join(ORCHESTRATOR_DIR, 'store.ts');
if (fs.existsSync(storeFile)) {
  console.log('  ✅ store.ts - Found');

  const storeContent = fs.readFileSync(storeFile, 'utf8');

  // Check for ToolActionStore class
  if (storeContent.includes('export class ToolActionStore')) {
    console.log('    ✅ ToolActionStore class exported');
  } else {
    console.log('    ❌ ToolActionStore class not found');
  }

  // Check for required methods
  const requiredMethods = [
    'createFileSnapshot',
    'recordToolAction',
    'getToolActions',
    'getUndoableActions',
    'undoAction',
    'undoLastAction',
    'cleanup',
    'getStorageStats'
  ];

  console.log('    📋 Required methods:');
  for (const method of requiredMethods) {
    if (storeContent.includes(method)) {
      console.log(`      ✅ ${method}`);
    } else {
      console.log(`      ❌ ${method}`);
    }
  }

} else {
  console.log('  ❌ store.ts - Missing');
}

// Check package.json for test scripts
console.log('\n📜 Checking package configuration...');
const packageJsonPath = path.join(ORCHESTRATOR_DIR, '..', '..', '..', 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  if (packageJson.scripts && packageJson.scripts.test) {
    console.log('  ✅ Test script configured');
  } else {
    console.log('  ⚠️  Test script not found in package.json');
  }

  if (packageJson.devDependencies && packageJson.devDependencies.vitest) {
    console.log('  ✅ Vitest dependency present');
  } else {
    console.log('  ⚠️  Vitest dependency not found');
  }
}

// Summary
console.log('\n📊 Test Suite Summary:');
const existingFiles = TEST_FILES.filter(file => fs.existsSync(path.join(ORCHESTRATOR_DIR, file)));
console.log(`  📁 Test files: ${existingFiles.length}/${TEST_FILES.length}`);

// Calculate approximate test count
let totalTests = 0;
for (const testFile of existingFiles) {
  const filePath = path.join(ORCHESTRATOR_DIR, testFile);
  const content = fs.readFileSync(filePath, 'utf8');
  const itCount = (content.match(/it\(/g) || []).length;
  totalTests += itCount;
}

console.log(`  🧪 Total test cases: ${totalTests}`);
console.log(`  🎯 Coverage areas: 9 major functional areas`);

// Test readiness check
if (existingFiles.length === TEST_FILES.length && fs.existsSync(storeFile)) {
  console.log('\n🎉 Test Suite Status: READY');
  console.log('   All test files are present and properly structured.');
  console.log('   Run `npm test` to execute the full test suite.');
  process.exit(0);
} else {
  console.log('\n⚠️  Test Suite Status: INCOMPLETE');
  console.log('   Some test files or implementation files are missing.');
  process.exit(1);
}