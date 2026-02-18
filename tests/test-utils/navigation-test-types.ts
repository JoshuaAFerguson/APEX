/**
 * @fileoverview Navigation Test Types for APEX
 *
 * This module provides centralized TypeScript interfaces and types for navigation
 * testing utilities. It defines all the type contracts used across the navigation
 * test infrastructure including options, assertions, fixtures, and helper function
 * signatures.
 *
 * @module navigation-test-types
 * @see {@link ./navigation-test-utils.ts} for implementation
 * @see {@link ./navigation-test-fixtures.ts} for fixture implementations
 * @see {@link ../page-navigation/utils/navigation-helpers.ts} for helper implementations
 *
 * @example
 * // Import types for use in test files
 * import type {
 *   NavigationOptions,
 *   PageFixture,
 *   AssertionOptions
 * } from './navigation-test-types';
 *
 * // Use in function signatures
 * async function navigate(page: Page, options: NavigationOptions): Promise<NavigationResult> {
 *   // implementation
 * }
 */

import type { Page, BrowserContext, Browser } from 'playwright';

// ============================================================================
// Core Navigation Options
// ============================================================================

/**
 * Options for navigation operations (goto, reload, etc.)
 *
 * @description Controls how navigation operations behave, including timeouts,
 * wait conditions, and HTTP headers.
 *
 * @example
 * const options: NavigationOptions = {
 *   timeout: 30000,
 *   waitUntil: 'networkidle',
 *   referer: 'https://example.com'
 * };
 * await page.goto('/dashboard', options);
 */
export interface NavigationOptions {
  /**
   * Maximum time in milliseconds to wait for navigation to complete.
   * Pass 0 to disable timeout.
   * @default 30000
   */
  timeout?: number;

  /**
   * When to consider navigation succeeded.
   * - 'load': Wait for the load event to be fired
   * - 'domcontentloaded': Wait for DOMContentLoaded event
   * - 'networkidle': Wait until there are no network connections for at least 500ms
   * - 'commit': Wait for the navigation to be committed (earliest event)
   * @default 'load'
   */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';

  /**
   * Whether to replace the current history entry instead of adding a new one.
   * @default false
   */
  replace?: boolean;

  /**
   * Referer header value to send with the navigation request.
   * If not specified, the referer is determined automatically.
   */
  referer?: string;
}

/**
 * Extended options for waitForNavigation method
 *
 * @description Extends NavigationOptions with URL pattern matching for
 * waiting on specific navigation targets.
 *
 * @example
 * const options: WaitForNavigationOptions = {
 *   timeout: 10000,
 *   waitUntil: 'networkidle',
 *   url: /\/dashboard$/
 * };
 * await page.waitForNavigation(options);
 */
export interface WaitForNavigationOptions extends NavigationOptions {
  /**
   * URL pattern to wait for. Navigation is considered complete when the
   * URL matches this pattern.
   * - string: Exact URL match
   * - RegExp: URL matches the regular expression
   */
  url?: string | RegExp;
}

// ============================================================================
// Assertion Options
// ============================================================================

/**
 * Options for URL assertions
 *
 * @description Configures how URL assertions are performed, including
 * pattern matching and URL component filtering.
 *
 * @example
 * // Assert exact URL
 * const exactMatch: URLAssertionOptions = {
 *   url: 'https://example.com/dashboard'
 * };
 *
 * // Assert pathname only, ignoring query params
 * const pathnameOnly: URLAssertionOptions = {
 *   url: '/dashboard',
 *   pathname: true,
 *   ignoreQuery: true
 * };
 */
export interface URLAssertionOptions {
  /**
   * Expected URL to match against.
   * - string: Exact match (or pattern based on other options)
   * - RegExp: URL must match the regular expression
   */
  url: string | RegExp;

  /**
   * When true, only compare the pathname portion of the URL.
   * @default false
   */
  pathname?: boolean;

  /**
   * When true, ignore query parameters when comparing URLs.
   * @default false
   */
  ignoreQuery?: boolean;

  /**
   * When true, ignore the hash fragment when comparing URLs.
   * @default false
   */
  ignoreHash?: boolean;

  /**
   * Maximum time in milliseconds to wait for the URL to match.
   * @default 10000
   */
  timeout?: number;
}

