#!/usr/bin/env node

/**
 * Windows Test Analysis Script
 * Analyzes CLI test suite for Windows platform compatibility without running tests
 */

const fs = require('fs');
const path = require('path');

const WINDOWS_PATTERNS = {
  platform_detection: /process\.platform\s*[=!]==?\s*['"`]win32['"`]/g,
  platform_mock: /Object\.defineProperty\(process,\s*['"`]platform['"`]/g,
  windows_skip: /\.skipIf\(.*isWindows.*\)|describe\.skipIf\(isWindows\)/g,
  windows_paths: /[A-Z]:[\\\/]/g,
  shell_commands: /cmd\.exe|\/d\s+\/s\s+\/c/g,
  exe_resolution: /\.exe|resolveExecutable/g,
  home_dir: /process\.env\.HOME|getHomeDir/g,
  cross_platform: /cross.?platform/gi
};

class WindowsTestAnalyzer {
  constructor() {
    this.results = {
      files_with_windows_logic: [],
      skipped_on_windows: [],
      platform_mocking_tests: [],
      potential_failures: [],
      coverage_summary: {
        total_test_files: 0,
        windows_related: 0,
        skipped_on_windows: 0,
        platform_specific: 0
      }
    };
  }

  async analyzeDirectory(dirPath) {
    const files = await this.findTestFiles(dirPath);
    console.log(`Found ${files.length} test files to analyze...\n`);

    for (const file of files) {
      await this.analyzeFile(file);
    }

    this.results.coverage_summary.total_test_files = files.length;
    return this.results;
  }

  async findTestFiles(dirPath) {
    const files = [];

    const scanDir = async (currentDir) => {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scanDir(fullPath);
        } else if (entry.isFile() && /\.test\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    };

    await scanDir(dirPath);
    return files;
  }

  async analyzeFile(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const relativePath = path.relative(process.cwd(), filePath);

      const analysis = {
        file: relativePath,
        windows_patterns: {},
        issues: [],
        metadata: {
          lines: content.split('\n').length,
          is_windows_specific: false,
          skips_on_windows: false,
          mocks_platform: false
        }
      };

      // Check for Windows-specific patterns
      for (const [pattern_name, pattern] of Object.entries(WINDOWS_PATTERNS)) {
        const matches = [...content.matchAll(pattern)];
        if (matches.length > 0) {
          analysis.windows_patterns[pattern_name] = matches.length;

          if (pattern_name === 'windows_skip') {
            analysis.metadata.skips_on_windows = true;
            this.results.skipped_on_windows.push(analysis);
            this.results.coverage_summary.skipped_on_windows++;
          }

          if (pattern_name === 'platform_mock') {
            analysis.metadata.mocks_platform = true;
            this.results.platform_mocking_tests.push(analysis);
          }
        }
      }

      // Check if file is Windows-specific
      if (relativePath.includes('windows') || relativePath.includes('win32')) {
        analysis.metadata.is_windows_specific = true;
        this.results.coverage_summary.windows_related++;
      }

      // Identify potential issues
      this.identifyPotentialIssues(content, analysis);

      // Only include files with Windows-related content
      if (Object.keys(analysis.windows_patterns).length > 0 || analysis.metadata.is_windows_specific) {
        this.results.files_with_windows_logic.push(analysis);
        this.results.coverage_summary.platform_specific++;
      }

    } catch (error) {
      console.error(`Error analyzing ${filePath}: ${error.message}`);
    }
  }

  identifyPotentialIssues(content, analysis) {
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Check for direct process.env.HOME usage (should use getHomeDir)
      if (line.includes('process.env.HOME') && !line.includes('mock')) {
        analysis.issues.push({
          line: lineNum,
          type: 'direct_home_env',
          description: 'Direct process.env.HOME usage - should use getHomeDir() for cross-platform compatibility',
          content: line.trim()
        });
      }

      // Check for hardcoded Unix paths
      if (/\/[a-z]+\/[a-z]+/.test(line) && !line.includes('mock') && !line.includes('comment')) {
        analysis.issues.push({
          line: lineNum,
          type: 'unix_path',
          description: 'Potential hardcoded Unix path - may fail on Windows',
          content: line.trim()
        });
      }

      // Check for shell command issues
      if (line.includes('spawn') || line.includes('exec')) {
        if (!line.includes('resolveExecutable') && !line.includes('mock')) {
          analysis.issues.push({
            line: lineNum,
            type: 'shell_command',
            description: 'Shell command without proper executable resolution - may fail on Windows',
            content: line.trim()
          });
        }
      }

      // Check for TODO/FIXME related to Windows
      if (/(TODO|FIXME|BUG).*windows/i.test(line)) {
        analysis.issues.push({
          line: lineNum,
          type: 'windows_todo',
          description: 'Known Windows-related issue marked in comments',
          content: line.trim()
        });
      }
    });

    if (analysis.issues.length > 0) {
      this.results.potential_failures.push(analysis);
    }
  }

  generateReport() {
    const report = [];

    report.push('# Windows Test Compatibility Analysis Report\n');
    report.push(`Analysis Date: ${new Date().toISOString()}\n`);

    // Summary
    report.push('## Summary');
    report.push(`- Total test files: ${this.results.coverage_summary.total_test_files}`);
    report.push(`- Windows-related files: ${this.results.coverage_summary.windows_related}`);
    report.push(`- Platform-specific tests: ${this.results.coverage_summary.platform_specific}`);
    report.push(`- Tests skipped on Windows: ${this.results.coverage_summary.skipped_on_windows}`);
    report.push(`- Files with potential issues: ${this.results.potential_failures.length}\n`);

    // Tests Skipped on Windows
    if (this.results.skipped_on_windows.length > 0) {
      report.push('## Tests Skipped on Windows');
      this.results.skipped_on_windows.forEach(test => {
        report.push(`### ${test.file}`);
        report.push(`- **Reason**: Contains skipIf(isWindows) conditions`);
        report.push(`- **Lines**: ${test.metadata.lines}`);
        report.push('');
      });
    }

    // Platform Mocking Tests
    if (this.results.platform_mocking_tests.length > 0) {
      report.push('## Tests with Platform Mocking');
      this.results.platform_mocking_tests.forEach(test => {
        report.push(`### ${test.file}`);
        report.push(`- **Windows patterns found**: ${Object.keys(test.windows_patterns).join(', ')}`);
        report.push('');
      });
    }

    // Potential Issues
    if (this.results.potential_failures.length > 0) {
      report.push('## Potential Windows Compatibility Issues');
      this.results.potential_failures.forEach(test => {
        if (test.issues.length > 0) {
          report.push(`### ${test.file}`);
          test.issues.forEach(issue => {
            report.push(`- **Line ${issue.line}**: ${issue.description}`);
            report.push(`  \`\`\`typescript\n  ${issue.content}\n  \`\`\``);
          });
          report.push('');
        }
      });
    }

    // Windows-Specific Test Files
    const windowsSpecificFiles = this.results.files_with_windows_logic
      .filter(f => f.metadata.is_windows_specific)
      .sort((a, b) => a.file.localeCompare(b.file));

    if (windowsSpecificFiles.length > 0) {
      report.push('## Windows-Specific Test Files');
      windowsSpecificFiles.forEach(test => {
        report.push(`### ${test.file}`);
        report.push(`- **Platform patterns**: ${Object.keys(test.windows_patterns).join(', ')}`);
        report.push(`- **Lines**: ${test.metadata.lines}`);
        if (test.metadata.skips_on_windows) report.push(`- **Skipped on Windows**: Yes`);
        if (test.metadata.mocks_platform) report.push(`- **Mocks platform**: Yes`);
        report.push('');
      });
    }

    return report.join('\n');
  }
}

// Main execution
async function main() {
  const analyzer = new WindowsTestAnalyzer();
  const cliTestsPath = path.join(__dirname, 'packages', 'cli', 'src');

  console.log('Starting Windows test compatibility analysis...');
  console.log(`Analyzing tests in: ${cliTestsPath}\n`);

  try {
    await analyzer.analyzeDirectory(cliTestsPath);
    const report = analyzer.generateReport();

    // Write report to file
    const reportPath = path.join(__dirname, 'windows-test-analysis-report.md');
    await fs.promises.writeFile(reportPath, report);

    console.log('Analysis completed!');
    console.log(`Report written to: ${reportPath}\n`);

    // Print summary to console
    console.log('=== ANALYSIS SUMMARY ===');
    console.log(report.split('## Potential Windows Compatibility Issues')[0]);

  } catch (error) {
    console.error('Analysis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { WindowsTestAnalyzer };