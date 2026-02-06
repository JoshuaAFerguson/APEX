# ADR-051: Multi-Page Browser Workflow Integration Tests

## Status
Proposed

## Date
2025-02-05

## Context

The APEX Browser automation package (`@apexcli/browser`) needs comprehensive integration tests for multi-page browser workflows. The acceptance criteria require testing:

1. Multi-step navigation flows
2. State persistence across pages
3. Handling redirects (301/302)
4. Back/forward navigation
5. Complex user journey simulations

### Existing Infrastructure Analysis

The `BrowserSession` class in `packages/browser/src/browser-session.ts` already provides:

- `navigate(url, options)` / `goto(url, options)` - Navigate to URLs
- `goBack(options)` - Navigate backward in history
- `goForward(options)` - Navigate forward in history
- `reload(options)` - Reload current page
- `waitForNavigation(options)` - Wait for navigation completion
- `evaluate(script)` - Execute JavaScript in browser context
- `getCurrentUrl()` - Get current page URL
- `getTitle()` - Get page title
- Console and error capture via EventEmitter pattern

The `BrowserManager` class handles instance pooling and lifecycle management.

### Test Utilities Available

- `packages/browser/src/test-utils/test-pages.ts` - HTML test page generators
- `packages/browser/src/test-utils/dom-builders.ts` - DOM structure builders
- `packages/browser/src/test-utils/assertions.ts` - Browser test assertions
- `packages/browser/src/mocks/` - Mock implementations for unit testing

## Decision

### Test File Location

Create a new test file at:
```
packages/browser/src/__tests__/multipage-workflow-integration.test.ts
```

This follows the existing pattern where integration tests live in `__tests__/` directories alongside the source code.

### Technical Architecture

#### 1. Test Page Generator for Multi-Page Workflows

Create test HTML pages that simulate realistic multi-page scenarios:

```typescript
const MultiPageTestPages = {
  // Home page with navigation links
  homePage: () => `...`,

  // Product listing page
  productList: () => `...`,

  // Product detail page with dynamic state
  productDetail: (id: string) => `...`,

  // Checkout flow pages (multi-step form)
  checkout: {
    cart: () => `...`,
    shipping: () => `...`,
    payment: () => `...`,
    confirmation: () => `...`,
  },

  // Redirect simulation pages
  redirectSource: (statusCode: 301 | 302) => `...`,
  redirectTarget: () => `...`,

  // State persistence test pages
  statefulPage: () => `...`, // Uses localStorage/sessionStorage
};
```

#### 2. Test Categories

##### Category A: Multi-Step Navigation Flows
- Test sequential page navigation
- Verify URL changes after each step
- Validate page content at each step
- Test navigation timing and waiting

##### Category B: State Persistence Across Pages
- Test localStorage persistence
- Test sessionStorage persistence
- Test cookie persistence
- Validate state restoration on page reload
- Test state sharing between pages

##### Category C: Redirect Handling (301/302)
- Test 301 permanent redirects
- Test 302 temporary redirects
- Verify final URL after redirect chain
- Test redirect loops (with timeout)
- Validate redirect metadata capture

##### Category D: Back/Forward Navigation
- Test goBack() with multiple history entries
- Test goForward() after going back
- Validate page state after navigation
- Test edge cases (no history, empty forward stack)
- Test navigation with hash changes

##### Category E: Complex User Journey Simulations
- E-commerce checkout flow simulation
- Multi-step form wizard
- Login -> Dashboard -> Actions flow
- Search -> Filter -> Detail page flow

### Test Implementation Pattern

```typescript
describe('Multi-Page Browser Workflow Integration Tests', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(async () => {
    manager = new BrowserManager();
    session = new BrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
    });
    await session.launch();
  });

  afterEach(async () => {
    await session.close();
    await manager.shutdown();
  });

  describe('Multi-Step Navigation Flows', () => {
    it('should navigate through multi-page sequence', async () => {
      // Navigate to page 1
      const nav1 = await session.navigate('data:text/html,...');
      expect(nav1.success).toBe(true);

      // Click link to page 2
      await session.click('a[href="page2"]');
      await session.waitForNavigation();

      // Verify page 2 content
      const title = await session.getTitle();
      expect(title.data).toBe('Page 2');
    });
  });

  // ... additional test categories
});
```

