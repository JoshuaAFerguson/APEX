/**
 * @fileoverview Error page browser test fixtures and scenarios
 *
 * This file provides reusable fixtures for browser-based error state testing:
 * - HTTP error responses (404, 500, 502, 503)
 * - Network error simulation (DNS failures, timeouts, connection refused)
 * - JavaScript runtime error pages
 * - Custom APEX error display pages
 * - Error page setup/teardown utilities
 *
 * Architecture Decision: Uses Playwright's route interception to simulate
 * server-side errors without requiring a real HTTP server. This approach
 * is deterministic, fast, and works in CI environments.
 *
 * @see common-scenarios.ts for non-error browser test fixtures
 * @see ../utils/test-helpers.ts for shared browser test utilities
 */

import { Page, Route } from 'playwright';

// ============================================================================
// Error Scenario Types
// ============================================================================

/**
 * Represents an HTTP error scenario for browser testing.
 * Each scenario defines the error condition, the expected page state,
 * and validation criteria.
 */
export interface ErrorPageScenario {
  /** Human-readable name for test identification */
  name: string;
  /** Description of the error condition being simulated */
  description: string;
  /** HTTP status code (0 for network-level errors) */
  statusCode: number;
  /** HTTP status text */
  statusText: string;
  /** Error category for grouping related scenarios */
  category: ErrorCategory;
  /** Expected page title or title pattern after error */
  expectedTitle?: string;
  /** Expected visible text content on the error page */
  expectedContent?: string[];
  /** Expected console error messages */
  expectedConsoleErrors?: string[];
  /** Timeout for the scenario in milliseconds */
  timeout?: number;
}

/**
 * Network-level error scenario that prevents HTTP response entirely.
 */
export interface NetworkErrorScenario {
  /** Human-readable name for test identification */
  name: string;
  /** Description of the network failure */
  description: string;
  /** The type of network error to simulate */
  errorType: NetworkErrorType;
  /** Expected error message pattern in the browser */
  expectedErrorPattern: string;
  /** Timeout for the scenario in milliseconds */
  timeout?: number;
}

/**
 * JavaScript runtime error scenario for error boundary testing.
 */
export interface RuntimeErrorScenario {
  /** Human-readable name for test identification */
  name: string;
  /** Description of the runtime error */
  description: string;
  /** JavaScript code that produces the error */
  errorScript: string;
  /** Expected error type (e.g., TypeError, ReferenceError) */
  expectedErrorType: string;
  /** Expected error message pattern */
  expectedMessagePattern: string;
}

/** Categories for organizing error scenarios */
export type ErrorCategory = 'client' | 'server' | 'network' | 'runtime';

/** Network error types supported by the fixture */
export type NetworkErrorType =
  | 'dns-not-resolved'
  | 'connection-refused'
  | 'connection-timeout'
  | 'connection-reset'
  | 'ssl-error';

// ============================================================================
// HTTP Error Page Scenarios
// ============================================================================

/**
 * Standard HTTP error scenarios covering common client and server errors.
 * These use Playwright route interception to return specific status codes.
 */
