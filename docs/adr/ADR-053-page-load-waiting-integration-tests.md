# ADR-053: Page Load Waiting Integration Tests

## Status
Proposed

## Date
2025-02-06

## Context

The APEX Browser automation package (`@apexcli/browser`) requires comprehensive integration tests for page load waiting functionality. The acceptance criteria require testing:

1. **Wait Strategies** - `waitForLoadState`, `waitForSelector`, `waitForNavigation`
2. **Custom Wait Conditions** - JavaScript-based custom waits and combined conditions
3. **Timeout Configurations** - Graceful timeout handling and configurable timeouts

### Existing Infrastructure Analysis

The `BrowserSession` class in `packages/browser/src/browser-session.ts` provides these waiting capabilities:

```typescript
// Navigation waiting
async waitForNavigation(options: WaitForNavigationOptions = {}): Promise<BrowserActionResult<string>>
// Uses page.waitForURL() internally with options: timeout, waitUntil, url pattern

// Element waiting
async waitForElement(
  selector: string | ElementSelector,
  options?: { timeout?: number; state?: 'visible' | 'hidden' | 'attached' | 'detached' }
): Promise<BrowserActionResult<void>>
// Uses page.waitForSelector() internally

// JavaScript evaluation for custom waits
async evaluate<T = unknown>(script: string | (() => T)): Promise<BrowserActionResult<T>>
```

The `NavigationOptions` interface supports:
```typescript
interface NavigationOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  referer?: string;
}
```

### Current Test Utilities

Located in `tests/browser-integration/`:
- `setup.ts` - Global test setup with `waitForNetworkIdle()` helper
- `utils/test-helpers.ts` - Contains `waitForElement()`, `waitForNetworkIdle()` utilities
- `vitest.config.ts` - Extended timeouts (60s test, 30s hook)

The existing test infrastructure provides patterns for:
- Browser instance management (Playwright chromium/firefox/webkit)
- Page content setup via `page.setContent()` with `data:text/html` URLs
- DOM interaction testing with proper cleanup

## Decision

### Test File Location

Create a new test file:
```
tests/browser-integration/page-load-waiting.integration.test.ts
```

This follows the existing pattern in `tests/browser-integration/` where comprehensive browser automation tests reside.

### Technical Architecture

#### 1. Test Page Generator for Wait Scenarios

Create HTML test pages that simulate various page loading patterns:

