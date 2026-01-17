/**
 * Test Report Generator
 *
 * Collects visual comparison events and generates comprehensive test reports
 * with visual regression summaries and detailed comparison results.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  TestReport,
  TestResult,
  TestArtifact,
  TestSummary,
  VisualRegressionSummary,
  TestVisualComparison,
  VisualComparisonEventData,
} from '@apexcli/core';

export interface TestReportGeneratorOptions {
  /** Test suite name */
  testSuite: string;
  /** Task ID associated with the test execution */
  taskId?: string;
  /** Agent name executing the tests */
  agentName?: string;
  /** Environment where tests are running */
  environment?: string;
  /** Version of the application under test */
  version?: string;
}

export interface TestStartInfo {
  /** Unique test identifier */
  testId: string;
  /** Test name or title */
  name: string;
  /** Test category */
  category: 'functional' | 'visual' | 'integration' | 'unit' | 'e2e' | 'performance';
  /** Tags associated with the test */
  tags?: string[];
}

export interface TestCompleteInfo {
  /** Unique test identifier */
  testId: string;
  /** Test execution status */
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  /** Execution time in milliseconds */
  executionTime: number;
  /** Error details if the test failed */
  errorDetails?: string;
  /** Stack trace if the test failed */
  stackTrace?: string;
}

/**
 * TestReportGenerator collects test execution events and visual comparison results
 * to generate comprehensive test reports with visual regression analysis.
 */
export class TestReportGenerator {
  private options: TestReportGeneratorOptions;
  private startTime: number;
  private visualComparisons: TestVisualComparison[] = [];
  private testResults: TestResult[] = [];
  private artifacts: TestArtifact[] = [];
  private testStartTimes: Map<string, number> = new Map();
  private eventEmitter?: EventEmitter;

  constructor(options: TestReportGeneratorOptions) {
    this.options = options;
    this.startTime = Date.now();
  }

  /**
   * Connect to an event emitter to listen for visual comparison events
   */
  public connectEventEmitter(eventEmitter: EventEmitter): void {
    this.eventEmitter = eventEmitter;

    // Listen for visual comparison events
    eventEmitter.on('visual:comparison:passed', (event: VisualComparisonEventData) => {
      this.addVisualComparison(event);
    });

    eventEmitter.on('visual:comparison:failed', (event: VisualComparisonEventData) => {
      this.addVisualComparison(event);
    });
  }

  /**
   * Record the start of a test
   */
  public startTest(testInfo: TestStartInfo): void {
    this.testStartTimes.set(testInfo.testId, Date.now());
  }

  /**
   * Record the completion of a test
   */
  public completeTest(testInfo: TestCompleteInfo): void {
    const startTime = this.testStartTimes.get(testInfo.testId);
    const executionTime = startTime ? testInfo.executionTime || (Date.now() - startTime) : testInfo.executionTime || 0;

    // Find the corresponding visual comparison for this test
    const visualComparison = this.visualComparisons.find(vc => vc.testId === testInfo.testId);

    const testResult: TestResult = {
      testId: testInfo.testId,
      name: this.findTestName(testInfo.testId),
      category: this.findTestCategory(testInfo.testId),
      status: testInfo.status,
      executionTime,
      visualComparison,
      errorDetails: testInfo.errorDetails,
      stackTrace: testInfo.stackTrace,
      tags: this.findTestTags(testInfo.testId),
    };

    // Remove existing result if it exists (for updates)
    this.testResults = this.testResults.filter(result => result.testId !== testInfo.testId);
    this.testResults.push(testResult);

    this.testStartTimes.delete(testInfo.testId);
  }

  /**
   * Add a visual comparison result
   */
  public addVisualComparison(event: VisualComparisonEventData): void {
    const visualComparison: TestVisualComparison = {
      baseline: event.baseline,
      actual: event.actual,
      diffPercentage: event.diffPercentage,
      threshold: event.threshold,
      passed: event.passed,
      diffImage: event.diffImage,
      timestamp: event.timestamp,
      pageUrl: event.pageUrl,
      selector: event.selector,
    };

    // Remove existing comparison for the same test if it exists
    this.visualComparisons = this.visualComparisons.filter(vc => vc.testId !== event.testId);

    // Add testId to the comparison for internal tracking
    (visualComparison as any).testId = event.testId;

    this.visualComparisons.push(visualComparison);

    // Create artifacts for visual comparison images
    if (event.baseline) {
      this.addArtifact({
        type: 'screenshot',
        path: event.baseline,
        testId: event.testId,
        description: 'Baseline screenshot for visual comparison',
      });
    }

    if (event.actual) {
      this.addArtifact({
        type: 'screenshot',
        path: event.actual,
        testId: event.testId,
        description: 'Actual screenshot for visual comparison',
      });
    }

    if (event.diffImage) {
      this.addArtifact({
        type: 'diff',
        path: event.diffImage,
        testId: event.testId,
        description: `Diff image showing ${event.diffPercentage.toFixed(2)}% difference`,
      });
    }
  }

  /**
   * Add a test artifact (screenshot, log, etc.)
   */
  public addArtifact(artifact: TestArtifact): void {
    this.artifacts.push(artifact);
  }

