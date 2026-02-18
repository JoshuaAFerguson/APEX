# ADR-056: In-Memory SQLite Test Database Utilities

## Status
Accepted

## Context
The APEX project uses SQLite (via better-sqlite3) for persistent storage in the `TaskStore` class. Testing database operations requires either:
1. Mocking the entire TaskStore (loses integration testing value)
2. Creating temp directories with file-based databases (slow, requires cleanup)
3. Using in-memory SQLite databases (fast, isolated, no file cleanup needed)

Currently, the `TaskStore` constructor creates directories and sets the database path based on `projectPath`, which doesn't directly support `:memory:` databases. Existing tests use various patterns inconsistently.

## Decision
Create dedicated test database utilities in `packages/orchestrator/src/test-utils.ts` that:

1. **`createTestDatabase()`** - Factory function that returns a `TestDatabaseContext` object containing:
   - A `TaskStore` instance initialized with an in-memory SQLite database
   - A cleanup function to properly close the database

2. **`cleanupTestDatabase(context)`** - Teardown function that:
   - Closes the SQLite database connection
   - Clears any associated resources

3. **Alternative overload** for TaskStore that accepts an optional `inMemory: boolean` parameter during initialization.

### Technical Approach

The solution extends the existing `test-utils.ts` file and adds a specialized `TestTaskStore` class that:
- Extends or wraps `TaskStore`
- Uses `:memory:` as the database path
- Skips directory creation logic
- Exports the same interface for test compatibility

### API Design

```typescript
interface TestDatabaseContext {
  store: TaskStore;
  cleanup: () => void;
}

// Primary utility - creates in-memory store
function createTestDatabase(): Promise<TestDatabaseContext>;

// Alternative: Create store with optional in-memory flag
function createTestStore(options?: { inMemory?: boolean; projectPath?: string }): Promise<TaskStore>;

// Teardown utility
function cleanupTestDatabase(context: TestDatabaseContext): void;
```

### Usage Example

```typescript
import { createTestDatabase, cleanupTestDatabase } from '../test-utils';

describe('TaskStore', () => {
  let testDb: TestDatabaseContext;

  beforeEach(async () => {
    testDb = await createTestDatabase();
  });

  afterEach(() => {
    cleanupTestDatabase(testDb);
  });

  it('should create a task', async () => {
    const task = await testDb.store.createTask({
      description: 'Test task',
      workflow: 'feature',
    });
    expect(task.id).toBeDefined();
  });
});
```

## Consequences

### Positive
- **Fast tests**: In-memory databases are significantly faster than file-based ones
- **Isolation**: Each test gets a fresh database with no state leakage
- **No cleanup needed**: Memory is automatically freed when the database is closed
- **Consistent pattern**: Provides a single, documented way to create test databases
- **Type-safe**: Full TypeScript support with proper interfaces

### Negative
- **Requires TaskStore modification**: Need to add ability to use `:memory:` path
- **Not identical to production**: In-memory databases don't test file I/O edge cases

### Neutral
- **Complements existing patterns**: Works alongside temp directory approach for integration tests needing file persistence

## Implementation Notes

1. The `TaskStore` class needs a minor modification to accept a database path directly or an `inMemory` flag
2. The `createTables()` and `runMigrations()` methods work identically for in-memory databases
3. WAL mode doesn't apply to in-memory databases, so we skip that pragma
4. All existing tests can be gradually migrated to use these utilities

## Related ADRs
- ADR-052: Dry-Run Filesystem Integration Tests (mentions `:memory:` option)
- ADR-046: Error Recovery Test Architecture
