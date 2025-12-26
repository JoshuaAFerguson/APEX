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

describe('ApexOrchestrator.cancelTask() Cleanup Edge Cases', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let mockWorkspaceManager: {
    cleanupWorkspace: MockedFunction<any>;
    createWorkspace: MockedFunction<any>;
  };

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    description: 'Test task for cancel cleanup edge cases',
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
    ...overrides,
  });

  beforeEach(async () => {
    // Create test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-cancel-edge-test-'));
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
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('Concurrent Cancellation Scenarios', () => {
    it('should handle multiple concurrent cancellation calls gracefully', async () => {
      // Arrange
      const task = createTestTask();
      await orchestrator.createTask(task);

      // Slow down cleanup to simulate race condition
      mockWorkspaceManager.cleanupWorkspace.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      // Act - Make multiple concurrent cancellation calls
      const results = await Promise.all([
        orchestrator.cancelTask(task.id),
        orchestrator.cancelTask(task.id),
        orchestrator.cancelTask(task.id),
      ]);

      // Assert - Only first call should succeed, others should return false
      expect(results.filter(r => r === true)).toHaveLength(1);
      expect(results.filter(r => r === false)).toHaveLength(2);

      // Cleanup should only be called once
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(1);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(task.id);
    });
  });

  describe('Cleanup Timeout Scenarios', () => {
    it('should handle very slow cleanup operations', async () => {
      // Arrange
      const task = createTestTask();
      await orchestrator.createTask(task);

      // Make cleanup very slow (but still complete)
      mockWorkspaceManager.cleanupWorkspace.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 2000))
      );

      // Act
      const startTime = Date.now();
      const result = await orchestrator.cancelTask(task.id);
      const endTime = Date.now();

      // Assert - Should still complete successfully
      expect(result).toBe(true);
      expect(endTime - startTime).toBeGreaterThan(1000); // Should take time
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(task.id);

      // Task should still be cancelled
      const cancelledTask = await orchestrator.getTask(task.id);
      expect(cancelledTask?.status).toBe('cancelled');
    });
  });

  describe('Memory Management During Cleanup', () => {
    it('should cleanup workspace for tasks with large amounts of data', async () => {
      // Arrange
      const task = createTestTask({
        logs: new Array(1000).fill(null).map((_, i) => ({
          id: `log_${i}`,
          taskId: '',
          level: 'info' as const,
          message: `Large log message ${i} with lots of text data to simulate memory usage`,
          timestamp: new Date(),
        })),
        artifacts: new Array(100).fill(null).map((_, i) => ({
          id: `artifact_${i}`,
          taskId: '',
          name: `large_artifact_${i}.json`,
          type: 'file',
          path: `/tmp/large_file_${i}.json`,
          size: 1024 * 1024, // 1MB each
          createdAt: new Date(),
        })),
      });

      await orchestrator.createTask(task);

      // Act
      const result = await orchestrator.cancelTask(task.id);

      // Assert
      expect(result).toBe(true);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(task.id);

      // Task should be cancelled despite large data
      const cancelledTask = await orchestrator.getTask(task.id);
      expect(cancelledTask?.status).toBe('cancelled');
    });
  });

  describe('Cleanup with Different Error Types', () => {
    it('should handle cleanup throwing network-related errors', async () => {
      // Arrange
      const task = createTestTask();
      await orchestrator.createTask(task);

      const networkError = new Error('Network timeout during container cleanup');
      networkError.name = 'ECONNREFUSED';
      mockWorkspaceManager.cleanupWorkspace.mockRejectedValue(networkError);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Act
      const result = await orchestrator.cancelTask(task.id);

      // Assert
      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Failed to cleanup workspace for cancelled task ${task.id}:`,
        networkError
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle cleanup throwing permission errors', async () => {
      // Arrange
      const task = createTestTask();
      await orchestrator.createTask(task);

      const permissionError = new Error('Permission denied');
      permissionError.name = 'EACCES';
      mockWorkspaceManager.cleanupWorkspace.mockRejectedValue(permissionError);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Act
      const result = await orchestrator.cancelTask(task.id);

      // Assert
      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Failed to cleanup workspace for cancelled task ${task.id}:`,
        permissionError
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle cleanup throwing filesystem errors', async () => {
      // Arrange
      const task = createTestTask();
      await orchestrator.createTask(task);

      const fsError = new Error('No space left on device');
      fsError.name = 'ENOSPC';
      mockWorkspaceManager.cleanupWorkspace.mockRejectedValue(fsError);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Act
      const result = await orchestrator.cancelTask(task.id);

      // Assert
      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Failed to cleanup workspace for cancelled task ${task.id}:`,
        fsError
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('State Consistency During Cleanup Failures', () => {
    it('should maintain task cancelled state even if cleanup fails multiple times', async () => {
      // Arrange
      const task = createTestTask();
      await orchestrator.createTask(task);

      // Make cleanup fail
      mockWorkspaceManager.cleanupWorkspace.mockRejectedValue(new Error('Cleanup failed'));
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Act - Cancel task (cleanup fails)
      const result1 = await orchestrator.cancelTask(task.id);

      // Try to cancel again (should return false since already cancelled)
      mockWorkspaceManager.cleanupWorkspace.mockClear();
      const result2 = await orchestrator.cancelTask(task.id);

      // Assert
      expect(result1).toBe(true);
      expect(result2).toBe(false);

      // Cleanup should only be called once (for the first cancellation)
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();

      // Task should remain cancelled
      const cancelledTask = await orchestrator.getTask(task.id);
      expect(cancelledTask?.status).toBe('cancelled');

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Resource Management During Cleanup', () => {
    it('should cleanup workspace for tasks with active file handles', async () => {
      // Arrange
      const task = createTestTask();
      await orchestrator.createTask(task);

      // Simulate task with active resources
      orchestrator['runningTasks'].set(task.id, {
        abortController: new AbortController(),
        startTime: Date.now(),
      });

      await orchestrator['taskStore'].updateTaskStatus(task.id, 'running');

      // Act
      const result = await orchestrator.cancelTask(task.id);

      // Assert
      expect(result).toBe(true);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(task.id);

      // Running task should be removed
      expect(orchestrator['runningTasks'].has(task.id)).toBe(false);

      // Task should be cancelled
      const cancelledTask = await orchestrator.getTask(task.id);
      expect(cancelledTask?.status).toBe('cancelled');
    });
  });

  describe('Cleanup Call Timing Edge Cases', () => {
    it('should ensure cleanup is called after all status updates are complete', async () => {
      // Arrange
      const task = createTestTask();
      await orchestrator.createTask(task);

      const events: string[] = [];

      // Mock database operations to track timing
      const originalUpdateTaskStatus = orchestrator['taskStore'].updateTaskStatus;
      vi.spyOn(orchestrator['taskStore'], 'updateTaskStatus').mockImplementation(async (id, status) => {
        events.push(`status_update_start:${status}`);
        const result = await originalUpdateTaskStatus.call(orchestrator['taskStore'], id, status);
        events.push(`status_update_complete:${status}`);
        return result;
      });

      // Mock cleanup to track timing
      mockWorkspaceManager.cleanupWorkspace.mockImplementation(async (id) => {
        events.push('cleanup_start');
        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, 10));
        events.push('cleanup_complete');
      });

      // Act
      await orchestrator.cancelTask(task.id);

      // Assert - cleanup should start after status update is complete
      expect(events).toEqual([
        'status_update_start:cancelled',
        'status_update_complete:cancelled',
        'cleanup_start',
        'cleanup_complete',
      ]);
    });
  });
});