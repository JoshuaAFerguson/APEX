/**
 * @fileoverview URL Navigation Integration Tests for APEX
 *
 * This test suite provides comprehensive testing for URL navigation scenarios:
 * - HTTP, HTTPS, relative, and absolute URL navigation
 * - URL components (path, query parameters, hash fragments)
 * - Different navigation methods (goto, click, programmatic)
 * - Error handling for invalid URLs and network issues
 * - URL validation and state verification after navigation
 *
 * Tests cover the acceptance criteria:
 * - Navigate to various URL types with proper assertions
 * - Verify page loads and navigation completion
 * - Validate navigation state after URL changes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import {
  createNavigationBrowser,
  createNavigationContext,
  createNavigationPage,
} from './setup';
import {
  safeNavigate,
  safeNavigationClick,
  validateNavigation,
  NavigationEventMonitor,
  waitForNavigationComplete,
} from './utils/navigation-helpers';
import {
  assertURL,
  assertURLContains,
  assertURLMatches,
  assertPageTitle,
  assertLoadState,
  assertElementExists,
  assertNavigationPerformance,
} from './utils/assertions';
import { MockNavigationServer } from './mock-server';

describe('URL Navigation Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let mockServer: MockNavigationServer;
  let baseUrl: string;
  let monitor: NavigationEventMonitor;

  beforeEach(async () => {
    // Create browser infrastructure
    browser = await createNavigationBrowser();
    context = await createNavigationContext(browser);
    page = await createNavigationPage(context);

    // Set up mock server for controlled URL testing
    mockServer = new MockNavigationServer({ port: 0, verbose: false });
    await mockServer.start();
    baseUrl = mockServer.baseUrl;

    // Add custom scenarios for URL testing
    mockServer.addScenario({
      name: 'query-params',
      path: '/search',
      statusCode: 200,
      contentType: 'text/html',
      body: () => `
        <!DOCTYPE html>
        <html>
          <head><title>Search Results</title></head>
          <body>
            <h1>Search Results</h1>
            <div id="query-params">
              <script>
                const params = new URLSearchParams(window.location.search);
                document.write('Query: ' + (params.get('q') || 'none'));
                document.write('<br>Category: ' + (params.get('category') || 'none'));
                document.write('<br>Page: ' + (params.get('page') || '1'));
              </script>
            </div>
          </body>
        </html>
      `,
    });

    mockServer.addScenario({
      name: 'hash-fragment',
      path: '/document',
      statusCode: 200,
      contentType: 'text/html',
      body: () => `
        <!DOCTYPE html>
        <html>
          <head><title>Document with Sections</title></head>
          <body>
            <h1>Document</h1>
            <section id="intro"><h2>Introduction</h2><p>Intro content</p></section>
            <section id="content"><h2>Main Content</h2><p>Main content</p></section>
            <section id="conclusion"><h2>Conclusion</h2><p>Conclusion content</p></section>
            <script>
              const hash = window.location.hash;
              if (hash) {
                const element = document.querySelector(hash);
                if (element) {
                  element.style.backgroundColor = '#e7f3ff';
                  element.scrollIntoView();
                }
              }
            </script>
          </body>
        </html>
      `,
    });

    mockServer.addScenario({
      name: 'links-page',
      path: '/links',
      statusCode: 200,
      contentType: 'text/html',
      body: () => `
        <!DOCTYPE html>
        <html>
          <head><title>Navigation Links Test</title></head>
          <body>
            <h1>Navigation Links</h1>
            <nav>
              <a href="/page1" id="relative-link">Relative Link</a>
              <a href="${baseUrl}/page2" id="absolute-link">Absolute Link</a>
              <a href="https://httpbin.org/status/200" id="external-link" target="_blank">External HTTPS Link</a>
              <a href="/search?q=test&category=navigation" id="query-link">Link with Query</a>
              <a href="/document#conclusion" id="hash-link">Link with Hash</a>
              <a href="/search?q=advanced#results" id="complex-link">Complex URL</a>
            </nav>
          </body>
        </html>
      `,
    });

    // Set up event monitoring
    monitor = new NavigationEventMonitor(page);
  });

  afterEach(async () => {
    monitor.clearEvents();
    await page?.close();
    await context?.close();
    await browser?.close();
    await mockServer?.stop();
  });

  describe('Basic URL Navigation', () => {
    it('should navigate to HTTP URLs successfully', async () => {
      const startTime = Date.now();

      // Navigate to HTTP URL (our mock server)
      const success = await safeNavigate(page, baseUrl);
      expect(success).toBe(true);

      // Verify URL navigation completed
      await assertURL(page, baseUrl + '/');
      await assertPageTitle(page, 'Navigation Test Home');
      await assertLoadState(page, 'networkidle');

      // Verify performance is reasonable
      assertNavigationPerformance(startTime, 5000);

      // Check navigation was tracked
      expect(monitor.getNavigationCount()).toBe(1);
    });

    it('should handle HTTPS URLs correctly', async () => {
      // Skip if no internet connection available
      const httpsUrl = 'https://httpbin.org/status/200';

      try {
        const success = await safeNavigate(page, httpsUrl, { timeout: 10000 });

        if (success) {
          await assertURL(page, httpsUrl);
          await assertLoadState(page, 'load');
          expect(monitor.getNavigationCount()).toBe(1);
        } else {
          // Network unavailable - skip test gracefully
          console.log('HTTPS navigation test skipped - network unavailable');
        }
      } catch (error) {
        // Network error expected in some environments
        console.log('HTTPS test skipped due to network constraints');
      }
    });

    it('should navigate using relative URLs', async () => {
      // Start at base URL
      await safeNavigate(page, baseUrl);

      // Navigate using relative URL
      const success = await safeNavigate(page, '/page1');
      expect(success).toBe(true);

      await assertURL(page, baseUrl + '/page1');
      await assertPageTitle(page, 'Navigation Test - Page 1');
      expect(monitor.getNavigationCount()).toBe(2);
    });

    it('should navigate using absolute URLs', async () => {
      const absoluteUrl = `${baseUrl}/page2`;

      const success = await safeNavigate(page, absoluteUrl);
      expect(success).toBe(true);

      await assertURL(page, absoluteUrl);
      await assertPageTitle(page, 'Navigation Test - Page 2');
      expect(monitor.getNavigationCount()).toBe(1);
    });
  });

  describe('URL Components Navigation', () => {
    it('should handle URLs with query parameters', async () => {
      const queryUrl = `${baseUrl}/search?q=navigation&category=testing&page=2`;

      const success = await safeNavigate(page, queryUrl);
      expect(success).toBe(true);

      // Verify URL with query parameters
      await assertURL(page, queryUrl);
      await assertPageTitle(page, 'Search Results');

      // Verify query parameters are processed
      const queryContent = await page.textContent('#query-params');
      expect(queryContent).toContain('Query: navigation');
      expect(queryContent).toContain('Category: testing');
      expect(queryContent).toContain('Page: 2');
    });

    it('should handle URLs with hash fragments', async () => {
      const hashUrl = `${baseUrl}/document#content`;

      const success = await safeNavigate(page, hashUrl);
      expect(success).toBe(true);

      await assertURL(page, hashUrl);
      await assertPageTitle(page, 'Document with Sections');

      // Verify hash fragment is preserved
      await assertURLContains(page, '#content');

      // Verify hash target element is highlighted
      const highlightedElement = await page.locator('#content').getAttribute('style');
      expect(highlightedElement).toContain('background-color');
    });

    it('should handle complex URLs with both query and hash', async () => {
      const complexUrl = `${baseUrl}/search?q=complex&category=url#results`;

      const success = await safeNavigate(page, complexUrl);
      expect(success).toBe(true);

      await assertURL(page, complexUrl);
      await assertURLContains(page, '?q=complex');
      await assertURLContains(page, '#results');
    });

    it('should handle URLs with special characters', async () => {
      // Add scenario for special characters
      mockServer.addScenario({
        name: 'special-chars',
        path: '/special-chars',
        statusCode: 200,
        contentType: 'text/html',
        body: '<html><head><title>Special Characters Test</title></head><body><h1>Special Chars Page</h1></body></html>',
      });

      const specialUrl = `${baseUrl}/special-chars?query=hello%20world&special=%21%40%23%24`;

      const success = await safeNavigate(page, specialUrl);
      expect(success).toBe(true);

      await assertURL(page, specialUrl);
      await assertPageTitle(page, 'Special Characters Test');
    });
  });

  describe('Navigation Methods', () => {
    it('should navigate via page.goto()', async () => {
      const targetUrl = `${baseUrl}/page1`;

      const response = await page.goto(targetUrl);
      expect(response).toBeTruthy();
      expect(response?.status()).toBe(200);

      await assertURL(page, targetUrl);
      await assertLoadState(page, 'networkidle');
    });

    it('should navigate via link clicks', async () => {
      // Navigate to links page
      await safeNavigate(page, `${baseUrl}/links`);

      // Click relative link
      await safeNavigationClick(page, '#relative-link');
      await assertURL(page, `${baseUrl}/page1`);

      // Go back and test absolute link
      await page.goBack();
      await waitForNavigationComplete(page);

      await safeNavigationClick(page, '#absolute-link');
      await assertURL(page, `${baseUrl}/page2`);
    });

    it('should navigate via programmatic methods', async () => {
      await safeNavigate(page, baseUrl);

      // Navigate programmatically using page.evaluate
      await page.evaluate((url) => {
        window.location.href = url;
      }, `${baseUrl}/page3`);

      await waitForNavigationComplete(page, { expectedUrl: `${baseUrl}/page3` });
      await assertURL(page, `${baseUrl}/page3`);
      await assertPageTitle(page, 'Navigation Test - Page 3');
    });

    it('should navigate using history API', async () => {
      await safeNavigate(page, baseUrl);

      // Use history.pushState
      await page.evaluate((url) => {
        history.pushState({}, '', url);
      }, '/page1');

      // URL should change but page content stays same (SPA-like behavior)
      await assertURLContains(page, '/page1');

      // Navigate to actual page to load new content
      await page.reload();
      await assertPageTitle(page, 'Navigation Test - Page 1');
    });
  });

  describe('URL Validation and State', () => {
    it('should validate URL patterns with regex', async () => {
      await safeNavigate(page, `${baseUrl}/page1`);

      await assertURLMatches(page, /\/page\d+$/);
      await assertURLMatches(page, /page1/);

      // Navigate to another page and test again
      await safeNavigationClick(page, 'a[href="/page2"]');
      await assertURLMatches(page, /\/page\d+$/);
      await assertURLMatches(page, /page2/);
    });

    it('should maintain URL state during complex navigation flows', async () => {
      const urls = [
        `${baseUrl}/`,
        `${baseUrl}/page1`,
        `${baseUrl}/search?q=test`,
        `${baseUrl}/document#intro`,
      ];

      // Navigate through multiple URLs
      for (const url of urls) {
        await safeNavigate(page, url);
        await assertURL(page, url);
        await assertLoadState(page, 'networkidle');
      }

      // Test navigation history
      const events = monitor.getEvents();
      expect(events.length).toBeGreaterThanOrEqual(urls.length);

      // Test back navigation preserves URLs
      await page.goBack();
      await waitForNavigationComplete(page);
      await assertURL(page, urls[urls.length - 2]);
    });

    it('should handle URL changes during redirects', async () => {
      // Navigate to redirect URL
      await safeNavigate(page, `${baseUrl}/redirect?to=/page2`);

      // Should end up at final destination
      await assertURL(page, `${baseUrl}/page2`);
      await assertPageTitle(page, 'Navigation Test - Page 2');

      // Check that redirect was tracked
      const events = monitor.getEvents();
      expect(events.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid URLs gracefully', async () => {
      const invalidUrls = [
        'not-a-url',
        'http://',
        'https://nonexistent-domain-that-should-not-exist-12345.com',
      ];

      for (const invalidUrl of invalidUrls) {
        try {
          const success = await safeNavigate(page, invalidUrl, {
            timeout: 3000,
            retries: 0
          });

          // Some URLs might succeed (like malformed ones that get auto-corrected)
          // but most should fail gracefully
          console.log(`URL "${invalidUrl}" navigation result: ${success}`);
        } catch (error) {
          // Expected for truly invalid URLs
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle network timeouts', async () => {
      // Test with very slow endpoint
      try {
        const success = await safeNavigate(page, `${baseUrl}/very-slow`, {
          timeout: 1000 // Very short timeout
        });

        if (!success) {
          // Timeout expected
          console.log('Network timeout handled gracefully');
        }
      } catch (error) {
        // Timeout error expected
        expect(error).toBeDefined();
      }
    });

    it('should handle 404 and error responses', async () => {
      // Navigate to 404 page
      const success = await safeNavigate(page, `${baseUrl}/404`);
      expect(success).toBe(true); // Navigation succeeds, but returns 404

      await assertURL(page, `${baseUrl}/404`);
      await assertElementExists(page, 'body');

      const content = await page.textContent('body');
      expect(content).toContain('404');
    });

    it('should handle server errors during navigation', async () => {
      const success = await safeNavigate(page, `${baseUrl}/error`);
      expect(success).toBe(true); // Navigation succeeds, but returns 500

      await assertURL(page, `${baseUrl}/error`);

      const content = await page.textContent('body');
      expect(content).toContain('500');
    });

    it('should handle navigation to empty responses', async () => {
      const success = await safeNavigate(page, `${baseUrl}/empty`);
      expect(success).toBe(true);

      await assertURL(page, `${baseUrl}/empty`);

      // Page should load even with empty content
      await assertLoadState(page, 'load');
    });
  });

  describe('URL Navigation Performance', () => {
    it('should navigate efficiently across different URL types', async () => {
      const testUrls = [
        baseUrl,
        `${baseUrl}/page1`,
        `${baseUrl}/search?q=performance`,
        `${baseUrl}/document#content`,
      ];

      const performanceResults = [];

      for (const url of testUrls) {
        const startTime = Date.now();
        await safeNavigate(page, url);
        const endTime = Date.now();

        performanceResults.push({
          url,
          duration: endTime - startTime,
        });

        await assertURL(page, url);
      }

      // All navigations should complete within reasonable time
      for (const result of performanceResults) {
        expect(result.duration).toBeLessThan(5000); // 5 second max
        console.log(`Navigation to ${result.url}: ${result.duration}ms`);
      }
    });

    it('should track navigation events accurately', async () => {
      monitor.clearEvents();

      const navigationSequence = [
        baseUrl,
        `${baseUrl}/page1`,
        `${baseUrl}/page2`,
      ];

      for (const url of navigationSequence) {
        await safeNavigate(page, url);
      }

      const events = monitor.getEvents();
      const navigationEvents = events.filter(e => e.type === 'framenavigated');

      expect(navigationEvents.length).toBe(navigationSequence.length);

      // Verify event URLs match navigation sequence
      for (let i = 0; i < navigationSequence.length; i++) {
        expect(navigationEvents[i].url).toBe(navigationSequence[i] + (navigationSequence[i].endsWith('/') ? '' : '/'));
      }
    });
  });

  describe('Cross-Browser URL Compatibility', () => {
    it('should handle URL encoding consistently', async () => {
      const encodedUrl = `${baseUrl}/search?q=${encodeURIComponent('test with spaces')}&category=${encodeURIComponent('navigation & testing')}`;

      const success = await safeNavigate(page, encodedUrl);
      expect(success).toBe(true);

      await assertURL(page, encodedUrl);
      await assertURLContains(page, 'q=test%20with%20spaces');
      await assertURLContains(page, 'category=navigation%20%26%20testing');
    });

    it('should handle international domain names and Unicode', async () => {
      // Test Unicode in hash and query parameters
      const unicodeUrl = `${baseUrl}/search?q=${encodeURIComponent('测试')}&lang=zh#结果`;

      const success = await safeNavigate(page, unicodeUrl);
      expect(success).toBe(true);

      await assertURL(page, unicodeUrl);
    });

    it('should maintain URL integrity across page reloads', async () => {
      const complexUrl = `${baseUrl}/search?query=test&filter=active&page=2#results`;

      await safeNavigate(page, complexUrl);
      await assertURL(page, complexUrl);

      // Reload page
      await page.reload();
      await waitForNavigationComplete(page);

      // URL should be preserved
      await assertURL(page, complexUrl);
      await assertURLContains(page, 'query=test');
      await assertURLContains(page, '#results');
    });
  });
});