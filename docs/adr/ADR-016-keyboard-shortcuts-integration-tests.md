# ADR-016: Keyboard Shortcuts Integration Tests Architecture

## Status
Proposed

## Context

The `v030-features.integration.test.tsx` file contains a `Keyboard Shortcuts Integration` describe block (lines 454-574), but these tests use a **mock API pattern** that doesn't match the actual `ShortcutManager` implementation:

### Current Tests Use (Incorrect API):
```typescript
shortcutManager.register('ctrl+s', callback);           // String-based
shortcutManager.setContext('modal');                     // Direct context set
document.dispatchEvent(new KeyboardEvent(...));          // DOM events
```

### Actual ShortcutManager API:
```typescript
shortcutManager.register(KeyboardShortcut);              // Object-based
shortcutManager.pushContext('modal');                    // Stack-based context
shortcutManager.handleKey(ShortcutEvent);                // Direct method call
```

These tests need to be **replaced** with tests that:
1. Use the actual `ShortcutManager` API from `../services/ShortcutManager.ts`
2. Test integration with other v0.3.0 services
3. Cover all default shortcuts as specified in ADR-004

While the unit tests in `ShortcutManager.test.ts` provide comprehensive coverage of individual features, the integration tests must validate:

1. ShortcutManager registration behavior in the context of the application lifecycle
2. Context-aware activation across multiple components
3. Event emission and handling between ShortcutManager and other services
4. All default shortcuts work correctly (as specified in ADR-004)

### Existing Test Coverage Analysis

**Unit Tests (`ShortcutManager.test.ts`) Cover:**
- Basic initialization and default shortcuts
- Shortcut registration/unregistration
- Context management (push/pop)
- Key matching (simple, complex, case-insensitive)
- Context filtering
- Enabled state
- Action execution (function, command, emit)
- Event handling (on/off)
- Utility methods
- Default shortcuts integration (Ctrl+C, Ctrl+D, Ctrl+H, Ctrl+Shift combinations)
- Edge cases

**Gap - Integration Tests Should Cover:**
- ShortcutManager working with other v0.3.0 services (SessionStore, CompletionEngine, ConversationManager)
- Context transitions during conversation flow
- Event propagation through the application
- Multi-service coordination
- Error recovery scenarios

## Decision

### 1. Integration Test Structure

Add a new `describe` block to `v030-features.integration.test.tsx` with the following test categories:

```typescript
describe('ShortcutManager Integration', () => {
  // Test Categories:
  // 1. Service Integration Tests
  // 2. Context-Aware Activation Tests
  // 3. Event Emission Tests
  // 4. Default Shortcuts Verification
});
```

### 2. Test Categories and Specifications

#### 2.1 Service Integration Tests

Tests validating ShortcutManager coordination with other services:

| Test Case | Description | Services Involved |
|-----------|-------------|-------------------|
| `should integrate with session management for quick save` | Verifies Ctrl+S triggers session save | SessionStore, ConversationManager |
| `should clear completion suggestions on Escape` | Verifies Escape dismisses CompletionEngine suggestions | CompletionEngine |
| `should navigate conversation history with Ctrl+P/N` | Verifies history shortcuts work with ConversationManager | ConversationManager |

#### 2.2 Context-Aware Activation Tests

Tests verifying shortcuts work only in appropriate contexts:

| Test Case | Context Tested | Expected Behavior |
|-----------|----------------|-------------------|
| `should only trigger cancel in processing context` | `processing` | Ctrl+C emits cancel only when processing |
| `should activate input shortcuts when input focused` | `input` | Ctrl+U/W/A/E only work in input context |
| `should handle context transitions during conversation` | `global` -> `input` -> `processing` | Shortcuts activate correctly as context changes |
| `should support context stacking` | multiple contexts | Shortcuts resolve based on context stack |

#### 2.3 Event Emission Tests

Tests validating event propagation:

| Test Case | Event | Payload |
|-----------|-------|---------|
| `should emit cancel event on Ctrl+C` | `cancel` | none |
| `should emit exit event on Ctrl+D` | `exit` | none |
| `should emit clear event on Ctrl+L` | `clear` | none |
| `should emit clearLine event on Ctrl+U` | `clearLine` | none |
| `should emit deleteWord event on Ctrl+W` | `deleteWord` | none |
| `should emit moveCursor events on Ctrl+A/E` | `moveCursor` | `'home'` / `'end'` |
| `should emit historyPrev/Next on Ctrl+P/N` | `historyPrev`/`historyNext` | none |
| `should emit complete on Tab` | `complete` | none |
| `should emit dismiss on Escape` | `dismiss` | none |
| `should emit command events for command actions` | `command` | command string |

#### 2.4 Default Shortcuts Verification

Comprehensive test matrix for all default shortcuts:

| Shortcut | Keys | ID | Context | Event/Action |
|----------|------|-----|---------|--------------|
| Cancel | Ctrl+C | `cancel` | `processing` | emit: `cancel` |
| Exit | Ctrl+D | `exit` | `global` | emit: `exit` |
| Clear Screen | Ctrl+L | `clear` | `global` | emit: `clear` |
| Clear Line | Ctrl+U | `clearLine` | `input` | emit: `clearLine` |
| Delete Word | Ctrl+W | `deleteWord` | `input` | emit: `deleteWord` |
| Beginning of Line | Ctrl+A | `beginningOfLine` | `input` | emit: `moveCursor` (payload: `'home'`) |
| End of Line | Ctrl+E | `endOfLine` | `input` | emit: `moveCursor` (payload: `'end'`) |
| Previous History | Ctrl+P | `previousHistory` | `input` | emit: `historyPrev` |
| Next History | Ctrl+N | `nextHistory` | `input` | emit: `historyNext` |
| Complete | Tab | `complete` | `input` | emit: `complete` |
| Dismiss | Escape | `dismiss` | `global` | emit: `dismiss` |
| Help | Ctrl+H | `help` | `global` | command: `/help` |
| Quick Save | Ctrl+S | `quickSave` | `global` | command: `/session save quick-save` |
| Status | Ctrl+Shift+S | `status` | `global` | command: `/status` |
| Agents | Ctrl+Shift+A | `agents` | `global` | command: `/agents` |
| Workflows | Ctrl+Shift+W | `workflows` | `global` | command: `/workflows` |
| Session Info | Ctrl+Shift+I | `sessionInfo` | `global` | command: `/session info` |
| Session List | Ctrl+Shift+L | `sessionList` | `global` | command: `/session list` |
| History Search | Ctrl+R | `historySearch` | `input` | emit: `historySearch` |
| Submit | Enter | `submit` | `input` | emit: `submit` |
| Newline | Shift+Enter | `newline` | `input` | emit: `newline` |

### 3. Test Implementation Architecture

```typescript
// Integration test structure
describe('ShortcutManager Integration', () => {
  let shortcutManager: ShortcutManager;
  let sessionStore: SessionStore;
  let completionEngine: CompletionEngine;
  let conversationManager: ConversationManager;

  beforeEach(async () => {
    // Initialize all services (already done in parent beforeEach)
    // Services are available from the outer describe block
  });

  describe('Service Integration', () => {
    // Tests for multi-service coordination
  });

  describe('Context-Aware Activation', () => {
    // Tests for context-dependent shortcut behavior
  });

  describe('Event Emission', () => {
    // Tests for event propagation
  });

  describe('Default Shortcuts Coverage', () => {
    // Comprehensive tests for all default shortcuts

    describe('Global Shortcuts', () => {
      // Ctrl+D, Ctrl+L, Ctrl+H, Escape
    });

    describe('Processing Shortcuts', () => {
      // Ctrl+C
    });

    describe('Input Shortcuts', () => {
      // Ctrl+U, Ctrl+W, Ctrl+A, Ctrl+E, Ctrl+P, Ctrl+N, Tab, Enter, Shift+Enter
    });

    describe('Command Shortcuts', () => {
      // Ctrl+S, Ctrl+Shift+S, Ctrl+Shift+A, Ctrl+Shift+W, Ctrl+Shift+I, Ctrl+Shift+L
    });
  });
});
```

### 4. Test Helper Functions