  /**
   * Generate the comprehensive test report
   */
  public generateReport(): TestReport {
    const endTime = Date.now();
    const totalExecutionTime = endTime - this.startTime;

    const summary = this.generateSummary(totalExecutionTime);
    const visualRegression = this.generateVisualRegressionSummary();
    const reportId = this.generateReportId();

    const report: TestReport = {
      reportId,
      taskId: this.options.taskId,
      agentName: this.options.agentName,
      summary,
      visualRegression,
      visualComparisons: this.visualComparisons.length > 0 ? this.visualComparisons : undefined,
      testResults: this.testResults,
      artifacts: this.artifacts,
      generatedAt: new Date(),
      schemaVersion: '1.0.0',
    };

    return report;
  }

  /**
   * Generate test execution summary
   */
  private generateSummary(totalExecutionTime: number): TestSummary {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(result => result.status === 'passed').length;
    const failedTests = this.testResults.filter(result => result.status === 'failed').length;
    const skippedTests = this.testResults.filter(result => result.status === 'skipped').length;
    const pendingTests = this.testResults.filter(result => result.status === 'pending').length;

    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    return {
      testSuite: this.options.testSuite,
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      pendingTests,
      passRate,
      executionTime: totalExecutionTime,
      timestamp: new Date(this.startTime),
      environment: this.options.environment,
      version: this.options.version,
    };
  }

  /**
   * Generate visual regression summary statistics
   */
  private generateVisualRegressionSummary(): VisualRegressionSummary | undefined {
    if (this.visualComparisons.length === 0) {
      return undefined;
    }

    const totalComparisons = this.visualComparisons.length;
    const passedComparisons = this.visualComparisons.filter(vc => vc.passed).length;
    const failedComparisons = this.visualComparisons.filter(vc => !vc.passed).length;

    const totalDiff = this.visualComparisons.reduce((sum, vc) => sum + vc.diffPercentage, 0);
    const averageDiffPercentage = totalComparisons > 0 ? totalDiff / totalComparisons : 0;

    const thresholdViolations = failedComparisons; // Failed comparisons are threshold violations
    const diffImageCount = this.visualComparisons.filter(vc => vc.diffImage).length;

    const maxDiffPercentage = Math.max(...this.visualComparisons.map(vc => vc.diffPercentage));

    // Calculate baseline coverage (percentage of tests that have baseline images)
    const testsWithBaselines = this.visualComparisons.filter(vc => vc.baseline).length;
    const baselineCoverage = totalComparisons > 0 ? (testsWithBaselines / totalComparisons) * 100 : 0;

    return {
      totalComparisons,
      passedComparisons,
      failedComparisons,
      averageDiffPercentage,
      thresholdViolations,
      diffImageCount,
      maxDiffPercentage: totalComparisons > 0 ? maxDiffPercentage : undefined,
      baselineCoverage: baselineCoverage > 0 ? baselineCoverage : undefined,
    };
  }

  /**
   * Generate a unique report ID
   */
  private generateReportId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const taskId = this.options.taskId ? `-${this.options.taskId.slice(-8)}` : '';
    return `test-report-${timestamp}${taskId}`;
  }

  /**
   * Find test name from started tests or use testId as fallback
   */
  private findTestName(testId: string): string {
    // In a real implementation, this would look up the test name from recorded test starts
    // For now, we'll use the testId as the name
    return testId;
  }

  /**
   * Find test category from started tests or infer from testId
   */
  private findTestCategory(testId: string): 'functional' | 'visual' | 'integration' | 'unit' | 'e2e' | 'performance' {
    // Check if this test has a visual comparison
    const hasVisualComparison = this.visualComparisons.some(vc => (vc as any).testId === testId);
    if (hasVisualComparison) {
      return 'visual';
    }

    // Default inference based on testId patterns
    if (testId.includes('visual') || testId.includes('screenshot')) {
      return 'visual';
    } else if (testId.includes('e2e') || testId.includes('end-to-end')) {
      return 'e2e';
    } else if (testId.includes('integration')) {
      return 'integration';
    } else if (testId.includes('unit')) {
      return 'unit';
    } else if (testId.includes('performance') || testId.includes('perf')) {
      return 'performance';
    }

    return 'functional';
  }

  /**
   * Find test tags from started tests
   */
  private findTestTags(testId: string): string[] | undefined {
    // In a real implementation, this would look up tags from recorded test starts
    return undefined;
  }

  /**
   * Reset the generator for a new test session
   */
  public reset(): void {
    this.startTime = Date.now();
    this.visualComparisons = [];
    this.testResults = [];
    this.artifacts = [];
    this.testStartTimes.clear();
  }

  /**
   * Get current statistics without generating full report
   */
  public getStats() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(result => result.status === 'passed').length;
    const failedTests = this.testResults.filter(result => result.status === 'failed').length;
    const visualComparisons = this.visualComparisons.length;
    const failedComparisons = this.visualComparisons.filter(vc => !vc.passed).length;

    return {
      totalTests,
      passedTests,
      failedTests,
      visualComparisons,
      failedComparisons,
      artifacts: this.artifacts.length,
    };
  }
}