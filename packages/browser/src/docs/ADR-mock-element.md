# ADR: MockElement Class for Browser Automation Testing

## Status
Proposed

## Date
2025-01-27

## Context

The APEX browser automation package (`@apexcli/browser`) provides browser automation capabilities via Playwright. However, testing components that depend on browser elements requires the ability to mock element interactions without launching a real browser.

The existing codebase has established patterns for mock implementations:
- `@apex/core/mcp/mock-types.ts` - Comprehensive mock configuration types using Zod schemas
- `@apex/orchestrator/mcp/mock-server/` - Mock MCP server implementation with behavior engines
- Existing patterns use configurable success/failure via configuration objects

The task requires implementing:
1. `IElement` interface - Contract for element interactions
2. `IMockConfiguration` - Configuration for mock behavior (success/failure scenarios)
3. `MockElement` class - Implementation with configurable behavior

### Key Requirements
- `MockElement` must implement `IElement` interface
- Methods required: `click()`, `type()`, `getText()`, `getAttribute()`, `isVisible()`, `waitFor()`
- Supports configurable success/failure via `IMockConfiguration`
- Must integrate with existing `BrowserActionResult<T>` pattern

## Decision

### 1. Interface Definitions

#### IElement Interface

The `IElement` interface provides an abstraction over browser elements, allowing for both real Playwright implementations and mock implementations.

```typescript
/**
 * Interface representing a DOM element for browser automation.
 * Provides methods for interaction and inspection.
 */
export interface IElement {
  /** Unique selector used to locate this element */
  readonly selector: string;

  /**
   * Clicks on the element
   * @param options - Click options (timeout, force, etc.)
   */
  click(options?: ElementClickOptions): Promise<BrowserActionResult<void>>;

  /**
   * Types text into the element (for inputs, textareas, contenteditable)
   * @param text - Text to type
   * @param options - Typing options (delay, clear, etc.)
   */
  type(text: string, options?: ElementTypeOptions): Promise<BrowserActionResult<void>>;

  /**
   * Gets the text content of the element
   * @param options - Options (timeout)
   */
  getText(options?: ElementGetOptions): Promise<BrowserActionResult<string>>;

  /**
   * Gets the value of a specific attribute
   * @param name - Attribute name
   * @param options - Options (timeout)
   */
  getAttribute(name: string, options?: ElementGetOptions): Promise<BrowserActionResult<string | null>>;

  /**
   * Checks if the element is currently visible
   * @param options - Options (timeout)
   */
  isVisible(options?: ElementGetOptions): Promise<BrowserActionResult<boolean>>;

  /**
   * Waits for the element to reach a specific state
   * @param state - Target state (visible, hidden, attached, detached)
   * @param options - Wait options (timeout)
   */
  waitFor(state?: ElementWaitState, options?: ElementWaitOptions): Promise<BrowserActionResult<void>>;
}
```

#### Supporting Types

```typescript
/**
 * Element wait states
 */
export type ElementWaitState = 'visible' | 'hidden' | 'attached' | 'detached';

/**
 * Options for element click operations
 */
export interface ElementClickOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Force click even if element is not visible */
  force?: boolean;
  /** Mouse button to use */
  button?: 'left' | 'right' | 'middle';
  /** Number of clicks */
  clickCount?: number;
  /** Delay between mousedown and mouseup in milliseconds */
  delay?: number;
  /** Position relative to element's padding box */
  position?: { x: number; y: number };
}

/**
 * Options for element type operations
 */
export interface ElementTypeOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Delay between keystrokes in milliseconds */
  delay?: number;
  /** Whether to clear the field before typing */
  clear?: boolean;
}

/**
 * Options for element get operations (getText, getAttribute)
 */
export interface ElementGetOptions {
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Options for element wait operations
 */
export interface ElementWaitOptions {
  /** Timeout in milliseconds */
  timeout?: number;
}
```

### 2. Mock Configuration Interface

Following the established patterns from `@apex/core/mcp/mock-types.ts`, the mock configuration provides comprehensive control over mock behavior.

