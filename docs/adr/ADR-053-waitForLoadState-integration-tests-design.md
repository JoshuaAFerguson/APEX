# Technical Design: waitForLoadState Integration Tests

## Status
Architecture Stage - Design Complete

## Date
2025-02-06

## Scope
This document defines the technical architecture for integration tests specifically focused on `waitForLoadState` functionality with the three load state types: `'load'`, `'domcontentloaded'`, and `'networkidle'`.

## Context

### Task Requirements
- Test all three load state types: `'load'`, `'domcontentloaded'`, `'networkidle'`
- Each state type requires at least 2 test cases covering success and edge cases
- Total: 6+ test cases minimum

### Existing Infrastructure
The APEX project has established browser integration test infrastructure in `tests/browser-integration/`:
- **setup.ts**: Global browser setup/teardown, `waitForNetworkIdle()` utility
- **vitest.config.ts**: 60s test timeout, 30s hook timeout, 2 retry in CI
- **fixtures/**: Reusable test scenario generators
- **utils/test-helpers.ts**: Common utilities like `waitForElement()`, `waitForNetworkIdle()`

### Load State Semantics (Playwright)
| State | Description | Use Case |
|-------|-------------|----------|
| `domcontentloaded` | DOM tree is parsed and ready | Early interaction, fast tests |
| `load` | Page fully loaded including all resources (images, stylesheets, iframes) | Full page ready verification |
| `networkidle` | No network connections for at least 500ms | SPA readiness, async content loaded |

## Technical Architecture

### File Structure
```
tests/browser-integration/
├── waitForLoadState.integration.test.ts   # Main test file (NEW)
├── fixtures/
│   └── load-state-scenarios.ts            # Load state page generators (NEW)
└── setup.ts                               # Existing (unchanged)
```

### 1. Test Fixture Design: `fixtures/load-state-scenarios.ts`

#### LoadStateTestPages Generator

```typescript
/**
 * @fileoverview Test page generators for waitForLoadState integration tests
 *
 * Provides HTML page generators that simulate various page loading patterns
 * for testing the three load states: 'load', 'domcontentloaded', 'networkidle'
 */

