/**
 * Test utilities for verifying timing data for failed tool executions
 *
 * These helpers provide reusable assertion functions and mock factories
 * specifically designed for testing that timing data (startTime, endTime, duration)
 * is correctly captured and reported for tools that fail during execution.
 *
 * @module failed-tool-timing-helpers
 */

import { expect } from 'vitest';

/**
 * Configuration for creating failing tool mocks
 */
export interface FailingToolMockOptions {
  /** Delay in milliseconds before the tool fails */
  delayMs?: number;
  /** Error message to include in the failure */
  errorMessage?: string;
  /** Type of error to simulate */
  errorType?: 'is_error' | 'exception' | 'timeout' | 'validation' | 'permission' | 'network';
  /** Additional metadata to include */
  metadata?: Record<string, unknown>;
}

/**
 * Assertion options for verifying failed tool timing
 */
export interface FailedToolTimingAssertion {
  /** Expected call ID to match */
  callId?: string;
  /** Minimum expected duration in milliseconds */
  expectedMinDuration?: number;
  /** Maximum expected duration in milliseconds */
  expectedMaxDuration?: number;
  /** Expected error type or message pattern */
  expectedErrorType?: string;
  /** Whether to allow zero duration (for immediate failures) */
  allowZeroDuration?: boolean;
  /** Tolerance in milliseconds for timing comparisons */
  tolerance?: number;
}

/**
 * Structure of a ToolCallCompleteEvent for assertion purposes
 */
export interface ToolCallCompleteEventLike {
  taskId: string;
  toolName: string;
  callId: string;
  result: {
    success: boolean;
    output?: unknown;
    error?: string;
  };
  timing: {
    startTime: Date;
    endTime: Date;
    duration: number;
  };
  timestamp: Date;
}

/**
 * Default tolerance for timing assertions (accounts for CI variability)
 */
export const DEFAULT_TIMING_TOLERANCE = 50;

/**
 * Assert that a tool call complete event has valid timing data for a failed tool
 *
 * @param event - The ToolCallCompleteEvent to validate
 * @param assertions - Optional assertions to apply
 *
 * @example
 * ```typescript
 * assertFailedToolTiming(event, {
 *   expectedMinDuration: 100,
 *   expectedMaxDuration: 200,
 *   expectedErrorType: 'timeout'
 * });
 * ```
 */
export function assertFailedToolTiming(
  event: ToolCallCompleteEventLike,
  assertions: FailedToolTimingAssertion = {}
): void {
  const tolerance = assertions.tolerance ?? DEFAULT_TIMING_TOLERANCE;

  // Verify timing data is present
  expect(event.timing).toBeDefined();
  expect(event.timing.startTime).toBeInstanceOf(Date);
  expect(event.timing.endTime).toBeInstanceOf(Date);

  // Duration should be a non-negative number
  if (assertions.allowZeroDuration) {
    expect(event.timing.duration).toBeGreaterThanOrEqual(0);
  } else {
    expect(event.timing.duration).toBeGreaterThan(0);
  }

  // Verify timing consistency: calculated duration should match reported duration
  const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
  expect(event.timing.duration).toBe(calculatedDuration);

  // Verify failure status
  expect(event.result.success).toBe(false);
  expect(event.result.error).toBeDefined();

  // Verify optional assertions
  if (assertions.callId !== undefined) {
    expect(event.callId).toBe(assertions.callId);
  }

  if (assertions.expectedMinDuration !== undefined) {
    expect(event.timing.duration).toBeGreaterThanOrEqual(
      assertions.expectedMinDuration - tolerance
    );
  }

  if (assertions.expectedMaxDuration !== undefined) {
    expect(event.timing.duration).toBeLessThanOrEqual(
      assertions.expectedMaxDuration + tolerance * 2 // Extra buffer for CI
    );
  }

  if (assertions.expectedErrorType !== undefined) {
    expect(event.result.error).toContain(assertions.expectedErrorType);
  }
}

