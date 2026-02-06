# ADR-060: Browser Automation Test Infrastructure Architecture

## Status
Accepted

## Context

APEX requires comprehensive test infrastructure for browser automation integration tests. This includes test utilities, mocks for browser automation, and permission test helpers that can simulate browser automation contexts and permission requests/responses without launching real browsers.

## Decision

### Architecture Overview

The browser automation test infrastructure is organized into a layered architecture with clear separation of concerns:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    Test Execution Layer                                       │
│  tests/browser-integration/                                                   │
│  ├── vitest.config.ts     (Browser-specific test configuration)              │
│  ├── setup.ts             (Global hooks & browser test context)              │
│  └── **/*.test.ts         (139+ test files)                                  │
└─────────────────────────────┬────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────────────────┐
│                    Test Utilities Layer                                       │
│  tests/test-utils/                                                           │
│  ├── index.ts             (Central exports, test fixtures)                   │
│  ├── browser-test-base.ts (BrowserTestBase class)                           │
│  ├── browser-utils.ts     (Mock configs, state assertions)                   │
│  ├── context.ts           (Test context management)                          │
│  ├── cleanup.ts           (Resource cleanup utilities)                       │
│  └── assertions.ts        (Common assertion helpers)                         │
└─────────────────────────────┬────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────────────────┐
│                    Mock Infrastructure Layer                                  │
│  packages/browser/src/                                                        │
│  ├── mocks/               (Browser automation mocks)                         │
│  │   ├── index.ts         (Factory functions, exports)                       │
│  │   ├── mock-browser-session.ts  (MockBrowserSession class)                 │
│  │   ├── mock-browser-manager.ts  (MockBrowserManager class)                 │
│  │   ├── scenario-builder.ts      (Fluent scenario configuration)            │
│  │   └── types.ts         (Mock type definitions)                            │
│  ├── permission-mocking/  (Permission API mocking)                           │
│  │   ├── index.ts         (mockPermissions, withMockedPermissions)           │
│  │   ├── mock-permissions.ts      (MockPermissionHandle implementation)      │
│  │   ├── mock-permission-status.ts (MockPermissionStatus class)              │
│  │   └── types.ts         (Permission types, 20+ permission names)           │
│  └── test-utils/          (Browser-specific test utilities)                  │
│      ├── index.ts         (Barrel exports)                                   │
│      ├── mock-page-objects.ts     (createMockPage, createMockElement)        │
│      ├── dom-builders.ts          (buildFormHtml, buildTableHtml, etc.)      │
│      ├── url-generators.ts        (generateTestUrl, testUrls)                │
│      ├── assertions.ts            (assertNavigationState, etc.)              │
│      ├── validators.ts            (ScreenshotValidators class)               │
│      ├── performance.ts           (PerformanceMonitor class)                 │
│      └── mock-scenarios.ts        (MockScenarios presets)                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1. Test Configuration (`tests/browser-integration/vitest.config.ts`)

Browser integration tests use a specialized Vitest configuration:

```typescript
{
  test: {
    globals: true,
    environment: 'node',  // Node for Playwright control, not jsdom
    testTimeout: 60000,   // Extended for browser operations
    hookTimeout: 30000,   // Setup/teardown timeout
    setupFiles: ['./setup.ts'],
    sequence: { shuffle: false },  // Sequential execution
    pool: 'forks',
    poolOptions: {
      forks: { maxForks: 2, minForks: 1 }  // Limited concurrency
    },
    retry: process.env.CI ? 2 : 0  // CI retry logic
  }
}
```

**Key Design Choices:**
- Node environment (not jsdom) because tests control browsers externally via Playwright
- Extended timeouts for browser lifecycle operations
- Limited fork concurrency to prevent browser resource conflicts
- CI-specific retry logic for flaky browser tests

### 2. Global Test Setup (`tests/browser-integration/setup.ts`)

Provides consistent browser test context and lifecycle hooks:

```typescript
export interface BrowserTestContext {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  tempDir?: string;
  screenshots?: string[];
}

// Global hooks for browser resource management
beforeAll(async () => {
  globalThis.browserTestContext = { screenshots: [] };
  globalThis.browserTestContext.tempDir = await createTempDir();
});

afterAll(async () => {
  // Cleanup: page → context → browser → tempDir
});

beforeEach(async () => {
  // Clear cookies and storage between tests
});

afterEach(async () => {
  // Capture failure screenshots for debugging
});
```

### 3. Browser Automation Mocks (`packages/browser/src/mocks/`)

#### MockBrowserSession

Full browser session simulation without actual browser:

```typescript
const session = createMockBrowserSession({
  browserType: 'chromium',
  headless: true,
  mockConfig: {
    defaultSuccess: true,
    defaultDelay: 10,  // Fast for testing
    failureRate: 0,
    useRealisticDelays: false
  }
});

await session.navigate('https://example.com');
await session.click('#button');
const screenshot = await session.screenshot();
```

**Capabilities:**
- Navigation simulation with configurable timing
- Element interaction (click, type, hover, scroll)
- Screenshot capture (returns mock buffer)
- Console message and error tracking
- Event emission for state changes
- Operation history for verification

#### MockBrowserManager

Simulates browser instance lifecycle management:

```typescript
const manager = createMockBrowserManager({
  maxInstances: 5,
  reuseInstances: true,
  idleTimeout: 300000
});

const session = await manager.createSession();
await manager.cleanup();
```

#### Scenario Builder

Fluent API for complex test scenarios:

```typescript
const scenario = createMockScenario()
  .forUrl('https://example.com', {
    loadTime: 500,
    title: 'Example Page'
  })
  .forElement('#submit', {
    visible: true,
    enabled: true
  })
  .forOperation('click', {
    success: true,
    delay: 100
  })
  .build();

const session = createMockBrowserSession({}, scenario);
```

### 4. Permission Mocking (`packages/browser/src/permission-mocking/`)

Complete Permission API mocking for testing permission-dependent functionality:

```typescript
// Basic usage
const handle = mockPermissions({
  initialStates: {
    'geolocation': 'granted',
    'notifications': 'denied',
    'camera': 'prompt'
  }
});

// Query returns MockPermissionStatus
const status = await navigator.permissions.query({ name: 'notifications' });
console.log(status.state);  // 'denied'

// Programmatic state changes trigger events
status.onchange = () => console.log('Changed!');
handle.setState('notifications', 'granted');  // Triggers event

// Cleanup
handle.restore();
```

**Context Manager Pattern:**

```typescript
await withMockedPermissions(
  { initialStates: { notifications: 'granted' } },
  async (handle) => {
    // Permissions are mocked within this scope
    const status = await navigator.permissions.query({ name: 'notifications' });
    expect(status.state).toBe('granted');
  }
);
// Permissions automatically restored
```

**Supported Permissions (20+ types):**
- geolocation, notifications, push, midi
- camera, microphone, speaker, device-info
- background-fetch, background-sync, persistent-storage
- ambient-light-sensor, accelerometer, gyroscope, magnetometer
- clipboard-read, clipboard-write
- payment-handler, screen-wake-lock, xr-spatial-tracking

### 5. Test Utilities (`packages/browser/src/test-utils/`)

#### Mock Page Objects

```typescript
const page = createMockPage({
  url: 'https://example.com',
  title: 'Test Page',
  elements: [
    { selector: '#form', tag: 'form', visible: true },
    { selector: '#submit', tag: 'button', enabled: true }
  ]
});

const formPage = createMockPageWithForm({
  action: '/submit',
  method: 'POST',
  fields: [
    { name: 'email', type: 'email', required: true },
    { name: 'password', type: 'password', required: true }
  ]
});
```

#### DOM Builders

Generate realistic HTML for testing:

```typescript
const formHtml = buildFormHtml({
  id: 'login-form',
  fields: [
    { name: 'username', type: 'text', label: 'Username' },
    { name: 'password', type: 'password', label: 'Password' }
  ],
  submitText: 'Login'
});

const tableHtml = buildTableHtml({
  headers: ['Name', 'Email', 'Role'],
  rows: [
    ['Alice', 'alice@example.com', 'Admin'],
    ['Bob', 'bob@example.com', 'User']
  ]
});

const completePage = buildCompletePage({
  title: 'Test Application',
  navigation: { links: [{ text: 'Home', href: '/' }] },
  content: formHtml
});
```

#### URL Generators

```typescript
const testUrl = generateTestUrl({
  scheme: 'https',
  host: 'api.example.com',
  path: '/v1/users',
  query: { page: '1', limit: '10' }
});  // 'https://api.example.com/v1/users?page=1&limit=10'

const urls = testUrls;  // Pre-built URL sets
urls.login  // 'https://test.example.com/login'
urls.api    // 'https://api.example.com/v1'
```

#### Assertions

```typescript
// Navigation state
assertNavigationState(mockPage, {
  url: 'https://example.com',
  title: 'Example Page'
});

// Element assertions
assertElementExists(mockPage, '#submit');
assertElementVisible(mockPage, '#submit');
assertElementEnabled(mockPage, '#submit');
assertElementText(mockPage, '#heading', 'Welcome');

// Browser state
assertBrowserState(mockPage, {
  url: /example\.com/,
  title: 'Example Page',
  elementsPresent: ['#form', '#submit'],
  elementsAbsent: ['#error'],
  textContent: [
    { selector: '#heading', text: 'Welcome' }
  ]
});

// No errors
assertNoErrors(mockPage);
```

### 6. Central Test Utilities (`tests/test-utils/`)

Unified entry point for all test utilities:

```typescript
import {
  // Browser test utilities
  createMockPage,
  createMockElement,
  buildFormHtml,
  generateTestUrl,
  assertNavigationState,

  // Test environment
  createTestEnvironment,
  setupTest,
  runWithCleanup,

  // Fixtures
  testFixtures,
  testUtils,

  // Vitest
  describe, it, expect, beforeEach, afterEach, vi
} from '../../tests/test-utils';
```

### 7. Integration with Browser Tool

The test infrastructure integrates with the BrowserTool via the MCP server pattern:

```
┌─────────────────────────────────────────────────────────────┐
│  Integration Test                                            │
│  Uses MockBrowserSession instead of real Playwright         │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  BrowserTool.execute(params)                                │
│  - Permission checking (mocked via mockPermissions())       │
│  - Operation execution (delegated to mock session)          │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  MockBrowserSession                                         │
│  - Simulates browser operations                             │
│  - Returns configurable results                             │
│  - Tracks operation history                                 │
└─────────────────────────────────────────────────────────────┘
```

### 8. Package Exports

The browser package exports test utilities through dedicated entry points:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./mocks": "./dist/mocks/index.js",
    "./test-utils": "./dist/test-utils.js"
  }
}
```

**Usage:**
```typescript
// Production code
import { BrowserSession } from '@apex/browser';

// Test code
import { MockBrowserSession, createMockBrowserManager } from '@apex/browser/mocks';
import { createMockPage, assertNavigationState } from '@apex/browser/test-utils';
```

## Consequences

### Positive

1. **No Browser Dependencies in CI**: Tests can run without Playwright browsers installed
2. **Fast Execution**: Mock operations complete in milliseconds vs seconds for real browsers
3. **Deterministic**: No network latency, no flaky browser state
4. **Comprehensive Permission Testing**: Full control over Permission API behavior
5. **Reusable Utilities**: Centralized utilities reduce test code duplication
6. **Typed Scenarios**: TypeScript ensures valid mock configurations

### Negative

1. **Behavioral Drift**: Mocks may not perfectly match real browser behavior
2. **Maintenance Overhead**: Mock implementations must be updated when real APIs change
3. **False Positives**: Tests may pass with mocks but fail with real browsers

### Mitigations

1. **E2E Tests**: A small suite of real browser tests validates mock accuracy
2. **API Contracts**: Mock interfaces mirror Playwright's public API surface
3. **Scenario Verification**: Common scenarios are tested against real browsers periodically

## Files Summary

| Location | Purpose |
|----------|---------|
| `tests/browser-integration/vitest.config.ts` | Browser test configuration |
| `tests/browser-integration/setup.ts` | Global test setup/teardown |
| `tests/browser-integration/utils/test-helpers.ts` | Playwright-specific helpers |
| `tests/test-utils/index.ts` | Central utility exports |
| `tests/test-utils/browser-test-base.ts` | BrowserTestBase class |
| `tests/test-utils/browser-utils.ts` | Mock configs, state assertions |
| `packages/browser/src/mocks/index.ts` | Mock factory functions |
| `packages/browser/src/mocks/mock-browser-session.ts` | MockBrowserSession |
| `packages/browser/src/mocks/mock-browser-manager.ts` | MockBrowserManager |
| `packages/browser/src/mocks/scenario-builder.ts` | Fluent scenario builder |
| `packages/browser/src/permission-mocking/index.ts` | Permission mocking |
| `packages/browser/src/permission-mocking/mock-permissions.ts` | MockPermissionHandle |
| `packages/browser/src/test-utils/index.ts` | Browser test utility exports |
| `packages/browser/src/test-utils/mock-page-objects.ts` | Page object factories |
| `packages/browser/src/test-utils/dom-builders.ts` | HTML generators |
| `packages/browser/src/test-utils/url-generators.ts` | URL utilities |
| `packages/browser/src/test-utils/assertions.ts` | Browser state assertions |

## References

- `packages/orchestrator/src/tools/browser-tool.adr.md` - BrowserTool architecture
- `vitest.shared.config.ts` - Shared Vitest configuration factories
- W3C Permissions API Specification: https://w3c.github.io/permissions/
- Playwright Testing Library: https://playwright.dev/docs/api/class-browser
