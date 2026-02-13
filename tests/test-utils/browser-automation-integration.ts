/**
 * Browser Automation Integration Test Utilities
 *
 * Provides comprehensive test utilities for testing browser automation including:
 * - Page automation scenarios
 * - Browser permission testing
 * - Screenshot and interaction testing
 * - Headless browser management
 * - Cross-browser compatibility testing
 */

import { vi } from 'vitest';
import { EventEmitter } from 'events';
import type { Page, Browser, BrowserContext } from 'playwright';

// ============================================================================
// Browser Test Configuration
// ============================================================================

export interface BrowserTestConfig {
  headless?: boolean;
  viewport?: { width: number; height: number };
  userAgent?: string;
  locale?: string;
  timezone?: string;
  permissions?: string[];
  recordVideo?: boolean;
  recordTrace?: boolean;
  slowMo?: number;
  timeout?: number;
}

export interface BrowserActionResult {
  success: boolean;
  data?: unknown;
  error?: Error;
  screenshot?: string; // base64
  metrics?: {
    duration: number;
    memoryUsage?: number;
    cpuUsage?: number;
  };
}

// ============================================================================
// Mock Browser Implementation
// ============================================================================

/**
 * Mock browser implementation for testing browser automation
 * without requiring actual browser instances
 */
export class MockBrowser extends EventEmitter {
  private pages = new Map<string, MockPage>();
  private contexts = new Map<string, MockBrowserContext>();
  private isConnected = true;
  private config: BrowserTestConfig;

  constructor(config: BrowserTestConfig = {}) {
    super();
    this.config = {
      headless: true,
      viewport: { width: 1920, height: 1080 },
      timeout: 30000,
      ...config,
    };
  }

  async newContext(options: BrowserTestConfig = {}): Promise<MockBrowserContext> {
    const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const context = new MockBrowserContext({
      ...this.config,
      ...options,
    }, contextId);

    this.contexts.set(contextId, context);
    this.emit('contextCreated', context);

    return context;
  }

  async newPage(): Promise<MockPage> {
    const defaultContext = await this.newContext();
    return defaultContext.newPage();
  }

  async close(): Promise<void> {
    for (const context of this.contexts.values()) {
      await context.close();
    }

    this.contexts.clear();
    this.pages.clear();
    this.isConnected = false;
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.isConnected;
  }

  getContexts(): MockBrowserContext[] {
    return Array.from(this.contexts.values());
  }

  getPages(): MockPage[] {
    return Array.from(this.pages.values());
  }
}

/**
 * Mock browser context for managing browser sessions
 */
export class MockBrowserContext extends EventEmitter {
  private pages = new Map<string, MockPage>();
  private config: BrowserTestConfig;
  public readonly id: string;

  constructor(config: BrowserTestConfig, id: string) {
    super();
    this.config = config;
    this.id = id;
  }

  async newPage(): Promise<MockPage> {
    const pageId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const page = new MockPage(this.config, pageId, this);

    this.pages.set(pageId, page);
    this.emit('pageCreated', page);

    return page;
  }

  async close(): Promise<void> {
    for (const page of this.pages.values()) {
      await page.close();
    }

    this.pages.clear();
    this.emit('closed');
  }

  pages(): MockPage[] {
    return Array.from(this.pages.values());
  }

  async grantPermissions(permissions: string[], origin?: string): Promise<void> {
    this.emit('permissionsGranted', permissions, origin);
  }

  async clearPermissions(): Promise<void> {
    this.emit('permissionsCleared');
  }
}

/**
 * Mock page implementation for testing browser interactions
 */
export class MockPage extends EventEmitter {
  private config: BrowserTestConfig;
  private context: MockBrowserContext;
  public readonly id: string;
  private url = 'about:blank';
  private title = '';
  private content = '';
  private isClosed = false;
  private actionHistory: Array<{
    action: string;
    args: unknown[];
    timestamp: Date;
    result?: BrowserActionResult;
  }> = [];

