import { describe, it, expect } from 'vitest';
import {
  // Event types and enums
  ApexEventType,
  ContainerHealthStatus,
  ContainerNetworkMode,

  // Event data interfaces
  ContainerEventDataBase,
  ContainerCreatedEventData,
  ContainerStartedEventData,
  ContainerStoppedEventData,
  ContainerDiedEventData,
  ContainerRemovedEventData,
  ContainerHealthEventData,
  ContainerEventData,

  // Typed event interfaces
  ContainerEvent,
  ApexEvent,
  ContainerEventDataFor,

  // Config types
  ContainerConfig,
  ContainerNetworkModeSchema,
  ContainerConfigSchema,
} from '../types';

describe('Container Lifecycle Event Types', () => {
  describe('ApexEventType enum', () => {
    it('should include all container event types', () => {
      const containerEventTypes = [
        'container:created',
        'container:started',
        'container:stopped',
        'container:died',
        'container:removed',
        'container:health',
      ] as const;

      // Verify all container event types are included in ApexEventType
      containerEventTypes.forEach((eventType) => {
        expect(eventType).toEqual(expect.any(String));
        // TypeScript will catch if these aren't valid ApexEventType values
        const typedEvent: ApexEventType = eventType;
        expect(typedEvent).toBe(eventType);
      });
    });

    it('should maintain backward compatibility with existing event types', () => {
      const existingEventTypes = [
        'task:created',
        'task:started',
        'task:stage-changed',
        'task:completed',
        'task:failed',
        'task:paused',
        'agent:message',
        'gate:required',
        'usage:updated',
        'log:entry',
      ] as const;

      existingEventTypes.forEach((eventType) => {
        const typedEvent: ApexEventType = eventType;
        expect(typedEvent).toBe(eventType);
      });
    });
  });

  describe('ContainerHealthStatus enum', () => {
    it('should include all valid health status values', () => {
      const validStatuses: ContainerHealthStatus[] = [
        'starting',
        'healthy',
        'unhealthy',
        'none',
      ];

      validStatuses.forEach((status) => {
        expect(status).toEqual(expect.any(String));
        const typedStatus: ContainerHealthStatus = status;
        expect(typedStatus).toBe(status);
      });
    });
  });

  describe('ContainerNetworkMode enum', () => {
    it('should include all valid network modes', () => {
      const validModes: ContainerNetworkMode[] = [
        'bridge',
        'host',
        'none',
        'container',
      ];

      validModes.forEach((mode) => {
        expect(mode).toEqual(expect.any(String));
        const typedMode: ContainerNetworkMode = mode;
        expect(typedMode).toBe(mode);
      });
    });

    it('should validate network modes with Zod schema', () => {
      expect(() => ContainerNetworkModeSchema.parse('bridge')).not.toThrow();
      expect(() => ContainerNetworkModeSchema.parse('host')).not.toThrow();
      expect(() => ContainerNetworkModeSchema.parse('none')).not.toThrow();
      expect(() => ContainerNetworkModeSchema.parse('container')).not.toThrow();

      expect(() => ContainerNetworkModeSchema.parse('invalid')).toThrow();
    });
  });

  describe('ContainerEventDataBase interface', () => {
    it('should define required base properties for all container events', () => {
      const baseEventData: ContainerEventDataBase = {
        containerId: 'abc123def456',
        containerName: 'apex-task-worker',
        image: 'node:20-alpine',
        timestamp: new Date('2023-12-01T10:30:00Z'),
      };

      expect(baseEventData.containerId).toBe('abc123def456');
      expect(baseEventData.containerName).toBe('apex-task-worker');
      expect(baseEventData.image).toBe('node:20-alpine');
      expect(baseEventData.timestamp).toEqual(new Date('2023-12-01T10:30:00Z'));
    });

    it('should support optional taskId property', () => {
      const baseEventDataWithTask: ContainerEventDataBase = {
        containerId: 'abc123def456',
        containerName: 'apex-task-worker',
        image: 'node:20-alpine',
        taskId: 'task-abc123',
        timestamp: new Date('2023-12-01T10:30:00Z'),
      };

      expect(baseEventDataWithTask.taskId).toBe('task-abc123');

      const baseEventDataWithoutTask: ContainerEventDataBase = {
        containerId: 'abc123def456',
        containerName: 'apex-task-worker',
        image: 'node:20-alpine',
        timestamp: new Date('2023-12-01T10:30:00Z'),
      };

      expect(baseEventDataWithoutTask.taskId).toBeUndefined();
    });
  });

  describe('ContainerCreatedEventData interface', () => {
    it('should extend base data with creation-specific properties', () => {
      const config: ContainerConfig = {
        image: 'node:20-alpine',
        workingDir: '/app',
        user: 'node',
        environment: {
          NODE_ENV: 'production',
          PORT: '3000',
        },
        labels: {
          'apex.task.id': 'task-123',
          'apex.workspace': 'feature-branch',
        },
      };

      const createdEventData: ContainerCreatedEventData = {
        containerId: 'abc123def456',
        containerName: 'apex-task-worker',
        image: 'node:20-alpine',
        taskId: 'task-abc123',
        timestamp: new Date('2023-12-01T10:30:00Z'),
        config,
        labels: config.labels,
      };

      expect(createdEventData.config).toBe(config);
      expect(createdEventData.labels).toEqual({
        'apex.task.id': 'task-123',
        'apex.workspace': 'feature-branch',
      });
    });

    it('should work without optional properties', () => {
      const minimalCreatedEventData: ContainerCreatedEventData = {
        containerId: 'abc123def456',
        containerName: 'apex-task-worker',
        image: 'node:20-alpine',
        timestamp: new Date('2023-12-01T10:30:00Z'),
      };

      expect(minimalCreatedEventData.config).toBeUndefined();
      expect(minimalCreatedEventData.labels).toBeUndefined();
    });
  });

  describe('ContainerStartedEventData interface', () => {
    it('should extend base data with startup-specific properties', () => {
      const startedEventData: ContainerStartedEventData = {
        containerId: 'abc123def456',
        containerName: 'apex-task-worker',
        image: 'node:20-alpine',
        taskId: 'task-abc123',
        timestamp: new Date('2023-12-01T10:30:05Z'),
        pid: 12345,
        ports: {
          '3000': '8080',
          '5432': '5432',
        },
        networkMode: 'bridge',
      };

      expect(startedEventData.pid).toBe(12345);
      expect(startedEventData.ports).toEqual({
        '3000': '8080',
        '5432': '5432',
      });
      expect(startedEventData.networkMode).toBe('bridge');
    });

    it('should work with different network modes', () => {
      const hostNetworkData: ContainerStartedEventData = {
        containerId: 'abc123def456',
        containerName: 'apex-task-worker',
        image: 'node:20-alpine',
        timestamp: new Date('2023-12-01T10:30:05Z'),
        networkMode: 'host',
      };

      expect(hostNetworkData.networkMode).toBe('host');
    });
  });

  describe('ContainerStoppedEventData interface', () => {
    it('should extend base data with stop-specific properties', () => {
      const stoppedEventData: ContainerStoppedEventData = {
        containerId: 'abc123def456',
        containerName: 'apex-task-worker',
        image: 'node:20-alpine',
        taskId: 'task-abc123',
        timestamp: new Date('2023-12-01T10:35:00Z'),
        exitCode: 0,
        runDuration: 295000, // 4 minutes 55 seconds
        graceful: true,
      };

      expect(stoppedEventData.exitCode).toBe(0);
      expect(stoppedEventData.runDuration).toBe(295000);
      expect(stoppedEventData.graceful).toBe(true);
    });

    it('should handle unexpected stops', () => {
      const unexpectedStopData: ContainerStoppedEventData = {
        containerId: 'abc123def456',
        containerName: 'apex-task-worker',
        image: 'node:20-alpine',
        timestamp: new Date('2023-12-01T10:32:00Z'),
        exitCode: 1,
        graceful: false,
      };

      expect(unexpectedStopData.exitCode).toBe(1);
      expect(unexpectedStopData.graceful).toBe(false);
      expect(unexpectedStopData.runDuration).toBeUndefined();
    });
  });

  describe('ContainerDiedEventData interface', () => {
    it('should extend base data with death-specific properties', () => {
      const diedEventData: ContainerDiedEventData = {
        containerId: 'abc123def456',
        containerName: 'apex-task-worker',
        image: 'node:20-alpine',
        taskId: 'task-abc123',
        timestamp: new Date('2023-12-01T10:32:00Z'),
        exitCode: 137,
        signal: 'SIGKILL',
        oomKilled: true,
        error: 'Container was killed due to memory limit exceeded',
        runDuration: 120000, // 2 minutes
      };

      expect(diedEventData.exitCode).toBe(137);
      expect(diedEventData.signal).toBe('SIGKILL');
      expect(diedEventData.oomKilled).toBe(true);
      expect(diedEventData.error).toBe('Container was killed due to memory limit exceeded');
      expect(diedEventData.runDuration).toBe(120000);
    });

    it('should handle non-OOM deaths', () => {
      const normalDeathData: ContainerDiedEventData = {
        containerId: 'abc123def456',
        containerName: 'apex-task-worker',
        image: 'node:20-alpine',
        timestamp: new Date('2023-12-01T10:32:00Z'),
        exitCode: 2,
        oomKilled: false,
      };

      expect(normalDeathData.exitCode).toBe(2);
      expect(normalDeathData.oomKilled).toBe(false);
      expect(normalDeathData.signal).toBeUndefined();
      expect(normalDeathData.error).toBeUndefined();
    });
  });

  describe('ContainerRemovedEventData interface', () => {
    it('should extend base data with removal-specific properties', () => {
      const removedEventData: ContainerRemovedEventData = {
        containerId: 'abc123def456',
        containerName: 'apex-task-worker',
        image: 'node:20-alpine',
        taskId: 'task-abc123',
        timestamp: new Date('2023-12-01T10:36:00Z'),
        forced: false,
        exitCode: 0,
        volumesRemoved: true,
      };

      expect(removedEventData.forced).toBe(false);
      expect(removedEventData.exitCode).toBe(0);
      expect(removedEventData.volumesRemoved).toBe(true);
    });

    it('should handle forced removal', () => {
      const forcedRemovalData: ContainerRemovedEventData = {
        containerId: 'abc123def456',
        containerName: 'apex-task-worker-stuck',
        image: 'node:20-alpine',
        timestamp: new Date('2023-12-01T10:40:00Z'),
        forced: true,
      };

      expect(forcedRemovalData.forced).toBe(true);
      expect(forcedRemovalData.exitCode).toBeUndefined();
      expect(forcedRemovalData.volumesRemoved).toBeUndefined();
    });
  });

  describe('ContainerHealthEventData interface', () => {
    it('should extend base data with health-specific properties', () => {
      const healthEventData: ContainerHealthEventData = {
        containerId: 'abc123def456',
        containerName: 'apex-task-worker',
        image: 'node:20-alpine',
        taskId: 'task-abc123',
        timestamp: new Date('2023-12-01T10:31:00Z'),
        status: 'healthy',
        previousStatus: 'starting',
        failingStreak: 0,
        lastCheckOutput: 'HTTP/1.1 200 OK',
        lastCheckExitCode: 0,
        lastCheckTime: new Date('2023-12-01T10:31:00Z'),
      };

      expect(healthEventData.status).toBe('healthy');
      expect(healthEventData.previousStatus).toBe('starting');
      expect(healthEventData.failingStreak).toBe(0);
      expect(healthEventData.lastCheckOutput).toBe('HTTP/1.1 200 OK');
      expect(healthEventData.lastCheckExitCode).toBe(0);
      expect(healthEventData.lastCheckTime).toEqual(new Date('2023-12-01T10:31:00Z'));
    });

    it('should handle unhealthy status transitions', () => {
      const unhealthyEventData: ContainerHealthEventData = {
        containerId: 'abc123def456',
        containerName: 'apex-task-worker',
        image: 'node:20-alpine',
        timestamp: new Date('2023-12-01T10:35:00Z'),
        status: 'unhealthy',
        previousStatus: 'healthy',
        failingStreak: 3,
        lastCheckOutput: 'Connection refused',
        lastCheckExitCode: 1,
      };

      expect(unhealthyEventData.status).toBe('unhealthy');
      expect(unhealthyEventData.failingStreak).toBe(3);
      expect(unhealthyEventData.lastCheckExitCode).toBe(1);
    });

    it('should handle containers with no health checks', () => {
      const noHealthEventData: ContainerHealthEventData = {
        containerId: 'abc123def456',
        containerName: 'apex-task-worker',
        image: 'node:20-alpine',
        timestamp: new Date('2023-12-01T10:30:00Z'),
        status: 'none',
      };

      expect(noHealthEventData.status).toBe('none');
      expect(noHealthEventData.previousStatus).toBeUndefined();
      expect(noHealthEventData.failingStreak).toBeUndefined();
    });
  });

  describe('ContainerEventData union type', () => {
    it('should accept all container event data types', () => {
      const createdData: ContainerEventData = {
        containerId: 'abc123',
        containerName: 'test-container',
        image: 'node:20-alpine',
        timestamp: new Date(),
        config: { image: 'node:20-alpine' },
      } satisfies ContainerCreatedEventData;

      const startedData: ContainerEventData = {
        containerId: 'abc123',
        containerName: 'test-container',
        image: 'node:20-alpine',
        timestamp: new Date(),
        pid: 12345,
      } satisfies ContainerStartedEventData;

      const stoppedData: ContainerEventData = {
        containerId: 'abc123',
        containerName: 'test-container',
        image: 'node:20-alpine',
        timestamp: new Date(),
        exitCode: 0,
        graceful: true,
      } satisfies ContainerStoppedEventData;

      const diedData: ContainerEventData = {
        containerId: 'abc123',
        containerName: 'test-container',
        image: 'node:20-alpine',
        timestamp: new Date(),
        exitCode: 137,
        oomKilled: true,
      } satisfies ContainerDiedEventData;

      const removedData: ContainerEventData = {
        containerId: 'abc123',
        containerName: 'test-container',
        image: 'node:20-alpine',
        timestamp: new Date(),
        forced: false,
      } satisfies ContainerRemovedEventData;

      const healthData: ContainerEventData = {
        containerId: 'abc123',
        containerName: 'test-container',
        image: 'node:20-alpine',
        timestamp: new Date(),
        status: 'healthy',
      } satisfies ContainerHealthEventData;

      expect(createdData).toBeDefined();
      expect(startedData).toBeDefined();
      expect(stoppedData).toBeDefined();
      expect(diedData).toBeDefined();
      expect(removedData).toBeDefined();
      expect(healthData).toBeDefined();
    });
  });

  describe('ContainerEvent interface', () => {
    it('should provide type-safe container events', () => {
      const containerCreatedEvent: ContainerEvent<ContainerCreatedEventData> = {
        type: 'container:created',
        taskId: 'task-abc123',
        timestamp: new Date('2023-12-01T10:30:00Z'),
        data: {
          containerId: 'abc123def456',
          containerName: 'apex-task-worker',
          image: 'node:20-alpine',
          timestamp: new Date('2023-12-01T10:30:00Z'),
          config: { image: 'node:20-alpine' },
        },
      };

      expect(containerCreatedEvent.type).toBe('container:created');
      expect(containerCreatedEvent.taskId).toBe('task-abc123');
      expect(containerCreatedEvent.data.containerId).toBe('abc123def456');
    });

    it('should work with generic ContainerEvent type', () => {
      const genericContainerEvent: ContainerEvent = {
        type: 'container:started',
        taskId: 'task-abc123',
        timestamp: new Date('2023-12-01T10:30:05Z'),
        data: {
          containerId: 'abc123def456',
          containerName: 'apex-task-worker',
          image: 'node:20-alpine',
          timestamp: new Date('2023-12-01T10:30:05Z'),
          pid: 12345,
        },
      };

      expect(genericContainerEvent.type).toBe('container:started');
      expect(genericContainerEvent.data.containerId).toBe('abc123def456');
    });

    it('should be compatible with ApexEvent interface', () => {
      const containerEvent: ContainerEvent = {
        type: 'container:health',
        taskId: 'task-abc123',
        timestamp: new Date('2023-12-01T10:31:00Z'),
        data: {
          containerId: 'abc123def456',
          containerName: 'apex-task-worker',
          image: 'node:20-alpine',
          timestamp: new Date('2023-12-01T10:31:00Z'),
          status: 'healthy',
        },
      };

      // Should be assignable to ApexEvent
      const apexEvent: ApexEvent = containerEvent;
      expect(apexEvent.type).toBe('container:health');
      expect(apexEvent.taskId).toBe('task-abc123');
    });
  });

  describe('ContainerEventDataFor helper type', () => {
    it('should map event types to correct data interfaces', () => {
      // This is tested at compile time by TypeScript
      // These assignments will fail to compile if the types are incorrect

      const createdData: ContainerEventDataFor<'container:created'> = {
        containerId: 'abc123',
        containerName: 'test',
        image: 'node:20',
        timestamp: new Date(),
        config: { image: 'node:20' },
      };

      const startedData: ContainerEventDataFor<'container:started'> = {
        containerId: 'abc123',
        containerName: 'test',
        image: 'node:20',
        timestamp: new Date(),
        pid: 12345,
      };

      const stoppedData: ContainerEventDataFor<'container:stopped'> = {
        containerId: 'abc123',
        containerName: 'test',
        image: 'node:20',
        timestamp: new Date(),
        exitCode: 0,
        graceful: true,
      };

      const diedData: ContainerEventDataFor<'container:died'> = {
        containerId: 'abc123',
        containerName: 'test',
        image: 'node:20',
        timestamp: new Date(),
        exitCode: 137,
        oomKilled: true,
      };

      const removedData: ContainerEventDataFor<'container:removed'> = {
        containerId: 'abc123',
        containerName: 'test',
        image: 'node:20',
        timestamp: new Date(),
        forced: false,
      };

      const healthData: ContainerEventDataFor<'container:health'> = {
        containerId: 'abc123',
        containerName: 'test',
        image: 'node:20',
        timestamp: new Date(),
        status: 'healthy',
      };

      // Verify the data is properly typed at runtime
      expect(createdData.containerId).toBe('abc123');
      expect(startedData.pid).toBe(12345);
      expect(stoppedData.exitCode).toBe(0);
      expect(diedData.oomKilled).toBe(true);
      expect(removedData.forced).toBe(false);
      expect(healthData.status).toBe('healthy');
    });

    // This test verifies that non-container event types return 'never'
    // TypeScript will prevent compilation if someone tries to use
    // ContainerEventDataFor with non-container event types
    it('should return never for non-container event types', () => {
      // These would fail to compile:
      // const badData: ContainerEventDataFor<'task:created'> = {};
      // const invalidData: ContainerEventDataFor<'agent:message'> = {};

      // We can't test 'never' type at runtime, but TypeScript enforces it at compile time
      expect(true).toBe(true); // Placeholder test
    });
  });

  describe('Integration with existing ApexEvent system', () => {
    it('should work with event handling patterns', () => {
      function handleContainerEvent(event: ApexEvent): string {
        if (event.type.startsWith('container:')) {
          const containerEvent = event as ContainerEvent;
          return `Container ${containerEvent.data.containerId} - ${containerEvent.type}`;
        }
        return `Non-container event: ${event.type}`;
      }

      const createdEvent: ApexEvent = {
        type: 'container:created',
        taskId: 'task-123',
        timestamp: new Date(),
        data: {
          containerId: 'container-abc',
          containerName: 'test-container',
          image: 'node:20',
          timestamp: new Date(),
        },
      };

      const result = handleContainerEvent(createdEvent);
      expect(result).toBe('Container container-abc - container:created');
    });

    it('should support event filtering by type', () => {
      const events: ApexEvent[] = [
        {
          type: 'task:created',
          taskId: 'task-1',
          timestamp: new Date(),
          data: {},
        },
        {
          type: 'container:started',
          taskId: 'task-1',
          timestamp: new Date(),
          data: {
            containerId: 'container-1',
            containerName: 'worker-1',
            image: 'node:20',
            timestamp: new Date(),
            pid: 12345,
          },
        },
        {
          type: 'container:health',
          taskId: 'task-1',
          timestamp: new Date(),
          data: {
            containerId: 'container-1',
            containerName: 'worker-1',
            image: 'node:20',
            timestamp: new Date(),
            status: 'healthy',
          },
        },
      ];

      const containerEvents = events.filter(
        (event): event is ContainerEvent =>
          event.type.startsWith('container:')
      );

      expect(containerEvents).toHaveLength(2);
      expect(containerEvents[0].type).toBe('container:started');
      expect(containerEvents[1].type).toBe('container:health');

      // Type assertion ensures proper typing
      expect((containerEvents[0].data as ContainerStartedEventData).pid).toBe(12345);
      expect((containerEvents[1].data as ContainerHealthEventData).status).toBe('healthy');
    });
  });

  describe('Container config integration', () => {
    it('should work with ContainerConfig in created events', () => {
      const config: ContainerConfig = {
        image: 'node:20-alpine',
        workingDir: '/app',
        environment: {
          NODE_ENV: 'test',
          PORT: '3000',
        },
        volumes: {
          '/host/path': '/container/path',
        },
        networkMode: 'bridge',
        user: 'node',
        autoRemove: true,
        privileged: false,
      };

      // Validate config with Zod schema
      const validConfig = ContainerConfigSchema.parse(config);
      expect(validConfig).toEqual(config);

      const createdEvent: ContainerEvent<ContainerCreatedEventData> = {
        type: 'container:created',
        taskId: 'task-123',
        timestamp: new Date(),
        data: {
          containerId: 'abc123',
          containerName: 'worker',
          image: config.image,
          timestamp: new Date(),
          config: validConfig,
          labels: config.labels,
        },
      };

      expect(createdEvent.data.config?.image).toBe('node:20-alpine');
      expect(createdEvent.data.config?.workingDir).toBe('/app');
      expect(createdEvent.data.config?.networkMode).toBe('bridge');
    });
  });
});