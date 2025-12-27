import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index.js';
import { Task } from '@apexcli/core';

describe('ApexOrchestrator.restoreTask', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-restore-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    // Create basic config files
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `
project:
  name: "RestoreTask Test Project"
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

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_${Math.random()}`,
    description: 'Test task for restore functionality',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: testDir,
    branchName: `apex/test-${Date.now()}`,
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
  });

  describe('Valid restoreTask Operations', () => {
    it('should successfully restore a trashed task', async () => {
      // Create and trash a task
      const task = createTestTask();
      await orchestrator.store.createTask(task);
      await orchestrator.store.moveToTrash(task.id);

      // Verify task is trashed
      const trashedTask = await orchestrator.store.getTask(task.id);
      expect(trashedTask?.trashedAt).toBeDefined();

      // Restore the task
      await orchestrator.restoreTask(task.id);

      // Verify task is restored
      const restoredTask = await orchestrator.store.getTask(task.id);
      expect(restoredTask?.trashedAt).toBeNull();
      expect(restoredTask?.status).toBe('pending');
      expect(restoredTask?.id).toBe(task.id);
    });

    it('should emit task:restored event with restored task', async () => {
      const eventSpy = vi.fn();
      orchestrator.on('task:restored', eventSpy);

      // Create and trash a task
      const task = createTestTask();
      await orchestrator.store.createTask(task);
      await orchestrator.store.moveToTrash(task.id);

      // Restore the task
      await orchestrator.restoreTask(task.id);

      // Verify event was emitted with correct task
      expect(eventSpy).toHaveBeenCalledTimes(1);
      const emittedTask = eventSpy.mock.calls[0][0];
      expect(emittedTask.id).toBe(task.id);
      expect(emittedTask.trashedAt).toBeNull();
    });

    it('should restore task to default pending status', async () => {
      // Create a task with completed status and trash it
      const task = createTestTask();
      task.status = 'completed';
      await orchestrator.store.createTask(task);
      await orchestrator.store.moveToTrash(task.id);

      // Restore the task
      await orchestrator.restoreTask(task.id);

      // Verify task status is reset to pending
      const restoredTask = await orchestrator.store.getTask(task.id);
      expect(restoredTask?.status).toBe('pending');
    });
  });

  describe('Error Conditions', () => {
    it('should throw error when task does not exist', async () => {
      const nonExistentTaskId = 'non-existent-task-id';

      await expect(orchestrator.restoreTask(nonExistentTaskId))
        .rejects
        .toThrow(`Task with ID ${nonExistentTaskId} not found`);
    });

    it('should throw error when task is not in trash', async () => {
      // Create a task but don't trash it
      const task = createTestTask();
      await orchestrator.store.createTask(task);

      await expect(orchestrator.restoreTask(task.id))
        .rejects
        .toThrow(`Task with ID ${task.id} is not in trash`);
    });

    it('should handle empty taskId gracefully', async () => {
      await expect(orchestrator.restoreTask(''))
        .rejects
        .toThrow('Task with ID  not found');
    });

    it('should handle null/undefined taskId', async () => {
      // @ts-ignore - Testing runtime behavior
      await expect(orchestrator.restoreTask(null))
        .rejects
        .toThrow();

      // @ts-ignore - Testing runtime behavior
      await expect(orchestrator.restoreTask(undefined))
        .rejects
        .toThrow();
    });
  });

  describe('Integration with Store Methods', () => {
    it('should call store.restoreFromTrash method', async () => {
      const restoreFromTrashSpy = vi.spyOn(orchestrator.store, 'restoreFromTrash');

      // Create and trash a task
      const task = createTestTask();
      await orchestrator.store.createTask(task);
      await orchestrator.store.moveToTrash(task.id);

      // Restore the task
      await orchestrator.restoreTask(task.id);

      // Verify store method was called
      expect(restoreFromTrashSpy).toHaveBeenCalledWith(task.id);
      expect(restoreFromTrashSpy).toHaveBeenCalledTimes(1);

      restoreFromTrashSpy.mockRestore();
    });

    it('should handle store errors gracefully', async () => {
      // Create and trash a task
      const task = createTestTask();
      await orchestrator.store.createTask(task);
      await orchestrator.store.moveToTrash(task.id);

      // Mock store.restoreFromTrash to throw error
      const restoreFromTrashSpy = vi.spyOn(orchestrator.store, 'restoreFromTrash')
        .mockRejectedValue(new Error('Store error'));

      await expect(orchestrator.restoreTask(task.id))
        .rejects
        .toThrow('Store error');

      restoreFromTrashSpy.mockRestore();
    });
  });

  describe('Event Emission Edge Cases', () => {
    it('should handle case where task is deleted between restore and event emission', async () => {
      const eventSpy = vi.fn();
      orchestrator.on('task:restored', eventSpy);

      // Create and trash a task
      const task = createTestTask();
      await orchestrator.store.createTask(task);
      await orchestrator.store.moveToTrash(task.id);

      // Mock getTask to return null on second call (after restore)
      const getTaskSpy = vi.spyOn(orchestrator.store, 'getTask');
      getTaskSpy
        .mockResolvedValueOnce(task) // First call for validation
        .mockResolvedValueOnce(null); // Second call after restore

      // Restore the task (should not emit event)
      await orchestrator.restoreTask(task.id);

      // Verify event was not emitted since task was not found
      expect(eventSpy).not.toHaveBeenCalled();

      getTaskSpy.mockRestore();
    });

    it('should emit event with complete task object', async () => {
      const eventSpy = vi.fn();
      orchestrator.on('task:restored', eventSpy);

      // Create a task with additional properties
      const task = createTestTask();
      task.logs = [{ level: 'info', message: 'Test log', timestamp: new Date() }];
      task.artifacts = [{ type: 'log', path: 'test.log', size: 100 }];
      await orchestrator.store.createTask(task);
      await orchestrator.store.moveToTrash(task.id);

      // Restore the task
      await orchestrator.restoreTask(task.id);

      // Verify event was emitted with complete task
      expect(eventSpy).toHaveBeenCalledTimes(1);
      const emittedTask = eventSpy.mock.calls[0][0];
      expect(emittedTask.id).toBe(task.id);
      expect(emittedTask.logs).toBeDefined();
      expect(emittedTask.artifacts).toBeDefined();
      expect(emittedTask.trashedAt).toBeNull();
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle multiple concurrent restore attempts', async () => {
      // Create and trash a task
      const task = createTestTask();
      await orchestrator.store.createTask(task);
      await orchestrator.store.moveToTrash(task.id);

      // Attempt to restore the same task concurrently
      const promise1 = orchestrator.restoreTask(task.id);
      const promise2 = orchestrator.restoreTask(task.id);

      // One should succeed, one should fail
      const results = await Promise.allSettled([promise1, promise2]);

      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;

      // At least one should succeed, may have failures due to race condition
      expect(successes).toBeGreaterThanOrEqual(1);
      expect(successes + failures).toBe(2);
    });
  });

  describe('Initialization Requirements', () => {
    it('should ensure orchestrator is initialized before restoring', async () => {
      const uninitializedOrchestrator = new ApexOrchestrator();

      // Mock ensureInitialized to verify it's called
      const ensureInitializedSpy = vi.spyOn(uninitializedOrchestrator, 'ensureInitialized' as any)
        .mockResolvedValue(undefined);

      await expect(uninitializedOrchestrator.restoreTask('some-task-id'))
        .rejects
        .toThrow();

      // Verify ensureInitialized was called
      expect(ensureInitializedSpy).toHaveBeenCalled();

      ensureInitializedSpy.mockRestore();
      await uninitializedOrchestrator.close();
    });
  });

  describe('Task State Validation', () => {
    it('should properly validate task exists before checking trash state', async () => {
      const getTaskSpy = vi.spyOn(orchestrator.store, 'getTask');

      // First call returns null (task doesn't exist)
      getTaskSpy.mockResolvedValueOnce(null);

      await expect(orchestrator.restoreTask('non-existent-task'))
        .rejects
        .toThrow('Task with ID non-existent-task not found');

      // Verify getTask was called for validation
      expect(getTaskSpy).toHaveBeenCalledWith('non-existent-task');
      expect(getTaskSpy).toHaveBeenCalledTimes(1);

      getTaskSpy.mockRestore();
    });

    it('should validate trash state after confirming task exists', async () => {
      // Create a non-trashed task
      const task = createTestTask();
      await orchestrator.store.createTask(task);

      // Mock getTask to return task without trashedAt
      const getTaskSpy = vi.spyOn(orchestrator.store, 'getTask');
      getTaskSpy.mockResolvedValueOnce({ ...task, trashedAt: null });

      await expect(orchestrator.restoreTask(task.id))
        .rejects
        .toThrow(`Task with ID ${task.id} is not in trash`);

      getTaskSpy.mockRestore();
    });
  });
});