/**
 * @fileoverview Browser test utility helpers
 *
 * This file provides utility functions for browser automation testing:
 * - Screenshot comparison utilities
 * - Element interaction helpers
 * - Wait condition helpers
 * - Error handling utilities
 * - Performance measurement utilities
 */

import { Page, BrowserContext, Locator } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';

// Test helper types
export interface ScreenshotOptions {
  fullPage?: boolean;
  clip?: { x: number; y: number; width: number; height: number };
  animations?: 'disabled' | 'allow';
  caret?: 'hide' | 'initial';
}

export interface WaitConditions {
  visible?: boolean;
  hidden?: boolean;
  stable?: boolean;
  enabled?: boolean;
  disabled?: boolean;
  timeout?: number;
}

export interface PerformanceMeasurement {
  startTime: number;
  endTime: number;
  duration: number;
  navigationTiming?: PerformanceTiming;
  metrics?: Record<string, number>;
}

/**
 * Takes a screenshot and saves it with timestamp
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  outputDir: string,
  options: ScreenshotOptions = {}
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;
  const filepath = path.join(outputDir, filename);

  await page.screenshot({
    path: filepath,
    fullPage: options.fullPage ?? true,
    clip: options.clip,
    animations: options.animations ?? 'disabled',
    caret: options.caret ?? 'hide',
  });

  return filepath;
}

/**
 * Compares two screenshots and returns similarity score
 */
export async function compareScreenshots(
  screenshot1Path: string,
  screenshot2Path: string,
  outputDir?: string
): Promise<{ similarity: number; diffPath?: string }> {
  // This is a simplified implementation
  // In a real scenario, you might use pixelmatch or similar libraries
  try {
    const [buffer1, buffer2] = await Promise.all([
      fs.readFile(screenshot1Path),
      fs.readFile(screenshot2Path),
    ]);

    // Simple comparison based on file size (not accurate, but for demo)
    const sizeDiff = Math.abs(buffer1.length - buffer2.length);
    const maxSize = Math.max(buffer1.length, buffer2.length);
    const similarity = 1 - sizeDiff / maxSize;

    return { similarity };
  } catch (error) {
    console.error('Screenshot comparison failed:', error);
    return { similarity: 0 };
  }
}

/**
 * Waits for an element to meet specific conditions
 */
export async function waitForElement(
  page: Page,
  selector: string,
  conditions: WaitConditions = {}
): Promise<Locator> {
  const element = page.locator(selector);
  const timeout = conditions.timeout || 30000;

  const waitPromises: Promise<unknown>[] = [];

  if (conditions.visible) {
    waitPromises.push(element.waitFor({ state: 'visible', timeout }));
  }

  if (conditions.hidden) {
    waitPromises.push(element.waitFor({ state: 'hidden', timeout }));
  }

  if (conditions.stable) {
    // Wait for element to stop moving/changing
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel) as HTMLElement;
        if (!el) return false;

        const rect1 = el.getBoundingClientRect();
        return new Promise((resolve) => {
          setTimeout(() => {
            const rect2 = el.getBoundingClientRect();
            resolve(
              rect1.x === rect2.x &&
              rect1.y === rect2.y &&
              rect1.width === rect2.width &&
              rect1.height === rect2.height
            );
          }, 100);
        });
      },
      selector,
      { timeout }
    );
  }

  if (conditions.enabled) {
    await element.waitFor({ state: 'visible', timeout });
    await page.waitForFunction(
      (sel) => !document.querySelector(sel)?.disabled,
      selector,
      { timeout }
    );
  }

  if (conditions.disabled) {
    await element.waitFor({ state: 'visible', timeout });
    await page.waitForFunction(
      (sel) => document.querySelector(sel)?.disabled === true,
      selector,
      { timeout }
    );
  }

  if (waitPromises.length > 0) {
    await Promise.all(waitPromises);
  }

  return element;
}

/**
 * Safely clicks an element with retry logic
 */
export async function safeClick(
  page: Page,
  selector: string,
  options: { retries?: number; delay?: number } = {}
): Promise<void> {
  const retries = options.retries || 3;
  const delay = options.delay || 1000;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Wait for element to be visible and enabled
      const element = await waitForElement(page, selector, {
        visible: true,
        enabled: true,
        timeout: 10000,
      });

      // Scroll element into view
      await element.scrollIntoViewIfNeeded();

      // Click the element
      await element.click();

      return; // Success
    } catch (error) {
      if (attempt === retries) {
        throw new Error(`Failed to click "${selector}" after ${retries} attempts: ${error}`);
      }

      console.warn(`Click attempt ${attempt} failed for "${selector}":`, error);
      await page.waitForTimeout(delay);
    }
  }
}

/**
 * Safely fills an input field with validation
 */
