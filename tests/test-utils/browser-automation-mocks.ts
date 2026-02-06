/**
 * @fileoverview Browser Automation Mock Utilities
 *
 * Comprehensive mocking utilities for browser automation testing that provide:
 * - Mock browser instances for unit testing without actual browser dependencies
 * - Simulated page interactions and navigation behaviors
 * - Permission request/response simulation for browser automation contexts
 * - Browser resource state simulation and validation
 * - Performance monitoring mock infrastructure
 *
 * @module tests/test-utils/browser-automation-mocks
 */

import { vi, type MockedFunction } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { Page, BrowserContext, Browser, Locator, Response } from 'playwright';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Configuration for browser automation mock behavior
 */
export interface BrowserMockConfig {
  /** Mock page URL */
  url?: string;
  /** Mock page title */
  title?: string;
  /** Whether to simulate slow network conditions */
  simulateSlowNetwork?: boolean;
  /** Whether to simulate permission denials */
  simulatePermissionDenials?: boolean;
  /** Mock viewport dimensions */
  viewport?: { width: number; height: number };
  /** Mock console messages to emit */
  consoleMessages?: Array<{ type: 'log' | 'warn' | 'error'; text: string }>;
  /** Whether to simulate browser crashes */
  simulateCrashes?: boolean;
  /** Network delay in milliseconds */
  networkDelay?: number;
}

/**
 * Mock browser automation context for testing
 */
export interface MockBrowserContext {
  browser: MockedBrowser;
  context: MockedBrowserContext;
  page: MockedPage;
  config: BrowserMockConfig;
  state: {
    isNavigating: boolean;
    currentUrl: string;
    screenshots: string[];
    consoleMessages: Array<{ type: string; text: string; timestamp: number }>;
  };
}

/**
 * Mock browser instance interface
 */
export interface MockedBrowser {
  newContext: MockedFunction<(...args: any[]) => Promise<MockedBrowserContext>>;
  close: MockedFunction<() => Promise<void>>;
  isConnected: MockedFunction<() => boolean>;
  contexts: MockedFunction<() => MockedBrowserContext[]>;
  version: MockedFunction<() => string>;
}

/**
 * Mock browser context interface
 */
export interface MockedBrowserContext {
  newPage: MockedFunction<(...args: any[]) => Promise<MockedPage>>;
  close: MockedFunction<() => Promise<void>>;
  pages: MockedFunction<() => MockedPage[]>;
  clearCookies: MockedFunction<() => Promise<void>>;
  storageState: MockedFunction<() => Promise<any>>;
  setExtraHTTPHeaders: MockedFunction<(headers: Record<string, string>) => Promise<void>>;
}

/**
 * Mock page interface with comprehensive browser automation methods
 */
export interface MockedPage {
  // Navigation methods
  goto: MockedFunction<(url: string, options?: any) => Promise<Response | null>>;
  goBack: MockedFunction<(options?: any) => Promise<Response | null>>;
  goForward: MockedFunction<(options?: any) => Promise<Response | null>>;
  reload: MockedFunction<(options?: any) => Promise<Response | null>>;

  // Content methods
  setContent: MockedFunction<(html: string, options?: any) => Promise<void>>;
  content: MockedFunction<() => Promise<string>>;
  title: MockedFunction<() => Promise<string>>;
  url: MockedFunction<() => string>;

  // Element interaction methods
  locator: MockedFunction<(selector: string) => MockedLocator>;
  click: MockedFunction<(selector: string, options?: any) => Promise<void>>;
  type: MockedFunction<(selector: string, text: string, options?: any) => Promise<void>>;
  fill: MockedFunction<(selector: string, text: string, options?: any) => Promise<void>>;

  // Wait methods
  waitForSelector: MockedFunction<(selector: string, options?: any) => Promise<MockedLocator | null>>;
  waitForLoadState: MockedFunction<(state?: string, options?: any) => Promise<void>>;
  waitForTimeout: MockedFunction<(timeout: number) => Promise<void>>;
  waitForFunction: MockedFunction<(pageFunction: string | Function, arg?: any, options?: any) => Promise<any>>;

  // Screenshot and media
  screenshot: MockedFunction<(options?: any) => Promise<Buffer>>;
  video: MockedFunction<() => any>;

