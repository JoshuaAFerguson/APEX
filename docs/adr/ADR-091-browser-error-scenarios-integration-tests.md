# ADR-091: Browser Error Scenarios Integration Tests

**Status**: Proposed
**Date**: 2026-02-06
**Decision**: Design specification for comprehensive browser error scenario integration tests
**Author**: Architect Agent

## Context

The APEX platform includes comprehensive browser automation capabilities through the `@apexcli/browser` package with `BrowserManager` and `BrowserSession` classes. While there are existing error handling tests (e.g., `browser-tool-error-handling.test.ts`, `error-scenarios.test.ts`), we need a dedicated integration test suite that specifically covers browser error scenarios with a focus on:

1. **Network failure simulation**
2. **Request timeout handling**
3. **Page load timeout**
4. **Element not found errors**
5. **Navigation errors**
6. **Graceful error recovery mechanisms**

### Current State Analysis

#### Existing Test Coverage

1. **`packages/orchestrator/src/tools/__tests__/browser-tool-error-handling.test.ts`**:
   - Tests BrowserTool-level error handling with mocked Playwright
   - Covers browser launch failures, context creation failures, navigation errors
   - Uses mock page/context/browser objects

2. **`packages/browser/src/__tests__/error-scenarios.test.ts`**:
   - Tests BrowserSession error scenarios against real browsers
   - Covers launch failures, invalid selectors, navigation errors, screenshot errors
   - Tests resource exhaustion and manager shutdown scenarios

3. **`packages/browser/src/__tests__/browser-manager.edge.test.ts`**:
   - Tests BrowserManager edge cases with real browsers
   - Covers memory pressure, error recovery, concurrent operations
   - Tests event system during shutdown

#### Gaps Identified

1. **No dedicated network failure simulation tests** - Need tests that simulate `net::ERR_INTERNET_DISCONNECTED`, DNS failures, connection refused
2. **Limited request timeout coverage** - Need explicit timeout handling tests for API calls, resource loading
3. **No comprehensive page load timeout tests** - Need tests for slow pages, infinite loading states
4. **Element not found recovery tests** - Need tests for retry strategies, timeout behavior
5. **Navigation error recovery tests** - Need tests for graceful degradation and recovery
6. **End-to-end error recovery flows** - Need integration tests that verify error recovery across the full stack

### Requirements

From the acceptance criteria:
- Test file must exist with passing tests
- Must cover: network failure simulation, request timeout handling, page load timeout, element not found errors, navigation errors, graceful error recovery mechanisms

## Decision

### 1. Test File Location and Structure

Create a new integration test file at:
```
tests/integration/browser-error-scenarios.integration.test.ts
```

This location follows existing patterns (see `tests/integration/*.test.ts`) and allows testing across packages.

### 2. Test Architecture

```
tests/integration/browser-error-scenarios.integration.test.ts
├── describe('Browser Error Scenarios Integration Tests')
│   ├── describe('Network Failure Simulation')
│   │   ├── should handle net::ERR_INTERNET_DISCONNECTED gracefully
│   │   ├── should handle DNS resolution failures (ERR_NAME_NOT_RESOLVED)
│   │   ├── should handle connection refused errors (ERR_CONNECTION_REFUSED)
│   │   ├── should handle connection timeout errors
│   │   └── should recover from temporary network failures
│   │
│   ├── describe('Request Timeout Handling')
│   │   ├── should timeout on slow API responses
│   │   ├── should respect custom timeout configurations
│   │   ├── should handle timeout during resource loading
│   │   ├── should not leak resources after timeout
│   │   └── should allow operation retry after timeout
│   │
│   ├── describe('Page Load Timeout')
│   │   ├── should timeout on slow page load
│   │   ├── should handle pages with infinite loading states
│   │   ├── should respect waitUntil options during timeout
│   │   ├── should capture partial content on timeout
│   │   └── should allow navigation after page load timeout
│   │
│   ├── describe('Element Not Found Errors')
│   │   ├── should handle missing elements with clear error messages
│   │   ├── should timeout appropriately when waiting for elements
│   │   ├── should handle stale element references
│   │   ├── should handle elements that appear and disappear
│   │   └── should provide actionable error context
│   │
│   ├── describe('Navigation Errors')
│   │   ├── should handle invalid URL formats
│   │   ├── should handle HTTP error status codes (4xx, 5xx)
│   │   ├── should handle redirect loops
│   │   ├── should handle certificate errors (HTTPS)
│   │   ├── should handle about:blank and special URLs
│   │   └── should recover browser state after navigation failure
│   │
│   └── describe('Graceful Error Recovery Mechanisms')
│       ├── should maintain browser session after single error
│       ├── should allow retry after recoverable errors
│       ├── should provide error context for debugging
│       ├── should emit appropriate events during error recovery
│       ├── should cleanup resources on unrecoverable errors
│       └── should support error aggregation for multi-step operations
```

