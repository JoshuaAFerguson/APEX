/**
 * @fileoverview Test Utility Functions
 *
 * This module provides utility functions that are commonly needed in tests:
 * - Async testing helpers
 * - Assertion utilities
 * - Data generation helpers
 * - Test environment helpers
 *
 * @example
 * ```typescript
 * import { testUtils } from '@apex/core/test-fixtures';
 *
 * await testUtils.waitFor(() => element.isVisible());
 * testUtils.expectEventually(() => state.isLoaded, { timeout: 5000 });
 * ```
 */

import { vi } from 'vitest';

/**
 * Waits for a condition to become true with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    timeoutMessage?: string;
  } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100, timeoutMessage } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) {
      return;
    }
    await sleep(interval);
  }

  const message = timeoutMessage || `Condition did not become true within ${timeout}ms`;
  throw new Error(message);
}

/**
 * Sleeps for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Waits for all pending promises to resolve
 */
export async function flushPromises(): Promise<void> {
  await new Promise(resolve => setImmediate(resolve));
}

/**
 * Retries an operation until it succeeds or max attempts reached
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: boolean;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = false } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
      await sleep(waitTime);
    }
  }

  throw new Error('Retry failed - should not reach this point');
}

/**
 * Creates a promise that can be resolved/rejected externally
 */
export function createDeferredPromise<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve: (value: T) => void;
  let reject: (error: Error) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}

/**
 * Generates random test data
 */
export const dataGenerator = {
  /**
   * Generates a random string
   */
  randomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * Generates a random integer between min and max (inclusive)
   */
  randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Generates a random UUID-like string
   */
  randomId(): string {
    return 'mock-id-' + this.randomString(8);
  },

  /**
   * Generates a random task ID
   */
  randomTaskId(): string {
    return `task_${Date.now()}_${this.randomString(6)}`;
  },

  /**
   * Generates a random session ID
   */
  randomSessionId(): string {
    return `sess_${Date.now()}_${this.randomString(8)}`;
  },

  /**
   * Generates random file content
   */
  randomFileContent(type: 'json' | 'yaml' | 'text' = 'text'): string {
    switch (type) {
      case 'json':
        return JSON.stringify({
          id: this.randomId(),
          name: 'Test Object',
          value: this.randomInt(1, 100),
          timestamp: new Date().toISOString(),
        });
      case 'yaml':
        return `name: Test Config
version: 1.0.0
settings:
  enabled: true
  timeout: ${this.randomInt(1000, 10000)}
  id: ${this.randomId()}`;
      case 'text':
      default:
        return `Test content ${this.randomString(20)}\nGenerated at: ${new Date().toISOString()}`;
    }
  },

  /**
   * Generates random project structure data
   */
  randomProjectStructure(): Record<string, string> {
    return {
      'package.json': this.randomFileContent('json'),
      'README.md': '# Test Project\n\nThis is a test project.',
      'src/index.ts': 'export * from "./main";\n',
      'src/main.ts': 'console.log("Hello, world!");',
      '.gitignore': 'node_modules/\n.env\n',
      '.apex/config.yaml': this.randomFileContent('yaml'),
    };
  }
};

/**
 * Assertion utilities for common test patterns
 */
