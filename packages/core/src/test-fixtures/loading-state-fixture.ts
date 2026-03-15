/**
 * @fileoverview Loading State Fixture for Async Operation Testing
 *
 * This module provides a comprehensive loading state fixture system for testing
 * async operations, loading indicators, and state transitions. Built on the
 * existing browser fixtures with enhanced lifecycle management and timer integration.
 *
 * Key Features:
 * - Class-based fixture design with setup/teardown lifecycle
 * - Configurable loading scenarios (page load, API requests, file uploads, etc.)
 * - Pending request simulation with progress tracking
 * - Fake timer integration for deterministic testing
 * - State transition testing (loading → success/error)
 * - Integration helpers for easy test setup
 *
 * Architecture Decision:
 * This fixture follows the established ErrorPageFixture pattern, providing
 * higher-level interface for loading state testing while maintaining compatibility
 * with existing browser fixture patterns.
 *
 * @see browser-fixtures.ts for base browser state management
 * @see error-page-fixture.ts for pattern reference
 * @see setup-teardown.ts for lifecycle utilities
 */

import { vi } from 'vitest';
import type { BrowserState } from './types.js';
import { browserFixtures } from './browser-fixtures.js';

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Configuration for a loading state fixture scenario.
 * Defines the loading operation, timing, and expected behavior.
 */
export interface LoadingFixtureConfig {
  /** Human-readable name for the loading scenario */
  name: string;
  /** Description of the loading operation */
  description: string;
  /** Loading scenario type */
  scenario: LoadingScenario;
  /** Expected loading duration in milliseconds */
  expectedDuration?: number;
  /** Loading timeout threshold */
  timeout?: number;
  /** Whether to use fake timers */
  useFakeTimers?: boolean;
  /** Initial loading progress (0-100) */
  initialProgress?: number;
  /** Loading indicator type */
  indicatorType?: 'spinner' | 'progress' | 'skeleton' | 'none';
  /** Custom loading state data */
  customData?: Record<string, unknown>;
  /** Expected outcome when loading completes */
  expectedOutcome?: 'success' | 'error' | 'timeout' | 'cancelled';
  /** Mock responses for pending requests */
  mockResponses?: Record<string, any>;
  /** Whether the loading operation is cancellable */
  cancellable?: boolean;
}

/**
 * Current state of the loading fixture.
 * Tracks active configuration, browser state, pending requests, and cleanup.
 */
export interface LoadingFixtureState {
  /** Active loading configuration */
  config: LoadingFixtureConfig;
  /** Current browser state */
  browserState: BrowserState;
  /** Active pending requests */
  pendingRequests: Map<string, PendingRequest>;
  /** Current loading progress */
  progress: LoadingProgress;
  /** Active timer IDs that need cleanup */
  activeTimers: Set<NodeJS.Timeout>;
  /** Mock functions and handlers that need cleanup */
  activeMocks: Map<string, (...args: any[]) => any>;
  /** Cleanup functions to run on teardown */
  cleanupTasks: Array<() => void | Promise<void>>;
  /** Whether the fixture has been set up */
  isSetup: boolean;
  /** Loading start timestamp */
  startedAt: Date;
  /** Additional state metadata */
  metadata: Record<string, unknown>;
}

/**
 * Main interface for loading state fixtures.
 * Provides lifecycle management and loading state manipulation.
 */
export interface ILoadingStateFixture {
  /** Current fixture state */
  readonly state: Readonly<LoadingFixtureState>;

  /** Set up the loading state fixture with the given configuration */
  setup(config: LoadingFixtureConfig): Promise<void>;

  /** Clean up the fixture and restore original state */
  teardown(): Promise<void>;

  /** Validate that current state matches expected loading conditions */
  validate(): Promise<{ valid: boolean; errors: string[] }>;

  /** Update the browser state */
  updateBrowserState(updates: Partial<BrowserState>): void;

  /** Start loading with optional configuration */
  startLoading(options?: LoadingOptions): BrowserState;

  /** Finish loading with result */
  finishLoading(result?: LoadingResult): BrowserState;

  /** Simulate loading timeout */
  simulateLoadingTimeout(): Promise<BrowserState>;

  /** Simulate loading error */
  simulateLoadingError(error: string): BrowserState;

  /** Simulate a pending request */
  simulatePendingRequest(request: PendingRequest): () => void;

  /** Simulate delayed response */
  simulateDelayedResponse(delay: number, response: any): Promise<any>;

