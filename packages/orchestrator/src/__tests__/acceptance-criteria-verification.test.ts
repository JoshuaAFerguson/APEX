/**
 * Acceptance Criteria Verification Test
 *
 * This test verifies that the SQLite test database setup/teardown utility module
 * meets all the acceptance criteria:
 *
 * ✅ (1) Create an in-memory or temp file SQLite database
 * ✅ (2) Initialize the TaskStore schema
 * ✅ (3) Teardown/close the database cleanly
 * ✅ (4) Work with better-sqlite3
 * ✅ (5) Be importable by test files
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, cleanupTestDatabase, type TestDatabaseContext } from '../test-utils/db';

describe('Acceptance Criteria Verification', () => {
  let testDb: TestDatabaseContext;

  afterEach(() => {
    if (testDb) {
      cleanupTestDatabase(testDb);
    }
  });

  describe('Criterion 1: Create an in-memory SQLite database', () => {
    it('should create an in-memory database using better-sqlite3', async () => {
      testDb = await createTestDatabase();

      // Verify it's a database instance
      expect(testDb.db).toBeDefined();
      expect(testDb.db.open).toBe(true);

      // Verify it's in-memory (no file path)
      expect(testDb.db.name).toBe(':memory:');

      // Verify it's using better-sqlite3
      expect(testDb.db.constructor.name).toBe('Database');
    });

    it('should be isolated between instances', async () => {
      const db1 = await createTestDatabase();
      const db2 = await createTestDatabase();

      // Add data to first database
      db1.db.prepare(`
        INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
        VALUES ('test1', 'Test 1', 'feature', 'full', 'pending', '/test', datetime('now'), datetime('now'))
      `).run();

      // Second database should be empty
      const tasks1 = db1.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
      const tasks2 = db2.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };

      expect(tasks1.count).toBe(1);
      expect(tasks2.count).toBe(0);

      // Clean up
      cleanupTestDatabase(db1);
      cleanupTestDatabase(db2);
    });
  });

  describe('Criterion 2: Initialize the TaskStore schema', () => {
    beforeEach(async () => {
      testDb = await createTestDatabase();
    });

    it('should initialize all core TaskStore tables', () => {
      const tables = testDb.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];

      const tableNames = tables.map(t => t.name);

      // Core tables that must exist
      const requiredTables = [
        'tasks',
        'task_logs',
        'task_artifacts',
        'gates',
        'commands',
        'task_dependencies',
        'task_checkpoints'
      ];

      for (const table of requiredTables) {
        expect(tableNames).toContain(table);
      }
    });

    it('should initialize v0.4.0 tables', () => {
      const tables = testDb.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];

      const tableNames = tables.map(t => t.name);

      const v040Tables = [
        'thought_captures',
        'task_interactions',
        'workspace_info',
        'idle_tasks',
        'task_iterations',
        'task_templates',
        'todos'
      ];

      for (const table of v040Tables) {
        expect(tableNames).toContain(table);
      }
    });

    it('should initialize v0.5.0 tables', () => {
      const tables = testDb.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];

      const tableNames = tables.map(t => t.name);

      const v050Tables = [
        'approval_states',
        'file_snapshots',
        'tool_actions',
        'snapshots',
        'permissions',
        'mcp_marketplace',
        'mcp_servers',
        'mcp_installations',
        'fix_attempts',
        'audit_logs'
      ];

      for (const table of v050Tables) {
        expect(tableNames).toContain(table);
      }
    });

    it('should create proper indexes for performance', () => {
      const indexes = testDb.db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
        .all() as { name: string }[];

      // Should have performance indexes
      expect(indexes.length).toBeGreaterThan(0);

      const indexNames = indexes.map(i => i.name);

      // Verify key performance indexes exist
      expect(indexNames).toContain('idx_tasks_status');
      expect(indexNames).toContain('idx_task_logs_task_id');
    });

    it('should enforce foreign key constraints', () => {
      // Try to insert a task log for non-existent task
      expect(() => {
        testDb.db.prepare(`
          INSERT INTO task_logs (task_id, timestamp, level, message)
          VALUES ('nonexistent', datetime('now'), 'info', 'test')
        `).run();
      }).toThrow();
    });

    it('should support TaskStore-compatible operations', () => {
      const now = new Date().toISOString();

      // Insert a complete task record
      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, priority, effort,
          project_path, created_at, updated_at,
          usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'test_task',
        'Test task description',
        'feature',
        'full',
        'pending',
        'normal',
        'medium',
        '/test/path',
        now,
        now,
        0,
        0,
        0,
        0
      );

      // Verify the task was inserted
      const task = testDb.db.prepare('SELECT * FROM tasks WHERE id = ?').get('test_task') as any;
      expect(task.id).toBe('test_task');
      expect(task.description).toBe('Test task description');
      expect(task.status).toBe('pending');

      // Add a log entry
      testDb.db.prepare(`
        INSERT INTO task_logs (task_id, timestamp, level, message)
        VALUES (?, ?, ?, ?)
      `).run('test_task', now, 'info', 'Task started');

      // Verify the log was added
      const logs = testDb.db.prepare('SELECT * FROM task_logs WHERE task_id = ?').all('test_task');
      expect(logs).toHaveLength(1);
    });
  });

  describe('Criterion 3: Teardown/close the database cleanly', () => {
    it('should close database connection with cleanupTestDatabase', async () => {
      testDb = await createTestDatabase();
      expect(testDb.db.open).toBe(true);

      cleanupTestDatabase(testDb);
      expect(testDb.db.open).toBe(false);
    });

    it('should close database connection with context.cleanup', async () => {
      testDb = await createTestDatabase();
      expect(testDb.db.open).toBe(true);

      testDb.cleanup();
      expect(testDb.db.open).toBe(false);
    });

    it('should handle multiple cleanup calls gracefully', async () => {
      testDb = await createTestDatabase();

      cleanupTestDatabase(testDb);
      expect(testDb.db.open).toBe(false);

      // Should not throw
      expect(() => cleanupTestDatabase(testDb)).not.toThrow();
    });

    it('should handle null/undefined contexts gracefully', () => {
      // @ts-expect-error - Testing null handling
      expect(() => cleanupTestDatabase(null)).not.toThrow();
      // @ts-expect-error - Testing undefined handling
      expect(() => cleanupTestDatabase(undefined)).not.toThrow();
    });
  });

  describe('Criterion 4: Work with better-sqlite3', () => {
    beforeEach(async () => {
      testDb = await createTestDatabase();
    });

    it('should use better-sqlite3 Database class', () => {
      expect(testDb.db.constructor.name).toBe('Database');
    });

    it('should support better-sqlite3 prepare/run pattern', () => {
      const stmt = testDb.db.prepare(`
        INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      expect(typeof stmt.run).toBe('function');

      const result = stmt.run(
        'test_better_sqlite3',
        'Test better-sqlite3 compatibility',
        'feature',
        'full',
        'pending',
        '/test',
        new Date().toISOString(),
        new Date().toISOString()
      );

      expect(result.changes).toBe(1);
      expect(typeof result.lastInsertRowid).toBe('number');
    });

    it('should support better-sqlite3 transactions', () => {
      const insertTask = testDb.db.prepare(`
        INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = testDb.db.transaction(() => {
        const now = new Date().toISOString();
        insertTask.run('task1', 'Task 1', 'feature', 'full', 'pending', '/test', now, now);
        insertTask.run('task2', 'Task 2', 'feature', 'full', 'pending', '/test', now, now);
      });

      transaction();

      const count = testDb.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
      expect(count.count).toBe(2);
    });
  });

  describe('Criterion 5: Be importable by test files', () => {
    it('should be importable from test-utils/db path', () => {
      // This test passing means the import worked
      expect(createTestDatabase).toBeDefined();
      expect(cleanupTestDatabase).toBeDefined();
      expect(typeof createTestDatabase).toBe('function');
      expect(typeof cleanupTestDatabase).toBe('function');
    });

    it('should export TypeScript types for test context', () => {
      // TypeScript compilation will verify the type exists
      const context: TestDatabaseContext | null = null;
      expect(context).toBeNull(); // Just a simple assertion to use the type
    });

    it('should be importable via test-utils index for convenience', async () => {
      // Import from the index file
      const indexUtils = await import('../test-utils/index');

      expect(indexUtils.createTestDatabase).toBeDefined();
      expect(indexUtils.cleanupTestDatabase).toBeDefined();
      expect(typeof indexUtils.createTestDatabase).toBe('function');
      expect(typeof indexUtils.cleanupTestDatabase).toBe('function');
    });

    it('should maintain backward compatibility with existing imports', async () => {
      // Import from the main test-utils file (backward compatibility)
      const mainUtils = await import('../test-utils');

      expect(mainUtils.createTestDatabase).toBeDefined();
      expect(mainUtils.cleanupTestDatabase).toBeDefined();
      expect(typeof mainUtils.createTestDatabase).toBe('function');
      expect(typeof mainUtils.cleanupTestDatabase).toBe('function');
    });
  });

  describe('Complete Integration Test', () => {
    it('should handle a complete test workflow', async () => {
      // 1. Create database
      testDb = await createTestDatabase();
      expect(testDb.db.open).toBe(true);

      // 2. Use the database for testing
      const now = new Date().toISOString();

      // Create a task
      testDb.db.prepare(`
        INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('integration_test', 'Integration test task', 'feature', 'full', 'pending', '/test', now, now);

      // Add logs
      testDb.db.prepare(`
        INSERT INTO task_logs (task_id, timestamp, level, message)
        VALUES (?, ?, ?, ?)
      `).run('integration_test', now, 'info', 'Task created');

      // Add todos
      testDb.db.prepare(`
        INSERT INTO todos (id, task_id, content, status, active_form, order_index, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('todo_1', 'integration_test', 'Complete feature', 'pending', 'Completing feature', 0, now, now);

      // Verify everything was created
      const task = testDb.db.prepare('SELECT * FROM tasks WHERE id = ?').get('integration_test') as any;
      const logs = testDb.db.prepare('SELECT * FROM task_logs WHERE task_id = ?').all('integration_test');
      const todos = testDb.db.prepare('SELECT * FROM todos WHERE task_id = ?').all('integration_test');

      expect(task).toBeTruthy();
      expect(logs).toHaveLength(1);
      expect(todos).toHaveLength(1);

      // 3. Clean up
      cleanupTestDatabase(testDb);
      expect(testDb.db.open).toBe(false);
    });
  });
});