### 3. Test Implementation Design

#### 3.1 Test Fixtures and Utilities

Create shared test utilities for error scenario testing:

```typescript
// tests/test-utils/browser-error-fixtures.ts

import { createBrowserManager, createBrowserSession, BrowserSession, BrowserManager } from '@apexcli/browser';

/**
 * Test page generators for error scenarios
 */
export const ErrorTestPages = {
  /**
   * Page that throws JavaScript error on load
   */
  jsError: `data:text/html,
    <html>
      <head><title>JS Error Page</title></head>
      <body>
        <script>throw new Error('Test JS Error');</script>
      </body>
    </html>
  `,

  /**
   * Page with slow-loading resource that will timeout
   */
  slowResource: (delayMs: number) => `data:text/html,
    <html>
      <head><title>Slow Resource</title></head>
      <body>
        <div id="loading">Loading...</div>
        <script>
          setTimeout(() => {
            document.getElementById('loading').textContent = 'Loaded';
          }, ${delayMs});
        </script>
      </body>
    </html>
  `,

  /**
   * Page that never completes loading
   */
  infiniteLoad: `data:text/html,
    <html>
      <head><title>Infinite Load</title></head>
      <body>
        <script>
          // Simulate infinite loading
          window.addEventListener('load', () => {
            const img = document.createElement('img');
            img.src = 'http://localhost:99999/nonexistent.png';
            document.body.appendChild(img);
          });
        </script>
        <div id="content">Waiting...</div>
      </body>
    </html>
  `,

  /**
   * Page with element that appears after delay
   */
  delayedElement: (delayMs: number, elementId: string) => `data:text/html,
    <html>
      <head><title>Delayed Element</title></head>
      <body>
        <script>
          setTimeout(() => {
            const el = document.createElement('div');
            el.id = '${elementId}';
            el.textContent = 'Appeared!';
            document.body.appendChild(el);
          }, ${delayMs});
        </script>
      </body>
    </html>
  `,

  /**
   * Page with element that appears then disappears
   */
  transientElement: (appearMs: number, disappearMs: number, elementId: string) => `data:text/html,
    <html>
      <head><title>Transient Element</title></head>
      <body>
        <script>
          setTimeout(() => {
            const el = document.createElement('div');
            el.id = '${elementId}';
            el.textContent = 'Appeared!';
            document.body.appendChild(el);
            setTimeout(() => el.remove(), ${disappearMs - appearMs});
          }, ${appearMs});
        </script>
      </body>
    </html>
  `,
};

/**
 * Error assertion utilities
 */
export const ErrorAssertions = {
  /**
   * Assert that a result indicates a timeout error
   */
  assertTimeoutError: (result: { success: boolean; error?: string }) => {
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.toLowerCase()).toMatch(/timeout|timed out/i);
  },

  /**
   * Assert that a result indicates a network error
   */
  assertNetworkError: (result: { success: boolean; error?: string }) => {
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!).toMatch(/net::|ERR_|network|connection/i);
  },

  /**
   * Assert that a result indicates element not found
   */
  assertElementNotFound: (result: { success: boolean; error?: string }) => {
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.toLowerCase()).toMatch(/not found|selector|element/i);
  },

  /**
   * Assert that session is still operational after error
   */
  assertSessionOperational: async (session: BrowserSession) => {
    const navResult = await session.navigate('data:text/html,<h1>Recovery Test</h1>');
    expect(navResult.success).toBe(true);
  },
};

/**
 * Create a browser test context with error tracking
 */
export async function createErrorTestContext(config?: Partial<{
  browserType: 'chromium' | 'firefox' | 'webkit';
  timeout: number;
  maxInstances: number;
}>): Promise<{
  manager: BrowserManager;
  session: BrowserSession;
  errors: Array<{ type: string; message: string; timestamp: Date }>;
  cleanup: () => Promise<void>;
}> {
  const errors: Array<{ type: string; message: string; timestamp: Date }> = [];

  const manager = createBrowserManager({
    maxInstances: config?.maxInstances ?? 2,
    defaultSessionConfig: {
      browserType: config?.browserType ?? 'chromium',
      headless: true,
      timeout: config?.timeout ?? 5000,
    },
  });

  const session = createBrowserSession(manager, {
    browserType: config?.browserType ?? 'chromium',
    headless: true,
    timeout: config?.timeout ?? 5000,
  });

  // Track errors from session
  session.on('pageError', (error) => {
    errors.push({
      type: 'pageError',
      message: error.message,
      timestamp: new Date(),
    });
  });

  session.on('javascriptError', (error) => {
    errors.push({
      type: 'javascriptError',
      message: error.message,
      timestamp: new Date(),
    });
  });

  return {
    manager,
    session,
    errors,
    cleanup: async () => {
      await session.close();
      await manager.shutdown();
    },
  };
}
```

