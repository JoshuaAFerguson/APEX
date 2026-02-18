import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestDatabase,
  cleanupTestDatabase,
  TestDatabaseContext,
} from './db';
import Database = require('better-sqlite3');

describe('SQLite Test Database Utilities', () => {
  let testDb: TestDatabaseContext | null = null;

  afterEach(() => {
    if (testDb) {
      cleanupTestDatabase(testDb);
      testDb = null;
    }
  });

  describe('createTestDatabase', () => {
    it('should create an in-memory database with all required tables', async () => {
      testDb = await createTestDatabase();

      expect(testDb).toBeDefined();
      expect(testDb.db).toBeDefined();
      expect(testDb.cleanup).toBeDefined();
      expect(typeof testDb.cleanup).toBe('function');
    });

    it('should initialize database with proper schema', async () => {
      testDb = await createTestDatabase();

      // Check that all main tables exist
      const tables = testDb.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table'
        ORDER BY name
      `).all() as { name: string }[];

      const tableNames = tables.map(t => t.name);

      const expectedTables = [
        'approval_states',
        'audit_logs',
        'commands',
        'file_snapshots',
        'fix_attempts',
        'gates',
        'idle_tasks',
        'mcp_installations',
        'mcp_marketplace',
        'mcp_servers',
        'permissions',
        'snapshots',
        'task_artifacts',
        'task_checkpoints',
        'task_dependencies',
        'task_interactions',
        'task_iterations',
        'task_logs',
        'task_templates',
        'tasks',
        'thought_captures',
        'todos',
        'tool_actions',
        'workspace_info'
      ];

      expectedTables.forEach(tableName => {
        expect(tableNames).toContain(tableName);
      });
    });

    it('should set proper SQLite pragmas', async () => {
      testDb = await createTestDatabase();

      // Check journal mode
      const journalMode = testDb.db.pragma('journal_mode', { simple: true });
      expect(journalMode).toBe('wal');

      // Check foreign keys setting
      const foreignKeys = testDb.db.pragma('foreign_keys', { simple: true });
      expect(foreignKeys).toBe(0); // OFF
    });

    it('should create database that supports basic operations', async () => {
      testDb = await createTestDatabase();

      // Test inserting a basic task record
      const insertStmt = testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, priority, effort,
          project_path, created_at, updated_at,
          usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const taskId = 'test_task_001';
      const now = new Date().toISOString();

      expect(() => {
        insertStmt.run(
          taskId,
          'Test task description',
          'feature',
          'full',
          'pending',
          'normal',
          'medium',
          '/test/project',
          now,
          now,
          0,
          0,
          0,
          0.0
        );
      }).not.toThrow();

      // Verify the record was inserted
      const selectStmt = testDb.db.prepare('SELECT * FROM tasks WHERE id = ?');
      const result = selectStmt.get(taskId);

      expect(result).toBeDefined();
      expect((result as any).id).toBe(taskId);
      expect((result as any).description).toBe('Test task description');
    });

    it('should create multiple independent databases', async () => {
      const db1 = await createTestDatabase();
      const db2 = await createTestDatabase();

      // Insert different data in each database
      db1.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, priority, effort,
          project_path, created_at, updated_at,
          usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'task_1',
        'Task in DB1',
        'feature',
        'full',
        'pending',
        'normal',
        'medium',
        '/test/project1',
        new Date().toISOString(),
        new Date().toISOString(),
        0,
        0,
        0,
        0.0
      );

      db2.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, priority, effort,
          project_path, created_at, updated_at,
          usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'task_2',
        'Task in DB2',
        'feature',
        'full',
        'pending',
        'normal',
        'medium',
        '/test/project2',
        new Date().toISOString(),
        new Date().toISOString(),
        0,
        0,
        0,
        0.0
      );

      // Verify databases are independent
      const db1Tasks = db1.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
      const db2Tasks = db2.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };

      expect(db1Tasks.count).toBe(1);
      expect(db2Tasks.count).toBe(1);

      const db1Task = db1.db.prepare('SELECT description FROM tasks WHERE id = ?').get('task_1') as { description: string };
      const db2Task = db2.db.prepare('SELECT description FROM tasks WHERE id = ?').get('task_2') as { description: string };

      expect(db1Task.description).toBe('Task in DB1');
      expect(db2Task.description).toBe('Task in DB2');

      // Cleanup both databases
      cleanupTestDatabase(db1);
      cleanupTestDatabase(db2);
    });
  });

  describe('cleanupTestDatabase', () => {
    it('should close database connection safely', async () => {
      testDb = await createTestDatabase();

      expect(testDb.db.open).toBe(true);

      cleanupTestDatabase(testDb);

      expect(testDb.db.open).toBe(false);
      testDb = null; // Prevent double cleanup in afterEach
    });

    it('should be safe to call multiple times', async () => {
      testDb = await createTestDatabase();

      cleanupTestDatabase(testDb);
      expect(() => cleanupTestDatabase(testDb)).not.toThrow();
      testDb = null; // Prevent double cleanup in afterEach
    });

    it('should handle null/undefined context gracefully', () => {
      expect(() => cleanupTestDatabase(null as any)).not.toThrow();
      expect(() => cleanupTestDatabase(undefined as any)).not.toThrow();
    });

    it('should handle context with null database gracefully', () => {
      const context = { db: null as any, cleanup: () => {} };
      expect(() => cleanupTestDatabase(context)).not.toThrow();
    });
  });

  describe('TestDatabaseContext interface', () => {
    it('should provide cleanup function that works correctly', async () => {
      testDb = await createTestDatabase();

      expect(testDb.db.open).toBe(true);

      testDb.cleanup();

      expect(testDb.db.open).toBe(false);
      testDb = null; // Prevent double cleanup in afterEach
    });

    it('should be safe to call cleanup multiple times', async () => {
      testDb = await createTestDatabase();

      testDb.cleanup();
      expect(() => testDb!.cleanup()).not.toThrow();
      testDb = null; // Prevent double cleanup in afterEach
    });
  });

  describe('Schema completeness', () => {
    it('should have all required indexes', async () => {
      testDb = await createTestDatabase();

      const indexes = testDb.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as { name: string }[];

      const indexNames = indexes.map(i => i.name);

      // Check for some key indexes that should exist
      const expectedIndexes = [
        'idx_tasks_status',
        'idx_task_logs_task_id',
        'idx_task_artifacts_task_id',
        'idx_gates_task_id',
        'idx_todos_task_id',
        'idx_audit_logs_task_id'
      ];

      expectedIndexes.forEach(indexName => {
        expect(indexNames).toContain(indexName);
      });
    });

    it('should have proper column constraints', async () => {
      testDb = await createTestDatabase();

      // Test that required tables have expected structure
      const tasksInfo = testDb.db.pragma('table_info(tasks)') as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: any;
        pk: number;
      }>;

      // Check key columns exist with expected properties
      const idColumn = tasksInfo.find(col => col.name === 'id');
      const statusColumn = tasksInfo.find(col => col.name === 'status');
      const descColumn = tasksInfo.find(col => col.name === 'description');

      expect(idColumn).toBeDefined();
      expect(idColumn!.pk).toBe(1); // Primary key
      expect(idColumn!.notnull).toBe(1); // Not null

      expect(statusColumn).toBeDefined();
      expect(statusColumn!.notnull).toBe(1); // Not null

      expect(descColumn).toBeDefined();
      expect(descColumn!.notnull).toBe(1); // Not null
    });

    it('should handle foreign key constraints appropriately', async () => {
      testDb = await createTestDatabase();

      // Insert a task first
      const taskId = 'test_task_fk';
      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, priority, effort,
          project_path, created_at, updated_at,
          usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        taskId,
        'Test task for FK',
        'feature',
        'full',
        'pending',
        'normal',
        'medium',
        '/test/project',
        new Date().toISOString(),
        new Date().toISOString(),
        0,
        0,
        0,
        0.0
      );

      // Insert a task log that references the task
      expect(() => {
        testDb!.db.prepare(`
          INSERT INTO task_logs (task_id, timestamp, level, message)
          VALUES (?, ?, ?, ?)
        `).run(taskId, new Date().toISOString(), 'info', 'Test log message');
      }).not.toThrow();

      // Verify the log was inserted
      const logCount = testDb.db.prepare('SELECT COUNT(*) as count FROM task_logs WHERE task_id = ?').get(taskId) as { count: number };
      expect(logCount.count).toBe(1);
    });
  });

  describe('createTaskStoreWithTestDb', () => {
    it('should create a TaskStore instance using the test database', async () => {
      testDb = await createTestDatabase();

      // Dynamically import to avoid circular dependencies during testing
      const { createTaskStoreWithTestDb } = await import('./db');
      const taskStore = createTaskStoreWithTestDb(testDb);

      expect(taskStore).toBeDefined();
      expect(taskStore.getDatabase).toBeDefined();

      // Test that the TaskStore can perform basic operations
      const database = taskStore.getDatabase();
      expect(database).toBe(testDb.db);

      // Test a basic database operation through TaskStore
      const result = database.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
      expect(result.count).toBe(0);
    });

    it('should allow TaskStore operations with the test database', async () => {
      testDb = await createTestDatabase();

      const { createTaskStoreWithTestDb } = await import('./db');
      const taskStore = createTaskStoreWithTestDb(testDb);

      // Insert a test task directly via SQL first
      const taskId = 'test_taskstore_integration';
      const now = new Date().toISOString();

      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, priority, effort,
          project_path, created_at, updated_at,
          usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        taskId,
        'TaskStore integration test',
        'feature',
        'full',
        'pending',
        'normal',
        'medium',
        '/test/project',
        now,
        now,
        0,
        0,
        0,
        0.0
      );

      // Now verify TaskStore can access it through the shared database
      const database = taskStore.getDatabase();
      const task = database.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;

      expect(task).toBeDefined();
      expect(task.description).toBe('TaskStore integration test');
    });

    it('should use custom project path when provided', async () => {
      testDb = await createTestDatabase();

      const { createTaskStoreWithTestDb } = await import('./db');
      const customPath = '/custom/test/path';
      const taskStore = createTaskStoreWithTestDb(testDb, customPath);

      expect(taskStore).toBeDefined();
      // The project path should be set but we can't easily verify it without accessing private properties
      // This test mainly ensures the parameter is accepted without errors
    });
  });

  describe('Integration patterns', () => {
    it('should work with typical TaskStore-style operations', async () => {
      testDb = await createTestDatabase();

      // Simulate typical TaskStore operations
      const taskId = 'integration_test_task';
      const now = new Date().toISOString();

      // Create task
      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, priority, effort,
          project_path, created_at, updated_at,
          usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        taskId,
        'Integration test task',
        'feature',
        'full',
        'pending',
        'normal',
        'medium',
        '/test/project',
        now,
        now,
        0,
        0,
        0,
        0.0
      );

      // Add a log
      testDb.db.prepare(`
        INSERT INTO task_logs (task_id, timestamp, level, message)
        VALUES (?, ?, ?, ?)
      `).run(taskId, now, 'info', 'Task created');

      // Add an artifact
      testDb.db.prepare(`
        INSERT INTO task_artifacts (task_id, name, type, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(taskId, 'test_output.txt', 'text', 'Test content', now);

      // Update status
      testDb.db.prepare(`
        UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?
      `).run('running', now, taskId);

      // Verify all operations worked
      const task = testDb.db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
      expect(task.status).toBe('running');

      const logs = testDb.db.prepare('SELECT COUNT(*) as count FROM task_logs WHERE task_id = ?').get(taskId) as { count: number };
      expect(logs.count).toBe(1);

      const artifacts = testDb.db.prepare('SELECT COUNT(*) as count FROM task_artifacts WHERE task_id = ?').get(taskId) as { count: number };
      expect(artifacts.count).toBe(1);
    });

    it('should support complex queries across multiple tables', async () => {
      testDb = await createTestDatabase();

      // Set up test data across multiple tables
      const taskId = 'complex_query_task';
      const now = new Date().toISOString();

      // Insert task
      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, priority, effort,
          project_path, created_at, updated_at,
          usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        taskId,
        'Complex query test',
        'feature',
        'full',
        'completed',
        'high',
        'large',
        '/test/project',
        now,
        now,
        100,
        200,
        300,
        1.5
      );

      // Insert logs
      testDb.db.prepare(`
        INSERT INTO task_logs (task_id, timestamp, level, stage, agent, message)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(taskId, now, 'info', 'planning', 'planner', 'Planning started');

      testDb.db.prepare(`
        INSERT INTO task_logs (task_id, timestamp, level, stage, agent, message)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(taskId, now, 'info', 'implementation', 'developer', 'Implementation completed');

      // Complex join query
      const result = testDb.db.prepare(`
        SELECT
          t.id,
          t.description,
          t.status,
          t.priority,
          COUNT(tl.id) as log_count,
          GROUP_CONCAT(DISTINCT tl.stage) as stages,
          GROUP_CONCAT(DISTINCT tl.agent) as agents
        FROM tasks t
        LEFT JOIN task_logs tl ON t.id = tl.task_id
        WHERE t.id = ?
        GROUP BY t.id
      `).get(taskId) as any;

      expect(result).toBeDefined();
      expect(result.id).toBe(taskId);
      expect(result.status).toBe('completed');
      expect(result.priority).toBe('high');
      expect(result.log_count).toBe(2);
      expect(result.stages).toContain('planning');
      expect(result.stages).toContain('implementation');
      expect(result.agents).toContain('planner');
      expect(result.agents).toContain('developer');
    });
  });
});