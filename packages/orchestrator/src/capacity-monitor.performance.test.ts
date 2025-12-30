import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CapacityMonitor, CapacityUsageProvider, CapacityUsage, ModeInfo, CapacityThresholds } from './capacity-monitor';
import { DaemonConfig, LimitsConfig } from '@apexcli/core';

describe('CapacityMonitor - Performance Tests', () => {
  let capacityMonitor: CapacityMonitor;
  let mockConfig: DaemonConfig;
  let mockLimits: LimitsConfig;
  let mockUsageProvider: CapacityUsageProvider;

  const mockUsage: CapacityUsage = {
    currentTokens: 50000,
    currentCost: 2.5,
    activeTasks: 1,
    maxTokensPerTask: 100000,
    maxCostPerTask: 5.0,
    maxConcurrentTasks: 2,
    dailyBudget: 100.0,
    dailySpent: 25.0,
  };

  const mockModeInfo: ModeInfo = {
    mode: 'day',
    modeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
    nextModeSwitch: new Date('2024-01-01T18:00:00Z'),
    nextMidnight: new Date('2024-01-02T00:00:00Z'),
  };

  const mockThresholds: CapacityThresholds = {
    tokensThreshold: 80000,
    costThreshold: 4.0,
    budgetThreshold: 80.0,
    concurrentThreshold: 2,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T14:00:00Z'));

    mockConfig = {
      timeBasedUsage: {
        enabled: true,
        dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
        dayModeThresholds: {
          maxTokensPerTask: 100000,
          maxCostPerTask: 5.0,
          maxConcurrentTasks: 2,
        },
        nightModeThresholds: {
          maxTokensPerTask: 1000000,
          maxCostPerTask: 20.0,
          maxConcurrentTasks: 5,
        },
      },
    };

    mockLimits = {
      maxTokensPerTask: 500000,
      maxCostPerTask: 10.0,
      maxConcurrentTasks: 3,
      dailyBudget: 100.0,
    };

    mockUsageProvider = {
      getCurrentUsage: vi.fn().mockReturnValue(mockUsage),
      getModeInfo: vi.fn().mockReturnValue(mockModeInfo),
      getThresholds: vi.fn().mockReturnValue(mockThresholds),
    };

    capacityMonitor = new CapacityMonitor(mockConfig, mockLimits, mockUsageProvider);
  });

  afterEach(() => {
    capacityMonitor.stop();
    vi.useRealTimers();
  });

  describe('High-Frequency Capacity Checks', () => {
    it('should handle rapid capacity checks without performance degradation', () => {
      capacityMonitor.start();

      const startTime = performance.now();
      const numChecks = 1000;

      // Perform many rapid capacity checks
      for (let i = 0; i < numChecks; i++) {
        capacityMonitor.checkCapacity();
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete 1000 checks in reasonable time (< 100ms)
      expect(executionTime).toBeLessThan(100);

      // Verify provider was called for each check
      expect(mockUsageProvider.getCurrentUsage).toHaveBeenCalledTimes(numChecks + 1); // +1 for start()
    });

    it('should maintain consistent performance with varying usage data', () => {
      capacityMonitor.start();

      const executionTimes: number[] = [];

      // Test with different usage scenarios
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();

        // Vary the usage data
        mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue({
          ...mockUsage,
          currentTokens: Math.random() * 100000,
          currentCost: Math.random() * 10,
          activeTasks: Math.floor(Math.random() * 5),
        });

        capacityMonitor.checkCapacity();

        const endTime = performance.now();
        executionTimes.push(endTime - startTime);
      }

      // Calculate average and verify consistency
      const avgTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const maxTime = Math.max(...executionTimes);

      expect(avgTime).toBeLessThan(1); // Average should be < 1ms
      expect(maxTime).toBeLessThan(5); // No single check should take > 5ms
    });
  });

  describe('Memory Usage', () => {
    it('should not accumulate memory with repeated operations', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many start/stop cycles
      for (let i = 0; i < 50; i++) {
        capacityMonitor.start();
        capacityMonitor.checkCapacity();
        capacityMonitor.stop();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be minimal (< 1MB)
      expect(memoryGrowth).toBeLessThan(1024 * 1024);
    });

    it('should handle many event listeners efficiently', () => {
      const numListeners = 1000;
      const listeners: Array<() => void> = [];

      // Add many event listeners
      for (let i = 0; i < numListeners; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        capacityMonitor.on('capacity:restored', listener);
      }

      capacityMonitor.start();

      const startTime = performance.now();

      // Trigger event that will notify all listeners
      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue({
        ...mockUsage,
        activeTasks: 0,
      });

      capacityMonitor.checkCapacity();

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should handle many listeners efficiently (< 50ms for 1000 listeners)
      expect(executionTime).toBeLessThan(50);

      // Verify all listeners were called
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Timer Management Performance', () => {
    it('should efficiently reschedule timers multiple times', () => {
      capacityMonitor.start();

      const startTime = performance.now();

      // Simulate many timer reschedules by changing mode info
      for (let i = 0; i < 100; i++) {
        mockUsageProvider.getModeInfo = vi.fn().mockReturnValue({
          ...mockModeInfo,
          nextModeSwitch: new Date(Date.now() + (i + 1) * 3600000), // +1 hour each time
          nextMidnight: new Date(Date.now() + (i + 1) * 86400000), // +1 day each time
        });

        // Trigger timer rescheduling via mode switch
        vi.advanceTimersByTime(1000);
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should handle many timer reschedules efficiently
      expect(executionTime).toBeLessThan(100);
    });

    it('should handle concurrent timer operations without blocking', () => {
      const monitors: CapacityMonitor[] = [];

      // Create multiple monitors
      for (let i = 0; i < 10; i++) {
        const monitor = new CapacityMonitor(mockConfig, mockLimits, mockUsageProvider);
        monitors.push(monitor);
      }

      const startTime = performance.now();

      // Start all monitors concurrently
      monitors.forEach(monitor => monitor.start());

      // Perform operations on all monitors
      for (let i = 0; i < 50; i++) {
        monitors.forEach(monitor => monitor.checkCapacity());
      }

      // Stop all monitors
      monitors.forEach(monitor => monitor.stop());

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should handle concurrent operations efficiently
      expect(executionTime).toBeLessThan(200);
    });
  });

  describe('Provider Call Optimization', () => {
    it('should minimize provider calls during normal operation', () => {
      const getCurrentUsageSpy = vi.fn().mockReturnValue(mockUsage);
      const getModeInfoSpy = vi.fn().mockReturnValue(mockModeInfo);
      const getThresholdsSpy = vi.fn().mockReturnValue(mockThresholds);

      mockUsageProvider = {
        getCurrentUsage: getCurrentUsageSpy,
        getModeInfo: getModeInfoSpy,
        getThresholds: getThresholdsSpy,
      };

      const monitor = new CapacityMonitor(mockConfig, mockLimits, mockUsageProvider);
      monitor.start();

      // Clear initial call counts
      vi.clearAllMocks();

      // Single capacity check
      monitor.checkCapacity();

      // Should only call each provider method once per check
      expect(getCurrentUsageSpy).toHaveBeenCalledTimes(1);
      expect(getModeInfoSpy).toHaveBeenCalledTimes(1);
      expect(getThresholdsSpy).toHaveBeenCalledTimes(1);

      monitor.stop();
    });

    it('should handle provider method calls efficiently under load', () => {
      let callCount = 0;
      const slowProvider: CapacityUsageProvider = {
        getCurrentUsage: vi.fn().mockImplementation(() => {
          callCount++;
          // Simulate some processing time
          const start = performance.now();
          while (performance.now() - start < 0.1) {
            // Busy wait for 0.1ms
          }
          return mockUsage;
        }),
        getModeInfo: vi.fn().mockReturnValue(mockModeInfo),
        getThresholds: vi.fn().mockReturnValue(mockThresholds),
      };

      const monitor = new CapacityMonitor(mockConfig, mockLimits, slowProvider);
      monitor.start();

      const startTime = performance.now();

      // Perform many checks with slow provider
      for (let i = 0; i < 100; i++) {
        monitor.checkCapacity();
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should still complete in reasonable time despite slow provider
      expect(executionTime).toBeLessThan(500); // 500ms for 100 checks with 0.1ms each
      expect(callCount).toBe(100);

      monitor.stop();
    });
  });

  describe('Event Emission Performance', () => {
    it('should efficiently emit events with large event data', () => {
      const largeUsage: CapacityUsage = {
        ...mockUsage,
        currentTokens: Number.MAX_SAFE_INTEGER,
        currentCost: Number.MAX_VALUE / 1000,
      };

      mockUsageProvider.getCurrentUsage = vi.fn()
        .mockReturnValueOnce(largeUsage)
        .mockReturnValue({
          ...largeUsage,
          activeTasks: 0,
        });

      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      capacityMonitor.start();

      const startTime = performance.now();
      capacityMonitor.checkCapacity();
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      // Should handle large data efficiently
      expect(executionTime).toBeLessThan(10);
      expect(eventSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle burst event emissions efficiently', () => {
      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      capacityMonitor.start();

      const startTime = performance.now();

      // Trigger multiple rapid events by changing usage
      for (let i = 0; i < 50; i++) {
        mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue({
          ...mockUsage,
          activeTasks: i % 2, // Alternate between 0 and 1 to trigger events
          currentTokens: mockUsage.currentTokens - (i * 1000),
        });

        capacityMonitor.checkCapacity();
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should handle burst events efficiently
      expect(executionTime).toBeLessThan(100);
      expect(eventSpy).toHaveBeenCalled();
    });
  });
});