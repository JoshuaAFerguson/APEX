# Test Configuration Guide

This document explains the test configuration and database utilities for the APEX orchestrator package.

## Test Framework

The project uses **Vitest** as the test framework, configured at both the root level and package level.

### Running Tests

```bash
# Run all tests from root
npm run test

# Run tests for specific package
npm test --workspace=@apexcli/orchestrator

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Test Configuration

### Root Level (vitest.config.ts)
- Uses Vitest with global test functions enabled
- Configures environment based on package path
- Sets up coverage reporting with v8 provider
- Includes TypeScript support

### Package Level (orchestrator)
- Environment: Node.js (set by root config)
- Global test functions: Available (describe, it, expect, beforeEach, etc.)
- Test file patterns: `**/*.test.ts`, `**/*.integration.test.ts`, etc.

## In-Memory SQLite Database Utilities

The orchestrator package provides comprehensive test utilities for working with in-memory SQLite databases that mirror the production TaskStore schema.

### Core Functions

#### `createTestDatabase(): Promise<TestDatabaseContext>`

Creates an in-memory SQLite database with the complete TaskStore schema.

```typescript
import { createTestDatabase, cleanupTestDatabase, type TestDatabaseContext } from '../test-utils';

describe('My tests', () => {
  let testDb: TestDatabaseContext;

  beforeEach(async () => {
    testDb = await createTestDatabase();
  });

  afterEach(() => {
    cleanupTestDatabase(testDb);
  });

  it('should work with the database', () => {
    const tasks = testDb.db.prepare('SELECT * FROM tasks').all();
    expect(tasks).toEqual([]);
  });
});
```

**Returns:** `TestDatabaseContext` object containing:
- `db`: The better-sqlite3 Database instance
- `cleanup`: Function to close the database

#### `cleanupTestDatabase(context: TestDatabaseContext): void`

Safely closes the database connection. Can be called multiple times.

```typescript
afterEach(() => {
  cleanupTestDatabase(testDb);
});
```

#### `createMockTask(overrides?: Partial<Task>): Task`

Creates a valid Task object with sensible defaults for testing.

```typescript
import { createMockTask } from '../test-utils';

it('should process a task', () => {
  const task = createMockTask({
    id: 'custom_task_id',
    status: 'in_progress',
    priority: 'high',
  });

  // All other fields are filled with defaults
  expect(task.workflow).toBe('feature');
  expect(task.autonomy).toBe('full');
});
```

## Database Schema

The test database includes all tables from the production TaskStore:

### Core Tables
- `tasks` - Main task records
- `task_logs` - Task execution logs
- `task_artifacts` - Task output artifacts
- `gates` - Approval gates
- `commands` - Command history
- `task_dependencies` - Task relationships
- `task_checkpoints` - Resume checkpoints

### v0.4.0 Tables
- `thought_captures` - Captured thoughts/ideas
- `task_interactions` - User interactions
- `workspace_info` - Workspace configuration
- `idle_tasks` - Background task queue
- `task_iterations` - Feedback iterations
- `task_templates` - Task templates
- `todos` - Task todo items

### v0.5.0 Tables
- `approval_states` - Approval workflow state
- `file_snapshots` - File version snapshots
- `tool_actions` - Tool execution tracking
- `snapshots` - Action snapshots
- `permissions` - Tool permissions
- `mcp_marketplace` - MCP server marketplace
- `mcp_servers` - Installed MCP servers
- `fix_attempts` - Error fix attempts
- `audit_logs` - Comprehensive audit trail

### Indexes
All production indexes are included for realistic performance testing.

## Best Practices

### 1. Always Use beforeEach/afterEach

```typescript
describe('My test suite', () => {
  let testDb: TestDatabaseContext;

  beforeEach(async () => {
    testDb = await createTestDatabase();
  });

  afterEach(() => {
    cleanupTestDatabase(testDb);
  });

  // Your tests here...
});
```

### 2. Test Isolation

Each test gets a fresh in-memory database. Tests cannot interfere with each other.

### 3. Use Prepared Statements

```typescript
it('should handle multiple tasks', () => {
  const stmt = testDb.db.prepare(`
    INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  stmt.run('task1', 'First task', 'feature', 'full', 'pending', '/test', now, now);
  stmt.run('task2', 'Second task', 'feature', 'full', 'pending', '/test', now, now);

  const tasks = testDb.db.prepare('SELECT * FROM tasks').all();
  expect(tasks).toHaveLength(2);
});
```

### 4. Test Relationships

```typescript
it('should support foreign key relationships', () => {
  // Create task
  testDb.db.prepare(`
    INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('task1', 'Test task', 'feature', 'full', 'pending', '/test', now, now);

  // Create log
  testDb.db.prepare(`
    INSERT INTO task_logs (task_id, timestamp, level, message)
    VALUES (?, ?, ?, ?)
  `).run('task1', now, 'info', 'Task started');

  // Verify relationship
  const logs = testDb.db.prepare('SELECT * FROM task_logs WHERE task_id = ?').all('task1');
  expect(logs).toHaveLength(1);
});
```

### 5. Use Mock Task Helper

```typescript
it('should process task data', () => {
  const task = createMockTask({ status: 'completed' });

  // Insert mock task into database
  testDb.db.prepare(`
    INSERT INTO tasks (
      id, description, workflow, autonomy, status, priority, effort,
      project_path, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.id, task.description, task.workflow, task.autonomy,
    task.status, task.priority, task.effort, task.projectPath,
    task.createdAt.toISOString(), task.updatedAt.toISOString()
  );

  // Test your logic
  const savedTask = testDb.db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
  expect(savedTask.status).toBe('completed');
});
```

## Example Test Files

See these files for complete examples:

- `packages/orchestrator/src/__tests__/test-database-utilities.test.ts` - Comprehensive test of utilities
- `packages/orchestrator/src/__tests__/basic-test-demonstration.test.ts` - Simple demonstration
- `packages/orchestrator/src/store.test.ts` - Real-world usage in TaskStore tests

## Troubleshooting

### Database Not Cleaning Up
Make sure to call `cleanupTestDatabase()` in `afterEach`:

```typescript
afterEach(() => {
  if (testDb) {
    cleanupTestDatabase(testDb);
  }
});
```

### Tables Not Found
Verify the test database was created successfully:

```typescript
beforeEach(async () => {
  testDb = await createTestDatabase();
  expect(testDb.db.open).toBe(true);
});
```

### Foreign Key Violations
Ensure parent records exist before creating child records:

```typescript
// Create task first
testDb.db.prepare('INSERT INTO tasks (...) VALUES (...)').run(...);

// Then create log
testDb.db.prepare('INSERT INTO task_logs (...) VALUES (...)').run(...);
```

### Schema Mismatch
The test utilities mirror the production schema. If you modify TaskStore schema, update `test-utils.ts` accordingly.

## Performance Notes

- In-memory SQLite databases are fast and suitable for unit tests
- Each test gets a fresh database (good isolation, minimal overhead)
- Use integration tests sparingly for complex workflows
- Consider mocking external dependencies in unit tests