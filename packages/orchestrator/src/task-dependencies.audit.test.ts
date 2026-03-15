import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskStore } from './store';
import { Task } from '@apexcli/core';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

describe('Task Dependencies Audit - Implementation Verification', () => {
  let store: TaskStore;
  let testDir: string;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'task-dependencies-audit-'));
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
    description: 'Test task for dependencies audit',
    workflow: 'test',
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

  describe('Acceptance Criteria Verification', () => {
    it('should verify store.ts has dependsOn field support', async () => {
      // Create a task with dependencies
      const task = createTestTask({
        dependsOn: ['dep1', 'dep2']
      });

      await store.createTask(task);
      const retrieved = await store.getTask(task.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.dependsOn).toEqual(['dep1', 'dep2']);
      expect(Array.isArray(retrieved!.dependsOn)).toBe(true);
    });

    it('should verify getNextQueuedTask checks dependency satisfaction', async () => {
      // Create dependency tasks
      const depTask1 = createTestTask({ id: 'dep_task_1', status: 'pending' });
      const depTask2 = createTestTask({ id: 'dep_task_2', status: 'completed' });
      await store.createTask(depTask1);
      await store.createTask(depTask2);

      // Create dependent tasks
      const blockedTask = createTestTask({
        id: 'blocked_task',
        dependsOn: ['dep_task_1'], // has pending dependency
      });
      const readyTask = createTestTask({
        id: 'ready_task',
        dependsOn: ['dep_task_2'], // has completed dependency
      });
      const independentTask = createTestTask({
        id: 'independent_task',
        // no dependencies
      });

      await store.createTask(blockedTask);
      await store.createTask(readyTask);
      await store.createTask(independentTask);

      // Get next queued task - should not return blocked task
      const nextTask = await store.getNextQueuedTask();
      expect(nextTask).toBeDefined();
      expect(['ready_task', 'independent_task', 'dep_task_1']).toContain(nextTask!.id);
      expect(nextTask!.id).not.toBe('blocked_task');
    });

    it('should verify tasks with unmet dependencies are skipped', async () => {
      // Create a chain of dependencies: A -> B -> C
      const taskA = createTestTask({ id: 'task_a', status: 'pending' });
      const taskB = createTestTask({ id: 'task_b', status: 'pending', dependsOn: ['task_a'] });
      const taskC = createTestTask({ id: 'task_c', status: 'pending', dependsOn: ['task_b'] });

      await store.createTask(taskA);
      await store.createTask(taskB);
      await store.createTask(taskC);

      // Get ready tasks - only task_a should be ready
      const readyTasks = await store.getReadyTasks();
      const readyTaskIds = readyTasks.map(t => t.id);

      expect(readyTaskIds).toContain('task_a');
      expect(readyTaskIds).not.toContain('task_b'); // blocked by task_a
      expect(readyTaskIds).not.toContain('task_c'); // blocked by task_b

      // Complete task_a
      await store.updateTask('task_a', { status: 'completed' });

      // Now task_b should be ready
      const readyTasks2 = await store.getReadyTasks();
      const readyTaskIds2 = readyTasks2.map(t => t.id);

      expect(readyTaskIds2).toContain('task_b');
      expect(readyTaskIds2).not.toContain('task_c'); // still blocked by task_b

      // Complete task_b
      await store.updateTask('task_b', { status: 'completed' });

      // Now task_c should be ready
      const readyTasks3 = await store.getReadyTasks();
      const readyTaskIds3 = readyTasks3.map(t => t.id);

      expect(readyTaskIds3).toContain('task_c');
    });

    it('should verify dependency-related tests pass', async () => {
      // Test all core dependency functions work correctly
      const depTask = createTestTask({ id: 'dependency_task', status: 'pending' });
      const mainTask = createTestTask({ id: 'main_task', dependsOn: ['dependency_task'] });

      await store.createTask(depTask);
      await store.createTask(mainTask);

      // Verify getTaskDependencies
      const deps = await store.getTaskDependencies('main_task');
      expect(deps).toEqual(['dependency_task']);

      // Verify getBlockingTasks (should return pending dependency)
      const blockers = await store.getBlockingTasks('main_task');
      expect(blockers).toEqual(['dependency_task']);

      // Verify isTaskReady (should be false)
      const isReady1 = await store.isTaskReady('main_task');
      expect(isReady1).toBe(false);

      // Complete dependency
      await store.updateTask('dependency_task', { status: 'completed' });

      // Verify task is now ready
      const isReady2 = await store.isTaskReady('main_task');
      expect(isReady2).toBe(true);

      // Verify no more blockers
      const blockers2 = await store.getBlockingTasks('main_task');
      expect(blockers2).toEqual([]);
    });

    it('should handle complex dependency scenarios', async () => {
      // Create multiple dependency scenarios
      const depTask1 = createTestTask({ id: 'dep1', status: 'completed' });
      const depTask2 = createTestTask({ id: 'dep2', status: 'pending' });
      const depTask3 = createTestTask({ id: 'dep3', status: 'cancelled' });

      const task1 = createTestTask({
        id: 'task_multiple_deps',
        dependsOn: ['dep1', 'dep2', 'dep3'] // mix of completed, pending, cancelled
      });

      await store.createTask(depTask1);
      await store.createTask(depTask2);
      await store.createTask(depTask3);
      await store.createTask(task1);

      // Should be blocked by dep2 (cancelled tasks don't block)
      const blockers = await store.getBlockingTasks('task_multiple_deps');
      expect(blockers).toEqual(['dep2']);

      const isReady = await store.isTaskReady('task_multiple_deps');
      expect(isReady).toBe(false);

      // Complete dep2
      await store.updateTask('dep2', { status: 'completed' });

      // Now should be ready (cancelled deps don't block)
      const isReadyAfter = await store.isTaskReady('task_multiple_deps');
      expect(isReadyAfter).toBe(true);
    });

    it('should support adding and removing dependencies dynamically', async () => {
      const task1 = createTestTask({ id: 'dynamic_task' });
      const dep1 = createTestTask({ id: 'dynamic_dep1', status: 'pending' });
      const dep2 = createTestTask({ id: 'dynamic_dep2', status: 'pending' });

      await store.createTask(task1);
      await store.createTask(dep1);
      await store.createTask(dep2);

      // Initially no dependencies
      expect(await store.getTaskDependencies('dynamic_task')).toEqual([]);
      expect(await store.isTaskReady('dynamic_task')).toBe(true);

      // Add dependency
      await store.addDependency('dynamic_task', 'dynamic_dep1');
      expect(await store.getTaskDependencies('dynamic_task')).toEqual(['dynamic_dep1']);
      expect(await store.isTaskReady('dynamic_task')).toBe(false);

      // Add another dependency
      await store.addDependency('dynamic_task', 'dynamic_dep2');
      expect(await store.getTaskDependencies('dynamic_task')).toEqual(['dynamic_dep1', 'dynamic_dep2']);
      expect(await store.isTaskReady('dynamic_task')).toBe(false);

      // Remove one dependency
      await store.removeDependency('dynamic_task', 'dynamic_dep1');
      expect(await store.getTaskDependencies('dynamic_task')).toEqual(['dynamic_dep2']);
      expect(await store.isTaskReady('dynamic_task')).toBe(false); // still blocked by dep2

      // Remove last dependency
      await store.removeDependency('dynamic_task', 'dynamic_dep2');
      expect(await store.getTaskDependencies('dynamic_task')).toEqual([]);
      expect(await store.isTaskReady('dynamic_task')).toBe(true);
    });

    it('should handle edge cases in dependency management', async () => {
      const task1 = createTestTask({ id: 'edge_case_task' });
      await store.createTask(task1);

      // Adding non-existent dependency should work (referential integrity handled at query time)
      await store.addDependency('edge_case_task', 'non_existent_dep');
      expect(await store.getTaskDependencies('edge_case_task')).toEqual(['non_existent_dep']);

      // Task should be considered ready if dependency doesn't exist (no blocking entry)
      expect(await store.isTaskReady('edge_case_task')).toBe(true);

      // Adding duplicate dependency should be handled gracefully
      await store.addDependency('edge_case_task', 'non_existent_dep');
      expect(await store.getTaskDependencies('edge_case_task')).toEqual(['non_existent_dep']);

      // Removing non-existent dependency should work
      await store.removeDependency('edge_case_task', 'another_non_existent_dep');
    });
  });

  describe('Integration with Task Queuing', () => {
    it('should properly integrate dependencies with priority-based queuing', async () => {
      // Create tasks with different priorities and dependencies
      const highPrioTask = createTestTask({
        id: 'high_prio',
        priority: 'high',
        dependsOn: ['blocker']
      });
      const lowPrioTask = createTestTask({
        id: 'low_prio',
        priority: 'low'
        // no dependencies
      });
      const blockerTask = createTestTask({
        id: 'blocker',
        priority: 'normal',
        status: 'pending'
      });

      await store.createTask(blockerTask);
      await store.createTask(highPrioTask);
      await store.createTask(lowPrioTask);

      // High priority task should not be returned because it's blocked
      const nextTask = await store.getNextQueuedTask();
      expect(['blocker', 'low_prio']).toContain(nextTask!.id);
      expect(nextTask!.id).not.toBe('high_prio');

      // Complete blocker
      await store.updateTask('blocker', { status: 'completed' });

      // Now high priority task should be next
      const nextTask2 = await store.getNextQueuedTask();
      expect(nextTask2!.id).toBe('high_prio'); // Highest priority ready task
    });
  });
});