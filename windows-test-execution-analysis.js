#!/usr/bin/env node

/**
 * Windows Test Execution Analysis
 *
 * This script analyzes the CLI test suite for Windows platform compatibility
 * based on static analysis of test files and expected failure patterns.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class WindowsTestAnalysis {
  constructor() {
    this.testFiles = [];
    this.windowsSpecificTests = [];
    this.skippedTests = [];
    this.expectedFailures = [];
    this.cliPath = path.join(__dirname, 'packages', 'cli');
  }

  async analyze() {
    console.log('🔍 Windows Platform Test Analysis Starting...\n');

    try {
      // 1. Discover all test files
      await this.discoverTestFiles();

      // 2. Analyze test patterns
      await this.analyzeTestPatterns();

      // 3. Generate analysis report
      await this.generateAnalysisReport();

    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      process.exit(1);
    }
  }

  async discoverTestFiles() {
    console.log('📋 Discovering test files...');

    const srcPath = path.join(this.cliPath, 'src');
    this.testFiles = this.findTestFiles(srcPath);

    console.log(`   Found ${this.testFiles.length} test files\n`);
  }

  findTestFiles(dir) {
    const files = [];

    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          files.push(...this.findTestFiles(fullPath));
        } else if (item.match(/\.(test|spec)\.(ts|tsx|js|jsx)$/)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }

    return files;
  }

  async analyzeTestPatterns() {
    console.log('🔍 Analyzing test patterns for Windows compatibility...');

    for (const testFile of this.testFiles) {
      try {
        const content = fs.readFileSync(testFile, 'utf8');
        const relativePath = path.relative(this.cliPath, testFile);

        // Categorize test files
        if (testFile.includes('.windows.test.')) {
          this.windowsSpecificTests.push({
            file: relativePath,
            type: 'Windows-specific',
            content: content
          });
        }

        // Check for skip conditions
        if (content.includes('skipIf(isWindows)') || content.includes('describe.skipIf(isWindows)')) {
          this.skippedTests.push({
            file: relativePath,
            reason: 'Explicitly skipped on Windows',
            skipPatterns: this.extractSkipPatterns(content)
          });
        }

        // Check for potential failure patterns
        const failures = this.analyzeFailurePatterns(content, relativePath);
        if (failures.length > 0) {
          this.expectedFailures.push({
            file: relativePath,
            failures: failures
          });
        }

      } catch (error) {
        console.log(`   ⚠️ Could not analyze: ${testFile}`);
      }
    }

    console.log(`   - Windows-specific tests: ${this.windowsSpecificTests.length}`);
    console.log(`   - Tests skipped on Windows: ${this.skippedTests.length}`);
    console.log(`   - Tests with potential Windows failures: ${this.expectedFailures.length}\n`);
  }

  extractSkipPatterns(content) {
    const patterns = [];
    const skipLines = content.split('\n').filter(line =>
      line.includes('skipIf(isWindows)') || line.includes('describe.skipIf(isWindows)')
    );

    for (const line of skipLines) {
      const match = line.match(/(?:describe|it)\.skipIf\(isWindows\)\s*\(\s*['"]([^'"]+)['"]/);
      if (match) {
        patterns.push(match[1]);
      }
    }

    return patterns;
  }

  analyzeFailurePatterns(content, filePath) {
    const failures = [];

    // Pattern 1: Direct HOME environment variable usage
    if (content.includes('process.env.HOME') && !content.includes('getHomeDir')) {
      failures.push({
        type: 'Environment Variable',
        issue: 'Direct process.env.HOME usage (Windows uses USERPROFILE)',
        severity: 'High',
        line: this.findLineNumber(content, 'process.env.HOME')
      });
    }

    // Pattern 2: Unix paths
    const unixPaths = ['/tmp/', '/usr/', '/home/', '/bin/', '/etc/'];
    for (const unixPath of unixPaths) {
      if (content.includes(unixPath)) {
        failures.push({
          type: 'Path Resolution',
          issue: `Hardcoded Unix path: ${unixPath}`,
          severity: 'High',
          line: this.findLineNumber(content, unixPath)
        });
      }
    }

    // Pattern 3: Shell assumptions
    const shellCommands = ['bash', '/bin/sh', 'sh -c'];
    for (const shell of shellCommands) {
      if (content.includes(shell) && !content.includes('cross-platform')) {
        failures.push({
          type: 'Shell Compatibility',
          issue: `Unix shell assumption: ${shell}`,
          severity: 'Medium',
          line: this.findLineNumber(content, shell)
        });
      }
    }

    // Pattern 4: Executable resolution without .exe
    if (content.includes('spawn(') && !content.includes('resolveExecutable')) {
      const spawnMatches = content.match(/spawn\s*\(\s*['"]([^'"]+)['"]/g) || [];
      for (const match of spawnMatches) {
        const cmd = match.match(/['"]([^'"]+)['"]/)?.[1];
        if (cmd && !cmd.includes('.exe') && !['node', 'npm', 'npx'].includes(cmd)) {
          failures.push({
            type: 'Executable Resolution',
            issue: `Command may need .exe extension on Windows: ${cmd}`,
            severity: 'Medium',
            line: this.findLineNumber(content, match)
          });
        }
      }
    }

    return failures;
  }

  findLineNumber(content, searchText) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchText)) {
        return i + 1;
      }
    }
    return null;
  }

  async generateAnalysisReport() {
    console.log('📊 Generating comprehensive analysis report...');

    const report = this.buildAnalysisReport();
    const reportPath = path.join(__dirname, 'windows-test-analysis-results.md');

    fs.writeFileSync(reportPath, report);

    console.log('=== WINDOWS TEST COMPATIBILITY ANALYSIS ===\n');
    console.log(`📄 Detailed Report: ${reportPath}\n`);

    // Print summary
    this.printSummary();
  }

  printSummary() {
    console.log('📊 SUMMARY:');
    console.log(`Total Test Files: ${this.testFiles.length}`);
    console.log(`✅ Windows-Specific Tests: ${this.windowsSpecificTests.length}`);
    console.log(`⏭️ Tests Skipped on Windows: ${this.skippedTests.length}`);
    console.log(`❌ Tests with Potential Windows Failures: ${this.expectedFailures.length}\n`);

    if (this.expectedFailures.length > 0) {
      console.log('🔍 POTENTIAL FAILURE ANALYSIS:');

      const failureTypes = {};
      this.expectedFailures.forEach(test => {
        test.failures.forEach(failure => {
          if (!failureTypes[failure.type]) {
            failureTypes[failure.type] = 0;
          }
          failureTypes[failure.type]++;
        });
      });

      Object.entries(failureTypes).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} issues`);
      });
      console.log();
    }

    if (this.skippedTests.length > 0) {
      console.log('⏭️ SKIPPED TEST CATEGORIES:');
      this.skippedTests.forEach(test => {
        console.log(`   ${test.file}: ${test.reason}`);
      });
      console.log();
    }
  }

  buildAnalysisReport() {
    const timestamp = new Date().toISOString();

    return `# Windows Platform Test Analysis Results

Generated: ${timestamp}
Analyzed Directory: packages/cli/src/

## Summary

- **Total Test Files**: ${this.testFiles.length}
- **Windows-Specific Tests**: ${this.windowsSpecificTests.length}
- **Tests Skipped on Windows**: ${this.skippedTests.length}
- **Tests with Potential Windows Failures**: ${this.expectedFailures.length}

## Windows-Specific Test Files

${this.windowsSpecificTests.map(test => `### ${test.file}
- **Type**: ${test.type}
- **Purpose**: Platform-specific testing for Windows compatibility

`).join('')}

## Tests Skipped on Windows

${this.skippedTests.map(test => `### ${test.file}
- **Reason**: ${test.reason}
- **Skip Patterns**:
${test.skipPatterns.map(pattern => `  - "${pattern}"`).join('\n')}

`).join('')}

## Potential Windows Compatibility Issues

${this.expectedFailures.map(test => `### ${test.file}
${test.failures.map(failure => `
**${failure.type} Issue** (${failure.severity} severity)
- **Problem**: ${failure.issue}
- **Line**: ${failure.line || 'Not determined'}
`).join('')}
`).join('')}

## Test Coverage Analysis

### Expected Test Results on Windows

1. **✅ Tests Expected to Pass**: ${Math.floor((this.testFiles.length - this.skippedTests.length - this.expectedFailures.length) / this.testFiles.length * 100)}%
   - UI component tests
   - Cross-platform utility tests
   - Windows-specific mock tests

2. **⏭️ Tests Expected to Skip**: ${Math.floor(this.skippedTests.length / this.testFiles.length * 100)}%
   - Service management tests
   - Unix file permission tests
   - Platform-specific integration tests

3. **❌ Tests Expected to Fail**: ${Math.floor(this.expectedFailures.length / this.testFiles.length * 100)}%
   - Direct platform detection issues
   - Path resolution problems
   - Shell command compatibility

### Recommended Actions

1. **Fix High-Severity Issues**:
   - Replace \`process.env.HOME\` with \`getHomeDir()\` utility
   - Replace hardcoded Unix paths with cross-platform alternatives
   - Use \`resolveExecutable()\` for command execution

2. **Add Windows CI Testing**:
   - Run tests on Windows environment in CI pipeline
   - Monitor for platform-specific failures

3. **Implement Missing Windows Features**:
   - Windows service management functionality
   - Windows-specific file permission handling

## Implementation Validation

The CLI package shows strong Windows awareness with:
- Dedicated Windows-specific test files
- Proper skip conditions for unsupported features
- Cross-platform utility usage in most areas

However, some tests may fail due to platform-specific assumptions that need to be addressed for full Windows compatibility.
`;
  }
}

// Main execution
async function main() {
  const analysis = new WindowsTestAnalysis();
  await analysis.analyze();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { WindowsTestAnalysis };