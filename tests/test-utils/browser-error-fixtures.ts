/**
 * Browser Error Test Fixtures and Utilities
 *
 * Provides shared test utilities for browser error scenario testing:
 * - Error test pages (HTML fixtures)
 * - Error assertion utilities
 * - Test context creation with error tracking
 *
 * @module tests/test-utils/browser-error-fixtures
 */

import { expect } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  BrowserSession,
  BrowserManager,
} from '@apexcli/browser';
import type {
  CapturedJavaScriptError,
  PageErrorEvent,
  BrowserActionResult,
} from '@apexcli/browser';

/**
 * Test page generators for error scenarios
 *
 * These generate data URLs with HTML content designed to trigger
 * specific error conditions for testing.
 */
export const ErrorTestPages = {
  /**
   * Page that throws JavaScript error on load
   */
  jsError: `data:text/html,
    <html>
      <head><title>JS Error Page</title></head>
      <body>
        <h1>JS Error Test</h1>
        <script>throw new Error('Test JS Error');</script>
      </body>
    </html>
  `,

  /**
   * Page with unhandled promise rejection
   */
  promiseRejection: `data:text/html,
    <html>
      <head><title>Promise Rejection Page</title></head>
      <body>
        <h1>Promise Rejection Test</h1>
        <script>
          Promise.reject(new Error('Unhandled Promise Rejection'));
        </script>
      </body>
    </html>
  `,

  /**
   * Page with slow-loading content that can cause timeouts
   *
   * @param delayMs - Delay in milliseconds before content appears
   */
  slowResource: (delayMs: number) => `data:text/html,
    <html>
      <head><title>Slow Resource</title></head>
      <body>
        <div id="loading">Loading...</div>
        <script>
          setTimeout(() => {
            document.getElementById('loading').textContent = 'Loaded';
            const loaded = document.createElement('div');
            loaded.id = 'loaded';
            loaded.textContent = 'Content Loaded';
            document.body.appendChild(loaded);
          }, ${delayMs});
        </script>
      </body>
    </html>
  `,

  /**
   * Page that simulates infinite loading (has pending network request)
   */
  infiniteLoad: `data:text/html,
    <html>
      <head><title>Infinite Load</title></head>
      <body>
        <div id="content">Waiting...</div>
        <script>
          // Create an image with invalid src to simulate pending network request
          const img = document.createElement('img');
          img.src = 'http://10.255.255.1:9999/nonexistent.png';
          img.onerror = () => {
            document.getElementById('content').textContent = 'Error loading image';
          };
          document.body.appendChild(img);
        </script>
      </body>
    </html>
  `,

  /**
   * Page with element that appears after delay
   *
   * @param delayMs - Delay before element appears
   * @param elementId - ID of the element to create
   */
  delayedElement: (delayMs: number, elementId: string) => `data:text/html,
    <html>
      <head><title>Delayed Element</title></head>
      <body>
        <div id="placeholder">Waiting for element...</div>
        <script>
          setTimeout(() => {
            const el = document.createElement('div');
            el.id = '${elementId}';
            el.textContent = 'Appeared!';
            el.className = 'delayed-content';
            document.body.appendChild(el);
          }, ${delayMs});
        </script>
      </body>
    </html>
  `,

  /**
   * Page with element that appears then disappears (transient)
   *
   * @param appearMs - Time until element appears
   * @param disappearMs - Time until element disappears (from page load)
   * @param elementId - ID of the transient element
   */
  transientElement: (
    appearMs: number,
    disappearMs: number,
    elementId: string
  ) => `data:text/html,
    <html>
      <head><title>Transient Element</title></head>
      <body>
        <div id="status">Element will appear briefly</div>
        <script>
          setTimeout(() => {
            const el = document.createElement('button');
            el.id = '${elementId}';
            el.textContent = 'Click me (quickly!)';
            document.body.appendChild(el);

            setTimeout(() => {
              el.remove();
              document.getElementById('status').textContent = 'Element removed';
            }, ${disappearMs - appearMs});
          }, ${appearMs});
        </script>
      </body>
    </html>
  `,

  /**
   * Page with console output of various levels
   */
  consoleOutputPage: `data:text/html,
    <html>
      <head><title>Console Output</title></head>
      <body>
        <h1>Console Test</h1>
        <script>
          console.log('Log message');
          console.info('Info message');
          console.warn('Warning message');
          console.error('Error message');
          console.debug('Debug message');
        </script>
      </body>
    </html>
  `,

  /**
   * Simple valid page for recovery testing
   *
   * @param title - Page title and heading content
   */
  simplePage: (title: string) => `data:text/html,
    <html>
      <head><title>${title}</title></head>
      <body>
        <h1>${title}</h1>
        <p>Simple test page content</p>
      </body>
    </html>
  `,

  /**
   * Page with form elements for interaction testing
   */
  formPage: `data:text/html,
    <html>
      <head><title>Form Test</title></head>
      <body>
        <form id="test-form">
          <input type="text" id="text-input" placeholder="Enter text" />
          <button type="button" id="submit-btn">Submit</button>
          <div id="output"></div>
        </form>
        <script>
          document.getElementById('submit-btn').addEventListener('click', () => {
            const input = document.getElementById('text-input').value;
            document.getElementById('output').textContent = 'Submitted: ' + input;
          });
        </script>
      </body>
    </html>
  `,
};

