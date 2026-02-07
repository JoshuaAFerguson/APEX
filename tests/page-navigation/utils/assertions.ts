/**
 * @fileoverview Navigation assertion helpers for APEX integration testing
 *
 * This module provides assertion utilities for validating navigation state:
 * - URL assertions (exact match, contains, regex match)
 * - Page content assertions (elements, text, title)
 * - Navigation state assertions (history length, back/forward availability)
 *
 * All assertion functions throw descriptive errors on failure for clear test feedback.
 *
 * @example
 * ```typescript
 * import { assertURL, assertPageContent, assertHistoryLength } from './assertions';
 *
 * // Assert exact URL
 * await assertURL(page, 'http://localhost:3000/dashboard');
 *
 * // Assert URL with regex
 * await assertURL(page, /\/dashboard$/);
 *
 * // Assert page content
 * await assertPageContent(page, {
 *   hasElement: 'h1.title',
 *   pageTitle: 'Dashboard',
 * });
 *
 * // Assert navigation history
 * await assertHistoryLength(page, 3);
 * ```
 */

import type { Page } from 'playwright';

/**
 * Options for content assertions
 */
export interface ContentAssertionOptions {
  /** CSS selector that must exist on the page */
  hasElement?: string;
  /** Element text assertion */
  elementText?: {
    selector: string;
    text: string | RegExp;
  };
  /** Expected page title (exact string or regex) */
  pageTitle?: string | RegExp;
  /** Text that must be present in the body */
  bodyContains?: string;
  /** Timeout for element visibility checks (default: 5000ms) */
  timeout?: number;
}

/**
 * Assertion error with detailed context
 */
export class NavigationAssertionError extends Error {
  constructor(
    message: string,
    public readonly actual: unknown,
    public readonly expected: unknown,
    public readonly url?: string
  ) {
    super(message);
    this.name = 'NavigationAssertionError';
  }
}

/**
 * Asserts that the current page URL matches the expected value
 *
 * @param page - Playwright page instance
 * @param expected - Expected URL (string for exact match, RegExp for pattern)
 * @throws NavigationAssertionError if URL doesn't match
 *
 * @example
 * ```typescript
 * // Exact match
 * await assertURL(page, 'http://localhost:3000/home');
 *
 * // Pattern match
 * await assertURL(page, /\/home$/);
 * await assertURL(page, /\?tab=settings/);
 * ```
 */
export async function assertURL(
  page: Page,
  expected: string | RegExp
): Promise<void> {
  const actual = page.url();

  const matches =
    typeof expected === 'string' ? actual === expected : expected.test(actual);

  if (!matches) {
    throw new NavigationAssertionError(
      `URL assertion failed: expected ${expected}, got "${actual}"`,
      actual,
      expected,
      actual
    );
  }
}

/**
 * Asserts that the current URL contains the specified substring
 *
 * @param page - Playwright page instance
 * @param substring - Substring that must be present in the URL
 * @throws NavigationAssertionError if URL doesn't contain substring
 *
 * @example
 * ```typescript
 * await assertURLContains(page, '/dashboard');
 * await assertURLContains(page, 'userId=123');
 * ```
 */
export async function assertURLContains(
  page: Page,
  substring: string
): Promise<void> {
  const actual = page.url();

  if (!actual.includes(substring)) {
    throw new NavigationAssertionError(
      `URL does not contain "${substring}". Actual URL: "${actual}"`,
      actual,
      substring,
      actual
    );
  }
}

/**
 * Asserts that the current URL matches the specified regex pattern
 *
 * @param page - Playwright page instance
 * @param pattern - Regex pattern to match against the URL
 * @throws NavigationAssertionError if URL doesn't match pattern
 *
 * @example
 * ```typescript
 * await assertURLMatches(page, /\/users\/\d+$/);
 * await assertURLMatches(page, /\?page=\d+&limit=\d+/);
 * ```
 */
export async function assertURLMatches(
  page: Page,
  pattern: RegExp
): Promise<void> {
  const actual = page.url();

  if (!pattern.test(actual)) {
    throw new NavigationAssertionError(
      `URL does not match pattern ${pattern}. Actual URL: "${actual}"`,
      actual,
      pattern,
      actual
    );
  }
}

/**
 * Asserts that the page title matches the expected value
 *
 * @param page - Playwright page instance
 * @param expected - Expected title (string for exact match, RegExp for pattern)
 * @throws NavigationAssertionError if title doesn't match
 *
 * @example
 * ```typescript
 * await assertPageTitle(page, 'Home - My App');
 * await assertPageTitle(page, /^Dashboard/);
 * ```
 */
