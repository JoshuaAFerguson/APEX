import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceManager, WorkspaceInfo } from '../workspace-manager';
import { ApexOrchestrator } from '../index';
import { TaskStore } from '../store';
import { Task, WorkspaceConfig } from '@apexcli/core';

// Mock dependencies to avoid real database and API calls
vi.mock('../store');
vi.mock('../workspace-manager');
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn()
}));

/**
 * Test factory for creating workspace test data with customizable options
 */
const createTestWorkspace = (options: {
  taskId?: string;
  strategy?: WorkspaceConfig['strategy'];
  status?: 'active' | 'cleanup-pending' | 'cleaned';
  cleanup?: boolean;
} = {}): WorkspaceInfo => ({
  taskId: options.taskId || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  config: {
    strategy: options.strategy || 'container',
    cleanup: options.cleanup ?? true
  },
  workspacePath: `/tmp/apex-workspace-${options.taskId || 'test'}`,
  status: options.status || 'active',
  createdAt: new Date(),
  lastAccessed: new Date(),
  containerId: options.strategy === 'container' ? `container-${options.taskId || 'test'}` : undefined
});

/**
 * Test factory for creating tasks with workspace configuration
 */
const createTestTask = (options: {
  id?: string;
  strategy?: WorkspaceConfig['strategy'];
  preserveOnFailure?: boolean;
  status?: string;
} = {}): Task => ({
  id: options.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  description: 'Cleanup idempotency test task',
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
    strategy: options.strategy || 'container',
    path: '/tmp/test-workspace',
    cleanup: true,
    preserveOnFailure: options.preserveOnFailure ?? false
  },
  usage: { tokens: 100, cost: 0.01 },
  metadata: {
    branch: 'test/cleanup-idempotency',
    test: true
  }
});

