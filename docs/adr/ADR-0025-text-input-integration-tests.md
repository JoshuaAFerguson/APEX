# ADR-0025: Text Input Field Integration Tests

## Status

Proposed

## Date

2025-02-07

## Context

The APEX browser automation package (`@apex/browser`) needs comprehensive integration tests for text input field interactions. The current test suite (`element-interaction-actions.test.ts`) covers basic typing functionality, but lacks focused integration tests specifically for standard text input scenarios.

The acceptance criteria requires tests for:
1. Typing text into empty input fields
2. Typing into inputs with existing values
3. Verifying `input.value` reflects typed content
4. Testing focus behavior before typing

## Decision

### Technical Design

#### 1. Test File Location and Structure

Create a new integration test file:
```
packages/browser/src/__tests__/text-input-integration.test.ts
```

This follows the existing naming convention established by:
- `element-interaction-actions.test.ts`
- `browser-automation-integration-e2e.test.ts`
- `navigation-integration-html-fixture.test.ts`

#### 2. Test Architecture

The tests will use the established `BrowserSession` class from `browser-session.ts` which provides:
- `type(selector, text, options)` - Types text into an element (clears first then types)
- `focus(selector, options)` - Focuses on an element
- `evaluate(script)` - Evaluates JavaScript to verify input values
- `click(selector, options)` - For interaction testing

**Key Implementation Details from Browser Session:**

The `type()` method (lines 578-615 in `browser-session.ts`):
1. Validates browser is launched
2. Normalizes selector (supports CSS, XPath, text, role, testId)
3. Calls `page.fill()` to clear input
4. Calls `page.type()` to type text character-by-character
5. Returns `BrowserActionResult<void>` with success/error/duration

The `focus()` method (lines 706-739):
1. Validates browser is launched
2. Normalizes selector
3. Calls `page.focus()` with timeout option
4. Returns `BrowserActionResult<void>`

#### 3. Test Categories and Scenarios

##### Category 1: Typing into Empty Inputs
```typescript
describe('Typing into empty text inputs', () => {
  // Test basic text input
  // Test textarea
  // Test email input type
  // Test password input type
  // Test search input type
  // Test URL input type
  // Test tel input type
})
```

##### Category 2: Typing into Pre-filled Inputs
```typescript
describe('Typing into inputs with existing values', () => {
  // Test appending to existing value (without clear option)
  // Test replacing existing value (with clear: true - default behavior)
  // Test handling different initial value types (numbers, special chars)
})
```

##### Category 3: Value Verification
```typescript
describe('Verifying input.value reflects typed content', () => {
  // Test immediate value reflection
  // Test value after special characters
  // Test value after unicode/emoji
  // Test value event triggering
})
```

##### Category 4: Focus Behavior
```typescript
describe('Focus behavior before typing', () => {
  // Test explicit focus then type
  // Test implicit focus during type (auto-focus)
  // Test focus events fired correctly
  // Test blur events when switching inputs
  // Test tabindex focus order
})
```

#### 4. HTML Fixtures Strategy

Use inline `data:text/html,` URLs following the pattern in existing tests:

```typescript
const inputFixture = `
  <form id="test-form">
    <input id="empty-text" type="text" placeholder="Enter text">
    <input id="prefilled-text" type="text" value="Existing Value">
    <input id="email-input" type="email">
    <input id="password-input" type="password">
    <textarea id="text-area" rows="3" cols="30"></textarea>
  </form>
  <script>
    // Event tracking for verification
    window.focusEvents = [];
    window.inputEvents = [];
    document.querySelectorAll('input, textarea').forEach(el => {
      el.addEventListener('focus', e => window.focusEvents.push({target: e.target.id, time: Date.now()}));
      el.addEventListener('input', e => window.inputEvents.push({target: e.target.id, value: e.target.value}));
    });
  </script>
`;
```

#### 5. Key Test Assertions

Following the existing pattern with `BrowserActionResult`:

```typescript
// Success assertion
const result = await session.type('#input', 'test');
expect(result.success).toBe(true);
expect(result.duration).toBeGreaterThan(0);

// Value verification using evaluate
const value = await session.evaluate(() =>
  (document.getElementById('input') as HTMLInputElement).value
);
expect(value.data).toBe('test');

// Focus verification
const focusResult = await session.focus('#input');
expect(focusResult.success).toBe(true);

// Document activeElement check
const activeId = await session.evaluate(() => document.activeElement?.id);
expect(activeId.data).toBe('input');
```

#### 6. Dependencies

The test file will import:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
```

#### 7. Test Lifecycle

Following the established pattern:
```typescript
describe('Text Input Integration Tests', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(async () => {
    manager = new BrowserManager();
    session = new BrowserSession(manager, {
      browserType: 'chromium',
      headless: true
    });
    await session.launch();
  });

  afterEach(async () => {
    if (session) {
      await session.close();
    }
    if (manager) {
      await manager.shutdown();
    }
  });

  // Test cases...
});
```

### Interface Contract

The tests will verify the following contracts from `browser-session.ts`:

| Method | Input | Output | Side Effect |
|--------|-------|--------|-------------|
| `type()` | selector: string \| ElementSelector, text: string, options?: {timeout?, delay?} | BrowserActionResult<void> | Clears input, types text |
| `focus()` | selector: string \| ElementSelector, options?: {timeout?} | BrowserActionResult<void> | Focuses element |
| `evaluate()` | script: string \| Function | BrowserActionResult<T> | Executes JS in browser |

### Edge Cases to Cover

1. **Empty string typing** - Type empty string into input
2. **Whitespace only** - Type spaces, tabs, newlines
3. **Special characters** - `!@#$%^&*()_+-=[]{}|;':\",./<>?`
4. **Unicode characters** - Chinese, Japanese, Arabic, emojis
5. **Very long strings** - 10000+ characters
6. **Input with maxlength** - Verify truncation behavior
7. **Readonly inputs** - Should fail gracefully
8. **Disabled inputs** - Should fail gracefully
9. **Hidden inputs** - Should fail gracefully
10. **Inputs not in DOM yet** - Test with wait

### Performance Considerations

- Each test should complete within 10 seconds
- Use `headless: true` for faster execution
- Minimize DOM complexity in fixtures
- Reuse browser session within describe blocks where possible

## Consequences

### Positive

1. **Comprehensive coverage** of text input interactions
2. **Aligned with existing patterns** in the codebase
3. **Clear acceptance criteria** mapping to test cases
4. **Reusable test patterns** for future form testing
5. **Validates BrowserSession contract** for typing operations

### Negative

1. **Additional test file** increases test suite size
2. **Browser dependency** requires Playwright and Chromium
3. **Slower tests** compared to unit tests (requires real browser)

### Neutral

1. Tests run in `vitest` alongside existing tests
2. Same CI/CD pipeline handles these tests
3. Uses same `BrowserSession` API as other browser tests

## Implementation Plan

1. Create `text-input-integration.test.ts`
2. Implement Category 1: Empty input tests
3. Implement Category 2: Pre-filled input tests
4. Implement Category 3: Value verification tests
5. Implement Category 4: Focus behavior tests
6. Run `npm run build` to verify TypeScript compilation
7. Run `npm run test` to verify all tests pass
8. Document any discovered edge cases

## Related

- `packages/browser/src/__tests__/element-interaction-actions.test.ts` - Existing element tests
- `packages/browser/src/__tests__/browser-session.test.ts` - Session lifecycle tests
- `packages/browser/src/browser-session.ts` - Implementation under test