export const LoadStateTestPages = {
  /**
   * DOMContentLoaded Test Page
   * - DOM tree parsed immediately
   * - Script runs synchronously to mark DOM ready
   */
  domContentLoadedPage: (): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>DOMContentLoaded Test</title>
    </head>
    <body>
      <div id="dom-indicator" data-status="loading">Loading...</div>
      <script>
        // Synchronous script - runs when DOM is parsed
        document.getElementById('dom-indicator').dataset.status = 'dom-ready';
        document.getElementById('dom-indicator').textContent = 'DOM Ready';
      </script>
    </body>
    </html>
  `,

  /**
   * DOMContentLoaded Edge Case: Deferred script execution
   * - Tests that domcontentloaded waits for deferred scripts
   */
  domContentLoadedDeferredPage: (): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>DOMContentLoaded Deferred Test</title>
      <script defer>
        document.addEventListener('DOMContentLoaded', () => {
          document.getElementById('deferred-indicator').dataset.loaded = 'true';
        });
      </script>
    </head>
    <body>
      <div id="deferred-indicator" data-loaded="false">Waiting for deferred script</div>
    </body>
    </html>
  `,

  /**
   * Full Load Test Page
   * - Includes inline base64 image (loads instantly, still triggers load event)
   * - Includes stylesheet that must load
   * - Simulates waiting for all resources
   */
  fullLoadPage: (resourceLoadDelay: number = 0): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Full Load Test</title>
      <style>
        .loading { color: #999; }
        .loaded { color: green; font-weight: bold; }
      </style>
    </head>
    <body>
      <div id="content" class="loading">Loading resources...</div>
      <img id="test-image" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
      <script>
        window.addEventListener('load', function() {
          ${resourceLoadDelay > 0 ? `setTimeout(function() {` : ''}
          document.getElementById('content').className = 'loaded';
          document.getElementById('content').textContent = 'All Resources Loaded';
          document.getElementById('content').dataset.status = 'complete';
          ${resourceLoadDelay > 0 ? `}, ${resourceLoadDelay});` : ''}
        });
      </script>
    </body>
    </html>
  `,

  /**
   * Full Load Edge Case: Multiple resources
   * - Tests that load waits for ALL resources, not just the first
   */
  fullLoadMultiResourcePage: (): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Multi-Resource Load Test</title>
      <style>
        #counter { font-size: 24px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div id="counter" data-count="0">0</div>
      <div id="status">Loading resources...</div>
      <!-- Multiple inline images simulate multiple resources -->
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" />
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFfwJ/A3q1EwAAAABJRU5ErkJggg==" />
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAfWCKGAAAAABJRU5ErkJggg==" />
      <script>
        window.addEventListener('load', function() {
          const images = document.querySelectorAll('img');
          document.getElementById('counter').dataset.count = images.length.toString();
          document.getElementById('counter').textContent = images.length.toString();
          document.getElementById('status').textContent = 'All ' + images.length + ' resources loaded';
        });
      </script>
    </body>
    </html>
  `,

  /**
   * Network Idle Test Page
   * - Simulates async operations that complete before network idle
   * - Uses setTimeout to simulate network activity duration
   */
  networkIdlePage: (activityDurationMs: number = 200): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Network Idle Test</title>
    </head>
    <body>
      <div id="status" data-phase="initializing">Initializing...</div>
      <div id="activity-count">0</div>
      <script>
        const startTime = Date.now();
        let activityCount = 0;

        // Simulate network activity with promise chain
        function simulateActivity() {
          return new Promise(resolve => {
            activityCount++;
            document.getElementById('activity-count').textContent = activityCount.toString();
            document.getElementById('status').dataset.phase = 'active';
            document.getElementById('status').textContent = 'Network Active';
            setTimeout(resolve, ${activityDurationMs});
          });
        }

        // Chain activities, then mark idle
        simulateActivity()
          .then(() => {
            document.getElementById('status').dataset.phase = 'idle';
            document.getElementById('status').textContent = 'Network Idle';
            document.getElementById('status').dataset.completedAt = Date.now().toString();
          });
      </script>
    </body>
    </html>
  `,

  /**
   * Network Idle Edge Case: Multiple sequential async operations
   * - Tests that networkidle waits for ALL async activity to settle
   */
  networkIdleSequentialPage: (operationCount: number = 3, intervalMs: number = 100): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Network Idle Sequential Test</title>
    </head>
    <body>
      <div id="status" data-phase="pending">Pending</div>
      <div id="operations-complete">0</div>
      <script>
        let completed = 0;
        const total = ${operationCount};

        function runOperation(n) {
          return new Promise(resolve => {
            setTimeout(() => {
              completed++;
              document.getElementById('operations-complete').textContent = completed.toString();
              resolve();
            }, ${intervalMs});
          });
        }

        async function runAllOperations() {
          document.getElementById('status').dataset.phase = 'running';
          document.getElementById('status').textContent = 'Running operations...';

          for (let i = 0; i < total; i++) {
            await runOperation(i + 1);
          }

          document.getElementById('status').dataset.phase = 'complete';
          document.getElementById('status').textContent = 'All operations complete';
        }

        runAllOperations();
      </script>
    </body>
    </html>
  `,

  /**
   * Edge Case: Page that never reaches networkidle (for timeout testing)
   */
  neverIdlePage: (): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Never Idle Test</title>
    </head>
    <body>
      <div id="status">Continuous activity</div>
      <script>
        // Continuous polling - page never reaches networkidle
        setInterval(() => {
          fetch('data:text/plain,ping').catch(() => {});
        }, 100);
      </script>
    </body>
    </html>
  `,
};
```

### 2. Test File Design: `waitForLoadState.integration.test.ts`

#### Test Structure

```typescript
/**
 * @fileoverview Integration tests for waitForLoadState functionality
 *
 * Tests the three primary load states:
 * - 'domcontentloaded': DOM tree parsed and ready
 * - 'load': All resources (images, styles, scripts) loaded
 * - 'networkidle': No network activity for 500ms
 *
 * Each state has 2+ test cases covering:
 * - Basic success case
 * - Edge case or timing scenario
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { LoadStateTestPages } from './fixtures/load-state-scenarios';

describe('waitForLoadState Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeEach(async () => {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    page = await context.newPage();
    page.setDefaultTimeout(10000);
  });

  afterEach(async () => {
    await page?.close();
    await context?.close();
    await browser?.close();
  });

  // ============================================================================
  // Category A: domcontentloaded State Tests
  // ============================================================================
  describe('domcontentloaded state', () => {
    it('should resolve when DOM tree is fully parsed', async () => {
      // Test: Basic domcontentloaded behavior
      await page.setContent(LoadStateTestPages.domContentLoadedPage());
      await page.waitForLoadState('domcontentloaded');

      const indicator = page.locator('#dom-indicator');
      await expect(indicator).toBeVisible();
      expect(await indicator.getAttribute('data-status')).toBe('dom-ready');
    });

    it('should wait for deferred scripts to execute', async () => {
      // Edge case: Deferred script execution timing
      await page.setContent(LoadStateTestPages.domContentLoadedDeferredPage());
      await page.waitForLoadState('domcontentloaded');

      const indicator = page.locator('#deferred-indicator');
      // Deferred scripts run after DOM parsing but before DOMContentLoaded
      expect(await indicator.getAttribute('data-loaded')).toBe('true');
    });
  });

  // ============================================================================
  // Category B: load State Tests
  // ============================================================================
  describe('load state', () => {
    it('should resolve when all resources are fully loaded', async () => {
      // Test: Basic load behavior - all resources including images
      await page.setContent(LoadStateTestPages.fullLoadPage());
      await page.waitForLoadState('load');

      const content = page.locator('#content');
      expect(await content.getAttribute('data-status')).toBe('complete');
      expect(await content.textContent()).toBe('All Resources Loaded');
    });

    it('should wait for multiple resources to load', async () => {
      // Edge case: Multiple resources must all complete
      await page.setContent(LoadStateTestPages.fullLoadMultiResourcePage());
      await page.waitForLoadState('load');

      const counter = page.locator('#counter');
      const count = await counter.getAttribute('data-count');
      expect(parseInt(count || '0', 10)).toBeGreaterThanOrEqual(3);
    });
  });

  // ============================================================================
  // Category C: networkidle State Tests
  // ============================================================================
  describe('networkidle state', () => {
    it('should resolve when network is idle for 500ms', async () => {
      // Test: Basic networkidle - async activity completes then settles
      await page.setContent(LoadStateTestPages.networkIdlePage(200));
      await page.waitForLoadState('networkidle');

      const status = page.locator('#status');
      expect(await status.getAttribute('data-phase')).toBe('idle');
      expect(await status.textContent()).toBe('Network Idle');
    });

    it('should wait for sequential async operations to complete', async () => {
      // Edge case: Multiple sequential operations
      await page.setContent(LoadStateTestPages.networkIdleSequentialPage(3, 100));
      await page.waitForLoadState('networkidle');

      const status = page.locator('#status');
      expect(await status.getAttribute('data-phase')).toBe('complete');

      const count = await page.locator('#operations-complete').textContent();
      expect(parseInt(count || '0', 10)).toBe(3);
    });

    it('should timeout when network never becomes idle', async () => {
      // Edge case: Timeout behavior
      await page.setContent(LoadStateTestPages.neverIdlePage());

      await expect(
        page.waitForLoadState('networkidle', { timeout: 1000 })
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // Category D: Cross-State Comparison Tests (Bonus)
  // ============================================================================
  describe('load state timing order', () => {
    it('should fire domcontentloaded before load', async () => {
      // Verify proper ordering: domcontentloaded < load
      const events: string[] = [];

      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Timing Test</title></head>
        <body>
          <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
          <div id="result"></div>
          <script>
            document.addEventListener('DOMContentLoaded', () => {
              window.dcl = Date.now();
            });
            window.addEventListener('load', () => {
              window.loadTime = Date.now();
            });
          </script>
        </body>
        </html>
      `;

      await page.setContent(html);
      await page.waitForLoadState('load');

      const times = await page.evaluate(() => ({
        dcl: (window as any).dcl,
        load: (window as any).loadTime,
      }));

      expect(times.dcl).toBeLessThanOrEqual(times.load);
    });
  });
});
```

### 3. Acceptance Criteria Mapping

| Acceptance Criteria | Test Case | Description |
|---------------------|-----------|-------------|
| `'domcontentloaded'` success | `should resolve when DOM tree is fully parsed` | Verifies basic DOM ready state |
| `'domcontentloaded'` edge case | `should wait for deferred scripts to execute` | Tests script timing |
| `'load'` success | `should resolve when all resources are fully loaded` | Verifies full page load |
| `'load'` edge case | `should wait for multiple resources to load` | Tests multi-resource scenarios |
| `'networkidle'` success | `should resolve when network is idle for 500ms` | Verifies network idle detection |
| `'networkidle'` edge case | `should wait for sequential async operations to complete` | Tests complex async patterns |
| Timeout handling | `should timeout when network never becomes idle` | Tests graceful timeout behavior |
| State ordering | `should fire domcontentloaded before load` | Verifies correct event sequence |

### 4. Design Decisions

#### D1: Inline Test Fixtures
- **Decision**: Use inline base64-encoded resources rather than external URLs
- **Rationale**: Eliminates network dependencies, works in CI, deterministic timing

#### D2: Short Timeout for Failure Tests
- **Decision**: Use 1000ms timeout for timeout failure tests
- **Rationale**: Fast feedback, tests should fail quickly, 60s test timeout still respected

#### D3: Deferred Script Edge Case
- **Decision**: Include specific test for deferred script execution
- **Rationale**: Common gotcha with `DOMContentLoaded` - deferred scripts run before the event

#### D4: Sequential vs Parallel Async
- **Decision**: Test sequential async operations specifically for `networkidle`
- **Rationale**: Network idle detection must handle chained promises, not just single requests

## Implementation Notes

### Timeout Strategy
- Test suite timeout: 60s (from vitest.config.ts)
- Individual wait timeout: 10s (via `page.setDefaultTimeout`)
- Timeout failure tests: 1000ms (quick feedback)

### Test Isolation
- Fresh browser/context/page per test (beforeEach/afterEach)
- No shared state between tests
- No dependency on execution order

### Platform Compatibility
- Tests use standard Playwright APIs
- Works across Chromium, Firefox, WebKit
- No browser-specific code paths

## Files to Create/Modify

### New Files
1. `tests/browser-integration/fixtures/load-state-scenarios.ts` - Page generators
2. `tests/browser-integration/waitForLoadState.integration.test.ts` - Test suite

### No Modifications Required
- Existing `setup.ts` provides necessary infrastructure
- Existing `vitest.config.ts` has appropriate timeouts

## Success Metrics

- [ ] All 8 test cases pass
- [ ] Tests run in < 30 seconds total
- [ ] No flakiness in CI (with 2 retries)
- [ ] Coverage for all three load states
- [ ] Edge cases documented and tested
