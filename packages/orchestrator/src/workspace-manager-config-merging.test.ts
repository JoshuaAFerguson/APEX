import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import { WorkspaceManager } from './workspace-manager';
import {
  Task,
  WorkspaceConfig,
  ContainerDefaults,
  ContainerConfig,
  ResourceLimits,
  generateTaskId,
} from '@apexcli/core';

// Mock external dependencies
vi.mock('fs/promises');
vi.mock('./worktree-manager');

const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readdir: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  rm: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  promises: mockFs,
  ...mockFs,
}));

describe('WorkspaceManager Container Config Merging', () => {
  let workspaceManager: WorkspaceManager;
  let projectPath: string;
  let mockContainerManager: any;
  let mockHealthMonitor: any;
  let mockDependencyDetector: any;

  beforeEach(async () => {
    projectPath = path.join(os.tmpdir(), `apex-test-${Date.now()}`);

    // Setup fs mocks
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.access.mockRejectedValue(new Error('File not found')); // No custom Dockerfile by default

    // Mock container manager
    mockContainerManager = {
      createContainer: vi.fn().mockResolvedValue({
        success: true,
        containerId: 'test-container-id',
      }),
      listApexContainers: vi.fn().mockResolvedValue([]),
      stopContainer: vi.fn().mockResolvedValue(undefined),
      removeContainer: vi.fn().mockResolvedValue(undefined),
      execCommand: vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'success',
        stderr: '',
      }),
      startEventsMonitoring: vi.fn().mockResolvedValue(undefined),
      stopEventsMonitoring: vi.fn().mockResolvedValue(undefined),
      isEventsMonitoringActive: vi.fn().mockReturnValue(false),
    };

    // Mock health monitor
    mockHealthMonitor = {
      startMonitoring: vi.fn().mockResolvedValue(undefined),
      stopMonitoring: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn().mockReturnValue({}),
      getContainerHealth: vi.fn().mockReturnValue(null),
    };

    // Mock dependency detector
    mockDependencyDetector = {
      detectPackageManagers: vi.fn().mockResolvedValue({
        primaryManager: {
          type: 'npm',
          language: 'javascript',
          installCommand: 'npm install',
        },
      }),
    };
  });

  afterEach(async () => {
    if (workspaceManager) {
      await workspaceManager.cleanup();
    }
    vi.clearAllMocks();
  });

  describe('Container defaults merging', () => {
    it('should merge global container defaults with task-specific config', async () => {
      const containerDefaults: ContainerDefaults = {
        image: 'node:20-alpine',
        resourceLimits: {
          cpu: 1,
          memory: '512m',
        },
        networkMode: 'bridge',
        environment: {
          NODE_ENV: 'development',
          GLOBAL_VAR: 'global_value',
        },
        autoRemove: true,
        installTimeout: 300000,
      };

      workspaceManager = new WorkspaceManager({
        projectPath,
        defaultStrategy: 'directory',
        containerDefaults,
      });

      // Mock the container manager and other dependencies
      (workspaceManager as any).containerManager = mockContainerManager;
      (workspaceManager as any).healthMonitor = mockHealthMonitor;
      (workspaceManager as any).dependencyDetector = mockDependencyDetector;
      (workspaceManager as any).containerRuntimeType = 'docker';

      await workspaceManager.initialize();

      const task: Task = {
        id: generateTaskId(),
        title: 'Test task',
        description: 'Test task description',
        status: 'pending',
        createdAt: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'python:3.11-slim', // Override global default
            resourceLimits: {
              memory: '1g', // Override memory, keep global CPU
            },
            environment: {
              NODE_ENV: 'production', // Override global value
              TASK_VAR: 'task_value', // Add task-specific var
            },
            // networkMode, autoRemove, installTimeout should come from defaults
          },
        } as WorkspaceConfig,
      };

      await workspaceManager.createWorkspace(task);

      // Verify createContainer was called with merged config
      expect(mockContainerManager.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            // Task overrides should take precedence
            image: 'python:3.11-slim',
            resourceLimits: {
              cpu: 1, // From defaults
              memory: '1g', // From task override
            },
            environment: {
              NODE_ENV: 'production', // Task override
              GLOBAL_VAR: 'global_value', // From defaults
              TASK_VAR: 'task_value', // Task-specific
            },
            // Should get defaults for unspecified fields
            networkMode: 'bridge',
            autoRemove: true,
            installTimeout: 300000,
          }),
        })
      );
    });

    it('should use fallback defaults when no global defaults are provided', async () => {
      workspaceManager = new WorkspaceManager({
        projectPath,
        defaultStrategy: 'directory',
        // No containerDefaults provided
      });

      (workspaceManager as any).containerManager = mockContainerManager;
      (workspaceManager as any).healthMonitor = mockHealthMonitor;
      (workspaceManager as any).dependencyDetector = mockDependencyDetector;
      (workspaceManager as any).containerRuntimeType = 'docker';

      await workspaceManager.initialize();

      const task: Task = {
        id: generateTaskId(),
        title: 'Test task',
        description: 'Test task description',
        status: 'pending',
        createdAt: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'alpine:latest',
          },
        } as WorkspaceConfig,
      };

      await workspaceManager.createWorkspace(task);

      // Verify createContainer was called with fallback defaults
      expect(mockContainerManager.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            image: 'alpine:latest',
            networkMode: 'bridge', // Fallback default
            autoRemove: true, // Fallback default
            // No global defaults to merge
            resourceLimits: {},
            environment: {},
          }),
        })
      );
    });

    it('should handle complex resourceLimits merging correctly', async () => {
      const containerDefaults: ContainerDefaults = {
        resourceLimits: {
          cpu: 2,
          memory: '1g',
          cpuShares: 1024,
          pidsLimit: 200,
        },
      };

      workspaceManager = new WorkspaceManager({
        projectPath,
        defaultStrategy: 'directory',
        containerDefaults,
      });

      (workspaceManager as any).containerManager = mockContainerManager;
      (workspaceManager as any).healthMonitor = mockHealthMonitor;
      (workspaceManager as any).dependencyDetector = mockDependencyDetector;
      (workspaceManager as any).containerRuntimeType = 'docker';

      await workspaceManager.initialize();

      const task: Task = {
        id: generateTaskId(),
        title: 'Test task',
        description: 'Test task description',
        status: 'pending',
        createdAt: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:18',
            resourceLimits: {
              memory: '2g', // Override
              memoryReservation: '1g', // Add new field
              // cpu, cpuShares, pidsLimit should come from defaults
            },
          },
        } as WorkspaceConfig,
      };

      await workspaceManager.createWorkspace(task);

      expect(mockContainerManager.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            resourceLimits: {
              cpu: 2, // From defaults
              memory: '2g', // Task override
              cpuShares: 1024, // From defaults
              pidsLimit: 200, // From defaults
              memoryReservation: '1g', // Task-specific
            },
          }),
        })
      );
    });

    it('should preserve task config precedence over global defaults', async () => {
      const containerDefaults: ContainerDefaults = {
        image: 'default-image:latest',
        networkMode: 'host',
        autoRemove: false,
        installTimeout: 300000,
        environment: {
          DEFAULT_VAR: 'default_value',
          OVERRIDE_VAR: 'should_be_overridden',
        },
        resourceLimits: {
          cpu: 1,
          memory: '512m',
        },
      };

      workspaceManager = new WorkspaceManager({
        projectPath,
        defaultStrategy: 'directory',
        containerDefaults,
      });

      (workspaceManager as any).containerManager = mockContainerManager;
      (workspaceManager as any).healthMonitor = mockHealthMonitor;
      (workspaceManager as any).dependencyDetector = mockDependencyDetector;
      (workspaceManager as any).containerRuntimeType = 'docker';

      await workspaceManager.initialize();

      const task: Task = {
        id: generateTaskId(),
        title: 'Test task',
        description: 'Test task description',
        status: 'pending',
        createdAt: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'task-specific-image:v1.0',
            networkMode: 'bridge',
            autoRemove: true,
            installTimeout: 600000,
            environment: {
              OVERRIDE_VAR: 'task_override_value',
              TASK_SPECIFIC_VAR: 'task_value',
            },
            resourceLimits: {
              cpu: 4,
              memory: '2g',
            },
          },
        } as WorkspaceConfig,
      };

      await workspaceManager.createWorkspace(task);

      expect(mockContainerManager.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            // All task values should take precedence
            image: 'task-specific-image:v1.0',
            networkMode: 'bridge',
            autoRemove: true,
            installTimeout: 600000,
            resourceLimits: {
              cpu: 4,
              memory: '2g',
            },
            environment: {
              DEFAULT_VAR: 'default_value', // From defaults (not overridden)
              OVERRIDE_VAR: 'task_override_value', // Task override
              TASK_SPECIFIC_VAR: 'task_value', // Task-specific
            },
          }),
        })
      );
    });

    it('should handle minimal task container config with extensive defaults', async () => {
      const containerDefaults: ContainerDefaults = {
        image: 'node:20-alpine',
        resourceLimits: {
          cpu: 2,
          memory: '1g',
          cpuShares: 2048,
          pidsLimit: 500,
        },
        networkMode: 'bridge',
        environment: {
          NODE_ENV: 'development',
          DEBUGGING: 'true',
          LOG_LEVEL: 'info',
        },
        autoRemove: true,
        installTimeout: 420000,
      };

      workspaceManager = new WorkspaceManager({
        projectPath,
        defaultStrategy: 'directory',
        containerDefaults,
      });

      (workspaceManager as any).containerManager = mockContainerManager;
      (workspaceManager as any).healthMonitor = mockHealthMonitor;
      (workspaceManager as any).dependencyDetector = mockDependencyDetector;
      (workspaceManager as any).containerRuntimeType = 'docker';

      await workspaceManager.initialize();

      const task: Task = {
        id: generateTaskId(),
        title: 'Test task',
        description: 'Test task description',
        status: 'pending',
        createdAt: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            // Only specify an image override, everything else from defaults
            image: 'python:3.11-slim',
          },
        } as WorkspaceConfig,
      };

      await workspaceManager.createWorkspace(task);

      expect(mockContainerManager.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            // Override
            image: 'python:3.11-slim',
            // All from defaults
            resourceLimits: {
              cpu: 2,
              memory: '1g',
              cpuShares: 2048,
              pidsLimit: 500,
            },
            networkMode: 'bridge',
            environment: {
              NODE_ENV: 'development',
              DEBUGGING: 'true',
              LOG_LEVEL: 'info',
            },
            autoRemove: true,
            installTimeout: 420000,
          }),
        })
      );
    });

    it('should handle empty container defaults', async () => {
      const containerDefaults: ContainerDefaults = {};

      workspaceManager = new WorkspaceManager({
        projectPath,
        defaultStrategy: 'directory',
        containerDefaults,
      });

      (workspaceManager as any).containerManager = mockContainerManager;
      (workspaceManager as any).healthMonitor = mockHealthMonitor;
      (workspaceManager as any).dependencyDetector = mockDependencyDetector;
      (workspaceManager as any).containerRuntimeType = 'docker';

      await workspaceManager.initialize();

      const task: Task = {
        id: generateTaskId(),
        title: 'Test task',
        description: 'Test task description',
        status: 'pending',
        createdAt: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'ubuntu:22.04',
            environment: {
              CUSTOM_VAR: 'custom_value',
            },
          },
        } as WorkspaceConfig,
      };

      await workspaceManager.createWorkspace(task);

      expect(mockContainerManager.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            image: 'ubuntu:22.04',
            environment: {
              CUSTOM_VAR: 'custom_value',
            },
            // Fallback defaults
            networkMode: 'bridge',
            autoRemove: true,
            // Empty merges
            resourceLimits: {},
          }),
        })
      );
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle missing container section in workspace config', async () => {
      const containerDefaults: ContainerDefaults = {
        image: 'default-image:latest',
        resourceLimits: { cpu: 1, memory: '512m' },
      };

      workspaceManager = new WorkspaceManager({
        projectPath,
        defaultStrategy: 'directory',
        containerDefaults,
      });

      (workspaceManager as any).containerManager = mockContainerManager;
      (workspaceManager as any).healthMonitor = mockHealthMonitor;
      (workspaceManager as any).dependencyDetector = mockDependencyDetector;
      (workspaceManager as any).containerRuntimeType = 'docker';

      await workspaceManager.initialize();

      const task: Task = {
        id: generateTaskId(),
        title: 'Test task',
        description: 'Test task description',
        status: 'pending',
        createdAt: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          // No container config specified
        } as WorkspaceConfig,
      };

      // Should throw error when container strategy requires container config
      await expect(workspaceManager.createWorkspace(task)).rejects.toThrow(
        'Container configuration required for container strategy'
      );
    });

    it('should handle null/undefined values in merging correctly', async () => {
      const containerDefaults: ContainerDefaults = {
        image: 'default-image:latest',
        resourceLimits: {
          cpu: 2,
          memory: '1g',
        },
        environment: {
          DEFAULT_VAR: 'default',
        },
      };

      workspaceManager = new WorkspaceManager({
        projectPath,
        defaultStrategy: 'directory',
        containerDefaults,
      });

      (workspaceManager as any).containerManager = mockContainerManager;
      (workspaceManager as any).healthMonitor = mockHealthMonitor;
      (workspaceManager as any).dependencyDetector = mockDependencyDetector;
      (workspaceManager as any).containerRuntimeType = 'docker';

      await workspaceManager.initialize();

      const task: Task = {
        id: generateTaskId(),
        title: 'Test task',
        description: 'Test task description',
        status: 'pending',
        createdAt: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'task-image:latest',
            resourceLimits: undefined, // Explicitly undefined
            environment: undefined, // Explicitly undefined
          },
        } as WorkspaceConfig,
      };

      await workspaceManager.createWorkspace(task);

      expect(mockContainerManager.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            image: 'task-image:latest',
            // Should still get defaults even when task values are undefined
            resourceLimits: {
              cpu: 2,
              memory: '1g',
            },
            environment: {
              DEFAULT_VAR: 'default',
            },
          }),
        })
      );
    });
  });
});