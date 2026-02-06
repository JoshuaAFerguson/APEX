# ADR-0030: Type/Input Interactions Integration Tests Architecture

## Status
Proposed

## Context
We need to create integration tests for type/input interactions as part of the browser automation test suite. The tests must cover typing in text inputs, textareas, content-editable elements, and handling of special keys according to the acceptance criteria.

### Acceptance Criteria
Integration tests must pass for type interactions including:
- Text input fields
- Password fields
- Textareas
- Content-editable divs
- Special key combinations (Enter, Tab, Escape)
- Clearing existing text
- Typing in disabled/readonly fields

## Decision

### Test File Structure

Create a new integration test file at:
```
tests/browser-integration/element-interaction-tests/type-interactions.integration.test.ts
```

And a corresponding HTML fixture at:
```
tests/browser-integration/element-interaction-tests/fixtures/type-interaction-test-page.html
```

### Test Architecture

The tests will follow the established patterns in the codebase:
1. Use Vitest as the test framework
2. Use Playwright for browser automation
3. Leverage existing test utilities from `utils/test-helpers.ts`
4. Follow the setup patterns from `setup.ts`

### Test Categories and Coverage

#### 1. Basic Text Input Interactions
- **Test Cases:**
  - Type text into standard text input
  - Verify character-by-character typing simulation
  - Type into input with placeholder text
  - Type into input with maxlength attribute
  - Verify input value after typing
  - Handle input events (input, change, keydown, keyup)

#### 2. Password Field Interactions
- **Test Cases:**
  - Type into password fields
  - Verify masked input display
  - Paste into password fields
  - Clear and retype password
  - Toggle password visibility and verify typing behavior

#### 3. Textarea Interactions
- **Test Cases:**
  - Type multi-line text
  - Handle Enter key for new lines
  - Type at cursor position
  - Handle textarea with rows/cols constraints
  - Test word wrap behavior during typing

#### 4. Content-Editable Elements
- **Test Cases:**
  - Type into contenteditable div
  - Type into contenteditable span
  - Handle rich text formatting context
  - Type at different cursor positions
  - Handle nested contenteditable elements

#### 5. Special Key Combinations
- **Test Cases:**
  - Enter key (submit forms, create new lines)
  - Tab key (focus navigation, preserve tab in textareas)
  - Escape key (cancel input, blur focus)
  - Arrow keys (cursor movement)
  - Ctrl/Cmd+A (select all)
  - Ctrl/Cmd+C (copy)
  - Ctrl/Cmd+V (paste)
  - Ctrl/Cmd+Z (undo)
  - Backspace and Delete keys
  - Home/End keys

#### 6. Clearing Existing Text
- **Test Cases:**
  - Clear input using clear() method
  - Select all and type to replace
  - Triple-click select and replace
  - Backspace to clear
  - Programmatic value reset during typing

#### 7. Disabled/Readonly Fields
- **Test Cases:**
  - Attempt typing in disabled input (should fail)
  - Attempt typing in readonly input (should fail)
  - Verify no input events fire on disabled fields
  - Verify field state after attempted typing
  - Handle dynamically disabled/readonly fields

#### 8. Edge Cases and Error Handling
- **Test Cases:**
  - Type special characters (unicode, emojis)
  - Type very long strings
  - Rapid typing stress test
  - Type during DOM mutations
  - Handle input validation errors during typing
  - Type with IME input methods
  - Handle auto-complete suggestions

### HTML Test Page Structure

```html
<!DOCTYPE html>
<html>
<head>
    <title>Type Interactions Test Page</title>
</head>
<body>
    <div id="type-test-container">
        <!-- Basic Inputs Section -->
        <section id="basic-inputs">
            <input type="text" id="text-input" />
            <input type="text" id="placeholder-input" placeholder="Enter text" />
            <input type="text" id="maxlength-input" maxlength="10" />
            <input type="text" id="prefilled-input" value="existing text" />
        </section>

        <!-- Password Section -->
        <section id="password-inputs">
            <input type="password" id="password-input" />
            <input type="password" id="password-with-toggle" />
        </section>

        <!-- Textarea Section -->
        <section id="textarea-inputs">
            <textarea id="basic-textarea"></textarea>
            <textarea id="constrained-textarea" rows="3" cols="30"></textarea>
        </section>

        <!-- Contenteditable Section -->
        <section id="contenteditable-inputs">
            <div id="editable-div" contenteditable="true"></div>
            <span id="editable-span" contenteditable="true"></span>
        </section>

        <!-- Special States Section -->
        <section id="special-states">
            <input type="text" id="disabled-input" disabled />
            <input type="text" id="readonly-input" readonly value="readonly" />
        </section>

        <!-- Event Log -->
        <div id="event-log"></div>
    </div>

    <script>
        // Event logging for test verification
        window.typeTestUtils = {
            eventLog: [],
            logEvent(type, target, data) {
                this.eventLog.push({ type, targetId: target.id, data, timestamp: Date.now() });
            },
            getEventLog() { return this.eventLog; },
            clearEventLog() { this.eventLog = []; }
        };

        // Attach event listeners to all inputs
        document.querySelectorAll('input, textarea, [contenteditable]').forEach(el => {
            ['keydown', 'keyup', 'keypress', 'input', 'change', 'focus', 'blur'].forEach(eventType => {
                el.addEventListener(eventType, (e) => {
                    window.typeTestUtils.logEvent(eventType, e.target, {
                        key: e.key,
                        value: e.target.value || e.target.textContent
                    });
                });
            });
        });
    </script>
</body>
</html>
```

