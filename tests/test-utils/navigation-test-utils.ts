/**
 * @fileoverview Navigation Test Utilities for APEX
 *
 * This module provides comprehensive navigation testing utilities including
 * helper functions for common navigation operations and test fixtures for
 * browser context and page setup/teardown.
 */

import { Page, BrowserContext, Browser, expect as playwrightExpect } from 'playwright';
import { BrowserTestBase, BrowserTestConfig } from './browser-test-base.js';
import { EventEmitter } from 'eventemitter3';

/**
 * Navigation test configuration options
 */
export interface NavigationTestConfig extends Partial<BrowserTestConfig> {
  /** Default timeout for navigation operations (ms) */
  navigationTimeout?: number;
  /** Whether to wait for network idle after navigation */
  waitForNetworkIdle?: boolean;
  /** Base URL for relative navigation */
  baseUrl?: string;
  /** Whether to capture screenshots on navigation failures */
  captureFailureScreenshots?: boolean;
}

/**
 * Navigation operation options
 */
export interface NavigationOptions {
  /** Timeout for this specific navigation (ms) */
  timeout?: number;
  /** Whether to wait for network idle */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  /** Whether to replace the current history entry */
  replace?: boolean;
  /** Referer header value */
  referer?: string;
}

/**
 * Page content assertion options
 */
export interface PageContentAssertion {
  /** Text content to check for */
  text?: string | RegExp;
  /** Element selector to check */
  selector?: string;
  /** Expected element count */
  count?: number;
  /** Whether element should be visible */
  visible?: boolean;
  /** Timeout for assertion */
  timeout?: number;
}

/**
 * URL assertion options
 */
export interface URLAssertion {
  /** Expected URL (string or regex) */
  url: string | RegExp;
  /** Whether to check only pathname */
  pathname?: boolean;
  /** Whether to ignore query parameters */
  ignoreQuery?: boolean;
  /** Whether to ignore hash fragment */
  ignoreHash?: boolean;
}

/**
 * Navigation test result
 */
export interface NavigationResult {
  /** Whether the navigation was successful */
  success: boolean;
  /** Final URL after navigation */
  finalUrl: string;
  /** Navigation duration in milliseconds */
  duration: number;
  /** Any error that occurred */
  error?: Error;
  /** Performance metrics */
  metrics?: {
    loadTime: number;
    domContentLoaded: number;
    networkRequests: number;
  };
}

/**
 * Navigation Test Helper Class
 * Provides higher-level navigation testing utilities built on top of BrowserTestBase
 */
export class NavigationTestHelper extends EventEmitter {
  private browserTest: BrowserTestBase;
  private config: NavigationTestConfig;

  constructor(config: NavigationTestConfig = {}) {
    super();

    this.config = {
      navigationTimeout: 30000,
      waitForNetworkIdle: true,
      captureFailureScreenshots: true,
      ...config
    };

    this.browserTest = new BrowserTestBase(this.config);
  }

  /**
   * Get the underlying browser test instance
   */
  get browser(): BrowserTestBase {
    return this.browserTest;
  }

  /**
   * Get the current page instance
   */
  get page(): Page | undefined {
    return this.browserTest.context.page;
  }

  /**
   * Initialize the navigation test environment
   */
  async setup(): Promise<void> {
    await this.browserTest.setup();
    this.emit('navigation-helper:setup-complete');
  }

  /**
   * Clean up the navigation test environment
   */
  async teardown(): Promise<void> {
    await this.browserTest.teardown();
    this.emit('navigation-helper:teardown-complete');
  }

