# Logged-In Page Fixture - Implementation Guide

This guide documents the fully implemented `createLoggedInPageFixture` for authenticated browser state testing in the APEX codebase.

## Overview

The logged-in page fixture provides an integrated solution for testing scenarios that require authenticated browser state. It combines browser state management with setup/teardown utilities to create a comprehensive testing environment.

## Key Features

- ✅ **Fully Implemented** - Production-ready fixture with comprehensive test coverage
- 🔐 **Authentication State Management** - Simulates logged-in users with various roles
- 🌐 **Browser State Integration** - Manages localStorage, sessionStorage, and cookies
- 🔄 **Session Lifecycle** - Supports login, logout, and session switching
- 🛠️ **Browser Automation Mocks** - Optional mocking of browser automation tools
- 🧪 **Setup/Teardown Integration** - Built-in test lifecycle management

## Installation & Import

The fixture is available through the centralized test fixtures module:

```typescript
import {
  createLoggedInPageFixture,
  createBasicLoggedInFixture,
  createAdminLoggedInFixture,
  assertAuthenticated,
  extractUserInfo,
  type LoggedInPageFixture,
  type UserProfile,
  type LoggedInPageFixtureConfig
} from '@apexcli/core/test-fixtures';
```

## Basic Usage

### Simple Authenticated Test

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLoggedInPageFixture } from '@apexcli/core/test-fixtures';

describe('Dashboard Tests', () => {
  const fixture = createLoggedInPageFixture();

  beforeEach(fixture.beforeEach);
  afterEach(fixture.afterEach);

  it('should have authenticated browser state', () => {
    const state = fixture.getBrowserState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.localStorage['auth-token']).toBeDefined();
  });
});
```

### Custom User Configuration

```typescript
const fixture = createLoggedInPageFixture({
  userProfile: {
    id: 'custom-user-123',
    email: 'test@example.com',
    role: 'admin',
    displayName: 'Test Admin'
  },
  customLocalStorage: {
    'theme': 'dark',
    'sidebar-collapsed': 'true'
  }
});
```

## Advanced Configuration

### Complete Configuration Options

```typescript
const fixture = createLoggedInPageFixture({
  // User profile configuration
  userProfile: {
    id: 'user-001',
    email: 'user@example.com',
    role: 'editor', // 'viewer' | 'editor' | 'admin' | 'owner'
    displayName: 'Test User',
    metadata: {
      theme: 'dark',
      notifications: true,
      preferences: { /* ... */ }
    }
  },

  // Authentication session settings
  authSession: {
    timeout: 3600, // Session timeout in seconds
    sessionId: 'custom-session-id',
    customHeaders: {
      'X-Custom-Auth': 'value'
    }
  },

  // Browser state customization
  customLocalStorage: {
    'app-settings': JSON.stringify({ theme: 'dark' }),
    'user-preferences': 'enabled'
  },

  customSessionStorage: {
    'current-workspace': 'workspace-123',
    'active-tabs': JSON.stringify(['tab1', 'tab2'])
  },

  customCookies: [
    {
      name: 'session-cookie',
      value: 'abc123',
      domain: 'app.apex.dev',
      path: '/'
    }
  ],

  // Browser automation mocking
  mockBrowserAutomation: true,
  automationConfig: {
    mockNavigate: true,
    mockScreenshots: true,
    mockInteractions: true,
    mockEvaluation: true,
    customResponses: {
      'mockCustomAction': { success: true }
    }
  },

  // Custom setup/teardown
  customSetup: async () => {
    // Custom initialization
  },

  customTeardown: async () => {
    // Custom cleanup
  }
});
```

## API Reference

### Main Functions

#### `createLoggedInPageFixture(config?: LoggedInPageFixtureConfig)`
Creates a logged-in page fixture with the specified configuration.

#### `createBasicLoggedInFixture(role?: UserRole)`
Convenience function for basic authenticated testing with minimal configuration.

#### `createAdminLoggedInFixture()`
Pre-configured fixture with admin privileges and admin-specific features enabled.

### Fixture Methods

#### Browser State Management

```typescript
// Get current browser state
const state = fixture.getBrowserState();

