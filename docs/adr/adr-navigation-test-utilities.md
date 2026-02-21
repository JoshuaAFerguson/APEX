# ADR: Navigation Test Utilities and Fixtures Architecture

**Status**: Accepted
**Date**: 2026-02-07
**Context**: Browser-based integration testing for APEX
**Decision Makers**: Architecture Agent (AI)

## Context

APEX requires a robust testing infrastructure for validating browser navigation flows within its autonomous development workflows. This includes testing URL routing, navigation history management, page content assertions, and browser lifecycle management.

## Decision

The navigation testing infrastructure follows a layered architecture with clear separation of concerns:

### 1. Core Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     Navigation Test Module                       │
│              tests/page-navigation/index.ts                       │
├─────────────────────────────────────────────────────────────────┤
│  Navigation Helpers │ Assertion Helpers │ Browser Fixtures       │
│  (utils/navigation- │ (utils/assertions │ (utils/browser-        │
│   helpers.ts)       │  .ts)             │  fixtures.ts)          │
├─────────────────────────────────────────────────────────────────┤
│                      Test Setup Layer                            │
│                    (setup.ts + mock-server.ts)                    │
├─────────────────────────────────────────────────────────────────┤
│                    Navigation Scenarios                          │
│               (fixtures/navigation-scenarios.ts)                  │
├─────────────────────────────────────────────────────────────────┤
│                       Playwright API                             │
│               (chromium, firefox, webkit)                         │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Module Structure

```
tests/page-navigation/
├── index.ts                    # Main entry point (exports all utilities)
├── setup.ts                    # Global test setup and teardown
├── mock-server.ts              # Mock HTTP server for controlled scenarios
├── vitest.config.ts            # Vitest configuration
├── utils/
│   ├── index.ts                # Utils barrel export
│   ├── navigation-helpers.ts   # Navigation operation helpers (goto, back, forward)
│   ├── assertions.ts           # URL/content/state assertion helpers
│   └── browser-fixtures.ts     # Browser/context/page fixture factories
└── fixtures/
    ├── index.ts                # Fixtures barrel export
    └── navigation-scenarios.ts # Predefined navigation test scenarios
```

### 3. Key Components

#### 3.1 Navigation Helpers (`utils/navigation-helpers.ts`)

Provides helper functions for common navigation operations:

| Function | Purpose |
|----------|---------|
| `safeNavigate(page, url, options)` | Navigate with retry logic and error handling |
| `safeNavigationClick(page, selector, options)` | Click links with navigation wait |
| `waitForNavigationComplete(page, options)` | Wait for page load completion |
| `navigateBack(page, validation)` | Browser back navigation with validation |
| `navigateForward(page, validation)` | Browser forward navigation with validation |
| `reloadPage(page, validation)` | Page reload with validation |
| `validateNavigation(page, validation)` | Validate navigation state |
| `measureNavigationPerformance(page)` | Capture navigation timing metrics |
| `getNavigationHistory(page)` | Get browser history information |
| `benchmarkNavigation(page, url, iterations)` | Performance benchmarking |
| `NavigationEventMonitor` class | Track navigation events during tests |

**Type Definitions:**

```typescript
interface NavigationValidation {
  url?: string | RegExp;
  title?: string | RegExp;
  historyLength?: number;
  performanceThreshold?: number;
  hasElement?: string;
  textContent?: { selector: string; text: string | RegExp };
}

interface NavigationPerformance {
  domContentLoaded: number;
  loadComplete: number;
  firstPaint: number;
  firstContentfulPaint: number;
  totalNavigationTime: number;
  timestamp: number;
  url: string;
}

interface NavigationHistory {
  length: number;
  currentIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;
  entries: string[];
}
```

#### 3.2 Assertion Helpers (`utils/assertions.ts`)

Provides assertion functions for navigation state validation:

| Function | Purpose |
|----------|---------|
| `assertURL(page, expected)` | Assert exact URL or regex match |
| `assertURLContains(page, substring)` | Assert URL contains substring |
| `assertURLMatches(page, pattern)` | Assert URL matches regex |
| `assertPageTitle(page, expected)` | Assert page title |
| `assertElementExists(page, selector)` | Assert element presence |
| `assertElementText(page, selector, expected)` | Assert element text content |
| `assertElementVisible(page, selector)` | Assert element visibility |
| `assertElementHidden(page, selector)` | Assert element is hidden |
| `assertPageContent(page, options)` | Multi-condition content assertion |
| `assertHistoryLength(page, expected)` | Assert browser history length |
| `assertCanGoBack(page, expected)` | Assert back navigation availability |
| `assertCanGoForward(page, expected, index, length)` | Assert forward navigation |
| `assertNavigationPerformance(startTime, maxDuration)` | Assert timing threshold |
| `assertLoadState(page, state, timeout)` | Assert page load state |

