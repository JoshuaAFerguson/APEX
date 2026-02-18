# Browser Fixtures for APEX Testing

This documentation describes the browser fixtures module that provides reusable browser context and page fixtures with proper lifecycle management for APEX integration testing.

## Overview

The browser fixtures module (`browser-fixtures.ts`) provides a robust, configurable system for managing browser instances, contexts, and pages across different test scenarios. It includes proper setup and teardown lifecycle hooks, extensive configuration options, and comprehensive error handling.

## Key Features

- **Reusable browser fixtures** - Create browser instances that can be shared across tests
- **Proper lifecycle management** - Automatic setup and teardown with resource cleanup
- **Configurable options** - Support for headless mode, viewport settings, browser types, and more
- **Multiple browser support** - Chromium, Firefox, and WebKit (Safari)
- **Screenshot capture** - Automatic failure screenshots and manual screenshot capture
- **Performance monitoring** - Built-in performance metrics collection
- **Video recording** - Optional video recording of test execution
- **Trace collection** - Playwright trace collection for debugging
- **Error handling** - Comprehensive error handling with retries and cleanup

## Quick Start

### Basic Setup

```typescript
import { setupBrowserFixture, getBrowserFixture } from '@apex/test-utils/browser-fixtures';
import { describe, test, expect } from 'vitest';

// Setup global browser fixture
setupBrowserFixture();

describe('My Browser Tests', () => {
  test('should interact with page', async () => {
    const fixture = getBrowserFixture();
    const page = fixture.getPage();

    await fixture.navigateTo('http://localhost:3000');
    await page.click('#my-button');

    const result = await page.textContent('#result');
    expect(result).toBe('Expected result');
  });
});
```

### Custom Configuration

```typescript
import { setupBrowserFixture, getBrowserFixture, PageUtils } from '@apex/test-utils/browser-fixtures';

// Setup with custom configuration
setupBrowserFixture({
  browserType: 'firefox',
  headless: false,
  viewport: { width: 1920, height: 1080 },
  slowMo: 100,
  captureFailureScreenshots: true,
  recordVideo: true,
  trace: true
});

describe('Custom Browser Tests', () => {
  test('should load custom test page', async () => {
    const fixture = getBrowserFixture();
    const page = fixture.getPage();

    // Load a pre-built test page
    const html = PageUtils.createSimpleTestPage();
    await fixture.getPage().setContent(html);

    await page.click('#test-btn');
    const result = await page.textContent('#result');
    expect(result).toContain('Button clicked!');
  });
});
```

## Configuration Options

The `BrowserFixtureConfig` interface provides extensive configuration options:

### Core Browser Settings

```typescript
interface BrowserFixtureConfig {
  /** Browser type: 'chromium' | 'firefox' | 'webkit' */
  browserType: BrowserType;

  /** Run in headless mode (default: true in CI) */
  headless: boolean;

  /** Viewport dimensions */
  viewport: { width: number; height: number };

  /** Slow down operations for debugging (milliseconds) */
  slowMo?: number;

  /** Enable devtools (default: false in CI) */
  devtools?: boolean;

  /** Default timeout for operations (default: 30000ms) */
  timeout: number;

  /** Number of retries for failed operations (default: 2 in CI) */
  retries: number;
}
```

### Testing Features

```typescript
interface BrowserFixtureConfig {
  /** Capture screenshots on test failure (default: true) */
  captureFailureScreenshots: boolean;

  /** Directory for test artifacts */
  artifactDir: string;

  /** Enable video recording (default: false) */
  recordVideo: boolean;

  /** Enable trace collection (default: false) */
  trace: boolean;
}
```

### Advanced Options

```typescript
interface BrowserFixtureConfig {
  /** Additional browser launch options */
  launchOptions?: Record<string, any>;

  /** Additional context options */
  contextOptions?: Record<string, any>;
}
```

## Usage Patterns

### Global Fixture (Recommended)

Use the global fixture pattern for most test suites where you want to share a browser instance across multiple tests:

```typescript
import { setupBrowserFixture, getBrowserFixture } from '@apex/test-utils/browser-fixtures';

// In test setup or test file
setupBrowserFixture({
  browserType: 'chromium',
  headless: true
});

describe('My Test Suite', () => {
  test('test 1', async () => {
    const fixture = getBrowserFixture();
    // Use fixture...
  });

  test('test 2', async () => {
    const fixture = getBrowserFixture();
    // Use same fixture instance...
  });
});
```

