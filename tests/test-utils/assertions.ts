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

// ============================================================================
// Tool Assertion Helpers
// ============================================================================

/**
 * Interface representing a tool call record for testing
 */
export interface ToolCallRecord {
  toolName: string;
  parameters: Record<string, unknown>;
  callIndex?: number;
  timestamp?: Date;
  success?: boolean;
  result?: any;
}

/**
 * Mock tool registry for tracking tool calls in tests
 */
export interface MockToolRegistry {
  getInvocations(toolName?: string): ToolCallRecord[];
  getAllInvocations(): ToolCallRecord[];
  reset(): void;
}

/**
 * Assert that a specific tool was called at least once
 * Provides clear error messages when tools are not called as expected
 *
 * @param toolCalls - Array of tool call records or mock registry
 * @param toolName - Name of the tool that should have been called
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * const mockRegistry = setupMockToolRegistry();
 * // ... execute test scenario
 * expectToolCalled(mockRegistry, 'Read');
 * expectToolCalled(mockRegistry, 'Write', 'Expected file to be written');
 * ```
 */
export function expectToolCalled(
  toolCalls: ToolCallRecord[] | MockToolRegistry,
  toolName: string,
  message?: string
): void {
  const calls = Array.isArray(toolCalls)
    ? toolCalls.filter(call => call.toolName === toolName)
    : toolCalls.getInvocations(toolName);

  const defaultMessage = `Expected tool '${toolName}' to be called at least once, but it was not called`;
  const errorMessage = message || defaultMessage;

  expect(calls.length).toBeGreaterThan(0);

  if (calls.length === 0) {
    const allCalls = Array.isArray(toolCalls)
      ? toolCalls.map(call => call.toolName)
      : toolCalls.getAllInvocations().map(call => call.toolName);

    const availableTools = [...new Set(allCalls)].join(', ');
    throw new Error(
      `${errorMessage}. Available tools called: [${availableTools}]`
    );
  }
}

/**
 * Assert that a specific tool was called with specific parameters
 * Supports partial parameter matching and custom validation functions
 *
 * @param toolCalls - Array of tool call records or mock registry
 * @param toolName - Name of the tool that should have been called
 * @param expectedParams - Expected parameters (partial match) or validation function
 * @param options - Additional assertion options
 *
 * @example
 * ```typescript
 * // Exact parameter match
 * expectToolCalledWith(mockRegistry, 'Read', { file_path: '/test.txt' });
 *
 * // Partial parameter match
 * expectToolCalledWith(mockRegistry, 'Write', { file_path: '/test.txt' }, { partial: true });
 *
 * // Custom validation function
 * expectToolCalledWith(mockRegistry, 'Bash', (params) => {
 *   return typeof params.command === 'string' && params.command.includes('git');
 * });
 *
 * // Specific call index
 * expectToolCalledWith(mockRegistry, 'Read', { file_path: '/config.txt' }, { callIndex: 1 });
 * ```
 */
