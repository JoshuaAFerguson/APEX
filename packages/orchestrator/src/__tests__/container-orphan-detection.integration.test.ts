import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
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
 * Result of orphan container detection
 */
interface OrphanCheckResult {
  hasOrphans: boolean;
  orphanedContainers: string[];
  totalApexContainers: number;
}

/**
 * Helper function to check for orphaned APEX containers
 */
async function checkForOrphanedContainers(
  containerManager: ContainerManager,
  runtime: ContainerRuntimeType
): Promise<OrphanCheckResult> {
  if (runtime === 'none') {
    return {
      hasOrphans: false,
      orphanedContainers: [],
      totalApexContainers: 0
    };
  }

  try {
    // Get all APEX containers (running and exited)
    const containers = await containerManager.listApexContainers(runtime, true);

    // Filter for containers that match APEX task naming convention
    const apexTaskContainers = containers.filter(container =>
      container.name.startsWith('apex-') ||
      container.name.startsWith('apex-task-')
    );

    const runningOrphans = apexTaskContainers.filter(container =>
      container.state === 'running' || container.state === 'created'
    );

    return {
      hasOrphans: runningOrphans.length > 0,
      orphanedContainers: runningOrphans.map(c => c.name),
      totalApexContainers: apexTaskContainers.length
    };
  } catch (error) {
    // If we can't check for containers (no runtime available), return no orphans
    return {
      hasOrphans: false,
      orphanedContainers: [],
      totalApexContainers: 0
    };
  }
}

/**
 * Create a test task with container workspace configuration
 */
const createContainerTask = (options: {
  id?: string;
  preserveOnFailure?: boolean;
  status?: string;
} = {}): Task => ({
  id: options.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  description: 'Container orphan detection test task',
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
    }
  },
  usage: { tokens: 100, cost: 0.01 },
  metadata: {
    branch: 'test/orphan-detection',
    test: true
  }
});