### Scoped Fixture

Use scoped fixtures when you need isolated browser instances for specific tests:

```typescript
import { createScopedBrowserFixture } from '@apex/test-utils/browser-fixtures';

test('isolated browser test', async () => {
  const fixture = await createScopedBrowserFixture({
    browserType: 'firefox',
    headless: false
  });

  try {
    const page = fixture.getPage();
    await fixture.navigateTo('http://example.com');
    // ... test code
  } finally {
    await fixture.teardown(); // Important: cleanup
  }
});
```

### Manual Fixture Management

For advanced use cases where you need full control:

```typescript
import { BrowserFixture } from '@apex/test-utils/browser-fixtures';

test('manual fixture management', async () => {
  const fixture = new BrowserFixture({
    browserType: 'webkit',
    viewport: { width: 800, height: 600 }
  });

  await fixture.setup();

  try {
    const page = fixture.getPage();
    // ... test code
  } finally {
    await fixture.teardown();
  }
});
```

## Working with Pages

### Navigation

```typescript
const fixture = getBrowserFixture();

// Navigate with built-in retry logic
await fixture.navigateTo('http://localhost:3000');

// Navigate with custom options
await fixture.navigateTo('http://localhost:3000', {
  waitUntil: 'networkidle',
  timeout: 60000
});
```

### Element Interaction

```typescript
const page = fixture.getPage();

// Wait for elements
const element = await fixture.waitForElement('#my-button');
await element.click();

// Standard Playwright API
await page.fill('#input-field', 'test value');
await page.selectOption('#dropdown', 'option1');
```

### Screenshots

```typescript
// Manual screenshot
const screenshotPath = await fixture.screenshot('test-state');

// Screenshots are automatically taken on test failures
// if captureFailureScreenshots is enabled
```

### Loading Test Pages

```typescript
import { PageUtils, loadPageContent } from '@apex/test-utils/browser-fixtures';

// Use pre-built test pages
const html = PageUtils.createSimpleTestPage();
await loadPageContent(fixture, html);

// Or create custom HTML
const customHtml = `
  <html>
    <body>
      <h1>My Test Page</h1>
      <button id="test">Click me</button>
    </body>
  </html>
`;
await loadPageContent(fixture, customHtml);
```

## Performance Monitoring

The fixtures include built-in performance monitoring capabilities:

```typescript
const fixture = getBrowserFixture();
await fixture.navigateTo('http://localhost:3000');

// Get performance metrics
const metrics = await fixture.getPerformanceMetrics();
console.log('Page load time:', metrics.loadComplete);
console.log('DOM content loaded:', metrics.domContentLoaded);
```

## Event Handling

The BrowserFixture class extends EventEmitter and emits various events:

```typescript
const fixture = new BrowserFixture();

fixture.on('fixture:setup', (data) => {
  console.log('Browser fixture set up:', data);
});

fixture.on('navigation:success', (data) => {
  console.log('Navigated to:', data.url);
});

fixture.on('screenshot:taken', (data) => {
  console.log('Screenshot saved:', data.filepath);
});

fixture.on('console', (data) => {
  console.log('Browser console:', data.type, data.text);
});

fixture.on('page-error', (error) => {
  console.error('Page error:', error.message);
});
```

## Environment Variables

The fixtures respect several environment variables for configuration:

- `CI` - Automatically enables headless mode and retries in CI environments
- `HEADLESS` - Force headless mode (`true`/`false`)
- `DEVTOOLS` - Enable devtools (`true`/`false`)
- `RECORD_VIDEO` - Enable video recording (`true`/`false`)
- `TRACE` - Enable trace collection (`true`/`false`)

## Debugging

### Visual Debugging

```typescript
// Run with visible browser for debugging
setupBrowserFixture({
  headless: false,
  devtools: true,
  slowMo: 500 // Slow down actions
});
```

### Screenshot Debugging

```typescript
test('debug with screenshots', async () => {
  const fixture = getBrowserFixture();

  await fixture.navigateTo('http://localhost:3000');
  await fixture.screenshot('after-navigation');

  await page.click('#button');
  await fixture.screenshot('after-click');

  // Screenshots saved to artifact directory
});
```

