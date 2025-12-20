# ADR-008: Tab Completion Acceptance Tests Architecture

## Status
Proposed

## Date
2024-12-19

## Context

The task requires adding **acceptance tests** for Tab completion for commands. The acceptance criteria specify four specific scenarios that need test coverage:

1. Tab key accepts first suggestion when typing `/he` and completes to `/help`
2. Tab replaces partial input with full command
3. Tab on `/session l` completes to `/session list`
4. Tab does nothing when no suggestions available

### Current State Analysis

**Existing Test Files:**
- `command-completion.integration.test.tsx` (814 lines) - Comprehensive integration tests
- `command-completion-simple.test.ts` (108 lines) - Basic unit tests
- `session-subcommand-completion.test.ts` (441 lines) - Session-specific tests
- `completion.integration.test.tsx` - Broader integration tests

**Existing Tab Completion Tests (from `command-completion.integration.test.tsx`):**
- Line 482-524: "supports tab completion for first suggestion" - Tests tab with mocked completions, verifies `onSubmit` called
- Line 526-566: "handles empty suggestions gracefully on tab" - Tests no crash on tab with empty suggestions

**Gap Analysis:**
The current tests partially cover acceptance criteria but have gaps:

| Acceptance Criteria | Current Coverage | Gap |
|---------------------|------------------|-----|
| Tab on `/he` → `/help` | ✅ Partial (mocked, doesn't use real engine filtering) | Need test with real CompletionEngine filtering |
| Tab replaces partial input | ❌ Not directly tested | Need explicit input replacement verification |
| Tab on `/session l` → `/session list` | ❌ Missing | Need session subcommand tab completion test |
| Tab does nothing with no suggestions | ✅ Covered (line 526-566) | Adequate coverage |

### Key Components

**AdvancedInput Tab Handler (lines 247-285):**
```typescript
// Handle Tab (autocomplete)
if (key.tab && autoComplete) {
  if (showingSuggestions && filteredSuggestions.length > 0) {
    const suggestion = filteredSuggestions[selectedSuggestionIndex >= 0 ? selectedSuggestionIndex : 0];
    // Smart completion: replace the word being completed
    let newInput = suggestion.value;
    // ... replacement logic for commands vs regular words
    setInput(newInput);
    setCursorPosition(newCursorPos);
    setShowingSuggestions(false);
  }
  return;
}
```

**CompletionEngine Command Provider:**
- Trigger: `/^\/` (slash prefix)
- Filters commands with `.filter(c => c.name.toLowerCase().startsWith(query))`
- Returns `/help` as first match when query is `/he`

**CompletionEngine Session Subcommand Provider:**
- Trigger: `/^\/session\s+\w*/`
- Filters subcommands with `.filter(c => c.name.toLowerCase().startsWith(prefix))`
- Returns `/session list` when prefix is `l`

## Decision

### Test File Location
Create a new dedicated test file: `packages/cli/src/__tests__/tab-completion-acceptance.test.tsx`

**Rationale:**
1. Acceptance tests should be clearly identifiable and separate from integration/unit tests
2. Naming convention `*-acceptance.test.tsx` makes test purpose explicit
3. Easier to run acceptance tests in isolation during CI/CD

### Test Architecture

```typescript
describe('Tab Completion Acceptance Tests', () => {
  describe('AC1: Tab accepts first suggestion on /he → /help', () => {
    // Tests with real CompletionEngine (not mocked)
    // Verify actual filtering behavior
  })

  describe('AC2: Tab replaces partial input with full command', () => {
    // Tests verify input state before/after Tab press
    // Verify cursor position updates correctly
  })

  describe('AC3: Tab on /session l → /session list', () => {
    // Tests session subcommand completion via Tab
    // Verify session provider integration
  })

  describe('AC4: Tab does nothing when no suggestions available', () => {
    // Tests Tab key handling with empty suggestion list
    // Verify no state changes occur
  })
})
```

### Test Implementation Strategy

#### Pattern 1: Real CompletionEngine with Controlled Context

```typescript
const createAcceptanceTestContext = (): CompletionContext => ({
  projectPath: '/test/project',
  agents: ['planner', 'architect', 'developer', 'reviewer', 'tester', 'devops'],
  workflows: ['feature', 'bugfix', 'refactor'],
  recentTasks: [],
  inputHistory: [],
});
```

#### Pattern 2: Input Simulation Sequence

For simulating user typing `/he` then pressing Tab:

```typescript
const simulateTyping = (handler: InputHandler, text: string) => {
  for (const char of text) {
    act(() => {
      handler(char, { ctrl: false, meta: false });
    });
  }
};

const simulateTab = (handler: InputHandler) => {
  act(() => {
    handler('', { tab: true });
  });
};
```

#### Pattern 3: Input Value Verification

Unlike existing tests that only check `onSubmit`, acceptance tests need to verify the actual input value change:

```typescript
// Existing pattern (insufficient for AC2):
expect(onSubmit).toHaveBeenCalledWith('/help');

// New pattern for input replacement verification:
// Option A: Check onChange callback
expect(onChange).toHaveBeenLastCalledWith('/help');

// Option B: Access internal state via test props
// Render with controlled value prop, verify onInputChange
```

### Detailed Test Cases

#### AC1: Tab accepts first suggestion on /he → /help

```typescript
describe('AC1: Tab accepts first suggestion on /he → /help', () => {
  it('completes /he to /help when Tab is pressed', async () => {
    const completionEngine = new CompletionEngine();
    const context = createAcceptanceTestContext();
    const onChange = vi.fn();

    render(
      <AdvancedInput
        completionEngine={completionEngine}
        completionContext={context}
        onChange={onChange}
      />
    );

    // Type "/he"
    simulateTyping(mockUseInput.inputHandler, '/he');

    // Wait for debounce and completions
    act(() => vi.advanceTimersByTime(200));

    // Verify /help is shown as suggestion
    await waitFor(() => {
      expect(screen.queryByText(/\/help/)).toBeInTheDocument();
    });

    // Press Tab
    simulateTab(mockUseInput.inputHandler);

    // Verify input changed to /help
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith('/help');
    });
  });

  it('selects /help as first suggestion when multiple h-commands exist', async () => {
    // Ensure /help comes before /history if both existed
    // (Note: current engine only has /help starting with /he)
  });
});
```

#### AC2: Tab replaces partial input with full command

```typescript
describe('AC2: Tab replaces partial input with full command', () => {
  it('replaces /stat with /status', async () => {
    const completionEngine = new CompletionEngine();
    const context = createAcceptanceTestContext();
    const onChange = vi.fn();

    render(
      <AdvancedInput
        completionEngine={completionEngine}
        completionContext={context}
        onChange={onChange}
      />
    );

    // Type partial command
    simulateTyping(mockUseInput.inputHandler, '/stat');
    act(() => vi.advanceTimersByTime(200));

    // Press Tab
    simulateTab(mockUseInput.inputHandler);

    // Verify full command replaced partial
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith('/status');
    });
  });

  it('preserves text after completed command', async () => {
    // Test: "run /sta some text" → Tab → "run /status some text"
    // This tests the smart replacement logic
  });

  it('updates cursor position to end of completed command', async () => {
    // Verify cursor position after Tab completion
    // May need to verify via display string with cursor indicator
  });
});
```

#### AC3: Tab on /session l → /session list

```typescript
describe('AC3: Tab on /session l → /session list', () => {
  it('completes /session l to /session list', async () => {
    const completionEngine = new CompletionEngine();
    const context = createAcceptanceTestContext();
    const onChange = vi.fn();

    render(
      <AdvancedInput
        completionEngine={completionEngine}
        completionContext={context}
        onChange={onChange}
      />
    );

    // Type "/session l"
    simulateTyping(mockUseInput.inputHandler, '/session l');
    act(() => vi.advanceTimersByTime(200));

    // Verify suggestions shown
    await waitFor(() => {
      expect(screen.queryByText(/list/)).toBeInTheDocument();
    });

    // Press Tab
    simulateTab(mockUseInput.inputHandler);

    // Verify completed to /session list
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith('/session list');
    });
  });

  it('shows list as first option when typing /session l', async () => {
    // Verify list appears before load (alphabetically list < load)
    // Both start with 'l', but list should be first
  });

  it('completes /session lo to /session load', async () => {
    // Verify 'lo' prefix correctly completes to 'load' not 'list'
  });
});
```

#### AC4: Tab does nothing when no suggestions available

```typescript
describe('AC4: Tab does nothing when no suggestions available', () => {
  it('does not modify input when pressing Tab with no suggestions', async () => {
    const completionEngine = new CompletionEngine();
    const context = createAcceptanceTestContext();
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <AdvancedInput
        completionEngine={completionEngine}
        completionContext={context}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    // Type invalid command prefix
    simulateTyping(mockUseInput.inputHandler, '/xyz');
    act(() => vi.advanceTimersByTime(200));

    // Clear onChange call history from typing
    onChange.mockClear();

    // Press Tab
    simulateTab(mockUseInput.inputHandler);

    // Verify nothing changed
    expect(onChange).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not crash when Tab pressed on empty input', async () => {
    // Edge case: Tab with no input
  });

  it('preserves current input when no completion matches', async () => {
    // Type "/zzz", press Tab, verify "/zzz" remains
  });
});
```

### Test Infrastructure Requirements

#### Mock Configuration

```typescript
// Required mocks (same pattern as existing tests)
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: mockUseInput,
    useStdout: mockUseStdout,
  };
});

vi.mock('fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue([]),
}));

vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/user'),
}));

vi.mock('fuse.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    search: vi.fn().mockReturnValue([]),
  })),
}));
```

#### Helper Functions

```typescript
// Input simulation helpers
const createInputHandler = () => {
  let handler: InputHandler;
  mockUseInput.mockImplementation((h) => {
    handler = h;
    mockUseInput.inputHandler = h;
  });
  return () => mockUseInput.inputHandler;
};

const simulateTyping = (handler: InputHandler, text: string) => {
  for (const char of text) {
    act(() => handler(char, { ctrl: false, meta: false }));
  }
};

const simulateTab = (handler: InputHandler) => {
  act(() => handler('', { tab: true }));
};

const waitForCompletions = async (debounceMs: number = 200) => {
  act(() => vi.advanceTimersByTime(debounceMs));
  await vi.runAllTimersAsync();
};
```

### Verification Approach

The key insight from analyzing the codebase is that `AdvancedInput` has two behaviors on Tab:
1. **With suggestions showing:** Accepts first/selected suggestion, updates input via `setInput(newInput)`
2. **Without suggestions:** Does nothing (returns early)

Since we need to verify input changes (not just onSubmit), we should:
1. Use `onChange` prop callback to capture input value changes
2. Verify the onChange call sequence reflects expected completion

Note: The current implementation calls `onSubmit` on Tab only in the old pattern. Looking at line 279-282:
```typescript
setInput(newInput);
setCursorPosition(newCursorPos);
setShowingSuggestions(false);
setSelectedSuggestionIndex(-1);
```

Tab completion does NOT call `onSubmit` - it just updates the input. So tests must verify via `onChange`.

### Test Count Summary

| Acceptance Criteria | Test Count |
|---------------------|------------|
| AC1: /he → /help | 2 tests |
| AC2: Tab replaces partial input | 3 tests |
| AC3: /session l → /session list | 3 tests |
| AC4: Tab does nothing | 3 tests |
| **Total** | **11 tests** |

## Consequences

### Positive
- Clear acceptance criteria coverage with dedicated test file
- Tests use real CompletionEngine (not mocked), ensuring actual filtering behavior is tested
- Follows existing test patterns for consistency
- Isolated test file allows easy identification of acceptance test failures

### Negative
- Some duplication with existing integration tests (AC4 is similar to existing test)
- Additional test file to maintain

### Risks
- Timer-based testing (debounce) can be flaky if not handled correctly
- Need to ensure `onChange` is always called when input changes (verify component implementation)

## Implementation Notes

### File to Create
`packages/cli/src/__tests__/tab-completion-acceptance.test.tsx`

### Dependencies
- Same mocking infrastructure as `command-completion.integration.test.tsx`
- No new dependencies required

### Test Execution
```bash
npm test --workspace=@apex/core -- --grep "Tab Completion Acceptance"
```

### Estimated Implementation Time
- Test file creation and setup: 30 minutes
- AC1 tests: 20 minutes
- AC2 tests: 30 minutes
- AC3 tests: 20 minutes
- AC4 tests: 15 minutes
- Verification and debugging: 30 minutes
- **Total: ~2.5 hours**
