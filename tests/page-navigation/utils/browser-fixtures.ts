/**
 * @fileoverview Browser fixture factories for APEX navigation testing
 *
 * This module provides factory functions for creating isolated browser contexts
 * and pages for navigation testing. All fixtures include automatic cleanup.
 *
 * Key Features:
 * - Isolated browser contexts for test isolation
 * - Automatic resource cleanup on test completion
 * - Configurable viewport, timeout, and navigation settings
 * - Helper function for scoped page operations
 *
 * @example
 * ```typescript
 * import { createPageFixture, withNavigationPage } from './browser-fixtures';
 *
 * // Using fixture directly
 * describe('Navigation Tests', () => {
 *   let fixture: PageFixture;
 *
 *   beforeEach(async () => {
 *     fixture = await createPageFixture({ baseURL: 'http://localhost:3000' });
 *   });
 *
 *   afterEach(async () => {
 *     await fixture.cleanup();
 *   });
 *
 *   it('should navigate', async () => {
 *     await fixture.page.goto('/');
 *   });
 * });
 *
 * // Using scoped helper
 * it('should navigate', async () => {
 *   await withNavigationPage(async (page) => {
 *     await page.goto('/');
 *     expect(page.url()).toContain('/');
 *   });
 * });
 * ```
 */

import { Browser, BrowserContext, Page, chromium, firefox, webkit } from 'playwright';

/**
 * Browser type options for fixture creation
 */
export type BrowserType = 'chromium' | 'firefox' | 'webkit';

/**
 * Options for creating a browser fixture
 */
export interface BrowserFixtureOptions {
  /** Browser type to launch (default: 'chromium') */
  browserType?: BrowserType;
  /** Run in headless mode (default: true in CI, false otherwise) */
  headless?: boolean;
  /** Slow down operations by this amount in ms (useful for debugging) */
  slowMo?: number;
  /** Open DevTools in non-headless mode */
  devtools?: boolean;
  /** Additional browser launch arguments */
  args?: string[];
}

/**
 * Options for creating a page fixture
 */
export interface PageFixtureOptions extends BrowserFixtureOptions {
  /** Viewport dimensions */
  viewport?: { width: number; height: number };
  /** Base URL for navigation (prepended to relative URLs) */
  baseURL?: string;
  /** Default navigation timeout in ms */
  navigationTimeout?: number;
  /** Default timeout for actions in ms */
  actionTimeout?: number;
  /** Record video of the test */
  recordVideo?: { dir: string };
  /** Reduce motion for animations */
  reducedMotion?: 'reduce' | 'no-preference';
  /** Timezone ID for the browser context */
  timezoneId?: string;
  /** Locale for the browser context */
  locale?: string;
}

/**
 * Browser fixture with cleanup function
 */
export interface BrowserFixture {
  /** The browser instance */
  browser: Browser;
  /** Cleanup function to close the browser */
  cleanup: () => Promise<void>;
}

/**
 * Page fixture with full browser context and cleanup function
 */
export interface PageFixture {
  /** The page instance for interactions */
  page: Page;
  /** The browser context */
  context: BrowserContext;
  /** The browser instance */
  browser: Browser;
  /** Cleanup function to close all resources */
  cleanup: () => Promise<void>;
}

/**
 * Default options for browser fixtures
 */
