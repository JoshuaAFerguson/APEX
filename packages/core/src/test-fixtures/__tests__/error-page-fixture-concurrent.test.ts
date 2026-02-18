/**
 * @fileoverview Concurrent Usage Tests for Error Page Fixture
 *
 * Tests concurrent usage scenarios and race condition handling for
 * the ErrorPageFixture implementation to ensure thread safety and
 * proper resource management under concurrent access.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ErrorPageFixture,
  createErrorFixtureHooks,
  withErrorFixture,
  type ErrorScenario,
} from '../error-page-fixture.js';

describe('Error Page Fixture Concurrent Usage', () => {
  describe('Concurrent Fixture Operations', () => {
    it('should handle multiple fixtures running simultaneously', async () => {
      const fixtures: ErrorPageFixture[] = [];
      const scenarios: ErrorScenario[] = ['404-not-found', '500-internal-error', 'network-timeout'];

      try {
        // Create multiple fixtures concurrently
        const setupPromises = scenarios.map(async (scenario) => {
          const fixture = new ErrorPageFixture();
          fixtures.push(fixture);
          await fixture.simulateError(scenario);
          return { fixture, scenario };
        });

        const results = await Promise.all(setupPromises);

        // Verify each fixture is properly isolated
        for (const { fixture, scenario } of results) {
          expect(fixture.isSetup()).toBe(true);
          expect(fixture.state.config.scenario).toBe(scenario);

          const validation = await fixture.validate();
          expect(validation.valid).toBe(true);
        }

        // Verify fixtures don't interfere with each other
        expect(results[0].fixture.state.config.scenario).toBe('404-not-found');
        expect(results[1].fixture.state.config.scenario).toBe('500-internal-error');
        expect(results[2].fixture.state.config.scenario).toBe('network-timeout');

      } finally {
        // Clean up all fixtures concurrently
        await Promise.all(fixtures.map(fixture => fixture.teardown()));
      }
    });

    it('should handle rapid setup/teardown cycles', async () => {
      const fixture = new ErrorPageFixture();
      const cycles = 10;

      for (let i = 0; i < cycles; i++) {
        await fixture.simulateError('404-not-found');
        expect(fixture.isSetup()).toBe(true);

        await fixture.teardown();
        expect(fixture.isSetup()).toBe(false);
      }
    });

    it('should handle concurrent validation calls', async () => {
      const fixture = new ErrorPageFixture();

      try {
        await fixture.simulateError('500-internal-error');

        // Run multiple validations concurrently
        const validationPromises = Array.from({ length: 5 }, () => fixture.validate());
        const results = await Promise.all(validationPromises);

        // All validations should succeed
        for (const result of results) {
          expect(result.valid).toBe(true);
          expect(result.errors).toEqual([]);
        }

      } finally {
        await fixture.teardown();
      }
    });

    it('should handle concurrent browser state updates', async () => {
      const fixture = new ErrorPageFixture();

      try {
        await fixture.simulateError('network-timeout');

        // Perform concurrent state updates
        const updatePromises = [
          () => fixture.updateBrowserState({ url: 'https://example1.com' }),
          () => fixture.updateBrowserState({ title: 'Updated Title 1' }),
          () => fixture.updateBrowserState({ url: 'https://example2.com' }),
          () => fixture.updateBrowserState({ title: 'Updated Title 2' }),
          () => fixture.updateBrowserState({
            localStorage: { 'test-key': 'test-value' }
          }),
        ];

        // Execute updates concurrently (not truly async, but rapid succession)
        updatePromises.forEach(update => update());

        const finalState = fixture.getBrowserState();

        // Last update should win for each property
        expect(finalState.url).toBe('https://example2.com');
        expect(finalState.title).toBe('Updated Title 2');
        expect(finalState.localStorage['test-key']).toBe('test-value');

      } finally {
        await fixture.teardown();
      }
    });
  });

  describe('Hook-based Concurrent Usage', () => {
    it('should handle multiple hook instances concurrently', async () => {
      const scenarios: ErrorScenario[] = ['403-forbidden', '502-bad-gateway', 'dns-failure'];
      const hookSets = scenarios.map(scenario => createErrorFixtureHooks(scenario));

      try {
        // Set up all hooks concurrently
        const setupPromises = hookSets.map(({ setup }) => setup());
        const fixtures = await Promise.all(setupPromises);

        // Verify all fixtures are properly set up
        fixtures.forEach((fixture, index) => {
          expect(fixture.isSetup()).toBe(true);
          expect(fixture.state.config.scenario).toBe(scenarios[index]);
        });

        // Perform validation on all fixtures
        const validationPromises = fixtures.map(fixture => fixture.validate());
        const validationResults = await Promise.all(validationPromises);

        validationResults.forEach(result => {
          expect(result.valid).toBe(true);
        });

      } finally {
        // Tear down all hooks concurrently
        const teardownPromises = hookSets.map(({ teardown }) => teardown());
        await Promise.all(teardownPromises);
      }
    });

    it('should handle nested hook usage', async () => {
      const outerHooks = createErrorFixtureHooks('404-not-found');
      const innerHooks = createErrorFixtureHooks('500-internal-error');

      try {
        const outerFixture = await outerHooks.setup();
        expect(outerFixture.state.config.scenario).toBe('404-not-found');

        const innerFixture = await innerHooks.setup();
        expect(innerFixture.state.config.scenario).toBe('500-internal-error');

        // Both fixtures should be independent
        expect(outerFixture.state.config.scenario).toBe('404-not-found');
        expect(innerFixture.state.config.scenario).toBe('500-internal-error');

        await innerHooks.teardown();

        // Outer fixture should still be functional
        expect(outerFixture.isSetup()).toBe(true);
        const validation = await outerFixture.validate();
        expect(validation.valid).toBe(true);

      } finally {
        await outerHooks.teardown();
      }
    });
  });

  describe('Higher-Order Function Concurrent Usage', () => {
    it('should handle concurrent withErrorFixture calls', async () => {
      const scenarios: ErrorScenario[] = ['ssl-error', 'javascript-error', 'load-timeout'];
      const results: string[] = [];

      const testPromises = scenarios.map((scenario, index) =>
        withErrorFixture(scenario, async (fixture) => {
          expect(fixture.isSetup()).toBe(true);
          expect(fixture.state.config.scenario).toBe(scenario);

          const validation = await fixture.validate();
          expect(validation.valid).toBe(true);

          results.push(`test-${index}-${scenario}`);
          return `result-${index}`;
        })()
      );

      const testResults = await Promise.all(testPromises);

      expect(testResults).toEqual(['result-0', 'result-1', 'result-2']);
      expect(results).toEqual([
        'test-0-ssl-error',
        'test-1-javascript-error',
        'test-2-load-timeout'
      ]);
    });
  });

  describe('Resource Management Under Concurrent Access', () => {
    it('should properly manage cleanup tasks with concurrent additions', async () => {
      const fixture = new ErrorPageFixture();
      const cleanupResults: string[] = [];

      try {
        await fixture.simulateError('429-rate-limited');

        // Add cleanup tasks concurrently
        const addCleanupPromises = Array.from({ length: 10 }, (_, i) =>
          Promise.resolve().then(() => {
            fixture.addCleanupTask(() => {
              cleanupResults.push(`cleanup-${i}`);
            });
          })
        );

        await Promise.all(addCleanupPromises);
        expect(fixture.state.cleanupTasks.length).toBeGreaterThanOrEqual(10);

      } finally {
        await fixture.teardown();
        expect(cleanupResults.length).toBe(10);
      }
    });

    it('should handle concurrent mock management', async () => {
      const fixtures = [
        new ErrorPageFixture(),
        new ErrorPageFixture(),
        new ErrorPageFixture(),
      ];

      try {
        // Set up fixtures with different mock configurations concurrently
        const setupPromises = fixtures.map((fixture, index) =>
          fixture.setup({
            name: `Test ${index}`,
            description: `Concurrent test ${index}`,
            scenario: '503-service-unavailable',
            statusCode: 503,
            statusText: 'Service Unavailable',
            category: 'server',
            mockResponse: {
              headers: { 'X-Test-Id': `test-${index}` },
              body: `Mock response ${index}`,
              delay: index * 100,
            },
          })
        );

        await Promise.all(setupPromises);

        // Verify each fixture has its own mock configuration
        fixtures.forEach((fixture, index) => {
          expect(fixture.isSetup()).toBe(true);
          expect(fixture.state.activeMocks.has('fetch')).toBe(true);
          expect(fixture.state.config.name).toBe(`Test ${index}`);
        });

      } finally {
        await Promise.all(fixtures.map(fixture => fixture.teardown()));
      }
    });
  });

  describe('Error Handling in Concurrent Scenarios', () => {
    it('should handle errors during concurrent setup', async () => {
      const fixtures = [
        new ErrorPageFixture(),
        new ErrorPageFixture(),
        new ErrorPageFixture(),
      ];

      try {
        // One fixture will fail during setup
        const setupPromises = fixtures.map((fixture, index) => {
          if (index === 1) {
            // Simulate setup failure by trying to setup twice
            return fixture.simulateError('404-not-found')
              .then(() => fixture.simulateError('500-internal-error'))
              .catch(error => ({ error, index }));
          } else {
            return fixture.simulateError('network-timeout')
              .then(() => ({ success: true, index }));
          }
        });

        const results = await Promise.allSettled(setupPromises);

        // Verify successful setups still work
        expect(results[0].status).toBe('fulfilled');
        expect(results[2].status).toBe('fulfilled');

        // Check that working fixtures are still functional
        const workingFixtures = [fixtures[0], fixtures[2]];
        for (const fixture of workingFixtures) {
          if (fixture.isSetup()) {
            const validation = await fixture.validate();
            expect(validation.valid).toBe(true);
          }
        }

      } finally {
        await Promise.allSettled(fixtures.map(fixture => fixture.teardown()));
      }
    });

    it('should handle cleanup errors gracefully in concurrent teardown', async () => {
      const fixtures = Array.from({ length: 5 }, () => new ErrorPageFixture());

      try {
        // Set up all fixtures
        await Promise.all(fixtures.map(fixture => fixture.simulateError('connection-refused')));

        // Add cleanup tasks that will fail for some fixtures
        fixtures.forEach((fixture, index) => {
          if (index % 2 === 0) {
            fixture.addCleanupTask(() => {
              throw new Error(`Cleanup error ${index}`);
            });
          }
          fixture.addCleanupTask(() => {
            // This should still run despite previous errors
          });
        });

      } finally {
        // All teardowns should complete without throwing
        const teardownPromises = fixtures.map(fixture => fixture.teardown());
        await expect(Promise.all(teardownPromises)).resolves.not.toThrow();

        // Verify all fixtures are properly torn down
        fixtures.forEach(fixture => {
          expect(fixture.isSetup()).toBe(false);
        });
      }
    });
  });

  describe('Performance Under Concurrent Load', () => {
    it('should maintain performance with many concurrent fixtures', async () => {
      const fixtureCount = 50;
      const fixtures: ErrorPageFixture[] = [];
      const startTime = performance.now();

      try {
        // Create and set up many fixtures concurrently
        const setupPromises = Array.from({ length: fixtureCount }, (_, i) => {
          const fixture = new ErrorPageFixture();
          fixtures.push(fixture);
          const scenario: ErrorScenario =
            i % 3 === 0 ? '404-not-found' :
            i % 3 === 1 ? '500-internal-error' : 'network-timeout';
          return fixture.simulateError(scenario);
        });

        await Promise.all(setupPromises);
        const setupTime = performance.now() - startTime;

        // Verify all fixtures are set up
        expect(fixtures.length).toBe(fixtureCount);
        fixtures.forEach(fixture => {
          expect(fixture.isSetup()).toBe(true);
        });

        // Performance should be reasonable (less than 5 seconds for 50 fixtures)
        expect(setupTime).toBeLessThan(5000);

      } finally {
        const teardownStart = performance.now();
        await Promise.all(fixtures.map(fixture => fixture.teardown()));
        const teardownTime = performance.now() - teardownStart;

        // Teardown should also be reasonably fast
        expect(teardownTime).toBeLessThan(2000);
      }
    });
  });
});