/**
 * @fileoverview Browser Context and Page Fixtures for APEX Testing
 *
 * This module provides reusable browser fixtures with proper lifecycle management
 * for setting up and tearing down browser contexts and pages across different test scenarios.
 *
 * Features:
 * - Reusable browser context and page fixtures
 * - Proper setup and teardown lifecycle hooks
 * - Configuration options (headless mode, viewport, etc.)
 * - Error handling and cleanup
 * - Support for multiple browser types (Chromium, Firefox, Safari)
 * - Screenshot capture for debugging
 * - Performance monitoring and metrics
 *
 * @module tests/test-utils/browser-fixtures
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import type { Browser, BrowserContext, Page, BrowserType as PlaywrightBrowserType } from 'playwright';
import { chromium, firefox, webkit } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Browser type enumeration
 */
export type BrowserType = 'chromium' | 'firefox' | 'webkit';

/**
 * Viewport configuration
 */
export interface ViewportConfig {
  width: number;
  height: number;
}

/**
 * Browser fixture configuration
 */
export interface BrowserFixtureConfig {
  /** Browser type to use */
  browserType: BrowserType;
  /** Run in headless mode */
  headless: boolean;
  /** Viewport dimensions */
  viewport: ViewportConfig;
  /** Slow down operations for debugging (milliseconds) */
  slowMo?: number;
  /** Enable devtools */
  devtools?: boolean;
  /** Default timeout for operations */
  timeout: number;
  /** Number of retries for failed operations */
  retries: number;
  /** Capture screenshots on failure */
  captureFailureScreenshots: boolean;
  /** Directory for test artifacts */
  artifactDir: string;
  /** Enable video recording */
  recordVideo: boolean;
  /** Enable trace collection */
  trace: boolean;
  /** Additional browser launch options */
  launchOptions?: Record<string, any>;
  /** Additional context options */
  contextOptions?: Record<string, any>;
}

/**
 * Default fixture configuration
 */
export const DEFAULT_BROWSER_CONFIG: BrowserFixtureConfig = {
  browserType: 'chromium',
  headless: process.env.CI === 'true' || process.env.HEADLESS === 'true',
  viewport: { width: 1280, height: 720 },
  slowMo: process.env.CI ? 0 : 50,
  devtools: !process.env.CI && process.env.DEVTOOLS === 'true',
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  captureFailureScreenshots: true,
  artifactDir: path.join(process.cwd(), 'test-artifacts', 'browser-fixtures'),
  recordVideo: process.env.RECORD_VIDEO === 'true',
  trace: process.env.TRACE === 'true',
};

// ============================================================================
// Browser Fixture Class
// ============================================================================

/**
 * Browser fixture instance for managing browser lifecycle
 */
export class BrowserFixture extends EventEmitter {
  private config: BrowserFixtureConfig;
  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;
  private artifactDir?: string;
  private screenshots: string[] = [];
  private isSetup = false;
  private teardownCallbacks: (() => Promise<void>)[] = [];

  constructor(config: Partial<BrowserFixtureConfig> = {}) {
    super();
    this.config = { ...DEFAULT_BROWSER_CONFIG, ...config };
  }

  /**
   * Get the current configuration
   */
  getConfig(): Readonly<BrowserFixtureConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration (only allowed before setup)
   */
  updateConfig(config: Partial<BrowserFixtureConfig>): void {
    if (this.isSetup) {
      throw new Error('Cannot update configuration after setup. Create a new fixture instance.');
    }
    this.config = { ...this.config, ...config };
  }

  /**
   * Setup the browser fixture
   */
  async setup(): Promise<void> {
    if (this.isSetup) {
      throw new Error('Browser fixture already set up');
    }

    try {
      // Create artifact directory
      this.artifactDir = await this.createArtifactDirectory();

      // Launch browser
      this.browser = await this.launchBrowser();
      this.teardownCallbacks.push(() => this.browser!.close());

      // Create context
      this.context = await this.createBrowserContext();
      this.teardownCallbacks.push(() => this.context!.close());

      // Create page
      this.page = await this.createPage();

      // Setup page handlers
      await this.setupPageHandlers();

      this.isSetup = true;
      this.emit('fixture:setup', {
        browserType: this.config.browserType,
        viewport: this.config.viewport,
        artifactDir: this.artifactDir
      });

    } catch (error) {
      await this.teardown(); // Cleanup partial setup
      this.emit('fixture:setup-error', error);
      throw new Error(`Browser fixture setup failed: ${error}`);
    }
  }

