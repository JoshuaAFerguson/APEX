import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { EventEmitter } from 'eventemitter3';
import {
  WorkspaceManager,
  type WorkspaceManagerOptions,
  type WorkspaceInfo,
  type DependencyInstallEventData,
  type DependencyInstallCompletedEventData,
  type DependencyInstallRecoveryEventData,
} from '../workspace-manager';
import {
  Task,
  WorkspaceConfig,
  IsolationConfig,
  ContainerConfig,
  ContainerManager,
  ContainerHealthMonitor,
  DependencyDetector,
  containerRuntime,
} from '@apexcli/core';

// Mock all external dependencies
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    readdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rm: vi.fn(),
    access: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    ContainerManager: vi.fn(),
    ContainerHealthMonitor: vi.fn(),
    DependencyDetector: vi.fn(),
    containerRuntime: {
      getBestRuntime: vi.fn(),
    },
    resolveExecutable: vi.fn((cmd: string) => cmd),
    getInstallCommand: vi.fn(),
    getOptimizedInstallCommand: vi.fn(),
    getPlatformShell: vi.fn(() => ({ shell: '/bin/bash' })),
  };
});

/**
 * Test suite for WorkspaceManager JSDoc functionality validation
 *
 * This test suite validates that all the examples and functionality documented
 * in JSDoc comments actually work as described.
 */