export const HTTP_ERROR_SCENARIOS: ErrorPageScenario[] = [
  {
    name: '404 Not Found',
    description: 'Resource does not exist on the server',
    statusCode: 404,
    statusText: 'Not Found',
    category: 'client',
    expectedTitle: 'Error 404',
    expectedContent: ['Not Found', 'The requested resource could not be found'],
    timeout: 10000,
  },
  {
    name: '403 Forbidden',
    description: 'Access denied to the requested resource',
    statusCode: 403,
    statusText: 'Forbidden',
    category: 'client',
    expectedTitle: 'Error 403',
    expectedContent: ['Forbidden', 'You do not have permission to access this resource'],
    timeout: 10000,
  },
  {
    name: '500 Internal Server Error',
    description: 'Server encountered an unexpected condition',
    statusCode: 500,
    statusText: 'Internal Server Error',
    category: 'server',
    expectedTitle: 'Error 500',
    expectedContent: ['Internal Server Error', 'The server encountered an unexpected error'],
    timeout: 10000,
  },
  {
    name: '502 Bad Gateway',
    description: 'Invalid response from upstream server',
    statusCode: 502,
    statusText: 'Bad Gateway',
    category: 'server',
    expectedTitle: 'Error 502',
    expectedContent: ['Bad Gateway', 'The server received an invalid response'],
    timeout: 10000,
  },
  {
    name: '503 Service Unavailable',
    description: 'Server is temporarily unable to handle the request',
    statusCode: 503,
    statusText: 'Service Unavailable',
    category: 'server',
    expectedTitle: 'Error 503',
    expectedContent: ['Service Unavailable', 'The server is temporarily unavailable'],
    timeout: 10000,
  },
  {
    name: '429 Too Many Requests',
    description: 'Rate limiting has been applied',
    statusCode: 429,
    statusText: 'Too Many Requests',
    category: 'client',
    expectedTitle: 'Error 429',
    expectedContent: ['Too Many Requests', 'You have exceeded the rate limit'],
    timeout: 10000,
  },
];

/**
 * Network-level error scenarios that prevent any HTTP response.
 */
export const NETWORK_ERROR_SCENARIOS: NetworkErrorScenario[] = [
  {
    name: 'DNS Resolution Failure',
    description: 'Domain name cannot be resolved to an IP address',
    errorType: 'dns-not-resolved',
    expectedErrorPattern: 'ERR_NAME_NOT_RESOLVED',
    timeout: 10000,
  },
  {
    name: 'Connection Refused',
    description: 'Server actively refused the connection',
    errorType: 'connection-refused',
    expectedErrorPattern: 'ERR_CONNECTION_REFUSED',
    timeout: 10000,
  },
  {
    name: 'Connection Timeout',
    description: 'Server did not respond within the timeout period',
    errorType: 'connection-timeout',
    expectedErrorPattern: 'ERR_TIMED_OUT',
    timeout: 15000,
  },
  {
    name: 'Connection Reset',
    description: 'Connection was unexpectedly terminated by the server',
    errorType: 'connection-reset',
    expectedErrorPattern: 'ERR_CONNECTION_RESET',
    timeout: 10000,
  },
  {
    name: 'SSL/TLS Error',
    description: 'SSL certificate validation failed',
    errorType: 'ssl-error',
    expectedErrorPattern: 'ERR_CERT_',
    timeout: 10000,
  },
];

/**
 * JavaScript runtime error scenarios for testing error boundaries.
 */
export const RUNTIME_ERROR_SCENARIOS: RuntimeErrorScenario[] = [
  {
    name: 'Uncaught TypeError',
    description: 'Accessing property of undefined value',
    errorScript: 'const obj = undefined; obj.property;',
    expectedErrorType: 'TypeError',
    expectedMessagePattern: "Cannot read properties of undefined",
  },
  {
    name: 'Uncaught ReferenceError',
    description: 'Using an undeclared variable',
    errorScript: 'console.log(undeclaredVariable);',
    expectedErrorType: 'ReferenceError',
    expectedMessagePattern: 'undeclaredVariable is not defined',
  },
  {
    name: 'Unhandled Promise Rejection',
    description: 'Promise rejected without a catch handler',
    errorScript: 'Promise.reject(new Error("Async operation failed"));',
    expectedErrorType: 'Error',
    expectedMessagePattern: 'Async operation failed',
  },
  {
    name: 'Stack Overflow',
    description: 'Infinite recursion causing stack overflow',
    errorScript: 'function recurse() { recurse(); } recurse();',
    expectedErrorType: 'RangeError',
    expectedMessagePattern: 'Maximum call stack size exceeded',
  },
];

// ============================================================================
// Error Page HTML Templates
// ============================================================================

