/**
 * Test Coverage Report for Visual Regression Testing
 *
 * This test demonstrates and validates the complete visual regression testing
 * workflow coverage including:
 * - Test execution with compareScreenshot() helper
 * - Event emission and handling for visual comparisons
 * - Failed comparison diff details and reporting
 * - Integration with test reporting systems
 * - End-to-end workflow validation
 *
 * This serves both as a test and as documentation of the complete workflow.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { ApexOrchestrator } from '../index.js';
import { BrowserTool } from '../tools/browser-tool.js';
import { compareScreenshot, CompareOptions, ComparisonResult } from '@apexcli/core';
import type { VisualComparisonEventData } from '@apexcli/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';

// Mock dependencies for controlled testing
vi.mock('../store.js');

/**
 * Test Coverage Report Interface
 * Defines the structure of reports that test runners can generate
 */
interface TestCoverageReport {
  summary: {
    testSuite: string;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    passRate: number;
    executionTime: number;
    timestamp: Date;
  };
  visualRegression: {
    totalComparisons: number;
    passedComparisons: number;
    failedComparisons: number;
    averageDiffPercentage: number;
    thresholdViolations: number;
    diffImageCount: number;
  };
  testDetails: Array<{
    testId: string;
    category: 'functional' | 'visual' | 'integration';
    status: 'passed' | 'failed' | 'skipped';
    executionTime: number;
    visualComparison?: {
      baseline?: string;
      actual?: string;
      diffPercentage: number;
      threshold: number;
      passed: boolean;
      diffImage?: string;
    };
    errorDetails?: string;
  }>;
  artifacts: Array<{
    type: 'screenshot' | 'diff' | 'log';
    path: string;
    testId: string;
    description: string;
  }>;
}