  // Script execution
  evaluate: MockedFunction<(pageFunction: string | Function, arg?: any) => Promise<any>>;
  evaluateHandle: MockedFunction<(pageFunction: string | Function, arg?: any) => Promise<any>>;
  addScriptTag: MockedFunction<(options: any) => Promise<any>>;

  // Event handling
  on: MockedFunction<(event: string, handler: Function) => void>;
  off: MockedFunction<(event: string, handler: Function) => void>;
  once: MockedFunction<(event: string, handler: Function) => void>;

  // Cleanup
  close: MockedFunction<() => Promise<void>>;

  // Configuration methods
  setDefaultTimeout: MockedFunction<(timeout: number) => void>;
  setDefaultNavigationTimeout: MockedFunction<(timeout: number) => void>;
  setViewportSize: MockedFunction<(size: { width: number; height: number }) => Promise<void>>;

  // Context and browser access
  context: MockedFunction<() => MockedBrowserContext>;

  // Internal state for testing
  _mockState: {
    isNavigating: boolean;
    currentUrl: string;
    currentContent: string;
    currentTitle: string;
    screenshots: string[];
    consoleMessages: Array<{ type: string; text: string; timestamp: number }>;
    eventListeners: Map<string, Function[]>;
  };
}

/**
 * Mock locator interface
 */
export interface MockedLocator {
  click: MockedFunction<(options?: any) => Promise<void>>;
  type: MockedFunction<(text: string, options?: any) => Promise<void>>;
  fill: MockedFunction<(text: string, options?: any) => Promise<void>>;
  waitFor: MockedFunction<(options?: any) => Promise<void>>;
  isVisible: MockedFunction<(options?: any) => Promise<boolean>>;
  textContent: MockedFunction<(options?: any) => Promise<string | null>>;
  getAttribute: MockedFunction<(name: string, options?: any) => Promise<string | null>>;
  count: MockedFunction<() => Promise<number>>;
  first: MockedFunction<() => MockedLocator>;
  last: MockedFunction<() => MockedLocator>;
  nth: MockedFunction<(index: number) => MockedLocator>;
}

// ============================================================================
// Mock Implementations
// ============================================================================

/**
 * Creates a mock browser automation context for testing
 */
export function createMockBrowserContext(config: BrowserMockConfig = {}): MockBrowserContext {
  const mockConfig: BrowserMockConfig = {
    url: 'http://localhost:3000',
    title: 'Test Page',
    simulateSlowNetwork: false,
    simulatePermissionDenials: false,
    viewport: { width: 1280, height: 720 },
    consoleMessages: [],
    simulateCrashes: false,
    networkDelay: 0,
    ...config,
  };

  // Create mock page with comprehensive state
  const mockPage = createMockPage(mockConfig);

  // Create mock browser context
  const mockBrowserContext = createMockBrowserContextInstance(mockPage);

  // Create mock browser
  const mockBrowser = createMockBrowserInstance(mockBrowserContext);

  const browserContext: MockBrowserContext = {
    browser: mockBrowser,
    context: mockBrowserContext,
    page: mockPage,
    config: mockConfig,
    state: {
      isNavigating: false,
      currentUrl: mockConfig.url || 'about:blank',
      screenshots: [],
      consoleMessages: [],
    },
  };

  return browserContext;
}

/**
 * Creates a comprehensive mock page instance
 */
