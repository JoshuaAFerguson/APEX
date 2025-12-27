/**
 * Container Creation Integration Tests
 *
 * Comprehensive test coverage for container creation including:
 * - Container creation with various configurations (minimal, full, resource limits, volumes, env vars)
 * - Custom Dockerfile integration (build-then-create flow, fallback when build fails)
 * - Image building scenarios (fresh builds, cached builds, multi-stage builds)
 * - Creation failure scenarios (invalid config, runtime unavailable, command failures, timeout errors)
 *
 * @see container-manager.ts - ContainerManager class
 * @see image-builder.ts - ImageBuilder class
 * @see types.ts - ContainerConfig type
 */
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
import { ImageBuilder, type ImageBuildResult, type ImageBuildConfig } from '../image-builder';
import { ContainerConfig } from '../types';

// =============================================================================
// Mock Setup
// =============================================================================

vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  access: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('../container-runtime');
vi.mock('../image-builder');

const mockExec = vi.mocked(exec);
const mockFs = vi.mocked(fs);
const MockedContainerRuntime = vi.mocked(ContainerRuntime);
const MockedImageBuilder = vi.mocked(ImageBuilder);

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Helper to create a mock exec callback for async command execution
 */
function mockExecCallback(stdout: string, stderr?: string, error?: Error) {
  return vi.fn(
    (
      command: string,
      options: any,
      callback?: (error: Error | null, stdout: string, stderr: string) => void
    ) => {
      if (callback) {
        setTimeout(() => callback(error || null, stdout, stderr || ''), 0);
      }
      return {} as any; // Mock ChildProcess
    }
  );
}

/**
 * Helper to create a mock exec callback with timeout simulation
 */
function mockExecTimeoutCallback(timeoutMs: number) {
  return vi.fn(
    (
      command: string,
      options: any,
      callback?: (error: Error | null, stdout: string, stderr: string) => void
    ) => {
      if (callback) {
        const error = new Error('Command timed out') as any;
        error.code = 'ETIMEDOUT';
        setTimeout(() => callback(error, '', ''), timeoutMs);
      }
      return {} as any;
    }
  );
}

/**
 * Factory to create minimal container config
 */
function createMinimalConfig(overrides?: Partial<ContainerConfig>): ContainerConfig {
  return {
    image: 'alpine:latest',
    ...overrides,
  };
}

/**
 * Factory to create full container config with all options
 */
function createFullConfig(overrides?: Partial<ContainerConfig>): ContainerConfig {
  return {
    image: 'node:20-alpine',
    dockerfile: 'Dockerfile',
    buildContext: '.',
    imageTag: 'test-app:latest',
    volumes: {
      '/host/data': '/container/data',
      '/host/config': '/container/config',
    },
    environment: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
      DATABASE_URL: 'postgres://localhost:5432/db',
    },
    resourceLimits: {
      memory: '512m',
      cpu: 1.0,
      cpuShares: 1024,
      pidsLimit: 100,
    },
    networkMode: 'bridge',
    workingDir: '/app',
    user: 'node',
    labels: {
      'app.name': 'test-app',
      'app.version': '1.0.0',
    },
    entrypoint: ['/bin/sh', '-c'],
    command: ['npm', 'start'],
    autoRemove: true,
    privileged: false,
    securityOpts: ['no-new-privileges'],
    capAdd: ['SYS_PTRACE'],
    capDrop: ['NET_RAW'],
    ...overrides,
  };
}

/**
 * Factory to create successful image build result
 */
function createSuccessfulBuildResult(
  tag: string = 'test-app:latest',
  overrides?: Partial<ImageBuildResult>
): ImageBuildResult {
  return {
    success: true,
    imageInfo: {
      tag,
      id: 'sha256:abc123def456',
      created: new Date('2024-01-01T00:00:00Z'),
      exists: true,
      size: 250000000,
      sizeFormatted: '250MB',
      dockerfileHash: 'dockerfile-hash-123',
    },
    buildOutput: `Successfully built ${tag}`,
    buildDuration: 10000,
    rebuilt: true,
    ...overrides,
  };
}

/**
 * Factory to create failed image build result
 */
function createFailedBuildResult(
  error: string = 'Build failed',
  overrides?: Partial<ImageBuildResult>
): ImageBuildResult {
  return {
    success: false,
    error,
    buildOutput: `Error: ${error}`,
    buildDuration: 5000,
    rebuilt: false,
    ...overrides,
  };
}

// =============================================================================
// Test Suites
// =============================================================================

