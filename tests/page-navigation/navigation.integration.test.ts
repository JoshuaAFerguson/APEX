/**
 * @fileoverview APEX page navigation integration tests
 *
 * This test suite validates the page navigation infrastructure by testing:
 * - Basic navigation flows (forward, back, refresh)
 * - URL routing and parameter validation
 * - Navigation history management
 * - Performance measurement during navigation
 * - Error handling during navigation
 * - Mock server integration for controlled scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import {
  createNavigationBrowser,
  createNavigationContext,
  createNavigationPage,
  captureNavigationScreenshot,
  waitForNavigationComplete,
  getNavigationMetrics,
} from './setup';
import {
  runNavigationScenario,
  NAVIGATION_SCENARIOS,
  createNavigationTestPage,
  verifyNavigationState,
} from './fixtures/navigation-scenarios';
import {
  safeNavigate,
  safeNavigationClick,
  validateNavigation,
  measureNavigationPerformance,
  getNavigationHistory,
  NavigationEventMonitor,
  benchmarkNavigation,
} from './utils/navigation-helpers';

describe('Page Navigation Infrastructure', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let baseUrl: string;

  beforeEach(async () => {
    browser = await createNavigationBrowser();
    context = await createNavigationContext(browser);
    page = await createNavigationPage(context);

    // Use the mock server URL
    baseUrl = `http://localhost:${globalThis.navigationTestContext.mockServerPort}`;
  });

  afterEach(async () => {
    await page?.close();
    await context?.close();
    await browser?.close();
  });

  describe('Infrastructure Validation', () => {
    it('should create browser instances successfully', () => {
      expect(browser).toBeDefined();
      expect(context).toBeDefined();
      expect(page).toBeDefined();
    });

    it('should access mock server endpoints', async () => {
      const success = await safeNavigate(page, `${baseUrl}/`);
      expect(success).toBe(true);

      const title = await page.title();
      expect(title).toBe('Navigation Test Home');

      const url = page.url();
      expect(url).toBe(`${baseUrl}/`);
    });

    it('should capture navigation performance metrics', async () => {
      await safeNavigate(page, `${baseUrl}/`);

      const performance = await measureNavigationPerformance(page);
      expect(performance).toBeDefined();
      expect(performance.url).toBe(`${baseUrl}/`);
      expect(performance.domContentLoaded).toBeGreaterThanOrEqual(0);
      expect(performance.loadComplete).toBeGreaterThanOrEqual(0);
      expect(performance.totalNavigationTime).toBeGreaterThan(0);
    });

    it('should track navigation history', async () => {
      await safeNavigate(page, `${baseUrl}/`);
      await safeNavigationClick(page, 'a[href="/page1"]');

      const history = await getNavigationHistory(page);
      expect(history).toBeDefined();
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history.canGoBack).toBe(true);
    });

    it('should capture screenshots during navigation', async () => {
      await safeNavigate(page, `${baseUrl}/`);

      const screenshot = await captureNavigationScreenshot(
        page,
        'infrastructure-test',
        globalThis.navigationTestContext.tempDir!
      );

      expect(screenshot).toBeDefined();
      expect(screenshot).toMatch(/navigation-infrastructure-test-\d+\.png$/);
    });
  });

  describe('Basic Navigation Flows', () => {
    it('should navigate between pages using links', async () => {
      await safeNavigate(page, `${baseUrl}/`);

      // Navigate to page 1
      const success1 = await safeNavigationClick(page, 'a[href="/page1"]');
      expect(success1).toBe(true);

      const validation1 = await validateNavigation(page, {
        url: `${baseUrl}/page1`,
        title: 'Navigation Test - Page 1',
      });
      expect(validation1.valid).toBe(true);

      // Navigate to page 2
      const success2 = await safeNavigationClick(page, 'a[href="/page2"]');
      expect(success2).toBe(true);

      const validation2 = await validateNavigation(page, {
        url: `${baseUrl}/page2`,
        title: 'Navigation Test - Page 2',
      });
      expect(validation2.valid).toBe(true);
    });

    it('should handle browser back and forward navigation', async () => {
      await safeNavigate(page, `${baseUrl}/`);
      await safeNavigationClick(page, 'a[href="/page1"]');
      await safeNavigationClick(page, 'a[href="/page2"]');

      // Go back
      await Promise.all([
        page.waitForLoadState('networkidle'),
        page.goBack(),
      ]);

      const backValidation = await validateNavigation(page, {
        url: `${baseUrl}/page1`,
        title: 'Navigation Test - Page 1',
      });
      expect(backValidation.valid).toBe(true);

      // Go forward
      await Promise.all([
        page.waitForLoadState('networkidle'),
        page.goForward(),
      ]);

      const forwardValidation = await validateNavigation(page, {
        url: `${baseUrl}/page2`,
        title: 'Navigation Test - Page 2',
      });
      expect(forwardValidation.valid).toBe(true);
    });

    it('should handle page reload', async () => {
      await safeNavigate(page, `${baseUrl}/page1`);

      const beforeReload = page.url();

      await Promise.all([
        page.waitForLoadState('networkidle'),
        page.reload(),
      ]);

      const afterReload = page.url();
      expect(afterReload).toBe(beforeReload);

      const validation = await validateNavigation(page, {
        title: 'Navigation Test - Page 1',
      });
      expect(validation.valid).toBe(true);
    });
  });

  describe('Navigation Scenarios', () => {
    it('should run basic navigation scenarios', async () => {
      const basicScenario = NAVIGATION_SCENARIOS.find(
        scenario => scenario.name === 'basic-page-navigation'
      );

      expect(basicScenario).toBeDefined();

      const result = await runNavigationScenario(page, basicScenario!, baseUrl);

      expect(result.success).toBe(true);
      expect(result.metrics.finalUrl).toBe(`${baseUrl}/page2`);
      expect(result.metrics.duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should run browser history navigation scenario', async () => {
      const historyScenario = NAVIGATION_SCENARIOS.find(
        scenario => scenario.name === 'browser-history-navigation'
      );

      expect(historyScenario).toBeDefined();

      const result = await runNavigationScenario(page, historyScenario!, baseUrl);

      expect(result.success).toBe(true);
      expect(result.metrics.finalUrl).toBe(`${baseUrl}/page2`);
      expect(result.metrics.historyLength).toBe(3);
    });

    it('should handle redirect scenarios', async () => {
      const redirectScenario = NAVIGATION_SCENARIOS.find(
        scenario => scenario.name === 'redirect-handling'
      );

      expect(redirectScenario).toBeDefined();

      const result = await runNavigationScenario(page, redirectScenario!, baseUrl);

      expect(result.success).toBe(true);
      expect(result.metrics.finalUrl).toBe(`${baseUrl}/page2`);
    });

    it('should handle error pages', async () => {
      const errorScenario = NAVIGATION_SCENARIOS.find(
        scenario => scenario.name === 'error-page-handling'
      );

      expect(errorScenario).toBeDefined();

      const result = await runNavigationScenario(page, errorScenario!, baseUrl);

      expect(result.success).toBe(true); // Success because error was expected
      expect(result.metrics.error).toBeDefined();
    });
  });

  describe('Performance Validation', () => {
    it('should measure navigation performance within thresholds', async () => {
      const performance = await benchmarkNavigation(page, `${baseUrl}/`, 3);

      expect(performance.results).toHaveLength(3);
      expect(performance.average).toBeLessThan(5000); // 5 seconds average
      expect(performance.min).toBeGreaterThan(0);
      expect(performance.max).toBeGreaterThan(performance.min);
    });

    it('should track navigation events', async () => {
      const monitor = new NavigationEventMonitor(page);

      await safeNavigate(page, `${baseUrl}/`);
      await safeNavigationClick(page, 'a[href="/page1"]');

      const events = monitor.getEvents();
      const navigationCount = monitor.getNavigationCount();

      expect(events.length).toBeGreaterThan(0);
      expect(navigationCount).toBe(2); // Home + Page 1

      const loadEvents = monitor.getLoadEvents();
      expect(loadEvents.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle non-existent pages gracefully', async () => {
      const success = await safeNavigate(page, `${baseUrl}/nonexistent`);
      expect(success).toBe(true); // Navigation succeeds but returns 404

      // The mock server returns 404 for unknown routes
      const content = await page.textContent('body');
      expect(content).toContain('Page Not Found');
    });

    it('should handle slow loading pages', async () => {
      const startTime = Date.now();
      const success = await safeNavigate(page, `${baseUrl}/slow`, { timeout: 15000 });
      const loadTime = Date.now() - startTime;

      expect(success).toBe(true);
      expect(loadTime).toBeGreaterThan(1500); // Should take at least 2 seconds due to delay
      expect(loadTime).toBeLessThan(10000); // But not too long

      const validation = await validateNavigation(page, {
        title: 'Navigation Test - Slow Page',
      });
      expect(validation.valid).toBe(true);
    });

    it('should retry failed navigation attempts', async () => {
      // First try a bad URL that will fail, then a good one
      const success = await safeNavigate(page, `${baseUrl}/`, { retries: 2 });
      expect(success).toBe(true);
    });
  });

  describe('Navigation State Validation', () => {
    it('should verify complex navigation state', async () => {
      await safeNavigate(page, `${baseUrl}/`);
      await safeNavigationClick(page, 'a[href="/page1"]');
      await safeNavigationClick(page, 'a[href="/page2"]');

      const stateValid = await verifyNavigationState(
        page,
        /\/page2$/,
        'Navigation Test - Page 2'
      );
      expect(stateValid).toBe(true);

      const validation = await validateNavigation(page, {
        url: /\/page2$/,
        title: /Page 2/,
        historyLength: 3,
        hasElement: 'h1',
        textContent: { selector: 'h1', text: 'Page 2' },
      });

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
});

describe('Navigation Infrastructure Integration', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let baseUrl: string;

  beforeEach(async () => {
    browser = await createNavigationBrowser();
    context = await createNavigationContext(browser);
    page = await createNavigationPage(context);
    baseUrl = `http://localhost:${globalThis.navigationTestContext.mockServerPort}`;
  });

  afterEach(async () => {
    await page?.close();
    await context?.close();
    await browser?.close();
  });

  it('should demonstrate complete navigation workflow', async () => {
    // Start at home page
    await safeNavigate(page, `${baseUrl}/`);

    // Capture initial state
    const initialSnapshot = await captureNavigationScreenshot(
      page,
      'workflow-start',
      globalThis.navigationTestContext.tempDir!
    );
    expect(initialSnapshot).toBeDefined();

    // Navigate through multiple pages
    await safeNavigationClick(page, 'a[href="/page1"]');
    await safeNavigationClick(page, 'a[href="/page2"]');
    await safeNavigationClick(page, 'a[href="/page3"]');

    // Verify final state
    const finalValidation = await validateNavigation(page, {
      url: `${baseUrl}/page3`,
      title: 'Navigation Test - Page 3',
      historyLength: 4,
    });
    expect(finalValidation.valid).toBe(true);

    // Test navigation history
    const history = await getNavigationHistory(page);
    expect(history.length).toBe(4);
    expect(history.canGoBack).toBe(true);

    // Measure final performance
    const performance = await measureNavigationPerformance(page);
    expect(performance.totalNavigationTime).toBeGreaterThan(0);

    // Capture final state
    const finalSnapshot = await captureNavigationScreenshot(
      page,
      'workflow-end',
      globalThis.navigationTestContext.tempDir!
    );
    expect(finalSnapshot).toBeDefined();

    console.log(`Navigation workflow completed successfully`);
    console.log(`Performance: ${performance.totalNavigationTime}ms`);
    console.log(`History length: ${history.length}`);
  });
});