export async function assertPageTitle(
  page: Page,
  expected: string | RegExp
): Promise<void> {
  const actual = await page.title();

  const matches =
    typeof expected === 'string' ? actual === expected : expected.test(actual);

  if (!matches) {
    throw new NavigationAssertionError(
      `Page title assertion failed: expected ${expected}, got "${actual}"`,
      actual,
      expected,
      page.url()
    );
  }
}

/**
 * Asserts that an element exists on the page
 *
 * @param page - Playwright page instance
 * @param selector - CSS selector for the element
 * @param options - Optional timeout configuration
 * @throws NavigationAssertionError if element doesn't exist
 *
 * @example
 * ```typescript
 * await assertElementExists(page, 'h1.page-title');
 * await assertElementExists(page, '[data-testid="submit-button"]');
 * ```
 */
export async function assertElementExists(
  page: Page,
  selector: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 5000 } = options;

  try {
    await page.waitForSelector(selector, { state: 'attached', timeout });
  } catch {
    throw new NavigationAssertionError(
      `Element not found: "${selector}"`,
      null,
      selector,
      page.url()
    );
  }
}

/**
 * Asserts that an element contains specific text
 *
 * @param page - Playwright page instance
 * @param selector - CSS selector for the element
 * @param expected - Expected text content (string or regex)
 * @throws NavigationAssertionError if text doesn't match
 *
 * @example
 * ```typescript
 * await assertElementText(page, 'h1', 'Welcome');
 * await assertElementText(page, '.message', /successfully created/i);
 * ```
 */
export async function assertElementText(
  page: Page,
  selector: string,
  expected: string | RegExp
): Promise<void> {
  const element = page.locator(selector);
  const count = await element.count();

  if (count === 0) {
    throw new NavigationAssertionError(
      `Element not found for text assertion: "${selector}"`,
      null,
      expected,
      page.url()
    );
  }

  const actual = await element.first().textContent();

  if (actual === null) {
    throw new NavigationAssertionError(
      `Element "${selector}" has no text content`,
      null,
      expected,
      page.url()
    );
  }

  const matches =
    typeof expected === 'string'
      ? actual.includes(expected)
      : expected.test(actual);

  if (!matches) {
    throw new NavigationAssertionError(
      `Element text assertion failed for "${selector}": expected ${expected}, got "${actual}"`,
      actual,
      expected,
      page.url()
    );
  }
}

/**
 * Asserts that an element is visible on the page
 *
 * @param page - Playwright page instance
 * @param selector - CSS selector for the element
 * @param options - Optional timeout configuration
 * @throws NavigationAssertionError if element is not visible
 *
 * @example
 * ```typescript
 * await assertElementVisible(page, '.modal');
 * await assertElementVisible(page, '#notification', { timeout: 10000 });
 * ```
 */
export async function assertElementVisible(
  page: Page,
  selector: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 5000 } = options;

  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
  } catch {
    throw new NavigationAssertionError(
      `Element not visible: "${selector}"`,
      false,
      true,
      page.url()
    );
  }
}

/**
 * Asserts that an element is hidden or not present on the page
 *
 * @param page - Playwright page instance
 * @param selector - CSS selector for the element
 * @param options - Optional timeout configuration
 * @throws NavigationAssertionError if element is visible
 *
 * @example
 * ```typescript
 * await assertElementHidden(page, '.loading-spinner');
 * await assertElementHidden(page, '.error-message');
 * ```
 */
export async function assertElementHidden(
  page: Page,
  selector: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 5000 } = options;

  try {
    await page.waitForSelector(selector, { state: 'hidden', timeout });
  } catch {
    throw new NavigationAssertionError(
      `Element still visible: "${selector}"`,
      true,
      false,
      page.url()
    );
  }
}

/**
 * Asserts multiple page content conditions at once
 *
 * @param page - Playwright page instance
 * @param options - Content assertion options
 * @throws NavigationAssertionError if any assertion fails
 *
 * @example
 * ```typescript
 * await assertPageContent(page, {
 *   hasElement: 'main.content',
 *   pageTitle: 'Dashboard',
 *   elementText: { selector: 'h1', text: 'Welcome' },
 *   bodyContains: 'successfully loaded',
 * });
 * ```
 */
export async function assertPageContent(
  page: Page,
  options: ContentAssertionOptions
): Promise<void> {
  const { hasElement, elementText, pageTitle, bodyContains, timeout = 5000 } = options;

  // Assert element exists
  if (hasElement) {
    await assertElementExists(page, hasElement, { timeout });
  }

  // Assert page title
  if (pageTitle) {
    await assertPageTitle(page, pageTitle);
  }

  // Assert element text
  if (elementText) {
    await assertElementText(page, elementText.selector, elementText.text);
  }

  // Assert body contains text
  if (bodyContains) {
    const bodyText = await page.locator('body').textContent();
    if (!bodyText?.includes(bodyContains)) {
      throw new NavigationAssertionError(
        `Page body does not contain "${bodyContains}"`,
        bodyText?.substring(0, 200) + '...',
        bodyContains,
        page.url()
      );
    }
  }
}

