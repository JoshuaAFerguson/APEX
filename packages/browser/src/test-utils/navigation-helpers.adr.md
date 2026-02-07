# ADR: Navigation Test Utilities Architecture

## Status
Proposed

## Context

Navigation testing in browser automation requires consistent patterns for common operations like navigating to URLs, waiting for navigation completion, and asserting URL/page content state. The existing test infrastructure in `packages/browser/src/test-utils/` provides foundational utilities (mock-page-objects, assertions, dom-builders, url-generators), but lacks dedicated helpers specifically for navigation testing workflows.

Current navigation tests (e.g., `navigation-acceptance-criteria.test.ts`) contain repetitive setup/teardown patterns and manually construct navigation scenarios. This creates:
1. Code duplication across navigation-related tests
2. Inconsistent patterns for handling navigation timeouts and errors
3. Missing fixtures for common navigation states (loading, redirect, error)
4. No standardized helpers for navigation-specific assertions

## Decision

### 1. Module Architecture

Create a new navigation helpers module with the following structure:

```
packages/browser/src/test-utils/
├── navigation-helpers.ts       # Navigation helper functions
├── navigation-fixtures.ts      # Navigation test fixtures and scenarios
├── navigation-assertions.ts    # Navigation-specific assertions
├── __tests__/
│   ├── navigation-helpers.test.ts
│   └── navigation-fixtures.test.ts
└── index.ts                    # Update barrel export
```

### 2. Navigation Helpers API (`navigation-helpers.ts`)

```typescript
/**
 * Navigation helper functions for browser automation testing
 */

import type { BrowserSession } from '../browser-session.js';
import type { NavigationOptions, WaitForNavigationOptions, BrowserActionResult } from '../types.js';
import type { MockBrowserSession } from '../mocks/mock-browser-session.js';

/** Navigation result with timing and state information */
export interface NavigationResult {
  /** Whether navigation was successful */
  success: boolean;
  /** Final URL after navigation (including redirects) */
  finalUrl: string;
  /** Page title after navigation */
  title?: string;
  /** Navigation duration in milliseconds */
  duration: number;
  /** Error message if navigation failed */
  error?: string;
  /** Number of redirects encountered */
  redirectCount?: number;
}

/** Options for navigation helpers */
export interface NavigationHelperOptions extends NavigationOptions {
  /** Expected URL pattern (for validation) */
  expectedUrl?: string | RegExp;
  /** Expected page title (for validation) */
  expectedTitle?: string | RegExp;
  /** Maximum redirects before failing */
  maxRedirects?: number;
  /** Whether to collect console messages during navigation */
  captureConsole?: boolean;
  /** Whether to capture network requests */
  captureNetwork?: boolean;
}

/**
 * Navigate to a URL with automatic validation
 *
 * @param session - Browser session or mock session
 * @param url - Target URL to navigate to
 * @param options - Navigation options with validation criteria
 * @returns Navigation result with validation status
 *
 * @example
 * ```typescript
 * const result = await navigateTo(session, 'https://example.com', {
 *   expectedUrl: /example\.com/,
 *   expectedTitle: 'Example Domain',
 *   timeout: 5000
 * });
 * expect(result.success).toBe(true);
 * ```
 */
export async function navigateTo(
  session: BrowserSession | MockBrowserSession,
  url: string,
  options?: NavigationHelperOptions
): Promise<NavigationResult>;

/**
 * Navigate and wait for specific content to appear
 *
 * @param session - Browser session or mock session
 * @param url - Target URL
 * @param contentSelector - Selector for content to wait for
 * @param options - Navigation and wait options
 * @returns Navigation result with content verification
 */
export async function navigateAndWaitForContent(
  session: BrowserSession | MockBrowserSession,
  url: string,
  contentSelector: string,
  options?: NavigationHelperOptions & { contentTimeout?: number }
): Promise<NavigationResult & { contentFound: boolean }>;

/**
 * Navigate through multiple pages in sequence
 *
 * @param session - Browser session or mock session
 * @param urls - Array of URLs to navigate through
 * @param options - Options applied to each navigation
 * @returns Array of navigation results for each URL
 */
export async function navigateSequence(
  session: BrowserSession | MockBrowserSession,
  urls: string[],
  options?: NavigationHelperOptions
): Promise<NavigationResult[]>;

/**
 * Wait for navigation with URL pattern matching
 *
 * @param session - Browser session or mock session
 * @param urlPattern - String glob or RegExp to match
 * @param options - Wait options
 * @returns Result with final URL
 */
export async function waitForNavigation(
  session: BrowserSession | MockBrowserSession,
  urlPattern?: string | RegExp,
  options?: WaitForNavigationOptions
): Promise<BrowserActionResult<string>>;

/**
 * Build a navigation history for testing back/forward
 *
 * @param session - Browser session or mock session
 * @param urls - URLs to populate in history
 * @returns History stack info for verification
 */
export async function buildNavigationHistory(
  session: BrowserSession | MockBrowserSession,
  urls: string[]
): Promise<{
  historyLength: number;
  currentIndex: number;
  urls: string[];
}>;

/**
 * Navigate back with validation
 *
 * @param session - Browser session
 * @param expectedUrl - Expected URL after going back
 * @param options - Navigation options
 */
export async function goBackAndVerify(
  session: BrowserSession | MockBrowserSession,
  expectedUrl?: string | RegExp,
  options?: NavigationOptions
): Promise<NavigationResult & { wasNavigated: boolean }>;

/**
 * Navigate forward with validation
 */
export async function goForwardAndVerify(
  session: BrowserSession | MockBrowserSession,
  expectedUrl?: string | RegExp,
  options?: NavigationOptions
): Promise<NavigationResult & { wasNavigated: boolean }>;

/**
 * Reload page with validation
 */
export async function reloadAndVerify(
  session: BrowserSession | MockBrowserSession,
  options?: NavigationOptions & { expectSameUrl?: boolean }
): Promise<NavigationResult>;

/**
 * Get current navigation state
 */
export async function getNavigationState(
  session: BrowserSession | MockBrowserSession
): Promise<{
  url: string;
  title: string;
  readyState: 'loading' | 'interactive' | 'complete';
  historyLength: number;
}>;
```

