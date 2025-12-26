import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import { WorkspaceManager } from './workspace-manager';
import type { Task } from '@apexcli/core';

// Mock the WorkspaceManager
vi.mock('./workspace-manager');

describe('ApexOrchestrator.cancelTask() Cleanup', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let mockWorkspaceManager: {
    cleanupWorkspace: MockedFunction<any>;
    createWorkspace: MockedFunction<any>;
  };
  let taskId: string;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_test`,
    description: 'Test task for cancel cleanup',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: testDir,
    branchName: 'apex/test-branch',
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
  });

  beforeEach(async () => {
    // Create test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-cancel-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    // Create mock workspace manager
    mockWorkspaceManager = {
      cleanupWorkspace: vi.fn().mockResolvedValue(undefined),
      createWorkspace: vi.fn().mockResolvedValue(undefined),
    };

    // Mock the WorkspaceManager constructor to return our mock
    (WorkspaceManager as any).mockImplementation(() => mockWorkspaceManager);

    // Create orchestrator instance
    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();

    // Create a test task
    const task = createTestTask();
    taskId = task.id;
    await orchestrator.createTask(task);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('Cleanup on Task Cancellation', () => {
    it('should call workspaceManager.cleanupWorkspace() when cancelling a pending task', async () => {
      // Arrange - Task is already created in pending state
      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('pending');

      // Act - Cancel the task
      const result = await orchestrator.cancelTask(taskId);

      // Assert
      expect(result).toBe(true);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(taskId);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(1);

      // Verify task is marked as cancelled
      const cancelledTask = await orchestrator.getTask(taskId);
      expect(cancelledTask?.status).toBe('cancelled');
    });

    it('should call workspaceManager.cleanupWorkspace() when cancelling an in-progress task', async () => {
      // Arrange - Start the task to put it in in-progress state
      orchestrator['runningTasks'].set(taskId, {
        abortController: new AbortController(),
        startTime: Date.now(),
      });

      await orchestrator['taskStore'].updateTaskStatus(taskId, 'in-progress');

      // Act - Cancel the in-progress task
      const result = await orchestrator.cancelTask(taskId);

      // Assert
      expect(result).toBe(true);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(taskId);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(1);

      // Verify task is marked as cancelled and removed from running tasks
      const cancelledTask = await orchestrator.getTask(taskId);
      expect(cancelledTask?.status).toBe('cancelled');
      expect(orchestrator['runningTasks'].has(taskId)).toBe(false);
    });

    it('should call workspaceManager.cleanupWorkspace() when cancelling a queued task', async () => {
      // Arrange - Queue the task
      await orchestrator.queueTask(taskId);

      // Act - Cancel the queued task
      const result = await orchestrator.cancelTask(taskId);

      // Assert
      expect(result).toBe(true);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(taskId);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(1);

      // Verify task is marked as cancelled
      const cancelledTask = await orchestrator.getTask(taskId);
      expect(cancelledTask?.status).toBe('cancelled');
    });

    it('should handle cleanup errors gracefully and still mark task as cancelled', async () => {
      // Arrange - Make cleanup fail
      const cleanupError = new Error('Cleanup failed');
      mockWorkspaceManager.cleanupWorkspace.mockRejectedValue(cleanupError);

      // Mock console.warn to capture warning messages
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Act - Cancel the task (should not throw despite cleanup failure)
      const result = await orchestrator.cancelTask(taskId);

      // Assert
      expect(result).toBe(true);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(taskId);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Failed to cleanup workspace for cancelled task ${taskId}:`,
        cleanupError
      );

      // Verify task is still marked as cancelled even though cleanup failed
      const cancelledTask = await orchestrator.getTask(taskId);
      expect(cancelledTask?.status).toBe('cancelled');

      consoleWarnSpy.mockRestore();
    });

    it('should return false without cleanup when trying to cancel non-existent task', async () => {
      // Arrange
      const nonExistentTaskId = 'task_nonexistent_123';

      // Act - Try to cancel non-existent task
      const result = await orchestrator.cancelTask(nonExistentTaskId);

      // Assert
      expect(result).toBe(false);
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();
    });

    it('should return false without cleanup when trying to cancel already completed task', async () => {
      // Arrange - Mark task as completed
      await orchestrator['taskStore'].updateTaskStatus(taskId, 'completed');

      // Act - Try to cancel completed task
      const result = await orchestrator.cancelTask(taskId);

      // Assert
      expect(result).toBe(false);
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();

      // Verify task status remains completed
      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('completed');
    });

    it('should return false without cleanup when trying to cancel already failed task', async () => {
      // Arrange - Mark task as failed
      await orchestrator['taskStore'].updateTaskStatus(taskId, 'failed');

      // Act - Try to cancel failed task
      const result = await orchestrator.cancelTask(taskId);

      // Assert
      expect(result).toBe(false);
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();

      // Verify task status remains failed
      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('failed');
    });

    it('should return false without cleanup when trying to cancel already cancelled task', async () => {
      // Arrange - Cancel task first time
      await orchestrator.cancelTask(taskId);
      mockWorkspaceManager.cleanupWorkspace.mockClear(); // Clear first call

      // Act - Try to cancel again
      const result = await orchestrator.cancelTask(taskId);

      // Assert
      expect(result).toBe(false);
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();

      // Verify task status remains cancelled
      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('cancelled');
    });

    it('should cleanup workspace even for paused tasks', async () => {
      // Arrange - Mark task as paused
      await orchestrator['taskStore'].updateTaskStatus(taskId, 'paused');

      // Act - Cancel paused task
      const result = await orchestrator.cancelTask(taskId);

      // Assert
      expect(result).toBe(true);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(taskId);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(1);

      // Verify task is marked as cancelled
      const cancelledTask = await orchestrator.getTask(taskId);
      expect(cancelledTask?.status).toBe('cancelled');
    });
  });

  describe('Cleanup Call Order', () => {
    it('should call cleanup AFTER marking task as cancelled', async () => {
      // Arrange
      const callOrder: string[] = [];

      // Mock updateTaskStatus to track call order
      const originalUpdateTaskStatus = orchestrator['taskStore'].updateTaskStatus;
      vi.spyOn(orchestrator['taskStore'], 'updateTaskStatus').mockImplementation(async (id, status) => {
        callOrder.push(`updateTaskStatus:${status}`);
        return originalUpdateTaskStatus.call(orchestrator['taskStore'], id, status);
      });

      // Mock cleanupWorkspace to track call order
      mockWorkspaceManager.cleanupWorkspace.mockImplementation(async (id) => {
        callOrder.push('cleanupWorkspace');
      });

      // Act
      await orchestrator.cancelTask(taskId);

      // Assert - cleanup should be called after status update
      expect(callOrder).toEqual(['updateTaskStatus:cancelled', 'cleanupWorkspace']);
    });
  });

  describe('Integration with Running Tasks', () => {
    it('should cleanup workspace and abort controller when cancelling in-progress task', async () => {
      // Arrange - Set up in-progress task with abort controller
      const abortController = new AbortController();
      const abortSpy = vi.spyOn(abortController, 'abort');

      orchestrator['runningTasks'].set(taskId, {
        abortController,
        startTime: Date.now(),
      });

      await orchestrator['taskStore'].updateTaskStatus(taskId, 'in-progress');

      // Act
      const result = await orchestrator.cancelTask(taskId);

      // Assert
      expect(result).toBe(true);
      expect(abortSpy).toHaveBeenCalled();
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(taskId);
      expect(orchestrator['runningTasks'].has(taskId)).toBe(false);
    });
  });
});