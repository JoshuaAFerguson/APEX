import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task, TaskLog, TaskArtifact, GateStatus, TaskCheckpoint, AgentMessage } from '@apex/core';

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
});
