/**
 * @fileoverview Performance Benchmarks and Stress Tests for Error Page Fixture
 *
 * This test suite measures performance characteristics and stress-tests the
 * error page fixture implementation to ensure it performs well under load
 * and handles edge cases gracefully.
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

describe('Error Page Fixture Performance Benchmarks', () => {
  describe('Setup and Teardown Performance', () => {
    it('should setup and teardown quickly for basic scenarios', async () => {
      const fixture = new ErrorPageFixture();

      const startTime = performance.now();

      await fixture.setup({
        name: 'Performance Test',
        description: 'Basic performance test',
        scenario: '404-not-found',
        statusCode: 404,
        statusText: 'Not Found',
        category: 'client',
      });

      const setupTime = performance.now() - startTime;

      const teardownStartTime = performance.now();
      await fixture.teardown();
      const teardownTime = performance.now() - teardownStartTime;

      // Setup should be very fast (< 100ms)
      expect(setupTime).toBeLessThan(100);

      // Teardown should also be fast (< 50ms)
      expect(teardownTime).toBeLessThan(50);
    });

    it('should handle many sequential setups efficiently', async () => {
      const fixture = new ErrorPageFixture();
      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        await fixture.setup({
          name: `Performance Test ${i}`,
          description: `Performance test iteration ${i}`,
          scenario: '500-internal-error',
          statusCode: 500,
          statusText: 'Internal Server Error',
          category: 'server',
        });

        await fixture.teardown();

        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);

      // Average should be reasonable
      expect(averageTime).toBeLessThan(50);

      // No individual operation should take too long
      expect(maxTime).toBeLessThan(200);
    });
  });

  describe('Validation Performance', () => {
    it('should validate quickly across all scenarios', async () => {
      const scenarios = Object.keys(ERROR_SCENARIOS) as ErrorScenario[];
      const validationTimes: number[] = [];

      for (const scenario of scenarios) {
        const fixture = new ErrorPageFixture();

        try {
          await fixture.simulateError(scenario);

          const startTime = performance.now();
          const validation = await fixture.validate();
          const endTime = performance.now();

          expect(validation.valid).toBe(true);
          validationTimes.push(endTime - startTime);

        } finally {
          await fixture.teardown();
        }
      }

      const averageValidationTime = validationTimes.reduce((sum, time) => sum + time, 0) / validationTimes.length;
      const maxValidationTime = Math.max(...validationTimes);

      // Validation should be very fast
      expect(averageValidationTime).toBeLessThan(10);
      expect(maxValidationTime).toBeLessThan(50);
    });

    it('should handle concurrent validations efficiently', async () => {
      const fixture = new ErrorPageFixture();

      try {
        await fixture.simulateError('network-timeout');

        const concurrentValidations = 50;
        const startTime = performance.now();

        const validationPromises = Array.from({ length: concurrentValidations }, () =>
          fixture.validate()
        );

        const results = await Promise.all(validationPromises);
        const endTime = performance.now();

        // All validations should succeed
        results.forEach(result => {
          expect(result.valid).toBe(true);
        });

        // Concurrent validations should be efficient
        const totalTime = endTime - startTime;
        const averageTimePerValidation = totalTime / concurrentValidations;

        expect(totalTime).toBeLessThan(500); // 500ms total
        expect(averageTimePerValidation).toBeLessThan(20); // 20ms per validation

      } finally {
        await fixture.teardown();
      }
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory with many fixtures', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const fixtures: ErrorPageFixture[] = [];

      // Create many fixtures
      for (let i = 0; i < 100; i++) {
        const fixture = new ErrorPageFixture();
        fixtures.push(fixture);

        await fixture.simulateError('404-not-found');
      }

      const peakMemory = process.memoryUsage().heapUsed;

      // Clean up all fixtures
      for (const fixture of fixtures) {
        await fixture.teardown();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;

      // Memory should not grow excessively
      const memoryGrowth = peakMemory - initialMemory;
      const memoryAfterCleanup = finalMemory - initialMemory;

      // Memory growth should be reasonable for 100 fixtures
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // 50MB

      // Memory should be mostly cleaned up (within 10MB of initial)
      expect(memoryAfterCleanup).toBeLessThan(10 * 1024 * 1024); // 10MB
    });

    it('should handle cleanup task overflow gracefully', async () => {
      const fixture = new ErrorPageFixture();

      try {
        await fixture.simulateError('500-internal-error');

        // Add many cleanup tasks
        const cleanupCount = 1000;
        const cleanupResults: number[] = [];

        for (let i = 0; i < cleanupCount; i++) {
          fixture.addCleanupTask(() => {
            cleanupResults.push(i);
          });
        }

        expect(fixture.state.cleanupTasks.length).toBeGreaterThanOrEqual(cleanupCount);

        const teardownStartTime = performance.now();
        await fixture.teardown();
        const teardownTime = performance.now() - teardownStartTime;

        // All cleanup tasks should have run
        expect(cleanupResults.length).toBe(cleanupCount);

        // Should execute in reverse order (LIFO)
        expect(cleanupResults[0]).toBe(cleanupCount - 1);
        expect(cleanupResults[cleanupCount - 1]).toBe(0);

        // Should complete in reasonable time
        expect(teardownTime).toBeLessThan(1000);

      } finally {
        // Ensure cleanup even if test fails
        if (fixture.isSetup()) {
          await fixture.teardown();
        }
      }
    });
  });

  describe('Concurrent Access Stress Tests', () => {
    it('should handle high concurrent fixture creation', async () => {
      const concurrentFixtures = 50;
      const startTime = performance.now();

      const fixturePromises = Array.from({ length: concurrentFixtures }, async (_, i) => {
        const fixture = new ErrorPageFixture();
        const scenario: ErrorScenario = i % 2 === 0 ? '404-not-found' : '500-internal-error';

        await fixture.simulateError(scenario);

        // Simulate some work
        const validation = await fixture.validate();
        expect(validation.valid).toBe(true);

        await fixture.teardown();

        return { index: i, scenario, success: true };
      });

      const results = await Promise.all(fixturePromises);
      const endTime = performance.now();

      // All fixtures should succeed
      expect(results).toHaveLength(concurrentFixtures);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
    });

    it('should handle hook-based concurrent access', async () => {
      const concurrentHooks = 25;
      const scenarios: ErrorScenario[] = ['404-not-found', '500-internal-error', 'network-timeout'];

      const hookPromises = Array.from({ length: concurrentHooks }, async (_, i) => {
        const scenario = scenarios[i % scenarios.length];
        const { setup, teardown } = createErrorFixtureHooks(scenario);

        const fixture = await setup();

        // Simulate test work
        expect(fixture.isSetup()).toBe(true);
        expect(fixture.state.config.scenario).toBe(scenario);

        const validation = await fixture.validate();
        expect(validation.valid).toBe(true);

        await teardown();

        return { index: i, scenario };
      });

      const results = await Promise.all(hookPromises);
      expect(results).toHaveLength(concurrentHooks);
    });
  });

  describe('Edge Case Handling', () => {
    it('should handle rapid setup/teardown cycles without errors', async () => {
      const fixture = new ErrorPageFixture();
      const cycles = 50;

      for (let i = 0; i < cycles; i++) {
        await fixture.setup({
          name: `Rapid Cycle ${i}`,
          description: `Rapid setup/teardown cycle ${i}`,
          scenario: 'javascript-error',
          statusCode: 200,
          statusText: 'OK',
          category: 'client',
        });

        expect(fixture.isSetup()).toBe(true);

        await fixture.teardown();
        expect(fixture.isSetup()).toBe(false);
      }
    });

    it('should handle error during cleanup gracefully', async () => {
      const fixture = new ErrorPageFixture();

      try {
        await fixture.simulateError('network-timeout');

        // Add cleanup tasks that will fail
        fixture.addCleanupTask(() => {
          throw new Error('Intentional cleanup error 1');
        });

        let secondCleanupExecuted = false;
        fixture.addCleanupTask(() => {
          secondCleanupExecuted = true;
        });

        fixture.addCleanupTask(() => {
          throw new Error('Intentional cleanup error 2');
        });

        let thirdCleanupExecuted = false;
        fixture.addCleanupTask(() => {
          thirdCleanupExecuted = true;
        });

        // Teardown should not throw despite errors
        await expect(fixture.teardown()).resolves.not.toThrow();

        // Cleanup tasks should still have been attempted
        expect(secondCleanupExecuted).toBe(true);
        expect(thirdCleanupExecuted).toBe(true);
        expect(fixture.isSetup()).toBe(false);

      } finally {
        if (fixture.isSetup()) {
          await fixture.teardown();
        }
      }
    });

    it('should handle invalid scenario data gracefully', async () => {
      const fixture = new ErrorPageFixture();

      // Test with invalid scenario cast
      await expect(
        fixture.simulateError('invalid-scenario' as ErrorScenario)
      ).rejects.toThrow('Unknown error scenario: invalid-scenario');

      expect(fixture.isSetup()).toBe(false);
    });

    it('should handle extreme mock response configurations', async () => {
      const fixture = new ErrorPageFixture();

      try {
        await fixture.setup({
          name: 'Extreme Mock Test',
          description: 'Test extreme mock configuration',
          scenario: '502-bad-gateway',
          statusCode: 502,
          statusText: 'Bad Gateway',
          category: 'server',
          mockResponse: {
            headers: {
              // Many headers
              ...Array.from({ length: 100 }, (_, i) => ({ [`X-Custom-Header-${i}`]: `value-${i}` }))
                .reduce((acc, curr) => ({ ...acc, ...curr }), {}),
            },
            body: 'x'.repeat(100000), // 100KB body
            delay: 5000, // 5 second delay
          },
        });

        const mockFetch = fixture.state.activeMocks.get('fetch');
        expect(mockFetch).toBeDefined();

        if (mockFetch) {
          const startTime = performance.now();
          const response = await mockFetch('https://example.com');
          const endTime = performance.now();

          expect(response.status).toBe(502);
          expect(endTime - startTime).toBeGreaterThanOrEqual(4900); // Allow some timing variance

          const body = await response.text();
          expect(body.length).toBe(100000);
        }

      } finally {
        await fixture.teardown();
      }
    });
  });

  describe('Browser State Performance', () => {
    it('should handle large browser states efficiently', async () => {
      const fixture = new ErrorPageFixture();

      try {
        await fixture.simulateError('500-internal-error');

        // Create large browser state
        const largeLocalStorage: Record<string, string> = {};
        for (let i = 0; i < 1000; i++) {
          largeLocalStorage[`key-${i}`] = `value-${'x'.repeat(100)}-${i}`;
        }

        const largeConsoleMessages = Array.from({ length: 500 }, (_, i) => ({
          type: 'error' as const,
          message: `Error message ${i}: ${'details'.repeat(20)}`,
          timestamp: new Date(),
        }));

        const startTime = performance.now();

        fixture.updateBrowserState({
          localStorage: largeLocalStorage,
          consoleMessages: largeConsoleMessages,
        });

        const updateTime = performance.now() - startTime;

        const getStateStartTime = performance.now();
        const browserState = fixture.getBrowserState();
        const getStateTime = performance.now() - getStateStartTime;

        // Operations should be reasonably fast
        expect(updateTime).toBeLessThan(100);
        expect(getStateTime).toBeLessThan(50);

        // State should be updated correctly
        expect(Object.keys(browserState.localStorage)).toHaveLength(1002); // 1000 + 2 from fixture
        expect(browserState.consoleMessages.length).toBeGreaterThanOrEqual(500);

      } finally {
        await fixture.teardown();
      }
    });

    it('should handle rapid state updates efficiently', async () => {
      const fixture = new ErrorPageFixture();

      try {
        await fixture.simulateError('404-not-found');

        const updateCount = 100;
        const startTime = performance.now();

        for (let i = 0; i < updateCount; i++) {
          fixture.updateBrowserState({
            url: `https://example.com/page-${i}`,
            title: `Page ${i}`,
            localStorage: {
              [`key-${i}`]: `value-${i}`,
            },
          });
        }

        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const averageUpdateTime = totalTime / updateCount;

        // Updates should be fast
        expect(averageUpdateTime).toBeLessThan(5); // 5ms per update
        expect(totalTime).toBeLessThan(500); // 500ms total

        // Final state should reflect last update
        const finalState = fixture.getBrowserState();
        expect(finalState.url).toBe('https://example.com/page-99');
        expect(finalState.title).toBe('Page 99');

      } finally {
        await fixture.teardown();
      }
    });
  });
});