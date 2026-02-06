# ADR-007: Browser Context and Session Management Integration Tests

## Status
Accepted

## Context

We need to create comprehensive integration tests for browser context and session management functionality in the `@apexcli/browser` package. The acceptance criteria require tests covering:

1. Cookie manipulation
2. localStorage/sessionStorage handling
3. Multiple browser contexts isolation
4. Session persistence
5. Incognito/private browsing contexts

### Current Architecture

The browser package uses Playwright as the underlying automation engine with two main classes:

- **BrowserManager** (`browser-manager.ts`): Manages browser instances, contexts, and their lifecycle
- **BrowserSession** (`browser-session.ts`): Wraps Playwright's Page with session management, console/error capture

The architecture supports:
- Multiple browser types (chromium, firefox, webkit)
- Browser instance pooling and reuse
- Context isolation between sessions
- Resource monitoring and cleanup

### Playwright Capabilities

Playwright provides rich APIs for context and session management:
- `BrowserContext.cookies()` - Get cookies
- `BrowserContext.addCookies()` - Set cookies
- `BrowserContext.clearCookies()` - Clear cookies
- `BrowserContext.storageState()` - Get/save storage state (cookies + localStorage)
- `Page.evaluate()` - Access localStorage/sessionStorage
- `Browser.newContext({ storageState })` - Restore session state
- `Browser.newContext()` - Create isolated incognito-like contexts (no shared state)

## Decision

### Test File Structure

Create a single comprehensive test file:
```
packages/browser/src/__tests__/browser-context-session-management.test.ts
```

### Test Categories and Coverage

#### 1. Cookie Manipulation Tests

```typescript
describe('Cookie Manipulation', () => {
  // Test setting individual cookies
  // Test getting all cookies
  // Test cookie properties (name, value, domain, path, expires, httpOnly, secure, sameSite)
  // Test clearing specific cookies
  // Test clearing all cookies
  // Test cookie persistence across page navigations within same context
  // Test cookies with special characters
  // Test secure cookies (HTTPS-only)
  // Test HttpOnly cookies
});
```

**Implementation Approach:**
- Use Playwright's `context.addCookies()` to set cookies
- Use `context.cookies()` to retrieve and verify cookies
- Use `context.clearCookies()` to clear cookies
- Navigate to local test pages (data: URLs) to verify cookie behavior

#### 2. localStorage/sessionStorage Handling Tests

```typescript
describe('Web Storage Handling', () => {
  describe('localStorage', () => {
    // Test setting localStorage values
    // Test getting localStorage values
    // Test removing localStorage items
    // Test clearing all localStorage
    // Test localStorage persistence across page reloads
    // Test localStorage persistence across tabs (same context)
    // Test localStorage isolation between contexts
    // Test storage limits and error handling
  });

  describe('sessionStorage', () => {
    // Test setting sessionStorage values
    // Test getting sessionStorage values
    // Test sessionStorage isolation per page
    // Test sessionStorage NOT persisting to new tabs
    // Test sessionStorage clearing on context close
  });
});
```

**Implementation Approach:**
- Use `page.evaluate()` to interact with Web Storage APIs
- Create helper functions for common storage operations
- Test both string and JSON-serialized complex objects

#### 3. Multiple Browser Contexts Isolation Tests

```typescript
describe('Context Isolation', () => {
  // Test cookie isolation between contexts
  // Test localStorage isolation between contexts
  // Test sessionStorage isolation between contexts
  // Test JavaScript global state isolation
  // Test IndexedDB isolation between contexts
  // Test cache isolation between contexts
  // Test network state isolation (authentication)
  // Test permission state isolation
  // Test parallel context operations don't interfere
});
```

**Implementation Approach:**
- Create multiple contexts from same browser instance
- Verify state changes in one context don't affect others
- Use concurrent operations to test race conditions
- Test both same-browser-type and cross-browser-type isolation

#### 4. Session Persistence Tests

```typescript
describe('Session Persistence', () => {
  // Test storageState export
  // Test storageState import/restore
  // Test cookies persist through storageState
  // Test localStorage persists through storageState
  // Test origin-specific storage state
  // Test session restore after browser restart
  // Test partial storage state (cookies only, storage only)
  // Test storageState file save/load
});
```

**Implementation Approach:**
- Use `context.storageState()` to export session state
- Create new context with `storageState` option to restore
- Verify all session data (cookies, localStorage) is properly restored

#### 5. Incognito/Private Browsing Context Tests

```typescript
describe('Incognito/Private Browsing Contexts', () => {
  // Test new context has no cookies from other contexts
  // Test new context has no localStorage from other contexts
  // Test new context has no sessionStorage
  // Test context doesn't share cache
  // Test context close clears all data
  // Test incognito context doesn't persist after close
  // Test multiple incognito contexts are isolated from each other
  // Test incognito context doesn't affect normal contexts
});
```

**Implementation Approach:**
- In Playwright, every `newContext()` is essentially incognito (isolated)
- Create contexts without `storageState` option
- Verify no pre-existing state exists
- Verify state is cleared on context close

### Test Utilities Design

Create helper utilities for common test operations:

