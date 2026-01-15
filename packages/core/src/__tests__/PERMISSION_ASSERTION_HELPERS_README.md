# Permission Assertion Helpers

This document describes the custom assertion helpers for validating permission states in tests. These helpers integrate with Vitest and provide clear error messages for permission-related test failures.

## Overview

The permission assertion helpers provide both function-based and custom matcher-based approaches for testing permission states:

- `expectPermissionGranted()` - Assert that a permission is granted
- `expectPermissionDenied()` - Assert that a permission is denied
- `expectPermissionPending()` - Assert that a permission requires confirmation
- `assertPermissionContext()` - Assert permission context state
- `assertPermissionHistory()` - Assert permission history state

## Setup

### Automatic Setup

Import the test setup file to automatically register custom matchers:

```typescript
import { describe, it, expect } from 'vitest';
import '@apexcli/core/test-setup'; // Auto-registers custom matchers

describe('Permission Tests', () => {
  it('should grant read permissions', async () => {
    const result = await permissionManager.checkPermission('Read');
    expect(result).toBePermissionGranted('allow-always');
  });
});
```

### Manual Setup

Register custom matchers manually if needed:

```typescript
import { expect } from 'vitest';
import { setupPermissionMatchers } from '@apexcli/core/test-utils';

setupPermissionMatchers(expect);
```

## Custom Matchers

### `toBePermissionGranted(expectedLevel?)`

Assert that a permission result is granted, optionally with a specific level.

```typescript
const result = await permissionManager.checkPermission('Read');

// Basic granted assertion
expect(result).toBePermissionGranted();

// With specific level
expect(result).toBePermissionGranted('allow-always');

// Negation
expect(result).not.toBePermissionGranted('deny');
```

**Error Messages:**
- "Expected permission to be granted, but it was denied: Reason: Tool is blocked"
- "Expected permission to be granted with level allow-always, but got: allow-once"

### `toBePermissionDenied(expectedReason?)`

Assert that a permission result is denied, optionally checking the denial reason.

```typescript
const result = await permissionManager.checkPermission('Bash');

// Basic denied assertion
expect(result).toBePermissionDenied();

// With reason check (partial match, case-insensitive)
expect(result).toBePermissionDenied('dangerous operation');

// Negation
expect(result).not.toBePermissionDenied();
```

**Error Messages:**
- "Expected permission to be denied, but it was granted: Level: allow-always"
- "Expected permission to be denied with reason containing 'security', but got: 'Tool not found'"

### `toBePermissionPending()`

Assert that a permission result requires user confirmation.

```typescript
const result = await permissionManager.checkPermission('Write');

// Assert requires confirmation
expect(result).toBePermissionPending();

// Negation
expect(result).not.toBePermissionPending();
```

**Error Messages:**
- "Expected permission to be pending (require confirmation), but it was granted automatically"
- "Expected permission to be pending (require confirmation), but it was denied outright"

### `toHavePermissionContext(expectedState)`

Assert that a permission context has expected permissions and state.

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
  lacksPermissions: ['Bash'],              // Must NOT have these tools
  preset: 'review-all',                    // Must have this preset
  agent: 'developer',                      // Must have this agent
  permissionCount: 2                       // Must have exact count
});
```

**Error Messages:**
- "Missing expected permission for tool: Bash"
- "Unexpected permission found for tool: Bash"
- "Expected preset: read-only, got: autonomous"

### `toHavePermissionHistory(expectedCriteria)`

Assert that permission history matches expected criteria.

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

**Error Messages:**
- "Expected 5 total entries, got: 2"
- "Expected entry for tool: Bash"
- "Expected recent entry for tool: Read within 5 minutes (granted)"

## Function-Based Assertions

For cases where custom matchers aren't suitable, use function-based assertions:

```typescript
import {
  expectPermissionGranted,
  expectPermissionDenied,
  expectPermissionPending,
  assertPermissionContext,
  assertPermissionHistory
} from '@apexcli/core/test-utils';

describe('Permission Tests', () => {
  it('should validate permissions', async () => {
    const result = await permissionManager.checkPermission('Read');

    // Function-based assertions
    expectPermissionGranted(result, 'allow-always');
    expectPermissionDenied(deniedResult, 'security policy');
    expectPermissionPending(pendingResult);

    // Context and history assertions
    assertPermissionContext(context, { hasPermissions: ['Read'] });
    assertPermissionHistory(history, { totalEntries: 5 });
  });
});
```

## Integration Examples

### Testing Permission Manager

```typescript
import { describe, it, expect } from 'vitest';
import '@apexcli/core/test-setup';
import { createMockPermissionContext } from '@apexcli/core/test-utils';

