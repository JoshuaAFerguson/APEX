#!/usr/bin/env node

/**
 * @fileoverview Unified Test Runner for APEX
 *
 * This script provides a single entry point for running all types of tests
 * in the APEX monorepo with support for test category selection, filtering,
 * and comprehensive reporting.
 *
 * Features:
 * - Run all E2E tests through unified configuration
 * - Support for test type selection (unit, integration, e2e, browser)
 * - Test filtering by pattern, package, or category
 * - Comprehensive discovery validation
 * - Unified reporting and coverage
 *
 * Usage:
 *   npm run test:unified                    # Run all tests
 *   npm run test:unified -- --type=e2e     # Run only E2E tests
 *   npm run test:unified -- --type=unit    # Run only unit tests
 *   npm run test:unified -- --package=cli  # Run tests for specific package
 *   npm run test:unified -- --watch        # Watch mode
 *   npm run test:unified -- --coverage     # With coverage
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const glob = require('fast-glob');

// Test configuration mappings
const TEST_CONFIGS = {
  all: 'vitest.config.ts',
  unit: 'vitest.unit.config.ts',
  integration: 'vitest.integration.config.ts',
  e2e: 'vitest.e2e.config.ts',
  browser: 'vitest.browser.config.ts',
  'browser-integration': 'tests/browser-integration/vitest.config.ts',
  'keyboard-integration': 'tests/keyboard-integration/vitest.config.ts',
  'form-integration': 'tests/form-integration/vitest.config.ts',
  'page-navigation': 'tests/page-navigation/vitest.config.ts',
  'integration-systems': 'vitest.integration-systems.config.ts'
};

// Test type descriptions
const TEST_DESCRIPTIONS = {
  all: 'All test types (unit, integration, e2e)',
  unit: 'Fast isolated unit tests',
  integration: 'Cross-package integration tests',
  e2e: 'End-to-end tests with real system operations',
  browser: 'Browser automation tests with Playwright',
  'browser-integration': 'Browser tool integration tests',
  'keyboard-integration': 'Keyboard interaction and Ink component tests',
  'form-integration': 'Form validation and accessibility tests',
  'page-navigation': 'Page navigation and routing tests',
  'integration-systems': 'Systems-level integration tests'
};

// E2E test discovery patterns (from vitest.e2e.config.ts)
// These patterns ensure comprehensive discovery of all E2E tests across the monorepo
const E2E_PATTERNS = [
  // Standard E2E test patterns
  'packages/*/src/**/*.e2e.test.ts',
  'tests/e2e/**/*.test.ts',
  'tests/e2e/**/*.e2e.test.ts',

  // Additional E2E test patterns found in the codebase
  '**/*e2e*.test.ts',                    // Files like thoughts-e2e.test.ts, container-resource-limits-e2e.test.ts
  '**/e2e-*.test.ts',                    // Files like e2e-infrastructure-validation.test.ts
  'tests/integration/**/*e2e*.test.ts',  // Integration directory E2E tests
  'tests/test-utils/**/*e2e*.test.ts',   // Test utilities E2E tests

  // Marketplace-specific E2E tests (comprehensive patterns)
  'tests/e2e/**/mcp-*.test.ts',
  'tests/e2e/**/marketplace*.test.ts',
  'tests/e2e/**/browse-marketplace.*.test.ts',
  'tests/e2e/**/mcp-marketplace*.test.ts',

  // Browser automation E2E tests
  'packages/browser/src/**/*e2e*.test.ts',
  'packages/orchestrator/src/**/*e2e*.test.ts',

  // Workflow and integration E2E tests
  'packages/orchestrator/src/__tests__/**/*e2e*.test.ts',
  'packages/core/src/__tests__/**/*e2e*.test.ts',
  'packages/cli/src/__tests__/**/*e2e*.test.ts',
];

// Exclude patterns
const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/*.d.ts',
  '**/*.md',
  'tests/*/helpers/**',
  'tests/*/mocks/**',
  'tests/*/fixtures/**/*.ts',
  'tests/*/utils/**/*.ts',
];

