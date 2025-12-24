/**
 * Idle Dismiss Unit Tests
 *
 * Tests the ApexOrchestrator.deleteIdleTask method and related functionality
 * including the TaskStore.deleteIdleTask implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from '../index';
import { TaskStore } from '../store';
import type { IdleTask } from '@apexcli/core';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('ApexOrchestrator deleteIdleTask', () => {
  let orchestrator: ApexOrchestrator;
  let tempDir: string;
  let dbPath: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp('/tmp/apex-test-');
    dbPath = path.join(tempDir, 'test.db');

    // Initialize orchestrator with test database
    orchestrator = new ApexOrchestrator({
      projectPath: tempDir,
      dbPath
    });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    // Clean up temp directory
    await orchestrator.close?.();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createTestIdleTask = (): IdleTask => ({
    id: `idle-task-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
    title: 'Test Maintenance Task',
    description: 'Remove deprecated code from legacy modules',
    rationale: 'Improves code quality and reduces technical debt',
    type: 'maintenance',
    priority: 'medium',
    estimatedEffort: 'small',
    suggestedWorkflow: 'maintenance',
    detectedAt: new Date(),
    implemented: false,
    implementedAt: null,
    metadata: {
      sourceFiles: ['src/legacy.ts'],
      impact: 'low',
      automatable: true
    }
  });

  describe('successful deletion', () => {
    it('should delete an existing idle task', async () => {
      // Create an idle task first
      const idleTask = createTestIdleTask();
      await orchestrator.createIdleTask(idleTask);

      // Verify it exists
      const beforeDelete = await orchestrator.getIdleTask(idleTask.id);
      expect(beforeDelete).not.toBeNull();
      expect(beforeDelete?.id).toBe(idleTask.id);

      // Delete the task
      await orchestrator.deleteIdleTask(idleTask.id);

      // Verify it's gone
      const afterDelete = await orchestrator.getIdleTask(idleTask.id);
      expect(afterDelete).toBeNull();
    });

    it('should handle multiple task deletions in sequence', async () => {
      // Create multiple idle tasks
      const tasks = [createTestIdleTask(), createTestIdleTask(), createTestIdleTask()];

      for (const task of tasks) {
        await orchestrator.createIdleTask(task);
      }

      // Verify all exist
      for (const task of tasks) {
        const existingTask = await orchestrator.getIdleTask(task.id);
        expect(existingTask).not.toBeNull();
      }

      // Delete them in sequence
      for (const task of tasks) {
        await orchestrator.deleteIdleTask(task.id);
      }

      // Verify all are gone
      for (const task of tasks) {
        const deletedTask = await orchestrator.getIdleTask(task.id);
        expect(deletedTask).toBeNull();
      }
    });

    it('should handle concurrent task deletions', async () => {
      // Create multiple idle tasks
      const tasks = [createTestIdleTask(), createTestIdleTask(), createTestIdleTask()];

      for (const task of tasks) {
        await orchestrator.createIdleTask(task);
      }

      // Delete them concurrently
      const deletePromises = tasks.map(task => orchestrator.deleteIdleTask(task.id));
      await Promise.all(deletePromises);

      // Verify all are gone
      for (const task of tasks) {
        const deletedTask = await orchestrator.getIdleTask(task.id);
        expect(deletedTask).toBeNull();
      }
    });

    it('should delete tasks with different types and priorities', async () => {
      const taskVariants = [
        { ...createTestIdleTask(), type: 'maintenance', priority: 'low' },
        { ...createTestIdleTask(), type: 'refactoring', priority: 'high' },
        { ...createTestIdleTask(), type: 'docs', priority: 'medium' },
        { ...createTestIdleTask(), type: 'tests', priority: 'urgent' }
      ];

      // Create all tasks
      for (const task of taskVariants) {
        await orchestrator.createIdleTask(task);
      }

      // Delete each type
      for (const task of taskVariants) {
        await orchestrator.deleteIdleTask(task.id);

        // Verify specific task is deleted
        const deletedTask = await orchestrator.getIdleTask(task.id);
        expect(deletedTask).toBeNull();
      }
    });
  });

  describe('error handling', () => {
    it('should throw error when deleting non-existent task', async () => {
      const nonExistentId = 'idle-task-that-does-not-exist';

      await expect(orchestrator.deleteIdleTask(nonExistentId)).rejects.toThrow(
        `Idle task with ID ${nonExistentId} not found`
      );
    });

    it('should throw error when orchestrator is not initialized', async () => {
      const uninitializedOrchestrator = new ApexOrchestrator({ projectPath: tempDir });

      await expect(uninitializedOrchestrator.deleteIdleTask('any-id')).rejects.toThrow(
        'Orchestrator must be initialized first'
      );
    });

    it('should handle malformed task IDs gracefully', async () => {
      const malformedIds = ['', ' ', '\n', '\t', null as any, undefined as any];

      for (const malformedId of malformedIds) {
        await expect(orchestrator.deleteIdleTask(malformedId)).rejects.toThrow();
      }
    });

    it('should handle special characters in task IDs', async () => {
      // These should all result in "not found" errors since we're not creating tasks with these IDs
      const specialCharIds = [
        'task-with-@-symbol',
        'task.with.dots',
        'task_with_underscores',
        'task#with#hashes',
        'task%20with%20encoding',
        'タスク-unicode-漢字'
      ];

      for (const specialId of specialCharIds) {
        await expect(orchestrator.deleteIdleTask(specialId)).rejects.toThrow(
          `Idle task with ID ${specialId} not found`
        );
      }
    });

    it('should handle extremely long task IDs', async () => {
      const veryLongId = 'a'.repeat(1000);

      await expect(orchestrator.deleteIdleTask(veryLongId)).rejects.toThrow(
        `Idle task with ID ${veryLongId} not found`
      );
    });
  });

  describe('database integrity', () => {
    it('should not affect other idle tasks when deleting one', async () => {
      // Create multiple tasks
      const tasks = [createTestIdleTask(), createTestIdleTask(), createTestIdleTask()];

      for (const task of tasks) {
        await orchestrator.createIdleTask(task);
      }

      // Delete the middle one
      await orchestrator.deleteIdleTask(tasks[1].id);

      // Verify the other two still exist
      const firstTask = await orchestrator.getIdleTask(tasks[0].id);
      const thirdTask = await orchestrator.getIdleTask(tasks[2].id);
      const deletedTask = await orchestrator.getIdleTask(tasks[1].id);

      expect(firstTask).not.toBeNull();
      expect(thirdTask).not.toBeNull();
      expect(deletedTask).toBeNull();
    });

    it('should not affect regular tasks when deleting idle tasks', async () => {
      // Create a regular task
      const regularTask = await orchestrator.createTask({
        description: 'Regular task for testing',
        workflow: 'feature'
      });

      // Create and delete an idle task
      const idleTask = createTestIdleTask();
      await orchestrator.createIdleTask(idleTask);
      await orchestrator.deleteIdleTask(idleTask.id);

      // Verify regular task is unaffected
      const existingRegularTask = await orchestrator.getTask(regularTask.id);
      expect(existingRegularTask).not.toBeNull();
      expect(existingRegularTask?.id).toBe(regularTask.id);
    });

    it('should maintain database consistency after multiple operations', async () => {
      // Perform a series of create/delete operations
      const operations = [
        () => orchestrator.createIdleTask(createTestIdleTask()),
        () => orchestrator.createIdleTask(createTestIdleTask()),
        (id: string) => orchestrator.deleteIdleTask(id),
        () => orchestrator.createIdleTask(createTestIdleTask()),
      ];

      const createdTaskIds: string[] = [];

      // Create two tasks
      const task1 = createTestIdleTask();
      const task2 = createTestIdleTask();
      await orchestrator.createIdleTask(task1);
      await orchestrator.createIdleTask(task2);
      createdTaskIds.push(task1.id, task2.id);

      // Delete first task
      await orchestrator.deleteIdleTask(task1.id);

      // Create another task
      const task3 = createTestIdleTask();
      await orchestrator.createIdleTask(task3);
      createdTaskIds.push(task3.id);

      // Verify final state
      const task1Result = await orchestrator.getIdleTask(task1.id);
      const task2Result = await orchestrator.getIdleTask(task2.id);
      const task3Result = await orchestrator.getIdleTask(task3.id);

      expect(task1Result).toBeNull(); // Deleted
      expect(task2Result).not.toBeNull(); // Still exists
      expect(task3Result).not.toBeNull(); // Still exists
    });
  });

  describe('edge cases and data validation', () => {
    it('should handle deletion of task with complex metadata', async () => {
      const complexTask = {
        ...createTestIdleTask(),
        metadata: {
          sourceFiles: ['src/file1.ts', 'src/file2.ts', 'src/nested/file3.ts'],
          impact: 'medium',
          automatable: false,
          dependencies: ['task-1', 'task-2'],
          estimatedHours: 4.5,
          tags: ['refactor', 'performance', 'cleanup'],
          relatedIssues: ['#123', '#456'],
          customField: 'custom-value'
        }
      };

      await orchestrator.createIdleTask(complexTask);
      await orchestrator.deleteIdleTask(complexTask.id);

      const deletedTask = await orchestrator.getIdleTask(complexTask.id);
      expect(deletedTask).toBeNull();
    });

    it('should handle deletion of implemented idle tasks', async () => {
      const implementedTask = {
        ...createTestIdleTask(),
        implemented: true,
        implementedAt: new Date()
      };

      await orchestrator.createIdleTask(implementedTask);

      // Should still be able to delete implemented tasks
      await orchestrator.deleteIdleTask(implementedTask.id);

      const deletedTask = await orchestrator.getIdleTask(implementedTask.id);
      expect(deletedTask).toBeNull();
    });

    it('should handle deletion attempt on same task multiple times', async () => {
      const task = createTestIdleTask();
      await orchestrator.createIdleTask(task);

      // First deletion should succeed
      await orchestrator.deleteIdleTask(task.id);

      // Second deletion should fail
      await expect(orchestrator.deleteIdleTask(task.id)).rejects.toThrow(
        `Idle task with ID ${task.id} not found`
      );

      // Third deletion should also fail
      await expect(orchestrator.deleteIdleTask(task.id)).rejects.toThrow(
        `Idle task with ID ${task.id} not found`
      );
    });
  });

  describe('performance considerations', () => {
    it('should handle bulk deletions efficiently', async () => {
      const numTasks = 50;
      const tasks = Array.from({ length: numTasks }, () => createTestIdleTask());

      // Create all tasks
      const startCreate = Date.now();
      for (const task of tasks) {
        await orchestrator.createIdleTask(task);
      }
      const endCreate = Date.now();

      // Delete all tasks
      const startDelete = Date.now();
      for (const task of tasks) {
        await orchestrator.deleteIdleTask(task.id);
      }
      const endDelete = Date.now();

      // Basic performance check - deletions should be reasonably fast
      const createTime = endCreate - startCreate;
      const deleteTime = endDelete - startDelete;

      // Delete operations should not be significantly slower than create operations
      expect(deleteTime).toBeLessThan(createTime * 2);

      // Verify all are actually deleted
      for (const task of tasks) {
        const deletedTask = await orchestrator.getIdleTask(task.id);
        expect(deletedTask).toBeNull();
      }
    });

    it('should handle concurrent delete operations without race conditions', async () => {
      const numTasks = 10;
      const tasks = Array.from({ length: numTasks }, () => createTestIdleTask());

      // Create all tasks
      for (const task of tasks) {
        await orchestrator.createIdleTask(task);
      }

      // Delete all tasks concurrently
      const deletePromises = tasks.map(task => orchestrator.deleteIdleTask(task.id));
      await Promise.all(deletePromises);

      // Verify all deletions succeeded
      for (const task of tasks) {
        const deletedTask = await orchestrator.getIdleTask(task.id);
        expect(deletedTask).toBeNull();
      }
    });
  });
});