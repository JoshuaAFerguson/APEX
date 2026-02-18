# Playwright Test Fixtures

This module provides reusable browser context and page fixtures for Playwright tests with comprehensive configuration options and lifecycle management.

## Features

- ✅ **Browser Context Fixtures**: Configurable browser contexts with setup/teardown
- ✅ **Page Fixtures**: Page instances with lifecycle hooks and automatic cleanup
- ✅ **Configuration Options**: Headless mode, viewport, recording, timeouts
- ✅ **Console Capture**: Automatic console message collection
- ✅ **Network Capture**: Request/response monitoring
- ✅ **Error Handling**: Automatic screenshot and trace collection on failures
- ✅ **Multiple Configurations**: Pre-defined configs for common scenarios

## Quick Start

```typescript
import { test, expect, BROWSER_CONFIGS } from './fixtures';

test('basic page interaction', async ({ pageWithConfig }) => {
  await pageWithConfig.goto('https://example.com');
  await pageWithConfig.click('button');
  await expect(pageWithConfig.locator('h1')).toBeVisible();
});
```

## Available Fixtures

### Basic Fixtures

#### `cleanPage`
Creates a fresh page for each test with default configuration.

```typescript
test('simple test', async ({ cleanPage }) => {
  await cleanPage.goto('https://example.com');
  await expect(cleanPage).toHaveTitle('Example Domain');
});
```

#### `cleanBrowserContext`
Creates a fresh browser context for each test.

```typescript
test('context test', async ({ cleanBrowserContext }) => {
  const page = await cleanBrowserContext.newPage();
  await page.goto('https://example.com');
  await page.close();
});
```

### Advanced Fixtures

#### `pageWithConfig`
Page with full configuration options and lifecycle management.

```typescript
test.use({
  testConfig: {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    consoleCapture: true,
    networkCapture: true,
    recordTrace: true,
  }
});

test('configured page test', async ({ pageWithConfig }) => {
  await pageWithConfig.goto('https://example.com');
  // Page automatically configured with specified options
});
```

#### `configurablePage`
Dynamic page creation with per-test configuration.

```typescript
test('dynamic config test', async ({ configurablePage }) => {
  const mobilePage = await configurablePage({
    viewport: { width: 375, height: 667 },
    isMobile: true,
    hasTouch: true,
  });

  const desktopPage = await configurablePage({
    viewport: { width: 1920, height: 1080 },
    isMobile: false,
  });

  // Use both pages as needed
});
```

#### `pageWithConsoleCapture`
Page with automatic console message collection.

```typescript
test('console capture test', async ({ pageWithConsoleCapture }) => {
  const { page, consoleMessages } = pageWithConsoleCapture;

  await page.goto('https://example.com');
  await page.click('button');

  // Check captured console messages
  expect(consoleMessages).toContainEqual(
    expect.objectContaining({
      type: 'log',
      text: expect.stringContaining('button clicked'),
    })
  );
});
```

#### `pageWithNetworkCapture`
Page with automatic network request/response capture.

```typescript
test('network capture test', async ({ pageWithNetworkCapture }) => {
  const { page, networkRequests } = pageWithNetworkCapture;

  await page.goto('https://api.example.com');

  // Check captured network requests
  const apiRequest = networkRequests.find(req =>
    req.url.includes('/api/data')
  );
  expect(apiRequest).toBeDefined();
  expect(apiRequest.method).toBe('GET');
});
```

#### `loggedInPage`
Creates an authenticated page with pre-configured user session and browser state.
This fixture integrates the core logged-in page fixture with a real Playwright page.

```typescript
test('authenticated user dashboard', async ({ loggedInPage }) => {
  const { page, authFixture, browserState } = loggedInPage;

  // Browser state is already authenticated
  expect(browserState.isAuthenticated).toBe(true);
  expect(browserState.localStorage['auth-token']).toBeDefined();

  // Navigate to protected page that checks authentication from localStorage
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <body>
      <div id="auth-status">
        ${localStorage.getItem('auth-token') ? 'Logged In' : 'Not Authenticated'}
      </div>
      <div id="user-info"></div>
      <script>
        const userProfile = localStorage.getItem('user-profile');
        if (userProfile) {
          const user = JSON.parse(userProfile);
          document.getElementById('user-info').textContent = user.displayName;
        }
      </script>
    </body>
    </html>
  `);

  // Page recognizes authentication
  await expect(page.locator('#auth-status')).toHaveText('Logged In');

  // Test fixture methods
  authFixture.updateUserProfile({ displayName: 'Updated User' });
  const updatedProfile = authFixture.getUserProfile();
  expect(updatedProfile.displayName).toBe('Updated User');
});

// Test logout simulation
test('logout flow with fixture', async ({ loggedInPage }) => {
  const { authFixture } = loggedInPage;

  // Verify initial authenticated state
  let state = authFixture.getBrowserState();
  expect(state.isAuthenticated).toBe(true);

  // Simulate logout
  const loggedOutState = authFixture.simulateLogout();
  expect(loggedOutState.isAuthenticated).toBe(false);
  expect(loggedOutState.localStorage).toEqual({});
});