/**
 * Generates an HTML error page matching the given HTTP error scenario.
 * The generated page includes structured data attributes for easy test validation.
 */
function generateErrorPageHTML(scenario: ErrorPageScenario): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>${scenario.expectedTitle || `Error ${scenario.statusCode}`}</title>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 40px;
      background: #f8f9fa;
      color: #333;
    }
    .error-container {
      max-width: 600px;
      margin: 60px auto;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      text-align: center;
    }
    .error-code {
      font-size: 72px;
      font-weight: bold;
      color: ${scenario.category === 'server' ? '#dc3545' : '#fd7e14'};
      margin-bottom: 10px;
    }
    .error-title {
      font-size: 24px;
      margin-bottom: 16px;
      color: #495057;
    }
    .error-message {
      font-size: 16px;
      color: #6c757d;
      line-height: 1.6;
    }
    .error-details {
      margin-top: 24px;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 4px;
      font-family: monospace;
      font-size: 14px;
      color: #868e96;
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="error-container" data-testid="error-container" data-error-code="${scenario.statusCode}" data-error-category="${scenario.category}">
    <div class="error-code" data-testid="error-code">${scenario.statusCode}</div>
    <h1 class="error-title" data-testid="error-title">${scenario.statusText}</h1>
    <p class="error-message" data-testid="error-message">
      ${(scenario.expectedContent || []).slice(1).join(' ')}
    </p>
    <div class="error-details" data-testid="error-details">
      <strong>Status:</strong> ${scenario.statusCode} ${scenario.statusText}<br>
      <strong>Category:</strong> ${scenario.category}<br>
      <strong>Timestamp:</strong> <span id="error-timestamp"></span>
    </div>
  </div>
  <script>
    document.getElementById('error-timestamp').textContent = new Date().toISOString();
    console.error('Error ${scenario.statusCode}: ${scenario.statusText}');
  </script>
</body>
</html>`;
}

/**
 * Generates an HTML page that triggers a JavaScript runtime error.
 */
function generateRuntimeErrorPageHTML(scenario: RuntimeErrorScenario): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Runtime Error Test</title>
  <meta charset="UTF-8">
  <style>
    body { font-family: sans-serif; margin: 40px; background: #f8f9fa; }
    .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
    #error-output { color: #dc3545; margin-top: 16px; padding: 12px; background: #f8d7da; border-radius: 4px; display: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Runtime Error Test: ${scenario.name}</h1>
    <p>${scenario.description}</p>
    <button id="trigger-error" data-testid="trigger-error">Trigger Error</button>
    <div id="error-output" data-testid="error-output"></div>
  </div>
  <script>
    window.onerror = function(message, source, lineno, colno, error) {
      var output = document.getElementById('error-output');
      output.style.display = 'block';
      output.textContent = (error ? error.constructor.name + ': ' : '') + message;
      return true;
    };

    window.onunhandledrejection = function(event) {
      var output = document.getElementById('error-output');
      output.style.display = 'block';
      output.textContent = 'UnhandledRejection: ' + event.reason.message;
    };

    document.getElementById('trigger-error').addEventListener('click', function() {
      ${scenario.errorScript}
    });
  </script>
</body>
</html>`;
}

// ============================================================================
// Setup and Teardown Utilities
// ============================================================================

/** Tracks active route handlers for cleanup */
interface ErrorPageFixtureState {
  activeRoutes: string[];
  originalConsoleErrors: Array<{ type: string; text: string }>;
}

/**
 * Sets up a page to display an HTTP error scenario.
 *
 * This function configures the page with route interception to simulate
 * server-side errors, then navigates to a URL that triggers the error.
 *
 * @param page - Playwright Page instance
 * @param scenario - The error scenario to simulate
 * @returns Fixture state for teardown
 *
 * @example
 * ```typescript
 * const state = await setupHttpErrorPage(page, HTTP_ERROR_SCENARIOS[0]);
 * // ... run assertions ...
 * await teardownErrorPage(page, state);
 * ```
 */
