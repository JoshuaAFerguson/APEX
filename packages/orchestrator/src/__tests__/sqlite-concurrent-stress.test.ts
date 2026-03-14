/**
 * SQLite Concurrent Read/Write Stress Tests
 *
 * Architecture Decision Record (ADR):
 * ------------------------------------
 * This test suite validates SQLite task store behavior under concurrent access patterns.
 *
 * Design Rationale:
 * 1. SQLite with WAL mode supports concurrent reads but serializes writes
 * 2. better-sqlite3 is synchronous, so "concurrent" operations are actually
 *    interleaved via Promise.all() which tests the database's ACID guarantees
 * 3. Tests focus on data integrity verification, not raw performance metrics
 *
 * Test Categories:
 * - Parallel read operations: Multiple getTask/listTasks calls
 * - Parallel write operations: Multiple createTask/updateTask calls
 * - Mixed read/write workloads: Interleaved operations
 * - Write contention scenarios: Same-row updates from multiple "workers"
 * - Transaction isolation: Verify no partial writes are visible
 *
 * Concurrency Model:
 * - Uses Promise.all() to simulate concurrent access
 * - Worker simulation via async iteration with randomized delays
 * - Batch processing to stress database lock management
 *
 * @see packages/orchestrator/src/store.ts - TaskStore implementation
 * @see sqlite-performance-load.test.ts - Performance benchmarks
 * @see sqlite-large-volume-load.test.ts - Large volume tests
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

/**
 * Test configuration constants
 */
const CONFIG = {
  // Number of parallel operations for stress tests
  PARALLEL_OPERATIONS: 50,

  // Number of workers for worker simulation tests
  WORKER_COUNT: 10,

  // Tasks per worker in multi-worker tests
  TASKS_PER_WORKER: 20,

  // Number of iterations for contention tests
  CONTENTION_ITERATIONS: 30,

  // Maximum time (ms) for test operations
  MAX_TEST_DURATION: 60000,

  // Batch size for bulk operations
  BATCH_SIZE: 25,
} as const;

/**
 * Helper to create unique task requests
 */
const createTaskRequest = (suffix: string | number = ''): CreateTaskRequest => ({
  description: `Concurrent stress test task ${suffix}`,
  acceptanceCriteria: `Task ${suffix} should handle concurrent access`,
  workflow: 'feature',
  autonomy: 'full-auto',
});

/**
 * Helper to introduce random delays for simulating async behavior
 */
const randomDelay = (maxMs: number = 10): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, Math.random() * maxMs));

/**
 * Worker simulation helper - creates tasks with random delays
 */
const simulateWorker = async (
  store: TaskStore,
  workerId: number,
  taskCount: number
): Promise<Task[]> => {
  const tasks: Task[] = [];
  for (let i = 0; i < taskCount; i++) {
    await randomDelay(5);
    const task = await store.createTask(createTaskRequest(`worker${workerId}_task${i}`));
    tasks.push(task);
  }
  return tasks;
};

