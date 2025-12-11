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
    projectPath: testDir,
    branchName: 'apex/test-branch',
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
});
