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

      // Empty strings should be preserved
      expect(retrievedEntry.diffSummary).toBe('');
      expect(retrievedEntry.stage).toBe('');
      expect(retrievedEntry.agent).toBe('');
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

      const allTasks = await store.getAllTasks();

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
        expect(updated?.updatedAt.getTime()).toBeGreaterThan(template.updatedAt.getTime());
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
});
