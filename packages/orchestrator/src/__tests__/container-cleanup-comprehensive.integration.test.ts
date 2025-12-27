import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { ApexOrchestrator } from '../index.js';
import { TaskStore } from '../store.js';
import { WorkspaceManager } from '../workspace-manager.js';
import { Task, containerRuntime, ContainerRuntimeType, ContainerManager } from '@apexcli/core';

// Mock dependencies to avoid real database and API calls
vi.mock('../store.js');
vi.mock('../workspace-manager.js');
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn()
}));

/**
 * Test factory for creating container tasks with customizable options
 */
const createContainerTask = (options: {
  id?: string;
  preserveOnFailure?: boolean;
  status?: string;
  workspace?: Partial<Task['workspace']>;
} = {}): Task => ({
  id: options.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  description: 'Container cleanup comprehensive test task',
  status: options.status as any || 'in-progress',
  agent: 'test-agent',
  workflow: 'test-workflow',
  createdAt: new Date(),
  updatedAt: new Date(),
  progress: {
    stage: 'testing',
    stageProgress: 0.5,
    overallProgress: 0.3
  },
  workspace: {
    strategy: 'container',
    path: '/tmp/test-workspace',
    cleanup: true,
    preserveOnFailure: options.preserveOnFailure ?? false,
    container: {
      image: 'alpine:latest',
      autoRemove: false,
      command: ['sleep', '30'],
      environment: {
        TEST_MODE: 'true'
      },
      workingDir: '/workspace'
    },
    ...options.workspace
  },
  usage: { tokens: 100, cost: 0.01 },
  metadata: {
    branch: 'test/container-cleanup',
    test: true
  }
});

