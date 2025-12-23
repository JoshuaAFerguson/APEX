import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task, TaskPriority, TaskEffort } from '@apexcli/core';

describe('Priority Tie-Breaking Logic', () => {
  let testDir: string;
  let store: TaskStore;

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: testDir,
    branchName: 'apex/test-branch',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-priority-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Basic Priority Ordering', () => {
    it('should order tasks by priority correctly', async () => {
      // Create tasks with different priorities
      const urgentTask = createTestTask({
        id: 'urgent_task',
        priority: 'urgent',
      });

      const highTask = createTestTask({
        id: 'high_task',
        priority: 'high',
      });

      const normalTask = createTestTask({
        id: 'normal_task',
        priority: 'normal',
      });

      const lowTask = createTestTask({
        id: 'low_task',
        priority: 'low',
      });

      // Create tasks in random order
      await store.createTask(normalTask);
      await store.createTask(urgentTask);
      await store.createTask(lowTask);
      await store.createTask(highTask);

      const orderedTasks = await store.listTasks({ orderByPriority: true });
      const taskIds = orderedTasks.map(t => t.id);

      expect(taskIds).toEqual(['urgent_task', 'high_task', 'normal_task', 'low_task']);
    });
  });

  describe('Priority Tie-Breaking with Effort', () => {
    it('should break ties using effort level when priorities are equal', async () => {
      const baseTime = new Date();

      // Create tasks with same priority but different effort levels
      const xlEffortTask = createTestTask({
        id: 'same_priority_xl_effort',
        priority: 'high',
        effort: 'xl',
        createdAt: baseTime,
      });

      const largeEffortTask = createTestTask({
        id: 'same_priority_large_effort',
        priority: 'high',
        effort: 'large',
        createdAt: baseTime,
      });

      const mediumEffortTask = createTestTask({
        id: 'same_priority_medium_effort',
        priority: 'high',
        effort: 'medium',
        createdAt: baseTime,
      });

      const smallEffortTask = createTestTask({
        id: 'same_priority_small_effort',
        priority: 'high',
        effort: 'small',
        createdAt: baseTime,
      });

      const xsEffortTask = createTestTask({
        id: 'same_priority_xs_effort',
        priority: 'high',
        effort: 'xs',
        createdAt: baseTime,
      });

      // Create tasks in random order
      await store.createTask(largeEffortTask);
      await store.createTask(xsEffortTask);
      await store.createTask(xlEffortTask);
      await store.createTask(mediumEffortTask);
      await store.createTask(smallEffortTask);

      const orderedTasks = await store.listTasks({ orderByPriority: true });
      const taskIds = orderedTasks.map(t => t.id);

      // Should be ordered by effort: xs, small, medium, large, xl
      expect(taskIds).toEqual([
        'same_priority_xs_effort',
        'same_priority_small_effort',
        'same_priority_medium_effort',
        'same_priority_large_effort',
        'same_priority_xl_effort',
      ]);
    });

    it('should prioritize lower effort when both priority and effort are considered', async () => {
      // Mix of priorities and efforts to test combined logic
      const urgentLargeTask = createTestTask({
        id: 'urgent_large',
        priority: 'urgent',
        effort: 'large',
      });

      const urgentSmallTask = createTestTask({
        id: 'urgent_small',
        priority: 'urgent',
        effort: 'small',
      });

      const highXsTask = createTestTask({
        id: 'high_xs',
        priority: 'high',
        effort: 'xs',
      });

      const highMediumTask = createTestTask({
        id: 'high_medium',
        priority: 'high',
        effort: 'medium',
      });

      await store.createTask(urgentLargeTask);
      await store.createTask(highMediumTask);
      await store.createTask(urgentSmallTask);
      await store.createTask(highXsTask);

      const orderedTasks = await store.listTasks({ orderByPriority: true });
      const taskIds = orderedTasks.map(t => t.id);

      // Urgent tasks first (ordered by effort), then high tasks (ordered by effort)
      expect(taskIds).toEqual([
        'urgent_small',    // urgent + small effort
        'urgent_large',    // urgent + large effort
        'high_xs',         // high + xs effort
        'high_medium',     // high + medium effort
      ]);
    });
  });

  describe('Creation Time Tie-Breaking', () => {
    it('should use creation time as final tie-breaker when priority and effort are equal', async () => {
      const baseTime = new Date('2024-01-01T10:00:00Z');
      const earlierTime = new Date('2024-01-01T09:00:00Z');
      const laterTime = new Date('2024-01-01T11:00:00Z');

      // Create tasks with same priority and effort but different creation times
      const middleTask = createTestTask({
        id: 'middle_created',
        priority: 'normal',
        effort: 'medium',
        createdAt: baseTime,
      });

      const earliestTask = createTestTask({
        id: 'earliest_created',
        priority: 'normal',
        effort: 'medium',
        createdAt: earlierTime,
      });

      const latestTask = createTestTask({
        id: 'latest_created',
        priority: 'normal',
        effort: 'medium',
        createdAt: laterTime,
      });

      // Create in random order
      await store.createTask(latestTask);
      await store.createTask(earliestTask);
      await store.createTask(middleTask);

      const orderedTasks = await store.listTasks({ orderByPriority: true });
      const taskIds = orderedTasks.map(t => t.id);

      // Should be ordered by creation time (earliest first)
      expect(taskIds).toEqual([
        'earliest_created',
        'middle_created',
        'latest_created',
      ]);
    });
  });

  describe('Ready Task Queue Prioritization', () => {
    it('should apply priority tie-breaking logic to ready tasks queue', async () => {
      const baseTime = new Date();

      // Create dependency task (completed)
      const dependencyTask = createTestTask({
        id: 'dependency',
        status: 'completed',
      });
      await store.createTask(dependencyTask);

      // Create ready tasks with same priority but different efforts
      const readySmallTask = createTestTask({
        id: 'ready_small',
        priority: 'normal',
        effort: 'small',
        createdAt: baseTime,
      });

      const readyLargeTask = createTestTask({
        id: 'ready_large',
        priority: 'normal',
        effort: 'large',
        createdAt: baseTime,
      });

      // Create blocked task with higher priority (should not appear)
      const blockedTask = createTestTask({
        id: 'blocked_urgent',
        priority: 'urgent',
        effort: 'xs',
        dependsOn: ['non_existent_task'],
      });

      await store.createTask(readyLargeTask);
      await store.createTask(readySmallTask);
      await store.createTask(blockedTask);

      const readyTasks = await store.getReadyTasks({ orderByPriority: true });
      const taskIds = readyTasks.map(t => t.id);

      // Should only include ready tasks, ordered by priority and effort
      expect(taskIds).toEqual([
        'ready_small',  // normal + small effort
        'ready_large',  // normal + large effort
      ]);
      expect(taskIds).not.toContain('blocked_urgent');
    });

    it('should get next queued task using priority tie-breaking', async () => {
      // Create multiple tasks with same priority but different efforts
      const mediumEffortTask = createTestTask({
        id: 'next_medium',
        priority: 'high',
        effort: 'medium',
      });

      const smallEffortTask = createTestTask({
        id: 'next_small',
        priority: 'high',
        effort: 'small',
      });

      await store.createTask(mediumEffortTask);
      await store.createTask(smallEffortTask);

      const nextTask = await store.getNextQueuedTask();

      // Should get the task with lower effort (small comes before medium)
      expect(nextTask?.id).toBe('next_small');
    });
  });

  describe('Paused Task Resumption Prioritization', () => {
    it('should apply priority tie-breaking to paused tasks ready for resume', async () => {
      const baseTime = new Date();

      // Create paused tasks with same priority but different efforts
      const pausedMediumTask = createTestTask({
        id: 'paused_medium',
        status: 'paused',
        priority: 'normal',
        effort: 'medium',
        createdAt: baseTime,
      });

      const pausedXsTask = createTestTask({
        id: 'paused_xs',
        status: 'paused',
        priority: 'normal',
        effort: 'xs',
        createdAt: baseTime,
      });

      await store.createTask(pausedMediumTask);
      await store.createTask(pausedXsTask);

      // Update both with resumable pause reasons
      await store.updateTask(pausedMediumTask.id, { pauseReason: 'usage_limit' });
      await store.updateTask(pausedXsTask.id, { pauseReason: 'budget' });

      const resumableTasks = await store.getPausedTasksForResume();
      const taskIds = resumableTasks.map(t => t.id);

      // Should be ordered by effort (xs before medium)
      expect(taskIds).toEqual(['paused_xs', 'paused_medium']);
    });

    it('should apply priority tie-breaking to parent tasks for auto-resume', async () => {
      // Create parent tasks with same priority but different efforts
      const parentMediumTask = createTestTask({
        id: 'parent_medium',
        status: 'paused',
        priority: 'high',
        effort: 'medium',
        subtaskIds: ['subtask1'],
      });

      const parentSmallTask = createTestTask({
        id: 'parent_small',
        status: 'paused',
        priority: 'high',
        effort: 'small',
        subtaskIds: ['subtask2'],
      });

      await store.createTask(parentMediumTask);
      await store.createTask(parentSmallTask);

      // Update both with resumable pause reasons
      await store.updateTask(parentMediumTask.id, { pauseReason: 'capacity' });
      await store.updateTask(parentSmallTask.id, { pauseReason: 'usage_limit' });

      const parentTasks = await store.findHighestPriorityParentTask();
      const taskIds = parentTasks.map(t => t.id);

      // Should be ordered by effort (small before medium)
      expect(taskIds).toEqual(['parent_small', 'parent_medium']);
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle undefined priority gracefully', async () => {
      const undefinedPriorityTask = createTestTask({
        id: 'undefined_priority',
        priority: undefined as any,
        effort: 'small',
      });

      const normalPriorityTask = createTestTask({
        id: 'normal_priority',
        priority: 'normal',
        effort: 'large',
      });

      await store.createTask(undefinedPriorityTask);
      await store.createTask(normalPriorityTask);

      const orderedTasks = await store.listTasks({ orderByPriority: true });
      const taskIds = orderedTasks.map(t => t.id);

      // Undefined priority should be treated as normal (default)
      // small effort should come before large effort
      expect(taskIds).toEqual(['undefined_priority', 'normal_priority']);
    });

    it('should handle undefined effort gracefully', async () => {
      const undefinedEffortTask = createTestTask({
        id: 'undefined_effort',
        priority: 'normal',
        effort: undefined as any,
      });

      const mediumEffortTask = createTestTask({
        id: 'medium_effort',
        priority: 'normal',
        effort: 'medium',
      });

      await store.createTask(undefinedEffortTask);
      await store.createTask(mediumEffortTask);

      const orderedTasks = await store.listTasks({ orderByPriority: true });

      // Both tasks should be retrieved successfully
      expect(orderedTasks).toHaveLength(2);
      const taskIds = orderedTasks.map(t => t.id);
      expect(taskIds).toContain('undefined_effort');
      expect(taskIds).toContain('medium_effort');
    });

    it('should handle invalid priority values gracefully', async () => {
      const invalidPriorityTask = createTestTask({
        id: 'invalid_priority',
        priority: 'invalid_value' as any,
        effort: 'small',
      });

      const validPriorityTask = createTestTask({
        id: 'valid_priority',
        priority: 'high',
        effort: 'medium',
      });

      await store.createTask(invalidPriorityTask);
      await store.createTask(validPriorityTask);

      const orderedTasks = await store.listTasks({ orderByPriority: true });

      // Should handle gracefully and return both tasks
      expect(orderedTasks).toHaveLength(2);

      // Valid priority task should come first
      expect(orderedTasks[0].id).toBe('valid_priority');
      expect(orderedTasks[1].id).toBe('invalid_priority');
    });

    it('should handle invalid effort values gracefully', async () => {
      const invalidEffortTask = createTestTask({
        id: 'invalid_effort',
        priority: 'normal',
        effort: 'invalid_effort' as any,
      });

      const validEffortTask = createTestTask({
        id: 'valid_effort',
        priority: 'normal',
        effort: 'small',
      });

      await store.createTask(invalidEffortTask);
      await store.createTask(validEffortTask);

      const orderedTasks = await store.listTasks({ orderByPriority: true });

      // Should handle gracefully and return both tasks
      expect(orderedTasks).toHaveLength(2);
      const taskIds = orderedTasks.map(t => t.id);
      expect(taskIds).toContain('invalid_effort');
      expect(taskIds).toContain('valid_effort');
    });

    it('should handle empty database gracefully', async () => {
      const orderedTasks = await store.listTasks({ orderByPriority: true });
      expect(orderedTasks).toEqual([]);

      const nextTask = await store.getNextQueuedTask();
      expect(nextTask).toBeNull();

      const readyTasks = await store.getReadyTasks({ orderByPriority: true });
      expect(readyTasks).toEqual([]);

      const pausedTasks = await store.getPausedTasksForResume();
      expect(pausedTasks).toEqual([]);

      const parentTasks = await store.findHighestPriorityParentTask();
      expect(parentTasks).toEqual([]);
    });
  });

  describe('Comprehensive Tie-Breaking Scenarios', () => {
    it('should handle complex multi-level tie-breaking scenarios', async () => {
      const baseTime = new Date('2024-01-01T10:00:00Z');

      // Create a comprehensive set of tasks to test all tie-breaking levels
      const tasks = [
        // Urgent priority group
        createTestTask({
          id: 'urgent_large_late',
          priority: 'urgent',
          effort: 'large',
          createdAt: new Date(baseTime.getTime() + 60000), // 1 minute later
        }),
        createTestTask({
          id: 'urgent_large_early',
          priority: 'urgent',
          effort: 'large',
          createdAt: new Date(baseTime.getTime() - 60000), // 1 minute earlier
        }),
        createTestTask({
          id: 'urgent_small_late',
          priority: 'urgent',
          effort: 'small',
          createdAt: new Date(baseTime.getTime() + 30000), // 30 seconds later
        }),
        createTestTask({
          id: 'urgent_small_early',
          priority: 'urgent',
          effort: 'small',
          createdAt: new Date(baseTime.getTime() - 30000), // 30 seconds earlier
        }),

        // High priority group
        createTestTask({
          id: 'high_xs_base',
          priority: 'high',
          effort: 'xs',
          createdAt: baseTime,
        }),
        createTestTask({
          id: 'high_medium_base',
          priority: 'high',
          effort: 'medium',
          createdAt: baseTime,
        }),

        // Normal priority group
        createTestTask({
          id: 'normal_small_base',
          priority: 'normal',
          effort: 'small',
          createdAt: baseTime,
        }),
      ];

      // Create tasks in random order
      const shuffledTasks = [...tasks].sort(() => Math.random() - 0.5);
      for (const task of shuffledTasks) {
        await store.createTask(task);
      }

      const orderedTasks = await store.listTasks({ orderByPriority: true });
      const taskIds = orderedTasks.map(t => t.id);

      // Expected order: urgent (by effort, then by time), high (by effort, then by time), normal (by effort, then by time)
      expect(taskIds).toEqual([
        'urgent_small_early',   // urgent + small + earliest
        'urgent_small_late',    // urgent + small + later
        'urgent_large_early',   // urgent + large + earliest
        'urgent_large_late',    // urgent + large + latest
        'high_xs_base',         // high + xs
        'high_medium_base',     // high + medium
        'normal_small_base',    // normal + small
      ]);
    });

    it('should handle all effort levels in correct order', async () => {
      const efforts: TaskEffort[] = ['xl', 'large', 'medium', 'small', 'xs'];
      const tasks = efforts.map((effort, index) =>
        createTestTask({
          id: `effort_${effort}`,
          priority: 'normal',
          effort: effort,
          createdAt: new Date(Date.now() + index * 1000), // Different creation times
        })
      );

      // Create in reverse order
      for (const task of tasks.reverse()) {
        await store.createTask(task);
      }

      const orderedTasks = await store.listTasks({ orderByPriority: true });
      const taskIds = orderedTasks.map(t => t.id);

      // Should be ordered from lowest effort to highest effort
      expect(taskIds).toEqual([
        'effort_xs',
        'effort_small',
        'effort_medium',
        'effort_large',
        'effort_xl',
      ]);
    });

    it('should handle all priority levels in correct order', async () => {
      const priorities: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];
      const tasks = priorities.map((priority, index) =>
        createTestTask({
          id: `priority_${priority}`,
          priority: priority,
          effort: 'medium',
          createdAt: new Date(Date.now() + index * 1000), // Different creation times
        })
      );

      // Create in reverse order
      for (const task of tasks.reverse()) {
        await store.createTask(task);
      }

      const orderedTasks = await store.listTasks({ orderByPriority: true });
      const taskIds = orderedTasks.map(t => t.id);

      // Should be ordered from highest priority to lowest priority
      expect(taskIds).toEqual([
        'priority_urgent',
        'priority_high',
        'priority_normal',
        'priority_low',
      ]);
    });
  });

  describe('Performance and Scale Tests', () => {
    it('should handle prioritization efficiently with large number of tasks', async () => {
      const startTime = Date.now();

      // Create 1000 tasks with random priorities and efforts
      const priorities: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];
      const efforts: TaskEffort[] = ['xs', 'small', 'medium', 'large', 'xl'];

      const tasks: Task[] = [];
      for (let i = 0; i < 1000; i++) {
        const priority = priorities[Math.floor(Math.random() * priorities.length)];
        const effort = efforts[Math.floor(Math.random() * efforts.length)];

        tasks.push(createTestTask({
          id: `scale_task_${i}`,
          priority: priority,
          effort: effort,
          createdAt: new Date(Date.now() + Math.random() * 10000), // Random creation times
        }));
      }

      // Create all tasks
      for (const task of tasks) {
        await store.createTask(task);
      }

      const creationTime = Date.now() - startTime;
      console.log(`Created 1000 tasks in ${creationTime}ms`);

      // Test ordering performance
      const orderingStartTime = Date.now();
      const orderedTasks = await store.listTasks({ orderByPriority: true });
      const orderingTime = Date.now() - orderingStartTime;

      console.log(`Ordered 1000 tasks in ${orderingTime}ms`);

      // Verify we got all tasks and they are properly ordered
      expect(orderedTasks).toHaveLength(1000);

      // Verify ordering is correct by checking a sample
      for (let i = 0; i < orderedTasks.length - 1; i++) {
        const current = orderedTasks[i];
        const next = orderedTasks[i + 1];

        // Priority comparison (urgent=1, high=2, normal=3, low=4)
        const currentPriorityValue =
          current.priority === 'urgent' ? 1 :
          current.priority === 'high' ? 2 :
          current.priority === 'normal' ? 3 : 4;

        const nextPriorityValue =
          next.priority === 'urgent' ? 1 :
          next.priority === 'high' ? 2 :
          next.priority === 'normal' ? 3 : 4;

        // Current task should have priority <= next task's priority
        expect(currentPriorityValue).toBeLessThanOrEqual(nextPriorityValue);

        // If priorities are equal, check effort ordering
        if (currentPriorityValue === nextPriorityValue) {
          const currentEffortValue =
            current.effort === 'xs' ? 1 :
            current.effort === 'small' ? 2 :
            current.effort === 'medium' ? 3 :
            current.effort === 'large' ? 4 : 5;

          const nextEffortValue =
            next.effort === 'xs' ? 1 :
            next.effort === 'small' ? 2 :
            next.effort === 'medium' ? 3 :
            next.effort === 'large' ? 4 : 5;

          expect(currentEffortValue).toBeLessThanOrEqual(nextEffortValue);

          // If effort is also equal, check creation time
          if (currentEffortValue === nextEffortValue) {
            expect(current.createdAt.getTime()).toBeLessThanOrEqual(next.createdAt.getTime());
          }
        }
      }

      // Performance should be reasonable (under 1 second for 1000 tasks)
      expect(orderingTime).toBeLessThan(1000);
    });
  });
});