// Update browser state
const newState = fixture.updateBrowserState({
  url: 'https://app.example.com/dashboard',
  title: 'Updated Title'
});

// Reset to initial authenticated state
const resetState = fixture.resetToInitialState();
```

#### User Profile Management

```typescript
// Get user profile
const profile = fixture.getUserProfile();

// Update user profile
const updatedProfile = fixture.updateUserProfile({
  displayName: 'New Display Name',
  role: 'admin'
});
```

#### Session Management

```typescript
// Simulate logout
const loggedOutState = fixture.simulateLogout();

// Simulate login with different user
const newState = fixture.simulateLogin({
  role: 'admin',
  email: 'admin@example.com'
}, {
  sessionId: 'new-session-123'
});
```

#### State Tracking

```typescript
// Add console message
fixture.addConsoleMessage('info', 'User performed action');

// Add network request
fixture.addNetworkRequest(
  'https://api.example.com/endpoint',
  'POST',
  200,
  { 'Authorization': 'Bearer token' }
);
```

### Helper Functions

```typescript
// Assert browser state is authenticated
assertAuthenticated(browserState);

// Extract user information from browser state
const userInfo = extractUserInfo(browserState);
```

## Integration Examples

### API Endpoint Testing

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLoggedInPageFixture, assertAuthenticated, extractUserInfo } from '@apexcli/core/test-fixtures';

describe('Authenticated API Tests', () => {
  let fixture: LoggedInPageFixture;
  let apiContext: TestContext;

  beforeEach(async () => {
    apiContext = await createTestEnvironment();

    fixture = createLoggedInPageFixture({
      userProfile: {
        role: 'editor',
        email: 'api-test@example.com'
      }
    });

    await fixture.beforeEach();
  });

  afterEach(async () => {
    await fixture.afterEach();
    await apiContext.cleanup();
  });

  it('should authenticate API requests', async () => {
    const browserState = fixture.getBrowserState();
    assertAuthenticated(browserState);

    const response = await apiContext.app.inject({
      method: 'GET',
      url: '/user/profile',
      headers: {
        'Authorization': `Bearer ${browserState.localStorage['auth-token']}`
      }
    });

    expect(response.statusCode).toBe(200);
  });

  it('should handle role-based access', async () => {
    const userInfo = extractUserInfo(fixture.getBrowserState());
    expect(userInfo?.role).toBe('editor');

    // Test editor-level access
    const response = await apiContext.app.inject({
      method: 'POST',
      url: '/documents',
      headers: {
        'Authorization': `Bearer ${fixture.getBrowserState().localStorage['auth-token']}`,
        'X-User-Role': userInfo?.role
      },
      payload: { title: 'New Document' }
    });

    expect(response.statusCode).toBe(201);
  });

  it('should simulate session changes', async () => {
    // Start as editor
    expect(extractUserInfo(fixture.getBrowserState())?.role).toBe('editor');

    // Switch to admin
    fixture.simulateLogin({ role: 'admin' });
    expect(extractUserInfo(fixture.getBrowserState())?.role).toBe('admin');

    // Test admin API access
    const response = await apiContext.app.inject({
      method: 'DELETE',
      url: '/admin/users/test-user',
      headers: {
        'Authorization': `Bearer ${fixture.getBrowserState().localStorage['auth-token']}`
      }
    });

    expect(response.statusCode).toBeDefined();
  });
});
```

### Browser Integration Testing

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Browser, Page } from 'playwright';
import { createBrowser, createPage } from '../setup';
import { createLoggedInPageFixture, assertAuthenticated } from '@apexcli/core/test-fixtures';