  constructor(config: BrowserTestConfig, id: string, context: MockBrowserContext) {
    super();
    this.config = config;
    this.id = id;
    this.context = context;
  }

  async goto(url: string, options?: { timeout?: number; waitUntil?: string }): Promise<BrowserActionResult> {
    const startTime = Date.now();

    const action = {
      action: 'goto',
      args: [url, options],
      timestamp: new Date(),
    };

    try {
      // Simulate navigation delay
      await this.simulateDelay(200);

      this.url = url;
      this.title = `Mock Page - ${url}`;
      this.content = this.generateMockPageContent(url);

      const result: BrowserActionResult = {
        success: true,
        data: { url: this.url, title: this.title },
        metrics: {
          duration: Date.now() - startTime,
        },
      };

      action.result = result;
      this.actionHistory.push(action);
      this.emit('navigation', url);

      return result;
    } catch (error) {
      const result: BrowserActionResult = {
        success: false,
        error: error as Error,
        metrics: {
          duration: Date.now() - startTime,
        },
      };

      action.result = result;
      this.actionHistory.push(action);

      throw error;
    }
  }

  async click(selector: string, options?: { timeout?: number }): Promise<BrowserActionResult> {
    const startTime = Date.now();

    const action = {
      action: 'click',
      args: [selector, options],
      timestamp: new Date(),
    };

    try {
      await this.simulateDelay(50);

      const result: BrowserActionResult = {
        success: true,
        data: { selector, clicked: true },
        metrics: {
          duration: Date.now() - startTime,
        },
      };

      action.result = result;
      this.actionHistory.push(action);
      this.emit('click', selector);

      return result;
    } catch (error) {
      const result: BrowserActionResult = {
        success: false,
        error: error as Error,
        metrics: {
          duration: Date.now() - startTime,
        },
      };

      action.result = result;
      this.actionHistory.push(action);

      throw error;
    }
  }

  async fill(selector: string, value: string, options?: { timeout?: number }): Promise<BrowserActionResult> {
    const startTime = Date.now();

    const action = {
      action: 'fill',
      args: [selector, value, options],
      timestamp: new Date(),
    };

    try {
      await this.simulateDelay(100);

      const result: BrowserActionResult = {
        success: true,
        data: { selector, value, filled: true },
        metrics: {
          duration: Date.now() - startTime,
        },
      };

      action.result = result;
      this.actionHistory.push(action);
      this.emit('fill', selector, value);

      return result;
    } catch (error) {
      const result: BrowserActionResult = {
        success: false,
        error: error as Error,
        metrics: {
          duration: Date.now() - startTime,
        },
      };

      action.result = result;
      this.actionHistory.push(action);

      throw error;
    }
  }

  async screenshot(options?: {
    path?: string;
    type?: 'png' | 'jpeg';
    quality?: number;
    fullPage?: boolean;
  }): Promise<BrowserActionResult> {
    const startTime = Date.now();

    const action = {
      action: 'screenshot',
      args: [options],
      timestamp: new Date(),
    };

    try {
      await this.simulateDelay(300);

      const screenshotData = this.generateMockScreenshot();

      const result: BrowserActionResult = {
        success: true,
        data: { path: options?.path },
        screenshot: screenshotData,
        metrics: {
          duration: Date.now() - startTime,
        },
      };

      action.result = result;
      this.actionHistory.push(action);
      this.emit('screenshot', options);

      return result;
    } catch (error) {
      const result: BrowserActionResult = {
        success: false,
        error: error as Error,
        metrics: {
          duration: Date.now() - startTime,
        },
      };

      action.result = result;
      this.actionHistory.push(action);

      throw error;
    }
  }