  /**
   * Teardown the browser fixture
   */
  async teardown(): Promise<void> {
    // Run teardown callbacks in reverse order
    for (let i = this.teardownCallbacks.length - 1; i >= 0; i--) {
      try {
        await this.teardownCallbacks[i]();
      } catch (error) {
        console.warn('Teardown callback failed:', error);
      }
    }

    this.teardownCallbacks = [];
    this.browser = undefined;
    this.context = undefined;
    this.page = undefined;
    this.isSetup = false;

    this.emit('fixture:teardown');
  }

  /**
   * Get the browser instance
   */
  getBrowser(): Browser {
    if (!this.browser) {
      throw new Error('Browser fixture not set up. Call setup() first.');
    }
    return this.browser;
  }

  /**
   * Get the browser context
   */
  getContext(): BrowserContext {
    if (!this.context) {
      throw new Error('Browser fixture not set up. Call setup() first.');
    }
    return this.context;
  }

  /**
   * Get the page instance
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser fixture not set up. Call setup() first.');
    }
    return this.page;
  }

  /**
   * Get artifact directory
   */
  getArtifactDir(): string {
    if (!this.artifactDir) {
      throw new Error('Browser fixture not set up. Call setup() first.');
    }
    return this.artifactDir;
  }

  /**
   * Create a new page instance
   */
  async createNewPage(): Promise<Page> {
    const context = this.getContext();
    const page = await context.newPage();
    page.setDefaultTimeout(this.config.timeout);
    return page;
  }

  /**
   * Take a screenshot
   */
  async screenshot(name: string, options: any = {}): Promise<string> {
    const page = this.getPage();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    const filepath = path.join(this.getArtifactDir(), 'screenshots', filename);

    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await page.screenshot({
      path: filepath,
      fullPage: true,
      ...options
    });

    this.screenshots.push(filepath);
    this.emit('screenshot:taken', { name, filepath });
    return filepath;
  }

