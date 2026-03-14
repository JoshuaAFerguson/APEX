/**
 * @fileoverview TaskStore CRUD Operation Benchmarks
 *
 * Measures performance of task store operations including
 * create, read, update, delete, and bulk operations.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  BenchmarkRunner,
  ORCHESTRATOR_THRESHOLDS,
  BenchmarkReporter,
} from '../../../benchmarks/shared/index.js';
import { TaskStore } from '../src/store.js';
import type { CreateTaskRequest } from '@apexcli/core';

describe('TaskStore CRUD Benchmarks', () => {
  const reporter = new BenchmarkReporter();
  let tempDir: string;
  let store: TaskStore;

  beforeAll(() => {
    reporter.start();
    // Create a unique temp directory for the benchmark
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-bench-store-'));
  });

  afterAll(async () => {
    reporter.printReport();
    // Cleanup temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    // Create fresh store for each test
    const testDir = fs.mkdtempSync(path.join(tempDir, 'test-'));
    store = new TaskStore(testDir);
  });

  afterEach(async () => {
    // Close the store connection
    if (store) {
      try {
        await store.close?.();
      } catch {
        // Ignore close errors
      }
    }
  });

  describe('Create Operations', () => {
    it('should benchmark single task creation', async () => {
      const runner = new BenchmarkRunner();
      let taskCounter = 0;

      const result = await runner.run(
        {
          name: 'task-store-create-single',
          iterations: 100,
          warmupIterations: 10,
          threshold: ORCHESTRATOR_THRESHOLDS.taskStore.create,
        },
        async () => {
          const taskRequest: CreateTaskRequest = {
            description: `Benchmark task ${taskCounter++}`,
            workflow: 'development',
            agent: 'developer',
          };

          const task = await store.createTask(taskRequest);
          expect(task.id).toBeDefined();
          return task;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark bulk task creation (100 tasks)', async () => {
      const runner = new BenchmarkRunner();
      let batchCounter = 0;

      const result = await runner.run(
        {
          name: 'task-store-bulk-create-100',
          iterations: 10,
          warmupIterations: 2,
          threshold: ORCHESTRATOR_THRESHOLDS.taskStore.bulkCreate100,
        },
        async () => {
          const tasks = [];
          for (let i = 0; i < 100; i++) {
            const taskRequest: CreateTaskRequest = {
              description: `Bulk task ${batchCounter}-${i}`,
              workflow: 'development',
              agent: 'developer',
            };
            const task = await store.createTask(taskRequest);
            tasks.push(task);
          }
          batchCounter++;
          expect(tasks.length).toBe(100);
          return tasks;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });

  describe('Read Operations', () => {
    let testTaskId: string;

    beforeEach(async () => {
      // Create a task to read
      const task = await store.createTask({
        description: 'Test task for read benchmarks',
        workflow: 'development',
        agent: 'developer',
      });
      testTaskId = task.id;
    });

    it('should benchmark single task read by ID', async () => {
      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'task-store-read-single',
          iterations: 100,
          warmupIterations: 10,
          threshold: ORCHESTRATOR_THRESHOLDS.taskStore.read,
        },
        async () => {
          const task = await store.getTask(testTaskId);
          expect(task).not.toBeNull();
          expect(task?.id).toBe(testTaskId);
          return task;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark read non-existent task', async () => {
      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'task-store-read-miss',
          iterations: 100,
          warmupIterations: 10,
          threshold: ORCHESTRATOR_THRESHOLDS.taskStore.read,
        },
        async () => {
          const task = await store.getTask('non-existent-task-id');
          expect(task).toBeNull();
          return task;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });

  describe('Update Operations', () => {
    let testTaskId: string;

    beforeEach(async () => {
      // Create a task to update
      const task = await store.createTask({
        description: 'Test task for update benchmarks',
        workflow: 'development',
        agent: 'developer',
      });
      testTaskId = task.id;
    });

    it('should benchmark task status update', async () => {
      const runner = new BenchmarkRunner();
      const statuses = ['pending', 'running', 'paused', 'pending'] as const;
      let statusIndex = 0;

      const result = await runner.run(
        {
          name: 'task-store-update-status',
          iterations: 100,
          warmupIterations: 10,
          threshold: ORCHESTRATOR_THRESHOLDS.taskStore.update,
        },
        async () => {
          const status = statuses[statusIndex % statuses.length];
          statusIndex++;
          await store.updateTaskStatus(testTaskId, status);
          const task = await store.getTask(testTaskId);
          expect(task?.status).toBe(status);
          return task;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark task metadata update', async () => {
      const runner = new BenchmarkRunner();
      let updateCounter = 0;

      const result = await runner.run(
        {
          name: 'task-store-update-metadata',
          iterations: 100,
          warmupIterations: 10,
          threshold: ORCHESTRATOR_THRESHOLDS.taskStore.update,
        },
        async () => {
          const task = await store.getTask(testTaskId);
          if (task) {
            task.metadata = {
              ...task.metadata,
              updateCount: updateCounter++,
              timestamp: Date.now(),
            };
            await store.updateTask(task);
          }
          return task;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });

  describe('Delete Operations', () => {
    it('should benchmark task deletion', async () => {
      // Pre-create tasks for deletion
      const taskIds: string[] = [];
      for (let i = 0; i < 110; i++) {
        const task = await store.createTask({
          description: `Task for deletion ${i}`,
          workflow: 'development',
          agent: 'developer',
        });
        taskIds.push(task.id);
      }

      const runner = new BenchmarkRunner();
      let deleteIndex = 0;

      const result = await runner.run(
        {
          name: 'task-store-delete-single',
          iterations: 100,
          warmupIterations: 10,
          threshold: ORCHESTRATOR_THRESHOLDS.taskStore.delete,
        },
        async () => {
          const taskId = taskIds[deleteIndex++];
          await store.deleteTask(taskId);
          const task = await store.getTask(taskId);
          expect(task).toBeNull();
          return taskId;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Create a set of tasks with various statuses for querying
      const statuses = ['pending', 'running', 'completed', 'failed'] as const;

      for (let i = 0; i < 50; i++) {
        const task = await store.createTask({
          description: `Query test task ${i}`,
          workflow: i % 2 === 0 ? 'development' : 'bugfix',
          agent: i % 3 === 0 ? 'developer' : 'tester',
        });

        // Update status for variety
        await store.updateTaskStatus(task.id, statuses[i % statuses.length]);
      }
    });

    it('should benchmark list all tasks', async () => {
      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'task-store-query-all',
          iterations: 50,
          warmupIterations: 5,
          threshold: ORCHESTRATOR_THRESHOLDS.taskStore.queryAll,
        },
        async () => {
          const tasks = await store.listTasks();
          expect(tasks.length).toBeGreaterThan(0);
          return tasks;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark query tasks by status', async () => {
      const runner = new BenchmarkRunner();
      const statuses = ['pending', 'running', 'completed', 'failed'] as const;
      let statusIndex = 0;

      const result = await runner.run(
        {
          name: 'task-store-query-by-status',
          iterations: 50,
          warmupIterations: 5,
          threshold: ORCHESTRATOR_THRESHOLDS.taskStore.queryByStatus,
        },
        async () => {
          const status = statuses[statusIndex % statuses.length];
          statusIndex++;
          const tasks = await store.listTasks({ status });
          return tasks;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });

  describe('Concurrent Operations', () => {
    it('should benchmark concurrent read operations', async () => {
      // Create tasks for concurrent reads
      const tasks = [];
      for (let i = 0; i < 10; i++) {
        const task = await store.createTask({
          description: `Concurrent read task ${i}`,
          workflow: 'development',
          agent: 'developer',
        });
        tasks.push(task);
      }

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'task-store-concurrent-reads',
          iterations: 20,
          warmupIterations: 5,
          threshold: {
            maxMean: 10,
            maxP95: 25,
          },
        },
        async () => {
          const reads = tasks.map(t => store.getTask(t.id));
          const results = await Promise.all(reads);
          expect(results.length).toBe(10);
          return results;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark mixed read/write operations', async () => {
      const runner = new BenchmarkRunner();
      let opCounter = 0;

      const result = await runner.run(
        {
          name: 'task-store-mixed-operations',
          iterations: 20,
          warmupIterations: 5,
          threshold: {
            maxMean: 30,
            maxP95: 75,
          },
        },
        async () => {
          const ops = [];

          // Create 3 tasks
          for (let i = 0; i < 3; i++) {
            ops.push(
              store.createTask({
                description: `Mixed op task ${opCounter++}`,
                workflow: 'development',
                agent: 'developer',
              })
            );
          }

          // List tasks
          ops.push(store.listTasks());

          const results = await Promise.all(ops);
          expect(results.length).toBe(4);
          return results;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });
});
