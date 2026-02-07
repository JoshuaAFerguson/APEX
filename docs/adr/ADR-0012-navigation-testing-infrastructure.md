# ADR-0012: Navigation Testing Infrastructure

## Status
Accepted

## Date
2026-02-07

## Context

APEX requires robust browser automation testing infrastructure to validate navigation flows, URL routing, and page interactions. The testing infrastructure must:

1. Provide reusable helper functions for common navigation operations
2. Support test isolation with proper browser context and page setup/teardown
3. Enable comprehensive assertions for URLs, page content, and navigation state
4. Be properly typed with TypeScript for developer experience
5. Be well-documented for ease of use by other developers

### Current State Analysis

The existing test infrastructure in `tests/page-navigation/` already provides:

- **Navigation Helpers** (`utils/navigation-helpers.ts`): Safe navigation, validation, performance measurement
- **Fixtures** (`fixtures/navigation-scenarios.ts`): Predefined test scenarios
- **Setup** (`setup.ts`): Browser lifecycle, mock server, global context

### Gap Analysis

After analyzing the codebase, the following enhancements are needed:

1. **Consolidated Test Utilities Module**: A single entry point exporting all navigation utilities
2. **Enhanced Type Definitions**: Stricter types for assertion helpers
3. **Fixture Factory Pattern**: Consistent factory pattern for creating test fixtures
4. **Improved Documentation**: JSDoc comments with usage examples

## Decision

We will enhance the navigation testing infrastructure with the following architectural decisions:

### 1. Navigation Test Utilities Module Structure

```
tests/page-navigation/
├── index.ts                    # Main entry point exporting all utilities
├── setup.ts                    # Global setup/teardown, browser lifecycle
├── vitest.config.ts            # Test configuration
├── fixtures/
│   ├── index.ts                # Fixture exports
│   ├── navigation-scenarios.ts # Predefined scenarios
│   └── test-pages.ts           # HTML test page generators
└── utils/
    ├── index.ts                # Utility exports
    ├── navigation-helpers.ts   # Core navigation helpers
    ├── assertions.ts           # Custom assertion helpers
    └── browser-fixtures.ts     # Browser/page fixture factories
```

### 2. Core Helper Functions Design

#### Navigation Operations
```typescript
// Safe navigation with retry logic
safeNavigate(page: Page, url: string, options?: NavigateOptions): Promise<boolean>

// Wait for navigation with comprehensive checks
waitForNavigation(page: Page, options?: WaitOptions): Promise<void>

// Navigation with click
safeNavigationClick(page: Page, selector: string, options?: ClickOptions): Promise<boolean>

// History navigation
navigateBack(page: Page, validation?: NavigationValidation): Promise<boolean>
navigateForward(page: Page, validation?: NavigationValidation): Promise<boolean>
reloadPage(page: Page, validation?: NavigationValidation): Promise<boolean>
```

#### Assertion Helpers
```typescript
// URL assertions
assertURL(page: Page, expected: string | RegExp): Promise<void>
assertURLContains(page: Page, substring: string): Promise<void>
assertURLMatches(page: Page, pattern: RegExp): Promise<void>

// Page content assertions
assertPageContent(page: Page, options: ContentAssertion): Promise<void>
assertElementExists(page: Page, selector: string): Promise<void>
assertElementText(page: Page, selector: string, expected: string | RegExp): Promise<void>
assertPageTitle(page: Page, expected: string | RegExp): Promise<void>

// Navigation state assertions
assertHistoryLength(page: Page, expected: number): Promise<void>
assertCanGoBack(page: Page, expected: boolean): Promise<void>
assertCanGoForward(page: Page, expected: boolean): Promise<void>
```

### 3. Fixture Factory Pattern

Browser and page fixtures follow the factory pattern for consistent setup/teardown:

```typescript
interface BrowserFixture {
  browser: Browser;
  cleanup: () => Promise<void>;
}

interface PageFixture {
  page: Page;
  context: BrowserContext;
  browser: Browser;
  cleanup: () => Promise<void>;
}

// Factory functions
createBrowserFixture(options?: BrowserOptions): Promise<BrowserFixture>
createPageFixture(options?: PageOptions): Promise<PageFixture>
withNavigationPage<T>(fn: (page: Page) => Promise<T>): Promise<T>
```

### 4. Test Isolation Patterns

Each test should use isolated browser contexts:

```typescript
describe('Navigation Tests', () => {
  let fixture: PageFixture;

  beforeEach(async () => {
    fixture = await createPageFixture({
      viewport: { width: 1280, height: 720 },
      baseURL: testServerUrl,
    });
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  it('should navigate between pages', async () => {
    const { page } = fixture;
    await safeNavigate(page, '/');
    await assertURL(page, /\/$/);
  });
});
```

### 5. Type Definitions

```typescript
// Navigation options
interface NavigateOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  retries?: number;
}

// Content assertion options
interface ContentAssertion {
  hasElement?: string;
  elementText?: { selector: string; text: string | RegExp };
  pageTitle?: string | RegExp;
  bodyContains?: string;
}

// Validation result
interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

## Consequences

### Positive

1. **Consistency**: All navigation tests use the same patterns and utilities
2. **Maintainability**: Centralized utilities make updates easier
3. **Discoverability**: Clear module structure with comprehensive exports
4. **Type Safety**: Strong TypeScript typing prevents runtime errors
5. **Documentation**: JSDoc comments enable IDE support and self-documentation

### Negative

1. **Learning Curve**: Developers need to learn the utility APIs
2. **Abstraction Overhead**: Some flexibility lost with standardized patterns

### Neutral

1. **Migration**: Existing tests can gradually adopt new patterns

## Implementation Notes

The existing implementation in `tests/page-navigation/` already provides most of the required functionality. The enhancements focus on:

1. Adding clear export modules (`index.ts` files)
2. Enhancing TypeScript types for stricter compile-time checks
3. Adding JSDoc documentation with examples
4. Creating assertion helper wrappers for cleaner test code

## Related Documents

- `tests/page-navigation/setup.ts` - Existing setup implementation
- `tests/page-navigation/utils/navigation-helpers.ts` - Core helper implementations
- `tests/page-navigation/fixtures/navigation-scenarios.ts` - Scenario definitions
