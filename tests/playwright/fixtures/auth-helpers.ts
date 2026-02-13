/**
 * @fileoverview Authentication test helpers for Playwright fixtures
 *
 * This module provides convenience utilities for testing authentication scenarios
 * with the logged-in page fixture.
 */

import type { Page } from '@playwright/test';
import type {
  LoggedInPageFixture,
  BrowserState,
  UserProfile
} from '@apexcli/core/test-fixtures';

/**
 * Sets up a test page that checks authentication from localStorage
 */
export async function createAuthTestPage(page: Page): Promise<void> {
  await page.setContent(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Authentication Test Page</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          background: #f5f5f5;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .auth-status {
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
        }
        .authenticated {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          color: #155724;
        }
        .not-authenticated {
          background: #f8d7da;
          border: 1px solid #f5c6cb;
          color: #721c24;
        }
        .user-info {
          background: #f9f9f9;
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
        }
        .action-buttons {
          margin: 10px 0;
        }
        .button {
          background: #007acc;
          color: white;
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin: 5px;
        }
        .button:hover {
          background: #005a99;
        }
        .api-test {
          margin: 20px 0;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Authentication Test Page</h1>

        <div id="auth-status" class="auth-status">Loading...</div>

        <div id="user-info" class="user-info" style="display: none;">
          <h3>User Information</h3>
          <div id="user-details"></div>
        </div>

        <div class="action-buttons">
          <button id="refresh-auth" class="button">Refresh Auth Status</button>
          <button id="logout-btn" class="button" style="display: none;">Logout</button>
        </div>

        <div class="api-test">
          <h3>API Test</h3>
          <button id="test-api" class="button">Test Authenticated API Call</button>
          <div id="api-result" style="margin-top: 10px;"></div>
        </div>

        <div id="console-log" style="margin-top: 20px; font-family: monospace; background: #f0f0f0; padding: 10px; border-radius: 4px;">
          <strong>Console Messages:</strong>
          <div id="console-messages"></div>
        </div>
      </div>

      <script>
        function checkAuthStatus() {
          const authToken = localStorage.getItem('auth-token');
          const userProfile = localStorage.getItem('user-profile');
          const statusEl = document.getElementById('auth-status');
          const userInfoEl = document.getElementById('user-info');
          const userDetailsEl = document.getElementById('user-details');
          const logoutBtn = document.getElementById('logout-btn');

          if (authToken && userProfile) {
            statusEl.textContent = '✅ Authenticated';
            statusEl.className = 'auth-status authenticated';

            try {
              const user = JSON.parse(userProfile);
              userDetailsEl.innerHTML =
                '<p><strong>ID:</strong> ' + user.id + '</p>' +
                '<p><strong>Email:</strong> ' + user.email + '</p>' +
                '<p><strong>Display Name:</strong> ' + user.displayName + '</p>' +
                '<p><strong>Role:</strong> ' + user.role + '</p>' +
                '<p><strong>Auth Token:</strong> ' + authToken.substring(0, 20) + '...</p>';

              userInfoEl.style.display = 'block';
              logoutBtn.style.display = 'inline-block';

              console.log('Auth status checked: authenticated as', user.displayName);
            } catch (e) {
              console.error('Failed to parse user profile:', e);
            }
          } else {
            statusEl.textContent = '❌ Not Authenticated';
            statusEl.className = 'auth-status not-authenticated';
            userInfoEl.style.display = 'none';
            logoutBtn.style.display = 'none';

            console.log('Auth status checked: not authenticated');
          }
        }

        function logMessage(message) {
          const messagesEl = document.getElementById('console-messages');
          const messageDiv = document.createElement('div');
          messageDiv.textContent = new Date().toISOString() + ': ' + message;
          messagesEl.appendChild(messageDiv);
        }

        // Override console methods to capture messages
        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;

        console.log = function(...args) {
          logMessage('LOG: ' + args.join(' '));
          originalConsoleLog.apply(console, args);
        };

        console.error = function(...args) {
          logMessage('ERROR: ' + args.join(' '));
          originalConsoleError.apply(console, args);
        };

        // Event listeners
        document.getElementById('refresh-auth').addEventListener('click', checkAuthStatus);

        document.getElementById('logout-btn').addEventListener('click', () => {
          localStorage.removeItem('auth-token');
          localStorage.removeItem('user-profile');
          sessionStorage.clear();
          console.log('User logged out - localStorage cleared');
          checkAuthStatus();
        });

        document.getElementById('test-api').addEventListener('click', async () => {
          const resultEl = document.getElementById('api-result');
          const authToken = localStorage.getItem('auth-token');

          if (!authToken) {
            resultEl.textContent = 'No auth token available';
            resultEl.style.color = 'red';
            return;
          }

          console.log('Making API call with auth token...');
          resultEl.textContent = 'Making API call...';
          resultEl.style.color = 'blue';

          try {
            // Simulate API call (will fail but demonstrates the flow)
            const response = await fetch('https://httpbin.org/headers', {
              method: 'GET',
              headers: {
                'Authorization': 'Bearer ' + authToken,
                'Content-Type': 'application/json',
                'X-Test-Source': 'auth-test-page'
              }
            });

            console.log('API response status:', response.status);
            resultEl.textContent = 'API call completed with status: ' + response.status;
            resultEl.style.color = response.ok ? 'green' : 'orange';

          } catch (error) {
            console.error('API call failed:', error.message);
            resultEl.textContent = 'API call failed: ' + error.message;
            resultEl.style.color = 'red';
          }
        });

        // Initialize page
        console.log('Authentication test page loaded');
        checkAuthStatus();
      </script>
    </body>
    </html>
  `);

  await page.waitForLoadState('domcontentloaded');
}

/**
 * Asserts that a page shows authenticated state
 */
export async function assertPageAuthenticated(
  page: Page,
  expectedUser?: Partial<UserProfile>
): Promise<void> {
  // Check that the auth status indicates authenticated
  await page.locator('#auth-status.authenticated').waitFor({ timeout: 5000 });

  if (expectedUser) {
    if (expectedUser.displayName) {
      await page.locator('#user-details').getByText(expectedUser.displayName).waitFor();
    }
    if (expectedUser.role) {
      await page.locator('#user-details').getByText(expectedUser.role).waitFor();
    }
    if (expectedUser.email) {
      await page.locator('#user-details').getByText(expectedUser.email).waitFor();
    }
  }
}

/**
 * Asserts that a page shows unauthenticated state
 */
export async function assertPageUnauthenticated(page: Page): Promise<void> {
  await page.locator('#auth-status.not-authenticated').waitFor({ timeout: 5000 });
  await page.locator('#user-info[style*="display: none"]').waitFor();
}

/**
 * Triggers an API call from the test page and returns the result
 */
export async function triggerApiCall(page: Page): Promise<string> {
  await page.click('#test-api');

  // Wait for API call to complete
  await page.waitForTimeout(2000);

  return await page.locator('#api-result').textContent() || '';
}

/**
 * Gets captured console messages from the test page
 */
export async function getPageConsoleMessages(page: Page): Promise<string[]> {
  const messagesText = await page.locator('#console-messages').textContent();
  return messagesText ? messagesText.split('\n').filter(line => line.trim()) : [];
}

/**
 * Simulates logout through the test page UI
 */
export async function simulatePageLogout(page: Page): Promise<void> {
  await page.click('#logout-btn');
  await page.waitForTimeout(100); // Allow logout to complete
}

/**
 * Refreshes the authentication status on the test page
 */
export async function refreshAuthStatus(page: Page): Promise<void> {
  await page.click('#refresh-auth');
  await page.waitForTimeout(100); // Allow refresh to complete
}

/**
 * Convenience function to set up authenticated test scenario
 */
export async function setupAuthenticatedTest(
  page: Page,
  authFixture: LoggedInPageFixture,
  userProfile?: Partial<UserProfile>
): Promise<void> {
  if (userProfile) {
    authFixture.updateUserProfile(userProfile);
  }

  await createAuthTestPage(page);
  await assertPageAuthenticated(page, userProfile || authFixture.getUserProfile());
}

/**
 * Test different user roles with assertions
 */
export async function testUserRole(
  page: Page,
  authFixture: LoggedInPageFixture,
  role: UserProfile['role'],
  expectedDisplayName: string
): Promise<void> {
  // Switch user role
  authFixture.simulateLogin({
    role,
    displayName: expectedDisplayName,
    email: \`\${role}@example.com\`
  });

  // Refresh the page to reflect new auth state
  await refreshAuthStatus(page);

  // Assert the new role is displayed
  await assertPageAuthenticated(page, {
    role,
    displayName: expectedDisplayName
  });
}