// Test role switching
test('admin role access', async ({ loggedInPage }) => {
  const { authFixture } = loggedInPage;

  // Switch to admin user
  authFixture.simulateLogin({
    role: 'admin',
    displayName: 'Admin User',
    email: 'admin@example.com'
  });

  const adminProfile = authFixture.getUserProfile();
  expect(adminProfile.role).toBe('admin');
  expect(adminProfile.displayName).toBe('Admin User');
});
```

## Authentication Test Helpers

The module also provides specialized helpers for authentication testing scenarios:

### `createAuthTestPage(page)`
Creates a comprehensive test page that displays authentication status, user information, and provides interactive elements for testing auth flows.

```typescript
import { createAuthTestPage, assertPageAuthenticated } from './fixtures';

test('auth page setup', async ({ loggedInPage }) => {
  const { page } = loggedInPage;

  await createAuthTestPage(page);
  await assertPageAuthenticated(page, {
    displayName: 'Test User',
    role: 'editor'
  });
});
```

### `setupAuthenticatedTest(page, authFixture, userProfile?)`
Convenience function that sets up an authenticated test scenario with a test page.

```typescript
test('quick auth setup', async ({ loggedInPage }) => {
  const { page, authFixture } = loggedInPage;

  await setupAuthenticatedTest(page, authFixture, {
    displayName: 'Custom User',
    role: 'admin'
  });

  // Page is now set up and authenticated as admin
});
```

### `testUserRole(page, authFixture, role, displayName)`
Tests switching to different user roles with automatic assertions.

```typescript
test('role switching', async ({ loggedInPage }) => {
  const { page, authFixture } = loggedInPage;

  await createAuthTestPage(page);

  // Test admin role
  await testUserRole(page, authFixture, 'admin', 'Admin User');

  // Test viewer role
  await testUserRole(page, authFixture, 'viewer', 'Viewer User');
});
```

### `triggerApiCall(page)` and other utilities
Interact with the test page to trigger API calls, capture console messages, etc.

```typescript
test('api interaction', async ({ loggedInPage }) => {
  const { page } = loggedInPage;

  await createAuthTestPage(page);

  // Trigger API call through test page UI
  const result = await triggerApiCall(page);
  expect(result).toContain('API call completed');

  // Get console messages
  const messages = await getPageConsoleMessages(page);
  expect(messages.some(msg => msg.includes('Making API call'))).toBe(true);
});
```

## Configuration Options

### `BrowserFixtureConfig`

```typescript
interface BrowserFixtureConfig {
  headless?: boolean;              // Run in headless mode (default: true)
  viewport?: ViewportSize;         // Browser viewport size
  recordVideo?: boolean;           // Record test execution video
  recordTrace?: boolean;           // Record Playwright trace
  screenshotMode?: 'off' | 'only-on-failure' | 'on';
  locale?: string;                 // Browser locale
  timezone?: string;               // Browser timezone
  geolocation?: { latitude: number; longitude: number };
  permissions?: string[];          // Browser permissions to grant
  userAgent?: string;              // Custom user agent
  deviceScaleFactor?: number;      // Device pixel ratio
  hasTouch?: boolean;              // Enable touch events
  isMobile?: boolean;              // Mobile device simulation
}
```

### `PageFixtureConfig` (extends `BrowserFixtureConfig`)

```typescript
interface PageFixtureConfig extends BrowserFixtureConfig {
  baseURL?: string;               // Base URL for navigation
  navigationTimeout?: number;      // Navigation timeout (default: 30000ms)
  actionTimeout?: number;          // Action timeout (default: 10000ms)
  consoleCapture?: boolean;        // Enable console message capture
  networkCapture?: boolean;        // Enable network request capture
  autoCleanup?: boolean;           // Auto cleanup on test completion
}
```

## Pre-defined Configurations

Use pre-defined configurations for common scenarios:

```typescript
import { BROWSER_CONFIGS, VIEWPORT_CONFIGS } from './fixtures';

// Use pre-defined browser configurations
test.use({ testConfig: BROWSER_CONFIGS.mobile });
test.use({ testConfig: BROWSER_CONFIGS.withTrace });
test.use({ testConfig: BROWSER_CONFIGS.withVideo });

