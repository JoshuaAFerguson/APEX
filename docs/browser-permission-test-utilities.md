# Browser Permission Test Utilities

## Overview

APEX provides comprehensive testing utilities for browser permission testing, validation, and automation. These utilities include custom assertion helpers for permission states, mock factories for test data generation, platform-specific testing utilities, and Vitest integration for enhanced testing workflows.

### Utility Categories

- **Permission Assertion Helpers** - Custom matchers and assertion functions for validating permission states
- **Mock Data Factories** - Utilities for creating test permission contexts, histories, and results
- **Platform Detection** - Cross-platform test utilities for Windows/Unix/macOS compatibility
- **Browser Test Integration** - Specialized helpers for browser automation testing
- **Test Setup & Configuration** - Automatic registration and configuration utilities

## Installation and Setup

### Prerequisites

- APEX core package (`@apex/core`)
- Vitest testing framework
- TypeScript support

### Basic Setup

Add the test setup to your Vitest configuration:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['@apex/core/test-setup'], // Automatically registers custom matchers
  },
});
```

### Manual Import

For individual test files, import the setup directly:

```typescript
import { describe, it, expect } from 'vitest';
import '@apex/core/test-setup'; // Auto-registers custom matchers

// Your test code here
```

### Manual Matcher Registration

If you need more control over matcher registration:

```typescript
import { expect } from 'vitest';
import { setupPermissionMatchers } from '@apex/core/test-utils';

// Register custom matchers manually
setupPermissionMatchers(expect);
```

### Required Imports

```typescript
// Core utilities and types
import {
  expectPermissionGranted,
  expectPermissionDenied,
  expectPermissionPending,
  assertPermissionContext,
  assertPermissionHistory,
  createMockToolPermissionResult,
  createMockPermissionContext,
  createMockPermissionHistory,
  type ToolPermissionResult,
  type PermissionContext,
  type PermissionHistory,
} from '@apex/core/test-utils';

// Platform utilities
import {
  isWindows,
  isUnix,
  isMacOS,
  isLinux,
  skipOnWindows,
  skipOnUnix,
  testOnAllPlatforms,
} from '@apex/core/test-utils';
```

## API Reference: Permission Assertion Helpers

> **Tip:** These assertion helpers work best with test data created by the [Mock Data Factories](#mock-data-factories) below. For the underlying `ToolPermissionResult` and `PermissionContext` type definitions, see the [System APIs Reference](./system-apis-reference.md#-permissions-system-apis).

### `toBePermissionGranted(expectedLevel?)`

**Custom Vitest Matcher** - Assert that a permission result is granted, optionally with a specific level.

```typescript
const result = await permissionManager.checkPermission('Read');

// Basic granted assertion
expect(result).toBePermissionGranted();

// With specific level
expect(result).toBePermissionGranted('allow-always');

// Negation
expect(result).not.toBePermissionGranted('deny');
```

**Parameters:**
- `expectedLevel` (optional): `'allow-always' | 'allow-once' | 'deny'`

**Error Messages:**
- `"Expected permission to be granted, but it was denied: Reason: Tool is blocked"`
- `"Expected permission to be granted with level allow-always, but got: allow-once"`

**Usage Example:**
```typescript
describe('Read Permission Tests', () => {
  it('should grant read access to project files', async () => {
    const result = await permissionManager.checkPermission('Read', '/project/src/file.ts');
    expect(result).toBePermissionGranted('allow-always');
  });
});
```

---

### `toBePermissionDenied(expectedReason?)`

**Custom Vitest Matcher** - Assert that a permission result is denied, optionally checking the denial reason.

```typescript
const result = await permissionManager.checkPermission('Bash');

// Basic denied assertion
expect(result).toBePermissionDenied();

// With reason check (partial match, case-insensitive)
expect(result).toBePermissionDenied('dangerous operation');

// Negation
expect(result).not.toBePermissionDenied();
```

**Parameters:**
- `expectedReason` (optional): String to check against denial reason (partial match, case-insensitive)

**Error Messages:**
- `"Expected permission to be denied, but it was granted: Level: allow-always"`
- `"Expected permission to be denied with reason containing 'security', but got: 'Tool not found'"`

**Usage Example:**
```typescript
describe('Security Policy Tests', () => {
  it('should block dangerous shell commands', async () => {
    const result = await permissionManager.checkPermission('Bash', 'rm -rf /');
    expect(result).toBePermissionDenied('dangerous operation');
  });
});
```

---

### `toBePermissionPending()`

**Custom Vitest Matcher** - Assert that a permission result requires user confirmation.

```typescript
const result = await permissionManager.checkPermission('Write');

// Assert requires confirmation
expect(result).toBePermissionPending();

// Negation
expect(result).not.toBePermissionPending();
```

**Error Messages:**
- `"Expected permission to be pending (require confirmation), but it was granted automatically"`
- `"Expected permission to be pending (require confirmation), but it was denied outright"`

**Usage Example:**
```typescript
describe('Confirmation Workflow Tests', () => {
  it('should require confirmation for write operations in review mode', async () => {
    const manager = new PermissionManager({ preset: 'review-all' });
    const result = await manager.checkPermission('Write', '/project/file.ts');
    expect(result).toBePermissionPending();
  });
});
```

---

### `toHavePermissionContext(expectedState)`

**Custom Vitest Matcher** - Assert that a permission context has expected permissions and state.

```typescript
const context = {
  permissions: [
    { tool: 'Read', level: 'allow-always' },
    { tool: 'Write', level: 'allow-once' }
  ],
  preset: 'review-all',
  agent: 'developer'
};

expect(context).toHavePermissionContext({
  hasPermissions: ['Read', 'Write'],        // Must have these tools
  lacksPermissions: ['Bash'],               // Must NOT have these tools
  preset: 'review-all',                     // Must have this preset
  agent: 'developer',                       // Must have this agent
  permissionCount: 2                        // Must have exact count
});
```

**Parameters:**
- `expectedState.hasPermissions` (optional): Array of tool names that must exist
- `expectedState.lacksPermissions` (optional): Array of tool names that must NOT exist
- `expectedState.preset` (optional): Expected preset name
- `expectedState.agent` (optional): Expected agent name
- `expectedState.permissionCount` (optional): Expected exact number of permissions

**Error Messages:**
- `"Missing expected permission for tool: Bash"`
- `"Unexpected permission found for tool: Bash"`
- `"Expected preset: read-only, got: autonomous"`

**Usage Example:**
```typescript
describe('Permission Context Validation', () => {
  it('should configure developer agent with correct permissions', () => {
    const context = createMockPermissionContext({
      preset: 'review-all',
      agents: {
        developer: [
          { tool: 'Read', level: 'allow-always' },
          { tool: 'Write', level: 'allow-once' }
        ]
      }
    });

    expect(context.agents.developer).toHavePermissionContext({
      hasPermissions: ['Read', 'Write'],
      lacksPermissions: ['Bash', 'WebFetch'],
      permissionCount: 2
    });
  });
});
```

---

### `toHavePermissionHistory(expectedCriteria)`

**Custom Vitest Matcher** - Assert that permission history matches expected criteria.

```typescript
const history = {
  entries: [
    { tool: 'Read', granted: true, timestamp: new Date() },
    { tool: 'Write', granted: false, timestamp: new Date() }
  ],
  total: 2,
  granted: 1,
  denied: 1
};

