# ADR-001: Keyboard Integration Test Infrastructure

## Status

**Accepted**

## Context

APEX CLI uses Ink (React for CLI) to build interactive terminal interfaces with keyboard-driven interactions. The application has several keyboard-sensitive features:

1. **ShortcutManager** - Handles keyboard shortcuts (Ctrl+C, Ctrl+D, Ctrl+H, etc.)
2. **Auto-execute countdown cancellation** - Any keypress cancels pending auto-execute
3. **Preview mode interactions** - Enter confirms, Escape cancels, 'e' edits
4. **Context-aware shortcuts** - Different shortcuts active in different contexts

Current tests mock Ink's `useInput` hook and simulate key events manually. This approach works but lacks:
- Consistent patterns across test files
- Reusable keyboard event simulation utilities
- Clear separation between unit and integration tests for keyboard behavior
- Comprehensive edge case coverage (modifier keys, rapid keypresses, etc.)

## Decision

We will create a dedicated **Keyboard Integration Test Infrastructure** that provides:

### 1. Directory Structure

```
tests/keyboard-integration/
  vitest.config.ts          # Keyboard-specific vitest configuration
  setup.ts                  # Global setup for keyboard tests
  utils/
    keyboard-events.ts      # Keyboard event simulation utilities
    ink-test-helpers.ts     # Ink component testing helpers
    shortcut-test-utils.ts  # ShortcutManager testing utilities
  fixtures/
    key-combinations.ts     # Standard key combination fixtures
    shortcut-scenarios.ts   # Common shortcut test scenarios
  __tests__/
    keyboard-events.test.ts # Tests for the utilities themselves
    example.integration.test.ts # Example integration test
```

### 2. Core Utilities

#### KeyboardEventSimulator

A utility class that provides:
- Type-safe keyboard event creation
- Support for all modifier keys (ctrl, alt, shift, meta)
- Special key support (Enter, Escape, Tab, Arrow keys, F-keys)
- Rapid keypress sequence simulation
- Key combination normalization

```typescript
interface KeyboardEventOptions {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

interface KeySequence {
  events: KeyboardEventOptions[];
  delay?: number; // ms between events
}
```

#### InkInputSimulator

A wrapper around `ink-testing-library` that:
- Provides consistent mocking of `useInput` hook
- Captures and replays input handlers
- Supports asynchronous key event sequences
- Integrates with Vitest's fake timers

#### ShortcutTestContext

A test context manager that:
- Manages ShortcutManager lifecycle
- Provides spy/mock injection points
- Tracks emitted events for assertions
- Supports context stack manipulation

### 3. Vitest Configuration

The keyboard integration tests will use:
- **Environment**: `jsdom` (for DOM event simulation compatibility)
- **Timeouts**: Extended (10s test, 5s hook) for async sequences
- **Setup**: Custom setup.ts for global keyboard mocks
- **Pool**: `threads` for faster execution

### 4. Test Categories

#### a) Event Simulation Tests
- Verify keyboard event utilities work correctly
- Test all key combinations
- Test modifier key handling
- Test special character handling

#### b) Shortcut Integration Tests
- Test ShortcutManager with real key events
- Test context switching
- Test shortcut conflicts/priority
- Test enabled/disabled states

#### c) Component Keyboard Tests
- Test App component key handling
- Test preview mode keyboard flow
- Test auto-execute cancellation
- Test input focus management

### 5. Key Design Principles

1. **Isolation**: Each test creates its own ShortcutManager/component instance
2. **Determinism**: Use fake timers for all timing-dependent tests
3. **Reusability**: Common patterns extracted into fixtures
4. **Type Safety**: Full TypeScript coverage for all utilities
5. **Performance**: Tests should run in parallel where possible

## Consequences

### Positive

- **Consistent Testing Patterns**: All keyboard tests follow the same structure
- **Reusable Utilities**: Shared helpers reduce code duplication
- **Comprehensive Coverage**: Structured approach ensures edge cases are covered
- **Better Debugging**: Centralized utilities make issues easier to track
- **Documentation**: ADR and fixtures serve as documentation

### Negative

- **Additional Complexity**: New test infrastructure to maintain
- **Learning Curve**: Team needs to learn new utilities
- **Potential Overhead**: Some utilities may be overkill for simple tests

### Risks

- **Ink Compatibility**: ink-testing-library may have breaking changes
- **React Version**: Need to track React 18 compatibility

## Implementation Plan

1. Create directory structure and vitest.config.ts
2. Implement KeyboardEventSimulator utility
3. Implement InkInputSimulator utility
4. Create key combination fixtures
5. Write utility tests (keyboard-events.test.ts)
6. Write example integration test
7. Verify all tests pass

## References

- [Ink Testing Library](https://github.com/vadimdemedes/ink-testing-library)
- [Vitest Configuration](https://vitest.dev/config/)
- [Existing keypress tests](../packages/cli/src/__tests__/keypress-cancellation.integration.test.ts)
- [ShortcutManager](../packages/cli/src/services/ShortcutManager.ts)
