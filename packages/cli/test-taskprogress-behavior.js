#!/usr/bin/env node

/**
 * Simple test script to verify TaskProgress responsive behavior
 *
 * This script will run targeted tests to verify:
 * 1. TaskProgress uses useStdoutDimensions hook correctly
 * 2. Auto-compact behavior works in narrow terminals
 * 3. Breakpoint responsiveness across all widths
 * 4. Description truncation logic
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function runTest(testFile, description) {
  log(`\n${COLORS.bold}🧪 ${description}${COLORS.reset}`, 'cyan');
  log(`Running: ${testFile}`, 'blue');

  try {
    const output = execSync(`npx vitest run "${testFile}" --reporter=verbose`, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe'
    });

    log('✅ PASSED', 'green');

    // Extract key test results
    const lines = output.split('\n');
    let testCount = 0;
    lines.forEach(line => {
      if (line.includes('✓') && line.trim().startsWith('✓')) {
        testCount++;
        log(`  ${line.trim()}`, 'green');
      }
    });

    return { success: true, testCount, output };
  } catch (error) {
    log('❌ FAILED', 'red');
    log(error.stdout || error.message, 'red');
    return { success: false, testCount: 0, output: error.stdout || error.message };
  }
}

function main() {
  log('🎯 TaskProgress Responsive Behavior Test Suite', 'cyan');
  log('================================================\n', 'cyan');

  const tests = [
    {
      file: 'src/ui/components/__tests__/TaskProgress.responsive.test.tsx',
      description: 'TaskProgress Responsive Breakpoint Tests'
    },
    {
      file: 'src/ui/components/__tests__/TaskProgress.compact-mode.test.tsx',
      description: 'TaskProgress Compact Mode Tests'
    },
    {
      file: 'src/ui/hooks/__tests__/useStdoutDimensions.test.ts',
      description: 'useStdoutDimensions Hook Tests'
    }
  ];

  let totalTests = 0;
  let passedFiles = 0;
  const results = [];

  for (const test of tests) {
    if (!existsSync(test.file)) {
      log(`⚠️  Test file not found: ${test.file}`, 'yellow');
      continue;
    }

    const result = runTest(test.file, test.description);
    results.push({ ...test, ...result });
    totalTests += result.testCount;
    if (result.success) passedFiles++;
  }

  // Summary
  log('\n🎯 TEST SUMMARY', 'bold');
  log('================', 'cyan');
  log(`Files tested: ${results.length}`, 'blue');
  log(`Files passed: ${passedFiles}`, passedFiles === results.length ? 'green' : 'red');
  log(`Total tests: ${totalTests}`, 'blue');

  if (passedFiles === results.length && results.length > 0) {
    log('\n🎉 All TaskProgress responsive tests PASSED!', 'green');
    log('✅ Component properly uses useStdoutDimensions hook', 'green');
    log('✅ Auto-compact behavior works correctly', 'green');
    log('✅ Breakpoint responsiveness verified', 'green');
    log('✅ Description truncation logic validated', 'green');
  } else {
    log('\n❌ Some tests failed or were not found', 'red');
    log('Please check the test output above for details', 'yellow');
  }

  return passedFiles === results.length && results.length > 0 ? 0 : 1;
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}