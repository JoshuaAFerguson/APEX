import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index.js';
import { Task, TaskStatus } from '@apexcli/core';
import { TaskStore } from './store.js';

describe('ApexOrchestrator.restoreTask Integration Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-restore-integration-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    // Create basic config files
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `
project:
  name: "RestoreTask Integration Test"
agents: {}
workflows: {}
`
    );

    orchestrator = new ApexOrchestrator();
    await orchestrator.initialize(testDir);
    store = orchestrator.store;
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.close();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random()}`,
    description: 'Integration test task for restore functionality',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: testDir,
    branchName: `apex/integration-test-${Date.now()}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 100,
      outputTokens: 200,
      totalTokens: 300,
      estimatedCost: 0.01,
    },
    logs: [],
    artifacts: [],
    ...overrides,
  });

  describe('Full Workflow Integration', () => {
    it('should restore task through complete create->trash->restore workflow', async () => {
      const eventLog: string[] = [];

      // Set up event listeners
      orchestrator.on('task:created', () => eventLog.push('created'));
      orchestrator.on('task:trashed', () => eventLog.push('trashed'));
      orchestrator.on('task:restored', () => eventLog.push('restored'));

      // Create task
      const task = createTestTask();
      await store.createTask(task);

      // Trash task
      await store.moveToTrash(task.id);
      orchestrator.emit('task:trashed', task);

      // Restore task
      await orchestrator.restoreTask(task.id);

      // Verify complete workflow
      expect(eventLog).toContain('created');
      expect(eventLog).toContain('trashed');
      expect(eventLog).toContain('restored');

      // Verify final state
      const finalTask = await store.getTask(task.id);
      expect(finalTask?.trashedAt).toBeNull();
      expect(finalTask?.status).toBe('pending');
    });

    it('should restore task with all properties preserved', async () => {
      const originalTask = createTestTask({
        status: 'completed',
        logs: [
          { level: 'info', message: 'Task started', timestamp: new Date() },
          { level: 'debug', message: 'Processing data', timestamp: new Date() },
          { level: 'info', message: 'Task completed', timestamp: new Date() },
        ],
        artifacts: [
          { type: 'file', path: 'output.txt', size: 1024 },
          { type: 'log', path: 'debug.log', size: 512 },
        ],
        usage: {
          inputTokens: 500,
          outputTokens: 750,
          totalTokens: 1250,
          estimatedCost: 0.025,
        },
      });

      // Create and trash task
      await store.createTask(originalTask);
      await store.moveToTrash(originalTask.id);

      // Restore task
      await orchestrator.restoreTask(originalTask.id);

      // Verify all properties are preserved except status and trashedAt
      const restoredTask = await store.getTask(originalTask.id);
      expect(restoredTask?.id).toBe(originalTask.id);
      expect(restoredTask?.description).toBe(originalTask.description);
      expect(restoredTask?.workflow).toBe(originalTask.workflow);
      expect(restoredTask?.autonomy).toBe(originalTask.autonomy);
      expect(restoredTask?.projectPath).toBe(originalTask.projectPath);
      expect(restoredTask?.branchName).toBe(originalTask.branchName);
      expect(restoredTask?.logs).toEqual(originalTask.logs);
      expect(restoredTask?.artifacts).toEqual(originalTask.artifacts);
      expect(restoredTask?.usage).toEqual(originalTask.usage);

      // Status should be reset to pending, trashedAt should be null
      expect(restoredTask?.status).toBe('pending');
      expect(restoredTask?.trashedAt).toBeNull();
    });
  });

  describe('Store Integration', () => {
    it('should properly interact with store.restoreFromTrash method', async () => {
      const task = createTestTask();
      await store.createTask(task);
      await store.moveToTrash(task.id);

      // Verify task is trashed in store
      const trashedTask = await store.getTask(task.id);
      expect(trashedTask?.trashedAt).toBeDefined();

      // Restore through orchestrator
      await orchestrator.restoreTask(task.id);

      // Verify store state after restore
      const restoredTask = await store.getTask(task.id);
      expect(restoredTask?.trashedAt).toBeNull();
      expect(restoredTask?.status).toBe('pending');
    });

    it('should handle database consistency during restore operation', async () => {
      const tasks = [
        createTestTask({ id: 'task1' }),
        createTestTask({ id: 'task2' }),
        createTestTask({ id: 'task3' }),
      ];

      // Create and trash multiple tasks
      for (const task of tasks) {
        await store.createTask(task);
        await store.moveToTrash(task.id);
      }

      // Restore one task
      await orchestrator.restoreTask('task2');

      // Verify only the restored task is out of trash
      const task1 = await store.getTask('task1');
      const task2 = await store.getTask('task2');
      const task3 = await store.getTask('task3');

      expect(task1?.trashedAt).toBeDefined();
      expect(task2?.trashedAt).toBeNull();
      expect(task3?.trashedAt).toBeDefined();
    });
  });

  describe('Event System Integration', () => {
    it('should emit task:restored event with correct task data', async () => {
      const eventPayloads: Task[] = [];
      orchestrator.on('task:restored', (task) => eventPayloads.push(task));

      const originalTask = createTestTask({
        description: 'Event integration test task',
        usage: { inputTokens: 150, outputTokens: 300, totalTokens: 450, estimatedCost: 0.02 },
      });

      // Create, trash, and restore task
      await store.createTask(originalTask);
      await store.moveToTrash(originalTask.id);
      await orchestrator.restoreTask(originalTask.id);

      // Verify event was emitted with correct data
      expect(eventPayloads).toHaveLength(1);
      const eventTask = eventPayloads[0];
      expect(eventTask.id).toBe(originalTask.id);
      expect(eventTask.description).toBe(originalTask.description);
      expect(eventTask.usage).toEqual(originalTask.usage);
      expect(eventTask.trashedAt).toBeNull();
      expect(eventTask.status).toBe('pending');
    });

    it('should handle multiple event listeners for task:restored', async () => {
      const listener1Events: Task[] = [];
      const listener2Events: string[] = [];
      const listener3EventCount = { count: 0 };

      orchestrator.on('task:restored', (task) => listener1Events.push(task));
      orchestrator.on('task:restored', (task) => listener2Events.push(task.id));
      orchestrator.on('task:restored', () => listener3EventCount.count++);

      const task = createTestTask();
      await store.createTask(task);
      await store.moveToTrash(task.id);
      await orchestrator.restoreTask(task.id);

      // Verify all listeners received the event
      expect(listener1Events).toHaveLength(1);
      expect(listener1Events[0].id).toBe(task.id);
      expect(listener2Events).toEqual([task.id]);
      expect(listener3EventCount.count).toBe(1);
    });
  });

  describe('Error Handling Integration', () => {
    it('should maintain store consistency when restore operation fails', async () => {
      const task = createTestTask();
      await store.createTask(task);
      await store.moveToTrash(task.id);

      // Mock store method to fail after task is validated but before restore
      const originalRestoreFromTrash = store.restoreFromTrash;
      store.restoreFromTrash = vi.fn().mockRejectedValue(new Error('Database error'));

      try {
        await orchestrator.restoreTask(task.id);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Database error');
      }

      // Restore original method and verify task is still trashed
      store.restoreFromTrash = originalRestoreFromTrash;
      const taskAfterFailure = await store.getTask(task.id);
      expect(taskAfterFailure?.trashedAt).toBeDefined();
    });

    it('should not emit event when restore operation fails', async () => {
      const eventSpy = vi.fn();
      orchestrator.on('task:restored', eventSpy);

      const task = createTestTask();
      await store.createTask(task);
      await store.moveToTrash(task.id);

      // Mock store method to fail
      const restoreFromTrashSpy = vi.spyOn(store, 'restoreFromTrash')
        .mockRejectedValue(new Error('Store failure'));

      try {
        await orchestrator.restoreTask(task.id);
        expect.fail('Should have thrown an error');
      } catch (error) {
        // Expected
      }

      // Verify no event was emitted
      expect(eventSpy).not.toHaveBeenCalled();

      restoreFromTrashSpy.mockRestore();
    });
  });

  describe('Performance and Scalability', () => {
    it('should efficiently restore task with large number of logs and artifacts', async () => {
      // Create task with many logs and artifacts
      const largeLogs = Array.from({ length: 1000 }, (_, i) => ({
        level: 'info' as const,
        message: `Log entry ${i}`,
        timestamp: new Date(),
      }));

      const largeArtifacts = Array.from({ length: 100 }, (_, i) => ({
        type: 'file' as const,
        path: `artifact_${i}.txt`,
        size: 1024 * (i + 1),
      }));

      const task = createTestTask({
        logs: largeLogs,
        artifacts: largeArtifacts,
      });

      // Create, trash, and restore
      await store.createTask(task);
      await store.moveToTrash(task.id);

      const startTime = Date.now();
      await orchestrator.restoreTask(task.id);
      const endTime = Date.now();

      // Verify operation completed in reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // Verify data integrity
      const restoredTask = await store.getTask(task.id);
      expect(restoredTask?.logs).toHaveLength(1000);
      expect(restoredTask?.artifacts).toHaveLength(100);
      expect(restoredTask?.trashedAt).toBeNull();
    });
  });

  describe('Edge Case Integration', () => {
    it('should handle task restoration when task was modified while trashed', async () => {
      const task = createTestTask();
      await store.createTask(task);
      await store.moveToTrash(task.id);

      // Simulate external modification of trashed task (e.g., through direct store access)
      const trashedTask = await store.getTask(task.id);
      if (trashedTask) {
        trashedTask.description = 'Modified while trashed';
        // Directly update in store (bypassing orchestrator)
        await store.updateTaskStatus(task.id, 'failed');
      }

      // Restore task
      await orchestrator.restoreTask(task.id);

      // Verify restoration with modified data
      const restoredTask = await store.getTask(task.id);
      expect(restoredTask?.description).toBe('Modified while trashed');
      expect(restoredTask?.status).toBe('pending'); // Should be reset to pending
      expect(restoredTask?.trashedAt).toBeNull();
    });
  });
});