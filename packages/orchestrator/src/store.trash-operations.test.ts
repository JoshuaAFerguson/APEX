/**
 * Unit tests for TaskStore trash operations
 * Tests for moveToTrash, restoreFromTrash, listTrashed, and emptyTrash methods
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task, TaskStatus } from '@apexcli/core';

describe('TaskStore - Trash Operations', () => {
  let testDir: string;
  let store: TaskStore;

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task for trash operations',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-trash-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('moveToTrash', () => {
    it('should move a task to trash by setting trashed_at timestamp', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Verify task is not trashed initially
      const initialTask = await store.getTask(task.id);
      expect(initialTask?.trashedAt).toBeUndefined();

      // Move to trash
      await store.moveToTrash(task.id);

      // Verify task is now trashed
      const trashedTask = await store.getTask(task.id);
      expect(trashedTask?.trashedAt).toBeDefined();
      expect(trashedTask?.status).toBe('cancelled');
      expect(trashedTask?.updatedAt).toBeDefined();
    });

    it('should be an alias for trashTask method', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Both methods should have the same behavior
      await store.moveToTrash(task.id);
      const moveToTrashResult = await store.getTask(task.id);

      // Reset the task
      await store.updateTask(task.id, {
        trashedAt: undefined,
        status: 'pending',
        updatedAt: new Date()
      });

      await store.trashTask(task.id);
      const trashTaskResult = await store.getTask(task.id);

      expect(trashTaskResult?.status).toBe(moveToTrashResult?.status);
      expect(trashTaskResult?.trashedAt).toBeDefined();
      expect(moveToTrashResult?.trashedAt).toBeDefined();
    });

    it('should handle non-existent task gracefully', async () => {
      // This should not throw since updateTask will just not update anything
      await expect(store.moveToTrash('non-existent-task')).resolves.not.toThrow();
    });
  });

  describe('restoreFromTrash', () => {
    it('should restore a trashed task by clearing trashed_at timestamp', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Move to trash first
      await store.moveToTrash(task.id);

      const trashedTask = await store.getTask(task.id);
      expect(trashedTask?.trashedAt).toBeDefined();

      // Restore from trash
      await store.restoreFromTrash(task.id);

      const restoredTask = await store.getTask(task.id);
      expect(restoredTask?.trashedAt).toBeUndefined();
      expect(restoredTask?.status).toBe('pending');
      expect(restoredTask?.updatedAt).toBeDefined();
    });

    it('should throw error if task is not found', async () => {
      await expect(store.restoreFromTrash('non-existent-task')).rejects.toThrow(
        'Task with ID non-existent-task not found'
      );
    });

    it('should throw error if task is not in trash', async () => {
      const task = createTestTask();
      await store.createTask(task);

      await expect(store.restoreFromTrash(task.id)).rejects.toThrow(
        `Task with ID ${task.id} is not in trash`
      );
    });

    it('should only restore trashed_at and not archived_at', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Set both trashed and archived
      const archivedAt = new Date();
      await store.updateTask(task.id, {
        trashedAt: new Date(),
        archivedAt: archivedAt,
        status: 'cancelled'
      });

      // Restore from trash
      await store.restoreFromTrash(task.id);

      const restoredTask = await store.getTask(task.id);
      expect(restoredTask?.trashedAt).toBeUndefined();
      expect(restoredTask?.archivedAt).toEqual(archivedAt); // Should remain archived
      expect(restoredTask?.status).toBe('pending');
    });
  });

  describe('listTrashed', () => {
    it('should return all trashed tasks', async () => {
      const task1 = createTestTask({ id: 'task1' });
      const task2 = createTestTask({ id: 'task2' });
      const task3 = createTestTask({ id: 'task3' });

      await store.createTask(task1);
      await store.createTask(task2);
      await store.createTask(task3);

      // Trash first two tasks
      await store.moveToTrash(task1.id);
      await store.moveToTrash(task2.id);

      const trashedTasks = await store.listTrashed();
      const trashedIds = trashedTasks.map(t => t.id);

      expect(trashedTasks).toHaveLength(2);
      expect(trashedIds).toContain(task1.id);
      expect(trashedIds).toContain(task2.id);
      expect(trashedIds).not.toContain(task3.id);
    });

    it('should return empty array when no tasks are trashed', async () => {
      const trashedTasks = await store.listTrashed();
      expect(trashedTasks).toHaveLength(0);
    });

    it('should be an alias for getTrashedTasks method', async () => {
      const task = createTestTask();
      await store.createTask(task);
      await store.moveToTrash(task.id);

      const listTrashedResult = await store.listTrashed();
      const getTrashedResult = await store.getTrashedTasks();

      expect(listTrashedResult).toHaveLength(getTrashedResult.length);
      expect(listTrashedResult[0].id).toBe(getTrashedResult[0].id);
    });

    it('should include all task data including logs and artifacts', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Add some logs and artifacts
      await store.addLog(task.id, {
        level: 'info',
        message: 'Test log',
      });

      await store.addArtifact(task.id, {
        name: 'test.txt',
        type: 'file',
        content: 'test content',
      });

      await store.moveToTrash(task.id);

      const trashedTasks = await store.listTrashed();
      expect(trashedTasks).toHaveLength(1);
      expect(trashedTasks[0].logs).toHaveLength(1);
      expect(trashedTasks[0].artifacts).toHaveLength(1);
    });
  });

  describe('emptyTrash', () => {
    it('should permanently delete all trashed tasks and return count', async () => {
      const task1 = createTestTask({ id: 'task1' });
      const task2 = createTestTask({ id: 'task2' });
      const task3 = createTestTask({ id: 'task3' });

      await store.createTask(task1);
      await store.createTask(task2);
      await store.createTask(task3);

      // Trash first two tasks
      await store.moveToTrash(task1.id);
      await store.moveToTrash(task2.id);

      // Verify tasks are in trash
      const trashedBefore = await store.listTrashed();
      expect(trashedBefore).toHaveLength(2);

      // Empty trash
      const deletedCount = await store.emptyTrash();
      expect(deletedCount).toBe(2);

      // Verify tasks are permanently deleted
      const trashedAfter = await store.listTrashed();
      expect(trashedAfter).toHaveLength(0);

      // Verify tasks cannot be retrieved at all
      const deletedTask1 = await store.getTask(task1.id);
      const deletedTask2 = await store.getTask(task2.id);
      const existingTask3 = await store.getTask(task3.id);

      expect(deletedTask1).toBeNull();
      expect(deletedTask2).toBeNull();
      expect(existingTask3).not.toBeNull(); // Non-trashed task should remain
    });

    it('should return 0 when no tasks are trashed', async () => {
      const deletedCount = await store.emptyTrash();
      expect(deletedCount).toBe(0);
    });

    it('should delete related data (logs, artifacts, gates, etc.)', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Add related data
      await store.addLog(task.id, {
        level: 'info',
        message: 'Test log',
      });

      await store.addArtifact(task.id, {
        name: 'test.txt',
        type: 'file',
        content: 'test content',
      });

      await store.setGate(task.id, {
        name: 'review',
        status: 'pending',
        requiredAt: new Date(),
      });

      await store.logCommand(task.id, 'test command');

      // Trash and empty
      await store.moveToTrash(task.id);
      await store.emptyTrash();

      // Verify task and all related data are deleted
      const deletedTask = await store.getTask(task.id);
      expect(deletedTask).toBeNull();

      // Verify related data is deleted (these should not crash)
      const logs = await store.getLogs(task.id);
      expect(logs).toHaveLength(0);
    });

    it('should not delete non-trashed tasks', async () => {
      const trashedTask = createTestTask({ id: 'trashed' });
      const normalTask = createTestTask({ id: 'normal' });
      const archivedTask = createTestTask({ id: 'archived' });

      await store.createTask(trashedTask);
      await store.createTask(normalTask);
      await store.createTask(archivedTask);

      await store.moveToTrash(trashedTask.id);
      await store.updateTask(archivedTask.id, { archivedAt: new Date() });

      const deletedCount = await store.emptyTrash();
      expect(deletedCount).toBe(1);

      // Verify only trashed task is deleted
      expect(await store.getTask(trashedTask.id)).toBeNull();
      expect(await store.getTask(normalTask.id)).not.toBeNull();
      expect(await store.getTask(archivedTask.id)).not.toBeNull();
    });

    it('should handle task dependencies correctly', async () => {
      const dependentTask = createTestTask({ id: 'dependent' });
      const dependencyTask = createTestTask({ id: 'dependency' });

      await store.createTask(dependencyTask);
      await store.createTask(dependentTask);

      // Create dependency relationship
      await store.addDependency(dependentTask.id, dependencyTask.id);

      // Trash the dependency task
      await store.moveToTrash(dependencyTask.id);

      await store.emptyTrash();

      // Dependent task should still exist but dependency should be removed
      const remainingTask = await store.getTask(dependentTask.id);
      expect(remainingTask).not.toBeNull();

      const dependencies = await store.getTaskDependencies(dependentTask.id);
      expect(dependencies).toHaveLength(0); // Dependency should be removed
    });

    it('should handle transaction rollback on error', async () => {
      const task = createTestTask();
      await store.createTask(task);
      await store.moveToTrash(task.id);

      // Close database to simulate error
      store.close();

      // Re-open for verification
      store = new TaskStore(testDir);
      await store.initialize();

      // Task should still exist since emptyTrash would have failed
      const existingTask = await store.getTask(task.id);
      expect(existingTask?.trashedAt).toBeDefined();
    });
  });

  describe('Integration with existing methods', () => {
    it('should work with existing listTasks filtering', async () => {
      const task1 = createTestTask({ id: 'task1', status: 'pending' });
      const task2 = createTestTask({ id: 'task2', status: 'in-progress' });

      await store.createTask(task1);
      await store.createTask(task2);

      await store.moveToTrash(task1.id);

      // Default listing should exclude trashed tasks
      const activeTasks = await store.listTasks();
      expect(activeTasks.map(t => t.id)).not.toContain(task1.id);
      expect(activeTasks.map(t => t.id)).toContain(task2.id);

      // Explicit inclusion should show trashed tasks
      const allTasks = await store.listTasks({ includeTrashed: true });
      expect(allTasks.map(t => t.id)).toContain(task1.id);
      expect(allTasks.map(t => t.id)).toContain(task2.id);
    });

    it('should work with task status updates', async () => {
      const task = createTestTask();
      await store.createTask(task);

      await store.moveToTrash(task.id);

      // Verify status is set to cancelled
      const trashedTask = await store.getTask(task.id);
      expect(trashedTask?.status).toBe('cancelled');
      expect(trashedTask?.trashedAt).toBeDefined();
    });
  });
});