```typescript
const PageLoadTestPages = {
  // Immediate load page
  immediateLoad: (): string => `
    <!DOCTYPE html>
    <html>
    <head><title>Immediate Load</title></head>
    <body>
      <div id="content" class="loaded">Content loaded immediately</div>
    </body>
    </html>
  `,

  // DOM content loaded page (scripts at end)
  domContentPage: (): string => `
    <!DOCTYPE html>
    <html>
    <head><title>DOM Content Test</title></head>
    <body>
      <div id="dom-indicator">DOM Ready</div>
      <script>
        document.getElementById('dom-indicator').dataset.loaded = 'true';
      </script>
    </body>
    </html>
  `,

  // Full page load with resources
  fullLoadPage: (loadDelay: number = 100): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Full Load Test</title>
      <style>
        .loaded { color: green; }
      </style>
    </head>
    <body>
      <div id="content">Loading...</div>
      <img id="test-image" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
      <script>
        setTimeout(() => {
          document.getElementById('content').textContent = 'Fully Loaded';
          document.getElementById('content').classList.add('loaded');
        }, ${loadDelay});
      </script>
    </body>
    </html>
  `,

  // Network idle simulation page
  networkIdlePage: (requestCount: number = 3, requestDelay: number = 50): string => `
    <!DOCTYPE html>
    <html>
    <head><title>Network Idle Test</title></head>
    <body>
      <div id="status">Pending</div>
      <div id="request-count">0</div>
      <script>
        let completed = 0;
        const total = ${requestCount};

        function simulateRequest(delay) {
          return new Promise(resolve => setTimeout(resolve, delay));
        }

        async function loadData() {
          document.getElementById('status').textContent = 'Loading';

          for (let i = 0; i < total; i++) {
            await simulateRequest(${requestDelay});
            completed++;
            document.getElementById('request-count').textContent = completed.toString();
          }

          document.getElementById('status').textContent = 'Complete';
        }

        loadData();
      </script>
    </body>
    </html>
  `,

  // Delayed element appearance page
  delayedElementPage: (selector: string, delay: number): string => `
    <!DOCTYPE html>
    <html>
    <head><title>Delayed Element Test</title></head>
    <body>
      <div id="container">
        <p>Waiting for element...</p>
      </div>
      <script>
        setTimeout(() => {
          const el = document.createElement('div');
          el.id = '${selector.replace('#', '')}';
          el.className = '${selector.replace('.', '')}';
          el.textContent = 'Element appeared!';
          el.dataset.loaded = 'true';
          document.getElementById('container').appendChild(el);
        }, ${delay});
      </script>
    </body>
    </html>
  `,

  // Element state change page (visible/hidden transitions)
  elementStateChangePage: (initialState: 'visible' | 'hidden', changeDelay: number): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Element State Test</title>
      <style>
        .hidden { display: none; }
        .visible { display: block; }
      </style>
    </head>
    <body>
      <div id="toggle-element" class="${initialState}">
        Toggle Content
      </div>
      <script>
        setTimeout(() => {
          const el = document.getElementById('toggle-element');
          el.className = el.className === 'visible' ? 'hidden' : 'visible';
        }, ${changeDelay});
      </script>
    </body>
    </html>
  `,

  // SPA-style navigation page
  spaNavigationPage: (): string => `
    <!DOCTYPE html>
    <html>
    <head><title>SPA Navigation Test</title></head>
    <body>
      <div id="app">
        <nav>
          <a href="#page1" id="link1">Page 1</a>
          <a href="#page2" id="link2">Page 2</a>
        </nav>
        <main id="main-content">Home Content</main>
      </div>
      <script>
        window.addEventListener('hashchange', () => {
          const hash = window.location.hash;
          const content = document.getElementById('main-content');

          setTimeout(() => {
            if (hash === '#page1') {
              content.innerHTML = '<div id="page1-content">Page 1 Loaded</div>';
            } else if (hash === '#page2') {
              content.innerHTML = '<div id="page2-content">Page 2 Loaded</div>';
            }
          }, 100);
        });
      </script>
    </body>
    </html>
  `,

  // Custom condition page (e.g., wait for specific data state)
  customConditionPage: (): string => `
    <!DOCTYPE html>
    <html>
    <head><title>Custom Condition Test</title></head>
    <body>
      <div id="data-container" data-ready="false">
        <span id="loading-indicator">Loading...</span>
      </div>
      <script>
        window.appState = { initialized: false, dataLoaded: false };

        setTimeout(() => {
          window.appState.initialized = true;
        }, 50);

        setTimeout(() => {
          window.appState.dataLoaded = true;
          document.getElementById('data-container').dataset.ready = 'true';
          document.getElementById('loading-indicator').textContent = 'Ready';
        }, 150);
      </script>
    </body>
    </html>
  `,

  // Timeout test page (element never appears)
  timeoutTestPage: (): string => `
    <!DOCTYPE html>
    <html>
    <head><title>Timeout Test</title></head>
    <body>
      <div id="existing-element">This element exists</div>
      <!-- No #missing-element will be created -->
    </body>
    </html>
  `,
};
```

#### 2. Test Categories

##### Category A: waitForLoadState Tests
Test all load state strategies:
- `'domcontentloaded'` - DOM tree is ready
- `'load'` - All resources loaded
- `'networkidle'` - No network activity for 500ms
- `'commit'` - When navigation response is received

