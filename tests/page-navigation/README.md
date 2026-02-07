# Page Navigation Integration Tests

This directory contains the complete page navigation integration testing infrastructure for APEX, providing comprehensive testing capabilities for page navigation features across browser automation scenarios.

## Overview

The page navigation test infrastructure validates:
- Basic navigation flows (forward, back, refresh)
- URL routing and parameter validation
- Navigation history management
- Cross-origin navigation testing
- Page load state management
- Navigation performance measurement
- Error handling during navigation

## Directory Structure

```
tests/page-navigation/
├── index.ts                            # Main entry point - exports all utilities
├── vitest.config.ts                    # Vitest configuration for navigation tests
├── setup.ts                            # Global setup and teardown utilities
├── README.md                           # This documentation
│
├── fixtures/
│   ├── index.ts                        # Fixture exports
│   └── navigation-scenarios.ts         # Reusable navigation test scenarios
│
├── utils/
│   ├── index.ts                        # Utility exports
│   ├── navigation-helpers.ts           # Navigation test utility functions
│   ├── assertions.ts                   # Navigation assertion utilities
│   └── browser-fixtures.ts             # Browser/page fixture factories
│
└── navigation.integration.test.ts      # Sample navigation integration tests
```

## Key Features

### 1. Comprehensive Navigation Testing
- **Basic Navigation**: Link clicks, browser controls (back/forward/reload)
- **History Management**: Navigation history tracking and validation
- **URL Validation**: Route matching and parameter verification
- **Performance Monitoring**: Navigation timing and metrics collection

### 2. Mock Server Integration
- **Controlled Environment**: Local HTTP server for navigation testing
- **Multiple Routes**: Home, test pages, redirects, error pages, slow pages
- **Request Simulation**: Various response scenarios for testing

### 3. Browser Automation
- **Multiple Backends**: Playwright support (Chromium, Firefox, WebKit)
- **Cross-browser Testing**: Consistent behavior validation
- **Screenshot Capture**: Visual debugging and verification

### 4. Performance Measurement
- **Navigation Timing**: DOM content loaded, load complete, paint metrics
- **Benchmarking**: Performance comparison across iterations
- **Threshold Validation**: Performance requirement enforcement

## Getting Started

### Prerequisites

The navigation testing dependencies are already installed:
- `playwright` ^1.47.0 (for browser automation)
- `vitest` ^4.0.15 (for test framework)

To install Playwright browsers:
```bash
npx playwright install chromium
# Or install all browsers
npx playwright install
```

### Running Navigation Tests

```bash
# Run all navigation integration tests
npm run test:page-navigation

# Run with coverage
npm run test:page-navigation -- --coverage

# Run in watch mode during development
npm run test:page-navigation -- --watch

# Run specific test file
npm run test:page-navigation -- navigation.integration.test.ts
```

### Adding to Main Test Suite

Add to package.json scripts:
```json
{
  "scripts": {
    "test:page-navigation": "vitest run --config tests/page-navigation/vitest.config.ts",
    "test:page-navigation:watch": "vitest --config tests/page-navigation/vitest.config.ts",
    "test:page-navigation:coverage": "vitest run --config tests/page-navigation/vitest.config.ts --coverage"
  }
}
```

## Writing Navigation Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import {
  createNavigationBrowser,
  createNavigationContext,
  createNavigationPage
} from './setup';
import { safeNavigate, validateNavigation } from './utils/navigation-helpers';

describe('My Navigation Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let baseUrl: string;

  beforeEach(async () => {
    browser = await createNavigationBrowser();
    context = await createNavigationContext(browser);
    page = await createNavigationPage(context);
    baseUrl = `http://localhost:${globalThis.navigationTestContext.mockServerPort}`;
  });

  afterEach(async () => {
    await page?.close();
    await context?.close();
    await browser?.close();
  });

  it('should navigate to test page', async () => {
    const success = await safeNavigate(page, `${baseUrl}/page1`);
    expect(success).toBe(true);

    const validation = await validateNavigation(page, {
      url: `${baseUrl}/page1`,
      title: 'Navigation Test - Page 1',
      hasElement: 'h1',
    });
    expect(validation.valid).toBe(true);
  });
});
```

### Using Navigation Scenarios

```typescript
import { runNavigationScenario, NAVIGATION_SCENARIOS } from './fixtures/navigation-scenarios';

it('should run navigation scenario', async () => {
  const scenario = NAVIGATION_SCENARIOS.find(s => s.name === 'basic-page-navigation');
  const result = await runNavigationScenario(page, scenario!, baseUrl);

  expect(result.success).toBe(true);
  expect(result.metrics.finalUrl).toBe(`${baseUrl}/page2`);
});
```

### Performance Testing

```typescript
import { benchmarkNavigation, measureNavigationPerformance } from './utils/navigation-helpers';

it('should meet performance requirements', async () => {
  const benchmark = await benchmarkNavigation(page, `${baseUrl}/`, 5);
  expect(benchmark.average).toBeLessThan(3000); // 3 seconds max

  await safeNavigate(page, `${baseUrl}/page1`);
  const performance = await measureNavigationPerformance(page);
  expect(performance.totalNavigationTime).toBeLessThan(5000);
});
```

### Event Monitoring

```typescript
import { NavigationEventMonitor } from './utils/navigation-helpers';

