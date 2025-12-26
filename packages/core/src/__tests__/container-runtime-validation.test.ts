import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContainerRuntime, containerRuntime } from '../container-runtime';
import { exec } from 'child_process';

// Mock the exec function
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

const mockExec = vi.mocked(exec);

describe('Container Runtime Detection and Validation', () => {
  let runtime: ContainerRuntime;

  beforeEach(() => {
    vi.clearAllMocks();
    runtime = new ContainerRuntime();
    runtime.clearCache(); // Ensure clean state for each test
  });

  describe('detectRuntimes', () => {
    it('should detect available Docker runtime', async () => {
      // Mock successful Docker version command
      const mockVersionCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker version 24.0.7, build afdd53b', stderr: '' });
      });
      const mockInfoCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker info output', stderr: '' });
      });

      mockExec
        .mockImplementationOnce(mockVersionCallback as any)
        .mockImplementationOnce(mockInfoCallback as any);

      const results = await runtime.detectRuntimes();
      const dockerResult = results.find(r => r.type === 'docker');

      expect(dockerResult).toBeDefined();
      expect(dockerResult?.available).toBe(true);
      expect(dockerResult?.versionInfo?.version).toBe('24.0.7');
      expect(dockerResult?.versionInfo?.buildInfo).toBe('afdd53b');
    });

    it('should detect available Podman runtime', async () => {
      // Mock Docker as unavailable
      const mockDockerVersionCallback = vi.fn((callback) => {
        callback(new Error('docker: command not found'));
      });
      const mockDockerInfoCallback = vi.fn((callback) => {
        callback(new Error('docker: command not found'));
      });

      // Mock successful Podman
      const mockPodmanVersionCallback = vi.fn((callback) => {
        callback(null, { stdout: 'podman version 4.7.2', stderr: '' });
      });
      const mockPodmanInfoCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Podman info output', stderr: '' });
      });

      mockExec
        .mockImplementationOnce(mockDockerVersionCallback as any)
        .mockImplementationOnce(mockDockerInfoCallback as any)
        .mockImplementationOnce(mockPodmanVersionCallback as any)
        .mockImplementationOnce(mockPodmanInfoCallback as any);

      const results = await runtime.detectRuntimes();
      const podmanResult = results.find(r => r.type === 'podman');
      const dockerResult = results.find(r => r.type === 'docker');

      expect(dockerResult?.available).toBe(false);
      expect(podmanResult?.available).toBe(true);
      expect(podmanResult?.versionInfo?.version).toBe('4.7.2');
    });

    it('should handle runtime that is installed but not functional', async () => {
      // Docker version succeeds but info fails (daemon not running)
      const mockVersionCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker version 24.0.7, build afdd53b', stderr: '' });
      });
      const mockInfoCallback = vi.fn((callback) => {
        callback(new Error('Cannot connect to the Docker daemon'));
      });

      mockExec
        .mockImplementationOnce(mockVersionCallback as any)
        .mockImplementationOnce(mockInfoCallback as any);

      const results = await runtime.detectRuntimes();
      const dockerResult = results.find(r => r.type === 'docker');

      expect(dockerResult?.available).toBe(false);
      expect(dockerResult?.versionInfo?.version).toBe('24.0.7');
      expect(dockerResult?.error).toContain('Docker is installed but not functional');
    });

    it('should handle stderr in version command', async () => {
      // Version command returns stderr
      const mockVersionCallback = vi.fn((callback) => {
        callback(null, { stdout: '', stderr: 'Permission denied' });
      });

      mockExec.mockImplementationOnce(mockVersionCallback as any);

      const results = await runtime.detectRuntimes();
      const dockerResult = results.find(r => r.type === 'docker');

      expect(dockerResult?.available).toBe(false);
      expect(dockerResult?.error).toBe('Permission denied');
    });

    it('should cache detection results', async () => {
      // First call
      const mockCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker version 24.0.7', stderr: '' });
      });
      const mockInfoCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker info', stderr: '' });
      });

      mockExec
        .mockImplementationOnce(mockCallback as any)
        .mockImplementationOnce(mockInfoCallback as any);

      const results1 = await runtime.detectRuntimes();

      // Second call should use cache (no additional exec calls)
      const results2 = await runtime.detectRuntimes();

      expect(results1).toEqual(results2);
      expect(mockExec).toHaveBeenCalledTimes(2); // Only called for first detection
    });

    it('should respect cache expiry', async () => {
      // Create runtime with very short cache expiry for testing
      const shortCacheRuntime = new ContainerRuntime();
      (shortCacheRuntime as any).cacheExpiry = 1; // 1ms

      const mockCallback1 = vi.fn((callback) => {
        callback(null, { stdout: 'Docker version 24.0.7', stderr: '' });
      });
      const mockInfoCallback1 = vi.fn((callback) => {
        callback(null, { stdout: 'Docker info', stderr: '' });
      });

      mockExec
        .mockImplementationOnce(mockCallback1 as any)
        .mockImplementationOnce(mockInfoCallback1 as any);

      await shortCacheRuntime.detectRuntimes();

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const mockCallback2 = vi.fn((callback) => {
        callback(null, { stdout: 'Docker version 24.0.8', stderr: '' });
      });
      const mockInfoCallback2 = vi.fn((callback) => {
        callback(null, { stdout: 'Docker info', stderr: '' });
      });

      mockExec
        .mockImplementationOnce(mockCallback2 as any)
        .mockImplementationOnce(mockInfoCallback2 as any);

      const results2 = await shortCacheRuntime.detectRuntimes();
      const dockerResult = results2.find(r => r.type === 'docker');

      expect(dockerResult?.versionInfo?.version).toBe('24.0.8');
      expect(mockExec).toHaveBeenCalledTimes(4); // Called twice for each detection
    });
  });

  describe('getBestRuntime', () => {
    it('should return preferred runtime when available', async () => {
      // Mock both runtimes available
      const mockDockerCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker version 24.0.7', stderr: '' });
      });
      const mockDockerInfoCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker info', stderr: '' });
      });
      const mockPodmanCallback = vi.fn((callback) => {
        callback(null, { stdout: 'podman version 4.7.2', stderr: '' });
      });
      const mockPodmanInfoCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Podman info', stderr: '' });
      });

      mockExec
        .mockImplementationOnce(mockDockerCallback as any)
        .mockImplementationOnce(mockDockerInfoCallback as any)
        .mockImplementationOnce(mockPodmanCallback as any)
        .mockImplementationOnce(mockPodmanInfoCallback as any);

      const bestRuntime = await runtime.getBestRuntime('podman');

      expect(bestRuntime).toBe('podman');
    });

    it('should return Docker as default when both available', async () => {
      // Mock both runtimes available
      const mockDockerCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker version 24.0.7', stderr: '' });
      });
      const mockDockerInfoCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker info', stderr: '' });
      });
      const mockPodmanCallback = vi.fn((callback) => {
        callback(null, { stdout: 'podman version 4.7.2', stderr: '' });
      });
      const mockPodmanInfoCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Podman info', stderr: '' });
      });

      mockExec
        .mockImplementationOnce(mockDockerCallback as any)
        .mockImplementationOnce(mockDockerInfoCallback as any)
        .mockImplementationOnce(mockPodmanCallback as any)
        .mockImplementationOnce(mockPodmanInfoCallback as any);

      const bestRuntime = await runtime.getBestRuntime();

      expect(bestRuntime).toBe('docker');
    });

    it('should return none when no runtime is available', async () => {
      const mockDockerCallback = vi.fn((callback) => {
        callback(new Error('docker: command not found'));
      });
      const mockPodmanCallback = vi.fn((callback) => {
        callback(new Error('podman: command not found'));
      });

      mockExec
        .mockImplementationOnce(mockDockerCallback as any)
        .mockImplementationOnce(mockPodmanCallback as any);

      const bestRuntime = await runtime.getBestRuntime();

      expect(bestRuntime).toBe('none');
    });

    it('should fallback when preferred runtime is unavailable', async () => {
      // Docker unavailable, Podman available
      const mockDockerCallback = vi.fn((callback) => {
        callback(new Error('docker: command not found'));
      });
      const mockPodmanCallback = vi.fn((callback) => {
        callback(null, { stdout: 'podman version 4.7.2', stderr: '' });
      });
      const mockPodmanInfoCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Podman info', stderr: '' });
      });

      mockExec
        .mockImplementationOnce(mockDockerCallback as any)
        .mockImplementationOnce(mockPodmanCallback as any)
        .mockImplementationOnce(mockPodmanInfoCallback as any);

      const bestRuntime = await runtime.getBestRuntime('docker');

      expect(bestRuntime).toBe('podman'); // Falls back to available runtime
    });
  });

  describe('validateCompatibility', () => {
    it('should validate version requirements correctly', async () => {
      // Mock Docker with specific version
      const mockCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker version 24.0.7', stderr: '' });
      });
      const mockInfoCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker info', stderr: '' });
      });

      mockExec
        .mockImplementationOnce(mockCallback as any)
        .mockImplementationOnce(mockInfoCallback as any);

      const compatibility = await runtime.validateCompatibility('docker', {
        minVersion: '20.0.0',
        maxVersion: '25.0.0',
      });

      expect(compatibility.compatible).toBe(true);
      expect(compatibility.versionCompatible).toBe(true);
      expect(compatibility.issues).toHaveLength(0);
    });

    it('should fail validation for version below minimum', async () => {
      const mockCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker version 19.0.0', stderr: '' });
      });
      const mockInfoCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker info', stderr: '' });
      });

      mockExec
        .mockImplementationOnce(mockCallback as any)
        .mockImplementationOnce(mockInfoCallback as any);

      const compatibility = await runtime.validateCompatibility('docker', {
        minVersion: '20.0.0',
      });

      expect(compatibility.compatible).toBe(false);
      expect(compatibility.versionCompatible).toBe(false);
      expect(compatibility.issues).toContain(
        'docker version 19.0.0 is below minimum required 20.0.0'
      );
      expect(compatibility.recommendations).toContain(
        'Upgrade docker to version 20.0.0 or higher'
      );
    });

    it('should fail validation for version above maximum', async () => {
      const mockCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker version 26.0.0', stderr: '' });
      });
      const mockInfoCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker info', stderr: '' });
      });

      mockExec
        .mockImplementationOnce(mockCallback as any)
        .mockImplementationOnce(mockInfoCallback as any);

      const compatibility = await runtime.validateCompatibility('docker', {
        maxVersion: '25.0.0',
      });

      expect(compatibility.compatible).toBe(false);
      expect(compatibility.versionCompatible).toBe(false);
      expect(compatibility.issues).toContain(
        'docker version 26.0.0 is above maximum supported 25.0.0'
      );
    });

    it('should handle runtime not available', async () => {
      const mockCallback = vi.fn((callback) => {
        callback(new Error('docker: command not found'));
      });

      mockExec.mockImplementationOnce(mockCallback as any);

      const compatibility = await runtime.validateCompatibility('docker', {
        minVersion: '20.0.0',
      });

      expect(compatibility.compatible).toBe(false);
      expect(compatibility.issues).toContain('docker is not available or not functional');
      expect(compatibility.recommendations).toContain('Install or fix docker installation');
    });

    it('should handle none runtime type', async () => {
      const compatibility = await runtime.validateCompatibility('none', {
        minVersion: '20.0.0',
      });

      expect(compatibility.compatible).toBe(false);
      expect(compatibility.issues).toContain('No container runtime specified');
      expect(compatibility.recommendations).toContain(
        'Install Docker or Podman to enable container functionality'
      );
    });
  });

  describe('version parsing', () => {
    it('should parse Docker version format correctly', async () => {
      const mockCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker version 24.0.7, build afdd53b', stderr: '' });
      });
      const mockInfoCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker info', stderr: '' });
      });

      mockExec
        .mockImplementationOnce(mockCallback as any)
        .mockImplementationOnce(mockInfoCallback as any);

      const results = await runtime.detectRuntimes();
      const dockerResult = results.find(r => r.type === 'docker');

      expect(dockerResult?.versionInfo?.version).toBe('24.0.7');
      expect(dockerResult?.versionInfo?.buildInfo).toBe('afdd53b');
    });

    it('should parse Podman version format correctly', async () => {
      const mockDockerCallback = vi.fn((callback) => {
        callback(new Error('docker: command not found'));
      });
      const mockPodmanCallback = vi.fn((callback) => {
        callback(null, { stdout: 'podman version 4.7.2', stderr: '' });
      });
      const mockPodmanInfoCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Podman info', stderr: '' });
      });

      mockExec
        .mockImplementationOnce(mockDockerCallback as any)
        .mockImplementationOnce(mockPodmanCallback as any)
        .mockImplementationOnce(mockPodmanInfoCallback as any);

      const results = await runtime.detectRuntimes();
      const podmanResult = results.find(r => r.type === 'podman');

      expect(podmanResult?.versionInfo?.version).toBe('4.7.2');
    });

    it('should handle unparseable version output', async () => {
      const mockCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Some unexpected output format', stderr: '' });
      });
      const mockInfoCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Info output', stderr: '' });
      });

      mockExec
        .mockImplementationOnce(mockCallback as any)
        .mockImplementationOnce(mockInfoCallback as any);

      const results = await runtime.detectRuntimes();
      const dockerResult = results.find(r => r.type === 'docker');

      expect(dockerResult?.versionInfo?.version).toBe('unknown');
      expect(dockerResult?.versionInfo?.fullVersion).toBe('Some unexpected output format');
    });

    it('should extract version from generic format as fallback', async () => {
      const mockCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Custom runtime version is 3.2.1 build info', stderr: '' });
      });
      const mockInfoCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Info output', stderr: '' });
      });

      mockExec
        .mockImplementationOnce(mockCallback as any)
        .mockImplementationOnce(mockInfoCallback as any);

      const results = await runtime.detectRuntimes();
      const dockerResult = results.find(r => r.type === 'docker');

      expect(dockerResult?.versionInfo?.version).toBe('3.2.1');
    });
  });

  describe('convenience functions', () => {
    it('should export convenience functions that work with singleton', async () => {
      const { detectContainerRuntime, isContainerRuntimeAvailable, getContainerRuntimeInfo } = await import('../container-runtime');

      const mockCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker version 24.0.7', stderr: '' });
      });
      const mockInfoCallback = vi.fn((callback) => {
        callback(null, { stdout: 'Docker info', stderr: '' });
      });

      mockExec
        .mockImplementationOnce(mockCallback as any)
        .mockImplementationOnce(mockInfoCallback as any)
        .mockImplementationOnce(mockCallback as any)
        .mockImplementationOnce(mockInfoCallback as any);

      const bestRuntime = await detectContainerRuntime();
      const isAvailable = await isContainerRuntimeAvailable('docker');
      const runtimeInfo = await getContainerRuntimeInfo('docker');

      expect(bestRuntime).toBe('docker');
      expect(isAvailable).toBe(true);
      expect(runtimeInfo?.version).toBe('24.0.7');
    });
  });

  describe('error handling', () => {
    it('should handle timeout errors gracefully', async () => {
      const timeoutError = new Error('Command timed out');
      timeoutError.name = 'ETIMEDOUT';

      const mockCallback = vi.fn((callback) => {
        callback(timeoutError);
      });

      mockExec.mockImplementationOnce(mockCallback as any);

      const results = await runtime.detectRuntimes();
      const dockerResult = results.find(r => r.type === 'docker');

      expect(dockerResult?.available).toBe(false);
      expect(dockerResult?.error).toContain('Command timed out');
    });

    it('should handle permission errors gracefully', async () => {
      const permissionError = new Error('Permission denied');
      permissionError.name = 'EACCES';

      const mockCallback = vi.fn((callback) => {
        callback(permissionError);
      });

      mockExec.mockImplementationOnce(mockCallback as any);

      const results = await runtime.detectRuntimes();
      const dockerResult = results.find(r => r.type === 'docker');

      expect(dockerResult?.available).toBe(false);
      expect(dockerResult?.error).toContain('Permission denied');
    });
  });
});