describe('Authenticated Browser Tests', () => {
  let browser: Browser;
  let page: Page;
  let fixture: LoggedInPageFixture;

  beforeEach(async () => {
    browser = await createBrowser();
    page = await createPage(browser);

    fixture = createLoggedInPageFixture({
      userProfile: { role: 'editor' },
      mockBrowserAutomation: true
    });

    await fixture.beforeEach();
  });

  afterEach(async () => {
    await fixture.afterEach();
    await page.close();
    await browser.close();
  });

  it('should load authenticated dashboard', async () => {
    const browserState = fixture.getBrowserState();
    assertAuthenticated(browserState);

    // Create authenticated dashboard HTML
    const dashboardHTML = createAuthenticatedDashboard(browserState);
    await page.goto(`data:text/html,${encodeURIComponent(dashboardHTML)}`);

    // Verify user information is displayed
    const userDisplay = await page.locator('[data-testid="user-name"]');
    expect(await userDisplay.textContent()).toContain(browserState.localStorage['user-profile']);

    // Test user interactions
    await page.click('[data-action="save"]');

    // Track interaction in fixture
    fixture.addConsoleMessage('info', 'User clicked save button');
    fixture.addNetworkRequest('https://api.example.com/save', 'POST', 200);
  });

  it('should handle role-based UI elements', async () => {
    const browserState = fixture.getBrowserState();
    const dashboardHTML = createRoleBasedUI(browserState);
    await page.goto(`data:text/html,${encodeURIComponent(dashboardHTML)}`);

    // Editor should see edit buttons
    const editButton = await page.locator('[data-role="editor"] button');
    expect(await editButton.isVisible()).toBe(true);

    // Admin panel should be hidden
    const adminPanel = await page.locator('[data-role="admin"]');
    expect(await adminPanel.isVisible()).toBe(false);
  });

  it('should simulate logout flow', async () => {
    let browserState = fixture.getBrowserState();
    assertAuthenticated(browserState);

    const dashboardHTML = createSessionAwarePage(browserState);
    await page.goto(`data:text/html,${encodeURIComponent(dashboardHTML)}`);

    // Verify logged-in state
    const userMenu = await page.locator('[data-testid="user-menu"]');
    expect(await userMenu.isVisible()).toBe(true);

    // Simulate logout
    fixture.simulateLogout();

    // Update page to reflect logged-out state
    await page.evaluate(() => {
      document.querySelector('[data-testid="user-menu"]')?.setAttribute('style', 'display: none');
      document.querySelector('[data-testid="login-prompt"]')?.setAttribute('style', 'display: block');
    });

    // Verify logout state
    expect(await userMenu.isVisible()).toBe(false);
    const loginPrompt = await page.locator('[data-testid="login-prompt"]');
    expect(await loginPrompt.isVisible()).toBe(true);
  });
});
```

## Usage Patterns

### Pattern 1: Basic Authentication Testing
Use `createBasicLoggedInFixture()` for simple tests that just need an authenticated user:

```typescript
const fixture = createBasicLoggedInFixture('editor');
```

### Pattern 2: Admin-Specific Testing
Use `createAdminLoggedInFixture()` for testing admin features:

```typescript
const adminFixture = createAdminLoggedInFixture();
// Automatically includes admin features and privileges
```

### Pattern 3: Multi-User Testing
Create multiple fixtures for testing interactions between different user types:

```typescript
const userFixture = createLoggedInPageFixture({ userProfile: { role: 'viewer' } });
const adminFixture = createLoggedInPageFixture({ userProfile: { role: 'admin' } });
```

### Pattern 4: Session Management Testing
Test session timeouts and user switching:

```typescript
const fixture = createLoggedInPageFixture();

// Test initial authenticated state
assertAuthenticated(fixture.getBrowserState());

// Test logout
fixture.simulateLogout();
expect(fixture.getBrowserState().isAuthenticated).toBe(false);