it('should track navigation events', async () => {
  const monitor = new NavigationEventMonitor(page);

  await safeNavigate(page, `${baseUrl}/`);
  await safeNavigationClick(page, 'a[href="/page1"]');

  const events = monitor.getEvents();
  expect(monitor.getNavigationCount()).toBe(2);
});
```

## Configuration

### Test Configuration

Environment variables for navigation testing:

```bash
# Run tests in headless mode (default in CI)
BROWSER_TEST_HEADLESS=true npm run test:page-navigation

# Run tests with visible browser
BROWSER_TEST_HEADLESS=false npm run test:page-navigation

# Specify browser type
BROWSER_TYPE=firefox npm run test:page-navigation
```

### Vitest Configuration

The `vitest.config.ts` includes navigation-specific settings:
- **Extended timeouts**: 60 seconds for navigation operations
- **Sequential execution**: Prevents navigation conflicts
- **Mock server integration**: Controlled navigation environment
- **Performance monitoring**: Navigation timing collection

## Test Utilities

### Setup Functions
- `createNavigationBrowser()`: Creates browser with navigation settings
- `createNavigationContext()`: Creates context with navigation features
- `createNavigationPage()`: Creates page with navigation tracking

### Navigation Helpers
- `safeNavigate()`: Navigate with retry logic and error handling
- `safeNavigationClick()`: Click links with navigation detection
- `validateNavigation()`: Validate navigation state and conditions
- `measureNavigationPerformance()`: Collect navigation timing metrics
- `getNavigationHistory()`: Get browser history information

### Scenarios and Fixtures
- `runNavigationScenario()`: Execute predefined navigation flows
- `NAVIGATION_SCENARIOS`: Collection of common navigation patterns
- `createNavigationTestPage()`: Generate test pages with navigation elements

## Mock Server Features

The integrated mock server provides:

### Standard Routes
- `/` - Home page with navigation menu
- `/page1`, `/page2`, `/page3` - Test pages with navigation controls
- `/slow` - Simulates slow loading (2 second delay)
- `/error` - Returns 500 error for error handling tests
- `/redirect?to=URL` - HTTP redirect testing

### Navigation Elements
Each test page includes:
- Navigation links to other pages
- Browser control buttons (back, forward, reload)
- Current URL and history length display
- Performance timing information

## Best Practices

### 1. Test Isolation
Each test should start with a clean navigation state:
```typescript
beforeEach(async () => {
  // Fresh browser instances prevent state contamination
  browser = await createNavigationBrowser();
  context = await createNavigationContext(browser);
  page = await createNavigationPage(context);
});
```

### 2. Reliable Navigation
Always use safe navigation functions with retry logic:
```typescript
// Good: Handles timeouts and retries
const success = await safeNavigate(page, url, { retries: 2 });

// Avoid: Raw navigation without error handling
await page.goto(url);
```

### 3. State Validation
Validate navigation state after each operation:
```typescript
await safeNavigationClick(page, 'a[href="/page1"]');

const validation = await validateNavigation(page, {
  url: /\/page1$/,
  title: 'Expected Title',
  historyLength: 2,
});
expect(validation.valid).toBe(true);
```

### 4. Performance Monitoring
Track performance for critical navigation paths:
```typescript
const performance = await measureNavigationPerformance(page);
expect(performance.totalNavigationTime).toBeLessThan(threshold);
```

### 5. Error Documentation
Capture navigation failures with detailed context:
```typescript
try {
  await runNavigationScenario(page, scenario, baseUrl);
} catch (error) {
  const screenshot = await captureNavigationScreenshot(page, 'failure', tempDir);
  console.log(`Navigation failure captured: ${screenshot}`);
  throw error;
}
```

## Troubleshooting

### Common Issues

1. **Mock server connection refused**
   - Ensure setup.ts is properly initializing the server
   - Check that `globalThis.navigationTestContext.mockServerPort` is set

2. **Navigation timeouts**
   - Increase timeout values in test configuration
   - Check network conditions and page complexity

3. **Browser launch failures**
   - Run `npx playwright install` to install browser binaries
   - Check system requirements for browser automation

### Debugging

1. **Visual debugging**:
   ```bash
   BROWSER_TEST_HEADLESS=false npm run test:page-navigation
   ```

2. **Performance analysis**:
   ```typescript
   const benchmark = await benchmarkNavigation(page, url, 10);
   console.log('Navigation performance:', benchmark);
   ```

3. **Event monitoring**:
   ```typescript
   const monitor = new NavigationEventMonitor(page);
   // ... perform navigation
   console.log('Navigation events:', monitor.getEvents());
   ```

## Integration with APEX

This navigation test infrastructure integrates with APEX's browser automation features:

- Tests browser navigation through the `BrowserTool` class
- Validates navigation commands in orchestrator context
- Ensures navigation reliability across different browsers
- Measures navigation performance impact on workflows

The infrastructure provides a solid foundation for testing any navigation-related features in the APEX ecosystem.