  /**
   * Navigate to URL with error handling and retries
   */
  async navigateTo(url: string, options: any = {}): Promise<void> {
    const page = this.getPage();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        await page.goto(url, {
          timeout: this.config.timeout,
          waitUntil: 'domcontentloaded',
          ...options
        });

        this.emit('navigation:success', { url, attempt });
        return;
      } catch (error) {
        lastError = error as Error;
        this.emit('navigation:retry', { url, attempt, error });

        if (attempt < this.config.retries) {
          await this.wait(1000 * (attempt + 1)); // Exponential backoff
        }
      }
    }

    throw new Error(`Failed to navigate to ${url} after ${this.config.retries + 1} attempts: ${lastError?.message}`);
  }

  /**
   * Wait for a specified amount of time
   */
  async wait(milliseconds: number): Promise<void> {
    const page = this.getPage();
    await page.waitForTimeout(milliseconds);
  }

  /**
   * Wait for an element to be visible
   */
  async waitForElement(selector: string, options: { timeout?: number } = {}): Promise<any> {
    const page = this.getPage();
    const timeout = options.timeout || this.config.timeout;

    const element = page.locator(selector);
    await element.waitFor({ state: 'visible', timeout });

    this.emit('element:found', { selector });
    return element;
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<any> {
    const page = this.getPage();

    const metrics = await page.evaluate(() => {
      if (!window.performance || !window.performance.getEntriesByType) {
        return null;
      }

      const navigation = window.performance.getEntriesByType('navigation')[0] as any;
      return {
        domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
        loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
        firstPaint: navigation?.domContentLoadedEventStart - navigation?.fetchStart,
        timestamp: Date.now(),
      };
    });

    this.emit('performance:measured', metrics);
    return metrics;
  }

  /**
   * Launch browser based on configuration
   */
  private async launchBrowser(): Promise<Browser> {
    const { browserType, headless, slowMo, devtools, launchOptions } = this.config;

    let playwrightBrowser: PlaywrightBrowserType;
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
      ...launchOptions,
    });

    this.emit('browser:launched', { browserType });
    return browser;
  }

  /**
   * Create browser context with configuration
   */
  private async createBrowserContext(): Promise<BrowserContext> {
    if (!this.browser || !this.artifactDir) {
      throw new Error('Browser not ready for context creation');
    }

    const { viewport, recordVideo, trace, contextOptions } = this.config;

    const context = await this.browser.newContext({
      viewport,
      // Video recording
      recordVideo: recordVideo ? {
        dir: path.join(this.artifactDir, 'videos'),
        size: viewport,
      } : undefined,
      // Standard test settings
      reducedMotion: 'reduce',
      timezoneId: 'UTC',
      locale: 'en-US',
      acceptDownloads: false,
      ignoreHTTPSErrors: true,
      ...contextOptions,
    });

    // Start tracing if enabled
    if (trace) {
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true,
      });

      this.teardownCallbacks.push(async () => {
        const tracePath = path.join(this.artifactDir!, 'traces', 'trace.zip');
        await fs.mkdir(path.dirname(tracePath), { recursive: true });
        await context.tracing.stop({ path: tracePath });
      });
    }

    this.emit('context:created', { viewport });
    return context;
  }

  /**
   * Create page with configuration
   */
  private async createPage(): Promise<Page> {
    if (!this.context) {
      throw new Error('Browser context not available');
    }

    const page = await this.context.newPage();
    page.setDefaultTimeout(this.config.timeout);

    this.emit('page:created');
    return page;
  }

  /**
   * Setup page event handlers
   */
  private async setupPageHandlers(): Promise<void> {
    if (!this.page) return;

    // Handle console messages
    this.page.on('console', (msg) => {
      this.emit('console', {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: Date.now(),
      });
    });

    // Handle page errors
    this.page.on('pageerror', (error) => {
      this.emit('page-error', {
        message: error.message,
        stack: error.stack,
        timestamp: Date.now(),
      });
    });

    // Handle request failures
    this.page.on('requestfailed', (request) => {
      this.emit('request-failed', {
        url: request.url(),
        method: request.method(),
        failure: request.failure()?.errorText,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Create artifact directory
   */
  private async createArtifactDirectory(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const artifactDir = path.join(this.config.artifactDir, `test-${timestamp}`);

    await fs.mkdir(artifactDir, { recursive: true });
    await fs.mkdir(path.join(artifactDir, 'screenshots'), { recursive: true });
    await fs.mkdir(path.join(artifactDir, 'videos'), { recursive: true });
    await fs.mkdir(path.join(artifactDir, 'traces'), { recursive: true });

    return artifactDir;
  }
}

// ============================================================================
// Vitest Integration Functions
// ============================================================================

/**
 * Global browser fixture instance
 */
let globalBrowserFixture: BrowserFixture | undefined;

/**
 * Setup global browser fixture for Vitest tests
 *
 * @example
 * ```typescript
 * // In your test setup file or test file
 * setupBrowserFixture({
 *   browserType: 'chromium',
 *   headless: true,
 *   viewport: { width: 1920, height: 1080 }
 * });
 * ```
 */
export function setupBrowserFixture(config?: Partial<BrowserFixtureConfig>): void {
  beforeAll(async () => {
    globalBrowserFixture = new BrowserFixture(config);
    await globalBrowserFixture.setup();
  }, 60000); // Extended timeout for browser setup

  afterAll(async () => {
    if (globalBrowserFixture) {
      await globalBrowserFixture.teardown();
      globalBrowserFixture = undefined;
    }
  }, 30000); // Extended timeout for teardown

  beforeEach(async () => {
    if (globalBrowserFixture) {
      // Clear any existing page state
      const page = globalBrowserFixture.getPage();
      try {
        await page.evaluate(() => {
          // Clear localStorage and sessionStorage
          if (typeof window !== 'undefined') {
            window.localStorage?.clear();
            window.sessionStorage?.clear();
          }
        });
      } catch (error) {
        // Ignore errors if not in browser context
      }
    }
  });

  afterEach(async (context) => {
    if (globalBrowserFixture && globalBrowserFixture.config.captureFailureScreenshots) {
      // Capture screenshot on test failure
      if (context?.meta?.result?.state === 'fail') {
        try {
          const testName = context.meta?.name || 'failed-test';
          await globalBrowserFixture.screenshot(`failure-${testName}`);
        } catch (error) {
          console.warn('Failed to capture failure screenshot:', error);
        }
      }
    }
  });
}

/**
 * Get the global browser fixture
 *
 * @example
 * ```typescript
 * test('should interact with page', async () => {
 *   const fixture = getBrowserFixture();
 *   const page = fixture.getPage();
 *
 *   await fixture.navigateTo('http://localhost:3000');
 *   await page.click('#my-button');
 *
 *   const result = await page.textContent('#result');
 *   expect(result).toBe('Success');
 * });
 * ```
 */
export function getBrowserFixture(): BrowserFixture {
  if (!globalBrowserFixture) {
    throw new Error('Browser fixture not initialized. Call setupBrowserFixture() in beforeAll hook.');
  }
  return globalBrowserFixture;
}

/**
 * Create a scoped browser fixture for isolated tests
 *
 * @example
 * ```typescript
 * test('isolated browser test', async () => {
 *   const fixture = await createScopedBrowserFixture({
 *     browserType: 'firefox',
 *     headless: false
 *   });
 *
 *   try {
 *     const page = fixture.getPage();
 *     await fixture.navigateTo('http://example.com');
 *     // ... test code
 *   } finally {
 *     await fixture.teardown();
 *   }
 * });
 * ```
 */
export async function createScopedBrowserFixture(
  config?: Partial<BrowserFixtureConfig>
): Promise<BrowserFixture> {
  const fixture = new BrowserFixture(config);
  await fixture.setup();
  return fixture;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Load HTML content into a page
 */
export async function loadPageContent(fixture: BrowserFixture, html: string): Promise<void> {
  const page = fixture.getPage();
  await page.setContent(html);
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(
  fixture: BrowserFixture,
  options: { timeout?: number; idleTime?: number } = {}
): Promise<void> {
  const page = fixture.getPage();
  await page.waitForLoadState('networkidle', {
    timeout: options.timeout || fixture.getConfig().timeout
  });
}

/**
 * Test page utilities
 */
export const PageUtils = {
  /**
   * Create a simple test page
   */
  createSimpleTestPage(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Page</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .btn { padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; }
          .btn-primary { background: #007acc; color: white; }
          #result { margin-top: 20px; padding: 10px; background: #f5f5f5; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Test Page</h1>
        <button id="test-btn" class="btn btn-primary" onclick="showResult()">Click Me</button>
        <input id="test-input" type="text" placeholder="Enter text">
        <div id="result">Ready for testing</div>

        <script>
          function showResult() {
            const input = document.getElementById('test-input');
            const result = document.getElementById('result');
            result.textContent = \`Button clicked! Input: \${input.value || 'empty'}\`;
          }
        </script>
      </body>
      </html>
    `;
  },

  /**
   * Create a form test page
   */
  createFormTestPage(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Form Test Page</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .form-group { margin: 15px 0; }
          label { display: block; margin-bottom: 5px; font-weight: bold; }
          input, select, textarea { width: 300px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
          .btn { padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; }
          #form-result { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Form Test Page</h1>
        <form id="test-form">
          <div class="form-group">
            <label for="name">Name:</label>
            <input type="text" id="name" name="name" required>
          </div>

          <div class="form-group">
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required>
          </div>

          <div class="form-group">
            <label for="category">Category:</label>
            <select id="category" name="category">
              <option value="">Select a category</option>
              <option value="general">General</option>
              <option value="support">Support</option>
              <option value="sales">Sales</option>
            </select>
          </div>

          <div class="form-group">
            <label for="message">Message:</label>
            <textarea id="message" name="message" rows="4"></textarea>
          </div>

          <button type="submit" class="btn">Submit</button>
        </form>

        <div id="form-result">Form not submitted yet</div>

        <script>
          document.getElementById('test-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            document.getElementById('form-result').innerHTML =
              '<h3>Form Submitted!</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
          });
        </script>
      </body>
      </html>
    `;
  }
};

// ============================================================================
// Mock Support
// ============================================================================

/**
 * Mock browser fixtures for unit testing
 */
export function mockBrowserFixtures(): void {
  vi.mock('./browser-fixtures', () => ({
    BrowserFixture: vi.fn().mockImplementation(() => ({
      setup: vi.fn().mockResolvedValue(undefined),
      teardown: vi.fn().mockResolvedValue(undefined),
      getBrowser: vi.fn().mockReturnValue({}),
      getContext: vi.fn().mockReturnValue({}),
      getPage: vi.fn().mockReturnValue({
        goto: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockResolvedValue(undefined),
        fill: vi.fn().mockResolvedValue(undefined),
        screenshot: vi.fn().mockResolvedValue(undefined),
        setContent: vi.fn().mockResolvedValue(undefined),
        waitForLoadState: vi.fn().mockResolvedValue(undefined),
      }),
      navigateTo: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue('/tmp/test-screenshot.png'),
    })),
    setupBrowserFixture: vi.fn(),
    getBrowserFixture: vi.fn().mockReturnValue({
      getPage: vi.fn().mockReturnValue({}),
    }),
  }));
}

// ============================================================================
// Exports
// ============================================================================

export type {
  BrowserFixtureConfig,
  ViewportConfig,
  BrowserType,
};

export {
  DEFAULT_BROWSER_CONFIG,
};