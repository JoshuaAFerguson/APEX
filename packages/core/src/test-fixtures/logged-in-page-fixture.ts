/**
 * @fileoverview Logged-in Page Fixture with Setup/Teardown Integration
 *
 * This module provides an integrated fixture for authenticated browser state testing
 * that combines the browser state fixtures with setup/teardown utilities for easy
 * test configuration and cleanup.
 *
 * @example Basic usage:
 * ```typescript
 * import { createLoggedInPageFixture } from '@apex/core/test-fixtures';
 *
 * describe('Dashboard Tests', () => {
 *   const fixture = createLoggedInPageFixture();
 *
 *   beforeEach(fixture.beforeEach);
 *   afterEach(fixture.afterEach);
 *
 *   it('should render dashboard for authenticated user', () => {
 *     const state = fixture.getBrowserState();
 *     expect(state.isAuthenticated).toBe(true);
 *     expect(state.localStorage['auth-token']).toBeDefined();
 *   });
 * });
 * ```
 *
 * @example Custom authentication state:
 * ```typescript
 * const fixture = createLoggedInPageFixture({
 *   userProfile: {
 *     id: 'custom-user-123',
 *     email: 'test@example.com',
 *     role: 'admin'
 *   }
 * });
 * ```
 */

import { vi } from 'vitest';
import { browserFixtures, browserHelpers } from './browser-fixtures.js';
import { createTestSuite, addCleanupTask, setTestData, getTestData } from './setup-teardown.js';
import type {
  BrowserState,
  TestSuiteConfig,
  SetupTeardownHooks
} from './types.js';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * User profile information for authenticated sessions
 */
export interface UserProfile {
  /** User ID */
  id: string;
  /** User email address */
  email: string;
  /** User role/permissions */
  role: 'viewer' | 'editor' | 'admin' | 'owner';
  /** Display name */
  displayName?: string;
  /** Additional user metadata */
  metadata?: Record<string, any>;
}

/**
 * Authentication session configuration
 */
export interface AuthSessionConfig {
  /** Session timeout in seconds */
  timeout?: number;
  /** Session ID */
  sessionId?: string;
  /** Custom authentication headers */
  customHeaders?: Record<string, string>;
}

/**
 * Browser automation mocking configuration
 */
export interface BrowserAutomationConfig {
  /** Mock browser navigation operations */
  mockNavigate?: boolean;
  /** Mock screenshot capture */
  mockScreenshots?: boolean;
  /** Mock element interactions */
  mockInteractions?: boolean;
  /** Mock page evaluation */
  mockEvaluation?: boolean;
  /** Custom automation responses */
  customResponses?: Record<string, any>;
}

/**
 * Configuration for logged-in page fixture
 */
export interface LoggedInPageFixtureConfig {
  /** User profile information */
  userProfile?: Partial<UserProfile>;
  /** Authentication session configuration */
  authSession?: AuthSessionConfig;
  /** Initial browser state overrides */
  initialState?: Partial<BrowserState>;
  /** Additional cookies to set */
  customCookies?: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
  }>;
  /** Custom localStorage entries */
  customLocalStorage?: Record<string, string>;
  /** Custom sessionStorage entries */
  customSessionStorage?: Record<string, string>;
  /** Mock browser automation tools */
  mockBrowserAutomation?: boolean;
  /** Browser automation mock configuration */
  automationConfig?: BrowserAutomationConfig;
  /** Additional test suite configuration */
  testSuiteConfig?: Partial<TestSuiteConfig>;
  /** Custom setup function */
  customSetup?: () => void | Promise<void>;
  /** Custom teardown function */
  customTeardown?: () => void | Promise<void>;
}

/**
 * Logged-in page fixture interface
 */
