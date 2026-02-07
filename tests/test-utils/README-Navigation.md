# Navigation Test Utilities

This module provides comprehensive navigation testing utilities for APEX, including helper functions for common navigation operations and test fixtures for browser context and page setup/teardown.

## Quick Start

### Basic Navigation Testing

```typescript
import { createNavigationTestHelper } from '@apex/test-utils';

describe('Navigation Tests', () => {
  let helper: NavigationTestHelper;

  beforeEach(async () => {
    helper = await NavigationTestSetup.basic({ headless: true });
  });

  afterEach(async () => {
    await helper.teardown();
  });

  it('should navigate to a page', async () => {
    const result = await helper.goto('https://example.com');
    expect(result.success).toBe(true);

    await helper.assertURL({ url: 'https://example.com/' });
    await helper.assertPageContent({ text: 'Example' });
  });
});
```

### Using Test Fixtures

```typescript
import { NavigationTestFixtureFactory, TestScenarios } from '@apex/test-utils';

describe('Navigation Fixtures', () => {
  let fixture: NavigationTestFixture;

  beforeEach(async () => {
    fixture = NavigationTestFixtureFactory.createUnitTestFixture();
    await fixture.setup();
  });

  afterEach(async () => {
    await fixture.teardown();
  });

  it('should test form navigation', async () => {
    await TestScenarios.formSubmission(fixture);

    // Test form interactions
    const page = fixture.page;
    await page.fill('#name', 'John Doe');
    await page.fill('#email', 'john@example.com');

    // Assert form state
    await fixture.navigationHelper.assertPageContent({
      selector: '#name',
      visible: true
    });
  });
});
```

## Navigation Helper Functions

### `goto(url, options)`

Navigate to a URL with comprehensive error handling and metrics collection.

```typescript
const result = await helper.goto('https://example.com', {
  timeout: 30000,
  waitUntil: 'networkidle',
  referer: 'https://referrer.com'
});

console.log(`Navigation took ${result.duration}ms`);
console.log(`Final URL: ${result.finalUrl}`);
```

### `waitForNavigation(options)`

Wait for navigation to complete with timeout and retry logic.

```typescript
await helper.waitForNavigation({
  timeout: 15000,
  waitUntil: 'load'
});
```

### `assertURL(assertion)`

Assert that the current URL matches the expected pattern.

```typescript
// Exact URL match
await helper.assertURL({ url: 'https://example.com/page' });

// Regex match
await helper.assertURL({ url: /example\.com/ });

// Pathname only
await helper.assertURL({
  url: '/page',
  pathname: true
});

// Ignore query parameters
await helper.assertURL({
  url: 'https://example.com/page',
  ignoreQuery: true
});
```

### `assertPageContent(assertion)`

Assert that the page content matches the expected criteria.

```typescript
// Text content
await helper.assertPageContent({ text: 'Welcome' });

// Regex text match
await helper.assertPageContent({ text: /welcome/i });

// Element visibility
await helper.assertPageContent({
  selector: '#header',
  visible: true
});

// Element count
await helper.assertPageContent({
  selector: '.item',
  count: 5
});
```

### `waitForElement(selector, options)`

Wait for an element to appear and optionally become visible.

```typescript
// Wait for element to be visible
await helper.waitForElement('#dynamic-content', {
  visible: true,
  timeout: 10000
});

// Wait for element to exist (but not necessarily visible)
await helper.waitForElement('#hidden-element', {
  visible: false
});
```

## Test Fixtures

### NavigationTestFixture

Manages browser lifecycle with test isolation.

```typescript
const fixture = new NavigationTestFixture(
  { headless: true, timeout: 30000 }, // Navigation config
  { incognito: true, clearCookies: true } // Isolation options
);

await fixture.setup();
await fixture.reset(); // Clean state for new test
await fixture.teardown();
```

### Factory Methods

Pre-configured fixtures for different testing scenarios:

