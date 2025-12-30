import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CapacityMonitor, CapacityUsageProvider, CapacityUsage, ModeInfo, CapacityThresholds, CapacityRestoredEvent } from './capacity-monitor';
import { DaemonConfig, LimitsConfig } from '@apexcli/core';

describe('CapacityMonitor - Edge Cases and Error Handling', () => {
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
    vi.setSystemTime(new Date('2024-01-01T14:00:00Z')); // 2 PM

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

  describe('Provider Error Handling', () => {
    it('should handle getCurrentUsage() throwing an error', () => {
      const errorProvider: CapacityUsageProvider = {
        getCurrentUsage: vi.fn().mockImplementation(() => {
          throw new Error('Usage provider error');
        }),
        getModeInfo: vi.fn().mockReturnValue(mockModeInfo),
        getThresholds: vi.fn().mockReturnValue(mockThresholds),
      };

      const errorMonitor = new CapacityMonitor(mockConfig, mockLimits, errorProvider);
      const eventSpy = vi.fn();
      errorMonitor.on('capacity:restored', eventSpy);

      // Should not throw when starting
      expect(() => errorMonitor.start()).not.toThrow();

      // Should not throw when checking capacity
      expect(() => errorMonitor.checkCapacity()).not.toThrow();

      // Should not emit events due to error
      expect(eventSpy).not.toHaveBeenCalled();

      errorMonitor.stop();
    });

    it('should handle getModeInfo() throwing an error', () => {
      const errorProvider: CapacityUsageProvider = {
        getCurrentUsage: vi.fn().mockReturnValue(mockUsage),
        getModeInfo: vi.fn().mockImplementation(() => {
          throw new Error('Mode info error');
        }),
        getThresholds: vi.fn().mockReturnValue(mockThresholds),
      };

      const errorMonitor = new CapacityMonitor(mockConfig, mockLimits, errorProvider);

      // Should not throw when starting (but may not schedule timers)
      expect(() => errorMonitor.start()).not.toThrow();

      errorMonitor.stop();
    });

    it('should handle getThresholds() throwing an error', () => {
      capacityMonitor.start();

      const errorProvider: CapacityUsageProvider = {
        getCurrentUsage: vi.fn().mockReturnValue(mockUsage),
        getModeInfo: vi.fn().mockReturnValue(mockModeInfo),
        getThresholds: vi.fn().mockImplementation(() => {
          throw new Error('Thresholds error');
        }),
      };

      const errorMonitor = new CapacityMonitor(mockConfig, mockLimits, errorProvider);
      const eventSpy = vi.fn();
      errorMonitor.on('capacity:restored', eventSpy);

      errorMonitor.start();

      // Set up mock usage change
      errorProvider.getCurrentUsage = vi.fn().mockReturnValue({
        ...mockUsage,
        activeTasks: 0, // Task completed
      });

      // Should not throw when checking capacity even with threshold error
      expect(() => errorMonitor.checkCapacity()).not.toThrow();

      errorMonitor.stop();
    });

    it('should recover gracefully from intermittent provider errors', () => {
      let errorCount = 0;
      const intermittentProvider: CapacityUsageProvider = {
        getCurrentUsage: vi.fn().mockImplementation(() => {
          if (errorCount < 2) {
            errorCount++;
            throw new Error('Intermittent error');
          }
          return mockUsage;
        }),
        getModeInfo: vi.fn().mockReturnValue(mockModeInfo),
        getThresholds: vi.fn().mockReturnValue(mockThresholds),
      };

      const errorMonitor = new CapacityMonitor(mockConfig, mockLimits, intermittentProvider);

      // Should handle errors initially
      expect(() => errorMonitor.start()).not.toThrow();
      expect(() => errorMonitor.checkCapacity()).not.toThrow();

      // Should recover when provider starts working
      expect(() => errorMonitor.checkCapacity()).not.toThrow();
      expect(intermittentProvider.getCurrentUsage).toHaveBeenCalledTimes(3);

      errorMonitor.stop();
    });
  });

  describe('Invalid Data Handling', () => {
    it('should handle NaN and Infinity values in usage data', () => {
      const invalidUsage: CapacityUsage = {
        currentTokens: NaN,
        currentCost: Infinity,
        activeTasks: -1,
        maxTokensPerTask: 0,
        maxCostPerTask: -5,
        maxConcurrentTasks: Infinity,
        dailyBudget: NaN,
        dailySpent: -100,
      };

      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue(invalidUsage);

      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      capacityMonitor.start();

      // Should not throw with invalid data
      expect(() => capacityMonitor.checkCapacity()).not.toThrow();

      // Should not emit events with invalid data
      expect(eventSpy).not.toHaveBeenCalled();
    });

    it('should handle invalid date objects in mode info', () => {
      const invalidModeInfo: ModeInfo = {
        mode: 'day',
        modeHours: [],
        nextModeSwitch: new Date('invalid'),
        nextMidnight: new Date(NaN),
      };

      mockUsageProvider.getModeInfo = vi.fn().mockReturnValue(invalidModeInfo);

      // Should not throw when scheduling timers with invalid dates
      expect(() => capacityMonitor.start()).not.toThrow();

      const status = capacityMonitor.getStatus();
      expect(status.isRunning).toBe(true);
    });

    it('should handle negative threshold values', () => {
      const negativeThresholds: CapacityThresholds = {
        tokensThreshold: -1000,
        costThreshold: -5.0,
        budgetThreshold: -100.0,
        concurrentThreshold: -2,
      };

      mockUsageProvider.getThresholds = vi.fn().mockReturnValue(negativeThresholds);

      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      capacityMonitor.start();

      // Set up capacity drop scenario
      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue({
        ...mockUsage,
        activeTasks: 0,
      });

      // Should handle negative thresholds gracefully
      expect(() => capacityMonitor.checkCapacity()).not.toThrow();
    });
  });

  describe('Memory and Resource Management', () => {
    it('should properly clean up event listeners when stopped', () => {
      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      capacityMonitor.start();

      // Verify initial listener count
      expect(capacityMonitor.listenerCount('capacity:restored')).toBe(1);

      capacityMonitor.stop();

      // Event listeners should still exist (only timers are cleaned up)
      expect(capacityMonitor.listenerCount('capacity:restored')).toBe(1);

      // Manually remove listener to test cleanup
      capacityMonitor.removeAllListeners();
      expect(capacityMonitor.listenerCount('capacity:restored')).toBe(0);
    });

    it('should handle rapid start/stop cycles without memory leaks', () => {
      for (let i = 0; i < 100; i++) {
        capacityMonitor.start();
        capacityMonitor.stop();
      }

      const status = capacityMonitor.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.hasModeSwitchTimer).toBe(false);
      expect(status.hasMidnightTimer).toBe(false);
    });

    it('should handle multiple event listeners without issues', () => {
      const listeners: Array<(event: CapacityRestoredEvent) => void> = [];

      // Add 10 event listeners
      for (let i = 0; i < 10; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        capacityMonitor.on('capacity:restored', listener);
      }

      expect(capacityMonitor.listenerCount('capacity:restored')).toBe(10);

      capacityMonitor.start();

      // Trigger event
      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue({
        ...mockUsage,
        activeTasks: 0,
      });

      capacityMonitor.checkCapacity();

      // All listeners should have been called
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Timer Precision and Edge Cases', () => {
    it('should handle very short timer intervals', () => {
      // Mock mode switch happening in 1ms
      const nearFutureModeInfo: ModeInfo = {
        ...mockModeInfo,
        nextModeSwitch: new Date(Date.now() + 1),
      };

      mockUsageProvider.getModeInfo = vi.fn().mockReturnValue(nearFutureModeInfo);

      capacityMonitor.start();

      // Should handle short intervals without issues
      const status = capacityMonitor.getStatus();
      expect(status.hasModeSwitchTimer).toBe(true);
    });

    it('should handle extremely long timer intervals', () => {
      // Mock mode switch happening in 1 year
      const farFutureModeInfo: ModeInfo = {
        ...mockModeInfo,
        nextModeSwitch: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };

      mockUsageProvider.getModeInfo = vi.fn().mockReturnValue(farFutureModeInfo);

      capacityMonitor.start();

      // Should handle long intervals
      const status = capacityMonitor.getStatus();
      expect(status.hasModeSwitchTimer).toBe(true);
    });

    it('should handle system time changes during monitoring', () => {
      capacityMonitor.start();

      // Simulate system clock jumping forward
      vi.setSystemTime(new Date('2024-01-01T20:00:00Z')); // Jump to 8 PM

      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      // Mock provider returning updated times
      mockUsageProvider.getModeInfo = vi.fn().mockReturnValue({
        ...mockModeInfo,
        mode: 'night',
        nextModeSwitch: new Date('2024-01-02T09:00:00Z'),
      });

      // Should handle time jumps gracefully
      expect(() => capacityMonitor.checkCapacity()).not.toThrow();

      const status = capacityMonitor.getStatus();
      expect(status.isRunning).toBe(true);
    });
  });

  describe('Event Data Validation', () => {
    it('should emit events with consistent timestamps', () => {
      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      capacityMonitor.start();

      const testTime = new Date('2024-01-01T15:30:00Z');
      vi.setSystemTime(testTime);

      // Trigger capacity drop
      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue({
        ...mockUsage,
        activeTasks: 0,
      });

      capacityMonitor.checkCapacity();

      const event: CapacityRestoredEvent = eventSpy.mock.calls[0][0];
      expect(event.timestamp).toEqual(testTime);
      expect(event.reason).toBe('capacity_dropped');
    });

    it('should emit events with valid usage data structure', () => {
      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      capacityMonitor.start();

      const newUsage: CapacityUsage = {
        ...mockUsage,
        activeTasks: 0,
      };

      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue(newUsage);
      capacityMonitor.checkCapacity();

      const event: CapacityRestoredEvent = eventSpy.mock.calls[0][0];

      expect(event.previousUsage).toEqual(mockUsage);
      expect(event.currentUsage).toEqual(newUsage);
      expect(event.modeInfo).toEqual(mockModeInfo);
      expect(event.reason).toBe('capacity_dropped');
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Capacity Detection Edge Cases', () => {
    beforeEach(() => {
      capacityMonitor.start();
    });

    it('should handle exactly zero threshold values', () => {
      const zeroThresholds: CapacityThresholds = {
        tokensThreshold: 0,
        costThreshold: 0,
        budgetThreshold: 0,
        concurrentThreshold: 0,
      };

      mockUsageProvider.getThresholds = vi.fn().mockReturnValue(zeroThresholds);

      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      // Any usage drop should trigger with zero thresholds
      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue({
        ...mockUsage,
        currentTokens: mockUsage.currentTokens - 1,
      });

      capacityMonitor.checkCapacity();

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should detect capacity drop with simultaneous metric changes', () => {
      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      // Significant drops in all metrics simultaneously
      const newUsage: CapacityUsage = {
        ...mockUsage,
        currentTokens: mockUsage.currentTokens - mockThresholds.tokensThreshold * 0.2,
        currentCost: mockUsage.currentCost - mockThresholds.costThreshold * 0.2,
        activeTasks: 0,
      };

      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue(newUsage);
      capacityMonitor.checkCapacity();

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'capacity_dropped',
        })
      );
    });

    it('should handle capacity increase (not a drop)', () => {
      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      // Usage increases (should not trigger capacity drop)
      const newUsage: CapacityUsage = {
        ...mockUsage,
        currentTokens: mockUsage.currentTokens + 10000,
        currentCost: mockUsage.currentCost + 1.0,
        activeTasks: mockUsage.activeTasks + 1,
      };

      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue(newUsage);
      capacityMonitor.checkCapacity();

      expect(eventSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'capacity_dropped',
        })
      );
    });
  });
});