import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { ContainerManager } from '../container-manager';
import { resolveExecutable } from '../shell-utils';

// Mock child_process to intercept spawn calls
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    pid: 1234,
    stdout: {
      on: vi.fn(),
      pipe: vi.fn(),
    },
    stderr: {
      on: vi.fn(),
      pipe: vi.fn(),
    },
    stdin: {
      write: vi.fn(),
      end: vi.fn(),
    },
    on: vi.fn(),
    kill: vi.fn(),
    killed: false,
    unref: vi.fn(),
  })),
  exec: vi.fn(),
  execSync: vi.fn(),
}));

// Mock shell-utils
vi.mock('../shell-utils', () => ({
  isWindows: vi.fn(() => process.platform === 'win32'),
  resolveExecutable: vi.fn((name: string) =>
    process.platform === 'win32' && !name.includes('.') ? `${name}.exe` : name
  ),
  getPlatformShell: vi.fn(() => ({
    shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
    shellArgs: process.platform === 'win32' ? ['/d', '/s', '/c'] : ['-c']
  })),
  getKillCommand: vi.fn((pid: number) =>
    process.platform === 'win32' ? ['taskkill', '/f', '/pid', pid.toString()] : ['kill', '-9', pid.toString()]
  ),
  createShellCommand: vi.fn((parts: string[]) => parts.join(' ')),
  createEnvironmentConfig: vi.fn((config = {}) => ({ ...process.env, ...config.env })),
  PATH_SEPARATOR: process.platform === 'win32' ? ';' : ':',
  LINE_ENDING: process.platform === 'win32' ? '\r\n' : '\n',
  SHELL_CONSTANTS: {
    PATH_SEPARATOR: process.platform === 'win32' ? ';' : ':',
    LINE_ENDING: process.platform === 'win32' ? '\r\n' : '\n',
    DEFAULT_TIMEOUT: 30000,
    MAX_BUFFER: 1024 * 1024,
  },
}));

// Mock container runtime
vi.mock('../container-runtime', () => ({
  ContainerRuntime: vi.fn().mockImplementation(() => ({
    getBestRuntime: vi.fn().mockResolvedValue('docker'),
  })),
}));

// Mock image builder
vi.mock('../image-builder', () => ({
  ImageBuilder: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    buildImage: vi.fn().mockResolvedValue({
      success: true,
      imageInfo: { tag: 'test-image:latest' },
    }),
  })),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