/**
 * Options for page content assertions
 *
 * @description Configures content-based assertions including text matching,
 * element presence, count, and visibility checks.
 *
 * @example
 * // Assert text content exists
 * const textAssertion: PageContentAssertionOptions = {
 *   text: 'Welcome to Dashboard',
 *   selector: 'h1',
 *   visible: true
 * };
 *
 * // Assert element count
 * const countAssertion: PageContentAssertionOptions = {
 *   selector: '.list-item',
 *   count: 5
 * };
 */
export interface PageContentAssertionOptions {
  /**
   * Text content to check for on the page.
   * - string: Exact text match (case-sensitive)
   * - RegExp: Text content must match the pattern
   */
  text?: string | RegExp;

  /**
   * CSS selector for the element to check.
   * Used with count and visible properties.
   */
  selector?: string;

  /**
   * Expected number of elements matching the selector.
   * Assertion fails if the count doesn't match exactly.
   */
  count?: number;

  /**
   * Whether the element should be visible.
   * - true: Element must be visible
   * - false: Element must be hidden
   * - undefined: Visibility is not checked
   */
  visible?: boolean;

  /**
   * Maximum time in milliseconds to wait for the assertion to pass.
   * @default 10000
   */
  timeout?: number;
}

/**
 * Options for element wait operations
 *
 * @description Configures how to wait for elements to appear or reach
 * a specific state.
 *
 * @example
 * const waitOptions: ElementWaitOptions = {
 *   visible: true,
 *   timeout: 5000
 * };
 * await helper.waitForElement('#submit-button', waitOptions);
 */
export interface ElementWaitOptions {
  /**
   * Whether to wait for the element to be visible.
   * If false, waits only for the element to be attached to DOM.
   * @default true
   */
  visible?: boolean;

  /**
   * Maximum time in milliseconds to wait for the element.
   * @default 10000
   */
  timeout?: number;
}

/**
 * Combined assertion options for navigation validation
 *
 * @description Comprehensive options for validating navigation state
 * including URL, title, history, and content assertions.
 *
 * @example
 * const validation: NavigationValidationOptions = {
 *   url: /\/products\/\d+$/,
 *   title: 'Product Details',
 *   historyLength: 3,
 *   hasElement: '.product-info',
 *   textContent: {
 *     selector: 'h1',
 *     text: /Product #\d+/
 *   }
 * };
 */
export interface NavigationValidationOptions {
  /**
   * Expected URL pattern to match.
   */
  url?: string | RegExp;

  /**
   * Expected page title.
   */
  title?: string | RegExp;

  /**
   * Expected browser history length.
   */
  historyLength?: number;

  /**
   * Maximum acceptable navigation time in milliseconds.
   * Navigation is considered slow if it exceeds this threshold.
   */
  performanceThreshold?: number;

  /**
   * Selector for an element that must exist on the page.
   */
  hasElement?: string;

  /**
   * Text content assertion for a specific element.
   */
  textContent?: {
    /** CSS selector for the element */
    selector: string;
    /** Expected text content (exact or pattern) */
    text: string | RegExp;
  };
}

// ============================================================================
// Navigation Results
// ============================================================================

/**
 * Result of a navigation operation
 *
 * @description Contains the outcome of a navigation operation including
 * success status, timing, final URL, and any errors that occurred.
 *
 * @example
 * const result: NavigationResult = await helper.goto('/dashboard');
 * if (result.success) {
 *   console.log(`Navigation took ${result.duration}ms`);
 *   console.log(`Final URL: ${result.finalUrl}`);
 * } else {
 *   console.error(`Navigation failed: ${result.error?.message}`);
 * }
 */
export interface NavigationResult {
  /**
   * Whether the navigation completed successfully.
   */
  success: boolean;

  /**
   * The final URL after navigation (may differ from target due to redirects).
   */
  finalUrl: string;

  /**
   * Total navigation duration in milliseconds.
   */
  duration: number;

  /**
   * Error that occurred during navigation (if any).
   */
  error?: Error;

  /**
   * Performance metrics collected during navigation.
   */
  metrics?: NavigationPerformanceMetrics;
}

