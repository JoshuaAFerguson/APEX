# ADR: Type/Input Interactions Integration Tests Architecture

## Status
Accepted (Architecture Stage Complete)

## Context

APEX requires comprehensive integration tests for type/input interactions to validate browser automation capabilities for text input scenarios. The task is to create integration tests covering:

- Text input fields
- Password fields
- Textareas
- Content-editable divs
- Special key combinations (Enter, Tab, Escape)
- Clearing existing text
- Typing in disabled/readonly fields

### Acceptance Criteria
Integration tests must pass for type interactions including:
- Text input fields with standard typing
- Password fields (masked input handling)
- Textareas (multi-line text input)
- Content-editable divs (rich text editing)
- Special key combinations (Enter, Tab, Escape)
- Clearing existing text before typing
- Proper error handling for disabled/readonly fields

## Decision

### 1. Test File Location and Structure

```
tests/browser-integration/element-interaction-tests/
├── type-interactions.integration.test.ts    # Main test file
└── fixtures/
    └── type-interaction-test-page.html      # HTML fixture for tests
```

This follows the existing pattern established in `docs/adr/ADR-element-interaction-tests.md` and aligns with the test infrastructure in `tests/browser-integration/`.

### 2. Test Categories and Coverage Matrix

#### 2.1 Text Input Fields
| Test Case | Description | Selector Pattern |
|-----------|-------------|------------------|
| Type into text input | Standard `input[type="text"]` | `#text-input` |
| Type into email input | Email validation-aware input | `#email-input` |
| Type into tel input | Telephone input | `#tel-input` |
| Type into url input | URL input | `#url-input` |
| Type into search input | Search input | `#search-input` |
| Type into number input | Numeric input | `#number-input` |

#### 2.2 Password Fields
| Test Case | Description | Coverage |
|-----------|-------------|----------|
| Type into password field | Masked input handling | Core functionality |
| Verify password is masked | Visual masking verification | Security |
| Copy/paste restriction | Browser security behavior | Edge case |

#### 2.3 Textareas
| Test Case | Description | Coverage |
|-----------|-------------|----------|
| Type into textarea | Multi-line text input | Core functionality |
| Type with line breaks | `\n` character handling | Multi-line |
| Type long content | Overflow and scrolling | Edge case |
| Preserve whitespace | Tab and space handling | Formatting |

#### 2.4 Content-Editable Elements
| Test Case | Description | Coverage |
|-----------|-------------|----------|
| Type into contenteditable div | Rich text editing | Core functionality |
| Type into contenteditable span | Inline editing | Variant |
| Preserve HTML structure | Rich content handling | Edge case |
| Type with contenteditable="true" attribute | Attribute-based editing | Standard |

#### 2.5 Special Key Combinations
| Test Case | Description | Key Combination |
|-----------|-------------|-----------------|
| Enter key submission | Form submit trigger | `Enter` |
| Tab navigation | Focus next element | `Tab` |
| Shift+Tab navigation | Focus previous element | `Shift+Tab` |
| Escape key blur | Unfocus element | `Escape` |
| Ctrl+A select all | Select all text | `Ctrl+A` |
| Ctrl+C copy | Copy to clipboard | `Ctrl+C` |
| Ctrl+V paste | Paste from clipboard | `Ctrl+V` |
| Backspace delete | Delete character | `Backspace` |
| Delete forward | Delete forward | `Delete` |
| Arrow key navigation | Cursor movement | `ArrowLeft`, `ArrowRight` |

#### 2.6 Clearing Existing Text
| Test Case | Description | Coverage |
|-----------|-------------|----------|
| Clear and type (clearFirst option) | BrowserTool clearFirst param | Core functionality |
| Triple-click select all | Native selection method | Alternative method |
| Ctrl+A and type | Replace all content | Alternative method |
| Empty string fill | Clear via empty fill | Edge case |

#### 2.7 Disabled/Readonly Fields
| Test Case | Description | Expected Behavior |
|-----------|-------------|-------------------|
| Type into disabled input | `disabled` attribute | Should fail gracefully |
| Type into readonly input | `readonly` attribute | Should fail gracefully |
| Type into dynamically disabled | JavaScript-disabled | Should fail gracefully |
| Verify error messages | Error handling | Clear error messages |

