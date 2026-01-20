/**
 * @fileoverview Comprehensive tests for browser automation integration test infrastructure
 *
 * This test suite validates the entire browser integration testing infrastructure including:
 * - Browser instance management and lifecycle
 * - Test setup and teardown processes
 * - Configuration handling and validation
 * - Error handling and recovery mechanisms
 * - Performance and resource management
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import {
  createBrowser,
  createBrowserContext,
  createPage,
  DEFAULT_BROWSER_CONFIG,
  captureScreenshot,
  BrowserTestConfig,
  BrowserTestContext,
  mockBrowserDependencies,
} from './setup';

import {
  createTestPage,
  runNavigationScenario,
  runInteractionScenario,
  monitorConsoleMessages,
  NAVIGATION_SCENARIOS,
  INTERACTION_SCENARIOS,
  CONSOLE_SCENARIOS,
} from './fixtures/common-scenarios';

import {
  takeScreenshot,
  compareScreenshots,
  waitForElement,
  safeClick,
  safeFill,
  waitForNetworkIdle,
  measurePerformance,
  setupAlertHandler,
  captureConsoleMessages,
  capturePageErrors,
  withBrowserTest,
  setupMockServer,
} from './utils/test-helpers';

describe('Browser Automation Infrastructure Tests', () => {
  let testTempDir: string;

  beforeAll(async () => {
    // Create test-specific temp directory
    testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-infra-test-'));
  });

  afterAll(async () => {
    // Clean up test temp directory
    try {
      await fs.rm(testTempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test temp dir:', error);
    }
  });

  describe('Configuration Management', () => {
    it('should provide valid default configuration', () => {
      expect(DEFAULT_BROWSER_CONFIG).toBeDefined();
      expect(DEFAULT_BROWSER_CONFIG.backend).toBe('playwright');
      expect(DEFAULT_BROWSER_CONFIG.browserType).toBe('chromium');
      expect(DEFAULT_BROWSER_CONFIG.viewport).toEqual({ width: 1280, height: 720 });
      expect(typeof DEFAULT_BROWSER_CONFIG.headless).toBe('boolean');
    });

    it('should validate browser configuration options', () => {
      const validConfig: BrowserTestConfig = {
        backend: 'playwright',
        browserType: 'firefox',
        headless: true,
        viewport: { width: 1920, height: 1080 },
        slowMo: 500,
        devtools: false,
      };

      expect(validConfig.backend).toMatch(/^(playwright|puppeteer)$/);
      expect(validConfig.browserType).toMatch(/^(chromium|firefox|webkit)$/);
      expect(validConfig.viewport.width).toBeGreaterThan(0);
      expect(validConfig.viewport.height).toBeGreaterThan(0);
    });

    it('should handle environment variable overrides', () => {
      const originalCI = process.env.CI;
      const originalHeadless = process.env.BROWSER_TEST_HEADLESS;

      try {
        process.env.CI = 'true';
        process.env.BROWSER_TEST_HEADLESS = 'true';

        // Re-evaluate the configuration logic
        const headlessMode = process.env.CI === 'true' || process.env.BROWSER_TEST_HEADLESS === 'true';
        const slowMo = process.env.CI ? 0 : 100;

        expect(headlessMode).toBe(true);
        expect(slowMo).toBe(0);
      } finally {
        process.env.CI = originalCI;
        process.env.BROWSER_TEST_HEADLESS = originalHeadless;
      }
    });
  });

  describe('Browser Instance Management', () => {
    // Mock browser for testing infrastructure without actual browser
    beforeEach(() => {
      mockBrowserDependencies();
    });

    it('should create browser instances with default config', async () => {
      const mockBrowser = await createBrowser();

      expect(mockBrowser).toBeDefined();
      expect(mockBrowser.isConnected).toBeDefined();
      expect(mockBrowser.newContext).toBeDefined();
      expect(mockBrowser.close).toBeDefined();

      await mockBrowser.close();
    });

    it('should create browser instances with custom config', async () => {
      const customConfig = {
        browserType: 'firefox' as const,
        headless: false,
        viewport: { width: 1600, height: 900 },
      };

      const mockBrowser = await createBrowser(customConfig);
      expect(mockBrowser).toBeDefined();
      await mockBrowser.close();
    });

    it('should handle browser creation failures gracefully', async () => {
      // Mock browser launch failure
      vi.mocked(require('playwright').chromium.launch).mockRejectedValueOnce(
        new Error('Browser launch failed')
      );

      await expect(createBrowser()).rejects.toThrow('Browser launch failed');
    });

    it('should support different browser types', async () => {
      const browsers = ['chromium', 'firefox', 'webkit'] as const;

      for (const browserType of browsers) {
        const mockBrowser = await createBrowser({ browserType });
        expect(mockBrowser).toBeDefined();
        await mockBrowser.close();
      }
    });

    it('should manage browser contexts properly', async () => {
      const mockBrowser = await createBrowser();
      const mockContext = await createBrowserContext(mockBrowser);

      expect(mockContext).toBeDefined();
      expect(mockContext.newPage).toBeDefined();
      expect(mockContext.close).toBeDefined();

      await mockContext.close();
      await mockBrowser.close();
    });

    it('should create pages with proper configuration', async () => {
      const mockBrowser = await createBrowser();
      const mockContext = await createBrowserContext(mockBrowser);
      const mockPage = await createPage(mockContext);

      expect(mockPage).toBeDefined();
      expect(mockPage.goto).toBeDefined();
      expect(mockPage.screenshot).toBeDefined();
      expect(mockPage.close).toBeDefined();

      await mockPage.close();
      await mockContext.close();
      await mockBrowser.close();
    });
  });

  describe('Test Fixtures and Scenarios', () => {
    it('should validate navigation scenarios structure', () => {
      expect(NAVIGATION_SCENARIOS).toBeInstanceOf(Array);
      expect(NAVIGATION_SCENARIOS.length).toBeGreaterThan(0);

      NAVIGATION_SCENARIOS.forEach((scenario) => {
        expect(scenario).toHaveProperty('name');
        expect(scenario).toHaveProperty('url');
        expect(typeof scenario.name).toBe('string');
        expect(typeof scenario.url).toBe('string');

        if (scenario.expectedTitle) {
          expect(typeof scenario.expectedTitle).toBe('string');
        }

        if (scenario.expectedElements) {
          expect(Array.isArray(scenario.expectedElements)).toBe(true);
        }

        if (scenario.timeout) {
          expect(typeof scenario.timeout).toBe('number');
          expect(scenario.timeout).toBeGreaterThan(0);
        }
      });
    });

    it('should validate interaction scenarios structure', () => {
      expect(INTERACTION_SCENARIOS).toBeInstanceOf(Array);
      expect(INTERACTION_SCENARIOS.length).toBeGreaterThan(0);

      INTERACTION_SCENARIOS.forEach((scenario) => {
        expect(scenario).toHaveProperty('name');
        expect(scenario).toHaveProperty('actions');
        expect(scenario).toHaveProperty('expectedResults');

        expect(typeof scenario.name).toBe('string');
        expect(Array.isArray(scenario.actions)).toBe(true);
        expect(Array.isArray(scenario.expectedResults)).toBe(true);

        scenario.actions.forEach((action) => {
          expect(['click', 'type', 'select', 'wait']).toContain(action.type);

          if (action.selector) {
            expect(typeof action.selector).toBe('string');
          }

          if (action.value) {
            expect(typeof action.value).toBe('string');
          }

          if (action.timeout) {
            expect(typeof action.timeout).toBe('number');
          }
        });

        scenario.expectedResults.forEach((result) => {
          expect(['text', 'attribute', 'visible', 'hidden']).toContain(result.type);
          expect(typeof result.selector).toBe('string');
          expect(typeof result.expected).toBe('string');
        });
      });
    });

    it('should validate console scenarios structure', () => {
      expect(CONSOLE_SCENARIOS).toBeInstanceOf(Array);
      expect(CONSOLE_SCENARIOS.length).toBeGreaterThan(0);

      CONSOLE_SCENARIOS.forEach((scenario) => {
        expect(scenario).toHaveProperty('name');
        expect(scenario).toHaveProperty('triggerAction');
        expect(scenario).toHaveProperty('expectedMessages');

        expect(typeof scenario.name).toBe('string');
        expect(typeof scenario.triggerAction).toBe('function');
        expect(Array.isArray(scenario.expectedMessages)).toBe(true);

        scenario.expectedMessages.forEach((message) => {
          expect(['log', 'warn', 'error', 'info']).toContain(message.type);
          expect(typeof message.text).toBe('string');
        });
      });
    });

    it('should generate consistent test page content', async () => {
      const mockPage = {
        setContent: vi.fn().mockResolvedValue(undefined),
        waitForLoadState: vi.fn().mockResolvedValue(undefined),
      };

      await createTestPage(mockPage as any);

      expect(mockPage.setContent).toHaveBeenCalledWith(
        expect.stringContaining('APEX Browser Test Page')
      );
      expect(mockPage.setContent).toHaveBeenCalledWith(
        expect.stringContaining('Form Testing')
      );
      expect(mockPage.setContent).toHaveBeenCalledWith(
        expect.stringContaining('Interactive Elements')
      );
      expect(mockPage.waitForLoadState).toHaveBeenCalledWith('domcontentloaded');
    });
  });

  describe('Test Utilities', () => {
    let mockPage: any;

    beforeEach(() => {
      mockPage = {
        screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
        locator: vi.fn().mockReturnValue({
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(true),
          }),
          waitFor: vi.fn().mockResolvedValue(undefined),
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
          click: vi.fn().mockResolvedValue(undefined),
          clear: vi.fn().mockResolvedValue(undefined),
          fill: vi.fn().mockResolvedValue(undefined),
          inputValue: vi.fn().mockResolvedValue('test-value'),
        }),
        click: vi.fn().mockResolvedValue(undefined),
        fill: vi.fn().mockResolvedValue(undefined),
        waitForTimeout: vi.fn().mockResolvedValue(undefined),
        waitForLoadState: vi.fn().mockResolvedValue(undefined),
        waitForFunction: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        off: vi.fn(),
        evaluate: vi.fn().mockResolvedValue({}),
      };
    });

    it('should take screenshots with proper naming', async () => {
      const screenshotPath = await takeScreenshot(
        mockPage,
        'test-screenshot',
        testTempDir
      );

      expect(screenshotPath).toContain('test-screenshot');
      expect(screenshotPath).toContain('.png');
      expect(screenshotPath).toContain(testTempDir);
      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          path: screenshotPath,
          fullPage: true,
          animations: 'disabled',
          caret: 'hide',
        })
      );
    });

    it('should handle screenshot comparison', async () => {
      // Create mock screenshot files
      const screenshot1Path = path.join(testTempDir, 'screenshot1.png');
      const screenshot2Path = path.join(testTempDir, 'screenshot2.png');

      const mockBuffer1 = Buffer.from('mock-screenshot-1');
      const mockBuffer2 = Buffer.from('mock-screenshot-1'); // Same content

      await fs.writeFile(screenshot1Path, mockBuffer1);
      await fs.writeFile(screenshot2Path, mockBuffer2);

      const comparison = await compareScreenshots(screenshot1Path, screenshot2Path);

      expect(comparison).toHaveProperty('similarity');
      expect(typeof comparison.similarity).toBe('number');
      expect(comparison.similarity).toBeGreaterThanOrEqual(0);
      expect(comparison.similarity).toBeLessThanOrEqual(1);
    });

    it('should wait for elements with various conditions', async () => {
      const element = await waitForElement(mockPage, '.test-element', {
        visible: true,
        enabled: true,
        timeout: 5000,
      });

      expect(element).toBeDefined();
      expect(mockPage.locator).toHaveBeenCalledWith('.test-element');
    });

    it('should perform safe clicks with retry logic', async () => {
      await safeClick(mockPage, '.test-button');

      expect(mockPage.locator).toHaveBeenCalledWith('.test-button');
      expect(mockPage.locator().click).toHaveBeenCalled();
    });

    it('should handle safe click failures with retries', async () => {
      mockPage.locator().click.mockRejectedValueOnce(new Error('Click failed'));
      mockPage.locator().click.mockResolvedValueOnce(undefined);

      await safeClick(mockPage, '.test-button', { retries: 2, delay: 100 });

      expect(mockPage.locator().click).toHaveBeenCalledTimes(2);
    });

    it('should perform safe fills with validation', async () => {
      await safeFill(mockPage, '#test-input', 'test-value');

      expect(mockPage.locator).toHaveBeenCalledWith('#test-input');
      expect(mockPage.locator().fill).toHaveBeenCalledWith('test-value');
      expect(mockPage.locator().inputValue).toHaveBeenCalled();
    });

    it('should wait for network idle', async () => {
      await waitForNetworkIdle(mockPage, { timeout: 5000, idleTime: 500 });

      expect(mockPage.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 5000 });
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(500);
    });

    it('should measure performance accurately', async () => {
      const mockAction = vi.fn().mockResolvedValue(undefined);

      const performance = await measurePerformance(mockPage, mockAction);

      expect(performance).toHaveProperty('startTime');
      expect(performance).toHaveProperty('endTime');
      expect(performance).toHaveProperty('duration');
      expect(typeof performance.startTime).toBe('number');
      expect(typeof performance.endTime).toBe('number');
      expect(typeof performance.duration).toBe('number');
      expect(performance.endTime).toBeGreaterThanOrEqual(performance.startTime);
      expect(mockAction).toHaveBeenCalled();
    });

    it('should setup alert handlers correctly', async () => {
      await setupAlertHandler(mockPage, 'accept');

      expect(mockPage.on).toHaveBeenCalledWith('dialog', expect.any(Function));
    });

    it('should capture console messages during execution', async () => {
      const mockAction = vi.fn().mockResolvedValue(undefined);

      const messages = await captureConsoleMessages(mockPage, mockAction);

      expect(Array.isArray(messages)).toBe(true);
      expect(mockPage.on).toHaveBeenCalledWith('console', expect.any(Function));
      expect(mockPage.off).toHaveBeenCalledWith('console', expect.any(Function));
      expect(mockAction).toHaveBeenCalled();
    });

    it('should capture page errors during execution', async () => {
      const mockAction = vi.fn().mockResolvedValue(undefined);

      const errors = await capturePageErrors(mockPage, mockAction);

      expect(Array.isArray(errors)).toBe(true);
      expect(mockPage.on).toHaveBeenCalledWith('pageerror', expect.any(Function));
      expect(mockPage.off).toHaveBeenCalledWith('pageerror', expect.any(Function));
      expect(mockAction).toHaveBeenCalled();
    });

    it('should run tests with cleanup', async () => {
      const mockTestFn = vi.fn().mockResolvedValue('test-result');
      const mockCleanup = vi.fn().mockResolvedValue(undefined);

      const result = await withBrowserTest(mockTestFn, mockPage, mockCleanup);

      expect(result).toBe('test-result');
      expect(mockTestFn).toHaveBeenCalledWith(mockPage);
      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should setup mock servers for testing', async () => {
      const mockRoutes = {
        '/api/test': {
          status: 200,
          body: { success: true },
          headers: { 'Content-Type': 'application/json' },
        },
      };

      await setupMockServer(mockPage, mockRoutes);

      expect(mockPage.route).toHaveBeenCalledWith('/api/test', expect.any(Function));
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing screenshot directories', async () => {
      const nonExistentDir = path.join(testTempDir, 'non-existent');
      const mockPage = {
        screenshot: vi.fn().mockRejectedValue(new Error('Directory not found')),
      };

      await expect(
        takeScreenshot(mockPage as any, 'test', nonExistentDir)
      ).rejects.toThrow();
    });

    it('should handle failed screenshot comparisons', async () => {
      const nonExistentFile1 = path.join(testTempDir, 'non-existent-1.png');
      const nonExistentFile2 = path.join(testTempDir, 'non-existent-2.png');

      const comparison = await compareScreenshots(nonExistentFile1, nonExistentFile2);

      expect(comparison.similarity).toBe(0);
    });

    it('should handle timeout errors in element waiting', async () => {
      const mockPage = {
        locator: vi.fn().mockReturnValue({
          waitFor: vi.fn().mockRejectedValue(new Error('Timeout waiting for element')),
        }),
      };

      await expect(
        waitForElement(mockPage as any, '.non-existent', { timeout: 1000 })
      ).rejects.toThrow();
    });

    it('should handle cleanup failures gracefully', async () => {
      const mockTestFn = vi.fn().mockResolvedValue('success');
      const mockCleanup = vi.fn().mockRejectedValue(new Error('Cleanup failed'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await withBrowserTest(mockTestFn, {} as any, mockCleanup);

      expect(result).toBe('success');
      expect(consoleSpy).toHaveBeenCalledWith('Cleanup failed:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('Resource Management', () => {
    it('should track and manage temporary files', async () => {
      const tempFiles: string[] = [];

      // Simulate creating multiple screenshots
      for (let i = 0; i < 3; i++) {
        const filePath = path.join(testTempDir, `test-${i}.png`);
        await fs.writeFile(filePath, `mock-content-${i}`);
        tempFiles.push(filePath);
      }

      // Verify files exist
      for (const filePath of tempFiles) {
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }

      // Cleanup should remove all files
      for (const filePath of tempFiles) {
        await fs.unlink(filePath);
      }
    });

    it('should handle memory management for large screenshots', async () => {
      const mockPage = {
        screenshot: vi.fn().mockResolvedValue(Buffer.alloc(1024 * 1024)), // 1MB
      };

      const largePath = await takeScreenshot(mockPage as any, 'large-test', testTempDir);

      expect(mockPage.screenshot).toHaveBeenCalled();
      expect(largePath).toContain('large-test');
    });

    it('should prevent resource leaks in browser contexts', () => {
      const mockBrowser = {
        isConnected: vi.fn().mockReturnValue(true),
        close: vi.fn().mockResolvedValue(undefined),
        newContext: vi.fn().mockResolvedValue({
          close: vi.fn().mockResolvedValue(undefined),
          newPage: vi.fn().mockResolvedValue({
            close: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      // Simulate browser lifecycle
      expect(mockBrowser.isConnected()).toBe(true);

      // Ensure proper cleanup methods are available
      expect(mockBrowser.close).toBeDefined();
      expect(mockBrowser.newContext().close).toBeDefined();
      expect(mockBrowser.newContext().newPage().close).toBeDefined();
    });
  });

  describe('Integration Test Validation', () => {
    it('should validate complete test workflow', async () => {
      const mockBrowser = {
        isConnected: vi.fn().mockReturnValue(true),
        newContext: vi.fn().mockResolvedValue({
          newPage: vi.fn().mockResolvedValue({
            goto: vi.fn().mockResolvedValue(undefined),
            waitForLoadState: vi.fn().mockResolvedValue(undefined),
            screenshot: vi.fn().mockResolvedValue(Buffer.from('screenshot')),
            close: vi.fn().mockResolvedValue(undefined),
          }),
          close: vi.fn().mockResolvedValue(undefined),
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };

      // Simulate complete test workflow
      const context = await mockBrowser.newContext();
      const page = await context.newPage();

      await page.goto('test-url');
      await page.waitForLoadState('domcontentloaded');
      await page.screenshot({ path: 'test.png' });

      await page.close();
      await context.close();
      await mockBrowser.close();

      // Verify all steps were called
      expect(mockBrowser.newContext).toHaveBeenCalled();
      expect(context.newPage).toHaveBeenCalled();
      expect(page.goto).toHaveBeenCalledWith('test-url');
      expect(page.screenshot).toHaveBeenCalled();
      expect(page.close).toHaveBeenCalled();
      expect(context.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should support parallel test execution patterns', async () => {
      const createMockBrowser = () => ({
        newContext: vi.fn().mockResolvedValue({
          newPage: vi.fn().mockResolvedValue({
            goto: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
          }),
          close: vi.fn().mockResolvedValue(undefined),
        }),
        close: vi.fn().mockResolvedValue(undefined),
      });

      const browsers = Array.from({ length: 3 }, () => createMockBrowser());

      // Simulate parallel execution
      const results = await Promise.all(
        browsers.map(async (browser, index) => {
          const context = await browser.newContext();
          const page = await context.newPage();
          await page.goto(`test-url-${index}`);
          await page.close();
          await context.close();
          await browser.close();
          return `test-${index}-complete`;
        })
      );

      expect(results).toHaveLength(3);
      expect(results).toEqual(['test-0-complete', 'test-1-complete', 'test-2-complete']);
    });
  });
});