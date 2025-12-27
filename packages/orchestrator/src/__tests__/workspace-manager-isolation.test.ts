import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceManager } from '../workspace-manager';
import {
  Task,
  TaskStatus,
  WorkspaceConfig,
  IsolationConfig,
  IsolationMode,
  ContainerConfig,
} from '@apexcli/core';
import { join } from 'path';
import { tmpdir } from 'os';
import { promises as fs } from 'fs';

// Mock container runtime and related modules
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    containerRuntime: {
      getBestRuntime: vi.fn().mockResolvedValue('docker'),
    },
    ContainerManager: vi.fn().mockImplementation(() => ({
      createContainer: vi.fn().mockResolvedValue({ success: true, containerId: 'test-container-id' }),
      execCommand: vi.fn().mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 }),
      listApexContainers: vi.fn().mockResolvedValue([]),
      stopContainer: vi.fn().mockResolvedValue(undefined),
      removeContainer: vi.fn().mockResolvedValue(undefined),
      startEventsMonitoring: vi.fn().mockResolvedValue(undefined),
      stopEventsMonitoring: vi.fn().mockResolvedValue(undefined),
      isEventsMonitoringActive: vi.fn().mockReturnValue(false),
    })),
    ContainerHealthMonitor: vi.fn().mockImplementation(() => ({
      startMonitoring: vi.fn().mockResolvedValue(undefined),
      stopMonitoring: vi.fn().mockResolvedValue(undefined),
      getContainerHealth: vi.fn().mockResolvedValue(null),
      getStats: vi.fn().mockReturnValue({}),
    })),
    DependencyDetector: vi.fn().mockImplementation(() => ({
      detectPackageManagers: vi.fn().mockResolvedValue({ primaryManager: null }),
    })),
  };
});

