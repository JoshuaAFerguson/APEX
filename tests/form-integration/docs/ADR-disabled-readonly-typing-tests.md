# ADR: Integration Tests for Disabled and Readonly Field Typing

## Status
Proposed

## Date
2024

## Context

The task requires creating integration tests for disabled and readonly fields to verify that typing is properly blocked or handled. The acceptance criteria specify:
- Tests pass for: attempting to type in disabled input (should not change value)
- Tests pass for: attempting to type in readonly input (should not change value)
- Proper error or no-op behavior verification

### Existing Infrastructure Analysis

The form-integration test suite already has:
1. **Setup infrastructure** (`setup.ts`) - Provides `simulateTyping()` utility and DOM environment
2. **Typing simulator** (`utils/typing-simulator.ts`) - Advanced `TypingSimulator` class with keyboard events
3. **Input fixtures** (`fixtures/input-fixtures.ts`) - Pre-built HTML templates for various input types
4. **Vitest configuration** (`vitest.config.ts`) - Configured for jsdom environment
5. **Existing patterns** from `text-input-interactions.test.ts` and `checkbox-disabled-and-validation.test.ts`

### Key Findings

1. **Current simulateTyping behavior**: The existing `simulateTyping()` function in `setup.ts` directly modifies `input.value` without checking for `disabled` or `readOnly` attributes. This is by design for the simulator but means tests need to verify that proper browser behavior is being tested.

2. **TypingSimulator class**: Similarly modifies values directly via JavaScript, not through actual browser input handling.

3. **Gap identified**: While there are tests for disabled checkboxes, there are no dedicated comprehensive integration tests for typing behavior in disabled/readonly text inputs.

## Decision

### Technical Design

Create a new focused test file: `disabled-readonly-typing.integration.test.ts` in the `tests/form-integration/` directory.

#### Test Architecture

```
tests/form-integration/
├── disabled-readonly-typing.integration.test.ts  # NEW - Main test file
├── fixtures/
│   └── input-fixtures.ts  # EXTEND - Add disabled/readonly fixtures
├── utils/
│   └── typing-simulator.ts  # NO CHANGE - Use existing utilities
└── setup.ts  # NO CHANGE - Use existing setup
```

#### Test Structure

```typescript
// disabled-readonly-typing.integration.test.ts

describe('Disabled and Readonly Field Typing Integration Tests', () => {
  describe('Disabled Input Fields', () => {
    describe('Text Input - Disabled State', () => {
      // Test typing attempt does not change value
      // Test events are not fired or are properly handled
      // Test disabled attribute reflects correct state
    });

    describe('Email Input - Disabled State', () => { ... });
    describe('Password Input - Disabled State', () => { ... });
    describe('Textarea - Disabled State', () => { ... });
  });

  describe('Readonly Input Fields', () => {
    describe('Text Input - Readonly State', () => {
      // Test typing attempt does not change value
      // Test focus behavior (readonly CAN receive focus, unlike disabled)
      // Test selection and copy operations (should work)
    });

    describe('Textarea - Readonly State', () => { ... });
  });

  describe('Dynamic State Changes', () => {
    // Test changing from enabled to disabled
    // Test changing from enabled to readonly
    // Test value preservation during state changes
  });

  describe('Accessibility Verification', () => {
    // Test ARIA attributes
    // Test screen reader announcements
    // Test keyboard navigation behavior
  });
});
```

#### Key Testing Patterns

1. **Direct DOM Testing**: Use jsdom's actual `disabled` and `readOnly` property behavior
2. **Event Verification**: Verify that input events are not dispatched for disabled elements
3. **Behavior Comparison**: Test that disabled prevents ALL interaction while readonly allows focus/selection
4. **State Persistence**: Verify values are preserved when state changes

#### Fixture Extensions

Add to `fixtures/input-fixtures.ts`:

```typescript
export const disabledReadonlyFixtures = {
  disabledTextInput: `
    <form data-testid="disabled-form">
      <label for="disabled-input">Disabled Input</label>
      <input type="text" id="disabled-input" name="disabled-input"
             disabled value="Cannot modify this"
             data-testid="disabled-text-input" />
    </form>
  `,

  readonlyTextInput: `
    <form data-testid="readonly-form">
      <label for="readonly-input">Readonly Input</label>
      <input type="text" id="readonly-input" name="readonly-input"
             readonly value="Can select but not modify"
             data-testid="readonly-text-input" />
    </form>
  `,
  // ... additional fixtures
};
```

#### Testing Strategy

**Approach 1: Native Browser Behavior Verification**
- Use DOM's native `disabled` and `readOnly` properties
- Verify that jsdom correctly prevents value changes on disabled inputs
- Test that click events don't register on disabled elements

**Approach 2: Input Event Tracking**
- Set up event listeners before interaction attempts
- Verify that `input`, `change`, `keydown`, `keyup` events are properly suppressed/handled
- Track event counts to verify no-op behavior

**Approach 3: Value Integrity Checks**
- Capture initial value before any interaction
- Attempt typing/modification operations
- Verify value remains unchanged after operations

### Interface Contracts

```typescript
// Helper functions to be added to the test file

/**
 * Attempts to type in a disabled/readonly input and verifies no change occurs
 */
async function attemptTypingAndVerifyNoChange(
  input: HTMLInputElement | HTMLTextAreaElement,
  textToType: string
): Promise<{
  originalValue: string;
  finalValue: string;
  valueChanged: boolean;
  eventsDispatched: string[];
}>;

/**
 * Verifies the correct accessibility attributes for disabled state
 */
function verifyDisabledAccessibility(
  element: HTMLElement
): {
  hasAriaDisabled: boolean;
  isNativelyDisabled: boolean;
  canReceiveFocus: boolean;
};

/**
 * Verifies the correct behavior differences between disabled and readonly
 */
function verifyDisabledVsReadonlyBehavior(
  disabledInput: HTMLInputElement,
  readonlyInput: HTMLInputElement
): {
  disabledCanFocus: boolean;
  readonlyCanFocus: boolean;
  disabledCanSelect: boolean;
  readonlyCanSelect: boolean;
};
```

## Consequences

### Positive
- Comprehensive test coverage for disabled/readonly field typing behavior
- Follows existing test patterns and infrastructure
- Provides clear documentation of expected behaviors
- Reusable test utilities for future form control tests
- Accessibility verification included

### Negative
- jsdom may have slight differences from actual browser behavior
- Tests rely on synthetic events which may not perfectly mirror real user interaction

### Risks
- jsdom's handling of `disabled` attribute on value modification may differ from browsers
- Need to ensure the typing simulator respects disabled/readonly states

## Implementation Notes

### Files to Create/Modify
1. **CREATE**: `tests/form-integration/disabled-readonly-typing.integration.test.ts` - Main test file
2. **EXTEND**: `tests/form-integration/fixtures/input-fixtures.ts` - Add disabled/readonly fixtures

### Dependencies
- Vitest (existing)
- jsdom (existing via vitest config)
- Existing typing simulator utilities

### Test Count Estimate
- ~25-30 individual test cases covering:
  - 6 input types (text, email, password, url, tel, textarea) x 2 states (disabled, readonly)
  - Dynamic state change tests (~5)
  - Accessibility tests (~5)
  - Edge cases (~5)

## References
- Existing test: `checkbox-disabled-and-validation.test.ts` - Pattern for disabled state testing
- Existing test: `text-input-interactions.test.ts` - Pattern for typing tests
- Browser integration tests in `tests/browser-integration/edge-cases.test.ts` - Shows expected error behavior