```typescript
describe('waitForLoadState strategies', () => {
  it('should wait for domcontentloaded state', async () => {
    const startTime = Date.now();
    await page.setContent(PageLoadTestPages.domContentPage());
    await page.waitForLoadState('domcontentloaded');

    const domIndicator = await page.locator('#dom-indicator');
    await expect(domIndicator).toBeVisible();
    expect(await domIndicator.getAttribute('data-loaded')).toBe('true');
  });

  it('should wait for load state (all resources)', async () => {
    await page.setContent(PageLoadTestPages.fullLoadPage(100));
    await page.waitForLoadState('load');

    const content = await page.textContent('#content');
    expect(content).toBe('Fully Loaded');
  });

  it('should wait for networkidle state', async () => {
    await page.setContent(PageLoadTestPages.networkIdlePage(3, 50));
    await page.waitForLoadState('networkidle');

    const status = await page.textContent('#status');
    expect(status).toBe('Complete');
  });

  it('should handle commit state for early access', async () => {
    await page.goto('data:text/html,...', { waitUntil: 'commit' });
    // Page may not be fully loaded but navigation committed
    expect(page.url()).toContain('data:text/html');
  });
});
```

##### Category B: waitForSelector Tests
Test element waiting with various states:
- Wait for element to appear (default visible)
- Wait for element with `{ state: 'attached' }` (in DOM but may be hidden)
- Wait for element with `{ state: 'visible' }`
- Wait for element with `{ state: 'hidden' }`
- Wait for element with `{ state: 'detached' }` (removed from DOM)

```typescript
describe('waitForSelector strategies', () => {
  it('should wait for element to become visible', async () => {
    await page.setContent(PageLoadTestPages.delayedElementPage('delayed-element', 200));

    const element = await page.waitForSelector('#delayed-element', {
      state: 'visible',
      timeout: 5000
    });

    expect(element).not.toBeNull();
    const text = await element?.textContent();
    expect(text).toBe('Element appeared!');
  });

  it('should wait for element to be attached to DOM', async () => {
    await page.setContent(PageLoadTestPages.delayedElementPage('delayed-element', 100));

    await page.waitForSelector('#delayed-element', {
      state: 'attached',
      timeout: 5000
    });

    const exists = await page.locator('#delayed-element').count();
    expect(exists).toBe(1);
  });

  it('should wait for element to become hidden', async () => {
    await page.setContent(PageLoadTestPages.elementStateChangePage('visible', 100));

    await page.waitForSelector('#toggle-element', {
      state: 'hidden',
      timeout: 5000
    });

    const isVisible = await page.locator('#toggle-element').isVisible();
    expect(isVisible).toBe(false);
  });

  it('should wait for element to be detached from DOM', async () => {
    const html = `
      <!DOCTYPE html>
      <html><body>
        <div id="removable">Will be removed</div>
        <script>
          setTimeout(() => {
            document.getElementById('removable').remove();
          }, 100);
        </script>
      </body></html>
    `;
    await page.setContent(html);

    await page.waitForSelector('#removable', {
      state: 'detached',
      timeout: 5000
    });

    const count = await page.locator('#removable').count();
    expect(count).toBe(0);
  });
});
```

##### Category C: waitForNavigation Tests
Test navigation waiting for SPAs and redirects:

```typescript
describe('waitForNavigation strategies', () => {
  it('should wait for URL-triggered navigation', async () => {
    await page.setContent(PageLoadTestPages.spaNavigationPage());

    const navigationPromise = page.waitForURL('**/#page1', { timeout: 5000 });
    await page.click('#link1');
    await navigationPromise;

    expect(page.url()).toContain('#page1');
    const content = await page.textContent('#page1-content');
    expect(content).toBe('Page 1 Loaded');
  });

  it('should wait for programmatic navigation', async () => {
    await page.setContent(`
      <!DOCTYPE html>
      <html><body>
        <button id="nav-btn">Navigate</button>
        <script>
          document.getElementById('nav-btn').addEventListener('click', () => {
            setTimeout(() => {
              window.location.hash = 'target';
            }, 50);
          });
        </script>
      </body></html>
    `);

    const navPromise = page.waitForURL('**/#target', { timeout: 5000 });
    await page.click('#nav-btn');
    await navPromise;

    expect(page.url()).toContain('#target');
  });

  it('should support URL pattern matching', async () => {
    await page.setContent(PageLoadTestPages.spaNavigationPage());

    // Wait for any hash change
    const navPromise = page.waitForURL(/.*#page\d/, { timeout: 5000 });
    await page.click('#link2');
    await navPromise;

    expect(page.url()).toMatch(/#page2/);
  });
});
```