/**
 * Assert that timing is accurate within tolerance bounds
 *
 * @param actualDuration - The measured duration in milliseconds
 * @param expectedDuration - The expected duration in milliseconds
 * @param tolerance - Tolerance in milliseconds (default: 50ms)
 */
export function assertTimingAccuracy(
  actualDuration: number,
  expectedDuration: number,
  tolerance: number = DEFAULT_TIMING_TOLERANCE
): void {
  expect(actualDuration).toBeGreaterThanOrEqual(expectedDuration - tolerance);
  expect(actualDuration).toBeLessThanOrEqual(expectedDuration + tolerance * 2);
}

/**
 * Assert that multiple failed tool events have independent, accurate timing
 *
 * @param events - Array of ToolCallCompleteEvent objects
 * @param expectedDelays - Optional array of expected delays for each tool
 */
export function assertConcurrentFailedToolTiming(
  events: ToolCallCompleteEventLike[],
  expectedDelays?: number[]
): void {
  // Each event should have valid timing
  events.forEach((event, index) => {
    assertFailedToolTiming(event, {
      allowZeroDuration: true,
      expectedMinDuration: expectedDelays?.[index],
    });
  });

  // Each event should have unique call ID (independent tracking)
  const callIds = events.map((e) => e.callId);
  const uniqueCallIds = new Set(callIds);
  expect(uniqueCallIds.size).toBe(events.length);

  // Events should have independent timestamps
  events.forEach((event) => {
    expect(event.timing.startTime.getTime()).toBeGreaterThan(0);
    expect(event.timing.endTime.getTime()).toBeGreaterThan(0);
    expect(event.timing.endTime.getTime()).toBeGreaterThanOrEqual(event.timing.startTime.getTime());
  });
}

/**
 * Create a mock tool result message that simulates a tool failure
 *
 * @param options - Configuration for the failure
 * @returns Mock message object for yielding in tests
 */
export function createFailingToolResultMessage(
  callId: string,
  errorMessage: string = 'Tool execution failed',
  additionalContent?: Record<string, unknown>
) {
  return {
    type: 'message',
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: callId,
        content: errorMessage,
        is_error: true,
        ...additionalContent,
      },
    ],
  };
}

/**
 * Create a mock tool use message (for starting a tool)
 *
 * @param callId - The call ID for the tool
 * @param toolName - Name of the tool
 * @param input - Input parameters for the tool
 */
export function createToolUseMessage(
  callId: string,
  toolName: string,
  input: Record<string, unknown> = {}
) {
  return {
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: callId,
        name: toolName,
        input,
      },
    ],
  };
}

/**
 * Create a final assistant text message (to complete a mock query)
 *
 * @param text - The text content of the message
 */
