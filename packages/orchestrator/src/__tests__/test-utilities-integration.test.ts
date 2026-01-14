/**
 * Integration tests for test database utilities with real TaskStore functionality.
 * These tests ensure that the test utilities correctly mirror real database operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestDatabase,
  cleanupTestDatabase,
  createTestPermissionStore,
  createMockTask,
  populateTestPermissions,
  type TestDatabaseContext,
  type TestPermissionStoreContext,
} from '../test-utils';
import { createMockPermission } from '@apexcli/core/test-utils';
import { TaskStore } from '../store';
import { PermissionStore } from '../permission-store';
import { PermissionManager } from '../permission-manager';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

describe('Test Utilities Integration Tests', () => {
  let testDb: TestDatabaseContext;
  let testPermissions: TestPermissionStoreContext;
  let tempDir: string;
  let realTaskStore: TaskStore;

  beforeEach(async () => {
    // Create a temporary directory for real stores
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-integration-'));
  });

  afterEach(async () => {
    if (testDb) {
      cleanupTestDatabase(testDb);
    }
    if (testPermissions) {
      testPermissions.cleanup();
    }
    if (realTaskStore) {
      await realTaskStore.close();
    }
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('TaskStore Schema Compatibility', () => {
    it('should create the same schema as real TaskStore', async () => {
      // Create test database
      testDb = await createTestDatabase();

      // Create real TaskStore
      realTaskStore = new TaskStore(tempDir);
      await realTaskStore.initialize();

      // Get table schemas from both databases
      const testTables = testDb.db.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      ).all() as { sql: string }[];

      const realTables = realTaskStore['db'].prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      ).all() as { sql: string }[];

      // Compare table creation statements
      expect(testTables.length).toBe(realTables.length);

      for (let i = 0; i < testTables.length; i++) {
        // Normalize SQL statements for comparison (remove extra whitespace)
        const testSql = testTables[i].sql?.replace(/\s+/g, ' ').trim();
        const realSql = realTables[i].sql?.replace(/\s+/g, ' ').trim();
        expect(testSql).toBe(realSql);
      }
    });

    it('should create the same indexes as real TaskStore', async () => {
      testDb = await createTestDatabase();
      realTaskStore = new TaskStore(tempDir);
      await realTaskStore.initialize();

      const testIndexes = testDb.db.prepare(
        "SELECT name, sql FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name"
      ).all() as { name: string; sql: string }[];

      const realIndexes = realTaskStore['db'].prepare(
        "SELECT name, sql FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name"
      ).all() as { name: string; sql: string }[];

      expect(testIndexes.length).toBe(realIndexes.length);

      for (let i = 0; i < testIndexes.length; i++) {
        expect(testIndexes[i].name).toBe(realIndexes[i].name);
        expect(testIndexes[i].sql).toBe(realIndexes[i].sql);
      }
    });
  });

  describe('TaskStore CRUD Operations Compatibility', () => {
    beforeEach(async () => {
      testDb = await createTestDatabase();
      realTaskStore = new TaskStore(tempDir);
      await realTaskStore.initialize();
    });

    it('should support the same task operations as real TaskStore', async () => {
      const mockTask = createMockTask({
        id: 'integration_test_task',
        description: 'Integration test task',
      });

      // Test task creation in real store
      await realTaskStore.createTask(mockTask);
      const realTask = await realTaskStore.getTask(mockTask.id);
      expect(realTask).toBeTruthy();
      expect(realTask!.id).toBe(mockTask.id);

      // Test equivalent operation in test database
      const now = new Date().toISOString();
      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, priority, effort,
          project_path, created_at, updated_at,
          usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        mockTask.id, mockTask.description, mockTask.workflow, mockTask.autonomy, mockTask.status,
        mockTask.priority, mockTask.effort, mockTask.projectPath, now, now,
        mockTask.usage.inputTokens, mockTask.usage.outputTokens, mockTask.usage.totalTokens, mockTask.usage.estimatedCost
      );

      const testTask = testDb.db.prepare('SELECT * FROM tasks WHERE id = ?').get(mockTask.id) as any;
      expect(testTask.id).toBe(mockTask.id);
      expect(testTask.description).toBe(mockTask.description);
    });

    it('should support task status updates like real TaskStore', async () => {
      const mockTask = createMockTask({ id: 'status_test_task' });

      // Real store operation
      await realTaskStore.createTask(mockTask);
      await realTaskStore.updateTaskStatus(mockTask.id, 'in_progress');
      const realUpdatedTask = await realTaskStore.getTask(mockTask.id);
      expect(realUpdatedTask!.status).toBe('in_progress');

      // Test database equivalent
      const now = new Date().toISOString();
      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, project_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(mockTask.id, mockTask.description, mockTask.workflow, mockTask.autonomy, mockTask.status, mockTask.projectPath, now, now);

      testDb.db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run('in_progress', now, mockTask.id);

      const testUpdatedTask = testDb.db.prepare('SELECT status FROM tasks WHERE id = ?').get(mockTask.id) as { status: string };
      expect(testUpdatedTask.status).toBe('in_progress');
    });

    it('should support task logging operations', async () => {
      const mockTask = createMockTask({ id: 'logging_test_task' });

      // Real store operations
      await realTaskStore.createTask(mockTask);
      await realTaskStore.addLog(mockTask.id, { level: 'info', message: 'Test log message', stage: 'testing' });

      const realLogs = await realTaskStore.getLogs(mockTask.id);
      expect(realLogs).toHaveLength(1);
      expect(realLogs[0].message).toBe('Test log message');

      // Test database equivalent
      const now = new Date().toISOString();
      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, project_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(mockTask.id, mockTask.description, mockTask.workflow, mockTask.autonomy, mockTask.status, mockTask.projectPath, now, now);

      testDb.db.prepare(`
        INSERT INTO task_logs (task_id, timestamp, level, stage, message)
        VALUES (?, ?, ?, ?, ?)
      `).run(mockTask.id, now, 'info', 'testing', 'Test log message');

      const testLogs = testDb.db.prepare('SELECT * FROM task_logs WHERE task_id = ?').all(mockTask.id) as any[];
      expect(testLogs).toHaveLength(1);
      expect(testLogs[0].message).toBe('Test log message');
    });
  });

  describe('Permission Store Integration', () => {
    beforeEach(async () => {
      testPermissions = await createTestPermissionStore();
    });

    it('should work with real PermissionManager operations', async () => {
      // Test both direct store operations and manager operations
      const permission = createMockPermission({
        tool: 'Read',
        level: 'allow-always',
        scope: '/project/**',
      });

      // Test store operation
      await testPermissions.store.savePermission(permission);
      const storedPermission = await testPermissions.store.getPermission({
        tool: 'Read',
        scope: '/project/**',
      });
      expect(storedPermission).toBeTruthy();

      // Test manager operation
      const level = await testPermissions.manager.checkPermission('Read', '/project/**');
      expect(level).toBe('allow-always');

      // Test manager boolean methods
      expect(await testPermissions.manager.isAllowed('Read', '/project/**')).toBe(true);
      expect(await testPermissions.manager.hasPermission('Read', '/project/**')).toBe(true);
      expect(await testPermissions.manager.requiresConfirmation('Read', '/project/**')).toBe(false);
    });

    it('should handle session-based allow-once permissions correctly', async () => {
      // Grant allow-once permission through manager
      await testPermissions.manager.grantPermission('Write', '/temp/file.txt', 'allow-once');

      // First check should return allow-once and consume it
      const firstCheck = await testPermissions.manager.checkPermission('Write', '/temp/file.txt');
      expect(firstCheck).toBe('allow-once');

      // Second check should return null (consumed)
      const secondCheck = await testPermissions.manager.checkPermission('Write', '/temp/file.txt');
      expect(secondCheck).toBeNull();

      // Should also not be in persistent storage
      const storedPermission = await testPermissions.store.getPermission({
        tool: 'Write',
        scope: '/temp/file.txt',
      });
      expect(storedPermission).toBeNull();
    });

    it('should properly handle permission expiration', async () => {
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 5);

      const permission = createMockPermission({
        tool: 'Bash',
        level: 'allow-once',
        expiry: futureDate,
      });

      await testPermissions.store.savePermission(permission);

      const retrieved = await testPermissions.store.getPermission({ tool: 'Bash' });
      expect(retrieved!.expiry).toEqual(futureDate);

      // The manager should still respect the permission before expiry
      const level = await testPermissions.manager.checkPermission('Bash');
      expect(level).toBe('allow-once');
    });
  });

  describe('Scenario Testing Integration', () => {
    it('should support real-world permission scenarios', async () => {
      testPermissions = await createTestPermissionStore();

      // Simulate a real development workflow
      const developmentPermissions = {
        'Read': 'allow-always', // Always allow reading files
        'Glob': 'allow-always', // Always allow file pattern matching
        'Grep': 'allow-always', // Always allow content searching
        'Write': 'allow-once', // Require confirmation for file writes
        'Edit': 'allow-once', // Require confirmation for file edits
        'Bash': 'deny', // Deny shell access in this scenario
        'LSP': 'allow-always', // Always allow language server operations
      } as const;

      await populateTestPermissions(testPermissions.store, developmentPermissions);

      // Verify the scenario works as expected
      for (const [tool, expectedLevel] of Object.entries(developmentPermissions)) {
        const actualLevel = await testPermissions.manager.checkPermission(tool);
        expect(actualLevel).toBe(expectedLevel);

        if (expectedLevel === 'allow-always') {
          expect(await testPermissions.manager.isAllowed(tool)).toBe(true);
          expect(await testPermissions.manager.requiresConfirmation(tool)).toBe(false);
        } else if (expectedLevel === 'allow-once') {
          expect(await testPermissions.manager.isAllowed(tool)).toBe(true);
          expect(await testPermissions.manager.requiresConfirmation(tool)).toBe(true);
        } else if (expectedLevel === 'deny') {
          expect(await testPermissions.manager.isAllowed(tool)).toBe(false);
        }
      }
    });

    it('should support complex scoped permission scenarios', async () => {
      testPermissions = await createTestPermissionStore();

      // Complex scenario with different scopes
      const permissions = [
        createMockPermission({ tool: 'Write', scope: '/src/**', level: 'allow-always' }),
        createMockPermission({ tool: 'Write', scope: '/tests/**', level: 'allow-always' }),
        createMockPermission({ tool: 'Write', scope: '/config/**', level: 'allow-once' }),
        createMockPermission({ tool: 'Write', scope: '/secrets/**', level: 'deny' }),
        createMockPermission({ tool: 'Write', level: 'allow-once' }), // Default scope
      ];

      for (const perm of permissions) {
        await testPermissions.store.savePermission(perm);
      }

      // Test different scopes
      expect(await testPermissions.manager.checkPermission('Write', '/src/index.ts')).toBe('allow-always');
      expect(await testPermissions.manager.checkPermission('Write', '/tests/unit.test.ts')).toBe('allow-always');
      expect(await testPermissions.manager.checkPermission('Write', '/config/app.yml')).toBe('allow-once');
      expect(await testPermissions.manager.checkPermission('Write', '/secrets/api-key.txt')).toBe('deny');
      expect(await testPermissions.manager.checkPermission('Write', '/docs/readme.md')).toBe('allow-once'); // Default
    });
  });

  describe('Performance and Stress Testing Integration', () => {
    it('should handle large-scale permission operations efficiently', async () => {
      testPermissions = await createTestPermissionStore();

      const toolCount = 100;
      const permissions = Array.from({ length: toolCount }, (_, i) =>
        createMockPermission({
          tool: `Tool_${i}`,
          level: i % 3 === 0 ? 'allow-always' : i % 3 === 1 ? 'allow-once' : 'deny',
          scope: i % 2 === 0 ? `/scope_${i}/**` : undefined,
        })
      );

      // Bulk insert permissions
      const startTime = Date.now();
      for (const perm of permissions) {
        await testPermissions.store.savePermission(perm);
      }
      const insertTime = Date.now() - startTime;

      // Bulk check permissions
      const checkStartTime = Date.now();
      for (let i = 0; i < toolCount; i++) {
        const tool = `Tool_${i}`;
        const scope = i % 2 === 0 ? `/scope_${i}/**` : undefined;
        await testPermissions.manager.checkPermission(tool, scope);
      }
      const checkTime = Date.now() - checkStartTime;

      // Verify count
      const allPermissions = await testPermissions.store.listPermissions();
      expect(allPermissions).toHaveLength(toolCount);

      // Performance should be reasonable
      expect(insertTime).toBeLessThan(5000); // Insert should complete in under 5 seconds
      expect(checkTime).toBeLessThan(2000); // Checks should complete in under 2 seconds
    });

    it('should handle concurrent database operations correctly', async () => {
      testDb = await createTestDatabase();

      const taskCount = 50;
      const tasks = Array.from({ length: taskCount }, (_, i) =>
        createMockTask({ id: `concurrent_task_${i}` })
      );

      // Simulate concurrent task insertions
      const insertPromises = tasks.map(task => {
        return new Promise<void>((resolve) => {
          const now = new Date().toISOString();
          testDb.db.prepare(`
            INSERT INTO tasks (
              id, description, workflow, autonomy, status, project_path, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(task.id, task.description, task.workflow, task.autonomy, task.status, task.projectPath, now, now);
          resolve();
        });
      });

      await Promise.all(insertPromises);

      // Verify all tasks were inserted
      const insertedTasks = testDb.db.prepare('SELECT id FROM tasks ORDER BY id').all() as { id: string }[];
      expect(insertedTasks).toHaveLength(taskCount);

      // Verify data integrity
      for (let i = 0; i < taskCount; i++) {
        expect(insertedTasks[i].id).toBe(`concurrent_task_${i}`);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database constraint violations gracefully', async () => {
      testDb = await createTestDatabase();

      const task = createMockTask({ id: 'constraint_test' });
      const now = new Date().toISOString();

      // Insert task
      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, project_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(task.id, task.description, task.workflow, task.autonomy, task.status, task.projectPath, now, now);

      // Try to insert duplicate (should throw)
      expect(() => {
        testDb.db.prepare(`
          INSERT INTO tasks (
            id, description, workflow, autonomy, status, project_path, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(task.id, task.description, task.workflow, task.autonomy, task.status, task.projectPath, now, now);
      }).toThrow();
    });

    it('should handle invalid permission levels gracefully', async () => {
      testPermissions = await createTestPermissionStore();

      // Try to insert permission with invalid level (should be constrained by schema)
      expect(() => {
        testPermissions.store['db'].prepare(`
          INSERT INTO permissions (id, tool_name, level, created_at)
          VALUES (?, ?, ?, ?)
        `).run('test_perm', 'TestTool', 'invalid-level', new Date().toISOString());
      }).toThrow();
    });

    it('should handle missing foreign key references', async () => {
      testDb = await createTestDatabase();

      // Try to insert task log for non-existent task
      expect(() => {
        testDb.db.prepare(`
          INSERT INTO task_logs (task_id, timestamp, level, message)
          VALUES (?, ?, ?, ?)
        `).run('nonexistent_task', new Date().toISOString(), 'info', 'Test message');
      }).toThrow();
    });
  });
});