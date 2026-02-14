#!/usr/bin/env ts-node

/**
 * JSDoc Validation Test Runner
 *
 * Comprehensive test runner for all JSDoc validation functionality.
 * Executes unit tests, integration tests, and generates coverage reports.
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Test suite configuration
 */
interface TestSuite {
  name: string;
  description: string;
  file: string;
  required: boolean;
}

/**
 * Test execution result
 */
interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  output: string;
  error?: string;
}

/**
 * Available test suites
 */
const TEST_SUITES: TestSuite[] = [
  {
    name: 'Unit Tests',
    description: 'JSDoc detector core functionality tests',
    file: 'jsdoc-detector.unit.test.ts',
    required: true
  },
  {
    name: 'Integration Tests',
    description: 'Complete JSDoc validation workflow tests',
    file: 'jsdoc-validation.integration.test.ts',
    required: true
  },
  {
    name: 'TypeScript Compilation Tests',
    description: 'TypeScript compilation validation with JSDoc scenarios',
    file: 'typescript-compilation.test.ts',
    required: true
  },
  {
    name: 'Coverage Report Tests',
    description: 'Coverage calculation and reporting accuracy tests',
    file: 'coverage-report.test.ts',
    required: true
  }
];

/**
 * Test execution configuration
 */
interface TestConfig {
  verbose: boolean;
  bail: boolean;
  coverage: boolean;
  pattern?: string;
  timeout: number;
}

/**
 * Default test configuration
 */
const DEFAULT_CONFIG: TestConfig = {
  verbose: false,
  bail: false,
  coverage: false,
  timeout: 30000 // 30 seconds per test suite
};

/**
 * Executes a single test suite
 * @param suite - Test suite to execute
 * @param config - Test configuration
 * @returns Test execution result
 */