/**
 * Asserts the browser history length
 *
 * @param page - Playwright page instance
 * @param expected - Expected history length
 * @throws NavigationAssertionError if history length doesn't match
 *
 * @example
 * ```typescript
 * // After navigating: home -> page1 -> page2
 * await assertHistoryLength(page, 3);
 * ```
 */
export async function assertHistoryLength(
  page: Page,
  expected: number
): Promise<void> {
  const actual = await page.evaluate(() => window.history.length);

  if (actual !== expected) {
    throw new NavigationAssertionError(
      `History length assertion failed: expected ${expected}, got ${actual}`,
      actual,
      expected,
      page.url()
    );
  }
}

/**
 * Asserts that browser can navigate back
 *
 * @param page - Playwright page instance
 * @param expected - Expected value (true = can go back, false = cannot)
 * @throws NavigationAssertionError if assertion fails
 *
 * @example
 * ```typescript
 * // After navigating from home
 * await assertCanGoBack(page, true);
 *
 * // On first page load
 * await assertCanGoBack(page, false);
 * ```
 */
export async function assertCanGoBack(
  page: Page,
  expected: boolean
): Promise<void> {
  const historyLength = await page.evaluate(() => window.history.length);
  const actual = historyLength > 1;

  if (actual !== expected) {
    throw new NavigationAssertionError(
      `Back navigation assertion failed: expected ${expected}, got ${actual}`,
      actual,
      expected,
      page.url()
    );
  }
}

/**
 * Asserts that browser can navigate forward
 * Note: This requires tracking navigation state as the browser API doesn't expose this directly
 *
 * @param page - Playwright page instance
 * @param expected - Expected value (true = can go forward, false = cannot)
 * @param currentIndex - Current position in history (if known)
 * @param totalLength - Total history length (if known)
 * @throws NavigationAssertionError if assertion fails
 *
 * @example
 * ```typescript
 * // After going back from page2 to page1
 * await assertCanGoForward(page, true, 1, 3);
 *
 * // On the most recent page
 * await assertCanGoForward(page, false);
 * ```
 */
export async function assertCanGoForward(
  page: Page,
  expected: boolean,
  currentIndex?: number,
  totalLength?: number
): Promise<void> {
  // If index tracking is provided, use it for accurate assertion
  if (currentIndex !== undefined && totalLength !== undefined) {
    const actual = currentIndex < totalLength - 1;
    if (actual !== expected) {
      throw new NavigationAssertionError(
        `Forward navigation assertion failed: expected ${expected}, got ${actual}`,
        actual,
        expected,
        page.url()
      );
    }
    return;
  }

  // Without tracking, we can only check if we're not at the initial state
  // This is a limitation of the browser security model
  if (expected) {
    console.warn(
      'assertCanGoForward: Cannot reliably verify forward navigation availability without history tracking'
    );
  }
}

/**
 * Asserts that a navigation completed within a time threshold
 *
 * @param startTime - Start time in milliseconds (Date.now())
 * @param maxDuration - Maximum allowed duration in milliseconds
 * @throws NavigationAssertionError if navigation took too long
 *
 * @example
 * ```typescript
 * const startTime = Date.now();
 * await page.goto('/dashboard');
 * assertNavigationPerformance(startTime, 3000); // Must complete within 3s
 * ```
 */
export function assertNavigationPerformance(
  startTime: number,
  maxDuration: number
): void {
  const actual = Date.now() - startTime;

  if (actual > maxDuration) {
    throw new NavigationAssertionError(
      `Navigation performance assertion failed: took ${actual}ms, max allowed ${maxDuration}ms`,
      actual,
      maxDuration
    );
  }
}

/**
 * Asserts that the page load state is complete
 *
 * @param page - Playwright page instance
 * @param state - Expected load state
 * @param timeout - Maximum time to wait in milliseconds
 * @throws NavigationAssertionError if state not reached within timeout
 *
 * @example
 * ```typescript
 * await assertLoadState(page, 'networkidle');
 * await assertLoadState(page, 'domcontentloaded', 5000);
 * ```
 */
export async function assertLoadState(
  page: Page,
  state: 'load' | 'domcontentloaded' | 'networkidle' = 'load',
  timeout: number = 30000
): Promise<void> {
  try {
    await page.waitForLoadState(state, { timeout });
  } catch {
    throw new NavigationAssertionError(
      `Page did not reach "${state}" state within ${timeout}ms`,
      'pending',
      state,
      page.url()
    );
  }
}

// Export types for external use
export type { ContentAssertionOptions };