describe('ContainerManager Cross-platform Spawn Calls', () => {
  const mockSpawn = vi.mocked(spawn);
  const mockResolveExecutable = vi.mocked(resolveExecutable);
  let containerManager: ContainerManager;
  let originalPlatform: string;

  beforeEach(() => {
    vi.clearAllMocks();
    originalPlatform = process.platform;
    containerManager = new ContainerManager();
  });

  afterEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
  });

  describe('Docker Events Monitoring Spawn Calls', () => {
    it('should use resolveExecutable for docker events monitoring on Windows', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      // Mock docker runtime
      const mockRuntime = {
        getBestRuntime: vi.fn().mockResolvedValue('docker'),
      };
      (containerManager as any).runtime = mockRuntime;

      // Start events monitoring
      await containerManager.startEventsMonitoring({
        namePrefix: 'apex',
        eventTypes: ['die', 'start', 'stop'],
      });

      // Verify resolveExecutable was called with docker
      expect(mockResolveExecutable).toHaveBeenCalledWith('docker');

      // Verify spawn was called with the resolved executable
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker.exe',
        expect.arrayContaining([
          'events',
          '--format',
          '{{json .}}',
        ]),
        expect.objectContaining({
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      );
    });

    it('should use resolveExecutable for podman events monitoring on Windows', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      // Mock podman runtime
      const mockRuntime = {
        getBestRuntime: vi.fn().mockResolvedValue('podman'),
      };
      (containerManager as any).runtime = mockRuntime;

      await containerManager.startEventsMonitoring();

      expect(mockResolveExecutable).toHaveBeenCalledWith('podman');
      expect(mockSpawn).toHaveBeenCalledWith(
        'podman.exe',
        expect.arrayContaining(['events']),
        expect.objectContaining({
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      );
    });

    it('should use original executable name for docker events on Unix', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
      });

      const mockRuntime = {
        getBestRuntime: vi.fn().mockResolvedValue('docker'),
      };
      (containerManager as any).runtime = mockRuntime;

      await containerManager.startEventsMonitoring();

      expect(mockResolveExecutable).toHaveBeenCalledWith('docker');
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['events']),
        expect.objectContaining({
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      );
    });

    it('should handle event filters correctly in spawn command', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      const mockRuntime = {
        getBestRuntime: vi.fn().mockResolvedValue('docker'),
      };
      (containerManager as any).runtime = mockRuntime;

      await containerManager.startEventsMonitoring({
        namePrefix: 'apex',
        eventTypes: ['die', 'start'],
        labelFilters: { 'apex.managed': 'true' },
      });

      // Verify the spawn command includes all filters
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker.exe',
        expect.arrayContaining([
          'events',
          '--format',
          '{{json .}}',
          '--filter',
          'event=die',
          '--filter',
          'event=start',
          '--filter',
          'container=apex-*',
          '--filter',
          'label=apex.managed=true',
        ]),
        expect.objectContaining({
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      );
    });
  });

  describe('Container Log Streaming Spawn Calls', () => {
    it('should use runtime executable for log streaming on Windows', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      const containerId = 'test-container-123';
      const options = {
        follow: true,
        timestamps: true,
        tail: 100,
      };

      // Create a log stream directly to test the spawn call
      const { ContainerLogStream } = await import('../container-manager');
      const logStream = new ContainerLogStream(containerId, options, 'docker');

      // Wait a tick for the spawn call to be made
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify spawn was called with docker logs command
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining([
          'logs',
          '--follow',
          '--timestamps',
          '--tail',
          '100',
          containerId,
        ]),
        expect.objectContaining({
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      );

      logStream.end();
    });

    it('should handle log stream options correctly in spawn command', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
      });

      const containerId = 'test-container-456';
      const options = {
        follow: false,
        timestamps: false,
        since: new Date('2024-01-01'),
        until: new Date('2024-01-02'),
        tail: 'all' as const,
      };

      const { ContainerLogStream } = await import('../container-manager');
      const logStream = new ContainerLogStream(containerId, options, 'podman');

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockSpawn).toHaveBeenCalledWith(
        'podman',
        expect.arrayContaining([
          'logs',
          '--since',
          '2024-01-01T00:00:00.000Z',
          '--until',
          '2024-01-02T00:00:00.000Z',
          '--tail',
          'all',
          containerId,
        ]),
        expect.objectContaining({
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      );

      logStream.end();
    });

    it('should handle minimal log options correctly', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      const containerId = 'simple-container';
      const options = {};

      const { ContainerLogStream } = await import('../container-manager');
      const logStream = new ContainerLogStream(containerId, options, 'docker');

      await new Promise(resolve => setTimeout(resolve, 0));

      // Should spawn with minimal logs command
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        ['logs', containerId],
        expect.objectContaining({
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      );

      logStream.end();
    });
  });

  describe('Cross-platform Runtime Compatibility', () => {
    it('should work with different container runtimes on Windows', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      const runtimes = ['docker', 'podman'];

      for (const runtime of runtimes) {
        vi.clearAllMocks();

        const mockRuntime = {
          getBestRuntime: vi.fn().mockResolvedValue(runtime),
        };
        (containerManager as any).runtime = mockRuntime;

        await containerManager.startEventsMonitoring();

        expect(mockResolveExecutable).toHaveBeenCalledWith(runtime);
        expect(mockSpawn).toHaveBeenCalledWith(
          `${runtime}.exe`,
          expect.any(Array),
          expect.any(Object)
        );
      }
    });

    it('should work with different container runtimes on Unix', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
      });

      const runtimes = ['docker', 'podman'];

      for (const runtime of runtimes) {
        vi.clearAllMocks();

        const mockRuntime = {
          getBestRuntime: vi.fn().mockResolvedValue(runtime),
        };
        (containerManager as any).runtime = mockRuntime;

        await containerManager.startEventsMonitoring();

        expect(mockResolveExecutable).toHaveBeenCalledWith(runtime);
        expect(mockSpawn).toHaveBeenCalledWith(
          runtime,
          expect.any(Array),
          expect.any(Object)
        );
      }
    });

    it('should handle runtime detection failures gracefully', async () => {
      const mockRuntime = {
        getBestRuntime: vi.fn().mockResolvedValue('none'),
      };
      (containerManager as any).runtime = mockRuntime;

      // Should throw error when no runtime is available
      await expect(containerManager.startEventsMonitoring()).rejects.toThrow(
        'No container runtime available for events monitoring'
      );

      // Should not have attempted to spawn anything
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle spawn failures gracefully', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      mockSpawn.mockImplementation(() => {
        throw new Error('ENOENT: docker.exe not found');
      });

      const mockRuntime = {
        getBestRuntime: vi.fn().mockResolvedValue('docker'),
      };
      (containerManager as any).runtime = mockRuntime;

      // Should handle spawn failure
      await expect(containerManager.startEventsMonitoring()).rejects.toThrow(
        'Failed to start Docker events monitoring'
      );
    });

    it('should handle process termination correctly', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
      });

      const mockProcess = {
        pid: 1234,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
        killed: false,
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const mockRuntime = {
        getBestRuntime: vi.fn().mockResolvedValue('docker'),
      };
      (containerManager as any).runtime = mockRuntime;

      await containerManager.startEventsMonitoring();

      // Simulate process termination
      await containerManager.stopEventsMonitoring();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should handle concurrent monitoring requests correctly', async () => {
      const mockRuntime = {
        getBestRuntime: vi.fn().mockResolvedValue('docker'),
      };
      (containerManager as any).runtime = mockRuntime;

      // Start monitoring twice - second call should be ignored
      await containerManager.startEventsMonitoring();
      await containerManager.startEventsMonitoring();

      // Should only have spawned once
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('should handle log stream cleanup properly', async () => {
      const containerId = 'cleanup-test';
      const { ContainerLogStream } = await import('../container-manager');

      const mockProcess = {
        kill: vi.fn(),
        killed: false,
        removeAllListeners: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const logStream = new ContainerLogStream(containerId, {}, 'docker');

      // End the stream
      logStream.end();

      expect(mockProcess.removeAllListeners).toHaveBeenCalled();
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should manage multiple log streams efficiently', async () => {
      const containers = ['container1', 'container2', 'container3'];
      const { ContainerLogStream } = await import('../container-manager');

      const streams = containers.map((id) =>
        new ContainerLogStream(id, { follow: true }, 'docker')
      );

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should have spawned one process per container
      expect(mockSpawn).toHaveBeenCalledTimes(containers.length);

      // Clean up all streams
      streams.forEach(stream => stream.end());
    });

    it('should handle events monitoring lifecycle correctly', async () => {
      const mockRuntime = {
        getBestRuntime: vi.fn().mockResolvedValue('docker'),
      };
      (containerManager as any).runtime = mockRuntime;

      // Start monitoring
      expect(containerManager.isEventsMonitoringActive()).toBe(false);

      await containerManager.startEventsMonitoring();
      expect(containerManager.isEventsMonitoringActive()).toBe(true);

      await containerManager.stopEventsMonitoring();
      expect(containerManager.isEventsMonitoringActive()).toBe(false);
    });
  });

  describe('Integration with Shell Utils', () => {
    it('should correctly integrate with resolveExecutable function', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      // Test that resolveExecutable is properly integrated
      const testCases = [
        { runtime: 'docker', expected: 'docker.exe' },
        { runtime: 'podman', expected: 'podman.exe' },
      ];

      for (const { runtime, expected } of testCases) {
        vi.clearAllMocks();

        const mockRuntime = {
          getBestRuntime: vi.fn().mockResolvedValue(runtime),
        };
        (containerManager as any).runtime = mockRuntime;

        await containerManager.startEventsMonitoring();

        expect(mockResolveExecutable).toHaveBeenCalledWith(runtime);
        expect(mockSpawn).toHaveBeenCalledWith(
          expected,
          expect.any(Array),
          expect.any(Object)
        );
      }
    });

    it('should work correctly on Unix systems without executable resolution', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
      });

      const runtimes = ['docker', 'podman'];

      for (const runtime of runtimes) {
        vi.clearAllMocks();

        const mockRuntime = {
          getBestRuntime: vi.fn().mockResolvedValue(runtime),
        };
        (containerManager as any).runtime = mockRuntime;

        await containerManager.startEventsMonitoring();

        expect(mockResolveExecutable).toHaveBeenCalledWith(runtime);
        // On Unix, should use the runtime name as-is
        expect(mockSpawn).toHaveBeenCalledWith(
          runtime,
          expect.any(Array),
          expect.any(Object)
        );
      }
    });
  });
});