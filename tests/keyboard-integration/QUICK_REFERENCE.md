# APEX Keyboard Integration Test Quick Reference

## 🚀 Quick Start

### Run Tests

```bash
# Run all keyboard integration tests
npm run test:keyboard-integration

# Watch mode for development
npm run test:keyboard-integration:watch

# Run with coverage
npm run test:keyboard-integration:coverage

# Validate infrastructure
npm run validate:keyboard-infrastructure
```

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeyboardEventSimulator } from './utils/keyboard-events.js';
import { APEX_SHORTCUTS } from './fixtures/key-combinations.js';

describe('My Keyboard Test', () => {
  let simulator: KeyboardEventSimulator;
  let handler: vi.MockedFunction<any>;

  beforeEach(() => {
    simulator = new KeyboardEventSimulator();
    handler = vi.fn();
  });

  it('should handle basic key events', () => {
    simulator.fire({ key: 'a' }, handler);
    expect(handler).toHaveBeenCalledWith('a', expect.any(Object));
  });
});
```

## ⌨️ Key Event Patterns

### Single Keys

```typescript
// Letters
simulator.fire({ key: 'a' }, handler);
simulator.fire({ key: 'Z' }, handler);

// Numbers
simulator.fire({ key: '1' }, handler);
simulator.fire({ key: '0' }, handler);

// Special characters
simulator.fire({ key: '@' }, handler);
simulator.fire({ key: ' ' }, handler); // space
```

### Special Keys

```typescript
// Navigation
simulator.fire({ key: 'return' }, handler);     // Enter
simulator.fire({ key: 'escape' }, handler);     // Esc
simulator.fire({ key: 'tab' }, handler);        // Tab
simulator.fire({ key: 'ArrowUp' }, handler);    // Arrow keys
simulator.fire({ key: 'ArrowDown' }, handler);
simulator.fire({ key: 'ArrowLeft' }, handler);
simulator.fire({ key: 'ArrowRight' }, handler);

// Editing
simulator.fire({ key: 'backspace' }, handler);  // Backspace
simulator.fire({ key: 'delete' }, handler);     // Delete

// Page navigation
simulator.fire({ key: 'PageUp' }, handler);     // Page Up
simulator.fire({ key: 'PageDown' }, handler);   // Page Down
simulator.fire({ key: 'Home' }, handler);       // Home
simulator.fire({ key: 'End' }, handler);        // End
```

### Modifier Keys

```typescript
// Ctrl combinations
simulator.fire({ key: 'c', ctrl: true }, handler);           // Ctrl+C
simulator.fire({ key: 's', ctrl: true }, handler);           // Ctrl+S

// Multiple modifiers
simulator.fire({ key: 's', ctrl: true, shift: true }, handler); // Ctrl+Shift+S
simulator.fire({ key: 'z', ctrl: true, alt: true }, handler);   // Ctrl+Alt+Z

// All modifiers
simulator.fire({
  key: 'a',
  ctrl: true,
  alt: true,
  shift: true,
  meta: true
}, handler);
```

## 🎯 Common Test Patterns

### Using Predefined Shortcuts

```typescript
import { APEX_SHORTCUTS } from './fixtures/key-combinations.js';

// Test APEX shortcuts
simulator.fire(APEX_SHORTCUTS.help, handler);      // Ctrl+H
simulator.fire(APEX_SHORTCUTS.cancel, handler);    // Ctrl+C
simulator.fire(APEX_SHORTCUTS.clear, handler);     // Ctrl+L
simulator.fire(APEX_SHORTCUTS.thoughts, handler);  // Ctrl+T
simulator.fire(APEX_SHORTCUTS.status, handler);    // Ctrl+Shift+S
```

### Key Sequences

```typescript
// Fire sequence with delay
await simulator.fireSequence([
  { key: 'h', ctrl: true },
  { key: 'ArrowDown' },
  { key: 'return' }
], handler, { delay: 50 });

// Rapid typing
simulator.fireRapid('hello world', handler);
```

### ShortcutManager Integration

```typescript
const mockManager = {
  handleKey: vi.fn((event) => {
    // Handle shortcut logic
    return true; // or false if not handled
  })
};

const result = simulator.fireToShortcutManager(
  { key: 'h', ctrl: true },
  mockManager
);

expect(result).toBe(true);
expect(mockManager.handleKey).toHaveBeenCalledWith({
  key: 'h',
  ctrl: true,
  alt: false,
  shift: false,
  meta: false
});
```

## 🧪 Testing Specific Scenarios

### Preview Mode

```typescript
import { PREVIEW_MODE_SPECIAL_KEYS } from './fixtures/key-combinations.js';

describe('Preview Mode', () => {
  it('should handle preview keys', () => {
    // These don't cancel auto-execute
    PREVIEW_MODE_SPECIAL_KEYS.forEach(key => {
      simulator.fire(key, handler);
      // Test specific behavior
    });
  });
});
```

### Auto-Execute Cancellation

```typescript
import { AUTO_EXECUTE_CANCEL_KEYS } from './fixtures/key-combinations.js';

