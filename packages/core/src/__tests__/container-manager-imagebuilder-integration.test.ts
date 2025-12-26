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

describe('ContainerManager ImageBuilder Integration', () => {
  let manager: ContainerManager;
  let mockRuntime: ContainerRuntime;
  let mockImageBuilder: ImageBuilder;

  beforeEach(() => {
    // Setup runtime mock
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    vi.mocked(mockRuntime.isRuntimeAvailable).mockResolvedValue(true);

    // Setup ImageBuilder mock
    mockImageBuilder = new ImageBuilder('/mock/project');
    const mockImageBuilderInstance = {
      initialize: vi.fn().mockResolvedValue(undefined),
      buildImage: vi.fn(),
    };

    MockedImageBuilder.mockImplementation(() => mockImageBuilderInstance as any);

    manager = new ContainerManager(mockRuntime);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createContainer with dockerfile', () => {
    it('should build image when dockerfile is specified and Dockerfile exists', async () => {
      // Mock successful container creation
      mockExec.mockImplementation(mockExecCallback('container123'));

      // Mock Dockerfile existence
      mockFs.access.mockResolvedValue();

      // Mock successful image build
      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'my-custom-app:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
        },
        buildOutput: 'Successfully built image',
        buildDuration: 5000,
        rebuilt: true,
      };

      // Get the mocked ImageBuilder instance
      const imageBuilderInstance = MockedImageBuilder.mock.results[0]?.value;
      if (imageBuilderInstance) {
        imageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);
      }

      const config: ContainerConfig = {
        image: 'node:20',
        dockerfile: 'Dockerfile',
        buildContext: '.',
        imageTag: 'my-custom-app:latest',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'test-task-123',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe('container123');

      // Verify ImageBuilder was initialized and called
      expect(MockedImageBuilder).toHaveBeenCalledWith(process.cwd());

      if (imageBuilderInstance) {
        expect(imageBuilderInstance.initialize).toHaveBeenCalled();
        expect(imageBuilderInstance.buildImage).toHaveBeenCalledWith({
          dockerfilePath: 'Dockerfile',
          buildContext: '.',
          imageTag: 'my-custom-app:latest',
        });
      }

      // Verify the container was created with the built image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('my-custom-app:latest'),
        expect.any(Object)
      );
    });

    it('should fallback to config.image when dockerfile specified but build fails', async () => {
      // Mock successful container creation
      mockExec.mockImplementation(mockExecCallback('container123'));

      // Mock Dockerfile existence
      mockFs.access.mockResolvedValue();

      // Mock failed image build
      const mockBuildResult: ImageBuildResult = {
        success: false,
        error: 'Build failed due to syntax error',
        buildOutput: 'Error building image',
        buildDuration: 1000,
        rebuilt: false,
      };

      // Get the mocked ImageBuilder instance
      const imageBuilderInstance = MockedImageBuilder.mock.results[0]?.value;
      if (imageBuilderInstance) {
        imageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);
      }

      const config: ContainerConfig = {
        image: 'node:20',
        dockerfile: 'Dockerfile',
        buildContext: '.',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'test-task-123',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe('container123');

      // Verify the container was created with the fallback image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('node:20'),
        expect.any(Object)
      );
    });

    it('should fallback to config.image when dockerfile specified but does not exist', async () => {
      // Mock successful container creation
      mockExec.mockImplementation(mockExecCallback('container123'));

      // Mock Dockerfile not existing
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const config: ContainerConfig = {
        image: 'node:20',
        dockerfile: 'NonexistentDockerfile',
        buildContext: '.',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'test-task-123',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe('container123');

      // Verify ImageBuilder was not called since Dockerfile doesn't exist
      const imageBuilderInstance = MockedImageBuilder.mock.results[0]?.value;
      if (imageBuilderInstance) {
        expect(imageBuilderInstance.buildImage).not.toHaveBeenCalled();
      }

      // Verify the container was created with the fallback image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('node:20'),
        expect.any(Object)
      );
    });

    it('should use config.image directly when no dockerfile is specified', async () => {
      // Mock successful container creation
      mockExec.mockImplementation(mockExecCallback('container123'));

      const config: ContainerConfig = {
        image: 'node:20',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'test-task-123',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe('container123');

      // Verify ImageBuilder was not instantiated
      expect(MockedImageBuilder).not.toHaveBeenCalled();

      // Verify the container was created with the original image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('node:20'),
        expect.any(Object)
      );
    });

    it('should reuse ImageBuilder instance across multiple calls', async () => {
      // Mock successful container creation
      mockExec.mockImplementation(mockExecCallback('container123'));

      // Mock Dockerfile existence
      mockFs.access.mockResolvedValue();

      // Mock successful image build
      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'my-app:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
        },
        buildOutput: 'Successfully built image',
        buildDuration: 5000,
        rebuilt: true,
      };

      const config: ContainerConfig = {
        image: 'node:20',
        dockerfile: 'Dockerfile',
        buildContext: '.',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'test-task-123',
        autoStart: false,
      };

      // First call
      await manager.createContainer(options);

      // Second call
      await manager.createContainer({
        ...options,
        taskId: 'test-task-456',
      });

      // ImageBuilder should be instantiated only once
      expect(MockedImageBuilder).toHaveBeenCalledTimes(1);

      // Both builds should have been called
      const imageBuilderInstance = MockedImageBuilder.mock.results[0]?.value;
      if (imageBuilderInstance) {
        expect(imageBuilderInstance.buildImage).toHaveBeenCalledTimes(2);
      }
    });

    it('should handle ImageBuilder initialization errors gracefully', async () => {
      // Mock successful container creation
      mockExec.mockImplementation(mockExecCallback('container123'));

      // Mock Dockerfile existence
      mockFs.access.mockResolvedValue();

      // Mock ImageBuilder initialization failure
      const imageBuilderInstance = MockedImageBuilder.mock.results[0]?.value;
      if (imageBuilderInstance) {
        imageBuilderInstance.initialize.mockRejectedValue(new Error('No container runtime available'));
      }

      const config: ContainerConfig = {
        image: 'node:20',
        dockerfile: 'Dockerfile',
        buildContext: '.',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'test-task-123',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe('container123');

      // Should fallback to original image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('node:20'),
        expect.any(Object)
      );
    });
  });

  describe('edge cases', () => {
    it('should handle relative dockerfile paths correctly', async () => {
      // Mock successful container creation
      mockExec.mockImplementation(mockExecCallback('container123'));

      // Mock Dockerfile existence
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'my-app:latest',
          id: 'img123',
          created: new Date(),
          exists: true,
        },
        buildOutput: 'Successfully built image',
        buildDuration: 5000,
        rebuilt: true,
      };

      const imageBuilderInstance = MockedImageBuilder.mock.results[0]?.value;
      if (imageBuilderInstance) {
        imageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);
      }

      const config: ContainerConfig = {
        image: 'node:20',
        dockerfile: './docker/Dockerfile.dev',
        buildContext: './docker',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'test-task-123',
        autoStart: false,
      };

      await manager.createContainer(options);

      // Verify correct paths were passed to ImageBuilder
      if (imageBuilderInstance) {
        expect(imageBuilderInstance.buildImage).toHaveBeenCalledWith({
          dockerfilePath: './docker/Dockerfile.dev',
          buildContext: './docker',
          imageTag: undefined,
        });
      }
    });
  });
});