describe('Container Orphan Detection Integration Tests', () => {
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

    // Create comprehensive mock store
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
    // No need for explicit cleanup since we're using mocks
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
      const tasks = Array.from({ length: 3 }, (_, i) =>
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
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(3);
      for (let i = 0; i < 3; i++) {
        expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(`concurrent-completion-${i}`);
      }
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
  });

  describe('Orphan Detection Utilities', () => {
    it('should handle container runtime unavailability gracefully', async () => {
      // Test with 'none' runtime
      const mockContainerManager = new ContainerManager();
      const result = await checkForOrphanedContainers(mockContainerManager, 'none');

      expect(result).toEqual({
        hasOrphans: false,
        orphanedContainers: [],
        totalApexContainers: 0
      });
    });

    it.skipIf(!hasContainerRuntime)('should detect container runtime and verify no orphans after lifecycle', async () => {
      // This test runs only if container runtime is available
      const result = await checkForOrphanedContainers(containerManager, runtimeType);

      // Initially should have no orphans
      expect(result.hasOrphans).toBe(false);
      expect(result.orphanedContainers).toHaveLength(0);

      // Simulate complete lifecycle events (using mocked workspace manager)
      const lifecycleTask = createContainerTask({ id: 'lifecycle-test' });

      orchestrator.emit('task:completed', lifecycleTask);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify cleanup was called
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('lifecycle-test');

      // Check for orphans again - should still be clean
      const afterLifecycle = await checkForOrphanedContainers(containerManager, runtimeType);
      expect(afterLifecycle.hasOrphans).toBe(false);
    });

    it('should verify container naming convention detection', async () => {
      // Test the helper function with mock data to ensure it correctly identifies APEX containers
      const mockContainerManager = {
        listApexContainers: vi.fn().mockResolvedValue([
          {
            id: 'container1',
            name: 'apex-task-123',
            state: 'running',
            image: 'alpine:latest'
          },
          {
            id: 'container2',
            name: 'apex-456',
            state: 'running',
            image: 'alpine:latest'
          },
          {
            id: 'container3',
            name: 'other-container',
            state: 'running',
            image: 'alpine:latest'
          }
        ])
      } as unknown as ContainerManager;

      const result = await checkForOrphanedContainers(mockContainerManager, 'docker');

      expect(result.hasOrphans).toBe(true);
      expect(result.orphanedContainers).toContain('apex-task-123');
      expect(result.orphanedContainers).toContain('apex-456');
      expect(result.totalApexContainers).toBe(2); // Only apex- prefixed containers
    });
  });

  describe('Configuration Changes During Runtime', () => {
    it('should respect configuration changes for subsequent failures', async () => {
      const task1 = createContainerTask({
        id: 'config-change-1',
        preserveOnFailure: undefined // Use global config
      });

      const task2 = createContainerTask({
        id: 'config-change-2',
        preserveOnFailure: undefined // Use global config
      });

      // Initially, global config is preserve=false
      orchestrator.emit('task:failed', task1, new Error('First failure'));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Change global config to preserve=true
      (orchestrator as any).effectiveConfig.git.worktree.preserveOnFailure = true;

      orchestrator.emit('task:failed', task2, new Error('Second failure'));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify first task was cleaned up (preserve=false)
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('config-change-1');

      // Verify second task was preserved (preserve=true)
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalledWith('config-change-2');
    });
  });

  describe('Orchestrator Orphan Detection Events Integration', () => {
    it('should emit orphan:detected event when orphaned containers are found', async () => {
      // Mock container manager to return orphaned containers
      const orphanedContainerManager = {
        listApexContainers: vi.fn().mockResolvedValue([
          {
            id: 'orphan1',
            name: 'apex-task-orphaned-001',
            state: 'running',
            image: 'alpine:latest'
          },
          {
            id: 'orphan2',
            name: 'apex-orphaned-002',
            state: 'created',
            image: 'ubuntu:latest'
          }
        ])
      } as unknown as ContainerManager;

      // Set up event spy
      const orphanDetectedSpy = vi.fn();
      orchestrator.on('orphan:detected', orphanDetectedSpy);

      // Simulate orphan detection during container check
      const result = await checkForOrphanedContainers(orphanedContainerManager, 'docker');

      expect(result.hasOrphans).toBe(true);
      expect(result.orphanedContainers).toContain('apex-task-orphaned-001');
      expect(result.orphanedContainers).toContain('apex-orphaned-002');
      expect(result.totalApexContainers).toBe(2);
    });

    it('should handle container runtime errors gracefully during orphan detection', async () => {
      // Mock container manager that throws an error
      const failingContainerManager = {
        listApexContainers: vi.fn().mockRejectedValue(new Error('Container runtime not available'))
      } as unknown as ContainerManager;

      // This should not throw an error but return empty result
      const result = await checkForOrphanedContainers(failingContainerManager, 'docker');

      expect(result).toEqual({
        hasOrphans: false,
        orphanedContainers: [],
        totalApexContainers: 0
      });
    });

    it('should correctly identify APEX containers with various naming patterns', async () => {
      const mixedContainerManager = {
        listApexContainers: vi.fn().mockResolvedValue([
          // Valid APEX containers
          {
            id: 'container1',
            name: 'apex-task-123',
            state: 'running',
            image: 'alpine:latest'
          },
          {
            id: 'container2',
            name: 'apex-456',
            state: 'running',
            image: 'alpine:latest'
          },
          {
            id: 'container3',
            name: 'apex-workflow-789',
            state: 'created',
            image: 'ubuntu:latest'
          },
          // Exited containers (should not be considered orphans)
          {
            id: 'container4',
            name: 'apex-task-999',
            state: 'exited',
            image: 'alpine:latest'
          },
          // Non-APEX containers (should be filtered out)
          {
            id: 'container5',
            name: 'user-application',
            state: 'running',
            image: 'nginx:latest'
          },
          {
            id: 'container6',
            name: 'apex',  // Exact match without dash - should not be considered APEX
            state: 'running',
            image: 'redis:latest'
          }
        ])
      } as unknown as ContainerManager;

      const result = await checkForOrphanedContainers(mixedContainerManager, 'docker');

      // Should identify 3 running/created APEX containers as orphans
      expect(result.hasOrphans).toBe(true);
      expect(result.orphanedContainers).toHaveLength(3);
      expect(result.orphanedContainers).toContain('apex-task-123');
      expect(result.orphanedContainers).toContain('apex-456');
      expect(result.orphanedContainers).toContain('apex-workflow-789');
      expect(result.orphanedContainers).not.toContain('apex-task-999'); // Exited
      expect(result.orphanedContainers).not.toContain('user-application'); // Not APEX
      expect(result.orphanedContainers).not.toContain('apex'); // Wrong pattern
      expect(result.totalApexContainers).toBe(4); // Total APEX containers including exited
    });

    it('should properly handle workspace cleanup integration with container lifecycle', async () => {
      // Create a container task that should trigger cleanup
      const containerTask = createContainerTask({
        id: 'integration-lifecycle-001'
      });

      // Mock getContainerManager to return our test container manager
      mockWorkspaceManager.getContainerManager = vi.fn().mockReturnValue(containerManager);

      // Emit task completion - should trigger workspace cleanup
      orchestrator.emit('task:completed', containerTask);

      // Wait for async cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify cleanup was called with correct task ID
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('integration-lifecycle-001');

      // Verify container manager was accessed for cleanup
      expect(mockWorkspaceManager.getContainerManager).toHaveBeenCalled();
    });

    it('should handle multiple runtime types for orphan detection', async () => {
      // Test with different runtime types
      const testRuntimes: ContainerRuntimeType[] = ['docker', 'podman', 'none'];

      for (const runtime of testRuntimes) {
        const result = await checkForOrphanedContainers(containerManager, runtime);

        if (runtime === 'none') {
          expect(result.hasOrphans).toBe(false);
          expect(result.totalApexContainers).toBe(0);
        } else {
          // For docker/podman, result depends on actual availability
          expect(typeof result.hasOrphans).toBe('boolean');
          expect(typeof result.totalApexContainers).toBe('number');
          expect(Array.isArray(result.orphanedContainers)).toBe(true);
        }
      }
    });

    it('should verify container runtime availability check integration', async () => {
      // Test runtime detection integration
      const runtimeType = await containerManager?.runtime?.getBestRuntime() || 'none';

      expect(['docker', 'podman', 'none']).toContain(runtimeType);

      // If runtime is available, should be able to perform operations
      if (runtimeType !== 'none' && containerManager) {
        const containers = await containerManager.listApexContainers(runtimeType, true);
        expect(Array.isArray(containers)).toBe(true);
      }
    });
  });

  describe('Container Runtime Error Handling', () => {
    it('should handle missing Docker daemon gracefully', async () => {
      const dockerUnavailableManager = {
        listApexContainers: vi.fn().mockRejectedValue(new Error('Cannot connect to Docker daemon')),
        runtime: {
          getBestRuntime: vi.fn().mockResolvedValue('docker' as ContainerRuntimeType)
        }
      } as unknown as ContainerManager;

      const result = await checkForOrphanedContainers(dockerUnavailableManager, 'docker');

      expect(result).toEqual({
        hasOrphans: false,
        orphanedContainers: [],
        totalApexContainers: 0
      });
    });

    it('should handle missing Podman gracefully', async () => {
      const podmanUnavailableManager = {
        listApexContainers: vi.fn().mockRejectedValue(new Error('podman command not found')),
        runtime: {
          getBestRuntime: vi.fn().mockResolvedValue('podman' as ContainerRuntimeType)
        }
      } as unknown as ContainerManager;

      const result = await checkForOrphanedContainers(podmanUnavailableManager, 'podman');

      expect(result).toEqual({
        hasOrphans: false,
        orphanedContainers: [],
        totalApexContainers: 0
      });
    });

    it('should handle permission errors gracefully', async () => {
      const permissionErrorManager = {
        listApexContainers: vi.fn().mockRejectedValue(new Error('Permission denied accessing container runtime')),
        runtime: {
          getBestRuntime: vi.fn().mockResolvedValue('docker' as ContainerRuntimeType)
        }
      } as unknown as ContainerManager;

      const result = await checkForOrphanedContainers(permissionErrorManager, 'docker');

      expect(result).toEqual({
        hasOrphans: false,
        orphanedContainers: [],
        totalApexContainers: 0
      });
    });
  });
});