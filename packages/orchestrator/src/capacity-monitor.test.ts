import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CapacityMonitor, CapacityUsageProvider, CapacityUsage, ModeInfo, CapacityThresholds, CapacityRestoredEvent } from './capacity-monitor';
import { DaemonConfig, LimitsConfig } from '@apex/core';

describe('CapacityMonitor', () => {
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

  describe('Constructor and Basic Setup', () => {
    it('should create CapacityMonitor instance', () => {
      expect(capacityMonitor).toBeInstanceOf(CapacityMonitor);
      expect(capacityMonitor.getStatus().isRunning).toBe(false);
    });

    it('should initialize with proper configuration', () => {
      const status = capacityMonitor.getStatus();
      expect(status.hasModeSwitchTimer).toBe(false);
      expect(status.hasMidnightTimer).toBe(false);
    });
  });

  describe('Start and Stop', () => {
    it('should start monitoring successfully', () => {
      capacityMonitor.start();

      const status = capacityMonitor.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.hasModeSwitchTimer).toBe(true);
      expect(status.hasMidnightTimer).toBe(true);
      expect(status.lastUsage).toEqual(mockUsage);
    });

    it('should not start if already running', () => {
      capacityMonitor.start();
      const firstStatus = capacityMonitor.getStatus();

      capacityMonitor.start(); // Start again
      const secondStatus = capacityMonitor.getStatus();

      expect(firstStatus).toEqual(secondStatus);
    });

    it('should stop monitoring successfully', () => {
      capacityMonitor.start();
      capacityMonitor.stop();

      const status = capacityMonitor.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.hasModeSwitchTimer).toBe(false);
      expect(status.hasMidnightTimer).toBe(false);
    });

    it('should not stop if already stopped', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      capacityMonitor.stop(); // Stop when not running
      expect(consoleSpy).not.toHaveBeenCalledWith('🔍 CapacityMonitor stopped');
      consoleSpy.mockRestore();
    });
  });

  describe('Timer Scheduling', () => {
    beforeEach(() => {
      capacityMonitor.start();
    });

    it('should schedule mode switch timer correctly', () => {
      const status = capacityMonitor.getStatus();
      expect(status.hasModeSwitchTimer).toBe(true);
      expect(status.nextModeSwitch).toEqual(mockModeInfo.nextModeSwitch);
    });

    it('should schedule midnight timer correctly', () => {
      const status = capacityMonitor.getStatus();
      expect(status.hasMidnightTimer).toBe(true);
      expect(status.nextMidnight).toEqual(mockModeInfo.nextMidnight);
    });

    it('should reschedule mode switch timer after firing', () => {
      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      // Mock updated mode info for next schedule
      const nextModeInfo = {
        ...mockModeInfo,
        mode: 'night' as const,
        nextModeSwitch: new Date('2024-01-01T22:00:00Z'),
      };

      mockUsageProvider.getModeInfo = vi.fn().mockReturnValue(nextModeInfo);

      // Fast forward to mode switch time
      const timeToSwitch = mockModeInfo.nextModeSwitch.getTime() - new Date().getTime();
      vi.advanceTimersByTime(timeToSwitch + 1000); // +1000ms buffer

      // Check that timer was rescheduled
      const status = capacityMonitor.getStatus();
      expect(status.hasModeSwitchTimer).toBe(true);
    });

    it('should reschedule midnight timer after firing', () => {
      // Mock updated mode info for next schedule
      const nextModeInfo = {
        ...mockModeInfo,
        nextMidnight: new Date('2024-01-03T00:00:00Z'), // Next day
      };

      mockUsageProvider.getModeInfo = vi.fn().mockReturnValue(nextModeInfo);

      // Fast forward to midnight
      const timeToMidnight = mockModeInfo.nextMidnight.getTime() - new Date().getTime();
      vi.advanceTimersByTime(timeToMidnight + 1000); // +1000ms buffer

      // Check that timer was rescheduled
      const status = capacityMonitor.getStatus();
      expect(status.hasMidnightTimer).toBe(true);
    });
  });

  describe('Mode Switch Detection', () => {
    beforeEach(() => {
      capacityMonitor.start();
    });

    it('should emit capacity:restored event on mode switch with higher limits', () => {
      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      // Mock mode switch to night mode with higher limits
      const nightModeUsage: CapacityUsage = {
        ...mockUsage,
        maxTokensPerTask: 1000000,
        maxCostPerTask: 20.0,
        maxConcurrentTasks: 5,
      };

      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue(nightModeUsage);
      mockUsageProvider.getModeInfo = vi.fn().mockReturnValue({
        ...mockModeInfo,
        mode: 'night',
        nextModeSwitch: new Date('2024-01-01T22:00:00Z'),
      });

      // Trigger mode switch
      const timeToSwitch = mockModeInfo.nextModeSwitch.getTime() - new Date().getTime();
      vi.advanceTimersByTime(timeToSwitch + 1000);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'mode_switch',
          previousUsage: mockUsage,
          currentUsage: nightModeUsage,
        })
      );
    });

    it('should not emit event on mode switch with same limits', () => {
      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      // Mock mode switch with same limits (no capacity restoration)
      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue(mockUsage);

      // Trigger mode switch
      const timeToSwitch = mockModeInfo.nextModeSwitch.getTime() - new Date().getTime();
      vi.advanceTimersByTime(timeToSwitch + 1000);

      expect(eventSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'mode_switch',
        })
      );
    });
  });

  describe('Budget Reset Detection', () => {
    beforeEach(() => {
      capacityMonitor.start();
    });

    it('should emit capacity:restored event at midnight for budget reset', () => {
      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      // Mock budget reset at midnight
      const resetUsage: CapacityUsage = {
        ...mockUsage,
        dailySpent: 0, // Reset daily spending
      };

      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue(resetUsage);

      // Trigger midnight
      const timeToMidnight = mockModeInfo.nextMidnight.getTime() - new Date().getTime();
      vi.advanceTimersByTime(timeToMidnight + 1000);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'budget_reset',
          previousUsage: mockUsage,
          currentUsage: resetUsage,
        })
      );
    });

    it('should emit budget reset event even if spending unchanged', () => {
      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      // Mock midnight with same usage (budget reset still occurs)
      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue(mockUsage);

      // Trigger midnight
      const timeToMidnight = mockModeInfo.nextMidnight.getTime() - new Date().getTime();
      vi.advanceTimersByTime(timeToMidnight + 1000);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'budget_reset',
        })
      );
    });
  });

  describe('Capacity Drop Detection', () => {
    beforeEach(() => {
      capacityMonitor.start();
    });

    it('should detect capacity drop due to task completion', () => {
      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      // Mock capacity drop (task completed, reducing active tasks)
      const droppedUsage: CapacityUsage = {
        ...mockUsage,
        activeTasks: 0, // Task completed
        currentTokens: 40000, // Tokens decreased
        currentCost: 2.0, // Cost decreased
      };

      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue(droppedUsage);

      // Check capacity manually
      capacityMonitor.checkCapacity();

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'capacity_dropped',
          previousUsage: mockUsage,
          currentUsage: droppedUsage,
        })
      );
    });

    it('should detect significant token usage drop', () => {
      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      // Mock significant token drop (>10% of threshold)
      const tokenThreshold = mockThresholds.tokensThreshold;
      const significantDrop = tokenThreshold * 0.15; // 15% of threshold
      const droppedUsage: CapacityUsage = {
        ...mockUsage,
        currentTokens: mockUsage.currentTokens - significantDrop,
      };

      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue(droppedUsage);

      capacityMonitor.checkCapacity();

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'capacity_dropped',
        })
      );
    });

    it('should detect significant cost drop', () => {
      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      // Mock significant cost drop (>10% of threshold)
      const costThreshold = mockThresholds.costThreshold;
      const significantDrop = costThreshold * 0.15; // 15% of threshold
      const droppedUsage: CapacityUsage = {
        ...mockUsage,
        currentCost: mockUsage.currentCost - significantDrop,
      };

      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue(droppedUsage);

      capacityMonitor.checkCapacity();

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'capacity_dropped',
        })
      );
    });

    it('should not emit event for minor usage changes', () => {
      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      // Mock minor changes (below threshold)
      const minorChange: CapacityUsage = {
        ...mockUsage,
        currentTokens: mockUsage.currentTokens - 100, // Very small change
        currentCost: mockUsage.currentCost - 0.01, // Very small change
      };

      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue(minorChange);

      capacityMonitor.checkCapacity();

      expect(eventSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'capacity_dropped',
        })
      );
    });
  });

  describe('checkCapacity Method', () => {
    it('should not check capacity when not running', () => {
      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      capacityMonitor.checkCapacity(); // Call when stopped

      expect(mockUsageProvider.getCurrentUsage).not.toHaveBeenCalled();
      expect(eventSpy).not.toHaveBeenCalled();
    });

    it('should initialize state on first check', () => {
      capacityMonitor.start();

      // Clear the initial call from start()
      vi.clearAllMocks();

      capacityMonitor.checkCapacity();

      expect(mockUsageProvider.getCurrentUsage).toHaveBeenCalledTimes(1);
      expect(mockUsageProvider.getModeInfo).toHaveBeenCalledTimes(1);
    });

    it('should handle missing previous state gracefully', () => {
      // Create new monitor without starting
      const newMonitor = new CapacityMonitor(mockConfig, mockLimits, mockUsageProvider);
      const eventSpy = vi.fn();
      newMonitor.on('capacity:restored', eventSpy);

      // Manually set running to true to test state handling
      (newMonitor as any).isRunning = true;
      newMonitor.checkCapacity();

      // Should not emit events without previous state
      expect(eventSpy).not.toHaveBeenCalled();
      newMonitor.stop();
    });
  });

  describe('Event Emission', () => {
    beforeEach(() => {
      capacityMonitor.start();
    });

    it('should emit correctly formatted capacity:restored events', () => {
      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      const droppedUsage: CapacityUsage = {
        ...mockUsage,
        activeTasks: 0,
      };

      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue(droppedUsage);
      capacityMonitor.checkCapacity();

      expect(eventSpy).toHaveBeenCalledWith({
        reason: 'capacity_dropped',
        timestamp: expect.any(Date),
        previousUsage: mockUsage,
        currentUsage: droppedUsage,
        modeInfo: mockModeInfo,
      });
    });

    it('should include proper timestamp in events', () => {
      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      const testTime = new Date('2024-01-01T15:00:00Z');
      vi.setSystemTime(testTime);

      const droppedUsage: CapacityUsage = {
        ...mockUsage,
        activeTasks: 0,
      };

      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue(droppedUsage);
      capacityMonitor.checkCapacity();

      const emittedEvent: CapacityRestoredEvent = eventSpy.mock.calls[0][0];
      expect(emittedEvent.timestamp).toEqual(testTime);
    });
  });

  describe('Edge Cases', () => {
    it('should handle timer firing when monitor is stopped', () => {
      capacityMonitor.start();

      // Stop monitor but let timer fire
      capacityMonitor.stop();

      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      // Fast forward to mode switch time (but monitor is stopped)
      const timeToSwitch = mockModeInfo.nextModeSwitch.getTime() - new Date().getTime();
      vi.advanceTimersByTime(timeToSwitch + 1000);

      expect(eventSpy).not.toHaveBeenCalled();
    });

    it('should handle past mode switch times gracefully', () => {
      // Mock mode switch time that's already passed
      const pastModeInfo: ModeInfo = {
        ...mockModeInfo,
        nextModeSwitch: new Date('2024-01-01T13:00:00Z'), // 1 hour ago
      };

      mockUsageProvider.getModeInfo = vi.fn().mockReturnValue(pastModeInfo);

      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      capacityMonitor.start();

      // Should handle past time and schedule next occurrence
      const status = capacityMonitor.getStatus();
      expect(status.hasModeSwitchTimer).toBe(true);
    });

    it('should handle past midnight times gracefully', () => {
      // Mock midnight time that's already passed
      const pastModeInfo: ModeInfo = {
        ...mockModeInfo,
        nextMidnight: new Date('2024-01-01T00:00:00Z'), // Already passed
      };

      mockUsageProvider.getModeInfo = vi.fn().mockReturnValue(pastModeInfo);

      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      capacityMonitor.start();

      // Should handle past time and schedule next occurrence
      const status = capacityMonitor.getStatus();
      expect(status.hasMidnightTimer).toBe(true);
    });

    it('should handle provider errors gracefully', () => {
      const errorProvider: CapacityUsageProvider = {
        getCurrentUsage: vi.fn().mockImplementation(() => {
          throw new Error('Provider error');
        }),
        getModeInfo: vi.fn().mockReturnValue(mockModeInfo),
        getThresholds: vi.fn().mockReturnValue(mockThresholds),
      };

      const errorMonitor = new CapacityMonitor(mockConfig, mockLimits, errorProvider);

      // Should not throw when starting with error provider
      expect(() => errorMonitor.start()).not.toThrow();

      // Should not throw when checking capacity with error provider
      expect(() => errorMonitor.checkCapacity()).not.toThrow();

      errorMonitor.stop();
    });
  });

  describe('Console Logging', () => {
    it('should log start message', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      capacityMonitor.start();

      expect(consoleSpy).toHaveBeenCalledWith('🔍 CapacityMonitor started');

      consoleSpy.mockRestore();
    });

    it('should log stop message', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      capacityMonitor.start();
      capacityMonitor.stop();

      expect(consoleSpy).toHaveBeenCalledWith('🔍 CapacityMonitor stopped');

      consoleSpy.mockRestore();
    });

    it('should log capacity restored events', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      capacityMonitor.start();

      const droppedUsage: CapacityUsage = {
        ...mockUsage,
        activeTasks: 0,
      };

      mockUsageProvider.getCurrentUsage = vi.fn().mockReturnValue(droppedUsage);
      capacityMonitor.checkCapacity();

      expect(consoleSpy).toHaveBeenCalledWith(
        '🔋 Capacity restored (capacity_dropped):',
        expect.objectContaining({
          reason: 'capacity_dropped',
          mode: 'day',
        })
      );

      consoleSpy.mockRestore();
    });
  });
});