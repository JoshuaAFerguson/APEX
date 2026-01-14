/**
 * Comprehensive tests for TaskStore database test utilities.
 * These tests ensure createTestDatabase, cleanupTestDatabase, and createMockTask work correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestDatabase,
  cleanupTestDatabase,
  createMockTask,
  type TestDatabaseContext,
} from '../test-utils';
import type { Task, TaskStatus } from '@apexcli/core';
import Database from 'better-sqlite3';

describe('Task Database Test Utilities', () => {
  let testDb: TestDatabaseContext;

  afterEach(() => {
    if (testDb) {
      cleanupTestDatabase(testDb);
    }
  });

  describe('Database Schema Verification', () => {
    beforeEach(async () => {
      testDb = await createTestDatabase();
    });

    it('should create all required tables from TaskStore schema', async () => {
      const tables = testDb.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
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
      expect(tableNames).toContain('fix_attempts');
      expect(tableNames).toContain('audit_logs');
    });

    it('should create proper table structure for tasks table', async () => {
      const tableInfo = testDb.db.prepare("PRAGMA table_info(tasks)").all() as Array<{
        name: string;
        type: string;
        notnull: number;
        pk: number;
        dflt_value: string | null;
      }>;

      const columns = tableInfo.reduce((acc, col) => {
        acc[col.name] = { type: col.type, notnull: col.notnull === 1, pk: col.pk === 1 };
        return acc;
      }, {} as Record<string, { type: string; notnull: boolean; pk: boolean }>);

      // Primary key
      expect(columns.id.pk).toBe(true);
      expect(columns.id.type).toBe('TEXT');

      // Required fields
      expect(columns.description.notnull).toBe(true);
      expect(columns.workflow.notnull).toBe(true);
      expect(columns.autonomy.notnull).toBe(true);
      expect(columns.status.notnull).toBe(true);
      expect(columns.project_path.notnull).toBe(true);
      expect(columns.created_at.notnull).toBe(true);
      expect(columns.updated_at.notnull).toBe(true);

      // Optional fields
      expect(columns.acceptance_criteria?.notnull || false).toBe(false);
      expect(columns.branch_name?.notnull || false).toBe(false);
      expect(columns.pr_url?.notnull || false).toBe(false);
      expect(columns.completed_at?.notnull || false).toBe(false);
      expect(columns.error?.notnull || false).toBe(false);
    });

    it('should create all required indexes', async () => {
      const indexes = testDb.db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name")
        .all() as { name: string }[];

      const indexNames = indexes.map(i => i.name);

      // Core indexes
      expect(indexNames).toContain('idx_tasks_status');
      expect(indexNames).toContain('idx_task_logs_task_id');
      expect(indexNames).toContain('idx_task_artifacts_task_id');
      expect(indexNames).toContain('idx_gates_task_id');

      // v0.5.0 indexes
      expect(indexNames).toContain('idx_tool_actions_task_id');
      expect(indexNames).toContain('idx_permissions_tool_scope');
      expect(indexNames).toContain('idx_audit_logs_task_id');
    });
  });

  describe('CRUD Operations Testing', () => {
    beforeEach(async () => {
      testDb = await createTestDatabase();
    });

    describe('Tasks Table Operations', () => {
      it('should support inserting and retrieving tasks', async () => {
        const now = new Date().toISOString();
        const taskData = {
          id: 'test_task_001',
          description: 'Test task for database operations',
          workflow: 'feature',
          autonomy: 'full',
          status: 'pending',
          priority: 'normal',
          effort: 'medium',
          project_path: '/test/project',
          created_at: now,
          updated_at: now,
        };

        // Insert task
        const insertStmt = testDb.db.prepare(`
          INSERT INTO tasks (
            id, description, workflow, autonomy, status, priority, effort,
            project_path, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertStmt.run(...Object.values(taskData));

        // Retrieve task
        const selectStmt = testDb.db.prepare('SELECT * FROM tasks WHERE id = ?');
        const retrievedTask = selectStmt.get(taskData.id) as Record<string, unknown>;

        expect(retrievedTask.id).toBe(taskData.id);
        expect(retrievedTask.description).toBe(taskData.description);
        expect(retrievedTask.status).toBe(taskData.status);
      });

      it('should handle task status updates', async () => {
        const task = createMockTask({ id: 'update_test' });
        const now = new Date().toISOString();

        // Insert initial task
        testDb.db.prepare(`
          INSERT INTO tasks (
            id, description, workflow, autonomy, status, project_path, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(task.id, task.description, task.workflow, task.autonomy, task.status, task.projectPath, now, now);

        // Update status
        const updateStmt = testDb.db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?');
        updateStmt.run('in_progress', now, task.id);

        // Verify update
        const updatedTask = testDb.db.prepare('SELECT status FROM tasks WHERE id = ?').get(task.id) as { status: string };
        expect(updatedTask.status).toBe('in_progress');
      });

      it('should handle task completion data', async () => {
        const task = createMockTask({ id: 'completion_test' });
        const now = new Date().toISOString();
        const completedAt = new Date(Date.now() + 5000).toISOString();

        // Insert task
        testDb.db.prepare(`
          INSERT INTO tasks (
            id, description, workflow, autonomy, status, project_path, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(task.id, task.description, task.workflow, task.autonomy, 'pending', task.projectPath, now, now);

        // Complete task
        testDb.db.prepare(`
          UPDATE tasks SET
            status = ?,
            completed_at = ?,
            usage_input_tokens = ?,
            usage_output_tokens = ?,
            usage_total_tokens = ?,
            usage_estimated_cost = ?
          WHERE id = ?
        `).run('completed', completedAt, 1000, 500, 1500, 0.05, task.id);

        // Verify completion data
        const completedTask = testDb.db.prepare(
          'SELECT status, completed_at, usage_input_tokens, usage_total_tokens FROM tasks WHERE id = ?'
        ).get(task.id) as Record<string, unknown>;

        expect(completedTask.status).toBe('completed');
        expect(completedTask.completed_at).toBe(completedAt);
        expect(completedTask.usage_input_tokens).toBe(1000);
        expect(completedTask.usage_total_tokens).toBe(1500);
      });
    });

    describe('Related Tables Operations', () => {
      it('should support task logs with foreign key relationships', async () => {
        const taskId = 'log_test_task';
        const now = new Date().toISOString();

        // Insert parent task
        testDb.db.prepare(`
          INSERT INTO tasks (
            id, description, workflow, autonomy, status, project_path, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(taskId, 'Test task', 'feature', 'full', 'pending', '/test', now, now);

        // Insert task logs
        const logData = [
          { level: 'info', stage: 'planning', message: 'Task started' },
          { level: 'debug', stage: 'implementation', message: 'Creating file' },
          { level: 'error', stage: 'implementation', message: 'File creation failed' },
        ];

        const insertLogStmt = testDb.db.prepare(`
          INSERT INTO task_logs (task_id, timestamp, level, stage, message)
          VALUES (?, ?, ?, ?, ?)
        `);

        for (const log of logData) {
          insertLogStmt.run(taskId, now, log.level, log.stage, log.message);
        }

        // Retrieve logs
        const logs = testDb.db.prepare('SELECT * FROM task_logs WHERE task_id = ? ORDER BY id').all(taskId) as Array<{
          level: string;
          stage: string;
          message: string;
        }>;

        expect(logs).toHaveLength(3);
        expect(logs[0].message).toBe('Task started');
        expect(logs[1].stage).toBe('implementation');
        expect(logs[2].level).toBe('error');
      });

      it('should support task artifacts', async () => {
        const taskId = 'artifact_test_task';
        const now = new Date().toISOString();

        // Insert parent task
        testDb.db.prepare(`
          INSERT INTO tasks (
            id, description, workflow, autonomy, status, project_path, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(taskId, 'Test task', 'feature', 'full', 'pending', '/test', now, now);

        // Insert artifacts
        const artifacts = [
          { name: 'output.txt', type: 'file', path: '/test/output.txt', content: null },
          { name: 'summary', type: 'text', path: null, content: 'Task completed successfully' },
        ];

        const insertArtifactStmt = testDb.db.prepare(`
          INSERT INTO task_artifacts (task_id, name, type, path, content, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const artifact of artifacts) {
          insertArtifactStmt.run(taskId, artifact.name, artifact.type, artifact.path, artifact.content, now);
        }

        // Retrieve artifacts
        const savedArtifacts = testDb.db.prepare(
          'SELECT name, type, path, content FROM task_artifacts WHERE task_id = ?'
        ).all(taskId) as typeof artifacts;

        expect(savedArtifacts).toHaveLength(2);
        expect(savedArtifacts.find(a => a.name === 'output.txt')?.type).toBe('file');
        expect(savedArtifacts.find(a => a.name === 'summary')?.content).toBe('Task completed successfully');
      });

      it('should support todos with proper ordering', async () => {
        const taskId = 'todo_test_task';
        const now = new Date().toISOString();

        // Insert parent task
        testDb.db.prepare(`
          INSERT INTO tasks (
            id, description, workflow, autonomy, status, project_path, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(taskId, 'Test task', 'feature', 'full', 'pending', '/test', now, now);

        // Insert todos with specific ordering
        const todos = [
          { id: 'todo_1', content: 'Plan the implementation', status: 'completed', order: 0 },
          { id: 'todo_2', content: 'Write the code', status: 'in_progress', order: 1 },
          { id: 'todo_3', content: 'Test the implementation', status: 'pending', order: 2 },
        ];

        const insertTodoStmt = testDb.db.prepare(`
          INSERT INTO todos (id, task_id, content, status, active_form, order_index, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const todo of todos) {
          insertTodoStmt.run(
            todo.id,
            taskId,
            todo.content,
            todo.status,
            `${todo.content} (active)`,
            todo.order,
            now,
            now
          );
        }

        // Retrieve todos in order
        const savedTodos = testDb.db.prepare(
          'SELECT content, status, order_index FROM todos WHERE task_id = ? ORDER BY order_index'
        ).all(taskId) as Array<{ content: string; status: string; order_index: number }>;

        expect(savedTodos).toHaveLength(3);
        expect(savedTodos[0].content).toBe('Plan the implementation');
        expect(savedTodos[0].status).toBe('completed');
        expect(savedTodos[1].status).toBe('in_progress');
        expect(savedTodos[2].status).toBe('pending');
      });
    });
  });

  describe('createMockTask Utility', () => {
    it('should create valid mock tasks with all required fields', () => {
      const task = createMockTask();

      // Check required fields
      expect(task.id).toMatch(/^task_\d+_[a-z0-9]+$/);
      expect(task.description).toBeTruthy();
      expect(task.workflow).toBeTruthy();
      expect(task.autonomy).toBeTruthy();
      expect(task.status).toBeTruthy();
      expect(task.projectPath).toBeTruthy();
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);

      // Check default values
      expect(task.description).toBe('Test task');
      expect(task.workflow).toBe('feature');
      expect(task.autonomy).toBe('full');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('normal');
      expect(task.effort).toBe('medium');
      expect(task.retryCount).toBe(0);
      expect(task.maxRetries).toBe(3);
      expect(task.resumeAttempts).toBe(0);

      // Check arrays are initialized
      expect(task.logs).toEqual([]);
      expect(task.artifacts).toEqual([]);
      expect(task.dependsOn).toEqual([]);
      expect(task.blockedBy).toEqual([]);

      // Check usage object
      expect(task.usage).toBeDefined();
      expect(task.usage.inputTokens).toBe(0);
      expect(task.usage.outputTokens).toBe(0);
      expect(task.usage.totalTokens).toBe(0);
      expect(task.usage.estimatedCost).toBe(0);
    });

    it('should allow overriding default values', () => {
      const customTask = createMockTask({
        id: 'custom_test_task',
        description: 'Custom test description',
        status: 'completed',
        priority: 'high',
        effort: 'large',
        retryCount: 2,
        projectPath: '/custom/project',
      });

      expect(customTask.id).toBe('custom_test_task');
      expect(customTask.description).toBe('Custom test description');
      expect(customTask.status).toBe('completed');
      expect(customTask.priority).toBe('high');
      expect(customTask.effort).toBe('large');
      expect(customTask.retryCount).toBe(2);
      expect(customTask.projectPath).toBe('/custom/project');

      // Non-overridden values should still be defaults
      expect(customTask.workflow).toBe('feature');
      expect(customTask.autonomy).toBe('full');
      expect(customTask.maxRetries).toBe(3);
    });

    it('should generate unique IDs for each task', () => {
      const task1 = createMockTask();
      const task2 = createMockTask();
      const task3 = createMockTask();

      expect(task1.id).not.toBe(task2.id);
      expect(task2.id).not.toBe(task3.id);
      expect(task1.id).not.toBe(task3.id);
    });

    it('should support partial task usage overrides', () => {
      const task = createMockTask({
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.03,
          totalCostCents: 3,
          executionTimeMs: 5000,
        },
      });

      expect(task.usage.inputTokens).toBe(1000);
      expect(task.usage.outputTokens).toBe(500);
      expect(task.usage.totalTokens).toBe(1500);
      expect(task.usage.estimatedCost).toBe(0.03);
      expect(task.usage.totalCostCents).toBe(3);
      expect(task.usage.executionTimeMs).toBe(5000);
    });

    it('should support different task statuses', () => {
      const statuses: TaskStatus[] = ['pending', 'in_progress', 'paused', 'completed', 'failed', 'cancelled'];

      for (const status of statuses) {
        const task = createMockTask({ status });
        expect(task.status).toBe(status);
      }
    });
  });

  describe('Database Isolation and Cleanup', () => {
    it('should isolate data between different database instances', async () => {
      const db1 = await createTestDatabase();
      const db2 = await createTestDatabase();

      try {
        const task1 = createMockTask({ id: 'db1_task' });
        const task2 = createMockTask({ id: 'db2_task' });

        // Insert task in db1
        db1.db.prepare(`
          INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          task1.id, task1.description, task1.workflow, task1.autonomy, task1.status, task1.projectPath,
          task1.createdAt.toISOString(), task1.updatedAt.toISOString()
        );

        // Insert task in db2
        db2.db.prepare(`
          INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          task2.id, task2.description, task2.workflow, task2.autonomy, task2.status, task2.projectPath,
          task2.createdAt.toISOString(), task2.updatedAt.toISOString()
        );

        // Verify isolation
        const db1Tasks = db1.db.prepare('SELECT id FROM tasks').all();
        const db2Tasks = db2.db.prepare('SELECT id FROM tasks').all();

        expect(db1Tasks).toHaveLength(1);
        expect(db2Tasks).toHaveLength(1);
        expect((db1Tasks[0] as { id: string }).id).toBe('db1_task');
        expect((db2Tasks[0] as { id: string }).id).toBe('db2_task');

        // Cross-contamination check
        expect(db1.db.prepare('SELECT * FROM tasks WHERE id = ?').get('db2_task')).toBeUndefined();
        expect(db2.db.prepare('SELECT * FROM tasks WHERE id = ?').get('db1_task')).toBeUndefined();
      } finally {
        cleanupTestDatabase(db1);
        cleanupTestDatabase(db2);
      }
    });

    it('should properly close database connections on cleanup', async () => {
      const testDb = await createTestDatabase();

      expect(testDb.db.open).toBe(true);

      cleanupTestDatabase(testDb);

      expect(testDb.db.open).toBe(false);
    });

    it('should handle cleanup gracefully when called multiple times', async () => {
      const testDb = await createTestDatabase();

      cleanupTestDatabase(testDb);
      expect(testDb.db.open).toBe(false);

      // Should not throw when called again
      expect(() => cleanupTestDatabase(testDb)).not.toThrow();
    });

    it('should handle cleanup with null/undefined context', () => {
      // @ts-expect-error - Testing error handling
      expect(() => cleanupTestDatabase(null)).not.toThrow();
      // @ts-expect-error - Testing error handling
      expect(() => cleanupTestDatabase(undefined)).not.toThrow();
    });
  });

  describe('Performance and Stress Testing', () => {
    beforeEach(async () => {
      testDb = await createTestDatabase();
    });

    it('should handle bulk task insertions efficiently', async () => {
      const taskCount = 1000;
      const tasks = Array.from({ length: taskCount }, (_, i) =>
        createMockTask({ id: `bulk_task_${i}` })
      );

      const insertStmt = testDb.db.prepare(`
        INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Use a transaction for better performance
      const insertMany = testDb.db.transaction((tasks: Task[]) => {
        for (const task of tasks) {
          insertStmt.run(
            task.id, task.description, task.workflow, task.autonomy, task.status, task.projectPath,
            task.createdAt.toISOString(), task.updatedAt.toISOString()
          );
        }
      });

      const startTime = Date.now();
      insertMany(tasks);
      const endTime = Date.now();

      // Verify all tasks were inserted
      const count = testDb.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
      expect(count.count).toBe(taskCount);

      // Performance should be reasonable (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should handle complex queries with joins efficiently', async () => {
      const taskId = 'complex_query_test';
      const now = new Date().toISOString();

      // Insert task
      testDb.db.prepare(`
        INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(taskId, 'Test task', 'feature', 'full', 'in_progress', '/test', now, now);

      // Insert related data
      for (let i = 0; i < 10; i++) {
        testDb.db.prepare(`
          INSERT INTO task_logs (task_id, timestamp, level, message)
          VALUES (?, ?, ?, ?)
        `).run(taskId, now, 'info', `Log message ${i}`);

        testDb.db.prepare(`
          INSERT INTO todos (id, task_id, content, status, active_form, order_index, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(`todo_${i}`, taskId, `Todo ${i}`, 'pending', `Working on todo ${i}`, i, now, now);
      }

      // Complex query joining multiple tables
      const result = testDb.db.prepare(`
        SELECT
          t.id,
          t.description,
          t.status,
          COUNT(DISTINCT tl.id) as log_count,
          COUNT(DISTINCT td.id) as todo_count
        FROM tasks t
        LEFT JOIN task_logs tl ON t.id = tl.task_id
        LEFT JOIN todos td ON t.id = td.task_id
        WHERE t.id = ?
        GROUP BY t.id, t.description, t.status
      `).get(taskId) as { id: string; description: string; status: string; log_count: number; todo_count: number };

      expect(result.id).toBe(taskId);
      expect(result.log_count).toBe(10);
      expect(result.todo_count).toBe(10);
    });
  });
});