describe('WorkspaceManager Isolation Mode', () => {
  let workspaceManager: WorkspaceManager;
  let projectPath: string;
  let mockContainerManager: any;
  let mockHealthMonitor: any;
  let mockDependencyDetector: any;

  const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    id: `test-task-${Date.now()}`,
    description: 'Test task for isolation mode',
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
    ...overrides,
  });

  beforeEach(async () => {
    // Create temporary project directory
    projectPath = join(tmpdir(), `apex-test-${Date.now()}`);
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(join(projectPath, '.apex'), { recursive: true });

    workspaceManager = new WorkspaceManager({
      projectPath,
      defaultStrategy: 'none',
    });

    // Set up mocks
    mockContainerManager = {
      createContainer: vi.fn().mockResolvedValue({ success: true, containerId: 'test-container-id' }),
      execCommand: vi.fn().mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 }),
      listApexContainers: vi.fn().mockResolvedValue([]),
      stopContainer: vi.fn().mockResolvedValue(undefined),
      removeContainer: vi.fn().mockResolvedValue(undefined),
      startEventsMonitoring: vi.fn().mockResolvedValue(undefined),
      stopEventsMonitoring: vi.fn().mockResolvedValue(undefined),
      isEventsMonitoringActive: vi.fn().mockReturnValue(false),
    };

    mockHealthMonitor = {
      startMonitoring: vi.fn().mockResolvedValue(undefined),
      stopMonitoring: vi.fn().mockResolvedValue(undefined),
      getContainerHealth: vi.fn().mockResolvedValue(null),
      getStats: vi.fn().mockReturnValue({}),
    };

    mockDependencyDetector = {
      detectPackageManagers: vi.fn().mockResolvedValue({ primaryManager: null }),
    };

    // Inject mocks
    (workspaceManager as any).containerManager = mockContainerManager;
    (workspaceManager as any).healthMonitor = mockHealthMonitor;
    (workspaceManager as any).dependencyDetector = mockDependencyDetector;
    (workspaceManager as any).containerRuntimeType = 'docker';
  });

  afterEach(async () => {
    // Clean up temporary directories
    try {
      await fs.rm(projectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('isolationConfigToWorkspaceConfig conversion', () => {
    it('should convert "full" mode to container workspace strategy', () => {
      const isolationConfig: IsolationConfig = {
        mode: 'full',
        container: {
          image: 'node:20-alpine',
          environment: { NODE_ENV: 'test' },
        },
        cleanupOnComplete: true,
        preserveOnFailure: false,
      };

      // Call the private method via reflection
      const workspaceConfig: WorkspaceConfig = (workspaceManager as any).isolationConfigToWorkspaceConfig(isolationConfig);

      expect(workspaceConfig.strategy).toBe('container');
      expect(workspaceConfig.container).toEqual(isolationConfig.container);
      expect(workspaceConfig.cleanup).toBe(true);
      expect(workspaceConfig.preserveOnFailure).toBe(false);
    });

    it('should convert "worktree" mode to worktree workspace strategy', () => {
      const isolationConfig: IsolationConfig = {
        mode: 'worktree',
        cleanupOnComplete: false,
        preserveOnFailure: true,
      };

      const workspaceConfig: WorkspaceConfig = (workspaceManager as any).isolationConfigToWorkspaceConfig(isolationConfig);

      expect(workspaceConfig.strategy).toBe('worktree');
      expect(workspaceConfig.container).toBeUndefined();
      expect(workspaceConfig.cleanup).toBe(false);
      expect(workspaceConfig.preserveOnFailure).toBe(true);
    });

    it('should convert "shared" mode to none workspace strategy', () => {
      const isolationConfig: IsolationConfig = {
        mode: 'shared',
        cleanupOnComplete: true,
        preserveOnFailure: false,
      };

      const workspaceConfig: WorkspaceConfig = (workspaceManager as any).isolationConfigToWorkspaceConfig(isolationConfig);

      expect(workspaceConfig.strategy).toBe('none');
      expect(workspaceConfig.container).toBeUndefined();
      expect(workspaceConfig.cleanup).toBe(true);
      expect(workspaceConfig.preserveOnFailure).toBe(false);
    });

    it('should apply default values for optional fields', () => {
      const isolationConfig: IsolationConfig = {
        mode: 'full',
      };

      const workspaceConfig: WorkspaceConfig = (workspaceManager as any).isolationConfigToWorkspaceConfig(isolationConfig);

      expect(workspaceConfig.strategy).toBe('container');
      expect(workspaceConfig.cleanup).toBe(true);
      expect(workspaceConfig.preserveOnFailure).toBe(false);
    });

    it('should throw error for unknown isolation mode', () => {
      const isolationConfig = {
        mode: 'unknown-mode' as IsolationMode,
        cleanupOnComplete: true,
      };

      expect(() => (workspaceManager as any).isolationConfigToWorkspaceConfig(isolationConfig)).toThrow('Unknown isolation mode: unknown-mode');
    });
  });

  describe('createWorkspaceWithIsolation', () => {
    it('should create shared workspace (none strategy)', async () => {
      const task = createMockTask();
      const isolationConfig: IsolationConfig = {
        mode: 'shared',
      };

      const workspaceInfo = await workspaceManager.createWorkspaceWithIsolation(task, isolationConfig);

      expect(workspaceInfo.taskId).toBe(task.id);
      expect(workspaceInfo.config.strategy).toBe('none');
      expect(workspaceInfo.workspacePath).toBe(projectPath); // Same as project path for shared mode
      expect(workspaceInfo.status).toBe('active');
      expect(workspaceInfo.success).toBe(true);
      expect(workspaceInfo.containerId).toBeUndefined();
    });

    it('should create worktree workspace', async () => {
      const task = createMockTask({ branchName: 'feature-branch' });
      const isolationConfig: IsolationConfig = {
        mode: 'worktree',
        cleanupOnComplete: false,
      };

      // Mock git worktree command
      const originalExecAsync = require('util').promisify(require('child_process').exec);
      vi.spyOn(require('child_process'), 'exec').mockImplementation((cmd: string, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const workspaceInfo = await workspaceManager.createWorkspaceWithIsolation(task, isolationConfig);

      expect(workspaceInfo.config.strategy).toBe('worktree');
      expect(workspaceInfo.config.cleanup).toBe(false);
      expect(workspaceInfo.workspacePath).toContain(`worktree-${task.id}`);
      expect(workspaceInfo.containerId).toBeUndefined();

      vi.restoreAllMocks();
    });

    it('should create container workspace with full isolation', async () => {
      const task = createMockTask();
      const containerConfig: ContainerConfig = {
        image: 'node:20-alpine',
        environment: { NODE_ENV: 'test', CI: 'true' },
        resourceLimits: { cpu: 1.0, memory: '512m' },
        workingDir: '/workspace',
      };

      const isolationConfig: IsolationConfig = {
        mode: 'full',
        container: containerConfig,
        cleanupOnComplete: true,
        preserveOnFailure: false,
      };

      const workspaceInfo = await workspaceManager.createWorkspaceWithIsolation(task, isolationConfig);

      expect(workspaceInfo.config.strategy).toBe('container');
      expect(workspaceInfo.containerId).toBe('test-container-id');
      expect(workspaceInfo.workspacePath).toContain(`container-${task.id}`);
      expect(mockContainerManager.createContainer).toHaveBeenCalledWith({
        config: expect.objectContaining({
          image: 'node:20-alpine',
          environment: expect.objectContaining({ NODE_ENV: 'test', CI: 'true' }),
          workingDir: '/workspace',
          labels: expect.objectContaining({
            'apex.task-id': task.id,
            'apex.workspace-type': 'container',
          }),
        }),
        taskId: task.id,
        autoStart: true,
      });
    });

    it('should handle container creation failure gracefully', async () => {
      const task = createMockTask();
      const isolationConfig: IsolationConfig = {
        mode: 'full',
        container: { image: 'node:20' },
      };

      // Mock container creation failure
      mockContainerManager.createContainer.mockResolvedValueOnce({
        success: false,
        error: 'Container creation failed',
      });

      await expect(workspaceManager.createWorkspaceWithIsolation(task, isolationConfig))
        .rejects.toThrow('Failed to create container workspace');
    });

    it('should merge container defaults with task-specific config', async () => {
      const containerDefaults = {
        image: 'node:18',
        environment: { NODE_ENV: 'development', DEFAULT_VAR: 'default' },
        resourceLimits: { cpu: 0.5, memory: '256m' },
        networkMode: 'bridge' as const,
      };

      const workspaceManagerWithDefaults = new WorkspaceManager({
        projectPath,
        defaultStrategy: 'none',
        containerDefaults,
      });

      // Inject mocks
      (workspaceManagerWithDefaults as any).containerManager = mockContainerManager;
      (workspaceManagerWithDefaults as any).containerRuntimeType = 'docker';
      (workspaceManagerWithDefaults as any).dependencyDetector = mockDependencyDetector;

      const task = createMockTask();
      const isolationConfig: IsolationConfig = {
        mode: 'full',
        container: {
          image: 'node:20', // Override default image
          environment: { NODE_ENV: 'test' }, // Override and extend environment
          resourceLimits: { memory: '512m' }, // Override memory but keep default CPU
        },
      };

      await workspaceManagerWithDefaults.createWorkspaceWithIsolation(task, isolationConfig);

      expect(mockContainerManager.createContainer).toHaveBeenCalledWith({
        config: expect.objectContaining({
          image: 'node:20', // Task override
          environment: expect.objectContaining({
            NODE_ENV: 'test', // Task override
            DEFAULT_VAR: 'default', // From defaults
          }),
          resourceLimits: expect.objectContaining({
            cpu: 0.5, // From defaults
            memory: '512m', // Task override
          }),
          networkMode: 'bridge', // From defaults
        }),
        taskId: task.id,
        autoStart: true,
      });
    });

    it('should detect and use project Dockerfile when available', async () => {
      // Create a mock Dockerfile in .apex directory
      const dockerfilePath = join(projectPath, '.apex', 'Dockerfile');
      await fs.writeFile(dockerfilePath, 'FROM node:20-alpine\nRUN npm install');

      const task = createMockTask();
      const isolationConfig: IsolationConfig = {
        mode: 'full',
        container: { image: 'node:18' }, // This should be overridden by Dockerfile
      };

      await workspaceManager.createWorkspaceWithIsolation(task, isolationConfig);

      expect(mockContainerManager.createContainer).toHaveBeenCalledWith({
        config: expect.objectContaining({
          dockerfile: '.apex/Dockerfile',
          buildContext: projectPath,
          image: 'node:18', // Still present but buildContext + dockerfile takes precedence
        }),
        taskId: task.id,
        autoStart: true,
      });
    });
  });

  describe('dependency installation in containers', () => {
    it('should install dependencies when auto-install is enabled', async () => {
      // Mock package manager detection
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        primaryManager: {
          type: 'npm',
          language: 'javascript',
          configFiles: ['package.json'],
        },
      });

      const task = createMockTask();
      const isolationConfig: IsolationConfig = {
        mode: 'full',
        container: {
          image: 'node:20',
          autoDependencyInstall: true,
          useFrozenLockfile: true,
        },
      };

      await workspaceManager.createWorkspaceWithIsolation(task, isolationConfig);

      // Verify execCommand was called for dependency installation
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container-id',
        expect.stringContaining('npm ci'), // Frozen lockfile command
        expect.any(Object),
        'docker'
      );
    });

    it('should skip dependency installation when disabled', async () => {
      const task = createMockTask();
      const isolationConfig: IsolationConfig = {
        mode: 'full',
        container: {
          image: 'node:20',
          autoDependencyInstall: false,
        },
      };

      await workspaceManager.createWorkspaceWithIsolation(task, isolationConfig);

      // Verify execCommand was not called for dependency installation
      expect(mockContainerManager.execCommand).not.toHaveBeenCalled();
    });

    it('should handle dependency installation failures gracefully', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        primaryManager: {
          type: 'npm',
          language: 'javascript',
          configFiles: ['package.json'],
        },
      });

      mockContainerManager.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'npm install failed',
        exitCode: 1,
        error: 'Installation failed',
      });

      const task = createMockTask();
      const isolationConfig: IsolationConfig = {
        mode: 'full',
        container: {
          image: 'node:20',
          autoDependencyInstall: true,
          installRetries: 0,
        },
      };

      // Should not throw, but should create workspace with warnings
      const workspaceInfo = await workspaceManager.createWorkspaceWithIsolation(task, isolationConfig);

      expect(workspaceInfo.success).toBe(true);
      expect(workspaceInfo.warnings).toContainEqual(
        expect.stringContaining('Dependency installation failed')
      );
    });

    it('should retry dependency installation on failure', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        primaryManager: {
          type: 'npm',
          language: 'javascript',
          configFiles: ['package.json'],
        },
      });

      // First call fails, second succeeds
      mockContainerManager.execCommand
        .mockResolvedValueOnce({
          success: false,
          stderr: 'Network error',
          exitCode: 1,
        })
        .mockResolvedValueOnce({
          success: true,
          stdout: 'Installation successful',
          exitCode: 0,
        });

      const task = createMockTask();
      const isolationConfig: IsolationConfig = {
        mode: 'full',
        container: {
          image: 'node:20',
          autoDependencyInstall: true,
          installRetries: 1,
        },
      };

      await workspaceManager.createWorkspaceWithIsolation(task, isolationConfig);

      // Verify retry was attempted
      expect(mockContainerManager.execCommand).toHaveBeenCalledTimes(2);
    });
  });

  describe('workspace cleanup', () => {
    it('should cleanup container workspace', async () => {
      const task = createMockTask();
      const isolationConfig: IsolationConfig = {
        mode: 'full',
        container: { image: 'node:20' },
        cleanupOnComplete: true,
      };

      const workspaceInfo = await workspaceManager.createWorkspaceWithIsolation(task, isolationConfig);

      // Mock container list for cleanup
      mockContainerManager.listApexContainers.mockResolvedValue([
        { id: 'test-container-id', name: `apex-task-${task.id}` },
      ]);

      await workspaceManager.cleanupWorkspace(task.id);

      expect(mockContainerManager.stopContainer).toHaveBeenCalledWith('test-container-id', 'docker');
      expect(mockContainerManager.removeContainer).toHaveBeenCalledWith('test-container-id', 'docker', true);
    });

    it('should skip cleanup when disabled', async () => {
      const task = createMockTask();
      const isolationConfig: IsolationConfig = {
        mode: 'full',
        container: { image: 'node:20' },
        cleanupOnComplete: false,
      };

      const workspaceInfo = await workspaceManager.createWorkspaceWithIsolation(task, isolationConfig);
      await workspaceManager.cleanupWorkspace(task.id);

      // Should mark as cleanup-pending but not actually clean
      const workspace = workspaceManager.getWorkspace(task.id);
      expect(workspace?.status).toBe('cleanup-pending');
      expect(mockContainerManager.stopContainer).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const task = createMockTask();
      const isolationConfig: IsolationConfig = {
        mode: 'full',
        container: { image: 'node:20' },
      };

      await workspaceManager.createWorkspaceWithIsolation(task, isolationConfig);

      // Mock cleanup failure
      mockContainerManager.listApexContainers.mockResolvedValue([
        { id: 'test-container-id', name: `apex-task-${task.id}` },
      ]);
      mockContainerManager.stopContainer.mockRejectedValue(new Error('Cleanup failed'));

      await workspaceManager.cleanupWorkspace(task.id);

      // Should mark as cleanup-pending on failure
      const workspace = workspaceManager.getWorkspace(task.id);
      expect(workspace?.status).toBe('cleanup-pending');
    });
  });

  describe('workspace information and statistics', () => {
    it('should track isolation mode in workspace info', async () => {
      const task = createMockTask();
      const isolationConfig: IsolationConfig = {
        mode: 'full',
        container: { image: 'node:20' },
      };

      const workspaceInfo = await workspaceManager.createWorkspaceWithIsolation(task, isolationConfig);

      expect(workspaceInfo.taskId).toBe(task.id);
      expect(workspaceInfo.config.strategy).toBe('container');
      expect(workspaceInfo.containerId).toBe('test-container-id');
      expect(workspaceInfo.status).toBe('active');
      expect(workspaceInfo.createdAt).toBeInstanceOf(Date);
      expect(workspaceInfo.lastAccessed).toBeInstanceOf(Date);
    });

    it('should provide container ID for container-based tasks', () => {
      const task = createMockTask();

      // Mock an active container workspace
      const workspaceInfo = {
        taskId: task.id,
        config: { strategy: 'container' as const, cleanup: true },
        workspacePath: '/path/to/workspace',
        containerId: 'test-container-123',
        status: 'active' as const,
        createdAt: new Date(),
        lastAccessed: new Date(),
      };

      (workspaceManager as any).activeWorkspaces.set(task.id, workspaceInfo);

      const containerId = workspaceManager.getContainerIdForTask(task.id);
      expect(containerId).toBe('test-container-123');
    });

    it('should return undefined container ID for non-container tasks', () => {
      const task = createMockTask();

      // Mock a non-container workspace
      const workspaceInfo = {
        taskId: task.id,
        config: { strategy: 'worktree' as const, cleanup: true },
        workspacePath: '/path/to/workspace',
        status: 'active' as const,
        createdAt: new Date(),
        lastAccessed: new Date(),
      };

      (workspaceManager as any).activeWorkspaces.set(task.id, workspaceInfo);

      const containerId = workspaceManager.getContainerIdForTask(task.id);
      expect(containerId).toBeUndefined();
    });

    it('should include workspace statistics by strategy', async () => {
      // Create workspaces with different strategies
      const tasks = [
        createMockTask({ id: 'task1' }),
        createMockTask({ id: 'task2' }),
        createMockTask({ id: 'task3' }),
      ];

      await workspaceManager.createWorkspaceWithIsolation(tasks[0], { mode: 'full', container: { image: 'node:20' } });
      await workspaceManager.createWorkspaceWithIsolation(tasks[1], { mode: 'worktree' });
      await workspaceManager.createWorkspaceWithIsolation(tasks[2], { mode: 'shared' });

      const stats = await workspaceManager.getWorkspaceStats();

      expect(stats.activeCount).toBe(3);
      expect(stats.workspacesByStrategy).toEqual({
        container: 1,
        worktree: 1,
        none: 1,
      });
    });
  });
});