### Redirect Testing Strategy

Since we're using `data:` URLs for testing, true HTTP redirects require a different approach:

1. **Approach A (Preferred)**: Use Playwright's route interception to simulate redirects:
```typescript
const page = session.getPage();
await page?.route('**/redirect-source', (route) => {
  route.fulfill({
    status: 302,
    headers: { Location: 'http://example.com/target' },
  });
});
```

2. **Approach B**: Use JavaScript-based redirects for functional testing:
```typescript
const redirectPage = `
  <script>window.location.replace('target-url');</script>
`;
```

3. **Approach C**: Meta refresh redirects for timing tests:
```typescript
const metaRedirect = `
  <meta http-equiv="refresh" content="0;url=target-url">
`;
```

### State Persistence Testing Strategy

Test pages will use localStorage and sessionStorage:

```typescript
const statefulPage = `
  <script>
    // Store state
    localStorage.setItem('testKey', 'persistedValue');
    sessionStorage.setItem('sessionKey', 'sessionValue');

    // Display current state
    document.body.innerHTML = JSON.stringify({
      local: localStorage.getItem('testKey'),
      session: sessionStorage.getItem('sessionKey'),
    });
  </script>
`;
```

Verify persistence by navigating away and back:
```typescript
it('should persist localStorage across page navigations', async () => {
  await session.navigate(pageWithStateSet);
  await session.navigate(differentPage);
  await session.goBack();

  const state = await session.evaluate(() =>
    localStorage.getItem('testKey')
  );
  expect(state.data).toBe('persistedValue');
});
```

### Expected Test Count and Coverage

| Category | Test Count | Description |
|----------|------------|-------------|
| Multi-step navigation | 5-7 | Sequential flows, timing, content validation |
| State persistence | 6-8 | localStorage, sessionStorage, cookies, reload |
| Redirect handling | 5-6 | 301, 302, chains, loops, meta refresh |
| Back/forward | 6-8 | History navigation, edge cases, state |
| User journeys | 4-6 | E-commerce, forms, auth flows |
| **Total** | **26-35** | Comprehensive coverage |

## Consequences

### Positive
- Comprehensive coverage of multi-page browser automation scenarios
- Follows existing test patterns in the codebase
- Uses existing test utilities and page generators
- Tests real browser behavior through Playwright integration

### Negative
- Browser tests are slower than unit tests (mitigated by headless mode)
- Redirect testing requires route interception or JavaScript simulation
- Test flakiness possible with timing-sensitive operations

### Neutral
- Test file will be self-contained with its own page generators
- May need to extend existing test utilities for complex scenarios

## Implementation Notes

### Dependencies
- `vitest` - Test runner (already in use)
- `playwright` - Browser automation (already integrated)
- Existing `BrowserManager` and `BrowserSession` classes

### File Structure
```
packages/browser/src/__tests__/
  multipage-workflow-integration.test.ts  <- New file
  test-utils.ts                           <- Existing utilities
```

### Test Execution
```bash
npm test --workspace=@apexcli/browser -- multipage-workflow-integration
```

## Alternatives Considered

1. **Mock-based testing**: Rejected - doesn't test real browser behavior
2. **Separate test package**: Rejected - integration tests belong with the package
3. **Real HTTP server**: Considered but data URLs are sufficient for most cases

## References

- Existing tests: `packages/browser/src/__tests__/browser-session.test.ts`
- E2E tests: `packages/browser/src/__tests__/browser-automation-integration-e2e.test.ts`
- BrowserSession: `packages/browser/src/browser-session.ts`
- Test utilities: `packages/browser/src/test-utils/`
