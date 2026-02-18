# Browser Automation Infrastructure

This document describes the browser automation testing infrastructure for the APEX project.

## Overview

APEX includes comprehensive browser automation capabilities using both Playwright and Puppeteer, providing flexible and robust browser testing across the monorepo.

## Architecture

### Package Structure

```
├── packages/
│   ├── browser/                    # Dedicated browser automation package
│   ├── orchestrator/              # Includes browser tools and management
│   └── core/                      # Core types and configurations
├── tests/
│   ├── browser-integration/       # Browser integration tests
│   └── test-utils/               # Shared browser test utilities
├── playwright.config.ts          # Playwright global configuration
├── puppeteer.config.js          # Puppeteer global configuration
└── BROWSER_AUTOMATION.md        # This documentation
```

### Dependencies

#### Core Browser Automation
- **Playwright** (`^1.47.0`) - Primary browser automation framework
- **Puppeteer** (`^24.34.0`) - Alternative browser automation backend
- **pixelmatch** (`^5.3.0`) - Screenshot comparison utility
- **pngjs** (`^7.0.0`) - PNG image processing

#### TypeScript Support
- `@types/pixelmatch` - TypeScript definitions
- `@types/pngjs` - TypeScript definitions
- `@types/puppeteer` - TypeScript definitions

## Getting Started

### 1. Install Dependencies

Dependencies are already configured in the monorepo. To install browser binaries:

```bash
# Install Playwright browsers
npx playwright install

# Or install specific browsers
npx playwright install chromium firefox webkit

# Verify installation
npm run validate:browser-infrastructure
```

### 2. Run Browser Tests

```bash
# Run all browser integration tests
npm run test:browser-integration

# Run infrastructure verification tests
npm run test:browser-infrastructure

# Run with coverage
npm run test:browser-integration:coverage

# Run in watch mode
npm run test:browser-integration:watch
```

### 3. Browser Test Development

#### Using the Browser Test Base

```typescript
import { createBrowserTest, BrowserTestUtils } from './tests/test-utils/browser-test-base';

const browserTest = createBrowserTest({
  headless: true,
  browserType: 'chromium',
  viewport: { width: 1280, height: 720 }
});

await browserTest.setup();

// Create test page
await BrowserTestUtils.createTestPage(browserTest);

// Take screenshot
await browserTest.takeScreenshot('my-test');

// Interact with page
const button = await browserTest.waitForElement('#test-button');
await button.click();

await browserTest.teardown();
```

#### Using Legacy Test Utilities

```typescript
import { createBrowser, createBrowserContext, createPage } from './tests/browser-integration/setup';
import { safeClick, takeScreenshot } from './tests/browser-integration/utils/test-helpers';

const browser = await createBrowser();
const context = await createBrowserContext(browser);
const page = await createPage(context);

// Use helper functions
await safeClick(page, '#button');
await takeScreenshot(page, 'test', './screenshots');

// Cleanup
await page.close();
await context.close();
await browser.close();
```

## Configuration

### Playwright Configuration

Global Playwright settings are in `playwright.config.ts`:

- **Multi-browser support**: Chromium, Firefox, WebKit, Mobile browsers
- **Test artifacts**: Screenshots, videos, traces on failure
- **Parallel execution**: Limited for resource management
- **CI/CD integration**: Environment-specific settings

### Puppeteer Configuration

Global Puppeteer settings are in `puppeteer.config.js`:

- **Launch options**: Headless mode, browser arguments
- **Page configuration**: Viewport, timeouts
- **Security settings**: CSP bypass, JavaScript execution
- **Performance monitoring**: Metrics collection

### Vitest Configuration

Browser-specific Vitest settings in `tests/browser-integration/vitest.config.ts`:

- **Extended timeouts**: 60s for tests, 30s for hooks
- **Sequential execution**: Prevents resource conflicts
- **Browser environment**: Node.js with browser automation
- **Coverage targeting**: Browser automation packages

## Testing Patterns

### Basic Browser Test

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBrowserTest } from '../test-utils/browser-test-base';

describe('My Browser Tests', () => {
  let browserTest;

  beforeEach(async () => {
    browserTest = createBrowserTest();
    await browserTest.setup();
  });

  afterEach(async () => {
    await browserTest.teardown();
  });

  it('should navigate and interact', async () => {
    await browserTest.navigateTo('https://example.com');
    const element = await browserTest.waitForElement('#my-button');
    await element.click();

    const screenshot = await browserTest.takeScreenshot('test-result');
    expect(screenshot).toBeDefined();
  });
});
```

### Console Message Capture

```typescript
const messages = await browserTest.captureConsoleMessages(async () => {
  await browserTest.navigateTo('https://example.com');
});

