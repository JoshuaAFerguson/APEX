/**
 * @apexcli/browser - Browser Session
 *
 * Browser session manager for handling browser automation with lifecycle management
 */

import { EventEmitter } from 'eventemitter3';
import type { Browser, BrowserContext, Page } from 'playwright';

import type {
  BrowserSessionConfig,
  BrowserActionResult,
  NavigationOptions,
  WaitForNavigationOptions,
  ScreenshotOptions,
  ScreenshotCaptureOptions,
  ElementScreenshotOptions,
  ElementSelector,
  CaptureConfig,
  CapturedConsoleMessage,
  CapturedJavaScriptError,
  PageErrorEvent,
  BrowserCaptureEvents,
  ConsoleLogLevel,
} from './types.js';

// Import lifecycle types from core
import type {
  BrowserLifecycleState,
  BrowserLifecycleAware,
  BrowserResourceState,
} from '@apexcli/core';

import {
  defaultBrowserConfig,
  defaultCaptureConfig,
  ERROR_MESSAGES,
  BROWSER_LIMITS,
} from './constants.js';

import { BrowserManager } from './browser-manager.js';

// Extend Window interface for custom capture properties
declare global {
  interface Window {
    __apexErrorCapture?: Array<{
      message: string;
      name?: string;
      stack?: string;
      timestamp: number;
      uncaught: boolean;
      filename?: string;
      lineno?: number;
      colno?: number;
    }>;
    __apexConsoleCapture?: Array<{
      level: string;
      text: string;
      args: unknown[];
      timestamp: number;
      stack?: string;
    }>;
  }
}

/**
 * Browser session manager for handling browser automation
 *
 * Provides a high-level interface for browser automation with:
 * - Page management and navigation
 * - Element interaction (click, type, scroll)
 * - Screenshot capture
 * - Console and error monitoring
 * - Resource cleanup
 * - Lifecycle state tracking for resource management
 *
 * @fires BrowserSession#consoleMessage - When a console message is captured
 * @fires BrowserSession#javascriptError - When a JavaScript error is captured
 * @fires BrowserSession#pageError - When a page error occurs
 *
 * @example
 * ```typescript
 * const manager = new BrowserManager();
 * const session = new BrowserSession(manager, {
 *   browserType: 'chromium',
 *   headless: false
 * }, {
 *   captureConsole: true,
 *   captureErrors: true
 * });
 *
 * session.on('consoleMessage', (msg) => {
 *   console.log(`Console ${msg.type}: ${msg.text}`);
 * });
 *
 * await session.launch();
 * await session.navigate('https://example.com');
 * ```
 */
export class BrowserSession extends EventEmitter<BrowserCaptureEvents> implements BrowserLifecycleAware {
  private manager: BrowserManager;
  private instanceId?: string;
  private contextId?: string;
  private page?: Page;
  private config: BrowserSessionConfig;
  private captureConfig: CaptureConfig;
  private consoleBuffer: CapturedConsoleMessage[] = [];
  private errorBuffer: CapturedJavaScriptError[] = [];
  private pageErrorBuffer: PageErrorEvent[] = [];
  private errorPollingInterval?: NodeJS.Timeout;

  /** The current lifecycle state of the browser session */
  public state: BrowserLifecycleState = 'idle';

  /** Unique session identifier for resource tracking */
  private sessionId: string = this.generateSessionId();

  /**
   * Creates a new BrowserSession instance
   *
   * @param manager - Browser manager to use for creating browser instances
   * @param config - Partial session configuration to override defaults
   * @param captureConfig - Partial capture configuration for monitoring
   *
   * @example
   * ```typescript
   * const session = new BrowserSession(manager, {
   *   browserType: 'firefox',
   *   viewport: { width: 1920, height: 1080 },
   *   timeout: 60000
   * }, {
   *   captureConsole: true,
   *   captureErrors: true,
   *   maxBufferSize: 1000
   * });
   * ```
   */
  constructor(
    manager: BrowserManager,
    config: Partial<BrowserSessionConfig> = {},
    captureConfig: Partial<CaptureConfig> = {}
  ) {
    super();
    this.manager = manager;
    this.config = { ...defaultBrowserConfig, ...config };
    this.captureConfig = { ...defaultCaptureConfig, ...captureConfig };
  }

