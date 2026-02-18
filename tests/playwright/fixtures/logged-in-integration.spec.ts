/**
 * @fileoverview Integration test for logged-in page fixture
 *
 * This test verifies that the logged-in page fixture properly integrates
 * the core authentication fixture with Playwright page automation.
 */

import { test, expect } from './index';

test.describe('Logged-in Page Fixture Integration', () => {
  test('should provide authenticated browser state with real page', async ({ loggedInPage }) => {
    const { page, authFixture, browserState } = loggedInPage;

    // Verify fixture provides authenticated state
    expect(browserState.isAuthenticated).toBe(true);
    expect(browserState.localStorage['auth-token']).toBeDefined();
    expect(browserState.localStorage['user-profile']).toBeDefined();

    // Verify page has access to authentication data
    const authToken = await page.evaluate(() => localStorage.getItem('auth-token'));
    expect(authToken).toBeTruthy();

    const userProfile = await page.evaluate(() => localStorage.getItem('user-profile'));
    expect(userProfile).toBeTruthy();

    const parsedProfile = JSON.parse(userProfile);
    expect(parsedProfile.role).toBe('editor');
    expect(parsedProfile.displayName).toBe('Test User');

    // Verify fixture methods work
    const profile = authFixture.getUserProfile();
    expect(profile.id).toContain('logged-in-page-fixture-integration');
    expect(profile.email).toBe('test-user@example.com');
  });

  test('should sync console messages between page and fixture', async ({ loggedInPage }) => {
    const { page, authFixture } = loggedInPage;

    // Set up page with console logging
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <button id="log-btn">Log Message</button>
        <script>
          document.getElementById('log-btn').addEventListener('click', () => {
            console.log('Test message from page');
          });
        </script>
      </body>
      </html>
    `);

    // Trigger console message
    await page.click('#log-btn');
    await page.waitForTimeout(100); // Allow console message to be captured

    // Verify fixture captured the console message
    const browserState = authFixture.getBrowserState();
    const testMessages = browserState.consoleMessages.filter(msg =>
      msg.message.includes('Test message from page')
    );
    expect(testMessages.length).toBeGreaterThan(0);
  });

  test('should sync network requests between page and fixture', async ({ loggedInPage }) => {
    const { page, authFixture } = loggedInPage;

    // Set up page that makes a request
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <button id="fetch-btn">Make Request</button>
        <script>
          document.getElementById('fetch-btn').addEventListener('click', async () => {
            try {
              await fetch('https://httpbin.org/get', {
                headers: {
                  'Authorization': 'Bearer ' + localStorage.getItem('auth-token')
                }
              });
            } catch (e) {
              console.log('Request completed (expected to fail in test)');
            }
          });
        </script>
      </body>
      </html>
    `);

    // Trigger network request
    await page.click('#fetch-btn');
    await page.waitForTimeout(500); // Allow request to complete

    // Verify fixture captured the network request
    const browserState = authFixture.getBrowserState();
    const httpbinRequests = browserState.networkRequests.filter(req =>
      req.url.includes('httpbin.org')
    );
    expect(httpbinRequests.length).toBeGreaterThan(0);
    expect(httpbinRequests[0].headers?.['Authorization']).toContain('Bearer');
  });

  test('should allow updating user profile during test', async ({ loggedInPage }) => {
    const { page, authFixture } = loggedInPage;

    // Update profile through fixture
    authFixture.updateUserProfile({
      displayName: 'Updated Test User',
      role: 'admin'
    });

    // Verify the updated profile
    const updatedProfile = authFixture.getUserProfile();
    expect(updatedProfile.displayName).toBe('Updated Test User');
    expect(updatedProfile.role).toBe('admin');

    // Verify browser state reflects the update
    const browserState = authFixture.getBrowserState();
    const storedProfile = JSON.parse(browserState.localStorage['user-profile']);
    expect(storedProfile.displayName).toBe('Updated Test User');
    expect(storedProfile.role).toBe('admin');

    // Note: The page's localStorage is set during fixture setup,
    // so updates to the fixture don't automatically sync to the live page
    // This is expected behavior - the fixture manages state separately
  });

  test('should handle logout simulation', async ({ loggedInPage }) => {
    const { authFixture } = loggedInPage;

    // Verify initially authenticated
    let state = authFixture.getBrowserState();
    expect(state.isAuthenticated).toBe(true);

    // Simulate logout
    const loggedOutState = authFixture.simulateLogout();
    expect(loggedOutState.isAuthenticated).toBe(false);
    expect(loggedOutState.localStorage).toEqual({});
    expect(loggedOutState.sessionStorage).toEqual({});
    expect(loggedOutState.cookies).toEqual([]);

    // Verify logout was recorded in console messages
    const logoutMessages = loggedOutState.consoleMessages.filter(msg =>
      msg.message.includes('logged out')
    );
    expect(logoutMessages.length).toBeGreaterThan(0);
  });

  test('should handle login simulation with different user', async ({ loggedInPage }) => {
    const { authFixture } = loggedInPage;

    // Switch to different user
    authFixture.simulateLogin({
      displayName: 'New Admin User',
      role: 'admin',
      email: 'admin@example.com'
    });

    // Verify new user is active
    const newProfile = authFixture.getUserProfile();
    expect(newProfile.displayName).toBe('New Admin User');
    expect(newProfile.role).toBe('admin');
    expect(newProfile.email).toBe('admin@example.com');

    // Verify authentication state is maintained
    const browserState = authFixture.getBrowserState();
    expect(browserState.isAuthenticated).toBe(true);
    expect(browserState.localStorage['auth-token']).toBeDefined();
    expect(browserState.localStorage['user-profile']).toContain('admin@example.com');
  });
});