##### Category D: Custom Wait Conditions
Test JavaScript-based custom waits:

```typescript
describe('custom wait conditions', () => {
  it('should wait for custom JavaScript condition', async () => {
    await page.setContent(PageLoadTestPages.customConditionPage());

    // Wait for app state to be initialized
    await page.waitForFunction(() => {
      return (window as any).appState?.initialized === true;
    }, { timeout: 5000 });

    const appState = await page.evaluate(() => (window as any).appState);
    expect(appState.initialized).toBe(true);
  });

  it('should wait for data-attribute condition', async () => {
    await page.setContent(PageLoadTestPages.customConditionPage());

    // Wait for data-ready attribute
    await page.waitForFunction(() => {
      const el = document.getElementById('data-container');
      return el?.dataset.ready === 'true';
    }, { timeout: 5000 });

    const indicator = await page.textContent('#loading-indicator');
    expect(indicator).toBe('Ready');
  });

  it('should wait for complex multi-condition state', async () => {
    await page.setContent(PageLoadTestPages.customConditionPage());

    // Wait for both conditions
    await page.waitForFunction(() => {
      const state = (window as any).appState;
      return state?.initialized && state?.dataLoaded;
    }, { timeout: 5000 });

    const appState = await page.evaluate(() => (window as any).appState);
    expect(appState.initialized).toBe(true);
    expect(appState.dataLoaded).toBe(true);
  });

  it('should wait for element count condition', async () => {
    const html = `
      <!DOCTYPE html>
      <html><body>
        <ul id="list"></ul>
        <script>
          let count = 0;
          const interval = setInterval(() => {
            const li = document.createElement('li');
            li.className = 'list-item';
            li.textContent = 'Item ' + (++count);
            document.getElementById('list').appendChild(li);
            if (count >= 5) clearInterval(interval);
          }, 50);
        </script>
      </body></html>
    `;
    await page.setContent(html);

    // Wait for 5 items to be added
    await page.waitForFunction(() => {
      return document.querySelectorAll('.list-item').length >= 5;
    }, { timeout: 5000 });

    const count = await page.locator('.list-item').count();
    expect(count).toBeGreaterThanOrEqual(5);
  });
});
```

##### Category E: Timeout Configurations
Test timeout behavior:

```typescript
describe('timeout configurations', () => {
  it('should respect custom timeout for waitForSelector', async () => {
    await page.setContent(PageLoadTestPages.timeoutTestPage());

    const startTime = Date.now();

    await expect(
      page.waitForSelector('#missing-element', { timeout: 500 })
    ).rejects.toThrow();

    const elapsed = Date.now() - startTime;
    // Should timeout around 500ms (with some tolerance)
    expect(elapsed).toBeGreaterThanOrEqual(450);
    expect(elapsed).toBeLessThan(1000);
  });

  it('should respect default timeout from page settings', async () => {
    page.setDefaultTimeout(1000);
    await page.setContent(PageLoadTestPages.timeoutTestPage());

    const startTime = Date.now();

    await expect(
      page.waitForSelector('#missing-element')
    ).rejects.toThrow();

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeGreaterThanOrEqual(950);
    expect(elapsed).toBeLessThan(2000);
  });

  it('should handle waitForLoadState timeout gracefully', async () => {
    // Create a page that never reaches networkidle
    const html = `
      <!DOCTYPE html>
      <html><body>
        <script>
          setInterval(() => {
            fetch('data:text/plain,ping').catch(() => {});
          }, 100);
        </script>
      </body></html>
    `;
    await page.setContent(html);

    await expect(
      page.waitForLoadState('networkidle', { timeout: 500 })
    ).rejects.toThrow();
  });

  it('should handle waitForFunction timeout', async () => {
    await page.setContent('<html><body></body></html>');

    await expect(
      page.waitForFunction(() => false, { timeout: 500 })
    ).rejects.toThrow();
  });

  it('should succeed before timeout when condition is met', async () => {
    await page.setContent(PageLoadTestPages.delayedElementPage('quick-element', 50));

    const startTime = Date.now();

    await page.waitForSelector('#quick-element', { timeout: 5000 });

    const elapsed = Date.now() - startTime;
    // Should complete much faster than timeout
    expect(elapsed).toBeLessThan(500);
  });
});
```

