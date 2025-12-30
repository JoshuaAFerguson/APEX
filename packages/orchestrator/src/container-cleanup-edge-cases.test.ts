import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApexOrchestrator } from './index.js';
import { TaskStore } from './store.js';
import { WorkspaceManager } from './workspace-manager.js';
import { Task } from '@apexcli/core';

// Mock dependencies
vi.mock('./store.js');
vi.mock('./workspace-manager.js');
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn()
}));

const createMockTask = (options: {
  id?: string;
  preserveOnFailure?: boolean;
  strategy?: string;
  path?: string;
  hasWorkspace?: boolean;
} = {}): Task => {
  const baseTask: Task = {
    id: options.id || 'test-task-456',
    description: 'Edge case test task',
    status: 'in-progress',
    agent: 'test-agent',
    workflow: 'test-workflow',
    createdAt: new Date(),
    updatedAt: new Date(),
    progress: {
      stage: 'implementation',
      stageProgress: 0.5,
      overallProgress: 0.3
    },
    usage: { tokens: 100, cost: 0.01 },
    metadata: {}
  };

  if (options.hasWorkspace !== false) {
    baseTask.workspace = {
      strategy: options.strategy as any || 'container',
      path: options.path || '/edge/test/workspace',
      cleanup: true,
      preserveOnFailure: options.preserveOnFailure
    };
  }

  return baseTask;
};

