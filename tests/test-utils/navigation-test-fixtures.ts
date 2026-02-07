/**
 * @fileoverview Navigation Test Fixtures for APEX
 *
 * This module provides test fixtures for browser context and page setup/teardown,
 * establishing patterns for test isolation and common navigation test scenarios.
 */

import { Browser, BrowserContext, Page } from 'playwright';
import { NavigationTestHelper, NavigationTestConfig } from './navigation-test-utils.js';
import { BrowserTestBase } from './browser-test-base.js';

/**
 * Test isolation options
 */
export interface TestIsolationOptions {
  /** Whether to use incognito context for each test */
  incognito?: boolean;
  /** Whether to clear cookies between tests */
  clearCookies?: boolean;
  /** Whether to clear localStorage between tests */
  clearLocalStorage?: boolean;
  /** Whether to clear sessionStorage between tests */
  clearSessionStorage?: boolean;
  /** Whether to capture network logs */
  captureNetworkLogs?: boolean;
  /** Whether to capture console logs */
  captureConsoleLogs?: boolean;
}

/**
 * Page fixture configuration
 */
export interface PageFixtureConfig {
  /** Initial URL to load */
  url?: string;
  /** HTML content to set (alternative to URL) */
  content?: string;
  /** Viewport size */
  viewport?: { width: number; height: number };
  /** User agent string */
  userAgent?: string;
  /** Locale setting */
  locale?: string;
  /** Timezone setting */
  timezone?: string;
  /** Whether to enable JavaScript */
  javaScriptEnabled?: boolean;
  /** Extra HTTP headers */
  extraHeaders?: Record<string, string>;
}

/**
 * Navigation test fixture that manages browser lifecycle
 */
export class NavigationTestFixture {
  private helper: NavigationTestHelper;
  private config: NavigationTestConfig;
  private isolationOptions: TestIsolationOptions;
  private networkLogs: Array<{ url: string; method: string; status?: number; timestamp: number }> = [];
  private consoleLogs: Array<{ type: string; text: string; timestamp: number }> = [];

  constructor(
    config: NavigationTestConfig = {},
    isolationOptions: TestIsolationOptions = {}
  ) {
    this.config = config;
    this.isolationOptions = {
      incognito: true,
      clearCookies: true,
      clearLocalStorage: true,
      clearSessionStorage: true,
      captureNetworkLogs: false,
      captureConsoleLogs: false,
      ...isolationOptions
    };

    this.helper = new NavigationTestHelper(this.config);
  }

  /**
   * Get the navigation test helper
   */
  get navigationHelper(): NavigationTestHelper {
    return this.helper;
  }

  /**
   * Get the current page
   */
  get page(): Page | undefined {
    return this.helper.page;
  }

  /**
   * Get captured network logs
   */
  get networkActivity(): Array<{ url: string; method: string; status?: number; timestamp: number }> {
    return [...this.networkLogs];
  }

  /**
   * Get captured console logs
   */
  get consoleActivity(): Array<{ type: string; text: string; timestamp: number }> {
    return [...this.consoleLogs];
  }

  /**
   * Set up the test fixture
   */
  async setup(): Promise<void> {
    await this.helper.setup();

    // Set up logging if enabled
    if (this.isolationOptions.captureNetworkLogs) {
      await this.setupNetworkLogging();
    }

    if (this.isolationOptions.captureConsoleLogs) {
      await this.setupConsoleLogging();
    }
  }

  /**
   * Clean up the test fixture
   */
  async teardown(): Promise<void> {
    await this.helper.teardown();
  }

  /**
   * Reset the test environment for a new test (test isolation)
   */
  async reset(): Promise<void> {
    if (!this.page) {
      throw new Error('Test fixture not set up. Call setup() first.');
    }

    // Clear various storage types if configured
    if (this.isolationOptions.clearLocalStorage || this.isolationOptions.clearSessionStorage) {
      await this.page.evaluate(({clearLocal, clearSession}) => {
        if (clearLocal) {
          localStorage.clear();
        }
        if (clearSession) {
          sessionStorage.clear();
        }
      }, {
        clearLocal: this.isolationOptions.clearLocalStorage,
        clearSession: this.isolationOptions.clearSessionStorage
      });
    }

    // Clear cookies if configured
    if (this.isolationOptions.clearCookies) {
      const context = this.page.context();
      await context.clearCookies();
    }

    // Clear logs
    this.networkLogs.length = 0;
    this.consoleLogs.length = 0;

    // Navigate to about:blank to reset page state
    await this.page.goto('about:blank');
  }