```typescript
import { z } from 'zod';

/**
 * Mock behavior mode - determines how the mock responds
 */
export const MockElementBehaviorModeSchema = z.enum([
  /** All operations succeed (default) */
  'success',
  /** All operations fail with configured error */
  'always_fail',
  /** Operations fail based on method name */
  'fail_methods',
  /** Operations fail in sequence (first N fail, then succeed) */
  'fail_first_n',
  /** Operations fail periodically (every Nth call) */
  'periodic_fail',
  /** Operations follow a predefined sequence of outcomes */
  'sequence',
]);
export type MockElementBehaviorMode = z.infer<typeof MockElementBehaviorModeSchema>;

/**
 * Single outcome in a mock sequence
 */
export const MockElementSequenceItemSchema = z.object({
  /** Whether this operation should succeed or fail */
  outcome: z.enum(['success', 'error']),
  /** Error message if outcome is 'error' */
  errorMessage: z.string().optional(),
  /** Simulated delay before returning (ms) */
  delayMs: z.number().int().min(0).optional(),
  /** Custom return value (for getText, getAttribute, isVisible) */
  returnValue: z.unknown().optional(),
});
export type MockElementSequenceItem = z.infer<typeof MockElementSequenceItemSchema>;

/**
 * Method-specific mock configuration
 */
export const MockElementMethodConfigSchema = z.object({
  /** Whether this method should succeed */
  shouldSucceed: z.boolean().default(true),
  /** Error message if method fails */
  errorMessage: z.string().optional(),
  /** Simulated delay in milliseconds */
  delayMs: z.number().int().min(0).default(0),
  /** Custom return value (for methods that return data) */
  returnValue: z.unknown().optional(),
  /** Number of times this method can be called (0 = unlimited) */
  maxInvocations: z.number().int().min(0).default(0),
});
export type MockElementMethodConfig = z.infer<typeof MockElementMethodConfigSchema>;

/**
 * Mock element state - tracks internal state for assertions
 */
export const MockElementStateSchema = z.object({
  /** Current text content of the element */
  textContent: z.string().default(''),
  /** Current attributes map */
  attributes: z.record(z.string(), z.string()).default({}),
  /** Whether the element is currently visible */
  isVisible: z.boolean().default(true),
  /** Whether the element is attached to the DOM */
  isAttached: z.boolean().default(true),
  /** Whether the element is enabled (for inputs) */
  isEnabled: z.boolean().default(true),
  /** Current input value (for form elements) */
  inputValue: z.string().optional(),
});
export type MockElementState = z.infer<typeof MockElementStateSchema>;

/**
 * Complete mock element configuration
 */
export const MockElementConfigurationSchema = z.object({
  /** Behavior mode determining how operations respond */
  mode: MockElementBehaviorModeSchema.default('success'),

  /** Default timeout for operations (ms) */
  defaultTimeout: z.number().int().min(0).default(5000),

  /** Default delay to simulate for all operations (ms) */
  defaultDelayMs: z.number().int().min(0).default(0),

  /** Error message used when mode is 'always_fail' */
  defaultErrorMessage: z.string().default('Mock element operation failed'),

  /** Methods that should fail (when mode is 'fail_methods') */
  failMethods: z.array(z.enum(['click', 'type', 'getText', 'getAttribute', 'isVisible', 'waitFor'])).default([]),

  /** Number of initial failures (when mode is 'fail_first_n') */
  failCount: z.number().int().min(0).default(0),

  /** Failure period (when mode is 'periodic_fail' - fail every Nth call) */
  failPeriod: z.number().int().min(1).default(2),

  /** Sequence of outcomes (when mode is 'sequence') */
  sequence: z.array(MockElementSequenceItemSchema).default([]),

  /** Per-method configuration overrides */
  methodConfigs: z.object({
    click: MockElementMethodConfigSchema.optional(),
    type: MockElementMethodConfigSchema.optional(),
    getText: MockElementMethodConfigSchema.optional(),
    getAttribute: MockElementMethodConfigSchema.optional(),
    isVisible: MockElementMethodConfigSchema.optional(),
    waitFor: MockElementMethodConfigSchema.optional(),
  }).default({}),

  /** Initial element state */
  initialState: MockElementStateSchema.default({}),

  /** Whether to record all method invocations for assertions */
  recordInvocations: z.boolean().default(true),

  /** Maximum number of invocations to record */
  maxRecordedInvocations: z.number().int().min(0).default(100),
});
export type MockElementConfiguration = z.infer<typeof MockElementConfigurationSchema>;

/**
 * Shorthand type for partial configuration (most common use case)
 */
export type IMockConfiguration = Partial<MockElementConfiguration>;
```

### 3. MockElement Class Architecture

