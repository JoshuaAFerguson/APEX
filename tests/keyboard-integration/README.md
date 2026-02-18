# APEX Keyboard Integration Test Infrastructure

This directory contains the complete keyboard integration testing infrastructure for APEX, providing comprehensive utilities for testing keyboard event handling in the CLI application.

## 📋 Overview

The keyboard integration test infrastructure enables:

- **Keyboard Event Simulation**: Type-safe simulation of keyboard events
- **Ink Component Testing**: Integration with Ink's `useInput` hook system
- **ShortcutManager Testing**: Direct integration with APEX's shortcut handling
- **Key Sequence Testing**: Support for complex multi-key workflows
- **Modifier Key Testing**: Full support for Ctrl, Alt, Shift, Meta combinations
- **Edge Case Validation**: Comprehensive fixtures for testing edge cases

## 🏗️ Architecture

```
tests/keyboard-integration/
├── vitest.config.ts          # Vitest configuration optimized for keyboard testing
├── setup.ts                  # Global test setup and utilities
├── utils/
│   └── keyboard-events.ts    # KeyboardEventSimulator class and utilities
├── fixtures/
│   └── key-combinations.ts   # Predefined key event fixtures
└── *.test.ts                 # Integration test files
```

## 🛠️ Core Components

### 1. KeyboardEventSimulator

The main utility class for simulating keyboard events:

```typescript
import { KeyboardEventSimulator } from './utils/keyboard-events.js';

const simulator = new KeyboardEventSimulator();

// Simulate single keys
simulator.fire({ key: 'a' }, inputHandler);

// Simulate key combinations
simulator.fire({ key: 'c', ctrl: true }, inputHandler);

// Simulate sequences
await simulator.fireSequence([
  { key: 'h', ctrl: true },
  { key: 'escape' },
], inputHandler);
```

### 2. Global Test Helpers

Available globally in all tests via `globalThis.keyboardTestHelpers`:

```typescript
// In any test file
const { createKeyEvent, fireKeyEvent, getContext } = globalThis.keyboardTestHelpers;

// Create events
const event = createKeyEvent({ key: 'a', ctrl: true });

// Fire events to all registered handlers
fireKeyEvent({ key: 'return' });

// Access test context
const context = getContext();
```

### 3. Test Fixtures

Comprehensive predefined key events for common test scenarios:

```typescript
import { LETTER_KEYS, APEX_SHORTCUTS, ALL_NAVIGATION_KEYS } from './fixtures/key-combinations.js';

// Use predefined fixtures
LETTER_KEYS.forEach(keyEvent => {
  simulator.fire(keyEvent, handler);
});

// Test specific shortcuts
simulator.fire(APEX_SHORTCUTS.help, handler);
```

## 🎯 Key Features

### Type Safety

All keyboard events are fully typed with TypeScript:

```typescript
interface KeyboardEventOptions {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

interface InkKeyEvent {
  return?: boolean;
  escape?: boolean;
  ctrl?: boolean;
  // ... and more
}
```

### Ink Integration

Seamless integration with Ink's `useInput` hook:

```typescript
// Mock useInput handler
const mockHandler = vi.fn<[string | undefined, InkKeyEvent], void>();

// Fire events that match Ink's expected format
simulator.fire({ key: 'return' }, mockHandler);

expect(mockHandler).toHaveBeenCalledWith('', { return: true, ctrl: false, ... });
```

### ShortcutManager Integration

Direct integration with APEX's ShortcutManager:

```typescript
const result = simulator.fireToShortcutManager(
  { key: 'c', ctrl: true },
  mockShortcutManager
);

expect(result).toBe(true); // Shortcut was handled
```

### Event Logging

Built-in event logging for debugging and assertions:

```typescript
simulator.clearEventLog();
simulator.fire({ key: 'a' }, handler);

const log = simulator.getEventLog();
expect(log).toHaveLength(1);
expect(log[0].event).toEqual({ key: 'a' });
```

## 📚 Usage Examples

### Basic Key Testing

```typescript
describe('Basic keyboard input', () => {
  it('should handle single character keys', () => {
    const handler = vi.fn();
    simulator.fire({ key: 'a' }, handler);

    expect(handler).toHaveBeenCalledWith('a', expect.objectContaining({
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
    }));
  });
});
```

### Modifier Key Testing

```typescript
describe('Modifier keys', () => {
  it('should handle Ctrl+C (cancel)', () => {
    const handler = vi.fn();
    simulator.fire({ key: 'c', ctrl: true }, handler);

    expect(handler).toHaveBeenCalledWith('c', expect.objectContaining({
      ctrl: true,
    }));
  });
});
```

### Key Sequence Testing

```typescript
describe('Key sequences', () => {
  it('should handle complex workflows', async () => {
    const handler = vi.fn();

    await simulator.fireSequence([
      { key: 'h', ctrl: true },  // Help
      { key: 'ArrowDown' },      // Navigate
      { key: 'return' },         // Select
    ], handler);

    expect(handler).toHaveBeenCalledTimes(3);
  });
});
```

### APEX Shortcut Testing

```typescript
import { APEX_SHORTCUTS } from './fixtures/key-combinations.js';

describe('APEX shortcuts', () => {
  it('should handle all defined shortcuts', () => {
    Object.entries(APEX_SHORTCUTS).forEach(([name, shortcut]) => {
      simulator.fire(shortcut, handler);
      // Verify shortcut behavior
    });
  });
});
```

### Rapid Input Testing