export async function setupHttpErrorPage(
  page: Page,
  scenario: ErrorPageScenario
): Promise<ErrorPageFixtureState> {
  const state: ErrorPageFixtureState = {
    activeRoutes: [],
    originalConsoleErrors: [],
  };

  // Capture console errors during setup
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      state.originalConsoleErrors.push({
        type: msg.type(),
        text: msg.text(),
      });
    }
  });

  // Set the error page content directly using data URL with generated HTML
  const errorHTML = generateErrorPageHTML(scenario);
  await page.setContent(errorHTML);
  await page.waitForLoadState('domcontentloaded');

  return state;
}

/**
 * Sets up route interception to return HTTP error responses for
 * any navigation to the specified URL pattern.
 *
 * Use this when testing how an application handles error responses
 * from API calls or page navigations.
 *
 * @param page - Playwright Page instance
 * @param urlPattern - URL pattern to intercept (glob or regex string)
 * @param scenario - The error scenario to simulate
 * @returns Fixture state for teardown
 *
 * @example
 * ```typescript
 * const state = await setupErrorRouteInterception(page, '**/api/**', HTTP_ERROR_SCENARIOS[2]);
 * await page.goto('http://localhost:3000/dashboard'); // API calls will get 500 errors
 * await teardownErrorPage(page, state);
 * ```
 */
export async function setupErrorRouteInterception(
  page: Page,
  urlPattern: string,
  scenario: ErrorPageScenario
): Promise<ErrorPageFixtureState> {
  const state: ErrorPageFixtureState = {
    activeRoutes: [urlPattern],
    originalConsoleErrors: [],
  };

  await page.route(urlPattern, (route: Route) => {
    route.fulfill({
      status: scenario.statusCode,
      headers: { 'Content-Type': 'text/html' },
      body: generateErrorPageHTML(scenario),
    });
  });

  return state;
}

/**
 * Sets up route interception to simulate network-level errors.
 *
 * @param page - Playwright Page instance
 * @param urlPattern - URL pattern to intercept
 * @param scenario - The network error scenario to simulate
 * @returns Fixture state for teardown
 *
 * @example
 * ```typescript
 * const state = await setupNetworkErrorInterception(page, '**/api/**', NETWORK_ERROR_SCENARIOS[0]);
 * // Navigation to matched URLs will fail with network errors
 * await teardownErrorPage(page, state);
 * ```
 */
export async function setupNetworkErrorInterception(
  page: Page,
  urlPattern: string,
  scenario: NetworkErrorScenario
): Promise<ErrorPageFixtureState> {
  const state: ErrorPageFixtureState = {
    activeRoutes: [urlPattern],
    originalConsoleErrors: [],
  };

  await page.route(urlPattern, (route: Route) => {
    route.abort(mapNetworkErrorType(scenario.errorType));
  });

  return state;
}

/**
 * Sets up a page with a JavaScript runtime error scenario.
 *
 * The page includes a "Trigger Error" button that, when clicked,
 * executes the error-producing script. Error output is displayed
 * in a designated element for validation.
 *
 * @param page - Playwright Page instance
 * @param scenario - The runtime error scenario to simulate
 * @returns Fixture state for teardown
 *
 * @example
 * ```typescript
 * const state = await setupRuntimeErrorPage(page, RUNTIME_ERROR_SCENARIOS[0]);
 * await page.click('[data-testid="trigger-error"]');
 * const errorText = await page.textContent('[data-testid="error-output"]');
 * expect(errorText).toContain('TypeError');
 * await teardownErrorPage(page, state);
 * ```
 */
export async function setupRuntimeErrorPage(
  page: Page,
  scenario: RuntimeErrorScenario
): Promise<ErrorPageFixtureState> {
  const state: ErrorPageFixtureState = {
    activeRoutes: [],
    originalConsoleErrors: [],
  };

  const errorHTML = generateRuntimeErrorPageHTML(scenario);
  await page.setContent(errorHTML);
  await page.waitForLoadState('domcontentloaded');

  return state;
}

