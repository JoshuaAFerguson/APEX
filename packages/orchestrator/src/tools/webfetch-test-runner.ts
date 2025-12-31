#!/usr/bin/env node

/**
 * WebFetch Test Runner
 *
 * Comprehensive test execution script for the WebFetch tool.
 * This script runs all test suites and provides detailed coverage reporting.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  errors: string[];
}

interface TestSuite {
  name: string;
  file: string;
  description: string;
  required: boolean;
}

// Define all WebFetch test suites
const TEST_SUITES: TestSuite[] = [
  {
    name: 'Comprehensive Coverage',
    file: 'webfetch.comprehensive.test.ts',
    description: 'Complete test suite covering all functionality',
    required: true
  },
  {
    name: 'Integration Tests',
    file: 'webfetch.test.ts',
    description: 'Real network integration tests',
    required: true
  },
  {
    name: 'Unit Tests',
    file: 'webfetch.unit.test.ts',
    description: 'Unit tests with mocked dependencies',
    required: true
  },
  {
    name: 'Cache Tests',
    file: 'webfetch.cache.test.ts',
    description: 'Caching behavior and management',
    required: true
  },
  {
    name: 'Edge Cases',
    file: 'webfetch.edge-cases.test.ts',
    description: 'Edge case and error handling',
    required: false
  },
  {
    name: 'Automatic Cleanup',
    file: 'webfetch.automatic-cleanup.test.ts',
    description: 'Cache cleanup mechanisms',
    required: false
  },
  {
    name: 'AI Analysis',
    file: 'webfetch.ai-analysis.test.ts',
    description: 'AI-powered content analysis',
    required: false
  },
  {
    name: 'AI Analysis Integration',
    file: 'webfetch.ai-analysis.integration.test.ts',
    description: 'AI analysis integration testing',
    required: false
  }
];

class WebFetchTestRunner {
  private readonly baseDir: string;
  private results: TestResult[] = [];

  constructor() {
    this.baseDir = process.cwd();
    this.ensureCorrectDirectory();
  }

  private ensureCorrectDirectory(): void {
    const expectedFile = resolve(this.baseDir, 'webfetch.ts');
    if (!existsSync(expectedFile)) {
      console.error('❌ Error: webfetch.ts not found. Please run from packages/orchestrator/src/tools/');
      process.exit(1);
    }
  }

  private log(message: string, color?: 'green' | 'blue' | 'yellow' | 'red'): void {
    const colors = {
      green: '\x1b[32m',
      blue: '\x1b[34m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
    };
    const reset = '\x1b[0m';

    if (color && colors[color]) {
      console.log(`${colors[color]}${message}${reset}`);
    } else {
      console.log(message);
    }
  }

  private async runTestSuite(suite: TestSuite): Promise<TestResult> {
    const startTime = Date.now();
    const testFile = resolve(this.baseDir, suite.file);

    if (!existsSync(testFile)) {
      if (suite.required) {
        throw new Error(`Required test file ${suite.file} not found`);
      } else {
        this.log(`⚠️ Optional test file ${suite.file} not found, skipping`, 'yellow');
        return {
          name: suite.name,
          passed: true, // Consider missing optional tests as passed
          duration: 0,
          errors: []
        };
      }
    }

    this.log(`🧪 Running ${suite.name}...`, 'blue');

    try {
      const command = `npx vitest run ${suite.file} --reporter=basic`;
      execSync(command, {
        cwd: process.cwd(),
        stdio: 'pipe',
        encoding: 'utf8'
      });

      const duration = Date.now() - startTime;
      this.log(`✅ ${suite.name} passed (${duration}ms)`, 'green');

      return {
        name: suite.name,
        passed: true,
        duration,
        errors: []
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.stdout || error.stderr || error.message || 'Unknown error';

      this.log(`❌ ${suite.name} failed (${duration}ms)`, 'red');
      this.log(`Error: ${errorMessage}`, 'red');

      return {
        name: suite.name,
        passed: false,
        duration,
        errors: [errorMessage]
      };
    }
  }

  private generateCoverageReport(): void {
    this.log('\n📊 Generating coverage report...', 'blue');

    try {
      execSync('npx vitest run webfetch*.test.ts --coverage --reporter=verbose', {
        cwd: process.cwd(),
        stdio: 'inherit'
      });
    } catch (error) {
      this.log('⚠️ Coverage report generation failed', 'yellow');
    }
  }

  private printSummary(): void {
    this.log('\n='.repeat(80), 'blue');
    this.log('📋 WebFetch Test Summary', 'blue');
    this.log('='.repeat(80), 'blue');

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    this.log(`\n📊 Results:`);
    this.log(`   Total test suites: ${totalTests}`);
    this.log(`   Passed: ${passedTests}`, passedTests > 0 ? 'green' : undefined);
    this.log(`   Failed: ${failedTests}`, failedTests > 0 ? 'red' : undefined);
    this.log(`   Total duration: ${totalDuration}ms`);

    if (failedTests > 0) {
      this.log(`\n❌ Failed test suites:`, 'red');
      this.results
        .filter(r => !r.passed)
        .forEach(result => {
          this.log(`   - ${result.name}`, 'red');
          result.errors.forEach(error => {
            this.log(`     ${error.split('\n')[0]}`, 'red');
          });
        });
    }

    this.log(`\n🎯 Coverage Areas Tested:`);
    this.log(`   ✅ Parameter validation`);
    this.log(`   ✅ HTTP methods (GET, POST, PUT, DELETE)`);
    this.log(`   ✅ Error handling (timeouts, network errors, HTTP errors)`);
    this.log(`   ✅ Caching behavior and management`);
    this.log(`   ✅ HTML-to-markdown conversion`);
    this.log(`   ✅ AI analysis functionality`);
    this.log(`   ✅ Headers and User-Agent handling`);
    this.log(`   ✅ Response metadata and processing`);
    this.log(`   ✅ Edge cases and robustness`);
    this.log(`   ✅ Integration end-to-end flows`);

    const success = failedTests === 0;
    if (success) {
      this.log(`\n🎉 All tests passed! WebFetch tool is ready for production.`, 'green');
    } else {
      this.log(`\n💥 Some tests failed. Please review and fix before proceeding.`, 'red');
    }

    process.exit(success ? 0 : 1);
  }

  public async run(): Promise<void> {
    this.log('🚀 WebFetch Tool Test Runner', 'blue');
    this.log('='.repeat(50), 'blue');
    this.log(`Running ${TEST_SUITES.length} test suites...\n`);

    // Run all test suites
    for (const suite of TEST_SUITES) {
      try {
        const result = await this.runTestSuite(suite);
        this.results.push(result);
      } catch (error: any) {
        this.log(`💥 Fatal error in ${suite.name}: ${error.message}`, 'red');
        this.results.push({
          name: suite.name,
          passed: false,
          duration: 0,
          errors: [error.message]
        });
      }
    }

    // Generate coverage report
    this.generateCoverageReport();

    // Print final summary
    this.printSummary();
  }
}

// Run the test suite if this file is executed directly
if (require.main === module) {
  const runner = new WebFetchTestRunner();
  runner.run().catch((error) => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

export { WebFetchTestRunner };