function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    type: 'all',
    package: null,
    pattern: null,
    watch: false,
    coverage: false,
    verbose: false,
    list: false,
    validate: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--type=')) {
      options.type = arg.split('=')[1];
    } else if (arg.startsWith('--package=')) {
      options.package = arg.split('=')[1];
    } else if (arg.startsWith('--pattern=')) {
      options.pattern = arg.split('=')[1];
    } else if (arg === '--watch') {
      options.watch = true;
    } else if (arg === '--coverage') {
      options.coverage = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--list') {
      options.list = true;
    } else if (arg === '--validate') {
      options.validate = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
🧪 APEX Unified Test Runner

USAGE:
  node scripts/unified-test-runner.js [OPTIONS]

OPTIONS:
  --type=TYPE        Test type to run (default: all)
  --package=PKG      Run tests for specific package
  --pattern=PATTERN  Filter tests by pattern
  --watch           Run in watch mode
  --coverage        Generate coverage report
  --verbose         Verbose output
  --list            List discovered tests without running
  --validate        Validate test discovery only
  --help, -h        Show this help

TEST TYPES:
${Object.entries(TEST_DESCRIPTIONS).map(([type, desc]) =>
  `  ${type.padEnd(20)} ${desc}`
).join('\n')}

EXAMPLES:
  # Run all E2E tests
  node scripts/unified-test-runner.js --type=e2e

  # Run CLI package tests only
  node scripts/unified-test-runner.js --package=cli

  # Run marketplace E2E tests
  node scripts/unified-test-runner.js --type=e2e --pattern=marketplace

  # Validate E2E test discovery
  node scripts/unified-test-runner.js --type=e2e --validate

  # Watch mode for unit tests
  node scripts/unified-test-runner.js --type=unit --watch
`);
}

async function discoverTests(type, packageFilter, pattern) {
  console.log(`🔍 Discovering ${type} tests...`);

  let patterns = [];
  let excludes = [...EXCLUDE_PATTERNS];

  // Configure patterns based on test type
  switch (type) {
    case 'e2e':
      patterns = [...E2E_PATTERNS];
      // Exclude non-E2E test types
      excludes.push('**/*.unit.test.ts', '**/*.spec.ts');
      break;
    case 'unit':
      patterns = [
        'packages/*/src/**/*.test.ts',
        'packages/*/src/**/*.unit.test.ts',
        'packages/*/src/**/__tests__/**/*.test.ts'
      ];
      // Exclude E2E and integration tests
      excludes.push('**/*.e2e.test.ts', '**/*.integration.test.ts', '**/*e2e*.test.ts');
      break;
    case 'integration':
      patterns = [
        'packages/*/src/**/*.integration.test.ts',
        'tests/integration/**/*.test.ts'
      ];
      // Exclude E2E and unit tests
      excludes.push('**/*.e2e.test.ts', '**/*.unit.test.ts', '**/*e2e*.test.ts');
      break;
    case 'browser':
    case 'browser-integration':
    case 'keyboard-integration':
    case 'form-integration':
    case 'page-navigation':
      // These use specific configs, discover from their include patterns
      patterns = ['**/*.test.ts']; // Let vitest config handle the filtering
      break;
    default:
      patterns = ['**/*.test.ts'];
      break;
  }

  const allFiles = new Set();

  for (const globPattern of patterns) {
    try {
      let searchPattern = globPattern;

      // Apply package filter
      if (packageFilter) {
        if (globPattern.startsWith('packages/')) {
          searchPattern = globPattern.replace('packages/*', `packages/${packageFilter}`);
        } else {
          // Skip non-package patterns when filtering by package
          continue;
        }
      }

      // Apply pattern filter
      if (pattern) {
        searchPattern = searchPattern.replace('*', `*${pattern}*`);
      }

      const files = await glob(searchPattern, {
        ignore: excludes,
        cwd: process.cwd(),
        onlyFiles: true,
      });

      files.forEach(file => allFiles.add(file));
    } catch (error) {
      console.warn(`⚠️  Warning: Error with pattern "${globPattern}": ${error.message}`);
    }
  }

  const discoveredFiles = Array.from(allFiles).sort();

  console.log(`📊 Found ${discoveredFiles.length} test files`);

  if (discoveredFiles.length > 0) {
    console.log('\n📝 Test files:');
    discoveredFiles.forEach(file => {
      console.log(`  • ${file}`);
    });
  }

  return discoveredFiles;
}

function buildVitestCommand(options) {
  const config = TEST_CONFIGS[options.type];
  if (!config) {
    throw new Error(`Unknown test type: ${options.type}. Available types: ${Object.keys(TEST_CONFIGS).join(', ')}`);
  }

  // Check if config file exists
  const configPath = path.join(process.cwd(), config);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  let cmd = ['npx', 'vitest'];

  // Add config
  cmd.push('--config', config);

  // Add mode
  if (options.watch) {
    // Watch mode - no 'run' command
  } else if (options.list) {
    cmd.push('run', '--list');
  } else {
    cmd.push('run');
  }

  // Add options
  if (options.coverage) {
    cmd.push('--coverage');
  }

  if (options.verbose) {
    cmd.push('--reporter=verbose');
  }

  // Add filters
  if (options.package) {
    cmd.push(`packages/${options.package}`);
  }

  if (options.pattern) {
    cmd.push('--testNamePattern', options.pattern);
  }

  return cmd;
}

async function runTests(options) {
  try {
    const cmd = buildVitestCommand(options);

    console.log(`🚀 Running ${options.type} tests...`);
    console.log(`📋 Command: ${cmd.join(' ')}\n`);

    const result = spawn(cmd[0], cmd.slice(1), {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    return new Promise((resolve, reject) => {
      result.on('close', (code) => {
        if (code === 0) {
          console.log(`\n✅ ${options.type} tests completed successfully!`);
          resolve(true);
        } else {
          console.error(`\n❌ ${options.type} tests failed with exit code ${code}`);
          resolve(false);
        }
      });

      result.on('error', (error) => {
        console.error(`\n💥 Error running tests: ${error.message}`);
        reject(error);
      });
    });

  } catch (error) {
    console.error(`💥 Error setting up test run: ${error.message}`);
    return false;
  }
}

async function validateTestDiscovery(type) {
  console.log(`🔍 Validating ${type} test discovery...\n`);

  try {
    // Discover tests manually
    const discoveredFiles = await discoverTests(type);

    // Test vitest discovery
    const cmd = buildVitestCommand({ type, list: true });
    console.log(`\n🧪 Running vitest discovery: ${cmd.join(' ')}`);

    const vitestOutput = execSync(cmd.join(' '), {
      encoding: 'utf8',
      cwd: process.cwd(),
    });

    // Count vitest discovered tests
    const vitestTestCount = (vitestOutput.match(/\.test\.ts/g) || []).length;

    console.log(`\n📊 Discovery Results:`);
    console.log(`  Manual discovery: ${discoveredFiles.length} files`);
    console.log(`  Vitest discovery: ${vitestTestCount} files`);

    const isValid = discoveredFiles.length > 0 && vitestTestCount > 0;

    if (isValid) {
      console.log(`\n✅ ${type} test discovery is working correctly!`);
    } else {
      console.log(`\n❌ Issues found with ${type} test discovery.`);
    }

    return isValid;

  } catch (error) {
    console.error(`❌ Error during validation: ${error.message}`);
    return false;
  }
}

async function main() {
  const options = parseArguments();

  if (options.help) {
    showHelp();
    return;
  }

  console.log('🧪 APEX Unified Test Runner\n');

  // Validate test type
  if (!TEST_CONFIGS[options.type]) {
    console.error(`❌ Unknown test type: ${options.type}`);
    console.error(`Available types: ${Object.keys(TEST_CONFIGS).join(', ')}`);
    process.exit(1);
  }

  console.log(`📋 Configuration:`);
  console.log(`  Test Type: ${options.type} (${TEST_DESCRIPTIONS[options.type]})`);
  console.log(`  Package Filter: ${options.package || 'none'}`);
  console.log(`  Pattern Filter: ${options.pattern || 'none'}`);
  console.log(`  Watch Mode: ${options.watch}`);
  console.log(`  Coverage: ${options.coverage}`);
  console.log('');

  try {
    if (options.validate) {
      // Validation mode
      const isValid = await validateTestDiscovery(options.type);
      process.exit(isValid ? 0 : 1);
    } else if (options.list) {
      // List mode
      await discoverTests(options.type, options.package, options.pattern);
    } else {
      // Run mode
      const success = await runTests(options);
      process.exit(success ? 0 : 1);
    }
  } catch (error) {
    console.error(`💥 Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = {
  discoverTests,
  validateTestDiscovery,
  runTests,
  buildVitestCommand,
  TEST_CONFIGS,
  TEST_DESCRIPTIONS
};