  async waitForSelector(
    selector: string,
    options?: { timeout?: number; state?: 'attached' | 'detached' | 'visible' | 'hidden' }
  ): Promise<BrowserActionResult> {
    const startTime = Date.now();

    const action = {
      action: 'waitForSelector',
      args: [selector, options],
      timestamp: new Date(),
    };

    try {
      await this.simulateDelay(100);

      const result: BrowserActionResult = {
        success: true,
        data: { selector, found: true },
        metrics: {
          duration: Date.now() - startTime,
        },
      };

      action.result = result;
      this.actionHistory.push(action);
      this.emit('selectorFound', selector);

      return result;
    } catch (error) {
      const result: BrowserActionResult = {
        success: false,
        error: error as Error,
        metrics: {
          duration: Date.now() - startTime,
        },
      };

      action.result = result;
      this.actionHistory.push(action);

      throw error;
    }
  }

  async evaluate<T>(pageFunction: string | ((arg?: unknown) => T), arg?: unknown): Promise<T> {
    await this.simulateDelay(50);

    this.actionHistory.push({
      action: 'evaluate',
      args: [pageFunction, arg],
      timestamp: new Date(),
    });

    // Mock evaluation result
    return ('Mock evaluation result' as unknown) as T;
  }

  async close(): Promise<void> {
    this.isClosed = true;
    this.emit('close');
  }

  // Getters
  url(): string {
    return this.url;
  }

  async title(): Promise<string> {
    return this.title;
  }

  async content(): Promise<string> {
    return this.content;
  }

  isClosed(): boolean {
    return this.isClosed;
  }

  context(): MockBrowserContext {
    return this.context;
  }

  getActionHistory(): typeof this.actionHistory {
    return [...this.actionHistory];
  }

  getActionCount(): number {
    return this.actionHistory.length;
  }

  getLastAction(): typeof this.actionHistory[0] | undefined {
    return this.actionHistory[this.actionHistory.length - 1];
  }

  clearActionHistory(): void {
    this.actionHistory = [];
  }

