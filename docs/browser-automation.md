# Browser Automation

## Overview

APEX provides powerful headless browser automation capabilities for testing, debugging, and web interaction. Built on Playwright, it offers comprehensive browser control with built-in safety features and permission management.

## Features

- **Multi-browser support** - Chromium, Firefox, and WebKit engines
- **Interactive operations** - Navigate, click, type, scroll, hover
- **Screenshot capture** - Visual debugging and regression testing
- **Console monitoring** - Capture browser console logs and errors
- **Visual regression testing** - Compare screenshots across runs
- **Runtime error detection** - Detect and report JavaScript errors
- **Form automation** - Submit forms and handle complex interactions

## Configuration

### Basic Setup

```yaml
# .apex/config.yaml
tools:
  browser:
    enabled: true
    engine: chromium          # chromium, firefox, webkit
    headless: true            # false for visible browser
    timeout: 30000            # Default timeout in ms
    allowedDomains:
      - localhost
      - '*.local'
      - 'test.example.com'
    blockedDomains:
      - '*.onion'
      - 'malicious.site'
    screenshotPath: 'screenshots'
    downloadPath: 'downloads'
```

### Advanced Configuration

```yaml
tools:
  browser:
    enabled: true
    engine: chromium
    headless: true

    # Browser launch options
    launchOptions:
      slowMo: 0                # Delay between actions (ms)
      devtools: false          # Open DevTools
      args:
        - '--no-sandbox'
        - '--disable-dev-shm-usage'

    # Context options
    contextOptions:
      viewport:
        width: 1920
        height: 1080
      userAgent: 'APEX/1.0'
      locale: 'en-US'
      timezoneId: 'America/New_York'

    # Security settings
    security:
      allowedDomains:
        - 'localhost'
        - '*.test.local'
      blockedDomains:
        - '*.onion'
        - 'ads.*'
      blockResources:
        - 'image'              # Block images for faster loading
        - 'font'               # Block fonts
      interceptRequests: true   # Enable request monitoring
```

### Permission Configuration

```yaml
permissions:
  tools:
    browser:
      requireConfirmation: false
      allowedOperations:
        - navigate
        - click
        - type
        - screenshot
        # Elevated permissions
        - evaluate             # Requires explicit approval
        - submit               # Requires explicit approval

      # Domain-specific permissions
      domains:
        'localhost':
          operations: ['*']     # All operations allowed
        '*.example.com':
          operations: ['navigate', 'click', 'screenshot']
        'production.site.com':
          operations: []        # Blocked
```

## Usage Examples

### Basic Navigation and Interaction

```typescript
// Navigate to a page
const navigateResult = await apex.browser.navigate({
  url: 'https://localhost:3000',
  waitUntil: 'networkidle'    // Wait for network activity to settle
});

if (navigateResult.success) {
  console.log(`Navigated to: ${navigateResult.url}`);
}

// Click an element
const clickResult = await apex.browser.click({
  selector: '#submit-button',
  button: 'left',             // left, right, middle
  clickCount: 1
});

// Type text into an input
const typeResult = await apex.browser.type({
  selector: '#username',
  text: 'testuser',
  delay: 50                   // Delay between keystrokes
});

// Scroll the page
const scrollResult = await apex.browser.scroll({
  x: 0,
  y: 500
});
```

### Taking Screenshots

```typescript
// Basic screenshot
const screenshotResult = await apex.browser.screenshot({
  filename: 'page-capture.png',
  fullPage: true              // Capture full scrollable page
});

// Element-specific screenshot
const elementScreenshot = await apex.browser.screenshot({
  filename: 'button.png',
  selector: '#important-button'
});

// Screenshot with custom options
const customScreenshot = await apex.browser.screenshot({
  filename: 'mobile-view.png',
  viewport: { width: 375, height: 667 },
  deviceScaleFactor: 2
});
```

### Visual Regression Testing

```typescript
// First run - capture baseline
const baselineResult = await apex.browser.screenshot({
  filename: 'baseline.png'
});

// After changes - capture current state
const currentResult = await apex.browser.screenshot({
  filename: 'current.png'
});

// Compare screenshots
const compareResult = await apex.browser.compareScreenshot({
  baseline: 'baseline.png',
  current: 'current.png',
  threshold: 0.2,             // Difference threshold (0-1)
  diffFilename: 'diff.png'    // Output diff image
});

if (!compareResult.identical) {
  console.log(`Visual difference: ${compareResult.difference}%`);
  console.log(`Diff saved to: ${compareResult.diffPath}`);
}
```

### Form Automation