/**
 * Error assertion utilities for common error patterns
 */
export const ErrorAssertions = {
  /**
   * Assert that a result indicates a timeout error
   *
   * @param result - Browser action result to check
   */
  assertTimeoutError: (result: BrowserActionResult<unknown>) => {
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.toLowerCase()).toMatch(/timeout|timed out|waiting/i);
  },

  /**
   * Assert that a result indicates a network error
   *
   * @param result - Browser action result to check
   */
  assertNetworkError: (result: BrowserActionResult<unknown>) => {
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!).toMatch(/net::|ERR_|network|connection|failed/i);
  },

  /**
   * Assert that a result indicates element not found
   *
   * @param result - Browser action result to check
   */
  assertElementNotFound: (result: BrowserActionResult<unknown>) => {
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.toLowerCase()).toMatch(/not found|no element|selector|waiting/i);
  },

  /**
   * Assert that session is still operational after an error
   *
   * @param session - Browser session to verify
   */
  assertSessionOperational: async (session: BrowserSession) => {
    const navResult = await session.navigate(ErrorTestPages.simplePage('Recovery Test'));
    expect(navResult.success).toBe(true);

    const textResult = await session.getText('h1');
    expect(textResult.success).toBe(true);
    expect(textResult.data).toBe('Recovery Test');
  },

  /**
   * Assert that an error result has meaningful context
   *
   * @param result - Browser action result to check
   * @param expectedContext - Substring expected in error message
   */
  assertErrorHasContext: (
    result: BrowserActionResult<unknown>,
    expectedContext?: string
  ) => {
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.length).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThan(0);

    if (expectedContext) {
      expect(result.error!.toLowerCase()).toContain(expectedContext.toLowerCase());
    }
  },

  /**
   * Assert that duration is within expected range
   *
   * @param result - Browser action result to check
   * @param minMs - Minimum expected duration
   * @param maxMs - Maximum expected duration
   */
  assertDurationInRange: (
    result: BrowserActionResult<unknown>,
    minMs: number,
    maxMs: number
  ) => {
    expect(result.duration).toBeGreaterThanOrEqual(minMs);
    expect(result.duration).toBeLessThan(maxMs);
  },
};

/**
 * Error tracking interface for test context
 */
export interface TrackedError {
  type: 'pageError' | 'javascriptError' | 'consoleError';
  message: string;
  timestamp: Date;
  details?: unknown;
}

/**
 * Browser test context with error tracking
 */
export interface BrowserErrorTestContext {
  manager: BrowserManager;
  session: BrowserSession;
  errors: TrackedError[];
  cleanup: () => Promise<void>;
}

/**
 * Configuration options for error test context
 */
export interface ErrorTestContextConfig {
  browserType?: 'chromium' | 'firefox' | 'webkit';
  timeout?: number;
  maxInstances?: number;
  captureConsole?: boolean;
  captureErrors?: boolean;
}

