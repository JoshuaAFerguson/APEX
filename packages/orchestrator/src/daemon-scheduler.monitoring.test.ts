import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DaemonScheduler,
  UsageStatsProvider,
  CapacityRestoredEvent,
  CapacityRestoredReason
} from './daemon-scheduler';
import { DaemonConfig, LimitsConfig } from '@apexcli/core';

// ============================================================================
// Test Utilities & Mocks for Capacity Reset Monitoring
// ============================================================================

class MonitoringMockProvider implements UsageStatsProvider {
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

const createMonitoringConfig = (overrides: Partial<DaemonConfig> = {}): DaemonConfig => ({
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
    dayModeCapacityThreshold: 0.80, // Lower threshold for easier testing
    nightModeCapacityThreshold: 0.95,
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

const createMonitoringLimits = (overrides: Partial<LimitsConfig> = {}): LimitsConfig => ({
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
// Capacity Reset Monitoring Test Suite
// ============================================================================

describe('DaemonScheduler - Capacity Reset Monitoring', () => {
  let scheduler: DaemonScheduler;
  let mockProvider: MonitoringMockProvider;
  let daemonConfig: DaemonConfig;
  let limitsConfig: LimitsConfig;

  beforeEach(() => {
    mockProvider = new MonitoringMockProvider();
    daemonConfig = createMonitoringConfig();
    limitsConfig = createMonitoringLimits();
    scheduler = new DaemonScheduler(daemonConfig, limitsConfig, mockProvider);
  });

  afterEach(() => {
    scheduler.destroy();
  });

  describe('Time Calculations - Edge Cases & Precision', () => {
    describe('getTimeUntilModeSwitch() edge cases', () => {
      it('should handle exact transition times', () => {
        // Test at exactly 9:00 AM (day mode start)
        const exactDayStart = new Date('2024-01-01T09:00:00.000');
        const timeUntilSwitch = scheduler.getTimeUntilModeSwitch(exactDayStart);

        // Should calculate to next transition (night mode start at 22:00)
        const expectedMs = 13 * 60 * 60 * 1000; // 13 hours
        expect(timeUntilSwitch).toBe(expectedMs);
      });

      it('should handle exact midnight', () => {
        const exactMidnight = new Date('2024-01-01T00:00:00.000');
        const timeUntilSwitch = scheduler.getTimeUntilModeSwitch(exactMidnight);

        // Midnight is in night mode, next switch is to day mode at 9 AM
        const expectedMs = 9 * 60 * 60 * 1000; // 9 hours
        expect(timeUntilSwitch).toBe(expectedMs);
      });

      it('should handle fractional seconds correctly', () => {
        const timeWithFraction = new Date('2024-01-01T14:30:45.678');
        const timeUntilSwitch = scheduler.getTimeUntilModeSwitch(timeWithFraction);

        // Should calculate precise time to 22:00:00.000
        const nextSwitch = new Date('2024-01-01T22:00:00.000');
        const expectedMs = nextSwitch.getTime() - timeWithFraction.getTime();
        expect(timeUntilSwitch).toBe(expectedMs);
      });

      it('should handle custom hour configurations with gaps', () => {
        const customConfig = createMonitoringConfig({
          timeBasedUsage: {
            enabled: true,
            dayModeHours: [9, 11], // Gap at 10 AM
            nightModeHours: [22, 23, 0],
            dayModeCapacityThreshold: 0.80,
            nightModeCapacityThreshold: 0.95,
          },
        });
        const customScheduler = new DaemonScheduler(customConfig, limitsConfig, mockProvider);

        // Test at 10 AM (off-hours between day modes)
        const gapTime = new Date('2024-01-01T10:00:00');
        const timeUntilSwitch = customScheduler.getTimeUntilModeSwitch(gapTime);

        // Next transition should be to day mode at 11 AM
        const expectedMs = 60 * 60 * 1000; // 1 hour
        expect(timeUntilSwitch).toBe(expectedMs);

        customScheduler.destroy();
      });

      it('should handle overlapping hour configurations', () => {
        const overlappingConfig = createMonitoringConfig({
          timeBasedUsage: {
            enabled: true,
            dayModeHours: [9, 10, 11, 12, 22], // 22 appears in both
            nightModeHours: [22, 23, 0, 1],
            dayModeCapacityThreshold: 0.80,
            nightModeCapacityThreshold: 0.95,
          },
        });
        const overlappingScheduler = new DaemonScheduler(overlappingConfig, limitsConfig, mockProvider);

        // Test at 22:00 (appears in both arrays)
        const conflictTime = new Date('2024-01-01T22:00:00');
        const timeWindow = overlappingScheduler.getCurrentTimeWindow(conflictTime);

        // Implementation should prioritize day mode (first match)
        expect(timeWindow.mode).toBe('day');

        const timeUntilSwitch = overlappingScheduler.getTimeUntilModeSwitch(conflictTime);
        expect(timeUntilSwitch).toBeGreaterThan(0);

        overlappingScheduler.destroy();
      });
    });

    describe('getTimeUntilBudgetReset() precision tests', () => {
      it('should handle very precise times', () => {
        const preciseTime = new Date('2024-01-01T23:59:59.999');
        const timeUntilReset = scheduler.getTimeUntilBudgetReset(preciseTime);

        // Should be exactly 1 millisecond until midnight
        expect(timeUntilReset).toBe(1);
      });

      it('should handle DST transitions correctly', () => {
        // Spring DST transition (2024-03-10 in US)
        const beforeDST = new Date('2024-03-10T01:30:00');
        const timeUntilReset = scheduler.getTimeUntilBudgetReset(beforeDST);

        // Should correctly calculate to next midnight despite DST
        const nextMidnight = new Date('2024-03-11T00:00:00');
        const expectedMs = nextMidnight.getTime() - beforeDST.getTime();
        expect(timeUntilReset).toBe(expectedMs);
      });

      it('should handle timezone edge cases', () => {
        // Test with different timezone-like scenarios
        const testTimes = [
          new Date('2024-06-21T12:00:00'), // Summer solstice
          new Date('2024-12-21T12:00:00'), // Winter solstice
          new Date('2024-02-29T12:00:00'), // Leap year day
        ];

        testTimes.forEach(time => {
          const timeUntilReset = scheduler.getTimeUntilBudgetReset(time);
          expect(timeUntilReset).toBeGreaterThan(0);
          expect(timeUntilReset).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
        });
      });
    });
  });

  describe('onCapacityRestored() - Comprehensive Testing', () => {
    it('should detect budget reset restoration', async () => {
      const events: CapacityRestoredEvent[] = [];
      scheduler.onCapacityRestored((event) => events.push(event));

      // Set up high usage that would trigger pause
      mockProvider.setDailyUsage({ totalCost: 85.0 }); // 85% > 80% threshold

      // Establish initial state
      scheduler.shouldPauseTasks(new Date('2024-01-01T23:00:00'));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate day change (budget reset)
      scheduler.shouldPauseTasks(new Date('2024-01-02T01:00:00'));
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(events.length).toBeGreaterThan(0);
      const budgetResetEvent = events.find(e => e.reason === 'budget_reset');
      if (budgetResetEvent) {
        expect(budgetResetEvent.reason).toBe('budget_reset');
        expect(budgetResetEvent.timestamp).toBeInstanceOf(Date);
        expect(budgetResetEvent.previousCapacity.shouldPause).toBe(true);
        expect(budgetResetEvent.newCapacity.shouldPause).toBe(false);
      }
    });

    it('should provide complete event information', async () => {
      const events: CapacityRestoredEvent[] = [];
      scheduler.onCapacityRestored((event) => events.push(event));

      // Set up blocked state
      mockProvider.setDailyUsage({ totalCost: 90.0 });
      scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Restore capacity
      mockProvider.setDailyUsage({ totalCost: 50.0 });
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(events.length).toBeGreaterThan(0);
      const event = events[0];

      // Verify all required fields
      expect(event).toHaveProperty('reason');
      expect(event).toHaveProperty('previousCapacity');
      expect(event).toHaveProperty('newCapacity');
      expect(event).toHaveProperty('timeWindow');
      expect(event).toHaveProperty('timestamp');

      expect(['mode_switch', 'budget_reset', 'usage_decreased']).toContain(event.reason);
      expect(event.previousCapacity.shouldPause).toBe(true);
      expect(event.newCapacity.shouldPause).toBe(false);
      expect(event.timeWindow.mode).toMatch(/day|night|off-hours/);
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should handle rapid consecutive restorations', async () => {
      const events: CapacityRestoredEvent[] = [];
      scheduler.onCapacityRestored((event) => events.push(event));

      // Start blocked
      mockProvider.setDailyUsage({ totalCost: 90.0 });
      scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Rapid state changes
      for (let i = 0; i < 5; i++) {
        mockProvider.setDailyUsage({ totalCost: i % 2 === 0 ? 50.0 : 90.0 });
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have captured multiple events
      expect(events.length).toBeGreaterThan(1);

      // All events should be valid
      events.forEach(event => {
        expect(['mode_switch', 'budget_reset', 'usage_decreased']).toContain(event.reason);
        expect(event.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should maintain callback isolation', async () => {
      const callback1Events: CapacityRestoredEvent[] = [];
      const callback2Events: CapacityRestoredEvent[] = [];
      const callback3Events: CapacityRestoredEvent[] = [];

      scheduler.onCapacityRestored((event) => callback1Events.push(event));
      scheduler.onCapacityRestored((event) => callback2Events.push(event));
      const unsubscribe3 = scheduler.onCapacityRestored((event) => callback3Events.push(event));

      // Set up restoration scenario
      mockProvider.setDailyUsage({ totalCost: 90.0 });
      scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Remove callback 3 before restoration
      unsubscribe3();

      mockProvider.setDailyUsage({ totalCost: 50.0 });
      await new Promise(resolve => setTimeout(resolve, 150));

      // Callbacks 1 and 2 should receive events, callback 3 should not
      expect(callback1Events.length).toBeGreaterThan(0);
      expect(callback2Events.length).toBeGreaterThan(0);
      expect(callback3Events.length).toBe(0);

      // Events should be equivalent but not identical (separate objects)
      expect(callback1Events[0]).toEqual(callback2Events[0]);
      expect(callback1Events[0]).not.toBe(callback2Events[0]); // Different object instances
    });

    it('should stop monitoring efficiently when no callbacks remain', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsubscribe1 = scheduler.onCapacityRestored(callback1);
      const unsubscribe2 = scheduler.onCapacityRestored(callback2);

      // Monitoring should be active
      expect(scheduler['monitoringTimer']).toBeDefined();
      expect(scheduler['capacityCallbacks'].size).toBe(2);

      // Remove first callback
      unsubscribe1();
      expect(scheduler['monitoringTimer']).toBeDefined(); // Still monitoring
      expect(scheduler['capacityCallbacks'].size).toBe(1);

      // Remove second callback
      unsubscribe2();
      expect(scheduler['monitoringTimer']).toBeUndefined(); // Monitoring stopped
      expect(scheduler['capacityCallbacks'].size).toBe(0);
    });
  });

  describe('Monitoring Timer Behavior', () => {
    it('should schedule checks at appropriate intervals', () => {
      const callback = vi.fn();
      scheduler.onCapacityRestored(callback);

      // Should have started monitoring
      expect(scheduler['monitoringTimer']).toBeDefined();

      // Timer should be scheduled for reasonable future time
      const timer = scheduler['monitoringTimer']!;
      expect(timer).toBeDefined();
    });

    it('should respect minimum check interval', () => {
      const callback = vi.fn();
      scheduler.onCapacityRestored(callback);

      // Trigger schedule with very short time until events
      const almostMidnight = new Date('2024-01-01T23:59:59.990');
      scheduler.shouldPauseTasks(almostMidnight);

      // Should still have a reasonable minimum interval
      expect(scheduler['monitoringTimer']).toBeDefined();
    });

    it('should handle monitoring restart after destroy', () => {
      const callback = vi.fn();

      scheduler.onCapacityRestored(callback);
      expect(scheduler['monitoringTimer']).toBeDefined();

      scheduler.destroy();
      expect(scheduler['monitoringTimer']).toBeUndefined();

      // Should restart monitoring when new callback added
      scheduler.onCapacityRestored(callback);
      expect(scheduler['monitoringTimer']).toBeDefined();
    });
  });

  describe('Integration with Time Window Changes', () => {
    it('should detect day to night mode transitions', async () => {
      const events: CapacityRestoredEvent[] = [];
      scheduler.onCapacityRestored((event) => events.push(event));

      // Set usage between day (80%) and night (95%) thresholds
      mockProvider.setDailyUsage({ totalCost: 85.0 }); // 85%

      // Start in day mode (should be blocked)
      scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Transition to night mode (should be unblocked)
      scheduler.shouldPauseTasks(new Date('2024-01-01T23:00:00'));
      await new Promise(resolve => setTimeout(resolve, 150));

      const modeSwitch = events.find(e => e.reason === 'mode_switch');
      expect(modeSwitch).toBeDefined();
      expect(modeSwitch!.previousCapacity.shouldPause).toBe(true);
      expect(modeSwitch!.newCapacity.shouldPause).toBe(false);
    });

    it('should detect night to day mode transitions', async () => {
      const events: CapacityRestoredEvent[] = [];
      scheduler.onCapacityRestored(callback => events.push(callback));

      // Set usage that would block night mode (rare but possible)
      mockProvider.setDailyUsage({ totalCost: 96.0 }); // 96%

      // Start in night mode (should be blocked at 96% > 95%)
      scheduler.shouldPauseTasks(new Date('2024-01-01T23:00:00'));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Transition to day mode (still blocked at 96% > 80%)
      scheduler.shouldPauseTasks(new Date('2024-01-02T09:00:00'));
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have detected mode switch but still be blocked
      const modeSwitch = events.find(e => e.reason === 'mode_switch');
      if (modeSwitch) {
        // Mode changed but capacity still blocked
        expect(modeSwitch.newCapacity.shouldPause).toBe(true);
      }
    });

    it('should handle off-hours to active mode transitions', async () => {
      const events: CapacityRestoredEvent[] = [];
      scheduler.onCapacityRestored(callback => events.push(callback));

      // Low usage, should not be blocked by capacity
      mockProvider.setDailyUsage({ totalCost: 50.0 });

      // Start in off-hours (blocked by time)
      scheduler.shouldPauseTasks(new Date('2024-01-01T19:00:00'));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Transition to active mode
      scheduler.shouldPauseTasks(new Date('2024-01-01T22:00:00'));
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should detect restoration due to time window change
      const modeSwitch = events.find(e => e.reason === 'mode_switch');
      expect(modeSwitch).toBeDefined();
      expect(modeSwitch!.previousCapacity.shouldPause).toBe(false); // Wasn't blocked by capacity
      expect(modeSwitch!.newCapacity.shouldPause).toBe(false);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle many callbacks efficiently', async () => {
      const callbacks: Array<() => void> = [];

      // Register 100 callbacks
      for (let i = 0; i < 100; i++) {
        const unsubscribe = scheduler.onCapacityRestored(() => {});
        callbacks.push(unsubscribe);
      }

      expect(scheduler['capacityCallbacks'].size).toBe(100);

      // Should still perform well
      const start = Date.now();
      mockProvider.setDailyUsage({ totalCost: 90.0 });
      scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));
      await new Promise(resolve => setTimeout(resolve, 50));

      mockProvider.setDailyUsage({ totalCost: 50.0 });
      await new Promise(resolve => setTimeout(resolve, 150));

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000); // Should complete quickly

      // Cleanup
      callbacks.forEach(unsubscribe => unsubscribe());
    });

    it('should not leak memory with repeated registrations', () => {
      // Register and unregister callbacks repeatedly
      for (let i = 0; i < 1000; i++) {
        const unsubscribe = scheduler.onCapacityRestored(() => {});
        unsubscribe();
      }

      expect(scheduler['capacityCallbacks'].size).toBe(0);
      expect(scheduler['monitoringTimer']).toBeUndefined();
    });

    it('should maintain performance under rapid state changes', async () => {
      const events: CapacityRestoredEvent[] = [];
      scheduler.onCapacityRestored(event => events.push(event));

      const start = Date.now();

      // Rapid state changes
      for (let i = 0; i < 50; i++) {
        mockProvider.setDailyUsage({ totalCost: i % 2 === 0 ? 90.0 : 50.0 });
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(3000); // Should handle rapid changes efficiently
      expect(events.length).toBeGreaterThan(0); // Should capture some events
    });
  });

  describe('Error Resilience', () => {
    it('should handle null/undefined usage data gracefully', async () => {
      const events: CapacityRestoredEvent[] = [];
      const callback = vi.fn(event => events.push(event));

      scheduler.onCapacityRestored(callback);

      // Set up invalid data scenarios
      mockProvider.setDailyUsage({
        totalCost: null as any,
        totalTokens: undefined as any,
        tasksCompleted: NaN,
        tasksFailed: Infinity
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should not crash
      expect(() => scheduler.shouldPauseTasks(new Date())).not.toThrow();
    });

    it('should recover from callback execution errors', async () => {
      let callCount = 0;
      const errorCallback = vi.fn(() => {
        callCount++;
        throw new Error('Callback error');
      });
      const successCallback = vi.fn();

      scheduler.onCapacityRestored(errorCallback);
      scheduler.onCapacityRestored(successCallback);

      // Set up restoration scenario
      mockProvider.setDailyUsage({ totalCost: 90.0 });
      scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));
      await new Promise(resolve => setTimeout(resolve, 50));

      mockProvider.setDailyUsage({ totalCost: 50.0 });
      await new Promise(resolve => setTimeout(resolve, 150));

      // Both should be called despite error in first
      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
      expect(callCount).toBeGreaterThan(0);
    });
  });
});