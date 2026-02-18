/**
 * @fileoverview Comprehensive tests for browser test utilities and helper functions
 *
 * This test suite validates all utility functions used in browser automation testing:
 * - Screenshot utilities and comparison functions
 * - Element interaction helpers with retry logic
 * - Wait condition helpers and timeout handling
 * - Performance measurement utilities
 * - Error handling and recovery mechanisms
 * - Mock server setup and network request handling
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { Page, BrowserContext, Locator } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import {
  takeScreenshot,
  compareScreenshots,
  waitForElement,
  safeClick,
  safeFill,
  waitForNetworkIdle,
  measurePerformance,
  setupAlertHandler,
  captureConsoleMessages,
  capturePageErrors,
  withBrowserTest,
  setupMockServer,
  ScreenshotOptions,
  WaitConditions,
  PerformanceMeasurement,
} from './utils/test-helpers';

describe('Browser Test Utilities', () => {
  let testTempDir: string;
  let mockPage: any;
  let mockLocator: any;

  beforeAll(async () => {
    testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-utils-test-'));
  });

  afterAll(async () => {
    try {
      await fs.rm(testTempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup utils test temp dir:', error);
    }
  });

  beforeEach(() => {
    // Create comprehensive mock locator
    mockLocator = {
      waitFor: vi.fn().mockResolvedValue(undefined),
      scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      fill: vi.fn().mockResolvedValue(undefined),
      inputValue: vi.fn().mockResolvedValue('test-input-value'),
      isVisible: vi.fn().mockResolvedValue(true),
      isHidden: vi.fn().mockResolvedValue(false),
      textContent: vi.fn().mockResolvedValue('test-text-content'),
      setInputFiles: vi.fn().mockResolvedValue(undefined),
    };

    // Create comprehensive mock page
    mockPage = {
      screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-screenshot-data')),
      locator: vi.fn().mockReturnValue(mockLocator),
      click: vi.fn().mockResolvedValue(undefined),
      fill: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      waitForFunction: vi.fn().mockImplementation((fn, selector, options) => {
        // Simulate wait function behavior
        return Promise.resolve(true);
      }),
      on: vi.fn(),
      off: vi.fn(),
      route: vi.fn(),
      evaluate: vi.fn().mockImplementation((fn: Function) => {
        if (typeof fn === 'function') {
          try {
            return Promise.resolve(fn());
          } catch (error) {
            return Promise.reject(error);
          }
        }
        return Promise.resolve({});
      }),
      goBack: vi.fn().mockResolvedValue(undefined),
      goForward: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue('https://test.example.com'),
      title: vi.fn().mockResolvedValue('Test Page Title'),
    };
  });

  describe('Screenshot Utilities', () => {
    describe('takeScreenshot', () => {
      it('should take screenshot with default options', async () => {
        const screenshotPath = await takeScreenshot(mockPage, 'test-screenshot', testTempDir);

        expect(screenshotPath).toContain('test-screenshot');
        expect(screenshotPath).toContain('.png');
        expect(screenshotPath).toContain(testTempDir);
        expect(mockPage.screenshot).toHaveBeenCalledWith({
          path: screenshotPath,
          fullPage: true,
          animations: 'disabled',
          caret: 'hide',
        });
      });

      it('should take screenshot with custom options', async () => {
        const options: ScreenshotOptions = {
          fullPage: false,
          clip: { x: 0, y: 0, width: 800, height: 600 },
          animations: 'allow',
          caret: 'initial',
        };

        const screenshotPath = await takeScreenshot(mockPage, 'custom-screenshot', testTempDir, options);

        expect(mockPage.screenshot).toHaveBeenCalledWith({
          path: screenshotPath,
          fullPage: false,
          clip: options.clip,
          animations: 'allow',
          caret: 'initial',
        });
      });

      it('should handle screenshot failures gracefully', async () => {
        mockPage.screenshot.mockRejectedValueOnce(new Error('Screenshot failed'));

        await expect(
          takeScreenshot(mockPage, 'failed-screenshot', testTempDir)
        ).rejects.toThrow('Screenshot failed');
      });

      it('should create unique filenames with timestamps', async () => {
        const screenshot1 = await takeScreenshot(mockPage, 'test', testTempDir);

        // Wait a bit to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));

        const screenshot2 = await takeScreenshot(mockPage, 'test', testTempDir);

        expect(screenshot1).not.toBe(screenshot2);
        expect(path.basename(screenshot1)).toMatch(/test-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
      });
    });

    describe('compareScreenshots', () => {
      it('should compare identical screenshots', async () => {
        const testFile1 = path.join(testTempDir, 'identical1.png');
        const testFile2 = path.join(testTempDir, 'identical2.png');
        const content = Buffer.from('identical-content');

        await fs.writeFile(testFile1, content);
        await fs.writeFile(testFile2, content);

        const result = await compareScreenshots(testFile1, testFile2);

        expect(result.similarity).toBe(1);
      });

      it('should compare different screenshots', async () => {
        const testFile1 = path.join(testTempDir, 'different1.png');
        const testFile2 = path.join(testTempDir, 'different2.png');

        await fs.writeFile(testFile1, Buffer.from('content-1'));
        await fs.writeFile(testFile2, Buffer.from('much-longer-content-2'));

        const result = await compareScreenshots(testFile1, testFile2);

        expect(result.similarity).toBeLessThan(1);
        expect(result.similarity).toBeGreaterThanOrEqual(0);
      });

      it('should handle missing screenshot files', async () => {
        const nonExistentFile1 = path.join(testTempDir, 'missing1.png');
        const nonExistentFile2 = path.join(testTempDir, 'missing2.png');

        const result = await compareScreenshots(nonExistentFile1, nonExistentFile2);

        expect(result.similarity).toBe(0);
      });

      it('should optionally save diff output', async () => {
        const testFile1 = path.join(testTempDir, 'diff1.png');
        const testFile2 = path.join(testTempDir, 'diff2.png');
        const diffOutputDir = path.join(testTempDir, 'diffs');

        await fs.mkdir(diffOutputDir, { recursive: true });
        await fs.writeFile(testFile1, Buffer.from('content-a'));
        await fs.writeFile(testFile2, Buffer.from('content-b'));

        const result = await compareScreenshots(testFile1, testFile2, diffOutputDir);

        expect(result.similarity).toBeLessThan(1);
        // Note: In a real implementation, this would create a diff image
      });
    });
  });

  describe('Element Interaction Utilities', () => {
    describe('waitForElement', () => {
      it('should wait for element to be visible', async () => {
        const element = await waitForElement(mockPage, '#test-element', {
          visible: true,
          timeout: 10000,
        });

        expect(mockPage.locator).toHaveBeenCalledWith('#test-element');
        expect(mockLocator.waitFor).toHaveBeenCalledWith({
          state: 'visible',
          timeout: 10000,
        });
        expect(element).toBe(mockLocator);
      });

      it('should wait for element to be hidden', async () => {
        await waitForElement(mockPage, '.hidden-element', {
          hidden: true,
          timeout: 5000,
        });

        expect(mockLocator.waitFor).toHaveBeenCalledWith({
          state: 'hidden',
          timeout: 5000,
        });
      });

      it('should wait for element to be stable', async () => {
        await waitForElement(mockPage, '.moving-element', {
          stable: true,
          timeout: 15000,
        });

        expect(mockPage.waitForFunction).toHaveBeenCalledWith(
          expect.any(Function),
          '.moving-element',
          { timeout: 15000 }
        );
      });

      it('should wait for element to be enabled', async () => {
        mockPage.waitForFunction.mockResolvedValueOnce(true);

        await waitForElement(mockPage, 'button', {
          enabled: true,
          timeout: 8000,
        });

        expect(mockLocator.waitFor).toHaveBeenCalledWith({
          state: 'visible',
          timeout: 8000,
        });
        expect(mockPage.waitForFunction).toHaveBeenCalledWith(
          expect.any(Function),
          'button',
          { timeout: 8000 }
        );
      });

      it('should wait for element to be disabled', async () => {
        mockPage.waitForFunction.mockResolvedValueOnce(true);

        await waitForElement(mockPage, 'input', {
          disabled: true,
          timeout: 6000,
        });

        expect(mockPage.waitForFunction).toHaveBeenCalledWith(
          expect.any(Function),
          'input',
          { timeout: 6000 }
        );
      });

      it('should handle multiple conditions', async () => {
        await waitForElement(mockPage, '#complex-element', {
          visible: true,
          enabled: true,
          stable: true,
          timeout: 20000,
        });

        expect(mockLocator.waitFor).toHaveBeenCalledWith({
          state: 'visible',
          timeout: 20000,
        });
        expect(mockPage.waitForFunction).toHaveBeenCalledTimes(2); // enabled + stable
      });

      it('should use default timeout when not specified', async () => {
        await waitForElement(mockPage, '.default-timeout');

        expect(mockLocator.waitFor).toHaveBeenCalledWith({
          state: 'visible',
          timeout: 30000,
        });
      });

      it('should handle wait failures', async () => {
        mockLocator.waitFor.mockRejectedValueOnce(new Error('Element not found'));

        await expect(
          waitForElement(mockPage, '.non-existent', { visible: true })
        ).rejects.toThrow('Element not found');
      });
    });

    describe('safeClick', () => {
      it('should click element successfully', async () => {
        await safeClick(mockPage, '#clickable-element');

        expect(mockPage.locator).toHaveBeenCalledWith('#clickable-element');
        expect(mockLocator.scrollIntoViewIfNeeded).toHaveBeenCalled();
        expect(mockLocator.click).toHaveBeenCalled();
      });

      it('should retry on click failure', async () => {
        mockLocator.click
          .mockRejectedValueOnce(new Error('Click intercepted'))
          .mockRejectedValueOnce(new Error('Element not ready'))
          .mockResolvedValueOnce(undefined);

        await safeClick(mockPage, '#retry-element', { retries: 3, delay: 100 });

        expect(mockLocator.click).toHaveBeenCalledTimes(3);
      });

      it('should fail after max retries', async () => {
        mockLocator.click.mockRejectedValue(new Error('Persistent click failure'));

        await expect(
          safeClick(mockPage, '#failing-element', { retries: 2, delay: 50 })
        ).rejects.toThrow('Failed to click "#failing-element" after 2 attempts');
      });

      it('should wait between retry attempts', async () => {
        let delayCallCount = 0;
        mockPage.waitForTimeout.mockImplementation((delay: number) => {
          delayCallCount++;
          expect(delay).toBe(200); // Custom delay
          return Promise.resolve();
        });

        mockLocator.click
          .mockRejectedValueOnce(new Error('First failure'))
          .mockResolvedValueOnce(undefined);

        await safeClick(mockPage, '#delayed-element', { retries: 2, delay: 200 });

        expect(delayCallCount).toBe(1); // One delay between retries
      });

      it('should handle element not visible during click', async () => {
        mockLocator.isVisible.mockResolvedValueOnce(false);
        mockLocator.waitFor.mockRejectedValueOnce(new Error('Element not visible'));

        await expect(
          safeClick(mockPage, '#invisible-element')
        ).rejects.toThrow();
      });
    });

    describe('safeFill', () => {
      it('should fill input with value', async () => {
        await safeFill(mockPage, '#input-field', 'test value');

        expect(mockPage.locator).toHaveBeenCalledWith('#input-field');
        expect(mockLocator.clear).toHaveBeenCalled();
        expect(mockLocator.fill).toHaveBeenCalledWith('test value');
        expect(mockLocator.inputValue).toHaveBeenCalled();
      });

      it('should skip clearing when clear option is false', async () => {
        await safeFill(mockPage, '#input-field', 'append value', { clear: false });

        expect(mockLocator.clear).not.toHaveBeenCalled();
        expect(mockLocator.fill).toHaveBeenCalledWith('append value');
      });

      it('should skip verification when verify option is false', async () => {
        await safeFill(mockPage, '#input-field', 'no verify', { verify: false });

        expect(mockLocator.fill).toHaveBeenCalledWith('no verify');
        expect(mockLocator.inputValue).not.toHaveBeenCalled();
      });

      it('should verify filled value matches expected', async () => {
        mockLocator.inputValue.mockResolvedValueOnce('correct value');

        await safeFill(mockPage, '#verified-field', 'correct value');

        expect(mockLocator.inputValue).toHaveBeenCalled();
      });

      it('should throw error when filled value does not match', async () => {
        mockLocator.inputValue.mockResolvedValueOnce('wrong value');

        await expect(
          safeFill(mockPage, '#mismatched-field', 'expected value')
        ).rejects.toThrow(
          'Failed to fill "#mismatched-field" with "expected value". Actual value: "wrong value"'
        );
      });

      it('should handle fill failures', async () => {
        mockLocator.fill.mockRejectedValueOnce(new Error('Fill operation failed'));

        await expect(
          safeFill(mockPage, '#broken-field', 'test value')
        ).rejects.toThrow('Fill operation failed');
      });
    });
  });

  describe('Network and Loading Utilities', () => {
    describe('waitForNetworkIdle', () => {
      it('should wait for network idle with default options', async () => {
        await waitForNetworkIdle(mockPage);

        expect(mockPage.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 30000 });
        expect(mockPage.waitForTimeout).toHaveBeenCalledWith(500);
      });

      it('should wait for network idle with custom timeout', async () => {
        await waitForNetworkIdle(mockPage, { timeout: 45000, idleTime: 1000 });

        expect(mockPage.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 45000 });
        expect(mockPage.waitForTimeout).toHaveBeenCalledWith(1000);
      });

      it('should handle network idle timeout', async () => {
        mockPage.waitForLoadState.mockRejectedValueOnce(new Error('Network idle timeout'));

        await expect(
          waitForNetworkIdle(mockPage, { timeout: 5000 })
        ).rejects.toThrow('Network idle timeout');
      });
    });

    describe('setupMockServer', () => {
      it('should setup mock routes', async () => {
        const routes = {
          '/api/test': {
            status: 200,
            body: { success: true },
          },
          '/api/error': {
            status: 500,
            body: { error: 'Internal server error' },
            headers: { 'Content-Type': 'application/json' },
          },
        };

        await setupMockServer(mockPage, routes);

        expect(mockPage.route).toHaveBeenCalledTimes(2);
        expect(mockPage.route).toHaveBeenCalledWith('/api/test', expect.any(Function));
        expect(mockPage.route).toHaveBeenCalledWith('/api/error', expect.any(Function));
      });

      it('should handle route fulfillment', async () => {
        const routes = {
          '/api/data': {
            status: 200,
            body: { data: 'test data' },
            headers: { 'Custom-Header': 'test-value' },
          },
        };

        let mockRoute: any;
        mockPage.route.mockImplementation((pattern: string, handler: Function) => {
          mockRoute = {
            fulfill: vi.fn(),
          };
          handler(mockRoute);
        });

        await setupMockServer(mockPage, routes);

        expect(mockRoute.fulfill).toHaveBeenCalledWith({
          status: 200,
          headers: { 'Custom-Header': 'test-value' },
          body: JSON.stringify({ data: 'test data' }),
        });
      });
    });
  });

  describe('Performance Measurement Utilities', () => {
    describe('measurePerformance', () => {
      it('should measure action performance', async () => {
        const mockAction = vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        });

        const performance = await measurePerformance(mockPage, mockAction);

        expect(performance.duration).toBeGreaterThan(0);
        expect(performance.endTime).toBeGreaterThan(performance.startTime);
        expect(mockAction).toHaveBeenCalled();
      });

      it('should capture navigation timing', async () => {
        const mockTiming = {
          navigationStart: 1000,
          domContentLoadedEventEnd: 2000,
          loadEventEnd: 2500,
        };

        mockPage.evaluate.mockResolvedValueOnce(mockTiming);

        const mockAction = vi.fn().mockResolvedValueOnce(undefined);
        const performance = await measurePerformance(mockPage, mockAction);

        expect(performance.navigationTiming).toEqual(mockTiming);
      });

      it('should capture performance metrics', async () => {
        const mockMetrics = {
          domContentLoaded: 500,
          loadComplete: 200,
          firstPaint: 300,
        };

        mockPage.evaluate.mockResolvedValueOnce(mockMetrics);

        const mockAction = vi.fn().mockResolvedValueOnce(undefined);
        const performance = await measurePerformance(mockPage, mockAction);

        expect(performance.metrics).toEqual(mockMetrics);
      });

      it('should handle performance measurement errors', async () => {
        mockPage.evaluate.mockRejectedValueOnce(new Error('Performance API unavailable'));

        const mockAction = vi.fn().mockResolvedValueOnce(undefined);
        const performance = await measurePerformance(mockPage, mockAction);

        expect(performance.duration).toBeGreaterThan(0);
        expect(performance.navigationTiming).toBeUndefined();
      });
    });
  });

  describe('Event Handling Utilities', () => {
    describe('setupAlertHandler', () => {
      it('should setup alert handler with accept strategy', async () => {
        await setupAlertHandler(mockPage, 'accept');

        expect(mockPage.on).toHaveBeenCalledWith('dialog', expect.any(Function));
      });

      it('should setup alert handler with dismiss strategy', async () => {
        await setupAlertHandler(mockPage, 'dismiss');

        expect(mockPage.on).toHaveBeenCalledWith('dialog', expect.any(Function));
      });

      it('should setup alert handler with custom function', async () => {
        const customHandler = vi.fn().mockReturnValue(true);

        await setupAlertHandler(mockPage, customHandler);

        expect(mockPage.on).toHaveBeenCalledWith('dialog', expect.any(Function));
      });

      it('should handle dialog events correctly', async () => {
        let dialogHandler: Function;
        mockPage.on.mockImplementation((event: string, handler: Function) => {
          if (event === 'dialog') {
            dialogHandler = handler;
          }
        });

        await setupAlertHandler(mockPage, 'accept');

        const mockDialog = {
          message: vi.fn().mockReturnValue('Test alert message'),
          type: vi.fn().mockReturnValue('alert'),
          accept: vi.fn().mockResolvedValue(undefined),
          dismiss: vi.fn().mockResolvedValue(undefined),
        };

        await dialogHandler!(mockDialog);

        expect(mockDialog.accept).toHaveBeenCalled();
        expect(mockDialog.dismiss).not.toHaveBeenCalled();
      });
    });

    describe('captureConsoleMessages', () => {
      it('should capture console messages during action', async () => {
        let consoleHandler: Function;
        const capturedMessages: any[] = [];

        mockPage.on.mockImplementation((event: string, handler: Function) => {
          if (event === 'console') {
            consoleHandler = handler;
          }
        });

        mockPage.off.mockImplementation(() => {});

        const mockAction = vi.fn().mockImplementation(async () => {
          // Simulate console messages
          const messages = [
            { type: () => 'log', text: () => 'Test log message' },
            { type: () => 'warn', text: () => 'Test warning message' },
            { type: () => 'error', text: () => 'Test error message' },
          ];

          messages.forEach(msg => {
            consoleHandler!(msg);
            capturedMessages.push({
              type: msg.type(),
              text: msg.text(),
              timestamp: Date.now(),
            });
          });
        });

        const messages = await captureConsoleMessages(mockPage, mockAction);

        expect(mockPage.on).toHaveBeenCalledWith('console', expect.any(Function));
        expect(mockPage.off).toHaveBeenCalledWith('console', expect.any(Function));
        expect(mockAction).toHaveBeenCalled();
        expect(messages).toBeInstanceOf(Array);
      });
    });

    describe('capturePageErrors', () => {
      it('should capture page errors during action', async () => {
        let errorHandler: Function;
        let requestFailedHandler: Function;

        mockPage.on.mockImplementation((event: string, handler: Function) => {
          if (event === 'pageerror') {
            errorHandler = handler;
          } else if (event === 'requestfailed') {
            requestFailedHandler = handler;
          }
        });

        const mockAction = vi.fn().mockImplementation(async () => {
          // Simulate page error
          const error = new Error('Test page error');
          error.stack = 'Error stack trace';
          errorHandler!(error);

          // Simulate request failure
          const mockRequest = {
            url: () => 'https://api.example.com/fail',
            failure: () => ({ errorText: 'Connection refused' }),
          };
          requestFailedHandler!(mockRequest);
        });

        const errors = await capturePageErrors(mockPage, mockAction);

        expect(mockPage.on).toHaveBeenCalledWith('pageerror', expect.any(Function));
        expect(mockPage.on).toHaveBeenCalledWith('requestfailed', expect.any(Function));
        expect(errors).toBeInstanceOf(Array);
      });
    });
  });

  describe('Test Execution Utilities', () => {
    describe('withBrowserTest', () => {
      it('should execute test with successful cleanup', async () => {
        const mockTestFn = vi.fn().mockResolvedValue('test-result');
        const mockCleanup = vi.fn().mockResolvedValue(undefined);

        const result = await withBrowserTest(mockTestFn, mockPage, mockCleanup);

        expect(result).toBe('test-result');
        expect(mockTestFn).toHaveBeenCalledWith(mockPage);
        expect(mockCleanup).toHaveBeenCalled();
      });

      it('should execute cleanup even if test fails', async () => {
        const mockTestFn = vi.fn().mockRejectedValue(new Error('Test failed'));
        const mockCleanup = vi.fn().mockResolvedValue(undefined);

        await expect(
          withBrowserTest(mockTestFn, mockPage, mockCleanup)
        ).rejects.toThrow('Test failed');

        expect(mockCleanup).toHaveBeenCalled();
      });

      it('should handle cleanup failures gracefully', async () => {
        const mockTestFn = vi.fn().mockResolvedValue('success');
        const mockCleanup = vi.fn().mockRejectedValue(new Error('Cleanup failed'));
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await withBrowserTest(mockTestFn, mockPage, mockCleanup);

        expect(result).toBe('success');
        expect(consoleSpy).toHaveBeenCalledWith('Cleanup failed:', expect.any(Error));

        consoleSpy.mockRestore();
      });

      it('should work without cleanup function', async () => {
        const mockTestFn = vi.fn().mockResolvedValue('no-cleanup-result');

        const result = await withBrowserTest(mockTestFn, mockPage);

        expect(result).toBe('no-cleanup-result');
        expect(mockTestFn).toHaveBeenCalledWith(mockPage);
      });
    });
  });

  describe('Type Validation', () => {
    it('should validate ScreenshotOptions interface', () => {
      const validOptions: ScreenshotOptions = {
        fullPage: true,
        clip: { x: 100, y: 100, width: 800, height: 600 },
        animations: 'disabled',
        caret: 'hide',
      };

      expect(typeof validOptions.fullPage).toBe('boolean');
      expect(validOptions.clip).toHaveProperty('x');
      expect(validOptions.clip).toHaveProperty('y');
      expect(validOptions.clip).toHaveProperty('width');
      expect(validOptions.clip).toHaveProperty('height');
      expect(['disabled', 'allow']).toContain(validOptions.animations);
      expect(['hide', 'initial']).toContain(validOptions.caret);
    });

    it('should validate WaitConditions interface', () => {
      const validConditions: WaitConditions = {
        visible: true,
        hidden: false,
        stable: true,
        enabled: true,
        disabled: false,
        timeout: 15000,
      };

      expect(typeof validConditions.visible).toBe('boolean');
      expect(typeof validConditions.hidden).toBe('boolean');
      expect(typeof validConditions.stable).toBe('boolean');
      expect(typeof validConditions.enabled).toBe('boolean');
      expect(typeof validConditions.disabled).toBe('boolean');
      expect(typeof validConditions.timeout).toBe('number');
      expect(validConditions.timeout).toBeGreaterThan(0);
    });

    it('should validate PerformanceMeasurement interface', () => {
      const validMeasurement: PerformanceMeasurement = {
        startTime: 1000,
        endTime: 2000,
        duration: 1000,
        navigationTiming: {
          navigationStart: 1000,
          loadEventEnd: 2000,
        } as any,
        metrics: {
          domContentLoaded: 500,
          loadComplete: 300,
        },
      };

      expect(typeof validMeasurement.startTime).toBe('number');
      expect(typeof validMeasurement.endTime).toBe('number');
      expect(typeof validMeasurement.duration).toBe('number');
      expect(validMeasurement.endTime).toBeGreaterThan(validMeasurement.startTime);
      expect(validMeasurement.duration).toBe(validMeasurement.endTime - validMeasurement.startTime);
    });
  });
});