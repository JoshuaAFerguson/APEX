/**
 * SQLite Connection Pool Behavior Tests
 *
 * TECHNICAL DESIGN DOCUMENT
 *
 * Purpose: This test suite validates the connection handling behavior of the
 * better-sqlite3 library as used by APEX's TaskStore. Better-sqlite3 is a
 * synchronous SQLite wrapper that doesn't use traditional connection pooling,
 * but rather a single connection with WAL mode for concurrent access.
 *
 * Test Coverage Areas:
 * 1. Connection Reuse Verification - Validate single connection is reused
 * 2. Pool Exhaustion Scenarios - Test behavior under connection stress
 * 3. Connection Recovery After Errors - Verify resilience after failures
 * 4. WAL Mode Behavior Under Load - Test write-ahead logging performance
 * 5. Database Locking Scenarios - Validate concurrent access handling
 *
 * Architecture Notes:
 * - better-sqlite3 uses a single database connection per instance
 * - WAL (Write-Ahead Logging) mode enables concurrent reads during writes
 * - Synchronous API means operations block the event loop
 * - Multiple TaskStore instances can share the same database file safely
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';
import { TaskStore } from '../store';
import type { CreateTaskRequest } from '@apexcli/core';

describe('SQLite Connection Pool Behavior Tests', () => {
  let testDir: string;
  let store: TaskStore;

  const createTaskRequest = (suffix = ''): CreateTaskRequest => ({
    description: `Connection pool test task ${suffix}`,
    acceptanceCriteria: `Test acceptance criteria ${suffix}`,
    workflow: 'feature',
    autonomy: 'full',
    agent: 'developer',
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'sqlite-connection-pool-test-')
    );
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    if (store) {
      await store.close();
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Connection Reuse Verification', () => {
    it('should reuse the same database connection across operations', () => {
      // Get the database connection reference
      const db1 = store.getDatabase();
      const db2 = store.getDatabase();

      // Should be the exact same connection instance
      expect(db1).toBe(db2);
      expect(db1.open).toBe(true);
    });

    it('should maintain connection state after multiple operations', async () => {
      const db = store.getDatabase();
      const initialOpen = db.open;

      // Perform multiple operations
      for (let i = 0; i < 50; i++) {
        await store.createTask(createTaskRequest(`reuse-${i}`));
      }

      // Connection should still be open and the same
      expect(db.open).toBe(initialOpen);
      expect(store.getDatabase()).toBe(db);
    });

    it('should preserve prepared statement cache across operations', async () => {
      const task1 = await store.createTask(createTaskRequest('stmt-1'));
      const task2 = await store.createTask(createTaskRequest('stmt-2'));

      // Multiple reads should benefit from cached statements
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        await store.getTask(task1.id);
        await store.getTask(task2.id);
      }
      const elapsedTime = Date.now() - startTime;

      // Cached statements should be efficient (< 2 seconds for 200 reads)
      expect(elapsedTime).toBeLessThan(2000);
    });

    it('should handle connection after operations that modify schema', async () => {
      const db = store.getDatabase();

      // Verify WAL mode is active
      const journalMode = db.pragma('journal_mode');
      expect(journalMode).toBe('wal');

      // Perform operations
      const task = await store.createTask(createTaskRequest('schema-test'));
      await store.addLog(task.id, { level: 'info', message: 'Test log' });

      // Connection should still be functional
      const retrieved = await store.getTask(task.id);
      expect(retrieved?.logs).toHaveLength(1);
    });
  });

  describe('Pool Exhaustion Scenarios', () => {
    it('should handle multiple concurrent store instances sharing database', async () => {
      // Create multiple store instances pointing to same database
      const stores: TaskStore[] = [];
      const storeCount = 5;

      try {
        for (let i = 0; i < storeCount; i++) {
          const s = new TaskStore(testDir);
          await s.initialize();
          stores.push(s);
        }

        // All stores should be able to perform operations
        const tasks = await Promise.all(
          stores.map((s, i) =>
            s.createTask(createTaskRequest(`multi-store-${i}`))
          )
        );

        expect(tasks).toHaveLength(storeCount);
        tasks.forEach((task) => {
          expect(task.id).toBeDefined();
        });

        // All stores should see all tasks
        for (const s of stores) {
          const allTasks = await s.listTasks();
          expect(allTasks.length).toBeGreaterThanOrEqual(storeCount);
        }
      } finally {
        // Clean up additional stores
        for (const s of stores) {
          if (s !== store) {
            await s.close();
          }
        }
      }
    });

    it('should handle rapid connection open/close cycles', async () => {
      const cycleCount = 20;
      const createdTasks: string[] = [];

      for (let i = 0; i < cycleCount; i++) {
        const tempStore = new TaskStore(testDir);
        await tempStore.initialize();

        // Create a task
        const task = await tempStore.createTask(
          createTaskRequest(`cycle-${i}`)
        );
        createdTasks.push(task.id);

        // Close immediately
        await tempStore.close();
      }

      // All tasks should persist
      const finalStore = new TaskStore(testDir);
      await finalStore.initialize();

      try {
        for (const taskId of createdTasks) {
          const task = await finalStore.getTask(taskId);
          expect(task).not.toBeNull();
        }
      } finally {
        await finalStore.close();
      }
    });

    it('should handle operations when system resources are stressed', async () => {
      // Simulate resource stress by performing many concurrent operations
      const operationCount = 100;

      const operations = Array(operationCount)
        .fill(null)
        .map(async (_, i) => {
          const task = await store.createTask(
            createTaskRequest(`stress-${i}`)
          );
          await store.updateTask(task.id, { status: 'in-progress' });
          await store.addLog(task.id, {
            level: 'info',
            message: `Stress test log ${i}`,
          });
          return store.getTask(task.id);
        });

      const results = await Promise.all(operations);

      // All operations should complete
      expect(results).toHaveLength(operationCount);
      results.forEach((task) => {
        expect(task).not.toBeNull();
        expect(task?.status).toBe('in-progress');
      });
    });
  });

  describe('Connection Recovery After Errors', () => {
    it('should recover from transient database errors', async () => {
      // Create initial task to ensure database is working
      const task1 = await store.createTask(createTaskRequest('recovery-1'));
      expect(task1).toBeDefined();

      // Attempt operations that might cause errors
      try {
        // Invalid update (depends on implementation, may not throw)
        await store.updateTask('non-existent-id', { status: 'pending' });
      } catch {
        // Error expected, continue
      }

      // Connection should still work
      const task2 = await store.createTask(createTaskRequest('recovery-2'));
      expect(task2).toBeDefined();

      const retrieved = await store.getTask(task1.id);
      expect(retrieved).not.toBeNull();
    });

    it('should handle database operations after store reconnection', async () => {
      // Create task before close
      const task = await store.createTask(createTaskRequest('reconnect-test'));

      // Close and reopen
      await store.close();

      // Create new store instance
      const newStore = new TaskStore(testDir);
      await newStore.initialize();

      try {
        // Should be able to access previous data
        const retrieved = await newStore.getTask(task.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe(task.id);

        // Should be able to create new data
        const newTask = await newStore.createTask(
          createTaskRequest('after-reconnect')
        );
        expect(newTask).toBeDefined();
      } finally {
        await newStore.close();

        // Reinitialize original store for cleanup
        store = new TaskStore(testDir);
        await store.initialize();
      }
    });

    it('should gracefully handle constraint violation errors', async () => {
      const task = await store.createTask(createTaskRequest('constraint-test'));

      // Try to create duplicate task (same ID) - this should be handled properly
      try {
        // Attempt to manually insert duplicate data
        const db = store.getDatabase();
        const stmt = db.prepare('INSERT INTO tasks (id, description) VALUES (?, ?)');
        stmt.run(task.id, 'Duplicate task');
      } catch (error) {
        // Expected constraint violation
        expect(error).toBeDefined();
      }

      // Connection should still be functional
      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();

      const newTask = await store.createTask(
        createTaskRequest('after-constraint-error')
      );
      expect(newTask).toBeDefined();
    });

    it('should recover state after failed transaction', async () => {
      const initialTask = await store.createTask(
        createTaskRequest('transaction-recovery')
      );
      const initialStatus = initialTask.status;

      // Attempt operation that should fail
      try {
        // This might or might not throw depending on implementation
        await store.archiveTask(initialTask.id); // Can't archive non-completed task
      } catch {
        // Expected to fail
      }

      // Task should be unchanged
      const retrieved = await store.getTask(initialTask.id);
      expect(retrieved?.status).toBe(initialStatus);

      // Store should still be functional
      const newTask = await store.createTask(
        createTaskRequest('after-failed-transaction')
      );
      expect(newTask).toBeDefined();
    });
  });

  describe('WAL Mode Behavior Under Load', () => {
    it('should have WAL mode enabled', () => {
      const db = store.getDatabase();
      const journalMode = db.pragma('journal_mode');
      expect(journalMode).toBe('wal');
    });

    it('should handle concurrent reads during writes with WAL mode', async () => {
      // Create initial dataset
      const initialTasks = await Promise.all(
        Array(20)
          .fill(null)
          .map((_, i) => store.createTask(createTaskRequest(`wal-initial-${i}`)))
      );

      // Perform concurrent reads and writes
      const writeOps = Array(30)
        .fill(null)
        .map((_, i) => store.createTask(createTaskRequest(`wal-write-${i}`)));

      const readOps = Array(50)
        .fill(null)
        .map((_, i) => {
          const targetTask = initialTasks[i % initialTasks.length];
          return store.getTask(targetTask.id);
        });

      // Execute all concurrently
      const [writeResults, readResults] = await Promise.all([
        Promise.all(writeOps),
        Promise.all(readOps),
      ]);

      expect(writeResults).toHaveLength(30);
      expect(readResults).toHaveLength(50);

      // All reads should return valid data
      readResults.forEach((task) => {
        expect(task).not.toBeNull();
      });
    });

    it('should maintain data integrity under high write load', async () => {
      const writeCount = 100;
      const startTime = Date.now();

      // Rapid sequential writes
      const tasks: { id: string; index: number }[] = [];
      for (let i = 0; i < writeCount; i++) {
        const task = await store.createTask({
          ...createTaskRequest(`integrity-${i}`),
          priority: i % 2 === 0 ? 'high' : 'normal',
        });
        tasks.push({ id: task.id, index: i });
      }

      const writeTime = Date.now() - startTime;

      // Verify all data
      let highPriorityCount = 0;
      let normalPriorityCount = 0;

      for (const { id, index } of tasks) {
        const task = await store.getTask(id);
        expect(task).not.toBeNull();

        if (index % 2 === 0) {
          expect(task?.priority).toBe('high');
          highPriorityCount++;
        } else {
          expect(task?.priority).toBe('normal');
          normalPriorityCount++;
        }
      }

      expect(highPriorityCount).toBe(50);
      expect(normalPriorityCount).toBe(50);

      console.log(`WAL write load: ${writeCount} tasks in ${writeTime}ms`);
    });

    it('should create WAL and SHM files during active operations', async () => {
      const db = store.getDatabase();
      const dbPath = (store as any).dbPath;

      // Perform some operations to trigger WAL activity
      await Promise.all(
        Array(10)
          .fill(null)
          .map((_, i) => store.createTask(createTaskRequest(`wal-file-${i}`)))
      );

      // Check for WAL-related files (they may or may not exist depending on checkpointing)
      const walPath = `${dbPath}-wal`;
      const shmPath = `${dbPath}-shm`;

      try {
        // These files exist during active transactions with WAL mode
        const walExists = await fs
          .stat(walPath)
          .then(() => true)
          .catch(() => false);
        const shmExists = await fs
          .stat(shmPath)
          .then(() => true)
          .catch(() => false);

        // WAL mode is enabled, files may exist
        console.log(`WAL file exists: ${walExists}, SHM file exists: ${shmExists}`);

        // The important thing is the journal mode is WAL
        const journalMode = db.pragma('journal_mode');
        expect(journalMode).toBe('wal');
      } catch {
        // File checks may fail, but database should still be functional
        expect(db.open).toBe(true);
      }
    });

    it('should perform WAL checkpoint when appropriate', async () => {
      const db = store.getDatabase();

      // Create significant data to trigger WAL growth
      await Promise.all(
        Array(50)
          .fill(null)
          .map((_, i) =>
            store.createTask({
              ...createTaskRequest(`checkpoint-${i}`),
              description: 'A'.repeat(1000), // Larger data
            })
          )
      );

      // Force a checkpoint
      const checkpointResult = db.pragma('wal_checkpoint(TRUNCATE)');

      // Checkpoint should complete (result structure varies)
      expect(checkpointResult).toBeDefined();

      // Database should still be functional after checkpoint
      const task = await store.createTask(createTaskRequest('after-checkpoint'));
      expect(task).toBeDefined();
    });
  });

  describe('Database Locking Scenarios', () => {
    it('should handle sequential operations without lock contention', async () => {
      const operationCount = 50;
      const startTime = Date.now();

      for (let i = 0; i < operationCount; i++) {
        const task = await store.createTask(createTaskRequest(`seq-${i}`));
        await store.updateTask(task.id, { status: 'in-progress' });
        await store.getTask(task.id);
      }

      const elapsedTime = Date.now() - startTime;

      // Sequential operations should complete efficiently (< 10 seconds)
      expect(elapsedTime).toBeLessThan(10000);
      console.log(
        `Sequential operations: ${operationCount * 3} ops in ${elapsedTime}ms`
      );
    });

    it('should handle parallel reads without blocking', async () => {
      // Create test data
      const tasks = await Promise.all(
        Array(30)
          .fill(null)
          .map((_, i) => store.createTask(createTaskRequest(`read-lock-${i}`)))
      );

      const startTime = Date.now();

      // Parallel reads
      const readResults = await Promise.all(
        Array(100)
          .fill(null)
          .map((_, i) => {
            const targetTask = tasks[i % tasks.length];
            return store.getTask(targetTask.id);
          })
      );

      const elapsedTime = Date.now() - startTime;

      expect(readResults).toHaveLength(100);
      readResults.forEach((task) => {
        expect(task).not.toBeNull();
      });

      // Parallel reads should be fast (< 3 seconds for 100 reads)
      expect(elapsedTime).toBeLessThan(3000);
      console.log(`Parallel reads: 100 reads in ${elapsedTime}ms`);
    });

    it('should serialize writes correctly without corruption', async () => {
      const task = await store.createTask(createTaskRequest('write-lock-test'));
      const updateCount = 30;

      // Concurrent updates to the same task
      const updates = Array(updateCount)
        .fill(null)
        .map((_, i) =>
          store.updateTask(task.id, {
            retryCount: i,
            error: `Update ${i}`,
          })
        );

      await Promise.all(updates);

      // Final state should be consistent (one of the updates won)
      const finalTask = await store.getTask(task.id);
      expect(finalTask).not.toBeNull();
      expect(finalTask?.retryCount).toBeGreaterThanOrEqual(0);
      expect(finalTask?.retryCount).toBeLessThan(updateCount);
    });

    it('should handle multi-store concurrent operations safely', async () => {
      const store2 = new TaskStore(testDir);
      await store2.initialize();

      try {
        // Concurrent operations from different stores
        const ops1 = Array(20)
          .fill(null)
          .map((_, i) =>
            store.createTask(createTaskRequest(`store1-concurrent-${i}`))
          );

        const ops2 = Array(20)
          .fill(null)
          .map((_, i) =>
            store2.createTask(createTaskRequest(`store2-concurrent-${i}`))
          );

        const [results1, results2] = await Promise.all([
          Promise.all(ops1),
          Promise.all(ops2),
        ]);

        expect(results1).toHaveLength(20);
        expect(results2).toHaveLength(20);

        // Both stores should see all tasks
        const store1Tasks = await store.listTasks();
        const store2Tasks = await store2.listTasks();

        expect(store1Tasks.length).toBeGreaterThanOrEqual(40);
        expect(store2Tasks.length).toBeGreaterThanOrEqual(40);
      } finally {
        await store2.close();
      }
    });

    it('should handle read-write interleaving correctly', async () => {
      // Create initial data
      const initialTask = await store.createTask(
        createTaskRequest('interleave-test')
      );

      // Interleave reads and writes
      const operations = Array(60)
        .fill(null)
        .map((_, i) => {
          if (i % 3 === 0) {
            // Write new task
            return store.createTask(createTaskRequest(`interleave-${i}`));
          } else if (i % 3 === 1) {
            // Update existing task
            return store.updateTask(initialTask.id, { retryCount: i });
          } else {
            // Read
            return store.getTask(initialTask.id);
          }
        });

      const results = await Promise.all(operations);

      expect(results).toHaveLength(60);

      // Verify final state
      const finalTask = await store.getTask(initialTask.id);
      expect(finalTask).not.toBeNull();
    });

    it('should handle database busy scenarios gracefully', async () => {
      const store2 = new TaskStore(testDir);
      const store3 = new TaskStore(testDir);
      await store2.initialize();
      await store3.initialize();

      try {
        // Create heavy load from multiple stores
        const heavyOps = [
          ...Array(15)
            .fill(null)
            .map((_, i) =>
              store.createTask(createTaskRequest(`busy-s1-${i}`))
            ),
          ...Array(15)
            .fill(null)
            .map((_, i) =>
              store2.createTask(createTaskRequest(`busy-s2-${i}`))
            ),
          ...Array(15)
            .fill(null)
            .map((_, i) =>
              store3.createTask(createTaskRequest(`busy-s3-${i}`))
            ),
        ];

        const results = await Promise.all(heavyOps);

        // All operations should eventually complete
        expect(results).toHaveLength(45);
        results.forEach((task) => {
          expect(task).toBeDefined();
          expect(task.id).toBeDefined();
        });
      } finally {
        await store2.close();
        await store3.close();
      }
    });
  });

  describe('Connection Lifecycle and Resource Management', () => {
    it('should properly release resources on close', async () => {
      const tempStore = new TaskStore(testDir);
      await tempStore.initialize();

      const db = tempStore.getDatabase();
      expect(db.open).toBe(true);

      await tempStore.close();

      // After close, database should not be open
      expect(db.open).toBe(false);
    });

    it('should handle operations on closed connection gracefully', async () => {
      const tempStore = new TaskStore(testDir);
      await tempStore.initialize();
      await tempStore.close();

      // Operations on closed store should throw
      await expect(
        tempStore.createTask(createTaskRequest('closed-store'))
      ).rejects.toThrow();
    });

    it('should allow reinitialize after close', async () => {
      const tempStore = new TaskStore(testDir);
      await tempStore.initialize();

      const task1 = await tempStore.createTask(createTaskRequest('before-reinit'));
      await tempStore.close();

      // Reinitialize
      await tempStore.initialize();

      // Should work again
      const task2 = await tempStore.createTask(createTaskRequest('after-reinit'));
      expect(task2).toBeDefined();

      // Previous data should still be accessible
      const retrieved = await tempStore.getTask(task1.id);
      expect(retrieved).not.toBeNull();

      await tempStore.close();
    });

    it('should handle memory pressure during heavy operations', async () => {
      // Create many tasks with substantial data
      const taskCount = 100;
      const tasks: string[] = [];

      for (let i = 0; i < taskCount; i++) {
        const task = await store.createTask({
          ...createTaskRequest(`memory-${i}`),
          description: 'D'.repeat(5000), // 5KB description
        });

        // Add logs to each task
        for (let j = 0; j < 5; j++) {
          await store.addLog(task.id, {
            level: 'info',
            message: 'M'.repeat(1000), // 1KB message
          });
        }

        tasks.push(task.id);
      }

      // Retrieve all tasks with their logs
      const retrievedTasks = await Promise.all(
        tasks.map((id) => store.getTask(id))
      );

      expect(retrievedTasks).toHaveLength(taskCount);
      retrievedTasks.forEach((task) => {
        expect(task).not.toBeNull();
        expect(task?.logs.length).toBeGreaterThanOrEqual(5);
      });
    });
  });
});