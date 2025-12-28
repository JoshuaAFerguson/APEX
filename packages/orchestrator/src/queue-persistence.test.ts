import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task, TaskPriority } from '@apexcli/core';

describe('Queue State Persistence Across Restarts', () => {
  let testDir: string;
  let store1: TaskStore;
  let store2: TaskStore;
  let dbPath: string;

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task for queue persistence',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testDir,
    branchName: 'apex/test-queue-persistence',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-queue-persistence-test-'));
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

  describe('Queue Order Preservation', () => {
    it('should preserve queue order across daemon restart', async () => {
      // Create tasks with different creation times to establish order
      const baseTime = new Date('2024-01-10T10:00:00Z');

      const task1 = createTestTask({
        id: 'task_1_oldest',
        description: 'First task (oldest)',
        priority: 'normal',
        createdAt: new Date(baseTime.getTime()),
        updatedAt: new Date(baseTime.getTime()),
      });

      const task2 = createTestTask({
        id: 'task_2_middle',
        description: 'Second task (middle)',
        priority: 'normal',
        createdAt: new Date(baseTime.getTime() + 1000),
        updatedAt: new Date(baseTime.getTime() + 1000),
      });

      const task3 = createTestTask({
        id: 'task_3_newest',
        description: 'Third task (newest)',
        priority: 'normal',
        createdAt: new Date(baseTime.getTime() + 2000),
        updatedAt: new Date(baseTime.getTime() + 2000),
      });

      // Insert tasks in order
      await store1.createTask(task1);
      await store1.createTask(task2);
      await store1.createTask(task3);

      // Verify initial order (oldest first for pending tasks)
      const initialTasks = await store1.getReadyTasks();
      expect(initialTasks).toHaveLength(3);
      expect(initialTasks[0].id).toBe('task_1_oldest');
      expect(initialTasks[1].id).toBe('task_2_middle');
      expect(initialTasks[2].id).toBe('task_3_newest');

      // Restart the store (simulate daemon restart)
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      // Verify order is preserved after restart
      const restoredTasks = await store2.getReadyTasks();
      expect(restoredTasks).toHaveLength(3);
      expect(restoredTasks[0].id).toBe('task_1_oldest');
      expect(restoredTasks[1].id).toBe('task_2_middle');
      expect(restoredTasks[2].id).toBe('task_3_newest');

      // Verify creation timestamps are preserved
      expect(restoredTasks[0].createdAt).toEqual(task1.createdAt);
      expect(restoredTasks[1].createdAt).toEqual(task2.createdAt);
      expect(restoredTasks[2].createdAt).toEqual(task3.createdAt);
    });

    it('should preserve queue order when getting next queued task', async () => {
      // Create multiple tasks with sequential creation times
      const tasks = [];
      const baseTime = new Date('2024-01-10T10:00:00Z').getTime();

      for (let i = 0; i < 5; i++) {
        const task = createTestTask({
          id: `queue_task_${i}`,
          description: `Queue task ${i}`,
          priority: 'normal',
          createdAt: new Date(baseTime + (i * 1000)),
          updatedAt: new Date(baseTime + (i * 1000)),
        });
        tasks.push(task);
        await store1.createTask(task);
      }

      // Get first task from queue
      let nextTask = await store1.getNextQueuedTask();
      expect(nextTask).not.toBeNull();
      expect(nextTask!.id).toBe('queue_task_0'); // Oldest first

      // Restart store
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      // Continue getting next tasks - should maintain order
      nextTask = await store2.getNextQueuedTask();
      expect(nextTask!.id).toBe('queue_task_0'); // Still the same oldest task

      // Mark first task as in-progress and get next
      await store2.updateTaskStatus('queue_task_0', 'in-progress');
      nextTask = await store2.getNextQueuedTask();
      expect(nextTask!.id).toBe('queue_task_1'); // Next oldest

      // Restart again and verify queue order continues correctly
      store2.close();
      const store3 = new TaskStore(testDir);
      await store3.initialize();

      nextTask = await store3.getNextQueuedTask();
      expect(nextTask!.id).toBe('queue_task_1'); // Should be next pending task

      store3.close();
    });
  });

  describe('Task Priority Persistence', () => {
    it('should maintain task priorities across restarts', async () => {
      const priorities: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];
      const tasks = [];

      // Create tasks with different priorities
      for (let i = 0; i < priorities.length; i++) {
        const task = createTestTask({
          id: `priority_task_${priorities[i]}`,
          description: `Task with ${priorities[i]} priority`,
          priority: priorities[i],
        });
        tasks.push(task);
        await store1.createTask(task);
      }

      // Verify initial priority order
      const initialPriorityTasks = await store1.getReadyTasks({ orderByPriority: true });
      expect(initialPriorityTasks[0].priority).toBe('urgent');
      expect(initialPriorityTasks[1].priority).toBe('high');
      expect(initialPriorityTasks[2].priority).toBe('normal');
      expect(initialPriorityTasks[3].priority).toBe('low');

      // Restart store
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      // Verify priorities are preserved and ordering is maintained
      const restoredPriorityTasks = await store2.getReadyTasks({ orderByPriority: true });
      expect(restoredPriorityTasks).toHaveLength(4);
      expect(restoredPriorityTasks[0].priority).toBe('urgent');
      expect(restoredPriorityTasks[1].priority).toBe('high');
      expect(restoredPriorityTasks[2].priority).toBe('normal');
      expect(restoredPriorityTasks[3].priority).toBe('low');

      // Verify individual task priorities are exactly preserved
      for (let i = 0; i < tasks.length; i++) {
        const restoredTask = restoredPriorityTasks.find(t => t.id === tasks[i].id);
        expect(restoredTask?.priority).toBe(tasks[i].priority);
      }
    });

    it('should preserve priority-based queue ordering across multiple restarts', async () => {
      // Create mixed priority tasks
      const mixedTasks = [
        createTestTask({ id: 'normal_1', priority: 'normal', createdAt: new Date('2024-01-10T10:00:00Z') }),
        createTestTask({ id: 'urgent_1', priority: 'urgent', createdAt: new Date('2024-01-10T10:01:00Z') }),
        createTestTask({ id: 'low_1', priority: 'low', createdAt: new Date('2024-01-10T10:02:00Z') }),
        createTestTask({ id: 'high_1', priority: 'high', createdAt: new Date('2024-01-10T10:03:00Z') }),
        createTestTask({ id: 'normal_2', priority: 'normal', createdAt: new Date('2024-01-10T10:04:00Z') }),
      ];

      for (const task of mixedTasks) {
        await store1.createTask(task);
      }

      // Get initial priority-ordered queue
      let priorityQueue = await store1.getReadyTasks({ orderByPriority: true });
      expect(priorityQueue.map(t => t.id)).toEqual(['urgent_1', 'high_1', 'normal_1', 'normal_2', 'low_1']);

      // First restart
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      priorityQueue = await store2.getReadyTasks({ orderByPriority: true });
      expect(priorityQueue.map(t => t.id)).toEqual(['urgent_1', 'high_1', 'normal_1', 'normal_2', 'low_1']);

      // Process one task and restart again
      await store2.updateTaskStatus('urgent_1', 'completed');

      store2.close();
      const store3 = new TaskStore(testDir);
      await store3.initialize();

      priorityQueue = await store3.getReadyTasks({ orderByPriority: true });
      expect(priorityQueue.map(t => t.id)).toEqual(['high_1', 'normal_1', 'normal_2', 'low_1']);

      store3.close();
    });
  });

  describe('Task Dependencies Persistence', () => {
    it('should preserve task dependencies across restarts', async () => {
      // Create tasks with dependencies
      const dependencyTask = createTestTask({
        id: 'dependency_task',
        description: 'Task that others depend on',
        status: 'pending',
      });

      const blockedTask1 = createTestTask({
        id: 'blocked_task_1',
        description: 'First task blocked by dependency',
        status: 'pending',
        dependsOn: ['dependency_task'],
      });

      const blockedTask2 = createTestTask({
        id: 'blocked_task_2',
        description: 'Second task blocked by dependency',
        status: 'pending',
        dependsOn: ['dependency_task'],
      });

      const independentTask = createTestTask({
        id: 'independent_task',
        description: 'Task with no dependencies',
        status: 'pending',
      });

      // Create tasks
      await store1.createTask(dependencyTask);
      await store1.createTask(blockedTask1);
      await store1.createTask(blockedTask2);
      await store1.createTask(independentTask);

      // Verify initial dependency state
      const initialReadyTasks = await store1.getReadyTasks();
      expect(initialReadyTasks).toHaveLength(2); // Only dependency_task and independent_task are ready
      expect(initialReadyTasks.map(t => t.id)).toContain('dependency_task');
      expect(initialReadyTasks.map(t => t.id)).toContain('independent_task');

      const initialDeps1 = await store1.getTaskDependencies('blocked_task_1');
      const initialDeps2 = await store1.getTaskDependencies('blocked_task_2');
      expect(initialDeps1).toEqual(['dependency_task']);
      expect(initialDeps2).toEqual(['dependency_task']);

      // Restart store
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      // Verify dependencies are preserved
      const restoredDeps1 = await store2.getTaskDependencies('blocked_task_1');
      const restoredDeps2 = await store2.getTaskDependencies('blocked_task_2');
      expect(restoredDeps1).toEqual(['dependency_task']);
      expect(restoredDeps2).toEqual(['dependency_task']);

      // Verify ready tasks are still correctly calculated
      const restoredReadyTasks = await store2.getReadyTasks();
      expect(restoredReadyTasks).toHaveLength(2);
      expect(restoredReadyTasks.map(t => t.id)).toContain('dependency_task');
      expect(restoredReadyTasks.map(t => t.id)).toContain('independent_task');

      // Complete dependency and verify blocked tasks become ready
      await store2.updateTaskStatus('dependency_task', 'completed');

      const finalReadyTasks = await store2.getReadyTasks();
      expect(finalReadyTasks).toHaveLength(3); // Now blocked tasks should be ready
      expect(finalReadyTasks.map(t => t.id)).toContain('blocked_task_1');
      expect(finalReadyTasks.map(t => t.id)).toContain('blocked_task_2');
      expect(finalReadyTasks.map(t => t.id)).toContain('independent_task');
    });

    it('should preserve complex dependency chains across restarts', async () => {
      // Create a chain: taskA -> taskB -> taskC (taskC depends on B, B depends on A)
      const taskA = createTestTask({
        id: 'task_a',
        description: 'Task A - foundation',
        status: 'pending',
      });

      const taskB = createTestTask({
        id: 'task_b',
        description: 'Task B - depends on A',
        status: 'pending',
        dependsOn: ['task_a'],
      });

      const taskC = createTestTask({
        id: 'task_c',
        description: 'Task C - depends on B',
        status: 'pending',
        dependsOn: ['task_b'],
      });

      await store1.createTask(taskA);
      await store1.createTask(taskB);
      await store1.createTask(taskC);

      // Initially only taskA should be ready
      let readyTasks = await store1.getReadyTasks();
      expect(readyTasks).toHaveLength(1);
      expect(readyTasks[0].id).toBe('task_a');

      // Restart and verify dependency chain is preserved
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      readyTasks = await store2.getReadyTasks();
      expect(readyTasks).toHaveLength(1);
      expect(readyTasks[0].id).toBe('task_a');

      // Complete taskA, now taskB should be ready
      await store2.updateTaskStatus('task_a', 'completed');
      readyTasks = await store2.getReadyTasks();
      expect(readyTasks).toHaveLength(1);
      expect(readyTasks[0].id).toBe('task_b');

      // Restart again
      store2.close();
      const store3 = new TaskStore(testDir);
      await store3.initialize();

      // Verify state is preserved
      readyTasks = await store3.getReadyTasks();
      expect(readyTasks).toHaveLength(1);
      expect(readyTasks[0].id).toBe('task_b');

      // Complete taskB, now taskC should be ready
      await store3.updateTaskStatus('task_b', 'completed');
      readyTasks = await store3.getReadyTasks();
      expect(readyTasks).toHaveLength(1);
      expect(readyTasks[0].id).toBe('task_c');

      store3.close();
    });
  });

  describe('Paused Tasks with Resume Dates', () => {
    it('should preserve paused tasks with resume_after dates across restarts', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 3600000); // 1 hour in the future
      const pastDate = new Date(now.getTime() - 3600000); // 1 hour in the past

      // Create paused tasks with different resume times
      const pausedFutureTask = createTestTask({
        id: 'paused_future',
        description: 'Task paused until future',
        status: 'paused',
        pausedAt: now,
        resumeAfter: futureDate,
        pauseReason: 'rate_limit',
      });

      const pausedPastTask = createTestTask({
        id: 'paused_past',
        description: 'Task paused until past (ready for resume)',
        status: 'paused',
        pausedAt: new Date(now.getTime() - 7200000), // 2 hours ago
        resumeAfter: pastDate,
        pauseReason: 'capacity',
      });

      const pausedNoResumeTask = createTestTask({
        id: 'paused_no_resume',
        description: 'Task paused with no resume time',
        status: 'paused',
        pausedAt: now,
        pauseReason: 'user_request',
      });

      await store1.createTask(pausedFutureTask);
      await store1.createTask(pausedPastTask);
      await store1.createTask(pausedNoResumeTask);

      // Verify initial paused tasks state
      const initialPausedTasks = await store1.getPausedTasksForResume();
      expect(initialPausedTasks).toHaveLength(1); // Only the past task should be ready for resume
      expect(initialPausedTasks[0].id).toBe('paused_past');

      // Get all paused tasks to verify they exist
      const allPausedTasks = await store1.listTasks({ status: 'paused' });
      expect(allPausedTasks).toHaveLength(3);

      // Restart store
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      // Verify paused task states are preserved
      const restoredTask1 = await store2.getTask('paused_future');
      const restoredTask2 = await store2.getTask('paused_past');
      const restoredTask3 = await store2.getTask('paused_no_resume');

      expect(restoredTask1?.status).toBe('paused');
      expect(restoredTask1?.pausedAt).toEqual(pausedFutureTask.pausedAt);
      expect(restoredTask1?.resumeAfter).toEqual(pausedFutureTask.resumeAfter);
      expect(restoredTask1?.pauseReason).toBe('rate_limit');

      expect(restoredTask2?.status).toBe('paused');
      expect(restoredTask2?.pausedAt).toEqual(pausedPastTask.pausedAt);
      expect(restoredTask2?.resumeAfter).toEqual(pausedPastTask.resumeAfter);
      expect(restoredTask2?.pauseReason).toBe('capacity');

      expect(restoredTask3?.status).toBe('paused');
      expect(restoredTask3?.pausedAt).toEqual(pausedNoResumeTask.pausedAt);
      expect(restoredTask3?.resumeAfter).toBeUndefined();
      expect(restoredTask3?.pauseReason).toBe('user_request');

      // Verify pause resume logic still works correctly
      const restoredPausedTasks = await store2.getPausedTasksForResume();
      expect(restoredPausedTasks).toHaveLength(1);
      expect(restoredPausedTasks[0].id).toBe('paused_past');
    });

    it('should preserve parent task pause states with subtask relationships', async () => {
      const parentTask = createTestTask({
        id: 'parent_task_paused',
        description: 'Parent task that is paused',
        status: 'paused',
        pausedAt: new Date(),
        resumeAfter: new Date(Date.now() - 1000), // Ready to resume
        pauseReason: 'capacity',
        subtaskIds: ['child_1', 'child_2'],
      });

      const child1 = createTestTask({
        id: 'child_1',
        description: 'Child task 1',
        status: 'pending',
        parentTaskId: 'parent_task_paused',
      });

      const child2 = createTestTask({
        id: 'child_2',
        description: 'Child task 2',
        status: 'completed',
        parentTaskId: 'parent_task_paused',
        completedAt: new Date(),
      });

      await store1.createTask(parentTask);
      await store1.createTask(child1);
      await store1.createTask(child2);

      // Verify initial parent task state
      const initialParentTasks = await store1.findHighestPriorityParentTask();
      expect(initialParentTasks).toHaveLength(1);
      expect(initialParentTasks[0].id).toBe('parent_task_paused');
      expect(initialParentTasks[0].subtaskIds).toEqual(['child_1', 'child_2']);

      // Restart store
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      // Verify parent-child relationships and pause state are preserved
      const restoredParent = await store2.getTask('parent_task_paused');
      const restoredChild1 = await store2.getTask('child_1');
      const restoredChild2 = await store2.getTask('child_2');

      expect(restoredParent?.status).toBe('paused');
      expect(restoredParent?.subtaskIds).toEqual(['child_1', 'child_2']);
      expect(restoredParent?.pauseReason).toBe('capacity');

      expect(restoredChild1?.parentTaskId).toBe('parent_task_paused');
      expect(restoredChild1?.status).toBe('pending');

      expect(restoredChild2?.parentTaskId).toBe('parent_task_paused');
      expect(restoredChild2?.status).toBe('completed');

      // Verify parent task resume logic still works
      const restoredParentTasks = await store2.findHighestPriorityParentTask();
      expect(restoredParentTasks).toHaveLength(1);
      expect(restoredParentTasks[0].id).toBe('parent_task_paused');
    });
  });

  describe('Comprehensive Queue State Persistence', () => {
    it('should preserve all queue state aspects across multiple restarts', async () => {
      // Create a comprehensive scenario with various task states and relationships
      const now = new Date('2024-01-10T12:00:00Z');

      // Foundation task (completed)
      const foundationTask = createTestTask({
        id: 'foundation',
        description: 'Foundation task (already completed)',
        status: 'completed',
        priority: 'high',
        completedAt: new Date(now.getTime() - 3600000),
        createdAt: new Date(now.getTime() - 7200000),
      });

      // High priority ready task
      const urgentTask = createTestTask({
        id: 'urgent_ready',
        description: 'Urgent task ready to run',
        status: 'pending',
        priority: 'urgent',
        createdAt: new Date(now.getTime() - 6000000),
      });

      // Task blocked by foundation (should be ready since foundation is complete)
      const dependentTask = createTestTask({
        id: 'dependent_ready',
        description: 'Task that was blocked but now ready',
        status: 'pending',
        priority: 'normal',
        dependsOn: ['foundation'],
        createdAt: new Date(now.getTime() - 5000000),
      });

      // Task blocked by a pending task
      const stillBlockedTask = createTestTask({
        id: 'still_blocked',
        description: 'Task still blocked by pending task',
        status: 'pending',
        priority: 'high',
        dependsOn: ['urgent_ready'],
        createdAt: new Date(now.getTime() - 4000000),
      });

      // Paused task ready for resume
      const pausedReadyTask = createTestTask({
        id: 'paused_ready',
        description: 'Paused task ready for resume',
        status: 'paused',
        priority: 'high',
        pausedAt: new Date(now.getTime() - 1800000),
        resumeAfter: new Date(now.getTime() - 900000), // 15 minutes ago
        pauseReason: 'capacity',
        createdAt: new Date(now.getTime() - 3000000),
      });

      // Paused task not ready for resume
      const pausedFutureTask = createTestTask({
        id: 'paused_future',
        description: 'Paused task not ready for resume',
        status: 'paused',
        priority: 'normal',
        pausedAt: new Date(now.getTime() - 1800000),
        resumeAfter: new Date(now.getTime() + 3600000), // 1 hour in future
        pauseReason: 'rate_limit',
        createdAt: new Date(now.getTime() - 2000000),
      });

      // Parent task with subtasks
      const parentTask = createTestTask({
        id: 'parent_with_subtasks',
        description: 'Parent task with subtasks',
        status: 'paused',
        priority: 'normal',
        pausedAt: new Date(now.getTime() - 1200000),
        resumeAfter: new Date(now.getTime() - 600000),
        pauseReason: 'usage_limit',
        subtaskIds: ['subtask_1', 'subtask_2'],
        createdAt: new Date(now.getTime() - 1000000),
      });

      const subtask1 = createTestTask({
        id: 'subtask_1',
        description: 'First subtask',
        status: 'pending',
        priority: 'normal',
        parentTaskId: 'parent_with_subtasks',
        createdAt: new Date(now.getTime() - 900000),
      });

      const subtask2 = createTestTask({
        id: 'subtask_2',
        description: 'Second subtask',
        status: 'in-progress',
        priority: 'normal',
        parentTaskId: 'parent_with_subtasks',
        createdAt: new Date(now.getTime() - 800000),
      });

      // Create all tasks
      const allTasks = [
        foundationTask, urgentTask, dependentTask, stillBlockedTask,
        pausedReadyTask, pausedFutureTask, parentTask, subtask1, subtask2
      ];

      for (const task of allTasks) {
        await store1.createTask(task);
      }

      // Capture initial state
      const initialReadyTasks = await store1.getReadyTasks({ orderByPriority: true });
      const initialPausedForResume = await store1.getPausedTasksForResume();
      const initialParentTasks = await store1.findHighestPriorityParentTask();
      const initialNextQueued = await store1.getNextQueuedTask();

      // Verify expected initial state
      expect(initialReadyTasks).toHaveLength(2); // urgent_ready and dependent_ready
      expect(initialReadyTasks[0].id).toBe('urgent_ready'); // Urgent comes first
      expect(initialReadyTasks[1].id).toBe('dependent_ready');

      expect(initialPausedForResume).toHaveLength(1); // Only paused_ready
      expect(initialPausedForResume[0].id).toBe('paused_ready');

      expect(initialParentTasks).toHaveLength(1); // parent_with_subtasks
      expect(initialParentTasks[0].id).toBe('parent_with_subtasks');

      expect(initialNextQueued?.id).toBe('urgent_ready');

      // First restart
      store1.close();
      store2 = new TaskStore(testDir);
      await store2.initialize();

      // Verify all state is preserved after first restart
      const restart1ReadyTasks = await store2.getReadyTasks({ orderByPriority: true });
      const restart1PausedForResume = await store2.getPausedTasksForResume();
      const restart1ParentTasks = await store2.findHighestPriorityParentTask();
      const restart1NextQueued = await store2.getNextQueuedTask();

      expect(restart1ReadyTasks).toHaveLength(2);
      expect(restart1ReadyTasks[0].id).toBe('urgent_ready');
      expect(restart1ReadyTasks[1].id).toBe('dependent_ready');

      expect(restart1PausedForResume).toHaveLength(1);
      expect(restart1PausedForResume[0].id).toBe('paused_ready');

      expect(restart1ParentTasks).toHaveLength(1);
      expect(restart1ParentTasks[0].id).toBe('parent_with_subtasks');

      expect(restart1NextQueued?.id).toBe('urgent_ready');

      // Process urgent task and verify queue progression
      await store2.updateTaskStatus('urgent_ready', 'completed');

      // Now still_blocked should become ready
      const afterUrgentReadyTasks = await store2.getReadyTasks({ orderByPriority: true });
      expect(afterUrgentReadyTasks).toHaveLength(2);
      expect(afterUrgentReadyTasks[0].id).toBe('still_blocked'); // High priority
      expect(afterUrgentReadyTasks[1].id).toBe('dependent_ready'); // Normal priority

      // Second restart
      store2.close();
      const store3 = new TaskStore(testDir);
      await store3.initialize();

      // Verify state after task completion and restart
      const restart2ReadyTasks = await store3.getReadyTasks({ orderByPriority: true });
      const restart2NextQueued = await store3.getNextQueuedTask();

      expect(restart2ReadyTasks).toHaveLength(2);
      expect(restart2ReadyTasks[0].id).toBe('still_blocked');
      expect(restart2ReadyTasks[1].id).toBe('dependent_ready');
      expect(restart2NextQueued?.id).toBe('still_blocked');

      // Verify all task relationships and dates are still intact
      const finalFoundation = await store3.getTask('foundation');
      const finalParent = await store3.getTask('parent_with_subtasks');
      const finalPausedFuture = await store3.getTask('paused_future');

      expect(finalFoundation?.status).toBe('completed');
      expect(finalFoundation?.completedAt).toEqual(foundationTask.completedAt);

      expect(finalParent?.subtaskIds).toEqual(['subtask_1', 'subtask_2']);
      expect(finalParent?.pauseReason).toBe('usage_limit');

      expect(finalPausedFuture?.resumeAfter).toEqual(pausedFutureTask.resumeAfter);
      expect(finalPausedFuture?.pauseReason).toBe('rate_limit');

      store3.close();
    });
  });
});