// Use pre-defined viewport configurations
test.use({
  testConfig: {
    viewport: VIEWPORT_CONFIGS.tablet
  }
});
```

Available configurations:

- `BROWSER_CONFIGS.headless` - Standard headless configuration
- `BROWSER_CONFIGS.headed` - Headed mode for debugging
- `BROWSER_CONFIGS.mobile` - Mobile device simulation
- `BROWSER_CONFIGS.tablet` - Tablet device simulation
- `BROWSER_CONFIGS.withTrace` - Enable trace recording
- `BROWSER_CONFIGS.withVideo` - Enable video recording

## Utility Functions

### `createTestPage(page: Page)`
Creates a standard test page with common elements.

```typescript
test('test page utility', async ({ cleanPage }) => {
  await createTestPage(cleanPage);

  // Page now has standard test elements:
  // - Button with id="test-button"
  // - Input with id="test-input"
  // - Output div with id="output"

  await cleanPage.click('#test-button');
  await expect(cleanPage.locator('#output')).toContainText('Button clicked');
});
```

### `waitForElement(page, selector, options)`
Wait for element with custom options.

```typescript
test('wait for element', async ({ cleanPage }) => {
  await cleanPage.goto('https://slow-loading-site.com');

  // Wait for specific element with custom timeout
  await waitForElement(cleanPage, '#dynamic-content', {
    timeout: 15000,
    visible: true,
  });
});
```

### `waitForPageReady(page)`
Wait for page to be fully loaded.

```typescript
test('wait for page ready', async ({ cleanPage }) => {
  await cleanPage.goto('https://heavy-site.com');
  await waitForPageReady(cleanPage);

  // Page is now fully loaded with network idle
});
```

### `captureConsoleMessages(page, action, expectedMessages)`
Capture and validate console messages during an action.

```typescript
test('console validation', async ({ cleanPage }) => {
  await cleanPage.goto('https://example.com');

  await captureConsoleMessages(
    cleanPage,
    async () => {
      await cleanPage.click('#submit-button');
    },
    [
      { type: 'log', text: 'form submitted' },
      { type: 'info', text: 'validation passed' },
    ]
  );
});
```

## Environment Variables

Control fixture behavior with environment variables:

- `HEADED=true` - Run tests in headed mode
- `VIDEO=true` - Enable video recording
- `TRACE=true` - Enable trace recording

```bash
# Run tests in headed mode with video recording
HEADED=true VIDEO=true npm run playwright:test
```

## Examples

### Basic Test
```typescript
import { test, expect } from './fixtures';

test('basic functionality', async ({ cleanPage }) => {
  await cleanPage.goto('https://example.com');
  await cleanPage.click('button');
  await expect(cleanPage.locator('h1')).toBeVisible();
});
```

### Mobile Testing
```typescript
test('mobile responsiveness', async ({ configurablePage }) => {
  const page = await configurablePage(BROWSER_CONFIGS.mobile);

  await page.goto('https://responsive-site.com');
  await expect(page.locator('.mobile-menu')).toBeVisible();
});
```

### Console Message Testing
```typescript
test('console messages', async ({ pageWithConsoleCapture }) => {
  const { page, consoleMessages } = pageWithConsoleCapture;

  await page.goto('https://app.com');
  await page.click('#debug-button');

  expect(consoleMessages).toContainEqual(
    expect.objectContaining({
      type: 'log',
      text: expect.stringContaining('debug info'),
    })
  );
});
```

### Network Request Testing
```typescript
test('API calls', async ({ pageWithNetworkCapture }) => {
  const { page, networkRequests } = pageWithNetworkCapture;

  await page.goto('https://spa-app.com');
  await page.click('#load-data');

  const apiCall = networkRequests.find(req =>
    req.url.includes('/api/users')
  );

  expect(apiCall).toBeDefined();
  expect(apiCall.method).toBe('GET');
  expect(apiCall.status).toBe(200);
});
```

### Multi-Browser Testing
```typescript
test('cross-browser compatibility', async ({ configurablePage }) => {
  const chromePage = await configurablePage({
    userAgent: 'Chrome/90.0.4430.212',
  });

  const firefoxPage = await configurablePage({
    userAgent: 'Firefox/88.0',
  });

  // Test both browsers
  await chromePage.goto('https://example.com');
  await firefoxPage.goto('https://example.com');

  // Validate consistent behavior
});
```

## Best Practices

1. **Use appropriate fixtures**: Choose the minimal fixture that meets your needs
2. **Configure once**: Use `test.use()` to configure fixtures for all tests in a file
3. **Cleanup automatically**: Enable `autoCleanup` for production tests
4. **Capture on failure**: Enable tracing and video for debugging difficult issues
5. **Test responsively**: Use different viewport configurations to test responsive design
6. **Monitor performance**: Use network capture to validate performance characteristics
7. **Validate console**: Use console capture to catch JavaScript errors and warnings

## Troubleshooting

### Common Issues

**Tests are slow**
- Reduce timeout values
- Disable video/trace recording for fast tests
- Use `networkidle` sparingly

**Screenshots not captured**
- Ensure `screenshotMode` is not set to `'off'`
- Check that test directory is writable

**Console messages not captured**
- Enable `consoleCapture` in test configuration
- Check that console events are fired after page load

**Network requests missing**
- Enable `networkCapture` in test configuration
- Ensure requests happen after listener setup