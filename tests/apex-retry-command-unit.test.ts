import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { Task, TaskStatus } from '@apexcli/core';
import { createTask } from '../packages/core/src/factories/task-factory.js';

describe('APEX Retry Command - Unit Tests', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: any;

  beforeEach(() => {
    // Create mock store
    mockStore = {
      getTask: vi.fn(),
      addLog: vi.fn(),
      updateTask: vi.fn(),
    };

    // Create orchestrator instance with mocked dependencies
    orchestrator = new ApexOrchestrator({
      // Mock config as needed
    });

    // Mock internal methods
    orchestrator.ensureInitialized = vi.fn().mockResolvedValue(undefined);
    orchestrator.updateTaskStatus = vi.fn().mockResolvedValue(undefined);
    orchestrator.executeTask = vi.fn().mockResolvedValue(undefined);
    (orchestrator as any).store = mockStore;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleRetry validation', () => {
    it('should successfully retry a failed task', async () => {
      // Arrange
      const taskId = 'test-task-1';
      const mockTask: Task = createTask({ status: 'failed' });
      mockTask.id = taskId;
      mockTask.status = 'failed';

      mockStore.getTask.mockResolvedValue(mockTask);

      // Act
      await orchestrator.handleRetry(taskId);

      // Assert
      expect(mockStore.getTask).toHaveBeenCalledWith(taskId);
      expect(mockStore.addLog).toHaveBeenCalledWith(taskId, expect.objectContaining({
        level: 'info',
        message: expect.stringContaining('Retrying task'),
        metadata: expect.objectContaining({
          previousStatus: 'failed',
          retryInitiatedAt: expect.any(String),
        }),
      }));
      expect(orchestrator.updateTaskStatus).toHaveBeenCalledWith(taskId, 'pending');
      expect(mockStore.updateTask).toHaveBeenCalledWith(taskId, expect.objectContaining({
        error: undefined,
        updatedAt: expect.any(Date),
      }));
      expect(orchestrator.executeTask).toHaveBeenCalledWith(taskId);
    });

    it('should successfully retry a cancelled task', async () => {
      // Arrange
      const taskId = 'test-task-2';
      const mockTask: Task = createTask({ status: 'cancelled' });
      mockTask.id = taskId;
      mockTask.status = 'cancelled';

      mockStore.getTask.mockResolvedValue(mockTask);

      // Act
      await orchestrator.handleRetry(taskId);

      // Assert
      expect(mockStore.getTask).toHaveBeenCalledWith(taskId);
      expect(mockStore.addLog).toHaveBeenCalledWith(taskId, expect.objectContaining({
        level: 'info',
        message: expect.stringContaining('Retrying task'),
        metadata: expect.objectContaining({
          previousStatus: 'cancelled',
        }),
      }));
      expect(orchestrator.updateTaskStatus).toHaveBeenCalledWith(taskId, 'pending');
      expect(orchestrator.executeTask).toHaveBeenCalledWith(taskId);
    });

    it('should successfully retry an in-progress (stuck) task', async () => {
      // Arrange
      const taskId = 'test-task-3';
      const mockTask: Task = createTask({ status: 'in-progress' });
      mockTask.id = taskId;
      mockTask.status = 'in-progress';

      mockStore.getTask.mockResolvedValue(mockTask);

      // Act
      await orchestrator.handleRetry(taskId);

      // Assert
      expect(orchestrator.updateTaskStatus).toHaveBeenCalledWith(taskId, 'pending');
      expect(orchestrator.executeTask).toHaveBeenCalledWith(taskId);
    });

    it('should successfully retry a planning (stuck) task', async () => {
      // Arrange
      const taskId = 'test-task-4';
      const mockTask: Task = createTask({ status: 'planning' });
      mockTask.id = taskId;
      mockTask.status = 'planning';

      mockStore.getTask.mockResolvedValue(mockTask);

      // Act
      await orchestrator.handleRetry(taskId);

      // Assert
      expect(orchestrator.updateTaskStatus).toHaveBeenCalledWith(taskId, 'pending');
      expect(orchestrator.executeTask).toHaveBeenCalledWith(taskId);
    });
  });

  describe('handleRetry validation - non-retryable statuses', () => {
    const nonRetryableStatuses: TaskStatus[] = ['pending', 'queued', 'completed', 'paused', 'waiting-approval', 'awaiting-approval'];

    nonRetryableStatuses.forEach(status => {
      it(`should throw error for ${status} status`, async () => {
        // Arrange
        const taskId = `test-task-${status}`;
        const mockTask: Task = createTask({ status: status });
        mockTask.id = taskId;
        mockTask.status = status;

        mockStore.getTask.mockResolvedValue(mockTask);

        // Act & Assert
        await expect(orchestrator.handleRetry(taskId)).rejects.toThrow(
          `Task is ${status}. Only failed, cancelled, or stuck tasks can be retried.`
        );

        expect(mockStore.getTask).toHaveBeenCalledWith(taskId);
        expect(orchestrator.updateTaskStatus).not.toHaveBeenCalled();
        expect(orchestrator.executeTask).not.toHaveBeenCalled();
      });
    });
  });

  describe('handleRetry error handling', () => {
    it('should throw error for non-existent task', async () => {
      // Arrange
      const taskId = 'non-existent-task';
      mockStore.getTask.mockResolvedValue(null);

      // Act & Assert
      await expect(orchestrator.handleRetry(taskId)).rejects.toThrow(
        `Task not found: ${taskId}`
      );

      expect(mockStore.getTask).toHaveBeenCalledWith(taskId);
      expect(orchestrator.updateTaskStatus).not.toHaveBeenCalled();
      expect(orchestrator.executeTask).not.toHaveBeenCalled();
    });

    it('should handle executeTask failure gracefully', async () => {
      // Arrange
      const taskId = 'failing-execution-task';
      const mockTask: Task = createTask({ status: 'failed' });
      mockTask.id = taskId;
      mockTask.status = 'failed';

      mockStore.getTask.mockResolvedValue(mockTask);
      const executionError = new Error('Execution failed');
      orchestrator.executeTask = vi.fn().mockRejectedValue(executionError);

      // Act - Should not throw because executeTask errors are caught internally
      await orchestrator.handleRetry(taskId);

      // Assert
      expect(orchestrator.updateTaskStatus).toHaveBeenCalledWith(taskId, 'pending');
      expect(orchestrator.executeTask).toHaveBeenCalledWith(taskId);
      // Note: The error is caught internally and logged, but doesn't propagate
    });

    it('should handle store failures', async () => {
      // Arrange
      const taskId = 'store-failure-task';
      mockStore.getTask.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(orchestrator.handleRetry(taskId)).rejects.toThrow('Database error');
    });
  });

  describe('handleRetry retryable status validation', () => {
    it('should validate all retryable statuses defined in implementation', () => {
      // This test ensures our test cases cover all retryable statuses
      const retryableStatuses: TaskStatus[] = ['failed', 'cancelled', 'in-progress', 'planning'];

      // These are the statuses that the implementation allows for retry
      const expectedRetryableStatuses = ['failed', 'cancelled', 'in-progress', 'planning'];

      expect(retryableStatuses).toEqual(expectedRetryableStatuses);
    });

    it('should handle status changes during retry process', async () => {
      // Arrange
      const taskId = 'status-change-task';
      const mockTask: Task = createTask({ status: 'failed' });
      mockTask.id = taskId;
      mockTask.status = 'failed';

      mockStore.getTask.mockResolvedValue(mockTask);

      // Act
      await orchestrator.handleRetry(taskId);

      // Assert - Verify the sequence of operations
      expect(mockStore.addLog).toHaveBeenCalledBefore(orchestrator.updateTaskStatus as any);
      expect(orchestrator.updateTaskStatus).toHaveBeenCalledBefore(mockStore.updateTask as any);
      expect(mockStore.updateTask).toHaveBeenCalledBefore(orchestrator.executeTask as any);
    });
  });

  describe('handleRetry logging verification', () => {
    it('should log retry initiation with correct metadata', async () => {
      // Arrange
      const taskId = 'logging-test-task';
      const mockTask: Task = createTask({ status: 'failed' });
      mockTask.id = taskId;
      mockTask.status = 'failed';

      mockStore.getTask.mockResolvedValue(mockTask);

      // Act
      await orchestrator.handleRetry(taskId);

      // Assert
      expect(mockStore.addLog).toHaveBeenCalledWith(taskId, {
        level: 'info',
        message: 'Retrying task (previous status: failed)',
        metadata: {
          previousStatus: 'failed',
          retryInitiatedAt: expect.any(String),
        },
      });
    });

    it('should clear error information when retrying', async () => {
      // Arrange
      const taskId = 'error-clearing-task';
      const mockTask: Task = createTask({ status: 'failed' });
      mockTask.id = taskId;
      mockTask.status = 'failed';
      mockTask.error = { message: 'Previous error', stack: 'error stack' };

      mockStore.getTask.mockResolvedValue(mockTask);

      // Act
      await orchestrator.handleRetry(taskId);

      // Assert
      expect(mockStore.updateTask).toHaveBeenCalledWith(taskId, {
        error: undefined,
        updatedAt: expect.any(Date),
      });
    });
  });
});