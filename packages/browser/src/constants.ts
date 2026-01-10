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
 * Default browser session configuration
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
 * Default browser manager configuration
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
 * Default capture configuration
 */
export const defaultCaptureConfig: CaptureConfig = {
  captureConsole: true,
  consoleLevels: ['log', 'debug', 'info', 'warn', 'error'],
  captureErrors: true,
  maxBufferSize: 1000,
  includeStackTraces: true,
};

/**
 * Browser launch timeouts and limits
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
 * Resource monitoring intervals
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
 * Error messages for common browser automation failures
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
} as const;

/**
 * Browser user agent strings for different types
 */
export const USER_AGENTS = {
  CHROME_DESKTOP: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  FIREFOX_DESKTOP: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  SAFARI_DESKTOP: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  CHROME_MOBILE: 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
} as const;