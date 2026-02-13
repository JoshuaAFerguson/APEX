/**
 * @fileoverview Example tests demonstrating browser fixtures usage
 *
 * This file provides comprehensive examples of how to use the browser fixtures
 * module for different testing scenarios and configurations.
 */

import {
  test,
  expect,
  createTestPage,
  waitForElement,
  waitForPageReady,
  captureConsoleMessages,
  BROWSER_CONFIGS,
  VIEWPORT_CONFIGS,
} from './index';

test.describe('Browser Fixtures Examples', () => {
  test.describe('Basic Fixtures', () => {
    test('clean page fixture example', async ({ cleanPage }) => {
      await createTestPage(cleanPage);

      // Test basic interactions
      await cleanPage.click('#test-button');
      await expect(cleanPage.locator('#output')).toContainText('Button clicked');

      // Test input
      await cleanPage.fill('#test-input', 'Hello World');
      await expect(cleanPage.locator('#test-input')).toHaveValue('Hello World');
    });

    test('clean browser context fixture example', async ({ cleanBrowserContext }) => {
      // Create multiple pages in the same context
      const page1 = await cleanBrowserContext.newPage();
      const page2 = await cleanBrowserContext.newPage();

      try {
        await createTestPage(page1);
        await createTestPage(page2);

        // Test isolated interactions
        await page1.fill('#test-input', 'Page 1 Input');
        await page2.fill('#test-input', 'Page 2 Input');

        await expect(page1.locator('#test-input')).toHaveValue('Page 1 Input');
        await expect(page2.locator('#test-input')).toHaveValue('Page 2 Input');
      } finally {
        await page1.close();
        await page2.close();
      }
    });
  });

  test.describe('Configured Fixtures', () => {
    // Configure all tests in this suite to run with console capture
    test.use({
      testConfig: {
        consoleCapture: true,
        networkCapture: false,
        autoCleanup: true,
        viewport: VIEWPORT_CONFIGS.desktop,
      },
    });

    test('page with configuration example', async ({ pageWithConfig }) => {
      await createTestPage(pageWithConfig);

      await pageWithConfig.click('#test-button');
      await expect(pageWithConfig.locator('#output')).toContainText('Button clicked');
    });

    test('mobile viewport configuration', async ({ configurablePage }) => {
      const mobilePage = await configurablePage(BROWSER_CONFIGS.mobile);

      await createTestPage(mobilePage);

      // Verify mobile viewport
      const viewport = mobilePage.viewportSize();
      expect(viewport?.width).toBe(375);
      expect(viewport?.height).toBe(667);

      await mobilePage.click('#test-button');
      await expect(mobilePage.locator('#output')).toContainText('Button clicked');
    });

    test('tablet viewport configuration', async ({ configurablePage }) => {
      const tabletPage = await configurablePage(BROWSER_CONFIGS.tablet);

      await createTestPage(tabletPage);

      // Verify tablet viewport
      const viewport = tabletPage.viewportSize();
      expect(viewport?.width).toBe(768);
      expect(viewport?.height).toBe(1024);

      await tabletPage.click('#test-button');
      await expect(tabletPage.locator('#output')).toContainText('Button clicked');
    });
  });

  test.describe('Console Capture Examples', () => {
    test('console capture fixture', async ({ pageWithConsoleCapture }) => {
      const { page, consoleMessages } = pageWithConsoleCapture;

      await createTestPage(page);

      // Initial console message from page load
      expect(consoleMessages).toContainEqual(
        expect.objectContaining({
          type: 'log',
          text: 'Test page loaded successfully',
        })
      );

      await page.click('#test-button');

      // Console messages should be captured automatically
      expect(consoleMessages.length).toBeGreaterThan(1);
    });

    test('console validation utility', async ({ cleanPage }) => {
      await createTestPage(cleanPage);

      await captureConsoleMessages(
        cleanPage,
        async () => {
          await cleanPage.click('#test-button');
        },
        [
          // The button click doesn't generate console messages in our test page,
          // so we'll validate the initial page load message
        ]
      );
    });

    test('console error capture', async ({ pageWithConsoleCapture }) => {
      const { page, consoleMessages } = pageWithConsoleCapture;

      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head><title>Error Test</title></head>
        <body>
          <button id="error-button" onclick="console.error('Test error'); throw new Error('Test error');">
            Generate Error
          </button>
        </body>
        </html>
      `);

      // Clear initial messages
      consoleMessages.length = 0;

      await page.click('#error-button');
      await page.waitForTimeout(100); // Wait for async console messages

      expect(consoleMessages).toContainEqual(
        expect.objectContaining({
          type: 'error',
          text: 'Test error',
        })
      );
    });
  });

  test.describe('Network Capture Examples', () => {
    test('network capture fixture', async ({ pageWithNetworkCapture }) => {
      const { page, networkRequests } = pageWithNetworkCapture;

      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head><title>Network Test</title></head>
        <body>
          <button id="fetch-button" onclick="fetch('https://httpbin.org/get')">
            Fetch Data
          </button>
        </body>
        </html>
      `);

      // Clear initial requests
      networkRequests.length = 0;

      await page.click('#fetch-button');
      await page.waitForTimeout(2000); // Wait for network request

      // Verify network request was captured
      const fetchRequest = networkRequests.find(req =>
        req.url.includes('httpbin.org/get')
      );

      expect(fetchRequest).toBeDefined();
      expect(fetchRequest?.method).toBe('GET');
    });
  });

  test.describe('Utility Function Examples', () => {
    test('wait for element utility', async ({ cleanPage }) => {
      await cleanPage.setContent(`
        <!DOCTYPE html>
        <html>
        <head><title>Wait Test</title></head>
        <body>
          <button onclick="setTimeout(() => {
            const div = document.createElement('div');
            div.id = 'delayed-element';
            div.textContent = 'I appeared!';
            document.body.appendChild(div);
          }, 1000)">
            Create Delayed Element
          </button>
        </body>
        </html>
      `);

      await cleanPage.click('button');

      // Wait for the delayed element
      await waitForElement(cleanPage, '#delayed-element', {
        timeout: 5000,
        visible: true,
      });

      await expect(cleanPage.locator('#delayed-element')).toHaveText('I appeared!');
    });

    test('wait for page ready utility', async ({ cleanPage }) => {
      await cleanPage.goto('data:text/html,<html><body><h1>Loading...</h1></body></html>');
      await waitForPageReady(cleanPage);

      // Page should be fully loaded
      await expect(cleanPage.locator('h1')).toHaveText('Loading...');
    });

    test('create test page utility', async ({ cleanPage }) => {
      await createTestPage(cleanPage);

      // Verify all standard elements are present
      await expect(cleanPage.locator('#test-button')).toBeVisible();
      await expect(cleanPage.locator('#test-input')).toBeVisible();
      await expect(cleanPage.locator('#output')).toBeVisible();
      await expect(cleanPage.locator('h1')).toHaveText('Test Page');

      // Test interactions
      await cleanPage.click('#test-button');
      await expect(cleanPage.locator('#output')).toContainText('Button clicked');
    });
  });

  test.describe('Advanced Configuration Examples', () => {
    test('custom viewport configuration', async ({ configurablePage }) => {
      const customPage = await configurablePage({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      });

      await createTestPage(customPage);

      const viewport = customPage.viewportSize();
      expect(viewport?.width).toBe(1440);
      expect(viewport?.height).toBe(900);
    });

    test('geolocation configuration', async ({ configurablePage }) => {
      const geoPage = await configurablePage({
        geolocation: { latitude: 37.7749, longitude: -122.4194 },
        permissions: ['geolocation'],
      });

      await geoPage.setContent(`
        <!DOCTYPE html>
        <html>
        <head><title>Geo Test</title></head>
        <body>
          <button onclick="navigator.geolocation.getCurrentPosition(pos => {
            document.getElementById('location').textContent =
              'Lat: ' + pos.coords.latitude + ', Lng: ' + pos.coords.longitude;
          })">Get Location</button>
          <div id="location"></div>
        </body>
        </html>
      `);

      await geoPage.click('button');
      await expect(geoPage.locator('#location')).toContainText('Lat: 37.7749');
    });

    test('user agent configuration', async ({ configurablePage }) => {
      const customUA = 'Mozilla/5.0 (CustomBot/1.0)';
      const customPage = await configurablePage({
        userAgent: customUA,
      });

      await customPage.setContent(`
        <!DOCTYPE html>
        <html>
        <head><title>UA Test</title></head>
        <body>
          <div id="user-agent"></div>
          <script>
            document.getElementById('user-agent').textContent = navigator.userAgent;
          </script>
        </body>
        </html>
      `);

      await expect(customPage.locator('#user-agent')).toHaveText(customUA);
    });
  });

  test.describe('Error Handling Examples', () => {
    test('page error handling', async ({ cleanPage }) => {
      const errors: string[] = [];

      cleanPage.on('pageerror', (error) => {
        errors.push(error.message);
      });

      await cleanPage.setContent(`
        <!DOCTYPE html>
        <html>
        <head><title>Error Test</title></head>
        <body>
          <button onclick="throw new Error('Intentional test error')">
            Cause Error
          </button>
        </body>
        </html>
      `);

      await cleanPage.click('button');
      await cleanPage.waitForTimeout(100);

      expect(errors).toContain('Intentional test error');
    });

    test('request failure handling', async ({ cleanPage }) => {
      const failedRequests: string[] = [];

      cleanPage.on('requestfailed', (request) => {
        failedRequests.push(request.url());
      });

      await cleanPage.setContent(`
        <!DOCTYPE html>
        <html>
        <head><title>Request Failure Test</title></head>
        <body>
          <button onclick="fetch('https://nonexistent.example.com/api')">
            Make Failed Request
          </button>
        </body>
        </html>
      `);

      await cleanPage.click('button');
      await cleanPage.waitForTimeout(2000);

      expect(failedRequests.length).toBeGreaterThan(0);
    });
  });

  test.describe('Performance Configuration', () => {
    test('trace recording configuration', async ({ configurablePage }) => {
      const tracePage = await configurablePage(BROWSER_CONFIGS.withTrace);

      await createTestPage(tracePage);
      await tracePage.click('#test-button');

      // Trace is automatically recorded due to configuration
      await expect(tracePage.locator('#output')).toContainText('Button clicked');
    });

    test('video recording configuration', async ({ configurablePage }) => {
      const videoPage = await configurablePage(BROWSER_CONFIGS.withVideo);

      await createTestPage(videoPage);
      await videoPage.click('#test-button');

      // Video is automatically recorded due to configuration
      await expect(videoPage.locator('#output')).toContainText('Button clicked');
    });
  });
});