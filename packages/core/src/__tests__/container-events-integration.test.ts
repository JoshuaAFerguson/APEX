import { describe, it, expect } from 'vitest';
import {
  ApexEvent,
  ApexEventType,
  ContainerEvent,
  ContainerEventData,
  ContainerCreatedEventData,
  ContainerStartedEventData,
  ContainerStoppedEventData,
  ContainerDiedEventData,
  ContainerRemovedEventData,
  ContainerHealthEventData,
  ContainerEventDataFor,
  ContainerConfig,
  ContainerNetworkMode,
  ContainerHealthStatus,
} from '../types';

describe('Container Events Integration', () => {
  describe('Event Processing and Filtering', () => {
    it('should process mixed event streams containing container events', () => {
      const events: ApexEvent[] = [
        {
          type: 'task:created',
          taskId: 'task-123',
          timestamp: new Date('2023-12-01T10:00:00Z'),
          data: { description: 'Test task' },
        },
        {
          type: 'container:created',
          taskId: 'task-123',
          timestamp: new Date('2023-12-01T10:00:30Z'),
          data: {
            containerId: 'container-abc',
            containerName: 'task-worker',
            image: 'node:20-alpine',
            timestamp: new Date('2023-12-01T10:00:30Z'),
            config: {
              image: 'node:20-alpine',
              workingDir: '/app',
            },
          },
        },
        {
          type: 'agent:message',
          taskId: 'task-123',
          timestamp: new Date('2023-12-01T10:01:00Z'),
          data: { message: 'Starting task execution' },
        },
        {
          type: 'container:started',
          taskId: 'task-123',
          timestamp: new Date('2023-12-01T10:01:15Z'),
          data: {
            containerId: 'container-abc',
            containerName: 'task-worker',
            image: 'node:20-alpine',
            timestamp: new Date('2023-12-01T10:01:15Z'),
            pid: 12345,
            ports: { '3000': '8080' },
            networkMode: 'bridge' as ContainerNetworkMode,
          },
        },
        {
          type: 'container:health',
          taskId: 'task-123',
          timestamp: new Date('2023-12-01T10:02:00Z'),
          data: {
            containerId: 'container-abc',
            containerName: 'task-worker',
            image: 'node:20-alpine',
            timestamp: new Date('2023-12-01T10:02:00Z'),
            status: 'healthy' as ContainerHealthStatus,
            previousStatus: 'starting' as ContainerHealthStatus,
          },
        },
        {
          type: 'task:completed',
          taskId: 'task-123',
          timestamp: new Date('2023-12-01T10:05:00Z'),
          data: { success: true },
        },
        {
          type: 'container:stopped',
          taskId: 'task-123',
          timestamp: new Date('2023-12-01T10:05:30Z'),
          data: {
            containerId: 'container-abc',
            containerName: 'task-worker',
            image: 'node:20-alpine',
            timestamp: new Date('2023-12-01T10:05:30Z'),
            exitCode: 0,
            graceful: true,
            runDuration: 255000, // 4 min 15 sec
          },
        },
        {
          type: 'container:removed',
          taskId: 'task-123',
          timestamp: new Date('2023-12-01T10:06:00Z'),
          data: {
            containerId: 'container-abc',
            containerName: 'task-worker',
            image: 'node:20-alpine',
            timestamp: new Date('2023-12-01T10:06:00Z'),
            forced: false,
            exitCode: 0,
            volumesRemoved: true,
          },
        },
      ];

      // Filter container events
      const containerEvents = events.filter((event): event is ContainerEvent =>
        event.type.startsWith('container:')
      );

      expect(containerEvents).toHaveLength(5);

      // Verify event sequence
      const eventTypes = containerEvents.map(e => e.type);
      expect(eventTypes).toEqual([
        'container:created',
        'container:started',
        'container:health',
        'container:stopped',
        'container:removed',
      ]);

      // Verify all events relate to the same container
      containerEvents.forEach(event => {
        expect(event.data.containerId).toBe('container-abc');
        expect(event.data.containerName).toBe('task-worker');
        expect(event.data.image).toBe('node:20-alpine');
        expect(event.taskId).toBe('task-123');
      });
    });

    it('should handle container lifecycle state transitions', () => {
      const containerLifecycle = [
        {
          type: 'container:created' as const,
          data: {
            containerId: 'lifecycle-test',
            containerName: 'test-container',
            image: 'python:3.11',
            timestamp: new Date(),
            config: { image: 'python:3.11', autoRemove: true },
          },
        },
        {
          type: 'container:started' as const,
          data: {
            containerId: 'lifecycle-test',
            containerName: 'test-container',
            image: 'python:3.11',
            timestamp: new Date(),
            pid: 54321,
            networkMode: 'host' as ContainerNetworkMode,
          },
        },
        {
          type: 'container:health' as const,
          data: {
            containerId: 'lifecycle-test',
            containerName: 'test-container',
            image: 'python:3.11',
            timestamp: new Date(),
            status: 'starting' as ContainerHealthStatus,
          },
        },
        {
          type: 'container:health' as const,
          data: {
            containerId: 'lifecycle-test',
            containerName: 'test-container',
            image: 'python:3.11',
            timestamp: new Date(),
            status: 'healthy' as ContainerHealthStatus,
            previousStatus: 'starting' as ContainerHealthStatus,
          },
        },
        {
          type: 'container:died' as const,
          data: {
            containerId: 'lifecycle-test',
            containerName: 'test-container',
            image: 'python:3.11',
            timestamp: new Date(),
            exitCode: 137,
            signal: 'SIGKILL',
            oomKilled: true,
            runDuration: 90000,
          },
        },
        {
          type: 'container:removed' as const,
          data: {
            containerId: 'lifecycle-test',
            containerName: 'test-container',
            image: 'python:3.11',
            timestamp: new Date(),
            forced: true,
            exitCode: 137,
          },
        },
      ];

      // Verify state transitions are valid
      expect(containerLifecycle[0].type).toBe('container:created');
      expect(containerLifecycle[1].type).toBe('container:started');
      expect(containerLifecycle[2].data.status).toBe('starting');
      expect(containerLifecycle[3].data.status).toBe('healthy');
      expect(containerLifecycle[4].type).toBe('container:died');
      expect(containerLifecycle[4].data.oomKilled).toBe(true);
      expect(containerLifecycle[5].type).toBe('container:removed');
      expect(containerLifecycle[5].data.forced).toBe(true);

      // All events should track the same container
      containerLifecycle.forEach(event => {
        expect(event.data.containerId).toBe('lifecycle-test');
      });
    });
  });

  describe('Event Data Type Mapping', () => {
    it('should correctly map event types to data interfaces using ContainerEventDataFor', () => {
      // Test type mapping at compile time and runtime

      type CreatedDataType = ContainerEventDataFor<'container:created'>;
      type StartedDataType = ContainerEventDataFor<'container:started'>;
      type StoppedDataType = ContainerEventDataFor<'container:stopped'>;
      type DiedDataType = ContainerEventDataFor<'container:died'>;
      type RemovedDataType = ContainerEventDataFor<'container:removed'>;
      type HealthDataType = ContainerEventDataFor<'container:health'>;

      // Verify the mapped types have the correct properties
      const createdData: CreatedDataType = {
        containerId: 'test',
        containerName: 'test',
        image: 'test',
        timestamp: new Date(),
        config: { image: 'test' },
      };

      const startedData: StartedDataType = {
        containerId: 'test',
        containerName: 'test',
        image: 'test',
        timestamp: new Date(),
        pid: 123,
      };

      const stoppedData: StoppedDataType = {
        containerId: 'test',
        containerName: 'test',
        image: 'test',
        timestamp: new Date(),
        exitCode: 0,
        graceful: true,
      };

      const diedData: DiedDataType = {
        containerId: 'test',
        containerName: 'test',
        image: 'test',
        timestamp: new Date(),
        exitCode: 1,
        oomKilled: false,
      };

      const removedData: RemovedDataType = {
        containerId: 'test',
        containerName: 'test',
        image: 'test',
        timestamp: new Date(),
        forced: false,
      };

      const healthData: HealthDataType = {
        containerId: 'test',
        containerName: 'test',
        image: 'test',
        timestamp: new Date(),
        status: 'healthy',
      };

      expect(createdData.config).toBeDefined();
      expect(startedData.pid).toBe(123);
      expect(stoppedData.graceful).toBe(true);
      expect(diedData.oomKilled).toBe(false);
      expect(removedData.forced).toBe(false);
      expect(healthData.status).toBe('healthy');
    });
  });

  describe('Event Handler Type Safety', () => {
    it('should support type-safe event handlers', () => {
      function handleContainerEvent(event: ContainerEvent): string {
        switch (event.type) {
          case 'container:created':
            const createdData = event.data as ContainerCreatedEventData;
            return `Created container ${createdData.containerName} with image ${createdData.image}`;

          case 'container:started':
            const startedData = event.data as ContainerStartedEventData;
            return `Started container ${startedData.containerName} with PID ${startedData.pid || 'unknown'}`;

          case 'container:stopped':
            const stoppedData = event.data as ContainerStoppedEventData;
            return `Stopped container ${stoppedData.containerName} with exit code ${stoppedData.exitCode}`;

          case 'container:died':
            const diedData = event.data as ContainerDiedEventData;
            return `Container ${diedData.containerName} died with exit code ${diedData.exitCode}${diedData.oomKilled ? ' (OOM)' : ''}`;

          case 'container:removed':
            const removedData = event.data as ContainerRemovedEventData;
            return `Removed container ${removedData.containerName}${removedData.forced ? ' (forced)' : ''}`;

          case 'container:health':
            const healthData = event.data as ContainerHealthEventData;
            return `Container ${healthData.containerName} health: ${healthData.status}`;

          default:
            return `Unknown container event: ${event.type}`;
        }
      }

      const events: ContainerEvent[] = [
        {
          type: 'container:created',
          taskId: 'task-1',
          timestamp: new Date(),
          data: {
            containerId: 'test-1',
            containerName: 'worker-1',
            image: 'node:20',
            timestamp: new Date(),
            config: { image: 'node:20' },
          },
        },
        {
          type: 'container:started',
          taskId: 'task-1',
          timestamp: new Date(),
          data: {
            containerId: 'test-1',
            containerName: 'worker-1',
            image: 'node:20',
            timestamp: new Date(),
            pid: 42,
          },
        },
        {
          type: 'container:health',
          taskId: 'task-1',
          timestamp: new Date(),
          data: {
            containerId: 'test-1',
            containerName: 'worker-1',
            image: 'node:20',
            timestamp: new Date(),
            status: 'unhealthy',
          },
        },
        {
          type: 'container:died',
          taskId: 'task-1',
          timestamp: new Date(),
          data: {
            containerId: 'test-1',
            containerName: 'worker-1',
            image: 'node:20',
            timestamp: new Date(),
            exitCode: 137,
            oomKilled: true,
          },
        },
        {
          type: 'container:removed',
          taskId: 'task-1',
          timestamp: new Date(),
          data: {
            containerId: 'test-1',
            containerName: 'worker-1',
            image: 'node:20',
            timestamp: new Date(),
            forced: true,
          },
        },
      ];

      const results = events.map(handleContainerEvent);

      expect(results).toEqual([
        'Created container worker-1 with image node:20',
        'Started container worker-1 with PID 42',
        'Container worker-1 health: unhealthy',
        'Container worker-1 died with exit code 137 (OOM)',
        'Removed container worker-1 (forced)',
      ]);
    });
  });

  describe('Real-world Event Scenarios', () => {
    it('should handle container failure scenarios', () => {
      const failureScenario: ContainerEvent[] = [
        {
          type: 'container:created',
          taskId: 'failing-task',
          timestamp: new Date('2023-12-01T10:00:00Z'),
          data: {
            containerId: 'failing-container',
            containerName: 'memory-hungry-app',
            image: 'memory-test:latest',
            timestamp: new Date('2023-12-01T10:00:00Z'),
            config: {
              image: 'memory-test:latest',
              // Limited memory
            },
          },
        },
        {
          type: 'container:started',
          taskId: 'failing-task',
          timestamp: new Date('2023-12-01T10:00:05Z'),
          data: {
            containerId: 'failing-container',
            containerName: 'memory-hungry-app',
            image: 'memory-test:latest',
            timestamp: new Date('2023-12-01T10:00:05Z'),
            pid: 99999,
            networkMode: 'bridge',
          },
        },
        {
          type: 'container:health',
          taskId: 'failing-task',
          timestamp: new Date('2023-12-01T10:00:10Z'),
          data: {
            containerId: 'failing-container',
            containerName: 'memory-hungry-app',
            image: 'memory-test:latest',
            timestamp: new Date('2023-12-01T10:00:10Z'),
            status: 'starting',
          },
        },
        {
          type: 'container:health',
          taskId: 'failing-task',
          timestamp: new Date('2023-12-01T10:00:30Z'),
          data: {
            containerId: 'failing-container',
            containerName: 'memory-hungry-app',
            image: 'memory-test:latest',
            timestamp: new Date('2023-12-01T10:00:30Z'),
            status: 'unhealthy',
            previousStatus: 'starting',
            failingStreak: 5,
            lastCheckOutput: 'Health check timeout',
            lastCheckExitCode: 1,
          },
        },
        {
          type: 'container:died',
          taskId: 'failing-task',
          timestamp: new Date('2023-12-01T10:01:00Z'),
          data: {
            containerId: 'failing-container',
            containerName: 'memory-hungry-app',
            image: 'memory-test:latest',
            timestamp: new Date('2023-12-01T10:01:00Z'),
            exitCode: 137,
            signal: 'SIGKILL',
            oomKilled: true,
            error: 'Container killed due to out of memory',
            runDuration: 55000, // 55 seconds
          },
        },
        {
          type: 'container:removed',
          taskId: 'failing-task',
          timestamp: new Date('2023-12-01T10:01:30Z'),
          data: {
            containerId: 'failing-container',
            containerName: 'memory-hungry-app',
            image: 'memory-test:latest',
            timestamp: new Date('2023-12-01T10:01:30Z'),
            forced: false,
            exitCode: 137,
            volumesRemoved: false,
          },
        },
      ];

      // Verify failure scenario timeline
      expect(failureScenario).toHaveLength(6);

      const createdEvent = failureScenario[0].data as ContainerCreatedEventData;
      const startedEvent = failureScenario[1].data as ContainerStartedEventData;
      const healthyEvent = failureScenario[2].data as ContainerHealthEventData;
      const unhealthyEvent = failureScenario[3].data as ContainerHealthEventData;
      const diedEvent = failureScenario[4].data as ContainerDiedEventData;
      const removedEvent = failureScenario[5].data as ContainerRemovedEventData;

      // Verify progression
      expect(createdEvent.config).toBeDefined();
      expect(startedEvent.pid).toBe(99999);
      expect(healthyEvent.status).toBe('starting');
      expect(unhealthyEvent.status).toBe('unhealthy');
      expect(unhealthyEvent.failingStreak).toBe(5);
      expect(diedEvent.oomKilled).toBe(true);
      expect(diedEvent.exitCode).toBe(137);
      expect(removedEvent.forced).toBe(false);
      expect(removedEvent.exitCode).toBe(137);

      // All events should reference the same container
      failureScenario.forEach(event => {
        expect(event.data.containerId).toBe('failing-container');
        expect(event.taskId).toBe('failing-task');
      });
    });

    it('should handle successful container lifecycle', () => {
      const successScenario: ContainerEvent[] = [
        {
          type: 'container:created',
          taskId: 'success-task',
          timestamp: new Date('2023-12-01T14:00:00Z'),
          data: {
            containerId: 'success-container',
            containerName: 'api-server',
            image: 'node:20-alpine',
            timestamp: new Date('2023-12-01T14:00:00Z'),
            config: {
              image: 'node:20-alpine',
              workingDir: '/app',
              environment: {
                NODE_ENV: 'production',
                PORT: '3000',
              },
              networkMode: 'bridge',
              autoRemove: true,
            },
            labels: {
              'apex.task.id': 'success-task',
              'apex.component': 'api-server',
            },
          },
        },
        {
          type: 'container:started',
          taskId: 'success-task',
          timestamp: new Date('2023-12-01T14:00:05Z'),
          data: {
            containerId: 'success-container',
            containerName: 'api-server',
            image: 'node:20-alpine',
            timestamp: new Date('2023-12-01T14:00:05Z'),
            pid: 1001,
            ports: {
              '3000': '8080',
              '9229': '9229', // Debug port
            },
            networkMode: 'bridge',
          },
        },
        {
          type: 'container:health',
          taskId: 'success-task',
          timestamp: new Date('2023-12-01T14:00:15Z'),
          data: {
            containerId: 'success-container',
            containerName: 'api-server',
            image: 'node:20-alpine',
            timestamp: new Date('2023-12-01T14:00:15Z'),
            status: 'healthy',
            previousStatus: 'starting',
            failingStreak: 0,
            lastCheckOutput: 'GET /health -> 200 OK',
            lastCheckExitCode: 0,
            lastCheckTime: new Date('2023-12-01T14:00:15Z'),
          },
        },
        {
          type: 'container:stopped',
          taskId: 'success-task',
          timestamp: new Date('2023-12-01T14:15:00Z'),
          data: {
            containerId: 'success-container',
            containerName: 'api-server',
            image: 'node:20-alpine',
            timestamp: new Date('2023-12-01T14:15:00Z'),
            exitCode: 0,
            graceful: true,
            runDuration: 895000, // ~15 minutes
          },
        },
        {
          type: 'container:removed',
          taskId: 'success-task',
          timestamp: new Date('2023-12-01T14:15:05Z'),
          data: {
            containerId: 'success-container',
            containerName: 'api-server',
            image: 'node:20-alpine',
            timestamp: new Date('2023-12-01T14:15:05Z'),
            forced: false,
            exitCode: 0,
            volumesRemoved: true,
          },
        },
      ];

      // Verify successful scenario
      expect(successScenario).toHaveLength(5);

      const createdEvent = successScenario[0].data as ContainerCreatedEventData;
      const startedEvent = successScenario[1].data as ContainerStartedEventData;
      const healthEvent = successScenario[2].data as ContainerHealthEventData;
      const stoppedEvent = successScenario[3].data as ContainerStoppedEventData;
      const removedEvent = successScenario[4].data as ContainerRemovedEventData;

      // Verify successful completion
      expect(createdEvent.config?.environment?.NODE_ENV).toBe('production');
      expect(createdEvent.labels?.['apex.task.id']).toBe('success-task');
      expect(startedEvent.ports?.['3000']).toBe('8080');
      expect(healthEvent.status).toBe('healthy');
      expect(healthEvent.lastCheckExitCode).toBe(0);
      expect(stoppedEvent.graceful).toBe(true);
      expect(stoppedEvent.exitCode).toBe(0);
      expect(removedEvent.forced).toBe(false);
      expect(removedEvent.volumesRemoved).toBe(true);

      // All events should reference the same container
      successScenario.forEach(event => {
        expect(event.data.containerId).toBe('success-container');
        expect(event.taskId).toBe('success-task');
      });
    });
  });
});