/**
 * Create a browser test context with error tracking
 *
 * Creates a BrowserManager and BrowserSession configured for testing,
 * with automatic error event tracking and cleanup.
 *
 * @param config - Configuration options
 * @returns Test context with manager, session, errors array, and cleanup function
 *
 * @example
 * ```typescript
 * const ctx = await createErrorTestContext({ timeout: 5000 });
 * await ctx.session.launch();
 *
 * // ... run tests ...
 *
 * // Check captured errors
 * expect(ctx.errors.some(e => e.type === 'javascriptError')).toBe(true);
 *
 * // Always cleanup
 * await ctx.cleanup();
 * ```
 */
export async function createErrorTestContext(
  config?: ErrorTestContextConfig
): Promise<BrowserErrorTestContext> {
  const errors: TrackedError[] = [];

  const manager = createBrowserManager({
    maxInstances: config?.maxInstances ?? 3,
    defaultSessionConfig: {
      browserType: config?.browserType ?? 'chromium',
      headless: true,
      timeout: config?.timeout ?? 10000,
    },
  });

  const session = createBrowserSession(
    manager,
    {
      browserType: config?.browserType ?? 'chromium',
      headless: true,
      timeout: config?.timeout ?? 10000,
    },
    {
      captureConsole: config?.captureConsole ?? true,
      captureErrors: config?.captureErrors ?? true,
      maxBufferSize: 100,
    }
  );

  // Track page errors
  session.on('pageError', (error: PageErrorEvent) => {
    errors.push({
      type: 'pageError',
      message: error.message,
      timestamp: new Date(error.timestamp),
      details: {
        stack: error.stack,
        filename: error.filename,
        lineno: error.lineno,
      },
    });
  });

  // Track JavaScript errors
  session.on('javascriptError', (error: CapturedJavaScriptError) => {
    errors.push({
      type: 'javascriptError',
      message: error.message,
      timestamp: new Date(error.timestamp),
      details: {
        name: error.name,
        stack: error.stack,
        source: error.source,
        uncaught: error.uncaught,
      },
    });
  });

  // Track console errors specifically
  session.on('consoleMessage', (msg) => {
    if (msg.type === 'error') {
      errors.push({
        type: 'consoleError',
        message: msg.text,
        timestamp: new Date(msg.timestamp),
        details: {
          args: msg.args,
          location: msg.location,
        },
      });
    }
  });

  const cleanup = async () => {
    try {
      await session.close();
    } catch {
      // Ignore close errors during cleanup
    }
    try {
      await manager.shutdown();
    } catch {
      // Ignore shutdown errors during cleanup
    }
  };

  return {
    manager,
    session,
    errors,
    cleanup,
  };
}

/**
 * Wait helper with error-safe execution
 *
 * @param ms - Milliseconds to wait
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 *
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelayMs - Base delay between retries
 * @returns Result of successful execution or last error
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<BrowserActionResult<T>>,
  maxRetries: number = 3,
  baseDelayMs: number = 100
): Promise<BrowserActionResult<T>> {
  let lastResult: BrowserActionResult<T> | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    lastResult = await fn();

    if (lastResult.success) {
      return lastResult;
    }

    if (attempt < maxRetries) {
      await wait(baseDelayMs * Math.pow(2, attempt));
    }
  }

  return lastResult!;
}

/**
 * Test invalid URLs for navigation error testing
 */
export const InvalidUrls = {
  malformed: [
    'not-a-url',
    'http://',
    '://missing-protocol.com',
    'htp://typo-protocol.com',
  ],
  unreachable: [
    'http://10.255.255.1:9999/unreachable', // Non-routable IP
    'http://localhost:59999', // Unlikely to have service
    'http://this-domain-should-not-exist-12345.invalid',
  ],
  security: [
    'javascript:alert(1)',
    'file:///etc/passwd',
  ],
};

/**
 * Selectors that will not match any element (for element not found testing)
 */
export const MissingSelectors = {
  ids: ['#nonexistent-element', '#missing-id-12345', '#__never_exists__'],
  classes: ['.missing-class', '.no-such-class'],
  attributes: ['[data-test="missing"]', '[aria-label="not found"]'],
  complex: ['div#container .nested .missing', 'ul > li:nth-child(999)'],
  malformed: ['###invalid', '[[bad]]', 'div[attr='],
};
