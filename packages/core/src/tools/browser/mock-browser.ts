/**
 * @fileoverview Mock browser automation classes and interfaces
 *
 * Provides mock implementations for browser automation operations to support
 * testing scenarios with configurable success/failure simulation. These mocks
 * enable comprehensive testing of browser automation workflows without requiring
 * actual browser instances.
 *
 * Features:
 * - Mock page, element, and browser instances
 * - Configurable success/failure scenarios
 * - Screenshot simulation with base64 data
 * - Element interaction simulation
 * - JavaScript evaluation mocking
 * - Network request interception simulation
 * - Console message and error capturing
 *
 * ## Architecture Decision Record (ADR-028)
 *
 * ### Context
 * APEX agents need to test browser automation workflows without actual browsers.
 * Tests should be able to simulate various browser states, network conditions,
 * and user interaction scenarios in a deterministic, fast manner.
 *
 * ### Decision
 * Implement mock browser classes that:
 * 1. Follow the same interface patterns as real browser automation libraries
 * 2. Support configurable behavior for success/failure scenarios
 * 3. Provide realistic simulation of browser operations
 * 4. Include comprehensive error simulation capabilities
 * 5. Enable testing of edge cases and error handling
 *
 * ### Consequences
 * - Fast, deterministic testing without browser overhead
 * - Comprehensive simulation of browser automation scenarios
 * - Easy testing of error handling and edge cases
 * - Consistent interfaces for both mock and real implementations
 *
 * @module @apex/core/tools/browser/mock-browser
 */

import { z } from 'zod';
import type {
  BrowserOperation,
  BrowserToolInput,
  BrowserToolOutput,
  ScreenshotComparisonResult,
  ConsoleMessage,
  BrowserError,
} from '../../types.js';

// ============================================================================
// Mock Configuration Types
// ============================================================================

/**
 * Simulation mode for mock browser behavior
 */
export const MockBrowserModeSchema = z.enum([
  'success',          // Always succeed
  'failure',          // Always fail
  'intermittent',     // Randomly succeed/fail based on probability
  'sequence',         // Follow a predefined sequence of outcomes
  'realistic',        // Simulate realistic delays and occasional failures
]);
export type MockBrowserMode = z.infer<typeof MockBrowserModeSchema>;

/**
 * Error types that can be simulated
 */
export const MockBrowserErrorTypeSchema = z.enum([
  'timeout',          // Operation timeout
  'element_not_found', // Element selector not found
  'network_error',    // Network connection issues
  'javascript_error', // JavaScript execution error
  'navigation_error', // Page navigation error
  'permission_denied', // Operation not allowed
  'browser_crash',    // Browser process crash
  'invalid_selector', // CSS selector is invalid
]);
export type MockBrowserErrorType = z.infer<typeof MockBrowserErrorTypeSchema>;

/**
 * Network conditions that can be simulated
 */
export const MockNetworkConditionSchema = z.object({
  /** Latency in milliseconds */
  latency: z.number().min(0).default(0),
  /** Packet loss probability (0-1) */
  packetLoss: z.number().min(0).max(1).default(0),
  /** Connection failure probability (0-1) */
  connectionFailure: z.number().min(0).max(1).default(0),
  /** Timeout probability (0-1) */
  timeoutProbability: z.number().min(0).max(1).default(0),
});
export type MockNetworkCondition = z.infer<typeof MockNetworkConditionSchema>;

/**
 * Configuration for a single operation outcome
 */
export const MockOperationOutcomeSchema = z.object({
  /** Whether this operation should succeed */
  success: z.boolean(),
  /** Error type if operation fails */
  errorType: MockBrowserErrorTypeSchema.optional(),
  /** Custom error message */
  errorMessage: z.string().optional(),
  /** Delay before operation completes (ms) */
  delay: z.number().min(0).default(0),
  /** Custom result data for successful operations */
  result: z.unknown().optional(),
});
export type MockOperationOutcome = z.infer<typeof MockOperationOutcomeSchema>;

/**
 * Complete configuration for mock browser behavior
 */
