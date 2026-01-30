# ADR-049: Permission Revocation Cleanup Tests Architecture

**Status**: Accepted
**Date**: 2025-07-15
**Author**: Architect Agent

## Context

APEX's permission system consists of multiple layers:
1. **PermissionStore** (SQLite persistence) - `permission-store.ts`
2. **PermissionManager** (session cache + store wrapper) - `permission-manager.ts`
3. **ApexOrchestrator** (event emission, task lifecycle) - `index.ts`
4. **ApprovalGateController** (approval workflow with dispose pattern) - `approval-gate-controller.ts`

When a permission is revoked (via `PermissionManager.revokePermission()`), several cleanup operations must occur:
- Task state must reflect the revocation (status update, log entry)
- SQLite records must be cleaned up (PermissionStore)
- Session caches must be cleared (PermissionManager)
- Event listeners attached for the revoked permission context must be disposed
- No resource leaks (open DB connections, dangling listeners, orphan timers)

Currently, ADR-048 defines test utilities for **mid-stream** revocation simulation. This ADR defines the **test suite architecture** for verifying that cleanup after revocation is correct and complete.

## Decision

Create a comprehensive test file at:
```
packages/orchestrator/src/__tests__/permission-revocation-cleanup.test.ts
```

The test suite will be organized into 4 describe blocks, each mapping to one acceptance criterion.

## Technical Design

### 1. Test File Structure

```typescript
// permission-revocation-cleanup.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Permission Revocation Cleanup', () => {

  // Shared setup: temp dir, PermissionStore, PermissionManager, TaskStore
  let testDir: string;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let taskStore: TaskStore;

  beforeEach(async () => {
    testDir = join(tmpdir(), `apex-revocation-cleanup-${Date.now()}-${Math.random()...}`);
    mkdirSync(testDir, { recursive: true });
    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();
    permissionManager = new PermissionManager(permissionStore);
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();
  });

  afterEach(() => {
    permissionStore.close();
    taskStore.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('1. Task State Updates on Permission Revocation', () => { ... });
  describe('2. SQLite TaskStore Cleanup', () => { ... });
  describe('3. Event Emitter Disposal', () => { ... });
  describe('4. No Resource Leaks After Revocation', () => { ... });
});
```

### 2. Test Area Details

#### 2.1 Task State Updates on Permission Revocation

**Purpose**: Verify that when a permission is revoked, any associated in-progress task is properly updated.

**Test Cases**:

| # | Test | Verifies |
|---|------|----------|
| 1 | `revokePermission()` removes allow-always from persistent store | `PermissionManager.revokePermission()` clears DB |
| 2 | `revokePermission()` removes allow-once from session cache | Session cache cleanup |
| 3 | `revokePermission()` returns false when no permission existed | Idempotent behavior |
| 4 | After revocation, `checkPermission()` returns null | Permission is truly gone |
| 5 | After revocation, `hasPermission()` returns false | Boolean API consistency |
| 6 | Revoking a scoped permission does not affect unscoped permission for same tool | Scope isolation |
| 7 | Revoking does not affect permissions for other tools | Tool isolation |

**Key Assertions**:
```typescript
// Grant then revoke
await permissionManager.grantPermission('Write', '/src', 'allow-always');
const revoked = await permissionManager.revokePermission('Write', '/src');
expect(revoked).toBe(true);

// Verify state
const level = await permissionManager.checkPermission('Write', '/src');
expect(level).toBeNull();

// Verify DB is clean
const dbPermission = await permissionStore.getPermission({ tool: 'Write', scope: '/src' });
expect(dbPermission).toBeNull();
```

#### 2.2 SQLite TaskStore Cleanup

**Purpose**: Verify that permission revocation properly clears all related SQLite records.

**Test Cases**:

| # | Test | Verifies |
|---|------|----------|
| 1 | `clearPermission()` removes the exact row from permissions table | Single-row deletion |
| 2 | `clearPermissionsForTool()` removes all permissions for a tool | Bulk tool cleanup |
| 3 | `clearPermissions()` removes all permission rows | Full wipe |
| 4 | `clearExpired()` only removes expired permissions | Selective cleanup |
| 5 | Extended permission fields (config, tags, grantReason) are fully removed | No orphan data |
| 6 | Cleanup is transactional (no partial state on error) | Atomicity |
| 7 | After cleanup, `listPermissions()` returns empty for cleared tool | List consistency |
| 8 | Index integrity after bulk deletions | Performance correctness |