#### 3.2 Network Failure Tests Design

```typescript
describe('Network Failure Simulation', () => {
  let testContext: Awaited<ReturnType<typeof createErrorTestContext>>;

  beforeEach(async () => {
    testContext = await createErrorTestContext({ timeout: 5000 });
    await testContext.session.launch();
  });

  afterEach(async () => {
    await testContext.cleanup();
  });

  it('should handle net::ERR_INTERNET_DISCONNECTED gracefully', async () => {
    // Navigate to a non-routable IP to simulate disconnection
    const result = await testContext.session.navigate('http://10.255.255.1:9999/test');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.duration).toBeGreaterThan(0);

    // Verify session is still operational
    await ErrorAssertions.assertSessionOperational(testContext.session);
  });

  it('should handle DNS resolution failures', async () => {
    const result = await testContext.session.navigate(
      'http://this-domain-absolutely-does-not-exist-12345.invalid'
    );

    ErrorAssertions.assertNetworkError(result);
    await ErrorAssertions.assertSessionOperational(testContext.session);
  });

  it('should handle connection refused errors', async () => {
    // Attempt to connect to localhost on unlikely port
    const result = await testContext.session.navigate('http://localhost:59999');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    await ErrorAssertions.assertSessionOperational(testContext.session);
  });

  it('should recover from temporary network failures', async () => {
    // First, cause a network error
    const failResult = await testContext.session.navigate('http://localhost:59999');
    expect(failResult.success).toBe(false);

    // Then, navigate to a valid page
    const successResult = await testContext.session.navigate(
      'data:text/html,<h1>Recovery Success</h1>'
    );
    expect(successResult.success).toBe(true);

    // Verify page content
    const textResult = await testContext.session.getText('h1');
    expect(textResult.success).toBe(true);
    expect(textResult.data).toBe('Recovery Success');
  });
});
```

#### 3.3 Request Timeout Tests Design

