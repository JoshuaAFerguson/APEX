/**
 * @fileoverview Enhanced Error Page Fixture
 *
 * This module provides an advanced error page fixture system for comprehensive
 * error state testing. Built on the existing browser fixtures but with enhanced
 * configuration, lifecycle management, and integration capabilities.
 *
 * Key Features:
 * - Class-based fixture design with setup/teardown lifecycle
 * - Configurable error scenarios (404, 500, network errors, timeouts, etc.)
 * - Mock HTTP response simulation
 * - Integration with existing browser fixtures
 * - Helper hooks for easy test integration
 *
 * Architecture Decision:
 * This fixture system builds on the existing browser fixtures and error page
 * scenarios, providing a higher-level interface that's easier to use in tests
 * while maintaining compatibility with existing patterns.
 *
 * @see browser-fixtures.ts for base browser state management
 * @see ../../../tests/browser-integration/fixtures/error-page-scenarios.ts for Playwright-based scenarios
 */

import type { BrowserState } from './types.js';
import { browserFixtures, browserHelpers } from './browser-fixtures.js';

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Configuration for an error page fixture scenario.
 * Defines the error condition, expected state, and validation criteria.
 */
export interface ErrorFixtureConfig {
  /** Human-readable name for the error scenario */
  name: string;
  /** Description of the error condition */
  description: string;
  /** Error scenario type */
  scenario: ErrorScenario;
  /** HTTP status code (0 for network errors) */
  statusCode: number;
  /** HTTP status text */
  statusText: string;
  /** Error category for classification */
  category: 'client' | 'server' | 'network' | 'timeout';
  /** Expected page URL after error */
  expectedUrl?: string;
  /** Expected page title */
  expectedTitle?: string;
  /** Expected visible content on error page */
  expectedContent?: string[];
  /** Expected console error messages */
  expectedConsoleErrors?: string[];
  /** Custom error data payload */
  errorData?: Record<string, unknown>;
  /** Whether this error should clear authentication */
  clearsAuth?: boolean;
  /** Mock response configuration */
  mockResponse?: {
    headers?: Record<string, string>;
    body?: string;
    delay?: number;
  };
  /** Timeout for operations in milliseconds */
  timeout?: number;
}

/**
 * Current state of the error page fixture.
 * Tracks active configurations, browser state, and cleanup requirements.
 */
export interface ErrorFixtureState {
  /** Active error configuration */
  config: ErrorFixtureConfig;
  /** Current browser state */
  browserState: BrowserState;
  /** Active route patterns being intercepted */
  activeRoutes: string[];
  /** Mock functions and handlers that need cleanup */
  activeMocks: Map<string, (...args: any[]) => any>;
  /** Cleanup functions to run on teardown */
  cleanupTasks: Array<() => void | Promise<void>>;
  /** Whether the fixture has been set up */
  isSetup: boolean;
  /** Timestamp when fixture was created */
  createdAt: Date;
  /** Additional state data */
  metadata: Record<string, unknown>;
}

/**
 * Main interface for error page fixtures.
 * Provides lifecycle management and state manipulation.
 */
export interface IErrorPageFixture {
  /** Current fixture state */
  readonly state: Readonly<ErrorFixtureState>;

  /** Set up the error page fixture with the given configuration */
  setup(config: ErrorFixtureConfig): Promise<void>;

  /** Clean up the fixture and restore original state */
  teardown(): Promise<void>;

  /** Validate that current state matches expected error conditions */
  validate(): Promise<{ valid: boolean; errors: string[] }>;

  /** Update the browser state */
  updateBrowserState(updates: Partial<BrowserState>): void;

  /** Simulate a specific error scenario */
  simulateError(scenario: ErrorScenario): Promise<void>;

  /** Add a cleanup task to run during teardown */
  addCleanupTask(task: () => void | Promise<void>): void;

  /** Get the current browser state as a snapshot */
  getBrowserState(): BrowserState;

  /** Check if fixture is currently set up */
  isSetup(): boolean;
}

// ============================================================================
// Error Scenario Definitions
// ============================================================================

/**
 * Supported error scenarios for the fixture.
 * Each scenario defines specific error conditions and expected behavior.
 */
export type ErrorScenario =
  | '404-not-found'
  | '403-forbidden'
  | '500-internal-error'
  | '502-bad-gateway'
  | '503-service-unavailable'
  | '429-rate-limited'
  | 'network-timeout'
  | 'connection-refused'
  | 'dns-failure'
  | 'ssl-error'
  | 'javascript-error'
  | 'load-timeout';

