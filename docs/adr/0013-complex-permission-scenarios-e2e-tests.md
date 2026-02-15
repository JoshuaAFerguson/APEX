# ADR-0013: E2E Tests for Complex Permission Level Scenarios

## Status
Accepted

## Context

The APEX permission system provides three key permission presets (`autonomous`, `review-all`, `read-only`) along with scoped permissions, permission inheritance, and permission cascade mechanisms. We need comprehensive E2E tests to validate these complex scenarios work correctly across the tri-system integration (Tool System, Permission System, Browser System).

### Current Permission System Architecture

1. **Permission Presets** (defined in `packages/core/src/types.ts`):
   - `autonomous`: All tools allowed without confirmation (full autonomy)
   - `review-all`: All tools require user confirmation before execution
   - `read-only`: Only read-only tools allowed (Read, Grep, Glob, WebFetch, WebSearch)

2. **Permission Levels**:
   - `allow-always`: Permanently allow a tool/scope combination
   - `allow-once`: Allow for a single invocation only (consumed after use)
   - `deny`: Deny the tool/scope combination

3. **Scoped Permissions**: Permissions can be narrowed to specific scopes (paths, domains, operations)

4. **Permission Inheritance**: General tool permissions can be inherited by specific operations

5. **Permission Cascade**: Multi-layer permission checking (session cache → persistent store → preset defaults)

### Existing Test Infrastructure

The tri-system integration test infrastructure (`tests/e2e/tri-system-integration/test-utils.ts`) provides:
- `createTriSystemTestEnvironment()` - Creates complete test environment
- `createPermissionDeniedScenario()` - Creates permission-denied scenarios
- `createFullAutonomyScenario()` - Creates autonomous mode scenarios
- `createSupervisedModeScenario()` - Creates supervised mode scenarios
- Assertion helpers for permission enforcement validation

## Decision

Create a new E2E test file `tests/e2e/tri-system-integration/complex-permission-scenarios.e2e.test.ts` that comprehensively tests:

### 1. Permission Preset Behavior (autonomous, supervised, readOnly)

**Test Cases:**
- Autonomous preset allows all tools without confirmation
- Review-all preset requires confirmation for all tools
- Read-only preset allows only read operations and denies writes
- Preset switching clears existing permissions and applies new rules
- Custom tools follow preset default behavior

### 2. Scoped Permissions Across Multiple Tools

**Test Cases:**
- Path-scoped permissions (e.g., `/restricted/**` → deny)
- Domain-scoped permissions for browser operations
- Operation-scoped permissions (e.g., `navigate`, `evaluate`)
- Overlapping scope patterns with proper precedence
- Wildcard scope matching

### 3. Permission Inheritance

**Test Cases:**
- Child operations inherit from parent tool permissions
- Specific operation permissions override inherited permissions
- Scoped permissions inherit within scope hierarchy
- Browser operation inheritance (navigate → click → screenshot)
- File operation inheritance (Read/Write/Edit path patterns)

### 4. Permission Cascade Across Systems

**Test Cases:**
- Session cache checked before persistent store
- Allow-once consumed in session cache correctly
- Persistent allow-always survives session reset
- Preset defaults apply when no specific permission exists
- Multi-system event propagation on permission decisions

## Technical Design

### File Structure

```typescript
/**
 * E2E tests for complex permission level scenarios
 *
 * This test suite covers:
 * 1. Permission presets (autonomous, review-all, read-only)
 * 2. Scoped permissions across multiple tools
 * 3. Permission inheritance
 * 4. Permission cascade across systems
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTriSystemTestEnvironment,
  createPermissionDeniedScenario,
  createFullAutonomyScenario,
  createSupervisedModeScenario,
  assertPermissionEnforced,
  assertTriSystemEventSequence,
  assertTriSystemReady,
  assertCrossSystemEventPropagation,
  type TriSystemTestEnvironment,
  type SystemEvent
} from './test-utils';
```

### Test Suite Structure

