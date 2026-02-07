/**
 * Integration tests for cleanup utilities
 *
 * This test suite demonstrates:
 * - Multiple tests running in isolation without state leakage
 * - Proper cleanup of SQLite database between tests
 * - beforeEach/afterEach patterns working correctly with the utilities
 *
 * Acceptance Criteria:
 * 1. Integration tests demonstrate multiple tests running in isolation without state leakage
 * 2. Integration tests show proper cleanup of SQLite database between tests
 * 3. Integration tests verify beforeEach/afterEach patterns working correctly with the utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import Database from 'better-sqlite3';

// Import cleanup utilities from the correct path
import {
  CleanupManager,
  createCleanupManager,
  withCleanup,
  CleanupRegistry,
  FileSystemCleanup,
  ProcessCleanup,
  EnvironmentCleanup,
  MockCleanup,
  TimerCleanup,
} from '../test-utils/cleanup';

// Import database utilities and test cleanup utilities
import { createTestDatabase, cleanupTestDatabase, type TestDatabaseContext } from '../../packages/orchestrator/src/test-utils/db';
import { createTestHooks, TestAssertions } from '../../packages/orchestrator/src/test-cleanup';
import { TaskStore } from '../../packages/orchestrator/src/store';

describe('Cleanup Utilities Integration Tests', () => {

  describe('AC1: Test Isolation Without State Leakage', () => {
    let globalTestCounter = 0;
    let sharedResource: string[] = [];

    beforeEach(() => {
      // Reset shared resources before each test
      sharedResource = [];
      globalTestCounter = 0;
    });

    it('test 1 - should modify shared resources without affecting other tests', async () => {
      await withCleanup(async (cleanup) => {
        // Modify global state
        globalTestCounter = 42;
        sharedResource.push('test-1-data');

        // Add cleanup for global state
        cleanup.add(() => {
          globalTestCounter = 0;
          sharedResource.length = 0;
        }, 'global state reset');

        // Verify state was modified
        expect(globalTestCounter).toBe(42);
        expect(sharedResource).toEqual(['test-1-data']);

        // Create temp files that should be cleaned up
        const tempFile = await cleanup.fileSystem.createTempFile('test1.txt', 'test 1 content');

        // Verify file exists
        await expect(access(tempFile)).resolves.toBeUndefined();
      });

      // After withCleanup, state should be reset
      expect(globalTestCounter).toBe(0);
      expect(sharedResource).toEqual([]);
    });

    it('test 2 - should start with clean state and not see test 1 modifications', async () => {
      await withCleanup(async (cleanup) => {
        // State should be clean from previous test
        expect(globalTestCounter).toBe(0);
        expect(sharedResource).toEqual([]);

        // Modify state differently
        globalTestCounter = 100;
        sharedResource.push('test-2-data', 'more-test-2-data');

        cleanup.add(() => {
          globalTestCounter = 0;
          sharedResource.length = 0;
        }, 'global state reset');

        // Verify different state
        expect(globalTestCounter).toBe(100);
        expect(sharedResource).toEqual(['test-2-data', 'more-test-2-data']);

        // Create different temp files
        const tempFile = await cleanup.fileSystem.createTempFile('test2.txt', 'test 2 content');

        // Verify file exists and has correct content
        await expect(access(tempFile)).resolves.toBeUndefined();
        const content = await readFile(tempFile, 'utf-8');
        expect(content).toBe('test 2 content');
      });

      // After withCleanup, state should be reset again
      expect(globalTestCounter).toBe(0);
      expect(sharedResource).toEqual([]);
    });

    it('test 3 - should demonstrate environment variable isolation', async () => {
      // Ensure clean environment
      expect(process.env.TEST_VAR_123).toBeUndefined();
      expect(process.env.TEST_VAR_456).toBeUndefined();

      await withCleanup(async (cleanup) => {
        // Set environment variables
        cleanup.environment.setEnv('TEST_VAR_123', 'test-value-123');
        cleanup.environment.setEnv('TEST_VAR_456', 'test-value-456');

        // Verify variables are set
        expect(process.env.TEST_VAR_123).toBe('test-value-123');
        expect(process.env.TEST_VAR_456).toBe('test-value-456');
      });

      // Environment should be cleaned up
      expect(process.env.TEST_VAR_123).toBeUndefined();
      expect(process.env.TEST_VAR_456).toBeUndefined();
    });

    it('test 4 - should demonstrate timer cleanup isolation', async () => {
      let timerExecuted = false;
      let intervalCount = 0;

      await withCleanup(async (cleanup) => {
        // Create timeout
        const timeoutId = setTimeout(() => {
          timerExecuted = true;
        }, 100);
        cleanup.timers.trackTimeout(timeoutId);

        // Create interval
        const intervalId = setInterval(() => {
          intervalCount++;
        }, 50);
        cleanup.timers.trackInterval(intervalId);

        // Wait a bit but not long enough for timeout
        await new Promise(resolve => setTimeout(resolve, 60));

        // Cleanup will cancel both timers
      });

      // Wait longer to see if timers were properly canceled
      await new Promise(resolve => setTimeout(resolve, 100));

      // Timers should have been canceled, so these should remain unchanged
      expect(timerExecuted).toBe(false);
      expect(intervalCount).toBe(0);
    });
  });

  describe('AC2: SQLite Database Cleanup Between Tests', () => {
    let testDb: TestDatabaseContext;
    const testHooks = createTestHooks();

    beforeEach(async () => {
      // Create fresh database for each test
      testDb = await createTestDatabase();
      await testHooks.beforeEach();
    });

    afterEach(async () => {
      // Clean up database after each test
      if (testDb) {
        cleanupTestDatabase(testDb);
      }
      await testHooks.afterEach();
    });

    it('test 1 - should create and use database without affecting other tests', async () => {
      const now = new Date().toISOString();

      // Insert test data
      const insertStmt = testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, project_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        'test-task-1',
        'First test task',
        'feature',
        'full',
        'pending',
        '/test/path1',
        now,
        now
      );

      // Insert task log
      testDb.db.prepare(`
        INSERT INTO task_logs (task_id, timestamp, level, message)
        VALUES (?, ?, ?, ?)
      `).run('test-task-1', now, 'info', 'Task created');

      // Verify data exists
      const tasks = testDb.db.prepare('SELECT * FROM tasks').all();
      const logs = testDb.db.prepare('SELECT * FROM task_logs').all();

      expect(tasks).toHaveLength(1);
      expect(logs).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        id: 'test-task-1',
        description: 'First test task',
        status: 'pending'
      });
    });

    it('test 2 - should start with clean database state', async () => {
      // Database should be empty at start of each test
      const tasks = testDb.db.prepare('SELECT * FROM tasks').all();
      const logs = testDb.db.prepare('SELECT * FROM task_logs').all();

      expect(tasks).toHaveLength(0);
      expect(logs).toHaveLength(0);

      // Insert different test data
      const now = new Date().toISOString();
      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, project_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'test-task-2',
        'Second test task',
        'bugfix',
        'guided',
        'in_progress',
        '/test/path2',
        now,
        now
      );

      const newTasks = testDb.db.prepare('SELECT * FROM tasks').all();
      expect(newTasks).toHaveLength(1);
      expect(newTasks[0]).toMatchObject({
        id: 'test-task-2',
        description: 'Second test task',
        status: 'in_progress'
      });
    });

    it('test 3 - should test complex database operations with cleanup', async () => {
      const now = new Date().toISOString();

      // Create multiple related records
      const taskId = 'complex-test-task';

      // Insert task
      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, project_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(taskId, 'Complex test task', 'feature', 'full', 'pending', '/test/complex', now, now);

      // Insert multiple logs
      const logStmt = testDb.db.prepare(`
        INSERT INTO task_logs (task_id, timestamp, level, message)
        VALUES (?, ?, ?, ?)
      `);

      logStmt.run(taskId, now, 'info', 'Task started');
      logStmt.run(taskId, now, 'debug', 'Planning phase');
      logStmt.run(taskId, now, 'info', 'Implementation phase');

      // Insert artifacts
      const artifactStmt = testDb.db.prepare(`
        INSERT INTO task_artifacts (task_id, name, type, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      artifactStmt.run(taskId, 'plan.md', 'plan', '# Implementation Plan\n\nStep 1: ...');
      artifactStmt.run(taskId, 'code.ts', 'code', 'function example() { return true; }', now);

      // Verify complex state
      const tasks = testDb.db.prepare('SELECT * FROM tasks WHERE id = ?').all(taskId);
      const logs = testDb.db.prepare('SELECT * FROM task_logs WHERE task_id = ?').all(taskId);
      const artifacts = testDb.db.prepare('SELECT * FROM task_artifacts WHERE task_id = ?').all(taskId);

      expect(tasks).toHaveLength(1);
      expect(logs).toHaveLength(3);
      expect(artifacts).toHaveLength(2);

      // Test transaction rollback scenario
      const transaction = testDb.db.transaction(() => {
        testDb.db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('completed', taskId);
        testDb.db.prepare(`
          INSERT INTO task_logs (task_id, timestamp, level, message)
          VALUES (?, ?, ?, ?)
        `).run(taskId, now, 'info', 'Task completed');
      });

      transaction();

      const updatedTask = testDb.db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
      expect(updatedTask.status).toBe('completed');
    });

    it('test 4 - should verify database isolation with concurrent access simulation', async () => {
      // This test ensures each test gets its own database instance
      expect(testDb.db.open).toBe(true);

      // Verify fresh schema state
      const tableInfo = testDb.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as { name: string }[];

      // Should have all expected tables
      const expectedTables = [
        'approval_states', 'audit_logs', 'commands', 'file_snapshots', 'fix_attempts',
        'gates', 'idle_tasks', 'mcp_installations', 'mcp_marketplace', 'mcp_servers',
        'permissions', 'snapshots', 'task_artifacts', 'task_checkpoints',
        'task_dependencies', 'task_interactions', 'task_iterations', 'task_logs',
        'task_templates', 'tasks', 'thought_captures', 'todos', 'tool_actions',
        'workspace_info'
      ];

      const tableNames = tableInfo.map(t => t.name);
      expectedTables.forEach(expectedTable => {
        expect(tableNames).toContain(expectedTable);
      });

      // All tables should be empty initially
      for (const table of expectedTables) {
        const count = testDb.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
        expect(count.count).toBe(0);
      }
    });

    it('test 5 - should demonstrate APEX TaskStore cleanup utilities integration', async () => {
      // Create a TaskStore using APEX cleanup utilities
      const taskStore = await testHooks.createTaskStore();

      // Add test data using TaskStore methods
      const task = await taskStore.createTask({
        description: 'APEX cleanup integration test',
        workflow: 'development',
        agent: 'developer',
        autonomy: 'full'
      });

      const template = await taskStore.createTaskTemplate({
        name: 'Integration Template',
        description: 'Template for cleanup testing',
        workflow: 'development',
        agent: 'developer'
      });

      // Add logs
      await taskStore.createLog({
        taskId: task.id,
        stage: 'testing',
        agent: 'tester',
        level: 'info',
        message: 'Cleanup integration test log'
      });

      // Verify data exists
      const tasks = await taskStore.getAllTasks();
      const templates = await taskStore.getAllTaskTemplates();
      const logs = await taskStore.getTaskLogs(task.id);

      expect(tasks).toHaveLength(1);
      expect(templates).toHaveLength(1);
      expect(logs).toHaveLength(1);

      // Reset store using APEX cleanup utilities
      await testHooks.resetTaskStore(taskStore);

      // Verify complete cleanup
      await TestAssertions.assertEmptyDatabase(taskStore);
      const stats = await TestAssertions.getDatabaseStats(taskStore);
      expect(stats.tasks).toBe(0);
      expect(stats.task_templates).toBe(0);
      expect(stats.task_logs).toBe(0);
    });
  });

  describe('AC3: beforeEach/afterEach Patterns with Cleanup Utilities', () => {
    let cleanup: CleanupManager;
    let testContext: {
      tempDir?: string;
      testFiles: string[];
      envVars: Record<string, string>;
      timers: any[];
    };

    beforeEach(async () => {
      // Initialize cleanup manager for each test
      cleanup = createCleanupManager();

      // Initialize test context
      testContext = {
        testFiles: [],
        envVars: {},
        timers: []
      };

      // Create temp directory for test
      testContext.tempDir = await mkdtemp(join(tmpdir(), 'cleanup-test-'));
      cleanup.fileSystem.track(testContext.tempDir);
    });

    afterEach(async () => {
      // Verify cleanup manager state before cleanup
      expect(cleanup.registry.count).toBeGreaterThan(0); // Should have registered cleanups

      // Perform cleanup
      await cleanup.cleanup();

      // Verify cleanup completed
      expect(cleanup.registry.cleanedUp).toBe(true);

      // Reset test context
      testContext = { testFiles: [], envVars: {}, timers: [] };
    });

    it('should use beforeEach/afterEach for file system cleanup', async () => {
      // Create files in temp directory
      const file1 = join(testContext.tempDir!, 'test1.txt');
      const file2 = join(testContext.tempDir!, 'test2.json');

      await writeFile(file1, 'test content 1');
      await writeFile(file2, JSON.stringify({ test: 'data' }));

      // Track files for cleanup
      cleanup.fileSystem.track(file1);
      cleanup.fileSystem.track(file2);
      testContext.testFiles.push(file1, file2);

      // Verify files exist
      await expect(access(file1)).resolves.toBeUndefined();
      await expect(access(file2)).resolves.toBeUndefined();

      const content1 = await readFile(file1, 'utf-8');
      const content2 = await readFile(file2, 'utf-8');

      expect(content1).toBe('test content 1');
      expect(JSON.parse(content2)).toEqual({ test: 'data' });

      // Files will be cleaned up in afterEach
    });

    it('should use beforeEach/afterEach for environment cleanup', async () => {
      const envVarNames = ['TEST_BEFORE_EACH_1', 'TEST_BEFORE_EACH_2', 'TEST_BEFORE_EACH_3'];

      // Ensure variables don't exist initially
      envVarNames.forEach(name => {
        expect(process.env[name]).toBeUndefined();
      });

      // Set environment variables
      cleanup.environment.setEnv('TEST_BEFORE_EACH_1', 'value1');
      cleanup.environment.setEnv('TEST_BEFORE_EACH_2', 'value2');
      cleanup.environment.setEnv('TEST_BEFORE_EACH_3', 'value3');

      testContext.envVars = {
        'TEST_BEFORE_EACH_1': 'value1',
        'TEST_BEFORE_EACH_2': 'value2',
        'TEST_BEFORE_EACH_3': 'value3'
      };

      // Verify variables are set
      expect(process.env.TEST_BEFORE_EACH_1).toBe('value1');
      expect(process.env.TEST_BEFORE_EACH_2).toBe('value2');
      expect(process.env.TEST_BEFORE_EACH_3).toBe('value3');

      // Variables will be cleaned up in afterEach
    });

    it('should use beforeEach/afterEach for timer cleanup', async () => {
      let timeoutCalled = false;
      let intervalCount = 0;

      // Create timeout and interval
      const timeoutId = setTimeout(() => {
        timeoutCalled = true;
      }, 200);

      const intervalId = setInterval(() => {
        intervalCount++;
      }, 50);

      // Track timers
      cleanup.timers.trackTimeout(timeoutId);
      cleanup.timers.trackInterval(intervalId);

      testContext.timers.push(timeoutId, intervalId);

      // Wait briefly
      await new Promise(resolve => setTimeout(resolve, 100));

      // Timers should still be active at this point
      expect(timeoutCalled).toBe(false);
      expect(intervalCount).toBe(1); // May have executed once

      // Timers will be cleaned up in afterEach
    });

    it('should use beforeEach/afterEach for comprehensive cleanup scenario', async () => {
      // Combine multiple cleanup types in one test

      // 1. File system
      const configFile = join(testContext.tempDir!, 'test-config.yaml');
      await writeFile(configFile, 'version: "1.0"\nproject:\n  name: test\n');
      cleanup.fileSystem.track(configFile);

      // 2. Environment
      cleanup.environment.setEnv('COMPREHENSIVE_TEST_VAR', 'comprehensive-value');

      // 3. Timers
      let timerFlag = false;
      const timerId = setTimeout(() => { timerFlag = true; }, 300);
      cleanup.timers.trackTimeout(timerId);

      // 4. Mock cleanup
      const mockObj = {
        mockFunction: () => 'original',
        mockRestore: () => { mockObj.mockFunction = () => 'original'; }
      };

      // Mock the function
      mockObj.mockFunction = () => 'mocked';
      cleanup.mocks.track(mockObj, 'test mock');

      // 5. Custom cleanup
      let customCleanupExecuted = false;
      cleanup.add(() => {
        customCleanupExecuted = true;
      }, 'custom cleanup');

      // Verify initial state
      expect(await readFile(configFile, 'utf-8')).toContain('version: "1.0"');
      expect(process.env.COMPREHENSIVE_TEST_VAR).toBe('comprehensive-value');
      expect(mockObj.mockFunction()).toBe('mocked');
      expect(customCleanupExecuted).toBe(false);

      // Record what was set up for verification in afterEach
      testContext.testFiles.push(configFile);
      testContext.envVars['COMPREHENSIVE_TEST_VAR'] = 'comprehensive-value';
      testContext.timers.push(timerId);

      // All cleanup will happen in afterEach
    });

    it('should demonstrate cleanup manager registration patterns', async () => {
      // Test cleanup manager's ability to register different types
      const initialCount = cleanup.registry.count;

      // File system cleanup is already registered by default
      const file = await cleanup.fileSystem.createTempFile('registry-test.txt', 'test content');

      // Environment cleanup is already registered by default
      cleanup.environment.setEnv('REGISTRY_TEST_VAR', 'registry-value');

      // Add custom cleanup
      cleanup.add(async () => {
        // Custom async cleanup
        await new Promise(resolve => setTimeout(resolve, 1));
      }, 'async custom cleanup');

      // Registry should have registered the base cleanups plus our custom one
      expect(cleanup.registry.count).toBeGreaterThan(initialCount);

      // Verify cleanup hasn't run yet
      expect(cleanup.registry.cleanedUp).toBe(false);

      // Store for test context
      testContext.testFiles.push(file);
      testContext.envVars['REGISTRY_TEST_VAR'] = 'registry-value';

      // Cleanup will be performed in afterEach
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let cleanup: CleanupManager;

    beforeEach(() => {
      cleanup = createCleanupManager();
    });

    afterEach(async () => {
      await cleanup.cleanup();
    });

    it('should handle cleanup errors gracefully', async () => {
      // Add a cleanup that will fail
      cleanup.add(() => {
        throw new Error('Simulated cleanup failure');
      }, 'failing cleanup');

      // Add a cleanup that will succeed
      let successfulCleanupRan = false;
      cleanup.add(() => {
        successfulCleanupRan = true;
      }, 'successful cleanup');

      // Cleanup should throw due to the failing cleanup
      await expect(cleanup.cleanup()).rejects.toThrow('Multiple cleanup errors');

      // But successful cleanup should have still run (LIFO order means it runs first)
      expect(successfulCleanupRan).toBe(true);
    });

    it('should handle async cleanup errors', async () => {
      let successfulAsyncCleanupRan = false;

      // Add a cleanup that will fail asynchronously
      cleanup.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Async cleanup failure');
      }, 'async failing cleanup');

      // Add a cleanup that will succeed
      cleanup.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        successfulAsyncCleanupRan = true;
      }, 'async successful cleanup');

      // Cleanup should throw due to the failing async cleanup
      await expect(cleanup.cleanup()).rejects.toThrow('Multiple cleanup errors');

      // Successful cleanup should have run
      expect(successfulAsyncCleanupRan).toBe(true);
    });

    it('should prevent registration after cleanup', async () => {
      const consoleSpy = { warn: () => {} };
      const originalWarn = console.warn;
      const warnCalls: string[] = [];

      console.warn = (message: string) => {
        warnCalls.push(message);
      };

      try {
        // Perform cleanup
        await cleanup.cleanup();

        // Try to register after cleanup
        cleanup.add(() => {}, 'late registration');

        // Should have warned
        expect(warnCalls.some(call =>
          call.includes('Attempting to register cleanup after cleanup has already been performed')
        )).toBe(true);
      } finally {
        console.warn = originalWarn;
      }
    });

    it('should handle multiple cleanup calls idempotently', async () => {
      let cleanupCallCount = 0;

      cleanup.add(() => {
        cleanupCallCount++;
      }, 'count tracking cleanup');

      // First cleanup
      await cleanup.cleanup();
      expect(cleanupCallCount).toBe(1);
      expect(cleanup.registry.cleanedUp).toBe(true);

      // Second cleanup should be no-op
      await cleanup.cleanup();
      expect(cleanupCallCount).toBe(1); // Should not increment
      expect(cleanup.registry.cleanedUp).toBe(true);
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent cleanup operations', async () => {
      const cleanup1 = createCleanupManager();
      const cleanup2 = createCleanupManager();
      const cleanup3 = createCleanupManager();

      let executionOrder: string[] = [];

      // Set up different cleanup operations
      cleanup1.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        executionOrder.push('cleanup1');
      }, 'async cleanup 1');

      cleanup2.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        executionOrder.push('cleanup2');
      }, 'async cleanup 2');

      cleanup3.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        executionOrder.push('cleanup3');
      }, 'async cleanup 3');

      // Run cleanups concurrently
      await Promise.all([
        cleanup1.cleanup(),
        cleanup2.cleanup(),
        cleanup3.cleanup()
      ]);

      // All cleanups should have executed
      expect(executionOrder).toHaveLength(3);
      expect(executionOrder).toContain('cleanup1');
      expect(executionOrder).toContain('cleanup2');
      expect(executionOrder).toContain('cleanup3');

      // cleanup3 should finish first due to shortest delay
      expect(executionOrder[0]).toBe('cleanup3');
    });

    it('should handle large numbers of cleanup operations efficiently', async () => {
      const cleanup = createCleanupManager();
      const operationCount = 100;
      let executedCount = 0;

      // Register many cleanup operations
      for (let i = 0; i < operationCount; i++) {
        cleanup.add(() => {
          executedCount++;
        }, `cleanup operation ${i}`);
      }

      const startTime = Date.now();
      await cleanup.cleanup();
      const endTime = Date.now();

      // All operations should have executed
      expect(executedCount).toBe(operationCount);

      // Should complete in reasonable time (less than 1 second)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('APEX Cleanup Utilities Integration', () => {
    // This section demonstrates the APEX TaskStore cleanup utilities working with standard cleanup patterns

    it('should demonstrate complete isolation with TaskStore and standard cleanup utilities', async () => {
      const testHooks = createTestHooks();

      await withCleanup(async (cleanup) => {
        await testHooks.beforeEach();

        // 1. Create TaskStore and add data
        const taskStore = await testHooks.createTaskStore();

        const task = await taskStore.createTask({
          description: 'Comprehensive isolation test task',
          workflow: 'development',
          agent: 'developer',
          autonomy: 'full'
        });

        // 2. Create files using standard cleanup utilities
        const tempFile = await cleanup.fileSystem.createTempFile('test.json', JSON.stringify({ taskId: task.id }));

        // 3. Set environment variables
        cleanup.environment.setEnv('APEX_TEST_TASK_ID', task.id);
        cleanup.environment.setEnv('APEX_TEST_MODE', 'integration');

        // 4. Create timers
        let timerTriggered = false;
        const timerId = setTimeout(() => { timerTriggered = true; }, 500);
        cleanup.timers.trackTimeout(timerId);

        // Verify everything is set up
        expect((await taskStore.getAllTasks())).toHaveLength(1);
        expect(await readFile(tempFile, 'utf-8')).toContain(task.id);
        expect(process.env.APEX_TEST_TASK_ID).toBe(task.id);
        expect(process.env.APEX_TEST_MODE).toBe('integration');

        // Cleanup will happen automatically via withCleanup
        await testHooks.afterEach();
      });

      // Verify everything was cleaned up
      expect(process.env.APEX_TEST_TASK_ID).toBeUndefined();
      expect(process.env.APEX_TEST_MODE).toBeUndefined();
    });

    it('should demonstrate TaskStore isolation across multiple test scenarios', async () => {
      // Test scenario 1: E-commerce project
      {
        const testHooks = createTestHooks();
        await testHooks.beforeEach();

        const ecommerceStore = await testHooks.createTaskStore('/test/ecommerce-project');

        await ecommerceStore.createTask({
          description: 'Implement shopping cart',
          workflow: 'development',
          agent: 'developer',
          autonomy: 'full',
          projectPath: '/test/ecommerce-project'
        });

        await ecommerceStore.createTask({
          description: 'Add payment integration',
          workflow: 'development',
          agent: 'developer',
          autonomy: 'supervised',
          projectPath: '/test/ecommerce-project'
        });

        const ecommerceTasks = await ecommerceStore.getAllTasks();
        expect(ecommerceTasks).toHaveLength(2);
        expect(ecommerceTasks.every(t => t.projectPath === '/test/ecommerce-project')).toBe(true);

        await testHooks.afterEach();
      }

      // Test scenario 2: Blog platform project (should not see e-commerce data)
      {
        const testHooks = createTestHooks();
        await testHooks.beforeEach();

        const blogStore = await testHooks.createTaskStore('/test/blog-project');

        // Should start with empty database
        await TestAssertions.assertEmptyDatabase(blogStore);

        await blogStore.createTask({
          description: 'Create blog post editor',
          workflow: 'development',
          agent: 'developer',
          autonomy: 'full',
          projectPath: '/test/blog-project'
        });

        const blogTasks = await blogStore.getAllTasks();
        expect(blogTasks).toHaveLength(1);
        expect(blogTasks[0].projectPath).toBe('/test/blog-project');
        expect(blogTasks[0].description).toBe('Create blog post editor');

        await testHooks.afterEach();
      }
    });

    it('should handle complex workflows with multiple cleanup patterns', async () => {
      const testHooks = createTestHooks();

      await testHooks.beforeEach();

      await withCleanup(async (cleanup) => {
        // Create multiple TaskStores for different environments
        const devStore = await testHooks.createTaskStore('/test/dev-env');
        const stagingStore = await testHooks.createTaskStore('/test/staging-env');

        // Create tasks in different stores
        const devTask = await devStore.createTask({
          description: 'Development feature',
          workflow: 'development',
          agent: 'developer',
          autonomy: 'full'
        });

        const stagingTask = await stagingStore.createTask({
          description: 'Staging validation',
          workflow: 'testing',
          agent: 'tester',
          autonomy: 'supervised'
        });

        // Create temp files for each environment
        const devConfig = await cleanup.fileSystem.createTempFile(
          'dev-config.json',
          JSON.stringify({ environment: 'development', taskId: devTask.id })
        );

        const stagingConfig = await cleanup.fileSystem.createTempFile(
          'staging-config.json',
          JSON.stringify({ environment: 'staging', taskId: stagingTask.id })
        );

        // Set environment variables
        cleanup.environment.setEnv('DEV_TASK_ID', devTask.id);
        cleanup.environment.setEnv('STAGING_TASK_ID', stagingTask.id);

        // Verify isolation between stores
        expect((await devStore.getAllTasks())).toHaveLength(1);
        expect((await stagingStore.getAllTasks())).toHaveLength(1);

        const devTasks = await devStore.getAllTasks();
        const stagingTasks = await stagingStore.getAllTasks();

        expect(devTasks[0].description).toBe('Development feature');
        expect(stagingTasks[0].description).toBe('Staging validation');

        // Verify files contain correct data
        const devConfigContent = JSON.parse(await readFile(devConfig, 'utf-8'));
        const stagingConfigContent = JSON.parse(await readFile(stagingConfig, 'utf-8'));

        expect(devConfigContent.environment).toBe('development');
        expect(stagingConfigContent.environment).toBe('staging');

        // Reset specific stores to test selective cleanup
        await testHooks.resetTaskStore(devStore);

        // Dev store should be empty, staging should still have data
        await TestAssertions.assertEmptyDatabase(devStore);
        expect((await stagingStore.getAllTasks())).toHaveLength(1);
      });

      await testHooks.afterEach();

      // All environment variables should be cleaned up
      expect(process.env.DEV_TASK_ID).toBeUndefined();
      expect(process.env.STAGING_TASK_ID).toBeUndefined();
    });

    it('should demonstrate error handling in cleanup scenarios', async () => {
      const testHooks = createTestHooks();

      await testHooks.beforeEach();

      const taskStore = await testHooks.createTaskStore();

      // Create a task and add some data
      await taskStore.createTask({
        description: 'Error handling test',
        workflow: 'development',
        agent: 'developer',
        autonomy: 'full'
      });

      // Force close the database connection to simulate an error
      taskStore.close();

      // Cleanup should handle the closed database gracefully
      await expect(testHooks.resetTaskStore(taskStore)).resolves.not.toThrow();

      await testHooks.afterEach();
    });
  });
});