describe('Container Cleanup Edge Cases', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: TaskStore;
  let mockWorkspaceManager: WorkspaceManager;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock store
    mockStore = {
      addLog: vi.fn().mockResolvedValue(undefined),
      getTask: vi.fn(),
      updateTask: vi.fn()
    } as unknown as TaskStore;

    // Create mock workspace manager
    mockWorkspaceManager = {
      cleanupWorkspace: vi.fn().mockResolvedValue(undefined)
    } as unknown as WorkspaceManager;

    // Create orchestrator with mocked dependencies
    orchestrator = new ApexOrchestrator({
      projectPath: '/edge/test/project'
    });

    // Inject mocked dependencies
    (orchestrator as any).store = mockStore;
    (orchestrator as any).workspaceManager = mockWorkspaceManager;

    // Mock effective config with nested structure
    (orchestrator as any).effectiveConfig = {
      workspace: {
        cleanupOnComplete: true
      },
      git: {
        worktree: {
          preserveOnFailure: false,
          cleanupDelayMs: 0
        }
      }
    };

    // Initialize to set up event listeners
    await orchestrator.initialize();
  });

  describe('shouldPreserveOnFailure edge cases', () => {
    it('should handle undefined workspace gracefully', () => {
      const task = createMockTask({ hasWorkspace: false });
      const result = (orchestrator as any).shouldPreserveOnFailure(task);
      expect(result).toBe(false);
    });

    it('should handle null workspace.strategy', () => {
      const task = createMockTask({ strategy: undefined });
      task.workspace!.strategy = null as any;

      const result = (orchestrator as any).shouldPreserveOnFailure(task);
      expect(result).toBe(false);
    });

    it('should handle missing git config in effectiveConfig', () => {
      // Remove git config entirely
      delete (orchestrator as any).effectiveConfig.git;

      const task = createMockTask({ strategy: 'worktree' });
      delete task.workspace!.preserveOnFailure;

      const result = (orchestrator as any).shouldPreserveOnFailure(task);
      expect(result).toBe(false);
    });

    it('should handle missing worktree config in git config', () => {
      // Remove worktree config
      (orchestrator as any).effectiveConfig.git = {};

      const task = createMockTask({ strategy: 'worktree' });
      delete task.workspace!.preserveOnFailure;

      const result = (orchestrator as any).shouldPreserveOnFailure(task);
      expect(result).toBe(false);
    });

    it('should handle directory strategy (non-worktree)', () => {
      // Set global worktree preserveOnFailure to true
      (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = true;

      const task = createMockTask({ strategy: 'directory' });
      delete task.workspace!.preserveOnFailure;

      const result = (orchestrator as any).shouldPreserveOnFailure(task);
      expect(result).toBe(false); // Should not use worktree config for directory strategy
    });

    it('should handle empty string strategy', () => {
      const task = createMockTask({ strategy: '' });
      delete task.workspace!.preserveOnFailure;

      const result = (orchestrator as any).shouldPreserveOnFailure(task);
      expect(result).toBe(false);
    });

    it('should handle preserveOnFailure set to undefined explicitly', () => {
      const task = createMockTask();
      task.workspace!.preserveOnFailure = undefined;

      // Should fall back to worktree config for worktree strategy
      (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = true;
      task.workspace!.strategy = 'worktree';

      const result = (orchestrator as any).shouldPreserveOnFailure(task);
      expect(result).toBe(true);
    });
  });

  describe('task:failed event edge cases', () => {
    it('should handle task:failed with no workspace config', async () => {
      const task = createMockTask({ hasWorkspace: false });

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('No workspace test'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should attempt cleanup even with no workspace (preserveOnFailure defaults to false)
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('test-task-456');
    });

    it('should handle very long error messages in cleanup failures', async () => {
      const task = createMockTask({ preserveOnFailure: false });
      const longErrorMessage = 'a'.repeat(10000); // Very long error message
      const cleanupError = new Error(longErrorMessage);

      // Mock cleanup to throw error with long message
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockRejectedValue(cleanupError);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Test failure'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify error was logged properly
      expect(mockStore.addLog).toHaveBeenCalledWith('test-task-456', {
        level: 'warn',
        message: `Workspace cleanup failed after task failure: ${longErrorMessage}`,
        timestamp: expect.any(Date),
        component: 'workspace-cleanup'
      });

      consoleSpy.mockRestore();
    });

    it('should handle cleanup throwing non-Error objects', async () => {
      const task = createMockTask({ preserveOnFailure: false });
      const weirdError = 'string error'; // Non-Error object

      // Mock cleanup to throw non-Error
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockRejectedValue(weirdError);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Test failure'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify fallback error message
      expect(mockStore.addLog).toHaveBeenCalledWith('test-task-456', {
        level: 'warn',
        message: 'Workspace cleanup failed after task failure: Unknown error',
        timestamp: expect.any(Date),
        component: 'workspace-cleanup'
      });

      consoleSpy.mockRestore();
    });

    it('should handle addLog failing during preservation logging', async () => {
      const task = createMockTask({ preserveOnFailure: true });
      const logError = new Error('Logging system failure');

      // Mock addLog to fail
      vi.mocked(mockStore.addLog).mockRejectedValue(logError);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Test failure'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should still attempt to preserve and not call cleanup
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Preserving workspace for failed task test-task-456 for debugging'
      );

      // Should have attempted to log (even though it failed)
      expect(mockStore.addLog).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle addLog failing during cleanup error logging', async () => {
      const task = createMockTask({ preserveOnFailure: false });
      const cleanupError = new Error('Cleanup failed');
      const logError = new Error('Logging failed');

      // Mock cleanup to fail and addLog to fail
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockRejectedValue(cleanupError);
      vi.mocked(mockStore.addLog).mockRejectedValue(logError);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Test failure'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should still attempt cleanup and console logging
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('test-task-456');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to cleanup workspace for failed task test-task-456:',
        cleanupError
      );

      consoleSpy.mockRestore();
    });

    it('should handle concurrent task:failed events', async () => {
      const task1 = createMockTask({ id: 'concurrent-1', preserveOnFailure: false });
      const task2 = createMockTask({ id: 'concurrent-2', preserveOnFailure: true });
      const task3 = createMockTask({ id: 'concurrent-3', preserveOnFailure: false });

      // Mock cleanup with delay to test concurrency
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (taskId) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return undefined;
      });

      // Emit multiple task:failed events simultaneously
      orchestrator.emit('task:failed', task1, new Error('Failure 1'));
      orchestrator.emit('task:failed', task2, new Error('Failure 2'));
      orchestrator.emit('task:failed', task3, new Error('Failure 3'));

      // Wait for all async handlers to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify appropriate cleanup calls
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('concurrent-1');
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalledWith('concurrent-2'); // preserved
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('concurrent-3');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(2);

      // Verify preservation log for task2
      expect(mockStore.addLog).toHaveBeenCalledWith('concurrent-2', expect.objectContaining({
        level: 'info',
        message: expect.stringContaining('preserved for debugging')
      }));
    });

    it('should handle workspace config with null values', async () => {
      const task = createMockTask({ preserveOnFailure: true });
      // Set workspace properties to null
      task.workspace!.strategy = null as any;
      task.workspace!.path = null as any;

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Null values test'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should handle null values gracefully in log message
      expect(mockStore.addLog).toHaveBeenCalledWith('test-task-456', {
        level: 'info',
        message: 'Workspace preserved for debugging (preserveOnFailure=true). Strategy: unknown, Path: unknown',
        timestamp: expect.any(Date),
        component: 'workspace-cleanup'
      });
    });
  });

  describe('configuration hierarchy edge cases', () => {
    it('should handle deeply nested undefined config structures', () => {
      // Test various levels of undefined config
      (orchestrator as any).effectiveConfig = {}; // No workspace or git config

      const task = createMockTask({ strategy: 'worktree' });
      delete task.workspace!.preserveOnFailure;

      const result = (orchestrator as any).shouldPreserveOnFailure(task);
      expect(result).toBe(false);
    });

    it('should handle config with null git property', () => {
      (orchestrator as any).effectiveConfig.git = null;

      const task = createMockTask({ strategy: 'worktree' });
      delete task.workspace!.preserveOnFailure;

      const result = (orchestrator as any).shouldPreserveOnFailure(task);
      expect(result).toBe(false);
    });

    it('should handle config with null worktree property', () => {
      (orchestrator as any).effectiveConfig.git.worktree = null;

      const task = createMockTask({ strategy: 'worktree' });
      delete task.workspace!.preserveOnFailure;

      const result = (orchestrator as any).shouldPreserveOnFailure(task);
      expect(result).toBe(false);
    });

    it('should handle preserveOnFailure being null explicitly', () => {
      (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = null;

      const task = createMockTask({ strategy: 'worktree' });
      delete task.workspace!.preserveOnFailure;

      const result = (orchestrator as any).shouldPreserveOnFailure(task);
      expect(result).toBe(false); // null should be falsy
    });

    it('should handle preserveOnFailure being 0 (falsy number)', () => {
      (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = 0;

      const task = createMockTask({ strategy: 'worktree' });
      delete task.workspace!.preserveOnFailure;

      const result = (orchestrator as any).shouldPreserveOnFailure(task);
      expect(result).toBe(false); // 0 should be falsy
    });

    it('should handle preserveOnFailure being empty string (falsy)', () => {
      (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = '';

      const task = createMockTask({ strategy: 'worktree' });
      delete task.workspace!.preserveOnFailure;

      const result = (orchestrator as any).shouldPreserveOnFailure(task);
      expect(result).toBe(false); // empty string should be falsy
    });
  });

  describe('integration with workspace config edge cases', () => {
    it('should respect cleanupOnComplete=null as false', async () => {
      // Set cleanupOnComplete to null
      (orchestrator as any).effectiveConfig.workspace.cleanupOnComplete = null;

      const task = createMockTask({ preserveOnFailure: false });

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Test failure'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should cleanup since null is not strictly false
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('test-task-456');
    });

    it('should respect cleanupOnComplete=undefined as true', async () => {
      // Remove cleanupOnComplete entirely
      delete (orchestrator as any).effectiveConfig.workspace.cleanupOnComplete;

      const task = createMockTask({ preserveOnFailure: false });

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Test failure'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should cleanup since undefined !== false
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('test-task-456');
    });

    it('should handle missing workspace config entirely', async () => {
      // Remove workspace config entirely
      delete (orchestrator as any).effectiveConfig.workspace;

      const task = createMockTask({ preserveOnFailure: false });

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Test failure'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should still cleanup since workspace config is undefined
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('test-task-456');
    });
  });
});