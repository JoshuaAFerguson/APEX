/**
 * @fileoverview Unit tests for browser fixture types and factory functions
 *
 * Tests cover:
 * - Type definitions and interfaces
 * - Browser and page fixture creation
 * - Configuration options and defaults
 * - Cleanup functionality
 * - Error handling
 * - Multi-page scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Browser, BrowserContext, Page } from 'playwright';
import {
  createBrowserFixture,
  createPageFixture,
  withNavigationPage,
  withBrowserContext,
  createMultiPageFixture,
  createSharedContextPages,
  type BrowserType,
  type BrowserFixtureOptions,
  type PageFixtureOptions,
  type BrowserFixture,
  type PageFixture,
} from '../browser-fixtures';

// Mock Playwright modules
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
  firefox: {
    launch: vi.fn(),
  },
  webkit: {
    launch: vi.fn(),
  },
}));

describe('browser-fixtures types', () => {
  describe('BrowserType', () => {
    it('should only allow valid browser types', () => {
      // Type-only tests - these should compile without errors
      const chromium: BrowserType = 'chromium';
      const firefox: BrowserType = 'firefox';
      const webkit: BrowserType = 'webkit';

      expect(chromium).toBe('chromium');
      expect(firefox).toBe('firefox');
      expect(webkit).toBe('webkit');

      // @ts-expect-error - invalid browser type should not be allowed
      // const invalid: BrowserType = 'invalid';
    });
  });

  describe('BrowserFixtureOptions interface', () => {
    it('should have correct optional properties', () => {
      const options: BrowserFixtureOptions = {};
      expect(options).toEqual({});

      const fullOptions: BrowserFixtureOptions = {
        browserType: 'chromium',
        headless: true,
        slowMo: 100,
        devtools: false,
        args: ['--disable-dev-shm-usage'],
      };

      expect(fullOptions.browserType).toBe('chromium');
      expect(fullOptions.headless).toBe(true);
      expect(fullOptions.slowMo).toBe(100);
      expect(fullOptions.devtools).toBe(false);
      expect(fullOptions.args).toEqual(['--disable-dev-shm-usage']);
    });

    it('should allow partial configuration', () => {
      const partialOptions: BrowserFixtureOptions = {
        browserType: 'firefox',
        headless: false,
      };

      expect(partialOptions.browserType).toBe('firefox');
      expect(partialOptions.headless).toBe(false);
      expect(partialOptions.slowMo).toBeUndefined();
      expect(partialOptions.devtools).toBeUndefined();
      expect(partialOptions.args).toBeUndefined();
    });
  });

  describe('PageFixtureOptions interface', () => {
    it('should extend BrowserFixtureOptions', () => {
      const options: PageFixtureOptions = {
        // Browser options
        browserType: 'webkit',
        headless: true,
        // Page options
        viewport: { width: 1920, height: 1080 },
        baseURL: 'http://localhost:3000',
        navigationTimeout: 15000,
        actionTimeout: 5000,
        reducedMotion: 'reduce',
        timezoneId: 'America/New_York',
        locale: 'en-US',
      };

      expect(options.browserType).toBe('webkit');
      expect(options.viewport).toEqual({ width: 1920, height: 1080 });
      expect(options.baseURL).toBe('http://localhost:3000');
      expect(options.navigationTimeout).toBe(15000);
      expect(options.actionTimeout).toBe(5000);
      expect(options.reducedMotion).toBe('reduce');
      expect(options.timezoneId).toBe('America/New_York');
      expect(options.locale).toBe('en-US');
    });

    it('should support video recording options', () => {
      const options: PageFixtureOptions = {
        recordVideo: { dir: './test-videos' },
      };

      expect(options.recordVideo).toEqual({ dir: './test-videos' });
    });
  });

  describe('BrowserFixture interface', () => {
    it('should have required properties', () => {
      const mockBrowser = {
        close: vi.fn(),
        newContext: vi.fn(),
      } as unknown as Browser;

      const fixture: BrowserFixture = {
        browser: mockBrowser,
        cleanup: vi.fn(),
      };

      expect(fixture.browser).toBe(mockBrowser);
      expect(typeof fixture.cleanup).toBe('function');
    });
  });

  describe('PageFixture interface', () => {
    it('should have required properties', () => {
      const mockPage = {
        goto: vi.fn(),
        close: vi.fn(),
        url: vi.fn(),
        setDefaultTimeout: vi.fn(),
        setDefaultNavigationTimeout: vi.fn(),
      } as unknown as Page;

      const mockContext = {
        close: vi.fn(),
        newPage: vi.fn(),
      } as unknown as BrowserContext;

      const mockBrowser = {
        close: vi.fn(),
        newContext: vi.fn(),
      } as unknown as Browser;

      const fixture: PageFixture = {
        page: mockPage,
        context: mockContext,
        browser: mockBrowser,
        cleanup: vi.fn(),
      };

      expect(fixture.page).toBe(mockPage);
      expect(fixture.context).toBe(mockContext);
      expect(fixture.browser).toBe(mockBrowser);
      expect(typeof fixture.cleanup).toBe('function');
    });
  });
});

describe('browser-fixtures factory functions', () => {
  let mockBrowser: Browser;
  let mockContext: BrowserContext;
  let mockPage: Page;

  beforeEach(() => {
    mockPage = {
      goto: vi.fn(),
      close: vi.fn(),
      url: vi.fn().mockReturnValue('about:blank'),
      setDefaultTimeout: vi.fn(),
      setDefaultNavigationTimeout: vi.fn(),
      locator: vi.fn(),
      textContent: vi.fn(),
    } as unknown as Page;

    mockContext = {
      close: vi.fn(),
      newPage: vi.fn().mockResolvedValue(mockPage),
      pages: vi.fn().mockReturnValue([mockPage]),
    } as unknown as BrowserContext;

    mockBrowser = {
      close: vi.fn(),
      newContext: vi.fn().mockResolvedValue(mockContext),
    } as unknown as Browser;

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('createBrowserFixture', () => {
    it('should create a browser fixture with default options', async () => {
      const { chromium } = await import('playwright');
      (chromium.launch as any).mockResolvedValue(mockBrowser);

      const fixture = await createBrowserFixture();

      expect(fixture.browser).toBe(mockBrowser);
      expect(typeof fixture.cleanup).toBe('function');
      expect(chromium.launch).toHaveBeenCalledWith({
        headless: expect.any(Boolean),
        slowMo: expect.any(Number),
        devtools: false,
        args: expect.any(Array),
      });
    });

    it('should create a browser fixture with custom options', async () => {
      const { firefox } = await import('playwright');
      (firefox.launch as any).mockResolvedValue(mockBrowser);

      const options: BrowserFixtureOptions = {
        browserType: 'firefox',
        headless: false,
        slowMo: 200,
        devtools: true,
        args: ['--custom-arg'],
      };

      const fixture = await createBrowserFixture(options);

      expect(fixture.browser).toBe(mockBrowser);
      expect(firefox.launch).toHaveBeenCalledWith({
        headless: false,
        slowMo: 200,
        devtools: true,
        args: ['--custom-arg'],
      });
    });

    it('should handle browser cleanup gracefully', async () => {
      const { chromium } = await import('playwright');
      (chromium.launch as any).mockResolvedValue(mockBrowser);

      const fixture = await createBrowserFixture();
      await fixture.cleanup();

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle cleanup errors silently', async () => {
      const { chromium } = await import('playwright');
      (chromium.launch as any).mockResolvedValue(mockBrowser);
      (mockBrowser.close as any).mockRejectedValue(new Error('Browser already closed'));

      const fixture = await createBrowserFixture();

      // Should not throw
      await expect(fixture.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('createPageFixture', () => {
    it('should create a page fixture with default options', async () => {
      const { chromium } = await import('playwright');
      (chromium.launch as any).mockResolvedValue(mockBrowser);

      const fixture = await createPageFixture();

      expect(fixture.page).toBe(mockPage);
      expect(fixture.context).toBe(mockContext);
      expect(fixture.browser).toBe(mockBrowser);
      expect(typeof fixture.cleanup).toBe('function');

      expect(mockBrowser.newContext).toHaveBeenCalledWith({
        viewport: { width: 1280, height: 720 },
        baseURL: undefined,
        reducedMotion: 'reduce',
        timezoneId: 'UTC',
        locale: 'en-US',
        recordVideo: undefined,
      });

      expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(10000);
      expect(mockPage.setDefaultNavigationTimeout).toHaveBeenCalledWith(30000);
    });

    it('should create a page fixture with custom options', async () => {
      const { webkit } = await import('playwright');
      (webkit.launch as any).mockResolvedValue(mockBrowser);

      const options: PageFixtureOptions = {
        browserType: 'webkit',
        viewport: { width: 1920, height: 1080 },
        baseURL: 'http://localhost:3000',
        navigationTimeout: 15000,
        actionTimeout: 5000,
        recordVideo: { dir: './videos' },
        reducedMotion: 'no-preference',
        timezoneId: 'Europe/London',
        locale: 'en-GB',
      };

      const fixture = await createPageFixture(options);

      expect(webkit.launch).toHaveBeenCalled();
      expect(mockBrowser.newContext).toHaveBeenCalledWith({
        viewport: { width: 1920, height: 1080 },
        baseURL: 'http://localhost:3000',
        reducedMotion: 'no-preference',
        timezoneId: 'Europe/London',
        locale: 'en-GB',
        recordVideo: { dir: './videos' },
      });

      expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(5000);
      expect(mockPage.setDefaultNavigationTimeout).toHaveBeenCalledWith(15000);
    });

    it('should handle cleanup of page, context, and browser', async () => {
      const { chromium } = await import('playwright');
      (chromium.launch as any).mockResolvedValue(mockBrowser);

      const fixture = await createPageFixture();
      await fixture.cleanup();

      expect(mockPage.close).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const { chromium } = await import('playwright');
      (chromium.launch as any).mockResolvedValue(mockBrowser);

      (mockPage.close as any).mockRejectedValue(new Error('Page closed'));
      (mockContext.close as any).mockRejectedValue(new Error('Context closed'));

      const fixture = await createPageFixture();

      // Should not throw
      await expect(fixture.cleanup()).resolves.toBeUndefined();
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('withNavigationPage', () => {
    it('should execute function with page and cleanup automatically', async () => {
      const { chromium } = await import('playwright');
      (chromium.launch as any).mockResolvedValue(mockBrowser);

      const testFn = vi.fn().mockResolvedValue('test-result');

      const result = await withNavigationPage(testFn);

      expect(result).toBe('test-result');
      expect(testFn).toHaveBeenCalledWith(mockPage);
      expect(mockPage.close).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should cleanup even if function throws', async () => {
      const { chromium } = await import('playwright');
      (chromium.launch as any).mockResolvedValue(mockBrowser);

      const testFn = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(withNavigationPage(testFn)).rejects.toThrow('Test error');

      expect(mockPage.close).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should pass options to page fixture creation', async () => {
      const { firefox } = await import('playwright');
      (firefox.launch as any).mockResolvedValue(mockBrowser);

      const testFn = vi.fn().mockResolvedValue('result');
      const options: PageFixtureOptions = {
        browserType: 'firefox',
        viewport: { width: 800, height: 600 },
      };

      await withNavigationPage(testFn, options);

      expect(firefox.launch).toHaveBeenCalled();
      expect(mockBrowser.newContext).toHaveBeenCalledWith(
        expect.objectContaining({
          viewport: { width: 800, height: 600 },
        })
      );
    });
  });

  describe('withBrowserContext', () => {
    it('should execute function with context and browser', async () => {
      const { chromium } = await import('playwright');
      (chromium.launch as any).mockResolvedValue(mockBrowser);

      const testFn = vi.fn().mockResolvedValue('context-result');

      const result = await withBrowserContext(testFn);

      expect(result).toBe('context-result');
      expect(testFn).toHaveBeenCalledWith(mockContext, mockBrowser);
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should cleanup even if function throws', async () => {
      const { chromium } = await import('playwright');
      (chromium.launch as any).mockResolvedValue(mockBrowser);

      const testFn = vi.fn().mockRejectedValue(new Error('Context error'));

      await expect(withBrowserContext(testFn)).rejects.toThrow('Context error');

      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('createMultiPageFixture', () => {
    it('should create multiple isolated page fixtures', async () => {
      const { chromium } = await import('playwright');
      (chromium.launch as any).mockResolvedValue(mockBrowser);

      const fixtures = await createMultiPageFixture(3);

      expect(fixtures).toHaveLength(3);
      expect(chromium.launch).toHaveBeenCalledTimes(3);

      fixtures.forEach(fixture => {
        expect(fixture.page).toBe(mockPage);
        expect(fixture.context).toBe(mockContext);
        expect(fixture.browser).toBe(mockBrowser);
        expect(typeof fixture.cleanup).toBe('function');
      });
    });

    it('should support cleanup of all fixtures', async () => {
      const { chromium } = await import('playwright');
      (chromium.launch as any).mockResolvedValue(mockBrowser);

      const fixtures = await createMultiPageFixture(2);

      await Promise.all(fixtures.map(f => f.cleanup()));

      expect(mockPage.close).toHaveBeenCalledTimes(2);
      expect(mockContext.close).toHaveBeenCalledTimes(2);
      expect(mockBrowser.close).toHaveBeenCalledTimes(2);
    });
  });

  describe('createSharedContextPages', () => {
    it('should create multiple pages in shared context', async () => {
      const { chromium } = await import('playwright');
      (chromium.launch as any).mockResolvedValue(mockBrowser);

      const mockPage2 = {
        close: vi.fn(),
      } as unknown as Page;
      (mockContext.newPage as any).mockResolvedValueOnce(mockPage2);

      const result = await createSharedContextPages(2);

      expect(result.pages).toHaveLength(2);
      expect(result.pages[0]).toBe(mockPage);
      expect(result.pages[1]).toBe(mockPage2);
      expect(result.context).toBe(mockContext);
      expect(result.browser).toBe(mockBrowser);
      expect(typeof result.cleanup).toBe('function');

      expect(mockContext.newPage).toHaveBeenCalledTimes(1); // Only 1 additional page created
    });

    it('should cleanup all pages in shared context', async () => {
      const { chromium } = await import('playwright');
      (chromium.launch as any).mockResolvedValue(mockBrowser);

      const mockPage2 = {
        close: vi.fn(),
      } as unknown as Page;
      (mockContext.newPage as any).mockResolvedValueOnce(mockPage2);

      const result = await createSharedContextPages(2);
      await result.cleanup();

      // Only the additional page should be closed explicitly
      expect(mockPage2.close).toHaveBeenCalled();
      // Original page should be closed via fixture cleanup
      expect(mockPage.close).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle errors during additional page cleanup', async () => {
      const { chromium } = await import('playwright');
      (chromium.launch as any).mockResolvedValue(mockBrowser);

      const mockPage2 = {
        close: vi.fn().mockRejectedValue(new Error('Page close error')),
      } as unknown as Page;
      (mockContext.newPage as any).mockResolvedValueOnce(mockPage2);

      const result = await createSharedContextPages(2);

      // Should not throw
      await expect(result.cleanup()).resolves.toBeUndefined();
    });
  });
});