**Key Assertions**:
```typescript
// Save multiple permissions for same tool
await permissionStore.saveExtendedPermission({
  tool: 'Bash', scope: '/bin', level: 'allow-always',
  createdAt: new Date(), tags: ['admin'], grantReason: 'test'
});
await permissionStore.saveExtendedPermission({
  tool: 'Bash', scope: '/usr', level: 'allow-always',
  createdAt: new Date(), tags: ['admin'], grantReason: 'test'
});

// Clear all for tool
const cleared = await permissionStore.clearPermissionsForTool('Bash');
expect(cleared).toBe(2);

// Verify complete removal
const remaining = await permissionStore.listPermissions({ tool: 'Bash' });
expect(remaining).toHaveLength(0);
```

#### 2.3 Event Emitter Disposal

**Purpose**: Verify that event listeners registered for permission-related events are properly removed after revocation.

**Design Approach**: Use the `EventEmitter` from `eventemitter3` (same as `ApexOrchestrator`) to create a test orchestrator-like emitter that registers permission event handlers, then verify they are removed.

**Test Cases**:

| # | Test | Verifies |
|---|------|----------|
| 1 | Permission event listeners can be added and removed | Basic add/remove |
| 2 | `removeAllListeners('permission:granted')` clears all handlers for that event | Targeted cleanup |
| 3 | `removeAllListeners()` clears all permission-related listeners | Full cleanup |
| 4 | After disposal, emitting events does not trigger old handlers | No ghost handlers |
| 5 | Dispose pattern (like ApprovalGateController) removes listeners + clears timers | Dispose lifecycle |
| 6 | Listeners on one event type don't affect other event types | Event isolation |
| 7 | Session cache `resetSession()` clears all in-memory state | Memory cleanup |

**Key Assertions**:
```typescript
const emitter = new EventEmitter<OrchestratorEvents>();
const handler = vi.fn();

emitter.on('permission:granted', handler);
expect(emitter.listenerCount('permission:granted')).toBe(1);

// Simulate cleanup after revocation
emitter.removeAllListeners('permission:granted');
expect(emitter.listenerCount('permission:granted')).toBe(0);

// Verify handler is not called
emitter.emit('permission:granted', mockEvent);
expect(handler).not.toHaveBeenCalled();
```

#### 2.4 No Resource Leaks After Revocation

**Purpose**: Verify that after permission revocation and cleanup, no resources are leaked.

**Test Cases**:

| # | Test | Verifies |
|---|------|----------|
| 1 | PermissionStore.close() releases SQLite connection | DB connection cleanup |
| 2 | Session cache is empty after `resetSession()` | Memory leak check |
| 3 | Directory access cache is cleared after `resetSession()` | Cache cleanup |
| 4 | Tool config cache is cleared after `resetSession()` | Config cache cleanup |
| 5 | Multiple grant/revoke cycles don't accumulate resources | Cyclic stability |
| 6 | After store close, operations throw/fail gracefully | Post-close safety |
| 7 | Temp directory cleanup in afterEach doesn't leave orphan files | Test isolation |

**Key Assertions**:
```typescript
// Multiple grant/revoke cycles
for (let i = 0; i < 100; i++) {
  await permissionManager.grantPermission('Write', `/path/${i}`, 'allow-once');
  await permissionManager.revokePermission('Write', `/path/${i}`);
}

// Reset session to clear caches
permissionManager.resetSession();

// Verify no residual state - all checks return null
for (let i = 0; i < 100; i++) {
  const level = await permissionManager.checkPermission('Write', `/path/${i}`);
  expect(level).toBeNull();
}
```

### 3. Component Interaction Diagram