```typescript
// Fill out a complete form
const formResult = await apex.browser.type({
  selector: '#contact-form input[name="name"]',
  text: 'John Doe'
});

await apex.browser.type({
  selector: '#contact-form input[name="email"]',
  text: 'john@example.com'
});

await apex.browser.type({
  selector: '#contact-form textarea[name="message"]',
  text: 'This is a test message'
});

// Submit the form
const submitResult = await apex.browser.submit({
  selector: '#contact-form'
});

// Alternative: click submit button
const buttonSubmit = await apex.browser.click({
  selector: '#contact-form button[type="submit"]'
});
```

### Element Inspection

```typescript
// Get text content
const textResult = await apex.browser.getText({
  selector: 'h1'
});
console.log(`Page title: ${textResult.text}`);

// Get attribute value
const linkResult = await apex.browser.getAttribute({
  selector: 'a.download-link',
  attribute: 'href'
});
console.log(`Download URL: ${linkResult.value}`);

// Get HTML content
const htmlResult = await apex.browser.getHtml({
  selector: '.content'         // Optional: specific element
});
console.log(`Page HTML: ${htmlResult.html}`);
```

### Advanced Operations

```typescript
// Wait for element to appear
const waitResult = await apex.browser.waitForSelector({
  selector: '.dynamic-content',
  timeout: 10000              // Wait up to 10 seconds
});

// Hover over element
const hoverResult = await apex.browser.hover({
  selector: '.menu-trigger'
});

// Execute JavaScript (requires elevated permission)
const evalResult = await apex.browser.evaluate({
  expression: `
    document.querySelector('#counter').textContent = '42';
    return document.querySelector('#counter').textContent;
  `
});
```

## Permission Requirements

### Basic Operations

These operations require standard browser permission:

- `navigate` - Navigate to URLs
- `click` - Click elements
- `type` - Type text
- `scroll` - Scroll page
- `hover` - Hover over elements
- `screenshot` - Capture screenshots
- `getText` - Get element text
- `getAttribute` - Get element attributes
- `getHtml` - Get page HTML
- `waitForSelector` - Wait for elements

### Elevated Operations

These operations require elevated permission due to security implications:

- `evaluate` - Execute arbitrary JavaScript
- `submit` - Submit forms (can trigger data submission)

### Permission Checking

```typescript
// Check if operation is permitted
const permission = await apex.permissions.checkToolPermission({
  tool: 'browser',
  scope: 'evaluate'
});

if (permission.granted) {
  const result = await apex.browser.evaluate({
    expression: 'window.location.href'
  });
}
```

## Workflows and Patterns

### End-to-End Testing Workflow

```typescript
async function testLoginWorkflow() {
  // Navigate to login page
  await apex.browser.navigate({
    url: 'https://localhost:3000/login'
  });

  // Take baseline screenshot
  await apex.browser.screenshot({
    filename: 'test/screenshots/login-page.png'
  });

  // Fill login form
  await apex.browser.type({
    selector: 'input[name="username"]',
    text: 'testuser'
  });

  await apex.browser.type({
    selector: 'input[name="password"]',
    text: 'testpass'
  });

  // Submit form
  await apex.browser.click({
    selector: 'button[type="submit"]'
  });

  // Wait for redirect
  await apex.browser.waitForSelector({
    selector: '.dashboard',
    timeout: 5000
  });

  // Verify login success
  const welcomeText = await apex.browser.getText({
    selector: '.welcome-message'
  });

  console.log(`Login successful: ${welcomeText.text.includes('Welcome')}`);
}
```

### Visual Regression Testing Workflow

```typescript
async function visualRegressionTest() {
  const pages = [
    '/home',
    '/products',
    '/about',
    '/contact'
  ];

  for (const page of pages) {
    await apex.browser.navigate({
      url: `https://localhost:3000${page}`
    });

    // Take current screenshot
    const current = `test/current/${page.slice(1)}-current.png`;
    await apex.browser.screenshot({
      filename: current,
      fullPage: true
    });

    // Compare with baseline
    const baseline = `test/baseline/${page.slice(1)}-baseline.png`;
    const compareResult = await apex.browser.compareScreenshot({
      baseline,
      current,
      threshold: 0.1
    });

    if (!compareResult.identical) {
      console.warn(`Visual difference detected on ${page}: ${compareResult.difference}%`);
    }
  }
}
```

### Cross-Browser Testing

```yaml
# .apex/config.yaml
browserTesting:
  engines:
    - chromium
    - firefox
    - webkit

  testSuites:
    compatibility:
      pages:
        - '/dashboard'
        - '/settings'
      actions:
        - navigate
        - screenshot
        - basicInteraction
