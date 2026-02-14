# ADR-009: Sample Integration Test Architecture

## Status
Accepted

## Date
2026-02-14

## Context
We need to create a comprehensive sample integration test file that demonstrates the complete test infrastructure setup. This test must:
- Launch a browser via Playwright
- Navigate to mock server pages
- Use test utilities for assertions
- Demonstrate fixture usage
- Cover basic navigation scenarios
- Be runnable via npm script
- Include documentation for extension

## Decision

### Test File Location
**`tests/playwright/sample-integration.spec.ts`**

The test will be placed in the `tests/playwright/` directory alongside existing Playwright tests, following the established naming convention (`*.spec.ts`).

### Architecture Components

#### 1. Mock Server Integration
The sample test will use the existing `MockNavigationServer` from `tests/page-navigation/mock-server.ts`, which provides:
- Configurable HTTP server on a dynamic port
- Pre-defined navigation scenarios (home, page1, page2, page3, errors, redirects, slow responses)
- CORS support for testing
- HTML pages with navigation controls and JavaScript

**Lifecycle Pattern:**
```typescript
let mockServer: MockNavigationServer;

test.beforeAll(async () => {
  mockServer = await createMockNavigationServer();
});

test.afterAll(async () => {
  await mockServer.stop();
});
```

#### 2. Playwright Fixtures
The sample test will leverage fixtures from `tests/playwright/fixtures/index.ts`:
- `cleanPage` - Fresh browser page for each test
- `pageWithConsoleCapture` - Page with console logging
- `pageWithNetworkCapture` - Page with network request tracking
- `loggedInPage` - Authenticated state with real browser

#### 3. Assertion Utilities
The sample test will demonstrate assertion utilities from `tests/page-navigation/utils/assertions.ts`:
- `assertURL()` - URL validation (exact, contains, regex)
- `assertPageTitle()` - Title validation
- `assertElementExists()` - Element presence
- `assertElementText()` - Text content validation
- `assertElementVisible()` - Visibility assertions
- `assertHistoryLength()` - Navigation history validation
- `assertLoadState()` - Page load state assertions

#### 4. Navigation Helpers
Navigation utilities from `tests/page-navigation/utils/navigation-helpers.ts`:
- `safeNavigate()` - Navigation with retry logic
- `safeNavigationClick()` - Click with navigation handling
- `validateNavigation()` - Comprehensive navigation validation
- `measureNavigationPerformance()` - Performance metrics
- `navigateBack()` / `navigateForward()` - History navigation
- `NavigationEventMonitor` - Event tracking

### Test Structure

```
tests/playwright/sample-integration.spec.ts
├── test.describe('Sample Integration Test')
│   ├── Setup (beforeAll/afterAll) - Mock server lifecycle
│   │
│   ├── test.describe('Basic Navigation Scenarios')
│   │   ├── test('navigates to home page and verifies content')
│   │   ├── test('navigates through multiple pages')
│   │   └── test('demonstrates browser history navigation')
│   │
│   ├── test.describe('Fixture Usage Examples')
│   │   ├── test('uses cleanPage fixture for isolated tests')
│   │   ├── test('captures console messages during navigation')
│   │   └── test('tracks network requests during navigation')
│   │
│   ├── test.describe('Assertion Utility Demonstrations')
│   │   ├── test('validates URL patterns')
│   │   ├── test('validates page content and elements')
│   │   └── test('validates navigation state')
│   │
│   └── test.describe('Advanced Scenarios')
│       ├── test('handles error pages gracefully')
│       └── test('validates redirect handling')
```

### NPM Script
A new npm script will be added to `package.json`:
```json
"test:sample-integration": "playwright test tests/playwright/sample-integration.spec.ts"
```

### Documentation Strategy
The test file will include:
1. **File-level JSDoc** - Overview, purpose, and quick-start guide
2. **Section comments** - Explaining each test group's purpose
3. **Inline comments** - Explaining key patterns and techniques
4. **Example extension patterns** - Showing how to add new tests

## Consequences

### Positive
- Provides a working reference implementation for all test infrastructure
- Demonstrates best practices for Playwright + mock server integration
- Serves as onboarding documentation for new contributors
- Validates that all infrastructure components work together

### Negative
- Additional maintenance burden if infrastructure changes
- May become outdated if not kept in sync with infrastructure updates

### Mitigation
- Run sample test as part of CI pipeline to catch infrastructure breakages
- Include infrastructure version compatibility notes in comments

## Implementation Notes

### Key Imports
```typescript
// Playwright fixtures
import { test, expect, createTestPage, waitForPageReady } from './fixtures';

// Mock server
import { MockNavigationServer, createMockNavigationServer } from '../page-navigation/mock-server';

// Navigation helpers
import {
  safeNavigate,
  safeNavigationClick,
  validateNavigation,
  measureNavigationPerformance,
  navigateBack,
  navigateForward,
  NavigationEventMonitor
} from '../page-navigation/utils/navigation-helpers';

// Assertion utilities
import {
  assertURL,
  assertURLContains,
  assertPageTitle,
  assertElementExists,
  assertElementText,
  assertElementVisible,
  assertHistoryLength,
  assertLoadState
} from '../page-navigation/utils/assertions';
```

### Configuration Requirements
The test will run with default Playwright configuration from `playwright.config.ts`:
- Test timeout: 60s per test
- Navigation timeout: 30s
- Action timeout: 30s
- Screenshots: only-on-failure
- Trace: on-first-retry

## References
- `tests/playwright/fixtures/index.ts` - Playwright fixtures
- `tests/page-navigation/mock-server.ts` - Mock navigation server
- `tests/page-navigation/utils/navigation-helpers.ts` - Navigation utilities
- `tests/page-navigation/utils/assertions.ts` - Assertion utilities
- `playwright.config.ts` - Playwright configuration
