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

describe('ContainerManager Docker Events Monitoring - Advanced Tests', () => {
  let containerManager: ContainerManager;
  let mockSpawn: Mock;
  let mockProcess: Partial<ChildProcess>;
  let mockRuntime: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSpawn = vi.mocked(vi.requireMock('child_process').spawn);

    mockProcess = {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      on: vi.fn(),
      kill: vi.fn(),
      killed: false,
    };

    mockSpawn.mockReturnValue(mockProcess as ChildProcess);

    mockRuntime = {
      getBestRuntime: vi.fn().mockResolvedValue('docker'),
    };

    containerManager = new ContainerManager(mockRuntime as ContainerRuntime);
  });

  afterEach(async () => {
    if (containerManager.isEventsMonitoringActive()) {
      await containerManager.stopEventsMonitoring();
    }
  });

  describe('Events Stream Processing', () => {
    beforeEach(async () => {
      await containerManager.startEventsMonitoring();
    });

    it('should handle multiple events in a single data chunk', async () => {
      const diedEventSpy = vi.fn();
      containerManager.on('container:died', diedEventSpy);

      vi.spyOn(containerManager, 'getContainerInfo').mockResolvedValue({
        id: 'container123',
        name: 'apex-task-abc123',
        image: 'node:20-alpine',
        status: 'exited',
        createdAt: new Date(),
      });

      // Multiple events in one data chunk
      const event1 = {
        status: 'die',
        id: 'container123',
        Actor: { Attributes: { name: 'apex-task-abc123', exitCode: '1' } },
        time: 1640995200,
      };

      const event2 = {
        status: 'die',
        id: 'container456',
        Actor: { Attributes: { name: 'apex-task-def456', exitCode: '0' } },
        time: 1640995201,
      };

      const multiEventData = JSON.stringify(event1) + '\n' + JSON.stringify(event2) + '\n';

      mockProcess.stdout!.emit('data', Buffer.from(multiEventData));
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(diedEventSpy).toHaveBeenCalledTimes(2);
      expect(diedEventSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({
        containerId: 'container123',
        exitCode: 1,
      }));
      expect(diedEventSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({
        containerId: 'container456',
        exitCode: 0,
      }));
    });

    it('should handle partial JSON data across multiple chunks', async () => {
      const diedEventSpy = vi.fn();
      containerManager.on('container:died', diedEventSpy);

      vi.spyOn(containerManager, 'getContainerInfo').mockResolvedValue({
        id: 'container123',
        name: 'apex-task-abc123',
        image: 'node:20-alpine',
        status: 'exited',
        createdAt: new Date(),
      });

      const event = {
        status: 'die',
        id: 'container123',
        Actor: { Attributes: { name: 'apex-task-abc123', exitCode: '1' } },
        time: 1640995200,
      };

      const eventJson = JSON.stringify(event);
      const midpoint = Math.floor(eventJson.length / 2);

      // Send first half
      mockProcess.stdout!.emit('data', Buffer.from(eventJson.substring(0, midpoint)));
      await new Promise(resolve => setTimeout(resolve, 5));

      // Event should not be emitted yet
      expect(diedEventSpy).not.toHaveBeenCalled();

      // Send second half with newline
      mockProcess.stdout!.emit('data', Buffer.from(eventJson.substring(midpoint) + '\n'));
      await new Promise(resolve => setTimeout(resolve, 10));

      // Now event should be emitted
      expect(diedEventSpy).toHaveBeenCalledTimes(1);
      expect(diedEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        containerId: 'container123',
        exitCode: 1,
      }));
    });

    it('should handle events with missing optional fields gracefully', async () => {
      const diedEventSpy = vi.fn();
      containerManager.on('container:died', diedEventSpy);

      vi.spyOn(containerManager, 'getContainerInfo').mockResolvedValue(null);

      // Event with minimal required fields
      const minimalEvent = {
        status: 'die',
        id: 'container123',
        time: 1640995200,
      };

      mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify(minimalEvent) + '\n'));
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(diedEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        containerId: 'container123',
        exitCode: 1, // Default exit code
        timestamp: new Date(1640995200000),
        taskId: undefined,
        signal: undefined,
        oomKilled: false,
      }));
    });

    it('should detect various exit signals correctly', async () => {
      const diedEventSpy = vi.fn();
      containerManager.on('container:died', diedEventSpy);

      vi.spyOn(containerManager, 'getContainerInfo').mockResolvedValue(null);

      const testCases = [
        { exitCode: '0', expectedSignal: undefined, expectedOom: false },
        { exitCode: '137', expectedSignal: 'SIGKILL', expectedOom: false },
        { exitCode: '143', expectedSignal: undefined, expectedOom: false },
        { exitCode: '137', attributes: { signal: 'SIGTERM' }, expectedSignal: 'SIGTERM', expectedOom: false },
        { exitCode: '137', attributes: { oomkilled: 'true' }, expectedSignal: 'SIGKILL', expectedOom: true },
        { exitCode: '1', attributes: { reason: 'oom' }, expectedSignal: undefined, expectedOom: true },
      ];

      for (const testCase of testCases) {
        const event = {
          status: 'die',
          id: `container-${testCase.exitCode}`,
          Actor: {
            Attributes: {
              name: `test-container-${testCase.exitCode}`,
              exitCode: testCase.exitCode,
              ...testCase.attributes,
            }
          },
          time: 1640995200,
        };

        mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify(event) + '\n'));
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      expect(diedEventSpy).toHaveBeenCalledTimes(testCases.length);

      testCases.forEach((testCase, index) => {
        const call = diedEventSpy.mock.calls[index];
        expect(call[0]).toMatchObject({
          exitCode: parseInt(testCase.exitCode),
          signal: testCase.expectedSignal,
          oomKilled: testCase.expectedOom,
        });
      });
    });
  });

  describe('Runtime-specific Event Processing', () => {
    it('should handle Podman events format correctly', async () => {
      await containerManager.stopEventsMonitoring();
      mockRuntime.getBestRuntime.mockResolvedValue('podman');
      await containerManager.startEventsMonitoring();

      const diedEventSpy = vi.fn();
      containerManager.on('container:died', diedEventSpy);

      vi.spyOn(containerManager, 'getContainerInfo').mockResolvedValue({
        id: 'podman123',
        name: 'apex-podman-test',
        image: 'alpine:latest',
        status: 'exited',
        createdAt: new Date(),
      });

      // Podman event format (can vary slightly from Docker)
      const podmanEvent = {
        Action: 'died', // Podman uses 'Action' instead of 'status'
        ID: 'podman123',
        Actor: {
          Attributes: {
            name: 'apex-podman-test',
            exitCode: '2',
          }
        },
        timeNano: 1640995200000000000, // Podman uses nanoseconds
      };

      mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify(podmanEvent) + '\n'));
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockSpawn).toHaveBeenCalledWith('podman', expect.arrayContaining([
        'events',
        '--format',
        '{{json .}}',
      ]), { stdio: ['ignore', 'pipe', 'pipe'] });

      expect(diedEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        containerId: 'podman123',
        exitCode: 2,
        timestamp: new Date(1640995200),
      }));
    });
  });

  describe('Event Filtering and Monitoring Options', () => {
    it('should handle complex label filtering', async () => {
      const complexOptions: DockerEventsMonitorOptions = {
        namePrefix: 'apex-prod',
        eventTypes: ['die', 'oom'],
        labelFilters: {
          'apex.managed': 'true',
          'environment': 'production',
          'service': 'web',
        }
      };

      await containerManager.startEventsMonitoring(complexOptions);

      expect(mockSpawn).toHaveBeenCalledWith('docker', expect.arrayContaining([
        '--filter', 'label=apex.managed=true',
        '--filter', 'label=environment=production',
        '--filter', 'label=service=web',
        '--filter', 'container=apex-prod-*',
      ]), { stdio: ['ignore', 'pipe', 'pipe'] });
    });

    it('should handle empty event types array gracefully', async () => {
      await containerManager.startEventsMonitoring({
        eventTypes: [],
        namePrefix: 'test',
      });

      const spawnCall = mockSpawn.mock.calls[0];
      const args = spawnCall[1] as string[];

      // Should not include any event filters
      const eventFilters = args.filter(arg => arg.startsWith('event='));
      expect(eventFilters).toHaveLength(0);
    });

    it('should update monitoring options when restarting', async () => {
      // Start with initial options
      await containerManager.startEventsMonitoring({
        namePrefix: 'initial',
        eventTypes: ['die'],
      });

      let options = containerManager.getMonitoringOptions();
      expect(options.namePrefix).toBe('initial');
      expect(options.eventTypes).toEqual(['die']);

      // Stop and restart with new options
      await containerManager.stopEventsMonitoring();
      await containerManager.startEventsMonitoring({
        namePrefix: 'updated',
        eventTypes: ['die', 'start', 'stop'],
      });

      options = containerManager.getMonitoringOptions();
      expect(options.namePrefix).toBe('updated');
      expect(options.eventTypes).toEqual(['die', 'start', 'stop']);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle process spawn failure', async () => {
      mockSpawn.mockImplementationOnce(() => {
        throw new Error('Failed to spawn process');
      });

      await expect(containerManager.startEventsMonitoring())
        .rejects
        .toThrow('Failed to start Docker events monitoring: Failed to spawn process');
    });

    it('should handle container info lookup failure gracefully', async () => {
      await containerManager.startEventsMonitoring();

      const diedEventSpy = vi.fn();
      containerManager.on('container:died', diedEventSpy);

      // Mock container info to throw error
      vi.spyOn(containerManager, 'getContainerInfo').mockRejectedValue(new Error('Container not found'));
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const event = {
        status: 'die',
        id: 'missing-container',
        Actor: { Attributes: { name: 'apex-missing', exitCode: '1' } },
        time: 1640995200,
      };

      mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify(event) + '\n'));
      await new Promise(resolve => setTimeout(resolve, 10));

      // Event should still be emitted despite info lookup failure
      expect(diedEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        containerId: 'missing-container',
        containerInfo: null,
      }));

      expect(consoleWarnSpy).toHaveBeenCalledWith('Error handling container died event:', expect.any(Error));

      consoleWarnSpy.mockRestore();
    });

    it('should handle very large event payloads', async () => {
      await containerManager.startEventsMonitoring();

      const diedEventSpy = vi.fn();
      containerManager.on('container:died', diedEventSpy);

      vi.spyOn(containerManager, 'getContainerInfo').mockResolvedValue(null);

      // Create a large event with many attributes
      const largeAttributes = {};
      for (let i = 0; i < 1000; i++) {
        largeAttributes[`attr_${i}`] = `value_${i}_${'x'.repeat(100)}`;
      }

      const largeEvent = {
        status: 'die',
        id: 'large-container',
        Actor: {
          Attributes: {
            name: 'apex-large-test',
            exitCode: '0',
            ...largeAttributes,
          }
        },
        time: 1640995200,
      };

      const eventData = JSON.stringify(largeEvent) + '\n';
      expect(eventData.length).toBeGreaterThan(100000); // Ensure it's actually large

      mockProcess.stdout!.emit('data', Buffer.from(eventData));
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(diedEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        containerId: 'large-container',
        exitCode: 0,
      }));
    });
  });

  describe('Performance and Memory Management', () => {
    it('should not accumulate memory from ignored events', async () => {
      await containerManager.startEventsMonitoring({ namePrefix: 'apex' });

      const diedEventSpy = vi.fn();
      containerManager.on('container:died', diedEventSpy);

      // Send many events for non-APEX containers (should be filtered out)
      const eventCount = 1000;
      for (let i = 0; i < eventCount; i++) {
        const ignoredEvent = {
          status: 'die',
          id: `ignored-container-${i}`,
          Actor: { Attributes: { name: `other-container-${i}`, exitCode: '0' } },
          time: 1640995200 + i,
        };

        mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify(ignoredEvent) + '\n'));
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      // No events should be emitted (all filtered out)
      expect(diedEventSpy).not.toHaveBeenCalled();
    });

    it('should handle rapid event bursts', async () => {
      await containerManager.startEventsMonitoring();

      const diedEventSpy = vi.fn();
      containerManager.on('container:died', diedEventSpy);

      vi.spyOn(containerManager, 'getContainerInfo').mockResolvedValue(null);

      // Send rapid burst of events
      const burstSize = 100;
      const events = [];

      for (let i = 0; i < burstSize; i++) {
        events.push({
          status: 'die',
          id: `burst-container-${i}`,
          Actor: { Attributes: { name: `apex-burst-${i}`, exitCode: '0' } },
          time: 1640995200 + i,
        });
      }

      const burstData = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      mockProcess.stdout!.emit('data', Buffer.from(burstData));

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(diedEventSpy).toHaveBeenCalledTimes(burstSize);
    });
  });

  describe('Task ID Extraction Edge Cases', () => {
    it('should handle various container naming patterns', async () => {
      await containerManager.startEventsMonitoring();

      const diedEventSpy = vi.fn();
      containerManager.on('container:died', diedEventSpy);

      vi.spyOn(containerManager, 'getContainerInfo').mockResolvedValue(null);

      const namingTestCases = [
        { name: 'apex-simple', expectedTaskId: 'simple' },
        { name: 'apex-with-uuid-abc123def456', expectedTaskId: 'with' },
        { name: 'apex-task_with_underscores', expectedTaskId: 'task_with_underscores' },
        { name: 'apex-123-numeric-start', expectedTaskId: '123' },
        { name: 'apex--double-dash', expectedTaskId: '' },
        { name: 'apex-', expectedTaskId: '' },
        { name: 'apex', expectedTaskId: undefined }, // No dash separator
        { name: '/apex-docker-prefixed', expectedTaskId: 'docker' }, // Docker adds leading slash
        { name: 'custom-apex-in-middle', expectedTaskId: undefined }, // Doesn't start with apex-
      ];

      for (const testCase of namingTestCases) {
        const event = {
          status: 'die',
          id: `container-${testCase.name.replace('/', '_')}`,
          Actor: { Attributes: { name: testCase.name, exitCode: '0' } },
          time: 1640995200,
        };

        mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify(event) + '\n'));
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      expect(diedEventSpy).toHaveBeenCalledTimes(namingTestCases.length);

      namingTestCases.forEach((testCase, index) => {
        const call = diedEventSpy.mock.calls[index];
        expect(call[0].taskId).toBe(testCase.expectedTaskId);
      });
    });
  });

  describe('Event Type Handling', () => {
    it('should only process die events currently but be prepared for future event types', async () => {
      await containerManager.startEventsMonitoring({
        eventTypes: ['die', 'start', 'stop', 'destroy']
      });

      const diedEventSpy = vi.fn();
      const lifecycleEventSpy = vi.fn();
      containerManager.on('container:died', diedEventSpy);
      containerManager.on('container:lifecycle', lifecycleEventSpy);

      vi.spyOn(containerManager, 'getContainerInfo').mockResolvedValue(null);

      // Send various event types
      const events = [
        { status: 'start', id: 'container1', Actor: { Attributes: { name: 'apex-start-test' } } },
        { status: 'die', id: 'container2', Actor: { Attributes: { name: 'apex-die-test', exitCode: '1' } } },
        { status: 'stop', id: 'container3', Actor: { Attributes: { name: 'apex-stop-test' } } },
        { status: 'destroy', id: 'container4', Actor: { Attributes: { name: 'apex-destroy-test' } } },
      ];

      for (const event of events) {
        mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify({ ...event, time: 1640995200 }) + '\n'));
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      // Only die events should trigger container:died
      expect(diedEventSpy).toHaveBeenCalledTimes(1);
      expect(diedEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        containerId: 'container2'
      }));

      // But lifecycle events should be called for died event
      expect(lifecycleEventSpy).toHaveBeenCalledTimes(1);
      expect(lifecycleEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ containerId: 'container2' }),
        'died'
      );
    });
  });
});