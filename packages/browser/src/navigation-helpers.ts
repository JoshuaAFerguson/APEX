/**
 * @apexcli/browser - Navigation Helper Functions
 *
 * Standalone navigation utilities for browser automation testing.
 * These helpers provide a higher-level interface for common navigation operations
 * with consistent error handling, timeout options, and type safety.
 */

import type { Page, Browser, BrowserContext } from 'playwright';
import type {
  BrowserActionResult,
  NavigationOptions,
  WaitForNavigationOptions,
  ElementSelector,
} from './types.js';

/**
 * Options for URL assertion helper
 */
export interface AssertURLOptions {
  /** Timeout for assertion in milliseconds */
  timeout?: number;
  /** Whether to match only the pathname */
  pathname?: boolean;
  /** Whether to ignore query parameters */
  ignoreQuery?: boolean;
  /** Whether to ignore hash fragment */
  ignoreHash?: boolean;
}

/**
 * Options for page content assertion helper
 */
export interface AssertPageContentOptions {
  /** Timeout for finding content in milliseconds */
  timeout?: number;
  /** Element selector to search within (optional) */
  selector?: string | ElementSelector;
  /** Whether to match case-insensitive */
  ignoreCase?: boolean;
  /** Whether to match whole words only */
  wholeWord?: boolean;
}

/**
 * Result of a navigation helper operation
 */
export interface NavigationHelperResult<T = void> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Duration of the operation in milliseconds */
  duration: number;
  /** Final URL after the operation */
  finalUrl?: string;
}

/**
 * Navigate to a URL with enhanced error handling and options
 *
 * A standalone navigation helper that provides consistent navigation behavior
 * with comprehensive error reporting and timeout handling.
 *
 * @param page - Playwright page instance
 * @param url - Target URL to navigate to
 * @param options - Navigation options (timeout, waitUntil, referer)
 * @returns Promise resolving to navigation result with final URL
 *
 * @throws Will return error result if page is not provided
 * @throws Will return error result if navigation fails or times out
 *
 * @example
 * ```typescript
 * import { goto } from '@apexcli/browser/navigation-helpers';
 *
 * const result = await goto(page, 'https://example.com', {
 *   timeout: 30000,
 *   waitUntil: 'networkidle'
 * });
 *
 * if (result.success) {
 *   console.log(`Navigated to: ${result.finalUrl}`);
 * } else {
 *   console.error(`Navigation failed: ${result.error}`);
 * }
 * ```
 */
export async function goto(
  page: Page,
  url: string,
  options: NavigationOptions = {}
): Promise<NavigationHelperResult<string>> {
  const startTime = Date.now();

  if (!page) {
    return {
      success: false,
      error: 'Page instance is required for navigation',
      duration: Date.now() - startTime,
    };
  }

  try {
    const navigationOptions = {
      timeout: options.timeout || 30000,
      waitUntil: options.waitUntil || 'load',
      referer: options.referer,
    };

    const response = await page.goto(url, navigationOptions as any);

    if (!response) {
      return {
        success: false,
        error: 'Navigation response was null - the URL may be invalid or unreachable',
        duration: Date.now() - startTime,
        finalUrl: page.url(),
      };
    }

    if (!response.ok()) {
      return {
        success: false,
        error: `Navigation failed with HTTP status: ${response.status()} ${response.statusText()}`,
        duration: Date.now() - startTime,
        finalUrl: page.url(),
      };
    }

    const finalUrl = page.url();
    return {
      success: true,
      data: finalUrl,
      duration: Date.now() - startTime,
      finalUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
      finalUrl: page.url(),
    };
  }
}

