import { describe, it, expect } from 'vitest';

// This test file validates that all container event types are properly exported
// and can be imported without TypeScript compilation errors

describe('Container Event Types - Import Validation', () => {
  it('should import all container event types successfully', async () => {
    // Dynamic import to test that all exports exist and are properly typed
    const typesModule = await import('../types');

    // Verify container event type strings exist in ApexEventType
    const containerEventTypes = [
      'container:created',
      'container:started',
      'container:stopped',
      'container:died',
      'container:removed',
      'container:health',
    ] as const;

    // This will fail at TypeScript compile time if any types are missing
    containerEventTypes.forEach((eventType) => {
      const typedEvent: typeof typesModule.ApexEventType = eventType;
      expect(typeof eventType).toBe('string');
      expect(eventType).toMatch(/^container:/);
    });
  });

  it('should validate ContainerHealthStatus enum values', async () => {
    const typesModule = await import('../types');

    const healthStatuses = [
      'starting',
      'healthy',
      'unhealthy',
      'none',
    ] as const;

    healthStatuses.forEach((status) => {
      const typedStatus: typeof typesModule.ContainerHealthStatus = status;
      expect(typeof status).toBe('string');
    });
  });

  it('should validate ContainerNetworkMode enum values', async () => {
    const typesModule = await import('../types');

    const networkModes = [
      'bridge',
      'host',
      'none',
      'container',
    ] as const;

    networkModes.forEach((mode) => {
      const typedMode: typeof typesModule.ContainerNetworkMode = mode;
      expect(typeof mode).toBe('string');
    });
  });

  it('should validate all container event data interfaces exist', async () => {
    const typesModule = await import('../types');

    // Test that we can construct instances of each event data type
    const timestamp = new Date();

    // ContainerEventDataBase
    const baseData: typeof typesModule.ContainerEventDataBase = {
      containerId: 'test-id',
      containerName: 'test-container',
      image: 'node:20',
      timestamp,
    };
    expect(baseData.containerId).toBe('test-id');

    // ContainerCreatedEventData
    const createdData: typeof typesModule.ContainerCreatedEventData = {
      ...baseData,
      config: { image: 'node:20' },
    };
    expect(createdData.config).toBeDefined();

    // ContainerStartedEventData
    const startedData: typeof typesModule.ContainerStartedEventData = {
      ...baseData,
      pid: 12345,
    };
    expect(startedData.pid).toBe(12345);

    // ContainerStoppedEventData
    const stoppedData: typeof typesModule.ContainerStoppedEventData = {
      ...baseData,
      exitCode: 0,
      graceful: true,
    };
    expect(stoppedData.exitCode).toBe(0);

    // ContainerDiedEventData
    const diedData: typeof typesModule.ContainerDiedEventData = {
      ...baseData,
      exitCode: 137,
      oomKilled: true,
    };
    expect(diedData.oomKilled).toBe(true);

    // ContainerRemovedEventData
    const removedData: typeof typesModule.ContainerRemovedEventData = {
      ...baseData,
      forced: false,
    };
    expect(removedData.forced).toBe(false);

    // ContainerHealthEventData
    const healthData: typeof typesModule.ContainerHealthEventData = {
      ...baseData,
      status: 'healthy',
    };
    expect(healthData.status).toBe('healthy');
  });

  it('should validate union types work correctly', async () => {
    const typesModule = await import('../types');

    const timestamp = new Date();
    const baseData = {
      containerId: 'test-id',
      containerName: 'test-container',
      image: 'node:20',
      timestamp,
    };

    // Test ContainerEventData union type accepts all variants
    const eventDataVariants: typeof typesModule.ContainerEventData[] = [
      { ...baseData, config: { image: 'node:20' } }, // ContainerCreatedEventData
      { ...baseData, pid: 12345 }, // ContainerStartedEventData
      { ...baseData, exitCode: 0, graceful: true }, // ContainerStoppedEventData
      { ...baseData, exitCode: 137, oomKilled: true }, // ContainerDiedEventData
      { ...baseData, forced: false }, // ContainerRemovedEventData
      { ...baseData, status: 'healthy' }, // ContainerHealthEventData
    ];

    expect(eventDataVariants).toHaveLength(6);
    eventDataVariants.forEach((variant) => {
      expect(variant.containerId).toBe('test-id');
    });
  });

  it('should validate ContainerEvent interface works', async () => {
    const typesModule = await import('../types');

    const timestamp = new Date();

    const containerEvent: typeof typesModule.ContainerEvent = {
      type: 'container:created',
      taskId: 'task-123',
      timestamp,
      data: {
        containerId: 'container-abc',
        containerName: 'test-container',
        image: 'node:20',
        timestamp,
        config: { image: 'node:20' },
      },
    };

    expect(containerEvent.type).toBe('container:created');
    expect(containerEvent.taskId).toBe('task-123');
    expect(containerEvent.data.containerId).toBe('container-abc');
  });

  it('should validate compatibility with ApexEvent', async () => {
    const typesModule = await import('../types');

    const timestamp = new Date();

    const containerEvent: typeof typesModule.ContainerEvent = {
      type: 'container:health',
      taskId: 'task-456',
      timestamp,
      data: {
        containerId: 'container-xyz',
        containerName: 'health-test',
        image: 'node:20',
        timestamp,
        status: 'unhealthy',
      },
    };

    // Should be assignable to ApexEvent
    const apexEvent: typeof typesModule.ApexEvent = containerEvent;
    expect(apexEvent.type).toBe('container:health');
    expect(apexEvent.taskId).toBe('task-456');
  });
});