  /**
   * Navigate to a URL with comprehensive error handling and metrics collection
   */
  async goto(url: string, options: NavigationOptions = {}): Promise<NavigationResult> {
    if (!this.page) {
      throw new Error('Navigation test not initialized. Call setup() first.');
    }

    const startTime = Date.now();
    const fullUrl = this.resolveUrl(url);

    try {
      this.emit('navigation:start', { url: fullUrl, options });

      const navigationOptions = {
        timeout: options.timeout || this.config.navigationTimeout,
        waitUntil: options.waitUntil || (this.config.waitForNetworkIdle ? 'networkidle' : 'load'),
        referer: options.referer,
      };

      const response = await this.page.goto(fullUrl, navigationOptions as any);

      if (!response) {
        throw new Error('Navigation response was null');
      }

      if (!response.ok()) {
        throw new Error(`Navigation failed with status: ${response.status()} ${response.statusText()}`);
      }

      const duration = Date.now() - startTime;
      const finalUrl = this.page.url();

      // Collect performance metrics
      const metrics = await this.collectPerformanceMetrics();

      const result: NavigationResult = {
        success: true,
        finalUrl,
        duration,
        metrics,
      };

      this.emit('navigation:success', { url: fullUrl, result });
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const result: NavigationResult = {
        success: false,
        finalUrl: this.page.url(),
        duration,
        error: error as Error,
      };

      this.emit('navigation:error', { url: fullUrl, error, result });

      // Capture failure screenshot if enabled
      if (this.config.captureFailureScreenshots) {
        try {
          await this.browserTest.takeScreenshot(`navigation-failure-${Date.now()}`);
        } catch (screenshotError) {
          console.warn('Failed to capture failure screenshot:', screenshotError);
        }
      }

      throw error;
    }
  }

  /**
   * Wait for navigation to complete with timeout and retry logic
   */
  async waitForNavigation(options: NavigationOptions = {}): Promise<NavigationResult> {
    if (!this.page) {
      throw new Error('Navigation test not initialized. Call setup() first.');
    }

    const startTime = Date.now();

    try {
      this.emit('navigation:wait-start', { options });

      const timeout = options.timeout || this.config.navigationTimeout;
      const waitUntil = options.waitUntil || (this.config.waitForNetworkIdle ? 'networkidle' : 'load');

      await this.page.waitForLoadState(waitUntil as any, { timeout });

      const duration = Date.now() - startTime;
      const finalUrl = this.page.url();
      const metrics = await this.collectPerformanceMetrics();

      const result: NavigationResult = {
        success: true,
        finalUrl,
        duration,
        metrics,
      };

      this.emit('navigation:wait-complete', { result });
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const result: NavigationResult = {
        success: false,
        finalUrl: this.page.url(),
        duration,
        error: error as Error,
      };

      this.emit('navigation:wait-error', { error, result });
      throw error;
    }
  }

  /**
   * Assert that the current URL matches the expected pattern
   */
  async assertURL(assertion: URLAssertion): Promise<void> {
    if (!this.page) {
      throw new Error('Navigation test not initialized. Call setup() first.');
    }

    const currentUrl = this.page.url();
    const url = new URL(currentUrl);

    let targetUrl: string;
    if (assertion.pathname) {
      targetUrl = url.pathname;
    } else if (assertion.ignoreQuery && assertion.ignoreHash) {
      targetUrl = `${url.protocol}//${url.host}${url.pathname}`;
    } else if (assertion.ignoreQuery) {
      targetUrl = `${url.protocol}//${url.host}${url.pathname}${url.hash}`;
    } else if (assertion.ignoreHash) {
      targetUrl = `${url.protocol}//${url.host}${url.pathname}${url.search}`;
    } else {
      targetUrl = currentUrl;
    }

    const matches = typeof assertion.url === 'string'
      ? targetUrl === assertion.url
      : assertion.url.test(targetUrl);

    if (!matches) {
      const message = `Expected URL ${typeof assertion.url === 'string' ? `"${assertion.url}"` : `to match ${assertion.url}`}, but got "${targetUrl}"`;
      this.emit('assertion:url-failed', { expected: assertion.url, actual: targetUrl, message });
      throw new Error(message);
    }

    this.emit('assertion:url-passed', { expected: assertion.url, actual: targetUrl });
  }

