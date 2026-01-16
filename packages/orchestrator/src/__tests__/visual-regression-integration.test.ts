/**
 * Visual Regression Integration Tests
 *
 * Tests the integration between the visual regression system and the broader
 * test workflow, including:
 * - Integration with test runners and frameworks
 * - Event propagation through orchestrator
 * - Error handling and recovery
 * - Performance under load
 * - Configuration management
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

// Mock external dependencies
vi.mock('../store.js');

describe('Visual Regression Integration', () => {
  let orchestrator: ApexOrchestrator;
  let browserTool: BrowserTool;
  let mockStore: any;
  let testDir: string;
  let eventHistory: Array<{ type: string; data: any; timestamp: Date }> = [];
  let createdFiles: string[] = [];

  beforeEach(async () => {
    vi.clearAllMocks();
    eventHistory = [];
    createdFiles = [];

    testDir = path.join(__dirname, 'integration-test-temp');
    await fs.mkdir(testDir, { recursive: true });

    // Setup mock store
    mockStore = {
      createTask: vi.fn(() => Promise.resolve('integration-task-123')),
      updateTask: vi.fn(() => Promise.resolve()),
      getTask: vi.fn(() => Promise.resolve({
        id: 'integration-task-123',
        description: 'Integration test task',
        status: 'running',
        agentName: 'tester-agent',
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
    (orchestrator as any).currentTaskId = 'integration-task-123';
    (orchestrator as any).currentAgentName = 'tester-agent';

    // Inject event emitter for visual comparisons
    browserTool.setEventEmitter(orchestrator);

    // Capture all events for analysis
    const eventTypes = [
      'visual:comparison:passed',
      'visual:comparison:failed',
      'browser:launched',
      'browser:closed',
      'browser:console',
      'browser:error'
    ];

    eventTypes.forEach(eventType => {
      orchestrator.on(eventType, (data) => {
        eventHistory.push({
          type: eventType,
          data: { ...data },
          timestamp: new Date()
        });
      });
    });
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
        fs.unlink(filePath).catch(() => {})
      )
    );

    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Test Runner Integration', () => {
    it('should integrate with Vitest test runner environment', async () => {
      // Verify we're running in a test environment
      expect(process.env.NODE_ENV).toBe('test');

      // Verify compareScreenshot helper is available in test context
      expect(compareScreenshot).toBeDefined();
      expect(typeof compareScreenshot).toBe('function');

      // Create test images for comparison
      const image1 = await createTestImage('test1.png', 100, 100, { r: 255, g: 0, b: 0 });
      const image2 = await createTestImage('test2.png', 100, 100, { r: 255, g: 0, b: 0 });

      // Test direct usage in test environment
      const result = await compareScreenshot(image1, image2);

      expect(result.match).toBe(true);
      expect(result.diffPercentage).toBe(0);
      expect(result.similarity).toBe(1);
    });

    it('should handle test timeouts and cleanup properly', async () => {
      const startTime = Date.now();

      // Create baseline image
      const baseline = await createTestImage('timeout-baseline.png', 50, 50, { r: 128, g: 128, b: 128 });

      // Mock a long-running screenshot operation
      vi.spyOn(browserTool as any, 'captureElementScreenshot').mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(createImageBuffer(50, 50, { r: 128, g: 128, b: 128 }));
          }, 100); // Small delay to simulate real operation
        });
      });

      // Execute comparison
      const result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baseline,
          testId: 'timeout-test',
          threshold: 0.1
        }
      });

      const executionTime = Date.now() - startTime;

      // Verify operation completed successfully within reasonable time
      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect((result.data as any).match).toBe(true);
    });

    it('should provide meaningful error messages for test debugging', async () => {
      // Test with non-existent baseline
      const nonExistentPath = path.join(testDir, 'does-not-exist.png');

      try {
        await compareScreenshot(nonExistentPath, nonExistentPath);
        expect.fail('Should have thrown an error for non-existent file');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Cannot read image file');
      }

      // Test with invalid base64 data
      try {
        await compareScreenshot('invalid-base64-data', nonExistentPath);
        expect.fail('Should have thrown an error for invalid base64');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to decode base64 image data');
      }
    });
  });

  describe('Event Propagation and Handling', () => {
    it('should properly propagate events through orchestrator hierarchy', async () => {
      // Create test scenario with both passing and failing comparisons
      const baseline1 = await createTestImage('prop-test1.png', 30, 30, { r: 100, g: 100, b: 100 });
      const baseline2 = await createTestImage('prop-test2.png', 30, 30, { r: 200, g: 200, b: 200 });

      // Mock two different screenshots
      let callCount = 0;
      vi.spyOn(browserTool as any, 'captureElementScreenshot').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: matching image
          return createImageBuffer(30, 30, { r: 100, g: 100, b: 100 });
        } else {
          // Second call: non-matching image
          return createImageBuffer(30, 30, { r: 50, g: 50, b: 50 });
        }
      });

      // Execute first comparison (should pass)
      await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baseline1,
          testId: 'propagation-test-1',
          threshold: 0.05
        }
      });

      // Execute second comparison (should fail)
      await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baseline2,
          testId: 'propagation-test-2',
          threshold: 0.05,
          diffPath: path.join(testDir, 'propagation-diff.png')
        }
      });

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify events were captured
      const visualEvents = eventHistory.filter(e =>
        e.type === 'visual:comparison:passed' || e.type === 'visual:comparison:failed'
      );

      expect(visualEvents).toHaveLength(2);

      const passedEvent = visualEvents.find(e => e.type === 'visual:comparison:passed');
      const failedEvent = visualEvents.find(e => e.type === 'visual:comparison:failed');

      expect(passedEvent).toBeDefined();
      expect(failedEvent).toBeDefined();

      // Verify event data structure
      expect(passedEvent!.data.testId).toBe('propagation-test-1');
      expect(passedEvent!.data.passed).toBe(true);
      expect(passedEvent!.data.taskId).toBe('integration-task-123');

      expect(failedEvent!.data.testId).toBe('propagation-test-2');
      expect(failedEvent!.data.passed).toBe(false);
      expect(failedEvent!.data.diffImage).toBeDefined();

      createdFiles.push(path.join(testDir, 'propagation-diff.png'));
    });

    it('should handle event ordering and sequencing correctly', async () => {
      const baseline = await createTestImage('sequence-test.png', 40, 40, { r: 150, g: 150, b: 150 });

      // Execute multiple comparisons in sequence
      const testCount = 5;
      const promises = [];

      vi.spyOn(browserTool as any, 'captureElementScreenshot').mockImplementation(() => {
        return createImageBuffer(40, 40, { r: 150, g: 150, b: 150 });
      });

      for (let i = 1; i <= testCount; i++) {
        promises.push(
          browserTool.execute({
            operation: 'compareScreenshot',
            params: {
              baselinePath: baseline,
              testId: `sequence-test-${i}`,
              threshold: 0.1
            }
          })
        );
      }

      await Promise.all(promises);

      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify all events were captured in order
      const sequenceEvents = eventHistory
        .filter(e => e.type === 'visual:comparison:passed')
        .filter(e => e.data.testId.startsWith('sequence-test-'))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      expect(sequenceEvents).toHaveLength(testCount);

      // Verify events are properly sequenced
      sequenceEvents.forEach((event, index) => {
        expect(event.data.testId).toBe(`sequence-test-${index + 1}`);
        expect(event.data.taskId).toBe('integration-task-123');
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle browser errors gracefully during visual comparisons', async () => {
      const baseline = await createTestImage('error-test.png', 60, 60, { r: 180, g: 180, b: 180 });

      // Mock browser tool to throw an error
      vi.spyOn(browserTool as any, 'captureElementScreenshot').mockImplementation(() => {
        throw new Error('Browser screenshot failed');
      });

      const result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baseline,
          testId: 'error-handling-test',
          threshold: 0.1
        }
      });

      // Operation should fail gracefully
      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser screenshot failed');

      // No visual comparison events should be emitted for failed operations
      await new Promise(resolve => setTimeout(resolve, 50));
      const visualEvents = eventHistory.filter(e =>
        e.type === 'visual:comparison:passed' || e.type === 'visual:comparison:failed'
      );
      expect(visualEvents).toHaveLength(0);
    });

    it('should handle file system errors during diff generation', async () => {
      const baseline = await createTestImage('fs-error-test.png', 70, 70, { r: 220, g: 220, b: 220 });
      const invalidDiffPath = '/invalid/path/that/does/not/exist/diff.png';

      vi.spyOn(browserTool as any, 'captureElementScreenshot').mockImplementation(() => {
        return createImageBuffer(70, 70, { r: 100, g: 100, b: 100 }); // Different color to trigger diff
      });

      const result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baseline,
          diffPath: invalidDiffPath,
          testId: 'fs-error-test',
          threshold: 0.05
        }
      });

      // The comparison should still work, but diff file creation might fail
      // The operation should handle this gracefully
      expect(result.success).toBe(true);
      expect((result.data as any).match).toBe(false); // Colors are different

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should still emit comparison event even if diff file creation failed
      const failedEvents = eventHistory.filter(e => e.type === 'visual:comparison:failed');
      expect(failedEvents).toHaveLength(1);
      expect(failedEvents[0].data.testId).toBe('fs-error-test');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent visual comparisons', async () => {
      const concurrentTests = 10;
      const baselines: string[] = [];

      // Create multiple baseline images
      for (let i = 0; i < concurrentTests; i++) {
        const color = {
          r: Math.floor(i * 25),
          g: Math.floor(i * 25),
          b: Math.floor(i * 25)
        };
        const baseline = await createTestImage(`concurrent-${i}.png`, 30, 30, color);
        baselines.push(baseline);
      }

      // Mock screenshots to match baselines
      let callIndex = 0;
      vi.spyOn(browserTool as any, 'captureElementScreenshot').mockImplementation(() => {
        const i = callIndex++;
        const color = {
          r: Math.floor(i * 25),
          g: Math.floor(i * 25),
          b: Math.floor(i * 25)
        };
        return createImageBuffer(30, 30, color);
      });

      // Execute all comparisons concurrently
      const startTime = Date.now();
      const promises = baselines.map((baseline, i) =>
        browserTool.execute({
          operation: 'compareScreenshot',
          params: {
            baselinePath: baseline,
            testId: `concurrent-test-${i}`,
            threshold: 0.1
          }
        })
      );

      const results = await Promise.all(promises);
      const executionTime = Date.now() - startTime;

      // Verify all operations completed successfully
      expect(results).toHaveLength(concurrentTests);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect((result.data as any).match).toBe(true);
      });

      // Verify performance is reasonable (should complete within reasonable time)
      expect(executionTime).toBeLessThan(10000); // 10 seconds for 10 concurrent operations

      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify all events were captured
      const passedEvents = eventHistory.filter(e =>
        e.type === 'visual:comparison:passed' &&
        e.data.testId.startsWith('concurrent-test-')
      );
      expect(passedEvents).toHaveLength(concurrentTests);
    });
  });

  describe('Configuration and Customization', () => {
    it('should support different threshold configurations per test', async () => {
      const baseline = await createTestImage('threshold-test.png', 80, 80, { r: 128, g: 128, b: 128 });

      // Create slightly different screenshot
      vi.spyOn(browserTool as any, 'captureElementScreenshot').mockImplementation(() => {
        return createImageBuffer(80, 80, { r: 130, g: 130, b: 130 }); // Slightly lighter
      });

      // Test with strict threshold (should fail)
      const strictResult = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baseline,
          testId: 'strict-threshold-test',
          threshold: 0.01 // 1% tolerance
        }
      });

      // Test with lenient threshold (should pass)
      const lenientResult = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baseline,
          testId: 'lenient-threshold-test',
          threshold: 0.2 // 20% tolerance
        }
      });

      expect(strictResult.success).toBe(true);
      expect((strictResult.data as any).match).toBe(false);

      expect(lenientResult.success).toBe(true);
      expect((lenientResult.data as any).match).toBe(true);

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify appropriate events were emitted
      const failedEvents = eventHistory.filter(e => e.type === 'visual:comparison:failed');
      const passedEvents = eventHistory.filter(e => e.type === 'visual:comparison:passed');

      expect(failedEvents).toHaveLength(1);
      expect(passedEvents).toHaveLength(1);

      expect(failedEvents[0].data.testId).toBe('strict-threshold-test');
      expect(passedEvents[0].data.testId).toBe('lenient-threshold-test');
    });
  });

  // Helper functions
  async function createTestImage(
    filename: string,
    width: number,
    height: number,
    color: { r: number; g: number; b: number }
  ): Promise<string> {
    const filePath = path.join(testDir, filename);

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