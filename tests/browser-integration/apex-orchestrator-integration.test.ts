/**
 * @fileoverview APEX Orchestrator Browser Integration Tests
 *
 * This test suite validates that browser automation works correctly within
 * the APEX orchestrator system, testing the integration between the browser
 * package and the orchestrator's browser tools.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

// Import browser package components
import {
  BrowserManager,
  createBrowserManager,
  launchBrowser,
  captureScreenshot,
} from '../../packages/browser/src/index.js';

// Import orchestrator components that use browser automation
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool.js';

// Helper to create test HTML content
function createTestHTML(title: string, content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            background: #f5f5f5;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .button {
            background: #007acc;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin: 10px 5px;
            font-size: 14px;
          }
          .input {
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            width: 200px;
            margin: 10px 5px;
          }
          .output {
            margin-top: 20px;
            padding: 15px;
            background: #f0f8ff;
            border: 1px solid #007acc;
            border-radius: 4px;
            min-height: 60px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${title}</h1>
          ${content}
        </div>
      </body>
    </html>
  `;
}

describe('APEX Orchestrator Browser Integration', () => {
  let tempDir: string;
  let screenshotDir: string;
  let browserTool: BrowserTool;

  beforeAll(async () => {
    // Create temporary directory for test artifacts
    tempDir = await fs.mkdtemp(path.join(process.cwd(), 'test-artifacts', 'orchestrator-integration-'));
    screenshotDir = path.join(tempDir, 'screenshots');
    await fs.mkdir(screenshotDir, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test artifacts:', error);
    }
  });

  beforeEach(async () => {
    // Initialize browser tool with test configuration
    browserTool = new BrowserTool({
      headless: true,
      viewport: { width: 1024, height: 768 },
      timeout: 30000,
    });
  });

  afterEach(async () => {
    // Cleanup browser tool
    if (browserTool) {
      try {
        await browserTool.cleanup();
      } catch (error) {
        console.warn('Browser tool cleanup failed:', error);
      }
    }
  });

  describe('Browser Tool Integration', () => {
    it('should initialize browser tool correctly', async () => {
      expect(browserTool).toBeDefined();
      expect(browserTool.name).toBe('browser');
      expect(browserTool.description).toContain('browser automation');
    });

    it('should handle browser automation commands through orchestrator', async () => {
      // Test navigate command
      const testHTML = createTestHTML('Orchestrator Test', `
        <p>This page tests APEX orchestrator browser integration.</p>
        <button id="clickTest" onclick="document.getElementById('result').textContent = 'Button clicked!'">
          Click Me
        </button>
        <div id="result">Waiting...</div>
      `);

      // Navigate to test content
      const navigateResult = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: `data:text/html,${encodeURIComponent(testHTML)}`
        },
      });

      expect(navigateResult.success).toBe(true);
      expect(navigateResult.data).toBeDefined();

      // Test click operation
      const clickResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#clickTest' },
      });

      expect(clickResult.success).toBe(true);

      // Verify the click worked by checking result text
      const textResult = await browserTool.execute({
        operation: 'getText',
        params: { selector: '#result' },
      });

      expect(textResult.success).toBe(true);
      expect(textResult.data?.text).toBe('Button clicked!');
    });

    it('should capture screenshots through orchestrator', async () => {
      const testHTML = createTestHTML('Screenshot Test', `
        <div style="background: linear-gradient(45deg, #007acc, #00a8ff); color: white; padding: 40px; text-align: center; border-radius: 8px;">
          <h2>Screenshot Test Content</h2>
          <p>This content should appear in the screenshot.</p>
        </div>
      `);

      // Navigate to test content
      await browserTool.execute({
        operation: 'navigate',
        params: {
          url: `data:text/html,${encodeURIComponent(testHTML)}`
        },
      });

      // Take screenshot
      const screenshotPath = path.join(screenshotDir, 'orchestrator-test.png');
      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { path: screenshotPath },
      });

      expect(screenshotResult.success).toBe(true);
      expect(screenshotResult.data?.path).toBe(screenshotPath);

      // Verify screenshot file was created
      const stats = await fs.stat(screenshotPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should handle form interactions through orchestrator', async () => {
      const testHTML = createTestHTML('Form Test', `
        <form id="testForm">
          <div>
            <label for="name">Name:</label>
            <input type="text" id="name" name="name" class="input" />
          </div>
          <div>
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" class="input" />
          </div>
          <div>
            <label for="message">Message:</label>
            <textarea id="message" name="message" rows="3" style="width: 300px; padding: 10px;"></textarea>
          </div>
          <button type="button" id="submitBtn" class="button" onclick="handleSubmit()">
            Submit
          </button>
        </form>
        <div id="formResult" class="output">Form not submitted</div>

        <script>
          function handleSubmit() {
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const message = document.getElementById('message').value;

            document.getElementById('formResult').innerHTML =
              'Form submitted!<br>' +
              'Name: ' + name + '<br>' +
              'Email: ' + email + '<br>' +
              'Message: ' + message;
          }
        </script>
      `);

      // Navigate to form
      await browserTool.execute({
        operation: 'navigate',
        params: { url: `data:text/html,${encodeURIComponent(testHTML)}` },
      });

      // Fill form fields
      await browserTool.execute({
        operation: 'type',
        params: { selector: '#name', text: 'John Doe' },
      });

      await browserTool.execute({
        operation: 'type',
        params: { selector: '#email', text: 'john.doe@example.com' },
      });

      await browserTool.execute({
        operation: 'type',
        params: { selector: '#message', text: 'This is a test message for APEX integration.' },
      });

      // Submit form
      await browserTool.execute({
        operation: 'click',
        params: { selector: '#submitBtn' },
      });

      // Verify form submission
      const resultText = await browserTool.execute({
        operation: 'getText',
        params: { selector: '#formResult' },
      });

      expect(resultText.success).toBe(true);
      expect(resultText.data?.text).toContain('Form submitted!');
      expect(resultText.data?.text).toContain('John Doe');
      expect(resultText.data?.text).toContain('john.doe@example.com');
    });

    it('should handle page evaluation and script execution', async () => {
      const testHTML = createTestHTML('Script Test', `
        <div id="content">
          <p>Page loaded at: <span id="timestamp"></span></p>
          <button id="generateData" class="button" onclick="generateTestData()">
            Generate Data
          </button>
          <div id="dataDisplay" class="output">No data generated</div>
        </div>

        <script>
          document.getElementById('timestamp').textContent = new Date().toISOString();

          function generateTestData() {
            const data = {
              random: Math.random(),
              timestamp: Date.now(),
              userAgent: navigator.userAgent.substring(0, 50) + '...'
            };

            document.getElementById('dataDisplay').innerHTML =
              'Generated Data:<br>' +
              'Random: ' + data.random.toFixed(4) + '<br>' +
              'Timestamp: ' + data.timestamp + '<br>' +
              'User Agent: ' + data.userAgent;

            window.testData = data;
          }
        </script>
      `);

      // Navigate to test page
      await browserTool.execute({
        operation: 'navigate',
        params: { url: `data:text/html,${encodeURIComponent(testHTML)}` },
      });

      // Generate test data
      await browserTool.execute({
        operation: 'click',
        params: { selector: '#generateData' },
      });

      // Evaluate JavaScript to get test data
      const evalResult = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: 'window.testData ? { ...window.testData, success: true } : { success: false }'
        },
      });

      expect(evalResult.success).toBe(true);
      expect(evalResult.data?.result.success).toBe(true);
      expect(evalResult.data?.result.random).toBeDefined();
      expect(evalResult.data?.result.timestamp).toBeGreaterThan(0);
    });
  });

  describe('Direct Browser Package Integration', () => {
    let manager: InstanceType<typeof BrowserManager>;

    beforeEach(() => {
      manager = createBrowserManager({
        headless: true,
        timeout: 30000,
      });
    });

    afterEach(async () => {
      if (manager) {
        try {
          await manager.cleanup();
        } catch (error) {
          console.warn('Manager cleanup failed:', error);
        }
      }
    });

    it('should work with direct browser package usage', async () => {
      const launchResult = await manager.launchBrowser('chromium');
      expect(launchResult.success).toBe(true);

      if (launchResult.success) {
        const browser = launchResult.data;
        const context = await browser.newContext({
          viewport: { width: 1024, height: 768 },
        });

        const page = await context.newPage();

        const testHTML = createTestHTML('Direct Integration Test', `
          <div style="background: #28a745; color: white; padding: 20px; border-radius: 5px;">
            <h2>Direct Browser Package Test</h2>
            <p>Testing direct integration with browser package.</p>
          </div>
        `);

        await page.setContent(testHTML);

        // Capture screenshot using direct package function
        const screenshotPath = path.join(screenshotDir, 'direct-integration.png');
        const screenshotResult = await captureScreenshot(page, screenshotPath);

        expect(screenshotResult.success).toBe(true);

        const stats = await fs.stat(screenshotPath);
        expect(stats.size).toBeGreaterThan(0);

        await context.close();
      }
    });

    it('should demonstrate launch utility integration', async () => {
      const sessionResult = await launchBrowser({
        viewport: { width: 1200, height: 800 },
        headless: true,
      });

      expect(sessionResult.success).toBe(true);

      if (sessionResult.success) {
        const session = sessionResult.data;

        const testHTML = createTestHTML('Launch Utility Test', `
          <div class="container">
            <h2>Browser Launch Utility Test</h2>
            <p>This tests the convenience launch utility.</p>
            <button id="testBtn" class="button">Utility Test Button</button>
            <div id="output" class="output">Ready for testing</div>
          </div>

          <script>
            document.getElementById('testBtn').onclick = function() {
              document.getElementById('output').textContent = 'Launch utility working!';
            };
          </script>
        `);

        const navResult = await session.setContent(testHTML);
        expect(navResult.success).toBe(true);

        const clickResult = await session.click('#testBtn');
        expect(clickResult.success).toBe(true);

        const textResult = await session.getElementText('#output');
        expect(textResult.success).toBe(true);
        expect(textResult.data?.text).toBe('Launch utility working!');

        await session.close();
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle browser tool errors gracefully', async () => {
      // Test invalid operation
      const invalidResult = await browserTool.execute({
        operation: 'invalidOperation' as any,
        params: {},
      });

      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toBeDefined();
    });

    it('should handle navigation errors through orchestrator', async () => {
      // Test navigation to invalid URL
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'invalid://url' },
      });

      expect(navResult.success).toBe(false);
      expect(navResult.error).toBeDefined();
    });

    it('should handle element not found errors', async () => {
      const testHTML = createTestHTML('Error Test', '<p>Simple page with no special elements</p>');

      // Navigate to simple page
      await browserTool.execute({
        operation: 'navigate',
        params: { url: `data:text/html,${encodeURIComponent(testHTML)}` },
      });

      // Try to click non-existent element
      const clickResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#nonExistentElement' },
      });

      expect(clickResult.success).toBe(false);
      expect(clickResult.error).toBeDefined();
      expect(clickResult.error).toContain('not found');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should manage browser resources efficiently in orchestrator context', async () => {
      const operations = [
        { operation: 'navigate', params: { url: 'data:text/html,<html><body><h1>Page 1</h1></body></html>' } },
        { operation: 'navigate', params: { url: 'data:text/html,<html><body><h1>Page 2</h1></body></html>' } },
        { operation: 'navigate', params: { url: 'data:text/html,<html><body><h1>Page 3</h1></body></html>' } },
      ];

      // Execute multiple operations
      for (const op of operations) {
        const result = await browserTool.execute(op);
        expect(result.success).toBe(true);
      }

      // Take final screenshot to verify browser is still responsive
      const screenshotPath = path.join(screenshotDir, 'performance-test.png');
      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { path: screenshotPath },
      });

      expect(screenshotResult.success).toBe(true);

      const stats = await fs.stat(screenshotPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should handle concurrent operations appropriately', async () => {
      const testHTML = createTestHTML('Concurrent Test', `
        <div id="counter">0</div>
        <button id="increment" class="button" onclick="incrementCounter()">Increment</button>

        <script>
          let count = 0;
          function incrementCounter() {
            count++;
            document.getElementById('counter').textContent = count;
          }
        </script>
      `);

      // Navigate to test page
      await browserTool.execute({
        operation: 'navigate',
        params: { url: `data:text/html,${encodeURIComponent(testHTML)}` },
      });

      // Execute multiple clicks in sequence
      const clickPromises = [];
      for (let i = 0; i < 5; i++) {
        clickPromises.push(
          browserTool.execute({
            operation: 'click',
            params: { selector: '#increment' },
          })
        );
      }

      const results = await Promise.all(clickPromises);

      // All operations should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Check final counter value
      const textResult = await browserTool.execute({
        operation: 'getText',
        params: { selector: '#counter' },
      });

      expect(textResult.success).toBe(true);
      expect(parseInt(textResult.data?.text || '0')).toBe(5);
    });
  });
});