```typescript
// Fast unit tests
const unitFixture = NavigationTestFixtureFactory.createUnitTestFixture();

// Comprehensive integration tests
const integrationFixture = NavigationTestFixtureFactory.createIntegrationTestFixture();

// Debugging with visual browser
const debugFixture = NavigationTestFixtureFactory.createDebugFixture();

// CI-optimized testing
const ciFixture = NavigationTestFixtureFactory.createCIFixture();
```

## Test Page Templates

Pre-built HTML templates for common testing scenarios:

```typescript
import { TestPageTemplates } from '@apex/test-utils';

// Simple page
await page.setContent(TestPageTemplates.simple);

// Form page
await page.setContent(TestPageTemplates.form);

// SPA-like navigation
await page.setContent(TestPageTemplates.spa);

// Async loading page
await page.setContent(TestPageTemplates.loading);
```

## Test Scenarios

Pre-configured test scenarios with page setup:

```typescript
import { TestScenarios } from '@apex/test-utils';

// Basic navigation
await TestScenarios.basicNavigation(fixture);

// Form submission testing
await TestScenarios.formSubmission(fixture);

// SPA navigation testing
await TestScenarios.spaNavigation(fixture);

// Async loading testing
await TestScenarios.asyncLoading(fixture);
```

## Test Isolation

The fixtures provide comprehensive test isolation:

- **Browser Context**: Each test gets an isolated browser context
- **Storage**: localStorage, sessionStorage, and cookies are cleared between tests
- **Network**: Optional network request/response logging
- **Console**: Optional console message capture
- **Screenshots**: Automatic failure screenshots (configurable)

### Isolation Options

```typescript
const fixture = new NavigationTestFixture(
  navigationConfig,
  {
    incognito: true,           // Use incognito context
    clearCookies: true,        // Clear cookies between tests
    clearLocalStorage: true,   // Clear localStorage between tests
    clearSessionStorage: true, // Clear sessionStorage between tests
    captureNetworkLogs: true,  // Log network activity
    captureConsoleLogs: true,  // Log console messages
  }
);

// Access captured logs
const networkActivity = fixture.networkActivity;
const consoleActivity = fixture.consoleActivity;
```

## Advanced Usage

### Custom Page Configuration

```typescript
const customPage = await fixture.createPage({
  content: '<html><body><h1>Custom Page</h1></body></html>',
  viewport: { width: 800, height: 600 },
  userAgent: 'Custom User Agent',
  extraHeaders: {
    'X-Custom-Header': 'value'
  }
});
```

### Performance Metrics

```typescript
const result = await helper.goto('https://example.com');
if (result.metrics) {
  console.log(`Load time: ${result.metrics.loadTime}ms`);
  console.log(`DOM ready: ${result.metrics.domContentLoaded}ms`);
  console.log(`Network requests: ${result.metrics.networkRequests}`);
}
```

### Event Handling

```typescript
helper.on('navigation:start', ({ url, options }) => {
  console.log(`Starting navigation to ${url}`);
});

helper.on('navigation:success', ({ url, result }) => {
  console.log(`Successfully navigated to ${url} in ${result.duration}ms`);
});

helper.on('navigation:error', ({ url, error }) => {
  console.error(`Failed to navigate to ${url}:`, error);
});
```

## Best Practices

1. **Use Appropriate Fixtures**: Choose the right fixture type for your test scenario
2. **Test Isolation**: Always use fresh fixtures for each test to ensure isolation
3. **Cleanup**: Properly tear down fixtures to prevent resource leaks
4. **Timeouts**: Set appropriate timeouts based on your test requirements
5. **Error Handling**: Use try-catch blocks for navigation operations that might fail
6. **Screenshots**: Enable failure screenshots for debugging complex navigation issues

## TypeScript Support

All utilities are fully typed with comprehensive TypeScript definitions. The module exports all necessary types for proper type checking:

```typescript
import type {
  NavigationTestConfig,
  NavigationOptions,
  PageContentAssertion,
  URLAssertion,
  NavigationResult,
  TestIsolationOptions,
  PageFixtureConfig
} from '@apex/test-utils';
```