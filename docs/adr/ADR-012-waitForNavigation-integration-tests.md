# ADR-012: waitForNavigation Integration Tests Architecture

## Status
Accepted (Ready for Implementation)

## Context

The APEX browser automation platform requires comprehensive integration tests for the `waitForNavigation` method in `BrowserSession`. The `waitForNavigation` method is critical for handling navigation triggered by various sources:

1. **Click-triggered navigation** - Link clicks, button clicks that trigger navigation
2. **Form-triggered navigation** - Form submissions causing page navigation
3. **Programmatic navigation** - JavaScript `window.location` changes, `history.pushState`, etc.

Current state:
- `BrowserSession.waitForNavigation()` exists in `/packages/browser/src/browser-session.ts` (lines 445-474)
- Uses Playwright's `page.waitForURL()` under the hood
- Accepts `WaitForNavigationOptions`: `timeout`, `waitUntil` ('load' | 'domcontentloaded' | 'networkidle' | 'commit'), and `url` (string | RegExp)
- Returns `BrowserActionResult<string>` with the final URL

## Decision

### Test File Location
Create a new integration test file at:
```
tests/browser-integration/waitForNavigation.integration.test.ts
```

This follows the existing pattern (e.g., `waitForSelector.integration.test.ts`) and is covered by the vitest configuration.

### Test Architecture

#### 1. Test Structure

```typescript
describe('waitForNavigation Integration Tests', () => {
  describe('Click-Triggered Navigation', () => {
    // Link clicks with <a href>
    // Button clicks with onclick navigation
    // Navigation links with query parameters
    // Navigation with hash changes
  })

  describe('Form-Triggered Navigation', () => {
    // Form submissions (GET method)
    // Form submissions (POST method)
    // Form with action URL navigation
    // Form with redirect response
  })

  describe('Programmatic Navigation', () => {
    // window.location.href changes
    // window.location.replace()
    // history.pushState / popstate
    // JavaScript-triggered navigation (setTimeout)
  })

  describe('URL Pattern Matching', () => {
    // String URL matching
    // RegExp URL pattern matching
    // Wildcard patterns
  })

  describe('Wait States', () => {
    // waitUntil: 'load'
    // waitUntil: 'domcontentloaded'
    // waitUntil: 'networkidle'
    // waitUntil: 'commit'
  })

  describe('Error Handling and Edge Cases', () => {
    // Timeout scenarios
    // Navigation canceled
    // Rapid navigation changes
    // No navigation triggered
  })

  describe('Page State Verification', () => {
    // URL verification after navigation
    // Page title verification
    // Content verification
    // History state verification
  })
})
```

#### 2. Test Infrastructure

Use existing patterns from the codebase:

- **Browser Setup**: Use Playwright `chromium.launch()` directly (like `waitForSelector.integration.test.ts`)
- **Page Content**: Use `page.setContent()` with inline HTML for controlled scenarios
- **Mock Server**: Optionally leverage the existing mock server from `tests/page-navigation/setup.ts` for HTTP navigation tests
- **BrowserTool Integration**: Test through `BrowserTool` class for consistency with other tests

#### 3. HTML Test Fixtures

Each navigation scenario requires specific HTML fixtures:

**Click Navigation Fixture:**
```html
<a id="nav-link" href="/target">Navigate</a>
<button id="nav-button" onclick="window.location='/target'">Go</button>
```

**Form Navigation Fixture:**
```html
<form id="nav-form" action="/result" method="GET">
  <input name="query" value="test">
  <button type="submit">Submit</button>
</form>
```

**Programmatic Navigation Fixture:**
```html
<script>
  function navigateAfterDelay() {
    setTimeout(() => { window.location.href = '/delayed'; }, 100);
  }
</script>
<button onclick="navigateAfterDelay()">Delayed Nav</button>
```

#### 4. Acceptance Criteria Verification

Each test must verify:

1. **Correct URL changes**: Assert final URL matches expected destination
2. **Page state after navigation**: Verify page content, title, or specific elements
3. **Result format**: Ensure `BrowserActionResult<string>` format with `success`, `data` (URL), and `duration`
4. **Error handling**: Verify graceful failure with proper error messages

### Key Design Decisions

