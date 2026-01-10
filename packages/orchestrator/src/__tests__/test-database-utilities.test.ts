/**
 * Tests for in-memory SQLite test database utilities.
 * Demonstrates that createTestDatabase() and cleanupTestDatabase() work correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestDatabase,
  cleanupTestDatabase,
  createMockTask,
  type TestDatabaseContext,
} from '../test-utils';

describe('Test Database Utilities', () => {
  let testDb: TestDatabaseContext;

  describe('createTestDatabase', () => {
    afterEach(() => {
      if (testDb) {
        cleanupTestDatabase(testDb);
      }
    });

    it('should create an in-memory database with the TaskStore schema', async () => {
      testDb = await createTestDatabase();

      expect(testDb).toBeDefined();
      expect(testDb.db).toBeDefined();
      expect(testDb.db.open).toBe(true);
      expect(testDb.cleanup).toBeInstanceOf(Function);
    });

    it('should create all expected tables', async () => {
      testDb = await createTestDatabase();

      // Query the sqlite_master table to get all table names
      const tables = testDb.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as { name: string }[];

      const tableNames = tables.map((t) => t.name);

      // Verify core tables exist
      expect(tableNames).toContain('tasks');
      expect(tableNames).toContain('task_logs');
      expect(tableNames).toContain('task_artifacts');
      expect(tableNames).toContain('gates');
      expect(tableNames).toContain('commands');
      expect(tableNames).toContain('task_dependencies');
      expect(tableNames).toContain('task_checkpoints');

      // Verify v0.4.0 tables
      expect(tableNames).toContain('thought_captures');
      expect(tableNames).toContain('task_interactions');
      expect(tableNames).toContain('workspace_info');
      expect(tableNames).toContain('idle_tasks');
      expect(tableNames).toContain('task_iterations');
      expect(tableNames).toContain('task_templates');
      expect(tableNames).toContain('todos');

      // Verify v0.5.0 tables
      expect(tableNames).toContain('approval_states');
      expect(tableNames).toContain('file_snapshots');
      expect(tableNames).toContain('tool_actions');
      expect(tableNames).toContain('snapshots');
      expect(tableNames).toContain('permissions');
      expect(tableNames).toContain('mcp_marketplace');
      expect(tableNames).toContain('mcp_servers');
      expect(tableNames).toContain('fix_attempts');
      expect(tableNames).toContain('audit_logs');
    });

    it('should create indexes for the tables', async () => {
      testDb = await createTestDatabase();

      // Query for indexes
      const indexes = testDb.db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name")
        .all() as { name: string }[];

      const indexNames = indexes.map((i) => i.name);

      // Verify key indexes exist
      expect(indexNames).toContain('idx_tasks_status');
      expect(indexNames).toContain('idx_task_logs_task_id');
      expect(indexNames).toContain('idx_todos_task_id');
      expect(indexNames).toContain('idx_approval_states_task_id');
    });

    it('should support basic CRUD operations on tasks table', async () => {
      testDb = await createTestDatabase();

      const now = new Date().toISOString();
      const taskId = 'test_task_123';

      // INSERT
      const insertStmt = testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, priority, effort,
          project_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertStmt.run(
        taskId,
        'Test task description',
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
      expect(task.description).toBe('Test task description');
      expect(task.status).toBe('pending');

      // UPDATE
      const updateStmt = testDb.db.prepare('UPDATE tasks SET status = ? WHERE id = ?');
      updateStmt.run('in_progress', taskId);

      const updatedTask = selectStmt.get(taskId) as Record<string, unknown>;
      expect(updatedTask.status).toBe('in_progress');

      // DELETE
      const deleteStmt = testDb.db.prepare('DELETE FROM tasks WHERE id = ?');
      deleteStmt.run(taskId);

      const deletedTask = selectStmt.get(taskId);
      expect(deletedTask).toBeUndefined();
    });

    it('should support task_logs relationship with foreign key', async () => {
      testDb = await createTestDatabase();

      const now = new Date().toISOString();
      const taskId = 'test_task_456';

      // Create a task first
      testDb.db
        .prepare(`
          INSERT INTO tasks (
            id, description, workflow, autonomy, status, project_path, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(taskId, 'Test task', 'feature', 'full', 'pending', '/test', now, now);

      // Insert a log for the task
      testDb.db
        .prepare(`
          INSERT INTO task_logs (task_id, timestamp, level, message)
          VALUES (?, ?, ?, ?)
        `)
        .run(taskId, now, 'info', 'Test log message');

      // Query logs for the task
      const logs = testDb.db
        .prepare('SELECT * FROM task_logs WHERE task_id = ?')
        .all(taskId) as { message: string }[];

      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test log message');
    });

    it('should isolate data between test database instances', async () => {
      // Create first database and add data
      const testDb1 = await createTestDatabase();
      const now = new Date().toISOString();

      testDb1.db
        .prepare(`
          INSERT INTO tasks (
            id, description, workflow, autonomy, status, project_path, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run('task_1', 'First DB task', 'feature', 'full', 'pending', '/test', now, now);

      // Create second database
      const testDb2 = await createTestDatabase();

      // Second database should be empty
      const tasks = testDb2.db.prepare('SELECT * FROM tasks').all();
      expect(tasks).toHaveLength(0);

      // Clean up both
      cleanupTestDatabase(testDb1);
      cleanupTestDatabase(testDb2);
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

  describe('createMockTask helper', () => {
    it('should create a valid task with default values', () => {
      const task = createMockTask();

      expect(task.id).toMatch(/^task_\d+_[a-z0-9]+$/);
      expect(task.description).toBe('Test task');
      expect(task.workflow).toBe('feature');
      expect(task.autonomy).toBe('full');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('normal');
      expect(task.effort).toBe('medium');
      expect(task.projectPath).toBe('/test/project');
      expect(task.retryCount).toBe(0);
      expect(task.maxRetries).toBe(3);
      expect(task.logs).toEqual([]);
      expect(task.artifacts).toEqual([]);
      expect(task.usage).toBeDefined();
      expect(task.usage.totalTokens).toBe(0);
    });

    it('should allow overriding default values', () => {
      const task = createMockTask({
        id: 'custom_task_id',
        description: 'Custom description',
        status: 'completed',
        priority: 'high',
      });

      expect(task.id).toBe('custom_task_id');
      expect(task.description).toBe('Custom description');
      expect(task.status).toBe('completed');
      expect(task.priority).toBe('high');
      // Default values should still be present for non-overridden fields
      expect(task.workflow).toBe('feature');
    });

    it('should create unique task IDs on each call', () => {
      const task1 = createMockTask();
      const task2 = createMockTask();

      expect(task1.id).not.toBe(task2.id);
    });
  });

  describe('Integration: Full test workflow', () => {
    beforeEach(async () => {
      testDb = await createTestDatabase();
    });

    afterEach(() => {
      cleanupTestDatabase(testDb);
    });

    it('should support a complete task lifecycle', async () => {
      const now = new Date().toISOString();
      const task = createMockTask({ id: 'lifecycle_task' });

      // Create task
      testDb.db
        .prepare(`
          INSERT INTO tasks (
            id, description, workflow, autonomy, status, priority, effort,
            project_path, created_at, updated_at,
            usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          task.id,
          task.description,
          task.workflow,
          task.autonomy,
          task.status,
          task.priority,
          task.effort,
          task.projectPath,
          now,
          now,
          task.usage.inputTokens,
          task.usage.outputTokens,
          task.usage.totalTokens,
          task.usage.estimatedCost
        );

      // Add log
      testDb.db
        .prepare(`
          INSERT INTO task_logs (task_id, timestamp, level, stage, message)
          VALUES (?, ?, ?, ?, ?)
        `)
        .run(task.id, now, 'info', 'planning', 'Task started');

      // Add todo
      testDb.db
        .prepare(`
          INSERT INTO todos (id, task_id, content, status, active_form, order_index, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run('todo_1', task.id, 'Implement feature', 'pending', 'Implementing feature', 0, now, now);

      // Update status
      testDb.db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('in_progress', task.id);

      // Verify the complete state
      const savedTask = testDb.db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id) as Record<
        string,
        unknown
      >;
      const logs = testDb.db.prepare('SELECT * FROM task_logs WHERE task_id = ?').all(task.id);
      const todos = testDb.db.prepare('SELECT * FROM todos WHERE task_id = ?').all(task.id);

      expect(savedTask.status).toBe('in_progress');
      expect(logs).toHaveLength(1);
      expect(todos).toHaveLength(1);
    });
  });
});
