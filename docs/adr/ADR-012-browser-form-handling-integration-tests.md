# ADR-012: Browser Form Handling Integration Tests Architecture

## Status
Accepted

## Date
2026-02-06

## Context

The APEX platform requires comprehensive integration tests for browser form handling scenarios. These tests will validate the browser automation capabilities for form interactions, which are critical for:
- End-to-end workflow testing
- Agent-driven form submissions
- Automated data entry validation
- User interaction simulation

The existing browser integration test infrastructure in `tests/browser-integration/` provides:
- Playwright-based browser automation
- Test fixtures and helper utilities
- Setup/teardown lifecycle management
- Screenshot capture and comparison
- Console message monitoring
- Network request tracking

## Decision

### Test Architecture

We will create a new test file `tests/browser-integration/form-handling.integration.test.ts` that follows the established patterns and covers the following scenarios:

#### 1. Form Input Types Coverage
```
text-inputs/
├── Basic text input (type, clear, validate)
├── Password input handling
├── Email input with validation
├── Number input (increment, decrement, direct input)
├── Textarea multi-line input
├── Date/time input handling
├── Search input
├── Tel/URL input types
```

#### 2. Interactive Form Elements
```
interactive-elements/
├── Checkbox (single, toggle state)
├── Radio buttons (selection, grouping)
├── Select dropdowns (single, multi-select)
├── Range sliders
├── Color picker input
├── File upload handling
```

#### 3. Form Validation Testing
```
validation-scenarios/
├── Required field validation
├── Pattern matching (regex)
├── Min/max length constraints
├── Type-specific validation (email, URL)
├── Custom validation messages
├── Real-time validation feedback
├── Form-level validation summary
```

#### 4. Form Submission Methods
```
submission-methods/
├── GET method submission
├── POST method submission
├── FormData handling
├── JSON payload submission
├── Multipart form data (file uploads)
├── Submit button interactions
├── Enter key submission
├── Programmatic form submission
```

#### 5. File Upload Handling
```
file-upload/
├── Single file upload
├── Multiple file upload
├── File type validation
├── File size validation
├── Drag-and-drop upload
├── Upload progress tracking
├── Upload cancellation
```

#### 6. Dynamic Form Elements
```
dynamic-forms/
├── Conditional field display
├── Dynamic field addition/removal
├── Dependent field updates
├── Form state persistence
├── Lazy-loaded form sections
├── Field array handling
```

### Test Infrastructure Integration

#### Fixture Design

Create a new fixture file `tests/browser-integration/fixtures/form-scenarios.ts`:

```typescript
// Form test page HTML generator
export function createFormTestPage(): string;

// Specific form scenarios
export const TEXT_INPUT_SCENARIOS: TextInputScenario[];
export const CHECKBOX_RADIO_SCENARIOS: CheckboxRadioScenario[];
export const VALIDATION_SCENARIOS: ValidationScenario[];
export const SUBMISSION_SCENARIOS: SubmissionScenario[];
export const FILE_UPLOAD_SCENARIOS: FileUploadScenario[];
export const DYNAMIC_FORM_SCENARIOS: DynamicFormScenario[];
```

#### Helper Utilities

Extend `tests/browser-integration/utils/test-helpers.ts` with form-specific utilities:

```typescript
// Form-specific helpers
export async function fillForm(page: Page, formData: FormData): Promise<void>;
export async function submitForm(page: Page, selector: string): Promise<FormSubmissionResult>;
export async function validateFormErrors(page: Page, expectedErrors: string[]): Promise<void>;
export async function uploadFile(page: Page, selector: string, filePath: string): Promise<void>;
export async function waitForFormValidation(page: Page): Promise<void>;
```

### Test Structure

```
tests/browser-integration/
├── form-handling.integration.test.ts    # Main test file
├── fixtures/
│   ├── common-scenarios.ts              # Existing
│   └── form-scenarios.ts                # NEW: Form test scenarios
└── utils/
    ├── test-helpers.ts                  # Existing (will extend)
    └── form-test-helpers.ts             # NEW: Form-specific helpers
```

### Key Design Decisions

1. **Data-URL Based Test Pages**: Use inline HTML via `data:text/html,...` URLs for simple scenarios and `page.setContent()` for complex forms to avoid external dependencies.

2. **Scenario-Based Organization**: Tests are organized by functional area (input types, validation, submission) rather than technical implementation.

3. **Playwright-First Approach**: Leverage Playwright's built-in form handling APIs (`page.fill()`, `page.selectOption()`, `page.setInputFiles()`) for reliable interactions.

4. **Explicit Wait Strategies**: Use explicit waits for validation states and dynamic content rather than arbitrary timeouts.

5. **Comprehensive Assertions**: Each test validates both the action completion and the resulting DOM state.

6. **Cleanup Between Tests**: Each test starts with a fresh form state to ensure isolation.

### Test Coverage Matrix

| Category | Test Count | Priority |
|----------|------------|----------|
| Text/Number/Email inputs | 8 | High |
| Checkbox/Radio buttons | 6 | High |
| Form validation errors | 10 | High |
| GET submission | 3 | High |
| POST submission | 5 | High |
| File upload | 7 | Medium |
| Dynamic form elements | 8 | Medium |

### Expected Acceptance Criteria Mapping

| Acceptance Criteria | Test File Location |
|---------------------|-------------------|
| Text/number/checkbox/radio inputs | `form-handling.integration.test.ts` - "Form Input Types" describe block |
| Form validation errors | `form-handling.integration.test.ts` - "Form Validation" describe block |
| GET/POST submission | `form-handling.integration.test.ts` - "Form Submission Methods" describe block |
| File upload handling | `form-handling.integration.test.ts` - "File Upload Handling" describe block |
| Dynamic form elements | `form-handling.integration.test.ts` - "Dynamic Form Elements" describe block |

## Consequences

### Positive
- Comprehensive coverage of browser form handling scenarios
- Reusable test fixtures and utilities for future tests
- Clear separation between test scenarios and implementation
- Consistent with existing browser integration test patterns
- Supports both synchronous and asynchronous form operations

### Negative
- Increased test execution time due to browser automation overhead
- Requires Playwright browser binaries to be installed
- Complex form scenarios may require more sophisticated fixtures

### Mitigation Strategies
- Use `testTimeout: 60000` (already configured) for browser tests
- Run browser tests in separate CI job with appropriate resources
- Cache browser binaries in CI environment
- Use `maxForks: 2` to limit parallel browser instances

## Implementation Plan

1. **Phase 1**: Create form scenarios fixture file
2. **Phase 2**: Create form-specific test helpers
3. **Phase 3**: Implement input type tests
4. **Phase 4**: Implement validation tests
5. **Phase 5**: Implement submission tests
6. **Phase 6**: Implement file upload tests
7. **Phase 7**: Implement dynamic form tests
8. **Phase 8**: Verify all tests pass and update documentation

## Related Documents

- `tests/browser-integration/vitest.config.ts` - Test configuration
- `tests/browser-integration/setup.ts` - Test lifecycle management
- `tests/browser-integration/fixtures/common-scenarios.ts` - Existing fixtures
- `tests/browser-integration/utils/test-helpers.ts` - Existing utilities

## Notes for Implementation Stage

- Ensure all file paths use absolute paths for file uploads in tests
- Consider adding visual regression tests for form state changes
- The `createTestPage()` function in common-scenarios.ts already includes a basic form; extend it for comprehensive testing
- Use `setupAlertHandler()` for tests that trigger browser dialogs on form submission