function createMockPage(config: BrowserMockConfig): MockedPage {
  const mockState = {
    isNavigating: false,
    currentUrl: config.url || 'about:blank',
    currentContent: '<html><body><h1>Test Page</h1></body></html>',
    currentTitle: config.title || 'Test Page',
    screenshots: [],
    consoleMessages: config.consoleMessages || [],
    eventListeners: new Map<string, Function[]>(),
  };

  const mockPage = {
    // Navigation methods
    goto: vi.fn().mockImplementation(async (url: string, options?: any) => {
      mockState.isNavigating = true;

      if (config.networkDelay) {
        await new Promise(resolve => setTimeout(resolve, config.networkDelay));
      }

      mockState.currentUrl = url;
      mockState.isNavigating = false;

      // Emit navigation events
      const listeners = mockState.eventListeners.get('load') || [];
      listeners.forEach(listener => listener());

      return null; // Mock response
    }),

    goBack: vi.fn().mockResolvedValue(null),
    goForward: vi.fn().mockResolvedValue(null),
    reload: vi.fn().mockResolvedValue(null),

    // Content methods
    setContent: vi.fn().mockImplementation(async (html: string) => {
      mockState.currentContent = html;
    }),

    content: vi.fn().mockImplementation(async () => mockState.currentContent),
    title: vi.fn().mockImplementation(async () => mockState.currentTitle),
    url: vi.fn().mockImplementation(() => mockState.currentUrl),

    // Element interaction methods
    locator: vi.fn().mockImplementation((selector: string) => createMockLocator(selector)),
    click: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),

    // Wait methods
    waitForSelector: vi.fn().mockImplementation(async (selector: string, options?: any) => {
      if (config.simulateSlowNetwork) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return createMockLocator(selector);
    }),

    waitForLoadState: vi.fn().mockImplementation(async (state?: string, options?: any) => {
      if (config.simulateSlowNetwork) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }),

    waitForTimeout: vi.fn().mockImplementation(async (timeout: number) => {
      await new Promise(resolve => setTimeout(resolve, timeout));
    }),

    waitForFunction: vi.fn().mockResolvedValue(undefined),

    // Screenshot and media
    screenshot: vi.fn().mockImplementation(async (options?: any) => {
      const screenshotPath = options?.path || 'mock-screenshot.png';
      mockState.screenshots.push(screenshotPath);
      return Buffer.from('mock-screenshot-data');
    }),

    video: vi.fn().mockReturnValue(null),

    // Script execution
    evaluate: vi.fn().mockImplementation(async (pageFunction: string | Function, arg?: any) => {
      // Simulate common browser API calls
      if (typeof pageFunction === 'string') {
        if (pageFunction.includes('window.performance')) {
          return { loadEventEnd: 1000, navigationStart: 0 };
        }
        if (pageFunction.includes('document.title')) {
          return mockState.currentTitle;
        }
        if (pageFunction.includes('localStorage.clear')) {
          return undefined;
        }
        if (pageFunction.includes('sessionStorage.clear')) {
          return undefined;
        }
      }
      return null;
    }),

    evaluateHandle: vi.fn().mockResolvedValue({}),
    addScriptTag: vi.fn().mockResolvedValue({}),

    // Event handling
    on: vi.fn().mockImplementation((event: string, handler: Function) => {
      if (!mockState.eventListeners.has(event)) {
        mockState.eventListeners.set(event, []);
      }
      mockState.eventListeners.get(event)!.push(handler);
    }),

    off: vi.fn().mockImplementation((event: string, handler: Function) => {
      const listeners = mockState.eventListeners.get(event) || [];
      const index = listeners.indexOf(handler);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }),

    once: vi.fn().mockImplementation((event: string, handler: Function) => {
      const wrappedHandler = (...args: any[]) => {
        handler(...args);
        mockPage.off(event, wrappedHandler);
      };
      mockPage.on(event, wrappedHandler);
    }),

    // Cleanup
    close: vi.fn().mockResolvedValue(undefined),

    // Configuration methods
    setDefaultTimeout: vi.fn(),
    setDefaultNavigationTimeout: vi.fn(),
    setViewportSize: vi.fn().mockResolvedValue(undefined),

    // Context access
    context: vi.fn(),

    // Internal state
    _mockState: mockState,
  };

  // Set up context reference
  mockPage.context.mockImplementation(() => createMockBrowserContextInstance(mockPage));

  return mockPage as MockedPage;
}

/**
 * Creates a mock locator instance
 */
function createMockLocator(selector: string): MockedLocator {
  return {
    click: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    waitFor: vi.fn().mockResolvedValue(undefined),
    isVisible: vi.fn().mockResolvedValue(true),
    textContent: vi.fn().mockResolvedValue(`Mock text for ${selector}`),
    getAttribute: vi.fn().mockResolvedValue('mock-attribute-value'),
    count: vi.fn().mockResolvedValue(1),
    first: vi.fn().mockReturnValue(createMockLocator(`${selector}:first`)),
    last: vi.fn().mockReturnValue(createMockLocator(`${selector}:last`)),
    nth: vi.fn().mockImplementation((index: number) => createMockLocator(`${selector}:nth(${index})`)),
  };
}

/**
 * Creates a mock browser context instance
 */