export const MockBrowserConfigSchema = z.object({
  /** Overall simulation mode */
  mode: MockBrowserModeSchema.default('success'),

  /** For intermittent mode: probability of success (0-1) */
  successProbability: z.number().min(0).max(1).default(0.8),

  /** For sequence mode: ordered list of operation outcomes */
  operationSequence: z.array(MockOperationOutcomeSchema).default([]),

  /** Per-operation configuration overrides */
  operationOverrides: z.record(
    z.enum([
      'navigate', 'click', 'type', 'screenshot', 'compareScreenshot',
      'evaluate', 'submit', 'waitForSelector', 'getAttribute',
      'getText', 'getHtml', 'scroll', 'hover'
    ]),
    MockOperationOutcomeSchema
  ).default({}),

  /** Network condition simulation */
  networkConditions: MockNetworkConditionSchema.default({}),

  /** Default delays for realistic mode (ms) */
  realisticDelays: z.object({
    navigate: z.number().min(0).default(500),
    click: z.number().min(0).default(50),
    type: z.number().min(0).default(100),
    screenshot: z.number().min(0).default(200),
    evaluate: z.number().min(0).default(75),
  }).default({}),

  /** Whether to simulate console messages */
  simulateConsole: z.boolean().default(false),

  /** Predefined console messages to emit */
  consoleMessages: z.array(z.object({
    severity: z.enum(['log', 'info', 'warn', 'error', 'debug', 'trace']),
    message: z.string(),
    operation: z.string().optional(), // Operation that triggers this message
  })).default([]),

  /** Whether to simulate browser errors */
  simulateErrors: z.boolean().default(false),

  /** Predefined browser errors to emit */
  browserErrors: z.array(z.object({
    name: z.string(),
    message: z.string(),
    operation: z.string().optional(), // Operation that triggers this error
  })).default([]),

  /** Mock page title */
  pageTitle: z.string().default('Mock Page Title'),

  /** Mock page URL */
  currentUrl: z.string().default('https://mock.example.com'),

  /** Mock viewport dimensions */
  viewport: z.object({
    width: z.number().min(1).default(1280),
    height: z.number().min(1).default(720),
  }).default({}),
});
export type MockBrowserConfig = z.infer<typeof MockBrowserConfigSchema>;

// ============================================================================
// Mock Element Interface
// ============================================================================

/**
 * Mock element that simulates DOM element interactions
 */
export interface MockElement {
  /** Element tag name */
  tagName: string;
  /** Element attributes */
  attributes: Record<string, string>;
  /** Element text content */
  textContent: string;
  /** Element HTML content */
  innerHTML: string;
  /** Whether element is visible */
  visible: boolean;
  /** Element bounding box */
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;

  /** Click the element */
  click(options?: { delay?: number; force?: boolean }): Promise<void>;

  /** Type text into the element */
  type(text: string, options?: { delay?: number; clear?: boolean }): Promise<void>;

  /** Hover over the element */
  hover(): Promise<void>;

  /** Get element attribute */
  getAttribute(name: string): Promise<string | null>;

  /** Get element text */
  getText(): Promise<string>;

  /** Get element HTML */
  getHtml(): Promise<string>;

  /** Check if element is visible */
  isVisible(): Promise<boolean>;

  /** Wait for element state */
  waitForState(state: 'attached' | 'detached' | 'visible' | 'hidden', options?: { timeout?: number }): Promise<void>;
}

// ============================================================================
// Mock Page Interface
// ============================================================================

/**
 * Mock page that simulates browser page interactions
 */
export interface MockPage {
  /** Current page URL */
  url(): string;

  /** Page title */
  title(): Promise<string>;

  /** Navigate to URL */
  goto(url: string, options?: { timeout?: number }): Promise<void>;

  /** Find element by selector */
  $(selector: string): Promise<MockElement | null>;

  /** Find all elements by selector */
  $$(selector: string): Promise<MockElement[]>;

  /** Wait for selector */
  waitForSelector(
    selector: string,
    options?: { timeout?: number; state?: 'attached' | 'detached' | 'visible' | 'hidden' }
  ): Promise<MockElement>;

  /** Take screenshot */
  screenshot(options?: {
    path?: string;
    fullPage?: boolean;
    format?: 'png' | 'jpeg';
    quality?: number
  }): Promise<string>;

  /** Evaluate JavaScript */
  evaluate<T>(script: string | (() => T)): Promise<T>;

  /** Submit form */
  submitForm(selector: string): Promise<void>;

