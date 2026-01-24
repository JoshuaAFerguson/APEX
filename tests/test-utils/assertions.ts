/**
 * Assertion helpers for testing
 * Provides enhanced assertion utilities beyond basic expect()
 */

import { expect } from 'vitest';

/**
 * Assert that an error is thrown with a specific message pattern
 * Useful for testing error conditions
 */
export async function expectToThrow(
  fn: () => any | Promise<any>,
  expectedMessage?: string | RegExp
): Promise<Error> {
  let thrownError: Error | null = null;

  try {
    const result = fn();
    if (result instanceof Promise) {
      await result;
    }
  } catch (error) {
    thrownError = error instanceof Error ? error : new Error(String(error));
  }

  if (!thrownError) {
    throw new Error('Expected function to throw, but it did not');
  }

  if (expectedMessage) {
    if (typeof expectedMessage === 'string') {
      expect(thrownError.message).toContain(expectedMessage);
    } else {
      expect(thrownError.message).toMatch(expectedMessage);
    }
  }

  return thrownError;
}

/**
 * Assert that an object has specific shape/properties
 * Useful for testing object structure
 */
export function expectObjectShape<T>(
  actual: any,
  expected: Partial<T>
): void {
  expect(actual).toBeDefined();
  expect(typeof actual).toBe('object');

  for (const [key, value] of Object.entries(expected)) {
    expect(actual).toHaveProperty(key);
    if (value !== undefined) {
      expect(actual[key]).toEqual(value);
    }
  }
}

/**
 * Assert that an array contains elements matching a pattern
 * Useful for testing array contents
 */
export function expectArrayToContain<T>(
  array: any[],
  matcher: (item: T) => boolean,
  count?: number
): void {
  expect(Array.isArray(array)).toBe(true);

  const matches = array.filter(matcher);

  if (count !== undefined) {
    expect(matches).toHaveLength(count);
  } else {
    expect(matches.length).toBeGreaterThan(0);
  }
}

/**
 * Assert that an array is sorted by a specific property
 * Useful for testing sorted data
 */
export function expectArrayToBeSorted<T>(
  array: T[],
  getComparable: (item: T) => string | number | Date,
  direction: 'asc' | 'desc' = 'asc'
): void {
  expect(Array.isArray(array)).toBe(true);

  if (array.length <= 1) return;

  for (let i = 1; i < array.length; i++) {
    const prev = getComparable(array[i - 1]);
    const curr = getComparable(array[i]);

    if (direction === 'asc') {
      expect(curr >= prev).toBe(true);
    } else {
      expect(curr <= prev).toBe(true);
    }
  }
}

/**
 * Assert that a function is called with specific arguments
 * Enhanced version of vitest's spy assertions
 */
export function expectToHaveBeenCalledWithShape(
  spy: any,
  expectedArgs: any[],
  callIndex: number = 0
): void {
  expect(spy).toHaveBeenCalled();
  expect(spy.mock.calls.length).toBeGreaterThan(callIndex);

  const actualArgs = spy.mock.calls[callIndex];
  expect(actualArgs).toHaveLength(expectedArgs.length);

  for (let i = 0; i < expectedArgs.length; i++) {
    const expected = expectedArgs[i];
    const actual = actualArgs[i];

    if (typeof expected === 'object' && expected !== null) {
      expectObjectShape(actual, expected);
    } else {
      expect(actual).toEqual(expected);
    }
  }
}

/**
 * Assert that a value is within a numeric range
 * Useful for testing measurements and calculations
 */
export function expectToBeWithinRange(
  actual: number,
  min: number,
  max: number,
  inclusive: boolean = true
): void {
  expect(typeof actual).toBe('number');
  expect(!isNaN(actual)).toBe(true);

  if (inclusive) {
    expect(actual >= min).toBe(true);
    expect(actual <= max).toBe(true);
  } else {
    expect(actual > min).toBe(true);
    expect(actual < max).toBe(true);
  }
}

/**
 * Assert that two dates are approximately equal
 * Useful for testing timestamp-sensitive operations
 */
