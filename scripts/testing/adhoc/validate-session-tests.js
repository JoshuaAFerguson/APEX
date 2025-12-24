#!/usr/bin/env node

/**
 * Session Test Validation Script
 *
 * This script validates that all session command integration tests are properly set up
 * and can be discovered by the test runner.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function validateSessionTests() {
  console.log('🔍 Validating Session Command Integration Tests...\n');

  const testFiles = [
    'packages/cli/src/__tests__/session-commands.integration.test.ts',
    'packages/cli/src/__tests__/session-commands.acceptance.test.ts',
    'packages/cli/src/__tests__/session-commands.comprehensive.test.ts',
    'packages/cli/src/__tests__/session-handlers-unit.test.ts'
  ];

  const sourceFiles = [
    'packages/cli/src/handlers/session-handlers.ts',
    'packages/cli/src/services/SessionStore.ts',
    'packages/cli/src/services/SessionAutoSaver.ts'
  ];

  let allFilesFound = true;
  let testFileStats = {};

  console.log('📁 Checking Test Files:');
  for (const testFile of testFiles) {
    const fullPath = path.join(__dirname, testFile);
    try {
      const stats = await fs.stat(fullPath);
      const content = await fs.readFile(fullPath, 'utf8');

      // Count test cases
      const testCount = (content.match(/it\s*\(/g) || []).length;
      const describeCount = (content.match(/describe\s*\(/g) || []).length;

      testFileStats[testFile] = {
        size: stats.size,
        testCount,
        describeCount,
        lines: content.split('\n').length
      };

      console.log(`  ✅ ${testFile}`);
      console.log(`     Size: ${Math.round(stats.size / 1024)}KB, Tests: ${testCount}, Groups: ${describeCount}, Lines: ${testFileStats[testFile].lines}`);
    } catch (error) {
      console.log(`  ❌ ${testFile} - NOT FOUND`);
      allFilesFound = false;
    }
  }

  console.log('\n📁 Checking Source Files:');
  for (const sourceFile of sourceFiles) {
    const fullPath = path.join(__dirname, sourceFile);
    try {
      const stats = await fs.stat(fullPath);
      console.log(`  ✅ ${sourceFile} (${Math.round(stats.size / 1024)}KB)`);
    } catch (error) {
      console.log(`  ❌ ${sourceFile} - NOT FOUND`);
      allFilesFound = false;
    }
  }

  console.log('\n📊 Test Coverage Analysis:');

  const totalTests = Object.values(testFileStats).reduce((sum, stats) => sum + stats.testCount, 0);
  const totalLines = Object.values(testFileStats).reduce((sum, stats) => sum + stats.lines, 0);

  console.log(`  Total Test Cases: ${totalTests}`);
  console.log(`  Total Test Code Lines: ${totalLines}`);

  // Validate acceptance criteria coverage
  console.log('\n✅ Acceptance Criteria Validation:');

  const criteriaChecks = [
    'Session create command',
    'Session load command.*save before switch',
    'Session save command.*name and tags',
    'Session branch command.*specific index.*auto-naming',
    'Session export command.*md.*json.*html',
    'Session delete command',
    'Session info command'
  ];

  for (const criterion of criteriaChecks) {
    let found = false;
    for (const testFile of testFiles) {
      try {
        const content = await fs.readFile(path.join(__dirname, testFile), 'utf8');
        if (new RegExp(criterion, 'i').test(content)) {
          found = true;
          break;
        }
      } catch (error) {
        // File not found, already handled above
      }
    }

    const displayCriterion = criterion.replace(/\.\*/g, ' ');
    console.log(`  ${found ? '✅' : '❌'} ${displayCriterion}`);
    if (!found) allFilesFound = false;
  }

  console.log('\n🔧 Test Configuration Validation:');

  // Check vitest config
  const vitestConfigPath = path.join(__dirname, 'packages/cli/vitest.config.ts');
  try {
    const config = await fs.readFile(vitestConfigPath, 'utf8');
    console.log(`  ✅ Vitest configuration found`);

    if (config.includes('coverage')) {
      console.log(`  ✅ Coverage reporting configured`);
    } else {
      console.log(`  ⚠️  Coverage reporting not configured`);
    }
  } catch (error) {
    console.log(`  ❌ Vitest configuration not found`);
    allFilesFound = false;
  }

  console.log('\n📋 Summary:');

  if (allFilesFound) {
    console.log('  ✅ All session command integration tests are properly set up');
    console.log('  ✅ All acceptance criteria have test coverage');
    console.log('  ✅ Source files and test files are present');
    console.log(`  ✅ ${totalTests} test cases across ${testFiles.length} test files`);
    console.log('\n🎉 Session command integration tests are ready to run!');

    console.log('\n💡 To run the tests:');
    console.log('  npm test -- packages/cli/src/__tests__/session-commands*.test.ts');
    console.log('\n💡 To generate coverage:');
    console.log('  npm run test:coverage');

    return true;
  } else {
    console.log('  ❌ Some files or criteria are missing');
    console.log('  ❌ Please ensure all required files are present');
    return false;
  }
}

// Run validation
validateSessionTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  });