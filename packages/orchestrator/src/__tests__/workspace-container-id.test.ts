import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceManager } from '../workspace-manager';
import { Task, TaskStatus, WorkspaceConfig } from '@apexcli/core';
import { join } from 'path';
import { tmpdir } from 'os';
import { promises as fs } from 'fs';

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

describe('WorkspaceManager Container ID', () => {
  let workspaceManager: WorkspaceManager;
  let projectPath: string;

  const createMockTask = (containerConfig?: any): Task => ({
    id: `test-task-${Date.now()}`,
    description: 'Test task for container ID',
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
        volumes: {},
        workingDir: '/workspace',
        autoRemove: true,
        ...containerConfig,
      },
    } as WorkspaceConfig,
  });

  beforeEach(() => {
    // Create temporary project directory path
    projectPath = join(tmpdir(), `apex-test-${Date.now()}`);

    workspaceManager = new WorkspaceManager({
      projectPath,
      defaultStrategy: 'directory',
    });

    // Mock container manager to avoid actual container operations
    const mockContainerManager = {
      createContainer: vi.fn().mockResolvedValue({ success: true, containerId: 'test-container-123' }),
      execCommand: vi.fn().mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 }),
    };
    (workspaceManager as any).containerManager = mockContainerManager;
    (workspaceManager as any).containerRuntimeType = 'docker';

    // Mock dependency detector to avoid filesystem operations
    const mockDependencyDetector = {
      detectPackageManagers: vi.fn().mockResolvedValue({ primaryManager: null }),
    };
    (workspaceManager as any).dependencyDetector = mockDependencyDetector;

    // Mock health monitor
    const mockHealthMonitor = {
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      getContainerHealth: vi.fn(),
    };
    (workspaceManager as any).healthMonitor = mockHealthMonitor;
  });

  afterEach(async () => {
    // Clean up temporary directories
    try {
      await fs.rm(projectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Container ID Storage and Retrieval', () => {
    it('should store container ID in workspace info when creating container workspace', async () => {
      const testContainerId = 'test-container-123';

      // Create mock task
      const task = createMockTask();

      // Mock the containerManager.createContainer to return container ID
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockResolvedValue({
        success: true,
        containerId: testContainerId,
      });

      // Create workspace
      const workspaceInfo = await workspaceManager.createWorkspace(task);

      // Verify container ID is stored
      expect(workspaceInfo.containerId).toBe(testContainerId);
      expect(workspaceInfo.config.strategy).toBe('container');
    });

    it('should return container ID for task using getContainerIdForTask', async () => {
      const testContainerId = 'test-container-456';

      // Create mock task
      const task = createMockTask();

      // Mock the containerManager.createContainer to return container ID
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockResolvedValue({
        success: true,
        containerId: testContainerId,
      });

      // Create workspace
      await workspaceManager.createWorkspace(task);

      // Test getContainerIdForTask method
      const retrievedContainerId = workspaceManager.getContainerIdForTask(task.id);
      expect(retrievedContainerId).toBe(testContainerId);
    });

    it('should return undefined for non-container workspaces', async () => {
      // Create mock task with directory strategy
      const task: Task = {
        id: `test-task-${Date.now()}`,
        description: 'Test task for non-container workspace',
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
          strategy: 'directory',
          cleanup: true,
        } as WorkspaceConfig,
      };

      // Create workspace
      await workspaceManager.createWorkspace(task);

      // Test getContainerIdForTask method
      const retrievedContainerId = workspaceManager.getContainerIdForTask(task.id);
      expect(retrievedContainerId).toBeUndefined();
    });

    it('should return undefined for non-existent tasks', async () => {
      const retrievedContainerId = workspaceManager.getContainerIdForTask('non-existent-task');
      expect(retrievedContainerId).toBeUndefined();
    });

    it('should persist container ID when reloading workspace manager', async () => {
      const testContainerId = 'test-container-persist';

      // Create directories for persistence test
      await fs.mkdir(projectPath, { recursive: true });

      // Create mock task
      const task = createMockTask();

      // Mock the containerManager.createContainer to return container ID
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockResolvedValue({
        success: true,
        containerId: testContainerId,
      });

      // Initialize workspace manager
      await workspaceManager.initialize();

      // Create workspace
      await workspaceManager.createWorkspace(task);

      // Verify container ID is stored
      expect(workspaceManager.getContainerIdForTask(task.id)).toBe(testContainerId);

      // Create a new workspace manager instance (simulating restart)
      const newWorkspaceManager = new WorkspaceManager({
        projectPath,
        defaultStrategy: 'directory',
      });

      // Mock the new workspace manager as well
      (newWorkspaceManager as any).containerManager = (workspaceManager as any).containerManager;
      (newWorkspaceManager as any).containerRuntimeType = 'docker';
      (newWorkspaceManager as any).dependencyDetector = (workspaceManager as any).dependencyDetector;
      (newWorkspaceManager as any).healthMonitor = (workspaceManager as any).healthMonitor;

      // Initialize to load persisted workspace info
      await newWorkspaceManager.initialize();

      // Verify container ID is still available after reload
      const persistedContainerId = newWorkspaceManager.getContainerIdForTask(task.id);
      expect(persistedContainerId).toBe(testContainerId);
    });
  });

  describe('Container Creation Failure Scenarios', () => {
    it('should handle container creation failure and not store container ID', async () => {
      // Create mock task
      const task = createMockTask();

      // Mock the containerManager.createContainer to return failure
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockResolvedValue({
        success: false,
        error: 'Container creation failed',
      });

      // Attempt to create workspace should throw error
      await expect(workspaceManager.createWorkspace(task)).rejects.toThrow();

      // Verify no workspace info was stored with container ID
      const workspace = workspaceManager.getWorkspace(task.id);
      expect(workspace).toBeNull();

      // Verify getContainerIdForTask returns undefined
      const containerId = workspaceManager.getContainerIdForTask(task.id);
      expect(containerId).toBeUndefined();
    });

    it('should handle missing container configuration and not store container ID', async () => {
      // Create mock task without container config
      const task: Task = {
        id: `test-task-${Date.now()}`,
        description: 'Test task without container config',
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
          // No container config - this should cause an error
        } as WorkspaceConfig,
      };

      // Attempt to create workspace should throw error
      await expect(workspaceManager.createWorkspace(task)).rejects.toThrow('Container configuration required for container strategy');

      // Verify no workspace info was stored
      const workspace = workspaceManager.getWorkspace(task.id);
      expect(workspace).toBeNull();

      // Verify getContainerIdForTask returns undefined
      const containerId = workspaceManager.getContainerIdForTask(task.id);
      expect(containerId).toBeUndefined();
    });

    it('should handle no container runtime available and not store container ID', async () => {
      // Create mock task
      const task = createMockTask();

      // Mock no container runtime available
      (workspaceManager as any).containerRuntimeType = 'none';

      // Attempt to create workspace should throw error
      await expect(workspaceManager.createWorkspace(task)).rejects.toThrow('No container runtime available');

      // Verify no workspace info was stored
      const workspace = workspaceManager.getWorkspace(task.id);
      expect(workspace).toBeNull();

      // Verify getContainerIdForTask returns undefined
      const containerId = workspaceManager.getContainerIdForTask(task.id);
      expect(containerId).toBeUndefined();
    });
  });
});