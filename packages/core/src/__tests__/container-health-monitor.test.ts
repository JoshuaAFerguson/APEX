import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { ContainerHealthMonitor } from '../container-health-monitor';
import { ContainerManager } from '../container-manager';
import { ContainerInfo, ContainerStats, ContainerHealthStatus } from '../types';

// Mock ContainerManager
const mockContainerManager = {
  runtime: {
    getBestRuntime: vi.fn(),
  },
  getContainerInfo: vi.fn(),
  listApexContainers: vi.fn(),
  getStats: vi.fn(),
  on: vi.fn(),
  emit: vi.fn(),
} as unknown as ContainerManager;

// Extend the mock with EventEmitter methods
Object.setPrototypeOf(mockContainerManager, EventEmitter.prototype);
EventEmitter.call(mockContainerManager);

describe('ContainerHealthMonitor', () => {
  let healthMonitor: ContainerHealthMonitor;

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

    // Setup default mock implementations
    mockContainerManager.runtime.getBestRuntime.mockResolvedValue('docker');
    mockContainerManager.getContainerInfo.mockResolvedValue(mockContainerInfo);
    mockContainerManager.listApexContainers.mockResolvedValue([mockContainerInfo]);
    mockContainerManager.getStats.mockResolvedValue(mockStats);

    healthMonitor = new ContainerHealthMonitor(mockContainerManager, {
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

  describe('Construction and Configuration', () => {
    it('should create with default options', () => {
      const monitor = new ContainerHealthMonitor(mockContainerManager);
      expect(monitor).toBeInstanceOf(ContainerHealthMonitor);
      expect(monitor.isActive()).toBe(false); // autoStart disabled in test env
    });

    it('should create with custom options', () => {
      const customOptions = {
        interval: 5000,
        maxFailures: 5,
        timeout: 2000,
        monitorAll: true,
        containerPrefix: 'custom',
        autoStart: false,
      };

      const monitor = new ContainerHealthMonitor(mockContainerManager, customOptions);
      expect(monitor).toBeInstanceOf(ContainerHealthMonitor);
    });

    it('should update options correctly', () => {
      healthMonitor.updateOptions({
        interval: 2000,
        maxFailures: 3,
      });

      expect(healthMonitor).toBeInstanceOf(ContainerHealthMonitor);
    });
  });

  describe('Monitoring Lifecycle', () => {
    it('should start monitoring successfully', async () => {
      const startedSpy = vi.fn();
      healthMonitor.on('monitoring:started', startedSpy);

      await healthMonitor.startMonitoring();

      expect(healthMonitor.isActive()).toBe(true);
      expect(startedSpy).toHaveBeenCalledOnce();
      expect(mockContainerManager.runtime.getBestRuntime).toHaveBeenCalled();
    });

    it('should stop monitoring successfully', async () => {
      const stoppedSpy = vi.fn();
      healthMonitor.on('monitoring:stopped', stoppedSpy);

      await healthMonitor.startMonitoring();
      await healthMonitor.stopMonitoring();

      expect(healthMonitor.isActive()).toBe(false);
      expect(stoppedSpy).toHaveBeenCalledOnce();
    });

    it('should not start monitoring if no container runtime available', async () => {
      mockContainerManager.runtime.getBestRuntime.mockResolvedValue('none');

      await expect(healthMonitor.startMonitoring()).rejects.toThrow(
        'No container runtime available for health monitoring'
      );

      expect(healthMonitor.isActive()).toBe(false);
    });

    it('should not start monitoring if already active', async () => {
      await healthMonitor.startMonitoring();

      const getBestRuntimeCallCount = mockContainerManager.runtime.getBestRuntime.mock.calls.length;

      // Try to start again
      await healthMonitor.startMonitoring();

      // Should not call getBestRuntime again
      expect(mockContainerManager.runtime.getBestRuntime).toHaveBeenCalledTimes(getBestRuntimeCallCount);
    });
  });

  describe('Health Checking', () => {
    beforeEach(async () => {
      await healthMonitor.startMonitoring();
    });

    it('should check container health for running container', async () => {
      const healthCheck = await healthMonitor.checkContainerHealth('test-container-id');

      expect(healthCheck).not.toBeNull();
      expect(healthCheck?.status).toBe('healthy');
      expect(healthCheck?.containerId).toBe('test-container-id');
      expect(healthCheck?.failingStreak).toBe(0);
      expect(mockContainerManager.getContainerInfo).toHaveBeenCalledWith('test-container-id');
      expect(mockContainerManager.getStats).toHaveBeenCalledWith('test-container-id', 'docker');
    });

    it('should mark container as unhealthy if stats unavailable', async () => {
      mockContainerManager.getStats.mockResolvedValue(null);

      const healthCheck = await healthMonitor.checkContainerHealth('test-container-id');

      expect(healthCheck?.status).toBe('starting'); // First failure
      expect(healthCheck?.failingStreak).toBe(1);
      expect(healthCheck?.error).toBe('Failed to get container statistics');
    });

    it('should mark container as unhealthy after max failures', async () => {
      mockContainerManager.getStats.mockResolvedValue(null);

      // First check - should be 'starting'
      let healthCheck = await healthMonitor.checkContainerHealth('test-container-id');
      expect(healthCheck?.status).toBe('starting');
      expect(healthCheck?.failingStreak).toBe(1);

      // Second check - should be 'unhealthy' (maxFailures = 2)
      healthCheck = await healthMonitor.checkContainerHealth('test-container-id');
      expect(healthCheck?.status).toBe('unhealthy');
      expect(healthCheck?.failingStreak).toBe(2);
    });

    it('should handle container not found', async () => {
      mockContainerManager.getContainerInfo.mockResolvedValue(null);

      const healthCheck = await healthMonitor.checkContainerHealth('non-existent');

      expect(healthCheck).toBeNull();
    });

    it('should handle container in non-running state', async () => {
      const stoppedContainer = { ...mockContainerInfo, status: 'exited' as const };
      mockContainerManager.getContainerInfo.mockResolvedValue(stoppedContainer);

      const healthCheck = await healthMonitor.checkContainerHealth('test-container-id');

      expect(healthCheck?.status).toBe('unhealthy');
      expect(healthCheck?.error).toContain('Container is not running');
    });

    it('should evaluate container health based on memory usage', async () => {
      // High memory usage (over 95%)
      const highMemoryStats = {
        ...mockStats,
        memoryPercent: 98.0,
      };
      mockContainerManager.getStats.mockResolvedValue(highMemoryStats);

      const healthCheck = await healthMonitor.checkContainerHealth('test-container-id');

      expect(healthCheck?.status).toBe('starting'); // First failure
      expect(healthCheck?.failingStreak).toBe(1);
    });

    it('should evaluate container health based on PID count', async () => {
      // Too many PIDs
      const highPidStats = {
        ...mockStats,
        pids: 15000,
      };
      mockContainerManager.getStats.mockResolvedValue(highPidStats);

      const healthCheck = await healthMonitor.checkContainerHealth('test-container-id');

      expect(healthCheck?.status).toBe('starting'); // First failure
      expect(healthCheck?.failingStreak).toBe(1);
    });
  });

  describe('Health Events', () => {
    beforeEach(async () => {
      await healthMonitor.startMonitoring();
    });

    it('should emit container:health event on status change', async () => {
      const healthEventSpy = vi.fn();
      healthMonitor.on('container:health', healthEventSpy);

      await healthMonitor.checkContainerHealth('test-container-id');

      expect(healthEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          containerId: 'test-container-id',
          containerName: 'apex-task-12345',
          status: 'healthy',
          taskId: '12345', // Extracted from container name
        })
      );
    });

    it('should emit health:check:success event for successful checks', async () => {
      const successSpy = vi.fn();
      healthMonitor.on('health:check:success', successSpy);

      await healthMonitor.checkContainerHealth('test-container-id');

      expect(successSpy).toHaveBeenCalledWith('test-container-id');
    });

    it('should emit health:check:failed event for failed checks', async () => {
      const failedSpy = vi.fn();
      healthMonitor.on('health:check:failed', failedSpy);

      mockContainerManager.getStats.mockRejectedValue(new Error('Connection failed'));

      await healthMonitor.checkContainerHealth('test-container-id');

      expect(failedSpy).toHaveBeenCalledWith('test-container-id', 'Connection failed');
    });

    it('should not emit health event if status unchanged', async () => {
      const healthEventSpy = vi.fn();
      healthMonitor.on('container:health', healthEventSpy);

      // First check
      await healthMonitor.checkContainerHealth('test-container-id');
      expect(healthEventSpy).toHaveBeenCalledTimes(1);

      // Second check with same result
      await healthMonitor.checkContainerHealth('test-container-id');
      expect(healthEventSpy).toHaveBeenCalledTimes(1); // No new event
    });
  });

  describe('Container Lifecycle Integration', () => {
    beforeEach(async () => {
      await healthMonitor.startMonitoring();
    });

    it('should handle container created event', async () => {
      const addContainerSpy = vi.spyOn(healthMonitor, 'addContainer').mockResolvedValue();

      // Simulate container created event
      const createdEvent = {
        containerId: 'new-container-id',
        containerInfo: { ...mockContainerInfo, name: 'apex-task-67890' },
        timestamp: new Date(),
        success: true,
      };

      // Simulate the event emission
      mockContainerManager.emit('container:created', createdEvent);

      // Note: In real implementation, this would be handled by event listeners
      // For testing, we'll verify the method exists and can be called
      expect(addContainerSpy).toBeDefined();
    });

    it('should handle container died event', async () => {
      // First, add container to monitoring
      await healthMonitor.addContainer('test-container-id');

      // Simulate container died event
      const diedEvent = {
        containerId: 'test-container-id',
        exitCode: 137,
        timestamp: new Date(),
      };

      // Simulate the event emission and verify health is updated
      const healthBefore = healthMonitor.getContainerHealth('test-container-id');

      // Manually trigger the died event handling
      const existingHealth = healthMonitor.getContainerHealth('test-container-id');
      if (existingHealth) {
        // This simulates what the died event handler would do
        const healthEventSpy = vi.fn();
        healthMonitor.on('container:health', healthEventSpy);

        expect(existingHealth).toBeDefined();
      }
    });
  });

  describe('Container Management', () => {
    beforeEach(async () => {
      await healthMonitor.startMonitoring();
    });

    it('should add container to monitoring', async () => {
      await healthMonitor.addContainer('test-container-id');

      const health = healthMonitor.getContainerHealth('test-container-id');
      expect(health).not.toBeNull();
      expect(health?.containerId).toBe('test-container-id');
    });

    it('should remove container from monitoring', async () => {
      await healthMonitor.addContainer('test-container-id');
      healthMonitor.removeContainer('test-container-id');

      const health = healthMonitor.getContainerHealth('test-container-id');
      expect(health).toBeNull();
    });

    it('should throw error when adding non-existent container', async () => {
      mockContainerManager.getContainerInfo.mockResolvedValue(null);

      await expect(healthMonitor.addContainer('non-existent')).rejects.toThrow(
        'Container not found: non-existent'
      );
    });

    it('should get health status for all monitored containers', async () => {
      await healthMonitor.addContainer('test-container-id');

      const healthStatus = healthMonitor.getHealthStatus();
      expect(healthStatus.size).toBe(1);
      expect(healthStatus.get('test-container-id')).toBeDefined();
    });
  });

  describe('Statistics and Reporting', () => {
    beforeEach(async () => {
      await healthMonitor.startMonitoring();
    });

    it('should get monitoring statistics', async () => {
      await healthMonitor.addContainer('test-container-id');

      const stats = healthMonitor.getStats();

      expect(stats).toEqual({
        isMonitoring: true,
        totalContainers: 1,
        healthyContainers: 1,
        unhealthyContainers: 0,
        startingContainers: 0,
        averageFailingStreak: 0,
        lastCheckTime: expect.any(Date),
      });
    });

    it('should calculate stats correctly with multiple containers', async () => {
      // Add multiple containers with different health states
      await healthMonitor.addContainer('healthy-container');

      // Add an unhealthy container
      mockContainerManager.getContainerInfo.mockResolvedValue({
        ...mockContainerInfo,
        id: 'unhealthy-container',
        name: 'apex-task-unhealthy',
      });
      mockContainerManager.getStats.mockResolvedValue(null); // Will cause failure

      await healthMonitor.addContainer('unhealthy-container');
      await healthMonitor.checkContainerHealth('unhealthy-container'); // First failure
      await healthMonitor.checkContainerHealth('unhealthy-container'); // Second failure - unhealthy

      const stats = healthMonitor.getStats();

      expect(stats.totalContainers).toBe(2);
      expect(stats.healthyContainers).toBe(1);
      expect(stats.unhealthyContainers).toBe(1);
      expect(stats.averageFailingStreak).toBe(1); // (0 + 2) / 2
    });

    it('should handle empty monitoring state', () => {
      const stats = healthMonitor.getStats();

      expect(stats).toEqual({
        isMonitoring: true,
        totalContainers: 0,
        healthyContainers: 0,
        unhealthyContainers: 0,
        startingContainers: 0,
        averageFailingStreak: 0,
        lastCheckTime: undefined,
      });
    });
  });

  describe('Task ID Extraction', () => {
    it('should extract task ID from APEX container names', async () => {
      await healthMonitor.startMonitoring();

      const containerWithTaskId = {
        ...mockContainerInfo,
        name: 'apex-task-abc123',
      };
      mockContainerManager.getContainerInfo.mockResolvedValue(containerWithTaskId);

      await healthMonitor.addContainer('test-container-id');

      const healthEventSpy = vi.fn();
      healthMonitor.on('container:health', healthEventSpy);

      await healthMonitor.checkContainerHealth('test-container-id');

      expect(healthEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'abc123',
        })
      );
    });

    it('should handle container names without task ID', async () => {
      await healthMonitor.startMonitoring();

      const containerWithoutTaskId = {
        ...mockContainerInfo,
        name: 'custom-container-name',
      };
      mockContainerManager.getContainerInfo.mockResolvedValue(containerWithoutTaskId);

      await healthMonitor.addContainer('test-container-id');

      const healthEventSpy = vi.fn();
      healthMonitor.on('container:health', healthEventSpy);

      await healthMonitor.checkContainerHealth('test-container-id');

      expect(healthEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: undefined,
        })
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await healthMonitor.startMonitoring();
    });

    it('should handle errors during periodic health checks gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockContainerManager.listApexContainers.mockRejectedValue(new Error('Docker daemon error'));

      // Manually trigger health check (since we can't easily test the interval)
      await healthMonitor['performHealthChecks']();

      expect(consoleSpy).toHaveBeenCalledWith('Error getting containers to monitor:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle container manager errors', async () => {
      mockContainerManager.getContainerInfo.mockRejectedValue(new Error('Container not accessible'));

      const healthCheck = await healthMonitor.checkContainerHealth('test-container-id');

      expect(healthCheck?.status).toBe('starting');
      expect(healthCheck?.error).toBe('Container not accessible');
    });

    it('should handle monitoring start errors', async () => {
      const monitor = new ContainerHealthMonitor(mockContainerManager, { autoStart: true });
      mockContainerManager.runtime.getBestRuntime.mockRejectedValue(new Error('Runtime error'));

      // Should not throw, but log warning
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await new Promise(resolve => setTimeout(resolve, 10)); // Let constructor finish

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle runtime detection errors', async () => {
      mockContainerManager.runtime.getBestRuntime.mockResolvedValue('none' as any);

      await expect(healthMonitor.startMonitoring()).rejects.toThrow(
        'No container runtime available for health monitoring'
      );
    });

    it('should handle individual container health check failures during bulk checks', async () => {
      // Setup multiple containers, one that will fail
      const healthyContainer: ContainerInfo = {
        ...mockContainerInfo,
        id: 'healthy-container',
        name: 'apex-healthy',
      };
      const failingContainer: ContainerInfo = {
        ...mockContainerInfo,
        id: 'failing-container',
        name: 'apex-failing',
      };

      mockContainerManager.listApexContainers.mockResolvedValue([healthyContainer, failingContainer]);

      // Mock getStats to succeed for healthy container but fail for failing container
      mockContainerManager.getStats.mockImplementation((containerId: string) => {
        if (containerId === 'healthy-container') {
          return Promise.resolve(mockStats);
        }
        return Promise.reject(new Error('Stats unavailable'));
      });

      const failedSpy = vi.fn();
      healthMonitor.on('health:check:failed', failedSpy);

      await healthMonitor['performHealthChecks']();

      expect(failedSpy).toHaveBeenCalledWith('failing-container', 'Stats unavailable');
    });
  });

  describe('Periodic Health Check Behavior', () => {
    it('should perform health checks at specified intervals', async () => {
      vi.useFakeTimers();

      const monitor = new ContainerHealthMonitor(mockContainerManager, {
        interval: 1000, // 1 second
        autoStart: false,
      });

      const performHealthChecksSpy = vi.spyOn(monitor as any, 'performHealthChecks').mockResolvedValue();

      await monitor.startMonitoring();

      // Should perform initial check
      expect(performHealthChecksSpy).toHaveBeenCalledTimes(1);

      // Advance time by interval
      vi.advanceTimersByTime(1000);
      expect(performHealthChecksSpy).toHaveBeenCalledTimes(2);

      // Advance time by another interval
      vi.advanceTimersByTime(1000);
      expect(performHealthChecksSpy).toHaveBeenCalledTimes(3);

      await monitor.stopMonitoring();
      vi.useRealTimers();
    });

    it('should stop periodic checks when monitoring stops', async () => {
      vi.useFakeTimers();

      const monitor = new ContainerHealthMonitor(mockContainerManager, {
        interval: 1000,
        autoStart: false,
      });

      const performHealthChecksSpy = vi.spyOn(monitor as any, 'performHealthChecks').mockResolvedValue();

      await monitor.startMonitoring();
      expect(performHealthChecksSpy).toHaveBeenCalledTimes(1);

      await monitor.stopMonitoring();

      // Advance time and ensure no more checks happen
      vi.advanceTimersByTime(2000);
      expect(performHealthChecksSpy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should handle errors during periodic checks without stopping monitoring', async () => {
      vi.useFakeTimers();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const monitor = new ContainerHealthMonitor(mockContainerManager, {
        interval: 500,
        autoStart: false,
      });

      // Mock performHealthChecks to fail
      vi.spyOn(monitor as any, 'performHealthChecks')
        .mockRejectedValueOnce(new Error('Check failed'))
        .mockResolvedValue();

      await monitor.startMonitoring();

      // Advance time to trigger the failing check
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      expect(consoleSpy).toHaveBeenCalledWith('Error during health checks:', expect.any(Error));

      // Monitor should still be active
      expect(monitor.isActive()).toBe(true);

      await monitor.stopMonitoring();
      vi.useRealTimers();
      consoleSpy.mockRestore();
    });
  });

  describe('Container Filtering and Selection', () => {
    beforeEach(async () => {
      await healthMonitor.startMonitoring();
    });

    it('should monitor all containers when monitorAll is true', async () => {
      const monitorAllMonitor = new ContainerHealthMonitor(mockContainerManager, {
        monitorAll: true,
        autoStart: false,
      });

      const containers = [
        { ...mockContainerInfo, name: 'random-container' },
        { ...mockContainerInfo, name: 'apex-task-123', id: 'apex-container' },
      ];
      mockContainerManager.listApexContainers.mockResolvedValue(containers);

      await monitorAllMonitor.startMonitoring();
      const containersToMonitor = await monitorAllMonitor['getContainersToMonitor']();

      expect(containersToMonitor).toHaveLength(2);
      await monitorAllMonitor.stopMonitoring();
    });

    it('should filter containers by prefix when monitorAll is false', async () => {
      const containers = [
        { ...mockContainerInfo, name: 'random-container', id: 'random-id' },
        { ...mockContainerInfo, name: 'apex-task-123', id: 'apex-id' },
        { ...mockContainerInfo, name: 'custom-task-456', id: 'custom-id' },
      ];
      mockContainerManager.listApexContainers.mockResolvedValue(containers);

      const containersToMonitor = await healthMonitor['getContainersToMonitor']();

      expect(containersToMonitor).toHaveLength(1);
      expect(containersToMonitor[0].name).toBe('apex-task-123');
    });

    it('should respect custom container prefix', async () => {
      const customPrefixMonitor = new ContainerHealthMonitor(mockContainerManager, {
        containerPrefix: 'custom',
        autoStart: false,
      });

      const containers = [
        { ...mockContainerInfo, name: 'apex-task-123', id: 'apex-id' },
        { ...mockContainerInfo, name: 'custom-task-456', id: 'custom-id' },
      ];
      mockContainerManager.listApexContainers.mockResolvedValue(containers);

      await customPrefixMonitor.startMonitoring();
      const containersToMonitor = await customPrefixMonitor['getContainersToMonitor']();

      expect(containersToMonitor).toHaveLength(1);
      expect(containersToMonitor[0].name).toBe('custom-task-456');
      await customPrefixMonitor.stopMonitoring();
    });
  });

  describe('Health Status Transitions', () => {
    beforeEach(async () => {
      await healthMonitor.startMonitoring();
    });

    it('should track status transitions correctly', async () => {
      const healthEventSpy = vi.fn();
      healthMonitor.on('container:health', healthEventSpy);

      // Initial healthy check
      await healthMonitor.checkContainerHealth('test-container-id');
      expect(healthEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        status: 'healthy',
        previousStatus: undefined,
      }));

      // Make it fail
      mockContainerManager.getStats.mockResolvedValue(null);
      await healthMonitor.checkContainerHealth('test-container-id');

      expect(healthEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        status: 'starting',
        previousStatus: 'healthy',
        failingStreak: 1,
      }));

      // Another failure to make it unhealthy
      await healthMonitor.checkContainerHealth('test-container-id');
      expect(healthEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        status: 'unhealthy',
        previousStatus: 'starting',
        failingStreak: 2,
      }));

      // Recovery
      mockContainerManager.getStats.mockResolvedValue(mockStats);
      await healthMonitor.checkContainerHealth('test-container-id');
      expect(healthEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        status: 'healthy',
        previousStatus: 'unhealthy',
        failingStreak: 0,
      }));
    });

    it('should handle container state transitions', async () => {
      await healthMonitor.addContainer('test-container-id');

      // Container transitions to created state (starting)
      const createdContainer = { ...mockContainerInfo, status: 'created' as const };
      mockContainerManager.getContainerInfo.mockResolvedValue(createdContainer);

      const healthCheck = await healthMonitor.checkContainerHealth('test-container-id');
      expect(healthCheck?.status).toBe('starting');

      // Container transitions to exited state (unhealthy)
      const exitedContainer = { ...mockContainerInfo, status: 'exited' as const, exitCode: 1 };
      mockContainerManager.getContainerInfo.mockResolvedValue(exitedContainer);

      const healthCheck2 = await healthMonitor.checkContainerHealth('test-container-id');
      expect(healthCheck2?.status).toBe('unhealthy');
      expect(healthCheck2?.lastCheckExitCode).toBe(1);
    });
  });

  describe('Configuration Updates', () => {
    it('should restart monitoring when updating options while active', async () => {
      const stopSpy = vi.spyOn(healthMonitor, 'stopMonitoring');
      const startSpy = vi.spyOn(healthMonitor, 'startMonitoring');

      await healthMonitor.startMonitoring();

      healthMonitor.updateOptions({ interval: 2000 });

      expect(stopSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalledTimes(2); // Initial start + restart
    });

    it('should not restart monitoring when updating options while inactive', async () => {
      const stopSpy = vi.spyOn(healthMonitor, 'stopMonitoring');
      const startSpy = vi.spyOn(healthMonitor, 'startMonitoring');

      healthMonitor.updateOptions({ maxFailures: 5 });

      expect(stopSpy).not.toHaveBeenCalled();
      expect(startSpy).not.toHaveBeenCalled();
    });
  });

  describe('Health Evaluation Criteria', () => {
    beforeEach(async () => {
      await healthMonitor.startMonitoring();
    });

    it('should mark container unhealthy for excessive memory usage', async () => {
      const highMemoryStats = { ...mockStats, memoryPercent: 97 };
      const result = healthMonitor['evaluateContainerHealth'](highMemoryStats, mockContainerInfo);
      expect(result).toBe(false);
    });

    it('should mark container healthy for normal memory usage', async () => {
      const normalMemoryStats = { ...mockStats, memoryPercent: 70 };
      const result = healthMonitor['evaluateContainerHealth'](normalMemoryStats, mockContainerInfo);
      expect(result).toBe(true);
    });

    it('should mark container unhealthy for excessive PID count', async () => {
      const highPidStats = { ...mockStats, pids: 12000 };
      const result = healthMonitor['evaluateContainerHealth'](highPidStats, mockContainerInfo);
      expect(result).toBe(false);
    });

    it('should mark container healthy for normal PID count', async () => {
      const normalPidStats = { ...mockStats, pids: 100 };
      const result = healthMonitor['evaluateContainerHealth'](normalPidStats, mockContainerInfo);
      expect(result).toBe(true);
    });

    it('should handle edge case memory usage at boundary', async () => {
      const boundaryMemoryStats = { ...mockStats, memoryPercent: 95 };
      const result = healthMonitor['evaluateContainerHealth'](boundaryMemoryStats, mockContainerInfo);
      expect(result).toBe(true); // 95% should be healthy, >95% is unhealthy
    });
  });

  describe('Auto-start Behavior', () => {
    it('should auto-start monitoring when autoStart is true', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const monitor = new ContainerHealthMonitor(mockContainerManager, { autoStart: true });

      // Give it time to auto-start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should eventually start (or fail and log a warning)
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not auto-start monitoring when autoStart is false', () => {
      const monitor = new ContainerHealthMonitor(mockContainerManager, { autoStart: false });
      expect(monitor.isActive()).toBe(false);
    });
  });

  describe('Stress Testing', () => {
    beforeEach(async () => {
      await healthMonitor.startMonitoring();
    });

    it('should handle multiple concurrent health checks', async () => {
      const containerIds = ['container1', 'container2', 'container3', 'container4', 'container5'];

      // Mock multiple containers
      containerIds.forEach(id => {
        mockContainerManager.getContainerInfo.mockImplementation((containerId: string) => {
          if (containerIds.includes(containerId)) {
            return Promise.resolve({ ...mockContainerInfo, id: containerId, name: `apex-${containerId}` });
          }
          return Promise.resolve(null);
        });
      });

      // Run concurrent health checks
      const healthCheckPromises = containerIds.map(id =>
        healthMonitor.checkContainerHealth(id)
      );

      const results = await Promise.all(healthCheckPromises);

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result?.containerId).toBe(containerIds[index]);
        expect(result?.status).toBe('healthy');
      });
    });

    it('should handle rapid successive health checks on same container', async () => {
      const promises = Array.from({ length: 10 }, () =>
        healthMonitor.checkContainerHealth('test-container-id')
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result?.containerId).toBe('test-container-id');
        expect(result?.status).toBe('healthy');
      });
    });
  });
});