describe('Auto-Execute', () => {
  it('should cancel on most keys', () => {
    AUTO_EXECUTE_CANCEL_KEYS.forEach(key => {
      simulator.fire(key, handler);
      // Should cancel auto-execute countdown
    });
  });
});
```

### Complete User Workflows

```typescript
describe('User Workflow', () => {
  it('should handle command entry to execution', async () => {
    // Type command
    'status'.split('').forEach(char => {
      simulator.fire({ key: char }, handler);
    });

    // Preview
    simulator.fire({ key: 'return' }, handler);

    // Execute
    simulator.fire({ key: 'return' }, handler);

    expect(handler).toHaveBeenCalledTimes(8); // 6 chars + 2 returns
  });
});
```

## 🔧 Test Utilities

### Global Helpers

```typescript
// Available in all tests
const { createKeyEvent, fireKeyEvent, getContext } = globalThis.keyboardTestHelpers;

// Create events
const event = createKeyEvent({ key: 'a', ctrl: true });

// Fire to all registered handlers
fireKeyEvent({ key: 'return' });

// Get test context
const context = getContext();
console.log('Handlers:', context.inputHandlers.length);
console.log('Events:', context.firedEvents);
```

### Event Logging

```typescript
// Clear log
simulator.clearEventLog();

// Fire events
simulator.fire({ key: 'a' }, handler);
simulator.fire({ key: 'b' }, handler);

// Check log
const log = simulator.getEventLog();
expect(log).toHaveLength(2);
expect(log[0].event.key).toBe('a');
expect(log[1].event.key).toBe('b');
```

### Key Formatting

```typescript
const display = simulator.formatKeyCombination({ key: 'c', ctrl: true });
expect(display).toBe('Ctrl+C');
```

## 🎛️ Assertion Patterns

### Basic Assertions

```typescript
// Handler called
expect(handler).toHaveBeenCalledTimes(1);

// Correct input/key structure
expect(handler).toHaveBeenCalledWith(
  'a', // input
  expect.objectContaining({
    ctrl: false,
    alt: false,
    shift: false,
    meta: false
  })
);

// Special key structure
expect(handler).toHaveBeenCalledWith(
  '', // no input for special keys
  expect.objectContaining({
    return: true,
    ctrl: false
  })
);
```

### Sequence Assertions

```typescript
const calls = handler.mock.calls;

expect(calls).toHaveLength(3);
expect(calls[0][0]).toBe('h');      // First input
expect(calls[1][1].escape).toBe(true); // Second was escape
expect(calls[2][1].return).toBe(true); // Third was return
```

## 📋 Fixture Categories

### Use Predefined Fixtures

```typescript
import {
  LETTER_KEYS,           // a-z
  NUMBER_KEYS,           // 0-9
  ARROW_KEYS,            // Arrow keys
  ACTION_KEYS,           // return, escape, tab, etc.
  CTRL_LETTER_COMBINATIONS, // Ctrl+a through Ctrl+z
  ALT_LETTER_COMBINATIONS,  // Alt+a through Alt+z
  APEX_SHORTCUTS,        // All APEX shortcuts
  getAllFixtures         // All fixtures combined
} from './fixtures/key-combinations.js';

// Use in parameterized tests
LETTER_KEYS.forEach(keyEvent => {
  it(`should handle ${keyEvent.key}`, () => {
    simulator.fire(keyEvent, handler);
    // Test behavior
  });
});
```

## 🚨 Common Pitfalls

1. **Forgetting to clear mocks**: Use `vi.clearAllMocks()` in `beforeEach`
2. **Wrong key names**: Use 'return' not 'enter', 'escape' not 'esc'
3. **Missing await**: Key sequences need `await simulator.fireSequence()`
4. **Case sensitivity**: Keys are normalized automatically
5. **Testing in isolation**: Test real workflows, not just individual keys

## 🔗 File Structure Reference

```
tests/keyboard-integration/
├── vitest.config.ts          # Vitest configuration
├── setup.ts                  # Global setup and utilities
├── utils/
│   └── keyboard-events.ts    # KeyboardEventSimulator class
├── fixtures/
│   └── key-combinations.ts   # Predefined key events
├── keyboard-infrastructure.test.ts  # Infrastructure validation test
├── shortcut-manager.test.ts         # ShortcutManager integration test
├── user-workflows.test.ts           # Real workflow tests
├── README.md                        # Complete documentation
└── QUICK_REFERENCE.md              # This file
```

## 💡 Pro Tips

1. **Start with fixtures**: Use predefined key combinations when possible
2. **Test real workflows**: Simulate complete user interactions
3. **Use descriptive names**: Make test names explain the user scenario
4. **Mock state changes**: Track application state changes in tests
5. **Test edge cases**: Use the comprehensive fixture library
6. **Debug with logs**: Use event logging to understand what happened
7. **Performance matters**: Test rapid input scenarios
8. **Clean setup**: Always reset state between tests