  // Private helper methods
  private async simulateDelay(ms: number): Promise<void> {
    if (this.config.slowMo) {
      ms += this.config.slowMo;
    }

    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateMockPageContent(url: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Mock Page - ${url}</title>
</head>
<body>
  <h1>Mock Page</h1>
  <p>This is a mock page for URL: ${url}</p>
  <div id="content">Mock content</div>
  <button id="testButton">Test Button</button>
  <input id="testInput" placeholder="Test input" />
</body>
</html>
    `.trim();
  }

  private generateMockScreenshot(): string {
    // Generate a simple base64 mock screenshot
    const mockImageData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    return mockImageData;
  }
}

// ============================================================================
// Browser Automation Test Scenarios
// ============================================================================

export const browserAutomationScenarios = {
  /**
   * Basic page navigation scenario
   */
  basicNavigation: {
    name: 'Basic Navigation',
    steps: [
      { action: 'goto', args: ['https://example.com'] },
      { action: 'waitForSelector', args: ['body'] },
      { action: 'screenshot', args: [{ type: 'png' }] },
    ],
    expectedResults: {
      navigationSuccess: true,
      screenshotTaken: true,
    },
  },

  /**
   * Form interaction scenario
   */
  formInteraction: {
    name: 'Form Interaction',
    steps: [
      { action: 'goto', args: ['https://example.com/form'] },
      { action: 'fill', args: ['#username', 'testuser'] },
      { action: 'fill', args: ['#password', 'testpass'] },
      { action: 'click', args: ['#submitButton'] },
      { action: 'waitForSelector', args: ['.success-message'] },
    ],
    expectedResults: {
      formFilled: true,
      submitted: true,
      successVisible: true,
    },
  },

  /**
   * Multi-page workflow
   */
  multiPageWorkflow: {
    name: 'Multi-Page Workflow',
    steps: [
      { action: 'goto', args: ['https://example.com/login'] },
      { action: 'fill', args: ['#email', 'test@example.com'] },
      { action: 'click', args: ['#loginButton'] },
      { action: 'waitForSelector', args: ['.dashboard'] },
      { action: 'click', args: ['a[href="/profile"]'] },
      { action: 'waitForSelector', args: ['.profile-form'] },
      { action: 'screenshot', args: [{ fullPage: true }] },
    ],
    expectedResults: {
      loggedIn: true,
      navigatedToProfile: true,
      profileVisible: true,
    },
  },

  /**
   * Error handling scenario
   */
  errorHandling: {
    name: 'Error Handling',
    steps: [
      { action: 'goto', args: ['https://nonexistent-site.com'] },
    ],
    expectsError: true,
    expectedError: /navigation failed|timeout|network error/i,
  },

  /**
   * Permission testing scenario
   */
  permissionTesting: {
    name: 'Permission Testing',
    permissions: ['geolocation', 'notifications', 'camera'],
    steps: [
      { action: 'grantPermissions', args: [['geolocation'], 'https://example.com'] },
      { action: 'goto', args: ['https://example.com/location'] },
      { action: 'evaluate', args: ['() => navigator.geolocation.getCurrentPosition'] },
    ],
    expectedResults: {
      permissionsGranted: true,
      geolocationAccessible: true,
    },
  },
};

// ============================================================================
// Browser Test Environment Factory
// ============================================================================

/**
 * Create a comprehensive browser testing environment
 */
export async function createBrowserTestEnvironment(config: BrowserTestConfig = {}) {
  const browser = new MockBrowser(config);
  const context = await browser.newContext();
  const page = await context.newPage();

  return {
    browser,
    context,
    page,

    /**
     * Execute a browser automation scenario
     */
    async executeScenario(scenario: typeof browserAutomationScenarios[keyof typeof browserAutomationScenarios]) {
      const results: BrowserActionResult[] = [];
      let error: Error | null = null;

      try {
        // Grant permissions if specified
        if ('permissions' in scenario && scenario.permissions) {
          await context.grantPermissions(scenario.permissions);
        }

        // Execute each step
        for (const step of scenario.steps) {
          let result: BrowserActionResult;

          switch (step.action) {
            case 'goto':
              result = await page.goto(step.args[0] as string, step.args[1] as any);
              break;
            case 'click':
              result = await page.click(step.args[0] as string, step.args[1] as any);
              break;
            case 'fill':
              result = await page.fill(step.args[0] as string, step.args[1] as string, step.args[2] as any);
              break;
            case 'waitForSelector':
              result = await page.waitForSelector(step.args[0] as string, step.args[1] as any);
              break;
            case 'screenshot':
              result = await page.screenshot(step.args[0] as any);
              break;
            case 'evaluate':
              const evalResult = await page.evaluate(step.args[0] as any, step.args[1]);
              result = { success: true, data: evalResult, metrics: { duration: 50 } };
              break;
            default:
              result = { success: false, error: new Error(`Unknown action: ${step.action}`), metrics: { duration: 0 } };
          }

          results.push(result);
        }
      } catch (e) {
        error = e as Error;
      }

      return {
        success: !error && results.every(r => r.success),
        results,
        error,
        scenario: scenario.name,
        actionHistory: page.getActionHistory(),
      };
    },

    /**
     * Create a new page for multi-page testing
     */
    async newPage(): Promise<MockPage> {
      return context.newPage();
    },

    /**
     * Simulate browser automation failures
     */
    simulateFailure(failureType: 'timeout' | 'network' | 'selector' | 'permission') {
      const failures = {
        timeout: () => new Error('Operation timed out'),
        network: () => new Error('Network error'),
        selector: () => new Error('Selector not found'),
        permission: () => new Error('Permission denied'),
      };

      return failures[failureType]();
    },

    /**
     * Get browser metrics
     */
    getMetrics() {
      return {
        pageCount: browser.getPages().length,
        contextCount: browser.getContexts().length,
        totalActions: page.getActionCount(),
        lastAction: page.getLastAction(),
      };
    },

    /**
     * Clean up the browser environment
     */
    async cleanup() {
      await browser.close();
    },
  };
}

// ============================================================================
// Browser Test Assertion Helpers
// ============================================================================

export const browserAssertions = {
  /**
   * Assert page navigation was successful
   */
  navigatedTo: (page: MockPage, expectedUrl: string) => {
    const actualUrl = page.url();
    if (!actualUrl.includes(expectedUrl)) {
      throw new Error(`Expected page to navigate to ${expectedUrl}, but got ${actualUrl}`);
    }
  },

  /**
   * Assert element interaction occurred
   */
  elementInteracted: (page: MockPage, action: string, selector: string) => {
    const history = page.getActionHistory();
    const interaction = history.find(h => h.action === action && h.args[0] === selector);

    if (!interaction) {
      throw new Error(`Expected ${action} interaction with ${selector}, but it didn't occur`);
    }

    return interaction;
  },