const DEFAULT_BROWSER_OPTIONS: Required<BrowserFixtureOptions> = {
  browserType: 'chromium',
  headless: process.env.CI === 'true' || process.env.BROWSER_TEST_HEADLESS === 'true',
  slowMo: process.env.CI ? 0 : 50,
  devtools: false,
  args: [
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
};

/**
 * Default options for page fixtures
 */
const DEFAULT_PAGE_OPTIONS: Required<Omit<PageFixtureOptions, keyof BrowserFixtureOptions>> = {
  viewport: { width: 1280, height: 720 },
  baseURL: '',
  navigationTimeout: 30000,
  actionTimeout: 10000,
  recordVideo: undefined as unknown as { dir: string },
  reducedMotion: 'reduce',
  timezoneId: 'UTC',
  locale: 'en-US',
};

/**
 * Gets the browser launcher for the specified browser type
 */
function getBrowserLauncher(browserType: BrowserType) {
  switch (browserType) {
    case 'firefox':
      return firefox;
    case 'webkit':
      return webkit;
    case 'chromium':
    default:
      return chromium;
  }
}

/**
 * Creates a browser fixture with automatic cleanup
 *
 * @param options - Browser configuration options
 * @returns Browser fixture with cleanup function
 *
 * @example
 * ```typescript
 * const { browser, cleanup } = await createBrowserFixture();
 * try {
 *   const context = await browser.newContext();
 *   // ... run tests
 * } finally {
 *   await cleanup();
 * }
 * ```
 */
export async function createBrowserFixture(
  options: BrowserFixtureOptions = {}
): Promise<BrowserFixture> {
  const opts = { ...DEFAULT_BROWSER_OPTIONS, ...options };

  const launcher = getBrowserLauncher(opts.browserType);
  const browser = await launcher.launch({
    headless: opts.headless,
    slowMo: opts.slowMo,
    devtools: opts.devtools,
    args: opts.args,
  });

  const cleanup = async () => {
    try {
      await browser.close();
    } catch {
      // Ignore cleanup errors - browser may already be closed
    }
  };

  return { browser, cleanup };
}

/**
 * Creates a page fixture with isolated browser context and automatic cleanup
 *
 * @param options - Page and browser configuration options
 * @returns Page fixture with page, context, browser, and cleanup function
 *
 * @example
 * ```typescript
 * const fixture = await createPageFixture({
 *   viewport: { width: 1920, height: 1080 },
 *   baseURL: 'http://localhost:3000',
 * });
 *
 * try {
 *   await fixture.page.goto('/dashboard');
 *   expect(fixture.page.url()).toContain('/dashboard');
 * } finally {
 *   await fixture.cleanup();
 * }
 * ```
 */
export async function createPageFixture(
  options: PageFixtureOptions = {}
): Promise<PageFixture> {
  const browserOpts: BrowserFixtureOptions = {
    browserType: options.browserType,
    headless: options.headless,
    slowMo: options.slowMo,
    devtools: options.devtools,
    args: options.args,
  };

  const pageOpts = {
    ...DEFAULT_PAGE_OPTIONS,
    viewport: options.viewport ?? DEFAULT_PAGE_OPTIONS.viewport,
    baseURL: options.baseURL ?? DEFAULT_PAGE_OPTIONS.baseURL,
    navigationTimeout: options.navigationTimeout ?? DEFAULT_PAGE_OPTIONS.navigationTimeout,
    actionTimeout: options.actionTimeout ?? DEFAULT_PAGE_OPTIONS.actionTimeout,
    recordVideo: options.recordVideo,
    reducedMotion: options.reducedMotion ?? DEFAULT_PAGE_OPTIONS.reducedMotion,
    timezoneId: options.timezoneId ?? DEFAULT_PAGE_OPTIONS.timezoneId,
    locale: options.locale ?? DEFAULT_PAGE_OPTIONS.locale,
  };

  const { browser, cleanup: browserCleanup } = await createBrowserFixture(browserOpts);

  const context = await browser.newContext({
    viewport: pageOpts.viewport,
    baseURL: pageOpts.baseURL || undefined,
    reducedMotion: pageOpts.reducedMotion,
    timezoneId: pageOpts.timezoneId,
    locale: pageOpts.locale,
    recordVideo: pageOpts.recordVideo,
  });

  const page = await context.newPage();

  // Set default timeouts
  page.setDefaultTimeout(pageOpts.actionTimeout);
  page.setDefaultNavigationTimeout(pageOpts.navigationTimeout);

  const cleanup = async () => {
    try {
      await page.close();
    } catch {
      // Ignore - page may already be closed
    }
    try {
      await context.close();
    } catch {
      // Ignore - context may already be closed
    }
    await browserCleanup();
  };

  return { page, context, browser, cleanup };
}

/**
 * Executes a function with a fresh page, handling setup and cleanup automatically
 *
 * This is useful for one-off tests or when you don't need to access the fixture
 * between setup and teardown.
 *
 * @param fn - Function to execute with the page
 * @param options - Page and browser configuration options
 * @returns The result of the function
 *
 * @example
 * ```typescript
 * const result = await withNavigationPage(async (page) => {
 *   await page.goto('/');
 *   return await page.title();
 * });
 *
 * expect(result).toBe('Home Page');
 * ```
 */
export async function withNavigationPage<T>(
  fn: (page: Page) => Promise<T>,
  options: PageFixtureOptions = {}
): Promise<T> {
  const fixture = await createPageFixture(options);

  try {
    return await fn(fixture.page);
  } finally {
    await fixture.cleanup();
  }
}

/**
 * Executes a function with a fresh browser context, handling setup and cleanup
 *
 * @param fn - Function to execute with the context and browser
 * @param options - Browser configuration options
 * @returns The result of the function
 *
 * @example
 * ```typescript
 * const pageCount = await withBrowserContext(async (context) => {
 *   const page1 = await context.newPage();
 *   const page2 = await context.newPage();
 *   await page1.goto('/page1');
 *   await page2.goto('/page2');
 *   return context.pages().length;
 * });
 *
 * expect(pageCount).toBe(2);
 * ```
 */
export async function withBrowserContext<T>(
  fn: (context: BrowserContext, browser: Browser) => Promise<T>,
  options: BrowserFixtureOptions = {}
): Promise<T> {
  const { browser, cleanup } = await createBrowserFixture(options);

  try {
    const context = await browser.newContext();
    try {
      return await fn(context, browser);
    } finally {
      await context.close();
    }
  } finally {
    await cleanup();
  }
}

/**
 * Creates multiple page fixtures for parallel testing or multi-page scenarios
 *
 * @param count - Number of pages to create
 * @param options - Page configuration options (applied to all pages)
 * @returns Array of page fixtures
 *
 * @example
 * ```typescript
 * const fixtures = await createMultiPageFixture(3);
 *
 * try {
 *   await Promise.all([
 *     fixtures[0].page.goto('/page1'),
 *     fixtures[1].page.goto('/page2'),
 *     fixtures[2].page.goto('/page3'),
 *   ]);
 * } finally {
 *   await Promise.all(fixtures.map(f => f.cleanup()));
 * }
 * ```
 */
export async function createMultiPageFixture(
  count: number,
  options: PageFixtureOptions = {}
): Promise<PageFixture[]> {
  const fixtures: PageFixture[] = [];

  for (let i = 0; i < count; i++) {
    fixtures.push(await createPageFixture(options));
  }

  return fixtures;
}

/**
 * Creates multiple pages within a single browser context for isolation testing
 *
 * @param count - Number of pages to create
 * @param options - Page configuration options
 * @returns Object with pages array, shared context/browser, and cleanup
 *
 * @example
 * ```typescript
 * const { pages, cleanup } = await createSharedContextPages(2);
 *
 * try {
 *   // Pages share cookies and storage
 *   await pages[0].goto('/login');
 *   await pages[0].fill('#email', 'user@test.com');
 *   await pages[0].click('#submit');
 *
 *   // Second page has the session too
 *   await pages[1].goto('/dashboard');
 *   expect(pages[1].url()).toContain('/dashboard');
 * } finally {
 *   await cleanup();
 * }
 * ```
 */
export async function createSharedContextPages(
  count: number,
  options: PageFixtureOptions = {}
): Promise<{
  pages: Page[];
  context: BrowserContext;
  browser: Browser;
  cleanup: () => Promise<void>;
}> {
  const fixture = await createPageFixture(options);
  const pages: Page[] = [fixture.page];

  // Create additional pages in the same context
  for (let i = 1; i < count; i++) {
    pages.push(await fixture.context.newPage());
  }

  const cleanup = async () => {
    // Close all pages first
    await Promise.all(
      pages.slice(1).map(async (p) => {
        try {
          await p.close();
        } catch {
          // Ignore
        }
      })
    );
    await fixture.cleanup();
  };

  return {
    pages,
    context: fixture.context,
    browser: fixture.browser,
    cleanup,
  };
}

// Export types
export type {
  BrowserType,
  BrowserFixtureOptions,
  PageFixtureOptions,
  BrowserFixture,
  PageFixture,
};