  /** Scroll page */
  scroll(options?: { x?: number; y?: number }): Promise<void>;

  /** Set viewport */
  setViewportSize(size: { width: number; height: number }): Promise<void>;

  /** Get console messages */
  getConsoleMessages(): ConsoleMessage[];

  /** Get browser errors */
  getBrowserErrors(): BrowserError[];

  /** Clear console messages */
  clearConsole(): void;

  /** Close page */
  close(): Promise<void>;
}

// ============================================================================
// Mock Browser Interface
// ============================================================================

/**
 * Mock browser that simulates browser instance management
 */
export interface MockBrowser {
  /** Create new page */
  newPage(): Promise<MockPage>;

  /** Get all pages */
  pages(): MockPage[];

  /** Close browser */
  close(): Promise<void>;

  /** Browser version */
  version(): string;

  /** Set user agent */
  setUserAgent(userAgent: string): Promise<void>;
}

// ============================================================================
// Mock Element Implementation
// ============================================================================

/**
 * Implementation of mock element with configurable behavior
 */
export class MockElementImpl implements MockElement {
  public tagName: string;
  public attributes: Record<string, string>;
  public textContent: string;
  public innerHTML: string;
  public visible: boolean;
  public boundingBox: { x: number; y: number; width: number; height: number } | null;

  private config: MockBrowserConfig;
  private operationCount = 0;

  constructor(
    selector: string,
    config: MockBrowserConfig,
    attributes: Record<string, string> = {}
  ) {
    this.config = config;
    this.tagName = attributes.tagName || this.inferTagFromSelector(selector);
    this.attributes = attributes;
    this.textContent = attributes.textContent || `Mock text for ${selector}`;
    this.innerHTML = attributes.innerHTML || `<span>${this.textContent}</span>`;
    this.visible = attributes.visible !== 'false';
    this.boundingBox = this.visible ? { x: 0, y: 0, width: 100, height: 30 } : null;
  }

  private inferTagFromSelector(selector: string): string {
    if (selector.includes('button')) return 'button';
    if (selector.includes('input')) return 'input';
    if (selector.includes('form')) return 'form';
    if (selector.includes('a')) return 'a';
    return 'div';
  }

  private async simulateOperation(operation: string): Promise<void> {
    const outcome = this.getOperationOutcome(operation);

    if (outcome.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, outcome.delay));
    }

    if (!outcome.success) {
      const errorType = outcome.errorType || 'element_not_found';
      const errorMessage = outcome.errorMessage || `Mock ${operation} operation failed`;
      throw new Error(`[${errorType}] ${errorMessage}`);
    }
  }

  private getOperationOutcome(operation: string): MockOperationOutcome {
    // Check operation-specific overrides first
    const override = this.config.operationOverrides[operation as keyof typeof this.config.operationOverrides];
    if (override) {
      return override;
    }

    // Handle sequence mode
    if (this.config.mode === 'sequence' && this.config.operationSequence.length > 0) {
      const index = this.operationCount % this.config.operationSequence.length;
      this.operationCount++;
      return this.config.operationSequence[index];
    }

    // Handle other modes
    switch (this.config.mode) {
      case 'failure':
        return { success: false, errorType: 'element_not_found' };

      case 'intermittent':
        return {
          success: Math.random() < this.config.successProbability,
          errorType: 'timeout'
        };

      case 'realistic':
        const delay = this.config.realisticDelays[operation as keyof typeof this.config.realisticDelays] || 50;
        return {
          success: Math.random() < 0.95, // 95% success rate
          delay,
          errorType: 'timeout'
        };

      case 'success':
      default:
        return { success: true, delay: 10 };
    }
  }

  async click(options?: { delay?: number; force?: boolean }): Promise<void> {
    await this.simulateOperation('click');
  }

  async type(text: string, options?: { delay?: number; clear?: boolean }): Promise<void> {
    await this.simulateOperation('type');
    if (options?.clear) {
      this.textContent = text;
    } else {
      this.textContent += text;
    }
  }

  async hover(): Promise<void> {
    await this.simulateOperation('hover');
  }

  async getAttribute(name: string): Promise<string | null> {
    await this.simulateOperation('getAttribute');
    return this.attributes[name] || null;
  }

  async getText(): Promise<string> {
    await this.simulateOperation('getText');
    return this.textContent;
  }

  async getHtml(): Promise<string> {
    await this.simulateOperation('getHtml');
    return this.innerHTML;
  }

  async isVisible(): Promise<boolean> {
    return this.visible;
  }

  async waitForState(
    state: 'attached' | 'detached' | 'visible' | 'hidden',
    options?: { timeout?: number }
  ): Promise<void> {
    await this.simulateOperation('waitForSelector');

    // Simulate state check
    const timeout = options?.timeout || 30000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const currentlyVisible = this.visible;

      if (
        (state === 'visible' && currentlyVisible) ||
        (state === 'hidden' && !currentlyVisible) ||
        (state === 'attached') ||
        (state === 'detached' && !currentlyVisible)
      ) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    throw new Error(`[timeout] Element did not reach state '${state}' within ${timeout}ms`);
  }
}

