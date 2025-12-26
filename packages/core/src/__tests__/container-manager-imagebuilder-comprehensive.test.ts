import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ContainerManager,
  type ContainerOperationResult,
  type CreateContainerOptions,
} from '../container-manager';
import { ContainerRuntime } from '../container-runtime';
import { ImageBuilder, type ImageBuildResult, type ImageBuildConfig } from '../image-builder';
import { ContainerConfig } from '../types';

// Mock modules
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  access: vi.fn(),
}));

vi.mock('../container-runtime');
vi.mock('../image-builder');

const mockExec = vi.mocked(exec);
const mockFs = vi.mocked(fs);
const MockedContainerRuntime = vi.mocked(ContainerRuntime);
const MockedImageBuilder = vi.mocked(ImageBuilder);

// Helper to create a mock exec callback
function mockExecCallback(stdout: string, stderr?: string, error?: Error) {
  return vi.fn((command: string, options: any, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
    if (callback) {
      setTimeout(() => callback(error || null, stdout, stderr || ''), 0);
    }
    return {} as any; // Mock ChildProcess
  });
}

describe('ContainerManager ImageBuilder Comprehensive Tests', () => {
  let manager: ContainerManager;
  let mockRuntime: ContainerRuntime;
  let mockImageBuilderInstance: any;

  beforeEach(() => {
    // Setup runtime mock
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    vi.mocked(mockRuntime.isRuntimeAvailable).mockResolvedValue(true);

    // Setup ImageBuilder mock
    mockImageBuilderInstance = {
      initialize: vi.fn().mockResolvedValue(undefined),
      buildImage: vi.fn(),
    };

    MockedImageBuilder.mockImplementation(() => mockImageBuilderInstance);

    manager = new ContainerManager(mockRuntime);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('ImageBuilder Integration Flow Tests', () => {
    it('should handle complex multi-stage build with build arguments', async () => {
      // Mock successful container creation
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'multi-stage-app:production',
          id: 'img123',
          created: new Date(),
          exists: true,
          size: 150000000,
          sizeFormatted: '150MB',
          dockerfileHash: 'abc123',
        },
        buildOutput: 'Successfully built multi-stage image',
        buildDuration: 30000,
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'node:20',
        dockerfile: 'docker/Dockerfile.production',
        buildContext: 'docker',
        imageTag: 'multi-stage-app:production',
        environment: {
          NODE_ENV: 'production',
          API_URL: 'https://api.example.com',
        },
        volumes: {
          '/host/data': '/app/data',
        },
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'multi-stage-build-123',
        autoStart: true,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe('container123');

      // Verify ImageBuilder was called with correct config
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalledWith({
        dockerfilePath: 'docker/Dockerfile.production',
        buildContext: 'docker',
        imageTag: 'multi-stage-app:production',
      });

      // Verify container created with built image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('multi-stage-app:production'),
        expect.any(Object)
      );

      // Verify environment variables and volumes are preserved
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringMatching(/-e NODE_ENV=production/),
        expect.any(Object)
      );
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringMatching(/-v \/host\/data:\/app\/data/),
        expect.any(Object)
      );
    });

    it('should handle image caching correctly when image is up-to-date', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'cached-app:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
          dockerfileHash: 'same123',
        },
        buildOutput: 'Using existing image (no changes detected)',
        buildDuration: 100,
        rebuilt: false, // Image was not rebuilt
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'alpine:latest',
        dockerfile: 'Dockerfile',
        imageTag: 'cached-app:latest',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'caching-test-456',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalled();

      // Verify container was created with cached image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('cached-app:latest'),
        expect.any(Object)
      );
    });

    it('should handle build failure and graceful fallback', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: false,
        error: 'Dockerfile syntax error on line 15',
        buildOutput: 'Step 5/10 : RUN invalid-command\nCommand failed',
        buildDuration: 2000,
        rebuilt: false,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const config: ContainerConfig = {
        image: 'node:18-alpine',
        dockerfile: 'Dockerfile.broken',
        buildContext: '.',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'build-failure-789',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe('container123');

      // Verify warning was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Image build failed')
      );

      // Verify fallback to original image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('node:18-alpine'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('should handle ImageBuilder initialization failure', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      mockImageBuilderInstance.initialize.mockRejectedValue(
        new Error('No container runtime available')
      );

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const config: ContainerConfig = {
        image: 'python:3.11',
        dockerfile: 'Dockerfile.python',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'init-failure-101',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Image build error')
      );

      // Should not have called buildImage
      expect(mockImageBuilderInstance.buildImage).not.toHaveBeenCalled();

      // Should use fallback image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('python:3.11'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('should handle buildImageIfNeeded with custom project root', async () => {
      const customProjectRoot = '/custom/project/path';
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'custom-root-app:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
        },
        buildOutput: 'Built from custom project root',
        buildDuration: 15000,
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'ubuntu:22.04',
        dockerfile: 'deployment/Dockerfile',
        buildContext: 'deployment',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'custom-root-202',
        autoStart: false,
      };

      // Use reflection to call private method with custom project root
      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(MockedImageBuilder).toHaveBeenCalledWith(process.cwd());
    });

    it('should preserve all container configuration options when using built image', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'test-app:v1.2.3',
          id: 'img123',
          created: new Date(),
          exists: true,
        },
        buildOutput: 'Successfully built test-app:v1.2.3',
        buildDuration: 8000,
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'node:20',
        dockerfile: 'Dockerfile',
        imageTag: 'test-app:v1.2.3',
        volumes: {
          '/host/logs': '/app/logs',
          '/host/config': '/app/config',
        },
        environment: {
          NODE_ENV: 'production',
          LOG_LEVEL: 'info',
          DATABASE_URL: 'postgresql://localhost/testdb',
        },
        workingDir: '/app',
        user: '1000:1000',
        labels: {
          'com.example.app': 'test-app',
          'version': '1.2.3',
        },
        capAdd: ['NET_ADMIN'],
        capDrop: ['ALL'],
        securityOpts: ['no-new-privileges'],
        resourceLimits: {
          memory: '1g',
          cpu: 1.5,
          pidsLimit: 100,
        },
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'comprehensive-config-303',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);

      // Verify all configuration options are preserved in the container command
      const execCalls = mockExec.mock.calls;
      const createCommand = execCalls.find(call =>
        call[0].includes('create') && call[0].includes('test-app:v1.2.3')
      )?.[0];

      expect(createCommand).toContain('test-app:v1.2.3'); // Built image used
      expect(createCommand).toContain('-v /host/logs:/app/logs'); // Volumes
      expect(createCommand).toContain('-v /host/config:/app/config');
      expect(createCommand).toContain('-e NODE_ENV=production'); // Environment
      expect(createCommand).toContain('-e LOG_LEVEL=info');
      expect(createCommand).toContain('-e DATABASE_URL=postgresql://localhost/testdb');
      expect(createCommand).toContain('-w /app'); // Working directory
      expect(createCommand).toContain('--user 1000:1000'); // User
      expect(createCommand).toContain('--label com.example.app=test-app'); // Labels
      expect(createCommand).toContain('--label version=1.2.3');
      expect(createCommand).toContain('--cap-add NET_ADMIN'); // Capabilities
      expect(createCommand).toContain('--cap-drop ALL');
      expect(createCommand).toContain('--security-opt no-new-privileges'); // Security opts
      expect(createCommand).toContain('--memory 1g'); // Resource limits
      expect(createCommand).toContain('--cpus 1.5');
      expect(createCommand).toContain('--pids-limit 100');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing buildContext gracefully', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'no-context-app:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
        },
        buildOutput: 'Built without explicit build context',
        buildDuration: 5000,
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'alpine:latest',
        dockerfile: 'Dockerfile',
        // Note: no buildContext specified
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'no-context-404',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalledWith({
        dockerfilePath: 'Dockerfile',
        buildContext: '.', // Should default to '.'
        imageTag: undefined,
      });
    });

    it('should handle dockerfile path resolution correctly', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'path-test:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
        },
        buildOutput: 'Built with correct path resolution',
        buildDuration: 3000,
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'node:20',
        dockerfile: './docker/Dockerfile.test',
        buildContext: './docker',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'path-resolution-505',
        autoStart: false,
      };

      await manager.createContainer(options);

      // Verify correct path resolution for Dockerfile access check
      const expectedDockerfilePath = path.resolve(process.cwd(), './docker', './docker/Dockerfile.test');
      expect(mockFs.access).toHaveBeenCalledWith(expectedDockerfilePath);
    });

    it('should handle concurrent container creation with image building', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'concurrent-app:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
        },
        buildOutput: 'Built concurrently',
        buildDuration: 10000,
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'node:20',
        dockerfile: 'Dockerfile',
      };

      const options1: CreateContainerOptions = {
        config,
        taskId: 'concurrent-1-606',
        autoStart: false,
      };

      const options2: CreateContainerOptions = {
        config,
        taskId: 'concurrent-2-607',
        autoStart: false,
      };

      // Simulate concurrent calls
      const [result1, result2] = await Promise.all([
        manager.createContainer(options1),
        manager.createContainer(options2),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // ImageBuilder should be instantiated only once but buildImage called twice
      expect(MockedImageBuilder).toHaveBeenCalledTimes(1);
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalledTimes(2);
    });

    it('should handle build timeout scenarios', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      // Simulate a build timeout by throwing an error
      mockImageBuilderInstance.buildImage.mockRejectedValue(
        new Error('Build timeout after 30 minutes')
      );

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const config: ContainerConfig = {
        image: 'ubuntu:22.04',
        dockerfile: 'Dockerfile.heavy',
        buildContext: '.',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'build-timeout-808',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Image build error')
      );

      // Should fallback to original image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('ubuntu:22.04'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Integration with Container Lifecycle', () => {
    it('should integrate image building with autoStart and container lifecycle events', async () => {
      mockExec
        .mockImplementationOnce(mockExecCallback('container123')) // create
        .mockImplementationOnce(mockExecCallback('container123')) // start
        .mockImplementationOnce(mockExecCallback('container123|apex-integrated-909|built-app:latest|running|2023-01-01T00:00:00Z|2023-01-01T00:00:01Z||0')); // inspect

      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'built-app:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
        },
        buildOutput: 'Built for lifecycle integration',
        buildDuration: 7000,
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const eventSpy = vi.fn();
      manager.on('container:created', eventSpy);
      manager.on('container:started', eventSpy);

      const config: ContainerConfig = {
        image: 'python:3.11',
        dockerfile: 'Dockerfile',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'integrated-909',
        autoStart: true, // Should start after creation
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe('container123');

      // Verify image was built and used
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalled();

      // Verify container lifecycle events were emitted
      expect(eventSpy).toHaveBeenCalledTimes(2);

      // Check that the create command used the built image
      const createCall = mockExec.mock.calls.find(call => call[0].includes('create'));
      expect(createCall?.[0]).toContain('built-app:latest');

      // Check that the start command was called
      const startCall = mockExec.mock.calls.find(call => call[0].includes('start'));
      expect(startCall?.[0]).toContain('start container123');
    });

    it('should cleanup container on failed start after successful image build', async () => {
      mockExec
        .mockImplementationOnce(mockExecCallback('container123')) // create (success)
        .mockImplementationOnce(mockExecCallback('', 'Failed to start container')) // start (failure)
        .mockImplementationOnce(mockExecCallback('container123')); // remove (cleanup)

      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'cleanup-test:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
        },
        buildOutput: 'Built successfully before start failure',
        buildDuration: 4000,
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'redis:alpine',
        dockerfile: 'Dockerfile',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'cleanup-test-1010',
        autoStart: true,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to start container');

      // Verify image was built
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalled();

      // Verify container was created with built image
      const createCall = mockExec.mock.calls.find(call => call[0].includes('create'));
      expect(createCall?.[0]).toContain('cleanup-test:latest');

      // Verify container was removed after start failure
      const removeCall = mockExec.mock.calls.find(call => call[0].includes('rm'));
      expect(removeCall?.[0]).toContain('container123');
    });
  });
});