**Custom Error Class:**

```typescript
class NavigationAssertionError extends Error {
  constructor(
    message: string,
    public readonly actual: unknown,
    public readonly expected: unknown,
    public readonly url?: string
  ) {
    super(message);
    this.name = 'NavigationAssertionError';
  }
}
```

#### 3.3 Browser Fixtures (`utils/browser-fixtures.ts`)

Provides fixture factories for isolated test environments:

| Function | Purpose |
|----------|---------|
| `createBrowserFixture(options)` | Create browser instance with cleanup |
| `createPageFixture(options)` | Create page with context and cleanup |
| `withNavigationPage(fn, options)` | Scoped page execution with auto-cleanup |
| `withBrowserContext(fn, options)` | Scoped context execution with auto-cleanup |
| `createMultiPageFixture(count, options)` | Create multiple isolated pages |
| `createSharedContextPages(count, options)` | Create pages sharing a context |

**Type Definitions:**

```typescript
type BrowserType = 'chromium' | 'firefox' | 'webkit';

interface BrowserFixtureOptions {
  browserType?: BrowserType;
  headless?: boolean;
  slowMo?: number;
  devtools?: boolean;
  args?: string[];
}

interface PageFixtureOptions extends BrowserFixtureOptions {
  viewport?: { width: number; height: number };
  baseURL?: string;
  navigationTimeout?: number;
  actionTimeout?: number;
  recordVideo?: { dir: string };
  reducedMotion?: 'reduce' | 'no-preference';
  timezoneId?: string;
  locale?: string;
}

interface PageFixture {
  page: Page;
  context: BrowserContext;
  browser: Browser;
  cleanup: () => Promise<void>;
}
```

#### 3.4 Mock Server (`mock-server.ts`)

Provides a programmatic HTTP server for controlled navigation scenarios:

```typescript
class MockNavigationServer {
  port: number;           // Server port (after start)
  baseUrl: string;        // Full base URL
  isRunning: boolean;     // Server state

  constructor(options: MockServerOptions);

  start(): Promise<void>;
  stop(): Promise<void>;
  addScenario(scenario: NavigationScenario): void;
  removeScenario(path: string): void;
  getScenarios(): NavigationScenario[];
}

// Lifecycle management for tests
class MockServerLifecycle {
  static startForTest(name: string, options?): Promise<MockNavigationServer>;
  static stopForTest(name: string): Promise<void>;
  static getInstance(name: string): MockNavigationServer | undefined;
  static stopAll(): Promise<void>;
}
```

**Default Scenarios:**
- `/` - Home page
- `/page1`, `/page2`, `/page3` - Navigation targets
- `/error` - 500 error simulation
- `/404` - 404 error simulation
- `/forbidden` - 403 error simulation
- `/slow` - 2-second delayed response
- `/very-slow` - 4-second delayed response
- `/redirect`, `/redirect-temp`, `/redirect-permanent` - Redirect scenarios
- `/api/data` - JSON response
- `/empty` - Empty response

#### 3.5 Navigation Scenarios (`fixtures/navigation-scenarios.ts`)

Pre-built test scenarios for common navigation patterns:

```typescript
interface NavigationScenario {
  name: string;
  description: string;
  steps: NavigationStep[];
  expectedOutcome: ExpectedOutcome;
  timeout?: number;
}

interface NavigationStep {
  type: 'goto' | 'click' | 'back' | 'forward' | 'reload' | 'wait' | 'evaluate';
  target?: string;
  selector?: string;
  code?: string;
  timeout?: number;
  expectNavigation?: boolean;
}

// Scenario runner
async function runNavigationScenario(
  page: Page,
  scenario: NavigationScenario,
  baseUrl: string
): Promise<{ success: boolean; metrics: any; error?: Error }>;
```

**Available Scenarios:**
- `basic-page-navigation` - Multi-page link navigation
- `browser-history-navigation` - Back/forward navigation
- `page-reload` - Page refresh testing
- `redirect-handling` - HTTP redirect testing
- `slow-page-loading` - Slow page handling
- `error-page-handling` - Error response testing
- `complex-navigation-flow` - Multi-step navigation

### 4. Test Setup (`setup.ts`)

Global test lifecycle management:

