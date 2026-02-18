# ADR-002: Loading State Fixture for Async Operation Testing

## Status
Proposed

## Date
2025-02-13

## Context

The APEX test fixtures infrastructure needs a comprehensive loading state fixture to support testing of async operations, pending states, and loading indicators. The existing `browserFixtures.loadingPage()` function provides basic loading state simulation but lacks:

1. **Lifecycle management** - No setup/teardown pattern for managing loading state transitions
2. **Async operation simulation** - No way to simulate pending API calls, delayed responses, or loading timeouts
3. **Integration helpers** - No hooks or wrapper functions for easy test integration
4. **State transitions** - No support for simulating state changes (loading → completed/error)
5. **Timer management** - No fake timer integration for testing time-sensitive loading behavior

## Decision

We will implement a **class-based `LoadingStateFixture`** that follows the established patterns from `ErrorPageFixture` and `LoggedInPageFixture`. The fixture will provide:

### 1. Core Architecture

```typescript
// File: packages/core/src/test-fixtures/loading-state-fixture.ts

export interface LoadingStateFixture extends SetupTeardownHooks {
  // Lifecycle
  setup(config: LoadingFixtureConfig): Promise<void>;
  teardown(): Promise<void>;

  // State management
  getBrowserState(): BrowserState;
  updateBrowserState(updates: Partial<BrowserState>): void;

  // Loading operations
  startLoading(options?: LoadingOptions): BrowserState;
  finishLoading(result?: LoadingResult): BrowserState;
  simulateLoadingTimeout(): Promise<BrowserState>;
  simulateLoadingError(error: string): BrowserState;

  // Async simulation
  simulatePendingRequest(request: PendingRequest): () => void;
  simulateDelayedResponse(delay: number, response: any): Promise<any>;
  simulateProgressiveLoading(steps: LoadingStep[]): Promise<void>;

  // State queries
  isLoading(): boolean;
  getPendingRequests(): PendingRequest[];
  getLoadingProgress(): LoadingProgress;

  // Validation
  validate(): Promise<{ valid: boolean; errors: string[] }>;
}
```

### 2. Configuration Interface

```typescript
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
}
```

### 3. Loading Scenario Types

```typescript
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
```

### 4. Pending Request Simulation

```typescript
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
}
```

### 5. Loading Progress Tracking

```typescript
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
```

### 6. Integration Helpers

Following the established patterns, we will provide three integration styles:

```typescript
// Hook-based integration
export function createLoadingFixtureHooks(
  scenario: LoadingScenario,
  options?: Partial<LoadingFixtureConfig>
): {
  setup: () => Promise<LoadingStateFixtureInstance>;
  teardown: () => Promise<void>;
  fixture: LoadingStateFixtureInstance | null;
};

// Higher-order function wrapper
export function withLoadingFixture<T = void>(
  scenario: LoadingScenario,
  testFn: (fixture: LoadingStateFixtureInstance) => Promise<T> | T,
  options?: Partial<LoadingFixtureConfig>
): () => Promise<T>;

// Multi-scenario factory
export function createMultiLoadingFixture(
  scenarios: LoadingScenario[]
): (scenario: LoadingScenario, options?: Partial<LoadingFixtureConfig>) => Promise<LoadingStateFixtureInstance>;
```

### 7. Predefined Loading Scenarios

```typescript
export const LOADING_SCENARIOS: Record<LoadingScenario, Omit<LoadingFixtureConfig, 'name' | 'description'>> = {
  'page-load': {
    scenario: 'page-load',
    expectedDuration: 2000,
    timeout: 30000,
    indicatorType: 'spinner',
    initialProgress: 0,
    expectedOutcome: 'success',
  },
  'api-request': {
    scenario: 'api-request',
    expectedDuration: 500,
    timeout: 10000,
    indicatorType: 'spinner',
    initialProgress: 0,
    expectedOutcome: 'success',
  },
  // ... other scenarios
};
```

### 8. Timer Integration

The fixture will integrate with Vitest's fake timers for deterministic testing:

```typescript
export class LoadingStateFixtureImpl implements LoadingStateFixture {
  private timerIds: Set<NodeJS.Timeout> = new Set();

  async setup(config: LoadingFixtureConfig): Promise<void> {
    if (config.useFakeTimers) {
      vi.useFakeTimers();
      this.addCleanupTask(() => vi.useRealTimers());
    }
    // ... setup logic
  }

  async simulateLoadingTimeout(): Promise<BrowserState> {
    const timeout = this._state.config.timeout || 30000;

    if (this._state.config.useFakeTimers) {
      await vi.advanceTimersByTimeAsync(timeout);
    } else {
      await new Promise(resolve => setTimeout(resolve, timeout));
    }

    return this.simulateLoadingError('Loading timeout exceeded');
  }
}
```

## File Structure

```
packages/core/src/test-fixtures/
├── loading-state-fixture.ts          # Main implementation
├── __tests__/
│   ├── loading-state-fixture.test.ts           # Unit tests
│   └── loading-state-fixture.integration.test.ts # Integration tests
├── docs/
│   └── ADR-002-loading-state-fixture.md        # This ADR
└── index.ts                          # Updated exports
```

## Implementation Notes

### Integration with Existing Patterns

1. **BrowserState Integration**: The fixture will use and extend `browserFixtures.loadingPage()` as the base state, adding pending request tracking and progress information.

2. **Setup/Teardown Pattern**: Following `createTestSuite()` pattern from `setup-teardown.ts`, ensuring proper mock cleanup and state restoration.

3. **Immutable State**: All state modifications will create new state objects, following the `browserHelpers` pattern.

4. **Validation**: Implement validation similar to `ErrorPageFixture.validate()` to ensure loading state consistency.

### Key Design Decisions

1. **Class-based over Function-based**: While simple loading states can use `browserFixtures.loadingPage()`, the class-based approach provides lifecycle management essential for async testing.

2. **Fake Timer Integration**: Native support for `vi.useFakeTimers()` enables deterministic testing of time-dependent loading behavior.

3. **AbortController Support**: Pending requests include AbortController for testing cancellation scenarios.

4. **Progressive Loading**: Support for multi-step loading processes (streaming, chunked responses).

## Consequences

### Positive

1. **Comprehensive Testing**: Enables thorough testing of all async loading patterns
2. **Deterministic Tests**: Fake timer support allows deterministic testing of timeouts
3. **Pattern Consistency**: Follows established fixture patterns for familiarity
4. **State Transitions**: Supports testing of loading → success/error transitions
5. **Integration Ready**: Hook-based and HOF patterns for easy test integration

### Negative

1. **Additional Complexity**: Adds another fixture class to maintain
2. **Learning Curve**: Developers need to understand the fixture API
3. **Timer Coupling**: Fake timer usage requires careful cleanup

### Risks

1. **Timer Leaks**: Improper cleanup of timers could affect other tests
   - Mitigation: Automatic cleanup in teardown()
2. **State Inconsistency**: Complex state transitions could lead to invalid states
   - Mitigation: Validation method and state machine guards

## Related

- [browser-fixtures.ts](../browser-fixtures.ts) - Base browser state fixtures
- [error-page-fixture.ts](../error-page-fixture.ts) - Error fixture pattern reference
- [logged-in-page-fixture.ts](../logged-in-page-fixture.ts) - Auth fixture pattern reference
- [setup-teardown.ts](../setup-teardown.ts) - Test suite utilities