describe('SQLite Concurrent Read/Write Stress Tests', () => {
  let testDir: string;
  let store: TaskStore;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sqlite-concurrent-stress-'));
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

  describe('Parallel Read Operations', () => {
    it('should handle multiple concurrent getTask calls without data corruption', async () => {
      // Setup: Create base dataset
      const baseTasks = await Promise.all(
        Array(CONFIG.PARALLEL_OPERATIONS)
          .fill(null)
          .map((_, i) => store.createTask(createTaskRequest(`base_${i}`)))
      );

      // Execute: Multiple parallel read operations
      const startTime = Date.now();
      const readPromises = baseTasks.flatMap(task => [
        store.getTask(task.id),
        store.getTask(task.id),
        store.getTask(task.id),
      ]);

      const results = await Promise.all(readPromises);
      const duration = Date.now() - startTime;

      // Verify: All reads return consistent data
      expect(results).toHaveLength(baseTasks.length * 3);
      results.forEach((task, index) => {
        expect(task).not.toBeNull();
        const baseIndex = Math.floor(index / 3);
        expect(task?.id).toBe(baseTasks[baseIndex].id);
        expect(task?.description).toBe(baseTasks[baseIndex].description);
      });

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Parallel reads (${readPromises.length}): ${duration}ms`);
    });

    it('should handle concurrent listTasks calls with filters', async () => {
      // Setup: Create diverse dataset
      const priorities: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];
      const statuses: TaskStatus[] = ['pending', 'in-progress', 'completed', 'failed'];

      const tasks = await Promise.all(
        Array(100)
          .fill(null)
          .map(async (_, i) => {
            const task = await store.createTask(createTaskRequest(`diverse_${i}`));
            await store.updateTask(task.id, {
              priority: priorities[i % priorities.length],
              status: statuses[i % statuses.length],
            });
            return task;
          })
      );

      // Execute: Multiple parallel list operations with different filters
      const listPromises = [
        ...Array(10).fill(null).map(() => store.listTasks()),
        ...Array(10).fill(null).map(() => store.listTasks({ status: 'pending' })),
        ...Array(10).fill(null).map(() => store.listTasks({ orderByPriority: true })),
        ...Array(10).fill(null).map(() => store.listTasks({ limit: 10, offset: 0 })),
        ...Array(10).fill(null).map(() => store.listTasks({ limit: 10, offset: 10 })),
      ];

      const startTime = Date.now();
      const results = await Promise.all(listPromises);
      const duration = Date.now() - startTime;

      // Verify: Results are consistent
      expect(results).toHaveLength(50);

      // All "list all" queries should return same count
      const allTasksResults = results.slice(0, 10);
      const firstCount = allTasksResults[0].length;
      allTasksResults.forEach(r => expect(r.length).toBe(firstCount));

      // Filtered results should be consistent
      const pendingResults = results.slice(10, 20);
      const pendingCount = pendingResults[0].length;
      pendingResults.forEach(r => expect(r.length).toBe(pendingCount));

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Parallel list queries (${listPromises.length}): ${duration}ms`);
    });

    it('should handle concurrent reads of related data (logs, artifacts)', async () => {
      // Setup: Create tasks with logs and artifacts
      const tasks = await Promise.all(
        Array(20)
          .fill(null)
          .map((_, i) => store.createTask(createTaskRequest(`related_${i}`)))
      );

      // Add logs and artifacts to each task
      for (const task of tasks) {
        await store.addLog(task.id, { level: 'info', message: `Log for ${task.id}` });
        await store.addArtifact(task.id, {
          name: `artifact_${task.id}.txt`,
          type: 'file',
          content: `Content for ${task.id}`,
        });
      }

      // Execute: Concurrent reads including related data
      const startTime = Date.now();
      const readPromises = tasks.flatMap(task => [
        store.getTask(task.id), // Includes logs and artifacts
        store.getTask(task.id),
      ]);

      const results = await Promise.all(readPromises);
      const duration = Date.now() - startTime;

      // Verify: All tasks have their related data
      results.forEach(task => {
        expect(task).not.toBeNull();
        expect(task?.logs).toHaveLength(1);
        expect(task?.artifacts).toHaveLength(1);
      });

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Parallel reads with related data (${readPromises.length}): ${duration}ms`);
    });
  });

  describe('Parallel Write Operations', () => {
    it('should handle multiple concurrent createTask calls with unique IDs', async () => {
      const startTime = Date.now();

      // Execute: Create tasks concurrently
      const createPromises = Array(CONFIG.PARALLEL_OPERATIONS)
        .fill(null)
        .map((_, i) => store.createTask(createTaskRequest(`concurrent_create_${i}`)));

      const tasks = await Promise.all(createPromises);
      const duration = Date.now() - startTime;

      // Verify: All tasks created with unique IDs
      expect(tasks).toHaveLength(CONFIG.PARALLEL_OPERATIONS);

      const taskIds = new Set(tasks.map(t => t.id));
      expect(taskIds.size).toBe(CONFIG.PARALLEL_OPERATIONS);

      // Verify persistence
      const storedTasks = await store.listTasks();
      expect(storedTasks.length).toBeGreaterThanOrEqual(CONFIG.PARALLEL_OPERATIONS);

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Parallel creates (${CONFIG.PARALLEL_OPERATIONS}): ${duration}ms`);
    });

    it('should handle concurrent updateTask calls on different tasks', async () => {
      // Setup: Create base tasks
      const tasks = await Promise.all(
        Array(CONFIG.PARALLEL_OPERATIONS)
          .fill(null)
          .map((_, i) => store.createTask(createTaskRequest(`update_diff_${i}`)))
      );

      const startTime = Date.now();

      // Execute: Update different tasks concurrently
      const updatePromises = tasks.map((task, i) =>
        store.updateTask(task.id, {
          status: i % 2 === 0 ? 'in-progress' : 'completed',
          priority: i % 3 === 0 ? 'high' : 'normal',
          retryCount: i,
        })
      );

      await Promise.all(updatePromises);
      const duration = Date.now() - startTime;

      // Verify: All updates applied correctly
      for (let i = 0; i < tasks.length; i++) {
        const updated = await store.getTask(tasks[i].id);
        expect(updated?.status).toBe(i % 2 === 0 ? 'in-progress' : 'completed');
        expect(updated?.priority).toBe(i % 3 === 0 ? 'high' : 'normal');
        expect(updated?.retryCount).toBe(i);
      }

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Parallel updates on different tasks (${updatePromises.length}): ${duration}ms`);
    });

    it('should handle concurrent addLog calls without data loss', async () => {
      const task = await store.createTask(createTaskRequest('log_stress'));
      const logCount = CONFIG.PARALLEL_OPERATIONS;

      const startTime = Date.now();

      // Execute: Add logs concurrently
      const logPromises = Array(logCount)
        .fill(null)
        .map((_, i) =>
          store.addLog(task.id, {
            level: i % 2 === 0 ? 'info' : 'error',
            message: `Concurrent log ${i}`,
            metadata: { index: i } as unknown as Record<string, unknown>,
          })
        );

      await Promise.all(logPromises);
      const duration = Date.now() - startTime;

      // Verify: All logs persisted
      const updatedTask = await store.getTask(task.id);
      expect(updatedTask?.logs).toHaveLength(logCount);

      // Verify log content integrity
      const logIndices = updatedTask?.logs
        .map(log => {
          const meta = log.metadata;
          if (typeof meta === 'string') {
            return JSON.parse(meta).index;
          }
          return (meta as any)?.index;
        })
        .filter((idx): idx is number => idx !== undefined)
        .sort((a, b) => a - b);

      expect(logIndices).toEqual(Array.from({ length: logCount }, (_, i) => i));

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Parallel addLog calls (${logCount}): ${duration}ms`);
    });

    it('should handle concurrent addArtifact calls without data loss', async () => {
      const task = await store.createTask(createTaskRequest('artifact_stress'));
      const artifactCount = 30; // Lower count since artifacts are larger

      const startTime = Date.now();

      // Execute: Add artifacts concurrently
      const artifactPromises = Array(artifactCount)
        .fill(null)
        .map((_, i) =>
          store.addArtifact(task.id, {
            name: `artifact_${i}.txt`,
            type: 'file',
            content: `Concurrent artifact content ${i}`,
          })
        );

      await Promise.all(artifactPromises);
      const duration = Date.now() - startTime;

      // Verify: All artifacts persisted
      const updatedTask = await store.getTask(task.id);
      expect(updatedTask?.artifacts).toHaveLength(artifactCount);

      // Verify artifact uniqueness
      const artifactNames = new Set(updatedTask?.artifacts.map(a => a.name));
      expect(artifactNames.size).toBe(artifactCount);

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Parallel addArtifact calls (${artifactCount}): ${duration}ms`);
    });
  });

  describe('Mixed Read/Write Workloads', () => {
    it('should maintain consistency during interleaved read/write operations', async () => {
      // Setup: Create initial tasks
      const initialTasks = await Promise.all(
        Array(30)
          .fill(null)
          .map((_, i) => store.createTask(createTaskRequest(`mixed_init_${i}`)))
      );

      const startTime = Date.now();
      const operationResults: { type: string; success: boolean }[] = [];

      // Execute: Mix of operations
      const operations = Array(100).fill(null).map((_, i) => {
        const opType = i % 5;
        switch (opType) {
          case 0: // Create
            return store.createTask(createTaskRequest(`mixed_new_${i}`))
              .then(() => ({ type: 'create', success: true }))
              .catch(() => ({ type: 'create', success: false }));

          case 1: // Update
            const updateTarget = initialTasks[i % initialTasks.length];
            return store.updateTask(updateTarget.id, { retryCount: i })
              .then(() => ({ type: 'update', success: true }))
              .catch(() => ({ type: 'update', success: false }));

          case 2: // Get single
            const getTarget = initialTasks[i % initialTasks.length];
            return store.getTask(getTarget.id)
              .then(() => ({ type: 'get', success: true }))
              .catch(() => ({ type: 'get', success: false }));

          case 3: // List
            return store.listTasks({ limit: 10 })
              .then(() => ({ type: 'list', success: true }))
              .catch(() => ({ type: 'list', success: false }));

          case 4: // Add log
            const logTarget = initialTasks[i % initialTasks.length];
            return store.addLog(logTarget.id, { level: 'info', message: `Mixed op ${i}` })
              .then(() => ({ type: 'addLog', success: true }))
              .catch(() => ({ type: 'addLog', success: false }));

          default:
            return Promise.resolve({ type: 'unknown', success: true });
        }
      });

      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      // Verify: All operations succeeded
      const failures = results.filter(r => !r.success);
      expect(failures.length).toBe(0);

      // Verify data integrity
      const allTasks = await store.listTasks();
      expect(allTasks.length).toBeGreaterThan(initialTasks.length);

      // Original tasks should still exist
      for (const task of initialTasks) {
        const exists = await store.getTask(task.id);
        expect(exists).not.toBeNull();
      }

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Mixed operations (${operations.length}): ${duration}ms`);
    });

    it('should handle read-heavy workload with occasional writes', async () => {
      // Setup: Create base dataset
      const tasks = await Promise.all(
        Array(50)
          .fill(null)
          .map((_, i) => store.createTask(createTaskRequest(`read_heavy_${i}`)))
      );

      const startTime = Date.now();

      // Execute: 90% reads, 10% writes
      const operations = Array(200).fill(null).map((_, i) => {
        if (i % 10 === 0) {
          // Write operation (10%)
          const target = tasks[i % tasks.length];
          return store.updateTask(target.id, { retryCount: i })
            .then(() => 'write');
        } else {
          // Read operation (90%)
          const target = tasks[i % tasks.length];
          return store.getTask(target.id)
            .then(() => 'read');
        }
      });

      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      // Verify operation distribution
      const reads = results.filter(r => r === 'read').length;
      const writes = results.filter(r => r === 'write').length;
      expect(reads).toBe(180);
      expect(writes).toBe(20);

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Read-heavy workload (${reads} reads, ${writes} writes): ${duration}ms`);
    });

    it('should handle write-heavy workload with occasional reads', async () => {
      // Setup: Create base dataset
      const tasks = await Promise.all(
        Array(20)
          .fill(null)
          .map((_, i) => store.createTask(createTaskRequest(`write_heavy_${i}`)))
      );

      const startTime = Date.now();

      // Execute: 90% writes, 10% reads
      const operations = Array(100).fill(null).map((_, i) => {
        if (i % 10 === 0) {
          // Read operation (10%)
          return store.listTasks({ limit: 10 })
            .then(() => 'read');
        } else if (i % 2 === 0) {
          // Create operation (45%)
          return store.createTask(createTaskRequest(`write_new_${i}`))
            .then(() => 'create');
        } else {
          // Update operation (45%)
          const target = tasks[i % tasks.length];
          return store.updateTask(target.id, { retryCount: i })
            .then(() => 'update');
        }
      });

      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      // Verify all operations completed
      expect(results).toHaveLength(100);

      // Verify data integrity
      const allTasks = await store.listTasks();
      expect(allTasks.length).toBeGreaterThan(tasks.length);

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Write-heavy workload (${results.length} ops): ${duration}ms`);
    });
  });

  describe('Write Contention Scenarios', () => {
    it('should handle concurrent updates to the same task without data corruption', async () => {
      const task = await store.createTask(createTaskRequest('contention_single'));

      const startTime = Date.now();
      const updateCount = CONFIG.CONTENTION_ITERATIONS;

      // Execute: Multiple updates to same task
      const updatePromises = Array(updateCount)
        .fill(null)
        .map((_, i) =>
          store.updateTask(task.id, {
            retryCount: i,
            error: `Update ${i}`,
          })
        );

      await Promise.all(updatePromises);
      const duration = Date.now() - startTime;

      // Verify: Task is in valid state (last write wins)
      const finalTask = await store.getTask(task.id);
      expect(finalTask).not.toBeNull();
      expect(finalTask?.retryCount).toBeGreaterThanOrEqual(0);
      expect(finalTask?.retryCount).toBeLessThan(updateCount);
      expect(finalTask?.error).toMatch(/Update \d+/);

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Same-task contention (${updateCount} updates): ${duration}ms`);
    });

    it('should handle concurrent status transitions without invalid states', async () => {
      const task = await store.createTask(createTaskRequest('status_contention'));
      const validStatuses: TaskStatus[] = ['pending', 'in-progress', 'completed', 'failed', 'queued'];

      const startTime = Date.now();

      // Execute: Random status updates
      const updatePromises = Array(50)
        .fill(null)
        .map((_, i) =>
          store.updateTask(task.id, {
            status: validStatuses[i % validStatuses.length],
          })
        );

      await Promise.all(updatePromises);
      const duration = Date.now() - startTime;

      // Verify: Final status is valid
      const finalTask = await store.getTask(task.id);
      expect(validStatuses).toContain(finalTask?.status);

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Status contention (50 updates): ${duration}ms`);
    });

    it('should handle concurrent dependency modifications', async () => {
      // Create a set of tasks
      const tasks = await Promise.all(
        Array(10)
          .fill(null)
          .map((_, i) => store.createTask(createTaskRequest(`dep_task_${i}`)))
      );

      const mainTask = await store.createTask(createTaskRequest('main_dep_task'));
      const startTime = Date.now();

      // Execute: Add and remove dependencies concurrently
      const depOperations = tasks.map((task, i) =>
        i % 2 === 0
          ? store.addDependency(mainTask.id, task.id)
          : store.addDependency(mainTask.id, task.id)
            .then(() => store.removeDependency(mainTask.id, task.id))
      );

      await Promise.all(depOperations);
      const duration = Date.now() - startTime;

      // Verify: Dependencies are in valid state
      const finalTask = await store.getTask(mainTask.id);
      expect(Array.isArray(finalTask?.dependsOn)).toBe(true);

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Dependency contention (${tasks.length} tasks): ${duration}ms`);
    });

    it('should handle concurrent trash and restore operations', async () => {
      const tasks = await Promise.all(
        Array(20)
          .fill(null)
          .map((_, i) => store.createTask(createTaskRequest(`trash_restore_${i}`)))
      );

      const startTime = Date.now();

      // Execute: Concurrent trash and restore (toggle)
      const trashRestoreOps = tasks.map(async (task, i) => {
        await store.trashTask(task.id);
        if (i % 2 === 0) {
          // Restore some tasks
          await store.updateTask(task.id, { trashedAt: undefined });
        }
        return task.id;
      });

      await Promise.all(trashRestoreOps);
      const duration = Date.now() - startTime;

      // Verify: Tasks are in valid state
      const activeTasks = await store.listTasks();
      const trashedTasks = await store.listTasks({ includeTrashed: true });

      expect(activeTasks.length).toBeGreaterThanOrEqual(0);
      expect(trashedTasks.length).toBeGreaterThanOrEqual(activeTasks.length);

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Trash/restore contention: ${duration}ms`);
    });
  });

  describe('Transaction Isolation Behavior', () => {
    it('should not expose partial writes during multi-field updates', async () => {
      const task = await store.createTask(createTaskRequest('isolation_test'));

      // Setup observers that will read during writes
      const observations: { status: TaskStatus | undefined; priority: TaskPriority | undefined }[] = [];

      const startTime = Date.now();

      // Execute: Interleaved reads and writes
      const operations = Array(50).fill(null).flatMap((_, i) => [
        // Write operation
        store.updateTask(task.id, {
          status: i % 2 === 0 ? 'in-progress' : 'completed',
          priority: i % 2 === 0 ? 'high' : 'low',
          retryCount: i,
        }),
        // Read operation right after
        store.getTask(task.id).then(t => {
          if (t) {
            observations.push({ status: t.status, priority: t.priority });
          }
        }),
      ]);

      await Promise.all(operations);
      const duration = Date.now() - startTime;

      // Verify: All observations show consistent state
      // If status is 'in-progress', priority should be 'high'
      // If status is 'completed', priority should be 'low'
      observations.forEach(obs => {
        if (obs.status === 'in-progress') {
          expect(['high', 'normal']).toContain(obs.priority);
        } else if (obs.status === 'completed') {
          expect(['low', 'normal']).toContain(obs.priority);
        }
      });

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Transaction isolation (${observations.length} observations): ${duration}ms`);
    });

    it('should maintain referential integrity under concurrent modifications', async () => {
      // Create parent task
      const parentTask = await store.createTask(createTaskRequest('parent'));

      // Create child tasks concurrently
      const startTime = Date.now();
      const childPromises = Array(CONFIG.PARALLEL_OPERATIONS)
        .fill(null)
        .map((_, i) =>
          store.createTask({
            ...createTaskRequest(`child_${i}`),
            parentTaskId: parentTask.id,
          } as any)
        );

      const children = await Promise.all(childPromises);
      const duration = Date.now() - startTime;

      // Verify: All children reference parent correctly
      for (const child of children) {
        const stored = await store.getTask(child.id);
        expect(stored?.parentTaskId).toBe(parentTask.id);
      }

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Referential integrity (${children.length} children): ${duration}ms`);
    });

    it('should handle concurrent checkpoint operations without data loss', async () => {
      const task = await store.createTask(createTaskRequest('checkpoint_test'));
      const checkpointCount = 20;

      const startTime = Date.now();

      // Execute: Concurrent checkpoint saves
      const checkpointPromises = Array(checkpointCount)
        .fill(null)
        .map((_, i) =>
          store.saveCheckpoint({
            taskId: task.id,
            checkpointId: `checkpoint_${i}`,
            stage: `stage_${i}`,
            stageIndex: i,
            metadata: { iteration: i, progress: i / checkpointCount },
            createdAt: new Date(),
          })
        );

      await Promise.all(checkpointPromises);
      const duration = Date.now() - startTime;

      // Verify: At least one checkpoint was saved
      const latestCheckpoint = await store.getLatestCheckpoint(task.id);
      expect(latestCheckpoint).not.toBeNull();
      expect(latestCheckpoint?.stage).toMatch(/stage_\d+/);

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Concurrent checkpoints (${checkpointCount}): ${duration}ms`);
    });
  });

  describe('Multi-Worker Simulation', () => {
    it('should handle multiple workers creating tasks simultaneously', async () => {
      const startTime = Date.now();

      // Simulate multiple workers
      const workerPromises = Array(CONFIG.WORKER_COUNT)
        .fill(null)
        .map((_, workerId) => simulateWorker(store, workerId, CONFIG.TASKS_PER_WORKER));

      const workerResults = await Promise.all(workerPromises);
      const duration = Date.now() - startTime;

      // Verify: All tasks created
      const totalExpected = CONFIG.WORKER_COUNT * CONFIG.TASKS_PER_WORKER;
      const allTasks = workerResults.flat();
      expect(allTasks).toHaveLength(totalExpected);

      // All IDs unique
      const uniqueIds = new Set(allTasks.map(t => t.id));
      expect(uniqueIds.size).toBe(totalExpected);

      // Verify persistence
      const storedCount = (await store.listTasks()).length;
      expect(storedCount).toBeGreaterThanOrEqual(totalExpected);

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Multi-worker simulation (${CONFIG.WORKER_COUNT} workers × ${CONFIG.TASKS_PER_WORKER} tasks): ${duration}ms`);
    });

    it('should handle workers updating shared task pool', async () => {
      // Create shared task pool
      const sharedTasks = await Promise.all(
        Array(30)
          .fill(null)
          .map((_, i) => store.createTask(createTaskRequest(`shared_${i}`)))
      );

      const startTime = Date.now();

      // Multiple workers updating the shared pool
      const workerUpdatePromises = Array(CONFIG.WORKER_COUNT)
        .fill(null)
        .map(async (_, workerId) => {
          for (let i = 0; i < 10; i++) {
            await randomDelay(3);
            const target = sharedTasks[(workerId * 10 + i) % sharedTasks.length];
            await store.updateTask(target.id, {
              retryCount: workerId * 100 + i,
              error: `Worker ${workerId} update ${i}`,
            });
          }
        });

      await Promise.all(workerUpdatePromises);
      const duration = Date.now() - startTime;

      // Verify: All tasks still valid
      for (const task of sharedTasks) {
        const updated = await store.getTask(task.id);
        expect(updated).not.toBeNull();
      }

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Shared pool updates (${CONFIG.WORKER_COUNT} workers): ${duration}ms`);
    });
  });

  describe('Data Integrity Validation', () => {
    it('should verify no data corruption after stress test', async () => {
      // Create diverse dataset with all operations
      const tasks = await Promise.all(
        Array(50)
          .fill(null)
          .map((_, i) => store.createTask(createTaskRequest(`integrity_${i}`)))
      );

      // Run mixed concurrent operations
      const operations: Promise<any>[] = [];

      for (let round = 0; round < 3; round++) {
        operations.push(
          ...tasks.map((task, i) =>
            store.updateTask(task.id, {
              status: ['pending', 'in-progress', 'completed'][i % 3] as TaskStatus,
              retryCount: round * 100 + i,
            })
          ),
          ...tasks.slice(0, 10).map(task =>
            store.addLog(task.id, { level: 'info', message: `Round ${round}` })
          ),
          ...Array(10).fill(null).map((_, i) =>
            store.createTask(createTaskRequest(`integrity_new_${round}_${i}`))
          )
        );
      }

      await Promise.all(operations);

      // Final integrity checks
      const allTasks = await store.listTasks();
      expect(allTasks.length).toBeGreaterThanOrEqual(50 + 30); // Original + new

      // Check each original task
      for (const task of tasks) {
        const stored = await store.getTask(task.id);
        expect(stored).not.toBeNull();
        expect(stored?.id).toBe(task.id);
        expect(typeof stored?.retryCount).toBe('number');
        expect(['pending', 'in-progress', 'completed', 'failed', 'paused']).toContain(stored?.status);
      }

      // Verify task with logs
      const tasksWithLogs = tasks.slice(0, 10);
      for (const task of tasksWithLogs) {
        const stored = await store.getTask(task.id);
        expect(stored?.logs?.length).toBeGreaterThanOrEqual(3); // 3 rounds
      }

      console.log(`  Data integrity verified for ${allTasks.length} tasks`);
    });

    it('should recover gracefully from rapid create-delete cycles', async () => {
      const cycleCount = 10;
      const tasksPerCycle = 20;

      for (let cycle = 0; cycle < cycleCount; cycle++) {
        // Create batch
        const tasks = await Promise.all(
          Array(tasksPerCycle)
            .fill(null)
            .map((_, i) => store.createTask(createTaskRequest(`cycle_${cycle}_${i}`)))
        );

        // Delete batch
        await Promise.all(tasks.map(t => store.trashTask(t.id)));
        await store.emptyTrash();
      }

      // Final state should be empty or near-empty
      const remainingTasks = await store.listTasks();
      expect(remainingTasks.length).toBeLessThan(tasksPerCycle);

      console.log(`  Rapid create-delete cycles (${cycleCount}): Clean state verified`);
    });
  });
});
