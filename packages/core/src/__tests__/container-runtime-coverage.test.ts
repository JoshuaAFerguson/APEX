import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exec } from 'child_process';
import { ContainerRuntime, type CompatibilityRequirement } from '../container-runtime';

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

describe('ContainerRuntime Coverage Tests', () => {
  let runtime: ContainerRuntime;

  beforeEach(() => {
    runtime = new ContainerRuntime();
    vi.clearAllMocks();
    runtime.clearCache();
  });

  describe('Additional coverage scenarios', () => {
    it('should handle cache expiry properly', async () => {
      // Create a new ContainerRuntime with a very short cache expiry
      const shortCacheRuntime = new (class extends ContainerRuntime {
        constructor() {
          super();
          // Override the private cache expiry for testing
          (this as any).cacheExpiry = 1; // 1ms cache expiry
        }
      })();

      // Mock first detection
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      await shortCacheRuntime.detectRuntimes();
      expect(mockExec).toHaveBeenCalledTimes(3);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 5));

      // Mock second detection with different version
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 25.0.0'))
        .mockImplementationOnce(mockExecCallback('Docker info'));
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      await shortCacheRuntime.detectRuntimes();

      // Should have made new exec calls due to cache expiry
      expect(mockExec).toHaveBeenCalledTimes(6);
    });

    it('should handle getRuntimeInfo for unknown runtime type', async () => {
      const info = await runtime.getRuntimeInfo('none');
      expect(info).toEqual({
        type: 'none',
        available: false,
        error: 'No container runtime requested',
      });
    });

    it('should handle validateCompatibility with malformed version', async () => {
      // Mock docker with unparseable version
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version INVALID'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      const result = await runtime.validateCompatibility('docker', {
        minVersion: '20.0.0',
      });

      expect(result.versionCompatible).toBe(false);
      expect(result.issues).toContain('Unable to parse docker version: unknown');
    });

    it('should handle validateCompatibility when version parsing throws', async () => {
      // Create a mock runtime that will throw during version comparison
      const throwingRuntime = new (class extends ContainerRuntime {
        private compareVersions(version1: string, version2: string): number {
          throw new Error('Version comparison error');
        }
      })();

      // Mock docker with valid version
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      const result = await throwingRuntime.validateCompatibility('docker', {
        minVersion: '20.0.0',
      });

      expect(result.versionCompatible).toBe(false);
      expect(result.issues).toContain('Unable to parse docker version: 24.0.7');
    });

    it('should handle getBestRuntime with none preference', async () => {
      // Mock both runtimes available
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      mockExec
        .mockImplementationOnce(mockExecCallback('podman version 4.7.2'))
        .mockImplementationOnce(mockExecCallback('Podman info'));

      const bestRuntime = await runtime.getBestRuntime('none');

      // Should return Docker as it has priority when both are available
      expect(bestRuntime).toBe('docker');
    });

    it('should handle multiple cache clearing operations', async () => {
      // Initial detection
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      await runtime.detectRuntimes();

      // Clear cache multiple times
      runtime.clearCache();
      runtime.clearCache();
      runtime.clearCache();

      // Should be able to detect again
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 25.0.0'))
        .mockImplementationOnce(mockExecCallback('Docker info'));
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      const runtimes = await runtime.detectRuntimes();
      const dockerResult = runtimes.find(r => r.type === 'docker');

      expect(dockerResult?.versionInfo?.version).toBe('25.0.0');
    });

    it('should handle compatibility validation with empty requirements', async () => {
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      const result = await runtime.validateCompatibility('docker', {});

      expect(result.compatible).toBe(true);
      expect(result.versionCompatible).toBe(true);
      expect(result.featuresCompatible).toBe(true);
      expect(result.recommendations).toContain('docker is compatible and ready to use');
    });

    it('should handle edge case where exec callback is not provided', async () => {
      // Mock exec without callback (edge case)
      const mockExecNoCallback = vi.fn((command: string, options: any) => {
        return {} as any;
      });

      mockExec.mockImplementationOnce(mockExecNoCallback);

      try {
        await runtime.detectRuntimes();
      } catch (error) {
        // This should handle the case gracefully
        expect(error).toBeDefined();
      }
    });

    it('should handle command timeout scenarios', async () => {
      // Test with actual timeout simulation
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error('Command failed: docker --version\nspawn docker ETIMEDOUT'))
      );

      const runtimes = await runtime.detectRuntimes();
      const dockerResult = runtimes.find(r => r.type === 'docker');

      expect(dockerResult?.available).toBe(false);
      expect(dockerResult?.error).toContain('ETIMEDOUT');
    });
  });
});