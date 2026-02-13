# Playwright Browser Automation Setup

## Overview

This document describes the Playwright browser automation setup for the APEX project. Playwright is fully configured and integrated with both standalone testing and Vitest browser mode.

## Architecture

### Core Components

1. **Playwright Configuration** (`playwright.config.ts`)
   - Multi-browser support (Chromium, Firefox, WebKit)
   - CI/CD optimizations
   - Screenshot and video capture
   - Global setup and teardown

2. **Vitest Browser Integration** (`vitest.browser.config.ts`)
   - Browser testing with Vitest using Playwright provider
   - Real browser environment for accurate testing
   - Integration with existing test infrastructure

3. **Test Infrastructure**
   - Global setup/teardown for resource management
   - Browser utilities and helpers
   - Cross-browser testing support

## Installation and Dependencies

### Required Packages

```json
{
  "devDependencies": {
    "@playwright/test": "^1.47.0",
    "playwright": "^1.47.0",
    "@vitest/browser": "^4.0.15",
    "vitest": "^4.0.15"
  }
}
```

### Browser Installation

```bash
# Install Playwright browsers
npm run playwright:install

# Or directly with npx
npx playwright install
```

## Configuration Details

### Playwright Configuration

**File**: `playwright.config.ts`

Key features:
- **Test Directory**: `./tests/playwright`
- **Supported Browsers**: Chromium, Firefox, WebKit, Mobile Chrome/Safari, Edge
- **CI Optimizations**: Reduced workers, retry logic, headless mode
- **Visual Testing**: Screenshot comparison with threshold settings
- **Performance**: Configurable timeouts and parallel execution

### Vitest Browser Configuration

**File**: `vitest.browser.config.ts`

Key features:
- **Provider**: Playwright
- **Browser**: Chromium (default, configurable)
- **Test Patterns**: `tests/browser/**/*.test.ts`, `tests/e2e/**/*.test.ts`
- **Coverage**: V8 provider with workspace package inclusion
- **Environment**: Real browser with jsdom fallback

## Test File Structure

```
tests/
├── playwright/                 # Standalone Playwright tests
│   ├── global-setup.ts        # Global test setup
│   ├── global-teardown.ts     # Global test cleanup
│   ├── basic-verification.spec.ts          # Basic functionality tests
│   ├── browser-launch-verification.spec.ts # Comprehensive browser tests
│   └── infrastructure-validation.js        # Setup validation script
├── browser/                   # Vitest browser tests
│   ├── setup.ts              # Browser test setup
│   └── playwright-vitest-integration.test.ts # Integration tests
└── e2e/                       # End-to-end tests
    └── (e2e test files)
```

## Test Categories

### 1. Playwright Standalone Tests

**Purpose**: Full browser automation testing
**Location**: `tests/playwright/`
**Command**: `npm run playwright:test`

Features tested:
- Browser launch and navigation
- Page interactions (clicks, forms, input)
- JavaScript execution and console capture
- Screenshot and visual testing
- Performance measurements
- Cross-browser compatibility
- Advanced web APIs

### 2. Vitest Browser Tests

**Purpose**: Component and integration testing in real browser environment
**Location**: `tests/browser/`
**Command**: `npm run test:browser`

Features tested:
- DOM manipulation in browser context
- Real browser APIs (localStorage, sessionStorage, fetch)
- Event handling and user interactions
- CSS and responsive design
- Modern JavaScript features
- Async operations and timing

### 3. Infrastructure Validation

**Purpose**: Verify complete setup
**Location**: `tests/playwright/infrastructure-validation.js`
**Command**: `node tests/playwright/infrastructure-validation.js`

Validates:
- File structure and configuration
- Package dependencies
- Module imports
- Configuration syntax
- Test directory setup

## Available Commands

### Playwright Commands

```bash
# Install browsers
npm run playwright:install

# Run all Playwright tests
npm run playwright:test

# Run tests with browser UI (headed mode)
npm run playwright:test:headed

# Debug mode with step-through
npm run playwright:test:debug

# Interactive test UI
npm run playwright:test:ui
```

### Vitest Browser Commands

```bash
# Run browser tests
npm run test:browser

# Watch mode for development
npm run test:browser:watch

# Coverage report
npm run test:browser:coverage
```

### Validation Commands

```bash
# Validate Playwright setup
npm run validate:playwright-setup

# Validate browser infrastructure
npm run validate:browser-infrastructure
```

## Browser Support

### Desktop Browsers

1. **Chromium** (Default)
   - Latest stable Chromium
   - Optimized for CI/CD
   - Full feature support

2. **Firefox**
   - Desktop Firefox
   - Media permissions configured
   - Cross-engine compatibility

3. **WebKit**
   - Safari engine
   - macOS/iOS compatibility testing

4. **Branded Browsers**
   - Google Chrome
   - Microsoft Edge

### Mobile Browsers