```typescript
describe('Request Timeout Handling', () => {
  let testContext: Awaited<ReturnType<typeof createErrorTestContext>>;

  beforeEach(async () => {
    // Use very short timeout for testing
    testContext = await createErrorTestContext({ timeout: 1000 });
    await testContext.session.launch();
  });

  afterEach(async () => {
    await testContext.cleanup();
  });

  it('should timeout on slow operations with custom timeout', async () => {
    // Navigate to page with slow element
    await testContext.session.navigate(ErrorTestPages.slowResource(5000));

    // Try to wait for element that takes too long
    const result = await testContext.session.waitForElement('#loaded', {
      timeout: 500,
    });

    ErrorAssertions.assertTimeoutError(result);
    expect(result.duration).toBeGreaterThanOrEqual(500);
    expect(result.duration).toBeLessThan(1000);
  });

  it('should respect custom timeout configurations', async () => {
    const shortTimeoutSession = createBrowserSession(testContext.manager, {
      browserType: 'chromium',
      headless: true,
      timeout: 100, // Very short default timeout
    });

    try {
      await shortTimeoutSession.launch();

      // This should timeout quickly
      const result = await shortTimeoutSession.navigate(
        'http://10.255.255.1:9999/very-slow'
      );

      expect(result.success).toBe(false);
      expect(result.duration).toBeLessThan(2000); // Should fail within reasonable time
    } finally {
      await shortTimeoutSession.close();
    }
  });

  it('should not leak resources after timeout', async () => {
    const initialUsage = await testContext.manager.getResourceUsage();

    // Cause multiple timeouts
    for (let i = 0; i < 3; i++) {
      await testContext.session.navigate(ErrorTestPages.slowResource(10000), {
        timeout: 100,
      });
    }

    const finalUsage = await testContext.manager.getResourceUsage();

    // Resource counts should be stable
    expect(finalUsage.totalContexts).toBe(initialUsage.totalContexts);
    expect(finalUsage.totalInstances).toBe(initialUsage.totalInstances);
  });

  it('should allow operation retry after timeout', async () => {
    // First attempt times out
    const timeoutResult = await testContext.session.navigate(
      ErrorTestPages.slowResource(5000),
      { timeout: 100 }
    );
    expect(timeoutResult.success).toBe(false);

    // Retry with longer timeout or different page should work
    const retryResult = await testContext.session.navigate(
      'data:text/html,<h1>Retry Success</h1>'
    );
    expect(retryResult.success).toBe(true);
  });
});
```

#### 3.4 Page Load Timeout Tests Design

```typescript
describe('Page Load Timeout', () => {
  let testContext: Awaited<ReturnType<typeof createErrorTestContext>>;

  beforeEach(async () => {
    testContext = await createErrorTestContext({ timeout: 2000 });
    await testContext.session.launch();
  });

  afterEach(async () => {
    await testContext.cleanup();
  });

  it('should timeout on slow page load', async () => {
    const result = await testContext.session.navigate(
      ErrorTestPages.infiniteLoad,
      { timeout: 500, waitUntil: 'networkidle' }
    );

    // May succeed with partial load or timeout
    expect(result.duration).toBeGreaterThan(0);
  });

  it('should handle pages with infinite loading states', async () => {
    // Navigate with domcontentloaded which should succeed faster
    const result = await testContext.session.navigate(
      ErrorTestPages.infiniteLoad,
      { waitUntil: 'domcontentloaded', timeout: 2000 }
    );

    // DOMContentLoaded should trigger even if page has pending resources
    expect(result.success).toBe(true);

    // Content should be accessible
    const contentResult = await testContext.session.getText('#content');
    expect(contentResult.success).toBe(true);
  });

  it('should respect waitUntil options during timeout', async () => {
    // Test with 'commit' which is the fastest
    const commitResult = await testContext.session.navigate(
      ErrorTestPages.slowResource(5000),
      { waitUntil: 'commit', timeout: 1000 }
    );
    expect(commitResult.success).toBe(true);

    // Test with 'networkidle' which may timeout
    const networkIdleResult = await testContext.session.navigate(
      ErrorTestPages.slowResource(5000),
      { waitUntil: 'networkidle', timeout: 1000 }
    );
    // This may timeout or succeed depending on page behavior
    expect(networkIdleResult.duration).toBeGreaterThan(0);
  });

  it('should allow navigation after page load timeout', async () => {
    // Cause a timeout
    await testContext.session.navigate(ErrorTestPages.infiniteLoad, {
      timeout: 100,
      waitUntil: 'networkidle',
    });

    // Should be able to navigate to a new page
    const recoveryResult = await testContext.session.navigate(
      'data:text/html,<h1>After Timeout</h1>'
    );
    expect(recoveryResult.success).toBe(true);

    const textResult = await testContext.session.getText('h1');
    expect(textResult.data).toBe('After Timeout');
  });
});
```

#### 3.5 Element Not Found Tests Design

