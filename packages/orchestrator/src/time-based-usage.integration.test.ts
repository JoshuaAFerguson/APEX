import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UsageManager } from './usage-manager';
import { DaemonConfig, LimitsConfig } from '@apexcli/core';

describe('Time-Based Usage Management Integration', () => {
  let mockDate: Date;
  let usageManager: UsageManager;
  let baseConfig: DaemonConfig;
  let baseLimits: LimitsConfig;

  beforeEach(() => {
    // Set up a consistent date for testing - Tuesday, 2024-01-02 at 10:30 AM
    mockDate = new Date('2024-01-02T10:30:00');
    vi.setSystemTime(mockDate);

    baseConfig = {
      timeBasedUsage: {
        enabled: true,
        dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
        dayModeCapacityThreshold: 0.80,
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
    };

    baseLimits = {
      dailyBudget: 100.0,
      maxTokensPerTask: 500000,
      maxCostPerTask: 10.0,
      maxConcurrentTasks: 3,
    };

    usageManager = new UsageManager(baseConfig, baseLimits);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Time Mode Detection', () => {
    it('should detect day mode during business hours', () => {
      const usage = usageManager.getCurrentUsage();
      expect(usage.currentMode).toBe('day');
      expect(usage.thresholds.maxTokensPerTask).toBe(100000);
      expect(usage.thresholds.maxCostPerTask).toBe(5.0);
      expect(usage.thresholds.maxConcurrentTasks).toBe(2);
    });

    it('should detect night mode during night hours', () => {
      // Set time to 11:30 PM
      vi.setSystemTime(new Date('2024-01-02T23:30:00'));
      usageManager = new UsageManager(baseConfig, baseLimits);

      const usage = usageManager.getCurrentUsage();
      expect(usage.currentMode).toBe('night');
      expect(usage.thresholds.maxTokensPerTask).toBe(1000000);
      expect(usage.thresholds.maxCostPerTask).toBe(20.0);
      expect(usage.thresholds.maxConcurrentTasks).toBe(5);
    });

    it('should detect off-hours mode during gaps between day and night', () => {
      // Set time to 8:00 AM (before day mode starts at 9 AM)
      vi.setSystemTime(new Date('2024-01-02T08:00:00'));
      usageManager = new UsageManager(baseConfig, baseLimits);

      const usage = usageManager.getCurrentUsage();
      expect(usage.currentMode).toBe('off-hours');
      expect(usage.thresholds.maxTokensPerTask).toBe(500000);
      expect(usage.thresholds.maxCostPerTask).toBe(10.0);
      expect(usage.thresholds.maxConcurrentTasks).toBe(3);
    });

    it('should handle midnight spanning night mode', () => {
      // Test midnight hours (0, 1, 2, 3, 4, 5, 6)
      const midnightHours = [0, 1, 2, 3, 4, 5, 6];

      for (const hour of midnightHours) {
        vi.setSystemTime(new Date(`2024-01-02T${hour.toString().padStart(2, '0')}:00:00`));
        usageManager = new UsageManager(baseConfig, baseLimits);

        const usage = usageManager.getCurrentUsage();
        expect(usage.currentMode).toBe('night');
      }
    });

    it('should fallback to off-hours when time-based usage is disabled', () => {
      const disabledConfig = {
        ...baseConfig,
        timeBasedUsage: {
          ...baseConfig.timeBasedUsage!,
          enabled: false,
        },
      };

      usageManager = new UsageManager(disabledConfig, baseLimits);
      const usage = usageManager.getCurrentUsage();

      expect(usage.currentMode).toBe('off-hours');
      expect(usage.thresholds).toEqual({
        maxTokensPerTask: 500000,
        maxCostPerTask: 10.0,
        maxConcurrentTasks: 3,
      });
    });
  });

  describe('Time Mode Transitions', () => {
    it('should emit mode-changed event when transitioning from day to night', () => {
      const modeChangedEvents: string[] = [];
      usageManager.on('mode-changed', (mode) => {
        modeChangedEvents.push(mode);
      });

      // Start in day mode
      let usage = usageManager.getCurrentUsage();
      expect(usage.currentMode).toBe('day');
      expect(modeChangedEvents).toHaveLength(0);

      // Transition to night mode
      vi.setSystemTime(new Date('2024-01-02T22:00:00'));
      usage = usageManager.getCurrentUsage();
      expect(usage.currentMode).toBe('night');
      expect(modeChangedEvents).toEqual(['night']);

      // Another call in same mode shouldn't emit event
      usage = usageManager.getCurrentUsage();
      expect(modeChangedEvents).toHaveLength(1);

      // Transition to off-hours
      vi.setSystemTime(new Date('2024-01-03T08:00:00'));
      usage = usageManager.getCurrentUsage();
      expect(usage.currentMode).toBe('off-hours');
      expect(modeChangedEvents).toEqual(['night', 'off-hours']);
    });

    it('should calculate next mode switch time correctly', () => {
      // At 10:30 AM (day mode), next switch should be to night at 10 PM
      let usage = usageManager.getCurrentUsage();
      expect(usage.currentMode).toBe('day');
      expect(usage.nextModeSwitch.getHours()).toBe(22);
      expect(usage.nextModeSwitch.getMinutes()).toBe(0);

      // At 8:00 AM (off-hours), next switch should be to day at 9 AM
      vi.setSystemTime(new Date('2024-01-02T08:00:00'));
      usageManager = new UsageManager(baseConfig, baseLimits);
      usage = usageManager.getCurrentUsage();
      expect(usage.currentMode).toBe('off-hours');
      expect(usage.nextModeSwitch.getHours()).toBe(9);
      expect(usage.nextModeSwitch.getMinutes()).toBe(0);

      // At 11 PM (night mode), next switch should be to day at 9 AM next day
      vi.setSystemTime(new Date('2024-01-02T23:00:00'));
      usageManager = new UsageManager(baseConfig, baseLimits);
      usage = usageManager.getCurrentUsage();
      expect(usage.currentMode).toBe('night');
      expect(usage.nextModeSwitch.getHours()).toBe(0); // Should be midnight (start of 0 hour)
      expect(usage.nextModeSwitch.getDate()).toBe(3); // Next day
    });

    it('should handle custom time windows', () => {
      const customConfig = {
        ...baseConfig,
        timeBasedUsage: {
          ...baseConfig.timeBasedUsage!,
          dayModeHours: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19], // 6 AM - 7 PM
          nightModeHours: [21, 22, 23, 0, 1, 2, 3, 4, 5], // 9 PM - 5 AM
        },
      };

      // Test 7:00 AM (day mode)
      vi.setSystemTime(new Date('2024-01-02T07:00:00'));
      usageManager = new UsageManager(customConfig, baseLimits);
      expect(usageManager.getCurrentUsage().currentMode).toBe('day');

      // Test 8:00 PM (off-hours)
      vi.setSystemTime(new Date('2024-01-02T20:00:00'));
      usageManager = new UsageManager(customConfig, baseLimits);
      expect(usageManager.getCurrentUsage().currentMode).toBe('off-hours');

      // Test 10:00 PM (night mode)
      vi.setSystemTime(new Date('2024-01-02T22:00:00'));
      usageManager = new UsageManager(customConfig, baseLimits);
      expect(usageManager.getCurrentUsage().currentMode).toBe('night');
    });

    it('should handle empty time mode arrays', () => {
      const emptyNightConfig = {
        ...baseConfig,
        timeBasedUsage: {
          ...baseConfig.timeBasedUsage!,
          dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nightModeHours: [], // No night mode
        },
      };

      // Test during what would be night hours
      vi.setSystemTime(new Date('2024-01-02T23:00:00'));
      usageManager = new UsageManager(emptyNightConfig, baseLimits);
      expect(usageManager.getCurrentUsage().currentMode).toBe('off-hours');

      const emptyDayConfig = {
        ...baseConfig,
        timeBasedUsage: {
          ...baseConfig.timeBasedUsage!,
          dayModeHours: [], // No day mode
          nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
        },
      };

      // Test during what would be day hours
      vi.setSystemTime(new Date('2024-01-02T10:00:00'));
      usageManager = new UsageManager(emptyDayConfig, baseLimits);
      expect(usageManager.getCurrentUsage().currentMode).toBe('off-hours');
    });
  });

  describe('Threshold Application', () => {
    it('should apply day mode thresholds correctly', () => {
      const result = usageManager.canStartTask();

      expect(result.allowed).toBe(true);
      expect(result.thresholds.maxTokensPerTask).toBe(100000);
      expect(result.thresholds.maxCostPerTask).toBe(5.0);
      expect(result.thresholds.maxConcurrentTasks).toBe(2);
    });

    it('should apply night mode thresholds correctly', () => {
      vi.setSystemTime(new Date('2024-01-02T23:00:00'));
      usageManager = new UsageManager(baseConfig, baseLimits);

      const result = usageManager.canStartTask();

      expect(result.allowed).toBe(true);
      expect(result.thresholds.maxTokensPerTask).toBe(1000000);
      expect(result.thresholds.maxCostPerTask).toBe(20.0);
      expect(result.thresholds.maxConcurrentTasks).toBe(5);
    });

    it('should enforce concurrent task limits per mode', () => {
      // Start two tasks in day mode (limit is 2)
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskStart('task2');

      // Third task should be rejected
      const result = usageManager.canStartTask();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Maximum concurrent tasks reached (2)');

      // Switch to night mode (limit is 5) - should now allow more tasks
      vi.setSystemTime(new Date('2024-01-02T23:00:00'));
      usageManager = new UsageManager(baseConfig, baseLimits);

      // Re-add the two active tasks
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskStart('task2');

      // Third task should now be allowed in night mode
      const nightResult = usageManager.canStartTask();
      expect(nightResult.allowed).toBe(true);
      expect(nightResult.thresholds.maxConcurrentTasks).toBe(5);
    });

    it('should enforce per-task cost limits per mode', () => {
      // Day mode - reject high-cost task
      const dayResult = usageManager.canStartTask({ estimatedCost: 15.0 });
      expect(dayResult.allowed).toBe(false);
      expect(dayResult.reason).toContain('Estimated task cost (15) exceeds limit (5)');

      // Night mode - allow the same high-cost task
      vi.setSystemTime(new Date('2024-01-02T23:00:00'));
      usageManager = new UsageManager(baseConfig, baseLimits);

      const nightResult = usageManager.canStartTask({ estimatedCost: 15.0 });
      expect(nightResult.allowed).toBe(true);
    });

    it('should enforce per-task token limits per mode', () => {
      // Day mode - reject high-token task
      const dayResult = usageManager.canStartTask({ totalTokens: 500000 });
      expect(dayResult.allowed).toBe(false);
      expect(dayResult.reason).toContain('Estimated token usage (500000) exceeds limit (100000)');

      // Night mode - allow the same high-token task
      vi.setSystemTime(new Date('2024-01-02T23:00:00'));
      usageManager = new UsageManager(baseConfig, baseLimits);

      const nightResult = usageManager.canStartTask({ totalTokens: 500000 });
      expect(nightResult.allowed).toBe(true);
    });
  });

  describe('Usage Tracking Per Mode', () => {
    it('should track usage breakdown by time mode', () => {
      // Track a task completion in day mode
      usageManager.trackTaskStart('dayTask');
      usageManager.trackTaskCompletion('dayTask', {
        inputTokens: 1000,
        outputTokens: 2000,
        totalTokens: 3000,
        estimatedCost: 2.5,
      }, true);

      let stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.modeBreakdown.day).toEqual({
        tokens: 3000,
        cost: 2.5,
        tasks: 1,
      });
      expect(stats.current.dailyUsage.modeBreakdown.night).toEqual({
        tokens: 0,
        cost: 0,
        tasks: 0,
      });

      // Switch to night mode and track another task
      vi.setSystemTime(new Date('2024-01-02T23:00:00'));
      usageManager = new UsageManager(baseConfig, baseLimits);

      // Restore previous day stats (in real implementation this would be persisted)
      usageManager.trackTaskCompletion('previousDayTask', {
        inputTokens: 1000,
        outputTokens: 2000,
        totalTokens: 3000,
        estimatedCost: 2.5,
      }, true);

      usageManager.trackTaskStart('nightTask');
      usageManager.trackTaskCompletion('nightTask', {
        inputTokens: 5000,
        outputTokens: 10000,
        totalTokens: 15000,
        estimatedCost: 7.5,
      }, true);

      stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.modeBreakdown.night).toEqual({
        tokens: 15000,
        cost: 7.5,
        tasks: 1,
      });
      expect(stats.current.dailyUsage.totalTokens).toBe(18000);
      expect(stats.current.dailyUsage.totalCost).toBe(10.0);
    });

    it('should calculate usage statistics correctly', () => {
      // Complete some tasks
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskCompletion('task1', {
        inputTokens: 1000,
        outputTokens: 1000,
        totalTokens: 2000,
        estimatedCost: 2.0,
      }, true);

      usageManager.trackTaskStart('task2');
      usageManager.trackTaskCompletion('task2', {
        inputTokens: 500,
        outputTokens: 500,
        totalTokens: 1000,
        estimatedCost: 1.0,
      }, false); // Failed task

      const stats = usageManager.getUsageStats();

      expect(stats.efficiency.successRate).toBe(0.5); // 1 success out of 2 tasks
      expect(stats.efficiency.avgCostPerTask).toBe(1.5); // (2.0 + 1.0) / 2
      expect(stats.efficiency.avgTokensPerTask).toBe(1500); // (2000 + 1000) / 2
      expect(stats.current.dailyUsage.tasksCompleted).toBe(1);
      expect(stats.current.dailyUsage.tasksFailed).toBe(1);
    });

    it('should track peak concurrent tasks', () => {
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskStart('task2');

      const stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.peakConcurrentTasks).toBe(2);

      // Complete one task
      usageManager.trackTaskCompletion('task1', {
        inputTokens: 1000,
        outputTokens: 1000,
        totalTokens: 2000,
        estimatedCost: 2.0,
      }, true);

      // Peak should remain 2
      const updatedStats = usageManager.getUsageStats();
      expect(updatedStats.current.dailyUsage.peakConcurrentTasks).toBe(2);
    });
  });
});