// ============================================================================
// Mock Page Implementation
// ============================================================================

/**
 * Implementation of mock page with configurable behavior
 */
export class MockPageImpl implements MockPage {
  private config: MockBrowserConfig;
  private currentUrl: string;
  private consoleMessages: ConsoleMessage[] = [];
  private browserErrors: BrowserError[] = [];
  private elements = new Map<string, MockElement>();
  private operationCount = 0;

  constructor(config: MockBrowserConfig) {
    this.config = config;
    this.currentUrl = config.currentUrl;
    this.setupDefaultElements();
  }

  private setupDefaultElements(): void {
    // Create some default mock elements
    const defaultElements = [
      { selector: 'body', tagName: 'body' },
      { selector: 'button', tagName: 'button' },
      { selector: 'input', tagName: 'input' },
      { selector: 'form', tagName: 'form' },
      { selector: '.content', tagName: 'div' },
    ];

    defaultElements.forEach(({ selector, tagName }) => {
      this.elements.set(selector, new MockElementImpl(selector, this.config, { tagName }));
    });
  }

  private async simulateOperation(operation: string): Promise<void> {
    const outcome = this.getOperationOutcome(operation);

    if (outcome.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, outcome.delay));
    }

    // Simulate network conditions
    if (this.config.networkConditions.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.networkConditions.latency));
    }

    if (Math.random() < this.config.networkConditions.connectionFailure) {
      throw new Error('[network_error] Connection failed');
    }

    if (Math.random() < this.config.networkConditions.timeoutProbability) {
      throw new Error('[timeout] Operation timed out');
    }

    if (!outcome.success) {
      const errorType = outcome.errorType || 'navigation_error';
      const errorMessage = outcome.errorMessage || `Mock ${operation} operation failed`;
      throw new Error(`[${errorType}] ${errorMessage}`);
    }

    // Emit console messages and errors if configured
    this.emitSimulatedMessages(operation);
  }

  private emitSimulatedMessages(operation: string): void {
    if (this.config.simulateConsole) {
      const messages = this.config.consoleMessages.filter(
        msg => !msg.operation || msg.operation === operation
      );

      messages.forEach(msg => {
        this.consoleMessages.push({
          severity: msg.severity as any,
          message: msg.message,
          timestamp: new Date(),
          sourceUrl: this.currentUrl,
        });
      });
    }

    if (this.config.simulateErrors) {
      const errors = this.config.browserErrors.filter(
        err => !err.operation || err.operation === operation
      );

      errors.forEach(err => {
        this.browserErrors.push({
          name: err.name,
          message: err.message,
          timestamp: new Date(),
          sourceUrl: this.currentUrl,
        });
      });
    }
  }

  private getOperationOutcome(operation: string): MockOperationOutcome {
    // Check operation-specific overrides first
    const override = this.config.operationOverrides[operation as keyof typeof this.config.operationOverrides];
    if (override) {
      return override;
    }

    // Handle sequence mode
    if (this.config.mode === 'sequence' && this.config.operationSequence.length > 0) {
      const index = this.operationCount % this.config.operationSequence.length;
      this.operationCount++;
      return this.config.operationSequence[index];
    }

    // Handle other modes
    switch (this.config.mode) {
      case 'failure':
        return { success: false, errorType: 'navigation_error' };

      case 'intermittent':
        return {
          success: Math.random() < this.config.successProbability,
          errorType: 'timeout'
        };

      case 'realistic':
        const delay = this.config.realisticDelays[operation as keyof typeof this.config.realisticDelays] || 100;
        return {
          success: Math.random() < 0.95, // 95% success rate
          delay,
          errorType: 'timeout'
        };

      case 'success':
      default:
        return { success: true, delay: 10 };
    }
  }

  url(): string {
    return this.currentUrl;
  }

  async title(): Promise<string> {
    await this.simulateOperation('title');
    return this.config.pageTitle;
  }

  async goto(url: string, options?: { timeout?: number }): Promise<void> {
    await this.simulateOperation('navigate');
    this.currentUrl = url;
  }

  async $(selector: string): Promise<MockElement | null> {
    await this.simulateOperation('querySelector');

    // Return existing element or create new one
    if (this.elements.has(selector)) {
      return this.elements.get(selector)!;
    }

    const element = new MockElementImpl(selector, this.config);
    this.elements.set(selector, element);
    return element;
  }

  async $$(selector: string): Promise<MockElement[]> {
    await this.simulateOperation('querySelectorAll');

    // Return array with single element for simplicity
    const element = await this.$(selector);
    return element ? [element] : [];
  }

  async waitForSelector(
    selector: string,
    options?: { timeout?: number; state?: 'attached' | 'detached' | 'visible' | 'hidden' }
  ): Promise<MockElement> {
    const element = await this.$(selector);
    if (!element) {
      throw new Error(`[element_not_found] Element ${selector} not found`);
    }

    if (options?.state) {
      await element.waitForState(options.state, { timeout: options.timeout });
    }

    return element;
  }

  async screenshot(options?: {
    path?: string;
    fullPage?: boolean;
    format?: 'png' | 'jpeg';
    quality?: number;
  }): Promise<string> {
    await this.simulateOperation('screenshot');

    // Return mock base64 screenshot data
    const mockScreenshot = this.generateMockScreenshot();
    return options?.path ? options.path : mockScreenshot;
  }

  private generateMockScreenshot(): string {
    // Generate a simple base64 encoded "screenshot" (1x1 transparent PNG)
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  }

  async evaluate<T>(script: string | (() => T)): Promise<T> {
    await this.simulateOperation('evaluate');

    // Simulate JavaScript evaluation
    if (typeof script === 'function') {
      try {
        return script();
      } catch (error) {
        throw new Error(`[javascript_error] ${error instanceof Error ? error.message : 'Script execution failed'}`);
      }
    }

    // For string scripts, return mock result
    if (script.includes('document.title')) {
      return this.config.pageTitle as T;
    }

    if (script.includes('window.location')) {
      return this.currentUrl as T;
    }

    return null as T;
  }

  async submitForm(selector: string): Promise<void> {
    await this.simulateOperation('submit');
    const form = await this.$(selector);
    if (!form) {
      throw new Error(`[element_not_found] Form ${selector} not found`);
    }
  }

  async scroll(options?: { x?: number; y?: number }): Promise<void> {
    await this.simulateOperation('scroll');
  }

  async setViewportSize(size: { width: number; height: number }): Promise<void> {
    await this.simulateOperation('setViewport');
    this.config.viewport = size;
  }

  getConsoleMessages(): ConsoleMessage[] {
    return [...this.consoleMessages];
  }

  getBrowserErrors(): BrowserError[] {
    return [...this.browserErrors];
  }

  clearConsole(): void {
    this.consoleMessages = [];
    this.browserErrors = [];
  }

  async close(): Promise<void> {
    await this.simulateOperation('close');
    this.elements.clear();
  }
}

