/**
 * @fileoverview Comprehensive Integration Tests for Browser Fixtures
 *
 * This test suite provides comprehensive coverage for browser fixture integration
 * scenarios, including complex state transitions, browser state builders, and
 * edge cases that might occur in real-world usage.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  browserFixtures,
  browserHelpers,
  BrowserStateBuilder,
  createBrowserState,
  createTestSuite,
  addCleanupTask,
  setTestData,
  getTestData
} from '../index.js';
import type { BrowserState, TestScenario, SetupTeardownHooks } from '../types.js';

describe('Browser Fixtures Integration Tests', () => {
  let testSuite: SetupTeardownHooks;

  beforeEach(async () => {
    testSuite = createTestSuite({
      setupMocks: false,
      cleanupAfterEach: true
    });
    await testSuite.beforeEach();
  });

  afterEach(async () => {
    await testSuite.afterEach();
  });

  describe('Complex State Transitions', () => {
    it('should support realistic user journey from clean to logged-in to error', () => {
      // Start with a clean state
      let state = browserFixtures.cleanState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.hasError).toBe(false);

      // Simulate navigation to login
      state = browserHelpers.navigateTo(state, 'https://app.apex.dev/login', 'APEX Login');
      state = browserHelpers.startLoading(state);
      expect(state.isLoading).toBe(true);

      // Simulate successful login
      state = browserHelpers.finishLoading(state);
      state = browserHelpers.setAuthenticated(state, true);
      state = browserHelpers.setLocalStorage(state, 'auth-token', 'valid-jwt-token');
      state = browserHelpers.addConsoleMessage(state, 'info', 'User logged in successfully');
      state = browserHelpers.addNetworkRequest(state, 'https://api.apex.dev/auth/login', 'POST', 200);

      expect(state.isAuthenticated).toBe(true);
      expect(state.localStorage['auth-token']).toBe('valid-jwt-token');

      // Navigate to dashboard
      state = browserHelpers.navigateTo(state, 'https://app.apex.dev/dashboard', 'APEX Dashboard');
      state = browserHelpers.addNetworkRequest(state, 'https://api.apex.dev/user/profile', 'GET', 200);

      // Simulate an error occurring
      state = browserHelpers.setError(state, true);
      state = browserHelpers.addConsoleMessage(state, 'error', 'Failed to load user data');
      state = browserHelpers.addNetworkRequest(state, 'https://api.apex.dev/projects', 'GET', 500);

      expect(state.hasError).toBe(true);
      expect(state.consoleMessages).toHaveLength(2);
      expect(state.networkRequests).toHaveLength(3);

      // Final state validation
      expect(state.url).toBe('https://app.apex.dev/dashboard');
      expect(state.isAuthenticated).toBe(true);
      expect(state.hasError).toBe(true);
    });

    it('should handle offline to online transition', () => {
      // Start offline
      let state = browserFixtures.offlinePage();
      expect(state.localStorage['offline-mode']).toBe('true');
      expect(state.networkRequests).toHaveLength(0);

      // Simulate coming back online
      state = browserHelpers.setLocalStorage(state, 'offline-mode', 'false');
      state = browserHelpers.setLocalStorage(state, 'last-online', new Date().toISOString());
      state = browserHelpers.addConsoleMessage(state, 'info', 'Connection restored');

      // Start making network requests again
      state = browserHelpers.addNetworkRequest(state, 'https://api.apex.dev/sync', 'POST', 200);
      state = browserHelpers.addNetworkRequest(state, 'https://api.apex.dev/user/profile', 'GET', 200);

      expect(state.localStorage['offline-mode']).toBe('false');
      expect(state.networkRequests).toHaveLength(2);
      expect(state.consoleMessages.some(msg => msg.message.includes('Connection restored'))).toBe(true);
    });

    it('should handle permission escalation flow', () => {
      // Start with permission denied
      let state = browserFixtures.permissionDeniedPage();
      expect(state.isAuthenticated).toBe(true);
      expect(state.localStorage['access-level']).toBe('read-only');

      // User requests admin access
      state = browserHelpers.addNetworkRequest(
        state,
        'https://api.apex.dev/admin/request-access',
        'POST',
        202
      );
      state = browserHelpers.addConsoleMessage(state, 'info', 'Admin access requested');

      // Admin grants permission
      state = browserHelpers.setLocalStorage(state, 'access-level', 'admin');
      state = browserHelpers.setSessionStorage(state, 'permissions-updated', 'true');

      // Retry the original request
      state = browserHelpers.navigateTo(state, 'https://app.apex.dev/admin/settings', 'Admin Settings');
      state = browserHelpers.addNetworkRequest(state, 'https://api.apex.dev/admin/settings', 'GET', 200);

      expect(state.localStorage['access-level']).toBe('admin');
      expect(state.url).toBe('https://app.apex.dev/admin/settings');
      expect(state.networkRequests.some(req => req.status === 200 && req.url.includes('/admin/settings'))).toBe(true);
    });
  });

  describe('BrowserStateBuilder Integration', () => {
    it('should support fluent API for complex state construction', () => {
      const state = createBrowserState()
        .withUrl('https://app.apex.dev/project/123')
        .withTitle('Project 123 - APEX')
        .withAuth(true)
        .withLocalStorage({
          'auth-token': 'jwt-token-123',
          'current-project': 'project-123',
          'theme': 'dark'
        })
        .withSessionStorage({
          'active-tab': 'code',
          'unsaved-changes': 'true'
        })
        .withConsoleMessages([
          { type: 'info', message: 'Project loaded' },
          { type: 'warn', message: 'Unsaved changes detected' }
        ])
        .withNetworkRequests([
          { url: 'https://api.apex.dev/projects/123', method: 'GET', status: 200 },
          { url: 'https://api.apex.dev/projects/123/files', method: 'GET', status: 200 }
        ])
        .build();

      expect(state.url).toBe('https://app.apex.dev/project/123');
      expect(state.title).toBe('Project 123 - APEX');
      expect(state.isAuthenticated).toBe(true);
      expect(state.localStorage['current-project']).toBe('project-123');
      expect(state.sessionStorage['active-tab']).toBe('code');
      expect(state.consoleMessages).toHaveLength(2);
      expect(state.networkRequests).toHaveLength(2);
    });

    it('should chain multiple builder operations', () => {
      const builder = createBrowserState()
        .withUrl('https://app.apex.dev')
        .withAuth(true)
        .withLoading(true);

      // Continue building
      const state = builder
        .withLocalStorage({ 'session-id': 'sess-123' })
        .withConsoleMessages([{ type: 'info', message: 'Loading started' }])
        .withLoading(false) // Override previous loading state
        .build();

      expect(state.url).toBe('https://app.apex.dev');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false); // Should use latest value
      expect(state.localStorage['session-id']).toBe('sess-123');
    });

    it('should handle builder with existing state', () => {
      const initialState = browserFixtures.loggedInPage();
      const builder = new BrowserStateBuilder(initialState);

      const state = builder
        .withUrl('https://app.apex.dev/settings')
        .withTitle('Settings - APEX')
        .withLocalStorage({ 'settings-tab': 'profile' })
        .build();

      // Should preserve existing auth state
      expect(state.isAuthenticated).toBe(true);
      expect(state.localStorage['auth-token']).toBe('mock-jwt-token');
      // Should apply new changes
      expect(state.url).toBe('https://app.apex.dev/settings');
      expect(state.localStorage['settings-tab']).toBe('profile');
    });
  });

  describe('Test Data Integration with Browser Fixtures', () => {
    it('should integrate test data with browser state', () => {
      // Store test data
      const userId = 'user-123';
      const projectId = 'proj-456';
      setTestData('userId', userId);
      setTestData('projectId', projectId);

      // Create browser state using test data
      const state = createBrowserState()
        .withUrl(`https://app.apex.dev/user/${getTestData('userId')}/project/${getTestData('projectId')}`)
        .withLocalStorage({
          'user-id': getTestData('userId'),
          'current-project': getTestData('projectId')
        })
        .build();

      expect(state.url).toBe('https://app.apex.dev/user/user-123/project/proj-456');
      expect(state.localStorage['user-id']).toBe('user-123');
      expect(state.localStorage['current-project']).toBe('proj-456');
    });

    it('should support dynamic state generation based on test data', () => {
      setTestData('userRole', 'admin');
      setTestData('features', ['project-management', 'user-administration']);

      const isAdmin = getTestData('userRole') === 'admin';
      const features = getTestData('features') as string[];

      let state = browserFixtures.loggedInPage();

      if (isAdmin) {
        state = browserHelpers.setLocalStorage(state, 'access-level', 'admin');
        state = browserHelpers.addNetworkRequest(state, 'https://api.apex.dev/admin/dashboard', 'GET', 200);
      }

      state = browserHelpers.setLocalStorage(state, 'enabled-features', JSON.stringify(features));

      expect(state.localStorage['access-level']).toBe('admin');
      expect(JSON.parse(state.localStorage['enabled-features'])).toEqual(features);
      expect(state.networkRequests.some(req => req.url.includes('/admin/dashboard'))).toBe(true);
    });
  });

  describe('Cleanup Task Integration', () => {
    it('should register cleanup tasks for browser state resources', () => {
      const cleanupTasks: string[] = [];

      // Simulate creating a browser state that needs cleanup
      const state = createBrowserState()
        .withUrl('https://app.apex.dev/test')
        .withLocalStorage({ 'temp-data': 'needs-cleanup' })
        .build();

      // Register cleanup for browser resources
      addCleanupTask(() => {
        cleanupTasks.push('localStorage-cleared');
      });

      addCleanupTask(() => {
        cleanupTasks.push('session-cleared');
      });

      expect(state.localStorage['temp-data']).toBe('needs-cleanup');

      // Cleanup tasks will be executed during afterEach
      setTestData('cleanupTasks', cleanupTasks);
    });

    it('should handle cleanup failures gracefully', () => {
      addCleanupTask(() => {
        throw new Error('Cleanup failed');
      });

      addCleanupTask(() => {
        setTestData('cleanupSucceeded', true);
      });

      // Both should run during teardown, with error handled gracefully
    });
  });

  describe('Scenario-Based Integration Tests', () => {
    it('should support end-to-end testing scenarios', () => {
      const scenarios: Array<{ name: string; scenario: TestScenario; expectedBehavior: (state: BrowserState) => void }> = [
        {
          name: 'clean-state for new user onboarding',
          scenario: 'clean-state',
          expectedBehavior: (state) => {
            expect(state.isAuthenticated).toBe(false);
            expect(state.localStorage).toEqual({});
            expect(state.consoleMessages).toEqual([]);
          }
        },
        {
          name: 'logged-in-user for authenticated workflows',
          scenario: 'logged-in-user',
          expectedBehavior: (state) => {
            expect(state.isAuthenticated).toBe(true);
            expect(state.localStorage['auth-token']).toBeDefined();
            expect(state.consoleMessages.length).toBeGreaterThan(0);
          }
        },
        {
          name: 'error-state for error handling',
          scenario: 'error-state',
          expectedBehavior: (state) => {
            expect(state.hasError).toBe(true);
            expect(state.consoleMessages.some(msg => msg.type === 'error')).toBe(true);
            expect(state.networkRequests.some(req => req.status && req.status >= 500)).toBe(true);
          }
        },
        {
          name: 'loading-state for performance testing',
          scenario: 'loading-state',
          expectedBehavior: (state) => {
            expect(state.isLoading).toBe(true);
            expect(state.localStorage['loading-start-time']).toBeDefined();
            expect(state.sessionStorage['navigation-state']).toBe('loading');
          }
        },
        {
          name: 'network-offline for offline testing',
          scenario: 'network-offline',
          expectedBehavior: (state) => {
            expect(state.localStorage['offline-mode']).toBe('true');
            expect(state.networkRequests).toEqual([]);
            expect(state.consoleMessages.some(msg => msg.message.includes('offline'))).toBe(true);
          }
        },
        {
          name: 'permission-denied for authorization testing',
          scenario: 'permission-denied',
          expectedBehavior: (state) => {
            expect(state.isAuthenticated).toBe(true); // User is logged in
            expect(state.networkRequests.some(req => req.status === 403)).toBe(true);
            expect(state.consoleMessages.some(msg => msg.message.includes('Access denied'))).toBe(true);
          }
        }
      ];

      scenarios.forEach(({ name, scenario, expectedBehavior }) => {
        const state = browserFixtures.fromScenario(scenario);
        expectedBehavior(state);

        // Store test results for verification
        setTestData(`scenario-${scenario}-tested`, true);
      });

      // Verify all scenarios were tested
      scenarios.forEach(({ scenario }) => {
        expect(getTestData(`scenario-${scenario}-tested`)).toBe(true);
      });
    });
  });

  describe('Performance and Memory Tests', () => {
    it('should handle large browser states efficiently', () => {
      const startTime = performance.now();

      const state = createBrowserState()
        .withLocalStorage(
          Object.fromEntries(
            Array.from({ length: 100 }, (_, i) => [`key-${i}`, `value-${i}`])
          )
        )
        .withSessionStorage(
          Object.fromEntries(
            Array.from({ length: 50 }, (_, i) => [`session-key-${i}`, `session-value-${i}`])
          )
        )
        .withConsoleMessages(
          Array.from({ length: 200 }, (_, i) => ({
            type: 'info' as const,
            message: `Console message ${i}`,
            timestamp: new Date(Date.now() + i * 1000)
          }))
        )
        .withNetworkRequests(
          Array.from({ length: 50 }, (_, i) => ({
            url: `https://api.apex.dev/endpoint-${i}`,
            method: 'GET',
            status: 200,
            headers: { 'Request-Id': `req-${i}` }
          }))
        )
        .build();

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(Object.keys(state.localStorage)).toHaveLength(100);
      expect(Object.keys(state.sessionStorage)).toHaveLength(50);
      expect(state.consoleMessages).toHaveLength(200);
      expect(state.networkRequests).toHaveLength(50);

      // Should complete within reasonable time (adjust as needed)
      expect(duration).toBeLessThan(100); // 100ms
    });

    it('should maintain immutability with deep state modifications', () => {
      const original = browserFixtures.loggedInPage();
      const originalConsoleCount = original.consoleMessages.length;
      const originalRequestCount = original.networkRequests.length;

      // Perform multiple modifications
      const modified = browserHelpers.addConsoleMessage(
        browserHelpers.addNetworkRequest(
          browserHelpers.setLocalStorage(original, 'new-key', 'new-value'),
          'https://api.apex.dev/new-endpoint',
          'POST'
        ),
        'info',
        'New message'
      );

      // Verify original is unchanged
      expect(original.consoleMessages).toHaveLength(originalConsoleCount);
      expect(original.networkRequests).toHaveLength(originalRequestCount);
      expect(original.localStorage['new-key']).toBeUndefined();

      // Verify modified has changes
      expect(modified.consoleMessages).toHaveLength(originalConsoleCount + 1);
      expect(modified.networkRequests).toHaveLength(originalRequestCount + 1);
      expect(modified.localStorage['new-key']).toBe('new-value');
    });
  });

  describe('Error Resilience', () => {
    it('should handle malformed browser state gracefully', () => {
      // Test with incomplete/invalid state
      const builder = new BrowserStateBuilder({
        // @ts-expect-error - Testing malformed state
        url: null,
        // @ts-expect-error - Testing malformed state
        localStorage: null,
        consoleMessages: [], // Valid
        networkRequests: []   // Valid
      });

      const state = builder.build();

      // Should handle nulls gracefully (defaults applied)
      expect(state.url).toBeDefined();
      expect(state.localStorage).toBeDefined();
      expect(typeof state.localStorage).toBe('object');
    });

    it('should handle circular references in test data', () => {
      const circularObj: any = { name: 'circular' };
      circularObj.self = circularObj;

      // Should not cause infinite recursion
      expect(() => {
        setTestData('circular', circularObj);
        const retrieved = getTestData('circular');
        expect(retrieved.name).toBe('circular');
      }).not.toThrow();
    });
  });
});

describe('Browser Fixture Edge Cases', () => {
  describe('State Validation', () => {
    it('should validate required browser state properties', () => {
      const states = [
        browserFixtures.cleanState(),
        browserFixtures.loggedInPage(),
        browserFixtures.errorPage(),
        browserFixtures.loadingPage(),
        browserFixtures.offlinePage(),
        browserFixtures.permissionDeniedPage()
      ];

      states.forEach(state => {
        expect(state).toHaveProperty('url');
        expect(state).toHaveProperty('title');
        expect(state).toHaveProperty('isLoading');
        expect(state).toHaveProperty('hasError');
        expect(state).toHaveProperty('isAuthenticated');
        expect(state).toHaveProperty('localStorage');
        expect(state).toHaveProperty('sessionStorage');
        expect(state).toHaveProperty('cookies');
        expect(state).toHaveProperty('consoleMessages');
        expect(state).toHaveProperty('networkRequests');

        expect(typeof state.url).toBe('string');
        expect(typeof state.title).toBe('string');
        expect(typeof state.isLoading).toBe('boolean');
        expect(typeof state.hasError).toBe('boolean');
        expect(typeof state.isAuthenticated).toBe('boolean');
        expect(Array.isArray(state.cookies)).toBe(true);
        expect(Array.isArray(state.consoleMessages)).toBe(true);
        expect(Array.isArray(state.networkRequests)).toBe(true);
      });
    });

    it('should maintain type consistency after helper operations', () => {
      let state = browserFixtures.cleanState();

      state = browserHelpers.setLocalStorage(state, 'test', 'value');
      state = browserHelpers.addConsoleMessage(state, 'info', 'test message');
      state = browserHelpers.addNetworkRequest(state, 'https://test.com');
      state = browserHelpers.setAuthenticated(state, true);

      expect(typeof state.localStorage).toBe('object');
      expect(Array.isArray(state.consoleMessages)).toBe(true);
      expect(Array.isArray(state.networkRequests)).toBe(true);
      expect(typeof state.isAuthenticated).toBe('boolean');
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle empty values correctly', () => {
      const state = createBrowserState()
        .withUrl('')
        .withTitle('')
        .withLocalStorage({})
        .withSessionStorage({})
        .withConsoleMessages([])
        .withNetworkRequests([])
        .build();

      expect(state.url).toBe('');
      expect(state.title).toBe('');
      expect(Object.keys(state.localStorage)).toHaveLength(0);
      expect(Object.keys(state.sessionStorage)).toHaveLength(0);
      expect(state.consoleMessages).toHaveLength(0);
      expect(state.networkRequests).toHaveLength(0);
    });

    it('should handle unicode and special characters', () => {
      const specialChars = '🚀 APEX - Test 测试 العربية русский';
      const state = createBrowserState()
        .withUrl(`https://app.apex.dev/test?q=${encodeURIComponent(specialChars)}`)
        .withTitle(specialChars)
        .withLocalStorage({ 'unicode-key': specialChars })
        .withConsoleMessages([{ type: 'info', message: specialChars }])
        .build();

      expect(state.title).toBe(specialChars);
      expect(state.localStorage['unicode-key']).toBe(specialChars);
      expect(state.consoleMessages[0].message).toBe(specialChars);
    });

    it('should handle large data sets', () => {
      const largeString = 'x'.repeat(10000);
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        type: 'info' as const,
        message: `Message ${i}`,
        timestamp: new Date()
      }));

      const state = createBrowserState()
        .withLocalStorage({ 'large-data': largeString })
        .withConsoleMessages(largeArray)
        .build();

      expect(state.localStorage['large-data']).toHaveLength(10000);
      expect(state.consoleMessages).toHaveLength(1000);
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle concurrent state modifications', () => {
      const baseState = browserFixtures.cleanState();

      // Simulate concurrent modifications
      const results = Promise.all([
        Promise.resolve(browserHelpers.setLocalStorage(baseState, 'key1', 'value1')),
        Promise.resolve(browserHelpers.setLocalStorage(baseState, 'key2', 'value2')),
        Promise.resolve(browserHelpers.addConsoleMessage(baseState, 'info', 'message1')),
        Promise.resolve(browserHelpers.addConsoleMessage(baseState, 'info', 'message2'))
      ]);

      return results.then(([state1, state2, state3, state4]) => {
        // Each operation should return a valid state
        expect(state1.localStorage.key1).toBe('value1');
        expect(state2.localStorage.key2).toBe('value2');
        expect(state3.consoleMessages).toHaveLength(1);
        expect(state4.consoleMessages).toHaveLength(1);

        // Original state should be unchanged
        expect(Object.keys(baseState.localStorage)).toHaveLength(0);
        expect(baseState.consoleMessages).toHaveLength(0);
      });
    });
  });
});