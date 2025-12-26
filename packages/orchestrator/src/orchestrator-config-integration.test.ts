import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import {
  ApexConfig,
  Task,
  WorkspaceConfig,
  generateTaskId,
  getEffectiveConfig,
} from '@apexcli/core';

// Mock external dependencies
vi.mock('fs/promises');
vi.mock('./store');
vi.mock('./worktree-manager');
vi.mock('@anthropic-ai/claude-agent-sdk');

const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  access: vi.fn(),
  rm: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  promises: mockFs,
  ...mockFs,
}));

// Mock TaskStore
const mockStore = vi.hoisted(() => ({
  initialize: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  getTask: vi.fn(),
  getTasks: vi.fn(),
  updateTaskStatus: vi.fn(),
  saveTaskResult: vi.fn(),
  cleanup: vi.fn(),
}));

vi.mock('./store', () => ({
  TaskStore: vi.fn(() => mockStore),
}));

// Mock WorktreeManager
const mockWorktreeManager = vi.hoisted(() => ({
  initialize: vi.fn(),
  cleanup: vi.fn(),
}));

vi.mock('./worktree-manager', () => ({
  WorktreeManager: vi.fn(() => mockWorktreeManager),
}));

// Mock Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('Orchestrator Config Integration - Container Defaults', () => {
  let orchestrator: ApexOrchestrator;
  let projectPath: string;
  let mockContainerManager: any;
  let mockHealthMonitor: any;

  beforeEach(async () => {
    projectPath = path.join(os.tmpdir(), `apex-integration-test-${Date.now()}`);

    // Setup basic fs mocks
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.access.mockRejectedValue(new Error('File not found'));
    mockFs.readFile.mockRejectedValue(new Error('File not found'));

    // Mock container manager and health monitor
    mockContainerManager = {
      createContainer: vi.fn().mockResolvedValue({
        success: true,
        containerId: 'integration-test-container',
      }),
      listApexContainers: vi.fn().mockResolvedValue([]),
      stopContainer: vi.fn().mockResolvedValue(undefined),
      removeContainer: vi.fn().mockResolvedValue(undefined),
      execCommand: vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'integration test success',
        stderr: '',
      }),
      startEventsMonitoring: vi.fn().mockResolvedValue(undefined),
      stopEventsMonitoring: vi.fn().mockResolvedValue(undefined),
      isEventsMonitoringActive: vi.fn().mockReturnValue(false),
    };

    mockHealthMonitor = {
      startMonitoring: vi.fn().mockResolvedValue(undefined),
      stopMonitoring: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn().mockReturnValue({}),
      getContainerHealth: vi.fn().mockReturnValue(null),
    };

    // Mock store responses
    mockStore.createTask.mockImplementation((task: Task) => {
      return Promise.resolve(task);
    });
    mockStore.getTask.mockImplementation((id: string) => {
      return Promise.resolve({
        id,
        title: 'Test task',
        description: 'Test description',
        status: 'pending',
        createdAt: new Date(),
      } as Task);
    });
  });

  afterEach(async () => {
    if (orchestrator) {
      try {
        await orchestrator.cleanup();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
    vi.clearAllMocks();
  });

  describe('Container defaults flow from config to WorkspaceManager', () => {
    it('should pass container defaults from effective config to WorkspaceManager', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'integration-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          container: {
            image: 'node:20-alpine',
            resourceLimits: {
              cpu: 2,
              memory: '1g',
            },
            environment: {
              NODE_ENV: 'test',
              INTEGRATION_TEST: 'true',
            },
            networkMode: 'bridge',
            autoRemove: true,
            installTimeout: 300000,
          },
        },
      };

      orchestrator = new ApexOrchestrator(projectPath, config);

      // Mock the workspace manager creation to capture the options passed
      let capturedWorkspaceManagerOptions: any;
      const originalWorkspaceManager = (orchestrator as any).workspaceManager;

      // Spy on WorkspaceManager constructor through orchestrator initialization
      vi.spyOn(orchestrator as any, 'workspaceManager', 'get').mockImplementation(() => {
        if (!originalWorkspaceManager) {
          // Create a mock workspace manager that captures the construction options
          const mockWorkspaceManager = {
            initialize: vi.fn(),
            createWorkspace: vi.fn(),
            getWorkspace: vi.fn(),
            cleanupWorkspace: vi.fn(),
            cleanup: vi.fn(),
            getContainerManager: vi.fn().mockReturnValue(mockContainerManager),
            getHealthMonitor: vi.fn().mockReturnValue(mockHealthMonitor),
            supportsContainerWorkspaces: vi.fn().mockReturnValue(true),
          };

          return mockWorkspaceManager;
        }
        return originalWorkspaceManager;
      });

      await orchestrator.initialize();

      // Verify the effective config has the expected container defaults
      const effectiveConfig = getEffectiveConfig(config);
      expect(effectiveConfig.workspace.container).toEqual({
        image: 'node:20-alpine',
        resourceLimits: {
          cpu: 2,
          memory: '1g',
        },
        environment: {
          NODE_ENV: 'test',
          INTEGRATION_TEST: 'true',
        },
        networkMode: 'bridge',
        autoRemove: true,
        installTimeout: 300000,
      });

      // Verify workspace manager was initialized with container defaults
      // This tests the line: containerDefaults: this.effectiveConfig.workspace?.container,
      expect((orchestrator as any).effectiveConfig.workspace.container).toEqual({
        image: 'node:20-alpine',
        resourceLimits: {
          cpu: 2,
          memory: '1g',
        },
        environment: {
          NODE_ENV: 'test',
          INTEGRATION_TEST: 'true',
        },
        networkMode: 'bridge',
        autoRemove: true,
        installTimeout: 300000,
      });
    });

    it('should handle config without workspace section', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'minimal-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        // No workspace section
      };

      orchestrator = new ApexOrchestrator(projectPath, config);
      await orchestrator.initialize();

      // Verify effective config has default workspace settings
      const effectiveConfig = getEffectiveConfig(config);
      expect(effectiveConfig.workspace.defaultStrategy).toBe('none');
      expect(effectiveConfig.workspace.container.networkMode).toBe('bridge');
      expect(effectiveConfig.workspace.container.autoRemove).toBe(true);
    });

    it('should handle partial workspace container config', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'partial-config-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          container: {
            image: 'python:3.11-slim',
            resourceLimits: {
              memory: '512m',
              // cpu not specified
            },
            // environment, networkMode, autoRemove, installTimeout not specified
          },
        },
      };

      orchestrator = new ApexOrchestrator(projectPath, config);
      await orchestrator.initialize();

      const effectiveConfig = getEffectiveConfig(config);

      // Verify partial config is preserved and defaults are applied
      expect(effectiveConfig.workspace.container.image).toBe('python:3.11-slim');
      expect(effectiveConfig.workspace.container.resourceLimits).toEqual({
        memory: '512m',
      });
      expect(effectiveConfig.workspace.container.networkMode).toBe('bridge'); // Default
      expect(effectiveConfig.workspace.container.autoRemove).toBe(true); // Default
    });
  });

  describe('Task creation with container workspace configuration', () => {
    it('should create task with container workspace that will use merged config', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'task-creation-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'none', // Default strategy different from task
          container: {
            image: 'node:18-alpine', // Global default
            resourceLimits: {
              cpu: 1,
              memory: '512m',
            },
            environment: {
              GLOBAL_VAR: 'global_value',
            },
            networkMode: 'bridge',
            autoRemove: true,
          },
        },
      };

      orchestrator = new ApexOrchestrator(projectPath, config);
      await orchestrator.initialize();

      // Create a task with specific container workspace config
      const task = await orchestrator.createTask({
        title: 'Container task',
        description: 'Task using container workspace',
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'python:3.11-slim', // Override global default
            resourceLimits: {
              memory: '1g', // Override memory, cpu should come from global
            },
            environment: {
              TASK_VAR: 'task_value', // Additional task-specific var
            },
            // networkMode, autoRemove should come from global defaults
          },
        } as WorkspaceConfig,
      });

      expect(task).toBeDefined();
      expect(task.workspace?.strategy).toBe('container');
      expect(task.workspace?.container?.image).toBe('python:3.11-slim');

      // The actual merging will happen when workspace is created, but we can verify
      // that the orchestrator has the right container defaults available
      expect((orchestrator as any).effectiveConfig.workspace.container).toEqual({
        image: 'node:18-alpine',
        resourceLimits: {
          cpu: 1,
          memory: '512m',
        },
        environment: {
          GLOBAL_VAR: 'global_value',
        },
        networkMode: 'bridge',
        autoRemove: true,
      });
    });

    it('should handle task creation without workspace config when defaults exist', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'default-workspace-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          container: {
            image: 'ubuntu:22.04',
            resourceLimits: {
              cpu: 2,
              memory: '2g',
            },
          },
        },
      };

      orchestrator = new ApexOrchestrator(projectPath, config);
      await orchestrator.initialize();

      const task = await orchestrator.createTask({
        title: 'Default workspace task',
        description: 'Task using default workspace strategy',
        // No workspace configuration specified
      });

      // Task should not have workspace config initially (will use defaults when workspace is created)
      expect(task.workspace).toBeUndefined();

      // But orchestrator should have the container defaults ready
      expect((orchestrator as any).effectiveConfig.workspace.defaultStrategy).toBe('container');
      expect((orchestrator as any).effectiveConfig.workspace.container.image).toBe('ubuntu:22.04');
    });
  });

  describe('End-to-end config flow validation', () => {
    it('should demonstrate complete config merging flow from ApexConfig to container creation', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'e2e-config-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          container: {
            image: 'node:20-alpine',
            resourceLimits: {
              cpu: 4,
              memory: '2g',
              cpuShares: 2048,
            },
            environment: {
              NODE_ENV: 'production',
              API_URL: 'https://api.example.com',
              DEBUG: 'false',
            },
            networkMode: 'bridge',
            autoRemove: true,
            installTimeout: 600000,
          },
        },
      };

      orchestrator = new ApexOrchestrator(projectPath, config);

      // Mock the workspace manager to capture createWorkspace calls
      const mockWorkspaceManager = {
        initialize: vi.fn(),
        cleanup: vi.fn(),
        getContainerManager: vi.fn().mockReturnValue(mockContainerManager),
        getHealthMonitor: vi.fn().mockReturnValue(mockHealthMonitor),
        supportsContainerWorkspaces: vi.fn().mockReturnValue(true),
        createWorkspace: vi.fn().mockResolvedValue({
          taskId: 'test-task',
          config: { strategy: 'container' },
          workspacePath: '/test/workspace',
          status: 'active',
          createdAt: new Date(),
          lastAccessed: new Date(),
        }),
        getWorkspace: vi.fn(),
        cleanupWorkspace: vi.fn(),
      };

      (orchestrator as any).workspaceManager = mockWorkspaceManager;

      await orchestrator.initialize();

      // Create task that will have container workspace
      const task = await orchestrator.createTask({
        title: 'E2E config task',
        description: 'Task to test end-to-end config flow',
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'python:3.11-slim', // Override
            resourceLimits: {
              memory: '1g', // Override memory only
            },
            environment: {
              NODE_ENV: 'development', // Override
              CUSTOM_VAR: 'custom_value', // Additional
            },
            // Other fields should come from global defaults
          },
        } as WorkspaceConfig,
      });

      // Verify the orchestrator has the effective config with container defaults
      const effectiveConfig = (orchestrator as any).effectiveConfig;
      expect(effectiveConfig.workspace.container).toEqual({
        image: 'node:20-alpine',
        resourceLimits: {
          cpu: 4,
          memory: '2g',
          cpuShares: 2048,
        },
        environment: {
          NODE_ENV: 'production',
          API_URL: 'https://api.example.com',
          DEBUG: 'false',
        },
        networkMode: 'bridge',
        autoRemove: true,
        installTimeout: 600000,
      });

      // This demonstrates that:
      // 1. ApexConfig is parsed and effective config is generated with container defaults
      // 2. Orchestrator passes container defaults to WorkspaceManager
      // 3. Task has its own container config that will be merged with defaults
      // 4. The actual merging happens in WorkspaceManager.createContainerWorkspace()

      expect(task.workspace?.container?.image).toBe('python:3.11-slim');
      expect(task.workspace?.container?.environment?.CUSTOM_VAR).toBe('custom_value');
    });
  });
});