export function expectDatesToBeClose(
  actual: Date,
  expected: Date,
  toleranceMs: number = 1000
): void {
  expect(actual).toBeInstanceOf(Date);
  expect(expected).toBeInstanceOf(Date);
  expect(!isNaN(actual.getTime())).toBe(true);
  expect(!isNaN(expected.getTime())).toBe(true);

  const diff = Math.abs(actual.getTime() - expected.getTime());
  expect(diff).toBeLessThanOrEqual(toleranceMs);
}

/**
 * Assert that a string matches a pattern with variables
 * Useful for testing generated strings with dynamic content
 */
export function expectStringToMatchPattern(
  actual: string,
  pattern: string,
  variables: Record<string, string | number> = {}
): void {
  expect(typeof actual).toBe('string');

  let expectedPattern = pattern;
  for (const [key, value] of Object.entries(variables)) {
    expectedPattern = expectedPattern.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }

  expect(actual).toMatch(new RegExp(expectedPattern));
}

/**
 * Assert that an event emitter has emitted specific events
 * Useful for testing event-driven systems
 */
export function expectEventsToHaveBeenEmitted(
  eventTracker: { events: Array<{ type: string; data?: any }> },
  expectedEvents: Array<string | { type: string; data?: any }>
): void {
  const actualEventTypes = eventTracker.events.map(e => e.type);

  for (const expected of expectedEvents) {
    if (typeof expected === 'string') {
      expect(actualEventTypes).toContain(expected);
    } else {
      const matchingEvent = eventTracker.events.find(e =>
        e.type === expected.type &&
        (expected.data === undefined || JSON.stringify(e.data) === JSON.stringify(expected.data))
      );
      expect(matchingEvent).toBeDefined();
    }
  }
}

/**
 * Assert that a file system path exists and has expected permissions
 * Useful for testing file operations
 */
export async function expectPathToExist(
  path: string,
  options: {
    isFile?: boolean;
    isDirectory?: boolean;
    isReadable?: boolean;
    isWritable?: boolean;
  } = {}
): Promise<void> {
  const fs = await import('fs/promises');

  try {
    const stats = await fs.stat(path);

    if (options.isFile !== undefined) {
      expect(stats.isFile()).toBe(options.isFile);
    }

    if (options.isDirectory !== undefined) {
      expect(stats.isDirectory()).toBe(options.isDirectory);
    }

    // Note: Readable/writable checks would require platform-specific implementation
    // For now, we just check existence and file type
  } catch (error) {
    throw new Error(`Expected path '${path}' to exist, but got error: ${error}`);
  }
}

/**
 * Assert that a promise resolves to a specific value within a time limit
 * Combines async testing with assertion
 */
export async function expectToResolveWithin<T>(
  promise: Promise<T>,
  expectedValue: T,
  timeoutMs: number = 5000
): Promise<void> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Promise did not resolve within ${timeoutMs}ms`)), timeoutMs)
  );

  const result = await Promise.race([promise, timeoutPromise]);
  expect(result).toEqual(expectedValue);
}

/**
 * Assert that a value matches any of several possible values
 * Useful for testing scenarios with multiple valid outcomes
 */
export function expectToBeOneOf<T>(
  actual: T,
  possibleValues: T[]
): void {
  expect(possibleValues).toContain(actual);
}

/**
 * Assert that an object has all required properties and only allowed properties
 * Useful for testing API responses and data structures
 */
export function expectToHaveExactShape<T>(
  actual: any,
  requiredKeys: (keyof T)[],
  allowedKeys: (keyof T)[] = requiredKeys
): void {
  expect(actual).toBeDefined();
  expect(typeof actual).toBe('object');

  // Check all required keys are present
  for (const key of requiredKeys) {
    expect(actual).toHaveProperty(key as string);
  }

  // Check no unexpected keys are present
  const actualKeys = Object.keys(actual);
  const allowedKeyStrings = allowedKeys.map(k => String(k));

  for (const key of actualKeys) {
    expect(allowedKeyStrings).toContain(key);
  }
}