function createMockBrowserContextInstance(mockPage: MockedPage): MockedBrowserContext {
  return {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
    pages: vi.fn().mockReturnValue([mockPage]),
    clearCookies: vi.fn().mockResolvedValue(undefined),
    storageState: vi.fn().mockResolvedValue({}),
    setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Creates a mock browser instance
 */
function createMockBrowserInstance(mockContext: MockedBrowserContext): MockedBrowser {
  return {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    contexts: vi.fn().mockReturnValue([mockContext]),
    version: vi.fn().mockReturnValue('mock-browser-version'),
  };
}

// ============================================================================
// Browser Automation Test Utilities
// ============================================================================

/**
 * Mock browser automation environment manager
 */
export class MockBrowserEnvironment extends EventEmitter {
  private mockContext: MockBrowserContext;
  private isSetup: boolean = false;

  constructor(config: BrowserMockConfig = {}) {
    super();
    this.mockContext = createMockBrowserContext(config);
  }

  /**
   * Setup mock browser environment
   */
  async setup(): Promise<void> {
    if (this.isSetup) {
      return;
    }

    this.isSetup = true;
    this.emit('setup:complete', this.mockContext);
  }

  /**
   * Teardown mock browser environment
   */
  async teardown(): Promise<void> {
    if (!this.isSetup) {
      return;
    }

    await this.mockContext.page.close();
    await this.mockContext.context.close();
    await this.mockContext.browser.close();

    this.isSetup = false;
    this.emit('teardown:complete');
  }

  /**
   * Get mock browser context
   */
  getContext(): MockBrowserContext {
    return this.mockContext;
  }

  /**
   * Simulate browser permission request
   */
  async simulatePermissionRequest(
    operation: string,
    options: any = {}
  ): Promise<{ granted: boolean; reason?: string }> {
    const shouldDeny = this.mockContext.config.simulatePermissionDenials;

    if (shouldDeny) {
      return {
        granted: false,
        reason: `Mock permission denied for operation: ${operation}`,
      };
    }

    return { granted: true };
  }

  /**
   * Simulate browser automation error
   */
  simulateError(type: 'navigation' | 'interaction' | 'permission' | 'crash', message: string): void {
    this.emit('error:simulated', { type, message, timestamp: Date.now() });
  }

  /**
   * Get mock browser state
   */
  getState(): any {
    return {
      isSetup: this.isSetup,
      context: this.mockContext.state,
      pageState: this.mockContext.page._mockState,
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create mock browser automation environment for testing
 */
export function createMockBrowserEnvironment(config?: BrowserMockConfig): MockBrowserEnvironment {
  return new MockBrowserEnvironment(config);
}

/**
 * Mock Playwright browser imports for unit testing
 */
export function mockPlaywrightBrowser(): void {
  vi.mock('playwright', () => {
    const mockBrowser = createMockBrowserContext().browser;

    return {
      chromium: {
        launch: vi.fn().mockResolvedValue(mockBrowser),
      },
      firefox: {
        launch: vi.fn().mockResolvedValue(mockBrowser),
      },
      webkit: {
        launch: vi.fn().mockResolvedValue(mockBrowser),
      },
    };
  });
}

/**
 * Mock Puppeteer browser imports for unit testing
 */
export function mockPuppeteerBrowser(): void {
  vi.mock('puppeteer', () => ({
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn().mockResolvedValue({}),
        screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
        close: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue(null),
        click: vi.fn().mockResolvedValue(undefined),
        type: vi.fn().mockResolvedValue(undefined),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  }));
}

/**
 * Simulate browser automation permission scenarios
 */
export interface BrowserPermissionScenario {
  operation: string;
  shouldGrant: boolean;
  reason?: string;
  delay?: number;
}

export function createPermissionScenarioMock(
  scenarios: BrowserPermissionScenario[]
): (operation: string) => Promise<{ granted: boolean; reason?: string }> {
  return async (operation: string) => {
    const scenario = scenarios.find(s => s.operation === operation);

    if (!scenario) {
      return { granted: true };
    }

    if (scenario.delay) {
      await new Promise(resolve => setTimeout(resolve, scenario.delay));
    }

    return {
      granted: scenario.shouldGrant,
      reason: scenario.reason,
    };
  };
}

// ============================================================================
// Exports
// ============================================================================

export type {
  BrowserMockConfig,
  MockBrowserContext,
  MockedBrowser,
  MockedBrowserContext,
  MockedPage,
  MockedLocator,
  BrowserPermissionScenario,
};