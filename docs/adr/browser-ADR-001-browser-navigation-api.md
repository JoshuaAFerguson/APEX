# ADR-001: Browser Navigation API Design

## Status
Accepted

## Date
2025-01-10

## Context
The APEX browser package (`@apex/browser`) needs a comprehensive navigation API to support browser automation workflows. The existing `BrowserSession` class has a basic `navigate(url)` method but lacks essential navigation capabilities that modern browser automation requires.

### Current State
- **Existing**: `navigate(url, options)` - Navigate to a URL with waitUntil options
- **Missing**: `reload()`, `goBack()`, `goForward()`, `waitForNavigation()`

### Requirements
1. **goto(url)**: Navigate to a URL (rename/alias of existing `navigate`)
2. **reload()**: Reload the current page
3. **goBack()**: Navigate to the previous page in browser history
4. **goForward()**: Navigate to the next page in browser history
5. **waitForNavigation()**: Wait for navigation to complete (for SPAs, redirects, etc.)

## Decision

### 1. API Design

All navigation methods will follow the established pattern in `BrowserSession`:
- Return `Promise<BrowserActionResult<T>>`
- Include duration tracking
- Handle timeouts gracefully
- Validate browser state before operations

#### Method Signatures

```typescript
// Navigate to URL (alias for existing navigate method)
goto(url: string, options?: NavigationOptions): Promise<BrowserActionResult<string>>

// Reload current page
reload(options?: NavigationOptions): Promise<BrowserActionResult<string>>

// Navigate back in history
goBack(options?: NavigationOptions): Promise<BrowserActionResult<string | null>>

// Navigate forward in history
goForward(options?: NavigationOptions): Promise<BrowserActionResult<string | null>>

// Wait for navigation to complete
waitForNavigation(options?: WaitForNavigationOptions): Promise<BrowserActionResult<string>>
```

### 2. Options Interface

Extend the existing `NavigationOptions` and add a new `WaitForNavigationOptions`:

```typescript
// Existing NavigationOptions (no changes needed)
interface NavigationOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  referer?: string;
}

// New options for waitForNavigation
interface WaitForNavigationOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  // URL pattern to wait for (optional - string or RegExp)
  url?: string | RegExp;
}
```

### 3. Return Values

| Method | Success Data | Notes |
|--------|--------------|-------|
| `goto(url)` | `string` (final URL) | Same as existing `navigate` |
| `reload()` | `string` (URL after reload) | Returns current URL |
| `goBack()` | `string \| null` | `null` if no history to go back to |
| `goForward()` | `string \| null` | `null` if no history to go forward to |
| `waitForNavigation()` | `string` (new URL) | URL after navigation completes |

### 4. Error Handling

All methods will:
1. Check if `this.page` exists (return error if browser not launched)
2. Catch Playwright exceptions and convert to `BrowserActionResult` format
3. Handle timeout errors gracefully with descriptive messages
4. Track operation duration in all cases (success or failure)

#### Error Messages (add to constants.ts)

```typescript
export const ERROR_MESSAGES = {
  // ... existing messages
  NAVIGATION_NO_HISTORY_BACK: 'Cannot go back - no previous page in history',
  NAVIGATION_NO_HISTORY_FORWARD: 'Cannot go forward - no next page in history',
  NAVIGATION_TIMEOUT: 'Navigation timed out',
  RELOAD_FAILED: 'Page reload failed',
};
```

### 5. Implementation Strategy

#### Phase 1: Core Navigation Methods
Add to `BrowserSession` class:

```typescript
/**
 * Navigates to a URL (alias for navigate)
 */
async goto(url: string, options: NavigationOptions = {}): Promise<BrowserActionResult<string>> {
  return this.navigate(url, options);
}

/**
 * Reloads the current page
 */
async reload(options: NavigationOptions = {}): Promise<BrowserActionResult<string>> {
  const startTime = Date.now();

  if (!this.page) {
    return {
      success: false,
      error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
      duration: Date.now() - startTime,
    };
  }

  try {
    await this.page.reload({
      timeout: options.timeout || this.config.timeout,
      waitUntil: options.waitUntil,
    });

    return {
      success: true,
      data: this.page.url(),
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Navigates back in browser history
 */
async goBack(options: NavigationOptions = {}): Promise<BrowserActionResult<string | null>> {
  const startTime = Date.now();

  if (!this.page) {
    return {
      success: false,
      error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
      duration: Date.now() - startTime,
    };
  }

  try {
    const response = await this.page.goBack({
      timeout: options.timeout || this.config.timeout,
      waitUntil: options.waitUntil,
    });

    // response is null if there was no previous page
    return {
      success: true,
      data: response ? this.page.url() : null,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Navigates forward in browser history
 */
async goForward(options: NavigationOptions = {}): Promise<BrowserActionResult<string | null>> {
  const startTime = Date.now();

  if (!this.page) {
    return {
      success: false,
      error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
      duration: Date.now() - startTime,
    };
  }

  try {
    const response = await this.page.goForward({
      timeout: options.timeout || this.config.timeout,
      waitUntil: options.waitUntil,
    });

    // response is null if there was no next page
    return {
      success: true,
      data: response ? this.page.url() : null,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Waits for navigation to complete
 */
async waitForNavigation(options: WaitForNavigationOptions = {}): Promise<BrowserActionResult<string>> {
  const startTime = Date.now();

  if (!this.page) {
    return {
      success: false,
      error: ERROR_MESSAGES.BROWSER_NOT_LAUNCHED,
      duration: Date.now() - startTime,
    };
  }

  try {
    await this.page.waitForURL(options.url || '**/*', {
      timeout: options.timeout || this.config.timeout,
      waitUntil: options.waitUntil,
    });

    return {
      success: true,
      data: this.page.url(),
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}
```

### 6. Type Exports

Add `WaitForNavigationOptions` to `types.ts` and export from `index.ts`.

### 7. Testing Strategy

Add comprehensive tests to `browser-session.test.ts`:

```typescript
describe('Navigation Methods', () => {
  describe('goto', () => {
    it('should navigate to URL (alias for navigate)');
    it('should return final URL after redirects');
    it('should handle navigation timeout');
  });

  describe('reload', () => {
    it('should reload current page');
    it('should return URL after reload');
    it('should handle reload timeout');
    it('should fail if browser not launched');
  });

  describe('goBack', () => {
    it('should navigate back in history');
    it('should return null if no history');
    it('should handle navigation timeout');
  });

  describe('goForward', () => {
    it('should navigate forward in history');
    it('should return null if no forward history');
    it('should handle navigation timeout');
  });

  describe('waitForNavigation', () => {
    it('should wait for navigation to complete');
    it('should wait for specific URL pattern');
    it('should handle timeout');
    it('should work with SPA navigation');
  });
});
```

## Consequences

### Positive
1. **Consistency**: All navigation methods follow the same pattern as existing methods
2. **Type Safety**: Full TypeScript support with proper return types
3. **Error Handling**: Graceful handling of all edge cases (no history, timeouts, etc.)
4. **Performance Tracking**: All methods include duration tracking for performance monitoring
5. **Backward Compatibility**: `goto` is an alias, `navigate` remains available

### Negative
1. **API Surface Growth**: Adds 5 new methods to BrowserSession
2. **Testing Overhead**: Requires additional test cases for all new methods

### Risks
1. **Browser History Behavior**: `goBack`/`goForward` behavior depends on actual browser history which may vary
2. **SPA Navigation**: `waitForNavigation` may need careful timeout tuning for SPAs

## File Changes Summary

| File | Change |
|------|--------|
| `packages/browser/src/types.ts` | Add `WaitForNavigationOptions` interface |
| `packages/browser/src/constants.ts` | Add new error messages |
| `packages/browser/src/browser-session.ts` | Add `goto`, `reload`, `goBack`, `goForward`, `waitForNavigation` methods |
| `packages/browser/src/index.ts` | Export `WaitForNavigationOptions` type |
| `packages/browser/src/__tests__/browser-session.test.ts` | Add navigation method tests |

## References

- [Playwright Page.goBack()](https://playwright.dev/docs/api/class-page#page-go-back)
- [Playwright Page.goForward()](https://playwright.dev/docs/api/class-page#page-go-forward)
- [Playwright Page.reload()](https://playwright.dev/docs/api/class-page#page-reload)
- [Playwright Page.waitForURL()](https://playwright.dev/docs/api/class-page#page-wait-for-url)