### 3. Navigation Fixtures API (`navigation-fixtures.ts`)

```typescript
/**
 * Navigation test fixtures for browser/page setup and teardown
 */

import type { BrowserManager, BrowserSession } from '../index.js';
import type { BrowserSessionConfig, CaptureConfig } from '../types.js';
import type { MockBrowserSession, MockScenarioConfig } from '../mocks/types.js';

/** Browser fixture with automatic cleanup */
export interface BrowserFixture {
  /** Browser manager instance */
  manager: BrowserManager;
  /** Browser session instance */
  session: BrowserSession;
  /** Cleanup function to call in afterEach */
  cleanup: () => Promise<void>;
}

/** Mock browser fixture for unit tests */
export interface MockBrowserFixture {
  /** Mock browser session */
  session: MockBrowserSession;
  /** Recorded operations for verification */
  getOperations: () => Array<{ name: string; args: unknown[]; result?: unknown }>;
  /** Reset fixture state */
  reset: () => void;
}

/** Configuration for browser fixtures */
export interface BrowserFixtureConfig {
  /** Session configuration */
  sessionConfig?: Partial<BrowserSessionConfig>;
  /** Capture configuration */
  captureConfig?: Partial<CaptureConfig>;
  /** Whether to launch on creation */
  autoLaunch?: boolean;
  /** Initial URL to navigate to */
  initialUrl?: string;
}

/**
 * Create a browser fixture for integration tests
 * Handles manager creation, session creation, launch, and cleanup
 *
 * @param config - Fixture configuration
 * @returns Browser fixture with automatic cleanup
 *
 * @example
 * ```typescript
 * describe('Navigation Tests', () => {
 *   let fixture: BrowserFixture;
 *
 *   beforeEach(async () => {
 *     fixture = await createBrowserFixture({
 *       sessionConfig: { headless: true, timeout: 10000 },
 *       autoLaunch: true,
 *       initialUrl: 'about:blank'
 *     });
 *   });
 *
 *   afterEach(async () => {
 *     await fixture.cleanup();
 *   });
 *
 *   it('should navigate', async () => {
 *     await fixture.session.goto('https://example.com');
 *   });
 * });
 * ```
 */
export async function createBrowserFixture(
  config?: BrowserFixtureConfig
): Promise<BrowserFixture>;

/**
 * Create a mock browser fixture for unit tests
 * No real browser - uses MockBrowserSession
 *
 * @param scenarioConfig - Mock scenario configuration
 * @returns Mock browser fixture
 */
export function createMockBrowserFixture(
  scenarioConfig?: MockScenarioConfig
): MockBrowserFixture;

/**
 * Vitest/Jest fixture helper using beforeEach/afterEach pattern
 *
 * @param config - Fixture configuration
 * @returns Setup and teardown hooks
 *
 * @example
 * ```typescript
 * const { useFixture, getSession } = createNavigationTestSuite({
 *   sessionConfig: { headless: true }
 * });
 *
 * describe('Navigation', () => {
 *   useFixture(); // Auto registers beforeEach/afterEach
 *
 *   it('should work', async () => {
 *     const session = getSession();
 *     await session.goto('https://example.com');
 *   });
 * });
 * ```
 */
export function createNavigationTestSuite(config?: BrowserFixtureConfig): {
  /** Register beforeEach/afterEach hooks */
  useFixture: () => void;
  /** Get current session (must call useFixture first) */
  getSession: () => BrowserSession;
  /** Get current manager */
  getManager: () => BrowserManager;
};

// ============================================================================
// Pre-built Navigation Scenarios
// ============================================================================

/** Navigation scenario for testing */
export interface NavigationScenario {
  name: string;
  description: string;
  /** URLs to navigate through */
  urls: string[];
  /** Expected final state */
  expectedState: {
    url?: string | RegExp;
    title?: string | RegExp;
    historyLength?: number;
  };
  /** Setup actions before navigation */
  setup?: (session: BrowserSession | MockBrowserSession) => Promise<void>;
  /** Verification actions after navigation */
  verify?: (session: BrowserSession | MockBrowserSession) => Promise<void>;
}

/**
 * Pre-built navigation test scenarios
 */
export const navigationScenarios: {
  /** Basic page load scenario */
  basicPageLoad: NavigationScenario;
  /** Multiple page navigation with history */
  multiPageHistory: NavigationScenario;
  /** Back/forward navigation */
  backForwardNavigation: NavigationScenario;
  /** Page reload scenario */
  pageReload: NavigationScenario;
  /** Redirect handling */
  redirectChain: NavigationScenario;
  /** Timeout scenario */
  slowPageLoad: NavigationScenario;
  /** Navigation error scenario */
  navigationError: NavigationScenario;
  /** Form submission navigation */
  formSubmitNavigation: NavigationScenario;
  /** Hash navigation (SPA-style) */
  hashNavigation: NavigationScenario;
  /** Query parameter changes */
  queryParamNavigation: NavigationScenario;
};

/**
 * Create a custom navigation scenario
 */
export function createNavigationScenario(
  config: Partial<NavigationScenario>
): NavigationScenario;

/**
 * Run a navigation scenario with assertions
 */
export async function runNavigationScenario(
  session: BrowserSession | MockBrowserSession,
  scenario: NavigationScenario
): Promise<{
  success: boolean;
  results: NavigationResult[];
  errors: string[];
}>;
```

