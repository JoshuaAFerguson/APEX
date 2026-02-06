# ADR-145: Advanced Browser Automation Integration Tests Architecture

## Status
Accepted

## Date
2026-02-05

## Context

The APEX project requires comprehensive integration tests for advanced browser automation scenarios. The acceptance criteria specify tests covering:

1. **Form Handling** - Complex form interactions, validation, dynamic fields
2. **Error Scenarios** - Network failures, timeouts, JavaScript errors
3. **Multi-Page Workflows** - Navigation sequences, state persistence across pages
4. **Browser Context/Session Management** - Isolated contexts, storage, cookies

### Current State

The codebase already has a robust browser automation testing infrastructure:

| Component | Status | Location |
|-----------|--------|----------|
| Advanced integration tests | **EXISTS** | `tests/browser-integration/advanced-browser-automation.integration.test.ts` |
| Test setup infrastructure | **EXISTS** | `tests/browser-integration/setup.ts` |
| Browser package | **EXISTS** | `packages/browser/` |
| BrowserSession class | **EXISTS** | `packages/browser/src/browser-session.ts` |
| BrowserManager class | **EXISTS** | `packages/browser/src/browser-manager.ts` |
| Playwright configuration | **EXISTS** | `playwright.config.ts` |
| Vitest configuration | **EXISTS** | `vitest.config.ts` |

### Existing Test Coverage Analysis

The file `tests/browser-integration/advanced-browser-automation.integration.test.ts` already contains **14 comprehensive integration tests** covering all four acceptance criteria categories:

#### 1. Form Handling Integration Tests (3 tests)
- `should handle complex form validation and submission`
- `should handle dynamic form fields`
- `should handle form validation errors correctly`

#### 2. Error Scenarios Integration Tests (4 tests)
- `should handle network failures gracefully`
- `should handle timeout scenarios`
- `should handle JavaScript runtime errors`
- `should handle promise rejection errors`

#### 3. Multi-Page Workflow Integration Tests (3 tests)
- `should complete a multi-page workflow successfully`
- `should handle navigation between workflow pages`
- `should validate required fields in workflow`

#### 4. Browser Context/Session Management Integration Tests (4 tests)
- `should manage multiple browser contexts independently`
- `should maintain session data within a context`
- `should handle cookies across sessions`
- `should handle context cleanup properly`

## Decision

### Architecture Overview

The integration test architecture follows a layered approach leveraging Playwright and Vitest:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Test Execution Layer (Vitest/Playwright)            │
├─────────────────────────────────────────────────────────────────────────┤
│  tests/browser-integration/                                             │
│  ├── advanced-browser-automation.integration.test.ts  [CORE TESTS]     │
│  ├── setup.ts                                         [SETUP HOOKS]    │
│  ├── vitest.config.ts                                 [CONFIG]         │
│  ├── fixtures/                                        [SCENARIOS]      │
│  │   ├── permission-test-scenarios.ts                                  │
│  │   ├── common-scenarios.ts                                           │
│  │   └── error-page-scenarios.ts                                       │
│  └── utils/                                           [HELPERS]        │
│      ├── browser-automation-test-helpers.ts                            │
│      ├── browser-permission-mocks.ts                                   │
│      ├── integration-test-context.ts                                   │
│      └── test-helpers.ts                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                     Browser Package Layer                               │
├─────────────────────────────────────────────────────────────────────────┤
│  packages/browser/src/                                                  │
│  ├── browser-manager.ts      [Multi-instance management]               │
│  ├── browser-session.ts      [Session lifecycle, page control]         │
│  ├── screenshot-utility.ts   [Screenshot capture]                      │
│  ├── types.ts                [Type definitions]                        │
│  └── constants.ts            [Configuration defaults]                  │
├─────────────────────────────────────────────────────────────────────────┤
│                     Playwright Automation Layer                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Test Categories Design

#### 1. Form Handling Tests Architecture

```typescript
describe('Form Handling Integration Tests', () => {
  // Test page with comprehensive form elements:
  // - Text inputs with validation (required, email, phone patterns)
  // - Select dropdowns (single and multi-select)
  // - Checkboxes and radio buttons
  // - Textarea fields
  // - Dynamic field generation
  // - Form reset functionality
  // - Real-time validation feedback
  // - Form submission with data collection
});
```

**Implementation Approach:**
- Use inline HTML with embedded JavaScript for complete test isolation
- Implement client-side validation with error message display
- Support dynamic field addition/removal
- Capture and verify form data on submission

#### 2. Error Scenarios Tests Architecture

```typescript
describe('Error Scenarios Integration Tests', () => {
  // Network failure simulation using page.route() interception
  // - Abort requests to simulate network errors
  // - Delayed responses for timeout testing

  // JavaScript error capture using:
  // - window.addEventListener('error') for runtime errors
  // - window.addEventListener('unhandledrejection') for promise rejections

  // DOM manipulation to verify error handling UI updates
});
```

**Implementation Approach:**
- Use Playwright's `page.route()` API for network mocking
- Use `AbortController` for timeout simulation
- Inject error handlers via page.evaluate()
- Use waitForFunction() to verify error state changes

#### 3. Multi-Page Workflow Tests Architecture

