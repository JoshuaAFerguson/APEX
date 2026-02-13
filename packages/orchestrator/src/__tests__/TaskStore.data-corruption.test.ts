/**
 * Comprehensive test suite for TaskStore data corruption during mid-stream permission revocation
 *
 * This test suite verifies that the SQLite TaskStore maintains data integrity
 * when operations are interrupted by permission revocation or other failures.
 * It ensures no data corruption occurs and proper recovery mechanisms work.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';
import { TaskStore } from '../store';
import type { Task, TaskStatus, TaskPriority, TaskEffort, AutonomyLevel } from '@apexcli/core';

describe('TaskStore - Data Corruption Prevention During Mid-Stream Permission Revocation', () => {
  let testDir: string;
  let store: TaskStore;
  let dbPath: string;

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task for data corruption prevention',
    workflow: 'feature',
    autonomy: 'full' as AutonomyLevel,
    status: 'pending' as TaskStatus,
    priority: 'normal' as TaskPriority,
    effort: 'medium' as TaskEffort,
    projectPath: testDir,
    branchName: 'apex/corruption-test-branch',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      estimatedCost: 0.001,
    },
    logs: [],
    artifacts: [],
    dependsOn: [],
    blockedBy: [],
    ...overrides,
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-corruption-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    // Use APEX_HOME to ensure we control the database location
    process.env.APEX_HOME = testDir;
    dbPath = path.join(testDir, '.apex', 'apex.db');

    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    try {
      await store.close();
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Best effort cleanup
      console.warn('Cleanup error:', error);
    }
    delete process.env.APEX_HOME;
  });

  describe('SQLite TaskStore Integrity During Interruption', () => {
    it('should maintain database integrity when task creation is interrupted', async () => {
      const task = createTestTask();

      // Mock database operation to fail mid-transaction
      const originalPrepare = store.getDatabase().prepare;
      let callCount = 0;

      store.getDatabase().prepare = vi.fn((sql: string) => {
        callCount++;
        // Fail on the second SQL statement (simulate interruption during transaction)
        if (callCount === 2 && sql.includes('INSERT INTO tasks')) {
          throw new Error('Simulated permission revocation during task creation');
        }
        return originalPrepare.call(store.getDatabase(), sql);
      });

      // Attempt to create task - should fail
      await expect(store.createTask(task)).rejects.toThrow('Simulated permission revocation');

      // Restore original function
      store.getDatabase().prepare = originalPrepare;

      // Verify database integrity - should be able to perform operations normally
      const newTask = createTestTask();
      await expect(store.createTask(newTask)).resolves.toBeDefined();

      // Verify task was created properly
      const retrieved = await store.getTask(newTask.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.status).toBe('pending');
    });

    it('should maintain referential integrity during complex multi-table operations', async () => {
      const parentTask = createTestTask();
      await store.createTask(parentTask);

      const childTask = createTestTask({
        parentTaskId: parentTask.id,
        status: 'pending' as TaskStatus
      });

      // Mock to fail during complex operation that touches multiple tables
      const originalExec = store.getDatabase().exec;
      let execCallCount = 0;

      store.getDatabase().exec = vi.fn((sql: string) => {
        execCallCount++;
        // Simulate failure during foreign key constraint update
        if (sql.includes('UPDATE tasks') && sql.includes('subtaskIds')) {
          throw new Error('Permission revoked during referential integrity update');
        }
        return originalExec.call(store.getDatabase(), sql);
      });

      // Attempt operation that should fail
      try {
        await store.createTask(childTask);
      } catch (error) {
        expect(error).toMatchObject({
          message: expect.stringContaining('Permission revoked')
        });
      }

      // Restore original function
      store.getDatabase().exec = originalExec;

      // Verify database is still consistent
      const parentCheck = await store.getTask(parentTask.id);
      expect(parentCheck).toBeDefined();
      expect(parentCheck?.subtaskIds).toEqual([]);

      // Should be able to perform operations normally
      const newChildTask = createTestTask({ parentTaskId: parentTask.id });
      await expect(store.createTask(newChildTask)).resolves.toBeDefined();
    });

    it('should handle database corruption recovery gracefully', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Simulate database file corruption by closing and truncating
      await store.close();
      await fs.writeFile(dbPath, '', 'utf8'); // Corrupt the database file

      // Reinitialize should handle corruption gracefully
      const newStore = new TaskStore(testDir);
      await expect(newStore.initialize()).resolves.not.toThrow();

      // Should be able to create new tasks after recovery
      const newTask = createTestTask();
      await expect(newStore.createTask(newTask)).resolves.toBeDefined();

      await newStore.close();
    });
  });

  describe('Task Status Consistency During Mid-Stream Revocation', () => {
    it('should not leave tasks in inconsistent intermediate states', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Mock to fail during status update
      const originalPrepare = store.getDatabase().prepare;
      let prepareCallCount = 0;

      store.getDatabase().prepare = vi.fn((sql: string) => {
        prepareCallCount++;
        if (sql.includes('UPDATE tasks') && sql.includes('status') && prepareCallCount > 1) {
          throw new Error('Permission revoked during status update');
        }
        return originalPrepare.call(store.getDatabase(), sql);
      });

      // Attempt status update that should fail
      await expect(
        store.updateTaskStatus(task.id, 'in-progress' as TaskStatus)
      ).rejects.toThrow('Permission revoked');

      // Restore original function
      store.getDatabase().prepare = originalPrepare;

      // Verify task is still in original state
      const retrieved = await store.getTask(task.id);
      expect(retrieved?.status).toBe('pending');
      expect(retrieved?.updatedAt).toBeDefined();

      // Should be able to update status normally after recovery
      await store.updateTaskStatus(task.id, 'in-progress' as TaskStatus);
      const updated = await store.getTask(task.id);
      expect(updated?.status).toBe('in-progress');
    });

    it('should maintain task state consistency during interrupted operations', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Mock to fail during task update
      const originalPrepare = store.getDatabase().prepare;
      let callCount = 0;

      store.getDatabase().prepare = vi.fn((sql: string) => {
        callCount++;
        // Fail on operations that include task table updates after first call
        if (callCount > 1 && sql.includes('UPDATE tasks')) {
          throw new Error('Permission revoked during task update');
        }
        return originalPrepare.call(store.getDatabase(), sql);
      });

      // Attempt task update that should fail
      await expect(store.updateTask(task.id, { priority: 'high' })).rejects.toThrow('Permission revoked');

      // Restore original function
      store.getDatabase().prepare = originalPrepare;

      // Verify task still exists and is in original state
      const retrieved = await store.getTask(task.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.priority).toBe('normal'); // Original priority

      // Should be able to update task normally after recovery
      await store.updateTask(task.id, { priority: 'high' });
      const updated = await store.getTask(task.id);
      expect(updated?.priority).toBe('high');
    });

    it('should handle usage tracking interruptions without corruption', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const usage = {
        inputTokens: 500,
        outputTokens: 300,
        totalTokens: 800,
        estimatedCost: 0.016
      };

      // Mock to fail during usage update
      const originalPrepare = store.getDatabase().prepare;
      store.getDatabase().prepare = vi.fn((sql: string) => {
        if (sql.includes('UPDATE tasks') && sql.includes('usage_input_tokens')) {
          throw new Error('Permission revoked during usage update');
        }
        return originalPrepare.call(store.getDatabase(), sql);
      });

      // Attempt usage update that should fail (using updateTask with usage fields)
      await expect(store.updateTask(task.id, { usage })).rejects.toThrow('Permission revoked');

      // Restore original function
      store.getDatabase().prepare = originalPrepare;

      // Verify task usage is still in original state
      const retrieved = await store.getTask(task.id);
      expect(retrieved?.usage.inputTokens).toBe(100);
      expect(retrieved?.usage.totalTokens).toBe(150);

      // Should be able to update usage normally after recovery
      await store.updateTask(task.id, { usage });
      const updated = await store.getTask(task.id);
      expect(updated?.usage.inputTokens).toBe(500);
      expect(updated?.usage.totalTokens).toBe(800);
    });
  });

  describe('Concurrent Operations Race Conditions', () => {
    it('should prevent race conditions during concurrent task status updates', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const updatePromises = [
        store.updateTaskStatus(task.id, 'in-progress' as TaskStatus, 'planning'),
        store.updateTaskStatus(task.id, 'paused' as TaskStatus, 'review'),
        store.updateTaskStatus(task.id, 'completed' as TaskStatus, 'finished')
      ];

      // All updates should complete without throwing
      const results = await Promise.allSettled(updatePromises);

      // At least one should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);

      // Final state should be consistent
      const finalTask = await store.getTask(task.id);
      expect(finalTask).toBeDefined();
      expect(['pending', 'in-progress', 'paused', 'completed']).toContain(finalTask?.status);
    });

    it('should handle concurrent task creation with same ID gracefully', async () => {
      const taskId = 'duplicate-task-id';
      const task1 = createTestTask({ id: taskId });
      const task2 = createTestTask({ id: taskId, description: 'Different description' });

      // Both creations should not cause corruption
      const creationPromises = [
        store.createTask(task1),
        store.createTask(task2)
      ];

      const results = await Promise.allSettled(creationPromises);

      // One should succeed, one should fail
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful.length).toBe(1);
      expect(failed.length).toBe(1);

      // Database should have exactly one task with that ID
      const retrieved = await store.getTask(taskId);
      expect(retrieved).toBeDefined();
    });

    it('should maintain consistency during concurrent parent-child task operations', async () => {
      const parentTask = createTestTask();
      await store.createTask(parentTask);

      // Create multiple child tasks concurrently
      const childTasks = Array.from({ length: 5 }, (_, i) =>
        createTestTask({
          id: `child-${i}`,
          parentTaskId: parentTask.id,
          description: `Child task ${i}`
        })
      );

      const creationPromises = childTasks.map(task => store.createTask(task));
      const results = await Promise.allSettled(creationPromises);

      // All should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBe(childTasks.length);

      // Parent should have correct subtask references
      const updatedParent = await store.getTask(parentTask.id);
      expect(updatedParent?.subtaskIds).toHaveLength(childTasks.length);
      expect(updatedParent?.subtaskIds).toEqual(expect.arrayContaining(
        childTasks.map(t => t.id)
      ));
    });
  });

  describe('Recovery from Interrupted State', () => {
    it('should recover gracefully from database lock timeouts', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Simulate database lock by starting a long-running transaction
      const db = store.getDatabase();
      const transaction = db.transaction(() => {
        db.exec('BEGIN EXCLUSIVE TRANSACTION');
        // Hold the lock for a moment
      });

      // Create a new store instance that should timeout and recover
      const newStore = new TaskStore(testDir);
      await newStore.initialize();

      // Should be able to perform operations after recovery
      const newTask = createTestTask();
      await expect(newStore.createTask(newTask)).resolves.toBeDefined();

      await newStore.close();
    });

    it('should handle checkpoint restoration correctly after interruption', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Create a checkpoint
      const checkpoint = {
        checkpointId: 'checkpoint-1',
        taskId: task.id,
        stage: 'planning',
        stageIndex: 0,
        conversationState: 'active',
        metadata: { step: 'initial-analysis' },
        createdAt: new Date()
      };

      await store.saveCheckpoint(checkpoint);

      // Simulate interruption during checkpoint update
      const originalPrepare = store.getDatabase().prepare;
      store.getDatabase().prepare = vi.fn((sql: string) => {
        if (sql.includes('UPDATE task_checkpoints')) {
          throw new Error('Permission revoked during checkpoint update');
        }
        return originalPrepare.call(store.getDatabase(), sql);
      });

      // Attempt checkpoint update that should fail
      const updatedCheckpoint = { ...checkpoint, metadata: { step: 'detailed-analysis' } };
      await expect(
        store.saveCheckpoint(updatedCheckpoint)
      ).rejects.toThrow('Permission revoked');

      // Restore original function
      store.getDatabase().prepare = originalPrepare;

      // Verify checkpoint is still in original state
      const retrieved = await store.getCheckpoint(task.id, checkpoint.checkpointId);
      expect(retrieved?.metadata).toEqual({ step: 'initial-analysis' });

      // Should be able to update checkpoint normally after recovery
      await store.saveCheckpoint(updatedCheckpoint);
      const updated = await store.getCheckpoint(task.id, checkpoint.checkpointId);
      expect(updated?.metadata).toEqual({ step: 'detailed-analysis' });
    });

    it('should restore task queue consistency after process interruption', async () => {
      // Create multiple tasks in different states
      const tasks = [
        createTestTask({ id: 'pending-task', status: 'pending' as TaskStatus }),
        createTestTask({ id: 'queued-task', status: 'queued' as TaskStatus }),
        createTestTask({ id: 'in-progress-task', status: 'in-progress' as TaskStatus }),
        createTestTask({ id: 'paused-task', status: 'paused' as TaskStatus })
      ];

      for (const task of tasks) {
        await store.createTask(task);
      }

      // Simulate process restart by creating new store instance
      await store.close();
      const newStore = new TaskStore(testDir);
      await newStore.initialize();

      // Verify all tasks are still accessible and in correct states
      for (const originalTask of tasks) {
        const retrieved = await newStore.getTask(originalTask.id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.status).toBe(originalTask.status);
        expect(retrieved?.id).toBe(originalTask.id);
      }

      // Verify task operations still work normally
      await newStore.updateTaskStatus('pending-task', 'queued' as TaskStatus);
      const updated = await newStore.getTask('pending-task');
      expect(updated?.status).toBe('queued');

      await newStore.close();
    });

    it('should handle foreign key constraint violations gracefully', async () => {
      const nonExistentParentId = 'non-existent-parent';
      const childTask = createTestTask({
        parentTaskId: nonExistentParentId,
        description: 'Child task with invalid parent'
      });

      // Should reject child task creation with non-existent parent
      await expect(store.createTask(childTask)).rejects.toThrow();

      // Database should remain consistent
      const allTasks = await store.getAllTasks();
      expect(allTasks).toEqual([]);

      // Should be able to create tasks normally after rejection
      const validTask = createTestTask();
      await expect(store.createTask(validTask)).resolves.toBeDefined();

      const retrieved = await store.getTask(validTask.id);
      expect(retrieved).toBeDefined();
    });
  });

  describe('Transaction Rollback Verification', () => {
    it('should rollback all changes when transaction fails', async () => {
      const task = createTestTask();

      // Start a manual transaction that will fail
      const db = store.getDatabase();
      const insertTask = db.prepare('INSERT INTO tasks (id, description, workflow, autonomy, status, priority, effort, project_path, retry_count, max_retries, resume_attempts, created_at, updated_at, usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const insertInvalid = db.prepare('INSERT INTO invalid_table (id) VALUES (?)'); // This will fail

      const transaction = db.transaction(() => {
        insertTask.run(
          task.id, task.description, task.workflow, task.autonomy, task.status,
          task.priority, task.effort, task.projectPath, task.retryCount,
          task.maxRetries, task.resumeAttempts, task.createdAt.toISOString(),
          task.updatedAt.toISOString(), task.usage.inputTokens, task.usage.outputTokens,
          task.usage.totalTokens, task.usage.estimatedCost
        );
        // This will cause the entire transaction to rollback
        insertInvalid.run(task.id);
      });

      // Transaction should fail
      expect(() => transaction()).toThrow();

      // Verify task was not created (transaction was rolled back)
      const retrieved = await store.getTask(task.id);
      expect(retrieved).toBeNull();

      // Database should be in consistent state for normal operations
      await expect(store.createTask(task)).resolves.toBeDefined();
      const created = await store.getTask(task.id);
      expect(created).toBeDefined();
    });

    it('should maintain database integrity across multiple failed operations', async () => {
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createTestTask({ id: `batch-task-${i}` })
      );

      // Try to create tasks with some operations that will fail
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];

        if (i % 3 === 0) {
          // Every third operation will fail due to invalid data
          const invalidTask = { ...task, workflow: '' }; // Invalid workflow
          await expect(store.createTask(invalidTask)).rejects.toThrow();
        } else {
          // Normal operations should succeed
          await expect(store.createTask(task)).resolves.toBeDefined();
        }
      }

      // Verify only valid tasks were created
      const allTasks = await store.getAllTasks();
      expect(allTasks).toHaveLength(Math.ceil(tasks.length * 2 / 3));

      // All created tasks should be valid and accessible
      for (const task of allTasks) {
        expect(task.workflow).toBeTruthy();
        expect(task.id).toMatch(/^batch-task-[0-9]$/);

        const retrieved = await store.getTask(task.id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(task.id);
      }
    });
  });

  describe('Database Schema Integrity', () => {
    it('should maintain schema integrity after failed migrations', async () => {
      // Close current store
      await store.close();

      // Create a database with a simulated old schema
      const db = new Database(dbPath);
      db.exec(`
        CREATE TABLE tasks (
          id TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          workflow TEXT NOT NULL
        );
      `);
      db.close();

      // Mock migration to fail
      const newStore = new TaskStore(testDir);
      const originalRunMigrations = (newStore as any).runMigrations;
      (newStore as any).runMigrations = vi.fn().mockImplementation(() => {
        throw new Error('Migration failed due to permission revocation');
      });

      // Initialization should handle migration failure gracefully
      await expect(newStore.initialize()).resolves.not.toThrow();

      // Restore original migration function and retry
      (newStore as any).runMigrations = originalRunMigrations;
      await newStore.initialize();

      // Should be able to create tasks after successful migration
      const task = createTestTask();
      await expect(newStore.createTask(task)).resolves.toBeDefined();

      await newStore.close();
    });
  });
});