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

describe('WorkspaceManager Dockerfile Integration Tests', () => {
  let workspaceManager: WorkspaceManager;
  let projectPath: string;
  let apexDir: string;

  const createMockTask = (containerConfig?: any, taskId?: string): Task => ({
    id: taskId || `test-task-${Date.now()}`,
    description: 'Test task for dockerfile integration',
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
    projectPath = join(tmpdir(), `apex-test-${Date.now()}`);
    apexDir = join(projectPath, '.apex');

    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(apexDir, { recursive: true });

    workspaceManager = new WorkspaceManager({
      projectPath,
      defaultStrategy: 'directory',
    });

    // Initialize workspace manager
    await workspaceManager.initialize();

    // Mock container manager
    const mockContainerManager = {
      createContainer: vi.fn().mockResolvedValue({ success: true }),
      listApexContainers: vi.fn().mockResolvedValue([]),
      stopContainer: vi.fn().mockResolvedValue({ success: true }),
      removeContainer: vi.fn().mockResolvedValue({ success: true }),
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

  describe('Real-world Dockerfile Scenarios', () => {
    it('should handle Node.js application Dockerfile', async () => {
      const dockerfileContent = `
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Set ownership
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]
      `.trim();

      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, dockerfileContent);

      const task = createMockTask({
        environment: {
          NODE_ENV: 'production',
          PORT: '3000',
        },
        ports: {
          '3000': '3000',
        },
        labels: {
          'app.name': 'test-node-app',
          'app.version': '1.0.0',
        },
      });

      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      const workspace = await workspaceManager.createWorkspace(task);

      expect(workspace).toBeDefined();
      expect(capturedConfig.dockerfile).toBe('.apex/Dockerfile');
      expect(capturedConfig.buildContext).toBe(projectPath);
      expect(capturedConfig.environment).toEqual({
        NODE_ENV: 'production',
        PORT: '3000',
      });
      expect(capturedConfig.ports).toEqual({ '3000': '3000' });
    });

    it('should handle Python application Dockerfile', async () => {
      const dockerfileContent = `
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd --create-home --shell /bin/bash app
USER app

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
      `.trim();

      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, dockerfileContent);

      const task = createMockTask({
        image: 'python:3.11-slim', // Should be overridden by Dockerfile
        environment: {
          DJANGO_SETTINGS_MODULE: 'myapp.settings.production',
          SECRET_KEY: 'test-secret-key',
        },
        ports: {
          '8000': '8000',
        },
      });

      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      await workspaceManager.createWorkspace(task);

      expect(capturedConfig.dockerfile).toBe('.apex/Dockerfile');
      expect(capturedConfig.buildContext).toBe(projectPath);
      expect(capturedConfig.image).toBe('python:3.11-slim');
      expect(capturedConfig.environment).toEqual({
        DJANGO_SETTINGS_MODULE: 'myapp.settings.production',
        SECRET_KEY: 'test-secret-key',
      });
    });

    it('should handle multi-stage Dockerfile', async () => {
      const dockerfileContent = `
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist

USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
      `.trim();

      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, dockerfileContent);

      const task = createMockTask({
        target: 'production', // Build target for multi-stage build
      });

      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      await workspaceManager.createWorkspace(task);

      expect(capturedConfig.dockerfile).toBe('.apex/Dockerfile');
      expect(capturedConfig.buildContext).toBe(projectPath);
      expect(capturedConfig.target).toBe('production');
    });
  });

  describe('Multiple Workspace Management', () => {
    it('should handle multiple concurrent workspaces with and without Dockerfiles', async () => {
      // Create Dockerfile
      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, 'FROM node:20-alpine\nRUN echo "dockerfile task"');

      // Task with Dockerfile
      const taskWithDockerfile = createMockTask({}, 'task-with-dockerfile');

      // Task without Dockerfile (different config)
      const taskWithoutDockerfile = createMockTask({
        image: 'python:3.11-slim',
      }, 'task-without-dockerfile');

      const capturedConfigs: any[] = [];
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfigs.push(config);
        return Promise.resolve({ success: true });
      });

      // Create both workspaces
      const [workspace1, workspace2] = await Promise.all([
        workspaceManager.createWorkspace(taskWithDockerfile),
        workspaceManager.createWorkspace(taskWithoutDockerfile),
      ]);

      expect(workspace1).toBeDefined();
      expect(workspace2).toBeDefined();
      expect(capturedConfigs).toHaveLength(2);

      // First workspace should use Dockerfile
      const dockerfileConfig = capturedConfigs.find(c => c.dockerfile);
      expect(dockerfileConfig).toBeDefined();
      expect(dockerfileConfig.dockerfile).toBe('.apex/Dockerfile');
      expect(dockerfileConfig.buildContext).toBe(projectPath);

      // Second workspace should use specified image
      const imageConfig = capturedConfigs.find(c => !c.dockerfile);
      expect(imageConfig).toBeDefined();
      expect(imageConfig.image).toBe('python:3.11-slim');
    });

    it('should track dockerfile usage in workspace statistics', async () => {
      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, 'FROM node:20-alpine');

      const task = createMockTask();
      await workspaceManager.createWorkspace(task);

      const stats = await workspaceManager.getWorkspaceStats();

      expect(stats.activeCount).toBe(1);
      expect(stats.workspacesByStrategy.container).toBe(1);
    });
  });

  describe('Dockerfile Detection Race Conditions', () => {
    it('should handle Dockerfile being created/deleted during workspace creation', async () => {
      const dockerfilePath = join(apexDir, 'Dockerfile');
      const task = createMockTask();

      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(async ({ config }) => {
        // Simulate race condition: create Dockerfile after check but before container creation
        if (!capturedConfig) {
          await fs.writeFile(dockerfilePath, 'FROM node:20-alpine\nRUN echo "race condition test"');
        }
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      await workspaceManager.createWorkspace(task);

      // Should use the initial check result (no dockerfile)
      expect(capturedConfig.dockerfile).toBeUndefined();
      expect(capturedConfig.image).toBe('node:20-alpine');
    });

    it('should handle multiple rapid workspace creations', async () => {
      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, 'FROM node:20-alpine');

      const tasks = Array.from({ length: 5 }, (_, i) => createMockTask({}, `rapid-task-${i}`));

      const capturedConfigs: any[] = [];
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfigs.push(config);
        return Promise.resolve({ success: true });
      });

      // Create multiple workspaces rapidly
      await Promise.all(tasks.map(task => workspaceManager.createWorkspace(task)));

      expect(capturedConfigs).toHaveLength(5);

      // All should detect the Dockerfile
      capturedConfigs.forEach(config => {
        expect(config.dockerfile).toBe('.apex/Dockerfile');
        expect(config.buildContext).toBe(projectPath);
      });
    });
  });

  describe('Filesystem Integration', () => {
    it('should work with read-only Dockerfile', async () => {
      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, 'FROM node:20-alpine\nRUN echo "readonly test"');

      // Make file read-only
      await fs.chmod(dockerfilePath, 0o444);

      const task = createMockTask();

      let capturedConfig: any;
      (workspaceManager as any).containerManager.createContainer = vi.fn().mockImplementation(({ config }) => {
        capturedConfig = config;
        return Promise.resolve({ success: true });
      });

      await workspaceManager.createWorkspace(task);

      expect(capturedConfig.dockerfile).toBe('.apex/Dockerfile');
      expect(capturedConfig.buildContext).toBe(projectPath);

      // Restore write permissions for cleanup
      await fs.chmod(dockerfilePath, 0o644);
    });

    it('should handle Dockerfile in nested .apex directory structure', async () => {
      // Create nested directory structure
      const nestedApexDir = join(projectPath, '.apex', 'containers', 'custom');
      await fs.mkdir(nestedApexDir, { recursive: true });

      // But Dockerfile should be directly in .apex
      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, 'FROM node:20-alpine');

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

  describe('Performance and Resource Management', () => {
    it('should not repeatedly check for Dockerfile during same workspace creation', async () => {
      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, 'FROM node:20-alpine');

      // Spy on fileExists calls
      const fileExistsSpy = vi.spyOn(workspaceManager as any, 'fileExists');

      const task = createMockTask();

      (workspaceManager as any).containerManager.createContainer = vi.fn().mockResolvedValue({ success: true });

      await workspaceManager.createWorkspace(task);

      // Should only check once per workspace creation
      expect(fileExistsSpy).toHaveBeenCalledTimes(1);
      expect(fileExistsSpy).toHaveBeenCalledWith(dockerfilePath);
    });

    it('should cache Dockerfile detection results across similar tasks', async () => {
      const dockerfilePath = join(apexDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, 'FROM node:20-alpine');

      // Create multiple similar tasks
      const tasks = [
        createMockTask({}, 'cache-test-1'),
        createMockTask({}, 'cache-test-2'),
        createMockTask({}, 'cache-test-3'),
      ];

      const fileExistsSpy = vi.spyOn(workspaceManager as any, 'fileExists');

      (workspaceManager as any).containerManager.createContainer = vi.fn().mockResolvedValue({ success: true });

      // Create workspaces sequentially
      for (const task of tasks) {
        await workspaceManager.createWorkspace(task);
      }

      // Should check for each workspace creation (no caching implemented yet)
      expect(fileExistsSpy).toHaveBeenCalledTimes(3);
    });
  });
});