```typescript
// Global test context
interface NavigationTestContext {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  tempDir?: string;
  screenshots?: string[];
  mockServer?: Server;
  mockServerPort?: number;
  enhancedMockServer?: MockNavigationServer;
  navigationHistory?: string[];
  performanceMetrics?: Record<string, any>[];
}

// Configuration
interface NavigationTestConfig {
  backend: 'playwright' | 'puppeteer';
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  viewport: { width: number; height: number };
  slowMo?: number;
  devtools?: boolean;
  recordNavigationHistory?: boolean;
  measurePerformance?: boolean;
}
```

**Lifecycle Hooks:**
- `beforeAll`: Create temp directory, start mock server
- `afterAll`: Close browser, stop server, cleanup temp files
- `beforeEach`: Reset navigation history and metrics
- `afterEach`: Capture failure screenshots

### 5. Usage Patterns

#### Pattern 1: Fixture-based Testing

```typescript
import { createPageFixture, safeNavigate, assertURL } from '@test/page-navigation';

describe('Navigation Tests', () => {
  let fixture: PageFixture;

  beforeEach(async () => {
    fixture = await createPageFixture({ baseURL: 'http://localhost:3000' });
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  it('should navigate to dashboard', async () => {
    await safeNavigate(fixture.page, '/dashboard');
    await assertURL(fixture.page, /\/dashboard$/);
  });
});
```

#### Pattern 2: Scoped Helper Testing

```typescript
import { withNavigationPage, assertURL, assertPageContent } from '@test/page-navigation';

it('should navigate', async () => {
  await withNavigationPage(async (page) => {
    await page.goto('/');
    await assertURL(page, /\/$/);
    await assertPageContent(page, { hasElement: 'h1' });
  }, { baseURL: 'http://localhost:3000' });
});
```

#### Pattern 3: Scenario-based Testing

```typescript
import {
  createPageFixture,
  NAVIGATION_SCENARIOS,
  runNavigationScenario,
} from '@test/page-navigation';

it('should run navigation scenario', async () => {
  const fixture = await createPageFixture();
  const scenario = NAVIGATION_SCENARIOS.find(s => s.name === 'basic-page-navigation');

  const result = await runNavigationScenario(fixture.page, scenario, 'http://localhost:3000');
  expect(result.success).toBe(true);

  await fixture.cleanup();
});
```

## Consequences

### Positive

1. **Test Isolation**: Each test gets isolated browser contexts and automatic cleanup
2. **Type Safety**: Full TypeScript support with comprehensive type definitions
3. **Error Handling**: Built-in retry logic and descriptive error messages
4. **Flexibility**: Multiple usage patterns (fixtures, scoped helpers, scenarios)
5. **Performance Monitoring**: Built-in timing measurement and benchmarking
6. **Cross-Browser Support**: Chromium, Firefox, and WebKit via Playwright

### Negative

1. **Complexity**: Multiple layers may increase learning curve
2. **External Dependencies**: Relies on Playwright, which adds install size
3. **Test Speed**: Browser tests are slower than unit tests

### Mitigations

1. Comprehensive JSDoc documentation on all functions
2. Example usage patterns in module header comments
3. Clear module index file with organized exports
4. Sequential test execution option to prevent interference

## Acceptance Criteria Verification

| Criteria | Status | Evidence |
|----------|--------|----------|
| Test utility module exists with navigation helper functions | ✅ Met | `utils/navigation-helpers.ts` with goto, waitForNavigation, assertURL, assertPageContent |
| Fixtures available for browser/page setup | ✅ Met | `utils/browser-fixtures.ts` with createPageFixture, withNavigationPage |
| Utilities properly typed with TypeScript | ✅ Met | Full type definitions for all interfaces and functions |
| Documentation comments explain usage | ✅ Met | JSDoc comments with @example blocks on all exports |

## Files

**Primary Implementation:**
- `tests/page-navigation/utils/navigation-helpers.ts` - Navigation helpers
- `tests/page-navigation/utils/assertions.ts` - Assertion helpers
- `tests/page-navigation/utils/browser-fixtures.ts` - Browser fixtures
- `tests/page-navigation/utils/index.ts` - Utils barrel export

**Infrastructure:**
- `tests/page-navigation/setup.ts` - Test setup and teardown
- `tests/page-navigation/mock-server.ts` - Mock HTTP server
- `tests/page-navigation/vitest.config.ts` - Test configuration

**Fixtures:**
- `tests/page-navigation/fixtures/navigation-scenarios.ts` - Predefined scenarios
- `tests/page-navigation/fixtures/index.ts` - Fixtures barrel export

**Entry Point:**
- `tests/page-navigation/index.ts` - Main module export

## Related ADRs

- None (first navigation testing ADR)
