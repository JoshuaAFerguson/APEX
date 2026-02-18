/**
 * Comprehensive tests for SQLite test utilities and database fixtures.
 * This test suite validates the robustness and isolation of the test database infrastructure.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import {
  createTestDatabase,
  cleanupTestDatabase,
  createTestTaskStore,
  createTestPermissionStore,
  createPermissionTestEnvironment,
  seedPendingTask,
  seedRunningTask,
  seedCompletedTask,
  seedFailedTask,
  seedPausedTask,
  seedCancelledTask,
  seedTaskScenario,
  createMockTask,
  createMockPermissionManager,
  populateTestPermissions,
  assertDatabaseState,
  type TestDatabaseContext,
  type TestTaskStoreContext,
  type TestPermissionStoreContext,
  type PermissionTestEnvironment,
  type TaskScenario,
} from '../test-utils.js';

describe('SQLite Test Utilities - Comprehensive Suite', () => {
  describe('In-Memory Database Creation and Isolation', () => {
    let testDb1: TestDatabaseContext;
    let testDb2: TestDatabaseContext;

    afterEach(() => {
      if (testDb1) cleanupTestDatabase(testDb1);
      if (testDb2) cleanupTestDatabase(testDb2);
    });

    it('should create multiple isolated in-memory databases', async () => {
      testDb1 = await createTestDatabase();
      testDb2 = await createTestDatabase();

      expect(testDb1.db).toBeDefined();
      expect(testDb2.db).toBeDefined();
      expect(testDb1.db).not.toBe(testDb2.db);

      // Add data to first database
      testDb1.db
        .prepare('INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run('test1', 'Task 1', 'feature', 'full', 'pending', '/test', new Date().toISOString(), new Date().toISOString());

      // Second database should be empty
      const tasks1 = testDb1.db.prepare('SELECT * FROM tasks').all();
      const tasks2 = testDb2.db.prepare('SELECT * FROM tasks').all();

      expect(tasks1).toHaveLength(1);
      expect(tasks2).toHaveLength(0);
    });

    it('should handle concurrent database operations without interference', async () => {
      testDb1 = await createTestDatabase();
      testDb2 = await createTestDatabase();

      // Concurrent operations on both databases
      const promises = [
        // Database 1 operations
        Promise.resolve().then(() => {
          const stmt = testDb1.db.prepare('INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
          for (let i = 0; i < 10; i++) {
            stmt.run(`task1_${i}`, `Task 1-${i}`, 'feature', 'full', 'pending', '/test1', new Date().toISOString(), new Date().toISOString());
          }
        }),
        // Database 2 operations
        Promise.resolve().then(() => {
          const stmt = testDb2.db.prepare('INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
          for (let i = 0; i < 15; i++) {
            stmt.run(`task2_${i}`, `Task 2-${i}`, 'bugfix', 'manual', 'running', '/test2', new Date().toISOString(), new Date().toISOString());
          }
        }),
      ];

      await Promise.all(promises);

      const tasks1 = testDb1.db.prepare('SELECT * FROM tasks').all();
      const tasks2 = testDb2.db.prepare('SELECT * FROM tasks').all();

      expect(tasks1).toHaveLength(10);
      expect(tasks2).toHaveLength(15);

      // Verify data integrity
      const task1Names = tasks1.map((t: any) => t.description);
      const task2Names = tasks2.map((t: any) => t.description);

      expect(task1Names).toContain('Task 1-0');
      expect(task1Names).toContain('Task 1-9');
      expect(task2Names).toContain('Task 2-0');
      expect(task2Names).toContain('Task 2-14');
    });

    it('should support complex queries across all tables', async () => {
      testDb1 = await createTestDatabase();
      const now = new Date().toISOString();

      // Create task
      testDb1.db
        .prepare('INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run('complex_task', 'Complex test task', 'feature', 'full', 'running', '/test', now, now);

      // Add related data
      testDb1.db
        .prepare('INSERT INTO task_logs (task_id, timestamp, level, stage, message) VALUES (?, ?, ?, ?, ?)')
        .run('complex_task', now, 'info', 'development', 'Started development');

      testDb1.db
        .prepare('INSERT INTO task_artifacts (task_id, name, type, path, content, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run('complex_task', 'test_file.ts', 'code', '/src/test_file.ts', 'export function test() {}', now);

      testDb1.db
        .prepare('INSERT INTO todos (id, task_id, content, status, active_form, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run('todo1', 'complex_task', 'Write tests', 'pending', 'Writing tests', 0, now, now);

      // Complex join query
      const result = testDb1.db.prepare(`
        SELECT
          t.id,
          t.description,
          t.status,
          COUNT(DISTINCT l.id) as log_count,
          COUNT(DISTINCT a.id) as artifact_count,
          COUNT(DISTINCT td.id) as todo_count
        FROM tasks t
        LEFT JOIN task_logs l ON t.id = l.task_id
        LEFT JOIN task_artifacts a ON t.id = a.task_id
        LEFT JOIN todos td ON t.id = td.task_id
        WHERE t.id = ?
        GROUP BY t.id
      `).get('complex_task') as any;

      expect(result).toBeDefined();
      expect(result.id).toBe('complex_task');
      expect(result.log_count).toBe(1);
      expect(result.artifact_count).toBe(1);
      expect(result.todo_count).toBe(1);
    });

    it('should properly enforce foreign key constraints', async () => {
      testDb1 = await createTestDatabase();

      // Try to insert a log without a corresponding task
      expect(() => {
        testDb1.db
          .prepare('INSERT INTO task_logs (task_id, timestamp, level, message) VALUES (?, ?, ?, ?)')
          .run('nonexistent_task', new Date().toISOString(), 'info', 'This should fail');
      }).toThrow(); // SQLite foreign key constraint should be enforced
    });
  });

  describe('Task Store Integration Tests', () => {
    let ctx: TestTaskStoreContext;

    beforeEach(async () => {
      ctx = await createTestTaskStore();
    });

    afterEach(async () => {
      await ctx.cleanup();
    });

    it('should seed all task statuses correctly', async () => {
      const pending = await seedPendingTask(ctx.store);
      const running = await seedRunningTask(ctx.store);
      const completed = await seedCompletedTask(ctx.store);
      const failed = await seedFailedTask(ctx.store);
      const paused = await seedPausedTask(ctx.store);
      const cancelled = await seedCancelledTask(ctx.store);

      expect(pending.status).toBe('pending');
      expect(running.status).toBe('running');
      expect(completed.status).toBe('completed');
      expect(failed.status).toBe('failed');
      expect(paused.status).toBe('paused');
      expect(cancelled.status).toBe('cancelled');

      // Verify they all have unique IDs
      const allIds = [pending, running, completed, failed, paused, cancelled].map(t => t.id);
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(6);
    });

    it('should seed complex multi-task scenarios', async () => {
      const scenarios: TaskScenario[] = ['mixed-statuses', 'dependency-chain', 'subtask-tree', 'retry-exhausted'];

      for (const scenario of scenarios) {
        // Clean store between scenarios
        const currentCtx = await createTestTaskStore();
        try {
          const tasks = await seedTaskScenario(currentCtx.store, scenario);

          expect(tasks.length).toBeGreaterThan(0);

          switch (scenario) {
            case 'mixed-statuses':
              expect(tasks).toHaveLength(6);
              const statuses = tasks.map(t => t.status);
              expect(statuses).toContain('pending');
              expect(statuses).toContain('running');
              expect(statuses).toContain('completed');
              expect(statuses).toContain('failed');
              expect(statuses).toContain('paused');
              expect(statuses).toContain('cancelled');
              break;

            case 'dependency-chain':
              expect(tasks).toHaveLength(3);
              const [taskA, taskB, taskC] = tasks;
              expect(taskA.status).toBe('completed');
              expect(taskB.status).toBe('running');
              expect(taskC.status).toBe('pending');
              expect(taskB.dependsOn).toContain(taskA.id);
              expect(taskC.dependsOn).toContain(taskB.id);
              break;

            case 'subtask-tree':
              expect(tasks).toHaveLength(4);
              const [parent, ...subtasks] = tasks;
              expect(parent.subtaskIds).toHaveLength(3);
              expect(parent.subtaskStrategy).toBe('parallel');
              subtasks.forEach(subtask => {
                expect(parent.subtaskIds).toContain(subtask.id);
              });
              break;

            case 'retry-exhausted':
              expect(tasks).toHaveLength(1);
              const [retryTask] = tasks;
              expect(retryTask.retryCount).toBe(3);
              expect(retryTask.maxRetries).toBe(3);
              expect(retryTask.status).toBe('failed');
              break;
          }
        } finally {
          await currentCtx.cleanup();
        }
      }
    });

    it('should maintain data consistency across store operations', async () => {
      // Seed many tasks with various operations
      const tasks = await Promise.all([
        seedPendingTask(ctx.store, { priority: 'high' }),
        seedRunningTask(ctx.store, { effort: 'low' }),
        seedCompletedTask(ctx.store, { workflow: 'hotfix' }),
      ]);

      // Verify all tasks are stored
      const storedTasks = await Promise.all(tasks.map(t => ctx.store.getTask(t.id)));
      expect(storedTasks.every(t => t !== null)).toBe(true);

      // Test filtering by status
      const pendingTasks = await ctx.store.getTasksByStatus('pending');
      const runningTasks = await ctx.store.getTasksByStatus('running');
      const completedTasks = await ctx.store.getTasksByStatus('completed');

      expect(pendingTasks).toHaveLength(1);
      expect(runningTasks).toHaveLength(1);
      expect(completedTasks).toHaveLength(1);

      expect(pendingTasks[0].priority).toBe('high');
      expect(runningTasks[0].effort).toBe('low');
      expect(completedTasks[0].workflow).toBe('hotfix');
    });
  });

  describe('Permission Store Integration Tests', () => {
    let permEnv: PermissionTestEnvironment;

    beforeEach(async () => {
      permEnv = await createPermissionTestEnvironment();
    });

    afterEach(async () => {
      await permEnv.cleanup();
    });

    it('should handle permission scenarios correctly', async () => {
      // Test read-only scenario
      const readOnlyEnv = await createPermissionTestEnvironment();
      await readOnlyEnv.addPermission({
        id: 'read1',
        tool: 'Read',
        level: 'allow-always',
        createdAt: new Date(),
        expiresAt: undefined,
        config: {},
        grantReason: 'Testing',
        grantedBy: 'test',
        tags: []
      });
      await readOnlyEnv.addPermission({
        id: 'write1',
        tool: 'Write',
        level: 'deny',
        createdAt: new Date(),
        expiresAt: undefined,
        config: {},
        grantReason: 'Testing',
        grantedBy: 'test',
        tags: []
      });

      await readOnlyEnv.assertToolAllowed('Read');
      await readOnlyEnv.assertToolDenied('Write');

      await readOnlyEnv.cleanup();
    });

    it('should support complex permission scenarios', async () => {
      const toolPermissions = {
        'Read': 'allow-always' as const,
        'Write': 'allow-once' as const,
        'Bash': 'deny' as const,
        'Edit': 'allow-always' as const,
      };

      await populateTestPermissions(permEnv.store, toolPermissions);

      await permEnv.assertPermissionLevel('Read', 'allow-always');
      await permEnv.assertPermissionLevel('Write', 'allow-once');
      await permEnv.assertPermissionLevel('Bash', 'deny');
      await permEnv.assertPermissionLevel('Edit', 'allow-always');

      await permEnv.assertToolAllowed('Read');
      await permEnv.assertToolRequiresConfirmation('Write');
      await permEnv.assertToolDenied('Bash');
      await permEnv.assertToolAllowed('Edit');
    });

    it('should handle scoped permissions correctly', async () => {
      // Add scoped permissions
      await permEnv.addPermission({
        id: 'read-scoped',
        tool: 'Read',
        scope: '/project/**',
        level: 'allow-always',
        createdAt: new Date(),
        expiresAt: undefined,
        config: {},
        grantReason: 'Testing',
        grantedBy: 'test',
        tags: []
      });
      await permEnv.addPermission({
        id: 'write-scoped',
        tool: 'Write',
        scope: '/restricted/**',
        level: 'deny',
        createdAt: new Date(),
        expiresAt: undefined,
        config: {},
        grantReason: 'Testing',
        grantedBy: 'test',
        tags: []
      });

      await permEnv.assertPermissionLevel('Read', 'allow-always', '/project/**');
      await permEnv.assertPermissionLevel('Write', 'deny', '/restricted/**');

      await permEnv.assertToolAllowed('Read', '/project/**');
      await permEnv.assertToolDenied('Write', '/restricted/**');
    });
  });

  describe('Mock Utilities Validation', () => {
    it('should create consistent mock tasks', () => {
      const tasks = Array.from({ length: 100 }, () => createMockTask());

      // All tasks should have unique IDs
      const ids = tasks.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100);

      // All tasks should have consistent structure
      tasks.forEach(task => {
        expect(task.id).toMatch(/^task_\d+_[a-z0-9]+$/);
        expect(task.description).toBe('Test task');
        expect(task.workflow).toBe('feature');
        expect(task.autonomy).toBe('full');
        expect(task.status).toBe('pending');
        expect(task.priority).toBe('normal');
        expect(task.effort).toBe('medium');
        expect(task.projectPath).toBe('/test/project');
        expect(task.logs).toEqual([]);
        expect(task.artifacts).toEqual([]);
        expect(task.usage).toBeDefined();
        expect(task.usage.totalTokens).toBe(0);
      });
    });

    it('should support override patterns correctly', () => {
      const customTask = createMockTask({
        description: 'Custom task',
        status: 'completed',
        priority: 'high',
        effort: 'low',
        workflow: 'hotfix',
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.05,
          totalCostCents: 5,
          executionTimeMs: 30000,
        }
      });

      expect(customTask.description).toBe('Custom task');
      expect(customTask.status).toBe('completed');
      expect(customTask.priority).toBe('high');
      expect(customTask.effort).toBe('low');
      expect(customTask.workflow).toBe('hotfix');
      expect(customTask.usage.totalTokens).toBe(1500);

      // Non-overridden fields should keep defaults
      expect(customTask.autonomy).toBe('full');
      expect(customTask.projectPath).toBe('/test/project');
    });

    it('should create mock permission managers with correct behavior', async () => {
      const mockManager = createMockPermissionManager({
        'Read': 'allow-always',
        'Write': 'allow-once',
        'Bash': 'deny',
      });

      expect(await mockManager.checkPermission('Read')).toBe('allow-always');
      expect(await mockManager.checkPermission('Write')).toBe('allow-once');
      expect(await mockManager.checkPermission('Bash')).toBe('deny');
      expect(await mockManager.checkPermission('Unknown')).toBeNull();

      expect(await mockManager.isAllowed('Read')).toBe(true);
      expect(await mockManager.isAllowed('Write')).toBe(true);
      expect(await mockManager.isAllowed('Bash')).toBe(false);

      expect(await mockManager.requiresConfirmation('Read')).toBe(false);
      expect(await mockManager.requiresConfirmation('Write')).toBe(true);
      expect(await mockManager.requiresConfirmation('Bash')).toBe(false);

      // Test dynamic permission granting
      await mockManager.grantPermission('NewTool', 'allow-always');
      expect(await mockManager.checkPermission('NewTool')).toBe('allow-always');
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should properly clean up all resources', async () => {
      const testDb = await createTestDatabase();
      const taskStore = await createTestTaskStore();
      const permStore = await createTestPermissionStore();

      expect(testDb.db.open).toBe(true);
      expect(taskStore.db.open).toBe(true);

      // Clean up all resources
      cleanupTestDatabase(testDb);
      await taskStore.cleanup();
      await permStore.cleanup();

      expect(testDb.db.open).toBe(false);
      expect(taskStore.db.open).toBe(false);
    });

    it('should handle multiple cleanup calls gracefully', async () => {
      const testDb = await createTestDatabase();

      // Multiple cleanup calls should not throw
      cleanupTestDatabase(testDb);
      expect(() => cleanupTestDatabase(testDb)).not.toThrow();
      expect(() => cleanupTestDatabase(testDb)).not.toThrow();
    });

    it('should handle null/undefined cleanup gracefully', () => {
      // @ts-expect-error - Testing error handling
      expect(() => cleanupTestDatabase(null)).not.toThrow();
      // @ts-expect-error - Testing error handling
      expect(() => cleanupTestDatabase(undefined)).not.toThrow();
    });
  });

  describe('Database Schema Validation', () => {
    let testDb: TestDatabaseContext;

    beforeEach(async () => {
      testDb = await createTestDatabase();
    });

    afterEach(() => {
      cleanupTestDatabase(testDb);
    });

    it('should have all v0.5.0 tables with correct schema', async () => {
      const tables = testDb.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all() as { name: string }[];

      const expectedTables = [
        'approval_states',
        'audit_logs',
        'commands',
        'file_snapshots',
        'fix_attempts',
        'gates',
        'idle_tasks',
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
        'workspace_info',
      ];

      const actualTables = tables.map(t => t.name);
      expectedTables.forEach(tableName => {
        expect(actualTables).toContain(tableName);
      });
    });

    it('should have all required indexes', async () => {
      const indexes = testDb.db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name")
        .all() as { name: string }[];

      const requiredIndexes = [
        'idx_tasks_status',
        'idx_task_logs_task_id',
        'idx_todos_task_id',
        'idx_approval_states_task_id',
        'idx_permissions_tool_scope',
        'idx_tool_actions_task_id',
        'idx_audit_logs_task_id',
      ];

      const actualIndexes = indexes.map(i => i.name);
      requiredIndexes.forEach(indexName => {
        expect(actualIndexes).toContain(indexName);
      });
    });

    it('should support all task status types', async () => {
      const taskStatuses = ['pending', 'running', 'completed', 'failed', 'paused', 'cancelled'];
      const now = new Date().toISOString();

      taskStatuses.forEach((status, index) => {
        testDb.db
          .prepare(`
            INSERT INTO tasks (
              id, description, workflow, autonomy, status, project_path, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(`task_${index}`, `Task ${status}`, 'feature', 'full', status, '/test', now, now);
      });

      const tasks = testDb.db.prepare('SELECT status FROM tasks ORDER BY id').all() as { status: string }[];
      const actualStatuses = tasks.map(t => t.status);

      taskStatuses.forEach(status => {
        expect(actualStatuses).toContain(status);
      });
    });
  });
});