```typescript
describe('Rapid input', () => {
  it('should handle fast typing', () => {
    const handler = vi.fn();
    simulator.fireRapid('hello world', handler);

    expect(handler).toHaveBeenCalledTimes(11); // 11 characters
  });
});
```

## 🧪 Running Tests

### Individual Test Files

```bash
# Run keyboard integration tests
npm run test:keyboard-integration

# Watch mode
npm run test:keyboard-integration:watch

# With coverage
npm run test:keyboard-integration:coverage
```

### Specific Test Patterns

```bash
# Run only infrastructure tests
npx vitest run tests/keyboard-integration/keyboard-infrastructure.test.ts

# Run tests matching pattern
npx vitest run --config tests/keyboard-integration/vitest.config.ts -t "shortcut"
```

### Validation

```bash
# Validate keyboard infrastructure is ready
npm run validate:keyboard-infrastructure
```

## 📋 Test Categories

### 1. Infrastructure Validation
- Basic key event simulation
- Modifier key combinations
- Special key handling
- Event logging and debugging

### 2. Ink Component Integration
- `useInput` hook compatibility
- Event format validation
- Handler registration testing

### 3. ShortcutManager Integration
- Shortcut registration testing
- Key combination matching
- Handler execution validation

### 4. Key Sequence Workflows
- Multi-step user interactions
- Async key sequence handling
- Timing-dependent scenarios

### 5. Edge Case Testing
- Empty/undefined inputs
- Unicode characters
- All modifier combinations
- Rapid input sequences

## 🔍 Debugging

### Event Logging

```typescript
// Clear log before test
simulator.clearEventLog();

// Run your test scenario
simulator.fire({ key: 'a' }, handler);
simulator.fire({ key: 'b', ctrl: true }, handler);

// Inspect what happened
const log = simulator.getEventLog();
console.log('Fired events:', log.map(entry => entry.event));
```

### Key Combination Formatting

```typescript
// Human-readable key combination display
const formatted = simulator.formatKeyCombination({ key: 's', ctrl: true, shift: true });
console.log(formatted); // "Ctrl+Shift+S"
```

### Test Context Inspection

```typescript
// Access global test context
const { getContext } = globalThis.keyboardTestHelpers;
const context = getContext();

console.log('Registered handlers:', context.inputHandlers.length);
console.log('Fired events:', context.firedEvents);
```

## 🏆 Best Practices

### 1. Test Isolation

```typescript
beforeEach(() => {
  simulator.clearEventLog();
  vi.clearAllMocks();
});
```

### 2. Use Fixtures

```typescript
// Prefer fixtures over hard-coded values
import { APEX_SHORTCUTS } from './fixtures/key-combinations.js';

// Good
simulator.fire(APEX_SHORTCUTS.cancel, handler);

// Less good
simulator.fire({ key: 'c', ctrl: true }, handler);
```

### 3. Test Real Workflows

```typescript
// Test complete user workflows, not just individual keys
const userWorkflow = [
  APEX_SHORTCUTS.help,     // User opens help
  { key: 'ArrowDown' },    // User navigates
  { key: 'escape' },       // User closes help
];
```

### 4. Validate Event Structure

```typescript
// Verify both input and key structure
expect(handler).toHaveBeenCalledWith(
  expectedInput,
  expect.objectContaining(expectedKeyStructure)
);
```

### 5. Use Descriptive Test Names

```typescript
// Good
it('should cancel auto-execute countdown when any key except Enter/Escape/E is pressed')

// Less good
it('should handle key input')
```

## 🚨 Common Pitfalls

1. **Forgetting to clear event log**: Always clear between tests
2. **Not mocking handlers**: Use `vi.fn()` for all input handlers
3. **Ignoring key normalization**: Use simulator methods, not raw events
4. **Testing in isolation**: Test real workflows, not just individual keys
5. **Missing edge cases**: Use fixtures for comprehensive coverage

## 📖 Advanced Usage

### Custom Event Generators

```typescript
import { generateModifierCombinations } from './utils/keyboard-events.js';

// Test all modifier combinations for a key
for (const combination of generateModifierCombinations('a')) {
  simulator.fire(combination, handler);
  // Test behavior for each combination
}
```

### Performance Testing

```typescript
it('should handle rapid input without blocking', () => {
  const startTime = Date.now();

  // Fire 100 rapid events
  for (let i = 0; i < 100; i++) {
    simulator.fire({ key: 'a' }, handler);
  }

  const duration = Date.now() - startTime;
  expect(duration).toBeLessThan(100); // Should complete quickly
});
```

### Integration with Real Components

```typescript
import { render } from 'ink-testing-library';
import YourComponent from '../src/components/YourComponent.js';

it('should integrate with real Ink components', () => {
  const { stdin } = render(<YourComponent />);

  // Use real stdin instead of mocked handler
  simulator.fire({ key: 'return' }, (input, key) => {
    stdin.write(input || '');
  });
});
```

## 🔗 Related Documentation

- [ADR-001: Keyboard Test Infrastructure](./ADR-001-keyboard-test-infrastructure.md)
- [Vitest Configuration](./vitest.config.ts)
- [Setup and Global Utilities](./setup.ts)
- [Keyboard Event Utilities](./utils/keyboard-events.ts)
- [Test Fixtures](./fixtures/key-combinations.ts)

---

This infrastructure provides everything needed to write comprehensive, maintainable keyboard integration tests for APEX. Start with the example test file and build upon these patterns for your specific testing needs.