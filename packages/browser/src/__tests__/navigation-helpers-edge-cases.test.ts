/**
 * @apexcli/browser - Navigation Helpers Edge Cases Tests
 *
 * Comprehensive edge case testing for navigation helper functions
 * focusing on error conditions, boundary conditions, and unusual scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import {
  goto,
  waitForNavigation,
  assertURL,
  assertPageContent,
} from '../navigation-helpers.js';

describe('Navigation Helpers - Edge Cases', () => {
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

  describe('Input Validation Edge Cases', () => {
    it('should handle undefined page parameter gracefully', async () => {
      const results = await Promise.all([
        goto(undefined as any, 'http://example.com'),
        waitForNavigation(undefined as any),
        assertURL(undefined as any, 'http://example.com'),
        assertPageContent(undefined as any, 'test content')
      ]);

      results.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
        expect(result.duration).toBeGreaterThan(0);
      });
    });

    it('should handle empty string URL in goto', async () => {
      const result = await goto(page, '');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle empty content search in assertPageContent', async () => {
      await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');

      const result = await assertPageContent(page, '');

      // Empty string should be found in any text content
      expect(result.success).toBe(true);
    });

    it('should handle extremely long timeout values', async () => {
      await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');

      const result = await assertPageContent(page, 'Test', {
        timeout: Number.MAX_SAFE_INTEGER
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeLessThan(1000); // Should complete quickly despite large timeout
    });

    it('should handle zero timeout values', async () => {
      await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');

      const result = await assertPageContent(page, 'Test', {
        timeout: 0
      });

      // Zero timeout should still work for content that's immediately available
      expect(result.success).toBe(true);
    });

    it('should handle negative timeout values', async () => {
      await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');

      const result = await assertPageContent(page, 'Test', {
        timeout: -1000
      });

      // Negative timeout should be handled gracefully
      expect(result.success).toBe(true);
    });
  });

  describe('URL Edge Cases', () => {
    it('should handle very long URLs', async () => {
      const longPath = 'a'.repeat(1000);
      const longUrl = `data:text/html,<html><body><h1>${longPath}</h1></body></html>`;

      const result = await goto(page, longUrl);
      expect(result.success).toBe(true);
    });

    it('should handle URLs with special characters', async () => {
      const specialChars = encodeURIComponent('!@#$%^&*(){}[]|\\:";\'<>?,./ ');
      const url = `data:text/html,<html><body><h1>Special: ${specialChars}</h1></body></html>`;

      const result = await goto(page, url);
      expect(result.success).toBe(true);
    });

    it('should handle URLs with unicode characters', async () => {
      const unicode = encodeURIComponent('🚀 测试 🎉 тест 🔥');
      const url = `data:text/html,<html><body><h1>Unicode: ${unicode}</h1></body></html>`;

      const result = await goto(page, url);
      expect(result.success).toBe(true);
    });

    it('should handle protocol-relative URLs', async () => {
      const result = await goto(page, '//example.com', { timeout: 1000 });

      // This might fail due to network, but should handle gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should handle fragment-only URLs', async () => {
      await page.goto('data:text/html,<html><body><h1 id="test">Test</h1></body></html>');

      const result = await goto(page, '#test');

      // Fragment navigation behavior may vary
      expect(typeof result.success).toBe('boolean');
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe('Content Matching Edge Cases', () => {
    beforeEach(async () => {
      const complexHtml = `
        <html>
          <body>
            <div>   Whitespace   test   </div>
            <div>LINE1\nLINE2\rLINE3\r\nLINE4</div>
            <div>Special chars: !@#$%^&*()</div>
            <div>Unicode: 🚀 测试 🎉 тест 🔥</div>
            <div>Empty div next:</div>
            <div></div>
            <div style="display:none">Hidden content</div>
            <script>console.log('script content');</script>
            <style>body { margin: 0; }</style>
          </body>
        </html>
      `;
      await page.goto(`data:text/html,${encodeURIComponent(complexHtml)}`);
    });

    it('should handle whitespace normalization in content matching', async () => {
      // Test that normalized whitespace matches
      const result = await assertPageContent(page, 'Whitespace test');
      expect(result.success).toBe(true);
    });

    it('should handle newline characters in content', async () => {
      const result = await assertPageContent(page, /LINE1.*LINE2/);
      expect(result.success).toBe(true);
    });

    it('should handle special characters in content matching', async () => {
      const result = await assertPageContent(page, 'Special chars: !@#$%^&*()');
      expect(result.success).toBe(true);
    });

    it('should handle unicode content matching', async () => {
      const result = await assertPageContent(page, '🚀 测试 🎉');
      expect(result.success).toBe(true);
    });

    it('should handle empty selectors gracefully', async () => {
      // Test with div that might be empty
      const result = await assertPageContent(page, '', {
        selector: 'div:empty'
      });

      // Should find empty content in empty div
      expect(result.success).toBe(true);
    });

    it('should handle non-visible content correctly', async () => {
      // Hidden content should still be in textContent
      const result = await assertPageContent(page, 'Hidden content');
      expect(result.success).toBe(true);
    });

    it('should not match script or style content in normal text search', async () => {
      const result = await assertPageContent(page, 'console.log');

      // Script content should not be found in normal text content
      expect(result.success).toBe(false);
    });

    it('should handle very long content searches', async () => {
      const longText = 'a'.repeat(10000);
      const htmlWithLongText = `<html><body><div>${longText}</div></body></html>`;

      await page.goto(`data:text/html,${encodeURIComponent(htmlWithLongText)}`);

      const result = await assertPageContent(page, longText);
      expect(result.success).toBe(true);
    });
  });

  describe('Selector Edge Cases', () => {
    beforeEach(async () => {
      const selectorTestHtml = `
        <html>
          <body>
            <div class="test-class">Class selector test</div>
            <div id="test-id">ID selector test</div>
            <div data-testid="test-data">Data attribute test</div>
            <div class="multi class names">Multiple classes</div>
            <div class="special!@#$%^&*()">Special chars in class</div>
            <div>
              <span>Nested content</span>
              <div class="deep">
                <p>Deep nested content</p>
              </div>
            </div>
          </body>
        </html>
      `;
      await page.goto(`data:text/html,${encodeURIComponent(selectorTestHtml)}`);
    });

    it('should handle invalid CSS selectors gracefully', async () => {
      const invalidSelectors = [
        '..invalid',
        '#',
        '..',
        '[invalid]]]',
        'div>>child'
      ];

      for (const selector of invalidSelectors) {
        const result = await assertPageContent(page, 'test', {
          selector: selector
        });

        // Should handle invalid selectors without crashing
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
      }
    });

    it('should handle complex CSS selectors', async () => {
      const complexSelectors = [
        'div.test-class',
        '#test-id',
        '[data-testid="test-data"]',
        'div:first-child',
        'div:not(.not-exists)',
        'div > span',
        'div .deep p'
      ];

      for (const selector of complexSelectors) {
        const result = await assertPageContent(page, /./, {
          selector: selector,
          timeout: 1000
        });

        // Most should succeed, but we're testing they don't crash
        expect(typeof result.success).toBe('boolean');
        expect(result.duration).toBeGreaterThan(0);
      }
    });

    it('should handle ElementSelector objects with different types', async () => {
      const selectorTypes = [
        { type: 'css' as const, value: '.test-class' },
        { type: 'xpath' as const, value: '//div[@class="test-class"]' },
        { type: 'text' as const, value: 'Class selector test' },
        { type: 'testId' as const, value: 'test-data' }
      ];

      for (const selector of selectorTypes) {
        const result = await assertPageContent(page, 'test', {
          selector: selector,
          timeout: 2000
        });

        // Test each selector type works
        expect(typeof result.success).toBe('boolean');
        expect(result.duration).toBeGreaterThan(0);
      }
    });

    it('should handle selectors that match multiple elements', async () => {
      const result = await assertPageContent(page, 'test', {
        selector: 'div' // Matches multiple divs
      });

      // Should work with first matching element or combined text
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Timing and Race Conditions', () => {
    it('should handle rapid successive navigation calls', async () => {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        const promise = goto(page, `data:text/html,<html><body><h1>Page ${i}</h1></body></html>`);
        promises.push(promise);
      }

      const results = await Promise.allSettled(promises);

      // At least one should succeed, others might fail due to interruption
      const successes = results.filter(r => r.status === 'fulfilled' && r.value.success);
      expect(successes.length).toBeGreaterThan(0);
    });

    it('should handle operations on closed pages', async () => {
      // Create a new page and close it
      const tempPage = await browser.newPage();
      await tempPage.close();

      const results = await Promise.allSettled([
        goto(tempPage, 'http://example.com'),
        waitForNavigation(tempPage),
        assertURL(tempPage, 'http://example.com'),
        assertPageContent(tempPage, 'test')
      ]);

      // All should either reject or return failure
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect(result.value.success).toBe(false);
        }
      });
    });

    it('should handle very short timeouts consistently', async () => {
      await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');

      const shortTimeouts = [1, 5, 10, 50];

      for (const timeout of shortTimeouts) {
        const result = await assertPageContent(page, 'Non-existent content', {
          timeout: timeout
        });

        expect(result.success).toBe(false);
        expect(result.duration).toBeGreaterThanOrEqual(timeout - 50); // Allow some tolerance
      }
    });
  });

  describe('Memory and Resource Edge Cases', () => {
    it('should handle large DOM content efficiently', async () => {
      // Create a page with large DOM
      const largeContent = '<div>'.repeat(1000) + 'TARGET CONTENT' + '</div>'.repeat(1000);
      const largeHtml = `<html><body>${largeContent}</body></html>`;

      await page.goto(`data:text/html,${encodeURIComponent(largeHtml)}`);

      const startTime = Date.now();
      const result = await assertPageContent(page, 'TARGET CONTENT');
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within reasonable time
    });

    it('should handle repeated operations without memory leaks', async () => {
      await page.goto('data:text/html,<html><body><h1>Repeated Test</h1></body></html>');

      // Perform many operations
      const results = [];
      for (let i = 0; i < 100; i++) {
        const result = await assertPageContent(page, 'Repeated Test', {
          timeout: 1000
        });
        results.push(result);
      }

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Average duration should be reasonable
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      expect(avgDuration).toBeLessThan(500);
    });
  });

  describe('Error Message Quality', () => {
    it('should provide descriptive error messages for common failures', async () => {
      const testCases = [
        {
          operation: () => goto(null as any, 'http://example.com'),
          expectedError: 'Page instance is required'
        },
        {
          operation: () => waitForNavigation(null as any),
          expectedError: 'Page instance is required'
        },
        {
          operation: () => assertURL(null as any, 'http://example.com'),
          expectedError: 'Page instance is required'
        },
        {
          operation: () => assertPageContent(null as any, 'test'),
          expectedError: 'Page instance is required'
        }
      ];

      for (const testCase of testCases) {
        const result = await testCase.operation();

        expect(result.success).toBe(false);
        expect(result.error).toContain(testCase.expectedError);
      }
    });

    it('should provide context in URL assertion errors', async () => {
      await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');

      const result = await assertURL(page, 'https://totally-different-url.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected URL to match');
      expect(result.error).toContain('but got');
    });

    it('should provide context in content assertion errors', async () => {
      await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');

      const result = await assertPageContent(page, 'Missing content');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected page to contain');
      expect(result.error).toContain('but it was not found');
    });
  });
});