```typescript
/**
 * Recorded method invocation for assertions
 */
export interface MockElementInvocation {
  /** Method that was called */
  method: 'click' | 'type' | 'getText' | 'getAttribute' | 'isVisible' | 'waitFor';
  /** Arguments passed to the method */
  args: unknown[];
  /** Result of the invocation */
  result: BrowserActionResult<unknown>;
  /** Timestamp of invocation */
  timestamp: number;
  /** Duration of simulated operation (ms) */
  duration: number;
}

/**
 * Mock element statistics
 */
export interface MockElementStats {
  /** Total number of invocations */
  totalInvocations: number;
  /** Invocations per method */
  invocationsByMethod: Record<string, number>;
  /** Number of successful invocations */
  successCount: number;
  /** Number of failed invocations */
  failCount: number;
  /** Current sequence index (if using sequence mode) */
  currentSequenceIndex: number;
}

/**
 * MockElement class implementing IElement interface
 * Provides configurable success/failure behavior for testing
 */
export class MockElement implements IElement {
  readonly selector: string;

  private config: MockElementConfiguration;
  private state: MockElementState;
  private invocations: MockElementInvocation[];
  private invocationCount: number;
  private methodInvocationCounts: Map<string, number>;

  constructor(selector: string, config?: IMockConfiguration);

  // IElement implementation
  click(options?: ElementClickOptions): Promise<BrowserActionResult<void>>;
  type(text: string, options?: ElementTypeOptions): Promise<BrowserActionResult<void>>;
  getText(options?: ElementGetOptions): Promise<BrowserActionResult<string>>;
  getAttribute(name: string, options?: ElementGetOptions): Promise<BrowserActionResult<string | null>>;
  isVisible(options?: ElementGetOptions): Promise<BrowserActionResult<boolean>>;
  waitFor(state?: ElementWaitState, options?: ElementWaitOptions): Promise<BrowserActionResult<void>>;

  // Mock-specific methods

  /** Update configuration at runtime */
  updateConfig(config: IMockConfiguration): void;

  /** Get current configuration */
  getConfig(): MockElementConfiguration;

  /** Update element state */
  setState(state: Partial<MockElementState>): void;

  /** Get current element state */
  getState(): MockElementState;

  /** Get all recorded invocations */
  getInvocations(): MockElementInvocation[];

  /** Get invocations for a specific method */
  getInvocationsForMethod(method: string): MockElementInvocation[];

  /** Get statistics about mock usage */
  getStats(): MockElementStats;

  /** Reset invocation history and counters */
  reset(): void;

  /** Reset to initial state */
  resetState(): void;

  // Assertion helpers

  /** Assert that a method was called with specific arguments */
  assertMethodCalled(method: string, args?: unknown[]): void;

  /** Assert that a method was called a specific number of times */
  assertMethodCalledTimes(method: string, times: number): void;

  /** Assert that click was called */
  assertClicked(): void;

  /** Assert that type was called with specific text */
  assertTyped(text: string): void;
}
```

### 4. File Structure

```
packages/browser/src/
├── mock/
│   ├── index.ts                    # Re-exports all mock utilities
│   ├── types.ts                    # IMockConfiguration, IElement, supporting types
│   ├── mock-element.ts             # MockElement class implementation
│   └── __tests__/
│       ├── mock-element.test.ts    # Unit tests
│       └── mock-element.integration.test.ts
├── types.ts                        # Add IElement, ElementClickOptions, etc.
└── index.ts                        # Export mock utilities
```

### 5. Integration with Existing Code

The design integrates with existing patterns:

1. **BrowserActionResult<T>** - All methods return the existing result type
2. **Zod Schemas** - Configuration uses Zod for validation (following mock-types.ts pattern)
3. **ElementSelector** - Compatible with existing selector types
4. **Error Messages** - Uses ERROR_MESSAGES constants where applicable

### 6. Usage Examples

```typescript
// Basic usage - all operations succeed
const element = new MockElement('#my-button');
const result = await element.click();
expect(result.success).toBe(true);

// Configure to always fail
const failingElement = new MockElement('#submit', {
  mode: 'always_fail',
  defaultErrorMessage: 'Element not interactable',
});
const result = await failingElement.click();
expect(result.success).toBe(false);
expect(result.error).toBe('Element not interactable');

// Fail specific methods
const partialElement = new MockElement('#input', {
  mode: 'fail_methods',
  failMethods: ['click'],
});
await partialElement.type('hello'); // succeeds
await partialElement.click();       // fails

// Sequence mode for complex scenarios
const sequenceElement = new MockElement('#flaky', {
  mode: 'sequence',
  sequence: [
    { outcome: 'error', errorMessage: 'First attempt failed' },
    { outcome: 'error', errorMessage: 'Second attempt failed' },
    { outcome: 'success' },
  ],
});

// Custom state for getText/getAttribute
const stateElement = new MockElement('#info', {
  initialState: {
    textContent: 'Hello World',
    attributes: { 'data-id': '123', class: 'active' },
    isVisible: true,
  },
});
const text = await stateElement.getText();
expect(text.data).toBe('Hello World');
```

## Consequences

### Positive
- Clean separation of interface and implementation enables easy mocking in tests
- Comprehensive configuration options allow testing various failure scenarios
- Follows established patterns from the codebase
- Type-safe with Zod validation
- Built-in assertion helpers simplify test writing
- Invocation recording enables verification of interactions

### Negative
- Additional abstraction layer over Playwright elements
- Need to maintain both IElement and Playwright-based implementations
- Configuration complexity may have a learning curve

### Neutral
- MockElement will be used primarily in test environments
- Real browser tests will continue using BrowserSession directly

## Related ADRs
- ADR-026: Mock MCP Server Configuration Types
- ADR-072: Deterministic Error Simulation for Mock MCP Server

## Implementation Notes

1. Start with interface and type definitions in `types.ts`
2. Implement `MockElement` class with core functionality
3. Add assertion helpers for common test patterns
4. Create comprehensive test suite
5. Document usage examples in JSDoc comments
