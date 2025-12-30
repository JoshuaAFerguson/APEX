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
} = {}): Task => ({
  id: options.id || 'test-task-123',
  description: 'Test task',
  status: 'in-progress',
  agent: 'test-agent',
  workflow: 'test-workflow',
  createdAt: new Date(),
  updatedAt: new Date(),
  progress: {
    stage: 'planning',
    stageProgress: 0,
    overallProgress: 0
  },
  workspace: {
    strategy: options.strategy as any || 'container',
    path: options.path || '/test/workspace',
    cleanup: true,
    preserveOnFailure: options.preserveOnFailure
  },
  usage: { tokens: 0, cost: 0 },
  metadata: {}
});

describe('Container Cleanup on Task Failure', () => {
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
      projectPath: '/test/project'
    });

    // Inject mocked dependencies
    (orchestrator as any).store = mockStore;
    (orchestrator as any).workspaceManager = mockWorkspaceManager;

    // Mock effective config
    (orchestrator as any).effectiveConfig = {
      workspace: {
        cleanupOnComplete: true
      },
      git: {
        worktree: {
          preserveOnFailure: false
        }
      }
    };

    // Initialize to set up event listeners
    await orchestrator.initialize();
  });

  describe('shouldPreserveOnFailure helper method', () => {
    it('should return task-level preserveOnFailure when defined (true)', () => {
      const task = createMockTask({ preserveOnFailure: true });
      const result = (orchestrator as any).shouldPreserveOnFailure(task);
      expect(result).toBe(true);
    });

    it('should return task-level preserveOnFailure when defined (false)', () => {
      const task = createMockTask({ preserveOnFailure: false });
      const result = (orchestrator as any).shouldPreserveOnFailure(task);
      expect(result).toBe(false);
    });

    it('should return worktree config for worktree strategy when task-level not defined', () => {
      // Set worktree preserveOnFailure to true
      (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = true;

      const task = createMockTask({ strategy: 'worktree' });
      delete task.workspace!.preserveOnFailure; // Remove task-level setting

      const result = (orchestrator as any).shouldPreserveOnFailure(task);
      expect(result).toBe(true);
    });

    it('should return false for non-worktree strategies when task-level not defined', () => {
      const task = createMockTask({ strategy: 'container' });
      delete task.workspace!.preserveOnFailure; // Remove task-level setting

      const result = (orchestrator as any).shouldPreserveOnFailure(task);
      expect(result).toBe(false);
    });

    it('should prioritize task-level config over global config', () => {
      // Set global worktree preserveOnFailure to true
      (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = true;

      // Task-level setting should override
      const task = createMockTask({ strategy: 'worktree', preserveOnFailure: false });

      const result = (orchestrator as any).shouldPreserveOnFailure(task);
      expect(result).toBe(false);
    });
  });

  describe('task:failed event handling', () => {
    it('should cleanup workspace when preserveOnFailure=false (default)', async () => {
      const task = createMockTask({ preserveOnFailure: false });

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Test failure'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify cleanup was called
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('test-task-123');
      expect(mockStore.addLog).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          level: 'info',
          message: expect.stringContaining('preserved for debugging')
        })
      );
    });

    it('should preserve workspace when task.workspace.preserveOnFailure=true', async () => {
      const task = createMockTask({ preserveOnFailure: true });

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Test failure'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify cleanup was NOT called
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();

      // Verify preservation log was created
      expect(mockStore.addLog).toHaveBeenCalledWith('test-task-123', {
        level: 'info',
        message: expect.stringContaining('Workspace preserved for debugging (preserveOnFailure=true)'),
        timestamp: expect.any(Date),
        component: 'workspace-cleanup'
      });
    });

    it('should preserve workspace when git.worktree.preserveOnFailure=true for worktree strategy', async () => {
      // Configure global preserveOnFailure for worktrees
      (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = true;

      const task = createMockTask({ strategy: 'worktree', path: '/test/worktree' });
      delete task.workspace!.preserveOnFailure; // Remove task-level setting

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Test failure'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify cleanup was NOT called
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();

      // Verify preservation log was created with strategy and path
      expect(mockStore.addLog).toHaveBeenCalledWith('test-task-123', {
        level: 'info',
        message: 'Workspace preserved for debugging (preserveOnFailure=true). Strategy: worktree, Path: /test/worktree',
        timestamp: expect.any(Date),
        component: 'workspace-cleanup'
      });
    });

    it('should task-level config override global config (cleanup when task.preserveOnFailure=false)', async () => {
      // Set global preserveOnFailure to true
      (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = true;

      // Task-level setting should override (set to false)
      const task = createMockTask({ strategy: 'worktree', preserveOnFailure: false });

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Test failure'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify cleanup was called (task-level config wins)
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('test-task-123');
      expect(mockStore.addLog).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          level: 'info',
          message: expect.stringContaining('preserved for debugging')
        })
      );
    });

    it('should respect cleanupOnComplete=false config even on failure', async () => {
      // Disable global cleanup
      (orchestrator as any).effectiveConfig.workspace.cleanupOnComplete = false;

      const task = createMockTask({ preserveOnFailure: false });

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Test failure'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify cleanup was NOT called due to global setting
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully and log them', async () => {
      const task = createMockTask({ preserveOnFailure: false });
      const cleanupError = new Error('Container removal failed');

      // Mock cleanup to throw error
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockRejectedValue(cleanupError);

      // Spy on console.warn
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Test failure'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify cleanup was attempted
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('test-task-123');

      // Verify error was logged to console
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to cleanup workspace for failed task test-task-123:',
        cleanupError
      );

      // Verify error was logged to store
      expect(mockStore.addLog).toHaveBeenCalledWith('test-task-123', {
        level: 'warn',
        message: 'Workspace cleanup failed after task failure: Container removal failed',
        timestamp: expect.any(Date),
        component: 'workspace-cleanup'
      });

      consoleSpy.mockRestore();
    });

    it('should handle workspace config being undefined', async () => {
      const task = createMockTask();
      // Remove workspace config entirely
      delete task.workspace;

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Test failure'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should not throw error and should attempt cleanup (preserveOnFailure defaults to false)
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('test-task-123');
    });

    it('should include container information in preservation log when available', async () => {
      const task = createMockTask({
        preserveOnFailure: true,
        strategy: 'container',
        path: '/container/workspace'
      });

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Test failure'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify preservation log includes strategy and path
      expect(mockStore.addLog).toHaveBeenCalledWith('test-task-123', {
        level: 'info',
        message: 'Workspace preserved for debugging (preserveOnFailure=true). Strategy: container, Path: /container/workspace',
        timestamp: expect.any(Date),
        component: 'workspace-cleanup'
      });
    });

    it('should handle missing strategy and path gracefully', async () => {
      const task = createMockTask({ preserveOnFailure: true });
      // Remove strategy and path
      delete task.workspace!.strategy;
      delete task.workspace!.path;

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Test failure'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify preservation log handles missing info
      expect(mockStore.addLog).toHaveBeenCalledWith('test-task-123', {
        level: 'info',
        message: 'Workspace preserved for debugging (preserveOnFailure=true). Strategy: unknown, Path: unknown',
        timestamp: expect.any(Date),
        component: 'workspace-cleanup'
      });
    });
  });

  describe('integration with existing task:completed cleanup', () => {
    it('should continue to cleanup on task completion as before', async () => {
      const task = createMockTask();

      // Emit task:completed event
      orchestrator.emit('task:completed', task);

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify cleanup was called for completion
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('test-task-123');
    });

    it('should handle both completion and failure cleanup independently', async () => {
      const completedTask = createMockTask({ id: 'completed-task' });
      const failedTask = createMockTask({ id: 'failed-task', preserveOnFailure: false });

      // Emit both events
      orchestrator.emit('task:completed', completedTask);
      orchestrator.emit('task:failed', failedTask, new Error('Test failure'));

      // Wait for async event handlers to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify cleanup was called for both tasks
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('completed-task');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('failed-task');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(2);
    });
  });

  describe('console logging verification', () => {
    it('should log preservation message to console when preserving workspace', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const task = createMockTask({ preserveOnFailure: true });

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Test failure'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify console.log was called
      expect(consoleSpy).toHaveBeenCalledWith(
        'Preserving workspace for failed task test-task-123 for debugging'
      );

      consoleSpy.mockRestore();
    });

    it('should not log preservation message when cleaning up', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const task = createMockTask({ preserveOnFailure: false });

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Test failure'));

      // Wait for async event handler to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify console.log was NOT called for preservation
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Preserving workspace')
      );

      consoleSpy.mockRestore();
    });
  });
});