expect(history).toHavePermissionHistory({
  totalEntries: 2,                         // Total number of entries
  grantedCount: 1,                        // Number granted
  deniedCount: 1,                         // Number denied
  hasToolEntry: 'Read',                   // Must have entry for tool
  lacksToolEntry: 'Bash',                 // Must NOT have entry for tool
  hasRecentEntry: {                       // Must have recent entry
    tool: 'Read',
    withinMinutes: 5,
    granted: true
  },
  entriesInOrder: ['Read', 'Write']       // Check chronological order
});
```

**Parameters:**
- `expectedCriteria.totalEntries` (optional): Expected total number of entries
- `expectedCriteria.grantedCount` (optional): Expected number of granted entries
- `expectedCriteria.deniedCount` (optional): Expected number of denied entries
- `expectedCriteria.hasToolEntry` (optional): Tool that must have an entry
- `expectedCriteria.lacksToolEntry` (optional): Tool that must NOT have an entry
- `expectedCriteria.hasRecentEntry` (optional): Criteria for recent entry validation
- `expectedCriteria.entriesInOrder` (optional): Expected chronological order of tools

**Error Messages:**
- `"Expected 5 total entries, got: 2"`
- `"Expected entry for tool: Bash"`
- `"Expected recent entry for tool: Read within 5 minutes (granted)"`

**Usage Example:**
```typescript
describe('Permission History Tracking', () => {
  it('should track permission decisions over time', async () => {
    const history = await permissionStore.getHistory();

    expect(history).toHavePermissionHistory({
      totalEntries: 10,
      grantedCount: 7,
      deniedCount: 3,
      hasRecentEntry: {
        tool: 'Read',
        withinMinutes: 1,
        granted: true
      },
      entriesInOrder: ['Read', 'Write', 'Bash', 'Read']
    });
  });
});
```

---

### `expectPermissionGranted(result, expectedLevel?)`

**Function-based Assertion** - Alternative to the custom matcher for more control.

```typescript
import { expectPermissionGranted } from '@apex/core/test-utils';

const result = await permissionManager.checkPermission('Read');
expectPermissionGranted(result, 'allow-always');
```

**Parameters:**
- `result`: `ToolPermissionResult` - The permission result to check
- `expectedLevel` (optional): Expected permission level

**Usage Example:**
```typescript
describe('Permission Manager Tests', () => {
  it('should grant permissions with proper levels', async () => {
    const result = await manager.checkPermission('Read');

    // Function-based assertion with detailed error handling
    try {
      expectPermissionGranted(result, 'allow-always');
    } catch (error) {
      console.log('Permission check failed:', error.message);
      throw error;
    }
  });
});
```

---

### `expectPermissionDenied(result, expectedReason?)`

**Function-based Assertion** - Alternative to the custom matcher for denial checking.

```typescript
import { expectPermissionDenied } from '@apex/core/test-utils';

const result = await permissionManager.checkPermission('Bash');
expectPermissionDenied(result, 'dangerous operation');
```

**Parameters:**
- `result`: `ToolPermissionResult` - The permission result to check
- `expectedReason` (optional): Expected denial reason (partial match)

---

### `expectPermissionPending(result)`

**Function-based Assertion** - Alternative to the custom matcher for confirmation checking.

```typescript
import { expectPermissionPending } from '@apex/core/test-utils';

const result = await permissionManager.checkPermission('Write');
expectPermissionPending(result);
```

**Parameters:**
- `result`: `ToolPermissionResult` - The permission result to check

---

### `assertPermissionContext(context, expectedState)`

**Function-based Assertion** - Alternative to the custom matcher for context validation.

```typescript
import { assertPermissionContext } from '@apex/core/test-utils';

const context = createMockPermissionContext({ /* ... */ });
assertPermissionContext(context, {
  hasPermissions: ['Read', 'Write'],
  preset: 'review-all'
});
```

---

### `assertPermissionHistory(history, expectedCriteria)`

**Function-based Assertion** - Alternative to the custom matcher for history validation.

```typescript
import { assertPermissionHistory } from '@apex/core/test-utils';

const history = await permissionStore.getHistory();
assertPermissionHistory(history, {
  totalEntries: 10,
  grantedCount: 7
});
```

## Mock Data Factories

> **Tip:** Use these factories to generate test data for the [Permission Assertion Helpers](#api-reference-permission-assertion-helpers) above. For complete mock environments and additional test utilities, see the [Mock Helpers API Reference](./mock-helpers-api.md). For browser automation operations that exercise these permissions in integration tests, see the [Browser Automation Guide](./browser-automation.md).

### `createMockToolPermissionResult(options)`

Create mock permission results for testing.

```typescript
const grantedResult = createMockToolPermissionResult({
  allowed: true,
  level: 'allow-always',
  requiresConfirmation: false,
});

const deniedResult = createMockToolPermissionResult({
  allowed: false,
  denialReason: 'Tool requires elevated privileges',
});

const pendingResult = createMockToolPermissionResult({
  allowed: true,
  requiresConfirmation: true,
  level: 'allow-once',
});
```

### `createMockPermissionContext(options)`

Create mock permission contexts for testing.

```typescript
const context = createMockPermissionContext({
  preset: 'review-all',
  agents: {
    developer: [
      { tool: 'Read', level: 'allow-always' },
      { tool: 'Write', level: 'allow-once' }
    ],
    reviewer: [
      { tool: 'Read', level: 'allow-always' }
    ]
  }
});
```

### `createMockPermissionHistory(options)`

Create mock permission histories for testing.

```typescript
const history = createMockPermissionHistory({
  entries: [
    { tool: 'Read', granted: true, timestamp: new Date() },
    { tool: 'Write', granted: false, timestamp: new Date() }
  ],
  total: 2,
  granted: 1,
  denied: 1
});
```

## Integration Examples

> **Note:** These examples combine [Permission Assertion Helpers](#api-reference-permission-assertion-helpers) with [Mock Data Factories](#mock-data-factories). For cross-platform test utilities (platform detection, conditional skipping), see the [Test Utilities](./test-utilities.md) documentation.

### Complete Browser Permission Test Suite

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import '@apex/core/test-setup';
import {
  createMockToolPermissionResult,
  createMockPermissionContext,
  expectPermissionGranted,
  expectPermissionDenied
} from '@apex/core/test-utils';

describe('Browser Permission Integration', () => {
  let permissionManager: PermissionManager;

  beforeEach(() => {
    permissionManager = new PermissionManager({
      preset: 'review-all',
      customRules: {
        Browser: { behavior: 'allow', config: { requireConfirmation: true } }
      }
    });
  });

  describe('Browser Navigation Permissions', () => {
    it('should allow navigation to approved domains', async () => {
      const result = await permissionManager.checkPermission(
        'Browser',
        { operation: 'navigate', url: 'https://localhost:3000' }
      );

      expect(result).toBePermissionGranted();
      expect(result.metadata?.allowedDomains).toContain('localhost');
    });

    it('should block navigation to forbidden domains', async () => {
      const result = await permissionManager.checkPermission(
        'Browser',
        { operation: 'navigate', url: 'https://malicious.example.com' }
      );

      expect(result).toBePermissionDenied('domain not in allowlist');
    });

    it('should require confirmation for evaluate operations', async () => {
      const result = await permissionManager.checkPermission(
        'Browser',
        { operation: 'evaluate', expression: 'window.location.href' }
      );

      expect(result).toBePermissionPending();
    });
  });

  describe('Permission Context Management', () => {
    it('should maintain browser permission context correctly', () => {
      const context = createMockPermissionContext({
        preset: 'browser-testing',
        agents: {
          tester: [
            { tool: 'Browser', level: 'allow-once', scope: 'localhost' },
            { tool: 'Read', level: 'allow-always' }
          ]
        }
      });

      expect(context.agents.tester).toHavePermissionContext({
        hasPermissions: ['Browser', 'Read'],
        preset: 'browser-testing',
        permissionCount: 2
      });
    });
  });

  describe('Permission History Tracking', () => {
    it('should track browser operation history', async () => {
      // Simulate a series of browser operations
      await permissionManager.checkPermission('Browser', { operation: 'navigate' });
      await permissionManager.checkPermission('Browser', { operation: 'screenshot' });
      await permissionManager.checkPermission('Browser', { operation: 'click' });

      const history = await permissionStore.getHistory();

      expect(history).toHavePermissionHistory({
        totalEntries: 3,
        hasToolEntry: 'Browser',
        hasRecentEntry: {
          tool: 'Browser',
          withinMinutes: 1,
          granted: true
        }
      });
    });
  });
});
```