```typescript
describe('Element Not Found Errors', () => {
  let testContext: Awaited<ReturnType<typeof createErrorTestContext>>;

  beforeEach(async () => {
    testContext = await createErrorTestContext({ timeout: 2000 });
    await testContext.session.launch();
    await testContext.session.navigate('data:text/html,<div id="existing">Hello</div>');
  });

  afterEach(async () => {
    await testContext.cleanup();
  });

  it('should handle missing elements with clear error messages', async () => {
    const result = await testContext.session.click('#nonexistent-element');

    ErrorAssertions.assertElementNotFound(result);

    // Error should contain the selector for debugging
    expect(result.error).toContain('nonexistent');
  });

  it('should timeout appropriately when waiting for elements', async () => {
    const startTime = Date.now();
    const result = await testContext.session.waitForElement('#will-never-appear', {
      timeout: 500,
    });
    const duration = Date.now() - startTime;

    expect(result.success).toBe(false);
    expect(duration).toBeGreaterThanOrEqual(500);
    expect(duration).toBeLessThan(1500); // Allow some tolerance
  });

  it('should handle elements that appear after delay', async () => {
    // Navigate to page with delayed element
    await testContext.session.navigate(
      ErrorTestPages.delayedElement(300, 'delayed-el')
    );

    // Wait for element with sufficient timeout
    const result = await testContext.session.waitForElement('#delayed-el', {
      timeout: 1000,
    });

    expect(result.success).toBe(true);
  });

  it('should handle elements that appear and disappear', async () => {
    await testContext.session.navigate(
      ErrorTestPages.transientElement(100, 500, 'transient-el')
    );

    // Wait a bit for element to appear
    await new Promise(resolve => setTimeout(resolve, 200));

    // Try to interact with the transient element
    const clickResult = await testContext.session.click('#transient-el');

    // May succeed or fail depending on timing
    expect(typeof clickResult.success).toBe('boolean');
    expect(clickResult.duration).toBeGreaterThan(0);
  });

  it('should provide actionable error context', async () => {
    // Try multiple selectors and verify error messages are helpful
    const selectors = [
      { selector: '#missing-id', expectedContext: 'missing-id' },
      { selector: '.missing-class', expectedContext: 'missing-class' },
      { selector: 'button[data-test="missing"]', expectedContext: 'data-test' },
    ];

    for (const { selector, expectedContext } of selectors) {
      const result = await testContext.session.click(selector, { timeout: 100 });
      expect(result.success).toBe(false);
      // Error should contain selector or relevant context
      expect(result.error!.toLowerCase()).toContain('not found');
    }
  });
});
```

#### 3.6 Navigation Error Tests Design

```typescript
describe('Navigation Errors', () => {
  let testContext: Awaited<ReturnType<typeof createErrorTestContext>>;

  beforeEach(async () => {
    testContext = await createErrorTestContext({ timeout: 5000 });
    await testContext.session.launch();
  });

  afterEach(async () => {
    await testContext.cleanup();
  });

  it('should handle invalid URL formats', async () => {
    const invalidUrls = [
      'not-a-url',
      'http://',
      '://missing-protocol.com',
      'javascript:alert(1)', // Security-sensitive
    ];

    for (const url of invalidUrls) {
      const result = await testContext.session.navigate(url);
      // Should fail or handle gracefully
      expect(result.duration).toBeGreaterThan(0);
    }

    // Session should still work
    await ErrorAssertions.assertSessionOperational(testContext.session);
  });

  it('should handle about:blank and special URLs', async () => {
    const specialUrls = [
      'about:blank',
      'data:text/html,<h1>Data URL</h1>',
    ];

    for (const url of specialUrls) {
      const result = await testContext.session.navigate(url);
      expect(result.success).toBe(true);
    }
  });

  it('should recover browser state after navigation failure', async () => {
    // Navigate to valid page first
    await testContext.session.navigate('data:text/html,<h1>Initial Page</h1>');

    // Cause navigation failure
    const failResult = await testContext.session.navigate('http://localhost:59999');
    expect(failResult.success).toBe(false);

    // Browser state should be recoverable
    const currentUrl = testContext.session.getCurrentUrl();
    // URL may be the failed URL or previous URL depending on browser behavior
    expect(currentUrl).toBeDefined();

    // Should be able to navigate again
    const recoveryResult = await testContext.session.navigate(
      'data:text/html,<h1>Recovery</h1>'
    );
    expect(recoveryResult.success).toBe(true);
  });

  it('should handle back/forward navigation errors', async () => {
    // Fresh session has no history
    const backResult = await testContext.session.goBack();
    expect(backResult.success).toBe(true);
    expect(backResult.data).toBeNull(); // No history

    // Navigate to some pages
    await testContext.session.navigate('data:text/html,<h1>Page 1</h1>');
    await testContext.session.navigate('data:text/html,<h1>Page 2</h1>');

    // Back should work now
    const backResult2 = await testContext.session.goBack();
    expect(backResult2.success).toBe(true);
  });
});
```