  /**
   * Assert that the page content matches the expected criteria
   */
  async assertPageContent(assertion: PageContentAssertion): Promise<void> {
    if (!this.page) {
      throw new Error('Navigation test not initialized. Call setup() first.');
    }

    const timeout = assertion.timeout || 10000;

    try {
      if (assertion.text) {
        if (typeof assertion.text === 'string') {
          await playwrightExpect(this.page.locator('body')).toContainText(assertion.text, { timeout });
        } else {
          // For regex, we need to check manually
          const bodyText = await this.page.locator('body').textContent();
          if (!bodyText || !assertion.text.test(bodyText)) {
            throw new Error(`Page content does not match regex: ${assertion.text}`);
          }
        }
        this.emit('assertion:content-text-passed', { text: assertion.text });
      }

      if (assertion.selector) {
        const element = this.page.locator(assertion.selector);

        if (assertion.count !== undefined) {
          await playwrightExpected(element).toHaveCount(assertion.count, { timeout });
          this.emit('assertion:content-count-passed', { selector: assertion.selector, count: assertion.count });
        }

        if (assertion.visible !== undefined) {
          if (assertion.visible) {
            await playwrightExpect(element.first()).toBeVisible({ timeout });
            this.emit('assertion:content-visible-passed', { selector: assertion.selector });
          } else {
            await playwrightExpected(element.first()).toBeHidden({ timeout });
            this.emit('assertion:content-hidden-passed', { selector: assertion.selector });
          }
        }
      }

    } catch (error) {
      this.emit('assertion:content-failed', { assertion, error });
      throw error;
    }
  }

  /**
   * Wait for an element to appear and optionally become visible
   */
  async waitForElement(selector: string, options: { visible?: boolean; timeout?: number } = {}): Promise<void> {
    if (!this.page) {
      throw new Error('Navigation test not initialized. Call setup() first.');
    }

    const timeout = options.timeout || 10000;
    const element = this.page.locator(selector);

    if (options.visible !== false) {
      await element.waitFor({ state: 'visible', timeout });
      this.emit('element:visible', { selector });
    } else {
      await element.waitFor({ state: 'attached', timeout });
      this.emit('element:attached', { selector });
    }
  }

  /**
   * Collect performance metrics from the current page
   */
  private async collectPerformanceMetrics(): Promise<NavigationResult['metrics']> {
    if (!this.page) return undefined;

    try {
      const metrics = await this.page.evaluate(() => {
        if (!window.performance) return null;

        const navigation = performance.getEntriesByType('navigation')[0] as any;
        const resources = performance.getEntriesByType('resource');

        if (!navigation) return null;

        return {
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          networkRequests: resources.length,
        };
      });

      return metrics || undefined;
    } catch (error) {
      console.warn('Failed to collect performance metrics:', error);
      return undefined;
    }
  }

  /**
   * Resolve relative URLs against the base URL
   */
  private resolveUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('about:')) {
      return url;
    }

    if (this.config.baseUrl) {
      return new URL(url, this.config.baseUrl).href;
    }

    return url;
  }
}

// Create alias for expect to avoid naming conflicts
const playwrightExpected = playwrightExpect;

/**
 * Convenience function to create a navigation test helper
 */
export function createNavigationTestHelper(config?: NavigationTestConfig): NavigationTestHelper {
  return new NavigationTestHelper(config);
}

/**
 * Quick setup functions for common navigation test scenarios
 */
export const NavigationTestSetup = {
  /**
   * Create a basic navigation test setup
   */
  async basic(config?: NavigationTestConfig): Promise<NavigationTestHelper> {
    const helper = new NavigationTestHelper(config);
    await helper.setup();
    return helper;
  },

  /**
   * Create a navigation test setup with a headless browser
   */
  async headless(config?: NavigationTestConfig): Promise<NavigationTestHelper> {
    const helper = new NavigationTestHelper({
      ...config,
      headless: true,
    });
    await helper.setup();
    return helper;
  },

  /**
   * Create a navigation test setup optimized for CI environments
   */
  async ci(config?: NavigationTestConfig): Promise<NavigationTestHelper> {
    const helper = new NavigationTestHelper({
      ...config,
      headless: true,
      slowMo: 0,
      devtools: false,
      captureFailureScreenshots: false,
    });
    await helper.setup();
    return helper;
  },

  /**
   * Create a navigation test setup with debugging features
   */
  async debug(config?: NavigationTestConfig): Promise<NavigationTestHelper> {
    const helper = new NavigationTestHelper({
      ...config,
      headless: false,
      slowMo: 500,
      devtools: true,
      captureFailureScreenshots: true,
    });
    await helper.setup();
    return helper;
  },
};

/**
 * Export all types and utilities
 */
export {
  NavigationTestConfig,
  NavigationOptions,
  PageContentAssertion,
  URLAssertion,
  NavigationResult,
};