// ============================================================================
// Mock Browser Implementation
// ============================================================================

/**
 * Implementation of mock browser with configurable behavior
 */
export class MockBrowserImpl implements MockBrowser {
  private config: MockBrowserConfig;
  private mockPages: MockPage[] = [];
  private userAgent = 'MockBrowser/1.0';

  constructor(config: MockBrowserConfig = {}) {
    this.config = MockBrowserConfigSchema.parse(config);
  }

  async newPage(): Promise<MockPage> {
    const page = new MockPageImpl(this.config);
    this.mockPages.push(page);
    return page;
  }

  pages(): MockPage[] {
    return [...this.mockPages];
  }

  async close(): Promise<void> {
    // Close all pages
    await Promise.all(this.mockPages.map(page => page.close()));
    this.mockPages = [];
  }

  version(): string {
    return 'MockBrowser 1.0.0';
  }

  async setUserAgent(userAgent: string): Promise<void> {
    this.userAgent = userAgent;
  }
}

// ============================================================================
// Browser Mock Factory Functions
// ============================================================================

/**
 * Creates a mock browser with success-only behavior
 */
export function createSuccessMockBrowser(config: Partial<MockBrowserConfig> = {}): MockBrowser {
  return new MockBrowserImpl({
    mode: 'success',
    ...config,
  });
}

