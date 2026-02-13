/**
 * @fileoverview Test fixtures for Playwright browser automation
 *
 * This module provides reusable browser context and page fixtures for Playwright tests:
 * - Browser context fixtures with configuration options
 * - Page fixtures with setup and teardown lifecycle hooks
 * - Configuration options for headless mode, viewport, etc.
 * - Helper utilities for common test scenarios
 */

import { test as base, Browser, BrowserContext, Page, expect } from '@playwright/test';
import type { BrowserContextOptions, ViewportSize } from '@playwright/test';
import {
  createLoggedInPageFixture,
  type LoggedInPageFixture,
  type LoggedInPageFixtureConfig,
  type BrowserState
} from '@apexcli/core/test-fixtures';

// Fixture configuration types
export interface BrowserFixtureConfig {
  headless?: boolean;
  viewport?: ViewportSize;
  recordVideo?: boolean;
  recordTrace?: boolean;
  screenshotMode?: 'off' | 'only-on-failure' | 'on';
  locale?: string;
  timezone?: string;
  geolocation?: { latitude: number; longitude: number };
  permissions?: string[];
  userAgent?: string;
  deviceScaleFactor?: number;
  hasTouch?: boolean;
  isMobile?: boolean;
}

export interface PageFixtureConfig extends BrowserFixtureConfig {
  baseURL?: string;
  navigationTimeout?: number;
  actionTimeout?: number;
  consoleCapture?: boolean;
  networkCapture?: boolean;
  autoCleanup?: boolean;
}

// Extended test interface with custom fixtures
interface CustomTestFixtures {
  contextWithConfig: BrowserContext;
  pageWithConfig: Page;
  testConfig: PageFixtureConfig;
  cleanBrowserContext: BrowserContext;
  cleanPage: Page;
  configurablePage: (config?: PageFixtureConfig) => Promise<Page>;
  pageWithConsoleCapture: { page: Page; consoleMessages: any[] };
  pageWithNetworkCapture: { page: Page; networkRequests: any[] };
  loggedInPage: { page: Page; authFixture: LoggedInPageFixture; browserState: BrowserState };
}

// Default configuration
const DEFAULT_CONFIG: PageFixtureConfig = {
  headless: true,
  viewport: { width: 1280, height: 720 },
  recordVideo: false,
  recordTrace: false,
  screenshotMode: 'only-on-failure',
  navigationTimeout: 30000,
  actionTimeout: 10000,
  consoleCapture: false,
  networkCapture: false,
  autoCleanup: true,
};

/**
 * Extended test object with custom browser fixtures
 */