#### Use Data URLs for Simple Tests
For tests that don't require HTTP behavior, use `data:text/html,...` URLs. This:
- Avoids need for external servers
- Provides deterministic behavior
- Faster test execution

#### Use Mock Server for HTTP Behavior Tests
For tests requiring HTTP-specific behavior (redirects, form POST), use the mock server pattern from `tests/page-navigation/`:
- HTTP redirects (302, 301)
- Form submissions
- Server response validation

#### Parallel Test Structure with Promise.all
Use the click + waitForNavigation pattern that Playwright recommends:
```typescript
await Promise.all([
  session.waitForNavigation({ timeout: 5000 }),
  page.click('#nav-link')
]);
```

This prevents race conditions where navigation completes before wait starts.

### Performance Considerations

- **Timeout**: Default test timeout of 60s (from vitest config)
- **Individual operation timeout**: 5000ms for navigation operations
- **Sequential execution**: Browser tests run sequentially to prevent resource conflicts

## Consequences

### Positive

1. **Comprehensive coverage** of all navigation trigger types
2. **Follows established patterns** consistent with `waitForSelector.integration.test.ts`
3. **Deterministic tests** using data URLs and controlled mock server
4. **Clear acceptance criteria validation** per test case

### Negative

1. **Test execution time** - Browser automation tests are slower than unit tests
2. **Resource usage** - Each test creates browser instances

### Neutral

1. Tests require Playwright to be installed
2. Tests run in Node environment (not browser)

## Implementation Files

### New Files to Create
1. `tests/browser-integration/waitForNavigation.integration.test.ts` - Main test file
2. `tests/browser-integration/fixtures/navigation-trigger-scenarios.ts` - Optional: Shared navigation fixtures if complex

### Related Existing Files
- `/packages/browser/src/browser-session.ts` - Source implementation
- `/packages/browser/src/types.ts` - Type definitions
- `/tests/browser-integration/waitForSelector.integration.test.ts` - Pattern reference
- `/tests/page-navigation/navigation.integration.test.ts` - Existing navigation tests
- `/packages/browser/src/__tests__/navigation-acceptance-criteria.test.ts` - Unit-level tests

## Detailed Technical Design

### Test File Structure

