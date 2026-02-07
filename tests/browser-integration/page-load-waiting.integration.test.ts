/**
 * @fileoverview Page Load Waiting Integration Tests
 *
 * Comprehensive integration tests for page load waiting functionality covering:
 * - Wait strategies (waitForLoadState, waitForSelector, waitForNavigation)
 * - Custom wait conditions (JavaScript-based custom waits and combined conditions)
 * - Timeout configurations (graceful timeout handling and configurable timeouts)
 *
 * Acceptance Criteria:
 * ✅ Tests pass for various wait strategies including DOM content loaded, network idle, and custom element waits
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import {
  createBrowserManager,
  createBrowserSession,
  BrowserManager,
  BrowserSession,
} from '@apexcli/browser';
import { PageLoadTestPages, createDataUrl } from './fixtures/page-load-scenarios.js';

describe('Page Load Waiting Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeEach(async () => {
    browser = await chromium.launch({
      headless: process.env.CI === 'true' || process.env.BROWSER_TEST_HEADLESS === 'true',
    });
    context = await browser.newContext();
    page = await context.newPage();
    // Set default timeout for page operations
    page.setDefaultTimeout(30000);
  });

  afterEach(async () => {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  });

  describe('waitForLoadState strategies', () => {
    it('should wait for domcontentloaded state', async () => {
      await page.setContent(PageLoadTestPages.domContentPage());
      await page.waitForLoadState('domcontentloaded');

      const domIndicator = await page.locator('#dom-indicator');
      await expect(domIndicator).toBeVisible();
      expect(await domIndicator.getAttribute('data-loaded')).toBe('true');
    });

    it('should wait for load state (all resources)', async () => {
      await page.setContent(PageLoadTestPages.fullLoadPage(100));
      await page.waitForLoadState('load');

      const content = await page.textContent('#content');
      expect(content).toBe('Fully Loaded');
    });

    it('should wait for networkidle state', async () => {
      await page.setContent(PageLoadTestPages.networkIdlePage(3, 50));
      await page.waitForLoadState('networkidle');

      const status = await page.textContent('#status');
      expect(status).toBe('Complete');
    });

    it('should handle commit state for early access', async () => {
      const dataUrl = createDataUrl(PageLoadTestPages.immediateLoad());
      await page.goto(dataUrl, { waitUntil: 'commit' });

      // Page may not be fully loaded but navigation committed
      expect(page.url()).toContain('data:text/html');

      // Verify content is accessible
      const content = await page.textContent('#content');
      expect(content).toBe('Content loaded immediately');
    });

    it('should respect different load states for the same page', async () => {
      await page.setContent(PageLoadTestPages.fullLoadPage(200));

      // DOM should be ready quickly
      const domStartTime = Date.now();
      await page.waitForLoadState('domcontentloaded');
      const domDuration = Date.now() - domStartTime;
      expect(domDuration).toBeLessThan(100);

      // Full load should take longer due to the delay
      const loadStartTime = Date.now();
      await page.waitForLoadState('load');
      const loadDuration = Date.now() - loadStartTime;
      expect(loadDuration).toBeGreaterThan(150);
    });
  });

  describe('waitForSelector strategies', () => {
    it('should wait for element to become visible', async () => {
      await page.setContent(PageLoadTestPages.delayedElementPage('delayed-element', 200));

      const element = await page.waitForSelector('#delayed-element', {
        state: 'visible',
        timeout: 5000
      });

      expect(element).not.toBeNull();
      const text = await element?.textContent();
      expect(text).toBe('Element appeared!');
    });

    it('should wait for element to be attached to DOM', async () => {
      await page.setContent(PageLoadTestPages.delayedElementPage('delayed-element', 100));

      await page.waitForSelector('#delayed-element', {
        state: 'attached',
        timeout: 5000
      });

      const exists = await page.locator('#delayed-element').count();
      expect(exists).toBe(1);
    });

    it('should wait for element to become hidden', async () => {
      await page.setContent(PageLoadTestPages.elementStateChangePage('visible', 100));

      await page.waitForSelector('#toggle-element', {
        state: 'hidden',
        timeout: 5000
      });

      const isVisible = await page.locator('#toggle-element').isVisible();
      expect(isVisible).toBe(false);
    });

    it('should wait for element to be detached from DOM', async () => {
      await page.setContent(PageLoadTestPages.elementRemovalPage(100));

      await page.waitForSelector('#removable', {
        state: 'detached',
        timeout: 5000
      });

      const count = await page.locator('#removable').count();
      expect(count).toBe(0);

      // Verify status was updated
      const status = await page.textContent('#status');
      expect(status).toBe('Element removed');
    });

    it('should handle element state transitions accurately', async () => {
      await page.setContent(PageLoadTestPages.elementStateChangePage('hidden', 150));

      // Initially hidden
      const initiallyHidden = await page.locator('#toggle-element').isVisible();
      expect(initiallyHidden).toBe(false);

      // Wait for it to become visible
      await page.waitForSelector('#toggle-element', {
        state: 'visible',
        timeout: 5000
      });

      const finallyVisible = await page.locator('#toggle-element').isVisible();
      expect(finallyVisible).toBe(true);
    });
  });

  describe('waitForNavigation strategies', () => {
    it('should wait for URL-triggered navigation', async () => {
      await page.setContent(PageLoadTestPages.spaNavigationPage());

      const navigationPromise = page.waitForURL('**/#page1', { timeout: 5000 });
      await page.click('#link1');
      await navigationPromise;

      expect(page.url()).toContain('#page1');
      const content = await page.textContent('#page1-content');
      expect(content).toBe('Page 1 Loaded');
    });

    it('should wait for programmatic navigation', async () => {
      await page.setContent(PageLoadTestPages.programmaticNavigationPage());

      const navPromise = page.waitForURL('**/#target', { timeout: 5000 });
      await page.click('#nav-btn');
      await navPromise;

      expect(page.url()).toContain('#target');
      const status = await page.textContent('#status');
      expect(status).toBe('Navigated');
    });

    it('should support URL pattern matching', async () => {
      await page.setContent(PageLoadTestPages.spaNavigationPage());

      // Wait for any hash change matching pattern
      const navPromise = page.waitForURL(/.*#page\d/, { timeout: 5000 });
      await page.click('#link2');
      await navPromise;

      expect(page.url()).toMatch(/#page2/);
      const content = await page.textContent('#page2-content');
      expect(content).toBe('Page 2 Loaded');
    });

    it('should handle multiple navigation events', async () => {
      await page.setContent(PageLoadTestPages.spaNavigationPage());

      // Navigate to page1
      const nav1Promise = page.waitForURL('**/#page1');
      await page.click('#link1');
      await nav1Promise;
      expect(page.url()).toContain('#page1');

      // Navigate to page2
      const nav2Promise = page.waitForURL('**/#page2');
      await page.click('#link2');
      await nav2Promise;
      expect(page.url()).toContain('#page2');
    });
  });

  describe('custom wait conditions', () => {
    it('should wait for custom JavaScript condition', async () => {
      await page.setContent(PageLoadTestPages.customConditionPage());

      // Wait for app state to be initialized
      await page.waitForFunction(() => {
        return (window as any).appState?.initialized === true;
      }, { timeout: 5000 });

      const appState = await page.evaluate(() => (window as any).appState);
      expect(appState.initialized).toBe(true);
    });

    it('should wait for data-attribute condition', async () => {
      await page.setContent(PageLoadTestPages.customConditionPage());

      // Wait for data-ready attribute
      await page.waitForFunction(() => {
        const el = document.getElementById('data-container');
        return el?.dataset.ready === 'true';
      }, { timeout: 5000 });

      const indicator = await page.textContent('#loading-indicator');
      expect(indicator).toBe('Ready');
    });

    it('should wait for complex multi-condition state', async () => {
      await page.setContent(PageLoadTestPages.customConditionPage());

      // Wait for both conditions
      await page.waitForFunction(() => {
        const state = (window as any).appState;
        return state?.initialized && state?.dataLoaded;
      }, { timeout: 5000 });

      const appState = await page.evaluate(() => (window as any).appState);
      expect(appState.initialized).toBe(true);
      expect(appState.dataLoaded).toBe(true);
    });

    it('should wait for element count condition', async () => {
      await page.setContent(PageLoadTestPages.sequentialElementsPage(5, 50));

      // Wait for 5 items to be added
      await page.waitForFunction(() => {
        return document.querySelectorAll('.list-item').length >= 5;
      }, { timeout: 5000 });

      const count = await page.locator('.list-item').count();
      expect(count).toBeGreaterThanOrEqual(5);
    });

    it('should wait for specific element attributes', async () => {
      await page.setContent(PageLoadTestPages.delayedElementPage('test-element', 100));

      // Wait for element with specific data attribute
      await page.waitForFunction(() => {
        const el = document.getElementById('test-element');
        return el?.dataset.loaded === 'true';
      }, { timeout: 5000 });

      const element = await page.locator('#test-element');
      expect(await element.getAttribute('data-loaded')).toBe('true');
    });
  });

  describe('timeout configurations', () => {
    it('should respect custom timeout for waitForSelector', async () => {
      await page.setContent(PageLoadTestPages.timeoutTestPage());

      const startTime = Date.now();

      await expect(
        page.waitForSelector('#missing-element', { timeout: 500 })
      ).rejects.toThrow();

      const elapsed = Date.now() - startTime;
      // Should timeout around 500ms (with some tolerance)
      expect(elapsed).toBeGreaterThanOrEqual(450);
      expect(elapsed).toBeLessThan(1000);
    });

    it('should respect default timeout from page settings', async () => {
      page.setDefaultTimeout(1000);
      await page.setContent(PageLoadTestPages.timeoutTestPage());

      const startTime = Date.now();

      await expect(
        page.waitForSelector('#missing-element')
      ).rejects.toThrow();

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(950);
      expect(elapsed).toBeLessThan(2000);
    });

    it('should handle waitForLoadState timeout gracefully', async () => {
      await page.setContent(PageLoadTestPages.neverIdlePage());

      await expect(
        page.waitForLoadState('networkidle', { timeout: 500 })
      ).rejects.toThrow();
    });

    it('should handle waitForFunction timeout', async () => {
      await page.setContent('<html><body></body></html>');

      await expect(
        page.waitForFunction(() => false, { timeout: 500 })
      ).rejects.toThrow();
    });

    it('should succeed before timeout when condition is met', async () => {
      await page.setContent(PageLoadTestPages.delayedElementPage('quick-element', 50));

      const startTime = Date.now();

      await page.waitForSelector('#quick-element', { timeout: 5000 });

      const elapsed = Date.now() - startTime;
      // Should complete much faster than timeout
      expect(elapsed).toBeLessThan(500);
    });

    it('should handle varying timeout values correctly', async () => {
      await page.setContent(PageLoadTestPages.timeoutTestPage());

      // Test short timeout
      const shortStart = Date.now();
      await expect(
        page.waitForSelector('#missing-element', { timeout: 200 })
      ).rejects.toThrow();
      const shortElapsed = Date.now() - shortStart;
      expect(shortElapsed).toBeLessThan(400);

      // Test longer timeout
      const longStart = Date.now();
      await expect(
        page.waitForSelector('#missing-element', { timeout: 800 })
      ).rejects.toThrow();
      const longElapsed = Date.now() - longStart;
      expect(longElapsed).toBeGreaterThanOrEqual(750);
    });
  });

  describe('combined wait strategies', () => {
    it('should combine waitForLoadState with waitForSelector', async () => {
      await page.setContent(PageLoadTestPages.fullLoadPage(100));

      // Wait for DOM first
      await page.waitForLoadState('domcontentloaded');

      // Then wait for specific element
      await page.waitForSelector('#content.loaded', {
        state: 'visible',
        timeout: 5000
      });

      const text = await page.textContent('#content');
      expect(text).toBe('Fully Loaded');
    });

    it('should chain navigation and element waits', async () => {
      await page.setContent(PageLoadTestPages.spaNavigationPage());

      // Navigate via click
      await page.click('#link1');

      // Wait for navigation
      await page.waitForURL('**/#page1');

      // Wait for content to load
      await page.waitForSelector('#page1-content', { state: 'visible' });

      const content = await page.textContent('#page1-content');
      expect(content).toBe('Page 1 Loaded');
    });

    it('should use Promise.all for parallel waits', async () => {
      await page.setContent(PageLoadTestPages.parallelElementsPage());

      // Wait for both elements in parallel
      await Promise.all([
        page.waitForSelector('#elem1', { state: 'visible' }),
        page.waitForSelector('#elem2', { state: 'visible' }),
      ]);

      const visible1 = await page.locator('#elem1').isVisible();
      const visible2 = await page.locator('#elem2').isVisible();
      expect(visible1).toBe(true);
      expect(visible2).toBe(true);
    });

    it('should use Promise.race for first-match scenarios', async () => {
      await page.setContent(PageLoadTestPages.parallelElementsPage());

      // Wait for either success or error (success appears first)
      const result = await Promise.race([
        page.waitForSelector('#success', { state: 'visible' }).then(() => 'success'),
        page.waitForSelector('#error', { state: 'visible' }).then(() => 'error'),
      ]);

      expect(result).toBe('success');
    });

    it('should combine custom wait functions with element waits', async () => {
      await page.setContent(PageLoadTestPages.customConditionPage());

      // Wait for app state first
      await page.waitForFunction(() => {
        return (window as any).appState?.initialized === true;
      });

      // Then wait for specific element state
      await page.waitForSelector('#data-container[data-ready="true"]');

      const appState = await page.evaluate(() => (window as any).appState);
      expect(appState.initialized).toBe(true);

      const dataReady = await page.locator('#data-container').getAttribute('data-ready');
      expect(dataReady).toBe('true');
    });

    it('should handle sequential waits with state transitions', async () => {
      await page.setContent(PageLoadTestPages.sequentialElementsPage(3, 100));

      // Wait for first item
      await page.waitForSelector('.list-item:nth-child(1)');

      // Wait for third item
      await page.waitForSelector('.list-item:nth-child(3)');

      // Verify all items are present
      const itemCount = await page.locator('.list-item').count();
      expect(itemCount).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('BrowserSession Wait Method Integration', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(async () => {
    manager = createBrowserManager();
    session = createBrowserSession(manager, {
      browserType: 'chromium',
      headless: process.env.CI === 'true' || process.env.BROWSER_TEST_HEADLESS === 'true',
      timeout: 10000,
    });
    await session.launch();
  });

  afterEach(async () => {
    await session.close();
    await manager.shutdown();
  });

  describe('waitForElement method', () => {
    it('should wait for element visibility', async () => {
      const dataUrl = createDataUrl(PageLoadTestPages.delayedElementPage('delayed', 100));
      await session.navigate(dataUrl);

      const result = await session.waitForElement('#delayed', {
        state: 'visible',
        timeout: 5000
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should return error result on timeout', async () => {
      const dataUrl = createDataUrl(PageLoadTestPages.timeoutTestPage());
      await session.navigate(dataUrl);

      const result = await session.waitForElement('#nonexistent', {
        timeout: 500
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('timeout');
    });

    it('should handle different element states', async () => {
      const dataUrl = createDataUrl(PageLoadTestPages.elementStateChangePage('hidden', 100));
      await session.navigate(dataUrl);

      // Wait for element to become visible
      const result = await session.waitForElement('#toggle-element', {
        state: 'visible',
        timeout: 5000
      });

      expect(result.success).toBe(true);
    });
  });

  describe('waitForNavigation method', () => {
    it('should wait for URL change', async () => {
      const dataUrl = createDataUrl(PageLoadTestPages.spaNavigationPage());
      await session.navigate(dataUrl);

      // Start navigation
      await session.click('#link1');

      const result = await session.waitForNavigation({
        url: '**/#page1',
        timeout: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.data).toContain('#page1');
    });

    it('should handle timeout for navigation that never occurs', async () => {
      const dataUrl = createDataUrl(PageLoadTestPages.spaNavigationPage());
      await session.navigate(dataUrl);

      // Don't trigger navigation, just wait
      const result = await session.waitForNavigation({
        url: '**/#nonexistent',
        timeout: 500,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should wait for programmatic navigation', async () => {
      const dataUrl = createDataUrl(PageLoadTestPages.programmaticNavigationPage());
      await session.navigate(dataUrl);

      // Trigger programmatic navigation
      await session.click('#nav-btn');

      const result = await session.waitForNavigation({
        url: '**/#target',
        timeout: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.data).toContain('#target');
    });
  });

  describe('integration with evaluate method', () => {
    it('should combine evaluate with wait conditions for custom waits', async () => {
      const dataUrl = createDataUrl(PageLoadTestPages.customConditionPage());
      await session.navigate(dataUrl);

      // Use evaluate to create a custom wait condition
      const result = await session.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          const checkCondition = () => {
            const state = (window as any).appState;
            if (state?.dataLoaded) {
              resolve(true);
            } else {
              setTimeout(checkCondition, 50);
            }
          };
          checkCondition();
        });
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });
  });
});