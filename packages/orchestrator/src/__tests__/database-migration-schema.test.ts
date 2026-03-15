/**
 * Database Migration and Schema Validation Tests
 *
 * Tests database schema evolution, migration handling, and data integrity
 * during schema changes.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';
import { TaskStore } from '../store';

describe('Database Migration and Schema Tests', () => {
  let testDir: string;
  let dbPath: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'db-migration-test-'));
    dbPath = path.join(testDir, '.apex', 'store.db');
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Schema Creation and Validation', () => {
    it('should create all required tables with correct schema', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      const db = new Database(dbPath);

      // Verify all expected tables exist
      const tables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as Array<{ name: string }>;

      const tableNames = tables.map(t => t.name);
      const requiredTables = [
        'approval_states',
        'audit_log',
        'commands',
        'file_snapshots',
        'gates',
        'idle_tasks',
        'iteration_history',
        'mcp_installations',
        'snapshots',
        'task_artifacts',
        'task_checkpoints',
        'task_dependencies',
        'task_logs',
        'task_templates',
        'tasks',
        'todos',
        'tool_actions',
      ];

      requiredTables.forEach(table => {
        expect(tableNames).toContain(table);
      });

      db.close();
      await store.close();
    });

    it('should have correct primary keys and constraints', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      const db = new Database(dbPath);

      // Check tasks table schema
      const tasksSchema = db.prepare("PRAGMA table_info(tasks)").all() as Array<{
        name: string;
        type: string;
        notnull: number;
        pk: number;
      }>;

      const idColumn = tasksSchema.find(col => col.name === 'id');
      expect(idColumn).toBeDefined();
      expect(idColumn?.pk).toBe(1); // Primary key
      expect(idColumn?.type).toBe('TEXT');

      // Check required NOT NULL columns
      const requiredColumns = ['description', 'workflow', 'autonomy', 'status', 'project_path'];
      requiredColumns.forEach(colName => {
        const column = tasksSchema.find(col => col.name === colName);
        expect(column).toBeDefined();
        expect(column?.notnull).toBe(1);
      });

      db.close();
      await store.close();
    });

    it('should have proper foreign key relationships', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      const db = new Database(dbPath);

      // Check task_logs foreign keys
      const logsForeignKeys = db.prepare("PRAGMA foreign_key_list(task_logs)").all() as Array<{
        table: string;
        from: string;
        to: string;
      }>;

      expect(logsForeignKeys.length).toBeGreaterThan(0);
      const taskFk = logsForeignKeys.find(fk => fk.table === 'tasks');
      expect(taskFk).toBeDefined();
      expect(taskFk?.from).toBe('task_id');
      expect(taskFk?.to).toBe('id');

      // Check task_dependencies foreign keys
      const depsForeignKeys = db.prepare("PRAGMA foreign_key_list(task_dependencies)").all() as Array<{
        table: string;
        from: string;
        to: string;
      }>;

      expect(depsForeignKeys.length).toBe(2); // Should have 2 FKs to tasks table
      depsForeignKeys.forEach(fk => {
        expect(fk.table).toBe('tasks');
        expect(fk.to).toBe('id');
      });

      db.close();
      await store.close();
    });

    it('should have proper indexes for performance', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      const db = new Database(dbPath);

      // Check for indexes on frequently queried columns
      const indexes = db.prepare(`
        SELECT name, sql FROM sqlite_master
        WHERE type='index' AND tbl_name='tasks' AND sql IS NOT NULL
        ORDER BY name
      `).all() as Array<{ name: string; sql: string }>;

      expect(indexes.length).toBeGreaterThan(0);

      // Should have indexes for common query patterns
      const indexSql = indexes.map(idx => idx.sql?.toLowerCase() || '').join(' ');
      expect(indexSql).toContain('status'); // Status-based queries
      expect(indexSql).toContain('priority'); // Priority-based queries

      db.close();
      await store.close();
    });
  });

  describe('Migration Handling', () => {
    it('should handle missing columns by adding them', async () => {
      // Create a minimal database schema (simulating older version)
      await fs.mkdir(path.dirname(dbPath), { recursive: true });

      const db = new Database(dbPath);
      db.exec(`
        CREATE TABLE tasks (
          id TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          workflow TEXT NOT NULL,
          autonomy TEXT NOT NULL,
          status TEXT NOT NULL,
          project_path TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      db.close();

      // Initialize TaskStore, which should apply migrations
      const store = new TaskStore(testDir);
      await store.initialize();

      const migratedDb = new Database(dbPath);
      const schema = migratedDb.prepare("PRAGMA table_info(tasks)").all() as Array<{
        name: string;
      }>;

      const columnNames = schema.map(col => col.name);

      // Should have added missing columns
      expect(columnNames).toContain('priority');
      expect(columnNames).toContain('effort');
      expect(columnNames).toContain('trashed_at');
      expect(columnNames).toContain('archived_at');
      expect(columnNames).toContain('pause_reason');

      migratedDb.close();
      await store.close();
    });

    it('should preserve existing data during migration', async () => {
      // Create database with old schema and insert test data
      await fs.mkdir(path.dirname(dbPath), { recursive: true });

      const db = new Database(dbPath);
      db.exec(`
        CREATE TABLE tasks (
          id TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          workflow TEXT NOT NULL,
          autonomy TEXT NOT NULL,
          status TEXT NOT NULL,
          project_path TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // Insert test task
      const insertStmt = db.prepare(`
        INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const testTask = {
        id: 'migration_test_task',
        description: 'Test task for migration',
        workflow: 'feature',
        autonomy: 'full',
        status: 'pending',
        project_path: testDir,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      insertStmt.run(
        testTask.id,
        testTask.description,
        testTask.workflow,
        testTask.autonomy,
        testTask.status,
        testTask.project_path,
        testTask.created_at,
        testTask.updated_at
      );

      db.close();

      // Initialize TaskStore with migration
      const store = new TaskStore(testDir);
      await store.initialize();

      // Verify task data is preserved
      const retrievedTask = await store.getTask(testTask.id);
      expect(retrievedTask).not.toBeNull();
      expect(retrievedTask?.description).toBe(testTask.description);
      expect(retrievedTask?.workflow).toBe(testTask.workflow);
      expect(retrievedTask?.autonomy).toBe(testTask.autonomy);
      expect(retrievedTask?.status).toBe(testTask.status);

      // New columns should have default values
      expect(retrievedTask?.priority).toBe('normal');
      expect(retrievedTask?.effort).toBe('medium');
      expect(retrievedTask?.retryCount).toBe(0);
      expect(retrievedTask?.maxRetries).toBe(3);

      await store.close();
    });

    it('should handle database without any existing tables', async () => {
      // Create empty database file
      await fs.mkdir(path.dirname(dbPath), { recursive: true });
      await fs.writeFile(dbPath, '');

      const store = new TaskStore(testDir);
      await store.initialize();

      // Should create all tables from scratch
      const db = new Database(dbPath);
      const tables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all() as Array<{ name: string }>;

      expect(tables.length).toBeGreaterThan(10);
      expect(tables.some(t => t.name === 'tasks')).toBe(true);

      db.close();
      await store.close();
    });

    it('should handle corrupted migration gracefully', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      // Manually corrupt a column addition (simulate failed migration)
      const db = new Database(dbPath);

      // Try to create an invalid migration state
      try {
        db.exec("ALTER TABLE tasks ADD COLUMN invalid_column INVALID_TYPE");
      } catch {
        // Expected to fail
      }

      db.close();

      // Should still be able to reinitialize
      const newStore = new TaskStore(testDir);
      await expect(newStore.initialize()).resolves.not.toThrow();
      await newStore.close();
    });
  });

  describe('Schema Validation and Constraints', () => {
    it('should enforce NOT NULL constraints', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      // Try to insert task with missing required fields
      const db = new Database(dbPath);

      const insertStmt = db.prepare(`
        INSERT INTO tasks (id, description) VALUES (?, ?)
      `);

      // Should fail due to missing NOT NULL columns
      expect(() => {
        insertStmt.run('test_id', 'test description');
      }).toThrow();

      db.close();
      await store.close();
    });

    it('should enforce unique constraints', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      const db = new Database(dbPath);

      // Insert a task
      const insertStmt = db.prepare(`
        INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const taskData = [
        'duplicate_id',
        'Test task',
        'feature',
        'full',
        'pending',
        testDir,
        new Date().toISOString(),
        new Date().toISOString(),
      ];

      insertStmt.run(...taskData);

      // Try to insert another task with same ID
      expect(() => {
        insertStmt.run(...taskData);
      }).toThrow(/UNIQUE constraint failed/);

      db.close();
      await store.close();
    });

    it('should enforce foreign key constraints when enabled', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      const db = new Database(dbPath);
      db.exec('PRAGMA foreign_keys = ON');

      // Try to insert log for non-existent task
      const insertLogStmt = db.prepare(`
        INSERT INTO task_logs (task_id, timestamp, level, message)
        VALUES (?, ?, ?, ?)
      `);

      expect(() => {
        insertLogStmt.run('non_existent_task', new Date().toISOString(), 'info', 'test');
      }).toThrow(/FOREIGN KEY constraint failed/);

      db.close();
      await store.close();
    });

    it('should validate data types appropriately', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      const db = new Database(dbPath);

      // SQLite is flexible with types, but let's test some constraints
      const insertStmt = db.prepare(`
        INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at, retry_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Should accept integer for retry_count
      expect(() => {
        insertStmt.run(
          'test_types',
          'Test',
          'feature',
          'full',
          'pending',
          testDir,
          new Date().toISOString(),
          new Date().toISOString(),
          5
        );
      }).not.toThrow();

      db.close();
      await store.close();
    });
  });

  describe('Performance and Optimization', () => {
    it('should maintain acceptable performance with large datasets', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      // Create a large number of tasks
      const batchSize = 1000;
      const tasks = [];

      const startTime = Date.now();

      for (let i = 0; i < batchSize; i++) {
        tasks.push(await store.createTask({
          description: `Performance test task ${i}`,
          workflow: 'feature',
          autonomy: 'full',
          agent: 'developer',
        }));
      }

      const createTime = Date.now() - startTime;
      expect(createTime).toBeLessThan(30000); // Should complete within 30 seconds

      // Test query performance
      const queryStart = Date.now();
      const allTasks = await store.listTasks();
      const queryTime = Date.now() - queryStart;

      expect(allTasks.length).toBe(batchSize);
      expect(queryTime).toBeLessThan(5000); // Should query within 5 seconds

      await store.close();
    });

    it('should handle concurrent database access efficiently', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      // Simulate concurrent operations
      const concurrentOps = Array(50).fill(null).map(async (_, i) => {
        const task = await store.createTask({
          description: `Concurrent task ${i}`,
          workflow: 'feature',
          autonomy: 'full',
          agent: 'developer',
        });

        // Perform some operations on the task
        await store.updateTask(task.id, { status: 'in-progress' });
        await store.addLog(task.id, { level: 'info', message: `Log for task ${i}` });
        await store.updateTask(task.id, { status: 'completed' });

        return task;
      });

      const startTime = Date.now();
      const results = await Promise.all(concurrentOps);
      const totalTime = Date.now() - startTime;

      expect(results.length).toBe(50);
      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds

      await store.close();
    });

    it('should maintain database size within reasonable bounds', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      // Create and then trash many tasks
      const tasks = [];
      for (let i = 0; i < 100; i++) {
        const task = await store.createTask({
          description: `Task to be cleaned up ${i}`,
          workflow: 'feature',
          autonomy: 'full',
          agent: 'developer',
        });
        await store.addLog(task.id, { level: 'info', message: 'Some log data' });
        await store.addArtifact(task.id, { name: 'artifact.txt', type: 'text', content: 'content' });
        tasks.push(task);
      }

      const beforeTrash = await fs.stat(dbPath);

      // Trash and empty
      for (const task of tasks) {
        await store.trashTask(task.id);
      }
      await store.emptyTrash();

      const afterCleanup = await fs.stat(dbPath);

      // Database should not grow significantly after cleanup
      // (allowing for some overhead and WAL files)
      expect(afterCleanup.size).toBeLessThan(beforeTrash.size * 1.5);

      await store.close();
    });
  });
});