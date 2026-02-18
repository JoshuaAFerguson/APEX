# Architecture Decision Record: Browser Form Handling Integration Tests

## ADR-001: Form Handling Integration Test Architecture

**Date**: 2024
**Status**: Proposed
**Deciders**: APEX Architecture Team

---

## Context

The `@apex/browser` package needs comprehensive integration tests for browser form handling scenarios. Based on the acceptance criteria, we need to test:

1. Text/number/checkbox/radio inputs
2. Form validation errors
3. Form submission with various methods (GET/POST)
4. File upload handling
5. Dynamic form elements

## Decision

### Test File Location and Structure

Create a new test file at:
```
packages/browser/src/__tests__/form-handling-integration.test.ts
```

### Test Organization

The test file will be organized into the following describe blocks matching the acceptance criteria:

```typescript
describe('Form Handling Integration Tests', () => {
  describe('Text and Number Inputs', () => {
    // Text input typing
    // Number input validation
    // Input clearing and overwriting
    // Placeholder behavior
    // maxlength/minlength constraints
  });

  describe('Checkbox Inputs', () => {
    // Single checkbox check/uncheck
    // Checkbox groups
    // Initial checked state
    // Disabled checkbox handling
  });

  describe('Radio Inputs', () => {
    // Single radio selection
    // Radio group switching
    // Default selected state
    // Disabled radio handling
  });

  describe('Select/Dropdown Elements', () => {
    // Single select
    // Multi-select (if needed)
    // Option groups
    // Dynamic option loading
  });

  describe('Form Validation Errors', () => {
    // HTML5 validation (required, pattern, min, max)
    // Custom validation messages
    // Validation state detection
    // Invalid input styling detection
  });

  describe('Form Submission Methods', () => {
    // GET method submission
    // POST method submission
    // Form action handling
    // Submit button detection
    // FormData construction verification
  });

  describe('File Upload Handling', () => {
    // Single file upload
    // Multiple file upload
    // File type restrictions
    // File size handling
  });

  describe('Dynamic Form Elements', () => {
    // Dynamically added inputs
    // Conditionally shown fields
    // Form field removal
    // Real-time validation
  });
});
```

### Technical Approach

#### 1. Use Existing BrowserSession Methods

Leverage the existing `BrowserSession` class methods:
- `type(selector, text)` - For text input
- `click(selector)` - For checkboxes, radios, submit buttons
- `evaluate(script)` - For verifying form state and executing custom validation checks
- `navigate(url)` - For loading test HTML fixtures
- `waitForElement(selector)` - For dynamic elements

#### 2. Test Fixture Strategy

Use `data:text/html,` URLs for test fixtures to avoid external dependencies:

```typescript
const testHtml = `
  data:text/html,
  <form id="testForm" method="POST" action="/submit">
    <input type="text" id="name" name="name" required />
    <input type="number" id="age" name="age" min="0" max="120" />
    <input type="checkbox" id="agree" name="agree" />
    <input type="radio" name="color" value="red" />
    <input type="radio" name="color" value="blue" />
    <select id="country" name="country">
      <option value="">Select...</option>
      <option value="us">United States</option>
    </select>
    <input type="file" id="avatar" name="avatar" />
    <button type="submit">Submit</button>
  </form>
`;
```

#### 3. Form Validation Testing

For HTML5 validation:
```typescript
// Check validation state via evaluate
const isValid = await session.evaluate(`
  document.getElementById('testForm').checkValidity()
`);

// Get validation message
const validationMessage = await session.evaluate(`
  document.getElementById('name').validationMessage
`);
```

#### 4. Form Submission Testing

Intercept form submissions to verify behavior:
```typescript
// Prevent actual navigation, capture form data
const testHtml = `
  <form id="testForm" onsubmit="captureSubmit(event)">
    ...
  </form>
  <script>
    window.submittedData = null;
    function captureSubmit(e) {
      e.preventDefault();
      const formData = new FormData(e.target);
      window.submittedData = Object.fromEntries(formData.entries());
    }
  </script>
`;

// After form submission
const submittedData = await session.evaluate(`window.submittedData`);
```

#### 5. File Upload Testing

Use Playwright's `setInputFiles` via page object:
```typescript
// Access page directly for file upload
const page = session.getPage();
await page?.setInputFiles('#fileInput', '/path/to/test/file.txt');
```