### 3. Integration with Existing Infrastructure

#### 3.1 Import Structure
```typescript
// Core test framework
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Playwright types
import { Browser, BrowserContext, Page } from 'playwright';

// Existing test infrastructure from tests/browser-integration/setup.ts
import {
  createBrowser,
  createBrowserContext,
  createPage,
  captureScreenshot,
  DEFAULT_BROWSER_CONFIG,
} from '../setup.js';

// Existing utilities from tests/browser-integration/utils/test-helpers.ts
import {
  safeClick,
  safeFill,
  waitForElement,
  takeScreenshot,
  captureConsoleMessages,
  capturePageErrors,
  withBrowserTest,
} from '../utils/test-helpers.js';
```

#### 3.2 Test Setup Pattern
Following the pattern established in `form-control-interactions.integration.test.ts`:

```typescript
describe('Type/Input Interactions Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let tempDir: string;
  let testPagePath: string;

  beforeAll(async () => {
    browser = await createBrowser();
    context = await createBrowserContext(browser);
    page = await createPage(context);
    tempDir = globalThis.browserTestContext.tempDir!;
    testPagePath = path.resolve(__dirname, 'fixtures', 'type-interaction-test-page.html');
    await fs.access(testPagePath);
  });

  afterAll(async () => {
    await page?.close();
    await context?.close();
    await browser?.close();
  });

  beforeEach(async () => {
    await page.goto(`file://${testPagePath}`);
    await page.waitForLoadState('domcontentloaded');
  });
});
```

### 4. HTML Test Fixture Design

The fixture (`type-interaction-test-page.html`) provides:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>APEX Type Interaction Test Page</title>
  <style>
    /* Consistent styling for test visibility */
    .form-group { margin: 15px 0; }
    .error { color: red; font-size: 0.9em; }
    [contenteditable] { border: 1px solid #ccc; padding: 10px; min-height: 50px; }
    input:disabled, textarea:disabled { background: #f0f0f0; }
    input:read-only, textarea:read-only { background: #f5f5f5; }
  </style>
</head>
<body>
  <div id="test-container">
    <!-- Section 1: Text Input Fields -->
    <section id="text-inputs">
      <input type="text" id="text-input" placeholder="Text input">
      <input type="email" id="email-input" placeholder="Email input">
      <input type="tel" id="tel-input" placeholder="Tel input">
      <input type="url" id="url-input" placeholder="URL input">
      <input type="search" id="search-input" placeholder="Search input">
      <input type="number" id="number-input" placeholder="Number input">
    </section>

    <!-- Section 2: Password Fields -->
    <section id="password-inputs">
      <input type="password" id="password-input" placeholder="Password">
    </section>

    <!-- Section 3: Textareas -->
    <section id="textarea-inputs">
      <textarea id="textarea" rows="4" placeholder="Textarea"></textarea>
      <textarea id="textarea-prefilled" rows="4">Existing content</textarea>
    </section>

    <!-- Section 4: Content-Editable Elements -->
    <section id="contenteditable-elements">
      <div id="editable-div" contenteditable="true">Edit this div</div>
      <span id="editable-span" contenteditable="true">Edit this span</span>
      <div id="editable-empty" contenteditable="true"></div>
    </section>

    <!-- Section 5: Disabled/Readonly Fields -->
    <section id="disabled-readonly">
      <input type="text" id="disabled-input" disabled value="Disabled">
      <input type="text" id="readonly-input" readonly value="Readonly">
      <textarea id="disabled-textarea" disabled>Disabled textarea</textarea>
      <textarea id="readonly-textarea" readonly>Readonly textarea</textarea>
    </section>

    <!-- Section 6: Form for Enter Key Testing -->
    <form id="enter-test-form" onsubmit="return handleSubmit(event)">
      <input type="text" id="form-input" placeholder="Press Enter to submit">
      <div id="submit-status"></div>
    </form>

    <!-- Event Log for Verification -->
    <div id="event-log"></div>
  </div>

  <script>
    // Event logging for test verification
    const eventLog = document.getElementById('event-log');

    function logEvent(type, target, detail = '') {
      const entry = document.createElement('div');
      entry.className = 'event-entry';
      entry.dataset.eventType = type;
      entry.dataset.target = target;
      entry.textContent = `[${new Date().toISOString()}] ${type}: ${target} ${detail}`;
      eventLog.appendChild(entry);
      console.log(`Event: ${type} on ${target} ${detail}`);
    }

    // Track input events
    document.querySelectorAll('input, textarea, [contenteditable]').forEach(el => {
      el.addEventListener('input', (e) => logEvent('input', e.target.id, e.data || ''));
      el.addEventListener('focus', (e) => logEvent('focus', e.target.id));
      el.addEventListener('blur', (e) => logEvent('blur', e.target.id));
      el.addEventListener('keydown', (e) => logEvent('keydown', e.target.id, e.key));
      el.addEventListener('keyup', (e) => logEvent('keyup', e.target.id, e.key));
    });

    // Form submission handler
    function handleSubmit(event) {
      event.preventDefault();
      document.getElementById('submit-status').textContent = 'Form submitted via Enter!';
      logEvent('submit', 'enter-test-form');
      return false;
    }

    console.log('Type interaction test page loaded');
  </script>
</body>
</html>
```

