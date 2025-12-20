import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task, TaskPriority } from '@apexcli/core';

/**
 * Integration tests specifically for the getPausedTasksForResume() method
 * These tests focus on comprehensive scenarios and edge cases for paused task resumption
 */
describe('TaskStore - getPausedTasksForResume Integration', () => {
  let testDir: string;
  let store: TaskStore;

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substring(7)}`,
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
    dependsOn: [],
    blockedBy: [],
    ...overrides,
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-pause-resume-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Comprehensive Pause Reason Filtering', () => {
    it('should return only tasks with resumable pause reasons', async () => {
      const testCases = [
        { pauseReason: 'usage_limit', shouldReturn: true },
        { pauseReason: 'budget', shouldReturn: true },
        { pauseReason: 'capacity', shouldReturn: true },
        { pauseReason: 'manual', shouldReturn: false },
        { pauseReason: 'user_request', shouldReturn: false },
        { pauseReason: 'system_shutdown', shouldReturn: false },
        { pauseReason: 'error', shouldReturn: false },
        { pauseReason: null, shouldReturn: false },
        { pauseReason: undefined, shouldReturn: false },
      ];

      for (const [index, testCase] of testCases.entries()) {
        const task = createTestTask({
          id: `task_${index}`,
          status: 'paused',
          priority: 'normal',
        });

        await store.createTask(task);
        await store.updateTask(task.id, {
          pauseReason: testCase.pauseReason as string | undefined
        });
      }

      const resumableTasks = await store.getPausedTasksForResume();
      const expectedCount = testCases.filter(tc => tc.shouldReturn).length;

      expect(resumableTasks).toHaveLength(expectedCount);

      for (const task of resumableTasks) {
        expect(['usage_limit', 'budget', 'capacity']).toContain(task.pauseReason);
      }
    });
  });

  describe('Priority and Time Ordering', () => {
    it('should order tasks correctly by priority then creation time', async () => {
      const baseTime = new Date('2024-01-01T10:00:00Z');

      const taskConfigs = [
        { id: 'low_1', priority: 'low' as TaskPriority, offset: 0 },
        { id: 'urgent_1', priority: 'urgent' as TaskPriority, offset: 60000 },
        { id: 'normal_1', priority: 'normal' as TaskPriority, offset: 30000 },
        { id: 'high_1', priority: 'high' as TaskPriority, offset: 90000 },
        { id: 'urgent_2', priority: 'urgent' as TaskPriority, offset: 120000 },
        { id: 'normal_2', priority: 'normal' as TaskPriority, offset: 150000 },
        { id: 'low_2', priority: 'low' as TaskPriority, offset: 180000 },
        { id: 'high_2', priority: 'high' as TaskPriority, offset: 210000 },
      ];

      // Create tasks in random order
      for (const config of taskConfigs) {
        const task = createTestTask({
          id: config.id,
          status: 'paused',
          priority: config.priority,
          createdAt: new Date(baseTime.getTime() + config.offset),
        });

        await store.createTask(task);
        await store.updateTask(task.id, { pauseReason: 'usage_limit' });
      }

      const resumableTasks = await store.getPausedTasksForResume();
      const actualOrder = resumableTasks.map(t => t.id);

      // Expected order: urgent (by creation time), high (by creation time), normal (by creation time), low (by creation time)
      const expectedOrder = [
        'urgent_1', 'urgent_2', // urgent priority, ordered by creation time
        'high_1', 'high_2',     // high priority, ordered by creation time
        'normal_1', 'normal_2', // normal priority, ordered by creation time
        'low_1', 'low_2',       // low priority, ordered by creation time
      ];

      expect(actualOrder).toEqual(expectedOrder);
    });

    it('should handle undefined priority values as normal priority', async () => {
      const baseTime = new Date();

      // Task with undefined priority (should be treated as normal)
      const undefinedPriorityTask = createTestTask({
        id: 'undefined_priority',
        status: 'paused',
        priority: undefined as any,
        createdAt: baseTime,
      });

      // Task with explicit normal priority
      const normalPriorityTask = createTestTask({
        id: 'normal_priority',
        status: 'paused',
        priority: 'normal',
        createdAt: new Date(baseTime.getTime() + 1000),
      });

      // Task with high priority
      const highPriorityTask = createTestTask({
        id: 'high_priority',
        status: 'paused',
        priority: 'high',
        createdAt: new Date(baseTime.getTime() + 2000),
      });

      await store.createTask(undefinedPriorityTask);
      await store.updateTask(undefinedPriorityTask.id, { pauseReason: 'usage_limit' });

      await store.createTask(normalPriorityTask);
      await store.updateTask(normalPriorityTask.id, { pauseReason: 'budget' });

      await store.createTask(highPriorityTask);
      await store.updateTask(highPriorityTask.id, { pauseReason: 'capacity' });

      const resumableTasks = await store.getPausedTasksForResume();

      expect(resumableTasks[0].id).toBe('high_priority');
      // Both undefined and normal priority tasks should be treated equally and ordered by creation time
      expect(resumableTasks[1].id).toBe('undefined_priority');
      expect(resumableTasks[2].id).toBe('normal_priority');
    });
  });

  describe('ResumeAfter Time Filtering', () => {
    it('should handle various resumeAfter scenarios', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 300000); // 5 minutes ago
      const nearPast = new Date(now.getTime() - 1000); // 1 second ago
      const nearFuture = new Date(now.getTime() + 1000); // 1 second from now
      const farFuture = new Date(now.getTime() + 300000); // 5 minutes from now

      const scenarios = [
        { id: 'null_resume', resumeAfter: null, shouldReturn: true },
        { id: 'undefined_resume', resumeAfter: undefined, shouldReturn: true },
        { id: 'past_resume', resumeAfter: past, shouldReturn: true },
        { id: 'near_past_resume', resumeAfter: nearPast, shouldReturn: true },
        { id: 'near_future_resume', resumeAfter: nearFuture, shouldReturn: false },
        { id: 'far_future_resume', resumeAfter: farFuture, shouldReturn: false },
      ];

      for (const scenario of scenarios) {
        const task = createTestTask({
          id: scenario.id,
          status: 'paused',
          priority: 'normal',
        });

        await store.createTask(task);
        await store.updateTask(task.id, {
          pauseReason: 'usage_limit',
          resumeAfter: scenario.resumeAfter as Date | undefined,
        });
      }

      const resumableTasks = await store.getPausedTasksForResume();
      const returnedIds = resumableTasks.map(t => t.id);
      const expectedCount = scenarios.filter(s => s.shouldReturn).length;

      expect(resumableTasks).toHaveLength(expectedCount);

      for (const scenario of scenarios) {
        if (scenario.shouldReturn) {
          expect(returnedIds).toContain(scenario.id);
        } else {
          expect(returnedIds).not.toContain(scenario.id);
        }
      }
    });

    it('should handle boundary case with exact current time', async () => {
      const exactNow = new Date();

      const task = createTestTask({
        status: 'paused',
        priority: 'normal',
      });

      await store.createTask(task);
      await store.updateTask(task.id, {
        pauseReason: 'usage_limit',
        resumeAfter: exactNow,
      });

      // Wait a tiny bit to ensure we're past the exact timestamp
      await new Promise(resolve => setTimeout(resolve, 50));

      const resumableTasks = await store.getPausedTasksForResume();

      expect(resumableTasks).toHaveLength(1);
      expect(resumableTasks[0].id).toBe(task.id);
    });
  });

  describe('Task Relationships and Full Object Structure', () => {
    it('should return tasks with complete object graph including relationships', async () => {
      // Create dependency task
      const dependencyTask = createTestTask({
        id: 'dependency_completed',
        status: 'completed',
        priority: 'normal',
      });
      await store.createTask(dependencyTask);

      // Create blocking task (incomplete dependency)
      const blockingTask = createTestTask({
        id: 'blocking_pending',
        status: 'pending',
        priority: 'normal',
      });
      await store.createTask(blockingTask);

      // Create main paused task with dependencies
      const mainTask = createTestTask({
        id: 'main_paused_task',
        status: 'paused',
        priority: 'high',
        dependsOn: ['dependency_completed', 'blocking_pending'],
      });
      await store.createTask(mainTask);
      await store.updateTask(mainTask.id, { pauseReason: 'usage_limit' });

      // Add artifacts and logs
      await store.addArtifact(mainTask.id, {
        name: 'output.json',
        type: 'data',
        content: '{"result": "test"}',
      });

      await store.addLog(mainTask.id, {
        level: 'info',
        message: 'Task paused due to usage limit',
        stage: 'implementation',
        agent: 'developer',
      });

      const resumableTasks = await store.getPausedTasksForResume();

      expect(resumableTasks).toHaveLength(1);
      const task = resumableTasks[0];

      // Verify all task properties are correctly populated
      expect(task.id).toBe('main_paused_task');
      expect(task.status).toBe('paused');
      expect(task.priority).toBe('high');
      expect(task.pauseReason).toBe('usage_limit');

      // Verify dependencies
      expect(task.dependsOn).toEqual(['dependency_completed', 'blocking_pending']);
      expect(task.blockedBy).toEqual(['blocking_pending']); // only incomplete dependencies

      // Verify artifacts
      expect(task.artifacts).toHaveLength(1);
      expect(task.artifacts[0].name).toBe('output.json');
      expect(task.artifacts[0].type).toBe('data');
      expect(task.artifacts[0].content).toBe('{"result": "test"}');

      // Verify logs
      expect(task.logs).toHaveLength(1);
      expect(task.logs[0].level).toBe('info');
      expect(task.logs[0].message).toBe('Task paused due to usage limit');
      expect(task.logs[0].stage).toBe('implementation');
      expect(task.logs[0].agent).toBe('developer');
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle large number of paused tasks efficiently', async () => {
      const taskCount = 100;
      const resumableTaskCount = 30; // Only tasks with resumable pause reasons

      // Create a mix of tasks with different statuses and pause reasons
      for (let i = 0; i < taskCount; i++) {
        const task = createTestTask({
          id: `task_${i.toString().padStart(3, '0')}`,
          status: i % 3 === 0 ? 'paused' : (i % 3 === 1 ? 'pending' : 'completed'),
          priority: (['urgent', 'high', 'normal', 'low'] as TaskPriority[])[i % 4],
          createdAt: new Date(Date.now() + i * 1000), // Spread creation times
        });

        await store.createTask(task);

        if (task.status === 'paused') {
          const pauseReasons = ['usage_limit', 'budget', 'capacity', 'manual', 'user_request'];
          const pauseReason = pauseReasons[i % pauseReasons.length];
          await store.updateTask(task.id, { pauseReason });
        }
      }

      const startTime = Date.now();
      const resumableTasks = await store.getPausedTasksForResume();
      const endTime = Date.now();

      // Verify correct filtering (only resumable pause reasons)
      expect(resumableTasks).toHaveLength(resumableTaskCount);

      // Verify performance (should complete in reasonable time)
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second

      // Verify ordering is maintained
      let previousPriorityValue = 0;
      let previousCreationTime = new Date(0);

      for (const task of resumableTasks) {
        const priorityValue = ['urgent', 'high', 'normal', 'low'].indexOf(task.priority || 'normal');

        if (priorityValue === previousPriorityValue) {
          // Same priority, check creation time ordering
          expect(task.createdAt.getTime()).toBeGreaterThanOrEqual(previousCreationTime.getTime());
          previousCreationTime = task.createdAt;
        } else {
          // Different priority, should be higher (lower index)
          expect(priorityValue).toBeGreaterThanOrEqual(previousPriorityValue);
          previousPriorityValue = priorityValue;
          previousCreationTime = task.createdAt;
        }
      }
    });
  });

  describe('Database Consistency', () => {
    it('should maintain data consistency across multiple operations', async () => {
      // Create a task and pause it
      const task = createTestTask({
        status: 'pending',
        priority: 'normal',
      });

      await store.createTask(task);

      // Update to paused status with resumable reason
      await store.updateTask(task.id, {
        status: 'paused',
        pausedAt: new Date(),
        pauseReason: 'usage_limit',
      });

      // Verify it appears in resumable tasks
      let resumableTasks = await store.getPausedTasksForResume();
      expect(resumableTasks).toHaveLength(1);
      expect(resumableTasks[0].id).toBe(task.id);

      // Change pause reason to non-resumable
      await store.updateTask(task.id, {
        pauseReason: 'manual',
      });

      // Verify it no longer appears in resumable tasks
      resumableTasks = await store.getPausedTasksForResume();
      expect(resumableTasks).toHaveLength(0);

      // Change back to resumable reason
      await store.updateTask(task.id, {
        pauseReason: 'budget',
      });

      // Verify it appears again
      resumableTasks = await store.getPausedTasksForResume();
      expect(resumableTasks).toHaveLength(1);
      expect(resumableTasks[0].pauseReason).toBe('budget');

      // Change status to completed
      await store.updateTask(task.id, {
        status: 'completed',
        completedAt: new Date(),
      });

      // Verify it no longer appears (not paused anymore)
      resumableTasks = await store.getPausedTasksForResume();
      expect(resumableTasks).toHaveLength(0);
    });
  });
});