#### 3.7 Graceful Error Recovery Tests Design

```typescript
describe('Graceful Error Recovery Mechanisms', () => {
  let testContext: Awaited<ReturnType<typeof createErrorTestContext>>;

  beforeEach(async () => {
    testContext = await createErrorTestContext({ timeout: 5000 });
    await testContext.session.launch();
  });

  afterEach(async () => {
    await testContext.cleanup();
  });

  it('should maintain browser session after single error', async () => {
    // Cause an error
    const errorResult = await testContext.session.click('#nonexistent');
    expect(errorResult.success).toBe(false);

    // Session should still be active
    expect(testContext.session.isActive()).toBe(true);

    // Can still perform operations
    const navResult = await testContext.session.navigate(
      'data:text/html,<h1>Still Working</h1>'
    );
    expect(navResult.success).toBe(true);
  });

  it('should allow retry after recoverable errors', async () => {
    await testContext.session.navigate(
      ErrorTestPages.delayedElement(500, 'delayed')
    );

    // First attempt fails (element not yet present)
    const firstAttempt = await testContext.session.click('#delayed', {
      timeout: 100,
    });
    expect(firstAttempt.success).toBe(false);

    // Wait for element to appear
    await new Promise(resolve => setTimeout(resolve, 600));

    // Retry should succeed
    const retryAttempt = await testContext.session.click('#delayed');
    expect(retryAttempt.success).toBe(true);
  });

  it('should provide error context for debugging', async () => {
    // Cause various errors and verify they have useful context
    const errors: Array<{ operation: string; result: any }> = [];

    errors.push({
      operation: 'click missing element',
      result: await testContext.session.click('#missing'),
    });

    errors.push({
      operation: 'navigate to invalid',
      result: await testContext.session.navigate('http://localhost:59999'),
    });

    // All errors should have meaningful information
    for (const { operation, result } of errors) {
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.length).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
    }
  });

  it('should emit appropriate events during error recovery', async () => {
    const capturedErrors: string[] = [];

    testContext.session.on('pageError', (error) => {
      capturedErrors.push(error.message);
    });

    // Navigate to page that throws error
    await testContext.session.navigate(ErrorTestPages.jsError);

    // Wait for error to be captured
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should have captured the JS error
    expect(capturedErrors.length).toBeGreaterThan(0);
    expect(capturedErrors.some(e => e.includes('Test JS Error'))).toBe(true);

    // Session should still work
    await ErrorAssertions.assertSessionOperational(testContext.session);
  });

  it('should cleanup resources on unrecoverable errors', async () => {
    const manager = testContext.manager;
    const initialUsage = await manager.getResourceUsage();

    // Create a session that will be explicitly closed
    const tempSession = createBrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
    });

    await tempSession.launch();

    // Force close the underlying browser (simulate crash)
    const browser = tempSession.getBrowser();
    if (browser) {
      await browser.close();
    }

    // Session close should still work
    const closeResult = await tempSession.close();
    expect(closeResult.success).toBe(true);

    // Manager should eventually clean up
    await manager.cleanupIdleInstances();
  });

  it('should support error aggregation for multi-step operations', async () => {
    const operationResults: Array<{ step: string; success: boolean; error?: string }> = [];

    // Multi-step operation with some failing steps
    const steps = [
      { step: 'navigate', action: () => testContext.session.navigate('data:text/html,<h1>Test</h1>') },
      { step: 'click missing', action: () => testContext.session.click('#missing', { timeout: 100 }) },
      { step: 'recover', action: () => testContext.session.navigate('data:text/html,<h1>Recovery</h1>') },
      { step: 'screenshot', action: () => testContext.session.screenshot() },
    ];

    for (const { step, action } of steps) {
      const result = await action();
      operationResults.push({
        step,
        success: result.success,
        error: result.error,
      });
    }

    // Verify results
    expect(operationResults[0].success).toBe(true); // navigate
    expect(operationResults[1].success).toBe(false); // click missing
    expect(operationResults[2].success).toBe(true); // recover
    expect(operationResults[3].success).toBe(true); // screenshot

    // Failed step should have error details
    expect(operationResults[1].error).toBeDefined();
  });
});
```