/**
 * Performance metrics for navigation operations
 *
 * @description Detailed timing information about the navigation operation,
 * collected from the Performance API.
 *
 * @example
 * const metrics: NavigationPerformanceMetrics = {
 *   loadTime: 245,
 *   domContentLoaded: 120,
 *   networkRequests: 15
 * };
 */
export interface NavigationPerformanceMetrics {
  /**
   * Time from navigation start to load event completion (ms).
   */
  loadTime: number;

  /**
   * Time for DOMContentLoaded event (ms).
   */
  domContentLoaded: number;

  /**
   * Number of network requests made during navigation.
   */
  networkRequests: number;
}

/**
 * Extended performance metrics with paint timing
 *
 * @description Comprehensive performance metrics including paint timing
 * and total navigation duration.
 *
 * @example
 * const performance = await measureNavigationPerformance(page);
 * console.log(`First paint: ${performance.firstPaint}ms`);
 * console.log(`FCP: ${performance.firstContentfulPaint}ms`);
 */
export interface NavigationPerformance {
  /**
   * Time for DOMContentLoaded event (ms).
   */
  domContentLoaded: number;

  /**
   * Time for load event completion (ms).
   */
  loadComplete: number;

  /**
   * Time to first paint (ms).
   */
  firstPaint: number;

  /**
   * Time to first contentful paint (ms).
   */
  firstContentfulPaint: number;

  /**
   * Total navigation time from start to load complete (ms).
   */
  totalNavigationTime: number;

  /**
   * Timestamp when metrics were collected.
   */
  timestamp: number;

  /**
   * URL that was navigated to.
   */
  url: string;
}

/**
 * Browser history state information
 *
 * @description Represents the current state of browser history navigation,
 * including available navigation directions.
 *
 * @example
 * const history: NavigationHistory = await getNavigationHistory(page);
 * if (history.canGoBack) {
 *   await page.goBack();
 * }
 */
export interface NavigationHistory {
  /**
   * Total number of entries in the history stack.
   */
  length: number;

  /**
   * Current position in the history stack (0-indexed).
   */
  currentIndex: number;

  /**
   * Whether back navigation is available.
   */
  canGoBack: boolean;

  /**
   * Whether forward navigation is available.
   */
  canGoForward: boolean;

  /**
   * List of URLs in the history (may be limited due to security).
   */
  entries: string[];
}

// ============================================================================
// Fixture Types
// ============================================================================

/**
 * Configuration for page fixtures
 *
 * @description Options for creating and configuring test page instances
 * with specific viewport, headers, and initial content.
 *
 * @example
 * const config: PageFixtureConfig = {
 *   viewport: { width: 1920, height: 1080 },
 *   url: 'https://example.com',
 *   locale: 'en-US',
 *   timezone: 'America/New_York'
 * };
 * const page = await fixture.createPage(config);
 */
export interface PageFixtureConfig {
  /**
   * Initial URL to load when the page is created.
   */
  url?: string;

  /**
   * HTML content to set directly (alternative to URL).
   */
  content?: string;

  /**
   * Viewport dimensions for the page.
   */
  viewport?: {
    width: number;
    height: number;
  };

  /**
   * Custom user agent string.
   */
  userAgent?: string;

  /**
   * Locale setting (e.g., 'en-US', 'fr-FR').
   */
  locale?: string;

  /**
   * Timezone ID (e.g., 'America/New_York', 'Europe/London').
   */
  timezone?: string;

  /**
   * Whether JavaScript is enabled.
   * @default true
   */
  javaScriptEnabled?: boolean;

  /**
   * Extra HTTP headers to send with every request.
   */
  extraHeaders?: Record<string, string>;
}

/**
 * Browser context fixture configuration
 *
 * @description Extended options for creating browser context fixtures
 * with navigation-specific settings.
 *
 * @example
 * const options: BrowserContextFixtureOptions = {
 *   browserType: 'chromium',
 *   headless: true,
 *   viewport: { width: 1280, height: 720 },
 *   navigationTimeout: 30000
 * };
 */
export interface BrowserContextFixtureOptions {
  /**
   * Browser type to launch.
   * @default 'chromium'
   */
  browserType?: 'chromium' | 'firefox' | 'webkit';

  /**
   * Whether to run in headless mode.
   * @default true in CI, false otherwise
   */
  headless?: boolean;

  /**
   * Slow down operations by the specified milliseconds.
   * Useful for debugging.
   */
  slowMo?: number;

