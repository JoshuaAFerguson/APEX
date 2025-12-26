import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ContainerManager,
  type ContainerOperationResult,
  type CreateContainerOptions,
  type ContainerEvent,
  type ContainerOperationEvent,
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

describe('ContainerManager Build-then-Create Integration Flow', () => {
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

  describe('Complete Build-then-Create Flow', () => {
    it('should complete full flow: check dockerfile → build image → create container → start container', async () => {
      // Mock all exec calls in sequence
      mockExec
        .mockImplementationOnce(mockExecCallback('container123')) // container create
        .mockImplementationOnce(mockExecCallback('container123')) // container start
        .mockImplementationOnce(mockExecCallback('container123|apex-full-flow-test|custom-web-app:v1.0.0|running|2023-01-01T00:00:00Z|2023-01-01T00:00:01Z||0')); // inspect

      // Mock Dockerfile exists
      mockFs.access.mockResolvedValue();

      // Mock successful image build
      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'custom-web-app:v1.0.0',
          id: 'sha256:abc123def456',
          created: new Date('2023-01-01T00:00:00Z'),
          exists: true,
          size: 250000000,
          sizeFormatted: '250MB',
          dockerfileHash: 'dockerfile-hash-123',
        },
        buildOutput: `Step 1/8 : FROM node:18-alpine
---> 123456789abc
Step 2/8 : WORKDIR /app
---> Using cache
---> 234567890bcd
Step 3/8 : COPY package*.json ./
---> 345678901cde
Step 4/8 : RUN npm ci --only=production
---> Running in temp123
Successfully built custom-web-app:v1.0.0`,
        buildDuration: 45000, // 45 seconds
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      // Setup event tracking
      const createdEvents: ContainerOperationEvent[] = [];
      const startedEvents: ContainerOperationEvent[] = [];
      const lifecycleEvents: Array<{ event: ContainerEvent; operation: string }> = [];

      manager.on('container:created', (event) => createdEvents.push(event));
      manager.on('container:started', (event) => startedEvents.push(event));
      manager.on('container:lifecycle', (event, operation) => {
        lifecycleEvents.push({ event, operation });
      });

      const config: ContainerConfig = {
        image: 'node:18-alpine', // Fallback image
        dockerfile: 'docker/Dockerfile.web',
        buildContext: 'docker',
        imageTag: 'custom-web-app:v1.0.0',
        environment: {
          NODE_ENV: 'production',
          PORT: '3000',
        },
        volumes: {
          '/host/app/data': '/app/data',
          '/host/app/logs': '/app/logs',
        },
        workingDir: '/app',
        command: ['npm', 'start'],
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'full-flow-test',
        autoStart: true,
      };

      // Execute the complete flow
      const result = await manager.createContainer(options);

      // === Verify the complete flow ===

      // 1. Dockerfile existence check
      const expectedDockerfilePath = path.resolve(process.cwd(), 'docker', 'docker/Dockerfile.web');
      expect(mockFs.access).toHaveBeenCalledWith(expectedDockerfilePath);

      // 2. ImageBuilder initialization and build
      expect(MockedImageBuilder).toHaveBeenCalledWith(process.cwd());
      expect(mockImageBuilderInstance.initialize).toHaveBeenCalled();
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalledWith({
        dockerfilePath: 'docker/Dockerfile.web',
        buildContext: 'docker',
        imageTag: 'custom-web-app:v1.0.0',
      });

      // 3. Container creation with built image (not fallback)
      const createCall = mockExec.mock.calls.find(call => call[0].includes('create'));
      expect(createCall).toBeDefined();
      expect(createCall![0]).toContain('custom-web-app:v1.0.0'); // Built image used
      expect(createCall![0]).not.toContain('node:18-alpine'); // Fallback not used
      expect(createCall![0]).toContain('--name apex-full-flow-test');
      expect(createCall![0]).toContain('-e NODE_ENV=production');
      expect(createCall![0]).toContain('-e PORT=3000');
      expect(createCall![0]).toContain('-v /host/app/data:/app/data');
      expect(createCall![0]).toContain('-v /host/app/logs:/app/logs');
      expect(createCall![0]).toContain('-w /app');
      expect(createCall![0]).toContain('npm start');

      // 4. Container start
      const startCall = mockExec.mock.calls.find(call => call[0].includes('start'));
      expect(startCall).toBeDefined();
      expect(startCall![0]).toContain('start container123');

      // 5. Container inspect for final info
      const inspectCall = mockExec.mock.calls.find(call => call[0].includes('inspect'));
      expect(inspectCall).toBeDefined();

      // 6. Final result
      expect(result.success).toBe(true);
      expect(result.containerId).toBe('container123');
      expect(result.containerInfo).toBeDefined();
      expect(result.containerInfo!.status).toBe('running');

      // 7. Events were emitted correctly
      expect(createdEvents).toHaveLength(1);
      expect(createdEvents[0].success).toBe(true);
      expect(createdEvents[0].containerId).toBe('container123');
      expect(createdEvents[0].taskId).toBe('full-flow-test');

      expect(startedEvents).toHaveLength(1);
      expect(startedEvents[0].success).toBe(true);
      expect(startedEvents[0].containerId).toBe('container123');

      expect(lifecycleEvents).toHaveLength(2);
      expect(lifecycleEvents[0].operation).toBe('created');
      expect(lifecycleEvents[1].operation).toBe('started');
    });

    it('should handle build-then-create with cache hit (no rebuild)', async () => {
      mockExec
        .mockImplementationOnce(mockExecCallback('container456'))
        .mockImplementationOnce(mockExecCallback('container456|apex-cache-test|cached-app:latest|created|2023-01-01T00:00:00Z|||0'));

      mockFs.access.mockResolvedValue();

      // Mock cached build (no rebuild needed)
      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'cached-app:latest',
          id: 'sha256:cached123',
          created: new Date('2023-01-01T00:00:00Z'),
          exists: true,
          dockerfileHash: 'same-hash-456',
        },
        buildOutput: 'Using existing image (no changes detected)',
        buildDuration: 50, // Very fast - cache hit
        rebuilt: false, // Key: image was NOT rebuilt
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'alpine:latest',
        dockerfile: 'Dockerfile.cache-test',
        imageTag: 'cached-app:latest',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'cache-test',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalled();

      // Verify cached image was used
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('cached-app:latest'),
        expect.any(Object)
      );
    });

    it('should handle build failure and complete fallback flow', async () => {
      mockExec
        .mockImplementationOnce(mockExecCallback('container789'))
        .mockImplementationOnce(mockExecCallback('container789|apex-fallback-test|fallback:latest|created|2023-01-01T00:00:00Z|||0'));

      mockFs.access.mockResolvedValue();

      // Mock build failure
      const mockBuildResult: ImageBuildResult = {
        success: false,
        error: 'Failed to build: missing dependency xyz',
        buildOutput: `Step 5/10 : RUN apt-get install xyz
E: Unable to locate package xyz
The command '/bin/sh -c apt-get install xyz' returned a non-zero code: 100`,
        buildDuration: 5000,
        rebuilt: false,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const config: ContainerConfig = {
        image: 'fallback:latest',
        dockerfile: 'Dockerfile.failing',
        environment: { TEST: 'fallback' },
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'fallback-test',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      // Should succeed with fallback
      expect(result.success).toBe(true);
      expect(result.containerId).toBe('container789');

      // Should log build failure
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Image build failed: Failed to build: missing dependency xyz')
      );

      // Should use fallback image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('fallback:latest'),
        expect.any(Object)
      );

      // Should preserve environment variables
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('-e TEST=fallback'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('should handle full flow with container start failure after successful build', async () => {
      mockExec
        .mockImplementationOnce(mockExecCallback('container999')) // create success
        .mockImplementationOnce(mockExecCallback('', 'Error: container cannot be started')) // start failure
        .mockImplementationOnce(mockExecCallback('container999')); // remove cleanup

      mockFs.access.mockResolvedValue();

      // Mock successful build
      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'start-fail-app:latest',
          id: 'sha256:startfail123',
          created: new Date(),
          exists: true,
        },
        buildOutput: 'Successfully built start-fail-app:latest',
        buildDuration: 10000,
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'ubuntu:22.04',
        dockerfile: 'Dockerfile.start-fail',
        imageTag: 'start-fail-app:latest',
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'start-fail-test',
        autoStart: true, // This will trigger the start failure
      };

      const result = await manager.createContainer(options);

      // Overall operation should fail due to start failure
      expect(result.success).toBe(false);
      expect(result.error).toContain('Error: container cannot be started');

      // But image should have been built successfully
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalled();

      // Container should have been created with built image
      const createCall = mockExec.mock.calls.find(call => call[0].includes('create'));
      expect(createCall![0]).toContain('start-fail-app:latest');

      // Container should have been cleaned up after start failure
      const removeCall = mockExec.mock.calls.find(call => call[0].includes('rm'));
      expect(removeCall![0]).toContain('container999');
    });

    it('should handle concurrent build-then-create requests efficiently', async () => {
      // Mock all container creations to succeed
      mockExec.mockImplementation(mockExecCallback('container-concurrent'));
      mockFs.access.mockResolvedValue();

      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'concurrent-app:latest',
          id: 'sha256:concurrent123',
          created: new Date(),
          exists: true,
        },
        buildOutput: 'Built concurrently',
        buildDuration: 8000,
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'node:20',
        dockerfile: 'Dockerfile.concurrent',
        imageTag: 'concurrent-app:latest',
      };

      // Create multiple concurrent requests
      const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
        manager.createContainer({
          config,
          taskId: `concurrent-${i}`,
          autoStart: false,
        })
      );

      const results = await Promise.all(concurrentRequests);

      // All requests should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // ImageBuilder should be instantiated only once
      expect(MockedImageBuilder).toHaveBeenCalledTimes(1);

      // Build should be called for each request (no cross-request caching)
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalledTimes(5);

      // All containers should use the built image
      const createCalls = mockExec.mock.calls.filter(call => call[0].includes('create'));
      expect(createCalls).toHaveLength(5);
      createCalls.forEach(call => {
        expect(call[0]).toContain('concurrent-app:latest');
      });
    });

    it('should handle complete flow with complex multi-stage dockerfile', async () => {
      mockExec
        .mockImplementationOnce(mockExecCallback('container-multistage'))
        .mockImplementationOnce(mockExecCallback('container-multistage|apex-multistage-test|multistage-app:production|created|2023-01-01T00:00:00Z|||0'));

      mockFs.access.mockResolvedValue();

      // Mock complex multi-stage build
      const mockBuildResult: ImageBuildResult = {
        success: true,
        imageInfo: {
          tag: 'multistage-app:production',
          id: 'sha256:multistage123',
          created: new Date(),
          exists: true,
          size: 150000000, // 150MB - optimized multi-stage build
          sizeFormatted: '150MB',
        },
        buildOutput: `Step 1/15 : FROM node:18-alpine as builder
---> 123456789abc
Step 2/15 : WORKDIR /build
---> 234567890bcd
Step 3/15 : COPY package*.json ./
---> 345678901cde
Step 4/15 : RUN npm ci --only=production
---> 456789012def
Step 5/15 : COPY . .
---> 567890123efg
Step 6/15 : RUN npm run build
---> 678901234fgh
Step 7/15 : FROM nginx:alpine as production
---> 789012345ghi
Step 8/15 : COPY --from=builder /build/dist /usr/share/nginx/html
---> 890123456hij
Successfully built multistage-app:production`,
        buildDuration: 120000, // 2 minutes for complex build
        rebuilt: true,
      };

      mockImageBuilderInstance.buildImage.mockResolvedValue(mockBuildResult);

      const config: ContainerConfig = {
        image: 'nginx:alpine', // Simple fallback
        dockerfile: 'build/Dockerfile.multistage',
        buildContext: 'build',
        imageTag: 'multistage-app:production',
        volumes: {
          '/host/nginx/conf': '/etc/nginx/conf.d',
        },
      };

      const options: CreateContainerOptions = {
        config,
        taskId: 'multistage-test',
        autoStart: false,
      };

      const result = await manager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockImageBuilderInstance.buildImage).toHaveBeenCalledWith({
        dockerfilePath: 'build/Dockerfile.multistage',
        buildContext: 'build',
        imageTag: 'multistage-app:production',
      });

      // Should use the optimized multi-stage image
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('multistage-app:production'),
        expect.any(Object)
      );

      // Should preserve volume mounts
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('-v /host/nginx/conf:/etc/nginx/conf.d'),
        expect.any(Object)
      );
    });
  });
});