export function expectToolCalledWith(
  toolCalls: ToolCallRecord[] | MockToolRegistry,
  toolName: string,
  expectedParams: Record<string, unknown> | ((params: Record<string, unknown>) => boolean),
  options: {
    /** Only check subset of parameters (default: false) */
    partial?: boolean;
    /** Check specific call index (default: any call) */
    callIndex?: number;
    /** Custom error message */
    message?: string;
  } = {}
): void {
  const calls = Array.isArray(toolCalls)
    ? toolCalls.filter(call => call.toolName === toolName)
    : toolCalls.getInvocations(toolName);

  // First ensure the tool was called
  expectToolCalled(toolCalls, toolName, options.message);

  // Get specific call or check all calls
  const callsToCheck = options.callIndex !== undefined
    ? [calls[options.callIndex]].filter(Boolean)
    : calls;

  if (options.callIndex !== undefined && !calls[options.callIndex]) {
    throw new Error(
      `Expected tool '${toolName}' to have been called at index ${options.callIndex}, but only ${calls.length} calls were made`
    );
  }

  let foundMatch = false;
  const matchErrors: string[] = [];

  for (const call of callsToCheck) {
    try {
      if (typeof expectedParams === 'function') {
        // Custom validation function
        const isValid = expectedParams(call.parameters);
        if (isValid) {
          foundMatch = true;
          break;
        } else {
          matchErrors.push(`Call parameters ${JSON.stringify(call.parameters)} failed custom validation`);
        }
      } else {
        // Parameter matching
        if (options.partial) {
          // Partial match - check that all expected params are present with correct values
          let matches = true;
          const missingKeys: string[] = [];
          const wrongValues: Array<{ key: string; expected: unknown; actual: unknown }> = [];

          for (const [key, expectedValue] of Object.entries(expectedParams)) {
            if (!(key in call.parameters)) {
              matches = false;
              missingKeys.push(key);
            } else if (!deepEqual(call.parameters[key], expectedValue)) {
              matches = false;
              wrongValues.push({ key, expected: expectedValue, actual: call.parameters[key] });
            }
          }

          if (matches) {
            foundMatch = true;
            break;
          } else {
            let errorParts = [];
            if (missingKeys.length > 0) {
              errorParts.push(`missing keys: ${missingKeys.join(', ')}`);
            }
            if (wrongValues.length > 0) {
              errorParts.push(`wrong values: ${wrongValues.map(w => `${w.key}(expected: ${JSON.stringify(w.expected)}, got: ${JSON.stringify(w.actual)})`).join(', ')}`);
            }
            matchErrors.push(`Partial match failed - ${errorParts.join(', ')}`);
          }
        } else {
          // Exact match
          if (deepEqual(call.parameters, expectedParams)) {
            foundMatch = true;
            break;
          } else {
            matchErrors.push(`Exact match failed - expected: ${JSON.stringify(expectedParams)}, got: ${JSON.stringify(call.parameters)}`);
          }
        }
      }
    } catch (error) {
      matchErrors.push(`Error comparing parameters: ${error}`);
    }
  }

  if (!foundMatch) {
    const baseMessage = options.message ||
      `Expected tool '${toolName}' to be called with matching parameters`;

    const detailedMessage = `${baseMessage}. Match attempts:\n${matchErrors.map((err, i) => `  ${i + 1}. ${err}`).join('\n')}`;

    throw new Error(detailedMessage);
  }
}

/**
 * Assert that tools were called in a specific order
 * Useful for testing workflows and dependencies between tool calls
 *
 * @param toolCalls - Array of tool call records or mock registry
 * @param expectedOrder - Array of tool names in expected order
 * @param options - Additional assertion options
 *
 * @example
 * ```typescript
 * // Strict order - tools must be called in exact sequence
 * expectToolCallOrder(mockRegistry, ['Read', 'Write', 'Bash']);
 *
 * // Partial order - only check that specified tools appear in order (others can be interspersed)
 * expectToolCallOrder(mockRegistry, ['Read', 'Write'], { strict: false });
 *
 * // Allow repeated tools
 * expectToolCallOrder(mockRegistry, ['Read', 'Read', 'Write'], { allowRepeats: true });
 * ```
 */
export function expectToolCallOrder(
  toolCalls: ToolCallRecord[] | MockToolRegistry,
  expectedOrder: string[],
  options: {
    /** Require exact sequence with no other tools in between (default: true) */
    strict?: boolean;
    /** Allow the same tool to appear multiple times in sequence (default: false) */
    allowRepeats?: boolean;
    /** Custom error message */
    message?: string;
  } = {}
): void {
  const allCalls = Array.isArray(toolCalls)
    ? toolCalls
    : toolCalls.getAllInvocations();

  const { strict = true, allowRepeats = false } = options;

  if (expectedOrder.length === 0) {
    return; // Nothing to check
  }

  // Get sequence of actual tool names
  const actualSequence = allCalls
    .sort((a, b) => {
      // Sort by call index if available, otherwise by timestamp, otherwise preserve order
      if (a.callIndex !== undefined && b.callIndex !== undefined) {
        return a.callIndex - b.callIndex;
      }
      if (a.timestamp && b.timestamp) {
        return a.timestamp.getTime() - b.timestamp.getTime();
      }
      return 0;
    })
    .map(call => call.toolName);

  if (strict) {
    // Strict mode: exact sequence match
    let expectedSlice: string[];

    if (!allowRepeats) {
      // Remove consecutive duplicates from expected order for comparison
      expectedSlice = expectedOrder.reduce<string[]>((acc, tool, index) => {
        if (index === 0 || tool !== expectedOrder[index - 1]) {
          acc.push(tool);
        }
        return acc;
      }, []);
    } else {
      expectedSlice = expectedOrder;
    }

    let actualSlice: string[];

    if (!allowRepeats) {
      // Remove consecutive duplicates from actual sequence for comparison
      actualSlice = actualSequence.reduce<string[]>((acc, tool, index) => {
        if (index === 0 || tool !== actualSequence[index - 1]) {
          acc.push(tool);
        }
        return acc;
      }, []);
    } else {
      actualSlice = actualSequence;
    }

    // For strict mode, check if the actual sequence starts with the expected sequence
    const actualPrefix = actualSlice.slice(0, expectedSlice.length);

    if (JSON.stringify(actualPrefix) !== JSON.stringify(expectedSlice)) {
      const defaultMessage = `Expected tools to be called in strict order: [${expectedSlice.join(', ')}], but got: [${actualSlice.join(', ')}]`;
      throw new Error(options.message || defaultMessage);
    }
  } else {
    // Non-strict mode: find subsequence
    let expectedIndex = 0;
    let lastFoundIndex = -1;

    for (let i = 0; i < actualSequence.length && expectedIndex < expectedOrder.length; i++) {
      if (actualSequence[i] === expectedOrder[expectedIndex]) {
        if (!allowRepeats && i <= lastFoundIndex) {
          continue; // Skip if not allowing repeats and this would be out of order
        }
        lastFoundIndex = i;
        expectedIndex++;
      }
    }

    if (expectedIndex < expectedOrder.length) {
      const foundTools = expectedOrder.slice(0, expectedIndex);
      const missingTools = expectedOrder.slice(expectedIndex);
      const defaultMessage = `Expected tool call order [${expectedOrder.join(', ')}] not found in sequence. Found: [${foundTools.join(', ')}], Missing: [${missingTools.join(', ')}]. Actual sequence: [${actualSequence.join(', ')}]`;
      throw new Error(options.message || defaultMessage);
    }
  }
}

