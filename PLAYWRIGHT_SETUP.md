# Playwright Browser Automation Setup for APEX

This document describes the Playwright browser automation setup implemented for the APEX project.

## 🚀 Overview

The APEX project now includes comprehensive browser automation capabilities using:

- **Playwright** - Modern browser automation framework
- **@playwright/test** - Playwright's testing framework
- **@vitest/browser** - Browser testing with Vitest
- **Cross-browser support** - Chromium, Firefox, WebKit

## 📁 File Structure

```
APEX/
├── playwright.config.ts                     # Main Playwright configuration
├── vitest.browser.config.ts                # Vitest browser configuration
├── tests/
│   ├── playwright/                          # Playwright-specific tests
│   │   ├── global-setup.ts                 # Global test setup
│   │   ├── global-teardown.ts              # Global test teardown
│   │   └── basic-verification.spec.ts       # Basic Playwright tests
│   └── browser/                             # Vitest browser tests
│       ├── setup.ts                        # Browser test setup
│       └── playwright-vitest-integration.test.ts
└── scripts/
    ├── setup-playwright.sh                 # Installation script
    └── validate-playwright-setup.js        # Validation script
```

## 🛠 Setup Instructions

### 1. Install Dependencies

The following dependencies have been added to `package.json`:

```json
{
  "devDependencies": {
    "@playwright/test": "^1.47.0",
    "@vitest/browser": "^4.0.15",
    "playwright": "^1.47.0"
  }
}
```

To install all dependencies:

```bash
npm install
```

### 2. Install Playwright Browsers

Install browser binaries for testing:

```bash
npm run playwright:install
# or directly:
# npx playwright install
```

### 3. Verify Setup

Run the validation script to ensure everything is set up correctly:

```bash
npm run validate:playwright-setup
```

## 🧪 Running Tests

### Playwright Tests

```bash
# Run all Playwright tests
npm run playwright:test

# Run with browser UI (headed mode)
npm run playwright:test:headed

# Debug tests
npm run playwright:test:debug

# Use Playwright UI for test exploration
npm run playwright:test:ui
```

### Vitest Browser Tests

```bash
# Run Vitest browser tests
npm run test:browser

# Run in watch mode
npm run test:browser:watch

# Run with coverage
npm run test:browser:coverage
```

## ⚙️ Configuration

### Playwright Configuration (`playwright.config.ts`)

Key features of the Playwright configuration:

- **Multi-browser support**: Chromium, Firefox, WebKit, Mobile browsers
- **CI/CD optimization**: Headless mode in CI, retry configuration
- **Screenshot/video capture**: On failure only
- **Global setup/teardown**: Environment preparation and cleanup
- **Custom test directory**: `./tests/playwright`

### Vitest Browser Configuration (`vitest.browser.config.ts`)

Key features of the Vitest browser configuration:

- **Playwright provider**: Uses Playwright as the browser automation engine
- **Real browser environment**: Tests run in actual browsers
- **Integration with existing Vitest infrastructure**
- **Coverage reporting**: Browser code coverage

## 📝 Writing Tests

### Playwright Tests

Create test files in `tests/playwright/` with `.spec.ts` extension:

```typescript
import { test, expect } from '@playwright/test';

test('example test', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
});
```

### Vitest Browser Tests

Create test files in `tests/browser/` with `.test.ts` extension:

```typescript
import { describe, it, expect } from 'vitest';

describe('Browser test', () => {
  it('should work in browser environment', () => {
    expect(window).toBeDefined();
    expect(document).toBeDefined();
  });
});
```

## 🌐 Browser Support

The setup includes configurations for:

- **Chromium** (default)
- **Firefox**
- **WebKit** (Safari engine)
- **Mobile Chrome**
- **Mobile Safari**
- **Microsoft Edge**
- **Google Chrome**

## 🔧 Utilities and Helpers

### Browser Test Utilities

Located in `tests/browser/setup.ts`:

- `waitForElement()` - Wait for DOM elements
- `waitFor()` - Wait for conditions
- `simulateClick()` - Simulate user interactions
- `simulateType()` - Simulate text input

### Playwright Utilities

Located in `tests/playwright/global-setup.ts`:

- Environment validation
- Test data preparation
- Artifact management
- Browser installation verification

## 📊 Test Artifacts

Test artifacts are stored in:

- `test-results/` - Playwright test results
- `coverage/` - Code coverage reports
- Screenshots and videos (on failure)

## 🚦 CI/CD Integration

The setup is optimized for CI/CD environments:

- Headless mode in CI
- Retry configuration for flaky tests
- Optimized browser arguments for CI
- Artifact collection and cleanup

## 🐛 Debugging

### Debug Playwright Tests

```bash
# Debug specific test
npm run playwright:test:debug -- tests/playwright/basic-verification.spec.ts

# Use Playwright inspector
npm run playwright:test -- --debug
```

### Debug Vitest Browser Tests

```bash
# Run with verbose output
npm run test:browser -- --reporter=verbose

# Run specific test file
npm run test:browser -- tests/browser/playwright-vitest-integration.test.ts
```

## 📋 Acceptance Criteria Verification

✅ **Playwright is installed with browsers**
- Dependencies added to package.json
- Browser installation script provided
- Validation script confirms installation

✅ **Configuration file exists**
- `playwright.config.ts` created with comprehensive configuration
- `vitest.browser.config.ts` for Vitest integration

✅ **Playwright can launch a browser and navigate to a test page successfully**
- Test files created demonstrating:
  - Browser launch and navigation
  - Element interaction
  - Screenshot capture
  - Console message handling
  - JavaScript execution

## 🔗 Related Documentation

- [Playwright Documentation](https://playwright.dev/)
- [Vitest Browser Mode](https://vitest.dev/guide/browser.html)
- [APEX Testing Strategy](./docs/testing-strategy.md)

## 🆘 Troubleshooting

### Common Issues

1. **Browser not found**: Run `npm run playwright:install`
2. **TypeScript errors**: Ensure all dependencies are installed
3. **Permission errors**: Check file permissions on scripts
4. **CI failures**: Verify headless mode configuration

### Getting Help

- Check the validation script output: `npm run validate:playwright-setup`
- Review test artifacts in `test-results/`
- Check browser console for errors in headed mode