describe('Container Creation Integration Tests', () => {
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
      imageExists: vi.fn(),
      getImageInfo: vi.fn(),
    };

    MockedImageBuilder.mockImplementation(() => mockImageBuilderInstance);

    manager = new ContainerManager(mockRuntime);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // Section 1: Container Creation with Various Configurations
  // ===========================================================================

  describe('Container Creation with Various Configurations', () => {
    describe('Minimal Configuration', () => {
      it('should create container with minimal config (image only)', async () => {
        const containerId = 'minimal-container-123';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        const config = createMinimalConfig();
        const result = await manager.createContainer({
          config,
          taskId: 'minimal-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.containerId).toBe(containerId);
        expect(result.command).toContain('docker create');
        expect(result.command).toContain('alpine:latest');
        expect(result.command).toContain('--name apex-minimal-task');
      });

      it('should create container with minimal config using podman runtime', async () => {
        vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('podman');

        const containerId = 'podman-container-123';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        const config = createMinimalConfig();
        const result = await manager.createContainer({
          config,
          taskId: 'podman-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('podman create');
      });

      it('should emit container:created event for minimal config', async () => {
        const containerId = 'event-container-123';
        const events: ContainerOperationEvent[] = [];

        manager.on('container:created', (event) => events.push(event));
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        const config = createMinimalConfig();
        await manager.createContainer({
          config,
          taskId: 'event-task',
          autoStart: false,
        });

        expect(events).toHaveLength(1);
        expect(events[0].containerId).toBe(containerId);
        expect(events[0].success).toBe(true);
        expect(events[0].taskId).toBe('event-task');
      });
    });

    describe('Full Configuration', () => {
      it('should create container with full configuration including all options', async () => {
        const containerId = 'full-container-123';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));
        mockFs.access.mockRejectedValue(new Error('Dockerfile not found')); // Skip image build

        const config = createFullConfig();
        const result = await manager.createContainer({
          config,
          taskId: 'full-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.containerId).toBe(containerId);

        // Verify all config options are in the command
        const command = result.command!;
        expect(command).toContain('-v /host/data:/container/data');
        expect(command).toContain('-v /host/config:/container/config');
        expect(command).toContain('-e NODE_ENV=production');
        expect(command).toContain('-e LOG_LEVEL=info');
        expect(command).toContain('--memory 512m');
        expect(command).toContain('--cpus 1');
        expect(command).toContain('--cpu-shares 1024');
        expect(command).toContain('--pids-limit 100');
        expect(command).toContain('--network bridge');
        expect(command).toContain('-w /app');
        expect(command).toContain('--user node');
        expect(command).toContain('--label app.name=test-app');
        expect(command).toContain('--label app.version=1.0.0');
        expect(command).toContain('--security-opt no-new-privileges');
        expect(command).toContain('--cap-add SYS_PTRACE');
        expect(command).toContain('--cap-drop NET_RAW');
        expect(command).toContain('--rm'); // autoRemove
      });

      it('should handle full config with auto-start enabled', async () => {
        const containerId = 'autostart-container-123';
        const inspectOutput =
          'autostart-container-123|apex-autostart-task|node:20-alpine|running|2024-01-01T00:00:00Z|2024-01-01T00:00:01Z||0';

        mockExec
          .mockImplementationOnce(mockExecCallback(containerId)) // create
          .mockImplementationOnce(mockExecCallback(containerId)) // start
          .mockImplementationOnce(mockExecCallback(inspectOutput)); // inspect after start

        mockFs.access.mockRejectedValue(new Error('Dockerfile not found'));

        const config = createFullConfig();
        const result = await manager.createContainer({
          config,
          taskId: 'autostart-task',
          autoStart: true,
        });

        expect(result.success).toBe(true);
        expect(result.containerInfo?.status).toBe('running');
      });
    });

    describe('Resource Limits Configuration', () => {
      it('should create container with memory limits', async () => {
        const containerId = 'memory-limit-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        const config = createMinimalConfig({
          resourceLimits: {
            memory: '1g',
            memoryReservation: '512m',
            memorySwap: '2g',
          },
        });

        const result = await manager.createContainer({
          config,
          taskId: 'memory-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('--memory 1g');
        expect(result.command).toContain('--memory-reservation 512m');
        expect(result.command).toContain('--memory-swap 2g');
      });

      it('should create container with CPU limits', async () => {
        const containerId = 'cpu-limit-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        const config = createMinimalConfig({
          resourceLimits: {
            cpu: 2.5,
            cpuShares: 2048,
          },
        });

        const result = await manager.createContainer({
          config,
          taskId: 'cpu-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('--cpus 2.5');
        expect(result.command).toContain('--cpu-shares 2048');
      });

      it('should create container with process ID limits', async () => {
        const containerId = 'pids-limit-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        const config = createMinimalConfig({
          resourceLimits: {
            pidsLimit: 50,
          },
        });

        const result = await manager.createContainer({
          config,
          taskId: 'pids-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('--pids-limit 50');
      });

      it('should create container with combined resource limits', async () => {
        const containerId = 'combined-limits-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        const config = createMinimalConfig({
          resourceLimits: {
            memory: '2g',
            memoryReservation: '1g',
            memorySwap: '4g',
            cpu: 4.0,
            cpuShares: 4096,
            pidsLimit: 200,
          },
        });

        const result = await manager.createContainer({
          config,
          taskId: 'combined-limits-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        const command = result.command!;
        expect(command).toContain('--memory 2g');
        expect(command).toContain('--memory-reservation 1g');
        expect(command).toContain('--memory-swap 4g');
        expect(command).toContain('--cpus 4');
        expect(command).toContain('--cpu-shares 4096');
        expect(command).toContain('--pids-limit 200');
      });
    });

    describe('Volume Mounts Configuration', () => {
      it('should create container with single volume mount', async () => {
        const containerId = 'single-volume-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        const config = createMinimalConfig({
          volumes: {
            '/host/path': '/container/path',
          },
        });

        const result = await manager.createContainer({
          config,
          taskId: 'single-volume-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('-v /host/path:/container/path');
      });

      it('should create container with multiple volume mounts', async () => {
        const containerId = 'multi-volume-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        const config = createMinimalConfig({
          volumes: {
            '/host/app': '/app',
            '/host/data': '/data',
            '/host/logs': '/var/log',
            '/host/config': '/etc/myapp',
          },
        });

        const result = await manager.createContainer({
          config,
          taskId: 'multi-volume-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('-v /host/app:/app');
        expect(result.command).toContain('-v /host/data:/data');
        expect(result.command).toContain('-v /host/logs:/var/log');
        expect(result.command).toContain('-v /host/config:/etc/myapp');
      });

      it('should handle volume paths with spaces (escaped)', async () => {
        const containerId = 'spaces-volume-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        const config = createMinimalConfig({
          volumes: {
            '/host/path with spaces': '/container/path',
          },
        });

        const result = await manager.createContainer({
          config,
          taskId: 'spaces-volume-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        // Verify path is properly escaped
        expect(result.command).toContain("'/host/path with spaces:/container/path'");
      });
    });

    describe('Environment Variables Configuration', () => {
      it('should create container with single environment variable', async () => {
        const containerId = 'single-env-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        const config = createMinimalConfig({
          environment: {
            MY_VAR: 'my_value',
          },
        });

        const result = await manager.createContainer({
          config,
          taskId: 'single-env-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('-e MY_VAR=my_value');
      });

      it('should create container with multiple environment variables', async () => {
        const containerId = 'multi-env-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        const config = createMinimalConfig({
          environment: {
            NODE_ENV: 'production',
            DATABASE_URL: 'postgres://localhost:5432/db',
            API_KEY: 'secret-api-key-123',
            LOG_LEVEL: 'debug',
          },
        });

        const result = await manager.createContainer({
          config,
          taskId: 'multi-env-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('-e NODE_ENV=production');
        expect(result.command).toContain('-e DATABASE_URL=postgres://localhost:5432/db');
        expect(result.command).toContain('-e API_KEY=secret-api-key-123');
        expect(result.command).toContain('-e LOG_LEVEL=debug');
      });

      it('should handle environment variables with special characters', async () => {
        const containerId = 'special-env-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        const config = createMinimalConfig({
          environment: {
            COMPLEX_VAR: 'value with spaces & symbols $@#!',
          },
        });

        const result = await manager.createContainer({
          config,
          taskId: 'special-env-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        // Verify the value is properly escaped
        expect(result.command).toContain("'COMPLEX_VAR=value with spaces & symbols $@#!'");
      });

      it('should handle empty environment variable values', async () => {
        const containerId = 'empty-env-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        const config = createMinimalConfig({
          environment: {
            EMPTY_VAR: '',
            NORMAL_VAR: 'value',
          },
        });

        const result = await manager.createContainer({
          config,
          taskId: 'empty-env-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('-e EMPTY_VAR=');
        expect(result.command).toContain('-e NORMAL_VAR=value');
      });
    });
  });

  // ===========================================================================
  // Section 2: Custom Dockerfile Integration
  // ===========================================================================

  describe('Custom Dockerfile Integration', () => {
    describe('Build-then-Create Flow', () => {
      it('should build image from Dockerfile before creating container', async () => {
        const containerId = 'dockerfile-container-123';

        mockExec.mockImplementationOnce(mockExecCallback(containerId)); // create
        mockFs.access.mockResolvedValue(); // Dockerfile exists

        const buildResult = createSuccessfulBuildResult('custom-app:v1.0.0');
        mockImageBuilderInstance.buildImage.mockResolvedValue(buildResult);

        const config: ContainerConfig = {
          image: 'node:20-alpine', // fallback image
          dockerfile: 'Dockerfile',
          buildContext: '.',
          imageTag: 'custom-app:v1.0.0',
        };

        const result = await manager.createContainer({
          config,
          taskId: 'dockerfile-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);

        // Verify ImageBuilder was initialized and used
        expect(MockedImageBuilder).toHaveBeenCalledWith(process.cwd());
        expect(mockImageBuilderInstance.initialize).toHaveBeenCalled();
        expect(mockImageBuilderInstance.buildImage).toHaveBeenCalledWith({
          dockerfilePath: 'Dockerfile',
          buildContext: '.',
          imageTag: 'custom-app:v1.0.0',
        });

        // Verify container uses the built image, not the fallback
        expect(result.command).toContain('custom-app:v1.0.0');
        expect(result.command).not.toContain('node:20-alpine');
      });

      it('should complete full build-then-create-then-start flow', async () => {
        const containerId = 'full-flow-container';
        const inspectOutput = `${containerId}|apex-full-flow-task|built-app:latest|running|2024-01-01T00:00:00Z|2024-01-01T00:00:01Z||0`;

        mockExec
          .mockImplementationOnce(mockExecCallback(containerId)) // create
          .mockImplementationOnce(mockExecCallback(containerId)) // start
          .mockImplementationOnce(mockExecCallback(inspectOutput)); // inspect

        mockFs.access.mockResolvedValue();

        const buildResult = createSuccessfulBuildResult('built-app:latest');
        mockImageBuilderInstance.buildImage.mockResolvedValue(buildResult);

        const createdEvents: ContainerOperationEvent[] = [];
        const startedEvents: ContainerOperationEvent[] = [];

        manager.on('container:created', (e) => createdEvents.push(e));
        manager.on('container:started', (e) => startedEvents.push(e));

        const config: ContainerConfig = {
          image: 'node:20',
          dockerfile: 'docker/Dockerfile.prod',
          buildContext: 'docker',
          imageTag: 'built-app:latest',
          environment: { NODE_ENV: 'production' },
        };

        const result = await manager.createContainer({
          config,
          taskId: 'full-flow-task',
          autoStart: true,
        });

        expect(result.success).toBe(true);
        expect(result.containerInfo?.status).toBe('running');
        expect(createdEvents).toHaveLength(1);
        expect(startedEvents).toHaveLength(1);
      });

      it('should reuse ImageBuilder instance across multiple build requests', async () => {
        mockExec.mockImplementation(mockExecCallback('container-reuse'));
        mockFs.access.mockResolvedValue();

        const buildResult = createSuccessfulBuildResult();
        mockImageBuilderInstance.buildImage.mockResolvedValue(buildResult);

        const config: ContainerConfig = {
          image: 'node:20',
          dockerfile: 'Dockerfile',
          buildContext: '.',
        };

        // First container
        await manager.createContainer({ config, taskId: 'task-1', autoStart: false });

        // Second container
        await manager.createContainer({ config, taskId: 'task-2', autoStart: false });

        // Third container
        await manager.createContainer({ config, taskId: 'task-3', autoStart: false });

        // ImageBuilder should be instantiated only once
        expect(MockedImageBuilder).toHaveBeenCalledTimes(1);

        // But buildImage should be called for each container
        expect(mockImageBuilderInstance.buildImage).toHaveBeenCalledTimes(3);
      });
    });

    describe('Fallback When Build Fails', () => {
      it('should fallback to config.image when Dockerfile build fails', async () => {
        const containerId = 'fallback-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));
        mockFs.access.mockResolvedValue();

        const buildResult = createFailedBuildResult('Syntax error in Dockerfile on line 15');
        mockImageBuilderInstance.buildImage.mockResolvedValue(buildResult);

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const config: ContainerConfig = {
          image: 'node:20-fallback',
          dockerfile: 'Dockerfile.broken',
          buildContext: '.',
        };

        const result = await manager.createContainer({
          config,
          taskId: 'fallback-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('node:20-fallback');
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Image build failed')
        );

        consoleSpy.mockRestore();
      });

      it('should fallback to config.image when Dockerfile does not exist', async () => {
        const containerId = 'no-dockerfile-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));
        mockFs.access.mockRejectedValue(new Error('ENOENT: no such file or directory'));

        const config: ContainerConfig = {
          image: 'python:3.11',
          dockerfile: 'NonexistentDockerfile',
          buildContext: '.',
        };

        const result = await manager.createContainer({
          config,
          taskId: 'no-dockerfile-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('python:3.11');

        // ImageBuilder should not have been called for build
        expect(mockImageBuilderInstance.buildImage).not.toHaveBeenCalled();
      });

      it('should fallback to config.image when ImageBuilder initialization fails', async () => {
        const containerId = 'init-fail-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));
        mockFs.access.mockResolvedValue();

        mockImageBuilderInstance.initialize.mockRejectedValue(
          new Error('No container runtime available for image building')
        );

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const config: ContainerConfig = {
          image: 'golang:1.21',
          dockerfile: 'Dockerfile.go',
          buildContext: '.',
        };

        const result = await manager.createContainer({
          config,
          taskId: 'init-fail-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('golang:1.21');

        consoleSpy.mockRestore();
      });

      it('should fallback to config.image when build throws exception', async () => {
        const containerId = 'exception-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));
        mockFs.access.mockResolvedValue();

        mockImageBuilderInstance.buildImage.mockRejectedValue(
          new Error('Unexpected build error: out of disk space')
        );

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const config: ContainerConfig = {
          image: 'ruby:3.2',
          dockerfile: 'Dockerfile.ruby',
          buildContext: '.',
        };

        const result = await manager.createContainer({
          config,
          taskId: 'exception-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('ruby:3.2');

        consoleSpy.mockRestore();
      });

      it('should preserve all config options when falling back to base image', async () => {
        const containerId = 'preserve-config-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));
        mockFs.access.mockResolvedValue();

        const buildResult = createFailedBuildResult('Build timeout exceeded');
        mockImageBuilderInstance.buildImage.mockResolvedValue(buildResult);

        const config: ContainerConfig = {
          image: 'node:20',
          dockerfile: 'Dockerfile',
          buildContext: '.',
          environment: { PRESERVED: 'true', ENV: 'test' },
          volumes: { '/host/preserved': '/container/preserved' },
          workingDir: '/preserved/dir',
        };

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await manager.createContainer({
          config,
          taskId: 'preserve-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        // Using fallback image
        expect(result.command).toContain('node:20');
        // But preserving all other config
        expect(result.command).toContain('-e PRESERVED=true');
        expect(result.command).toContain('-e ENV=test');
        expect(result.command).toContain('-v /host/preserved:/container/preserved');
        expect(result.command).toContain('-w /preserved/dir');

        consoleSpy.mockRestore();
      });
    });
  });

  // ===========================================================================
  // Section 3: Image Building Scenarios
  // ===========================================================================

  describe('Image Building Scenarios', () => {
    describe('Fresh Builds', () => {
      it('should perform fresh build when image does not exist', async () => {
        const containerId = 'fresh-build-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));
        mockFs.access.mockResolvedValue();

        const buildResult = createSuccessfulBuildResult('fresh-app:v1.0.0', {
          rebuilt: true,
          buildDuration: 45000,
          buildOutput: `Step 1/8 : FROM node:18-alpine
---> 123456789abc
Step 2/8 : WORKDIR /app
---> Using cache
---> 234567890bcd
Step 3/8 : COPY package*.json ./
---> 345678901cde
Step 4/8 : RUN npm ci
---> Running in temp123
Successfully built fresh-app:v1.0.0`,
        });

        mockImageBuilderInstance.buildImage.mockResolvedValue(buildResult);

        const config: ContainerConfig = {
          image: 'node:18-alpine',
          dockerfile: 'Dockerfile.fresh',
          buildContext: '.',
          imageTag: 'fresh-app:v1.0.0',
        };

        const result = await manager.createContainer({
          config,
          taskId: 'fresh-build-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('fresh-app:v1.0.0');
        expect(mockImageBuilderInstance.buildImage).toHaveBeenCalledWith({
          dockerfilePath: 'Dockerfile.fresh',
          buildContext: '.',
          imageTag: 'fresh-app:v1.0.0',
        });
      });

      it('should handle long-running fresh builds', async () => {
        const containerId = 'long-build-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));
        mockFs.access.mockResolvedValue();

        const buildResult = createSuccessfulBuildResult('large-app:latest', {
          rebuilt: true,
          buildDuration: 300000, // 5 minutes
        });

        mockImageBuilderInstance.buildImage.mockResolvedValue(buildResult);

        const config: ContainerConfig = {
          image: 'ubuntu:22.04',
          dockerfile: 'Dockerfile.large',
          buildContext: '.',
        };

        const result = await manager.createContainer({
          config,
          taskId: 'long-build-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
      });
    });

    describe('Cached Builds', () => {
      it('should use cached image when Dockerfile has not changed', async () => {
        const containerId = 'cached-build-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));
        mockFs.access.mockResolvedValue();

        const buildResult = createSuccessfulBuildResult('cached-app:latest', {
          rebuilt: false, // Cache hit
          buildDuration: 50, // Very fast
          buildOutput: 'Using cached image (no Dockerfile changes detected)',
        });

        mockImageBuilderInstance.buildImage.mockResolvedValue(buildResult);

        const config: ContainerConfig = {
          image: 'node:20',
          dockerfile: 'Dockerfile',
          buildContext: '.',
          imageTag: 'cached-app:latest',
        };

        const result = await manager.createContainer({
          config,
          taskId: 'cached-build-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('cached-app:latest');
      });

      it('should handle partial cache hits (some layers rebuilt)', async () => {
        const containerId = 'partial-cache-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));
        mockFs.access.mockResolvedValue();

        const buildResult = createSuccessfulBuildResult('partial-cache-app:latest', {
          rebuilt: true,
          buildDuration: 15000,
          buildOutput: `Step 1/5 : FROM node:20 (cached)
Step 2/5 : WORKDIR /app (cached)
Step 3/5 : COPY . . (rebuilding due to changes)
Step 4/5 : RUN npm install
Step 5/5 : CMD ["npm", "start"]
Successfully built partial-cache-app:latest`,
        });

        mockImageBuilderInstance.buildImage.mockResolvedValue(buildResult);

        const config: ContainerConfig = {
          image: 'node:20',
          dockerfile: 'Dockerfile',
          buildContext: '.',
        };

        const result = await manager.createContainer({
          config,
          taskId: 'partial-cache-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
      });
    });

    describe('Multi-stage Builds', () => {
      it('should handle multi-stage Dockerfile builds', async () => {
        const containerId = 'multistage-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));
        mockFs.access.mockResolvedValue();

        const buildResult = createSuccessfulBuildResult('multistage-app:production', {
          rebuilt: true,
          buildDuration: 120000,
          imageInfo: {
            tag: 'multistage-app:production',
            id: 'sha256:multistage123',
            created: new Date(),
            exists: true,
            size: 150000000, // Optimized size
            sizeFormatted: '150MB',
          },
          buildOutput: `Step 1/15 : FROM node:18-alpine as builder
---> 123456789abc
Step 2/15 : WORKDIR /build
---> 234567890bcd
Step 6/15 : RUN npm run build
---> 678901234fgh
Step 7/15 : FROM nginx:alpine as production
---> 789012345ghi
Step 8/15 : COPY --from=builder /build/dist /usr/share/nginx/html
---> 890123456hij
Successfully built multistage-app:production`,
        });

        mockImageBuilderInstance.buildImage.mockResolvedValue(buildResult);

        const config: ContainerConfig = {
          image: 'nginx:alpine',
          dockerfile: 'build/Dockerfile.multistage',
          buildContext: 'build',
          imageTag: 'multistage-app:production',
        };

        const result = await manager.createContainer({
          config,
          taskId: 'multistage-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('multistage-app:production');
      });

      it('should handle complex multi-stage build with multiple targets', async () => {
        const containerId = 'complex-multistage-container';
        mockExec.mockImplementationOnce(mockExecCallback(containerId));
        mockFs.access.mockResolvedValue();

        const buildResult = createSuccessfulBuildResult('complex-app:dev', {
          rebuilt: true,
          buildDuration: 180000,
          buildOutput: `Building target: development
Step 1/20 : FROM node:20 as base
Step 5/20 : FROM base as deps
Step 10/20 : FROM base as builder
Step 15/20 : FROM node:20-slim as development
Successfully built complex-app:dev`,
        });

        mockImageBuilderInstance.buildImage.mockResolvedValue(buildResult);

        const config: ContainerConfig = {
          image: 'node:20-slim',
          dockerfile: 'Dockerfile.complex',
          buildContext: '.',
          imageTag: 'complex-app:dev',
        };

        const result = await manager.createContainer({
          config,
          taskId: 'complex-multistage-task',
          autoStart: false,
        });

        expect(result.success).toBe(true);
      });
    });

    describe('Concurrent Build Requests', () => {
      it('should handle concurrent container creation with builds', async () => {
        mockExec.mockImplementation(mockExecCallback('concurrent-container'));
        mockFs.access.mockResolvedValue();

        const buildResult = createSuccessfulBuildResult('concurrent-app:latest');
        mockImageBuilderInstance.buildImage.mockResolvedValue(buildResult);

        const config: ContainerConfig = {
          image: 'node:20',
          dockerfile: 'Dockerfile',
          buildContext: '.',
          imageTag: 'concurrent-app:latest',
        };

        // Launch 5 concurrent container creations
        const results = await Promise.all([
          manager.createContainer({ config, taskId: 'concurrent-1', autoStart: false }),
          manager.createContainer({ config, taskId: 'concurrent-2', autoStart: false }),
          manager.createContainer({ config, taskId: 'concurrent-3', autoStart: false }),
          manager.createContainer({ config, taskId: 'concurrent-4', autoStart: false }),
          manager.createContainer({ config, taskId: 'concurrent-5', autoStart: false }),
        ]);

        // All should succeed
        results.forEach((result) => {
          expect(result.success).toBe(true);
        });

        // ImageBuilder instantiated only once
        expect(MockedImageBuilder).toHaveBeenCalledTimes(1);

        // But build called for each
        expect(mockImageBuilderInstance.buildImage).toHaveBeenCalledTimes(5);
      });
    });
  });

  // ===========================================================================
  // Section 4: Creation Failure Scenarios
  // ===========================================================================

  describe('Creation Failure Scenarios', () => {
    describe('Invalid Configuration', () => {
      it('should fail when runtime returns none', async () => {
        vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('none');

        const events: ContainerOperationEvent[] = [];
        manager.on('container:created', (e) => events.push(e));

        const config = createMinimalConfig();
        const result = await manager.createContainer({
          config,
          taskId: 'no-runtime-task',
          autoStart: false,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('No container runtime available');
        expect(events).toHaveLength(1);
        expect(events[0].success).toBe(false);
        expect(events[0].error).toContain('No container runtime available');
      });

      it('should fail with invalid container name characters', async () => {
        const stderr = 'Error: invalid container name: apex-invalid@name#123';
        mockExec.mockImplementationOnce(mockExecCallback('', stderr));

        const config = createMinimalConfig();
        const result = await manager.createContainer({
          config,
          taskId: 'invalid@name#123',
          autoStart: false,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Container creation failed');
      });
    });

    describe('Runtime Unavailable', () => {
      it('should fail gracefully when Docker daemon is not running', async () => {
        const error = new Error('Cannot connect to Docker daemon');
        mockExec.mockImplementationOnce(
          mockExecCallback('', 'Cannot connect to the Docker daemon', error)
        );

        const config = createMinimalConfig();
        const result = await manager.createContainer({
          config,
          taskId: 'daemon-down-task',
          autoStart: false,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Container creation failed');
      });

      it('should fail gracefully when Podman socket is unavailable', async () => {
        vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('podman');

        const error = new Error('Cannot connect to Podman socket');
        mockExec.mockImplementationOnce(
          mockExecCallback('', 'Error: unable to connect to Podman socket', error)
        );

        const config = createMinimalConfig();
        const result = await manager.createContainer({
          config,
          taskId: 'podman-socket-task',
          autoStart: false,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Container creation failed');
      });

      it('should emit failure event when runtime becomes unavailable mid-operation', async () => {
        const events: ContainerOperationEvent[] = [];
        manager.on('container:created', (e) => events.push(e));

        const error = new Error('Connection lost to container runtime');
        mockExec.mockImplementationOnce(mockExecCallback('', '', error));

        const config = createMinimalConfig();
        await manager.createContainer({
          config,
          taskId: 'connection-lost-task',
          autoStart: false,
        });

        expect(events).toHaveLength(1);
        expect(events[0].success).toBe(false);
        expect(events[0].error).toContain('Connection lost');
      });
    });

    describe('Command Failures', () => {
      it('should handle image pull failure', async () => {
        const stderr = 'Error response from daemon: pull access denied for invalid-image';
        mockExec.mockImplementationOnce(mockExecCallback('', stderr));

        const config: ContainerConfig = {
          image: 'nonexistent-registry.com/invalid-image:tag',
        };

        const result = await manager.createContainer({
          config,
          taskId: 'pull-fail-task',
          autoStart: false,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('pull access denied');
      });

      it('should handle insufficient resources error', async () => {
        const stderr = 'Error response from daemon: insufficient memory';
        mockExec.mockImplementationOnce(mockExecCallback('', stderr));

        const config = createMinimalConfig({
          resourceLimits: {
            memory: '1000g', // Excessive memory request
          },
        });

        const result = await manager.createContainer({
          config,
          taskId: 'resources-task',
          autoStart: false,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('insufficient memory');
      });

      it('should handle duplicate container name error', async () => {
        const stderr = 'Error: Conflict. The container name "/apex-duplicate-task" is already in use';
        mockExec.mockImplementationOnce(mockExecCallback('', stderr));

        const config = createMinimalConfig();
        const result = await manager.createContainer({
          config,
          taskId: 'duplicate-task',
          autoStart: false,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('already in use');
      });

      it('should handle volume mount permission error', async () => {
        const stderr = 'Error response from daemon: error mounting "/restricted/path": permission denied';
        mockExec.mockImplementationOnce(mockExecCallback('', stderr));

        const config = createMinimalConfig({
          volumes: {
            '/restricted/path': '/container/path',
          },
        });

        const result = await manager.createContainer({
          config,
          taskId: 'permission-task',
          autoStart: false,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('permission denied');
      });

      it('should handle network creation error', async () => {
        const stderr = 'Error: network nonexistent-network not found';
        mockExec.mockImplementationOnce(mockExecCallback('', stderr));

        const config = createMinimalConfig({
          networkMode: 'nonexistent-network' as any,
        });

        const result = await manager.createContainer({
          config,
          taskId: 'network-task',
          autoStart: false,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('network');
      });

      it('should cleanup container when auto-start fails', async () => {
        const containerId = 'cleanup-container';

        mockExec
          .mockImplementationOnce(mockExecCallback(containerId)) // create success
          .mockImplementationOnce(mockExecCallback('', 'Error: container cannot start')) // start fails
          .mockImplementationOnce(mockExecCallback(containerId)); // cleanup rm

        const config = createMinimalConfig();
        const result = await manager.createContainer({
          config,
          taskId: 'cleanup-task',
          autoStart: true,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('container cannot start');

        // Verify cleanup was attempted
        const rmCall = mockExec.mock.calls.find((call) =>
          (call[0] as string).includes('rm')
        );
        expect(rmCall).toBeDefined();
        expect(rmCall![0]).toContain(containerId);
      });
    });

    describe('Timeout Errors', () => {
      it('should handle container creation timeout', async () => {
        const error = new Error('Command timed out') as any;
        error.code = 'ETIMEDOUT';

        mockExec.mockImplementationOnce((cmd, opts, cb) => {
          if (cb) {
            setTimeout(() => cb(error, '', ''), 0);
          }
          return {} as any;
        });

        const config = createMinimalConfig();
        const result = await manager.createContainer({
          config,
          taskId: 'timeout-task',
          autoStart: false,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Container creation failed');
      });

      it('should handle start timeout after successful creation', async () => {
        const containerId = 'start-timeout-container';
        const error = new Error('Command timed out') as any;
        error.code = 'ETIMEDOUT';

        mockExec
          .mockImplementationOnce(mockExecCallback(containerId)) // create success
          .mockImplementationOnce((cmd, opts, cb) => {
            // start timeout
            if (cb) {
              setTimeout(() => cb(error, '', ''), 0);
            }
            return {} as any;
          })
          .mockImplementationOnce(mockExecCallback(containerId)); // cleanup

        const config = createMinimalConfig();
        const result = await manager.createContainer({
          config,
          taskId: 'start-timeout-task',
          autoStart: true,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Container start failed');
      });

      it('should emit failure events for timeout scenarios', async () => {
        const events: ContainerOperationEvent[] = [];
        manager.on('container:created', (e) => events.push(e));

        const error = new Error('Command timed out') as any;
        error.code = 'ETIMEDOUT';

        mockExec.mockImplementationOnce((cmd, opts, cb) => {
          if (cb) {
            setTimeout(() => cb(error, '', ''), 0);
          }
          return {} as any;
        });

        const config = createMinimalConfig();
        await manager.createContainer({
          config,
          taskId: 'timeout-event-task',
          autoStart: false,
        });

        expect(events).toHaveLength(1);
        expect(events[0].success).toBe(false);
        expect(events[0].error).toContain('Container creation failed');
      });
    });

    describe('Exception Handling', () => {
      it('should handle unexpected exceptions during creation', async () => {
        mockExec.mockImplementationOnce(() => {
          throw new Error('Unexpected system error');
        });

        const events: ContainerOperationEvent[] = [];
        manager.on('container:created', (e) => events.push(e));

        const config = createMinimalConfig();
        const result = await manager.createContainer({
          config,
          taskId: 'exception-task',
          autoStart: false,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Container creation failed');
        expect(result.error).toContain('Unexpected system error');

        expect(events).toHaveLength(1);
        expect(events[0].success).toBe(false);
      });

      it('should handle non-Error exceptions', async () => {
        mockExec.mockImplementationOnce(() => {
          throw 'String error message';
        });

        const config = createMinimalConfig();
        const result = await manager.createContainer({
          config,
          taskId: 'non-error-task',
          autoStart: false,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Container creation failed');
      });

      it('should handle null/undefined exceptions', async () => {
        mockExec.mockImplementationOnce(() => {
          throw null;
        });

        const config = createMinimalConfig();
        const result = await manager.createContainer({
          config,
          taskId: 'null-error-task',
          autoStart: false,
        });

        expect(result.success).toBe(false);
      });
    });
  });

  // ===========================================================================
  // Section 5: Event Emission and Lifecycle
  // ===========================================================================

  describe('Event Emission and Lifecycle', () => {
    it('should emit lifecycle events in correct order for successful creation with auto-start', async () => {
      const containerId = 'lifecycle-container';
      const inspectOutput = `${containerId}|apex-lifecycle-task|alpine:latest|running|2024-01-01T00:00:00Z|2024-01-01T00:00:01Z||0`;

      mockExec
        .mockImplementationOnce(mockExecCallback(containerId))
        .mockImplementationOnce(mockExecCallback(containerId))
        .mockImplementationOnce(mockExecCallback(inspectOutput));

      const lifecycleEvents: Array<{ operation: string; timestamp: Date }> = [];

      manager.on('container:lifecycle', (event, operation) => {
        lifecycleEvents.push({ operation, timestamp: event.timestamp });
      });

      const config = createMinimalConfig();
      await manager.createContainer({
        config,
        taskId: 'lifecycle-task',
        autoStart: true,
      });

      expect(lifecycleEvents).toHaveLength(2);
      expect(lifecycleEvents[0].operation).toBe('created');
      expect(lifecycleEvents[1].operation).toBe('started');

      // Verify order (created before started)
      expect(lifecycleEvents[0].timestamp.getTime()).toBeLessThanOrEqual(
        lifecycleEvents[1].timestamp.getTime()
      );
    });

    it('should include complete event data for all operations', async () => {
      const containerId = 'event-data-container';

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      let capturedEvent: ContainerOperationEvent | null = null;
      manager.on('container:created', (event) => {
        capturedEvent = event;
      });

      const config = createMinimalConfig({
        environment: { TEST: 'value' },
      });

      await manager.createContainer({
        config,
        taskId: 'event-data-task',
        autoStart: false,
      });

      expect(capturedEvent).not.toBeNull();
      expect(capturedEvent!.containerId).toBe(containerId);
      expect(capturedEvent!.taskId).toBe('event-data-task');
      expect(capturedEvent!.success).toBe(true);
      expect(capturedEvent!.timestamp).toBeInstanceOf(Date);
      expect(capturedEvent!.command).toContain('docker create');
    });

    it('should support multiple event listeners', async () => {
      const containerId = 'multi-listener-container';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const listener1Events: ContainerOperationEvent[] = [];
      const listener2Events: ContainerOperationEvent[] = [];
      const listener3Events: ContainerOperationEvent[] = [];

      manager.on('container:created', (e) => listener1Events.push(e));
      manager.on('container:created', (e) => listener2Events.push(e));
      manager.on('container:created', (e) => listener3Events.push(e));

      const config = createMinimalConfig();
      await manager.createContainer({
        config,
        taskId: 'multi-listener-task',
        autoStart: false,
      });

      expect(listener1Events).toHaveLength(1);
      expect(listener2Events).toHaveLength(1);
      expect(listener3Events).toHaveLength(1);

      // All should have received the same event data
      expect(listener1Events[0].containerId).toBe(containerId);
      expect(listener2Events[0].containerId).toBe(containerId);
      expect(listener3Events[0].containerId).toBe(containerId);
    });
  });

  // ===========================================================================
  // Section 6: Edge Cases and Special Scenarios
  // ===========================================================================

  describe('Edge Cases and Special Scenarios', () => {
    it('should handle empty task ID', async () => {
      const containerId = 'empty-taskid-container';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const config = createMinimalConfig();
      const result = await manager.createContainer({
        config,
        taskId: '',
        autoStart: false,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--name apex-');
    });

    it('should handle very long task ID', async () => {
      const containerId = 'long-taskid-container';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const longTaskId = 'a'.repeat(200);
      const config = createMinimalConfig();
      const result = await manager.createContainer({
        config,
        taskId: longTaskId,
        autoStart: false,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain(`apex-${longTaskId}`);
    });

    it('should handle custom name override', async () => {
      const containerId = 'custom-name-container';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const config = createMinimalConfig();
      const result = await manager.createContainer({
        config,
        taskId: 'ignored-task-id',
        autoStart: false,
        nameOverride: 'my-custom-container-name',
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--name my-custom-container-name');
      expect(result.command).not.toContain('apex-ignored-task-id');
    });

    it('should handle container with all security options', async () => {
      const containerId = 'security-container';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const config = createMinimalConfig({
        privileged: true,
        securityOpts: ['seccomp=unconfined', 'apparmor=unconfined', 'no-new-privileges'],
        capAdd: ['SYS_ADMIN', 'NET_ADMIN', 'SYS_PTRACE'],
        capDrop: ['MKNOD', 'AUDIT_WRITE'],
      });

      const result = await manager.createContainer({
        config,
        taskId: 'security-task',
        autoStart: false,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--privileged');
      expect(result.command).toContain('--security-opt seccomp=unconfined');
      expect(result.command).toContain('--security-opt apparmor=unconfined');
      expect(result.command).toContain('--security-opt no-new-privileges');
      expect(result.command).toContain('--cap-add SYS_ADMIN');
      expect(result.command).toContain('--cap-add NET_ADMIN');
      expect(result.command).toContain('--cap-add SYS_PTRACE');
      expect(result.command).toContain('--cap-drop MKNOD');
      expect(result.command).toContain('--cap-drop AUDIT_WRITE');
    });

    it('should handle container with custom entrypoint and command', async () => {
      const containerId = 'entrypoint-container';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const config = createMinimalConfig({
        entrypoint: ['/bin/bash', '-c'],
        command: ['echo', 'hello', 'world'],
      });

      const result = await manager.createContainer({
        config,
        taskId: 'entrypoint-task',
        autoStart: false,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--entrypoint');
      expect(result.command).toContain('echo');
      expect(result.command).toContain('hello');
      expect(result.command).toContain('world');
    });

    it('should handle different network modes', async () => {
      const networkModes = ['bridge', 'host', 'none'] as const;

      for (const networkMode of networkModes) {
        const containerId = `network-${networkMode}-container`;
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        const config = createMinimalConfig({ networkMode });
        const result = await manager.createContainer({
          config,
          taskId: `network-${networkMode}-task`,
          autoStart: false,
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain(`--network ${networkMode}`);
      }
    });

    it('should add APEX-specific labels automatically', async () => {
      const containerId = 'labels-container';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const config = createMinimalConfig();
      const result = await manager.createContainer({
        config,
        taskId: 'labels-task',
        autoStart: false,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--label apex.managed=true');
      expect(result.command).toContain('--label apex.container-name=');
    });
  });
});
