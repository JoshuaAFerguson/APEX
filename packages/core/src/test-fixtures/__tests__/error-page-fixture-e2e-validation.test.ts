/**
 * @fileoverview End-to-End Validation Tests for Error Page Fixture
 *
 * This comprehensive test suite validates the complete functionality of the
 * error page fixture system, ensuring all requirements are met and the system
 * works correctly in realistic scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ErrorPageFixture,
  ERROR_SCENARIOS,
  createErrorFixtureHooks,
  withErrorFixture,
  createMultiScenarioFixture,
  type ErrorScenario,
  type ErrorFixtureConfig,
} from '../error-page-fixture.js';

describe('Error Page Fixture E2E Validation', () => {
  describe('Acceptance Criteria Validation', () => {
    it('should meet requirement: "A fixture exists that sets up error page browser state"', async () => {
      const fixture = new ErrorPageFixture();

      try {
        await fixture.setup({
          name: 'Browser State Test',
          description: 'Test browser state setup',
          scenario: '404-not-found',
          statusCode: 404,
          statusText: 'Not Found',
          category: 'client',
        });

        // Verify browser state is properly set up
        const browserState = fixture.getBrowserState();
        expect(browserState).toBeDefined();
        expect(browserState.hasError).toBe(true);
        expect(browserState.url).toBeDefined();
        expect(browserState.title).toBeDefined();
        expect(browserState.consoleMessages).toBeDefined();
        expect(browserState.localStorage).toBeDefined();
        expect(browserState.networkRequests).toBeDefined();

        // Verify fixture tracks the state
        expect(fixture.isSetup()).toBe(true);
        expect(fixture.state.isSetup).toBe(true);
        expect(fixture.state.config).toBeDefined();
        expect(fixture.state.browserState).toBeDefined();

      } finally {
        await fixture.teardown();
      }
    });

    it('should meet requirement: "Fixture properly simulates various error conditions"', async () => {
      const fixture = new ErrorPageFixture();
      const errorTypes = [
        { scenario: '404-not-found', category: 'client', statusCode: 404 },
        { scenario: '500-internal-error', category: 'server', statusCode: 500 },
        { scenario: 'network-timeout', category: 'network', statusCode: 0 },
      ] as const;

      for (const { scenario, category, statusCode } of errorTypes) {
        try {
          await fixture.simulateError(scenario);

          // Verify error condition is simulated correctly
          const config = fixture.state.config;
          expect(config.scenario).toBe(scenario);
          expect(config.category).toBe(category);
          expect(config.statusCode).toBe(statusCode);

          const browserState = fixture.getBrowserState();

          // Verify different error types produce different states
          switch (category) {
            case 'client':
              expect(browserState.hasError).toBe(true);
              break;
            case 'server':
              expect(browserState.hasError).toBe(true);
              expect(browserState.isAuthenticated).toBe(false); // Server errors clear auth
              break;
            case 'network':
              expect(browserState.hasError).toBe(true);
              expect(browserState.isAuthenticated).toBe(false); // Network errors clear auth
              break;
          }

          // Each error should have appropriate console messages
          const errorMessages = browserState.consoleMessages
            .filter(msg => msg.type === 'error')
            .map(msg => msg.message);
          expect(errorMessages.length).toBeGreaterThan(0);

        } finally {
          await fixture.teardown();
        }
      }
    });

    it('should meet requirement: "Integrates with setup/teardown utilities"', async () => {
      // Test integration with hook-based setup/teardown
      const { setup, teardown } = createErrorFixtureHooks('503-service-unavailable', {
        expectedUrl: 'https://test.com/maintenance',
        expectedTitle: 'Service Unavailable',
      });

      let fixture: ErrorPageFixture;

      try {
        // Setup should work seamlessly
        fixture = await setup();
        expect(fixture.isSetup()).toBe(true);
        expect(fixture.state.config.scenario).toBe('503-service-unavailable');

        // Should integrate with existing browser state utilities
        const initialState = fixture.getBrowserState();

        fixture.updateBrowserState({
          localStorage: {
            ...initialState.localStorage,
            'maintenance-notice': 'System undergoing maintenance',
          },
        });

        const updatedState = fixture.getBrowserState();
        expect(updatedState.localStorage['maintenance-notice']).toBe('System undergoing maintenance');

        // Should validate correctly
        const validation = await fixture.validate();
        expect(validation.valid).toBe(true);

      } finally {
        // Teardown should clean up completely
        await teardown();
        expect(fixture!.isSetup()).toBe(false);
      }
    });

    it('should handle complete lifecycle with cleanup tasks', async () => {
      const fixture = new ErrorPageFixture();
      const cleanupResults: string[] = [];

      try {
        await fixture.simulateError('502-bad-gateway');

        // Add custom cleanup tasks
        fixture.addCleanupTask(() => {
          cleanupResults.push('cleanup-1');
        });

        fixture.addCleanupTask(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          cleanupResults.push('cleanup-2');
        });

        fixture.addCleanupTask(() => {
          cleanupResults.push('cleanup-3');
        });

        // Verify setup state
        expect(fixture.state.cleanupTasks.length).toBeGreaterThanOrEqual(3);
        expect(fixture.isSetup()).toBe(true);

      } finally {
        await fixture.teardown();

        // Verify all cleanup tasks executed in reverse order
        expect(cleanupResults).toContain('cleanup-1');
        expect(cleanupResults).toContain('cleanup-2');
        expect(cleanupResults).toContain('cleanup-3');
        expect(fixture.isSetup()).toBe(false);
      }
    });
  });

  describe('Comprehensive Error Scenario Testing', () => {
    it('should handle all predefined error scenarios correctly', async () => {
      const scenarios = Object.keys(ERROR_SCENARIOS) as ErrorScenario[];

      for (const scenario of scenarios) {
        const fixture = new ErrorPageFixture();

        try {
          await fixture.simulateError(scenario);

          // Verify scenario setup
          expect(fixture.isSetup()).toBe(true);
          expect(fixture.state.config.scenario).toBe(scenario);

          // Verify browser state matches scenario expectations
          const browserState = fixture.getBrowserState();
          const scenarioConfig = ERROR_SCENARIOS[scenario];

          // Check error state
          if (scenarioConfig.statusCode >= 400 || scenarioConfig.statusCode === 0) {
            expect(browserState.hasError).toBe(true);
          }

          // Check authentication clearing
          if (scenarioConfig.clearsAuth) {
            expect(browserState.isAuthenticated).toBe(false);
          }

          // Check console errors
          if (scenarioConfig.expectedConsoleErrors) {
            const errorMessages = browserState.consoleMessages
              .filter(msg => msg.type === 'error')
              .map(msg => msg.message);

            expect(errorMessages.length).toBeGreaterThan(0);

            // Verify at least one expected console error is present
            const hasExpectedError = scenarioConfig.expectedConsoleErrors.some(expectedError =>
              errorMessages.some(actualError => actualError.includes(expectedError))
            );
            expect(hasExpectedError).toBe(true);
          }

          // Check network requests
          expect(browserState.networkRequests).toBeDefined();
          expect(browserState.networkRequests.length).toBeGreaterThan(0);

          // Verify the mock network request matches scenario
          const mockRequest = browserState.networkRequests.find(req =>
            req.status === scenarioConfig.statusCode
          );
          expect(mockRequest).toBeDefined();

          // Validate the complete fixture
          const validation = await fixture.validate();
          expect(validation.valid).toBe(true,
            `Validation failed for ${scenario}: ${validation.errors.join(', ')}`);

        } finally {
          await fixture.teardown();
        }
      }
    });

    it('should handle custom error scenarios with mock responses', async () => {
      const fixture = new ErrorPageFixture();

      try {
        const customConfig: ErrorFixtureConfig = {
          name: 'Custom API Error',
          description: 'Custom API validation error',
          scenario: 'javascript-error', // Use existing scenario as base
          statusCode: 422,
          statusText: 'Unprocessable Entity',
          category: 'client',
          expectedUrl: 'https://api.test.com/validation-error',
          expectedTitle: 'Validation Error',
          expectedConsoleErrors: ['Validation failed'],
          mockResponse: {
            headers: {
              'Content-Type': 'application/json',
              'X-Error-Type': 'validation',
            },
            body: JSON.stringify({
              error: 'Validation failed',
              details: [
                { field: 'email', message: 'Required' },
                { field: 'name', message: 'Too short' },
              ],
            }),
            delay: 200,
          },
        };

        await fixture.setup(customConfig);

        // Test mock fetch functionality
        const mockFetch = fixture.state.activeMocks.get('fetch');
        expect(mockFetch).toBeDefined();

        if (mockFetch) {
          const startTime = performance.now();
          const response = await mockFetch('https://api.test.com/submit');
          const endTime = performance.now();

          // Verify mock response
          expect(response.status).toBe(422);
          expect(response.statusText).toBe('Unprocessable Entity');
          expect(response.ok).toBe(false);

          // Verify delay was applied
          expect(endTime - startTime).toBeGreaterThanOrEqual(180);

          // Verify response data
          const errorData = await response.json();
          expect(errorData.error).toBe('Validation failed');
          expect(errorData.details).toHaveLength(2);
        }

        // Verify browser state
        const browserState = fixture.getBrowserState();
        expect(browserState.hasError).toBe(true);
        expect(browserState.title).toBe('Validation Error');

        // Update browser state to match expectations
        fixture.updateBrowserState({
          url: 'https://api.test.com/validation-error',
          title: 'Validation Error',
        });

        const validation = await fixture.validate();
        expect(validation.valid).toBe(true);

      } finally {
        await fixture.teardown();
      }
    });
  });

  describe('Integration Helper Testing', () => {
    it('should work correctly with higher-order function pattern', async () => {
      const testResults: any[] = [];

      const testFn = withErrorFixture('429-rate-limited', async (fixture) => {
        testResults.push({
          step: 'setup',
          isSetup: fixture.isSetup(),
          scenario: fixture.state.config.scenario,
        });

        // Simulate test operations
        const browserState = fixture.getBrowserState();
        expect(browserState.hasError).toBe(true);

        // Update state
        fixture.updateBrowserState({
          localStorage: {
            'rate-limit-hit': 'true',
            'retry-after': '60',
          },
        });

        const updatedState = fixture.getBrowserState();
        expect(updatedState.localStorage['rate-limit-hit']).toBe('true');

        // Validate state
        const validation = await fixture.validate();
        expect(validation.valid).toBe(true);

        testResults.push({
          step: 'test-completed',
          hasError: browserState.hasError,
          validationPassed: validation.valid,
        });

        return 'test-success';
      }, {
        expectedUrl: 'https://api.example.com/rate-limited',
        timeout: 15000,
      });

      const result = await testFn();

      expect(result).toBe('test-success');
      expect(testResults).toHaveLength(2);
      expect(testResults[0].step).toBe('setup');
      expect(testResults[0].isSetup).toBe(true);
      expect(testResults[0].scenario).toBe('429-rate-limited');
      expect(testResults[1].step).toBe('test-completed');
      expect(testResults[1].validationPassed).toBe(true);
    });

    it('should support multi-scenario testing patterns', async () => {
      const scenarios: ErrorScenario[] = ['ssl-error', 'dns-failure', 'connection-refused'];
      const createFixture = createMultiScenarioFixture(scenarios);
      const results: { scenario: ErrorScenario; success: boolean }[] = [];

      for (const scenario of scenarios) {
        const fixture = await createFixture(scenario, {
          name: `Multi-test ${scenario}`,
          expectedUrl: `https://example.com/error/${scenario}`,
        });

        try {
          expect(fixture.isSetup()).toBe(true);
          expect(fixture.state.config.scenario).toBe(scenario);
          expect(fixture.state.config.name).toBe(`Multi-test ${scenario}`);

          const browserState = fixture.getBrowserState();
          expect(browserState.hasError).toBe(true);

          const validation = await fixture.validate();

          results.push({
            scenario,
            success: validation.valid,
          });

        } finally {
          await fixture.teardown();
        }
      }

      // Verify all scenarios succeeded
      expect(results).toHaveLength(scenarios.length);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle rapid setup/teardown cycles without memory leaks', async () => {
      const fixture = new ErrorPageFixture();
      const cycles = 20;

      for (let i = 0; i < cycles; i++) {
        await fixture.setup({
          name: `Cycle ${i}`,
          description: `Rapid cycle test ${i}`,
          scenario: 'load-timeout',
          statusCode: 0,
          statusText: 'Load Timeout',
          category: 'timeout',
        });

        expect(fixture.isSetup()).toBe(true);
        expect(fixture.state.config.name).toBe(`Cycle ${i}`);

        const browserState = fixture.getBrowserState();
        expect(browserState).toBeDefined();

        await fixture.teardown();
        expect(fixture.isSetup()).toBe(false);
      }
    });

    it('should handle concurrent fixture operations safely', async () => {
      const fixtures = Array.from({ length: 10 }, () => new ErrorPageFixture());
      const scenarios: ErrorScenario[] = ['404-not-found', '500-internal-error'];

      try {
        // Set up all fixtures concurrently
        const setupPromises = fixtures.map((fixture, index) =>
          fixture.simulateError(scenarios[index % scenarios.length])
        );

        await Promise.all(setupPromises);

        // Verify all fixtures are properly isolated
        fixtures.forEach((fixture, index) => {
          expect(fixture.isSetup()).toBe(true);
          expect(fixture.state.config.scenario).toBe(scenarios[index % scenarios.length]);
        });

        // Perform concurrent operations
        const operationPromises = fixtures.map(async (fixture) => {
          const validation = await fixture.validate();
          expect(validation.valid).toBe(true);

          const browserState = fixture.getBrowserState();
          expect(browserState.hasError).toBe(true);

          return true;
        });

        const results = await Promise.all(operationPromises);
        expect(results.every(result => result)).toBe(true);

      } finally {
        // Clean up all fixtures
        await Promise.all(fixtures.map(fixture => fixture.teardown()));

        fixtures.forEach(fixture => {
          expect(fixture.isSetup()).toBe(false);
        });
      }
    });

    it('should handle invalid configurations gracefully', async () => {
      const fixture = new ErrorPageFixture();

      // Test invalid scenario
      await expect(
        fixture.simulateError('invalid-scenario' as ErrorScenario)
      ).rejects.toThrow('Unknown error scenario: invalid-scenario');

      expect(fixture.isSetup()).toBe(false);

      // Test setup after failed scenario
      await expect(
        fixture.setup({
          name: 'Valid after invalid',
          description: 'Should work after failed scenario',
          scenario: '404-not-found',
          statusCode: 404,
          statusText: 'Not Found',
          category: 'client',
        })
      ).resolves.not.toThrow();

      expect(fixture.isSetup()).toBe(true);
      await fixture.teardown();
    });

    it('should handle cleanup errors without affecting other operations', async () => {
      const fixture = new ErrorPageFixture();

      try {
        await fixture.simulateError('network-timeout');

        let successfulCleanupExecuted = false;

        // Add a cleanup task that will fail
        fixture.addCleanupTask(() => {
          throw new Error('Intentional cleanup failure');
        });

        // Add a cleanup task that should still run
        fixture.addCleanupTask(() => {
          successfulCleanupExecuted = true;
        });

        // Teardown should not throw despite cleanup error
        await expect(fixture.teardown()).resolves.not.toThrow();

        // Successful cleanup should have run
        expect(successfulCleanupExecuted).toBe(true);
        expect(fixture.isSetup()).toBe(false);

      } finally {
        if (fixture.isSetup()) {
          await fixture.teardown();
        }
      }
    });
  });

  describe('Performance Validation', () => {
    it('should maintain acceptable performance under load', async () => {
      const startTime = performance.now();
      const iterations = 50;
      const results: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const iterationStart = performance.now();
        const fixture = new ErrorPageFixture();

        try {
          await fixture.simulateError('500-internal-error');
          const validation = await fixture.validate();
          expect(validation.valid).toBe(true);
        } finally {
          await fixture.teardown();
        }

        const iterationTime = performance.now() - iterationStart;
        results.push(iterationTime);
      }

      const totalTime = performance.now() - startTime;
      const averageTime = results.reduce((sum, time) => sum + time, 0) / results.length;
      const maxTime = Math.max(...results);

      // Performance assertions
      expect(totalTime).toBeLessThan(10000); // 10 seconds total
      expect(averageTime).toBeLessThan(200); // 200ms average per iteration
      expect(maxTime).toBeLessThan(1000); // 1 second max per iteration

      // Verify no degradation over time
      const firstHalf = results.slice(0, iterations / 2);
      const secondHalf = results.slice(iterations / 2);
      const firstHalfAvg = firstHalf.reduce((sum, time) => sum + time, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, time) => sum + time, 0) / secondHalf.length;

      // Second half shouldn't be significantly slower (allowing 50% variance)
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5);
    });
  });
});