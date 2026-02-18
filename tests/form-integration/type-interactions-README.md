# Type Interactions Integration Test Infrastructure

This directory contains the integration test infrastructure for testing type interactions across various input elements. The infrastructure was created to provide comprehensive testing capabilities for form input behaviors.

## 📁 Structure

```
tests/form-integration/
├── type-interactions.integration.test.ts  # Main integration test file
├── fixtures/
│   └── input-fixtures.ts                  # HTML fixtures for various input types
├── utils/
│   └── typing-simulator.ts               # Advanced typing simulation utilities
└── type-interactions-README.md           # This documentation
```

## 🎯 Features

### Test File: `type-interactions.integration.test.ts`
- **Comprehensive test coverage** for different input types:
  - Text inputs (text, email, password, url, tel, search)
  - Number inputs (number, range)
  - Date/time inputs (date, time, datetime-local)
  - File inputs and drag-drop
  - Textarea elements
  - Complex form scenarios

- **Test categories include**:
  - Basic typing functionality
  - Input validation during typing
  - Type-specific formatting and constraints
  - Performance under rapid typing
  - Accessibility features
  - Cross-component integration

### Fixtures: `fixtures/input-fixtures.ts`
- **Pre-built HTML templates** for consistent testing
- **Accessibility-compliant** structure with proper labels and ARIA attributes
- **Test-friendly** data attributes for easy element selection
- **Reusable fixtures** for:
  - Text input variations
  - Number inputs with validation
  - File upload forms
  - Multi-field forms with complex interactions

### Utilities: `utils/typing-simulator.ts`
- **Advanced typing simulation** with realistic user behavior:
  - Configurable typing speeds (slow, normal, fast, instant)
  - Special key support (Tab, Enter, Backspace, etc.)
  - Clipboard operations (copy/paste)
  - IME input method simulation

- **Key features**:
  - `TypingSimulator` class for complex interactions
  - Convenience functions for common scenarios
  - Error simulation and correction patterns
  - Form validation trigger support
  - Focus management utilities

## 🚀 Usage

### Basic Test Setup
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TypingSimulator, simulateNormalTyping } from './utils/typing-simulator';
import { textInputFixtures, loadFixture } from './fixtures/input-fixtures';

describe('Your Test Suite', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should handle text input typing', async () => {
    // Load fixture
    const form = loadFixture(container, textInputFixtures.basicText);
    const input = form.querySelector('[data-testid="username-input"]') as HTMLInputElement;

    // Simulate typing
    await simulateNormalTyping(input, 'testuser');

    // Assertions
    expect(input.value).toBe('testuser');
  });
});
```

### Advanced Typing Simulation
```typescript
// Create advanced typing simulator
const simulator = new TypingSimulator(inputElement, {
  speed: TypingSpeed.SLOW,
  triggerValidation: true,
  focusElement: true
});

// Type with realistic delays
await simulator.typeText('Hello World');

// Simulate special keys
await simulator.pressKey(SpecialKeys.BACKSPACE);
await simulator.pressKey(SpecialKeys.ENTER);

// Paste text
await simulator.pasteText('Clipboard content');
```

## 🧪 Test Execution

The tests are configured to run with the form integration test runner:

```bash
# Run all form integration tests
npm run test:form-integration

# Run with watch mode
npm run test:form-integration:watch

# Run with coverage
npm run test:form-integration:coverage
```

## 🏗 Test Infrastructure

### Environment
- **Vitest** with jsdom environment
- **DOM mocking** for browser APIs
- **File API mocking** for upload testing
- **Clipboard API mocking** for copy/paste
- **ResizeObserver mocking** for responsive components

### Custom Matchers
Available custom matchers from `setup.ts`:
- `toBeValidForm()` - Check form validity
- `toHaveValidationError()` - Check for validation errors
- `toHaveFormData()` - Verify form data contents
- `toBeAccessibleForm()` - Validate accessibility compliance

## 📋 Test Structure

Each test suite follows a consistent structure:

```typescript
describe('Feature Category', () => {
  describe('Specific Functionality', () => {
    it('should handle specific scenario', async () => {
      // Setup: Create DOM elements using fixtures
      // Action: Simulate user interactions
      // Assert: Verify expected behavior
      // Cleanup: Remove elements (handled by afterEach)
    });
  });
});
```

## 🎨 Implementation Status

The infrastructure is **fully implemented** and ready for test implementation:

- ✅ Integration test file with comprehensive test structure
- ✅ HTML fixtures for various input types
- ✅ Advanced typing simulator utilities
- ✅ Proper imports and module structure
- ✅ Documentation and usage examples

## 🔄 Next Steps

The testing stage can now:

1. **Implement individual test cases** in the existing test structure
2. **Add custom fixtures** as needed for specific scenarios
3. **Extend typing simulator** for additional interaction patterns
4. **Add performance benchmarks** for typing interactions
5. **Expand accessibility testing** with screen reader simulations

## 🐛 Debugging

For debugging type interaction tests:

```typescript
// Enable detailed logging in typing simulator
const simulator = new TypingSimulator(element, {
  speed: TypingSpeed.SLOW // Easier to observe
});

// Use console.log to track interactions
console.log('Element value before:', element.value);
await simulator.typeText('test');
console.log('Element value after:', element.value);
```

---

This infrastructure provides a robust foundation for comprehensive type interaction testing across all input types and interaction patterns.