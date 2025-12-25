import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import {
  ContainerRuntime,
  containerRuntime,
  detectContainerRuntime,
  isContainerRuntimeAvailable,
  getContainerRuntimeInfo,
  type ContainerRuntimeType,
  type RuntimeDetectionResult,
  type RuntimeVersionInfo,
  type CompatibilityRequirement,
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
    return {} as any; // Mock ChildProcess
  });
}

describe('ContainerRuntime', () => {
  let runtime: ContainerRuntime;

  beforeEach(() => {
    runtime = new ContainerRuntime();
    vi.clearAllMocks();
  });

  afterEach(() => {
    runtime.clearCache();
  });

  // ============================================================================
  // Docker Detection Tests
  // ============================================================================

  describe('Docker detection', () => {
    it('should detect Docker when available and functional', async () => {
      // Mock docker --version
      mockExec.mockImplementationOnce(
        mockExecCallback('Docker version 24.0.7, build afdd53b')
      );

      // Mock docker info
      mockExec.mockImplementationOnce(
        mockExecCallback('Containers: 0\nRunning: 0\nPaused: 0\nStopped: 0')
      );

      const runtimes = await runtime.detectRuntimes();
      const dockerResult = runtimes.find(r => r.type === 'docker');

      expect(dockerResult).toEqual({
        type: 'docker',
        available: true,
        versionInfo: {
          version: '24.0.7',
          fullVersion: 'Docker version 24.0.7, build afdd53b',
          buildInfo: 'afdd53b',
        },
        command: 'docker --version',
      });
    });

    it('should handle Docker installed but not functional', async () => {
      // Mock docker --version succeeds
      mockExec.mockImplementationOnce(
        mockExecCallback('Docker version 24.0.7, build afdd53b')
      );

      // Mock docker info fails
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error('Cannot connect to the Docker daemon'))
      );

      const runtimes = await runtime.detectRuntimes();
      const dockerResult = runtimes.find(r => r.type === 'docker');

      expect(dockerResult?.type).toBe('docker');
      expect(dockerResult?.available).toBe(false);
      expect(dockerResult?.error).toContain('Docker is installed but not functional');
      expect(dockerResult?.versionInfo?.version).toBe('24.0.7');
    });

    it('should handle Docker not installed', async () => {
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("docker: command not found"))
      );

      const runtimes = await runtime.detectRuntimes();
      const dockerResult = runtimes.find(r => r.type === 'docker');

      expect(dockerResult).toEqual({
        type: 'docker',
        available: false,
        error: 'docker is not installed',
        command: 'docker --version',
      });
    });

    it('should parse Docker version output correctly', async () => {
      const testCases = [
        {
          output: 'Docker version 24.0.7, build afdd53b',
          expected: { version: '24.0.7', buildInfo: 'afdd53b' },
        },
        {
          output: 'Docker version 25.0.0',
          expected: { version: '25.0.0', buildInfo: undefined },
        },
        {
          output: 'Docker version 20.10.21, build baeda1f',
          expected: { version: '20.10.21', buildInfo: 'baeda1f' },
        },
      ];

      for (const testCase of testCases) {
        mockExec
          .mockImplementationOnce(mockExecCallback(testCase.output))
          .mockImplementationOnce(mockExecCallback('Docker info output'));

        runtime.clearCache();
        const runtimes = await runtime.detectRuntimes();
        const dockerResult = runtimes.find(r => r.type === 'docker');

        expect(dockerResult?.versionInfo?.version).toBe(testCase.expected.version);
        expect(dockerResult?.versionInfo?.buildInfo).toBe(testCase.expected.buildInfo);
        expect(dockerResult?.versionInfo?.fullVersion).toBe(testCase.output);
      }
    });
  });

  // ============================================================================
  // Podman Detection Tests
  // ============================================================================

  describe('Podman detection', () => {
    it('should detect Podman when available and functional', async () => {
      // Mock docker not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("docker: command not found"))
      );

      // Mock podman --version
      mockExec.mockImplementationOnce(
        mockExecCallback('podman version 4.7.2')
      );

      // Mock podman info
      mockExec.mockImplementationOnce(
        mockExecCallback('host:\n  arch: amd64\n  buildahVersion: 1.32.2')
      );

      const runtimes = await runtime.detectRuntimes();
      const podmanResult = runtimes.find(r => r.type === 'podman');

      expect(podmanResult).toEqual({
        type: 'podman',
        available: true,
        versionInfo: {
          version: '4.7.2',
          fullVersion: 'podman version 4.7.2',
        },
        command: 'podman --version',
      });
    });

    it('should handle Podman installed but not functional', async () => {
      // Mock docker not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("docker: command not found"))
      );

      // Mock podman --version succeeds
      mockExec.mockImplementationOnce(
        mockExecCallback('podman version 4.7.2')
      );

      // Mock podman info fails
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error('Error: could not get runtime'))
      );

      const runtimes = await runtime.detectRuntimes();
      const podmanResult = runtimes.find(r => r.type === 'podman');

      expect(podmanResult?.type).toBe('podman');
      expect(podmanResult?.available).toBe(false);
      expect(podmanResult?.error).toContain('podman is installed but not functional');
      expect(podmanResult?.versionInfo?.version).toBe('4.7.2');
    });

    it('should handle Podman not installed', async () => {
      // Mock docker not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("docker: command not found"))
      );

      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: not found"))
      );

      const runtimes = await runtime.detectRuntimes();
      const podmanResult = runtimes.find(r => r.type === 'podman');

      expect(podmanResult).toEqual({
        type: 'podman',
        available: false,
        error: 'podman is not installed',
        command: 'podman --version',
      });
    });

    it('should parse Podman version output correctly', async () => {
      const testCases = [
        { output: 'podman version 4.7.2', expected: '4.7.2' },
        { output: 'podman version 4.0.0', expected: '4.0.0' },
        { output: 'Podman Version 3.4.7', expected: '3.4.7' },
      ];

      for (const testCase of testCases) {
        // Mock docker not available
        mockExec.mockImplementationOnce(
          mockExecCallback('', '', new Error("docker: command not found"))
        );

        mockExec
          .mockImplementationOnce(mockExecCallback(testCase.output))
          .mockImplementationOnce(mockExecCallback('Podman info output'));

        runtime.clearCache();
        const runtimes = await runtime.detectRuntimes();
        const podmanResult = runtimes.find(r => r.type === 'podman');

        expect(podmanResult?.versionInfo?.version).toBe(testCase.expected);
        expect(podmanResult?.versionInfo?.fullVersion).toBe(testCase.output);
      }
    });
  });

  // ============================================================================
  // Best Runtime Selection Tests
  // ============================================================================

  describe('getBestRuntime', () => {
    it('should return Docker when both Docker and Podman are available', async () => {
      // Mock docker available
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7, build afdd53b'))
        .mockImplementationOnce(mockExecCallback('Docker info output'));

      // Mock podman available
      mockExec
        .mockImplementationOnce(mockExecCallback('podman version 4.7.2'))
        .mockImplementationOnce(mockExecCallback('Podman info output'));

      const bestRuntime = await runtime.getBestRuntime();
      expect(bestRuntime).toBe('docker');
    });

    it('should return Podman when only Podman is available', async () => {
      // Mock docker not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("docker: command not found"))
      );

      // Mock podman available
      mockExec
        .mockImplementationOnce(mockExecCallback('podman version 4.7.2'))
        .mockImplementationOnce(mockExecCallback('Podman info output'));

      const bestRuntime = await runtime.getBestRuntime();
      expect(bestRuntime).toBe('podman');
    });

    it('should return "none" when no runtimes are available', async () => {
      // Mock docker not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("docker: command not found"))
      );

      // Mock podman not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: not found"))
      );

      const bestRuntime = await runtime.getBestRuntime();
      expect(bestRuntime).toBe('none');
    });

    it('should respect preferred runtime when available', async () => {
      // Mock docker available
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      // Mock podman available
      mockExec
        .mockImplementationOnce(mockExecCallback('podman version 4.7.2'))
        .mockImplementationOnce(mockExecCallback('Podman info'));

      const bestRuntime = await runtime.getBestRuntime('podman');
      expect(bestRuntime).toBe('podman');
    });

    it('should fallback to best available when preferred is not available', async () => {
      // Mock docker available
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      // Mock podman not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: not found"))
      );

      const bestRuntime = await runtime.getBestRuntime('podman');
      expect(bestRuntime).toBe('docker');
    });
  });

  // ============================================================================
  // Runtime Information Tests
  // ============================================================================

  describe('getRuntimeInfo', () => {
    it('should return correct info for available runtime', async () => {
      // Mock docker available
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7, build afdd53b'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      // Mock podman not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: not found"))
      );

      const dockerInfo = await runtime.getRuntimeInfo('docker');
      expect(dockerInfo?.type).toBe('docker');
      expect(dockerInfo?.available).toBe(true);
      expect(dockerInfo?.versionInfo?.version).toBe('24.0.7');
    });

    it('should return null for unavailable runtime', async () => {
      // Mock both runtimes not available
      mockExec
        .mockImplementationOnce(mockExecCallback('', '', new Error("docker: command not found")))
        .mockImplementationOnce(mockExecCallback('', '', new Error("podman: not found")));

      const dockerInfo = await runtime.getRuntimeInfo('docker');
      expect(dockerInfo?.available).toBe(false);
    });

    it('should handle "none" runtime type', async () => {
      const noneInfo = await runtime.getRuntimeInfo('none');
      expect(noneInfo).toEqual({
        type: 'none',
        available: false,
        error: 'No container runtime requested',
      });
    });
  });

  describe('isRuntimeAvailable', () => {
    it('should return true for available runtime', async () => {
      // Mock docker available
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      // Mock podman not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: not found"))
      );

      expect(await runtime.isRuntimeAvailable('docker')).toBe(true);
      expect(await runtime.isRuntimeAvailable('podman')).toBe(false);
      expect(await runtime.isRuntimeAvailable('none')).toBe(false);
    });
  });

  // ============================================================================
  // Compatibility Validation Tests
  // ============================================================================

  describe('validateCompatibility', () => {
    beforeEach(() => {
      // Mock docker available with version 24.0.7
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7, build afdd53b'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      // Mock podman not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: not found"))
      );
    });

    it('should validate compatible runtime', async () => {
      const requirements: CompatibilityRequirement = {
        minVersion: '20.0.0',
        maxVersion: '30.0.0',
      };

      const result = await runtime.validateCompatibility('docker', requirements);

      expect(result.compatible).toBe(true);
      expect(result.versionCompatible).toBe(true);
      expect(result.featuresCompatible).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.recommendations).toContain('docker is compatible and ready to use');
    });

    it('should detect version too low', async () => {
      const requirements: CompatibilityRequirement = {
        minVersion: '25.0.0',
      };

      const result = await runtime.validateCompatibility('docker', requirements);

      expect(result.compatible).toBe(false);
      expect(result.versionCompatible).toBe(false);
      expect(result.issues).toContain(
        'docker version 24.0.7 is below minimum required 25.0.0'
      );
      expect(result.recommendations).toContain(
        'Upgrade docker to version 25.0.0 or higher'
      );
    });

    it('should detect version too high', async () => {
      const requirements: CompatibilityRequirement = {
        maxVersion: '23.0.0',
      };

      const result = await runtime.validateCompatibility('docker', requirements);

      expect(result.compatible).toBe(false);
      expect(result.versionCompatible).toBe(false);
      expect(result.issues).toContain(
        'docker version 24.0.7 is above maximum supported 23.0.0'
      );
      expect(result.recommendations).toContain(
        'Downgrade docker to version 23.0.0 or lower'
      );
    });

    it('should handle unavailable runtime', async () => {
      const requirements: CompatibilityRequirement = {
        minVersion: '4.0.0',
      };

      // Clear cache to force re-detection
      runtime.clearCache();

      const result = await runtime.validateCompatibility('podman', requirements);

      expect(result.compatible).toBe(false);
      expect(result.issues).toContain('podman is not available or not functional');
      expect(result.recommendations).toContain('Install or fix podman installation');
    });

    it('should handle "none" runtime type', async () => {
      const requirements: CompatibilityRequirement = {};

      const result = await runtime.validateCompatibility('none', requirements);

      expect(result.compatible).toBe(false);
      expect(result.issues).toContain('No container runtime specified');
      expect(result.recommendations).toContain(
        'Install Docker or Podman to enable container functionality'
      );
    });

    it('should handle required features', async () => {
      const requirements: CompatibilityRequirement = {
        minVersion: '20.0.0',
        requiredFeatures: ['buildkit', 'compose'],
      };

      const result = await runtime.validateCompatibility('docker', requirements);

      // Currently features compatibility is optimistically set to true
      expect(result.featuresCompatible).toBe(true);
      expect(result.compatible).toBe(true);
    });
  });

  // ============================================================================
  // Caching Tests
  // ============================================================================

  describe('caching', () => {
    it('should cache detection results', async () => {
      // Mock docker available
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      // Mock podman not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: not found"))
      );

      // First call
      const firstCall = await runtime.detectRuntimes();

      // Second call (should use cache, no additional exec calls)
      const secondCall = await runtime.detectRuntimes();

      expect(firstCall).toEqual(secondCall);
      expect(mockExec).toHaveBeenCalledTimes(3); // 2 for docker, 1 for podman
    });

    it('should clear cache when requested', async () => {
      // Mock docker available
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      // Mock podman not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: not found"))
      );

      await runtime.detectRuntimes();

      runtime.clearCache();

      // Mock again for second detection
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 25.0.0'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: not found"))
      );

      const secondCall = await runtime.detectRuntimes();
      const dockerResult = secondCall.find(r => r.type === 'docker');

      expect(dockerResult?.versionInfo?.version).toBe('25.0.0');
      expect(mockExec).toHaveBeenCalledTimes(6); // 3 calls for first detection + 3 for second
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should handle timeout errors', async () => {
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error('timeout'))
      );

      const runtimes = await runtime.detectRuntimes();
      const dockerResult = runtimes.find(r => r.type === 'docker');

      expect(dockerResult?.available).toBe(false);
      expect(dockerResult?.error).toContain('timeout');
    });

    it('should handle permission errors', async () => {
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error('permission denied'))
      );

      const runtimes = await runtime.detectRuntimes();
      const dockerResult = runtimes.find(r => r.type === 'docker');

      expect(dockerResult?.available).toBe(false);
      expect(dockerResult?.error).toContain('permission denied');
    });

    it('should handle malformed version output', async () => {
      mockExec
        .mockImplementationOnce(mockExecCallback('Some random output without version'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      const runtimes = await runtime.detectRuntimes();
      const dockerResult = runtimes.find(r => r.type === 'docker');

      expect(dockerResult?.available).toBe(true);
      expect(dockerResult?.versionInfo?.version).toBe('unknown');
      expect(dockerResult?.versionInfo?.fullVersion).toBe('Some random output without version');
    });

    it('should handle stderr output on version command', async () => {
      mockExec.mockImplementationOnce(
        mockExecCallback('', 'Warning: some warning message')
      );

      const runtimes = await runtime.detectRuntimes();
      const dockerResult = runtimes.find(r => r.type === 'docker');

      expect(dockerResult?.available).toBe(false);
      expect(dockerResult?.error).toContain('Warning: some warning message');
    });

    it('should handle empty string errors gracefully', async () => {
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error(''))
      );

      const runtimes = await runtime.detectRuntimes();
      const dockerResult = runtimes.find(r => r.type === 'docker');

      expect(dockerResult?.available).toBe(false);
      expect(dockerResult?.error).toBeDefined();
    });

    it('should handle null/undefined error objects', async () => {
      const mockCallback = vi.fn((command: string, options: any, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
        if (callback) {
          setTimeout(() => callback(null as any, '', ''), 0);
        }
        return {} as any;
      });

      mockExec.mockImplementationOnce(mockCallback);

      const runtimes = await runtime.detectRuntimes();
      const dockerResult = runtimes.find(r => r.type === 'docker');

      expect(dockerResult?.available).toBe(false);
    });

    it('should handle very long output gracefully', async () => {
      const longOutput = 'Docker version 24.0.7'.repeat(1000);

      mockExec
        .mockImplementationOnce(mockExecCallback(longOutput))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      const runtimes = await runtime.detectRuntimes();
      const dockerResult = runtimes.find(r => r.type === 'docker');

      expect(dockerResult?.available).toBe(true);
      expect(dockerResult?.versionInfo?.version).toBe('24.0.7');
      expect(dockerResult?.versionInfo?.fullVersion).toBe(longOutput);
    });
  });

  // ============================================================================
  // Version Comparison Tests
  // ============================================================================

  describe('version comparison', () => {
    it('should compare versions correctly', async () => {
      // Test version comparison through compatibility validation
      const testCases = [
        { version: '24.0.7', minVersion: '24.0.0', shouldPass: true },
        { version: '24.0.7', minVersion: '24.0.8', shouldPass: false },
        { version: '24.1.0', minVersion: '24.0.9', shouldPass: true },
        { version: '25.0.0', maxVersion: '24.9.9', shouldPass: false },
        { version: '23.0.5', maxVersion: '24.0.0', shouldPass: true },
      ];

      for (const testCase of testCases) {
        // Mock docker with specific version
        mockExec
          .mockImplementationOnce(mockExecCallback(`Docker version ${testCase.version}`))
          .mockImplementationOnce(mockExecCallback('Docker info'));

        // Mock podman not available
        mockExec.mockImplementationOnce(
          mockExecCallback('', '', new Error("podman: not found"))
        );

        runtime.clearCache();

        const requirements: CompatibilityRequirement = {
          minVersion: testCase.minVersion,
          maxVersion: testCase.maxVersion,
        };

        const result = await runtime.validateCompatibility('docker', requirements);

        expect(result.versionCompatible).toBe(testCase.shouldPass);
      }
    });

    it('should handle version parsing edge cases', async () => {
      const versionTestCases = [
        { output: 'Docker version 24.0.7-rc.1, build abc123', expected: '24.0.7' },
        { output: 'Docker version 25.0.0+git.abc123', expected: '25.0.0' },
        { output: 'podman version 4.7.2-dev', expected: '4.7.2' },
        { output: 'Version: 23.0.1', expected: '23.0.1' },
        { output: 'docker 20.10.21', expected: '20.10.21' },
        { output: 'No version info available', expected: 'unknown' },
        { output: '', expected: 'unknown' },
        { output: 'v24.0.7', expected: '24.0.7' },
      ];

      for (const testCase of versionTestCases) {
        mockExec
          .mockImplementationOnce(mockExecCallback(testCase.output))
          .mockImplementationOnce(mockExecCallback('Docker info'));

        // Mock podman not available
        mockExec.mockImplementationOnce(
          mockExecCallback('', '', new Error("podman: not found"))
        );

        runtime.clearCache();
        const runtimes = await runtime.detectRuntimes();
        const dockerResult = runtimes.find(r => r.type === 'docker');

        expect(dockerResult?.versionInfo?.version).toBe(testCase.expected);
        expect(dockerResult?.versionInfo?.fullVersion).toBe(testCase.output);
      }
    });

    it('should handle complex version comparison scenarios', async () => {
      const complexTestCases = [
        { version: '1.0.0', minVersion: '1.0.0', maxVersion: '1.0.0', shouldPass: true },
        { version: '1.0.0', minVersion: '1.0.1', shouldPass: false },
        { version: '1.0.1', minVersion: '1.0.0', maxVersion: '1.0.0', shouldPass: false },
        { version: '2.0', minVersion: '1.9.9', shouldPass: true },
        { version: '1.9.9', minVersion: '2.0', shouldPass: false },
        { version: '10.0.0', minVersion: '2.0.0', shouldPass: true },
      ];

      for (const testCase of complexTestCases) {
        mockExec
          .mockImplementationOnce(mockExecCallback(`Docker version ${testCase.version}`))
          .mockImplementationOnce(mockExecCallback('Docker info'));

        mockExec.mockImplementationOnce(
          mockExecCallback('', '', new Error("podman: not found"))
        );

        runtime.clearCache();

        const requirements: CompatibilityRequirement = {
          minVersion: testCase.minVersion,
          maxVersion: testCase.maxVersion,
        };

        const result = await runtime.validateCompatibility('docker', requirements);
        expect(result.versionCompatible).toBe(testCase.shouldPass);
      }
    });
  });
});

