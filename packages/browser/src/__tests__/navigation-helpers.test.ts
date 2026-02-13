/**
 * @apexcli/browser - Navigation Helpers Tests
 *
 * Tests for the navigation helper functions to ensure they work correctly
 * with Playwright Page instances
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import {
  goto,
  waitForNavigation,
  assertURL,
  assertPageContent,
} from '../navigation-helpers.js';

describe('Navigation Helpers', () => {
  let browser: Browser;
  let page: Page;

  beforeEach(async () => {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    page = await context.newPage();
  });

  afterEach(async () => {
    await browser?.close();
  });

  describe('goto', () => {
    it('should navigate to a valid URL successfully', async () => {
      const result = await goto(page, 'data:text/html,<html><body><h1>Test Page</h1></body></html>');

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.finalUrl).toBeTruthy();
    });

    it('should handle navigation with custom timeout', async () => {
      const result = await goto(page, 'data:text/html,<html><body><h1>Test Page</h1></body></html>', {
        timeout: 10000,
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should fail with invalid page', async () => {
      const result = await goto(null as any, 'http://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Page instance is required for navigation');
    });

    it('should handle navigation errors gracefully', async () => {
      const result = await goto(page, 'http://non-existent-domain-12345.com', {
        timeout: 1000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe('waitForNavigation', () => {
    it('should wait for load state successfully', async () => {
      // First navigate to a page
      await page.goto('data:text/html,<html><body><h1>Initial Page</h1></body></html>');

      const result = await waitForNavigation(page, {
        timeout: 5000,
        waitUntil: 'load',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should fail with invalid page', async () => {
      const result = await waitForNavigation(null as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Page instance is required for navigation waiting');
    });

    it('should handle timeout errors', async () => {
      // Navigate to initial page
      await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');

      const result = await waitForNavigation(page, {
        url: /non-matching-pattern/,
        timeout: 100, // Very short timeout
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('assertURL', () => {
    beforeEach(async () => {
      await page.goto('data:text/html,<html><body><h1>Test Page</h1></body></html>');
    });

    it('should assert URL with exact string match', async () => {
      const currentUrl = page.url();
      const result = await assertURL(page, currentUrl);

      expect(result.success).toBe(true);
      expect(result.data).toBe(currentUrl);
      expect(result.finalUrl).toBe(currentUrl);
    });

    it('should assert URL with regex pattern', async () => {
      const result = await assertURL(page, /^data:text\/html/);

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
    });

    it('should fail with non-matching URL', async () => {
      const result = await assertURL(page, 'http://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toContain('Expected URL to match');
    });

    it('should handle pathname only assertions', async () => {
      await page.goto('http://example.com/test/path?query=value#hash');
      const result = await assertURL(page, '/test/path', { pathname: true });

      expect(result.success).toBe(true);
      expect(result.data).toBe('/test/path');
    });

    it('should handle ignoring query parameters', async () => {
      await page.goto('http://example.com/test?query=value');
      const result = await assertURL(page, 'http://example.com/test', { ignoreQuery: true });

      expect(result.success).toBe(true);
    });

    it('should fail with invalid page', async () => {
      const result = await assertURL(null as any, 'http://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Page instance is required for URL assertion');
    });
  });

  describe('assertPageContent', () => {
    beforeEach(async () => {
      await page.goto('data:text/html,<html><body><h1>Test Page</h1><p>Welcome to our test site!</p><div class="content">Some content here</div></body></html>');
    });

    it('should assert page contains text content', async () => {
      const result = await assertPageContent(page, 'Test Page');

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data).toContain('Test Page');
    });

    it('should assert page content with regex pattern', async () => {
      const result = await assertPageContent(page, /Welcome to.*test site/);

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
    });

    it('should fail when content is not found', async () => {
      const result = await assertPageContent(page, 'Non-existent content');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toContain('Expected page to contain');
    });

    it('should handle case-insensitive matching', async () => {
      const result = await assertPageContent(page, 'TEST PAGE', { ignoreCase: true });

      expect(result.success).toBe(true);
    });

    it('should search within specific selector', async () => {
      const result = await assertPageContent(page, 'Some content here', {
        selector: '.content',
      });

      expect(result.success).toBe(true);
    });

    it('should fail when content not found in specific selector', async () => {
      const result = await assertPageContent(page, 'Test Page', {
        selector: '.content',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected element ".content" to contain');
    });

    it('should handle whole word matching', async () => {
      const result = await assertPageContent(page, 'test', { wholeWord: true });

      expect(result.success).toBe(true);

      // This should fail because 'tes' is not a whole word
      const result2 = await assertPageContent(page, 'tes', { wholeWord: true });
      expect(result2.success).toBe(false);
    });

    it('should fail with invalid page', async () => {
      const result = await assertPageContent(null as any, 'test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Page instance is required for content assertion');
    });

    it('should handle custom timeout', async () => {
      const result = await assertPageContent(page, 'Test Page', { timeout: 1000 });

      expect(result.success).toBe(true);
      expect(result.duration).toBeLessThan(1000);
    });
  });
});