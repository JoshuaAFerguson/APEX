# Test Cleanup Utilities

The test cleanup utilities provide comprehensive state cleanup and reset functionality for ensuring proper test isolation in APEX tests.

## Features

- **Database Cleanup**: Clear SQLite TaskStore data between tests
- **In-Memory State Reset**: Reset application state and caches
- **Environment Variable Management**: Save and restore environment state
- **Test Hook Utilities**: Easy beforeEach/afterEach patterns
- **Database Assertions**: Verify clean state in tests

## Quick Start

```typescript
import { createTestHooks, TestAssertions } from '@apexcli/orchestrator';

describe('My Test Suite', () => {
  const testHooks = createTestHooks();

  beforeEach(async () => {
    await testHooks.beforeEach();
  });

  afterEach(async () => {
    await testHooks.afterEach();
  });

  it('should create tasks in isolation', async () => {
    const store = await testHooks.createTaskStore();

    await store.createTask({
      description: 'Test task',
      workflow: 'development',
      agent: 'developer'
    });

    // Verify task exists
    const tasks = await store.getAllTasks();
    expect(tasks).toHaveLength(1);

    // Cleanup happens automatically in afterEach
  });

  it('should start with clean state', async () => {
    const store = await testHooks.createTaskStore();

    // Should be empty due to cleanup from previous test
    await TestAssertions.assertEmptyDatabase(store);
  });
});
```

## Configuration Options

```typescript
import { createTestHooks } from '@apexcli/orchestrator';

const testHooks = createTestHooks({
  useInMemoryDb: true,        // Use in-memory database (default: true)
  preserveDbFiles: false,     // Keep test DB files after cleanup (default: false)
  resetEnvVars: true,         // Reset environment variables (default: true)
  testDbPath: './test.db'     // Custom test database path
});
```

## Advanced Usage

### Manual Cleanup Management

```typescript
import { TestCleanup } from '@apexcli/orchestrator';

const cleanup = new TestCleanup({
  useInMemoryDb: false,
  testDbPath: './custom-test.db'
});

// Create test store
const store = await cleanup.createTestTaskStore('/tmp/test-project');

// Add test data
await store.createTask({
  description: 'Test task',
  workflow: 'development',
  agent: 'developer'
});

// Clean up manually
await cleanup.cleanupTaskStore(store);

// Complete cleanup
await cleanup.cleanup();
```

### Multiple Stores in One Test

```typescript
it('should handle multiple stores', async () => {
  const store1 = await testHooks.createTaskStore('/project1');
  const store2 = await testHooks.createTaskStore('/project2');

  await store1.createTask({
    description: 'Task in project 1',
    workflow: 'development',
    agent: 'developer'
  });

  await store2.createTask({
    description: 'Task in project 2',
    workflow: 'development',
    agent: 'developer'
  });

  // Both stores cleaned up automatically in afterEach
});
```

### Store Reset Without Recreation

```typescript
it('should reset store state', async () => {
  const store = await testHooks.createTaskStore();

  // Add data
  await store.createTask({
    description: 'Task to be cleared',
    workflow: 'development',
    agent: 'developer'
  });

  // Reset store (faster than recreating)
  await testHooks.resetTaskStore(store);

  // Now store is empty but still functional
  await TestAssertions.assertEmptyDatabase(store);
});
```

## Test Assertions

The utilities include helpful assertions for verifying clean state:

```typescript
import { TestAssertions } from '@apexcli/orchestrator';

// Assert entire database is empty
await TestAssertions.assertEmptyDatabase(store);

// Assert specific tables are empty
await TestAssertions.assertTablesEmpty(store, ['tasks', 'task_templates']);

// Get database statistics for debugging
const stats = await TestAssertions.getDatabaseStats(store);
console.log('Database stats:', stats);
// Output: { tasks: 0, task_templates: 0, task_logs: 0, ... }
```

## Environment Variable Management

The cleanup utilities automatically save and restore environment variables that affect APEX behavior:

- `APEX_HOME`
- `NODE_ENV`
- `APEX_DB_PATH`
- `APEX_LOG_LEVEL`

```typescript
// Environment changes are automatically isolated
process.env.APEX_HOME = '/test/home';

// After test cleanup, original value is restored
```

## Error Handling

The cleanup utilities are designed to be robust and handle errors gracefully:

```typescript
// Cleanup continues even if individual operations fail
await testHooks.afterEach(); // Won't throw even if store is already closed

// Warnings are logged for debugging
// Warning: Could not clean table xyz: [error details]
```

## Best Practices

1. **Always use hooks**: Use `createTestHooks()` for consistent setup/teardown
2. **One store per test**: Create fresh stores for each test for best isolation
3. **Reset vs recreate**: Use `resetTaskStore()` for performance, `createTaskStore()` for full isolation
4. **Assert clean state**: Use `TestAssertions.assertEmptyDatabase()` to verify test isolation
5. **Handle async properly**: Always await cleanup operations

## Testing the Utilities

The cleanup utilities themselves include comprehensive tests demonstrating their usage:

```bash
# Run the test cleanup utility tests
npm test -- test-cleanup.test.ts

# Run the example
node dist/test-cleanup.example.js
```

## Implementation Notes

- **In-memory by default**: Tests use in-memory SQLite databases for speed
- **File cleanup**: Temporary database files are automatically removed
- **Transaction safety**: Database operations use transactions for consistency
- **Schema preservation**: Cleanup removes data but preserves database schema
- **Multiple database support**: Can handle multiple TaskStore instances simultaneously