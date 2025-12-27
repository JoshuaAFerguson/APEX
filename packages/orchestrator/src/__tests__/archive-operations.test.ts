import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index.js';
import { Task } from '@apexcli/core';

describe('ApexOrchestrator Archive Operations', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-archive-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    // Create basic config files
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `
project:
  name: "Archive Test Project"
agents: {}
workflows: {}
`
    );

    orchestrator = new ApexOrchestrator();
    await orchestrator.initialize(testDir);
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.close();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('archiveTask', () => {
    it('should successfully archive a completed task', async () => {
      // Create a task
      const task = await orchestrator.createTask({
        description: 'Test task for archiving',
        workflow: 'feature',
        acceptanceCriteria: 'Should be archivable when completed',
      });

      // Mark task as completed
      await orchestrator.updateTaskStatus(task.id, 'completed');

      // Set up event listener
      let archivedTaskEvent: Task | null = null;
      orchestrator.on('task:archived', (archivedTask) => {
        archivedTaskEvent = archivedTask;
      });

      // Archive the task
      await orchestrator.archiveTask(task.id);

      // Verify the archived task event was emitted
      expect(archivedTaskEvent).not.toBeNull();
      expect(archivedTaskEvent!.id).toBe(task.id);
      expect(archivedTaskEvent!.archivedAt).toBeInstanceOf(Date);

      // Verify task is archived
      const archivedTask = await orchestrator.getTask(task.id);
      expect(archivedTask).not.toBeNull();
      expect(archivedTask!.archivedAt).toBeInstanceOf(Date);

      // Verify task doesn't appear in regular task list
      const allTasks = await orchestrator.listTasks();
      expect(allTasks.find(t => t.id === task.id)).toBeUndefined();

      // Verify task appears in archived list
      const archivedTasks = await orchestrator.listArchivedTasks();
      expect(archivedTasks.find(t => t.id === task.id)).toBeDefined();
    });

    it('should throw error when trying to archive non-completed task', async () => {
      // Create a pending task
      const task = await orchestrator.createTask({
        description: 'Pending task that cannot be archived',
        workflow: 'feature',
      });

      // Try to archive pending task - should fail
      await expect(
        orchestrator.archiveTask(task.id)
      ).rejects.toThrow('Cannot archive task');
    });

    it('should throw error when trying to archive non-existent task', async () => {
      await expect(
        orchestrator.archiveTask('non-existent-task-id')
      ).rejects.toThrow('Task with ID non-existent-task-id not found');
    });

    it('should handle different completed task statuses', async () => {
      const task = await orchestrator.createTask({
        description: 'Task to test completed status archiving',
        workflow: 'bugfix',
      });

      // Mark task as completed
      await orchestrator.updateTaskStatus(task.id, 'completed');

      // Archive should succeed
      await expect(orchestrator.archiveTask(task.id)).resolves.not.toThrow();
    });

    it('should prevent archiving tasks with failed status', async () => {
      const task = await orchestrator.createTask({
        description: 'Failed task that cannot be archived',
        workflow: 'feature',
      });

      // Mark task as failed
      await orchestrator.updateTaskStatus(task.id, 'failed', 'Test failure');

      // Archive should fail
      await expect(
        orchestrator.archiveTask(task.id)
      ).rejects.toThrow('Cannot archive task');
    });

    it('should prevent archiving tasks with cancelled status', async () => {
      const task = await orchestrator.createTask({
        description: 'Cancelled task that cannot be archived',
        workflow: 'feature',
      });

      // Cancel task
      await orchestrator.cancelTask(task.id);

      // Archive should fail
      await expect(
        orchestrator.archiveTask(task.id)
      ).rejects.toThrow('Cannot archive task');
    });

    it('should preserve task metadata when archiving', async () => {
      const task = await orchestrator.createTask({
        description: 'Task with metadata to preserve',
        workflow: 'feature',
        acceptanceCriteria: 'Should preserve all metadata',
        priority: 'high',
        effort: 'large',
      });

      // Mark task as completed
      await orchestrator.updateTaskStatus(task.id, 'completed');

      // Archive the task
      await orchestrator.archiveTask(task.id);

      // Get archived task and verify metadata is preserved
      const archivedTask = await orchestrator.getTask(task.id);
      expect(archivedTask).not.toBeNull();
      expect(archivedTask!.description).toBe(task.description);
      expect(archivedTask!.workflow).toBe(task.workflow);
      expect(archivedTask!.acceptanceCriteria).toBe(task.acceptanceCriteria);
      expect(archivedTask!.priority).toBe(task.priority);
      expect(archivedTask!.effort).toBe(task.effort);
      expect(archivedTask!.status).toBe('completed');
    });
  });

  describe('listArchivedTasks', () => {
    it('should return empty array when no tasks are archived', async () => {
      const archivedTasks = await orchestrator.listArchivedTasks();
      expect(archivedTasks).toEqual([]);
    });

    it('should return all archived tasks', async () => {
      // Create multiple tasks
      const tasks = await Promise.all([
        orchestrator.createTask({
          description: 'First task to archive',
          workflow: 'feature',
        }),
        orchestrator.createTask({
          description: 'Second task to archive',
          workflow: 'bugfix',
        }),
        orchestrator.createTask({
          description: 'Third task to archive',
          workflow: 'docs',
        }),
      ]);

      // Complete and archive all tasks
      for (const task of tasks) {
        await orchestrator.updateTaskStatus(task.id, 'completed');
        await orchestrator.archiveTask(task.id);
      }

      // Get archived tasks
      const archivedTasks = await orchestrator.listArchivedTasks();
      expect(archivedTasks).toHaveLength(3);

      // Verify all archived tasks are in the list
      const archivedIds = archivedTasks.map(t => t.id);
      for (const task of tasks) {
        expect(archivedIds).toContain(task.id);
      }

      // Verify all have archivedAt timestamp
      for (const archivedTask of archivedTasks) {
        expect(archivedTask.archivedAt).toBeInstanceOf(Date);
      }
    });

    it('should not return non-archived tasks', async () => {
      // Create some completed but not archived tasks
      const completedTask = await orchestrator.createTask({
        description: 'Completed but not archived',
        workflow: 'feature',
      });
      await orchestrator.updateTaskStatus(completedTask.id, 'completed');

      // Create and archive one task
      const archivedTask = await orchestrator.createTask({
        description: 'This will be archived',
        workflow: 'feature',
      });
      await orchestrator.updateTaskStatus(archivedTask.id, 'completed');
      await orchestrator.archiveTask(archivedTask.id);

      // List archived tasks should only return archived one
      const archivedTasks = await orchestrator.listArchivedTasks();
      expect(archivedTasks).toHaveLength(1);
      expect(archivedTasks[0].id).toBe(archivedTask.id);
    });

    it('should handle concurrent calls to listArchivedTasks', async () => {
      // Create and archive a task
      const task = await orchestrator.createTask({
        description: 'Concurrent test task',
        workflow: 'feature',
      });
      await orchestrator.updateTaskStatus(task.id, 'completed');
      await orchestrator.archiveTask(task.id);

      // Make multiple concurrent calls
      const promises = Array.from({ length: 10 }, () => orchestrator.listArchivedTasks());
      const results = await Promise.all(promises);

      // All results should be identical
      const firstResult = results[0];
      for (const result of results.slice(1)) {
        expect(result).toEqual(firstResult);
      }
    });
  });

  describe('unarchiveTask', () => {
    it('should successfully unarchive an archived task', async () => {
      // Create and archive a task
      const task = await orchestrator.createTask({
        description: 'Task to archive and unarchive',
        workflow: 'feature',
      });
      await orchestrator.updateTaskStatus(task.id, 'completed');
      await orchestrator.archiveTask(task.id);

      // Set up event listener
      let unarchivedTaskEvent: Task | null = null;
      orchestrator.on('task:unarchived', (unarchivedTask) => {
        unarchivedTaskEvent = unarchivedTask;
      });

      // Unarchive the task
      await orchestrator.unarchiveTask(task.id);

      // Verify the unarchived task event was emitted
      expect(unarchivedTaskEvent).not.toBeNull();
      expect(unarchivedTaskEvent!.id).toBe(task.id);
      expect(unarchivedTaskEvent!.archivedAt).toBeUndefined();

      // Verify task is no longer archived
      const unarchivedTask = await orchestrator.getTask(task.id);
      expect(unarchivedTask).not.toBeNull();
      expect(unarchivedTask!.archivedAt).toBeUndefined();

      // Verify task appears in regular task list again
      const allTasks = await orchestrator.listTasks();
      expect(allTasks.find(t => t.id === task.id)).toBeDefined();

      // Verify task no longer appears in archived list
      const archivedTasks = await orchestrator.listArchivedTasks();
      expect(archivedTasks.find(t => t.id === task.id)).toBeUndefined();
    });

    it('should throw error when trying to unarchive non-archived task', async () => {
      // Create a completed but not archived task
      const task = await orchestrator.createTask({
        description: 'Non-archived task',
        workflow: 'feature',
      });
      await orchestrator.updateTaskStatus(task.id, 'completed');

      // Try to unarchive - should fail
      await expect(
        orchestrator.unarchiveTask(task.id)
      ).rejects.toThrow('Task task_');
    });

    it('should throw error when trying to unarchive non-existent task', async () => {
      await expect(
        orchestrator.unarchiveTask('non-existent-task-id')
      ).rejects.toThrow('Task with ID non-existent-task-id not found');
    });

    it('should preserve task status as completed after unarchiving', async () => {
      // Create, complete, and archive a task
      const task = await orchestrator.createTask({
        description: 'Task to test status preservation',
        workflow: 'feature',
      });
      await orchestrator.updateTaskStatus(task.id, 'completed');
      await orchestrator.archiveTask(task.id);

      // Unarchive the task
      await orchestrator.unarchiveTask(task.id);

      // Verify task is still completed
      const unarchivedTask = await orchestrator.getTask(task.id);
      expect(unarchivedTask).not.toBeNull();
      expect(unarchivedTask!.status).toBe('completed');
    });

    it('should preserve all task metadata after unarchiving', async () => {
      const task = await orchestrator.createTask({
        description: 'Task with metadata to preserve during unarchiving',
        workflow: 'feature',
        acceptanceCriteria: 'Should preserve all metadata',
        priority: 'urgent',
        effort: 'xl',
      });

      // Complete and archive
      await orchestrator.updateTaskStatus(task.id, 'completed');
      await orchestrator.archiveTask(task.id);

      // Unarchive
      await orchestrator.unarchiveTask(task.id);

      // Verify all metadata is preserved
      const unarchivedTask = await orchestrator.getTask(task.id);
      expect(unarchivedTask).not.toBeNull();
      expect(unarchivedTask!.description).toBe(task.description);
      expect(unarchivedTask!.workflow).toBe(task.workflow);
      expect(unarchivedTask!.acceptanceCriteria).toBe(task.acceptanceCriteria);
      expect(unarchivedTask!.priority).toBe(task.priority);
      expect(unarchivedTask!.effort).toBe(task.effort);
    });

    it('should handle double unarchive gracefully', async () => {
      // Create and archive a task
      const task = await orchestrator.createTask({
        description: 'Task for double unarchive test',
        workflow: 'feature',
      });
      await orchestrator.updateTaskStatus(task.id, 'completed');
      await orchestrator.archiveTask(task.id);

      // First unarchive should succeed
      await orchestrator.unarchiveTask(task.id);

      // Second unarchive should fail gracefully
      await expect(
        orchestrator.unarchiveTask(task.id)
      ).rejects.toThrow('is not archived');
    });
  });

  describe('Archive workflow integration', () => {
    it('should support archive/unarchive cycle multiple times', async () => {
      const task = await orchestrator.createTask({
        description: 'Task for multiple archive cycles',
        workflow: 'feature',
      });
      await orchestrator.updateTaskStatus(task.id, 'completed');

      // First archive cycle
      await orchestrator.archiveTask(task.id);
      let archivedTasks = await orchestrator.listArchivedTasks();
      expect(archivedTasks).toHaveLength(1);

      await orchestrator.unarchiveTask(task.id);
      archivedTasks = await orchestrator.listArchivedTasks();
      expect(archivedTasks).toHaveLength(0);

      // Second archive cycle
      await orchestrator.archiveTask(task.id);
      archivedTasks = await orchestrator.listArchivedTasks();
      expect(archivedTasks).toHaveLength(1);

      await orchestrator.unarchiveTask(task.id);
      archivedTasks = await orchestrator.listArchivedTasks();
      expect(archivedTasks).toHaveLength(0);
    });

    it('should maintain archive separation from regular task operations', async () => {
      // Create multiple tasks
      const tasks = await Promise.all([
        orchestrator.createTask({
          description: 'Task 1',
          workflow: 'feature',
        }),
        orchestrator.createTask({
          description: 'Task 2',
          workflow: 'feature',
        }),
        orchestrator.createTask({
          description: 'Task 3',
          workflow: 'feature',
        }),
      ]);

      // Complete all tasks
      for (const task of tasks) {
        await orchestrator.updateTaskStatus(task.id, 'completed');
      }

      // Archive first task
      await orchestrator.archiveTask(tasks[0].id);

      // Verify task counts
      const allTasks = await orchestrator.listTasks();
      const archivedTasks = await orchestrator.listArchivedTasks();

      expect(allTasks).toHaveLength(2); // 2 completed, not archived
      expect(archivedTasks).toHaveLength(1); // 1 archived

      // Unarchive and verify counts again
      await orchestrator.unarchiveTask(tasks[0].id);

      const allTasksAfter = await orchestrator.listTasks();
      const archivedTasksAfter = await orchestrator.listArchivedTasks();

      expect(allTasksAfter).toHaveLength(3); // All 3 back in regular list
      expect(archivedTasksAfter).toHaveLength(0); // None archived
    });

    it('should handle concurrent archive operations', async () => {
      // Create multiple completed tasks
      const tasks = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          orchestrator.createTask({
            description: `Concurrent test task ${i + 1}`,
            workflow: 'feature',
          })
        )
      );

      // Complete all tasks
      for (const task of tasks) {
        await orchestrator.updateTaskStatus(task.id, 'completed');
      }

      // Archive all tasks concurrently
      await Promise.all(tasks.map(task => orchestrator.archiveTask(task.id)));

      // Verify all are archived
      const archivedTasks = await orchestrator.listArchivedTasks();
      expect(archivedTasks).toHaveLength(5);

      // Unarchive all tasks concurrently
      await Promise.all(tasks.map(task => orchestrator.unarchiveTask(task.id)));

      // Verify none are archived
      const archivedTasksAfter = await orchestrator.listArchivedTasks();
      expect(archivedTasksAfter).toHaveLength(0);

      // Verify all are back in regular list
      const allTasks = await orchestrator.listTasks();
      expect(allTasks).toHaveLength(5);
    });
  });

  describe('Event emissions', () => {
    it('should emit task:archived event with correct data', async () => {
      const task = await orchestrator.createTask({
        description: 'Event test task',
        workflow: 'feature',
      });
      await orchestrator.updateTaskStatus(task.id, 'completed');

      let eventEmitted = false;
      let eventTask: Task | null = null;

      orchestrator.on('task:archived', (archivedTask) => {
        eventEmitted = true;
        eventTask = archivedTask;
      });

      await orchestrator.archiveTask(task.id);

      expect(eventEmitted).toBe(true);
      expect(eventTask).not.toBeNull();
      expect(eventTask!.id).toBe(task.id);
      expect(eventTask!.archivedAt).toBeInstanceOf(Date);
    });

    it('should emit task:unarchived event with correct data', async () => {
      const task = await orchestrator.createTask({
        description: 'Unarchive event test task',
        workflow: 'feature',
      });
      await orchestrator.updateTaskStatus(task.id, 'completed');
      await orchestrator.archiveTask(task.id);

      let eventEmitted = false;
      let eventTask: Task | null = null;

      orchestrator.on('task:unarchived', (unarchivedTask) => {
        eventEmitted = true;
        eventTask = unarchivedTask;
      });

      await orchestrator.unarchiveTask(task.id);

      expect(eventEmitted).toBe(true);
      expect(eventTask).not.toBeNull();
      expect(eventTask!.id).toBe(task.id);
      expect(eventTask!.archivedAt).toBeUndefined();
    });

    it('should not emit events on archive/unarchive failures', async () => {
      const task = await orchestrator.createTask({
        description: 'Failure event test task',
        workflow: 'feature',
      });
      // Leave task pending (not completed)

      let archivedEventEmitted = false;
      let unarchivedEventEmitted = false;

      orchestrator.on('task:archived', () => {
        archivedEventEmitted = true;
      });

      orchestrator.on('task:unarchived', () => {
        unarchivedEventEmitted = true;
      });

      // Try to archive pending task - should fail
      await expect(orchestrator.archiveTask(task.id)).rejects.toThrow();
      expect(archivedEventEmitted).toBe(false);

      // Try to unarchive non-archived task - should fail
      await expect(orchestrator.unarchiveTask(task.id)).rejects.toThrow();
      expect(unarchivedEventEmitted).toBe(false);
    });
  });
});