  /** Simulate progressive loading with steps */
  simulateProgressiveLoading(steps: LoadingStep[]): Promise<void>;

  /** Check if currently loading */
  isLoading(): boolean;

  /** Get pending requests */
  getPendingRequests(): PendingRequest[];

  /** Get current loading progress */
  getLoadingProgress(): LoadingProgress;

  /** Get the current browser state as a snapshot */
  getBrowserState(): BrowserState;

  /** Add a cleanup task to run during teardown */
  addCleanupTask(task: () => void | Promise<void>): void;

  /** Check if fixture is currently set up */
  isSetup(): boolean;
}

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Supported loading scenarios for the fixture.
 */
export type LoadingScenario =
  | 'page-load'           // Initial page load
  | 'api-request'         // Single API request pending
  | 'multiple-requests'   // Multiple concurrent requests
  | 'progressive-load'    // Progressive/streaming data load
  | 'lazy-component'      // Lazy loaded component
  | 'infinite-scroll'     // Infinite scroll loading
  | 'file-upload'         // File upload progress
  | 'background-sync'     // Background data sync
  | 'auth-check'          // Authentication verification
  | 'data-refresh';       // Data refresh/polling

/**
 * Options for starting a loading operation
 */
export interface LoadingOptions {
  /** Override expected duration */
  duration?: number;
  /** Override initial progress */
  initialProgress?: number;
  /** Custom loading message */
  message?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of a loading operation
 */
export interface LoadingResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result data if successful */
  data?: any;
  /** Error message if failed */
  error?: string;
  /** Final progress percentage */
  progress?: number;
  /** Operation metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Represents a pending request with tracking information
 */
export interface PendingRequest {
  /** Unique request identifier */
  id: string;
  /** Request URL */
  url: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Request status */
  status: 'pending' | 'resolved' | 'rejected' | 'cancelled';
  /** Request start time */
  startedAt: Date;
  /** Request completion time (if completed) */
  completedAt?: Date;
  /** Progress percentage (0-100) for upload/download */
  progress?: number;
  /** Abort controller for cancellation */
  abortController?: AbortController;
  /** Expected response data */
  expectedResponse?: any;
  /** Expected error (if request should fail) */
  expectedError?: string;
}

/**
 * Loading progress information
 */
export interface LoadingProgress {
  /** Overall progress percentage (0-100) */
  percentage: number;
  /** Number of completed items */
  completed: number;
  /** Total number of items */
  total: number;
  /** Current loading phase */
  phase: 'initializing' | 'fetching' | 'processing' | 'rendering' | 'complete';
  /** Elapsed time in milliseconds */
  elapsedTime: number;
  /** Estimated remaining time in milliseconds */
  estimatedRemaining?: number;
  /** Loading message to display */
  message?: string;
}

/**
 * A step in progressive loading
 */
export interface LoadingStep {
  /** Step name */
  name: string;
  /** Step duration in milliseconds */
  duration: number;
  /** Progress percentage after this step */
  progressAfter: number;
  /** Optional message for this step */
  message?: string;
  /** Optional callback to run during step */
  callback?: () => void | Promise<void>;
}

// ============================================================================
// Predefined Loading Scenarios
// ============================================================================

/**
 * Predefined loading configurations for common scenarios.
 */
export const LOADING_SCENARIOS: Record<LoadingScenario, Omit<LoadingFixtureConfig, 'name' | 'description'>> = {
  'page-load': {
    scenario: 'page-load',
    expectedDuration: 2000,
    timeout: 30000,
    indicatorType: 'spinner',
    initialProgress: 0,
    expectedOutcome: 'success',
    useFakeTimers: false,
    cancellable: false,
  },

  'api-request': {
    scenario: 'api-request',
    expectedDuration: 500,
    timeout: 10000,
    indicatorType: 'spinner',
    initialProgress: 0,
    expectedOutcome: 'success',
    useFakeTimers: false,
    cancellable: true,
  },

  'multiple-requests': {
    scenario: 'multiple-requests',
    expectedDuration: 1500,
    timeout: 15000,
    indicatorType: 'progress',
    initialProgress: 0,
    expectedOutcome: 'success',
    useFakeTimers: false,
    cancellable: true,
  },

  'progressive-load': {
    scenario: 'progressive-load',
    expectedDuration: 3000,
    timeout: 20000,
    indicatorType: 'progress',
    initialProgress: 0,
    expectedOutcome: 'success',
    useFakeTimers: false,
    cancellable: false,
  },

  'lazy-component': {
    scenario: 'lazy-component',
    expectedDuration: 800,
    timeout: 10000,
    indicatorType: 'skeleton',
    initialProgress: 0,
    expectedOutcome: 'success',
    useFakeTimers: false,
    cancellable: false,
  },

  'infinite-scroll': {
    scenario: 'infinite-scroll',
    expectedDuration: 1000,
    timeout: 10000,
    indicatorType: 'spinner',
    initialProgress: 0,
    expectedOutcome: 'success',
    useFakeTimers: false,
    cancellable: true,
  },

  'file-upload': {
    scenario: 'file-upload',
    expectedDuration: 5000,
    timeout: 60000,
    indicatorType: 'progress',
    initialProgress: 0,
    expectedOutcome: 'success',
    useFakeTimers: false,
    cancellable: true,
  },

  'background-sync': {
    scenario: 'background-sync',
    expectedDuration: 2000,
    timeout: 30000,
    indicatorType: 'none',
    initialProgress: 0,
    expectedOutcome: 'success',
    useFakeTimers: false,
    cancellable: true,
  },

  'auth-check': {
    scenario: 'auth-check',
    expectedDuration: 300,
    timeout: 5000,
    indicatorType: 'spinner',
    initialProgress: 0,
    expectedOutcome: 'success',
    useFakeTimers: false,
    cancellable: false,
  },

  'data-refresh': {
    scenario: 'data-refresh',
    expectedDuration: 1000,
    timeout: 10000,
    indicatorType: 'spinner',
    initialProgress: 0,
    expectedOutcome: 'success',
    useFakeTimers: false,
    cancellable: true,
  },
} as const;

// ============================================================================
// Main Loading State Fixture Implementation
// ============================================================================

/**
 * Implementation of the loading state fixture system.
 * Provides comprehensive async operation testing with lifecycle management.
 */
export class LoadingStateFixture implements ILoadingStateFixture {
  private _state: LoadingFixtureState;

