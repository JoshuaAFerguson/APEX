/**
 * SQLite Large Volume Load Tests (10k+ Tasks)
 *
 * This test suite validates SQLite task store performance at scale:
 * 1. 10k task creation performance
 * 2. Bulk operations at scale (updates, queries, deletions)
 * 3. Pagination with 10k records
 * 4. Query performance degradation analysis
 *
 * Architecture Decisions:
 * - Uses larger batch sizes (100-500) for 10k operations
 * - Implements progressive degradation tracking
 * - Tests are designed to complete within 5 minutes total
 * - Uses structured performance metrics collection
 *
 * @see ADR: Large Volume Test Design
 * - Batch size of 100 balances memory pressure vs. operation count
 * - Sequential batches for creation, parallel within batches
 * - Performance thresholds based on SQLite WAL mode capabilities
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
 * Performance metrics tracking interface
 */
interface PerformanceMetrics {
  operation: string;
  count: number;
  totalTimeMs: number;
  avgTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  opsPerSecond: number;
}

/**
 * Query degradation data point
 */
interface DegradationDataPoint {
  taskCount: number;
  queryTimeMs: number;
  queryType: string;
}

describe('SQLite Large Volume Load Tests (10k+ Tasks)', () => {
  let testDir: string;
  let store: TaskStore;

  // 10k task count for large volume tests
  const LARGE_VOLUME_COUNT = 10000;

  // Batch size for efficient bulk operations
  const BATCH_SIZE = 100;

  // Maximum test timeout (5 minutes = 300000ms)
  const MAX_TEST_TIMEOUT = 300000;

  // Performance thresholds
  const THRESHOLDS = {
    taskCreation: {
      totalTimeMs: 180000, // 3 minutes for 10k creations
      avgPerTaskMs: 18, // 18ms per task average
    },
    bulkUpdate: {
      totalTimeMs: 120000, // 2 minutes for 10k updates
      avgPerTaskMs: 12, // 12ms per task average
    },
    pagination: {
      fullScanTimeMs: 60000, // 1 minute to paginate through all
      singlePageMs: 500, // 500ms per page
    },
    queryDegradation: {
      maxSlowdownFactor: 5, // Query at 10k should be max 5x slower than at 1k
    },
  };

  /**
   * Creates a task request with optional suffix for uniqueness
   */
  const createTaskRequest = (suffix: string | number = ''): CreateTaskRequest => ({
    description: `Large volume test task ${suffix}`,
    acceptanceCriteria: `Task ${suffix} should be processed correctly`,
    workflow: 'feature',
    autonomy: 'full-auto',
  });

  /**
   * Calculate performance metrics from timing data
   */
  const calculateMetrics = (
    operation: string,
    count: number,
    times: number[]
  ): PerformanceMetrics => {
    const totalTimeMs = times.reduce((sum, t) => sum + t, 0);
    return {
      operation,
      count,
      totalTimeMs,
      avgTimeMs: totalTimeMs / count,
      minTimeMs: Math.min(...times),
      maxTimeMs: Math.max(...times),
      opsPerSecond: count / (totalTimeMs / 1000),
    };
  };

  /**
   * Create tasks in batches for efficient large-scale creation
   */
  const createTasksInBatches = async (
    count: number,
    batchSize: number
  ): Promise<{ tasks: Task[]; metrics: PerformanceMetrics }> => {
    const tasks: Task[] = [];
    const batchTimes: number[] = [];

    for (let i = 0; i < count; i += batchSize) {
      const batchStart = Date.now();
      const currentBatchSize = Math.min(batchSize, count - i);

      const batchPromises = Array(currentBatchSize)
        .fill(null)
        .map((_, j) => store.createTask(createTaskRequest(i + j)));

      const batchResults = await Promise.all(batchPromises);
      tasks.push(...batchResults);

      batchTimes.push(Date.now() - batchStart);

      // Progress logging every 1000 tasks
      if ((i + currentBatchSize) % 1000 === 0) {
        console.log(`  Created ${i + currentBatchSize}/${count} tasks...`);
      }
    }

    const metrics = calculateMetrics('createTasks', count, batchTimes);
    return { tasks, metrics };
  };

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sqlite-large-volume-test-'));
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

  describe('10k Task Creation Performance', () => {
    it(
      'should create 10k tasks within acceptable time limits',
      async () => {
        console.log('\n=== 10k Task Creation Test ===');
        const startTime = Date.now();

        const { tasks, metrics } = await createTasksInBatches(LARGE_VOLUME_COUNT, BATCH_SIZE);

        const totalTime = Date.now() - startTime;

        // Assertions
        expect(tasks).toHaveLength(LARGE_VOLUME_COUNT);
        expect(totalTime).toBeLessThan(THRESHOLDS.taskCreation.totalTimeMs);
        expect(metrics.avgTimeMs).toBeLessThan(THRESHOLDS.taskCreation.avgPerTaskMs * BATCH_SIZE);

        // All task IDs should be unique
        const uniqueIds = new Set(tasks.map((t) => t.id));
        expect(uniqueIds.size).toBe(LARGE_VOLUME_COUNT);

        // Performance report
        console.log('\nCreation Performance:');
        console.log(`  Total time: ${totalTime}ms`);
        console.log(`  Tasks created: ${LARGE_VOLUME_COUNT}`);
        console.log(`  Avg time per task: ${(totalTime / LARGE_VOLUME_COUNT).toFixed(2)}ms`);
        console.log(`  Ops/second: ${(LARGE_VOLUME_COUNT / (totalTime / 1000)).toFixed(2)}`);
        console.log(`  Min batch time: ${metrics.minTimeMs}ms`);
        console.log(`  Max batch time: ${metrics.maxTimeMs}ms`);
      },
      MAX_TEST_TIMEOUT
    );

    it(
      'should verify data integrity after 10k task creation',
      async () => {
        console.log('\n=== 10k Task Data Integrity Test ===');

        // Create diverse tasks
        const priorities: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];
        const taskCount = 10000;

        const { tasks } = await createTasksInBatches(taskCount, BATCH_SIZE);

        // Update tasks with varied priorities
        const updatePromises = tasks.map((task, i) =>
          store.updateTask(task.id, {
            priority: priorities[i % priorities.length],
            retryCount: i % 5,
          })
        );

        // Process updates in batches to avoid memory issues
        for (let i = 0; i < updatePromises.length; i += BATCH_SIZE) {
          await Promise.all(updatePromises.slice(i, i + BATCH_SIZE));
        }

        // Verify random samples for integrity
        const sampleSize = 100;
        const sampleIndices = Array.from({ length: sampleSize }, () =>
          Math.floor(Math.random() * taskCount)
        );

        for (const idx of sampleIndices) {
          const task = await store.getTask(tasks[idx].id);
          expect(task).not.toBeNull();
          expect(task?.priority).toBe(priorities[idx % priorities.length]);
          expect(task?.retryCount).toBe(idx % 5);
        }

        console.log(`  Verified ${sampleSize} random samples from ${taskCount} tasks`);
      },
      MAX_TEST_TIMEOUT
    );
  });

  describe('Bulk Operations at Scale', () => {
    it(
      'should handle bulk updates on 10k tasks efficiently',
      async () => {
        console.log('\n=== 10k Bulk Update Test ===');

        // First create the tasks
        const { tasks } = await createTasksInBatches(LARGE_VOLUME_COUNT, BATCH_SIZE);
        console.log(`  Created ${LARGE_VOLUME_COUNT} tasks for bulk update test`);

        const startTime = Date.now();
        const updateTimes: number[] = [];

        // Update all tasks in batches
        for (let i = 0; i < LARGE_VOLUME_COUNT; i += BATCH_SIZE) {
          const batchStart = Date.now();
          const currentBatchSize = Math.min(BATCH_SIZE, LARGE_VOLUME_COUNT - i);

          const updatePromises = tasks.slice(i, i + currentBatchSize).map((task, j) =>
            store.updateTask(task.id, {
              status: (i + j) % 3 === 0 ? 'in-progress' : 'pending',
              priority: (i + j) % 4 === 0 ? 'high' : 'normal',
              retryCount: (i + j) % 5,
            })
          );

          await Promise.all(updatePromises);
          updateTimes.push(Date.now() - batchStart);

          if ((i + currentBatchSize) % 2000 === 0) {
            console.log(`  Updated ${i + currentBatchSize}/${LARGE_VOLUME_COUNT} tasks...`);
          }
        }

        const totalTime = Date.now() - startTime;
        const metrics = calculateMetrics('bulkUpdate', LARGE_VOLUME_COUNT, updateTimes);

        // Assertions
        expect(totalTime).toBeLessThan(THRESHOLDS.bulkUpdate.totalTimeMs);

        // Verify update results
        const updatedTasks = await store.listTasks({ limit: 1000 });
        const inProgressCount = updatedTasks.filter((t) => t.status === 'in-progress').length;
        expect(inProgressCount).toBeGreaterThan(0);

        console.log('\nBulk Update Performance:');
        console.log(`  Total time: ${totalTime}ms`);
        console.log(`  Avg time per task: ${(totalTime / LARGE_VOLUME_COUNT).toFixed(2)}ms`);
        console.log(`  Ops/second: ${metrics.opsPerSecond.toFixed(2)}`);
      },
      MAX_TEST_TIMEOUT
    );

    it(
      'should perform bulk queries on 10k tasks efficiently',
      async () => {
        console.log('\n=== 10k Bulk Query Test ===');

        // Create diverse dataset
        const statuses: TaskStatus[] = ['pending', 'in-progress', 'completed', 'failed'];
        const priorities: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];

        const { tasks } = await createTasksInBatches(LARGE_VOLUME_COUNT, BATCH_SIZE);

        // Apply varied statuses and priorities
        for (let i = 0; i < LARGE_VOLUME_COUNT; i += BATCH_SIZE) {
          const currentBatchSize = Math.min(BATCH_SIZE, LARGE_VOLUME_COUNT - i);
          const updatePromises = tasks.slice(i, i + currentBatchSize).map((task, j) =>
            store.updateTask(task.id, {
              status: statuses[(i + j) % statuses.length],
              priority: priorities[(i + j) % priorities.length],
            })
          );
          await Promise.all(updatePromises);
        }

        console.log(`  Created and updated ${LARGE_VOLUME_COUNT} tasks with varied statuses/priorities`);

        // Time various queries
        const queryResults: { query: string; timeMs: number; count: number }[] = [];

        // Query 1: List all tasks
        const allStart = Date.now();
        const allTasks = await store.listTasks();
        queryResults.push({
          query: 'listTasks()',
          timeMs: Date.now() - allStart,
          count: allTasks.length,
        });

        // Query 2: Filter by status
        const statusStart = Date.now();
        const pendingTasks = await store.listTasks({ status: 'pending' });
        queryResults.push({
          query: 'listTasks({ status: pending })',
          timeMs: Date.now() - statusStart,
          count: pendingTasks.length,
        });

        // Query 3: Filter with order by priority
        const priorityStart = Date.now();
        const priorityOrderedTasks = await store.listTasks({ orderByPriority: true, limit: 500 });
        queryResults.push({
          query: 'listTasks({ orderByPriority: true, limit: 500 })',
          timeMs: Date.now() - priorityStart,
          count: priorityOrderedTasks.length,
        });

        // Query 4: Filter by completed status
        const completedStart = Date.now();
        const completedTasks = await store.listTasks({ status: 'completed' });
        queryResults.push({
          query: 'listTasks({ status: completed })',
          timeMs: Date.now() - completedStart,
          count: completedTasks.length,
        });

        // Query 5: Get ready tasks
        const readyStart = Date.now();
        const readyTasks = await store.getReadyTasks({ limit: 100 });
        queryResults.push({
          query: 'getReadyTasks({ limit: 100 })',
          timeMs: Date.now() - readyStart,
          count: readyTasks.length,
        });

        // Assertions
        expect(allTasks.length).toBe(LARGE_VOLUME_COUNT);
        expect(pendingTasks.length).toBeGreaterThan(0);
        expect(priorityOrderedTasks.length).toBeGreaterThan(0);

        // All queries should complete in reasonable time
        for (const result of queryResults) {
          expect(result.timeMs).toBeLessThan(30000); // 30 seconds max per query
        }

        console.log('\nQuery Performance Results:');
        for (const result of queryResults) {
          console.log(`  ${result.query}: ${result.timeMs}ms (${result.count} results)`);
        }
      },
      MAX_TEST_TIMEOUT
    );

    it(
      'should handle bulk deletions on 10k tasks',
      async () => {
        console.log('\n=== 10k Bulk Deletion Test ===');

        const { tasks } = await createTasksInBatches(LARGE_VOLUME_COUNT, BATCH_SIZE);
        console.log(`  Created ${LARGE_VOLUME_COUNT} tasks for deletion test`);

        // Trash tasks in batches
        const trashStart = Date.now();
        for (let i = 0; i < LARGE_VOLUME_COUNT; i += BATCH_SIZE) {
          const currentBatchSize = Math.min(BATCH_SIZE, LARGE_VOLUME_COUNT - i);
          const trashPromises = tasks.slice(i, i + currentBatchSize).map((task) =>
            store.trashTask(task.id)
          );
          await Promise.all(trashPromises);

          if ((i + currentBatchSize) % 2000 === 0) {
            console.log(`  Trashed ${i + currentBatchSize}/${LARGE_VOLUME_COUNT} tasks...`);
          }
        }
        const trashTime = Date.now() - trashStart;

        // Empty trash
        const emptyStart = Date.now();
        const deletedCount = await store.emptyTrash();
        const emptyTime = Date.now() - emptyStart;

        // Assertions
        expect(deletedCount).toBe(LARGE_VOLUME_COUNT);
        expect(trashTime).toBeLessThan(120000); // 2 minutes for trashing
        expect(emptyTime).toBeLessThan(60000); // 1 minute for emptying

        // Verify deletion
        const remainingTasks = await store.listTasks();
        expect(remainingTasks.length).toBe(0);

        console.log('\nDeletion Performance:');
        console.log(`  Trash time: ${trashTime}ms (${(trashTime / LARGE_VOLUME_COUNT).toFixed(2)}ms/task)`);
        console.log(`  Empty trash time: ${emptyTime}ms`);
        console.log(`  Deleted count: ${deletedCount}`);
      },
      MAX_TEST_TIMEOUT
    );
  });

  describe('Pagination with 10k Records', () => {
    it(
      'should paginate through 10k records efficiently',
      async () => {
        console.log('\n=== 10k Pagination Test ===');

        const { tasks } = await createTasksInBatches(LARGE_VOLUME_COUNT, BATCH_SIZE);
        console.log(`  Created ${LARGE_VOLUME_COUNT} tasks for pagination test`);

        const pageSize = 100;
        const totalPages = Math.ceil(LARGE_VOLUME_COUNT / pageSize);
        const pageTimes: number[] = [];
        let totalRetrieved = 0;
        const seenIds = new Set<string>();

        const paginationStart = Date.now();

        for (let page = 0; page < totalPages; page++) {
          const pageStart = Date.now();
          const offset = page * pageSize;
          const pageData = await store.listTasks({ limit: pageSize, offset });

          pageTimes.push(Date.now() - pageStart);
          totalRetrieved += pageData.length;

          // Track unique IDs to verify no duplicates
          pageData.forEach((task) => seenIds.add(task.id));

          if ((page + 1) % 20 === 0) {
            console.log(`  Paginated ${page + 1}/${totalPages} pages...`);
          }
        }

        const totalPaginationTime = Date.now() - paginationStart;

        // Assertions
        expect(totalRetrieved).toBe(LARGE_VOLUME_COUNT);
        expect(seenIds.size).toBe(LARGE_VOLUME_COUNT); // No duplicates
        expect(totalPaginationTime).toBeLessThan(THRESHOLDS.pagination.fullScanTimeMs);

        // Calculate page time statistics
        const avgPageTime = pageTimes.reduce((a, b) => a + b, 0) / pageTimes.length;
        const maxPageTime = Math.max(...pageTimes);
        const minPageTime = Math.min(...pageTimes);

        expect(avgPageTime).toBeLessThan(THRESHOLDS.pagination.singlePageMs);

        console.log('\nPagination Performance:');
        console.log(`  Total pages: ${totalPages}`);
        console.log(`  Total time: ${totalPaginationTime}ms`);
        console.log(`  Avg page time: ${avgPageTime.toFixed(2)}ms`);
        console.log(`  Min page time: ${minPageTime}ms`);
        console.log(`  Max page time: ${maxPageTime}ms`);
        console.log(`  Total records retrieved: ${totalRetrieved}`);
      },
      MAX_TEST_TIMEOUT
    );

    it(
      'should maintain consistent pagination order',
      async () => {
        console.log('\n=== Pagination Order Consistency Test ===');

        const taskCount = 10000;
        const { tasks } = await createTasksInBatches(taskCount, BATCH_SIZE);

        // First pass: collect all IDs in pagination order
        const firstPassIds: string[] = [];
        const pageSize = 100;
        const totalPages = Math.ceil(taskCount / pageSize);

        for (let page = 0; page < totalPages; page++) {
          const pageData = await store.listTasks({ limit: pageSize, offset: page * pageSize });
          firstPassIds.push(...pageData.map((t) => t.id));
        }

        // Second pass: verify same order
        const secondPassIds: string[] = [];
        for (let page = 0; page < totalPages; page++) {
          const pageData = await store.listTasks({ limit: pageSize, offset: page * pageSize });
          secondPassIds.push(...pageData.map((t) => t.id));
        }

        // Assertions
        expect(firstPassIds.length).toBe(taskCount);
        expect(secondPassIds.length).toBe(taskCount);
        expect(firstPassIds).toEqual(secondPassIds);

        console.log(`  Verified pagination order consistency across ${taskCount} records`);
      },
      MAX_TEST_TIMEOUT
    );

    it(
      'should handle pagination with filters on 10k records',
      async () => {
        console.log('\n=== Filtered Pagination Test ===');

        const priorities: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];
        const { tasks } = await createTasksInBatches(LARGE_VOLUME_COUNT, BATCH_SIZE);

        // Update priorities
        for (let i = 0; i < LARGE_VOLUME_COUNT; i += BATCH_SIZE) {
          const currentBatchSize = Math.min(BATCH_SIZE, LARGE_VOLUME_COUNT - i);
          const updatePromises = tasks.slice(i, i + currentBatchSize).map((task, j) =>
            store.updateTask(task.id, {
              priority: priorities[(i + j) % priorities.length],
            })
          );
          await Promise.all(updatePromises);
        }

        // Paginate through pending tasks with priority ordering
        const pageSize = 50;
        let totalPending = 0;
        let page = 0;
        const pendingIds = new Set<string>();

        const startTime = Date.now();

        while (true) {
          const pageData = await store.listTasks({
            status: 'pending',
            orderByPriority: true,
            limit: pageSize,
            offset: page * pageSize,
          });

          if (pageData.length === 0) break;

          totalPending += pageData.length;
          pageData.forEach((t) => pendingIds.add(t.id));
          page++;
        }

        const totalTime = Date.now() - startTime;

        // All 10k tasks should be pending (we only updated priority)
        expect(totalPending).toBe(LARGE_VOLUME_COUNT);
        expect(pendingIds.size).toBe(totalPending); // No duplicates

        console.log(`  Filtered pagination completed in ${totalTime}ms`);
        console.log(`  Pending tasks found: ${totalPending}`);
        console.log(`  Pages processed: ${page}`);
      },
      MAX_TEST_TIMEOUT
    );
  });

  describe('Query Performance Degradation Analysis', () => {
    it(
      'should track query performance as dataset grows',
      async () => {
        console.log('\n=== Query Degradation Analysis ===');

        const checkpoints = [100, 500, 1000, 2000, 5000, 10000];
        const degradationData: DegradationDataPoint[] = [];

        let totalCreated = 0;

        for (const targetCount of checkpoints) {
          // Create tasks up to this checkpoint
          const toCreate = targetCount - totalCreated;
          if (toCreate > 0) {
            await createTasksInBatches(toCreate, BATCH_SIZE);
            totalCreated = targetCount;
          }

          // Measure query performance at this scale
          // Query 1: List all
          const listAllStart = Date.now();
          await store.listTasks();
          degradationData.push({
            taskCount: targetCount,
            queryTimeMs: Date.now() - listAllStart,
            queryType: 'listAll',
          });

          // Query 2: Filter by status
          const filterStart = Date.now();
          await store.listTasks({ status: 'pending' });
          degradationData.push({
            taskCount: targetCount,
            queryTimeMs: Date.now() - filterStart,
            queryType: 'filterStatus',
          });

          // Query 3: Get ready tasks
          const readyStart = Date.now();
          await store.getReadyTasks({ limit: 100 });
          degradationData.push({
            taskCount: targetCount,
            queryTimeMs: Date.now() - readyStart,
            queryType: 'getReady',
          });

          // Query 4: Pagination (first page)
          const pageStart = Date.now();
          await store.listTasks({ limit: 100, offset: 0 });
          degradationData.push({
            taskCount: targetCount,
            queryTimeMs: Date.now() - pageStart,
            queryType: 'pagination',
          });

          console.log(`  Measured performance at ${targetCount} tasks`);
        }

        // Analyze degradation
        const queryTypes = ['listAll', 'filterStatus', 'getReady', 'pagination'];

        console.log('\nDegradation Analysis Results:');
        console.log('Task Count | listAll | filterStatus | getReady | pagination');
        console.log('-----------|---------|--------------|----------|----------');

        for (const checkpoint of checkpoints) {
          const row = [checkpoint.toString().padEnd(10)];
          for (const queryType of queryTypes) {
            const dataPoint = degradationData.find(
              (d) => d.taskCount === checkpoint && d.queryType === queryType
            );
            row.push((dataPoint?.queryTimeMs.toString() + 'ms').padEnd(12));
          }
          console.log(row.join(' | '));
        }

        // Calculate slowdown factors (10k vs 1k)
        console.log('\nSlowdown Factors (10k vs 1k):');
        for (const queryType of queryTypes) {
          const at1k = degradationData.find(
            (d) => d.taskCount === 1000 && d.queryType === queryType
          );
          const at10k = degradationData.find(
            (d) => d.taskCount === 10000 && d.queryType === queryType
          );

          if (at1k && at10k && at1k.queryTimeMs > 0) {
            const slowdownFactor = at10k.queryTimeMs / at1k.queryTimeMs;
            console.log(`  ${queryType}: ${slowdownFactor.toFixed(2)}x`);

            // Assert reasonable degradation
            expect(slowdownFactor).toBeLessThan(THRESHOLDS.queryDegradation.maxSlowdownFactor);
          }
        }
      },
      MAX_TEST_TIMEOUT
    );

    it(
      'should maintain acceptable performance for indexed queries',
      async () => {
        console.log('\n=== Indexed Query Performance Test ===');

        // Create 10k tasks with varied data
        const statuses: TaskStatus[] = ['pending', 'in-progress', 'completed', 'failed'];
        const priorities: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];

        const { tasks } = await createTasksInBatches(LARGE_VOLUME_COUNT, BATCH_SIZE);

        // Update with varied attributes
        for (let i = 0; i < LARGE_VOLUME_COUNT; i += BATCH_SIZE) {
          const currentBatchSize = Math.min(BATCH_SIZE, LARGE_VOLUME_COUNT - i);
          const updatePromises = tasks.slice(i, i + currentBatchSize).map((task, j) =>
            store.updateTask(task.id, {
              status: statuses[(i + j) % statuses.length],
              priority: priorities[(i + j) % priorities.length],
            })
          );
          await Promise.all(updatePromises);
        }

        // Test indexed lookups
        const indexedQueries: { name: string; timeMs: number }[] = [];

        // Primary key lookup (should be O(1))
        const randomTaskId = tasks[Math.floor(Math.random() * tasks.length)].id;
        const pkStart = Date.now();
        await store.getTask(randomTaskId);
        indexedQueries.push({ name: 'Primary Key Lookup', timeMs: Date.now() - pkStart });

        // Status filter (should use index if exists)
        const statusStart = Date.now();
        await store.listTasks({ status: 'pending', limit: 100 });
        indexedQueries.push({ name: 'Status Filter', timeMs: Date.now() - statusStart });

        // Priority ordered query
        const priorityStart = Date.now();
        await store.listTasks({ orderByPriority: true, limit: 100 });
        indexedQueries.push({ name: 'Priority Ordered', timeMs: Date.now() - priorityStart });

        // In-progress status filter
        const inProgressStart = Date.now();
        await store.listTasks({ status: 'in-progress', limit: 100 });
        indexedQueries.push({ name: 'In-Progress Filter', timeMs: Date.now() - inProgressStart });

        // Assertions
        for (const query of indexedQueries) {
          // Indexed queries should complete quickly even with 10k records
          expect(query.timeMs).toBeLessThan(5000); // 5 second max
        }

        console.log('\nIndexed Query Performance:');
        for (const query of indexedQueries) {
          console.log(`  ${query.name}: ${query.timeMs}ms`);
        }
      },
      MAX_TEST_TIMEOUT
    );

    it(
      'should handle complex queries with dependencies at scale',
      async () => {
        console.log('\n=== Complex Query with Dependencies Test ===');

        // Create a smaller set for dependency testing (2k to keep test time reasonable)
        const taskCount = 2000;
        const { tasks } = await createTasksInBatches(taskCount, BATCH_SIZE);

        // Create dependency chains (every 10 tasks depends on the previous one)
        const dependencyStart = Date.now();
        for (let i = 10; i < taskCount; i += 10) {
          await store.addDependency(tasks[i].id, tasks[i - 10].id);
        }
        const dependencyTime = Date.now() - dependencyStart;

        // Test getReadyTasks with dependencies
        const readyStart = Date.now();
        const readyTasks = await store.getReadyTasks({ limit: 100, orderByPriority: true });
        const readyTime = Date.now() - readyStart;

        // Test isTaskReady for multiple tasks
        const readyCheckStart = Date.now();
        const readyChecks = await Promise.all(
          tasks.slice(0, 100).map((t) => store.isTaskReady(t.id))
        );
        const readyCheckTime = Date.now() - readyCheckStart;

        // Assertions
        expect(readyTasks.length).toBeGreaterThan(0);
        expect(dependencyTime).toBeLessThan(60000); // 1 minute for dependency creation
        expect(readyTime).toBeLessThan(10000); // 10 seconds for ready tasks query
        expect(readyCheckTime).toBeLessThan(10000); // 10 seconds for 100 ready checks

        console.log('\nComplex Query Performance:');
        console.log(`  Dependency creation (${taskCount / 10} deps): ${dependencyTime}ms`);
        console.log(`  getReadyTasks(): ${readyTime}ms (${readyTasks.length} ready)`);
        console.log(`  100 isTaskReady checks: ${readyCheckTime}ms`);
      },
      MAX_TEST_TIMEOUT
    );
  });

  describe('Memory and Resource Management', () => {
    it(
      'should not exhaust memory during large operations',
      async () => {
        console.log('\n=== Memory Management Test ===');

        // Get baseline memory
        const initialMemory = process.memoryUsage();

        // Create 10k tasks
        const { tasks } = await createTasksInBatches(LARGE_VOLUME_COUNT, BATCH_SIZE);

        // Check memory after creation
        const afterCreateMemory = process.memoryUsage();

        // Perform bulk operations
        for (let i = 0; i < 5; i++) {
          // Query all tasks multiple times
          await store.listTasks();
          await store.listTasks({ status: 'pending' });
        }

        // Check final memory
        const finalMemory = process.memoryUsage();

        // Calculate memory growth
        const createGrowthMB =
          (afterCreateMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);
        const totalGrowthMB = (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);

        console.log('\nMemory Usage:');
        console.log(`  Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  After create: ${(afterCreateMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  Growth during creation: ${createGrowthMB.toFixed(2)}MB`);
        console.log(`  Total growth: ${totalGrowthMB.toFixed(2)}MB`);

        // Memory should stay within reasonable bounds
        // Allow up to 500MB growth for 10k tasks (conservative limit)
        expect(totalGrowthMB).toBeLessThan(500);
      },
      MAX_TEST_TIMEOUT
    );
  });
});
