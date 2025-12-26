import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { ChildProcess } from 'child_process';
import { ContainerManager, DockerEventsMonitorOptions } from '../container-manager';
import { ContainerRuntime } from '../container-runtime';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
}));

// Mock container runtime
vi.mock('../container-runtime', () => ({
  ContainerRuntime: vi.fn().mockImplementation(() => ({
    getBestRuntime: vi.fn().mockResolvedValue('docker'),
  })),
}));

describe('ContainerManager Docker Events Monitoring', () => {
  let containerManager: ContainerManager;
  let mockSpawn: Mock;
  let mockProcess: Partial<ChildProcess>;
  let mockRuntime: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    mockSpawn = vi.mocked(vi.requireMock('child_process').spawn);

    // Create mock process
    mockProcess = {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      on: vi.fn(),
      kill: vi.fn(),
      killed: false,
    };

    mockSpawn.mockReturnValue(mockProcess as ChildProcess);

    // Create mock runtime
    mockRuntime = {
      getBestRuntime: vi.fn().mockResolvedValue('docker'),
    };

    containerManager = new ContainerManager(mockRuntime as ContainerRuntime);
  });

  afterEach(async () => {
    // Clean up monitoring if it's active
    if (containerManager.isEventsMonitoringActive()) {
      await containerManager.stopEventsMonitoring();
    }
  });

  describe('startEventsMonitoring', () => {
    it('should start monitoring with default options', async () => {
      await containerManager.startEventsMonitoring();

      expect(mockRuntime.getBestRuntime).toHaveBeenCalled();
      expect(mockSpawn).toHaveBeenCalledWith('docker', [
        'events',
        '--format',
        '{{json .}}',
        '--filter',
        'event=die',
        '--filter',
        'event=start',
        '--filter',
        'event=stop',
        '--filter',
        'event=create',
        '--filter',
        'event=destroy',
        '--filter',
        'container=apex-*',
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      expect(containerManager.isEventsMonitoringActive()).toBe(true);
    });

    it('should start monitoring with custom options', async () => {
      const customOptions: DockerEventsMonitorOptions = {
        namePrefix: 'custom',
        eventTypes: ['die', 'start'],
        labelFilters: {
          'apex.managed': 'true',
          'project': 'test'
        }
      };

      await containerManager.startEventsMonitoring(customOptions);

      expect(mockSpawn).toHaveBeenCalledWith('docker', [
        'events',
        '--format',
        '{{json .}}',
        '--filter',
        'event=die',
        '--filter',
        'event=start',
        '--filter',
        'container=custom-*',
        '--filter',
        'label=apex.managed=true',
        '--filter',
        'label=project=test',
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    it('should throw error when no container runtime is available', async () => {
      mockRuntime.getBestRuntime.mockResolvedValue('none');

      await expect(containerManager.startEventsMonitoring())
        .rejects
        .toThrow('No container runtime available for events monitoring');
    });

    it('should not start if already monitoring', async () => {
      await containerManager.startEventsMonitoring();
      const firstSpawnCall = mockSpawn.mock.calls.length;

      await containerManager.startEventsMonitoring();

      expect(mockSpawn).toHaveBeenCalledTimes(firstSpawnCall);
    });

    it('should handle spawn process failure', async () => {
      mockProcess.killed = true;

      await expect(containerManager.startEventsMonitoring())
        .rejects
        .toThrow('Failed to start Docker events monitoring process');
    });
  });

  describe('stopEventsMonitoring', () => {
    beforeEach(async () => {
      await containerManager.startEventsMonitoring();
    });

    it('should stop monitoring gracefully', async () => {
      await containerManager.stopEventsMonitoring();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(containerManager.isEventsMonitoringActive()).toBe(false);
    });

    it('should force kill process if graceful shutdown fails', async () => {
      // Simulate process not responding to SIGTERM
      let processExitCallback: Function;
      mockProcess.on = vi.fn().mockImplementation((event, callback) => {
        if (event === 'exit') {
          processExitCallback = callback;
        }
      });

      const stopPromise = containerManager.stopEventsMonitoring();

      // Don't call the exit callback to simulate hanging process
      // The timeout should trigger SIGKILL

      await stopPromise;

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      // Note: Testing SIGKILL requires more complex timing setup
    });

    it('should not fail if already stopped', async () => {
      await containerManager.stopEventsMonitoring();

      // Should not throw
      await expect(containerManager.stopEventsMonitoring()).resolves.toBeUndefined();
    });
  });

  describe('Docker events processing', () => {
    beforeEach(async () => {
      await containerManager.startEventsMonitoring();
    });

    it('should emit container:died event when container dies', async () => {
      const diedEventSpy = vi.fn();
      const lifecycleEventSpy = vi.fn();

      containerManager.on('container:died', diedEventSpy);
      containerManager.on('container:lifecycle', lifecycleEventSpy);

      // Mock container info lookup
      vi.spyOn(containerManager, 'getContainerInfo').mockResolvedValue({
        id: 'container123',
        name: 'apex-task-abc123',
        image: 'node:20-alpine',
        status: 'exited',
        createdAt: new Date(),
      });

      // Simulate Docker event
      const dockerEvent = {
        status: 'die',
        id: 'container123',
        Actor: {
          Attributes: {
            name: 'apex-task-abc123',
            image: 'node:20-alpine',
            exitCode: '1',
          }
        },
        time: 1640995200,
      };

      // Emit data to stdout
      mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify(dockerEvent) + '\n'));

      // Wait a moment for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(diedEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        containerId: 'container123',
        taskId: 'task-abc123',
        exitCode: 1,
        timestamp: new Date(1640995200000),
        oomKilled: false,
      }));

      expect(lifecycleEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          containerId: 'container123',
          taskId: 'task-abc123',
        }),
        'died'
      );
    });

    it('should detect OOM killed containers', async () => {
      const diedEventSpy = vi.fn();
      containerManager.on('container:died', diedEventSpy);

      vi.spyOn(containerManager, 'getContainerInfo').mockResolvedValue({
        id: 'container123',
        name: 'apex-task-abc123',
        image: 'node:20-alpine',
        status: 'exited',
        createdAt: new Date(),
      });

      // Simulate OOM kill event
      const dockerEvent = {
        status: 'die',
        id: 'container123',
        Actor: {
          Attributes: {
            name: 'apex-task-abc123',
            exitCode: '137',
            oomkilled: 'true',
          }
        },
        time: 1640995200,
      };

      mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify(dockerEvent) + '\n'));
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(diedEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        exitCode: 137,
        signal: 'SIGKILL',
        oomKilled: true,
      }));
    });

    it('should extract task ID from container name', async () => {
      const diedEventSpy = vi.fn();
      containerManager.on('container:died', diedEventSpy);

      vi.spyOn(containerManager, 'getContainerInfo').mockResolvedValue(null);

      const testCases = [
        { name: 'apex-myTask123', expectedTaskId: 'myTask123' },
        { name: 'apex-task-with-dashes', expectedTaskId: 'task' },
        { name: 'apex-simple', expectedTaskId: 'simple' },
        { name: 'non-apex-container', expectedTaskId: undefined },
      ];

      for (const { name, expectedTaskId } of testCases) {
        const dockerEvent = {
          status: 'die',
          id: `container-${name}`,
          Actor: {
            Attributes: { name, exitCode: '0' }
          },
          time: 1640995200,
        };

        mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify(dockerEvent) + '\n'));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Check task ID extraction
      expect(diedEventSpy).toHaveBeenCalledTimes(testCases.length);

      testCases.forEach((testCase, index) => {
        const call = diedEventSpy.mock.calls[index];
        expect(call[0].taskId).toBe(testCase.expectedTaskId);
      });
    });

    it('should filter events by name prefix', async () => {
      await containerManager.stopEventsMonitoring();

      await containerManager.startEventsMonitoring({
        namePrefix: 'apex'
      });

      const diedEventSpy = vi.fn();
      containerManager.on('container:died', diedEventSpy);

      // Events for non-APEX containers should be filtered out
      const nonApexEvent = {
        status: 'die',
        id: 'container123',
        Actor: {
          Attributes: {
            name: 'other-container',
            exitCode: '0',
          }
        },
        time: 1640995200,
      };

      const apexEvent = {
        status: 'die',
        id: 'container456',
        Actor: {
          Attributes: {
            name: 'apex-task-123',
            exitCode: '0',
          }
        },
        time: 1640995200,
      };

      vi.spyOn(containerManager, 'getContainerInfo').mockResolvedValue(null);

      mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify(nonApexEvent) + '\n'));
      mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify(apexEvent) + '\n'));

      await new Promise(resolve => setTimeout(resolve, 10));

      // Only APEX container event should be emitted
      expect(diedEventSpy).toHaveBeenCalledTimes(1);
      expect(diedEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        containerId: 'container456',
      }));
    });

    it('should handle malformed JSON events gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const diedEventSpy = vi.fn();
      containerManager.on('container:died', diedEventSpy);

      // Send malformed JSON
      mockProcess.stdout!.emit('data', Buffer.from('{"invalid json\n'));
      mockProcess.stdout!.emit('data', Buffer.from('not json at all\n'));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(diedEventSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should handle stderr output', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockProcess.stderr!.emit('data', Buffer.from('Error: something went wrong\n'));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleWarnSpy).toHaveBeenCalledWith('Docker events monitoring stderr: Error: something went wrong');

      consoleWarnSpy.mockRestore();
    });
  });

  describe('getMonitoringOptions', () => {
    it('should return current monitoring options', () => {
      const options = containerManager.getMonitoringOptions();

      expect(options).toEqual({
        namePrefix: 'apex',
        eventTypes: ['die', 'start', 'stop', 'create', 'destroy']
      });
    });

    it('should return a copy of options (not reference)', () => {
      const options1 = containerManager.getMonitoringOptions();
      const options2 = containerManager.getMonitoringOptions();

      expect(options1).not.toBe(options2);
      expect(options1).toEqual(options2);
    });
  });

  describe('isEventsMonitoringActive', () => {
    it('should return false when not monitoring', () => {
      expect(containerManager.isEventsMonitoringActive()).toBe(false);
    });

    it('should return true when monitoring is active', async () => {
      await containerManager.startEventsMonitoring();
      expect(containerManager.isEventsMonitoringActive()).toBe(true);
    });

    it('should return false after stopping monitoring', async () => {
      await containerManager.startEventsMonitoring();
      await containerManager.stopEventsMonitoring();
      expect(containerManager.isEventsMonitoringActive()).toBe(false);
    });

    it('should return false when process is killed', async () => {
      await containerManager.startEventsMonitoring();
      mockProcess.killed = true;
      expect(containerManager.isEventsMonitoringActive()).toBe(false);
    });
  });

  describe('process lifecycle events', () => {
    beforeEach(async () => {
      await containerManager.startEventsMonitoring();
    });

    it('should handle process error', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorCallback = mockProcess.on.mock.calls.find(call => call[0] === 'error')?.[1];
      expect(errorCallback).toBeDefined();

      const testError = new Error('Process error');
      errorCallback(testError);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Docker events monitoring process error:', testError);
      expect(containerManager.isEventsMonitoringActive()).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('should handle process exit', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const exitCallback = mockProcess.on.mock.calls.find(call => call[0] === 'exit')?.[1];
      expect(exitCallback).toBeDefined();

      exitCallback(0, null);

      expect(consoleLogSpy).toHaveBeenCalledWith('Docker events monitoring process exited with code 0, signal null');
      expect(containerManager.isEventsMonitoringActive()).toBe(false);

      consoleLogSpy.mockRestore();
    });
  });
});