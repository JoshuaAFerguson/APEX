/**
 * @fileoverview Comprehensive Tests for Test Cleanup Utilities
 *
 * Tests the state cleanup utilities to ensure proper test isolation,
 * database cleanup, and state reset functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TestCleanup, TestHooks, createTestHooks, TestAssertions, type CleanupConfig } from '../test-cleanup.js';
import { TaskStore } from '../store.js';

describe('TestCleanup', () => {
  let cleanup: TestCleanup;
  let tempDir: string;

  beforeEach(() => {
    // Create temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-test-cleanup-'));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('constructor and configuration', () => {
    it('should create TestCleanup with default configuration', () => {
      cleanup = new TestCleanup();
      expect(cleanup).toBeInstanceOf(TestCleanup);
    });

    it('should create TestCleanup with custom configuration', () => {
      const config: CleanupConfig = {
        useInMemoryDb: false,
        preserveDbFiles: true,
        resetEnvVars: false,
        testDbPath: path.join(tempDir, 'custom-test.db'),
      };

      cleanup = new TestCleanup(config);
      expect(cleanup).toBeInstanceOf(TestCleanup);
    });

    it('should return singleton instance', () => {
      const cleanup1 = TestCleanup.getInstance();
      const cleanup2 = TestCleanup.getInstance();
      expect(cleanup1).toBe(cleanup2);
    });
  });

  describe('createTestTaskStore', () => {
    beforeEach(() => {
      cleanup = new TestCleanup();
    });

    it('should create TaskStore with in-memory database by default', async () => {
      const store = await cleanup.createTestTaskStore(tempDir);
      expect(store).toBeInstanceOf(TaskStore);

      // Verify it's working by creating a simple task
      const task = await store.createTask({
        description: 'Test task',
        workflow: 'development',
        agent: 'developer',
      });
      expect(task).toBeDefined();
      expect(task.description).toBe('Test task');

      store.close();
    });

    it('should create TaskStore with file-based database when configured', async () => {
      cleanup = new TestCleanup({ useInMemoryDb: false, testDbPath: path.join(tempDir, 'test.db') });

      const store = await cleanup.createTestTaskStore(tempDir);
      expect(store).toBeInstanceOf(TaskStore);

      // Verify database file exists
      const dbPath = path.join(tempDir, 'test.db');
      expect(fs.existsSync(dbPath)).toBe(true);

      store.close();
    });
  });

  describe('cleanupTaskStore', () => {
    let store: TaskStore;

    beforeEach(async () => {
      cleanup = new TestCleanup();
      store = await cleanup.createTestTaskStore(tempDir);
    });

    afterEach(() => {
      if (store) {
        store.close();
      }
    });

    it('should clear all data from TaskStore database', async () => {
      // Add some test data
      const task1 = await store.createTask({
        description: 'Task 1',
        workflow: 'development',
        agent: 'developer',
      });

      const task2 = await store.createTask({
        description: 'Task 2',
        workflow: 'development',
        agent: 'developer',
      });

      // Verify data exists
      const allTasks = await store.getAllTasks();
      expect(allTasks).toHaveLength(2);

      // Clean up the store
      await cleanup.cleanupTaskStore(store);

      // Verify data is cleared
      const allTasksAfterCleanup = await store.getAllTasks();
      expect(allTasksAfterCleanup).toHaveLength(0);
    });

    it('should handle cleanup of store with no data gracefully', async () => {
      // Clean up empty store should not throw
      await expect(cleanup.cleanupTaskStore(store)).resolves.not.toThrow();

      // Verify store is still functional
      const task = await store.createTask({
        description: 'Post cleanup task',
        workflow: 'development',
        agent: 'developer',
      });
      expect(task.description).toBe('Post cleanup task');
    });

    it('should preserve database schema after cleanup', async () => {
      // Add test data
      await store.createTask({
        description: 'Test task',
        workflow: 'development',
        agent: 'developer',
      });

      // Clean up
      await cleanup.cleanupTaskStore(store);

      // Verify we can still use the store normally
      const newTask = await store.createTask({
        description: 'New task after cleanup',
        workflow: 'development',
        agent: 'developer',
      });

      expect(newTask.description).toBe('New task after cleanup');
    });
  });

  describe('environment variable management', () => {
    const originalApexHome = process.env.APEX_HOME;
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
      cleanup = new TestCleanup();
    });

    afterEach(() => {
      // Restore original values
      if (originalApexHome !== undefined) {
        process.env.APEX_HOME = originalApexHome;
      } else {
        delete process.env.APEX_HOME;
      }

      if (originalNodeEnv !== undefined) {
        process.env.NODE_ENV = originalNodeEnv;
      } else {
        delete process.env.NODE_ENV;
      }
    });

    it('should save current environment state', () => {
      process.env.APEX_HOME = '/test/apex/home';
      process.env.NODE_ENV = 'test';

      cleanup.saveEnvironmentState();

      // Modify environment
      process.env.APEX_HOME = '/modified/path';
      process.env.NODE_ENV = 'modified';

      // Restore should bring back original values
      cleanup.restoreEnvironmentState();

      expect(process.env.APEX_HOME).toBe('/test/apex/home');
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('should restore undefined environment variables', () => {
      delete process.env.APEX_HOME;
      delete process.env.NODE_ENV;

      cleanup.saveEnvironmentState();

      // Set variables
      process.env.APEX_HOME = '/some/path';
      process.env.NODE_ENV = 'production';

      // Restore should remove them
      cleanup.restoreEnvironmentState();

      expect(process.env.APEX_HOME).toBeUndefined();
      expect(process.env.NODE_ENV).toBeUndefined();
    });

    it('should not reset environment variables when disabled', () => {
      cleanup = new TestCleanup({ resetEnvVars: false });

      process.env.APEX_HOME = '/original';
      cleanup.saveEnvironmentState();

      process.env.APEX_HOME = '/modified';
      cleanup.restoreEnvironmentState();

      // Should remain modified
      expect(process.env.APEX_HOME).toBe('/modified');
    });
  });

  describe('database file cleanup', () => {
    beforeEach(() => {
      cleanup = new TestCleanup({ useInMemoryDb: false, preserveDbFiles: false });
    });

    it('should remove test database files after cleanup', async () => {
      const dbPath = path.join(tempDir, 'test.db');
      cleanup = new TestCleanup({
        useInMemoryDb: false,
        testDbPath: dbPath,
        preserveDbFiles: false
      });

      const store = await cleanup.createTestTaskStore(tempDir);

      // Verify files exist
      expect(fs.existsSync(dbPath)).toBe(true);

      store.close();
      cleanup.cleanupDatabaseFiles();

      // Verify files are removed
      expect(fs.existsSync(dbPath)).toBe(false);
      expect(fs.existsSync(`${dbPath}-wal`)).toBe(false);
      expect(fs.existsSync(`${dbPath}-shm`)).toBe(false);
    });

    it('should preserve database files when configured', async () => {
      const dbPath = path.join(tempDir, 'preserved.db');
      cleanup = new TestCleanup({
        useInMemoryDb: false,
        testDbPath: dbPath,
        preserveDbFiles: true
      });

      const store = await cleanup.createTestTaskStore(tempDir);
      store.close();

      cleanup.cleanupDatabaseFiles();

      // Verify files are preserved
      expect(fs.existsSync(dbPath)).toBe(true);
    });
  });
});

describe('TestHooks', () => {
  let hooks: TestHooks;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-test-hooks-'));
    hooks = new TestHooks();
  });

  afterEach(async () => {
    await hooks.afterEach();

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('lifecycle hooks', () => {
    it('should setup and cleanup test state', async () => {
      await hooks.beforeEach();

      // Create test store
      const store = await hooks.createTaskStore(tempDir);
      expect(store).toBeInstanceOf(TaskStore);

      // Add test data
      await store.createTask({
        description: 'Test task',
        workflow: 'development',
        agent: 'developer',
      });

      // Cleanup should clear everything
      await hooks.afterEach();

      // Subsequent setup should start fresh
      await hooks.beforeEach();
      const newStore = await hooks.createTaskStore(tempDir);
      const tasks = await newStore.getAllTasks();
      expect(tasks).toHaveLength(0);
    });

    it('should handle multiple stores in same test', async () => {
      await hooks.beforeEach();

      const store1 = await hooks.createTaskStore(tempDir);
      const store2 = await hooks.createTaskStore(path.join(tempDir, 'other'));

      await store1.createTask({
        description: 'Store 1 task',
        workflow: 'development',
        agent: 'developer',
      });

      await store2.createTask({
        description: 'Store 2 task',
        workflow: 'development',
        agent: 'developer',
      });

      // Both stores should have data
      expect((await store1.getAllTasks())).toHaveLength(1);
      expect((await store2.getAllTasks())).toHaveLength(1);

      // Cleanup should handle both stores
      await expect(hooks.afterEach()).resolves.not.toThrow();
    });
  });

  describe('resetTaskStore', () => {
    it('should reset TaskStore to clean state without recreating', async () => {
      await hooks.beforeEach();

      const store = await hooks.createTaskStore(tempDir);

      // Add test data
      await store.createTask({
        description: 'Test task',
        workflow: 'development',
        agent: 'developer',
      });

      expect((await store.getAllTasks())).toHaveLength(1);

      // Reset store
      await hooks.resetTaskStore(store);

      // Verify store is reset but still functional
      expect((await store.getAllTasks())).toHaveLength(0);

      const newTask = await store.createTask({
        description: 'New task',
        workflow: 'development',
        agent: 'developer',
      });
      expect(newTask.description).toBe('New task');
    });
  });
});

describe('createTestHooks', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-create-hooks-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should create test hooks with default configuration', () => {
    const testHooks = createTestHooks();

    expect(testHooks.beforeEach).toBeDefined();
    expect(testHooks.afterEach).toBeDefined();
    expect(testHooks.createTaskStore).toBeDefined();
    expect(testHooks.resetTaskStore).toBeDefined();
  });

  it('should create test hooks with custom configuration', () => {
    const config: CleanupConfig = {
      useInMemoryDb: false,
      preserveDbFiles: true,
    };

    const testHooks = createTestHooks(config);

    expect(testHooks.beforeEach).toBeDefined();
    expect(testHooks.afterEach).toBeDefined();
    expect(testHooks.createTaskStore).toBeDefined();
    expect(testHooks.resetTaskStore).toBeDefined();
  });

  it('should provide functional hooks for test lifecycle', async () => {
    const testHooks = createTestHooks();

    // Setup
    await testHooks.beforeEach();

    // Use hooks
    const store = await testHooks.createTaskStore(tempDir);
    await store.createTask({
      description: 'Test task',
      workflow: 'development',
      agent: 'developer',
    });

    expect((await store.getAllTasks())).toHaveLength(1);

    // Reset specific store
    await testHooks.resetTaskStore(store);
    expect((await store.getAllTasks())).toHaveLength(0);

    // Cleanup
    await testHooks.afterEach();
  });
});

describe('TestAssertions', () => {
  let store: TaskStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-assertions-'));
    const cleanup = new TestCleanup();
    store = await cleanup.createTestTaskStore(tempDir);
  });

  afterEach(() => {
    if (store) {
      store.close();
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('assertEmptyDatabase', () => {
    it('should pass for empty database', async () => {
      await expect(TestAssertions.assertEmptyDatabase(store)).resolves.not.toThrow();
    });

    it('should fail when database has tasks', async () => {
      await store.createTask({
        description: 'Test task',
        workflow: 'development',
        agent: 'developer',
      });

      await expect(TestAssertions.assertEmptyDatabase(store))
        .rejects.toThrow('Expected empty tasks table, found 1 tasks');
    });

    it('should fail when database has templates', async () => {
      await store.createTaskTemplate({
        name: 'Test template',
        description: 'Template description',
        workflow: 'development',
        agent: 'developer',
      });

      await expect(TestAssertions.assertEmptyDatabase(store))
        .rejects.toThrow('Expected empty task_templates table, found 1 templates');
    });
  });

  describe('assertTablesEmpty', () => {
    it('should pass when specified tables are empty', async () => {
      await expect(TestAssertions.assertTablesEmpty(store, ['tasks', 'task_templates']))
        .resolves.not.toThrow();
    });

    it('should fail when specified table has data', async () => {
      await store.createTask({
        description: 'Test task',
        workflow: 'development',
        agent: 'developer',
      });

      await expect(TestAssertions.assertTablesEmpty(store, ['tasks']))
        .rejects.toThrow('Expected empty tasks table, found 1 records');
    });
  });

  describe('getDatabaseStats', () => {
    it('should return stats for empty database', async () => {
      const stats = await TestAssertions.getDatabaseStats(store);

      expect(stats).toBeTypeOf('object');
      expect(stats.tasks).toBe(0);
      expect(stats.task_templates).toBe(0);
      expect(stats.task_logs).toBe(0);
    });

    it('should return correct counts when database has data', async () => {
      // Add test data
      await store.createTask({
        description: 'Task 1',
        workflow: 'development',
        agent: 'developer',
      });

      await store.createTask({
        description: 'Task 2',
        workflow: 'development',
        agent: 'developer',
      });

      await store.createTaskTemplate({
        name: 'Template 1',
        description: 'Template description',
        workflow: 'development',
        agent: 'developer',
      });

      const stats = await TestAssertions.getDatabaseStats(store);

      expect(stats.tasks).toBe(2);
      expect(stats.task_templates).toBe(1);
      expect(stats.task_logs).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Integration: Full test isolation workflow', () => {
  it('should demonstrate complete test isolation pattern', async () => {
    const testHooks = createTestHooks();

    // Test 1: Create data
    await testHooks.beforeEach();
    const store1 = await testHooks.createTaskStore();

    const task1 = await store1.createTask({
      description: 'Test task 1',
      workflow: 'development',
      agent: 'developer',
    });

    expect((await store1.getAllTasks())).toHaveLength(1);
    await testHooks.afterEach();

    // Test 2: Should start with clean state
    await testHooks.beforeEach();
    const store2 = await testHooks.createTaskStore();

    // Verify isolation - no data from previous test
    await TestAssertions.assertEmptyDatabase(store2);

    const task2 = await store2.createTask({
      description: 'Test task 2',
      workflow: 'development',
      agent: 'developer',
    });

    expect((await store2.getAllTasks())).toHaveLength(1);
    expect(task2.id).not.toBe(task1.id); // Different IDs
    await testHooks.afterEach();

    // Test 3: Should again start with clean state
    await testHooks.beforeEach();
    const store3 = await testHooks.createTaskStore();

    await TestAssertions.assertEmptyDatabase(store3);
    await testHooks.afterEach();
  });

  it('should handle errors gracefully during cleanup', async () => {
    const testHooks = createTestHooks();

    await testHooks.beforeEach();
    const store = await testHooks.createTaskStore();

    // Close store prematurely to simulate error condition
    store.close();

    // Cleanup should still work without throwing
    await expect(testHooks.afterEach()).resolves.not.toThrow();
  });
});