export async function safeFill(
  page: Page,
  selector: string,
  value: string,
  options: { clear?: boolean; verify?: boolean } = {}
): Promise<void> {
  const element = await waitForElement(page, selector, {
    visible: true,
    enabled: true,
  });

  // Clear existing content if requested
  if (options.clear ?? true) {
    await element.clear();
  }

  // Fill the input
  await element.fill(value);

  // Verify the value was set correctly
  if (options.verify ?? true) {
    const actualValue = await element.inputValue();
    if (actualValue !== value) {
      throw new Error(
        `Failed to fill "${selector}" with "${value}". Actual value: "${actualValue}"`
      );
    }
  }
}

/**
 * Waits for network requests to complete
 */
export async function waitForNetworkIdle(
  page: Page,
  options: { timeout?: number; idleTime?: number } = {}
): Promise<void> {
  const timeout = options.timeout || 30000;
  const idleTime = options.idleTime || 500;

  await page.waitForLoadState('networkidle', { timeout });

  // Additional wait for any remaining requests
  await page.waitForTimeout(idleTime);
}

/**
 * Measures page performance metrics
 */
export async function measurePerformance(
  page: Page,
  action: () => Promise<void>
): Promise<PerformanceMeasurement> {
  const startTime = Date.now();

  // Execute the action
  await action();

  const endTime = Date.now();
  const duration = endTime - startTime;

  // Get navigation timing if available
  const navigationTiming = await page.evaluate(() => {
    if (window.performance && window.performance.timing) {
      return window.performance.timing.toJSON();
    }
    return undefined;
  });

  // Get performance metrics if available
  const metrics = await page.evaluate(() => {
    if (window.performance && window.performance.getEntriesByType) {
      const entries = window.performance.getEntriesByType('navigation');
      if (entries.length > 0) {
        const entry = entries[0] as PerformanceNavigationTiming;
        return {
          domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
          loadComplete: entry.loadEventEnd - entry.loadEventStart,
          firstPaint: entry.domContentLoadedEventStart - entry.fetchStart,
        };
      }
    }
    return {};
  });

  return {
    startTime,
    endTime,
    duration,
    navigationTiming,
    metrics,
  };
}

/**
 * Handles alert dialogs automatically
 */
export async function setupAlertHandler(
  page: Page,
  handler: 'accept' | 'dismiss' | ((message: string) => boolean) = 'accept'
): Promise<void> {
  page.on('dialog', async (dialog) => {
    const message = dialog.message();
    console.log(`Dialog appeared: ${dialog.type()} - ${message}`);

    if (typeof handler === 'function') {
      const shouldAccept = handler(message);
      if (shouldAccept) {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    } else if (handler === 'accept') {
      await dialog.accept();
    } else {
      await dialog.dismiss();
    }
  });
}

/**
 * Captures console messages during test execution
 */
export async function captureConsoleMessages(
  page: Page,
  action: () => Promise<void>
): Promise<Array<{ type: string; text: string; timestamp: number }>> {
  const messages: Array<{ type: string; text: string; timestamp: number }> = [];

  const consoleHandler = (msg: any) => {
    messages.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: Date.now(),
    });
  };

  page.on('console', consoleHandler);

  try {
    await action();
  } finally {
    page.off('console', consoleHandler);
  }

  return messages;
}

/**
 * Handles page errors and captures them
 */
export async function capturePageErrors(
  page: Page,
  action: () => Promise<void>
): Promise<Array<{ message: string; stack?: string; timestamp: number }>> {
  const errors: Array<{ message: string; stack?: string; timestamp: number }> = [];

  const errorHandler = (error: Error) => {
    errors.push({
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
    });
  };

  const pageErrorHandler = (error: Error) => {
    errors.push({
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
    });
  };

  page.on('pageerror', pageErrorHandler);
  page.on('requestfailed', (request) => {
    errors.push({
      message: `Request failed: ${request.url()} - ${request.failure()?.errorText}`,
      timestamp: Date.now(),
    });
  });

  try {
    await action();
  } finally {
    page.off('pageerror', pageErrorHandler);
  }

  return errors;
}

/**
 * Utility to run a test with cleanup
 */
export async function withBrowserTest<T>(
  testFn: (page: Page) => Promise<T>,
  page: Page,
  cleanup?: () => Promise<void>
): Promise<T> {
  try {
    const result = await testFn(page);
    return result;
  } finally {
    if (cleanup) {
      try {
        await cleanup();
      } catch (cleanupError) {
        console.warn('Cleanup failed:', cleanupError);
      }
    }
  }
}

/**
 * Creates a mock server for testing network requests
 */
export async function setupMockServer(
  page: Page,
  routes: Record<string, { status: number; body: any; headers?: Record<string, string> }>
): Promise<void> {
  for (const [pattern, response] of Object.entries(routes)) {
    await page.route(pattern, (route) => {
      route.fulfill({
        status: response.status,
        headers: response.headers || { 'Content-Type': 'application/json' },
        body: JSON.stringify(response.body),
      });
    });
  }
}

// Export all utility functions
export {
  ScreenshotOptions,
  WaitConditions,
  PerformanceMeasurement,
};