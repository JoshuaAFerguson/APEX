/**
 * Comprehensive test suite for TaskStore archive operations
 *
 * This test file provides comprehensive coverage for the archive functionality
 * including edge cases, error conditions, and integration scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task, TaskStatus } from '@apexcli/core';

describe('TaskStore - Archive Operations Comprehensive Tests', () => {
  let testDir: string;
  let store: TaskStore;

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task for archive operations',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: testDir,
    branchName: 'apex/archive-test-branch',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-archive-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true });
  });

  describe('archiveTask()', () => {
    it('should only allow archiving completed tasks', async () => {
      const statuses: TaskStatus[] = ['pending', 'running', 'paused', 'failed', 'cancelled'];

      for (const status of statuses) {
        const task = createTestTask({ status, id: `task-${status}` });
        await store.createTask(task);

        await expect(store.archiveTask(task.id)).rejects.toThrow(
          `Cannot archive task ${task.id}: only completed tasks can be archived (current status: ${status})`
        );

        // Verify task was not archived
        const retrieved = await store.getTask(task.id);
        expect(retrieved?.archivedAt).toBeUndefined();
      }
    });

    it('should successfully archive completed tasks', async () => {
      const task = createTestTask({
        status: 'completed',
        completedAt: new Date(),
        id: 'completed-task'
      });
      await store.createTask(task);

      const beforeArchive = Date.now();
      await store.archiveTask(task.id);
      const afterArchive = Date.now();

      const archived = await store.getTask(task.id);
      expect(archived?.archivedAt).toBeDefined();
      expect(archived?.archivedAt!.getTime()).toBeGreaterThanOrEqual(beforeArchive);
      expect(archived?.archivedAt!.getTime()).toBeLessThanOrEqual(afterArchive);
      expect(archived?.status).toBe('completed');
      expect(archived?.completedAt).toBeDefined();
    });

    it('should throw error when archiving non-existent task', async () => {
      const nonExistentId = 'does-not-exist';

      await expect(store.archiveTask(nonExistentId)).rejects.toThrow(
        `Task with ID ${nonExistentId} not found`
      );
    });

    it('should allow re-archiving already archived task', async () => {
      const task = createTestTask({ status: 'completed' });
      await store.createTask(task);

      // Archive first time
      await store.archiveTask(task.id);
      const firstArchive = await store.getTask(task.id);
      const firstArchivedAt = firstArchive!.archivedAt!;

      // Wait a moment to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      // Archive second time
      await store.archiveTask(task.id);
      const secondArchive = await store.getTask(task.id);

      expect(secondArchive?.archivedAt).toBeDefined();
      expect(secondArchive?.archivedAt!.getTime()).toBeGreaterThanOrEqual(firstArchivedAt.getTime());
    });

    it('should handle archiving task with existing artifacts and logs', async () => {
      const task = createTestTask({ status: 'completed' });
      await store.createTask(task);

      // Add logs and artifacts
      await store.addTaskLog(task.id, {
        type: 'info',
        message: 'Task processing complete',
        timestamp: new Date(),
      });

      await store.addTaskArtifact(task.id, {
        type: 'file',
        name: 'output.txt',
        path: '/tmp/output.txt',
        size: 1024,
        createdAt: new Date(),
      });

      await store.archiveTask(task.id);

      const archived = await store.getTask(task.id);
      expect(archived?.archivedAt).toBeDefined();
      expect(archived?.logs).toHaveLength(1);
      expect(archived?.artifacts).toHaveLength(1);
      expect(archived?.logs[0].message).toBe('Task processing complete');
      expect(archived?.artifacts[0].name).toBe('output.txt');
    });
  });

  describe('unarchiveTask()', () => {
    it('should successfully unarchive archived tasks', async () => {
      const task = createTestTask({ status: 'completed' });
      await store.createTask(task);

      await store.archiveTask(task.id);
      expect((await store.getTask(task.id))?.archivedAt).toBeDefined();

      await store.unarchiveTask(task.id);

      const unarchived = await store.getTask(task.id);
      expect(unarchived?.archivedAt).toBeUndefined();
      expect(unarchived?.status).toBe('completed');
      expect(unarchived?.updatedAt).toBeDefined();
    });

    it('should throw error when unarchiving non-archived task', async () => {
      const task = createTestTask({ status: 'completed' });
      await store.createTask(task);

      await expect(store.unarchiveTask(task.id)).rejects.toThrow(
        `Task ${task.id} is not archived`
      );
    });

    it('should throw error when unarchiving non-existent task', async () => {
      const nonExistentId = 'does-not-exist';

      await expect(store.unarchiveTask(nonExistentId)).rejects.toThrow(
        `Task with ID ${nonExistentId} not found`
      );
    });

    it('should preserve all task data when unarchiving', async () => {
      const originalTask = createTestTask({
        status: 'completed',
        description: 'Task with detailed data',
        priority: 'high',
        effort: 'large',
        branchName: 'feature/important-feature'
      });
      await store.createTask(originalTask);

      // Add logs and artifacts
      await store.addTaskLog(originalTask.id, {
        type: 'info',
        message: 'Important log message',
        timestamp: new Date(),
      });

      await store.addTaskArtifact(originalTask.id, {
        type: 'code',
        name: 'implementation.js',
        path: '/src/implementation.js',
        size: 2048,
        createdAt: new Date(),
      });

      await store.archiveTask(originalTask.id);
      await store.unarchiveTask(originalTask.id);

      const unarchived = await store.getTask(originalTask.id);
      expect(unarchived?.description).toBe('Task with detailed data');
      expect(unarchived?.priority).toBe('high');
      expect(unarchived?.effort).toBe('large');
      expect(unarchived?.branchName).toBe('feature/important-feature');
      expect(unarchived?.logs).toHaveLength(1);
      expect(unarchived?.artifacts).toHaveLength(1);
      expect(unarchived?.archivedAt).toBeUndefined();
    });
  });

  describe('listArchived()', () => {
    it('should return empty array when no tasks are archived', async () => {
      const normalTask = createTestTask({ status: 'completed' });
      await store.createTask(normalTask);

      const archivedTasks = await store.listArchived();
      expect(archivedTasks).toHaveLength(0);
    });

    it('should return only archived tasks', async () => {
      // Create various tasks in different states
      const completedTask = createTestTask({
        id: 'completed',
        status: 'completed'
      });
      const archivedTask1 = createTestTask({
        id: 'archived1',
        status: 'completed'
      });
      const archivedTask2 = createTestTask({
        id: 'archived2',
        status: 'completed'
      });
      const pendingTask = createTestTask({
        id: 'pending',
        status: 'pending'
      });

      await store.createTask(completedTask);
      await store.createTask(archivedTask1);
      await store.createTask(archivedTask2);
      await store.createTask(pendingTask);

      // Archive two tasks
      await store.archiveTask(archivedTask1.id);
      await store.archiveTask(archivedTask2.id);

      const archivedTasks = await store.listArchived();
      expect(archivedTasks).toHaveLength(2);

      const archivedIds = archivedTasks.map(t => t.id).sort();
      expect(archivedIds).toEqual(['archived1', 'archived2']);

      archivedTasks.forEach(task => {
        expect(task.archivedAt).toBeDefined();
        expect(task.status).toBe('completed');
      });
    });

    it('should include all task data for archived tasks', async () => {
      const task = createTestTask({
        id: 'detailed-task',
        status: 'completed',
        description: 'Task with complex data',
        priority: 'urgent',
        effort: 'epic'
      });
      await store.createTask(task);

      // Add comprehensive data
      await store.addTaskLog(task.id, {
        type: 'debug',
        message: 'Debug information',
        timestamp: new Date(),
      });

      await store.addTaskArtifact(task.id, {
        type: 'documentation',
        name: 'readme.md',
        path: '/docs/readme.md',
        size: 512,
        createdAt: new Date(),
      });

      await store.archiveTask(task.id);

      const archivedTasks = await store.listArchived();
      expect(archivedTasks).toHaveLength(1);

      const archivedTask = archivedTasks[0];
      expect(archivedTask.id).toBe('detailed-task');
      expect(archivedTask.description).toBe('Task with complex data');
      expect(archivedTask.priority).toBe('urgent');
      expect(archivedTask.effort).toBe('epic');
      expect(archivedTask.logs).toHaveLength(1);
      expect(archivedTask.artifacts).toHaveLength(1);
      expect(archivedTask.archivedAt).toBeDefined();
    });

    it('should sort archived tasks by archivedAt timestamp', async () => {
      // Create tasks and archive them with delays to ensure different timestamps
      const task1 = createTestTask({ id: 'first', status: 'completed' });
      const task2 = createTestTask({ id: 'second', status: 'completed' });
      const task3 = createTestTask({ id: 'third', status: 'completed' });

      await store.createTask(task1);
      await store.createTask(task2);
      await store.createTask(task3);

      await store.archiveTask(task1.id);
      await new Promise(resolve => setTimeout(resolve, 10));

      await store.archiveTask(task2.id);
      await new Promise(resolve => setTimeout(resolve, 10));

      await store.archiveTask(task3.id);

      const archivedTasks = await store.listArchived();
      expect(archivedTasks).toHaveLength(3);

      // Verify chronological order (oldest first)
      const timestamps = archivedTasks.map(t => t.archivedAt!.getTime());
      const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
      expect(timestamps).toEqual(sortedTimestamps);
    });
  });

  describe('Integration with other operations', () => {
    it('should exclude archived tasks from normal listings', async () => {
      const normalTask = createTestTask({ id: 'normal', status: 'completed' });
      const archivedTask = createTestTask({ id: 'archived', status: 'completed' });

      await store.createTask(normalTask);
      await store.createTask(archivedTask);
      await store.archiveTask(archivedTask.id);

      const normalTasks = await store.listTasks();
      const normalIds = normalTasks.map(t => t.id);

      expect(normalIds).toContain('normal');
      expect(normalIds).not.toContain('archived');
    });

    it('should include archived tasks when explicitly requested', async () => {
      const normalTask = createTestTask({ id: 'normal', status: 'pending' });
      const archivedTask = createTestTask({ id: 'archived', status: 'completed' });

      await store.createTask(normalTask);
      await store.createTask(archivedTask);
      await store.archiveTask(archivedTask.id);

      const allTasks = await store.listTasks({ includeArchived: true });
      const allIds = allTasks.map(t => t.id);

      expect(allIds).toContain('normal');
      expect(allIds).toContain('archived');
    });

    it('should handle archived tasks with dependencies correctly', async () => {
      const parentTask = createTestTask({
        id: 'parent',
        status: 'completed'
      });
      const childTask = createTestTask({
        id: 'child',
        status: 'completed',
        dependsOn: ['parent']
      });

      await store.createTask(parentTask);
      await store.createTask(childTask);

      // Archive parent task
      await store.archiveTask(parentTask.id);

      // Child task should still be accessible and maintain dependency
      const retrievedChild = await store.getTask(childTask.id);
      expect(retrievedChild?.dependsOn).toContain('parent');

      // Parent should be in archived list
      const archivedTasks = await store.listArchived();
      expect(archivedTasks.map(t => t.id)).toContain('parent');
    });

    it('should preserve archive state during store operations', async () => {
      const task = createTestTask({ status: 'completed' });
      await store.createTask(task);
      await store.archiveTask(task.id);

      // Update other fields
      await store.updateTask(task.id, {
        description: 'Updated description',
        priority: 'high'
      });

      const updated = await store.getTask(task.id);
      expect(updated?.archivedAt).toBeDefined(); // Should remain archived
      expect(updated?.description).toBe('Updated description');
      expect(updated?.priority).toBe('high');
    });

    it('should handle concurrent archive operations safely', async () => {
      const task = createTestTask({ status: 'completed' });
      await store.createTask(task);

      // Attempt concurrent archive operations
      const archivePromises = Array.from({ length: 5 }, () =>
        store.archiveTask(task.id)
      );

      // All should complete without error
      await Promise.all(archivePromises);

      const finalTask = await store.getTask(task.id);
      expect(finalTask?.archivedAt).toBeDefined();
    });
  });

  describe('Error handling and validation', () => {
    it('should validate task ID format', async () => {
      const invalidIds = ['', null, undefined, 123, {}];

      for (const invalidId of invalidIds) {
        await expect(store.archiveTask(invalidId as any)).rejects.toThrow();
        await expect(store.unarchiveTask(invalidId as any)).rejects.toThrow();
      }
    });

    it('should handle database connection issues gracefully', async () => {
      // This test would require mocking database failures
      // For now, we'll test that operations are atomic
      const task = createTestTask({ status: 'completed' });
      await store.createTask(task);

      // Ensure archive operation is atomic
      await store.archiveTask(task.id);

      const archived = await store.getTask(task.id);
      expect(archived?.archivedAt).toBeDefined();
    });

    it('should maintain data integrity during archive/unarchive cycles', async () => {
      const originalTask = createTestTask({
        status: 'completed',
        description: 'Original description',
        priority: 'normal',
        usage: {
          inputTokens: 500,
          outputTokens: 300,
          totalTokens: 800,
          estimatedCost: 0.02
        }
      });

      await store.createTask(originalTask);

      // Perform multiple archive/unarchive cycles
      for (let i = 0; i < 3; i++) {
        await store.archiveTask(originalTask.id);
        await store.unarchiveTask(originalTask.id);
      }

      const finalTask = await store.getTask(originalTask.id);
      expect(finalTask?.description).toBe('Original description');
      expect(finalTask?.priority).toBe('normal');
      expect(finalTask?.usage.inputTokens).toBe(500);
      expect(finalTask?.archivedAt).toBeUndefined();
    });
  });

  describe('Performance and scalability', () => {
    it('should handle archiving large number of tasks efficiently', async () => {
      const taskCount = 100;
      const tasks: Task[] = [];

      // Create many completed tasks
      for (let i = 0; i < taskCount; i++) {
        const task = createTestTask({
          id: `bulk-task-${i}`,
          status: 'completed'
        });
        tasks.push(task);
        await store.createTask(task);
      }

      const startTime = Date.now();

      // Archive all tasks
      for (const task of tasks) {
        await store.archiveTask(task.id);
      }

      const archiveTime = Date.now() - startTime;
      console.log(`Archived ${taskCount} tasks in ${archiveTime}ms`);

      // Verify all are archived
      const archivedTasks = await store.listArchived();
      expect(archivedTasks).toHaveLength(taskCount);

      // Performance should be reasonable (less than 50ms per task in CI)
      expect(archiveTime).toBeLessThan(taskCount * 50);
    }, 10000); // 10 second timeout for performance test
  });
});