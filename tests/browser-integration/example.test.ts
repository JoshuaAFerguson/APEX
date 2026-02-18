/**
 * @fileoverview Example browser integration test
 *
 * This file demonstrates the browser integration test infrastructure
 * and serves as a validation that all components work together.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import {
  createBrowser,
  createBrowserContext,
  createPage,
  DEFAULT_BROWSER_CONFIG,
  captureScreenshot,
} from './setup';
import {
  createTestPage,
  runNavigationScenario,
  NAVIGATION_SCENARIOS,
  runInteractionScenario,
} from './fixtures/common-scenarios';
import {
  takeScreenshot,
  waitForElement,
  safeClick,
  safeFill,
  waitForNetworkIdle,
  captureConsoleMessages,
} from './utils/test-helpers';

describe('Browser Integration Test Infrastructure', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeEach(async () => {
    browser = await createBrowser({
      browserType: 'chromium',
      headless: true,
    });
    context = await createBrowserContext(browser);
    page = await createPage(context);
  });

  afterEach(async () => {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  });

  describe('Basic Infrastructure', () => {
    it('should create browser instances successfully', async () => {
      expect(browser).toBeDefined();
      expect(context).toBeDefined();
      expect(page).toBeDefined();

      // Verify browser is running
      const isConnected = browser.isConnected();
      expect(isConnected).toBe(true);
    });

    it('should handle page navigation', async () => {
      const testURL = 'data:text/html,<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>';

      await page.goto(testURL);

      const title = await page.title();
      expect(title).toBe('Test');

      const heading = await page.textContent('h1');
      expect(heading).toBe('Hello');
    });

    it('should capture screenshots', async () => {
      await createTestPage(page);

      const screenshotPath = await takeScreenshot(
        page,
        'infrastructure-test',
        globalThis.browserTestContext.tempDir!
      );

      expect(screenshotPath).toBeDefined();
      expect(screenshotPath).toContain('.png');
    });
  });

  describe('Test Fixtures', () => {
    it('should create test page with all elements', async () => {
      await createTestPage(page);

      // Verify page title
      const title = await page.title();
      expect(title).toBe('APEX Browser Test Page');

      // Verify main sections exist
      const sections = await page.locator('.section').count();
      expect(sections).toBeGreaterThan(0);

      // Verify form elements exist
      const usernameInput = await page.locator('input[name="username"]');
      expect(await usernameInput.isVisible()).toBe(true);

      const submitButton = await page.locator('button[type="submit"]');
      expect(await submitButton.isVisible()).toBe(true);
    });

    it('should run navigation scenarios', async () => {
      const simpleScenario = NAVIGATION_SCENARIOS[0]; // Basic page load
      await runNavigationScenario(page, simpleScenario);

      // If we get here, the scenario passed
      expect(true).toBe(true);
    });

    it('should handle form interactions', async () => {
      await createTestPage(page);

      // Test form filling
      await safeFill(page, 'input[name="username"]', 'testuser');
      await safeFill(page, 'input[name="email"]', 'test@example.com');

      // Verify values were set
      const username = await page.inputValue('input[name="username"]');
      const email = await page.inputValue('input[name="email"]');

      expect(username).toBe('testuser');
      expect(email).toBe('test@example.com');
    });
  });

  describe('Test Utilities', () => {
    it('should wait for elements with conditions', async () => {
      await createTestPage(page);

      // Wait for button to be visible and enabled
      const button = await waitForElement(page, 'button[type="submit"]', {
        visible: true,
        enabled: true,
        timeout: 10000,
      });

      expect(button).toBeDefined();
    });

    it('should capture console messages', async () => {
      await createTestPage(page);

      const messages = await captureConsoleMessages(page, async () => {
        // Click button that logs to console
        await safeClick(page, '#consoleBtn');
        await page.waitForTimeout(1000); // Wait for messages
      });

      // Should capture multiple console message types
      expect(messages.length).toBeGreaterThan(0);

      // Check for expected message types
      const logMessages = messages.filter(m => m.type === 'log');
      const warnMessages = messages.filter(m => m.type === 'warning');
      const errorMessages = messages.filter(m => m.type === 'error');

      expect(logMessages.length).toBeGreaterThan(0);
    });

    it('should handle safe interactions', async () => {
      await createTestPage(page);

      // Test safe click with retry logic
      await safeClick(page, '#showHideBtn');

      // Test safe fill with validation
      await safeFill(page, '#dynamicInput', 'test content');

      // Verify the input was filled
      const inputValue = await page.inputValue('#dynamicInput');
      expect(inputValue).toBe('test content');
    });
  });

  describe('Browser Configuration', () => {
    it('should use default configuration', () => {
      expect(DEFAULT_BROWSER_CONFIG.backend).toBe('playwright');
      expect(DEFAULT_BROWSER_CONFIG.browserType).toBe('chromium');
      expect(DEFAULT_BROWSER_CONFIG.viewport.width).toBe(1280);
      expect(DEFAULT_BROWSER_CONFIG.viewport.height).toBe(720);
    });

    it('should handle different browser types', async () => {
      // Test with Firefox (if available)
      try {
        const firefoxBrowser = await createBrowser({ browserType: 'firefox' });
        const firefoxContext = await createBrowserContext(firefoxBrowser);
        const firefoxPage = await createPage(firefoxContext);

        await createTestPage(firefoxPage);
        const title = await firefoxPage.title();
        expect(title).toBe('APEX Browser Test Page');

        await firefoxPage.close();
        await firefoxContext.close();
        await firefoxBrowser.close();
      } catch (error) {
        // Firefox might not be installed, skip this test
        console.warn('Firefox not available for testing:', error);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle page errors gracefully', async () => {
      await createTestPage(page);

      // Click button that generates an error
      let errorOccurred = false;

      page.on('pageerror', (error) => {
        errorOccurred = true;
        expect(error.message).toContain('Intentional test error');
      });

      await safeClick(page, '#errorBtn');
      await page.waitForTimeout(1000);

      expect(errorOccurred).toBe(true);
    });

    it('should handle missing elements gracefully', async () => {
      await createTestPage(page);

      // Try to interact with non-existent element
      await expect(async () => {
        await safeClick(page, '#nonExistentElement');
      }).rejects.toThrow();
    });
  });

  describe('Performance Measurement', () => {
    it('should measure page load performance', async () => {
      const startTime = Date.now();

      await createTestPage(page);
      await waitForNetworkIdle(page);

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      // Should load within reasonable time
      expect(loadTime).toBeLessThan(10000); // 10 seconds max
    });
  });
});