// Test login as different user
fixture.simulateLogin({ role: 'admin', email: 'admin@example.com' });
```

### Pattern 5: Browser Automation Integration
Combine with browser automation for full UI testing:

```typescript
const fixture = createLoggedInPageFixture({
  mockBrowserAutomation: true,
  automationConfig: {
    mockNavigate: true,
    mockScreenshots: true,
    mockInteractions: true
  }
});

// Browser automation mocks are available as global functions
await global.mockNavigate('/dashboard');
const screenshot = await global.mockScreenshot();
```

## Testing Strategy

### Unit Tests
Use the fixture for testing individual components that depend on authentication state:

```typescript
it('should render user profile component', () => {
  const browserState = fixture.getBrowserState();
  const userInfo = extractUserInfo(browserState);

  const component = renderUserProfile(userInfo);
  expect(component).toMatchSnapshot();
});
```

### Integration Tests
Use the fixture for testing API endpoints and services:

```typescript
it('should handle authenticated API requests', async () => {
  const browserState = fixture.getBrowserState();
  const token = browserState.localStorage['auth-token'];

  const result = await apiService.getUserData(token);
  expect(result.user.email).toBe('test-user@example.com');
});
```

### End-to-End Tests
Use the fixture with browser automation for complete user flows:

```typescript
it('should complete authenticated user workflow', async () => {
  const browserState = fixture.getBrowserState();

  // Set up authenticated page
  await page.goto('/dashboard');
  await injectAuthState(page, browserState);

  // Perform authenticated actions
  await page.click('[data-action="create-task"]');
  await page.fill('[name="task-title"]', 'New Task');
  await page.click('[data-action="save"]');

  // Verify results
  expect(await page.locator('.task-item').count()).toBe(1);
});
```

## Best Practices

### 1. Always Use Setup/Teardown
```typescript
beforeEach(fixture.beforeEach);
afterEach(fixture.afterEach);
```

### 2. Verify Authentication State
```typescript
const browserState = fixture.getBrowserState();
assertAuthenticated(browserState);
```

### 3. Use Appropriate Fixtures
- `createBasicLoggedInFixture()` for simple tests
- `createAdminLoggedInFixture()` for admin features
- `createLoggedInPageFixture()` for custom configurations

### 4. Track User Interactions
```typescript
fixture.addConsoleMessage('info', 'User performed action');
fixture.addNetworkRequest('https://api.example.com/endpoint', 'POST', 201);
```

### 5. Test Role-Based Features
```typescript
const userInfo = extractUserInfo(fixture.getBrowserState());
// Test features specific to userInfo.role
```

### 6. Simulate Real User Flows
```typescript
// Login -> Use app -> Logout
fixture.simulateLogin({ role: 'user' });
// ... test user actions ...
fixture.simulateLogout();
// ... test logged-out state ...
```

## File Locations

- **Main Implementation**: `/packages/core/src/test-fixtures/logged-in-page-fixture.ts`
- **Unit Tests**: `/packages/core/src/test-fixtures/__tests__/logged-in-page-fixture.test.ts`
- **API Integration Example**: `/packages/api/src/__tests__/authenticated-endpoint-integration.test.ts`
- **Browser Integration Example**: `/tests/browser-integration/authenticated-user-scenarios.test.ts`
- **Types**: `/packages/core/src/test-fixtures/types.ts`

## Summary

The logged-in page fixture is a production-ready solution that provides:

- ✅ **Complete Implementation** - Fully implemented with comprehensive test coverage
- ✅ **Browser State Management** - Handles localStorage, sessionStorage, cookies, and authentication state
- ✅ **User Profile Management** - Supports multiple user roles and profile customization
- ✅ **Session Lifecycle** - Login, logout, and session switching capabilities
- ✅ **Integration Ready** - Works with API tests, browser automation, and unit tests
- ✅ **Extensible** - Supports custom setup/teardown and browser automation mocking
- ✅ **Well Documented** - Comprehensive examples and usage patterns

The fixture integrates seamlessly with the existing APEX testing infrastructure and provides a robust foundation for authenticated browser state testing across all packages.