export const test = base.extend<CustomTestFixtures>({
  /**
   * Test configuration fixture - provides merged default and custom config
   */
  testConfig: async ({}, use, testInfo) => {
    const config: PageFixtureConfig = {
      ...DEFAULT_CONFIG,
      // Override with any environment variables
      headless: process.env.HEADED !== 'true',
      // Use test name for video/trace naming
      recordVideo: process.env.VIDEO === 'true',
      recordTrace: process.env.TRACE === 'true',
    };

    await use(config);
  },

  /**
   * Browser context fixture with configuration options
   */
  contextWithConfig: async ({ browser, testConfig }, use) => {
    const contextOptions: BrowserContextOptions = {
      viewport: testConfig.viewport,
      locale: testConfig.locale,
      timezoneId: testConfig.timezone,
      geolocation: testConfig.geolocation,
      permissions: testConfig.permissions,
      userAgent: testConfig.userAgent,
      deviceScaleFactor: testConfig.deviceScaleFactor,
      hasTouch: testConfig.hasTouch,
      isMobile: testConfig.isMobile,
    };

    // Add video recording if enabled
    if (testConfig.recordVideo) {
      contextOptions.recordVideo = {
        dir: 'test-results/videos/',
        size: testConfig.viewport,
      };
    }

    // Add trace recording if enabled
    if (testConfig.recordTrace) {
      // Trace will be started after context creation
    }

    const context = await browser.newContext(contextOptions);

    // Start trace if enabled
    if (testConfig.recordTrace) {
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true,
      });
    }

    await use(context);

    // Stop trace if enabled
    if (testConfig.recordTrace) {
      await context.tracing.stop({
        path: `test-results/traces/${Date.now()}-trace.zip`,
      });
    }

    await context.close();
  },

  /**
   * Page fixture with setup and teardown lifecycle hooks
   */
  pageWithConfig: async ({ contextWithConfig, testConfig }, use, testInfo) => {
    const page = await contextWithConfig.newPage();

    // Configure page timeouts
    page.setDefaultTimeout(testConfig.actionTimeout || 10000);
    page.setDefaultNavigationTimeout(testConfig.navigationTimeout || 30000);

    // Setup console capture if enabled
    const consoleMessages: any[] = [];
    if (testConfig.consoleCapture) {
      page.on('console', (msg) => {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
          timestamp: new Date().toISOString(),
        });
      });
    }

    // Setup network capture if enabled
    const networkRequests: any[] = [];
    if (testConfig.networkCapture) {
      page.on('request', (request) => {
        networkRequests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          timestamp: new Date().toISOString(),
        });
      });
    }

    // Setup error handling
    page.on('pageerror', (error) => {
      console.error('Page error:', error.message);
    });

    page.on('requestfailed', (request) => {
      console.warn('Failed request:', request.url(), request.failure()?.errorText);
    });

    // Navigate to base URL if configured
    if (testConfig.baseURL) {
      await page.goto(testConfig.baseURL);
    }

    await use(page);

    // Cleanup logic
    if (testConfig.autoCleanup) {
      // Take screenshot on failure
      if (testInfo.status !== testInfo.expectedStatus && testConfig.screenshotMode !== 'off') {
        await page.screenshot({
          path: `test-results/screenshots/${testInfo.title}-failure.png`,
          fullPage: true,
        });
      }

      // Log captured console messages if any errors
      if (consoleMessages.length > 0 && testInfo.status !== testInfo.expectedStatus) {
        console.log('Console messages during test:', JSON.stringify(consoleMessages, null, 2));
      }

      // Log network requests if enabled and test failed
      if (networkRequests.length > 0 && testInfo.status !== testInfo.expectedStatus) {
        console.log('Network requests during test:', JSON.stringify(networkRequests, null, 2));
      }
    }

    await page.close();
  },

  /**
   * Clean browser context fixture - creates a fresh context for each test
   */
  cleanBrowserContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    await use(context);
    await context.close();
  },

  /**
   * Clean page fixture - creates a fresh page for each test
   */
  cleanPage: async ({ cleanBrowserContext }, use) => {
    const page = await cleanBrowserContext.newPage();
    await use(page);
    await page.close();
  },

  /**
   * Configurable page fixture - allows per-test configuration
   */
  configurablePage: async ({ browser }, use) => {
    const pages: Page[] = [];

    const createPage = async (config: PageFixtureConfig = {}) => {
      const mergedConfig = { ...DEFAULT_CONFIG, ...config };

      const contextOptions: BrowserContextOptions = {
        viewport: mergedConfig.viewport,
        locale: mergedConfig.locale,
        timezoneId: mergedConfig.timezone,
        geolocation: mergedConfig.geolocation,
        permissions: mergedConfig.permissions,
        userAgent: mergedConfig.userAgent,
        deviceScaleFactor: mergedConfig.deviceScaleFactor,
        hasTouch: mergedConfig.hasTouch,
        isMobile: mergedConfig.isMobile,
      };

      const context = await browser.newContext(contextOptions);
      const page = await context.newPage();

      // Configure timeouts
      page.setDefaultTimeout(mergedConfig.actionTimeout || 10000);
      page.setDefaultNavigationTimeout(mergedConfig.navigationTimeout || 30000);

      // Navigate to base URL if provided
      if (mergedConfig.baseURL) {
        await page.goto(mergedConfig.baseURL);
      }

      pages.push(page);
      return page;
    };

    await use(createPage);

    // Cleanup all created pages
    for (const page of pages) {
      await page.context().close();
    }
  },

  /**
   * Page fixture with console message capture
   */
  pageWithConsoleCapture: async ({ cleanBrowserContext }, use) => {
    const page = await cleanBrowserContext.newPage();
    const consoleMessages: any[] = [];

    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        args: msg.args(),
        timestamp: new Date().toISOString(),
      });
    });

    page.on('pageerror', (error) => {
      consoleMessages.push({
        type: 'error',
        text: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
    });

    await use({ page, consoleMessages });
    await page.close();
  },

  /**
   * Page fixture with network request capture
   */
  pageWithNetworkCapture: async ({ cleanBrowserContext }, use) => {
    const page = await cleanBrowserContext.newPage();
    const networkRequests: any[] = [];

    page.on('request', (request) => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData(),
        timestamp: new Date().toISOString(),
      });
    });

    page.on('response', (response) => {
      const matchingRequest = networkRequests.find(
        req => req.url === response.url() && req.timestamp
      );
      if (matchingRequest) {
        matchingRequest.status = response.status();
        matchingRequest.headers = { ...matchingRequest.headers, ...response.headers() };
        matchingRequest.responseTimestamp = new Date().toISOString();
      }
    });

    await use({ page, networkRequests });
    await page.close();
  },

  /**
   * Logged-in page fixture - combines authenticated browser state with Playwright page
   * This fixture integrates the core logged-in page fixture with a real browser page,
   * allowing tests to simulate authenticated user scenarios with actual browser automation.
   */
  loggedInPage: async ({ cleanBrowserContext }, use, testInfo) => {
    // Create the authenticated fixture
    const authFixture = createLoggedInPageFixture({
      userProfile: {
        id: `test-user-${testInfo.title?.replace(/\s+/g, '-').toLowerCase()}`,
        email: 'test-user@example.com',
        role: 'editor',
        displayName: 'Test User'
      },
      mockBrowserAutomation: false, // We're using real browser automation
      customLocalStorage: {
        'test-id': testInfo.testId || 'playwright-test',
        'test-name': testInfo.title || 'anonymous-test'
      }
    });

    // Initialize the authentication fixture
    await authFixture.beforeEach();

    // Create a new page
    const page = await cleanBrowserContext.newPage();

    // Get the authenticated browser state from the fixture
    const browserState = authFixture.getBrowserState();

    try {
      // Apply the authenticated state to the actual browser page

      // Set localStorage values
      if (browserState.localStorage) {
        await page.addInitScript((localStorageData) => {
          Object.entries(localStorageData).forEach(([key, value]) => {
            window.localStorage.setItem(key, value);
          });
        }, browserState.localStorage);
      }

      // Set sessionStorage values
      if (browserState.sessionStorage) {
        await page.addInitScript((sessionStorageData) => {
          Object.entries(sessionStorageData).forEach(([key, value]) => {
            window.sessionStorage.setItem(key, value);
          });
        }, browserState.sessionStorage);
      }

      // Set cookies
      if (browserState.cookies && browserState.cookies.length > 0) {
        for (const cookie of browserState.cookies) {
          await cleanBrowserContext.addCookies([{
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain || 'localhost',
            path: cookie.path || '/',
          }]);
        }
      }

      // Set up console message capture to sync with fixture
      page.on('console', (msg) => {
        authFixture.addConsoleMessage(
          msg.type() as 'log' | 'warn' | 'error' | 'info',
          msg.text()
        );
      });

      // Set up network request capture to sync with fixture
      page.on('request', (request) => {
        authFixture.addNetworkRequest(
          request.url(),
          request.method(),
          undefined, // Status not available on request
          request.headers()
        );
      });

      await use({ page, authFixture, browserState });

    } finally {
      await page.close();
      await authFixture.afterEach();
    }
  },
});

