/**
 * @fileoverview Basic Playwright Verification Tests
 *
 * This test file verifies that Playwright is properly set up and can:
 * - Launch different browsers (Chromium, Firefox, WebKit)
 * - Navigate to web pages
 * - Interact with page elements
 * - Take screenshots
 * - Handle basic browser automation tasks
 */

import { test, expect, Page, Browser } from '@playwright/test';

test.describe('Playwright Basic Verification', () => {
  test.describe('Browser Launch and Navigation', () => {
    test('should launch browser and navigate to example page', async ({ page }) => {
      // Create a simple HTML page for testing
      const testHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>APEX Playwright Test Page</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .container {
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
              font-size: 16px;
            }
            .button:hover {
              background: #005a9e;
            }
            .input {
              padding: 12px;
              border: 1px solid #ccc;
              border-radius: 4px;
              font-size: 16px;
              margin: 10px 5px;
              width: 200px;
            }
            #output {
              margin-top: 20px;
              padding: 15px;
              background: #f8f9fa;
              border-radius: 4px;
              min-height: 50px;
              border: 1px solid #e9ecef;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>APEX Playwright Test Page</h1>
            <p>This page verifies that Playwright browser automation is working correctly.</p>

            <div>
              <button id="test-button" class="button">Click Me!</button>
              <input id="test-input" class="input" type="text" placeholder="Enter test text" />
              <button id="submit-button" class="button">Submit</button>
            </div>

            <div id="output">
              <p>Ready for testing...</p>
            </div>
          </div>

          <script>
            // Add click handler for test button
            document.getElementById('test-button').addEventListener('click', function() {
              document.getElementById('output').innerHTML =
                '<p style="color: green;">✅ Button clicked at ' + new Date().toISOString() + '</p>';
            });

            // Add submit handler
            document.getElementById('submit-button').addEventListener('click', function() {
              const input = document.getElementById('test-input').value;
              document.getElementById('output').innerHTML =
                '<p style="color: blue;">📝 Submitted: "' + input + '" at ' + new Date().toISOString() + '</p>';
            });

            // Log page load
            console.log('APEX Playwright test page loaded successfully');
          </script>
        </body>
        </html>
      `;

      // Set the page content
      await page.setContent(testHTML);

      // Verify the page loaded correctly
      await expect(page).toHaveTitle('APEX Playwright Test Page');

      // Check that main elements are visible
      await expect(page.locator('h1')).toHaveText('APEX Playwright Test Page');
      await expect(page.locator('#test-button')).toBeVisible();
      await expect(page.locator('#test-input')).toBeVisible();
      await expect(page.locator('#output')).toBeVisible();
    });

    test('should be able to interact with page elements', async ({ page }) => {
      // Use the same test HTML
      const testHTML = `
        <!DOCTYPE html>
        <html>
        <head><title>Element Interaction Test</title></head>
        <body>
          <button id="test-button">Click Me!</button>
          <input id="test-input" type="text" placeholder="Type here" />
          <div id="output">Initial state</div>
          <script>
            document.getElementById('test-button').onclick = function() {
              document.getElementById('output').textContent = 'Button was clicked!';
            };
          </script>
        </body>
        </html>
      `;

      await page.setContent(testHTML);

      // Test button clicking
      await page.click('#test-button');
      await expect(page.locator('#output')).toHaveText('Button was clicked!');

      // Test text input
      await page.fill('#test-input', 'Hello Playwright!');
      await expect(page.locator('#test-input')).toHaveValue('Hello Playwright!');
    });

    test('should capture console messages', async ({ page }) => {
      const consoleMessages: string[] = [];

      // Listen for console messages
      page.on('console', (msg) => {
        consoleMessages.push(msg.text());
      });

      const testHTML = `
        <!DOCTYPE html>
        <html>
        <head><title>Console Test</title></head>
        <body>
          <script>
            console.log('Test log message');
            console.warn('Test warning message');
            console.error('Test error message');
          </script>
        </body>
        </html>
      `;

      await page.setContent(testHTML);

      // Wait a bit for console messages
      await page.waitForTimeout(100);

      // Verify console messages were captured
      expect(consoleMessages).toContain('Test log message');
      expect(consoleMessages).toContain('Test warning message');
      expect(consoleMessages).toContain('Test error message');
    });
  });

  test.describe('Screenshot and Visual Testing', () => {
    test('should take screenshots', async ({ page }) => {
      const testHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Screenshot Test</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 50px;
              background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-align: center;
            }
            .box {
              background: rgba(255,255,255,0.2);
              padding: 30px;
              border-radius: 10px;
              backdrop-filter: blur(10px);
            }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>APEX Playwright Screenshot Test</h1>
            <p>This page is used for screenshot testing.</p>
          </div>
        </body>
        </html>
      `;

      await page.setContent(testHTML);

      // Take a screenshot
      const screenshot = await page.screenshot();
      expect(screenshot).toBeDefined();
      expect(screenshot.length).toBeGreaterThan(0);

      // Take a full page screenshot
      const fullPageScreenshot = await page.screenshot({ fullPage: true });
      expect(fullPageScreenshot).toBeDefined();
      expect(fullPageScreenshot.length).toBeGreaterThan(0);
    });
  });

  test.describe('JavaScript Execution', () => {
    test('should execute JavaScript in browser context', async ({ page }) => {
      await page.setContent('<html><body><h1 id="title">Hello</h1></body></html>');

      // Execute JavaScript and get result
      const result = await page.evaluate(() => {
        return {
          title: document.title,
          headingText: document.querySelector('h1')?.textContent,
          userAgent: navigator.userAgent,
          url: window.location.href,
        };
      });

      expect(result).toBeDefined();
      expect(result.headingText).toBe('Hello');
      expect(result.userAgent).toContain('Chrome'); // Chromium includes Chrome
      expect(result.url).toContain('about:blank'); // Default URL for setContent
    });

    test('should handle async JavaScript execution', async ({ page }) => {
      await page.setContent('<html><body></body></html>');

      // Execute async JavaScript
      const result = await page.evaluate(async () => {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 100));

        return {
          timestamp: Date.now(),
          random: Math.random(),
          platform: navigator.platform,
        };
      });

      expect(result).toBeDefined();
      expect(typeof result.timestamp).toBe('number');
      expect(typeof result.random).toBe('number');
      expect(typeof result.platform).toBe('string');
    });
  });

  test.describe('Network and Performance', () => {
    test('should handle page load events', async ({ page }) => {
      const events: string[] = [];

      // Listen for various page events
      page.on('load', () => events.push('load'));
      page.on('domcontentloaded', () => events.push('domcontentloaded'));

      const testHTML = `
        <!DOCTYPE html>
        <html>
        <head><title>Load Events Test</title></head>
        <body>
          <h1>Load Events Test Page</h1>
          <script>
            window.addEventListener('load', () => {
              console.log('Window load event fired');
            });
          </script>
        </body>
        </html>
      `;

      await page.setContent(testHTML);

      // Wait for load events
      await page.waitForLoadState('load');

      // Check that events were fired
      expect(events).toContain('domcontentloaded');
      expect(events).toContain('load');
    });

    test('should measure basic performance metrics', async ({ page }) => {
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head><title>Performance Test</title></head>
        <body>
          <h1>Performance Test Page</h1>
          <script>
            // Add some content to measure
            for (let i = 0; i < 100; i++) {
              const div = document.createElement('div');
              div.textContent = 'Content item ' + i;
              document.body.appendChild(div);
            }
          </script>
        </body>
        </html>
      `);

      // Get basic performance metrics
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          domElements: document.querySelectorAll('*').length,
        };
      });

      expect(metrics).toBeDefined();
      expect(typeof metrics.domContentLoaded).toBe('number');
      expect(typeof metrics.loadComplete).toBe('number');
      expect(metrics.domElements).toBeGreaterThan(100); // We created 100+ elements
    });
  });
});

test.describe('Cross-Browser Compatibility', () => {
  test('should work in different browser contexts', async ({ browser }) => {
    // Test that we can create multiple contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      await page1.setContent('<html><body><h1>Context 1</h1></body></html>');
      await page2.setContent('<html><body><h1>Context 2</h1></body></html>');

      const title1 = await page1.locator('h1').textContent();
      const title2 = await page2.locator('h1').textContent();

      expect(title1).toBe('Context 1');
      expect(title2).toBe('Context 2');

    } finally {
      await context1.close();
      await context2.close();
    }
  });
});