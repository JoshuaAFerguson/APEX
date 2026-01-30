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