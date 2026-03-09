import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskStore } from '../packages/orchestrator/src/store';
import { Task } from '@apexcli/core';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

/**
 * Task Dependencies Acceptance Criteria Validation Tests
 *
 * This test suite specifically validates the acceptance criteria:
 * 1. Verify store.ts has dependsOn field support
 * 2. getNextQueuedTask checks dependency satisfaction
 * 3. tasks with unmet dependencies are skipped
 * 4. dependency-related tests pass
 */
describe('Task Dependencies - Acceptance Criteria Validation', () => {
  let store: TaskStore;
  let testDir: string;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'task-deps-acceptance-'));
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    if (store) {
      store.close();
    }
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    description: 'Test task for acceptance criteria validation',
    workflow: 'test-acceptance',
    autonomy: 'autonomous',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: testDir,
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('Acceptance Criteria 1: store.ts has dependsOn field support', () => {
    it('should support creating tasks with dependsOn field', async () => {
      const dependencyTask = createTestTask({
        id: 'dependency_task',
        description: 'A dependency task',
        status: 'pending'
      });

      const dependentTask = createTestTask({
        id: 'dependent_task',
        description: 'A task that depends on another',
        status: 'pending',
        dependsOn: ['dependency_task']
      });

      await store.createTask(dependencyTask);
      await store.createTask(dependentTask);

      // Verify the task was created with dependencies
      const retrievedTask = await store.getTask('dependent_task');
      expect(retrievedTask).toBeDefined();
      expect(retrievedTask!.dependsOn).toContain('dependency_task');
    });

    it('should support updating tasks with dependsOn field', async () => {
      const task1 = createTestTask({
        id: 'update_task_1',
        status: 'pending'
      });

      const task2 = createTestTask({
        id: 'update_task_2',
        status: 'pending'
      });

      await store.createTask(task1);
      await store.createTask(task2);

      // Update task2 to depend on task1
      await store.updateTask('update_task_2', {
        dependsOn: ['update_task_1']
      });

      const updatedTask = await store.getTask('update_task_2');
      expect(updatedTask!.dependsOn).toContain('update_task_1');
    });

    it('should support multiple dependencies in dependsOn field', async () => {
      const dep1 = createTestTask({ id: 'multi_dep_1', status: 'pending' });
      const dep2 = createTestTask({ id: 'multi_dep_2', status: 'pending' });
      const dependent = createTestTask({
        id: 'multi_dependent',
        status: 'pending',
        dependsOn: ['multi_dep_1', 'multi_dep_2']
      });

      await store.createTask(dep1);
      await store.createTask(dep2);
      await store.createTask(dependent);

      const retrievedTask = await store.getTask('multi_dependent');
      expect(retrievedTask!.dependsOn).toEqual(expect.arrayContaining(['multi_dep_1', 'multi_dep_2']));
    });
  });

  describe('Acceptance Criteria 2: getNextQueuedTask checks dependency satisfaction', () => {
    it('should return null when no ready tasks exist due to unmet dependencies', async () => {
      const dependency = createTestTask({
        id: 'blocking_dependency',
        status: 'pending'
      });

      const dependent = createTestTask({
        id: 'blocked_task',
        status: 'pending',
        dependsOn: ['blocking_dependency']
      });

      await store.createTask(dependency);
      await store.createTask(dependent);

      // Mark dependency as in-progress (not completed)
      await store.updateTask('blocking_dependency', { status: 'in_progress' });

      // getNextQueuedTask should not return the blocked task
      const nextTask = await store.getNextQueuedTask();
      expect(nextTask).toBeNull(); // No ready tasks available
    });

    it('should return ready task when all dependencies are satisfied', async () => {
      const dependency = createTestTask({
        id: 'completed_dependency',
        status: 'pending'
      });

      const dependent = createTestTask({
        id: 'ready_task',
        status: 'pending',
        dependsOn: ['completed_dependency']
      });

      await store.createTask(dependency);
      await store.createTask(dependent);

      // Complete the dependency
      await store.updateTask('completed_dependency', { status: 'completed' });

      // Now the dependent task should be ready
      const nextTask = await store.getNextQueuedTask();
      expect(nextTask).toBeDefined();
      expect(nextTask!.id).toBe('ready_task');
    });

    it('should return tasks in priority order when dependencies are satisfied', async () => {
      const dep = createTestTask({
        id: 'shared_dependency',
        status: 'completed'
      });

      const highPriorityTask = createTestTask({
        id: 'high_priority',
        status: 'pending',
        priority: 'high',
        dependsOn: ['shared_dependency']
      });

      const normalPriorityTask = createTestTask({
        id: 'normal_priority',
        status: 'pending',
        priority: 'normal',
        dependsOn: ['shared_dependency']
      });

      await store.createTask(dep);
      await store.createTask(highPriorityTask);
      await store.createTask(normalPriorityTask);

      const nextTask = await store.getNextQueuedTask();
      expect(nextTask!.id).toBe('high_priority');
    });
  });

  describe('Acceptance Criteria 3: tasks with unmet dependencies are skipped', () => {
    it('should skip tasks with failed dependencies', async () => {
      const failedDep = createTestTask({
        id: 'failed_dependency',
        status: 'failed'
      });

      const readyTask = createTestTask({
        id: 'ready_independent_task',
        status: 'pending'
      });

      const blockedTask = createTestTask({
        id: 'blocked_by_failed',
        status: 'pending',
        dependsOn: ['failed_dependency']
      });

      await store.createTask(failedDep);
      await store.createTask(readyTask);
      await store.createTask(blockedTask);

      // Should get the independent ready task, not the blocked one
      const nextTask = await store.getNextQueuedTask();
      expect(nextTask!.id).toBe('ready_independent_task');

      // Mark ready task as in-progress
      await store.updateTask('ready_independent_task', { status: 'in_progress' });

      // Now no ready tasks should be available (blocked task is still blocked)
      const nextTask2 = await store.getNextQueuedTask();
      expect(nextTask2).toBeNull();
    });

    it('should skip tasks with paused dependencies', async () => {
      const pausedDep = createTestTask({
        id: 'paused_dependency',
        status: 'paused'
      });

      const readyTask = createTestTask({
        id: 'independent_ready',
        status: 'pending'
      });

      const blockedTask = createTestTask({
        id: 'blocked_by_paused',
        status: 'pending',
        dependsOn: ['paused_dependency']
      });

      await store.createTask(pausedDep);
      await store.createTask(readyTask);
      await store.createTask(blockedTask);

      const nextTask = await store.getNextQueuedTask();
      expect(nextTask!.id).toBe('independent_ready');
    });

    it('should skip tasks with in-progress dependencies', async () => {
      const inProgressDep = createTestTask({
        id: 'in_progress_dependency',
        status: 'in_progress'
      });

      const readyTask = createTestTask({
        id: 'ready_task',
        status: 'pending'
      });

      const blockedTask = createTestTask({
        id: 'blocked_by_in_progress',
        status: 'pending',
        dependsOn: ['in_progress_dependency']
      });

      await store.createTask(inProgressDep);
      await store.createTask(readyTask);
      await store.createTask(blockedTask);

      const nextTask = await store.getNextQueuedTask();
      expect(nextTask!.id).toBe('ready_task');
    });

    it('should skip tasks with pending dependencies', async () => {
      const pendingDep = createTestTask({
        id: 'pending_dependency',
        status: 'pending'
      });

      const readyTask = createTestTask({
        id: 'independent_task',
        status: 'pending'
      });

      const blockedTask = createTestTask({
        id: 'blocked_by_pending',
        status: 'pending',
        dependsOn: ['pending_dependency']
      });

      await store.createTask(pendingDep);
      await store.createTask(readyTask);
      await store.createTask(blockedTask);

      // Should get one of the independent tasks, not the blocked one
      const nextTask = await store.getNextQueuedTask();
      expect(['pending_dependency', 'independent_task']).toContain(nextTask!.id);
      expect(nextTask!.id).not.toBe('blocked_by_pending');
    });

    it('should handle partial dependency satisfaction correctly', async () => {
      const completedDep = createTestTask({
        id: 'completed_dep',
        status: 'completed'
      });

      const pendingDep = createTestTask({
        id: 'pending_dep',
        status: 'pending'
      });

      const partiallyBlockedTask = createTestTask({
        id: 'partially_blocked',
        status: 'pending',
        dependsOn: ['completed_dep', 'pending_dep']
      });

      const readyTask = createTestTask({
        id: 'fully_ready',
        status: 'pending'
      });

      await store.createTask(completedDep);
      await store.createTask(pendingDep);
      await store.createTask(partiallyBlockedTask);
      await store.createTask(readyTask);

      // Should get one of the ready tasks, not the partially blocked one
      const nextTask = await store.getNextQueuedTask();
      expect(['pending_dep', 'fully_ready']).toContain(nextTask!.id);
      expect(nextTask!.id).not.toBe('partially_blocked');
    });
  });

  describe('Acceptance Criteria 4: dependency-related methods work correctly', () => {
    it('should correctly identify when tasks are ready vs blocked', async () => {
      const completedDep = createTestTask({
        id: 'completed_dep',
        status: 'completed'
      });

      const pendingDep = createTestTask({
        id: 'pending_dep',
        status: 'pending'
      });

      const readyTask = createTestTask({
        id: 'ready_task',
        status: 'pending',
        dependsOn: ['completed_dep']
      });

      const blockedTask = createTestTask({
        id: 'blocked_task',
        status: 'pending',
        dependsOn: ['pending_dep']
      });

      await store.createTask(completedDep);
      await store.createTask(pendingDep);
      await store.createTask(readyTask);
      await store.createTask(blockedTask);

      // Check readiness
      const isReadyTaskReady = await store.isTaskReady('ready_task');
      const isBlockedTaskReady = await store.isTaskReady('blocked_task');

      expect(isReadyTaskReady).toBe(true);
      expect(isBlockedTaskReady).toBe(false);

      // Check blocking tasks
      const readyTaskBlockers = await store.getBlockingTasks('ready_task');
      const blockedTaskBlockers = await store.getBlockingTasks('blocked_task');

      expect(readyTaskBlockers).toEqual([]);
      expect(blockedTaskBlockers).toEqual(['pending_dep']);
    });

    it('should correctly manage ready tasks list', async () => {
      const dep1 = createTestTask({ id: 'dep1', status: 'completed' });
      const dep2 = createTestTask({ id: 'dep2', status: 'pending' });

      const readyTask = createTestTask({
        id: 'ready_with_completed_deps',
        status: 'pending',
        dependsOn: ['dep1']
      });

      const blockedTask = createTestTask({
        id: 'blocked_with_pending_deps',
        status: 'pending',
        dependsOn: ['dep2']
      });

      const independentTask = createTestTask({
        id: 'independent',
        status: 'pending'
      });

      await Promise.all([
        store.createTask(dep1),
        store.createTask(dep2),
        store.createTask(readyTask),
        store.createTask(blockedTask),
        store.createTask(independentTask)
      ]);

      const readyTasks = await store.getReadyTasks();
      const readyIds = readyTasks.map(t => t.id);

      // Should include tasks with satisfied dependencies and independent tasks
      expect(readyIds).toContain('ready_with_completed_deps');
      expect(readyIds).toContain('independent');
      expect(readyIds).toContain('dep2'); // The pending dependency itself is ready

      // Should not include tasks with unsatisfied dependencies
      expect(readyIds).not.toContain('blocked_with_pending_deps');
    });

    it('should handle dependency manipulation correctly', async () => {
      const dep = createTestTask({ id: 'manipulated_dep', status: 'pending' });
      const task = createTestTask({ id: 'manipulated_task', status: 'pending' });

      await store.createTask(dep);
      await store.createTask(task);

      // Initially no dependencies
      const initialDeps = await store.getTaskDependencies('manipulated_task');
      expect(initialDeps).toEqual([]);

      // Add dependency
      await store.addDependency('manipulated_task', 'manipulated_dep');
      const depsAfterAdd = await store.getTaskDependencies('manipulated_task');
      expect(depsAfterAdd).toContain('manipulated_dep');

      // Task should now be blocked
      const isReadyAfterAdd = await store.isTaskReady('manipulated_task');
      expect(isReadyAfterAdd).toBe(false);

      // Remove dependency
      await store.removeDependency('manipulated_task', 'manipulated_dep');
      const depsAfterRemove = await store.getTaskDependencies('manipulated_task');
      expect(depsAfterRemove).toEqual([]);

      // Task should now be ready
      const isReadyAfterRemove = await store.isTaskReady('manipulated_task');
      expect(isReadyAfterRemove).toBe(true);
    });
  });
});