### Cross-Platform Browser Testing

```typescript
import { describe, it, expect } from 'vitest';
import '@apex/core/test-setup';
import {
  isWindows,
  isUnix,
  skipOnWindows,
  testOnAllPlatforms,
  createMockToolPermissionResult
} from '@apex/core/test-utils';

describe('Cross-Platform Browser Permissions', () => {
  testOnAllPlatforms('browser executable detection', (platform) => {
    const result = createMockToolPermissionResult({
      allowed: true,
      metadata: {
        browserPath: platform === 'win32'
          ? 'C:\\Program Files\\Chrome\\chrome.exe'
          : '/usr/bin/google-chrome'
      }
    });

    expect(result).toBePermissionGranted();

    if (platform === 'win32') {
      expect(result.metadata?.browserPath).toMatch(/\.exe$/);
    } else {
      expect(result.metadata?.browserPath).toMatch(/^\/usr/);
    }
  });

  it('should handle Windows-specific browser paths', () => {
    skipOnUnix(); // Only run on Windows

    const result = createMockToolPermissionResult({
      allowed: true,
      metadata: {
        browserPaths: [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
        ]
      }
    });

    expect(result).toBePermissionGranted();
    expect(result.metadata?.browserPaths).toEqual(
      expect.arrayContaining([expect.stringMatching(/chrome\.exe$/)])
    );
  });
});
```

### Error Handling and Edge Cases

```typescript
describe('Permission Error Handling', () => {
  it('should provide detailed error messages for complex failures', () => {
    const complexResult = createMockToolPermissionResult({
      allowed: false,
      denialReason: 'Browser operation failed: Domain verification failed for https://suspicious.example.com',
      metadata: {
        failureDetails: {
          domainCheck: false,
          securityCheck: true,
          permissionLevel: 'denied'
        }
      }
    });

    expect(() => {
      expect(complexResult).toBePermissionGranted();
    }).toThrow(/Expected permission to be granted, but it was denied/);

    expect(complexResult).toBePermissionDenied('domain verification failed');
  });

  it('should validate complex permission contexts with nested validation', () => {
    const nestedContext = createMockPermissionContext({
      preset: 'custom-security',
      agents: {
        'security-tester': [
          { tool: 'Browser', level: 'allow-once', scope: '*.test.local' },
          { tool: 'Read', level: 'allow-always' }
        ]
      },
      metadata: {
        securityLevel: 'high',
        auditEnabled: true
      }
    });

    expect(nestedContext.agents['security-tester']).toHavePermissionContext({
      hasPermissions: ['Browser', 'Read'],
      lacksPermissions: ['Write', 'Bash'],
      permissionCount: 2
    });

    expect(nestedContext.metadata?.securityLevel).toBe('high');
    expect(nestedContext.metadata?.auditEnabled).toBe(true);
  });
});
```

---

## API Reference: Browser State Fixtures