```typescript
// Storage manipulation helpers
interface StorageHelpers {
  setLocalStorage(page: Page, key: string, value: string): Promise<void>;
  getLocalStorage(page: Page, key: string): Promise<string | null>;
  clearLocalStorage(page: Page): Promise<void>;
  setSessionStorage(page: Page, key: string, value: string): Promise<void>;
  getSessionStorage(page: Page, key: string): Promise<string | null>;
  clearSessionStorage(page: Page): Promise<void>;
}

// Cookie manipulation helpers
interface CookieHelpers {
  setCookie(context: BrowserContext, cookie: CookieParam): Promise<void>;
  getCookies(context: BrowserContext, url?: string): Promise<Cookie[]>;
  getCookie(context: BrowserContext, name: string): Promise<Cookie | undefined>;
  clearCookies(context: BrowserContext): Promise<void>;
}

// Context isolation verification helpers
interface IsolationHelpers {
  verifyContextsIsolated(context1: BrowserContext, context2: BrowserContext): Promise<boolean>;
  verifyStorageIsolated(page1: Page, page2: Page): Promise<boolean>;
}
```

### Test Data Fixtures

Create test HTML pages for storage operations:

```typescript
const testPages = {
  storageTest: `data:text/html,
    <!DOCTYPE html>
    <html>
      <head><title>Storage Test</title></head>
      <body>
        <h1>Storage Test Page</h1>
        <script>
          // Storage interaction helpers exposed globally
          window.setLS = (k, v) => localStorage.setItem(k, v);
          window.getLS = (k) => localStorage.getItem(k);
          window.setSS = (k, v) => sessionStorage.setItem(k, v);
          window.getSS = (k) => sessionStorage.getItem(k);
        </script>
      </body>
    </html>
  `,
  cookieTest: `data:text/html,
    <!DOCTYPE html>
    <html>
      <head><title>Cookie Test</title></head>
      <body>
        <h1>Cookie Test Page</h1>
        <script>
          window.getCookies = () => document.cookie;
        </script>
      </body>
    </html>
  `
};
```

### Test Execution Strategy

1. **Setup**: Create BrowserManager, launch browser instance
2. **Per-test**: Create isolated contexts, perform operations, verify results
3. **Teardown**: Close contexts, cleanup resources

```typescript
describe('Browser Context and Session Management', () => {
  let manager: BrowserManager;

  beforeAll(async () => {
    manager = new BrowserManager();
  });

  afterAll(async () => {
    await manager.shutdown();
  });

  // Each test category follows...
});
```

### Performance Considerations

- Use `beforeAll`/`afterAll` for expensive operations (browser launch)
- Use `beforeEach`/`afterEach` for context-level isolation
- Parallelize independent test suites where possible
- Use data: URLs instead of network requests for faster tests

### Error Handling

Tests should verify:
- Graceful handling of storage quota exceeded
- Proper error messages for invalid cookie parameters
- Context close behavior when storage operations are pending
- Recovery from browser/context crashes

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                     Test Suite Structure                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────┐   ┌─────────────────┐                     │
│  │  BrowserManager │   │  Test Utilities │                     │
│  │                 │   │                 │                     │
│  │  - launchBrowser│   │  - Storage Hlprs│                     │
│  │  - createContext│   │  - Cookie Hlprs │                     │
│  │  - shutdown     │   │  - Isolation    │                     │
│  └────────┬────────┘   └────────┬────────┘                     │
│           │                     │                              │
│           ▼                     ▼                              │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                   Test Categories                       │    │
│  ├────────────────────────────────────────────────────────┤    │
│  │                                                        │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │    │
│  │  │    Cookie    │  │  WebStorage  │  │   Context    │  │    │
│  │  │ Manipulation │  │   Handling   │  │  Isolation   │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │    │
│  │                                                        │    │
│  │  ┌──────────────┐  ┌──────────────┐                    │    │
│  │  │   Session    │  │  Incognito   │                    │    │
│  │  │ Persistence  │  │   Context    │                    │    │
│  │  └──────────────┘  └──────────────┘                    │    │
│  │                                                        │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Dependencies

- **Playwright**: Core browser automation (already installed)
- **Vitest**: Test framework (already installed)
- **BrowserManager**: From `@apexcli/browser`
- **BrowserSession**: From `@apexcli/browser`

## Implementation Notes for Developer Stage

1. **File Location**: `packages/browser/src/__tests__/browser-context-session-management.test.ts`

2. **Test Timeout**: Set appropriate timeouts for browser operations (15-30 seconds)

3. **Browser Selection**: Use Chromium for primary tests (fastest), optionally add cross-browser tests for critical paths

4. **Parallel Execution**: Vitest runs tests in parallel by default; ensure tests are truly isolated

5. **Resource Cleanup**: Always close contexts and sessions in `afterEach` to prevent resource leaks

6. **CI Considerations**: Tests should work in headless mode without display server

## Consequences

### Positive
- Comprehensive coverage of session management functionality
- Clear verification of context isolation
- Tests serve as documentation for storage APIs
- Early detection of isolation bugs

### Negative
- Integration tests are slower than unit tests
- Browser-dependent tests may have flaky edge cases
- Resource usage during parallel test execution

## Related ADRs

- ADR-001: Browser Package Architecture
- ADR-003: Test Strategy

## References

- [Playwright BrowserContext API](https://playwright.dev/docs/api/class-browsercontext)
- [Playwright Cookies API](https://playwright.dev/docs/api/class-browsercontext#browser-context-cookies)
- [Playwright Storage State](https://playwright.dev/docs/api/class-browsercontext#browser-context-storage-state)
