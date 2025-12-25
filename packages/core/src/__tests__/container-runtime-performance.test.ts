import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import {
  ContainerRuntime,
  detectContainerRuntime,
  isContainerRuntimeAvailable,
  getContainerRuntimeInfo,
  containerRuntime
} from '../container-runtime';

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

const mockExec = vi.mocked(exec);

// Helper to create a mock exec callback
function mockExecCallback(stdout: string, stderr?: string, error?: Error) {
  return vi.fn((command: string, options: any, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
    if (callback) {
      setTimeout(() => callback(error || null, stdout, stderr || ''), 0);
    }
    return {} as any;
  });
}

describe('ContainerRuntime Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    containerRuntime.clearCache();
  });

  afterEach(() => {
    containerRuntime.clearCache();
  });

  describe('Performance and stress testing', () => {
    it('should handle many concurrent detection calls efficiently', async () => {
      // Mock Docker available
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7, build afdd53b'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      // Mock Podman not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      const startTime = Date.now();

      // Make 50 concurrent calls
      const promises = Array(50).fill(null).map(() => detectContainerRuntime());
      const results = await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All results should be the same
      results.forEach(result => {
        expect(result).toBe('docker');
      });

      // Should complete quickly due to caching (less than 1 second)
      expect(duration).toBeLessThan(1000);

      // Should only have made 3 exec calls total (cached after first detection)
      expect(mockExec).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed concurrent operations efficiently', async () => {
      // Mock Docker available
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7, build afdd53b'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      // Mock Podman available
      mockExec
        .mockImplementationOnce(mockExecCallback('podman version 4.7.2'))
        .mockImplementationOnce(mockExecCallback('Podman info'));

      const startTime = Date.now();

      // Mix of different operations
      const operations = [
        ...Array(20).fill(() => detectContainerRuntime()),
        ...Array(20).fill(() => isContainerRuntimeAvailable('docker')),
        ...Array(20).fill(() => isContainerRuntimeAvailable('podman')),
        ...Array(20).fill(() => getContainerRuntimeInfo('docker')),
        ...Array(20).fill(() => getContainerRuntimeInfo('podman')),
      ];

      const results = await Promise.all(operations.map(op => op()));

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly (less than 1 second)
      expect(duration).toBeLessThan(1000);

      // Should only have made 4 exec calls total (2 for docker, 2 for podman, cached after that)
      expect(mockExec).toHaveBeenCalledTimes(4);

      // Verify results are consistent
      const detectResults = results.slice(0, 20);
      detectResults.forEach(result => {
        expect(result).toBe('docker'); // Docker has priority
      });
    });

    it('should handle cache invalidation under high load', async () => {
      const runtime = new ContainerRuntime();

      // First batch of calls
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      const firstBatch = await Promise.all([
        runtime.detectRuntimes(),
        runtime.detectRuntimes(),
        runtime.detectRuntimes(),
      ]);

      expect(mockExec).toHaveBeenCalledTimes(3);

      // Clear cache and do second batch
      runtime.clearCache();

      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 25.0.0'))
        .mockImplementationOnce(mockExecCallback('Docker info'));
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      const secondBatch = await Promise.all([
        runtime.detectRuntimes(),
        runtime.detectRuntimes(),
        runtime.detectRuntimes(),
      ]);

      expect(mockExec).toHaveBeenCalledTimes(6);

      // Verify version changed
      const dockerResult = secondBatch[0].find(r => r.type === 'docker');
      expect(dockerResult?.versionInfo?.version).toBe('25.0.0');
    });

    it('should handle rapid cache clear and detect cycles', async () => {
      const runtime = new ContainerRuntime();

      for (let i = 0; i < 10; i++) {
        // Mock detection for this cycle
        mockExec
          .mockImplementationOnce(mockExecCallback(`Docker version 24.0.${i}`))
          .mockImplementationOnce(mockExecCallback('Docker info'));
        mockExec.mockImplementationOnce(
          mockExecCallback('', '', new Error("podman: command not found"))
        );

        await runtime.detectRuntimes();
        runtime.clearCache();
      }

      // Should have made 30 calls total (3 per cycle × 10 cycles)
      expect(mockExec).toHaveBeenCalledTimes(30);
    });

    it('should maintain performance with large version strings', async () => {
      const largeVersionString = 'Docker version 24.0.7, build ' + 'a'.repeat(10000);

      mockExec
        .mockImplementationOnce(mockExecCallback(largeVersionString))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      const startTime = Date.now();

      const runtimes = await containerRuntime.detectRuntimes();

      const endTime = Date.now();
      const duration = endTime - startTime;

      const dockerResult = runtimes.find(r => r.type === 'docker');

      expect(dockerResult?.available).toBe(true);
      expect(dockerResult?.versionInfo?.version).toBe('24.0.7');
      expect(dockerResult?.versionInfo?.fullVersion).toBe(largeVersionString);

      // Should still complete quickly (less than 500ms)
      expect(duration).toBeLessThan(500);
    });

    it('should handle compatibility validation performance', async () => {
      // Mock Docker available
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      const startTime = Date.now();

      // Run multiple compatibility validations concurrently
      const validations = Array(100).fill(null).map((_, i) =>
        containerRuntime.validateCompatibility('docker', {
          minVersion: `${20 + (i % 5)}.0.0`,
          maxVersion: `${25 + (i % 3)}.0.0`,
        })
      );

      const results = await Promise.all(validations);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly (less than 1 second)
      expect(duration).toBeLessThan(1000);

      // All validations should be processed
      expect(results).toHaveLength(100);

      // Should only have made 3 exec calls (detection is cached)
      expect(mockExec).toHaveBeenCalledTimes(3);
    });

    it('should handle memory efficiency with repeated operations', async () => {
      const runtime = new ContainerRuntime();

      // Mock once
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      // Perform many operations in sequence
      for (let i = 0; i < 1000; i++) {
        await runtime.getBestRuntime();
        await runtime.isRuntimeAvailable('docker');
        await runtime.getRuntimeInfo('docker');
      }

      // Should only have made initial detection calls due to caching
      expect(mockExec).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge case stress tests', () => {
    it('should handle rapid sequential cache clears', async () => {
      const runtime = new ContainerRuntime();

      // Clear cache many times rapidly
      for (let i = 0; i < 100; i++) {
        runtime.clearCache();
      }

      // Should still work normally after many cache clears
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      const result = await runtime.getBestRuntime();
      expect(result).toBe('docker');
    });

    it('should handle mixed success and failure scenarios under load', async () => {
      const runtime = new ContainerRuntime();

      // Alternate between success and failure
      for (let i = 0; i < 5; i++) {
        if (i % 2 === 0) {
          // Success scenario
          mockExec
            .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
            .mockImplementationOnce(mockExecCallback('Docker info'));
          mockExec.mockImplementationOnce(
            mockExecCallback('', '', new Error("podman: command not found"))
          );

          const result = await runtime.detectRuntimes();
          expect(result.find(r => r.type === 'docker')?.available).toBe(true);
        } else {
          // Failure scenario
          runtime.clearCache();
          mockExec
            .mockImplementationOnce(mockExecCallback('', '', new Error("docker: command not found")))
            .mockImplementationOnce(mockExecCallback('', '', new Error("podman: command not found")));

          const result = await runtime.detectRuntimes();
          expect(result.every(r => !r.available)).toBe(true);
        }

        runtime.clearCache();
      }
    });
  });
});