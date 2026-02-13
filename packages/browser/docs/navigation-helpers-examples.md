# Navigation Helpers Examples

This document provides usage examples for the navigation helper functions implemented in the browser package.

## Overview

The navigation helpers module provides four standalone utility functions for browser automation:

- `goto` - Navigate to a URL with enhanced error handling
- `waitForNavigation` - Wait for navigation to complete
- `assertURL` - Assert the current URL matches expectations
- `assertPageContent` - Assert the page contains expected content

## Import Examples

```typescript
// Direct import from navigation helpers
import { goto, waitForNavigation, assertURL, assertPageContent } from '@apexcli/browser/navigation-helpers';

// Import from test-utils barrel export
import { goto, waitForNavigation, assertURL, assertPageContent } from '@apexcli/browser/test-utils';

// Import from main browser package
import { goto, waitForNavigation, assertURL, assertPageContent } from '@apexcli/browser';
```

## Basic Usage Examples

### goto Function

```typescript
import { chromium } from 'playwright';
import { goto } from '@apexcli/browser';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

// Basic navigation
const result = await goto(page, 'https://example.com');
if (result.success) {
  console.log(`Successfully navigated to: ${result.finalUrl}`);
} else {
  console.error(`Navigation failed: ${result.error}`);
}

// Navigation with options
const result2 = await goto(page, 'https://slow-site.com', {
  timeout: 60000,
  waitUntil: 'networkidle'
});
```

### waitForNavigation Function

```typescript
// Wait for any navigation to complete
const result = await waitForNavigation(page, {
  timeout: 10000,
  waitUntil: 'load'
});

// Wait for specific URL pattern
const result2 = await waitForNavigation(page, {
  url: /\/dashboard/,
  timeout: 15000
});
```

### assertURL Function

```typescript
// Assert exact URL match
await assertURL(page, 'https://example.com/dashboard');

// Assert with regex pattern
await assertURL(page, /\/users\/\d+/);

// Assert pathname only
await assertURL(page, '/dashboard', { pathname: true });

// Ignore query parameters
await assertURL(page, 'https://example.com/search', {
  ignoreQuery: true
});
```

### assertPageContent Function

```typescript
// Assert page contains text
await assertPageContent(page, 'Welcome to our site');

// Case-insensitive search
await assertPageContent(page, 'WELCOME', { ignoreCase: true });

// Search within specific element
await assertPageContent(page, 'Error message', {
  selector: '.error-container'
});

// Regex pattern matching
await assertPageContent(page, /User \d+ logged in/);

// Whole word matching
await assertPageContent(page, 'cat', { wholeWord: true });
```

## Integration Examples

### Complete Test Workflow

```typescript
import { chromium } from 'playwright';
import { goto, waitForNavigation, assertURL, assertPageContent } from '@apexcli/browser';

async function testLoginFlow() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    const navResult = await goto(page, 'https://app.example.com/login');
    if (!navResult.success) {
      throw new Error(`Failed to navigate: ${navResult.error}`);
    }

    // Assert we're on the login page
    await assertURL(page, /\/login$/);
    await assertPageContent(page, 'Sign In');

    // Fill login form
    await page.fill('#email', 'user@example.com');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    const waitResult = await waitForNavigation(page, {
      url: /\/dashboard/,
      timeout: 10000
    });

    if (!waitResult.success) {
      throw new Error(`Login redirect failed: ${waitResult.error}`);
    }

    // Assert successful login
    await assertURL(page, /\/dashboard/);
    await assertPageContent(page, 'Welcome back!');

    console.log('Login test completed successfully');

  } finally {
    await browser.close();
  }
}
```

### Error Handling Pattern

```typescript
async function robustNavigationTest(page: Page, url: string) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const result = await goto(page, url, {
        timeout: 30000,
        waitUntil: 'networkidle'
      });

      if (result.success) {
        console.log(`Successfully navigated to ${result.finalUrl} after ${attempt + 1} attempts`);
        return result;
      }

      console.warn(`Navigation attempt ${attempt + 1} failed: ${result.error}`);
      attempt++;

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
      }

    } catch (error) {
      console.error(`Unexpected error on attempt ${attempt + 1}:`, error);
      attempt++;
    }
  }

  throw new Error(`Navigation failed after ${maxRetries} attempts`);
}
```

## Advanced Usage

### Custom Assertions with Element Selectors

```typescript
// Using ElementSelector objects
await assertPageContent(page, 'Submit', {
  selector: {
    type: 'xpath',
    value: '//button[contains(@class, "submit")]'
  }
});

await assertPageContent(page, 'Welcome', {
  selector: {
    type: 'testId',
    value: 'welcome-message'
  }
});
```

### Performance Monitoring

```typescript
async function monitoredNavigation(page: Page, url: string) {
  const startTime = Date.now();

  const result = await goto(page, url);

  console.log(`Navigation completed in ${result.duration}ms`);
  console.log(`Total time: ${Date.now() - startTime}ms`);

  if (result.duration > 5000) {
    console.warn('Slow navigation detected');
  }

  return result;
}
```

## Type Safety Examples

```typescript
import type { NavigationHelperResult, AssertURLOptions, AssertPageContentOptions } from '@apexcli/browser';

// Type-safe option handling
const urlOptions: AssertURLOptions = {
  timeout: 5000,
  pathname: true,
  ignoreQuery: true
};

const contentOptions: AssertPageContentOptions = {
  timeout: 10000,
  selector: '.main-content',
  ignoreCase: true,
  wholeWord: false
};

// Type-safe result handling
const result: NavigationHelperResult<string> = await goto(page, url);
if (result.success && result.data) {
  // TypeScript knows result.data is string
  console.log(`Final URL: ${result.data}`);
}
```

## Best Practices

1. **Always check result.success**: Navigation operations can fail for many reasons
2. **Set appropriate timeouts**: Different pages have different load characteristics
3. **Use specific selectors**: When asserting content, be as specific as possible
4. **Handle errors gracefully**: Network issues, slow pages, and other factors can cause failures
5. **Use proper wait conditions**: Choose between 'load', 'domcontentloaded', and 'networkidle' based on your needs
6. **Clean up resources**: Always close browsers and contexts when done