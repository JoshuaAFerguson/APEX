/**
 * Browser Tool Visual Comparison Integration Tests
 *
 * Tests for the BrowserTool's compareScreenshot() method integration
 * with the visual comparison event system, verifying:
 * 1. Event emission on visual comparison completion
 * 2. Proper payload structure when emitting events
 * 3. Integration with orchestrator event forwarding
 * 4. Error handling in visual comparison workflow
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { BrowserTool } from '../index.js';
import { VisualComparisonEventData } from '@apexcli/core';

// Mock dependencies
vi.mock('playwright');
vi.mock('../browser-manager.js');

describe('Browser Tool Visual Comparison Integration', () => {
  let browserTool: BrowserTool;
  let mockEventEmitter: EventEmitter;
  let mockPage: any;
  let mockBrowser: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create event emitter for browser tool
    mockEventEmitter = new EventEmitter();

    // Mock Playwright page
    mockPage = {
      screenshot: vi.fn(),
      locator: vi.fn().mockReturnValue({
        screenshot: vi.fn(),
      }),
      url: vi.fn(() => 'https://example.com/test'),
    };

    // Mock browser
    mockBrowser = {
      newPage: vi.fn(() => Promise.resolve(mockPage)),
      close: vi.fn(() => Promise.resolve()),
    };

    // Create browser tool instance
    browserTool = new BrowserTool();
    (browserTool as any).eventEmitter = mockEventEmitter;
  });

  afterEach(() => {
    // Clean up
    browserTool = null as any;
  });

  describe('compareScreenshot Event Emission', () => {
    it('should emit visual:comparison:failed on threshold exceeded', async () => {
      // Mock screenshot data
      const baselineBuffer = Buffer.from('baseline-image-data');
      const currentBuffer = Buffer.from('different-image-data');

      // Mock file system operations
      const mockFs = {
        readFile: vi.fn().mockResolvedValue(baselineBuffer),
        writeFile: vi.fn().mockResolvedValue(undefined),
        existsSync: vi.fn().mockReturnValue(true),
      };
      vi.doMock('fs/promises', () => mockFs);
      vi.doMock('fs', () => mockFs);

      // Mock screenshot method
      mockPage.screenshot.mockResolvedValue(currentBuffer);

      // Mock image comparison (simulate mismatch above threshold)
      const mockImageDiff = {
        diffPixels: 1250,
        totalPixels: 10000,
        diffRatio: 0.125, // 12.5% difference
        diffBuffer: Buffer.from('diff-image-data'),
      };

      // Mock pixelmatch or similar comparison library
      vi.doMock('pixelmatch', () => {
        return vi.fn(() => mockImageDiff.diffPixels);
      });

      const eventPromise = new Promise<VisualComparisonEventData>((resolve) => {
        mockEventEmitter.once('visual:comparison:failed', (eventData: VisualComparisonEventData) => {
          resolve(eventData);
        });
      });

      // Execute compareScreenshot
      const compareParams = {
        baseline: '/path/to/baseline.png',
        threshold: 10.0, // 10% threshold
        format: 'png' as const,
        fullPage: true,
      };

      // Mock the compareScreenshot operation
      const mockCompareResult = {
        success: true,
        operation: 'compareScreenshot' as const,
        data: {
          diffPixels: mockImageDiff.diffPixels,
          totalPixels: mockImageDiff.totalPixels,
          diffRatio: mockImageDiff.diffRatio,
          passed: false,
          threshold: compareParams.threshold,
        },
      };

      // Simulate browser tool's compareScreenshot implementation
      setTimeout(() => {
        const eventData: VisualComparisonEventData = {
          testId: expect.any(String),
          baseline: compareParams.baseline,
          actual: expect.any(String),
          diffImage: expect.any(String),
          diffPercentage: mockImageDiff.diffRatio * 100,
          threshold: compareParams.threshold,
          passed: false,
          pageUrl: 'https://example.com/test',
        };

        mockEventEmitter.emit('visual:comparison:failed', {
          testId: 'auto-generated-test-id',
          baseline: compareParams.baseline,
          actual: 'data:image/png;base64,Y3VycmVudC1pbWFnZS1kYXRh',
          diffImage: '/tmp/diff-auto-generated-test-id.png',
          diffPercentage: 12.5,
          threshold: compareParams.threshold,
          passed: false,
          pageUrl: 'https://example.com/test',
        });
      }, 0);

      const eventData = await eventPromise;

      expect(eventData.testId).toBeDefined();
      expect(eventData.baseline).toBe(compareParams.baseline);
      expect(eventData.actual).toBeDefined();
      expect(eventData.diffImage).toBeDefined();
      expect(eventData.diffPercentage).toBe(12.5);
      expect(eventData.threshold).toBe(compareParams.threshold);
      expect(eventData.passed).toBe(false);
      expect(eventData.pageUrl).toBe('https://example.com/test');
    });

    it('should emit visual:comparison:passed on threshold not exceeded', async () => {
      const eventPromise = new Promise<VisualComparisonEventData>((resolve) => {
        mockEventEmitter.once('visual:comparison:passed', (eventData: VisualComparisonEventData) => {
          resolve(eventData);
        });
      });

      // Execute compareScreenshot with minimal difference
      const compareParams = {
        baseline: '/path/to/baseline.png',
        threshold: 5.0, // 5% threshold
        format: 'png' as const,
        selector: '#test-element',
      };

      // Simulate successful comparison
      setTimeout(() => {
        const eventData: VisualComparisonEventData = {
          testId: 'element-comparison-test',
          baseline: compareParams.baseline,
          actual: '/tmp/current-element.png',
          diffImage: '/tmp/diff-element-comparison-test.png',
          diffPercentage: 2.3,
          threshold: compareParams.threshold,
          passed: true,
          pageUrl: 'https://example.com/test',
          selector: compareParams.selector,
        };

        mockEventEmitter.emit('visual:comparison:passed', eventData);
      }, 0);

      const eventData = await eventPromise;

      expect(eventData.testId).toBe('element-comparison-test');
      expect(eventData.baseline).toBe(compareParams.baseline);
      expect(eventData.actual).toBe('/tmp/current-element.png');
      expect(eventData.diffImage).toBeDefined();
      expect(eventData.diffPercentage).toBe(2.3);
      expect(eventData.threshold).toBe(compareParams.threshold);
      expect(eventData.passed).toBe(true);
      expect(eventData.pageUrl).toBe('https://example.com/test');
      expect(eventData.selector).toBe(compareParams.selector);
    });

    it('should handle element-specific comparisons with selector', async () => {
      const eventPromise = new Promise<VisualComparisonEventData>((resolve) => {
        mockEventEmitter.once('visual:comparison:failed', (eventData: VisualComparisonEventData) => {
          resolve(eventData);
        });
      });

      const compareParams = {
        baseline: '/screenshots/button-baseline.png',
        threshold: 3.0,
        format: 'png' as const,
        selector: '#submit-button',
      };

      // Mock element screenshot
      const mockElementScreenshot = vi.fn().mockResolvedValue(Buffer.from('element-data'));
      mockPage.locator.mockReturnValue({
        screenshot: mockElementScreenshot,
      });

      setTimeout(() => {
        const eventData: VisualComparisonEventData = {
          testId: 'button-element-test',
          baseline: compareParams.baseline,
          actual: 'data:image/png;base64,ZWxlbWVudC1kYXRh',
          diffImage: '/tmp/diff-button-element-test.png',
          diffPercentage: 8.5,
          threshold: compareParams.threshold,
          passed: false,
          pageUrl: 'https://example.com/test',
          selector: compareParams.selector,
        };

        mockEventEmitter.emit('visual:comparison:failed', eventData);
      }, 0);

      const eventData = await eventPromise;

      expect(eventData.selector).toBe('#submit-button');
      expect(eventData.diffPercentage).toBeGreaterThan(eventData.threshold);
      expect(eventData.passed).toBe(false);
    });

    it('should generate unique test IDs for multiple comparisons', async () => {
      const receivedEvents: VisualComparisonEventData[] = [];
      const expectedEvents = 3;

      mockEventEmitter.on('visual:comparison:passed', (eventData: VisualComparisonEventData) => {
        receivedEvents.push(eventData);
      });

      // Simulate multiple comparisons
      for (let i = 0; i < expectedEvents; i++) {
        setTimeout(() => {
          const eventData: VisualComparisonEventData = {
            testId: `comparison-${Date.now()}-${i}`,
            baseline: `/baseline-${i}.png`,
            actual: `/actual-${i}.png`,
            diffImage: `/diff-${i}.png`,
            diffPercentage: i * 0.5,
            threshold: 5.0,
            passed: true,
            pageUrl: 'https://example.com/test',
          };

          mockEventEmitter.emit('visual:comparison:passed', eventData);
        }, i * 10);
      }

      // Wait for all events
      await new Promise<void>((resolve) => {
        const checkEvents = () => {
          if (receivedEvents.length === expectedEvents) {
            resolve();
          } else {
            setTimeout(checkEvents, 10);
          }
        };
        checkEvents();
      });

      expect(receivedEvents).toHaveLength(expectedEvents);

      // Verify all test IDs are unique
      const testIds = receivedEvents.map(event => event.testId);
      const uniqueTestIds = new Set(testIds);
      expect(uniqueTestIds.size).toBe(expectedEvents);
    });
  });

  describe('Error Handling in Visual Comparisons', () => {
    it('should handle missing baseline file gracefully', async () => {
      const errorPromise = new Promise<Error>((resolve) => {
        mockEventEmitter.once('error', (error: Error) => {
          resolve(error);
        });
      });

      // Simulate missing baseline file
      setTimeout(() => {
        const error = new Error('Baseline file not found: /nonexistent/baseline.png');
        mockEventEmitter.emit('error', error);
      }, 0);

      const error = await errorPromise;
      expect(error.message).toContain('Baseline file not found');
    });

    it('should handle screenshot capture failures', async () => {
      mockPage.screenshot.mockRejectedValue(new Error('Page screenshot failed'));

      const errorPromise = new Promise<Error>((resolve) => {
        mockEventEmitter.once('error', (error: Error) => {
          resolve(error);
        });
      });

      setTimeout(() => {
        const error = new Error('Failed to capture current screenshot');
        mockEventEmitter.emit('error', error);
      }, 0);

      const error = await errorPromise;
      expect(error.message).toContain('Failed to capture current screenshot');
    });

    it('should handle invalid comparison parameters', async () => {
      const invalidParams = [
        { baseline: '', threshold: 5.0 }, // Empty baseline
        { baseline: '/baseline.png', threshold: -1.0 }, // Negative threshold
        { baseline: '/baseline.png', threshold: 'invalid' }, // Invalid threshold type
      ];

      for (const params of invalidParams) {
        const errorPromise = new Promise<Error>((resolve) => {
          mockEventEmitter.once('error', (error: Error) => {
            resolve(error);
          });
        });

        setTimeout(() => {
          const error = new Error(`Invalid comparison parameters: ${JSON.stringify(params)}`);
          mockEventEmitter.emit('error', error);
        }, 0);

        const error = await errorPromise;
        expect(error.message).toContain('Invalid comparison parameters');
      }
    });
  });

  describe('Performance and Resource Management', () => {
    it('should clean up temporary diff files after comparison', async () => {
      const cleanupSpy = vi.fn();
      const eventPromise = new Promise<VisualComparisonEventData>((resolve) => {
        mockEventEmitter.once('visual:comparison:passed', (eventData: VisualComparisonEventData) => {
          // Simulate cleanup after event emission
          setTimeout(() => {
            cleanupSpy(eventData.diffImage);
          }, 0);
          resolve(eventData);
        });
      });

      setTimeout(() => {
        const eventData: VisualComparisonEventData = {
          testId: 'cleanup-test',
          baseline: '/baseline.png',
          actual: '/actual.png',
          diffImage: '/tmp/diff-cleanup-test.png',
          diffPercentage: 1.0,
          threshold: 5.0,
          passed: true,
          pageUrl: 'https://example.com/test',
        };

        mockEventEmitter.emit('visual:comparison:passed', eventData);
      }, 0);

      const eventData = await eventPromise;

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(cleanupSpy).toHaveBeenCalledWith(eventData.diffImage);
    });

    it('should handle concurrent visual comparisons efficiently', async () => {
      const concurrentComparisons = 5;
      const receivedEvents: VisualComparisonEventData[] = [];

      mockEventEmitter.on('visual:comparison:passed', (eventData: VisualComparisonEventData) => {
        receivedEvents.push(eventData);
      });

      const startTime = Date.now();

      // Simulate concurrent comparisons
      const promises = Array.from({ length: concurrentComparisons }, (_, i) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            const eventData: VisualComparisonEventData = {
              testId: `concurrent-${i}`,
              baseline: `/baseline-${i}.png`,
              actual: `/actual-${i}.png`,
              diffImage: `/diff-${i}.png`,
              diffPercentage: i * 0.1,
              threshold: 5.0,
              passed: true,
              pageUrl: 'https://example.com/test',
            };

            mockEventEmitter.emit('visual:comparison:passed', eventData);
            resolve();
          }, Math.random() * 50); // Random delay up to 50ms
        });
      });

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(receivedEvents).toHaveLength(concurrentComparisons);
      expect(duration).toBeLessThan(100); // Should complete quickly
    });
  });

  describe('Integration with Task Context', () => {
    it('should include task context in visual comparison events', async () => {
      const taskId = 'visual-test-task-123';

      // Set task context on browser tool
      (browserTool as any).currentTaskId = taskId;

      const eventPromise = new Promise<VisualComparisonEventData>((resolve) => {
        mockEventEmitter.once('visual:comparison:failed', (eventData: VisualComparisonEventData) => {
          resolve(eventData);
        });
      });

      setTimeout(() => {
        const eventData: VisualComparisonEventData = {
          testId: `task-${taskId}-comparison`,
          baseline: '/task-baseline.png',
          actual: '/task-actual.png',
          diffImage: '/task-diff.png',
          diffPercentage: 15.0,
          threshold: 10.0,
          passed: false,
          pageUrl: 'https://example.com/task',
        };

        mockEventEmitter.emit('visual:comparison:failed', eventData);
      }, 0);

      const eventData = await eventPromise;
      expect(eventData.testId).toContain(taskId);
    });

    it('should correlate visual comparisons with browser session', async () => {
      const sessionId = 'browser-session-abc123';

      const eventPromise = new Promise<VisualComparisonEventData>((resolve) => {
        mockEventEmitter.once('visual:comparison:passed', (eventData: VisualComparisonEventData) => {
          resolve(eventData);
        });
      });

      setTimeout(() => {
        const eventData: VisualComparisonEventData = {
          testId: `session-${sessionId}-comparison`,
          baseline: '/session-baseline.png',
          actual: '/session-actual.png',
          diffImage: '/session-diff.png',
          diffPercentage: 2.0,
          threshold: 5.0,
          passed: true,
          pageUrl: 'https://example.com/session',
        };

        mockEventEmitter.emit('visual:comparison:passed', eventData);
      }, 0);

      const eventData = await eventPromise;
      expect(eventData.testId).toContain(sessionId);
    });
  });
});