/**
 * Predefined error configurations for common scenarios.
 * These can be used directly or as templates for custom configurations.
 */
export const ERROR_SCENARIOS: Record<ErrorScenario, Omit<ErrorFixtureConfig, 'name' | 'description'>> = {
  '404-not-found': {
    scenario: '404-not-found',
    statusCode: 404,
    statusText: 'Not Found',
    category: 'client',
    expectedTitle: 'Error 404 - Page Not Found',
    expectedContent: ['Not Found', 'The requested resource could not be found'],
    expectedConsoleErrors: ['404: Resource not found'],
    clearsAuth: false,
    timeout: 10000,
  },

  '403-forbidden': {
    scenario: '403-forbidden',
    statusCode: 403,
    statusText: 'Forbidden',
    category: 'client',
    expectedTitle: 'Error 403 - Access Denied',
    expectedContent: ['Forbidden', 'You do not have permission to access this resource'],
    expectedConsoleErrors: ['403: Access denied'],
    clearsAuth: false,
    timeout: 10000,
  },

  '500-internal-error': {
    scenario: '500-internal-error',
    statusCode: 500,
    statusText: 'Internal Server Error',
    category: 'server',
    expectedTitle: 'Error 500 - Internal Server Error',
    expectedContent: ['Internal Server Error', 'The server encountered an unexpected error'],
    expectedConsoleErrors: ['500: Internal server error'],
    clearsAuth: true,
    timeout: 10000,
  },

  '502-bad-gateway': {
    scenario: '502-bad-gateway',
    statusCode: 502,
    statusText: 'Bad Gateway',
    category: 'server',
    expectedTitle: 'Error 502 - Bad Gateway',
    expectedContent: ['Bad Gateway', 'The server received an invalid response from upstream'],
    expectedConsoleErrors: ['502: Bad gateway'],
    clearsAuth: false,
    timeout: 10000,
  },

  '503-service-unavailable': {
    scenario: '503-service-unavailable',
    statusCode: 503,
    statusText: 'Service Unavailable',
    category: 'server',
    expectedTitle: 'Error 503 - Service Unavailable',
    expectedContent: ['Service Unavailable', 'The server is temporarily unable to handle requests'],
    expectedConsoleErrors: ['503: Service unavailable'],
    clearsAuth: false,
    timeout: 10000,
  },

  '429-rate-limited': {
    scenario: '429-rate-limited',
    statusCode: 429,
    statusText: 'Too Many Requests',
    category: 'client',
    expectedTitle: 'Error 429 - Rate Limited',
    expectedContent: ['Too Many Requests', 'You have exceeded the rate limit'],
    expectedConsoleErrors: ['429: Rate limit exceeded'],
    clearsAuth: false,
    timeout: 10000,
  },

  'network-timeout': {
    scenario: 'network-timeout',
    statusCode: 0,
    statusText: 'Network Timeout',
    category: 'network',
    expectedTitle: 'Network Error - Request Timeout',
    expectedContent: ['Network Timeout', 'The request timed out'],
    expectedConsoleErrors: ['NetworkError: Request timeout'],
    clearsAuth: true,
    timeout: 15000,
  },

  'connection-refused': {
    scenario: 'connection-refused',
    statusCode: 0,
    statusText: 'Connection Refused',
    category: 'network',
    expectedTitle: 'Network Error - Connection Refused',
    expectedContent: ['Connection Refused', 'Unable to connect to the server'],
    expectedConsoleErrors: ['NetworkError: Connection refused'],
    clearsAuth: true,
    timeout: 10000,
  },

  'dns-failure': {
    scenario: 'dns-failure',
    statusCode: 0,
    statusText: 'DNS Resolution Failed',
    category: 'network',
    expectedTitle: 'Network Error - DNS Failure',
    expectedContent: ['DNS Resolution Failed', 'Unable to resolve the domain name'],
    expectedConsoleErrors: ['NetworkError: DNS resolution failed'],
    clearsAuth: true,
    timeout: 10000,
  },

  'ssl-error': {
    scenario: 'ssl-error',
    statusCode: 0,
    statusText: 'SSL Certificate Error',
    category: 'network',
    expectedTitle: 'Security Error - SSL Certificate',
    expectedContent: ['SSL Certificate Error', 'The security certificate is invalid'],
    expectedConsoleErrors: ['SecurityError: SSL certificate invalid'],
    clearsAuth: true,
    timeout: 10000,
  },

  'javascript-error': {
    scenario: 'javascript-error',
    statusCode: 200,
    statusText: 'OK',
    category: 'client',
    expectedTitle: 'Application Error',
    expectedContent: ['JavaScript Error', 'An error occurred while loading the page'],
    expectedConsoleErrors: ['TypeError: Cannot read property of undefined'],
    clearsAuth: false,
    timeout: 10000,
  },

  'load-timeout': {
    scenario: 'load-timeout',
    statusCode: 0,
    statusText: 'Load Timeout',
    category: 'timeout',
    expectedTitle: 'Timeout Error - Page Load',
    expectedContent: ['Page Load Timeout', 'The page took too long to load'],
    expectedConsoleErrors: ['TimeoutError: Page load exceeded timeout'],
    clearsAuth: false,
    timeout: 30000,
  },
} as const;

