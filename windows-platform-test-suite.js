#!/usr/bin/env node

/**
 * Windows Platform Test Suite Executor
 *
 * This script executes the CLI test suite with Windows platform detection
 * and provides detailed analysis of failures specific to Windows compatibility.
 *
 * Usage:
 *   node windows-platform-test-suite.js [--mock-windows] [--coverage] [--windows-only]
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class WindowsTestSuiteRunner {
  constructor(options = {}) {
    this.options = {
      mockWindows: options.mockWindows || false,
      coverage: options.coverage || false,
      windowsOnly: options.windowsOnly || false,
      verbose: options.verbose || true
    };

    this.results = {
      passed: [],
      failed: [],
      skipped: [],
      errors: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      }
    };
  }

  async run() {
    console.log('🚀 Starting Windows Platform Test Suite Analysis\n');

    try {
      // 1. Verify environment
      await this.verifyEnvironment();

      // 2. Build the project
      await this.buildProject();

      // 3. Run type checking
      await this.runTypeCheck();

      // 4. Execute tests
      await this.executeTests();

      // 5. Generate report
      await this.generateReport();

    } catch (error) {
      console.error('❌ Test suite execution failed:', error.message);
      process.exit(1);
    }
  }

  async verifyEnvironment() {
    console.log('📋 Verifying Environment...');

    const nodeVersion = process.version;
    console.log(`   Node.js: ${nodeVersion}`);

    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      console.log(`   npm: ${npmVersion}`);
    } catch (error) {
      throw new Error('npm not found');
    }

    const cliPath = path.join(process.cwd(), 'packages', 'cli');
    if (!fs.existsSync(cliPath)) {
      throw new Error('CLI package not found at packages/cli');
    }

    console.log(`   CLI Package: ${cliPath}`);
    console.log(`   Platform: ${process.platform}`);

    if (this.options.mockWindows) {
      console.log('   🪟 Windows Platform Mocking: ENABLED');
    }

    console.log('✅ Environment verified\n');
  }

  async buildProject() {
    console.log('🔨 Building Project...');

    try {
      process.chdir(path.join(process.cwd(), 'packages', 'cli'));

      const buildResult = execSync('npm run build', {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      console.log('✅ Build successful\n');

    } catch (error) {
      console.error('❌ Build failed:');
      console.error(error.stdout || error.message);
      throw new Error('Build failure - cannot proceed with tests');
    }
  }

  async runTypeCheck() {
    console.log('🔍 Running TypeScript Type Check...');

    try {
      const typeCheckResult = execSync('npm run typecheck', {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      console.log('✅ Type check passed\n');

    } catch (error) {
      console.log('⚠️  Type check issues found:');
      console.log(error.stdout || error.message);
      console.log('Continuing with tests...\n');
    }
  }

  async executeTests() {
    console.log('🧪 Executing Test Suite...');

    const testCommands = this.buildTestCommands();

    for (const { name, command, args } of testCommands) {
      console.log(`\n📊 Running: ${name}`);
      console.log(`Command: ${command} ${args.join(' ')}`);

      try {
        const result = await this.runTestCommand(command, args);
        this.processTestResult(name, result);

      } catch (error) {
        console.error(`❌ ${name} failed:`, error.message);
        this.results.errors.push({
          test: name,
          error: error.message
        });
      }
    }
  }

  buildTestCommands() {
    const commands = [];

    if (this.options.windowsOnly) {
      // Run only Windows-specific tests
      commands.push({
        name: 'Windows-Specific Tests',
        command: 'npx',
        args: ['vitest', 'run', '--reporter=verbose', 'src/**/*.windows.test.*']
      });

      commands.push({
        name: 'Cross-Platform Tests',
        command: 'npx',
        args: ['vitest', 'run', '--reporter=verbose', 'src/**/*cross-platform*.test.*']
      });

    } else {
      // Run full test suite
      const testCmd = this.options.coverage ? 'test:coverage' : 'test';

      commands.push({
        name: 'Full Test Suite',
        command: 'npm',
        args: ['run', testCmd]
      });
    }

    return commands;
  }

  async runTestCommand(command, args) {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...(this.options.mockWindows ? { FORCE_WINDOWS_PLATFORM: 'true' } : {})
        }
      });

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        if (this.options.verbose) {
          process.stdout.write(output);
        }
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        if (this.options.verbose) {
          process.stderr.write(output);
        }
      });

      child.on('close', (code) => {
        resolve({
          code,
          stdout,
          stderr,
          success: code === 0
        });
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Set timeout for long-running tests
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Test execution timeout'));
      }, 300000); // 5 minutes
    });
  }

  processTestResult(testName, result) {
    this.results.summary.total++;

    if (result.success) {
      this.results.passed.push(testName);
      this.results.summary.passed++;
      console.log(`✅ ${testName} - PASSED`);
    } else {
      this.results.failed.push({
        name: testName,
        stdout: result.stdout,
        stderr: result.stderr
      });
      this.results.summary.failed++;
      console.log(`❌ ${testName} - FAILED`);
    }

    // Parse output for skipped tests
    const skippedMatches = result.stdout.match(/skipped \d+/g) || [];
    if (skippedMatches.length > 0) {
      const skippedCount = skippedMatches[0].match(/\d+/)[0];
      this.results.summary.skipped += parseInt(skippedCount);
      console.log(`⏭️  ${testName} - ${skippedCount} tests skipped`);
    }
  }

  async generateReport() {
    console.log('\n📊 Generating Test Report...\n');

    const report = this.buildReport();
    const reportPath = path.join(process.cwd(), 'windows-test-execution-report.md');

    await fs.promises.writeFile(reportPath, report);

    console.log('=== TEST EXECUTION SUMMARY ===');
    console.log(`Total Tests: ${this.results.summary.total}`);
    console.log(`✅ Passed: ${this.results.summary.passed}`);
    console.log(`❌ Failed: ${this.results.summary.failed}`);
    console.log(`⏭️  Skipped: ${this.results.summary.skipped}`);
    console.log(`📄 Report: ${reportPath}\n`);

    if (this.results.failed.length > 0) {
      console.log('🔍 FAILED TESTS ANALYSIS:');
      this.analyzeFailures();
    }

    if (this.results.summary.failed > 0) {
      process.exit(1);
    }
  }

  analyzeFailures() {
    this.results.failed.forEach(failure => {
      console.log(`\n❌ ${failure.name}:`);

      // Analyze failure patterns
      const stderr = failure.stderr || '';
      const stdout = failure.stdout || '';

      if (stderr.includes('ENOENT') || stderr.includes('spawn')) {
        console.log('   🔸 Likely executable resolution issue (Windows .exe missing)');
      }

      if (stderr.includes('/tmp/') || stderr.includes('/usr/') || stderr.includes('/home/')) {
        console.log('   🔸 Hardcoded Unix path detected');
      }

      if (stderr.includes('process.env.HOME')) {
        console.log('   🔸 Direct HOME environment variable usage (Windows incompatible)');
      }

      if (stderr.includes('/bin/sh') || stderr.includes('bash')) {
        console.log('   🔸 Unix shell assumption detected');
      }

      // Show first few lines of error
      const errorLines = stderr.split('\n').filter(line => line.trim()).slice(0, 3);
      errorLines.forEach(line => {
        console.log(`   ${line}`);
      });
    });
  }

  buildReport() {
    const timestamp = new Date().toISOString();

    return `# Windows Platform Test Execution Report

Generated: ${timestamp}
Platform: ${process.platform} ${this.options.mockWindows ? '(Mocked as Windows)' : ''}
Options: ${JSON.stringify(this.options, null, 2)}

## Summary

- **Total Tests**: ${this.results.summary.total}
- **Passed**: ${this.results.summary.passed}
- **Failed**: ${this.results.summary.failed}
- **Skipped**: ${this.results.summary.skipped}

## Passed Tests

${this.results.passed.map(test => `✅ ${test}`).join('\n')}

## Failed Tests

${this.results.failed.map(failure => `❌ ${failure.name}`).join('\n')}

${this.results.failed.length > 0 ? `## Failure Analysis

${this.results.failed.map(failure => `### ${failure.name}

**Error Output:**
\`\`\`
${failure.stderr ? failure.stderr.slice(0, 1000) : 'No error output'}
\`\`\`

**Test Output:**
\`\`\`
${failure.stdout ? failure.stdout.slice(0, 1000) : 'No test output'}
\`\`\`
`).join('\n')}` : ''}

## Execution Errors

${this.results.errors.map(error => `❌ ${error.test}: ${error.error}`).join('\n')}

## Recommendations

Based on the test results:

1. **Service Tests**: ${this.results.summary.skipped > 0 ? 'Expected skips on Windows - implement Windows service management' : 'No skips detected'}
2. **Platform Compatibility**: ${this.results.summary.failed > 0 ? 'Address platform-specific failures' : 'Good platform compatibility'}
3. **Coverage**: Run with --coverage flag for detailed coverage analysis

## Next Steps

1. Review failed tests for Windows compatibility issues
2. Implement missing Windows-specific functionality
3. Add Windows CI pipeline for continuous testing
4. Update cross-platform utilities usage
`;
  }
}

// CLI Interface
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mockWindows: args.includes('--mock-windows'),
    coverage: args.includes('--coverage'),
    windowsOnly: args.includes('--windows-only'),
    verbose: !args.includes('--quiet')
  };

  if (args.includes('--help')) {
    console.log(`
Windows Platform Test Suite Runner

Usage:
  node windows-platform-test-suite.js [options]

Options:
  --mock-windows    Mock platform as Windows for testing
  --coverage        Run tests with coverage reporting
  --windows-only    Run only Windows-specific tests
  --quiet           Reduce output verbosity
  --help            Show this help message

Examples:
  node windows-platform-test-suite.js
  node windows-platform-test-suite.js --mock-windows --coverage
  node windows-platform-test-suite.js --windows-only
`);
    process.exit(0);
  }

  return options;
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  const runner = new WindowsTestSuiteRunner(options);
  runner.run().catch(console.error);
}

module.exports = { WindowsTestSuiteRunner };