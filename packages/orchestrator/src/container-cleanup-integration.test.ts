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

  describe('preserveOnFailure flag integration tests', () => {
    beforeEach(() => {
      // Reset mocks before each test in this section
      vi.clearAllMocks();
      consoleLogs.length = 0;
      consoleWarns.length = 0;
    });

    describe('cleanup happens when preserveOnFailure=false', () => {
      it('should cleanup container workspace when task-level preserveOnFailure=false', async () => {
        const task = createMockTask({
          id: 'container-cleanup-false',
          strategy: 'container',
          path: '/var/lib/docker/container-workspace',
          preserveOnFailure: false
        });

        // Emit task:failed event
        orchestrator.emit('task:failed', task, new Error('Container task failure'));
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify cleanup was called
        expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('container-cleanup-false');
        expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(1);

        // Verify no preservation logs
        expect(mockStore.addLog).not.toHaveBeenCalledWith('container-cleanup-false', expect.objectContaining({
          level: 'info',
          message: expect.stringContaining('preserved for debugging')
        }));

        // Verify no preservation console output
        expect(consoleLogs).not.toContain(expect.stringContaining('Preserving workspace'));
      });

      it('should cleanup worktree workspace when global preserveOnFailure=false', async () => {
        // Ensure global worktree config is preserve=false
        (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = false;

        const task = createMockTask({
          id: 'worktree-cleanup-global-false',
          strategy: 'worktree',
          path: '/project/.apex/worktrees/feature-branch',
          preserveOnFailure: undefined // Use global config
        });

        // Emit task:failed event
        orchestrator.emit('task:failed', task, new Error('Worktree task failure'));
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify cleanup was called
        expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('worktree-cleanup-global-false');
        expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(1);

        // Verify no preservation logs
        expect(mockStore.addLog).not.toHaveBeenCalledWith('worktree-cleanup-global-false', expect.objectContaining({
          level: 'info',
          message: expect.stringContaining('preserved for debugging')
        }));
      });

      it('should cleanup directory workspace when preserveOnFailure=false', async () => {
        const task = createMockTask({
          id: 'directory-cleanup-false',
          strategy: 'directory',
          path: '/tmp/directory-workspace',
          preserveOnFailure: false
        });

        // Emit task:failed event
        orchestrator.emit('task:failed', task, new Error('Directory task failure'));
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify cleanup was called
        expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('directory-cleanup-false');
        expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(1);

        // Verify no preservation logs
        expect(mockStore.addLog).not.toHaveBeenCalledWith('directory-cleanup-false', expect.objectContaining({
          level: 'info',
          message: expect.stringContaining('preserved for debugging')
        }));
      });
    });

    describe('cleanup skipped when preserveOnFailure=true', () => {
      it('should skip cleanup when task-level preserveOnFailure=true for container', async () => {
        const task = createMockTask({
          id: 'container-preserve-true',
          strategy: 'container',
          path: '/var/lib/docker/preserved-container',
          preserveOnFailure: true
        });

        // Emit task:failed event
        orchestrator.emit('task:failed', task, new Error('Container task failure'));
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify cleanup was NOT called
        expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();

        // Verify preservation log was created
        expect(mockStore.addLog).toHaveBeenCalledWith('container-preserve-true', {
          level: 'info',
          message: 'Workspace preserved for debugging (preserveOnFailure=true). Strategy: container, Path: /var/lib/docker/preserved-container',
          timestamp: expect.any(Date),
          component: 'workspace-cleanup'
        });

        // Verify preservation console message
        expect(consoleLogs).toContain('Preserving workspace for failed task container-preserve-true for debugging');
      });

      it('should skip cleanup when global worktree preserveOnFailure=true', async () => {
        // Configure global worktree preservation
        (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = true;

        const task = createMockTask({
          id: 'worktree-preserve-global-true',
          strategy: 'worktree',
          path: '/project/.apex/worktrees/debug-branch',
          preserveOnFailure: undefined // Use global config (true)
        });

        // Emit task:failed event
        orchestrator.emit('task:failed', task, new Error('Worktree task failure'));
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify cleanup was NOT called
        expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();

        // Verify preservation log was created
        expect(mockStore.addLog).toHaveBeenCalledWith('worktree-preserve-global-true', {
          level: 'info',
          message: 'Workspace preserved for debugging (preserveOnFailure=true). Strategy: worktree, Path: /project/.apex/worktrees/debug-branch',
          timestamp: expect.any(Date),
          component: 'workspace-cleanup'
        });

        // Verify preservation console message
        expect(consoleLogs).toContain('Preserving workspace for failed task worktree-preserve-global-true for debugging');
      });

      it('should skip cleanup when preserveOnFailure=true for directory strategy', async () => {
        const task = createMockTask({
          id: 'directory-preserve-true',
          strategy: 'directory',
          path: '/tmp/preserved-directory',
          preserveOnFailure: true
        });

        // Emit task:failed event
        orchestrator.emit('task:failed', task, new Error('Directory task failure'));
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify cleanup was NOT called
        expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();

        // Verify preservation log was created
        expect(mockStore.addLog).toHaveBeenCalledWith('directory-preserve-true', {
          level: 'info',
          message: 'Workspace preserved for debugging (preserveOnFailure=true). Strategy: directory, Path: /tmp/preserved-directory',
          timestamp: expect.any(Date),
          component: 'workspace-cleanup'
        });

        // Verify preservation console message
        expect(consoleLogs).toContain('Preserving workspace for failed task directory-preserve-true for debugging');
      });
    });

    describe('task-level config overrides global config', () => {
      it('should use task-level preserveOnFailure=false even when global=true', async () => {
        // Set global worktree config to preserve=true
        (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = true;

        const task = createMockTask({
          id: 'task-override-false',
          strategy: 'worktree',
          path: '/project/.apex/worktrees/task-override',
          preserveOnFailure: false // Task-level override
        });

        // Emit task:failed event
        orchestrator.emit('task:failed', task, new Error('Task override test'));
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify cleanup was called (task-level false overrides global true)
        expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('task-override-false');
        expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(1);

        // Verify no preservation logs
        expect(mockStore.addLog).not.toHaveBeenCalledWith('task-override-false', expect.objectContaining({
          level: 'info',
          message: expect.stringContaining('preserved for debugging')
        }));

        // Verify no preservation console output
        expect(consoleLogs).not.toContain(expect.stringContaining('Preserving workspace'));
      });

      it('should use task-level preserveOnFailure=true even when global=false', async () => {
        // Set global worktree config to preserve=false
        (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = false;

        const task = createMockTask({
          id: 'task-override-true',
          strategy: 'worktree',
          path: '/project/.apex/worktrees/task-preserve',
          preserveOnFailure: true // Task-level override
        });

        // Emit task:failed event
        orchestrator.emit('task:failed', task, new Error('Task preserve test'));
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify cleanup was NOT called (task-level true overrides global false)
        expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();

        // Verify preservation log was created
        expect(mockStore.addLog).toHaveBeenCalledWith('task-override-true', {
          level: 'info',
          message: 'Workspace preserved for debugging (preserveOnFailure=true). Strategy: worktree, Path: /project/.apex/worktrees/task-preserve',
          timestamp: expect.any(Date),
          component: 'workspace-cleanup'
        });

        // Verify preservation console message
        expect(consoleLogs).toContain('Preserving workspace for failed task task-override-true for debugging');
      });

      it('should handle mixed strategies with different preservation configurations', async () => {
        // Set global worktree config to preserve=true
        (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = true;

        const containerTask = createMockTask({
          id: 'mixed-container',
          strategy: 'container',
          preserveOnFailure: false // Container with task-level false
        });

        const worktreeTask = createMockTask({
          id: 'mixed-worktree',
          strategy: 'worktree',
          preserveOnFailure: undefined // Worktree using global config (true)
        });

        const directoryTask = createMockTask({
          id: 'mixed-directory',
          strategy: 'directory',
          path: '/tmp/mixed-directory',
          preserveOnFailure: true // Directory with task-level true
        });

        // Emit failures for all tasks
        orchestrator.emit('task:failed', containerTask, new Error('Container failure'));
        orchestrator.emit('task:failed', worktreeTask, new Error('Worktree failure'));
        orchestrator.emit('task:failed', directoryTask, new Error('Directory failure'));

        // Wait for all async operations
        await new Promise(resolve => setTimeout(resolve, 15));

        // Verify cleanup behavior per configuration
        expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('mixed-container'); // Only container should be cleaned up
        expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalledWith('mixed-worktree');
        expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalledWith('mixed-directory');
        expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(1);

        // Verify preservation logs for preserved workspaces
        expect(mockStore.addLog).toHaveBeenCalledWith('mixed-worktree', expect.objectContaining({
          level: 'info',
          message: expect.stringContaining('preserved for debugging')
        }));

        expect(mockStore.addLog).toHaveBeenCalledWith('mixed-directory', expect.objectContaining({
          level: 'info',
          message: expect.stringContaining('preserved for debugging')
        }));

        // Verify preservation console messages
        expect(consoleLogs).toContain('Preserving workspace for failed task mixed-worktree for debugging');
        expect(consoleLogs).toContain('Preserving workspace for failed task mixed-directory for debugging');
      });
    });

    describe('preservation logging works correctly', () => {
      it('should log preservation with correct message format for all strategies', async () => {
        const testCases = [
          {
            id: 'log-container',
            strategy: 'container' as const,
            path: '/var/lib/docker/log-container',
            expectedMessage: 'Workspace preserved for debugging (preserveOnFailure=true). Strategy: container, Path: /var/lib/docker/log-container'
          },
          {
            id: 'log-worktree',
            strategy: 'worktree' as const,
            path: '/project/.apex/worktrees/log-worktree',
            expectedMessage: 'Workspace preserved for debugging (preserveOnFailure=true). Strategy: worktree, Path: /project/.apex/worktrees/log-worktree'
          },
          {
            id: 'log-directory',
            strategy: 'directory' as const,
            path: '/tmp/log-directory',
            expectedMessage: 'Workspace preserved for debugging (preserveOnFailure=true). Strategy: directory, Path: /tmp/log-directory'
          }
        ];

        for (const testCase of testCases) {
          // Reset mocks for each test case
          vi.clearAllMocks();
          consoleLogs.length = 0;

          const task = createMockTask({
            id: testCase.id,
            strategy: testCase.strategy,
            path: testCase.path,
            preserveOnFailure: true
          });

          // Emit task:failed event
          orchestrator.emit('task:failed', task, new Error(`${testCase.strategy} logging test`));
          await new Promise(resolve => setTimeout(resolve, 10));

          // Verify preservation log format
          expect(mockStore.addLog).toHaveBeenCalledWith(testCase.id, {
            level: 'info',
            message: testCase.expectedMessage,
            timestamp: expect.any(Date),
            component: 'workspace-cleanup'
          });

          // Verify console preservation message
          expect(consoleLogs).toContain(`Preserving workspace for failed task ${testCase.id} for debugging`);

          // Verify cleanup was not called
          expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();
        }
      });

      it('should handle logging errors gracefully during preservation', async () => {
        const task = createMockTask({
          id: 'log-error-preserve',
          strategy: 'container',
          preserveOnFailure: true
        });

        // Mock addLog to fail
        vi.mocked(mockStore.addLog).mockRejectedValue(new Error('Database connection lost'));

        // Emit task:failed event
        orchestrator.emit('task:failed', task, new Error('Logging error test'));
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify cleanup was still not called despite logging error
        expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();

        // Verify console preservation message still appeared
        expect(consoleLogs).toContain('Preserving workspace for failed task log-error-preserve for debugging');

        // Verify log attempt was made (even though it failed)
        expect(mockStore.addLog).toHaveBeenCalledWith('log-error-preserve', expect.objectContaining({
          level: 'info',
          message: expect.stringContaining('preserved for debugging')
        }));
      });

      it('should include unknown strategy and path in logs when missing', async () => {
        const taskWithoutPath = createMockTask({
          id: 'log-unknown',
          preserveOnFailure: true
        });
        // Clear path to test unknown handling
        if (taskWithoutPath.workspace) {
          taskWithoutPath.workspace.path = undefined;
          taskWithoutPath.workspace.strategy = undefined as any;
        }

        // Emit task:failed event
        orchestrator.emit('task:failed', taskWithoutPath, new Error('Unknown logging test'));
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify log message includes 'unknown' for missing values
        expect(mockStore.addLog).toHaveBeenCalledWith('log-unknown', {
          level: 'info',
          message: 'Workspace preserved for debugging (preserveOnFailure=true). Strategy: unknown, Path: unknown',
          timestamp: expect.any(Date),
          component: 'workspace-cleanup'
        });

        // Verify console preservation message
        expect(consoleLogs).toContain('Preserving workspace for failed task log-unknown for debugging');
      });

      it('should log preservation message for worktree using global config', async () => {
        // Set global worktree config to preserve=true
        (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = true;

        const task = createMockTask({
          id: 'log-global-worktree',
          strategy: 'worktree',
          path: '/project/.apex/worktrees/global-config',
          preserveOnFailure: undefined // Use global config
        });

        // Emit task:failed event
        orchestrator.emit('task:failed', task, new Error('Global config logging test'));
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify preservation log was created using global config
        expect(mockStore.addLog).toHaveBeenCalledWith('log-global-worktree', {
          level: 'info',
          message: 'Workspace preserved for debugging (preserveOnFailure=true). Strategy: worktree, Path: /project/.apex/worktrees/global-config',
          timestamp: expect.any(Date),
          component: 'workspace-cleanup'
        });

        // Verify console preservation message
        expect(consoleLogs).toContain('Preserving workspace for failed task log-global-worktree for debugging');

        // Verify cleanup was not called
        expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();
      });
    });

    describe('edge cases and error handling', () => {
      it('should handle preservation when global cleanup is disabled', async () => {
        const task = createMockTask({
          id: 'preserve-cleanup-disabled',
          preserveOnFailure: true
        });

        // Disable global cleanup
        (orchestrator as any).effectiveConfig.workspace.cleanupOnComplete = false;

        // Emit task:failed event
        orchestrator.emit('task:failed', task, new Error('Cleanup disabled test'));
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify cleanup was not called (due to global cleanup disabled)
        expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();

        // Verify preservation log was still created
        expect(mockStore.addLog).toHaveBeenCalledWith('preserve-cleanup-disabled', expect.objectContaining({
          level: 'info',
          message: expect.stringContaining('preserved for debugging')
        }));

        // Verify preservation console message
        expect(consoleLogs).toContain('Preserving workspace for failed task preserve-cleanup-disabled for debugging');
      });

      it('should handle non-worktree strategies with global worktree config', async () => {
        // Set global worktree config to preserve=true
        (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = true;

        const containerTask = createMockTask({
          id: 'non-worktree-container',
          strategy: 'container',
          preserveOnFailure: undefined // Global worktree config should not apply
        });

        const directoryTask = createMockTask({
          id: 'non-worktree-directory',
          strategy: 'directory',
          path: '/tmp/non-worktree-dir',
          preserveOnFailure: undefined // Global worktree config should not apply
        });

        // Emit failures
        orchestrator.emit('task:failed', containerTask, new Error('Container test'));
        orchestrator.emit('task:failed', directoryTask, new Error('Directory test'));
        await new Promise(resolve => setTimeout(resolve, 15));

        // Both should be cleaned up since global worktree config doesn't apply to non-worktree strategies
        expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('non-worktree-container');
        expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('non-worktree-directory');
        expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(2);

        // Verify no preservation logs
        expect(mockStore.addLog).not.toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
          level: 'info',
          message: expect.stringContaining('preserved for debugging')
        }));
      });
    });
  });
});