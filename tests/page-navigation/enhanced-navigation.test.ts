/**
 * @fileoverview Enhanced navigation integration tests
 *
 * This test suite demonstrates the enhanced mock server capabilities
 * for comprehensive navigation scenario testing.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import {
  createNavigationBrowser,
  createNavigationContext,
  createNavigationPage,
} from './setup';
import { MockNavigationServer, MockServerLifecycle } from './mock-server';

describe('Enhanced Navigation Scenarios', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let mockServer: MockNavigationServer;

  beforeAll(async () => {
    browser = await createNavigationBrowser();
    mockServer = await MockServerLifecycle.startForTest('enhanced-nav-tests', {
      verbose: false,
      baseDelay: 500 // Faster for tests
    });
  });

  afterAll(async () => {
    await browser?.close();
    await MockServerLifecycle.stopForTest('enhanced-nav-tests');
  });

  beforeEach(async () => {
    context = await createNavigationContext(browser);
    page = await createNavigationPage(context);
  });

  afterEach(async () => {
    await page?.close();
    await context?.close();
  });

  describe('Error Handling Scenarios', () => {
    it('should handle various HTTP error codes', async () => {
      // Test 403 Forbidden
      const forbiddenResponse = await page.goto(`${mockServer.baseUrl}/forbidden`);
      expect(forbiddenResponse?.status()).toBe(403);

      const title = await page.title();
      expect(title).toBe('403 Forbidden');

      // Test 404 Not Found
      const notFoundResponse = await page.goto(`${mockServer.baseUrl}/404`);
      expect(notFoundResponse?.status()).toBe(404);

      const content = await page.textContent('h1');
      expect(content).toBe('404 Not Found');
    });

    it('should handle dynamic 404 for unknown paths', async () => {
      const response = await page.goto(`${mockServer.baseUrl}/unknown-route-${Date.now()}`);
      expect(response?.status()).toBe(404);

      const content = await page.textContent('body');
      expect(content).toContain('Page Not Found');
    });

    it('should handle server errors gracefully', async () => {
      const response = await page.goto(`${mockServer.baseUrl}/error`);
      expect(response?.status()).toBe(500);

      const heading = await page.textContent('h1');
      expect(heading).toBe('500 Server Error');
    });
  });

  describe('Redirect Scenarios', () => {
    it('should handle permanent redirects (301)', async () => {
      const response = await page.goto(`${mockServer.baseUrl}/redirect-permanent`);
      expect(response?.status()).toBe(200); // Final response after redirect

      // Should be redirected to page1
      expect(page.url()).toBe(`${mockServer.baseUrl}/page1`);
      expect(await page.title()).toBe('Navigation Test - Page 1');
    });

    it('should handle temporary redirects (302)', async () => {
      const response = await page.goto(`${mockServer.baseUrl}/redirect-temp`);
      expect(response?.status()).toBe(200); // Final response after redirect

      // Should be redirected to page1
      expect(page.url()).toBe(`${mockServer.baseUrl}/page1`);
      expect(await page.title()).toBe('Navigation Test - Page 1');
    });

    it('should handle dynamic redirects with query parameters', async () => {
      const response = await page.goto(`${mockServer.baseUrl}/redirect?to=/page2`);
      expect(response?.status()).toBe(200);

      // Should be redirected to page2
      expect(page.url()).toBe(`${mockServer.baseUrl}/page2`);
      expect(await page.title()).toBe('Navigation Test - Page 2');
    });

    it('should handle redirect chains', async () => {
      // Add a custom scenario that redirects to another redirect
      mockServer.addScenario({
        name: 'redirect-chain',
        path: '/redirect-chain',
        statusCode: 302,
        redirectTo: '/redirect-temp'
      });

      const response = await page.goto(`${mockServer.baseUrl}/redirect-chain`);
      expect(response?.status()).toBe(200);

      // Should end up at page1 after following the chain
      expect(page.url()).toBe(`${mockServer.baseUrl}/page1`);
      expect(await page.title()).toBe('Navigation Test - Page 1');

      // Clean up
      mockServer.removeScenario('/redirect-chain');
    });
  });

  describe('Performance Testing Scenarios', () => {
    it('should handle slow loading pages', async () => {
      const startTime = Date.now();
      const response = await page.goto(`${mockServer.baseUrl}/slow`, {
        timeout: 10000 // 10 second timeout
      });
      const loadTime = Date.now() - startTime;

      expect(response?.status()).toBe(200);
      expect(loadTime).toBeGreaterThan(400); // Should take at least 500ms
      expect(await page.title()).toBe('Navigation Test - Slow Page');
    }, 15000); // Extended timeout for this test

    it('should handle very slow loading pages', async () => {
      const startTime = Date.now();
      const response = await page.goto(`${mockServer.baseUrl}/very-slow`, {
        timeout: 15000 // 15 second timeout
      });
      const loadTime = Date.now() - startTime;

      expect(response?.status()).toBe(200);
      expect(loadTime).toBeGreaterThan(900); // Should take at least 1000ms
      expect(await page.title()).toBe('Navigation Test - Very Slow Page');
    }, 20000); // Extended timeout for this test

    it('should measure navigation performance', async () => {
      await page.goto(`${mockServer.baseUrl}/page1`);

      const navigationMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          duration: navigation.duration
        };
      });

      expect(navigationMetrics.domContentLoaded).toBeGreaterThanOrEqual(0);
      expect(navigationMetrics.loadComplete).toBeGreaterThanOrEqual(0);
      expect(navigationMetrics.duration).toBeGreaterThan(0);
    });
  });

  describe('Content Type Scenarios', () => {
    it('should handle JSON API responses', async () => {
      const response = await page.goto(`${mockServer.baseUrl}/api/data`);
      expect(response?.status()).toBe(200);

      const contentType = response?.headers()['content-type'];
      expect(contentType).toBe('application/json');

      const jsonData = await response?.json();
      expect(jsonData.message).toBe('Test API response');
      expect(jsonData.data.test).toBe(true);
      expect(jsonData.timestamp).toBeDefined();
    });

    it('should handle empty responses', async () => {
      const response = await page.goto(`${mockServer.baseUrl}/empty`);
      expect(response?.status()).toBe(200);

      const content = await page.content();
      expect(content.trim()).toBe('');
    });
  });

  describe('Custom Scenario Management', () => {
    it('should support adding custom scenarios at runtime', async () => {
      // Add a custom test scenario
      mockServer.addScenario({
        name: 'custom-test-page',
        path: '/custom-test',
        statusCode: 200,
        contentType: 'text/html',
        body: '<html><head><title>Custom Test Page</title></head><body><h1>Custom Content</h1><p>This is a custom test scenario</p></body></html>'
      });

      const response = await page.goto(`${mockServer.baseUrl}/custom-test`);
      expect(response?.status()).toBe(200);
      expect(await page.title()).toBe('Custom Test Page');
      expect(await page.textContent('h1')).toBe('Custom Content');

      // Clean up
      mockServer.removeScenario('/custom-test');
    });

    it('should support dynamic content generation', async () => {
      const testId = `test-${Date.now()}`;

      mockServer.addScenario({
        name: 'dynamic-content',
        path: '/dynamic',
        body: () => `<html><head><title>Dynamic Page</title></head><body><h1>Generated at ${new Date().toISOString()}</h1><p>Test ID: ${testId}</p></body></html>`
      });

      const response = await page.goto(`${mockServer.baseUrl}/dynamic`);
      expect(response?.status()).toBe(200);

      const content = await page.textContent('p');
      expect(content).toBe(`Test ID: ${testId}`);

      // Clean up
      mockServer.removeScenario('/dynamic');
    });

    it('should support removing scenarios', async () => {
      // Add a temporary scenario
      mockServer.addScenario({
        name: 'temporary',
        path: '/temporary',
        body: 'Temporary content'
      });

      // Verify it exists
      let response = await page.goto(`${mockServer.baseUrl}/temporary`);
      expect(response?.status()).toBe(200);

      // Remove it
      mockServer.removeScenario('/temporary');

      // Verify it's gone (should return 404)
      response = await page.goto(`${mockServer.baseUrl}/temporary`);
      expect(response?.status()).toBe(404);
    });

    it('should list available scenarios', () => {
      const scenarios = mockServer.getScenarios();
      expect(scenarios.length).toBeGreaterThan(10);

      const scenarioNames = scenarios.map(s => s.name);
      expect(scenarioNames).toContain('home');
      expect(scenarioNames).toContain('page1');
      expect(scenarioNames).toContain('server-error');
      expect(scenarioNames).toContain('slow-response');
    });
  });

  describe('Browser Navigation Features', () => {
    it('should provide working navigation controls', async () => {
      // Go to home page
      await page.goto(`${mockServer.baseUrl}/`);
      expect(await page.title()).toBe('Navigation Test Home');

      // Navigate to page 1
      await page.click('a[href="/page1"]');
      await page.waitForLoadState('networkidle');
      expect(await page.title()).toBe('Navigation Test - Page 1');

      // Use browser back button
      await page.click('button[onclick="history.back()"]');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toBe(`${mockServer.baseUrl}/`);

      // Use browser forward
      await page.click('button[onclick="history.forward()"]');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toBe(`${mockServer.baseUrl}/page1`);
    });

    it('should provide navigation information', async () => {
      await page.goto(`${mockServer.baseUrl}/page1`);

      // Check that page displays navigation information
      const currentUrl = await page.textContent('#current-url');
      expect(currentUrl).toBe(`${mockServer.baseUrl}/page1`);

      const historyLength = await page.textContent('#history-length');
      expect(parseInt(historyLength || '0')).toBeGreaterThan(0);

      const timestamp = await page.textContent('#timestamp');
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should support reload functionality', async () => {
      await page.goto(`${mockServer.baseUrl}/page1`);
      const originalTimestamp = await page.textContent('#timestamp');

      // Small delay to ensure timestamp will be different
      await page.waitForTimeout(10);

      // Reload page
      await page.click('button[onclick="location.reload()"]');
      await page.waitForLoadState('networkidle');

      const newTimestamp = await page.textContent('#timestamp');
      expect(newTimestamp).not.toBe(originalTimestamp);
      expect(page.url()).toBe(`${mockServer.baseUrl}/page1`);
    });
  });

  describe('Enhanced Home Page Features', () => {
    beforeEach(async () => {
      await page.goto(`${mockServer.baseUrl}/`);
    });

    it('should display comprehensive navigation menu', async () => {
      // Check basic navigation
      const page1Link = await page.locator('a[href="/page1"]');
      await expect(page1Link).toBeVisible();

      const page2Link = await page.locator('a[href="/page2"]');
      await expect(page2Link).toBeVisible();

      const page3Link = await page.locator('a[href="/page3"]');
      await expect(page3Link).toBeVisible();
    });

    it('should provide error testing links', async () => {
      // Check error scenario links
      const errorLink = await page.locator('a[href="/error"]');
      await expect(errorLink).toBeVisible();

      const notFoundLink = await page.locator('a[href="/404"]');
      await expect(notFoundLink).toBeVisible();

      const forbiddenLink = await page.locator('a[href="/forbidden"]');
      await expect(forbiddenLink).toBeVisible();
    });

    it('should provide performance testing links', async () => {
      // Check performance scenario links
      const slowLink = await page.locator('a[href="/slow"]');
      await expect(slowLink).toBeVisible();

      const verySlowLink = await page.locator('a[href="/very-slow"]');
      await expect(verySlowLink).toBeVisible();
    });

    it('should provide redirect testing links', async () => {
      // Check redirect scenario links
      const dynamicRedirectLink = await page.locator('a[href="/redirect?to=/page1"]');
      await expect(dynamicRedirectLink).toBeVisible();

      const tempRedirectLink = await page.locator('a[href="/redirect-temp"]');
      await expect(tempRedirectLink).toBeVisible();

      const permRedirectLink = await page.locator('a[href="/redirect-permanent"]');
      await expect(permRedirectLink).toBeVisible();
    });

    it('should provide special content links', async () => {
      // Check special content links
      const jsonLink = await page.locator('a[href="/api/data"]');
      await expect(jsonLink).toBeVisible();

      const emptyLink = await page.locator('a[href="/empty"]');
      await expect(emptyLink).toBeVisible();
    });

    it('should display server information', async () => {
      const currentUrl = await page.textContent('#current-url');
      expect(currentUrl).toBe(mockServer.baseUrl + '/');

      const timestamp = await page.textContent('#timestamp');
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      const sessionId = await page.textContent('#session-id');
      expect(sessionId).toMatch(/^nav-test-/);
    });
  });
});