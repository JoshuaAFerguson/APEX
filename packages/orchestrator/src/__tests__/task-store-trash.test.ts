/**
 * Unit tests for trash management in TaskStore
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskStore } from '../store.js';
import { Task, TaskStatus } from '@apexcli/core';
import Database from 'better-sqlite3';

// Mock better-sqlite3
const mockDb = {
  exec: vi.fn(),
  prepare: vi.fn(() => ({
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
  })),
  close: vi.fn(),
};

vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => mockDb),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined),
}));

// Create mock task data
const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'test-task-12345678',
  description: 'Test task for trash functionality',
  status: 'pending' as TaskStatus,
  workflow: 'test-workflow',
  agent: 'test-agent',
  priority: 'medium',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  trashedAt: null,
  archivedAt: null,
  usage: {
    inputTokens: 100,
    outputTokens: 50,
    estimatedCost: 0.01,
  },
  context: {},
  result: null,
  error: null,
  metadata: {},
  ...overrides,
});

describe('TaskStore Trash Operations', () => {
  let store: TaskStore;
  let mockGetStmt: any;
  let mockUpdateStmt: any;
  let mockListTrashedStmt: any;
  let mockDeleteStmt: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock statements
    mockGetStmt = { get: vi.fn() };
    mockUpdateStmt = { run: vi.fn() };
    mockListTrashedStmt = { all: vi.fn() };
    mockDeleteStmt = { run: vi.fn() };

    // Configure mockDb.prepare to return appropriate mocks
    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM tasks WHERE id = ?')) {
        return mockGetStmt;
      }
      if (sql.includes('UPDATE tasks SET')) {
        return mockUpdateStmt;
      }
      if (sql.includes('trashedAt IS NOT NULL')) {
        return mockListTrashedStmt;
      }
      if (sql.includes('DELETE FROM')) {
        return mockDeleteStmt;
      }
      return { run: vi.fn(), get: vi.fn(), all: vi.fn() };
    });

    store = new TaskStore('/test/path');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('trashTask', () => {
    it('should mark a task as trashed', async () => {
      const task = createMockTask();
      mockUpdateStmt.run.mockReturnValue({ changes: 1 });

      await store.trashTask(task.id);

      expect(mockUpdateStmt.run).toHaveBeenCalledWith({
        trashedAt: expect.any(Date),
        status: 'cancelled',
        updatedAt: expect.any(Date),
        id: task.id,
      });
    });

    it('should throw error if task update fails', async () => {
      mockUpdateStmt.run.mockReturnValue({ changes: 0 });

      await expect(store.trashTask('nonexistent')).rejects.toThrow(
        'Failed to update task'
      );
    });

    it('should handle database errors gracefully', async () => {
      mockUpdateStmt.run.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(store.trashTask('test-task')).rejects.toThrow('Database error');
    });
  });

  describe('restoreTask', () => {
    it('should restore a trashed task', async () => {
      const trashedTask = createMockTask({
        trashedAt: new Date(),
        status: 'cancelled' as TaskStatus,
      });

      mockGetStmt.get.mockReturnValue({
        ...trashedTask,
        trashedAt: trashedTask.trashedAt?.toISOString(),
        createdAt: trashedTask.createdAt.toISOString(),
        updatedAt: trashedTask.updatedAt.toISOString(),
        usage: JSON.stringify(trashedTask.usage),
        context: JSON.stringify(trashedTask.context),
        metadata: JSON.stringify(trashedTask.metadata),
      });

      mockUpdateStmt.run.mockReturnValue({ changes: 1 });

      await store.restoreTask(trashedTask.id, 'pending');

      expect(mockGetStmt.get).toHaveBeenCalledWith(trashedTask.id);
      expect(mockUpdateStmt.run).toHaveBeenCalledWith({
        trashedAt: null,
        archivedAt: null,
        status: 'pending',
        updatedAt: expect.any(Date),
        id: trashedTask.id,
      });
    });

    it('should throw error if task not found', async () => {
      mockGetStmt.get.mockReturnValue(null);

      await expect(store.restoreTask('nonexistent')).rejects.toThrow(
        'Task with ID nonexistent not found'
      );
    });

    it('should throw error if task is not in trash', async () => {
      const task = createMockTask();
      mockGetStmt.get.mockReturnValue({
        ...task,
        trashedAt: null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        usage: JSON.stringify(task.usage),
        context: JSON.stringify(task.context),
        metadata: JSON.stringify(task.metadata),
      });

      await expect(store.restoreTask(task.id)).rejects.toThrow(
        'Task is not in trash'
      );
    });

    it('should default to pending status when none provided', async () => {
      const trashedTask = createMockTask({
        trashedAt: new Date(),
        status: 'cancelled' as TaskStatus,
      });

      mockGetStmt.get.mockReturnValue({
        ...trashedTask,
        trashedAt: trashedTask.trashedAt?.toISOString(),
        createdAt: trashedTask.createdAt.toISOString(),
        updatedAt: trashedTask.updatedAt.toISOString(),
        usage: JSON.stringify(trashedTask.usage),
        context: JSON.stringify(trashedTask.context),
        metadata: JSON.stringify(trashedTask.metadata),
      });

      mockUpdateStmt.run.mockReturnValue({ changes: 1 });

      await store.restoreTask(trashedTask.id);

      expect(mockUpdateStmt.run).toHaveBeenCalledWith({
        trashedAt: null,
        archivedAt: null,
        status: 'pending', // Should default to pending
        updatedAt: expect.any(Date),
        id: trashedTask.id,
      });
    });

    it('should handle database errors gracefully', async () => {
      const trashedTask = createMockTask({ trashedAt: new Date() });

      mockGetStmt.get.mockReturnValue({
        ...trashedTask,
        trashedAt: trashedTask.trashedAt?.toISOString(),
        createdAt: trashedTask.createdAt.toISOString(),
        updatedAt: trashedTask.updatedAt.toISOString(),
        usage: JSON.stringify(trashedTask.usage),
        context: JSON.stringify(trashedTask.context),
        metadata: JSON.stringify(trashedTask.metadata),
      });

      mockUpdateStmt.run.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(store.restoreTask(trashedTask.id)).rejects.toThrow('Database error');
    });
  });

  describe('listTrashed', () => {
    it('should return list of trashed tasks', async () => {
      const trashedTasks = [
        createMockTask({
          id: 'task1',
          trashedAt: new Date(),
          status: 'cancelled' as TaskStatus,
        }),
        createMockTask({
          id: 'task2',
          trashedAt: new Date(),
          status: 'cancelled' as TaskStatus,
        }),
      ];

      const mockRows = trashedTasks.map(task => ({
        ...task,
        trashedAt: task.trashedAt?.toISOString(),
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        usage: JSON.stringify(task.usage),
        context: JSON.stringify(task.context),
        metadata: JSON.stringify(task.metadata),
      }));

      mockListTrashedStmt.all.mockReturnValue(mockRows);

      const result = await store.listTrashed();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('task1');
      expect(result[1].id).toBe('task2');
      expect(result[0].trashedAt).toBeInstanceOf(Date);
      expect(result[1].trashedAt).toBeInstanceOf(Date);
    });

    it('should return empty array when no trashed tasks', async () => {
      mockListTrashedStmt.all.mockReturnValue([]);

      const result = await store.listTrashed();

      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      mockListTrashedStmt.all.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(store.listTrashed()).rejects.toThrow('Database error');
    });

    it('should properly deserialize task data', async () => {
      const trashedTask = createMockTask({
        trashedAt: new Date(),
        usage: { inputTokens: 200, outputTokens: 100, estimatedCost: 0.05 },
        context: { key: 'value' },
        metadata: { source: 'test' },
      });

      const mockRow = {
        ...trashedTask,
        trashedAt: trashedTask.trashedAt?.toISOString(),
        createdAt: trashedTask.createdAt.toISOString(),
        updatedAt: trashedTask.updatedAt.toISOString(),
        usage: JSON.stringify(trashedTask.usage),
        context: JSON.stringify(trashedTask.context),
        metadata: JSON.stringify(trashedTask.metadata),
      };

      mockListTrashedStmt.all.mockReturnValue([mockRow]);

      const result = await store.listTrashed();

      expect(result[0].usage.inputTokens).toBe(200);
      expect(result[0].context.key).toBe('value');
      expect(result[0].metadata.source).toBe('test');
    });
  });

  describe('emptyTrash', () => {
    it('should delete all trashed tasks and related data', async () => {
      const trashedTasks = [
        { id: 'task1' },
        { id: 'task2' },
        { id: 'task3' },
      ];

      mockListTrashedStmt.all.mockReturnValue(trashedTasks);
      mockDeleteStmt.run.mockReturnValue({ changes: 1 });

      const result = await store.emptyTrash();

      expect(result).toBe(3);
      expect(mockDeleteStmt.run).toHaveBeenCalledTimes(9); // 3 tasks × 3 tables (logs, results, tasks)
    });

    it('should return 0 when no trashed tasks', async () => {
      mockListTrashedStmt.all.mockReturnValue([]);

      const result = await store.emptyTrash();

      expect(result).toBe(0);
      expect(mockDeleteStmt.run).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const trashedTasks = [{ id: 'task1' }];
      mockListTrashedStmt.all.mockReturnValue(trashedTasks);
      mockDeleteStmt.run.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(store.emptyTrash()).rejects.toThrow('Database error');
    });

    it('should delete from multiple tables', async () => {
      const trashedTasks = [{ id: 'task1' }];
      mockListTrashedStmt.all.mockReturnValue(trashedTasks);
      mockDeleteStmt.run.mockReturnValue({ changes: 1 });

      await store.emptyTrash();

      // Should delete from task_logs, task_results, and tasks tables
      expect(mockDb.prepare).toHaveBeenCalledWith('DELETE FROM task_logs WHERE taskId = ?');
      expect(mockDb.prepare).toHaveBeenCalledWith('DELETE FROM task_results WHERE taskId = ?');
      expect(mockDb.prepare).toHaveBeenCalledWith('DELETE FROM tasks WHERE id = ?');
    });

    it('should count deletions correctly even if some fail', async () => {
      const trashedTasks = [
        { id: 'task1' },
        { id: 'task2' },
      ];

      mockListTrashedStmt.all.mockReturnValue(trashedTasks);

      // Mock deletions where first task succeeds, second fails on task delete
      let callCount = 0;
      mockDeleteStmt.run.mockImplementation(() => {
        callCount++;
        if (callCount === 6) { // Last delete of second task fails
          return { changes: 0 };
        }
        return { changes: 1 };
      });

      const result = await store.emptyTrash();

      expect(result).toBe(1); // Only one task fully deleted
    });
  });

  describe('getTrashedTasks (alias test)', () => {
    it('should call listTrashed when getTrashedTasks is called', async () => {
      // Since listTrashed is the main implementation and getTrashedTasks is an alias
      // we need to test both work the same way
      const trashedTask = createMockTask({
        trashedAt: new Date(),
        status: 'cancelled' as TaskStatus,
      });

      const mockRow = {
        ...trashedTask,
        trashedAt: trashedTask.trashedAt?.toISOString(),
        createdAt: trashedTask.createdAt.toISOString(),
        updatedAt: trashedTask.updatedAt.toISOString(),
        usage: JSON.stringify(trashedTask.usage),
        context: JSON.stringify(trashedTask.context),
        metadata: JSON.stringify(trashedTask.metadata),
      };

      mockListTrashedStmt.all.mockReturnValue([mockRow]);

      // Test both methods return the same result
      const listTrashedResult = await store.listTrashed();
      const getTrashedResult = await store.getTrashedTasks();

      expect(listTrashedResult).toEqual(getTrashedResult);
      expect(listTrashedResult[0].trashedAt).toBeInstanceOf(Date);
    });
  });

  describe('moveToTrash (alias test)', () => {
    it('should call trashTask when moveToTrash is called', async () => {
      mockUpdateStmt.run.mockReturnValue({ changes: 1 });

      await store.moveToTrash('test-task');

      expect(mockUpdateStmt.run).toHaveBeenCalledWith({
        trashedAt: expect.any(Date),
        status: 'cancelled',
        updatedAt: expect.any(Date),
        id: 'test-task',
      });
    });
  });

  describe('Edge Cases and Data Integrity', () => {
    it('should handle invalid JSON in task data gracefully', async () => {
      const mockRow = {
        id: 'test-task',
        description: 'Test task',
        status: 'cancelled',
        workflow: 'test',
        agent: 'test',
        priority: 'medium',
        trashedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        archivedAt: null,
        usage: 'invalid-json',
        context: '{"valid": "json"}',
        metadata: 'also-invalid',
        result: null,
        error: null,
      };

      mockListTrashedStmt.all.mockReturnValue([mockRow]);

      const result = await store.listTrashed();

      // Should handle invalid JSON by using defaults
      expect(result[0].usage).toEqual({ inputTokens: 0, outputTokens: 0, estimatedCost: 0 });
      expect(result[0].context).toEqual({ valid: 'json' });
      expect(result[0].metadata).toEqual({});
    });

    it('should handle null dates properly', async () => {
      const mockRow = {
        id: 'test-task',
        description: 'Test task',
        status: 'cancelled',
        workflow: 'test',
        agent: 'test',
        priority: 'medium',
        trashedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        archivedAt: null,
        usage: '{}',
        context: '{}',
        metadata: '{}',
        result: null,
        error: null,
      };

      mockListTrashedStmt.all.mockReturnValue([mockRow]);

      const result = await store.listTrashed();

      expect(result[0].archivedAt).toBeNull();
      expect(result[0].trashedAt).toBeInstanceOf(Date);
    });

    it('should handle very large task descriptions', async () => {
      const longDescription = 'A'.repeat(10000);
      const task = createMockTask({ description: longDescription });

      mockUpdateStmt.run.mockReturnValue({ changes: 1 });

      await store.trashTask(task.id);

      expect(mockUpdateStmt.run).toHaveBeenCalled();
    });

    it('should handle special characters in task IDs', async () => {
      const specialId = 'task-with-special-chars-éñ中文';
      mockUpdateStmt.run.mockReturnValue({ changes: 1 });

      await store.trashTask(specialId);

      expect(mockUpdateStmt.run).toHaveBeenCalledWith({
        trashedAt: expect.any(Date),
        status: 'cancelled',
        updatedAt: expect.any(Date),
        id: specialId,
      });
    });
  });
});