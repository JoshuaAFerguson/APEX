/**
 * Task Lifecycle Integration Tests
 *
 * Tests end-to-end task lifecycle operations including:
 * - Task creation → modification → completion workflow
 * - Parent-child task relationships
 * - Task dependencies and blocking
 * - Trash and archive operations
 * - Queue management and priority handling
 * - Recovery and resume scenarios
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

describe('Task Lifecycle Integration Tests', () => {
  let testDir: string;
  let store: TaskStore;

  const createTaskRequest = (overrides: Partial<CreateTaskRequest> = {}): CreateTaskRequest => ({
    description: 'Integration test task',
    acceptanceCriteria: 'Task should complete successfully',
    workflow: 'feature',
    autonomy: 'full',
    agent: 'developer',
    ...overrides,
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-lifecycle-test-'));
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

  describe('Complete Task Workflow', () => {
    it('should handle full task lifecycle: creation → progress → completion', async () => {
      // 1. Create task
      const task = await store.createTask(createTaskRequest({
        description: 'Implement new feature',
        priority: 'high',
      }));

      expect(task.status).toBe('pending');
      expect(task.priority).toBe('high');

      // 2. Start task
      await store.updateTask(task.id, {
        status: 'in-progress',
        currentStage: 'planning',
      });

      let updated = await store.getTask(task.id);
      expect(updated?.status).toBe('in-progress');
      expect(updated?.currentStage).toBe('planning');

      // 3. Add work logs
      await store.addLog(task.id, {
        level: 'info',
        message: 'Started planning phase',
        stage: 'planning',
      });

      await store.addLog(task.id, {
        level: 'info',
        message: 'Planning completed, moving to implementation',
        stage: 'planning',
      });

      // 4. Progress through stages
      await store.updateTask(task.id, {
        currentStage: 'implementation',
      });

      await store.addLog(task.id, {
        level: 'info',
        message: 'Implementation in progress',
        stage: 'implementation',
      });

      // 5. Add artifacts
      await store.addArtifact(task.id, {
        name: 'feature.ts',
        type: 'code',
        content: 'export const newFeature = () => { /* implementation */ };',
      });

      // 6. Complete task
      const completedAt = new Date();
      await store.updateTask(task.id, {
        status: 'completed',
        completedAt,
        currentStage: 'completed',
      });

      const completed = await store.getTask(task.id);
      expect(completed?.status).toBe('completed');
      expect(completed?.completedAt).toEqual(completedAt);
      expect(completed?.logs.length).toBe(3);
      expect(completed?.artifacts.length).toBe(1);
    });

    it('should handle task failure and retry workflow', async () => {
      const task = await store.createTask(createTaskRequest({
        description: 'Task that may fail',
        maxRetries: 2,
      }));

      // 1. Start task
      await store.updateTask(task.id, { status: 'in-progress' });

      // 2. Fail task
      await store.updateTask(task.id, {
        status: 'failed',
        error: 'Build failed due to missing dependency',
        retryCount: 1,
      });

      let failed = await store.getTask(task.id);
      expect(failed?.status).toBe('failed');
      expect(failed?.error).toBe('Build failed due to missing dependency');
      expect(failed?.retryCount).toBe(1);

      // 3. Retry task
      await store.queueTask(task.id, 'urgent');

      const retried = await store.getTask(task.id);
      expect(retried?.status).toBe('pending');
      expect(retried?.priority).toBe('urgent');
      expect(retried?.retryCount).toBe(1); // Should preserve retry count
    });

    it('should handle task pause and resume workflow', async () => {
      const task = await store.createTask(createTaskRequest({
        description: 'Task that can be paused',
      }));

      // 1. Start task
      await store.updateTask(task.id, { status: 'in-progress' });

      // 2. Pause task
      const pausedAt = new Date();
      const resumeAfter = new Date(Date.now() + 3600000); // 1 hour later

      await store.updateTask(task.id, {
        status: 'paused',
        pausedAt,
        resumeAfter,
        pauseReason: 'usage_limit',
      });

      const paused = await store.getTask(task.id);
      expect(paused?.status).toBe('paused');
      expect(paused?.pausedAt).toEqual(pausedAt);
      expect(paused?.resumeAfter).toEqual(resumeAfter);
      expect(paused?.pauseReason).toBe('usage_limit');

      // 3. Resume task
      await store.updateTask(task.id, {
        status: 'in-progress',
        pausedAt: null,
        resumeAfter: null,
        pauseReason: null,
      });

      const resumed = await store.getTask(task.id);
      expect(resumed?.status).toBe('in-progress');
      expect(resumed?.pausedAt).toBeNull();
      expect(resumed?.resumeAfter).toBeNull();
      expect(resumed?.pauseReason).toBeNull();
    });
  });

  describe('Parent-Child Task Relationships', () => {
    it('should handle parent task with subtasks workflow', async () => {
      // 1. Create parent task
      const parentTask = await store.createTask(createTaskRequest({
        description: 'Parent task with subtasks',
        priority: 'high',
      }));

      // 2. Create subtasks
      const subtask1 = await store.createTask(createTaskRequest({
        description: 'Subtask 1: Database setup',
        parentTaskId: parentTask.id,
      }));

      const subtask2 = await store.createTask(createTaskRequest({
        description: 'Subtask 2: API implementation',
        parentTaskId: parentTask.id,
      }));

      const subtask3 = await store.createTask(createTaskRequest({
        description: 'Subtask 3: Frontend integration',
        parentTaskId: parentTask.id,
      }));

      // 3. Update parent with subtask references
      await store.updateTask(parentTask.id, {
        subtaskIds: [subtask1.id, subtask2.id, subtask3.id],
        subtaskStrategy: 'parallel',
      });

      const updatedParent = await store.getTask(parentTask.id);
      expect(updatedParent?.subtaskIds).toEqual([subtask1.id, subtask2.id, subtask3.id]);
      expect(updatedParent?.subtaskStrategy).toBe('parallel');

      // 4. Complete subtasks in order
      await store.updateTask(subtask1.id, { status: 'completed' });
      await store.updateTask(subtask2.id, { status: 'completed' });

      // 5. Check that parent can be resumed when paused
      await store.updateTask(updatedParent.id, {
        status: 'paused',
        pauseReason: 'usage_limit',
      });

      const parentTasks = await store.findHighestPriorityParentTask();
      expect(parentTasks.length).toBeGreaterThan(0);
      expect(parentTasks[0].id).toBe(parentTask.id);

      // 6. Complete final subtask
      await store.updateTask(subtask3.id, { status: 'completed' });

      // 7. Complete parent task
      await store.updateTask(parentTask.id, { status: 'completed' });

      const finalParent = await store.getTask(parentTask.id);
      expect(finalParent?.status).toBe('completed');
    });

    it('should handle orphaned subtasks when parent is deleted', async () => {
      const parentTask = await store.createTask(createTaskRequest({
        description: 'Parent to be deleted',
      }));

      const subtask = await store.createTask(createTaskRequest({
        description: 'Orphaned subtask',
        parentTaskId: parentTask.id,
      }));

      // Delete parent task
      await store.trashTask(parentTask.id);
      await store.emptyTrash();

      // Subtask should still exist but without parent reference
      const orphanedSubtask = await store.getTask(subtask.id);
      expect(orphanedSubtask).not.toBeNull();
      expect(orphanedSubtask?.parentTaskId).toBe(parentTask.id); // Reference remains for integrity
    });
  });

  describe('Task Dependencies and Blocking', () => {
    it('should handle complex dependency chain workflow', async () => {
      // Create dependency chain: A → B → C → D
      const taskA = await store.createTask(createTaskRequest({ description: 'Task A: Foundation' }));
      const taskB = await store.createTask(createTaskRequest({ description: 'Task B: Core' }));
      const taskC = await store.createTask(createTaskRequest({ description: 'Task C: Features' }));
      const taskD = await store.createTask(createTaskRequest({ description: 'Task D: Integration' }));

      // Set up dependencies
      await store.addDependency(taskB.id, taskA.id);
      await store.addDependency(taskC.id, taskB.id);
      await store.addDependency(taskD.id, taskC.id);

      // 1. Initially, only Task A should be ready
      let readyTasks = await store.getReadyTasks();
      expect(readyTasks.some(t => t.id === taskA.id)).toBe(true);
      expect(readyTasks.some(t => t.id === taskB.id)).toBe(false);

      // 2. Complete Task A
      await store.updateTask(taskA.id, { status: 'completed' });

      // Now Task B should be ready
      readyTasks = await store.getReadyTasks();
      expect(readyTasks.some(t => t.id === taskB.id)).toBe(true);
      expect(readyTasks.some(t => t.id === taskC.id)).toBe(false);

      // 3. Complete Task B
      await store.updateTask(taskB.id, { status: 'completed' });

      // Now Task C should be ready
      readyTasks = await store.getReadyTasks();
      expect(readyTasks.some(t => t.id === taskC.id)).toBe(true);
      expect(readyTasks.some(t => t.id === taskD.id)).toBe(false);

      // 4. Complete Task C
      await store.updateTask(taskC.id, { status: 'completed' });

      // Now Task D should be ready
      readyTasks = await store.getReadyTasks();
      expect(readyTasks.some(t => t.id === taskD.id)).toBe(true);
    });

    it('should handle diamond dependency pattern', async () => {
      //     A
      //   /   \
      //  B     C
      //   \   /
      //     D

      const taskA = await store.createTask(createTaskRequest({ description: 'Task A: Base' }));
      const taskB = await store.createTask(createTaskRequest({ description: 'Task B: Left' }));
      const taskC = await store.createTask(createTaskRequest({ description: 'Task C: Right' }));
      const taskD = await store.createTask(createTaskRequest({ description: 'Task D: Merge' }));

      await store.addDependency(taskB.id, taskA.id);
      await store.addDependency(taskC.id, taskA.id);
      await store.addDependency(taskD.id, taskB.id);
      await store.addDependency(taskD.id, taskC.id);

      // 1. Complete A
      await store.updateTask(taskA.id, { status: 'completed' });

      // Both B and C should be ready
      let readyTasks = await store.getReadyTasks();
      expect(readyTasks.some(t => t.id === taskB.id)).toBe(true);
      expect(readyTasks.some(t => t.id === taskC.id)).toBe(true);
      expect(readyTasks.some(t => t.id === taskD.id)).toBe(false);

      // 2. Complete only B
      await store.updateTask(taskB.id, { status: 'completed' });

      // D should still not be ready (needs C)
      readyTasks = await store.getReadyTasks();
      expect(readyTasks.some(t => t.id === taskD.id)).toBe(false);

      // 3. Complete C
      await store.updateTask(taskC.id, { status: 'completed' });

      // Now D should be ready
      readyTasks = await store.getReadyTasks();
      expect(readyTasks.some(t => t.id === taskD.id)).toBe(true);
    });

    it('should handle dependency modification during workflow', async () => {
      const taskA = await store.createTask(createTaskRequest({ description: 'Task A' }));
      const taskB = await store.createTask(createTaskRequest({ description: 'Task B' }));
      const taskC = await store.createTask(createTaskRequest({ description: 'Task C' }));

      await store.addDependency(taskB.id, taskA.id);

      // B is blocked by A
      let blockers = await store.getBlockingTasks(taskB.id);
      expect(blockers).toContain(taskA.id);

      // Add C as additional dependency
      await store.addDependency(taskB.id, taskC.id);

      blockers = await store.getBlockingTasks(taskB.id);
      expect(blockers).toContain(taskA.id);
      expect(blockers).toContain(taskC.id);

      // Remove A dependency
      await store.removeDependency(taskB.id, taskA.id);

      blockers = await store.getBlockingTasks(taskB.id);
      expect(blockers).not.toContain(taskA.id);
      expect(blockers).toContain(taskC.id);
    });
  });

  describe('Queue Management and Priority', () => {
    it('should handle priority-based queue ordering', async () => {
      const tasks = await Promise.all([
        store.createTask(createTaskRequest({ description: 'Low priority', priority: 'low' })),
        store.createTask(createTaskRequest({ description: 'High priority', priority: 'high' })),
        store.createTask(createTaskRequest({ description: 'Urgent priority', priority: 'urgent' })),
        store.createTask(createTaskRequest({ description: 'Normal priority', priority: 'normal' })),
      ]);

      const orderedTasks = await store.getReadyTasks({ orderByPriority: true });

      // Should be ordered: urgent, high, normal, low
      const priorities = orderedTasks.map(t => t.priority);
      const urgentIndex = priorities.indexOf('urgent');
      const highIndex = priorities.indexOf('high');
      const normalIndex = priorities.indexOf('normal');
      const lowIndex = priorities.indexOf('low');

      expect(urgentIndex).toBeLessThan(highIndex);
      expect(highIndex).toBeLessThan(normalIndex);
      expect(normalIndex).toBeLessThan(lowIndex);
    });

    it('should handle queue operations with priority changes', async () => {
      const task = await store.createTask(createTaskRequest({
        description: 'Queue test task',
        priority: 'low',
      }));

      await store.updateTask(task.id, { status: 'failed' });

      // Requeue with higher priority
      await store.queueTask(task.id, 'urgent');

      const nextTask = await store.getNextQueuedTask();
      expect(nextTask?.id).toBe(task.id);
      expect(nextTask?.priority).toBe('urgent');
      expect(nextTask?.status).toBe('pending');
    });

    it('should handle bulk queue operations', async () => {
      // Create multiple failed tasks
      const failedTasks = await Promise.all(
        Array(10).fill(null).map(async (_, i) => {
          const task = await store.createTask(createTaskRequest({
            description: `Failed task ${i}`,
            priority: i % 2 === 0 ? 'normal' : 'high',
          }));
          await store.updateTask(task.id, { status: 'failed' });
          return task;
        })
      );

      // Requeue all with different priorities
      await Promise.all(
        failedTasks.map(task =>
          store.queueTask(task.id, 'urgent')
        )
      );

      // All should be queued and ready
      const readyTasks = await store.getReadyTasks({ orderByPriority: true });
      const requeuedTasks = readyTasks.filter(t =>
        failedTasks.some(ft => ft.id === t.id)
      );

      expect(requeuedTasks).toHaveLength(10);
      requeuedTasks.forEach(task => {
        expect(task.priority).toBe('urgent');
        expect(task.status).toBe('pending');
      });
    });
  });

  describe('Trash and Archive Lifecycle', () => {
    it('should handle complete trash workflow', async () => {
      const tasks = await Promise.all([
        store.createTask(createTaskRequest({ description: 'Task to trash 1' })),
        store.createTask(createTaskRequest({ description: 'Task to trash 2' })),
        store.createTask(createTaskRequest({ description: 'Task to keep' })),
      ]);

      // Add some data to trashed tasks
      await store.addLog(tasks[0].id, { level: 'info', message: 'Will be deleted' });
      await store.addArtifact(tasks[1].id, { name: 'temp.txt', type: 'text' });

      // Trash first two tasks
      await store.trashTask(tasks[0].id);
      await store.trashTask(tasks[1].id);

      // Verify tasks are marked as trashed
      let trashed0 = await store.getTask(tasks[0].id);
      let trashed1 = await store.getTask(tasks[1].id);
      expect(trashed0?.trashedAt).toBeDefined();
      expect(trashed1?.trashedAt).toBeDefined();

      // Get trashed tasks
      const trashedTasks = await store.getTrashedTasks();
      expect(trashedTasks.length).toBe(2);

      // Empty trash
      const deletedCount = await store.emptyTrash();
      expect(deletedCount).toBe(2);

      // Verify tasks are gone
      const afterEmpty0 = await store.getTask(tasks[0].id);
      const afterEmpty1 = await store.getTask(tasks[1].id);
      const kept = await store.getTask(tasks[2].id);

      expect(afterEmpty0).toBeNull();
      expect(afterEmpty1).toBeNull();
      expect(kept).not.toBeNull();
    });

    it('should handle archive workflow for completed tasks', async () => {
      const tasks = await Promise.all([
        store.createTask(createTaskRequest({ description: 'Completed task 1' })),
        store.createTask(createTaskRequest({ description: 'Completed task 2' })),
        store.createTask(createTaskRequest({ description: 'Pending task' })),
      ]);

      // Complete first two tasks
      await store.updateTask(tasks[0].id, { status: 'completed', completedAt: new Date() });
      await store.updateTask(tasks[1].id, { status: 'completed', completedAt: new Date() });

      // Archive completed tasks
      await store.archiveTask(tasks[0].id);
      await store.archiveTask(tasks[1].id);

      // Try to archive pending task (should fail)
      await expect(store.archiveTask(tasks[2].id)).rejects.toThrow();

      // Verify archived tasks
      const archived0 = await store.getTask(tasks[0].id);
      const archived1 = await store.getTask(tasks[1].id);
      const pending = await store.getTask(tasks[2].id);

      expect(archived0?.archivedAt).toBeDefined();
      expect(archived1?.archivedAt).toBeDefined();
      expect(pending?.archivedAt).toBeUndefined();

      // Archived tasks should still be retrievable but marked
      expect(archived0).not.toBeNull();
      expect(archived1).not.toBeNull();
    });

    it('should handle bulk trash and archive operations', async () => {
      // Create many tasks in different states
      const pendingTasks = await Promise.all(
        Array(5).fill(null).map(() => store.createTask(createTaskRequest({ description: 'Pending' })))
      );

      const completedTasks = await Promise.all(
        Array(5).fill(null).map(async () => {
          const task = await store.createTask(createTaskRequest({ description: 'Completed' }));
          await store.updateTask(task.id, { status: 'completed', completedAt: new Date() });
          return task;
        })
      );

      // Trash all pending tasks
      await Promise.all(pendingTasks.map(task => store.trashTask(task.id)));

      // Archive all completed tasks
      await Promise.all(completedTasks.map(task => store.archiveTask(task.id)));

      // Verify operations
      const trashedTasks = await store.getTrashedTasks();
      expect(trashedTasks.length).toBe(5);

      for (const completedTask of completedTasks) {
        const archived = await store.getTask(completedTask.id);
        expect(archived?.archivedAt).toBeDefined();
      }

      // Clean up trash
      const deletedCount = await store.emptyTrash();
      expect(deletedCount).toBe(5);
    });
  });

  describe('Recovery and Resume Scenarios', () => {
    it('should handle system recovery after unexpected shutdown', async () => {
      // Simulate tasks in various states before "crash"
      const tasks = await Promise.all([
        store.createTask(createTaskRequest({ description: 'Was in progress' })),
        store.createTask(createTaskRequest({ description: 'Was paused' })),
        store.createTask(createTaskRequest({ description: 'Was queued' })),
      ]);

      await store.updateTask(tasks[0].id, { status: 'in-progress', currentStage: 'implementation' });
      await store.updateTask(tasks[1].id, { status: 'paused', pauseReason: 'usage_limit' });
      await store.updateTask(tasks[2].id, { status: 'pending', priority: 'urgent' });

      // Close and reinitialize store (simulate restart)
      await store.close();
      store = new TaskStore(testDir);
      await store.initialize();

      // Verify tasks are still in correct states
      const recovered = await Promise.all(
        tasks.map(t => store.getTask(t.id))
      );

      expect(recovered[0]?.status).toBe('in-progress');
      expect(recovered[0]?.currentStage).toBe('implementation');
      expect(recovered[1]?.status).toBe('paused');
      expect(recovered[1]?.pauseReason).toBe('usage_limit');
      expect(recovered[2]?.status).toBe('pending');
      expect(recovered[2]?.priority).toBe('urgent');
    });

    it('should handle resume of paused parent tasks', async () => {
      // Create parent task with subtasks
      const parentTask = await store.createTask(createTaskRequest({
        description: 'Parent with resumable pause',
        priority: 'high',
      }));

      const subtasks = await Promise.all([
        store.createTask(createTaskRequest({ description: 'Subtask 1', parentTaskId: parentTask.id })),
        store.createTask(createTaskRequest({ description: 'Subtask 2', parentTaskId: parentTask.id })),
      ]);

      await store.updateTask(parentTask.id, {
        subtaskIds: subtasks.map(s => s.id),
        status: 'paused',
        pauseReason: 'usage_limit',
      });

      // Find resumable parent tasks
      const resumableParents = await store.findHighestPriorityParentTask();
      expect(resumableParents.length).toBeGreaterThan(0);
      expect(resumableParents[0].id).toBe(parentTask.id);
    });

    it('should handle incremental resume attempts tracking', async () => {
      const task = await store.createTask(createTaskRequest({
        description: 'Task with resume attempts',
        maxRetries: 5,
      }));

      // Simulate multiple resume attempts
      await store.updateTask(task.id, { status: 'paused', pauseReason: 'capacity' });

      for (let attempt = 1; attempt <= 3; attempt++) {
        await store.updateTask(task.id, { resumeAttempts: attempt });

        const updated = await store.getTask(task.id);
        expect(updated?.resumeAttempts).toBe(attempt);
      }

      // Task should still be resumable
      const resumableParents = await store.findHighestPriorityParentTask();
      if (resumableParents.some(t => t.id === task.id)) {
        expect(resumableParents.find(t => t.id === task.id)?.resumeAttempts).toBe(3);
      }
    });
  });

  describe('Concurrent Operation Safety', () => {
    it('should handle concurrent task creation safely', async () => {
      const concurrentCreations = Array(20).fill(null).map((_, i) =>
        store.createTask(createTaskRequest({
          description: `Concurrent task ${i}`,
        }))
      );

      const tasks = await Promise.all(concurrentCreations);

      // All tasks should be created with unique IDs
      const taskIds = tasks.map(t => t.id);
      const uniqueIds = [...new Set(taskIds)];
      expect(uniqueIds.length).toBe(20);

      // All tasks should be retrievable
      const retrieved = await Promise.all(
        taskIds.map(id => store.getTask(id))
      );

      retrieved.forEach(task => {
        expect(task).not.toBeNull();
      });
    });

    it('should handle concurrent status updates safely', async () => {
      const task = await store.createTask(createTaskRequest({
        description: 'Task for concurrent updates',
      }));

      // Simulate concurrent status changes
      const statuses: TaskStatus[] = ['in-progress', 'paused', 'in-progress', 'completed'];
      const concurrentUpdates = statuses.map(status =>
        store.updateTask(task.id, { status })
      );

      await Promise.all(concurrentUpdates);

      // Task should end up in one of the updated states
      const final = await store.getTask(task.id);
      expect(statuses).toContain(final?.status);
    });
  });
});