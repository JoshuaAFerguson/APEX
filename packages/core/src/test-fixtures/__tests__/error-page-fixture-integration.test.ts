/**
 * @fileoverview Integration tests for Error Page Fixture
 *
 * Tests the integration between the new ErrorPageFixture and existing
 * browser fixtures and utilities. Ensures compatibility and proper
 * interaction with the existing test infrastructure.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ErrorPageFixture,
  createErrorFixtureHooks,
  withErrorFixture,
  type ErrorScenario,
} from '../error-page-fixture.js';
import { browserFixtures, browserHelpers } from '../browser-fixtures.js';
import type { BrowserState } from '../types.js';

describe('Error Page Fixture Integration', () => {
  describe('Integration with Browser Fixtures', () => {
    let fixture: ErrorPageFixture;

    beforeEach(() => {
      fixture = new ErrorPageFixture();
    });

    afterEach(async () => {
      if (fixture.isSetup()) {
        await fixture.teardown();
      }
    });

    it('should extend browser fixtures with error-specific state', async () => {
      await fixture.simulateError('404-not-found');

      const errorState = fixture.getBrowserState();
      const baseErrorState = browserFixtures.errorPage();

      // Should have all the basic browser state properties
      expect(errorState).toHaveProperty('url');
      expect(errorState).toHaveProperty('title');
      expect(errorState).toHaveProperty('isLoading');
      expect(errorState).toHaveProperty('hasError');
      expect(errorState).toHaveProperty('isAuthenticated');
      expect(errorState).toHaveProperty('localStorage');
      expect(errorState).toHaveProperty('sessionStorage');
      expect(errorState).toHaveProperty('cookies');
      expect(errorState).toHaveProperty('consoleMessages');
      expect(errorState).toHaveProperty('networkRequests');

      // Should have error-specific enhancements
      expect(errorState.hasError).toBe(true);
      expect(errorState.localStorage).toHaveProperty('error-fixture-data');
      expect(errorState.localStorage).toHaveProperty('last-error-scenario');
    });

    it('should work with browser helpers', async () => {
      await fixture.simulateError('500-internal-error');

      const initialState = fixture.getBrowserState();
      const initialMessages = initialState.consoleMessages.length;

      // Use browser helper to add console message
      const updatedState = browserHelpers.addConsoleMessage(
        initialState,
        'warn',
        'Recovery attempt in progress'
      );

      // Update fixture state
      fixture.updateBrowserState(updatedState);

      const finalState = fixture.getBrowserState();
      expect(finalState.consoleMessages.length).toBe(initialMessages + 1);
      expect(finalState.consoleMessages[finalState.consoleMessages.length - 1]).toEqual(
        expect.objectContaining({
          type: 'warn',
          message: 'Recovery attempt in progress',
        })
      );
    });

    it('should maintain compatibility with existing browser state patterns', async () => {
      await fixture.simulateError('network-timeout');

      const errorState = fixture.getBrowserState();

      // Should follow the same structure as browser fixtures
      expect(errorState.consoleMessages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: expect.stringMatching(/^(log|warn|error|info)$/),
            message: expect.any(String),
            timestamp: expect.any(Date),
          }),
        ])
      );

      expect(errorState.networkRequests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            url: expect.any(String),
            method: expect.any(String),
          }),
        ])
      );
    });
  });

  describe('Integration with Test Infrastructure', () => {
    it('should work with existing test patterns', async () => {
      // Test the pattern used in existing test fixtures
      const fixture = new ErrorPageFixture();

      try {
        await fixture.setup({
          name: 'Integration Test',
          description: 'Test integration with existing patterns',
          scenario: '403-forbidden',
          statusCode: 403,
          statusText: 'Forbidden',
          category: 'client',
          expectedUrl: 'https://app.test/forbidden',
          expectedTitle: 'Access Denied',
        });

        const state = fixture.getBrowserState();

        // Should match expected test assertion patterns
        expect(state.hasError).toBe(true);
        expect(state.url).toBe('https://app.test/forbidden');
        expect(state.title).toBe('Access Denied');

        const validation = await fixture.validate();
        expect(validation.valid).toBe(true);
      } finally {
        await fixture.teardown();
      }
    });

    it('should integrate with hook-based test setup', async () => {
      const { setup, teardown } = createErrorFixtureHooks('502-bad-gateway', {
        expectedUrl: 'https://api.test/gateway-error',
        mockResponse: {
          headers: { 'X-Gateway-Error': 'upstream-failure' },
        },
      });

      const fixture = await setup();

      try {
        expect(fixture.isSetup()).toBe(true);
        expect(fixture.state.config.scenario).toBe('502-bad-gateway');
        expect(fixture.state.config.expectedUrl).toBe('https://api.test/gateway-error');

        const state = fixture.getBrowserState();
        expect(state.hasError).toBe(true);

        const validation = await fixture.validate();
        expect(validation.valid).toBe(true);
      } finally {
        await teardown();
      }
    });

    it('should work with higher-order function pattern', async () => {
      const testResults: string[] = [];

      const testFn = withErrorFixture('429-rate-limited', async (fixture) => {
        testResults.push('test-started');

        expect(fixture.isSetup()).toBe(true);
        expect(fixture.state.config.scenario).toBe('429-rate-limited');

        const state = fixture.getBrowserState();
        expect(state.hasError).toBe(true);

        testResults.push('test-completed');
        return 'success';
      });

      const result = await testFn();

      expect(result).toBe('success');
      expect(testResults).toEqual(['test-started', 'test-completed']);
    });
  });

  describe('Compatibility with Existing Error Scenarios', () => {
    it('should enhance existing error page scenarios', async () => {
      const fixture = new ErrorPageFixture();

      try {
        // Start with existing browser error page
        const existingErrorPage = browserFixtures.errorPage();

        // Set up our fixture with a compatible scenario
        await fixture.setup({
          name: 'Enhanced Error Page',
          description: 'Enhanced version of existing error page',
          scenario: '500-internal-error',
          statusCode: 500,
          statusText: 'Internal Server Error',
          category: 'server',
        });

        const enhancedState = fixture.getBrowserState();

        // Should maintain core error page characteristics
        expect(enhancedState.hasError).toBe(true);
        expect(enhancedState.isAuthenticated).toBe(false); // Cleared by server error

        // Should have enhancements not present in basic error page
        expect(enhancedState.localStorage['error-fixture-data']).toBeDefined();
        expect(enhancedState.localStorage['last-error-scenario']).toBe('500-internal-error');

        // Should have error-specific console messages
        const errorMessages = enhancedState.consoleMessages
          .filter(msg => msg.type === 'error')
          .map(msg => msg.message);

        expect(errorMessages.length).toBeGreaterThan(0);
        expect(errorMessages.some(msg => msg.includes('500'))).toBe(true);

      } finally {
        await fixture.teardown();
      }
    });

    it('should provide consistent interface across error types', async () => {
      const scenarios: ErrorScenario[] = ['404-not-found', '500-internal-error', 'network-timeout'];

      for (const scenario of scenarios) {
        const fixture = new ErrorPageFixture();

        try {
          await fixture.simulateError(scenario);

          // All scenarios should provide consistent interface
          expect(fixture.isSetup()).toBe(true);
          expect(fixture.state.config.scenario).toBe(scenario);

          const state = fixture.getBrowserState();
          expect(state).toHaveProperty('hasError');
          expect(state).toHaveProperty('consoleMessages');
          expect(state).toHaveProperty('networkRequests');

          const validation = await fixture.validate();
          expect(validation).toHaveProperty('valid');
          expect(validation).toHaveProperty('errors');
          expect(validation.valid).toBe(true);

        } finally {
          await fixture.teardown();
        }
      }
    });
  });

  describe('State Mutation and Persistence', () => {
    it('should handle state updates correctly', async () => {
      const fixture = new ErrorPageFixture();

      try {
        await fixture.simulateError('503-service-unavailable');

        const originalState = fixture.getBrowserState();
        const originalUrl = originalState.url;

        // Update state using fixture method
        fixture.updateBrowserState({
          url: 'https://maintenance.example.com',
          localStorage: {
            ...originalState.localStorage,
            'maintenance-window': '2024-01-15T10:00:00Z',
          },
        });

        const updatedState = fixture.getBrowserState();
        expect(updatedState.url).toBe('https://maintenance.example.com');
        expect(updatedState.localStorage['maintenance-window']).toBe('2024-01-15T10:00:00Z');

        // Should preserve other state
        expect(updatedState.hasError).toBe(originalState.hasError);
        expect(updatedState.consoleMessages).toEqual(originalState.consoleMessages);

      } finally {
        await fixture.teardown();
      }
    });

    it('should maintain state integrity during lifecycle', async () => {
      const fixture = new ErrorPageFixture();

      // Initial state should be clean
      expect(fixture.isSetup()).toBe(false);
      expect(fixture.state.activeRoutes).toEqual([]);
      expect(fixture.state.activeMocks.size).toBe(0);

      await fixture.setup({
        name: 'Lifecycle Test',
        description: 'Test state integrity',
        scenario: 'javascript-error',
        statusCode: 200,
        statusText: 'OK',
        category: 'client',
      });

      // Should have proper setup state
      expect(fixture.isSetup()).toBe(true);
      expect(fixture.state.config.name).toBe('Lifecycle Test');
      expect(fixture.state.cleanupTasks.length).toBeGreaterThan(0);

      const setupTime = fixture.state.createdAt;

      await fixture.teardown();

      // Should be properly reset
      expect(fixture.isSetup()).toBe(false);
      expect(fixture.state.activeRoutes).toEqual([]);
      expect(fixture.state.activeMocks.size).toBe(0);
      expect(fixture.state.cleanupTasks).toEqual([]);

      // Timestamp should be updated after reset
      expect(fixture.state.createdAt.getTime()).toBeGreaterThanOrEqual(setupTime.getTime());
    });
  });
});