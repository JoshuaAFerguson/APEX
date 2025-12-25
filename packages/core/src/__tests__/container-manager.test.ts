import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import {
  ContainerManager,
  containerManager,
  createTaskContainer,
  generateTaskContainerName,
  type ContainerOperationResult,
  type CreateContainerOptions,
} from '../container-manager';
import { ContainerRuntime } from '../container-runtime';
import { ContainerConfig, ContainerStats, ContainerStatus } from '../types';

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

const mockExec = vi.mocked(exec);

// Mock ContainerRuntime
vi.mock('../container-runtime');
const MockedContainerRuntime = vi.mocked(ContainerRuntime);

// Helper to create a mock exec callback
function mockExecCallback(stdout: string, stderr?: string, error?: Error) {
  return vi.fn((command: string, options: any, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
    if (callback) {
      setTimeout(() => callback(error || null, stdout, stderr || ''), 0);
    }
    return {} as any; // Mock ChildProcess
  });
}

describe('ContainerManager', () => {
  let manager: ContainerManager;
  let mockRuntime: ContainerRuntime;

  beforeEach(() => {
    // Create a mock runtime
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    vi.mocked(mockRuntime.isRuntimeAvailable).mockResolvedValue(true);

    manager = new ContainerManager(mockRuntime);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // Container Name Generation Tests
  // ============================================================================

  describe('generateContainerName', () => {
    it('should generate name with default configuration', () => {
      const taskId = 'task-123';
      const name = manager.generateContainerName(taskId);

      expect(name).toBe('apex-task-123');
    });

    it('should sanitize invalid characters in task ID', () => {
      const taskId = 'task@123#invalid!';
      const name = manager.generateContainerName(taskId);

      expect(name).toBe('apex-task_123_invalid_');
    });

    it('should include timestamp when configured', () => {
      const taskId = 'task-123';
      const name = manager.generateContainerName(taskId, { includeTimestamp: true });

      expect(name).toMatch(/^apex-task-123-[a-z0-9]+$/);
    });

    it('should exclude task ID when configured', () => {
      const taskId = 'task-123';
      const name = manager.generateContainerName(taskId, { includeTaskId: false });

      expect(name).toBe('apex');
    });

    it('should use custom prefix and separator', () => {
      const taskId = 'task-123';
      const name = manager.generateContainerName(taskId, {
        prefix: 'custom',
        separator: '_',
      });

      expect(name).toBe('custom_task-123');
    });
  });

  // ============================================================================
  // Container Creation Tests
  // ============================================================================

  describe('createContainer', () => {
    const basicConfig: ContainerConfig = {
      image: 'node:20-alpine',
      autoRemove: true,
    };

    const createOptions: CreateContainerOptions = {
      config: basicConfig,
      taskId: 'task-123',
      autoStart: false,
    };

    it('should create container successfully', async () => {
      const containerId = 'abc123';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer(createOptions);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe(containerId);
      expect(result.command).toContain('docker create');
      expect(result.command).toContain('--name apex-task-123');
      expect(result.command).toContain('node:20-alpine');
    });

    it('should handle container creation failure', async () => {
      const stderr = 'Error: Unable to find image';
      mockExec.mockImplementationOnce(mockExecCallback('', stderr));

      const result = await manager.createContainer(createOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container creation failed');
      expect(result.error).toContain(stderr);
    });

    it('should handle no container runtime available', async () => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('none');

      const result = await manager.createContainer(createOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No container runtime available');
    });

    it('should create container with volume mounts', async () => {
      const containerId = 'abc123';
      const configWithVolumes: ContainerConfig = {
        ...basicConfig,
        volumes: {
          '/host/path': '/container/path',
          '/another/host': '/another/container',
        },
      };

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        ...createOptions,
        config: configWithVolumes,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('-v /host/path:/container/path');
      expect(result.command).toContain('-v /another/host:/another/container');
    });

    it('should create container with environment variables', async () => {
      const containerId = 'abc123';
      const configWithEnv: ContainerConfig = {
        ...basicConfig,
        environment: {
          NODE_ENV: 'development',
          API_KEY: 'secret-key',
        },
      };

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        ...createOptions,
        config: configWithEnv,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('-e NODE_ENV=development');
      expect(result.command).toContain('-e API_KEY=secret-key');
    });

    it('should create container with resource limits', async () => {
      const containerId = 'abc123';
      const configWithLimits: ContainerConfig = {
        ...basicConfig,
        resourceLimits: {
          memory: '512m',
          cpu: 0.5,
          cpuShares: 1024,
        },
      };

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        ...createOptions,
        config: configWithLimits,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--memory 512m');
      expect(result.command).toContain('--cpus 0.5');
      expect(result.command).toContain('--cpu-shares 1024');
    });

    it('should create container with security options', async () => {
      const containerId = 'abc123';
      const configWithSecurity: ContainerConfig = {
        ...basicConfig,
        privileged: true,
        capAdd: ['SYS_ADMIN'],
        capDrop: ['NET_RAW'],
        securityOpts: ['apparmor=unconfined'],
      };

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        ...createOptions,
        config: configWithSecurity,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--privileged');
      expect(result.command).toContain('--cap-add SYS_ADMIN');
      expect(result.command).toContain('--cap-drop NET_RAW');
      expect(result.command).toContain('--security-opt apparmor=unconfined');
    });

    it('should auto-start container when requested', async () => {
      const containerId = 'abc123';

      // Mock container creation
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      // Mock container start
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      // Mock container info for both start and after start
      const inspectOutput = 'abc123|apex-task-123|node:20-alpine|running|2023-01-01T00:00:00Z|2023-01-01T00:00:01Z||0';
      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));
      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));

      const result = await manager.createContainer({
        ...createOptions,
        autoStart: true,
      });

      expect(result.success).toBe(true);
      expect(result.containerId).toBe(containerId);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('docker start'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should use custom container name when provided', async () => {
      const containerId = 'abc123';
      const customName = 'custom-container-name';

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        ...createOptions,
        nameOverride: customName,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain(`--name ${customName}`);
    });

    it('should escape shell arguments with special characters', async () => {
      const containerId = 'abc123';
      const configWithSpecialChars: ContainerConfig = {
        ...basicConfig,
        environment: {
          'COMPLEX_VAR': 'value with spaces & special chars',
        },
        workingDir: '/path with spaces',
      };

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        ...createOptions,
        config: configWithSpecialChars,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain("'COMPLEX_VAR=value with spaces & special chars'");
      expect(result.command).toContain("'/path with spaces'");
    });
  });

  // ============================================================================
  // Container Lifecycle Tests
  // ============================================================================

  describe('startContainer', () => {
    it('should start container successfully', async () => {
      const containerId = 'abc123';

      // Mock start command
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      // Mock inspect command
      const inspectOutput = 'abc123|apex-task-123|node:20-alpine|running|2023-01-01T00:00:00Z|2023-01-01T00:00:01Z||0';
      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));

      const result = await manager.startContainer(containerId);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe(containerId);
      expect(result.containerInfo?.status).toBe('running');
    });

    it('should handle container start failure', async () => {
      const containerId = 'abc123';
      const stderr = 'Error: Container is not created';

      mockExec.mockImplementationOnce(mockExecCallback('', stderr));

      const result = await manager.startContainer(containerId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container start failed');
      expect(result.error).toContain(stderr);
    });
  });

  describe('stopContainer', () => {
    it('should stop container successfully', async () => {
      const containerId = 'abc123';

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.stopContainer(containerId);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe(containerId);
      expect(result.command).toContain('docker stop --time 10');
    });

    it('should use custom timeout', async () => {
      const containerId = 'abc123';
      const timeout = 30;

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.stopContainer(containerId, 'docker', timeout);

      expect(result.success).toBe(true);
      expect(result.command).toContain(`docker stop --time ${timeout}`);
    });

    it('should handle container stop failure', async () => {
      const containerId = 'abc123';
      const stderr = 'Error: Container not found';

      mockExec.mockImplementationOnce(mockExecCallback('', stderr));

      const result = await manager.stopContainer(containerId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container stop failed');
    });
  });

  describe('removeContainer', () => {
    it('should remove container successfully', async () => {
      const containerId = 'abc123';

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.removeContainer(containerId);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe(containerId);
      expect(result.command).toContain('docker rm');
    });

    it('should force remove container when requested', async () => {
      const containerId = 'abc123';

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.removeContainer(containerId, 'docker', true);

      expect(result.success).toBe(true);
      expect(result.command).toContain('docker rm --force');
    });

    it('should handle container removal failure', async () => {
      const containerId = 'abc123';
      const stderr = 'Error: Container is running';

      mockExec.mockImplementationOnce(mockExecCallback('', stderr));

      const result = await manager.removeContainer(containerId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container removal failed');
    });
  });

  // ============================================================================
  // Container Information Tests
  // ============================================================================

  // ============================================================================
  // Container Inspection Tests
  // ============================================================================

  describe('inspect', () => {
    it('should return container info using inspect method', async () => {
      const containerId = 'abc123';
      const inspectOutput = 'abc123456|/apex-task-123|node:20-alpine|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>';

      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));

      const info = await manager.inspect(containerId);

      expect(info).not.toBeNull();
      expect(info!.id).toBe('abc123456');
      expect(info!.name).toBe('apex-task-123');
      expect(info!.status).toBe('running');
    });

    it('should return null for non-existent container in inspect', async () => {
      const containerId = 'nonexistent';

      mockExec.mockImplementationOnce(mockExecCallback('', '', new Error('No such container')));

      const info = await manager.inspect(containerId);

      expect(info).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should parse container stats correctly', async () => {
      const containerId = 'abc123';
      const statsOutput = 'CONTAINER|CPU %|MEM USAGE / LIMIT|MEM %|NET I/O|BLOCK I/O|PIDS\nabc123|25.50%|512MiB / 1GiB|50.00%|1.2kB / 800B|1.5MB / 900kB|42';

      mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

      const stats = await manager.getStats(containerId);

      expect(stats).not.toBeNull();
      expect(stats!.cpuPercent).toBe(25.5);
      expect(stats!.memoryUsage).toBe(512 * 1024 * 1024); // 512 MiB in bytes
      expect(stats!.memoryLimit).toBe(1024 * 1024 * 1024); // 1 GiB in bytes
      expect(stats!.memoryPercent).toBe(50.0);
      expect(stats!.networkRxBytes).toBe(1200); // 1.2kB in bytes
      expect(stats!.networkTxBytes).toBe(800); // 800B
      expect(stats!.blockReadBytes).toBe(1500000); // 1.5MB in bytes
      expect(stats!.blockWriteBytes).toBe(900000); // 900kB in bytes
      expect(stats!.pids).toBe(42);
    });

    it('should handle stats command failure', async () => {
      const containerId = 'abc123';

      mockExec.mockImplementationOnce(mockExecCallback('', '', new Error('Container not running')));

      const stats = await manager.getStats(containerId);

      expect(stats).toBeNull();
    });

    it('should handle malformed stats output', async () => {
      const containerId = 'abc123';
      const malformedOutput = 'incomplete-stats-data';

      mockExec.mockImplementationOnce(mockExecCallback(malformedOutput));

      const stats = await manager.getStats(containerId);

      expect(stats).toBeNull();
    });

    it('should parse different memory units correctly', async () => {
      const testCases = [
        { input: '512B / 1KiB', expectedUsage: 512, expectedLimit: 1024 },
        { input: '1.5MiB / 2GiB', expectedUsage: 1.5 * 1024 * 1024, expectedLimit: 2 * 1024 * 1024 * 1024 },
        { input: '2.5GB / 4TB', expectedUsage: 2.5 * 1000000000, expectedLimit: 4 * 1000000000000 },
      ];

      for (const testCase of testCases) {
        const statsOutput = `abc123|0%|${testCase.input}|0%|0B / 0B|0B / 0B|1`;

        mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

        const stats = await manager.getStats('abc123');
        expect(stats!.memoryUsage).toBe(testCase.expectedUsage);
        expect(stats!.memoryLimit).toBe(testCase.expectedLimit);

        vi.clearAllMocks();
      }
    });

    it('should handle stats with podman runtime', async () => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('podman');

      const containerId = 'abc123';
      const statsOutput = 'abc123|15.25%|256MiB / 512MiB|50.00%|2kB / 1kB|500kB / 200kB|24';

      mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

      const stats = await manager.getStats(containerId);

      expect(stats).not.toBeNull();
      expect(stats!.cpuPercent).toBe(15.25);
      expect(stats!.pids).toBe(24);

      // Verify command used podman
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('podman stats'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should return null when no runtime available for stats', async () => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('none');

      const stats = await manager.getStats('abc123');

      expect(stats).toBeNull();
    });
  });

  describe('getContainerInfo', () => {
    it('should parse container information correctly', async () => {
      const containerId = 'abc123';
      const inspectOutput = 'abc123456|/apex-task-123|node:20-alpine|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>';

      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));

      const info = await manager.getContainerInfo(containerId);

      expect(info).not.toBeNull();
      expect(info!.id).toBe('abc123456');
      expect(info!.name).toBe('apex-task-123');
      expect(info!.image).toBe('node:20-alpine');
      expect(info!.status).toBe('running');
      expect(info!.createdAt).toEqual(new Date('2023-01-01T10:00:00Z'));
      expect(info!.startedAt).toEqual(new Date('2023-01-01T10:00:01Z'));
      expect(info!.finishedAt).toBeUndefined();
      expect(info!.exitCode).toBeUndefined();
    });

    it('should handle container with exit code', async () => {
      const containerId = 'abc123';
      const inspectOutput = 'abc123|apex-task-123|node:20-alpine|exited|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|2023-01-01T10:05:00Z|0';

      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));

      const info = await manager.getContainerInfo(containerId);

      expect(info).not.toBeNull();
      expect(info!.status).toBe('exited');
      expect(info!.exitCode).toBe(0);
      expect(info!.finishedAt).toEqual(new Date('2023-01-01T10:05:00Z'));
    });

    it('should return null for non-existent container', async () => {
      const containerId = 'nonexistent';

      mockExec.mockImplementationOnce(mockExecCallback('', '', new Error('No such container')));

      const info = await manager.getContainerInfo(containerId);

      expect(info).toBeNull();
    });

    it('should parse different container statuses', async () => {
      const testCases = [
        { statusString: 'created', expected: 'created' },
        { statusString: 'running', expected: 'running' },
        { statusString: 'paused', expected: 'paused' },
        { statusString: 'restarting', expected: 'restarting' },
        { statusString: 'exited', expected: 'exited' },
        { statusString: 'dead', expected: 'dead' },
        { statusString: 'unknown-status', expected: 'exited' }, // fallback
      ];

      for (const testCase of testCases) {
        const inspectOutput = `abc123|test-container|node:20|${testCase.statusString}|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>`;

        mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));

        const info = await manager.getContainerInfo('abc123');
        expect(info!.status).toBe(testCase.expected);

        // Reset mocks for next iteration
        vi.clearAllMocks();
      }
    });
  });

  describe('listApexContainers', () => {
    it('should list APEX containers successfully', async () => {
      // Mock the ps command
      const psOutput = 'abc123|apex-task-123|node:20-alpine|running|2023-01-01T10:00:00Z\ndef456|apex-task-456|python:3.11|running|2023-01-01T10:05:00Z';
      mockExec.mockImplementationOnce(mockExecCallback(psOutput));

      // Mock inspect commands for each container
      const inspectOutput1 = 'abc123|apex-task-123|node:20-alpine|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>';
      const inspectOutput2 = 'def456|apex-task-456|python:3.11|running|2023-01-01T10:05:00Z|2023-01-01T10:05:01Z|<no value>|<no value>';

      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput1));
      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput2));

      const containers = await manager.listApexContainers();

      expect(containers).toHaveLength(2);
      expect(containers[0].name).toBe('apex-task-123');
      expect(containers[1].name).toBe('apex-task-456');
    });

    it('should return empty array when no containers found', async () => {
      mockExec.mockImplementationOnce(mockExecCallback(''));

      const containers = await manager.listApexContainers();

      expect(containers).toHaveLength(0);
    });

    it('should handle command failure gracefully', async () => {
      mockExec.mockImplementationOnce(mockExecCallback('', '', new Error('Command failed')));

      const containers = await manager.listApexContainers();

      expect(containers).toHaveLength(0);
    });
  });

  // ============================================================================
  // Podman Runtime Tests
  // ============================================================================

  describe('podman runtime support', () => {
    beforeEach(() => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('podman');
    });

    it('should create container with podman', async () => {
      const containerId = 'abc123';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId: 'task-123',
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('podman create');
    });

    it('should start container with podman', async () => {
      const containerId = 'abc123';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));
      mockExec.mockImplementationOnce(mockExecCallback('abc123|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>'));

      const result = await manager.startContainer(containerId);

      expect(result.success).toBe(true);
      expect(result.command).toContain('podman start');
    });

    it('should inspect container with podman', async () => {
      const containerId = 'abc123';
      const inspectOutput = 'abc123|apex-task-test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>';

      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));

      const result = await manager.inspect(containerId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('abc123');
      expect(result!.name).toBe('apex-task-test');
    });

    it('should get stats with podman', async () => {
      const containerId = 'abc123';
      const statsOutput = 'abc123|30.25%|128MiB / 256MiB|50.00%|500B / 300B|1MB / 500kB|20';

      mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

      const stats = await manager.getStats(containerId);

      expect(stats).not.toBeNull();
      expect(stats!.cpuPercent).toBe(30.25);
      expect(stats!.memoryUsage).toBe(128 * 1024 * 1024);
      expect(stats!.pids).toBe(20);
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('edge cases and error handling', () => {
    it('should handle command timeout', async () => {
      mockExec.mockImplementationOnce(() => {
        throw new Error('Command timed out');
      });

      const result = await manager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId: 'task-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container creation failed');
    });

    it('should handle malformed inspect output', async () => {
      const containerId = 'abc123';
      const malformedOutput = 'incomplete-data';

      mockExec.mockImplementationOnce(mockExecCallback(malformedOutput));

      const info = await manager.getContainerInfo(containerId);

      expect(info).toBeNull();
    });

    it('should handle empty container config', async () => {
      const containerId = 'abc123';
      const minimalConfig: ContainerConfig = {
        image: 'alpine',
      };

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        config: minimalConfig,
        taskId: 'task-123',
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('alpine');
    });
  });
});

