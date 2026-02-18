/**
 * @fileoverview Shared test setup for APEX monorepo
 *
 * This file provides common test setup utilities that can be imported
 * by individual packages or used in global test setup files.
 *
 * Usage in package test setup:
 * ```typescript
 * // In packages/[package]/src/__tests__/setup.ts
 * import { setupGlobalTestEnvironment } from '../../../test-setup.js';
 * setupGlobalTestEnvironment();
 * ```
 *
 * Usage in vitest config:
 * ```typescript
 * export default defineConfig({
 *   test: {
 *     setupFiles: ['../../test-setup.ts'],
 *     // ...other config
 *   },
 * });
 * ```
 */

import { vi, beforeEach, afterEach } from 'vitest';
import { expect } from 'vitest';

/**
 * Global test environment setup options
 */
export interface TestEnvironmentOptions {
  /** Setup console mocking (default: true) */
  setupConsole?: boolean;
  /** Setup common mocks (default: true) */
  setupMocks?: boolean;
  /** Setup test timeout helpers (default: true) */
  setupTimeouts?: boolean;
  /** Setup async test utilities (default: true) */
  setupAsync?: boolean;
  /** Global test timeout in ms (default: 5000) */
  globalTimeout?: number;
}

/**
 * Sets up the global test environment for APEX tests
 */
export function setupGlobalTestEnvironment(options: TestEnvironmentOptions = {}) {
  const {
    setupConsole = true,
    setupMocks = true,
    setupTimeouts = true,
    setupAsync = true,
    globalTimeout = 5000,
  } = options;

  if (setupConsole) {
    setupConsoleHelpers();
  }

  if (setupMocks) {
    setupCommonMocks();
  }

  if (setupTimeouts) {
    setupTimeoutHelpers(globalTimeout);
  }

  if (setupAsync) {
    setupAsyncUtilities();
  }
}

/**
 * Sets up console helpers for testing
 * - Provides console.mockImplementation for controlled console output
 * - Automatically restores console after each test
 */
export function setupConsoleHelpers() {
  let originalConsole: typeof console;

  beforeEach(() => {
    originalConsole = { ...console };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
}

/**
 * Sets up common mocks used across tests
 * - Process environment variables
 * - Date mocking utilities
 * - Random number generation
 */
export function setupCommonMocks() {
  beforeEach(() => {
    // Mock environment variables
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('APEX_TEST_MODE', 'unit');

    // Ensure consistent test environment
    vi.stubEnv('CI', '');
    vi.stubEnv('TZ', 'UTC');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });
}

/**
 * Sets up timeout helpers for async tests
 */
export function setupTimeoutHelpers(defaultTimeout: number = 5000) {
  // Make timeout helpers available globally
  globalThis.testTimeout = defaultTimeout;

  // Setup test timeout wrapper
  globalThis.withTimeout = async function<T>(
    promise: Promise<T>,
    timeout: number = defaultTimeout
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Test timeout after ${timeout}ms`)), timeout)
      )
    ]);
  };
}

/**
 * Sets up async test utilities
 * - Provides flushPromises() for awaiting microtasks
 * - Provides nextTick() for deferring execution
 * - Provides sleep() for controlled delays in tests
 */
export function setupAsyncUtilities() {
  // Flush all pending promises/microtasks
  globalThis.flushPromises = async function(): Promise<void> {
    await new Promise(resolve => setImmediate(resolve));
  };

  // Next tick utility
  globalThis.nextTick = async function(): Promise<void> {
    await new Promise(resolve => process.nextTick(resolve));
  };

  // Sleep utility for tests
  globalThis.sleep = function(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  // Wait for condition utility
  globalThis.waitFor = async function(
    condition: () => boolean | Promise<boolean>,
    options: { timeout?: number; interval?: number } = {}
  ): Promise<void> {
    const { timeout = 5000, interval = 50 } = options;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`waitFor condition not met within ${timeout}ms`);
  };
}

/**
 * Creates a test factory for consistent test structure
 */
export function createTestSuite(name: string, setupFn?: () => void | Promise<void>) {
  return {
    describe: (description: string, tests: () => void) => {
      describe(`${name}: ${description}`, () => {
        if (setupFn) {
          beforeEach(setupFn);
        }
        tests();
      });
    }
  };
}

/**
 * Test data factories
 */
export const testFactories = {
  /**
   * Creates a test ID with consistent format
   */
  createTestId: (prefix: string = 'test'): string => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Creates test dates for consistent temporal testing
   */
  createTestDate: (offset: number = 0): Date => {
    return new Date('2023-01-01T00:00:00.000Z').getTime() + offset;
  },

  /**
   * Creates test file paths for consistent path testing
   */
  createTestPath: (...segments: string[]): string => {
    return `/test/project/${segments.join('/')}`;
  },
};

/**
 * Assertion helpers
 */
export const assertionHelpers = {
  /**
   * Asserts that a value is defined (not null or undefined)
   */
  assertDefined: <T>(value: T | null | undefined): asserts value is T => {
    expect(value).toBeDefined();
    expect(value).not.toBeNull();
  },

  /**
   * Asserts that an array has a specific length
   */
  assertLength: <T>(array: T[], expectedLength: number): void => {
    expect(array).toHaveLength(expectedLength);
  },

  /**
   * Asserts that a promise rejects with a specific error type
   */
  assertRejectsWithError: async <T extends Error>(
    promise: Promise<any>,
    errorType: new (...args: any[]) => T,
    message?: string | RegExp
  ): Promise<void> => {
    await expect(promise).rejects.toThrow(errorType);
    if (message) {
      await expect(promise).rejects.toThrow(message);
    }
  },

  /**
   * Asserts that an object has specific properties
   */
  assertHasProperties: <T extends Record<string, any>>(
    obj: T,
    properties: (keyof T)[]
  ): void => {
    for (const prop of properties) {
      expect(obj).toHaveProperty(prop);
    }
  },
};

/**
 * Mock helpers for common testing patterns
 */
export const mockHelpers = {
  /**
   * Creates a mock function with typed return values
   */
  createTypedMock: <T extends (...args: any[]) => any>(
    implementation?: T
  ): ReturnType<typeof vi.fn<Parameters<T>, ReturnType<T>>> => {
    return vi.fn(implementation);
  },

  /**
   * Creates a partial mock of an object
   */
  createPartialMock: <T extends Record<string, any>>(
    overrides: Partial<T> = {}
  ): T => {
    return {
      ...({} as T),
      ...overrides,
    };
  },

  /**
   * Mocks a class constructor
   */
  mockClass: <T extends new (...args: any[]) => any>(
    ClassConstructor: T,
    mockImplementation?: Partial<InstanceType<T>>
  ) => {
    return vi.mocked(ClassConstructor).mockImplementation(
      () => mockImplementation as InstanceType<T>
    );
  },
};

// Type declarations for global utilities
declare global {
  var testTimeout: number;
  var withTimeout: <T>(promise: Promise<T>, timeout?: number) => Promise<T>;
  var flushPromises: () => Promise<void>;
  var nextTick: () => Promise<void>;
  var sleep: (ms: number) => Promise<void>;
  var waitFor: (
    condition: () => boolean | Promise<boolean>,
    options?: { timeout?: number; interval?: number }
  ) => Promise<void>;
}

// Export everything for convenience
export {
  testFactories as factories,
  assertionHelpers as assertions,
  mockHelpers as mocks,
};