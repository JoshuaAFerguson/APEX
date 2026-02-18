# Test Utilities for APEX Orchestrator

This directory contains test utilities for the APEX Orchestrator package, providing comprehensive tools for testing database operations, permissions, and other components.

## Files

### `db.ts`
SQLite test database setup/teardown utility module that provides:
- **`createTestDatabase()`**: Creates an in-memory SQLite database with complete TaskStore schema
- **`cleanupTestDatabase()`**: Safely closes the database connection
- **`createTaskStoreWithTestDb()`**: Creates a TaskStore instance using a test database context
- **`TestDatabaseContext`**: TypeScript interface for the database context

### `index.ts`
Main entry point that re-exports all utilities for convenient importing.

## Usage

### Basic Database Testing

```typescript
import { createTestDatabase, cleanupTestDatabase } from './test-utils/db';

describe('My tests', () => {
  let testDb: TestDatabaseContext;

  beforeEach(async () => {
    testDb = await createTestDatabase();
  });

  afterEach(() => {
    cleanupTestDatabase(testDb);
  });

  it('should work with the database', () => {
    const stmt = testDb.db.prepare('SELECT * FROM tasks');
    const tasks = stmt.all();
    expect(tasks).toEqual([]);
  });
});
```

### Using TaskStore with Test Database

```typescript
import { createTestDatabase, cleanupTestDatabase, createTaskStoreWithTestDb } from './test-utils/db';
import type { TaskStore } from '../store';

describe('TaskStore integration tests', () => {
  let testDb: TestDatabaseContext;
  let taskStore: TaskStore;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    taskStore = createTaskStoreWithTestDb(testDb);
  });

  afterEach(() => {
    cleanupTestDatabase(testDb);
  });

  it('should create and retrieve tasks', async () => {
    const task = await taskStore.createTask({
      description: 'Test task',
      workflow: 'feature',
      autonomy: 'full'
    });

    expect(task.id).toBeDefined();

    const retrieved = await taskStore.getTask(task.id);
    expect(retrieved?.description).toBe('Test task');
  });
});
```

### Import from Index (Recommended)

```typescript
import { createTestDatabase, cleanupTestDatabase, createTaskStoreWithTestDb } from './test-utils';
```

### Direct Import

```typescript
import { createTestDatabase, cleanupTestDatabase, createTaskStoreWithTestDb } from './test-utils/db';
```

## Features

- ✅ In-memory SQLite database creation
- ✅ Complete TaskStore schema initialization (all tables, indexes, constraints)
- ✅ Clean teardown/cleanup functions
- ✅ TaskStore integration utilities for seamless testing
- ✅ Better-sqlite3 compatibility
- ✅ TypeScript type definitions
- ✅ Foreign key constraints disabled (matches TaskStore behavior)
- ✅ Transaction support
- ✅ Data isolation between test instances
- ✅ Backward compatibility with existing test imports

## Schema Coverage

The test database includes all TaskStore tables:

**Core Tables:**
- tasks, task_logs, task_artifacts, gates, commands, task_dependencies, task_checkpoints

**v0.4.0 Tables:**
- thought_captures, task_interactions, workspace_info, idle_tasks, task_iterations, task_templates, todos

**v0.5.0 Tables:**
- approval_states, file_snapshots, tool_actions, snapshots, permissions, mcp_marketplace, mcp_servers, mcp_installations, fix_attempts, audit_logs

**Performance Indexes:**
- All performance-critical indexes are created for realistic testing scenarios