// ============================================================================
// Convenience Function Tests
// ============================================================================

describe('convenience functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    containerRuntime.clearCache();
  });

  describe('detectContainerRuntime', () => {
    it('should return best available runtime', async () => {
      // Mock docker available
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      // Mock podman not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: not found"))
      );

      const runtime = await detectContainerRuntime();
      expect(runtime).toBe('docker');
    });

    it('should respect preferred runtime', async () => {
      // Mock docker available
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      // Mock podman available
      mockExec
        .mockImplementationOnce(mockExecCallback('podman version 4.7.2'))
        .mockImplementationOnce(mockExecCallback('Podman info'));

      const runtime = await detectContainerRuntime('podman');
      expect(runtime).toBe('podman');
    });
  });

  describe('isContainerRuntimeAvailable', () => {
    it('should check runtime availability', async () => {
      // Mock docker available
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      // Mock podman not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: not found"))
      );

      expect(await isContainerRuntimeAvailable('docker')).toBe(true);
      expect(await isContainerRuntimeAvailable('podman')).toBe(false);
    });
  });

  describe('getContainerRuntimeInfo', () => {
    it('should return version info for available runtime', async () => {
      // Mock docker available
      mockExec
        .mockImplementationOnce(mockExecCallback('Docker version 24.0.7, build afdd53b'))
        .mockImplementationOnce(mockExecCallback('Docker info'));

      // Mock podman not available
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error("podman: not found"))
      );

      const info = await getContainerRuntimeInfo('docker');
      expect(info).toEqual({
        version: '24.0.7',
        fullVersion: 'Docker version 24.0.7, build afdd53b',
        buildInfo: 'afdd53b',
      });
    });

    it('should return null for unavailable runtime', async () => {
      // Mock both runtimes not available
      mockExec
        .mockImplementationOnce(mockExecCallback('', '', new Error("docker: command not found")))
        .mockImplementationOnce(mockExecCallback('', '', new Error("podman: not found")));

      const info = await getContainerRuntimeInfo('docker');
      expect(info).toBeNull();
    });
  });
});

