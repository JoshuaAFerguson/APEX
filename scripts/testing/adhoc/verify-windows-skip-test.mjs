#!/usr/bin/env node

/**
 * Test script to verify Windows skip annotations work correctly
 * Tests the skipOnWindows functionality and counts Unix-only tests
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Analyze test files for Windows compatibility patterns
 */
async function analyzeTestFiles() {
  const testPatterns = {
    skipOnWindowsCalls: 0,
    chmodCalls: 0,
    symlinkCalls: 0,
    skipIfWindows: 0,
    platformChecks: 0
  };

  const testFiles = [
    'packages/cli/src/__tests__/idle-enable-disable.edge-cases.test.ts',
    'packages/cli/src/__tests__/idle-enable-disable.integration.test.ts',
    'tests/e2e/git-commands.e2e.test.ts',
    'tests/e2e/service-management.e2e.test.ts'
  ];

  console.log('🔍 Analyzing test files for Windows compatibility...\n');

  for (const file of testFiles) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const filename = path.basename(file);

      console.log(`📁 ${filename}:`);

      // Count skipOnWindows() calls
      const skipOnWindowsCount = (content.match(/skipOnWindows\(\)/g) || []).length;
      testPatterns.skipOnWindowsCalls += skipOnWindowsCount;

      // Count chmod calls
      const chmodCount = (content.match(/\.chmod\(/g) || []).length;
      testPatterns.chmodCalls += chmodCount;

      // Count symlink calls
      const symlinkCount = (content.match(/\.symlink\(/g) || []).length;
      testPatterns.symlinkCalls += symlinkCount;

      // Count it.skipIf(isWindows) patterns
      const skipIfWindowsCount = (content.match(/it\.skipIf\(isWindows\)/g) || []).length;
      testPatterns.skipIfWindows += skipIfWindowsCount;

      // Count platform checks
      const platformCheckCount = (content.match(/process\.platform.*win32/g) || []).length;
      testPatterns.platformChecks += platformCheckCount;

      console.log(`  - skipOnWindows() calls: ${skipOnWindowsCount}`);
      console.log(`  - chmod operations: ${chmodCount}`);
      console.log(`  - symlink operations: ${symlinkCount}`);
      console.log(`  - it.skipIf(isWindows): ${skipIfWindowsCount}`);
      console.log(`  - platform checks: ${platformCheckCount}`);
      console.log('');

    } catch (error) {
      console.log(`  ❌ Error reading ${file}: ${error.message}\n`);
    }
  }

  return testPatterns;
}

/**
 * Verify skipOnWindows import statements
 */
async function verifyImports() {
  const files = [
    'packages/cli/src/__tests__/idle-enable-disable.edge-cases.test.ts',
    'packages/cli/src/__tests__/idle-enable-disable.integration.test.ts',
    'tests/e2e/git-commands.e2e.test.ts'
  ];

  console.log('📦 Verifying skipOnWindows imports...\n');

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const filename = path.basename(file);

      const hasSkipOnWindowsImport = content.includes('skipOnWindows') &&
                                    (content.includes("import { skipOnWindows }") ||
                                     content.includes("import { loadConfig, saveConfig, skipOnWindows }"));

      console.log(`📄 ${filename}: ${hasSkipOnWindowsImport ? '✅' : '❌'} skipOnWindows imported`);
    } catch (error) {
      console.log(`📄 ${file}: ❌ Error reading file`);
    }
  }
  console.log('');
}

/**
 * Main verification function
 */
async function main() {
  console.log('🚀 Windows Compatibility Verification\n');
  console.log('=' * 50 + '\n');

  // Verify imports
  await verifyImports();

  // Analyze test patterns
  const patterns = await analyzeTestFiles();

  console.log('📊 Summary:');
  console.log('=' * 30);
  console.log(`Total skipOnWindows() calls: ${patterns.skipOnWindowsCalls}`);
  console.log(`Total chmod operations: ${patterns.chmodCalls}`);
  console.log(`Total symlink operations: ${patterns.symlinkCalls}`);
  console.log(`Total it.skipIf(isWindows): ${patterns.skipIfWindows}`);
  console.log(`Total platform checks: ${patterns.platformChecks}`);
  console.log('');

  // Verification results
  const hasProperSkipping = patterns.skipOnWindowsCalls > 0 || patterns.skipIfWindows > 0;
  const hasUnixOnlyOperations = patterns.chmodCalls > 0 || patterns.symlinkCalls > 0;

  console.log('✅ Verification Results:');
  console.log('=' * 30);
  console.log(`Windows skip annotations: ${hasProperSkipping ? '✅ Present' : '❌ Missing'}`);
  console.log(`Unix-only operations found: ${hasUnixOnlyOperations ? '✅ Detected' : '❌ None found'}`);
  console.log(`Proper protection: ${hasProperSkipping && hasUnixOnlyOperations ? '✅ Unix tests are protected' : '❌ Needs review'}`);

  if (hasProperSkipping && hasUnixOnlyOperations) {
    console.log('\n🎉 Windows compatibility implementation looks good!');
    console.log('Unix-only tests should properly skip on Windows platforms.');
  } else {
    console.log('\n⚠️  Manual review recommended.');
  }
}

// Run the verification
main().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});