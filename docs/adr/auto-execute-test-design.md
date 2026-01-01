# Auto-Execute Test Architecture - Technical Design

## Overview

This document provides the technical design for comprehensive auto-execute functionality testing in the APEX CLI. The design ensures full coverage of the six acceptance criteria while maintaining test isolation, performance, and maintainability.

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              App.tsx                                         │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │  HIGH_CONFIDENCE_   │  │  handleInput()      │  │  useInput()         │ │
│  │  THRESHOLD = 0.95   │  │  - Intent detection │  │  - Keypress handler │ │
│  │                     │  │  - Auto-execute     │  │  - Cancel countdown │ │
│  │                     │  │    decision logic   │  │  - Confirm/Cancel   │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘ │
│                                      │                         │             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         AppState                                     │   │
│  │  - previewMode: boolean                                             │   │
│  │  - previewConfig: { confidenceThreshold, autoExecuteHighConfidence, │   │
│  │                     timeoutMs }                                     │   │
│  │  - pendingPreview: { input, intent, timestamp }                     │   │
│  │  - remainingMs: number | undefined                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Countdown Effect                                  │   │
│  │  useEffect(() => {                                                  │   │
│  │    // 100ms interval countdown                                      │   │
│  │    // Execute when remainingMs <= 0                                 │   │
│  │  }, [pendingPreview, timeoutMs])                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PreviewPanel.tsx                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │  Countdown Display  │  │  Intent Display     │  │  Action Buttons     │ │
│  │  - remainingMs prop │  │  - Type icon        │  │  [Enter] Confirm    │ │
│  │  - Color-coded      │  │  - Confidence %     │  │  [Esc] Cancel       │ │
│  │  - formatCountdown  │  │  - Action desc      │  │  [e] Edit           │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Acceptance Criteria Test Matrix

| # | Acceptance Criterion | Test Strategy | Key Assertions |
|---|---------------------|---------------|----------------|
| 1 | Auto-execute triggers at >= 0.95 confidence | Unit test with boundary values (0.94, 0.95, 0.96) | `shouldAutoExecute === true` when `confidence >= 0.95 && autoExecuteHighConfidence` |
| 2 | Auto-execute respects autoExecuteHighConfidence flag | Unit test toggle behavior | When `false`, never auto-execute regardless of confidence |
| 3 | Countdown decrements correctly | Integration test with fake timers | `remainingMs` decreases by 100 every 100ms |
| 4 | Timeout triggers execution not cancellation | Integration test with timer advancement | `handleInput` called when `remainingMs <= 0` |
| 5 | Keypress cancels countdown | Unit test keyboard handler | `remainingMs = undefined`, `pendingPreview` preserved |
| 6 | PreviewPanel displays countdown | Component test | Countdown visible when `remainingMs` provided |

## Test Implementation Details

### AC1: Confidence Threshold (>= 0.95)

**Location**: `App.auto-execute.test.ts`, `high-confidence-threshold.test.ts`

```typescript
// Core decision logic (from App.tsx)
const shouldAutoExecute =
  state.previewConfig.autoExecuteHighConfidence &&
  intent.confidence >= HIGH_CONFIDENCE_THRESHOLD;

// Test cases
const boundaryTests = [
  { confidence: 0.94, expected: false },  // Below threshold
  { confidence: 0.949999, expected: false },  // Just below
  { confidence: 0.95, expected: true },   // Exactly at threshold
  { confidence: 0.950001, expected: true },  // Just above
  { confidence: 0.96, expected: true },   // Above threshold
  { confidence: 1.0, expected: true },    // Maximum
];
```

### AC2: autoExecuteHighConfidence Flag

**Location**: `App.auto-execute.test.ts`

```typescript
describe('Auto-execute feature flag behavior', () => {
  it('should NOT auto-execute when autoExecuteHighConfidence is disabled', () => {
    const state = {
      previewConfig: {
        autoExecuteHighConfidence: false,  // Disabled
        confidenceThreshold: 0.7,
        timeoutMs: 5000,
      },
    };

    const intent = { type: 'command', confidence: 0.98 };  // High confidence
    const result = shouldAutoExecute(intent, state);

    expect(result).toBe(false);  // Should NOT auto-execute
  });
});
```

### AC3: Countdown Decrement

**Location**: `App.auto-execute.integration.test.ts`, `keypress-cancellation.integration.test.ts`

```typescript
describe('Countdown decrement', () => {
  it('should decrement remainingMs every 100ms', async () => {
    vi.useFakeTimers();

    // Initialize with 5000ms timeout
    appState.remainingMs = 5000;
    appState.pendingPreview = { /* ... */ };

    // Start countdown effect
    // (simulated via interval)

    vi.advanceTimersByTime(100);
    expect(appState.remainingMs).toBe(4900);

    vi.advanceTimersByTime(100);
    expect(appState.remainingMs).toBe(4800);

    vi.advanceTimersByTime(1000);
    expect(appState.remainingMs).toBe(3800);
  });
});
```

