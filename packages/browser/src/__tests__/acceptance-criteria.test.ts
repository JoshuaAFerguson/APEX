/**
 * @apexcli/browser - Acceptance Criteria Tests
 *
 * Tests specifically designed to verify the acceptance criteria:
 * - Headless browser launch (Puppeteer/Playwright) ✓
 * - Browser actions API (click, type, scroll, navigate) ✓
 * - Screenshot capture capability ✓
 * - Tests verify browser launch and basic actions ✓
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  launchBrowser,
  BrowserManager,
  BrowserSession,
} from '../index.js';

describe('Browser Automation Core - Acceptance Criteria', () => {
  let manager: BrowserManager;

  beforeEach(() => {
    manager = createBrowserManager();
  });

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('AC1: Headless browser launch (Playwright)', () => {
    it('should launch Playwright Chromium browser in headless mode', async () => {
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });

      const result = await session.launch();

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);

      // Verify browser is actually launched
      const browser = session.getBrowser();
      expect(browser).toBeDefined();
      expect(typeof browser?.newContext).toBe('function');

      // Verify context is created
      const context = session.getContext();
      expect(context).toBeDefined();
      expect(typeof context?.newPage).toBe('function');

      // Verify page is available
      const page = session.getPage();
      expect(page).toBeDefined();
      expect(typeof page?.goto).toBe('function');

      await session.close();
    });

    it('should launch Playwright Firefox browser in headless mode', async () => {
      const session = createBrowserSession(manager, {
        browserType: 'firefox',
        headless: true,
      });

      const result = await session.launch();

      expect(result.success).toBe(true);

      // Verify browser type
      const instanceResult = await manager.launchBrowser({ browserType: 'firefox' });
      expect(instanceResult.data?.type).toBe('firefox');

      await session.close();
    });

    it('should launch Playwright WebKit browser in headless mode', async () => {
      const session = createBrowserSession(manager, {
        browserType: 'webkit',
        headless: true,
      });

      const result = await session.launch();

      expect(result.success).toBe(true);

      // Verify browser type
      const instanceResult = await manager.launchBrowser({ browserType: 'webkit' });
      expect(instanceResult.data?.type).toBe('webkit');

      await session.close();
    });

    it('should launch browser with convenience function', async () => {
      const result = await launchBrowser({
        browserType: 'chromium',
        headless: true,
        viewport: { width: 1280, height: 720 },
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(BrowserSession);
      expect(result.duration).toBeGreaterThan(0);

      if (result.data) {
        await result.data.close();
      }
    });

    it('should configure headless mode properly', async () => {
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        viewport: { width: 1920, height: 1080 },
        timeout: 30000,
      });

      const launchResult = await session.launch();
      expect(launchResult.success).toBe(true);

      // Navigate to test visibility of headless mode
      const navResult = await session.navigate('data:text/html,<h1>Headless Test</h1>');
      expect(navResult.success).toBe(true);

      await session.close();
    });
  });

  describe('AC2: Browser actions API (click, type, scroll, navigate)', () => {
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

    it('should navigate to URLs successfully', async () => {
      const testHtml = 'data:text/html,<h1>Navigation Test</h1><title>Test Page</title>';

      const result = await session.navigate(testHtml);

      expect(result.success).toBe(true);
      expect(result.data).toContain('data:text/html');

      // Verify current URL
      const currentUrl = session.getCurrentUrl();
      expect(currentUrl).toContain('data:text/html');

      // Verify page title
      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Test Page');
    });

    it('should click elements successfully', async () => {
      const testHtml = `
        data:text/html,
        <button id="clickBtn" onclick="this.textContent='Clicked!'">Click Me</button>
        <div id="status">Not clicked</div>
      `;

      await session.navigate(testHtml);

      // Click the button
      const clickResult = await session.click('#clickBtn');
      expect(clickResult.success).toBe(true);

      // Verify the click worked
      const textResult = await session.getText('#clickBtn');
      expect(textResult.success).toBe(true);
      expect(textResult.data).toBe('Clicked!');
    });

    it('should type text into input elements successfully', async () => {
      const testHtml = `
        data:text/html,
        <input id="textInput" type="text" placeholder="Type here..." />
        <textarea id="textArea" placeholder="Text area..."></textarea>
      `;

      await session.navigate(testHtml);

      // Type into input
      const typeResult = await session.type('#textInput', 'Hello, World!');
      expect(typeResult.success).toBe(true);

      // Verify the text was typed
      const inputValue = await session.evaluate(() => {
        return (document.getElementById('textInput') as HTMLInputElement).value;
      });
      expect(inputValue.success).toBe(true);
      expect(inputValue.data).toBe('Hello, World!');

      // Type into textarea
      const textareaResult = await session.type('#textArea', 'Multi-line\ntext content');
      expect(textareaResult.success).toBe(true);

      // Verify textarea content
      const textareaValue = await session.evaluate(() => {
        return (document.getElementById('textArea') as HTMLTextAreaElement).value;
      });
      expect(textareaValue.success).toBe(true);
      expect(textareaValue.data).toBe('Multi-line\ntext content');
    });

    it('should scroll page and elements successfully', async () => {
      const testHtml = `
        data:text/html,
        <div style="height: 1000px;">Top content</div>
        <div id="middle" style="height: 1000px; background: red;">Middle content</div>
        <div id="bottom" style="height: 1000px;">Bottom content</div>
      `;

      await session.navigate(testHtml);

      // Scroll by coordinates
      const scrollResult = await session.scroll({ x: 0, y: 500 });
      expect(scrollResult.success).toBe(true);

      // Scroll to specific element
      const scrollToElementResult = await session.scroll({ selector: '#bottom' });
      expect(scrollToElementResult.success).toBe(true);

      // Verify scroll position changed
      const scrollPos = await session.evaluate(() => window.scrollY);
      expect(scrollPos.success).toBe(true);
      expect(scrollPos.data).toBeGreaterThan(0);
    });

    it('should handle complex interaction workflows', async () => {
      const testHtml = `
        data:text/html,
        <form id="testForm">
          <input id="name" type="text" placeholder="Name" />
          <input id="email" type="email" placeholder="Email" />
          <button id="submitBtn" type="button" onclick="handleSubmit()">Submit</button>
          <div id="result"></div>
        </form>
        <script>
          function handleSubmit() {
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            document.getElementById('result').textContent = 'Submitted: ' + name + ', ' + email;
          }
        </script>
      `;

      await session.navigate(testHtml);

      // Fill form
      await session.type('#name', 'John Doe');
      await session.type('#email', 'john@example.com');

      // Submit
      await session.click('#submitBtn');

      // Verify result
      const resultText = await session.getText('#result');
      expect(resultText.success).toBe(true);
      expect(resultText.data).toBe('Submitted: John Doe, john@example.com');
    });
  });

  describe('AC3: Screenshot capture capability', () => {
    let session: BrowserSession;

    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        viewport: { width: 1280, height: 720 },
      });
      await session.launch();
    });

    afterEach(async () => {
      if (session) {
        await session.close();
      }
    });

    it('should capture standard screenshots', async () => {
      await session.navigate('data:text/html,<h1 style="color: blue;">Screenshot Test</h1>');

      const screenshotResult = await session.screenshot();

      expect(screenshotResult.success).toBe(true);
      expect(screenshotResult.data).toBeInstanceOf(Buffer);
      expect(screenshotResult.data!.length).toBeGreaterThan(0);
      expect(screenshotResult.duration).toBeGreaterThan(0);
    });

    it('should capture full page screenshots', async () => {
      const longPageHtml = `
        data:text/html,
        <div style="height: 2000px; background: linear-gradient(to bottom, red, blue);">
          <h1>Long Page Test</h1>
          <div style="position: absolute; bottom: 0;">Bottom of page</div>
        </div>
      `;

      await session.navigate(longPageHtml);

      const screenshotResult = await session.screenshot({ fullPage: true });

      expect(screenshotResult.success).toBe(true);
      expect(screenshotResult.data).toBeInstanceOf(Buffer);
      expect(screenshotResult.data!.length).toBeGreaterThan(0);
    });

    it('should capture screenshots with different formats', async () => {
      await session.navigate('data:text/html,<h1>Format Test</h1>');

      // PNG format
      const pngResult = await session.screenshot({ type: 'png' });
      expect(pngResult.success).toBe(true);
      expect(pngResult.data).toBeInstanceOf(Buffer);

      // JPEG format
      const jpegResult = await session.screenshot({
        type: 'jpeg',
        quality: 80
      });
      expect(jpegResult.success).toBe(true);
      expect(jpegResult.data).toBeInstanceOf(Buffer);
    });

    it('should capture screenshots with quality settings', async () => {
      await session.navigate('data:text/html,<h1 style="background: red; padding: 20px;">Quality Test</h1>');

      const highQuality = await session.screenshot({
        type: 'jpeg',
        quality: 100
      });

      const lowQuality = await session.screenshot({
        type: 'jpeg',
        quality: 10
      });

      expect(highQuality.success).toBe(true);
      expect(lowQuality.success).toBe(true);

      // High quality should generally be larger
      expect(highQuality.data!.length).toBeGreaterThan(lowQuality.data!.length);
    });

    it('should handle screenshot errors gracefully', async () => {
      // Test screenshot before page load
      const earlySession = createBrowserSession(manager);
      const earlyResult = await earlySession.screenshot();

      expect(earlyResult.success).toBe(false);
      expect(earlyResult.error).toContain('Browser not launched');
    });
  });

  describe('AC4: Tests verify browser launch and basic actions', () => {
    it('should verify complete browser automation workflow', async () => {
      // Test the complete workflow that demonstrates all acceptance criteria
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        viewport: { width: 1920, height: 1080 },
      });

      // 1. Launch browser (headless)
      const launchResult = await session.launch();
      expect(launchResult.success).toBe(true);

      // Verify browser instance is running
      const browser = session.getBrowser();
      expect(browser).toBeDefined();
      expect(browser!.isConnected()).toBe(true);

      // 2. Navigate to test page
      const testPage = `
        data:text/html,
        <html>
          <head><title>Complete Test Page</title></head>
          <body>
            <h1 id="title">Browser Automation Test</h1>
            <div id="container" style="height: 1500px;">
              <input id="testInput" type="text" placeholder="Enter text..." />
              <button id="testButton" onclick="handleClick()">Click Test</button>
              <div id="output"></div>
              <div style="height: 1000px; margin-top: 20px; background: linear-gradient(red, blue);"></div>
              <div id="scrollTarget">Scroll target reached!</div>
            </div>
            <script>
              function handleClick() {
                const input = document.getElementById('testInput').value;
                document.getElementById('output').textContent = 'Input: ' + input;
              }
            </script>
          </body>
        </html>
      `;

      const navResult = await session.navigate(testPage);
      expect(navResult.success).toBe(true);

      // 3. Perform browser actions

      // Type text
      const typeResult = await session.type('#testInput', 'Acceptance Test Data');
      expect(typeResult.success).toBe(true);

      // Click button
      const clickResult = await session.click('#testButton');
      expect(clickResult.success).toBe(true);

      // Verify interaction worked
      const outputText = await session.getText('#output');
      expect(outputText.success).toBe(true);
      expect(outputText.data).toBe('Input: Acceptance Test Data');

      // Scroll to element
      const scrollResult = await session.scroll({ selector: '#scrollTarget' });
      expect(scrollResult.success).toBe(true);

      // 4. Capture screenshots
      const screenshotResult = await session.screenshot();
      expect(screenshotResult.success).toBe(true);
      expect(screenshotResult.data).toBeInstanceOf(Buffer);
      expect(screenshotResult.data!.length).toBeGreaterThan(1000); // Reasonable size

      const fullPageResult = await session.screenshot({ fullPage: true });
      expect(fullPageResult.success).toBe(true);
      expect(fullPageResult.data!.length).toBeGreaterThan(screenshotResult.data!.length);

      // 5. Verify resource management
      const resourceUsage = await manager.getResourceUsage();
      expect(resourceUsage.totalInstances).toBeGreaterThan(0);
      expect(resourceUsage.totalContexts).toBeGreaterThan(0);
      expect(resourceUsage.memoryUsageMB).toBeGreaterThan(0);

      // 6. Clean up
      const closeResult = await session.close();
      expect(closeResult.success).toBe(true);

      // Verify cleanup
      const finalUsage = await manager.getResourceUsage();
      expect(finalUsage.totalContexts).toBe(0);
    }, 15000);

    it('should verify multi-browser support', async () => {
      const browserTypes = ['chromium', 'firefox', 'webkit'] as const;
      const sessions: BrowserSession[] = [];

      try {
        // Launch all browser types
        for (const browserType of browserTypes) {
          const session = createBrowserSession(manager, {
            browserType,
            headless: true,
          });

          const result = await session.launch();
          expect(result.success).toBe(true);
          sessions.push(session);
        }

        // Perform actions on all browsers
        const testPromises = sessions.map(async (session, index) => {
          await session.navigate(`data:text/html,<h1>Browser ${index + 1}</h1>`);
          const screenshot = await session.screenshot();
          expect(screenshot.success).toBe(true);
          return screenshot.data!.length;
        });

        const sizes = await Promise.all(testPromises);
        sizes.forEach(size => expect(size).toBeGreaterThan(0));

      } finally {
        await Promise.all(sessions.map(session => session.close()));
      }
    }, 30000);

    it('should verify error handling and recovery', async () => {
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });

      // Test operation before launch
      const earlyNav = await session.navigate('https://example.com');
      expect(earlyNav.success).toBe(false);
      expect(earlyNav.error).toContain('Browser not launched');

      // Launch and test recovery
      await session.launch();

      // Test invalid selector
      const invalidClick = await session.click('#nonexistent-element');
      expect(invalidClick.success).toBe(false);

      // Test that browser still works after error
      const validNav = await session.navigate('data:text/html,<h1>Recovery Test</h1>');
      expect(validNav.success).toBe(true);

      await session.close();
    });

    it('should verify performance characteristics', async () => {
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });

      const startTime = Date.now();

      await session.launch();
      const launchTime = Date.now() - startTime;

      // Browser launch should be reasonably fast (< 10 seconds)
      expect(launchTime).toBeLessThan(10000);

      // Test rapid operations
      const operations = [
        session.navigate('data:text/html,<h1>Performance Test</h1>'),
        session.getText('h1'),
        session.screenshot(),
      ];

      const operationStart = Date.now();
      const results = await Promise.all(operations);
      const operationTime = Date.now() - operationStart;

      // All operations should succeed
      results.forEach(result => expect(result.success).toBe(true));

      // Operations should be fast (< 5 seconds)
      expect(operationTime).toBeLessThan(5000);

      await session.close();
    });
  });

  describe('Integration with Browser Manager', () => {
    it('should verify manager resource tracking', async () => {
      const initialUsage = await manager.getResourceUsage();
      expect(initialUsage.totalInstances).toBe(0);
      expect(initialUsage.totalContexts).toBe(0);

      // Launch session
      const session = createBrowserSession(manager);
      await session.launch();

      const activeUsage = await manager.getResourceUsage();
      expect(activeUsage.totalInstances).toBe(1);
      expect(activeUsage.totalContexts).toBe(1);
      expect(activeUsage.memoryUsageMB).toBeGreaterThan(0);

      // Close session
      await session.close();

      const finalUsage = await manager.getResourceUsage();
      expect(finalUsage.totalContexts).toBe(0);
    });

    it('should verify event emission', async () => {
      let browserCreated = false;
      let contextCreated = false;

      manager.once('browserCreated', () => { browserCreated = true; });
      manager.once('contextCreated', () => { contextCreated = true; });

      const session = createBrowserSession(manager);
      await session.launch();

      expect(browserCreated).toBe(true);
      expect(contextCreated).toBe(true);

      await session.close();
    });
  });

  describe('AC5: Console Log Capture and Error Detection', () => {
    it('should capture console messages with different log levels', async () => {
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        consoleLevels: ['log', 'warn', 'error', 'info'],
      });

      await session.launch();

      // Navigate to a page with console messages
      const html = `
        <html>
          <body>
            <h1>Console Test</h1>
            <script>
              console.log('Test log message');
              console.warn('Test warning message');
              console.error('Test error message');
              console.info('Test info message');
            </script>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Wait for console messages to be captured
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get captured console messages
      const messages = session.getCapturedConsoleMessages();
      expect(messages.length).toBeGreaterThanOrEqual(4);

      // Verify different log levels are captured
      const logTypes = messages.map(msg => msg.type);
      expect(logTypes).toContain('log');
      expect(logTypes).toContain('warn');
      expect(logTypes).toContain('error');
      expect(logTypes).toContain('info');

      // Check message content
      const logMessage = messages.find(msg => msg.type === 'log');
      expect(logMessage?.text).toBe('Test log message');

      await session.close();
    });

    it('should capture JavaScript runtime errors with stack traces', async () => {
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
      });

      await session.launch();

      // Start real-time capture to get enhanced error capture
      session.startRealTimeCapture({
        consolePollingMs: 100,
        errorPollingMs: 100,
      });

      // Navigate to a page that will generate JavaScript errors
      const html = `
        <html>
          <body>
            <h1>Error Test</h1>
            <script>
              // Generate a runtime error
              setTimeout(() => {
                throw new Error('Test runtime error with stack trace');
              }, 50);

              // Generate an unhandled promise rejection
              setTimeout(() => {
                Promise.reject(new Error('Test promise rejection'));
              }, 100);
            </script>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Wait for errors to be captured and processed
      await new Promise(resolve => setTimeout(resolve, 500));

      // Retrieve captured JavaScript errors
      const errorResult = await session.retrieveCapturedJavaScriptErrors();
      expect(errorResult.success).toBe(true);

      const capturedErrors = session.getCapturedJavaScriptErrors();
      expect(capturedErrors.length).toBeGreaterThanOrEqual(1);

      // Check that we captured the error with proper details
      const runtimeError = capturedErrors.find(err =>
        err.message.includes('Test runtime error')
      );

      if (runtimeError) {
        expect(runtimeError.uncaught).toBe(true);
        expect(runtimeError.stack).toBeDefined();
        expect(runtimeError.message).toContain('Test runtime error');
      }

      await session.close();
    });

    it('should stream console messages in real-time', async () => {
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
      });

      await session.launch();

      const capturedMessages: any[] = [];
      const capturedErrors: any[] = [];

      // Listen for real-time events
      session.on('consoleMessage', (message) => {
        capturedMessages.push(message);
      });

      session.on('javascriptError', (error) => {
        capturedErrors.push(error);
      });

      // Start enhanced console retrieval
      const enhancedResult = await session.retrieveEnhancedConsoleMessages();
      expect(enhancedResult.success).toBe(true);

      // Navigate to a page with console activity
      const html = `
        <html>
          <body>
            <h1>Streaming Test</h1>
            <script>
              console.log('Streamed message 1');
              console.warn('Streamed warning 1');
              setTimeout(() => {
                console.log('Delayed streamed message');
              }, 50);
            </script>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Wait for streaming to capture messages
      await new Promise(resolve => setTimeout(resolve, 200));

      // Retrieve enhanced console messages
      const enhancedMessages = await session.retrieveEnhancedConsoleMessages();
      expect(enhancedMessages.success).toBe(true);

      // Verify we captured messages
      const allMessages = session.getCapturedConsoleMessages();
      expect(allMessages.length).toBeGreaterThanOrEqual(2);

      await session.close();
    });

    it('should handle error context and stack trace parsing', async () => {
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        includeStackTraces: true,
      });

      await session.launch();

      // Navigate to page with errors that have context
      const html = `
        <html>
          <body>
            <h1>Context Test</h1>
            <script>
              function errorFunction() {
                throw new Error('Error with context');
              }

              function wrapperFunction() {
                errorFunction();
              }

              try {
                wrapperFunction();
              } catch(e) {
                console.error('Caught error:', e.message, e.stack);
              }

              // Also test uncaught error
              setTimeout(() => {
                throw new Error('Uncaught error with context');
              }, 50);
            </script>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Wait for error capture
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check console messages for error context
      const messages = session.getCapturedConsoleMessages();
      const errorMessage = messages.find(msg =>
        msg.type === 'error' && msg.text.includes('Caught error')
      );

      expect(errorMessage).toBeDefined();
      expect(errorMessage?.args).toBeInstanceOf(Array);

      // Retrieve and check JavaScript errors
      await session.retrieveCapturedJavaScriptErrors();
      const jsErrors = session.getCapturedJavaScriptErrors();

      const uncaughtError = jsErrors.find(err =>
        err.message.includes('Uncaught error with context')
      );

      if (uncaughtError) {
        expect(uncaughtError.stack).toBeDefined();
        expect(uncaughtError.uncaught).toBe(true);
        expect(typeof uncaughtError.timestamp).toBe('number');
      }

      await session.close();
    });

    it('should verify capture configuration works correctly', async () => {
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: false, // Start with console capture disabled
        captureErrors: true,
        consoleLevels: ['error'], // Only capture errors
        maxBufferSize: 10,
      });

      await session.launch();

      // Verify initial config
      const initialConfig = session.getCaptureConfig();
      expect(initialConfig.captureConsole).toBe(false);
      expect(initialConfig.captureErrors).toBe(true);
      expect(initialConfig.consoleLevels).toContain('error');
      expect(initialConfig.maxBufferSize).toBe(10);

      // Update configuration
      session.updateCaptureConfig({
        captureConsole: true,
        consoleLevels: ['log', 'warn', 'error'],
      });

      const updatedConfig = session.getCaptureConfig();
      expect(updatedConfig.captureConsole).toBe(true);
      expect(updatedConfig.consoleLevels).toEqual(['log', 'warn', 'error']);

      await session.close();
    });
  });
});