describe('PermissionManager', () => {
  it('should grant read permissions in autonomous mode', async () => {
    const manager = new PermissionManager({
      preset: 'autonomous',
      customRules: {
        Read: { behavior: 'allow', config: { requireConfirmation: false } }
      }
    });

    const result = await manager.checkPermission('Read', '/project/file.ts');
    expect(result).toBePermissionGranted('allow-always');
  });

  it('should require confirmation for write operations', async () => {
    const manager = new PermissionManager({ preset: 'review-all' });

    const result = await manager.checkPermission('Write', '/project/file.ts');
    expect(result).toBePermissionPending();
  });

  it('should block dangerous commands', async () => {
    const manager = new PermissionManager({ preset: 'read-only' });

    const result = await manager.checkPermission('Bash', 'rm -rf /');
    expect(result).toBePermissionDenied('dangerous operation');
  });
});
```

### Testing Permission Context

```typescript
describe('Permission Context', () => {
  it('should validate agent permissions', () => {
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
      permissionCount: 2
    });

    expect(context.preset).toBe('review-all');
  });
});
```

### Testing Permission History

```typescript
describe('Permission History', () => {
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
      }
    });
  });

  it('should maintain chronological order', async () => {
    const history = await permissionStore.getHistory();

    expect(history).toHavePermissionHistory({
      entriesInOrder: ['Read', 'Write', 'Bash', 'Read']
    });
  });
});
```

### Error Handling Tests

```typescript
describe('Permission Error Handling', () => {
  it('should provide clear error messages', () => {
    const deniedResult = createMockToolPermissionResult({
      allowed: false,
      denialReason: 'Tool requires elevated privileges'
    });

    // This will show a clear error message
    expect(() => {
      expect(deniedResult).toBePermissionGranted();
    }).toThrow('Expected permission to be granted, but it was denied');
  });

  it('should validate complex permission contexts', () => {
    const context = { permissions: [], preset: 'autonomous' };

    expect(() => {
      expect(context).toHavePermissionContext({
        hasPermissions: ['Read', 'Write'],
        preset: 'read-only',
        permissionCount: 5
      });
    }).toThrow(/Missing expected permission.*Expected preset.*Expected.*permissions/s);
  });
});
```

## Best Practices

### 1. Use Appropriate Assertion Level

Choose the right level of specificity for your tests:

```typescript
// Too specific - brittle
expect(result).toBePermissionGranted('allow-once');

// Just right - tests the important behavior
expect(result).toBePermissionGranted();
expect(result.requiresConfirmation).toBe(true);

// Too vague - doesn't catch issues
expect(result.allowed).toBeTruthy();
```

### 2. Test Both Positive and Negative Cases

```typescript
describe('File Access Permissions', () => {
  it('should allow access to project files', async () => {
    const result = await manager.checkPermission('Read', '/project/src/file.ts');
    expect(result).toBePermissionGranted();
  });

  it('should deny access to system files', async () => {
    const result = await manager.checkPermission('Read', '/etc/passwd');
    expect(result).toBePermissionDenied('system files are blocked');
  });
});
```

### 3. Use Clear Test Descriptions

```typescript
// Good - describes the expected behavior
it('should require confirmation for write operations in review-all mode', () => {
  // test code
});

// Bad - describes the implementation
it('should return requiresConfirmation=true for write tools', () => {
  // test code
});
```

### 4. Group Related Assertions

```typescript
describe('Permission Context Validation', () => {
  const context = createTestContext();

  it('should have correct permission structure', () => {
    expect(context).toHavePermissionContext({
      hasPermissions: ['Read', 'Write'],
      preset: 'review-all',
      permissionCount: 2
    });
  });

  it('should not have dangerous permissions', () => {
    expect(context).toHavePermissionContext({
      lacksPermissions: ['Bash', 'WebFetch']
    });
  });
});
```

## Troubleshooting

### Common Issues

1. **Custom matchers not working**: Ensure you import the test setup file or call `setupPermissionMatchers(expect)`

2. **Type errors**: Make sure the module declaration for Vitest is properly imported

3. **Assertion failures**: Check the error messages - they provide detailed information about what doesn't match

### Debug Tips

```typescript
// Log the actual result for debugging
console.log('Permission result:', JSON.stringify(result, null, 2));
expect(result).toBePermissionGranted();

// Use function-based assertions for more control
try {
  expectPermissionGranted(result, 'allow-always');
} catch (error) {
  console.log('Assertion failed:', error.message);
  throw error;
}
```