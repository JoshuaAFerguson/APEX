import { beforeEach, afterEach, describe, it, expect, vi, type Mock } from 'vitest';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import type { IdleTask, IdleTaskType, TaskPriority } from '@apexcli/core';

vi.mock('./store');

describe('ApexOrchestrator - listIdleTasks', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: vi.Mocked<TaskStore>;

  const sampleIdleTasks: IdleTask[] = [
    {
      id: 'idle-task-1',
      type: 'maintenance' as IdleTaskType,
      title: 'Update dependencies',
      description: 'Update project dependencies to latest versions',
      priority: 'normal' as TaskPriority,
      estimatedEffort: 'medium',
      rationale: 'Keeping dependencies up to date improves security and performance',
      implemented: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      metadata: {}
    },
    {
      id: 'idle-task-2',
      type: 'docs' as IdleTaskType,
      title: 'Add API documentation',
      description: 'Document REST API endpoints',
      priority: 'high' as TaskPriority,
      estimatedEffort: 'large',
      rationale: 'Missing API documentation affects developer onboarding',
      implemented: false,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
      metadata: {}
    },
    {
      id: 'idle-task-3',
      type: 'tests' as IdleTaskType,
      title: 'Add unit tests',
      description: 'Increase test coverage',
      priority: 'low' as TaskPriority,
      estimatedEffort: 'small',
      rationale: 'Low test coverage makes refactoring risky',
      implemented: true,
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-03'),
      metadata: {}
    }
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock the TaskStore constructor to return our mock instance
    mockStore = {
      listIdleTasks: vi.fn(),
      createIdleTask: vi.fn(),
      updateIdleTask: vi.fn(),
      deleteIdleTask: vi.fn(),
    } as any;

    (TaskStore as any).mockImplementation(() => mockStore);

    orchestrator = new ApexOrchestrator('/test/path');
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await orchestrator?.shutdown?.();
  });

  describe('when orchestrator is initialized', () => {
    it('should list all idle tasks when no filters provided', async () => {
      mockStore.listIdleTasks.mockResolvedValue(sampleIdleTasks);

      const result = await orchestrator.listIdleTasks();

      expect(mockStore.listIdleTasks).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(sampleIdleTasks);
      expect(result).toHaveLength(3);
    });

    it('should filter by implemented status', async () => {
      const unimplementedTasks = sampleIdleTasks.filter(t => !t.implemented);
      mockStore.listIdleTasks.mockResolvedValue(unimplementedTasks);

      const result = await orchestrator.listIdleTasks({ implemented: false });

      expect(mockStore.listIdleTasks).toHaveBeenCalledWith({ implemented: false });
      expect(result).toEqual(unimplementedTasks);
      expect(result).toHaveLength(2);
      expect(result.every(task => !task.implemented)).toBe(true);
    });

    it('should filter by type', async () => {
      const maintenanceTasks = sampleIdleTasks.filter(t => t.type === 'maintenance');
      mockStore.listIdleTasks.mockResolvedValue(maintenanceTasks);

      const result = await orchestrator.listIdleTasks({ type: 'maintenance' });

      expect(mockStore.listIdleTasks).toHaveBeenCalledWith({ type: 'maintenance' });
      expect(result).toEqual(maintenanceTasks);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('maintenance');
    });

    it('should filter by priority', async () => {
      const highPriorityTasks = sampleIdleTasks.filter(t => t.priority === 'high');
      mockStore.listIdleTasks.mockResolvedValue(highPriorityTasks);

      const result = await orchestrator.listIdleTasks({ priority: 'high' });

      expect(mockStore.listIdleTasks).toHaveBeenCalledWith({ priority: 'high' });
      expect(result).toEqual(highPriorityTasks);
      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe('high');
    });

    it('should limit number of results', async () => {
      const limitedTasks = sampleIdleTasks.slice(0, 2);
      mockStore.listIdleTasks.mockResolvedValue(limitedTasks);

      const result = await orchestrator.listIdleTasks({ limit: 2 });

      expect(mockStore.listIdleTasks).toHaveBeenCalledWith({ limit: 2 });
      expect(result).toEqual(limitedTasks);
      expect(result).toHaveLength(2);
    });

    it('should handle multiple filters combined', async () => {
      const filteredTasks = sampleIdleTasks.filter(
        t => t.type === 'docs' && !t.implemented && t.priority === 'high'
      );
      mockStore.listIdleTasks.mockResolvedValue(filteredTasks);

      const result = await orchestrator.listIdleTasks({
        type: 'docs',
        implemented: false,
        priority: 'high',
        limit: 10
      });

      expect(mockStore.listIdleTasks).toHaveBeenCalledWith({
        type: 'docs',
        implemented: false,
        priority: 'high',
        limit: 10
      });
      expect(result).toEqual(filteredTasks);
    });

    it('should return empty array when no tasks match filters', async () => {
      mockStore.listIdleTasks.mockResolvedValue([]);

      const result = await orchestrator.listIdleTasks({ priority: 'urgent' });

      expect(mockStore.listIdleTasks).toHaveBeenCalledWith({ priority: 'urgent' });
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle store errors gracefully', async () => {
      const storeError = new Error('Database connection failed');
      mockStore.listIdleTasks.mockRejectedValue(storeError);

      await expect(orchestrator.listIdleTasks()).rejects.toThrow('Database connection failed');
      expect(mockStore.listIdleTasks).toHaveBeenCalledWith(undefined);
    });
  });

  describe('when orchestrator is not initialized', () => {
    it('should throw error when not initialized', async () => {
      const uninitializedOrchestrator = new ApexOrchestrator('/test/path');

      await expect(uninitializedOrchestrator.listIdleTasks()).rejects.toThrow(
        'Orchestrator must be initialized first'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle undefined options parameter', async () => {
      mockStore.listIdleTasks.mockResolvedValue(sampleIdleTasks);

      const result = await orchestrator.listIdleTasks(undefined);

      expect(mockStore.listIdleTasks).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(sampleIdleTasks);
    });

    it('should handle empty options object', async () => {
      mockStore.listIdleTasks.mockResolvedValue(sampleIdleTasks);

      const result = await orchestrator.listIdleTasks({});

      expect(mockStore.listIdleTasks).toHaveBeenCalledWith({});
      expect(result).toEqual(sampleIdleTasks);
    });

    it('should handle zero limit', async () => {
      mockStore.listIdleTasks.mockResolvedValue([]);

      const result = await orchestrator.listIdleTasks({ limit: 0 });

      expect(mockStore.listIdleTasks).toHaveBeenCalledWith({ limit: 0 });
      expect(result).toEqual([]);
    });

    it('should preserve task data structure', async () => {
      const taskWithAllFields = {
        ...sampleIdleTasks[0],
        metadata: {
          sourceFile: 'package.json',
          analysisDate: '2024-01-01T00:00:00.000Z'
        }
      };
      mockStore.listIdleTasks.mockResolvedValue([taskWithAllFields]);

      const result = await orchestrator.listIdleTasks();

      expect(result[0]).toEqual(taskWithAllFields);
      expect(result[0].metadata).toEqual({
        sourceFile: 'package.json',
        analysisDate: '2024-01-01T00:00:00.000Z'
      });
    });
  });
});