##### Category F: Combined Wait Strategies
Test multiple wait strategies together:

```typescript
describe('combined wait strategies', () => {
  it('should combine waitForLoadState with waitForSelector', async () => {
    await page.setContent(PageLoadTestPages.fullLoadPage(100));

    // Wait for DOM first
    await page.waitForLoadState('domcontentloaded');

    // Then wait for specific element
    await page.waitForSelector('#content.loaded', {
      state: 'visible',
      timeout: 5000
    });

    const text = await page.textContent('#content');
    expect(text).toBe('Fully Loaded');
  });

  it('should chain navigation and element waits', async () => {
    await page.setContent(PageLoadTestPages.spaNavigationPage());

    // Navigate via click
    await page.click('#link1');

    // Wait for navigation
    await page.waitForURL('**/#page1');

    // Wait for content to load
    await page.waitForSelector('#page1-content', { state: 'visible' });

    const content = await page.textContent('#page1-content');
    expect(content).toBe('Page 1 Loaded');
  });

  it('should use Promise.all for parallel waits', async () => {
    const html = `
      <!DOCTYPE html>
      <html><body>
        <div id="elem1" style="display:none"></div>
        <div id="elem2" style="display:none"></div>
        <script>
          setTimeout(() => document.getElementById('elem1').style.display = 'block', 100);
          setTimeout(() => document.getElementById('elem2').style.display = 'block', 150);
        </script>
      </body></html>
    `;
    await page.setContent(html);

    // Wait for both elements in parallel
    await Promise.all([
      page.waitForSelector('#elem1', { state: 'visible' }),
      page.waitForSelector('#elem2', { state: 'visible' }),
    ]);

    const visible1 = await page.locator('#elem1').isVisible();
    const visible2 = await page.locator('#elem2').isVisible();
    expect(visible1).toBe(true);
    expect(visible2).toBe(true);
  });

  it('should use Promise.race for first-match scenarios', async () => {
    const html = `
      <!DOCTYPE html>
      <html><body>
        <div id="success" style="display:none"></div>
        <div id="error" style="display:none"></div>
        <script>
          // Randomly show success or error (for test, always success)
          setTimeout(() => document.getElementById('success').style.display = 'block', 100);
        </script>
      </body></html>
    `;
    await page.setContent(html);

    // Wait for either success or error
    const result = await Promise.race([
      page.waitForSelector('#success', { state: 'visible' }).then(() => 'success'),
      page.waitForSelector('#error', { state: 'visible' }).then(() => 'error'),
    ]);

    expect(result).toBe('success');
  });
});
```

#### 3. BrowserSession Integration Tests

Test integration with `BrowserSession` class methods:

```typescript
describe('BrowserSession wait method integration', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(async () => {
    manager = createBrowserManager();
    session = createBrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
      timeout: 10000,
    });
    await session.launch();
  });

  afterEach(async () => {
    await session.close();
    await manager.shutdown();
  });

  describe('waitForElement method', () => {
    it('should wait for element visibility', async () => {
      await session.navigate(`data:text/html,${encodeURIComponent(
        PageLoadTestPages.delayedElementPage('delayed', 100)
      )}`);

      const result = await session.waitForElement('#delayed', {
        state: 'visible',
        timeout: 5000
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should return error result on timeout', async () => {
      await session.navigate('data:text/html,<html><body></body></html>');

      const result = await session.waitForElement('#nonexistent', {
        timeout: 500
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('timeout');
    });
  });

  describe('waitForNavigation method', () => {
    it('should wait for URL change', async () => {
      await session.navigate(`data:text/html,${encodeURIComponent(
        PageLoadTestPages.spaNavigationPage()
      )}`);

      // Start navigation
      await session.click('#link1');

      const result = await session.waitForNavigation({
        url: '**/#page1',
        timeout: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.data).toContain('#page1');
    });
  });
});
```

