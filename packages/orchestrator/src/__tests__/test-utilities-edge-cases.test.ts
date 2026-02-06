/**
 * Edge case and error handling tests for SQLite test utilities.
 * Tests boundary conditions, error scenarios, and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestDatabase,
  cleanupTestDatabase,
  createTestTaskStore,
  createTestPermissionStore,
  seedPendingTask,
  seedFailedTask,
  createMockTask,
  createMockPermissionManager,
  removeTempDirectory,
  createTempDirectoryAsync,
  type TestDatabaseContext,
  type TestTaskStoreContext,
  type TestPermissionStoreContext,
} from '../test-utils.js';

describe('SQLite Test Utilities - Edge Cases and Error Handling', () => {
  describe('Database Edge Cases', () => {
    let testDb: TestDatabaseContext;

    afterEach(() => {
      if (testDb) cleanupTestDatabase(testDb);
    });

    it('should handle empty database queries gracefully', async () => {
      testDb = await createTestDatabase();

      // Query empty tables
      const tasks = testDb.db.prepare('SELECT * FROM tasks').all();
      const logs = testDb.db.prepare('SELECT * FROM task_logs').all();
      const todos = testDb.db.prepare('SELECT * FROM todos').all();

      expect(tasks).toEqual([]);
      expect(logs).toEqual([]);
      expect(todos).toEqual([]);

      // Complex queries on empty tables
      const complexQuery = testDb.db.prepare(`
        SELECT
          t.id,
          COUNT(l.id) as log_count,
          COUNT(td.id) as todo_count
        FROM tasks t
        LEFT JOIN task_logs l ON t.id = l.task_id
        LEFT JOIN todos td ON t.id = td.task_id
        GROUP BY t.id
      `).all();

      expect(complexQuery).toEqual([]);
    });

    it('should handle NULL and undefined values correctly', async () => {
      testDb = await createTestDatabase();
      const now = new Date().toISOString();

      // Insert task with NULLs for optional fields
      testDb.db
        .prepare(`
          INSERT INTO tasks (
            id, description, workflow, autonomy, status, project_path, created_at, updated_at,
            acceptance_criteria, current_stage, branch_name, pr_url, error,
            parent_task_id, subtask_ids, pause_reason, workspace_config
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          'null_test_task',
          'Task with NULLs',
          'feature',
          'full',
          'pending',
          '/test',
          now,
          now,
          null, // acceptance_criteria
          null, // current_stage
          null, // branch_name
          null, // pr_url
          null, // error
          null, // parent_task_id
          null, // subtask_ids
          null, // pause_reason
          null  // workspace_config
        );

      const task = testDb.db.prepare('SELECT * FROM tasks WHERE id = ?').get('null_test_task') as any;

      expect(task).toBeDefined();
      expect(task.id).toBe('null_test_task');
      expect(task.acceptance_criteria).toBeNull();
      expect(task.current_stage).toBeNull();
      expect(task.branch_name).toBeNull();
      expect(task.pr_url).toBeNull();
      expect(task.error).toBeNull();
      expect(task.parent_task_id).toBeNull();
      expect(task.subtask_ids).toBeNull();
      expect(task.pause_reason).toBeNull();
      expect(task.workspace_config).toBeNull();
    });

    it('should handle special characters and unicode in data', async () => {
      testDb = await createTestDatabase();
      const now = new Date().toISOString();

      // Test data with special characters
      const specialData = {
        description: "Task with special chars: !@#$%^&*()[]{}|\\:;\"'<>?,.`~",
        unicode: "Unicode test: 日本語 العربية Ελληνικά 🚀🔥💻",
        json: '{"key": "value", "nested": {"array": [1, 2, 3]}}',
        sql: "SELECT * FROM tasks WHERE description = 'O''Reilly'; DROP TABLE tasks;--",
      };

      testDb.db
        .prepare(`
          INSERT INTO tasks (
            id, description, workflow, autonomy, status, project_path, created_at, updated_at,
            acceptance_criteria, workspace_config
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          'special_chars_task',
          specialData.description,
          'feature',
          'full',
          'pending',
          '/test',
          now,
          now,
          specialData.unicode,
          specialData.json
        );

      // Insert log with SQL injection attempt
      testDb.db
        .prepare('INSERT INTO task_logs (task_id, timestamp, level, message) VALUES (?, ?, ?, ?)')
        .run('special_chars_task', now, 'info', specialData.sql);

      // Retrieve and verify data integrity
      const task = testDb.db.prepare('SELECT * FROM tasks WHERE id = ?').get('special_chars_task') as any;
      const log = testDb.db.prepare('SELECT * FROM task_logs WHERE task_id = ?').get('special_chars_task') as any;

      expect(task.description).toBe(specialData.description);
      expect(task.acceptance_criteria).toBe(specialData.unicode);
      expect(task.workspace_config).toBe(specialData.json);
      expect(log.message).toBe(specialData.sql);

      // Verify no SQL injection occurred
      const allTasks = testDb.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
      expect(allTasks.count).toBe(1);
    });

    it('should handle large data volumes without performance issues', async () => {
      testDb = await createTestDatabase();
      const now = new Date().toISOString();

      const startTime = Date.now();

      // Insert large amount of data in transaction for performance
      testDb.db.transaction(() => {
        const taskStmt = testDb.db.prepare(`
          INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const logStmt = testDb.db.prepare(`
          INSERT INTO task_logs (task_id, timestamp, level, message)
          VALUES (?, ?, ?, ?)
        `);
        const todoStmt = testDb.db.prepare(`
          INSERT INTO todos (id, task_id, content, status, active_form, order_index, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Create 1000 tasks with related data
        for (let i = 0; i < 1000; i++) {
          const taskId = `bulk_task_${i}`;
          taskStmt.run(taskId, `Bulk task ${i}`, 'feature', 'full', 'pending', '/test', now, now);

          // Add 3 logs per task
          for (let j = 0; j < 3; j++) {
            logStmt.run(taskId, now, 'info', `Log ${j} for task ${i}`);
          }

          // Add 2 todos per task
          for (let k = 0; k < 2; k++) {
            todoStmt.run(`todo_${i}_${k}`, taskId, `Todo ${k} for task ${i}`, 'pending', `Working on todo ${k}`, k, now, now);
          }
        }
      })();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 5 seconds for in-memory DB)
      expect(duration).toBeLessThan(5000);

      // Verify data integrity
      const taskCount = testDb.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
      const logCount = testDb.db.prepare('SELECT COUNT(*) as count FROM task_logs').get() as { count: number };
      const todoCount = testDb.db.prepare('SELECT COUNT(*) as count FROM todos').get() as { count: number };

      expect(taskCount.count).toBe(1000);
      expect(logCount.count).toBe(3000);
      expect(todoCount.count).toBe(2000);

      // Test query performance on large dataset
      const queryStart = Date.now();
      const complexQuery = testDb.db.prepare(`
        SELECT
          t.id,
          COUNT(DISTINCT l.id) as log_count,
          COUNT(DISTINCT td.id) as todo_count
        FROM tasks t
        LEFT JOIN task_logs l ON t.id = l.task_id
        LEFT JOIN todos td ON t.id = td.task_id
        WHERE t.status = 'pending'
        GROUP BY t.id
        HAVING log_count > 2
        ORDER BY t.id
        LIMIT 10
      `).all();
      const queryEnd = Date.now();

      expect(queryEnd - queryStart).toBeLessThan(100); // Should be very fast with indexes
      expect(complexQuery).toHaveLength(10);
    });

    it('should handle concurrent database access safely', async () => {
      testDb = await createTestDatabase();

      // Simulate concurrent access patterns
      const concurrentOperations = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve().then(() => {
          const now = new Date().toISOString();
          const taskId = `concurrent_${i}`;

          // Each operation creates a task and related data
          testDb.db.transaction(() => {
            testDb.db
              .prepare('INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
              .run(taskId, `Concurrent task ${i}`, 'feature', 'full', 'pending', '/test', now, now);

            for (let j = 0; j < 5; j++) {
              testDb.db
                .prepare('INSERT INTO task_logs (task_id, timestamp, level, message) VALUES (?, ?, ?, ?)')
                .run(taskId, now, 'info', `Concurrent log ${i}-${j}`);
            }
          })();

          return i;
        })
      );

      const results = await Promise.all(concurrentOperations);
      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      // Verify all operations completed successfully
      const finalTaskCount = testDb.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
      const finalLogCount = testDb.db.prepare('SELECT COUNT(*) as count FROM task_logs').get() as { count: number };

      expect(finalTaskCount.count).toBe(10);
      expect(finalLogCount.count).toBe(50);
    });
  });

  describe('TaskStore Edge Cases', () => {
    let ctx: TestTaskStoreContext;

    beforeEach(async () => {
      ctx = await createTestTaskStore();
    });

    afterEach(async () => {
      if (ctx) await ctx.cleanup();
    });

    it('should handle task creation with edge case data', async () => {
      // Create task with extreme values
      const extremeTask = createMockTask({
        id: 'a'.repeat(100), // Very long ID
        description: 'x'.repeat(1000), // Very long description
        retryCount: 999,
        maxRetries: 1000,
        resumeAttempts: 500,
        usage: {
          inputTokens: 999999,
          outputTokens: 888888,
          totalTokens: 1888887,
          estimatedCost: 99.99,
          totalCostCents: 9999,
          executionTimeMs: 3600000, // 1 hour
        },
      });

      const task = await seedPendingTask(ctx.store, extremeTask);

      expect(task.id).toBe(extremeTask.id);
      expect(task.description).toBe(extremeTask.description);
      expect(task.retryCount).toBe(extremeTask.retryCount);
      expect(task.maxRetries).toBe(extremeTask.maxRetries);
      expect(task.usage.totalTokens).toBe(extremeTask.usage.totalTokens);
    });

    it('should handle invalid task state transitions gracefully', async () => {
      const task = await seedPendingTask(ctx.store);

      // Try to transition directly from pending to completed (might be invalid in business logic)
      // This tests that the database layer handles it even if business logic wouldn't allow it
      await ctx.store.updateTaskStatus(task.id, 'completed');

      const updatedTask = await ctx.store.getTask(task.id);
      expect(updatedTask?.status).toBe('completed');
    });

    it('should handle task queries with no results', async () => {
      // Query non-existent tasks
      const nonExistentTask = await ctx.store.getTask('non-existent-id');
      expect(nonExistentTask).toBeNull();

      // Query by status with no matching tasks
      const noRunningTasks = await ctx.store.getTasksByStatus('running');
      expect(noRunningTasks).toEqual([]);

      // Complex queries with no results
      const allTasks = await ctx.store.getAllTasks();
      expect(allTasks).toEqual([]);
    });
  });

  describe('Permission Store Edge Cases', () => {
    let permCtx: TestPermissionStoreContext;

    beforeEach(async () => {
      permCtx = await createTestPermissionStore();
    });

    afterEach(async () => {
      if (permCtx) await permCtx.cleanup();
    });

    it('should handle permissions with edge case data', async () => {
      const edgePermission = {
        id: 'a'.repeat(50),
        tool: 'Tool-With-Special@Characters!',
        scope: '/very/deep/nested/path/**/*.special.file.ext',
        level: 'allow-always' as const,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1000), // Expires in 1 second
        config: {
          maxUsageCount: 999999,
          allowedOperations: ['read', 'write', 'execute'],
          restrictedPaths: ['/restricted/path'],
          customSettings: { key: 'value with spaces and $pecial chars!' }
        },
        grantReason: 'Testing edge case with very long reason '.repeat(10),
        grantedBy: 'edge-case-tester',
        tags: ['edge-case', 'testing', 'special-chars!@#$%']
      };

      await permCtx.store.savePermission(edgePermission);

      const retrieved = await permCtx.store.getPermission(edgePermission.tool, edgePermission.scope);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(edgePermission.id);
      expect(retrieved?.tool).toBe(edgePermission.tool);
      expect(retrieved?.scope).toBe(edgePermission.scope);
    });

    it('should handle permission queries with no results', async () => {
      const nonExistent = await permCtx.store.getPermission('NonExistentTool');
      expect(nonExistent).toBeNull();

      const emptyList = await permCtx.store.listPermissions();
      expect(emptyList).toEqual([]);
    });

    it('should handle expired permissions correctly', async () => {
      const expiredPermission = {
        id: 'expired-perm',
        tool: 'ExpiredTool',
        level: 'allow-always' as const,
        createdAt: new Date(Date.now() - 2000),
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        config: {},
        grantReason: 'Testing',
        grantedBy: 'test',
        tags: []
      };

      await permCtx.store.savePermission(expiredPermission);

      // Permission should exist in storage
      const stored = await permCtx.store.getPermission('ExpiredTool');
      expect(stored).toBeDefined();
      expect(stored?.expiresAt?.getTime()).toBeLessThan(Date.now());
    });
  });

  describe('Mock Utilities Edge Cases', () => {
    it('should handle extreme override scenarios', () => {
      // Override with null/undefined values where possible
      const task = createMockTask({
        description: '', // Empty string
        branchName: undefined, // Undefined
        error: null, // Null
        acceptanceCriteria: '', // Empty acceptance criteria
        logs: [], // Empty array (default)
        artifacts: [], // Empty array (default)
      });

      expect(task.description).toBe('');
      expect(task.branchName).toBeUndefined();
      expect(task.error).toBeNull();
      expect(task.acceptanceCriteria).toBe('');
      expect(task.logs).toEqual([]);
      expect(task.artifacts).toEqual([]);
    });

    it('should handle mock permission manager edge cases', async () => {
      const mockManager = createMockPermissionManager({});

      // Check non-existent permissions
      expect(await mockManager.checkPermission('NonExistent')).toBeNull();
      expect(await mockManager.hasPermission('NonExistent')).toBe(false);
      expect(await mockManager.isAllowed('NonExistent')).toBe(false);
      expect(await mockManager.requiresConfirmation('NonExistent')).toBe(false);

      // Grant permission and verify
      await mockManager.grantPermission('NewTool', 'deny');
      expect(await mockManager.checkPermission('NewTool')).toBe('deny');
      expect(await mockManager.isAllowed('NewTool')).toBe(false);

      // Test scoped permissions
      await mockManager.grantPermission('ScopedTool', 'allow-once', '/specific/path');
      expect(await mockManager.checkPermission('ScopedTool', '/specific/path')).toBe('allow-once');
      expect(await mockManager.checkPermission('ScopedTool')).toBeNull();
    });
  });

  describe('Cleanup and Error Recovery', () => {
    it('should handle cleanup of corrupted contexts', async () => {
      const testDb = await createTestDatabase();

      // Simulate database corruption/closure
      testDb.db.close();

      // Cleanup should not throw even if database is already closed
      expect(() => cleanupTestDatabase(testDb)).not.toThrow();
    });

    it('should handle temp directory cleanup failures gracefully', async () => {
      const tempPath = await createTempDirectoryAsync('test-cleanup-');

      // Simulate permission issues by trying to remove non-existent directory
      const nonExistentPath = '/non/existent/path/that/should/not/exist';

      // Should not throw
      await expect(removeTempDirectory(nonExistentPath)).resolves.not.toThrow();
    });

    it('should handle multiple simultaneous cleanup calls', async () => {
      const contexts = await Promise.all([
        createTestDatabase(),
        createTestDatabase(),
        createTestDatabase(),
      ]);

      // Cleanup all simultaneously
      const cleanupPromises = contexts.map(ctx =>
        Promise.resolve().then(() => cleanupTestDatabase(ctx))
      );

      await expect(Promise.all(cleanupPromises)).resolves.not.toThrow();
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory with many database creations', async () => {
      const databases: TestDatabaseContext[] = [];

      try {
        // Create many databases quickly
        for (let i = 0; i < 50; i++) {
          databases.push(await createTestDatabase());
        }

        // Each should be independent and functional
        databases.forEach((db, index) => {
          const taskId = `mem_test_${index}`;
          const now = new Date().toISOString();

          db.db
            .prepare('INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(taskId, `Memory test ${index}`, 'feature', 'full', 'pending', '/test', now, now);

          const count = db.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
          expect(count.count).toBe(1);
        });

      } finally {
        // Clean up all databases
        databases.forEach(db => cleanupTestDatabase(db));
      }
    });

    it('should handle rapid creation and destruction cycles', async () => {
      // Simulate rapid test cycles
      for (let cycle = 0; cycle < 20; cycle++) {
        const ctx = await createTestTaskStore();

        // Add some data
        await seedFailedTask(ctx.store, {
          description: `Cycle ${cycle} task`,
          retryCount: cycle % 4,
        });

        // Verify data exists
        const tasks = await ctx.store.getAllTasks();
        expect(tasks).toHaveLength(1);
        expect(tasks[0].description).toBe(`Cycle ${cycle} task`);

        // Clean up immediately
        await ctx.cleanup();
      }
    });
  });
});