### AC4: Timeout Triggers Execution

**Location**: `keypress-cancellation.integration.test.ts`

```typescript
describe('Timeout triggers execution not cancellation', () => {
  it('should execute when countdown reaches 0', async () => {
    vi.useFakeTimers();

    appState.pendingPreview = {
      input: '/status',
      intent: { type: 'command', confidence: 0.85 },
      timestamp: new Date(),
    };
    appState.remainingMs = 500;

    // Advance past timeout
    vi.advanceTimersByTime(600);

    // Verify execution
    expect(handleInput).toHaveBeenCalledWith('/status');
    expect(addMessage).toHaveBeenCalledWith({
      type: 'system',
      content: expect.stringContaining('Auto-executing after'),
    });
    expect(appState.pendingPreview).toBeUndefined();
    expect(appState.remainingMs).toBeUndefined();
  });
});
```

### AC5: Keypress Cancels Countdown

**Location**: `App.auto-execute.keypress-cancellation.test.ts`, `App.keypress-cancellation.test.ts`

```typescript
describe('Keypress cancellation', () => {
  it('should cancel countdown on any keypress (except Enter/Esc/e)', () => {
    const testKeypresses = ['a', 'z', '1', '9', ' ', '!', '.'];

    testKeypresses.forEach((key) => {
      // Reset state
      testState.remainingMs = 3000;
      testState.pendingPreview = { /* ... */ };

      // Simulate keypress
      simulateKeypress(key, {});

      // Verify cancellation
      expect(testState.remainingMs).toBeUndefined();
      expect(addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Auto-execute cancelled.',
      });

      // Verify preview preserved
      expect(testState.pendingPreview).toBeDefined();
    });
  });

  it('should NOT cancel when pressing Enter (confirms instead)', () => {
    simulateKeypress('', { return: true });

    expect(handleInput).toHaveBeenCalled();
    expect(addMessage).not.toHaveBeenCalledWith({
      type: 'system',
      content: 'Auto-execute cancelled.',
    });
  });
});
```

### AC6: PreviewPanel Displays Countdown

**Location**: `PreviewPanel.countdown.test.ts` (NEW)

```typescript
describe('PreviewPanel countdown display', () => {
  it('should display countdown when remainingMs is provided', () => {
    const { lastFrame } = render(
      <PreviewPanel
        input="test command"
        intent={{ type: 'command', confidence: 0.8 }}
        remainingMs={3000}
        onConfirm={() => {}}
        onCancel={() => {}}
        onEdit={() => {}}
      />
    );

    expect(lastFrame()).toContain('Auto-execute in');
    expect(lastFrame()).toContain('3s');
  });

  it('should color-code countdown based on remaining time', () => {
    // Test getCountdownColor logic
    expect(getCountdownColor(6)).toBe('green');   // > 5s
    expect(getCountdownColor(4)).toBe('yellow');  // > 2s
    expect(getCountdownColor(2)).toBe('red');     // <= 2s
  });

  it('should not display countdown when remainingMs is undefined', () => {
    const { lastFrame } = render(
      <PreviewPanel
        input="test command"
        intent={{ type: 'command', confidence: 0.8 }}
        remainingMs={undefined}
        onConfirm={() => {}}
        onCancel={() => {}}
        onEdit={() => {}}
      />
    );

    expect(lastFrame()).not.toContain('Auto-execute in');
  });
});
```

## E2E Integration Test

**Location**: `auto-execute-e2e.test.ts` (NEW)

