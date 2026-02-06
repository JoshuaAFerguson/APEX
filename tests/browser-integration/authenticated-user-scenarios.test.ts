/**
 * @fileoverview Authenticated Browser Integration Test Examples
 *
 * This demonstrates how to combine the logged-in page fixture with
 * browser automation for comprehensive authentication testing scenarios.
 *
 * @example
 * This test suite shows:
 * 1. Setting up authenticated browser state for UI testing
 * 2. Simulating logged-in user interactions
 * 3. Testing role-based UI components
 * 4. Session management in browser context
 * 5. Integration with actual browser automation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import {
  createBrowser,
  createBrowserContext,
  createPage,
  captureScreenshot
} from './setup';
import {
  createLoggedInPageFixture,
  createBasicLoggedInFixture,
  createAdminLoggedInFixture,
  assertAuthenticated,
  extractUserInfo,
  type LoggedInPageFixture,
  type UserProfile,
  type BrowserState
} from '@apexcli/core/test-fixtures';
import {
  takeScreenshot,
  waitForElement,
  safeClick,
  safeFill,
  waitForNetworkIdle,
  captureConsoleMessages
} from './utils/test-helpers';

describe('Authenticated User Browser Scenarios', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let authFixture: LoggedInPageFixture;

  beforeEach(async () => {
    // Set up browser automation
    browser = await createBrowser({ headless: true });
    context = await createBrowserContext(browser);
    page = await createPage(context);

    // Set up authenticated browser state fixture
    authFixture = createLoggedInPageFixture({
      userProfile: {
        id: 'browser-test-user',
        email: 'browser-user@example.com',
        role: 'editor',
        displayName: 'Browser Test User',
        metadata: {
          theme: 'dark',
          notifications: true,
          dashboardLayout: 'grid'
        }
      },
      customLocalStorage: {
        'ui-theme': 'dark',
        'sidebar-collapsed': 'false',
        'dashboard-widgets': JSON.stringify(['tasks', 'metrics', 'recent'])
      },
      mockBrowserAutomation: true,
      automationConfig: {
        mockNavigate: true,
        mockScreenshots: true,
        mockInteractions: true,
        mockEvaluation: true
      }
    });

    await authFixture.beforeEach();
  });

  afterEach(async () => {
    if (authFixture) {
      await authFixture.afterEach();
    }
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  });

  describe('Authenticated Dashboard UI Tests', () => {
    it('should load dashboard with authenticated user context', async () => {
      // Get authenticated browser state
      const browserState = authFixture.getBrowserState();
      assertAuthenticated(browserState);

      const userInfo = extractUserInfo(browserState);
      expect(userInfo?.role).toBe('editor');
      expect(userInfo?.displayName).toBe('Browser Test User');

      // Create a mock dashboard page with authenticated state
      const dashboardHTML = createAuthenticatedDashboardHTML(browserState);
      await page.goto(`data:text/html,${encodeURIComponent(dashboardHTML)}`);

      // Verify authenticated elements are present
      const userDisplay = await page.locator('[data-testid="user-display"]');
      const userDisplayText = await userDisplay.textContent();
      expect(userDisplayText).toContain('Browser Test User');

      const roleIndicator = await page.locator('[data-testid="user-role"]');
      const roleText = await roleIndicator.textContent();
      expect(roleText).toContain('editor');

      // Verify theme preference is applied
      const themeClass = await page.locator('body').getAttribute('class');
      expect(themeClass).toContain('theme-dark');

      // Take screenshot for verification
      await takeScreenshot(
        page,
        'authenticated-dashboard',
        globalThis.browserTestContext.tempDir!
      );
    });

    it('should display user-specific dashboard widgets', async () => {
      const browserState = authFixture.getBrowserState();
      const dashboardWidgets = JSON.parse(
        browserState.localStorage['dashboard-widgets']
      );

      // Create dashboard with widget configuration
      const dashboardHTML = createDashboardWithWidgets(browserState, dashboardWidgets);
      await page.goto(`data:text/html,${encodeURIComponent(dashboardHTML)}`);

      // Verify each widget is displayed
      for (const widget of dashboardWidgets) {
        const widgetElement = await page.locator(`[data-widget="${widget}"]`);
        expect(await widgetElement.isVisible()).toBe(true);
      }

      // Verify widget count matches user preferences
      const visibleWidgets = await page.locator('[data-widget]').count();
      expect(visibleWidgets).toBe(dashboardWidgets.length);
    });

    it('should handle user profile updates in UI', async () => {
      // Start with initial authenticated state
      const initialState = authFixture.getBrowserState();
      const dashboardHTML = createAuthenticatedDashboardHTML(initialState);
      await page.goto(`data:text/html,${encodeURIComponent(dashboardHTML)}`);

      // Verify initial display name
      let userDisplay = await page.locator('[data-testid="user-display"]').textContent();
      expect(userDisplay).toContain('Browser Test User');

      // Update user profile in fixture
      authFixture.updateUserProfile({
        displayName: 'Updated Browser User',
        metadata: {
          ...authFixture.getUserProfile().metadata,
          lastProfileUpdate: new Date().toISOString()
        }
      });

      // Simulate profile update in UI (in real app, this would be via API)
      await page.evaluate((newDisplayName) => {
        const element = document.querySelector('[data-testid="user-display"]');
        if (element) {
          element.textContent = newDisplayName;
        }
      }, 'Updated Browser User');

      // Verify updated display name
      userDisplay = await page.locator('[data-testid="user-display"]').textContent();
      expect(userDisplay).toContain('Updated Browser User');

      // Verify fixture state was updated
      const updatedProfile = authFixture.getUserProfile();
      expect(updatedProfile.displayName).toBe('Updated Browser User');
    });
  });

  describe('Role-Based UI Components', () => {
    it('should show editor-specific UI elements', async () => {
      const browserState = authFixture.getBrowserState();
      const userInfo = extractUserInfo(browserState);
      expect(userInfo?.role).toBe('editor');

      const roleBasedHTML = createRoleBasedUI(browserState);
      await page.goto(`data:text/html,${encodeURIComponent(roleBasedHTML)}`);

      // Editor should see create/edit buttons
      const createButton = await page.locator('[data-role="editor"] button[data-action="create"]');
      const editButton = await page.locator('[data-role="editor"] button[data-action="edit"]');

      expect(await createButton.isVisible()).toBe(true);
      expect(await editButton.isVisible()).toBe(true);

      // Admin-only elements should be hidden
      const adminPanel = await page.locator('[data-role="admin"]');
      expect(await adminPanel.isVisible()).toBe(false);
    });

    it('should handle role switching in UI', async () => {
      // Start as editor
      let browserState = authFixture.getBrowserState();
      let roleBasedHTML = createRoleBasedUI(browserState);
      await page.goto(`data:text/html,${encodeURIComponent(roleBasedHTML)}`);

      // Verify editor UI
      let editorElements = await page.locator('[data-role="editor"]').count();
      expect(editorElements).toBeGreaterThan(0);

      // Switch to admin role
      authFixture.simulateLogin({
        ...authFixture.getUserProfile(),
        role: 'admin'
      });

      // Update page with new role
      browserState = authFixture.getBrowserState();
      roleBasedHTML = createRoleBasedUI(browserState);
      await page.goto(`data:text/html,${encodeURIComponent(roleBasedHTML)}`);

      // Verify admin UI elements are now visible
      const adminElements = await page.locator('[data-role="admin"]').count();
      expect(adminElements).toBeGreaterThan(0);

      const deleteButton = await page.locator('button[data-action="delete"]');
      expect(await deleteButton.isVisible()).toBe(true);
    });
  });

  describe('Session Management UI Integration', () => {
    it('should handle session timeout warning', async () => {
      const browserState = authFixture.getBrowserState();
      const sessionHTML = createSessionAwareHTML(browserState);
      await page.goto(`data:text/html,${encodeURIComponent(sessionHTML)}`);

      // Simulate session timeout warning
      await page.evaluate(() => {
        // Simulate timeout warning (would normally come from server)
        const event = new CustomEvent('session-timeout-warning', {
          detail: { timeRemaining: 300 } // 5 minutes
        });
        window.dispatchEvent(event);
      });

      // Check for timeout warning UI
      await waitForElement(page, '[data-testid="session-warning"]', {
        visible: true,
        timeout: 5000
      });

      const warningText = await page.locator('[data-testid="session-warning"]').textContent();
      expect(warningText).toContain('session will expire');

      // Add console message to fixture
      authFixture.addConsoleMessage('warn', 'Session timeout warning displayed');

      const updatedState = authFixture.getBrowserState();
      const warningMessage = updatedState.consoleMessages.find(
        msg => msg.message.includes('Session timeout warning')
      );
      expect(warningMessage).toBeDefined();
    });

    it('should simulate automatic logout flow', async () => {
      const initialState = authFixture.getBrowserState();
      assertAuthenticated(initialState);

      const sessionHTML = createSessionAwareHTML(initialState);
      await page.goto(`data:text/html,${encodeURIComponent(sessionHTML)}`);

      // Verify logged-in UI
      const userMenu = await page.locator('[data-testid="user-menu"]');
      expect(await userMenu.isVisible()).toBe(true);

      // Simulate logout in fixture
      const loggedOutState = authFixture.simulateLogout();
      expect(loggedOutState.isAuthenticated).toBe(false);

      // Simulate logout in UI
      await page.evaluate(() => {
        // Simulate automatic logout
        const event = new CustomEvent('user-logged-out');
        window.dispatchEvent(event);
      });

      // Wait for logout UI changes
      await waitForElement(page, '[data-testid="login-prompt"]', {
        visible: true,
        timeout: 5000
      });

      // Verify logout UI
      const loginPrompt = await page.locator('[data-testid="login-prompt"]');
      expect(await loginPrompt.isVisible()).toBe(true);

      // User menu should be hidden
      expect(await userMenu.isVisible()).toBe(false);
    });

    it('should track user interactions in browser state', async () => {
      const browserState = authFixture.getBrowserState();
      const interactiveHTML = createInteractiveHTML(browserState);
      await page.goto(`data:text/html,${encodeURIComponent(interactiveHTML)}`);

      // Perform user interactions
      await safeClick(page, 'button[data-action="save-document"]');

      // Track interaction in fixture
      authFixture.addConsoleMessage('info', 'User clicked save document');
      authFixture.addNetworkRequest(
        'https://api.apex.dev/documents/save',
        'POST',
        200
      );

      // Fill form field
      await safeFill(page, 'input[name="document-title"]', 'Test Document');

      // Track form interaction
      authFixture.addConsoleMessage('info', 'User updated document title');

      // Verify interactions were tracked
      const updatedState = authFixture.getBrowserState();

      const saveMessage = updatedState.consoleMessages.find(
        msg => msg.message.includes('save document')
      );
      expect(saveMessage).toBeDefined();

      const saveRequest = updatedState.networkRequests.find(
        req => req.url.includes('documents/save')
      );
      expect(saveRequest).toBeDefined();
      expect(saveRequest?.status).toBe(200);

      const titleMessage = updatedState.consoleMessages.find(
        msg => msg.message.includes('document title')
      );
      expect(titleMessage).toBeDefined();
    });
  });
});

describe('Admin User Browser Scenarios', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let adminFixture: LoggedInPageFixture;

  beforeEach(async () => {
    browser = await createBrowser({ headless: true });
    context = await createBrowserContext(browser);
    page = await createPage(context);

    adminFixture = createAdminLoggedInFixture();
    await adminFixture.beforeEach();
  });

  afterEach(async () => {
    if (adminFixture) {
      await adminFixture.afterEach();
    }
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  });

  it('should display admin dashboard with all privileges', async () => {
    const browserState = adminFixture.getBrowserState();
    assertAuthenticated(browserState);

    const userInfo = extractUserInfo(browserState);
    expect(userInfo?.role).toBe('admin');
    expect(browserState.localStorage['admin-features']).toBe('enabled');

    const adminHTML = createAdminDashboardHTML(browserState);
    await page.goto(`data:text/html,${encodeURIComponent(adminHTML)}`);

    // Verify admin-specific elements
    const adminPanel = await page.locator('[data-testid="admin-panel"]');
    expect(await adminPanel.isVisible()).toBe(true);

    const userManagement = await page.locator('[data-admin-feature="user-management"]');
    expect(await userManagement.isVisible()).toBe(true);

    const systemSettings = await page.locator('[data-admin-feature="system-settings"]');
    expect(await systemSettings.isVisible()).toBe(true);

    // Verify feature flags are enabled
    const featureFlags = JSON.parse(browserState.localStorage['feature-flags']);
    expect(featureFlags).toContain('advanced-ui');
    expect(featureFlags).toContain('debug-mode');
  });

  it('should handle admin-only interactions', async () => {
    const browserState = adminFixture.getBrowserState();
    const adminHTML = createAdminDashboardHTML(browserState);
    await page.goto(`data:text/html,${encodeURIComponent(adminHTML)}`);

    // Test admin action
    await safeClick(page, 'button[data-admin-action="delete-user"]');

    // Track admin action in fixture
    adminFixture.addConsoleMessage('warn', 'Admin initiated user deletion');
    adminFixture.addNetworkRequest(
      'https://api.apex.dev/admin/users/delete',
      'DELETE',
      200
    );

    // Wait for confirmation dialog (would appear in real app)
    await page.evaluate(() => {
      const dialog = document.createElement('div');
      dialog.setAttribute('data-testid', 'delete-confirmation');
      dialog.textContent = 'Are you sure you want to delete this user?';
      document.body.appendChild(dialog);
    });

    const confirmDialog = await page.locator('[data-testid="delete-confirmation"]');
    expect(await confirmDialog.isVisible()).toBe(true);

    // Verify admin action was logged
    const updatedState = adminFixture.getBrowserState();
    const deleteAction = updatedState.consoleMessages.find(
      msg => msg.message.includes('user deletion')
    );
    expect(deleteAction).toBeDefined();
  });
});

// ============================================================================
// HTML Template Generators
// ============================================================================

function createAuthenticatedDashboardHTML(browserState: BrowserState): string {
  const userInfo = extractUserInfo(browserState);
  const theme = browserState.localStorage['ui-theme'] || 'light';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>APEX Dashboard - ${userInfo?.displayName}</title>
      <style>
        .theme-dark { background: #1a1a1a; color: #fff; }
        .theme-light { background: #fff; color: #000; }
        .user-info { padding: 1rem; border: 1px solid #ccc; margin: 1rem; }
        .widget { padding: 1rem; margin: 0.5rem; border: 1px solid #ddd; }
      </style>
    </head>
    <body class="theme-${theme}">
      <header>
        <div class="user-info">
          <div data-testid="user-display">Welcome, ${userInfo?.displayName}</div>
          <div data-testid="user-role">Role: ${userInfo?.role}</div>
          <div data-testid="user-email">${userInfo?.email}</div>
        </div>
      </header>
      <main>
        <h1>Dashboard</h1>
        <div id="widgets-container">
          <!-- Widgets will be added based on user preferences -->
        </div>
      </main>
    </body>
    </html>
  `;
}

function createDashboardWithWidgets(browserState: BrowserState, widgets: string[]): string {
  const userInfo = extractUserInfo(browserState);
  const widgetHTML = widgets.map(widget => `
    <div class="widget" data-widget="${widget}">
      <h3>${widget.charAt(0).toUpperCase() + widget.slice(1)} Widget</h3>
      <p>Content for ${widget}</p>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head><title>Dashboard with Widgets</title></head>
    <body>
      <header>
        <div data-testid="user-display">${userInfo?.displayName}</div>
      </header>
      <main>
        <div id="widgets-container">${widgetHTML}</div>
      </main>
    </body>
    </html>
  `;
}

function createRoleBasedUI(browserState: BrowserState): string {
  const userInfo = extractUserInfo(browserState);

  return `
    <!DOCTYPE html>
    <html>
    <head><title>Role-Based UI</title></head>
    <body>
      <div data-testid="user-role">${userInfo?.role}</div>

      <div data-role="editor" ${userInfo?.role === 'editor' ? '' : 'style="display: none;"'}>
        <button data-action="create">Create Document</button>
        <button data-action="edit">Edit Document</button>
      </div>

      <div data-role="admin" ${userInfo?.role === 'admin' ? '' : 'style="display: none;"'}>
        <button data-action="create">Create Document</button>
        <button data-action="edit">Edit Document</button>
        <button data-action="delete">Delete Document</button>
        <button data-action="manage-users">Manage Users</button>
      </div>

      <div data-role="viewer" ${userInfo?.role === 'viewer' ? '' : 'style="display: none;"'}>
        <p>Read-only access</p>
      </div>
    </body>
    </html>
  `;
}

function createSessionAwareHTML(browserState: BrowserState): string {
  const userInfo = extractUserInfo(browserState);

  return `
    <!DOCTYPE html>
    <html>
    <head><title>Session Aware UI</title></head>
    <body>
      <div data-testid="user-menu" ${browserState.isAuthenticated ? '' : 'style="display: none;"'}>
        <span>User: ${userInfo?.displayName}</span>
        <button>Logout</button>
      </div>

      <div data-testid="login-prompt" ${!browserState.isAuthenticated ? '' : 'style="display: none;"'}>
        <p>Please log in to continue</p>
      </div>

      <div data-testid="session-warning" style="display: none;">
        <p>Your session will expire soon</p>
      </div>

      <script>
        window.addEventListener('session-timeout-warning', function(event) {
          document.querySelector('[data-testid="session-warning"]').style.display = 'block';
        });

        window.addEventListener('user-logged-out', function(event) {
          document.querySelector('[data-testid="user-menu"]').style.display = 'none';
          document.querySelector('[data-testid="login-prompt"]').style.display = 'block';
        });
      </script>
    </body>
    </html>
  `;
}

function createInteractiveHTML(browserState: BrowserState): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Interactive UI</title></head>
    <body>
      <form>
        <input name="document-title" placeholder="Document Title" />
        <button type="button" data-action="save-document">Save Document</button>
      </form>

      <div id="actions-log">
        <h3>User Actions</h3>
        <ul id="actions-list"></ul>
      </div>

      <script>
        document.querySelector('[data-action="save-document"]').addEventListener('click', function() {
          const logList = document.getElementById('actions-list');
          const li = document.createElement('li');
          li.textContent = 'Document save initiated at ' + new Date().toISOString();
          logList.appendChild(li);
        });
      </script>
    </body>
    </html>
  `;
}

function createAdminDashboardHTML(browserState: BrowserState): string {
  const userInfo = extractUserInfo(browserState);

  return `
    <!DOCTYPE html>
    <html>
    <head><title>Admin Dashboard</title></head>
    <body>
      <header>
        <div data-testid="user-display">Admin: ${userInfo?.displayName}</div>
      </header>

      <div data-testid="admin-panel">
        <h2>Admin Panel</h2>

        <section data-admin-feature="user-management">
          <h3>User Management</h3>
          <button data-admin-action="delete-user">Delete User</button>
          <button data-admin-action="create-user">Create User</button>
        </section>

        <section data-admin-feature="system-settings">
          <h3>System Settings</h3>
          <button data-admin-action="modify-settings">Modify Settings</button>
        </section>
      </div>
    </body>
    </html>
  `;
}