export const assertions = {
  /**
   * Asserts that an async operation eventually succeeds
   */
  async eventually(
    assertion: () => void | Promise<void>,
    options: { timeout?: number; message?: string } = {}
  ): Promise<void> {
    const { timeout = 5000, message = 'Assertion did not pass within timeout' } = options;

    await waitFor(async () => {
      try {
        await assertion();
        return true;
      } catch {
        return false;
      }
    }, { timeout, timeoutMessage: message });
  },

  /**
   * Asserts that a function throws an error
   */
  async throws(
    fn: () => void | Promise<void>,
    expectedError?: string | RegExp | Error
  ): Promise<void> {
    let thrownError: any;

    try {
      await fn();
    } catch (error) {
      thrownError = error;
    }

    if (!thrownError) {
      throw new Error('Expected function to throw an error, but it did not');
    }

    if (expectedError) {
      if (typeof expectedError === 'string') {
        if (!thrownError.message.includes(expectedError)) {
          throw new Error(
            `Expected error to contain "${expectedError}", but got "${thrownError.message}"`
          );
        }
      } else if (expectedError instanceof RegExp) {
        if (!expectedError.test(thrownError.message)) {
          throw new Error(
            `Expected error message to match ${expectedError}, but got "${thrownError.message}"`
          );
        }
      } else if (expectedError instanceof Error) {
        if (thrownError.constructor !== expectedError.constructor) {
          throw new Error(
            `Expected error of type ${expectedError.constructor.name}, but got ${thrownError.constructor.name}`
          );
        }
      }
    }
  },

  /**
   * Asserts that an array contains specific items
   */
  arrayContains<T>(array: T[], items: T[]): void {
    for (const item of items) {
      if (!array.includes(item)) {
        throw new Error(`Array does not contain item: ${item}`);
      }
    }
  },

  /**
   * Asserts that an object has specific properties
   */
  objectHasProperties(obj: any, properties: string[]): void {
    for (const prop of properties) {
      if (!(prop in obj)) {
        throw new Error(`Object is missing property: ${prop}`);
      }
    }
  },

  /**
   * Deep equality check for objects
   */
  deepEqual(actual: any, expected: any): void {
    const actualStr = JSON.stringify(actual, null, 2);
    const expectedStr = JSON.stringify(expected, null, 2);

    if (actualStr !== expectedStr) {
      throw new Error(`Objects are not deeply equal:\nActual: ${actualStr}\nExpected: ${expectedStr}`);
    }
  }
};

/**
 * Performance testing utilities
 */
export const performance = {
  /**
   * Measures the execution time of a function
   */
  async measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert to milliseconds

    return { result, duration };
  },

  /**
   * Asserts that an operation completes within a time limit
   */
  async withinTime<T>(
    fn: () => Promise<T>,
    maxDuration: number,
    message?: string
  ): Promise<T> {
    const { result, duration } = await this.measureTime(fn);

    if (duration > maxDuration) {
      const errorMessage = message ||
        `Operation took ${duration.toFixed(2)}ms, expected less than ${maxDuration}ms`;
      throw new Error(errorMessage);
    }

    return result;
  },

  /**
   * Runs a function multiple times and returns average duration
   */
  async benchmark<T>(
    fn: () => Promise<T>,
    iterations: number = 10
  ): Promise<{ averageDuration: number; minDuration: number; maxDuration: number; results: T[] }> {
    const durations: number[] = [];
    const results: T[] = [];

    for (let i = 0; i < iterations; i++) {
      const { result, duration } = await this.measureTime(fn);
      durations.push(duration);
      results.push(result);
    }

    return {
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      results,
    };
  }
};

/**
 * Console capturing utilities
 */
export const consoleUtils = {
  /**
   * Captures console output during test execution
   */
  capture(): {
    logs: string[];
    errors: string[];
    warns: string[];
    stop: () => void;
  } {
    const logs: string[] = [];
    const errors: string[] = [];
    const warns: string[] = [];

    const originalLog = globalThis.console.log;
    const originalError = globalThis.console.error;
    const originalWarn = globalThis.console.warn;

    globalThis.console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };

    globalThis.console.error = (...args: unknown[]) => {
      errors.push(args.join(' '));
    };

    globalThis.console.warn = (...args: unknown[]) => {
      warns.push(args.join(' '));
    };

    const stop = () => {
      globalThis.console.log = originalLog;
      globalThis.console.error = originalError;
      globalThis.console.warn = originalWarn;
    };

    return { logs, errors, warns, stop };
  },

  /**
   * Suppresses console output during test execution
   */
  suppress(): () => void {
    const originalLog = globalThis.console.log;
    const originalError = globalThis.console.error;
    const originalWarn = globalThis.console.warn;

    globalThis.console.log = () => {};
    globalThis.console.error = () => {};
    globalThis.console.warn = () => {};

    return () => {
      globalThis.console.log = originalLog;
      globalThis.console.error = originalError;
      globalThis.console.warn = originalWarn;
    };
  }
};

/**
 * Collection of all test utilities
 */
/**
 * @deprecated Use `consoleUtils` instead. Kept for backward compatibility.
 */
export const console = consoleUtils;

export const testUtils = {
  waitFor,
  sleep,
  flushPromises,
  retry,
  createDeferredPromise,
  dataGenerator,
  assertions,
  performance,
  console: consoleUtils,
};