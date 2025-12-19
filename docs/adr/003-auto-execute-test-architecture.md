# ADR-003: Auto-Execute Test Architecture

## Status
Accepted

## Date
2024-12-19

## Context

The APEX CLI features an auto-execute functionality that automatically executes high-confidence commands without requiring manual confirmation. This feature involves several interrelated components:

1. **Confidence Threshold**: The `HIGH_CONFIDENCE_THRESHOLD` constant (0.95) in `App.tsx`
2. **Auto-Execute Flag**: The `autoExecuteHighConfidence` configuration option
3. **Countdown Timer**: Visual countdown before auto-execution (100ms intervals)
4. **Keypress Cancellation**: Any keypress (except Enter/Esc/e) cancels countdown
5. **PreviewPanel**: UI component displaying countdown and action options

The task requires comprehensive test coverage for all acceptance criteria with proper isolation and integration testing strategies.

## Decision

### Test Architecture Overview

We will structure the auto-execute tests into three layers:

```
┌──────────────────────────────────────────────────────────────────┐
│                     Integration Tests                             │
│  (End-to-end flow, component rendering, real timer behavior)     │
├──────────────────────────────────────────────────────────────────┤
│                     Component Tests                               │
│  (PreviewPanel countdown display, App input handling)            │
├──────────────────────────────────────────────────────────────────┤
│                     Unit Tests                                    │
│  (Threshold logic, message formatting, state management)         │
└──────────────────────────────────────────────────────────────────┘
```

### Test File Structure

```
packages/cli/src/
├── ui/__tests__/
│   ├── App.auto-execute.test.ts             # Core auto-execute logic tests
│   ├── App.auto-execute.integration.test.ts # Component integration tests
│   ├── App.auto-execute.keypress-cancellation.test.ts # Keypress cancellation
│   ├── App.auto-execute.messages.test.ts    # System message tests
│   ├── App.auto-execute.edge-cases.test.ts  # Edge case coverage
│   ├── App.keypress-cancellation.test.ts    # Any-keypress cancellation AC
│   ├── PreviewPanel.countdown.test.ts       # NEW: Countdown display tests
│   └── test-runner.ts                       # Manual test validation
├── __tests__/
│   ├── keypress-cancellation.integration.test.ts  # Integration tests
│   ├── high-confidence-threshold.test.ts          # Threshold tests
│   └── auto-execute-e2e.test.ts                   # NEW: E2E flow test
```

### Acceptance Criteria Mapping

| Acceptance Criterion | Test File(s) | Test Type |
|---------------------|--------------|-----------|
| AC1: Auto-execute triggers at >= 0.95 confidence | `App.auto-execute.test.ts`, `high-confidence-threshold.test.ts` | Unit |
| AC2: Respects autoExecuteHighConfidence flag | `App.auto-execute.test.ts` | Unit |
| AC3: Countdown decrements correctly | `App.auto-execute.integration.test.ts`, `PreviewPanel.countdown.test.ts` | Component |
| AC4: Timeout triggers execution not cancellation | `keypress-cancellation.integration.test.ts` | Integration |
| AC5: Keypress cancels countdown | `App.auto-execute.keypress-cancellation.test.ts` | Unit |
| AC6: PreviewPanel displays countdown | `PreviewPanel.countdown.test.ts` | Component |
| AC7: End-to-end flow | `auto-execute-e2e.test.ts` | E2E |

### Key Test Interfaces

```typescript
// Test state interface (simulates App.tsx state)
interface TestAppState {
  previewMode: boolean;
  previewConfig: {
    confidenceThreshold: number;
    autoExecuteHighConfidence: boolean;
    timeoutMs: number;
  };
  pendingPreview?: {
    input: string;
    intent: {
      type: 'command' | 'task' | 'question' | 'clarification';
      confidence: number;
      command?: string;
      args?: string[];
      metadata?: Record<string, unknown>;
    };
    timestamp: Date;
  };
  remainingMs?: number;
  messages: Message[];
  isProcessing: boolean;
}

// Mock app context for integration tests
interface MockAppContext {
  state: TestAppState;
  setState: (updater: Partial<TestAppState> | ((prev: TestAppState) => TestAppState)) => void;
  addMessage: (message: { type: string; content: string }) => void;
  handleInput: (input: string) => void;
}
```

### Mocking Strategy

