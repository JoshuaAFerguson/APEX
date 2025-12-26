import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { TaskStore } from '../store';
import { Task } from '@apexcli/core';

// Mock the database module to avoid actual database operations
vi.mock('better-sqlite3', () => ({
  default: vi.fn().mockImplementation(() => ({
    exec: vi.fn(),
    prepare: vi.fn().mockReturnValue({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn().mockReturnValue([]),
    }),
    close: vi.fn(),
    pragma: vi.fn(),
  }))
}));

describe('Container Failure Auto-Resume Integration', () => {
  let store: TaskStore;

  beforeEach(() => {
    store = new TaskStore('/tmp/test.db');
  });

  afterEach(async () => {
    await store.close();
  });

  describe('Auto-Resumable Pause Reasons', () => {
    it('should include container_failure in resumable pause reasons', async () => {
      // Mock SQL query results for getResumableTasks
      const mockTasks: Partial<Task>[] = [
        {
          id: 'task-usage-limit',
          name: 'Usage Limit Task',
          description: 'Task paused for usage limit',
          status: 'paused',
          pauseReason: 'usage_limit',
          createdAt: new Date(),
          updatedAt: new Date(),
          pausedAt: new Date(),
        },
        {
          id: 'task-budget',
          name: 'Budget Task',
          description: 'Task paused for budget',
          status: 'paused',
          pauseReason: 'budget',
          createdAt: new Date(),
          updatedAt: new Date(),
          pausedAt: new Date(),
        },
        {
          id: 'task-capacity',
          name: 'Capacity Task',
          description: 'Task paused for capacity',
          status: 'paused',
          pauseReason: 'capacity',
          createdAt: new Date(),
          updatedAt: new Date(),
          pausedAt: new Date(),
        },
        {
          id: 'task-container-failure',
          name: 'Container Failure Task',
          description: 'Task paused due to container failure',
          status: 'paused',
          pauseReason: 'container_failure',
          createdAt: new Date(),
          updatedAt: new Date(),
          pausedAt: new Date(),
        },
        {
          id: 'task-manual',
          name: 'Manual Task',
          description: 'Task paused manually',
          status: 'paused',
          pauseReason: 'manual',
          createdAt: new Date(),
          updatedAt: new Date(),
          pausedAt: new Date(),
        },
      ];

      // Mock the database prepare method to return tasks based on pause reason filter
      const mockPrepareStatement = {
        all: vi.fn().mockImplementation(() => {
          // Filter tasks based on the resumable pause reasons
          return mockTasks.filter(task =>
            ['usage_limit', 'budget', 'capacity', 'container_failure'].includes(task.pauseReason!)
          );
        }),
      };

      const db = (store as any).db;
      db.prepare = vi.fn().mockReturnValue(mockPrepareStatement);

      // Call getResumableTasks
      const resumableTasks = await store.getResumableTasks();

      // Verify that container_failure tasks are included in resumable tasks
      expect(resumableTasks).toHaveLength(4);

      const pauseReasons = resumableTasks.map(task => task.pauseReason);
      expect(pauseReasons).toContain('usage_limit');
      expect(pauseReasons).toContain('budget');
      expect(pauseReasons).toContain('capacity');
      expect(pauseReasons).toContain('container_failure');

      // Manual pause reason should not be included
      expect(pauseReasons).not.toContain('manual');

      // Find the container_failure task specifically
      const containerFailureTask = resumableTasks.find(task => task.pauseReason === 'container_failure');
      expect(containerFailureTask).toBeDefined();
      expect(containerFailureTask?.id).toBe('task-container-failure');
      expect(containerFailureTask?.name).toBe('Container Failure Task');
    });

    it('should include container_failure in resumable parent tasks query', async () => {
      // Mock parent task with subtasks
      const mockParentTasks: Partial<Task>[] = [
        {
          id: 'parent-task-container-failure',
          name: 'Parent Task with Container Failure',
          description: 'Parent task paused due to container failure in subtask',
          status: 'paused',
          pauseReason: 'container_failure',
          subtaskIds: ['subtask-1', 'subtask-2'],
          createdAt: new Date(),
          updatedAt: new Date(),
          pausedAt: new Date(),
        },
        {
          id: 'parent-task-usage-limit',
          name: 'Parent Task with Usage Limit',
          description: 'Parent task paused due to usage limit',
          status: 'paused',
          pauseReason: 'usage_limit',
          subtaskIds: ['subtask-3'],
          createdAt: new Date(),
          updatedAt: new Date(),
          pausedAt: new Date(),
        },
        {
          id: 'parent-task-manual',
          name: 'Parent Task Manual',
          description: 'Parent task paused manually',
          status: 'paused',
          pauseReason: 'manual',
          subtaskIds: ['subtask-4'],
          createdAt: new Date(),
          updatedAt: new Date(),
          pausedAt: new Date(),
        },
      ];

      // Mock the database prepare method for parent tasks query
      const mockPrepareStatement = {
        all: vi.fn().mockImplementation(() => {
          // Filter parent tasks based on the resumable pause reasons
          return mockParentTasks.filter(task =>
            ['usage_limit', 'budget', 'capacity', 'container_failure'].includes(task.pauseReason!) &&
            task.subtaskIds && task.subtaskIds.length > 0
          );
        }),
      };

      const db = (store as any).db;
      db.prepare = vi.fn().mockReturnValue(mockPrepareStatement);

      // Call getResumableParentTasks
      const resumableParentTasks = await store.getResumableParentTasks();

      // Verify that container_failure parent tasks are included
      expect(resumableParentTasks).toHaveLength(2);

      const pauseReasons = resumableParentTasks.map(task => task.pauseReason);
      expect(pauseReasons).toContain('container_failure');
      expect(pauseReasons).toContain('usage_limit');

      // Manual pause reason should not be included
      expect(pauseReasons).not.toContain('manual');

      // Find the container_failure parent task specifically
      const containerFailureParent = resumableParentTasks.find(task => task.pauseReason === 'container_failure');
      expect(containerFailureParent).toBeDefined();
      expect(containerFailureParent?.id).toBe('parent-task-container-failure');
      expect(containerFailureParent?.subtaskIds).toEqual(['subtask-1', 'subtask-2']);
    });
  });

  describe('SQL Query Validation', () => {
    it('should have correct SQL queries with container_failure in pause reason filters', () => {
      const db = (store as any).db;
      const prepareCallHistory: string[] = [];

      // Mock prepare to capture SQL queries
      db.prepare = vi.fn().mockImplementation((sql: string) => {
        prepareCallHistory.push(sql);
        return {
          all: vi.fn().mockReturnValue([]),
          get: vi.fn().mockReturnValue(null),
          run: vi.fn().mockReturnValue({ changes: 0 }),
        };
      });

      // Call methods that should use the updated queries
      store.getResumableTasks();
      store.getResumableParentTasks();

      // Check that both queries include container_failure in the pause reason filter
      const resumableTasksQuery = prepareCallHistory.find(sql =>
        sql.includes("t.pause_reason IN ('usage_limit', 'budget', 'capacity', 'container_failure')") &&
        sql.includes('WHERE t.status = \'paused\'') &&
        !sql.includes('t.subtask_ids IS NOT NULL')
      );

      const resumableParentTasksQuery = prepareCallHistory.find(sql =>
        sql.includes("t.pause_reason IN ('usage_limit', 'budget', 'capacity', 'container_failure')") &&
        sql.includes('t.subtask_ids IS NOT NULL') &&
        sql.includes('t.subtask_ids != \'[]\'')
      );

      expect(resumableTasksQuery).toBeDefined();
      expect(resumableParentTasksQuery).toBeDefined();
    });
  });
});