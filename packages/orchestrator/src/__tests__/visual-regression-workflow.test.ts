/**
 * Visual Regression Test Workflow Integration Tests
 *
 * Tests the complete visual regression testing workflow including:
 * - compareScreenshot() helper integration with test framework
 * - Visual comparison events emission and handling
 * - Failed comparison diff details in events
 * - Test report generation with visual results
 * - End-to-end workflow verification
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { ApexOrchestrator } from '../index.js';
import { BrowserTool } from '../tools/browser-tool.js';
import { compareScreenshot, CompareOptions } from '@apexcli/core';
import type { VisualComparisonEventData } from '@apexcli/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';

// Mock dependencies for controlled testing
vi.mock('../store.js');

describe('Visual Regression Test Workflow Integration', () => {
  let orchestrator: ApexOrchestrator;
  let browserTool: BrowserTool;
  let mockStore: any;
  let testFixturesDir: string;
  let visualEventCapture: VisualComparisonEventData[];
  let createdFiles: string[] = [];

  beforeAll(async () => {
    testFixturesDir = path.join(__dirname, 'visual-test-fixtures');
    await fs.mkdir(testFixturesDir, { recursive: true });
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    visualEventCapture = [];
    createdFiles = [];

    // Create mock store
    mockStore = {
      createTask: vi.fn(() => Promise.resolve('visual-test-task-123')),
      updateTask: vi.fn(() => Promise.resolve()),
      getTask: vi.fn(() => Promise.resolve({
        id: 'visual-test-task-123',
        description: 'Visual regression test task',
        status: 'running',
        agentName: 'tester-agent',
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

    // Set up task context
    (orchestrator as any).currentTaskId = 'visual-test-task-123';
    (orchestrator as any).currentAgentName = 'tester-agent';

    // Set up visual comparison event capture
    orchestrator.on('visual:comparison:passed', (event) => {
      visualEventCapture.push({ ...event, result: 'passed' });
    });

    orchestrator.on('visual:comparison:failed', (event) => {
      visualEventCapture.push({ ...event, result: 'failed' });
    });

    // Inject orchestrator's event emitter into browser tool
    browserTool.setEventEmitter(orchestrator);
  });

  afterEach(async () => {
    try {
      await orchestrator.shutdown();
    } catch (error) {
      // Ignore cleanup errors
    }

    // Clean up created files
    await Promise.all(
      createdFiles.map(filePath =>
        fs.unlink(filePath).catch(() => {}) // Ignore errors
      )
    );
  });

  describe('compareScreenshot() Helper Integration', () => {
    it('should provide compareScreenshot helper for test workflows', async () => {
      // Verify the helper function exists and is accessible
      expect(compareScreenshot).toBeDefined();
      expect(typeof compareScreenshot).toBe('function');

      // Create test images
      const baselinePath = await createTestImage(100, 100, { r: 255, g: 0, b: 0 }); // Red
      const actualPath = await createTestImage(100, 100, { r: 255, g: 0, b: 0 }); // Identical red

      // Test helper with matching images
      const result = await compareScreenshot(baselinePath, actualPath);

      expect(result).toBeDefined();
      expect(result.match).toBe(true);
      expect(result.diffPercentage).toBe(0);
      expect(result.similarity).toBe(1);
      expect(result.totalPixels).toBe(10000); // 100x100
      expect(result.differentPixels).toBe(0);
    });

    it('should handle threshold configuration in test workflows', async () => {
      const baselinePath = await createTestImage(50, 50, { r: 255, g: 0, b: 0 }); // Red
      const actualPath = await createTestImage(50, 50, { r: 254, g: 1, b: 1 }); // Very slightly different

      // Test with strict threshold (should fail)
      const strictResult = await compareScreenshot(baselinePath, actualPath, {
        threshold: 0.001 // 0.1% tolerance
      });

      expect(strictResult.match).toBe(false);
      expect(strictResult.diffPercentage).toBeGreaterThan(0);

      // Test with lenient threshold (should pass)
      const lenientResult = await compareScreenshot(baselinePath, actualPath, {
        threshold: 0.5 // 50% tolerance
      });

      expect(lenientResult.match).toBe(true);
      expect(lenientResult.diffPercentage).toBeGreaterThan(0); // Still different, but within threshold
    });

    it('should generate diff images for failed comparisons', async () => {
      const baselinePath = await createTestImage(50, 50, { r: 255, g: 0, b: 0 }); // Red
      const actualPath = await createTestImage(50, 50, { r: 0, g: 0, b: 255 }); // Blue
      const diffPath = path.join(testFixturesDir, `test-diff-${Date.now()}.png`);

      const result = await compareScreenshot(baselinePath, actualPath, {
        threshold: 0.1,
        outputDiff: true,
        diffOutputPath: diffPath
      });

      expect(result.match).toBe(false);
      expect(result.diffImageData).toBeDefined();
      expect(result.diffImageData).toMatch(/^data:image\/png;base64,/);
      expect(result.diffImagePath).toBe(diffPath);

      // Verify diff file was created
      const diffExists = await fs.access(diffPath).then(() => true).catch(() => false);
      expect(diffExists).toBe(true);

      createdFiles.push(diffPath);
    });
  });

  describe('Visual Comparison Events Emission', () => {
    it('should emit visual:comparison:passed events for matching screenshots', async () => {
      const baselinePath = await createTestImage(100, 100, { r: 0, g: 255, b: 0 }); // Green

      // Simulate browser compareScreenshot operation
      const result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath,
          threshold: 0.1,
          testId: 'test-passed-event-1'
        }
      });

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify the comparison succeeded
      expect(result.success).toBe(true);
      expect((result.data as any).match).toBe(true);

      // Verify event was emitted
      expect(visualEventCapture).toHaveLength(1);
      expect(visualEventCapture[0].result).toBe('passed');
      expect(visualEventCapture[0].testId).toBe('test-passed-event-1');
      expect(visualEventCapture[0].passed).toBe(true);
      expect(visualEventCapture[0].taskId).toBe('visual-test-task-123');
    });

    it('should emit visual:comparison:failed events for mismatched screenshots', async () => {
      const baselinePath = await createTestImage(100, 100, { r: 255, g: 0, b: 0 }); // Red
      const diffPath = path.join(testFixturesDir, `failed-diff-${Date.now()}.png`);

      // Create a browser page and take a different screenshot
      // Since this is a test, we'll mock the browser page screenshot to return blue pixels
      vi.spyOn(browserTool as any, 'captureElementScreenshot').mockImplementation(() => {
        return createImageBuffer(100, 100, { r: 0, g: 0, b: 255 }); // Blue
      });

      const result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath,
          diffPath,
          threshold: 0.1,
          testId: 'test-failed-event-1'
        }
      });

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify the comparison failed
      expect(result.success).toBe(true); // Operation succeeded, but comparison failed
      expect((result.data as any).match).toBe(false);

      // Verify event was emitted
      expect(visualEventCapture).toHaveLength(1);
      expect(visualEventCapture[0].result).toBe('failed');
      expect(visualEventCapture[0].testId).toBe('test-failed-event-1');
      expect(visualEventCapture[0].passed).toBe(false);
      expect(visualEventCapture[0].diffImage).toBe(diffPath);
      expect(visualEventCapture[0].diffPercentage).toBeGreaterThan(90); // Should be very different

      createdFiles.push(diffPath);
    });

    it('should include comprehensive diff details in failed comparison events', async () => {
      const baselinePath = await createTestImage(50, 50, { r: 128, g: 128, b: 128 }); // Gray
      const diffPath = path.join(testFixturesDir, `detailed-diff-${Date.now()}.png`);

      // Mock browser screenshot to return different image
      vi.spyOn(browserTool as any, 'captureElementScreenshot').mockImplementation(() => {
        return createImageBuffer(50, 50, { r: 200, g: 100, b: 50 }); // Different color
      });

      const result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath,
          diffPath,
          threshold: 0.05,
          testId: 'detailed-diff-test',
          selector: '#test-element'
        }
      });

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(visualEventCapture).toHaveLength(1);
      const event = visualEventCapture[0];

      // Verify comprehensive event details
      expect(event.testId).toBe('detailed-diff-test');
      expect(event.baseline).toBe(baselinePath);
      expect(event.actual).toBe('element-screenshot-#test-element');
      expect(event.diffImage).toBe(diffPath);
      expect(event.passed).toBe(false);
      expect(event.diffPercentage).toBeGreaterThan(0);
      expect(event.threshold).toBe(5); // 0.05 * 100
      expect(event.pageUrl).toBe('about:blank'); // Default page URL
      expect(event.selector).toBe('#test-element');
      expect(event.taskId).toBe('visual-test-task-123');
      expect(event.timestamp).toBeInstanceOf(Date);

      createdFiles.push(diffPath);
    });
  });

  describe('Test Workflow Integration', () => {
    it('should support complete visual regression test workflow', async () => {
      // Step 1: Create baseline images for different test scenarios
      const scenarios = [
        { name: 'homepage', color: { r: 255, g: 255, b: 255 } }, // White
        { name: 'dashboard', color: { r: 240, g: 240, b: 240 } }, // Light gray
        { name: 'profile', color: { r: 220, g: 220, b: 255 } }    // Light blue
      ];

      const baselineDir = path.join(testFixturesDir, 'baselines');
      await fs.mkdir(baselineDir, { recursive: true });

      const baselines: { [key: string]: string } = {};
      for (const scenario of scenarios) {
        const baselinePath = path.join(baselineDir, `${scenario.name}-baseline.png`);
        await createTestImageFile(baselinePath, 200, 150, scenario.color);
        baselines[scenario.name] = baselinePath;
        createdFiles.push(baselinePath);
      }

      // Step 2: Simulate test execution with some passing and some failing tests
      const testResults = [];
      let testIndex = 0;

      // Homepage test - should pass (identical)
      vi.spyOn(browserTool as any, 'captureElementScreenshot')
        .mockImplementationOnce(() => createImageBuffer(200, 150, { r: 255, g: 255, b: 255 }));

      let result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baselines.homepage,
          testId: `workflow-test-${++testIndex}`,
          threshold: 0.05
        }
      });
      testResults.push({ name: 'homepage', result });

      // Dashboard test - should fail (different color)
      vi.spyOn(browserTool as any, 'captureElementScreenshot')
        .mockImplementationOnce(() => createImageBuffer(200, 150, { r: 200, g: 200, b: 200 }));

      result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baselines.dashboard,
          testId: `workflow-test-${++testIndex}`,
          threshold: 0.05,
          diffPath: path.join(testFixturesDir, 'dashboard-diff.png')
        }
      });
      testResults.push({ name: 'dashboard', result });
      createdFiles.push(path.join(testFixturesDir, 'dashboard-diff.png'));

      // Profile test - should pass (very similar, within threshold)
      vi.spyOn(browserTool as any, 'captureElementScreenshot')
        .mockImplementationOnce(() => createImageBuffer(200, 150, { r: 221, g: 221, b: 254 }));

      result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baselines.profile,
          testId: `workflow-test-${++testIndex}`,
          threshold: 0.1 // More lenient
        }
      });
      testResults.push({ name: 'profile', result });

      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 3: Verify test results
      expect(testResults).toHaveLength(3);

      // Homepage should pass
      expect(testResults[0].result.success).toBe(true);
      expect((testResults[0].result.data as any).match).toBe(true);

      // Dashboard should fail comparison but operation should succeed
      expect(testResults[1].result.success).toBe(true);
      expect((testResults[1].result.data as any).match).toBe(false);

      // Profile should pass (within threshold)
      expect(testResults[2].result.success).toBe(true);
      expect((testResults[2].result.data as any).match).toBe(true);

      // Step 4: Verify events were emitted correctly
      expect(visualEventCapture).toHaveLength(3);

      const passedEvents = visualEventCapture.filter(e => e.result === 'passed');
      const failedEvents = visualEventCapture.filter(e => e.result === 'failed');

      expect(passedEvents).toHaveLength(2); // homepage and profile
      expect(failedEvents).toHaveLength(1); // dashboard

      // Verify failed event has diff details
      const failedEvent = failedEvents[0];
      expect(failedEvent.diffImage).toBeDefined();
      expect(failedEvent.diffPercentage).toBeGreaterThan(0);

      // Step 5: Verify all events have proper task correlation
      visualEventCapture.forEach(event => {
        expect(event.taskId).toBe('visual-test-task-123');
        expect(event.timestamp).toBeInstanceOf(Date);
      });
    });
  });

  describe('Test Report Integration', () => {
    it('should provide data structure for test report generation', async () => {
      // Simulate multiple visual comparisons
      const tests = [
        { name: 'button-hover', shouldPass: true },
        { name: 'modal-open', shouldPass: false },
        { name: 'form-validation', shouldPass: true }
      ];

      for (const test of tests) {
        const baselinePath = await createTestImage(100, 100, { r: 100, g: 100, b: 100 });

        // Mock screenshot to match or not match based on test configuration
        const mockColor = test.shouldPass
          ? { r: 100, g: 100, b: 100 } // Same as baseline
          : { r: 200, g: 50, b: 50 };  // Different from baseline

        vi.spyOn(browserTool as any, 'captureElementScreenshot')
          .mockImplementationOnce(() => createImageBuffer(100, 100, mockColor));

        await browserTool.execute({
          operation: 'compareScreenshot',
          params: {
            baselinePath,
            testId: test.name,
            threshold: 0.05,
            diffPath: test.shouldPass ? undefined : path.join(testFixturesDir, `${test.name}-diff.png`)
          }
        });

        if (!test.shouldPass) {
          createdFiles.push(path.join(testFixturesDir, `${test.name}-diff.png`));
        }
      }

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify we have the right structure for test reports
      expect(visualEventCapture).toHaveLength(3);

      // Group results for report generation
      const testReport = {
        totalTests: visualEventCapture.length,
        passedTests: visualEventCapture.filter(e => e.passed).length,
        failedTests: visualEventCapture.filter(e => !e.passed).length,
        tests: visualEventCapture.map(event => ({
          testId: event.testId,
          passed: event.passed,
          diffPercentage: event.diffPercentage,
          threshold: event.threshold,
          diffImage: event.diffImage,
          timestamp: event.timestamp
        }))
      };

      expect(testReport.totalTests).toBe(3);
      expect(testReport.passedTests).toBe(2);
      expect(testReport.failedTests).toBe(1);
      expect(testReport.tests).toHaveLength(3);

      // Verify failed test has diff image
      const failedTest = testReport.tests.find(t => !t.passed);
      expect(failedTest).toBeDefined();
      expect(failedTest!.diffImage).toBeDefined();
      expect(failedTest!.diffPercentage).toBeGreaterThan(0);
    });
  });

  // Helper functions
  async function createTestImage(
    width: number,
    height: number,
    color: { r: number; g: number; b: number }
  ): Promise<string> {
    const fileName = `visual-test-${width}x${height}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;
    const filePath = path.join(testFixturesDir, fileName);
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