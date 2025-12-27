/**
 * Unit tests for ApexOrchestrator trash operations
 * Tests the trashTask, restoreTask, listTrashedTasks, and emptyTrash methods
 * Including validation, event emission, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from './index.js';
import { Task, TaskStatus } from '@apexcli/core';

// Mock TaskStore
vi.mock('./store.js', () => {
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

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, callback) => {
    const cb = callback as (error: Error | null, result?: { stdout: string }) => void;
    cb(null, { stdout: '' });
  }),
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
  completedAt: null,
  trashedAt: null,
  archivedAt: null,
  usage: {
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    estimatedCost: 0.01,
  },
  context: {},
  result: null,
  error: null,
  metadata: {},
  logs: [],
  artifacts: [],
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
    describe('successful operations', () => {
      it('should trash a task successfully and emit event', async () => {
        const task = createMockTask();
        const trashedTask = createMockTask({
          trashedAt: new Date(),
          status: 'cancelled' as TaskStatus,
        });

        mockStore.getTask.mockResolvedValueOnce(task);
        mockStore.trashTask.mockResolvedValue(undefined);
        mockStore.getTask.mockResolvedValueOnce(trashedTask);

        const eventSpy = vi.fn();
        orchestrator.on('task:trashed', eventSpy);

        await orchestrator.trashTask(task.id);

        expect(mockStore.getTask).toHaveBeenCalledTimes(2);
        expect(mockStore.getTask).toHaveBeenCalledWith(task.id);
        expect(mockStore.trashTask).toHaveBeenCalledWith(task.id);
        expect(eventSpy).toHaveBeenCalledWith(trashedTask);
      });

      it('should validate task exists before trashing', async () => {
        const task = createMockTask();
        mockStore.getTask.mockResolvedValue(task);
        mockStore.trashTask.mockResolvedValue(undefined);

        await orchestrator.trashTask(task.id);

        expect(mockStore.getTask).toHaveBeenCalledWith(task.id);
        expect(mockStore.trashTask).toHaveBeenCalledWith(task.id);
      });

      it('should handle task with various statuses', async () => {
        const statuses: TaskStatus[] = ['pending', 'in-progress', 'completed', 'failed'];

        for (const status of statuses) {
          const task = createMockTask({ status });
          const trashedTask = createMockTask({
            status: 'cancelled' as TaskStatus,
            trashedAt: new Date(),
          });

          mockStore.getTask.mockResolvedValueOnce(task);
          mockStore.trashTask.mockResolvedValue(undefined);
          mockStore.getTask.mockResolvedValueOnce(trashedTask);

          await orchestrator.trashTask(task.id);

          expect(mockStore.trashTask).toHaveBeenCalledWith(task.id);
        }
      });
    });

    describe('validation errors', () => {
      it('should throw error when task does not exist', async () => {
        mockStore.getTask.mockResolvedValue(null);

        await expect(orchestrator.trashTask('nonexistent')).rejects.toThrow(
          'Task with ID nonexistent not found'
        );

        expect(mockStore.trashTask).not.toHaveBeenCalled();
      });

      it('should throw error when task is already trashed', async () => {
        const trashedTask = createMockTask({
          trashedAt: new Date(),
          status: 'cancelled' as TaskStatus,
        });
        mockStore.getTask.mockResolvedValue(trashedTask);

        await expect(orchestrator.trashTask(trashedTask.id)).rejects.toThrow(
          'Task with ID test-task-12345678 is already in trash'
        );

        expect(mockStore.trashTask).not.toHaveBeenCalled();
      });

      it('should handle invalid task IDs', async () => {
        const invalidIds = ['', ' ', '\t', '\n'];

        for (const invalidId of invalidIds) {
          mockStore.getTask.mockResolvedValue(null);

          await expect(orchestrator.trashTask(invalidId)).rejects.toThrow();
        }
      });
    });

    describe('event emission', () => {
      it('should emit task:trashed event with correct data', async () => {
        const task = createMockTask();
        const trashedTask = createMockTask({
          trashedAt: new Date(),
          status: 'cancelled' as TaskStatus,
        });

        mockStore.getTask.mockResolvedValueOnce(task);
        mockStore.trashTask.mockResolvedValue(undefined);
        mockStore.getTask.mockResolvedValueOnce(trashedTask);

        const eventSpy = vi.fn();
        orchestrator.on('task:trashed', eventSpy);

        await orchestrator.trashTask(task.id);

        expect(eventSpy).toHaveBeenCalledTimes(1);
        expect(eventSpy).toHaveBeenCalledWith(trashedTask);
      });

      it('should not emit event when task retrieval fails after trashing', async () => {
        const task = createMockTask();
        mockStore.getTask.mockResolvedValueOnce(task);
        mockStore.trashTask.mockResolvedValue(undefined);
        mockStore.getTask.mockResolvedValueOnce(null);

        const eventSpy = vi.fn();
        orchestrator.on('task:trashed', eventSpy);

        await orchestrator.trashTask(task.id);

        expect(eventSpy).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should propagate store errors', async () => {
        const task = createMockTask();
        mockStore.getTask.mockResolvedValue(task);
        mockStore.trashTask.mockRejectedValue(new Error('Store error'));

        await expect(orchestrator.trashTask(task.id)).rejects.toThrow('Store error');
      });

      it('should handle initialization errors', async () => {
        mockStore.ensureInitialized.mockRejectedValue(new Error('Init failed'));

        await expect(orchestrator.trashTask('task-id')).rejects.toThrow('Init failed');
      });
    });
  });

  describe('restoreTask', () => {
    describe('successful operations', () => {
      it('should restore a trashed task successfully and emit event', async () => {
        const trashedTask = createMockTask({
          trashedAt: new Date(),
          status: 'cancelled' as TaskStatus,
        });
        const restoredTask = createMockTask({
          status: 'pending' as TaskStatus,
          trashedAt: null,
        });

        mockStore.getTask.mockResolvedValueOnce(trashedTask);
        mockStore.restoreTask.mockResolvedValue(undefined);
        mockStore.getTask.mockResolvedValueOnce(restoredTask);

        const eventSpy = vi.fn();
        orchestrator.on('task:restored', eventSpy);

        await orchestrator.restoreTask(trashedTask.id);

        expect(mockStore.getTask).toHaveBeenCalledTimes(2);
        expect(mockStore.restoreTask).toHaveBeenCalledWith(trashedTask.id);
        expect(eventSpy).toHaveBeenCalledWith(restoredTask);
      });

      it('should validate task exists and is trashed before restoring', async () => {
        const trashedTask = createMockTask({
          trashedAt: new Date(),
          status: 'cancelled' as TaskStatus,
        });

        mockStore.getTask.mockResolvedValue(trashedTask);
        mockStore.restoreTask.mockResolvedValue(undefined);

        await orchestrator.restoreTask(trashedTask.id);

        expect(mockStore.getTask).toHaveBeenCalledWith(trashedTask.id);
        expect(mockStore.restoreTask).toHaveBeenCalledWith(trashedTask.id);
      });
    });

    describe('validation errors', () => {
      it('should throw error when task does not exist', async () => {
        mockStore.getTask.mockResolvedValue(null);

        await expect(orchestrator.restoreTask('nonexistent')).rejects.toThrow(
          'Task with ID nonexistent not found'
        );

        expect(mockStore.restoreTask).not.toHaveBeenCalled();
      });

      it('should throw error when task is not in trash', async () => {
        const task = createMockTask({ trashedAt: null });
        mockStore.getTask.mockResolvedValue(task);

        await expect(orchestrator.restoreTask(task.id)).rejects.toThrow(
          'Task with ID test-task-12345678 is not in trash'
        );

        expect(mockStore.restoreTask).not.toHaveBeenCalled();
      });

      it('should handle invalid task IDs', async () => {
        const invalidIds = ['', ' ', '\t', '\n'];

        for (const invalidId of invalidIds) {
          mockStore.getTask.mockResolvedValue(null);

          await expect(orchestrator.restoreTask(invalidId)).rejects.toThrow();
        }
      });
    });

    describe('event emission', () => {
      it('should emit task:restored event with correct data', async () => {
        const trashedTask = createMockTask({
          trashedAt: new Date(),
          status: 'cancelled' as TaskStatus,
        });
        const restoredTask = createMockTask({
          status: 'pending' as TaskStatus,
          trashedAt: null,
        });

        mockStore.getTask.mockResolvedValueOnce(trashedTask);
        mockStore.restoreTask.mockResolvedValue(undefined);
        mockStore.getTask.mockResolvedValueOnce(restoredTask);

        const eventSpy = vi.fn();
        orchestrator.on('task:restored', eventSpy);

        await orchestrator.restoreTask(trashedTask.id);

        expect(eventSpy).toHaveBeenCalledTimes(1);
        expect(eventSpy).toHaveBeenCalledWith(restoredTask);
      });

      it('should not emit event when task retrieval fails after restoring', async () => {
        const trashedTask = createMockTask({
          trashedAt: new Date(),
          status: 'cancelled' as TaskStatus,
        });

        mockStore.getTask.mockResolvedValueOnce(trashedTask);
        mockStore.restoreTask.mockResolvedValue(undefined);
        mockStore.getTask.mockResolvedValueOnce(null);

        const eventSpy = vi.fn();
        orchestrator.on('task:restored', eventSpy);

        await orchestrator.restoreTask(trashedTask.id);

        expect(eventSpy).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should propagate store errors', async () => {
        const trashedTask = createMockTask({
          trashedAt: new Date(),
          status: 'cancelled' as TaskStatus,
        });

        mockStore.getTask.mockResolvedValue(trashedTask);
        mockStore.restoreTask.mockRejectedValue(new Error('Store error'));

        await expect(orchestrator.restoreTask(trashedTask.id)).rejects.toThrow('Store error');
      });

      it('should handle initialization errors', async () => {
        mockStore.ensureInitialized.mockRejectedValue(new Error('Init failed'));

        await expect(orchestrator.restoreTask('task-id')).rejects.toThrow('Init failed');
      });
    });
  });

  describe('listTrashedTasks', () => {
    describe('successful operations', () => {
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

        const result = await orchestrator.listTrashedTasks();

        expect(result).toEqual(trashedTasks);
        expect(mockStore.listTrashed).toHaveBeenCalledTimes(1);
      });

      it('should return empty array when no trashed tasks', async () => {
        mockStore.listTrashed.mockResolvedValue([]);

        const result = await orchestrator.listTrashedTasks();

        expect(result).toEqual([]);
        expect(mockStore.listTrashed).toHaveBeenCalledTimes(1);
      });

      it('should delegate to store.listTrashed method', async () => {
        const trashedTasks = [createMockTask({ trashedAt: new Date() })];
        mockStore.listTrashed.mockResolvedValue(trashedTasks);

        await orchestrator.listTrashedTasks();

        expect(mockStore.listTrashed).toHaveBeenCalledTimes(1);
      });
    });

    describe('error handling', () => {
      it('should propagate store errors', async () => {
        mockStore.listTrashed.mockRejectedValue(new Error('Store error'));

        await expect(orchestrator.listTrashedTasks()).rejects.toThrow('Store error');
      });

      it('should handle initialization errors', async () => {
        mockStore.ensureInitialized.mockRejectedValue(new Error('Init failed'));

        await expect(orchestrator.listTrashedTasks()).rejects.toThrow('Init failed');
      });
    });
  });

  describe('emptyTrash', () => {
    describe('successful operations', () => {
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
        expect(mockStore.listTrashed).toHaveBeenCalledTimes(1);
        expect(mockStore.emptyTrash).toHaveBeenCalledTimes(1);
        expect(eventSpy).toHaveBeenCalledWith(2, ['task1', 'task2']);
      });

      it('should return 0 when trash is already empty', async () => {
        mockStore.listTrashed.mockResolvedValue([]);

        const result = await orchestrator.emptyTrash();

        expect(result).toBe(0);
        expect(mockStore.listTrashed).toHaveBeenCalledTimes(1);
        expect(mockStore.emptyTrash).not.toHaveBeenCalled();
      });

      it('should delegate to store methods correctly', async () => {
        const trashedTasks = [createMockTask({ id: 'task1', trashedAt: new Date() })];
        mockStore.listTrashed.mockResolvedValue(trashedTasks);
        mockStore.emptyTrash.mockResolvedValue(1);

        await orchestrator.emptyTrash();

        expect(mockStore.listTrashed).toHaveBeenCalledTimes(1);
        expect(mockStore.emptyTrash).toHaveBeenCalledTimes(1);
      });
    });

    describe('event emission', () => {
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

      it('should not emit event when no tasks to delete', async () => {
        mockStore.listTrashed.mockResolvedValue([]);

        const eventSpy = vi.fn();
        orchestrator.on('trash:emptied', eventSpy);

        await orchestrator.emptyTrash();

        expect(eventSpy).not.toHaveBeenCalled();
      });

      it('should handle partial deletion scenarios correctly', async () => {
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
        // Should emit event with actual deleted count but original task IDs
        expect(eventSpy).toHaveBeenCalledWith(1, ['task1', 'task2']);
      });
    });

    describe('error handling', () => {
      it('should propagate store errors from listTrashed', async () => {
        mockStore.listTrashed.mockRejectedValue(new Error('List error'));

        await expect(orchestrator.emptyTrash()).rejects.toThrow('List error');
      });

      it('should propagate store errors from emptyTrash', async () => {
        const trashedTasks = [createMockTask({ trashedAt: new Date() })];
        mockStore.listTrashed.mockResolvedValue(trashedTasks);
        mockStore.emptyTrash.mockRejectedValue(new Error('Delete error'));

        await expect(orchestrator.emptyTrash()).rejects.toThrow('Delete error');
      });

      it('should handle initialization errors', async () => {
        mockStore.ensureInitialized.mockRejectedValue(new Error('Init failed'));

        await expect(orchestrator.emptyTrash()).rejects.toThrow('Init failed');
      });
    });
  });

  describe('initialization handling', () => {
    it('should ensure initialization before all operations', async () => {
      const task = createMockTask();
      mockStore.getTask.mockResolvedValue(task);
      mockStore.trashTask.mockResolvedValue(undefined);
      mockStore.listTrashed.mockResolvedValue([]);

      await orchestrator.trashTask(task.id);
      await orchestrator.listTrashedTasks();
      await orchestrator.emptyTrash();

      expect(mockStore.ensureInitialized).toHaveBeenCalledTimes(3);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent trash operations', async () => {
      const task1 = createMockTask({ id: 'task1' });
      const task2 = createMockTask({ id: 'task2' });

      mockStore.getTask
        .mockResolvedValueOnce(task1)
        .mockResolvedValueOnce(task2);
      mockStore.trashTask.mockResolvedValue(undefined);

      const promises = [
        orchestrator.trashTask(task1.id),
        orchestrator.trashTask(task2.id),
      ];

      await Promise.all(promises);

      expect(mockStore.trashTask).toHaveBeenCalledTimes(2);
      expect(mockStore.trashTask).toHaveBeenCalledWith(task1.id);
      expect(mockStore.trashTask).toHaveBeenCalledWith(task2.id);
    });

    it('should handle concurrent restore operations', async () => {
      const trashedTask1 = createMockTask({ id: 'task1', trashedAt: new Date() });
      const trashedTask2 = createMockTask({ id: 'task2', trashedAt: new Date() });

      mockStore.getTask
        .mockResolvedValueOnce(trashedTask1)
        .mockResolvedValueOnce(trashedTask2);
      mockStore.restoreTask.mockResolvedValue(undefined);

      const promises = [
        orchestrator.restoreTask(trashedTask1.id),
        orchestrator.restoreTask(trashedTask2.id),
      ];

      await Promise.all(promises);

      expect(mockStore.restoreTask).toHaveBeenCalledTimes(2);
      expect(mockStore.restoreTask).toHaveBeenCalledWith(trashedTask1.id);
      expect(mockStore.restoreTask).toHaveBeenCalledWith(trashedTask2.id);
    });
  });

  describe('edge cases', () => {
    it('should handle tasks with complex metadata', async () => {
      const complexTask = createMockTask({
        metadata: {
          source: 'user',
          tags: ['urgent', 'bug-fix'],
          customField: { nested: { data: true } },
        },
        context: {
          request: 'complex operation',
          environment: 'production',
        },
        logs: [
          { timestamp: new Date(), level: 'info', message: 'Task started' },
        ],
        artifacts: [
          { type: 'file', path: 'output.txt', size: 1024 },
        ],
      });

      const trashedComplexTask = { ...complexTask, trashedAt: new Date(), status: 'cancelled' as TaskStatus };

      mockStore.getTask.mockResolvedValueOnce(complexTask);
      mockStore.trashTask.mockResolvedValue(undefined);
      mockStore.getTask.mockResolvedValueOnce(trashedComplexTask);

      const eventSpy = vi.fn();
      orchestrator.on('task:trashed', eventSpy);

      await orchestrator.trashTask(complexTask.id);

      expect(eventSpy).toHaveBeenCalledWith(trashedComplexTask);
    });

    it('should handle very long task descriptions', async () => {
      const longDescription = 'A'.repeat(10000);
      const taskWithLongDesc = createMockTask({ description: longDescription });

      mockStore.getTask.mockResolvedValue(taskWithLongDesc);
      mockStore.trashTask.mockResolvedValue(undefined);

      await orchestrator.trashTask(taskWithLongDesc.id);

      expect(mockStore.trashTask).toHaveBeenCalledWith(taskWithLongDesc.id);
    });

    it('should handle special characters in task IDs', async () => {
      const specialId = 'task-with-special-chars-éñ中文';
      const taskWithSpecialId = createMockTask({ id: specialId });

      mockStore.getTask.mockResolvedValue(taskWithSpecialId);
      mockStore.trashTask.mockResolvedValue(undefined);

      await orchestrator.trashTask(specialId);

      expect(mockStore.trashTask).toHaveBeenCalledWith(specialId);
    });
  });
});