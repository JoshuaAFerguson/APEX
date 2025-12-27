/**
 * Additional comprehensive tests for TaskLifecycleStatus functionality
 * Testing edge cases and advanced scenarios for trash/archive operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task, TaskStatus } from '@apexcli/core';

describe('TaskStore - Enhanced Lifecycle Management Tests', () => {
  let testDir: string;
  let store: TaskStore;

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task for lifecycle management',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-lifecycle-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Database Schema Validation', () => {
    it('should have trashed_at and archived_at columns in database schema', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Test that the columns exist by trying to update them
      const trashedAt = new Date('2024-01-15T10:30:00.000Z');
      const archivedAt = new Date('2024-01-20T15:45:00.000Z');

      await expect(
        store.updateTask(task.id, { trashedAt, archivedAt })
      ).resolves.not.toThrow();

      const retrieved = await store.getTask(task.id);
      expect(retrieved?.trashedAt).toEqual(trashedAt);
      expect(retrieved?.archivedAt).toEqual(archivedAt);
    });

    it('should handle null/undefined values correctly in database operations', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Set values first
      await store.updateTask(task.id, {
        trashedAt: new Date(),
        archivedAt: new Date(),
      });

      // Clear values using undefined
      await store.updateTask(task.id, {
        trashedAt: undefined,
        archivedAt: undefined,
      });

      const retrieved = await store.getTask(task.id);
      expect(retrieved?.trashedAt).toBeUndefined();
      expect(retrieved?.archivedAt).toBeUndefined();
    });
  });

  describe('Task Lifecycle State Transitions', () => {
    it('should support all valid trash/archive state combinations', async () => {
      const testCases = [
        { status: 'completed' as TaskStatus, shouldArchive: true, shouldTrash: false },
        { status: 'failed' as TaskStatus, shouldArchive: false, shouldTrash: true },
        { status: 'cancelled' as TaskStatus, shouldArchive: false, shouldTrash: true },
        { status: 'pending' as TaskStatus, shouldArchive: false, shouldTrash: false },
        { status: 'in-progress' as TaskStatus, shouldArchive: false, shouldTrash: false },
      ];

      for (const testCase of testCases) {
        const task = createTestTask({ status: testCase.status });
        await store.createTask(task);

        if (testCase.shouldArchive) {
          await store.updateTask(task.id, { archivedAt: new Date() });
        }

        if (testCase.shouldTrash) {
          await store.updateTask(task.id, { trashedAt: new Date() });
        }

        const retrieved = await store.getTask(task.id);

        if (testCase.shouldArchive) {
          expect(retrieved?.archivedAt).toBeDefined();
        } else {
          expect(retrieved?.archivedAt).toBeUndefined();
        }

        if (testCase.shouldTrash) {
          expect(retrieved?.trashedAt).toBeDefined();
        } else {
          expect(retrieved?.trashedAt).toBeUndefined();
        }
      }
    });

    it('should maintain temporal ordering of lifecycle events', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const createdAt = task.createdAt;
      const completedAt = new Date(createdAt.getTime() + 1000);
      const archivedAt = new Date(completedAt.getTime() + 1000);

      // Complete then archive
      await store.updateTask(task.id, {
        status: 'completed',
        completedAt,
      });

      await store.updateTask(task.id, {
        archivedAt,
      });

      const retrieved = await store.getTask(task.id);
      expect(retrieved?.createdAt.getTime()).toBeLessThan(retrieved!.completedAt!.getTime());
      expect(retrieved?.completedAt!.getTime()).toBeLessThan(retrieved!.archivedAt!.getTime());
    });
  });

  describe('Filtering and Querying with Lifecycle Status', () => {
    beforeEach(async () => {
      // Create a variety of tasks in different lifecycle states
      const tasks = [
        createTestTask({ id: 'active-pending', status: 'pending' }),
        createTestTask({ id: 'active-progress', status: 'in-progress' }),
        createTestTask({ id: 'active-completed', status: 'completed' }),
        createTestTask({ id: 'trashed-cancelled', status: 'cancelled' }),
        createTestTask({ id: 'trashed-failed', status: 'failed' }),
        createTestTask({ id: 'archived-completed', status: 'completed' }),
      ];

      for (const task of tasks) {
        await store.createTask(task);
      }

      // Trash some tasks
      await store.updateTask('trashed-cancelled', { trashedAt: new Date() });
      await store.updateTask('trashed-failed', { trashedAt: new Date() });

      // Archive one task
      await store.updateTask('archived-completed', { archivedAt: new Date() });
    });

    it('should exclude trashed and archived tasks from default listing', async () => {
      const activeTasks = await store.listTasks();
      const activeIds = activeTasks.map(t => t.id);

      expect(activeIds).toContain('active-pending');
      expect(activeIds).toContain('active-progress');
      expect(activeIds).toContain('active-completed');
      expect(activeIds).not.toContain('trashed-cancelled');
      expect(activeIds).not.toContain('trashed-failed');
      expect(activeIds).not.toContain('archived-completed');
    });

    it('should return only trashed tasks when explicitly requested', async () => {
      const trashedTasks = await store.getTrashedTasks();
      const trashedIds = trashedTasks.map(t => t.id);

      expect(trashedIds).toContain('trashed-cancelled');
      expect(trashedIds).toContain('trashed-failed');
      expect(trashedIds).not.toContain('active-pending');
      expect(trashedIds).not.toContain('archived-completed');
    });

    it('should return only archived tasks when explicitly requested', async () => {
      const archivedTasks = await store.getArchivedTasks();
      const archivedIds = archivedTasks.map(t => t.id);

      expect(archivedIds).toContain('archived-completed');
      expect(archivedIds).not.toContain('active-pending');
      expect(archivedIds).not.toContain('trashed-cancelled');
    });

    it('should include all tasks when lifecycle states are explicitly requested', async () => {
      const allTasks = await store.getAllTasksIncludingLifecycleStates();
      const allIds = allTasks.map(t => t.id);

      expect(allIds).toContain('active-pending');
      expect(allIds).toContain('trashed-cancelled');
      expect(allIds).toContain('archived-completed');
      expect(allTasks).toHaveLength(6);
    });

    it('should support filtering with includeTrashed and includeArchived options', async () => {
      const tasksWithTrashed = await store.listTasks({ includeTrashed: true });
      const trashedIds = tasksWithTrashed.map(t => t.id);

      expect(trashedIds).toContain('active-pending');
      expect(trashedIds).toContain('trashed-cancelled');
      expect(trashedIds).not.toContain('archived-completed');

      const tasksWithArchived = await store.listTasks({ includeArchived: true });
      const archivedIds = tasksWithArchived.map(t => t.id);

      expect(archivedIds).toContain('active-pending');
      expect(archivedIds).toContain('archived-completed');
      expect(archivedIds).not.toContain('trashed-cancelled');
    });
  });

  describe('Convenience Methods', () => {
    it('should properly implement trashTask convenience method', async () => {
      const task = createTestTask();
      await store.createTask(task);

      await store.trashTask(task.id);

      const retrieved = await store.getTask(task.id);
      expect(retrieved?.trashedAt).toBeDefined();
      expect(retrieved?.status).toBe('cancelled');
      expect(retrieved?.updatedAt).toBeDefined();
    });

    it('should properly implement archiveTask convenience method', async () => {
      const task = createTestTask({ status: 'completed' });
      await store.createTask(task);

      await store.archiveTask(task.id);

      const retrieved = await store.getTask(task.id);
      expect(retrieved?.archivedAt).toBeDefined();
      expect(retrieved?.updatedAt).toBeDefined();
    });

    it('should properly implement restoreTask convenience method for trashed tasks', async () => {
      const task = createTestTask();
      await store.createTask(task);

      await store.trashTask(task.id);
      await store.restoreTask(task.id, 'pending');

      const retrieved = await store.getTask(task.id);
      expect(retrieved?.trashedAt).toBeUndefined();
      expect(retrieved?.archivedAt).toBeUndefined();
      expect(retrieved?.status).toBe('pending');
    });

    it('should properly implement restoreTask convenience method for archived tasks', async () => {
      const task = createTestTask({ status: 'completed' });
      await store.createTask(task);

      await store.archiveTask(task.id);
      await store.restoreTask(task.id);

      const retrieved = await store.getTask(task.id);
      expect(retrieved?.trashedAt).toBeUndefined();
      expect(retrieved?.archivedAt).toBeUndefined();
      expect(retrieved?.status).toBe('completed'); // Should retain original status
    });

    it('should handle restoreTask with non-existent task', async () => {
      await expect(store.restoreTask('non-existent-task')).rejects.toThrow(
        'Task with ID non-existent-task not found'
      );
    });
  });

  describe('Data Integrity and Edge Cases', () => {
    it('should handle tasks with both trashed_at and archived_at set', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const trashedAt = new Date('2024-01-15T10:00:00Z');
      const archivedAt = new Date('2024-01-20T15:00:00Z');

      await store.updateTask(task.id, { trashedAt, archivedAt });

      const retrieved = await store.getTask(task.id);
      expect(retrieved?.trashedAt).toEqual(trashedAt);
      expect(retrieved?.archivedAt).toEqual(archivedAt);
    });

    it('should handle timezone-aware date operations correctly', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Use different timezones
      const utcDate = new Date('2024-01-15T10:00:00.000Z');
      const estDate = new Date('2024-01-15T05:00:00.000-05:00'); // Same as UTC

      await store.updateTask(task.id, { trashedAt: utcDate });
      const retrieved1 = await store.getTask(task.id);

      await store.updateTask(task.id, { trashedAt: estDate });
      const retrieved2 = await store.getTask(task.id);

      // Both should represent the same moment in time
      expect(retrieved1?.trashedAt?.getTime()).toBe(retrieved2?.trashedAt?.getTime());
    });

    it('should maintain performance with large numbers of lifecycle state changes', async () => {
      // Create multiple tasks and perform many lifecycle operations
      const tasks = [];
      for (let i = 0; i < 10; i++) {
        const task = createTestTask({ id: `bulk-task-${i}` });
        tasks.push(task);
        await store.createTask(task);
      }

      // Perform bulk lifecycle operations
      const start = Date.now();

      for (const task of tasks) {
        await store.updateTask(task.id, { trashedAt: new Date() });
        await store.updateTask(task.id, { trashedAt: undefined });
        await store.updateTask(task.id, { archivedAt: new Date() });
        await store.updateTask(task.id, { archivedAt: undefined });
      }

      const duration = Date.now() - start;

      // Should complete reasonably quickly (under 1 second for 10 tasks * 4 operations)
      expect(duration).toBeLessThan(1000);

      // Verify all tasks are in expected state
      const finalTasks = await store.listTasks();
      expect(finalTasks).toHaveLength(10);

      for (const task of finalTasks) {
        expect(task.trashedAt).toBeUndefined();
        expect(task.archivedAt).toBeUndefined();
      }
    });
  });

  describe('Integration with Existing Task Features', () => {
    it('should preserve lifecycle status during task dependency updates', async () => {
      const depTask = createTestTask({ id: 'dep-task' });
      const mainTask = createTestTask({ id: 'main-task', dependsOn: ['dep-task'] });

      await store.createTask(depTask);
      await store.createTask(mainTask);

      // Archive the dependency task
      await store.updateTask('dep-task', {
        status: 'completed',
        archivedAt: new Date()
      });

      // Update dependencies on main task
      await store.updateTask('main-task', { dependsOn: ['dep-task', 'another-dep'] });

      // Dependency task should still be archived
      const retrievedDep = await store.getTask('dep-task');
      expect(retrievedDep?.archivedAt).toBeDefined();
      expect(retrievedDep?.status).toBe('completed');
    });

    it('should handle lifecycle status in task iteration history', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Add some iteration history
      await store.addIterationEntry(task.id, {
        feedback: 'Initial iteration',
        timestamp: new Date(),
        stage: 'implementation',
      });

      // Archive the task
      await store.updateTask(task.id, {
        status: 'completed',
        archivedAt: new Date()
      });

      // Retrieve task with iteration history
      const retrieved = await store.getTask(task.id);
      expect(retrieved?.archivedAt).toBeDefined();
      expect(retrieved?.iterationHistory?.entries).toHaveLength(1);
    });

    it('should handle lifecycle status with task usage tracking', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Update usage
      await store.updateTask(task.id, {
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.05,
        },
      });

      // Trash the task
      await store.updateTask(task.id, { trashedAt: new Date() });

      const retrieved = await store.getTask(task.id);
      expect(retrieved?.trashedAt).toBeDefined();
      expect(retrieved?.usage.totalTokens).toBe(1500);
      expect(retrieved?.usage.estimatedCost).toBe(0.05);
    });
  });
});