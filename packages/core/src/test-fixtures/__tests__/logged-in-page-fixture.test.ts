/**
 * @fileoverview Tests for the Logged-in Page Fixture
 *
 * This test suite validates the integrated logged-in page fixture that combines
 * browser state fixtures with setup/teardown utilities for authenticated testing scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createLoggedInPageFixture,
  createBasicLoggedInFixture,
  createAdminLoggedInFixture,
  assertAuthenticated,
  extractUserInfo,
  type LoggedInPageFixture,
  type UserProfile,
  type LoggedInPageFixtureConfig
} from '../logged-in-page-fixture.js';
import { getTestEnvironment, getTestData } from '../setup-teardown.js';
import type { BrowserState } from '../types.js';

describe('Logged-in Page Fixture', () => {
  describe('createLoggedInPageFixture', () => {
    let fixture: LoggedInPageFixture;

    afterEach(async () => {
      if (fixture) {
        await fixture.afterEach();
      }
    });

    it('should create a fixture with default configuration', () => {
      fixture = createLoggedInPageFixture();

      expect(fixture).toBeDefined();
      expect(fixture.beforeEach).toBeDefined();
      expect(fixture.afterEach).toBeDefined();
      expect(fixture.getBrowserState).toBeDefined();
      expect(fixture.getUserProfile).toBeDefined();
      expect(fixture.updateBrowserState).toBeDefined();
      expect(fixture.simulateLogout).toBeDefined();
      expect(fixture.simulateLogin).toBeDefined();
    });

    it('should set up authenticated browser state after beforeEach', async () => {
      fixture = createLoggedInPageFixture();
      await fixture.beforeEach();

      const browserState = fixture.getBrowserState();
      expect(browserState.isAuthenticated).toBe(true);
      expect(browserState.localStorage['auth-token']).toBeDefined();
      expect(browserState.localStorage['user-profile']).toBeDefined();
      expect(browserState.localStorage['session-id']).toBeDefined();

      const userProfile = fixture.getUserProfile();
      expect(userProfile.id).toBe('test-user-12345');
      expect(userProfile.email).toBe('test-user@example.com');
      expect(userProfile.role).toBe('editor');
    });

    it('should accept custom user profile configuration', async () => {
      const customProfile: Partial<UserProfile> = {
        id: 'custom-user-456',
        email: 'custom@example.com',
        role: 'admin',
        displayName: 'Custom User'
      };

      fixture = createLoggedInPageFixture({
        userProfile: customProfile
      });
      await fixture.beforeEach();

      const userProfile = fixture.getUserProfile();
      expect(userProfile.id).toBe('custom-user-456');
      expect(userProfile.email).toBe('custom@example.com');
      expect(userProfile.role).toBe('admin');
      expect(userProfile.displayName).toBe('Custom User');

      const browserState = fixture.getBrowserState();
      const storedProfile = JSON.parse(browserState.localStorage['user-profile']);
      expect(storedProfile.id).toBe('custom-user-456');
    });

    it('should accept custom localStorage data', async () => {
      fixture = createLoggedInPageFixture({
        customLocalStorage: {
          'custom-key': 'custom-value',
          'feature-flags': 'enabled'
        }
      });
      await fixture.beforeEach();

      const browserState = fixture.getBrowserState();
      expect(browserState.localStorage['custom-key']).toBe('custom-value');
      expect(browserState.localStorage['feature-flags']).toBe('enabled');
      // Should still have auth data
      expect(browserState.localStorage['auth-token']).toBeDefined();
    });

    it('should accept custom sessionStorage data', async () => {
      fixture = createLoggedInPageFixture({
        customSessionStorage: {
          'custom-session': 'session-value',
          'workspace-id': 'workspace-123'
        }
      });
      await fixture.beforeEach();

      const browserState = fixture.getBrowserState();
      expect(browserState.sessionStorage['custom-session']).toBe('session-value');
      expect(browserState.sessionStorage['workspace-id']).toBe('workspace-123');
      // Should still have default session data
      expect(browserState.sessionStorage['current-project']).toBeDefined();
    });

    it('should accept custom cookies', async () => {
      fixture = createLoggedInPageFixture({
        customCookies: [
          { name: 'custom-cookie', value: 'cookie-value' },
          { name: 'feature-flag', value: 'true', domain: 'app.apex.dev' }
        ]
      });
      await fixture.beforeEach();

      const browserState = fixture.getBrowserState();
      const customCookie = browserState.cookies.find(c => c.name === 'custom-cookie');
      const featureCookie = browserState.cookies.find(c => c.name === 'feature-flag');

      expect(customCookie).toBeDefined();
      expect(customCookie?.value).toBe('cookie-value');
      expect(featureCookie).toBeDefined();
      expect(featureCookie?.domain).toBe('app.apex.dev');
    });

    it('should support custom setup and teardown functions', async () => {
      const setupSpy = vi.fn();
      const teardownSpy = vi.fn();

      fixture = createLoggedInPageFixture({
        customSetup: setupSpy,
        customTeardown: teardownSpy
      });

      await fixture.beforeEach();
      expect(setupSpy).toHaveBeenCalledOnce();

      await fixture.afterEach();
      expect(teardownSpy).toHaveBeenCalledOnce();
    });

    it('should set up browser automation mocks when requested', async () => {
      fixture = createLoggedInPageFixture({
        mockBrowserAutomation: true,
        automationConfig: {
          mockNavigate: true,
          mockScreenshots: true,
          mockInteractions: true,
          mockEvaluation: true
        }
      });

      await fixture.beforeEach();

      // Check that mocks are available
      expect(global.mockNavigate).toBeDefined();
      expect(global.mockScreenshot).toBeDefined();
      expect(global.mockClick).toBeDefined();
      expect(global.mockType).toBeDefined();
      expect(global.mockWaitFor).toBeDefined();
      expect(global.mockEvaluate).toBeDefined();

      // Verify they work
      await (global as any).mockNavigate('/dashboard');
      const screenshot = await (global as any).mockScreenshot();
      expect(screenshot.data).toBe('mock-base64-image-data');
    });
  });

  describe('Fixture Methods', () => {
    let fixture: LoggedInPageFixture;

    beforeEach(async () => {
      fixture = createLoggedInPageFixture();
      await fixture.beforeEach();
    });

    afterEach(async () => {
      await fixture.afterEach();
    });

    describe('updateBrowserState', () => {
      it('should update browser state and persist changes', () => {
        const originalState = fixture.getBrowserState();
        expect(originalState.title).toBe('APEX Dashboard');

        const updatedState = fixture.updateBrowserState({
          title: 'Updated Title',
          isLoading: true
        });

        expect(updatedState.title).toBe('Updated Title');
        expect(updatedState.isLoading).toBe(true);
        expect(updatedState.isAuthenticated).toBe(true); // Should preserve auth

        // Should persist the change
        const retrievedState = fixture.getBrowserState();
        expect(retrievedState.title).toBe('Updated Title');
        expect(retrievedState.isLoading).toBe(true);
      });
    });

    describe('updateUserProfile', () => {
      it('should update user profile and sync with browser state', () => {
        const originalProfile = fixture.getUserProfile();
        expect(originalProfile.displayName).toBe('Test User');

        const updatedProfile = fixture.updateUserProfile({
          displayName: 'Updated User',
          role: 'admin'
        });

        expect(updatedProfile.displayName).toBe('Updated User');
        expect(updatedProfile.role).toBe('admin');
        expect(updatedProfile.id).toBe(originalProfile.id); // Should preserve other fields

        // Should update localStorage in browser state
        const browserState = fixture.getBrowserState();
        const storedProfile = JSON.parse(browserState.localStorage['user-profile']);
        expect(storedProfile.displayName).toBe('Updated User');
        expect(storedProfile.role).toBe('admin');
      });
    });

    describe('simulateLogout', () => {
      it('should clear authentication state and add logout request', () => {
        const originalState = fixture.getBrowserState();
        expect(originalState.isAuthenticated).toBe(true);

        const loggedOutState = fixture.simulateLogout();

        expect(loggedOutState.isAuthenticated).toBe(false);
        expect(loggedOutState.localStorage).toEqual({});
        expect(loggedOutState.sessionStorage).toEqual({});
        expect(loggedOutState.cookies).toEqual([]);

        // Should add logout console message
        const logoutMessage = loggedOutState.consoleMessages.find(
          msg => msg.message === 'User logged out successfully'
        );
        expect(logoutMessage).toBeDefined();
        expect(logoutMessage?.type).toBe('info');

        // Should add logout network request
        const logoutRequest = loggedOutState.networkRequests.find(
          req => req.url === 'https://api.apex.dev/auth/logout'
        );
        expect(logoutRequest).toBeDefined();
        expect(logoutRequest?.method).toBe('POST');
        expect(logoutRequest?.status).toBe(200);
      });
    });

    describe('simulateLogin', () => {
      it('should create new authenticated state with different user', () => {
        // First logout
        fixture.simulateLogout();

        // Then login with new user
        const newProfile: Partial<UserProfile> = {
          id: 'new-user-789',
          email: 'new-user@example.com',
          role: 'viewer',
          displayName: 'New User'
        };

        const loginState = fixture.simulateLogin(newProfile);

        expect(loginState.isAuthenticated).toBe(true);
        expect(loginState.localStorage['auth-token']).toBeDefined();

        const storedProfile = JSON.parse(loginState.localStorage['user-profile']);
        expect(storedProfile.id).toBe('new-user-789');
        expect(storedProfile.email).toBe('new-user@example.com');
        expect(storedProfile.role).toBe('viewer');

        // Should update fixture's user profile
        const updatedProfile = fixture.getUserProfile();
        expect(updatedProfile.id).toBe('new-user-789');
      });
    });

    describe('addConsoleMessage', () => {
      it('should add console message to browser state', () => {
        const originalState = fixture.getBrowserState();
        const originalCount = originalState.consoleMessages.length;

        const updatedState = fixture.addConsoleMessage('warn', 'Test warning message');

        expect(updatedState.consoleMessages).toHaveLength(originalCount + 1);
        const newMessage = updatedState.consoleMessages[updatedState.consoleMessages.length - 1];
        expect(newMessage.type).toBe('warn');
        expect(newMessage.message).toBe('Test warning message');
        expect(newMessage.timestamp).toBeDefined();

        // Should persist the change
        const retrievedState = fixture.getBrowserState();
        expect(retrievedState.consoleMessages).toHaveLength(originalCount + 1);
      });
    });

    describe('addNetworkRequest', () => {
      it('should add network request to browser state', () => {
        const originalState = fixture.getBrowserState();
        const originalCount = originalState.networkRequests.length;

        const updatedState = fixture.addNetworkRequest(
          'https://api.example.com/test',
          'POST',
          201,
          { 'Content-Type': 'application/json' }
        );

        expect(updatedState.networkRequests).toHaveLength(originalCount + 1);
        const newRequest = updatedState.networkRequests[updatedState.networkRequests.length - 1];
        expect(newRequest.url).toBe('https://api.example.com/test');
        expect(newRequest.method).toBe('POST');
        expect(newRequest.status).toBe(201);
        expect(newRequest.headers?.['Content-Type']).toBe('application/json');
      });

      it('should use default GET method when not specified', () => {
        const updatedState = fixture.addNetworkRequest('https://api.example.com/get-test');
        const newRequest = updatedState.networkRequests[updatedState.networkRequests.length - 1];
        expect(newRequest.method).toBe('GET');
      });
    });

    describe('resetToInitialState', () => {
      it('should reset browser state to initial authenticated state', () => {
        // Modify state
        fixture.updateBrowserState({ title: 'Modified Title', isLoading: true });
        fixture.addConsoleMessage('error', 'Test error');

        const modifiedState = fixture.getBrowserState();
        expect(modifiedState.title).toBe('Modified Title');
        expect(modifiedState.isLoading).toBe(true);

        // Reset to initial state
        const resetState = fixture.resetToInitialState();

        expect(resetState.title).toBe('APEX Dashboard');
        expect(resetState.isLoading).toBe(false);
        expect(resetState.isAuthenticated).toBe(true);

        // Should not have the test error message
        const errorMessages = resetState.consoleMessages.filter(msg => msg.message === 'Test error');
        expect(errorMessages).toHaveLength(0);
      });
    });
  });

  describe('Convenience Functions', () => {
    describe('createBasicLoggedInFixture', () => {
      it('should create fixture with default editor role', async () => {
        const fixture = createBasicLoggedInFixture();
        await fixture.beforeEach();

        const userProfile = fixture.getUserProfile();
        expect(userProfile.role).toBe('editor');

        // Should have browser automation mocks enabled
        expect(global.mockNavigate).toBeDefined();
        expect(global.mockScreenshot).toBeDefined();

        await fixture.afterEach();
      });

      it('should accept custom user role', async () => {
        const fixture = createBasicLoggedInFixture('admin');
        await fixture.beforeEach();

        const userProfile = fixture.getUserProfile();
        expect(userProfile.role).toBe('admin');

        await fixture.afterEach();
      });
    });

    describe('createAdminLoggedInFixture', () => {
      it('should create fixture with admin role and features', async () => {
        const fixture = createAdminLoggedInFixture();
        await fixture.beforeEach();

        const userProfile = fixture.getUserProfile();
        expect(userProfile.role).toBe('admin');
        expect(userProfile.email).toBe('admin@example.com');

        const browserState = fixture.getBrowserState();
        expect(browserState.localStorage['admin-features']).toBe('enabled');
        expect(browserState.localStorage['feature-flags']).toBeDefined();

        await fixture.afterEach();
      });
    });
  });

  describe('Helper Functions', () => {
    let fixture: LoggedInPageFixture;

    beforeEach(async () => {
      fixture = createLoggedInPageFixture();
      await fixture.beforeEach();
    });

    afterEach(async () => {
      await fixture.afterEach();
    });

    describe('assertAuthenticated', () => {
      it('should pass for authenticated browser state', () => {
        const browserState = fixture.getBrowserState();
        expect(() => assertAuthenticated(browserState)).not.toThrow();
      });

      it('should throw for unauthenticated state', () => {
        const unauthenticatedState = fixture.simulateLogout();
        expect(() => assertAuthenticated(unauthenticatedState)).toThrow('Expected browser state to be authenticated');
      });

      it('should throw when auth token is missing', () => {
        const stateWithoutToken = fixture.updateBrowserState({
          localStorage: {}
        });
        expect(() => assertAuthenticated(stateWithoutToken)).toThrow('Expected auth token in localStorage');
      });

      it('should throw when user profile is missing', () => {
        const stateWithoutProfile = fixture.updateBrowserState({
          localStorage: { 'auth-token': 'test-token' }
        });
        expect(() => assertAuthenticated(stateWithoutProfile)).toThrow('Expected user profile in localStorage');
      });
    });

    describe('extractUserInfo', () => {
      it('should extract user profile from authenticated state', () => {
        const browserState = fixture.getBrowserState();
        const userInfo = extractUserInfo(browserState);

        expect(userInfo).not.toBeNull();
        expect(userInfo?.id).toBe('test-user-12345');
        expect(userInfo?.email).toBe('test-user@example.com');
        expect(userInfo?.role).toBe('editor');
      });

      it('should return null for unauthenticated state', () => {
        const unauthenticatedState = fixture.simulateLogout();
        const userInfo = extractUserInfo(unauthenticatedState);
        expect(userInfo).toBeNull();
      });

      it('should return null for invalid user profile JSON', () => {
        const stateWithInvalidProfile = fixture.updateBrowserState({
          localStorage: {
            'auth-token': 'test-token',
            'user-profile': 'invalid-json'
          }
        });
        const userInfo = extractUserInfo(stateWithInvalidProfile);
        expect(userInfo).toBeNull();
      });
    });
  });

  describe('Integration with Setup/Teardown', () => {
    let fixture: LoggedInPageFixture;

    afterEach(async () => {
      if (fixture) {
        await fixture.afterEach();
      }
    });

    it('should integrate with test environment state management', async () => {
      fixture = createLoggedInPageFixture();
      await fixture.beforeEach();

      // Test environment should be initialized
      const env = getTestEnvironment();
      expect(env).not.toBeNull();
      expect(env?.projectPath).toBe('/test/project');

      // Browser state should be stored in test data
      const storedState = getTestData('browserState');
      expect(storedState).toBeDefined();
      expect(storedState.isAuthenticated).toBe(true);

      // User profile should be stored
      const storedProfile = getTestData('userProfile');
      expect(storedProfile).toBeDefined();
      expect(storedProfile.id).toBe('test-user-12345');
    });

    it('should clean up state after teardown', async () => {
      fixture = createLoggedInPageFixture();
      await fixture.beforeEach();

      // Verify state exists
      expect(getTestEnvironment()).not.toBeNull();
      expect(getTestData('browserState')).toBeDefined();

      await fixture.afterEach();

      // Environment should be cleaned up
      expect(getTestEnvironment()).toBeNull();
    });

    it('should support multiple fixture instances with isolated state', async () => {
      const fixture1 = createLoggedInPageFixture({
        userProfile: { id: 'user-1', email: 'user1@example.com' }
      });
      const fixture2 = createLoggedInPageFixture({
        userProfile: { id: 'user-2', email: 'user2@example.com' }
      });

      // First fixture
      await fixture1.beforeEach();
      const profile1 = fixture1.getUserProfile();
      expect(profile1.id).toBe('user-1');
      await fixture1.afterEach();

      // Second fixture should have different state
      await fixture2.beforeEach();
      const profile2 = fixture2.getUserProfile();
      expect(profile2.id).toBe('user-2');
      await fixture2.afterEach();
    });

    it('should handle errors in custom setup/teardown gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      fixture = createLoggedInPageFixture({
        customSetup: () => {
          throw new Error('Setup failed');
        },
        customTeardown: () => {
          throw new Error('Teardown failed');
        }
      });

      // Should not throw on setup
      await expect(fixture.beforeEach()).rejects.toThrow('Setup failed');

      // Create a new fixture without failing setup for teardown test
      fixture = createLoggedInPageFixture({
        customTeardown: () => {
          throw new Error('Teardown failed');
        }
      });

      await fixture.beforeEach();
      await expect(fixture.afterEach()).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith('Custom teardown failed:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('Real-world Usage Scenarios', () => {
    describe('Dashboard Testing Scenario', () => {
      let fixture: LoggedInPageFixture;

      beforeEach(async () => {
        fixture = createLoggedInPageFixture({
          userProfile: {
            role: 'editor',
            metadata: {
              preferences: { theme: 'dark' }
            }
          },
          customLocalStorage: {
            'dashboard-layout': JSON.stringify({ sidebar: true, theme: 'dark' })
          }
        });
        await fixture.beforeEach();
      });

      afterEach(async () => {
        await fixture.afterEach();
      });

      it('should provide authenticated state for dashboard tests', () => {
        const state = fixture.getBrowserState();
        assertAuthenticated(state);

        const userInfo = extractUserInfo(state);
        expect(userInfo?.role).toBe('editor');
        expect(state.localStorage['dashboard-layout']).toBeDefined();
      });

      it('should simulate dashboard interactions', () => {
        // Simulate navigating to different dashboard page
        fixture.updateBrowserState({
          url: 'https://app.apex.dev/dashboard/projects',
          title: 'Projects - APEX Dashboard'
        });

        // Simulate API call to load projects
        fixture.addNetworkRequest(
          'https://api.apex.dev/projects',
          'GET',
          200,
          { 'Authorization': `Bearer ${fixture.getBrowserState().localStorage['auth-token']}` }
        );

        // Simulate user action logging
        fixture.addConsoleMessage('info', 'Projects page loaded');

        const state = fixture.getBrowserState();
        expect(state.url).toBe('https://app.apex.dev/dashboard/projects');

        const projectsRequest = state.networkRequests.find(req => req.url.includes('/projects'));
        expect(projectsRequest).toBeDefined();
        expect(projectsRequest?.status).toBe(200);
      });
    });

    describe('Admin Panel Testing Scenario', () => {
      let fixture: LoggedInPageFixture;

      beforeEach(async () => {
        fixture = createAdminLoggedInFixture();
        await fixture.beforeEach();
      });

      afterEach(async () => {
        await fixture.afterEach();
      });

      it('should provide admin-authenticated state', () => {
        const state = fixture.getBrowserState();
        assertAuthenticated(state);

        const userInfo = extractUserInfo(state);
        expect(userInfo?.role).toBe('admin');
        expect(state.localStorage['admin-features']).toBe('enabled');
      });

      it('should simulate switching to regular user', () => {
        // Admin switches to view as regular user
        const regularUserState = fixture.simulateLogin({
          role: 'viewer',
          email: 'viewer@example.com'
        });

        const userInfo = extractUserInfo(regularUserState);
        expect(userInfo?.role).toBe('viewer');
        expect(userInfo?.email).toBe('viewer@example.com');
      });
    });

    describe('Session Management Testing Scenario', () => {
      let fixture: LoggedInPageFixture;

      beforeEach(async () => {
        fixture = createLoggedInPageFixture({
          authSession: { timeout: 1800 } // 30 minutes
        });
        await fixture.beforeEach();
      });

      afterEach(async () => {
        await fixture.afterEach();
      });

      it('should simulate session timeout', () => {
        const originalState = fixture.getBrowserState();
        assertAuthenticated(originalState);

        // Simulate session timeout by logging out
        const timeoutState = fixture.simulateLogout();
        expect(timeoutState.isAuthenticated).toBe(false);

        // Should have logout in console
        const timeoutMessage = timeoutState.consoleMessages.find(
          msg => msg.message === 'User logged out successfully'
        );
        expect(timeoutMessage).toBeDefined();
      });

      it('should simulate session refresh', () => {
        const originalProfile = fixture.getUserProfile();

        // Simulate refreshing session with updated last activity
        const refreshedState = fixture.simulateLogin(
          { ...originalProfile },
          { sessionId: 'new-session-' + Date.now() }
        );

        assertAuthenticated(refreshedState);
        expect(refreshedState.localStorage['session-id']).toContain('new-session-');
      });
    });
  });
});