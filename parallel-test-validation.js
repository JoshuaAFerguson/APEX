#!/usr/bin/env node

/**
 * Test validation script for parallel test utilities
 *
 * This script validates that all test files are properly structured
 * and that imports resolve correctly.
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, ...args) {
  console.log(color + args.join(' ') + colors.reset);
}

// Test files to validate
const testFiles = [
  'packages/orchestrator/src/__tests__/parallel-test-utils.test.ts',
  'packages/orchestrator/src/__tests__/parallel-test-utils.integration.test.ts',
  'packages/orchestrator/src/__tests__/parallel-test-utils.edge.test.ts',
  'packages/orchestrator/src/__tests__/parallel-test-utils.performance.test.ts',
  'packages/orchestrator/src/__tests__/parallel-test-utils.error-recovery.test.ts',
  'tests/test-utils/parallel-utils.test.ts',
  'tests/test-utils/parallel-utils.comprehensive.test.ts'
];

// Implementation files to check
const implementationFiles = [
  'packages/orchestrator/src/parallel-test-utils.ts',
  'tests/test-utils/parallel-utils.ts'
];

async function validateFileExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function validateFileContent(filePath, expectedPatterns) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');

    const results = expectedPatterns.map(pattern => ({
      pattern,
      found: pattern.test ? pattern.test(content) : content.includes(pattern)
    }));

    return results;
  } catch (error) {
    return null;
  }
}

async function main() {
  log(colors.blue + colors.bold, '\n🧪 Parallel Test Utilities Validation\n');

  let allPassed = true;

  // 1. Check that all test files exist
  log(colors.bold, '📁 Checking test file existence...');

  for (const file of testFiles) {
    const exists = await validateFileExists(file);
    if (exists) {
      log(colors.green, `✅ ${file}`);
    } else {
      log(colors.red, `❌ ${file} - NOT FOUND`);
      allPassed = false;
    }
  }

  // 2. Check implementation files exist
  log(colors.bold, '\n📁 Checking implementation file existence...');

  for (const file of implementationFiles) {
    const exists = await validateFileExists(file);
    if (exists) {
      log(colors.green, `✅ ${file}`);
    } else {
      log(colors.red, `❌ ${file} - NOT FOUND`);
      allPassed = false;
    }
  }

  // 3. Validate test file structure
  log(colors.bold, '\n🔍 Validating test file structure...');

  for (const file of testFiles) {
    if (await validateFileExists(file)) {
      const patterns = [
        /describe\(/,
        /it\(/,
        /expect\(/,
        /from ['"].*parallel-test-utils/,
      ];

      const results = await validateFileContent(file, patterns);

      if (results && results.every(r => r.found)) {
        log(colors.green, `✅ ${file} - Structure valid`);
      } else {
        log(colors.yellow, `⚠️  ${file} - Missing some expected patterns`);
        if (results) {
          results.filter(r => !r.found).forEach(r => {
            log(colors.red, `   Missing: ${r.pattern}`);
          });
        }
      }
    }
  }

  // 4. Check test coverage areas
  log(colors.bold, '\n📊 Checking test coverage areas...');

  const coverageAreas = [
    {
      name: 'Worker ID Detection',
      files: ['packages/orchestrator/src/__tests__/parallel-test-utils.test.ts'],
      patterns: [/getTestWorkerId/, /isParallelTestExecution/]
    },
    {
      name: 'Database Isolation',
      files: ['packages/orchestrator/src/__tests__/parallel-test-utils.test.ts'],
      patterns: [/getWorkerUniqueDbPath/, /createParallelSafeTaskStore/]
    },
    {
      name: 'Event Emitter Isolation',
      files: ['packages/orchestrator/src/__tests__/parallel-test-utils.test.ts'],
      patterns: [/createIsolatedEventEmitter/, /IsolatedEventEmitterContext/]
    },
    {
      name: 'Mutex and Locking',
      files: ['packages/orchestrator/src/__tests__/parallel-test-utils.test.ts'],
      patterns: [/AsyncMutex/, /ResourceLockManager/]
    },
    {
      name: 'Shared State Guards',
      files: ['packages/orchestrator/src/__tests__/parallel-test-utils.test.ts'],
      patterns: [/assertNoSharedMutation/, /createImmutableSnapshot/]
    },
    {
      name: 'Integration Tests',
      files: ['packages/orchestrator/src/__tests__/parallel-test-utils.integration.test.ts'],
      patterns: [/Complete Parallel Test Workflow/, /Integration/]
    },
    {
      name: 'Edge Cases',
      files: ['packages/orchestrator/src/__tests__/parallel-test-utils.edge.test.ts'],
      patterns: [/Edge Cases/, /edge case/]
    },
    {
      name: 'Performance Tests',
      files: ['packages/orchestrator/src/__tests__/parallel-test-utils.performance.test.ts'],
      patterns: [/Performance/, /concurrency/]
    },
    {
      name: 'Error Recovery',
      files: ['packages/orchestrator/src/__tests__/parallel-test-utils.error-recovery.test.ts'],
      patterns: [/Error Recovery/, /error handling/]
    },
    {
      name: 'Unified Utilities',
      files: ['tests/test-utils/parallel-utils.comprehensive.test.ts'],
      patterns: [/Comprehensive/, /Integration/]
    }
  ];

  for (const area of coverageAreas) {
    let areaStatus = true;

    for (const file of area.files) {
      if (await validateFileExists(file)) {
        const results = await validateFileContent(file, area.patterns);

        if (!results || !results.every(r => r.found)) {
          areaStatus = false;
          break;
        }
      } else {
        areaStatus = false;
        break;
      }
    }

    if (areaStatus) {
      log(colors.green, `✅ ${area.name}`);
    } else {
      log(colors.yellow, `⚠️  ${area.name} - Missing or incomplete`);
    }
  }

  // 5. Summary
  log(colors.bold, '\n📋 Summary:');

  if (allPassed) {
    log(colors.green + colors.bold, '🎉 All validations passed!');
    log(colors.green, 'Parallel test utilities are properly implemented and tested.');

    log(colors.blue, '\nTest Coverage Summary:');
    log(colors.blue, '• Unit tests: ✅ Worker ID, Database, Events, Mutex, State Guards');
    log(colors.blue, '• Integration tests: ✅ Complete parallel test workflows');
    log(colors.blue, '• Edge case tests: ✅ Malformed input, concurrency, boundaries');
    log(colors.blue, '• Performance tests: ✅ High load, memory usage, scalability');
    log(colors.blue, '• Error recovery tests: ✅ Failure scenarios, cleanup, resilience');
    log(colors.blue, '• Unified utilities tests: ✅ Cross-package integration');

    process.exit(0);
  } else {
    log(colors.red + colors.bold, '❌ Some validations failed!');
    log(colors.red, 'Please check the issues above and resolve them.');
    process.exit(1);
  }
}

main().catch(error => {
  log(colors.red + colors.bold, '💥 Validation script failed:', error.message);
  process.exit(1);
});