### Test Implementation Pattern

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import { createBrowser, createBrowserContext, createPage, captureScreenshot } from '../../setup.js';
import { waitForElement, safeClick, safeFill, takeScreenshot, withBrowserTest } from '../../utils/test-helpers.js';

describe('Type Interactions Integration Tests', () => {
    let browser: Browser;
    let context: BrowserContext;
    let page: Page;
    let testPagePath: string;
    let tempDir: string;

    beforeAll(async () => {
        browser = await createBrowser();
        context = await createBrowserContext(browser);
        tempDir = globalThis.browserTestContext.tempDir!;
        testPagePath = `file://${path.join(__dirname, 'fixtures', 'type-interaction-test-page.html')}`;
    });

    afterAll(async () => {
        await context?.close();
        await browser?.close();
    });

    beforeEach(async () => {
        page = await createPage(context);
        await page.goto(testPagePath);
        await page.waitForSelector('#type-test-container');
        await page.evaluate(() => window.typeTestUtils?.clearEventLog());
    });

    afterEach(async () => {
        await page?.close();
    });

    // Test implementations follow patterns from existing tests...
});
```

### Key Playwright APIs to Use

1. **page.fill(selector, text)** - Clear and fill input
2. **page.type(selector, text)** - Type character by character
3. **page.press(selector, key)** - Press specific key
4. **page.keyboard.type(text)** - Type without selector
5. **page.keyboard.press(key)** - Press key without selector
6. **locator.clear()** - Clear input value
7. **locator.fill(text)** - Fill with text
8. **locator.type(text)** - Type text
9. **locator.inputValue()** - Get input value

### Test Utilities to Add

```typescript
/**
 * Safely types text into an element with verification
 */
export async function safeType(
    page: Page,
    selector: string,
    text: string,
    options: { delay?: number; verify?: boolean } = {}
): Promise<void> {
    const element = await waitForElement(page, selector, {
        visible: true,
        enabled: true,
    });

    await element.type(text, { delay: options.delay ?? 50 });

    if (options.verify ?? true) {
        const actualValue = await element.inputValue();
        if (!actualValue.includes(text)) {
            throw new Error(`Failed to type "${text}" into "${selector}"`);
        }
    }
}

/**
 * Types into contenteditable element
 */
export async function typeInContentEditable(
    page: Page,
    selector: string,
    text: string
): Promise<void> {
    const element = await waitForElement(page, selector, { visible: true });
    await element.focus();
    await page.keyboard.type(text);
}

/**
 * Clears input using keyboard shortcuts
 */
export async function clearWithKeyboard(
    page: Page,
    selector: string
): Promise<void> {
    await page.click(selector);
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
}
```

### Integration with Existing Test Infrastructure

1. **Uses existing setup.ts** - Browser lifecycle management
2. **Uses existing test-helpers.ts** - Common utilities
3. **Uses globalThis.browserTestContext** - Shared test context
4. **Uses takeScreenshot** - Test artifact capture
5. **Uses withBrowserTest** - Test wrapper with cleanup

### File Dependencies

```
tests/browser-integration/
├── setup.ts                          # Browser setup (existing)
├── utils/
│   └── test-helpers.ts               # Test utilities (existing)
├── element-interaction-tests/
│   ├── click-interactions.integration.test.ts   # (existing)
│   ├── type-interactions.integration.test.ts    # (NEW)
│   └── fixtures/
│       ├── element-interaction-test-page.html   # (existing)
│       └── type-interaction-test-page.html      # (NEW)
```

## Consequences

### Positive
- Comprehensive coverage of all type/input interaction scenarios
- Follows established testing patterns in the codebase
- Reuses existing test infrastructure
- Provides reliable regression testing for browser automation
- Clear test structure and organization

### Negative
- Requires HTML fixture maintenance alongside tests
- Browser tests have longer execution time than unit tests
- Platform-specific keyboard handling may need special attention

### Neutral
- Additional test utilities will be added to test-helpers.ts
- Test page includes JavaScript for event logging

## Implementation Notes

1. **Priority Order**: Implement test categories in this order:
   - Basic text inputs (most common use case)
   - Special keys (critical for form submission)
   - Textareas and password fields
   - Content-editable elements
   - Edge cases and error handling

2. **Special Considerations**:
   - macOS uses Cmd instead of Ctrl for shortcuts
   - Some browsers handle IME differently
   - contenteditable behavior varies between browsers

3. **Performance**: Use `delay` option sparingly in tests; only when simulating real user typing speed is necessary for the test scenario.

## References

- Existing test: `tests/browser-integration/form-control-interactions.integration.test.ts`
- Existing test: `tests/browser-integration/element-interaction-tests/click-interactions.integration.test.ts`
- Playwright keyboard API: https://playwright.dev/docs/api/class-keyboard
- Playwright input API: https://playwright.dev/docs/input
