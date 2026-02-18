/**
 * @fileoverview API Contract Validation Tests for Browser State Fixtures
 *
 * This test suite validates that the browser state fixtures API strictly adheres to
 * the contract defined in docs/browser-state-fixtures-api.md. Every example,
 * parameter type, return type, and behavior described in the documentation is
 * tested to ensure accuracy and consistency.
 *
 * Test Categories:
 * - Exact API signature validation
 * - Documentation example verification
 * - Parameter type enforcement
 * - Return type validation
 * - Default value verification
 * - API method availability
 * - Interface compliance
 */

import { describe, it, expect } from 'vitest';
import {
  browserFixtures,
  browserHelpers,
  BrowserStateBuilder,
  createBrowserState,
} from '../browser-fixtures.js';
import type { BrowserState, TestScenario } from '../types.js';

describe('Browser State Fixtures API Contract Validation', () => {
  describe('API Availability and Exports', () => {
    it('should export all documented functions and classes', () => {
      // Verify browserFixtures exists and has all documented methods
      expect(browserFixtures).toBeDefined();
      expect(typeof browserFixtures.cleanState).toBe('function');
      expect(typeof browserFixtures.loggedInPage).toBe('function');
      expect(typeof browserFixtures.errorPage).toBe('function');
      expect(typeof browserFixtures.loadingPage).toBe('function');
      expect(typeof browserFixtures.offlinePage).toBe('function');
      expect(typeof browserFixtures.permissionDeniedPage).toBe('function');
      expect(typeof browserFixtures.fromScenario).toBe('function');

      // Verify browserHelpers exists and has all documented methods
      expect(browserHelpers).toBeDefined();
      expect(typeof browserHelpers.addConsoleMessage).toBe('function');
      expect(typeof browserHelpers.addNetworkRequest).toBe('function');
      expect(typeof browserHelpers.setLocalStorage).toBe('function');
      expect(typeof browserHelpers.setSessionStorage).toBe('function');
      expect(typeof browserHelpers.addCookie).toBe('function');
      expect(typeof browserHelpers.navigateTo).toBe('function');
      expect(typeof browserHelpers.startLoading).toBe('function');
      expect(typeof browserHelpers.finishLoading).toBe('function');
      expect(typeof browserHelpers.setError).toBe('function');
      expect(typeof browserHelpers.setAuthenticated).toBe('function');
      expect(typeof browserHelpers.clearBrowserData).toBe('function');

      // Verify BrowserStateBuilder class and createBrowserState factory
      expect(BrowserStateBuilder).toBeDefined();
      expect(typeof createBrowserState).toBe('function');
    });

    it('should count exactly 11 browserHelpers methods as documented', () => {
      const helperMethods = Object.keys(browserHelpers);
      expect(helperMethods).toHaveLength(11);

      const expectedMethods = [
        'addConsoleMessage',
        'addNetworkRequest',
        'setLocalStorage',
        'setSessionStorage',
        'addCookie',
        'navigateTo',
        'startLoading',
        'finishLoading',
        'setError',
        'setAuthenticated',
        'clearBrowserData'
      ];

      expectedMethods.forEach(method => {
        expect(helperMethods).toContain(method);
      });
    });
  });

  describe('BrowserState Interface Contract', () => {
    it('should match the documented interface structure exactly', () => {
      const state = browserFixtures.cleanState();

      // Verify all documented properties exist with correct types
      expect(typeof state.url).toBe('string');
      expect(typeof state.title).toBe('string');
      expect(typeof state.isLoading).toBe('boolean');
      expect(typeof state.hasError).toBe('boolean');
      expect(typeof state.isAuthenticated).toBe('boolean');

      // localStorage should be Record<string, string>
      expect(typeof state.localStorage).toBe('object');
      expect(state.localStorage).not.toBeInstanceOf(Array);
      expect(state.localStorage).not.toBeNull();

      // sessionStorage should be Record<string, string>
      expect(typeof state.sessionStorage).toBe('object');
      expect(state.sessionStorage).not.toBeInstanceOf(Array);
      expect(state.sessionStorage).not.toBeNull();

      // cookies should be array with correct structure
      expect(Array.isArray(state.cookies)).toBe(true);

      // consoleMessages should be array with correct structure
      expect(Array.isArray(state.consoleMessages)).toBe(true);

      // networkRequests should be array with correct structure
      expect(Array.isArray(state.networkRequests)).toBe(true);
    });

    it('should validate cookie object structure matches documentation', () => {
      const state = browserFixtures.loggedInPage();

      state.cookies.forEach(cookie => {
        expect(typeof cookie.name).toBe('string');
        expect(typeof cookie.value).toBe('string');

        // Optional properties should be string if present, undefined if not
        if (cookie.domain !== undefined) {
          expect(typeof cookie.domain).toBe('string');
        }
        if (cookie.path !== undefined) {
          expect(typeof cookie.path).toBe('string');
        }
      });
    });

    it('should validate console message structure matches documentation', () => {
      const state = browserFixtures.loggedInPage();

      state.consoleMessages.forEach(message => {
        expect(typeof message.type).toBe('string');
        expect(['log', 'warn', 'error', 'info']).toContain(message.type);
        expect(typeof message.message).toBe('string');
        expect(message.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should validate network request structure matches documentation', () => {
      const state = browserFixtures.loggedInPage();

      state.networkRequests.forEach(request => {
        expect(typeof request.url).toBe('string');
        expect(typeof request.method).toBe('string');

        // Optional properties
        if (request.status !== undefined) {
          expect(typeof request.status).toBe('number');
        }
        if (request.headers !== undefined) {
          expect(typeof request.headers).toBe('object');
          expect(request.headers).not.toBeInstanceOf(Array);
          Object.values(request.headers).forEach(value => {
            expect(typeof value).toBe('string');
          });
        }
      });
    });
  });

  describe('TestScenario Type Contract', () => {
    it('should support all documented TestScenario values', () => {
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

      documentedScenarios.forEach(scenario => {
        // Should not throw when passed to fromScenario
        expect(() => {
          browserFixtures.fromScenario(scenario);
        }).not.toThrow();
      });
    });
  });

  describe('Documentation Examples Contract', () => {
    describe('Basic Usage Examples', () => {
      it('should execute basic usage example exactly as documented', () => {
        // From docs: Basic Usage section

        // Create a clean initial state
        const cleanState = browserFixtures.cleanState();
        expect(cleanState.url).toBe('about:blank');
        expect(cleanState.isAuthenticated).toBe(false);

        // Create a logged-in user state
        const loggedInState = browserFixtures.loggedInPage();
        expect(loggedInState.isAuthenticated).toBe(true);
        expect(loggedInState.url).toBe('https://app.apex.dev/dashboard');

        // Create a state with custom overrides
        const customState = browserFixtures.loggedInPage({
          url: 'https://custom.example.com',
          localStorage: { theme: 'dark' }
        });
        expect(customState.url).toBe('https://custom.example.com');
        expect(customState.localStorage.theme).toBe('dark');
        // Should still preserve auth state
        expect(customState.isAuthenticated).toBe(true);
      });
    });

    describe('cleanState() Documentation Examples', () => {
      it('should execute cleanState examples exactly as documented', () => {
        // Basic clean state example
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
        // Non-overridden properties should keep defaults
        expect(customState.isAuthenticated).toBe(false);
      });
    });

    describe('loggedInPage() Documentation Examples', () => {
      it('should execute loggedInPage examples exactly as documented', () => {
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
        expect(customState.isAuthenticated).toBe(true);
      });
    });

    describe('errorPage() Documentation Examples', () => {
      it('should execute errorPage examples exactly as documented', () => {
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

    describe('loadingPage() Documentation Examples', () => {
      it('should execute loadingPage examples exactly as documented', () => {
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

    describe('offlinePage() Documentation Examples', () => {
      it('should execute offlinePage examples exactly as documented', () => {
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

    describe('permissionDeniedPage() Documentation Examples', () => {
      it('should execute permissionDeniedPage examples exactly as documented', () => {
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

    describe('fromScenario() Documentation Examples', () => {
      it('should execute fromScenario examples exactly as documented', () => {
        // Create state from scenario example
        const state = browserFixtures.fromScenario('logged-in-user');
        expect(state.isAuthenticated).toBe(true);

        // Create state from scenario with overrides example
        const customState = browserFixtures.fromScenario('error-state', {
          url: 'https://custom.example.com/error'
        });
        expect(customState.url).toBe('https://custom.example.com/error');

        // Use in parameterized tests example
        const scenarios: TestScenario[] = ['clean-state', 'logged-in-user', 'error-state'];
        scenarios.forEach(scenario => {
          const scenarioState = browserFixtures.fromScenario(scenario);
          expect(scenarioState).toBeDefined();
          expect(typeof scenarioState.url).toBe('string');
          expect(typeof scenarioState.isAuthenticated).toBe('boolean');
        });
      });
    });

    describe('browserHelpers Documentation Examples', () => {
      it('should execute addConsoleMessage example exactly as documented', () => {
        const state = browserHelpers.addConsoleMessage(
          browserFixtures.cleanState(),
          'error',
          'Uncaught TypeError: Cannot read property of undefined'
        );

        expect(state.consoleMessages).toHaveLength(1);
        expect(state.consoleMessages[0].type).toBe('error');
        expect(state.consoleMessages[0].message).toBe('Uncaught TypeError: Cannot read property of undefined');
        expect(state.consoleMessages[0].timestamp).toBeInstanceOf(Date);
      });

      it('should execute addNetworkRequest example exactly as documented', () => {
        let state = browserFixtures.cleanState();

        // Add a successful GET request
        state = browserHelpers.addNetworkRequest(
          state,
          'https://api.example.com/users',
          'GET',
          200,
          { 'Content-Type': 'application/json' }
        );

        // Add a failed POST request
        state = browserHelpers.addNetworkRequest(
          state,
          'https://api.example.com/login',
          'POST',
          401
        );

        expect(state.networkRequests).toHaveLength(2);
        expect(state.networkRequests[0].status).toBe(200);
        expect(state.networkRequests[0].headers).toEqual({ 'Content-Type': 'application/json' });
        expect(state.networkRequests[1].status).toBe(401);
      });

      it('should execute storage helper examples exactly as documented', () => {
        let state = browserFixtures.cleanState();

        // setLocalStorage example
        state = browserHelpers.setLocalStorage(state, 'theme', 'dark');
        state = browserHelpers.setLocalStorage(state, 'auth-token', 'jwt-token-123');

        expect(state.localStorage['theme']).toBe('dark');
        expect(state.localStorage['auth-token']).toBe('jwt-token-123');

        // setSessionStorage example
        state = browserHelpers.setSessionStorage(state, 'current-tab', 'dashboard');
        state = browserHelpers.setSessionStorage(state, 'temp-data', 'temp-value');

        expect(state.sessionStorage['current-tab']).toBe('dashboard');
        expect(state.sessionStorage['temp-data']).toBe('temp-value');
      });

      it('should execute addCookie examples exactly as documented', () => {
        let state = browserFixtures.cleanState();

        // Add a basic cookie
        state = browserHelpers.addCookie(state, 'session-id', 'sess_123');

        // Add a cookie with custom domain and path
        state = browserHelpers.addCookie(
          state,
          'tracking-id',
          'track_456',
          { domain: 'example.com', path: '/analytics' }
        );

        expect(state.cookies).toHaveLength(2);
        expect(state.cookies[0].name).toBe('session-id');
        expect(state.cookies[0].value).toBe('sess_123');
        expect(state.cookies[0].domain).toBe('localhost'); // Default
        expect(state.cookies[0].path).toBe('/'); // Default

        expect(state.cookies[1].name).toBe('tracking-id');
        expect(state.cookies[1].domain).toBe('example.com');
        expect(state.cookies[1].path).toBe('/analytics');
      });

      it('should execute navigation examples exactly as documented', () => {
        let state = browserFixtures.cleanState();

        // Navigate to a new page
        state = browserHelpers.navigateTo(
          state,
          'https://app.example.com/dashboard',
          'Dashboard - Example App'
        );

        expect(state.url).toBe('https://app.example.com/dashboard');
        expect(state.title).toBe('Dashboard - Example App');
        expect(state.isLoading).toBe(false);
      });

      it('should execute loading state examples exactly as documented', () => {
        let state = browserFixtures.cleanState();

        state = browserHelpers.startLoading(state);
        expect(state.isLoading).toBe(true);

        // Simulate loading completion
        state = browserHelpers.finishLoading(state);
        expect(state.isLoading).toBe(false);
      });

      it('should execute error state examples exactly as documented', () => {
        let state = browserFixtures.cleanState();

        // Set error state
        state = browserHelpers.setError(state, true);
        expect(state.hasError).toBe(true);

        // Clear error state
        state = browserHelpers.setError(state, false);
        expect(state.hasError).toBe(false);
      });

      it('should execute authentication examples exactly as documented', () => {
        let state = browserFixtures.cleanState(); // isAuthenticated: false

        // Simulate user login
        state = browserHelpers.setAuthenticated(state, true);
        expect(state.isAuthenticated).toBe(true);

        // Simulate user logout
        state = browserHelpers.setAuthenticated(state, false);
        expect(state.isAuthenticated).toBe(false);
      });

      it('should execute clearBrowserData example exactly as documented', () => {
        let state = browserFixtures.loggedInPage(); // Has auth data, cookies, etc.

        state = browserHelpers.clearBrowserData(state);

        expect(state.localStorage).toEqual({});
        expect(state.sessionStorage).toEqual({});
        expect(state.cookies).toEqual([]);
        expect(state.consoleMessages).toEqual([]);
        expect(state.networkRequests).toEqual([]);
      });
    });

    describe('BrowserStateBuilder Documentation Examples', () => {
      it('should execute constructor examples exactly as documented', () => {
        // Start with clean state
        const builder1 = new BrowserStateBuilder();
        const state1 = builder1.build();
        expect(state1.url).toBe('about:blank');
        expect(state1.isAuthenticated).toBe(false);

        // Start with custom initial state
        const builder2 = new BrowserStateBuilder({
          url: 'https://example.com',
          isAuthenticated: true
        });
        const state2 = builder2.build();
        expect(state2.url).toBe('https://example.com');
        expect(state2.isAuthenticated).toBe(true);
      });

      it('should execute method chaining examples exactly as documented', () => {
        const state = new BrowserStateBuilder()
          .withUrl('https://app.example.com/dashboard')
          .withTitle('My Dashboard')
          .withAuth(true)
          .withLocalStorage({ 'auth-token': 'jwt-123', 'theme': 'dark' })
          .withLocalStorage({ 'lang': 'en' }) // Should merge
          .withSessionStorage({ 'current-tab': 'dashboard' })
          .withConsoleMessages([
            { type: 'info', message: 'App initialized' },
            { type: 'error', message: 'Failed to load config', timestamp: new Date('2024-01-15T10:00:00Z') }
          ])
          .withNetworkRequests([
            { url: 'https://api.example.com/users', method: 'GET', status: 200 },
            { url: 'https://api.example.com/login', method: 'POST', status: 401 }
          ])
          .build();

        expect(state.url).toBe('https://app.example.com/dashboard');
        expect(state.title).toBe('My Dashboard');
        expect(state.isAuthenticated).toBe(true);
        expect(state.localStorage['auth-token']).toBe('jwt-123');
        expect(state.localStorage['theme']).toBe('dark');
        expect(state.localStorage['lang']).toBe('en');
        expect(state.sessionStorage['current-tab']).toBe('dashboard');
        expect(state.consoleMessages).toHaveLength(2);
        expect(state.consoleMessages[0].type).toBe('info');
        expect(state.consoleMessages[1].timestamp).toEqual(new Date('2024-01-15T10:00:00Z'));
        expect(state.networkRequests).toHaveLength(2);
        expect(state.networkRequests[0].status).toBe(200);
      });

      it('should execute createBrowserState examples exactly as documented', () => {
        // Using the factory function
        const state = createBrowserState()
          .withUrl('https://example.com')
          .withAuth(true)
          .build();

        expect(state.url).toBe('https://example.com');
        expect(state.isAuthenticated).toBe(true);

        // With initial state
        const state2 = createBrowserState({ isLoading: true })
          .withUrl('https://loading.example.com')
          .build();

        expect(state2.isLoading).toBe(true);
        expect(state2.url).toBe('https://loading.example.com');
      });
    });

    describe('Comparison Examples (Helpers vs Builder)', () => {
      it('should demonstrate helpers vs builder equivalence as documented', () => {
        // Using browserHelpers - functional style
        let state1 = browserFixtures.cleanState();
        state1 = browserHelpers.setAuthenticated(state1, true);
        state1 = browserHelpers.setLocalStorage(state1, 'theme', 'dark');
        state1 = browserHelpers.addConsoleMessage(state1, 'info', 'User logged in');

        // Using BrowserStateBuilder - fluent style
        const state2 = createBrowserState()
          .withAuth(true)
          .withLocalStorage({ 'theme': 'dark' })
          .withConsoleMessages([{ type: 'info', message: 'User logged in' }])
          .build();

        // Both should produce equivalent results
        expect(state1.isAuthenticated).toBe(state2.isAuthenticated);
        expect(state1.localStorage['theme']).toBe(state2.localStorage['theme']);
        expect(state1.consoleMessages[0].type).toBe(state2.consoleMessages[0].type);
        expect(state1.consoleMessages[0].message).toBe(state2.consoleMessages[0].message);
      });
    });
  });

  describe('Parameter Type Contract Validation', () => {
    describe('browserHelpers parameter types', () => {
      it('should validate addConsoleMessage parameter types', () => {
        const state = browserFixtures.cleanState();

        // Valid types should work
        const validTypes: Array<'log' | 'warn' | 'error' | 'info'> = ['log', 'warn', 'error', 'info'];
        validTypes.forEach(type => {
          expect(() => {
            browserHelpers.addConsoleMessage(state, type, 'Test message');
          }).not.toThrow();
        });

        // Message should be string
        expect(() => {
          browserHelpers.addConsoleMessage(state, 'info', 'Valid string message');
        }).not.toThrow();
      });

      it('should validate addNetworkRequest parameter types', () => {
        const state = browserFixtures.cleanState();

        // URL (string) is required
        expect(() => {
          browserHelpers.addNetworkRequest(state, 'https://example.com');
        }).not.toThrow();

        // Method defaults to 'GET' when not provided
        const result1 = browserHelpers.addNetworkRequest(state, 'https://example.com');
        expect(result1.networkRequests[0].method).toBe('GET');

        // Custom method should work
        const result2 = browserHelpers.addNetworkRequest(state, 'https://example.com', 'POST');
        expect(result2.networkRequests[0].method).toBe('POST');

        // Status should be number when provided
        const result3 = browserHelpers.addNetworkRequest(state, 'https://example.com', 'GET', 200);
        expect(result3.networkRequests[0].status).toBe(200);

        // Headers should be Record<string, string>
        const result4 = browserHelpers.addNetworkRequest(
          state,
          'https://example.com',
          'GET',
          200,
          { 'Content-Type': 'application/json' }
        );
        expect(result4.networkRequests[0].headers).toEqual({ 'Content-Type': 'application/json' });
      });

      it('should validate cookie options parameter types', () => {
        const state = browserFixtures.cleanState();

        // Options should be optional
        const result1 = browserHelpers.addCookie(state, 'test', 'value');
        expect(result1.cookies[0].domain).toBe('localhost'); // Default
        expect(result1.cookies[0].path).toBe('/'); // Default

        // Options should accept domain and path as strings
        const result2 = browserHelpers.addCookie(state, 'test', 'value', {
          domain: 'example.com',
          path: '/api'
        });
        expect(result2.cookies[0].domain).toBe('example.com');
        expect(result2.cookies[0].path).toBe('/api');
      });

      it('should validate navigateTo parameter types', () => {
        const state = browserFixtures.cleanState();

        // URL is required, title is optional
        const result1 = browserHelpers.navigateTo(state, 'https://example.com');
        expect(result1.url).toBe('https://example.com');

        // Title should be optional string
        const result2 = browserHelpers.navigateTo(state, 'https://example.com', 'Page Title');
        expect(result2.url).toBe('https://example.com');
        expect(result2.title).toBe('Page Title');
      });

      it('should validate setError parameter types', () => {
        const state = browserFixtures.cleanState();

        // hasError defaults to true when not provided
        const result1 = browserHelpers.setError(state);
        expect(result1.hasError).toBe(true);

        // hasError can be explicitly set to boolean
        const result2 = browserHelpers.setError(state, false);
        expect(result2.hasError).toBe(false);
      });
    });

    describe('BrowserStateBuilder parameter types', () => {
      it('should validate withConsoleMessages parameter types', () => {
        const builder = new BrowserStateBuilder();

        // Should accept array of console message objects
        const messages = [
          { type: 'log' as const, message: 'Test log' },
          { type: 'error' as const, message: 'Test error', timestamp: new Date('2024-01-01T10:00:00Z') }
        ];

        expect(() => {
          builder.withConsoleMessages(messages);
        }).not.toThrow();

        const state = builder.build();
        expect(state.consoleMessages).toHaveLength(2);
        expect(state.consoleMessages[1].timestamp).toEqual(new Date('2024-01-01T10:00:00Z'));
      });

      it('should validate withNetworkRequests parameter types', () => {
        const builder = new BrowserStateBuilder();

        // Should accept array of network request objects
        const requests = [
          { url: 'https://api.test.com/data', method: 'GET', status: 200, headers: { 'Content-Type': 'application/json' } },
          { url: 'https://api.test.com/post', method: 'POST' } // Minimal required fields
        ];

        expect(() => {
          builder.withNetworkRequests(requests);
        }).not.toThrow();

        const state = builder.build();
        expect(state.networkRequests).toHaveLength(2);
        expect(state.networkRequests[0].status).toBe(200);
        expect(state.networkRequests[1].status).toBeUndefined();
      });
    });
  });

  describe('Return Type Contract Validation', () => {
    it('should return BrowserState from all browserFixtures methods', () => {
      const methods = [
        () => browserFixtures.cleanState(),
        () => browserFixtures.loggedInPage(),
        () => browserFixtures.errorPage(),
        () => browserFixtures.loadingPage(),
        () => browserFixtures.offlinePage(),
        () => browserFixtures.permissionDeniedPage(),
        () => browserFixtures.fromScenario('clean-state'),
      ];

      methods.forEach(method => {
        const result = method();

        // Should have all BrowserState properties
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('isLoading');
        expect(result).toHaveProperty('hasError');
        expect(result).toHaveProperty('isAuthenticated');
        expect(result).toHaveProperty('localStorage');
        expect(result).toHaveProperty('sessionStorage');
        expect(result).toHaveProperty('cookies');
        expect(result).toHaveProperty('consoleMessages');
        expect(result).toHaveProperty('networkRequests');
      });
    });

    it('should return BrowserState from all browserHelpers methods', () => {
      const baseState = browserFixtures.cleanState();

      const results = [
        browserHelpers.addConsoleMessage(baseState, 'info', 'test'),
        browserHelpers.addNetworkRequest(baseState, 'https://example.com'),
        browserHelpers.setLocalStorage(baseState, 'key', 'value'),
        browserHelpers.setSessionStorage(baseState, 'key', 'value'),
        browserHelpers.addCookie(baseState, 'name', 'value'),
        browserHelpers.navigateTo(baseState, 'https://example.com'),
        browserHelpers.startLoading(baseState),
        browserHelpers.finishLoading(baseState),
        browserHelpers.setError(baseState),
        browserHelpers.setAuthenticated(baseState, true),
        browserHelpers.clearBrowserData(baseState),
      ];

      results.forEach(result => {
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('isLoading');
        expect(result).toHaveProperty('hasError');
        expect(result).toHaveProperty('isAuthenticated');
        expect(result).toHaveProperty('localStorage');
        expect(result).toHaveProperty('sessionStorage');
        expect(result).toHaveProperty('cookies');
        expect(result).toHaveProperty('consoleMessages');
        expect(result).toHaveProperty('networkRequests');
      });
    });

    it('should return BrowserStateBuilder from createBrowserState', () => {
      const builder = createBrowserState();
      expect(builder).toBeInstanceOf(BrowserStateBuilder);
    });

    it('should return BrowserState from BrowserStateBuilder.build()', () => {
      const builder = new BrowserStateBuilder();
      const state = builder.build();

      // Should be a valid BrowserState
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

    it('should return this from all BrowserStateBuilder chainable methods', () => {
      const builder = new BrowserStateBuilder();

      // All these should return the builder instance for chaining
      expect(builder.withUrl('test')).toBe(builder);
      expect(builder.withTitle('test')).toBe(builder);
      expect(builder.withLoading(true)).toBe(builder);
      expect(builder.withError(false)).toBe(builder);
      expect(builder.withAuth(true)).toBe(builder);
      expect(builder.withLocalStorage({})).toBe(builder);
      expect(builder.withSessionStorage({})).toBe(builder);
      expect(builder.withConsoleMessages([])).toBe(builder);
      expect(builder.withNetworkRequests([])).toBe(builder);
    });
  });
});