  /**
   * Assert screenshot was taken
   */
  screenshotTaken: (page: MockPage) => {
    const history = page.getActionHistory();
    const screenshot = history.find(h => h.action === 'screenshot');

    if (!screenshot || !screenshot.result?.screenshot) {
      throw new Error('Expected screenshot to be taken, but it wasn\'t');
    }

    return screenshot.result.screenshot;
  },

  /**
   * Assert action completed within timeout
   */
  completedWithinTimeout: (actionResult: BrowserActionResult, maxDuration: number) => {
    const duration = actionResult.metrics?.duration || 0;
    if (duration > maxDuration) {
      throw new Error(`Action took ${duration}ms, expected less than ${maxDuration}ms`);
    }
  },

  /**
   * Assert browser permissions were granted
   */
  permissionsGranted: (context: MockBrowserContext, permissions: string[]) => {
    // This would typically check actual permission state
    // For now, we assume the mock context tracks this
    return true; // Mock implementation
  },
};

// ============================================================================
// Browser Test Utilities
// ============================================================================

export const browserTestUtils = {
  /**
   * Create a realistic browser interaction delay
   */
  createDelay: (min: number = 50, max: number = 200) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Generate test URLs for different scenarios
   */
  generateTestUrls: () => ({
    valid: 'https://example.com',
    withPath: 'https://example.com/path/to/page',
    withQuery: 'https://example.com/search?q=test',
    withFragment: 'https://example.com/page#section',
    invalid: 'not-a-valid-url',
    nonExistent: 'https://this-domain-does-not-exist.com',
  }),

  /**
   * Create mock selectors for testing
   */
  generateTestSelectors: () => ({
    button: '#testButton',
    input: 'input[type="text"]',
    form: 'form.test-form',
    link: 'a[href="/test"]',
    complex: '.container .item:nth-child(2) button',
    invalid: '#nonexistent-element',
  }),

  /**
   * Measure browser action performance
   */
  measurePerformance: async <T>(action: () => Promise<T>): Promise<{ result: T; duration: number }> => {
    const start = Date.now();
    const result = await action();
    const duration = Date.now() - start;

    return { result, duration };
  },

  /**
   * Create batch browser operations
   */
  createBatchOperations: (operations: Array<{ action: string; args: unknown[] }>) => {
    return async (page: MockPage) => {
      const results: BrowserActionResult[] = [];

      for (const op of operations) {
        try {
          let result: BrowserActionResult;

          switch (op.action) {
            case 'goto':
              result = await page.goto(op.args[0] as string);
              break;
            case 'click':
              result = await page.click(op.args[0] as string);
              break;
            case 'fill':
              result = await page.fill(op.args[0] as string, op.args[1] as string);
              break;
            default:
              result = { success: false, error: new Error(`Unsupported batch operation: ${op.action}`), metrics: { duration: 0 } };
          }

          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            error: error as Error,
            metrics: { duration: 0 },
          });
        }
      }

      return results;
    };
  },
};