/**
 * Wait for navigation to complete with enhanced timeout and URL matching
 *
 * Waits for the page to reach the specified load state, optionally waiting
 * for a specific URL pattern to be reached.
 *
 * @param page - Playwright page instance
 * @param options - Wait options (timeout, waitUntil, url pattern)
 * @returns Promise resolving to navigation result with final URL
 *
 * @throws Will return error result if page is not provided
 * @throws Will return error result if navigation times out or fails
 *
 * @example
 * ```typescript
 * import { waitForNavigation } from '@apexcli/browser/navigation-helpers';
 *
 * // Wait for any navigation to complete
 * const result = await waitForNavigation(page, {
 *   timeout: 10000,
 *   waitUntil: 'networkidle'
 * });
 *
 * // Wait for specific URL pattern
 * const result2 = await waitForNavigation(page, {
 *   url: /\/dashboard/,
 *   timeout: 15000
 * });
 * ```
 */
export async function waitForNavigation(
  page: Page,
  options: WaitForNavigationOptions = {}
): Promise<NavigationHelperResult<string>> {
  const startTime = Date.now();

  if (!page) {
    return {
      success: false,
      error: 'Page instance is required for navigation waiting',
      duration: Date.now() - startTime,
    };
  }

  try {
    const timeout = options.timeout || 30000;
    const waitUntil = options.waitUntil || 'load';

    if (options.url) {
      // Wait for specific URL pattern
      await page.waitForURL(options.url, {
        timeout,
        waitUntil: waitUntil as any,
      });
    } else {
      // Wait for load state
      await page.waitForLoadState(waitUntil as any, { timeout });
    }

    const finalUrl = page.url();
    return {
      success: true,
      data: finalUrl,
      duration: Date.now() - startTime,
      finalUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
      finalUrl: page.url(),
    };
  }
}

/**
 * Assert that the current URL matches the expected pattern
 *
 * Validates the current page URL against an expected string or regex pattern,
 * with options to control which parts of the URL to compare.
 *
 * @param page - Playwright page instance
 * @param expectedUrl - Expected URL string or regex pattern
 * @param options - Assertion options (timeout, pathname only, ignore query/hash)
 * @returns Promise resolving to assertion result
 *
 * @throws Will return error result if page is not provided
 * @throws Will return error result if URL doesn't match expected pattern
 *
 * @example
 * ```typescript
 * import { assertURL } from '@apexcli/browser/navigation-helpers';
 *
 * // Assert exact URL match
 * await assertURL(page, 'https://example.com/dashboard');
 *
 * // Assert pathname only
 * await assertURL(page, '/dashboard', { pathname: true });
 *
 * // Assert with regex
 * await assertURL(page, /\/users\/\d+/);
 *
 * // Ignore query parameters
 * await assertURL(page, 'https://example.com/search', {
 *   ignoreQuery: true
 * });
 * ```
 */
export async function assertURL(
  page: Page,
  expectedUrl: string | RegExp,
  options: AssertURLOptions = {}
): Promise<NavigationHelperResult<string>> {
  const startTime = Date.now();

  if (!page) {
    return {
      success: false,
      error: 'Page instance is required for URL assertion',
      duration: Date.now() - startTime,
    };
  }

  try {
    const currentUrl = page.url();
    const url = new URL(currentUrl);

    let targetUrl: string;
    if (options.pathname) {
      targetUrl = url.pathname;
    } else if (options.ignoreQuery && options.ignoreHash) {
      targetUrl = `${url.protocol}//${url.host}${url.pathname}`;
    } else if (options.ignoreQuery) {
      targetUrl = `${url.protocol}//${url.host}${url.pathname}${url.hash}`;
    } else if (options.ignoreHash) {
      targetUrl = `${url.protocol}//${url.host}${url.pathname}${url.search}`;
    } else {
      targetUrl = currentUrl;
    }

    const matches = typeof expectedUrl === 'string'
      ? targetUrl === expectedUrl
      : expectedUrl.test(targetUrl);

    if (!matches) {
      const expectedStr = typeof expectedUrl === 'string'
        ? `"${expectedUrl}"`
        : `pattern ${expectedUrl}`;
      return {
        success: false,
        error: `Expected URL to match ${expectedStr}, but got "${targetUrl}"`,
        duration: Date.now() - startTime,
        finalUrl: currentUrl,
      };
    }

    return {
      success: true,
      data: targetUrl,
      duration: Date.now() - startTime,
      finalUrl: currentUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
      finalUrl: page.url(),
    };
  }
}