  /**
   * Create a fresh page with the specified configuration
   */
  async createPage(config: PageFixtureConfig = {}): Promise<Page> {
    const context = this.helper.browser.context.context;
    if (!context) {
      throw new Error('Browser context not available');
    }

    const page = await context.newPage();

    // Configure viewport if specified
    if (config.viewport) {
      await page.setViewportSize(config.viewport);
    }

    // Set user agent if specified
    if (config.userAgent) {
      await page.setExtraHTTPHeaders({ 'User-Agent': config.userAgent });
    }

    // Set extra headers if specified
    if (config.extraHeaders) {
      await page.setExtraHTTPHeaders(config.extraHeaders);
    }

    // Set locale if specified
    if (config.locale) {
      // Playwright doesn't have a direct setLocale method on page,
      // but we can set it via context
      console.warn('Locale setting should be done at context level during creation');
    }

    // Load initial content
    if (config.content) {
      await page.setContent(config.content);
    } else if (config.url) {
      await page.goto(config.url);
    }

    return page;
  }

  /**
   * Set up network request/response logging
   */
  private async setupNetworkLogging(): Promise<void> {
    if (!this.page) {
      throw new Error('Page not available for network logging setup');
    }

    this.page.on('request', (request) => {
      this.networkLogs.push({
        url: request.url(),
        method: request.method(),
        timestamp: Date.now(),
      });
    });

    this.page.on('response', (response) => {
      // Find the corresponding request log and update with status
      const requestLog = this.networkLogs
        .slice()
        .reverse()
        .find(log => log.url === response.url() && !log.status);

      if (requestLog) {
        requestLog.status = response.status();
      }
    });
  }

  /**
   * Set up console message logging
   */
  private async setupConsoleLogging(): Promise<void> {
    if (!this.page) {
      throw new Error('Page not available for console logging setup');
    }

    this.page.on('console', (message) => {
      this.consoleLogs.push({
        type: message.type(),
        text: message.text(),
        timestamp: Date.now(),
      });
    });
  }
}

/**
 * Factory for creating preconfigured navigation test fixtures
 */
export class NavigationTestFixtureFactory {
  /**
   * Create a fixture optimized for unit tests (fast, isolated)
   */
  static createUnitTestFixture(config?: NavigationTestConfig): NavigationTestFixture {
    return new NavigationTestFixture(
      {
        headless: true,
        slowMo: 0,
        timeout: 10000,
        captureFailureScreenshots: false,
        ...config
      },
      {
        incognito: true,
        clearCookies: true,
        clearLocalStorage: true,
        clearSessionStorage: true,
        captureNetworkLogs: false,
        captureConsoleLogs: false,
      }
    );
  }

  /**
   * Create a fixture optimized for integration tests (comprehensive logging)
   */
  static createIntegrationTestFixture(config?: NavigationTestConfig): NavigationTestFixture {
    return new NavigationTestFixture(
      {
        headless: true,
        timeout: 30000,
        captureFailureScreenshots: true,
        ...config
      },
      {
        incognito: true,
        clearCookies: true,
        clearLocalStorage: true,
        clearSessionStorage: true,
        captureNetworkLogs: true,
        captureConsoleLogs: true,
      }
    );
  }

  /**
   * Create a fixture optimized for debugging (visible, slow)
   */
  static createDebugFixture(config?: NavigationTestConfig): NavigationTestFixture {
    return new NavigationTestFixture(
      {
        headless: false,
        slowMo: 500,
        devtools: true,
        timeout: 60000,
        captureFailureScreenshots: true,
        ...config
      },
      {
        incognito: false,
        clearCookies: false,
        clearLocalStorage: false,
        clearSessionStorage: false,
        captureNetworkLogs: true,
        captureConsoleLogs: true,
      }
    );
  }

  /**
   * Create a fixture optimized for CI environments
   */
  static createCIFixture(config?: NavigationTestConfig): NavigationTestFixture {
    return new NavigationTestFixture(
      {
        headless: true,
        slowMo: 0,
        devtools: false,
        timeout: 30000,
        retries: 2,
        captureFailureScreenshots: false,
        ...config
      },
      {
        incognito: true,
        clearCookies: true,
        clearLocalStorage: true,
        clearSessionStorage: true,
        captureNetworkLogs: false,
        captureConsoleLogs: false,
      }
    );
  }

