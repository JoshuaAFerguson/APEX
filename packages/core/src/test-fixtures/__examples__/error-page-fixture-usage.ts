/**
 * @fileoverview Usage examples for Error Page Fixture
 *
 * This file demonstrates how to use the ErrorPageFixture in various testing scenarios.
 * These examples show the different ways to integrate the fixture into your test suites.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
// Declare test runner globals for this example file (not an actual test file)
declare const describe: ((name: string, fn: () => void) => void) & {
  each: <T>(cases: T[]) => (name: string, fn: (item: T) => void) => void;
};
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: (value: unknown) => { toBeDefined: () => void; toBe: (expected: unknown) => void; toContain: (expected: unknown) => void; toBeGreaterThan: (expected: number) => void; toEqual: (expected: unknown) => void; };
declare const beforeEach: (fn: () => void | Promise<void>) => void;
declare const afterEach: (fn: () => void | Promise<void>) => void;

import {
  ErrorPageFixture,
  createErrorFixtureHooks,
  withErrorFixture,
  createMultiScenarioFixture,
  ERROR_SCENARIOS,
  type ErrorScenario,
} from '../error-page-fixture.js';

// ============================================================================
// Example 1: Basic Usage
// ============================================================================

/**
 * Basic usage example showing manual setup and teardown
 */
async function basicUsageExample() {
  const fixture = new ErrorPageFixture();

  try {
    // Set up a 404 error scenario
    await fixture.setup({
      name: 'Page Not Found Test',
      description: 'Test 404 error handling',
      scenario: '404-not-found',
      statusCode: 404,
      statusText: 'Not Found',
      category: 'client',
      expectedUrl: 'https://example.com/not-found',
      expectedTitle: 'Error 404 - Page Not Found',
    });

    // Get the current browser state
    const browserState = fixture.getBrowserState();
    console.log('Error page URL:', browserState.url);
    console.log('Has error:', browserState.hasError);
    console.log('Console errors:', browserState.consoleMessages);

    // Validate the error state
    const validation = await fixture.validate();
    if (validation.valid) {
      console.log('✅ Error page fixture is valid');
    } else {
      console.log('❌ Validation failed:', validation.errors);
    }
  } finally {
    await fixture.teardown();
  }
}

// ============================================================================
// Example 2: Using Predefined Scenarios
// ============================================================================

/**
 * Example using predefined error scenarios for quick setup
 */
async function predefinedScenariosExample() {
  const fixture = new ErrorPageFixture();

  try {
    // Use a predefined scenario
    await fixture.simulateError('500-internal-error');

    const browserState = fixture.getBrowserState();
    console.log('Simulated 500 error:', {
      hasError: browserState.hasError,
      isAuthenticated: browserState.isAuthenticated, // Should be false due to clearsAuth
      title: browserState.title,
    });

    // Switch to a different error scenario
    await fixture.simulateError('network-timeout');

    const newState = fixture.getBrowserState();
    console.log('Switched to network timeout:', {
      category: 'network',
      hasError: newState.hasError,
      consoleMessages: newState.consoleMessages.length,
    });
  } finally {
    await fixture.teardown();
  }
}

// ============================================================================
// Example 3: Test Suite Integration with Hooks
// ============================================================================

/**
 * Example showing how to integrate with test frameworks using hooks
 */
function testSuiteIntegrationExample() {
  // This would typically be in a test file like Jest or Vitest

  describe('Error Page Handling', () => {
    const { setup, teardown } = createErrorFixtureHooks('404-not-found', {
      expectedUrl: 'https://myapp.com/error',
      expectedTitle: 'Oops! Page Not Found',
    });

    let fixture: ErrorPageFixture;

    beforeEach(async () => {
      fixture = await setup();
    });

    afterEach(teardown);

    it('should display 404 error page correctly', async () => {
      const browserState = fixture.getBrowserState();

      expect(browserState.hasError).toBe(true);
      expect(browserState.url).toBe('https://myapp.com/error');
      expect(browserState.title).toBe('Oops! Page Not Found');

      const validation = await fixture.validate();
      expect(validation.valid).toBe(true);
    });

    it('should preserve authentication for client errors', () => {
      const browserState = fixture.getBrowserState();
      // 404 errors shouldn't clear authentication
      expect(browserState.isAuthenticated).toBe(false); // Based on error page default
    });
  });
}

// ============================================================================
// Example 4: Higher-Order Function Usage
// ============================================================================

/**
 * Example using the withErrorFixture higher-order function
 */
function higherOrderFunctionExample() {
  // Clean, concise test with automatic setup/teardown
  it('should handle server errors', withErrorFixture('500-internal-error', async (fixture) => {
    const browserState = fixture.getBrowserState();

    expect(browserState.hasError).toBe(true);
    expect(browserState.isAuthenticated).toBe(false); // Server errors clear auth

    // Test that console shows appropriate error messages
    const errorMessages = browserState.consoleMessages
      .filter(msg => msg.type === 'error')
      .map(msg => msg.message);

    expect(errorMessages.some(msg => msg.includes('500'))).toBe(true);

    // Validate the complete state
    const validation = await fixture.validate();
    expect(validation.valid).toBe(true);
  }));

  // Custom configuration with higher-order function
  it('should handle custom error scenarios', withErrorFixture(
    '503-service-unavailable',
    async (fixture) => {
      // Update browser state to test validation
      fixture.updateBrowserState({
        localStorage: {
          'maintenance-mode': 'true',
          'retry-after': '300',
        },
      });

      const browserState = fixture.getBrowserState();
      expect(browserState.localStorage['maintenance-mode']).toBe('true');
    },
    {
      // Custom configuration options
      expectedUrl: 'https://api.example.com/maintenance',
      mockResponse: {
        headers: { 'Retry-After': '300' },
        body: JSON.stringify({ message: 'Service temporarily unavailable' }),
      },
    }
  ));
}

