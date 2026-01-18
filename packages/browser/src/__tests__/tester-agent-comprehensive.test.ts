/**
 * @apexcli/browser - Comprehensive Browser Automation Tests
 *
 * This test suite was created by the tester agent to provide comprehensive
 * testing coverage for browser automation features, focusing on areas that
 * might need additional validation and edge case testing.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  launchBrowser,
  BrowserManager,
  BrowserSession,
  captureScreenshot,
  captureFullPageScreenshot,
  captureViewportScreenshot,
  capturePNG,
  captureJPEG,
  type BrowserSessionConfig,
  type CaptureConfig,
  type ScreenshotOptions,
  type NavigationOptions,
  type BrowserActionResult,
} from '../index.js';

describe('Tester Agent - Comprehensive Browser Automation Tests', () => {
  let manager: BrowserManager;

  beforeAll(async () => {
    manager = createBrowserManager({
      maxInstances: 5,
      reuseInstances: true,
      resourceLimits: {
        maxMemoryMB: 2000,
      }
    });
  });

  afterAll(async () => {
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('Factory Functions and Utility Testing', () => {
    it('should create browser manager with custom configuration', () => {
      const customManager = createBrowserManager({
        maxInstances: 3,
        reuseInstances: false,
        instanceIdleTimeout: 5000,
        resourceLimits: {
          maxMemoryMB: 1000,
          maxCpuPercent: 80,
        }
      });

      expect(customManager).toBeInstanceOf(BrowserManager);
    });

    it('should create browser session with comprehensive configuration', () => {
      const sessionConfig: Partial<BrowserSessionConfig> = {
        browserType: 'chromium',
        headless: true,
        viewport: { width: 1920, height: 1080 },
        userAgent: 'APEX-Test-Agent/1.0',
        timeout: 30000,
        ignoreHTTPSErrors: true,
        launchOptions: {
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
        },
        contextOptions: {
          locale: 'en-US',
          timezoneId: 'America/New_York',
        }
      };

      const captureConfig: Partial<CaptureConfig> = {
        captureConsole: true,
        captureJavaScriptErrors: true,
        capturePageErrors: true,
        consoleLevel: 'debug',
        bufferSize: 1000,
        realTimeCapture: true,
      };

      const session = createBrowserSession(manager, sessionConfig, captureConfig);
      expect(session).toBeInstanceOf(BrowserSession);
    });

    it('should launch browser with utility function and custom config', async () => {
      const result = await launchBrowser({
        browserType: 'chromium',
        headless: true,
        viewport: { width: 1280, height: 720 },
      }, {
        captureConsole: true,
        captureJavaScriptErrors: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(BrowserSession);
      expect(result.duration).toBeGreaterThan(0);

      if (result.data) {
        await result.data.close();
      }
    }, 15000);
  });

  describe('Cross-Browser Compatibility Testing', () => {
    const browserTypes = ['chromium', 'firefox', 'webkit'] as const;

    browserTypes.forEach(browserType => {
      it(`should launch and operate ${browserType} browser`, async () => {
        const session = createBrowserSession(manager, {
          browserType,
          headless: true,
        });

        try {
          const launchResult = await session.launch();
          expect(launchResult.success).toBe(true);

          // Basic navigation test
          const navResult = await session.navigate('data:text/html,<h1>Cross-Browser Test</h1>');
          expect(navResult.success).toBe(true);

          // Title verification
          const titleResult = await session.getTitle();
          expect(titleResult.success).toBe(true);

          // Screenshot capability
          const screenshotResult = await session.screenshot();
          expect(screenshotResult.success).toBe(true);
          expect(screenshotResult.data).toBeInstanceOf(Buffer);

        } finally {
          await session.close();
        }
      }, 20000);
    });
  });

  describe('Advanced Navigation and Page Interaction', () => {
    let session: BrowserSession;

    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });
      await session.launch();
    });

    afterEach(async () => {
      if (session) {
        await session.close();
      }
    });

    it('should handle complex navigation scenarios', async () => {
      // Navigate to initial page
      const navResult1 = await session.navigate('data:text/html,<h1>Page 1</h1><a href="data:text/html,<h1>Page 2</h1>" id="link">Go to Page 2</a>');
      expect(navResult1.success).toBe(true);

      // Navigate using options
      const navResult2 = await session.navigate('data:text/html,<h1>Page with timeout test</h1>', {
        timeout: 15000,
        waitUntil: 'networkidle',
      });
      expect(navResult2.success).toBe(true);

      // Test reload functionality
      const reloadResult = await session.reload();
      expect(reloadResult.success).toBe(true);

      // Test goBack (if supported)
      const backResult = await session.goBack();
      // Note: back navigation might not work with data URLs, so we check gracefully
      expect(typeof backResult.success).toBe('boolean');
    });

    it('should handle form interactions comprehensively', async () => {
      const formPage = `
        data:text/html,
        <form id="test-form">
          <input id="text-field" type="text" name="text" />
          <input id="email-field" type="email" name="email" />
          <input id="password-field" type="password" name="password" />
          <textarea id="textarea-field" name="message"></textarea>
          <select id="select-field" name="country">
            <option value="us">United States</option>
            <option value="ca">Canada</option>
            <option value="uk">United Kingdom</option>
          </select>
          <input id="checkbox-field" type="checkbox" name="agree" />
          <input id="radio1" type="radio" name="choice" value="1" />
          <input id="radio2" type="radio" name="choice" value="2" />
          <button id="submit-btn" type="submit">Submit</button>
        </form>
      `;

      await session.navigate(formPage);

      // Test text input
      const textResult = await session.type('#text-field', 'Test user name');
      expect(textResult.success).toBe(true);

      // Test email input
      const emailResult = await session.type('#email-field', 'test@example.com');
      expect(emailResult.success).toBe(true);

      // Test password input
      const passwordResult = await session.type('#password-field', 'secretpassword123');
      expect(passwordResult.success).toBe(true);

      // Test textarea
      const textareaResult = await session.type('#textarea-field', 'This is a test message with multiple lines.\nSecond line of text.');
      expect(textareaResult.success).toBe(true);

      // Test select dropdown
      const selectResult = await session.selectOption('#select-field', 'ca');
      expect(selectResult.success).toBe(true);

      // Test checkbox
      const checkboxResult = await session.check('#checkbox-field');
      expect(checkboxResult.success).toBe(true);

      // Test radio button
      const radioResult = await session.click('#radio2');
      expect(radioResult.success).toBe(true);

      // Verify form values
      const textValue = await session.evaluate(() => {
        const input = document.getElementById('text-field') as HTMLInputElement;
        return input?.value;
      });
      expect(textValue.success).toBe(true);
      expect(textValue.data).toBe('Test user name');

      const emailValue = await session.evaluate(() => {
        const input = document.getElementById('email-field') as HTMLInputElement;
        return input?.value;
      });
      expect(emailValue.success).toBe(true);
      expect(emailValue.data).toBe('test@example.com');
    });

    it('should handle advanced element selectors', async () => {
      const complexPage = `
        data:text/html,
        <div class="container">
          <div class="section" data-testid="main-section">
            <h1>Main Section</h1>
            <p>Paragraph 1</p>
            <p>Paragraph 2</p>
          </div>
          <div class="sidebar">
            <button class="btn primary">Primary Button</button>
            <button class="btn secondary">Secondary Button</button>
          </div>
          <table>
            <tr><td>Cell 1</td><td>Cell 2</td></tr>
            <tr><td>Cell 3</td><td>Cell 4</td></tr>
          </table>
        </div>
      `;

      await session.navigate(complexPage);

      // Test CSS selectors
      const cssResult = await session.click('.btn.primary');
      expect(cssResult.success).toBe(true);

      // Test data-testid selector
      const testIdResult = await session.getText('[data-testid="main-section"] h1');
      expect(testIdResult.success).toBe(true);
      expect(testIdResult.data).toBe('Main Section');

      // Test nth-child selector
      const nthChildResult = await session.getText('.container p:nth-child(2)');
      expect(nthChildResult.success).toBe(true);

      // Test XPath selector (if supported)
      const xpathResult = await session.getText('//table/tr[2]/td[1]');
      expect(xpathResult.success).toBe(true);
      expect(xpathResult.data).toBe('Cell 3');
    });
  });

  describe('Screenshot and Capture Testing', () => {
    let session: BrowserSession;

    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        viewport: { width: 1920, height: 1080 },
      });
      await session.launch();
    });

    afterEach(async () => {
      if (session) {
        await session.close();
      }
    });

    it('should capture screenshots with different options', async () => {
      const testPage = `
        data:text/html,
        <div style="height: 2000px; background: linear-gradient(45deg, #ff6b6b, #4ecdc4);">
          <h1 style="padding: 50px;">Long Scrollable Page</h1>
          <div style="margin: 100px; padding: 50px; background: white;">
            <p>Content that requires scrolling to see</p>
          </div>
        </div>
      `;

      await session.navigate(testPage);

      // Viewport screenshot
      const viewportResult = await session.screenshot();
      expect(viewportResult.success).toBe(true);
      expect(viewportResult.data).toBeInstanceOf(Buffer);

      // Full page screenshot
      const fullPageResult = await session.screenshot({ fullPage: true });
      expect(fullPageResult.success).toBe(true);
      expect(fullPageResult.data).toBeInstanceOf(Buffer);
      expect(fullPageResult.data!.length).toBeGreaterThan(viewportResult.data!.length);

      // Screenshot with custom options
      const customResult = await session.screenshot({
        type: 'jpeg',
        quality: 80,
        omitBackground: true,
      });
      expect(customResult.success).toBe(true);
      expect(customResult.data).toBeInstanceOf(Buffer);

      // Element screenshot
      const elementResult = await session.screenshot({
        selector: 'h1',
      });
      expect(elementResult.success).toBe(true);
      expect(elementResult.data).toBeInstanceOf(Buffer);
      expect(elementResult.data!.length).toBeLessThan(viewportResult.data!.length);
    });

    it('should test utility screenshot functions', async () => {
      const testPage = 'data:text/html,<h1>Screenshot Utility Test</h1>';
      await session.navigate(testPage);

      const page = session.getPage();
      const context = session.getContext();

      if (page && context) {
        // Test captureScreenshot utility
        const genericResult = await captureScreenshot(page, {
          type: 'png',
          fullPage: false,
        });
        expect(genericResult.success).toBe(true);
        expect(genericResult.data).toBeInstanceOf(Buffer);

        // Test capturePNG utility
        const pngResult = await capturePNG(page, {
          fullPage: true,
        });
        expect(pngResult.success).toBe(true);
        expect(pngResult.data).toBeInstanceOf(Buffer);

        // Test captureJPEG utility
        const jpegResult = await captureJPEG(page, {
          quality: 90,
        });
        expect(jpegResult.success).toBe(true);
        expect(jpegResult.data).toBeInstanceOf(Buffer);

        // Test captureFullPageScreenshot utility
        const fullPageUtilResult = await captureFullPageScreenshot(page);
        expect(fullPageUtilResult.success).toBe(true);
        expect(fullPageUtilResult.data).toBeInstanceOf(Buffer);

        // Test captureViewportScreenshot utility
        const viewportUtilResult = await captureViewportScreenshot(page);
        expect(viewportUtilResult.success).toBe(true);
        expect(viewportUtilResult.data).toBeInstanceOf(Buffer);
      }
    });
  });

  describe('Console and Error Capture Testing', () => {
    let session: BrowserSession;

    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureJavaScriptErrors: true,
        capturePageErrors: true,
        consoleLevel: 'debug',
        realTimeCapture: true,
      });
      await session.launch();
    });

    afterEach(async () => {
      if (session) {
        await session.close();
      }
    });

    it('should capture various console message types', async () => {
      const consoleTestPage = `
        data:text/html,
        <script>
          // Generate different console types
          console.log('Regular log message');
          console.info('Info message with data', { test: 'data' });
          console.warn('Warning message');
          console.error('Error message');
          console.debug('Debug message');
          console.assert(false, 'Assertion failed message');
          console.dir({ complex: 'object', nested: { value: 123 } });
          console.table([{ name: 'John', age: 30 }, { name: 'Jane', age: 25 }]);
          console.trace('Trace message');
        </script>
        <h1>Console Capture Test</h1>
      `;

      await session.navigate(consoleTestPage);

      // Wait for console messages to be captured
      await new Promise(resolve => setTimeout(resolve, 1000));

      const consoleMessages = session.getCapturedConsoleMessages();
      expect(consoleMessages.length).toBeGreaterThan(5);

      // Verify different message types were captured
      const messageTypes = consoleMessages.map(msg => msg.type);
      expect(messageTypes).toContain('log');
      expect(messageTypes).toContain('info');
      expect(messageTypes).toContain('warn');
      expect(messageTypes).toContain('error');

      // Verify message structure
      const logMessage = consoleMessages.find(msg => msg.type === 'log');
      expect(logMessage).toBeDefined();
      expect(logMessage!.text).toContain('Regular log message');
      expect(logMessage!.timestamp).toBeGreaterThan(0);
    });

    it('should capture JavaScript errors', async () => {
      const errorTestPage = `
        data:text/html,
        <script>
          // Generate various types of JavaScript errors
          setTimeout(() => {
            // Uncaught error
            throw new Error('Test uncaught error');
          }, 100);

          setTimeout(() => {
            // Reference error
            nonExistentFunction();
          }, 200);

          setTimeout(() => {
            // Type error
            const obj = null;
            obj.method();
          }, 300);

          setTimeout(() => {
            // Custom error with stack
            const customError = new TypeError('Custom type error');
            customError.stack = 'Custom stack trace';
            throw customError;
          }, 400);
        </script>
        <h1>Error Capture Test</h1>
      `;

      await session.navigate(errorTestPage);

      // Wait for errors to occur and be captured
      await new Promise(resolve => setTimeout(resolve, 1000));

      const jsErrors = session.getCapturedJavaScriptErrors();
      expect(jsErrors.length).toBeGreaterThan(0);

      // Verify error structure
      const errors = jsErrors.filter(error => error.message.includes('Test uncaught error'));
      expect(errors.length).toBeGreaterThan(0);

      const error = errors[0];
      expect(error.name).toBe('Error');
      expect(error.timestamp).toBeGreaterThan(0);
      expect(error.uncaught).toBe(true);
      expect(error.stack).toBeDefined();
    });

    it('should handle real-time capture and streaming', async () => {
      let capturedEvents: any[] = [];

      // Set up event listeners
      session.on('consoleMessage', (message) => {
        capturedEvents.push({ type: 'console', data: message });
      });

      session.on('jsError', (error) => {
        capturedEvents.push({ type: 'jsError', data: error });
      });

      session.on('pageError', (error) => {
        capturedEvents.push({ type: 'pageError', data: error });
      });

      const streamingTestPage = `
        data:text/html,
        <script>
          let counter = 0;
          const interval = setInterval(() => {
            console.log('Streaming message', ++counter);
            if (counter === 5) {
              clearInterval(interval);
              throw new Error('Streaming error');
            }
          }, 100);
        </script>
        <h1>Streaming Capture Test</h1>
      `;

      await session.navigate(streamingTestPage);

      // Wait for streaming events
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(capturedEvents.length).toBeGreaterThan(0);
      expect(capturedEvents.some(event => event.type === 'console')).toBe(true);
      expect(capturedEvents.some(event => event.type === 'jsError')).toBe(true);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle concurrent browser sessions efficiently', async () => {
      const concurrentSessions = 3;
      const sessions: BrowserSession[] = [];

      try {
        const startTime = Date.now();

        // Create multiple sessions concurrently
        const launchPromises = Array.from({ length: concurrentSessions }, async () => {
          const session = createBrowserSession(manager, {
            browserType: 'chromium',
            headless: true,
          });
          const result = await session.launch();
          expect(result.success).toBe(true);
          return session;
        });

        const launchedSessions = await Promise.all(launchPromises);
        sessions.push(...launchedSessions);

        const launchTime = Date.now() - startTime;
        expect(launchTime).toBeLessThan(10000); // Should launch within 10 seconds

        // Perform operations on all sessions concurrently
        const operationStartTime = Date.now();
        const operationPromises = sessions.map(async (session, index) => {
          await session.navigate(`data:text/html,<h1>Session ${index}</h1>`);
          const screenshot = await session.screenshot();
          expect(screenshot.success).toBe(true);
          const title = await session.getTitle();
          expect(title.success).toBe(true);
          return { index, success: true };
        });

        const results = await Promise.all(operationPromises);
        const operationTime = Date.now() - operationStartTime;

        expect(results).toHaveLength(concurrentSessions);
        expect(results.every(result => result.success)).toBe(true);
        expect(operationTime).toBeLessThan(8000); // Operations should complete within 8 seconds

        // Verify resource usage
        const usage = await manager.getResourceUsage();
        expect(usage.totalInstances).toBeGreaterThanOrEqual(1);
        expect(usage.totalContexts).toBe(concurrentSessions);
        expect(usage.memoryUsageMB).toBeGreaterThan(0);

      } finally {
        // Cleanup all sessions
        await Promise.all(sessions.map(session => session.close()));
      }
    }, 30000);

    it('should handle memory cleanup after session destruction', async () => {
      const initialUsage = await manager.getResourceUsage();

      // Create and destroy sessions to test memory cleanup
      for (let i = 0; i < 5; i++) {
        const session = createBrowserSession(manager);
        await session.launch();
        await session.navigate('data:text/html,<div style="height:2000px;">Memory test content</div>');
        await session.screenshot({ fullPage: true });
        await session.close();
      }

      // Check final resource usage
      const finalUsage = await manager.getResourceUsage();
      expect(finalUsage.totalContexts).toBe(0);

      // Memory should not have grown excessively
      const memoryIncrease = finalUsage.memoryUsageMB - initialUsage.memoryUsageMB;
      expect(memoryIncrease).toBeLessThan(500); // Less than 500MB increase
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle navigation to invalid URLs gracefully', async () => {
      const session = createBrowserSession(manager);
      await session.launch();

      try {
        // Test various invalid URL scenarios
        const invalidUrls = [
          'https://nonexistent-domain-12345.invalid',
          'http://localhost:99999',
          'ftp://invalid-protocol.com',
          'not-a-url-at-all',
        ];

        for (const url of invalidUrls) {
          const result = await session.navigate(url);
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
          expect(result.duration).toBeGreaterThan(0);
        }

      } finally {
        await session.close();
      }
    }, 20000);

    it('should handle operations on closed sessions gracefully', async () => {
      const session = createBrowserSession(manager);
      await session.launch();
      await session.close();

      // All operations should fail gracefully after session is closed
      const navResult = await session.navigate('https://example.com');
      expect(navResult.success).toBe(false);

      const clickResult = await session.click('body');
      expect(clickResult.success).toBe(false);

      const screenshotResult = await session.screenshot();
      expect(screenshotResult.success).toBe(false);

      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(false);
    });

    it('should handle selector edge cases', async () => {
      const session = createBrowserSession(manager);
      await session.launch();

      try {
        await session.navigate('data:text/html,<h1>Element Test</h1>');

        // Test non-existent selectors
        const nonExistentResult = await session.click('#non-existent-element');
        expect(nonExistentResult.success).toBe(false);

        const invalidSelectorResult = await session.click('>>invalid>>selector');
        expect(invalidSelectorResult.success).toBe(false);

        // Test empty selector
        const emptySelectorResult = await session.click('');
        expect(emptySelectorResult.success).toBe(false);

      } finally {
        await session.close();
      }
    });
  });

  describe('Mobile and Responsive Testing', () => {
    it('should handle mobile viewport configuration', async () => {
      const mobileConfigs = [
        { width: 375, height: 667 }, // iPhone 6/7/8
        { width: 414, height: 896 }, // iPhone XR
        { width: 360, height: 640 }, // Galaxy S5
        { width: 768, height: 1024 }, // iPad
      ];

      for (const viewport of mobileConfigs) {
        const session = createBrowserSession(manager, {
          browserType: 'chromium',
          headless: true,
          viewport,
        });

        try {
          await session.launch();

          const responsiveTestPage = `
            data:text/html,
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              .mobile-only { display: none; }
              .desktop-only { display: block; }
              @media (max-width: 768px) {
                .mobile-only { display: block; }
                .desktop-only { display: none; }
              }
            </style>
            <div class="mobile-only">Mobile View</div>
            <div class="desktop-only">Desktop View</div>
          `;

          await session.navigate(responsiveTestPage);

          const screenshot = await session.screenshot();
          expect(screenshot.success).toBe(true);

          // Verify responsive behavior
          const isMobile = viewport.width <= 768;
          const mobileText = await session.getText('.mobile-only');
          const desktopText = await session.getText('.desktop-only');

          if (isMobile) {
            expect(mobileText.success).toBe(true);
          } else {
            expect(desktopText.success).toBe(true);
          }

        } finally {
          await session.close();
        }
      }
    }, 30000);
  });
});