> **Tip:** The `browserFixtures` object provides factory functions for creating predefined browser state objects for common testing scenarios. These fixtures include authentication states, error conditions, loading states, and network conditions. For detailed modification of states, see the [browserHelpers](#api-reference-browser-state-helpers) below.

```typescript
import { browserFixtures, browserHelpers, BrowserStateBuilder } from '@apex/core/test-fixtures';
```

### `cleanState(overrides?)`

Creates a clean initial browser state with no user data, representing a fresh browser start.

```typescript
const state = browserFixtures.cleanState({
  url: 'https://custom.example.com',
  title: 'Custom Page'
});
// state.isAuthenticated => false, state.localStorage => {}, etc.
```

**Parameters:**
- `overrides`: `Partial<BrowserState>` *(optional)* — Properties to override in the default clean state

**Returns:** `BrowserState` — Clean browser state with default values:
- `url`: `'about:blank'`
- `title`: `''`
- `isLoading`: `false`
- `hasError`: `false`
- `isAuthenticated`: `false`
- `localStorage`: `{}`
- `sessionStorage`: `{}`
- `cookies`: `[]`
- `consoleMessages`: `[]`
- `networkRequests`: `[]`

**Usage Example:**
```typescript
it('should start with clean browser state', () => {
  const state = browserFixtures.cleanState();
  expect(state.isAuthenticated).toBe(false);
  expect(state.localStorage).toEqual({});
  expect(state.cookies).toEqual([]);
});
```

---

### `loggedInPage(overrides?)`

Creates a browser state representing a logged-in user with authentication data and session information.

```typescript
const state = browserFixtures.loggedInPage({
  sessionStorage: {
    'current-project': '/users/custom/project'
  }
});
// state.isAuthenticated => true, state.localStorage['auth-token'] => 'mock-jwt-token', etc.
```

**Parameters:**
- `overrides`: `Partial<BrowserState>` *(optional)* — Properties to override in the default logged-in state

**Returns:** `BrowserState` — Logged-in browser state with default values:
- `url`: `'https://app.apex.dev/dashboard'`
- `title`: `'APEX Dashboard'`
- `isAuthenticated`: `true`
- `localStorage`: Contains `'auth-token'`, `'user-preferences'`, `'session-id'`
- `sessionStorage`: Contains `'current-project'`, `'active-agents'`
- `cookies`: Contains authentication and CSRF tokens
- `consoleMessages`: Contains successful authentication logs
- `networkRequests`: Contains user profile and projects API calls

**Usage Example:**
```typescript
it('should have authenticated user with session data', () => {
  const state = browserFixtures.loggedInPage();
  expect(state.isAuthenticated).toBe(true);
  expect(state.localStorage['auth-token']).toBe('mock-jwt-token');
  expect(state.cookies).toHaveLength(2);
  expect(state.networkRequests).toHaveLength(2);
});
```

---

### `errorPage(overrides?)`

Creates a browser state representing an error condition (network error, 500 error, etc.).

```typescript
const state = browserFixtures.errorPage({
  localStorage: {
    'last-error': JSON.stringify({
      code: 404,
      message: 'Page Not Found'
    })
  }
});
// state.hasError => true, state.isAuthenticated => false (errors clear auth)
```

**Parameters:**
- `overrides`: `Partial<BrowserState>` *(optional)* — Properties to override in the default error state

**Returns:** `BrowserState` — Error browser state with default values:
- `url`: `'https://app.apex.dev/error'`
- `title`: `'Error - APEX'`
- `hasError`: `true`
- `isAuthenticated`: `false` (errors often clear auth state)
- `localStorage`: Contains last error information
- `consoleMessages`: Contains error messages and warnings
- `networkRequests`: Contains failed API requests with 500 status

**Usage Example:**
```typescript
it('should handle server errors with error state', () => {
  const state = browserFixtures.errorPage();
  expect(state.hasError).toBe(true);
  expect(state.consoleMessages.some(msg => msg.type === 'error')).toBe(true);
  expect(state.networkRequests[0].status).toBe(500);
});
```

---

### `loadingPage(overrides?)`

Creates a browser state representing a loading condition (initial load, navigation in progress).

```typescript
const state = browserFixtures.loadingPage({
  sessionStorage: {
    'loading-progress': '75%'
  }
});
// state.isLoading => true, state.isAuthenticated => false (unknown during loading)
```

**Parameters:**
- `overrides`: `Partial<BrowserState>` *(optional)* — Properties to override in the default loading state

**Returns:** `BrowserState` — Loading browser state with default values:
- `url`: `'https://app.apex.dev/loading'`
- `title`: `'Loading... - APEX'`
- `isLoading`: `true`
- `isAuthenticated`: `false` (unknown during loading)
- `localStorage`: Contains loading start time
- `sessionStorage`: Contains navigation state
- `consoleMessages`: Contains loading progress messages
- `networkRequests`: Contains resource loading requests (bundle.js, styles.css)

**Usage Example:**
```typescript
it('should show loading state during navigation', () => {
  const state = browserFixtures.loadingPage();
  expect(state.isLoading).toBe(true);
  expect(state.title).toBe('Loading... - APEX');
  expect(state.consoleMessages.some(msg => msg.message.includes('Loading'))).toBe(true);
});
```

---

### `offlinePage(overrides?)`

Creates a browser state representing a network offline condition.

```typescript
const state = browserFixtures.offlinePage({
  localStorage: {
    'cached-content': JSON.stringify({
      projects: ['project1', 'project2']
    })
  }
});
// state.localStorage['offline-mode'] => 'true', state.networkRequests => []
```

**Parameters:**
- `overrides`: `Partial<BrowserState>` *(optional)* — Properties to override in the default offline state

**Returns:** `BrowserState` — Offline browser state with default values:
- `url`: `'https://app.apex.dev/offline'`
- `title`: `'Offline - APEX'`
- `isAuthenticated`: `false` (cannot verify when offline)
- `localStorage`: Contains offline mode flag, last online time, and cached data
- `consoleMessages`: Contains network loss warnings and offline mode notifications
- `networkRequests`: `[]` (no requests when offline)

**Usage Example:**
```typescript
it('should handle offline mode with cached data', () => {
  const state = browserFixtures.offlinePage();
  expect(state.localStorage['offline-mode']).toBe('true');
  expect(state.networkRequests).toHaveLength(0);
  expect(state.consoleMessages.some(msg => msg.message.includes('Network connection lost'))).toBe(true);
});
```

---

### `permissionDeniedPage(overrides?)`

Creates a browser state representing a permission denied condition (user lacks access to a resource).

```typescript
const state = browserFixtures.permissionDeniedPage({
  sessionStorage: {
    'attempted-resource': '/api/admin/users'
  }
});
// state.isAuthenticated => true, but access denied to specific resource
```

**Parameters:**
- `overrides`: `Partial<BrowserState>` *(optional)* — Properties to override in the default permission denied state

**Returns:** `BrowserState` — Permission denied browser state with default values:
- `url`: `'https://app.apex.dev/access-denied'`
- `title`: `'Access Denied - APEX'`
- `hasError`: `false` (not a system error, just access denied)
- `isAuthenticated`: `true` (user is logged in but lacks permissions)
- `localStorage`: Contains auth token and access level information
- `sessionStorage`: Contains attempted resource path
- `cookies`: Contains authentication session cookie
- `consoleMessages`: Contains permission warnings and role information
- `networkRequests`: Contains failed API request with 403 status

**Usage Example:**
```typescript
it('should handle authenticated user with insufficient permissions', () => {
  const state = browserFixtures.permissionDeniedPage();
  expect(state.isAuthenticated).toBe(true);
  expect(state.networkRequests[0].status).toBe(403);
  expect(state.consoleMessages.some(msg => msg.message.includes('Access denied'))).toBe(true);
});
```

---

### `fromScenario(scenario, overrides?)`

Creates a browser state based on a predefined test scenario.

```typescript
const state = browserFixtures.fromScenario('logged-in-user', {
  url: 'https://custom.example.com/dashboard'
});
// Equivalent to: browserFixtures.loggedInPage({ url: 'https://custom.example.com/dashboard' })
```

**Parameters:**
- `scenario`: `TestScenario` — The test scenario to create a state for
- `overrides`: `Partial<BrowserState>` *(optional)* — Properties to override in the scenario state

**Supported Scenarios:**
- `'clean-state'`: Creates clean state (calls `cleanState()`)
- `'logged-in-user'`: Creates logged-in state (calls `loggedInPage()`)
- `'error-state'`: Creates error state (calls `errorPage()`)
- `'loading-state'`: Creates loading state (calls `loadingPage()`)
- `'network-offline'`: Creates offline state (calls `offlinePage()`)
- `'permission-denied'`: Creates permission denied state (calls `permissionDeniedPage()`)

**Usage Example:**
```typescript
const scenarios = ['clean-state', 'logged-in-user', 'error-state'] as const;

scenarios.forEach(scenario => {
  it(`should handle ${scenario} scenario`, () => {
    const state = browserFixtures.fromScenario(scenario);
    expect(state).toBeDefined();
    expect(state.url).toBeDefined();
    expect(state.title).toBeDefined();
  });
});
```

---

## API Reference: Browser State Helpers

> **Tip:** The `browserHelpers` object provides pure, immutable helper functions for manipulating `BrowserState` objects. Each method returns a **new** `BrowserState` instance — the original state is never mutated. For building complex states from scratch, see the [BrowserStateBuilder](#api-reference-browserstatebuilder) below.

```typescript
import { browserHelpers, browserFixtures } from '@apex/core/test-fixtures';
```

### `addConsoleMessage(state, type, message)`

Adds a console message entry (with auto-generated timestamp) to the browser state.

```typescript
const state = browserHelpers.addConsoleMessage(
  browserFixtures.cleanState(),
  'error',
  'Uncaught TypeError: Cannot read property of undefined'
);
// state.consoleMessages[0] => { type: 'error', message: '...', timestamp: Date }
```

**Parameters:**
- `state`: `BrowserState` — The current browser state
- `type`: `'log' | 'warn' | 'error' | 'info'` — Console message severity level
- `message`: `string` — The console message text

**Returns:** `BrowserState` — A new state with the message appended to `consoleMessages`

**Usage Example:**
```typescript
it('should capture console errors during page load', () => {
  let state = browserFixtures.cleanState();
  state = browserHelpers.addConsoleMessage(state, 'info', 'App initializing');
  state = browserHelpers.addConsoleMessage(state, 'error', 'Failed to load config');

  expect(state.consoleMessages).toHaveLength(2);
  expect(state.consoleMessages[1].type).toBe('error');
  expect(state.consoleMessages[1].timestamp).toBeInstanceOf(Date);
});
```

---

### `addNetworkRequest(state, url, method?, status?, headers?)`

Adds a network request entry to the browser state.

```typescript
const state = browserHelpers.addNetworkRequest(
  browserFixtures.cleanState(),
  'https://api.apex.dev/tasks',
  'POST',
  201,
  { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' }
);
```

**Parameters:**
- `state`: `BrowserState` — The current browser state
- `url`: `string` — The request URL
- `method`: `string` *(optional, default: `'GET'`)* — HTTP method
- `status`: `number` *(optional)* — HTTP response status code
- `headers`: `Record<string, string>` *(optional)* — Request/response headers

**Returns:** `BrowserState` — A new state with the request appended to `networkRequests`

**Usage Example:**
```typescript
it('should track API calls made during authentication', () => {
  let state = browserFixtures.cleanState();
  state = browserHelpers.addNetworkRequest(state, 'https://api.apex.dev/auth/login', 'POST', 200);
  state = browserHelpers.addNetworkRequest(state, 'https://api.apex.dev/user/profile', 'GET', 200);

  expect(state.networkRequests).toHaveLength(2);
  expect(state.networkRequests[0].method).toBe('POST');
  expect(state.networkRequests[0].status).toBe(200);
});
```

---

### `setLocalStorage(state, key, value)`

Sets a single key-value pair in the browser state's local storage, preserving existing entries.

```typescript
const state = browserHelpers.setLocalStorage(
  browserFixtures.cleanState(),
  'auth-token',
  'eyJhbGciOiJIUzI1NiJ9...'
);
// state.localStorage => { 'auth-token': 'eyJhbGciOiJIUzI1NiJ9...' }
```

**Parameters:**
- `state`: `BrowserState` — The current browser state
- `key`: `string` — The localStorage key
- `value`: `string` — The localStorage value

**Returns:** `BrowserState` — A new state with the key-value pair merged into `localStorage`

**Usage Example:**
```typescript
it('should store user preferences in localStorage', () => {
  let state = browserFixtures.cleanState();
  state = browserHelpers.setLocalStorage(state, 'theme', 'dark');
  state = browserHelpers.setLocalStorage(state, 'lang', 'en');

  expect(state.localStorage).toEqual({ theme: 'dark', lang: 'en' });
});
```

---

### `setSessionStorage(state, key, value)`

Sets a single key-value pair in the browser state's session storage, preserving existing entries.

```typescript
const state = browserHelpers.setSessionStorage(
  browserFixtures.cleanState(),
  'current-project',
  '/users/dev/my-project'
);
```

**Parameters:**
- `state`: `BrowserState` — The current browser state
- `key`: `string` — The sessionStorage key
- `value`: `string` — The sessionStorage value

**Returns:** `BrowserState` — A new state with the key-value pair merged into `sessionStorage`

**Usage Example:**
```typescript
it('should track navigation state in sessionStorage', () => {
  let state = browserFixtures.cleanState();
  state = browserHelpers.setSessionStorage(state, 'navigation-state', 'loading');
  state = browserHelpers.setSessionStorage(state, 'previous-page', '/home');

  expect(state.sessionStorage['navigation-state']).toBe('loading');
  expect(state.sessionStorage['previous-page']).toBe('/home');
});
```

---

### `addCookie(state, name, value, options?)`

Adds a cookie to the browser state with optional domain and path.

```typescript
const state = browserHelpers.addCookie(
  browserFixtures.cleanState(),
  'auth-session',
  'sess_abc123',
  { domain: 'app.apex.dev', path: '/dashboard' }
);
```

**Parameters:**
- `state`: `BrowserState` — The current browser state
- `name`: `string` — Cookie name
- `value`: `string` — Cookie value
- `options`: `{ domain?: string; path?: string }` *(optional)* — Cookie attributes
  - `domain` — Defaults to `'localhost'`
  - `path` — Defaults to `'/'`

**Returns:** `BrowserState` — A new state with the cookie appended to `cookies`

**Usage Example:**
```typescript
it('should set authentication cookies', () => {
  let state = browserFixtures.cleanState();
  state = browserHelpers.addCookie(state, 'auth-session', 'mock-session', {
    domain: 'app.apex.dev',
    path: '/',
  });
  state = browserHelpers.addCookie(state, 'csrf-token', 'mock-csrf');

  expect(state.cookies).toHaveLength(2);
  expect(state.cookies[0].domain).toBe('app.apex.dev');
  expect(state.cookies[1].domain).toBe('localhost'); // default
});
```

---

### `navigateTo(state, url, title?)`

Simulates navigation to a new URL. Sets `isLoading` to `false` (navigation complete). Preserves the existing title if no new title is provided.

```typescript
const state = browserHelpers.navigateTo(
  browserFixtures.loadingPage(),
  'https://app.apex.dev/dashboard',
  'APEX Dashboard'
);
// state.url => 'https://app.apex.dev/dashboard'
// state.isLoading => false
```

**Parameters:**
- `state`: `BrowserState` — The current browser state
- `url`: `string` — The destination URL
- `title`: `string` *(optional)* — The new page title (keeps existing title if omitted)

**Returns:** `BrowserState` — A new state with updated `url`, optional `title`, and `isLoading: false`

**Usage Example:**
```typescript
it('should simulate a full navigation flow', () => {
  let state = browserFixtures.cleanState();
  state = browserHelpers.startLoading(state);
  expect(state.isLoading).toBe(true);

  state = browserHelpers.navigateTo(state, 'https://app.apex.dev', 'APEX Home');
  expect(state.url).toBe('https://app.apex.dev');
  expect(state.title).toBe('APEX Home');
  expect(state.isLoading).toBe(false);
});
```

---

### `startLoading(state)`

Sets the browser state's loading flag to `true`. Typically used before a simulated navigation or resource fetch.

```typescript
const state = browserHelpers.startLoading(browserFixtures.cleanState());
// state.isLoading => true
```

**Parameters:**
- `state`: `BrowserState` — The current browser state

**Returns:** `BrowserState` — A new state with `isLoading: true`

---

### `finishLoading(state)`

Sets the browser state's loading flag to `false`. Typically used after a simulated navigation or resource fetch completes.

```typescript
const loadingState = browserFixtures.loadingPage();
const state = browserHelpers.finishLoading(loadingState);
// state.isLoading => false
```

**Parameters:**
- `state`: `BrowserState` — The current browser state

**Returns:** `BrowserState` — A new state with `isLoading: false`

---

### `setError(state, hasError?)`

Sets the browser state's error flag. Defaults to `true` if `hasError` is not specified.

```typescript
const state = browserHelpers.setError(browserFixtures.cleanState());
// state.hasError => true

const recovered = browserHelpers.setError(state, false);
// recovered.hasError => false
```

**Parameters:**
- `state`: `BrowserState` — The current browser state
- `hasError`: `boolean` *(optional, default: `true`)* — Whether the page has an error

**Returns:** `BrowserState` — A new state with updated `hasError`

**Usage Example:**
```typescript
it('should simulate error and recovery', () => {
  let state = browserFixtures.cleanState();
  state = browserHelpers.setError(state);
  expect(state.hasError).toBe(true);

  state = browserHelpers.setError(state, false);
  expect(state.hasError).toBe(false);
});
```

---

### `setAuthenticated(state, isAuthenticated)`

Sets the browser state's authentication status.

```typescript
const state = browserHelpers.setAuthenticated(browserFixtures.cleanState(), true);
// state.isAuthenticated => true
```

**Parameters:**
- `state`: `BrowserState` — The current browser state
- `isAuthenticated`: `boolean` — Whether the user is authenticated

**Returns:** `BrowserState` — A new state with updated `isAuthenticated`

**Usage Example:**
```typescript
it('should simulate login and logout', () => {
  let state = browserFixtures.cleanState();

  state = browserHelpers.setAuthenticated(state, true);
  expect(state.isAuthenticated).toBe(true);

  state = browserHelpers.setAuthenticated(state, false);
  expect(state.isAuthenticated).toBe(false);
});
```

---

### `clearBrowserData(state)`

Clears all stored browser data — localStorage, sessionStorage, cookies, consoleMessages, and networkRequests — while preserving URL, title, loading, error, and authentication state.

```typescript
const populatedState = browserFixtures.loggedInPage();
const state = browserHelpers.clearBrowserData(populatedState);

// Cleared:
// state.localStorage => {}
// state.sessionStorage => {}
// state.cookies => []
// state.consoleMessages => []
// state.networkRequests => []

// Preserved:
// state.url => 'https://app.apex.dev/dashboard'
// state.isAuthenticated => true
```

**Parameters:**
- `state`: `BrowserState` — The current browser state

**Returns:** `BrowserState` — A new state with all stored data cleared

**Usage Example:**
```typescript
it('should clear browser data while preserving page state', () => {
  const loggedIn = browserFixtures.loggedInPage();
  const cleared = browserHelpers.clearBrowserData(loggedIn);

  expect(cleared.localStorage).toEqual({});
  expect(cleared.cookies).toEqual([]);
  expect(cleared.consoleMessages).toEqual([]);
  // Page-level state is preserved
  expect(cleared.url).toBe(loggedIn.url);
  expect(cleared.isAuthenticated).toBe(loggedIn.isAuthenticated);
});
```

---

## API Reference: BrowserStateBuilder

> **Tip:** The `BrowserStateBuilder` class provides a fluent API for constructing complex `BrowserState` objects via method chaining. For simpler, one-off state mutations, see the [browserHelpers](#api-reference-browser-state-helpers) above.

```typescript
import { BrowserStateBuilder, createBrowserState } from '@apex/core/test-fixtures';
```

### `createBrowserState(initialState?)`

Factory function that creates a new `BrowserStateBuilder` instance. This is the recommended entry point for the builder pattern.

```typescript
const state = createBrowserState()
  .withUrl('https://app.apex.dev')
  .withAuth(true)
  .build();
```

**Parameters:**
- `initialState`: `Partial<BrowserState>` *(optional)* — Initial state values merged with clean defaults

**Returns:** `BrowserStateBuilder` — A new builder instance

**Usage Example:**
```typescript
it('should create a custom authenticated state', () => {
  const state = createBrowserState({ isAuthenticated: true })
    .withUrl('https://app.apex.dev/dashboard')
    .withTitle('Dashboard')
    .withLocalStorage({ 'auth-token': 'jwt-token-123' })
    .build();

  expect(state.isAuthenticated).toBe(true);
  expect(state.url).toBe('https://app.apex.dev/dashboard');
  expect(state.localStorage['auth-token']).toBe('jwt-token-123');
});
```

---

### `new BrowserStateBuilder(initialState?)`

Constructs a new builder. Initializes internal state from `browserFixtures.cleanState()` merged with any provided overrides.

```typescript
const builder = new BrowserStateBuilder({ url: 'https://example.com' });
```

**Parameters:**
- `initialState`: `Partial<BrowserState>` *(optional)* — Overrides merged onto clean defaults

---

### `.withUrl(url)`

Sets the page URL.

```typescript
builder.withUrl('https://app.apex.dev/settings');
```

**Parameters:**
- `url`: `string` — The page URL

**Returns:** `this` — The builder instance (for chaining)

---

### `.withTitle(title)`

Sets the page title.

```typescript
builder.withTitle('Settings - APEX');
```

**Parameters:**
- `title`: `string` — The page title

**Returns:** `this` — The builder instance (for chaining)

---

### `.withLoading(isLoading)`

Sets the loading state.

```typescript
builder.withLoading(true);
```

**Parameters:**
- `isLoading`: `boolean` — Whether the page is loading

**Returns:** `this` — The builder instance (for chaining)

---

### `.withError(hasError)`

Sets the error state.

```typescript
builder.withError(true);
```

**Parameters:**
- `hasError`: `boolean` — Whether the page has an error

**Returns:** `this` — The builder instance (for chaining)

---

### `.withAuth(isAuthenticated)`

Sets the authentication status.

```typescript
builder.withAuth(true);
```

**Parameters:**
- `isAuthenticated`: `boolean` — Whether the user is authenticated

**Returns:** `this` — The builder instance (for chaining)

---

### `.withLocalStorage(data)`

Merges key-value pairs into localStorage. Can be called multiple times — entries accumulate and later calls overwrite existing keys.

```typescript
builder
  .withLocalStorage({ 'auth-token': 'abc123' })
  .withLocalStorage({ theme: 'dark' });
// localStorage => { 'auth-token': 'abc123', theme: 'dark' }
```

**Parameters:**
- `data`: `Record<string, string>` — Key-value pairs to merge into localStorage

**Returns:** `this` — The builder instance (for chaining)

---

### `.withSessionStorage(data)`

Merges key-value pairs into sessionStorage. Can be called multiple times — entries accumulate and later calls overwrite existing keys.

```typescript
builder
  .withSessionStorage({ 'session-id': 'sess_123' })
  .withSessionStorage({ 'nav-state': 'active' });
```

**Parameters:**
- `data`: `Record<string, string>` — Key-value pairs to merge into sessionStorage

**Returns:** `this` — The builder instance (for chaining)

---

### `.withConsoleMessages(messages)`

Appends console messages to the state. Auto-generates timestamps for entries that don't provide one. Can be called multiple times — messages accumulate.

```typescript
builder.withConsoleMessages([
  { type: 'info', message: 'App loaded' },
  { type: 'error', message: 'API timeout', timestamp: new Date('2024-01-15T10:00:00Z') },
]);
```

**Parameters:**
- `messages`: `Array<{ type: 'log' | 'warn' | 'error' | 'info'; message: string; timestamp?: Date }>` — Console messages to append

**Returns:** `this` — The builder instance (for chaining)

---

### `.withNetworkRequests(requests)`

Appends network requests to the state. Can be called multiple times — requests accumulate.

```typescript
builder.withNetworkRequests([
  { url: 'https://api.apex.dev/user', method: 'GET', status: 200 },
  { url: 'https://api.apex.dev/tasks', method: 'POST', status: 201, headers: { 'Content-Type': 'application/json' } },
]);
```

**Parameters:**
- `requests`: `Array<{ url: string; method: string; status?: number; headers?: Record<string, string> }>` — Network requests to append

**Returns:** `this` — The builder instance (for chaining)

---

### `.build()`

Builds and returns a **shallow copy** of the constructed `BrowserState`. Can be called multiple times on the same builder — each call returns an independent copy. Modifications to the builder after calling `build()` do not affect previously built states.

```typescript
const state = builder.build();
```

**Parameters:** None

**Returns:** `BrowserState` — A copy of the constructed browser state

---

### Full Chaining Example

```typescript
import { createBrowserState, browserFixtures } from '@apex/core/test-fixtures';

describe('Dashboard Integration Tests', () => {
  it('should render authenticated dashboard with API data', () => {
    const state = createBrowserState()
      .withUrl('https://app.apex.dev/dashboard')
      .withTitle('APEX Dashboard')
      .withAuth(true)
      .withLocalStorage({
        'auth-token': 'mock-jwt-token',
        'user-preferences': JSON.stringify({ theme: 'dark' }),
      })
      .withSessionStorage({
        'active-project': 'my-project',
      })
      .withConsoleMessages([
        { type: 'info', message: 'Dashboard loaded' },
        { type: 'log', message: 'Fetching project data...' },
      ])
      .withNetworkRequests([
        { url: 'https://api.apex.dev/user/profile', method: 'GET', status: 200 },
        { url: 'https://api.apex.dev/projects', method: 'GET', status: 200 },
      ])
      .build();

    expect(state.isAuthenticated).toBe(true);
    expect(state.url).toBe('https://app.apex.dev/dashboard');
    expect(state.localStorage['auth-token']).toBe('mock-jwt-token');
    expect(state.consoleMessages).toHaveLength(2);
    expect(state.networkRequests).toHaveLength(2);
  });

  it('should extend a fixture with the builder', () => {
    const loggedInFixture = browserFixtures.loggedInPage();
    const state = new BrowserStateBuilder(loggedInFixture)
      .withUrl('https://app.apex.dev/settings')
      .withTitle('Settings - APEX')
      .withLocalStorage({ 'debug-mode': 'true' })
      .build();

    // Inherits logged-in fixture data
    expect(state.isAuthenticated).toBe(true);
    expect(state.localStorage['auth-token']).toBe('mock-jwt-token');
    // With builder overrides
    expect(state.url).toBe('https://app.apex.dev/settings');
    expect(state.localStorage['debug-mode']).toBe('true');
  });

  it('should create multiple independent states from one builder', () => {
    const builder = createBrowserState()
      .withAuth(true)
      .withLocalStorage({ 'auth-token': 'shared-token' });

    const state1 = builder.withUrl('https://app.apex.dev/page1').build();
    const state2 = builder.withUrl('https://app.apex.dev/page2').build();

    expect(state1).not.toBe(state2);
    // Note: builder is stateful, so state1.url will be 'page2' after the second withUrl call
    // For truly independent states, create separate builders
  });
});
```

### Helpers vs Builder: When to Use Which

| Scenario | Recommended API | Reason |
|----------|----------------|--------|
| Modifying a single property on an existing state | `browserHelpers` | Simpler, one-off immutable transform |
| Simulating a sequence of user actions | `browserHelpers` (chained) | Each step returns new state, models temporal progression |
| Building a complex state from scratch | `BrowserStateBuilder` | Fluent chaining is more readable for many properties |
| Extending a fixture with additional data | `new BrowserStateBuilder(fixture)` | Merges fixture data with builder overrides |
| Quick factory creation in test setup | `createBrowserState()` | Concise entry point for builder pattern |

---

## API Reference: Mock Helper Functions

> **Tip:** The mock helper functions create comprehensive mocks for testing various APEX components. These functions integrate seamlessly with the browser state fixtures and permission testing utilities above. For complete documentation of all mock helpers, see the [Mock Helpers API Reference](./mock-helpers-api.md).

```typescript
import {
  createOrchestratorMock,
  createAgentSdkMock,
  createFileSystemMock,
  createNetworkMock,
  createTaskStoreMock,
  createEventEmitterMock,
  createPageMock,
  createConsoleMock,
  createMockEnvironment
} from '@apex/core/test-fixtures/mock-helpers';
```

### `createOrchestratorMock(overrides?)`

Creates a mock for the APEX Orchestrator with all core functionality.

```typescript
const mockOrchestrator = createOrchestratorMock({
  executeTask: vi.fn().mockResolvedValue({
    success: true,
    taskId: 'custom-task-id',
    result: 'Custom result'
  })
});
```

**Parameters:**
- `overrides`: `Record<string, any>` *(optional, default: `{}`)* — Object to override default mock implementations

**Returns:** Mock object with orchestrator methods:
- `executeTask()` — Returns `{ success: true, taskId: 'mock-task-id', result: 'Task completed successfully' }`
- `createTask()` — Returns `{ id: 'mock-task-id', status: 'pending', workflow: 'feature-development', createdAt: Date }`
- `getTask()`, `getTasks()` — Task retrieval methods
- `on()`, `off()`, `emit()` — Event handling methods
- `loadConfig()` — Returns `{ autonomyLevel: 'supervised', agents: {}, workflows: {} }`

**Usage Example:**
```typescript
it('should execute tasks through orchestrator', async () => {
  const mockOrchestrator = createOrchestratorMock();
  const result = await mockOrchestrator.executeTask('test-workflow', 'Test description');

  expect(result.success).toBe(true);
  expect(mockOrchestrator.executeTask).toHaveBeenCalledWith('test-workflow', 'Test description');
});
```

---

### `createAgentSdkMock(overrides?)`

Creates a mock for the Claude Agent SDK interface.

```typescript
const mockAgentSdk = createAgentSdkMock({
  query: vi.fn().mockResolvedValue({
    text: 'Custom agent response',
    usage: { input_tokens: 50, output_tokens: 75 }
  })
});
```

**Parameters:**
- `overrides`: `Record<string, any>` *(optional, default: `{}`)* — Object to override default mock implementations

**Returns:** Mock object with Agent SDK methods:
- `query()` — Returns `{ text: 'Mock agent response', usage: { input_tokens: 100, output_tokens: 150 } }`
- `createClient()` — Returns mock client with `messages.create` method

**Usage Example:**
```typescript
it('should query agent SDK for responses', async () => {
  const mockAgentSdk = createAgentSdkMock();
  const result = await mockAgentSdk.query('test prompt');

  expect(result.text).toBe('Mock agent response');
  expect(result.usage.input_tokens).toBe(100);
});
```

---

### `createFileSystemMock(fileData?)`

Creates a mock for file system operations with configurable file data.

```typescript
const mockFs = createFileSystemMock({
  '/path/to/file.txt': 'file content',
  '/config.json': '{"key": "value"}'
});
```

**Parameters:**
- `fileData`: `Record<string, string>` *(optional, default: `{}`)* — Map of file paths to their content

**Returns:** Mock object with file system methods:
- `readFile()` — Reads from `fileData` or throws ENOENT error
- `writeFile()`, `mkdir()`, `unlink()` — File manipulation methods
- `readdir()` — Returns directory contents based on `fileData`
- `stat()`, `access()` — File metadata and existence checks

**Usage Example:**
```typescript
it('should read and write files through file system mock', async () => {
  const mockFs = createFileSystemMock({
    '/test.txt': 'initial content'
  });

  const content = await mockFs.readFile('/test.txt');
  expect(content).toBe('initial content');

  await mockFs.writeFile('/test.txt', 'new content');
  expect(mockFs.writeFile).toHaveBeenCalledWith('/test.txt', 'new content');
});
```

---

### `createNetworkMock(responses?)`

Creates a mock for network requests with configurable responses.

```typescript
const mockNetwork = createNetworkMock({
  'https://api.example.com/data': { success: true, data: [] },
  'https://api.example.com/user': 'user response string'
});
```

**Parameters:**
- `responses`: `Record<string, any>` *(optional, default: `{}`)* — Map of URLs to their response data

**Returns:** Mock object with network methods:
- `fetch()` — Returns configured responses or throws error for unmocked URLs
- `addResponse()` — Adds a response for a specific URL
- `simulateNetworkError()` — Configures a URL to throw network errors

**Usage Example:**
```typescript
it('should handle network requests with mock responses', async () => {
  const mockNetwork = createNetworkMock({
    'https://api.example.com/test': { result: 'success' }
  });

  const response = await mockNetwork.fetch('https://api.example.com/test');
  const data = await response.json();

  expect(data.result).toBe('success');

  // Add response dynamically
  mockNetwork.addResponse('https://api.example.com/new', { id: 123 });
});
```

---

### `createTaskStoreMock(initialTasks?)`

Creates a mock task store with in-memory task management.

```typescript
const mockTaskStore = createTaskStoreMock([
  { id: 'existing-task', status: 'completed', workflow: 'test' }
]);
```

**Parameters:**
- `initialTasks`: `any[]` *(optional, default: `[]`)* — Array of initial tasks to populate the store

**Returns:** Mock object with task store methods:
- `create()` — Creates a new task with auto-generated ID and timestamps
- `get()`, `update()`, `delete()` — Task CRUD operations
- `list()` — Returns all tasks
- `_getTasks()`, `_clearTasks()`, `_addTask()` — Helper methods for testing

**Usage Example:**
```typescript
it('should manage tasks through task store mock', async () => {
  const mockTaskStore = createTaskStoreMock();

  const newTask = await mockTaskStore.create({
    workflow: 'test-workflow',
    description: 'Test task'
  });

  expect(newTask.id).toBeDefined();
  expect(newTask.status).toBe('pending');

  const retrieved = await mockTaskStore.get(newTask.id);
  expect(retrieved.workflow).toBe('test-workflow');
});
```

---

### `createPageMock(overrides?)`

Creates a mock for browser/Playwright page objects.

```typescript
const mockPage = createPageMock({
  title: vi.fn().mockResolvedValue('Custom Page Title'),
  url: vi.fn().mockReturnValue('https://custom.example.com')
});
```

**Parameters:**
- `overrides`: `Record<string, any>` *(optional, default: `{}`)* — Object to override default mock implementations

**Returns:** Mock object with page methods:
- `goto()`, `url()`, `title()`, `content()` — Navigation and content methods
- `click()`, `type()`, `fill()`, `selectOption()` — Element interaction methods
- `waitForSelector()`, `waitForTimeout()`, `waitForLoadState()` — Waiting methods
- `screenshot()`, `evaluate()` — Capture and execution methods
- `locator()` — Returns mock locator object with interaction methods

**Usage Example:**
```typescript
it('should interact with page elements through page mock', async () => {
  const mockPage = createPageMock();

  await mockPage.goto('https://example.com');
  await mockPage.click('#button');
  const title = await mockPage.title();

  expect(title).toBe('Test Page');
  expect(mockPage.goto).toHaveBeenCalledWith('https://example.com');
  expect(mockPage.click).toHaveBeenCalledWith('#button');
});
```

---

### `createConsoleMock()`

Creates a mock console with message tracking.

```typescript
const mockConsole = createConsoleMock();

mockConsole.log('Test message');
mockConsole.error('Error message');

const messages = mockConsole._getMessages();
const errors = mockConsole._getMessagesByLevel('error');
```

**Parameters:** None

**Returns:** Mock object with console methods:
- `log()`, `error()`, `warn()`, `info()` — Logging methods that store messages
- `_getMessages()` — Returns all logged messages with timestamps
- `_clearMessages()` — Clears all logged messages
- `_getMessagesByLevel()` — Returns messages filtered by level

**Usage Example:**
```typescript
it('should track console messages through console mock', () => {
  const mockConsole = createConsoleMock();

  mockConsole.log('Info message');
  mockConsole.error('Error occurred');

  const messages = mockConsole._getMessages();
  expect(messages).toHaveLength(2);

  const errors = mockConsole._getMessagesByLevel('error');
  expect(errors).toHaveLength(1);
  expect(errors[0].message).toBe('Error occurred');
});
```

---

### `createMockEnvironment(options?)`

Creates a complete mock environment with multiple mocks configured together.

```typescript
const env = createMockEnvironment({
  includeOrchestrator: true,
  includeFileSystem: true,
  fileData: {
    '/.apex/config.yaml': 'autonomy_level: supervised',
    '/src/main.ts': 'console.log("Hello");'
  },
  networkResponses: {
    'https://api.anthropic.com/v1/messages': {
      content: [{ text: 'AI response' }],
      usage: { input_tokens: 10, output_tokens: 20 }
    }
  }
});
```

**Parameters:**
- `options`: Configuration object *(optional, default: `{}`)* with properties:
  - `includeOrchestrator`: `boolean` *(default: `true`)* — Include orchestrator mock
  - `includeFileSystem`: `boolean` *(default: `true`)* — Include file system mock
  - `includeNetwork`: `boolean` *(default: `true`)* — Include network mock
  - `includeTaskStore`: `boolean` *(default: `true`)* — Include task store mock
  - `fileData`: `Record<string, string>` *(default: `{}`)* — File data for file system mock
  - `networkResponses`: `Record<string, any>` *(default: `{}`)* — Network responses for network mock
  - `initialTasks`: `any[]` *(default: `[]`)* — Initial tasks for task store mock

**Returns:** Environment object containing selected mocks:
- `orchestrator?` — Orchestrator mock (if included)
- `fs?` — File system mock (if included)
- `network?` — Network mock (if included)
- `taskStore?` — Task store mock (if included)

**Usage Example:**
```typescript
it('should provide complete mock environment for integration tests', async () => {
  const env = createMockEnvironment({
    fileData: { '/config.yaml': 'key: value' },
    networkResponses: { 'https://api.test.com': { success: true } },
    initialTasks: [{ id: 'task-1', status: 'pending' }]
  });

  // Use all mocks together
  const config = await env.fs.readFile('/config.yaml');
  const task = await env.taskStore.get('task-1');
  const result = await env.orchestrator.executeTask('workflow', 'description');

  expect(config).toBe('key: value');
  expect(task.status).toBe('pending');
  expect(result.success).toBe(true);
});
```

---

## Related Documentation

- [Mock Helpers API Reference](./mock-helpers-api.md) - Complete API reference for mock helper functions including createOrchestratorMock, createAgentSdkMock, createFileSystemMock, and other test utilities
- [Browser State Fixtures API](./browser-state-fixtures-api.md) - Detailed API documentation for browserFixtures, browserHelpers, and BrowserStateBuilder
- [Browser Automation Guide](./browser-automation.md) - Browser operations, configuration, and usage patterns that these test utilities validate
- [System APIs Reference](./system-apis-reference.md) - Type definitions for `ToolPermissionResult`, `PermissionManager`, `BrowserTool`, and other interfaces used in tests
- [Test Utilities](./test-utilities.md) - Cross-platform test utilities (platform detection, conditional skipping, platform mocking) shared across all test suites
- [API Reference](./api-reference.md) - REST API and WebSocket endpoints for programmatic permission and browser management