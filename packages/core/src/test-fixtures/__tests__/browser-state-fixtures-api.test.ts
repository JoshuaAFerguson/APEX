/**
 * @fileoverview Browser State Fixtures API Test Suite
 *
 * This comprehensive test suite validates the browser state fixtures API documentation
 * by testing all factory functions, types, and usage examples described in
 * docs/browser-state-fixtures-api.md
 *
 * Tests cover:
 * - All 7 browserFixtures factory functions
 * - BrowserState interface structure and types
 * - TestScenario type and fromScenario function
 * - Parameter types, default values, return types
 * - Usage examples from documentation
 * - Helper utilities and builder patterns
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  browserFixtures,
  browserHelpers,
  BrowserStateBuilder,
  createBrowserState,
} from '../browser-fixtures.js';
import type { BrowserState, TestScenario } from '../types.js';

describe('Browser State Fixtures API Documentation Tests', () => {
  describe('browserFixtures Factory Functions', () => {
    describe('cleanState()', () => {
      it('should create clean initial state with documented default values', () => {
        const state = browserFixtures.cleanState();

        // Verify exact default values from documentation
        expect(state.url).toBe('about:blank');
        expect(state.title).toBe('');
        expect(state.isLoading).toBe(false);
        expect(state.hasError).toBe(false);
        expect(state.isAuthenticated).toBe(false);
        expect(state.localStorage).toEqual({});
        expect(state.sessionStorage).toEqual({});
        expect(state.cookies).toEqual([]);
        expect(state.consoleMessages).toEqual([]);
        expect(state.networkRequests).toEqual([]);
      });

      it('should accept overrides parameter as documented', () => {
        const overrides: Partial<BrowserState> = {
          url: 'https://example.com',
          title: 'Example Page',
          isLoading: true,
        };

        const state = browserFixtures.cleanState(overrides);

        expect(state.url).toBe('https://example.com');
        expect(state.title).toBe('Example Page');
        expect(state.isLoading).toBe(true);
        // Non-overridden values should remain defaults
        expect(state.isAuthenticated).toBe(false);
        expect(state.hasError).toBe(false);
      });

      it('should match documented usage example', () => {
        // From documentation example
        const state = browserFixtures.cleanState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.url).toBe('about:blank');

        // Clean state with custom URL example
        const customState = browserFixtures.cleanState({
          url: 'https://example.com',
          title: 'Example Page'
        });
        expect(customState.url).toBe('https://example.com');
        expect(customState.title).toBe('Example Page');
      });

      it('should return BrowserState type with all required properties', () => {
        const state = browserFixtures.cleanState();

        // Verify all BrowserState interface properties exist
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

        // Verify property types
        expect(typeof state.url).toBe('string');
        expect(typeof state.title).toBe('string');
        expect(typeof state.isLoading).toBe('boolean');
        expect(typeof state.hasError).toBe('boolean');
        expect(typeof state.isAuthenticated).toBe('boolean');
        expect(typeof state.localStorage).toBe('object');
        expect(typeof state.sessionStorage).toBe('object');
        expect(Array.isArray(state.cookies)).toBe(true);
        expect(Array.isArray(state.consoleMessages)).toBe(true);
        expect(Array.isArray(state.networkRequests)).toBe(true);
      });
    });

    describe('loggedInPage()', () => {
      it('should create logged-in state with documented default values', () => {
        const state = browserFixtures.loggedInPage();

        // Verify exact default values from documentation
        expect(state.url).toBe('https://app.apex.dev/dashboard');
        expect(state.title).toBe('APEX Dashboard');
        expect(state.isLoading).toBe(false);
        expect(state.hasError).toBe(false);
        expect(state.isAuthenticated).toBe(true);

        // Verify localStorage contains documented auth data
        expect(state.localStorage['auth-token']).toBe('mock-jwt-token');
        expect(state.localStorage['user-preferences']).toBeDefined();
        expect(state.localStorage['session-id']).toBe('sess_mock_123456789');

        // Verify sessionStorage contains documented data
        expect(state.sessionStorage['current-project']).toBe('/users/test/my-project');
        expect(state.sessionStorage['active-agents']).toBeDefined();

        // Verify cookies structure
        expect(state.cookies.length).toBeGreaterThan(0);
        const authCookie = state.cookies.find(c => c.name === 'auth-session');
        expect(authCookie).toBeDefined();
        expect(authCookie?.value).toBe('mock-session-cookie');
        expect(authCookie?.domain).toBe('app.apex.dev');

        // Verify console messages contain auth logs
        expect(state.consoleMessages.length).toBeGreaterThan(0);
        const authMessage = state.consoleMessages.find(msg =>
          msg.message.includes('User authenticated')
        );
        expect(authMessage).toBeDefined();

        // Verify network requests contain API calls
        expect(state.networkRequests.length).toBeGreaterThan(0);
        const profileRequest = state.networkRequests.find(req =>
          req.url.includes('/user/profile')
        );
        expect(profileRequest).toBeDefined();
        expect(profileRequest?.status).toBe(200);
      });

      it('should accept overrides parameter as documented', () => {
        const overrides: Partial<BrowserState> = {
          sessionStorage: {
            'current-project': '/users/john/my-custom-project'
          }
        };

        const state = browserFixtures.loggedInPage(overrides);

        expect(state.sessionStorage['current-project']).toBe('/users/john/my-custom-project');
        // Non-overridden values should remain defaults
        expect(state.isAuthenticated).toBe(true);
        expect(state.localStorage['auth-token']).toBe('mock-jwt-token');
      });

      it('should match documented usage examples', () => {
        // Basic logged-in state example
        const state = browserFixtures.loggedInPage();
        expect(state.isAuthenticated).toBe(true);
        expect(state.localStorage['auth-token']).toBe('mock-jwt-token');

        // Logged-in state with custom project example
        const customState = browserFixtures.loggedInPage({
          sessionStorage: {
            'current-project': '/users/john/my-custom-project'
          }
        });
        expect(customState.sessionStorage['current-project']).toBe('/users/john/my-custom-project');
      });
    });

    describe('errorPage()', () => {
      it('should create error state with documented default values', () => {
        const state = browserFixtures.errorPage();

        // Verify exact default values from documentation
        expect(state.url).toBe('https://app.apex.dev/error');
        expect(state.title).toBe('Error - APEX');
        expect(state.isLoading).toBe(false);
        expect(state.hasError).toBe(true);
        expect(state.isAuthenticated).toBe(false); // Errors clear auth state

        // Verify localStorage contains error information
        expect(state.localStorage['last-error']).toBeDefined();
        const lastError = JSON.parse(state.localStorage['last-error']);
        expect(lastError.code).toBe(500);
        expect(lastError.message).toBe('Internal Server Error');

        // Verify session storage is empty
        expect(state.sessionStorage).toEqual({});

        // Verify no cookies (cleared by error)
        expect(state.cookies).toEqual([]);

        // Verify error console messages
        expect(state.consoleMessages.length).toBeGreaterThan(0);
        const errorMessage = state.consoleMessages.find(msg =>
          msg.type === 'error' && msg.message.includes('NetworkError')
        );
        expect(errorMessage).toBeDefined();

        // Verify failed network requests
        expect(state.networkRequests.length).toBeGreaterThan(0);
        const failedRequest = state.networkRequests.find(req => req.status === 500);
        expect(failedRequest).toBeDefined();
      });

      it('should match documented usage examples', () => {
        // Basic error state example
        const state = browserFixtures.errorPage();
        expect(state.hasError).toBe(true);
        expect(state.isAuthenticated).toBe(false);

        // Custom error with specific error code example
        const customErrorState = browserFixtures.errorPage({
          localStorage: {
            'last-error': JSON.stringify({
              code: 404,
              message: 'Page Not Found'
            })
          }
        });
        const lastError = JSON.parse(customErrorState.localStorage['last-error']);
        expect(lastError.code).toBe(404);
        expect(lastError.message).toBe('Page Not Found');
      });
    });

    describe('loadingPage()', () => {
      it('should create loading state with documented default values', () => {
        const state = browserFixtures.loadingPage();

        // Verify exact default values from documentation
        expect(state.url).toBe('https://app.apex.dev/loading');
        expect(state.title).toBe('Loading... - APEX');
        expect(state.isLoading).toBe(true);
        expect(state.hasError).toBe(false);
        expect(state.isAuthenticated).toBe(false); // Unknown during loading

        // Verify localStorage contains loading start time
        expect(state.localStorage['loading-start-time']).toBeDefined();

        // Verify sessionStorage contains navigation state
        expect(state.sessionStorage['navigation-state']).toBe('loading');

        // Verify no cookies during loading
        expect(state.cookies).toEqual([]);

        // Verify loading progress console messages
        expect(state.consoleMessages.length).toBeGreaterThan(0);
        const loadingMessage = state.consoleMessages.find(msg =>
          msg.message.includes('Loading application resources')
        );
        expect(loadingMessage).toBeDefined();

        // Verify resource loading network requests
        expect(state.networkRequests.length).toBeGreaterThan(0);
        const bundleRequest = state.networkRequests.find(req =>
          req.url.includes('bundle.js')
        );
        expect(bundleRequest).toBeDefined();
        expect(bundleRequest?.status).toBe(200);
      });

      it('should match documented usage examples', () => {
        // Basic loading state example
        const state = browserFixtures.loadingPage();
        expect(state.isLoading).toBe(true);
        expect(state.title).toBe('Loading... - APEX');

        // Loading state with custom progress example
        const customLoadingState = browserFixtures.loadingPage({
          sessionStorage: {
            'loading-progress': '75%'
          }
        });
        expect(customLoadingState.sessionStorage['loading-progress']).toBe('75%');
      });
    });

    describe('offlinePage()', () => {
      it('should create offline state with documented default values', () => {
        const state = browserFixtures.offlinePage();

        // Verify exact default values from documentation
        expect(state.url).toBe('https://app.apex.dev/offline');
        expect(state.title).toBe('Offline - APEX');
        expect(state.isLoading).toBe(false);
        expect(state.hasError).toBe(false); // Not exactly error, just offline
        expect(state.isAuthenticated).toBe(false); // Cannot verify when offline

        // Verify localStorage contains offline mode and cached data
        expect(state.localStorage['offline-mode']).toBe('true');
        expect(state.localStorage['last-online']).toBeDefined();
        expect(state.localStorage['cached-data']).toBeDefined();
        const cachedData = JSON.parse(state.localStorage['cached-data']);
        expect(cachedData).toHaveProperty('projects');
        expect(cachedData).toHaveProperty('profile');

        // Verify session storage is empty
        expect(state.sessionStorage).toEqual({});

        // Verify no cookies when offline
        expect(state.cookies).toEqual([]);

        // Verify offline mode console messages
        expect(state.consoleMessages.length).toBeGreaterThan(0);
        const offlineMessage = state.consoleMessages.find(msg =>
          msg.message.includes('Network connection lost')
        );
        expect(offlineMessage).toBeDefined();

        // Verify no network requests when offline
        expect(state.networkRequests).toEqual([]);
      });

      it('should match documented usage examples', () => {
        // Basic offline state example
        const state = browserFixtures.offlinePage();
        expect(state.localStorage['offline-mode']).toBe('true');
        expect(state.networkRequests.length).toBe(0);

        // Offline state with cached content example
        const customOfflineState = browserFixtures.offlinePage({
          localStorage: {
            'cached-content': JSON.stringify({
              lastSyncedProjects: ['project1', 'project2']
            })
          }
        });
        const cachedContent = JSON.parse(customOfflineState.localStorage['cached-content']);
        expect(cachedContent.lastSyncedProjects).toEqual(['project1', 'project2']);
      });
    });

    describe('permissionDeniedPage()', () => {
      it('should create permission denied state with documented default values', () => {
        const state = browserFixtures.permissionDeniedPage();

        // Verify exact default values from documentation
        expect(state.url).toBe('https://app.apex.dev/access-denied');
        expect(state.title).toBe('Access Denied - APEX');
        expect(state.isLoading).toBe(false);
        expect(state.hasError).toBe(false); // Not system error, just access denied
        expect(state.isAuthenticated).toBe(true); // User is logged in but lacks permissions

        // Verify localStorage contains auth token and access level
        expect(state.localStorage['auth-token']).toBe('mock-jwt-token');
        expect(state.localStorage['access-level']).toBe('read-only');

        // Verify sessionStorage contains attempted resource
        expect(state.sessionStorage['attempted-resource']).toBe('/admin/settings');

        // Verify authentication session cookie
        expect(state.cookies.length).toBeGreaterThan(0);
        const authCookie = state.cookies.find(c => c.name === 'auth-session');
        expect(authCookie).toBeDefined();
        expect(authCookie?.value).toBe('mock-session-cookie');

        // Verify permission warning console messages
        expect(state.consoleMessages.length).toBeGreaterThan(0);
        const permissionMessage = state.consoleMessages.find(msg =>
          msg.type === 'warn' && msg.message.includes('Access denied')
        );
        expect(permissionMessage).toBeDefined();

        // Verify failed API request with 403 status
        expect(state.networkRequests.length).toBeGreaterThan(0);
        const failedRequest = state.networkRequests.find(req => req.status === 403);
        expect(failedRequest).toBeDefined();
        expect(failedRequest?.url).toBe('https://api.apex.dev/admin/settings');
      });

      it('should match documented usage examples', () => {
        // Basic permission denied state example
        const state = browserFixtures.permissionDeniedPage();
        expect(state.isAuthenticated).toBe(true);
        expect(state.networkRequests[0].status).toBe(403);

        // Permission denied for specific resource example
        const customPermissionState = browserFixtures.permissionDeniedPage({
          sessionStorage: {
            'attempted-resource': '/api/admin/users'
          },
          localStorage: {
            'user-role': 'editor'
          }
        });
        expect(customPermissionState.sessionStorage['attempted-resource']).toBe('/api/admin/users');
        expect(customPermissionState.localStorage['user-role']).toBe('editor');
      });
    });

    describe('fromScenario()', () => {
      const scenarios: TestScenario[] = [
        'clean-state',
        'logged-in-user',
        'error-state',
        'loading-state',
        'network-offline',
        'permission-denied'
      ];

      it('should accept TestScenario as first parameter', () => {
        scenarios.forEach(scenario => {
          expect(() => browserFixtures.fromScenario(scenario)).not.toThrow();
        });
      });

      it('should accept optional overrides as second parameter', () => {
        const overrides: Partial<BrowserState> = {
          url: 'https://custom.example.com/error'
        };

        const state = browserFixtures.fromScenario('error-state', overrides);
        expect(state.url).toBe('https://custom.example.com/error');
      });

      it('should return correct states for each scenario', () => {
        // Test each scenario maps to correct function
        expect(browserFixtures.fromScenario('clean-state')).toEqual(
          browserFixtures.cleanState()
        );
        expect(browserFixtures.fromScenario('logged-in-user')).toEqual(
          browserFixtures.loggedInPage()
        );
        expect(browserFixtures.fromScenario('error-state')).toEqual(
          browserFixtures.errorPage()
        );
        expect(browserFixtures.fromScenario('loading-state')).toEqual(
          browserFixtures.loadingPage()
        );
        expect(browserFixtures.fromScenario('network-offline')).toEqual(
          browserFixtures.offlinePage()
        );
        expect(browserFixtures.fromScenario('permission-denied')).toEqual(
          browserFixtures.permissionDeniedPage()
        );
      });

      it('should match documented usage examples', () => {
        // Create state from scenario example
        const state = browserFixtures.fromScenario('logged-in-user');
        expect(state.isAuthenticated).toBe(true);

        // Create state from scenario with overrides example
        const customState = browserFixtures.fromScenario('error-state', {
          url: 'https://custom.example.com/error'
        });
        expect(customState.url).toBe('https://custom.example.com/error');
        expect(customState.hasError).toBe(true);

        // Parameterized tests example
        scenarios.forEach(scenario => {
          const state = browserFixtures.fromScenario(scenario);
          // Test basic structure
          expect(state).toHaveProperty('url');
          expect(state).toHaveProperty('isAuthenticated');
          expect(typeof state.url).toBe('string');
          expect(typeof state.isAuthenticated).toBe('boolean');
        });
      });

      it('should handle unknown scenarios gracefully', () => {
        // TypeScript would prevent this, but test runtime behavior
        const state = browserFixtures.fromScenario('unknown-scenario' as TestScenario);
        // Should fallback to cleanState
        expect(state).toEqual(browserFixtures.cleanState());
      });
    });
  });

  describe('BrowserState Interface Validation', () => {
    it('should match documented interface structure exactly', () => {
      const state = browserFixtures.cleanState();

      // Verify property types match BrowserState interface
      expect(typeof state.url).toBe('string');
      expect(typeof state.title).toBe('string');
      expect(typeof state.isLoading).toBe('boolean');
      expect(typeof state.hasError).toBe('boolean');
      expect(typeof state.isAuthenticated).toBe('boolean');

      // Verify localStorage is Record<string, string>
      expect(typeof state.localStorage).toBe('object');
      expect(state.localStorage).not.toBeNull();
      Object.values(state.localStorage).forEach(value => {
        expect(typeof value).toBe('string');
      });

      // Verify sessionStorage is Record<string, string>
      expect(typeof state.sessionStorage).toBe('object');
      expect(state.sessionStorage).not.toBeNull();
      Object.values(state.sessionStorage).forEach(value => {
        expect(typeof value).toBe('string');
      });

      // Verify cookies array structure
      expect(Array.isArray(state.cookies)).toBe(true);

      // Verify consoleMessages array structure
      expect(Array.isArray(state.consoleMessages)).toBe(true);

      // Verify networkRequests array structure
      expect(Array.isArray(state.networkRequests)).toBe(true);
    });

    it('should validate cookie structure when present', () => {
      const state = browserFixtures.loggedInPage();

      state.cookies.forEach(cookie => {
        expect(typeof cookie.name).toBe('string');
        expect(typeof cookie.value).toBe('string');
        if (cookie.domain) expect(typeof cookie.domain).toBe('string');
        if (cookie.path) expect(typeof cookie.path).toBe('string');
      });
    });

    it('should validate console message structure when present', () => {
      const state = browserFixtures.loggedInPage();

      state.consoleMessages.forEach(message => {
        expect(typeof message.type).toBe('string');
        expect(['log', 'warn', 'error', 'info']).toContain(message.type);
        expect(typeof message.message).toBe('string');
        expect(message.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should validate network request structure when present', () => {
      const state = browserFixtures.loggedInPage();

      state.networkRequests.forEach(request => {
        expect(typeof request.url).toBe('string');
        expect(typeof request.method).toBe('string');
        if (request.status) expect(typeof request.status).toBe('number');
        if (request.headers) {
          expect(typeof request.headers).toBe('object');
          Object.values(request.headers).forEach(value => {
            expect(typeof value).toBe('string');
          });
        }
      });
    });
  });

  describe('TestScenario Type Validation', () => {
    it('should support all documented scenario values', () => {
      // From documentation: TestScenario type supports these values
      const documentedScenarios: TestScenario[] = [
        'clean-state',
        'logged-in-user',
        'error-state',
        'loading-state',
        'network-offline',
        'permission-denied',
        'file-not-found',
        'invalid-config'
      ];

      // Test that fromScenario handles all documented scenarios
      documentedScenarios.forEach(scenario => {
        expect(() => {
          // Note: not all scenarios may be implemented in fromScenario
          // but they should be valid TestScenario values
          const result = browserFixtures.fromScenario(scenario);
          expect(result).toBeDefined();
        }).not.toThrow();
      });
    });
  });
});

describe('Documentation Examples Integration Tests', () => {
  describe('Testing Authentication Flow Examples', () => {
    it('should handle login transition as documented', () => {
      // Start with clean state
      const initialState = browserFixtures.cleanState({
        url: 'https://app.apex.dev/login'
      });

      expect(initialState.isAuthenticated).toBe(false);

      // Simulate successful login
      const loggedInState = browserFixtures.loggedInPage();
      expect(loggedInState.isAuthenticated).toBe(true);
      expect(loggedInState.localStorage['auth-token']).toBeTruthy();
    });

    it('should handle logout as documented', () => {
      // Start with logged-in state
      const loggedInState = browserFixtures.loggedInPage();

      // Simulate logout (clear auth data)
      const loggedOutState = browserFixtures.cleanState({
        url: 'https://app.apex.dev/login',
        consoleMessages: [{
          type: 'info',
          message: 'User logged out successfully',
          timestamp: new Date()
        }]
      });

      expect(loggedOutState.isAuthenticated).toBe(false);
    });
  });

  describe('Testing Error Handling Examples', () => {
    it('should handle network errors as documented', () => {
      const errorState = browserFixtures.errorPage({
        localStorage: {
          'last-error': JSON.stringify({
            code: 'NETWORK_ERROR',
            message: 'Failed to connect to server'
          })
        }
      });

      expect(errorState.hasError).toBe(true);
      expect(errorState.consoleMessages.some(msg =>
        msg.type === 'error' && msg.message.includes('NetworkError')
      )).toBe(true);
    });

    it('should handle permission errors as documented', () => {
      const permissionState = browserFixtures.permissionDeniedPage();

      expect(permissionState.isAuthenticated).toBe(true); // User is logged in
      expect(permissionState.networkRequests[0].status).toBe(403); // But lacks permission
    });
  });

  describe('Testing Loading States Examples', () => {
    it('should handle page loading as documented', () => {
      const loadingState = browserFixtures.loadingPage();

      expect(loadingState.isLoading).toBe(true);
      expect(loadingState.title).toContain('Loading...');

      // Simulate loading completion
      const loadedState = browserFixtures.loggedInPage({
        url: loadingState.url.replace('/loading', '/dashboard')
      });

      expect(loadedState.isLoading).toBe(false);
    });
  });

  describe('Testing Offline Scenarios Examples', () => {
    it('should handle offline mode as documented', () => {
      const offlineState = browserFixtures.offlinePage();

      expect(offlineState.localStorage['offline-mode']).toBe('true');
      expect(offlineState.networkRequests.length).toBe(0);

      // Check cached data is available
      const cachedData = JSON.parse(offlineState.localStorage['cached-data']);
      expect(cachedData).toHaveProperty('projects');
      expect(cachedData).toHaveProperty('profile');
    });
  });

  describe('Parameterized Testing with Scenarios Examples', () => {
    const scenarios: TestScenario[] = [
      'clean-state',
      'logged-in-user',
      'error-state',
      'loading-state',
      'network-offline',
      'permission-denied'
    ];

    it('should validate state structure in all scenarios', () => {
      scenarios.forEach(scenario => {
        const state = browserFixtures.fromScenario(scenario);

        // Validate all states have required properties
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
      });
    });
  });
});

describe('Helper Utilities Tests', () => {
  describe('browserHelpers', () => {
    let initialState: BrowserState;

    beforeEach(() => {
      initialState = browserFixtures.cleanState();
    });

    it('should add console messages correctly', () => {
      const state = browserHelpers.addConsoleMessage(
        initialState,
        'info',
        'Test message'
      );

      expect(state.consoleMessages.length).toBe(1);
      expect(state.consoleMessages[0].type).toBe('info');
      expect(state.consoleMessages[0].message).toBe('Test message');
      expect(state.consoleMessages[0].timestamp).toBeInstanceOf(Date);
    });

    it('should add network requests correctly', () => {
      const state = browserHelpers.addNetworkRequest(
        initialState,
        'https://api.example.com/test',
        'POST',
        200,
        { 'Content-Type': 'application/json' }
      );

      expect(state.networkRequests.length).toBe(1);
      expect(state.networkRequests[0].url).toBe('https://api.example.com/test');
      expect(state.networkRequests[0].method).toBe('POST');
      expect(state.networkRequests[0].status).toBe(200);
      expect(state.networkRequests[0].headers).toEqual({ 'Content-Type': 'application/json' });
    });

    it('should set localStorage data correctly', () => {
      const state = browserHelpers.setLocalStorage(
        initialState,
        'test-key',
        'test-value'
      );

      expect(state.localStorage['test-key']).toBe('test-value');
    });

    it('should set sessionStorage data correctly', () => {
      const state = browserHelpers.setSessionStorage(
        initialState,
        'test-key',
        'test-value'
      );

      expect(state.sessionStorage['test-key']).toBe('test-value');
    });

    it('should add cookies correctly', () => {
      const state = browserHelpers.addCookie(
        initialState,
        'test-cookie',
        'test-value',
        { domain: 'example.com', path: '/test' }
      );

      expect(state.cookies.length).toBe(1);
      expect(state.cookies[0].name).toBe('test-cookie');
      expect(state.cookies[0].value).toBe('test-value');
      expect(state.cookies[0].domain).toBe('example.com');
      expect(state.cookies[0].path).toBe('/test');
    });

    it('should handle navigation correctly', () => {
      const state = browserHelpers.navigateTo(
        initialState,
        'https://example.com/page',
        'Example Page'
      );

      expect(state.url).toBe('https://example.com/page');
      expect(state.title).toBe('Example Page');
      expect(state.isLoading).toBe(false);
    });

    it('should handle loading state changes correctly', () => {
      const loadingState = browserHelpers.startLoading(initialState);
      expect(loadingState.isLoading).toBe(true);

      const finishedState = browserHelpers.finishLoading(loadingState);
      expect(finishedState.isLoading).toBe(false);
    });

    it('should handle error state changes correctly', () => {
      const errorState = browserHelpers.setError(initialState, true);
      expect(errorState.hasError).toBe(true);

      const noErrorState = browserHelpers.setError(errorState, false);
      expect(noErrorState.hasError).toBe(false);
    });

    it('should handle authentication state changes correctly', () => {
      const authenticatedState = browserHelpers.setAuthenticated(initialState, true);
      expect(authenticatedState.isAuthenticated).toBe(true);

      const unauthenticatedState = browserHelpers.setAuthenticated(authenticatedState, false);
      expect(unauthenticatedState.isAuthenticated).toBe(false);
    });

    it('should clear browser data correctly', () => {
      // Start with state that has data
      const stateWithData = browserFixtures.loggedInPage();

      // Clear all data
      const clearedState = browserHelpers.clearBrowserData(stateWithData);

      expect(clearedState.localStorage).toEqual({});
      expect(clearedState.sessionStorage).toEqual({});
      expect(clearedState.cookies).toEqual([]);
      expect(clearedState.consoleMessages).toEqual([]);
      expect(clearedState.networkRequests).toEqual([]);
    });
  });

  describe('BrowserStateBuilder', () => {
    it('should create builder with clean initial state', () => {
      const builder = new BrowserStateBuilder();
      const state = builder.build();

      expect(state.url).toBe('about:blank');
      expect(state.isAuthenticated).toBe(false);
    });

    it('should accept initial state overrides', () => {
      const builder = new BrowserStateBuilder({
        url: 'https://example.com',
        isAuthenticated: true
      });
      const state = builder.build();

      expect(state.url).toBe('https://example.com');
      expect(state.isAuthenticated).toBe(true);
    });

    it('should support fluent interface pattern', () => {
      const state = new BrowserStateBuilder()
        .withUrl('https://example.com/test')
        .withTitle('Test Page')
        .withLoading(true)
        .withError(false)
        .withAuth(true)
        .withLocalStorage({ 'test': 'value' })
        .withSessionStorage({ 'session': 'data' })
        .withConsoleMessages([{
          type: 'info',
          message: 'Test message'
        }])
        .withNetworkRequests([{
          url: 'https://api.example.com/test',
          method: 'GET',
          status: 200
        }])
        .build();

      expect(state.url).toBe('https://example.com/test');
      expect(state.title).toBe('Test Page');
      expect(state.isLoading).toBe(true);
      expect(state.hasError).toBe(false);
      expect(state.isAuthenticated).toBe(true);
      expect(state.localStorage['test']).toBe('value');
      expect(state.sessionStorage['session']).toBe('data');
      expect(state.consoleMessages[0].message).toBe('Test message');
      expect(state.networkRequests[0].url).toBe('https://api.example.com/test');
    });

    it('should handle console message timestamps', () => {
      const testDate = new Date('2024-01-15T10:00:00Z');
      const state = new BrowserStateBuilder()
        .withConsoleMessages([{
          type: 'log',
          message: 'Test',
          timestamp: testDate
        }, {
          type: 'info',
          message: 'No timestamp'
        }])
        .build();

      expect(state.consoleMessages[0].timestamp).toEqual(testDate);
      expect(state.consoleMessages[1].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('createBrowserState factory function', () => {
    it('should create new builder instance', () => {
      const builder = createBrowserState();
      expect(builder).toBeInstanceOf(BrowserStateBuilder);
    });

    it('should accept initial state overrides', () => {
      const builder = createBrowserState({
        url: 'https://example.com',
        title: 'Example'
      });
      const state = builder.build();

      expect(state.url).toBe('https://example.com');
      expect(state.title).toBe('Example');
    });
  });
});