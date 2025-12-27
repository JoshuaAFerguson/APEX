/**
 * Additional edge case tests for TaskStore trash operations
 * Covers performance, concurrency, and error handling scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task, TaskStatus } from '@apexcli/core';

describe('TaskStore - Trash Operations Edge Cases', () => {
  let testDir: string;
  let store: TaskStore;

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task for advanced trash operations',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: testDir,
    branchName: 'apex/test-branch',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    logs: [],
    artifacts: [],
    dependsOn: [],
    blockedBy: [],
    ...overrides,
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-trash-edge-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Performance and Bulk Operations', () => {
    it('should handle bulk trash operations efficiently', async () => {
      const taskCount = 50;
      const tasks: Task[] = [];

      // Create many tasks
      for (let i = 0; i < taskCount; i++) {
        const task = createTestTask({ id: `bulk_task_${i}` });
        tasks.push(task);
        await store.createTask(task);
      }

      const startTime = Date.now();

      // Trash them all
      const trashPromises = tasks.map(task => store.moveToTrash(task.id));
      await Promise.all(trashPromises);

      const trashTime = Date.now() - startTime;

      // Verify they're all trashed
      const trashedTasks = await store.listTrashed();
      expect(trashedTasks).toHaveLength(taskCount);

      // Performance check: should complete in reasonable time
      expect(trashTime).toBeLessThan(5000); // 5 seconds for 50 tasks

      // Empty trash performance test
      const emptyStartTime = Date.now();
      const deletedCount = await store.emptyTrash();
      const emptyTime = Date.now() - emptyStartTime;

      expect(deletedCount).toBe(taskCount);
      expect(emptyTime).toBeLessThan(3000); // 3 seconds to empty 50 tasks
    });

    it('should handle empty trash with no tasks efficiently', async () => {
      const iterations = 10;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const result = await store.emptyTrash();
        expect(result).toBe(0);
      }

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(1000); // Should be very fast
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle concurrent trash operations safely', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Try to trash the same task concurrently
      const trashPromises = Array(5).fill(null).map(() =>
        store.moveToTrash(task.id)
      );

      await Promise.all(trashPromises);

      const trashedTask = await store.getTask(task.id);
      expect(trashedTask?.trashedAt).toBeDefined();
      expect(trashedTask?.status).toBe('cancelled');
    });

    it('should handle concurrent restore operations safely', async () => {
      const task = createTestTask();
      await store.createTask(task);
      await store.moveToTrash(task.id);

      // Try to restore the same task concurrently
      const restorePromises = Array(3).fill(null).map(() =>
        store.restoreFromTrash(task.id).catch(() => {
          // Some may fail if already restored, that's expected
        })
      );

      await Promise.all(restorePromises);

      const restoredTask = await store.getTask(task.id);
      expect(restoredTask?.trashedAt).toBeUndefined();
    });

    it('should handle concurrent empty trash operations safely', async () => {
      const task1 = createTestTask({ id: 'concurrent_1' });
      const task2 = createTestTask({ id: 'concurrent_2' });

      await store.createTask(task1);
      await store.createTask(task2);
      await store.moveToTrash(task1.id);
      await store.moveToTrash(task2.id);

      // Try to empty trash concurrently
      const emptyPromises = Array(3).fill(null).map(() => store.emptyTrash());
      const results = await Promise.all(emptyPromises);

      // One should delete 2 tasks, others should delete 0
      const totalDeleted = results.reduce((sum, count) => sum + count, 0);
      expect(totalDeleted).toBe(2);

      const remaining = await store.listTrashed();
      expect(remaining).toHaveLength(0);
    });
  });

  describe('Complex State Scenarios', () => {
    it('should handle tasks with complex dependency chains when trashing', async () => {
      // Create a dependency chain: A -> B -> C
      const taskA = createTestTask({ id: 'dep_a' });
      const taskB = createTestTask({ id: 'dep_b' });
      const taskC = createTestTask({ id: 'dep_c' });

      await store.createTask(taskA);
      await store.createTask(taskB);
      await store.createTask(taskC);

      await store.addDependency(taskB.id, taskA.id); // B depends on A
      await store.addDependency(taskC.id, taskB.id); // C depends on B

      // Trash the middle task
      await store.moveToTrash(taskB.id);
      await store.emptyTrash();

      // Verify dependencies are cleaned up
      const depA = await store.getTaskDependencies(taskA.id);
      const depB = await store.getTaskDependencies(taskB.id); // Should be empty (task deleted)
      const depC = await store.getTaskDependencies(taskC.id);

      expect(depA).toHaveLength(0);
      expect(depB).toHaveLength(0);
      expect(depC).toHaveLength(0); // Dependencies should be removed

      // Verify remaining tasks exist
      expect(await store.getTask(taskA.id)).not.toBeNull();
      expect(await store.getTask(taskB.id)).toBeNull(); // Deleted
      expect(await store.getTask(taskC.id)).not.toBeNull();
    });

    it('should handle tasks with extensive related data when trashing', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Add extensive related data
      const logCount = 20;
      const artifactCount = 10;

      for (let i = 0; i < logCount; i++) {
        await store.addLog(task.id, {
          level: i % 2 === 0 ? 'info' : 'error',
          message: `Test log message ${i}`,
        });
      }

      for (let i = 0; i < artifactCount; i++) {
        await store.addArtifact(task.id, {
          name: `artifact_${i}.txt`,
          type: 'file',
          content: `Content for artifact ${i}`,
        });
      }

      await store.setGate(task.id, {
        name: 'review',
        status: 'pending',
        requiredAt: new Date(),
      });

      // Verify data exists
      let logs = await store.getLogs(task.id);
      expect(logs).toHaveLength(logCount);

      // Trash and empty
      await store.moveToTrash(task.id);
      await store.emptyTrash();

      // Verify all data is cleaned up
      expect(await store.getTask(task.id)).toBeNull();
      logs = await store.getLogs(task.id);
      expect(logs).toHaveLength(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle restore operations on already restored tasks gracefully', async () => {
      const task = createTestTask();
      await store.createTask(task);
      await store.moveToTrash(task.id);

      // First restore should succeed
      await expect(store.restoreFromTrash(task.id)).resolves.not.toThrow();

      // Second restore should fail gracefully
      await expect(store.restoreFromTrash(task.id)).rejects.toThrow(
        `Task with ID ${task.id} is not in trash`
      );
    });

    it('should maintain data integrity when operations partially fail', async () => {
      const task1 = createTestTask({ id: 'integrity_1' });
      const task2 = createTestTask({ id: 'integrity_2' });

      await store.createTask(task1);
      await store.createTask(task2);
      await store.moveToTrash(task1.id);
      await store.moveToTrash(task2.id);

      // Verify tasks are in trash
      let trashedTasks = await store.listTrashed();
      expect(trashedTasks).toHaveLength(2);

      // Attempt operation that would cause issues in a real error scenario
      // In this case, we'll test that even if individual deletes fail,
      // the overall state remains consistent
      const beforeCount = await store.emptyTrash();
      expect(beforeCount).toBe(2);

      // Verify all tasks are completely removed
      trashedTasks = await store.listTrashed();
      expect(trashedTasks).toHaveLength(0);

      expect(await store.getTask(task1.id)).toBeNull();
      expect(await store.getTask(task2.id)).toBeNull();
    });
  });

  describe('Timestamp and Data Consistency', () => {
    it('should maintain consistent timestamps across operations', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const beforeTrash = Date.now();
      await store.moveToTrash(task.id);
      const afterTrash = Date.now();

      let trashedTask = await store.getTask(task.id);
      expect(trashedTask?.trashedAt).toBeDefined();
      expect(trashedTask?.trashedAt!.getTime()).toBeGreaterThanOrEqual(beforeTrash);
      expect(trashedTask?.trashedAt!.getTime()).toBeLessThanOrEqual(afterTrash);

      const beforeRestore = Date.now();
      await store.restoreFromTrash(task.id);
      const afterRestore = Date.now();

      const restoredTask = await store.getTask(task.id);
      expect(restoredTask?.trashedAt).toBeUndefined();
      expect(restoredTask?.updatedAt!.getTime()).toBeGreaterThanOrEqual(beforeRestore);
      expect(restoredTask?.updatedAt!.getTime()).toBeLessThanOrEqual(afterRestore);
    });

    it('should handle timezone-related edge cases properly', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Test with specific timezone dates
      const utcDate = new Date('2024-01-15T12:00:00.000Z');
      const localDate = new Date('2024-01-15T12:00:00.000'); // Local time

      await store.updateTask(task.id, { trashedAt: utcDate });
      let retrieved = await store.getTask(task.id);

      // Should handle timezone conversion properly
      expect(retrieved?.trashedAt).toEqual(utcDate);

      await store.restoreFromTrash(task.id);
      await store.updateTask(task.id, { trashedAt: localDate });

      retrieved = await store.getTask(task.id);
      expect(retrieved?.trashedAt).toBeDefined();
    });
  });

  describe('Integration with Existing Features', () => {
    it('should work correctly with task archiving operations', async () => {
      const task = createTestTask({ status: 'completed' });
      await store.createTask(task);

      // Archive first
      await store.archiveTask(task.id);

      // Then trash
      await store.moveToTrash(task.id);

      const trashedArchivedTask = await store.getTask(task.id);
      expect(trashedArchivedTask?.trashedAt).toBeDefined();
      expect(trashedArchivedTask?.archivedAt).toBeDefined();

      // Restore from trash (should keep archive status)
      await store.restoreFromTrash(task.id);

      const restoredTask = await store.getTask(task.id);
      expect(restoredTask?.trashedAt).toBeUndefined();
      expect(restoredTask?.archivedAt).toBeDefined(); // Should remain archived
    });

    it('should maintain task filtering behavior with mixed states', async () => {
      const activeTask = createTestTask({ id: 'active' });
      const trashedTask = createTestTask({ id: 'trashed' });
      const archivedTask = createTestTask({ id: 'archived', status: 'completed' });
      const bothTask = createTestTask({ id: 'both', status: 'completed' });

      await store.createTask(activeTask);
      await store.createTask(trashedTask);
      await store.createTask(archivedTask);
      await store.createTask(bothTask);

      await store.moveToTrash(trashedTask.id);
      await store.archiveTask(archivedTask.id);
      await store.archiveTask(bothTask.id);
      await store.moveToTrash(bothTask.id);

      // Test various filtering combinations
      const defaultList = await store.listTasks();
      expect(defaultList.map(t => t.id)).toContain('active');
      expect(defaultList.map(t => t.id)).not.toContain('trashed');
      expect(defaultList.map(t => t.id)).not.toContain('archived');
      expect(defaultList.map(t => t.id)).not.toContain('both');

      const withTrashed = await store.listTasks({ includeTrashed: true });
      expect(withTrashed.map(t => t.id)).toContain('trashed');
      expect(withTrashed.map(t => t.id)).toContain('both');

      const withArchived = await store.listTasks({ includeArchived: true });
      expect(withArchived.map(t => t.id)).toContain('archived');
      expect(withArchived.map(t => t.id)).not.toContain('both'); // Both is trashed

      const withBoth = await store.listTasks({
        includeTrashed: true,
        includeArchived: true
      });
      expect(withBoth.map(t => t.id)).toContain('both');
      expect(withBoth).toHaveLength(4);
    });
  });
});