### 5. Test Implementation Approach

#### 5.1 BrowserTool Type Operation
The `BrowserTool.execute()` method with `operation: 'type'` supports:
- `selector`: Target element CSS selector
- `text`: Text to type
- `delay`: Keystroke delay in milliseconds
- `clearFirst`: Boolean to clear existing content

From `packages/orchestrator/src/tools/browser-tool.ts`:
```typescript
export interface BrowserTypeParams {
  selector: string;
  text: string;
  delay?: number;
  clearFirst?: boolean;
}
```

#### 5.2 Direct Playwright API Usage
For more granular control and special key handling:
```typescript
// Type with delay
await page.type('#input', 'text', { delay: 100 });

// Fill (faster, no events per character)
await page.fill('#input', 'text');

// Special keys via keyboard
await page.keyboard.press('Enter');
await page.keyboard.press('Tab');
await page.keyboard.press('Escape');

// Key combinations
await page.keyboard.down('Control');
await page.keyboard.press('a');
await page.keyboard.up('Control');
```

### 6. Key Test Scenarios

#### 6.1 Standard Text Input Test
```typescript
it('should type text into standard input field', async () => {
  await withBrowserTest(async (page) => {
    const input = await waitForElement(page, '#text-input', { visible: true, enabled: true });

    // Verify initial state
    const initialValue = await input.inputValue();
    expect(initialValue).toBe('');

    // Type text
    await input.fill('Hello World');

    // Verify typed text
    const typedValue = await input.inputValue();
    expect(typedValue).toBe('Hello World');

    // Verify input event was fired
    const hasInputEvent = await page.locator('.event-entry[data-event-type="input"]').count();
    expect(hasInputEvent).toBeGreaterThan(0);

    await takeScreenshot(page, 'text-input-typed', tempDir);
  }, page);
});
```

#### 6.2 Content-Editable Test
```typescript
it('should type into contenteditable div', async () => {
  await withBrowserTest(async (page) => {
    const editableDiv = await waitForElement(page, '#editable-div', { visible: true });

    // Clear existing content and type new text
    await editableDiv.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('New editable content');

    // Verify content
    const content = await editableDiv.textContent();
    expect(content).toBe('New editable content');

    await takeScreenshot(page, 'contenteditable-typed', tempDir);
  }, page);
});
```

#### 6.3 Special Key Test
```typescript
it('should handle Enter key for form submission', async () => {
  await withBrowserTest(async (page) => {
    const formInput = await waitForElement(page, '#form-input', { visible: true });

    // Type text and press Enter
    await formInput.fill('Test input');
    await page.keyboard.press('Enter');

    // Wait for form submission handling
    await page.waitForTimeout(100);

    // Verify form was submitted
    const submitStatus = await page.locator('#submit-status').textContent();
    expect(submitStatus).toContain('Form submitted');

    await takeScreenshot(page, 'enter-key-submit', tempDir);
  }, page);
});
```