// ============================================================================
// Main Error Page Fixture Implementation
// ============================================================================

/**
 * Implementation of the error page fixture system.
 * Provides comprehensive error state testing capabilities with lifecycle management.
 */
export class ErrorPageFixture implements IErrorPageFixture {
  private _state: ErrorFixtureState;

  constructor() {
    this._state = this.createInitialState();
  }

  /** Get current fixture state as readonly */
  get state(): Readonly<ErrorFixtureState> {
    return this._state;
  }

  /** Set up the error page fixture with the given configuration */
  async setup(config: ErrorFixtureConfig): Promise<void> {
    if (this._state.isSetup) {
      throw new Error('Error page fixture is already set up. Call teardown() first.');
    }

    // Update state with new configuration
    this._state.config = config;
    this._state.isSetup = true;

    // Create initial browser state based on error scenario
    this._state.browserState = this.createErrorBrowserState(config);

    // Set up mock responses and error conditions
    await this.setupErrorConditions(config);

    // Add default cleanup for teardown
    this.addCleanupTask(() => {
      this._state.isSetup = false;
    });
  }

  /** Clean up the fixture and restore original state */
  async teardown(): Promise<void> {
    if (!this._state.isSetup) {
      return; // Already torn down or never set up
    }

    // Run all cleanup tasks in reverse order
    for (const cleanup of [...this._state.cleanupTasks].reverse()) {
      try {
        await cleanup();
      } catch (error) {
        // Log cleanup errors but don't throw to allow other cleanups to run
        console.warn('Error during fixture cleanup:', error);
      }
    }

    // Reset state
    this._state = this.createInitialState();
  }

  /** Validate that current state matches expected error conditions */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const config = this._state.config;
    const browserState = this._state.browserState;

    // Validate basic error state
    if (!browserState.hasError && config.statusCode >= 400) {
      errors.push('Expected hasError to be true for HTTP error status');
    }

    // Validate URL if specified
    if (config.expectedUrl && browserState.url !== config.expectedUrl) {
      errors.push(`Expected URL "${config.expectedUrl}", got "${browserState.url}"`);
    }

    // Validate title if specified
    if (config.expectedTitle && browserState.title !== config.expectedTitle) {
      errors.push(`Expected title "${config.expectedTitle}", got "${browserState.title}"`);
    }

    // Validate authentication state
    if (config.clearsAuth && browserState.isAuthenticated) {
      errors.push('Expected authentication to be cleared for this error type');
    }

