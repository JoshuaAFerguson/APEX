import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exec } from 'child_process';
import {
  containerRuntime,
  detectContainerRuntime,
  isContainerRuntimeAvailable,
  getContainerRuntimeInfo,
} from '../container-runtime';

// Mock child_process.exec for integration tests
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
    return {} as any; // Mock ChildProcess
  });
}

describe('ContainerRuntime Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    containerRuntime.clearCache();
  });

  afterEach(() => {
    containerRuntime.clearCache();
  });

  describe('Real-world scenarios', () => {
    it('should handle Docker available scenario', async () => {
      // Mock Docker available and functional
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7, build afdd53b'))
        .mockImplementationOnce(mockExecCallback('Containers: 5\nRunning: 2\nPaused: 0\nStopped: 3'));

      // Mock Podman not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      // Test the integration
      const bestRuntime = await detectContainerRuntime();
      expect(bestRuntime).toBe('docker');

      const isDockerAvailable = await isContainerRuntimeAvailable('docker');
      expect(isDockerAvailable).toBe(true);

      const isPodmanAvailable = await isContainerRuntimeAvailable('podman');
      expect(isPodmanAvailable).toBe(false);

      const dockerInfo = await getContainerRuntimeInfo('docker');
      expect(dockerInfo).toEqual({
        version: '24.0.7',
        fullVersion: 'Docker version 24.0.7, build afdd53b',
        buildInfo: 'afdd53b',
      });

      const podmanInfo = await getContainerRuntimeInfo('podman');
      expect(podmanInfo).toBeNull();

      // Test compatibility
      const compatibility = await containerRuntime.validateCompatibility('docker', {
        minVersion: '20.0.0',
        maxVersion: '30.0.0',
      });

      expect(compatibility.compatible).toBe(true);
      expect(compatibility.issues).toHaveLength(0);
    });

    it('should handle Podman only scenario', async () => {
      // Mock Docker not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("docker: command not found"))
      );

      // Mock Podman available and functional
      mockExec
        .mockImplementationOnce(mockExecCallback('podman version 4.7.2'))
        .mockImplementationOnce(mockExecCallback('host:\n  arch: amd64\n  buildahVersion: 1.32.2'));

      // Test the integration
      const bestRuntime = await detectContainerRuntime();
      expect(bestRuntime).toBe('podman');

      const isDockerAvailable = await isContainerRuntimeAvailable('docker');
      expect(isDockerAvailable).toBe(false);

      const isPodmanAvailable = await isContainerRuntimeAvailable('podman');
      expect(isPodmanAvailable).toBe(true);

      const podmanInfo = await getContainerRuntimeInfo('podman');
      expect(podmanInfo).toEqual({
        version: '4.7.2',
        fullVersion: 'podman version 4.7.2',
      });

      // Test compatibility with different requirements
      const compatibility = await containerRuntime.validateCompatibility('podman', {
        minVersion: '4.0.0',
        maxVersion: '5.0.0',
      });

      expect(compatibility.compatible).toBe(true);
    });

    it('should handle no container runtime scenario', async () => {
      // Mock both runtimes not available
      mockExec
        .mockImplementationOnce(mockExecCallback('', '', new Error("docker: command not found")))
        .mockImplementationOnce(mockExecCallback('', '', new Error("podman: command not found")));

      // Test the integration
      const bestRuntime = await detectContainerRuntime();
      expect(bestRuntime).toBe('none');

      const isDockerAvailable = await isContainerRuntimeAvailable('docker');
      expect(isDockerAvailable).toBe(false);

      const isPodmanAvailable = await isContainerRuntimeAvailable('podman');
      expect(isPodmanAvailable).toBe(false);

      const dockerInfo = await getContainerRuntimeInfo('docker');
      expect(dockerInfo).toBeNull();

      const podmanInfo = await getContainerRuntimeInfo('podman');
      expect(podmanInfo).toBeNull();

      // Test compatibility when no runtime is available
      const dockerCompatibility = await containerRuntime.validateCompatibility('docker', {
        minVersion: '20.0.0',
      });

      expect(dockerCompatibility.compatible).toBe(false);
      expect(dockerCompatibility.issues).toContain('docker is not available or not functional');

      // Test the 'none' runtime type
      const noneCompatibility = await containerRuntime.validateCompatibility('none', {});
      expect(noneCompatibility.compatible).toBe(false);
      expect(noneCompatibility.issues).toContain('No container runtime specified');
    });

    it('should handle runtime installed but not functional', async () => {
      // Mock Docker version succeeds but info fails (daemon not running)
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7, build afdd53b'))
        .mockImplementationOnce(mockExecCallback('', '', new Error('Cannot connect to the Docker daemon at unix:///var/run/docker.sock')));

      // Mock Podman not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      // Test the integration
      const bestRuntime = await detectContainerRuntime();
      expect(bestRuntime).toBe('none'); // Should be 'none' because Docker is not functional

      const isDockerAvailable = await isContainerRuntimeAvailable('docker');
      expect(isDockerAvailable).toBe(false);

      const dockerInfo = await getContainerRuntimeInfo('docker');
      expect(dockerInfo).toBeNull(); // No version info because runtime is not functional

      // Even though Docker has version info, it should be marked as unavailable
      const runtimeInfo = await containerRuntime.getRuntimeInfo('docker');
      expect(runtimeInfo?.available).toBe(false);
      expect(runtimeInfo?.error).toContain('Docker is installed but not functional');
    });

    it('should handle version compatibility edge cases', async () => {
      // Mock Docker with older version
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 19.03.12, build 48a66213'))
        .mockImplementationOnce(mockExecCallback('Docker info output'));

      // Mock Podman not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      containerRuntime.clearCache();

      // Test version too low
      const lowVersionCompat = await containerRuntime.validateCompatibility('docker', {
        minVersion: '20.0.0',
      });

      expect(lowVersionCompat.compatible).toBe(false);
      expect(lowVersionCompat.versionCompatible).toBe(false);
      expect(lowVersionCompat.issues).toContain('docker version 19.03.12 is below minimum required 20.0.0');
      expect(lowVersionCompat.recommendations).toContain('Upgrade docker to version 20.0.0 or higher');

      // Clear cache and mock higher version
      containerRuntime.clearCache();

      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 25.0.0'))
        .mockImplementationOnce(mockExecCallback('Docker info'));
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      // Test version too high
      const highVersionCompat = await containerRuntime.validateCompatibility('docker', {
        maxVersion: '24.0.0',
      });

      expect(highVersionCompat.compatible).toBe(false);
      expect(highVersionCompat.versionCompatible).toBe(false);
      expect(highVersionCompat.issues).toContain('docker version 25.0.0 is above maximum supported 24.0.0');
      expect(highVersionCompat.recommendations).toContain('Downgrade docker to version 24.0.0 or lower');
    });

    it('should prioritize preferred runtime when both are available', async () => {
      // Mock Docker available
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      // Mock Podman available
      mockExec
        .mockImplementationOnce(mockExecCallback('podman version 4.7.2'))
        .mockImplementationOnce(mockExecCallback('Podman info'));

      // Test default preference (should prefer Docker)
      const defaultRuntime = await detectContainerRuntime();
      expect(defaultRuntime).toBe('docker');

      // Test explicit Podman preference
      const preferredRuntime = await detectContainerRuntime('podman');
      expect(preferredRuntime).toBe('podman');

      // Verify both are actually available
      expect(await isContainerRuntimeAvailable('docker')).toBe(true);
      expect(await isContainerRuntimeAvailable('podman')).toBe(true);
    });

    it('should handle mixed state where one runtime is functional and other is not', async () => {
      // Mock Docker available and functional
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      // Mock Podman installed but not functional
      mockExec
        .mockImplementationOnce(mockExecCallback('podman version 4.7.2'))
        .mockImplementationOnce(mockExecCallback('', '', new Error('Error: could not get runtime')));

      const bestRuntime = await detectContainerRuntime();
      expect(bestRuntime).toBe('docker');

      expect(await isContainerRuntimeAvailable('docker')).toBe(true);
      expect(await isContainerRuntimeAvailable('podman')).toBe(false);

      const dockerInfo = await getContainerRuntimeInfo('docker');
      expect(dockerInfo?.version).toBe('24.0.7');

      const podmanInfo = await getContainerRuntimeInfo('podman');
      expect(podmanInfo).toBeNull(); // Should be null because runtime is not functional
    });

    it('should handle rapid successive calls with caching', async () => {
      // Mock Docker available
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      // Mock Podman not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      // Make multiple rapid calls
      const [result1, result2, result3] = await Promise.all([
        detectContainerRuntime(),
        isContainerRuntimeAvailable('docker'),
        getContainerRuntimeInfo('docker')
      ]);

      expect(result1).toBe('docker');
      expect(result2).toBe(true);
      expect(result3?.version).toBe('24.0.7');

      // Should only have been called 3 times total (cached after first detection)
      expect(mockExec).toHaveBeenCalledTimes(3);
    });
  });

  describe('Caching behavior', () => {
    it('should use cached results on subsequent calls', async () => {
      // First detection
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      const firstCall = await detectContainerRuntime();
      expect(firstCall).toBe('docker');

      // Second call should use cache (no additional exec calls)
      const secondCall = await detectContainerRuntime();
      expect(secondCall).toBe('docker');

      // Should have been called exactly 3 times (2 for docker, 1 for podman)
      expect(mockExec).toHaveBeenCalledTimes(3);

      // Third call should still use cache
      const thirdCall = await isContainerRuntimeAvailable('docker');
      expect(thirdCall).toBe(true);

      // Still 3 calls total
      expect(mockExec).toHaveBeenCalledTimes(3);
    });

    it('should re-detect after cache clear', async () => {
      // First detection
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      await detectContainerRuntime();
      expect(mockExec).toHaveBeenCalledTimes(3);

      // Clear cache
      containerRuntime.clearCache();

      // Mock different results
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 25.0.0'))
        .mockImplementationOnce(mockExecCallback('Docker info'));
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: command not found"))
      );

      const runtime = await detectContainerRuntime();
      expect(runtime).toBe('docker');

      // Should have been called 6 times total (3 first detection + 3 second detection)
      expect(mockExec).toHaveBeenCalledTimes(6);

      // Verify version changed
      const info = await getContainerRuntimeInfo('docker');
      expect(info?.version).toBe('25.0.0');
    });
  });
});

/**
 * This integration test verifies the complete workflow:
 * 1. Detection of available container runtimes
 * 2. Runtime selection based on availability and preference
 * 3. Version parsing and compatibility validation
 * 4. Caching behavior
 * 5. Error handling for various failure modes
 *
 * The tests use mocked child_process.exec calls to simulate different
 * system states without requiring actual Docker/Podman installations.
 */