  constructor() {
    this._state = this.createInitialState();
  }

  /** Get current fixture state as readonly */
  get state(): Readonly<LoadingFixtureState> {
    return this._state;
  }

  /** Set up the loading state fixture with the given configuration */
  async setup(config: LoadingFixtureConfig): Promise<void> {
    if (this._state.isSetup) {
      throw new Error('Loading state fixture is already set up. Call teardown() first.');
    }

    // Update state with new configuration
    this._state.config = config;
    this._state.isSetup = true;
    this._state.startedAt = new Date();

    // Set up fake timers if requested
    if (config.useFakeTimers) {
      vi.useFakeTimers();
      this.addCleanupTask(() => { vi.useRealTimers(); });
    }

    // Create initial browser state based on loading scenario
    this._state.browserState = this.createLoadingBrowserState(config);

    // Initialize progress tracking
    this._state.progress = this.createInitialProgress(config);

    // Set up loading simulation
    await this.setupLoadingSimulation(config);

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

    // Cancel all pending requests
    for (const request of this._state.pendingRequests.values()) {
      if (request.abortController && request.status === 'pending') {
        request.abortController.abort();
        request.status = 'cancelled';
      }
    }

    // Clear all active timers
    for (const timerId of this._state.activeTimers) {
      clearTimeout(timerId);
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

  /** Validate that current state matches expected loading conditions */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const config = this._state.config;
    const browserState = this._state.browserState;

    // Validate loading state consistency
    if (this.isLoading() && !browserState.isLoading) {
      errors.push('Browser state isLoading should be true when fixture is in loading state');
    }

    // Validate progress consistency
    const progress = this._state.progress;
    if (progress.percentage < 0 || progress.percentage > 100) {
      errors.push(`Progress percentage should be 0-100, got ${progress.percentage}`);
    }

    if (progress.completed > progress.total) {
      errors.push(`Completed items (${progress.completed}) cannot exceed total (${progress.total})`);
    }

    // Validate pending requests
    for (const [id, request] of this._state.pendingRequests) {
      if (request.status === 'pending' && !request.abortController && config.cancellable) {
        errors.push(`Cancellable request ${id} should have an AbortController`);
      }

      if (request.completedAt && request.completedAt < request.startedAt) {
        errors.push(`Request ${id} completion time is before start time`);
      }
    }

    // Validate timeout configuration
    if (config.timeout && config.expectedDuration && config.timeout <= config.expectedDuration) {
      errors.push('Timeout should be greater than expected duration');
    }

    return { valid: errors.length === 0, errors };
  }

  /** Update the browser state */
  updateBrowserState(updates: Partial<BrowserState>): void {
    this._state.browserState = { ...this._state.browserState, ...updates };
  }

  /** Start loading with optional configuration */
  startLoading(options: LoadingOptions = {}): BrowserState {
    const config = this._state.config;

    // Update browser state to loading
    this.updateBrowserState({
      isLoading: true,
      hasError: false,
    });

    // Update progress
    this._state.progress = {
      ...this._state.progress,
      percentage: options.initialProgress ?? config.initialProgress ?? 0,
      phase: 'initializing',
      message: options.message ?? `Loading ${config.scenario}...`,
      elapsedTime: 0,
    };

    // Add loading console message
    const loadingMessage = {
      type: 'info' as const,
      message: options.message ?? `Starting ${config.scenario} loading`,
      timestamp: new Date(),
    };
    this.updateBrowserState({
      consoleMessages: [...this._state.browserState.consoleMessages, loadingMessage],
    });

    return this.getBrowserState();
  }

  /** Finish loading with result */
  finishLoading(result: LoadingResult = { success: true }): BrowserState {
    const endTime = new Date();
    const elapsedTime = endTime.getTime() - this._state.startedAt.getTime();

    // Update browser state
    this.updateBrowserState({
      isLoading: false,
      hasError: !result.success,
    });

    // Update progress to complete
    this._state.progress = {
      ...this._state.progress,
      percentage: result.progress ?? 100,
      phase: 'complete',
      elapsedTime,
      message: result.success ? 'Loading complete' : `Loading failed: ${result.error}`,
    };

    // Mark all pending requests as resolved/rejected
    for (const request of this._state.pendingRequests.values()) {
      if (request.status === 'pending') {
        request.status = result.success ? 'resolved' : 'rejected';
        request.completedAt = endTime;
        request.progress = 100;
      }
    }

    // Add completion console message
    const completionMessage = {
      type: result.success ? 'info' as const : 'error' as const,
      message: result.success
        ? `Loading completed in ${elapsedTime}ms`
        : `Loading failed after ${elapsedTime}ms: ${result.error}`,
      timestamp: endTime,
    };
    this.updateBrowserState({
      consoleMessages: [...this._state.browserState.consoleMessages, completionMessage],
    });

    return this.getBrowserState();
  }

  /** Simulate loading timeout */
  async simulateLoadingTimeout(): Promise<BrowserState> {
    const timeout = this._state.config.timeout || 30000;

    if (this._state.config.useFakeTimers) {
      await vi.advanceTimersByTimeAsync(timeout);
    } else {
      await new Promise(resolve => setTimeout(resolve, timeout));
    }

    return this.simulateLoadingError('Loading timeout exceeded');
  }

  /** Simulate loading error */
  simulateLoadingError(error: string): BrowserState {
    return this.finishLoading({
      success: false,
      error,
      progress: this._state.progress.percentage,
    });
  }

  /** Simulate a pending request */
  simulatePendingRequest(request: PendingRequest): () => void {
    // Add abort controller if cancellable and not provided
    if (this._state.config.cancellable && !request.abortController) {
      request.abortController = new AbortController();
    }

    // Set status to pending if not set
    if (!request.status) {
      request.status = 'pending';
    }

    // Store the request
    this._state.pendingRequests.set(request.id, request);

    // Add to browser state network requests
    const networkRequest = {
      url: request.url,
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    this.updateBrowserState({
      networkRequests: [...this._state.browserState.networkRequests, networkRequest],
    });

    // Return cancellation function
    return () => {
      if (request.abortController) {
        request.abortController.abort();
        request.status = 'cancelled';
        request.completedAt = new Date();
      }
    };
  }

  /** Simulate delayed response */
  async simulateDelayedResponse(delay: number, response: any): Promise<any> {
    if (this._state.config.useFakeTimers) {
      await vi.advanceTimersByTimeAsync(delay);
    } else {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    return response;
  }

  /** Simulate progressive loading with steps */
  async simulateProgressiveLoading(steps: LoadingStep[]): Promise<void> {
    let elapsedTime = 0;

    for (const step of steps) {
      // Update progress for this step
      this._state.progress = {
        ...this._state.progress,
        percentage: step.progressAfter,
        phase: 'processing',
        elapsedTime,
        message: step.message ?? this._state.progress.message,
      };

      // Execute step callback if provided
      if (step.callback) {
        await step.callback();
      }

      // Wait for step duration
      if (this._state.config.useFakeTimers) {
        await vi.advanceTimersByTimeAsync(step.duration);
      } else {
        await new Promise(resolve => setTimeout(resolve, step.duration));
      }

      elapsedTime += step.duration;
    }
  }

  /** Check if currently loading */
  isLoading(): boolean {
    return this._state.browserState.isLoading;
  }

  /** Get pending requests */
  getPendingRequests(): PendingRequest[] {
    return Array.from(this._state.pendingRequests.values());
  }

  /** Get current loading progress */
  getLoadingProgress(): LoadingProgress {
    return { ...this._state.progress };
  }

  /** Get the current browser state as a snapshot */
  getBrowserState(): BrowserState {
    return { ...this._state.browserState };
  }

  /** Add a cleanup task to run during teardown */
  addCleanupTask(task: () => void | Promise<void>): void {
    this._state.cleanupTasks.push(task);
  }

  /** Check if fixture is currently set up */
  isSetup(): boolean {
    return this._state.isSetup;
  }

  // ============================================================================
  // Private Implementation Methods
  // ============================================================================

  /** Create initial empty state */
  private createInitialState(): LoadingFixtureState {
    return {
      config: {} as LoadingFixtureConfig,
      browserState: browserFixtures.cleanState(),
      pendingRequests: new Map(),
      progress: {
        percentage: 0,
        completed: 0,
        total: 0,
        phase: 'initializing',
        elapsedTime: 0,
      },
      activeTimers: new Set(),
      activeMocks: new Map(),
      cleanupTasks: [],
      isSetup: false,
      startedAt: new Date(),
      metadata: {},
    };
  }

  /** Create browser state appropriate for the loading configuration */
  private createLoadingBrowserState(config: LoadingFixtureConfig): BrowserState {
    // Start with loading page base state
    const baseState = browserFixtures.loadingPage();

    // Customize based on scenario
    const customState: Partial<BrowserState> = {
      title: `Loading ${config.scenario} - APEX`,
      localStorage: {
        ...baseState.localStorage,
        'loading-scenario': config.scenario,
        'loading-config': JSON.stringify({
          name: config.name,
          expectedDuration: config.expectedDuration,
          indicatorType: config.indicatorType,
        }),
      },
    };

    // Add scenario-specific customizations
    switch (config.scenario) {
      case 'file-upload':
        customState.url = 'https://app.apex.dev/upload';
        customState.title = 'Upload in Progress - APEX';
        break;
      case 'auth-check':
        customState.url = 'https://app.apex.dev/auth/verify';
        customState.title = 'Verifying Authentication - APEX';
        break;
      case 'api-request':
        customState.sessionStorage = {
          ...baseState.sessionStorage,
          'pending-api-calls': '1',
        };
        break;
    }

    // Add custom data if provided
    if (config.customData) {
      customState.localStorage = {
        ...customState.localStorage,
        'loading-custom-data': JSON.stringify(config.customData),
      };
    }

    return { ...baseState, ...customState };
  }

  /** Create initial progress state */
  private createInitialProgress(config: LoadingFixtureConfig): LoadingProgress {
    return {
      percentage: config.initialProgress ?? 0,
      completed: 0,
      total: 1, // Default to 1 item unless specified otherwise
      phase: 'initializing',
      elapsedTime: 0,
      message: `Initializing ${config.scenario} loading...`,
      estimatedRemaining: config.expectedDuration,
    };
  }

  /** Set up loading simulation based on configuration */
  private async setupLoadingSimulation(config: LoadingFixtureConfig): Promise<void> {
    // Set up mock responses if provided
    if (config.mockResponses) {
      for (const [url, response] of Object.entries(config.mockResponses)) {
        const mockFetch = this.createMockFetch(url, response);
        this._state.activeMocks.set(`fetch-${url}`, mockFetch);
      }
    }

    // Set up auto-completion timer if expected duration is specified
    if (config.expectedDuration && config.expectedOutcome === 'success') {
      const completionTimer = setTimeout(() => {
        if (this.isLoading()) {
          this.finishLoading({ success: true });
        }
      }, config.expectedDuration);

      this._state.activeTimers.add(completionTimer);
      this.addCleanupTask(() => {
        clearTimeout(completionTimer);
        this._state.activeTimers.delete(completionTimer);
      });
    }

    // Set up timeout timer if specified
    if (config.timeout) {
      const timeoutTimer = setTimeout(() => {
        if (this.isLoading()) {
          this.simulateLoadingError('Operation timed out');
        }
      }, config.timeout);

      this._state.activeTimers.add(timeoutTimer);
      this.addCleanupTask(() => {
        clearTimeout(timeoutTimer);
        this._state.activeTimers.delete(timeoutTimer);
      });
    }
  }

  /** Create a mock fetch function for URL responses */
  private createMockFetch(url: string, response: any): (...args: any[]) => any {
    return async (requestUrl: string | Request) => {
      const urlString = typeof requestUrl === 'string' ? requestUrl : requestUrl.url;

      if (urlString === url) {
        // Simulate network delay if using fake timers
        if (this._state.config.useFakeTimers && this._state.config.expectedDuration) {
          await vi.advanceTimersByTimeAsync(this._state.config.expectedDuration / 4);
        }

        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map([['Content-Type', 'application/json']]),
          text: async () => JSON.stringify(response),
          json: async () => response,
        };
      }

      // Fall through to actual fetch or throw error
      throw new Error(`Unmocked fetch to ${urlString}`);
    };
  }
}

// ============================================================================
// Integration Helpers
// ============================================================================

/**
 * Creates reusable setup/teardown hooks for loading state fixtures.
 * Use this in your test suites for easy integration.
 *
 * @param scenario - The loading scenario to set up
 * @param options - Additional configuration options
 * @returns Setup and teardown functions
 *
 * @example
 * ```typescript
 * const { setup, teardown } = createLoadingFixtureHooks('api-request');
 *
 * beforeEach(setup);
 * afterEach(teardown);
 *
 * it('should handle API loading states', async () => {
 *   // Test with loading fixture already set up
 * });
 * ```
 */
export function createLoadingFixtureHooks(
  scenario: LoadingScenario,
  options: Partial<LoadingFixtureConfig> = {}
): {
  setup: () => Promise<LoadingStateFixture>;
  teardown: () => Promise<void>;
  fixture: LoadingStateFixture | null;
} {
  let fixture: LoadingStateFixture | null = null;

  const setup = async () => {
    if (fixture) {
      await fixture.teardown();
    }

    fixture = new LoadingStateFixture();
    const scenarioConfig = LOADING_SCENARIOS[scenario];

    const config: LoadingFixtureConfig = {
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
 * Higher-order function that wraps a test function with loading fixture setup.
 * Automatically sets up and tears down the fixture around the test.
 *
 * @param scenario - The loading scenario to test
 * @param testFn - The test function to wrap
 * @param options - Additional fixture configuration
 * @returns Wrapped test function
 *
 * @example
 * ```typescript
 * it('should handle file upload loading', withLoadingFixture('file-upload', async (fixture) => {
 *   const state = fixture.getBrowserState();
 *   expect(state.isLoading).toBe(true);
 *
 *   const progress = fixture.getLoadingProgress();
 *   expect(progress.percentage).toBeGreaterThanOrEqual(0);
 * }));
 * ```
 */
export function withLoadingFixture<T = void>(
  scenario: LoadingScenario,
  testFn: (fixture: LoadingStateFixture) => Promise<T> | T,
  options: Partial<LoadingFixtureConfig> = {}
): () => Promise<T> {
  return async () => {
    const { setup, teardown } = createLoadingFixtureHooks(scenario, options);

    try {
      const fixture = await setup();
      return await testFn(fixture);
    } finally {
      await teardown();
    }
  };
}

/**
 * Creates a loading fixture configured for multiple test scenarios.
 * Useful for parameterized tests that need to test various loading conditions.
 *
 * @param scenarios - Array of loading scenarios to configure
 * @returns Factory function that creates fixtures for each scenario
 *
 * @example
 * ```typescript
 * const createFixture = createMultiLoadingFixture(['api-request', 'file-upload']);
 *
 * test.each(['api-request', 'file-upload'])('should handle %s loading', async (scenario) => {
 *   const fixture = await createFixture(scenario);
 *   try {
 *     // Test the loading scenario
 *     const result = await fixture.validate();
 *     expect(result.valid).toBe(true);
 *   } finally {
 *     await fixture.teardown();
 *   }
 * });
 * ```
 */
export function createMultiLoadingFixture(scenarios: LoadingScenario[]) {
  return async (scenario: LoadingScenario, options: Partial<LoadingFixtureConfig> = {}): Promise<LoadingStateFixture> => {
    if (!scenarios.includes(scenario)) {
      throw new Error(`Scenario ${scenario} is not supported by this fixture`);
    }

    const fixture = new LoadingStateFixture();
    const scenarioConfig = LOADING_SCENARIOS[scenario];

    const config: LoadingFixtureConfig = {
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
export { LoadingStateFixture as default };