```typescript
// tests/browser-integration/waitForNavigation.integration.test.ts

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import { createServer, Server } from 'http';

// 1. Local mock server for HTTP-based navigation tests
// 2. Browser/context/page lifecycle management
// 3. Test suites organized by navigation trigger type

describe('waitForNavigation Integration Tests', () => {
  // Setup/teardown
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let mockServer: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Start mock server for HTTP-based tests
    mockServer = createMockNavigationServer();
    baseUrl = `http://localhost:${serverPort}`;
  });

  afterAll(async () => {
    mockServer.close();
  });

  beforeEach(async () => {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();
    page.setDefaultTimeout(30000);
  });

  afterEach(async () => {
    await page?.close();
    await context?.close();
    await browser?.close();
  });

  // Test suites follow...
});
```

### Test Scenarios and Implementation Details

#### 1. Click-Triggered Navigation (Priority: High)

| Test Case | HTML Fixture | Navigation Trigger | Expected Behavior |
|-----------|-------------|-------------------|------------------|
| Link click navigation | `<a href="/page2">Link</a>` | `page.click('a')` | URL changes to `/page2` |
| Button with onclick | `<button onclick="location='/page2'">` | `page.click('button')` | URL changes via JS |
| Link with query params | `<a href="/search?q=test">` | `page.click('a')` | URL includes query string |
| Target blank (new tab) | `<a href="/page2" target="_blank">` | N/A - Skip | Opens new tab, not same page |

**Implementation Pattern:**
```typescript
it('should wait for click-triggered navigation via link', async () => {
  // Navigate to page with link
  await page.goto(`${baseUrl}/link-test`);

  // Parallel: click + wait (avoids race condition)
  const [response] = await Promise.all([
    page.waitForURL('**/target'),
    page.click('#nav-link')
  ]);

  // Verify navigation completed
  expect(page.url()).toContain('/target');

  // Verify page content loaded correctly
  const title = await page.title();
  expect(title).toBe('Target Page');
});
```

#### 2. Form-Triggered Navigation (Priority: High)

| Test Case | Form Method | Server Behavior | Expected Outcome |
|-----------|------------|-----------------|-----------------|
| GET form submission | GET | 200 OK | URL changes with query params |
| POST form submission | POST | 302 Redirect | URL changes to redirect target |
| Form with action URL | GET | 200 OK | Navigation to action URL |
| Form submission error | POST | 500 Error | Navigation fails gracefully |

**Implementation Pattern:**
```typescript
it('should wait for form submission navigation', async () => {
  await page.goto(`${baseUrl}/form-test`);

  // Fill form
  await page.fill('#search-input', 'query');

  // Submit and wait for navigation
  const [response] = await Promise.all([
    page.waitForURL('**/search?q=*'),
    page.click('#submit-button')
  ]);

  expect(page.url()).toContain('search?q=query');
});
```

#### 3. Programmatic Navigation (Priority: High)

| Test Case | JavaScript Method | Timing | Expected Behavior |
|-----------|------------------|--------|------------------|
| location.href change | `window.location.href = '/target'` | Immediate | URL changes |
| location.replace | `window.location.replace('/target')` | Immediate | URL changes, no history |
| history.pushState | `history.pushState({}, '', '/target')` | Immediate | URL changes, no page load |
| Delayed navigation | `setTimeout(() => location.href = '/target', 100)` | 100ms delay | Wait until navigation |

**Implementation Pattern:**
```typescript
it('should wait for programmatic navigation via location.href', async () => {
  const testHtml = `
    <button id="nav-btn" onclick="setTimeout(() => location.href = 'data:text/html,<title>Target</title>', 100)">
      Navigate
    </button>
  `;
  await page.setContent(testHtml);

  // Wait for navigation after button click triggers delayed navigation
  const [result] = await Promise.all([
    page.waitForURL('data:text/html,*'),
    page.click('#nav-btn')
  ]);

  const title = await page.title();
  expect(title).toBe('Target');
});
```

#### 4. URL Pattern Matching (Priority: Medium)

| Test Case | URL Pattern | Target URL | Should Match |
|-----------|------------|------------|--------------|
| Exact string | `/page2` | `/page2` | ✓ |
| Glob pattern | `**/page*` | `/page2` | ✓ |
| RegExp pattern | `/page\\d+/` | `/page2` | ✓ |
| Wildcard all | `**/*` | Any URL | ✓ |

**Implementation Pattern:**
```typescript
it('should match URL using RegExp pattern', async () => {
  await page.goto(`${baseUrl}/start`);

  // Wait for navigation matching pattern
  await Promise.all([
    page.waitForURL(/\/page\d+$/),  // Matches /page1, /page2, etc.
    page.click('#nav-link')
  ]);

  expect(page.url()).toMatch(/\/page\d+$/);
});
```

#### 5. Wait States (Priority: Medium)

| State | When Resolves | Use Case |
|-------|--------------|----------|
| `load` | Full page load complete | Default, most reliable |
| `domcontentloaded` | DOM parsed, external resources may still load | Faster tests |
| `networkidle` | No network requests for 500ms | SPAs, dynamic content |
| `commit` | Response received, before parsing | Fastest, least reliable |

**Implementation Pattern:**
```typescript
it('should wait until networkidle for SPA navigation', async () => {
  await page.goto(`${baseUrl}/spa-app`);

  // SPA navigation with dynamic content loading
  await Promise.all([
    page.waitForURL('**/dashboard', { waitUntil: 'networkidle' }),
    page.click('#dashboard-link')
  ]);

  // Content should be fully loaded
  const content = await page.textContent('#dashboard-content');
  expect(content).toBeTruthy();
});
```

#### 6. Error Handling and Edge Cases (Priority: High)

| Scenario | Expected Behavior | Verification |
|----------|------------------|--------------|
| Timeout exceeded | Returns error result | `success: false`, error message |
| Navigation canceled | Returns error result | Navigation was interrupted |
| Rapid navigation | Settles on final URL | Final URL is correct |
| No navigation | Timeout error | `success: false` after timeout |
| Browser not launched | Immediate error | "Browser not launched" message |

**Implementation Pattern:**
```typescript
it('should handle navigation timeout gracefully', async () => {
  await page.setContent('<div>Static page</div>');

  // Wait for navigation that never happens
  const startTime = Date.now();
  await expect(
    page.waitForURL('**/never-exists', { timeout: 500 })
  ).rejects.toThrow();

  const elapsed = Date.now() - startTime;
  expect(elapsed).toBeGreaterThanOrEqual(450);
  expect(elapsed).toBeLessThan(1000);
});
```

#### 7. Page State Verification (Priority: High)

| Verification | Method | Purpose |
|-------------|--------|---------|
| URL check | `page.url()` | Verify final URL |
| Title check | `page.title()` | Verify page loaded |
| Content check | `page.textContent()` | Verify specific content |
| History length | `page.evaluate(() => history.length)` | Verify navigation history |

**Implementation Pattern:**
```typescript
it('should verify complete page state after navigation', async () => {
  await page.goto(`${baseUrl}/start`);

  await Promise.all([
    page.waitForURL('**/target'),
    page.click('#nav-link')
  ]);

  // Comprehensive state verification
  expect(page.url()).toContain('/target');
  expect(await page.title()).toBe('Target Page');
  expect(await page.textContent('h1')).toBe('Welcome to Target');

  const historyLength = await page.evaluate(() => history.length);
  expect(historyLength).toBeGreaterThan(1);
});
```

### Mock Server Implementation

```typescript
function createMockNavigationServer(): Server {
  return createServer((req, res) => {
    const url = req.url || '/';

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Route handling
    switch (url) {
      case '/':
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(createNavHomePage());
        break;
      case '/target':
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><head><title>Target Page</title></head><body><h1>Welcome to Target</h1></body></html>');
        break;
      case '/link-test':
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><a id="nav-link" href="/target">Go to Target</a></body></html>');
        break;
      case '/form-test':
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(createFormTestPage());
        break;
      case '/search':
        const query = new URL(`http://localhost${url}`).searchParams.get('q');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html><head><title>Search Results</title></head><body>Results for: ${query}</body></html>`);
        break;
      case '/redirect-source':
        res.writeHead(302, { 'Location': '/target' });
        res.end();
        break;
      case '/slow':
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><head><title>Slow Page</title></head><body>Loaded</body></html>');
        }, 2000);
        break;
      default:
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<html><body>Not Found</body></html>');
    }
  });
}
```

### Data URL Strategy for Simple Tests

For tests that don't require HTTP behavior, use data URLs:

```typescript
it('should handle navigation between data URLs', async () => {
  const startPage = `data:text/html,<title>Start</title><a id="nav-link" href="data:text/html,<title>Target</title>">Go</a>`;

  await page.goto(startPage);

  await Promise.all([
    page.waitForURL('data:text/html,*Target*'),
    page.click('#nav-link')
  ]);

  expect(await page.title()).toBe('Target');
});
```

### Test Count Summary

| Category | Estimated Tests |
|----------|----------------|
| Click-Triggered Navigation | 4-5 tests |
| Form-Triggered Navigation | 4-5 tests |
| Programmatic Navigation | 5-6 tests |
| URL Pattern Matching | 4-5 tests |
| Wait States | 4 tests |
| Error Handling | 5-6 tests |
| Page State Verification | 3-4 tests |
| **Total** | **~30 tests** |

### Acceptance Criteria Mapping

| Acceptance Criteria | Test Categories | Verified By |
|--------------------|-----------------|-------------|
| Tests pass for link clicks | Click-Triggered Navigation | URL changes correctly |
| Tests pass for form submissions | Form-Triggered Navigation | Navigation after submit |
| Tests pass for JavaScript navigation | Programmatic Navigation | location.href, history API |
| Tests verify correct URL changes | Page State Verification | `page.url()` assertions |
| Tests verify page state after navigation | Page State Verification | Title, content, history |

## References

- Playwright waitForURL documentation: https://playwright.dev/docs/api/class-page#page-wait-for-url
- Existing navigation tests in codebase
- waitForSelector test patterns in `tests/browser-integration/waitForSelector.integration.test.ts`
- Mock server patterns from `tests/page-navigation/setup.ts`
