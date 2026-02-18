/**
 * Tests for database fixtures and isolation patterns.
 * Validates that test database utilities provide proper isolation and fixture management.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestDatabase,
  cleanupTestDatabase,
  createTestTaskStore,
  seedTaskScenario,
  createMockTask,
  type TestDatabaseContext,
  type TestTaskStoreContext,
} from '../test-utils.js';

describe('Database Fixtures and Isolation', () => {
  describe('Test Isolation Guarantees', () => {
    let testDb1: TestDatabaseContext;
    let testDb2: TestDatabaseContext;
    let testDb3: TestDatabaseContext;

    afterEach(() => {
      if (testDb1) cleanupTestDatabase(testDb1);
      if (testDb2) cleanupTestDatabase(testDb2);
      if (testDb3) cleanupTestDatabase(testDb3);
    });

    it('should provide complete isolation between test databases', async () => {
      testDb1 = await createTestDatabase();
      testDb2 = await createTestDatabase();
      testDb3 = await createTestDatabase();

      // Each database should start empty
      const initialTasks1 = testDb1.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
      const initialTasks2 = testDb2.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
      const initialTasks3 = testDb3.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };

      expect(initialTasks1.count).toBe(0);
      expect(initialTasks2.count).toBe(0);
      expect(initialTasks3.count).toBe(0);

      // Add different data to each database
      const now = new Date().toISOString();

      // DB1: Add 5 tasks
      const insertStmt1 = testDb1.db.prepare(`
        INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (let i = 0; i < 5; i++) {
        insertStmt1.run(`db1_task_${i}`, `DB1 Task ${i}`, 'feature', 'full', 'pending', '/db1', now, now);
      }

      // DB2: Add 3 tasks with different data
      const insertStmt2 = testDb2.db.prepare(`
        INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (let i = 0; i < 3; i++) {
        insertStmt2.run(`db2_task_${i}`, `DB2 Task ${i}`, 'bugfix', 'manual', 'running', '/db2', now, now);
      }

      // DB3: Add 7 tasks
      const insertStmt3 = testDb3.db.prepare(`
        INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (let i = 0; i < 7; i++) {
        insertStmt3.run(`db3_task_${i}`, `DB3 Task ${i}`, 'hotfix', 'supervised', 'completed', '/db3', now, now);
      }

      // Verify isolation
      const finalTasks1 = testDb1.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
      const finalTasks2 = testDb2.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
      const finalTasks3 = testDb3.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };

      expect(finalTasks1.count).toBe(5);
      expect(finalTasks2.count).toBe(3);
      expect(finalTasks3.count).toBe(7);

      // Verify data contents are completely isolated
      const db1Tasks = testDb1.db.prepare('SELECT id, workflow, status FROM tasks ORDER BY id').all();
      const db2Tasks = testDb2.db.prepare('SELECT id, workflow, status FROM tasks ORDER BY id').all();
      const db3Tasks = testDb3.db.prepare('SELECT id, workflow, status FROM tasks ORDER BY id').all();

      // DB1 should only have its tasks
      expect(db1Tasks.every((t: any) => t.id.startsWith('db1_'))).toBe(true);
      expect(db1Tasks.every((t: any) => t.workflow === 'feature')).toBe(true);
      expect(db1Tasks.every((t: any) => t.status === 'pending')).toBe(true);

      // DB2 should only have its tasks
      expect(db2Tasks.every((t: any) => t.id.startsWith('db2_'))).toBe(true);
      expect(db2Tasks.every((t: any) => t.workflow === 'bugfix')).toBe(true);
      expect(db2Tasks.every((t: any) => t.status === 'running')).toBe(true);

      // DB3 should only have its tasks
      expect(db3Tasks.every((t: any) => t.id.startsWith('db3_'))).toBe(true);
      expect(db3Tasks.every((t: any) => t.workflow === 'hotfix')).toBe(true);
      expect(db3Tasks.every((t: any) => t.status === 'completed')).toBe(true);
    });

    it('should maintain isolation during concurrent database operations', async () => {
      testDb1 = await createTestDatabase();
      testDb2 = await createTestDatabase();

      // Simulate concurrent test execution
      const concurrentOperations = [
        // First test scenario
        Promise.resolve().then(async () => {
          const now = new Date().toISOString();
          // Create complex data in DB1
          testDb1.db.transaction(() => {
            const taskStmt = testDb1.db.prepare(`
              INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const logStmt = testDb1.db.prepare(`
              INSERT INTO task_logs (task_id, timestamp, level, message)
              VALUES (?, ?, ?, ?)
            `);
            const todoStmt = testDb1.db.prepare(`
              INSERT INTO todos (id, task_id, content, status, active_form, order_index, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (let i = 0; i < 10; i++) {
              const taskId = `concurrent_task_${i}`;
              taskStmt.run(taskId, `Concurrent Task ${i}`, 'feature', 'full', 'running', '/test1', now, now);
              logStmt.run(taskId, now, 'info', `Log for task ${i}`);
              todoStmt.run(`todo_${i}`, taskId, `Todo ${i}`, 'pending', `Working on todo ${i}`, i, now, now);
            }
          })();
        }),

        // Second test scenario
        Promise.resolve().then(async () => {
          const now = new Date().toISOString();
          // Create different complex data in DB2
          testDb2.db.transaction(() => {
            const taskStmt = testDb2.db.prepare(`
              INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const artifactStmt = testDb2.db.prepare(`
              INSERT INTO task_artifacts (task_id, name, type, path, content, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `);

            for (let i = 0; i < 15; i++) {
              const taskId = `other_task_${i}`;
              taskStmt.run(taskId, `Other Task ${i}`, 'bugfix', 'manual', 'pending', '/test2', now, now);
              artifactStmt.run(taskId, `artifact_${i}.txt`, 'output', `/tmp/artifact_${i}.txt`, `Content ${i}`, now);
            }
          })();
        }),
      ];

      await Promise.all(concurrentOperations);

      // Verify the results are properly isolated
      const db1Results = testDb1.db.prepare(`
        SELECT
          t.id,
          COUNT(DISTINCT l.id) as log_count,
          COUNT(DISTINCT td.id) as todo_count
        FROM tasks t
        LEFT JOIN task_logs l ON t.id = l.task_id
        LEFT JOIN todos td ON t.id = td.task_id
        WHERE t.id LIKE 'concurrent_task_%'
        GROUP BY t.id
        ORDER BY t.id
      `).all();

      const db2Results = testDb2.db.prepare(`
        SELECT
          t.id,
          COUNT(DISTINCT a.id) as artifact_count
        FROM tasks t
        LEFT JOIN task_artifacts a ON t.id = a.task_id
        WHERE t.id LIKE 'other_task_%'
        GROUP BY t.id
        ORDER BY t.id
      `).all();

      expect(db1Results).toHaveLength(10);
      expect(db2Results).toHaveLength(15);

      // Each task in DB1 should have 1 log and 1 todo
      db1Results.forEach((result: any) => {
        expect(result.log_count).toBe(1);
        expect(result.todo_count).toBe(1);
      });

      // Each task in DB2 should have 1 artifact
      db2Results.forEach((result: any) => {
        expect(result.artifact_count).toBe(1);
      });
    });

    it('should handle transaction rollbacks in isolation', async () => {
      testDb1 = await createTestDatabase();
      testDb2 = await createTestDatabase();

      const now = new Date().toISOString();

      // Successful transaction in DB1
      testDb1.db.transaction(() => {
        testDb1.db
          .prepare('INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run('success_task', 'Success Task', 'feature', 'full', 'completed', '/test', now, now);
      })();

      // Failed transaction in DB2 (should rollback)
      expect(() => {
        testDb2.db.transaction(() => {
          testDb2.db
            .prepare('INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run('fail_task_1', 'Fail Task 1', 'feature', 'full', 'pending', '/test', now, now);

          // This should cause a foreign key constraint violation
          testDb2.db
            .prepare('INSERT INTO task_logs (task_id, timestamp, level, message) VALUES (?, ?, ?, ?)')
            .run('nonexistent_task', now, 'info', 'This should fail');
        })();
      }).toThrow();

      // Verify DB1 has the successful task
      const db1Tasks = testDb1.db.prepare('SELECT * FROM tasks').all();
      expect(db1Tasks).toHaveLength(1);
      expect((db1Tasks[0] as any).id).toBe('success_task');

      // Verify DB2 has no tasks (transaction rolled back)
      const db2Tasks = testDb2.db.prepare('SELECT * FROM tasks').all();
      expect(db2Tasks).toHaveLength(0);
    });
  });

  describe('TaskStore Fixture Management', () => {
    let ctx1: TestTaskStoreContext;
    let ctx2: TestTaskStoreContext;

    afterEach(async () => {
      if (ctx1) await ctx1.cleanup();
      if (ctx2) await ctx2.cleanup();
    });

    it('should provide isolated TaskStore instances', async () => {
      ctx1 = await createTestTaskStore();
      ctx2 = await createTestTaskStore();

      expect(ctx1.store).not.toBe(ctx2.store);
      expect(ctx1.tempPath).not.toBe(ctx2.tempPath);

      // Seed different scenarios in each store
      const mixedTasks = await seedTaskScenario(ctx1.store, 'mixed-statuses');
      const chainTasks = await seedTaskScenario(ctx2.store, 'dependency-chain');

      expect(mixedTasks).toHaveLength(6);
      expect(chainTasks).toHaveLength(3);

      // Verify isolation
      const store1Tasks = await ctx1.store.getAllTasks();
      const store2Tasks = await ctx2.store.getAllTasks();

      expect(store1Tasks).toHaveLength(6);
      expect(store2Tasks).toHaveLength(3);

      // TaskIDs should be completely different
      const store1Ids = new Set(store1Tasks.map(t => t.id));
      const store2Ids = new Set(store2Tasks.map(t => t.id));
      const intersection = new Set([...store1Ids].filter(id => store2Ids.has(id)));
      expect(intersection.size).toBe(0);
    });

    it('should support complex fixture scenarios without interference', async () => {
      ctx1 = await createTestTaskStore();
      ctx2 = await createTestTaskStore();

      // Create the same scenario type in both stores
      const scenario1Tasks = await seedTaskScenario(ctx1.store, 'subtask-tree');
      const scenario2Tasks = await seedTaskScenario(ctx2.store, 'subtask-tree');

      // Both should have same structure but different data
      expect(scenario1Tasks).toHaveLength(4);
      expect(scenario2Tasks).toHaveLength(4);

      const [parent1] = scenario1Tasks;
      const [parent2] = scenario2Tasks;

      expect(parent1.id).not.toBe(parent2.id);
      expect(parent1.subtaskIds).toHaveLength(3);
      expect(parent2.subtaskIds).toHaveLength(3);

      // Subtask IDs should be completely different
      const subtask1Ids = new Set(parent1.subtaskIds);
      const subtask2Ids = new Set(parent2.subtaskIds);
      const idIntersection = new Set([...subtask1Ids].filter(id => subtask2Ids.has(id)));
      expect(idIntersection.size).toBe(0);

      // Verify data integrity within each store
      for (const subtaskId of parent1.subtaskIds!) {
        const subtask = await ctx1.store.getTask(subtaskId);
        expect(subtask).toBeDefined();
      }

      for (const subtaskId of parent2.subtaskIds!) {
        const subtask = await ctx2.store.getTask(subtaskId);
        expect(subtask).toBeDefined();
      }

      // Cross-store queries should return null
      for (const subtaskId of parent1.subtaskIds!) {
        const subtask = await ctx2.store.getTask(subtaskId);
        expect(subtask).toBeNull();
      }

      for (const subtaskId of parent2.subtaskIds!) {
        const subtask = await ctx1.store.getTask(subtaskId);
        expect(subtask).toBeNull();
      }
    });

    it('should handle fixture cleanup without affecting other stores', async () => {
      ctx1 = await createTestTaskStore();
      ctx2 = await createTestTaskStore();

      // Seed both stores
      await seedTaskScenario(ctx1.store, 'mixed-statuses');
      await seedTaskScenario(ctx2.store, 'retry-exhausted');

      // Verify both stores have data
      const store1TasksBefore = await ctx1.store.getAllTasks();
      const store2TasksBefore = await ctx2.store.getAllTasks();
      expect(store1TasksBefore).toHaveLength(6);
      expect(store2TasksBefore).toHaveLength(1);

      // Clean up only store1
      await ctx1.cleanup();
      ctx1 = null as any; // Prevent cleanup in afterEach

      // Store2 should still have its data
      const store2TasksAfter = await ctx2.store.getAllTasks();
      expect(store2TasksAfter).toHaveLength(1);
      expect(store2TasksAfter[0].id).toBe(store2TasksBefore[0].id);

      // Store1 should be closed
      // (We can't easily test this without accessing private state)
    });
  });

  describe('Data Fixtures Quality and Consistency', () => {
    let testDb: TestDatabaseContext;

    beforeEach(async () => {
      testDb = await createTestDatabase();
    });

    afterEach(() => {
      cleanupTestDatabase(testDb);
    });

    it('should create fixtures with realistic and consistent data', () => {
      const tasks = Array.from({ length: 50 }, () => createMockTask());

      // Test data consistency
      tasks.forEach(task => {
        // ID format consistency
        expect(task.id).toMatch(/^task_\d+_[a-z0-9]+$/);

        // Date consistency
        expect(task.createdAt).toBeInstanceOf(Date);
        expect(task.updatedAt).toBeInstanceOf(Date);
        expect(task.updatedAt.getTime()).toBeGreaterThanOrEqual(task.createdAt.getTime());

        // Enum validation
        expect(['pending', 'running', 'completed', 'failed', 'paused', 'cancelled']).toContain(task.status);
        expect(['feature', 'bugfix', 'hotfix', 'refactor', 'docs']).toContain(task.workflow);
        expect(['manual', 'supervised', 'assisted', 'full']).toContain(task.autonomy);
        expect(['low', 'normal', 'high', 'urgent']).toContain(task.priority);
        expect(['low', 'medium', 'high']).toContain(task.effort);

        // Usage data structure
        expect(task.usage).toBeDefined();
        expect(typeof task.usage.inputTokens).toBe('number');
        expect(typeof task.usage.outputTokens).toBe('number');
        expect(typeof task.usage.totalTokens).toBe('number');
        expect(typeof task.usage.estimatedCost).toBe('number');
        expect(task.usage.inputTokens).toBeGreaterThanOrEqual(0);
        expect(task.usage.outputTokens).toBeGreaterThanOrEqual(0);
        expect(task.usage.totalTokens).toBeGreaterThanOrEqual(0);
        expect(task.usage.estimatedCost).toBeGreaterThanOrEqual(0);

        // Array fields should be initialized
        expect(Array.isArray(task.logs)).toBe(true);
        expect(Array.isArray(task.artifacts)).toBe(true);
        expect(Array.isArray(task.dependsOn)).toBe(true);
        expect(Array.isArray(task.blockedBy)).toBe(true);

        // Numeric constraints
        expect(task.retryCount).toBeGreaterThanOrEqual(0);
        expect(task.maxRetries).toBeGreaterThanOrEqual(task.retryCount);
        expect(task.resumeAttempts).toBeGreaterThanOrEqual(0);
      });

      // Uniqueness validation
      const ids = tasks.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(tasks.length);

      // Timestamp distribution (should be different due to timing)
      const timestamps = tasks.map(t => t.createdAt.getTime());
      const uniqueTimestamps = new Set(timestamps);
      // Most timestamps should be unique (allowing for some duplicates due to fast generation)
      expect(uniqueTimestamps.size).toBeGreaterThan(tasks.length * 0.8);
    });

    it('should support all table relationships in fixture data', async () => {
      const now = new Date().toISOString();

      // Create a task with full relational data
      const taskId = 'fixture_test_task';

      testDb.db.transaction(() => {
        // Main task
        testDb.db
          .prepare(`
            INSERT INTO tasks (
              id, description, workflow, autonomy, status, project_path, created_at, updated_at,
              usage_input_tokens, usage_output_tokens, usage_total_tokens
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(taskId, 'Fixture test task', 'feature', 'full', 'running', '/test', now, now, 1000, 500, 1500);

        // Related data across all tables
        testDb.db
          .prepare('INSERT INTO task_logs (task_id, timestamp, level, stage, message) VALUES (?, ?, ?, ?, ?)')
          .run(taskId, now, 'info', 'development', 'Task started');

        testDb.db
          .prepare('INSERT INTO task_artifacts (task_id, name, type, content, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(taskId, 'test.ts', 'code', 'export function test() {}', now);

        testDb.db
          .prepare('INSERT INTO todos (id, task_id, content, status, active_form, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run('todo1', taskId, 'Write tests', 'in_progress', 'Writing tests', 0, now, now);

        testDb.db
          .prepare('INSERT INTO approval_states (id, task_id, gate_name, status, requested_at) VALUES (?, ?, ?, ?, ?)')
          .run('approval1', taskId, 'code-review', 'pending', now);

        testDb.db
          .prepare('INSERT INTO thought_captures (id, content, priority, task_id, created_at, status) VALUES (?, ?, ?, ?, ?, ?)')
          .run('thought1', 'Need to add more tests', 'medium', taskId, now, 'captured');
      })();

      // Verify all relationships exist and are consistent
      const fullTaskData = testDb.db.prepare(`
        SELECT
          t.id,
          t.status,
          COUNT(DISTINCT l.id) as log_count,
          COUNT(DISTINCT a.id) as artifact_count,
          COUNT(DISTINCT td.id) as todo_count,
          COUNT(DISTINCT ap.id) as approval_count,
          COUNT(DISTINCT th.id) as thought_count
        FROM tasks t
        LEFT JOIN task_logs l ON t.id = l.task_id
        LEFT JOIN task_artifacts a ON t.id = a.task_id
        LEFT JOIN todos td ON t.id = td.task_id
        LEFT JOIN approval_states ap ON t.id = ap.task_id
        LEFT JOIN thought_captures th ON t.id = th.task_id
        WHERE t.id = ?
        GROUP BY t.id
      `).get(taskId) as any;

      expect(fullTaskData).toBeDefined();
      expect(fullTaskData.log_count).toBe(1);
      expect(fullTaskData.artifact_count).toBe(1);
      expect(fullTaskData.todo_count).toBe(1);
      expect(fullTaskData.approval_count).toBe(1);
      expect(fullTaskData.thought_count).toBe(1);
    });

    it('should provide fixtures that survive database operations', async () => {
      // Create complex fixture data
      const taskId = 'persistence_test_task';
      const now = new Date().toISOString();

      testDb.db.transaction(() => {
        // Create task with complex state
        testDb.db
          .prepare(`
            INSERT INTO tasks (
              id, description, workflow, autonomy, status, project_path, created_at, updated_at,
              retry_count, max_retries, usage_total_tokens, error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(taskId, 'Persistence test', 'feature', 'full', 'failed', '/test', now, now, 2, 3, 5000, 'Test error');

        // Add multiple logs
        const logStmt = testDb.db.prepare('INSERT INTO task_logs (task_id, timestamp, level, message) VALUES (?, ?, ?, ?)');
        for (let i = 0; i < 5; i++) {
          logStmt.run(taskId, now, 'info', `Log message ${i}`);
        }

        // Add multiple todos
        const todoStmt = testDb.db.prepare('INSERT INTO todos (id, task_id, content, status, active_form, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        for (let i = 0; i < 3; i++) {
          todoStmt.run(`todo_${i}`, taskId, `Todo ${i}`, 'completed', `Completed todo ${i}`, i, now, now);
        }
      })();

      // Perform various database operations
      // 1. Update task status
      testDb.db.prepare('UPDATE tasks SET status = ?, retry_count = ? WHERE id = ?').run('running', 3, taskId);

      // 2. Add more logs
      testDb.db
        .prepare('INSERT INTO task_logs (task_id, timestamp, level, message) VALUES (?, ?, ?, ?)')
        .run(taskId, now, 'warn', 'Retrying after failure');

      // 3. Update todos
      testDb.db
        .prepare('UPDATE todos SET status = ? WHERE task_id = ? AND content = ?')
        .run('in_progress', taskId, 'Todo 2');

      // 4. Add audit log
      testDb.db
        .prepare('INSERT INTO audit_logs (id, task_id, event_type, severity, timestamp, actor, message, success) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run('audit1', taskId, 'task_retry', 'info', now, 'system', 'Task retry initiated', 1);

      // Verify data integrity after operations
      const finalState = testDb.db.prepare(`
        SELECT
          t.*,
          COUNT(DISTINCT l.id) as log_count,
          COUNT(DISTINCT td.id) as todo_count,
          COUNT(DISTINCT al.id) as audit_count
        FROM tasks t
        LEFT JOIN task_logs l ON t.id = l.task_id
        LEFT JOIN todos td ON t.id = td.task_id
        LEFT JOIN audit_logs al ON t.id = al.task_id
        WHERE t.id = ?
        GROUP BY t.id
      `).get(taskId) as any;

      expect(finalState).toBeDefined();
      expect(finalState.status).toBe('running');
      expect(finalState.retry_count).toBe(3);
      expect(finalState.log_count).toBe(6); // 5 original + 1 new
      expect(finalState.todo_count).toBe(3);
      expect(finalState.audit_count).toBe(1);

      // Verify specific data changes
      const updatedTodo = testDb.db.prepare('SELECT status FROM todos WHERE task_id = ? AND content = ?').get(taskId, 'Todo 2') as any;
      expect(updatedTodo.status).toBe('in_progress');
    });
  });
});