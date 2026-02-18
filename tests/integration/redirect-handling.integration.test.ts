/**
 * Browser Redirect Handling Integration Tests
 *
 * Comprehensive test suite for browser-based redirect handling including:
 * - JavaScript redirects (window.location.href, assign, replace)
 * - Meta refresh redirects with various delays
 * - Combined redirect scenarios (HTTP → JS → Meta)
 * - Browser navigation tracking through redirects
 *
 * Uses Playwright for browser automation and MockServer for deterministic
 * redirect scenarios.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Browser, Page, chromium } from 'playwright';
import { MockServer } from '../../packages/core/src/test-utils/mock-server';

describe('Browser Redirect Handling Integration Tests', () => {
  let browser: Browser;
  let page: Page;
  let mockServer: MockServer;
  let baseUrl: string;

  beforeAll(async () => {
    // Start mock server
    mockServer = new MockServer();
    await mockServer.start();
    baseUrl = mockServer.getUrl();

    // Launch browser
    browser = await chromium.launch({
      headless: true, // Run headless for CI/CD
    });
  });

  afterAll(async () => {
    await browser?.close();
    await mockServer?.stop();
  });

  beforeEach(async () => {
    // Create fresh page for each test
    page = await browser.newPage();

    // Set reasonable timeouts
    page.setDefaultTimeout(10000); // 10 seconds
    page.setDefaultNavigationTimeout(15000); // 15 seconds
  });

  afterEach(async () => {
    await page?.close();
  });

  describe('JavaScript Redirects', () => {
    it('should handle window.location.href redirect', async () => {
      const startUrl = `${baseUrl}/js-redirect/href/ping`;

      // Navigate to JS redirect page
      await page.goto(startUrl);

      // Wait for redirect to complete
      await page.waitForURL(`${baseUrl}/ping`, { timeout: 5000 });

      // Verify final URL
      const finalUrl = page.url();
      expect(finalUrl).toBe(`${baseUrl}/ping`);

      // Verify page content
      const content = await page.textContent('body');
      expect(content).toContain('pong');
    });

    it('should handle window.location.assign() redirect', async () => {
      const startUrl = `${baseUrl}/js-redirect/assign/health`;

      await page.goto(startUrl);
      await page.waitForURL(`${baseUrl}/health`, { timeout: 5000 });

      expect(page.url()).toBe(`${baseUrl}/health`);

      // Verify health endpoint response
      const content = await page.textContent('body');
      expect(content).toContain('status');
      expect(content).toContain('ok');
    });

    it('should handle window.location.replace() redirect', async () => {
      const startUrl = `${baseUrl}/js-redirect/replace/ping`;

      await page.goto(startUrl);
      await page.waitForURL(`${baseUrl}/ping`, { timeout: 5000 });

      expect(page.url()).toBe(`${baseUrl}/ping`);

      // With replace(), the redirect page should not be in history
      // Try to go back - should not go to the JS redirect page
      await page.goBack();

      // Should either stay on ping page or go to about:blank
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/js-redirect/replace/ping');
    });

    it('should track navigation after JS redirect', async () => {
      let navigationCount = 0;

      // Track navigation events
      page.on('framenavigated', () => {
        navigationCount++;
      });

      await page.goto(`${baseUrl}/js-redirect/href/ping`);
      await page.waitForURL(`${baseUrl}/ping`, { timeout: 5000 });

      // Should have at least 2 navigations: initial page + redirect
      expect(navigationCount).toBeGreaterThanOrEqual(2);
    });

    it('should handle delayed JS redirect', async () => {
      const delayMs = 1000; // 1 second delay
      const startUrl = `${baseUrl}/js-redirect/href/ping/${delayMs}`;
      const startTime = Date.now();

      await page.goto(startUrl);
      await page.waitForURL(`${baseUrl}/ping`, { timeout: 5000 });

      const endTime = Date.now();
      const actualDelay = endTime - startTime;

      expect(page.url()).toBe(`${baseUrl}/ping`);
      // Verify the delay was approximately correct (with some tolerance)
      expect(actualDelay).toBeGreaterThanOrEqual(delayMs - 200);
      expect(actualDelay).toBeLessThan(delayMs + 2000);
    });
  });

  describe('Meta Refresh Redirects', () => {
    it('should handle immediate meta refresh (0 seconds)', async () => {
      const startUrl = `${baseUrl}/meta-redirect/0/ping`;

      await page.goto(startUrl);
      await page.waitForURL(`${baseUrl}/ping`, { timeout: 5000 });

      expect(page.url()).toBe(`${baseUrl}/ping`);

      const content = await page.textContent('body');
      expect(content).toContain('pong');
    });

    it('should handle delayed meta refresh (configurable)', async () => {
      const delaySeconds = 2;
      const startUrl = `${baseUrl}/meta-redirect/${delaySeconds}/health`;
      const startTime = Date.now();

      await page.goto(startUrl);

      // Verify we're initially on the meta refresh page
      let content = await page.textContent('body');
      expect(content).toContain('Meta Refresh Redirect Test');
      expect(content).toContain(`${delaySeconds} second`);

      // Wait for redirect
      await page.waitForURL(`${baseUrl}/health`, { timeout: 10000 });

      const endTime = Date.now();
      const actualDelay = endTime - startTime;

      expect(page.url()).toBe(`${baseUrl}/health`);

      // Verify timing (convert seconds to milliseconds for comparison)
      const expectedDelayMs = delaySeconds * 1000;
      expect(actualDelay).toBeGreaterThanOrEqual(expectedDelayMs - 500);
      expect(actualDelay).toBeLessThan(expectedDelayMs + 2000);
    });

    it('should detect meta refresh before completion', async () => {
      const startUrl = `${baseUrl}/meta-redirect/5/ping`;

      await page.goto(startUrl);

      // Verify meta refresh tag is present
      const metaRefresh = await page.locator('meta[http-equiv="refresh"]');
      expect(await metaRefresh.count()).toBe(1);

      const content = await metaRefresh.getAttribute('content');
      expect(content).toBe('5;url=/ping');

      // Verify initial page content
      const bodyContent = await page.textContent('body');
      expect(bodyContent).toContain('Meta Refresh Redirect Test');
      expect(bodyContent).toContain('5 seconds');
    });

    it('should track final URL after meta refresh', async () => {
      const startUrl = `${baseUrl}/meta-redirect/1/health`;

      await page.goto(startUrl);
      await page.waitForURL(`${baseUrl}/health`, { timeout: 5000 });

      const finalUrl = page.url();
      expect(finalUrl).toBe(`${baseUrl}/health`);

      // Verify final page content
      const content = await page.textContent('body');
      expect(content).toContain('status');
    });

    it('should handle meta refresh with JavaScript fallback', async () => {
      const startUrl = `${baseUrl}/meta-redirect-fallback/1/ping`;

      await page.goto(startUrl);
      await page.waitForURL(`${baseUrl}/ping`, { timeout: 5000 });

      expect(page.url()).toBe(`${baseUrl}/ping`);

      const content = await page.textContent('body');
      expect(content).toContain('pong');
    });
  });

  describe('Combined Redirect Scenarios', () => {
    it('should handle HTTP redirect to JS redirect', async () => {
      // First, HTTP redirect to a JS redirect page
      const startUrl = `${baseUrl}/redirect/302/js-redirect/href/ping`;

      await page.goto(startUrl);
      await page.waitForURL(`${baseUrl}/ping`, { timeout: 8000 });

      expect(page.url()).toBe(`${baseUrl}/ping`);
    });

    it('should handle meta refresh to HTTP redirect', async () => {
      // Meta refresh that points to an HTTP redirect
      const startUrl = `${baseUrl}/meta-redirect/1/redirect/302/health`;

      await page.goto(startUrl);
      await page.waitForURL(`${baseUrl}/health`, { timeout: 8000 });

      expect(page.url()).toBe(`${baseUrl}/health`);
    });

    it('should track full redirect chain through different mechanisms', async () => {
      const redirectEvents: string[] = [];

      // Track all navigations
      page.on('framenavigated', (frame) => {
        redirectEvents.push(frame.url());
      });

      // Complex redirect chain: HTTP → Meta Refresh → Final
      const startUrl = `${baseUrl}/redirect/302/meta-redirect/1/ping`;

      await page.goto(startUrl);
      await page.waitForURL(`${baseUrl}/ping`, { timeout: 10000 });

      expect(page.url()).toBe(`${baseUrl}/ping`);

      // Should have tracked multiple navigation events
      expect(redirectEvents.length).toBeGreaterThanOrEqual(2);
      expect(redirectEvents[redirectEvents.length - 1]).toBe(`${baseUrl}/ping`);
    });

    it('should handle redirect chain with JavaScript and meta refresh', async () => {
      // Test a complex scenario with multiple redirect types
      const startUrl = `${baseUrl}/redirect/301/js-redirect/assign/meta-redirect/0/health`;

      await page.goto(startUrl);
      await page.waitForURL(`${baseUrl}/health`, { timeout: 10000 });

      expect(page.url()).toBe(`${baseUrl}/health`);

      const content = await page.textContent('body');
      expect(content).toContain('status');
    });
  });

  describe('Browser Navigation Behavior', () => {
    it('should maintain browser history with href redirects', async () => {
      // Navigate to a regular page first
      await page.goto(`${baseUrl}/ping`);
      expect(page.url()).toBe(`${baseUrl}/ping`);

      // Then navigate to JS redirect page
      await page.goto(`${baseUrl}/js-redirect/href/health`);
      await page.waitForURL(`${baseUrl}/health`, { timeout: 5000 });

      // Should be able to go back to ping
      await page.goBack();
      expect(page.url()).toBe(`${baseUrl}/ping`);
    });

    it('should handle page reload during redirect process', async () => {
      const startUrl = `${baseUrl}/js-redirect/href/ping/2000`; // 2 second delay

      await page.goto(startUrl);

      // Reload page before redirect completes
      await page.reload();

      // Should restart the redirect process
      await page.waitForURL(`${baseUrl}/ping`, { timeout: 8000 });
      expect(page.url()).toBe(`${baseUrl}/ping`);
    });

    it('should handle multiple rapid redirects', async () => {
      // Test rapid redirect chain
      const startUrl = `${baseUrl}/redirect-chain/5`;

      await page.goto(startUrl);

      // Should eventually reach the end
      await page.waitForFunction(
        () => window.location.href.includes('/redirect-chain/0'),
        {},
        { timeout: 8000 }
      );

      const content = await page.textContent('body');
      expect(content).toContain('Redirect chain completed');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle JavaScript redirect to non-existent page', async () => {
      const startUrl = `${baseUrl}/js-redirect/href/nonexistent`;

      await page.goto(startUrl);

      // Wait for the redirect attempt
      await page.waitForTimeout(1000);

      // Should eventually navigate but get a 404 or similar
      const currentUrl = page.url();
      expect(currentUrl).toBe(`${baseUrl}/nonexistent`);
    });

    it('should handle malformed meta refresh content', async () => {
      // Add a custom route for this test
      const fastifyInstance = await mockServer.getFastifyInstance();
      fastifyInstance.get('/malformed-meta-refresh', async (request, reply) => {
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="invalid;url=/ping">
  <title>Malformed Meta Refresh</title>
</head>
<body>
  <h1>Malformed Meta Refresh Test</h1>
  <p>This page has malformed meta refresh content</p>
</body>
</html>`;
        return reply.type('text/html').send(html);
      });

      const startUrl = `${baseUrl}/malformed-meta-refresh`;

      await page.goto(startUrl);

      // Should stay on the original page since meta refresh is malformed
      await page.waitForTimeout(2000);
      expect(page.url()).toBe(startUrl);

      const content = await page.textContent('body');
      expect(content).toContain('Malformed Meta Refresh Test');
    });

    it('should handle JavaScript errors in redirect code', async () => {
      // Add a route with broken JavaScript
      const fastifyInstance = await mockServer.getFastifyInstance();
      fastifyInstance.get('/broken-js-redirect', async (request, reply) => {
        const html = `
<!DOCTYPE html>
<html>
<head><title>Broken JS Redirect</title></head>
<body>
  <h1>Broken JavaScript Redirect</h1>
  <script>
    // Broken JavaScript that should cause an error
    setTimeout(function() {
      window.location.href = undefined.someProperty;
    }, 100);
  </script>
</body>
</html>`;
        return reply.type('text/html').send(html);
      });

      const startUrl = `${baseUrl}/broken-js-redirect`;

      await page.goto(startUrl);

      // Should stay on the original page due to JavaScript error
      await page.waitForTimeout(1000);
      expect(page.url()).toBe(startUrl);

      const content = await page.textContent('body');
      expect(content).toContain('Broken JavaScript Redirect');
    });

    it('should handle timeout scenarios gracefully', async () => {
      // Test with very long delay that should timeout
      const startUrl = `${baseUrl}/js-redirect/href/ping/30000`; // 30 second delay

      await page.goto(startUrl, { timeout: 5000 });

      // Should be on the initial page, not redirected yet
      const content = await page.textContent('body');
      expect(content).toContain('Delayed JavaScript Redirect Test');
      expect(content).toContain('30000ms');
    }, 10000); // Extend test timeout
  });

  describe('Performance and Metrics', () => {
    it('should track timing for different redirect types', async () => {
      const scenarios = [
        { type: 'js-redirect/href/ping', name: 'JavaScript href' },
        { type: 'meta-redirect/0/ping', name: 'Meta refresh immediate' },
        { type: 'redirect/302/ping', name: 'HTTP 302' },
      ];

      const timings: Record<string, number> = {};

      for (const scenario of scenarios) {
        const startTime = Date.now();
        await page.goto(`${baseUrl}/${scenario.type}`);
        await page.waitForURL(`${baseUrl}/ping`, { timeout: 5000 });
        const endTime = Date.now();

        timings[scenario.name] = endTime - startTime;

        // Reset for next test
        await page.goto(`${baseUrl}/health`);
      }

      // All redirects should complete within reasonable time
      Object.entries(timings).forEach(([name, timing]) => {
        expect(timing).toBeGreaterThan(0);
        expect(timing).toBeLessThan(5000); // 5 seconds max
        console.log(`${name}: ${timing}ms`);
      });
    });
  });
});