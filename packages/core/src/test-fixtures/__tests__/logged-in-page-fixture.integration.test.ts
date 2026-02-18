/**
 * @fileoverview Integration Tests for Logged-in Page Fixture
 *
 * These integration tests verify the logged-in page fixture works correctly
 * when integrated with other APEX components and real browser automation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createLoggedInPageFixture,
  createBasicLoggedInFixture,
  createAdminLoggedInFixture,
  assertAuthenticated,
  extractUserInfo,
  type LoggedInPageFixture,
  type UserProfile
} from '../logged-in-page-fixture.js';
import { getTestEnvironment, clearTestEnvironment } from '../setup-teardown.js';
import type { BrowserState } from '../types.js';

describe('Logged-in Page Fixture - Integration Tests', () => {
  describe('Multi-fixture State Isolation', () => {
    it('should maintain separate state for concurrent fixture instances', async () => {
      const userFixture = createLoggedInPageFixture({
        userProfile: { id: 'user-123', role: 'editor', email: 'user@test.com' }
      });

      const adminFixture = createLoggedInPageFixture({
        userProfile: { id: 'admin-456', role: 'admin', email: 'admin@test.com' }
      });

      await userFixture.beforeEach();
      await adminFixture.beforeEach();

      // Each fixture should have its own state
      const userState = userFixture.getBrowserState();
      const adminState = adminFixture.getBrowserState();

      const userInfo = extractUserInfo(userState);
      const adminInfo = extractUserInfo(adminState);

      expect(userInfo?.id).toBe('user-123');
      expect(userInfo?.role).toBe('editor');
      expect(adminInfo?.id).toBe('admin-456');
      expect(adminInfo?.role).toBe('admin');

      // States should be completely separate
      userFixture.addConsoleMessage('info', 'User action');
      adminFixture.addConsoleMessage('info', 'Admin action');

      const updatedUserState = userFixture.getBrowserState();
      const updatedAdminState = adminFixture.getBrowserState();

      const userMessages = updatedUserState.consoleMessages.filter(m => m.message.includes('User action'));
      const adminMessages = updatedAdminState.consoleMessages.filter(m => m.message.includes('Admin action'));
      const crossContamination = updatedUserState.consoleMessages.filter(m => m.message.includes('Admin action'));

      expect(userMessages).toHaveLength(1);
      expect(adminMessages).toHaveLength(1);
      expect(crossContamination).toHaveLength(0);

      await userFixture.afterEach();
      await adminFixture.afterEach();
    });

    it('should handle cleanup properly with multiple fixtures', async () => {
      const fixtures: LoggedInPageFixture[] = [];

      // Create multiple fixtures
      for (let i = 0; i < 3; i++) {
        const fixture = createLoggedInPageFixture({
          userProfile: { id: `test-user-${i}`, email: `user${i}@test.com` }
        });
        fixtures.push(fixture);
        await fixture.beforeEach();
      }

      // Verify all have separate states
      for (let i = 0; i < fixtures.length; i++) {
        const state = fixtures[i].getBrowserState();
        const userInfo = extractUserInfo(state);
        expect(userInfo?.id).toBe(`test-user-${i}`);
      }

      // Cleanup all fixtures
      for (const fixture of fixtures) {
        await fixture.afterEach();
      }

      // Test environment should be clean
      expect(getTestEnvironment()).toBeNull();
    });
  });

  describe('Session Management Integration', () => {
    let fixture: LoggedInPageFixture;

    afterEach(async () => {
      if (fixture) {
        await fixture.afterEach();
      }
    });

    it('should simulate complete authentication flow', async () => {
      fixture = createLoggedInPageFixture();
      await fixture.beforeEach();

      // 1. Initial authenticated state
      let state = fixture.getBrowserState();
      assertAuthenticated(state);
      expect(extractUserInfo(state)?.email).toBe('test-user@example.com');

      // 2. User performs actions
      fixture.addConsoleMessage('info', 'User navigated to projects');
      fixture.addNetworkRequest('https://api.apex.dev/projects', 'GET', 200);

      // 3. Session warning simulation
      fixture.addConsoleMessage('warn', 'Session expires in 5 minutes');

      // 4. Session refresh
      const refreshedState = fixture.simulateLogin(
        { ...fixture.getUserProfile() },
        { sessionId: 'refreshed-session-' + Date.now() }
      );
      assertAuthenticated(refreshedState);
      expect(refreshedState.localStorage['session-id']).toContain('refreshed-session-');

      // 5. Session timeout
      const loggedOutState = fixture.simulateLogout();
      expect(loggedOutState.isAuthenticated).toBe(false);
      expect(loggedOutState.localStorage).toEqual({});

      // Verify complete flow in console messages
      const finalState = fixture.getBrowserState();
      const messages = finalState.consoleMessages.map(m => m.message);
      expect(messages).toContain('User navigated to projects');
      expect(messages).toContain('Session expires in 5 minutes');
      expect(messages).toContain('User logged out successfully');
    });

    it('should handle role-based authentication switching', async () => {
      fixture = createLoggedInPageFixture({
        userProfile: { role: 'viewer' }
      });
      await fixture.beforeEach();

      // Start as viewer
      let userInfo = extractUserInfo(fixture.getBrowserState());
      expect(userInfo?.role).toBe('viewer');

      // Escalate to editor
      fixture.simulateLogin({ role: 'editor' });
      userInfo = extractUserInfo(fixture.getBrowserState());
      expect(userInfo?.role).toBe('editor');

      // Escalate to admin
      fixture.simulateLogin({ role: 'admin' });
      userInfo = extractUserInfo(fixture.getBrowserState());
      expect(userInfo?.role).toBe('admin');

      // De-escalate back to viewer
      fixture.simulateLogin({ role: 'viewer' });
      userInfo = extractUserInfo(fixture.getBrowserState());
      expect(userInfo?.role).toBe('viewer');
    });

    it('should maintain authentication token consistency', async () => {
      fixture = createLoggedInPageFixture();
      await fixture.beforeEach();

      const initialState = fixture.getBrowserState();
      const initialToken = initialState.localStorage['auth-token'];
      expect(initialToken).toBeDefined();
      expect(initialToken).toContain('test-token-');

      // Update profile should maintain token format but create new one
      fixture.updateUserProfile({ displayName: 'Updated User' });
      const updatedState = fixture.getBrowserState();
      const updatedToken = updatedState.localStorage['auth-token'];
      expect(updatedToken).toBeDefined();
      expect(updatedToken).toContain('test-token-');

      // Re-login should create new token
      fixture.simulateLogin({ email: 'new@test.com' });
      const newLoginState = fixture.getBrowserState();
      const newToken = newLoginState.localStorage['auth-token'];
      expect(newToken).toBeDefined();
      expect(newToken).toContain('test-token-');
      expect(newToken).not.toBe(initialToken);
    });
  });

  describe('Browser Automation Mock Integration', () => {
    let fixture: LoggedInPageFixture;

    afterEach(async () => {
      if (fixture) {
        await fixture.afterEach();
      }
    });

    it('should integrate with browser automation mocks', async () => {
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

      // Test navigation mock
      const navigateResult = await (global as any).mockNavigate('/dashboard');
      expect(navigateResult.success).toBe(true);

      // Test screenshot mock
      const screenshot = await (global as any).mockScreenshot();
      expect(screenshot.data).toBe('mock-base64-image-data');
      expect(screenshot.format).toBe('png');

      // Test interaction mocks
      const clickResult = await (global as any).mockClick('#login-button');
      expect(clickResult.success).toBe(true);

      const typeResult = await (global as any).mockType('#username', 'test@example.com');
      expect(typeResult.success).toBe(true);

      // Test evaluation mock
      const title = await (global as any).mockEvaluate('document.title');
      expect(title).toBe('APEX Dashboard');

      // Verify mocks are cleaned up after teardown
      await fixture.afterEach();
      expect(global.mockNavigate).toBeUndefined();
      expect(global.mockScreenshot).toBeUndefined();
    });

    it('should support custom automation responses', async () => {
      const customResponses = {
        mockCustomAction: { success: true, data: 'custom-data' },
        mockApiCall: { status: 200, body: { message: 'API success' } }
      };

      fixture = createLoggedInPageFixture({
        mockBrowserAutomation: true,
        automationConfig: {
          customResponses
        }
      });

      await fixture.beforeEach();

      const customResult = await (global as any).mockCustomAction();
      expect(customResult.success).toBe(true);
      expect(customResult.data).toBe('custom-data');

      const apiResult = await (global as any).mockApiCall();
      expect(apiResult.status).toBe(200);
      expect(apiResult.body.message).toBe('API success');
    });
  });

  describe('Real Browser Integration Scenarios', () => {
    let fixture: LoggedInPageFixture;

    afterEach(async () => {
      if (fixture) {
        await fixture.afterEach();
      }
    });

    it('should create state that can be used with real browser tools', async () => {
      fixture = createLoggedInPageFixture({
        userProfile: {
          id: 'browser-test-user',
          email: 'browser@test.com',
          role: 'editor'
        },
        customLocalStorage: {
          'ui-theme': 'dark',
          'sidebar-collapsed': 'false'
        }
      });

      await fixture.beforeEach();

      const state = fixture.getBrowserState();

      // State should be suitable for browser injection
      expect(state.localStorage['auth-token']).toBeDefined();
      expect(state.localStorage['user-profile']).toBeDefined();
      expect(state.localStorage['ui-theme']).toBe('dark');

      const userProfile = JSON.parse(state.localStorage['user-profile']);
      expect(userProfile.id).toBe('browser-test-user');

      // Simulate typical browser automation workflow
      fixture.addNetworkRequest('https://app.apex.dev', 'GET', 200);
      fixture.addConsoleMessage('info', 'Page loaded');
      fixture.addNetworkRequest('https://api.apex.dev/auth/verify', 'POST', 200, {
        'Authorization': `Bearer ${state.localStorage['auth-token']}`
      });

      const finalState = fixture.getBrowserState();
      expect(finalState.networkRequests).toHaveLength(3); // Initial auth calls + new ones
    });

    it('should support localStorage injection for browser tests', async () => {
      const testData = {
        'feature-flags': JSON.stringify(['dark-mode', 'advanced-editor']),
        'user-preferences': JSON.stringify({
          notifications: true,
          autoSave: true,
          shortcuts: { save: 'Ctrl+S' }
        }),
        'workspace-state': JSON.stringify({
          openTabs: ['file1.ts', 'file2.ts'],
          activeTab: 'file1.ts'
        })
      };

      fixture = createLoggedInPageFixture({
        customLocalStorage: testData
      });

      await fixture.beforeEach();

      const state = fixture.getBrowserState();

      // Verify all custom data is present
      expect(state.localStorage['feature-flags']).toBe(testData['feature-flags']);
      expect(state.localStorage['user-preferences']).toBe(testData['user-preferences']);
      expect(state.localStorage['workspace-state']).toBe(testData['workspace-state']);

      // Data should be parseable
      const featureFlags = JSON.parse(state.localStorage['feature-flags']);
      expect(featureFlags).toContain('dark-mode');

      const userPrefs = JSON.parse(state.localStorage['user-preferences']);
      expect(userPrefs.notifications).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    let fixture: LoggedInPageFixture;

    afterEach(async () => {
      if (fixture) {
        await fixture.afterEach();
      }
    });

    it('should handle custom setup/teardown errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      let setupCalled = false;

      fixture = createLoggedInPageFixture({
        customSetup: async () => {
          setupCalled = true;
          throw new Error('Setup failure simulation');
        },
        customTeardown: async () => {
          throw new Error('Teardown failure simulation');
        }
      });

      // Setup should propagate the error
      await expect(fixture.beforeEach()).rejects.toThrow('Setup failure simulation');
      expect(setupCalled).toBe(true);

      // Create new fixture for teardown test
      fixture = createLoggedInPageFixture({
        customTeardown: async () => {
          throw new Error('Teardown failure simulation');
        }
      });

      await fixture.beforeEach();

      // Teardown should handle error gracefully
      await expect(fixture.afterEach()).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Custom teardown failed:',
        expect.objectContaining({ message: 'Teardown failure simulation' })
      );

      consoleSpy.mockRestore();
    });

    it('should handle malformed user profile data', async () => {
      // This tests resilience when fixture receives bad data
      const malformedConfig = {
        userProfile: {
          id: '', // Empty ID should be handled
          // @ts-expect-error - Testing invalid role
          role: 'invalid-role',
          email: 'not-an-email' // Invalid email format
        } as any
      };

      fixture = createLoggedInPageFixture(malformedConfig);
      await fixture.beforeEach();

      // Should still create a working fixture with defaults
      const state = fixture.getBrowserState();
      expect(state.isAuthenticated).toBe(true);

      // Profile should be stored even if malformed
      const userInfo = extractUserInfo(state);
      expect(userInfo).not.toBeNull();
      expect(userInfo?.id).toBe(''); // Preserves the malformed ID
      expect(userInfo?.email).toBe('not-an-email');
    });

    it('should handle browser automation mock failures', async () => {
      fixture = createLoggedInPageFixture({
        mockBrowserAutomation: true,
        automationConfig: {
          mockNavigate: true,
          customResponses: {
            failingMock: () => {
              throw new Error('Mock failure');
            }
          }
        }
      });

      await fixture.beforeEach();

      // Working mock should function
      const navigateResult = await (global as any).mockNavigate('/test');
      expect(navigateResult.success).toBe(true);

      // Failing mock should throw
      await expect((global as any).failingMock()).rejects.toThrow('Mock failure');
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle rapid fixture creation and cleanup', async () => {
      const fixtures: LoggedInPageFixture[] = [];
      const startMemory = process.memoryUsage().heapUsed;

      // Create and cleanup many fixtures rapidly
      for (let i = 0; i < 10; i++) {
        const fixture = createLoggedInPageFixture({
          userProfile: { id: `perf-test-${i}` }
        });
        fixtures.push(fixture);

        await fixture.beforeEach();

        // Simulate some operations
        fixture.updateBrowserState({ title: `Test ${i}` });
        fixture.addConsoleMessage('info', `Operation ${i}`);
        fixture.addNetworkRequest(`https://api.test.com/op${i}`, 'GET', 200);

        await fixture.afterEach();
      }

      // Memory should not grow excessively
      const endMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = endMemory - startMemory;

      // Allow for some growth but not excessive (arbitrary threshold)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // 50MB threshold

      // Environment should be clean
      expect(getTestEnvironment()).toBeNull();
    });

    it('should handle large state objects efficiently', async () => {
      const largeData = {
        massiveArray: Array(1000).fill(0).map((_, i) => ({
          id: i,
          data: `large-data-entry-${i}`,
          metadata: { created: new Date().toISOString() }
        })),
        complexObject: Object.fromEntries(
          Array(100).fill(0).map((_, i) => [`key${i}`, { value: `data${i}` }])
        )
      };

      const fixture = createLoggedInPageFixture({
        customLocalStorage: {
          'large-data': JSON.stringify(largeData)
        }
      });

      await fixture.beforeEach();

      const state = fixture.getBrowserState();
      const retrievedData = JSON.parse(state.localStorage['large-data']);

      expect(retrievedData.massiveArray).toHaveLength(1000);
      expect(Object.keys(retrievedData.complexObject)).toHaveLength(100);

      // Operations should still be performant
      const startTime = Date.now();
      fixture.updateBrowserState({ title: 'Updated with large data' });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be fast

      await fixture.afterEach();
    });
  });
});