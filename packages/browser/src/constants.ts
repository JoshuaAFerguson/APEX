/**
 * @apexcli/browser - Constants
 *
 * Default configurations and constants for browser automation
 */

import type {
  BrowserSessionConfig,
  BrowserManagerConfig,
  CaptureConfig,
} from './types.js';

/**
 * Default browser session configuration.
 *
 * Provides sensible defaults for browser automation including
 * Chromium browser, headless mode, standard viewport, and
 * security-oriented launch arguments.
 *
 * @example
 * ```typescript
 * import { defaultBrowserConfig } from '@apexcli/browser';
 *
 * // Use defaults directly
 * const session = new BrowserSession(manager, defaultBrowserConfig);
 *
 * // Override specific settings
 * const customConfig = {
 *   ...defaultBrowserConfig,
 *   headless: false,
 *   viewport: { width: 1920, height: 1080 }
 * };
 * ```
 */
export const defaultBrowserConfig: BrowserSessionConfig = {
  browserType: 'chromium',
  headless: true,
  viewport: {
    width: 1280,
    height: 720,
  },
  timeout: 30000,
  ignoreHTTPSErrors: false,
  launchOptions: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  },
  contextOptions: {
    locale: 'en-US',
    timezoneId: 'America/New_York',
  },
};

/**
 * Default browser manager configuration.
 *
 * Provides balanced settings for browser instance management
 * including instance limits, reuse behavior, and resource constraints.
 *
 * @example
 * ```typescript
 * import { defaultManagerConfig } from '@apexcli/browser';
 *
 * // Use defaults
 * const manager = new BrowserManager(defaultManagerConfig);
 *
 * // Override for high-concurrency scenarios
 * const highConcurrencyConfig = {
 *   ...defaultManagerConfig,
 *   maxInstances: 20,
 *   resourceLimits: {
 *     maxMemoryMB: 4096,
 *     maxCpuPercent: 90
 *   }
 * };
 * ```
 */
export const defaultManagerConfig: BrowserManagerConfig = {
  maxInstances: 5,
  defaultSessionConfig: defaultBrowserConfig,
  instanceIdleTimeout: 300000, // 5 minutes
  reuseInstances: true,
  resourceLimits: {
    maxMemoryMB: 1024,
    maxCpuPercent: 80,
  },
};

/**
 * Default capture configuration.
 *
 * Enables comprehensive console and error capture with
 * reasonable buffer limits for typical automation scenarios.
 *
 * @example
 * ```typescript
 * import { defaultCaptureConfig } from '@apexcli/browser';
 *
 * // Use defaults for full capture
 * const session = new BrowserSession(manager, {}, defaultCaptureConfig);
 *
 * // Customize for error-only capture
 * const errorOnlyConfig = {
 *   ...defaultCaptureConfig,
 *   captureConsole: false,
 *   consoleLevels: []
 * };
 * ```
 */
export const defaultCaptureConfig: CaptureConfig = {
  captureConsole: true,
  consoleLevels: ['log', 'debug', 'info', 'warn', 'error'],
  captureErrors: true,
  maxBufferSize: 1000,
  includeStackTraces: true,
};

/**
 * Browser launch timeouts and limits.
 *
 * Defines timeout values and retry policies for browser operations
 * to prevent hanging operations and provide reasonable wait times.
 *
 * @example
 * ```typescript
 * import { BROWSER_LIMITS } from '@apexcli/browser';
 *
 * // Use in custom timeout configuration
 * const customTimeout = BROWSER_LIMITS.NAVIGATION_TIMEOUT_MS * 2;
 *
 * await session.navigate(url, { timeout: customTimeout });
 * ```
 */
export const BROWSER_LIMITS = {
  /** Maximum time to wait for browser launch */
  LAUNCH_TIMEOUT_MS: 30000,
  /** Maximum time to wait for page navigation */
  NAVIGATION_TIMEOUT_MS: 30000,
  /** Maximum time to wait for element selection */
  ELEMENT_TIMEOUT_MS: 10000,
  /** Maximum number of retries for browser operations */
  MAX_RETRIES: 3,
  /** Delay between retry attempts */
  RETRY_DELAY_MS: 1000,
} as const;

/**
 * Resource monitoring intervals.
 *
 * Defines intervals for background monitoring tasks including
 * resource usage checks, cleanup operations, and activity tracking.
 *
 * @example
 * ```typescript
 * import { MONITORING_INTERVALS } from '@apexcli/browser';
 *
 * // Use for custom monitoring setup
 * setInterval(checkCustomResources, MONITORING_INTERVALS.RESOURCE_CHECK_INTERVAL_MS);
 * ```
 */
export const MONITORING_INTERVALS = {
  /** How often to check resource usage (ms) */
  RESOURCE_CHECK_INTERVAL_MS: 5000,
  /** How often to cleanup idle instances (ms) */
  CLEANUP_INTERVAL_MS: 60000,
  /** How often to update instance activity (ms) */
  ACTIVITY_UPDATE_INTERVAL_MS: 1000,
} as const;

/**
 * Error messages for common browser automation failures.
 *
 * Standardized error messages for consistent error reporting
 * across all browser automation operations.
 *
 * @example
 * ```typescript
 * import { ERROR_MESSAGES } from '@apexcli/browser';
 *
 * // Use in custom error handling
 * if (!this.page) {
 *   return {
 *     success: false,
 *     error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED
 *   };
 * }
 * ```
 */
export const ERROR_MESSAGES = {
  BROWSER_NOT_LAUNCHED: 'Browser not launched. Call launch() first.',
  CONTEXT_NOT_CREATED: 'Browser context not created.',
  PAGE_NOT_CREATED: 'Page not created.',
  ELEMENT_NOT_FOUND: 'Element not found with selector',
  NAVIGATION_FAILED: 'Navigation to URL failed',
  SCREENSHOT_FAILED: 'Failed to capture screenshot',
  BROWSER_LAUNCH_FAILED: 'Failed to launch browser',
  CONTEXT_CREATION_FAILED: 'Failed to create browser context',
  MAX_INSTANCES_EXCEEDED: 'Maximum browser instances exceeded',
  RESOURCE_LIMIT_EXCEEDED: 'Resource usage limit exceeded',
  NAVIGATION_NO_HISTORY_BACK: 'Cannot go back - no previous page in history',
  NAVIGATION_NO_HISTORY_FORWARD: 'Cannot go forward - no next page in history',
  NAVIGATION_TIMEOUT: 'Navigation timed out',
  RELOAD_FAILED: 'Page reload failed',
} as const;

/**
 * Browser user agent strings for different types.
 *
 * Common user agent strings for desktop and mobile browsers
 * to enable browser-specific testing and user agent spoofing.
 *
 * @example
 * ```typescript
 * import { USER_AGENTS } from '@apexcli/browser';
 *
 * const session = new BrowserSession(manager, {
 *   userAgent: USER_AGENTS.CHROME_MOBILE
 * });
 * ```
 */
export const USER_AGENTS = {
  CHROME_DESKTOP: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  FIREFOX_DESKTOP: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  SAFARI_DESKTOP: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  CHROME_MOBILE: 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
} as const;