/**
 * Visual Regression End-to-End Tests
 *
 * Complete end-to-end tests for the visual regression testing workflow:
 * - Test execution with visual comparisons
 * - Event flow from comparisons to test reports
 * - Integration with orchestrator and task management
 * - Error handling and recovery scenarios
 * - Performance and scalability validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { ApexOrchestrator } from '../index.js';
import { BrowserTool } from '../tools/browser-tool.js';
import { compareScreenshot } from '@apexcli/core';
import type { VisualComparisonEventData } from '@apexcli/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';

// Mock dependencies for focused testing
vi.mock('../store.js');

interface TestReport {
  taskId: string;
  agentName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  executionTime: number;
  visualTests: Array<{
    testId: string;
    passed: boolean;
    diffPercentage: number;
    threshold: number;
    baseline?: string;
    actual?: string;
    diffImage?: string;
    timestamp: Date;
  }>;
}

describe('Visual Regression End-to-End Workflow', () => {
  let orchestrator: ApexOrchestrator;
  let browserTool: BrowserTool;
  let mockStore: any;
  let testWorkspace: string;
  let visualEvents: VisualComparisonEventData[] = [];
  let testReport: TestReport;
  let createdFiles: string[] = [];

  beforeEach(async () => {
    vi.clearAllMocks();
    visualEvents = [];
    createdFiles = [];

    testWorkspace = path.join(__dirname, 'e2e-test-workspace');
    await fs.mkdir(testWorkspace, { recursive: true });

    // Initialize mock store with realistic behavior
    mockStore = {
      createTask: vi.fn(() => Promise.resolve('e2e-visual-task-456')),
      updateTask: vi.fn(() => Promise.resolve()),
      getTask: vi.fn(() => Promise.resolve({
        id: 'e2e-visual-task-456',
        description: 'End-to-end visual regression testing',
        status: 'running',
        agentName: 'tester-agent',
        workflowName: 'visual-testing-workflow',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      listTasks: vi.fn(() => Promise.resolve([])),
      deleteTask: vi.fn(() => Promise.resolve()),
    };

    // Create orchestrator with browser tool
    browserTool = new BrowserTool();
    orchestrator = new ApexOrchestrator({
      store: mockStore,
      browserTool,
    });

    // Set up task context for proper event correlation
    (orchestrator as any).currentTaskId = 'e2e-visual-task-456';
    (orchestrator as any).currentAgentName = 'tester-agent';

    // Connect browser tool to orchestrator for event emission
    browserTool.setEventEmitter(orchestrator);

    // Initialize test report structure
    testReport = {
      taskId: 'e2e-visual-task-456',
      agentName: 'tester-agent',
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      executionTime: 0,
      visualTests: []
    };

    // Set up comprehensive event capture for test report generation
    orchestrator.on('visual:comparison:passed', (event: VisualComparisonEventData) => {
      visualEvents.push(event);
      testReport.passedTests++;
      testReport.totalTests++;
      testReport.visualTests.push({
        testId: event.testId,
        passed: true,
        diffPercentage: event.diffPercentage,
        threshold: event.threshold,
        baseline: event.baseline,
        actual: event.actual,
        timestamp: event.timestamp,
      });
    });

    orchestrator.on('visual:comparison:failed', (event: VisualComparisonEventData) => {
      visualEvents.push(event);
      testReport.failedTests++;
      testReport.totalTests++;
      testReport.visualTests.push({
        testId: event.testId,
        passed: false,
        diffPercentage: event.diffPercentage,
        threshold: event.threshold,
        baseline: event.baseline,
        actual: event.actual,
        diffImage: event.diffImage,
        timestamp: event.timestamp,
      });
    });
  });

  afterEach(async () => {
    try {
      await orchestrator.shutdown();
    } catch (error) {
      // Ignore cleanup errors
    }

    // Clean up all created files
    await Promise.all(
      createdFiles.map(filePath =>
        fs.unlink(filePath).catch(() => {})
      )
    );

    try {
      await fs.rmdir(testWorkspace, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete Test Execution Workflow', () => {
    it('should execute a complete visual regression test suite', async () => {
      const startTime = Date.now();

      // Setup: Create baseline images for different UI components
      const components = [
        { name: 'header', size: [300, 80], color: { r: 50, g: 100, b: 200 } },
        { name: 'sidebar', size: [200, 400], color: { r: 240, g: 240, b: 240 } },
        { name: 'footer', size: [300, 60], color: { r: 100, g: 100, b: 100 } },
        { name: 'modal', size: [400, 300], color: { r: 255, g: 255, b: 255 } },
      ];

      const baselineDir = path.join(testWorkspace, 'baselines');
      await fs.mkdir(baselineDir, { recursive: true });

      const baselines: { [key: string]: string } = {};
      for (const component of components) {
        const [width, height] = component.size;
        const baselinePath = path.join(baselineDir, `${component.name}-baseline.png`);
        await createTestImageFile(baselinePath, width, height, component.color);
        baselines[component.name] = baselinePath;
        createdFiles.push(baselinePath);
      }

      // Test Execution: Simulate capturing screenshots and comparing
      const testScenarios = [
        { component: 'header', shouldPass: true, actualColor: { r: 50, g: 100, b: 200 } },   // Exact match
        { component: 'sidebar', shouldPass: false, actualColor: { r: 200, g: 200, b: 200 } }, // Different color
        { component: 'footer', shouldPass: true, actualColor: { r: 101, g: 101, b: 101 } },   // Very slight difference
        { component: 'modal', shouldPass: false, actualColor: { r: 230, g: 230, b: 230 } },   // Light gray instead of white
      ];

      // Mock browser screenshots for each scenario
      let mockCallCount = 0;
      vi.spyOn(browserTool as any, 'captureElementScreenshot').mockImplementation(() => {
        const scenario = testScenarios[mockCallCount++];
        const component = components.find(c => c.name === scenario.component)!;
        const [width, height] = component.size;
        return createImageBuffer(width, height, scenario.actualColor);
      });

      // Execute all visual comparisons
      const testPromises = testScenarios.map(async (scenario, index) => {
        const component = components.find(c => c.name === scenario.component)!;
        const diffPath = scenario.shouldPass
          ? undefined
          : path.join(testWorkspace, `${scenario.component}-diff.png`);

        if (diffPath) {
          createdFiles.push(diffPath);
        }

        return await browserTool.execute({
          operation: 'compareScreenshot',
          params: {
            baselinePath: baselines[scenario.component],
            testId: `visual-test-${scenario.component}`,
            threshold: 0.05, // 5% tolerance
            selector: `#${scenario.component}-component`,
            diffPath,
          }
        });
      });

      const results = await Promise.all(testPromises);
      testReport.executionTime = Date.now() - startTime;

      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verification: Check test execution results
      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result.success).toBe(true); // All operations should succeed
      });

      // Verify specific test outcomes
      expect((results[0].data as any).match).toBe(true);  // header should pass
      expect((results[1].data as any).match).toBe(false); // sidebar should fail
      expect((results[2].data as any).match).toBe(true);  // footer should pass (within threshold)
      expect((results[3].data as any).match).toBe(false); // modal should fail

      // Verify test report was built correctly
      expect(testReport.totalTests).toBe(4);
      expect(testReport.passedTests).toBe(2);
      expect(testReport.failedTests).toBe(2);
      expect(testReport.visualTests).toHaveLength(4);

      // Verify events were emitted properly
      expect(visualEvents).toHaveLength(4);
      const passedEvents = visualEvents.filter(e => e.passed);
      const failedEvents = visualEvents.filter(e => !e.passed);
      expect(passedEvents).toHaveLength(2);
      expect(failedEvents).toHaveLength(2);

      // Verify event correlation
      visualEvents.forEach(event => {
        expect(event.taskId).toBe('e2e-visual-task-456');
        expect(event.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should handle mixed test scenarios with different thresholds', async () => {
      // Create test scenarios with varying requirements
      const testCases = [
        {
          name: 'pixel-perfect-logo',
          threshold: 0.001, // Very strict
          baseColor: { r: 255, g: 0, b: 0 },
          actualColor: { r: 255, g: 0, b: 1 }, // Tiny difference
          expectedPass: false
        },
        {
          name: 'flexible-background',
          threshold: 0.2, // Lenient
          baseColor: { r: 200, g: 200, b: 200 },
          actualColor: { r: 180, g: 180, b: 180 }, // Moderate difference
          expectedPass: true
        },
        {
          name: 'standard-button',
          threshold: 0.1, // Standard
          baseColor: { r: 0, g: 128, b: 255 },
          actualColor: { r: 0, g: 128, b: 255 }, // Exact match
          expectedPass: true
        }
      ];

      // Create baselines
      const baselines: { [key: string]: string } = {};
      for (const testCase of testCases) {
        const baselinePath = await createTestImage(testCase.name, 100, 100, testCase.baseColor);
        baselines[testCase.name] = baselinePath;
      }

      // Mock screenshots
      let caseIndex = 0;
      vi.spyOn(browserTool as any, 'captureElementScreenshot').mockImplementation(() => {
        const testCase = testCases[caseIndex++];
        return createImageBuffer(100, 100, testCase.actualColor);
      });

      // Execute tests with different thresholds
      const results = await Promise.all(
        testCases.map(testCase =>
          browserTool.execute({
            operation: 'compareScreenshot',
            params: {
              baselinePath: baselines[testCase.name],
              testId: testCase.name,
              threshold: testCase.threshold,
              diffPath: testCase.expectedPass ? undefined : path.join(testWorkspace, `${testCase.name}-diff.png`)
            }
          })
        )
      );

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify results match expectations
      testCases.forEach((testCase, index) => {
        const result = results[index];
        expect(result.success).toBe(true);
        expect((result.data as any).match).toBe(testCase.expectedPass);
      });

      // Verify test report reflects the outcomes
      expect(testReport.totalTests).toBe(3);
      expect(testReport.passedTests).toBe(2);
      expect(testReport.failedTests).toBe(1);
    });
  });

  describe('Test Report Generation', () => {
    it('should generate comprehensive test reports with visual details', async () => {
      // Execute a series of visual tests
      const testData = [
        { name: 'navigation', pass: true },
        { name: 'content-area', pass: false },
        { name: 'controls', pass: true },
        { name: 'error-states', pass: false },
      ];

      // Create baselines and execute tests
      for (const test of testData) {
        const baseColor = test.pass
          ? { r: 128, g: 128, b: 128 }
          : { r: 100, g: 100, b: 100 };
        const actualColor = test.pass
          ? { r: 128, g: 128, b: 128 } // Same for passing tests
          : { r: 200, g: 50, b: 50 };  // Different for failing tests

        const baseline = await createTestImage(`${test.name}-baseline`, 150, 100, baseColor);

        vi.spyOn(browserTool as any, 'captureElementScreenshot').mockImplementationOnce(() =>
          createImageBuffer(150, 100, actualColor)
        );

        await browserTool.execute({
          operation: 'compareScreenshot',
          params: {
            baselinePath: baseline,
            testId: test.name,
            threshold: 0.1,
            diffPath: test.pass ? undefined : path.join(testWorkspace, `${test.name}-diff.png`)
          }
        });

        if (!test.pass) {
          createdFiles.push(path.join(testWorkspace, `${test.name}-diff.png`));
        }
      }

      // Wait for all events
      await new Promise(resolve => setTimeout(resolve, 150));

      // Generate final test report
      const finalReport = {
        ...testReport,
        summary: {
          passRate: (testReport.passedTests / testReport.totalTests) * 100,
          hasFailures: testReport.failedTests > 0,
          executionTimeMs: testReport.executionTime,
        },
        failedTests: testReport.visualTests.filter(t => !t.passed),
        artifacts: testReport.visualTests
          .filter(t => t.diffImage)
          .map(t => ({ testId: t.testId, diffImagePath: t.diffImage }))
      };

      // Verify comprehensive report structure
      expect(finalReport.totalTests).toBe(4);
      expect(finalReport.passedTests).toBe(2);
      expect(finalReport.failedTests).toBe(2);
      expect(finalReport.summary.passRate).toBe(50);
      expect(finalReport.summary.hasFailures).toBe(true);
      expect(finalReport.failedTests).toHaveLength(2);
      expect(finalReport.artifacts).toHaveLength(2);

      // Verify failed test details include diff information
      finalReport.failedTests.forEach(test => {
        expect(test.passed).toBe(false);
        expect(test.diffPercentage).toBeGreaterThan(0);
        expect(test.diffImage).toBeDefined();
      });

      // Verify test metadata is complete
      finalReport.visualTests.forEach(test => {
        expect(test.testId).toBeDefined();
        expect(test.timestamp).toBeInstanceOf(Date);
        expect(typeof test.passed).toBe('boolean');
        expect(typeof test.diffPercentage).toBe('number');
        expect(typeof test.threshold).toBe('number');
      });
    });
  });

  describe('Error Scenarios and Recovery', () => {
    it('should handle test failures gracefully and continue execution', async () => {
      const baseline = await createTestImage('error-test', 80, 80, { r: 100, g: 100, b: 100 });

      // Mock a series of operations with some failures
      let operationCount = 0;
      vi.spyOn(browserTool as any, 'captureElementScreenshot').mockImplementation(() => {
        operationCount++;
        if (operationCount === 2) {
          throw new Error('Simulated browser error');
        }
        return createImageBuffer(80, 80, { r: 100, g: 100, b: 100 });
      });

      // Execute multiple tests, including one that will fail
      const results = await Promise.all([
        browserTool.execute({
          operation: 'compareScreenshot',
          params: {
            baselinePath: baseline,
            testId: 'test-1',
            threshold: 0.1
          }
        }),
        browserTool.execute({
          operation: 'compareScreenshot',
          params: {
            baselinePath: baseline,
            testId: 'test-2-error',
            threshold: 0.1
          }
        }),
        browserTool.execute({
          operation: 'compareScreenshot',
          params: {
            baselinePath: baseline,
            testId: 'test-3',
            threshold: 0.1
          }
        })
      ]);

      // First and third tests should succeed, second should fail
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);

      // Error should be captured in the failing result
      expect(results[1].error).toContain('Simulated browser error');

      // Wait for events - only successful comparisons should emit visual events
      await new Promise(resolve => setTimeout(resolve, 100));

      // Only 2 visual comparison events should be emitted (excluding the error)
      expect(visualEvents).toHaveLength(2);
      expect(testReport.totalTests).toBe(2);
      expect(testReport.passedTests).toBe(2);
      expect(testReport.failedTests).toBe(0);
    });

    it('should handle baseline file issues and provide clear errors', async () => {
      const nonExistentBaseline = path.join(testWorkspace, 'does-not-exist.png');

      const result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: nonExistentBaseline,
          testId: 'missing-baseline-test',
          threshold: 0.1
        }
      });

      // Operation should fail with clear error message
      expect(result.success).toBe(false);
      expect(result.error).toContain('Baseline screenshot not found');

      // No visual events should be emitted for failed operations
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(visualEvents).toHaveLength(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large test suites efficiently', async () => {
      const testCount = 15;
      const baselines: string[] = [];

      // Create many baseline images
      for (let i = 0; i < testCount; i++) {
        const color = {
          r: Math.floor(i * 17) % 256,
          g: Math.floor(i * 23) % 256,
          b: Math.floor(i * 31) % 256,
        };
        const baseline = await createTestImage(`scale-test-${i}`, 100, 100, color);
        baselines.push(baseline);
      }

      // Mock screenshots to alternate between matching and non-matching
      let callIndex = 0;
      vi.spyOn(browserTool as any, 'captureElementScreenshot').mockImplementation(() => {
        const i = callIndex++;
        const shouldMatch = i % 3 === 0; // Every 3rd test matches
        const color = shouldMatch
          ? {
            r: Math.floor(i * 17) % 256,
            g: Math.floor(i * 23) % 256,
            b: Math.floor(i * 31) % 256,
          }
          : {
            r: (Math.floor(i * 17) + 50) % 256,
            g: (Math.floor(i * 23) + 50) % 256,
            b: (Math.floor(i * 31) + 50) % 256,
          };
        return createImageBuffer(100, 100, color);
      });

      // Execute all tests
      const startTime = Date.now();
      const promises = baselines.map((baseline, i) =>
        browserTool.execute({
          operation: 'compareScreenshot',
          params: {
            baselinePath: baseline,
            testId: `scale-test-${i}`,
            threshold: 0.1,
            diffPath: i % 3 === 0 ? undefined : path.join(testWorkspace, `scale-diff-${i}.png`)
          }
        })
      );

      const results = await Promise.all(promises);
      const executionTime = Date.now() - startTime;

      // All operations should complete successfully
      expect(results).toHaveLength(testCount);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete within reasonable time
      expect(executionTime).toBeLessThan(30000); // 30 seconds for 15 tests

      // Wait for all events
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify all tests were processed
      expect(testReport.totalTests).toBe(testCount);
      expect(testReport.passedTests).toBe(5); // Every 3rd test (0, 3, 6, 9, 12)
      expect(testReport.failedTests).toBe(10); // The rest

      // Clean up diff files
      for (let i = 1; i < testCount; i += 3) {
        createdFiles.push(path.join(testWorkspace, `scale-diff-${i}.png`));
      }
      for (let i = 2; i < testCount; i += 3) {
        createdFiles.push(path.join(testWorkspace, `scale-diff-${i}.png`));
      }
    });
  });

  // Helper functions
  async function createTestImage(
    name: string,
    width: number,
    height: number,
    color: { r: number; g: number; b: number }
  ): Promise<string> {
    const fileName = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;
    const filePath = path.join(testWorkspace, fileName);
    await createTestImageFile(filePath, width, height, color);
    createdFiles.push(filePath);
    return filePath;
  }

  async function createTestImageFile(
    filePath: string,
    width: number,
    height: number,
    color: { r: number; g: number; b: number }
  ): Promise<void> {
    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: color
      }
    }).png().toFile(filePath);
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