```typescript
// Helper to create ShortcutEvent objects
function createShortcutEvent(
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

// Helper to verify event emission
async function expectEventEmission(
  manager: ShortcutManager,
  event: ShortcutEvent,
  expectedEvent: string,
  expectedPayload?: unknown
): Promise<void> {
  const handler = vi.fn();
  manager.on(expectedEvent, handler);

  const handled = manager.handleKey(event);

  expect(handled).toBe(true);
  expect(handler).toHaveBeenCalledTimes(1);
  if (expectedPayload !== undefined) {
    expect(handler).toHaveBeenCalledWith(expectedPayload);
  }

  manager.off(expectedEvent, handler);
}
```

### 5. Critical Test Scenarios

#### 5.1 Multi-Service Workflow Test
```typescript
it('should coordinate shortcuts across services during task execution', async () => {
  // Start a session
  const sessionId = await conversationManager.startSession();

  // User types a message (input context)
  shortcutManager.pushContext('input');

  // User submits with Enter
  const submitHandler = vi.fn();
  shortcutManager.on('submit', submitHandler);
  shortcutManager.handleKey(createShortcutEvent('Enter'));
  expect(submitHandler).toHaveBeenCalled();

  // Context switches to processing
  shortcutManager.popContext();
  shortcutManager.pushContext('processing');

  // User cancels with Ctrl+C
  const cancelHandler = vi.fn();
  shortcutManager.on('cancel', cancelHandler);
  shortcutManager.handleKey(createShortcutEvent('c', { ctrl: true }));
  expect(cancelHandler).toHaveBeenCalled();
});
```

#### 5.2 Context Stack Integrity Test
```typescript
it('should maintain context stack integrity through transitions', () => {
  expect(shortcutManager.getCurrentContext()).toBe('global');

  shortcutManager.pushContext('input');
  expect(shortcutManager.getCurrentContext()).toBe('input');

  shortcutManager.pushContext('suggestions');
  expect(shortcutManager.getCurrentContext()).toBe('suggestions');

  // Tab should work in suggestions context
  const completeHandler = vi.fn();
  shortcutManager.on('complete', completeHandler);
  shortcutManager.handleKey(createShortcutEvent('Tab'));
  expect(completeHandler).toHaveBeenCalled();

  shortcutManager.popContext();
  expect(shortcutManager.getCurrentContext()).toBe('input');

  shortcutManager.popContext();
  expect(shortcutManager.getCurrentContext()).toBe('global');
});
```

## Consequences

### Positive
- Comprehensive validation of keyboard shortcut system in integration context
- Catches regressions in shortcut behavior during code changes
- Documents expected behavior for all default shortcuts
- Validates multi-service coordination

### Negative
- Adds test execution time (~500ms estimated)
- Requires maintenance when shortcuts change

### Risks
- False positives if event handlers are not properly cleaned up
- Test interdependencies if not properly isolated

## Implementation Notes

### Files to Modify
- `packages/cli/src/__tests__/v030-features.integration.test.tsx` - **Replace** existing `Keyboard Shortcuts Integration` describe block (lines 454-574)

### Migration Strategy
1. Remove the existing stub tests that use the incorrect API
2. Replace with tests matching the actual `ShortcutManager` API
3. Import `ShortcutEvent` type from the service file
4. Use `shortcutManager.handleKey()` instead of DOM events

### Test Count Estimate
- Service Integration: 3-4 tests
- Context-Aware Activation: 4-5 tests
- Event Emission: 15+ tests (one per event type)
- Default Shortcuts Coverage: 20+ tests (comprehensive matrix)

**Total: ~42-44 new test cases**

### Test Execution Order
Tests should be independent and not rely on shared state. Each test should:
1. Create fresh ShortcutManager instance (or use beforeEach reset)
2. Set up required context
3. Register event handlers
4. Execute shortcut
5. Verify behavior
6. Clean up handlers

## Appendix: Full Test Implementation Code

The following code block provides the complete implementation for the `Keyboard Shortcuts Integration` describe block that should replace lines 454-574 in `v030-features.integration.test.tsx`:

```typescript
  describe('Keyboard Shortcuts Integration', () => {
    // Helper to create ShortcutEvent objects
    const createShortcutEvent = (
      key: string,
      modifiers: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean } = {}
    ): { key: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean } => ({
      key,
      ctrl: modifiers.ctrl ?? false,
      alt: modifiers.alt ?? false,
      shift: modifiers.shift ?? false,
      meta: modifiers.meta ?? false,
    });

    describe('ShortcutManager Registration', () => {
      it('should register default shortcuts on initialization', () => {
        const shortcuts = shortcutManager.getShortcuts();

        expect(shortcuts.length).toBeGreaterThan(0);
        expect(shortcuts.some(s => s.id === 'cancel')).toBe(true);
        expect(shortcuts.some(s => s.id === 'exit')).toBe(true);
        expect(shortcuts.some(s => s.id === 'clear')).toBe(true);
        expect(shortcuts.some(s => s.id === 'clearLine')).toBe(true);
        expect(shortcuts.some(s => s.id === 'deleteWord')).toBe(true);
        expect(shortcuts.some(s => s.id === 'beginningOfLine')).toBe(true);
        expect(shortcuts.some(s => s.id === 'endOfLine')).toBe(true);
        expect(shortcuts.some(s => s.id === 'previousHistory')).toBe(true);
        expect(shortcuts.some(s => s.id === 'nextHistory')).toBe(true);
        expect(shortcuts.some(s => s.id === 'complete')).toBe(true);
        expect(shortcuts.some(s => s.id === 'dismiss')).toBe(true);
      });

      it('should register custom shortcuts', () => {
        const customShortcut = {
          id: 'custom-integration-test',
          description: 'Custom test shortcut',
          keys: { key: 'x', ctrl: true, alt: true },
          action: { type: 'emit' as const, event: 'custom-test' },
        };

        shortcutManager.register(customShortcut);

        const shortcuts = shortcutManager.getShortcuts();
        expect(shortcuts.some(s => s.id === 'custom-integration-test')).toBe(true);

        // Clean up
        shortcutManager.unregister('custom-integration-test');
      });

      it('should unregister shortcuts', () => {
        const testShortcut = {
          id: 'temp-shortcut',
          description: 'Temporary shortcut',
          keys: { key: 'z', ctrl: true },
          action: { type: 'emit' as const, event: 'temp-event' },
        };

        shortcutManager.register(testShortcut);
        expect(shortcutManager.getShortcuts().some(s => s.id === 'temp-shortcut')).toBe(true);

        shortcutManager.unregister('temp-shortcut');
        expect(shortcutManager.getShortcuts().some(s => s.id === 'temp-shortcut')).toBe(false);
      });
    });

    describe('Context-Aware Activation', () => {
      it('should start with global context', () => {
        expect(shortcutManager.getCurrentContext()).toBe('global');
      });

      it('should handle context stack push and pop', () => {
        shortcutManager.pushContext('input');
        expect(shortcutManager.getCurrentContext()).toBe('input');

        shortcutManager.pushContext('processing');
        expect(shortcutManager.getCurrentContext()).toBe('processing');

        shortcutManager.popContext();
        expect(shortcutManager.getCurrentContext()).toBe('input');

        shortcutManager.popContext();
        expect(shortcutManager.getCurrentContext()).toBe('global');
      });

      it('should not pop the last (global) context', () => {
        const popped = shortcutManager.popContext();
        expect(popped).toBeUndefined();
        expect(shortcutManager.getCurrentContext()).toBe('global');
      });

      it('should only trigger cancel in processing context', () => {
        const cancelHandler = vi.fn();
        shortcutManager.on('cancel', cancelHandler);

        // In global context, Ctrl+C should not trigger cancel (cancel is processing-only)
        const ctrlC = createShortcutEvent('c', { ctrl: true });
        shortcutManager.handleKey(ctrlC);
        expect(cancelHandler).not.toHaveBeenCalled();

        // In processing context, Ctrl+C should trigger cancel
        shortcutManager.pushContext('processing');
        shortcutManager.handleKey(ctrlC);
        expect(cancelHandler).toHaveBeenCalledTimes(1);

        shortcutManager.off('cancel', cancelHandler);
        shortcutManager.popContext();
      });

      it('should activate input shortcuts only in input context', () => {
        const clearLineHandler = vi.fn();
        shortcutManager.on('clearLine', clearLineHandler);

        const ctrlU = createShortcutEvent('u', { ctrl: true });

        // In global context, Ctrl+U should not trigger clearLine
        shortcutManager.handleKey(ctrlU);
        expect(clearLineHandler).not.toHaveBeenCalled();

        // In input context, Ctrl+U should trigger clearLine
        shortcutManager.pushContext('input');
        shortcutManager.handleKey(ctrlU);
        expect(clearLineHandler).toHaveBeenCalledTimes(1);

        shortcutManager.off('clearLine', clearLineHandler);
        shortcutManager.popContext();
      });

      it('should get shortcuts for specific context', () => {
        const inputShortcuts = shortcutManager.getShortcutsForContext('input');
        const globalShortcuts = shortcutManager.getShortcutsForContext('global');

        // Input context should include input-specific and global shortcuts
        expect(inputShortcuts.some(s => s.id === 'clearLine')).toBe(true);
        expect(inputShortcuts.some(s => s.id === 'exit')).toBe(true); // global

        // Global context should not include input-specific shortcuts
        expect(globalShortcuts.some(s => s.id === 'exit')).toBe(true);
        // Note: getShortcutsForContext includes shortcuts without context too
      });
    });

    describe('Event Emission', () => {
      it('should emit cancel event on Ctrl+C in processing context', () => {
        const handler = vi.fn();
        shortcutManager.on('cancel', handler);
        shortcutManager.pushContext('processing');

        shortcutManager.handleKey(createShortcutEvent('c', { ctrl: true }));

        expect(handler).toHaveBeenCalledTimes(1);

        shortcutManager.off('cancel', handler);
        shortcutManager.popContext();
      });

      it('should emit exit event on Ctrl+D', () => {
        const handler = vi.fn();
        shortcutManager.on('exit', handler);

        shortcutManager.handleKey(createShortcutEvent('d', { ctrl: true }));

        expect(handler).toHaveBeenCalledTimes(1);

        shortcutManager.off('exit', handler);
      });

      it('should emit clear event on Ctrl+L', () => {
        const handler = vi.fn();
        shortcutManager.on('clear', handler);

        shortcutManager.handleKey(createShortcutEvent('l', { ctrl: true }));

        expect(handler).toHaveBeenCalledTimes(1);

        shortcutManager.off('clear', handler);
      });

      it('should emit clearLine event on Ctrl+U in input context', () => {
        const handler = vi.fn();
        shortcutManager.on('clearLine', handler);
        shortcutManager.pushContext('input');

        shortcutManager.handleKey(createShortcutEvent('u', { ctrl: true }));

        expect(handler).toHaveBeenCalledTimes(1);

        shortcutManager.off('clearLine', handler);
        shortcutManager.popContext();
      });

      it('should emit deleteWord event on Ctrl+W in input context', () => {
        const handler = vi.fn();
        shortcutManager.on('deleteWord', handler);
        shortcutManager.pushContext('input');

        shortcutManager.handleKey(createShortcutEvent('w', { ctrl: true }));

        expect(handler).toHaveBeenCalledTimes(1);

        shortcutManager.off('deleteWord', handler);
        shortcutManager.popContext();
      });

      it('should emit moveCursor event with home payload on Ctrl+A in input context', () => {
        const handler = vi.fn();
        shortcutManager.on('moveCursor', handler);
        shortcutManager.pushContext('input');

        shortcutManager.handleKey(createShortcutEvent('a', { ctrl: true }));

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith('home');

        shortcutManager.off('moveCursor', handler);
        shortcutManager.popContext();
      });

      it('should emit moveCursor event with end payload on Ctrl+E in input context', () => {
        const handler = vi.fn();
        shortcutManager.on('moveCursor', handler);
        shortcutManager.pushContext('input');

        shortcutManager.handleKey(createShortcutEvent('e', { ctrl: true }));

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith('end');

        shortcutManager.off('moveCursor', handler);
        shortcutManager.popContext();
      });

      it('should emit historyPrev event on Ctrl+P in input context', () => {
        const handler = vi.fn();
        shortcutManager.on('historyPrev', handler);
        shortcutManager.pushContext('input');

        shortcutManager.handleKey(createShortcutEvent('p', { ctrl: true }));

        expect(handler).toHaveBeenCalledTimes(1);

        shortcutManager.off('historyPrev', handler);
        shortcutManager.popContext();
      });

      it('should emit historyNext event on Ctrl+N in input context', () => {
        const handler = vi.fn();
        shortcutManager.on('historyNext', handler);
        shortcutManager.pushContext('input');

        shortcutManager.handleKey(createShortcutEvent('n', { ctrl: true }));

        expect(handler).toHaveBeenCalledTimes(1);

        shortcutManager.off('historyNext', handler);
        shortcutManager.popContext();
      });

      it('should emit complete event on Tab in input context', () => {
        const handler = vi.fn();
        shortcutManager.on('complete', handler);
        shortcutManager.pushContext('input');

        shortcutManager.handleKey(createShortcutEvent('Tab'));

        expect(handler).toHaveBeenCalledTimes(1);

        shortcutManager.off('complete', handler);
        shortcutManager.popContext();
      });

      it('should emit dismiss event on Escape', () => {
        const handler = vi.fn();
        shortcutManager.on('dismiss', handler);

        shortcutManager.handleKey(createShortcutEvent('Escape'));

        expect(handler).toHaveBeenCalledTimes(1);

        shortcutManager.off('dismiss', handler);
      });

      it('should emit command event for command action shortcuts', () => {
        const handler = vi.fn();
        shortcutManager.on('command', handler);

        // Ctrl+H triggers /help command
        shortcutManager.handleKey(createShortcutEvent('h', { ctrl: true }));

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith('/help');

        shortcutManager.off('command', handler);
      });
    });

    describe('Default Shortcuts Coverage', () => {
      describe('Global Shortcuts', () => {
        it('should handle Ctrl+D (exit)', () => {
          const handler = vi.fn();
          shortcutManager.on('exit', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('d', { ctrl: true }));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalled();

          shortcutManager.off('exit', handler);
        });

        it('should handle Ctrl+L (clear screen)', () => {
          const handler = vi.fn();
          shortcutManager.on('clear', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('l', { ctrl: true }));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalled();

          shortcutManager.off('clear', handler);
        });

        it('should handle Escape (dismiss)', () => {
          const handler = vi.fn();
          shortcutManager.on('dismiss', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('Escape'));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalled();

          shortcutManager.off('dismiss', handler);
        });

        it('should handle Ctrl+H (help command)', () => {
          const handler = vi.fn();
          shortcutManager.on('command', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('h', { ctrl: true }));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalledWith('/help');

          shortcutManager.off('command', handler);
        });
      });

      describe('Processing Shortcuts', () => {
        it('should handle Ctrl+C (cancel) in processing context', () => {
          const handler = vi.fn();
          shortcutManager.on('cancel', handler);
          shortcutManager.pushContext('processing');

          const result = shortcutManager.handleKey(createShortcutEvent('c', { ctrl: true }));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalled();

          shortcutManager.off('cancel', handler);
          shortcutManager.popContext();
        });
      });

      describe('Input Shortcuts', () => {
        beforeEach(() => {
          shortcutManager.pushContext('input');
        });

        afterEach(() => {
          shortcutManager.popContext();
        });

        it('should handle Ctrl+U (clear line)', () => {
          const handler = vi.fn();
          shortcutManager.on('clearLine', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('u', { ctrl: true }));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalled();

          shortcutManager.off('clearLine', handler);
        });

        it('should handle Ctrl+W (delete word)', () => {
          const handler = vi.fn();
          shortcutManager.on('deleteWord', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('w', { ctrl: true }));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalled();

          shortcutManager.off('deleteWord', handler);
        });

        it('should handle Ctrl+A (beginning of line)', () => {
          const handler = vi.fn();
          shortcutManager.on('moveCursor', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('a', { ctrl: true }));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalledWith('home');

          shortcutManager.off('moveCursor', handler);
        });

        it('should handle Ctrl+E (end of line)', () => {
          const handler = vi.fn();
          shortcutManager.on('moveCursor', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('e', { ctrl: true }));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalledWith('end');

          shortcutManager.off('moveCursor', handler);
        });

        it('should handle Ctrl+P (previous history)', () => {
          const handler = vi.fn();
          shortcutManager.on('historyPrev', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('p', { ctrl: true }));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalled();

          shortcutManager.off('historyPrev', handler);
        });

        it('should handle Ctrl+N (next history)', () => {
          const handler = vi.fn();
          shortcutManager.on('historyNext', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('n', { ctrl: true }));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalled();

          shortcutManager.off('historyNext', handler);
        });

        it('should handle Tab (complete)', () => {
          const handler = vi.fn();
          shortcutManager.on('complete', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('Tab'));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalled();

          shortcutManager.off('complete', handler);
        });

        it('should handle Ctrl+R (history search)', () => {
          const handler = vi.fn();
          shortcutManager.on('historySearch', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('r', { ctrl: true }));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalled();

          shortcutManager.off('historySearch', handler);
        });

        it('should handle Enter (submit)', () => {
          const handler = vi.fn();
          shortcutManager.on('submit', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('Enter'));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalled();

          shortcutManager.off('submit', handler);
        });

        it('should handle Shift+Enter (newline)', () => {
          const handler = vi.fn();
          shortcutManager.on('newline', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('Enter', { shift: true }));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalled();

          shortcutManager.off('newline', handler);
        });
      });

      describe('Command Shortcuts', () => {
        it('should handle Ctrl+S (quick save)', () => {
          const handler = vi.fn();
          shortcutManager.on('command', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('s', { ctrl: true }));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalledWith('/session save quick-save');

          shortcutManager.off('command', handler);
        });

        it('should handle Ctrl+Shift+S (status)', () => {
          const handler = vi.fn();
          shortcutManager.on('command', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('s', { ctrl: true, shift: true }));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalledWith('/status');

          shortcutManager.off('command', handler);
        });

        it('should handle Ctrl+Shift+A (agents)', () => {
          const handler = vi.fn();
          shortcutManager.on('command', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('a', { ctrl: true, shift: true }));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalledWith('/agents');

          shortcutManager.off('command', handler);
        });

        it('should handle Ctrl+Shift+W (workflows)', () => {
          const handler = vi.fn();
          shortcutManager.on('command', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('w', { ctrl: true, shift: true }));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalledWith('/workflows');

          shortcutManager.off('command', handler);
        });

        it('should handle Ctrl+Shift+I (session info)', () => {
          const handler = vi.fn();
          shortcutManager.on('command', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('i', { ctrl: true, shift: true }));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalledWith('/session info');

          shortcutManager.off('command', handler);
        });

        it('should handle Ctrl+Shift+L (session list)', () => {
          const handler = vi.fn();
          shortcutManager.on('command', handler);

          const result = shortcutManager.handleKey(createShortcutEvent('l', { ctrl: true, shift: true }));

          expect(result).toBe(true);
          expect(handler).toHaveBeenCalledWith('/session list');

          shortcutManager.off('command', handler);
        });
      });
    });

    describe('All Shortcuts Integration Test', () => {
      it('should have all required default shortcuts registered', () => {
        const requiredShortcuts = [
          'cancel',
          'exit',
          'clear',
          'clearLine',
          'deleteWord',
          'historySearch',
          'previousHistory',
          'nextHistory',
          'complete',
          'dismiss',
          'newline',
          'submit',
          'beginningOfLine',
          'endOfLine',
          'quickSave',
          'sessionInfo',
          'sessionList',
          'help',
          'status',
          'agents',
          'workflows',
        ];

        const shortcuts = shortcutManager.getShortcuts();
        const shortcutIds = shortcuts.map(s => s.id);

        for (const id of requiredShortcuts) {
          expect(shortcutIds).toContain(id);
        }
      });
    });
  });
```

## Related ADRs
- ADR-004: Keyboard Shortcuts System for v0.3.0
- ADR-001: Rich Terminal UI Architecture
