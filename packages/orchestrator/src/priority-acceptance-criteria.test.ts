import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task, TaskPriority, TaskEffort } from '@apexcli/core';

describe('Priority Implementation Acceptance Criteria', () => {
  let testDir: string;
  let store: TaskStore;

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-priority-acceptance-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Acceptance Criteria Verification', () => {
    it('should verify TaskPriority types exist (urgent/high/normal/low)', async () => {
      // Test that all priority levels can be created and stored
      const priorities: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];

      for (const priority of priorities) {
        const task = createTestTask({
          id: `test_${priority}_priority`,
          priority: priority,
        });

        await store.createTask(task);
        const retrievedTask = await store.getTask(task.id);

        expect(retrievedTask).not.toBeNull();
        expect(retrievedTask!.priority).toBe(priority);
      }
    });

    it('should verify store.ts has priority-based task ordering with getNextQueuedTask', async () => {
      // Create tasks with different priorities
      const urgentTask = createTestTask({
        id: 'urgent_task',
        priority: 'urgent',
        effort: 'medium',
      });

      const normalTask = createTestTask({
        id: 'normal_task',
        priority: 'normal',
        effort: 'small',
      });

      const lowTask = createTestTask({
        id: 'low_task',
        priority: 'low',
        effort: 'xs',
      });

      // Create tasks in reverse priority order
      await store.createTask(lowTask);
      await store.createTask(normalTask);
      await store.createTask(urgentTask);

      // Verify getNextQueuedTask returns highest priority first
      const firstTask = await store.getNextQueuedTask();
      expect(firstTask?.id).toBe('urgent_task');

      // Update first task to in-progress so it won't be returned again
      await store.updateTaskStatus('urgent_task', 'in-progress');

      const secondTask = await store.getNextQueuedTask();
      expect(secondTask?.id).toBe('normal_task');

      await store.updateTaskStatus('normal_task', 'in-progress');

      const thirdTask = await store.getNextQueuedTask();
      expect(thirdTask?.id).toBe('low_task');
    });

    it('should verify priority-based sorting with effort tie-breaking', async () => {
      // Create tasks with same priority but different effort
      const highEffortTask = createTestTask({
        id: 'high_effort_normal',
        priority: 'normal',
        effort: 'large',
      });

      const lowEffortTask = createTestTask({
        id: 'low_effort_normal',
        priority: 'normal',
        effort: 'small',
      });

      await store.createTask(highEffortTask);
      await store.createTask(lowEffortTask);

      // Lower effort should come first
      const nextTask = await store.getNextQueuedTask();
      expect(nextTask?.id).toBe('low_effort_normal');
    });

    it('should verify priority is persisted in SQLite database', async () => {
      const task = createTestTask({
        id: 'persistence_test',
        priority: 'high',
        effort: 'medium',
      });

      await store.createTask(task);

      // Close and recreate store to test persistence
      store.close();

      const newStore = new TaskStore(testDir);
      await newStore.initialize();

      const retrievedTask = await newStore.getTask('persistence_test');
      expect(retrievedTask).not.toBeNull();
      expect(retrievedTask!.priority).toBe('high');
      expect(retrievedTask!.effort).toBe('medium');

      newStore.close();
    });

    it('should verify ordering works with listTasks orderByPriority option', async () => {
      const tasks = [
        createTestTask({ id: 'task1', priority: 'low', effort: 'large' }),
        createTestTask({ id: 'task2', priority: 'urgent', effort: 'small' }),
        createTestTask({ id: 'task3', priority: 'normal', effort: 'medium' }),
        createTestTask({ id: 'task4', priority: 'high', effort: 'xs' }),
      ];

      // Create tasks in random order
      for (const task of tasks) {
        await store.createTask(task);
      }

      const orderedTasks = await store.listTasks({ orderByPriority: true });
      const taskIds = orderedTasks.map(t => t.id);

      // Should be ordered by priority first, then effort
      expect(taskIds).toEqual(['task2', 'task4', 'task3', 'task1']);
    });

    it('should verify priority ordering works with getReadyTasks', async () => {
      const readyTask1 = createTestTask({
        id: 'ready_urgent',
        priority: 'urgent',
        effort: 'large',
        status: 'pending',
      });

      const readyTask2 = createTestTask({
        id: 'ready_high',
        priority: 'high',
        effort: 'small',
        status: 'pending',
      });

      // Create a dependency task that is not completed
      const dependencyTask = createTestTask({
        id: 'dependency_task',
        priority: 'normal',
        effort: 'medium',
        status: 'in-progress', // Not completed, so will block dependent tasks
      });

      const blockedTask = createTestTask({
        id: 'blocked_urgent',
        priority: 'urgent',
        effort: 'xs',
        status: 'pending',
        dependsOn: ['dependency_task'], // This will make it blocked
      });

      await store.createTask(dependencyTask);
      await store.createTask(readyTask1);
      await store.createTask(readyTask2);
      await store.createTask(blockedTask);

      const readyTasks = await store.getReadyTasks({ orderByPriority: true });
      const taskIds = readyTasks.map(t => t.id);

      // Should only include ready tasks, ordered by priority
      expect(taskIds).toEqual(['ready_urgent', 'ready_high']);
      expect(taskIds).not.toContain('blocked_urgent');
    });

    it('should verify all priority levels work with comprehensive ordering', async () => {
      const priorities: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];
      const efforts: TaskEffort[] = ['xs', 'small', 'medium', 'large', 'xl'];

      // Create one task for each priority-effort combination
      const tasks: Task[] = [];
      for (let i = 0; i < priorities.length; i++) {
        for (let j = 0; j < efforts.length; j++) {
          tasks.push(createTestTask({
            id: `priority_${priorities[i]}_effort_${efforts[j]}`,
            priority: priorities[i],
            effort: efforts[j],
          }));
        }
      }

      // Create tasks in random order
      const shuffled = [...tasks].sort(() => Math.random() - 0.5);
      for (const task of shuffled) {
        await store.createTask(task);
      }

      const orderedTasks = await store.listTasks({ orderByPriority: true });

      // Verify all tasks are returned
      expect(orderedTasks).toHaveLength(20); // 4 priorities × 5 efforts

      // Verify ordering is correct
      let lastPriorityValue = 0;
      let lastEffortValue = 0;

      for (const task of orderedTasks) {
        const priorityValue =
          task.priority === 'urgent' ? 1 :
          task.priority === 'high' ? 2 :
          task.priority === 'normal' ? 3 : 4;

        const effortValue =
          task.effort === 'xs' ? 1 :
          task.effort === 'small' ? 2 :
          task.effort === 'medium' ? 3 :
          task.effort === 'large' ? 4 : 5;

        // Priority should never decrease
        expect(priorityValue).toBeGreaterThanOrEqual(lastPriorityValue);

        // If same priority, effort should not decrease
        if (priorityValue === lastPriorityValue) {
          expect(effortValue).toBeGreaterThanOrEqual(lastEffortValue);
        }

        lastPriorityValue = priorityValue;
        lastEffortValue = priorityValue === lastPriorityValue ? effortValue : 0;
      }
    });
  });

  describe('Database Schema Validation', () => {
    it('should verify priority and effort columns exist in SQLite schema', async () => {
      // Get the database instance to check schema
      const db = store.getDatabase();

      // Query the schema for the tasks table
      const schemaQuery = db.prepare("PRAGMA table_info(tasks)");
      const columns = schemaQuery.all() as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: any;
        pk: number;
      }>;

      // Check that priority and effort columns exist
      const columnNames = columns.map(col => col.name);
      expect(columnNames).toContain('priority');
      expect(columnNames).toContain('effort');

      // Verify the columns have the correct types
      const priorityCol = columns.find(col => col.name === 'priority');
      const effortCol = columns.find(col => col.name === 'effort');

      expect(priorityCol).toBeDefined();
      expect(effortCol).toBeDefined();
      expect(priorityCol!.type).toBe('TEXT');
      expect(effortCol!.type).toBe('TEXT');
    });

    it('should verify priority values are properly stored and retrieved', async () => {
      const db = store.getDatabase();

      const task = createTestTask({
        id: 'schema_test',
        priority: 'high',
        effort: 'large',
      });

      await store.createTask(task);

      // Query the database directly to verify storage
      const query = db.prepare("SELECT priority, effort FROM tasks WHERE id = ?");
      const result = query.get('schema_test') as { priority: string; effort: string } | undefined;

      expect(result).toBeDefined();
      expect(result!.priority).toBe('high');
      expect(result!.effort).toBe('large');
    });
  });
});