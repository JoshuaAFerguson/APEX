/**
 * Basic test demonstration to verify test configuration and in-memory database utilities work.
 * This serves as an example and validation that the test infrastructure is properly set up.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestDatabase,
  cleanupTestDatabase,
  createMockTask,
  type TestDatabaseContext,
} from '../test-utils';

describe('Basic Test Configuration Demonstration', () => {
  let testDb: TestDatabaseContext;

  beforeEach(async () => {
    testDb = await createTestDatabase();
  });

  afterEach(() => {
    cleanupTestDatabase(testDb);
  });

  describe('Vitest configuration', () => {
    it('should be properly configured and working', () => {
      // Basic assertion to verify test framework works
      expect(true).toBe(true);
      expect(typeof describe).toBe('function');
      expect(typeof it).toBe('function');
      expect(typeof expect).toBe('function');
    });

    it('should have access to Vitest globals', () => {
      expect(beforeEach).toBeDefined();
      expect(afterEach).toBeDefined();
    });
  });

  describe('In-memory SQLite database utilities', () => {
    it('should create and cleanup database successfully', () => {
      expect(testDb).toBeDefined();
      expect(testDb.db).toBeDefined();
      expect(testDb.db.open).toBe(true);
      expect(typeof testDb.cleanup).toBe('function');
    });

    it('should have all required tables created', () => {
      const tables = testDb.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as { name: string }[];

      const tableNames = tables.map((t) => t.name);

      // Core tables
      expect(tableNames).toContain('tasks');
      expect(tableNames).toContain('task_logs');
      expect(tableNames).toContain('task_artifacts');

      // Additional tables from latest schema
      expect(tableNames).toContain('todos');
      expect(tableNames).toContain('approval_states');
      expect(tableNames).toContain('audit_logs');
    });

    it('should support basic database operations', () => {
      // Test INSERT
      const now = new Date().toISOString();
      const taskId = 'demo_task_123';

      const insertStmt = testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, priority, effort,
          project_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      expect(() => {
        insertStmt.run(
          taskId,
          'Demo task for testing',
          'feature',
          'full',
          'pending',
          'normal',
          'medium',
          '/demo/path',
          now,
          now
        );
      }).not.toThrow();

      // Test SELECT
      const task = testDb.db
        .prepare('SELECT * FROM tasks WHERE id = ?')
        .get(taskId) as Record<string, unknown>;

      expect(task).toBeDefined();
      expect(task.id).toBe(taskId);
      expect(task.description).toBe('Demo task for testing');

      // Test COUNT
      const count = testDb.db
        .prepare('SELECT COUNT(*) as count FROM tasks')
        .get() as { count: number };

      expect(count.count).toBe(1);
    });

    it('should support foreign key relationships', () => {
      const now = new Date().toISOString();
      const taskId = 'demo_task_456';

      // Create task
      testDb.db
        .prepare(`
          INSERT INTO tasks (
            id, description, workflow, autonomy, status, project_path, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(taskId, 'Parent task', 'feature', 'full', 'pending', '/demo', now, now);

      // Create related log entry
      testDb.db
        .prepare(`
          INSERT INTO task_logs (task_id, timestamp, level, message)
          VALUES (?, ?, ?, ?)
        `)
        .run(taskId, now, 'info', 'Task created for demo');

      // Verify relationship
      const logs = testDb.db
        .prepare('SELECT * FROM task_logs WHERE task_id = ?')
        .all(taskId) as { message: string }[];

      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Task created for demo');
    });
  });

  describe('Mock task utility', () => {
    it('should create valid mock tasks with defaults', () => {
      const task = createMockTask();

      expect(task.id).toMatch(/^task_\d+_[a-z0-9]+$/);
      expect(task.description).toBe('Test task');
      expect(task.workflow).toBe('feature');
      expect(task.autonomy).toBe('full');
      expect(task.status).toBe('pending');
      expect(task.usage).toBeDefined();
      expect(task.logs).toBeInstanceOf(Array);
      expect(task.artifacts).toBeInstanceOf(Array);
    });

    it('should allow overriding default values', () => {
      const task = createMockTask({
        id: 'custom_demo_task',
        description: 'Custom demo task',
        status: 'in_progress',
        priority: 'high',
      });

      expect(task.id).toBe('custom_demo_task');
      expect(task.description).toBe('Custom demo task');
      expect(task.status).toBe('in_progress');
      expect(task.priority).toBe('high');

      // Verify defaults are still applied for non-overridden fields
      expect(task.workflow).toBe('feature');
      expect(task.autonomy).toBe('full');
    });

    it('should create unique task IDs on each call', () => {
      const task1 = createMockTask();
      const task2 = createMockTask();

      expect(task1.id).not.toBe(task2.id);
    });
  });

  describe('Test isolation', () => {
    it('should start with empty database in each test', () => {
      const taskCount = testDb.db
        .prepare('SELECT COUNT(*) as count FROM tasks')
        .get() as { count: number };

      expect(taskCount.count).toBe(0);

      // Add a task
      const now = new Date().toISOString();
      testDb.db
        .prepare(`
          INSERT INTO tasks (
            id, description, workflow, autonomy, status, project_path, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run('isolation_test', 'Isolation test', 'feature', 'full', 'pending', '/test', now, now);

      const newCount = testDb.db
        .prepare('SELECT COUNT(*) as count FROM tasks')
        .get() as { count: number };

      expect(newCount.count).toBe(1);
    });

    it('should not see data from previous test', () => {
      // This test should not see the task added in the previous test
      const taskCount = testDb.db
        .prepare('SELECT COUNT(*) as count FROM tasks')
        .get() as { count: number };

      expect(taskCount.count).toBe(0);
    });
  });
});