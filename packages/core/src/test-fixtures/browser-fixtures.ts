/**
 * @fileoverview Browser State Fixtures
 *
 * This module provides predefined browser state fixtures for common testing scenarios:
 * - Logged-in user state
 * - Error page state
 * - Loading state
 * - Network offline state
 * - Clean initial state
 *
 * @example Basic usage:
 * ```typescript
 * import { browserFixtures } from '@apex/core/test-fixtures';
 *
 * it('should handle logged in user', () => {
 *   const state = browserFixtures.loggedInPage();
 *   expect(state.isAuthenticated).toBe(true);
 * });
 * ```
 *
 * @example Custom state:
 * ```typescript
 * const customState = browserFixtures.loggedInPage({
 *   url: 'https://example.com/dashboard',
 *   localStorage: { theme: 'dark' }
 * });
 * ```
 */

import type { BrowserState, TestScenario } from './types.js';

/**
 * Collection of common browser state fixtures
 */
export const browserFixtures = {
  /**
   * Clean initial browser state (no user data, fresh start)
   */
  cleanState(overrides: Partial<BrowserState> = {}): BrowserState {
    return {
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
      ...overrides,
    };
  },

  /**
   * Logged-in user browser state with authentication data
   */
  loggedInPage(overrides: Partial<BrowserState> = {}): BrowserState {
    return {
      url: 'https://app.apex.dev/dashboard',
      title: 'APEX Dashboard',
      isLoading: false,
      hasError: false,
      isAuthenticated: true,
      localStorage: {
        'auth-token': 'mock-jwt-token',
        'user-preferences': JSON.stringify({
          theme: 'light',
          notifications: true,
        }),
        'session-id': 'sess_mock_123456789',
      },
      sessionStorage: {
        'current-project': '/users/test/my-project',
        'active-agents': JSON.stringify(['planner', 'developer']),
      },
      cookies: [
        {
          name: 'auth-session',
          value: 'mock-session-cookie',
          domain: 'app.apex.dev',
          path: '/',
        },
        {
          name: 'csrf-token',
          value: 'mock-csrf-token',
          domain: 'app.apex.dev',
          path: '/',
        },
      ],
      consoleMessages: [
        {
          type: 'info',
          message: 'APEX Dashboard loaded successfully',
          timestamp: new Date('2024-01-15T10:00:00Z'),
        },
        {
          type: 'log',
          message: 'User authenticated: test-user@example.com',
          timestamp: new Date('2024-01-15T10:00:01Z'),
        },
      ],
      networkRequests: [
        {
          url: 'https://api.apex.dev/user/profile',
          method: 'GET',
          status: 200,
          headers: {
            'Authorization': 'Bearer mock-jwt-token',
            'Content-Type': 'application/json',
          },
        },
        {
          url: 'https://api.apex.dev/projects',
          method: 'GET',
          status: 200,
          headers: {
            'Authorization': 'Bearer mock-jwt-token',
          },
        },
      ],
      ...overrides,
    };
  },

  /**
   * Error page browser state (network error, 500 error, etc.)
   */
  errorPage(overrides: Partial<BrowserState> = {}): BrowserState {
    return {
      url: 'https://app.apex.dev/error',
      title: 'Error - APEX',
      isLoading: false,
      hasError: true,
      isAuthenticated: false, // Often errors clear auth state
      localStorage: {
        'last-error': JSON.stringify({
          code: 500,
          message: 'Internal Server Error',
          timestamp: '2024-01-15T10:30:00Z',
        }),
      },
      sessionStorage: {},
      cookies: [],
      consoleMessages: [
        {
          type: 'error',
          message: 'Failed to fetch user data: NetworkError',
          timestamp: new Date('2024-01-15T10:30:00Z'),
        },
        {
          type: 'error',
          message: 'API request failed with status 500',
          timestamp: new Date('2024-01-15T10:30:01Z'),
        },
        {
          type: 'warn',
          message: 'Falling back to cached data',
          timestamp: new Date('2024-01-15T10:30:02Z'),
        },
      ],
      networkRequests: [
        {
          url: 'https://api.apex.dev/user/profile',
          method: 'GET',
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
        {
          url: 'https://api.apex.dev/projects',
          method: 'GET',
          status: 500,
        },
      ],
      ...overrides,
    };
  },

  /**
   * Loading state browser state (initial load, navigation in progress)
   */
  loadingPage(overrides: Partial<BrowserState> = {}): BrowserState {
    return {
      url: 'https://app.apex.dev/loading',
      title: 'Loading... - APEX',
      isLoading: true,
      hasError: false,
      isAuthenticated: false, // Unknown during loading
      localStorage: {
        'loading-start-time': Date.now().toString(),
      },
      sessionStorage: {
        'navigation-state': 'loading',
      },
      cookies: [],
      consoleMessages: [
        {
          type: 'info',
          message: 'Starting page navigation...',
          timestamp: new Date('2024-01-15T10:15:00Z'),
        },
        {
          type: 'log',
          message: 'Loading application resources',
          timestamp: new Date('2024-01-15T10:15:01Z'),
        },
      ],
      networkRequests: [
        {
          url: 'https://app.apex.dev/bundle.js',
          method: 'GET',
          status: 200,
          headers: {
            'Content-Type': 'application/javascript',
          },
        },
        {
          url: 'https://app.apex.dev/styles.css',
          method: 'GET',
          status: 200,
          headers: {
            'Content-Type': 'text/css',
          },
        },
      ],
      ...overrides,
    };
  },

  /**
   * Network offline browser state
   */
  offlinePage(overrides: Partial<BrowserState> = {}): BrowserState {
    return {
      url: 'https://app.apex.dev/offline',
      title: 'Offline - APEX',
      isLoading: false,
      hasError: false, // Not exactly an error, just offline
      isAuthenticated: false, // Cannot verify when offline
      localStorage: {
        'offline-mode': 'true',
        'last-online': '2024-01-15T09:45:00Z',
        'cached-data': JSON.stringify({
          projects: [],
          profile: null,
        }),
      },
      sessionStorage: {},
      cookies: [],
      consoleMessages: [
        {
          type: 'warn',
          message: 'Network connection lost',
          timestamp: new Date('2024-01-15T09:45:00Z'),
        },
        {
          type: 'info',
          message: 'Switched to offline mode',
          timestamp: new Date('2024-01-15T09:45:01Z'),
        },
        {
          type: 'log',
          message: 'Using cached data where available',
          timestamp: new Date('2024-01-15T09:45:02Z'),
        },
      ],
      networkRequests: [], // No requests when offline
      ...overrides,
    };
  },

  /**
   * Permission denied state (user lacks access)
   */
  permissionDeniedPage(overrides: Partial<BrowserState> = {}): BrowserState {
    return {
      url: 'https://app.apex.dev/access-denied',
      title: 'Access Denied - APEX',
      isLoading: false,
      hasError: false, // Not a system error, just access denied
      isAuthenticated: true, // User is logged in but lacks permissions
      localStorage: {
        'auth-token': 'mock-jwt-token',
        'access-level': 'read-only',
      },
      sessionStorage: {
        'attempted-resource': '/admin/settings',
      },
      cookies: [
        {
          name: 'auth-session',
          value: 'mock-session-cookie',
          domain: 'app.apex.dev',
          path: '/',
        },
      ],
      consoleMessages: [
        {
          type: 'warn',
          message: 'Access denied: insufficient permissions for /admin/settings',
          timestamp: new Date('2024-01-15T11:00:00Z'),
        },
        {
          type: 'info',
          message: 'User role: viewer, required role: admin',
          timestamp: new Date('2024-01-15T11:00:01Z'),
        },
      ],
      networkRequests: [
        {
          url: 'https://api.apex.dev/admin/settings',
          method: 'GET',
          status: 403,
          headers: {
            'Authorization': 'Bearer mock-jwt-token',
          },
        },
      ],
      ...overrides,
    };
  },

  /**
   * Creates a browser state for a specific scenario
   */
  fromScenario(scenario: TestScenario, overrides: Partial<BrowserState> = {}): BrowserState {
    switch (scenario) {
      case 'clean-state':
        return this.cleanState(overrides);
      case 'logged-in-user':
        return this.loggedInPage(overrides);
      case 'error-state':
        return this.errorPage(overrides);
      case 'loading-state':
        return this.loadingPage(overrides);
      case 'network-offline':
        return this.offlinePage(overrides);
      case 'permission-denied':
        return this.permissionDeniedPage(overrides);
      default:
        return this.cleanState(overrides);
    }
  },
};

/**
 * Helper functions for browser state manipulation
 */
export const browserHelpers = {
  /**
   * Adds a console message to browser state
   */
  addConsoleMessage(
    state: BrowserState,
    type: 'log' | 'warn' | 'error' | 'info',
    message: string
  ): BrowserState {
    return {
      ...state,
      consoleMessages: [
        ...state.consoleMessages,
        {
          type,
          message,
          timestamp: new Date(),
        },
      ],
    };
  },

  /**
   * Adds a network request to browser state
   */
  addNetworkRequest(
    state: BrowserState,
    url: string,
    method: string = 'GET',
    status?: number,
    headers?: Record<string, string>
  ): BrowserState {
    return {
      ...state,
      networkRequests: [
        ...state.networkRequests,
        {
          url,
          method,
          status,
          headers,
        },
      ],
    };
  },

  /**
   * Sets local storage data
   */
  setLocalStorage(
    state: BrowserState,
    key: string,
    value: string
  ): BrowserState {
    return {
      ...state,
      localStorage: {
        ...state.localStorage,
        [key]: value,
      },
    };
  },

  /**
   * Sets session storage data
   */
  setSessionStorage(
    state: BrowserState,
    key: string,
    value: string
  ): BrowserState {
    return {
      ...state,
      sessionStorage: {
        ...state.sessionStorage,
        [key]: value,
      },
    };
  },

  /**
   * Adds a cookie to browser state
   */
  addCookie(
    state: BrowserState,
    name: string,
    value: string,
    options: { domain?: string; path?: string } = {}
  ): BrowserState {
    return {
      ...state,
      cookies: [
        ...state.cookies,
        {
          name,
          value,
          domain: options.domain || 'localhost',
          path: options.path || '/',
        },
      ],
    };
  },

  /**
   * Simulates navigation to a new page
   */
  navigateTo(
    state: BrowserState,
    url: string,
    title?: string
  ): BrowserState {
    return {
      ...state,
      url,
      title: title || state.title,
      isLoading: false, // Navigation complete
    };
  },

  /**
   * Simulates starting a page load
   */
  startLoading(state: BrowserState): BrowserState {
    return {
      ...state,
      isLoading: true,
    };
  },

  /**
   * Simulates finishing a page load
   */
  finishLoading(state: BrowserState): BrowserState {
    return {
      ...state,
      isLoading: false,
    };
  },

  /**
   * Simulates an error occurring
   */
  setError(state: BrowserState, hasError: boolean = true): BrowserState {
    return {
      ...state,
      hasError,
    };
  },

  /**
   * Simulates user authentication status change
   */
  setAuthenticated(state: BrowserState, isAuthenticated: boolean): BrowserState {
    return {
      ...state,
      isAuthenticated,
    };
  },

  /**
   * Clears all browser data (localStorage, sessionStorage, cookies, messages)
   */
  clearBrowserData(state: BrowserState): BrowserState {
    return {
      ...state,
      localStorage: {},
      sessionStorage: {},
      cookies: [],
      consoleMessages: [],
      networkRequests: [],
    };
  },
};

/**
 * Creates a builder for complex browser state scenarios
 */
export class BrowserStateBuilder {
  private state: BrowserState;

  constructor(initialState?: Partial<BrowserState>) {
    this.state = browserFixtures.cleanState(initialState);
  }

  /**
   * Sets the URL
   */
  withUrl(url: string): this {
    this.state.url = url;
    return this;
  }

  /**
   * Sets the title
   */
  withTitle(title: string): this {
    this.state.title = title;
    return this;
  }

  /**
   * Sets loading state
   */
  withLoading(isLoading: boolean): this {
    this.state.isLoading = isLoading;
    return this;
  }

  /**
   * Sets error state
   */
  withError(hasError: boolean): this {
    this.state.hasError = hasError;
    return this;
  }

  /**
   * Sets authentication status
   */
  withAuth(isAuthenticated: boolean): this {
    this.state.isAuthenticated = isAuthenticated;
    return this;
  }

  /**
   * Adds local storage data
   */
  withLocalStorage(data: Record<string, string>): this {
    this.state.localStorage = { ...this.state.localStorage, ...data };
    return this;
  }

  /**
   * Adds session storage data
   */
  withSessionStorage(data: Record<string, string>): this {
    this.state.sessionStorage = { ...this.state.sessionStorage, ...data };
    return this;
  }

  /**
   * Adds console messages
   */
  withConsoleMessages(messages: Array<{
    type: 'log' | 'warn' | 'error' | 'info';
    message: string;
    timestamp?: Date;
  }>): this {
    this.state.consoleMessages = [
      ...this.state.consoleMessages,
      ...messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp || new Date(),
      })),
    ];
    return this;
  }

  /**
   * Adds cookies
   */
  withCookies(cookies: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
  }>): this {
    this.state.cookies = [...this.state.cookies, ...cookies];
    return this;
  }

  /**
   * Adds network requests
   */
  withNetworkRequests(requests: Array<{
    url: string;
    method: string;
    status?: number;
    headers?: Record<string, string>;
  }>): this {
    this.state.networkRequests = [...this.state.networkRequests, ...requests];
    return this;
  }

  /**
   * Builds the final browser state
   */
  build(): BrowserState {
    return { ...this.state };
  }
}

/**
 * Creates a new browser state builder
 */
export function createBrowserState(initialState?: Partial<BrowserState>): BrowserStateBuilder {
  return new BrowserStateBuilder(initialState);
}