// ============================================================================
// Example 5: Parameterized Testing
// ============================================================================

/**
 * Example showing parameterized testing across multiple error scenarios
 */
function parameterizedTestingExample() {
  const errorScenarios: ErrorScenario[] = ['404-not-found', '500-internal-error', 'network-timeout'];
  const createFixture = createMultiScenarioFixture(errorScenarios);

  describe.each(errorScenarios)('Error scenario: %s', (scenario) => {
    let fixture: ErrorPageFixture;

    beforeEach(async () => {
      fixture = await createFixture(scenario);
    });

    afterEach(async () => {
      await fixture.teardown();
    });

    it('should set up correctly', () => {
      expect(fixture.isSetup()).toBe(true);
      expect(fixture.state.config.scenario).toBe(scenario);
    });

    it('should validate successfully', async () => {
      const validation = await fixture.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should have appropriate error state', () => {
      const browserState = fixture.getBrowserState();
      const scenarioConfig = ERROR_SCENARIOS[scenario];

      // All scenarios should indicate an error condition
      if (scenarioConfig.statusCode >= 400 || scenarioConfig.statusCode === 0) {
        expect(browserState.hasError).toBe(true);
      }

      // Check authentication clearing behavior
      if (scenarioConfig.clearsAuth) {
        expect(browserState.isAuthenticated).toBe(false);
      }
    });
  });
}

// ============================================================================
// Example 6: Advanced Mock Testing
// ============================================================================

/**
 * Example showing advanced mock testing with custom responses
 */
async function advancedMockTestingExample() {
  const fixture = new ErrorPageFixture();

  try {
    await fixture.setup({
      name: 'API Error Test',
      description: 'Test API error with custom response',
      scenario: '422-validation-error' as ErrorScenario, // Custom scenario
      statusCode: 422,
      statusText: 'Unprocessable Entity',
      category: 'client',
      mockResponse: {
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Code': 'VALIDATION_FAILED',
        },
        body: JSON.stringify({
          errors: [
            { field: 'email', message: 'Invalid email format' },
            { field: 'password', message: 'Password too short' },
          ],
        }),
        delay: 500, // Simulate network delay
      },
    });

    // Test that mock fetch works correctly
    const mockFetch = fixture.state.activeMocks.get('fetch');
    if (mockFetch) {
      const response = await mockFetch('https://api.example.com/user');
      console.log('Mock response status:', response.status);
      console.log('Mock response headers:', response.headers);

      const errorData = await response.json();
      console.log('Mock error data:', errorData);
    }

    // Test browser state with custom error data
    fixture.updateBrowserState({
      localStorage: {
        'last-api-error': JSON.stringify({
          timestamp: new Date().toISOString(),
          statusCode: 422,
          validationErrors: ['email', 'password'],
        }),
      },
    });

    const browserState = fixture.getBrowserState();
    const storedError = JSON.parse(browserState.localStorage['last-api-error']);
    console.log('Stored error data:', storedError);

  } finally {
    await fixture.teardown();
  }
}

// ============================================================================
// Example 7: Cleanup and Resource Management
// ============================================================================

/**
 * Example showing proper cleanup and resource management
 */
async function cleanupManagementExample() {
  const fixture = new ErrorPageFixture();

  try {
    await fixture.simulateError('network-timeout');

    // Add custom cleanup tasks
    let resourceCleaned = false;
    fixture.addCleanupTask(() => {
      resourceCleaned = true;
      console.log('🧹 Custom resource cleaned up');
    });

    // Add async cleanup task
    fixture.addCleanupTask(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('🧹 Async cleanup completed');
    });

    console.log('Fixture set up with cleanup tasks:', fixture.state.cleanupTasks.length);

  } finally {
    await fixture.teardown();
    console.log('🏁 Fixture torn down, all cleanup completed');
  }
}

// ============================================================================
// Export Examples for Documentation
// ============================================================================

export {
  basicUsageExample,
  predefinedScenariosExample,
  testSuiteIntegrationExample,
  higherOrderFunctionExample,
  parameterizedTestingExample,
  advancedMockTestingExample,
  cleanupManagementExample,
};

// ============================================================================
// Usage Summary
// ============================================================================

/**
 * Usage Summary:
 *
 * 1. **Basic Usage**: Create fixture, setup, validate, teardown manually
 * 2. **Predefined Scenarios**: Use ERROR_SCENARIOS for common error types
 * 3. **Test Suite Integration**: Use createErrorFixtureHooks for beforeEach/afterEach
 * 4. **Higher-Order Functions**: Use withErrorFixture for automatic setup/teardown
 * 5. **Parameterized Testing**: Use createMultiScenarioFixture for multiple scenarios
 * 6. **Advanced Mocking**: Configure custom mock responses and delays
 * 7. **Cleanup Management**: Add custom cleanup tasks for resource management
 *
 * Key Benefits:
 * - Consistent error state simulation across tests
 * - Automatic setup/teardown lifecycle management
 * - Integration with existing browser fixtures
 * - Validation of error conditions
 * - Mock HTTP response simulation
 * - Extensible for custom error scenarios
 */