async function runTestSuite(suite: TestSuite, config: TestConfig): Promise<TestResult> {
  const testDir = path.dirname(__filename);
  const testFile = path.join(testDir, suite.file);

  console.log(`\n🧪 Running ${suite.name}...`);
  console.log(`   ${suite.description}`);

  const startTime = Date.now();

  try {
    // Check if test file exists
    await fs.access(testFile);

    // Build vitest command
    const vitestArgs = [
      'run',
      testFile,
      '--reporter=verbose',
      `--testTimeout=${config.timeout}`,
    ];

    if (config.coverage) {
      vitestArgs.push('--coverage');
    }

    if (config.verbose) {
      vitestArgs.push('--verbose');
    }

    // Execute test
    const output = execSync(`npx vitest ${vitestArgs.join(' ')}`, {
      cwd: path.resolve(__dirname, '..', '..'),
      encoding: 'utf8',
      stdio: config.verbose ? 'inherit' : 'pipe',
      timeout: config.timeout
    });

    const duration = Date.now() - startTime;

    console.log(`   ✅ ${suite.name} passed (${duration}ms)`);

    return {
      suite: suite.name,
      passed: true,
      duration,
      output: output.toString()
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.log(`   ❌ ${suite.name} failed (${duration}ms)`);

    if (config.verbose) {
      console.error(`   Error: ${error.message}`);
      if (error.stdout) console.log('   STDOUT:', error.stdout.toString());
      if (error.stderr) console.error('   STDERR:', error.stderr.toString());
    }

    return {
      suite: suite.name,
      passed: false,
      duration,
      output: error.stdout?.toString() || '',
      error: error.message
    };
  }
}

/**
 * Generates a summary report of test results
 * @param results - Array of test results
 * @param config - Test configuration
 */
function generateSummaryReport(results: TestResult[], config: TestConfig): void {
  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log('\n📊 Test Summary Report');
  console.log('=======================');
  console.log(`Total Suites: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  console.log(`Total Duration: ${totalDuration}ms`);

  if (failedTests > 0) {
    console.log('\n❌ Failed Test Suites:');
    results
      .filter(r => !r.passed)
      .forEach(result => {
        console.log(`   • ${result.suite}: ${result.error || 'Unknown error'}`);
      });
  }

  console.log('\n📋 Detailed Results:');
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`   ${status} ${result.suite} (${result.duration}ms)`);
  });
}

/**
 * Generates a JSON test report
 * @param results - Array of test results
 * @param config - Test configuration
 */
async function generateJSONReport(results: TestResult[], config: TestConfig): Promise<void> {
  const report = {
    timestamp: new Date().toISOString(),
    config: {
      verbose: config.verbose,
      coverage: config.coverage,
      timeout: config.timeout,
      pattern: config.pattern
    },
    summary: {
      totalSuites: results.length,
      passedSuites: results.filter(r => r.passed).length,
      failedSuites: results.filter(r => !r.passed).length,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      successRate: Math.round((results.filter(r => r.passed).length / results.length) * 100)
    },
    results: results.map(result => ({
      suite: result.suite,
      passed: result.passed,
      duration: result.duration,
      error: result.error || null
    }))
  };

  const reportPath = path.join(__dirname, 'test-results.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 JSON report saved to: ${reportPath}`);
}

/**
 * Validates the test environment
 * @returns True if environment is ready for testing
 */
async function validateTestEnvironment(): Promise<boolean> {
  try {
    // Check if required files exist
    const requiredFiles = [
      '../../packages/core/src/jsdoc-detector.ts',
      '../../scripts/validate-jsdoc-comprehensive.ts',
      '../../tsconfig.jsdoc-validation.json'
    ];

    for (const file of requiredFiles) {
      const filePath = path.resolve(__dirname, file);
      await fs.access(filePath);
    }

    // Check if vitest is available
    execSync('npx vitest --version', {
      stdio: 'pipe',
      cwd: path.resolve(__dirname, '..', '..')
    });

    return true;
  } catch (error) {
    console.error('❌ Test environment validation failed:');
    console.error('   Make sure all required files are present and dependencies are installed');
    console.error('   Run "npm install" in the project root if needed');
    return false;
  }
}

/**
 * Main test runner function
 * @param config - Test configuration
 */
async function runJSDocTests(config: TestConfig): Promise<void> {
  console.log('🚀 Starting JSDoc Validation Tests');
  console.log('===================================');

  // Validate test environment
  console.log('🔍 Validating test environment...');
  const environmentValid = await validateTestEnvironment();
  if (!environmentValid) {
    process.exit(1);
  }
  console.log('✅ Test environment validation passed');

  // Filter test suites by pattern if provided
  let suitesToRun = TEST_SUITES;
  if (config.pattern) {
    suitesToRun = TEST_SUITES.filter(suite =>
      suite.name.toLowerCase().includes(config.pattern!.toLowerCase()) ||
      suite.file.toLowerCase().includes(config.pattern!.toLowerCase())
    );

    if (suitesToRun.length === 0) {
      console.error(`❌ No test suites match pattern: ${config.pattern}`);
      process.exit(1);
    }
  }

  console.log(`\n📋 Test Plan (${suitesToRun.length} suites):`);
  suitesToRun.forEach((suite, index) => {
    console.log(`   ${index + 1}. ${suite.name} ${suite.required ? '[REQUIRED]' : '[OPTIONAL]'}`);
    console.log(`      ${suite.description}`);
  });

  // Execute test suites
  const results: TestResult[] = [];

  for (const suite of suitesToRun) {
    const result = await runTestSuite(suite, config);
    results.push(result);

    // Bail on first failure if configured
    if (config.bail && !result.passed && suite.required) {
      console.log('\n🛑 Stopping execution due to failed required test suite');
      break;
    }
  }

  // Generate reports
  generateSummaryReport(results, config);
  await generateJSONReport(results, config);

  // Exit with appropriate code
  const hasFailures = results.some(r => !r.passed);
  if (hasFailures) {
    console.log('\n❌ Some tests failed. Please review the results above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed successfully!');
    process.exit(0);
  }
}

/**
 * Parse command line arguments
 */
function parseArguments(): TestConfig {
  const config = { ...DEFAULT_CONFIG };
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;

      case '--bail':
      case '-b':
        config.bail = true;
        break;

      case '--coverage':
      case '-c':
        config.coverage = true;
        break;

      case '--pattern':
      case '-p':
        if (args[i + 1]) {
          config.pattern = args[i + 1];
          i++; // Skip next argument
        }
        break;

      case '--timeout':
      case '-t':
        if (args[i + 1]) {
          config.timeout = parseInt(args[i + 1], 10);
          i++; // Skip next argument
        }
        break;

      case '--help':
      case '-h':
        console.log('JSDoc Validation Test Runner');
        console.log('');
        console.log('Usage: ts-node run-jsdoc-tests.ts [options]');
        console.log('');
        console.log('Options:');
        console.log('  -v, --verbose     Enable verbose output');
        console.log('  -b, --bail        Stop on first failure');
        console.log('  -c, --coverage    Enable coverage reporting');
        console.log('  -p, --pattern     Filter tests by pattern');
        console.log('  -t, --timeout     Set test timeout in milliseconds');
        console.log('  -h, --help        Show this help message');
        console.log('');
        console.log('Examples:');
        console.log('  ts-node run-jsdoc-tests.ts');
        console.log('  ts-node run-jsdoc-tests.ts --verbose --coverage');
        console.log('  ts-node run-jsdoc-tests.ts --pattern "unit" --bail');
        process.exit(0);

      default:
        console.error(`Unknown argument: ${arg}`);
        console.error('Use --help for usage information');
        process.exit(1);
    }
  }

  return config;
}

// Main execution
if (require.main === module) {
  const config = parseArguments();
  runJSDocTests(config).catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export { runJSDocTests, type TestConfig, type TestResult };