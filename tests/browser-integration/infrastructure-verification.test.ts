/**
 * @fileoverview Browser Automation Infrastructure Verification Test
 *
 * This test file verifies that the complete browser automation infrastructure
 * is working correctly across the APEX monorepo. It tests:
 * - Playwright and Puppeteer integrations
 * - Browser test utilities and configurations
 * - Cross-package browser automation capabilities
 * - Test artifact generation and management
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { BrowserTestBase, createBrowserTest, BrowserTestUtils } from '../../test-utils/browser-test-base.js';
import { createBrowser, createBrowserContext, createPage, setupTestPage } from './setup.js';
import { takeScreenshot, waitForElement, safeClick, safeFill } from './utils/test-helpers.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Browser Automation Infrastructure Verification', () => {
  let browserTest: BrowserTestBase;
  let tempDir: string;

  beforeAll(async () => {
    // Create temporary directory for test artifacts
    tempDir = await fs.mkdtemp(path.join(process.cwd(), 'test-artifacts', 'infrastructure-test-'));
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
    browserTest = createBrowserTest({
      headless: true, // Force headless for CI compatibility
      timeout: 30000,
    });

    await browserTest.setup();
  });

  afterEach(async () => {
    await browserTest.teardown();
  });

  describe('Core Infrastructure', () => {
    it('should initialize browser test framework correctly', async () => {
      expect(browserTest).toBeDefined();
      expect(browserTest.context.browser).toBeDefined();
      expect(browserTest.context.context).toBeDefined();
      expect(browserTest.context.page).toBeDefined();
      expect(browserTest.context.tempDir).toBeDefined();
    });

    it('should have correct browser configuration', async () => {
      const browserInfo = BrowserTestUtils.getBrowserInfo(browserTest);

      expect(browserInfo.backend).toBe('playwright');
      expect(browserInfo.browserType).toBe('chromium');
      expect(browserInfo.headless).toBe(true);
      expect(browserInfo.viewport).toEqual({ width: 1280, height: 720 });
    });

    it('should handle browser events correctly', async () => {
      const events: string[] = [];

      browserTest.on('navigation:success', () => events.push('navigation:success'));
      browserTest.on('element:found', () => events.push('element:found'));
      browserTest.on('screenshot:taken', () => events.push('screenshot:taken'));

      // Create test page and perform actions
      await BrowserTestUtils.createTestPage(browserTest);
      await browserTest.waitForElement('#test-button');
      await browserTest.takeScreenshot('infrastructure-test');

      expect(events).toContain('element:found');
      expect(events).toContain('screenshot:taken');
    });
  });

  describe('Browser Navigation and Interaction', () => {
    it('should navigate to test page successfully', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      const title = await browserTest.context.page!.title();
      expect(title).toBe('APEX Browser Test Page');
    });

    it('should interact with page elements', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Find and click button
      const button = await browserTest.waitForElement('#test-button');
      expect(button).toBeDefined();

      // Click button and verify result
      await button.click();

      // Check output was updated
      const output = await browserTest.context.page!.locator('#output').textContent();
      expect(output).toContain('Button clicked at');
    });

    it('should handle input fields correctly', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Find and fill input
      const input = await browserTest.waitForElement('#test-input');
      await input.fill('Test input value');

      // Verify input value
      const inputValue = await input.inputValue();
      expect(inputValue).toBe('Test input value');
    });
  });

  describe('Screenshot and Visual Testing', () => {
    it('should capture screenshots correctly', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      const screenshotPath = await browserTest.takeScreenshot('test-page');

      // Verify screenshot file exists
      expect(screenshotPath).toBeDefined();
      expect(screenshotPath).toContain('test-page');

      const stats = await fs.stat(screenshotPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should handle screenshot options correctly', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      const screenshotPath = await browserTest.takeScreenshot('test-options', {
        fullPage: false,
        clip: { x: 0, y: 0, width: 400, height: 300 },
      });

      // Verify screenshot was created
      const stats = await fs.stat(screenshotPath);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('Console and Error Handling', () => {
    it('should capture console messages', async () => {
      const messages = await browserTest.captureConsoleMessages(async () => {
        await BrowserTestUtils.createTestPage(browserTest);
      });

      expect(messages).toBeDefined();
      expect(messages.length).toBeGreaterThan(0);

      // Should capture the console.log from test page
      const logMessage = messages.find(msg =>
        msg.type === 'log' && msg.text.includes('Test page loaded successfully')
      );
      expect(logMessage).toBeDefined();
    });

    it('should execute JavaScript correctly', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      const result = await browserTest.executeScript(() => {
        return {
          title: document.title,
          url: window.location.href,
          timestamp: Date.now(),
        };
      });

      expect(result).toBeDefined();
      expect(result.title).toBe('APEX Browser Test Page');
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should measure page performance metrics', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      const metrics = await browserTest.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      if (metrics) {
        expect(metrics.timestamp).toBeGreaterThan(0);
        expect(typeof metrics.domContentLoaded).toBe('number');
      }
    });

    it('should handle network idle detection', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // This should complete without timeout
      await BrowserTestUtils.waitForNetworkIdle(browserTest, 10000);

      // If we reach here, network idle detection works
      expect(true).toBe(true);
    });
  });

  describe('Legacy Browser Test Utilities Integration', () => {
    it('should work with existing browser setup utilities', async () => {
      const browser = await createBrowser({ headless: true });
      const context = await createBrowserContext(browser);
      const page = await createPage(context);

      try {
        await setupTestPage(page);

        const title = await page.title();
        expect(title).toBe('APEX Browser Test Page');

        // Test existing helper functions
        await safeClick(page, '#test-button');
        await safeFill(page, '#test-input', 'Legacy test');

        const inputValue = await page.locator('#test-input').inputValue();
        expect(inputValue).toBe('Legacy test');

      } finally {
        await page.close();
        await context.close();
        await browser.close();
      }
    });

    it('should handle existing test helper functions', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Test waitForElement function
      const element = await waitForElement(browserTest.context.page!, '#test-button');
      expect(element).toBeDefined();

      // Test takeScreenshot function
      const screenshotPath = await takeScreenshot(
        browserTest.context.page!,
        'legacy-test',
        browserTest.context.tempDir!
      );

      expect(screenshotPath).toBeDefined();
      const stats = await fs.stat(screenshotPath);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('Cross-Package Integration', () => {
    it('should verify browser package integration', async () => {
      // Test that browser automation works with core APEX types
      await BrowserTestUtils.createTestPage(browserTest);

      const pageInfo = await browserTest.executeScript(() => ({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
      }));

      expect(pageInfo).toBeDefined();
      expect(pageInfo.userAgent).toContain('Chrome');
      expect(typeof pageInfo.cookieEnabled).toBe('boolean');
    });

    it('should handle browser automation configuration', async () => {
      const config = browserTest.context.config;

      expect(config).toBeDefined();
      expect(config.backend).toBe('playwright');
      expect(config.browserType).toBe('chromium');
      expect(config.viewport).toEqual({ width: 1280, height: 720 });
      expect(typeof config.headless).toBe('boolean');
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle navigation errors gracefully', async () => {
      // Test error handling with invalid URL
      await expect(async () => {
        await browserTest.navigateTo('invalid-url://test');
      }).rejects.toThrow();

      // Should still be able to navigate to valid page
      await BrowserTestUtils.createTestPage(browserTest);
      const title = await browserTest.context.page!.title();
      expect(title).toBe('APEX Browser Test Page');
    });

    it('should handle element not found errors', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Test element not found
      await expect(async () => {
        await browserTest.waitForElement('#non-existent-element', { timeout: 1000 });
      }).rejects.toThrow(/Element not found/);
    });

    it('should handle script execution errors', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Test script error
      await expect(async () => {
        await browserTest.executeScript('throw new Error("Test error")');
      }).rejects.toThrow(/Script execution failed/);
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should clean up resources correctly', async () => {
      const tempBrowserTest = createBrowserTest({ headless: true });
      await tempBrowserTest.setup();

      const tempDir = tempBrowserTest.context.tempDir;
      const browser = tempBrowserTest.context.browser;
      const context = tempBrowserTest.context.context;
      const page = tempBrowserTest.context.page;

      expect(tempDir).toBeDefined();
      expect(browser).toBeDefined();
      expect(context).toBeDefined();
      expect(page).toBeDefined();

      await tempBrowserTest.teardown();

      // Resources should be cleaned up
      expect(tempBrowserTest.context.browser).toBeUndefined();
      expect(tempBrowserTest.context.context).toBeUndefined();
      expect(tempBrowserTest.context.page).toBeUndefined();
      expect(tempBrowserTest.context.tempDir).toBeUndefined();
    });

    it('should handle multiple test instances', async () => {
      const test1 = createBrowserTest({ headless: true });
      const test2 = createBrowserTest({ headless: true });

      await test1.setup();
      await test2.setup();

      try {
        await BrowserTestUtils.createTestPage(test1);
        await BrowserTestUtils.createTestPage(test2);

        const title1 = await test1.context.page!.title();
        const title2 = await test2.context.page!.title();

        expect(title1).toBe('APEX Browser Test Page');
        expect(title2).toBe('APEX Browser Test Page');

      } finally {
        await test1.teardown();
        await test2.teardown();
      }
    });
  });
});

describe('Infrastructure Dependencies Validation', () => {
  it('should have all required browser dependencies', async () => {
    // Test that required modules can be imported
    const { chromium, firefox, webkit } = await import('playwright');

    expect(chromium).toBeDefined();
    expect(firefox).toBeDefined();
    expect(webkit).toBeDefined();
  });

  it('should have pixelmatch for screenshot comparison', async () => {
    const pixelmatch = await import('pixelmatch');
    expect(pixelmatch.default).toBeDefined();
  });

  it('should have pngjs for image processing', async () => {
    const { PNG } = await import('pngjs');
    expect(PNG).toBeDefined();
  });

  it('should have browser test configuration files', async () => {
    // Check that configuration files exist
    const playwrightConfigPath = path.join(process.cwd(), 'playwright.config.ts');
    const puppeteerConfigPath = path.join(process.cwd(), 'puppeteer.config.js');

    try {
      await fs.access(playwrightConfigPath);
      await fs.access(puppeteerConfigPath);
      expect(true).toBe(true); // Files exist
    } catch (error) {
      throw new Error('Browser configuration files not found');
    }
  });
});