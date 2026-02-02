# ADR-054: Database Fixtures and SQLite Test Utilities

## Status
Accepted

## Context

The APEX orchestrator's `TaskStore` is a critical component that persists tasks, logs, artifacts, and related data in SQLite. Testing code that interacts with `TaskStore` requires reliable, repeatable database state. Currently:

1. **`test-utils.ts`** provides `createTestDatabase()` / `cleanupTestDatabase()` for in-memory SQLite with full schema, and `createMockTask()` for generating Task objects.
2. However, there are **no seed/fixture functions** that insert pre-built task scenarios (completed, failed, running, etc.) into a `TaskStore` instance. Tests that need realistic task state must manually construct and insert tasks, leading to:
   - Duplicated setup code across test files
   - Inconsistent test data (different tests use different field values)
   - Verbose test setup that obscures test intent

## Decision

### Extend `test-utils.ts` with Task Fixture Seed Functions

We will add a set of **seed functions** to `packages/orchestrator/src/test-utils.ts` that:

1. Accept a `TaskStore` instance (already initialized with in-memory DB)
2. Create and persist tasks in specific status states via `TaskStore.createTask()` + `TaskStore.updateTaskStatus()`
3. Return the seeded `Task` object for assertions
4. Support optional overrides for customization

### API Design

```typescript
// Core seed functions - each creates a task in a specific lifecycle state
export async function seedPendingTask(store: TaskStore, overrides?: Partial<Task>): Promise<Task>;
export async function seedRunningTask(store: TaskStore, overrides?: Partial<Task>): Promise<Task>;
export async function seedCompletedTask(store: TaskStore, overrides?: Partial<Task>): Promise<Task>;
export async function seedFailedTask(store: TaskStore, overrides?: Partial<Task>): Promise<Task>;
export async function seedPausedTask(store: TaskStore, overrides?: Partial<Task>): Promise<Task>;
export async function seedCancelledTask(store: TaskStore, overrides?: Partial<Task>): Promise<Task>;

// Composite seed for multi-task scenarios
export async function seedTaskScenario(
  store: TaskStore,
  scenario: 'mixed-statuses' | 'dependency-chain' | 'subtask-tree' | 'retry-exhausted'
): Promise<Task[]>;

// TestTaskStoreContext - combines database + store for easy test setup
export interface TestTaskStoreContext {
  store: TaskStore;
  db: Database.Database;
  cleanup: () => Promise<void>;
}
export async function createTestTaskStore(): Promise<TestTaskStoreContext>;
```

### Architecture Principles

1. **Use the real `TaskStore` API** — Seed functions call `store.createTask()` and `store.updateTaskStatus()` rather than raw SQL. This ensures seeded data passes through the same validation and normalization as production data.

2. **In-memory SQLite for isolation** — Each test gets its own `:memory:` database via `createTestTaskStore()`. No file I/O, no cleanup needed between tests, no cross-test contamination.

3. **Composition over inheritance** — Seed functions compose `createMockTask()` with store operations. Each function is independent and composable.

4. **Deterministic but unique** — Task IDs use `generateTaskId()` from `@apexcli/core` for realistic IDs. Timestamps use `new Date()` but can be overridden.

5. **Minimal coupling** — Seed functions only depend on `TaskStore` public API and `createMockTask()`. No direct SQL manipulation.

### File Organization

All new code goes into the existing `packages/orchestrator/src/test-utils.ts` file, maintaining the single-file pattern already established for test utilities. The new functions are added in a new section:

```
// ============================================================================
// Task Fixture Seed Functions
// ============================================================================
```

### `createTestTaskStore()` Implementation

This bridges the existing `createTestDatabase()` (raw DB) with `TaskStore`:

```typescript
export async function createTestTaskStore(): Promise<TestTaskStoreContext> {
  const tempDir = await createTempDirectoryAsync('apex-test-store-');
  const store = new TaskStore(tempDir);
  await store.initialize();

  return {
    store,
    db: store.getDatabase(),
    cleanup: async () => {
      store.close();
      await removeTempDirectory(tempDir);
    },
  };
}
```

This uses `TaskStore`'s real constructor and initialization, ensuring schema is created by the same code path as production. The temp directory approach is needed because `TaskStore` constructor requires a project path.

### Seed Function Pattern

Each seed function follows this pattern:

```typescript
export async function seedCompletedTask(store: TaskStore, overrides?: Partial<Task>): Promise<Task> {
  const task = createMockTask({
    description: 'Completed test task',
    status: 'pending',  // Start pending, then transition
    usage: {
      inputTokens: 5000,
      outputTokens: 3000,
      totalTokens: 8000,
      estimatedCost: 0.15,
      totalCostCents: 15,
      executionTimeMs: 45000,
    },
    ...overrides,
  });

  const created = await store.createTask(task);
  await store.updateTaskStatus(created.id, 'running', 'development');
  await store.updateTaskStatus(created.id, 'completed');
  return (await store.getTask(created.id))!;
}
```

Key design choices:
- Tasks go through realistic status transitions (pending → running → completed/failed)
- Each status variant includes appropriate default data (e.g., failed tasks have error messages, completed tasks have usage data)
- Overrides are applied at creation time, before status transitions

### Scenario Seeds

`seedTaskScenario()` creates multi-task setups:

- **`mixed-statuses`**: One task of each status (pending, running, completed, failed, paused, cancelled)
- **`dependency-chain`**: 3 tasks where B depends on A, C depends on B
- **`subtask-tree`**: Parent task with 3 subtasks in different states
- **`retry-exhausted`**: Task that has hit maxRetries with multiple failure states

## Consequences

### Positive
- Tests become more concise and readable
- Consistent test data across the test suite
- Realistic task state (created via production code paths)
- Easy to add new scenarios as needed
- Full test isolation via in-memory databases

### Negative
- Slightly more code in test-utils.ts (manageable, ~150 lines)
- Seed functions depend on TaskStore's public API stability (acceptable since both are internal)

### Neutral
- No impact on production code
- No new dependencies required
- Pattern is consistent with existing test utility conventions (PermissionStore utilities follow similar pattern)
