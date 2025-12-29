#!/usr/bin/env node

/**
 * Verification script for Windows skip annotations in service-manager tests
 * This script validates the acceptance criteria implementation
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Test files to verify
const testFiles = [
  'packages/orchestrator/src/service-manager-acceptance.test.ts',
  'packages/orchestrator/src/service-manager.integration.test.ts',
  'packages/orchestrator/src/service-manager-enableonboot.test.ts'
];

let allPassed = true;
const results = [];

for (const testFile of testFiles) {
  const filePath = join(__dirname, testFile);
  let fileContent;

  try {
    fileContent = readFileSync(filePath, 'utf8');
  } catch (error) {
    results.push({
      file: testFile,
      passed: false,
      errors: [`Could not read file: ${error.message}`]
    });
    allPassed = false;
    continue;
  }

  const errors = [];

  // Check 1: Has Windows platform detection
  if (!fileContent.includes('const isWindows = process.platform === \'win32\'')) {
    errors.push('Missing Windows platform detection constant');
  }

  // Check 2: Has explanatory comment about Windows compatibility
  if (!fileContent.includes('Windows compatibility:')) {
    errors.push('Missing explanatory comment about Windows compatibility');
  }

  // Check 3: Has skipIf annotations
  if (!fileContent.includes('skipIf(isWindows)')) {
    errors.push('Missing skipIf(isWindows) annotations');
  }

  // Check 4: Contains Unix-specific terms that should be skipped
  const unixTerms = ['systemd', 'launchd', 'Unix-specific'];
  const hasUnixTerms = unixTerms.some(term =>
    fileContent.toLowerCase().includes(term.toLowerCase())
  );

  if (hasUnixTerms && !fileContent.includes('skipIf(isWindows)')) {
    errors.push('File contains Unix-specific functionality but lacks skip annotations');
  }

  // Check 5: Verify syntax patterns
  const skipIfMatches = fileContent.match(/it\.skipIf\(isWindows\)/g);
  const skipIfCount = skipIfMatches ? skipIfMatches.length : 0;

  if (skipIfCount === 0 && fileContent.includes('systemd')) {
    errors.push('File contains systemd references but no Windows skip annotations');
  }

  results.push({
    file: testFile,
    passed: errors.length === 0,
    errors: errors,
    skipIfCount: skipIfCount
  });

  if (errors.length > 0) {
    allPassed = false;
  }
}

// Print results
console.log('\n=== Windows Skip Annotations Verification Report ===\n');

for (const result of results) {
  const status = result.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${result.file}`);

  if (result.skipIfCount !== undefined) {
    console.log(`  - skipIf annotations found: ${result.skipIfCount}`);
  }

  if (result.errors.length > 0) {
    console.log('  Errors:');
    for (const error of result.errors) {
      console.log(`    - ${error}`);
    }
  }
  console.log();
}

console.log(`=== Overall Result: ${allPassed ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAILED'} ===`);

// Exit with appropriate code
process.exit(allPassed ? 0 : 1);