  /**
   * Check whether the browser session is currently active and available for operations.
   *
   * @returns true if the browser state is 'active'
   */
  public isActive(): boolean {
    return this.state === 'active';
  }

  /**
   * Get the current resource state of the browser session
   *
   * @returns The current resource state for tracking purposes
   */
  public getResourceState(): BrowserResourceState {
    return {
      browserActive: !!this.instanceId,
      contextActive: !!this.contextId,
      pageActive: !!this.page,
      currentUrl: this.page?.url(),
      lastAllocation: this.page ? new Date() : undefined,
      sessionId: this.sessionId,
      activeOperations: 0, // This could be tracked more granularly in future
      lifecycleState: this.state,
    };
  }

  /**
   * Generate a unique session identifier
   *
   * @returns A unique session ID string
   */
  private generateSessionId(): string {
    return `browser-session-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Launches browser session and creates a new page
   *
   * Performs the complete browser session initialization:
   * - Launches browser instance via manager
   * - Creates isolated browser context
   * - Creates a new page
   * - Sets up console and error capture monitoring
   *
   * @returns Promise resolving to success status or error
   *
   * @throws Will return error result if browser launch fails
   * @throws Will return error result if context creation fails
   * @throws Will return error result if page creation fails
   *
   * @example
   * ```typescript
   * const result = await session.launch();
   * if (result.success) {
   *   console.log('Browser session ready');
   *   await session.navigate('https://example.com');
   * } else {
   *   console.error(`Launch failed: ${result.error}`);
   * }
   * ```
   */
  async launch(): Promise<BrowserActionResult<void>> {
    const startTime = Date.now();

    try {
      // Update lifecycle state to launching
      this.state = 'launching';

      // Launch browser instance
      const instanceResult = await this.manager.launchBrowser(this.config);
      if (!instanceResult.success) {
        return {
          success: false,
          error: instanceResult.error,
          duration: Date.now() - startTime,
        };
      }

      this.instanceId = instanceResult.data!.id;

      // Create browser context
      const contextResult = await this.manager.createContext(this.instanceId, this.config);
      if (!contextResult.success) {
        return {
          success: false,
          error: contextResult.error,
          duration: Date.now() - startTime,
        };
      }

      this.contextId = contextResult.data!.id;

      // Get context and create page
      const context = this.manager.getContext(this.contextId);
      if (!context) {
        return {
          success: false,
          error: ERROR_MESSAGES.CONTEXT_NOT_CREATED,
          duration: Date.now() - startTime,
        };
      }

      this.page = await context.newPage();

      // Set up console and error capture
      await this.setupCapture();

      // Update lifecycle state to active when fully ready
      this.state = 'active';

      return {
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Navigates to a URL
   *
   * Navigates the browser page to the specified URL and waits for page load.
   * Returns the final URL after any redirects.
   *
   * @param url - Target URL to navigate to
   * @param options - Navigation options (timeout, waitUntil, referer)
   * @returns Promise resolving to final URL or error
   *
   * @throws Will return error result if browser not launched
   * @throws Will return error result if navigation fails or times out
   *
   * @example
   * ```typescript
   * const result = await session.navigate('https://example.com', {
   *   timeout: 30000,
   *   waitUntil: 'networkidle'
   * });
   *
   * if (result.success) {
   *   console.log(`Navigated to: ${result.data}`);
   * }
   * ```
   */
  async navigate(url: string, options: NavigationOptions = {}): Promise<BrowserActionResult<string>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      await this.page.goto(url, {
        timeout: options.timeout || this.config.timeout,
        waitUntil: options.waitUntil,
        referer: options.referer,
      });

      const finalUrl = this.page.url();
      return {
        success: true,
        data: finalUrl,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Navigates to a URL (alias for navigate)
   */
  async goto(url: string, options: NavigationOptions = {}): Promise<BrowserActionResult<string>> {
    return this.navigate(url, options);
  }

  /**
   * Reloads the current page
   */
  async reload(options: NavigationOptions = {}): Promise<BrowserActionResult<string>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      await this.page.reload({
        timeout: options.timeout || this.config.timeout,
        waitUntil: options.waitUntil,
      });

      return {
        success: true,
        data: this.page.url(),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Navigates back in browser history
   */
  async goBack(options: NavigationOptions = {}): Promise<BrowserActionResult<string | null>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      const response = await this.page.goBack({
        timeout: options.timeout || this.config.timeout,
        waitUntil: options.waitUntil,
      });

      // response is null if there was no previous page
      return {
        success: true,
        data: response ? this.page.url() : null,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Navigates forward in browser history
   */
  async goForward(options: NavigationOptions = {}): Promise<BrowserActionResult<string | null>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      const response = await this.page.goForward({
        timeout: options.timeout || this.config.timeout,
        waitUntil: options.waitUntil,
      });

      // response is null if there was no next page
      return {
        success: true,
        data: response ? this.page.url() : null,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Waits for navigation to complete
   */
  async waitForNavigation(options: WaitForNavigationOptions = {}): Promise<BrowserActionResult<string>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      await this.page.waitForURL(options.url || '**/*', {
        timeout: options.timeout || this.config.timeout,
        waitUntil: options.waitUntil,
      });

      return {
        success: true,
        data: this.page.url(),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Clicks on an element
   *
   * Locates the specified element and performs a click action.
   * Supports both string selectors and structured ElementSelector objects.
   *
   * @param selector - CSS selector, XPath, or ElementSelector object
   * @param options - Click options (timeout, force)
   * @param options.timeout - Maximum time to wait for element in milliseconds
   * @param options.force - Whether to force click even if element is not actionable
   * @returns Promise resolving to success status or error
   *
   * @throws Will return error result if browser not launched
   * @throws Will return error result if element not found or not clickable
   *
   * @example
   * ```typescript
   * // String selector
   * await session.click('button.submit');
   *
   * // ElementSelector object
   * await session.click({
   *   type: 'xpath',
   *   value: '//button[contains(text(), "Submit")]'
   * });
   *
   * // With options
   * await session.click('.slow-element', {
   *   timeout: 10000,
   *   force: true
   * });
   * ```
   */
  async click(
    selector: string | ElementSelector,
    options?: {
      timeout?: number;
      force?: boolean;
    }
  ): Promise<BrowserActionResult<void>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      const selectorString = this.normalizeSelector(selector);
      await this.page.click(selectorString, {
        timeout: options?.timeout || this.config.timeout,
        force: options?.force,
      });

      return {
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Types text into an element
   *
   * Clears the target element and types the specified text.
   * Useful for filling form inputs, text areas, and editable content.
   *
   * @param selector - CSS selector, XPath, or ElementSelector object
   * @param text - Text content to type into the element
   * @param options - Typing options (timeout, delay)
   * @param options.timeout - Maximum time to wait for element in milliseconds
   * @param options.delay - Delay between keystrokes in milliseconds
   * @returns Promise resolving to success status or error
   *
   * @throws Will return error result if browser not launched
   * @throws Will return error result if element not found or not editable
   *
   * @example
   * ```typescript
   * // Type into an input field
   * await session.type('#email', 'user@example.com');
   *
   * // Type with delay between keystrokes
   * await session.type('#password', 'secretpassword', {
   *   delay: 100
   * });
   *
   * // Type with custom timeout
   * await session.type('.slow-input', 'text', {
   *   timeout: 15000
   * });
   * ```
   */
  async type(
    selector: string | ElementSelector,
    text: string,
    options?: {
      timeout?: number;
      delay?: number;
    }
  ): Promise<BrowserActionResult<void>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      const selectorString = this.normalizeSelector(selector);
      await this.page.fill(selectorString, '', { timeout: options?.timeout || this.config.timeout });
      await this.page.type(selectorString, text, {
        timeout: options?.timeout || this.config.timeout,
        delay: options?.delay,
      });

      return {
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Scrolls the page or an element
   */
  async scroll(options?: {
    x?: number;
    y?: number;
    selector?: string | ElementSelector;
    smooth?: boolean;
  }): Promise<BrowserActionResult<void>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      if (options?.selector) {
        const selectorString = this.normalizeSelector(options.selector);
        await this.page.locator(selectorString).scrollIntoViewIfNeeded();
      } else {
        await this.page.evaluate((scrollOptions) => {
          window.scrollTo({
            left: scrollOptions.x || 0,
            top: scrollOptions.y || 0,
            behavior: scrollOptions.smooth ? 'smooth' : 'auto',
          });
        }, { x: options?.x, y: options?.y, smooth: options?.smooth });
      }

      return {
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Hovers over an element
   */
  async hover(
    selector: string | ElementSelector,
    options?: {
      timeout?: number;
      force?: boolean;
    }
  ): Promise<BrowserActionResult<void>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      const selectorString = this.normalizeSelector(selector);
      await this.page.hover(selectorString, {
        timeout: options?.timeout || this.config.timeout,
        force: options?.force,
      });

      return {
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Focuses on an element
   */
  async focus(
    selector: string | ElementSelector,
    options?: {
      timeout?: number;
    }
  ): Promise<BrowserActionResult<void>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      const selectorString = this.normalizeSelector(selector);
      await this.page.focus(selectorString, {
        timeout: options?.timeout || this.config.timeout,
      });

      return {
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Takes a screenshot
   *
   * Captures a screenshot of the current page with configurable options.
   * Supports both viewport-only and full-page screenshots.
   *
   * @param options - Screenshot configuration options
   * @param options.path - Optional file path to save screenshot
   * @param options.type - Image format ('png' or 'jpeg')
   * @param options.quality - JPEG quality (1-100, only for JPEG)
   * @param options.fullPage - Whether to capture full scrollable page
   * @param options.omitBackground - Whether to omit background (transparent PNG)
   * @returns Promise resolving to screenshot buffer or error
   *
   * @throws Will return error result if browser not launched
   * @throws Will return error result if screenshot capture fails
   *
   * @example
   * ```typescript
   * // Basic screenshot
   * const result = await session.screenshot();
   * if (result.success) {
   *   fs.writeFileSync('screenshot.png', result.data);
   * }
   *
   * // Full page JPEG with quality setting
   * const fullPage = await session.screenshot({
   *   type: 'jpeg',
   *   quality: 90,
   *   fullPage: true,
   *   path: './full-page.jpg'
   * });
   * ```
   */
  async screenshot(options: ScreenshotOptions = {}): Promise<BrowserActionResult<Buffer>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      const screenshot = await this.page.screenshot({
        path: options.path,
        type: options.type || 'png',
        quality: options.quality,
        fullPage: options.fullPage || false,
        omitBackground: options.omitBackground,
      });

      return {
        success: true,
        data: screenshot,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Captures a screenshot of the current viewport
   *
   * @param options - Screenshot capture options (format, quality, path)
   * @returns Buffer containing the screenshot image data
   */
  async captureViewport(
    options: ScreenshotCaptureOptions = {}
  ): Promise<BrowserActionResult<Buffer>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      const screenshot = await this.page.screenshot({
        fullPage: false,
        type: options.type || 'png',
        quality: options.type === 'jpeg' ? options.quality : undefined,
        path: options.path,
        omitBackground: options.omitBackground,
      });

      return {
        success: true,
        data: screenshot,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Captures a screenshot of the full scrollable page
   *
   * @param options - Screenshot options (format, quality, path)
   * @returns Buffer containing the screenshot image data
   */
  async captureFullPage(
    options: ScreenshotOptions = {}
  ): Promise<BrowserActionResult<Buffer>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      const screenshot = await this.page.screenshot({
        fullPage: true,
        type: options.type || 'png',
        quality: options.type === 'jpeg' ? options.quality : undefined,
        path: options.path,
        omitBackground: options.omitBackground,
      });

      return {
        success: true,
        data: screenshot,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Captures a screenshot of a specific element
   *
   * @param selector - CSS selector, XPath, or ElementSelector for the target element
   * @param options - Screenshot capture options (format, quality, path, timeout)
   * @returns Buffer containing the screenshot image data
   */
  async captureElement(
    selector: string | ElementSelector,
    options: ElementScreenshotOptions = {}
  ): Promise<BrowserActionResult<Buffer>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      const selectorString = this.normalizeSelector(selector);

      // Wait for element to be visible before capturing
      const element = await this.page.waitForSelector(selectorString, {
        timeout: options.timeout || this.config.timeout,
        state: 'visible',
      });

      if (!element) {
        return {
          success: false,
          error: `Element not found: ${selectorString}`,
          duration: Date.now() - startTime,
        };
      }

      const screenshot = await element.screenshot({
        type: options.type || 'png',
        quality: options.type === 'jpeg' ? options.quality : undefined,
        path: options.path,
        omitBackground: options.omitBackground,
      });

      return {
        success: true,
        data: screenshot,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Gets text content from an element
   */
  async getText(selector: string | ElementSelector): Promise<BrowserActionResult<string>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      const selectorString = this.normalizeSelector(selector);
      const text = await this.page.textContent(selectorString, {
        timeout: this.config.timeout,
      });

      return {
        success: true,
        data: text || '',
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Waits for an element to be visible
   */
  async waitForElement(
    selector: string | ElementSelector,
    options?: {
      timeout?: number;
      state?: 'visible' | 'hidden' | 'attached' | 'detached';
    }
  ): Promise<BrowserActionResult<void>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      const selectorString = this.normalizeSelector(selector);
      await this.page.waitForSelector(selectorString, {
        timeout: options?.timeout || this.config.timeout,
        state: options?.state || 'visible',
      });

      return {
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Waits for a selector to match an element
   * Alias for waitForElement for compatibility
   */
  async waitForSelector(
    selector: string | ElementSelector,
    options?: {
      timeout?: number;
      state?: 'visible' | 'hidden' | 'attached' | 'detached';
    }
  ): Promise<BrowserActionResult<void>> {
    return this.waitForElement(selector, options);
  }

  /**
   * Waits for a function to evaluate to true
   */
  async waitForFunction(
    fn: string | (() => unknown),
    options?: {
      timeout?: number;
      polling?: number | 'raf';
    }
  ): Promise<BrowserActionResult<unknown>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      const result = await this.page.waitForFunction(fn, {
        timeout: options?.timeout || this.config.timeout,
        polling: options?.polling || 'raf',
      });

      const value = await result.jsonValue();

      return {
        success: true,
        data: value,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Waits for page to reach a specific load state
   */
  async waitForLoadState(
    state: 'load' | 'domcontentloaded' | 'networkidle' = 'load',
    options?: {
      timeout?: number;
    }
  ): Promise<BrowserActionResult<void>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      await this.page.waitForLoadState(state, {
        timeout: options?.timeout || this.config.timeout,
      });

      return {
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Waits for a request with matching URL pattern
   */
  async waitForRequest(
    urlPattern: string | RegExp | ((request: any) => boolean),
    options?: {
      timeout?: number;
    }
  ): Promise<BrowserActionResult<any>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      const request = await this.page.waitForRequest(urlPattern, {
        timeout: options?.timeout || this.config.timeout,
      });

      return {
        success: true,
        data: {
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          resourceType: request.resourceType(),
        },
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Waits for a response with matching URL pattern
   */
  async waitForResponse(
    urlPattern: string | RegExp | ((response: any) => boolean),
    options?: {
      timeout?: number;
    }
  ): Promise<BrowserActionResult<any>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      const response = await this.page.waitForResponse(urlPattern, {
        timeout: options?.timeout || this.config.timeout,
      });

      return {
        success: true,
        data: {
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          headers: response.headers(),
          ok: response.ok(),
        },
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Waits for a specific amount of time
   */
  async waitFor(
    milliseconds: number
  ): Promise<BrowserActionResult<void>> {
    const startTime = Date.now();

    try {
      await this.page?.waitForTimeout(milliseconds);

      return {
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Evaluates JavaScript in the browser context
   */
  async evaluate<T = unknown>(script: string | (() => T)): Promise<BrowserActionResult<T>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      const result = await this.page.evaluate(script);
      return {
        success: true,
        data: result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Gets the current page URL
   */
  getCurrentUrl(): string {
    return this.page?.url() || '';
  }

  /**
   * Gets the page title
   */
  async getTitle(): Promise<BrowserActionResult<string>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      const title = await this.page.title();
      return {
        success: true,
        data: title,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Gets captured console messages
   *
   * Returns a copy of all console messages captured during the session.
   * Console capture must be enabled in the capture configuration.
   *
   * @returns Array of captured console messages
   *
   * @example
   * ```typescript
   * const messages = session.getCapturedConsoleMessages();
   * messages.forEach(msg => {
   *   console.log(`${msg.type}: ${msg.text} at ${new Date(msg.timestamp)}`);
   * });
   * ```
   *
   * @see {@link updateCaptureConfig} to enable console capture
   */
  getCapturedConsoleMessages(): CapturedConsoleMessage[] {
    return [...this.consoleBuffer];
  }

  /**
   * Gets captured JavaScript errors
   *
   * Returns a copy of all JavaScript errors captured during the session.
   * Error capture must be enabled in the capture configuration.
   *
   * @returns Array of captured JavaScript errors
   *
   * @example
   * ```typescript
   * const errors = session.getCapturedJavaScriptErrors();
   * errors.forEach(error => {
   *   console.error(`${error.name}: ${error.message}`);
   *   if (error.source) {
   *     console.error(`  at ${error.source.url}:${error.source.line}`);
   *   }
   * });
   * ```
   *
   * @see {@link updateCaptureConfig} to enable error capture
   */
  getCapturedJavaScriptErrors(): CapturedJavaScriptError[] {
    return [...this.errorBuffer];
  }

  /**
   * Gets captured page errors
   */
  getCapturedPageErrors(): PageErrorEvent[] {
    return [...this.pageErrorBuffer];
  }

  /**
   * Clears all captured data
   */
  clearCapturedData(): void {
    this.consoleBuffer.length = 0;
    this.errorBuffer.length = 0;
    this.pageErrorBuffer.length = 0;
  }

  /**
   * Updates capture configuration
   */
  updateCaptureConfig(config: Partial<CaptureConfig>): void {
    this.captureConfig = { ...this.captureConfig, ...config };
  }

  /**
   * Gets current capture configuration
   */
  getCaptureConfig(): CaptureConfig {
    return { ...this.captureConfig };
  }

  /**
   * Retrieves captured JavaScript errors from injected script
   */
  async retrieveCapturedJavaScriptErrors(): Promise<BrowserActionResult<CapturedJavaScriptError[]>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      // Retrieve captured errors from the injected script
      const capturedErrors = await this.page.evaluate(() => {
        const errors = window.__apexErrorCapture || [];
        // Clear the captured errors array after retrieval
        window.__apexErrorCapture = [];
        return errors;
      });

      // Process and add to our error buffer
      const processedErrors: CapturedJavaScriptError[] = capturedErrors.map(error => ({
        message: error.message,
        name: error.name || 'JavaScriptError',
        stack: error.stack,
        timestamp: error.timestamp,
        uncaught: error.uncaught,
        source: error.filename ? {
          url: error.filename,
          line: error.lineno,
          column: error.colno,
        } : undefined,
      }));

      // Add to our error buffer and emit events
      for (const error of processedErrors) {
        this.addToErrorBuffer(error);
        this.emit('javascriptError', error);
      }

      return {
        success: true,
        data: processedErrors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Starts continuous polling for JavaScript errors from injected script
   */
  startErrorPolling(intervalMs: number = 1000): void {
    if (this.errorPollingInterval) {
      clearInterval(this.errorPollingInterval);
    }

    this.errorPollingInterval = setInterval(async () => {
      await this.retrieveCapturedJavaScriptErrors();
    }, intervalMs);
  }

  /**
   * Stops continuous error polling
   */
  stopErrorPolling(): void {
    if (this.errorPollingInterval) {
      clearInterval(this.errorPollingInterval);
      this.errorPollingInterval = undefined;
    }
  }

  /**
   * Retrieves enhanced console messages from injected script
   */
  async retrieveEnhancedConsoleMessages(): Promise<BrowserActionResult<CapturedConsoleMessage[]>> {
    const startTime = Date.now();

    if (!this.page) {
      return {
        success: false,
        error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
        duration: Date.now() - startTime,
      };
    }

    try {
      // Retrieve captured console messages from the injected script
      const capturedMessages = await this.page.evaluate(() => {
        const messages = window.__apexConsoleCapture || [];
        // Clear the captured messages array after retrieval
        window.__apexConsoleCapture = [];
        return messages;
      });

      // Process and add to our console buffer
      const processedMessages: CapturedConsoleMessage[] = capturedMessages.map(msg => ({
        type: msg.level as ConsoleLogLevel,
        text: msg.text,
        args: msg.args,
        timestamp: msg.timestamp,
        location: msg.stack ? this.extractLocationFromStack(msg.stack) : undefined,
      }));

      // Add to our console buffer and emit events
      for (const message of processedMessages) {
        this.addToConsoleBuffer(message);
        this.emit('consoleMessage', message);
      }

      return {
        success: true,
        data: processedMessages,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Starts streaming console messages and errors in real-time
   */
  startRealTimeCapture(options: {
    consolePollingMs?: number;
    errorPollingMs?: number;
    autoStart?: boolean;
  } = {}): void {
    const {
      consolePollingMs = 500,
      errorPollingMs = 1000,
      autoStart = true,
    } = options;

    if (autoStart && this.captureConfig.captureConsole) {
      setInterval(async () => {
        await this.retrieveEnhancedConsoleMessages();
      }, consolePollingMs);
    }

    if (autoStart && this.captureConfig.captureErrors) {
      this.startErrorPolling(errorPollingMs);
    }
  }

  /**
   * Extract location information from stack trace
   */
  private extractLocationFromStack(stack: string): { url: string; lineNumber?: number; columnNumber?: number; } | undefined {
    try {
      // Parse stack trace to extract location information
      const lines = stack.split('\n');
      for (const line of lines) {
        const match = line.match(/at .+? \((.+?):(\d+):(\d+)\)/);
        if (match) {
          return {
            url: match[1],
            lineNumber: parseInt(match[2], 10),
            columnNumber: parseInt(match[3], 10),
          };
        }
      }
    } catch {
      // Ignore parsing errors
    }
    return undefined;
  }

  /**
   * Gets the underlying Playwright page object
   */
  getPage(): Page | undefined {
    return this.page;
  }

  /**
   * Gets the underlying Playwright browser context
   */
  getContext(): BrowserContext | undefined {
    if (!this.contextId) return undefined;
    return this.manager.getContext(this.contextId);
  }

  /**
   * Gets the underlying Playwright browser instance
   */
  getBrowser(): Browser | undefined {
    if (!this.instanceId) return undefined;
    return this.manager.getInstance(this.instanceId);
  }

  /**
   * Closes the browser session
   *
   * Gracefully shuts down the browser session by:
   * - Stopping error polling if active
   * - Closing the page
   * - Closing the browser context
   * - Cleaning up internal state
   *
   * Note: Browser instance may remain open for reuse if configured.
   *
   * @returns Promise resolving to success status or error
   *
   * @throws Will return error result if context closing fails
   *
   * @example
   * ```typescript
   * try {
   *   const result = await session.close();
   *   if (result.success) {
   *     console.log('Session closed successfully');
   *   }
   * } catch (error) {
   *   console.error('Failed to close session:', error);
   * }
   * ```
   */
  async close(): Promise<BrowserActionResult<void>> {
    const startTime = Date.now();

    try {
      // Update lifecycle state to cleaning up
      this.state = 'cleaning_up';

      // Stop error polling if running
      this.stopErrorPolling();

      // Close the page if it exists
      if (this.page) {
        await this.page.close();
        this.page = undefined;
      }

      // Close the browser context if it exists
      if (this.contextId) {
        const result = await this.manager.closeContext(this.contextId);
        if (!result.success) {
          return result;
        }
        this.contextId = undefined;
      }

      // Note: We don't close the browser instance as it might be reused

      return {
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  // Private helper methods

  private async setupCapture(): Promise<void> {
    if (!this.page) return;

    // Set up console message capture
    if (this.captureConfig.captureConsole) {
      this.page.on('console', async (message) => {
        try {
          const capturedMessage = await this.processConsoleMessage(message);
          if (capturedMessage) {
            this.addToConsoleBuffer(capturedMessage);
            this.emit('consoleMessage', capturedMessage);
          }
        } catch (error) {
          console.warn('Error processing console message:', error);
        }
      });
    }

    // Set up page error capture
    if (this.captureConfig.captureErrors) {
      this.page.on('pageerror', (error) => {
        try {
          const pageError: PageErrorEvent = {
            error,
            message: error.message,
            stack: error.stack,
            timestamp: Date.now(),
          };
          this.addToPageErrorBuffer(pageError);
          this.emit('pageError', pageError);
        } catch (err) {
          console.warn('Error processing page error:', err);
        }
      });

      // Inject error capture script
      await this.injectErrorCaptureScript();
    }
  }

  private async processConsoleMessage(message: any): Promise<CapturedConsoleMessage | null> {
    const messageType = message.type();

    // Filter by configured console levels
    if (this.captureConfig.consoleLevels && !this.captureConfig.consoleLevels.includes(messageType)) {
      return null;
    }

    const text = message.text();
    const args: unknown[] = [];

    // Extract console arguments
    try {
      for (let i = 0; i < message.args().length; i++) {
        const arg = message.args()[i];
        try {
          const value = await arg.jsonValue();
          args.push(value);
        } catch {
          args.push(arg.toString());
        }
      }
    } catch {
      args.push(text);
    }

    const location = message.location();

    return {
      type: messageType,
      text,
      args,
      location: location ? {
        url: location.url,
        lineNumber: location.lineNumber,
        columnNumber: location.columnNumber,
      } : undefined,
      timestamp: Date.now(),
    };
  }

  private async injectErrorCaptureScript(): Promise<void> {
    if (!this.page) return;

    await this.page.addInitScript(() => {
      // Initialize capture arrays
      window.__apexErrorCapture = window.__apexErrorCapture || [];
      window.__apexConsoleCapture = window.__apexConsoleCapture || [];

      // Capture uncaught errors
      window.addEventListener('error', (event) => {
        const errorInfo = {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
          timestamp: Date.now(),
          uncaught: true,
          name: event.error?.name || 'Error',
        };

        window.__apexErrorCapture!.push(errorInfo);
      });

      // Capture unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        const errorInfo = {
          message: event.reason?.message || String(event.reason),
          stack: event.reason?.stack,
          timestamp: Date.now(),
          uncaught: true,
          name: event.reason?.name || 'UnhandledPromiseRejection',
        };

        window.__apexErrorCapture!.push(errorInfo);
      });

      // Intercept console methods for enhanced capture
      const consoleLevels = ['log', 'debug', 'info', 'warn', 'error', 'trace'] as const;
      type ConsoleMethod = typeof consoleLevels[number];

      consoleLevels.forEach((level: ConsoleMethod) => {
        const originalMethod = console[level];
        (console as unknown as Record<string, typeof originalMethod>)[level] = function(...capturedArgs: unknown[]) {
          // Store enhanced console message with stack trace
          const stackTrace = new Error().stack;
          window.__apexConsoleCapture!.push({
            level: level,
            args: capturedArgs.map(arg => {
              try {
                return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
              } catch {
                return String(arg);
              }
            }),
            text: capturedArgs.map(arg => String(arg)).join(' '),
            timestamp: Date.now(),
            stack: stackTrace,
          });

          // Call original console method
          return originalMethod.apply(console, capturedArgs);
        };
      });
    });
  }

  private normalizeSelector(selector: string | ElementSelector): string {
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

  private addToConsoleBuffer(message: CapturedConsoleMessage): void {
    this.consoleBuffer.push(message);
    if (this.captureConfig.maxBufferSize && this.consoleBuffer.length > this.captureConfig.maxBufferSize) {
      this.consoleBuffer.shift();
    }
  }

  private addToErrorBuffer(error: CapturedJavaScriptError): void {
    this.errorBuffer.push(error);
    if (this.captureConfig.maxBufferSize && this.errorBuffer.length > this.captureConfig.maxBufferSize) {
      this.errorBuffer.shift();
    }
  }

  private addToPageErrorBuffer(error: PageErrorEvent): void {
    this.pageErrorBuffer.push(error);
    if (this.captureConfig.maxBufferSize && this.pageErrorBuffer.length > this.captureConfig.maxBufferSize) {
      this.pageErrorBuffer.shift();
    }
  }
}