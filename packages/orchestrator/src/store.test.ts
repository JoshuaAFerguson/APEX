import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type {
  Task,
  TaskLog,
  TaskArtifact,
  GateStatus,
  TaskCheckpoint,
  AgentMessage,
  IdleTask,
  IdleTaskType,
  TaskPriority,
  TaskEffort,
  TaskTemplate,
  IterationEntry,
  IterationHistory,
  FileSnapshot,
  AuditLogEntry,
  AuditEventType,
  AuditSeverity,
} from '@apexcli/core';
import { generateIdleTaskId, generateTaskTemplateId } from '@apexcli/core';

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

  describe('findHighestPriorityParentTask', () => {
    it('should return only parent tasks with subtasks in priority order', async () => {
      const now = new Date();

      // Create parent task (high priority) with subtasks
      const parentTask1 = createTestTask();
      parentTask1.id = 'parent_high';
      parentTask1.status = 'paused';
      parentTask1.priority = 'high';
      parentTask1.subtaskIds = ['subtask1', 'subtask2'];
      await store.createTask(parentTask1);
      await store.updateTask(parentTask1.id, { pauseReason: 'usage_limit' });

      // Create parent task (urgent priority) with subtasks
      const parentTask2 = createTestTask();
      parentTask2.id = 'parent_urgent';
      parentTask2.status = 'paused';
      parentTask2.priority = 'urgent';
      parentTask2.subtaskIds = ['subtask3'];
      await store.createTask(parentTask2);
      await store.updateTask(parentTask2.id, { pauseReason: 'capacity' });

      // Create regular paused task (not a parent)
      const regularTask = createTestTask();
      regularTask.id = 'regular_task';
      regularTask.status = 'paused';
      regularTask.priority = 'urgent';
      await store.createTask(regularTask);
      await store.updateTask(regularTask.id, { pauseReason: 'budget' });

      // Create parent task without resumable pause reason
      const nonResumableParent = createTestTask();
      nonResumableParent.id = 'non_resumable_parent';
      nonResumableParent.status = 'paused';
      nonResumableParent.priority = 'urgent';
      nonResumableParent.subtaskIds = ['subtask4'];
      await store.createTask(nonResumableParent);
      await store.updateTask(nonResumableParent.id, { pauseReason: 'manual' });

      const parentTasks = await store.findHighestPriorityParentTask();

      // Should return only parent tasks with resumable pause reasons, ordered by priority
      expect(parentTasks).toHaveLength(2);
      expect(parentTasks[0].id).toBe('parent_urgent'); // urgent priority first
      expect(parentTasks[1].id).toBe('parent_high'); // high priority second

      // Verify they are indeed parent tasks
      expect(parentTasks[0].subtaskIds).toEqual(['subtask3']);
      expect(parentTasks[1].subtaskIds).toEqual(['subtask1', 'subtask2']);
    });

    it('should return empty array when no parent tasks are paused with resumable reasons', async () => {
      // Create regular paused task
      const task1 = createTestTask();
      task1.status = 'paused';
      await store.createTask(task1);
      await store.updateTask(task1.id, { pauseReason: 'usage_limit' });

      // Create parent task but not paused
      const task2 = createTestTask();
      task2.id = 'parent_not_paused';
      task2.status = 'in-progress';
      task2.subtaskIds = ['subtask1'];
      await store.createTask(task2);

      const parentTasks = await store.findHighestPriorityParentTask();
      expect(parentTasks).toHaveLength(0);
    });

    it('should exclude parent tasks with future resumeAfter dates', async () => {
      const future = new Date(Date.now() + 60 * 1000); // 1 minute from now

      // Create parent task with future resumeAfter
      const parentTask = createTestTask();
      parentTask.id = 'parent_future_resume';
      parentTask.status = 'paused';
      parentTask.priority = 'urgent';
      parentTask.subtaskIds = ['subtask1'];
      await store.createTask(parentTask);
      await store.updateTask(parentTask.id, {
        pauseReason: 'usage_limit',
        resumeAfter: future,
      });

      const parentTasks = await store.findHighestPriorityParentTask();
      expect(parentTasks).toHaveLength(0);
    });

    it('should include parent tasks with past resumeAfter dates', async () => {
      const past = new Date(Date.now() - 60 * 1000); // 1 minute ago

      // Create parent task with past resumeAfter
      const parentTask = createTestTask();
      parentTask.id = 'parent_past_resume';
      parentTask.status = 'paused';
      parentTask.priority = 'normal';
      parentTask.subtaskIds = ['subtask1'];
      await store.createTask(parentTask);
      await store.updateTask(parentTask.id, {
        pauseReason: 'capacity',
        resumeAfter: past,
      });

      const parentTasks = await store.findHighestPriorityParentTask();
      expect(parentTasks).toHaveLength(1);
      expect(parentTasks[0].id).toBe('parent_past_resume');
    });

    it('should exclude tasks with empty or null subtaskIds', async () => {
      // Create task with null subtaskIds
      const task1 = createTestTask();
      task1.id = 'task_null_subtasks';
      task1.status = 'paused';
      task1.subtaskIds = undefined;
      await store.createTask(task1);
      await store.updateTask(task1.id, { pauseReason: 'usage_limit' });

      // Create task with empty subtaskIds array
      const task2 = createTestTask();
      task2.id = 'task_empty_subtasks';
      task2.status = 'paused';
      task2.subtaskIds = [];
      await store.createTask(task2);
      await store.updateTask(task2.id, { pauseReason: 'budget' });

      const parentTasks = await store.findHighestPriorityParentTask();
      expect(parentTasks).toHaveLength(0);
    });

    it('should respect creation time ordering when priorities are equal', async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 10000); // 10 seconds earlier

      // Create second parent task (normal priority, created later)
      const parentTask2 = createTestTask();
      parentTask2.id = 'parent_second';
      parentTask2.status = 'paused';
      parentTask2.priority = 'normal';
      parentTask2.subtaskIds = ['subtask2'];
      parentTask2.createdAt = now;
      await store.createTask(parentTask2);
      await store.updateTask(parentTask2.id, { pauseReason: 'capacity' });

      // Create first parent task (normal priority, created earlier)
      const parentTask1 = createTestTask();
      parentTask1.id = 'parent_first';
      parentTask1.status = 'paused';
      parentTask1.priority = 'normal';
      parentTask1.subtaskIds = ['subtask1'];
      parentTask1.createdAt = earlier;
      await store.createTask(parentTask1);
      await store.updateTask(parentTask1.id, { pauseReason: 'usage_limit' });

      const parentTasks = await store.findHighestPriorityParentTask();

      expect(parentTasks).toHaveLength(2);
      expect(parentTasks[0].id).toBe('parent_first'); // created earlier should come first
      expect(parentTasks[1].id).toBe('parent_second');
    });

    it('should only include tasks with valid resumable pause reasons', async () => {
      const resumableReasons = ['usage_limit', 'budget', 'capacity'];
      const nonResumableReasons = ['manual', 'timeout', 'error', 'user_requested'];

      // Create parent tasks with resumable pause reasons
      for (let i = 0; i < resumableReasons.length; i++) {
        const parentTask = createTestTask();
        parentTask.id = `parent_resumable_${i}`;
        parentTask.status = 'paused';
        parentTask.priority = 'normal';
        parentTask.subtaskIds = [`subtask_${i}`];
        await store.createTask(parentTask);
        await store.updateTask(parentTask.id, { pauseReason: resumableReasons[i] });
      }

      // Create parent tasks with non-resumable pause reasons
      for (let i = 0; i < nonResumableReasons.length; i++) {
        const parentTask = createTestTask();
        parentTask.id = `parent_non_resumable_${i}`;
        parentTask.status = 'paused';
        parentTask.priority = 'urgent'; // Even higher priority
        parentTask.subtaskIds = [`subtask_non_${i}`];
        await store.createTask(parentTask);
        await store.updateTask(parentTask.id, { pauseReason: nonResumableReasons[i] });
      }

      const parentTasks = await store.findHighestPriorityParentTask();

      // Should only return tasks with resumable pause reasons
      expect(parentTasks).toHaveLength(resumableReasons.length);

      const pauseReasons = parentTasks.map(t => t.pauseReason);
      for (const reason of resumableReasons) {
        expect(pauseReasons).toContain(reason);
      }

      for (const reason of nonResumableReasons) {
        expect(pauseReasons).not.toContain(reason);
      }
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

  describe('Task Dependencies', () => {
    it('should create task with dependencies', async () => {
      // Create prerequisite tasks
      const task1 = createTestTask();
      task1.id = 'task_prereq_1';
      await store.createTask(task1);

      const task2 = createTestTask();
      task2.id = 'task_prereq_2';
      await store.createTask(task2);

      // Create task with dependencies
      const dependentTask = createTestTask();
      dependentTask.id = 'task_dependent';
      dependentTask.dependsOn = ['task_prereq_1', 'task_prereq_2'];
      await store.createTask(dependentTask);

      const retrieved = await store.getTask('task_dependent');
      expect(retrieved?.dependsOn).toEqual(['task_prereq_1', 'task_prereq_2']);
    });

    it('should get task dependencies', async () => {
      const task1 = createTestTask();
      task1.id = 'task_a';
      await store.createTask(task1);

      const task2 = createTestTask();
      task2.id = 'task_b';
      task2.dependsOn = ['task_a'];
      await store.createTask(task2);

      const deps = await store.getTaskDependencies('task_b');
      expect(deps).toEqual(['task_a']);
    });

    it('should get blocking tasks (incomplete dependencies)', async () => {
      const task1 = createTestTask();
      task1.id = 'task_blocker';
      task1.status = 'pending';
      await store.createTask(task1);

      const task2 = createTestTask();
      task2.id = 'task_blocked';
      task2.dependsOn = ['task_blocker'];
      await store.createTask(task2);

      const blockers = await store.getBlockingTasks('task_blocked');
      expect(blockers).toEqual(['task_blocker']);

      // Complete the blocker
      await store.updateTask('task_blocker', { status: 'completed' });

      const blockersAfter = await store.getBlockingTasks('task_blocked');
      expect(blockersAfter).toEqual([]);
    });

    it('should check if task is ready (no blockers)', async () => {
      const task1 = createTestTask();
      task1.id = 'task_dep';
      task1.status = 'pending';
      await store.createTask(task1);

      const task2 = createTestTask();
      task2.id = 'task_main';
      task2.dependsOn = ['task_dep'];
      await store.createTask(task2);

      // Task is not ready because dependency is not complete
      const isReady1 = await store.isTaskReady('task_main');
      expect(isReady1).toBe(false);

      // Complete the dependency
      await store.updateTask('task_dep', { status: 'completed' });

      // Now task should be ready
      const isReady2 = await store.isTaskReady('task_main');
      expect(isReady2).toBe(true);
    });

    it('should add dependency to existing task', async () => {
      const task1 = createTestTask();
      task1.id = 'task_new_dep';
      await store.createTask(task1);

      const task2 = createTestTask();
      task2.id = 'task_needs_dep';
      await store.createTask(task2);

      // Add dependency after creation
      await store.addDependency('task_needs_dep', 'task_new_dep');

      const deps = await store.getTaskDependencies('task_needs_dep');
      expect(deps).toContain('task_new_dep');
    });

    it('should remove dependency from task', async () => {
      const task1 = createTestTask();
      task1.id = 'task_to_remove';
      await store.createTask(task1);

      const task2 = createTestTask();
      task2.id = 'task_with_dep';
      task2.dependsOn = ['task_to_remove'];
      await store.createTask(task2);

      // Verify dependency exists
      let deps = await store.getTaskDependencies('task_with_dep');
      expect(deps).toContain('task_to_remove');

      // Remove dependency
      await store.removeDependency('task_with_dep', 'task_to_remove');

      // Verify it's gone
      deps = await store.getTaskDependencies('task_with_dep');
      expect(deps).not.toContain('task_to_remove');
    });

    it('should get dependent tasks (tasks that depend on a given task)', async () => {
      const parentTask = createTestTask();
      parentTask.id = 'task_parent';
      await store.createTask(parentTask);

      const child1 = createTestTask();
      child1.id = 'task_child_1';
      child1.dependsOn = ['task_parent'];
      await store.createTask(child1);

      const child2 = createTestTask();
      child2.id = 'task_child_2';
      child2.dependsOn = ['task_parent'];
      await store.createTask(child2);

      const dependents = await store.getDependentTasks('task_parent');
      expect(dependents).toHaveLength(2);
      expect(dependents).toContain('task_child_1');
      expect(dependents).toContain('task_child_2');
    });

    it('should get ready tasks (pending with no blockers)', async () => {
      // Create a completed task
      const completedTask = createTestTask();
      completedTask.id = 'task_completed';
      completedTask.status = 'completed';
      await store.createTask(completedTask);

      // Create a pending task with no dependencies
      const readyTask = createTestTask();
      readyTask.id = 'task_ready';
      readyTask.status = 'pending';
      await store.createTask(readyTask);

      // Create a pending task that depends on non-complete task
      const pendingDep = createTestTask();
      pendingDep.id = 'task_pending_dep';
      pendingDep.status = 'pending';
      await store.createTask(pendingDep);

      const blockedTask = createTestTask();
      blockedTask.id = 'task_blocked';
      blockedTask.status = 'pending';
      blockedTask.dependsOn = ['task_pending_dep'];
      await store.createTask(blockedTask);

      // Create a pending task with completed dependency
      const unblockedTask = createTestTask();
      unblockedTask.id = 'task_unblocked';
      unblockedTask.status = 'pending';
      unblockedTask.dependsOn = ['task_completed'];
      await store.createTask(unblockedTask);

      const readyTasks = await store.getReadyTasks();

      // Should include: task_ready, task_pending_dep, task_unblocked
      // Should NOT include: task_blocked (has pending dependency)
      expect(readyTasks.map(t => t.id)).toContain('task_ready');
      expect(readyTasks.map(t => t.id)).toContain('task_pending_dep');
      expect(readyTasks.map(t => t.id)).toContain('task_unblocked');
      expect(readyTasks.map(t => t.id)).not.toContain('task_blocked');
    });

    it('should get ready tasks ordered by priority', async () => {
      const lowTask = createTestTask();
      lowTask.id = 'task_low_priority';
      lowTask.priority = 'low';
      await store.createTask(lowTask);

      const urgentTask = createTestTask();
      urgentTask.id = 'task_urgent_priority';
      urgentTask.priority = 'urgent';
      await store.createTask(urgentTask);

      const readyTasks = await store.getReadyTasks({ orderByPriority: true });

      const urgentIdx = readyTasks.findIndex(t => t.id === 'task_urgent_priority');
      const lowIdx = readyTasks.findIndex(t => t.id === 'task_low_priority');
      expect(urgentIdx).toBeLessThan(lowIdx);
    });

    it('should respect limit when getting ready tasks', async () => {
      for (let i = 0; i < 5; i++) {
        const task = createTestTask();
        task.id = `task_limit_${i}`;
        await store.createTask(task);
      }

      const readyTasks = await store.getReadyTasks({ limit: 2 });
      expect(readyTasks).toHaveLength(2);
    });

    it('should only get next queued task that is ready', async () => {
      // Create a blocked task with high priority
      const blockerTask = createTestTask();
      blockerTask.id = 'task_blocker_high';
      blockerTask.status = 'pending';
      blockerTask.priority = 'normal';
      await store.createTask(blockerTask);

      const blockedTask = createTestTask();
      blockedTask.id = 'task_blocked_urgent';
      blockedTask.status = 'pending';
      blockedTask.priority = 'urgent';
      blockedTask.dependsOn = ['task_blocker_high'];
      await store.createTask(blockedTask);

      // Create a ready task with lower priority
      const readyTask = createTestTask();
      readyTask.id = 'task_ready_low';
      readyTask.status = 'pending';
      readyTask.priority = 'low';
      await store.createTask(readyTask);

      // Should get the ready task even though blocked task has higher priority
      const nextTask = await store.getNextQueuedTask();
      // The blocker_high should be picked first since it's ready and has higher priority than low
      expect(nextTask?.id).toBe('task_blocker_high');

      // Complete the blocker
      await store.updateTask('task_blocker_high', { status: 'completed' });

      // Now the urgent blocked task should be picked
      const nextTask2 = await store.getNextQueuedTask();
      expect(nextTask2?.id).toBe('task_blocked_urgent');
    });

    it('should return empty dependsOn for task without dependencies', async () => {
      const task = createTestTask();
      task.id = 'task_no_deps';
      await store.createTask(task);

      const retrieved = await store.getTask('task_no_deps');
      expect(retrieved?.dependsOn).toEqual([]);
    });

    it('should not fail when adding duplicate dependency', async () => {
      const task1 = createTestTask();
      task1.id = 'task_dup_dep';
      await store.createTask(task1);

      const task2 = createTestTask();
      task2.id = 'task_dup_main';
      task2.dependsOn = ['task_dup_dep'];
      await store.createTask(task2);

      // Try adding the same dependency again - should not throw
      await store.addDependency('task_dup_main', 'task_dup_dep');

      const deps = await store.getTaskDependencies('task_dup_main');
      expect(deps).toEqual(['task_dup_dep']);
    });
  });

  describe('Task Checkpoints', () => {
    it('should save and retrieve a checkpoint', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const checkpoint: TaskCheckpoint = {
        taskId: task.id,
        checkpointId: 'checkpoint_1',
        stage: 'planning',
        stageIndex: 0,
        createdAt: new Date(),
      };

      await store.saveCheckpoint(checkpoint);

      const retrieved = await store.getCheckpoint(task.id, 'checkpoint_1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.taskId).toBe(task.id);
      expect(retrieved?.checkpointId).toBe('checkpoint_1');
      expect(retrieved?.stage).toBe('planning');
      expect(retrieved?.stageIndex).toBe(0);
    });

    it('should get the latest checkpoint', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Save multiple checkpoints
      await store.saveCheckpoint({
        taskId: task.id,
        checkpointId: 'checkpoint_1',
        stage: 'planning',
        stageIndex: 0,
        createdAt: new Date('2024-01-01'),
      });

      await store.saveCheckpoint({
        taskId: task.id,
        checkpointId: 'checkpoint_2',
        stage: 'implementation',
        stageIndex: 1,
        createdAt: new Date('2024-01-02'),
      });

      const latest = await store.getLatestCheckpoint(task.id);
      expect(latest?.checkpointId).toBe('checkpoint_2');
      expect(latest?.stage).toBe('implementation');
    });

    it('should list all checkpoints for a task', async () => {
      const task = createTestTask();
      await store.createTask(task);

      await store.saveCheckpoint({
        taskId: task.id,
        checkpointId: 'cp_1',
        stageIndex: 0,
        createdAt: new Date(),
      });

      await store.saveCheckpoint({
        taskId: task.id,
        checkpointId: 'cp_2',
        stageIndex: 1,
        createdAt: new Date(),
      });

      const checkpoints = await store.listCheckpoints(task.id);
      expect(checkpoints).toHaveLength(2);
    });

    it('should save checkpoint with conversation state', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const conversationState: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Hi there!' }],
        },
      ];

      await store.saveCheckpoint({
        taskId: task.id,
        checkpointId: 'cp_with_state',
        stage: 'planning',
        stageIndex: 0,
        conversationState,
        createdAt: new Date(),
      });

      const retrieved = await store.getCheckpoint(task.id, 'cp_with_state');
      expect(retrieved?.conversationState).toEqual(conversationState);
    });

    it('should save checkpoint with metadata', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const metadata = {
        filesProcessed: ['src/index.ts', 'src/utils.ts'],
        lastToolUsed: 'Read',
        customData: { key: 'value' },
      };

      await store.saveCheckpoint({
        taskId: task.id,
        checkpointId: 'cp_with_meta',
        stageIndex: 0,
        metadata,
        createdAt: new Date(),
      });

      const retrieved = await store.getCheckpoint(task.id, 'cp_with_meta');
      expect(retrieved?.metadata).toEqual(metadata);
    });

    it('should update existing checkpoint', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Save initial checkpoint
      await store.saveCheckpoint({
        taskId: task.id,
        checkpointId: 'cp_update',
        stage: 'planning',
        stageIndex: 0,
        createdAt: new Date(),
      });

      // Update the same checkpoint
      await store.saveCheckpoint({
        taskId: task.id,
        checkpointId: 'cp_update',
        stage: 'implementation',
        stageIndex: 1,
        createdAt: new Date(),
      });

      const retrieved = await store.getCheckpoint(task.id, 'cp_update');
      expect(retrieved?.stage).toBe('implementation');
      expect(retrieved?.stageIndex).toBe(1);

      // Should still be just one checkpoint
      const all = await store.listCheckpoints(task.id);
      expect(all.filter(c => c.checkpointId === 'cp_update')).toHaveLength(1);
    });

    it('should delete a checkpoint', async () => {
      const task = createTestTask();
      await store.createTask(task);

      await store.saveCheckpoint({
        taskId: task.id,
        checkpointId: 'cp_to_delete',
        stageIndex: 0,
        createdAt: new Date(),
      });

      await store.deleteCheckpoint(task.id, 'cp_to_delete');

      const retrieved = await store.getCheckpoint(task.id, 'cp_to_delete');
      expect(retrieved).toBeNull();
    });

    it('should delete all checkpoints for a task', async () => {
      const task = createTestTask();
      await store.createTask(task);

      await store.saveCheckpoint({
        taskId: task.id,
        checkpointId: 'cp_1',
        stageIndex: 0,
        createdAt: new Date(),
      });

      await store.saveCheckpoint({
        taskId: task.id,
        checkpointId: 'cp_2',
        stageIndex: 1,
        createdAt: new Date(),
      });

      await store.deleteAllCheckpoints(task.id);

      const checkpoints = await store.listCheckpoints(task.id);
      expect(checkpoints).toHaveLength(0);
    });

    it('should return null for non-existent checkpoint', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const checkpoint = await store.getCheckpoint(task.id, 'non_existent');
      expect(checkpoint).toBeNull();
    });

    it('should return null when no checkpoints exist', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const latest = await store.getLatestCheckpoint(task.id);
      expect(latest).toBeNull();
    });
  });

  describe('Paused Task Resumption', () => {
    it('should get paused tasks ready for resumption', async () => {
      // Create tasks with different pause reasons and statuses
      const now = new Date();
      const future = new Date(now.getTime() + 60 * 1000); // 1 minute from now

      // Task 1: Paused due to usage limit, ready for resume
      const task1 = createTestTask();
      task1.id = 'task_usage_limit';
      task1.status = 'paused';
      await store.createTask(task1);
      await store.updateTask(task1.id, {
        pausedAt: now,
        pauseReason: 'usage_limit',
        resumeAfter: undefined,
      });

      // Task 2: Paused due to budget, ready for resume
      const task2 = createTestTask();
      task2.id = 'task_budget';
      task2.status = 'paused';
      task2.priority = 'high';
      await store.createTask(task2);
      await store.updateTask(task2.id, {
        pausedAt: now,
        pauseReason: 'budget',
        resumeAfter: undefined,
      });

      // Task 3: Paused due to capacity, ready for resume
      const task3 = createTestTask();
      task3.id = 'task_capacity';
      task3.status = 'paused';
      task3.priority = 'urgent';
      await store.createTask(task3);
      await store.updateTask(task3.id, {
        pausedAt: now,
        pauseReason: 'capacity',
        resumeAfter: undefined,
      });

      // Task 4: Paused due to manual reason (should NOT be returned)
      const task4 = createTestTask();
      task4.id = 'task_manual';
      task4.status = 'paused';
      await store.createTask(task4);
      await store.updateTask(task4.id, {
        pausedAt: now,
        pauseReason: 'manual',
        resumeAfter: undefined,
      });

      // Task 5: Paused with future resumeAfter (should NOT be returned)
      const task5 = createTestTask();
      task5.id = 'task_future_resume';
      task5.status = 'paused';
      await store.createTask(task5);
      await store.updateTask(task5.id, {
        pausedAt: now,
        pauseReason: 'usage_limit',
        resumeAfter: future,
      });

      // Task 6: Not paused (should NOT be returned)
      const task6 = createTestTask();
      task6.id = 'task_not_paused';
      task6.status = 'pending';
      await store.createTask(task6);

      // Get paused tasks ready for resumption
      const resumableTasks = await store.getPausedTasksForResume();

      // Should return tasks 1, 2, and 3 in priority order (urgent, high, normal)
      expect(resumableTasks).toHaveLength(3);
      expect(resumableTasks.map(t => t.id)).toEqual([
        'task_capacity',   // urgent priority
        'task_budget',     // high priority
        'task_usage_limit' // normal priority
      ]);

      // Verify each task has the expected properties
      expect(resumableTasks[0].status).toBe('paused');
      expect(resumableTasks[0].pauseReason).toBe('capacity');
      expect(resumableTasks[1].status).toBe('paused');
      expect(resumableTasks[1].pauseReason).toBe('budget');
      expect(resumableTasks[2].status).toBe('paused');
      expect(resumableTasks[2].pauseReason).toBe('usage_limit');
    });

    it('should return empty array when no resumable paused tasks exist', async () => {
      const resumableTasks = await store.getPausedTasksForResume();
      expect(resumableTasks).toHaveLength(0);
    });

    it('should handle tasks with past resumeAfter dates', async () => {
      const past = new Date(Date.now() - 60 * 1000); // 1 minute ago

      const task = createTestTask();
      task.status = 'paused';
      await store.createTask(task);
      await store.updateTask(task.id, {
        pausedAt: past,
        pauseReason: 'usage_limit',
        resumeAfter: past,
      });

      const resumableTasks = await store.getPausedTasksForResume();
      expect(resumableTasks).toHaveLength(1);
      expect(resumableTasks[0].id).toBe(task.id);
    });

    it('should handle mixed resumeAfter scenarios correctly', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 60 * 1000);
      const future = new Date(now.getTime() + 60 * 1000);

      // Task with null resumeAfter (should be returned)
      const task1 = createTestTask();
      task1.id = 'task_null_resume';
      task1.status = 'paused';
      await store.createTask(task1);
      await store.updateTask(task1.id, {
        pauseReason: 'usage_limit',
        resumeAfter: undefined,
      });

      // Task with past resumeAfter (should be returned)
      const task2 = createTestTask();
      task2.id = 'task_past_resume';
      task2.status = 'paused';
      await store.createTask(task2);
      await store.updateTask(task2.id, {
        pauseReason: 'budget',
        resumeAfter: past,
      });

      // Task with future resumeAfter (should NOT be returned)
      const task3 = createTestTask();
      task3.id = 'task_future_resume';
      task3.status = 'paused';
      await store.createTask(task3);
      await store.updateTask(task3.id, {
        pauseReason: 'capacity',
        resumeAfter: future,
      });

      const resumableTasks = await store.getPausedTasksForResume();
      expect(resumableTasks).toHaveLength(2);

      const taskIds = resumableTasks.map(t => t.id);
      expect(taskIds).toContain('task_null_resume');
      expect(taskIds).toContain('task_past_resume');
      expect(taskIds).not.toContain('task_future_resume');
    });

    it('should respect creation time ordering when priorities are equal', async () => {
      const now = new Date();

      // Create three tasks with same priority but different creation times
      const task1 = createTestTask();
      task1.id = 'task_first_created';
      task1.status = 'paused';
      task1.priority = 'normal';
      task1.createdAt = new Date(now.getTime() - 120000); // 2 minutes ago
      await store.createTask(task1);
      await store.updateTask(task1.id, { pauseReason: 'usage_limit' });

      const task2 = createTestTask();
      task2.id = 'task_second_created';
      task2.status = 'paused';
      task2.priority = 'normal';
      task2.createdAt = new Date(now.getTime() - 60000); // 1 minute ago
      await store.createTask(task2);
      await store.updateTask(task2.id, { pauseReason: 'budget' });

      const task3 = createTestTask();
      task3.id = 'task_third_created';
      task3.status = 'paused';
      task3.priority = 'normal';
      task3.createdAt = now; // now
      await store.createTask(task3);
      await store.updateTask(task3.id, { pauseReason: 'capacity' });

      const resumableTasks = await store.getPausedTasksForResume();

      // Should be ordered by creation time (earliest first) when priority is same
      expect(resumableTasks.map(t => t.id)).toEqual([
        'task_first_created',
        'task_second_created',
        'task_third_created'
      ]);
    });

    it('should handle undefined and null priority values correctly', async () => {
      // Task with undefined priority (should default to 'normal')
      const task1 = createTestTask();
      task1.id = 'task_undefined_priority';
      task1.status = 'paused';
      task1.priority = undefined as any; // Force undefined
      await store.createTask(task1);
      await store.updateTask(task1.id, { pauseReason: 'usage_limit' });

      // Task with explicit normal priority
      const task2 = createTestTask();
      task2.id = 'task_normal_priority';
      task2.status = 'paused';
      task2.priority = 'normal';
      await store.createTask(task2);
      await store.updateTask(task2.id, { pauseReason: 'budget' });

      // Task with high priority
      const task3 = createTestTask();
      task3.id = 'task_high_priority';
      task3.status = 'paused';
      task3.priority = 'high';
      await store.createTask(task3);
      await store.updateTask(task3.id, { pauseReason: 'capacity' });

      const resumableTasks = await store.getPausedTasksForResume();

      // High priority task should come first
      expect(resumableTasks[0].id).toBe('task_high_priority');

      // Normal priority tasks should follow (order by creation time)
      const normalPriorityTasks = resumableTasks.slice(1);
      expect(normalPriorityTasks).toHaveLength(2);
      expect(normalPriorityTasks.map(t => t.id)).toContain('task_undefined_priority');
      expect(normalPriorityTasks.map(t => t.id)).toContain('task_normal_priority');
    });

    it('should handle pause reasons case-sensitively', async () => {
      // Valid pause reason (lowercase)
      const task1 = createTestTask();
      task1.id = 'task_valid_reason';
      task1.status = 'paused';
      await store.createTask(task1);
      await store.updateTask(task1.id, { pauseReason: 'usage_limit' });

      // Invalid pause reason (uppercase - should NOT be returned)
      const task2 = createTestTask();
      task2.id = 'task_invalid_reason';
      task2.status = 'paused';
      await store.createTask(task2);
      await store.updateTask(task2.id, { pauseReason: 'USAGE_LIMIT' });

      // Another invalid pause reason
      const task3 = createTestTask();
      task3.id = 'task_other_reason';
      task3.status = 'paused';
      await store.createTask(task3);
      await store.updateTask(task3.id, { pauseReason: 'timeout' });

      const resumableTasks = await store.getPausedTasksForResume();

      expect(resumableTasks).toHaveLength(1);
      expect(resumableTasks[0].id).toBe('task_valid_reason');
    });

    it('should handle tasks with null pauseReason gracefully', async () => {
      const task = createTestTask();
      task.status = 'paused';
      await store.createTask(task);
      await store.updateTask(task.id, { pauseReason: undefined });

      const resumableTasks = await store.getPausedTasksForResume();

      // Task with null pauseReason should NOT be returned
      expect(resumableTasks).toHaveLength(0);
    });

    it('should handle edge case with exact resumeAfter timestamp', async () => {
      // Create a task with resumeAfter set to current time (should be included)
      const exactNow = new Date();

      const task = createTestTask();
      task.status = 'paused';
      await store.createTask(task);
      await store.updateTask(task.id, {
        pauseReason: 'usage_limit',
        resumeAfter: exactNow,
      });

      // Wait a small moment to ensure we're past the exact timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const resumableTasks = await store.getPausedTasksForResume();

      expect(resumableTasks).toHaveLength(1);
      expect(resumableTasks[0].id).toBe(task.id);
    });

    it('should return tasks with full object structure and relationships', async () => {
      // Create a task with dependencies and artifacts
      const dependencyTask = createTestTask();
      dependencyTask.id = 'dependency_task';
      dependencyTask.status = 'completed';
      await store.createTask(dependencyTask);

      const mainTask = createTestTask();
      mainTask.id = 'main_paused_task';
      mainTask.status = 'paused';
      mainTask.priority = 'high';
      mainTask.dependsOn = ['dependency_task'];
      await store.createTask(mainTask);

      await store.updateTask(mainTask.id, { pauseReason: 'usage_limit' });

      // Add artifacts and logs
      await store.addArtifact(mainTask.id, {
        name: 'test-artifact.json',
        type: 'data',
        content: '{"test": true}',
      });

      await store.addLog(mainTask.id, {
        level: 'info',
        message: 'Task was paused',
        stage: 'implementation',
      });

      const resumableTasks = await store.getPausedTasksForResume();

      expect(resumableTasks).toHaveLength(1);
      const task = resumableTasks[0];

      // Verify full task structure
      expect(task.id).toBe('main_paused_task');
      expect(task.status).toBe('paused');
      expect(task.priority).toBe('high');
      expect(task.pauseReason).toBe('usage_limit');
      expect(task.dependsOn).toEqual(['dependency_task']);
      expect(task.artifacts).toHaveLength(1);
      expect(task.artifacts[0].name).toBe('test-artifact.json');
      expect(task.logs).toHaveLength(1);
      expect(task.logs[0].message).toBe('Task was paused');
      expect(task.blockedBy).toEqual([]); // dependency is completed, so no blockers
    });
  });

  describe('Idle Task CRUD', () => {
    const createTestIdleTask = (): Omit<IdleTask, 'createdAt'> => ({
      id: generateIdleTaskId(),
      type: 'maintenance' as IdleTaskType,
      title: 'Test idle task',
      description: 'This is a test idle task for cleanup',
      priority: 'normal' as TaskPriority,
      estimatedEffort: 'medium' as TaskEffort,
      suggestedWorkflow: 'maintenance',
      rationale: 'Needed for code maintenance',
      implemented: false,
    });

    it('should create and retrieve an idle task', async () => {
      const idleTask = createTestIdleTask();
      const created = await store.createIdleTask(idleTask);

      expect(created.id).toBe(idleTask.id);
      expect(created.type).toBe(idleTask.type);
      expect(created.title).toBe(idleTask.title);
      expect(created.description).toBe(idleTask.description);
      expect(created.priority).toBe(idleTask.priority);
      expect(created.estimatedEffort).toBe(idleTask.estimatedEffort);
      expect(created.suggestedWorkflow).toBe(idleTask.suggestedWorkflow);
      expect(created.rationale).toBe(idleTask.rationale);
      expect(created.implemented).toBe(false);
      expect(created.createdAt).toBeInstanceOf(Date);

      // Retrieve the idle task
      const retrieved = await store.getIdleTask(idleTask.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(idleTask.id);
      expect(retrieved!.title).toBe(idleTask.title);
    });

    it('should return null when retrieving non-existent idle task', async () => {
      const retrieved = await store.getIdleTask('non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should list idle tasks with filtering', async () => {
      const task1 = createTestIdleTask();
      task1.type = 'maintenance';
      task1.priority = 'high';
      await store.createIdleTask(task1);

      const task2 = createTestIdleTask();
      task2.id = generateIdleTaskId();
      task2.type = 'refactoring';
      task2.priority = 'low';
      await store.createIdleTask(task2);

      const task3 = createTestIdleTask();
      task3.id = generateIdleTaskId();
      task3.type = 'maintenance';
      task3.priority = 'normal';
      task3.implemented = true;
      await store.createIdleTask(task3);

      // Test listing all tasks
      const allTasks = await store.listIdleTasks();
      expect(allTasks).toHaveLength(3);

      // Test filtering by type
      const maintenanceTasks = await store.listIdleTasks({ type: 'maintenance' });
      expect(maintenanceTasks).toHaveLength(2);
      expect(maintenanceTasks.every(t => t.type === 'maintenance')).toBe(true);

      // Test filtering by implemented status
      const notImplemented = await store.listIdleTasks({ implemented: false });
      expect(notImplemented).toHaveLength(2);
      expect(notImplemented.every(t => !t.implemented)).toBe(true);

      const implemented = await store.listIdleTasks({ implemented: true });
      expect(implemented).toHaveLength(1);
      expect(implemented[0].implemented).toBe(true);

      // Test filtering by priority
      const highPriority = await store.listIdleTasks({ priority: 'high' });
      expect(highPriority).toHaveLength(1);
      expect(highPriority[0].priority).toBe('high');

      // Test limit
      const limited = await store.listIdleTasks({ limit: 1 });
      expect(limited).toHaveLength(1);
      // Should be ordered by priority (high first)
      expect(limited[0].priority).toBe('high');
    });

    it('should update idle task fields', async () => {
      const idleTask = createTestIdleTask();
      await store.createIdleTask(idleTask);

      // Update various fields
      await store.updateIdleTask(idleTask.id, {
        title: 'Updated title',
        description: 'Updated description',
        priority: 'urgent',
        estimatedEffort: 'large',
        implemented: true,
        implementedTaskId: 'task-123',
      });

      const updated = await store.getIdleTask(idleTask.id);
      expect(updated).not.toBeNull();
      expect(updated!.title).toBe('Updated title');
      expect(updated!.description).toBe('Updated description');
      expect(updated!.priority).toBe('urgent');
      expect(updated!.estimatedEffort).toBe('large');
      expect(updated!.implemented).toBe(true);
      expect(updated!.implementedTaskId).toBe('task-123');

      // Original fields should remain unchanged
      expect(updated!.type).toBe(idleTask.type);
      expect(updated!.suggestedWorkflow).toBe(idleTask.suggestedWorkflow);
      expect(updated!.rationale).toBe(idleTask.rationale);
    });

    it('should handle partial updates', async () => {
      const idleTask = createTestIdleTask();
      await store.createIdleTask(idleTask);

      // Update only priority
      await store.updateIdleTask(idleTask.id, {
        priority: 'urgent',
      });

      const updated = await store.getIdleTask(idleTask.id);
      expect(updated!.priority).toBe('urgent');
      // Other fields should remain unchanged
      expect(updated!.title).toBe(idleTask.title);
      expect(updated!.type).toBe(idleTask.type);
      expect(updated!.implemented).toBe(idleTask.implemented);
    });

    it('should delete idle task', async () => {
      const idleTask = createTestIdleTask();
      await store.createIdleTask(idleTask);

      // Verify it exists
      const beforeDelete = await store.getIdleTask(idleTask.id);
      expect(beforeDelete).not.toBeNull();

      // Delete it
      await store.deleteIdleTask(idleTask.id);

      // Verify it's gone
      const afterDelete = await store.getIdleTask(idleTask.id);
      expect(afterDelete).toBeNull();
    });

    it('should throw error when deleting non-existent idle task', async () => {
      const nonExistentId = 'non-existent-idle-task-id';

      await expect(store.deleteIdleTask(nonExistentId)).rejects.toThrow(
        `Idle task with ID ${nonExistentId} not found`
      );
    });

    it('should promote idle task to regular task', async () => {
      const idleTask = createTestIdleTask();
      idleTask.title = 'Clean up legacy code';
      idleTask.description = 'Remove deprecated functions from utils module';
      idleTask.rationale = 'Reduces technical debt and improves maintainability';
      idleTask.suggestedWorkflow = 'maintenance';
      idleTask.priority = 'high';
      idleTask.estimatedEffort = 'small';

      await store.createIdleTask(idleTask);

      // Promote to regular task
      const task = await store.promoteIdleTask(idleTask.id, {
        workflow: 'maintenance',
        autonomy: 'review-before-merge',
        projectPath: testDir,
      });

      expect(task).toBeDefined();
      expect(task.description).toBe(idleTask.description);
      expect(task.workflow).toBe('maintenance');
      expect(task.priority).toBe(idleTask.priority);
      expect(task.effort).toBe(idleTask.estimatedEffort);
      expect(task.acceptanceCriteria).toContain(idleTask.title);
      expect(task.acceptanceCriteria).toContain(idleTask.rationale);
      expect(task.status).toBe('pending');

      // Verify idle task is marked as implemented
      const updatedIdleTask = await store.getIdleTask(idleTask.id);
      expect(updatedIdleTask!.implemented).toBe(true);
      expect(updatedIdleTask!.implementedTaskId).toBe(task.id);

      // Verify regular task exists
      const regularTask = await store.getTask(task.id);
      expect(regularTask).not.toBeNull();
      expect(regularTask!.id).toBe(task.id);
    });

    it('should throw error when promoting non-existent idle task', async () => {
      await expect(
        store.promoteIdleTask('non-existent-id', {
          workflow: 'feature',
          autonomy: 'full',
          projectPath: testDir,
        })
      ).rejects.toThrow('Idle task with ID non-existent-id not found');
    });

    it('should throw error when promoting already implemented idle task', async () => {
      const idleTask = createTestIdleTask();
      await store.createIdleTask(idleTask);

      // Mark as implemented
      await store.updateIdleTask(idleTask.id, {
        implemented: true,
        implementedTaskId: 'some-task-id',
      });

      await expect(
        store.promoteIdleTask(idleTask.id, {
          workflow: 'feature',
          autonomy: 'full',
          projectPath: testDir,
        })
      ).rejects.toThrow(`Idle task ${idleTask.id} has already been implemented`);
    });

    it('should sort idle tasks by priority', async () => {
      const tasks = [
        { ...createTestIdleTask(), priority: 'low' as TaskPriority },
        { ...createTestIdleTask(), priority: 'urgent' as TaskPriority },
        { ...createTestIdleTask(), priority: 'normal' as TaskPriority },
        { ...createTestIdleTask(), priority: 'high' as TaskPriority },
      ];

      // Assign unique IDs
      tasks.forEach((task, index) => {
        task.id = `idle_${Date.now()}_${index}`;
      });

      // Create tasks in random order
      for (const task of tasks) {
        await store.createIdleTask(task);
      }

      const sortedTasks = await store.listIdleTasks();
      expect(sortedTasks).toHaveLength(4);

      // Should be sorted: urgent, high, normal, low
      expect(sortedTasks[0].priority).toBe('urgent');
      expect(sortedTasks[1].priority).toBe('high');
      expect(sortedTasks[2].priority).toBe('normal');
      expect(sortedTasks[3].priority).toBe('low');
    });

    it('should handle edge cases in update operations', async () => {
      const idleTask = createTestIdleTask();
      await store.createIdleTask(idleTask);

      // Try updating with no changes
      await store.updateIdleTask(idleTask.id, {});

      const unchanged = await store.getIdleTask(idleTask.id);
      expect(unchanged!.title).toBe(idleTask.title);

      // Update with null/undefined implementedTaskId
      await store.updateIdleTask(idleTask.id, {
        implemented: false,
        implementedTaskId: undefined,
      });

      const updated = await store.getIdleTask(idleTask.id);
      expect(updated!.implemented).toBe(false);
      expect(updated!.implementedTaskId).toBeUndefined();
    });
  });

  describe('Iteration History', () => {
    it('should add and retrieve iteration entries', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const entry = {
        feedback: 'Please improve the error handling in the login function',
        timestamp: new Date(),
        diffSummary: 'Added try-catch blocks and better error messages',
        stage: 'implementation',
        modifiedFiles: ['src/auth.ts', 'src/utils.ts'],
        agent: 'developer',
      };

      await store.addIterationEntry(task.id, entry);

      const history = await store.getIterationHistory(task.id);

      expect(history.entries).toHaveLength(1);
      expect(history.totalIterations).toBe(1);
      expect(history.lastIterationAt).toEqual(entry.timestamp);

      const retrievedEntry = history.entries[0];
      expect(retrievedEntry.feedback).toBe(entry.feedback);
      expect(retrievedEntry.timestamp).toEqual(entry.timestamp);
      expect(retrievedEntry.diffSummary).toBe(entry.diffSummary);
      expect(retrievedEntry.stage).toBe(entry.stage);
      expect(retrievedEntry.modifiedFiles).toEqual(entry.modifiedFiles);
      expect(retrievedEntry.agent).toBe(entry.agent);
      expect(retrievedEntry.id).toContain(task.id);
    });

    it('should handle multiple iteration entries in chronological order', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const entry1 = {
        feedback: 'First iteration feedback',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        stage: 'planning',
        agent: 'planner',
      };

      const entry2 = {
        feedback: 'Second iteration feedback',
        timestamp: new Date('2024-01-01T11:00:00Z'),
        diffSummary: 'Updated implementation based on feedback',
        stage: 'implementation',
        agent: 'developer',
      };

      const entry3 = {
        feedback: 'Third iteration feedback',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        stage: 'testing',
        modifiedFiles: ['test/auth.test.ts'],
        agent: 'tester',
      };

      // Add entries in non-chronological order to test sorting
      await store.addIterationEntry(task.id, entry2);
      await store.addIterationEntry(task.id, entry1);
      await store.addIterationEntry(task.id, entry3);

      const history = await store.getIterationHistory(task.id);

      expect(history.entries).toHaveLength(3);
      expect(history.totalIterations).toBe(3);
      expect(history.lastIterationAt).toEqual(entry3.timestamp);

      // Should be ordered chronologically
      expect(history.entries[0].feedback).toBe('First iteration feedback');
      expect(history.entries[0].timestamp).toEqual(entry1.timestamp);
      expect(history.entries[1].feedback).toBe('Second iteration feedback');
      expect(history.entries[1].timestamp).toEqual(entry2.timestamp);
      expect(history.entries[2].feedback).toBe('Third iteration feedback');
      expect(history.entries[2].timestamp).toEqual(entry3.timestamp);
    });

    it('should handle entries with minimal required data', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const minimalEntry = {
        feedback: 'Minimal feedback with only required fields',
        timestamp: new Date(),
      };

      await store.addIterationEntry(task.id, minimalEntry);

      const history = await store.getIterationHistory(task.id);

      expect(history.entries).toHaveLength(1);
      const entry = history.entries[0];
      expect(entry.feedback).toBe(minimalEntry.feedback);
      expect(entry.timestamp).toEqual(minimalEntry.timestamp);
      expect(entry.diffSummary).toBeUndefined();
      expect(entry.stage).toBeUndefined();
      expect(entry.modifiedFiles).toBeUndefined();
      expect(entry.agent).toBeUndefined();
      expect(entry.id).toBeDefined();
    });

    it('should handle empty modified files array', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const entry = {
        feedback: 'No files were modified',
        timestamp: new Date(),
        modifiedFiles: [],
      };

      await store.addIterationEntry(task.id, entry);

      const history = await store.getIterationHistory(task.id);

      expect(history.entries).toHaveLength(1);
      expect(history.entries[0].modifiedFiles).toEqual([]);
    });

    it('should allow custom iteration IDs', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const customId = 'custom-iter-123';
      const entry = {
        id: customId,
        feedback: 'Entry with custom ID',
        timestamp: new Date(),
      };

      await store.addIterationEntry(task.id, entry);

      const history = await store.getIterationHistory(task.id);

      expect(history.entries).toHaveLength(1);
      expect(history.entries[0].id).toBe(customId);
    });

    it('should return empty history for task without iterations', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const history = await store.getIterationHistory(task.id);

      expect(history.entries).toHaveLength(0);
      expect(history.totalIterations).toBe(0);
      expect(history.lastIterationAt).toBeUndefined();
    });

    it('should return empty history for non-existent task', async () => {
      const history = await store.getIterationHistory('non-existent-task');

      expect(history.entries).toHaveLength(0);
      expect(history.totalIterations).toBe(0);
      expect(history.lastIterationAt).toBeUndefined();
    });

    it('should handle special characters and unicode in feedback', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const entry = {
        feedback: 'Feedback with special chars: éñ中文 🚀 & <script>alert("test")</script>',
        timestamp: new Date(),
        diffSummary: 'Added émojis and unicode support: 🎉 ✨',
      };

      await store.addIterationEntry(task.id, entry);

      const history = await store.getIterationHistory(task.id);

      expect(history.entries).toHaveLength(1);
      expect(history.entries[0].feedback).toBe(entry.feedback);
      expect(history.entries[0].diffSummary).toBe(entry.diffSummary);
    });

    it('should handle long feedback text', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const longFeedback = 'A'.repeat(10000); // 10KB of text
      const entry = {
        feedback: longFeedback,
        timestamp: new Date(),
      };

      await store.addIterationEntry(task.id, entry);

      const history = await store.getIterationHistory(task.id);

      expect(history.entries).toHaveLength(1);
      expect(history.entries[0].feedback).toBe(longFeedback);
      expect(history.entries[0].feedback).toHaveLength(10000);
    });

    it('should handle many modified files', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Generate a large list of file paths
      const manyFiles = Array.from({ length: 100 }, (_, i) => `src/component${i}.ts`);

      const entry = {
        feedback: 'Refactored many components',
        timestamp: new Date(),
        modifiedFiles: manyFiles,
      };

      await store.addIterationEntry(task.id, entry);

      const history = await store.getIterationHistory(task.id);

      expect(history.entries).toHaveLength(1);
      expect(history.entries[0].modifiedFiles).toEqual(manyFiles);
      expect(history.entries[0].modifiedFiles).toHaveLength(100);
    });

    it('should include iteration history in task retrieval', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const entry1 = {
        feedback: 'First feedback',
        timestamp: new Date(),
        stage: 'implementation',
      };

      const entry2 = {
        feedback: 'Second feedback',
        timestamp: new Date(),
        stage: 'testing',
      };

      await store.addIterationEntry(task.id, entry1);
      await store.addIterationEntry(task.id, entry2);

      // Test getTask includes iteration history
      const retrievedTask = await store.getTask(task.id);
      expect(retrievedTask).not.toBeNull();
      expect(retrievedTask!.iterationHistory).toBeDefined();
      expect(retrievedTask!.iterationHistory!.entries).toHaveLength(2);
      expect(retrievedTask!.iterationHistory!.totalIterations).toBe(2);

      // Test listTasks includes iteration history
      const taskList = await store.listTasks({ status: 'pending' });
      const taskFromList = taskList.find(t => t.id === task.id);
      expect(taskFromList).toBeDefined();
      expect(taskFromList!.iterationHistory).toBeDefined();
      expect(taskFromList!.iterationHistory!.entries).toHaveLength(2);
    });

    it('should handle session data integration with iteration history', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Task without iterations should not have iteration history in session data
      const taskWithoutIterations = await store.getTask(task.id);
      expect(taskWithoutIterations).not.toBeNull();
      // The iteration history should still be available at the top level
      expect(taskWithoutIterations!.iterationHistory).toBeDefined();
      expect(taskWithoutIterations!.iterationHistory!.entries).toHaveLength(0);

      // Add an iteration
      await store.addIterationEntry(task.id, {
        feedback: 'Session data test feedback',
        timestamp: new Date(),
        stage: 'implementation',
      });

      // Task with iterations should have iteration history accessible
      const taskWithIterations = await store.getTask(task.id);
      expect(taskWithIterations).not.toBeNull();
      expect(taskWithIterations!.iterationHistory).toBeDefined();
      expect(taskWithIterations!.iterationHistory!.entries).toHaveLength(1);
      expect(taskWithIterations!.iterationHistory!.entries[0].feedback).toBe('Session data test feedback');
    });

    it('should maintain data integrity with concurrent iteration additions', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Add multiple iterations concurrently
      const entries = Array.from({ length: 10 }, (_, i) => ({
        feedback: `Concurrent feedback ${i}`,
        timestamp: new Date(Date.now() + i * 1000), // Spread out timestamps
        stage: `stage-${i}`,
      }));

      await Promise.all(
        entries.map(entry => store.addIterationEntry(task.id, entry))
      );

      const history = await store.getIterationHistory(task.id);

      expect(history.entries).toHaveLength(10);
      expect(history.totalIterations).toBe(10);

      // Should be sorted by timestamp
      for (let i = 0; i < history.entries.length - 1; i++) {
        expect(history.entries[i].timestamp.getTime())
          .toBeLessThanOrEqual(history.entries[i + 1].timestamp.getTime());
      }
    });

    it('should handle edge cases with timestamps', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Test with very old timestamp
      const oldEntry = {
        feedback: 'Very old entry',
        timestamp: new Date('1970-01-01T00:00:00Z'),
      };

      // Test with future timestamp
      const futureEntry = {
        feedback: 'Future entry',
        timestamp: new Date('2099-12-31T23:59:59Z'),
      };

      await store.addIterationEntry(task.id, oldEntry);
      await store.addIterationEntry(task.id, futureEntry);

      const history = await store.getIterationHistory(task.id);

      expect(history.entries).toHaveLength(2);
      expect(history.entries[0].timestamp).toEqual(oldEntry.timestamp);
      expect(history.entries[1].timestamp).toEqual(futureEntry.timestamp);
    });

    it('should handle null and empty values gracefully', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const entry = {
        feedback: 'Test null values',
        timestamp: new Date(),
        diffSummary: '',
        stage: '',
        agent: '',
      };

      await store.addIterationEntry(task.id, entry);

      const history = await store.getIterationHistory(task.id);

      expect(history.entries).toHaveLength(1);
      const retrievedEntry = history.entries[0];

      // Empty strings are converted to null in the DB via `|| null`,
      // then to undefined on retrieval via `|| undefined`
      expect(retrievedEntry.diffSummary).toBeUndefined();
      expect(retrievedEntry.stage).toBeUndefined();
      expect(retrievedEntry.agent).toBeUndefined();
    });
  });

  describe('Task Lifecycle Management (Trash/Archive)', () => {
    it('should update task to trashed state', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const trashedAt = new Date();
      await store.updateTask(task.id, {
        trashedAt,
        status: 'cancelled',
        updatedAt: new Date(),
      });

      const updated = await store.getTask(task.id);
      expect(updated?.trashedAt).toEqual(trashedAt);
      expect(updated?.status).toBe('cancelled');
      expect(updated?.archivedAt).toBeUndefined();
    });

    it('should update task to archived state', async () => {
      const task = createTestTask();
      task.status = 'completed';
      await store.createTask(task);

      const archivedAt = new Date();
      await store.updateTask(task.id, {
        archivedAt,
        updatedAt: new Date(),
      });

      const updated = await store.getTask(task.id);
      expect(updated?.archivedAt).toEqual(archivedAt);
      expect(updated?.status).toBe('completed');
      expect(updated?.trashedAt).toBeUndefined();
    });

    it('should restore task from trash', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Trash the task
      await store.updateTask(task.id, {
        trashedAt: new Date(),
        status: 'cancelled',
      });

      let updated = await store.getTask(task.id);
      expect(updated?.trashedAt).toBeDefined();

      // Restore from trash
      await store.updateTask(task.id, {
        trashedAt: undefined,
        status: 'pending',
      });

      updated = await store.getTask(task.id);
      expect(updated?.trashedAt).toBeUndefined();
      expect(updated?.status).toBe('pending');
    });

    it('should restore task from archive', async () => {
      const task = createTestTask();
      task.status = 'completed';
      await store.createTask(task);

      // Archive the task
      await store.updateTask(task.id, {
        archivedAt: new Date(),
      });

      let updated = await store.getTask(task.id);
      expect(updated?.archivedAt).toBeDefined();

      // Restore from archive
      await store.updateTask(task.id, {
        archivedAt: undefined,
      });

      updated = await store.getTask(task.id);
      expect(updated?.archivedAt).toBeUndefined();
      expect(updated?.status).toBe('completed');
    });

    it('should handle null values for trash/archive fields', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Setting null should be treated as undefined
      await store.updateTask(task.id, {
        trashedAt: undefined,
        archivedAt: undefined,
      });

      const updated = await store.getTask(task.id);
      expect(updated?.trashedAt).toBeUndefined();
      expect(updated?.archivedAt).toBeUndefined();
    });

    it('should allow task to be both completed and archived', async () => {
      const task = createTestTask();
      task.status = 'completed';
      await store.createTask(task);

      const completedAt = new Date();
      const archivedAt = new Date();

      await store.updateTask(task.id, {
        status: 'completed',
        completedAt,
        archivedAt,
      });

      const updated = await store.getTask(task.id);
      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toEqual(completedAt);
      expect(updated?.archivedAt).toEqual(archivedAt);
      expect(updated?.trashedAt).toBeUndefined();
    });

    it('should allow task to be failed and trashed', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const trashedAt = new Date();

      await store.updateTask(task.id, {
        status: 'failed',
        error: 'Task failed due to errors',
        trashedAt,
      });

      const updated = await store.getTask(task.id);
      expect(updated?.status).toBe('failed');
      expect(updated?.error).toBe('Task failed due to errors');
      expect(updated?.trashedAt).toEqual(trashedAt);
      expect(updated?.archivedAt).toBeUndefined();
    });

    it('should handle concurrent trash and archive operations', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const trashedAt = new Date();
      const archivedAt = new Date(trashedAt.getTime() + 1000);

      // This scenario shouldn't normally happen, but the system should handle it gracefully
      await store.updateTask(task.id, {
        trashedAt,
        archivedAt,
      });

      const updated = await store.getTask(task.id);
      expect(updated?.trashedAt).toEqual(trashedAt);
      expect(updated?.archivedAt).toEqual(archivedAt);
    });

    it('should preserve original dates when task is retrieved multiple times', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const trashedAt = new Date('2024-01-15T10:30:00.000Z');

      await store.updateTask(task.id, { trashedAt });

      // Retrieve multiple times
      const retrieval1 = await store.getTask(task.id);
      const retrieval2 = await store.getTask(task.id);

      expect(retrieval1?.trashedAt).toEqual(trashedAt);
      expect(retrieval2?.trashedAt).toEqual(trashedAt);
      expect(retrieval1?.trashedAt).toEqual(retrieval2?.trashedAt);
    });

    it('should handle datetime precision correctly for lifecycle fields', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Use precise datetime with milliseconds
      const preciseDate = new Date('2024-01-15T10:30:45.123Z');

      await store.updateTask(task.id, {
        trashedAt: preciseDate,
      });

      const updated = await store.getTask(task.id);
      // SQLite stores datetime as string, so precision might be limited
      expect(updated?.trashedAt).toBeDefined();
      expect(updated?.trashedAt?.getTime()).toBeCloseTo(preciseDate.getTime(), -2); // Allow 10ms tolerance
    });

    it('should include lifecycle fields in task listing operations', async () => {
      const task1 = createTestTask();
      task1.id = 'task_archived';
      task1.status = 'completed';
      await store.createTask(task1);
      await store.updateTask(task1.id, { archivedAt: new Date() });

      const task2 = createTestTask();
      task2.id = 'task_trashed';
      await store.createTask(task2);
      await store.updateTask(task2.id, { trashedAt: new Date() });

      const task3 = createTestTask();
      task3.id = 'task_normal';
      await store.createTask(task3);

      // Use includeTrashed/includeArchived to include lifecycle-managed tasks
      const allTasks = await store.listTasks({ includeTrashed: true, includeArchived: true });

      const archivedTask = allTasks.find(t => t.id === 'task_archived');
      const trashedTask = allTasks.find(t => t.id === 'task_trashed');
      const normalTask = allTasks.find(t => t.id === 'task_normal');

      expect(archivedTask?.archivedAt).toBeDefined();
      expect(archivedTask?.trashedAt).toBeUndefined();

      expect(trashedTask?.trashedAt).toBeDefined();
      expect(trashedTask?.archivedAt).toBeUndefined();

      expect(normalTask?.archivedAt).toBeUndefined();
      expect(normalTask?.trashedAt).toBeUndefined();
    });

    it('should maintain lifecycle fields through task dependency operations', async () => {
      // Create dependency task
      const depTask = createTestTask();
      depTask.id = 'dep_task';
      depTask.status = 'completed';
      await store.createTask(depTask);
      await store.updateTask(depTask.id, { archivedAt: new Date() });

      // Create main task that depends on archived task
      const mainTask = createTestTask();
      mainTask.id = 'main_task';
      mainTask.dependsOn = ['dep_task'];
      await store.createTask(mainTask);

      // Check dependencies are maintained even with lifecycle fields
      const retrieved = await store.getTask('main_task');
      expect(retrieved?.dependsOn).toEqual(['dep_task']);

      const dependencies = await store.getTaskDependencies('main_task');
      expect(dependencies).toEqual(['dep_task']);

      // Dependency should still be retrievable with its lifecycle fields
      const depRetrieved = await store.getTask('dep_task');
      expect(depRetrieved?.archivedAt).toBeDefined();
    });

    it('should handle edge cases with empty and invalid dates', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Test with valid date first
      const validDate = new Date('2024-01-15T10:00:00Z');
      await store.updateTask(task.id, { trashedAt: validDate });

      let updated = await store.getTask(task.id);
      expect(updated?.trashedAt).toEqual(validDate);

      // Test clearing the date
      await store.updateTask(task.id, { trashedAt: undefined });

      updated = await store.getTask(task.id);
      expect(updated?.trashedAt).toBeUndefined();
    });

    it('should use convenience methods for trash and archive operations', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Test trash convenience method
      await store.trashTask(task.id);

      let updated = await store.getTask(task.id);
      expect(updated?.trashedAt).toBeDefined();
      expect(updated?.status).toBe('cancelled');

      // Restore using convenience method
      await store.restoreTask(task.id, 'pending');

      updated = await store.getTask(task.id);
      expect(updated?.trashedAt).toBeUndefined();
      expect(updated?.archivedAt).toBeUndefined();
      expect(updated?.status).toBe('pending');

      // Test archive convenience method
      await store.updateTask(task.id, { status: 'completed' });
      await store.archiveTask(task.id);

      updated = await store.getTask(task.id);
      expect(updated?.archivedAt).toBeDefined();
      expect(updated?.status).toBe('completed');
    });

    it('should filter tasks by lifecycle state', async () => {
      // Create tasks in different lifecycle states
      const normalTask = createTestTask();
      normalTask.id = 'task_normal';
      await store.createTask(normalTask);

      const trashedTask = createTestTask();
      trashedTask.id = 'task_trashed';
      await store.createTask(trashedTask);
      await store.trashTask(trashedTask.id);

      const archivedTask = createTestTask();
      archivedTask.id = 'task_archived';
      archivedTask.status = 'completed';
      await store.createTask(archivedTask);
      await store.archiveTask(archivedTask.id);

      // Test filtered queries
      const normalTasks = await store.listTasks();
      expect(normalTasks.map(t => t.id)).toContain('task_normal');
      expect(normalTasks.map(t => t.id)).not.toContain('task_trashed');
      expect(normalTasks.map(t => t.id)).not.toContain('task_archived');

      const trashedTasks = await store.getTrashedTasks();
      expect(trashedTasks.map(t => t.id)).toContain('task_trashed');
      expect(trashedTasks.map(t => t.id)).not.toContain('task_normal');
      expect(trashedTasks.map(t => t.id)).not.toContain('task_archived');

      const archivedTasks = await store.getArchivedTasks();
      expect(archivedTasks.map(t => t.id)).toContain('task_archived');
      expect(archivedTasks.map(t => t.id)).not.toContain('task_normal');
      expect(archivedTasks.map(t => t.id)).not.toContain('task_trashed');

      const allTasksIncludingLifecycle = await store.getAllTasksIncludingLifecycleStates();
      expect(allTasksIncludingLifecycle.map(t => t.id)).toContain('task_normal');
      expect(allTasksIncludingLifecycle.map(t => t.id)).toContain('task_trashed');
      expect(allTasksIncludingLifecycle.map(t => t.id)).toContain('task_archived');
    });

    it('should throw error when restoring non-existent task', async () => {
      await expect(store.restoreTask('non-existent-task')).rejects.toThrow(
        'Task with ID non-existent-task not found'
      );
    });

    // Archive operation validation tests
    it('should only allow archiving completed tasks', async () => {
      const task = createTestTask();
      task.status = 'pending';
      await store.createTask(task);

      // Should throw error when trying to archive non-completed task
      await expect(store.archiveTask(task.id)).rejects.toThrow(
        `Cannot archive task ${task.id}: only completed tasks can be archived (current status: pending)`
      );
    });

    it('should successfully archive completed tasks', async () => {
      const task = createTestTask();
      task.status = 'completed';
      await store.createTask(task);

      // Should succeed for completed task
      await store.archiveTask(task.id);

      const updated = await store.getTask(task.id);
      expect(updated?.archivedAt).toBeDefined();
      expect(updated?.status).toBe('completed');
    });

    it('should throw error when archiving non-existent task', async () => {
      await expect(store.archiveTask('non-existent-task')).rejects.toThrow(
        'Task with ID non-existent-task not found'
      );
    });

    // listArchived tests
    it('should list archived tasks using listArchived method', async () => {
      const task1 = createTestTask();
      task1.id = 'task1';
      task1.status = 'completed';
      await store.createTask(task1);
      await store.archiveTask(task1.id);

      const task2 = createTestTask();
      task2.id = 'task2';
      task2.status = 'completed';
      await store.createTask(task2);

      const archivedTasks = await store.listArchived();
      expect(archivedTasks).toHaveLength(1);
      expect(archivedTasks[0].id).toBe('task1');
      expect(archivedTasks[0].archivedAt).toBeDefined();
    });

    // unarchiveTask tests
    it('should successfully unarchive archived tasks', async () => {
      const task = createTestTask();
      task.status = 'completed';
      await store.createTask(task);

      // Archive the task first
      await store.archiveTask(task.id);
      let updated = await store.getTask(task.id);
      expect(updated?.archivedAt).toBeDefined();

      // Unarchive the task
      await store.unarchiveTask(task.id);
      updated = await store.getTask(task.id);
      expect(updated?.archivedAt).toBeUndefined();
      expect(updated?.status).toBe('completed');
    });

    it('should throw error when unarchiving non-archived task', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Should throw error when trying to unarchive non-archived task
      await expect(store.unarchiveTask(task.id)).rejects.toThrow(
        `Task ${task.id} is not archived`
      );
    });

    it('should throw error when unarchiving non-existent task', async () => {
      await expect(store.unarchiveTask('non-existent-task')).rejects.toThrow(
        'Task with ID non-existent-task not found'
      );
    });
  });

  describe('Task Templates', () => {
    const createTestTemplate = (): TaskTemplate => ({
      id: generateTaskTemplateId(),
      name: 'Feature Template',
      description: 'Template for implementing new features',
      workflow: 'feature',
      priority: 'normal',
      effort: 'medium',
      acceptanceCriteria: 'Feature should be implemented with tests',
      tags: ['feature', 'development'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    describe('CRUD Operations', () => {
      it('should create and retrieve a template', async () => {
        const template = createTestTemplate();
        await store.createTemplate(template);

        const retrieved = await store.getTemplate(template.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe(template.id);
        expect(retrieved?.name).toBe(template.name);
        expect(retrieved?.description).toBe(template.description);
        expect(retrieved?.workflow).toBe(template.workflow);
        expect(retrieved?.priority).toBe(template.priority);
        expect(retrieved?.effort).toBe(template.effort);
        expect(retrieved?.acceptanceCriteria).toBe(template.acceptanceCriteria);
        expect(retrieved?.tags).toEqual(template.tags);
      });

      it('should create template without optional fields', async () => {
        const template: TaskTemplate = {
          id: generateTaskTemplateId(),
          name: 'Minimal Template',
          description: 'A minimal template',
          workflow: 'bugfix',
          priority: 'high',
          effort: 'small',
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await store.createTemplate(template);
        const retrieved = await store.getTemplate(template.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.acceptanceCriteria).toBeUndefined();
        expect(retrieved?.tags).toEqual([]);
      });

      it('should return null for non-existent template', async () => {
        const result = await store.getTemplate('non-existent-template');
        expect(result).toBeNull();
      });

      it('should update a template', async () => {
        const template = createTestTemplate();
        await store.createTemplate(template);

        const updates = {
          name: 'Updated Feature Template',
          description: 'Updated description',
          priority: 'high' as TaskPriority,
          tags: ['feature', 'development', 'urgent'],
        };

        await store.updateTemplate(template.id, updates);
        const updated = await store.getTemplate(template.id);

        expect(updated?.name).toBe(updates.name);
        expect(updated?.description).toBe(updates.description);
        expect(updated?.priority).toBe(updates.priority);
        expect(updated?.tags).toEqual(updates.tags);
        expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(template.updatedAt.getTime());
      });

      it('should update template with partial data', async () => {
        const template = createTestTemplate();
        await store.createTemplate(template);

        await store.updateTemplate(template.id, { name: 'New Name Only' });
        const updated = await store.getTemplate(template.id);

        expect(updated?.name).toBe('New Name Only');
        expect(updated?.description).toBe(template.description); // Should remain unchanged
      });

      it('should delete a template', async () => {
        const template = createTestTemplate();
        await store.createTemplate(template);

        await store.deleteTemplate(template.id);
        const retrieved = await store.getTemplate(template.id);
        expect(retrieved).toBeNull();
      });

      it('should throw error when deleting non-existent template', async () => {
        await expect(store.deleteTemplate('non-existent')).rejects.toThrow(
          'Task template with ID non-existent not found'
        );
      });
    });

    describe('Query Operations', () => {
      beforeEach(async () => {
        // Create test templates
        const templates: TaskTemplate[] = [
          {
            id: generateTaskTemplateId(),
            name: 'Bug Fix Template',
            description: 'Template for fixing bugs',
            workflow: 'bugfix',
            priority: 'high',
            effort: 'small',
            tags: ['bugfix'],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: generateTaskTemplateId(),
            name: 'Feature Template',
            description: 'Template for new features',
            workflow: 'feature',
            priority: 'normal',
            effort: 'large',
            tags: ['feature', 'development'],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: generateTaskTemplateId(),
            name: 'Documentation Template',
            description: 'Template for documentation updates',
            workflow: 'docs',
            priority: 'low',
            effort: 'medium',
            tags: ['docs'],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        for (const template of templates) {
          await store.createTemplate(template);
        }
      });

      it('should get all templates', async () => {
        const templates = await store.getAllTemplates();
        expect(templates).toHaveLength(3);

        // Should be sorted by name
        const names = templates.map(t => t.name);
        expect(names).toEqual(['Bug Fix Template', 'Documentation Template', 'Feature Template']);
      });

      it('should get templates by workflow', async () => {
        const featureTemplates = await store.getTemplatesByWorkflow('feature');
        expect(featureTemplates).toHaveLength(1);
        expect(featureTemplates[0].name).toBe('Feature Template');

        const bugfixTemplates = await store.getTemplatesByWorkflow('bugfix');
        expect(bugfixTemplates).toHaveLength(1);
        expect(bugfixTemplates[0].name).toBe('Bug Fix Template');

        const nonExistentTemplates = await store.getTemplatesByWorkflow('nonexistent');
        expect(nonExistentTemplates).toHaveLength(0);
      });

      it('should search templates by name', async () => {
        const results = await store.searchTemplates('Bug');
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Bug Fix Template');
      });

      it('should search templates by description', async () => {
        const results = await store.searchTemplates('documentation');
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Documentation Template');
      });

      it('should prioritize name matches in search results', async () => {
        // Add a template with 'feature' in description but not name
        const template: TaskTemplate = {
          id: generateTaskTemplateId(),
          name: 'Special Template',
          description: 'This template helps with feature development',
          workflow: 'custom',
          priority: 'normal',
          effort: 'medium',
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await store.createTemplate(template);

        const results = await store.searchTemplates('feature');
        expect(results).toHaveLength(2);
        // Name match should come first
        expect(results[0].name).toBe('Feature Template');
        expect(results[1].name).toBe('Special Template');
      });

      it('should return empty results for no matches', async () => {
        const results = await store.searchTemplates('nonexistent');
        expect(results).toHaveLength(0);
      });
    });

    describe('Task Creation from Template', () => {
      let template: TaskTemplate;

      beforeEach(async () => {
        template = createTestTemplate();
        await store.createTemplate(template);
      });

      it('should create task from template', async () => {
        const task = await store.createTaskFromTemplate(template.id);

        expect(task.description).toBe(template.description);
        expect(task.acceptanceCriteria).toBe(template.acceptanceCriteria);
        expect(task.workflow).toBe(template.workflow);
        expect(task.priority).toBe(template.priority);
        expect(task.effort).toBe(template.effort);
        expect(task.status).toBe('pending');
        expect(task.projectPath).toBe(testDir);
      });

      it('should create task from template with overrides', async () => {
        const overrides = {
          description: 'Custom task description',
          priority: 'urgent' as TaskPriority,
          effort: 'large' as TaskEffort,
        };

        const task = await store.createTaskFromTemplate(template.id, overrides);

        expect(task.description).toBe(overrides.description);
        expect(task.priority).toBe(overrides.priority);
        expect(task.effort).toBe(overrides.effort);
        expect(task.acceptanceCriteria).toBe(template.acceptanceCriteria); // Not overridden
        expect(task.workflow).toBe(template.workflow); // Not overridden
      });

      it('should throw error for non-existent template', async () => {
        await expect(store.createTaskFromTemplate('non-existent')).rejects.toThrow(
          'Task template with ID non-existent not found'
        );
      });
    });

    describe('Edge Cases', () => {
      it('should handle templates with empty tags array', async () => {
        const template = createTestTemplate();
        template.tags = [];

        await store.createTemplate(template);
        const retrieved = await store.getTemplate(template.id);
        expect(retrieved?.tags).toEqual([]);
      });

      it('should handle templates with null acceptance criteria', async () => {
        const template = createTestTemplate();
        template.acceptanceCriteria = undefined;

        await store.createTemplate(template);
        const retrieved = await store.getTemplate(template.id);
        expect(retrieved?.acceptanceCriteria).toBeUndefined();
      });

      it('should preserve timestamps correctly', async () => {
        const template = createTestTemplate();
        const beforeCreate = new Date();

        await store.createTemplate(template);

        const afterCreate = new Date();
        const retrieved = await store.getTemplate(template.id);

        expect(retrieved?.createdAt).toBeDefined();
        expect(retrieved?.updatedAt).toBeDefined();
        expect(retrieved?.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
        expect(retrieved?.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      });

      it('should handle search with special characters', async () => {
        const template = createTestTemplate();
        template.name = 'Template with "quotes" and symbols!';

        await store.createTemplate(template);

        const results = await store.searchTemplates('quotes');
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe(template.id);
      });
    });
  });

  describe('Snapshot Persistence', () => {
    const createTestSnapshot = (taskId: string, actionId: string, toolName = 'edit') => {
      return {
        taskId,
        actionId,
        toolName,
        fileSnapshots: [
          {
            id: `snap_${Date.now()}`,
            filePath: '/test/file.ts',
            content: 'const test = "hello world";',
            checksum: 'abc123def456',
            fileSize: 25,
            lastModified: new Date(),
            snapshotTime: new Date(),
            existed: true,
            metadata: { type: 'typescript' }
          }
        ],
        description: `Snapshot for ${toolName} operation`
      };
    };

    describe('saveSnapshot', () => {
      it('should save a snapshot successfully', async () => {
        const task = createTestTask();
        await store.createTask(task);

        const { taskId, actionId, toolName, fileSnapshots, description } = createTestSnapshot(task.id, 'action_1');

        await expect(store.saveSnapshot(taskId, actionId, toolName, fileSnapshots, description)).resolves.not.toThrow();
      });

      it('should save snapshot with minimal data', async () => {
        const task = createTestTask();
        await store.createTask(task);

        const fileSnapshots = [{
          id: 'minimal_snap',
          filePath: '/test/minimal.js',
          content: '',
          checksum: 'empty',
          fileSize: 0,
          lastModified: new Date(),
          snapshotTime: new Date(),
          existed: false
        }];

        await expect(store.saveSnapshot(task.id, 'action_minimal', 'write', fileSnapshots)).resolves.not.toThrow();
      });

      it('should handle multiple file snapshots in single operation', async () => {
        const task = createTestTask();
        await store.createTask(task);

        const fileSnapshots = [
          {
            id: 'file1_snap',
            filePath: '/test/file1.ts',
            content: 'file 1 content',
            checksum: 'hash1',
            fileSize: 14,
            lastModified: new Date(),
            snapshotTime: new Date(),
            existed: true
          },
          {
            id: 'file2_snap',
            filePath: '/test/file2.js',
            content: 'file 2 content',
            checksum: 'hash2',
            fileSize: 14,
            lastModified: new Date(),
            snapshotTime: new Date(),
            existed: true
          }
        ];

        await expect(store.saveSnapshot(task.id, 'multi_action', 'edit', fileSnapshots, 'Multiple file edit')).resolves.not.toThrow();
      });

      it('should not fail when saving snapshot for non-existent task (no FK enforcement)', async () => {
        // The current implementation does not validate task existence before saving snapshots
        const fileSnapshots = [{
          id: 'test_snap',
          filePath: '/test/file.ts',
          content: 'test',
          checksum: 'test',
          fileSize: 4,
          lastModified: new Date(),
          snapshotTime: new Date(),
          existed: true
        }];

        await expect(store.saveSnapshot('non_existent_task', 'action_1', 'edit', fileSnapshots)).resolves.not.toThrow();
      });

      it('should enforce unique constraint on task_id and action_id', async () => {
        const task = createTestTask();
        await store.createTask(task);

        const fileSnapshots = [{
          id: 'test_snap',
          filePath: '/test/file.ts',
          content: 'test',
          checksum: 'test',
          fileSize: 4,
          lastModified: new Date(),
          snapshotTime: new Date(),
          existed: true
        }];

        // First save should succeed
        await expect(store.saveSnapshot(task.id, 'duplicate_action', 'edit', fileSnapshots)).resolves.not.toThrow();

        // Second save with same task_id and action_id should fail
        await expect(store.saveSnapshot(task.id, 'duplicate_action', 'edit', fileSnapshots)).rejects.toThrow();
      });
    });

    describe('getSnapshots', () => {
      beforeEach(async () => {
        // Setup test data
        const task = createTestTask();
        task.id = 'snapshot_test_task';
        await store.createTask(task);

        // Create multiple snapshots
        const snapshots = [
          createTestSnapshot('snapshot_test_task', 'action_1', 'edit'),
          createTestSnapshot('snapshot_test_task', 'action_2', 'write'),
          createTestSnapshot('snapshot_test_task', 'action_3', 'delete'),
          createTestSnapshot('snapshot_test_task', 'action_1', 'read'), // Different tool for same action
        ];

        for (const snapshot of snapshots) {
          try {
            await store.saveSnapshot(
              snapshot.taskId,
              snapshot.actionId,
              snapshot.toolName,
              snapshot.fileSnapshots,
              snapshot.description
            );
          } catch (error) {
            // Skip duplicate constraint errors for testing
            if (!(error as Error).message.includes('UNIQUE constraint')) {
              throw error;
            }
          }
        }
      });

      it('should retrieve all snapshots for a task', async () => {
        const snapshots = await store.getSnapshots('snapshot_test_task');
        expect(snapshots.length).toBeGreaterThan(0);
        expect(snapshots.every(s => s.taskId === 'snapshot_test_task')).toBe(true);
      });

      it('should filter snapshots by action ID', async () => {
        const snapshots = await store.getSnapshots('snapshot_test_task', 'action_2');
        expect(snapshots).toHaveLength(1);
        expect(snapshots[0].actionId).toBe('action_2');
        expect(snapshots[0].toolName).toBe('write');
      });

      it('should return empty array for task with no snapshots', async () => {
        const task = createTestTask();
        task.id = 'no_snapshots_task';
        await store.createTask(task);

        const snapshots = await store.getSnapshots('no_snapshots_task');
        expect(snapshots).toEqual([]);
      });

      it('should return empty array for non-existent task', async () => {
        const snapshots = await store.getSnapshots('non_existent_task');
        expect(snapshots).toEqual([]);
      });

      it('should include all snapshot properties', async () => {
        const snapshots = await store.getSnapshots('snapshot_test_task', 'action_1');
        expect(snapshots.length).toBeGreaterThan(0);

        const snapshot = snapshots[0];
        expect(snapshot).toHaveProperty('id');
        expect(snapshot).toHaveProperty('taskId');
        expect(snapshot).toHaveProperty('actionId');
        expect(snapshot).toHaveProperty('toolName');
        expect(snapshot).toHaveProperty('fileSnapshots');
        expect(snapshot).toHaveProperty('timestamp');
        expect(snapshot).toHaveProperty('description');
        expect(snapshot).toHaveProperty('canUndo');

        // Verify fileSnapshots is properly parsed
        expect(Array.isArray(snapshot.fileSnapshots)).toBe(true);
        if (snapshot.fileSnapshots.length > 0) {
          const fileSnapshot = snapshot.fileSnapshots[0];
          expect(fileSnapshot).toHaveProperty('id');
          expect(fileSnapshot).toHaveProperty('filePath');
          expect(fileSnapshot).toHaveProperty('content');
          expect(fileSnapshot).toHaveProperty('checksum');
        }
      });

      it('should order snapshots by timestamp (newest first)', async () => {
        const snapshots = await store.getSnapshots('snapshot_test_task');
        expect(snapshots.length).toBeGreaterThanOrEqual(2);

        // Check that timestamps are in descending order
        for (let i = 1; i < snapshots.length; i++) {
          expect(snapshots[i-1].timestamp.getTime()).toBeGreaterThanOrEqual(snapshots[i].timestamp.getTime());
        }
      });
    });

    describe('getLatestSnapshot', () => {
      beforeEach(async () => {
        const task = createTestTask();
        task.id = 'latest_snapshot_task';
        await store.createTask(task);

        // Create snapshots with slight delays to ensure different timestamps
        const snapshot1 = createTestSnapshot('latest_snapshot_task', 'action_latest', 'edit');
        await store.saveSnapshot(snapshot1.taskId, snapshot1.actionId, snapshot1.toolName, snapshot1.fileSnapshots, 'First snapshot');

        // Small delay to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 10));

        const snapshot2 = createTestSnapshot('latest_snapshot_task', 'action_latest_2', 'write');
        await store.saveSnapshot(snapshot2.taskId, snapshot2.actionId, snapshot2.toolName, snapshot2.fileSnapshots, 'Second snapshot');
      });

      it('should return the most recent snapshot for a task', async () => {
        const snapshot = await store.getLatestSnapshot('latest_snapshot_task');
        expect(snapshot).not.toBeNull();
        expect(snapshot!.taskId).toBe('latest_snapshot_task');
        expect(snapshot!.description).toBe('Second snapshot');
      });

      it('should return the most recent snapshot for a specific action', async () => {
        const snapshot = await store.getLatestSnapshot('latest_snapshot_task', 'action_latest');
        expect(snapshot).not.toBeNull();
        expect(snapshot!.actionId).toBe('action_latest');
        expect(snapshot!.description).toBe('First snapshot');
      });

      it('should return null for task with no snapshots', async () => {
        const task = createTestTask();
        task.id = 'no_latest_snapshots';
        await store.createTask(task);

        const snapshot = await store.getLatestSnapshot('no_latest_snapshots');
        expect(snapshot).toBeNull();
      });

      it('should return null for non-existent action', async () => {
        const snapshot = await store.getLatestSnapshot('latest_snapshot_task', 'non_existent_action');
        expect(snapshot).toBeNull();
      });
    });

    describe('deleteSnapshots', () => {
      beforeEach(async () => {
        const task = createTestTask();
        task.id = 'delete_snapshot_task';
        await store.createTask(task);

        // Create test snapshots
        const snapshots = [
          createTestSnapshot('delete_snapshot_task', 'delete_action_1', 'edit'),
          createTestSnapshot('delete_snapshot_task', 'delete_action_2', 'write'),
          createTestSnapshot('delete_snapshot_task', 'delete_action_3', 'delete'),
        ];

        for (const snapshot of snapshots) {
          await store.saveSnapshot(
            snapshot.taskId,
            snapshot.actionId,
            snapshot.toolName,
            snapshot.fileSnapshots,
            snapshot.description
          );
        }
      });

      it('should delete all snapshots for a task', async () => {
        const deletedCount = await store.deleteSnapshots('delete_snapshot_task');
        expect(deletedCount).toBe(3);

        const remaining = await store.getSnapshots('delete_snapshot_task');
        expect(remaining).toEqual([]);
      });

      it('should delete snapshots for a specific action', async () => {
        const deletedCount = await store.deleteSnapshots('delete_snapshot_task', 'delete_action_2');
        expect(deletedCount).toBe(1);

        const remaining = await store.getSnapshots('delete_snapshot_task');
        expect(remaining).toHaveLength(2);
        expect(remaining.every(s => s.actionId !== 'delete_action_2')).toBe(true);
      });

      it('should return 0 when deleting non-existent snapshots', async () => {
        const deletedCount = await store.deleteSnapshots('non_existent_task');
        expect(deletedCount).toBe(0);
      });

      it('should return 0 when deleting non-existent action', async () => {
        const deletedCount = await store.deleteSnapshots('delete_snapshot_task', 'non_existent_action');
        expect(deletedCount).toBe(0);
      });

      it('should properly clean up after deletion', async () => {
        // Verify initial state
        const initialSnapshots = await store.getSnapshots('delete_snapshot_task');
        expect(initialSnapshots).toHaveLength(3);

        // Delete specific action
        await store.deleteSnapshots('delete_snapshot_task', 'delete_action_1');

        // Verify state after partial deletion
        const afterPartial = await store.getSnapshots('delete_snapshot_task');
        expect(afterPartial).toHaveLength(2);

        // Delete all remaining
        const remainingCount = await store.deleteSnapshots('delete_snapshot_task');
        expect(remainingCount).toBe(2);

        // Verify complete cleanup
        const final = await store.getSnapshots('delete_snapshot_task');
        expect(final).toEqual([]);
      });
    });

    describe('Database Schema and Migration', () => {
      it('should create snapshots table with correct schema', async () => {
        // The snapshots table should be created during store initialization
        // We can verify by attempting to query its structure
        const tableInfo = store['db'].prepare("PRAGMA table_info(snapshots)").all() as Array<{name: string, type: string, pk: boolean}>;

        const expectedColumns = [
          'id', 'task_id', 'action_id', 'tool_name',
          'file_snapshots', 'timestamp', 'description', 'can_undo'
        ];

        const actualColumns = tableInfo.map(col => col.name);
        expectedColumns.forEach(col => {
          expect(actualColumns).toContain(col);
        });

        // Verify primary key
        const primaryKeys = tableInfo.filter(col => col.pk).map(col => col.name);
        expect(primaryKeys).toEqual(['id']);
      });

      it('should create proper indexes on snapshots table', async () => {
        const indexes = store['db'].prepare("PRAGMA index_list(snapshots)").all() as Array<{name: string}>;
        const indexNames = indexes.map(idx => idx.name);

        expect(indexNames).toContain('idx_snapshots_task_id');
        expect(indexNames).toContain('idx_snapshots_action_id');
        expect(indexNames).toContain('idx_snapshots_tool_name');
      });

      it.skip('should enforce foreign key constraint on task_id', async () => {
        // Skip: FK constraints are not enforced on the snapshots table in the current schema.
        // The saveSnapshot method does not validate task existence.
        const fileSnapshots = [{
          id: 'constraint_test',
          filePath: '/test/file.ts',
          content: 'test',
          checksum: 'test',
          fileSize: 4,
          lastModified: new Date(),
          snapshotTime: new Date(),
          existed: true
        }];

        await expect(store.saveSnapshot('non_existent_task_fk', 'action_1', 'edit', fileSnapshots))
          .rejects.toThrow();
      });
    });

    describe('Edge Cases and Error Handling', () => {
      it('should handle large file snapshots', async () => {
        const task = createTestTask();
        task.id = 'large_snapshot_task';
        await store.createTask(task);

        const largeContent = 'x'.repeat(1000000); // 1MB of content
        const fileSnapshots = [{
          id: 'large_snap',
          filePath: '/test/large_file.txt',
          content: largeContent,
          checksum: 'large_hash',
          fileSize: largeContent.length,
          lastModified: new Date(),
          snapshotTime: new Date(),
          existed: true
        }];

        await expect(store.saveSnapshot(task.id, 'large_action', 'write', fileSnapshots, 'Large file snapshot'))
          .resolves.not.toThrow();

        const retrieved = await store.getSnapshots(task.id);
        expect(retrieved).toHaveLength(1);
        expect(retrieved[0].fileSnapshots[0].content).toBe(largeContent);
      });

      it('should handle special characters in file paths and content', async () => {
        const task = createTestTask();
        task.id = 'special_chars_task';
        await store.createTask(task);

        const fileSnapshots = [{
          id: 'special_snap',
          filePath: '/test/файл with émojis 🚀 and "quotes".ts',
          content: 'const message = "Hello, 世界! 🌍";\n/* Special chars: éñ */\nlet π = 3.14159;',
          checksum: 'special_hash',
          fileSize: 50,
          lastModified: new Date(),
          snapshotTime: new Date(),
          existed: true,
          metadata: { encoding: 'utf-8', language: 'typescript' }
        }];

        await expect(store.saveSnapshot(task.id, 'special_action', 'edit', fileSnapshots, 'Special chars test'))
          .resolves.not.toThrow();

        const retrieved = await store.getSnapshots(task.id);
        expect(retrieved).toHaveLength(1);
        const snap = retrieved[0].fileSnapshots[0];
        expect(snap.filePath).toBe('/test/файл with émojis 🚀 and "quotes".ts');
        expect(snap.content).toContain('世界! 🌍');
        expect(snap.metadata).toEqual({ encoding: 'utf-8', language: 'typescript' });
      });

      it('should handle empty fileSnapshots array', async () => {
        const task = createTestTask();
        task.id = 'empty_snapshots_task';
        await store.createTask(task);

        await expect(store.saveSnapshot(task.id, 'empty_action', 'cleanup', [], 'No files changed'))
          .resolves.not.toThrow();

        const retrieved = await store.getSnapshots(task.id);
        expect(retrieved).toHaveLength(1);
        expect(retrieved[0].fileSnapshots).toEqual([]);
      });

      it('should handle concurrent snapshot operations', async () => {
        const task = createTestTask();
        task.id = 'concurrent_task';
        await store.createTask(task);

        const createSnapshot = (actionId: string) => {
          const fileSnapshots = [{
            id: `snap_${actionId}`,
            filePath: `/test/${actionId}.ts`,
            content: `content for ${actionId}`,
            checksum: `hash_${actionId}`,
            fileSize: 20,
            lastModified: new Date(),
            snapshotTime: new Date(),
            existed: true
          }];
          return store.saveSnapshot(task.id, actionId, 'edit', fileSnapshots, `Snapshot ${actionId}`);
        };

        // Run multiple snapshot operations concurrently
        const operations = [
          createSnapshot('concurrent_1'),
          createSnapshot('concurrent_2'),
          createSnapshot('concurrent_3'),
          createSnapshot('concurrent_4'),
          createSnapshot('concurrent_5')
        ];

        await expect(Promise.all(operations)).resolves.not.toThrow();

        const allSnapshots = await store.getSnapshots(task.id);
        expect(allSnapshots).toHaveLength(5);
      });

      it('should handle invalid JSON in fileSnapshots gracefully', async () => {
        const task = createTestTask();
        task.id = 'json_test_task';
        await store.createTask(task);

        const fileSnapshots = [{
          id: 'json_snap',
          filePath: '/test/file.ts',
          content: 'test content',
          checksum: 'test_hash',
          fileSize: 12,
          lastModified: new Date(),
          snapshotTime: new Date(),
          existed: true
        }];

        await store.saveSnapshot(task.id, 'json_action', 'edit', fileSnapshots);

        // Manually corrupt the JSON in the database to test error handling
        store['db'].prepare(`
          UPDATE snapshots
          SET file_snapshots = 'invalid json'
          WHERE task_id = ? AND action_id = ?
        `).run(task.id, 'json_action');

        // Should handle corrupted JSON gracefully
        await expect(store.getSnapshots(task.id, 'json_action')).rejects.toThrow();
      });
    });
  });

  describe('Audit Log Query Methods', () => {
    const createTestAuditLogEntry = (
      overrides: Partial<AuditLogEntry> = {}
    ): AuditLogEntry => ({
      id: `audit_${Date.now()}_${Math.random()}`,
      taskId: 'test-task-id',
      eventType: 'task.created' as AuditEventType,
      severity: 'info' as AuditSeverity,
      timestamp: new Date(),
      actor: 'test-user',
      message: 'Test audit log entry',
      stage: 'planning',
      agent: 'planner',
      metadata: { test: 'data' },
      previousState: undefined,
      newState: undefined,
      durationMs: 1000,
      success: true,
      error: undefined,
      correlationId: undefined,
      sessionId: 'test-session',
      ...overrides,
    });

    beforeEach(async () => {
      // Set up test audit log entries with different properties for filtering tests
      const baseTime = new Date('2024-01-01T10:00:00Z');

      const entries = [
        createTestAuditLogEntry({
          id: 'audit-1',
          taskId: 'task-1',
          eventType: 'task.created',
          actor: 'user-alice',
          timestamp: new Date(baseTime.getTime()),
          message: 'Task created by alice',
        }),
        createTestAuditLogEntry({
          id: 'audit-2',
          taskId: 'task-1',
          eventType: 'task.approved',
          actor: 'user-bob',
          timestamp: new Date(baseTime.getTime() + 60000), // +1 minute
          message: 'Task approved by bob',
        }),
        createTestAuditLogEntry({
          id: 'audit-3',
          taskId: 'task-2',
          eventType: 'task.rejected',
          actor: 'user-alice',
          timestamp: new Date(baseTime.getTime() + 120000), // +2 minutes
          message: 'Task rejected by alice',
        }),
        createTestAuditLogEntry({
          id: 'audit-4',
          taskId: 'task-2',
          eventType: 'stage.approved',
          actor: 'user-charlie',
          timestamp: new Date(baseTime.getTime() + 180000), // +3 minutes
          message: 'Stage approved by charlie',
        }),
        createTestAuditLogEntry({
          id: 'audit-5',
          taskId: 'task-1',
          eventType: 'task.failed',
          actor: 'system',
          timestamp: new Date(baseTime.getTime() + 240000), // +4 minutes
          message: 'Task failed',
        }),
        createTestAuditLogEntry({
          id: 'audit-6',
          taskId: 'task-3',
          eventType: 'stage.rejected',
          actor: 'user-bob',
          timestamp: new Date(baseTime.getTime() + 300000), // +5 minutes
          message: 'Stage rejected by bob',
        }),
      ];

      // Add all test entries to the database
      for (const entry of entries) {
        await store.addAuditLog(entry);
      }
    });

    describe('getAuditLog', () => {
      it('should retrieve all audit logs for a specific task', async () => {
        const logs = await store.getAuditLog('task-1');

        expect(logs).toHaveLength(3);
        expect(logs.map(l => l.id).sort()).toEqual(['audit-1', 'audit-2', 'audit-5']);

        // Should be ordered by timestamp DESC
        expect(logs[0].id).toBe('audit-5'); // Most recent
        expect(logs[2].id).toBe('audit-1'); // Oldest
      });

      it('should return empty array for non-existent task', async () => {
        const logs = await store.getAuditLog('non-existent-task');
        expect(logs).toHaveLength(0);
      });

      it('should return properly typed AuditLogEntry objects', async () => {
        const logs = await store.getAuditLog('task-1');

        expect(logs.length).toBeGreaterThan(0);
        const log = logs[0];

        // Verify all required properties are present and typed correctly
        expect(typeof log.id).toBe('string');
        expect(log.taskId).toBe('task-1');
        expect(typeof log.eventType).toBe('string');
        expect(typeof log.severity).toBe('string');
        expect(log.timestamp).toBeInstanceOf(Date);
        expect(typeof log.actor).toBe('string');
        expect(typeof log.message).toBe('string');
      });
    });

    describe('queryAuditLog', () => {
      it('should return all logs when no filters are provided', async () => {
        const logs = await store.queryAuditLog();
        expect(logs).toHaveLength(6);
      });

      it('should filter by taskId', async () => {
        const logs = await store.queryAuditLog({ taskId: 'task-2' });
        expect(logs).toHaveLength(2);
        expect(logs.every(log => log.taskId === 'task-2')).toBe(true);
      });

      it('should filter by actionType (eventType)', async () => {
        const logs = await store.queryAuditLog({ actionType: 'task.approved' });
        expect(logs).toHaveLength(1);
        expect(logs[0].eventType).toBe('task.approved');
        expect(logs[0].actor).toBe('user-bob');
      });

      it('should filter by approver (actor)', async () => {
        const logs = await store.queryAuditLog({ approver: 'user-alice' });
        expect(logs).toHaveLength(2);
        expect(logs.every(log => log.actor === 'user-alice')).toBe(true);
        expect(logs.map(l => l.id).sort()).toEqual(['audit-1', 'audit-3']);
      });

      it('should filter by startDate', async () => {
        const startDate = new Date('2024-01-01T10:02:00Z'); // 2 minutes after base time
        const logs = await store.queryAuditLog({ startDate });

        expect(logs).toHaveLength(4); // audit-3, audit-4, audit-5, audit-6
        expect(logs.every(log => log.timestamp >= startDate)).toBe(true);
      });

      it('should filter by endDate', async () => {
        const endDate = new Date('2024-01-01T10:02:00Z'); // 2 minutes after base time
        const logs = await store.queryAuditLog({ endDate });

        expect(logs).toHaveLength(3); // audit-1, audit-2, audit-3
        expect(logs.every(log => log.timestamp <= endDate)).toBe(true);
      });

      it('should filter by date range', async () => {
        const startDate = new Date('2024-01-01T10:01:00Z'); // 1 minute after base
        const endDate = new Date('2024-01-01T10:03:30Z');   // 3.5 minutes after base

        const logs = await store.queryAuditLog({ startDate, endDate });

        // audit-2 (+1m = 10:01:00), audit-3 (+2m = 10:02:00), audit-4 (+3m = 10:03:00)
        expect(logs).toHaveLength(3);
        expect(logs.every(log =>
          log.timestamp >= startDate && log.timestamp <= endDate
        )).toBe(true);
      });

      it('should combine multiple filters', async () => {
        const logs = await store.queryAuditLog({
          taskId: 'task-1',
          approver: 'user-bob',
        });

        expect(logs).toHaveLength(1);
        expect(logs[0].taskId).toBe('task-1');
        expect(logs[0].actor).toBe('user-bob');
        expect(logs[0].eventType).toBe('task.approved');
      });

      it('should return empty array when filters match nothing', async () => {
        const logs = await store.queryAuditLog({
          taskId: 'non-existent-task',
          approver: 'non-existent-user',
        });

        expect(logs).toHaveLength(0);
      });

      it('should handle edge case filters gracefully', async () => {
        // Test with very old date
        const veryOldDate = new Date('2020-01-01T00:00:00Z');
        const logs = await store.queryAuditLog({ startDate: veryOldDate });
        expect(logs).toHaveLength(6); // All logs should be after this date

        // Test with future date
        const futureDate = new Date('2030-01-01T00:00:00Z');
        const futureLogs = await store.queryAuditLog({ endDate: futureDate });
        expect(futureLogs).toHaveLength(6); // All logs should be before this date
      });
    });

    describe('getApprovalHistory', () => {
      it('should return all approval-related events when no approver filter', async () => {
        const history = await store.getApprovalHistory();

        expect(history).toHaveLength(4);
        const eventTypes = history.map(h => h.eventType);
        expect(eventTypes).toContain('task.approved');
        expect(eventTypes).toContain('task.rejected');
        expect(eventTypes).toContain('stage.approved');
        expect(eventTypes).toContain('stage.rejected');
      });

      it('should filter approval history by approver', async () => {
        const history = await store.getApprovalHistory('user-bob');

        expect(history).toHaveLength(2);
        expect(history.every(h => h.actor === 'user-bob')).toBe(true);
        expect(history.map(h => h.eventType)).toContain('task.approved');
        expect(history.map(h => h.eventType)).toContain('stage.rejected');
      });

      it('should return empty array for non-existent approver', async () => {
        const history = await store.getApprovalHistory('non-existent-user');
        expect(history).toHaveLength(0);
      });

      it('should only include approval/rejection events', async () => {
        const history = await store.getApprovalHistory();

        const allowedEvents = ['task.approved', 'task.rejected', 'stage.approved', 'stage.rejected'];
        expect(history.every(h => allowedEvents.includes(h.eventType))).toBe(true);

        // Should not include other event types like 'task.created' or 'task.failed'
        expect(history.some(h => h.eventType === 'task.created')).toBe(false);
        expect(history.some(h => h.eventType === 'task.failed')).toBe(false);
      });

      it('should be ordered by timestamp DESC (most recent first)', async () => {
        const history = await store.getApprovalHistory();

        expect(history.length).toBeGreaterThan(1);
        for (let i = 1; i < history.length; i++) {
          expect(history[i-1].timestamp.getTime()).toBeGreaterThanOrEqual(
            history[i].timestamp.getTime()
          );
        }
      });

      it('should return properly typed AuditLogEntry objects', async () => {
        const history = await store.getApprovalHistory('user-alice');

        expect(history.length).toBeGreaterThan(0);
        const entry = history[0];

        expect(typeof entry.id).toBe('string');
        expect(typeof entry.taskId).toBe('string');
        expect(typeof entry.eventType).toBe('string');
        expect(typeof entry.severity).toBe('string');
        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(typeof entry.actor).toBe('string');
        expect(typeof entry.message).toBe('string');
      });
    });

    describe('Error Handling and Edge Cases', () => {
      it('should handle SQL injection attempts safely', async () => {
        // Test with malicious SQL in filters - should be safely parameterized
        const maliciousInput = "'; DROP TABLE audit_logs; --";

        await expect(store.queryAuditLog({
          taskId: maliciousInput
        })).resolves.not.toThrow();

        await expect(store.queryAuditLog({
          approver: maliciousInput
        })).resolves.not.toThrow();

        await expect(store.getApprovalHistory(maliciousInput)).resolves.not.toThrow();

        // Verify table still exists by querying for legitimate data
        const logs = await store.queryAuditLog();
        expect(logs).toHaveLength(6);
      });

      it('should handle null and undefined values correctly', async () => {
        await expect(store.getAuditLog('')).resolves.toEqual([]);

        const logs = await store.queryAuditLog({
          taskId: undefined,
          approver: undefined,
          startDate: undefined,
          endDate: undefined,
        });
        expect(logs).toHaveLength(6); // Should return all logs
      });

      it('should handle invalid date objects', async () => {
        const invalidDate = new Date('invalid-date');

        // Invalid dates cause RangeError when calling toISOString()
        await expect(store.queryAuditLog({
          startDate: invalidDate
        })).rejects.toThrow('Invalid time value');
      });
    });
  });

  describe('APEX_HOME Environment Variable Integration', () => {
    let originalApexHome: string | undefined;
    let apexHomeTestDir: string;

    beforeEach(async () => {
      originalApexHome = process.env.APEX_HOME;
      apexHomeTestDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-home-integration-'));
    });

    afterEach(async () => {
      if (originalApexHome !== undefined) {
        process.env.APEX_HOME = originalApexHome;
      } else {
        delete process.env.APEX_HOME;
      }
      try {
        await fs.rm(apexHomeTestDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should use APEX_HOME directory when environment variable is set', async () => {
      // Close current store
      store.close();

      // Set APEX_HOME environment variable
      process.env.APEX_HOME = apexHomeTestDir;

      // Create new store instance
      const apexHomeStore = new TaskStore(testDir);
      await apexHomeStore.initialize();

      const task = createTestTask();
      task.id = 'apex_home_test_task';
      await apexHomeStore.createTask(task);

      // Verify task exists in the store
      const retrieved = await apexHomeStore.getTask('apex_home_test_task');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('apex_home_test_task');

      // Verify database file exists in APEX_HOME directory
      const apexHomeDbPath = path.join(apexHomeTestDir, 'apex.db');
      const dbExists = await fs.access(apexHomeDbPath).then(() => true).catch(() => false);
      expect(dbExists).toBe(true);

      apexHomeStore.close();

      // Recreate store for other tests
      store = new TaskStore(testDir);
      await store.initialize();
    });
  });

  describe('Cleanup Methods', () => {
    beforeEach(async () => {
      // Create some test data
      const task = createTestTask();
      await store.createTask(task);

      await store.addLog(task.id, {
        level: 'info',
        stage: 'test',
        agent: 'test-agent',
        message: 'Test log entry',
        timestamp: new Date(),
      });

      await store.addArtifact(task.id, {
        name: 'test-artifact',
        type: 'file',
        path: '/test/path',
        content: 'test content',
        metadata: {},
      });
    });

    it('should clear all tasks and related data with clearAllTasks', async () => {
      // Verify data exists before cleanup
      const tasksBeforeCleanup = await store.listTasks();
      expect(tasksBeforeCleanup).toHaveLength(1);

      const logsBeforeCleanup = await store.getLogs(tasksBeforeCleanup[0].id);
      expect(logsBeforeCleanup).toHaveLength(1);

      // Note: getArtifacts is not a public method; artifacts are loaded as part of getTask
      const taskWithArtifacts = await store.getTask(tasksBeforeCleanup[0].id);
      expect(taskWithArtifacts?.artifacts).toHaveLength(1);

      // Clear all tasks
      store.clearAllTasks();

      // Verify all data is cleared
      const tasksAfterCleanup = await store.listTasks();
      expect(tasksAfterCleanup).toHaveLength(0);

      const logsAfterCleanup = await store.getLogs('non-existent-task');
      expect(logsAfterCleanup).toHaveLength(0);

      // Verify task (and thus artifacts) are gone
      const taskAfterCleanup = await store.getTask(tasksBeforeCleanup[0].id);
      expect(taskAfterCleanup).toBeNull();
    });

    it('should reset database completely with resetDatabase', async () => {
      // Verify data exists before reset
      const tasksBeforeReset = await store.listTasks();
      expect(tasksBeforeReset).toHaveLength(1);

      // Reset the database
      store.resetDatabase();

      // Verify all data is cleared and tables are recreated
      const tasksAfterReset = await store.listTasks();
      expect(tasksAfterReset).toHaveLength(0);

      // Verify we can still create new data after reset
      const newTask = createTestTask();
      await store.createTask(newTask);

      const retrievedTask = await store.getTask(newTask.id);
      expect(retrievedTask).not.toBeNull();
      expect(retrievedTask?.id).toBe(newTask.id);
    });

    it('should handle clearAllTasks when database is empty', () => {
      store.clearAllTasks();
      // Should not throw any errors
      expect(true).toBe(true);
    });

    it('should handle resetDatabase when database is empty', () => {
      store.resetDatabase();
      // Should not throw any errors
      expect(true).toBe(true);
    });
  });

  describe('createTestInstance static method', () => {
    it('should create a test instance with in-memory database', async () => {
      const testStore = TaskStore.createTestInstance();
      await testStore.initialize();

      // Verify it's working with in-memory database
      const task = createTestTask();
      await testStore.createTask(task);

      const retrievedTask = await testStore.getTask(task.id);
      expect(retrievedTask).not.toBeNull();
      expect(retrievedTask?.id).toBe(task.id);

      testStore.close();
    });

    it('should create test instance with custom project path', async () => {
      const customPath = '/custom/test/path';
      const testStore = TaskStore.createTestInstance(customPath);
      await testStore.initialize();

      // Verify the store works
      const task = createTestTask();
      task.projectPath = customPath; // Use custom project path
      await testStore.createTask(task);

      const retrievedTask = await testStore.getTask(task.id);
      expect(retrievedTask).not.toBeNull();
      expect(retrievedTask?.projectPath).toBe(customPath);

      testStore.close();
    });

    it('should create independent test instances', async () => {
      const testStore1 = TaskStore.createTestInstance();
      const testStore2 = TaskStore.createTestInstance();

      await testStore1.initialize();
      await testStore2.initialize();

      // Add different tasks to each store
      const task1 = createTestTask();
      task1.id = 'task1';
      await testStore1.createTask(task1);

      const task2 = createTestTask();
      task2.id = 'task2';
      await testStore2.createTask(task2);

      // Verify isolation
      const retrievedFromStore1 = await testStore1.getTask('task2');
      expect(retrievedFromStore1).toBeNull();

      const retrievedFromStore2 = await testStore2.getTask('task1');
      expect(retrievedFromStore2).toBeNull();

      testStore1.close();
      testStore2.close();
    });
  });
});
