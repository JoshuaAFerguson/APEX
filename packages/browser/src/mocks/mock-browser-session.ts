/**
 * @apexcli/browser/mocks - Mock Browser Session
 *
 * Mock implementation of browser session for testing and simulation
 */

import { EventEmitter } from 'eventemitter3';
import type {
  BrowserActionResult,
  ElementSelector,
  NavigationOptions,
  WaitForNavigationOptions,
  ScreenshotCaptureOptions,
  ElementScreenshotOptions,
  SupportedBrowserType,
  CapturedConsoleMessage,
  CapturedJavaScriptError,
  BrowserSessionConfig,
} from '../types.js';
import type {
  MockBehaviorConfig,
  MockScenarioConfig,
  MockBrowserSessionConfig,
  MockElement,
  MockPageState,
  MockNavigationResult,
  MockScreenshot,
  MockOperation,
  MockBrowserEvents,
  MockResponse,
} from './types.js';

/**
 * Default mock behavior configuration
 */
const DEFAULT_MOCK_CONFIG: MockBehaviorConfig = {
  defaultSuccess: true,
  defaultDelay: 100,
  failureRate: 0,
  useRealisticDelays: false,
};

/**
 * Mock implementation of BrowserSession for testing and simulation
 */
export class MockBrowserSession extends EventEmitter<MockBrowserEvents> {
  private config: MockBrowserSessionConfig;
  private pageState: MockPageState;
  private operations: MockOperation[] = [];
  private launched = false;
  private sessionId: string;