**Note**: We may need to expose `setInputFiles` as a BrowserSession method or use `session.getPage()` directly.

#### 6. Dynamic Form Element Testing

```typescript
// Test dynamically added elements
const dynamicFormHtml = `
  <form id="dynamicForm">
    <button type="button" id="addField" onclick="addNewField()">Add Field</button>
    <div id="fields"></div>
  </form>
  <script>
    let fieldCount = 0;
    function addNewField() {
      const input = document.createElement('input');
      input.id = 'field-' + (++fieldCount);
      input.name = 'field-' + fieldCount;
      document.getElementById('fields').appendChild(input);
    }
  </script>
`;

// Add field, wait for it, then interact
await session.click('#addField');
await session.waitForElement('#field-1');
await session.type('#field-1', 'Dynamic value');
```

### Required Methods

The current `BrowserSession` class already provides most needed methods:
- `type()` - Text input
- `click()` - Button clicks, checkbox/radio toggling
- `evaluate()` - Form state verification
- `waitForElement()` - Dynamic element waiting
- `getPage()` - Access to underlying Playwright Page for `setInputFiles`

For `selectOption`, we can use `evaluate()`:
```typescript
await session.evaluate(`
  document.getElementById('country').value = 'us';
  document.getElementById('country').dispatchEvent(new Event('change', { bubbles: true }));
`);
```

Alternatively, use `getPage()`:
```typescript
const page = session.getPage();
await page?.selectOption('#country', 'us');
```

### Test Dependencies

- Use existing `BrowserManager` and `BrowserSession` classes
- Use existing test utilities from `test-utils/` directory
- Use Vitest as the test framework (already in use)

### Error Handling Strategy

Each test should:
1. Verify operation success via `result.success` property
2. Capture and report error messages via `result.error`
3. Use appropriate timeouts for dynamic elements
4. Clean up resources in `afterEach` hooks

### Performance Considerations

- Group related tests to share browser session when possible
- Use `data:text/html` URLs to avoid network latency
- Set appropriate timeouts (default 30000ms should be sufficient)

---

## Consequences

### Positive
- Comprehensive coverage of form handling scenarios
- Consistent test patterns with existing tests
- No new dependencies required
- Uses existing infrastructure

### Negative
- File upload tests require direct Page access
- Some form controls (like select) need `evaluate()` or `getPage()` workarounds

### Neutral
- Test file will be relatively large but well-organized
- May identify gaps in BrowserSession API that could be filled later

---

## Implementation Notes for Developer Stage

1. **File Location**: `packages/browser/src/__tests__/form-handling-integration.test.ts`

2. **Test Setup Pattern**:
   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from 'vitest';
   import { createBrowserManager, createBrowserSession, BrowserManager, BrowserSession } from '../index.js';

   describe('Form Handling Integration Tests', () => {
     let manager: BrowserManager;
     let session: BrowserSession;

     beforeEach(async () => {
       manager = createBrowserManager();
       session = createBrowserSession(manager, {
         browserType: 'chromium',
         headless: true,
       });
       await session.launch();
     });

     afterEach(async () => {
       if (session) await session.close();
       if (manager) await manager.shutdown();
     });

     // Tests here...
   });
   ```

3. **Helper Functions to Create**:
   - `createFormHtml(config)` - Generate test form HTML
   - `getFormValue(session, selector)` - Get input value
   - `isFormValid(session, formSelector)` - Check form validity
   - `getValidationMessage(session, selector)` - Get validation message
   - `captureFormSubmission(session)` - Intercept and capture form data

4. **Test Assertions**:
   - All operations return `{ success: true }` for valid operations
   - Invalid operations return `{ success: false, error: string }`
   - Form state can be verified via `evaluate()`

5. **Timeout Handling**:
   - Default timeout of 30000ms for most operations
   - Shorter timeouts (5000ms) for validation tests
   - Longer timeouts (60000ms) for file upload tests

---

## Related Documents

- `packages/browser/src/__tests__/element-interaction-actions.test.ts` - Existing element interaction tests
- `packages/browser/src/__tests__/acceptance-criteria.test.ts` - Reference implementation pattern
- `packages/browser/src/browser-session.ts` - BrowserSession implementation

---

## Approval

- [x] Architecture Review: Approved
- [ ] Implementation: Pending (next stage)
- [ ] Testing: Pending
