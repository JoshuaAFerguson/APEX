# Browser Fixtures Usage Guide

This comprehensive guide covers how to use the browser fixtures module for testing browser contexts and page setup/teardown in APEX.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Configuration Options](#configuration-options)
4. [Basic Usage](#basic-usage)
5. [Advanced Usage](#advanced-usage)
6. [Integration Patterns](#integration-patterns)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)
10. [Examples](#examples)

## Overview

The browser fixtures module (`tests/test-utils/browser-fixtures.ts`) provides a comprehensive solution for managing browser contexts and pages in tests. It supports:

- **Multiple Browser Types**: Chromium, Firefox, WebKit
- **Lifecycle Management**: Automatic setup and teardown
- **Configuration Options**: Viewport, timeouts, recording, traces
- **Performance Monitoring**: Metrics collection and analysis
- **Error Handling**: Retry logic and graceful failure recovery
- **Vitest Integration**: Global and scoped fixtures

## Quick Start

### 1. Global Browser Fixture (Recommended for most tests)

```typescript
import { describe, test, expect } from 'vitest';
import { setupBrowserFixture, getBrowserFixture } from './test-utils/browser-fixtures';

// Setup global fixture (usually in test setup file or beforeAll)
setupBrowserFixture({
  browserType: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 720 }
});

describe('My Browser Tests', () => {
  test('should interact with page', async () => {
    const fixture = getBrowserFixture();
    const page = fixture.getPage();

    await fixture.navigateTo('http://localhost:3000');
    await page.click('#my-button');

    const result = await page.textContent('#result');
    expect(result).toBe('Expected Text');
  });
});
```

### 2. Scoped Browser Fixture (For isolated tests)

```typescript
import { test, expect } from 'vitest';
import { createScopedBrowserFixture } from './test-utils/browser-fixtures';

test('should work in isolation', async () => {
  const fixture = await createScopedBrowserFixture({
    browserType: 'firefox',
    headless: false // For debugging
  });

  try {
    await fixture.navigateTo('http://example.com');
    await fixture.screenshot('test-screenshot');
    // ... test operations
  } finally {
    await fixture.teardown();
  }
});
```

## Configuration Options

### Basic Configuration

```typescript
interface BrowserFixtureConfig {
  // Browser settings
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  slowMo?: number;
  devtools?: boolean;

  // Viewport and display
  viewport: { width: number; height: number };

  // Timeouts and retries
  timeout: number;
  retries: number;

  // Recording and debugging
  captureFailureScreenshots: boolean;
  recordVideo: boolean;
  trace: boolean;

  // Paths and storage
  artifactDir: string;

  // Advanced options
  launchOptions?: Record<string, any>;
  contextOptions?: Record<string, any>;
}
```

### Environment-Based Configuration

```typescript
// Automatically adapts to environment
const config = {
  headless: process.env.CI === 'true' || process.env.HEADLESS === 'true',
  slowMo: process.env.CI ? 0 : 50,
  retries: process.env.CI ? 2 : 0,
  captureFailureScreenshots: true,
  recordVideo: process.env.RECORD_VIDEO === 'true',
  trace: process.env.TRACE === 'true',
};
```

## Basic Usage

### Navigation and Page Interactions

```typescript
test('basic page interactions', async () => {
  const fixture = await createScopedBrowserFixture();

  try {
    // Navigate with retry logic
    await fixture.navigateTo('http://localhost:3000');

    // Wait for elements
    await fixture.waitForElement('#main-content');

    // Interact with page
    const page = fixture.getPage();
    await page.fill('#username', 'testuser');
    await page.fill('#password', 'testpass');
    await page.click('#login-button');

    // Wait for navigation
    await fixture.waitForElement('#dashboard');

    // Verify result
    const welcome = await page.textContent('#welcome-message');
    expect(welcome).toContain('Welcome, testuser');

  } finally {
    await fixture.teardown();
  }
});
```

### Screenshots and Debugging

```typescript
test('visual testing with screenshots', async () => {
  const fixture = await createScopedBrowserFixture({
    captureFailureScreenshots: true
  });

  try {
    await fixture.navigateTo('http://localhost:3000');

    // Capture initial state
    await fixture.screenshot('initial-page');

    // Perform actions
    const page = fixture.getPage();
    await page.click('#toggle-theme');

    // Capture after action
    await fixture.screenshot('after-theme-toggle');

    // Screenshots are automatically saved to artifact directory
    const artifactDir = fixture.getArtifactDir();
    console.log(`Screenshots saved to: ${artifactDir}`);

  } finally {
    await fixture.teardown();
  }
});
```

### Performance Monitoring

```typescript
test('performance monitoring', async () => {
  const fixture = await createScopedBrowserFixture();

  try {
    await fixture.navigateTo('http://localhost:3000');

    // Collect performance metrics
    const metrics = await fixture.getPerformanceMetrics();

    expect(metrics.domContentLoaded).toBeLessThan(2000);
    expect(metrics.loadComplete).toBeLessThan(5000);
    expect(metrics.firstPaint).toBeLessThan(1000);

  } finally {
    await fixture.teardown();
  }
});
```

## Advanced Usage

### Multi-Browser Testing

```typescript
describe('Cross-browser compatibility', () => {
  const browsers: Array<'chromium' | 'firefox' | 'webkit'> = ['chromium', 'firefox', 'webkit'];

  browsers.forEach(browserType => {
    test(`should work in ${browserType}`, async () => {
      const fixture = await createScopedBrowserFixture({ browserType });

      try {
        await fixture.navigateTo('http://localhost:3000');
        // ... run same test in different browsers
      } finally {
        await fixture.teardown();
      }
    });
  });
});
```

### Multiple Pages and Contexts

```typescript
test('multi-page workflow', async () => {
  const fixture = await createScopedBrowserFixture();

  try {
    // Main page
    const mainPage = fixture.getPage();
    await fixture.navigateTo('http://localhost:3000');

    // Open new page
    const newPage = await fixture.createNewPage();
    await newPage.goto('http://localhost:3000/admin');

    // Work with both pages
    await mainPage.click('#user-action');
    await newPage.click('#admin-action');

    // Pages share the same browser context
    const context = fixture.getContext();
    const allPages = context.pages();
    expect(allPages.length).toBe(2);

    // Cleanup additional pages
    await newPage.close();

  } finally {
    await fixture.teardown();
  }
});
```

### Custom Page Content

```typescript
test('testing with custom HTML content', async () => {
  const fixture = await createScopedBrowserFixture();

  try {
    // Load custom HTML
    const customHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="test-component">
            <button id="action">Click me</button>
            <span id="result">Initial</span>
          </div>
          <script>
            document.getElementById('action').onclick = () => {
              document.getElementById('result').textContent = 'Clicked!';
            };
          </script>
        </body>
      </html>
    `;

    await loadPageContent(fixture, customHtml);

    // Test component
    const page = fixture.getPage();
    await page.click('#action');

    const result = await page.textContent('#result');
    expect(result).toBe('Clicked!');

  } finally {
    await fixture.teardown();
  }
});
```

### Using Built-in Test Pages

```typescript
test('using pre-built test pages', async () => {
  const fixture = await createScopedBrowserFixture();

  try {
    // Use built-in simple test page
    const simplePageHtml = PageUtils.createSimpleTestPage();
    await loadPageContent(fixture, simplePageHtml);

    const page = fixture.getPage();
    await page.fill('#test-input', 'Hello World');
    await page.click('#test-btn');

    const result = await page.textContent('#result');
    expect(result).toContain('Hello World');

  } finally {
    await fixture.teardown();
  }
});

test('using form test page', async () => {
  const fixture = await createScopedBrowserFixture();

  try {
    // Use built-in form test page
    const formPageHtml = PageUtils.createFormTestPage();
    await loadPageContent(fixture, formPageHtml);

    // Fill and submit form
    const page = fixture.getPage();
    await page.fill('#name', 'John Doe');
    await page.fill('#email', 'john@example.com');
    await page.selectOption('#category', 'support');
    await page.fill('#message', 'Test message');
    await page.click('button[type="submit"]');

    // Verify form submission
    const result = await page.textContent('#form-result');
    expect(result).toContain('Form Submitted!');

  } finally {
    await fixture.teardown();
  }
});
```

## Integration Patterns

### Vitest Test Lifecycle Integration

```typescript
// Global setup (in test setup file)
import { setupBrowserFixture } from './test-utils/browser-fixtures';

setupBrowserFixture({
  browserType: 'chromium',
  headless: true,
  viewport: { width: 1920, height: 1080 },
  captureFailureScreenshots: true,
});

// Individual tests
describe('Feature Tests', () => {
  test('feature A', async () => {
    const fixture = getBrowserFixture();
    // Test automatically gets clean browser state before each test
    // Failure screenshots automatically captured on test failure
  });
});
```

### Custom Test Hooks

```typescript
describe('Custom Lifecycle Management', () => {
  let fixture: BrowserFixture;

  beforeEach(async () => {
    fixture = await createScopedBrowserFixture({
      browserType: 'firefox',
      headless: true,
    });
  });

  afterEach(async () => {
    if (fixture) {
      await fixture.teardown();
    }
  });

  test('isolated test', async () => {
    // Each test gets a fresh fixture
    await fixture.navigateTo('http://localhost:3000');
    // ...
  });
});
```

### Event-Driven Testing

```typescript
test('monitoring browser events', async () => {
  const fixture = await createScopedBrowserFixture();

  // Listen for events
  const events: string[] = [];

  fixture.on('navigation:success', (data) => {
    events.push(`Navigation to ${data.url} succeeded`);
  });

  fixture.on('screenshot:taken', (data) => {
    events.push(`Screenshot saved: ${data.name}`);
  });

  fixture.on('performance:measured', (metrics) => {
    events.push(`Performance: ${metrics.loadComplete}ms`);
  });

  try {
    await fixture.navigateTo('http://localhost:3000');
    await fixture.screenshot('test');
    await fixture.getPerformanceMetrics();

    expect(events).toContain('Navigation to http://localhost:3000 succeeded');
    expect(events.some(e => e.includes('Screenshot saved: test'))).toBe(true);

  } finally {
    await fixture.teardown();
  }
});
```

## Performance Considerations

### Choosing the Right Pattern

```typescript
// ✅ Good: Global fixture for related tests
setupBrowserFixture(); // Reuse browser across tests

// ✅ Good: Scoped fixture for isolation
await createScopedBrowserFixture(); // Fresh browser per test

// ❌ Bad: Creating fixture per operation
test('bad pattern', async () => {
  const fixture1 = await createScopedBrowserFixture();
  await fixture1.navigateTo('page1');
  await fixture1.teardown();

  const fixture2 = await createScopedBrowserFixture(); // Expensive!
  await fixture2.navigateTo('page2');
  await fixture2.teardown();
});
```

### Optimizing Configuration

```typescript
// For fast unit-like tests
const fastConfig = {
  headless: true,
  recordVideo: false,
  trace: false,
  captureFailureScreenshots: false,
  timeout: 10000,
};

// For debugging
const debugConfig = {
  headless: false,
  slowMo: 100,
  devtools: true,
  recordVideo: true,
  trace: true,
  captureFailureScreenshots: true,
};

// For CI/CD
const ciConfig = {
  headless: true,
  retries: 2,
  timeout: 30000,
  captureFailureScreenshots: true,
};
```

### Resource Management

```typescript
test('efficient resource usage', async () => {
  const fixture = await createScopedBrowserFixture();

  try {
    // Reuse the same page for multiple operations
    const page = fixture.getPage();

    await fixture.navigateTo('http://localhost:3000/page1');
    // ... test page1

    await fixture.navigateTo('http://localhost:3000/page2');
    // ... test page2 (reuses same page)

    // Only create new pages when necessary
    const popup = await fixture.createNewPage();
    await popup.goto('http://localhost:3000/popup');
    // ... test popup
    await popup.close();

  } finally {
    await fixture.teardown(); // Cleans up all resources
  }
});
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Browser Launch Failures

```typescript
// Problem: Browser fails to launch
// Solution: Check system dependencies and configuration

test('handling launch failures', async () => {
  try {
    const fixture = await createScopedBrowserFixture({
      browserType: 'chromium',
      launchOptions: {
        args: [
          '--no-sandbox', // Often needed in CI
          '--disable-dev-shm-usage', // Prevent shared memory issues
        ]
      }
    });
    // ...
  } catch (error) {
    console.log('Browser launch failed:', error.message);
    // Fallback or skip test
  }
});
```

#### 2. Timeout Issues

```typescript
// Problem: Operations timeout
// Solution: Increase timeouts or optimize selectors

test('handling timeouts', async () => {
  const fixture = await createScopedBrowserFixture({
    timeout: 60000, // Increase timeout
  });

  try {
    // Wait for specific conditions
    await fixture.waitForElement('#slow-loading-element', { timeout: 30000 });

    // Use efficient selectors
    const page = fixture.getPage();
    await page.waitForSelector('[data-testid="submit-button"]', {
      state: 'visible',
      timeout: 10000
    });

  } finally {
    await fixture.teardown();
  }
});
```

#### 3. Memory Issues

```typescript
// Problem: Memory leaks or high usage
// Solution: Proper cleanup and resource management

test('preventing memory leaks', async () => {
  // Use scoped fixtures for isolation
  const fixture = await createScopedBrowserFixture();

  try {
    // Avoid creating unnecessary pages
    const page = fixture.getPage();

    // Clean up additional pages
    const newPage = await fixture.createNewPage();
    await newPage.goto('http://example.com');
    await newPage.close(); // Important!

    // Clear page state between tests
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

  } finally {
    await fixture.teardown(); // Always cleanup
  }
});
```

#### 4. Debugging Test Failures

```typescript
test('debugging with fixtures', async () => {
  const fixture = await createScopedBrowserFixture({
    headless: false, // See what's happening
    slowMo: 100, // Slow down for observation
    devtools: true, // Open DevTools
    captureFailureScreenshots: true, // Auto-capture on failure
  });

  try {
    await fixture.navigateTo('http://localhost:3000');

    // Take debugging screenshots
    await fixture.screenshot('before-action');

    const page = fixture.getPage();
    await page.click('#problematic-element');

    await fixture.screenshot('after-action');

    // Check console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    // Log useful debugging info
    const url = page.url();
    const title = await page.title();
    console.log(`Current URL: ${url}, Title: ${title}`);
    console.log(`Console messages: ${consoleMessages.join(', ')}`);

  } finally {
    await fixture.teardown();
  }
});
```

## Best Practices

### 1. Test Organization

```typescript
// Group related tests that can share a browser instance
describe('User Authentication', () => {
  setupBrowserFixture({ browserType: 'chromium' });

  test('login flow', async () => {
    const fixture = getBrowserFixture();
    // ...
  });

  test('logout flow', async () => {
    const fixture = getBrowserFixture();
    // Test starts with clean state automatically
  });
});

// Use scoped fixtures for tests that need isolation
describe('Payment Processing', () => {
  test('successful payment', async () => {
    const fixture = await createScopedBrowserFixture();
    try {
      // Isolated test
    } finally {
      await fixture.teardown();
    }
  });
});
```

### 2. Configuration Management

```typescript
// Create configuration presets
const TestConfigs = {
  unit: {
    headless: true,
    timeout: 10000,
    recordVideo: false,
    trace: false,
  },

  integration: {
    headless: true,
    timeout: 30000,
    captureFailureScreenshots: true,
    recordVideo: process.env.CI === 'true',
  },

  debug: {
    headless: false,
    slowMo: 100,
    devtools: true,
    recordVideo: true,
    trace: true,
  },
};

// Use presets in tests
test('integration test', async () => {
  const fixture = await createScopedBrowserFixture(TestConfigs.integration);
  // ...
});
```

### 3. Error Handling

```typescript
test('robust error handling', async () => {
  const fixture = await createScopedBrowserFixture({
    retries: 2, // Retry failed operations
    captureFailureScreenshots: true,
  });

  try {
    // Use helper for error handling
    await fixture.navigateTo('http://localhost:3000');

    // Wrap critical operations
    const page = fixture.getPage();
    try {
      await page.click('#element-that-might-not-exist');
    } catch (error) {
      // Take screenshot for debugging
      await fixture.screenshot('element-not-found');
      throw error;
    }

  } catch (error) {
    // Log useful debugging information
    console.error('Test failed:', error.message);
    const artifactDir = fixture.getArtifactDir();
    console.log(`Debug artifacts saved to: ${artifactDir}`);
    throw error;

  } finally {
    await fixture.teardown();
  }
});
```

### 4. Assertions and Expectations

```typescript
test('comprehensive assertions', async () => {
  const fixture = await createScopedBrowserFixture();

  try {
    await fixture.navigateTo('http://localhost:3000');

    const page = fixture.getPage();

    // URL assertions
    expect(page.url()).toBe('http://localhost:3000/');

    // Element presence
    await expect(page.locator('#main-content')).toBeVisible();

    // Text content
    const heading = await page.textContent('h1');
    expect(heading).toBe('Welcome');

    // Performance assertions
    const metrics = await fixture.getPerformanceMetrics();
    expect(metrics.loadComplete).toBeLessThan(3000);

    // Screenshot-based assertions (for visual testing)
    await fixture.screenshot('final-state');

  } finally {
    await fixture.teardown();
  }
});
```

## Examples

### Complete Example: E-commerce Checkout Flow

```typescript
import { describe, test, expect } from 'vitest';
import { createScopedBrowserFixture, PageUtils } from './test-utils/browser-fixtures';

describe('E-commerce Checkout Flow', () => {
  test('complete purchase workflow', async () => {
    const fixture = await createScopedBrowserFixture({
      browserType: 'chromium',
      headless: true,
      viewport: { width: 1920, height: 1080 },
      captureFailureScreenshots: true,
    });

    try {
      // Step 1: Navigate to store
      await fixture.navigateTo('http://localhost:3000/store');
      await fixture.screenshot('01-store-homepage');

      const page = fixture.getPage();

      // Step 2: Add items to cart
      await page.click('[data-testid="product-1"] button');
      await page.click('[data-testid="product-2"] button');
      await fixture.screenshot('02-items-added');

      // Step 3: Go to cart
      await page.click('[data-testid="cart-icon"]');
      await fixture.waitForElement('[data-testid="cart-items"]');
      await fixture.screenshot('03-cart-view');

      // Verify cart contents
      const cartItems = await page.locator('[data-testid="cart-item"]').count();
      expect(cartItems).toBe(2);

      // Step 4: Proceed to checkout
      await page.click('[data-testid="checkout-button"]');
      await fixture.waitForElement('[data-testid="checkout-form"]');
      await fixture.screenshot('04-checkout-form');

      // Step 5: Fill checkout form
      await page.fill('#email', 'customer@example.com');
      await page.fill('#firstName', 'John');
      await page.fill('#lastName', 'Doe');
      await page.fill('#address', '123 Main St');
      await page.fill('#city', 'Anytown');
      await page.selectOption('#country', 'US');
      await fixture.screenshot('05-form-filled');

      // Step 6: Enter payment details
      await page.fill('#cardNumber', '4111111111111111');
      await page.fill('#expiryDate', '12/25');
      await page.fill('#cvv', '123');
      await fixture.screenshot('06-payment-details');

      // Step 7: Submit order
      await page.click('[data-testid="place-order"]');
      await fixture.waitForElement('[data-testid="order-confirmation"]');
      await fixture.screenshot('07-order-confirmation');

      // Verify success
      const confirmation = await page.textContent('[data-testid="order-number"]');
      expect(confirmation).toMatch(/Order #\d+/);

      // Check performance
      const metrics = await fixture.getPerformanceMetrics();
      expect(metrics.loadComplete).toBeLessThan(5000);

    } finally {
      await fixture.teardown();
    }
  });
});
```

### Example: Testing Form Validation

```typescript
test('comprehensive form validation', async () => {
  const fixture = await createScopedBrowserFixture();

  try {
    // Load form page
    const formHtml = PageUtils.createFormTestPage();
    await loadPageContent(fixture, formHtml);

    const page = fixture.getPage();

    // Test empty form submission
    await page.click('button[type="submit"]');
    await fixture.screenshot('empty-form-validation');

    // Check validation messages (assuming HTML5 validation)
    const nameInput = page.locator('#name');
    const isInvalid = await nameInput.evaluate(el => !el.checkValidity());
    expect(isInvalid).toBe(true);

    // Test partial form
    await page.fill('#name', 'John Doe');
    await page.click('button[type="submit"]');
    await fixture.screenshot('partial-form-validation');

    // Complete form
    await page.fill('#email', 'john@example.com');
    await page.selectOption('#category', 'general');
    await page.fill('#message', 'Test message');

    // Submit valid form
    await page.click('button[type="submit"]');
    await fixture.screenshot('successful-submission');

    // Verify submission
    const result = await page.textContent('#form-result');
    expect(result).toContain('Form Submitted!');
    expect(result).toContain('john@example.com');

  } finally {
    await fixture.teardown();
  }
});
```

This guide provides comprehensive coverage of the browser fixtures module usage. The fixtures are production-ready and provide all the necessary functionality for browser-based testing in the APEX project.