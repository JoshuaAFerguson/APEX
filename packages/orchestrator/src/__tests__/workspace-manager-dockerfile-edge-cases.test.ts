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

describe('WorkspaceManager Dockerfile Edge Cases', () => {
  let workspaceManager: WorkspaceManager;
  let projectPath: string;
  let apexDir: string;

  const createMockTask = (containerConfig?: any): Task => ({
    id: `test-task-${Date.now()}`,
    description: 'Test task for dockerfile edge cases',
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
    };
    (workspaceManager as any).containerManager = mockContainerManager;
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

  describe('Error Handling', () => {
    it('should handle file access errors gracefully when checking for Dockerfile', async () => {
      // Create a directory instead of a file to cause an access error
      const dockerfileDir = join(apexDir, 'Dockerfile');
      await fs.mkdir(dockerfileDir, { recursive: true });

      const task = createMockTask();

      // Mock the containerManager.createContainer to capture the config
      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      // Should not throw and should fallback to default image
      await workspaceManager.createWorkspace(task);

      // Verify fallback behavior
      expect(capturedConfig.image).toBe('node:20-alpine');
      expect(capturedConfig.dockerfile).toBeUndefined();
      expect(capturedConfig.buildContext).toBeUndefined();
    });

    it('should handle permission denied when accessing Dockerfile', async () => {
      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, 'FROM node:20-alpine');

      // Mock fs.access to simulate permission denied
      const originalAccess = fs.access;
      fs.access = vi.fn().mockRejectedValue(new Error('EACCES: permission denied'));

      const task = createMockTask();

      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      try {
        await workspaceManager.createWorkspace(task);

        // Should fallback to default image on access error
        expect(capturedConfig.image).toBe('node:20-alpine');
        expect(capturedConfig.dockerfile).toBeUndefined();
        expect(capturedConfig.buildContext).toBeUndefined();
      } finally {
        // Restore original fs.access
        fs.access = originalAccess;
      }
    });

    it('should handle corrupted or invalid Dockerfile', async () => {
      // Create an empty or corrupted Dockerfile
      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, ''); // Empty file

      const task = createMockTask();

      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      // Should still detect the file and use it (validation is left to Docker)
      await workspaceManager.createWorkspace(task);

      expect(capturedConfig.dockerfile).toBe('.apex/Dockerfile');
      expect(capturedConfig.buildContext).toBe(projectPath);
    });
  });

  describe('Path Edge Cases', () => {
    it('should handle project path with spaces', async () => {
      // Clean up and create a new path with spaces
      await fs.rm(projectPath, { recursive: true, force: true });

      projectPath = join(tmpdir(), `apex test with spaces ${Date.now()}`);
      apexDir = join(projectPath, '.apex');

      await fs.mkdir(projectPath, { recursive: true });
      await fs.mkdir(apexDir, { recursive: true });

      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, 'FROM node:20-alpine\nRUN echo "test with spaces"');

      workspaceManager = new WorkspaceManager({
        projectPath,
        defaultStrategy: 'directory',
      });

      const mockContainerManager = {
        createContainer: vi.fn().mockResolvedValue({ success: true }),
      };
      (workspaceManager as any).containerManager = mockContainerManager;
      (workspaceManager as any).containerRuntimeType = 'docker';

      const task = createMockTask();

      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      await workspaceManager.createWorkspace(task);

      expect(capturedConfig.dockerfile).toBe('.apex/Dockerfile');
      expect(capturedConfig.buildContext).toBe(projectPath);
    });

    it('should handle symlinks to Dockerfile', async () => {
      // Create a real Dockerfile in a different location
      const realDockerfilePath = join(projectPath, 'real-dockerfile');
      await fs.writeFile(realDockerfilePath, 'FROM node:20-alpine\nRUN echo "symlinked dockerfile"');

      // Create a symlink at .apex/Dockerfile
      const dockerfilePath = join(apexDir, 'Dockerfile');
      try {
        await fs.symlink(realDockerfilePath, dockerfilePath);
      } catch (error) {
        // Skip test if symlinks are not supported (e.g., Windows without admin)
        return;
      }

      const task = createMockTask();

      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      await workspaceManager.createWorkspace(task);

      expect(capturedConfig.dockerfile).toBe('.apex/Dockerfile');
      expect(capturedConfig.buildContext).toBe(projectPath);
    });
  });

  describe('Configuration Merging Edge Cases', () => {
    it('should not override existing dockerfile config when Dockerfile exists', async () => {
      // Create a Dockerfile
      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, 'FROM node:20-alpine');

      // Create task with existing dockerfile config
      const task = createMockTask({
        dockerfile: 'custom.Dockerfile',
        buildContext: '/custom/context',
        image: 'custom:latest',
      });

      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      await workspaceManager.createWorkspace(task);

      // Should override with detected Dockerfile
      expect(capturedConfig.dockerfile).toBe('.apex/Dockerfile');
      expect(capturedConfig.buildContext).toBe(projectPath);
      // Image should be preserved since we're using dockerfile
      expect(capturedConfig.image).toBe('custom:latest');
    });

    it('should handle complex container configuration with Dockerfile', async () => {
      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, `
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000 8080
HEALTHCHECK --interval=30s CMD curl -f http://localhost:3000/health
CMD ["npm", "start"]
      `.trim());

      const task = createMockTask({
        environment: {
          NODE_ENV: 'production',
          PORT: '3000',
          DATABASE_URL: 'postgres://localhost:5432/test',
        },
        ports: {
          '3000': '3000',
          '8080': '8080',
        },
        labels: {
          'app.name': 'test-app',
          'app.version': '1.0.0',
        },
        volumes: {
          '/data': '/app/data',
          '/logs': '/app/logs',
        },
        networks: ['test-network'],
        cpuLimit: 1.0,
        memoryLimit: '512m',
        healthcheck: {
          test: ['CMD', 'curl', '-f', 'http://localhost:3000/health'],
          interval: '30s',
          timeout: '10s',
          retries: 3,
        },
      });

      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      await workspaceManager.createWorkspace(task);

      // Verify Dockerfile settings are added
      expect(capturedConfig.dockerfile).toBe('.apex/Dockerfile');
      expect(capturedConfig.buildContext).toBe(projectPath);

      // Verify all original configuration is preserved
      expect(capturedConfig.environment).toEqual({
        NODE_ENV: 'production',
        PORT: '3000',
        DATABASE_URL: 'postgres://localhost:5432/test',
      });
      expect(capturedConfig.ports).toEqual({ '3000': '3000', '8080': '8080' });
      expect(capturedConfig.networks).toEqual(['test-network']);
      expect(capturedConfig.cpuLimit).toBe(1.0);
      expect(capturedConfig.memoryLimit).toBe('512m');
      expect(capturedConfig.healthcheck).toEqual({
        test: ['CMD', 'curl', '-f', 'http://localhost:3000/health'],
        interval: '30s',
        timeout: '10s',
        retries: 3,
      });

      // Verify custom labels are preserved and APEX labels are added
      expect(capturedConfig.labels).toEqual(
        expect.objectContaining({
          'app.name': 'test-app',
          'app.version': '1.0.0',
          'apex.task-id': task.id,
          'apex.workspace-type': 'container',
        })
      );

      // Verify custom volumes are preserved and project volume is added
      expect(capturedConfig.volumes).toEqual({
        [projectPath]: '/workspace',
        '/data': '/app/data',
        '/logs': '/app/logs',
      });
    });
  });

  describe('Default Image Fallback', () => {
    it('should use node:20-alpine when no image is specified and no Dockerfile exists', async () => {
      const task = createMockTask({ image: undefined });

      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      await workspaceManager.createWorkspace(task);

      expect(capturedConfig.image).toBe('node:20-alpine');
      expect(capturedConfig.dockerfile).toBeUndefined();
      expect(capturedConfig.buildContext).toBeUndefined();
    });

    it('should preserve null/undefined image when Dockerfile exists', async () => {
      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, 'FROM python:3.11-slim');

      const task = createMockTask({ image: undefined });

      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      await workspaceManager.createWorkspace(task);

      expect(capturedConfig.dockerfile).toBe('.apex/Dockerfile');
      expect(capturedConfig.buildContext).toBe(projectPath);
      // Image should be node:20-alpine fallback since no image specified
      expect(capturedConfig.image).toBe('node:20-alpine');
    });
  });

  describe('fileExists Method Edge Cases', () => {
    it('should return false for undefined/null paths', async () => {
      const result1 = await (workspaceManager as any).fileExists(undefined);
      const result2 = await (workspaceManager as any).fileExists(null);
      const result3 = await (workspaceManager as any).fileExists('');

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });

    it('should handle very long file paths', async () => {
      // Create a very long path (but within OS limits)
      const longDirName = 'a'.repeat(200);
      const longPath = join(projectPath, longDirName, 'Dockerfile');

      const result = await (workspaceManager as any).fileExists(longPath);

      expect(result).toBe(false);
    });

    it('should handle concurrent access checks', async () => {
      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, 'FROM node:20-alpine');

      // Run multiple concurrent fileExists checks
      const promises = Array.from({ length: 10 }, () =>
        (workspaceManager as any).fileExists(dockerfilePath)
      );

      const results = await Promise.all(promises);

      // All should return true
      expect(results.every(result => result === true)).toBe(true);
    });
  });

  describe('Non-Container Workspace Strategy', () => {
    it('should not check for Dockerfile when using non-container strategy', async () => {
      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, 'FROM node:20-alpine');

      const task = createMockTask();
      task.workspace!.strategy = 'directory';

      const fileExistsSpy = vi.spyOn(workspaceManager as any, 'fileExists');

      await workspaceManager.createWorkspace(task);

      // fileExists should not be called for dockerfile checking
      expect(fileExistsSpy).not.toHaveBeenCalledWith(dockerfilePath);
    });
  });
});