### 4. Navigation Assertions API (`navigation-assertions.ts`)

```typescript
/**
 * Navigation-specific assertion helpers
 */

import type { BrowserSession } from '../browser-session.js';
import type { MockBrowserSession } from '../mocks/mock-browser-session.js';
import type { AssertionResult } from './assertions.js';

/**
 * Assert current URL matches expected pattern
 */
export async function assertUrl(
  session: BrowserSession | MockBrowserSession,
  expected: string | RegExp,
  message?: string
): Promise<AssertionResult>;

/**
 * Assert page title matches expected pattern
 */
export async function assertTitle(
  session: BrowserSession | MockBrowserSession,
  expected: string | RegExp,
  message?: string
): Promise<AssertionResult>;

/**
 * Assert navigation completed successfully
 */
export async function assertNavigationSuccess(
  result: { success: boolean; error?: string; duration: number },
  options?: {
    maxDuration?: number;
    message?: string;
  }
): AssertionResult;

/**
 * Assert page is fully loaded
 */
export async function assertPageLoaded(
  session: BrowserSession | MockBrowserSession,
  options?: {
    timeout?: number;
    expectedElements?: string[];
  }
): Promise<AssertionResult>;

/**
 * Assert page content contains expected text/pattern
 */
export async function assertPageContains(
  session: BrowserSession | MockBrowserSession,
  content: string | RegExp,
  options?: {
    selector?: string;
    timeout?: number;
  }
): Promise<AssertionResult>;

/**
 * Assert navigation history state
 */
export async function assertHistoryState(
  session: BrowserSession | MockBrowserSession,
  expected: {
    length?: number;
    canGoBack?: boolean;
    canGoForward?: boolean;
  }
): Promise<AssertionResult>;

/**
 * Assert no navigation errors occurred
 */
export async function assertNoNavigationErrors(
  session: BrowserSession | MockBrowserSession
): Promise<AssertionResult>;

/**
 * Compound assertion for complete navigation state
 */
export async function assertNavigationState(
  session: BrowserSession | MockBrowserSession,
  expected: {
    url?: string | RegExp;
    title?: string | RegExp;
    loaded?: boolean;
    content?: string | RegExp;
    elements?: string[];
    noErrors?: boolean;
  }
): Promise<AssertionResult>;
```

### 5. Integration with Existing Test Utils

Update `packages/browser/src/test-utils/index.ts` to include new exports:

