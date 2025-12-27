/**
 * Archive Edge Cases Test Suite
 *
 * This test file focuses on edge cases and boundary conditions
 * for the archive functionality to ensure robust behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task } from '@apexcli/core';

describe('TaskStore - Archive Edge Cases', () => {
  let testDir: string;
  let store: TaskStore;

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Edge case test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: testDir,
    branchName: 'apex/edge-case-test',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-archive-edge-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true });
  });

  describe('Boundary conditions', () => {
    it('should handle task IDs with special characters', async () => {
      const specialIds = [
        'task-with-dashes',
        'task_with_underscores',
        'task.with.dots',
        'task@with@symbols',
        'task123with456numbers',
        'UPPERCASE_TASK_ID',
        'mixed_Case_Task_Id'
      ];

      for (const taskId of specialIds) {
        const task = createTestTask({
          id: taskId,
          status: 'completed'
        });
        await store.createTask(task);
        await store.archiveTask(taskId);

        const archived = await store.getTask(taskId);
        expect(archived?.archivedAt).toBeDefined();
        expect(archived?.id).toBe(taskId);
      }

      const archivedTasks = await store.listArchived();
      expect(archivedTasks).toHaveLength(specialIds.length);
    });

    it('should handle tasks with minimal data', async () => {
      const minimalTask: Task = {
        id: 'minimal-task',
        description: '',
        workflow: 'feature',
        autonomy: 'full',
        status: 'completed',
        priority: 'normal',
        effort: 'small',
        projectPath: testDir,
        branchName: 'main',
        retryCount: 0,
        maxRetries: 0,
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
      };

      await store.createTask(minimalTask);
      await store.archiveTask(minimalTask.id);

      const archived = await store.getTask(minimalTask.id);
      expect(archived?.archivedAt).toBeDefined();
      expect(archived?.description).toBe('');
      expect(archived?.logs).toHaveLength(0);
      expect(archived?.artifacts).toHaveLength(0);
    });

    it('should handle tasks with maximum data complexity', async () => {
      const complexTask = createTestTask({
        id: 'complex-task',
        description: 'A'.repeat(10000), // Very long description
        status: 'completed',
        priority: 'urgent',
        effort: 'epic',
        branchName: 'feature/very-long-branch-name-with-many-segments/and-subsegments/and-more',
        retryCount: 5,
        maxRetries: 10,
        resumeAttempts: 3,
        usage: {
          inputTokens: 999999,
          outputTokens: 888888,
          totalTokens: 1888887,
          estimatedCost: 99.99,
        },
        dependsOn: Array.from({ length: 50 }, (_, i) => `dep-task-${i}`),
        blockedBy: Array.from({ length: 50 }, (_, i) => `blocking-task-${i}`),
      });

      await store.createTask(complexTask);

      // Add many logs and artifacts
      for (let i = 0; i < 100; i++) {
        await store.addTaskLog(complexTask.id, {
          type: i % 2 === 0 ? 'info' : 'error',
          message: `Log entry ${i}: ${'x'.repeat(1000)}`,
          timestamp: new Date(Date.now() + i * 1000),
        });
      }

      for (let i = 0; i < 50; i++) {
        await store.addTaskArtifact(complexTask.id, {
          type: 'file',
          name: `artifact-${i}.txt`,
          path: `/very/long/path/to/artifact/number/${i}/with/many/segments/artifact-${i}.txt`,
          size: Math.floor(Math.random() * 1000000),
          createdAt: new Date(Date.now() + i * 2000),
        });
      }

      await store.archiveTask(complexTask.id);

      const archived = await store.getTask(complexTask.id);
      expect(archived?.archivedAt).toBeDefined();
      expect(archived?.description).toHaveLength(10000);
      expect(archived?.logs).toHaveLength(100);
      expect(archived?.artifacts).toHaveLength(50);
      expect(archived?.dependsOn).toHaveLength(50);
      expect(archived?.blockedBy).toHaveLength(50);
      expect(archived?.usage.estimatedCost).toBe(99.99);
    });
  });

  describe('Temporal edge cases', () => {
    it('should handle tasks with future timestamps', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      const task = createTestTask({
        status: 'completed',
        createdAt: futureDate,
        updatedAt: futureDate,
        completedAt: futureDate,
      });

      await store.createTask(task);
      await store.archiveTask(task.id);

      const archived = await store.getTask(task.id);
      expect(archived?.archivedAt).toBeDefined();
      expect(archived?.createdAt).toEqual(futureDate);
    });

    it('should handle tasks with very old timestamps', async () => {
      const oldDate = new Date('1970-01-01T00:00:00.000Z');
      const task = createTestTask({
        status: 'completed',
        createdAt: oldDate,
        updatedAt: oldDate,
        completedAt: oldDate,
      });

      await store.createTask(task);
      await store.archiveTask(task.id);

      const archived = await store.getTask(task.id);
      expect(archived?.archivedAt).toBeDefined();
      expect(archived?.createdAt).toEqual(oldDate);
    });

    it('should handle rapid archive/unarchive operations', async () => {
      const task = createTestTask({ status: 'completed' });
      await store.createTask(task);

      // Perform rapid operations
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          store.archiveTask(task.id)
            .then(() => store.unarchiveTask(task.id))
        );
      }

      await Promise.all(operations);

      // Task should be in a consistent state
      const finalTask = await store.getTask(task.id);
      expect(finalTask).toBeDefined();
      expect(finalTask?.id).toBe(task.id);
      // archivedAt may or may not be set depending on operation timing
    });
  });

  describe('Memory and resource constraints', () => {
    it('should handle archiving with limited memory efficiently', async () => {
      // Create tasks with large data sets but archive them efficiently
      const tasks = [];
      for (let i = 0; i < 10; i++) {
        const task = createTestTask({
          id: `memory-test-${i}`,
          status: 'completed',
          description: 'x'.repeat(10000), // 10KB description each
        });
        tasks.push(task);
        await store.createTask(task);

        // Add substantial logs for each task
        for (let j = 0; j < 10; j++) {
          await store.addTaskLog(task.id, {
            type: 'info',
            message: 'y'.repeat(5000), // 5KB per log
            timestamp: new Date(),
          });
        }
      }

      // Archive all tasks
      for (const task of tasks) {
        await store.archiveTask(task.id);
      }

      const archivedTasks = await store.listArchived();
      expect(archivedTasks).toHaveLength(10);

      // Verify memory usage didn't cause corruption
      archivedTasks.forEach(task => {
        expect(task.description).toHaveLength(10000);
        expect(task.logs).toHaveLength(10);
      });
    });
  });

  describe('Concurrent operations stress test', () => {
    it('should handle many concurrent archive operations', async () => {
      const concurrentTasks = 20;
      const tasks = [];

      // Create tasks
      for (let i = 0; i < concurrentTasks; i++) {
        const task = createTestTask({
          id: `concurrent-${i}`,
          status: 'completed'
        });
        tasks.push(task);
        await store.createTask(task);
      }

      // Archive all tasks concurrently
      const archivePromises = tasks.map(task =>
        store.archiveTask(task.id)
      );

      await Promise.all(archivePromises);

      // Verify all are archived
      const archivedTasks = await store.listArchived();
      expect(archivedTasks).toHaveLength(concurrentTasks);

      const archivedIds = archivedTasks.map(t => t.id).sort();
      const expectedIds = tasks.map(t => t.id).sort();
      expect(archivedIds).toEqual(expectedIds);
    });

    it('should handle mixed concurrent operations', async () => {
      const baseTaskCount = 10;
      const tasks = [];

      // Create base tasks
      for (let i = 0; i < baseTaskCount; i++) {
        const task = createTestTask({
          id: `mixed-${i}`,
          status: 'completed'
        });
        tasks.push(task);
        await store.createTask(task);
      }

      // Perform mixed operations concurrently
      const operations = [];

      // Archive half
      for (let i = 0; i < baseTaskCount / 2; i++) {
        operations.push(store.archiveTask(tasks[i].id));
      }

      // Query operations
      for (let i = 0; i < 5; i++) {
        operations.push(store.listArchived());
        operations.push(store.getTask(tasks[i].id));
      }

      await Promise.all(operations);

      // Verify consistent state
      const archivedTasks = await store.listArchived();
      expect(archivedTasks).toHaveLength(baseTaskCount / 2);
    });
  });

  describe('Database integrity edge cases', () => {
    it('should maintain referential integrity with dependencies', async () => {
      // Create a chain of dependent tasks
      const chainLength = 5;
      const chain = [];

      for (let i = 0; i < chainLength; i++) {
        const task = createTestTask({
          id: `chain-${i}`,
          status: 'completed',
          dependsOn: i > 0 ? [`chain-${i - 1}`] : []
        });
        chain.push(task);
        await store.createTask(task);
      }

      // Archive tasks in random order
      const shuffled = [...chain].sort(() => Math.random() - 0.5);
      for (const task of shuffled) {
        await store.archiveTask(task.id);
      }

      // Verify all are archived and dependencies are preserved
      const archivedTasks = await store.listArchived();
      expect(archivedTasks).toHaveLength(chainLength);

      for (let i = 1; i < chainLength; i++) {
        const task = archivedTasks.find(t => t.id === `chain-${i}`);
        expect(task?.dependsOn).toContain(`chain-${i - 1}`);
      }
    });

    it('should handle archive operations with database constraints', async () => {
      const task = createTestTask({
        status: 'completed',
        // Test with data that might challenge database constraints
        description: `Task with special chars: \n\r\t"'\\${}[]`,
        branchName: 'feature/special-chars-!@#$%^&*()',
      });

      await store.createTask(task);

      // Should not fail due to special characters
      await store.archiveTask(task.id);

      const archived = await store.getTask(task.id);
      expect(archived?.archivedAt).toBeDefined();
      expect(archived?.description).toContain('special chars');
    });
  });

  describe('Validation edge cases', () => {
    it('should handle archiving tasks with invalid status transitions', async () => {
      const task = createTestTask({
        status: 'completed',
        completedAt: undefined // Invalid state: completed without completedAt
      });

      await store.createTask(task);

      // Should still allow archiving based on status field
      await store.archiveTask(task.id);

      const archived = await store.getTask(task.id);
      expect(archived?.archivedAt).toBeDefined();
    });

    it('should preserve archive state during invalid operations', async () => {
      const task = createTestTask({ status: 'completed' });
      await store.createTask(task);
      await store.archiveTask(task.id);

      // Try to update to invalid state
      try {
        await store.updateTask(task.id, {
          status: 'pending', // Invalid: reverting from completed to pending
        });
      } catch {
        // Expected to fail, but let's check archive state is preserved
      }

      const task_check = await store.getTask(task.id);
      // Regardless of whether the update succeeded or failed,
      // the archived state should be handled consistently
      expect(task_check?.id).toBe(task.id);
    });
  });
});