describe('WorkspaceManager JSDoc Functionality Tests', () => {
  let workspaceManager: WorkspaceManager;
  let mockOptions: WorkspaceManagerOptions;
  let mockContainerManager: any;
  let mockHealthMonitor: any;
  let mockDependencyDetector: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mock options as documented in JSDoc
    mockOptions = {
      projectPath: '/path/to/project',
      defaultStrategy: 'container',
      containerDefaults: {
        image: 'node:18',
        workingDir: '/app',
      },
    };

    // Mock container management classes
    mockContainerManager = {
      createContainer: vi.fn(),
      listApexContainers: vi.fn(),
      execCommand: vi.fn(),
      stopContainer: vi.fn(),
      removeContainer: vi.fn(),
      startEventsMonitoring: vi.fn(),
      stopEventsMonitoring: vi.fn(),
      isEventsMonitoringActive: vi.fn(),
    };

    mockHealthMonitor = {
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      getContainerHealth: vi.fn(),
      getStats: vi.fn(),
    };

    mockDependencyDetector = {
      detectPackageManagers: vi.fn(),
    };

    // Setup constructor mocks
    const { ContainerManager, ContainerHealthMonitor, DependencyDetector, containerRuntime } = await import('@apexcli/core');
    vi.mocked(ContainerManager).mockImplementation(() => mockContainerManager);
    vi.mocked(ContainerHealthMonitor).mockImplementation(() => mockHealthMonitor);
    vi.mocked(DependencyDetector).mockImplementation(() => mockDependencyDetector);

    // Setup runtime detection
    vi.mocked(containerRuntime.getBestRuntime).mockResolvedValue('docker');

    // Setup filesystem mocks
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.readdir).mockResolvedValue([]);

    workspaceManager = new WorkspaceManager(mockOptions);
  });

  afterEach(async () => {
    try {
      await workspaceManager.cleanup();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
    vi.restoreAllMocks();
  });

  describe('WorkspaceManagerOptions Interface Examples', () => {
    it('should work with the JSDoc example configuration', () => {
      // This is the exact example from the JSDoc comment
      const options: WorkspaceManagerOptions = {
        projectPath: '/path/to/project',
        defaultStrategy: 'container',
        containerDefaults: {
          image: 'node:18',
          workingDir: '/app',
        },
      };

      expect(() => new WorkspaceManager(options)).not.toThrow();
      const manager = new WorkspaceManager(options);
      expect(manager).toBeInstanceOf(WorkspaceManager);
      expect(manager).toBeInstanceOf(EventEmitter);
    });
  });

  describe('WorkspaceInfo Interface Examples', () => {
    it('should create workspace info matching the JSDoc example structure', async () => {
      const task: Task = {
        id: 'task-123',
        workspace: { strategy: 'container', isolation: { level: 'full' } },
      };

      // Mock successful container creation
      mockContainerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'apex-task-123',
      });

      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        primaryManager: null,
      });

      await workspaceManager.initialize();
      const workspaceInfo = await workspaceManager.createWorkspace(task);

      // Verify the structure matches JSDoc example
      expect(workspaceInfo).toMatchObject({
        taskId: 'task-123',
        config: expect.any(Object),
        workspacePath: expect.any(String),
        status: 'active',
        createdAt: expect.any(Date),
        lastAccessed: expect.any(Date),
        containerId: 'apex-task-123',
        warnings: expect.any(Array),
        success: true,
      });
    });
  });

  describe('initialize() Method JSDoc Example', () => {
    it('should follow the initialization pattern from JSDoc', async () => {
      // Example from JSDoc: await manager.initialize();
      await workspaceManager.initialize();

      expect(mockHealthMonitor.startMonitoring).toHaveBeenCalled();
      expect(mockContainerManager.startEventsMonitoring).toHaveBeenCalledWith({
        namePrefix: 'apex',
        eventTypes: ['die', 'start', 'stop', 'create', 'destroy'],
      });
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.apex/workspaces'),
        { recursive: true }
      );
    });
  });

  describe('createWorkspaceWithIsolation() Method JSDoc Example', () => {
    it('should work with the isolation config example from JSDoc', async () => {
      const task: Task = {
        id: 'task-123',
      };

      const isolationConfig: IsolationConfig = {
        mode: 'full',
        cleanupOnComplete: true,
        container: { image: 'node:18' },
      };

      // Mock container creation
      mockContainerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'apex-task-123',
      });

      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        primaryManager: null,
      });

      await workspaceManager.initialize();
      const workspace = await workspaceManager.createWorkspaceWithIsolation(task, isolationConfig);

      expect(workspace.workspacePath).toContain('task-123');
      expect(workspace.taskId).toBe('task-123');
      expect(workspace.config.strategy).toBe('container');
    });
  });

  describe('createWorkspace() Method JSDoc Example', () => {
    it('should create container workspace as shown in JSDoc', async () => {
      const task: Task = {
        id: 'task-123',
        workspace: { strategy: 'container' },
      };

      mockContainerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'container-123',
      });

      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        primaryManager: null,
      });

      await workspaceManager.initialize();
      const workspace = await workspaceManager.createWorkspace(task);

      expect(workspace.containerId).toBe('container-123');
      expect(workspace.config.strategy).toBe('container');
    });
  });

  describe('getWorkspace() Method JSDoc Example', () => {
    it('should retrieve workspace info as documented', async () => {
      const task: Task = {
        id: 'task-123',
        workspace: { strategy: 'none' },
      };

      await workspaceManager.initialize();
      await workspaceManager.createWorkspace(task);

      // Example from JSDoc: manager.getWorkspace('task-123')
      const workspace = workspaceManager.getWorkspace('task-123');

      expect(workspace).not.toBeNull();
      if (workspace) {
        expect(workspace.workspacePath).toBeDefined();
        expect(workspace.status).toBe('active');
      }
    });

    it('should return null for non-existent workspace', () => {
      const workspace = workspaceManager.getWorkspace('non-existent');
      expect(workspace).toBeNull();
    });
  });

  describe('accessWorkspace() Method JSDoc Example', () => {
    it('should update last accessed time', async () => {
      const task: Task = {
        id: 'task-123',
        workspace: { strategy: 'none' },
      };

      await workspaceManager.initialize();
      await workspaceManager.createWorkspace(task);

      const originalTime = workspaceManager.getWorkspace('task-123')!.lastAccessed;

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await workspaceManager.accessWorkspace('task-123');

      const updatedTime = workspaceManager.getWorkspace('task-123')!.lastAccessed;
      expect(updatedTime.getTime()).toBeGreaterThan(originalTime.getTime());
    });
  });

  describe('listWorkspaces() Method JSDoc Example', () => {
    it('should return array of workspace info as documented', async () => {
      const task1: Task = { id: 'task-1', workspace: { strategy: 'none' } };
      const task2: Task = { id: 'task-2', workspace: { strategy: 'none' } };

      await workspaceManager.initialize();
      await workspaceManager.createWorkspace(task1);
      await workspaceManager.createWorkspace(task2);

      // Example from JSDoc: manager.listWorkspaces()
      const workspaces = workspaceManager.listWorkspaces();

      expect(workspaces).toHaveLength(2);
      expect(workspaces.every(ws => ['task-1', 'task-2'].includes(ws.taskId))).toBe(true);
      expect(workspaces.every(ws => ws.status === 'active')).toBe(true);
      expect(workspaces.every(ws => ws.config.strategy === 'none')).toBe(true);
    });
  });

  describe('getContainerRuntime() Method JSDoc Example', () => {
    it('should return detected runtime type as documented', async () => {
      await workspaceManager.initialize();

      const runtime = workspaceManager.getContainerRuntime();
      expect(runtime).toBe('docker'); // As mocked
    });

    it('should handle no container runtime available', async () => {
      const { containerRuntime } = await import('@apexcli/core');
      vi.mocked(containerRuntime.getBestRuntime).mockResolvedValue('none');
      const manager = new WorkspaceManager(mockOptions);
      await manager.initialize();

      const runtime = manager.getContainerRuntime();
      expect(runtime).toBe('none');
    });
  });

  describe('supportsContainerWorkspaces() Method JSDoc Example', () => {
    it('should return true when container runtime is available', async () => {
      await workspaceManager.initialize();

      // Example from JSDoc: manager.supportsContainerWorkspaces()
      const supports = workspaceManager.supportsContainerWorkspaces();
      expect(supports).toBe(true);
    });

    it('should return false when no container runtime', async () => {
      const { containerRuntime } = await import('@apexcli/core');
      vi.mocked(containerRuntime.getBestRuntime).mockResolvedValue('none');
      const manager = new WorkspaceManager(mockOptions);
      await manager.initialize();

      const supports = manager.supportsContainerWorkspaces();
      expect(supports).toBe(false);
    });
  });

  describe('getHealthMonitor() and getContainerManager() JSDoc Examples', () => {
    it('should return health monitor instance', async () => {
      await workspaceManager.initialize();

      const healthMonitor = workspaceManager.getHealthMonitor();
      expect(healthMonitor).toBeDefined();

      // Mock stats for JSDoc example
      mockHealthMonitor.getStats.mockReturnValue({ containerCount: 5 });
      const stats = healthMonitor.getStats();
      expect(stats.containerCount).toBe(5);
    });

    it('should return container manager instance', async () => {
      await workspaceManager.initialize();

      const containerManager = workspaceManager.getContainerManager();
      expect(containerManager).toBeDefined();

      // Mock container list for JSDoc example
      mockContainerManager.listApexContainers.mockResolvedValue([
        { id: 'container1', name: 'apex-task-1' },
        { id: 'container2', name: 'apex-task-2' },
      ]);

      const containers = await containerManager.listApexContainers('docker');
      expect(containers).toHaveLength(2);
    });
  });

  describe('getWorkspaceStats() Method JSDoc Example', () => {
    it('should return comprehensive workspace statistics', async () => {
      // Create workspaces with different strategies
      const tasks: Task[] = [
        { id: 'task-1', workspace: { strategy: 'container' } },
        { id: 'task-2', workspace: { strategy: 'worktree' } },
        { id: 'task-3', workspace: { strategy: 'none' } },
      ];

      // Mock container creation
      mockContainerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'container-1',
      });

      // Mock exec for git worktree
      vi.mocked(exec).mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      // Mock disk usage calculation
      vi.mocked(exec).mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('du -s')) {
          callback(null, { stdout: '1024\t/path', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        primaryManager: null,
      });

      mockHealthMonitor.getStats.mockReturnValue({
        containerCount: 1,
        healthyContainers: 1,
      });

      await workspaceManager.initialize();

      for (const task of tasks) {
        await workspaceManager.createWorkspace(task);
      }

      const stats = await workspaceManager.getWorkspaceStats();

      expect(stats.activeCount).toBe(3);
      expect(stats.cleanupPendingCount).toBe(0);
      expect(stats.totalDiskUsage).toBeGreaterThanOrEqual(0);
      expect(stats.workspacesByStrategy).toHaveProperty('container');
      expect(stats.workspacesByStrategy).toHaveProperty('worktree');
      expect(stats.workspacesByStrategy).toHaveProperty('none');
      expect(stats.oldestWorkspace).toBeDefined();
      expect(stats.containerHealthStats).toBeDefined();
    });
  });

  describe('Event Emission JSDoc Examples', () => {
    it('should emit workspace-created events as documented', async () => {
      const events: Array<{taskId: string, workspacePath: string}> = [];

      // Example from JSDoc: manager.on('workspace-created', callback)
      workspaceManager.on('workspace-created', (taskId, workspacePath) => {
        events.push({ taskId, workspacePath });
      });

      const task: Task = {
        id: 'task-123',
        workspace: { strategy: 'none' },
      };

      await workspaceManager.initialize();
      await workspaceManager.createWorkspace(task);

      expect(events).toHaveLength(1);
      expect(events[0].taskId).toBe('task-123');
      expect(events[0].workspacePath).toContain('project');
    });

    it('should emit dependency installation events', async () => {
      const startEvents: DependencyInstallEventData[] = [];
      const completeEvents: DependencyInstallCompletedEventData[] = [];

      workspaceManager.on('dependency-install-started', (data) => {
        startEvents.push(data);
      });

      workspaceManager.on('dependency-install-completed', (data) => {
        completeEvents.push(data);
      });

      // Mock dependency detection and container creation
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        primaryManager: {
          type: 'npm',
          language: 'javascript',
          file: 'package.json',
        },
      });

      mockContainerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'container-123',
      });

      mockContainerManager.execCommand.mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Dependencies installed successfully',
        stderr: '',
      });

      const { getOptimizedInstallCommand } = await import('@apexcli/core');
      vi.mocked(getOptimizedInstallCommand).mockReturnValue('npm ci');

      const task: Task = {
        id: 'task-123',
        workspace: {
          strategy: 'container',
          container: { image: 'node:18', autoDependencyInstall: true }
        },
      };

      await workspaceManager.initialize();
      await workspaceManager.createWorkspace(task);

      // Should emit started event
      expect(startEvents).toHaveLength(1);
      expect(startEvents[0].taskId).toBe('task-123');
      expect(startEvents[0].packageManager).toBe('npm');

      // Should emit completed event
      expect(completeEvents).toHaveLength(1);
      expect(completeEvents[0].success).toBe(true);
    });
  });

  describe('cleanup() Method JSDoc Example', () => {
    it('should clean up workspace manager resources', async () => {
      mockContainerManager.isEventsMonitoringActive.mockReturnValue(true);
      mockContainerManager.stopEventsMonitoring.mockResolvedValue(undefined);
      mockHealthMonitor.stopMonitoring.mockResolvedValue(undefined);

      await workspaceManager.initialize();

      // Example from JSDoc: await manager.cleanup();
      await workspaceManager.cleanup();

      expect(mockContainerManager.stopEventsMonitoring).toHaveBeenCalled();
      expect(mockHealthMonitor.stopMonitoring).toHaveBeenCalled();
    });
  });

  describe('Error Handling Examples', () => {
    it('should handle container creation failures gracefully', async () => {
      const task: Task = {
        id: 'task-fail',
        workspace: { strategy: 'container' },
      };

      mockContainerManager.createContainer.mockResolvedValue({
        success: false,
        error: 'Container creation failed',
      });

      await workspaceManager.initialize();

      await expect(workspaceManager.createWorkspace(task)).rejects.toThrow('Failed to create container workspace');
    });

    it('should handle unknown workspace strategies', async () => {
      const task: Task = {
        id: 'task-unknown',
        workspace: { strategy: 'unknown' as any },
      };

      await workspaceManager.initialize();

      await expect(workspaceManager.createWorkspace(task)).rejects.toThrow('Unknown workspace strategy');
    });
  });

  describe('Edge Cases and Robustness', () => {
    it('should handle cleanup when workspace does not exist', async () => {
      await workspaceManager.initialize();

      // Should not throw when cleaning up non-existent workspace
      await expect(workspaceManager.cleanupWorkspace('non-existent')).resolves.not.toThrow();
    });

    it('should handle container health check for non-existent task', async () => {
      await workspaceManager.initialize();

      mockContainerManager.listApexContainers.mockResolvedValue([]);

      const health = await workspaceManager.getContainerHealth('non-existent');
      expect(health).toBeNull();
    });

    it('should handle initialization without container runtime', async () => {
      const { containerRuntime } = await import('@apexcli/core');
      vi.mocked(containerRuntime.getBestRuntime).mockResolvedValue('none');
      const manager = new WorkspaceManager(mockOptions);

      // Should initialize without throwing
      await expect(manager.initialize()).resolves.not.toThrow();
      expect(manager.getContainerRuntime()).toBe('none');
      expect(manager.supportsContainerWorkspaces()).toBe(false);
    });
  });
});