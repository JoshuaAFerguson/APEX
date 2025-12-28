import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UsageManager } from './usage-manager';
import { CapacityMonitor } from './capacity-monitor';
import { CapacityMonitorUsageAdapter } from './capacity-monitor-usage-adapter';
import { DaemonConfig, LimitsConfig } from '@apexcli/core';

describe('Time-Based Capacity Threshold Enforcement', () => {
  let mockDate: Date;
  let usageManager: UsageManager;
  let capacityMonitor: CapacityMonitor;
  let usageAdapter: CapacityMonitorUsageAdapter;
  let baseConfig: DaemonConfig;
  let baseLimits: LimitsConfig;

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

    usageManager = new UsageManager(baseConfig, baseLimits);
    usageAdapter = new CapacityMonitorUsageAdapter(usageManager, baseConfig, baseLimits);
    capacityMonitor = new CapacityMonitor(baseConfig, baseLimits, usageAdapter);
  });

  afterEach(() => {
    capacityMonitor.stop();
    vi.useRealTimers();
  });

  describe('Daily Budget Capacity Threshold Enforcement', () => {
    it('should reject tasks when day mode capacity threshold is exceeded', () => {
      // Simulate usage that exceeds day mode threshold (70% of $100 = $70)
      // Add tasks that total $75 in cost
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskCompletion('task1', {
        inputTokens: 10000,
        outputTokens: 10000,
        totalTokens: 20000,
        estimatedCost: 40.0,
      }, true);

      usageManager.trackTaskStart('task2');
      usageManager.trackTaskCompletion('task2', {
        inputTokens: 15000,
        outputTokens: 15000,
        totalTokens: 30000,
        estimatedCost: 35.0,
      }, true);

      // Total cost is now $75, which exceeds 70% threshold ($70)
      // But new task should be rejected because daily budget is exceeded
      const result = usageManager.canStartTask({ estimatedCost: 3.0 });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily budget limit reached');
    });

    it('should allow tasks in night mode that were blocked in day mode due to higher threshold', () => {
      // Setup: Use 80% of budget in day mode (below night threshold but above day threshold)
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskCompletion('task1', {
        inputTokens: 40000,
        outputTokens: 40000,
        totalTokens: 80000,
        estimatedCost: 80.0,
      }, true);

      // In day mode, additional tasks should be blocked (over 70% threshold)
      let result = usageManager.canStartTask({ estimatedCost: 5.0 });
      expect(result.allowed).toBe(false);

      // Switch to night mode (90% threshold)
      vi.setSystemTime(new Date('2024-01-02T23:00:00'));
      usageManager = new UsageManager(baseConfig, baseLimits);

      // Restore usage (in real implementation this would be persisted)
      usageManager.trackTaskCompletion('previousTask', {
        inputTokens: 40000,
        outputTokens: 40000,
        totalTokens: 80000,
        estimatedCost: 80.0,
      }, true);

      // Now tasks should be allowed in night mode (80% < 90% threshold)
      result = usageManager.canStartTask({ estimatedCost: 5.0 });
      expect(result.allowed).toBe(true);
    });

    it('should track capacity usage across different time modes', () => {
      const currentUsage = usageAdapter.getCurrentUsage();

      expect(currentUsage.dailyBudget).toBe(100.0);
      expect(currentUsage.dailySpent).toBe(0);
      expect(currentUsage.activeTasks).toBe(0);

      // Start tasks in day mode
      usageManager.trackTaskStart('dayTask1');
      usageManager.trackTaskStart('dayTask2');

      let updatedUsage = usageAdapter.getCurrentUsage();
      expect(updatedUsage.activeTasks).toBe(2);
      expect(updatedUsage.maxConcurrentTasks).toBe(2); // Day mode limit

      // Complete one task
      usageManager.trackTaskCompletion('dayTask1', {
        inputTokens: 5000,
        outputTokens: 5000,
        totalTokens: 10000,
        estimatedCost: 30.0,
      }, true);

      updatedUsage = usageAdapter.getCurrentUsage();
      expect(updatedUsage.activeTasks).toBe(1);
      expect(updatedUsage.dailySpent).toBe(30.0);
      expect(updatedUsage.currentCost).toBe(30.0);
    });

    it('should get correct thresholds for current time mode', () => {
      // Day mode thresholds
      let thresholds = usageAdapter.getThresholds();
      expect(thresholds.tokensThreshold).toBe(100000); // Day mode token limit
      expect(thresholds.costThreshold).toBe(5.0); // Day mode cost limit
      expect(thresholds.concurrentThreshold).toBe(2); // Day mode concurrent limit
      expect(thresholds.budgetThreshold).toBe(100.0); // Daily budget

      // Switch to night mode
      vi.setSystemTime(new Date('2024-01-02T23:00:00'));
      usageManager = new UsageManager(baseConfig, baseLimits);
      usageAdapter = new CapacityMonitorUsageAdapter(usageManager, baseConfig, baseLimits);

      // Night mode thresholds
      thresholds = usageAdapter.getThresholds();
      expect(thresholds.tokensThreshold).toBe(1000000); // Night mode token limit
      expect(thresholds.costThreshold).toBe(20.0); // Night mode cost limit
      expect(thresholds.concurrentThreshold).toBe(5); // Night mode concurrent limit
      expect(thresholds.budgetThreshold).toBe(100.0); // Daily budget (same)
    });
  });

  describe('Per-Task Threshold Enforcement', () => {
    it('should enforce different token limits for day and night modes', () => {
      // Day mode - reject high token task
      let result = usageManager.canStartTask({ totalTokens: 200000 });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Estimated token usage (200000) exceeds limit (100000)');

      // Switch to night mode
      vi.setSystemTime(new Date('2024-01-02T23:00:00'));
      usageManager = new UsageManager(baseConfig, baseLimits);

      // Night mode - allow the same high token task
      result = usageManager.canStartTask({ totalTokens: 200000 });
      expect(result.allowed).toBe(true);

      // But still reject extremely high token usage
      result = usageManager.canStartTask({ totalTokens: 2000000 });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Estimated token usage (2000000) exceeds limit (1000000)');
    });

    it('should enforce different cost limits for day and night modes', () => {
      // Day mode - reject high cost task
      let result = usageManager.canStartTask({ estimatedCost: 10.0 });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Estimated task cost (10) exceeds limit (5)');

      // Switch to night mode
      vi.setSystemTime(new Date('2024-01-02T23:00:00'));
      usageManager = new UsageManager(baseConfig, baseLimits);

      // Night mode - allow the same high cost task
      result = usageManager.canStartTask({ estimatedCost: 10.0 });
      expect(result.allowed).toBe(true);

      // But still reject extremely high cost
      result = usageManager.canStartTask({ estimatedCost: 50.0 });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Estimated task cost (50) exceeds limit (20)');
    });

    it('should enforce different concurrent task limits for day and night modes', () => {
      // Day mode - allow up to 2 concurrent tasks
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskStart('task2');

      let result = usageManager.canStartTask();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Maximum concurrent tasks reached (2)');

      // Switch to night mode
      vi.setSystemTime(new Date('2024-01-02T23:00:00'));
      usageManager = new UsageManager(baseConfig, baseLimits);

      // Re-add existing tasks (in real implementation task state would be preserved)
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskStart('task2');

      // Night mode - should allow more concurrent tasks
      result = usageManager.canStartTask();
      expect(result.allowed).toBe(true);
      expect(result.thresholds.maxConcurrentTasks).toBe(5);

      // Add more tasks up to night mode limit
      usageManager.trackTaskStart('task3');
      usageManager.trackTaskStart('task4');
      usageManager.trackTaskStart('task5');

      // Now should be at limit
      result = usageManager.canStartTask();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Maximum concurrent tasks reached (5)');
    });
  });

  describe('Mode Info and Status Tracking', () => {
    it('should provide correct mode information', () => {
      const modeInfo = usageAdapter.getModeInfo();

      expect(modeInfo.mode).toBe('day');
      expect(modeInfo.modeHours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
      expect(modeInfo.nextModeSwitch).toBeInstanceOf(Date);
      expect(modeInfo.nextMidnight).toBeInstanceOf(Date);

      // Check next mode switch is calculated correctly
      expect(modeInfo.nextModeSwitch.getHours()).toBe(22); // Next transition to night mode
      expect(modeInfo.nextMidnight.getDate()).toBe(3); // Next day
    });

    it('should provide correct off-hours mode information', () => {
      // Set time to off-hours (8 AM)
      vi.setSystemTime(new Date('2024-01-02T08:00:00'));
      usageManager = new UsageManager(baseConfig, baseLimits);
      usageAdapter = new CapacityMonitorUsageAdapter(usageManager, baseConfig, baseLimits);

      const modeInfo = usageAdapter.getModeInfo();

      expect(modeInfo.mode).toBe('off-hours');
      expect(modeInfo.modeHours).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]); // Default off-hours
      expect(modeInfo.nextModeSwitch.getHours()).toBe(9); // Next transition to day mode
    });

    it('should track usage statistics across modes', () => {
      // Complete tasks in day mode
      usageManager.trackTaskStart('dayTask');
      usageManager.trackTaskCompletion('dayTask', {
        inputTokens: 5000,
        outputTokens: 3000,
        totalTokens: 8000,
        estimatedCost: 4.0,
      }, true);

      let stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.modeBreakdown.day.cost).toBe(4.0);
      expect(stats.current.dailyUsage.modeBreakdown.day.tokens).toBe(8000);
      expect(stats.current.dailyUsage.modeBreakdown.night.cost).toBe(0);

      // Switch to night mode and complete more tasks
      vi.setSystemTime(new Date('2024-01-02T23:00:00'));
      usageManager = new UsageManager(baseConfig, baseLimits);

      // Restore previous usage
      usageManager.trackTaskCompletion('previousTask', {
        inputTokens: 5000,
        outputTokens: 3000,
        totalTokens: 8000,
        estimatedCost: 4.0,
      }, true);

      usageManager.trackTaskStart('nightTask');
      usageManager.trackTaskCompletion('nightTask', {
        inputTokens: 20000,
        outputTokens: 10000,
        totalTokens: 30000,
        estimatedCost: 15.0,
      }, true);

      stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.modeBreakdown.night.cost).toBe(15.0);
      expect(stats.current.dailyUsage.modeBreakdown.night.tokens).toBe(30000);
      expect(stats.current.dailyUsage.totalCost).toBe(19.0); // 4.0 + 15.0
      expect(stats.current.dailyUsage.totalTokens).toBe(38000); // 8000 + 30000
    });
  });

  describe('Integration with Base Limits', () => {
    it('should respect global daily budget limit', () => {
      // Test that daily budget is enforced regardless of time mode
      usageManager.trackTaskStart('expensiveTask');
      usageManager.trackTaskCompletion('expensiveTask', {
        inputTokens: 50000,
        outputTokens: 50000,
        totalTokens: 100000,
        estimatedCost: 100.0, // Exactly at daily budget
      }, true);

      // Should reject any new task due to budget exhaustion
      const result = usageManager.canStartTask({ estimatedCost: 1.0 });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Daily budget limit reached');
    });

    it('should use base limits in off-hours mode when time-based usage is disabled', () => {
      const disabledConfig = {
        ...baseConfig,
        timeBasedUsage: {
          ...baseConfig.timeBasedUsage!,
          enabled: false,
        },
      };

      usageManager = new UsageManager(disabledConfig, baseLimits);
      usageAdapter = new CapacityMonitorUsageAdapter(usageManager, disabledConfig, baseLimits);

      const usage = usageManager.getCurrentUsage();
      expect(usage.currentMode).toBe('off-hours');
      expect(usage.thresholds.maxTokensPerTask).toBe(500000); // Base limit
      expect(usage.thresholds.maxCostPerTask).toBe(10.0); // Base limit
      expect(usage.thresholds.maxConcurrentTasks).toBe(3); // Base limit

      const thresholds = usageAdapter.getThresholds();
      expect(thresholds.tokensThreshold).toBe(500000);
      expect(thresholds.costThreshold).toBe(10.0);
      expect(thresholds.concurrentThreshold).toBe(3);
    });

    it('should handle missing base limits gracefully', () => {
      const incompleteLimits: Partial<LimitsConfig> = {
        dailyBudget: 50.0,
        // Missing other limits
      };

      usageManager = new UsageManager(baseConfig, incompleteLimits as LimitsConfig);
      usageAdapter = new CapacityMonitorUsageAdapter(usageManager, baseConfig, incompleteLimits as LimitsConfig);

      const usage = usageAdapter.getCurrentUsage();
      expect(usage.dailyBudget).toBe(50.0);

      // Should fall back to time-based mode limits when base limits are missing
      const currentUsage = usageManager.getCurrentUsage();
      expect(currentUsage.thresholds.maxTokensPerTask).toBe(100000); // Day mode default
      expect(currentUsage.thresholds.maxCostPerTask).toBe(5.0); // Day mode default
    });
  });
});