```

## Error Handling

### Common Error Scenarios

```typescript
// Handle navigation errors
const result = await apex.browser.navigate({
  url: 'https://invalid-domain.example'
});

if (!result.success) {
  console.error(`Navigation failed: ${result.error}`);

  switch (result.errorType) {
    case 'NETWORK_ERROR':
      console.log('Check internet connection');
      break;
    case 'PERMISSION_DENIED':
      console.log('Domain not in allowlist');
      break;
    case 'TIMEOUT':
      console.log('Page took too long to load');
      break;
  }
}

// Handle element not found
const clickResult = await apex.browser.click({
  selector: '#missing-button'
});

if (!clickResult.success) {
  console.error(`Click failed: ${clickResult.error}`);

  // Take screenshot for debugging
  await apex.browser.screenshot({
    filename: 'debug-missing-element.png'
  });
}
```

### Retry Logic

```typescript
async function robustClick(selector: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await apex.browser.click({ selector });

    if (result.success) {
      return result;
    }

    console.warn(`Click attempt ${attempt} failed: ${result.error}`);

    if (attempt < maxRetries) {
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error(`Failed to click ${selector} after ${maxRetries} attempts`);
}
```

## Best Practices

### Performance Optimization

1. **Use headless mode** for faster execution
2. **Block unnecessary resources** (images, fonts) when not needed
3. **Set appropriate timeouts** to avoid hanging operations
4. **Use screenshot caching** for visual regression tests
5. **Limit concurrent browser sessions**

### Security Best Practices

1. **Use domain allowlists** to restrict navigation
2. **Block dangerous domains** (.onion, malicious sites)
3. **Require approval for elevated operations** (evaluate, submit)
4. **Monitor request interception** for data exfiltration
5. **Use sandboxed browser environments**

### Testing Best Practices

1. **Create stable selectors** (data-testid attributes)
2. **Use visual regression tests** for UI consistency
3. **Test across multiple browsers** for compatibility
4. **Take screenshots on failures** for debugging
5. **Implement proper cleanup** after test sessions

### Debugging Tips

1. **Enable verbose logging** for detailed execution traces
2. **Use visible mode** (headless: false) for development
3. **Capture console logs** to detect JavaScript errors
4. **Take screenshots before/after actions** for debugging
5. **Use browser DevTools** in non-headless mode

## Integration with Other Tools

### File Operations

```typescript
// Save page HTML for analysis
const htmlResult = await apex.browser.getHtml();
await apex.file.write({
  path: 'debug/page-source.html',
  content: htmlResult.html
});

// Process screenshots with image tools
const screenshot = await apex.browser.screenshot({
  filename: 'temp-screenshot.png'
});

if (screenshot.success) {
  await apex.bash.execute({
    command: `convert ${screenshot.path} -resize 800x600 resized-screenshot.png`
  });
}
```

### Test Integration

```typescript
// Generate test reports
async function generateTestReport() {
  const results = [];

  for (const testCase of testCases) {
    const result = await runBrowserTest(testCase);
    results.push(result);
  }

  const report = {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }
  };

  await apex.file.write({
    path: 'test-reports/browser-tests.json',
    content: JSON.stringify(report, null, 2)
  });
}
```

## Troubleshooting

### Browser Installation Issues

```bash
# Install browsers manually
npx playwright install chromium firefox webkit

# Check browser availability
apex browser check-installation

# Clear browser cache
apex browser clear-cache
```

### Permission Issues

```bash
# Check browser permissions
apex permissions list browser

# Grant browser permissions
apex permissions grant browser allow-always

# Check domain allowlist
apex config get tools.browser.allowedDomains
```

### Performance Issues

```bash
# Check browser resource usage
apex browser stats

# Clear screenshots directory
rm -rf screenshots/*

# Optimize browser settings
apex config set tools.browser.contextOptions.viewport.width 1280
apex config set tools.browser.contextOptions.viewport.height 720
```

### Common Error Messages

**"Domain not allowed"**
- Add domain to `allowedDomains` in configuration
- Check for typos in domain patterns

**"Element not found"**
- Verify selector syntax
- Use `waitForSelector` for dynamic content
- Take screenshot to debug element visibility

**"Permission denied for evaluate"**
- Grant elevated browser permissions
- Use `apex permissions grant browser:evaluate allow-once`

**"Screenshot failed"**
- Check filesystem permissions
- Verify screenshot directory exists
- Ensure sufficient disk space

## Examples Repository

For complete examples and integration patterns, see:
- [Browser Automation Examples](./examples/browser-automation/)
- [Visual Regression Tests](./examples/visual-regression/)
- [Form Automation Patterns](./examples/form-automation/)
- [Cross-Browser Testing](./examples/cross-browser/)