  /**
   * Whether to open DevTools.
   * @default false
   */
  devtools?: boolean;

  /**
   * Additional browser launch arguments.
   */
  args?: string[];

  /**
   * Viewport dimensions.
   */
  viewport?: {
    width: number;
    height: number;
  };

  /**
   * Base URL for relative navigation.
   */
  baseURL?: string;

  /**
   * Default navigation timeout in milliseconds.
   * @default 30000
   */
  navigationTimeout?: number;

  /**
   * Default action timeout in milliseconds.
   * @default 30000
   */
  actionTimeout?: number;

  /**
   * Directory for recording video.
   */
  recordVideo?: {
    dir: string;
  };

  /**
   * Reduced motion setting.
   * @default 'reduce'
   */
  reducedMotion?: 'reduce' | 'no-preference';

  /**
   * Timezone ID for the context.
   */
  timezoneId?: string;

  /**
   * Locale for the context.
   */
  locale?: string;
}

/**
 * Page fixture with browser context and cleanup
 *
 * @description Represents a fully initialized test page with associated
 * browser context and cleanup function.
 *
 * @example
 * let fixture: PageFixture;
 *
 * beforeEach(async () => {
 *   fixture = await createPageFixture({ baseURL: 'http://localhost:3000' });
 * });
 *
 * afterEach(async () => {
 *   await fixture.cleanup();
 * });
 *
 * it('should navigate', async () => {
 *   await fixture.page.goto('/dashboard');
 * });
 */
export interface PageFixture {
  /**
   * The Playwright Page instance.
   */
  page: Page;

  /**
   * The browser context containing the page.
   */
  context: BrowserContext;

  /**
   * The browser instance.
   */
  browser: Browser;

  /**
   * Cleanup function to close page, context, and browser.
   * Must be called in afterEach to prevent resource leaks.
   */
  cleanup: () => Promise<void>;
}

/**
 * Browser context fixture with cleanup
 *
 * @description Represents a browser context fixture without an initial page,
 * useful for tests that need to manage multiple pages.
 *
 * @example
 * const fixture: BrowserContextFixture = await createContextFixture();
 * const page1 = await fixture.context.newPage();
 * const page2 = await fixture.context.newPage();
 * // ... run tests
 * await fixture.cleanup();
 */
export interface BrowserContextFixture {
  /**
   * The browser context instance.
   */
  context: BrowserContext;

  /**
   * The browser instance.
   */
  browser: Browser;

  /**
   * Cleanup function to close context and browser.
   */
  cleanup: () => Promise<void>;
}

/**
 * Test isolation options for navigation tests
 *
 * @description Configures how test isolation is handled between tests,
 * including storage and cookie clearing.
 *
 * @example
 * const isolation: TestIsolationOptions = {
 *   incognito: true,
 *   clearCookies: true,
 *   clearLocalStorage: true,
 *   captureNetworkLogs: true
 * };
 */
export interface TestIsolationOptions {
  /**
   * Whether to use incognito/private context for each test.
   * @default true
   */
  incognito?: boolean;

  /**
   * Whether to clear cookies between tests.
   * @default true
   */
  clearCookies?: boolean;

  /**
   * Whether to clear localStorage between tests.
   * @default true
   */
  clearLocalStorage?: boolean;

  /**
   * Whether to clear sessionStorage between tests.
   * @default true
   */
  clearSessionStorage?: boolean;

  /**
   * Whether to capture network request/response logs.
   * @default false
   */
  captureNetworkLogs?: boolean;

  /**
   * Whether to capture console messages.
   * @default false
   */
  captureConsoleLogs?: boolean;
}

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Navigation test configuration
 *
 * @description Master configuration for navigation testing including
 * browser settings, timeouts, and test behavior options.
 *
 * @example
 * const config: NavigationTestConfig = {
 *   browserType: 'chromium',
 *   headless: true,
 *   navigationTimeout: 30000,
 *   waitForNetworkIdle: true,
 *   baseUrl: 'http://localhost:3000',
 *   captureFailureScreenshots: true
 * };
 */
export interface NavigationTestConfig {
  /**
   * Browser backend to use.
   * @default 'playwright'
   */
  backend?: 'playwright' | 'puppeteer';