export interface LoggedInPageFixture extends SetupTeardownHooks {
  /** Get the current authenticated browser state */
  getBrowserState(): BrowserState;
  /** Update the browser state */
  updateBrowserState(updates: Partial<BrowserState>): BrowserState;
  /** Get the user profile */
  getUserProfile(): UserProfile;
  /** Update user profile */
  updateUserProfile(updates: Partial<UserProfile>): UserProfile;
  /** Simulate logout */
  simulateLogout(): BrowserState;
  /** Simulate login with different user */
  simulateLogin(profile: Partial<UserProfile>, authConfig?: AuthSessionConfig): BrowserState;
  /** Add console message to current state */
  addConsoleMessage(type: 'log' | 'warn' | 'error' | 'info', message: string): BrowserState;
  /** Add network request to current state */
  addNetworkRequest(url: string, method?: string, status?: number, headers?: Record<string, string>): BrowserState;
  /** Reset to initial authenticated state */
  resetToInitialState(): BrowserState;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default user profile for authenticated sessions
 */
const DEFAULT_USER_PROFILE: UserProfile = {
  id: 'test-user-12345',
  email: 'test-user@example.com',
  role: 'editor',
  displayName: 'Test User',
  metadata: {
    createdAt: '2024-01-01T00:00:00Z',
    lastLoginAt: new Date().toISOString(),
    preferences: {
      theme: 'light',
      notifications: true,
      language: 'en'
    }
  }
};

/**
 * Default authentication session configuration
 */
const DEFAULT_AUTH_CONFIG: Required<AuthSessionConfig> = {
  timeout: 3600, // 1 hour
  sessionId: 'test-session-' + Math.random().toString(36).substring(2, 15),
  customHeaders: {}
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generates a test token for testing purposes
 */
function generateTestToken(userProfile: UserProfile): string {
  // Simple test token format - NOT a real JWT
  const userData = {
    sub: userProfile.id,
    email: userProfile.email,
    role: userProfile.role,
    exp: Math.floor(Date.now() / 1000) + 3600
  };
  return `test-token-${btoa(JSON.stringify(userData))}`;
}

/**
 * Creates authenticated browser state with user profile and session data
 */
function createAuthenticatedBrowserState(
  userProfile: UserProfile,
  authConfig: Required<AuthSessionConfig>,
  customConfig: LoggedInPageFixtureConfig
): BrowserState {
  const testToken = generateTestToken(userProfile);

  // Start with logged-in base state
  const baseState = browserFixtures.loggedInPage({
    ...customConfig.initialState,
    localStorage: {
      'auth-token': testToken,
      'user-profile': JSON.stringify(userProfile),
      'session-id': authConfig.sessionId,
      'session-timeout': authConfig.timeout.toString(),
      ...customConfig.customLocalStorage
    },
    sessionStorage: {
      'current-project': '/users/test/my-project',
      'active-agents': JSON.stringify(['planner', 'developer']),
      'last-activity': new Date().toISOString(),
      ...customConfig.customSessionStorage
    }
  });

  // Add custom cookies
  let stateWithCookies = baseState;
  if (customConfig.customCookies) {
    for (const cookie of customConfig.customCookies) {
      stateWithCookies = browserHelpers.addCookie(
        stateWithCookies,
        cookie.name,
        cookie.value,
        { domain: cookie.domain, path: cookie.path }
      );
    }
  }

  // Add authentication console messages
  const stateWithMessages = browserHelpers.addConsoleMessage(
    stateWithCookies,
    'info',
    `User authenticated: ${userProfile.email} (${userProfile.role})`
  );

  // Add API requests that would typically happen on login
  let finalState = browserHelpers.addNetworkRequest(
    stateWithMessages,
    'https://api.apex.dev/auth/verify',
    'POST',
    200,
    {
      'Authorization': `Bearer ${testToken}`,
      'Content-Type': 'application/json'
    }
  );

  finalState = browserHelpers.addNetworkRequest(
    finalState,
    `https://api.apex.dev/users/${userProfile.id}/profile`,
    'GET',
    200,
    {
      'Authorization': `Bearer ${testToken}`
    }
  );

  return finalState;
}

/**
 * Sets up browser automation mocks
 */
function setupBrowserAutomationMocks(config: BrowserAutomationConfig): void {
  if (config.mockNavigate) {
    global.mockNavigate = vi.fn().mockResolvedValue({ success: true });
    addCleanupTask(() => {
      delete (global as any).mockNavigate;
    });
  }

  if (config.mockScreenshots) {
    global.mockScreenshot = vi.fn().mockResolvedValue({
      data: 'mock-base64-image-data',
      format: 'png',
      timestamp: new Date().toISOString()
    });
    addCleanupTask(() => {
      delete (global as any).mockScreenshot;
    });
  }

  if (config.mockInteractions) {
    global.mockClick = vi.fn().mockResolvedValue({ success: true });
    global.mockType = vi.fn().mockResolvedValue({ success: true });
    global.mockWaitFor = vi.fn().mockResolvedValue({ found: true });

    addCleanupTask(() => {
      delete (global as any).mockClick;
      delete (global as any).mockType;
      delete (global as any).mockWaitFor;
    });
  }

  if (config.mockEvaluation) {
    global.mockEvaluate = vi.fn().mockImplementation((script: string) => {
      if (script.includes('document.title')) return 'APEX Dashboard';
      if (script.includes('window.location')) return { href: 'https://app.apex.dev/dashboard' };
      return null;
    });
    addCleanupTask(() => {
      delete (global as any).mockEvaluate;
    });
  }

  // Custom responses
  if (config.customResponses) {
    for (const [key, response] of Object.entries(config.customResponses)) {
      (global as any)[key] = vi.fn().mockResolvedValue(response);
      addCleanupTask(() => {
        delete (global as any)[key];
      });
    }
  }
}

// ============================================================================
// Main Fixture Implementation
// ============================================================================

/**
 * Creates a logged-in page fixture with integrated setup/teardown utilities
 */
export function createLoggedInPageFixture(
  config: LoggedInPageFixtureConfig = {}
): LoggedInPageFixture {
  // Merge configuration with defaults
  const userProfile: UserProfile = {
    ...DEFAULT_USER_PROFILE,
    ...config.userProfile
  };

  const authConfig: Required<AuthSessionConfig> = {
    ...DEFAULT_AUTH_CONFIG,
    ...config.authSession
  };

  // Create test suite with merged configuration
  const testSuiteConfig: TestSuiteConfig = {
    setupMocks: true,
    cleanupAfterEach: true,
    mockConfig: {
      mockNetwork: true,
      mockData: {
        apiResponses: {
          'https://api.apex.dev/auth/verify': {
            success: true,
            user: userProfile
          },
          [`https://api.apex.dev/users/${userProfile.id}/profile`]: userProfile
        }
      }
    },
    customSetup: async () => {
      // Set up browser automation mocks if requested
      if (config.mockBrowserAutomation) {
        setupBrowserAutomationMocks(config.automationConfig || {});
      }

      // Create and store initial authenticated browser state
      const initialState = createAuthenticatedBrowserState(userProfile, authConfig, config);
      setTestData('browserState', initialState);
      setTestData('userProfile', userProfile);
      setTestData('authConfig', authConfig);
      setTestData('initialState', initialState);

      // Run custom setup if provided
      if (config.customSetup) {
        await config.customSetup();
      }
    },
    customTeardown: config.customTeardown,
    ...config.testSuiteConfig
  };

  const testSuite = createTestSuite(testSuiteConfig);

  // Return fixture implementation
  return {
    beforeEach: testSuite.beforeEach,
    afterEach: testSuite.afterEach,

    getBrowserState(): BrowserState {
      return getTestData('browserState') || createAuthenticatedBrowserState(userProfile, authConfig, config);
    },

    updateBrowserState(updates: Partial<BrowserState>): BrowserState {
      const currentState = this.getBrowserState();
      const newState = { ...currentState, ...updates };
      setTestData('browserState', newState);
      return newState;
    },

    getUserProfile(): UserProfile {
      return getTestData('userProfile') || userProfile;
    },

    updateUserProfile(updates: Partial<UserProfile>): UserProfile {
      const currentProfile = this.getUserProfile();
      const newProfile = { ...currentProfile, ...updates };
      setTestData('userProfile', newProfile);

      // Update browser state with new profile
      const currentState = this.getBrowserState();
      const updatedState = {
        ...currentState,
        localStorage: {
          ...currentState.localStorage,
          'user-profile': JSON.stringify(newProfile)
        }
      };
      setTestData('browserState', updatedState);
      return newProfile;
    },

    simulateLogout(): BrowserState {
      const currentState = this.getBrowserState();
      const loggedOutState = {
        ...currentState,
        isAuthenticated: false,
        localStorage: {},
        sessionStorage: {},
        cookies: [],
        consoleMessages: [
          ...currentState.consoleMessages,
          {
            type: 'info' as const,
            message: 'User logged out successfully',
            timestamp: new Date()
          }
        ],
        networkRequests: [
          ...currentState.networkRequests,
          {
            url: 'https://api.apex.dev/auth/logout',
            method: 'POST',
            status: 200
          }
        ]
      };
      setTestData('browserState', loggedOutState);
      return loggedOutState;
    },

    simulateLogin(profile: Partial<UserProfile>, authCfg?: AuthSessionConfig): BrowserState {
      const newProfile = { ...this.getUserProfile(), ...profile };
      const newAuthConfig = { ...authConfig, ...authCfg };
      const newState = createAuthenticatedBrowserState(newProfile, newAuthConfig, config);

      setTestData('userProfile', newProfile);
      setTestData('authConfig', newAuthConfig);
      setTestData('browserState', newState);

      return newState;
    },

    addConsoleMessage(type: 'log' | 'warn' | 'error' | 'info', message: string): BrowserState {
      const currentState = this.getBrowserState();
      const newState = browserHelpers.addConsoleMessage(currentState, type, message);
      setTestData('browserState', newState);
      return newState;
    },

    addNetworkRequest(url: string, method = 'GET', status?: number, headers?: Record<string, string>): BrowserState {
      const currentState = this.getBrowserState();
      const newState = browserHelpers.addNetworkRequest(currentState, url, method, status, headers);
      setTestData('browserState', newState);
      return newState;
    },

    resetToInitialState(): BrowserState {
      const initialState = getTestData('initialState') || createAuthenticatedBrowserState(userProfile, authConfig, config);
      setTestData('browserState', initialState);
      return initialState;
    }
  };
}

/**
 * Convenience function to create a basic logged-in fixture with minimal configuration
 */
export function createBasicLoggedInFixture(userRole: UserProfile['role'] = 'editor'): LoggedInPageFixture {
  return createLoggedInPageFixture({
    userProfile: { role: userRole },
    mockBrowserAutomation: true,
    automationConfig: {
      mockNavigate: true,
      mockScreenshots: true,
      mockInteractions: true
    }
  });
}

/**
 * Convenience function to create a logged-in fixture with admin privileges
 */
export function createAdminLoggedInFixture(): LoggedInPageFixture {
  return createLoggedInPageFixture({
    userProfile: {
      role: 'admin',
      email: 'admin@example.com',
      displayName: 'Test Admin'
    },
    customLocalStorage: {
      'admin-features': 'enabled',
      'feature-flags': JSON.stringify(['advanced-ui', 'debug-mode'])
    },
    mockBrowserAutomation: true
  });
}

/**
 * Helper function to assert that browser state indicates authentication
 */
export function assertAuthenticated(browserState: BrowserState): void {
  if (!browserState.isAuthenticated) {
    throw new Error('Expected browser state to be authenticated');
  }
  if (!browserState.localStorage['auth-token']) {
    throw new Error('Expected auth token in localStorage');
  }
  if (!browserState.localStorage['user-profile']) {
    throw new Error('Expected user profile in localStorage');
  }
}

/**
 * Helper function to extract user info from authenticated browser state
 */
export function extractUserInfo(browserState: BrowserState): UserProfile | null {
  if (!browserState.isAuthenticated || !browserState.localStorage['user-profile']) {
    return null;
  }

  try {
    return JSON.parse(browserState.localStorage['user-profile']);
  } catch {
    return null;
  }
}