// ============================================================================
// Convenience Function Tests
// ============================================================================

describe('convenience functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTaskContainer', () => {
    it('should create container with task configuration', async () => {
      const config: ContainerConfig = {
        image: 'node:20-alpine',
        autoRemove: true,
      };
      const taskId = 'task-123';

      // Mock getBestRuntime
      const mockRuntimeInstance = containerManager['runtime'];
      vi.spyOn(mockRuntimeInstance, 'getBestRuntime').mockResolvedValue('docker');

      // Mock container creation
      mockExec.mockImplementationOnce(mockExecCallback('abc123'));

      const result = await createTaskContainer(config, taskId, false);

      expect(result.success).toBe(true);
      expect(result.command).toContain('apex-task-123');
    });
  });

  describe('generateTaskContainerName', () => {
    it('should generate name using default manager', () => {
      const taskId = 'task-123';
      const name = generateTaskContainerName(taskId);

      expect(name).toBe('apex-task-123');
    });
  });
});

// ============================================================================
// Integration-like Tests
// ============================================================================

describe('container lifecycle integration', () => {
  let manager: ContainerManager;
  let mockRuntime: ContainerRuntime;

  beforeEach(() => {
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    manager = new ContainerManager(mockRuntime);
    vi.clearAllMocks();
  });

  it('should handle complete container lifecycle', async () => {
    const config: ContainerConfig = {
      image: 'node:20-alpine',
      autoRemove: false,
    };
    const taskId = 'integration-test';
    const containerId = 'abc123';

    // Mock create
    mockExec.mockImplementationOnce(mockExecCallback(containerId));

    // Mock start
    mockExec.mockImplementationOnce(mockExecCallback(containerId));
    mockExec.mockImplementationOnce(mockExecCallback(`${containerId}|apex-${taskId}|node:20-alpine|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>`));

    // Mock stop
    mockExec.mockImplementationOnce(mockExecCallback(containerId));

    // Mock remove
    mockExec.mockImplementationOnce(mockExecCallback(containerId));

    // Create container
    const createResult = await manager.createContainer({
      config,
      taskId,
      autoStart: false,
    });
    expect(createResult.success).toBe(true);

    // Start container
    const startResult = await manager.startContainer(containerId);
    expect(startResult.success).toBe(true);
    expect(startResult.containerInfo?.status).toBe('running');

    // Stop container
    const stopResult = await manager.stopContainer(containerId);
    expect(stopResult.success).toBe(true);

    // Remove container
    const removeResult = await manager.removeContainer(containerId);
    expect(removeResult.success).toBe(true);
  });

  it('should cleanup failed container creation with auto-start', async () => {
    const config: ContainerConfig = {
      image: 'node:20-alpine',
    };
    const taskId = 'cleanup-test';
    const containerId = 'abc123';

    // Mock successful create
    mockExec.mockImplementationOnce(mockExecCallback(containerId));

    // Mock failed start
    mockExec.mockImplementationOnce(mockExecCallback('', 'Container failed to start'));

    // Mock cleanup removal
    mockExec.mockImplementationOnce(mockExecCallback(containerId));

    const createResult = await manager.createContainer({
      config,
      taskId,
      autoStart: true,
    });

    expect(createResult.success).toBe(false);
    expect(createResult.error).toContain('Container start failed');

    // Verify cleanup was attempted
    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining('docker rm'),
      expect.any(Object),
      expect.any(Function)
    );
  });
});