  /**
   * Browser type to launch.
   * @default 'chromium'
   */
  browserType?: 'chromium' | 'firefox' | 'webkit';

  /**
   * Whether to run in headless mode.
   */
  headless?: boolean;

  /**
   * Viewport dimensions.
   */
  viewport?: {
    width: number;
    height: number;
  };

  /**
   * Slow down operations by the specified milliseconds.
   */
  slowMo?: number;

  /**
   * Whether to open DevTools.
   */
  devtools?: boolean;

  /**
   * Default timeout for operations in milliseconds.
   * @default 30000
   */
  timeout?: number;

  /**
   * Number of retries for failed operations.
   * @default 0
   */
  retries?: number;

  /**
   * Default timeout for navigation operations in milliseconds.
   * @default 30000
   */
  navigationTimeout?: number;

  /**
   * Whether to wait for network idle after navigation.
   * @default true
   */
  waitForNetworkIdle?: boolean;

  /**
   * Base URL for relative navigation.
   */
  baseUrl?: string;

  /**
   * Whether to capture screenshots on navigation failures.
   * @default true
   */
  captureFailureScreenshots?: boolean;

  /**
   * Whether to record navigation history during tests.
   * @default false
   */
  recordNavigationHistory?: boolean;

  /**
   * Whether to measure performance metrics.
   * @default false
   */
  measurePerformance?: boolean;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Navigation event entry
 *
 * @description Represents a single navigation event captured during testing.
 *
 * @example
 * const events: NavigationEvent[] = monitor.getEvents();
 * const navigations = events.filter(e => e.type === 'framenavigated');
 */
export interface NavigationEvent {
  /**
   * Type of navigation event.
   */
  type: 'framenavigated' | 'load' | 'domcontentloaded' | 'commit';

  /**
   * URL associated with the event.
   */
  url: string;

  /**
   * Timestamp when the event occurred.
   */
  timestamp: number;
}

/**
 * Network log entry
 *
 * @description Represents a captured network request/response.
 *
 * @example
 * const networkLogs: NetworkLogEntry[] = fixture.networkActivity;
 * const apiCalls = networkLogs.filter(log => log.url.includes('/api/'));
 */
export interface NetworkLogEntry {
  /**
   * Request URL.
   */
  url: string;

  /**
   * HTTP method (GET, POST, etc.).
   */
  method: string;

  /**
   * HTTP response status code (if available).
   */
  status?: number;

  /**
   * Timestamp when the request was made.
   */
  timestamp: number;
}

/**
 * Console log entry
 *
 * @description Represents a captured console message from the browser.
 *
 * @example
 * const consoleLogs: ConsoleLogEntry[] = fixture.consoleActivity;
 * const errors = consoleLogs.filter(log => log.type === 'error');
 */
export interface ConsoleLogEntry {
  /**
   * Console message type (log, warn, error, etc.).
   */
  type: string;

  /**
   * Message text content.
   */
  text: string;

  /**
   * Timestamp when the message was logged.
   */
  timestamp: number;
}

// ============================================================================
// Helper Function Signatures
// ============================================================================

/**
 * Signature for safe navigation function
 *
 * @description Type definition for functions that perform navigation with
 * error handling and retry logic.
 */
export type SafeNavigateFunction = (
  page: Page,
  url: string,
  options?: {
    timeout?: number;
    waitUntil?: 'networkidle' | 'domcontentloaded' | 'load';
    retries?: number;
  }
) => Promise<boolean>;

/**
 * Signature for navigation validation function
 *
 * @description Type definition for functions that validate navigation state.
 */
export type ValidateNavigationFunction = (
  page: Page,
  validation: NavigationValidationOptions
) => Promise<{
  valid: boolean;
  errors: string[];
}>;

/**
 * Signature for performance measurement function
 *
 * @description Type definition for functions that measure navigation performance.
 */
export type MeasureNavigationPerformanceFunction = (
  page: Page
) => Promise<NavigationPerformance>;

/**
 * Signature for page fixture creation function
 *
 * @description Type definition for functions that create page fixtures.
 */
export type CreatePageFixtureFunction = (
  options?: BrowserContextFixtureOptions
) => Promise<PageFixture>;

/**
 * Signature for scoped page execution function
 *
 * @description Type definition for functions that execute code within
 * a scoped page context with automatic cleanup.
 */
export type WithNavigationPageFunction = <T>(
  fn: (page: Page) => Promise<T>,
  options?: BrowserContextFixtureOptions
) => Promise<T>;

// ============================================================================
// Scenario Types
// ============================================================================

/**
 * Navigation scenario step
 *
 * @description Represents a single step in a navigation test scenario.
 *
 * @example
 * const step: NavigationStep = {
 *   type: 'click',
 *   selector: '#nav-link',
 *   expectNavigation: true,
 *   timeout: 5000
 * };
 */
export interface NavigationStep {
  /**
   * Type of navigation action.
   */
  type: 'goto' | 'click' | 'back' | 'forward' | 'reload' | 'wait' | 'evaluate';

