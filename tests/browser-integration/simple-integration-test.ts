/**
 * @fileoverview Simple browser integration test to verify infrastructure works
 *
 * This test verifies that the basic browser integration test infrastructure
 * is functioning correctly and can create DOM elements, wait for conditions,
 * and assert element states.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserTestBase, createBrowserTest, BrowserTestUtils } from '@apex/test-utils/browser-test-base';

describe('Simple Browser Integration Test', () => {
  let browserTest: BrowserTestBase;

  beforeEach(async () => {
    browserTest = createBrowserTest({
      headless: true,
      timeout: 30000,
    });

    await browserTest.setup();
  });

  afterEach(async () => {
    if (browserTest) {
      await browserTest.teardown();
    }
  });

  it('should create browser test infrastructure correctly', async () => {
    expect(browserTest).toBeDefined();
    expect(browserTest.context.browser).toBeDefined();
    expect(browserTest.context.context).toBeDefined();
    expect(browserTest.context.page).toBeDefined();
    expect(browserTest.context.tempDir).toBeDefined();
  });

  it('should create and interact with DOM elements', async () => {
    // Create a test page with basic elements
    await BrowserTestUtils.createTestPage(browserTest);

    const page = browserTest.context.page!;

    // Verify page title
    const title = await page.title();
    expect(title).toBe('APEX Browser Test Page');

    // Wait for the test button element
    const button = await browserTest.waitForElement('#test-button');
    expect(button).toBeDefined();

    // Click the button and verify result
    await button.click();

    // Check that output was updated
    const output = await page.locator('#output').textContent();
    expect(output).toContain('Button clicked at');
  });

  it('should handle input field interactions', async () => {
    // Create test page
    await BrowserTestUtils.createTestPage(browserTest);

    const page = browserTest.context.page!;

    // Find and fill input field
    const input = await browserTest.waitForElement('#test-input');
    await input.fill('Test input value');

    // Verify input value was set
    const inputValue = await input.inputValue();
    expect(inputValue).toBe('Test input value');
  });

  it('should take screenshots correctly', async () => {
    // Create test page
    await BrowserTestUtils.createTestPage(browserTest);

    // Take a screenshot
    const screenshotPath = await browserTest.takeScreenshot('simple-test-screenshot');

    expect(screenshotPath).toBeDefined();
    expect(screenshotPath).toMatch(/\.png$/);
    expect(browserTest.context.screenshots).toContain(screenshotPath);
  });

  it('should capture console messages', async () => {
    // Capture console messages during page creation
    const messages = await browserTest.captureConsoleMessages(async () => {
      await BrowserTestUtils.createTestPage(browserTest);
    });

    expect(messages).toBeDefined();
    expect(Array.isArray(messages)).toBe(true);
    expect(messages.length).toBeGreaterThan(0);

    // Should capture the console.log from test page
    const logMessage = messages.find(msg =>
      msg.type === 'log' && msg.text.includes('Test page loaded successfully')
    );
    expect(logMessage).toBeDefined();
  });

  it('should wait for network idle', async () => {
    // Create test page
    await BrowserTestUtils.createTestPage(browserTest);

    // This should complete without timeout
    await BrowserTestUtils.waitForNetworkIdle(browserTest, 10000);

    // If we reach here, network idle detection works
    expect(true).toBe(true);
  });

  it('should handle JavaScript execution', async () => {
    // Create test page
    await BrowserTestUtils.createTestPage(browserTest);

    // Execute JavaScript in page context
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

  it('should measure performance metrics', async () => {
    // Create test page
    await BrowserTestUtils.createTestPage(browserTest);

    // Get performance metrics
    const metrics = await browserTest.getPerformanceMetrics();

    expect(metrics).toBeDefined();
    if (metrics) {
      expect(metrics.timestamp).toBeGreaterThan(0);
      expect(typeof metrics.domContentLoaded).toBe('number');
    }
  });

  it('should handle error scenarios gracefully', async () => {
    // Create test page
    await BrowserTestUtils.createTestPage(browserTest);

    // Test error handling with invalid selector
    await expect(async () => {
      await browserTest.waitForElement('#non-existent-element', { timeout: 1000 });
    }).rejects.toThrow(/Element not found/);
  });

  it('should clean up resources correctly', async () => {
    // Verify resources are created
    expect(browserTest.context.browser).toBeDefined();
    expect(browserTest.context.context).toBeDefined();
    expect(browserTest.context.page).toBeDefined();
    expect(browserTest.context.tempDir).toBeDefined();

    // Create test page to use resources
    await BrowserTestUtils.createTestPage(browserTest);

    // Resources should still be accessible
    const title = await browserTest.context.page!.title();
    expect(title).toBe('APEX Browser Test Page');

    // Cleanup will happen in afterEach hook
  });
});