```typescript
describe('Auto-Execute End-to-End Flow', () => {
  describe('Complete high-confidence flow', () => {
    it('should bypass preview and execute immediately', async () => {
      // Setup
      const mockOnCommand = vi.fn();
      const initialState = createInitialState({
        previewMode: true,
        previewConfig: {
          confidenceThreshold: 0.7,
          autoExecuteHighConfidence: true,
          timeoutMs: 5000,
        },
      });

      // Mock high-confidence intent detection
      mockConversationManager.detectIntent.mockReturnValue({
        type: 'command',
        confidence: 0.98,
      });

      // Simulate user input
      await handleInput('/status');

      // Verify immediate execution
      expect(mockOnCommand).toHaveBeenCalledWith('status', []);
      expect(state.pendingPreview).toBeUndefined();

      // Verify system message
      expect(state.messages).toContainEqual(
        expect.objectContaining({
          type: 'system',
          content: 'Auto-executing (confidence: 98% >= 95%)',
        })
      );
    });
  });

  describe('Complete preview-with-countdown flow', () => {
    it('should show preview, countdown, and execute on timeout', async () => {
      vi.useFakeTimers();

      // Setup with lower confidence
      mockConversationManager.detectIntent.mockReturnValue({
        type: 'task',
        confidence: 0.85,
      });

      // Simulate user input
      await handleInput('implement feature');

      // Verify preview shown
      expect(state.pendingPreview).toBeDefined();
      expect(state.remainingMs).toBe(5000);

      // Advance time
      vi.advanceTimersByTime(5100);

      // Verify execution
      expect(mockOnTask).toHaveBeenCalledWith('implement feature');
      expect(state.pendingPreview).toBeUndefined();
    });
  });

  describe('Complete keypress-cancel flow', () => {
    it('should cancel countdown, allow review, then manual confirm', async () => {
      vi.useFakeTimers();

      // Setup preview
      state.pendingPreview = {
        input: 'test command',
        intent: { type: 'command', confidence: 0.85 },
        timestamp: new Date(),
      };
      state.remainingMs = 5000;

      // Advance partway
      vi.advanceTimersByTime(2000);
      expect(state.remainingMs).toBe(3000);

      // Cancel with keypress
      simulateKeypress('q', {});
      expect(state.remainingMs).toBeUndefined();
      expect(state.pendingPreview).toBeDefined();

      // Manual confirm
      simulateKeypress('', { return: true });
      expect(handleInput).toHaveBeenCalledWith('test command');
      expect(state.pendingPreview).toBeUndefined();
    });
  });
});
```

## Mock Utilities

### createMockAppContext

```typescript
function createMockAppContext(): MockAppContext {
  let state: TestAppState = {
    previewMode: true,
    previewConfig: {
      confidenceThreshold: 0.7,
      autoExecuteHighConfidence: true,
      timeoutMs: 5000,
    },
    pendingPreview: undefined,
    remainingMs: undefined,
    messages: [],
    isProcessing: false,
  };

  const setState = vi.fn((updater) => {
    if (typeof updater === 'function') {
      state = { ...state, ...updater(state) };
    } else {
      state = { ...state, ...updater };
    }
  });

  const addMessage = vi.fn((message) => {
    state.messages.push({
      id: `msg_${Date.now()}`,
      ...message,
      timestamp: new Date(),
    });
  });

  const handleInput = vi.fn();

  return { state, setState, addMessage, handleInput };
}
```

### simulateKeypress

```typescript
function simulateKeypress(
  input: string | undefined,
  key: { return?: boolean; escape?: boolean }
) {
  if (state.pendingPreview) {
    if (key.return) {
      const pendingPreview = state.pendingPreview;
      setState({ pendingPreview: undefined });
      handleInput(pendingPreview.input);
    } else if (key.escape) {
      setState({ pendingPreview: undefined });
      addMessage({ type: 'system', content: 'Preview cancelled.' });
    } else if (input?.toLowerCase() === 'e') {
      setState({ pendingPreview: undefined, editModeInput: state.pendingPreview.input });
      addMessage({ type: 'system', content: 'Returning to edit mode...' });
    } else {
      setState({ remainingMs: undefined });
      addMessage({ type: 'system', content: 'Auto-execute cancelled.' });
    }
  }
}
```

## Files to Create/Modify

### New Files
1. `packages/cli/src/ui/__tests__/PreviewPanel.countdown.test.ts` - PreviewPanel countdown display tests
2. `packages/cli/src/__tests__/auto-execute-e2e.test.ts` - End-to-end integration test

### Existing Files (Verify Coverage)
1. `App.auto-execute.test.ts` - AC1, AC2 (covered)
2. `App.auto-execute.integration.test.ts` - AC3, AC4 (partially covered)
3. `App.auto-execute.keypress-cancellation.test.ts` - AC5 (covered)
4. `keypress-cancellation.integration.test.ts` - AC4, AC5 (covered)

## Test Execution

```bash
# Run all auto-execute tests
npm test -- --grep "auto-execute"

# Run specific acceptance criteria tests
npm test -- --grep "confidence threshold"    # AC1
npm test -- --grep "autoExecuteHighConfidence" # AC2
npm test -- --grep "countdown decrement"     # AC3
npm test -- --grep "timeout triggers"        # AC4
npm test -- --grep "keypress cancel"         # AC5
npm test -- --grep "PreviewPanel countdown"  # AC6
npm test -- --grep "end-to-end"              # E2E

# Run with coverage
npm test -- --coverage --grep "auto-execute"
```

## Summary

The existing test suite provides comprehensive coverage for most acceptance criteria. The gaps identified are:

1. **PreviewPanel countdown display tests** - Create `PreviewPanel.countdown.test.ts`
2. **E2E integration test** - Create `auto-execute-e2e.test.ts`
3. **Timeout execution verification** - Add explicit test in integration suite

All other acceptance criteria are thoroughly tested in the existing files.