describe('Visual Regression Test Coverage Report', () => {
  let orchestrator: ApexOrchestrator;
  let browserTool: BrowserTool;
  let mockStore: any;
  let reportWorkspace: string;
  let testCoverage: TestCoverageReport;
  let visualEvents: VisualComparisonEventData[] = [];
  let createdFiles: string[] = [];

  beforeAll(async () => {
    // Setup test workspace
    reportWorkspace = path.join(__dirname, 'coverage-report-workspace');
    await fs.mkdir(reportWorkspace, { recursive: true });

    // Initialize mock store
    mockStore = {
      createTask: vi.fn(() => Promise.resolve('coverage-test-task-789')),
      updateTask: vi.fn(() => Promise.resolve()),
      getTask: vi.fn(() => Promise.resolve({
        id: 'coverage-test-task-789',
        description: 'Test coverage validation task',
        status: 'running',
        agentName: 'coverage-tester',
        workflowName: 'visual-regression-coverage',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      listTasks: vi.fn(() => Promise.resolve([])),
      deleteTask: vi.fn(() => Promise.resolve()),
    };

    // Create orchestrator and browser tool
    browserTool = new BrowserTool();
    orchestrator = new ApexOrchestrator({
      store: mockStore,
      browserTool,
    });

    // Set up task context
    (orchestrator as any).currentTaskId = 'coverage-test-task-789';
    (orchestrator as any).currentAgentName = 'coverage-tester';

    // Connect components for event flow
    browserTool.setEventEmitter(orchestrator);

    // Initialize coverage report
    const startTime = Date.now();
    testCoverage = {
      summary: {
        testSuite: 'Visual Regression Coverage Tests',
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        passRate: 0,
        executionTime: 0,
        timestamp: new Date(),
      },
      visualRegression: {
        totalComparisons: 0,
        passedComparisons: 0,
        failedComparisons: 0,
        averageDiffPercentage: 0,
        thresholdViolations: 0,
        diffImageCount: 0,
      },
      testDetails: [],
      artifacts: [],
    };

    // Set up comprehensive event tracking for coverage report
    orchestrator.on('visual:comparison:passed', (event: VisualComparisonEventData) => {
      visualEvents.push(event);
      testCoverage.visualRegression.totalComparisons++;
      testCoverage.visualRegression.passedComparisons++;

      // Update test details
      const testDetail = testCoverage.testDetails.find(t => t.testId === event.testId);
      if (testDetail) {
        testDetail.status = 'passed';
        testDetail.visualComparison = {
          baseline: event.baseline,
          actual: event.actual,
          diffPercentage: event.diffPercentage,
          threshold: event.threshold,
          passed: true,
        };
      }
    });

    orchestrator.on('visual:comparison:failed', (event: VisualComparisonEventData) => {
      visualEvents.push(event);
      testCoverage.visualRegression.totalComparisons++;
      testCoverage.visualRegression.failedComparisons++;

      if (event.diffImage) {
        testCoverage.visualRegression.diffImageCount++;
        testCoverage.artifacts.push({
          type: 'diff',
          path: event.diffImage,
          testId: event.testId,
          description: `Diff image showing ${event.diffPercentage.toFixed(2)}% difference`
        });
      }

      // Update test details
      const testDetail = testCoverage.testDetails.find(t => t.testId === event.testId);
      if (testDetail) {
        testDetail.status = 'failed';
        testDetail.visualComparison = {
          baseline: event.baseline,
          actual: event.actual,
          diffPercentage: event.diffPercentage,
          threshold: event.threshold,
          passed: false,
          diffImage: event.diffImage,
        };
      }
    });
  });

  afterAll(async () => {
    // Clean up
    try {
      await orchestrator.shutdown();
    } catch (error) {
      // Ignore cleanup errors
    }

    // Remove created files
    await Promise.all(
      createdFiles.map(filePath =>
        fs.unlink(filePath).catch(() => {})
      )
    );

    try {
      await fs.rmdir(reportWorkspace, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Coverage Test Suite: compareScreenshot() Helper Usage', () => {
    it('should demonstrate basic compareScreenshot() usage in tests', async () => {
      const testId = 'basic-usage-test';
      recordTestStart(testId, 'visual');

      // Test: Basic compareScreenshot() usage
      const baseline = await createTestImage('basic-baseline.png', 100, 100, { r: 128, g: 128, b: 128 });
      const actual = await createTestImage('basic-actual.png', 100, 100, { r: 128, g: 128, b: 128 });

      const result: ComparisonResult = await compareScreenshot(baseline, actual);

      // Coverage: Basic comparison result validation
      expect(result.match).toBe(true);
      expect(result.diffPercentage).toBe(0);
      expect(result.similarity).toBe(1);
      expect(result.totalPixels).toBe(10000);
      expect(result.differentPixels).toBe(0);

      recordTestSuccess(testId, Date.now());
    });

    it('should demonstrate threshold configuration in tests', async () => {
      const testId = 'threshold-config-test';
      recordTestStart(testId, 'visual');

      const baseline = await createTestImage('threshold-baseline.png', 50, 50, { r: 200, g: 100, b: 50 });
      const slightly_different = await createTestImage('threshold-different.png', 50, 50, { r: 205, g: 105, b: 55 });

      // Coverage: Custom threshold configuration
      const options: CompareOptions = {
        threshold: 0.05, // 5% tolerance
        outputDiff: true,
        diffOutputPath: path.join(reportWorkspace, 'threshold-diff.png')
      };

      const result = await compareScreenshot(baseline, slightly_different, options);

      // Coverage: Threshold behavior validation
      expect(result.match).toBe(true); // Should pass with 5% threshold
      expect(result.diffPercentage).toBeGreaterThan(0);
      expect(result.diffPercentage).toBeLessThan(5);

      if (result.diffImagePath) {
        createdFiles.push(result.diffImagePath);
      }

      recordTestSuccess(testId, Date.now());
    });

    it('should demonstrate base64 image support', async () => {
      const testId = 'base64-support-test';
      recordTestStart(testId, 'visual');

      const imagePath = await createTestImage('base64-test.png', 75, 75, { r: 150, g: 200, b: 100 });

      // Coverage: Base64 conversion and usage
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

      const result = await compareScreenshot(imagePath, base64Image);

      // Coverage: Base64 comparison validation
      expect(result.match).toBe(true);
      expect(result.similarity).toBe(1);

      recordTestSuccess(testId, Date.now());
    });
  });

  describe('Coverage Test Suite: Browser Tool Integration', () => {
    it('should demonstrate visual comparison events emission', async () => {
      const testId = 'event-emission-test';
      recordTestStart(testId, 'integration');

      const baseline = await createTestImage('event-baseline.png', 120, 80, { r: 100, g: 150, b: 200 });

      // Mock browser screenshot
      vi.spyOn(browserTool as any, 'captureElementScreenshot').mockImplementationOnce(() =>
        createImageBuffer(120, 80, { r: 100, g: 150, b: 200 }) // Matching
      );

      // Coverage: Browser tool visual comparison
      const result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baseline,
          testId: testId,
          threshold: 0.1,
          selector: '#test-element'
        }
      });

      expect(result.success).toBe(true);
      expect((result.data as any).match).toBe(true);

      // Wait for event emission
      await new Promise(resolve => setTimeout(resolve, 50));

      // Coverage: Event emission validation
      const testEvent = visualEvents.find(e => e.testId === testId);
      expect(testEvent).toBeDefined();
      expect(testEvent!.passed).toBe(true);
      expect(testEvent!.taskId).toBe('coverage-test-task-789');

      recordTestSuccess(testId, Date.now());
    });

    it('should demonstrate failed comparison with diff details', async () => {
      const testId = 'failed-comparison-test';
      recordTestStart(testId, 'integration');

      const baseline = await createTestImage('failed-baseline.png', 90, 90, { r: 255, g: 0, b: 0 });
      const diffPath = path.join(reportWorkspace, 'failed-diff.png');

      // Mock browser screenshot with different content
      vi.spyOn(browserTool as any, 'captureElementScreenshot').mockImplementationOnce(() =>
        createImageBuffer(90, 90, { r: 0, g: 255, b: 0 }) // Green instead of red
      );

      // Coverage: Failed comparison with diff generation
      const result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baseline,
          testId: testId,
          threshold: 0.1,
          diffPath: diffPath
        }
      });

      expect(result.success).toBe(true); // Operation succeeds
      expect((result.data as any).match).toBe(false); // But comparison fails

      // Wait for event emission
      await new Promise(resolve => setTimeout(resolve, 50));

      // Coverage: Failed comparison event validation
      const failedEvent = visualEvents.find(e => e.testId === testId && !e.passed);
      expect(failedEvent).toBeDefined();
      expect(failedEvent!.diffImage).toBe(diffPath);
      expect(failedEvent!.diffPercentage).toBeGreaterThan(90); // Should be very different

      createdFiles.push(diffPath);
      recordTestFailure(testId, Date.now(), 'Visual comparison failed');
    });
  });

  describe('Coverage Test Suite: End-to-End Workflow', () => {
    it('should demonstrate complete test workflow with reporting', async () => {
      const workflowTests = [
        { name: 'header-component', shouldPass: true, color: { r: 50, g: 50, b: 50 } },
        { name: 'navigation-bar', shouldPass: false, color: { r: 100, g: 100, b: 100 } },
        { name: 'content-area', shouldPass: true, color: { r: 240, g: 240, b: 240 } },
        { name: 'footer-section', shouldPass: false, color: { r: 200, g: 200, b: 200 } },
      ];

      const startTime = Date.now();

      // Execute complete workflow
      for (const test of workflowTests) {
        const testId = `workflow-${test.name}`;
        recordTestStart(testId, 'visual');

        const baseline = await createTestImage(`${test.name}-baseline.png`, 150, 100, test.color);

        // Mock appropriate screenshot result
        const actualColor = test.shouldPass
          ? test.color // Same color for passing tests
          : { r: test.color.r + 50, g: test.color.g + 50, b: test.color.b + 50 }; // Different for failing

        vi.spyOn(browserTool as any, 'captureElementScreenshot').mockImplementationOnce(() =>
          createImageBuffer(150, 100, actualColor)
        );

        const diffPath = test.shouldPass
          ? undefined
          : path.join(reportWorkspace, `${test.name}-workflow-diff.png`);

        const result = await browserTool.execute({
          operation: 'compareScreenshot',
          params: {
            baselinePath: baseline,
            testId: testId,
            threshold: 0.1,
            diffPath: diffPath
          }
        });

        if (diffPath) {
          createdFiles.push(diffPath);
        }

        if (test.shouldPass) {
          expect((result.data as any).match).toBe(true);
          recordTestSuccess(testId, Date.now());
        } else {
          expect((result.data as any).match).toBe(false);
          recordTestFailure(testId, Date.now(), 'Visual regression detected');
        }
      }

      const executionTime = Date.now() - startTime;

      // Wait for all events
      await new Promise(resolve => setTimeout(resolve, 200));

      // Coverage: Complete workflow validation
      expect(testCoverage.visualRegression.totalComparisons).toBeGreaterThan(0);
      expect(testCoverage.visualRegression.passedComparisons).toBe(2);
      expect(testCoverage.visualRegression.failedComparisons).toBe(2);
      expect(testCoverage.summary.totalTests).toBeGreaterThan(workflowTests.length);

      // Update final metrics
      testCoverage.summary.executionTime = executionTime;
      testCoverage.summary.passRate = (testCoverage.summary.passedTests / testCoverage.summary.totalTests) * 100;

      if (testCoverage.visualRegression.totalComparisons > 0) {
        const totalDiff = visualEvents.reduce((sum, event) => sum + event.diffPercentage, 0);
        testCoverage.visualRegression.averageDiffPercentage = totalDiff / testCoverage.visualRegression.totalComparisons;
      }
    });

    it('should generate comprehensive coverage report', async () => {
      // Coverage: Final report generation and validation
      expect(testCoverage.summary.totalTests).toBeGreaterThan(0);
      expect(testCoverage.visualRegression.totalComparisons).toBeGreaterThan(0);
      expect(testCoverage.testDetails.length).toBeGreaterThan(0);

      // Verify report structure completeness
      expect(testCoverage.summary).toHaveProperty('testSuite');
      expect(testCoverage.summary).toHaveProperty('passRate');
      expect(testCoverage.summary).toHaveProperty('executionTime');

      expect(testCoverage.visualRegression).toHaveProperty('totalComparisons');
      expect(testCoverage.visualRegression).toHaveProperty('averageDiffPercentage');
      expect(testCoverage.visualRegression).toHaveProperty('diffImageCount');

      // Verify test details include visual comparison data
      const visualTestDetails = testCoverage.testDetails.filter(t => t.category === 'visual');
      expect(visualTestDetails.length).toBeGreaterThan(0);

      visualTestDetails.forEach(test => {
        expect(test.visualComparison).toBeDefined();
        expect(typeof test.visualComparison!.diffPercentage).toBe('number');
        expect(typeof test.visualComparison!.threshold).toBe('number');
        expect(typeof test.visualComparison!.passed).toBe('boolean');
      });

      // Verify artifacts are properly recorded
      const diffArtifacts = testCoverage.artifacts.filter(a => a.type === 'diff');
      expect(diffArtifacts.length).toBe(testCoverage.visualRegression.diffImageCount);

      // Output final coverage report (for documentation)
      console.log('\n=== VISUAL REGRESSION TEST COVERAGE REPORT ===');
      console.log(`Test Suite: ${testCoverage.summary.testSuite}`);
      console.log(`Total Tests: ${testCoverage.summary.totalTests}`);
      console.log(`Passed: ${testCoverage.summary.passedTests}, Failed: ${testCoverage.summary.failedTests}`);
      console.log(`Pass Rate: ${testCoverage.summary.passRate.toFixed(1)}%`);
      console.log(`Visual Comparisons: ${testCoverage.visualRegression.totalComparisons}`);
      console.log(`Average Diff: ${testCoverage.visualRegression.averageDiffPercentage.toFixed(2)}%`);
      console.log(`Diff Images Generated: ${testCoverage.visualRegression.diffImageCount}`);
      console.log('=== END REPORT ===\n');
    });
  });

  // Helper functions for test coverage tracking
  function recordTestStart(testId: string, category: 'functional' | 'visual' | 'integration'): void {
    testCoverage.summary.totalTests++;
    testCoverage.testDetails.push({
      testId,
      category,
      status: 'passed', // Will be updated based on result
      executionTime: Date.now(),
    });
  }

  function recordTestSuccess(testId: string, endTime: number): void {
    testCoverage.summary.passedTests++;
    const testDetail = testCoverage.testDetails.find(t => t.testId === testId);
    if (testDetail) {
      testDetail.status = 'passed';
      testDetail.executionTime = endTime - testDetail.executionTime;
    }
  }

  function recordTestFailure(testId: string, endTime: number, error: string): void {
    testCoverage.summary.failedTests++;
    const testDetail = testCoverage.testDetails.find(t => t.testId === testId);
    if (testDetail) {
      testDetail.status = 'failed';
      testDetail.executionTime = endTime - testDetail.executionTime;
      testDetail.errorDetails = error;
    }
  }

  // Helper functions for test image creation
  async function createTestImage(
    filename: string,
    width: number,
    height: number,
    color: { r: number; g: number; b: number }
  ): Promise<string> {
    const filePath = path.join(reportWorkspace, filename);
    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: color
      }
    }).png().toFile(filePath);
    createdFiles.push(filePath);
    return filePath;
  }

  async function createImageBuffer(
    width: number,
    height: number,
    color: { r: number; g: number; b: number }
  ): Promise<Buffer> {
    return await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: color
      }
    }).png().toBuffer();
  }
});