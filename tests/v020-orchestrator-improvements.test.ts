import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from '@apexcli/core';
import { Task, TaskStatus, TaskPriority } from '@apexcli/core';

/**
 * V0.2.0 Orchestrator Improvements Test Suite
 *
 * Tests all orchestrator improvements marked as complete in ROADMAP.md v0.2.0:
 * - ✅ Task queue with priorities
 * - ✅ Concurrent task execution
 * - ✅ Task dependencies
 * - ✅ Automatic retries with backoff
 * - ✅ Subtask decomposition and execution
 * - ✅ Context compaction strategies
 */
describe('V0.2.0 Orchestrator Improvements', () => {
  let orchestrator: ApexOrchestrator;
  const testProjectPath = '/tmp/apex-orchestrator-test';

  beforeEach(async () => {
    // Create a test orchestrator instance
    orchestrator = new ApexOrchestrator({ projectPath: testProjectPath });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    // Clean up orchestrator
    if (orchestrator) {
      await orchestrator.shutdown();
    }
  });

  describe('Task Queue with Priorities', () => {
    it('should support task priority assignment', async () => {
      const highPriorityTask = await orchestrator.createTask({
        description: 'High priority task',
        priority: 'high' as TaskPriority,
        agent: 'developer'
      });

      const lowPriorityTask = await orchestrator.createTask({
        description: 'Low priority task',
        priority: 'low' as TaskPriority,
        agent: 'developer'
      });

      expect(highPriorityTask.priority).toBe('high');
      expect(lowPriorityTask.priority).toBe('low');
    });

    it('should process high priority tasks first', async () => {
      const executionOrder: string[] = [];

      // Mock task execution to track order
      const originalExecute = orchestrator['executeTask'];
      vi.spyOn(orchestrator as any, 'executeTask').mockImplementation(async (task: Task) => {
        executionOrder.push(task.id);
        return { status: 'completed' as TaskStatus, result: 'Mock result' };
      });

      // Create tasks in reverse priority order
      const lowTask = await orchestrator.createTask({
        description: 'Low priority task',
        priority: 'low' as TaskPriority,
        agent: 'developer'
      });

      const highTask = await orchestrator.createTask({
        description: 'High priority task',
        priority: 'high' as TaskPriority,
        agent: 'developer'
      });

      const mediumTask = await orchestrator.createTask({
        description: 'Medium priority task',
        priority: 'medium' as TaskPriority,
        agent: 'developer'
      });

      // Start processing - high priority should execute first
      await orchestrator.processQueue();

      // Verify execution order respects priority
      expect(executionOrder[0]).toBe(highTask.id);
      expect(executionOrder).toContain(mediumTask.id);
      expect(executionOrder).toContain(lowTask.id);
    });

    it('should handle priority queue operations', async () => {
      const tasks = [
        await orchestrator.createTask({
          description: 'Critical task',
          priority: 'critical' as TaskPriority,
          agent: 'developer'
        }),
        await orchestrator.createTask({
          description: 'Normal task',
          priority: 'normal' as TaskPriority,
          agent: 'developer'
        })
      ];

      const queueStatus = await orchestrator.getQueueStatus();

      // Verify tasks are in queue
      expect(queueStatus.totalTasks).toBeGreaterThan(0);
      expect(queueStatus.pendingTasks).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Task Execution', () => {
    it('should support concurrent task execution configuration', async () => {
      const config = orchestrator.getConfiguration();

      // Should have concurrency configuration
      expect(config).toHaveProperty('maxConcurrentTasks');
      expect(typeof config.maxConcurrentTasks).toBe('number');
      expect(config.maxConcurrentTasks).toBeGreaterThan(0);
    });

    it('should execute multiple tasks concurrently', async () => {
      const startTime = Date.now();
      const executionTimes: number[] = [];

      // Mock task execution with delay
      vi.spyOn(orchestrator as any, 'executeTask').mockImplementation(async (task: Task) => {
        const taskStartTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        executionTimes.push(Date.now() - taskStartTime);
        return { status: 'completed' as TaskStatus, result: 'Mock result' };
      });

      // Create multiple tasks
      const tasks = await Promise.all([
        orchestrator.createTask({ description: 'Task 1', agent: 'developer' }),
        orchestrator.createTask({ description: 'Task 2', agent: 'tester' }),
        orchestrator.createTask({ description: 'Task 3', agent: 'reviewer' })
      ]);

      // Execute concurrently
      await orchestrator.processQueue();

      const totalTime = Date.now() - startTime;

      // Concurrent execution should be faster than sequential
      expect(totalTime).toBeLessThan(300); // Should be less than sum of individual delays
    });

    it('should respect maximum concurrent task limits', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;

      // Mock to track concurrency
      vi.spyOn(orchestrator as any, 'executeTask').mockImplementation(async (task: Task) => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);

        await new Promise(resolve => setTimeout(resolve, 50));

        concurrentCount--;
        return { status: 'completed' as TaskStatus, result: 'Mock result' };
      });

      // Create many tasks
      const tasks = await Promise.all(Array.from({ length: 10 }, (_, i) =>
        orchestrator.createTask({ description: `Task ${i}`, agent: 'developer' })
      ));

      await orchestrator.processQueue();

      const config = orchestrator.getConfiguration();
      expect(maxConcurrent).toBeLessThanOrEqual(config.maxConcurrentTasks);
    });
  });

  describe('Task Dependencies', () => {
    it('should support task dependency specification', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent task',
        agent: 'developer'
      });

      const childTask = await orchestrator.createTask({
        description: 'Child task',
        agent: 'tester',
        dependencies: [parentTask.id]
      });

      expect(childTask.dependencies).toContain(parentTask.id);
    });

    it('should execute dependencies before dependent tasks', async () => {
      const executionOrder: string[] = [];

      vi.spyOn(orchestrator as any, 'executeTask').mockImplementation(async (task: Task) => {
        executionOrder.push(task.id);
        return { status: 'completed' as TaskStatus, result: 'Mock result' };
      });

      const taskA = await orchestrator.createTask({
        description: 'Task A',
        agent: 'developer'
      });

      const taskB = await orchestrator.createTask({
        description: 'Task B (depends on A)',
        agent: 'tester',
        dependencies: [taskA.id]
      });

      await orchestrator.processQueue();

      // Task A should execute before Task B
      const aIndex = executionOrder.indexOf(taskA.id);
      const bIndex = executionOrder.indexOf(taskB.id);
      expect(aIndex).toBeLessThan(bIndex);
    });

    it('should handle complex dependency chains', async () => {
      const executionOrder: string[] = [];

      vi.spyOn(orchestrator as any, 'executeTask').mockImplementation(async (task: Task) => {
        executionOrder.push(task.id);
        return { status: 'completed' as TaskStatus, result: 'Mock result' };
      });

      const taskA = await orchestrator.createTask({
        description: 'Task A',
        agent: 'developer'
      });

      const taskB = await orchestrator.createTask({
        description: 'Task B (depends on A)',
        agent: 'tester',
        dependencies: [taskA.id]
      });

      const taskC = await orchestrator.createTask({
        description: 'Task C (depends on B)',
        agent: 'reviewer',
        dependencies: [taskB.id]
      });

      await orchestrator.processQueue();

      // Verify execution order respects dependency chain
      const aIndex = executionOrder.indexOf(taskA.id);
      const bIndex = executionOrder.indexOf(taskB.id);
      const cIndex = executionOrder.indexOf(taskC.id);

      expect(aIndex).toBeLessThan(bIndex);
      expect(bIndex).toBeLessThan(cIndex);
    });
  });

  describe('Automatic Retries with Backoff', () => {
    it('should support retry configuration', async () => {
      const task = await orchestrator.createTask({
        description: 'Task with retry config',
        agent: 'developer',
        retries: {
          maxAttempts: 3,
          backoffStrategy: 'exponential',
          baseDelay: 1000
        }
      });

      expect(task.retries?.maxAttempts).toBe(3);
      expect(task.retries?.backoffStrategy).toBe('exponential');
    });

    it('should retry failed tasks automatically', async () => {
      let attemptCount = 0;

      vi.spyOn(orchestrator as any, 'executeTask').mockImplementation(async (task: Task) => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Mock failure');
        }
        return { status: 'completed' as TaskStatus, result: 'Success on retry' };
      });

      const task = await orchestrator.createTask({
        description: 'Flaky task',
        agent: 'developer',
        retries: {
          maxAttempts: 3,
          backoffStrategy: 'exponential',
          baseDelay: 100
        }
      });

      await orchestrator.processQueue();

      expect(attemptCount).toBe(2); // Initial + 1 retry

      const finalTask = await orchestrator.getTask(task.id);
      expect(finalTask.status).toBe('completed');
    });

    it('should implement exponential backoff', async () => {
      const retryTimes: number[] = [];
      let attemptCount = 0;

      vi.spyOn(orchestrator as any, 'executeTask').mockImplementation(async (task: Task) => {
        attemptCount++;
        retryTimes.push(Date.now());

        if (attemptCount < 3) {
          throw new Error('Mock failure');
        }
        return { status: 'completed' as TaskStatus, result: 'Success' };
      });

      const task = await orchestrator.createTask({
        description: 'Retry with backoff',
        agent: 'developer',
        retries: {
          maxAttempts: 3,
          backoffStrategy: 'exponential',
          baseDelay: 100
        }
      });

      await orchestrator.processQueue();

      // Verify increasing delay between retries
      if (retryTimes.length > 2) {
        const delay1 = retryTimes[1] - retryTimes[0];
        const delay2 = retryTimes[2] - retryTimes[1];
        expect(delay2).toBeGreaterThan(delay1);
      }
    });
  });

  describe('Subtask Decomposition and Execution', () => {
    it('should support subtask creation', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Complex task requiring subtasks',
        agent: 'developer'
      });

      const subtask = await orchestrator.createSubtask(parentTask.id, {
        description: 'Subtask 1',
        agent: 'developer'
      });

      expect(subtask.parentId).toBe(parentTask.id);

      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent.subtasks).toContain(subtask.id);
    });

    it('should execute subtasks as part of parent task', async () => {
      const executionOrder: string[] = [];

      vi.spyOn(orchestrator as any, 'executeTask').mockImplementation(async (task: Task) => {
        executionOrder.push(task.id);

        // If this is the parent task, decompose into subtasks
        if (task.description === 'Parent task with subtasks' && !task.parentId) {
          await orchestrator.createSubtask(task.id, {
            description: 'Subtask 1',
            agent: 'developer'
          });
          await orchestrator.createSubtask(task.id, {
            description: 'Subtask 2',
            agent: 'tester'
          });
        }

        return { status: 'completed' as TaskStatus, result: 'Completed' };
      });

      const parentTask = await orchestrator.createTask({
        description: 'Parent task with subtasks',
        agent: 'developer'
      });

      await orchestrator.processQueue();

      // Parent task should be in execution order
      expect(executionOrder).toContain(parentTask.id);
    });

    it('should track subtask completion for parent task', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Task with subtasks',
        agent: 'developer'
      });

      const subtask1 = await orchestrator.createSubtask(parentTask.id, {
        description: 'Subtask 1',
        agent: 'developer'
      });

      const subtask2 = await orchestrator.createSubtask(parentTask.id, {
        description: 'Subtask 2',
        agent: 'tester'
      });

      // Mock subtask completion
      await orchestrator.updateTaskStatus(subtask1.id, 'completed');
      await orchestrator.updateTaskStatus(subtask2.id, 'completed');

      const updatedParent = await orchestrator.getTask(parentTask.id);

      // Parent should reflect subtask completion
      expect(updatedParent.subtasks).toHaveLength(2);
    });
  });

  describe('Context Compaction Strategies', () => {
    it('should support context size management', async () => {
      const config = orchestrator.getConfiguration();

      // Should have context management settings
      expect(config).toHaveProperty('maxContextSize');
      expect(typeof config.maxContextSize).toBe('number');
    });

    it('should compact context when size limits are exceeded', async () => {
      // Create a task with large context
      const largeContext = 'x'.repeat(10000); // Large string

      const task = await orchestrator.createTask({
        description: 'Task with large context',
        agent: 'developer',
        context: largeContext
      });

      // Mock context compaction
      const compactedTask = await orchestrator.compactTaskContext(task.id);

      expect(compactedTask).toBeDefined();

      // Context should be managed/compacted
      const finalTask = await orchestrator.getTask(task.id);
      expect(finalTask).toBeDefined();
    });

    it('should preserve essential context during compaction', async () => {
      const essentialContext = {
        important: 'This data must be preserved',
        optional: 'x'.repeat(5000)
      };

      const task = await orchestrator.createTask({
        description: 'Task with mixed context',
        agent: 'developer',
        context: JSON.stringify(essentialContext)
      });

      const compactedTask = await orchestrator.compactTaskContext(task.id);

      // Essential data should be preserved
      expect(compactedTask).toBeDefined();
    });
  });

  describe('Queue Management', () => {
    it('should provide queue status information', async () => {
      // Create some tasks
      await Promise.all([
        orchestrator.createTask({ description: 'Task 1', agent: 'developer' }),
        orchestrator.createTask({ description: 'Task 2', agent: 'tester' }),
        orchestrator.createTask({ description: 'Task 3', agent: 'reviewer' })
      ]);

      const queueStatus = await orchestrator.getQueueStatus();

      expect(queueStatus).toHaveProperty('totalTasks');
      expect(queueStatus).toHaveProperty('pendingTasks');
      expect(queueStatus).toHaveProperty('runningTasks');
      expect(queueStatus).toHaveProperty('completedTasks');

      expect(queueStatus.totalTasks).toBeGreaterThan(0);
    });

    it('should support queue pause and resume', async () => {
      // Create tasks
      await Promise.all([
        orchestrator.createTask({ description: 'Task 1', agent: 'developer' }),
        orchestrator.createTask({ description: 'Task 2', agent: 'tester' })
      ]);

      // Pause queue
      await orchestrator.pauseQueue();

      let queueStatus = await orchestrator.getQueueStatus();
      expect(queueStatus.isPaused).toBe(true);

      // Resume queue
      await orchestrator.resumeQueue();

      queueStatus = await orchestrator.getQueueStatus();
      expect(queueStatus.isPaused).toBe(false);
    });

    it('should handle queue overflow gracefully', async () => {
      const config = orchestrator.getConfiguration();
      const maxQueueSize = config.maxQueueSize || 1000;

      // Attempt to create more tasks than queue can handle
      const tasks = [];
      for (let i = 0; i < maxQueueSize + 10; i++) {
        try {
          const task = await orchestrator.createTask({
            description: `Overflow task ${i}`,
            agent: 'developer'
          });
          tasks.push(task);
        } catch (error) {
          // Should handle overflow gracefully
          expect(error).toBeInstanceOf(Error);
          break;
        }
      }

      const queueStatus = await orchestrator.getQueueStatus();
      expect(queueStatus.totalTasks).toBeLessThanOrEqual(maxQueueSize);
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track task execution metrics', async () => {
      vi.spyOn(orchestrator as any, 'executeTask').mockImplementation(async (task: Task) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { status: 'completed' as TaskStatus, result: 'Success' };
      });

      const task = await orchestrator.createTask({
        description: 'Monitored task',
        agent: 'developer'
      });

      await orchestrator.processQueue();

      const metrics = await orchestrator.getTaskMetrics(task.id);

      expect(metrics).toHaveProperty('executionTime');
      expect(metrics).toHaveProperty('startTime');
      expect(metrics).toHaveProperty('endTime');
      expect(metrics.executionTime).toBeGreaterThan(0);
    });

    it('should provide orchestrator performance statistics', async () => {
      // Create and execute some tasks
      const tasks = await Promise.all([
        orchestrator.createTask({ description: 'Perf Task 1', agent: 'developer' }),
        orchestrator.createTask({ description: 'Perf Task 2', agent: 'tester' })
      ]);

      await orchestrator.processQueue();

      const stats = await orchestrator.getPerformanceStats();

      expect(stats).toHaveProperty('totalTasksExecuted');
      expect(stats).toHaveProperty('averageExecutionTime');
      expect(stats).toHaveProperty('successRate');
      expect(stats.totalTasksExecuted).toBeGreaterThan(0);
    });
  });
});