### Video Recording

```typescript
setupBrowserFixture({
  recordVideo: true, // Videos saved to artifact directory
  captureFailureScreenshots: true
});
```

### Trace Collection

```typescript
setupBrowserFixture({
  trace: true // Traces saved as .zip files for Playwright trace viewer
});

// View traces with: npx playwright show-trace trace.zip
```

## Error Handling

The fixtures include comprehensive error handling:

### Automatic Retries

```typescript
// Navigation automatically retries on failure
await fixture.navigateTo('http://unreliable-site.com');
// Will retry up to `retries` times with exponential backoff
```

### Graceful Cleanup

```typescript
// Teardown is always called, even if setup partially fails
const fixture = new BrowserFixture();
try {
  await fixture.setup();
  // ... test code
} catch (error) {
  // Cleanup is automatic
  throw error;
}
```

### Error Events

```typescript
fixture.on('navigation:retry', (data) => {
  console.log(`Navigation retry ${data.attempt} for ${data.url}`);
});

fixture.on('fixture:setup-error', (error) => {
  console.error('Setup failed:', error);
});
```

## Integration with Vitest

### Test Lifecycle

The fixtures integrate seamlessly with Vitest's lifecycle hooks:

```typescript
// beforeAll: Browser is launched and context created
// beforeEach: Page state is cleared (localStorage, sessionStorage)
// afterEach: Failure screenshots captured if enabled
// afterAll: Browser and all resources are cleaned up
```

### Parallel Testing

The fixtures support Vitest's parallel test execution:

```typescript
// Each test worker gets its own browser instance
// No shared state between parallel tests
// Automatic artifact directory isolation
```

## Best Practices

### Resource Management

1. **Use global fixtures for test suites** - More efficient than creating new browsers for each test
2. **Always cleanup scoped fixtures** - Call `teardown()` in finally blocks
3. **Enable failure screenshots** - Helps with debugging failed tests
4. **Use appropriate timeouts** - Set realistic timeouts for your application

### Performance

1. **Use headless mode in CI** - Faster execution and lower resource usage
2. **Minimize browser launches** - Share browser instances across tests when possible
3. **Clean page state between tests** - The fixture automatically clears storage
4. **Use appropriate viewport sizes** - Match your application's target sizes

### Debugging

1. **Disable headless for local debugging** - See what's happening visually
2. **Enable slow motion** - Better observe test execution
3. **Capture screenshots at key points** - Document test state progression
4. **Use trace collection** - For deep debugging of complex interactions

### Configuration

1. **Use environment variables** - Configure different settings for CI vs local
2. **Customize artifact directories** - Organize test outputs effectively
3. **Set appropriate retries** - Balance reliability with execution time
4. **Configure browser types** - Test across different engines when needed

## Troubleshooting

### Common Issues

**Browser fails to launch:**
```bash
# Install browser dependencies
npm run playwright:install
```

**Tests timeout:**
```typescript
// Increase timeout
setupBrowserFixture({
  timeout: 60000 // 60 seconds
});
```

**Memory issues:**
```typescript
// Use scoped fixtures for memory-intensive tests
const fixture = await createScopedBrowserFixture();
try {
  // ... test code
} finally {
  await fixture.teardown(); // Free memory
}
```

**Screenshots not captured:**
```bash
# Check artifact directory permissions
ls -la test-artifacts/browser-fixtures/
```

### Getting Help

1. Check the console output for detailed error messages
2. Review the artifact directory for screenshots and videos
3. Use trace collection for complex debugging scenarios
4. Enable debug logging with environment variables

## Migration Guide

### From browser-test-base.ts

If you're migrating from the existing `browser-test-base.ts`:

```typescript
// Old way
import { createBrowserTest } from '@apex/test-utils/browser-test-base';

// New way
import { setupBrowserFixture, getBrowserFixture } from '@apex/test-utils/browser-fixtures';
```

### Key Differences

1. **Simpler API** - More focused on fixtures rather than general testing
2. **Better lifecycle management** - Automatic cleanup and resource management
3. **Enhanced configuration** - More options and better defaults
4. **Improved error handling** - Better retry logic and error reporting

## Examples

See the `__tests__` directory for comprehensive examples of using browser fixtures in different scenarios.