```
describe('Complex Permission Scenarios E2E')
├── describe('Permission Presets')
│   ├── describe('Autonomous Preset')
│   │   ├── it('allows all standard tools without confirmation')
│   │   ├── it('allows write operations without restriction')
│   │   ├── it('allows browser operations without confirmation')
│   │   └── it('allows bash execution without restriction')
│   │
│   ├── describe('Review-All Preset')
│   │   ├── it('requires confirmation for read operations')
│   │   ├── it('requires confirmation for write operations')
│   │   ├── it('requires confirmation for browser operations')
│   │   ├── it('allows operation after single confirmation (allow-once)')
│   │   └── it('requires re-confirmation after allow-once consumed')
│   │
│   └── describe('Read-Only Preset')
│       ├── it('allows Read, Grep, Glob without confirmation')
│       ├── it('allows WebFetch, WebSearch without confirmation')
│       ├── it('denies Write, Edit, MultiEdit operations')
│       ├── it('denies Bash execution')
│       └── it('denies browser write operations')
│
├── describe('Scoped Permissions')
│   ├── describe('Path-Scoped Permissions')
│   │   ├── it('denies write to restricted paths while allowing others')
│   │   ├── it('handles wildcard path patterns correctly')
│   │   ├── it('applies nested path scope precedence')
│   │   └── it('respects scope specificity over general permissions')
│   │
│   ├── describe('Domain-Scoped Permissions')
│   │   ├── it('allows navigation to permitted domains only')
│   │   ├── it('blocks browser operations on blocked domains')
│   │   ├── it('handles subdomain inheritance correctly')
│   │   └── it('applies domain-specific permission overrides')
│   │
│   └── describe('Operation-Scoped Permissions')
│       ├── it('allows navigate but denies evaluate for browser')
│       ├── it('handles mixed operation permissions in workflow')
│       └── it('applies operation scope with domain combination')
│
├── describe('Permission Inheritance')
│   ├── describe('Tool-to-Operation Inheritance')
│   │   ├── it('browser allow-always inherits to all browser operations')
│   │   ├── it('specific operation deny overrides tool-level allow')
│   │   └── it('handles partial inheritance with mixed permissions')
│   │
│   ├── describe('Scope Hierarchy Inheritance')
│   │   ├── it('parent path permission applies to child paths')
│   │   ├── it('child path override supersedes parent permission')
│   │   └── it('handles deep path hierarchy correctly')
│   │
│   └── describe('Cross-Tool Inheritance')
│       ├── it('file operations inherit from common path permissions')
│       └── it('browser and WebFetch share domain permissions')
│
└── describe('Permission Cascade')
    ├── describe('Cache-First Resolution')
    │   ├── it('session cache is checked before persistent store')
    │   ├── it('allow-once in cache is consumed correctly')
    │   └── it('cache miss falls through to persistent store')
    │
    ├── describe('Preset Fallback Behavior')
    │   ├── it('unspecified tools use preset default behavior')
    │   ├── it('preset defaults apply after cache and store miss')
    │   └── it('preset change updates all unspecified permissions')
    │
    └── describe('Cross-System Cascade')
        ├── it('permission decision cascades to tool execution events')
        ├── it('browser permission cascade includes domain validation')
        └── it('cascade emits correct events at each layer')
```

### Test Environment Configuration

Each test category will use appropriate environment configurations:

```typescript
// Autonomous preset tests
const autonomousEnv = await createTriSystemTestEnvironment({
  permissionConfig: {
    preset: 'allowAll', // Maps to autonomous behavior
    defaultLevel: 'allow-always'
  }
});

// Review-all preset tests
const supervisedEnv = await createTriSystemTestEnvironment({
  permissionConfig: {
    preset: 'selective',
    defaultLevel: 'allow-once'
  }
});

// Read-only preset tests
const readOnlyEnv = await createTriSystemTestEnvironment({
  permissionConfig: {
    preset: 'denyAll',
    // Will grant specific read-only tools
  }
});

// Scoped permission tests
const scopedEnv = await createTriSystemTestEnvironment({
  permissionConfig: {
    preset: 'selective',
    defaultLevel: 'allow-always',
    blockedDomains: ['blocked.com']
  }
});
```

### Key Test Patterns

1. **Preset Verification Pattern**:
```typescript
it('autonomous preset allows all tools', async () => {
  const env = await createFullAutonomyScenario();
  try {
    const tools = ['Read', 'Write', 'Edit', 'Bash', 'Browser'];
    for (const tool of tools) {
      const result = await env.toolSystem.executor.executeWithPermissionCheck(
        tool, 'execute', { /* params */ }
      );
      assertPermissionEnforced(result, 'granted');
    }
  } finally {
    await env.cleanup();
  }
});
```

