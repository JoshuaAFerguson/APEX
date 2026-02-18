/**
 * @fileoverview Tests for Error Page Fixture Examples and Documentation
 *
 * This test suite verifies that all the examples in the documentation
 * and example files work correctly. It ensures that the fixture can be
 * used in all the documented ways and that the examples are accurate.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ErrorPageFixture,
  createErrorFixtureHooks,
  withErrorFixture,
  createMultiScenarioFixture,
  ERROR_SCENARIOS,
  type ErrorScenario,
  type ErrorFixtureConfig,
} from '../error-page-fixture.js';

describe('Error Page Fixture Examples', () => {
  describe('Documentation Examples', () => {
    it('should work with basic usage example from docs', async () => {
      const fixture = new ErrorPageFixture();

      try {
        // Set up a 404 error scenario (from docs example)
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

        // Verify state matches documentation example
        const browserState = fixture.getBrowserState();
        expect(browserState.hasError).toBe(true);
        expect(browserState.title).toBe('Error 404 - Page Not Found');

        // Validation should pass
        const validation = await fixture.validate();
        expect(validation.valid).toBe(true);

      } finally {
        await fixture.teardown();
      }
    });

    it('should work with predefined scenarios example from docs', async () => {
      const fixture = new ErrorPageFixture();

      try {
        // Use predefined scenario
        await fixture.simulateError('500-internal-error');

        const browserState = fixture.getBrowserState();
        expect(browserState.hasError).toBe(true);
        expect(browserState.isAuthenticated).toBe(false); // Server errors clear auth

        // Switch to different error scenario
        await fixture.simulateError('network-timeout');

        const newState = fixture.getBrowserState();
        expect(newState.hasError).toBe(true);
        expect(newState.consoleMessages.length).toBeGreaterThan(0);

      } finally {
        await fixture.teardown();
      }
    });

    it('should work with test suite integration hooks from docs', async () => {
      const { setup, teardown } = createErrorFixtureHooks('404-not-found', {
        expectedUrl: 'https://myapp.com/error',
        expectedTitle: 'Oops! Page Not Found',
      });

      let fixture: ErrorPageFixture;

      try {
        fixture = await setup();

        const browserState = fixture.getBrowserState();
        expect(browserState.hasError).toBe(true);
        expect(browserState.title).toBe('Oops! Page Not Found');

        const validation = await fixture.validate();
        expect(validation.valid).toBe(true);

      } finally {
        await teardown();
      }
    });

    it('should work with higher-order function example from docs', async () => {
      const testFn = withErrorFixture('500-internal-error', async (fixture) => {
        const browserState = fixture.getBrowserState();

        expect(browserState.hasError).toBe(true);
        expect(browserState.isAuthenticated).toBe(false); // Server errors clear auth

        // Test console errors
        const errorMessages = browserState.consoleMessages
          .filter(msg => msg.type === 'error')
          .map(msg => msg.message);

        expect(errorMessages.some(msg => msg.includes('500'))).toBe(true);

        const validation = await fixture.validate();
        expect(validation.valid).toBe(true);

        return 'test-completed';
      });

      const result = await testFn();
      expect(result).toBe('test-completed');
    });

    it('should work with custom configuration in higher-order function', async () => {
      const testFn = withErrorFixture(
        '503-service-unavailable',
        async (fixture) => {
          // Update browser state
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
          expectedUrl: 'https://api.example.com/maintenance',
          mockResponse: {
            headers: { 'Retry-After': '300' },
            body: JSON.stringify({ message: 'Service temporarily unavailable' }),
          },
        }
      );

      await testFn();
    });

    it('should work with parameterized testing example', async () => {
      const scenarios: ErrorScenario[] = ['404-not-found', '500-internal-error', 'network-timeout'];
      const createFixture = createMultiScenarioFixture(scenarios);

      for (const scenario of scenarios) {
        const fixture = await createFixture(scenario);

        try {
          expect(fixture.isSetup()).toBe(true);
          expect(fixture.state.config.scenario).toBe(scenario);

          const validation = await fixture.validate();
          expect(validation.valid).toBe(true);
          expect(validation.errors).toEqual([]);

          const browserState = fixture.getBrowserState();
          const scenarioConfig = ERROR_SCENARIOS[scenario];

          if (scenarioConfig.statusCode >= 400 || scenarioConfig.statusCode === 0) {
            expect(browserState.hasError).toBe(true);
          }

          if (scenarioConfig.clearsAuth) {
            expect(browserState.isAuthenticated).toBe(false);
          }
        } finally {
          await fixture.teardown();
        }
      }
    });
  });

  describe('Advanced Usage Examples', () => {
    it('should handle custom error scenarios with mock responses', async () => {
      const fixture = new ErrorPageFixture();

      try {
        await fixture.setup({
          name: 'API Error Test',
          description: 'Test API error with custom response',
          scenario: 'javascript-error', // Use existing scenario as base
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
            delay: 100,
          },
        });

        // Test mock fetch
        const mockFetch = fixture.state.activeMocks.get('fetch');
        expect(mockFetch).toBeDefined();

        if (mockFetch) {
          const startTime = performance.now();
          const response = await mockFetch('https://api.example.com/user');
          const endTime = performance.now();

          expect(response.status).toBe(422);
          expect(response.statusText).toBe('Unprocessable Entity');
          expect(response.ok).toBe(false);

          // Verify delay was applied
          expect(endTime - startTime).toBeGreaterThanOrEqual(90);

          const errorData = await response.json();
          expect(errorData.errors).toHaveLength(2);
          expect(errorData.errors[0].field).toBe('email');
        }
      } finally {
        await fixture.teardown();
      }
    });

    it('should handle cleanup management example', async () => {
      const fixture = new ErrorPageFixture();
      const cleanupResults: string[] = [];

      try {
        await fixture.simulateError('network-timeout');

        // Add custom cleanup tasks
        fixture.addCleanupTask(() => {
          cleanupResults.push('sync-cleanup');
        });

        fixture.addCleanupTask(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          cleanupResults.push('async-cleanup');
        });

        expect(fixture.state.cleanupTasks.length).toBeGreaterThanOrEqual(2);
      } finally {
        await fixture.teardown();

        // Verify cleanup tasks were executed
        expect(cleanupResults).toContain('sync-cleanup');
        expect(cleanupResults).toContain('async-cleanup');
      }
    });

    it('should handle error data and local storage customization', async () => {
      const fixture = new ErrorPageFixture();

      try {
        const customErrorData = {
          timestamp: '2024-01-15T10:00:00Z',
          requestId: 'req-12345',
          userId: 'user-67890',
        };

        await fixture.setup({
          name: 'Error Data Test',
          description: 'Test custom error data storage',
          scenario: '403-forbidden',
          statusCode: 403,
          statusText: 'Forbidden',
          category: 'client',
          errorData: customErrorData,
        });

        const browserState = fixture.getBrowserState();

        // Verify error data is stored in localStorage
        expect(browserState.localStorage['error-fixture-data']).toBeDefined();

        const storedData = JSON.parse(browserState.localStorage['error-fixture-data']);
        expect(storedData).toEqual(customErrorData);

        // Verify scenario tracking
        expect(browserState.localStorage['last-error-scenario']).toBe('403-forbidden');

      } finally {
        await fixture.teardown();
      }
    });
  });

  describe('Error Scenario Configuration Validation', () => {
    it('should validate all predefined scenarios have required properties', () => {
      const requiredProperties = [
        'scenario',
        'statusCode',
        'statusText',
        'category',
        'timeout',
      ];

      Object.entries(ERROR_SCENARIOS).forEach(([scenario, config]) => {
        for (const prop of requiredProperties) {
          expect(config).toHaveProperty(prop);
          expect(config[prop as keyof typeof config]).toBeDefined();
        }

        // Validate status code ranges
        if (config.category === 'client') {
          expect(config.statusCode).toBeGreaterThanOrEqual(400);
          expect(config.statusCode).toBeLessThan(500);
        } else if (config.category === 'server') {
          expect(config.statusCode).toBeGreaterThanOrEqual(500);
          expect(config.statusCode).toBeLessThan(600);
        }

        // Validate timeout is reasonable
        expect(config.timeout).toBeGreaterThan(0);
        expect(config.timeout).toBeLessThanOrEqual(60000); // Max 60 seconds
      });
    });

    it('should validate error scenarios have appropriate console messages', () => {
      Object.entries(ERROR_SCENARIOS).forEach(([scenario, config]) => {
        if (config.expectedConsoleErrors) {
          expect(config.expectedConsoleErrors.length).toBeGreaterThan(0);

          config.expectedConsoleErrors.forEach(errorMsg => {
            expect(errorMsg).toBeDefined();
            expect(errorMsg.length).toBeGreaterThan(0);
            expect(typeof errorMsg).toBe('string');
          });
        }
      });
    });

    it('should validate error scenarios have appropriate content', () => {
      Object.entries(ERROR_SCENARIOS).forEach(([scenario, config]) => {
        if (config.expectedContent) {
          expect(config.expectedContent.length).toBeGreaterThan(0);

          config.expectedContent.forEach(content => {
            expect(content).toBeDefined();
            expect(content.length).toBeGreaterThan(0);
            expect(typeof content).toBe('string');
          });
        }

        if (config.expectedTitle) {
          expect(config.expectedTitle.length).toBeGreaterThan(0);
          expect(config.expectedTitle).toContain(config.statusCode.toString());
        }
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid scenario switching', async () => {
      const fixture = new ErrorPageFixture();
      const scenarios: ErrorScenario[] = ['404-not-found', '500-internal-error', 'network-timeout'];

      try {
        await fixture.simulateError(scenarios[0]);

        for (let i = 1; i < scenarios.length; i++) {
          const startTime = performance.now();
          await fixture.simulateError(scenarios[i]);
          const endTime = performance.now();

          // Switching should be fast
          expect(endTime - startTime).toBeLessThan(1000);

          expect(fixture.state.config.scenario).toBe(scenarios[i]);

          const validation = await fixture.validate();
          expect(validation.valid).toBe(true);
        }
      } finally {
        await fixture.teardown();
      }
    });

    it('should handle large custom error data', async () => {
      const fixture = new ErrorPageFixture();

      try {
        // Create large error data payload
        const largeErrorData = {
          stackTrace: 'a'.repeat(10000), // 10KB string
          requestData: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `data-${i}` })),
          metadata: {
            large_field: 'x'.repeat(5000),
            timestamp: Date.now(),
            nested: {
              deep: {
                very: {
                  deep: {
                    field: 'value'
                  }
                }
              }
            }
          }
        };

        await fixture.setup({
          name: 'Large Data Test',
          description: 'Test with large error data payload',
          scenario: '500-internal-error',
          statusCode: 500,
          statusText: 'Internal Server Error',
          category: 'server',
          errorData: largeErrorData,
        });

        const browserState = fixture.getBrowserState();
        const storedData = JSON.parse(browserState.localStorage['error-fixture-data']);

        expect(storedData.stackTrace.length).toBe(10000);
        expect(storedData.requestData.length).toBe(1000);
        expect(storedData.metadata.large_field.length).toBe(5000);

        // Should still validate successfully
        const validation = await fixture.validate();
        expect(validation.valid).toBe(true);

      } finally {
        await fixture.teardown();
      }
    });

    it('should handle error scenarios with extreme timeouts', async () => {
      const fixture = new ErrorPageFixture();

      try {
        await fixture.setup({
          name: 'Extreme Timeout Test',
          description: 'Test with very long timeout',
          scenario: 'load-timeout',
          statusCode: 0,
          statusText: 'Load Timeout',
          category: 'timeout',
          timeout: 30000, // 30 seconds
        });

        expect(fixture.state.config.timeout).toBe(30000);

        const validation = await fixture.validate();
        expect(validation.valid).toBe(true);

      } finally {
        await fixture.teardown();
      }
    });
  });

  describe('Integration with Browser Helpers', () => {
    it('should work correctly with browser helpers from core fixtures', async () => {
      // Import the browser helpers (assuming they exist based on the integration test)
      // This test ensures the error page fixture works with the broader test ecosystem

      const fixture = new ErrorPageFixture();

      try {
        await fixture.simulateError('404-not-found');

        const initialState = fixture.getBrowserState();

        // Simulate using browser helpers to modify state
        // (This would normally import from browserHelpers, but we'll simulate the behavior)
        const updatedState = {
          ...initialState,
          consoleMessages: [
            ...initialState.consoleMessages,
            {
              type: 'warn' as const,
              message: 'Recovery attempt initiated',
              timestamp: new Date(),
            },
          ],
        };

        fixture.updateBrowserState(updatedState);

        const finalState = fixture.getBrowserState();
        expect(finalState.consoleMessages).toHaveLength(initialState.consoleMessages.length + 1);
        expect(finalState.consoleMessages[finalState.consoleMessages.length - 1].message).toBe('Recovery attempt initiated');

      } finally {
        await fixture.teardown();
      }
    });
  });
});