/**
 * Assert that the page contains the expected content
 *
 * Searches for text content on the page, optionally within a specific element,
 * with support for case-insensitive matching and whole-word matching.
 *
 * @param page - Playwright page instance
 * @param expectedContent - Text content to search for (string or regex)
 * @param options - Assertion options (timeout, selector scope, case sensitivity)
 * @returns Promise resolving to assertion result
 *
 * @throws Will return error result if page is not provided
 * @throws Will return error result if content is not found within timeout
 *
 * @example
 * ```typescript
 * import { assertPageContent } from '@apexcli/browser/navigation-helpers';
 *
 * // Assert page contains text
 * await assertPageContent(page, 'Welcome to our site');
 *
 * // Case-insensitive search
 * await assertPageContent(page, 'WELCOME', { ignoreCase: true });
 *
 * // Search within specific element
 * await assertPageContent(page, 'Error message', {
 *   selector: '.error-container'
 * });
 *
 * // Regex pattern matching
 * await assertPageContent(page, /User \d+ logged in/);
 *
 * // Whole word matching
 * await assertPageContent(page, 'cat', { wholeWord: true });
 * ```
 */
export async function assertPageContent(
  page: Page,
  expectedContent: string | RegExp,
  options: AssertPageContentOptions = {}
): Promise<NavigationHelperResult<string>> {
  const startTime = Date.now();

  if (!page) {
    return {
      success: false,
      error: 'Page instance is required for content assertion',
      duration: Date.now() - startTime,
    };
  }

  try {
    const timeout = options.timeout || 10000;
    let searchScope = page;
    let scopeDescription = 'page';

    // If selector is provided, search within that element
    if (options.selector) {
      const selectorStr = normalizeSelector(options.selector);
      searchScope = page.locator(selectorStr) as any;
      scopeDescription = `element "${selectorStr}"`;
    }

    // Get text content from search scope
    const textContent = await (searchScope as any).textContent({ timeout });

    if (!textContent) {
      return {
        success: false,
        error: `No text content found in ${scopeDescription}`,
        duration: Date.now() - startTime,
        finalUrl: page.url(),
      };
    }

    let matches = false;
    let processedContent = textContent;
    let processedExpected = expectedContent;

    if (typeof expectedContent === 'string') {
      // Handle case sensitivity
      if (options.ignoreCase) {
        processedContent = textContent.toLowerCase();
        processedExpected = expectedContent.toLowerCase();
      }

      // Handle whole word matching
      if (options.wholeWord) {
        const wordRegex = new RegExp(`\\b${escapeRegex(processedExpected as string)}\\b`,
          options.ignoreCase ? 'i' : '');
        matches = wordRegex.test(processedContent);
      } else {
        matches = processedContent.includes(processedExpected as string);
      }
    } else {
      // Regex matching
      matches = expectedContent.test(processedContent);
    }

    if (!matches) {
      const expectedStr = typeof expectedContent === 'string'
        ? `"${expectedContent}"`
        : `pattern ${expectedContent}`;
      return {
        success: false,
        error: `Expected ${scopeDescription} to contain ${expectedStr}, but it was not found`,
        duration: Date.now() - startTime,
        finalUrl: page.url(),
      };
    }

    return {
      success: true,
      data: textContent,
      duration: Date.now() - startTime,
      finalUrl: page.url(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
      finalUrl: page.url(),
    };
  }
}

/**
 * Helper function to normalize selector format
 */
function normalizeSelector(selector: string | ElementSelector): string {
  if (typeof selector === 'string') {
    return selector;
  }

  switch (selector.type) {
    case 'css':
      return selector.value;
    case 'xpath':
      return `xpath=${selector.value}`;
    case 'text':
      return `text=${selector.value}`;
    case 'role':
      return `role=${selector.value}`;
    case 'testId':
      return `[data-testid="${selector.value}"]`;
    default:
      return selector.value;
  }
}

/**
 * Helper function to escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}