/**
 * Creates a mock browser with failure-only behavior
 */
export function createFailureMockBrowser(
  errorType: MockBrowserErrorType = 'timeout',
  config: Partial<MockBrowserConfig> = {}
): MockBrowser {
  return new MockBrowserImpl({
    mode: 'failure',
    operationOverrides: {
      navigate: { success: false, errorType },
      click: { success: false, errorType },
      type: { success: false, errorType },
      screenshot: { success: false, errorType },
      evaluate: { success: false, errorType },
    },
    ...config,
  });
}

/**
 * Creates a mock browser with intermittent success/failure behavior
 */
export function createIntermittentMockBrowser(
  successProbability: number = 0.8,
  config: Partial<MockBrowserConfig> = {}
): MockBrowser {
  return new MockBrowserImpl({
    mode: 'intermittent',
    successProbability,
    ...config,
  });
}

/**
 * Creates a mock browser with realistic timing and occasional failures
 */
export function createRealisticMockBrowser(config: Partial<MockBrowserConfig> = {}): MockBrowser {
  return new MockBrowserImpl({
    mode: 'realistic',
    simulateConsole: true,
    simulateErrors: true,
    networkConditions: {
      latency: 50,
      packetLoss: 0.01,
      connectionFailure: 0.005,
      timeoutProbability: 0.01,
    },
    consoleMessages: [
      { severity: 'info', message: 'Page loaded successfully' },
      { severity: 'warn', message: 'Resource load warning', operation: 'navigate' },
    ],
    browserErrors: [
      { name: 'NetworkError', message: 'Failed to load resource', operation: 'navigate' },
    ],
    ...config,
  });
}

/**
 * Creates a mock browser that follows a specific sequence of operation outcomes
 */
export function createSequenceMockBrowser(
  sequence: MockOperationOutcome[],
  config: Partial<MockBrowserConfig> = {}
): MockBrowser {
  return new MockBrowserImpl({
    mode: 'sequence',
    operationSequence: sequence,
    ...config,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a mock screenshot comparison result
 */
export function createMockScreenshotComparison(
  isMatch: boolean = true,
  similarity: number = 1.0
): ScreenshotComparisonResult {
  return {
    isMatch,
    similarity,
    differentPixels: isMatch ? 0 : 1000,
    totalPixels: 100000,
    dimensions: { width: 1280, height: 720 },
    diffImagePath: isMatch ? undefined : '/tmp/diff.png',
  };
}

/**
 * Creates mock console messages for testing
 */
export function createMockConsoleMessages(): ConsoleMessage[] {
  return [
    {
      severity: 'info',
      message: 'Page initialized',
      timestamp: new Date(),
      sourceUrl: 'https://mock.example.com',
    },
    {
      severity: 'warn',
      message: 'Deprecated API usage',
      timestamp: new Date(),
      sourceUrl: 'https://mock.example.com',
      lineNumber: 42,
    },
    {
      severity: 'error',
      message: 'Script error occurred',
      timestamp: new Date(),
      sourceUrl: 'https://mock.example.com',
      lineNumber: 15,
      columnNumber: 30,
    },
  ];
}

/**
 * Creates mock browser errors for testing
 */
export function createMockBrowserErrors(): BrowserError[] {
  return [
    {
      name: 'TypeError',
      message: 'Cannot read property of undefined',
      timestamp: new Date(),
      sourceUrl: 'https://mock.example.com',
      lineNumber: 25,
    },
    {
      name: 'NetworkError',
      message: 'Failed to fetch resource',
      timestamp: new Date(),
      sourceUrl: 'https://mock.example.com',
    },
  ];
}

// Types are already exported inline above - no need to re-export