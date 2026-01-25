/**
 * @fileoverview Base Browser Test Utilities for APEX
 *
 * This file provides shared browser testing utilities that can be used
 * across all packages in the APEX monorepo. It provides a consistent
 * interface for browser automation testing using both Playwright and Puppeteer.
 */

import { Browser, BrowserContext, Page } from 'playwright';
import { chromium, firefox, webkit } from 'playwright';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';

// Browser backend type
export type BrowserBackend = 'playwright' | 'puppeteer';
export type BrowserType = 'chromium' | 'firefox' | 'webkit';

// Test configuration interface
export interface BrowserTestConfig {
  backend: BrowserBackend;
  browserType: BrowserType;
  headless: boolean;
  viewport: { width: number; height: number };
  slowMo?: number;
  devtools?: boolean;
  timeout?: number;
  retries?: number;
}

// Default browser test configuration
export const DEFAULT_BROWSER_TEST_CONFIG: BrowserTestConfig = {
  backend: 'playwright',
  browserType: 'chromium',
  headless: process.env.CI === 'true' || process.env.BROWSER_TEST_HEADLESS === 'true',
  viewport: { width: 1280, height: 720 },
  slowMo: process.env.CI ? 0 : 100,
  devtools: !process.env.CI,
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
};

// Test context interface
export interface BrowserTestContext {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  tempDir?: string;
  screenshots: string[];
  config: BrowserTestConfig;
}

/**
 * Base Browser Test Class
 * Provides consistent browser testing interface across APEX packages
 */
export class BrowserTestBase extends EventEmitter {
  private _context: BrowserTestContext;

  constructor(config: Partial<BrowserTestConfig> = {}) {
    super();

    this._context = {
      screenshots: [],
      config: { ...DEFAULT_BROWSER_TEST_CONFIG, ...config },
    };
  }

  /**
   * Get the current test context
   */
  get context(): BrowserTestContext {
    return this._context;
  }

  /**
   * Initialize browser test environment
   */
  async setup(): Promise<void> {
    try {
      // Create temporary directory for test artifacts
      this._context.tempDir = await this.createTempDir();

      // Create browser instance
      this._context.browser = await this.createBrowser();

      // Create browser context
      this._context.context = await this.createBrowserContext();

      // Create page
      this._context.page = await this.createPage();

      this.emit('setup:complete', this._context);
    } catch (error) {
      this.emit('setup:error', error);
      throw new Error(`Browser test setup failed: ${error}`);
    }
  }

  /**
   * Clean up browser test environment
   */
  async teardown(): Promise<void> {
    try {
      // Close page
      if (this._context.page) {
        await this._context.page.close();
        this._context.page = undefined;
      }

      // Close browser context
      if (this._context.context) {
        await this._context.context.close();
        this._context.context = undefined;
      }

      // Close browser
      if (this._context.browser) {
        await this._context.browser.close();
        this._context.browser = undefined;
      }

      // Clean up temporary directory
      if (this._context.tempDir) {
        await this.cleanupTempDir(this._context.tempDir);
        this._context.tempDir = undefined;
      }

      this.emit('teardown:complete', this._context);
    } catch (error) {
      this.emit('teardown:error', error);
      console.warn('Browser test teardown failed:', error);
    }
  }

  /**
   * Create browser instance based on configuration
   */
  private async createBrowser(): Promise<Browser> {
    const { browserType, headless, slowMo, devtools } = this._context.config;

    let playwrightBrowser;
    switch (browserType) {
      case 'firefox':
        playwrightBrowser = firefox;
        break;
      case 'webkit':
        playwrightBrowser = webkit;
        break;
      case 'chromium':
      default:
        playwrightBrowser = chromium;
        break;
    }

    const browser = await playwrightBrowser.launch({
      headless,
      slowMo,
      devtools,
    });

    this.emit('browser:created', { browserType, browser });
    return browser;
  }

  /**
   * Create browser context with test configuration
   */
  private async createBrowserContext(): Promise<BrowserContext> {
    if (!this._context.browser) {
      throw new Error('Browser not initialized. Call setup() first.');
    }

    const { viewport } = this._context.config;

    const context = await this._context.browser.newContext({
      viewport,
      // Test-specific settings
      reducedMotion: 'reduce', // Disable animations for consistent testing
      timezoneId: 'UTC', // Consistent timezone
      locale: 'en-US', // Consistent locale
      // Security settings
      acceptDownloads: false, // Disable downloads in tests
      ignoreHTTPSErrors: true, // Handle self-signed certificates
    });

    this.emit('context:created', { context, viewport });
    return context;
  }

  /**
   * Create page with test configuration
   */
  private async createPage(): Promise<Page> {
    if (!this._context.context) {
      throw new Error('Browser context not initialized. Call setup() first.');
    }

    const { timeout } = this._context.config;
    const page = await this._context.context.newPage();

    // Set timeouts
    page.setDefaultTimeout(timeout || 30000);
    page.setDefaultNavigationTimeout(timeout || 30000);

    this.emit('page:created', { page, timeout });
    return page;
  }

  /**
   * Create temporary directory for test artifacts
   */
  private async createTempDir(): Promise<string> {
    const tempDir = await fs.mkdtemp(
      path.join(process.cwd(), 'test-artifacts', 'browser-temp-')
    );

    this.emit('tempdir:created', { tempDir });
    return tempDir;
  }