    // Validate console errors
    if (config.expectedConsoleErrors) {
      const actualErrors = browserState.consoleMessages
        .filter(msg => msg.type === 'error')
        .map(msg => msg.message);

      for (const expectedError of config.expectedConsoleErrors) {
        if (!actualErrors.some(actual => actual.includes(expectedError))) {
          errors.push(`Expected console error containing "${expectedError}"`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /** Update the browser state */
  updateBrowserState(updates: Partial<BrowserState>): void {
    this._state.browserState = { ...this._state.browserState, ...updates };
  }

  /** Simulate a specific error scenario */
  async simulateError(scenario: ErrorScenario): Promise<void> {
    const scenarioConfig = ERROR_SCENARIOS[scenario];
    if (!scenarioConfig) {
      throw new Error(`Unknown error scenario: ${scenario}`);
    }

    // Create a full config by merging scenario defaults
    const config: ErrorFixtureConfig = {
      name: `Simulated ${scenario}`,
      description: `Simulated error scenario: ${scenario}`,
      ...scenarioConfig,
    };

    // If already set up, update the current state
    if (this._state.isSetup) {
      this._state.config = config;
      this._state.browserState = this.createErrorBrowserState(config);
      await this.setupErrorConditions(config);
    } else {
      // Set up with the new scenario
      await this.setup(config);
    }
  }

  /** Add a cleanup task to run during teardown */
  addCleanupTask(task: () => void | Promise<void>): void {
    this._state.cleanupTasks.push(task);
  }

  /** Get the current browser state as a snapshot */
  getBrowserState(): BrowserState {
    return { ...this._state.browserState };
  }

  /** Check if fixture is currently set up */
  isSetup(): boolean {
    return this._state.isSetup;
  }

  // ============================================================================
  // Private Implementation Methods
  // ============================================================================

  /** Create initial empty state */
  private createInitialState(): ErrorFixtureState {
    return {
      config: {} as ErrorFixtureConfig,
      browserState: browserFixtures.cleanState(),
      activeRoutes: [],
      activeMocks: new Map(),
      cleanupTasks: [],
      isSetup: false,
      createdAt: new Date(),
      metadata: {},
    };
  }

  /** Create browser state appropriate for the error configuration */
  private createErrorBrowserState(config: ErrorFixtureConfig): BrowserState {
    let baseState: BrowserState;

    // Choose appropriate base state based on error category
    switch (config.category) {
      case 'network':
        baseState = browserFixtures.offlinePage();
        break;
      case 'client':
        if (config.statusCode === 403) {
          baseState = browserFixtures.permissionDeniedPage();
        } else {
          baseState = browserFixtures.errorPage();
        }
        break;
      case 'server':
      case 'timeout':
      default:
        baseState = browserFixtures.errorPage();
        break;
    }

    // Apply error-specific customizations
    const customState: Partial<BrowserState> = {
      hasError: config.statusCode >= 400 || config.statusCode === 0,
      isAuthenticated: config.clearsAuth ? false : baseState.isAuthenticated,
    };

    // Set URL and title if specified
    if (config.expectedUrl) {
      customState.url = config.expectedUrl;
    }
    if (config.expectedTitle) {
      customState.title = config.expectedTitle;
    }

    // Add error-specific console messages
    if (config.expectedConsoleErrors) {
      const errorMessages = config.expectedConsoleErrors.map(message => ({
        type: 'error' as const,
        message,
        timestamp: new Date(),
      }));
      customState.consoleMessages = [...(baseState.consoleMessages || []), ...errorMessages];
    }

    // Add error-specific local storage
    if (config.errorData) {
      customState.localStorage = {
        ...baseState.localStorage,
        'error-fixture-data': JSON.stringify(config.errorData),
        'last-error-scenario': config.scenario,
      };
    }

    // Add mock network request that would produce this error
    const mockRequest = {
      url: config.expectedUrl || baseState.url,
      method: 'GET',
      status: config.statusCode,
      headers: config.mockResponse?.headers || {},
    };
    customState.networkRequests = [...(baseState.networkRequests || []), mockRequest];

    return { ...baseState, ...customState };
  }

  /** Set up error conditions and mocks based on configuration */
  private async setupErrorConditions(config: ErrorFixtureConfig): Promise<void> {
    // For browser fixture, we primarily work with state simulation
    // Real route interception would be handled by integration helpers

    // Add mock functions for testing framework integration
    if (config.mockResponse) {
      const mockFetch = this.createMockFetch(config);
      this._state.activeMocks.set('fetch', mockFetch);

      // Add cleanup to restore original fetch if needed
      this.addCleanupTask(() => {
        this._state.activeMocks.delete('fetch');
      });
    }

    // Set up timeout simulation if needed
    if (config.timeout && config.category === 'timeout') {
      const timeoutId = setTimeout(() => {
        this.updateBrowserState({
          hasError: true,
          isLoading: false,
        });
      }, config.timeout);

      this.addCleanupTask(() => {
        clearTimeout(timeoutId);
      });
    }
  }

  /** Create a mock fetch function for the error scenario */
  private createMockFetch(config: ErrorFixtureConfig): (...args: any[]) => any {
    return async (...args: any[]) => {
      // Simulate network delay if specified
      if (config.mockResponse?.delay) {
        await new Promise(resolve => setTimeout(resolve, config.mockResponse.delay));
      }

      // Handle network-level errors
      if (config.category === 'network') {
        throw new Error(config.statusText);
      }

      // Return mock HTTP response
      return {
        ok: config.statusCode >= 200 && config.statusCode < 300,
        status: config.statusCode,
        statusText: config.statusText,
        headers: new Map(Object.entries(config.mockResponse?.headers || {})),
        text: async () => config.mockResponse?.body || '',
        json: async () => {
          try {
            return JSON.parse(config.mockResponse?.body || '{}');
          } catch {
            return {};
          }
        },
      };
    };
  }
}

// ============================================================================
// Integration Helpers
// ============================================================================

/**
 * Creates reusable setup/teardown hooks for error page fixtures.
 * Use this in your test suites for easy integration.
 *
 * @param scenario - The error scenario to set up
 * @param options - Additional configuration options
 * @returns Setup and teardown functions
 *
 * @example
 * ```typescript
 * const { setup, teardown } = createErrorFixtureHooks('500-internal-error');
 *
 * beforeEach(setup);
 * afterEach(teardown);
 *
 * it('should handle server errors', () => {
 *   // Test with error fixture already set up
 * });
 * ```
 */
export function createErrorFixtureHooks(
  scenario: ErrorScenario,
  options: Partial<ErrorFixtureConfig> = {}
): {
  setup: () => Promise<ErrorPageFixture>;
  teardown: () => Promise<void>;
  fixture: ErrorPageFixture | null;
} {
  let fixture: ErrorPageFixture | null = null;

  const setup = async () => {
    if (fixture) {
      await fixture.teardown();
    }

    fixture = new ErrorPageFixture();
    const scenarioConfig = ERROR_SCENARIOS[scenario];

    const config: ErrorFixtureConfig = {
      name: options.name || `Test ${scenario}`,
      description: options.description || `Test fixture for ${scenario}`,
      ...scenarioConfig,
      ...options,
    };

    await fixture.setup(config);
    return fixture;
  };

  const teardown = async () => {
    if (fixture) {
      await fixture.teardown();
      fixture = null;
    }
  };

  return { setup, teardown, fixture };
}

/**
 * Higher-order function that wraps a test function with error fixture setup.
 * Automatically sets up and tears down the fixture around the test.
 *
 * @param scenario - The error scenario to test
 * @param testFn - The test function to wrap
 * @param options - Additional fixture configuration
 * @returns Wrapped test function
 *
 * @example
 * ```typescript
 * it('should handle 404 errors', withErrorFixture('404-not-found', async (fixture) => {
 *   const state = fixture.getBrowserState();
 *   expect(state.hasError).toBe(true);
 *   expect(state.title).toContain('404');
 * }));
 * ```
 */
export function withErrorFixture<T = void>(
  scenario: ErrorScenario,
  testFn: (fixture: ErrorPageFixture) => Promise<T> | T,
  options: Partial<ErrorFixtureConfig> = {}
): () => Promise<T> {
  return async () => {
    const { setup, teardown } = createErrorFixtureHooks(scenario, options);

    try {
      const fixture = await setup();
      return await testFn(fixture);
    } finally {
      await teardown();
    }
  };
}

/**
 * Creates an error fixture configured for multiple test scenarios.
 * Useful for parameterized tests that need to test various error conditions.
 *
 * @param scenarios - Array of error scenarios to configure
 * @returns Factory function that creates fixtures for each scenario
 *
 * @example
 * ```typescript
 * const createFixture = createMultiScenarioFixture(['404-not-found', '500-internal-error']);
 *
 * test.each(['404-not-found', '500-internal-error'])('should handle %s errors', async (scenario) => {
 *   const fixture = await createFixture(scenario);
 *   try {
 *     // Test the error scenario
 *     const result = await fixture.validate();
 *     expect(result.valid).toBe(true);
 *   } finally {
 *     await fixture.teardown();
 *   }
 * });
 * ```
 */
export function createMultiScenarioFixture(scenarios: ErrorScenario[]) {
  return async (scenario: ErrorScenario, options: Partial<ErrorFixtureConfig> = {}): Promise<ErrorPageFixture> => {
    if (!scenarios.includes(scenario)) {
      throw new Error(`Scenario ${scenario} is not supported by this fixture`);
    }

    const fixture = new ErrorPageFixture();
    const scenarioConfig = ERROR_SCENARIOS[scenario];

    const config: ErrorFixtureConfig = {
      name: `Multi-scenario ${scenario}`,
      description: `Multi-scenario test fixture for ${scenario}`,
      ...scenarioConfig,
      ...options,
    };

    await fixture.setup(config);
    return fixture;
  };
}

// ============================================================================
// Exports
// ============================================================================

// Main exports
export { ErrorPageFixture as default };

// Type exports for external use
export type {
  IErrorPageFixture,
  ErrorFixtureConfig,
  ErrorFixtureState,
  ErrorScenario,
};

// Preset configurations
export { ERROR_SCENARIOS };

// Integration helpers
export {
  createErrorFixtureHooks,
  withErrorFixture,
  createMultiScenarioFixture,
};