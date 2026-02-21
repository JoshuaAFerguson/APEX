# ADR 0001: Keyboard Shortcuts v0.3.0 Integration Tests Architecture

**Status**: Proposed
**Date**: 2024-12-17
**Author**: Architect Agent

## Context

APEX v0.3.0 introduces comprehensive keyboard shortcuts functionality through the `ShortcutManager` service. While unit tests exist for `ShortcutManager` in isolation, integration tests are needed to verify the end-to-end behavior of shortcuts across the entire CLI application stack:

- **ShortcutManager** ↔ **REPL (repl.tsx)** ↔ **App (App.tsx)** integration
- **ShortcutManager** ↔ **AdvancedInput** component integration
- Event propagation through the component hierarchy
- Context switching and proper shortcut activation

### Acceptance Criteria Requirements

Integration tests must cover:
1. ✅ ShortcutManager + REPL + App integration
2. ✅ Ctrl+C cancel (processing context)
3. ✅ Ctrl+D exit (global context)
4. ✅ Ctrl+L clear (global context)
5. ✅ Ctrl+R history search (input context)
6. ✅ Ctrl+U clear line (input context)
7. ✅ Ctrl+W delete word (input context)
8. ✅ Ctrl+A beginning of line (input context)
9. ✅ Ctrl+E end of line (input context)
10. ✅ Ctrl+P history navigation previous (input context)
11. ✅ Ctrl+N history navigation next (input context)
12. ✅ Tab completion trigger (input context)
13. ✅ Escape dismiss (global context)

## Decision

### Test Architecture

We will create a comprehensive integration test file:
- **File**: `packages/cli/src/services/__tests__/ShortcutManager.integration.test.ts`

### Design Principles

1. **Mock the Minimum, Test the Maximum**: Mock only external I/O (process.exit, stdin/stdout) while keeping real implementations of ShortcutManager, event handlers, and state management.

2. **Context-Aware Testing**: Tests must verify that shortcuts work correctly in their designated contexts (global, input, processing, etc.).

3. **Event Flow Verification**: Test the complete flow from key event → ShortcutManager → event emission → state change → UI update.

4. **Isolation Between Tests**: Each test should start with a fresh ShortcutManager instance and clean state.

### Test Categories

#### 1. Core Integration Tests
Tests verifying ShortcutManager works with App and REPL:
- ShortcutManager initialization in App
- Event handler registration
- Context synchronization with app state

#### 2. Control Key Combinations
Tests for each Ctrl+X shortcut in their correct contexts:

| Shortcut | Event | Context | Expected Behavior |
|----------|-------|---------|-------------------|
| Ctrl+C | cancel | processing | Cancels current operation |
| Ctrl+D | exit | global | Exits application |
| Ctrl+L | clear | global | Clears screen/messages |
| Ctrl+R | historySearch | input | Activates history search mode |
| Ctrl+U | clearLine | input | Clears current line |
| Ctrl+W | deleteWord | input | Deletes previous word |
| Ctrl+A | moveCursor(home) | input | Moves cursor to beginning |
| Ctrl+E | moveCursor(end) | input | Moves cursor to end |
| Ctrl+P | historyPrev | input | Previous history entry |
| Ctrl+N | historyNext | input | Next history entry |

#### 3. Special Key Combinations
Tests for non-Ctrl shortcuts:

| Shortcut | Event | Context | Expected Behavior |
|----------|-------|---------|-------------------|
| Tab | complete | input | Triggers tab completion |
| Escape | dismiss | global | Dismisses suggestions/modal |

#### 4. Integration Flow Tests
End-to-end scenarios:
- Processing state → Ctrl+C → cancel → idle state
- Input with suggestions → Tab → completion applied
- History populated → Ctrl+P → previous entry loaded
- Multiple contexts stacked → shortcuts resolve correctly

### Mock Strategy

