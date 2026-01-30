/**
 * @fileoverview Tests for browser fixtures and helpers
 *
 * Tests the browserFixtures factory functions and browserHelpers utility functions
 * for creating and manipulating browser state in tests
 */

import { describe, it, expect } from 'vitest';
import { browserFixtures, browserHelpers } from '../browser-fixtures.js';
import type { BrowserState, TestScenario } from '../types.js';

describe('Browser Fixtures', () => {
  describe('browserFixtures factory functions', () => {
    describe('cleanState', () => {
      it('should create a clean initial browser state', () => {
        const state = browserFixtures.cleanState();

        expect(state).toEqual({
          url: 'about:blank',
          title: '',
          isLoading: false,
          hasError: false,
          isAuthenticated: false,
          localStorage: {},
          sessionStorage: {},
          cookies: [],
          consoleMessages: [],
          networkRequests: [],
        });
      });

      it('should accept overrides', () => {
        const overrides = {
          url: 'https://example.com',
          title: 'Test Page',
          isAuthenticated: true,
          localStorage: { test: 'value' },
        };

        const state = browserFixtures.cleanState(overrides);

        expect(state.url).toBe('https://example.com');
        expect(state.title).toBe('Test Page');
        expect(state.isAuthenticated).toBe(true);
        expect(state.localStorage).toEqual({ test: 'value' });
        // Non-overridden properties should keep defaults
        expect(state.isLoading).toBe(false);
        expect(state.hasError).toBe(false);
        expect(state.cookies).toEqual([]);
      });
    });

    describe('loggedInPage', () => {
      it('should create a logged-in user browser state', () => {
        const state = browserFixtures.loggedInPage();

        expect(state.url).toBe('https://app.apex.dev/dashboard');
        expect(state.title).toBe('APEX Dashboard');
        expect(state.isLoading).toBe(false);
        expect(state.hasError).toBe(false);
        expect(state.isAuthenticated).toBe(true);

        // Check authentication data
        expect(state.localStorage['auth-token']).toBe('mock-jwt-token');
        expect(state.localStorage['user-preferences']).toBeDefined();
        expect(state.localStorage['session-id']).toBe('sess_mock_123456789');

        // Check session data
        expect(state.sessionStorage['current-project']).toBe('/users/test/my-project');
        expect(state.sessionStorage['active-agents']).toBe(JSON.stringify(['planner', 'developer']));

        // Check cookies
        expect(state.cookies).toHaveLength(2);
        expect(state.cookies[0].name).toBe('auth-session');
        expect(state.cookies[1].name).toBe('csrf-token');

        // Check console messages
        expect(state.consoleMessages).toHaveLength(2);
        expect(state.consoleMessages[0].type).toBe('info');
        expect(state.consoleMessages[0].message).toBe('APEX Dashboard loaded successfully');
        expect(state.consoleMessages[1].type).toBe('log');

        // Check network requests
        expect(state.networkRequests).toHaveLength(2);
        expect(state.networkRequests[0].url).toBe('https://api.apex.dev/user/profile');
        expect(state.networkRequests[0].method).toBe('GET');
        expect(state.networkRequests[0].status).toBe(200);
        expect(state.networkRequests[1].url).toBe('https://api.apex.dev/projects');
      });

      it('should accept overrides', () => {
        const overrides = {
          url: 'https://custom.example.com',
          localStorage: { 'custom-key': 'custom-value' },
        };

        const state = browserFixtures.loggedInPage(overrides);

        expect(state.url).toBe('https://custom.example.com');
        expect(state.localStorage['custom-key']).toBe('custom-value');
        // Should still preserve auth data from the base fixture
        expect(state.isAuthenticated).toBe(true);
        expect(state.cookies).toHaveLength(2);
      });
    });

    describe('errorPage', () => {
      it('should create an error page browser state', () => {
        const state = browserFixtures.errorPage();

        expect(state.url).toBe('https://app.apex.dev/error');
        expect(state.title).toBe('Error - APEX');
        expect(state.isLoading).toBe(false);
        expect(state.hasError).toBe(true);
        expect(state.isAuthenticated).toBe(false);

        // Check error data in localStorage
        expect(state.localStorage['last-error']).toBeDefined();
        const lastError = JSON.parse(state.localStorage['last-error']);
        expect(lastError.code).toBe(500);
        expect(lastError.message).toBe('Internal Server Error');

        // Check error console messages
        expect(state.consoleMessages).toHaveLength(3);
        expect(state.consoleMessages[0].type).toBe('error');
        expect(state.consoleMessages[1].type).toBe('error');
        expect(state.consoleMessages[2].type).toBe('warn');

        // Check failed network requests
        expect(state.networkRequests).toHaveLength(2);
        expect(state.networkRequests[0].status).toBe(500);
        expect(state.networkRequests[1].status).toBe(500);
      });

      it('should accept overrides', () => {
        const state = browserFixtures.errorPage({
          hasError: false,
          localStorage: { 'custom-error': 'test' },
        });

        expect(state.hasError).toBe(false);
        expect(state.localStorage['custom-error']).toBe('test');
      });
    });

    describe('loadingPage', () => {
      it('should create a loading page browser state', () => {
        const state = browserFixtures.loadingPage();

        expect(state.url).toBe('https://app.apex.dev/loading');
        expect(state.title).toBe('Loading... - APEX');
        expect(state.isLoading).toBe(true);
        expect(state.hasError).toBe(false);
        expect(state.isAuthenticated).toBe(false);

        // Check loading data
        expect(state.localStorage['loading-start-time']).toBeDefined();
        expect(state.sessionStorage['navigation-state']).toBe('loading');

        // Check loading console messages
        expect(state.consoleMessages).toHaveLength(2);
        expect(state.consoleMessages[0].message).toContain('Starting page navigation');
        expect(state.consoleMessages[1].message).toContain('Loading application resources');

        // Check resource loading requests
        expect(state.networkRequests).toHaveLength(2);
        expect(state.networkRequests[0].url).toBe('https://app.apex.dev/bundle.js');
        expect(state.networkRequests[1].url).toBe('https://app.apex.dev/styles.css');
      });

      it('should accept overrides', () => {
        const state = browserFixtures.loadingPage({
          isLoading: false,
          title: 'Custom Loading',
        });

        expect(state.isLoading).toBe(false);
        expect(state.title).toBe('Custom Loading');
      });
    });

    describe('offlinePage', () => {
      it('should create an offline browser state', () => {
        const state = browserFixtures.offlinePage();

        expect(state.url).toBe('https://app.apex.dev/offline');
        expect(state.title).toBe('Offline - APEX');
        expect(state.isLoading).toBe(false);
        expect(state.hasError).toBe(false);
        expect(state.isAuthenticated).toBe(false);

        // Check offline data
        expect(state.localStorage['offline-mode']).toBe('true');
        expect(state.localStorage['last-online']).toBe('2024-01-15T09:45:00Z');
        expect(state.localStorage['cached-data']).toBeDefined();

        // Check offline console messages
        expect(state.consoleMessages).toHaveLength(3);
        expect(state.consoleMessages[0].type).toBe('warn');
        expect(state.consoleMessages[0].message).toContain('Network connection lost');
        expect(state.consoleMessages[1].type).toBe('info');
        expect(state.consoleMessages[2].type).toBe('log');

        // Should have no network requests when offline
        expect(state.networkRequests).toEqual([]);
      });

      it('should accept overrides', () => {
        const state = browserFixtures.offlinePage({
          localStorage: { 'offline-mode': 'false' },
          networkRequests: [{ url: 'test', method: 'GET' }],
        });

        expect(state.localStorage['offline-mode']).toBe('false');
        expect(state.networkRequests).toHaveLength(1);
      });
    });

    describe('permissionDeniedPage', () => {
      it('should create a permission denied browser state', () => {
        const state = browserFixtures.permissionDeniedPage();

        expect(state.url).toBe('https://app.apex.dev/access-denied');
        expect(state.title).toBe('Access Denied - APEX');
        expect(state.isLoading).toBe(false);
        expect(state.hasError).toBe(false);
        expect(state.isAuthenticated).toBe(true); // User is logged in but lacks permissions

        // Check auth data (user is authenticated)
        expect(state.localStorage['auth-token']).toBe('mock-jwt-token');
        expect(state.localStorage['access-level']).toBe('read-only');
        expect(state.sessionStorage['attempted-resource']).toBe('/admin/settings');

        // Check auth cookie
        expect(state.cookies).toHaveLength(1);
        expect(state.cookies[0].name).toBe('auth-session');

        // Check permission denied console messages
        expect(state.consoleMessages).toHaveLength(2);
        expect(state.consoleMessages[0].type).toBe('warn');
        expect(state.consoleMessages[0].message).toContain('Access denied');
        expect(state.consoleMessages[1].type).toBe('info');

        // Check 403 network request
        expect(state.networkRequests).toHaveLength(1);
        expect(state.networkRequests[0].status).toBe(403);
        expect(state.networkRequests[0].url).toBe('https://api.apex.dev/admin/settings');
      });

      it('should accept overrides', () => {
        const state = browserFixtures.permissionDeniedPage({
          isAuthenticated: false,
          localStorage: { 'custom-key': 'value' },
        });

        expect(state.isAuthenticated).toBe(false);
        expect(state.localStorage['custom-key']).toBe('value');
      });
    });
  });

  describe('fromScenario', () => {
    it('should dispatch to correct fixture based on scenario', () => {
      const scenarios: TestScenario[] = [
        'clean-state',
        'logged-in-user',
        'error-state',
        'loading-state',
        'network-offline',
        'permission-denied',
      ];

      for (const scenario of scenarios) {
        const state = browserFixtures.fromScenario(scenario);

        switch (scenario) {
          case 'clean-state':
            expect(state.url).toBe('about:blank');
            expect(state.isAuthenticated).toBe(false);
            break;
          case 'logged-in-user':
            expect(state.url).toBe('https://app.apex.dev/dashboard');
            expect(state.isAuthenticated).toBe(true);
            break;
          case 'error-state':
            expect(state.url).toBe('https://app.apex.dev/error');
            expect(state.hasError).toBe(true);
            break;
          case 'loading-state':
            expect(state.url).toBe('https://app.apex.dev/loading');
            expect(state.isLoading).toBe(true);
            break;
          case 'network-offline':
            expect(state.url).toBe('https://app.apex.dev/offline');
            expect(state.networkRequests).toEqual([]);
            break;
          case 'permission-denied':
            expect(state.url).toBe('https://app.apex.dev/access-denied');
            expect(state.isAuthenticated).toBe(true);
            break;
        }
      }
    });

    it('should accept overrides for any scenario', () => {
      const overrides = {
        title: 'Custom Title',
        localStorage: { custom: 'data' },
      };

      const state = browserFixtures.fromScenario('clean-state', overrides);
      expect(state.title).toBe('Custom Title');
      expect(state.localStorage.custom).toBe('data');
    });

    it('should fall back to clean state for unknown scenarios', () => {
      // @ts-expect-error - Testing unknown scenario
      const state = browserFixtures.fromScenario('unknown-scenario' as TestScenario);
      expect(state.url).toBe('about:blank');
      expect(state.title).toBe('');
    });

    it('should handle empty overrides', () => {
      const state = browserFixtures.fromScenario('logged-in-user', {});
      expect(state.isAuthenticated).toBe(true);
      expect(state.url).toBe('https://app.apex.dev/dashboard');
    });
  });

  describe('override merging', () => {
    it('should merge overrides with base fixture data', () => {
      const state = browserFixtures.loggedInPage({
        localStorage: {
          'new-key': 'new-value',
          'auth-token': 'overridden-token', // This should override the base value
        },
        cookies: [{ name: 'custom-cookie', value: 'custom-value', domain: 'example.com', path: '/' }],
      });

      expect(state.localStorage['new-key']).toBe('new-value');
      expect(state.localStorage['auth-token']).toBe('overridden-token');
      expect(state.cookies).toHaveLength(1);
      expect(state.cookies[0].name).toBe('custom-cookie');
    });

    it('should handle nested object overrides', () => {
      const cleanState = browserFixtures.cleanState({
        localStorage: {
          key1: 'value1',
          key2: 'value2',
        },
      });

      expect(cleanState.localStorage).toEqual({
        key1: 'value1',
        key2: 'value2',
      });
    });
  });
});

