/**
 * Unit tests for trash management in ApexOrchestrator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index.js';
import { TaskStore } from '../store.js';
import { Task, TaskStatus } from '@apexcli/core';

// Mock TaskStore
vi.mock('../store.js', () => {
  const mockTaskStore = {
    getTask: vi.fn(),
    trashTask: vi.fn(),
    restoreTask: vi.fn(),
    listTrashed: vi.fn(),
    emptyTrash: vi.fn(),
    ensureInitialized: vi.fn().mockResolvedValue(undefined),
  };

  return {
    TaskStore: vi.fn(() => mockTaskStore),
  };
});

// Mock Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  AgentSDK: vi.fn(() => ({
    query: vi.fn(),
  })),
}));

// Mock fs
vi.mock('fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock yaml
vi.mock('yaml', () => ({
  parse: vi.fn().mockReturnValue({}),
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

describe('ApexOrchestrator Trash Operations', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Create orchestrator instance
    orchestrator = new ApexOrchestrator({
      projectPath: '/test/path',
      apiKey: 'test-key',
    });

    // Get reference to mocked store
    mockStore = (orchestrator as any).store;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('trashTask', () => {
    it('should trash a task successfully', async () => {
      const task = createMockTask();
      mockStore.getTask.mockResolvedValue(task);
      mockStore.trashTask.mockResolvedValue(undefined);

      await orchestrator.trashTask(task.id);

      expect(mockStore.getTask).toHaveBeenCalledWith(task.id);
      expect(mockStore.trashTask).toHaveBeenCalledWith(task.id);
    });

    it('should throw error if task not found', async () => {
      mockStore.getTask.mockResolvedValue(null);

      await expect(orchestrator.trashTask('nonexistent')).rejects.toThrow(
        'Task with ID nonexistent not found'
      );

      expect(mockStore.trashTask).not.toHaveBeenCalled();
    });

    it('should throw error if task is already trashed', async () => {
      const trashedTask = createMockTask({
        trashedAt: new Date(),
        status: 'cancelled' as TaskStatus,
      });
      mockStore.getTask.mockResolvedValue(trashedTask);

      await expect(orchestrator.trashTask(trashedTask.id)).rejects.toThrow(
        'Task is already in trash'
      );

      expect(mockStore.trashTask).not.toHaveBeenCalled();
    });

    it('should emit task updated event after trashing', async () => {
      const task = createMockTask();
      const trashedTask = createMockTask({
        trashedAt: new Date(),
        status: 'cancelled' as TaskStatus,
      });

      mockStore.getTask.mockResolvedValueOnce(task);
      mockStore.trashTask.mockResolvedValue(undefined);
      mockStore.getTask.mockResolvedValueOnce(trashedTask);

      const eventSpy = vi.fn();
      orchestrator.on('taskUpdated', eventSpy);

      await orchestrator.trashTask(task.id);

      expect(eventSpy).toHaveBeenCalledWith(trashedTask);
    });

    it('should handle store errors gracefully', async () => {
      const task = createMockTask();
      mockStore.getTask.mockResolvedValue(task);
      mockStore.trashTask.mockRejectedValue(new Error('Database error'));

      await expect(orchestrator.trashTask(task.id)).rejects.toThrow('Database error');
    });
  });

  describe('restoreTask', () => {
    it('should restore a task successfully', async () => {
      const trashedTask = createMockTask({
        trashedAt: new Date(),
        status: 'cancelled' as TaskStatus,
      });
      const restoredTask = createMockTask({ status: 'pending' as TaskStatus });

      mockStore.getTask.mockResolvedValueOnce(trashedTask);
      mockStore.restoreTask.mockResolvedValue(undefined);
      mockStore.getTask.mockResolvedValueOnce(restoredTask);

      await orchestrator.restoreTask(trashedTask.id);

      expect(mockStore.getTask).toHaveBeenCalledWith(trashedTask.id);
      expect(mockStore.restoreTask).toHaveBeenCalledWith(trashedTask.id);
    });

    it('should throw error if task not found', async () => {
      mockStore.getTask.mockResolvedValue(null);

      await expect(orchestrator.restoreTask('nonexistent')).rejects.toThrow(
        'Task with ID nonexistent not found'
      );

      expect(mockStore.restoreTask).not.toHaveBeenCalled();
    });

    it('should throw error if task is not in trash', async () => {
      const task = createMockTask(); // Not trashed
      mockStore.getTask.mockResolvedValue(task);

      await expect(orchestrator.restoreTask(task.id)).rejects.toThrow(
        'Task is not in trash'
      );

      expect(mockStore.restoreTask).not.toHaveBeenCalled();
    });

    it('should emit task updated event after restoration', async () => {
      const trashedTask = createMockTask({
        trashedAt: new Date(),
        status: 'cancelled' as TaskStatus,
      });
      const restoredTask = createMockTask({ status: 'pending' as TaskStatus });

      mockStore.getTask.mockResolvedValueOnce(trashedTask);
      mockStore.restoreTask.mockResolvedValue(undefined);
      mockStore.getTask.mockResolvedValueOnce(restoredTask);

      const eventSpy = vi.fn();
      orchestrator.on('taskUpdated', eventSpy);

      await orchestrator.restoreTask(trashedTask.id);

      expect(eventSpy).toHaveBeenCalledWith(restoredTask);
    });

    it('should handle store errors gracefully', async () => {
      const trashedTask = createMockTask({
        trashedAt: new Date(),
        status: 'cancelled' as TaskStatus,
      });
      mockStore.getTask.mockResolvedValue(trashedTask);
      mockStore.restoreTask.mockRejectedValue(new Error('Database error'));

      await expect(orchestrator.restoreTask(trashedTask.id)).rejects.toThrow('Database error');
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

      mockStore.listTrashed.mockResolvedValue(trashedTasks);

      const result = await orchestrator.listTrashed();

      expect(result).toEqual(trashedTasks);
      expect(mockStore.listTrashed).toHaveBeenCalled();
    });

    it('should return empty array when no trashed tasks', async () => {
      mockStore.listTrashed.mockResolvedValue([]);

      const result = await orchestrator.listTrashed();

      expect(result).toEqual([]);
    });

    it('should handle store errors gracefully', async () => {
      mockStore.listTrashed.mockRejectedValue(new Error('Database error'));

      await expect(orchestrator.listTrashed()).rejects.toThrow('Database error');
    });
  });

  describe('listTrashedTasks', () => {
    it('should return list of trashed tasks (alias for listTrashed)', async () => {
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

      mockStore.listTrashed.mockResolvedValue(trashedTasks);

      const result = await orchestrator.listTrashedTasks();

      expect(result).toEqual(trashedTasks);
      expect(mockStore.listTrashed).toHaveBeenCalled();
    });

    it('should return empty array when no trashed tasks', async () => {
      mockStore.listTrashed.mockResolvedValue([]);

      const result = await orchestrator.listTrashedTasks();

      expect(result).toEqual([]);
    });
  });

  describe('emptyTrash', () => {
    it('should empty trash and return count of deleted tasks', async () => {
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

      mockStore.listTrashed.mockResolvedValue(trashedTasks);
      mockStore.emptyTrash.mockResolvedValue(2);

      const eventSpy = vi.fn();
      orchestrator.on('trash:emptied', eventSpy);

      const result = await orchestrator.emptyTrash();

      expect(result).toBe(2);
      expect(mockStore.listTrashed).toHaveBeenCalled();
      expect(mockStore.emptyTrash).toHaveBeenCalled();
      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith(2, ['task1', 'task2']);
    });

    it('should return 0 when trash is already empty', async () => {
      mockStore.listTrashed.mockResolvedValue([]);

      const result = await orchestrator.emptyTrash();

      expect(result).toBe(0);
      expect(mockStore.emptyTrash).not.toHaveBeenCalled();
    });

    it('should emit trash:emptied event with count and task IDs', async () => {
      const trashedTasks = [
        createMockTask({ id: 'task1', trashedAt: new Date() }),
        createMockTask({ id: 'task2', trashedAt: new Date() }),
        createMockTask({ id: 'task3', trashedAt: new Date() }),
      ];

      mockStore.listTrashed.mockResolvedValue(trashedTasks);
      mockStore.emptyTrash.mockResolvedValue(3);

      const eventSpy = vi.fn();
      orchestrator.on('trash:emptied', eventSpy);

      await orchestrator.emptyTrash();

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith(3, ['task1', 'task2', 'task3']);
    });

    it('should handle store errors gracefully', async () => {
      const trashedTasks = [createMockTask({ trashedAt: new Date() })];
      mockStore.listTrashed.mockResolvedValue(trashedTasks);
      mockStore.emptyTrash.mockRejectedValue(new Error('Database error'));

      await expect(orchestrator.emptyTrash()).rejects.toThrow('Database error');
    });

    it('should handle partial deletion scenarios', async () => {
      const trashedTasks = [
        createMockTask({ id: 'task1', trashedAt: new Date() }),
        createMockTask({ id: 'task2', trashedAt: new Date() }),
      ];

      mockStore.listTrashed.mockResolvedValue(trashedTasks);
      mockStore.emptyTrash.mockResolvedValue(1); // Only 1 deleted instead of 2

      const eventSpy = vi.fn();
      orchestrator.on('trash:emptied', eventSpy);

      const result = await orchestrator.emptyTrash();

      expect(result).toBe(1);
      // Should emit event with actual deleted count and original task IDs
      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith(1, ['task1', 'task2']);
    });
  });

  describe('Initialization Handling', () => {
    it('should ensure initialization before operations', async () => {
      const task = createMockTask();
      mockStore.getTask.mockResolvedValue(task);
      mockStore.trashTask.mockResolvedValue(undefined);

      await orchestrator.trashTask(task.id);

      expect(mockStore.ensureInitialized).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockStore.ensureInitialized.mockRejectedValue(new Error('Init failed'));

      await expect(orchestrator.trashTask('task1')).rejects.toThrow('Init failed');
    });
  });

  describe('Event Emission Edge Cases', () => {
    it('should not emit events if task retrieval fails after trashing', async () => {
      const task = createMockTask();

      mockStore.getTask.mockResolvedValueOnce(task);
      mockStore.trashTask.mockResolvedValue(undefined);
      mockStore.getTask.mockRejectedValueOnce(new Error('Task retrieval failed'));

      const eventSpy = vi.fn();
      orchestrator.on('taskUpdated', eventSpy);

      // Should not throw even if event emission fails
      await orchestrator.trashTask(task.id);

      expect(eventSpy).not.toHaveBeenCalled();
    });

    it('should not emit events if task retrieval fails after restoring', async () => {
      const trashedTask = createMockTask({
        trashedAt: new Date(),
        status: 'cancelled' as TaskStatus,
      });

      mockStore.getTask.mockResolvedValueOnce(trashedTask);
      mockStore.restoreTask.mockResolvedValue(undefined);
      mockStore.getTask.mockRejectedValueOnce(new Error('Task retrieval failed'));

      const eventSpy = vi.fn();
      orchestrator.on('taskUpdated', eventSpy);

      // Should not throw even if event emission fails
      await orchestrator.restoreTask(trashedTask.id);

      expect(eventSpy).not.toHaveBeenCalled();
    });
  });
});