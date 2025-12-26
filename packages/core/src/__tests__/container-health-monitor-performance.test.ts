import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { ContainerHealthMonitor } from '../container-health-monitor';
import { ContainerManager } from '../container-manager';
import { ContainerInfo, ContainerStats } from '../types';

// Mock ContainerManager for performance tests
const createMockContainerManager = () => ({
  runtime: {
    getBestRuntime: vi.fn().mockResolvedValue('docker'),
  },
  getContainerInfo: vi.fn(),
  listApexContainers: vi.fn(),
  getStats: vi.fn(),
  on: vi.fn(),
  emit: vi.fn(),
} as unknown as ContainerManager);

describe('ContainerHealthMonitor Performance Tests', () => {
  let healthMonitor: ContainerHealthMonitor;
  let mockContainerManager: ReturnType<typeof createMockContainerManager>;

  const createMockContainer = (id: string, name: string): ContainerInfo => ({
    id,
    name,
    image: 'node:18',
    status: 'running',
    createdAt: new Date(),
    startedAt: new Date(),
  });

  const mockStats: ContainerStats = {
    cpuPercent: 15.5,
    memoryUsage: 512 * 1024 * 1024,
    memoryLimit: 1024 * 1024 * 1024,
    memoryPercent: 50.0,
    networkRxBytes: 1024,
    networkTxBytes: 2048,
    blockReadBytes: 4096,
    blockWriteBytes: 8192,
    pids: 42,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockContainerManager = createMockContainerManager();

    healthMonitor = new ContainerHealthMonitor(mockContainerManager, {
      interval: 100, // Fast interval for performance tests
      maxFailures: 3,
      timeout: 50,
      autoStart: false,
    });
  });

  afterEach(async () => {
    if (healthMonitor.isActive()) {
      await healthMonitor.stopMonitoring();
    }
  });

  describe('High Volume Container Monitoring', () => {
    it('should handle monitoring 100 containers efficiently', async () => {
      const containerCount = 100;
      const containers: ContainerInfo[] = [];

      // Create 100 mock containers
      for (let i = 0; i < containerCount; i++) {
        containers.push(createMockContainer(`container-${i}`, `apex-task-${i}`));
      }

      // Setup mocks to return all containers
      mockContainerManager.listApexContainers.mockResolvedValue(containers);
      mockContainerManager.getStats.mockResolvedValue(mockStats);

      // Mock getContainerInfo to return appropriate container
      mockContainerManager.getContainerInfo.mockImplementation((id: string) => {
        const container = containers.find(c => c.id === id);
        return Promise.resolve(container || null);
      });

      await healthMonitor.startMonitoring();

      const startTime = performance.now();

      // Perform health checks
      await healthMonitor['performHealthChecks']();

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);

      const stats = healthMonitor.getStats();
      expect(stats.totalContainers).toBe(containerCount);
      expect(stats.healthyContainers).toBe(containerCount);
    });

    it('should handle rapid health status updates', async () => {
      const container = createMockContainer('rapid-container', 'apex-rapid-test');

      mockContainerManager.getContainerInfo.mockResolvedValue(container);
      mockContainerManager.getStats
        .mockResolvedValueOnce(mockStats) // Healthy
        .mockResolvedValueOnce(null) // Unhealthy
        .mockResolvedValueOnce(mockStats) // Healthy again
        .mockResolvedValueOnce(null) // Unhealthy
        .mockResolvedValueOnce(mockStats); // Healthy

      await healthMonitor.startMonitoring();
      await healthMonitor.addContainer('rapid-container');

      const startTime = performance.now();

      // Rapid successive health checks
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(healthMonitor.checkContainerHealth('rapid-container'));
      }

      const results = await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete quickly
      expect(duration).toBeLessThan(500);
      expect(results).toHaveLength(5);

      // All checks should have completed
      results.forEach(result => {
        expect(result).not.toBeNull();
        expect(result?.containerId).toBe('rapid-container');
      });
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent health checks across multiple containers', async () => {
      const containerCount = 50;
      const containers: ContainerInfo[] = [];

      for (let i = 0; i < containerCount; i++) {
        containers.push(createMockContainer(`concurrent-${i}`, `apex-concurrent-${i}`));
      }

      // Setup mocks
      mockContainerManager.getContainerInfo.mockImplementation((id: string) => {
        const container = containers.find(c => c.id === id);
        return Promise.resolve(container || null);
      });

      // Simulate some containers being slower to respond
      mockContainerManager.getStats.mockImplementation((id: string) => {
        const delay = Math.random() * 10; // Random delay up to 10ms
        return new Promise(resolve => {
          setTimeout(() => resolve(mockStats), delay);
        });
      });

      await healthMonitor.startMonitoring();

      // Add all containers
      const addPromises = containers.map(container =>
        healthMonitor.addContainer(container.id)
      );
      await Promise.all(addPromises);

      const startTime = performance.now();

      // Perform concurrent health checks
      const checkPromises = containers.map(container =>
        healthMonitor.checkContainerHealth(container.id)
      );

      const results = await Promise.all(checkPromises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete concurrently, not sequentially
      expect(duration).toBeLessThan(200); // Much faster than 50 * 10ms = 500ms
      expect(results).toHaveLength(containerCount);

      results.forEach(result => {
        expect(result).not.toBeNull();
        expect(result?.status).toBe('healthy');
      });
    });

    it('should handle mixed success/failure scenarios efficiently', async () => {
      const healthyContainers = 25;
      const unhealthyContainers = 25;
      const containers: ContainerInfo[] = [];

      // Create containers
      for (let i = 0; i < healthyContainers; i++) {
        containers.push(createMockContainer(`healthy-${i}`, `apex-healthy-${i}`));
      }
      for (let i = 0; i < unhealthyContainers; i++) {
        containers.push(createMockContainer(`unhealthy-${i}`, `apex-unhealthy-${i}`));
      }

      // Setup mocks
      mockContainerManager.getContainerInfo.mockImplementation((id: string) => {
        const container = containers.find(c => c.id === id);
        return Promise.resolve(container || null);
      });

      mockContainerManager.getStats.mockImplementation((id: string) => {
        if (id.startsWith('healthy-')) {
          return Promise.resolve(mockStats);
        } else {
          return Promise.reject(new Error('Container unhealthy'));
        }
      });

      await healthMonitor.startMonitoring();

      // Add all containers
      await Promise.all(containers.map(c => healthMonitor.addContainer(c.id)));

      const startTime = performance.now();

      // Check all containers
      const checkPromises = containers.map(c => healthMonitor.checkContainerHealth(c.id));
      const results = await Promise.all(checkPromises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(300);

      const stats = healthMonitor.getStats();
      expect(stats.totalContainers).toBe(50);

      // Count actual statuses
      const healthyCount = results.filter(r => r?.status === 'healthy').length;
      const unhealthyCount = results.filter(r => r?.status === 'starting' || r?.status === 'unhealthy').length;

      expect(healthyCount).toBe(healthyContainers);
      expect(unhealthyCount).toBe(unhealthyContainers);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory when adding and removing many containers', async () => {
      await healthMonitor.startMonitoring();

      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const containerId = `temp-container-${i}`;
        const container = createMockContainer(containerId, `apex-temp-${i}`);

        mockContainerManager.getContainerInfo.mockResolvedValue(container);

        // Add container
        await healthMonitor.addContainer(containerId);

        // Perform a health check
        await healthMonitor.checkContainerHealth(containerId);

        // Remove container
        healthMonitor.removeContainer(containerId);
      }

      // All containers should be removed
      const finalStats = healthMonitor.getStats();
      expect(finalStats.totalContainers).toBe(0);

      // Health status map should be empty
      const healthStatuses = healthMonitor.getHealthStatus();
      expect(healthStatuses.size).toBe(0);
    });

    it('should efficiently manage health check history', async () => {
      const container = createMockContainer('history-container', 'apex-history-test');

      mockContainerManager.getContainerInfo.mockResolvedValue(container);
      mockContainerManager.getStats.mockResolvedValue(mockStats);

      await healthMonitor.startMonitoring();
      await healthMonitor.addContainer('history-container');

      // Perform many health checks
      for (let i = 0; i < 1000; i++) {
        await healthMonitor.checkContainerHealth('history-container');
      }

      const health = healthMonitor.getContainerHealth('history-container');
      expect(health).not.toBeNull();
      expect(health?.status).toBe('healthy');

      // Should only maintain current state, not full history
      const stats = healthMonitor.getStats();
      expect(stats.totalContainers).toBe(1);
    });
  });

  describe('Timer Performance', () => {
    it('should efficiently manage periodic health check timers', async () => {
      vi.useFakeTimers();

      const performHealthChecksSpy = vi.spyOn(healthMonitor as any, 'performHealthChecks')
        .mockResolvedValue();

      await healthMonitor.startMonitoring();

      // Advance time rapidly
      const intervals = 50;
      for (let i = 0; i < intervals; i++) {
        vi.advanceTimersByTime(100); // Advance by interval
      }

      await vi.runAllTimersAsync();

      // Should have called performHealthChecks for each interval + initial
      expect(performHealthChecksSpy).toHaveBeenCalledTimes(intervals + 1);

      await healthMonitor.stopMonitoring();

      // Advance more time to ensure timer is cleared
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // No more calls should happen
      expect(performHealthChecksSpy).toHaveBeenCalledTimes(intervals + 1);

      vi.useRealTimers();
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle container manager errors without blocking other operations', async () => {
      const workingContainer = createMockContainer('working', 'apex-working');
      const failingContainer = createMockContainer('failing', 'apex-failing');

      mockContainerManager.getContainerInfo.mockImplementation((id: string) => {
        if (id === 'working') return Promise.resolve(workingContainer);
        if (id === 'failing') return Promise.reject(new Error('Container error'));
        return Promise.resolve(null);
      });

      mockContainerManager.getStats.mockResolvedValue(mockStats);

      await healthMonitor.startMonitoring();

      const startTime = performance.now();

      // Add working container
      await healthMonitor.addContainer('working');

      // Try to add failing container (should not block)
      const failingPromise = healthMonitor.addContainer('failing').catch(() => null);

      // Check working container
      const workingResult = await healthMonitor.checkContainerHealth('working');

      await failingPromise; // Ensure failing operation completes

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete quickly despite error
      expect(duration).toBeLessThan(100);
      expect(workingResult?.status).toBe('healthy');

      // Working container should still be monitored
      expect(healthMonitor.getContainerHealth('working')).not.toBeNull();
      expect(healthMonitor.getContainerHealth('failing')).toBeNull();
    });
  });
});

