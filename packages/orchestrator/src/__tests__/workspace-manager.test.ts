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

describe('WorkspaceManager Dockerfile Detection', () => {
  let workspaceManager: WorkspaceManager;
  let projectPath: string;
  let apexDir: string;

  const createMockTask = (containerConfig?: any): Task => ({
    id: `test-task-${Date.now()}`,
    description: 'Test task for dockerfile detection',
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

  beforeEach(async () => {
    // Create temporary project directory
    projectPath = join(tmpdir(), `apex-test-${Date.now()}`);
    apexDir = join(projectPath, '.apex');

    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(apexDir, { recursive: true });

    workspaceManager = new WorkspaceManager({
      projectPath,
      defaultStrategy: 'directory',
    });

    // Mock container manager to avoid actual container operations
    const mockContainerManager = {
      createContainer: vi.fn().mockResolvedValue({ success: true }),
      execCommand: vi.fn().mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 }),
    };
    (workspaceManager as any).containerManager = mockContainerManager;
    (workspaceManager as any).containerRuntimeType = 'docker';

    // Mock dependency detector to avoid filesystem operations
    const mockDependencyDetector = {
      detectPackageManagers: vi.fn().mockResolvedValue({ primaryManager: null }),
    };
    (workspaceManager as any).dependencyDetector = mockDependencyDetector;
  });

  afterEach(async () => {
    // Clean up temporary directories
    try {
      await fs.rm(projectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Dockerfile Detection', () => {
    it('should detect .apex/Dockerfile when present', async () => {
      // Create a mock Dockerfile
      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, 'FROM node:20-alpine\nRUN echo "test"');

      // Create mock task
      const task = createMockTask();

      // Mock the containerManager.createContainer to capture the config
      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      // Create workspace
      await workspaceManager.createWorkspace(task);

      // Verify dockerfile was detected and set
      expect(capturedConfig.dockerfile).toBe('.apex/Dockerfile');
      expect(capturedConfig.buildContext).toBe(projectPath);
    });

    it('should use default image when no Dockerfile exists', async () => {
      // Ensure no Dockerfile exists
      const dockerfilePath = join(apexDir, 'Dockerfile');
      try {
        await fs.unlink(dockerfilePath);
      } catch {
        // File might not exist, that's fine
      }

      // Create mock task without explicit image
      const task = createMockTask({ image: undefined });

      // Mock the containerManager.createContainer to capture the config
      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      // Create workspace
      await workspaceManager.createWorkspace(task);

      // Verify default image is used
      expect(capturedConfig.image).toBe('node:20-alpine');
      expect(capturedConfig.dockerfile).toBeUndefined();
      expect(capturedConfig.buildContext).toBeUndefined();
    });

    it('should use specified image when no Dockerfile exists but image is configured', async () => {
      // Ensure no Dockerfile exists
      const dockerfilePath = join(apexDir, 'Dockerfile');
      try {
        await fs.unlink(dockerfilePath);
      } catch {
        // File might not exist, that's fine
      }

      // Create mock task with explicit image
      const customImage = 'python:3.11-slim';
      const task = createMockTask({ image: customImage });

      // Mock the containerManager.createContainer to capture the config
      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      // Create workspace
      await workspaceManager.createWorkspace(task);

      // Verify specified image is used
      expect(capturedConfig.image).toBe(customImage);
      expect(capturedConfig.dockerfile).toBeUndefined();
      expect(capturedConfig.buildContext).toBeUndefined();
    });

    it('should preserve existing container configuration when using Dockerfile', async () => {
      // Create a mock Dockerfile
      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, 'FROM node:20-alpine\nRUN echo "test"');

      // Create mock task with additional configuration
      const task = createMockTask({
        environment: { NODE_ENV: 'test' },
        labels: { 'custom.label': 'test-value' },
        ports: { '3000': '3000' },
      });

      // Mock the containerManager.createContainer to capture the config
      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      // Create workspace
      await workspaceManager.createWorkspace(task);

      // Verify Dockerfile settings are added
      expect(capturedConfig.dockerfile).toBe('.apex/Dockerfile');
      expect(capturedConfig.buildContext).toBe(projectPath);

      // Verify existing configuration is preserved
      expect(capturedConfig.environment).toEqual({ NODE_ENV: 'test' });
      expect(capturedConfig.labels).toEqual(
        expect.objectContaining({ 'custom.label': 'test-value' })
      );
      expect(capturedConfig.ports).toEqual({ '3000': '3000' });

      // Verify APEX labels are still added
      expect(capturedConfig.labels).toEqual(
        expect.objectContaining({
          'apex.task-id': task.id,
          'apex.workspace-type': 'container',
        })
      );
    });
  });

  describe('fileExists utility method', () => {
    it('should return true for existing files', async () => {
      // Create a test file
      const testFilePath = join(projectPath, 'test-file.txt');
      await fs.writeFile(testFilePath, 'test content');

      // Test fileExists method (access private method for testing)
      const result = await (workspaceManager as any).fileExists(testFilePath);

      expect(result).toBe(true);
    });

    it('should return false for non-existing files', async () => {
      // Use a path that doesn't exist
      const nonExistentPath = join(projectPath, 'non-existent-file.txt');

      // Test fileExists method (access private method for testing)
      const result = await (workspaceManager as any).fileExists(nonExistentPath);

      expect(result).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    beforeEach(async () => {
      await workspaceManager.initialize();
    });

    it('should complete full workflow with Dockerfile detection', async () => {
      // Create a realistic Dockerfile
      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, `
FROM node:20-alpine
WORKDIR /workspace
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
      `.trim());

      // Create realistic task
      const task = createMockTask({
        environment: {
          NODE_ENV: 'production',
          PORT: '3000',
        },
        ports: {
          '3000': '3000',
        },
      });

      // Create workspace
      const workspaceInfo = await workspaceManager.createWorkspace(task);

      // Verify workspace was created
      expect(workspaceInfo).toBeDefined();
      expect(workspaceInfo.taskId).toBe(task.id);
      expect(workspaceInfo.config.strategy).toBe('container');
      expect(workspaceInfo.status).toBe('active');

      // Verify container manager was called
      expect((workspaceManager as any).containerManager.createContainer).toHaveBeenCalled();
    });
  });

  describe('Container ID Management', () => {
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
  });
});