describe('Browser Helpers', () => {
  let baseState: BrowserState;

  beforeEach(() => {
    baseState = browserFixtures.cleanState();
  });

  describe('addConsoleMessage', () => {
    it('should add a console message with timestamp', () => {
      const state = browserHelpers.addConsoleMessage(baseState, 'info', 'Test message');

      expect(state.consoleMessages).toHaveLength(1);
      expect(state.consoleMessages[0]).toEqual({
        type: 'info',
        message: 'Test message',
        timestamp: expect.any(Date),
      });
    });

    it('should support all console message types', () => {
      const types: Array<'log' | 'warn' | 'error' | 'info'> = ['log', 'warn', 'error', 'info'];
      let state = baseState;

      for (const type of types) {
        state = browserHelpers.addConsoleMessage(state, type, `${type} message`);
      }

      expect(state.consoleMessages).toHaveLength(4);
      expect(state.consoleMessages.map(msg => msg.type)).toEqual(types);
    });

    it('should preserve existing messages', () => {
      let state = browserHelpers.addConsoleMessage(baseState, 'info', 'First message');
      state = browserHelpers.addConsoleMessage(state, 'log', 'Second message');

      expect(state.consoleMessages).toHaveLength(2);
      expect(state.consoleMessages[0].message).toBe('First message');
      expect(state.consoleMessages[1].message).toBe('Second message');
    });
  });

  describe('addNetworkRequest', () => {
    it('should add a network request with defaults', () => {
      const state = browserHelpers.addNetworkRequest(baseState, 'https://api.example.com/test');

      expect(state.networkRequests).toHaveLength(1);
      expect(state.networkRequests[0]).toEqual({
        url: 'https://api.example.com/test',
        method: 'GET',
        status: undefined,
        headers: undefined,
      });
    });

    it('should accept custom method, status, and headers', () => {
      const state = browserHelpers.addNetworkRequest(
        baseState,
        'https://api.example.com/create',
        'POST',
        201,
        { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' }
      );

      expect(state.networkRequests[0]).toEqual({
        url: 'https://api.example.com/create',
        method: 'POST',
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token',
        },
      });
    });

    it('should preserve existing network requests', () => {
      let state = browserHelpers.addNetworkRequest(baseState, 'https://api.example.com/first');
      state = browserHelpers.addNetworkRequest(state, 'https://api.example.com/second', 'POST');

      expect(state.networkRequests).toHaveLength(2);
      expect(state.networkRequests[0].url).toBe('https://api.example.com/first');
      expect(state.networkRequests[1].url).toBe('https://api.example.com/second');
      expect(state.networkRequests[1].method).toBe('POST');
    });
  });

  describe('setLocalStorage', () => {
    it('should set a localStorage item', () => {
      const state = browserHelpers.setLocalStorage(baseState, 'key1', 'value1');

      expect(state.localStorage).toEqual({
        key1: 'value1',
      });
    });

    it('should preserve existing localStorage items', () => {
      let state = browserHelpers.setLocalStorage(baseState, 'key1', 'value1');
      state = browserHelpers.setLocalStorage(state, 'key2', 'value2');

      expect(state.localStorage).toEqual({
        key1: 'value1',
        key2: 'value2',
      });
    });

    it('should overwrite existing keys', () => {
      let state = browserHelpers.setLocalStorage(baseState, 'key1', 'original');
      state = browserHelpers.setLocalStorage(state, 'key1', 'updated');

      expect(state.localStorage.key1).toBe('updated');
    });
  });

  describe('setSessionStorage', () => {
    it('should set a sessionStorage item', () => {
      const state = browserHelpers.setSessionStorage(baseState, 'session-key', 'session-value');

      expect(state.sessionStorage).toEqual({
        'session-key': 'session-value',
      });
    });

    it('should preserve existing sessionStorage items', () => {
      let state = browserHelpers.setSessionStorage(baseState, 'key1', 'value1');
      state = browserHelpers.setSessionStorage(state, 'key2', 'value2');

      expect(state.sessionStorage).toEqual({
        key1: 'value1',
        key2: 'value2',
      });
    });
  });

  describe('addCookie', () => {
    it('should add a cookie with defaults', () => {
      const state = browserHelpers.addCookie(baseState, 'testCookie', 'testValue');

      expect(state.cookies).toHaveLength(1);
      expect(state.cookies[0]).toEqual({
        name: 'testCookie',
        value: 'testValue',
        domain: 'localhost',
        path: '/',
      });
    });

    it('should accept custom domain and path', () => {
      const state = browserHelpers.addCookie(
        baseState,
        'customCookie',
        'customValue',
        { domain: 'example.com', path: '/app' }
      );

      expect(state.cookies[0]).toEqual({
        name: 'customCookie',
        value: 'customValue',
        domain: 'example.com',
        path: '/app',
      });
    });

    it('should preserve existing cookies', () => {
      let state = browserHelpers.addCookie(baseState, 'cookie1', 'value1');
      state = browserHelpers.addCookie(state, 'cookie2', 'value2');

      expect(state.cookies).toHaveLength(2);
      expect(state.cookies[0].name).toBe('cookie1');
      expect(state.cookies[1].name).toBe('cookie2');
    });
  });

  describe('navigateTo', () => {
    it('should update URL and finish loading', () => {
      const state = browserHelpers.navigateTo(baseState, 'https://example.com/new-page');

      expect(state.url).toBe('https://example.com/new-page');
      expect(state.isLoading).toBe(false);
    });

    it('should accept custom title', () => {
      const state = browserHelpers.navigateTo(baseState, 'https://example.com', 'New Title');

      expect(state.url).toBe('https://example.com');
      expect(state.title).toBe('New Title');
    });

    it('should preserve existing title if not provided', () => {
      const stateWithTitle = { ...baseState, title: 'Original Title' };
      const state = browserHelpers.navigateTo(stateWithTitle, 'https://example.com');

      expect(state.title).toBe('Original Title');
    });
  });

  describe('startLoading', () => {
    it('should set loading state to true', () => {
      const state = browserHelpers.startLoading(baseState);

      expect(state.isLoading).toBe(true);
    });
  });

  describe('finishLoading', () => {
    it('should set loading state to false', () => {
      const loadingState = { ...baseState, isLoading: true };
      const state = browserHelpers.finishLoading(loadingState);

      expect(state.isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error state to true by default', () => {
      const state = browserHelpers.setError(baseState);

      expect(state.hasError).toBe(true);
    });

    it('should accept custom error state', () => {
      const stateWithError = { ...baseState, hasError: true };
      const state = browserHelpers.setError(stateWithError, false);

      expect(state.hasError).toBe(false);
    });
  });

  describe('setAuthenticated', () => {
    it('should set authentication status', () => {
      const state = browserHelpers.setAuthenticated(baseState, true);

      expect(state.isAuthenticated).toBe(true);
    });

    it('should update authentication status', () => {
      const authenticatedState = { ...baseState, isAuthenticated: true };
      const state = browserHelpers.setAuthenticated(authenticatedState, false);

      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('clearBrowserData', () => {
    it('should clear all browser data', () => {
      const populatedState = browserFixtures.loggedInPage();
      const state = browserHelpers.clearBrowserData(populatedState);

      expect(state.localStorage).toEqual({});
      expect(state.sessionStorage).toEqual({});
      expect(state.cookies).toEqual([]);
      expect(state.consoleMessages).toEqual([]);
      expect(state.networkRequests).toEqual([]);

      // Should preserve other properties
      expect(state.url).toBe(populatedState.url);
      expect(state.title).toBe(populatedState.title);
      expect(state.isLoading).toBe(populatedState.isLoading);
      expect(state.hasError).toBe(populatedState.hasError);
      expect(state.isAuthenticated).toBe(populatedState.isAuthenticated);
    });
  });
});


describe('Edge Cases', () => {
  it('should handle empty overrides gracefully', () => {
    const state = browserFixtures.cleanState({});
    expect(state.url).toBe('about:blank');
  });

  it('should handle undefined overrides', () => {
    const state = browserFixtures.loggedInPage(undefined);
    expect(state.isAuthenticated).toBe(true);
  });

  it('should handle unknown scenarios in fromScenario', () => {
    // @ts-expect-error - Testing edge case
    const state = browserFixtures.fromScenario('invalid-scenario');
    expect(state.url).toBe('about:blank');
  });

  it('should handle null values in helpers', () => {
    const baseState = browserFixtures.cleanState();
    const state = browserHelpers.addConsoleMessage(baseState, 'info', '');
    expect(state.consoleMessages[0].message).toBe('');
  });

  it('should preserve immutability of original state', () => {
    const originalState = browserFixtures.cleanState();
    const newState = browserHelpers.setLocalStorage(originalState, 'test', 'value');

    expect(originalState.localStorage).toEqual({});
    expect(newState.localStorage.test).toBe('value');
  });
});