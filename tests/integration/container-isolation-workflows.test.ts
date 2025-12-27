/**
 * Integration Tests for Container Isolation Workflows
 *
 * These tests validate that the container isolation workflows described
 * in the documentation actually work as expected.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContainerManager, ContainerRuntime } from '@apexcli/core';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { WorkspaceManager } from '@apexcli/orchestrator';
import type { ContainerConfig, ApexConfig } from '@apexcli/core';

// Mock child_process for testing
vi.mock('child_process');

describe('Container Isolation Workflows Integration Tests', () => {
  let containerManager: ContainerManager;
  let mockRuntime: ContainerRuntime;
  let orchestrator: ApexOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock runtime to always report docker available
    mockRuntime = new ContainerRuntime();
    vi.spyOn(mockRuntime, 'getBestRuntime').mockResolvedValue('docker');
    vi.spyOn(mockRuntime, 'isRuntimeAvailable').mockResolvedValue(true);

    containerManager = new ContainerManager(mockRuntime);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Basic container workflow', () => {
    it('should create, start, execute commands, and cleanup container', async () => {
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      const containerId = 'test-container-123';

      // Mock container creation
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        cb(null, containerId, '');
      }));

      // Mock container start
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        cb(null, containerId, '');
      }));

      // Mock container info for start verification
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        cb(null, `${containerId}|test-container|node:20-alpine|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>`, '');
      }));

      // Mock command execution
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        cb(null, 'npm install completed successfully', '');
      }));

      // Mock container stop
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        cb(null, containerId, '');
      }));

      // Mock container removal
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        cb(null, containerId, '');
      }));

      const config: ContainerConfig = {
        image: 'node:20-alpine',
        resourceLimits: {
          cpu: 2,
          memory: '4g'
        },
        environment: {
          NODE_ENV: 'development'
        },
        autoRemove: true
      };

      // Create container
      const createResult = await containerManager.createContainer({
        config,
        taskId: 'workflow-test',
        autoStart: true
      });

      expect(createResult.success).toBe(true);
      expect(createResult.containerId).toBe(containerId);

      // Execute dependency installation (simulating workflow step)
      const execResult = await containerManager.execCommand(
        containerId,
        'npm install',
        { workingDir: '/workspace' }
      );

      expect(execResult.success).toBe(true);
      expect(execResult.stdout).toContain('npm install completed successfully');

      // Cleanup
      const stopResult = await containerManager.stopContainer(containerId);
      expect(stopResult.success).toBe(true);

      const removeResult = await containerManager.removeContainer(containerId);
      expect(removeResult.success).toBe(true);
    });

    it('should handle container workflow with custom Dockerfile', async () => {
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      const containerId = 'custom-dockerfile-container';

      // Mock image build
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        expect(cmd).toContain('docker build');
        expect(cmd).toContain('-f .apex/Dockerfile');
        cb(null, 'Successfully built abc123def456', '');
      }));

      // Mock container creation with custom image
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        expect(cmd).toContain('my-project:latest');
        cb(null, containerId, '');
      }));

      const config: ContainerConfig = {
        dockerfile: '.apex/Dockerfile',
        buildContext: '.',
        imageTag: 'my-project:latest',
        resourceLimits: {
          cpu: 1,
          memory: '2g'
        }
      };

      const result = await containerManager.createContainer({
        config,
        taskId: 'dockerfile-test',
        autoStart: false
      });

      expect(result.success).toBe(true);
      expect(result.containerId).toBe(containerId);
    });
  });

  describe('Resource limits workflow', () => {
    it('should apply resource limits as documented', async () => {
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      const containerId = 'resource-limited-container';

      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        // Verify resource limits are applied in docker command
        expect(cmd).toContain('--memory 4g');
        expect(cmd).toContain('--cpus 2');
        expect(cmd).toContain('--memory-reservation 2g');
        expect(cmd).toContain('--memory-swap 8g');
        expect(cmd).toContain('--cpu-shares 1024');
        expect(cmd).toContain('--pids-limit 1000');

        cb(null, containerId, '');
      }));

      const config: ContainerConfig = {
        image: 'node:20-alpine',
        resourceLimits: {
          cpu: 2,
          memory: '4g',
          memoryReservation: '2g',
          memorySwap: '8g',
          cpuShares: 1024,
          pidsLimit: 1000
        }
      };

      const result = await containerManager.createContainer({
        config,
        taskId: 'resource-test'
      });

      expect(result.success).toBe(true);
    });

    it('should handle per-task resource overrides', async () => {
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      const containerId = 'override-container';

      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        expect(cmd).toContain('--memory 8g');
        expect(cmd).toContain('--cpus 4');
        cb(null, containerId, '');
      }));

      // Base configuration
      const baseConfig: ContainerConfig = {
        image: 'node:20-alpine',
        resourceLimits: {
          cpu: 1,
          memory: '2g'
        }
      };

      // Override for intensive task
      const overrideConfig: ContainerConfig = {
        ...baseConfig,
        resourceLimits: {
          cpu: 4,
          memory: '8g'
        }
      };

      const result = await containerManager.createContainer({
        config: overrideConfig,
        taskId: 'intensive-task'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Security configuration workflow', () => {
    it('should apply security options as documented', async () => {
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      const containerId = 'secure-container';

      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        // Verify security options are applied
        expect(cmd).not.toContain('--privileged');
        expect(cmd).toContain('--security-opt no-new-privileges:true');
        expect(cmd).toContain('--cap-drop ALL');
        expect(cmd).toContain('--cap-add NET_BIND_SERVICE');
        expect(cmd).toContain('--user 1000:1000');

        cb(null, containerId, '');
      }));

      const config: ContainerConfig = {
        image: 'node:20-alpine',
        privileged: false,
        user: '1000:1000',
        securityOpts: ['no-new-privileges:true'],
        capDrop: ['ALL'],
        capAdd: ['NET_BIND_SERVICE']
      };

      const result = await containerManager.createContainer({
        config,
        taskId: 'security-test'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Environment and volume workflow', () => {
    it('should configure environment variables and volumes', async () => {
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      const containerId = 'env-vol-container';

      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        // Verify environment variables
        expect(cmd).toContain('--env NODE_ENV=development');
        expect(cmd).toContain('--env NPM_CONFIG_UPDATE_NOTIFIER=false');

        // Verify volume mounts
        expect(cmd).toContain('-v ./data:/app/data');
        expect(cmd).toContain('-v /host/config:/app/config');

        // Verify working directory
        expect(cmd).toContain('--workdir /workspace');

        cb(null, containerId, '');
      }));

      const config: ContainerConfig = {
        image: 'node:20-alpine',
        environment: {
          NODE_ENV: 'development',
          NPM_CONFIG_UPDATE_NOTIFIER: 'false'
        },
        volumes: {
          './data': '/app/data',
          '/host/config': '/app/config'
        },
        workingDir: '/workspace'
      };

      const result = await containerManager.createContainer({
        config,
        taskId: 'env-vol-test'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Network configuration workflow', () => {
    it('should configure network mode', async () => {
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      const containerId = 'network-container';

      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        expect(cmd).toContain('--network bridge');
        cb(null, containerId, '');
      }));

      const config: ContainerConfig = {
        image: 'node:20-alpine',
        networkMode: 'bridge'
      };

      const result = await containerManager.createContainer({
        config,
        taskId: 'network-test'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Error handling workflows', () => {
    it('should handle container creation failures gracefully', async () => {
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      // Mock creation failure
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        cb(null, '', 'Unable to find image: nonexistent:image');
      }));

      const config: ContainerConfig = {
        image: 'nonexistent:image'
      };

      const result = await containerManager.createContainer({
        config,
        taskId: 'failure-test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container creation failed');
      expect(result.error).toContain('Unable to find image');
    });

    it('should handle command execution failures in container', async () => {
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      const containerId = 'command-fail-container';

      // Mock successful container creation
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        cb(null, containerId, '');
      }));

      // Mock command execution failure
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        const error = new Error('Command failed') as any;
        error.code = 1;
        cb(error, '', 'npm ERR! network failure');
      }));

      const config: ContainerConfig = {
        image: 'node:20-alpine'
      };

      const createResult = await containerManager.createContainer({
        config,
        taskId: 'cmd-fail-test'
      });

      expect(createResult.success).toBe(true);

      const execResult = await containerManager.execCommand(
        containerId,
        'npm install nonexistent-package'
      );

      expect(execResult.success).toBe(false);
      expect(execResult.exitCode).toBe(1);
      expect(execResult.stderr).toContain('npm ERR!');
    });
  });

  describe('Container lifecycle events workflow', () => {
    it('should emit events during container lifecycle', async () => {
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      const containerId = 'events-container';
      const events: any[] = [];

      // Listen to all container events
      containerManager.on('container:created', (event) => events.push({ type: 'created', ...event }));
      containerManager.on('container:started', (event) => events.push({ type: 'started', ...event }));
      containerManager.on('container:stopped', (event) => events.push({ type: 'stopped', ...event }));
      containerManager.on('container:removed', (event) => events.push({ type: 'removed', ...event }));

      // Mock all operations
      mockExec
        .mockImplementationOnce(vi.fn((cmd, opts, cb: any) => cb(null, containerId, ''))) // create
        .mockImplementationOnce(vi.fn((cmd, opts, cb: any) => cb(null, containerId, ''))) // start
        .mockImplementationOnce(vi.fn((cmd, opts, cb: any) => cb(null, `${containerId}|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>`, ''))) // inspect
        .mockImplementationOnce(vi.fn((cmd, opts, cb: any) => cb(null, containerId, ''))) // stop
        .mockImplementationOnce(vi.fn((cmd, opts, cb: any) => cb(null, containerId, ''))); // remove

      const config: ContainerConfig = {
        image: 'node:20-alpine'
      };

      // Execute lifecycle
      const createResult = await containerManager.createContainer({
        config,
        taskId: 'events-test',
        autoStart: false
      });

      const startResult = await containerManager.startContainer(containerId);
      const stopResult = await containerManager.stopContainer(containerId);
      const removeResult = await containerManager.removeContainer(containerId);

      // Verify all operations succeeded
      expect(createResult.success).toBe(true);
      expect(startResult.success).toBe(true);
      expect(stopResult.success).toBe(true);
      expect(removeResult.success).toBe(true);

      // Verify events were emitted
      expect(events).toHaveLength(4);
      expect(events[0].type).toBe('created');
      expect(events[1].type).toBe('started');
      expect(events[2].type).toBe('stopped');
      expect(events[3].type).toBe('removed');

      // Verify event data
      events.forEach(event => {
        expect(event.containerId).toBe(containerId);
        expect(event.timestamp).toBeInstanceOf(Date);
        expect(event.success).toBe(true);
      });
    });
  });

  describe('Runtime detection workflow', () => {
    it('should fallback to podman when docker unavailable', async () => {
      // Mock docker unavailable, podman available
      const alternateRuntime = new ContainerRuntime();
      vi.spyOn(alternateRuntime, 'getBestRuntime').mockResolvedValue('podman');
      vi.spyOn(alternateRuntime, 'isRuntimeAvailable').mockResolvedValue(true);

      const podmanManager = new ContainerManager(alternateRuntime);

      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      const containerId = 'podman-container';

      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        expect(cmd).toContain('podman create');
        cb(null, containerId, '');
      }));

      const config: ContainerConfig = {
        image: 'node:20-alpine'
      };

      const result = await podmanManager.createContainer({
        config,
        taskId: 'podman-test'
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('podman create');
    });

    it('should handle no runtime available', async () => {
      const noRuntime = new ContainerRuntime();
      vi.spyOn(noRuntime, 'getBestRuntime').mockResolvedValue('none');
      vi.spyOn(noRuntime, 'isRuntimeAvailable').mockResolvedValue(false);

      const noRuntimeManager = new ContainerManager(noRuntime);

      const config: ContainerConfig = {
        image: 'node:20-alpine'
      };

      const result = await noRuntimeManager.createContainer({
        config,
        taskId: 'no-runtime-test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No container runtime available');
    });
  });

  describe('Auto cleanup workflow', () => {
    it('should auto-cleanup on failure when enabled', async () => {
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      const containerId = 'cleanup-container';

      // Mock successful create
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        cb(null, containerId, '');
      }));

      // Mock failed start
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        cb(new Error('Container failed to start'), '', 'Port already in use');
      }));

      // Mock cleanup removal
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        expect(cmd).toContain('docker rm');
        expect(cmd).toContain(containerId);
        cb(null, containerId, '');
      }));

      const config: ContainerConfig = {
        image: 'node:20-alpine',
        autoRemove: true
      };

      const result = await containerManager.createContainer({
        config,
        taskId: 'cleanup-test',
        autoStart: true // This will trigger cleanup on start failure
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container start failed');
    });
  });

  describe('Container stats and monitoring workflow', () => {
    it('should retrieve container statistics', async () => {
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      const containerId = 'stats-container';
      const statsOutput = 'CONTAINER|CPU %|MEM USAGE / LIMIT|MEM %|NET I/O|BLOCK I/O|PIDS\nstats-container|25.50%|512MiB / 1GiB|50.00%|1.2kB / 800B|1.5MB / 900kB|42';

      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        expect(cmd).toContain('docker stats');
        expect(cmd).toContain('--no-stream');
        cb(null, statsOutput, '');
      }));

      const stats = await containerManager.getStats(containerId);

      expect(stats).not.toBeNull();
      expect(stats!.cpuPercent).toBe(25.5);
      expect(stats!.memoryPercent).toBe(50.0);
      expect(stats!.pids).toBe(42);
    });
  });
});