const errorMessages = messages.filter(msg => msg.type === 'error');
expect(errorMessages).toHaveLength(0);
```

### Performance Testing

```typescript
const metrics = await browserTest.getPerformanceMetrics();
expect(metrics.domContentLoaded).toBeLessThan(2000); // < 2 seconds
```

### Screenshot Comparison

```typescript
const screenshot1 = await browserTest.takeScreenshot('before');
// Make changes...
const screenshot2 = await browserTest.takeScreenshot('after');

// Use pixelmatch for comparison (custom implementation)
const diff = await compareScreenshots(screenshot1, screenshot2);
expect(diff.similarity).toBeGreaterThan(0.95);
```

## Environment Configuration

### Environment Variables

```bash
# Browser test configuration
BROWSER_TEST_HEADLESS=true          # Run in headless mode
BROWSER_TYPE=firefox                # Browser type (chromium/firefox/webkit)
CI=true                            # Enable CI-specific settings

# Test execution
NODE_ENV=test                      # Test environment
```

### CI/CD Integration

```yaml
# Example GitHub Actions
- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run Browser Tests
  run: npm run test:browser-integration
  env:
    BROWSER_TEST_HEADLESS: true
    CI: true
```

## Package-Specific Features

### Browser Package (`@apexcli/browser`)

Provides core browser automation classes:

```typescript
import { BrowserManager, BrowserSession } from '@apexcli/browser';

const manager = new BrowserManager();
const session = await manager.createSession({
  browserType: 'chromium',
  headless: true
});
```

### Orchestrator Browser Tools

Browser automation integrated with APEX orchestration:

```typescript
import { BrowserTool } from '@apexcli/orchestrator';

const browserTool = new BrowserTool(permissionManager);
await browserTool.executeOperation('navigate', { url: 'https://example.com' });
```

## Troubleshooting

### Common Issues

1. **Browser not found**
   ```bash
   npx playwright install
   ```

2. **Permission denied errors**
   ```bash
   # Linux/macOS - ensure proper permissions
   sudo chmod +x node_modules/.bin/playwright
   ```

3. **Memory issues**
   ```bash
   # Increase Node.js memory limit
   NODE_OPTIONS="--max-old-space-size=4096" npm run test:browser-integration
   ```

4. **Timeout errors**
   - Increase timeout values in test configuration
   - Check network connectivity for external URLs
   - Ensure test pages load correctly

### Debug Mode

```bash
# Run with visible browser
BROWSER_TEST_HEADLESS=false npm run test:browser-integration

# Enable debug logging
DEBUG=pw:api npm run test:browser-integration
```

### Performance Optimization

1. **Limit concurrent tests**
   ```typescript
   // In vitest config
   poolOptions: {
     forks: { maxForks: 1 }
   }
   ```

2. **Use browser context sharing**
   ```typescript
   // Reuse browser instance across tests
   const sharedBrowser = await createBrowser();
   ```

3. **Optimize screenshot settings**
   ```typescript
   await page.screenshot({
     fullPage: false,    // Faster than full page
     clip: { x, y, width, height }
   });
   ```

## Best Practices

### Test Isolation
- Use fresh browser contexts for each test
- Clear cookies and local storage between tests
- Avoid shared state between test cases

### Element Selection
- Use data attributes for test selectors: `[data-testid="button"]`
- Avoid CSS class selectors that might change
- Use semantic selectors when possible

### Waiting Strategies
- Wait for elements to be visible and enabled
- Use `waitForNetworkIdle()` for dynamic content
- Implement retry logic for flaky operations

### Resource Management
- Always cleanup browsers and contexts
- Use temporary directories for test artifacts
- Implement proper error handling and cleanup

### Performance
- Minimize screenshot captures
- Use headless mode in CI/CD
- Limit parallel test execution
- Cleanup test artifacts regularly

## Integration with APEX

The browser automation infrastructure integrates seamlessly with APEX components:

- **Core Types**: Browser configurations use APEX core types
- **Orchestrator**: Browser tools integrate with task orchestration
- **CLI**: Browser testing commands available via CLI
- **API**: Browser automation results can be streamed via API

This infrastructure provides the foundation for comprehensive browser automation testing throughout the APEX ecosystem.