# ADR-049: Permission Revocation Cleanup Tests Architecture

**Status**: Accepted (Updated)
**Date**: 2025-07-15 (Updated: 2026-02-02)
**Author**: Architect Agent

## Context

APEX's permission system consists of multiple layers:
1. **PermissionStore** (SQLite persistence) - `permission-store.ts`
2. **PermissionManager** (session cache + store wrapper) - `permission-manager.ts`
3. **ApexOrchestrator** (event emission, task lifecycle) - `index.ts`
4. **ApprovalGateController** (approval workflow with dispose pattern) - `approval-gate-controller.ts`

When a permission is revoked (via `PermissionManager.revokePermission()`), several cleanup operations must occur:
- Task state must reflect the revocation (status update, log entry)
- SQLite records must be cleaned up (PermissionStore via `clearPermission()`)
- Session caches must be cleared (PermissionManager's 3 caches: sessionCache, sessionDirectoryAccess, sessionToolConfigCache)
- Event listeners attached for the revoked permission context must be disposed
- No resource leaks (open DB connections, dangling listeners, orphan timers)

Currently, ADR-048 defines test utilities for **mid-stream** revocation simulation. This ADR defines the **test suite architecture** for verifying that cleanup after revocation is correct and complete.

### Existing Test Coverage Gap Analysis

The following test files already exist and cover related but distinct concerns:
- `permission-revocation-comprehensive.test.ts` — edge cases, cascading dependencies, event propagation, recovery/retry. Uses `PermissionManager` + `PermissionStore` + Node.js `EventEmitter` (from `events`). Does NOT test TaskStore integration or resource leak verification.
- `permission-revocation-graceful-degradation.test.ts` — graceful degradation after revocation
- `mid-stream-permission-revocation.test.ts` — revocation during streaming with `PermissionRevocationController`

**What's missing** (this test file's scope):
1. TaskStore state updates correlated with permission revocation
2. Direct PermissionStore SQL-level cleanup verification (clearPermission, clearPermissionsForTool, clearPermissions, clearExpired)
3. eventemitter3 EventEmitter disposal (matching ApexOrchestrator's actual emitter type)
4. Resource leak detection across grant/revoke cycles with resetSession()

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
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';

// Internal modules under test
import { PermissionStore } from '../permission-store.js';
import { PermissionManager } from '../permission-manager.js';
import { TaskStore } from '../store.js';

// Type imports
import type { Permission, PermissionLevel, ExtendedPermission } from '@apexcli/core';

// EventEmitter — use eventemitter3 to match ApexOrchestrator's actual implementation
import { EventEmitter } from 'eventemitter3';

describe('Permission Revocation Cleanup', () => {

  // Shared setup: temp dir, PermissionStore, PermissionManager, TaskStore
  let testDir: string;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let taskStore: TaskStore;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `apex-revocation-cleanup-${Date.now()}-${Math.random().toString(36).substring(2)}`
    );
    mkdirSync(testDir, { recursive: true });
    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();
    permissionManager = new PermissionManager(permissionStore);
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();
  });

  afterEach(() => {
    try { permissionStore.close(); } catch { /* already closed */ }
    try { taskStore.close(); } catch { /* already closed */ }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
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

**Implementation Notes**:
- `PermissionManager.revokePermission(tool, scope?)` internally calls `sessionCache.delete(cacheKey)` AND `permissionStore.clearPermission({ tool, scope })`
- It returns `true` if either session cache or persistent store had the permission
- `allow-once` permissions live in sessionCache; `allow-always`/`deny` live in PermissionStore (SQLite)
- TaskStore is separate from PermissionStore — task state updates on revocation are an orchestrator-level concern. For cleanup tests, we verify that `TaskStore.updateTaskStatus()` can be called to mark tasks as cancelled/failed after revocation

**Test Cases**:

| # | Test | Verifies |
|---|------|----------|
| 1 | `revokePermission()` removes allow-always from persistent store | `PermissionManager.revokePermission()` clears DB via `clearPermission()` |
| 2 | `revokePermission()` removes allow-once from session cache | Session cache cleanup |
| 3 | `revokePermission()` returns false when no permission existed | Idempotent behavior |
| 4 | After revocation, `checkPermission()` returns null | Permission is truly gone |
| 5 | After revocation, `hasPermission()` returns false | Boolean API consistency |
| 6 | Revoking a scoped permission does not affect unscoped permission for same tool | Scope isolation |
| 7 | Revoking does not affect permissions for other tools | Tool isolation |
| 8 | TaskStore task status updated to cancelled after revocation | Task lifecycle integration |

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

// Verify task can be updated after revocation
const task = await taskStore.createTask({
  description: 'Test task',
  workflow: 'feature',
  autonomy: 'semi' as any,
  projectPath: testDir,
});
await taskStore.updateTaskStatus(task.id, 'cancelled', undefined, 'Permission revoked');
const updated = await taskStore.getTask(task.id);
expect(updated?.status).toBe('cancelled');
```

#### 2.2 SQLite PermissionStore Cleanup

**Purpose**: Verify that permission revocation properly clears all related SQLite records in the PermissionStore.

**Implementation Notes**:
- `PermissionStore.clearPermission(query)` — deletes by tool_name + scope, returns boolean
- `PermissionStore.clearPermissionsForTool(toolName)` — deletes all scopes for tool, returns count
- `PermissionStore.clearPermissions()` — truncates entire permissions table
- `PermissionStore.clearExpired()` — deletes rows where `expires_at <= now`, returns count
- `PermissionStore.saveExtendedPermission()` — uses UPSERT (INSERT ON CONFLICT UPDATE) keyed by generated ID from tool+scope
- Extended fields: `config` (JSON), `grant_reason`, `granted_by`, `tags` (JSON array)

**Test Cases**:

| # | Test | Verifies |
|---|------|----------|
| 1 | `clearPermission()` removes the exact row from permissions table | Single-row deletion |
| 2 | `clearPermissionsForTool()` removes all permissions for a tool across scopes | Bulk tool cleanup |
| 3 | `clearPermissions()` removes all permission rows | Full wipe |
| 4 | `clearExpired()` only removes expired permissions, leaves valid ones | Selective cleanup |
| 5 | Extended permission fields (config, tags, grantReason) are fully removed | No orphan data |
| 6 | After cleanup, `listPermissions()` returns empty for cleared tool | List consistency |
| 7 | `clearPermission()` on non-existent returns false | Idempotent behavior |
| 8 | Bulk deletion followed by re-insertion works correctly | Index integrity after deletions |

**Key Assertions**:
```typescript
// Save multiple permissions for same tool with extended fields
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

// Verify complete removal (including extended fields)
const remaining = await permissionStore.listPermissions({ tool: 'Bash' });
expect(remaining).toHaveLength(0);

// Verify getExtendedPermission returns null
const ext = await permissionStore.getExtendedPermission({ tool: 'Bash', scope: '/bin' });
expect(ext).toBeNull();
```

#### 2.3 Event Emitter Disposal

**Purpose**: Verify that event listeners registered for permission-related events are properly removed after revocation.

**Design Approach**: Use `EventEmitter` from `eventemitter3` (same as `ApexOrchestrator`) to create a test emitter that registers permission event handlers, then verify they are removed. This matches the actual runtime behavior since ApexOrchestrator extends `EventEmitter` from eventemitter3.

**Important**: The existing `permission-revocation-comprehensive.test.ts` uses Node.js `events.EventEmitter`. This test suite uses `eventemitter3.EventEmitter` to match actual production code.

**Test Cases**:

| # | Test | Verifies |
|---|------|----------|
| 1 | Permission event listeners can be added and removed | Basic add/remove with eventemitter3 |
| 2 | `removeAllListeners('permission:granted')` clears all handlers for that event | Targeted cleanup |
| 3 | `removeAllListeners()` clears all permission-related listeners | Full cleanup |
| 4 | After disposal, emitting events does not trigger old handlers | No ghost handlers |
| 5 | Dispose pattern: removeAllListeners + clearTimeout on tracked timers | Dispose lifecycle |
| 6 | Listeners on one event type don't affect other event types | Event isolation |
| 7 | `resetSession()` clears all 3 in-memory caches (session, directory, toolConfig) | Memory cleanup |

**Key Assertions**:
```typescript
const emitter = new EventEmitter();
const handler = vi.fn();

emitter.on('permission:granted', handler);
expect(emitter.listenerCount('permission:granted')).toBe(1);

// Simulate cleanup after revocation
emitter.removeAllListeners('permission:granted');
expect(emitter.listenerCount('permission:granted')).toBe(0);

// Verify handler is not called
emitter.emit('permission:granted', { tool: 'Write' });
expect(handler).not.toHaveBeenCalled();
```

#### 2.4 No Resource Leaks After Revocation

**Purpose**: Verify that after permission revocation and cleanup, no resources are leaked.

**Implementation Notes**:
- `PermissionManager.resetSession()` clears all 3 Maps: `sessionCache`, `sessionDirectoryAccess`, `sessionToolConfigCache`
- `PermissionStore.close()` calls `this.db.close()` (better-sqlite3 synchronous close)
- `TaskStore.close()` calls `this.db.close()`
- Tests verify behavior through public API since caches are private

**Test Cases**:

| # | Test | Verifies |
|---|------|----------|
| 1 | `PermissionStore.close()` releases SQLite connection | DB connection cleanup |
| 2 | Session cache is empty after `resetSession()` (verified via checkPermission returning null for allow-once grants) | Memory leak check |
| 3 | Directory access cache is cleared after `resetSession()` | Cache cleanup |
| 4 | Tool config cache is cleared after `resetSession()` | Config cache cleanup |
| 5 | Multiple grant/revoke cycles (100x) don't accumulate residual state | Cyclic stability |
| 6 | After store close, operations throw/fail gracefully | Post-close safety |
| 7 | Temp directory cleanup in afterEach doesn't leave orphan files | Test isolation |

**Key Assertions**:
```typescript
// Multiple grant/revoke cycles
for (let i = 0; i < 100; i++) {
  await permissionManager.grantPermission('Write', `/path/${i}`, 'allow-once');
  await permissionManager.revokePermission('Write', `/path/${i}`);
}

// Reset session to clear all 3 caches
permissionManager.resetSession();

// Verify no residual state - all checks return null
for (let i = 0; i < 100; i++) {
  const level = await permissionManager.checkPermission('Write', `/path/${i}`);
  expect(level).toBeNull();
}

// Verify store can still be closed cleanly
permissionStore.close();

// After close, operations should throw
await expect(
  permissionStore.getPermission({ tool: 'Write' })
).rejects.toThrow();
```

### 3. Component Interaction Diagram

```
┌───────────────────────────────────────────────────────────────┐
│                    Test Suite Scope                            │
│                                                               │
│  ┌─────────────────────┐   ┌──────────────────────┐          │
│  │  PermissionManager   │──>│  PermissionStore     │          │
│  │                      │   │  (SQLite)            │          │
│  │ Private caches:      │   │                      │          │
│  │ - sessionCache (Map) │   │ - permissions table  │          │
│  │ - sessionDirectoryAccess│ │ - clearPermission()  │          │
│  │ - sessionToolConfigCache│ │ - clearPermissionsForTool() │   │
│  │                      │   │ - clearPermissions() │          │
│  │ Methods tested:      │   │ - clearExpired()     │          │
│  │ - revokePermission() │   │ - close()            │          │
│  │ - resetSession()     │   │ - listPermissions()  │          │
│  │ - checkPermission()  │   │ - getExtendedPermission() │    │
│  │ - hasPermission()    │   │ - saveExtendedPermission() │   │
│  └─────────────────────┘   └──────────────────────┘          │
│                                                               │
│  ┌─────────────────────────────────────────────┐             │
│  │     EventEmitter (eventemitter3) ← matches   │             │
│  │     ApexOrchestrator's actual type           │             │
│  │                                               │             │
│  │ Events tested:                                │             │
│  │ - permission:request                          │             │
│  │ - permission:granted                          │             │
│  │ - permission:denied                           │             │
│  │ - permission:revoked                          │             │
│  │                                               │             │
│  │ Cleanup tested:                               │             │
│  │ - on() / removeListener() / removeAllListeners() │         │
│  │ - listenerCount()                             │             │
│  └─────────────────────────────────────────────┘             │
│                                                               │
│  ┌─────────────────────────────────────────────┐             │
│  │           TaskStore (SQLite)                  │             │
│  │                                               │             │
│  │ Tested interactions:                          │             │
│  │ - createTask() → updateTaskStatus('cancelled')│             │
│  │ - close() releases connection                 │             │
│  │ - Verify task state after revocation          │             │
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

// Internal modules under test (use .js extensions for NodeNext module resolution)
import { PermissionStore } from '../permission-store.js';
import { PermissionManager } from '../permission-manager.js';
import { TaskStore } from '../store.js';

// Type imports
import type { Permission, PermissionLevel, ExtendedPermission } from '@apexcli/core';

// EventEmitter — MUST use eventemitter3 to match ApexOrchestrator
import { EventEmitter } from 'eventemitter3';
```

**Note on `.js` extensions**: The project uses `moduleResolution: NodeNext` which requires `.js` extensions in import paths. Existing test files in this directory use both `.js` and extensionless imports. Follow the pattern from `permission-revocation-comprehensive.test.ts` which uses `.js` extensions.

### 5. Test Patterns to Follow

Based on existing test infrastructure:

1. **Temp directory pattern**: Each test gets isolated temp dir (see `permission-store.test.ts`)
2. **Store lifecycle**: `initialize()` in `beforeEach`, `close()` in `afterEach` with try/catch
3. **No external dependencies**: Tests use real SQLite (no mocks for store) since it's fast and reliable
4. **EventEmitter**: Use `eventemitter3.EventEmitter` (not Node.js `events`) with `vi.fn()` for handler spies
5. **Assertion style**: `toBeNull()`, `toBe()`, `toHaveLength()`, `toBeInstanceOf()`, `toMatchObject()`
6. **Factory helpers**: Inline factory functions for creating test permissions and tasks
7. **Guard clauses in afterEach**: Wrap `close()` calls in try/catch for tests that close stores early

### 6. Non-Goals for This Test Suite

- **Mid-stream revocation** during Claude SDK streaming (covered by ADR-048)
- **Integration with real Claude SDK** (out of scope for cleanup tests)
- **Browser/MCP permission integration** (covered by separate test files)
- **Performance benchmarking** (separate test suite)
- **Edge cases already covered** by `permission-revocation-comprehensive.test.ts` (cascading deps, retry mechanisms, race conditions)

### 7. Estimated Test Count

| Section | Tests |
|---------|-------|
| Task State Updates | 8 |
| SQLite Cleanup | 8 |
| Event Emitter Disposal | 7 |
| No Resource Leaks | 7 |
| **Total** | **30** |

### 8. Key API Reference (for implementor)

#### PermissionManager (permission-manager.ts)
- `constructor(store: PermissionStore)`
- `async checkPermission(tool: string, scope?: string): Promise<PermissionLevel | null>` — consumes allow-once
- `async grantPermission(tool: string, scope: string | undefined, level: PermissionLevel): Promise<void>`
- `async revokePermission(tool: string, scope?: string): Promise<boolean>` — clears session cache AND persistent store
- `async hasPermission(tool: string, scope?: string): Promise<boolean>` — true for allow-always/allow-once
- `resetSession(): void` — clears sessionCache, sessionDirectoryAccess, sessionToolConfigCache
- `async getToolConfig(tool: string, scope?: string): Promise<ToolPermissionConfig | null>`
- `setToolConfig(tool: string, config: ToolPermissionConfig | null, scope?: string): void`

#### PermissionStore (permission-store.ts)
- `constructor(projectPath: string)` — creates `.apex/` dir and sets dbPath
- `async initialize(): Promise<void>` — opens SQLite, creates table, runs migrations
- `async savePermission(permission: Permission): Promise<void>`
- `async saveExtendedPermission(permission: ExtendedPermission): Promise<void>`
- `async getPermission(query: PermissionQuery): Promise<Permission | null>`
- `async getExtendedPermission(query: PermissionQuery): Promise<ExtendedPermission | null>`
- `async listPermissions(options?): Promise<Permission[]>`
- `async clearPermission(query: PermissionQuery): Promise<boolean>` — returns true if row deleted
- `async clearPermissionsForTool(toolName: string): Promise<number>` — returns count
- `async clearPermissions(): Promise<void>` — deletes all
- `async clearExpired(): Promise<number>` — returns count of deleted expired permissions
- `close(): void` — closes SQLite connection

#### TaskStore (store.ts)
- `constructor(projectPath: string)` — auto-initializes
- `async initialize(): Promise<void>`
- `async createTask(task: Task | CreateTaskRequest): Promise<Task>`
- `async updateTaskStatus(taskId: string, status: TaskStatus, stage?: string, message?: string): Promise<void>`
- `async getTask(taskId: string): Promise<Task | null>`
- `close(): void`

## Consequences

### Positive
- Complete coverage of the 4 acceptance criteria with zero overlap with existing test files
- Follows existing test patterns exactly — consistent with codebase
- No new dependencies needed
- Tests are fast (file-based SQLite in temp dir, no network)
- Each test is isolated with per-test temp directories
- Uses `eventemitter3` matching actual production code

### Negative
- Adds ~400-500 lines to test suite
- Some tests partially redundant with `permission-manager.test.ts` (acceptable for cleanup-focused verification)

### Risks
- `PermissionManager` internal caches are private — tests verify behavior via public API only (correct approach)
- `EventEmitter` tests use standalone emitter, not full `ApexOrchestrator` — this is intentional to isolate event disposal testing from orchestrator complexity
- `TaskStore.close()` after `PermissionStore.close()` on same DB file may need separate DB files if they share the same SQLite file — verified: both use `.apex/apex.db` so they share the DB. Use the same `testDir` for both stores.

## Related ADRs
- ADR-037: Permissions Integration Tests Architecture
- ADR-048: Permission Revocation Test Utilities
- ADR-048: Mid-Stream Permission Revocation Tests
- ADR-035: Claude Agent SDK Mock Utilities
- ADR-052: Permission Code Paths Test Coverage Map
