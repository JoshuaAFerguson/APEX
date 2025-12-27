import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index.js';
import { Task } from '@apexcli/core';

describe('ApexOrchestrator.restoreTask - Additional Edge Cases', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-restore-edge-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    // Create basic config files
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `
project:
  name: "RestoreTask Edge Cases Test"
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

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `edge_task_${Date.now()}_${Math.random()}`,
    description: 'Edge case test task for restore functionality',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: testDir,
    branchName: `apex/edge-test-${Date.now()}`,
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
    ...overrides,
  });

  describe('Database Operation Timeouts', () => {
    it('should handle getTask timeout during validation', async () => {
      const task = createTestTask();
      await orchestrator.store.createTask(task);
      await orchestrator.store.moveToTrash(task.id);

      // Mock getTask to simulate a timeout on first call
      const originalGetTask = orchestrator.store.getTask;
      let callCount = 0;

      const getTaskSpy = vi.spyOn(orchestrator.store, 'getTask').mockImplementation(async (taskId) => {
        callCount++;
        if (callCount === 1) {
          // Simulate timeout on first call (validation)
          throw new Error('Database timeout');
        }
        // Let subsequent calls work normally
        return originalGetTask.call(orchestrator.store, taskId);
      });

      await expect(orchestrator.restoreTask(task.id))
        .rejects
        .toThrow('Database timeout');

      getTaskSpy.mockRestore();
    });

    it('should handle restoreFromTrash timeout', async () => {
      const task = createTestTask();
      await orchestrator.store.createTask(task);
      await orchestrator.store.moveToTrash(task.id);

      // Mock restoreFromTrash to simulate timeout
      const restoreFromTrashSpy = vi.spyOn(orchestrator.store, 'restoreFromTrash')
        .mockRejectedValue(new Error('Database operation timeout'));

      await expect(orchestrator.restoreTask(task.id))
        .rejects
        .toThrow('Database operation timeout');

      // Verify task is still in trash after timeout
      const taskAfterTimeout = await orchestrator.store.getTask(task.id);
      expect(taskAfterTimeout?.trashedAt).toBeDefined();

      restoreFromTrashSpy.mockRestore();
    });

    it('should handle getTask timeout during event emission', async () => {
      const eventSpy = vi.fn();
      orchestrator.on('task:restored', eventSpy);

      const task = createTestTask();
      await orchestrator.store.createTask(task);
      await orchestrator.store.moveToTrash(task.id);

      // Mock getTask to work for validation but fail for event emission
      const originalGetTask = orchestrator.store.getTask;
      let callCount = 0;

      const getTaskSpy = vi.spyOn(orchestrator.store, 'getTask').mockImplementation(async (taskId) => {
        callCount++;
        if (callCount === 1) {
          // First call (validation) - work normally
          return originalGetTask.call(orchestrator.store, taskId);
        } else {
          // Second call (event emission) - simulate timeout
          throw new Error('Database timeout during event emission');
        }
      });

      // The restore operation should still succeed even if event emission fails
      await orchestrator.restoreTask(task.id);

      // Verify no event was emitted due to timeout
      expect(eventSpy).not.toHaveBeenCalled();

      // Manually verify task was restored despite event emission failure
      getTaskSpy.mockRestore();
      const restoredTask = await orchestrator.store.getTask(task.id);
      expect(restoredTask?.trashedAt).toBeNull();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle extremely large task descriptions', async () => {
      // Create task with very large description (1MB)
      const largeDescription = 'x'.repeat(1024 * 1024);
      const task = createTestTask({
        description: largeDescription,
      });

      await orchestrator.store.createTask(task);
      await orchestrator.store.moveToTrash(task.id);

      const startTime = Date.now();
      await orchestrator.restoreTask(task.id);
      const endTime = Date.now();

      // Verify operation completed in reasonable time (less than 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);

      // Verify large description is preserved
      const restoredTask = await orchestrator.store.getTask(task.id);
      expect(restoredTask?.description.length).toBe(1024 * 1024);
      expect(restoredTask?.trashedAt).toBeNull();
    });

    it('should handle task with extremely large number of artifacts', async () => {
      // Create task with 10,000 artifacts
      const manyArtifacts = Array.from({ length: 10000 }, (_, i) => ({
        type: 'file' as const,
        path: `artifact_${i}.txt`,
        size: 1000 + i,
      }));

      const task = createTestTask({
        artifacts: manyArtifacts,
      });

      await orchestrator.store.createTask(task);
      await orchestrator.store.moveToTrash(task.id);

      const startTime = Date.now();
      await orchestrator.restoreTask(task.id);
      const endTime = Date.now();

      // Verify operation completed in reasonable time
      expect(endTime - startTime).toBeLessThan(10000);

      // Verify all artifacts are preserved
      const restoredTask = await orchestrator.store.getTask(task.id);
      expect(restoredTask?.artifacts).toHaveLength(10000);
      expect(restoredTask?.trashedAt).toBeNull();
    });
  });

  describe('Task State Consistency', () => {
    it('should maintain data consistency when multiple properties are updated simultaneously', async () => {
      const task = createTestTask({
        status: 'completed',
        logs: [
          { level: 'info', message: 'Original log 1', timestamp: new Date() },
          { level: 'error', message: 'Original log 2', timestamp: new Date() },
        ],
        artifacts: [{ type: 'file', path: 'original.txt', size: 100 }],
      });

      await orchestrator.store.createTask(task);
      await orchestrator.store.moveToTrash(task.id);

      // Simulate concurrent updates to the task while it's trashed
      const updatePromises = [
        // Simulate background processes updating logs
        orchestrator.store.updateTask(task.id, {
          logs: [...task.logs, { level: 'debug', message: 'Added while trashed', timestamp: new Date() }],
        }),
        // Simulate updating artifacts
        orchestrator.store.updateTask(task.id, {
          artifacts: [...task.artifacts, { type: 'log', path: 'debug.log', size: 50 }],
        }),
      ];

      await Promise.all(updatePromises);

      // Now restore the task
      await orchestrator.restoreTask(task.id);

      // Verify task was restored with all updates preserved
      const restoredTask = await orchestrator.store.getTask(task.id);
      expect(restoredTask?.status).toBe('pending'); // Should be reset
      expect(restoredTask?.trashedAt).toBeNull(); // Should be cleared
      expect(restoredTask?.logs.length).toBeGreaterThan(2); // Should have additional logs
      expect(restoredTask?.artifacts.length).toBeGreaterThan(1); // Should have additional artifacts
    });

    it('should handle restore when task status was changed while trashed', async () => {
      const task = createTestTask({ status: 'pending' });
      await orchestrator.store.createTask(task);
      await orchestrator.store.moveToTrash(task.id);

      // Simulate external process changing status while trashed
      await orchestrator.store.updateTaskStatus(task.id, 'failed');

      // Verify task is failed and trashed
      const trashedTask = await orchestrator.store.getTask(task.id);
      expect(trashedTask?.status).toBe('failed');
      expect(trashedTask?.trashedAt).toBeDefined();

      // Restore should reset status to pending
      await orchestrator.restoreTask(task.id);

      const restoredTask = await orchestrator.store.getTask(task.id);
      expect(restoredTask?.status).toBe('pending');
      expect(restoredTask?.trashedAt).toBeNull();
    });
  });

  describe('Event System Edge Cases', () => {
    it('should handle event listeners that throw errors', async () => {
      const workingListenerSpy = vi.fn();
      const errorListenerSpy = vi.fn().mockImplementation(() => {
        throw new Error('Event listener error');
      });

      orchestrator.on('task:restored', errorListenerSpy);
      orchestrator.on('task:restored', workingListenerSpy);

      const task = createTestTask();
      await orchestrator.store.createTask(task);
      await orchestrator.store.moveToTrash(task.id);

      // Restore should succeed despite listener error
      await expect(orchestrator.restoreTask(task.id)).resolves.not.toThrow();

      // Verify both listeners were called
      expect(errorListenerSpy).toHaveBeenCalled();
      expect(workingListenerSpy).toHaveBeenCalled();

      // Verify task was properly restored
      const restoredTask = await orchestrator.store.getTask(task.id);
      expect(restoredTask?.trashedAt).toBeNull();
    });

    it('should emit events with proper task state even when task is large', async () => {
      const eventSpy = vi.fn();
      orchestrator.on('task:restored', eventSpy);

      // Create very large task
      const largeTask = createTestTask({
        logs: Array.from({ length: 1000 }, (_, i) => ({
          level: 'info',
          message: `Large log entry ${i} with substantial content to test memory handling`,
          timestamp: new Date(),
        })),
        artifacts: Array.from({ length: 500 }, (_, i) => ({
          type: 'file',
          path: `large_artifact_${i}.txt`,
          size: 1024 * (i + 1),
        })),
      });

      await orchestrator.store.createTask(largeTask);
      await orchestrator.store.moveToTrash(largeTask.id);

      await orchestrator.restoreTask(largeTask.id);

      // Verify event was emitted with complete large task
      expect(eventSpy).toHaveBeenCalledOnce();
      const emittedTask = eventSpy.mock.calls[0][0];
      expect(emittedTask.logs).toHaveLength(1000);
      expect(emittedTask.artifacts).toHaveLength(500);
      expect(emittedTask.trashedAt).toBeNull();
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle task with empty arrays for logs and artifacts', async () => {
      const task = createTestTask({
        logs: [],
        artifacts: [],
      });

      await orchestrator.store.createTask(task);
      await orchestrator.store.moveToTrash(task.id);

      await orchestrator.restoreTask(task.id);

      const restoredTask = await orchestrator.store.getTask(task.id);
      expect(restoredTask?.logs).toEqual([]);
      expect(restoredTask?.artifacts).toEqual([]);
      expect(restoredTask?.trashedAt).toBeNull();
    });

    it('should handle task with minimal required fields only', async () => {
      const minimalTask: Task = {
        id: 'minimal-task-id',
        description: 'Min',
        workflow: 'feature',
        autonomy: 'full',
        status: 'pending',
        projectPath: testDir,
        branchName: 'apex/minimal',
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
      };

      await orchestrator.store.createTask(minimalTask);
      await orchestrator.store.moveToTrash(minimalTask.id);

      await orchestrator.restoreTask(minimalTask.id);

      const restoredTask = await orchestrator.store.getTask(minimalTask.id);
      expect(restoredTask?.id).toBe('minimal-task-id');
      expect(restoredTask?.description).toBe('Min');
      expect(restoredTask?.trashedAt).toBeNull();
      expect(restoredTask?.status).toBe('pending');
    });
  });
});