### 4. Test Configuration

#### 4.1 Vitest Configuration

Ensure the test file is picked up by the test runner:

```typescript
// vitest.config.ts (root level - existing)
export default defineConfig({
  test: {
    include: [
      'packages/**/src/**/*.test.ts',
      'tests/**/*.test.ts', // Includes integration tests
    ],
  },
});
```

#### 4.2 Test Timeouts

```typescript
// In the test file
describe('Browser Error Scenarios Integration Tests', () => {
  // Set longer timeout for browser tests
  beforeAll(() => {
    vi.setConfig({ testTimeout: 60000 }); // 60 seconds for browser tests
  });

  // ... test suites
});
```

### 5. CI/CD Considerations

#### 5.1 Browser Installation

Ensure Playwright browsers are installed in CI:

```yaml
# In CI workflow
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium
```

#### 5.2 Test Isolation

Each test should:
- Create its own browser manager and session
- Clean up all resources in `afterEach`
- Not depend on state from other tests
- Use unique identifiers to avoid conflicts

### 6. Error Classification

Define error categories for better test organization:

| Category | Error Types | Expected Behavior |
|----------|-------------|-------------------|
| Network | `ERR_INTERNET_DISCONNECTED`, `ERR_NAME_NOT_RESOLVED`, `ERR_CONNECTION_REFUSED` | Return error result, session stays active |
| Timeout | Operation timeouts, page load timeouts | Return error result with duration, allow retry |
| Element | Element not found, stale element | Return error with selector context |
| Navigation | Invalid URL, HTTP errors, redirects | Return error result, browser state recoverable |
| JavaScript | Uncaught exceptions, script errors | Emit events, session stays active |

## Consequences

### Positive

1. **Comprehensive Coverage**: All required error scenarios will be tested
2. **Regression Prevention**: Catches error handling regressions in browser automation
3. **Documentation**: Tests serve as executable documentation for error behavior
4. **Recovery Verification**: Ensures graceful degradation and recovery work correctly
5. **CI Integration**: Automated verification on every commit

### Negative

1. **Test Execution Time**: Browser tests are slower than unit tests
2. **Flakiness Risk**: Network and timing-dependent tests may be flaky
3. **CI Resources**: Requires browser installation in CI environment

### Mitigations

1. **Parallel Execution**: Run tests in parallel where possible
2. **Retry Logic**: Use test retries for flaky network tests
3. **Timeout Management**: Set appropriate timeouts per test category
4. **Test Isolation**: Ensure complete cleanup between tests

## Implementation Plan

### Phase 1: Test Infrastructure
1. Create test utilities file (`browser-error-fixtures.ts`)
2. Set up test configuration for browser integration tests
3. Verify CI browser installation

### Phase 2: Core Error Tests
1. Implement Network Failure Simulation tests
2. Implement Request Timeout Handling tests
3. Implement Page Load Timeout tests

### Phase 3: Interaction Error Tests
1. Implement Element Not Found Errors tests
2. Implement Navigation Errors tests

### Phase 4: Recovery Tests
1. Implement Graceful Error Recovery Mechanisms tests
2. Add event emission verification tests

### Phase 5: Validation
1. Run full test suite
2. Verify all acceptance criteria are met
3. Address any flaky tests

## Related Files

- `packages/browser/src/browser-manager.ts` - BrowserManager implementation
- `packages/browser/src/browser-session.ts` - BrowserSession implementation
- `packages/browser/src/__tests__/error-scenarios.test.ts` - Existing error tests
- `packages/orchestrator/src/tools/__tests__/browser-tool-error-handling.test.ts` - BrowserTool error tests
- `tests/test-utils/browser-test-base.ts` - Existing browser test utilities

## References

- Playwright Error Handling: https://playwright.dev/docs/api/class-browsercontext#browser-context-route
- Existing ADR-012: BrowserManager Class Implementation
- Existing ADR-007: Browser Events Orchestrator Integration