// Export expect for convenience
export { expect };

// Authentication test helpers
export * from './auth-helpers';

/**
 * Helper utility to create a test page with common elements
 */
export async function createTestPage(page: Page): Promise<void> {
  const testHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Page</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          background: #f5f5f5;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .button {
          background: #007acc;
          color: white;
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin: 5px;
        }
        .input {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin: 5px;
          width: 200px;
        }
        .output {
          background: #f9f9f9;
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
          min-height: 50px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Test Page</h1>
        <p>This is a test page for browser automation.</p>
        <button id="test-button" class="button">Click Me</button>
        <input id="test-input" class="input" type="text" placeholder="Type here" />
        <div id="output" class="output">Ready for testing</div>
      </div>
      <script>
        document.getElementById('test-button').addEventListener('click', function() {
          document.getElementById('output').textContent = 'Button clicked at ' + new Date().toISOString();
        });
        console.log('Test page loaded successfully');
      </script>
    </body>
    </html>
  `;

  await page.setContent(testHTML);
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Common viewport configurations
 */
export const VIEWPORT_CONFIGS = {
  desktop: { width: 1280, height: 720 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
  largeDesktop: { width: 1920, height: 1080 },
  smallMobile: { width: 320, height: 568 },
} as const;

/**
 * Common browser configurations
 */
export const BROWSER_CONFIGS = {
  headless: {
    headless: true,
    viewport: VIEWPORT_CONFIGS.desktop,
  },
  headed: {
    headless: false,
    viewport: VIEWPORT_CONFIGS.desktop,
  },
  mobile: {
    headless: true,
    viewport: VIEWPORT_CONFIGS.mobile,
    isMobile: true,
    hasTouch: true,
  },
  tablet: {
    headless: true,
    viewport: VIEWPORT_CONFIGS.tablet,
    hasTouch: true,
  },
  withTrace: {
    headless: true,
    viewport: VIEWPORT_CONFIGS.desktop,
    recordTrace: true,
  },
  withVideo: {
    headless: true,
    viewport: VIEWPORT_CONFIGS.desktop,
    recordVideo: true,
  },
} as const;

/**
 * Utility function to wait for element with custom timeout
 */
export async function waitForElement(
  page: Page,
  selector: string,
  options: { timeout?: number; visible?: boolean } = {}
): Promise<void> {
  const { timeout = 10000, visible = true } = options;

  await page.locator(selector).waitFor({
    state: visible ? 'visible' : 'attached',
    timeout,
  });
}

/**
 * Utility function to wait for page to be ready
 */
export async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
}

/**
 * Utility function to capture and validate console messages
 */
export async function captureConsoleMessages(
  page: Page,
  action: () => Promise<void>,
  expectedMessages: Array<{ type: string; text: string }>
): Promise<void> {
  const messages: any[] = [];

  const consoleHandler = (msg: any) => {
    messages.push({
      type: msg.type(),
      text: msg.text(),
    });
  };

  page.on('console', consoleHandler);

  try {
    await action();
    await page.waitForTimeout(100); // Wait for async console messages

    for (const expected of expectedMessages) {
      const found = messages.find(
        msg => msg.type === expected.type && msg.text.includes(expected.text)
      );

      if (!found) {
        throw new Error(
          `Expected console message "${expected.type}: ${expected.text}" not found. ` +
          `Captured: ${JSON.stringify(messages)}`
        );
      }
    }
  } finally {
    page.off('console', consoleHandler);
  }
}