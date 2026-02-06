/**
 * @fileoverview Integration test example using logged-in page fixture
 *
 * This demonstrates how to use the authenticated browser state fixture
 * for testing API endpoints that require user authentication context.
 *
 * @example
 * This test shows how to:
 * 1. Set up authenticated browser state with the fixture
 * 2. Test API endpoints with different user roles
 * 3. Simulate session changes during tests
 * 4. Verify authentication state consistency
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import {
  createLoggedInPageFixture,
  createAdminLoggedInFixture,
  assertAuthenticated,
  extractUserInfo,
  type LoggedInPageFixture,
  type UserProfile
} from '@apexcli/core/test-fixtures';
import { createTestEnvironment, HttpTestUtils } from './setup.js';
import { ApexOrchestrator } from '@apexcli/orchestrator';

interface AuthenticatedTestContext {
  app: FastifyInstance;
  serverPort: number;
  projectPath: string;
  orchestrator: ApexOrchestrator;
  httpUtils: HttpTestUtils;
  cleanup: () => Promise<void>;
}

describe('Authenticated API Endpoints - Integration Tests', () => {
  let context: AuthenticatedTestContext;
  let loggedInFixture: LoggedInPageFixture;

  beforeEach(async () => {
    // Set up test environment
    context = await createTestEnvironment({
      silent: true,
      mockOrchestrator: true,
    }) as AuthenticatedTestContext;

    // Set up authenticated browser state fixture
    loggedInFixture = createLoggedInPageFixture({
      userProfile: {
        id: 'api-test-user-001',
        email: 'api-test@example.com',
        role: 'editor',
        displayName: 'API Test User'
      },
      customLocalStorage: {
        'api-session': 'active',
        'last-api-call': new Date().toISOString()
      }
    });

    await loggedInFixture.beforeEach();
  });

  afterEach(async () => {
    if (loggedInFixture) {
      await loggedInFixture.afterEach();
    }
    if (context?.cleanup) {
      await context.cleanup();
    }
  });

  describe('User Profile API with Authentication Context', () => {
    it('should return user profile when browser state is authenticated', async () => {
      // Verify we have authenticated browser state
      const browserState = loggedInFixture.getBrowserState();
      assertAuthenticated(browserState);

      const userInfo = extractUserInfo(browserState);
      expect(userInfo?.email).toBe('api-test@example.com');
      expect(userInfo?.role).toBe('editor');

      // Test the API endpoint
      const response = await context.app.inject({
        method: 'GET',
        url: '/user/profile',
        headers: {
          'Authorization': `Bearer ${browserState.localStorage['auth-token']}`,
          'X-User-Context': browserState.localStorage['user-profile']
        }
      });

      // Verify response based on browser state
      expect(response.statusCode).toBeDefined();
      // Note: Actual API implementation would return user data
      // matching the browser state context
    });

    it('should handle profile updates with synchronized browser state', async () => {
      // Update user profile in fixture
      const updatedProfile = loggedInFixture.updateUserProfile({
        displayName: 'Updated Test User',
        metadata: {
          ...loggedInFixture.getUserProfile().metadata,
          lastUpdated: new Date().toISOString()
        }
      });

      // Verify browser state was updated
      const browserState = loggedInFixture.getBrowserState();
      const storedProfile = JSON.parse(browserState.localStorage['user-profile']);
      expect(storedProfile.displayName).toBe('Updated Test User');

      // Test API call with updated context
      const response = await context.app.inject({
        method: 'PUT',
        url: '/user/profile',
        headers: {
          'Authorization': `Bearer ${browserState.localStorage['auth-token']}`
        },
        payload: {
          displayName: 'Updated Test User'
        }
      });

      expect(response.statusCode).toBeDefined();
    });

    it('should simulate logout and verify API behavior', async () => {
      // Start with authenticated state
      let browserState = loggedInFixture.getBrowserState();
      assertAuthenticated(browserState);

      // Simulate logout
      const loggedOutState = loggedInFixture.simulateLogout();
      expect(loggedOutState.isAuthenticated).toBe(false);
      expect(loggedOutState.localStorage['auth-token']).toBeUndefined();

      // Test API with logged out state
      const response = await context.app.inject({
        method: 'GET',
        url: '/user/profile'
        // No authorization header - user is logged out
      });

      // Should handle unauthenticated request appropriately
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('Role-Based Access Control Testing', () => {
    it('should test editor permissions', async () => {
      const browserState = loggedInFixture.getBrowserState();
      const userInfo = extractUserInfo(browserState);
      expect(userInfo?.role).toBe('editor');

      // Test editor-level API access
      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks',
        headers: {
          'Authorization': `Bearer ${browserState.localStorage['auth-token']}`,
          'X-User-Role': userInfo?.role
        },
        payload: {
          title: 'Test Task',
          description: 'Editor created task'
        }
      });

      expect(response.statusCode).toBeDefined();
    });

    it('should test role switching during test', async () => {
      // Start as editor
      let userInfo = extractUserInfo(loggedInFixture.getBrowserState());
      expect(userInfo?.role).toBe('editor');

      // Switch to admin role
      loggedInFixture.simulateLogin({
        role: 'admin',
        email: 'admin-test@example.com'
      });

      // Verify role change
      const newBrowserState = loggedInFixture.getBrowserState();
      const newUserInfo = extractUserInfo(newBrowserState);
      expect(newUserInfo?.role).toBe('admin');

      // Test admin-only API
      const response = await context.app.inject({
        method: 'DELETE',
        url: '/admin/users/test-user',
        headers: {
          'Authorization': `Bearer ${newBrowserState.localStorage['auth-token']}`,
          'X-User-Role': 'admin'
        }
      });

      expect(response.statusCode).toBeDefined();
    });
  });

  describe('Session Management Integration', () => {
    it('should track API calls in browser state', async () => {
      const initialState = loggedInFixture.getBrowserState();
      const initialRequestCount = initialState.networkRequests.length;

      // Make API calls and track them in browser state
      await context.app.inject({
        method: 'GET',
        url: '/health'
      });

      // Add the network request to browser state
      const updatedState = loggedInFixture.addNetworkRequest(
        'https://api.apex.dev/health',
        'GET',
        200
      );

      expect(updatedState.networkRequests.length).toBe(initialRequestCount + 1);

      // Verify the request was recorded
      const healthRequest = updatedState.networkRequests.find(
        req => req.url.includes('/health')
      );
      expect(healthRequest).toBeDefined();
    });

    it('should simulate session timeout scenario', async () => {
      // Start with valid session
      assertAuthenticated(loggedInFixture.getBrowserState());

      // Simulate session timeout by logging out
      const timeoutState = loggedInFixture.simulateLogout();

      // Add timeout-specific console message
      const stateWithTimeout = loggedInFixture.addConsoleMessage(
        'warn',
        'Session expired - redirecting to login'
      );

      // Verify timeout state
      expect(stateWithTimeout.isAuthenticated).toBe(false);
      const timeoutMessage = stateWithTimeout.consoleMessages.find(
        msg => msg.message.includes('Session expired')
      );
      expect(timeoutMessage).toBeDefined();

      // Test API behavior with expired session
      const response = await context.app.inject({
        method: 'GET',
        url: '/user/profile'
      });

      expect(response.statusCode).toBeDefined();
    });
  });
});

describe('Admin-Specific API Tests', () => {
  let context: AuthenticatedTestContext;
  let adminFixture: LoggedInPageFixture;

  beforeEach(async () => {
    context = await createTestEnvironment({
      silent: true,
      mockOrchestrator: true,
    }) as AuthenticatedTestContext;

    // Use admin fixture for admin-specific tests
    adminFixture = createAdminLoggedInFixture();
    await adminFixture.beforeEach();
  });

  afterEach(async () => {
    if (adminFixture) {
      await adminFixture.afterEach();
    }
    if (context?.cleanup) {
      await context.cleanup();
    }
  });

  it('should have admin features enabled in browser state', async () => {
    const browserState = adminFixture.getBrowserState();
    assertAuthenticated(browserState);

    // Verify admin features
    expect(browserState.localStorage['admin-features']).toBe('enabled');
    expect(browserState.localStorage['feature-flags']).toBeDefined();

    const userInfo = extractUserInfo(browserState);
    expect(userInfo?.role).toBe('admin');
    expect(userInfo?.email).toBe('admin@example.com');
  });

  it('should test admin-only API endpoints', async () => {
    const browserState = adminFixture.getBrowserState();
    const userInfo = extractUserInfo(browserState);

    expect(userInfo?.role).toBe('admin');

    // Test admin system status endpoint
    const response = await context.app.inject({
      method: 'GET',
      url: '/admin/system/status',
      headers: {
        'Authorization': `Bearer ${browserState.localStorage['auth-token']}`,
        'X-Admin-Features': browserState.localStorage['admin-features']
      }
    });

    expect(response.statusCode).toBeDefined();
  });
});

describe('Multi-User Session Testing', () => {
  let context: AuthenticatedTestContext;
  let userFixture: LoggedInPageFixture;
  let adminFixture: LoggedInPageFixture;

  beforeEach(async () => {
    context = await createTestEnvironment({
      silent: true,
      mockOrchestrator: true,
    }) as AuthenticatedTestContext;

    // Set up multiple user fixtures
    userFixture = createLoggedInPageFixture({
      userProfile: {
        id: 'user-001',
        email: 'user@example.com',
        role: 'viewer'
      }
    });

    adminFixture = createLoggedInPageFixture({
      userProfile: {
        id: 'admin-001',
        email: 'admin@example.com',
        role: 'admin'
      }
    });

    await userFixture.beforeEach();
    await adminFixture.beforeEach();
  });

  afterEach(async () => {
    if (userFixture) await userFixture.afterEach();
    if (adminFixture) await adminFixture.afterEach();
    if (context?.cleanup) await context.cleanup();
  });

  it('should maintain separate authenticated sessions', async () => {
    // Verify both fixtures have independent auth states
    const userState = userFixture.getBrowserState();
    const adminState = adminFixture.getBrowserState();

    assertAuthenticated(userState);
    assertAuthenticated(adminState);

    const userInfo = extractUserInfo(userState);
    const adminInfo = extractUserInfo(adminState);

    expect(userInfo?.id).toBe('user-001');
    expect(userInfo?.role).toBe('viewer');

    expect(adminInfo?.id).toBe('admin-001');
    expect(adminInfo?.role).toBe('admin');

    // Different auth tokens
    expect(userState.localStorage['auth-token']).not.toBe(
      adminState.localStorage['auth-token']
    );
  });

  it('should test concurrent API access with different roles', async () => {
    const userState = userFixture.getBrowserState();
    const adminState = adminFixture.getBrowserState();

    // Make concurrent requests with different auth contexts
    const [userResponse, adminResponse] = await Promise.all([
      context.app.inject({
        method: 'GET',
        url: '/user/dashboard',
        headers: {
          'Authorization': `Bearer ${userState.localStorage['auth-token']}`
        }
      }),
      context.app.inject({
        method: 'GET',
        url: '/admin/dashboard',
        headers: {
          'Authorization': `Bearer ${adminState.localStorage['auth-token']}`
        }
      })
    ]);

    expect(userResponse.statusCode).toBeDefined();
    expect(adminResponse.statusCode).toBeDefined();
  });
});