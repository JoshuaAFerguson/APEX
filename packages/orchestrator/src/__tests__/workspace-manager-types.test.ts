import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceManager } from '../workspace-manager';
import { Task, TaskStatus, WorkspaceConfig, ContainerConfig } from '@apexcli/core';
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

describe('WorkspaceManager Type Safety and Interface Validation', () => {
  let workspaceManager: WorkspaceManager;
  let projectPath: string;
  let apexDir: string;

  beforeEach(async () => {
    projectPath = join(tmpdir(), `apex-test-${Date.now()}`);
    apexDir = join(projectPath, '.apex');

    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(apexDir, { recursive: true });

    workspaceManager = new WorkspaceManager({
      projectPath,
      defaultStrategy: 'directory',
    });

    const mockContainerManager = {
      createContainer: vi.fn().mockResolvedValue({ success: true }),
    };
    (workspaceManager as any).containerManager = mockContainerManager;
    (workspaceManager as any).containerRuntimeType = 'docker';
  });

  afterEach(async () => {
    try {
      await fs.rm(projectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Container Configuration Types', () => {
    it('should accept valid ContainerConfig with dockerfile properties', async () => {
      const validContainerConfig: ContainerConfig = {
        image: 'node:20-alpine',
        dockerfile: '.apex/Dockerfile',
        buildContext: '/workspace',
        volumes: { '/src': '/app' },
        environment: { NODE_ENV: 'test' },
        workingDir: '/app',
        autoRemove: true,
        ports: { '3000': '3000' },
        labels: { 'test.label': 'value' },
      };

      const task: Task = {
        id: 'type-test-1',
        description: 'Type validation test',
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
          container: validContainerConfig,
        } as WorkspaceConfig,
      };

      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      await expect(workspaceManager.createWorkspace(task)).resolves.toBeDefined();

      // Verify the captured config maintains type structure
      expect(typeof capturedConfig.image).toBe('string');
      expect(typeof capturedConfig.volumes).toBe('object');
      expect(typeof capturedConfig.environment).toBe('object');
      expect(typeof capturedConfig.workingDir).toBe('string');
      expect(typeof capturedConfig.autoRemove).toBe('boolean');
    });

    it('should handle minimal ContainerConfig', async () => {
      const minimalConfig: ContainerConfig = {
        image: 'alpine:latest',
      };

      const task: Task = {
        id: 'type-test-2',
        description: 'Minimal config test',
        workflow: 'test',
        autonomy: 'review-before-commit',
        status: 'pending',
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
          container: minimalConfig,
        },
      };

      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      await workspaceManager.createWorkspace(task);

      expect(capturedConfig.image).toBe('alpine:latest');
      expect(capturedConfig.volumes).toEqual({ [projectPath]: '/workspace' });
      expect(capturedConfig.workingDir).toBe('/workspace');
    });

    it('should properly merge dockerfile configuration types', async () => {
      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, 'FROM node:20-alpine');

      const containerConfig: ContainerConfig = {
        image: 'node:18-alpine',
        volumes: {
          '/custom': '/app/custom',
        },
        environment: {
          NODE_ENV: 'production',
        },
      };

      const task: Task = {
        id: 'type-test-3',
        description: 'Dockerfile merge test',
        workflow: 'test',
        autonomy: 'review-before-commit',
        status: 'pending',
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
          container: containerConfig,
        },
      };

      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      await workspaceManager.createWorkspace(task);

      // Verify types are preserved after merge
      expect(typeof capturedConfig.dockerfile).toBe('string');
      expect(typeof capturedConfig.buildContext).toBe('string');
      expect(capturedConfig.dockerfile).toBe('.apex/Dockerfile');
      expect(capturedConfig.buildContext).toBe(projectPath);

      // Original config should be preserved
      expect(capturedConfig.image).toBe('node:18-alpine');
      expect(capturedConfig.environment).toEqual({ NODE_ENV: 'production' });
      expect(capturedConfig.volumes).toEqual({
        [projectPath]: '/workspace',
        '/custom': '/app/custom',
      });
    });
  });

  describe('WorkspaceConfig Interface Validation', () => {
    it('should validate container strategy workspace config', async () => {
      const workspaceConfig: WorkspaceConfig = {
        strategy: 'container',
        cleanup: true,
        container: {
          image: 'node:20-alpine',
          volumes: {},
          workingDir: '/workspace',
        },
      };

      const task: Task = {
        id: 'workspace-config-test',
        description: 'Workspace config validation',
        workflow: 'test',
        autonomy: 'review-before-commit',
        status: 'pending',
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
        workspace: workspaceConfig,
      };

      // This should compile without TypeScript errors
      await expect(workspaceManager.createWorkspace(task)).resolves.toBeDefined();
    });

    it('should handle undefined container config gracefully', async () => {
      const task: Task = {
        id: 'undefined-config-test',
        description: 'Undefined container config test',
        workflow: 'test',
        autonomy: 'review-before-commit',
        status: 'pending',
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
          // container config is undefined
        },
      };

      await expect(workspaceManager.createWorkspace(task)).rejects.toThrow(
        'Container configuration required for container strategy'
      );
    });
  });

  describe('Return Type Validation', () => {
    it('should return WorkspaceInfo with correct types', async () => {
      const task: Task = {
        id: 'return-type-test',
        description: 'Return type validation',
        workflow: 'test',
        autonomy: 'review-before-commit',
        status: 'pending',
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
        },
      };

      const result = await workspaceManager.createWorkspace(task);

      // Verify return type structure
      expect(typeof result.taskId).toBe('string');
      expect(typeof result.workspacePath).toBe('string');
      expect(typeof result.status).toBe('string');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.lastAccessed).toBeInstanceOf(Date);
      expect(typeof result.config).toBe('object');
      expect(result.config.strategy).toBe('directory');
      expect(typeof result.config.cleanup).toBe('boolean');
    });

    it('should return null for non-existent workspace', () => {
      const result = workspaceManager.getWorkspace('non-existent-task');
      expect(result).toBeNull();
    });
  });

  describe('TypeScript Compilation Tests', () => {
    it('should compile with proper type annotations', () => {
      // These should compile without TypeScript errors
      const manager: WorkspaceManager = workspaceManager;
      const projectPath: string = '/test/path';
      const defaultStrategy: WorkspaceConfig['strategy'] = 'container';

      expect(manager).toBeDefined();
      expect(typeof projectPath).toBe('string');
      expect(typeof defaultStrategy).toBe('string');
    });

    it('should enforce type safety for strategy values', () => {
      // This test ensures only valid strategy values are accepted
      const validStrategies: WorkspaceConfig['strategy'][] = [
        'container',
        'worktree',
        'directory',
        'none',
      ];

      for (const strategy of validStrategies) {
        const config: WorkspaceConfig = {
          strategy,
          cleanup: true,
        };
        expect(config.strategy).toBe(strategy);
      }
    });
  });
});