/**
 * Sets up multiple error route interceptions for testing cascading failures.
 *
 * @param page - Playwright Page instance
 * @param errorMap - Map of URL patterns to error scenarios
 * @returns Fixture state for teardown
 *
 * @example
 * ```typescript
 * const state = await setupMultipleErrorRoutes(page, {
 *   '**/api/users': HTTP_ERROR_SCENARIOS[0],   // 404
 *   '**/api/data':  HTTP_ERROR_SCENARIOS[2],    // 500
 * });
 * ```
 */
export async function setupMultipleErrorRoutes(
  page: Page,
  errorMap: Record<string, ErrorPageScenario>
): Promise<ErrorPageFixtureState> {
  const state: ErrorPageFixtureState = {
    activeRoutes: Object.keys(errorMap),
    originalConsoleErrors: [],
  };

  for (const [urlPattern, scenario] of Object.entries(errorMap)) {
    await page.route(urlPattern, (route: Route) => {
      route.fulfill({
        status: scenario.statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: scenario.statusText,
          message: scenario.description,
          statusCode: scenario.statusCode,
        }),
      });
    });
  }

  return state;
}

/**
 * Tears down error page fixtures, cleaning up route interceptions
 * and resetting page state.
 *
 * @param page - Playwright Page instance
 * @param state - Fixture state returned from a setup function
 */
export async function teardownErrorPage(
  page: Page,
  state: ErrorPageFixtureState
): Promise<void> {
  // Unroute all active route handlers
  for (const pattern of state.activeRoutes) {
    try {
      await page.unroute(pattern);
    } catch {
      // Route may already be removed; ignore cleanup errors
    }
  }

  // Clear the state
  state.activeRoutes = [];
  state.originalConsoleErrors = [];
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates that the current page displays the expected error state.
 *
 * @param page - Playwright Page instance
 * @param scenario - The expected error scenario
 * @returns Validation result with details
 */
export async function validateErrorPageState(
  page: Page,
  scenario: ErrorPageScenario
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Validate error code display
  const errorCodeEl = page.locator('[data-testid="error-code"]');
  if (await errorCodeEl.count() > 0) {
    const codeText = await errorCodeEl.textContent();
    if (codeText?.trim() !== String(scenario.statusCode)) {
      errors.push(`Expected error code ${scenario.statusCode}, got "${codeText}"`);
    }
  }

  // Validate error title
  const titleEl = page.locator('[data-testid="error-title"]');
  if (await titleEl.count() > 0) {
    const titleText = await titleEl.textContent();
    if (titleText?.trim() !== scenario.statusText) {
      errors.push(`Expected title "${scenario.statusText}", got "${titleText}"`);
    }
  }

  // Validate error category attribute
  const containerEl = page.locator('[data-testid="error-container"]');
  if (await containerEl.count() > 0) {
    const category = await containerEl.getAttribute('data-error-category');
    if (category !== scenario.category) {
      errors.push(`Expected category "${scenario.category}", got "${category}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Maps fixture network error types to Playwright's abort error strings.
 */
function mapNetworkErrorType(errorType: NetworkErrorType): string {
  const mapping: Record<NetworkErrorType, string> = {
    'dns-not-resolved': 'namenotresolved',
    'connection-refused': 'connectionrefused',
    'connection-timeout': 'timedout',
    'connection-reset': 'connectionreset',
    'ssl-error': 'failed',
  };
  return mapping[errorType] || 'failed';
}

// ============================================================================
// Convenience Re-exports
// ============================================================================

export {
  ErrorPageScenario,
  NetworkErrorScenario,
  RuntimeErrorScenario,
  ErrorCategory,
  NetworkErrorType,
  ErrorPageFixtureState,
};
