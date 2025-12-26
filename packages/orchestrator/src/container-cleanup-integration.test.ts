import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  status?: string;
} = {}): Task => ({
  id: options.id || 'integration-task-789',
  description: 'Integration test task',
  status: options.status as any || 'in-progress',
  agent: 'integration-agent',
  workflow: 'integration-workflow',
  createdAt: new Date(),
  updatedAt: new Date(),
  progress: {
    stage: 'testing',
    stageProgress: 0.8,
    overallProgress: 0.7
  },
  workspace: {
    strategy: options.strategy as any || 'container',
    path: options.path || '/integration/workspace',
    cleanup: true,
    preserveOnFailure: options.preserveOnFailure
  },
  usage: { tokens: 200, cost: 0.05 },
  metadata: {
    branch: 'feature/integration-test',
    containerImage: 'node:18-alpine'
  }
});

describe('Container Cleanup Integration Tests', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: TaskStore;
  let mockWorkspaceManager: WorkspaceManager;
  let originalConsoleLog: typeof console.log;
  let originalConsoleWarn: typeof console.warn;
  let consoleLogs: string[];
  let consoleWarns: string[];

  beforeEach(async () => {
    // Capture console output for verification
    consoleLogs = [];
    consoleWarns = [];
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    console.log = vi.fn((message: string) => consoleLogs.push(message));
    console.warn = vi.fn((message: string, error?: any) => {
      consoleWarns.push(typeof message === 'string' ? message : JSON.stringify(message));
    });

    // Reset mocks
    vi.clearAllMocks();

    // Create comprehensive mock store
    mockStore = {
      addLog: vi.fn().mockResolvedValue(undefined),
      getTask: vi.fn().mockImplementation((taskId: string) =>
        Promise.resolve(createMockTask({ id: taskId }))
      ),
      updateTask: vi.fn().mockResolvedValue(undefined),
      createTask: vi.fn().mockImplementation((task: Partial<Task>) =>
        Promise.resolve({ ...createMockTask(), ...task })
      ),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      listTasks: vi.fn().mockResolvedValue([]),
      getLogs: vi.fn().mockResolvedValue([])
    } as unknown as TaskStore;

    // Create comprehensive mock workspace manager
    mockWorkspaceManager = {
      cleanupWorkspace: vi.fn().mockResolvedValue(undefined),
      createWorkspace: vi.fn().mockResolvedValue({
        workspacePath: '/tmp/test-workspace',
        strategy: 'container',
        status: 'active'
      }),
      getWorkspace: vi.fn().mockReturnValue(null),
      initialize: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined),
      getContainerManager: vi.fn(),
      getHealthMonitor: vi.fn()
    } as unknown as WorkspaceManager;

    // Create orchestrator with comprehensive config
    orchestrator = new ApexOrchestrator({
      projectPath: '/integration/test/project',
      config: {
        workspace: {
          cleanupOnComplete: true,
          strategy: 'container'
        },
        git: {
          worktree: {
            preserveOnFailure: false,
            cleanupDelayMs: 0,
            maxWorktrees: 5
          }
        }
      }
    });

    // Inject mocked dependencies
    (orchestrator as any).store = mockStore;
    (orchestrator as any).workspaceManager = mockWorkspaceManager;

    // Initialize to set up event listeners
    await orchestrator.initialize();
  });

  afterEach(() => {
    // Restore console functions
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
  });

  describe('real-world task failure scenarios', () => {
    it('should handle container task failure with immediate cleanup', async () => {
      const task = createMockTask({
        id: 'container-task-001',
        strategy: 'container',
        path: '/var/lib/docker/container-workspace',
        preserveOnFailure: false
      });

      // Simulate real task failure
      const error = new Error('Container execution timeout');
      error.name = 'ExecutionTimeoutError';

      // Emit the task:failed event
      orchestrator.emit('task:failed', task, error);

      // Wait for all async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify cleanup was called
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('container-task-001');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(1);

      // Verify no preservation logs
      expect(mockStore.addLog).not.toHaveBeenCalledWith(
        'container-task-001',
        expect.objectContaining({
          level: 'info',
          message: expect.stringContaining('preserved for debugging')
        })
      );

      // Verify console output
      expect(consoleLogs).not.toContain(expect.stringContaining('Preserving workspace'));
    });

    it('should handle worktree task failure with global preservation', async () => {
      // Configure global worktree preservation
      (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = true;

      const task = createMockTask({
        id: 'worktree-task-001',
        strategy: 'worktree',
        path: '/project/.apex/worktrees/feature-branch',
        preserveOnFailure: undefined // Use global config
      });

      // Simulate worktree task failure
      const error = new Error('Merge conflict during branch operation');
      error.name = 'GitMergeConflictError';

      // Emit the task:failed event
      orchestrator.emit('task:failed', task, error);

      // Wait for all async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify cleanup was NOT called
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();

      // Verify preservation log was created
      expect(mockStore.addLog).toHaveBeenCalledWith('worktree-task-001', {
        level: 'info',
        message: 'Workspace preserved for debugging (preserveOnFailure=true). Strategy: worktree, Path: /project/.apex/worktrees/feature-branch',
        timestamp: expect.any(Date),
        component: 'workspace-cleanup'
      });

      // Verify console preservation message
      expect(consoleLogs).toContain('Preserving workspace for failed task worktree-task-001 for debugging');
    });

    it('should handle mixed strategy tasks with different preservation rules', async () => {
      // Configure global worktree preservation
      (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = true;

      const containerTask = createMockTask({
        id: 'mixed-container-001',
        strategy: 'container',
        preserveOnFailure: false
      });

      const worktreeTask = createMockTask({
        id: 'mixed-worktree-001',
        strategy: 'worktree',
        preserveOnFailure: undefined // Should use global config (true)
      });

      const directoryTask = createMockTask({
        id: 'mixed-directory-001',
        strategy: 'directory',
        path: '/tmp/directory-workspace',
        preserveOnFailure: true // Explicit preservation
      });

      // Emit failures for all tasks
      orchestrator.emit('task:failed', containerTask, new Error('Container failure'));
      orchestrator.emit('task:failed', worktreeTask, new Error('Worktree failure'));
      orchestrator.emit('task:failed', directoryTask, new Error('Directory failure'));

      // Wait for all async operations
      await new Promise(resolve => setTimeout(resolve, 15));

      // Verify cleanup behavior per strategy
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('mixed-container-001');
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalledWith('mixed-worktree-001');
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalledWith('mixed-directory-001');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(1);

      // Verify preservation logs
      expect(mockStore.addLog).toHaveBeenCalledWith('mixed-worktree-001', expect.objectContaining({
        level: 'info',
        message: expect.stringContaining('preserved for debugging')
      }));

      expect(mockStore.addLog).toHaveBeenCalledWith('mixed-directory-001', expect.objectContaining({
        level: 'info',
        message: expect.stringContaining('preserved for debugging')
      }));
    });
  });

  describe('cleanup failure resilience', () => {
    it('should handle workspace cleanup failures gracefully', async () => {
      const task = createMockTask({
        id: 'cleanup-failure-001',
        preserveOnFailure: false
      });

      const cleanupError = new Error('Docker daemon not responding');
      cleanupError.name = 'DockerDaemonError';

      // Mock cleanup to fail
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockRejectedValue(cleanupError);

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Original task failure'));

      // Wait for all async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify cleanup was attempted
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('cleanup-failure-001');

      // Verify error logging
      expect(consoleWarns).toContain('Failed to cleanup workspace for failed task cleanup-failure-001:');

      // Verify error log was created
      expect(mockStore.addLog).toHaveBeenCalledWith('cleanup-failure-001', {
        level: 'warn',
        message: 'Workspace cleanup failed after task failure: Docker daemon not responding',
        timestamp: expect.any(Date),
        component: 'workspace-cleanup'
      });
    });

    it('should handle logging failures during cleanup errors', async () => {
      const task = createMockTask({
        id: 'log-failure-001',
        preserveOnFailure: false
      });

      const cleanupError = new Error('Workspace cleanup failed');
      const logError = new Error('Database connection lost');

      // Mock both cleanup and logging to fail
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockRejectedValue(cleanupError);
      vi.mocked(mockStore.addLog).mockRejectedValue(logError);

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Original task failure'));

      // Wait for all async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify cleanup was attempted
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('log-failure-001');

      // Verify console warning was still logged
      expect(consoleWarns).toContain('Failed to cleanup workspace for failed task log-failure-001:');

      // Verify log attempt was made (even though it failed)
      expect(mockStore.addLog).toHaveBeenCalled();
    });
  });

  describe('event lifecycle integration', () => {
    it('should handle sequential task completion and failure events', async () => {
      const completedTask = createMockTask({
        id: 'sequential-completed',
        status: 'completed'
      });

      const failedTask = createMockTask({
        id: 'sequential-failed',
        preserveOnFailure: false
      });

      // Emit completion first
      orchestrator.emit('task:completed', completedTask);
      await new Promise(resolve => setTimeout(resolve, 5));

      // Then emit failure
      orchestrator.emit('task:failed', failedTask, new Error('Sequential failure'));
      await new Promise(resolve => setTimeout(resolve, 5));

      // Verify both cleanups happened
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('sequential-completed');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('sequential-failed');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(2);
    });

    it('should handle rapid-fire task failures', async () => {
      const tasks = Array.from({ length: 5 }, (_, i) =>
        createMockTask({
          id: `rapid-${i}`,
          preserveOnFailure: i % 2 === 0 // Preserve every other task
        })
      );

      // Emit all failures rapidly
      tasks.forEach((task, i) => {
        orchestrator.emit('task:failed', task, new Error(`Rapid failure ${i}`));
      });

      // Wait for all async operations
      await new Promise(resolve => setTimeout(resolve, 20));

      // Verify cleanup was called for odd-indexed tasks (preserveOnFailure=false)
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('rapid-1');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('rapid-3');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(2);

      // Verify preservation logs for even-indexed tasks
      expect(mockStore.addLog).toHaveBeenCalledWith('rapid-0', expect.objectContaining({
        level: 'info',
        message: expect.stringContaining('preserved for debugging')
      }));
      expect(mockStore.addLog).toHaveBeenCalledWith('rapid-2', expect.objectContaining({
        level: 'info',
        message: expect.stringContaining('preserved for debugging')
      }));
      expect(mockStore.addLog).toHaveBeenCalledWith('rapid-4', expect.objectContaining({
        level: 'info',
        message: expect.stringContaining('preserved for debugging')
      }));
    });
  });

  describe('configuration changes during runtime', () => {
    it('should respect configuration changes for subsequent failures', async () => {
      const task1 = createMockTask({
        id: 'config-change-1',
        strategy: 'worktree',
        preserveOnFailure: undefined // Use global config
      });

      const task2 = createMockTask({
        id: 'config-change-2',
        strategy: 'worktree',
        preserveOnFailure: undefined // Use global config
      });

      // Initially, global config is preserve=false
      orchestrator.emit('task:failed', task1, new Error('First failure'));
      await new Promise(resolve => setTimeout(resolve, 5));

      // Change global config to preserve=true
      (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = true;

      orchestrator.emit('task:failed', task2, new Error('Second failure'));
      await new Promise(resolve => setTimeout(resolve, 5));

      // Verify first task was cleaned up (preserve=false)
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('config-change-1');

      // Verify second task was preserved (preserve=true)
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalledWith('config-change-2');
      expect(mockStore.addLog).toHaveBeenCalledWith('config-change-2', expect.objectContaining({
        level: 'info',
        message: expect.stringContaining('preserved for debugging')
      }));
    });

    it('should respect disabled cleanup configuration', async () => {
      const task = createMockTask({
        id: 'disabled-cleanup',
        preserveOnFailure: false
      });

      // Disable global cleanup
      (orchestrator as any).effectiveConfig.workspace.cleanupOnComplete = false;

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Cleanup disabled test'));
      await new Promise(resolve => setTimeout(resolve, 5));

      // Verify no cleanup occurred despite preserveOnFailure=false
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();

      // Re-enable cleanup
      (orchestrator as any).effectiveConfig.workspace.cleanupOnComplete = true;

      // Emit another failure
      const task2 = createMockTask({
        id: 'enabled-cleanup',
        preserveOnFailure: false
      });

      orchestrator.emit('task:failed', task2, new Error('Cleanup enabled test'));
      await new Promise(resolve => setTimeout(resolve, 5));

      // Verify cleanup occurred this time
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('enabled-cleanup');
    });
  });

  describe('workspace manager integration', () => {
    it('should pass correct task ID to workspace manager', async () => {
      const task = createMockTask({
        id: 'workspace-integration-test',
        preserveOnFailure: false
      });

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Integration test'));
      await new Promise(resolve => setTimeout(resolve, 5));

      // Verify exact parameters passed to cleanup
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('workspace-integration-test');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(1);

      // Verify call was made with correct context
      const callArgs = vi.mocked(mockWorkspaceManager.cleanupWorkspace).mock.calls[0];
      expect(callArgs).toHaveLength(1);
      expect(typeof callArgs[0]).toBe('string');
    });

    it('should handle workspace manager throwing async errors', async () => {
      const task = createMockTask({
        id: 'async-error-test',
        preserveOnFailure: false
      });

      // Mock workspace manager to reject asynchronously
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        throw new Error('Async cleanup failure');
      });

      // Emit task:failed event
      orchestrator.emit('task:failed', task, new Error('Original failure'));

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 15));

      // Verify error handling
      expect(consoleWarns).toContain('Failed to cleanup workspace for failed task async-error-test:');
      expect(mockStore.addLog).toHaveBeenCalledWith('async-error-test', expect.objectContaining({
        level: 'warn',
        message: expect.stringContaining('Workspace cleanup failed after task failure')
      }));
    });
  });
});