1. **Timer Mocking**: Use `vi.useFakeTimers()` for countdown tests
2. **Component Mocking**: Mock Ink components for isolated unit tests
3. **Intent Detection**: Mock `ConversationManager.detectIntent()` for predictable confidence values
4. **State Management**: Use React testing patterns with state simulators

### Coverage Requirements

- Unit tests: 100% coverage of decision logic paths
- Component tests: All visual states and user interactions
- Integration tests: Key user workflows
- E2E tests: Complete happy path + critical error paths

## Existing Test Coverage Analysis

The codebase already has extensive test coverage:

### Fully Covered
- Confidence threshold boundary conditions (0.94, 0.95, 0.96, etc.)
- `autoExecuteHighConfidence` flag toggle behavior
- System message formatting and content
- Edge cases (NaN, Infinity, malformed inputs)
- Keypress cancellation mechanics
- State mutation protection
- Performance benchmarks

### Gaps to Address
1. **PreviewPanel countdown display tests** - Missing visual state tests
2. **E2E integration test** - Need consolidated end-to-end flow verification
3. **Timeout triggers execution test** - Need to verify countdown reaching 0 executes (not cancels)

## Technical Design for Gap Coverage

### 1. PreviewPanel Countdown Display Tests

```typescript
// PreviewPanel.countdown.test.ts
describe('PreviewPanel Countdown Display', () => {
  describe('Visual countdown rendering', () => {
    it('should display countdown in header when remainingMs provided');
    it('should show countdown in seconds (Math.ceil)');
    it('should color-code countdown (green > 5s, yellow > 2s, red <= 2s)');
    it('should hide countdown when remainingMs is undefined');
  });

  describe('Responsive countdown display', () => {
    it('should show compact countdown in narrow mode');
    it('should show full countdown text in normal mode');
  });
});
```

### 2. E2E Integration Test

```typescript
// auto-execute-e2e.test.ts
describe('Auto-Execute End-to-End Flow', () => {
  describe('High confidence auto-execute path', () => {
    it('should auto-execute immediately for >= 0.95 confidence');
    it('should display system message before execution');
    it('should call onCommand for auto-executed commands');
    it('should call onTask for auto-executed tasks');
  });

  describe('Preview mode with countdown', () => {
    it('should show preview for < 0.95 confidence');
    it('should decrement countdown every 100ms');
    it('should execute when countdown reaches 0');
  });

  describe('Keypress cancellation flow', () => {
    it('should cancel countdown on any keypress');
    it('should keep preview visible after cancellation');
    it('should allow manual confirmation after cancellation');
  });
});
```

### 3. Timeout Execution Test

```typescript
// In keypress-cancellation.integration.test.ts
describe('Timeout triggers execution not cancellation', () => {
  it('should execute pending preview when countdown reaches 0', async () => {
    // Setup
    appContext.state.pendingPreview = { /* ... */ };
    appContext.state.remainingMs = 500; // 500ms

    // Advance time past timeout
    vi.advanceTimersByTime(600);

    // Verify execution occurred
    expect(appContext.handleInput).toHaveBeenCalled();
    expect(appContext.state.pendingPreview).toBeUndefined();
  });
});
```

## Dependencies

- `vitest`: Test runner and assertion library
- `@testing-library/react`: React component testing
- `ink-testing-library`: Ink component rendering for CLI tests
- `vi.useFakeTimers()`: Timer mocking for countdown tests

## Consequences

### Positive
- Comprehensive coverage of all acceptance criteria
- Clear test organization following testing pyramid
- Maintainable test structure with shared utilities
- Performance benchmarks prevent regression

### Negative
- Increased test maintenance burden
- Some mock complexity for Ink components
- Timer-based tests can be flaky if not properly isolated

## Implementation Notes

1. Use `beforeEach` to reset all mocks and timers
2. Use `afterEach` to cleanup intervals and restore real timers
3. Prefer `simulateUseInputHandler` for testing keyboard input
4. Use `createMockAppContext` for consistent test state setup
5. Keep performance benchmarks reasonable (< 50ms for 1000 ops)

## References

- `packages/cli/src/ui/App.tsx`: Main component with auto-execute logic
- `packages/cli/src/ui/components/PreviewPanel.tsx`: Preview panel component
- Existing test files in `packages/cli/src/ui/__tests__/`