### Test Implementation Pattern

```typescript
// tests/browser-integration/page-load-waiting.integration.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import {
  createBrowserManager,
  createBrowserSession,
  BrowserManager,
  BrowserSession,
} from '@apexcli/browser';

// ... PageLoadTestPages object as defined above ...

describe('Page Load Waiting Integration Tests', () => {
  // Category A: waitForLoadState tests
  describe('waitForLoadState strategies', () => { /* ... */ });

  // Category B: waitForSelector tests
  describe('waitForSelector strategies', () => { /* ... */ });

  // Category C: waitForNavigation tests
  describe('waitForNavigation strategies', () => { /* ... */ });

  // Category D: Custom wait conditions
  describe('custom wait conditions', () => { /* ... */ });

  // Category E: Timeout configurations
  describe('timeout configurations', () => { /* ... */ });

  // Category F: Combined strategies
  describe('combined wait strategies', () => { /* ... */ });
});

describe('BrowserSession Wait Method Integration', () => {
  // Integration with BrowserSession class
});
```

### File Structure

```
tests/browser-integration/
├── page-load-waiting.integration.test.ts    # Main test file
├── fixtures/
│   └── page-load-scenarios.ts               # PageLoadTestPages generator
├── utils/
│   └── wait-condition-helpers.ts            # Custom wait condition utilities
└── setup.ts                                 # Existing setup (unchanged)
```

## Acceptance Criteria Mapping

| Acceptance Criteria | Test Category | Test File |
|---------------------|---------------|-----------|
| waitForLoadState (DOM content loaded) | Category A | `page-load-waiting.integration.test.ts` |
| waitForLoadState (network idle) | Category A | `page-load-waiting.integration.test.ts` |
| waitForSelector (element visible) | Category B | `page-load-waiting.integration.test.ts` |
| waitForSelector (element hidden/detached) | Category B | `page-load-waiting.integration.test.ts` |
| waitForNavigation (URL changes) | Category C | `page-load-waiting.integration.test.ts` |
| Custom wait conditions | Category D | `page-load-waiting.integration.test.ts` |
| Timeout configurations | Category E | `page-load-waiting.integration.test.ts` |
| Combined wait strategies | Category F | `page-load-waiting.integration.test.ts` |

## Implementation Notes

### Timeout Strategy

- Default test timeout: 60s (vitest.config.ts)
- Default wait timeout per assertion: 5s
- Timeout tests use 500ms for quick failure verification
- Add 10-20% tolerance for timing assertions

### Error Handling

All wait methods should:
1. Return `BrowserActionResult` with `success: false` on timeout
2. Include descriptive error messages
3. Report actual duration for debugging
4. Not throw exceptions (use result pattern)

### Test Isolation

Each test should:
1. Create fresh page content via `page.setContent()`
2. Not depend on state from previous tests
3. Use unique element IDs to avoid conflicts
4. Clean up any timers/intervals via page reload

### Platform Compatibility

Tests should work across:
- Chromium (primary)
- Firefox (secondary)
- WebKit (secondary)

Use only standard Playwright APIs that work consistently across browsers.

## Consequences

### Positive
- Comprehensive coverage of page load waiting functionality
- Clear test structure aligned with acceptance criteria
- Reusable test fixtures and helpers
- Integration with existing BrowserSession methods

### Negative
- Additional test execution time (~30-60 seconds)
- Dependency on Playwright browser installation
- Timing-sensitive tests may be flaky in CI

### Mitigation
- Run tests with retry on CI (`retry: 2`)
- Use generous timeouts for wait operations
- Avoid sub-100ms timing assertions
- Group timing-sensitive tests for parallel isolation
