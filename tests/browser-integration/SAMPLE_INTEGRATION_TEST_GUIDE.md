# Sample Integration Test - Complete Setup Guide

## Overview

The `sample-complete-setup-demonstration.test.ts` file provides a comprehensive example of how to use the complete APEX test infrastructure. This test demonstrates:

- ✅ Browser automation with Playwright
- ✅ Mock server integration for realistic testing
- ✅ Navigation scenarios and user interactions
- ✅ Test utilities and assertion helpers
- ✅ Fixture usage for common scenarios
- ✅ Error handling and performance measurement
- ✅ Screenshot capture and console monitoring

## Quick Start

### Running the Sample Test

```bash
# Run all browser integration tests (includes the sample test)
npm run test:browser-integration

# Run only the sample test specifically
npx vitest run tests/browser-integration/sample-complete-setup-demonstration.test.ts

# Run with watch mode for development
npx vitest tests/browser-integration/sample-complete-setup-demonstration.test.ts

# Run with debug output
npx vitest run tests/browser-integration/sample-complete-setup-demonstration.test.ts --reporter=verbose
```

### Validation Commands

```bash
# Validate browser infrastructure
npm run validate:browser-infrastructure

# Validate Playwright setup
npm run validate:playwright-setup

# Check TypeScript compilation
npx tsc --noEmit --project tests/browser-integration/
```

## Test Structure

The sample test is organized into several demonstration sections:

### 1. 🌐 Browser Automation Infrastructure
- Browser instance creation and management
- Multiple context isolation
- Basic page navigation

### 2. 🔧 Test Utilities Demonstration
- Safe element interactions with retry logic
- Element waiting with custom conditions
- Console message capture
- Performance measurement

### 3. 🎭 Mock Server Integration
- Filesystem mock server usage
- HTTP response mocking
- Server lifecycle management

### 4. 🎯 Navigation Scenarios
- Predefined navigation patterns
- Complex page navigation with state
- Error handling scenarios

### 5. 🎪 Fixture Usage Demonstration
- Form interaction patterns
- Error handling fixtures
- Screenshot capture workflows

### 6. 🔍 Advanced Testing Scenarios
- Dynamic content loading
- Network condition simulation
- Browser permissions testing

### 7. 📊 Infrastructure Validation
- Mock server health checks
- Browser capability validation
- Performance benchmarks

## Key Components Used

### Browser Setup (`setup.ts`)
```typescript
import {
  createBrowser,
  createBrowserContext,
  createPage,
  captureScreenshot,
  waitForNetworkIdle,
} from './setup';
```

### Common Scenarios (`fixtures/common-scenarios.ts`)
```typescript
import {
  createTestPage,
  runNavigationScenario,
  runInteractionScenario,
  NAVIGATION_SCENARIOS,
  INTERACTION_SCENARIOS,
} from './fixtures/common-scenarios';
```

### Test Utilities (`utils/test-helpers.ts`)
```typescript
import {
  takeScreenshot,
  waitForElement,
  safeClick,
  safeFill,
  captureConsoleMessages,
  measurePerformance,
} from './utils/test-helpers';
```

### Mock Server Factory (`test-utils/mock-server-factory.ts`)
```typescript
import {
  mockServerFactory,
  MOCK_FILESYSTEM_SERVER,
  MOCK_MEMORY_SERVER,
  MOCK_HTTP_SERVER,
} from '../test-utils/mock-server-factory';
```

## Configuration

### Browser Test Configuration
The test uses the browser integration Vitest config:

```typescript
// tests/browser-integration/vitest.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 60000,
    setupFiles: ['./setup.ts'],
    pool: 'forks',
  },
});
```

### Environment Variables
- `CI=true` - Runs tests in headless mode with retries
- `BROWSER_TEST_HEADLESS=true` - Forces headless mode
- `APEX_TEST_MODE=browser-integration` - Sets test mode

## Extending the Sample Test

### Adding New Test Scenarios

