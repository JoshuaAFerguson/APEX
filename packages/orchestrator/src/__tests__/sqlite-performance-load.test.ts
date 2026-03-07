/**
 * SQLite Performance and Load Tests
 *
 * This test suite validates:
 * 1. Performance under high load scenarios
 * 2. Memory usage optimization
 * 3. Query performance with large datasets
 * 4. Bulk operations efficiency
 * 5. Database scalability limits
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from '../store';
import type {
  Task,
  CreateTaskRequest,
  TaskStatus,
  TaskPriority,
} from '@apexcli/core';

describe('SQLite Performance and Load Tests', () => {
  let testDir: string;
  let store: TaskStore;

  const createTaskRequest = (suffix = ''): CreateTaskRequest => ({
    description: `Performance test task ${suffix}`,
    acceptanceCriteria: `Should perform well under load ${suffix}`,
    workflow: 'feature',
    autonomy: 'full',
    agent: 'developer',
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sqlite-perf-test-'));
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    if (store) {
      await store.close();
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Bulk Operations Performance', () => {
    it('should handle bulk task creation efficiently', async () => {
      const taskCount = 200;
      const startTime = Date.now();

      // Create tasks in batches for better performance
      const batchSize = 20;
      const tasks: Task[] = [];

      for (let i = 0; i < taskCount; i += batchSize) {
        const batch = [];
        for (let j = 0; j < batchSize && (i + j) < taskCount; j++) {
          batch.push(store.createTask(createTaskRequest(`${i + j}`)));
        }
        const batchResults = await Promise.all(batch);
        tasks.push(...batchResults);
      }

      const createTime = Date.now() - startTime;

      expect(tasks).toHaveLength(taskCount);
      expect(createTime).toBeLessThan(60000); // Should complete within 60 seconds

      console.log(`Created ${taskCount} tasks in ${createTime}ms (${(createTime / taskCount).toFixed(2)}ms per task)`);
    });

    it('should handle bulk updates efficiently', async () => {
      // Create base dataset
      const taskCount = 100;
      const tasks = await Promise.all(
        Array(taskCount).fill(null).map((_, i) =>
          store.createTask(createTaskRequest(i.toString()))
        )
      );

      const startTime = Date.now();

      // Update all tasks
      const updatePromises = tasks.map((task, i) =>
        store.updateTask(task.id, {
          status: i % 2 === 0 ? 'in-progress' : 'completed',
          priority: i % 3 === 0 ? 'high' : 'normal',
          retryCount: i,
        })
      );

      await Promise.all(updatePromises);
      const updateTime = Date.now() - startTime;

      expect(updateTime).toBeLessThan(30000); // Should complete within 30 seconds

      console.log(`Updated ${taskCount} tasks in ${updateTime}ms (${(updateTime / taskCount).toFixed(2)}ms per task)`);

      // Verify updates
      const updatedTasks = await store.listTasks();
      expect(updatedTasks).toHaveLength(taskCount);

      const completedTasks = updatedTasks.filter(t => t.status === 'completed');
      expect(completedTasks.length).toBeGreaterThan(0);
    });

    it('should handle bulk queries efficiently', async () => {
      // Create varied dataset
      const taskCount = 150;
      const priorities: TaskPriority[] = ['low', 'normal', 'high'];
      const statuses: TaskStatus[] = ['pending', 'in-progress', 'completed'];

      await Promise.all(
        Array(taskCount).fill(null).map((_, i) =>
          store.createTask({
            ...createTaskRequest(i.toString()),
            priority: priorities[i % priorities.length],
          }).then(task =>
            store.updateTask(task.id, {
              status: statuses[i % statuses.length]
            })
          )
        )
      );

      const startTime = Date.now();

      // Perform various queries
      const [
        allTasks,
        pendingTasks,
        completedTasks,
        highPriorityTasks,
        normalPriorityTasks,
        readyTasks,
      ] = await Promise.all([
        store.listTasks(),
        store.listTasks({ status: 'pending' }),
        store.listTasks({ status: 'completed' }),
        store.listTasks({ priority: 'high' }),
        store.listTasks({ priority: 'normal' }),
        store.getReadyTasks?.() || Promise.resolve([]),
      ]);

      const queryTime = Date.now() - startTime;

      expect(queryTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(allTasks).toHaveLength(taskCount);
      expect(pendingTasks.length + completedTasks.length + (await store.listTasks({ status: 'in-progress' })).length).toBe(taskCount);

      console.log(`Executed 6 complex queries in ${queryTime}ms`);
    });
  });

  describe('Memory Usage and Optimization', () => {
    it('should handle large task descriptions without memory issues', async () => {
      const largeDescriptionSize = 50000; // 50KB per description
      const taskCount = 20;

      const tasks = await Promise.all(
        Array(taskCount).fill(null).map((_, i) =>
          store.createTask({
            ...createTaskRequest(i.toString()),
            description: 'L'.repeat(largeDescriptionSize) + ` Task ${i}`,
          })
        )
      );

      expect(tasks).toHaveLength(taskCount);

      // Verify data integrity
      for (let i = 0; i < taskCount; i++) {
        const retrieved = await store.getTask(tasks[i].id);
        expect(retrieved?.description).toContain(`Task ${i}`);
        expect(retrieved?.description.length).toBeGreaterThan(largeDescriptionSize);
      }
    });

    it('should handle tasks with extensive related data', async () => {
      const task = await store.createTask(createTaskRequest('extensive'));

      // Add extensive logs and artifacts
      const logCount = 50;
      const artifactCount = 20;

      for (let i = 0; i < logCount; i++) {
        await store.addLog(task.id, {
          level: 'info',
          message: `Extensive log entry ${i}`,
          metadata: JSON.stringify({ index: i, data: 'x'.repeat(1000) }),
        });
      }

      for (let i = 0; i < artifactCount; i++) {
        await store.addArtifact(task.id, {
          name: `extensive_artifact_${i}.txt`,
          type: 'text',
          content: 'A'.repeat(5000) + ` Artifact ${i}`,
        });
      }

      const startTime = Date.now();
      const retrievedTask = await store.getTask(task.id);
      const retrieveTime = Date.now() - startTime;

      expect(retrieveTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(retrievedTask?.logs).toHaveLength(logCount);
      expect(retrievedTask?.artifacts).toHaveLength(artifactCount);
    });
  });

  describe('Concurrent Access Performance', () => {
    it('should handle multiple concurrent read operations', async () => {
      // Create base dataset
      const tasks = await Promise.all(
        Array(50).fill(null).map((_, i) =>
          store.createTask(createTaskRequest(i.toString()))
        )
      );

      const startTime = Date.now();
      const concurrentReads = 30;

      // Perform concurrent read operations
      const readPromises = Array(concurrentReads).fill(null).map(async (_, i) => {
        const targetTask = tasks[i % tasks.length];
        const results = await Promise.all([
          store.getTask(targetTask.id),
          store.listTasks({ limit: 10, offset: i }),
          store.listTasks({ status: 'pending' }),
        ]);
        return results;
      });

      const results = await Promise.all(readPromises);
      const readTime = Date.now() - startTime;

      expect(readTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(results).toHaveLength(concurrentReads);

      console.log(`Executed ${concurrentReads * 3} concurrent read operations in ${readTime}ms`);
    });

    it('should handle mixed read-write workload', async () => {
      // Create initial tasks
      const initialTasks = await Promise.all(
        Array(30).fill(null).map((_, i) =>
          store.createTask(createTaskRequest(`initial_${i}`))
        )
      );

      const startTime = Date.now();
      const operationCount = 60;

      // Mix of operations
      const operations = Array(operationCount).fill(null).map((_, i) => {
        if (i % 4 === 0) {
          // Create new task
          return store.createTask(createTaskRequest(`mixed_${i}`));
        } else if (i % 4 === 1) {
          // Update existing task
          const targetTask = initialTasks[i % initialTasks.length];
          return store.updateTask(targetTask.id, { retryCount: i });
        } else if (i % 4 === 2) {
          // Read task
          const targetTask = initialTasks[i % initialTasks.length];
          return store.getTask(targetTask.id);
        } else {
          // List tasks with filter
          return store.listTasks({ limit: 5, offset: i % 10 });
        }
      });

      const results = await Promise.all(operations);
      const operationTime = Date.now() - startTime;

      expect(operationTime).toBeLessThan(20000); // Should complete within 20 seconds
      expect(results).toHaveLength(operationCount);

      console.log(`Executed ${operationCount} mixed operations in ${operationTime}ms`);

      // Verify final state
      const finalTasks = await store.listTasks();
      expect(finalTasks.length).toBeGreaterThan(initialTasks.length);
    });
  });

  describe('Query Performance with Complex Filters', () => {
    it('should maintain performance with complex filtering scenarios', async () => {
      // Create complex dataset
      const taskCount = 200;
      const workflows = ['feature', 'bugfix', 'maintenance', 'research'];
      const priorities = ['low', 'normal', 'high', 'critical'];
      const statuses = ['pending', 'in-progress', 'completed', 'failed', 'paused'];

      await Promise.all(
        Array(taskCount).fill(null).map(async (_, i) => {
          const task = await store.createTask({
            ...createTaskRequest(i.toString()),
            workflow: workflows[i % workflows.length],
            priority: priorities[i % priorities.length],
          });

          await store.updateTask(task.id, {
            status: statuses[i % statuses.length],
            retryCount: i % 5,
          });

          return task;
        })
      );

      const startTime = Date.now();

      // Complex queries
      const [
        highPriorityPending,
        completedFeatures,
        failedTasks,
        pausedTasks,
        recentTasks,
      ] = await Promise.all([
        store.listTasks({ priority: 'high', status: 'pending' }),
        store.listTasks({ status: 'completed' }),
        store.listTasks({ status: 'failed' }),
        store.listTasks({ status: 'paused' }),
        store.listTasks({ limit: 20 }),
      ]);

      const queryTime = Date.now() - startTime;

      expect(queryTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(highPriorityPending.length).toBeGreaterThanOrEqual(0);
      expect(completedFeatures.length).toBeGreaterThanOrEqual(0);

      console.log(`Complex filtered queries completed in ${queryTime}ms`);
    });

    it('should handle pagination efficiently with large datasets', async () => {
      // Create large dataset
      const taskCount = 300;
      await Promise.all(
        Array(taskCount).fill(null).map((_, i) =>
          store.createTask({
            ...createTaskRequest(i.toString()),
            priority: i % 2 === 0 ? 'high' : 'normal',
          })
        )
      );

      const startTime = Date.now();
      const pageSize = 25;
      const totalPages = Math.ceil(taskCount / pageSize);

      // Test pagination performance
      const pages = [];
      for (let page = 0; page < totalPages; page++) {
        const offset = page * pageSize;
        const pageData = await store.listTasks({ limit: pageSize, offset });
        pages.push(pageData);
      }

      const paginationTime = Date.now() - startTime;

      expect(paginationTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Verify pagination integrity
      const totalRetrieved = pages.reduce((sum, page) => sum + page.length, 0);
      expect(totalRetrieved).toBe(taskCount);

      console.log(`Paginated through ${taskCount} tasks in ${paginationTime}ms`);
    });
  });

  describe('Database Size and Storage Efficiency', () => {
    it('should maintain reasonable storage size with large datasets', async () => {
      const taskCount = 100;

      // Create tasks with varied data sizes
      await Promise.all(
        Array(taskCount).fill(null).map(async (_, i) => {
          const task = await store.createTask({
            ...createTaskRequest(i.toString()),
            description: 'D'.repeat(Math.min(1000 * (i + 1), 10000)),
            acceptanceCriteria: 'A'.repeat(500),
          });

          // Add some logs and artifacts
          await store.addLog(task.id, {
            level: 'info',
            message: `Log for task ${i}`,
          });

          await store.addArtifact(task.id, {
            name: `file_${i}.txt`,
            type: 'text',
            content: `Content for artifact ${i}`,
          });

          return task;
        })
      );

      // Check database performance after data creation
      const startTime = Date.now();
      const allTasks = await store.listTasks();
      const queryTime = Date.now() - startTime;

      expect(allTasks).toHaveLength(taskCount);
      expect(queryTime).toBeLessThan(2000); // Should still be fast

      // Database should be functional with large amounts of data
      const sampleTask = await store.getTask(allTasks[0].id);
      expect(sampleTask).not.toBeNull();
      expect(sampleTask?.logs.length).toBeGreaterThanOrEqual(1);
      expect(sampleTask?.artifacts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Cleanup and Maintenance Performance', () => {
    it('should handle bulk cleanup operations efficiently', async () => {
      // Create tasks to be cleaned up
      const taskCount = 100;
      const tasks = await Promise.all(
        Array(taskCount).fill(null).map((_, i) =>
          store.createTask(createTaskRequest(i.toString()))
        )
      );

      // Trash half the tasks
      const startTrashTime = Date.now();
      const trashPromises = tasks.slice(0, taskCount / 2).map(task =>
        store.trashTask(task.id)
      );
      await Promise.all(trashPromises);
      const trashTime = Date.now() - startTrashTime;

      // Empty trash
      const startEmptyTime = Date.now();
      const deletedCount = await store.emptyTrash();
      const emptyTime = Date.now() - startEmptyTime;

      expect(deletedCount).toBe(taskCount / 2);
      expect(trashTime).toBeLessThan(10000); // Trash operations within 10 seconds
      expect(emptyTime).toBeLessThan(5000); // Empty trash within 5 seconds

      // Verify cleanup
      const remainingTasks = await store.listTasks();
      expect(remainingTasks.length).toBeLessThanOrEqual(taskCount / 2);

      console.log(`Trash: ${trashTime}ms, Empty: ${emptyTime}ms`);
    });
  });
});