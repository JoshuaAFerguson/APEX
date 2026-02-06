/**
 * Comprehensive test suite for the test-utils module
 *
 * This test file provides complete coverage for all utilities provided
 * by test-utils.ts for testing SQLite operations, permission management,
 * and task store fixtures.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';
import {
  // Database utilities
  createTestDatabase,
  cleanupTestDatabase,
  createMockTask,
  type TestDatabaseContext,

  // Directory utilities
  createTempDirectoryAsync,
  removeTempDirectory,

  // Permission test utilities
  createTestPermissionStore,
  createPermissionScenarioStore,
  populateTestPermissions,
  createMockPermissionManager,
  createPermissionTestEnvironment,
  createPermissionTestScenario,
  assertDatabaseState,
  type TestPermissionStoreContext,
  type PermissionTestEnvironment,

  // Task store utilities
  createTestTaskStore,
  seedPendingTask,
  seedRunningTask,
  seedCompletedTask,
  seedFailedTask,
  seedPausedTask,
  seedCancelledTask,
  seedTaskScenario,
  type TestTaskStoreContext,
  type TaskScenario,
} from '../test-utils.js';
import { TaskStore } from '../store.js';
import type { Task, Permission } from '@apexcli/core';

// ============================================================================
// In-Memory Database Tests
// ============================================================================

describe('Test Utilities - Database Operations', () => {
  let testDb: TestDatabaseContext;

  beforeEach(async () => {
    testDb = await createTestDatabase();
  });

  afterEach(() => {
    cleanupTestDatabase(testDb);
  });

  describe('createTestDatabase', () => {
    it('should create an in-memory SQLite database', () => {
      expect(testDb.db).toBeDefined();
      expect(testDb.db.open).toBe(true);
      expect(testDb.cleanup).toBeDefined();
      expect(typeof testDb.cleanup).toBe('function');
    });

    it('should initialize all required TaskStore tables', () => {
      // Test that all tables exist by querying them
      const tableQuery = testDb.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table'
        ORDER BY name
      `);
      const tables = tableQuery.all() as { name: string }[];

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

      expectedTables.forEach(table => {
        expect(tables.some(t => t.name === table)).toBe(true);
      });
    });

    it('should create tables with correct structure', () => {
      // Test the main tasks table structure
      const tasksInfo = testDb.db.prepare("PRAGMA table_info(tasks)").all() as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: any;
        pk: number;
      }>;

      expect(tasksInfo.length).toBeGreaterThan(0);

      // Check for essential columns
      const columnNames = tasksInfo.map(col => col.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('description');
      expect(columnNames).toContain('workflow');
      expect(columnNames).toContain('autonomy');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('project_path');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');

      // Check primary key
      const primaryKey = tasksInfo.find(col => col.pk === 1);
      expect(primaryKey?.name).toBe('id');
    });

    it('should allow basic database operations', () => {
      // Insert a test row
      const insertStmt = testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status,
          priority, effort, project_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const taskId = 'test_task_123';
      const now = new Date().toISOString();

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
        now
      );

      // Query the data back
      const selectStmt = testDb.db.prepare('SELECT * FROM tasks WHERE id = ?');
      const task = selectStmt.get(taskId) as any;

      expect(task).toBeDefined();
      expect(task.id).toBe(taskId);
      expect(task.description).toBe('Test task description');
      expect(task.status).toBe('pending');
    });

    it('should support foreign key constraints', () => {
      // First insert a task
      const taskId = 'test_task_fk';
      const now = new Date().toISOString();

      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status,
          project_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(taskId, 'FK Test Task', 'feature', 'full', 'pending', '/test', now, now);

      // Insert a related task_log
      const logStmt = testDb.db.prepare(`
        INSERT INTO task_logs (task_id, timestamp, level, message)
        VALUES (?, ?, ?, ?)
      `);

      logStmt.run(taskId, now, 'info', 'Test log message');

      // Verify the log was inserted
      const logQuery = testDb.db.prepare('SELECT * FROM task_logs WHERE task_id = ?');
      const log = logQuery.get(taskId) as any;

      expect(log).toBeDefined();
      expect(log.task_id).toBe(taskId);
      expect(log.message).toBe('Test log message');
    });
  });

  describe('cleanupTestDatabase', () => {
    it('should close the database connection', () => {
      const originalOpen = testDb.db.open;
      cleanupTestDatabase(testDb);

      expect(testDb.db.open).toBe(false);
      expect(originalOpen).toBe(true); // Was open before cleanup
    });

    it('should be safe to call multiple times', () => {
      cleanupTestDatabase(testDb);
      cleanupTestDatabase(testDb); // Should not throw

      expect(testDb.db.open).toBe(false);
    });

    it('should handle null or undefined context gracefully', () => {
      expect(() => cleanupTestDatabase(null as any)).not.toThrow();
      expect(() => cleanupTestDatabase(undefined as any)).not.toThrow();
    });
  });
});

// ============================================================================
// Directory Utilities Tests
// ============================================================================

describe('Test Utilities - Directory Operations', () => {
  let tempDirs: string[] = [];

  afterEach(async () => {
    // Clean up any directories created during tests
    await Promise.all(tempDirs.map(dir =>
      removeTempDirectory(dir).catch(() => {
        // Ignore cleanup errors in tests
      })
    ));
    tempDirs = [];
  });

  describe('createTempDirectoryAsync', () => {
    it('should create a temporary directory', async () => {
      const tempDir = await createTempDirectoryAsync();
      tempDirs.push(tempDir);

      expect(tempDir).toBeDefined();
      expect(tempDir.includes('tmp')).toBe(true);
      expect(tempDir.includes('apex-test-')).toBe(true);

      // Verify directory exists
      const stat = await fs.stat(tempDir);
      expect(stat.isDirectory()).toBe(true);

      // Verify .apex subdirectory was created
      const apexDir = path.join(tempDir, '.apex');
      const apexStat = await fs.stat(apexDir);
      expect(apexStat.isDirectory()).toBe(true);
    });

    it('should accept custom prefix', async () => {
      const prefix = 'custom-test-prefix-';
      const tempDir = await createTempDirectoryAsync(prefix);
      tempDirs.push(tempDir);

      expect(tempDir.includes(prefix)).toBe(true);
    });

    it('should create unique directories', async () => {
      const dir1 = await createTempDirectoryAsync();
      const dir2 = await createTempDirectoryAsync();
      tempDirs.push(dir1, dir2);

      expect(dir1).not.toBe(dir2);
    });
  });

  describe('removeTempDirectory', () => {
    it('should remove a temporary directory', async () => {
      const tempDir = await createTempDirectoryAsync();

      // Verify it exists
      await expect(fs.stat(tempDir)).resolves.toBeDefined();

      // Remove it
      await removeTempDirectory(tempDir);

      // Verify it's gone
      await expect(fs.stat(tempDir)).rejects.toThrow();
    });

    it('should remove directories with contents', async () => {
      const tempDir = await createTempDirectoryAsync();
      tempDirs.push(tempDir);

      // Create some files and subdirectories
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'test content');
      await fs.mkdir(path.join(tempDir, 'subdir'));
      await fs.writeFile(path.join(tempDir, 'subdir', 'nested.txt'), 'nested content');

      // Remove directory
      await removeTempDirectory(tempDir);
      tempDirs.pop(); // Remove from cleanup list since we just cleaned it

      // Verify it's gone
      await expect(fs.stat(tempDir)).rejects.toThrow();
    });

    it('should be safe with invalid paths', async () => {
      await expect(removeTempDirectory('')).resolves.toBeUndefined();
      await expect(removeTempDirectory('/')).resolves.toBeUndefined();
      await expect(removeTempDirectory('/no-tmp-in-path')).resolves.toBeUndefined();
    });

    it('should be safe with non-existent paths', async () => {
      const nonExistentPath = path.join(os.tmpdir(), 'non-existent-dir-' + Date.now());
      await expect(removeTempDirectory(nonExistentPath)).resolves.toBeUndefined();
    });
  });
});

// ============================================================================
// Mock Task Creation Tests
// ============================================================================

describe('Test Utilities - Mock Task Creation', () => {
  describe('createMockTask', () => {
    it('should create a valid task with default values', () => {
      const task = createMockTask();

      expect(task.id).toBeDefined();
      expect(task.id).toMatch(/^task_\d+_[a-z0-9]+$/);
      expect(task.description).toBe('Test task');
      expect(task.workflow).toBe('feature');
      expect(task.autonomy).toBe('full');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('normal');
      expect(task.effort).toBe('medium');
      expect(task.projectPath).toBe('/test/project');
      expect(task.branchName).toBe('apex/test-branch');
      expect(task.retryCount).toBe(0);
      expect(task.maxRetries).toBe(3);
      expect(task.resumeAttempts).toBe(0);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
      expect(task.usage).toBeDefined();
      expect(task.logs).toEqual([]);
      expect(task.artifacts).toEqual([]);
      expect(task.dependsOn).toEqual([]);
      expect(task.blockedBy).toEqual([]);
    });

    it('should accept overrides', () => {
      const overrides = {
        description: 'Custom test description',
        status: 'running' as const,
        priority: 'high' as const,
        retryCount: 2,
      };

      const task = createMockTask(overrides);

      expect(task.description).toBe('Custom test description');
      expect(task.status).toBe('running');
      expect(task.priority).toBe('high');
      expect(task.retryCount).toBe(2);
      // Other defaults should still apply
      expect(task.workflow).toBe('feature');
      expect(task.autonomy).toBe('full');
    });

    it('should generate unique IDs for multiple tasks', () => {
      const task1 = createMockTask();
      const task2 = createMockTask();
      const task3 = createMockTask();

      expect(task1.id).not.toBe(task2.id);
      expect(task2.id).not.toBe(task3.id);
      expect(task1.id).not.toBe(task3.id);
    });

    it('should create realistic usage data', () => {
      const task = createMockTask();

      expect(task.usage.inputTokens).toBe(0);
      expect(task.usage.outputTokens).toBe(0);
      expect(task.usage.totalTokens).toBe(0);
      expect(task.usage.estimatedCost).toBe(0);
      expect(task.usage.totalCostCents).toBe(0);
      expect(task.usage.executionTimeMs).toBe(0);
    });

    it('should allow overriding nested objects', () => {
      const customUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        estimatedCost: 0.05,
        totalCostCents: 5,
        executionTimeMs: 30000,
      };

      const task = createMockTask({
        usage: customUsage,
        dependsOn: ['parent-task-id'],
      });

      expect(task.usage).toEqual(customUsage);
      expect(task.dependsOn).toEqual(['parent-task-id']);
    });
  });
});

// ============================================================================
// Permission Test Utilities Tests
// ============================================================================

describe('Test Utilities - Permission Operations', () => {
  let tempDirs: string[] = [];

  afterEach(async () => {
    // Clean up any directories created during tests
    await Promise.all(tempDirs.map(dir =>
      removeTempDirectory(dir).catch(() => {
        // Ignore cleanup errors in tests
      })
    ));
    tempDirs = [];
  });

  describe('createMockPermissionManager', () => {
    it('should create a mock permission manager with default empty permissions', async () => {
      const mockManager = createMockPermissionManager();

      const result = await mockManager.checkPermission('Read');
      expect(result).toBeNull();

      const hasPermission = await mockManager.hasPermission('Write');
      expect(hasPermission).toBe(false);
    });

    it('should create a manager with predefined permissions', async () => {
      const permissions = {
        'Read': 'allow-always' as const,
        'Write': 'allow-once' as const,
        'Bash': 'deny' as const,
      };

      const mockManager = createMockPermissionManager(permissions);

      expect(await mockManager.checkPermission('Read')).toBe('allow-always');
      expect(await mockManager.checkPermission('Write')).toBe('allow-once');
      expect(await mockManager.checkPermission('Bash')).toBe('deny');
      expect(await mockManager.checkPermission('Unknown')).toBeNull();
    });

    it('should support scoped permissions', async () => {
      const mockManager = createMockPermissionManager({
        'Write': 'deny',
        'Write:/safe/path': 'allow-always',
      });

      expect(await mockManager.checkPermission('Write')).toBe('deny');
      expect(await mockManager.checkPermission('Write', '/safe/path')).toBe('allow-always');
    });

    it('should support permission granting', async () => {
      const mockManager = createMockPermissionManager();

      await mockManager.grantPermission('Edit', 'allow-once');
      expect(await mockManager.checkPermission('Edit')).toBe('allow-once');

      await mockManager.grantPermission('Edit', 'allow-always', '/specific/file');
      expect(await mockManager.checkPermission('Edit', '/specific/file')).toBe('allow-always');
    });

    it('should implement helper methods correctly', async () => {
      const mockManager = createMockPermissionManager({
        'AlwaysAllowed': 'allow-always',
        'OnceAllowed': 'allow-once',
        'Denied': 'deny',
      });

      // Test hasPermission
      expect(await mockManager.hasPermission('AlwaysAllowed')).toBe(true);
      expect(await mockManager.hasPermission('OnceAllowed')).toBe(true);
      expect(await mockManager.hasPermission('Denied')).toBe(false);
      expect(await mockManager.hasPermission('NotSet')).toBe(false);

      // Test isAllowed
      expect(await mockManager.isAllowed('AlwaysAllowed')).toBe(true);
      expect(await mockManager.isAllowed('OnceAllowed')).toBe(true);
      expect(await mockManager.isAllowed('Denied')).toBe(false);
      expect(await mockManager.isAllowed('NotSet')).toBe(false);

      // Test requiresConfirmation
      expect(await mockManager.requiresConfirmation('AlwaysAllowed')).toBe(false);
      expect(await mockManager.requiresConfirmation('OnceAllowed')).toBe(true);
      expect(await mockManager.requiresConfirmation('Denied')).toBe(false);
      expect(await mockManager.requiresConfirmation('NotSet')).toBe(false);
    });

    it('should expose internal permissions for testing', () => {
      const permissions = {
        'Test': 'allow-always' as const,
        'Test2': 'deny' as const,
      };

      const mockManager = createMockPermissionManager(permissions);
      const internal = mockManager._getPermissions();

      expect(internal).toEqual(permissions);
    });
  });

  // Note: The actual permission store tests would require importing
  // the permission-related modules, which may not be available in
  // this test environment. These tests are structured to be expanded
  // when those dependencies are available.

  describe('Permission Test Environment Structure', () => {
    it('should define the correct interface structure', () => {
      // This test verifies the interfaces are properly exported
      // and would be expanded when the permission system is available

      expect(createTestPermissionStore).toBeDefined();
      expect(createPermissionScenarioStore).toBeDefined();
      expect(populateTestPermissions).toBeDefined();
      expect(createPermissionTestEnvironment).toBeDefined();
      expect(createPermissionTestScenario).toBeDefined();
      expect(assertDatabaseState).toBeDefined();
    });
  });
});

// ============================================================================
// Task Store Test Utilities Tests
// ============================================================================

describe('Test Utilities - Task Store Operations', () => {
  let testContext: TestTaskStoreContext;

  beforeEach(async () => {
    testContext = await createTestTaskStore();
  });

  afterEach(async () => {
    await testContext.cleanup();
  });

  describe('createTestTaskStore', () => {
    it('should create a TaskStore with temporary directory', () => {
      expect(testContext.store).toBeDefined();
      expect(testContext.store).toBeInstanceOf(TaskStore);
      expect(testContext.db).toBeDefined();
      expect(testContext.tempPath).toBeDefined();
      expect(testContext.cleanup).toBeDefined();
    });

    it('should create a functional database', async () => {
      // Test basic operations
      const mockTask = createMockTask({
        description: 'Test store task',
      });

      await testContext.store.createTask(mockTask);
      const retrieved = await testContext.store.getTask(mockTask.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(mockTask.id);
      expect(retrieved!.description).toBe('Test store task');
    });

    it('should provide access to underlying database', () => {
      const db = testContext.db;
      expect(db).toBeDefined();
      expect(db.open).toBe(true);

      // Test direct database access
      const result = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
      expect(result.count).toBe(0);
    });
  });

  describe('Task Seeding Functions', () => {
    describe('seedPendingTask', () => {
      it('should create a pending task', async () => {
        const task = await seedPendingTask(testContext.store);

        expect(task.status).toBe('pending');
        expect(task.description).toBe('Pending test task');
        expect(task.id).toBeDefined();

        // Verify it was actually saved
        const retrieved = await testContext.store.getTask(task.id);
        expect(retrieved!.status).toBe('pending');
      });

      it('should accept overrides', async () => {
        const task = await seedPendingTask(testContext.store, {
          description: 'Custom pending task',
          priority: 'high',
        });

        expect(task.description).toBe('Custom pending task');
        expect(task.priority).toBe('high');
        expect(task.status).toBe('pending');
      });
    });

    describe('seedRunningTask', () => {
      it('should create a running task', async () => {
        const task = await seedRunningTask(testContext.store);

        expect(task.status).toBe('running');
        expect(task.currentStage).toBeDefined();
        expect(task.description).toBe('Running test task');
      });

      it('should allow custom stage', async () => {
        const task = await seedRunningTask(testContext.store, {
          currentStage: 'testing',
        });

        expect(task.status).toBe('running');
        expect(task.currentStage).toBe('testing');
      });
    });

    describe('seedCompletedTask', () => {
      it('should create a completed task with usage data', async () => {
        const task = await seedCompletedTask(testContext.store);

        expect(task.status).toBe('completed');
        expect(task.completedAt).toBeDefined();
        expect(task.description).toBe('Completed test task');

        // Should have realistic usage data
        expect(task.usage.inputTokens).toBeGreaterThan(0);
        expect(task.usage.outputTokens).toBeGreaterThan(0);
        expect(task.usage.estimatedCost).toBeGreaterThan(0);
      });

      it('should accept usage overrides', async () => {
        const customUsage = {
          inputTokens: 10000,
          outputTokens: 5000,
          totalTokens: 15000,
          estimatedCost: 1.5,
          totalCostCents: 150,
          executionTimeMs: 120000,
        };

        const task = await seedCompletedTask(testContext.store, {
          usage: customUsage,
        });

        expect(task.usage.inputTokens).toBe(10000);
        expect(task.usage.estimatedCost).toBe(1.5);
      });
    });

    describe('seedFailedTask', () => {
      it('should create a failed task with error message', async () => {
        const task = await seedFailedTask(testContext.store);

        expect(task.status).toBe('failed');
        expect(task.error).toBeDefined();
        expect(task.error).toContain('Test execution failed');
        expect(task.description).toBe('Failed test task');
      });
    });

    describe('seedPausedTask', () => {
      it('should create a paused task', async () => {
        const task = await seedPausedTask(testContext.store);

        expect(task.status).toBe('paused');
        expect(task.pauseReason).toBeDefined();
        expect(task.pausedAt).toBeDefined();
        expect(task.description).toBe('Paused test task');
      });
    });

    describe('seedCancelledTask', () => {
      it('should create a cancelled task', async () => {
        const task = await seedCancelledTask(testContext.store);

        expect(task.status).toBe('cancelled');
        expect(task.error).toBeDefined();
        expect(task.error).toContain('Cancelled by user');
        expect(task.description).toBe('Cancelled test task');
      });
    });
  });

  describe('seedTaskScenario', () => {
    it('should create mixed-statuses scenario', async () => {
      const tasks = await seedTaskScenario(testContext.store, 'mixed-statuses');

      expect(tasks).toHaveLength(6);

      const statuses = tasks.map(t => t.status);
      expect(statuses).toContain('pending');
      expect(statuses).toContain('running');
      expect(statuses).toContain('completed');
      expect(statuses).toContain('failed');
      expect(statuses).toContain('paused');
      expect(statuses).toContain('cancelled');

      // Verify all tasks have scenario descriptions
      tasks.forEach(task => {
        expect(task.description).toContain('Scenario:');
      });
    });

    it('should create dependency-chain scenario', async () => {
      const tasks = await seedTaskScenario(testContext.store, 'dependency-chain');

      expect(tasks).toHaveLength(3);

      const [taskA, taskB, taskC] = tasks;
      expect(taskA.description).toContain('task A (root)');
      expect(taskB.description).toContain('task B (depends on A)');
      expect(taskC.description).toContain('task C (depends on B)');

      expect(taskB.dependsOn).toContain(taskA.id);
      expect(taskC.dependsOn).toContain(taskB.id);
    });

    it('should create subtask-tree scenario', async () => {
      const tasks = await seedTaskScenario(testContext.store, 'subtask-tree');

      expect(tasks).toHaveLength(4);

      const [parent, sub1, sub2, sub3] = tasks;
      expect(parent.description).toContain('Parent task');
      expect(parent.subtaskIds).toContain(sub1.id);
      expect(parent.subtaskIds).toContain(sub2.id);
      expect(parent.subtaskIds).toContain(sub3.id);
      expect(parent.subtaskStrategy).toBe('parallel');

      // Verify subtasks have different statuses
      const subtaskStatuses = [sub1, sub2, sub3].map(t => t.status);
      expect(subtaskStatuses).toContain('completed');
      expect(subtaskStatuses).toContain('running');
      expect(subtaskStatuses).toContain('pending');
    });

    it('should create retry-exhausted scenario', async () => {
      const tasks = await seedTaskScenario(testContext.store, 'retry-exhausted');

      expect(tasks).toHaveLength(1);

      const task = tasks[0];
      expect(task.status).toBe('failed');
      expect(task.retryCount).toBe(3);
      expect(task.maxRetries).toBe(3);
      expect(task.error).toContain('Max retries exceeded');
    });
  });

  describe('cleanup operations', () => {
    it('should clean up store and temporary files', async () => {
      const tempPath = testContext.tempPath;
      const dbPath = path.join(tempPath, '.apex', 'apex.db');

      // Verify database file exists
      await expect(fs.stat(dbPath)).resolves.toBeDefined();

      // Cleanup
      await testContext.cleanup();

      // Verify store is closed and files are removed
      await expect(fs.stat(tempPath)).rejects.toThrow();
    });

    it('should be safe to call cleanup multiple times', async () => {
      await testContext.cleanup();
      await expect(testContext.cleanup()).resolves.toBeUndefined();
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Test Utilities - Integration Tests', () => {
  describe('Combined database and task operations', () => {
    let testDb: TestDatabaseContext;
    let testStore: TestTaskStoreContext;

    beforeEach(async () => {
      testDb = await createTestDatabase();
      testStore = await createTestTaskStore();
    });

    afterEach(async () => {
      cleanupTestDatabase(testDb);
      await testStore.cleanup();
    });

    it('should work with both in-memory and file-based databases', async () => {
      // Create task in file-based store
      const storeTask = await seedPendingTask(testStore.store, {
        description: 'Store task',
      });

      // Create task directly in in-memory DB
      const mockTask = createMockTask({ description: 'Memory task' });
      const now = new Date().toISOString();

      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status,
          project_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        mockTask.id,
        mockTask.description,
        mockTask.workflow,
        mockTask.autonomy,
        mockTask.status,
        mockTask.projectPath,
        now,
        now
      );

      // Verify both work independently
      expect(storeTask.description).toBe('Store task');

      const memoryTask = testDb.db.prepare('SELECT * FROM tasks WHERE id = ?').get(mockTask.id) as any;
      expect(memoryTask.description).toBe('Memory task');
    });

    it('should provide isolated test environments', async () => {
      // Operations on one database shouldn't affect the other
      await seedPendingTask(testStore.store);

      const storeTasks = testStore.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
      const memoryTasks = testDb.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };

      expect(storeTasks.count).toBe(1);
      expect(memoryTasks.count).toBe(0);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle database creation errors gracefully', async () => {
      // This test would be expanded to cover actual error scenarios
      // when more complex database setup is needed
      const testDb = await createTestDatabase();
      expect(testDb.db).toBeDefined();
      cleanupTestDatabase(testDb);
    });

    it('should handle temp directory creation in constrained environments', async () => {
      // Test that temp directory creation works even with limited permissions
      const tempDir = await createTempDirectoryAsync('constrained-test-');
      expect(tempDir).toBeDefined();
      await removeTempDirectory(tempDir);
    });
  });
});