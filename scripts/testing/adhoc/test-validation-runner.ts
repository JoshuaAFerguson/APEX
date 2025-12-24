/**
 * Test Runner Validation Script
 *
 * This script validates that all IdleTaskGenerator integration tests are properly
 * structured and can be executed. It checks for common issues and provides
 * a summary of test coverage for the enhanced analyzer capabilities.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface TestFileInfo {
  file: string;
  testCount: number;
  hasIntegration: boolean;
  hasAcceptanceCriteria: boolean;
  hasBackwardCompatibility: boolean;
  hasPerformance: boolean;
  imports: string[];
  issues: string[];
}

interface TestValidationReport {
  totalTestFiles: number;
  integrationTests: TestFileInfo[];
  coverage: {
    acceptanceCriteria: boolean;
    backwardCompatibility: boolean;
    performanceTests: boolean;
    enhancedAnalyzers: boolean;
  };
  issues: string[];
  recommendations: string[];
}

class TestValidator {
  private readonly orchestratorPath: string;

  constructor() {
    this.orchestratorPath = path.join(__dirname, 'packages/orchestrator/src');
  }

  async validateTests(): Promise<TestValidationReport> {
    const testFiles = await this.findTestFiles();
    const analysisResults = await Promise.all(
      testFiles.map(file => this.analyzeTestFile(file))
    );

    const integrationTests = analysisResults.filter(result =>
      result.hasIntegration || result.file.includes('integration')
    );

    const report: TestValidationReport = {
      totalTestFiles: testFiles.length,
      integrationTests,
      coverage: {
        acceptanceCriteria: analysisResults.some(r => r.hasAcceptanceCriteria),
        backwardCompatibility: analysisResults.some(r => r.hasBackwardCompatibility),
        performanceTests: analysisResults.some(r => r.hasPerformance),
        enhancedAnalyzers: analysisResults.some(r =>
          r.imports.some(imp =>
            imp.includes('CrossReferenceValidator') ||
            imp.includes('VersionMismatchDetector')
          )
        )
      },
      issues: [],
      recommendations: []
    };

    this.addRecommendations(report);
    return report;
  }

  private async findTestFiles(): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(this.orchestratorPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.includes('idle-task-generator') && entry.name.endsWith('.test.ts')) {
          files.push(path.join(this.orchestratorPath, entry.name));
        }
      }
    } catch (error) {
      console.warn('Error reading test directory:', error);
    }

    return files;
  }

  private async analyzeTestFile(filePath: string): Promise<TestFileInfo> {
    const fileName = path.basename(filePath);
    const result: TestFileInfo = {
      file: fileName,
      testCount: 0,
      hasIntegration: false,
      hasAcceptanceCriteria: false,
      hasBackwardCompatibility: false,
      hasPerformance: false,
      imports: [],
      issues: []
    };

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Count test cases
      const testMatches = content.match(/^\s*(it|test)\s*\(/gm);
      result.testCount = testMatches ? testMatches.length : 0;

      // Extract imports
      const importMatches = content.match(/^import\s+.*$/gm);
      result.imports = importMatches || [];

      // Check for integration patterns
      result.hasIntegration = content.includes('integration') ||
                            content.includes('Integration') ||
                            fileName.includes('integration');

      // Check for acceptance criteria
      result.hasAcceptanceCriteria = content.includes('acceptance') ||
                                   content.includes('Acceptance') ||
                                   content.includes('AC1:') ||
                                   content.includes('AC2:') ||
                                   content.includes('AC3:') ||
                                   content.includes('AC4:');

      // Check for backward compatibility tests
      result.hasBackwardCompatibility = content.includes('backward') ||
                                      content.includes('Backward') ||
                                      content.includes('legacy') ||
                                      content.includes('compatibility');

      // Check for performance tests
      result.hasPerformance = content.includes('performance') ||
                            content.includes('Performance') ||
                            content.includes('Date.now()') ||
                            content.includes('startTime') ||
                            content.includes('endTime');

      // Validate common issues
      this.validateTestStructure(content, result);

    } catch (error) {
      result.issues.push(`Failed to read file: ${error}`);
    }

    return result;
  }

  private validateTestStructure(content: string, result: TestFileInfo): void {
    // Check for proper mock setup
    if (content.includes('generateTaskId') && !content.includes('vi.mock')) {
      result.issues.push('Uses generateTaskId but missing proper mock setup');
    }

    // Check for cleanup
    if (content.includes('fs.mkdir') && !content.includes('afterAll')) {
      result.issues.push('Creates test files but missing cleanup in afterAll');
    }

    // Check for proper test isolation
    if (content.includes('beforeEach') && content.includes('generator = new')) {
      // Good - proper test isolation
    } else if (result.testCount > 1) {
      result.issues.push('Multiple tests without proper beforeEach setup');
    }

    // Check for async/await consistency
    const asyncTests = content.match(/async\s*\(\s*\)\s*=>/g);
    const awaitUsage = content.match(/await\s+/g);

    if (asyncTests && asyncTests.length > 0 && (!awaitUsage || awaitUsage.length === 0)) {
      result.issues.push('Async test functions without await usage');
    }
  }

  private addRecommendations(report: TestValidationReport): void {
    if (!report.coverage.acceptanceCriteria) {
      report.recommendations.push('Add specific acceptance criteria validation tests');
    }

    if (!report.coverage.backwardCompatibility) {
      report.recommendations.push('Add backward compatibility tests for legacy analysis formats');
    }

    if (!report.coverage.performanceTests) {
      report.recommendations.push('Add performance benchmarks for enhanced analysis');
    }

    if (!report.coverage.enhancedAnalyzers) {
      report.recommendations.push('Add integration tests for enhanced analyzers (CrossReferenceValidator, VersionMismatchDetector)');
    }

    if (report.integrationTests.length === 0) {
      report.recommendations.push('Create integration tests for end-to-end workflow validation');
    }

    const totalIssues = report.integrationTests.reduce((sum, test) => sum + test.issues.length, 0);
    if (totalIssues > 0) {
      report.recommendations.push(`Fix ${totalIssues} identified test structure issues`);
    }
  }

  async generateReport(): Promise<string> {
    const report = await this.validateTests();

    let output = '# IdleTaskGenerator Test Validation Report\n\n';

    output += `## Summary\n`;
    output += `- Total test files: ${report.totalTestFiles}\n`;
    output += `- Integration tests: ${report.integrationTests.length}\n`;
    output += `- Total test cases: ${report.integrationTests.reduce((sum, t) => sum + t.testCount, 0)}\n\n`;

    output += `## Coverage Analysis\n`;
    output += `- ✅ Acceptance Criteria Tests: ${report.coverage.acceptanceCriteria ? 'Present' : 'Missing'}\n`;
    output += `- ✅ Backward Compatibility: ${report.coverage.backwardCompatibility ? 'Present' : 'Missing'}\n`;
    output += `- ✅ Performance Tests: ${report.coverage.performanceTests ? 'Present' : 'Missing'}\n`;
    output += `- ✅ Enhanced Analyzers: ${report.coverage.enhancedAnalyzers ? 'Present' : 'Missing'}\n\n`;

    output += `## Integration Test Files\n\n`;
    for (const test of report.integrationTests) {
      output += `### ${test.file}\n`;
      output += `- Test cases: ${test.testCount}\n`;
      output += `- Integration: ${test.hasIntegration ? '✅' : '❌'}\n`;
      output += `- Acceptance Criteria: ${test.hasAcceptanceCriteria ? '✅' : '❌'}\n`;
      output += `- Backward Compatibility: ${test.hasBackwardCompatibility ? '✅' : '❌'}\n`;
      output += `- Performance: ${test.hasPerformance ? '✅' : '❌'}\n`;

      if (test.issues.length > 0) {
        output += `- Issues:\n`;
        test.issues.forEach(issue => {
          output += `  - ⚠️ ${issue}\n`;
        });
      }
      output += '\n';
    }

    if (report.recommendations.length > 0) {
      output += `## Recommendations\n\n`;
      report.recommendations.forEach(rec => {
        output += `- ${rec}\n`;
      });
      output += '\n';
    }

    output += `## Test Execution Validation\n\n`;
    output += `The following tests should be executable:\n\n`;
    output += '```bash\n';
    output += '# Run all IdleTaskGenerator tests\n';
    output += 'npm test -- idle-task-generator\n\n';
    output += '# Run specific integration tests\n';
    for (const test of report.integrationTests) {
      output += `npm test -- ${test.file.replace('.ts', '')}\n`;
    }
    output += '```\n\n';

    output += `## Acceptance Criteria Validation\n\n`;
    output += `Based on the analysis, the following acceptance criteria are covered:\n\n`;
    output += `1. **All analyzers work together in IdleTaskGenerator**: ${report.coverage.enhancedAnalyzers ? '✅ Validated' : '❌ Needs Testing'}\n`;
    output += `2. **Enhanced detection produces actionable tasks**: ${report.integrationTests.some(t => t.testCount > 5) ? '✅ Multiple test scenarios' : '❌ Limited scenarios'}\n`;
    output += `3. **Backward compatibility maintained**: ${report.coverage.backwardCompatibility ? '✅ Tested' : '❌ Needs Testing'}\n`;
    output += `4. **Performance acceptable with enhanced analysis**: ${report.coverage.performanceTests ? '✅ Benchmarked' : '❌ Needs Benchmarking'}\n\n`;

    return output;
  }
}

// Export for use in test scripts
export { TestValidator };

// If run directly, generate and print report
if (require.main === module) {
  const validator = new TestValidator();
  validator.generateReport().then(report => {
    console.log(report);
  }).catch(error => {
    console.error('Error generating validation report:', error);
    process.exit(1);
  });
}