describe('Container Cleanup Comprehensive Integration Tests', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: TaskStore;
  let mockWorkspaceManager: WorkspaceManager;
  let containerManager: ContainerManager;
  let runtimeType: ContainerRuntimeType;
  let hasContainerRuntime: boolean;

  beforeAll(async () => {
    // Detect available container runtime
    runtimeType = await containerRuntime.getBestRuntime();
    hasContainerRuntime = runtimeType !== 'none';

    if (hasContainerRuntime) {
      containerManager = new ContainerManager();
    }
  });

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Create comprehensive mock store with all required methods
    mockStore = {
      addLog: vi.fn().mockResolvedValue(undefined),
      getTask: vi.fn().mockImplementation((taskId: string) =>
        Promise.resolve(createContainerTask({ id: taskId }))
      ),
      updateTask: vi.fn().mockResolvedValue(undefined),
      createTask: vi.fn().mockImplementation((task: Partial<Task>) =>
        Promise.resolve({ ...createContainerTask(), ...task })
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
      getContainerManager: vi.fn().mockReturnValue(containerManager),
      getHealthMonitor: vi.fn()
    } as unknown as WorkspaceManager;

    // Create orchestrator with container-focused configuration
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
    // Clean up any test artifacts - using mocks so no actual cleanup needed
  });

  describe('Task Completion Cleanup', () => {
    it('should call workspace cleanup when task completes successfully', async () => {
      const task = createContainerTask({
        id: 'completion-test-001',
        status: 'completed'
      });

      // Emit task completion event (should trigger cleanup)
      orchestrator.emit('task:completed', task);

      // Wait for cleanup to process
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify cleanup was called
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('completion-test-001');
    });

    it('should handle multiple concurrent task completions', async () => {
      const tasks = Array.from({ length: 5 }, (_, i) =>
        createContainerTask({
          id: `concurrent-completion-${i}`,
          status: 'completed'
        })
      );

      // Emit completion events for all tasks
      tasks.forEach(task => {
        orchestrator.emit('task:completed', task);
      });

      // Wait for all cleanups to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify cleanup was called for each task
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(5);
      for (let i = 0; i < 5; i++) {
        expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(`concurrent-completion-${i}`);
      }
    });

    it('should respect cleanupOnComplete configuration', async () => {
      // Create orchestrator with cleanup disabled
      const orchestratorWithoutCleanup = new ApexOrchestrator({
        projectPath: '/integration/test/project',
        config: {
          workspace: {
            cleanupOnComplete: false,
            strategy: 'container'
          }
        }
      });

      // Inject mocked dependencies
      (orchestratorWithoutCleanup as any).store = mockStore;
      (orchestratorWithoutCleanup as any).workspaceManager = mockWorkspaceManager;
      await orchestratorWithoutCleanup.initialize();

      const task = createContainerTask({
        id: 'no-cleanup-test-001'
      });

      // Emit task completion event
      orchestratorWithoutCleanup.emit('task:completed', task);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify cleanup was NOT called
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalledWith('no-cleanup-test-001');
    });

    it('should handle cleanup errors gracefully', async () => {
      const task = createContainerTask({
        id: 'cleanup-error-test-001'
      });

      // Mock cleanup to throw an error
      mockWorkspaceManager.cleanupWorkspace = vi.fn().mockRejectedValue(new Error('Cleanup failed'));

      // Emit task completion event
      orchestrator.emit('task:completed', task);

      // Wait for cleanup to process
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify cleanup was called despite the error
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('cleanup-error-test-001');

      // Verify error was logged
      expect(mockStore.addLog).toHaveBeenCalledWith('cleanup-error-test-001', {
        level: 'warn',
        message: 'Workspace cleanup failed: Cleanup failed',
        timestamp: expect.any(Date),
        component: 'workspace-cleanup'
      });
    });
  });

  describe('Task Failure Cleanup', () => {
    it('should cleanup container when task fails with preserveOnFailure=false', async () => {
      const task = createContainerTask({
        id: 'failure-cleanup-001',
        preserveOnFailure: false
      });

      // Emit task failure event
      const error = new Error('Task execution failed');
      error.name = 'TaskExecutionError';
      orchestrator.emit('task:failed', task, error);

      // Wait for cleanup to process
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify cleanup was called
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('failure-cleanup-001');
    });

    it('should preserve container when task fails with preserveOnFailure=true', async () => {
      const task = createContainerTask({
        id: 'failure-preserve-001',
        preserveOnFailure: true
      });

      // Emit task failure event
      const error = new Error('Task execution failed');
      orchestrator.emit('task:failed', task, error);

      // Wait for preservation logic to process
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify cleanup was NOT called
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalledWith('failure-preserve-001');

      // Verify preservation log was created
      expect(mockStore.addLog).toHaveBeenCalledWith('failure-preserve-001', {
        level: 'info',
        message: 'Workspace preserved for debugging (preserveOnFailure=true). Strategy: container, Path: /tmp/test-workspace',
        timestamp: expect.any(Date),
        component: 'workspace-cleanup'
      });
    });

    it('should handle failure cleanup errors gracefully', async () => {
      const task = createContainerTask({
        id: 'failure-cleanup-error-001',
        preserveOnFailure: false
      });

      // Mock cleanup to throw an error
      mockWorkspaceManager.cleanupWorkspace = vi.fn().mockRejectedValue(new Error('Cleanup failed during failure'));

      // Emit task failure event
      const error = new Error('Task execution failed');
      orchestrator.emit('task:failed', task, error);

      // Wait for cleanup to process
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify cleanup was called despite the error
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('failure-cleanup-error-001');

      // Verify error was logged
      expect(mockStore.addLog).toHaveBeenCalledWith('failure-cleanup-error-001', {
        level: 'warn',
        message: 'Workspace cleanup failed after task failure: Cleanup failed during failure',
        timestamp: expect.any(Date),
        component: 'workspace-cleanup'
      });
    });
  });

  describe('Task Cancellation Cleanup', () => {
    it('should cleanup container when task is cancelled', async () => {
      const task = createContainerTask({
        id: 'cancellation-001',
        status: 'in-progress'
      });

      // Mock the getTask method to return our task
      vi.mocked(mockStore.getTask).mockResolvedValueOnce(task);

      // Cancel the task
      await orchestrator.cancelTask(task.id);

      // Wait for cancellation cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify cleanup was called
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('cancellation-001');
    });

    it('should handle cancellation of multiple tasks', async () => {
      const tasks = Array.from({ length: 3 }, (_, i) =>
        createContainerTask({
          id: `cancellation-${i}`,
          status: 'in-progress'
        })
      );

      // Mock getTask to return the appropriate task
      tasks.forEach(task => {
        vi.mocked(mockStore.getTask).mockImplementation((taskId: string) =>
          taskId === task.id ? Promise.resolve(task) : Promise.resolve(createContainerTask({ id: taskId }))
        );
      });

      // Cancel all tasks
      for (const task of tasks) {
        await orchestrator.cancelTask(task.id);
        // Small delay between cancellations to avoid race conditions
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Wait for all cancellations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify cleanup was called for each task
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(3);
      for (let i = 0; i < 3; i++) {
        expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(`cancellation-${i}`);
      }
    });
  });

  describe('Configuration Hierarchy and Edge Cases', () => {
    it('should respect global preserveOnFailure configuration as fallback', async () => {
      // Create orchestrator with global preserveOnFailure=true
      const orchestratorWithGlobalPreserve = new ApexOrchestrator({
        projectPath: '/integration/test/project',
        config: {
          workspace: {
            cleanupOnComplete: true,
            strategy: 'container'
          },
          git: {
            worktree: {
              preserveOnFailure: true // Global preservation
            }
          }
        }
      });

      // Inject mocked dependencies
      (orchestratorWithGlobalPreserve as any).store = mockStore;
      (orchestratorWithGlobalPreserve as any).workspaceManager = mockWorkspaceManager;
      await orchestratorWithGlobalPreserve.initialize();

      const task = createContainerTask({
        id: 'global-preserve-test-001',
        preserveOnFailure: undefined // Use global config
      });

      // Emit task failure event
      const error = new Error('Task execution failed');
      orchestratorWithGlobalPreserve.emit('task:failed', task, error);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify cleanup was NOT called (preserved due to global config)
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalledWith('global-preserve-test-001');

      // Verify preservation log was created
      expect(mockStore.addLog).toHaveBeenCalledWith('global-preserve-test-001', {
        level: 'info',
        message: 'Workspace preserved for debugging (preserveOnFailure=true). Strategy: container, Path: /tmp/test-workspace',
        timestamp: expect.any(Date),
        component: 'workspace-cleanup'
      });
    });

    it('should handle tasks with no workspace configuration', async () => {
      const task = createContainerTask({
        id: 'no-workspace-test-001',
        workspace: undefined as any
      });

      // Emit task completion event
      orchestrator.emit('task:completed', task);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify cleanup was still called (should handle gracefully)
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('no-workspace-test-001');
    });

    it('should handle tasks with non-container workspace strategy', async () => {
      const task = createContainerTask({
        id: 'worktree-test-001',
        workspace: {
          strategy: 'worktree',
          path: '/tmp/test-worktree',
          cleanup: true
        }
      });

      // Emit task completion event
      orchestrator.emit('task:completed', task);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify cleanup was called regardless of strategy
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('worktree-test-001');
    });
  });

  describe('Event Timing and Race Conditions', () => {
    it('should handle rapid task completion events', async () => {
      const taskCount = 10;
      const tasks = Array.from({ length: taskCount }, (_, i) =>
        createContainerTask({
          id: `rapid-completion-${i}`,
          status: 'completed'
        })
      );

      // Emit all completion events rapidly
      tasks.forEach(task => {
        orchestrator.emit('task:completed', task);
      });

      // Wait for all cleanups to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify cleanup was called for each task
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(taskCount);
      for (let i = 0; i < taskCount; i++) {
        expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(`rapid-completion-${i}`);
      }
    });

    it('should handle mixed completion and failure events', async () => {
      const completedTask = createContainerTask({
        id: 'mixed-completed-001',
        status: 'completed'
      });

      const failedTask = createContainerTask({
        id: 'mixed-failed-001',
        preserveOnFailure: false
      });

      const preservedTask = createContainerTask({
        id: 'mixed-preserved-001',
        preserveOnFailure: true
      });

      // Emit mixed events
      orchestrator.emit('task:completed', completedTask);
      orchestrator.emit('task:failed', failedTask, new Error('Test failure'));
      orchestrator.emit('task:failed', preservedTask, new Error('Test failure with preserve'));

      // Wait for all processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify cleanup was called for completed and failed (non-preserved) tasks
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('mixed-completed-001');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('mixed-failed-001');

      // Verify cleanup was NOT called for preserved task
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalledWith('mixed-preserved-001');

      // Total cleanup calls should be 2 (completed + failed non-preserved)
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Recovery and Robustness', () => {
    it('should continue processing other cleanups if one fails', async () => {
      const successTask = createContainerTask({
        id: 'success-cleanup-001'
      });

      const errorTask = createContainerTask({
        id: 'error-cleanup-001'
      });

      // Mock cleanup to fail for error task but succeed for success task
      mockWorkspaceManager.cleanupWorkspace = vi.fn().mockImplementation((taskId: string) => {
        if (taskId === 'error-cleanup-001') {
          return Promise.reject(new Error('Cleanup failed'));
        }
        return Promise.resolve();
      });

      // Emit completion events
      orchestrator.emit('task:completed', errorTask);
      orchestrator.emit('task:completed', successTask);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify both cleanups were attempted
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('error-cleanup-001');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('success-cleanup-001');

      // Verify error was logged for the failed cleanup
      expect(mockStore.addLog).toHaveBeenCalledWith('error-cleanup-001', {
        level: 'warn',
        message: 'Workspace cleanup failed: Cleanup failed',
        timestamp: expect.any(Date),
        component: 'workspace-cleanup'
      });
    });

    it('should handle workspace manager being unavailable', async () => {
      // Create orchestrator without workspace manager
      const orchestratorWithoutWorkspace = new ApexOrchestrator({
        projectPath: '/integration/test/project',
        config: {
          workspace: {
            cleanupOnComplete: true,
            strategy: 'container'
          }
        }
      });

      // Inject store but leave workspace manager as null/undefined
      (orchestratorWithoutWorkspace as any).store = mockStore;
      (orchestratorWithoutWorkspace as any).workspaceManager = null;
      await orchestratorWithoutWorkspace.initialize();

      const task = createContainerTask({
        id: 'no-workspace-manager-001'
      });

      // This should not throw an error
      expect(() => {
        orchestratorWithoutWorkspace.emit('task:completed', task);
      }).not.toThrow();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // No workspace manager means no cleanup calls, but no errors either
    });
  });
});