  /**
   * Target URL (for 'goto' type).
   */
  target?: string;

  /**
   * Element selector (for 'click' type).
   */
  selector?: string;

  /**
   * JavaScript code to evaluate (for 'evaluate' type).
   */
  code?: string;

  /**
   * Timeout for this step in milliseconds.
   */
  timeout?: number;

  /**
   * Whether this step triggers a navigation.
   */
  expectNavigation?: boolean;
}

/**
 * Expected outcome for a navigation scenario
 *
 * @description Defines the expected state after a navigation scenario completes.
 */
export interface ExpectedOutcome {
  /**
   * Expected final URL pattern.
   */
  url?: string | RegExp;

  /**
   * Expected page title.
   */
  title?: string | RegExp;

  /**
   * Expected history length.
   */
  historyLength?: number;

  /**
   * Element that should exist.
   */
  hasElement?: string;

  /**
   * Expected text content.
   */
  hasText?: string | RegExp;
}

/**
 * Navigation test scenario
 *
 * @description A complete navigation test scenario with steps and expected outcomes.
 *
 * @example
 * const scenario: NavigationScenario = {
 *   name: 'login-flow',
 *   description: 'Tests the complete login navigation flow',
 *   steps: [
 *     { type: 'goto', target: '/login' },
 *     { type: 'click', selector: '#submit', expectNavigation: true }
 *   ],
 *   expectedOutcome: {
 *     url: /\/dashboard$/,
 *     hasElement: '.welcome-message'
 *   },
 *   timeout: 30000
 * };
 */
export interface NavigationScenario {
  /**
   * Unique name for the scenario.
   */
  name: string;

  /**
   * Human-readable description.
   */
  description: string;

  /**
   * Steps to execute in order.
   */
  steps: NavigationStep[];

  /**
   * Expected state after all steps complete.
   */
  expectedOutcome: ExpectedOutcome;

  /**
   * Overall timeout for the scenario.
   */
  timeout?: number;
}

/**
 * Result of running a navigation scenario
 *
 * @description Contains the outcome of executing a navigation scenario.
 */
export interface NavigationScenarioResult {
  /**
   * Whether the scenario completed successfully.
   */
  success: boolean;

  /**
   * Performance metrics collected during execution.
   */
  metrics: NavigationPerformance | null;

  /**
   * Error that occurred (if any).
   */
  error?: Error;

  /**
   * Validation errors (if any).
   */
  validationErrors?: string[];

  /**
   * Execution duration in milliseconds.
   */
  duration: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Navigation assertion error details
 *
 * @description Extended error information for navigation assertion failures.
 */
export interface NavigationAssertionErrorDetails {
  /**
   * Error message.
   */
  message: string;

  /**
   * Actual value that failed assertion.
   */
  actual: unknown;

  /**
   * Expected value.
   */
  expected: unknown;

  /**
   * Current page URL when error occurred.
   */
  url?: string;

  /**
   * Selector involved in the assertion (if applicable).
   */
  selector?: string;

  /**
   * Timeout that was exceeded (if applicable).
   */
  timeout?: number;
}

// ============================================================================
// Re-exports for Backward Compatibility
// ============================================================================

/**
 * @deprecated Use URLAssertionOptions instead
 */
export type URLAssertion = URLAssertionOptions;

/**
 * @deprecated Use PageContentAssertionOptions instead
 */
export type PageContentAssertion = PageContentAssertionOptions;

/**
 * @deprecated Use NavigationValidationOptions instead
 */
export type NavigationValidation = NavigationValidationOptions;
