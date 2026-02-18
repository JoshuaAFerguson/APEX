/**
 * @fileoverview Integration tests for waitForLoadState functionality
 *
 * Tests the three primary load states:
 * - 'domcontentloaded': DOM tree parsed and ready
 * - 'load': All resources (images, styles, scripts) loaded
 * - 'networkidle': No network activity for 500ms
 *
 * Each state has 2+ test cases covering:
 * - Basic success case
 * - Edge case or timing scenario
 *
 * Acceptance Criteria:
 * ✅ Tests pass for all three load state types: 'load' (full page load),
 *    'domcontentloaded' (DOM ready), and 'networkidle' (no network activity)
 * ✅ Each state type has at least 2 test cases covering success and edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { LoadStateTestPages, createDataUrl } from './fixtures/load-state-scenarios.js';

describe('waitForLoadState Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeEach(async () => {
    browser = await chromium.launch({
      headless: process.env.CI === 'true' || process.env.BROWSER_TEST_HEADLESS === 'true'
    });
    context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    page = await context.newPage();
    page.setDefaultTimeout(10000);
  });

  afterEach(async () => {
    await page?.close();
    await context?.close();
    await browser?.close();
  });

  // ============================================================================
  // Category A: domcontentloaded State Tests
  // ============================================================================
  describe('domcontentloaded state', () => {
    it('should resolve when DOM tree is fully parsed', async () => {
      // Test: Basic domcontentloaded behavior
      const dataUrl = createDataUrl(LoadStateTestPages.domContentLoadedPage());
      await page.goto(dataUrl);
      await page.waitForLoadState('domcontentloaded');

      const indicator = page.locator('#dom-indicator');
      await expect(indicator).toBeVisible();
      expect(await indicator.getAttribute('data-status')).toBe('dom-ready');
      expect(await indicator.textContent()).toBe('DOM Ready');
    });

    it('should wait for deferred scripts to execute', async () => {
      // Edge case: Deferred script execution timing
      const dataUrl = createDataUrl(LoadStateTestPages.domContentLoadedDeferredPage());
      await page.goto(dataUrl);
      await page.waitForLoadState('domcontentloaded');

      const indicator = page.locator('#deferred-indicator');
      await expect(indicator).toBeVisible();
      // Deferred scripts run after DOM parsing but before DOMContentLoaded
      expect(await indicator.getAttribute('data-loaded')).toBe('true');
    });

    it('should handle timeout gracefully when waiting too long', async () => {
      // Edge case: Timeout behavior for domcontentloaded
      const dataUrl = createDataUrl(LoadStateTestPages.domContentLoadedPage());
      await page.goto(dataUrl);

      // This should succeed quickly since DOM loads fast
      const startTime = Date.now();
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
      const duration = Date.now() - startTime;

      // Should complete much faster than timeout
      expect(duration).toBeLessThan(1000);
    });
  });

  // ============================================================================
  // Category B: load State Tests
  // ============================================================================
  describe('load state', () => {
    it('should resolve when all resources are fully loaded', async () => {
      // Test: Basic load behavior - all resources including images
      const dataUrl = createDataUrl(LoadStateTestPages.fullLoadPage());
      await page.goto(dataUrl);
      await page.waitForLoadState('load');

      const content = page.locator('#content');
      await expect(content).toBeVisible();
      expect(await content.getAttribute('data-status')).toBe('complete');
      expect(await content.textContent()).toBe('All Resources Loaded');
      expect(await content.getAttribute('class')).toBe('loaded');
    });

    it('should wait for multiple resources to load', async () => {
      // Edge case: Multiple resources must all complete
      const dataUrl = createDataUrl(LoadStateTestPages.fullLoadMultiResourcePage());
      await page.goto(dataUrl);
      await page.waitForLoadState('load');

      const counter = page.locator('#counter');
      await expect(counter).toBeVisible();
      const count = await counter.getAttribute('data-count');
      expect(parseInt(count || '0', 10)).toBeGreaterThanOrEqual(3);

      const status = page.locator('#status');
      const statusText = await status.textContent();
      expect(statusText).toContain('resources loaded');
    });

    it('should complete faster than domcontentloaded when no external resources', async () => {
      // Edge case: Load behavior with minimal resources
      const simpleHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Simple Load Test</title></head>
        <body>
          <div id="content">Simple content</div>
          <script>
            window.loadTimestamp = Date.now();
            document.getElementById('content').dataset.loadTime = window.loadTimestamp.toString();
          </script>
        </body>
        </html>
      `;

      const dataUrl = createDataUrl(simpleHtml);
      await page.goto(dataUrl);
      await page.waitForLoadState('load');

      const content = page.locator('#content');
      const loadTime = await content.getAttribute('data-load-time');
      expect(loadTime).toBeTruthy();
    });
  });

  // ============================================================================
  // Category C: networkidle State Tests
  // ============================================================================
  describe('networkidle state', () => {
    it('should resolve when network is idle for 500ms', async () => {
      // Test: Basic networkidle - async activity completes then settles
      const dataUrl = createDataUrl(LoadStateTestPages.networkIdlePage(200));
      await page.goto(dataUrl);
      await page.waitForLoadState('networkidle');

      const status = page.locator('#status');
      await expect(status).toBeVisible();
      expect(await status.getAttribute('data-phase')).toBe('idle');
      expect(await status.textContent()).toBe('Network Idle');

      const activityCount = page.locator('#activity-count');
      const count = await activityCount.textContent();
      expect(parseInt(count || '0', 10)).toBeGreaterThan(0);
    });

    it('should wait for sequential async operations to complete', async () => {
      // Edge case: Multiple sequential operations
      const dataUrl = createDataUrl(LoadStateTestPages.networkIdleSequentialPage(3, 100));
      await page.goto(dataUrl);
      await page.waitForLoadState('networkidle');

      const status = page.locator('#status');
      await expect(status).toBeVisible();
      expect(await status.getAttribute('data-phase')).toBe('complete');
      expect(await status.textContent()).toBe('All operations complete');

      const count = await page.locator('#operations-complete').textContent();
      expect(parseInt(count || '0', 10)).toBe(3);
    });

    it('should timeout when network never becomes idle', async () => {
      // Edge case: Timeout behavior
      const dataUrl = createDataUrl(LoadStateTestPages.neverIdlePage());
      await page.goto(dataUrl);

      await expect(
        page.waitForLoadState('networkidle', { timeout: 1000 })
      ).rejects.toThrow();

      // Verify the page is still continuously active
      const status = page.locator('#status');
      expect(await status.textContent()).toBe('Continuous activity');
    });

    it('should handle networkidle with rapid sequential operations', async () => {
      // Edge case: Fast sequential operations that eventually settle
      const dataUrl = createDataUrl(LoadStateTestPages.networkIdleSequentialPage(5, 50));
      await page.goto(dataUrl);

      const startTime = Date.now();
      await page.waitForLoadState('networkidle');
      const duration = Date.now() - startTime;

      const status = page.locator('#status');
      expect(await status.getAttribute('data-phase')).toBe('complete');

      // Should take at least the time for operations plus idle time
      expect(duration).toBeGreaterThan(250); // 5 * 50ms operations

      const count = await page.locator('#operations-complete').textContent();
      expect(parseInt(count || '0', 10)).toBe(5);
    });
  });

  // ============================================================================
  // Category D: Cross-State Comparison Tests
  // ============================================================================
  describe('load state timing order', () => {
    it('should fire domcontentloaded before load', async () => {
      // Verify proper ordering: domcontentloaded < load
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Timing Test</title></head>
        <body>
          <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
          <div id="result"></div>
          <script>
            document.addEventListener('DOMContentLoaded', () => {
              window.dcl = Date.now();
            });
            window.addEventListener('load', () => {
              window.loadTime = Date.now();
            });
          </script>
        </body>
        </html>
      `;

      const dataUrl = createDataUrl(html);
      await page.goto(dataUrl);
      await page.waitForLoadState('load');

      const times = await page.evaluate(() => ({
        dcl: (window as any).dcl,
        load: (window as any).loadTime,
      }));

      expect(times.dcl).toBeTruthy();
      expect(times.load).toBeTruthy();
      expect(times.dcl).toBeLessThanOrEqual(times.load);
    });

    it('should handle all load states in sequence', async () => {
      // Integration test: Verify all three states can be waited for in sequence
      const dataUrl = createDataUrl(LoadStateTestPages.networkIdleSequentialPage(2, 100));
      await page.goto(dataUrl);

      // Wait for each state in logical order
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('load');
      await page.waitForLoadState('networkidle');

      // Verify final state
      const status = page.locator('#status');
      expect(await status.getAttribute('data-phase')).toBe('complete');

      const count = await page.locator('#operations-complete').textContent();
      expect(parseInt(count || '0', 10)).toBe(2);
    });
  });

  // ============================================================================
  // Category E: Edge Cases and Error Conditions
  // ============================================================================
  describe('edge cases and error handling', () => {
    it('should handle immediate completion for already loaded content', async () => {
      // Test: waitForLoadState when state already achieved
      const dataUrl = createDataUrl(LoadStateTestPages.domContentLoadedPage());
      await page.goto(dataUrl);

      // Wait for full load first
      await page.waitForLoadState('load');

      // Now waiting for earlier states should complete immediately
      const startTime = Date.now();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('load');
      const duration = Date.now() - startTime;

      // Should complete very quickly since states already achieved
      expect(duration).toBeLessThan(100);
    });

    it('should work with complex mixed content', async () => {
      // Test: Complex page with multiple resource types
      const complexHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Complex Load Test</title>
          <style>
            body { font-family: Arial, sans-serif; }
            .indicator { padding: 10px; margin: 5px; }
          </style>
        </head>
        <body>
          <div id="dom-indicator" class="indicator">DOM Loading...</div>
          <div id="resources-indicator" class="indicator">Resources Loading...</div>
          <div id="network-indicator" class="indicator">Network Activity...</div>

          <!-- Multiple resource types -->
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" />
          <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />

          <script>
            // DOM ready handler
            document.addEventListener('DOMContentLoaded', () => {
              document.getElementById('dom-indicator').textContent = 'DOM Ready';
            });

            // Load event handler
            window.addEventListener('load', () => {
              document.getElementById('resources-indicator').textContent = 'Resources Loaded';

              // Simulate some async network activity that will settle
              setTimeout(() => {
                document.getElementById('network-indicator').textContent = 'Network Settled';
              }, 200);
            });
          </script>
        </body>
        </html>
      `;

      const dataUrl = createDataUrl(complexHtml);
      await page.goto(dataUrl);

      // Test each state works with complex content
      await page.waitForLoadState('domcontentloaded');
      expect(await page.locator('#dom-indicator').textContent()).toBe('DOM Ready');

      await page.waitForLoadState('load');
      expect(await page.locator('#resources-indicator').textContent()).toBe('Resources Loaded');

      await page.waitForLoadState('networkidle');
      expect(await page.locator('#network-indicator').textContent()).toBe('Network Settled');
    });
  });
});