/**
 * Assert that a specific tool was called a specific number of times
 * Provides detailed information about actual vs expected call counts
 *
 * @param toolCalls - Array of tool call records or mock registry
 * @param toolName - Name of the tool to check
 * @param expectedCount - Expected number of calls
 * @param options - Additional assertion options
 *
 * @example
 * ```typescript
 * // Exact count
 * expectToolCallCount(mockRegistry, 'Read', 2);
 *
 * // At least N calls
 * expectToolCallCount(mockRegistry, 'Write', 1, { minimum: true });
 *
 * // At most N calls
 * expectToolCallCount(mockRegistry, 'Bash', 3, { maximum: true });
 *
 * // Range of acceptable counts
 * expectToolCallCount(mockRegistry, 'Grep', 2, { minimum: true });
 * expectToolCallCount(mockRegistry, 'Grep', 5, { maximum: true });
 * ```
 */
export function expectToolCallCount(
  toolCalls: ToolCallRecord[] | MockToolRegistry,
  toolName: string,
  expectedCount: number,
  options: {
    /** Check for minimum count instead of exact (default: false) */
    minimum?: boolean;
    /** Check for maximum count instead of exact (default: false) */
    maximum?: boolean;
    /** Custom error message */
    message?: string;
  } = {}
): void {
  const calls = Array.isArray(toolCalls)
    ? toolCalls.filter(call => call.toolName === toolName)
    : toolCalls.getInvocations(toolName);

  const actualCount = calls.length;
  const { minimum = false, maximum = false } = options;

  let conditionMet = false;
  let comparison = '';

  if (minimum && maximum) {
    throw new Error('Cannot specify both minimum and maximum options - use separate calls or exact count');
  } else if (minimum) {
    conditionMet = actualCount >= expectedCount;
    comparison = `at least ${expectedCount}`;
  } else if (maximum) {
    conditionMet = actualCount <= expectedCount;
    comparison = `at most ${expectedCount}`;
  } else {
    conditionMet = actualCount === expectedCount;
    comparison = `exactly ${expectedCount}`;
  }

  if (!conditionMet) {
    const defaultMessage = `Expected tool '${toolName}' to be called ${comparison} time(s), but it was called ${actualCount} time(s)`;

    // Add helpful context about the calls
    let contextMessage = '';
    if (actualCount > 0) {
      const callDetails = calls.map((call, index) =>
        `  ${index + 1}. ${JSON.stringify(call.parameters)}`
      ).join('\n');
      contextMessage = `\n\nActual calls:\n${callDetails}`;
    }

    throw new Error((options.message || defaultMessage) + contextMessage);
  }
}

/**
 * Helper function to perform deep equality check for objects
 * Used internally by tool assertion helpers
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }

  if (typeof a !== typeof b) return false;

  if (typeof a !== 'object') return a === b;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);

  if (keysA.length !== keysB.length) return false;

  return keysA.every(key =>
    keysB.includes(key) &&
    deepEqual((a as any)[key], (b as any)[key])
  );
}