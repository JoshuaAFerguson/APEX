import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DaemonScheduler } from './daemon-scheduler';
import { CapacityMonitor } from './capacity-monitor';
import { UsageManager } from './usage-manager';
import { CapacityMonitorUsageAdapter } from './capacity-monitor-usage-adapter';
import { DaemonConfig, LimitsConfig, Task, TaskStatus } from '@apexcli/core';
import { EventEmitter } from 'eventemitter3';

// Mock usage stats provider for testing
class MockUsageStatsProvider {
  private dailyUsage = {
    totalTokens: 0,
    totalCost: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
  };
  private activeTasks = 0;
  private dailyBudget = 100.0;

  getCurrentDailyUsage() {
    return this.dailyUsage;
  }

  getActiveTasks() {
    return this.activeTasks;
  }

  getDailyBudget() {
    return this.dailyBudget;
  }

  // Test helpers
  setDailyCost(cost: number) {
    this.dailyUsage.totalCost = cost;
  }

  setActiveTasks(count: number) {
    this.activeTasks = count;
  }

  setBudget(budget: number) {
    this.dailyBudget = budget;
  }
}

describe('Time-Based Auto-Pause and Auto-Resume Functionality', () => {
  let mockDate: Date;
  let scheduler: DaemonScheduler;
  let capacityMonitor: CapacityMonitor;
  let usageManager: UsageManager;
  let usageAdapter: CapacityMonitorUsageAdapter;
  let mockUsageProvider: MockUsageStatsProvider;
  let baseConfig: DaemonConfig;
  let baseLimits: LimitsConfig;
  let eventEmitter: EventEmitter;

  beforeEach(() => {
    // Set up a consistent date for testing - Tuesday, 2024-01-02 at 10:30 AM (day mode)
    mockDate = new Date('2024-01-02T10:30:00');
    vi.setSystemTime(mockDate);

    baseConfig = {
      timeBasedUsage: {
        enabled: true,
        dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
        dayModeCapacityThreshold: 0.70, // 70% of daily budget
        nightModeCapacityThreshold: 0.90, // 90% of daily budget
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

    baseLimits = {
      dailyBudget: 100.0,
      maxTokensPerTask: 500000,
      maxCostPerTask: 10.0,
      maxConcurrentTasks: 3,
    };

    mockUsageProvider = new MockUsageStatsProvider();
    scheduler = new DaemonScheduler(baseConfig, baseLimits, mockUsageProvider);

    usageManager = new UsageManager(baseConfig, baseLimits);
    usageAdapter = new CapacityMonitorUsageAdapter(usageManager, baseConfig, baseLimits);
    capacityMonitor = new CapacityMonitor(baseConfig, baseLimits, usageAdapter);

    eventEmitter = new EventEmitter();
  });

  afterEach(() => {
    capacityMonitor.stop();
    vi.useRealTimers();
  });

  describe('Auto-Pause Functionality', () => {
    it('should trigger auto-pause when day mode capacity threshold is exceeded', () => {
      // Set usage to exceed day mode threshold (70% of $100 = $70)
      mockUsageProvider.setDailyCost(75.0);

      const decision = scheduler.shouldPauseTasks();

      expect(decision.shouldPause).toBe(true);
      expect(decision.reason).toContain('Daily budget usage (75%) exceeds day mode threshold (70%)');
      expect(decision.timeWindow.mode).toBe('day');
      expect(decision.capacity.threshold).toBe(0.70);
      expect(decision.capacity.currentPercentage).toBe(0.75);
    });

    it('should trigger auto-pause when night mode capacity threshold is exceeded', () => {
      // Switch to night mode
      vi.setSystemTime(new Date('2024-01-02T23:00:00'));
      scheduler = new DaemonScheduler(baseConfig, baseLimits, mockUsageProvider);

      // Set usage to exceed night mode threshold (90% of $100 = $90)
      mockUsageProvider.setDailyCost(95.0);

      const decision = scheduler.shouldPauseTasks();

      expect(decision.shouldPause).toBe(true);
      expect(decision.reason).toContain('Daily budget usage (95%) exceeds night mode threshold (90%)');
      expect(decision.timeWindow.mode).toBe('night');
      expect(decision.capacity.threshold).toBe(0.90);
      expect(decision.capacity.currentPercentage).toBe(0.95);
    });

    it('should not auto-pause when usage is below threshold', () => {
      // Set usage below day mode threshold
      mockUsageProvider.setDailyCost(60.0);

      const decision = scheduler.shouldPauseTasks();

      expect(decision.shouldPause).toBe(false);
      expect(decision.reason).toBe('Tasks can proceed normally');
      expect(decision.capacity.currentPercentage).toBe(0.60);
    });

    it('should auto-pause during off-hours regardless of threshold', () => {
      // Set time to off-hours (8:00 AM)
      vi.setSystemTime(new Date('2024-01-02T08:00:00'));
      scheduler = new DaemonScheduler(baseConfig, baseLimits, mockUsageProvider);

      // Set usage below all thresholds
      mockUsageProvider.setDailyCost(30.0);

      const decision = scheduler.shouldPauseTasks();

      expect(decision.shouldPause).toBe(true);
      expect(decision.reason).toContain('Currently in off-hours');
      expect(decision.timeWindow.mode).toBe('off-hours');
    });

    it('should handle disabled time-based usage (always uses off-hours logic)', () => {
      const disabledConfig = {
        ...baseConfig,
        timeBasedUsage: {
          ...baseConfig.timeBasedUsage!,
          enabled: false,
        },
      };

      scheduler = new DaemonScheduler(disabledConfig, baseLimits, mockUsageProvider);
      mockUsageProvider.setDailyCost(50.0);

      const decision = scheduler.shouldPauseTasks();

      expect(decision.timeWindow.mode).toBe('off-hours');
      // When time-based usage is disabled, should use base limit behavior
    });
  });

  describe('Auto-Resume Functionality', () => {
    it('should detect capacity restoration when usage drops below threshold', () => {
      const capacityEvents: string[] = [];

      capacityMonitor.on('capacity:restored', (event) => {
        capacityEvents.push(event.reason);
      });

      capacityMonitor.start();

      // Simulate high usage, then drop
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskCompletion('task1', {
        inputTokens: 35000,
        outputTokens: 35000,
        totalTokens: 70000,
        estimatedCost: 80.0, // Above day threshold
      }, true);

      // Check capacity - should be above threshold
      capacityMonitor.checkCapacity();

      // Complete some tasks to reduce usage
      usageManager.resetDailyStats(); // Simulate usage dropping
      usageManager.trackTaskCompletion('smallTask', {
        inputTokens: 5000,
        outputTokens: 5000,
        totalTokens: 10000,
        estimatedCost: 30.0, // Below day threshold
      }, true);

      // Check capacity again
      capacityMonitor.checkCapacity();

      // Should detect capacity restoration
      expect(capacityEvents).toContain('capacity_dropped');
    });

    it('should detect capacity restoration on time mode switch from day to night', () => {
      const capacityEvents: Array<{reason: string, fromMode: string, toMode: string}> = [];

      capacityMonitor.on('capacity:restored', (event) => {
        capacityEvents.push({
          reason: event.reason,
          fromMode: event.fromMode,
          toMode: event.toMode,
        });
      });

      capacityMonitor.start();

      // Set usage that exceeds day threshold but not night threshold
      usageManager.trackTaskCompletion('task1', {
        inputTokens: 40000,
        outputTokens: 40000,
        totalTokens: 80000,
        estimatedCost: 80.0, // 80% - above day (70%) but below night (90%)
      }, true);

      // Switch to night mode
      vi.setSystemTime(new Date('2024-01-02T22:00:00'));

      // Create new usage manager for night mode
      usageManager = new UsageManager(baseConfig, baseLimits);
      usageAdapter = new CapacityMonitorUsageAdapter(usageManager, baseConfig, baseLimits);
      capacityMonitor.stop();
      capacityMonitor = new CapacityMonitor(baseConfig, baseLimits, usageAdapter);

      capacityMonitor.on('capacity:restored', (event) => {
        capacityEvents.push({
          reason: event.reason,
          fromMode: event.fromMode,
          toMode: event.toMode,
        });
      });

      capacityMonitor.start();

      // Restore previous usage
      usageManager.trackTaskCompletion('previousTask', {
        inputTokens: 40000,
        outputTokens: 40000,
        totalTokens: 80000,
        estimatedCost: 80.0,
      }, true);

      // Trigger mode switch detection
      capacityMonitor.checkCapacity();

      // Should detect mode switch restoration
      const modeSwitchEvents = capacityEvents.filter(e => e.reason === 'mode_switch');
      expect(modeSwitchEvents.length).toBeGreaterThan(0);
    });

    it('should detect capacity restoration on daily budget reset', () => {
      const capacityEvents: string[] = [];

      capacityMonitor.on('capacity:restored', (event) => {
        capacityEvents.push(event.reason);
      });

      capacityMonitor.start();

      // Set usage near budget limit
      usageManager.trackTaskCompletion('expensiveTask', {
        inputTokens: 50000,
        outputTokens: 50000,
        totalTokens: 100000,
        estimatedCost: 95.0,
      }, true);

      // Simulate midnight (budget reset)
      vi.setSystemTime(new Date('2024-01-03T00:00:00'));
      usageManager.resetDailyStats(); // This would be called by daemon at midnight

      capacityMonitor.checkCapacity();

      expect(capacityEvents).toContain('budget_reset');
    });
  });

  describe('Time Window Calculation', () => {
    it('should correctly identify time windows and transitions', () => {
      // Test day mode
      let timeWindow = scheduler.getCurrentTimeWindow();
      expect(timeWindow.mode).toBe('day');
      expect(timeWindow.isActive).toBe(true);

      // Test night mode
      vi.setSystemTime(new Date('2024-01-02T23:00:00'));
      scheduler = new DaemonScheduler(baseConfig, baseLimits, mockUsageProvider);

      timeWindow = scheduler.getCurrentTimeWindow();
      expect(timeWindow.mode).toBe('night');
      expect(timeWindow.isActive).toBe(true);

      // Test off-hours
      vi.setSystemTime(new Date('2024-01-02T08:00:00'));
      scheduler = new DaemonScheduler(baseConfig, baseLimits, mockUsageProvider);

      timeWindow = scheduler.getCurrentTimeWindow();
      expect(timeWindow.mode).toBe('off-hours');
      expect(timeWindow.isActive).toBe(false); // Off-hours are typically inactive
    });

    it('should calculate next transition time correctly', () => {
      // At 10:30 AM, next transition should be to night mode at 10 PM
      let timeWindow = scheduler.getCurrentTimeWindow();
      expect(timeWindow.nextTransition.getHours()).toBe(22);

      // At 11 PM, next transition should be to next day mode
      vi.setSystemTime(new Date('2024-01-02T23:00:00'));
      scheduler = new DaemonScheduler(baseConfig, baseLimits, mockUsageProvider);

      timeWindow = scheduler.getCurrentTimeWindow();
      // Should transition to next mode (depends on configuration)
      expect(timeWindow.nextTransition).toBeInstanceOf(Date);
      expect(timeWindow.nextTransition.getTime()).toBeGreaterThan(new Date('2024-01-02T23:00:00').getTime());
    });
  });

  describe('Capacity Threshold Calculation', () => {
    it('should calculate capacity correctly for different modes', () => {
      // Day mode with 70% budget used
      mockUsageProvider.setDailyCost(70.0);
      let timeWindow = scheduler.getCurrentTimeWindow();
      let capacity = scheduler.getCapacityInfo(timeWindow);

      expect(capacity.currentPercentage).toBe(0.70);
      expect(capacity.threshold).toBe(0.70); // Day mode threshold
      expect(capacity.shouldPause).toBe(true); // At threshold

      // Night mode with same usage
      vi.setSystemTime(new Date('2024-01-02T23:00:00'));
      scheduler = new DaemonScheduler(baseConfig, baseLimits, mockUsageProvider);

      timeWindow = scheduler.getCurrentTimeWindow();
      capacity = scheduler.getCapacityInfo(timeWindow);

      expect(capacity.currentPercentage).toBe(0.70);
      expect(capacity.threshold).toBe(0.90); // Night mode threshold
      expect(capacity.shouldPause).toBe(false); // Below night threshold
    });

    it('should handle edge cases in capacity calculation', () => {
      // Zero budget
      mockUsageProvider.setBudget(0);
      mockUsageProvider.setDailyCost(0);

      let timeWindow = scheduler.getCurrentTimeWindow();
      let capacity = scheduler.getCapacityInfo(timeWindow);

      expect(capacity.currentPercentage).toBe(0);
      expect(capacity.shouldPause).toBe(false);

      // Usage exceeds budget
      mockUsageProvider.setBudget(100);
      mockUsageProvider.setDailyCost(150); // 150% of budget

      capacity = scheduler.getCapacityInfo(timeWindow);

      expect(capacity.currentPercentage).toBe(1.5);
      expect(capacity.shouldPause).toBe(true);
    });
  });

  describe('Integration with UsageManager', () => {
    it('should integrate capacity monitoring with actual usage tracking', () => {
      // Start with clean state
      const canStart = usageManager.canStartTask({ estimatedCost: 4.0 });
      expect(canStart.allowed).toBe(true);

      // Add tasks to approach capacity threshold
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskCompletion('task1', {
        inputTokens: 35000,
        outputTokens: 35000,
        totalTokens: 70000,
        estimatedCost: 75.0, // Exceeds day mode threshold
      }, true);

      // Usage manager should now reject new tasks
      const result = usageManager.canStartTask({ estimatedCost: 4.0 });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Daily budget limit reached');

      // Capacity adapter should reflect the high usage
      const currentUsage = usageAdapter.getCurrentUsage();
      expect(currentUsage.dailySpent).toBe(75.0);
      expect(currentUsage.currentCost).toBe(75.0);
    });

    it('should handle mode transitions in integrated scenarios', () => {
      // Setup day mode usage just below threshold
      usageManager.trackTaskCompletion('dayTask', {
        inputTokens: 30000,
        outputTokens: 30000,
        totalTokens: 60000,
        estimatedCost: 65.0, // Below day threshold (70%)
      }, true);

      let canStart = usageManager.canStartTask({ estimatedCost: 10.0 });
      expect(canStart.allowed).toBe(false); // Would exceed threshold

      // Switch to night mode
      vi.setSystemTime(new Date('2024-01-02T23:00:00'));
      usageManager = new UsageManager(baseConfig, baseLimits);

      // Restore usage
      usageManager.trackTaskCompletion('previousTask', {
        inputTokens: 30000,
        outputTokens: 30000,
        totalTokens: 60000,
        estimatedCost: 65.0,
      }, true);

      // Should now allow higher cost tasks in night mode
      canStart = usageManager.canStartTask({ estimatedCost: 10.0 });
      expect(canStart.allowed).toBe(true); // 65% + 10% = 75% < 90% night threshold
    });
  });
});