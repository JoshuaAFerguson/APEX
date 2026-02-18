# ADR-096: TaskStore Cleanup Helpers for Testing and Maintenance

## Status

**Proposed**

## Context

The `TaskStore` class in `packages/orchestrator/src/store.ts` is the primary persistence layer for APEX tasks, managing SQLite database operations. Currently, testing scenarios require:

1. Creating temporary directories for each test
2. Manually cleaning up file system resources after each test
3. No convenient way to reset database state without destroying the entire test directory

This leads to:
- Complex test setup and teardown in every test file
- Slower tests due to file system operations
- Inconsistent test isolation patterns
- Difficulty in integration testing where database reset is needed between scenarios

### Requirements (Acceptance Criteria)

The `TaskStore` class needs the following methods:
1. `clearAllTasks()` - Remove all tasks and related data while preserving schema
2. `resetDatabase()` - Full database reset (drop and recreate all tables)
3. `static createTestInstance()` - Factory method that creates an in-memory SQLite instance

## Decision

We will add three cleanup helper methods to the `TaskStore` class:

### 1. `clearAllTasks(): Promise<void>`

Clears all data from task-related tables while preserving the database schema. This is useful for test scenarios that need a clean state between test cases without the overhead of recreating the database.

**Implementation approach:**
- Delete from all tables in correct order (respecting foreign key relationships)
- Use a transaction for atomicity
- Tables to clear:
  - `audit_logs`
  - `fix_attempts`
  - `snapshots`
  - `approval_states`
  - `todos`
  - `task_iterations`
  - `task_checkpoints`
  - `commands`
  - `task_dependencies`
  - `gates`
  - `task_artifacts`
  - `task_logs`
  - `idle_tasks`
  - `workspace_info`
  - `task_interactions`
  - `thought_captures`
  - `task_templates`
  - `tool_actions`
  - `tasks` (last, since others reference it)

```typescript
async clearAllTasks(): Promise<void> {
  this.ensureInitialized();

  const tables = [
    'audit_logs',
    'fix_attempts',
    'snapshots',
    'approval_states',
    'todos',
    'task_iterations',
    'task_checkpoints',
    'commands',
    'task_dependencies',
    'gates',
    'task_artifacts',
    'task_logs',
    'idle_tasks',
    'workspace_info',
    'task_interactions',
    'thought_captures',
    'task_templates',
    'tool_actions',
    'tasks',
  ];

  const transaction = this.db.transaction(() => {
    for (const table of tables) {
      try {
        this.db.exec(`DELETE FROM ${table}`);
      } catch {
        // Table may not exist in older schemas
      }
    }
  });

  transaction();
}
```

### 2. `resetDatabase(): Promise<void>`

Drops all tables and recreates them from scratch. This provides a complete reset of the database state, useful for scenarios requiring guaranteed clean schema.

**Implementation approach:**
- Drop all tables in correct order
- Call `createTables()` and `runMigrations()` to recreate schema

```typescript
async resetDatabase(): Promise<void> {
  this.ensureInitialized();

  // Get all table names
  const tables = this.db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];

  // Drop all tables (foreign_keys OFF allows dropping in any order)
  for (const { name } of tables) {
    this.db.exec(`DROP TABLE IF EXISTS ${name}`);
  }

  // Recreate schema
  this.createTables();
  this.runMigrations();
}
```

### 3. `static createTestInstance(): TaskStore`

Factory method that creates a `TaskStore` with an in-memory SQLite database. This eliminates file system overhead and provides perfect test isolation.

**Implementation approach:**
- Create a new `TaskStore` instance with special handling for in-memory database
- Override internal `dbPath` to use `:memory:`
- Initialize and return the instance

```typescript
static createTestInstance(): TaskStore {
  // Create instance with dummy path
  const instance = new TaskStore('/test');

  // Override to use in-memory database
  (instance as any).dbPath = ':memory:';
  (instance as any).db = new Database(':memory:');

  // Initialize schema
  instance.db.pragma('journal_mode = WAL');
  instance.db.pragma('foreign_keys = OFF');
  (instance as any).createTables();
  (instance as any).runMigrations();

  return instance;
}
```

## Alternatives Considered

### Alternative 1: Test Utility Module
Create a separate `test-utils.ts` module with helper functions.

**Rejected because:**
- Would require modifying internal state from outside the class
- Less discoverable for developers
- Doesn't follow the existing pattern where store manages its own state

### Alternative 2: Mock Database Layer
Use vitest mocking to intercept database calls.

**Rejected because:**
- Doesn't test actual SQLite behavior
- Complex to maintain as store evolves
- Already have this for some tests, but real database tests are more reliable

### Alternative 3: Database File Per Test
Keep current pattern of creating temp directories.

**Rejected because:**
- Slower due to file system operations
- More complex test setup/teardown
- Harder to debug (need to inspect files)

## Implementation Plan

### Phase 1: Add Methods to TaskStore (development stage)

1. Add `clearAllTasks()` method before `close()` method
2. Add `resetDatabase()` method after `clearAllTasks()`
3. Add `static createTestInstance()` factory method after constructor

### Phase 2: Unit Tests (testing stage)

Create `packages/orchestrator/src/store.cleanup-helpers.test.ts`:

1. Test `clearAllTasks()`:
   - Create multiple tasks with logs, artifacts, dependencies
   - Call `clearAllTasks()`
   - Verify all tables are empty
   - Verify schema still exists (can create new tasks)

2. Test `resetDatabase()`:
   - Create tasks with data
   - Call `resetDatabase()`
   - Verify all tables are empty
   - Verify can create new tasks

3. Test `createTestInstance()`:
   - Create test instance
   - Verify it can create and retrieve tasks
   - Verify multiple instances are isolated (in-memory = separate DBs)
   - Verify no file system artifacts created

## Consequences

### Positive
- Faster tests (in-memory database eliminates I/O)
- Simpler test setup (no temp directory management)
- Better test isolation (each instance is independent)
- Easier integration testing (reset between scenarios)
- Clear API for database maintenance operations

### Negative
- Slightly increases `TaskStore` API surface
- In-memory database behavior may differ slightly from file-based (WAL mode)
- Tests using `createTestInstance()` won't catch file system permission issues

### Risks
- `clearAllTasks()` could be accidentally called in production
  - **Mitigation:** Method is clearly named and not part of normal workflow

## File Changes

| File | Change |
|------|--------|
| `packages/orchestrator/src/store.ts` | Add `clearAllTasks()`, `resetDatabase()`, `createTestInstance()` |
| `packages/orchestrator/src/store.cleanup-helpers.test.ts` | New test file |

## References

- [better-sqlite3 documentation](https://github.com/WiseLibs/better-sqlite3)
- [SQLite in-memory databases](https://www.sqlite.org/inmemorydb.html)
- Existing test pattern in `packages/orchestrator/src/store.test.ts`