1. **Mobile Chrome** (Pixel 5 simulation)
2. **Mobile Safari** (iPhone 12 simulation)

## CI/CD Integration

### GitHub Actions

```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps

- name: Run Playwright tests
  run: npm run playwright:test

- name: Upload test results
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: test-results/
```

### Optimizations for CI

- **Headless mode**: Automatic in CI environments
- **Reduced workers**: Single worker for stability
- **Retry logic**: 2 retries on failure
- **Performance**: Optimized timeouts and resource usage

## Testing Best Practices

### 1. Test Structure

```typescript
test.describe('Feature Group', () => {
  test.beforeEach(async ({ page }) => {
    // Setup for each test
  });

  test('should verify specific behavior', async ({ page }) => {
    // Test implementation
    await page.setContent(testHTML);
    await expect(page.locator('selector')).toBeVisible();
  });
});
```

### 2. Page Content Testing

```typescript
// Create test pages dynamically
const testHTML = `
  <!DOCTYPE html>
  <html>
    <head><title>Test Page</title></head>
    <body>
      <div id="content">Test content</div>
      <script>
        // Test JavaScript
        console.log('Page loaded');
      </script>
    </body>
  </html>
`;

await page.setContent(testHTML);
```

### 3. Interaction Testing

```typescript
// Button clicks
await page.click('#button-id');
await expect(page.locator('#result')).toHaveText('Expected');

// Form input
await page.fill('#input-id', 'test value');
await page.press('#input-id', 'Enter');

// File operations
await page.setInputFiles('#file-input', 'path/to/file.txt');
```

### 4. Visual Testing

```typescript
// Screenshots
await page.screenshot({ path: 'screenshot.png' });
await page.locator('.component').screenshot();

// Visual comparisons
await expect(page).toHaveScreenshot('expected.png');
```

## Troubleshooting

### Common Issues

1. **Browser not installed**
   ```bash
   npm run playwright:install
   ```

2. **Tests timing out**
   - Increase timeout in configuration
   - Check for blocked network requests
   - Verify page load times

3. **CI failures**
   - Ensure browsers installed with dependencies
   - Check for display/GPU issues in headless mode
   - Verify memory and disk space

4. **Screenshot differences**
   - Adjust threshold settings
   - Disable animations: `animations: 'disabled'`
   - Use consistent viewport sizes

### Debug Commands

```bash
# Debug specific test
npx playwright test --debug test-file.spec.ts

# Record new test
npx playwright codegen

# Show trace viewer
npx playwright show-trace trace.zip
```

## Integration with APEX

### Package Integration

- **Core**: Types and utilities for test data
- **Orchestrator**: Task management testing
- **CLI**: Command testing and validation
- **API**: Server endpoint testing
- **Web UI**: Component and user flow testing

### Test Data

```typescript
// Use APEX types in tests
import { Task, Agent } from '@apex/core';

// Create test data
const testTask: Task = {
  id: 'test-task-1',
  type: 'feature',
  description: 'Test feature implementation'
};
```

### Environment Variables

```bash
# Browser test configuration
BROWSER_TEST_HEADLESS=true    # Force headless mode
NODE_ENV=test                 # Test environment
APEX_TEST_MODE=browser        # Enable browser test mode
```

## Performance Considerations

### Resource Usage

- **Memory**: Browsers require 100-500MB each
- **CPU**: Parallel execution uses multiple cores
- **Disk**: Screenshots and videos consume storage
- **Network**: Tests may require internet access

### Optimization Strategies

1. **Selective Testing**
   - Run specific test suites for different scenarios
   - Use test tags and filters

2. **Resource Management**
   - Limit concurrent browsers in CI
   - Clean up test artifacts regularly
   - Use efficient selectors

3. **Test Isolation**
   - Independent test contexts
   - Fresh browser state per test
   - Avoid shared state

## Security Considerations

### Browser Security

- Tests run in isolated browser contexts
- No persistent data between test runs
- Sandbox mode in CI environments

### Test Data

- Use synthetic test data
- Avoid real credentials or sensitive information
- Clean up test data after runs

### Network Access

- Mock external API calls where possible
- Use test-specific endpoints
- Validate SSL certificates in production tests

## Future Enhancements

### Planned Features

1. **Visual Regression Testing**
   - Automated screenshot comparison
   - CI integration for visual diffs

2. **Performance Testing**
   - Core Web Vitals measurement
   - Load time benchmarking

3. **Accessibility Testing**
   - WCAG compliance checks
   - Screen reader compatibility

4. **Mobile Testing**
   - Device emulation expansion
   - Touch interaction testing

### Integration Opportunities

1. **Monitoring Integration**
   - Test result dashboards
   - Performance trend tracking

2. **Development Workflow**
   - Pre-commit hooks for critical tests
   - Branch-specific test execution

3. **Documentation**
   - Living documentation from tests
   - API documentation validation