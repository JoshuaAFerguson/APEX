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
import { ImageBuilder, type ImageBuildResult } from '../image-builder';
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

describe('ContainerManager ImageBuilder Edge Cases', () => {
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

  describe('Dockerfile Path Edge Cases', () => {
    it('should handle absolute dockerfile paths', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'absolute-path-app:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
        },
        buildOutput: 'Built from absolute path',
        buildDuration: 5000,
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const absoluteDockerfilePath = '/tmp/test-dockerfiles/Dockerfile.custom';
      const config: ContainerConfig = {
        image: 'alpine:latest',
        dockerfile: absoluteDockerfilePath,
        buildContext: '/tmp/test-dockerfiles',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'absolute-path-test',
        autoStart: false,
      };

      await manager.createContainer(options);

      // Should resolve the absolute path correctly
      const expectedPath = path.resolve('/tmp/test-dockerfiles', absoluteDockerfilePath);
      expect(mockFs.access).toHaveBeenCalledWith(expectedPath);
    });

    it('should handle dockerfile paths with special characters', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'special-chars-app:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
        },
        buildOutput: 'Built from special character path',
        buildDuration: 3000,
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'ubuntu:20.04',
        dockerfile: 'docker files/Dockerfile with spaces',
        buildContext: '.',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'special-chars-test',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalledWith({
        dockerfilePath: 'docker files/Dockerfile with spaces',
        buildContext: '.',
        imageTag: undefined,
      });
    });

    it('should handle deep nested dockerfile paths', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'nested-app:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
        },
        buildOutput: 'Built from deep nested path',
        buildDuration: 4000,
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'node:18',
        dockerfile: 'infrastructure/containers/apps/web/Dockerfile.production',
        buildContext: 'infrastructure/containers/apps/web',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'nested-path-test',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalledWith({
        dockerfilePath: 'infrastructure/containers/apps/web/Dockerfile.production',
        buildContext: 'infrastructure/containers/apps/web',
        imageTag: undefined,
      });
    });

    it('should handle symlinked dockerfile paths', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));

      // Mock fs.access to work with symlinked paths
      mockFs.access.mockImplementation(async (filePath) => {
        if (typeof filePath === 'string' && filePath.includes('Dockerfile.symlink')) {
          return Promise.resolve();
        }
        throw new Error('File not found');
      });

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'symlink-app:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
        },
        buildOutput: 'Built from symlinked dockerfile',
        buildDuration: 2000,
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'python:3.9',
        dockerfile: 'Dockerfile.symlink',
        buildContext: '.',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'symlink-test',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalled();
    });
  });

  describe('File System Error Scenarios', () => {
    it('should handle permission errors when accessing dockerfile', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));

      mockFs.access.mockRejectedValue(new Error('EACCES: permission denied'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const config: ContainerConfig = {
        image: 'nginx:alpine',
        dockerfile: 'protected/Dockerfile',
        buildContext: 'protected',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'permission-error-test',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);

      // Should fallback to original image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('nginx:alpine'),
        expect.any(Object)
      );

      // Should not attempt to build
      expect(mockImageBuilderInstance.buildImage).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle network errors during image building', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      mockImageBuilderInstance.buildImage.mockRejectedValue(
        new Error('ENOTFOUND registry-1.docker.io')
      );

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const config: ContainerConfig = {
        image: 'busybox:latest',
        dockerfile: 'Dockerfile.network',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'network-error-test',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Image build error')
      );

      // Should fallback to original image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('busybox:latest'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('should handle disk space errors during image building', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: false,
        error: 'no space left on device',
        buildOutput: 'Error: failed to copy: no space left on device',
        buildDuration: 1000,
        rebuilt: false,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const config: ContainerConfig = {
        image: 'ubuntu:22.04',
        dockerfile: 'Dockerfile.large',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'disk-space-error-test',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Image build failed')
      );

      // Should fallback to original image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('ubuntu:22.04'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Unusual Build Configuration Scenarios', () => {
    it('should handle empty or minimal dockerfile', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'minimal-app:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
          size: 5000000, // 5MB - very small image
          sizeFormatted: '5MB',
        },
        buildOutput: 'Successfully built minimal image',
        buildDuration: 500, // Very fast build
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'scratch',
        dockerfile: 'Dockerfile.minimal',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'minimal-build-test',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalled();

      // Should use the built minimal image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('minimal-app:latest'),
        expect.any(Object)
      );
    });

    it('should handle dockerfile with no base image specified', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: false,
        error: 'dockerfile parse error: file with no instructions',
        buildOutput: 'Error: no FROM instruction',
        buildDuration: 100,
        rebuilt: false,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const config: ContainerConfig = {
        image: 'alpine:latest',
        dockerfile: 'Dockerfile.invalid',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'invalid-dockerfile-test',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Image build failed')
      );

      // Should fallback to the specified image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('alpine:latest'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('should handle extremely long build times gracefully', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'slow-build:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
          size: 2000000000, // 2GB - large image
          sizeFormatted: '2GB',
        },
        buildOutput: 'Successfully built large image after long build time',
        buildDuration: 1800000, // 30 minutes
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'ubuntu:20.04',
        dockerfile: 'Dockerfile.slow',
        imageTag: 'slow-build:latest',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'slow-build-test',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalled();

      // Should use the slow-built image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('slow-build:latest'),
        expect.any(Object)
      );
    });
  });

  describe('Container Runtime Edge Cases', () => {
    it('should handle podman runtime with image building', async () => {
      // Change runtime to podman
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('podman');

      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'podman-app:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
        },
        buildOutput: 'Built with Podman',
        buildDuration: 8000,
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'fedora:37',
        dockerfile: 'Dockerfile.fedora',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'podman-test',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalled();

      // Should use podman command for container creation
      const createCommand = mockExec.mock.calls.find(call => call[0].includes('create'))?.[0];
      expect(createCommand).toMatch(/^podman create/);
      expect(createCommand).toContain('podman-app:latest');
    });

    it('should handle no container runtime available', async () => {
      // Mock no runtime available
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('none');

      const config: ContainerConfig = {
        image: 'alpine:latest',
        dockerfile: 'Dockerfile',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'no-runtime-test',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No container runtime available');

      // Should not attempt to build image
      expect(mockImageBuilderInstance.buildImage).not.toHaveBeenCalled();
    });

    it('should handle runtime switching during build process', async () => {
      // First call returns docker, second call returns none (runtime disappeared)
      vi.mocked(mockRuntime.getBestRuntime)
        .mockResolvedValueOnce('docker')
        .mockResolvedValueOnce('none');

      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      // Mock ImageBuilder initialization to fail due to runtime unavailability
      mockImageBuilderInstance.initialize.mockRejectedValue(
        new Error('No container runtime available')
      );

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const config: ContainerConfig = {
        image: 'node:18',
        dockerfile: 'Dockerfile',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'runtime-switch-test',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Image build error')
      );

      // Should fallback to original image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('node:18'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle build with massive image output', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      // Simulate a build with huge output
      const massiveOutput = 'Build output line\n'.repeat(100000); // 100k lines

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'massive-output:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
        },
        buildOutput: massiveOutput,
        buildDuration: 20000,
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'ubuntu:22.04',
        dockerfile: 'Dockerfile.verbose',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'massive-output-test',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalled();
    });

    it('should handle rapid successive build requests', async () => {
      mockExec.mockImplementation(mockExecCallback('container123'));
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'rapid-build:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
        },
        buildOutput: 'Rapid build successful',
        buildDuration: 1000,
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'alpine:latest',
        dockerfile: 'Dockerfile.quick',
      };

      // Create 10 rapid successive requests
      const promises = Array.from({ length: 10 }, (_, i) =>
        manager.createContainer({
          config,
          taskId: `rapid-${i}`,
          autoStart: false,
        })
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // ImageBuilder should be instantiated only once
      expect(MockedImageBuilder).toHaveBeenCalledTimes(1);

      // But buildImage should be called for each request
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalledTimes(10);
    });
  });
});