```typescript
describe('Multi-Page Workflow Integration Tests', () => {
  // 4-step workflow simulation:
  // Step 1: Personal Information collection
  // Step 2: Address Information collection
  // Step 3: Preferences and terms acceptance
  // Step 4: Review and confirmation

  // Data persistence using sessionStorage
  // Navigation validation between steps
  // Per-step validation before progression
});
```

**Implementation Approach:**
- Use sessionStorage for cross-page data persistence
- Generate workflow pages dynamically with page number parameter
- Implement progress bar visualization
- Validate data at each step before allowing navigation

#### 4. Browser Context/Session Management Tests Architecture

```typescript
describe('Browser Context/Session Management Tests', () => {
  // Multiple context isolation:
  // - Independent viewport configurations
  // - Separate storage namespaces
  // - Cookie isolation

  // Session data persistence:
  // - sessionStorage within context
  // - localStorage across page navigations
  // - Cookie persistence and clearing

  // Context cleanup:
  // - Proper resource cleanup on close
  // - Storage state verification after cleanup
});
```

**Implementation Approach:**
- Create multiple browser contexts from single browser instance
- Use unique identifiers (timestamps, random values) to verify isolation
- Test storage APIs (localStorage, sessionStorage, cookies)
- Verify cleanup removes all context-specific data

### Test Data Strategy

The tests use **inline HTML generation** rather than external files for:
1. Complete test isolation and reproducibility
2. Self-contained test scenarios
3. No external dependencies or network requests
4. Full control over page behavior and timing

Example pattern:
```typescript
const formTestPage = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Test Page</title>
    <style>/* Embedded styles */</style>
  </head>
  <body>
    <!-- Test content -->
    <script>
      // Embedded test logic
    </script>
  </body>
  </html>
`;

await page.setContent(formTestPage);
```

### Test Lifecycle Management

```typescript
describe('Advanced Browser Automation Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let tempDir: string;

  beforeAll(async () => {
    // Setup: Create temp directory, launch browser, create context
    tempDir = globalThis.browserTestContext?.tempDir || './tmp';
    browser = await createBrowser();
    context = await createBrowserContext(browser);
    page = await createPage(context);
  });

  afterAll(async () => {
    // Teardown: Close page, context, browser
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  });

  beforeEach(async () => {
    // Reset: Clear cookies and storage for test isolation
    await context.clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  afterEach(async () => {
    // Debug: Capture screenshot for test debugging
    await captureScreenshot(page, `test-${Date.now()}`, tempDir);
  });
});
```

### Timeout Configuration

Browser automation tests require extended timeouts:

| Test Type | Timeout | Rationale |
|-----------|---------|-----------|
| Form tests | 15,000ms | Multiple interactions + validation |
| Network error tests | 5,000ms | Controlled abort/timeout scenarios |
| Multi-page workflow | 10,000ms | Multiple page navigations |
| Context management | 15,000ms | Multi-context operations |

Default in Playwright config: 60,000ms global, 30,000ms navigation

### Test Coverage Validation

The test file includes a validation test that programmatically verifies all acceptance criteria are covered:

```typescript
describe('Integration Test Coverage Validation', () => {
  it('should validate all integration test scenarios are covered', async () => {
    const allTestCategories = {
      'Form Handling': [/* 3 tests */],
      'Error Scenarios': [/* 4 tests */],
      'Multi-Page Workflows': [/* 3 tests */],
      'Browser Context/Session Management': [/* 4 tests */]
    };

    expect(coverageReport.totalCategories).toBe(4);
    expect(coverageReport.totalTests).toBe(14);
  });
});
```

## Consequences

### Positive
- **Complete coverage** of all acceptance criteria requirements
- **Self-contained tests** with no external dependencies
- **Isolation** between tests prevents cross-contamination
- **Reproducible** results across different environments
- **Well-documented** test scenarios with clear naming

### Negative
- **Browser tests are slower** than pure unit tests (5-60 seconds per test)
- **Resource intensive** requiring ~500MB per browser instance
- **Potential flakiness** due to timing issues (mitigated by explicit waits)
- **CI environment requirements** (Playwright browsers must be installed)

### Mitigation Strategies
- Use `headless: true` by default for CI/faster execution
- Implement explicit waitForFunction() calls instead of arbitrary delays
- Configure retries in CI (`retries: 2` in playwright.config.ts)
- Use isolated temp directories for test artifacts

## Running the Tests

```bash
# Run all tests (includes browser integration)
npm run test

# Run browser integration tests specifically
npx vitest run tests/browser-integration/

# Run with Playwright directly
npx playwright test tests/browser-integration/

# Run in headed mode for debugging
BROWSER_TEST_HEADLESS=false npx vitest run tests/browser-integration/
```

## Related ADRs

- ADR-090: Browser Automation Integration Test Infrastructure
- ADR-007: Browser Context and Session Management Integration Tests
- ADR-051: v0.5.0 Integration Tests Architecture

## Implementation Notes

The integration tests have already been implemented in:
- `tests/browser-integration/advanced-browser-automation.integration.test.ts`

The tests are fully functional and cover all acceptance criteria:
1. Form handling (3 tests)
2. Error scenarios - network failures, timeouts (4 tests)
3. Multi-page workflows (3 tests)
4. Browser context/session management (4 tests)

**Total: 14 integration tests** plus 1 coverage validation test.