2. **Scoped Permission Pattern**:
```typescript
it('path-scoped denial overrides general allow', async () => {
  // Grant general write permission
  await env.permissionSystem.store.grantPermission('Write', 'allow-always');
  // Deny specific path
  await env.permissionSystem.store.denyPermission('Write', '/restricted/**');

  // General write should succeed
  const allowed = await env.toolSystem.executor.executeWithPermissionCheck(
    'Write', 'write', { filePath: '/tmp/safe.txt', content: 'ok' }
  );
  assertPermissionEnforced(allowed, 'granted');

  // Restricted path should fail
  const denied = await env.toolSystem.executor.executeWithPermissionCheck(
    'Write', 'write', { filePath: '/restricted/secret.txt', content: 'no' }
  );
  assertPermissionEnforced(denied, 'denied');
});
```

3. **Inheritance Verification Pattern**:
```typescript
it('browser operations inherit from parent permission', async () => {
  await env.permissionSystem.store.grantPermission('Browser', 'allow-always');

  // All browser operations should inherit
  const ops = ['navigate', 'click', 'screenshot', 'getText'];
  for (const op of ops) {
    const result = await env.toolSystem.executor.executeWithPermissionCheck(
      'Browser', op, { operation: op, params: { /* ... */ } }
    );
    assertPermissionEnforced(result, 'granted');
  }
});
```

4. **Cascade Verification Pattern**:
```typescript
it('permission cascade checks session cache first', async () => {
  // Grant allow-once (stored in session cache)
  await env.permissionSystem.store.grantPermission('Read', 'allow-once');

  // First use consumes session cache permission
  const first = await env.toolSystem.executor.executeWithPermissionCheck(
    'Read', 'read', { filePath: '/tmp/test.txt' }
  );
  assertPermissionEnforced(first, 'granted');

  // Second use should check persistent store (none exists)
  const second = await env.toolSystem.executor.executeWithPermissionCheck(
    'Read', 'read', { filePath: '/tmp/test2.txt' }
  );
  // Falls back to preset default (deny in this scenario)
  assertPermissionEnforced(second, 'denied');
});
```

### Event Verification

Tests should verify event sequences using the existing assertion helpers:

```typescript
assertTriSystemEventSequence(events, [
  { type: 'permission:requested', system: 'permission' },
  { type: 'permission:granted', system: 'permission' },
  { type: 'tool:execution:start', system: 'tool' },
  { type: 'tool:execution:complete', system: 'tool' }
]);

assertCrossSystemEventPropagation(env, 'permission', 'tool', 'tool:execution:start');
```

## Consequences

### Positive
- Comprehensive coverage of permission system edge cases
- Validates preset behavior matches documented specifications
- Ensures scoped permissions work correctly in complex scenarios
- Tests permission cascade for correct layer resolution order
- Provides regression protection for permission system changes

### Negative
- Additional test maintenance burden
- Tests may be slower due to tri-system integration setup
- Mock complexity for permission cascade scenarios

### Mitigations
- Reuse existing test utilities and mock factories
- Group tests by setup requirements to minimize environment creation
- Use descriptive test names for easier debugging

## Implementation Notes

1. **Test File Location**: `tests/e2e/tri-system-integration/complex-permission-scenarios.e2e.test.ts`

2. **Dependencies**: Uses existing test utilities from `test-utils.ts`

3. **Test Data**: Will use mock data consistent with existing E2E tests

4. **Cleanup**: Each test must cleanup to prevent state leakage

5. **Timeouts**: Complex scenarios may need extended timeouts

## References

- `packages/core/src/types.ts` - Permission type definitions
- `packages/orchestrator/src/permission-preset-manager.ts` - Preset manager implementation
- `packages/orchestrator/src/permission-manager.ts` - Permission manager implementation
- `packages/orchestrator/src/permission-store.ts` - Persistent permission storage
- `tests/e2e/tri-system-integration/test-utils.ts` - Test utilities
- `tests/e2e/tri-system-integration/browser-permission-basic.e2e.test.ts` - Example E2E tests
