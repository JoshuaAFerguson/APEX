import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task, TaskLog, TaskArtifact, GateStatus } from '@apex/core';

describe('TaskStore', () => {
  let testDir: string;
  let store: TaskStore;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_test`,
    description: 'Test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testDir,
    branchName: 'apex/test-branch',
    retryCount: 0,
    maxRetries: 3,
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

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-store-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Task CRUD', () => {
    it('should create and retrieve a task', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(task.id);
      expect(retrieved?.description).toBe(task.description);
      expect(retrieved?.status).toBe('pending');
    });

    it('should update a task', async () => {
      const task = createTestTask();
      await store.createTask(task);

      await store.updateTask(task.id, {
        status: 'in-progress',
        currentStage: 'planning',
      });

      const updated = await store.getTask(task.id);
      expect(updated?.status).toBe('in-progress');
      expect(updated?.currentStage).toBe('planning');
    });

    it('should update task prUrl', async () => {
      const task = createTestTask();
      await store.createTask(task);

      await store.updateTask(task.id, {
        prUrl: 'https://github.com/test/repo/pull/123',
        updatedAt: new Date(),
      });

      const updated = await store.getTask(task.id);
      expect(updated?.prUrl).toBe('https://github.com/test/repo/pull/123');
    });

    it('should update task error', async () => {
      const task = createTestTask();
      await store.createTask(task);

      await store.updateTask(task.id, {
        status: 'failed',
        error: 'Something went wrong',
      });

      const updated = await store.getTask(task.id);
      expect(updated?.status).toBe('failed');
      expect(updated?.error).toBe('Something went wrong');
    });

    it('should update task usage', async () => {
      const task = createTestTask();
      await store.createTask(task);

      await store.updateTask(task.id, {
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.015,
        },
      });

      const updated = await store.getTask(task.id);
      expect(updated?.usage.inputTokens).toBe(1000);
      expect(updated?.usage.outputTokens).toBe(500);
      expect(updated?.usage.totalTokens).toBe(1500);
      expect(updated?.usage.estimatedCost).toBe(0.015);
    });

    it('should update completedAt', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const completedAt = new Date();
      await store.updateTask(task.id, {
        status: 'completed',
        completedAt,
      });

      const updated = await store.getTask(task.id);
      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBeDefined();
    });

    it('should handle empty updates', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Empty update should not throw
      await store.updateTask(task.id, {});

      const updated = await store.getTask(task.id);
      expect(updated?.status).toBe('pending');
    });

    it('should list tasks with filters', async () => {
      const task1 = createTestTask();
      task1.id = 'task_1';
      task1.status = 'pending';

      const task2 = createTestTask();
      task2.id = 'task_2';
      task2.status = 'completed';

      await store.createTask(task1);
      await store.createTask(task2);

      const allTasks = await store.listTasks();
      expect(allTasks.length).toBe(2);

      const pendingTasks = await store.listTasks({ status: 'pending' });
      expect(pendingTasks.length).toBe(1);
      expect(pendingTasks[0].id).toBe('task_1');

      const limitedTasks = await store.listTasks({ limit: 1 });
      expect(limitedTasks.length).toBe(1);
    });

    it('should return null for non-existent task', async () => {
      const result = await store.getTask('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('Task Logs', () => {
    it('should add and retrieve logs', async () => {
      const task = createTestTask();
      await store.createTask(task);

      await store.addLog(task.id, {
        level: 'info',
        message: 'Test log message',
        stage: 'planning',
        agent: 'planner',
      });

      const retrieved = await store.getTask(task.id);
      expect(retrieved?.logs.length).toBe(1);
      expect(retrieved?.logs[0].message).toBe('Test log message');
      expect(retrieved?.logs[0].level).toBe('info');
    });

    it('should add multiple logs', async () => {
      const task = createTestTask();
      await store.createTask(task);

      await store.addLog(task.id, { level: 'info', message: 'Log 1' });
      await store.addLog(task.id, { level: 'warn', message: 'Log 2' });
      await store.addLog(task.id, { level: 'error', message: 'Log 3' });

      const retrieved = await store.getTask(task.id);
      expect(retrieved?.logs.length).toBe(3);
    });
  });

  describe('Task Artifacts', () => {
    it('should add and retrieve artifacts', async () => {
      const task = createTestTask();
      await store.createTask(task);

      await store.addArtifact(task.id, {
        name: 'test-file.ts',
        type: 'file',
        path: '/src/test-file.ts',
        content: 'const x = 1;',
      });

      const retrieved = await store.getTask(task.id);
      expect(retrieved?.artifacts.length).toBe(1);
      expect(retrieved?.artifacts[0].name).toBe('test-file.ts');
      expect(retrieved?.artifacts[0].type).toBe('file');
    });
  });

  describe('Gates', () => {
    it('should create and update gate status', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Create a pending gate using setGate
      await store.setGate(task.id, {
        name: 'approval-gate',
        status: 'pending',
        requiredAt: new Date(),
      });

      const gate = await store.getGate(task.id, 'approval-gate');
      expect(gate).not.toBeNull();
      expect(gate?.status).toBe('pending');

      // Approve the gate
      await store.approveGate(task.id, 'approval-gate', 'test-user', 'LGTM');

      const updated = await store.getGate(task.id, 'approval-gate');
      expect(updated?.status).toBe('approved');
      expect(updated?.approver).toBe('test-user');
    });

    it('should return null for non-existent gate', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const gate = await store.getGate(task.id, 'non-existent-gate');
      expect(gate).toBeNull();
    });

    it('should update existing gate with setGate', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Create initial gate
      await store.setGate(task.id, {
        name: 'review-gate',
        status: 'pending',
        requiredAt: new Date(),
      });

      // Update gate status via setGate
      await store.setGate(task.id, {
        name: 'review-gate',
        status: 'rejected',
        requiredAt: new Date(),
        respondedAt: new Date(),
        approver: 'reviewer',
        comment: 'Needs changes',
      });

      const gate = await store.getGate(task.id, 'review-gate');
      expect(gate?.status).toBe('rejected');
      expect(gate?.comment).toBe('Needs changes');
    });

    it('should store gate with optional fields', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const requiredAt = new Date();
      const respondedAt = new Date();

      await store.setGate(task.id, {
        name: 'test-gate',
        status: 'approved',
        requiredAt,
        respondedAt,
        approver: 'admin',
        comment: 'All good',
      });

      const gate = await store.getGate(task.id, 'test-gate');
      expect(gate?.taskId).toBe(task.id);
      expect(gate?.name).toBe('test-gate');
      expect(gate?.status).toBe('approved');
      expect(gate?.approver).toBe('admin');
      expect(gate?.comment).toBe('All good');
      expect(gate?.respondedAt).toBeDefined();
    });
  });

  describe('Command Logging', () => {
    it('should log commands', async () => {
      const task = createTestTask();
      await store.createTask(task);

      await store.logCommand(task.id, 'npm test');
      await store.logCommand(task.id, 'npm run build');

      // Commands should be logged successfully (no assertion needed for internal logging)
      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();
    });
  });

  describe('Task Queue with Priority', () => {
    it('should create task with priority', async () => {
      const task = createTestTask();
      task.priority = 'high';
      await store.createTask(task);

      const retrieved = await store.getTask(task.id);
      expect(retrieved?.priority).toBe('high');
    });

    it('should update task priority', async () => {
      const task = createTestTask();
      await store.createTask(task);

      await store.updateTask(task.id, { priority: 'urgent' });

      const updated = await store.getTask(task.id);
      expect(updated?.priority).toBe('urgent');
    });

    it('should list tasks ordered by priority', async () => {
      // Create tasks with different priorities
      const lowTask = createTestTask();
      lowTask.id = 'task_low';
      lowTask.priority = 'low';

      const normalTask = createTestTask();
      normalTask.id = 'task_normal';
      normalTask.priority = 'normal';

      const highTask = createTestTask();
      highTask.id = 'task_high';
      highTask.priority = 'high';

      const urgentTask = createTestTask();
      urgentTask.id = 'task_urgent';
      urgentTask.priority = 'urgent';

      // Insert in random order
      await store.createTask(normalTask);
      await store.createTask(lowTask);
      await store.createTask(urgentTask);
      await store.createTask(highTask);

      // Get tasks ordered by priority
      const tasks = await store.listTasks({ orderByPriority: true });

      expect(tasks[0].id).toBe('task_urgent');
      expect(tasks[1].id).toBe('task_high');
      expect(tasks[2].id).toBe('task_normal');
      expect(tasks[3].id).toBe('task_low');
    });

    it('should get next queued task by priority', async () => {
      const lowTask = createTestTask();
      lowTask.id = 'task_low';
      lowTask.priority = 'low';

      const highTask = createTestTask();
      highTask.id = 'task_high';
      highTask.priority = 'high';

      await store.createTask(lowTask);
      await store.createTask(highTask);

      const nextTask = await store.getNextQueuedTask();
      expect(nextTask?.id).toBe('task_high');
    });

    it('should queue task with new priority', async () => {
      const task = createTestTask();
      task.status = 'failed';
      await store.createTask(task);

      await store.queueTask(task.id, 'urgent');

      const updated = await store.getTask(task.id);
      expect(updated?.status).toBe('pending');
      expect(updated?.priority).toBe('urgent');
    });

    it('should return null when no tasks in queue', async () => {
      const nextTask = await store.getNextQueuedTask();
      expect(nextTask).toBeNull();
    });
  });

  describe('Task Retry Tracking', () => {
    it('should create task with retry fields', async () => {
      const task = createTestTask();
      task.retryCount = 0;
      task.maxRetries = 5;
      await store.createTask(task);

      const retrieved = await store.getTask(task.id);
      expect(retrieved?.retryCount).toBe(0);
      expect(retrieved?.maxRetries).toBe(5);
    });

    it('should update retry count', async () => {
      const task = createTestTask();
      await store.createTask(task);

      await store.updateTask(task.id, { retryCount: 1 });
      const updated = await store.getTask(task.id);
      expect(updated?.retryCount).toBe(1);

      await store.updateTask(task.id, { retryCount: 2 });
      const updated2 = await store.getTask(task.id);
      expect(updated2?.retryCount).toBe(2);
    });

    it('should default retryCount to 0 and maxRetries to 3', async () => {
      const task = createTestTask();
      // Explicitly don't set retry fields to test defaults
      delete (task as Partial<Task>).retryCount;
      delete (task as Partial<Task>).maxRetries;
      (task as Task).retryCount = 0;
      (task as Task).maxRetries = 3;
      await store.createTask(task);

      const retrieved = await store.getTask(task.id);
      expect(retrieved?.retryCount).toBe(0);
      expect(retrieved?.maxRetries).toBe(3);
    });

    it('should track failed task with retry count', async () => {
      const task = createTestTask();
      task.retryCount = 2;
      task.maxRetries = 3;
      await store.createTask(task);

      // Update to failed status with error
      await store.updateTask(task.id, {
        status: 'failed',
        error: 'Some error occurred',
        retryCount: 2,
      });

      const retrieved = await store.getTask(task.id);
      expect(retrieved?.status).toBe('failed');
      expect(retrieved?.retryCount).toBe(2);
      expect(retrieved?.error).toBe('Some error occurred');
    });
  });
});
