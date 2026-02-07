/**
 * @fileoverview Integration Tests for Test Cleanup Utilities
 *
 * Tests the state cleanup utilities in realistic scenarios including:
 * - Real TaskStore operations with complex data
 * - Cross-package integration scenarios
 * - Real-world workflow simulation
 * - Performance with larger datasets
 * - Memory leak prevention
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createTestHooks, TestAssertions, type CleanupConfig } from '../test-cleanup.js';
import { TaskStore } from '../store.js';
import { ApexOrchestrator } from '../index.js';

describe('Test Cleanup Integration Tests', () => {
  describe('Real-world TaskStore operations', () => {
    const testHooks = createTestHooks();
    let store: TaskStore;

    beforeEach(async () => {
      await testHooks.beforeEach();
      store = await testHooks.createTaskStore();
    });

    afterEach(async () => {
      await testHooks.afterEach();
    });

    it('should handle complete task lifecycle with cleanup', async () => {
      // Create a realistic task with full lifecycle
      const task = await store.createTask({
        description: 'Implement user authentication system',
        workflow: 'development',
        agent: 'developer',
        autonomy: 'full',
        acceptanceCriteria: [
          'User can register with email/password',
          'User can login and logout',
          'Password reset functionality works',
          'Session management is secure'
        ],
        projectPath: '/tmp/auth-project',
        branchName: 'feature/auth-system',
      });

      // Create task template for reuse
      const template = await store.createTaskTemplate({
        name: 'Authentication Implementation',
        description: 'Standard auth implementation template',
        workflow: 'development',
        agent: 'developer',
        acceptanceCriteria: [
          'User registration',
          'User login/logout',
          'Password reset',
          'Session management'
        ],
      });

      // Log task progress
      await store.createLog({
        taskId: task.id,
        stage: 'planning',
        agent: 'architect',
        level: 'info',
        message: 'Architecture planning completed',
        metadata: {
          componentsIdentified: ['AuthService', 'UserController', 'SessionManager'],
          dependencies: ['bcrypt', 'jsonwebtoken', 'express-session']
        }
      });

      // Update task status
      await store.updateTask(task.id, {
        status: 'in_progress',
        currentStage: 'implementation',
        metadata: {
          ...task.metadata,
          startedAt: new Date().toISOString(),
          assignedDeveloper: 'ai-agent-dev-001'
        }
      });

      // Verify everything exists
      const allTasks = await store.getAllTasks();
      const allTemplates = await store.getAllTaskTemplates();
      const logs = await store.getTaskLogs(task.id);

      expect(allTasks).toHaveLength(1);
      expect(allTemplates).toHaveLength(1);
      expect(logs).toHaveLength(1);

      // Reset store - should clear everything
      await testHooks.resetTaskStore(store);

      // Verify complete cleanup
      await TestAssertions.assertEmptyDatabase(store);

      const stats = await TestAssertions.getDatabaseStats(store);
      expect(stats.tasks).toBe(0);
      expect(stats.task_templates).toBe(0);
      expect(stats.task_logs).toBe(0);
    });

    it('should handle multiple related tasks with complex relationships', async () => {
      // Create parent task
      const parentTask = await store.createTask({
        description: 'Build e-commerce platform',
        workflow: 'epic',
        agent: 'architect',
        autonomy: 'supervised',
        projectPath: '/tmp/ecommerce-project',
      });

      // Create related subtasks
      const authTask = await store.createTask({
        description: 'Implement authentication',
        workflow: 'development',
        agent: 'developer',
        autonomy: 'full',
        projectPath: '/tmp/ecommerce-project',
        parentTaskId: parentTask.id,
      });

      const catalogTask = await store.createTask({
        description: 'Build product catalog',
        workflow: 'development',
        agent: 'developer',
        autonomy: 'full',
        projectPath: '/tmp/ecommerce-project',
        parentTaskId: parentTask.id,
      });

      const paymentTask = await store.createTask({
        description: 'Integrate payment system',
        workflow: 'development',
        agent: 'developer',
        autonomy: 'supervised',
        projectPath: '/tmp/ecommerce-project',
        parentTaskId: parentTask.id,
      });

      // Link subtasks to parent
      await store.updateTask(parentTask.id, {
        subtaskIds: [authTask.id, catalogTask.id, paymentTask.id]
      });

      // Add logs for different tasks
      await store.createLog({
        taskId: parentTask.id,
        stage: 'planning',
        agent: 'architect',
        level: 'info',
        message: 'Epic breakdown completed',
      });

      await store.createLog({
        taskId: authTask.id,
        stage: 'implementation',
        agent: 'developer',
        level: 'info',
        message: 'Auth service implemented',
      });

      await store.createLog({
        taskId: catalogTask.id,
        stage: 'testing',
        agent: 'tester',
        level: 'warning',
        message: 'Performance issue detected in product search',
      });

      // Verify complex data structure
      const tasks = await store.getAllTasks();
      const parentLogs = await store.getTaskLogs(parentTask.id);
      const authLogs = await store.getTaskLogs(authTask.id);
      const catalogLogs = await store.getTaskLogs(catalogTask.id);

      expect(tasks).toHaveLength(4);
      expect(parentLogs).toHaveLength(1);
      expect(authLogs).toHaveLength(1);
      expect(catalogLogs).toHaveLength(1);

      // Clean up should handle all relationships
      await testHooks.resetTaskStore(store);
      await TestAssertions.assertEmptyDatabase(store);
    });

    it('should handle task failures and error scenarios with cleanup', async () => {
      // Create tasks that simulate failures
      const failedTask = await store.createTask({
        description: 'Task that will fail',
        workflow: 'development',
        agent: 'developer',
        autonomy: 'full',
        projectPath: '/tmp/failed-project',
      });

      // Simulate task progression and failure
      await store.updateTask(failedTask.id, {
        status: 'in_progress',
        currentStage: 'implementation',
      });

      await store.createLog({
        taskId: failedTask.id,
        stage: 'implementation',
        agent: 'developer',
        level: 'error',
        message: 'Build failed due to compilation errors',
        metadata: {
          error: 'TypeScript compilation error in AuthService.ts:45',
          stackTrace: 'Error: Cannot find module...',
          failureCount: 3
        }
      });

      // Update task to failed status with detailed error
      await store.updateTask(failedTask.id, {
        status: 'failed',
        error: JSON.stringify({
          stage: 'implementation',
          message: 'Build compilation failed after 3 attempts',
          details: 'TypeScript errors in authentication module',
          timestamp: new Date().toISOString()
        })
      });

      // Verify error data exists
      const task = await store.getTask(failedTask.id);
      const logs = await store.getTaskLogs(failedTask.id);

      expect(task?.status).toBe('failed');
      expect(task?.error).toContain('Build compilation failed');
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');

      // Cleanup should handle failed tasks completely
      await testHooks.resetTaskStore(store);
      await TestAssertions.assertEmptyDatabase(store);
    });
  });

  describe('Cross-package integration scenarios', () => {
    const testHooks = createTestHooks();

    beforeEach(async () => {
      await testHooks.beforeEach();
    });

    afterEach(async () => {
      await testHooks.afterEach();
    });

    it('should integrate with ApexOrchestrator for complete workflow', async () => {
      const store = await testHooks.createTaskStore();

      // Create orchestrator instance with test store
      const orchestrator = new ApexOrchestrator(store.getProjectPath());

      // Mock the internal store to use our test store
      const originalGetStore = orchestrator.getTaskStore;
      orchestrator.getTaskStore = vi.fn().mockReturnValue(store);

      try {
        // Create task through orchestrator
        const taskId = await orchestrator.createTask({
          description: 'Integration test task',
          workflow: 'development',
          agent: 'developer',
          autonomy: 'full'
        });

        // Verify task was created
        const task = await store.getTask(taskId);
        expect(task).toBeDefined();
        expect(task?.description).toBe('Integration test task');

        // Execute workflow step
        await orchestrator.updateTaskStatus(taskId, 'in_progress');

        const updatedTask = await store.getTask(taskId);
        expect(updatedTask?.status).toBe('in_progress');

        // Cleanup should work with orchestrator integration
        await testHooks.resetTaskStore(store);
        await TestAssertions.assertEmptyDatabase(store);

      } finally {
        // Restore original method
        orchestrator.getTaskStore = originalGetStore;
      }
    });

    it('should handle environment isolation for different project contexts', async () => {
      const projectA = '/tmp/project-a';
      const projectB = '/tmp/project-b';

      const storeA = await testHooks.createTaskStore(projectA);
      const storeB = await testHooks.createTaskStore(projectB);

      // Create tasks in different project contexts
      const taskA = await storeA.createTask({
        description: 'Task in project A',
        workflow: 'development',
        agent: 'developer',
        projectPath: projectA,
      });

      const taskB = await storeB.createTask({
        description: 'Task in project B',
        workflow: 'development',
        agent: 'developer',
        projectPath: projectB,
      });

      // Verify isolation
      const tasksA = await storeA.getAllTasks();
      const tasksB = await storeB.getAllTasks();

      expect(tasksA).toHaveLength(1);
      expect(tasksB).toHaveLength(1);
      expect(tasksA[0].id).not.toBe(tasksB[0].id);

      // Verify project paths are isolated
      expect(tasksA[0].projectPath).toBe(projectA);
      expect(tasksB[0].projectPath).toBe(projectB);

      // Both stores should clean up independently
      await testHooks.resetTaskStore(storeA);

      // Store A should be empty, Store B should still have data
      await TestAssertions.assertEmptyDatabase(storeA);
      const remainingTasksB = await storeB.getAllTasks();
      expect(remainingTasksB).toHaveLength(1);
    });
  });

  describe('Performance and scalability tests', () => {
    const testHooks = createTestHooks({ useInMemoryDb: true });

    beforeEach(async () => {
      await testHooks.beforeEach();
    });

    afterEach(async () => {
      await testHooks.afterEach();
    });

    it('should handle cleanup of large datasets efficiently', async () => {
      const store = await testHooks.createTaskStore();
      const startTime = Date.now();

      // Create a large number of tasks, templates, and logs
      const TASK_COUNT = 100;
      const TEMPLATE_COUNT = 20;
      const LOGS_PER_TASK = 5;

      // Create task templates
      const templates = [];
      for (let i = 0; i < TEMPLATE_COUNT; i++) {
        const template = await store.createTaskTemplate({
          name: `Template ${i}`,
          description: `Performance test template ${i}`,
          workflow: 'development',
          agent: 'developer',
        });
        templates.push(template);
      }

      // Create tasks
      const tasks = [];
      for (let i = 0; i < TASK_COUNT; i++) {
        const task = await store.createTask({
          description: `Performance test task ${i}`,
          workflow: 'development',
          agent: 'developer',
          autonomy: 'full',
          projectPath: `/tmp/perf-test-${i}`,
          metadata: {
            iteration: i,
            benchmark: true,
            largeData: 'x'.repeat(1000) // 1KB of data per task
          }
        });
        tasks.push(task);
      }

      // Create logs for each task
      for (const task of tasks) {
        for (let i = 0; i < LOGS_PER_TASK; i++) {
          await store.createLog({
            taskId: task.id,
            stage: ['planning', 'implementation', 'testing', 'deployment'][i % 4],
            agent: 'developer',
            level: ['info', 'debug', 'warning', 'error'][i % 4] as any,
            message: `Performance test log ${i} for task ${task.id}`,
            metadata: {
              iteration: i,
              taskId: task.id,
              benchmark: true
            }
          });
        }
      }

      const setupTime = Date.now() - startTime;

      // Verify data was created
      const allTasks = await store.getAllTasks();
      const allTemplates = await store.getAllTaskTemplates();
      const stats = await TestAssertions.getDatabaseStats(store);

      expect(allTasks).toHaveLength(TASK_COUNT);
      expect(allTemplates).toHaveLength(TEMPLATE_COUNT);
      expect(stats.task_logs).toBe(TASK_COUNT * LOGS_PER_TASK);

      // Measure cleanup performance
      const cleanupStartTime = Date.now();
      await testHooks.resetTaskStore(store);
      const cleanupTime = Date.now() - cleanupStartTime;

      // Verify complete cleanup
      await TestAssertions.assertEmptyDatabase(store);

      // Performance assertions
      expect(setupTime).toBeLessThan(10000); // Setup should take less than 10s
      expect(cleanupTime).toBeLessThan(1000); // Cleanup should take less than 1s

      console.log(`Performance test completed:
        - Setup: ${setupTime}ms
        - Cleanup: ${cleanupTime}ms
        - Data created: ${TASK_COUNT} tasks, ${TEMPLATE_COUNT} templates, ${TASK_COUNT * LOGS_PER_TASK} logs`);
    });

    it('should handle repeated cleanup cycles without memory leaks', async () => {
      const store = await testHooks.createTaskStore();
      const CYCLES = 10;
      const TASKS_PER_CYCLE = 20;

      for (let cycle = 0; cycle < CYCLES; cycle++) {
        // Create tasks
        for (let i = 0; i < TASKS_PER_CYCLE; i++) {
          await store.createTask({
            description: `Cycle ${cycle} Task ${i}`,
            workflow: 'development',
            agent: 'developer',
            autonomy: 'full',
            projectPath: `/tmp/cycle-${cycle}-task-${i}`,
          });
        }

        // Verify data exists
        const tasks = await store.getAllTasks();
        expect(tasks).toHaveLength(TASKS_PER_CYCLE);

        // Clean up
        await testHooks.resetTaskStore(store);

        // Verify cleanup
        await TestAssertions.assertEmptyDatabase(store);
      }

      // Final verification
      await TestAssertions.assertEmptyDatabase(store);
    });
  });

  describe('Error handling and edge cases', () => {
    const testHooks = createTestHooks();

    beforeEach(async () => {
      await testHooks.beforeEach();
    });

    afterEach(async () => {
      await testHooks.afterEach();
    });

    it('should handle cleanup when store is closed prematurely', async () => {
      const store = await testHooks.createTaskStore();

      // Add some data
      await store.createTask({
        description: 'Task before store closure',
        workflow: 'development',
        agent: 'developer',
      });

      // Prematurely close the store
      store.close();

      // Cleanup should not throw even with closed store
      await expect(testHooks.resetTaskStore(store)).resolves.not.toThrow();
    });

    it('should handle cleanup with corrupted database gracefully', async () => {
      const store = await testHooks.createTaskStore();

      // Add some data
      await store.createTask({
        description: 'Task before corruption',
        workflow: 'development',
        agent: 'developer',
      });

      // Simulate database corruption by executing invalid SQL
      const db = store.getDatabase();

      // This should work normally
      await expect(testHooks.resetTaskStore(store)).resolves.not.toThrow();

      // Verify store can still be used
      const newTask = await store.createTask({
        description: 'Task after cleanup',
        workflow: 'development',
        agent: 'developer',
      });

      expect(newTask.description).toBe('Task after cleanup');
    });

    it('should handle concurrent cleanup operations safely', async () => {
      const store = await testHooks.createTaskStore();

      // Create multiple tasks
      for (let i = 0; i < 10; i++) {
        await store.createTask({
          description: `Concurrent test task ${i}`,
          workflow: 'development',
          agent: 'developer',
        });
      }

      // Attempt concurrent cleanup operations
      const cleanupPromises = [
        testHooks.resetTaskStore(store),
        testHooks.resetTaskStore(store),
        testHooks.resetTaskStore(store)
      ];

      // All should complete without errors
      await expect(Promise.all(cleanupPromises)).resolves.not.toThrow();

      // Database should be clean
      await TestAssertions.assertEmptyDatabase(store);
    });

    it('should handle environment variable conflicts gracefully', async () => {
      // Set up conflicting environment variables
      const originalApexHome = process.env.APEX_HOME;
      process.env.APEX_HOME = '/conflicting/path';

      try {
        const store = await testHooks.createTaskStore();

        // Change environment during test
        process.env.APEX_HOME = '/another/path';

        // Cleanup should handle environment conflicts
        await expect(testHooks.resetTaskStore(store)).resolves.not.toThrow();

      } finally {
        // Restore original environment
        if (originalApexHome) {
          process.env.APEX_HOME = originalApexHome;
        } else {
          delete process.env.APEX_HOME;
        }
      }
    });
  });

  describe('Memory and resource management', () => {
    const testHooks = createTestHooks();

    beforeEach(async () => {
      await testHooks.beforeEach();
    });

    afterEach(async () => {
      await testHooks.afterEach();
    });

    it('should prevent memory leaks with large data operations', async () => {
      const store = await testHooks.createTaskStore();

      // Get initial memory usage
      const initialMemory = process.memoryUsage();

      // Create and cleanup large amounts of data multiple times
      for (let cycle = 0; cycle < 5; cycle++) {
        // Create large tasks with significant metadata
        for (let i = 0; i < 50; i++) {
          await store.createTask({
            description: `Memory test task ${cycle}-${i}`,
            workflow: 'development',
            agent: 'developer',
            metadata: {
              largeArray: new Array(1000).fill(`data-${i}`),
              largeObject: Object.fromEntries(
                Array.from({ length: 100 }, (_, j) => [`key${j}`, `value-${i}-${j}`])
              )
            }
          });
        }

        // Clean up
        await testHooks.resetTaskStore(store);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      // Check final memory usage
      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory growth should be reasonable (less than 50MB)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);

      console.log(`Memory usage - Initial: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB, Final: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB, Growth: ${Math.round(memoryGrowth / 1024 / 1024)}MB`);
    });

    it('should handle file system resources properly', async () => {
      const config: CleanupConfig = {
        useInMemoryDb: false,
        preserveDbFiles: false,
        testDbPath: undefined
      };

      const fileTestHooks = createTestHooks(config);
      await fileTestHooks.beforeEach();

      try {
        // Create multiple stores with file-based databases
        const stores = [];
        const dbPaths = [];

        for (let i = 0; i < 5; i++) {
          const projectPath = path.join(os.tmpdir(), `test-db-${i}-${Date.now()}`);
          const store = await fileTestHooks.createTaskStore(projectPath);
          stores.push(store);

          const dbPath = path.join(projectPath, '.apex', 'apex.db');
          dbPaths.push(dbPath);

          // Add some data to create actual files
          await store.createTask({
            description: `File test task ${i}`,
            workflow: 'development',
            agent: 'developer',
          });

          // Verify file exists
          expect(fs.existsSync(dbPath)).toBe(true);
        }

        // Cleanup should remove all database files
        await fileTestHooks.afterEach();

        // Verify files are cleaned up
        for (const dbPath of dbPaths) {
          expect(fs.existsSync(dbPath)).toBe(false);
        }

      } catch (error) {
        await fileTestHooks.afterEach();
        throw error;
      }
    });
  });
});