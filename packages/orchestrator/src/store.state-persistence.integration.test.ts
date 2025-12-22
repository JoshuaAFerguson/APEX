import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task, TaskUsage } from '@apex/core';

describe('TaskStore State Persistence Integration Tests', () => {
  let testDir: string;
  let store1: TaskStore;
  let store2: TaskStore;
  let dbPath: string;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_test`,
    description: 'Test task for state persistence',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testDir,
    branchName: 'apex/test-state-persistence',
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 100,
      outputTokens: 250,
      totalTokens: 350,
      estimatedCost: 0.05,
    },
    logs: [],
    artifacts: [],
    dependsOn: [],
    subtaskIds: ['subtask_1', 'subtask_2'],
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-store-persistence-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    dbPath = path.join(testDir, '.apex', 'apex.db');

    store1 = new TaskStore(testDir);
    await store1.initialize();
  });

  afterEach(async () => {
    store1?.close();
    store2?.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Task Usage Persistence', () => {
    it('should persist totalTokens accumulation across store restarts', async () => {
      const task = createTestTask();
      await store1.createTask(task);

      // Update usage multiple times to simulate token accumulation
      const updates: TaskUsage[] = [
        { inputTokens: 500, outputTokens: 300, totalTokens: 800, estimatedCost: 0.012 },
        { inputTokens: 750, outputTokens: 450, totalTokens: 1200, estimatedCost: 0.018 },
        { inputTokens: 1000, outputTokens: 600, totalTokens: 1600, estimatedCost: 0.024 },
      ];

      for (const usage of updates) {
        await store1.updateTask(task.id, { usage, updatedAt: new Date() });
      }

      // Verify in-memory state
      const beforeRestart = await store1.getTask(task.id);
      expect(beforeRestart?.usage.totalTokens).toBe(1600);
      expect(beforeRestart?.usage.inputTokens).toBe(1000);
      expect(beforeRestart?.usage.outputTokens).toBe(600);
      expect(beforeRestart?.usage.estimatedCost).toBe(0.024);

      // Close first store and create second store (simulates process restart)
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      // Verify persistence after restart
      const afterRestart = await store2.getTask(task.id);
      expect(afterRestart).not.toBeNull();
      expect(afterRestart?.usage.totalTokens).toBe(1600);
      expect(afterRestart?.usage.inputTokens).toBe(1000);
      expect(afterRestart?.usage.outputTokens).toBe(600);
      expect(afterRestart?.usage.estimatedCost).toBe(0.024);
    });

    it('should persist totalCost calculation across multiple updates and restarts', async () => {
      const task = createTestTask();
      await store1.createTask(task);

      // Simulate cost accumulation over time
      const costUpdates = [
        { inputTokens: 200, outputTokens: 100, totalTokens: 300, estimatedCost: 0.005 },
        { inputTokens: 500, outputTokens: 300, totalTokens: 800, estimatedCost: 0.015 },
        { inputTokens: 800, outputTokens: 500, totalTokens: 1300, estimatedCost: 0.025 },
        { inputTokens: 1200, outputTokens: 750, totalTokens: 1950, estimatedCost: 0.037 },
      ];

      for (const [index, usage] of costUpdates.entries()) {
        await store1.updateTask(task.id, { usage, updatedAt: new Date() });

        // Verify intermediate persistence
        const intermediate = await store1.getTask(task.id);
        expect(intermediate?.usage.estimatedCost).toBe(usage.estimatedCost);
      }

      // Close and restart store
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      // Verify final cost persists correctly
      const final = await store2.getTask(task.id);
      expect(final?.usage.estimatedCost).toBe(0.037);
      expect(final?.usage.totalTokens).toBe(1950);
    });
  });

  describe('Task State Fields Persistence', () => {
    it('should persist tasksCreated and tasksCompleted arrays across restarts', async () => {
      const parentTask = createTestTask();
      parentTask.id = 'parent_task';
      await store1.createTask(parentTask);

      // Update with subtask tracking
      const subtaskIds = ['subtask_1', 'subtask_2', 'subtask_3'];
      await store1.updateTask(parentTask.id, {
        subtaskIds,
        updatedAt: new Date(),
      });

      // Verify before restart
      const beforeRestart = await store1.getTask(parentTask.id);
      expect(beforeRestart?.subtaskIds).toEqual(subtaskIds);

      // Restart store
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      // Verify persistence after restart
      const afterRestart = await store2.getTask(parentTask.id);
      expect(afterRestart?.subtaskIds).toEqual(subtaskIds);
    });

    it('should persist currentStage and complex task state across restarts', async () => {
      const task = createTestTask();
      const testDate = new Date('2024-01-15T10:30:00Z');

      task.status = 'in-progress';
      task.currentStage = 'implementation';
      task.pausedAt = testDate;
      task.pauseReason = 'Rate limit exceeded';
      task.retryCount = 2;

      await store1.createTask(task);

      // Update with additional state
      await store1.updateTask(task.id, {
        currentStage: 'testing',
        pausedAt: testDate,
        pauseReason: 'Waiting for dependencies',
        retryCount: 3,
        updatedAt: new Date(),
      });

      // Restart store
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      // Verify all state persists
      const persisted = await store2.getTask(task.id);
      expect(persisted?.currentStage).toBe('testing');
      expect(persisted?.pausedAt).toEqual(testDate);
      expect(persisted?.pauseReason).toBe('Waiting for dependencies');
      expect(persisted?.retryCount).toBe(3);
    });
  });

  describe('Date Serialization/Deserialization', () => {
    it('should correctly serialize and deserialize Date objects across restarts', async () => {
      const task = createTestTask();

      // Set specific test dates
      const createdAt = new Date('2024-01-10T08:00:00Z');
      const updatedAt = new Date('2024-01-10T12:30:00Z');
      const completedAt = new Date('2024-01-10T16:45:00Z');
      const pausedAt = new Date('2024-01-10T14:20:00Z');
      const resumeAfter = new Date('2024-01-11T08:00:00Z');

      task.createdAt = createdAt;
      task.updatedAt = updatedAt;
      task.completedAt = completedAt;
      task.pausedAt = pausedAt;
      task.resumeAfter = resumeAfter;

      await store1.createTask(task);

      // Verify Date objects before restart
      const beforeRestart = await store1.getTask(task.id);
      expect(beforeRestart?.createdAt).toEqual(createdAt);
      expect(beforeRestart?.updatedAt).toEqual(updatedAt);
      expect(beforeRestart?.completedAt).toEqual(completedAt);
      expect(beforeRestart?.pausedAt).toEqual(pausedAt);
      expect(beforeRestart?.resumeAfter).toEqual(resumeAfter);

      // Restart store
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      // Verify Date objects after restart - should be properly reconstructed
      const afterRestart = await store2.getTask(task.id);
      expect(afterRestart?.createdAt).toBeInstanceOf(Date);
      expect(afterRestart?.updatedAt).toBeInstanceOf(Date);
      expect(afterRestart?.completedAt).toBeInstanceOf(Date);
      expect(afterRestart?.pausedAt).toBeInstanceOf(Date);
      expect(afterRestart?.resumeAfter).toBeInstanceOf(Date);

      // Verify exact timestamp preservation
      expect(afterRestart?.createdAt.getTime()).toBe(createdAt.getTime());
      expect(afterRestart?.updatedAt.getTime()).toBe(updatedAt.getTime());
      expect(afterRestart?.completedAt?.getTime()).toBe(completedAt.getTime());
      expect(afterRestart?.pausedAt?.getTime()).toBe(pausedAt.getTime());
      expect(afterRestart?.resumeAfter?.getTime()).toBe(resumeAfter.getTime());
    });

    it('should handle null/undefined date fields correctly', async () => {
      const task = createTestTask();

      // Explicitly set some dates to undefined
      task.completedAt = undefined;
      task.pausedAt = undefined;
      task.resumeAfter = undefined;
      task.pauseReason = undefined;

      await store1.createTask(task);

      // Update to set pause fields to null (clearing them)
      await store1.updateTask(task.id, {
        pausedAt: undefined,
        resumeAfter: undefined,
        pauseReason: undefined,
        updatedAt: new Date(),
      });

      // Restart store
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      // Verify null/undefined preservation
      const afterRestart = await store2.getTask(task.id);
      expect(afterRestart?.completedAt).toBeUndefined();
      expect(afterRestart?.pausedAt).toBeUndefined();
      expect(afterRestart?.resumeAfter).toBeUndefined();
      expect(afterRestart?.pauseReason).toBeUndefined();
    });
  });

  describe('Complex State Persistence Scenarios', () => {
    it('should persist complete task lifecycle state across multiple restarts', async () => {
      const task = createTestTask();
      task.id = 'lifecycle_test_task';

      // Initial state
      await store1.createTask(task);

      // Simulate progression through lifecycle with state changes
      await store1.updateTask(task.id, {
        status: 'in-progress',
        currentStage: 'planning',
        usage: { inputTokens: 200, outputTokens: 150, totalTokens: 350, estimatedCost: 0.007 },
        updatedAt: new Date(),
      });

      // First restart
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      let persisted = await store2.getTask(task.id);
      expect(persisted?.status).toBe('in-progress');
      expect(persisted?.currentStage).toBe('planning');

      // Continue lifecycle
      await store2.updateTask(task.id, {
        currentStage: 'implementation',
        usage: { inputTokens: 600, outputTokens: 400, totalTokens: 1000, estimatedCost: 0.020 },
        retryCount: 1,
        updatedAt: new Date(),
      });

      // Second restart
      store2.close();
      const store3 = new TaskStore(testDir);
      await store3.initialize();

      persisted = await store3.getTask(task.id);
      expect(persisted?.currentStage).toBe('implementation');
      expect(persisted?.usage.totalTokens).toBe(1000);
      expect(persisted?.usage.estimatedCost).toBe(0.020);
      expect(persisted?.retryCount).toBe(1);

      // Complete the task
      const completedAt = new Date();
      await store3.updateTask(task.id, {
        status: 'completed',
        completedAt,
        usage: { inputTokens: 800, outputTokens: 500, totalTokens: 1300, estimatedCost: 0.026 },
        updatedAt: new Date(),
      });

      // Final restart
      store3.close();
      const store4 = new TaskStore(testDir);
      await store4.initialize();

      const final = await store4.getTask(task.id);
      expect(final?.status).toBe('completed');
      expect(final?.completedAt).toEqual(completedAt);
      expect(final?.usage.totalTokens).toBe(1300);
      expect(final?.usage.estimatedCost).toBe(0.026);

      store4.close();
    });

    it('should persist task dependencies and relationships across restarts', async () => {
      // Create multiple related tasks
      const parentTask = createTestTask();
      parentTask.id = 'parent_task';
      parentTask.subtaskIds = ['child_1', 'child_2'];
      await store1.createTask(parentTask);

      const depTask = createTestTask();
      depTask.id = 'dependency_task';
      await store1.createTask(depTask);

      const child1 = createTestTask();
      child1.id = 'child_1';
      child1.parentTaskId = 'parent_task';
      child1.dependsOn = ['dependency_task'];
      await store1.createTask(child1);

      const child2 = createTestTask();
      child2.id = 'child_2';
      child2.parentTaskId = 'parent_task';
      await store1.createTask(child2);

      // Restart store
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      // Verify all relationships persist
      const parentPersisted = await store2.getTask('parent_task');
      expect(parentPersisted?.subtaskIds).toEqual(['child_1', 'child_2']);

      const child1Persisted = await store2.getTask('child_1');
      expect(child1Persisted?.parentTaskId).toBe('parent_task');
      expect(child1Persisted?.dependsOn).toEqual(['dependency_task']);

      const child2Persisted = await store2.getTask('child_2');
      expect(child2Persisted?.parentTaskId).toBe('parent_task');

      // Verify dependency queries work
      const dependencies = await store2.getTaskDependencies('child_1');
      expect(dependencies).toEqual(['dependency_task']);

      const dependents = await store2.getDependentTasks('dependency_task');
      expect(dependents).toEqual(['child_1']);
    });
  });

  describe('Database File Integrity', () => {
    it('should maintain database integrity across multiple concurrent operations and restarts', async () => {
      // Create multiple tasks with various state
      const tasks = Array.from({ length: 10 }, (_, i) => {
        const task = createTestTask();
        task.id = `concurrent_task_${i}`;
        task.priority = i % 2 === 0 ? 'high' : 'normal';
        task.usage = {
          inputTokens: (i + 1) * 100,
          outputTokens: (i + 1) * 50,
          totalTokens: (i + 1) * 150,
          estimatedCost: (i + 1) * 0.005,
        };
        return task;
      });

      // Create all tasks
      for (const task of tasks) {
        await store1.createTask(task);

        // Add some logs and artifacts for complexity
        await store1.addLog(task.id, {
          level: 'info',
          message: `Log for task ${task.id}`,
          stage: 'implementation',
        });

        await store1.addArtifact(task.id, {
          name: `artifact_${task.id}.ts`,
          type: 'file',
          path: `/src/${task.id}.ts`,
          content: `// Generated code for ${task.id}`,
        });
      }

      // Update some tasks
      for (let i = 0; i < 5; i++) {
        await store1.updateTask(`concurrent_task_${i}`, {
          status: 'in-progress',
          currentStage: 'testing',
          usage: {
            inputTokens: (i + 1) * 200,
            outputTokens: (i + 1) * 100,
            totalTokens: (i + 1) * 300,
            estimatedCost: (i + 1) * 0.010,
          },
          updatedAt: new Date(),
        });
      }

      // Restart store
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      // Verify all data persists correctly
      for (let i = 0; i < 10; i++) {
        const task = await store2.getTask(`concurrent_task_${i}`);
        expect(task).not.toBeNull();
        expect(task?.id).toBe(`concurrent_task_${i}`);
        expect(task?.logs.length).toBeGreaterThan(0);
        expect(task?.artifacts.length).toBeGreaterThan(0);

        if (i < 5) {
          expect(task?.status).toBe('in-progress');
          expect(task?.currentStage).toBe('testing');
          expect(task?.usage.totalTokens).toBe((i + 1) * 300);
        } else {
          expect(task?.status).toBe('pending');
          expect(task?.usage.totalTokens).toBe((i + 1) * 150);
        }
      }

      // Verify database queries still work correctly
      const allTasks = await store2.listTasks();
      expect(allTasks.length).toBe(10);

      const inProgressTasks = await store2.listTasks({ status: 'in-progress' });
      expect(inProgressTasks.length).toBe(5);

      const highPriorityTasks = await store2.listTasks({ orderByPriority: true });
      expect(highPriorityTasks.filter(t => t.priority === 'high').length).toBe(5);
    });

    it('should verify database file exists and is accessible after operations', async () => {
      const task = createTestTask();
      await store1.createTask(task);

      // Verify database file exists
      const dbExists = await fs.access(dbPath).then(() => true).catch(() => false);
      expect(dbExists).toBe(true);

      // Verify file is not empty
      const stats = await fs.stat(dbPath);
      expect(stats.size).toBeGreaterThan(0);

      // Restart store and verify it can read the database
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      const retrieved = await store2.getTask(task.id);
      expect(retrieved).not.toBeNull();
    });
  });
});
