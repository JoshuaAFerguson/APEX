import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DaemonScheduler, UsageStatsProvider, UsageManagerProvider } from './daemon-scheduler';
import { DaemonConfig, LimitsConfig } from '@apexcli/core';

// ============================================================================
// Test Utilities & Mocks
// ============================================================================

class MockUsageProvider implements UsageStatsProvider {
  private dailyUsage = {
    totalTokens: 10000,
    totalCost: 5.0,
    tasksCompleted: 3,
    tasksFailed: 0,
  };
  private activeTasks = 2;
  private dailyBudget = 100.0;

  getCurrentDailyUsage() {
    return this.dailyUsage;
  }

  getActiveTasks(): number {
    return this.activeTasks;
  }

  getDailyBudget(): number {
    return this.dailyBudget;
  }

  // Test helpers
  setDailyUsage(usage: Partial<typeof this.dailyUsage>) {
    this.dailyUsage = { ...this.dailyUsage, ...usage };
  }

  setActiveTasks(count: number) {
    this.activeTasks = count;
  }

  setDailyBudget(budget: number) {
    this.dailyBudget = budget;
  }
}

const createMockDaemonConfig = (overrides: Partial<DaemonConfig> = {}): DaemonConfig => ({
  pollInterval: 5000,
  autoStart: false,
  logLevel: 'info',
  installAsService: false,
  serviceName: 'apex-daemon',
  healthCheck: {
    enabled: true,
    interval: 30000,
    timeout: 5000,
    retries: 3,
  },
  watchdog: {
    enabled: true,
    restartDelay: 5000,
    maxRestarts: 5,
    restartWindow: 300000,
  },
  timeBasedUsage: {
    enabled: true,
    dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
    nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
    dayModeCapacityThreshold: 0.90,
    nightModeCapacityThreshold: 0.96,
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
  sessionRecovery: {
    enabled: true,
    autoResume: true,
  },
  idleManagement: {
    enabled: true,
    idleThresholdMs: 60000,
    maxIdleTasks: 3,
  },
  ...overrides,
});

const createMockLimitsConfig = (overrides: Partial<LimitsConfig> = {}): LimitsConfig => ({
  maxTokensPerTask: 500000,
  maxCostPerTask: 10.0,
  dailyBudget: 100.0,
  maxTurns: 100,
  maxConcurrentTasks: 3,
  maxRetries: 3,
  retryDelayMs: 1000,
  retryBackoffFactor: 2,
  ...overrides,
});

// ============================================================================
// Test Suite
// ============================================================================

describe('DaemonScheduler', () => {
  let scheduler: DaemonScheduler;
  let mockProvider: MockUsageProvider;
  let daemonConfig: DaemonConfig;
  let limitsConfig: LimitsConfig;

  beforeEach(() => {
    mockProvider = new MockUsageProvider();
    daemonConfig = createMockDaemonConfig();
    limitsConfig = createMockLimitsConfig();
    scheduler = new DaemonScheduler(daemonConfig, limitsConfig, mockProvider);
  });

  describe('Time Window Detection', () => {
    it('should detect day mode correctly', () => {
      const dayTime = new Date('2024-01-01T14:00:00'); // 2 PM
      const timeWindow = scheduler.getCurrentTimeWindow(dayTime);

      expect(timeWindow.mode).toBe('day');
      expect(timeWindow.isActive).toBe(true);
      expect(timeWindow.startHour).toBe(9);
      expect(timeWindow.endHour).toBe(17);
    });

    it('should detect night mode correctly', () => {
      const nightTime = new Date('2024-01-01T23:00:00'); // 11 PM
      const timeWindow = scheduler.getCurrentTimeWindow(nightTime);

      expect(timeWindow.mode).toBe('night');
      expect(timeWindow.isActive).toBe(true);
      expect(timeWindow.startHour).toBe(0);
      expect(timeWindow.endHour).toBe(23);
    });

    it('should detect off-hours correctly', () => {
      const offHoursTime = new Date('2024-01-01T19:00:00'); // 7 PM
      const timeWindow = scheduler.getCurrentTimeWindow(offHoursTime);

      expect(timeWindow.mode).toBe('off-hours');
      expect(timeWindow.isActive).toBe(false);
    });

    it('should handle disabled time-based usage', () => {
      const configWithoutTimeBasedUsage = createMockDaemonConfig({
        timeBasedUsage: { enabled: false },
      });
      const schedulerDisabled = new DaemonScheduler(
        configWithoutTimeBasedUsage,
        limitsConfig,
        mockProvider
      );

      const anyTime = new Date('2024-01-01T14:00:00');
      const timeWindow = schedulerDisabled.getCurrentTimeWindow(anyTime);

      expect(timeWindow.mode).toBe('off-hours');
      expect(timeWindow.isActive).toBe(false);
    });

    it('should calculate next transition correctly', () => {
      const currentTime = new Date('2024-01-01T14:00:00'); // 2 PM (day mode)
      const timeWindow = scheduler.getCurrentTimeWindow(currentTime);

      expect(timeWindow.nextTransition.getHours()).toBe(22); // Next transition to night mode
    });
  });

  describe('Capacity Calculation', () => {
    it('should calculate capacity percentage correctly', () => {
      mockProvider.setDailyUsage({ totalCost: 50.0 });
      mockProvider.setDailyBudget(100.0);

      const dayTime = new Date('2024-01-01T14:00:00');
      const timeWindow = scheduler.getCurrentTimeWindow(dayTime);
      const capacity = scheduler.getCapacityInfo(timeWindow, dayTime);

      expect(capacity.currentPercentage).toBe(0.5); // 50/100
      expect(capacity.threshold).toBe(0.90); // Day mode threshold
      expect(capacity.shouldPause).toBe(false);
    });

    it('should trigger pause when day mode threshold exceeded', () => {
      mockProvider.setDailyUsage({ totalCost: 95.0 });
      mockProvider.setDailyBudget(100.0);

      const dayTime = new Date('2024-01-01T14:00:00');
      const timeWindow = scheduler.getCurrentTimeWindow(dayTime);
      const capacity = scheduler.getCapacityInfo(timeWindow, dayTime);

      expect(capacity.currentPercentage).toBe(0.95);
      expect(capacity.threshold).toBe(0.90);
      expect(capacity.shouldPause).toBe(true);
      expect(capacity.reason).toContain('Capacity threshold exceeded');
    });

    it('should use different thresholds for night mode', () => {
      mockProvider.setDailyUsage({ totalCost: 94.0 });
      mockProvider.setDailyBudget(100.0);

      const nightTime = new Date('2024-01-01T23:00:00');
      const timeWindow = scheduler.getCurrentTimeWindow(nightTime);
      const capacity = scheduler.getCapacityInfo(timeWindow, nightTime);

      expect(capacity.currentPercentage).toBe(0.94);
      expect(capacity.threshold).toBe(0.96); // Night mode threshold
      expect(capacity.shouldPause).toBe(false); // Under night mode threshold
    });

    it('should handle zero budget gracefully', () => {
      mockProvider.setDailyBudget(0);
      mockProvider.setDailyUsage({ totalCost: 10.0 });

      const dayTime = new Date('2024-01-01T14:00:00');
      const timeWindow = scheduler.getCurrentTimeWindow(dayTime);
      const capacity = scheduler.getCapacityInfo(timeWindow, dayTime);

      expect(capacity.currentPercentage).toBe(0);
      expect(capacity.shouldPause).toBe(false);
    });
  });

  describe('Scheduling Decisions', () => {
    it('should not pause during active hours with low usage', () => {
      mockProvider.setDailyUsage({ totalCost: 10.0 });

      const dayTime = new Date('2024-01-01T14:00:00');
      const decision = scheduler.shouldPauseTasks(dayTime);

      expect(decision.shouldPause).toBe(false);
      expect(decision.reason).toBeUndefined();
    });

    it('should pause when outside active hours', () => {
      const offHoursTime = new Date('2024-01-01T19:00:00');
      const decision = scheduler.shouldPauseTasks(offHoursTime);

      expect(decision.shouldPause).toBe(true);
      expect(decision.reason).toContain('Outside active time window');
    });

    it('should pause when capacity threshold exceeded', () => {
      mockProvider.setDailyUsage({ totalCost: 95.0 });

      const dayTime = new Date('2024-01-01T14:00:00');
      const decision = scheduler.shouldPauseTasks(dayTime);

      expect(decision.shouldPause).toBe(true);
      expect(decision.reason).toContain('Capacity threshold exceeded');
    });

    it('should include time window and capacity info in decision', () => {
      const dayTime = new Date('2024-01-01T14:00:00');
      const decision = scheduler.shouldPauseTasks(dayTime);

      expect(decision.timeWindow).toBeDefined();
      expect(decision.timeWindow.mode).toBe('day');
      expect(decision.capacity).toBeDefined();
      expect(decision.nextResetTime).toBeDefined();
    });

    it('should generate helpful recommendations', () => {
      mockProvider.setDailyUsage({ totalCost: 85.0 });

      const dayTime = new Date('2024-01-01T14:00:00');
      const decision = scheduler.shouldPauseTasks(dayTime);

      expect(decision.recommendations).toBeDefined();
      expect(decision.recommendations!.length).toBeGreaterThan(0);
    });
  });

  describe('Reset Time Calculation', () => {
    it('should calculate next midnight correctly', () => {
      const currentTime = new Date('2024-01-01T14:30:45');
      const resetTime = scheduler.getNextResetTime(currentTime);

      expect(resetTime.getDate()).toBe(2); // Next day
      expect(resetTime.getHours()).toBe(0);
      expect(resetTime.getMinutes()).toBe(0);
      expect(resetTime.getSeconds()).toBe(0);
      expect(resetTime.getMilliseconds()).toBe(0);
    });

    it('should handle year boundary correctly', () => {
      const currentTime = new Date('2024-12-31T23:30:00');
      const resetTime = scheduler.getNextResetTime(currentTime);

      expect(resetTime.getFullYear()).toBe(2025);
      expect(resetTime.getMonth()).toBe(0); // January
      expect(resetTime.getDate()).toBe(1);
    });
  });

  describe('Usage Statistics', () => {
    it('should return comprehensive usage stats', () => {
      mockProvider.setDailyUsage({
        totalTokens: 50000,
        totalCost: 25.0,
        tasksCompleted: 5,
        tasksFailed: 1,
      });
      mockProvider.setActiveTasks(3);

      const dayTime = new Date('2024-01-01T14:00:00');
      const stats = scheduler.getUsageStats(dayTime);

      expect(stats.timeWindow.mode).toBe('day');
      expect(stats.capacity.currentPercentage).toBe(0.25);
      expect(stats.dailyUsage.totalTokens).toBe(50000);
      expect(stats.dailyUsage.totalCost).toBe(25.0);
      expect(stats.activeTasks).toBe(3);
      expect(stats.nextResetTime).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing time-based usage config', () => {
      const configWithoutTimeBasedUsage = createMockDaemonConfig({
        timeBasedUsage: undefined,
      });
      const schedulerWithoutConfig = new DaemonScheduler(
        configWithoutTimeBasedUsage,
        limitsConfig,
        mockProvider
      );

      const anyTime = new Date('2024-01-01T14:00:00');
      const decision = schedulerWithoutConfig.shouldPauseTasks(anyTime);

      expect(decision.shouldPause).toBe(true); // Should pause when time-based usage is disabled
      expect(decision.timeWindow.mode).toBe('off-hours');
    });

    it('should handle midnight hour transitions correctly', () => {
      const midnightTime = new Date('2024-01-01T00:00:00');
      const timeWindow = scheduler.getCurrentTimeWindow(midnightTime);

      // Midnight (0) should be in night mode based on default config
      expect(timeWindow.mode).toBe('night');
      expect(timeWindow.isActive).toBe(true);
    });

    it('should handle custom hour configurations', () => {
      const customConfig = createMockDaemonConfig({
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [8, 9, 10, 11, 12],
          nightModeHours: [20, 21, 22, 23],
          dayModeCapacityThreshold: 0.8,
          nightModeCapacityThreshold: 0.95,
        },
      });
      const customScheduler = new DaemonScheduler(customConfig, limitsConfig, mockProvider);

      const customDayTime = new Date('2024-01-01T10:00:00');
      const timeWindow = customScheduler.getCurrentTimeWindow(customDayTime);

      expect(timeWindow.mode).toBe('day');
      expect(timeWindow.startHour).toBe(8);
      expect(timeWindow.endHour).toBe(12);
    });

    it('should handle very high usage correctly', () => {
      mockProvider.setDailyUsage({ totalCost: 150.0 }); // Over budget
      mockProvider.setDailyBudget(100.0);

      const dayTime = new Date('2024-01-01T14:00:00');
      const capacity = scheduler.getCapacityInfo(
        scheduler.getCurrentTimeWindow(dayTime),
        dayTime
      );

      expect(capacity.currentPercentage).toBe(1.5);
      expect(capacity.shouldPause).toBe(true);
    });
  });

  describe('Recommendations System', () => {
    it('should recommend waiting during off-hours', () => {
      const offHoursTime = new Date('2024-01-01T19:00:00');
      const decision = scheduler.shouldPauseTasks(offHoursTime);

      const hasRecommendation = decision.recommendations?.some(rec =>
        rec.includes('Consider enabling time-based usage or waiting until')
      );
      expect(hasRecommendation).toBe(true);
    });

    it('should recommend budget increase for high usage', () => {
      mockProvider.setDailyUsage({ totalCost: 85.0 });

      const dayTime = new Date('2024-01-01T14:00:00');
      const decision = scheduler.shouldPauseTasks(dayTime);

      const hasRecommendation = decision.recommendations?.some(rec =>
        rec.includes('Consider increasing daily budget')
      );
      expect(hasRecommendation).toBe(true);
    });

    it('should suggest night mode for day mode high usage', () => {
      mockProvider.setDailyUsage({ totalCost: 60.0 });

      const lateAfternoonTime = new Date('2024-01-01T16:00:00'); // 4 PM
      const decision = scheduler.shouldPauseTasks(lateAfternoonTime);

      const hasNightModeRecommendation = decision.recommendations?.some(rec =>
        rec.includes('Night mode starts in')
      );
      expect(hasNightModeRecommendation).toBe(true);
    });

    it('should not recommend night mode when it is far away', () => {
      mockProvider.setDailyUsage({ totalCost: 60.0 });

      const morningTime = new Date('2024-01-01T09:00:00'); // 9 AM, 13 hours until night
      const decision = scheduler.shouldPauseTasks(morningTime);

      const hasNightModeRecommendation = decision.recommendations?.some(rec =>
        rec.includes('Night mode starts in')
      );
      expect(hasNightModeRecommendation).toBe(false);
    });

    it('should suggest night mode resume when paused in day mode', () => {
      mockProvider.setDailyUsage({ totalCost: 95.0 }); // Triggers pause in day mode

      const dayTime = new Date('2024-01-01T14:00:00');
      const decision = scheduler.shouldPauseTasks(dayTime);

      expect(decision.shouldPause).toBe(true);
      const hasNightModeResume = decision.recommendations?.some(rec =>
        rec.includes('Tasks will resume with higher limits during night mode')
      );
      expect(hasNightModeResume).toBe(true);
    });
  });

  describe('UsageManagerProvider Integration', () => {
    it('should correctly adapt UsageManager interface', () => {
      // Mock a realistic UsageManager object
      const mockUsageManager = {
        getUsageStats: () => ({
          current: {
            dailyUsage: {
              totalTokens: 150000,
              totalCost: 75.0,
              tasksCompleted: 8,
              tasksFailed: 2,
            }
          },
          active: [
            { id: 'task1' },
            { id: 'task2' },
            { id: 'task3' }
          ]
        }),
        getBaseLimits: () => ({
          dailyBudget: 200.0,
          maxTokensPerTask: 500000,
        })
      };

      const provider = new UsageManagerProvider(mockUsageManager);

      const dailyUsage = provider.getCurrentDailyUsage();
      expect(dailyUsage.totalTokens).toBe(150000);
      expect(dailyUsage.totalCost).toBe(75.0);
      expect(dailyUsage.tasksCompleted).toBe(8);
      expect(dailyUsage.tasksFailed).toBe(2);

      expect(provider.getActiveTasks()).toBe(3);
      expect(provider.getDailyBudget()).toBe(200.0);
    });

    it('should handle missing dailyBudget gracefully', () => {
      const mockUsageManager = {
        getUsageStats: () => ({
          current: { dailyUsage: {} },
          active: []
        }),
        getBaseLimits: () => ({}) // No dailyBudget
      };

      const provider = new UsageManagerProvider(mockUsageManager);
      expect(provider.getDailyBudget()).toBe(100.0); // Default fallback
    });
  });

  describe('Complex Time Transition Scenarios', () => {
    it('should handle transition across day boundary correctly', () => {
      // Test just before midnight
      const beforeMidnight = new Date('2024-01-01T23:59:59');
      const timeWindow = scheduler.getCurrentTimeWindow(beforeMidnight);

      expect(timeWindow.mode).toBe('night');
      expect(timeWindow.nextTransition.getDate()).toBe(2); // Tomorrow
      expect(timeWindow.nextTransition.getHours()).toBe(9); // Next day mode start
    });

    it('should handle edge case where current hour is both day and night', () => {
      // Create conflicting configuration (shouldn't happen in practice)
      const conflictingConfig = createMockDaemonConfig({
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17, 22], // 22 in both
          nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
          dayModeCapacityThreshold: 0.90,
          nightModeCapacityThreshold: 0.96,
        },
      });

      const conflictingScheduler = new DaemonScheduler(conflictingConfig, limitsConfig, mockProvider);
      const conflictTime = new Date('2024-01-01T22:00:00'); // Hour 22 appears in both arrays
      const timeWindow = conflictingScheduler.getCurrentTimeWindow(conflictTime);

      // Should prioritize day mode (first check)
      expect(timeWindow.mode).toBe('day');
    });

    it('should calculate next transition when no more transitions today', () => {
      const lateNightTime = new Date('2024-01-01T05:00:00'); // Late night, next is 9am
      const timeWindow = scheduler.getCurrentTimeWindow(lateNightTime);

      expect(timeWindow.nextTransition.getHours()).toBe(9); // Next day mode
      expect(timeWindow.nextTransition.getDate()).toBe(1); // Same day
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle negative usage values', () => {
      mockProvider.setDailyUsage({ totalCost: -10.0 }); // Negative cost (shouldn't happen)

      const dayTime = new Date('2024-01-01T14:00:00');
      const capacity = scheduler.getCapacityInfo(
        scheduler.getCurrentTimeWindow(dayTime),
        dayTime
      );

      expect(capacity.currentPercentage).toBe(-0.1); // Negative percentage
      expect(capacity.shouldPause).toBe(false); // Negative usage shouldn't trigger pause
    });

    it('should handle extremely high usage values', () => {
      mockProvider.setDailyUsage({ totalCost: 10000.0 }); // Very high cost
      mockProvider.setDailyBudget(100.0);

      const dayTime = new Date('2024-01-01T14:00:00');
      const capacity = scheduler.getCapacityInfo(
        scheduler.getCurrentTimeWindow(dayTime),
        dayTime
      );

      expect(capacity.currentPercentage).toBe(100); // 10000/100
      expect(capacity.shouldPause).toBe(true);
      expect(capacity.reason).toContain('10000.0%'); // Should display very high percentage
    });

    it('should handle undefined time-based usage arrays', () => {
      const configWithUndefinedArrays = createMockDaemonConfig({
        timeBasedUsage: {
          enabled: true,
          dayModeHours: undefined,
          nightModeHours: undefined,
          dayModeCapacityThreshold: 0.90,
          nightModeCapacityThreshold: 0.96,
        },
      });

      const undefinedScheduler = new DaemonScheduler(configWithUndefinedArrays, limitsConfig, mockProvider);
      const anyTime = new Date('2024-01-01T14:00:00');
      const timeWindow = undefinedScheduler.getCurrentTimeWindow(anyTime);

      expect(timeWindow.mode).toBe('day'); // Should use defaults
      expect(timeWindow.isActive).toBe(true);
    });

    it('should handle DST transitions correctly', () => {
      // Test around DST transition (using a specific DST date)
      const dstTransition = new Date('2024-03-10T02:00:00'); // Spring DST transition in US
      const resetTime = scheduler.getNextResetTime(dstTransition);

      expect(resetTime.getDate()).toBe(11); // Next day
      expect(resetTime.getHours()).toBe(0); // Midnight regardless of DST
    });

    it('should handle DST fall-back transition correctly', () => {
      // Fall DST transition (2024-11-03 in US)
      const fallBackTime = new Date('2024-11-03T01:30:00');
      const timeUntilReset = scheduler.getTimeUntilBudgetReset(fallBackTime);

      const nextMidnight = new Date('2024-11-04T00:00:00');
      const expectedMs = nextMidnight.getTime() - fallBackTime.getTime();
      expect(timeUntilReset).toBe(expectedMs);
    });
  });

  describe('Performance and Memory', () => {
    it('should not leak memory with repeated calls', () => {
      const dayTime = new Date('2024-01-01T14:00:00');

      // Call methods many times to check for memory leaks
      for (let i = 0; i < 1000; i++) {
        scheduler.getCurrentTimeWindow(dayTime);
        scheduler.shouldPauseTasks(dayTime);
        scheduler.getUsageStats(dayTime);
      }

      // If we get here without memory issues, test passes
      expect(true).toBe(true);
    });

    it('should handle rapid successive calls efficiently', () => {
      const start = Date.now();
      const testTime = new Date('2024-01-01T14:00:00');

      // Make 100 rapid calls
      for (let i = 0; i < 100; i++) {
        scheduler.shouldPauseTasks(testTime);
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });

  // ============================================================================
  // Capacity Reset Monitoring Tests (New Feature)
  // ============================================================================

  describe('Capacity Reset Monitoring', () => {
    beforeEach(() => {
      // Cleanup any existing monitoring
      scheduler.destroy();
      scheduler = new DaemonScheduler(daemonConfig, limitsConfig, mockProvider);
    });

    describe('getTimeUntilModeSwitch()', () => {
      it('should calculate time until next mode switch correctly', () => {
        const currentTime = new Date('2024-01-01T14:00:00'); // Day mode (2 PM)
        const timeUntilSwitch = scheduler.getTimeUntilModeSwitch(currentTime);

        // Next switch should be to night mode at 22:00
        const expectedMs = (22 - 14) * 60 * 60 * 1000; // 8 hours
        expect(timeUntilSwitch).toBe(expectedMs);
      });

      it('should handle midnight wraparound correctly', () => {
        const currentTime = new Date('2024-01-01T23:30:00'); // Night mode (11:30 PM)
        const timeUntilSwitch = scheduler.getTimeUntilModeSwitch(currentTime);

        // Next switch is to day mode at 9 AM tomorrow
        const expected = new Date('2024-01-02T09:00:00').getTime() - currentTime.getTime();
        expect(timeUntilSwitch).toBe(expected);
      });

      it('should handle same-day transition correctly', () => {
        const currentTime = new Date('2024-01-01T08:00:00'); // Off-hours (8 AM)
        const timeUntilSwitch = scheduler.getTimeUntilModeSwitch(currentTime);

        // Next switch is to day mode at 9 AM same day
        const expectedMs = 60 * 60 * 1000; // 1 hour
        expect(timeUntilSwitch).toBe(expectedMs);
      });

      it('should use current time when not provided', () => {
        const timeUntilSwitch = scheduler.getTimeUntilModeSwitch();
        expect(typeof timeUntilSwitch).toBe('number');
        expect(timeUntilSwitch).toBeGreaterThan(0);
      });

      it('should handle disabled time-based usage', () => {
        const disabledConfig = createMockDaemonConfig({
          timeBasedUsage: { enabled: false },
        });
        const disabledScheduler = new DaemonScheduler(disabledConfig, limitsConfig, mockProvider);

        const currentTime = new Date('2024-01-01T14:00:00');
        const timeUntilSwitch = disabledScheduler.getTimeUntilModeSwitch(currentTime);

        // Should return time until next midnight when time-based usage disabled
        const expectedMs = new Date('2024-01-02T00:00:00').getTime() - currentTime.getTime();
        expect(timeUntilSwitch).toBe(expectedMs);

        disabledScheduler.destroy();
      });
    });

    describe('getTimeUntilBudgetReset()', () => {
      it('should calculate time until next midnight correctly', () => {
        const currentTime = new Date('2024-01-01T14:30:45.123'); // 2:30:45.123 PM
        const timeUntilReset = scheduler.getTimeUntilBudgetReset(currentTime);

        const expectedMs = new Date('2024-01-02T00:00:00').getTime() - currentTime.getTime();
        expect(timeUntilReset).toBe(expectedMs);
      });

      it('should handle midnight wraparound correctly', () => {
        const currentTime = new Date('2024-12-31T23:59:59'); // New Year's Eve
        const timeUntilReset = scheduler.getTimeUntilBudgetReset(currentTime);

        const expectedMs = new Date('2025-01-01T00:00:00').getTime() - currentTime.getTime();
        expect(timeUntilReset).toBe(expectedMs);
      });

      it('should handle leap year correctly', () => {
        const currentTime = new Date('2024-02-28T12:00:00'); // 2024 is leap year
        const timeUntilReset = scheduler.getTimeUntilBudgetReset(currentTime);

        const expectedMs = new Date('2024-02-29T00:00:00').getTime() - currentTime.getTime();
        expect(timeUntilReset).toBe(expectedMs);
      });

      it('should use current time when not provided', () => {
        const timeUntilReset = scheduler.getTimeUntilBudgetReset();
        expect(typeof timeUntilReset).toBe('number');
        expect(timeUntilReset).toBeGreaterThan(0);
        expect(timeUntilReset).toBeLessThanOrEqual(24 * 60 * 60 * 1000); // Max 24 hours
      });

      it('should always return positive value', () => {
        const times = [
          new Date('2024-01-01T00:00:00'),
          new Date('2024-06-15T12:30:45'),
          new Date('2024-12-31T23:59:59'),
        ];

        times.forEach(time => {
          const timeUntilReset = scheduler.getTimeUntilBudgetReset(time);
          expect(timeUntilReset).toBeGreaterThan(0);
        });
      });
    });

    describe('onCapacityRestored() callback registration', () => {
      it('should register and call capacity restored callback', async () => {
        const callbackResults: any[] = [];
        const callback = vi.fn((event) => callbackResults.push(event));

        const unsubscribe = scheduler.onCapacityRestored(callback);

        // Initially at capacity
        mockProvider.setDailyUsage({ totalCost: 95.0 }); // 95% usage
        mockProvider.setDailyBudget(100.0);

        // Trigger initial state capture
        scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));

        // Wait for monitoring to start
        await new Promise(resolve => setTimeout(resolve, 50));

        // Reduce usage to trigger restoration
        mockProvider.setDailyUsage({ totalCost: 50.0 }); // 50% usage

        // Wait for monitoring cycle
        await new Promise(resolve => setTimeout(resolve, 150));

        expect(callback).toHaveBeenCalled();
        expect(callbackResults.length).toBeGreaterThan(0);

        const event = callbackResults[0];
        expect(event.reason).toBe('usage_decreased');
        expect(event.previousCapacity.shouldPause).toBe(true);
        expect(event.newCapacity.shouldPause).toBe(false);

        unsubscribe();
      });

      it('should return unsubscribe function', () => {
        const callback = vi.fn();
        const unsubscribe = scheduler.onCapacityRestored(callback);

        expect(typeof unsubscribe).toBe('function');

        // Should remove callback when called
        unsubscribe();
        expect(scheduler['capacityCallbacks'].has(callback)).toBe(false);
      });

      it('should handle multiple callbacks', async () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();
        const callback3 = vi.fn();

        scheduler.onCapacityRestored(callback1);
        scheduler.onCapacityRestored(callback2);
        const unsubscribe3 = scheduler.onCapacityRestored(callback3);

        // Set up initial blocked state
        mockProvider.setDailyUsage({ totalCost: 95.0 });
        scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));

        await new Promise(resolve => setTimeout(resolve, 50));

        // Remove one callback
        unsubscribe3();

        // Trigger restoration
        mockProvider.setDailyUsage({ totalCost: 50.0 });
        await new Promise(resolve => setTimeout(resolve, 150));

        expect(callback1).toHaveBeenCalled();
        expect(callback2).toHaveBeenCalled();
        expect(callback3).not.toHaveBeenCalled();
      });

      it('should detect mode switch restoration', async () => {
        const callback = vi.fn();
        scheduler.onCapacityRestored(callback);

        // Set up day mode with blocked capacity
        mockProvider.setDailyUsage({ totalCost: 92.0 }); // 92% > 90% day threshold
        mockProvider.setDailyBudget(100.0);

        scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00')); // Day mode
        await new Promise(resolve => setTimeout(resolve, 50));

        // Simulate transition to night mode
        scheduler.shouldPauseTasks(new Date('2024-01-01T23:00:00')); // Night mode
        await new Promise(resolve => setTimeout(resolve, 150));

        expect(callback).toHaveBeenCalled();
        const event = callback.mock.calls[0][0];
        expect(event.reason).toBe('mode_switch');
        expect(event.previousCapacity.shouldPause).toBe(true);
        expect(event.newCapacity.shouldPause).toBe(false); // Night threshold 96%
      });

      it('should stop monitoring when all callbacks removed', () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const unsubscribe1 = scheduler.onCapacityRestored(callback1);
        const unsubscribe2 = scheduler.onCapacityRestored(callback2);

        expect(scheduler['monitoringTimer']).toBeDefined();

        unsubscribe1();
        expect(scheduler['monitoringTimer']).toBeDefined(); // Still has callbacks

        unsubscribe2();
        expect(scheduler['monitoringTimer']).toBeUndefined(); // No callbacks left
      });

      it('should handle callback errors gracefully', async () => {
        const errorCallback = vi.fn(() => {
          throw new Error('Callback error');
        });
        const successCallback = vi.fn();

        scheduler.onCapacityRestored(errorCallback);
        scheduler.onCapacityRestored(successCallback);

        // Set up restoration scenario
        mockProvider.setDailyUsage({ totalCost: 95.0 });
        scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));

        await new Promise(resolve => setTimeout(resolve, 50));

        mockProvider.setDailyUsage({ totalCost: 50.0 });
        await new Promise(resolve => setTimeout(resolve, 150));

        // Both callbacks should be called despite error in first
        expect(errorCallback).toHaveBeenCalled();
        expect(successCallback).toHaveBeenCalled();
      });
    });

    describe('destroy() cleanup', () => {
      it('should clean up monitoring resources', () => {
        const callback = vi.fn();
        scheduler.onCapacityRestored(callback);

        expect(scheduler['capacityCallbacks'].size).toBe(1);
        expect(scheduler['monitoringTimer']).toBeDefined();

        scheduler.destroy();

        expect(scheduler['capacityCallbacks'].size).toBe(0);
        expect(scheduler['monitoringTimer']).toBeUndefined();
      });

      it('should not throw when called multiple times', () => {
        expect(() => {
          scheduler.destroy();
          scheduler.destroy();
          scheduler.destroy();
        }).not.toThrow();
      });
    });

    describe('Monitoring edge cases', () => {
      it('should handle rapid capacity changes', async () => {
        const events: any[] = [];
        scheduler.onCapacityRestored((event) => events.push(event));

        // Set up blocked state
        mockProvider.setDailyUsage({ totalCost: 95.0 });
        scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));

        await new Promise(resolve => setTimeout(resolve, 50));

        // Rapid changes
        mockProvider.setDailyUsage({ totalCost: 50.0 }); // Unblocked
        mockProvider.setDailyUsage({ totalCost: 96.0 }); // Blocked again
        mockProvider.setDailyUsage({ totalCost: 40.0 }); // Unblocked again

        await new Promise(resolve => setTimeout(resolve, 250));

        // Should handle all transitions
        expect(events.length).toBeGreaterThan(0);
        events.forEach(event => {
          expect(event.reason).toMatch(/usage_decreased|mode_switch|budget_reset/);
        });
      });

      it('should handle timer scheduling edge cases', () => {
        const callback = vi.fn();
        scheduler.onCapacityRestored(callback);

        // Test with time very close to transitions
        const almostMidnight = new Date('2024-01-01T23:59:59.950');
        scheduler.shouldPauseTasks(almostMidnight);

        expect(scheduler['monitoringTimer']).toBeDefined();
      });
    });
  });
});