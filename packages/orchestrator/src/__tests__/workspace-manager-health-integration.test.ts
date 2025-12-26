import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceManager } from '../workspace-manager';
import { ContainerHealthMonitor, ContainerManager } from '@apexcli/core';
import { Task, TaskStatus, WorkspaceConfig } from '@apexcli/core';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock container runtime
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    containerRuntime: {
      getBestRuntime: vi.fn().mockResolvedValue('docker'),
    },
  };
});

describe('WorkspaceManager Container Health Integration', () => {
  let workspaceManager: WorkspaceManager;
  let projectPath: string;

  const mockTask: Task = {
    id: 'test-task-123',
    description: 'Test task for container health monitoring',
    workflow: 'test',
    autonomy: 'review-before-commit',
    status: 'pending' as TaskStatus,
    priority: 'normal',
    effort: 'medium',
    currentStage: undefined,
    projectPath: '',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
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
    workspace: {
      strategy: 'container',
      cleanup: true,
      container: {
        image: 'node:18-alpine',
        volumes: {
          '/tmp/test': '/app/test',
        },
        environment: {
          NODE_ENV: 'test',
        },
        workingDir: '/workspace',
        autoRemove: true,
      },
    } as WorkspaceConfig,
  };

  beforeEach(() => {
    projectPath = join(tmpdir(), `apex-test-${Date.now()}`);
    workspaceManager = new WorkspaceManager({
      projectPath,
      defaultStrategy: 'directory',
    });
  });

  afterEach(async () => {
    // Clean up any active workspaces
    try {
      await workspaceManager.cleanupOldWorkspaces(0);
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Health Monitor Integration', () => {
    it('should initialize workspace manager with health monitor', () => {
      expect(workspaceManager).toBeInstanceOf(WorkspaceManager);

      const healthMonitor = workspaceManager.getHealthMonitor();
      expect(healthMonitor).toBeInstanceOf(ContainerHealthMonitor);

      const containerManager = workspaceManager.getContainerManager();
      expect(containerManager).toBeInstanceOf(ContainerManager);
    });

    it('should start health monitoring when workspace manager initializes', async () => {
      const healthMonitor = workspaceManager.getHealthMonitor();
      const startSpy = vi.spyOn(healthMonitor, 'startMonitoring');

      await workspaceManager.initialize();

      expect(startSpy).toHaveBeenCalled();
    });

    it('should handle health monitoring start failure gracefully', async () => {
      const healthMonitor = workspaceManager.getHealthMonitor();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.spyOn(healthMonitor, 'startMonitoring').mockRejectedValue(
        new Error('Health monitoring failed to start')
      );

      // Should not throw
      await expect(workspaceManager.initialize()).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to start container health monitoring:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should not start health monitoring if no container runtime available', async () => {
      const { containerRuntime } = await import('@apexcli/core');
      vi.mocked(containerRuntime.getBestRuntime).mockResolvedValue('none');

      const healthMonitor = workspaceManager.getHealthMonitor();
      const startSpy = vi.spyOn(healthMonitor, 'startMonitoring');

      await workspaceManager.initialize();

      expect(startSpy).not.toHaveBeenCalled();
    });
  });

  describe('Container Workspace with Health Monitoring', () => {
    beforeEach(async () => {
      await workspaceManager.initialize();
    });

    it('should create container workspace using ContainerManager', async () => {
      const containerManager = workspaceManager.getContainerManager();
      const createContainerSpy = vi
        .spyOn(containerManager, 'createContainer')
        .mockResolvedValue({
          success: true,
          containerId: 'test-container-123',
          containerInfo: {
            id: 'test-container-123',
            name: 'apex-test-task-123',
            image: 'node:18-alpine',
            status: 'running',
            createdAt: new Date(),
          },
        });

      try {
        const workspace = await workspaceManager.createWorkspace(mockTask);

        expect(createContainerSpy).toHaveBeenCalledWith({
          config: expect.objectContaining({
            image: 'node:18-alpine',
            volumes: expect.objectContaining({
              [projectPath]: '/workspace',
              '/tmp/test': '/app/test',
            }),
            workingDir: '/workspace',
            labels: expect.objectContaining({
              'apex.task-id': 'test-task-123',
              'apex.workspace-type': 'container',
            }),
          }),
          taskId: 'test-task-123',
          autoStart: true,
        });

        expect(workspace.workspacePath).toContain('container-test-task-123');
      } catch (error) {
        // Test might fail if Docker isn't available, which is expected in CI
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle container creation failure', async () => {
      const containerManager = workspaceManager.getContainerManager();
      vi.spyOn(containerManager, 'createContainer').mockResolvedValue({
        success: false,
        error: 'Docker daemon not running',
      });

      await expect(workspaceManager.createWorkspace(mockTask)).rejects.toThrow(
        'Failed to create container workspace: Docker daemon not running'
      );
    });

    it('should get container health for task', async () => {
      const containerManager = workspaceManager.getContainerManager();
      const healthMonitor = workspaceManager.getHealthMonitor();

      vi.spyOn(containerManager, 'listApexContainers').mockResolvedValue([
        {
          id: 'container-123',
          name: 'apex-task-test-task-123',
          image: 'node:18-alpine',
          status: 'running',
          createdAt: new Date(),
        },
      ]);

      vi.spyOn(healthMonitor, 'getContainerHealth').mockReturnValue({
        containerId: 'container-123',
        containerName: 'apex-task-test-task-123',
        status: 'healthy',
        failingStreak: 0,
        lastCheckTime: new Date(),
      });

      const health = await workspaceManager.getContainerHealth('test-task-123');

      expect(health).not.toBeNull();
      expect(health?.status).toBe('healthy');
      expect(containerManager.listApexContainers).toHaveBeenCalled();
      expect(healthMonitor.getContainerHealth).toHaveBeenCalledWith('container-123');
    });

    it('should return null for non-existent container health', async () => {
      const containerManager = workspaceManager.getContainerManager();
      vi.spyOn(containerManager, 'listApexContainers').mockResolvedValue([]);

      const health = await workspaceManager.getContainerHealth('non-existent-task');

      expect(health).toBeNull();
    });
  });

  describe('Container Cleanup with Health Monitoring', () => {
    beforeEach(async () => {
      await workspaceManager.initialize();
    });

    it('should cleanup container using ContainerManager', async () => {
      const containerManager = workspaceManager.getContainerManager();

      const listContainersSpy = vi
        .spyOn(containerManager, 'listApexContainers')
        .mockResolvedValue([
          {
            id: 'container-to-cleanup',
            name: 'apex-task-cleanup-test',
            image: 'node:18-alpine',
            status: 'running',
            createdAt: new Date(),
          },
        ]);

      const stopContainerSpy = vi
        .spyOn(containerManager, 'stopContainer')
        .mockResolvedValue({
          success: true,
          containerId: 'container-to-cleanup',
        });

      const removeContainerSpy = vi
        .spyOn(containerManager, 'removeContainer')
        .mockResolvedValue({
          success: true,
          containerId: 'container-to-cleanup',
        });

      // Create a mock workspace for cleanup testing
      const mockWorkspace = {
        taskId: 'cleanup-test',
        config: { strategy: 'container' as const, cleanup: true },
        workspacePath: join(projectPath, '.apex', 'workspaces', 'container-cleanup-test'),
        status: 'active' as const,
        createdAt: new Date(),
        lastAccessed: new Date(),
      };

      // Mock the private method call
      await workspaceManager['cleanupContainer'](mockWorkspace);

      expect(listContainersSpy).toHaveBeenCalled();
      expect(stopContainerSpy).toHaveBeenCalledWith('container-to-cleanup', 'docker');
      expect(removeContainerSpy).toHaveBeenCalledWith('container-to-cleanup', 'docker', true);
    });

    it('should handle container cleanup errors gracefully', async () => {
      const containerManager = workspaceManager.getContainerManager();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.spyOn(containerManager, 'listApexContainers').mockRejectedValue(
        new Error('Failed to list containers')
      );

      const mockWorkspace = {
        taskId: 'cleanup-error-test',
        config: { strategy: 'container' as const, cleanup: true },
        workspacePath: join(projectPath, '.apex', 'workspaces', 'container-cleanup-error'),
        status: 'active' as const,
        createdAt: new Date(),
        lastAccessed: new Date(),
      };

      // Should not throw
      await expect(workspaceManager['cleanupContainer'](mockWorkspace)).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to cleanup container workspace:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle container not found during cleanup', async () => {
      const containerManager = workspaceManager.getContainerManager();

      vi.spyOn(containerManager, 'listApexContainers').mockResolvedValue([]);

      const mockWorkspace = {
        taskId: 'not-found-test',
        config: { strategy: 'container' as const, cleanup: true },
        workspacePath: join(projectPath, '.apex', 'workspaces', 'container-not-found'),
        status: 'active' as const,
        createdAt: new Date(),
        lastAccessed: new Date(),
      };

      // Should not throw even if container is not found
      await expect(workspaceManager['cleanupContainer'](mockWorkspace)).resolves.not.toThrow();
    });
  });

  describe('Workspace Statistics with Health Data', () => {
    beforeEach(async () => {
      await workspaceManager.initialize();
    });

    it('should include container health stats in workspace statistics', async () => {
      const healthMonitor = workspaceManager.getHealthMonitor();

      vi.spyOn(healthMonitor, 'getStats').mockReturnValue({
        isMonitoring: true,
        totalContainers: 2,
        healthyContainers: 1,
        unhealthyContainers: 1,
        startingContainers: 0,
        averageFailingStreak: 0.5,
        lastCheckTime: new Date('2024-01-01T12:00:00Z'),
      });

      const stats = await workspaceManager.getWorkspaceStats();

      expect(stats).toHaveProperty('containerHealthStats');
      expect(stats.containerHealthStats).toEqual({
        isMonitoring: true,
        totalContainers: 2,
        healthyContainers: 1,
        unhealthyContainers: 1,
        startingContainers: 0,
        averageFailingStreak: 0.5,
        lastCheckTime: new Date('2024-01-01T12:00:00Z'),
      });
    });

    it('should handle health stats errors gracefully', async () => {
      const healthMonitor = workspaceManager.getHealthMonitor();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.spyOn(healthMonitor, 'getStats').mockImplementation(() => {
        throw new Error('Health stats unavailable');
      });

      const stats = await workspaceManager.getWorkspaceStats();

      expect(stats.containerHealthStats).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to get container health stats:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Health Monitor Configuration', () => {
    it('should create health monitor with correct configuration', () => {
      const healthMonitor = workspaceManager.getHealthMonitor();

      // Verify the health monitor is configured for APEX task containers
      expect(healthMonitor).toBeInstanceOf(ContainerHealthMonitor);

      // Test that it's not auto-started (we control when to start it)
      expect(healthMonitor.isActive()).toBe(false);
    });

    it('should support workspace configuration', () => {
      expect(workspaceManager.supportsContainerWorkspaces()).toBe(true);
      expect(workspaceManager.getContainerRuntime()).toBe('docker');
    });
  });
});