```
┌───────────────────────────────────────────────────────────────┐
│                    Test Suite Scope                            │
│                                                               │
│  ┌─────────────────┐     ┌──────────────────────┐            │
│  │ PermissionManager│────>│  PermissionStore     │            │
│  │                  │     │  (SQLite)            │            │
│  │ - sessionCache   │     │                      │            │
│  │ - dirAccess cache│     │ - permissions table  │            │
│  │ - toolConfig     │     │ - CRUD operations    │            │
│  │                  │     │ - clearPermission()  │            │
│  │ Methods tested:  │     │ - clearForTool()     │            │
│  │ - revokePermission│    │ - clearAll()         │            │
│  │ - resetSession() │     │ - clearExpired()     │            │
│  │ - checkPermission│     │ - close()            │            │
│  └─────────────────┘     └──────────────────────┘            │
│                                                               │
│  ┌─────────────────────────────────────────────┐             │
│  │         EventEmitter (eventemitter3)          │             │
│  │                                               │             │
│  │ Events tested:                                │             │
│  │ - permission:request                          │             │
│  │ - permission:granted                          │             │
│  │ - permission:denied                           │             │
│  │                                               │             │
│  │ Cleanup tested:                               │             │
│  │ - removeAllListeners()                        │             │
│  │ - listenerCount()                             │             │
│  └─────────────────────────────────────────────┘             │
│                                                               │
│  ┌─────────────────────────────────────────────┐             │
│  │           TaskStore (SQLite)                  │             │
│  │                                               │             │
│  │ Cleanup tested:                               │             │
│  │ - Task status updated on revocation           │             │
│  │ - close() releases connection                 │             │
│  └─────────────────────────────────────────────┘             │
└───────────────────────────────────────────────────────────────┘
```

### 4. Dependencies

The test file will import from:

```typescript
// Test framework
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Node.js stdlib
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';

// Internal modules under test
import { PermissionStore } from '../permission-store';
import { PermissionManager } from '../permission-manager';
import { TaskStore } from '../store';

// Type imports
import { Permission, PermissionLevel, ExtendedPermission } from '@apexcli/core';

// EventEmitter for event disposal tests
import { EventEmitter } from 'eventemitter3';
```

### 5. Test Patterns to Follow

Based on existing test infrastructure:

1. **Temp directory pattern**: Each test gets isolated temp dir (see `permission-store.test.ts`)
2. **Store lifecycle**: `initialize()` in `beforeEach`, `close()` in `afterEach`
3. **No external dependencies**: Tests use real SQLite (no mocks for store) since it's fast and reliable
4. **EventEmitter mocking**: Use `vi.fn()` for handler spies (see `permission-events.test.ts`)
5. **Assertion style**: `toBeNull()`, `toBe()`, `toHaveLength()`, `toBeInstanceOf()`, `toMatchObject()`
6. **Factory helpers**: Inline factory functions for creating test permissions

### 6. Non-Goals for This Test Suite

- **Mid-stream revocation** during Claude SDK streaming (covered by ADR-048)
- **Integration with real Claude SDK** (out of scope for cleanup tests)
- **Browser/MCP permission integration** (covered by separate test files)
- **Performance benchmarking** (separate test suite)

### 7. Estimated Test Count

| Section | Tests |
|---------|-------|
| Task State Updates | 7 |
| SQLite Cleanup | 8 |
| Event Emitter Disposal | 7 |
| No Resource Leaks | 7 |
| **Total** | **29** |

## Consequences

### Positive
- Complete coverage of the 4 acceptance criteria
- Follows existing test patterns exactly — consistent with codebase
- No new dependencies needed
- Tests are fast (in-memory SQLite, no network)
- Each test is isolated with per-test temp directories

### Negative
- Adds ~300-400 lines to test suite
- Some tests may be partially redundant with existing `permission-manager.test.ts` (acceptable for completeness)

### Risks
- `PermissionManager` internal caches are private — tests verify behavior via public API only (correct approach)
- `EventEmitter` tests use standalone emitter, not full `ApexOrchestrator` — this is intentional to isolate event disposal testing from orchestrator complexity

## Related ADRs
- ADR-037: Permissions Integration Tests Architecture
- ADR-048: Permission Revocation Test Utilities
- ADR-035: Claude Agent SDK Mock Utilities
