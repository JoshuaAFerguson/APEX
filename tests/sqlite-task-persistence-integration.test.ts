/**
 * SQLite Task Persistence Integration Tests
 *
 * This test suite focuses on integration scenarios for SQLite task persistence,
 * testing end-to-end workflows, data integrity, and complex operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from '../packages/orchestrator/src/store';
import type {
  Task,
  CreateTaskRequest,
  TaskStatus,
  IdleTask,
  IdleTaskType,
  TaskTemplate,
  ToolAction,
  ApprovalState,
} from '@apexcli/core';

describe('SQLite Task Persistence - Integration Tests', () => {
  let testDir: string;
  let store: TaskStore;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-sqlite-integration-'));
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    if (store) {
      await store.close();
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('End-to-End Task Lifecycle', () => {
    it('should handle complete task lifecycle from creation to completion', async () => {
      // 1. Create task
      const task = await store.createTask({
        description: 'Full lifecycle test task',
        acceptanceCriteria: 'Should complete all stages successfully',
        workflow: 'feature',
        autonomy: 'full',
        agent: 'developer',
        priority: 'normal',
      });

      // 2. Start task execution
      await store.updateTaskStatus(task.id, 'in-progress', 'planning');
      await store.addLog(task.id, {
        level: 'info',
        message: 'Started planning phase',
        timestamp: new Date(),
      });

      // 3. Create approval gate
      await store.setGate(task.id, {
        name: 'design-review',
        status: 'pending',
        requiredAt: new Date(),
        comment: 'Design review required before implementation',
      });

      // 4. Add artifacts during execution
      await store.addArtifact(task.id, {
        name: 'design-doc.md',
        path: '/tmp/design-doc.md',
        type: 'file',
        size: 2048,
        createdAt: new Date(),
      });

      // 5. Update usage as task progresses
      await store.updateTask(task.id, {
        usage: {
          inputTokens: 750,
          outputTokens: 400,
          totalTokens: 1150,
          estimatedCost: 0.0115,
        }
      });

      // 6. Progress through stages
      await store.updateTaskStatus(task.id, 'in-progress', 'implementation');

      // 7. Add iteration history
      await store.addIteration(task.id, {
        feedback: 'Implementation looks good, minor adjustments needed',
        beforeState: 'Initial implementation',
        afterState: 'Adjusted implementation',
        timestamp: new Date(),
      });

      // 8. Complete task
      await store.updateTaskStatus(task.id, 'completed', 'completed');

      // 9. Archive completed task
      await store.archiveTask(task.id);

      // Verify final state
      const finalTask = await store.getTask(task.id);
      expect(finalTask).toBeDefined();
      expect(finalTask!.status).toBe('completed');
      expect(finalTask!.currentStage).toBe('completed');
      expect(finalTask!.archivedAt).toBeInstanceOf(Date);
      expect(finalTask!.logs.length).toBeGreaterThan(0);
      expect(finalTask!.artifacts.length).toBe(1);
      expect(finalTask!.usage.totalTokens).toBe(1150);
      expect(finalTask!.iterationHistory.entries.length).toBe(1);

      // Verify gate was created
      const gates = await store.getAllGates(task.id);
      expect(gates.length).toBe(1);
      expect(gates[0].name).toBe('design-review');
    });

    it('should handle task failure and recovery workflow', async () => {
      const task = await store.createTask({
        description: 'Failure recovery test',
        workflow: 'feature',
        autonomy: 'full',
        agent: 'developer',
      });

      // Start execution
      await store.updateTaskStatus(task.id, 'in-progress');

      // Encounter failure
      await store.updateTaskStatus(task.id, 'failed', 'implementation');
      await store.addLog(task.id, {
        level: 'error',
        message: 'Build failed due to dependency issue',
        timestamp: new Date(),
      });

      // Track fix attempt
      await store.trackFixAttempt(task.id, {
        attemptNumber: 1,
        strategy: 'dependency-resolution',
        description: 'Updated dependency versions',
        result: 'success',
        timestamp: new Date(),
      });

      // Resume task
      await store.updateTaskStatus(task.id, 'in-progress');

      // Complete successfully
      await store.updateTaskStatus(task.id, 'completed');

      const finalTask = await store.getTask(task.id);
      expect(finalTask!.status).toBe('completed');

      const fixHistory = await store.getFixHistory(task.id);
      expect(fixHistory.attempts.length).toBe(1);
      expect(fixHistory.attempts[0].result).toBe('success');
    });
  });

  describe('Task Dependencies and Relationships', () => {
    it('should manage complex dependency chains', async () => {
      // Create a dependency chain: A -> B -> C
      const taskA = await store.createTask({
        description: 'Task A (independent)',
        workflow: 'feature',
        autonomy: 'full',
        agent: 'developer',
      });

      const taskB = await store.createTask({
        description: 'Task B (depends on A)',
        workflow: 'feature',
        autonomy: 'full',
        agent: 'developer',
      });

      const taskC = await store.createTask({
        description: 'Task C (depends on B)',
        workflow: 'feature',
        autonomy: 'full',
        agent: 'developer',
      });

      // Set up dependencies
      await store.addDependency(taskB.id, taskA.id);
      await store.addDependency(taskC.id, taskB.id);

      // Verify dependency relationships
      const bDeps = await store.getTaskDependencies(taskB.id);
      const cDeps = await store.getTaskDependencies(taskC.id);

      expect(bDeps).toContain(taskA.id);
      expect(cDeps).toContain(taskB.id);

      // Verify blocking relationships
      const aBlockers = await store.getBlockingTasks(taskA.id);
      const bBlockers = await store.getBlockingTasks(taskB.id);

      expect(aBlockers).toContain(taskB.id);
      expect(bBlockers).toContain(taskC.id);

      // Test dependency validation for next task
      const nextTask = await store.getNextTask();
      // Should be taskA since it has no dependencies
      expect(nextTask?.id).toBe(taskA.id);
    });

    it('should handle parent-child task relationships', async () => {
      const parentTask = await store.createTask({
        description: 'Parent task with subtasks',
        workflow: 'epic',
        autonomy: 'supervised',
        agent: 'architect',
      });

      const childTask1 = await store.createTask({
        description: 'Child task 1',
        workflow: 'feature',
        autonomy: 'full',
        agent: 'developer',
        parentTaskId: parentTask.id,
      });

      const childTask2 = await store.createTask({
        description: 'Child task 2',
        workflow: 'feature',
        autonomy: 'full',
        agent: 'developer',
        parentTaskId: parentTask.id,
      });

      // Update parent with subtask IDs
      await store.updateTask(parentTask.id, {
        subtaskIds: [childTask1.id, childTask2.id],
      });

      // Verify relationships
      const updatedParent = await store.getTask(parentTask.id);
      expect(updatedParent!.subtaskIds).toContain(childTask1.id);
      expect(updatedParent!.subtaskIds).toContain(childTask2.id);

      const child1 = await store.getTask(childTask1.id);
      expect(child1!.parentTaskId).toBe(parentTask.id);
    });
  });

  describe('Advanced Feature Integration', () => {
    it('should integrate idle tasks with main task system', async () => {
      // Create idle task
      const idleTask: IdleTask = {
        id: 'idle-' + Date.now(),
        type: 'enhancement' as IdleTaskType,
        title: 'Optimize database queries',
        description: 'Improve performance of task queries',
        rationale: 'Current queries are slow with large datasets',
        suggestedWorkflow: 'optimization',
        priority: 'normal',
        estimatedEffort: 'medium',
        tags: ['performance', 'database'],
        createdAt: new Date(),
      };

      await store.createIdleTask(idleTask);

      // Promote idle task to active task
      const activeTask = await store.promoteIdleTask(idleTask.id, {
        workflow: 'optimization',
        autonomy: 'full',
        agent: 'developer',
      });

      expect(activeTask.description).toBe(idleTask.description);
      expect(activeTask.workflow).toBe('optimization');
    });

    it('should integrate task templates with task creation', async () => {
      // Create task template
      const template: TaskTemplate = {
        id: 'template-' + Date.now(),
        name: 'Feature Development Template',
        description: 'Standard template for new feature development',
        defaultWorkflow: 'feature',
        defaultAutonomy: 'full',
        acceptanceCriteriaTemplate: 'Feature should be fully implemented and tested',
        tags: ['development', 'template'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.createTemplate(template);

      // Create task from template
      const task = await store.createTaskFromTemplate(template.id, {
        description: 'Implement user authentication',
        agent: 'developer',
      });

      expect(task.workflow).toBe('feature');
      expect(task.autonomy).toBe('full');
      expect(task.acceptanceCriteria).toContain('fully implemented and tested');
    });

    it('should manage approval states and tool actions', async () => {
      const task = await store.createTask({
        description: 'Task requiring approval workflow',
        workflow: 'feature',
        autonomy: 'supervised',
        agent: 'developer',
      });

      // Create approval gate
      await store.setGate(task.id, {
        name: 'security-review',
        status: 'pending',
        requiredAt: new Date(),
        comment: 'Security team review required',
      });

      // Create approval state
      await store.createApprovalState({
        id: 'approval-' + Date.now(),
        taskId: task.id,
        gateName: 'security-review',
        status: 'pending',
        requestedAt: new Date(),
      });

      // Track tool action
      const toolAction: ToolAction = {
        id: 'action-' + Date.now(),
        taskId: task.id,
        executionCallId: 'exec-123',
        name: 'SecurityScanner',
        input: { scanType: 'dependency' },
        output: { vulnerabilities: 0 },
        timestamp: new Date(),
        duration: 5000,
        success: true,
      };

      await store.trackToolAction(toolAction);

      // Verify approval state was created
      const approvalStates = await store.getApprovalStates(task.id);
      expect(approvalStates.length).toBe(1);
      expect(approvalStates[0].gateName).toBe('security-review');

      // Verify tool action was tracked
      const toolActions = await store.getToolActions(task.id);
      expect(toolActions.length).toBe(1);
      expect(toolActions[0].name).toBe('SecurityScanner');
    });
  });

  describe('Data Integrity and Consistency', () => {
    it('should maintain referential integrity across operations', async () => {
      const task = await store.createTask({
        description: 'Referential integrity test',
        workflow: 'feature',
        autonomy: 'full',
        agent: 'developer',
      });

      // Add related data
      await store.addLog(task.id, {
        level: 'info',
        message: 'Test log',
        timestamp: new Date(),
      });

      await store.addArtifact(task.id, {
        name: 'test.txt',
        path: '/tmp/test.txt',
        type: 'file',
        size: 100,
        createdAt: new Date(),
      });

      const gate = await store.createGate(task.id, {
        name: 'test-gate',
        status: 'pending',
        description: 'Test gate',
      });

      // Verify all data is linked correctly
      const retrievedTask = await store.getTask(task.id);
      expect(retrievedTask!.logs.length).toBe(1);
      expect(retrievedTask!.artifacts.length).toBe(1);

      const gates = await store.getGates(task.id);
      expect(gates.length).toBe(1);

      // Trash task and verify soft delete
      await store.trashTask(task.id);
      const trashedTask = await store.getTask(task.id);
      expect(trashedTask!.trashedAt).toBeDefined();

      // Permanently delete and verify cleanup
      await store.emptyTrash();
      const deletedTask = await store.getTask(task.id);
      expect(deletedTask).toBeNull();

      // Verify related data was also cleaned up
      const logs = await store.getLogs(task.id);
      expect(logs.length).toBe(0);
    });

    it('should handle concurrent operations without data corruption', async () => {
      const baseTask = await store.createTask({
        description: 'Concurrency test base task',
        workflow: 'feature',
        autonomy: 'full',
        agent: 'developer',
      });

      // Perform concurrent updates
      const concurrentOperations = [
        store.updateTaskStatus(baseTask.id, 'in-progress'),
        store.addLog(baseTask.id, {
          level: 'info',
          message: 'Concurrent log 1',
          timestamp: new Date(),
        }),
        store.addLog(baseTask.id, {
          level: 'info',
          message: 'Concurrent log 2',
          timestamp: new Date(),
        }),
        store.updateTaskUsage(baseTask.id, {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.0015,
        }),
      ];

      await Promise.all(concurrentOperations);

      // Verify all operations completed successfully
      const finalTask = await store.getTask(baseTask.id);
      expect(finalTask!.status).toBe('in-progress');
      expect(finalTask!.logs.length).toBe(2);
      expect(finalTask!.usage.totalTokens).toBe(150);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of tasks efficiently', async () => {
      const taskCount = 100;
      const startTime = Date.now();

      // Create many tasks concurrently
      const createPromises = Array.from({ length: taskCount }, (_, i) =>
        store.createTask({
          description: `Performance test task ${i}`,
          workflow: 'feature',
          autonomy: 'full',
          agent: 'developer',
          priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'normal' : 'low',
        })
      );

      const tasks = await Promise.all(createPromises);
      const createTime = Date.now() - startTime;

      expect(tasks.length).toBe(taskCount);
      expect(createTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Test bulk query performance
      const queryStart = Date.now();
      const allTasks = await store.listTasks({ limit: taskCount + 10 });
      const queryTime = Date.now() - queryStart;

      expect(allTasks.length).toBeGreaterThanOrEqual(taskCount);
      expect(queryTime).toBeLessThan(2000); // Should query within 2 seconds

      // Test filtering performance
      const filterStart = Date.now();
      const highPriorityTasks = await store.listTasks({
        priority: 'high',
        limit: 50
      });
      const filterTime = Date.now() - filterStart;

      expect(filterTime).toBeLessThan(1000); // Should filter within 1 second
      expect(highPriorityTasks.every(t => t.priority === 'high')).toBe(true);
    });

    it('should efficiently manage database size with cleanup operations', async () => {
      // Create and complete many tasks
      const tasks = await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          store.createTask({
            description: `Cleanup test task ${i}`,
            workflow: 'feature',
            autonomy: 'full',
            agent: 'developer',
          })
        )
      );

      // Add logs and artifacts to increase database size
      for (const task of tasks.slice(0, 10)) {
        await store.addLog(task.id, {
          level: 'info',
          message: `Log for task ${task.id}`,
          timestamp: new Date(),
        });

        await store.addArtifact(task.id, {
          name: `artifact-${task.id}.txt`,
          path: `/tmp/artifact-${task.id}.txt`,
          type: 'file',
          size: 1024,
          createdAt: new Date(),
        });
      }

      // Complete and archive some tasks
      for (const task of tasks.slice(0, 25)) {
        await store.updateTaskStatus(task.id, 'completed');
        await store.archiveTask(task.id);
      }

      // Trash some tasks
      for (const task of tasks.slice(25, 40)) {
        await store.trashTask(task.id);
      }

      // Verify stats before cleanup
      const statsBefore = store.getTaskStats();
      expect(statsBefore.byStatus['completed']).toBeGreaterThanOrEqual(25);

      // Perform cleanup
      const deletedCount = await store.emptyTrash();
      expect(deletedCount).toBeGreaterThanOrEqual(15);

      // Verify cleanup was effective
      const statsAfter = store.getTaskStats();
      const trashedTasks = await store.getTrashedTasks();
      expect(trashedTasks.length).toBe(0);
    });
  });
});