  /**
   * Create a fixture with custom configuration
   */
  static createCustomFixture(
    navigationConfig?: NavigationTestConfig,
    isolationOptions?: TestIsolationOptions
  ): NavigationTestFixture {
    return new NavigationTestFixture(navigationConfig, isolationOptions);
  }
}

/**
 * Test page templates for common scenarios
 */
export const TestPageTemplates = {
  /**
   * Simple HTML page for basic navigation tests
   */
  simple: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Simple Test Page</title>
    </head>
    <body>
      <h1>Test Page</h1>
      <p>This is a simple test page for navigation testing.</p>
      <a href="/next" id="next-link">Next Page</a>
    </body>
    </html>
  `,

  /**
   * Form page for testing form navigation and submission
   */
  form: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Form Test Page</title>
    </head>
    <body>
      <h1>Test Form</h1>
      <form id="test-form" action="/submit" method="POST">
        <label for="name">Name:</label>
        <input type="text" id="name" name="name" required>

        <label for="email">Email:</label>
        <input type="email" id="email" name="email" required>

        <button type="submit" id="submit-btn">Submit</button>
      </form>
      <div id="result"></div>
    </body>
    </html>
  `,

  /**
   * SPA-like page with JavaScript navigation
   */
  spa: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SPA Test Page</title>
    </head>
    <body>
      <nav>
        <button id="home-btn" onclick="navigate('home')">Home</button>
        <button id="about-btn" onclick="navigate('about')">About</button>
        <button id="contact-btn" onclick="navigate('contact')">Contact</button>
      </nav>

      <div id="content">
        <h1>Home Page</h1>
        <p>Welcome to the home page.</p>
      </div>

      <script>
        function navigate(page) {
          const content = document.getElementById('content');
          history.pushState({ page }, '', '/' + page);

          switch (page) {
            case 'home':
              content.innerHTML = '<h1>Home Page</h1><p>Welcome to the home page.</p>';
              break;
            case 'about':
              content.innerHTML = '<h1>About Page</h1><p>Learn more about us.</p>';
              break;
            case 'contact':
              content.innerHTML = '<h1>Contact Page</h1><p>Get in touch with us.</p>';
              break;
          }
        }

        window.addEventListener('popstate', (event) => {
          if (event.state && event.state.page) {
            navigate(event.state.page);
          }
        });
      </script>
    </body>
    </html>
  `,

  /**
   * Page with loading states for testing async navigation
   */
  loading: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Loading Test Page</title>
      <style>
        .loading { display: none; }
        .content { display: block; }
        .loaded .loading { display: block; }
        .loaded .content { display: none; }
      </style>
    </head>
    <body>
      <div class="loading">Loading...</div>
      <div class="content">
        <h1>Async Loading Page</h1>
        <button id="load-data" onclick="loadData()">Load Data</button>
        <div id="data"></div>
      </div>

      <script>
        async function loadData() {
          document.body.classList.add('loaded');

          // Simulate async loading
          await new Promise(resolve => setTimeout(resolve, 1000));

          document.getElementById('data').innerHTML = '<p>Data loaded successfully!</p>';
          document.body.classList.remove('loaded');
        }
      </script>
    </body>
    </html>
  `,
};

/**
 * Common test scenarios with pre-configured setups
 */
export const TestScenarios = {
  /**
   * Basic page navigation test scenario
   */
  async basicNavigation(fixture: NavigationTestFixture): Promise<void> {
    await fixture.reset();
    await fixture.createPage({
      content: TestPageTemplates.simple,
    });
  },

  /**
   * Form submission test scenario
   */
  async formSubmission(fixture: NavigationTestFixture): Promise<void> {
    await fixture.reset();
    await fixture.createPage({
      content: TestPageTemplates.form,
    });
  },

  /**
   * SPA navigation test scenario
   */
  async spaNavigation(fixture: NavigationTestFixture): Promise<void> {
    await fixture.reset();
    await fixture.createPage({
      content: TestPageTemplates.spa,
    });
  },

  /**
   * Async loading test scenario
   */
  async asyncLoading(fixture: NavigationTestFixture): Promise<void> {
    await fixture.reset();
    await fixture.createPage({
      content: TestPageTemplates.loading,
    });
  },
};

/**
 * Export all types and utilities
 */
export {
  TestIsolationOptions,
  PageFixtureConfig,
};