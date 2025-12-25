import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import {
  ContainerManager,
  type ContainerOperationResult,
} from '../container-manager';
import { ContainerRuntime } from '../container-runtime';
import { ContainerConfig, ContainerStats, ContainerInfo } from '../types';

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

describe('ContainerManager Advanced Edge Cases', () => {
  let manager: ContainerManager;
  let mockRuntime: ContainerRuntime;

  beforeEach(() => {
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
  // Enhanced Container Lifecycle Edge Cases
  // ============================================================================

  describe('startContainer edge cases', () => {
    it('should handle container already running gracefully', async () => {
      const containerId = 'already-running';
      const stderr = 'Error: Container already running';

      mockExec.mockImplementationOnce(mockExecCallback('', stderr));

      const result = await manager.startContainer(containerId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container start failed');
      expect(result.error).toContain(stderr);
    });

    it('should handle very long container IDs', async () => {
      const longContainerId = 'a'.repeat(256); // Very long container ID

      mockExec.mockImplementationOnce(mockExecCallback(longContainerId));
      mockExec.mockImplementationOnce(mockExecCallback(`${longContainerId}|test-container|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>`));

      const result = await manager.startContainer(longContainerId);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe(longContainerId);
    });

    it('should handle Unicode characters in container names', async () => {
      const containerId = 'test-🐳-container';

      mockExec.mockImplementationOnce(mockExecCallback(containerId));
      mockExec.mockImplementationOnce(mockExecCallback(`${containerId}|test-🐳-container|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>`));

      const result = await manager.startContainer(containerId);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe(containerId);
    });

    it('should handle runtime switching during operation', async () => {
      const containerId = 'runtime-switch-test';

      // First call returns docker, second call returns podman
      vi.mocked(mockRuntime.getBestRuntime)
        .mockResolvedValueOnce('docker')
        .mockResolvedValueOnce('podman');

      mockExec.mockImplementationOnce(mockExecCallback(containerId));
      mockExec.mockImplementationOnce(mockExecCallback(`${containerId}|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>`));

      const result = await manager.startContainer(containerId);

      expect(result.success).toBe(true);
      expect(result.command).toContain('docker start');
    });
  });

  describe('stopContainer edge cases', () => {
    it('should handle extreme timeout values', async () => {
      const containerId = 'timeout-test';
      const extremeTimeout = 3600; // 1 hour

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.stopContainer(containerId, 'docker', extremeTimeout);

      expect(result.success).toBe(true);
      expect(result.command).toContain(`docker stop --time ${extremeTimeout}`);
    });

    it('should handle zero timeout gracefully', async () => {
      const containerId = 'zero-timeout-test';

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.stopContainer(containerId, 'docker', 0);

      expect(result.success).toBe(true);
      expect(result.command).toContain('docker stop --time 0');
    });

    it('should handle container not found during stop', async () => {
      const containerId = 'nonexistent-container';
      const stderr = 'Error: No such container: nonexistent-container';

      mockExec.mockImplementationOnce(mockExecCallback('', stderr));

      const result = await manager.stopContainer(containerId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container stop failed');
    });

    it('should handle container already stopped', async () => {
      const containerId = 'already-stopped';
      const stderr = 'Error: container already stopped';

      mockExec.mockImplementationOnce(mockExecCallback('', stderr));

      const result = await manager.stopContainer(containerId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container stop failed');
    });
  });

  describe('removeContainer edge cases', () => {
    it('should handle removal of running container with force', async () => {
      const containerId = 'running-container';

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.removeContainer(containerId, 'docker', true);

      expect(result.success).toBe(true);
      expect(result.command).toContain('docker rm --force');
    });

    it('should handle multiple container removal attempts', async () => {
      const containerId = 'removal-test';

      // First attempt fails, should not retry automatically
      const stderr = 'Error: Container is running';
      mockExec.mockImplementationOnce(mockExecCallback('', stderr));

      const result = await manager.removeContainer(containerId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container removal failed');
    });

    it('should handle container with complex name patterns', async () => {
      const complexContainerId = 'apex-task-test_123-v2.0.1';

      mockExec.mockImplementationOnce(mockExecCallback(complexContainerId));

      const result = await manager.removeContainer(complexContainerId);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe(complexContainerId);
    });
  });

  // ============================================================================
  // Enhanced Container Information Edge Cases
  // ============================================================================

  describe('inspect edge cases', () => {
    it('should handle partial inspect output', async () => {
      const containerId = 'partial-info';
      const partialOutput = 'abc123|test-container|node:20'; // Missing status and other fields

      mockExec.mockImplementationOnce(mockExecCallback(partialOutput));

      const info = await manager.inspect(containerId);

      expect(info).toBeNull(); // Should return null for malformed data
    });

    it('should handle inspect with special status values', async () => {
      const containerId = 'special-status';
      const statusVariations = [
        'Up 5 minutes', // Docker format variation
        'Exited (0) 2 hours ago', // Docker format variation
        'Created', // Simple status
      ];

      for (const status of statusVariations) {
        const inspectOutput = `abc123|test-container|node:20|${status}|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>`;

        mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));

        const info = await manager.inspect(containerId);

        expect(info).not.toBeNull();
        expect(info!.id).toBe('abc123');

        vi.clearAllMocks();
      }
    });

    it('should handle inspect with invalid date formats', async () => {
      const containerId = 'invalid-dates';
      const inspectOutput = 'abc123|test-container|node:20|running|invalid-date|2023-01-01T10:00:01Z|<no value>|<no value>';

      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));

      const info = await manager.inspect(containerId);

      expect(info).not.toBeNull();
      expect(info!.createdAt).toBeInstanceOf(Date);
      expect(info!.startedAt).toEqual(new Date('2023-01-01T10:00:01Z'));
    });

    it('should handle large container names', async () => {
      const containerId = 'large-name-test';
      const largeName = 'apex-' + 'a'.repeat(200); // Very long container name
      const inspectOutput = `abc123|${largeName}|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>`;

      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));

      const info = await manager.inspect(containerId);

      expect(info).not.toBeNull();
      expect(info!.name).toBe(largeName);
    });
  });

  describe('getStats edge cases', () => {
    it('should handle stats with zero values', async () => {
      const containerId = 'zero-stats';
      const statsOutput = 'abc123|0.00%|0B / 0B|0.00%|0B / 0B|0B / 0B|0';

      mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

      const stats = await manager.getStats(containerId);

      expect(stats).not.toBeNull();
      expect(stats!.cpuPercent).toBe(0);
      expect(stats!.memoryUsage).toBe(0);
      expect(stats!.memoryLimit).toBe(0);
      expect(stats!.pids).toBe(0);
    });

    it('should handle stats with extremely high values', async () => {
      const containerId = 'high-stats';
      const statsOutput = 'abc123|99.99%|64GiB / 128GiB|50.00%|1TB / 500GB|100GB / 50GB|65536';

      mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

      const stats = await manager.getStats(containerId);

      expect(stats).not.toBeNull();
      expect(stats!.cpuPercent).toBe(99.99);
      expect(stats!.memoryUsage).toBe(64 * 1024 * 1024 * 1024); // 64 GiB
      expect(stats!.pids).toBe(65536);
    });

    it('should handle malformed percentage values', async () => {
      const containerId = 'malformed-percent';
      const statsOutput = 'abc123|invalid%|512MiB / 1GiB|N/A%|1kB / 800B|1MB / 500kB|invalid';

      mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

      const stats = await manager.getStats(containerId);

      expect(stats).not.toBeNull();
      expect(stats!.cpuPercent).toBe(0); // Should default to 0 for invalid values
      expect(stats!.memoryPercent).toBe(0); // Should default to 0 for N/A
      expect(stats!.pids).toBe(0); // Should default to 0 for invalid values
    });

    it('should handle different memory unit formats', async () => {
      const testCases = [
        { input: '1000000000B / 2000000000B', expectedUsage: 1000000000, expectedLimit: 2000000000 }, // Bytes
        { input: '1.5GiB / 3.2TiB', expectedUsage: 1.5 * 1024 * 1024 * 1024, expectedLimit: 3.2 * 1024 * 1024 * 1024 * 1024 }, // Binary units
        { input: '2.5GB / 5TB', expectedUsage: 2.5 * 1000000000, expectedLimit: 5 * 1000000000000 }, // Decimal units
      ];

      for (const testCase of testCases) {
        const statsOutput = `abc123|50%|${testCase.input}|50%|1kB / 1kB|1MB / 1MB|10`;

        mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

        const stats = await manager.getStats('abc123');
        expect(stats!.memoryUsage).toBe(testCase.expectedUsage);
        expect(stats!.memoryLimit).toBe(testCase.expectedLimit);

        vi.clearAllMocks();
      }
    });

    it('should handle network I/O with unusual formats', async () => {
      const containerId = 'network-io-test';
      const statsOutput = 'abc123|25%|512MiB / 1GiB|50%|1.234kB / 0.987kB|2.5MB / 1.8MB|42';

      mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

      const stats = await manager.getStats(containerId);

      expect(stats).not.toBeNull();
      expect(stats!.networkRxBytes).toBe(1234); // 1.234kB
      expect(stats!.networkTxBytes).toBe(987); // 0.987kB
      expect(stats!.blockReadBytes).toBe(2500000); // 2.5MB
      expect(stats!.blockWriteBytes).toBe(1800000); // 1.8MB
    });

    it('should handle stats timeout gracefully', async () => {
      const containerId = 'timeout-stats';

      mockExec.mockImplementationOnce(() => {
        throw new Error('Command timed out');
      });

      const stats = await manager.getStats(containerId);

      expect(stats).toBeNull();
    });

    it('should handle stats with empty header handling', async () => {
      const containerId = 'header-test';
      const statsOutput = 'CONTAINER|CPU %|MEM USAGE / LIMIT|MEM %|NET I/O|BLOCK I/O|PIDS\nabc123|25%|512MiB / 1GiB|50%|1kB / 800B|1MB / 500kB|42\n';

      mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

      const stats = await manager.getStats(containerId);

      expect(stats).not.toBeNull();
      expect(stats!.cpuPercent).toBe(25);
      expect(stats!.pids).toBe(42);
    });
  });

  // ============================================================================
  // Concurrent Operations Testing
  // ============================================================================

  describe('concurrent operations', () => {
    it('should handle multiple simultaneous start operations', async () => {
      const containerIds = ['container1', 'container2', 'container3'];

      // Mock successful starts for all containers
      containerIds.forEach(id => {
        mockExec.mockImplementationOnce(mockExecCallback(id));
        mockExec.mockImplementationOnce(mockExecCallback(`${id}|${id}|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>`));
      });

      const promises = containerIds.map(id => manager.startContainer(id));
      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.containerId).toBe(containerIds[index]);
      });
    });

    it('should handle mixed success/failure concurrent operations', async () => {
      const containerIds = ['success-container', 'fail-container'];

      // Mock success for first, failure for second
      mockExec.mockImplementationOnce(mockExecCallback('success-container'));
      mockExec.mockImplementationOnce(mockExecCallback('success-container|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>'));

      mockExec.mockImplementationOnce(mockExecCallback('', 'Error: Container not found'));

      const promises = containerIds.map(id => manager.startContainer(id));
      const results = await Promise.all(promises);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });

    it('should handle concurrent stats collection', async () => {
      const containerIds = ['stats1', 'stats2'];

      containerIds.forEach(id => {
        const statsOutput = `${id}|25%|512MiB / 1GiB|50%|1kB / 800B|1MB / 500kB|42`;
        mockExec.mockImplementationOnce(mockExecCallback(statsOutput));
      });

      const promises = containerIds.map(id => manager.getStats(id));
      const results = await Promise.all(promises);

      results.forEach((stats, index) => {
        expect(stats).not.toBeNull();
        expect(stats!.cpuPercent).toBe(25);
      });
    });
  });

  // ============================================================================
  // Runtime Edge Cases
  // ============================================================================

  describe('runtime edge cases', () => {
    it('should handle runtime becoming unavailable during operation', async () => {
      const containerId = 'runtime-unavailable';

      // Runtime is available for start but becomes unavailable for inspect
      vi.mocked(mockRuntime.getBestRuntime)
        .mockResolvedValueOnce('docker')
        .mockResolvedValueOnce('none');

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.startContainer(containerId);

      expect(result.success).toBe(true);
      expect(result.containerInfo).toBeNull(); // Should handle gracefully
    });

    it('should handle runtime detection errors', async () => {
      const containerId = 'runtime-error';

      vi.mocked(mockRuntime.getBestRuntime).mockRejectedValue(new Error('Runtime detection failed'));

      const result = await manager.startContainer(containerId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container start failed');
    });

    it('should handle switching from specific runtime to auto-detection', async () => {
      const containerId = 'runtime-switch';

      mockExec.mockImplementationOnce(mockExecCallback(containerId));
      mockExec.mockImplementationOnce(mockExecCallback(`${containerId}|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>`));

      // First call with specific runtime, then auto-detect
      const result1 = await manager.startContainer(containerId, 'podman');
      expect(result1.command).toContain('podman start');

      const result2 = await manager.startContainer(containerId);
      expect(result2.command).toContain('docker start'); // Auto-detected
    });
  });

  // ============================================================================
  // Memory and Performance Edge Cases
  // ============================================================================

  describe('performance edge cases', () => {
    it('should handle very long command outputs', async () => {
      const containerId = 'long-output';
      const longOutput = 'a'.repeat(10000); // Very long output

      mockExec.mockImplementationOnce(mockExecCallback(longOutput));

      const result = await manager.startContainer(containerId);

      expect(result.success).toBe(true);
      expect(result.output).toBe(longOutput);
    });

    it('should handle rapid successive calls', async () => {
      const containerId = 'rapid-calls';

      // Setup mocks for multiple rapid calls
      for (let i = 0; i < 10; i++) {
        mockExec.mockImplementationOnce(mockExecCallback(containerId));
        mockExec.mockImplementationOnce(mockExecCallback(`${containerId}|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>`));
      }

      const promises = Array(10).fill(0).map(() => manager.startContainer(containerId));
      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle memory-intensive operations', async () => {
      const containerId = 'memory-test';
      const largeStatsOutput = `${containerId}|25%|${'5'.repeat(100)}GiB / ${'1'.repeat(100)}TiB|50%|1kB / 800B|1MB / 500kB|42`;

      mockExec.mockImplementationOnce(mockExecCallback(largeStatsOutput));

      const stats = await manager.getStats(containerId);

      // Should handle gracefully even with malformed large numbers
      expect(stats).not.toBeNull();
      expect(typeof stats!.memoryUsage).toBe('number');
    });
  });
});