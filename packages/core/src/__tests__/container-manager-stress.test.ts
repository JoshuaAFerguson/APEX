import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import {
  ContainerManager,
  type ContainerOperationResult,
  type CreateContainerOptions,
} from '../container-manager';
import { ContainerRuntime } from '../container-runtime';
import { ContainerConfig } from '../types';

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

describe('ContainerManager Stress Tests', () => {
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
  // High-Volume Operations Testing
  // ============================================================================

  describe('high-volume operations', () => {
    it('should handle rapid container lifecycle operations', async () => {
      const containerCount = 50;
      const baseConfig: ContainerConfig = {
        image: 'node:20-alpine',
        autoRemove: false,
      };

      const operations: Promise<any>[] = [];

      // Create multiple containers rapidly
      for (let i = 0; i < containerCount; i++) {
        const containerId = `stress-test-${i}`;

        // Mock creation
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        // Mock start
        mockExec.mockImplementationOnce(mockExecCallback(containerId));
        mockExec.mockImplementationOnce(mockExecCallback(`${containerId}|apex-stress-${i}|node:20-alpine|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>`));

        // Mock stop
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        // Mock remove
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        operations.push(
          manager.createContainer({
            config: baseConfig,
            taskId: `stress-${i}`,
            autoStart: false,
          })
          .then(createResult => {
            if (!createResult.success) return createResult;
            return manager.startContainer(containerId);
          })
          .then(startResult => {
            if (!startResult.success) return startResult;
            return manager.stopContainer(containerId);
          })
          .then(stopResult => {
            if (!stopResult.success) return stopResult;
            return manager.removeContainer(containerId);
          })
        );
      }

      const results = await Promise.all(operations);

      // All operations should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle concurrent stats collection for many containers', async () => {
      const containerCount = 100;
      const operations: Promise<any>[] = [];

      for (let i = 0; i < containerCount; i++) {
        const containerId = `stats-test-${i}`;
        const cpuPercent = Math.random() * 100;
        const memoryUsage = Math.floor(Math.random() * 1024 * 1024 * 1024); // Random GB
        const pids = Math.floor(Math.random() * 100);

        const statsOutput = `${containerId}|${cpuPercent.toFixed(2)}%|${memoryUsage}B / ${memoryUsage * 2}B|50.00%|1kB / 800B|1MB / 500kB|${pids}`;
        mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

        operations.push(manager.getStats(containerId));
      }

      const results = await Promise.all(operations);

      // All stats should be collected successfully
      results.forEach(stats => {
        expect(stats).not.toBeNull();
        expect(typeof stats!.cpuPercent).toBe('number');
        expect(typeof stats!.memoryUsage).toBe('number');
        expect(typeof stats!.pids).toBe('number');
      });
    });

    it('should handle mixed success/failure scenarios under load', async () => {
      const operationCount = 200;
      const operations: Promise<any>[] = [];
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < operationCount; i++) {
        const containerId = `mixed-test-${i}`;
        const shouldSucceed = i % 3 !== 0; // 2/3 succeed, 1/3 fail

        if (shouldSucceed) {
          mockExec.mockImplementationOnce(mockExecCallback(containerId));
          mockExec.mockImplementationOnce(mockExecCallback(`${containerId}|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>`));
          successCount++;
        } else {
          mockExec.mockImplementationOnce(mockExecCallback('', 'Error: Container failed'));
          failureCount++;
        }

        operations.push(manager.startContainer(containerId));
      }

      const results = await Promise.all(operations);

      const actualSuccesses = results.filter(r => r.success).length;
      const actualFailures = results.filter(r => !r.success).length;

      expect(actualSuccesses).toBe(successCount);
      expect(actualFailures).toBe(failureCount);
    });
  });

  // ============================================================================
  // Complex Configuration Testing
  // ============================================================================

  describe('complex configurations', () => {
    it('should handle containers with maximum configuration complexity', async () => {
      const maxComplexConfig: ContainerConfig = {
        image: 'ubuntu:22.04',
        command: ['bash', '-c', 'while true; do echo "Complex container running"; sleep 10; done'],
        entrypoint: ['/bin/bash'],
        workingDir: '/app/workspace',
        user: '1000:1000',
        environment: {
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://user:password@localhost:5432/database',
          API_KEY: 'sk-1234567890abcdef',
          COMPLEX_VAR: 'value with spaces, special chars & symbols!@#$%',
          PATH_VAR: '/usr/local/bin:/usr/bin:/bin',
          JSON_CONFIG: '{"setting":{"nested":{"value":true,"array":[1,2,3]}}}',
        },
        volumes: {
          '/host/app': '/app',
          '/host/data': '/data',
          '/host/logs': '/logs',
          '/host/config': '/config',
          '/host/cache': '/tmp/cache',
        },
        resourceLimits: {
          memory: '2g',
          memoryReservation: '1g',
          memorySwap: '4g',
          cpu: 2.5,
          cpuShares: 2048,
          pidsLimit: 1000,
        },
        networkMode: 'bridge',
        privileged: false,
        autoRemove: false,
        capAdd: ['NET_ADMIN', 'SYS_ADMIN'],
        capDrop: ['NET_RAW', 'SYS_PTRACE'],
        securityOpts: ['apparmor=docker-default', 'no-new-privileges:true'],
        labels: {
          'apex.component': 'worker',
          'apex.version': '1.0.0',
          'apex.environment': 'production',
          'custom.label.with.dots': 'complex value',
          'kubernetes.io/managed-by': 'apex',
        },
      };

      const containerId = 'complex-config-test';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        config: maxComplexConfig,
        taskId: 'complex-test',
        autoStart: false,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('ubuntu:22.04');
      expect(result.command).toContain('--memory 2g');
      expect(result.command).toContain('--cpus 2.5');
      expect(result.command).toContain('--cap-add NET_ADMIN');
      expect(result.command).toContain('--security-opt apparmor=docker-default');
    });

    it('should handle containers with unicode and special characters', async () => {
      const unicodeConfig: ContainerConfig = {
        image: 'alpine:latest',
        environment: {
          UNICODE_VAR: '🐳 Docker container with émojis and açcénts',
          CHINESE_VAR: '你好世界',
          ARABIC_VAR: 'مرحبا بالعالم',
          SPECIAL_CHARS: '!@#$%^&*()_+-={}[]|\\:";\'<>?,./',
        },
        labels: {
          'unicode.label': '🏷️ Special label with émojis',
          'chinese.label': '标签',
          'arabic.label': 'بطاقة',
        },
      };

      const containerId = 'unicode-test';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        config: unicodeConfig,
        taskId: 'unicode-test',
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('alpine:latest');
    });

    it('should handle containers with maximum resource limits', async () => {
      const maxResourceConfig: ContainerConfig = {
        image: 'stress:latest',
        resourceLimits: {
          memory: '128g',
          cpu: 64,
          cpuShares: 1024000,
          pidsLimit: 4194304, // Maximum PIDs
        },
      };

      const containerId = 'max-resource-test';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        config: maxResourceConfig,
        taskId: 'max-resource',
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--memory 128g');
      expect(result.command).toContain('--cpus 64');
      expect(result.command).toContain('--pids-limit 4194304');
    });
  });

  // ============================================================================
  // Error Recovery and Resilience Testing
  // ============================================================================

  describe('error recovery and resilience', () => {
    it('should handle cascading failures gracefully', async () => {
      const containerCount = 10;
      const operations: Promise<any>[] = [];

      for (let i = 0; i < containerCount; i++) {
        const containerId = `cascade-test-${i}`;

        if (i < 5) {
          // First half succeed
          mockExec.mockImplementationOnce(mockExecCallback(containerId));
          mockExec.mockImplementationOnce(mockExecCallback(`${containerId}|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>`));
        } else {
          // Second half fail
          mockExec.mockImplementationOnce(mockExecCallback('', `Error: Cascading failure ${i}`));
        }

        operations.push(
          manager.createContainer({
            config: { image: 'node:20-alpine' },
            taskId: `cascade-${i}`,
            autoStart: true,
          })
        );
      }

      const results = await Promise.all(operations);

      // First half should succeed
      for (let i = 0; i < 5; i++) {
        expect(results[i].success).toBe(true);
      }

      // Second half should fail gracefully
      for (let i = 5; i < 10; i++) {
        expect(results[i].success).toBe(false);
        expect(results[i].error).toContain('Container creation failed');
      }
    });

    it('should handle runtime switching under stress', async () => {
      const operationCount = 50;
      const operations: Promise<any>[] = [];

      // Alternate between docker and podman
      for (let i = 0; i < operationCount; i++) {
        const runtime = i % 2 === 0 ? 'docker' : 'podman';
        vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce(runtime);

        const containerId = `runtime-switch-${i}`;
        mockExec.mockImplementationOnce(mockExecCallback(containerId));

        operations.push(
          manager.createContainer({
            config: { image: 'alpine' },
            taskId: `switch-${i}`,
          })
        );
      }

      const results = await Promise.all(operations);

      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        const expectedRuntime = index % 2 === 0 ? 'docker' : 'podman';
        expect(result.command).toContain(`${expectedRuntime} create`);
      });
    });

    it('should handle partial system failures', async () => {
      const containerIds = ['partial1', 'partial2', 'partial3'];

      // First operation succeeds completely
      mockExec.mockImplementationOnce(mockExecCallback('partial1'));
      mockExec.mockImplementationOnce(mockExecCallback('partial1'));
      mockExec.mockImplementationOnce(mockExecCallback('partial1|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>'));

      // Second operation: create succeeds, start fails
      mockExec.mockImplementationOnce(mockExecCallback('partial2'));
      mockExec.mockImplementationOnce(mockExecCallback('', 'Failed to start'));
      mockExec.mockImplementationOnce(mockExecCallback('partial2')); // Cleanup

      // Third operation: create fails
      mockExec.mockImplementationOnce(mockExecCallback('', 'Image not found'));

      const operations = containerIds.map(id =>
        manager.createContainer({
          config: { image: 'test-image' },
          taskId: id,
          autoStart: true,
        })
      );

      const results = await Promise.all(operations);

      expect(results[0].success).toBe(true); // Complete success
      expect(results[1].success).toBe(false); // Failed start, cleaned up
      expect(results[2].success).toBe(false); // Failed creation
    });
  });

  // ============================================================================
  // Memory and Resource Management Testing
  // ============================================================================

  describe('memory and resource management', () => {
    it('should handle large container names and IDs', async () => {
      const largeConfig: ContainerConfig = {
        image: 'alpine',
        labels: {},
        environment: {},
      };

      // Create large labels and environment
      for (let i = 0; i < 100; i++) {
        largeConfig.labels![`label-${i}`] = `value-${i}-${'x'.repeat(100)}`;
        largeConfig.environment![`ENV_${i}`] = `value-${i}-${'y'.repeat(100)}`;
      }

      const containerId = 'large-config-test-' + 'z'.repeat(100);
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        config: largeConfig,
        taskId: 'large-test',
      });

      expect(result.success).toBe(true);
      expect(result.containerId).toBe(containerId);
    });

    it('should handle containers with extensive volume mappings', async () => {
      const volumeConfig: ContainerConfig = {
        image: 'alpine',
        volumes: {},
      };

      // Create many volume mappings
      for (let i = 0; i < 50; i++) {
        volumeConfig.volumes![`/host/path/very/deep/directory/structure/${i}`] =
          `/container/path/very/deep/directory/structure/${i}`;
      }

      const containerId = 'volume-stress-test';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        config: volumeConfig,
        taskId: 'volume-stress',
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('-v');
    });

    it('should handle rapid-fire stats requests', async () => {
      const containerId = 'rapid-stats';
      const requestCount = 1000;

      // Mock many stats responses
      for (let i = 0; i < requestCount; i++) {
        const statsOutput = `${containerId}|${(Math.random() * 100).toFixed(2)}%|${Math.floor(Math.random() * 1024)}MiB / 1GiB|50%|1kB / 800B|1MB / 500kB|${Math.floor(Math.random() * 100)}`;
        mockExec.mockImplementationOnce(mockExecCallback(statsOutput));
      }

      const operations = Array(requestCount).fill(0).map(() => manager.getStats(containerId));
      const results = await Promise.all(operations);

      results.forEach(stats => {
        expect(stats).not.toBeNull();
        expect(typeof stats!.cpuPercent).toBe('number');
      });
    });
  });

  // ============================================================================
  // Boundary Condition Testing
  // ============================================================================

  describe('boundary conditions', () => {
    it('should handle minimum viable container configuration', async () => {
      const minimalConfig: ContainerConfig = {
        image: 'scratch', // Smallest possible image
      };

      const containerId = 'minimal-test';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        config: minimalConfig,
        taskId: 'minimal',
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('scratch');
    });

    it('should handle extremely long command arrays', async () => {
      const longCommandConfig: ContainerConfig = {
        image: 'alpine',
        command: Array(100).fill(0).map((_, i) => `arg-${i}-${'x'.repeat(10)}`),
      };

      const containerId = 'long-command-test';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        config: longCommandConfig,
        taskId: 'long-command',
      });

      expect(result.success).toBe(true);
    });

    it('should handle extreme timeout values in stop operations', async () => {
      const containerId = 'timeout-boundary';

      // Test minimum timeout (0)
      mockExec.mockImplementationOnce(mockExecCallback(containerId));
      const minResult = await manager.stopContainer(containerId, 'docker', 0);
      expect(minResult.success).toBe(true);

      // Test maximum reasonable timeout (1 hour = 3600 seconds)
      mockExec.mockImplementationOnce(mockExecCallback(containerId));
      const maxResult = await manager.stopContainer(containerId, 'docker', 3600);
      expect(maxResult.success).toBe(true);
      expect(maxResult.command).toContain('--time 3600');
    });

    it('should handle malformed stats data gracefully', async () => {
      const malformedInputs = [
        '', // Empty string
        'invalid-format', // No delimiters
        'a|b|c', // Too few fields
        'container|100%|invalid/memory|50%|network|block|pids|extra|fields', // Too many fields
        'container|not-percent|1GB / 2GB|50%|1kB / 2kB|1MB / 2MB|not-number', // Invalid data types
        'container|200%|1GB / 2GB|150%|1kB / 2kB|1MB / 2MB|999999999', // Out of range values
      ];

      for (const input of malformedInputs) {
        mockExec.mockImplementationOnce(mockExecCallback(input));

        const stats = await manager.getStats('malformed-test');

        // Should return null for malformed data or handle gracefully
        if (stats !== null) {
          expect(typeof stats.cpuPercent).toBe('number');
          expect(typeof stats.memoryUsage).toBe('number');
          expect(typeof stats.pids).toBe('number');
        }

        vi.clearAllMocks();
      }
    });
  });
});