#### 6.4 Disabled Field Error Handling Test
```typescript
it('should fail gracefully when typing into disabled input', async () => {
  await withBrowserTest(async (page) => {
    const disabledInput = await waitForElement(page, '#disabled-input', { visible: true });

    // Verify element is disabled
    const isDisabled = await disabledInput.isDisabled();
    expect(isDisabled).toBe(true);

    // Attempt to type should fail
    try {
      await disabledInput.fill('Should not type');
      // If we get here, the test should fail
      expect(true).toBe(false);
    } catch (error) {
      // Expected behavior - element not interactable
      expect(error.message).toMatch(/disabled|not.*(editable|interactable)/i);
    }

    // Verify value unchanged
    const value = await disabledInput.inputValue();
    expect(value).toBe('Disabled');

    await takeScreenshot(page, 'disabled-input-error', tempDir);
  }, page);
});
```

### 7. Dependencies and Prerequisites

#### 7.1 Required Files
- `tests/browser-integration/setup.ts` - Global browser setup (exists)
- `tests/browser-integration/utils/test-helpers.ts` - Test utilities (exists)
- `tests/browser-integration/element-interaction-tests/` - Directory to create
- `type-interaction-test-page.html` - HTML fixture to create
- `type-interactions.integration.test.ts` - Main test file to create

#### 7.2 NPM Scripts
Tests will run via existing configuration:
```bash
npm run test -- --filter="type-interactions"
```

#### 7.3 Vitest Configuration
The existing `tests/browser-integration/vitest.config.ts` already includes patterns for `*.integration.test.ts` files.

### 8. Success Criteria

All tests must pass covering:
- [x] Text input fields (text, email, tel, url, search, number)
- [x] Password fields with masking verification
- [x] Textareas with multi-line support
- [x] Content-editable divs and spans
- [x] Enter key form submission
- [x] Tab key navigation between fields
- [x] Escape key blur/unfocus
- [x] Clear existing text (clearFirst option)
- [x] Disabled field error handling
- [x] Readonly field error handling

### 9. Test Execution Order

1. **Setup**: Browser launch, context creation, page navigation
2. **Input Type Tests**: Text, email, password, textarea
3. **Contenteditable Tests**: Div, span, empty elements
4. **Special Key Tests**: Enter, Tab, Escape, key combinations
5. **Clear Text Tests**: clearFirst, select-all-and-type
6. **Error Handling Tests**: Disabled, readonly, invalid selectors
7. **Teardown**: Screenshot capture, resource cleanup

## Consequences

### Positive
- Comprehensive coverage of all type/input interaction scenarios
- Reuses existing test infrastructure (setup.ts, test-helpers.ts)
- Follows established patterns from form-control-interactions.integration.test.ts
- Clear separation between input types and special behaviors
- Validates both BrowserTool and direct Playwright API usage

### Negative
- Browser tests are inherently slower than unit tests
- Requires Playwright browsers to be installed
- Timing-sensitive tests may be flaky in CI environments
- Additional maintenance burden for HTML fixtures

### Risks
- Browser version differences may cause inconsistent behavior
- Content-editable handling varies across browsers
- Special key handling may differ on macOS (Cmd vs Ctrl)
- CI environment may have different keyboard locale settings

## Implementation Notes

### File Locations
- Tests: `tests/browser-integration/element-interaction-tests/type-interactions.integration.test.ts`
- Fixtures: `tests/browser-integration/element-interaction-tests/fixtures/type-interaction-test-page.html`
- ADR: `docs/adr/ADR-type-input-interactions-tests.md` (this file)

### Dependencies on Other Stages
- **Previous Stage (Planning)**: Identified scope and acceptance criteria
- **Current Stage (Architecture)**: This document defines technical approach
- **Next Stage (Development)**: Will implement test files per this design
- **Testing Stage**: Will verify all tests pass
- **Review Stage**: Will validate test coverage completeness

### Cross-References
- `packages/orchestrator/src/tools/browser-tool.ts` - BrowserTool implementation
- `packages/browser/src/__tests__/element-interaction-actions.test.ts` - Unit test patterns
- `tests/browser-integration/form-control-interactions.integration.test.ts` - Integration test pattern
- `tests/browser-integration/setup.ts` - Test infrastructure
- `docs/adr/ADR-element-interaction-tests.md` - Related ADR for element interactions
