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

/**
 * Create a temporary directory for test artifacts
 */
export async function createTempDir(): Promise<string> {
  const os = await import('os');
  const fs = await import('fs/promises');
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-browser-test-'));
  return tempDir;
}

/**
 * Cleanup temporary directory
 */
export async function cleanupTempDir(tempDir: string): Promise<void> {
  const fs = await import('fs/promises');
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('Failed to cleanup temp directory:', error);
  }
}

/**
 * Create test page and return URL (data: URL with rich content)
 */
export async function createTestPage(): Promise<string> {
  const testPageHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>APEX Browser Test Page</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.6;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .test-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        .test-header {
            background: #2c3e50;
            color: white;
            padding: 30px;
            text-align: center;
        }

        .test-header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }

        .test-header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }

        .test-content {
            padding: 40px;
        }

        .content-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            margin-bottom: 40px;
        }

        .content-card {
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            padding: 25px;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .content-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }

        .content-card h3 {
            color: #2c3e50;
            margin-bottom: 15px;
            font-size: 1.4rem;
        }

        .content-card p {
            color: #6c757d;
            margin-bottom: 15px;
        }

        .feature-list {
            list-style: none;
            margin: 20px 0;
        }

        .feature-list li {
            padding: 8px 0;
            border-bottom: 1px solid #e9ecef;
        }

        .feature-list li:before {
            content: "✓ ";
            color: #28a745;
            font-weight: bold;
            margin-right: 8px;
        }

        .code-block {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 15px;
            font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
            font-size: 0.9rem;
            overflow-x: auto;
            margin: 20px 0;
        }

        .test-footer {
            background: #343a40;
            color: white;
            padding: 30px;
            text-align: center;
        }

        .footer-links {
            margin: 20px 0;
        }

        .footer-links a {
            color: #adb5bd;
            text-decoration: none;
            margin: 0 15px;
            transition: color 0.3s ease;
        }

        .footer-links a:hover {
            color: white;
        }

        .empty-element {
            /* Empty element for testing */
        }

        .dynamic-content {
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
        }

        @media print {
            body {
                background: white;
            }

            .test-container {
                box-shadow: none;
                border: 1px solid #ccc;
            }

            .dynamic-content {
                background: #f0f0f0 !important;
                color: #333 !important;
                -webkit-print-color-adjust: exact;
            }
        }

        @media (max-width: 768px) {
            .content-grid {
                grid-template-columns: 1fr;
            }

            .test-header h1 {
                font-size: 2rem;
            }

            .test-content {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="test-container">
        <header class="test-header">
            <h1>APEX Browser Automation Test Page</h1>
            <p>Comprehensive test page for screenshot and content capture functionality</p>
        </header>

        <main class="test-content">
            <div class="content-grid">
                <div class="content-card">
                    <h3>Screenshot Testing</h3>
                    <p>This section tests various screenshot capture scenarios including full page, element-specific, and different formats.</p>
                    <ul class="feature-list">
                        <li>Full page screenshots</li>
                        <li>Element screenshots</li>
                        <li>PNG and JPEG formats</li>
                        <li>Quality settings</li>
                        <li>Multiple viewports</li>
                    </ul>
                </div>

                <div class="content-card">
                    <h3>Content Extraction</h3>
                    <p>Testing HTML and text content extraction from various page elements and structures.</p>
                    <ul class="feature-list">
                        <li>Full page HTML extraction</li>
                        <li>Element-specific HTML</li>
                        <li>Plain text extraction</li>
                        <li>Structured content</li>
                        <li>Dynamic content</li>
                    </ul>
                </div>

                <div class="content-card">
                    <h3>PDF Generation</h3>
                    <p>Comprehensive PDF generation testing with various page layouts and print media styles.</p>
                    <ul class="feature-list">
                        <li>Standard page formats</li>
                        <li>Custom margins</li>
                        <li>Landscape orientation</li>
                        <li>Print media CSS</li>
                        <li>Background graphics</li>
                    </ul>
                </div>

                <div class="content-card">
                    <h3>Cross-Browser Testing</h3>
                    <p>Ensuring consistent behavior across different browser engines and automation backends.</p>
                    <ul class="feature-list">
                        <li>Chromium compatibility</li>
                        <li>Firefox support</li>
                        <li>WebKit testing</li>
                        <li>Playwright backend</li>
                        <li>Responsive design</li>
                    </ul>
                </div>
            </div>

            <div class="dynamic-content">
                <h2>Dynamic Test Content</h2>
                <p>This section contains dynamic content that changes color and appearance, useful for visual regression testing.</p>
                <div class="code-block">
console.log("APEX Browser Automation Test");
const testData = {
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    viewport: {
        width: window.innerWidth,
        height: window.innerHeight
    }
};
                </div>
            </div>

            <div class="content-card">
                <h3>Error Handling Tests</h3>
                <p>This section tests various error conditions and edge cases:</p>
                <ul class="feature-list">
                    <li>Missing elements (.non-existent-selector)</li>
                    <li>Malformed selectors</li>
                    <li>Network timeouts</li>
                    <li>Permission restrictions</li>
                    <li>Resource cleanup</li>
                </ul>
            </div>

            <div class="empty-element"></div>
        </main>

        <footer class="test-footer">
            <h3>APEX Integration Testing</h3>
            <div class="footer-links">
                <a href="#screenshot">Screenshot Tests</a>
                <a href="#content">Content Tests</a>
                <a href="#pdf">PDF Tests</a>
                <a href="#errors">Error Tests</a>
            </div>
            <p>&copy; 2024 APEX - Autonomous Product Engineering eXecutor</p>
        </footer>
    </div>

    <script>
        // Add some dynamic behavior for testing
        document.addEventListener('DOMContentLoaded', function() {
            console.log('APEX Test Page Loaded');
            console.log('Viewport:', window.innerWidth + 'x' + window.innerHeight);
            console.log('User Agent:', navigator.userAgent);

            // Add timestamp to dynamic content
            const timestamp = new Date().toISOString();
            document.querySelector('.dynamic-content p').innerHTML +=
                '<br><small>Page loaded at: ' + timestamp + '</small>';
        });

        // Test console messages
        setTimeout(() => {
            console.info('Test info message');
            console.warn('Test warning message');
            console.error('Test error message (intentional)');
        }, 100);
    </script>
</body>
</html>
  `.trim();

  // Convert to data URL
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;
  return dataUrl;
}

// Export all utility functions
export {
  ScreenshotOptions,
  WaitConditions,
  PerformanceMeasurement,
};