  constructor(
    config: Partial<MockBrowserSessionConfig> = {},
    scenarioConfig?: MockScenarioConfig
  ) {
    super();

    this.sessionId = `mock-session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    this.config = {
      browserType: 'chromium',
      headless: true,
      viewport: { width: 1280, height: 720 },
      timeout: 30000,
      mockConfig: DEFAULT_MOCK_CONFIG,
      trackOperations: true,
      ...config,
      scenarioConfig: scenarioConfig || config.scenarioConfig,
    };

    this.pageState = {
      url: 'about:blank',
      title: '',
      loaded: false,
      elements: new Map(),
      consoleMessages: [],
      errors: [],
      viewport: this.config.viewport,
    };

    this.setupDefaultElements();
  }

  /**
   * Get session configuration
   */
  getConfig(): MockBrowserSessionConfig {
    return { ...this.config };
  }

  /**
   * Get current page state
   */
  getPageState(): MockPageState {
    return { ...this.pageState };
  }

  /**
   * Get operation history
   */
  getOperationHistory(): MockOperation[] {
    return [...this.operations];
  }

  /**
   * Mock launch operation
   */
  async launch(): Promise<BrowserActionResult<void>> {
    const operation = this.startOperation('launch', []);

    try {
      const response = await this.executeWithConfig('launch', []);

      if (response.success) {
        this.launched = true;
        this.completeOperation(operation, true, undefined);
        return {
          success: true,
          duration: operation.endTime! - operation.startTime,
        };
      } else {
        this.completeOperation(operation, false, response.error!);
        return {
          success: false,
          error: response.error,
          duration: operation.endTime! - operation.startTime,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.completeOperation(operation, false, errorMessage);
      return {
        success: false,
        error: errorMessage,
        duration: operation.endTime! - operation.startTime,
      };
    }
  }

  /**
   * Mock navigation
   */
  async navigate(
    url: string,
    options?: NavigationOptions
  ): Promise<BrowserActionResult<MockNavigationResult>> {
    if (!this.launched) {
      return {
        success: false,
        error: 'Browser session not launched',
        duration: 0,
      };
    }

    const operation = this.startOperation('navigate', [url, options]);

    try {
      const response = await this.executeWithConfig('navigate', [url, options]);

      if (response.success) {
        const result = response.data || this.createNavigationResult(url);

        // Update page state
        this.pageState.url = result.url;
        this.pageState.title = result.title || this.extractTitleFromUrl(url);
        this.pageState.loaded = true;

        // Add URL-specific elements
        this.addUrlSpecificElements(url);

        this.completeOperation(operation, true, result);
        this.emit('navigation', result);
        this.emit('stateChange', this.pageState);

        return {
          success: true,
          data: result,
          duration: result.loadTime || (operation.endTime! - operation.startTime),
        };
      } else {
        this.completeOperation(operation, false, response.error!);
        return {
          success: false,
          error: response.error,
          duration: operation.endTime! - operation.startTime,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.completeOperation(operation, false, errorMessage);
      return {
        success: false,
        error: errorMessage,
        duration: operation.endTime! - operation.startTime,
      };
    }
  }

  /**
   * Mock element clicking
   */
  async clickElement(
    selector: string | ElementSelector,
    options?: { timeout?: number }
  ): Promise<BrowserActionResult<void>> {
    const selectorStr = this.normalizeSelector(selector);
    const operation = this.startOperation('clickElement', [selectorStr, options]);

    try {
      const element = this.getOrCreateElement(selectorStr);
      const response = await this.executeWithConfig('clickElement', [selectorStr, options]);

      if (response.success && element.exists && element.visible && element.enabled) {
        this.completeOperation(operation, true, undefined);
        this.emit('elementInteraction', selectorStr, 'click', true);

        return {
          success: true,
          duration: operation.endTime! - operation.startTime,
        };
      } else {
        const error = response.error || (!element.exists ? 'Element not found' :
                      !element.visible ? 'Element not visible' :
                      !element.enabled ? 'Element not enabled' : 'Unknown error');

        this.completeOperation(operation, false, error);
        this.emit('elementInteraction', selectorStr, 'click', false);

        return {
          success: false,
          error,
          duration: operation.endTime! - operation.startTime,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.completeOperation(operation, false, errorMessage);
      return {
        success: false,
        error: errorMessage,
        duration: operation.endTime! - operation.startTime,
      };
    }
  }

  /**
   * Mock element text input
   */
  async typeInElement(
    selector: string | ElementSelector,
    text: string,
    options?: { delay?: number }
  ): Promise<BrowserActionResult<void>> {
    const selectorStr = this.normalizeSelector(selector);
    const operation = this.startOperation('typeInElement', [selectorStr, text, options]);

    try {
      const element = this.getOrCreateElement(selectorStr);
      const response = await this.executeWithConfig('typeInElement', [selectorStr, text, options]);

      if (response.success && element.exists && element.visible && element.enabled) {
        // Update element value
        element.value = text;

        this.completeOperation(operation, true, undefined);
        this.emit('elementInteraction', selectorStr, 'type', true);

        return {
          success: true,
          duration: operation.endTime! - operation.startTime,
        };
      } else {
        const error = response.error || (!element.exists ? 'Element not found' :
                      !element.visible ? 'Element not visible' :
                      !element.enabled ? 'Element not enabled' : 'Unknown error');

        this.completeOperation(operation, false, error);
        this.emit('elementInteraction', selectorStr, 'type', false);

        return {
          success: false,
          error,
          duration: operation.endTime! - operation.startTime,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.completeOperation(operation, false, errorMessage);
      return {
        success: false,
        error: errorMessage,
        duration: operation.endTime! - operation.startTime,
      };
    }
  }

  /**
   * Mock element existence check
   */
  async elementExists(selector: string | ElementSelector): Promise<BrowserActionResult<boolean>> {
    const selectorStr = this.normalizeSelector(selector);
    const operation = this.startOperation('elementExists', [selectorStr]);

    try {
      const element = this.getOrCreateElement(selectorStr);
      const response = await this.executeWithConfig('elementExists', [selectorStr]);

      const exists = response.success ? (response.data ?? element.exists) : false;

      this.completeOperation(operation, true, exists);

      return {
        success: true,
        data: exists,
        duration: operation.endTime! - operation.startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.completeOperation(operation, false, errorMessage);
      return {
        success: false,
        error: errorMessage,
        duration: operation.endTime! - operation.startTime,
      };
    }
  }

  /**
   * Mock getting element text
   */
  async getElementText(selector: string | ElementSelector): Promise<BrowserActionResult<string>> {
    const selectorStr = this.normalizeSelector(selector);
    const operation = this.startOperation('getElementText', [selectorStr]);

    try {
      const element = this.getOrCreateElement(selectorStr);
      const response = await this.executeWithConfig('getElementText', [selectorStr]);

      if (response.success && element.exists) {
        const text = response.data || element.text || '';
        this.completeOperation(operation, true, text);

        return {
          success: true,
          data: text,
          duration: operation.endTime! - operation.startTime,
        };
      } else {
        const error = response.error || 'Element not found';
        this.completeOperation(operation, false, error);

        return {
          success: false,
          error,
          duration: operation.endTime! - operation.startTime,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.completeOperation(operation, false, errorMessage);
      return {
        success: false,
        error: errorMessage,
        duration: operation.endTime! - operation.startTime,
      };
    }
  }

  /**
   * Mock screenshot capture
   */
  async captureScreenshot(
    options?: ScreenshotCaptureOptions
  ): Promise<BrowserActionResult<MockScreenshot>> {
    const operation = this.startOperation('captureScreenshot', [options]);

    try {
      const response = await this.executeWithConfig('captureScreenshot', [options]);

      if (response.success) {
        const screenshot = response.data || this.createMockScreenshot(options);

        this.completeOperation(operation, true, screenshot);
        this.emit('screenshot', options || {}, screenshot);

        return {
          success: true,
          data: screenshot,
          duration: screenshot.captureTime || (operation.endTime! - operation.startTime),
        };
      } else {
        this.completeOperation(operation, false, response.error!);
        return {
          success: false,
          error: response.error,
          duration: operation.endTime! - operation.startTime,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.completeOperation(operation, false, errorMessage);
      return {
        success: false,
        error: errorMessage,
        duration: operation.endTime! - operation.startTime,
      };
    }
  }

  /**
   * Mock waiting for navigation
   */
  async waitForNavigation(
    options?: WaitForNavigationOptions
  ): Promise<BrowserActionResult<string>> {
    const operation = this.startOperation('waitForNavigation', [options]);

    try {
      const response = await this.executeWithConfig('waitForNavigation', [options]);

      if (response.success) {
        const url = response.data || this.pageState.url;
        this.completeOperation(operation, true, url);

        return {
          success: true,
          data: url,
          duration: operation.endTime! - operation.startTime,
        };
      } else {
        this.completeOperation(operation, false, response.error!);
        return {
          success: false,
          error: response.error,
          duration: operation.endTime! - operation.startTime,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.completeOperation(operation, false, errorMessage);
      return {
        success: false,
        error: errorMessage,
        duration: operation.endTime! - operation.startTime,
      };
    }
  }

  /**
   * Mock browser close
   */
  async close(): Promise<BrowserActionResult<void>> {
    const operation = this.startOperation('close', []);

    try {
      const response = await this.executeWithConfig('close', []);

      if (response.success) {
        this.launched = false;
        this.completeOperation(operation, true, undefined);

        return {
          success: true,
          duration: operation.endTime! - operation.startTime,
        };
      } else {
        this.completeOperation(operation, false, response.error!);
        return {
          success: false,
          error: response.error,
          duration: operation.endTime! - operation.startTime,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.completeOperation(operation, false, errorMessage);
      return {
        success: false,
        error: errorMessage,
        duration: operation.endTime! - operation.startTime,
      };
    }
  }

  // Private helper methods

  private normalizeSelector(selector: string | ElementSelector): string {
    return typeof selector === 'string' ? selector : `${selector.type}:${selector.value}`;
  }

  private startOperation(name: string, args: any[]): MockOperation {
    const operation: MockOperation = {
      name,
      args,
      startTime: Date.now(),
    };

    if (this.config.trackOperations) {
      this.operations.push(operation);
    }

    this.emit('operation', operation);
    return operation;
  }

  private completeOperation(operation: MockOperation, success: boolean, result: any, error?: string): void {
    operation.endTime = Date.now();
    operation.success = success;
    operation.result = result;
    operation.error = error;
  }

  private async executeWithConfig(operationName: string, args: any[]): Promise<MockResponse> {
    // Check for operation-specific configuration
    const operationConfig = this.config.scenarioConfig?.operations?.[operationName];
    const wildcardConfig = this.config.scenarioConfig?.operations?.['*'];

    const config = operationConfig || wildcardConfig;

    if (config) {
      // Apply configured delay
      if (config.delay) {
        await this.delay(config.delay);
      }

      return {
        success: config.success,
        data: config.returnValue,
        error: config.error,
      };
    }

    // Apply default behavior
    const shouldFail = Math.random() < (this.config.mockConfig.failureRate || 0);
    const delay = this.config.mockConfig.useRealisticDelays ?
      this.getRealisticDelay(operationName) :
      this.config.mockConfig.defaultDelay;

    await this.delay(delay);

    return {
      success: this.config.mockConfig.defaultSuccess && !shouldFail,
      error: shouldFail ? `Mock operation ${operationName} failed` : undefined,
    };
  }

  private getRealisticDelay(operationName: string): number {
    const delays = {
      launch: 2000,
      navigate: 1500,
      clickElement: 200,
      typeInElement: 300,
      elementExists: 100,
      getElementText: 150,
      captureScreenshot: 800,
      waitForNavigation: 1000,
      close: 500,
    };

    return delays[operationName as keyof typeof delays] || 200;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getOrCreateElement(selector: string): MockElement {
    if (!this.pageState.elements.has(selector)) {
      // Check scenario config for element behavior
      const elementConfig = this.config.scenarioConfig?.elementBehaviors?.[selector];

      this.pageState.elements.set(selector, {
        selector,
        exists: elementConfig?.exists ?? true,
        visible: elementConfig?.visible ?? true,
        enabled: elementConfig?.enabled ?? true,
        text: elementConfig?.text,
        value: elementConfig?.value,
        attributes: {},
        boundingBox: {
          x: 100,
          y: 100,
          width: 200,
          height: 30,
        },
      });
    }

    return this.pageState.elements.get(selector)!;
  }

  private setupDefaultElements(): void {
    // Add some common elements that might be expected
    const commonElements = [
      { selector: 'body', text: 'Mock page content' },
      { selector: 'title', text: 'Mock Page Title' },
      { selector: '#content', text: 'Main content area' },
    ];

    commonElements.forEach(({ selector, text }) => {
      this.pageState.elements.set(selector, {
        selector,
        exists: true,
        visible: true,
        enabled: true,
        text,
        attributes: {},
        boundingBox: { x: 0, y: 0, width: 800, height: 600 },
      });
    });
  }

  private addUrlSpecificElements(url: string): void {
    // Add URL-specific elements based on common patterns
    if (url.includes('login')) {
      this.pageState.elements.set('#username', {
        selector: '#username',
        exists: true,
        visible: true,
        enabled: true,
        attributes: { type: 'text', placeholder: 'Username' },
        boundingBox: { x: 100, y: 100, width: 200, height: 30 },
      });

      this.pageState.elements.set('#password', {
        selector: '#password',
        exists: true,
        visible: true,
        enabled: true,
        attributes: { type: 'password', placeholder: 'Password' },
        boundingBox: { x: 100, y: 140, width: 200, height: 30 },
      });
    }

    if (url.includes('form')) {
      this.pageState.elements.set('button[type="submit"]', {
        selector: 'button[type="submit"]',
        exists: true,
        visible: true,
        enabled: true,
        text: 'Submit',
        attributes: { type: 'submit' },
        boundingBox: { x: 100, y: 200, width: 80, height: 30 },
      });
    }
  }

  private createNavigationResult(url: string): MockNavigationResult {
    const urlConfig = this.config.scenarioConfig?.urlBehaviors?.[url];

    return {
      url,
      title: this.extractTitleFromUrl(url),
      loadTime: urlConfig?.loadTime || this.config.mockConfig.defaultDelay,
      success: true,
    };
  }

  private createMockScreenshot(options?: ScreenshotCaptureOptions): MockScreenshot {
    const viewport = this.pageState.viewport || { width: 1280, height: 720 };

    return {
      data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      width: viewport.width,
      height: viewport.height,
      format: options?.type || 'png',
      captureTime: this.config.mockConfig.defaultDelay,
    };
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');
      return `Mock Page - ${hostname}`;
    } catch {
      return 'Mock Page';
    }
  }
}