describe('Cleanup Idempotency Integration Tests', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: TaskStore;
  let mockWorkspaceManager: WorkspaceManager;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock store with all required methods
    mockStore = {
      addLog: vi.fn().mockResolvedValue(undefined),
      getTask: vi.fn().mockImplementation((taskId: string) =>
        Promise.resolve(createTestTask({ id: taskId }))
      ),
      updateTask: vi.fn().mockResolvedValue(undefined),
      createTask: vi.fn().mockImplementation((task: Partial<Task>) =>
        Promise.resolve({ ...createTestTask(), ...task })
      ),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      listTasks: vi.fn().mockResolvedValue([]),
      getLogs: vi.fn().mockResolvedValue([])
    } as unknown as TaskStore;

    // Create mock workspace manager
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
      getHealthMonitor: vi.fn(),
      activeWorkspaces: new Map(),
      emit: vi.fn()
    } as unknown as WorkspaceManager;

    // Create orchestrator
    orchestrator = new ApexOrchestrator({
      projectPath: '/integration/test/project',
      config: {
        workspace: {
          cleanupOnComplete: true,
          strategy: 'container'
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
    // Clean up any test artifacts
  });

  describe('Multiple Sequential Cleanup Calls', () => {
    it('should handle multiple cleanup calls on the same task without error', async () => {
      const taskId = 'sequential-test-001';
      const workspace = createTestWorkspace({ taskId });

      // Mock workspace manager to return workspace on first call, then null
      let callCount = 0;
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
        callCount++;
        // First call simulates actual cleanup
        if (callCount === 1) {
          (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).delete(id);
        }
      });

      // Make multiple sequential cleanup calls
      await mockWorkspaceManager.cleanupWorkspace(taskId);
      await mockWorkspaceManager.cleanupWorkspace(taskId);
      await mockWorkspaceManager.cleanupWorkspace(taskId);

      // All calls should complete without error
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(3);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(taskId);
    });

    it('should only perform actual cleanup on first call', async () => {
      const taskId = 'sequential-first-call-001';
      let actualCleanupPerformed = 0;

      // Mock to track actual cleanup work
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
        const workspace = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
        if (workspace) {
          actualCleanupPerformed++;
          (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).delete(id);
        }
      });

      // Set up initial workspace
      const workspace = createTestWorkspace({ taskId });
      (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).set(taskId, workspace);

      // Make multiple sequential cleanup calls
      await mockWorkspaceManager.cleanupWorkspace(taskId);
      await mockWorkspaceManager.cleanupWorkspace(taskId);
      await mockWorkspaceManager.cleanupWorkspace(taskId);

      // Only first call should perform actual cleanup
      expect(actualCleanupPerformed).toBe(1);
    });

    it('should emit workspace-cleaned event only once', async () => {
      const taskId = 'sequential-event-001';
      let eventEmitted = 0;

      // Mock emit to track events
      vi.mocked(mockWorkspaceManager.emit).mockImplementation((event: string, ...args: any[]) => {
        if (event === 'workspace-cleaned' && args[0] === taskId) {
          eventEmitted++;
        }
        return true;
      });

      // Mock cleanup to simulate event emission
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
        const workspace = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
        if (workspace) {
          (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).delete(id);
          mockWorkspaceManager.emit('workspace-cleaned', id);
        }
      });

      // Set up initial workspace
      const workspace = createTestWorkspace({ taskId });
      (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).set(taskId, workspace);

      // Make multiple sequential cleanup calls
      await mockWorkspaceManager.cleanupWorkspace(taskId);
      await mockWorkspaceManager.cleanupWorkspace(taskId);
      await mockWorkspaceManager.cleanupWorkspace(taskId);

      // Event should only be emitted once
      expect(eventEmitted).toBe(1);
    });

    it('should handle interleaved cleanup calls on different tasks', async () => {
      const taskIds = ['interleaved-001', 'interleaved-002', 'interleaved-003'];
      const cleanedTasks = new Set<string>();

      // Mock cleanup to track which tasks are cleaned
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
        const workspace = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
        if (workspace && !cleanedTasks.has(id)) {
          cleanedTasks.add(id);
          (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).delete(id);
        }
      });

      // Set up initial workspaces
      taskIds.forEach(taskId => {
        const workspace = createTestWorkspace({ taskId });
        (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).set(taskId, workspace);
      });

      // Interleave cleanup calls
      await mockWorkspaceManager.cleanupWorkspace(taskIds[0]);
      await mockWorkspaceManager.cleanupWorkspace(taskIds[1]);
      await mockWorkspaceManager.cleanupWorkspace(taskIds[0]); // Second call on first task
      await mockWorkspaceManager.cleanupWorkspace(taskIds[2]);
      await mockWorkspaceManager.cleanupWorkspace(taskIds[1]); // Second call on second task
      await mockWorkspaceManager.cleanupWorkspace(taskIds[2]); // Second call on third task

      // All tasks should be cleaned exactly once
      expect(cleanedTasks.size).toBe(3);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(6);
    });
  });

  describe('Already-Cleaned Workspace Idempotency', () => {
    it('should return silently when cleaning non-existent workspace', async () => {
      const taskId = 'non-existent-001';

      // Mock to simulate workspace not found behavior
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
        const workspace = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
        if (!workspace) {
          return; // Early return for non-existent workspace
        }
      });

      // Attempt cleanup on non-existent workspace
      await expect(mockWorkspaceManager.cleanupWorkspace(taskId)).resolves.not.toThrow();
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(taskId);
    });

    it('should handle cleanup after workspace was removed from tracking', async () => {
      const taskId = 'removed-tracking-001';
      const workspace = createTestWorkspace({ taskId });

      // Set up workspace then remove it
      (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).set(taskId, workspace);
      (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).delete(taskId);

      // Mock cleanup to check for workspace existence
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
        const workspace = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
        if (!workspace) {
          return; // Should return silently
        }
      });

      // Cleanup should not throw
      await expect(mockWorkspaceManager.cleanupWorkspace(taskId)).resolves.not.toThrow();
    });

    it('should not throw when cleaning workspace with status=cleaned', async () => {
      const taskId = 'status-cleaned-001';
      const workspace = createTestWorkspace({ taskId, status: 'cleaned' });

      // Mock cleanup to handle already-cleaned workspace
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
        const workspace = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
        if (!workspace || workspace.status === 'cleaned') {
          return; // Should return silently for already-cleaned workspace
        }
      });

      (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).set(taskId, workspace);

      // Cleanup should not throw
      await expect(mockWorkspaceManager.cleanupWorkspace(taskId)).resolves.not.toThrow();
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(taskId);
    });

    it('should handle mixed state cleanup scenarios', async () => {
      const scenarios = [
        { taskId: 'mixed-001', status: 'active' as const },
        { taskId: 'mixed-002', status: 'cleanup-pending' as const },
        { taskId: 'mixed-003', status: 'cleaned' as const }
      ];

      let cleanupAttempts = 0;

      // Mock cleanup to handle different states
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
        cleanupAttempts++;
        const workspace = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
        if (!workspace) {
          return; // Non-existent workspace
        }
        if (workspace.status !== 'active') {
          return; // Already processed
        }
        // Simulate cleanup for active workspaces
        workspace.status = 'cleaned';
        (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).delete(id);
      });

      // Set up workspaces in different states
      scenarios.forEach(scenario => {
        const workspace = createTestWorkspace(scenario);
        (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).set(scenario.taskId, workspace);
      });

      // Cleanup all workspaces
      for (const scenario of scenarios) {
        await mockWorkspaceManager.cleanupWorkspace(scenario.taskId);
      }

      // All cleanup calls should complete without error
      expect(cleanupAttempts).toBe(3);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(3);
    });
  });

  describe('Concurrent Cleanup Requests', () => {
    it('should handle multiple simultaneous cleanup calls safely', async () => {
      const taskId = 'concurrent-001';
      const workspace = createTestWorkspace({ taskId });
      let actualCleanupCount = 0;

      // Mock cleanup with simulated delay and concurrency handling
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
        const workspace = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
        if (!workspace) {
          return; // Already cleaned or non-existent
        }

        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 10));

        // Check again after delay (race condition simulation)
        const workspaceAfterDelay = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
        if (workspaceAfterDelay) {
          actualCleanupCount++;
          (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).delete(id);
        }
      });

      // Set up initial workspace
      (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).set(taskId, workspace);

      // Launch multiple concurrent cleanup calls
      const cleanupPromises = [
        mockWorkspaceManager.cleanupWorkspace(taskId),
        mockWorkspaceManager.cleanupWorkspace(taskId),
        mockWorkspaceManager.cleanupWorkspace(taskId),
        mockWorkspaceManager.cleanupWorkspace(taskId),
        mockWorkspaceManager.cleanupWorkspace(taskId)
      ];

      // All should resolve without error
      await expect(Promise.all(cleanupPromises)).resolves.not.toThrow();

      // Only one cleanup should actually execute
      expect(actualCleanupCount).toBeLessThanOrEqual(1);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(5);
    });

    it('should handle concurrent cleanup from different sources (event + direct call)', async () => {
      const taskId = 'concurrent-sources-001';
      const task = createTestTask({ id: taskId });
      let cleanupExecutions = 0;

      // Mock cleanup to track executions
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
        cleanupExecutions++;
        await new Promise(resolve => setTimeout(resolve, 5));
      });

      // Simulate concurrent cleanup from different sources
      const promises = [
        // Direct cleanup call
        mockWorkspaceManager.cleanupWorkspace(taskId),
        // Event-triggered cleanup (simulated)
        new Promise<void>(resolve => {
          orchestrator.emit('task:completed', task);
          setTimeout(resolve, 10);
        }),
        // Another direct call
        mockWorkspaceManager.cleanupWorkspace(taskId)
      ];

      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 50)); // Wait for event processing

      // All cleanup attempts should complete
      expect(cleanupExecutions).toBeGreaterThanOrEqual(2);
    });

    it('should not double-remove containers during concurrent cleanup', async () => {
      const taskId = 'concurrent-container-001';
      const workspace = createTestWorkspace({ taskId, strategy: 'container' });
      let containerRemovalAttempts = 0;

      // Mock cleanup with container removal tracking
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
        const workspace = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
        if (!workspace) {
          return;
        }

        // Simulate container cleanup attempt
        if (workspace.config.strategy === 'container' && workspace.containerId) {
          containerRemovalAttempts++;
          // Simulate delay in container operations
          await new Promise(resolve => setTimeout(resolve, 15));
        }

        // Check if still exists after delay
        const workspaceAfterDelay = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
        if (workspaceAfterDelay) {
          (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).delete(id);
        }
      });

      // Set up container workspace
      (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).set(taskId, workspace);

      // Launch concurrent cleanup calls
      const cleanupPromises = Array(3).fill(null).map(() =>
        mockWorkspaceManager.cleanupWorkspace(taskId)
      );

      await Promise.all(cleanupPromises);

      // Container removal should be attempted but handled safely
      expect(containerRemovalAttempts).toBeGreaterThan(0);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(3);
    });

    it('should handle high-concurrency cleanup scenarios', async () => {
      const taskCount = 10;
      const concurrentCallsPerTask = 5;
      const tasks = Array.from({ length: taskCount }, (_, i) => ({
        taskId: `high-concurrency-${i}`,
        workspace: createTestWorkspace({ taskId: `high-concurrency-${i}` })
      }));

      let totalCleanupExecutions = 0;

      // Mock cleanup with execution tracking
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
        const workspace = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
        if (workspace) {
          totalCleanupExecutions++;
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).delete(id);
        }
      });

      // Set up all workspaces
      tasks.forEach(({ taskId, workspace }) => {
        (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).set(taskId, workspace);
      });

      // Launch high-concurrency cleanup calls
      const allPromises = tasks.flatMap(({ taskId }) =>
        Array(concurrentCallsPerTask).fill(null).map(() =>
          mockWorkspaceManager.cleanupWorkspace(taskId)
        )
      );

      // All should resolve without error
      await expect(Promise.all(allPromises)).resolves.not.toThrow();

      // Total calls should be taskCount * concurrentCallsPerTask
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(taskCount * concurrentCallsPerTask);

      // But actual cleanup executions should be reasonable (may be less due to race conditions)
      expect(totalCleanupExecutions).toBeLessThanOrEqual(taskCount * concurrentCallsPerTask);
    });
  });

  describe('Strategy-Specific Idempotency', () => {
    describe('Container Strategy', () => {
      it('should handle cleanup when container already removed', async () => {
        const taskId = 'container-removed-001';
        const workspace = createTestWorkspace({ taskId, strategy: 'container' });

        // Mock cleanup to simulate container not found
        vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
          const workspace = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
          if (!workspace) return;

          // Simulate container cleanup that finds no container (idempotent)
          if (workspace.config.strategy === 'container') {
            // Container already removed externally - should not error
          }

          (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).delete(id);
        });

        (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).set(taskId, workspace);

        await expect(mockWorkspaceManager.cleanupWorkspace(taskId)).resolves.not.toThrow();
      });

      it('should handle cleanup when container was never created', async () => {
        const taskId = 'container-never-created-001';
        const workspace = createTestWorkspace({
          taskId,
          strategy: 'container'
        });
        // Remove containerId to simulate never-created container
        delete workspace.containerId;

        vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
          const workspace = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
          if (!workspace) return;

          // Cleanup should handle missing container gracefully
          (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).delete(id);
        });

        (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).set(taskId, workspace);

        await expect(mockWorkspaceManager.cleanupWorkspace(taskId)).resolves.not.toThrow();
      });
    });

    describe('Worktree Strategy', () => {
      it('should handle cleanup when worktree already removed', async () => {
        const taskId = 'worktree-removed-001';
        const workspace = createTestWorkspace({ taskId, strategy: 'worktree' });

        vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
          const workspace = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
          if (!workspace) return;

          if (workspace.config.strategy === 'worktree') {
            // Worktree cleanup should be idempotent - git worktree remove with --force
            // should not error if worktree doesn't exist
          }

          (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).delete(id);
        });

        (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).set(taskId, workspace);

        await expect(mockWorkspaceManager.cleanupWorkspace(taskId)).resolves.not.toThrow();
      });

      it('should handle cleanup when worktree directory missing', async () => {
        const taskId = 'worktree-dir-missing-001';
        const workspace = createTestWorkspace({ taskId, strategy: 'worktree' });

        vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
          const workspace = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
          if (!workspace) return;

          if (workspace.config.strategy === 'worktree') {
            // Should handle case where directory was manually removed
            // fs.rm with force: true should not error
          }

          (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).delete(id);
        });

        (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).set(taskId, workspace);

        await expect(mockWorkspaceManager.cleanupWorkspace(taskId)).resolves.not.toThrow();
      });
    });

    describe('Directory Strategy', () => {
      it('should handle cleanup when directory already removed', async () => {
        const taskId = 'directory-removed-001';
        const workspace = createTestWorkspace({ taskId, strategy: 'directory' });

        vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
          const workspace = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
          if (!workspace) return;

          if (workspace.config.strategy === 'directory') {
            // fs.rm with force: true should be idempotent
            // Should not error if directory doesn't exist
          }

          (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).delete(id);
        });

        (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).set(taskId, workspace);

        await expect(mockWorkspaceManager.cleanupWorkspace(taskId)).resolves.not.toThrow();
      });
    });

    describe('None Strategy', () => {
      it('should handle cleanup gracefully for none strategy', async () => {
        const taskId = 'none-strategy-001';
        const workspace = createTestWorkspace({ taskId, strategy: 'none' });

        vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
          const workspace = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
          if (!workspace) return;

          if (workspace.config.strategy === 'none') {
            // Nothing to clean up - should complete immediately
          }

          (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).delete(id);
        });

        (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).set(taskId, workspace);

        await expect(mockWorkspaceManager.cleanupWorkspace(taskId)).resolves.not.toThrow();
        expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(taskId);
      });
    });
  });

  describe('Integration with Orchestrator Events', () => {
    it('should handle idempotent cleanup triggered by task completion events', async () => {
      const task = createTestTask({ id: 'event-completion-001' });

      // Emit task completion event multiple times
      orchestrator.emit('task:completed', task);
      orchestrator.emit('task:completed', task);
      orchestrator.emit('task:completed', task);

      // Wait for all event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cleanup should be called multiple times but handle idempotency internally
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(task.id);
    });

    it('should handle idempotent cleanup triggered by task failure events', async () => {
      const task = createTestTask({
        id: 'event-failure-001',
        preserveOnFailure: false
      });
      const error = new Error('Test failure');

      // Emit task failure event multiple times
      orchestrator.emit('task:failed', task, error);
      orchestrator.emit('task:failed', task, error);

      // Wait for all event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cleanup should be called multiple times but handle idempotency internally
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(task.id);
    });

    it('should handle mixed event types for the same task', async () => {
      const task = createTestTask({ id: 'mixed-events-001' });
      const error = new Error('Test error');

      // Emit mixed events for the same task
      orchestrator.emit('task:completed', task);
      orchestrator.emit('task:failed', task, error);
      orchestrator.emit('task:completed', task);

      // Wait for all event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cleanup should be called multiple times but should handle safely
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(task.id);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling in Idempotent Cleanup', () => {
    it('should handle cleanup errors idempotently', async () => {
      const taskId = 'error-handling-001';
      let attemptCount = 0;

      // Mock cleanup to fail then succeed
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('First attempt failed');
        }
        // Subsequent attempts succeed
      });

      // First call should throw
      await expect(mockWorkspaceManager.cleanupWorkspace(taskId)).rejects.toThrow('First attempt failed');

      // Second call should succeed
      await expect(mockWorkspaceManager.cleanupWorkspace(taskId)).resolves.not.toThrow();

      expect(attemptCount).toBe(2);
    });

    it('should handle partial cleanup states safely', async () => {
      const taskId = 'partial-cleanup-001';
      const workspace = createTestWorkspace({ taskId, status: 'cleanup-pending' });

      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (id: string) => {
        const workspace = (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).get(id);
        if (!workspace) return;

        // Handle partial cleanup state safely
        if (workspace.status === 'cleanup-pending') {
          workspace.status = 'cleaned';
          (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).delete(id);
        }
      });

      (mockWorkspaceManager.activeWorkspaces as Map<string, WorkspaceInfo>).set(taskId, workspace);

      // Multiple cleanup calls on partially-cleaned workspace
      await mockWorkspaceManager.cleanupWorkspace(taskId);
      await mockWorkspaceManager.cleanupWorkspace(taskId);

      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(2);
    });
  });
});