export function createAssistantTextMessage(text: string = 'Task completed') {
  return {
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

/**
 * Generator function factory for creating mock query implementations
 * that simulate failed tool executions with configurable timing
 *
 * @param options - Configuration for the failing tool mock
 * @returns An async generator function suitable for mocking query()
 *
 * @example
 * ```typescript
 * mockedQuery.mockImplementation(
 *   createFailingToolQueryMock({
 *     delayMs: 100,
 *     errorMessage: 'Connection timeout',
 *     errorType: 'timeout'
 *   })
 * );
 * ```
 */
export function createFailingToolQueryMock(options: FailingToolMockOptions = {}) {
  const { delayMs = 50, errorMessage = 'Tool execution failed', errorType = 'is_error' } = options;

  const callId = `error_call_${Date.now()}`;

  return async function* () {
    // Emit tool use
    yield createToolUseMessage(callId, 'FailingTool', { errorType });

    // Simulate delay
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // Different error handling based on type
    if (errorType === 'exception') {
      throw new Error(errorMessage);
    }

    // Emit tool result with error
    yield createFailingToolResultMessage(callId, errorMessage);

    // Final message
    yield createAssistantTextMessage('Handling tool error');
  };
}

/**
 * Create a mock query implementation for multiple concurrent failing tools
 *
 * @param toolConfigs - Array of tool configurations
 * @returns An async generator function for mocking
 */
export function createConcurrentFailingToolsQueryMock(
  toolConfigs: Array<{
    callId: string;
    toolName: string;
    delayMs: number;
    errorMessage: string;
  }>
) {
  return async function* () {
    // Emit all tool uses at once
    yield {
      type: 'message',
      role: 'assistant',
      content: toolConfigs.map((config) => ({
        type: 'tool_use',
        id: config.callId,
        name: config.toolName,
        input: {},
      })),
    };

    // Process each tool's failure with its specific delay
    for (const config of toolConfigs) {
      await new Promise((resolve) => setTimeout(resolve, config.delayMs));
      yield createFailingToolResultMessage(config.callId, config.errorMessage);
    }

    // Final message
    yield createAssistantTextMessage('All tools completed with errors');
  };
}

/**
 * Create a mock query that has mixed success and failure results
 *
 * @param successToolIds - Call IDs for successful tools
 * @param failureToolIds - Call IDs for failing tools
 */
export function createMixedResultsQueryMock(successToolIds: string[], failureToolIds: string[]) {
  return async function* () {
    // Emit all tool uses
    const allToolUses = [
      ...successToolIds.map((id) => ({
        type: 'tool_use',
        id,
        name: 'SuccessTool',
        input: {},
      })),
      ...failureToolIds.map((id) => ({
        type: 'tool_use',
        id,
        name: 'FailureTool',
        input: {},
      })),
    ];

    yield {
      type: 'message',
      role: 'assistant',
      content: allToolUses,
    };

    // Small delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Complete successful tools
    for (const id of successToolIds) {
      yield {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: id,
            content: 'Success',
            is_error: false,
          },
        ],
      };
    }

    // Complete failing tools
    for (const id of failureToolIds) {
      yield createFailingToolResultMessage(id, 'Tool failed');
    }

    yield createAssistantTextMessage('Mixed results completed');
  };
}

/**
 * Utility to wait for specific events with timeout
 *
 * @param eventCollector - Array to collect events
 * @param predicate - Function to check if we have all expected events
 * @param timeout - Maximum time to wait in milliseconds
 * @returns Promise that resolves when predicate is true or rejects on timeout
 */
export function waitForEvents<T>(
  eventCollector: T[],
  predicate: (events: T[]) => boolean,
  timeout: number = 5000
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      if (predicate(eventCollector)) {
        resolve(eventCollector);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for events. Collected ${eventCollector.length} events.`));
      } else {
        setTimeout(check, 10);
      }
    };

    check();
  });
}

/**
 * Error type constants for consistent test categorization
 */
export const ErrorTypes = {
  TIMEOUT: 'timeout',
  VALIDATION: 'validation_error',
  PERMISSION: 'permission_denied',
  NETWORK: 'network_error',
  NOT_FOUND: 'not_found',
  INTERNAL: 'internal_error',
} as const;

export type ErrorType = (typeof ErrorTypes)[keyof typeof ErrorTypes];

/**
 * Create an error message for a specific error type
 *
 * @param errorType - The type of error to create
 * @param details - Optional additional details
 */
export function createErrorMessage(errorType: ErrorType, details?: string): string {
  const messages: Record<ErrorType, string> = {
    [ErrorTypes.TIMEOUT]: 'Operation timed out',
    [ErrorTypes.VALIDATION]: 'Validation failed',
    [ErrorTypes.PERMISSION]: 'Permission denied',
    [ErrorTypes.NETWORK]: 'Network error occurred',
    [ErrorTypes.NOT_FOUND]: 'Resource not found',
    [ErrorTypes.INTERNAL]: 'Internal error',
  };

  return details ? `${messages[errorType]}: ${details}` : messages[errorType];
}
