/**
 * Async utilities for testing
 * Provides common async testing helpers and utilities
 */

/**
 * Wait for a specified amount of time
 * Useful for testing timing-dependent behavior
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to become true
 * Useful for waiting for async state changes
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    timeoutMessage?: string;
  } = {}
): Promise<void> {
  const {
    timeout = 5000,
    interval = 10,
    timeoutMessage = 'Condition not met within timeout'
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await condition();
      if (result) {
        return;
      }
    } catch (error) {
      // Continue waiting if condition throws
    }
    await wait(interval);
  }

  throw new Error(timeoutMessage);
}

/**
 * Wait for a promise to resolve or reject
 * Useful for testing promise behavior with timeout
 */
export async function waitForPromise<T>(
  promise: Promise<T>,
  timeout: number = 5000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Promise timed out after ${timeout}ms`)), timeout)
    )
  ]);
}

/**
 * Create a promise that can be resolved externally
 * Useful for controlling async flow in tests
 */
export function createDeferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Retry a function until it succeeds or max attempts reached
 * Useful for testing flaky operations
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 100, backoffMultiplier = 2 } = options;

  let attempt = 1;
  let currentDelay = delay;

  while (attempt <= maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      await wait(currentDelay);
      currentDelay *= backoffMultiplier;
      attempt++;
    }
  }

  throw new Error('Retry logic error'); // Should never reach here
}

/**
 * Execute multiple async functions in sequence
 * Useful for testing sequential operations
 */
export async function sequence<T>(
  functions: Array<() => Promise<T>>
): Promise<T[]> {
  const results: T[] = [];
  for (const fn of functions) {
    results.push(await fn());
  }
  return results;
}

/**
 * Execute multiple async functions in parallel with timeout
 * Useful for testing concurrent operations
 */
export async function parallel<T>(
  functions: Array<() => Promise<T>>,
  timeout: number = 5000
): Promise<T[]> {
  const promises = functions.map(fn => fn());
  return waitForPromise(Promise.all(promises), timeout);
}

/**
 * Create a mock async function that resolves after a delay
 * Useful for simulating slow async operations
 */
export function createAsyncMock<T>(
  value: T,
  delay: number = 100
): () => Promise<T> {
  return () => wait(delay).then(() => value);
}

/**
 * Create a mock async function that rejects after a delay
 * Useful for simulating async errors
 */
export function createAsyncErrorMock(
  error: Error | string,
  delay: number = 100
): () => Promise<never> {
  const errorInstance = typeof error === 'string' ? new Error(error) : error;
  return () => wait(delay).then(() => Promise.reject(errorInstance));
}

/**
 * Test that an async function completes within a time limit
 * Useful for performance testing
 */
export async function expectAsyncToCompleteWithin<T>(
  asyncFn: () => Promise<T>,
  maxTime: number
): Promise<T> {
  const startTime = Date.now();
  const result = await asyncFn();
  const elapsed = Date.now() - startTime;

  if (elapsed > maxTime) {
    throw new Error(`Expected operation to complete within ${maxTime}ms, but took ${elapsed}ms`);
  }

  return result;
}

/**
 * Test that an async function takes at least a minimum amount of time
 * Useful for testing rate limiting or debouncing
 */
export async function expectAsyncToTakeAtLeast<T>(
  asyncFn: () => Promise<T>,
  minTime: number
): Promise<T> {
  const startTime = Date.now();
  const result = await asyncFn();
  const elapsed = Date.now() - startTime;

  if (elapsed < minTime) {
    throw new Error(`Expected operation to take at least ${minTime}ms, but took ${elapsed}ms`);
  }

  return result;
}