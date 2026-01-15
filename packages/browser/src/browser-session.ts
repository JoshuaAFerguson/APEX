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
} from './types.js';

import {
  defaultBrowserConfig,
  defaultCaptureConfig,
  ERROR_MESSAGES,
  BROWSER_LIMITS,
} from './constants.js';

import { BrowserManager } from './browser-manager.js';

/**
 * Browser session manager for handling browser automation
 *
 * Provides a high-level interface for browser automation with:
 * - Page management and navigation
 * - Element interaction (click, type, scroll)
 * - Screenshot capture
 * - Console and error monitoring
 * - Resource cleanup
 */
export class BrowserSession extends EventEmitter<BrowserCaptureEvents> {
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
   * Launches browser session and creates a new page
   */
  async launch(): Promise<BrowserActionResult<void>> {
    const startTime = Date.now();

    try {
      // Launch browser instance
      const instanceResult = await this.manager.launchBrowser(this.config);
      if (!instanceResult.success) {
        return instanceResult;
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
   * @param options - Screenshot capture options (format, quality, path)
   * @returns Buffer containing the screenshot image data
   */
  async captureFullPage(
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
   */
  getCapturedConsoleMessages(): CapturedConsoleMessage[] {
    return [...this.consoleBuffer];
  }

  /**
   * Gets captured JavaScript errors
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
        type: msg.level,
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
   */
  async close(): Promise<BrowserActionResult<void>> {
    const startTime = Date.now();

    try {
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

        window.__apexErrorCapture.push(errorInfo);
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

        window.__apexErrorCapture.push(errorInfo);
      });

      // Intercept console methods for enhanced capture
      const originalConsole = { ...console };
      const consoleLevels = ['log', 'debug', 'info', 'warn', 'error', 'trace'];

      consoleLevels.forEach(level => {
        const originalMethod = console[level];
        console[level] = function() {
          const args = Array.prototype.slice.call(arguments);

          // Store enhanced console message with stack trace
          const stackTrace = new Error().stack;
          window.__apexConsoleCapture.push({
            level: level,
            args: args.map(arg => {
              try {
                return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
              } catch (e) {
                return String(arg);
              }
            }),
            text: args.join(' '),
            timestamp: Date.now(),
            stack: stackTrace,
          });

          // Call original console method
          return originalMethod.apply(console, args);
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