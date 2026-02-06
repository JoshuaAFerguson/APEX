/**
 * Tests for the test-utils/db.ts module to verify the specific database utilities
 * function correctly and satisfy the acceptance criteria.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, cleanupTestDatabase, type TestDatabaseContext } from '../test-utils/db';

describe('Test Utils DB Module', () => {
  let testDb: TestDatabaseContext;

  afterEach(() => {
    if (testDb) {
      cleanupTestDatabase(testDb);
    }
  });

  describe('createTestDatabase', () => {
    it('should create an in-memory SQLite database', async () => {
      testDb = await createTestDatabase();

      expect(testDb).toBeDefined();
      expect(testDb.db).toBeDefined();
      expect(testDb.db.open).toBe(true);
      expect(testDb.cleanup).toBeInstanceOf(Function);
    });

    it('should initialize the TaskStore schema', async () => {
      testDb = await createTestDatabase();

      // Verify core tables exist
      const tables = testDb.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all() as { name: string }[];

      const tableNames = tables.map(t => t.name);

      // Core tables
      expect(tableNames).toContain('tasks');
      expect(tableNames).toContain('task_logs');
      expect(tableNames).toContain('task_artifacts');
      expect(tableNames).toContain('gates');
      expect(tableNames).toContain('commands');
      expect(tableNames).toContain('task_dependencies');
      expect(tableNames).toContain('task_checkpoints');

      // v0.4.0 tables
      expect(tableNames).toContain('thought_captures');
      expect(tableNames).toContain('task_interactions');
      expect(tableNames).toContain('workspace_info');
      expect(tableNames).toContain('idle_tasks');
      expect(tableNames).toContain('task_iterations');
      expect(tableNames).toContain('task_templates');
      expect(tableNames).toContain('todos');

      // v0.5.0 tables
      expect(tableNames).toContain('approval_states');
      expect(tableNames).toContain('file_snapshots');
      expect(tableNames).toContain('tool_actions');
      expect(tableNames).toContain('snapshots');
      expect(tableNames).toContain('permissions');
      expect(tableNames).toContain('mcp_marketplace');
      expect(tableNames).toContain('mcp_servers');
      expect(tableNames).toContain('mcp_installations');
      expect(tableNames).toContain('fix_attempts');
      expect(tableNames).toContain('audit_logs');
    });

    it('should create database indexes', async () => {
      testDb = await createTestDatabase();

      const indexes = testDb.db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name")
        .all() as { name: string }[];

      const indexNames = indexes.map(i => i.name);

      // Verify key indexes exist
      expect(indexNames).toContain('idx_tasks_status');
      expect(indexNames).toContain('idx_task_logs_task_id');
      expect(indexNames).toContain('idx_todos_task_id');
      expect(indexNames).toContain('idx_approval_states_task_id');
      expect(indexNames).toContain('idx_permissions_tool_scope');
      expect(indexNames).toContain('idx_audit_logs_task_id');
    });

    it('should support basic SQL operations', async () => {
      testDb = await createTestDatabase();

      const now = new Date().toISOString();
      const taskId = 'test_task_sql_ops';

      // INSERT
      const insertStmt = testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, priority, effort,
          project_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertStmt.run(
        taskId,
        'Test task for SQL operations',
        'feature',
        'full',
        'pending',
        'normal',
        'medium',
        '/test/path',
        now,
        now
      );

      // SELECT
      const selectStmt = testDb.db.prepare('SELECT * FROM tasks WHERE id = ?');
      const task = selectStmt.get(taskId) as Record<string, unknown>;

      expect(task).toBeDefined();
      expect(task.id).toBe(taskId);
      expect(task.description).toBe('Test task for SQL operations');
      expect(task.status).toBe('pending');

      // UPDATE
      const updateStmt = testDb.db.prepare('UPDATE tasks SET status = ? WHERE id = ?');
      updateStmt.run('in_progress', taskId);

      const updatedTask = selectStmt.get(taskId) as Record<string, unknown>;
      expect(updatedTask.status).toBe('in_progress');
    });

    it('should enforce foreign key constraints', async () => {
      testDb = await createTestDatabase();

      // Try to insert task log for non-existent task (should fail)
      expect(() => {
        testDb.db.prepare(`
          INSERT INTO task_logs (task_id, timestamp, level, message)
          VALUES (?, ?, ?, ?)
        `).run('nonexistent_task', new Date().toISOString(), 'info', 'Test message');
      }).toThrow();
    });
  });

  describe('cleanupTestDatabase', () => {
    it('should close the database connection', async () => {
      testDb = await createTestDatabase();
      expect(testDb.db.open).toBe(true);

      cleanupTestDatabase(testDb);
      expect(testDb.db.open).toBe(false);
    });

    it('should be safe to call multiple times', async () => {
      testDb = await createTestDatabase();

      cleanupTestDatabase(testDb);
      expect(testDb.db.open).toBe(false);

      // Should not throw
      expect(() => cleanupTestDatabase(testDb)).not.toThrow();
    });

    it('should handle null/undefined context gracefully', () => {
      // @ts-expect-error - Testing null handling
      expect(() => cleanupTestDatabase(null)).not.toThrow();
      // @ts-expect-error - Testing undefined handling
      expect(() => cleanupTestDatabase(undefined)).not.toThrow();
    });
  });

  describe('cleanup function on context', () => {
    it('should work as an alternative to cleanupTestDatabase', async () => {
      testDb = await createTestDatabase();
      expect(testDb.db.open).toBe(true);

      testDb.cleanup();
      expect(testDb.db.open).toBe(false);
    });
  });

  describe('Data isolation between instances', () => {
    it('should isolate data between database instances', async () => {
      const testDb1 = await createTestDatabase();
      const testDb2 = await createTestDatabase();

      const now = new Date().toISOString();

      // Add data to first database
      testDb1.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, project_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('task_1', 'First DB task', 'feature', 'full', 'pending', '/test', now, now);

      // Second database should be empty
      const tasks = testDb2.db.prepare('SELECT * FROM tasks').all();
      expect(tasks).toHaveLength(0);

      // Clean up both
      cleanupTestDatabase(testDb1);
      cleanupTestDatabase(testDb2);
    });
  });
});