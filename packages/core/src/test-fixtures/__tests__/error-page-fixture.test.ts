/**
 * @fileoverview Tests for Error Page Fixture
 *
 * Comprehensive test suite for the ErrorPageFixture implementation.
 * Tests all error scenarios, lifecycle management, validation, and integration helpers.
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
  type IErrorPageFixture,
} from '../error-page-fixture.js';

describe('ErrorPageFixture', () => {
  let fixture: IErrorPageFixture;

  beforeEach(() => {
    fixture = new ErrorPageFixture();
  });

  afterEach(async () => {
    if (fixture.isSetup()) {
      await fixture.teardown();
    }
  });

  describe('Basic Lifecycle', () => {
    it('should start in a clean, uninitialized state', () => {
      expect(fixture.isSetup()).toBe(false);
      expect(fixture.state.isSetup).toBe(false);
      expect(fixture.state.activeRoutes).toEqual([]);
      expect(fixture.state.activeMocks.size).toBe(0);
      expect(fixture.state.cleanupTasks).toEqual([]);
    });

    it('should setup with a basic configuration', async () => {
      const config: ErrorFixtureConfig = {
        name: 'Test 404',
        description: 'Test 404 error page',
        scenario: '404-not-found',
        statusCode: 404,
        statusText: 'Not Found',
        category: 'client',
      };

      await fixture.setup(config);

      expect(fixture.isSetup()).toBe(true);
      expect(fixture.state.config).toEqual(config);
      expect(fixture.state.browserState.hasError).toBe(true);
      expect(fixture.state.cleanupTasks.length).toBeGreaterThan(0);
    });

    it('should prevent double setup without teardown', async () => {
      const config: ErrorFixtureConfig = {
        name: 'Test',
        description: 'Test',
        scenario: '404-not-found',
        statusCode: 404,
        statusText: 'Not Found',
        category: 'client',
      };

      await fixture.setup(config);

      await expect(fixture.setup(config)).rejects.toThrow(
        'Error page fixture is already set up. Call teardown() first.'
      );
    });

    it('should teardown and reset state', async () => {
      const config: ErrorFixtureConfig = {
        name: 'Test',
        description: 'Test',
        scenario: '500-internal-error',
        statusCode: 500,
        statusText: 'Internal Server Error',
        category: 'server',
      };

      await fixture.setup(config);
      expect(fixture.isSetup()).toBe(true);

      await fixture.teardown();
      expect(fixture.isSetup()).toBe(false);
      expect(fixture.state.activeRoutes).toEqual([]);
      expect(fixture.state.activeMocks.size).toBe(0);
      expect(fixture.state.cleanupTasks).toEqual([]);
    });

    it('should handle multiple teardown calls gracefully', async () => {
      const config: ErrorFixtureConfig = {
        name: 'Test',
        description: 'Test',
        scenario: '404-not-found',
        statusCode: 404,
        statusText: 'Not Found',
        category: 'client',
      };

      await fixture.setup(config);
      await fixture.teardown();
      await fixture.teardown(); // Should not throw

      expect(fixture.isSetup()).toBe(false);
    });
  });

  describe('Error Scenarios', () => {
    describe.each(Object.keys(ERROR_SCENARIOS) as ErrorScenario[])(
      'Scenario: %s',
      (scenario) => {
        it('should set up correctly', async () => {
          await fixture.simulateError(scenario);

          expect(fixture.isSetup()).toBe(true);
          expect(fixture.state.config.scenario).toBe(scenario);

          const scenarioConfig = ERROR_SCENARIOS[scenario];
          expect(fixture.state.config.statusCode).toBe(scenarioConfig.statusCode);
          expect(fixture.state.config.category).toBe(scenarioConfig.category);
        });

        it('should create appropriate browser state', async () => {
          await fixture.simulateError(scenario);

          const browserState = fixture.getBrowserState();
          const scenarioConfig = ERROR_SCENARIOS[scenario];

          // Check error state for HTTP errors
          if (scenarioConfig.statusCode >= 400 || scenarioConfig.statusCode === 0) {
            expect(browserState.hasError).toBe(true);
          }

          // Check authentication clearing
          if (scenarioConfig.clearsAuth) {
            expect(browserState.isAuthenticated).toBe(false);
          }

          // Check console errors if specified
          if (scenarioConfig.expectedConsoleErrors) {
            const errorMessages = browserState.consoleMessages
              .filter(msg => msg.type === 'error')
              .map(msg => msg.message);

            expect(errorMessages.length).toBeGreaterThan(0);
          }
        });

        it('should validate correctly', async () => {
          await fixture.simulateError(scenario);

          const validation = await fixture.validate();
          expect(validation.valid).toBe(true);
          expect(validation.errors).toEqual([]);
        });
      }
    );
  });

  describe('Browser State Management', () => {
    beforeEach(async () => {
      await fixture.simulateError('404-not-found');
    });

    it('should get browser state snapshot', () => {
      const state1 = fixture.getBrowserState();
      const state2 = fixture.getBrowserState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different objects
    });

    it('should update browser state', () => {
      const originalUrl = fixture.getBrowserState().url;

      fixture.updateBrowserState({
        url: 'https://example.com/updated',
        title: 'Updated Title',
      });

      const updatedState = fixture.getBrowserState();
      expect(updatedState.url).toBe('https://example.com/updated');
      expect(updatedState.title).toBe('Updated Title');
      expect(updatedState.url).not.toBe(originalUrl);
    });

    it('should preserve other state when updating', () => {
      const originalState = fixture.getBrowserState();

      fixture.updateBrowserState({
        url: 'https://example.com/new-url',
      });

      const updatedState = fixture.getBrowserState();
      expect(updatedState.url).toBe('https://example.com/new-url');
      expect(updatedState.hasError).toBe(originalState.hasError);
      expect(updatedState.isAuthenticated).toBe(originalState.isAuthenticated);
      expect(updatedState.consoleMessages).toEqual(originalState.consoleMessages);
    });
  });

  describe('Cleanup Management', () => {
    beforeEach(async () => {
      await fixture.simulateError('500-internal-error');
    });

    it('should add and execute cleanup tasks', async () => {
      let cleanupCalled = false;

      fixture.addCleanupTask(() => {
        cleanupCalled = true;
      });

      expect(cleanupCalled).toBe(false);

      await fixture.teardown();

      expect(cleanupCalled).toBe(true);
    });

    it('should execute cleanup tasks in reverse order', async () => {
      const callOrder: string[] = [];

      fixture.addCleanupTask(() => {
        callOrder.push('first');
      });

      fixture.addCleanupTask(() => {
        callOrder.push('second');
      });

      fixture.addCleanupTask(() => {
        callOrder.push('third');
      });

      await fixture.teardown();

      expect(callOrder).toEqual(['third', 'second', 'first']);
    });

    it('should handle async cleanup tasks', async () => {
      let asyncCleanupCompleted = false;

      fixture.addCleanupTask(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        asyncCleanupCompleted = true;
      });

      await fixture.teardown();

      expect(asyncCleanupCompleted).toBe(true);
    });

    it('should continue cleanup even if one task fails', async () => {
      let secondCleanupCalled = false;

      fixture.addCleanupTask(() => {
        throw new Error('Cleanup error');
      });

      fixture.addCleanupTask(() => {
        secondCleanupCalled = true;
      });

      // Should not throw despite the error
      await expect(fixture.teardown()).resolves.toBeUndefined();
      expect(secondCleanupCalled).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should validate successful setup', async () => {
      const config: ErrorFixtureConfig = {
        name: 'Valid Test',
        description: 'Valid test configuration',
        scenario: '404-not-found',
        statusCode: 404,
        statusText: 'Not Found',
        category: 'client',
        expectedUrl: 'https://example.com/error',
        expectedTitle: 'Error 404',
        expectedConsoleErrors: ['404: Resource not found'],
        clearsAuth: false,
      };

      await fixture.setup(config);

      // Manually set the browser state to match expected values
      fixture.updateBrowserState({
        url: 'https://example.com/error',
        title: 'Error 404',
        hasError: true,
        isAuthenticated: false,
      });

      const validation = await fixture.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should detect validation errors', async () => {
      const config: ErrorFixtureConfig = {
        name: 'Invalid Test',
        description: 'Test that will fail validation',
        scenario: '500-internal-error',
        statusCode: 500,
        statusText: 'Internal Server Error',
        category: 'server',
        expectedUrl: 'https://example.com/expected',
        expectedTitle: 'Expected Title',
        expectedConsoleErrors: ['Expected error message'],
        clearsAuth: true,
      };

      await fixture.setup(config);

      // Leave browser state with wrong values to trigger validation errors
      fixture.updateBrowserState({
        url: 'https://example.com/wrong',
        title: 'Wrong Title',
        isAuthenticated: true, // Should be false due to clearsAuth
      });

      const validation = await fixture.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(err => err.includes('Expected URL'))).toBe(true);
      expect(validation.errors.some(err => err.includes('Expected title'))).toBe(true);
      expect(validation.errors.some(err => err.includes('authentication to be cleared'))).toBe(true);
    });
  });

  describe('Mock Management', () => {
    it('should create mock fetch for HTTP errors', async () => {
      const config: ErrorFixtureConfig = {
        name: 'Mock Test',
        description: 'Test mock fetch',
        scenario: '500-internal-error',
        statusCode: 500,
        statusText: 'Internal Server Error',
        category: 'server',
        mockResponse: {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Server error' }),
          delay: 100,
        },
      };

      await fixture.setup(config);

      expect(fixture.state.activeMocks.has('fetch')).toBe(true);

      const mockFetch = fixture.state.activeMocks.get('fetch');
      expect(mockFetch).toBeDefined();

      // Test the mock function
      const response = await mockFetch!('https://example.com/api');
      expect(response.status).toBe(500);
      expect(response.ok).toBe(false);
      expect(response.statusText).toBe('Internal Server Error');
    });

    it('should simulate network errors in mock fetch', async () => {
      const config: ErrorFixtureConfig = {
        name: 'Network Error Test',
        description: 'Test network error simulation',
        scenario: 'connection-refused',
        statusCode: 0,
        statusText: 'Connection Refused',
        category: 'network',
      };

      await fixture.setup(config);

      const mockFetch = fixture.state.activeMocks.get('fetch');
      if (mockFetch) {
        await expect(mockFetch('https://example.com/api')).rejects.toThrow('Connection Refused');
      }
    });
  });
});

describe('Integration Helpers', () => {
  describe('createErrorFixtureHooks', () => {
    it('should create setup and teardown hooks', () => {
      const { setup, teardown, fixture } = createErrorFixtureHooks('404-not-found');

      expect(typeof setup).toBe('function');
      expect(typeof teardown).toBe('function');
      expect(fixture).toBe(null);
    });

    it('should set up fixture with scenario', async () => {
      const { setup, teardown } = createErrorFixtureHooks('500-internal-error');

      const fixture = await setup();

      expect(fixture.isSetup()).toBe(true);
      expect(fixture.state.config.scenario).toBe('500-internal-error');
      expect(fixture.state.config.statusCode).toBe(500);

      await teardown();
      expect(fixture.isSetup()).toBe(false);
    });

    it('should handle custom options', async () => {
      const customOptions = {
        name: 'Custom Test',
        description: 'Custom description',
        expectedUrl: 'https://custom.example.com/error',
      };

      const { setup, teardown } = createErrorFixtureHooks('404-not-found', customOptions);

      const fixture = await setup();

      expect(fixture.state.config.name).toBe('Custom Test');
      expect(fixture.state.config.description).toBe('Custom description');
      expect(fixture.state.config.expectedUrl).toBe('https://custom.example.com/error');

      await teardown();
    });

    it('should teardown existing fixture before setup', async () => {
      const { setup, teardown } = createErrorFixtureHooks('404-not-found');

      const fixture1 = await setup();
      const fixtureId1 = fixture1.state.createdAt;

      const fixture2 = await setup();
      const fixtureId2 = fixture2.state.createdAt;

      // Should be a new fixture instance
      expect(fixtureId2).not.toEqual(fixtureId1);

      await teardown();
    });
  });

  describe('withErrorFixture', () => {
    it('should wrap test function with fixture setup/teardown', async () => {
      let testFixture: ErrorPageFixture | null = null;

      const testFn = withErrorFixture('404-not-found', (fixture) => {
        testFixture = fixture;
        expect(fixture.isSetup()).toBe(true);
        expect(fixture.state.config.scenario).toBe('404-not-found');
        return 'test result';
      });

      const result = await testFn();

      expect(result).toBe('test result');
      expect(testFixture).not.toBe(null);
      expect(testFixture!.isSetup()).toBe(false); // Should be torn down
    });

    it('should handle async test functions', async () => {
      let asyncTestCompleted = false;

      const testFn = withErrorFixture('500-internal-error', async (fixture) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        asyncTestCompleted = true;
        expect(fixture.isSetup()).toBe(true);
      });

      await testFn();

      expect(asyncTestCompleted).toBe(true);
    });

    it('should teardown even if test function throws', async () => {
      let fixtureState: ErrorPageFixture | null = null;

      const testFn = withErrorFixture('404-not-found', (fixture) => {
        fixtureState = fixture;
        throw new Error('Test error');
      });

      await expect(testFn()).rejects.toThrow('Test error');
      expect(fixtureState).not.toBe(null);
      expect(fixtureState!.isSetup()).toBe(false); // Should still be torn down
    });

    it('should pass custom options to fixture', async () => {
      const customOptions = {
        expectedUrl: 'https://custom.test/error',
        timeout: 5000,
      };

      const testFn = withErrorFixture('503-service-unavailable', (fixture) => {
        expect(fixture.state.config.expectedUrl).toBe('https://custom.test/error');
        expect(fixture.state.config.timeout).toBe(5000);
      }, customOptions);

      await testFn();
    });
  });

  describe('createMultiScenarioFixture', () => {
    const scenarios: ErrorScenario[] = ['404-not-found', '500-internal-error', 'network-timeout'];
    let createFixture: ReturnType<typeof createMultiScenarioFixture>;

    beforeEach(() => {
      createFixture = createMultiScenarioFixture(scenarios);
    });

    it('should create fixture for supported scenario', async () => {
      const fixture = await createFixture('404-not-found');

      expect(fixture.isSetup()).toBe(true);
      expect(fixture.state.config.scenario).toBe('404-not-found');

      await fixture.teardown();
    });

    it('should reject unsupported scenario', async () => {
      await expect(createFixture('ssl-error' as ErrorScenario)).rejects.toThrow(
        'Scenario ssl-error is not supported by this fixture'
      );
    });

    it('should apply custom options', async () => {
      const customOptions = {
        name: 'Custom Multi-Scenario Test',
        expectedUrl: 'https://multi.test/error',
      };

      const fixture = await createFixture('500-internal-error', customOptions);

      expect(fixture.state.config.name).toBe('Custom Multi-Scenario Test');
      expect(fixture.state.config.expectedUrl).toBe('https://multi.test/error');

      await fixture.teardown();
    });

    it('should work with all supported scenarios', async () => {
      for (const scenario of scenarios) {
        const fixture = await createFixture(scenario);

        expect(fixture.isSetup()).toBe(true);
        expect(fixture.state.config.scenario).toBe(scenario);

        await fixture.teardown();
      }
    });
  });
});

describe('Error Scenarios Configuration', () => {
  it('should have all required scenario configurations', () => {
    const requiredScenarios: ErrorScenario[] = [
      '404-not-found',
      '403-forbidden',
      '500-internal-error',
      '502-bad-gateway',
      '503-service-unavailable',
      '429-rate-limited',
      'network-timeout',
      'connection-refused',
      'dns-failure',
      'ssl-error',
      'javascript-error',
      'load-timeout',
    ];

    for (const scenario of requiredScenarios) {
      expect(ERROR_SCENARIOS[scenario]).toBeDefined();

      const config = ERROR_SCENARIOS[scenario];
      expect(config.scenario).toBe(scenario);
      expect(config.statusCode).toBeTypeOf('number');
      expect(config.statusText).toBeTypeOf('string');
      expect(config.category).toMatch(/^(client|server|network|timeout)$/);
      expect(config.timeout).toBeGreaterThan(0);
    }
  });

  it('should have appropriate status codes for each category', () => {
    Object.entries(ERROR_SCENARIOS).forEach(([scenario, config]) => {
      switch (config.category) {
        case 'client':
          expect(config.statusCode).toBeGreaterThanOrEqual(400);
          expect(config.statusCode).toBeLessThan(500);
          break;
        case 'server':
          expect(config.statusCode).toBeGreaterThanOrEqual(500);
          expect(config.statusCode).toBeLessThan(600);
          break;
        case 'network':
        case 'timeout':
          // Network and timeout errors typically have status code 0
          expect([0, 200].includes(config.statusCode)).toBe(true);
          break;
      }
    });
  });

  it('should have appropriate clearsAuth settings', () => {
    // Server errors and network errors should typically clear auth
    expect(ERROR_SCENARIOS['500-internal-error'].clearsAuth).toBe(true);
    expect(ERROR_SCENARIOS['network-timeout'].clearsAuth).toBe(true);
    expect(ERROR_SCENARIOS['connection-refused'].clearsAuth).toBe(true);

    // Client errors like 404 should not clear auth
    expect(ERROR_SCENARIOS['404-not-found'].clearsAuth).toBe(false);
    expect(ERROR_SCENARIOS['403-forbidden'].clearsAuth).toBe(false);
  });
});