// ============================================================================
// Integration-style Tests
// ============================================================================

describe('integration scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    containerRuntime.clearCache();
  });

  it('should handle scenario where Docker is preferred but Podman is only available', async () => {
    // Mock docker not available
    mockExec.mockImplementationOnce(
      mockExecCallback('', '', new Error("docker: command not found"))
    );

    // Mock podman available
    mockExec
      .mockImplementationOnce(mockExecCallback('podman version 4.7.2'))
      .mockImplementationOnce(mockExecCallback('Podman info'));

    const bestRuntime = await detectContainerRuntime('docker');
    expect(bestRuntime).toBe('podman');

    const available = await isContainerRuntimeAvailable('podman');
    expect(available).toBe(true);

    const info = await getContainerRuntimeInfo('podman');
    expect(info?.version).toBe('4.7.2');
  });

  it('should handle scenario where both runtimes are available but one fails compatibility', async () => {
    // Mock docker available but old version
    mockExec
      .mockImplementationOnce(mockExecCallback('Docker version 19.0.0'))
      .mockImplementationOnce(mockExecCallback('Docker info'));

    // Mock podman available with newer version
    mockExec
      .mockImplementationOnce(mockExecCallback('podman version 4.7.2'))
      .mockImplementationOnce(mockExecCallback('Podman info'));

    const runtime = new ContainerRuntime();
    const requirements: CompatibilityRequirement = { minVersion: '20.0.0' };

    const dockerCompatibility = await runtime.validateCompatibility('docker', requirements);
    expect(dockerCompatibility.compatible).toBe(false);

    const podmanCompatibility = await runtime.validateCompatibility('podman', requirements);
    expect(podmanCompatibility.compatible).toBe(true);
  });

  it('should handle complete absence of container runtimes', async () => {
    // Mock both runtimes not available
    mockExec
      .mockImplementationOnce(mockExecCallback('', '', new Error("docker: command not found")))
      .mockImplementationOnce(mockExecCallback('', '', new Error("podman: command not found")));

    const bestRuntime = await detectContainerRuntime();
    expect(bestRuntime).toBe('none');

    const dockerAvailable = await isContainerRuntimeAvailable('docker');
    const podmanAvailable = await isContainerRuntimeAvailable('podman');

    expect(dockerAvailable).toBe(false);
    expect(podmanAvailable).toBe(false);

    const dockerInfo = await getContainerRuntimeInfo('docker');
    const podmanInfo = await getContainerRuntimeInfo('podman');

    expect(dockerInfo).toBeNull();
    expect(podmanInfo).toBeNull();
  });
});