```typescript
// Existing exports...

// Navigation Helpers
export {
  navigateTo,
  navigateAndWaitForContent,
  navigateSequence,
  waitForNavigation,
  buildNavigationHistory,
  goBackAndVerify,
  goForwardAndVerify,
  reloadAndVerify,
  getNavigationState,
} from './navigation-helpers.js';

export type {
  NavigationResult,
  NavigationHelperOptions,
} from './navigation-helpers.js';

// Navigation Fixtures
export {
  createBrowserFixture,
  createMockBrowserFixture,
  createNavigationTestSuite,
  navigationScenarios,
  createNavigationScenario,
  runNavigationScenario,
} from './navigation-fixtures.js';

export type {
  BrowserFixture,
  MockBrowserFixture,
  BrowserFixtureConfig,
  NavigationScenario,
} from './navigation-fixtures.js';

// Navigation Assertions
export {
  assertUrl,
  assertTitle,
  assertNavigationSuccess,
  assertPageLoaded,
  assertPageContains,
  assertHistoryState,
  assertNoNavigationErrors,
  assertNavigationState,
} from './navigation-assertions.js';
```

### 6. Type Safety and Integration

All helpers work with both:
- `BrowserSession` (real Playwright-backed sessions)
- `MockBrowserSession` (for unit tests)

Union types ensure type safety:
```typescript
type TestableSession = BrowserSession | MockBrowserSession;
```

### 7. Test Isolation Pattern

Each fixture enforces test isolation:

```typescript
// Browser fixtures manage their own lifecycle
const fixture = await createBrowserFixture({ autoLaunch: true });
// ... run tests ...
await fixture.cleanup(); // Closes browser, clears context

// Mock fixtures are stateless
const mockFixture = createMockBrowserFixture();
// ... run tests ...
mockFixture.reset(); // Clears operation history
```

## Implementation Plan

### Phase 1: Core Helpers (Developer Stage)
1. Implement `navigation-helpers.ts` with basic navigation functions
2. Add unit tests for all helper functions
3. Ensure type compatibility with both real and mock sessions

### Phase 2: Fixtures (Developer Stage)
1. Implement `navigation-fixtures.ts` with fixture factories
2. Create pre-built navigation scenarios
3. Add tests for fixture lifecycle management

### Phase 3: Assertions (Developer Stage)
1. Implement `navigation-assertions.ts`
2. Integrate with existing assertion framework
3. Add comprehensive tests

### Phase 4: Integration (Developer/Tester Stage)
1. Update barrel exports
2. Migrate existing navigation tests to use new utilities
3. Add integration tests demonstrating usage patterns

## Testing Strategy

### Unit Tests
- Test each helper function with MockBrowserSession
- Verify error handling and edge cases
- Test timeout scenarios with mocked delays

### Integration Tests
- Test BrowserFixture with real Playwright
- Verify cleanup happens correctly
- Test multi-page navigation scenarios

### Usage Examples in Tests
```typescript
// packages/browser/src/test-utils/__tests__/navigation-helpers.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createBrowserFixture,
  navigateTo,
  assertUrl,
  assertNavigationSuccess,
  navigationScenarios,
  runNavigationScenario
} from '../index.js';

describe('Navigation Helpers', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await createBrowserFixture({ autoLaunch: true });
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  it('should navigate with validation', async () => {
    const result = await navigateTo(fixture.session, 'data:text/html,<h1>Test</h1>', {
      expectedTitle: /Test/
    });

    assertNavigationSuccess(result);
    await assertUrl(fixture.session, /data:text\/html/);
  });

  it('should run pre-built scenarios', async () => {
    const result = await runNavigationScenario(
      fixture.session,
      navigationScenarios.basicPageLoad
    );

    expect(result.success).toBe(true);
  });
});
```

## Consequences

### Positive
- Consistent navigation testing patterns across all browser tests
- Reduced code duplication in navigation-related tests
- Type-safe APIs that work with both real and mock sessions
- Built-in test isolation through fixture pattern
- Pre-built scenarios accelerate test development
- Clear documentation through well-typed interfaces

### Negative
- Additional abstraction layer may hide some Playwright details
- Learning curve for new developers unfamiliar with fixture pattern
- Maintenance overhead for two parallel APIs (helpers + fixtures)

### Risks
- Fixture cleanup failures could leak browser processes
- Mock behavior may drift from real Playwright behavior
- Pre-built scenarios may not cover all edge cases

### Mitigations
- Automatic cleanup with error handling and force-close fallback
- Integration tests that run same scenarios on both mock and real sessions
- Extensible scenario system for custom cases

## References

- `packages/browser/src/browser-session.ts` - BrowserSession implementation
- `packages/browser/src/mocks/mock-browser-session.ts` - MockBrowserSession implementation
- `packages/browser/src/test-utils/assertions.ts` - Existing assertion patterns
- `packages/browser/src/__tests__/navigation-acceptance-criteria.test.ts` - Current navigation tests
- `packages/core/src/test-fixtures/setup-teardown.ts` - Core fixture patterns
- `tests/browser-integration/fixtures/common-scenarios.ts` - Integration test scenarios
