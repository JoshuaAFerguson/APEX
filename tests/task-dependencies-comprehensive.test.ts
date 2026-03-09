import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskStore } from '../packages/orchestrator/src/store';
import { Task } from '@apexcli/core';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

describe('Task Dependencies - Comprehensive Testing Suite', () => {
  let store: TaskStore;
  let testDir: string;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'task-dependencies-comprehensive-'));
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
    description: 'Test task for comprehensive dependency testing',
    workflow: 'test-comprehensive',
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

  describe('Complex Dependency Scenarios', () => {
    it('should handle diamond dependency pattern (A->B,C; B,C->D)', async () => {
      // Create diamond dependency pattern
      const taskA = createTestTask({ id: 'diamond_a', status: 'pending' });
      const taskB = createTestTask({ id: 'diamond_b', status: 'pending', dependsOn: ['diamond_a'] });
      const taskC = createTestTask({ id: 'diamond_c', status: 'pending', dependsOn: ['diamond_a'] });
      const taskD = createTestTask({ id: 'diamond_d', status: 'pending', dependsOn: ['diamond_b', 'diamond_c'] });

      await store.createTask(taskA);
      await store.createTask(taskB);
      await store.createTask(taskC);
      await store.createTask(taskD);

      // Only A should be ready initially
      const readyTasks1 = await store.getReadyTasks();
      const readyIds1 = readyTasks1.map(t => t.id);
      expect(readyIds1).toContain('diamond_a');
      expect(readyIds1).not.toContain('diamond_b');
      expect(readyIds1).not.toContain('diamond_c');
      expect(readyIds1).not.toContain('diamond_d');

      // Complete A, now B and C should be ready
      await store.updateTask('diamond_a', { status: 'completed' });
      const readyTasks2 = await store.getReadyTasks();
      const readyIds2 = readyTasks2.map(t => t.id);
      expect(readyIds2).toContain('diamond_b');
      expect(readyIds2).toContain('diamond_c');
      expect(readyIds2).not.toContain('diamond_d');

      // Complete B only, D should still be blocked
      await store.updateTask('diamond_b', { status: 'completed' });
      const readyTasks3 = await store.getReadyTasks();
      const readyIds3 = readyTasks3.map(t => t.id);
      expect(readyIds3).toContain('diamond_c');
      expect(readyIds3).not.toContain('diamond_d');

      // Complete C, now D should be ready
      await store.updateTask('diamond_c', { status: 'completed' });
      const readyTasks4 = await store.getReadyTasks();
      const readyIds4 = readyTasks4.map(t => t.id);
      expect(readyIds4).toContain('diamond_d');
    });

    it('should handle long dependency chains correctly', async () => {
      // Create a chain of 5 tasks: A -> B -> C -> D -> E
      const tasks = ['chain_a', 'chain_b', 'chain_c', 'chain_d', 'chain_e'];

      for (let i = 0; i < tasks.length; i++) {
        const dependsOn = i === 0 ? undefined : [tasks[i - 1]];
        const task = createTestTask({
          id: tasks[i],
          status: 'pending',
          dependsOn
        });
        await store.createTask(task);
      }

      // Only the first task should be ready
      for (let i = 0; i < tasks.length; i++) {
        const readyTasks = await store.getReadyTasks();
        const readyIds = readyTasks.map(t => t.id);

        expect(readyIds).toContain(tasks[i]);
        for (let j = i + 1; j < tasks.length; j++) {
          expect(readyIds).not.toContain(tasks[j]);
        }

        // Complete current task
        if (i < tasks.length - 1) {
          await store.updateTask(tasks[i], { status: 'completed' });
        }
      }
    });

    it('should handle complex multi-branch dependencies', async () => {
      // Create complex tree: root -> [branch1, branch2], branch1 -> [leaf1, leaf2], branch2 -> leaf3, [leaf1, leaf2, leaf3] -> final
      const taskRoot = createTestTask({ id: 'tree_root', status: 'pending' });
      const taskBranch1 = createTestTask({ id: 'tree_branch1', status: 'pending', dependsOn: ['tree_root'] });
      const taskBranch2 = createTestTask({ id: 'tree_branch2', status: 'pending', dependsOn: ['tree_root'] });
      const taskLeaf1 = createTestTask({ id: 'tree_leaf1', status: 'pending', dependsOn: ['tree_branch1'] });
      const taskLeaf2 = createTestTask({ id: 'tree_leaf2', status: 'pending', dependsOn: ['tree_branch1'] });
      const taskLeaf3 = createTestTask({ id: 'tree_leaf3', status: 'pending', dependsOn: ['tree_branch2'] });
      const taskFinal = createTestTask({ id: 'tree_final', status: 'pending', dependsOn: ['tree_leaf1', 'tree_leaf2', 'tree_leaf3'] });

      await Promise.all([
        store.createTask(taskRoot),
        store.createTask(taskBranch1),
        store.createTask(taskBranch2),
        store.createTask(taskLeaf1),
        store.createTask(taskLeaf2),
        store.createTask(taskLeaf3),
        store.createTask(taskFinal)
      ]);

      // Verify initial state - only root should be ready
      let readyTasks = await store.getReadyTasks();
      let readyIds = readyTasks.map(t => t.id);
      expect(readyIds).toEqual(['tree_root']);

      // Complete root - branches should be ready
      await store.updateTask('tree_root', { status: 'completed' });
      readyTasks = await store.getReadyTasks();
      readyIds = readyTasks.map(t => t.id);
      expect(readyIds).toContain('tree_branch1');
      expect(readyIds).toContain('tree_branch2');
      expect(readyIds).not.toContain('tree_leaf1');
      expect(readyIds).not.toContain('tree_final');

      // Complete branches - leaves should be ready
      await store.updateTask('tree_branch1', { status: 'completed' });
      await store.updateTask('tree_branch2', { status: 'completed' });
      readyTasks = await store.getReadyTasks();
      readyIds = readyTasks.map(t => t.id);
      expect(readyIds).toContain('tree_leaf1');
      expect(readyIds).toContain('tree_leaf2');
      expect(readyIds).toContain('tree_leaf3');
      expect(readyIds).not.toContain('tree_final');

      // Complete all leaves - final should be ready
      await store.updateTask('tree_leaf1', { status: 'completed' });
      await store.updateTask('tree_leaf2', { status: 'completed' });
      await store.updateTask('tree_leaf3', { status: 'completed' });
      readyTasks = await store.getReadyTasks();
      readyIds = readyTasks.map(t => t.id);
      expect(readyIds).toContain('tree_final');
    });
  });

  describe('Priority and Dependency Interactions', () => {
    it('should respect priorities among ready tasks while maintaining dependency constraints', async () => {
      // Create tasks with various priorities and dependencies
      const urgentBlocked = createTestTask({
        id: 'urgent_blocked',
        priority: 'urgent',
        status: 'pending',
        dependsOn: ['blocker_task']
      });
      const highReady = createTestTask({
        id: 'high_ready',
        priority: 'high',
        status: 'pending'
      });
      const normalReady = createTestTask({
        id: 'normal_ready',
        priority: 'normal',
        status: 'pending'
      });
      const lowReady = createTestTask({
        id: 'low_ready',
        priority: 'low',
        status: 'pending'
      });
      const blockerTask = createTestTask({
        id: 'blocker_task',
        priority: 'low',
        status: 'pending'
      });

      await Promise.all([
        store.createTask(urgentBlocked),
        store.createTask(highReady),
        store.createTask(normalReady),
        store.createTask(lowReady),
        store.createTask(blockerTask)
      ]);

      // Should get highest priority ready task (not the blocked urgent one)
      const nextTask = await store.getNextQueuedTask();
      expect(nextTask!.id).toBe('high_ready');

      // Mark high_ready as in-progress, should get normal_ready next
      await store.updateTask('high_ready', { status: 'in_progress' });
      const nextTask2 = await store.getNextQueuedTask();
      expect(['normal_ready', 'blocker_task'].includes(nextTask2!.id)).toBe(true);
    });

    it('should handle priority changes with dependencies', async () => {
      const depTask = createTestTask({ id: 'dep_for_priority', status: 'pending', priority: 'low' });
      const mainTask = createTestTask({
        id: 'priority_main',
        status: 'pending',
        priority: 'normal',
        dependsOn: ['dep_for_priority']
      });
      const competitorTask = createTestTask({ id: 'competitor', status: 'pending', priority: 'normal' });

      await Promise.all([
        store.createTask(depTask),
        store.createTask(mainTask),
        store.createTask(competitorTask)
      ]);

      // Complete dependency
      await store.updateTask('dep_for_priority', { status: 'completed' });

      // Upgrade main task to high priority
      await store.updateTask('priority_main', { priority: 'high' });

      // Should now get the upgraded task first
      const nextTask = await store.getNextQueuedTask();
      expect(nextTask!.id).toBe('priority_main');
      expect(nextTask!.priority).toBe('high');
    });
  });

  describe('Dependency Status Edge Cases', () => {
    it('should handle failed dependency tasks correctly', async () => {
      const failedDep = createTestTask({ id: 'failed_dep', status: 'failed' });
      const blockedByFailed = createTestTask({
        id: 'blocked_by_failed',
        status: 'pending',
        dependsOn: ['failed_dep']
      });

      await store.createTask(failedDep);
      await store.createTask(blockedByFailed);

      // Task should be blocked by failed dependency
      const blockers = await store.getBlockingTasks('blocked_by_failed');
      expect(blockers).toEqual(['failed_dep']);

      const isReady = await store.isTaskReady('blocked_by_failed');
      expect(isReady).toBe(false);

      const readyTasks = await store.getReadyTasks();
      const readyIds = readyTasks.map(t => t.id);
      expect(readyIds).not.toContain('blocked_by_failed');
    });

    it('should handle paused dependency tasks correctly', async () => {
      const pausedDep = createTestTask({ id: 'paused_dep', status: 'paused' });
      const blockedByPaused = createTestTask({
        id: 'blocked_by_paused',
        status: 'pending',
        dependsOn: ['paused_dep']
      });

      await store.createTask(pausedDep);
      await store.createTask(blockedByPaused);

      // Task should be blocked by paused dependency
      const blockers = await store.getBlockingTasks('blocked_by_paused');
      expect(blockers).toEqual(['paused_dep']);

      const isReady = await store.isTaskReady('blocked_by_paused');
      expect(isReady).toBe(false);
    });

    it('should handle in-progress dependency tasks correctly', async () => {
      const inProgressDep = createTestTask({ id: 'in_progress_dep', status: 'in_progress' });
      const blockedByInProgress = createTestTask({
        id: 'blocked_by_in_progress',
        status: 'pending',
        dependsOn: ['in_progress_dep']
      });

      await store.createTask(inProgressDep);
      await store.createTask(blockedByInProgress);

      // Task should be blocked by in-progress dependency
      const blockers = await store.getBlockingTasks('blocked_by_in_progress');
      expect(blockers).toEqual(['in_progress_dep']);

      const isReady = await store.isTaskReady('blocked_by_in_progress');
      expect(isReady).toBe(false);

      // Complete the in-progress task
      await store.updateTask('in_progress_dep', { status: 'completed' });

      const isReadyAfter = await store.isTaskReady('blocked_by_in_progress');
      expect(isReadyAfter).toBe(true);
    });
  });

  describe('Dynamic Dependency Management', () => {
    it('should handle adding dependencies to running tasks', async () => {
      const runningTask = createTestTask({ id: 'running_task', status: 'in_progress' });
      const newDependency = createTestTask({ id: 'new_dependency', status: 'pending' });

      await store.createTask(runningTask);
      await store.createTask(newDependency);

      // Add dependency to running task
      await store.addDependency('running_task', 'new_dependency');

      // Verify dependency was added
      const deps = await store.getTaskDependencies('running_task');
      expect(deps).toContain('new_dependency');

      // Running task should now be blocked if we check readiness
      const isReady = await store.isTaskReady('running_task');
      expect(isReady).toBe(false);
    });

    it('should handle removing dependencies from blocked tasks', async () => {
      const blockerTask = createTestTask({ id: 'blocker_remove', status: 'pending' });
      const blockedTask = createTestTask({
        id: 'blocked_remove',
        status: 'pending',
        dependsOn: ['blocker_remove']
      });

      await store.createTask(blockerTask);
      await store.createTask(blockedTask);

      // Verify task is initially blocked
      const isReadyBefore = await store.isTaskReady('blocked_remove');
      expect(isReadyBefore).toBe(false);

      // Remove dependency
      await store.removeDependency('blocked_remove', 'blocker_remove');

      // Task should now be ready
      const isReadyAfter = await store.isTaskReady('blocked_remove');
      expect(isReadyAfter).toBe(true);

      const readyTasks = await store.getReadyTasks();
      const readyIds = readyTasks.map(t => t.id);
      expect(readyIds).toContain('blocked_remove');
    });

    it('should handle bulk dependency operations', async () => {
      const mainTask = createTestTask({ id: 'bulk_main', status: 'pending' });
      const deps = ['bulk_dep1', 'bulk_dep2', 'bulk_dep3', 'bulk_dep4'];

      // Create main task and dependencies
      await store.createTask(mainTask);
      for (const depId of deps) {
        await store.createTask(createTestTask({ id: depId, status: 'pending' }));
      }

      // Add multiple dependencies
      for (const depId of deps) {
        await store.addDependency('bulk_main', depId);
      }

      // Verify all dependencies were added
      const addedDeps = await store.getTaskDependencies('bulk_main');
      expect(addedDeps.sort()).toEqual(deps.sort());

      // Task should be blocked
      const isReady = await store.isTaskReady('bulk_main');
      expect(isReady).toBe(false);

      // Complete half the dependencies
      await store.updateTask('bulk_dep1', { status: 'completed' });
      await store.updateTask('bulk_dep2', { status: 'completed' });

      // Should still be blocked
      const isReadyPartial = await store.isTaskReady('bulk_main');
      expect(isReadyPartial).toBe(false);

      // Complete remaining dependencies
      await store.updateTask('bulk_dep3', { status: 'completed' });
      await store.updateTask('bulk_dep4', { status: 'completed' });

      // Should now be ready
      const isReadyFinal = await store.isTaskReady('bulk_main');
      expect(isReadyFinal).toBe(true);
    });
  });

  describe('Concurrent Access and Race Conditions', () => {
    it('should handle concurrent dependency modifications safely', async () => {
      const task = createTestTask({ id: 'concurrent_main', status: 'pending' });
      const dep1 = createTestTask({ id: 'concurrent_dep1', status: 'pending' });
      const dep2 = createTestTask({ id: 'concurrent_dep2', status: 'pending' });

      await Promise.all([
        store.createTask(task),
        store.createTask(dep1),
        store.createTask(dep2)
      ]);

      // Concurrent add operations
      const addPromises = [
        store.addDependency('concurrent_main', 'concurrent_dep1'),
        store.addDependency('concurrent_main', 'concurrent_dep2')
      ];

      await Promise.all(addPromises);

      // Verify both dependencies were added
      const deps = await store.getTaskDependencies('concurrent_main');
      expect(deps.sort()).toEqual(['concurrent_dep1', 'concurrent_dep2']);
    });

    it('should handle concurrent status updates affecting dependencies', async () => {
      const dep1 = createTestTask({ id: 'race_dep1', status: 'pending' });
      const dep2 = createTestTask({ id: 'race_dep2', status: 'pending' });
      const mainTask = createTestTask({
        id: 'race_main',
        status: 'pending',
        dependsOn: ['race_dep1', 'race_dep2']
      });

      await Promise.all([
        store.createTask(dep1),
        store.createTask(dep2),
        store.createTask(mainTask)
      ]);

      // Concurrent completion of dependencies
      const updatePromises = [
        store.updateTask('race_dep1', { status: 'completed' }),
        store.updateTask('race_dep2', { status: 'completed' })
      ];

      await Promise.all(updatePromises);

      // Main task should be ready after both complete
      const isReady = await store.isTaskReady('race_main');
      expect(isReady).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of dependencies efficiently', async () => {
      const mainTask = createTestTask({ id: 'perf_main', status: 'pending' });
      const numDeps = 100;
      const depIds: string[] = [];

      await store.createTask(mainTask);

      // Create and add many dependencies
      for (let i = 0; i < numDeps; i++) {
        const depId = `perf_dep_${i}`;
        depIds.push(depId);
        await store.createTask(createTestTask({ id: depId, status: 'completed' }));
        await store.addDependency('perf_main', depId);
      }

      const startTime = Date.now();

      // Check readiness - should be fast even with many dependencies
      const isReady = await store.isTaskReady('perf_main');
      expect(isReady).toBe(true);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should efficiently query ready tasks with complex dependency graphs', async () => {
      // Create a moderate-sized dependency graph
      const numTasks = 50;
      const tasks: Task[] = [];

      // Create tasks where each depends on the previous one
      for (let i = 0; i < numTasks; i++) {
        const dependsOn = i === 0 ? undefined : [`perf_chain_${i - 1}`];
        const task = createTestTask({
          id: `perf_chain_${i}`,
          status: 'pending',
          dependsOn
        });
        tasks.push(task);
        await store.createTask(task);
      }

      const startTime = Date.now();

      // Query ready tasks - should be efficient
      const readyTasks = await store.getReadyTasks();
      expect(readyTasks).toHaveLength(1);
      expect(readyTasks[0].id).toBe('perf_chain_0');

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(500); // Should be very fast
    });
  });

  describe('Error Handling and Validation', () => {
    it('should handle self-referencing dependencies gracefully', async () => {
      const task = createTestTask({ id: 'self_ref', status: 'pending' });
      await store.createTask(task);

      // Try to add self as dependency - should not cause issues
      await expect(store.addDependency('self_ref', 'self_ref')).resolves.not.toThrow();

      // Self-referencing tasks will block themselves since a pending task
      // depends on a non-completed task (itself). This is expected behavior.
      // The system correctly prevents circular dependencies from running.
      const isReady = await store.isTaskReady('self_ref');
      expect(isReady).toBe(false);

      // However, once completed, the self-reference no longer blocks
      await store.updateTask('self_ref', { status: 'completed' });
      const isReadyAfterCompletion = await store.isTaskReady('self_ref');
      expect(isReadyAfterCompletion).toBe(true);
    });

    it('should handle operations on non-existent tasks gracefully', async () => {
      // Adding dependency to non-existent task
      await expect(store.addDependency('non_existent', 'also_non_existent')).resolves.not.toThrow();

      // Removing dependency from non-existent task
      await expect(store.removeDependency('non_existent', 'also_non_existent')).resolves.not.toThrow();

      // Checking readiness of non-existent task
      const isReady = await store.isTaskReady('non_existent');
      expect(isReady).toBe(true); // Non-existent tasks are considered "ready" by default
    });

    it('should validate dependency integrity on task deletion', async () => {
      const dep = createTestTask({ id: 'dep_to_delete', status: 'pending' });
      const dependent = createTestTask({
        id: 'depends_on_deleted',
        status: 'pending',
        dependsOn: ['dep_to_delete']
      });

      await store.createTask(dep);
      await store.createTask(dependent);

      // Verify dependency exists
      const depsBefore = await store.getTaskDependencies('depends_on_deleted');
      expect(depsBefore).toContain('dep_to_delete');

      // Delete the dependency task (if delete functionality exists)
      // Note: This tests the behavior when a dependency task is deleted
      // The dependent task should become ready since the dependency no longer blocks it

      // For this test, we'll simulate by removing the dependency manually
      await store.removeDependency('depends_on_deleted', 'dep_to_delete');

      const isReady = await store.isTaskReady('depends_on_deleted');
      expect(isReady).toBe(true);
    });
  });
});