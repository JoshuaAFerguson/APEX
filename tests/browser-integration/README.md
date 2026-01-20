# Browser Integration Test Infrastructure

This directory contains the browser automation integration test infrastructure for APEX. It provides utilities, fixtures, and configuration for testing browser automation features using Playwright and Puppeteer.

## Directory Structure

```
tests/browser-integration/
├── vitest.config.ts         # Vitest configuration for browser tests
├── setup.ts                 # Global setup and teardown utilities
├── fixtures/
│   └── common-scenarios.ts  # Reusable test scenarios and fixtures
├── utils/
│   └── test-helpers.ts     # Browser test utility functions
└── README.md               # This documentation
```

## Getting Started

### Prerequisites

The browser automation dependencies are already installed in the orchestrator package:
- `playwright` ^1.47.0
- `puppeteer` ^24.34.0

To install browser binaries:

```bash
# Install Playwright browsers
npx playwright install

# Or install specific browsers
npx playwright install chromium firefox webkit
```

### Running Browser Integration Tests

```bash
# Run all browser integration tests
npm run test:browser-integration

# Run with coverage
npm run test:browser-integration -- --coverage

# Run in watch mode during development
npm run test:browser-integration -- --watch

# Run specific test file
npm run test:browser-integration -- navigation.test.ts
```

## Writing Browser Integration Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBrowser, createBrowserContext, createPage } from './setup';
import { createTestPage, runNavigationScenario } from './fixtures/common-scenarios';
import { takeScreenshot, waitForElement } from './utils/test-helpers';

describe('Browser Navigation', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeEach(async () => {
    browser = await createBrowser();
    context = await createBrowserContext(browser);
    page = await createPage(context);
  });

  afterEach(async () => {
    await page?.close();
    await context?.close();
    await browser?.close();
  });

  it('should navigate to test page', async () => {
    await createTestPage(page);

    const title = await page.title();
    expect(title).toBe('APEX Browser Test Page');

    // Take screenshot for visual verification
    await takeScreenshot(page, 'navigation-test', globalThis.browserTestContext.tempDir!);
  });
});
```

### Using Test Fixtures

The `fixtures/common-scenarios.ts` file provides reusable test scenarios:

```typescript
import { NAVIGATION_SCENARIOS, runNavigationScenario } from './fixtures/common-scenarios';

it('should handle common navigation scenarios', async () => {
  for (const scenario of NAVIGATION_SCENARIOS) {
    await runNavigationScenario(page, scenario);
  }
});
```

### Using Test Utilities

The `utils/test-helpers.ts` file provides utility functions:

```typescript
import { safeClick, safeFill, waitForNetworkIdle, measurePerformance } from './utils/test-helpers';

it('should interact with form elements safely', async () => {
  await createTestPage(page);

  // Safe interactions with retry logic
  await safeFill(page, 'input[name="username"]', 'testuser');
  await safeClick(page, 'button[type="submit"]');

  // Wait for network requests to complete
  await waitForNetworkIdle(page);
});
```

## Configuration

### Browser Test Configuration

The test environment can be configured via environment variables:

```bash
# Run tests in headless mode (default in CI)
BROWSER_TEST_HEADLESS=true npm run test:browser-integration

# Run tests with visible browser (useful for debugging)
BROWSER_TEST_HEADLESS=false npm run test:browser-integration

# Specify browser type
BROWSER_TYPE=firefox npm run test:browser-integration
```

### Vitest Configuration

The `vitest.config.ts` file includes browser-specific settings:

- **Extended timeouts**: 60 seconds for test timeout, 30 seconds for hooks
- **Sequential execution**: Prevents browser resource conflicts
- **Limited concurrency**: Maximum 2 forks to avoid resource exhaustion
- **Retry logic**: 2 retries in CI environments for flaky tests

## Test Utilities

### Setup and Teardown

- `createBrowser()`: Creates a browser instance with default configuration
- `createBrowserContext()`: Creates a browser context with test settings
- `createPage()`: Creates a page with default timeouts
- Global cleanup hooks handle resource cleanup

### Test Helpers

- `takeScreenshot()`: Captures screenshots with timestamps
- `compareScreenshots()`: Compares two screenshots for visual regression testing
- `waitForElement()`: Waits for elements with various conditions
- `safeClick()`: Clicks elements with retry logic
- `safeFill()`: Fills input fields with validation
- `waitForNetworkIdle()`: Waits for network requests to complete
- `measurePerformance()`: Measures page performance metrics
- `captureConsoleMessages()`: Monitors console output during tests
- `capturePageErrors()`: Captures JavaScript errors and failed requests

### Test Scenarios

- **Navigation scenarios**: Common page loading and navigation tests
- **Interaction scenarios**: Form submission and element interaction tests
- **Console scenarios**: Console message monitoring tests
- `createTestPage()`: Creates a comprehensive test page with common elements

## Best Practices

### 1. Test Isolation

Each test should clean up after itself:

```typescript
afterEach(async () => {
  // Clear browser state
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
});
```

### 2. Reliable Element Selection

Use data attributes for test element selection:

```typescript
// Good: Stable selector
await page.click('[data-testid="submit-button"]');

// Avoid: Fragile selectors
await page.click('div.container > button.primary');
```

### 3. Waiting Strategies

Always wait for elements and network requests:

```typescript
// Wait for element to be ready
await waitForElement(page, 'button', { visible: true, enabled: true });

// Wait for network requests to complete
await waitForNetworkIdle(page);
```

### 4. Error Handling

Capture errors and screenshots for debugging:

```typescript
try {
  await runTestScenario(page);
} catch (error) {
  // Capture screenshot on failure
  await takeScreenshot(page, 'test-failure', tempDir);

  // Capture console messages
  const messages = await captureConsoleMessages(page, async () => {
    // Re-run scenario to capture messages
  });

  throw error;
}
```

### 5. Performance Testing

Measure performance for critical paths:

```typescript
const performance = await measurePerformance(page, async () => {
  await page.goto('https://example.com');
  await waitForNetworkIdle(page);
});

expect(performance.duration).toBeLessThan(5000); // 5 seconds
```

## Troubleshooting

### Common Issues

1. **Browser not found**: Run `npx playwright install` to install browser binaries
2. **Timeout errors**: Increase timeout values or optimize wait conditions
3. **Flaky tests**: Use retry logic and better waiting strategies
4. **Resource exhaustion**: Reduce concurrent test execution

### Debugging

1. **Run with visible browser**:
   ```bash
   BROWSER_TEST_HEADLESS=false npm run test:browser-integration
   ```

2. **Enable slow motion**:
   ```typescript
   const browser = await createBrowser({ slowMo: 1000 });
   ```

3. **Capture screenshots**:
   ```typescript
   await takeScreenshot(page, 'debug', tempDir);
   ```

4. **Monitor console messages**:
   ```typescript
   page.on('console', msg => console.log('PAGE LOG:', msg.text()));
   ```

## Integration with APEX

This browser test infrastructure integrates with APEX's browser automation features:

- Tests the `BrowserTool` class from the orchestrator package
- Validates browser manager functionality
- Tests both Playwright and Puppeteer backends
- Verifies browser console message capture
- Tests screenshot and visual comparison features

The tests ensure that APEX's browser automation capabilities work correctly across different browsers and scenarios.