```typescript
// Minimal mocking approach
const mockExitHandler = vi.fn();
const mockCancelHandler = vi.fn();
const mockClearHandler = vi.fn();
// ... other handlers

// Real ShortcutManager instance
const manager = new ShortcutManager();

// Wire up test handlers
manager.on('exit', mockExitHandler);
manager.on('cancel', mockCancelHandler);
// ... etc
```

### Test Structure

```typescript
describe('ShortcutManager Integration Tests', () => {
  describe('ShortcutManager + REPL + App Integration', () => {
    // Core integration tests
  });

  describe('Control Shortcuts', () => {
    describe('Ctrl+C Cancel', () => { /* ... */ });
    describe('Ctrl+D Exit', () => { /* ... */ });
    describe('Ctrl+L Clear', () => { /* ... */ });
    describe('Ctrl+R History Search', () => { /* ... */ });
    describe('Ctrl+U Clear Line', () => { /* ... */ });
    describe('Ctrl+W Delete Word', () => { /* ... */ });
    describe('Ctrl+A Beginning of Line', () => { /* ... */ });
    describe('Ctrl+E End of Line', () => { /* ... */ });
    describe('Ctrl+P Previous History', () => { /* ... */ });
    describe('Ctrl+N Next History', () => { /* ... */ });
  });

  describe('Special Key Shortcuts', () => {
    describe('Tab Completion', () => { /* ... */ });
    describe('Escape Dismiss', () => { /* ... */ });
  });

  describe('Context Integration', () => {
    // Context switching and stacking tests
  });

  describe('End-to-End Scenarios', () => {
    // Full workflow tests
  });
});
```

### Helper Utilities

```typescript
// Helper to create ShortcutEvent objects
function createKeyEvent(
  key: string,
  modifiers: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean } = {}
): ShortcutEvent {
  return {
    key,
    ctrl: modifiers.ctrl ?? false,
    alt: modifiers.alt ?? false,
    shift: modifiers.shift ?? false,
    meta: modifiers.meta ?? false,
  };
}

// Helper to simulate context state
function setupContext(manager: ShortcutManager, context: ShortcutContext) {
  manager.pushContext(context);
}
```

### Coverage Requirements

- Branch coverage: ≥70%
- Function coverage: ≥70%
- Line coverage: ≥70%
- Statement coverage: ≥70%

These align with the project's vitest configuration thresholds.

## Implementation Files

### Primary Test File
**Location**: `packages/cli/src/services/__tests__/ShortcutManager.integration.test.ts`

### Test Dependencies
- `vitest` - Test framework
- `ShortcutManager` - Service under test
- Mock handlers for event verification

### Key Integration Points

1. **App.tsx (lines 311-371)**: Where useInput handles keyboard events and delegates to ShortcutManager
2. **ShortcutManager.ts (lines 72-94)**: handleKey method that processes events
3. **AdvancedInput.tsx (lines 188-372)**: Input component handling Ctrl shortcuts directly

## Consequences

### Positive
- Comprehensive verification of keyboard shortcut functionality
- Regression protection for v0.3.0 features
- Documentation of expected behavior through tests
- Clear integration boundaries between components

### Negative
- Additional test maintenance burden
- Mock complexity for UI integration testing
- Test execution time increased

### Risks
- Ink's useInput mock behavior may differ from real keyboard input
- Context state synchronization timing issues in tests
- Event handler cleanup between tests

## Notes for Implementation Stage

1. **Priority Order**: Start with core integration tests, then control shortcuts, then edge cases
2. **Mock Ink Carefully**: Use the existing setup.ts mock but consider extending for useInput callback capture
3. **State Verification**: Always verify both handler calls AND resulting state changes
4. **Context Reset**: Ensure each test resets context stack to avoid interference
5. **Async Considerations**: Some handlers (onCommand) are async; use proper async test patterns

## Related Decisions

- Existing unit tests: `ShortcutManager.test.ts`
- Existing integration patterns: `useAgentHandoff.integration.test.ts`
- Test setup: `setup.ts`
