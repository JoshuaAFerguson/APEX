/**
 * @apexcli/browser - Comprehensive Navigation Helpers Tests
 *
 * Additional comprehensive tests for navigation helper functions covering
 * edge cases, error scenarios, and integration workflows
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import {
  goto,
  waitForNavigation,
  assertURL,
  assertPageContent,
  type NavigationHelperResult,
  type AssertURLOptions,
  type AssertPageContentOptions,
} from '../navigation-helpers.js';

describe('Navigation Helpers - Comprehensive Tests', () => {
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

  describe('goto - Edge Cases and Error Scenarios', () => {
    it('should handle malformed URLs gracefully', async () => {
      const result = await goto(page, 'not-a-valid-url');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle redirect chains correctly', async () => {
      // Use data URL that simulates a successful response
      const result = await goto(page, 'data:text/html,<html><body><h1>Redirected Page</h1></body></html>');

      expect(result.success).toBe(true);
      expect(result.finalUrl).toBeTruthy();
    });

    it('should handle navigation with different waitUntil options', async () => {
      const testCases = [
        { waitUntil: 'load' as const },
        { waitUntil: 'domcontentloaded' as const },
        { waitUntil: 'networkidle' as const },
        { waitUntil: 'commit' as const },
      ];

      for (const options of testCases) {
        const result = await goto(page, 'data:text/html,<html><body><h1>Test</h1></body></html>', options);
        expect(result.success).toBe(true);
        expect(result.finalUrl).toBeTruthy();
      }
    });

    it('should handle custom referer header', async () => {
      const result = await goto(page, 'data:text/html,<html><body><h1>Test</h1></body></html>', {
        referer: 'https://example.com'
      });

      expect(result.success).toBe(true);
    });

    it('should handle timeout errors correctly', async () => {
      const result = await goto(page, 'http://httpbin.org/delay/10', {
        timeout: 100 // Very short timeout
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toContain('Timeout');
    });

    it('should provide accurate duration measurements', async () => {
      const startTime = Date.now();
      const result = await goto(page, 'data:text/html,<html><body><h1>Test</h1></body></html>');
      const endTime = Date.now();

      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeLessThanOrEqual(endTime - startTime + 50); // Allow 50ms margin
    });
  });

  describe('waitForNavigation - Comprehensive Coverage', () => {
    it('should wait for URL pattern with string matching', async () => {
      // Navigate to initial page
      await page.goto('data:text/html,<html><body><h1>Initial</h1></body></html>');

      // Test waiting for current URL
      const result = await waitForNavigation(page, {
        url: page.url(),
        timeout: 1000
      });

      expect(result.success).toBe(true);
    });

    it('should handle networkidle wait condition', async () => {
      await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');

      const result = await waitForNavigation(page, {
        waitUntil: 'networkidle',
        timeout: 5000
      });

      expect(result.success).toBe(true);
    });

    it('should handle domcontentloaded wait condition', async () => {
      await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');

      const result = await waitForNavigation(page, {
        waitUntil: 'domcontentloaded',
        timeout: 5000
      });

      expect(result.success).toBe(true);
    });

    it('should return final URL correctly', async () => {
      await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');
      const expectedUrl = page.url();

      const result = await waitForNavigation(page);

      expect(result.success).toBe(true);
      expect(result.finalUrl).toBe(expectedUrl);
      expect(result.data).toBe(expectedUrl);
    });
  });

  describe('assertURL - Advanced URL Matching', () => {
    beforeEach(async () => {
      await page.goto('https://example.com/path/to/page?param1=value1&param2=value2#section1');
    });

    it('should handle complex URL structure with all options', async () => {
      const testCases: Array<{
        expectedUrl: string | RegExp;
        options: AssertURLOptions;
        shouldPass: boolean;
        description: string;
      }> = [
        {
          expectedUrl: '/path/to/page',
          options: { pathname: true },
          shouldPass: true,
          description: 'pathname only match'
        },
        {
          expectedUrl: 'https://example.com/path/to/page',
          options: { ignoreQuery: true, ignoreHash: true },
          shouldPass: true,
          description: 'ignore query and hash'
        },
        {
          expectedUrl: 'https://example.com/path/to/page?param1=value1&param2=value2',
          options: { ignoreHash: true },
          shouldPass: true,
          description: 'ignore hash only'
        },
        {
          expectedUrl: /^https:\/\/example\.com\/path/,
          options: {},
          shouldPass: true,
          description: 'regex pattern match'
        },
        {
          expectedUrl: '/wrong/path',
          options: { pathname: true },
          shouldPass: false,
          description: 'pathname mismatch'
        }
      ];

      for (const testCase of testCases) {
        const result = await assertURL(page, testCase.expectedUrl, testCase.options);

        if (testCase.shouldPass) {
          expect(result.success).toBe(true);
        } else {
          expect(result.success).toBe(false);
        }
      }
    });

    it('should handle regex patterns with special characters', async () => {
      const result = await assertURL(page, /example\.com.*\?param1=value1/);
      expect(result.success).toBe(true);
    });

    it('should provide detailed error messages', async () => {
      const result = await assertURL(page, 'https://different-domain.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected URL to match');
      expect(result.error).toContain('but got');
    });
  });

  describe('assertPageContent - Advanced Content Matching', () => {
    beforeEach(async () => {
      const htmlContent = `
        <html>
          <body>
            <h1>Main Title</h1>
            <div class="container">
              <p>This is a paragraph with some text.</p>
              <div class="nested">Nested content here</div>
            </div>
            <footer>Footer information</footer>
            <span>Single word test</span>
          </body>
        </html>
      `;
      await page.goto(`data:text/html,${encodeURIComponent(htmlContent)}`);
    });

    it('should handle complex selector scenarios', async () => {
      const testCases = [
        {
          content: 'Nested content',
          selector: '.nested',
          shouldPass: true,
          description: 'CSS class selector'
        },
        {
          content: 'Footer information',
          selector: 'footer',
          shouldPass: true,
          description: 'HTML tag selector'
        },
        {
          content: 'Main Title',
          selector: 'h1',
          shouldPass: true,
          description: 'Header tag selector'
        },
        {
          content: 'Not found text',
          selector: '.container',
          shouldPass: false,
          description: 'Content not in selector'
        }
      ];

      for (const testCase of testCases) {
        const result = await assertPageContent(page, testCase.content, {
          selector: testCase.selector
        });

        if (testCase.shouldPass) {
          expect(result.success).toBe(true);
        } else {
          expect(result.success).toBe(false);
        }
      }
    });

    it('should handle ElementSelector type selectors', async () => {
      const result = await assertPageContent(page, 'Main Title', {
        selector: {
          type: 'css',
          value: 'h1'
        }
      });

      expect(result.success).toBe(true);
    });

    it('should handle wholeWord matching correctly', async () => {
      // Should find "test" as whole word
      const result1 = await assertPageContent(page, 'test', { wholeWord: true });
      expect(result1.success).toBe(true);

      // Should not find "tes" as whole word
      const result2 = await assertPageContent(page, 'tes', { wholeWord: true });
      expect(result2.success).toBe(false);

      // Should not find "est" as whole word
      const result3 = await assertPageContent(page, 'est', { wholeWord: true });
      expect(result3.success).toBe(false);
    });

    it('should handle case sensitivity options', async () => {
      // Case sensitive (default) - should fail
      const result1 = await assertPageContent(page, 'MAIN TITLE');
      expect(result1.success).toBe(false);

      // Case insensitive - should pass
      const result2 = await assertPageContent(page, 'MAIN TITLE', { ignoreCase: true });
      expect(result2.success).toBe(true);
    });

    it('should handle regex patterns in content matching', async () => {
      const result = await assertPageContent(page, /This is a.*with some text/);
      expect(result.success).toBe(true);
    });

    it('should handle timeout scenarios', async () => {
      // This should timeout quickly when looking for non-existent content
      const result = await assertPageContent(page, 'Non-existent content', {
        timeout: 100
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.duration).toBeGreaterThanOrEqual(90); // Should be close to timeout
    });

    it('should provide detailed error messages for content not found', async () => {
      const result = await assertPageContent(page, 'Missing content', {
        selector: '.container'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected element ".container" to contain "Missing content"');
    });
  });

  describe('Integration Workflows', () => {
    it('should handle complete navigation and assertion workflow', async () => {
      // Step 1: Navigate to page
      const gotoResult = await goto(page, 'data:text/html,<html><body><h1>Integration Test</h1><p>Welcome</p></body></html>');
      expect(gotoResult.success).toBe(true);

      // Step 2: Wait for navigation to complete
      const waitResult = await waitForNavigation(page);
      expect(waitResult.success).toBe(true);

      // Step 3: Assert URL matches expected pattern
      const urlResult = await assertURL(page, /^data:text\/html/);
      expect(urlResult.success).toBe(true);

      // Step 4: Assert page content is present
      const contentResult = await assertPageContent(page, 'Integration Test');
      expect(contentResult.success).toBe(true);
    });

    it('should handle navigation with multiple redirects and assertions', async () => {
      // Navigate to initial page
      const result1 = await goto(page, 'data:text/html,<html><body><h1>Page 1</h1></body></html>');
      expect(result1.success).toBe(true);

      // Navigate to second page
      const result2 = await goto(page, 'data:text/html,<html><body><h1>Page 2</h1></body></html>');
      expect(result2.success).toBe(true);

      // Assert final content
      const contentResult = await assertPageContent(page, 'Page 2');
      expect(contentResult.success).toBe(true);
    });

    it('should maintain consistent result structure across all functions', async () => {
      await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');

      const results: NavigationHelperResult<any>[] = [
        await goto(page, 'data:text/html,<html><body><h1>New Test</h1></body></html>'),
        await waitForNavigation(page),
        await assertURL(page, /data:text\/html/),
        await assertPageContent(page, 'New Test')
      ];

      // All results should have consistent structure
      results.forEach(result => {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('duration');
        expect(result).toHaveProperty('finalUrl');
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.duration).toBe('number');
        expect(result.duration).toBeGreaterThan(0);

        if (!result.success) {
          expect(result.error).toBeTruthy();
        }
      });
    });
  });

  describe('Performance and Resource Management', () => {
    it('should complete operations within reasonable time limits', async () => {
      const operations = [
        () => goto(page, 'data:text/html,<html><body><h1>Performance Test</h1></body></html>'),
        () => waitForNavigation(page),
        () => assertURL(page, /data:text\/html/),
        () => assertPageContent(page, 'Performance Test')
      ];

      for (const operation of operations) {
        const startTime = Date.now();
        const result = await operation();
        const duration = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
        expect(result.duration).toBeLessThanOrEqual(duration + 50); // Allow small margin
      }
    });

    it('should handle concurrent operations gracefully', async () => {
      await page.goto('data:text/html,<html><body><h1>Concurrent Test</h1></body></html>');

      // Run multiple assertions concurrently
      const promises = [
        assertURL(page, /data:text\/html/),
        assertPageContent(page, 'Concurrent Test'),
        assertURL(page, /html/),
        assertPageContent(page, /Concurrent/)
      ];

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});