describe('ContainerHealthMonitor Benchmark Tests', () => {
  // These tests are for benchmarking and should be run separately
  // They may take longer to execute and are primarily for performance validation

  it.skip('benchmark: health check performance with 1000 containers', async () => {
    const mockContainerManager = createMockContainerManager();
    const healthMonitor = new ContainerHealthMonitor(mockContainerManager, {
      interval: 10000, // Long interval for benchmark
      autoStart: false,
    });

    const containerCount = 1000;
    const containers: ContainerInfo[] = [];

    for (let i = 0; i < containerCount; i++) {
      containers.push(createMockContainer(`benchmark-${i}`, `apex-benchmark-${i}`));
    }

    mockContainerManager.listApexContainers.mockResolvedValue(containers);
    mockContainerManager.getStats.mockResolvedValue({
      cpuPercent: 15.5,
      memoryUsage: 512 * 1024 * 1024,
      memoryLimit: 1024 * 1024 * 1024,
      memoryPercent: 50.0,
      networkRxBytes: 1024,
      networkTxBytes: 2048,
      blockReadBytes: 4096,
      blockWriteBytes: 8192,
      pids: 42,
    });

    await healthMonitor.startMonitoring();

    const iterations = 10;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await healthMonitor['performHealthChecks']();
      const end = performance.now();
      durations.push(end - start);
    }

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    console.log(`Benchmark Results for ${containerCount} containers:`);
    console.log(`Average duration: ${avgDuration.toFixed(2)}ms`);
    console.log(`Max duration: ${maxDuration.toFixed(2)}ms`);
    console.log(`Min duration: ${minDuration.toFixed(2)}ms`);
    console.log(`Throughput: ${(containerCount / (avgDuration / 1000)).toFixed(2)} containers/sec`);

    // Performance assertions (adjust based on your requirements)
    expect(avgDuration).toBeLessThan(5000); // 5 seconds for 1000 containers
    expect(maxDuration).toBeLessThan(10000); // Max 10 seconds

    await healthMonitor.stopMonitoring();
  });
});