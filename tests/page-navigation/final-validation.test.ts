/**
 * @fileoverview Final validation test for page navigation test infrastructure
 * @description Comprehensive validation that all test utilities and fixtures work correctly
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import {
  safeNavigate,
  validateNavigation,
  measureNavigationPerformance,
  safeNavigationClick,
  waitForNavigationComplete,
  getNavigationHistory,
  captureNavigationSnapshot
} from './utils/navigation-helpers';
import {
  assertURL,
  assertPageTitle,
  assertElementExists,
  assertPageContent,
  assertNavigationPerformance
} from './utils/assertions';
import {
  createBrowserFixture,
  createPageFixture,
  withNavigationPage,
  createMultiPageFixture
} from './utils/browser-fixtures';
import { MockNavigationServer } from './mock-server';
import * as navigationScenarios from './fixtures/navigation-scenarios';

/**
 * Test Infrastructure Validation
 * Validates that all components of the page navigation test infrastructure work correctly
 */
describe('Page Navigation Test Infrastructure - Final Validation', () => {
  let mockServer: MockNavigationServer;
  let serverUrl: string;

  beforeAll(async () => {
    // Start mock server for testing
    mockServer = new MockNavigationServer();
    await mockServer.start();
    serverUrl = mockServer.getUrl();
  });

  afterAll(async () => {
    await mockServer?.stop();
  });

  describe('Navigation Helpers Validation', () => {
    it('should validate safeNavigate utility works correctly', async () => {
      const browser = await createBrowserFixture();
      const page = await createPageFixture(browser);

      try {
        // Test basic navigation
        const result = await safeNavigate(page, `${serverUrl}/page1`, {
          timeout: 10000,
          retries: 2
        });
        expect(result.success).toBe(true);
        expect(result.finalUrl).toBe(`${serverUrl}/page1`);
        expect(page.url()).toBe(`${serverUrl}/page1`);

        // Test error handling with invalid URL
        const errorResult = await safeNavigate(page, `${serverUrl}/nonexistent`, {
          timeout: 5000,
          retries: 1
        });
        expect(errorResult.success).toBe(false);
        expect(errorResult.error).toBeDefined();
      } finally {
        await page.close();
        await browser.close();
      }
    });

    it('should validate navigationValidation utility works correctly', async () => {
      const browser = await createBrowserFixture();
      const page = await createPageFixture(browser);

      try {
        await safeNavigate(page, `${serverUrl}/page1`);

        // Test URL validation
        const urlValidation = await validateNavigation(page, {
          expectedUrl: `${serverUrl}/page1`
        });
        expect(urlValidation.success).toBe(true);

        // Test title validation
        const titleValidation = await validateNavigation(page, {
          expectedTitle: /Page 1/
        });
        expect(titleValidation.success).toBe(true);

        // Test element validation
        const elementValidation = await validateNavigation(page, {
          requiredElements: [
            { selector: 'h1', text: 'Page 1' },
            { selector: 'a', text: 'Go to Page 2' }
          ]
        });
        expect(elementValidation.success).toBe(true);
      } finally {
        await page.close();
        await browser.close();
      }
    });

    it('should validate performance measurement utility', async () => {
      const browser = await createBrowserFixture();
      const page = await createPageFixture(browser);

      try {
        await page.goto(serverUrl);

        const metrics = await measureNavigationPerformance(page);

        expect(metrics).toHaveProperty('domContentLoaded');
        expect(metrics).toHaveProperty('loadComplete');
        expect(metrics).toHaveProperty('firstContentfulPaint');
        expect(typeof metrics.domContentLoaded).toBe('number');
        expect(typeof metrics.loadComplete).toBe('number');
        expect(metrics.domContentLoaded).toBeGreaterThan(0);
        expect(metrics.loadComplete).toBeGreaterThan(0);
      } finally {
        await page.close();
        await browser.close();
      }
    });

    it('should validate navigation history utilities', async () => {
      const browser = await createBrowserFixture();
      const page = await createPageFixture(browser);

      try {
        // Navigate to multiple pages to create history
        await safeNavigate(page, serverUrl);
        await safeNavigate(page, `${serverUrl}/page1`);
        await safeNavigate(page, `${serverUrl}/page2`);

        const history = await getNavigationHistory(page);

        expect(history).toHaveProperty('length');
        expect(history).toHaveProperty('canGoBack');
        expect(history).toHaveProperty('canGoForward');
        expect(history.length).toBeGreaterThan(1);
        expect(history.canGoBack).toBe(true);
      } finally {
        await page.close();
        await browser.close();
      }
    });
  });

  describe('Assertion Helpers Validation', () => {
    it('should validate URL assertion helpers', async () => {
      const browser = await createBrowserFixture();
      const page = await createPageFixture(browser);

      try {
        await safeNavigate(page, `${serverUrl}/page1`);

        // Test exact URL assertion
        await expect(assertURL(page, `${serverUrl}/page1`)).resolves.not.toThrow();

        // Test URL pattern assertion
        await expect(assertURL(page, /\/page1$/)).resolves.not.toThrow();

        // Test failure case
        await expect(assertURL(page, `${serverUrl}/nonexistent`)).rejects.toThrow();
      } finally {
        await page.close();
        await browser.close();
      }
    });

    it('should validate content assertion helpers', async () => {
      const browser = await createBrowserFixture();
      const page = await createPageFixture(browser);

      try {
        await safeNavigate(page, `${serverUrl}/page1`);

        // Test title assertion
        await expect(assertPageTitle(page, /Page 1/)).resolves.not.toThrow();

        // Test element existence assertion
        await expect(assertElementExists(page, 'h1')).resolves.not.toThrow();

        // Test page content assertion
        await expect(assertPageContent(page, {
          title: /Page 1/,
          elements: [
            { selector: 'h1', text: 'Page 1' }
          ]
        })).resolves.not.toThrow();
      } finally {
        await page.close();
        await browser.close();
      }
    });

    it('should validate performance assertion helpers', async () => {
      const browser = await createBrowserFixture();
      const page = await createPageFixture(browser);

      try {
        await page.goto(serverUrl);

        // Test performance assertion with reasonable thresholds
        await expect(assertNavigationPerformance(page, {
          domContentLoaded: { max: 5000 },
          loadComplete: { max: 10000 }
        })).resolves.not.toThrow();

        // Test failure case with very strict thresholds
        await expect(assertNavigationPerformance(page, {
          domContentLoaded: { max: 1 },
          loadComplete: { max: 1 }
        })).rejects.toThrow();
      } finally {
        await page.close();
        await browser.close();
      }
    });
  });

  describe('Browser Fixtures Validation', () => {
    it('should validate browser fixture creation and cleanup', async () => {
      const browser = await createBrowserFixture({
        headless: true,
        viewport: { width: 1280, height: 720 }
      });

      expect(browser).toBeDefined();
      expect(browser.isConnected()).toBe(true);

      // Test context creation
      const context = await browser.newContext();
      expect(context).toBeDefined();

      // Test page creation
      const page = await context.newPage();
      expect(page).toBeDefined();
      expect(page.viewportSize()).toEqual({ width: 1280, height: 720 });

      // Cleanup
      await page.close();
      await context.close();
      await browser.close();

      expect(browser.isConnected()).toBe(false);
    });

    it('should validate page fixture with auto-cleanup', async () => {
      const browser = await createBrowserFixture();

      const page = await createPageFixture(browser, {
        viewport: { width: 1024, height: 768 },
        userAgent: 'test-user-agent',
        extraHTTPHeaders: { 'X-Test': 'true' }
      });

      expect(page).toBeDefined();
      expect(page.viewportSize()).toEqual({ width: 1024, height: 768 });

      await page.close();
      await browser.close();
    });

    it('should validate withNavigationPage scoped fixture', async () => {
      const browser = await createBrowserFixture();

      let pageInsideScope: Page | null = null;

      await withNavigationPage(browser, async (page) => {
        pageInsideScope = page;

        expect(page).toBeDefined();
        expect(page.isClosed()).toBe(false);

        // Test navigation within scope
        await safeNavigate(page, serverUrl);
        expect(page.url()).toBe(serverUrl);
      });

      // Verify page is cleaned up after scope
      expect(pageInsideScope?.isClosed()).toBe(true);

      await browser.close();
    });

    it('should validate multi-page fixture creation', async () => {
      const browser = await createBrowserFixture();

      const pages = await createMultiPageFixture(browser, 3);

      expect(pages).toHaveLength(3);
      expect(pages[0]).toBeDefined();
      expect(pages[1]).toBeDefined();
      expect(pages[2]).toBeDefined();

      // Test independent navigation
      await safeNavigate(pages[0], `${serverUrl}/page1`);
      await safeNavigate(pages[1], `${serverUrl}/page2`);

      expect(pages[0].url()).toBe(`${serverUrl}/page1`);
      expect(pages[1].url()).toBe(`${serverUrl}/page2`);

      // Cleanup
      for (const page of pages) {
        await page.close();
      }
      await browser.close();
    });
  });

  describe('Mock Server Integration Validation', () => {
    it('should validate mock server provides correct test routes', async () => {
      const browser = await createBrowserFixture();
      const page = await createPageFixture(browser);

      try {
        // Test home page
        await safeNavigate(page, serverUrl);
        await assertPageContent(page, {
          title: /Navigation Test Server/,
          elements: [
            { selector: 'h1', text: 'Navigation Test Server' }
          ]
        });

        // Test page1
        await safeNavigate(page, `${serverUrl}/page1`);
        await assertPageTitle(page, /Page 1/);

        // Test page2
        await safeNavigate(page, `${serverUrl}/page2`);
        await assertPageTitle(page, /Page 2/);

        // Test error handling
        const errorResult = await safeNavigate(page, `${serverUrl}/error`);
        expect(errorResult.success).toBe(false);
      } finally {
        await page.close();
        await browser.close();
      }
    });
  });

  describe('Navigation Scenarios Validation', () => {
    it('should validate navigation scenarios can be executed', async () => {
      const browser = await createBrowserFixture();

      // Get a basic navigation scenario
      const scenarios = Object.values(navigationScenarios);
      expect(scenarios.length).toBeGreaterThan(0);

      const basicScenario = scenarios.find(s => s.name === 'basic-page-navigation');
      expect(basicScenario).toBeDefined();

      if (basicScenario) {
        expect(basicScenario).toHaveProperty('name');
        expect(basicScenario).toHaveProperty('description');
        expect(basicScenario).toHaveProperty('steps');
        expect(basicScenario).toHaveProperty('expectedOutcome');
        expect(Array.isArray(basicScenario.steps)).toBe(true);
      }

      await browser.close();
    });
  });

  describe('End-to-End Navigation Flow Validation', () => {
    it('should validate complete navigation workflow', async () => {
      const browser = await createBrowserFixture();

      await withNavigationPage(browser, async (page) => {
        // Step 1: Navigate to home page
        await safeNavigate(page, serverUrl);
        await assertURL(page, serverUrl);
        await assertElementExists(page, 'nav');

        // Step 2: Navigate to page1 using link click
        await safeNavigationClick(page, 'a[href="/page1"]');
        await assertURL(page, `${serverUrl}/page1`);
        await assertPageTitle(page, /Page 1/);

        // Step 3: Navigate to page2
        await safeNavigationClick(page, 'a[href="/page2"]');
        await assertURL(page, `${serverUrl}/page2`);

        // Step 4: Go back using browser history
        await page.goBack();
        await waitForNavigationComplete(page);
        await assertURL(page, `${serverUrl}/page1`);

        // Step 5: Go forward
        await page.goForward();
        await waitForNavigationComplete(page);
        await assertURL(page, `${serverUrl}/page2`);

        // Step 6: Measure performance
        const metrics = await measureNavigationPerformance(page);
        await assertNavigationPerformance(page, {
          domContentLoaded: { max: 5000 }
        });

        // Step 7: Capture final state
        const snapshot = await captureNavigationSnapshot(page);
        expect(snapshot).toHaveProperty('url');
        expect(snapshot).toHaveProperty('title');
        expect(snapshot).toHaveProperty('timestamp');
      });

      await browser.close();
    });
  });

  describe('TypeScript Integration Validation', () => {
    it('should validate TypeScript types work correctly', async () => {
      const browser = await createBrowserFixture();
      const page = await createPageFixture(browser);

      try {
        // Test that all functions accept correct parameter types
        const navigationResult = await safeNavigate(page, serverUrl, {
          timeout: 10000,
          waitUntil: 'domcontentloaded',
          retries: 2
        });

        const validationResult = await validateNavigation(page, {
          expectedUrl: serverUrl,
          expectedTitle: /Test Server/,
          requiredElements: [
            { selector: 'h1', text: 'Navigation Test Server' }
          ],
          timeout: 5000
        });

        // Verify return types have expected properties
        expect(navigationResult).toHaveProperty('success');
        expect(navigationResult).toHaveProperty('finalUrl');
        expect(validationResult).toHaveProperty('success');

        if (!validationResult.success) {
          expect(validationResult).toHaveProperty('errors');
        }
      } finally {
        await page.close();
        await browser.close();
      }
    });
  });
});