  /**
   * Clean up temporary directory
   */
  private async cleanupTempDir(tempDir: string): Promise<void> {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      this.emit('tempdir:cleaned', { tempDir });
    } catch (error) {
      this.emit('tempdir:cleanup-error', { tempDir, error });
      console.warn(`Failed to cleanup temp directory ${tempDir}:`, error);
    }
  }

  /**
   * Take a screenshot and save it to temp directory
   */
  async takeScreenshot(name: string, options: any = {}): Promise<string> {
    if (!this._context.page || !this._context.tempDir) {
      throw new Error('Browser not initialized. Call setup() first.');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    const filepath = path.join(this._context.tempDir, filename);

    await this._context.page.screenshot({
      path: filepath,
      fullPage: true,
      ...options,
    });

    this._context.screenshots.push(filepath);
    this.emit('screenshot:taken', { name, filepath });

    return filepath;
  }

  /**
   * Navigate to a URL with retry logic
   */
  async navigateTo(url: string, options: any = {}): Promise<void> {
    if (!this._context.page) {
      throw new Error('Browser not initialized. Call setup() first.');
    }

    const retries = this._context.config.retries || 0;
    const timeout = this._context.config.timeout || 30000;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        await this._context.page.goto(url, {
          timeout,
          waitUntil: 'networkidle',
          ...options,
        });

        this.emit('navigation:success', { url, attempt });
        return;
      } catch (error) {
        if (attempt === retries + 1) {
          this.emit('navigation:failed', { url, attempt, error });
          throw new Error(`Failed to navigate to ${url} after ${retries + 1} attempts: ${error}`);
        }

        this.emit('navigation:retry', { url, attempt, error });
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * Wait for an element to be visible with retry logic
   */
  async waitForElement(selector: string, options: any = {}): Promise<any> {
    if (!this._context.page) {
      throw new Error('Browser not initialized. Call setup() first.');
    }

    const timeout = options.timeout || this._context.config.timeout || 30000;

    try {
      const element = this._context.page.locator(selector);
      await element.waitFor({ state: 'visible', timeout });

      this.emit('element:found', { selector });
      return element;
    } catch (error) {
      this.emit('element:not-found', { selector, error });
      throw new Error(`Element not found: ${selector}. Error: ${error}`);
    }
  }

  /**
   * Get page performance metrics
   */
  async getPerformanceMetrics(): Promise<any> {
    if (!this._context.page) {
      throw new Error('Browser not initialized. Call setup() first.');
    }

    const metrics = await this._context.page.evaluate(() => {
      if (window.performance && window.performance.getEntriesByType) {
        const navigation = window.performance.getEntriesByType('navigation')[0] as any;
        return {
          domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
          loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
          firstPaint: navigation?.domContentLoadedEventStart - navigation?.fetchStart,
          timestamp: Date.now(),
        };
      }
      return null;
    });

    this.emit('performance:measured', metrics);
    return metrics;
  }

  /**
   * Execute JavaScript in the page context
   */
  async executeScript(script: string, ...args: any[]): Promise<any> {
    if (!this._context.page) {
      throw new Error('Browser not initialized. Call setup() first.');
    }

    try {
      const result = await this._context.page.evaluate(script, ...args);
      this.emit('script:executed', { script, result });
      return result;
    } catch (error) {
      this.emit('script:error', { script, error });
      throw new Error(`Script execution failed: ${error}`);
    }
  }

  /**
   * Capture console messages during execution
   */
  async captureConsoleMessages(action: () => Promise<void>): Promise<Array<{type: string, text: string, timestamp: number}>> {
    if (!this._context.page) {
      throw new Error('Browser not initialized. Call setup() first.');
    }

    const messages: Array<{type: string, text: string, timestamp: number}> = [];

    const consoleHandler = (msg: any) => {
      messages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now(),
      });
    };

    this._context.page.on('console', consoleHandler);

    try {
      await action();
    } finally {
      this._context.page.off('console', consoleHandler);
    }

    this.emit('console:captured', { messageCount: messages.length });
    return messages;
  }
}

/**
 * Create a browser test instance with configuration
 */
export function createBrowserTest(config?: Partial<BrowserTestConfig>): BrowserTestBase {
  return new BrowserTestBase(config);
}

/**
 * Browser test utility functions
 */
export const BrowserTestUtils = {
  /**
   * Create a test page with common test elements
   */
  async createTestPage(browserTest: BrowserTestBase): Promise<void> {
    if (!browserTest.context.page) {
      throw new Error('Page not initialized');
    }

    const testHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>APEX Browser Test Page</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
          .button { background: #007acc; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
          #output { margin-top: 20px; padding: 10px; background: #f0f0f0; border-radius: 4px; min-height: 100px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>APEX Browser Test Page</h1>
          <button class="button" id="test-button" onclick="showMessage()">Test Button</button>
          <input type="text" id="test-input" placeholder="Test input" />
          <div id="output">Ready for testing...</div>
        </div>
        <script>
          function showMessage() {
            document.getElementById('output').innerHTML = 'Button clicked at ' + new Date().toISOString();
          }
          console.log('Test page loaded successfully');
        </script>
      </body>
      </html>
    `;

    await browserTest.context.page.setContent(testHTML);
    await browserTest.context.page.waitForLoadState('domcontentloaded');
  },

  /**
   * Wait for network to be idle
   */
  async waitForNetworkIdle(browserTest: BrowserTestBase, timeout: number = 30000): Promise<void> {
    if (!browserTest.context.page) {
      throw new Error('Page not initialized');
    }

    await browserTest.context.page.waitForLoadState('networkidle', { timeout });
  },

  /**
   * Get browser info
   */
  getBrowserInfo(browserTest: BrowserTestBase): any {
    return {
      backend: browserTest.context.config.backend,
      browserType: browserTest.context.config.browserType,
      headless: browserTest.context.config.headless,
      viewport: browserTest.context.config.viewport,
    };
  },
};

// Export types and classes
export { BrowserTestConfig, BrowserTestContext, BrowserBackend, BrowserType };