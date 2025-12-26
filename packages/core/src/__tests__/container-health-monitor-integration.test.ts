import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { ContainerHealthMonitor } from '../container-health-monitor';
import { ContainerManager } from '../container-manager';
import { ContainerInfo, ContainerStats, ContainerEventData } from '../types';

// Mock ContainerManager that extends EventEmitter properly
class MockContainerManager extends EventEmitter {
  runtime = {
    getBestRuntime: vi.fn(),
  };
  getContainerInfo = vi.fn();
  listApexContainers = vi.fn();
  getStats = vi.fn();
}

describe('ContainerHealthMonitor Integration', () => {
  let healthMonitor: ContainerHealthMonitor;
  let mockContainerManager: MockContainerManager;

  const mockContainerInfo: ContainerInfo = {
    id: 'test-container-id',
    name: 'apex-task-12345',
    image: 'node:18',
    status: 'running',
    createdAt: new Date('2024-01-01T12:00:00Z'),
    startedAt: new Date('2024-01-01T12:00:05Z'),
  };

  const mockStats: ContainerStats = {
    cpuPercent: 15.5,
    memoryUsage: 512 * 1024 * 1024, // 512MB
    memoryLimit: 1024 * 1024 * 1024, // 1GB
    memoryPercent: 50.0,
    networkRxBytes: 1024,
    networkTxBytes: 2048,
    blockReadBytes: 4096,
    blockWriteBytes: 8192,
    pids: 42,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockContainerManager = new MockContainerManager();

    // Setup default mock implementations
    mockContainerManager.runtime.getBestRuntime.mockResolvedValue('docker');
    mockContainerManager.getContainerInfo.mockResolvedValue(mockContainerInfo);
    mockContainerManager.listApexContainers.mockResolvedValue([mockContainerInfo]);
    mockContainerManager.getStats.mockResolvedValue(mockStats);

    healthMonitor = new ContainerHealthMonitor(mockContainerManager as unknown as ContainerManager, {
      interval: 1000, // 1 second for fast tests
      maxFailures: 2,
      timeout: 500,
      autoStart: false, // Don't auto-start for tests
    });
  });

  afterEach(async () => {
    if (healthMonitor.isActive()) {
      await healthMonitor.stopMonitoring();
    }
  });

  describe('Container Lifecycle Event Integration', () => {
    beforeEach(async () => {
      await healthMonitor.startMonitoring();
    });

    it('should handle container:created event and add container to monitoring', async () => {
      const healthEventSpy = vi.fn();
      healthMonitor.on('container:health', healthEventSpy);

      // Simulate container creation with APEX naming
      const createdEvent: ContainerEventData = {
        containerId: 'new-container-id',
        containerName: 'apex-task-67890',
        image: 'node:18',
        taskId: '67890',
        timestamp: new Date(),
        containerInfo: {
          ...mockContainerInfo,
          id: 'new-container-id',
          name: 'apex-task-67890',
        },
      };

      // Mock the container info for the new container
      mockContainerManager.getContainerInfo.mockImplementation((id: string) => {
        if (id === 'new-container-id') {
          return Promise.resolve(createdEvent.containerInfo!);
        }
        return Promise.resolve(mockContainerInfo);
      });

      // Emit the container created event
      mockContainerManager.emit('container:created', createdEvent);

      // Give the event handler time to process
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify container was added to monitoring
      const health = healthMonitor.getContainerHealth('new-container-id');
      expect(health).toBeDefined();
    });

    it('should handle container:started event and reset health status', async () => {
      // First add a container
      await healthMonitor.addContainer('test-container-id');

      // Make it unhealthy
      mockContainerManager.getStats.mockResolvedValue(null);
      await healthMonitor.checkContainerHealth('test-container-id');
      await healthMonitor.checkContainerHealth('test-container-id'); // Second failure to make unhealthy

      expect(healthMonitor.getContainerHealth('test-container-id')?.status).toBe('unhealthy');

      const healthEventSpy = vi.fn();
      healthMonitor.on('container:health', healthEventSpy);

      // Simulate container restart
      const startedEvent: ContainerEventData = {
        containerId: 'test-container-id',
        containerName: 'apex-task-12345',
        image: 'node:18',
        taskId: '12345',
        timestamp: new Date(),
      };

      mockContainerManager.emit('container:started', startedEvent);

      // Verify status was reset to starting
      const health = healthMonitor.getContainerHealth('test-container-id');
      expect(health?.status).toBe('starting');
      expect(health?.failingStreak).toBe(0);

      expect(healthEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        status: 'starting',
        failingStreak: 0,
      }));
    });

    it('should handle container:stopped event and remove from monitoring', async () => {
      // First add a container
      await healthMonitor.addContainer('test-container-id');
      expect(healthMonitor.getContainerHealth('test-container-id')).toBeDefined();

      // Simulate container stop
      const stoppedEvent: ContainerEventData = {
        containerId: 'test-container-id',
        containerName: 'apex-task-12345',
        image: 'node:18',
        taskId: '12345',
        timestamp: new Date(),
      };

      mockContainerManager.emit('container:stopped', stoppedEvent);

      // Verify container was removed from monitoring
      expect(healthMonitor.getContainerHealth('test-container-id')).toBeNull();
    });

    it('should handle container:removed event and remove from monitoring', async () => {
      // First add a container
      await healthMonitor.addContainer('test-container-id');
      expect(healthMonitor.getContainerHealth('test-container-id')).toBeDefined();

      // Simulate container removal
      const removedEvent: ContainerEventData = {
        containerId: 'test-container-id',
        containerName: 'apex-task-12345',
        image: 'node:18',
        taskId: '12345',
        timestamp: new Date(),
      };

      mockContainerManager.emit('container:removed', removedEvent);

      // Verify container was removed from monitoring
      expect(healthMonitor.getContainerHealth('test-container-id')).toBeNull();
    });

    it('should handle container:died event and mark as unhealthy', async () => {
      // First add a container
      await healthMonitor.addContainer('test-container-id');

      const healthEventSpy = vi.fn();
      healthMonitor.on('container:health', healthEventSpy);

      // Simulate container death
      const diedEvent = {
        containerId: 'test-container-id',
        containerName: 'apex-task-12345',
        image: 'node:18',
        taskId: '12345',
        timestamp: new Date(),
        exitCode: 137, // Killed by SIGKILL
        oomKilled: false,
      };

      mockContainerManager.emit('container:died', diedEvent);

      // Verify container was marked as unhealthy
      const health = healthMonitor.getContainerHealth('test-container-id');
      expect(health?.status).toBe('unhealthy');
      expect(health?.failingStreak).toBe(2); // Max failures
      expect(health?.error).toContain('Container died unexpectedly');
      expect(health?.error).toContain('exit code: 137');

      expect(healthEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        status: 'unhealthy',
        failingStreak: 2,
      }));
    });
  });

  describe('Full Lifecycle Scenario', () => {
    it('should handle complete container lifecycle from creation to removal', async () => {
      await healthMonitor.startMonitoring();

      const healthEvents: any[] = [];
      healthMonitor.on('container:health', (event) => healthEvents.push(event));

      // 1. Container created
      mockContainerManager.emit('container:created', {
        containerId: 'lifecycle-container',
        containerName: 'apex-lifecycle-test',
        image: 'alpine:latest',
        taskId: 'lifecycle',
        timestamp: new Date(),
        containerInfo: {
          ...mockContainerInfo,
          id: 'lifecycle-container',
          name: 'apex-lifecycle-test',
        },
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // 2. Container started
      mockContainerManager.emit('container:started', {
        containerId: 'lifecycle-container',
        containerName: 'apex-lifecycle-test',
        image: 'alpine:latest',
        taskId: 'lifecycle',
        timestamp: new Date(),
      });

      // 3. Simulate health check (should be healthy)
      mockContainerManager.getContainerInfo.mockResolvedValue({
        ...mockContainerInfo,
        id: 'lifecycle-container',
        name: 'apex-lifecycle-test',
      });

      await healthMonitor.checkContainerHealth('lifecycle-container');

      // 4. Simulate container getting unhealthy
      mockContainerManager.getStats.mockResolvedValue({
        ...mockStats,
        memoryPercent: 98, // High memory usage
      });

      await healthMonitor.checkContainerHealth('lifecycle-container');
      await healthMonitor.checkContainerHealth('lifecycle-container'); // Second failure

      // 5. Container dies
      mockContainerManager.emit('container:died', {
        containerId: 'lifecycle-container',
        containerName: 'apex-lifecycle-test',
        image: 'alpine:latest',
        taskId: 'lifecycle',
        timestamp: new Date(),
        exitCode: 1,
        oomKilled: false,
      });

      // 6. Container removed
      mockContainerManager.emit('container:removed', {
        containerId: 'lifecycle-container',
        containerName: 'apex-lifecycle-test',
        image: 'alpine:latest',
        taskId: 'lifecycle',
        timestamp: new Date(),
      });

      // Verify the complete lifecycle was tracked
      expect(healthEvents.length).toBeGreaterThan(0);

      // Container should no longer be monitored
      expect(healthMonitor.getContainerHealth('lifecycle-container')).toBeNull();

      // Verify stats show no containers
      const stats = healthMonitor.getStats();
      expect(stats.totalContainers).toBe(0);
    });
  });

  describe('Event Filtering and Monitoring Scope', () => {
    beforeEach(async () => {
      await healthMonitor.startMonitoring();
    });

    it('should only monitor containers with matching prefix', async () => {
      // Create containers with different names
      const apexContainer = {
        containerId: 'apex-container',
        containerName: 'apex-task-123',
        image: 'node:18',
        taskId: '123',
        timestamp: new Date(),
        containerInfo: {
          ...mockContainerInfo,
          id: 'apex-container',
          name: 'apex-task-123',
        },
      };

      const otherContainer = {
        containerId: 'other-container',
        containerName: 'other-service',
        image: 'nginx:latest',
        taskId: undefined,
        timestamp: new Date(),
        containerInfo: {
          ...mockContainerInfo,
          id: 'other-container',
          name: 'other-service',
        },
      };

      // Mock container info responses
      mockContainerManager.getContainerInfo.mockImplementation((id: string) => {
        if (id === 'apex-container') return Promise.resolve(apexContainer.containerInfo!);
        if (id === 'other-container') return Promise.resolve(otherContainer.containerInfo!);
        return Promise.resolve(null);
      });

      // Emit creation events
      mockContainerManager.emit('container:created', apexContainer);
      mockContainerManager.emit('container:created', otherContainer);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Only APEX container should be monitored
      expect(healthMonitor.getContainerHealth('apex-container')).toBeDefined();
      expect(healthMonitor.getContainerHealth('other-container')).toBeNull();
    });

    it('should monitor all containers when monitorAll is enabled', async () => {
      const monitorAllHealthMonitor = new ContainerHealthMonitor(
        mockContainerManager as unknown as ContainerManager,
        {
          monitorAll: true,
          autoStart: false,
        }
      );

      await monitorAllHealthMonitor.startMonitoring();

      const apexContainer = {
        containerId: 'apex-container',
        containerName: 'apex-task-123',
        image: 'node:18',
        taskId: '123',
        timestamp: new Date(),
        containerInfo: {
          ...mockContainerInfo,
          id: 'apex-container',
          name: 'apex-task-123',
        },
      };

      const otherContainer = {
        containerId: 'other-container',
        containerName: 'other-service',
        image: 'nginx:latest',
        taskId: undefined,
        timestamp: new Date(),
        containerInfo: {
          ...mockContainerInfo,
          id: 'other-container',
          name: 'other-service',
        },
      };

      // Mock container info responses
      mockContainerManager.getContainerInfo.mockImplementation((id: string) => {
        if (id === 'apex-container') return Promise.resolve(apexContainer.containerInfo!);
        if (id === 'other-container') return Promise.resolve(otherContainer.containerInfo!);
        return Promise.resolve(null);
      });

      // Emit creation events
      mockContainerManager.emit('container:created', apexContainer);
      mockContainerManager.emit('container:created', otherContainer);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Both containers should be monitored
      expect(monitorAllHealthMonitor.getContainerHealth('apex-container')).toBeDefined();
      expect(monitorAllHealthMonitor.getContainerHealth('other-container')).toBeDefined();

      await monitorAllHealthMonitor.stopMonitoring();
    });
  });

  describe('Error Recovery and Resilience', () => {
    beforeEach(async () => {
      await healthMonitor.startMonitoring();
    });

    it('should recover from transient container manager errors', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Add container successfully
      await healthMonitor.addContainer('test-container-id');
      expect(healthMonitor.getContainerHealth('test-container-id')).toBeDefined();

      // Simulate container manager error
      const createdEvent = {
        containerId: 'error-container',
        containerName: 'apex-error-test',
        image: 'node:18',
        taskId: 'error',
        timestamp: new Date(),
        containerInfo: {
          ...mockContainerInfo,
          id: 'error-container',
          name: 'apex-error-test',
        },
      };

      // Make addContainer fail temporarily
      const originalAddContainer = healthMonitor.addContainer.bind(healthMonitor);
      const addContainerSpy = vi.spyOn(healthMonitor, 'addContainer')
        .mockRejectedValueOnce(new Error('Container manager unavailable'))
        .mockImplementation(originalAddContainer);

      mockContainerManager.emit('container:created', createdEvent);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should have logged the error but continued operating
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to add container'),
        expect.any(Error)
      );

      // Original container should still be monitored
      expect(healthMonitor.getContainerHealth('test-container-id')).toBeDefined();

      consoleSpy.mockRestore();
    });
  });
});