1. **Add Navigation Scenarios**:
```typescript
// In fixtures/common-scenarios.ts
export const MY_CUSTOM_SCENARIOS: NavigationScenario[] = [
  {
    name: 'Custom page load',
    url: 'data:text/html,<html><title>Custom</title></html>',
    expectedTitle: 'Custom',
    timeout: 5000,
  },
];
```

2. **Add Custom Mock Servers**:
```typescript
// Create custom mock server
const customServer = mockServerFactory.createCustomServer({
  entry: {
    name: 'my-service',
    description: 'Custom service for testing',
    version: '1.0.0',
    serverConfig: { name: 'my-service', type: 'stdio' },
    capabilities: ['data:read', 'data:write'],
  },
  behavior: {
    requestDelayMs: 100,
    errorProbability: 0.1,
  },
});
```

3. **Add Custom Utilities**:
```typescript
// Custom test utility
async function waitForCustomElement(page: Page, selector: string) {
  return waitForElement(page, selector, {
    visible: true,
    stable: true,
    timeout: 30000,
  });
}
```

### Performance Testing Patterns

```typescript
it('should measure page load performance', async () => {
  const performance = await measurePerformance(page, async () => {
    await page.goto('https://example.com');
    await waitForNetworkIdle(page);
  });

  expect(performance.duration).toBeLessThan(5000);
  console.log('Page load time:', performance.duration + 'ms');
});
```

### Error Testing Patterns

```typescript
it('should handle network errors gracefully', async () => {
  const errors = await capturePageErrors(page, async () => {
    // Setup network failure
    await page.route('**/*', route => route.abort());

    // Try to load page
    await page.goto('https://example.com').catch(() => {});
  });

  expect(errors.length).toBeGreaterThan(0);
});
```

## Troubleshooting

### Common Issues

1. **Browser Launch Failures**
   - Ensure Playwright browsers are installed: `npx playwright install`
   - Check system dependencies: `npx playwright install-deps`

2. **Test Timeouts**
   - Increase timeout in test configuration
   - Use `--timeout` flag: `npx vitest --timeout=120000`

3. **Mock Server Issues**
   - Check server startup logs in test output
   - Verify server state with `server.getStats()`

4. **Screenshot Failures**
   - Ensure temp directory permissions
   - Check available disk space
   - Verify screenshot path resolution

### Debug Mode

Run tests in debug mode for detailed output:

```bash
# With debug output
DEBUG=* npx vitest run tests/browser-integration/sample-complete-setup-demonstration.test.ts

# With Playwright debug
PWDEBUG=1 npx vitest run tests/browser-integration/sample-complete-setup-demonstration.test.ts

# With headed browser for visual debugging
npx vitest run tests/browser-integration/sample-complete-setup-demonstration.test.ts --config vitest.config.ts -t "specific test name"
```

## Best Practices

### 1. Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Include setup and cleanup in appropriate hooks

### 2. Resource Management
- Always close browsers, contexts, and pages
- Clean up temporary files and directories
- Stop mock servers in teardown

### 3. Error Handling
- Use try/catch for cleanup operations
- Capture screenshots on test failures
- Log meaningful error messages

### 4. Performance
- Limit concurrent browser instances
- Use headless mode in CI
- Clean up resources promptly

### 5. Maintainability
- Extract common patterns into utilities
- Use configuration files for test settings
- Document complex test scenarios

## Integration with CI/CD

### GitHub Actions Example

```yaml
- name: Run Browser Integration Tests
  run: |
    npx playwright install --with-deps
    npm run test:browser-integration
  env:
    CI: true
    BROWSER_TEST_HEADLESS: true
```

### Docker Example

```dockerfile
FROM mcr.microsoft.com/playwright:v1.47.0-focal

WORKDIR /app
COPY . .
RUN npm ci
RUN npm run test:browser-integration
```

## Related Documentation

- [Browser Integration Setup](./README.md)
- [Test Utilities Reference](./utils/README.md)
- [Mock Server Documentation](../test-utils/README.md)
- [Playwright Documentation](https://playwright.dev/docs)
- [Vitest Documentation](https://vitest.dev/guide/)

---

This sample test serves as both a validation of the infrastructure and a comprehensive reference for building robust browser integration tests in the APEX project.