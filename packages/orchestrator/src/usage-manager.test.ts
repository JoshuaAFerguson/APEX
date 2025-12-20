import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsageManager } from './usage-manager';
import { DaemonConfig, LimitsConfig, TaskUsage } from '@apexcli/core';

describe('UsageManager', () => {
  let usageManager: UsageManager;
  let mockDaemonConfig: DaemonConfig;
  let mockLimitsConfig: LimitsConfig;

  const mockTaskUsage: TaskUsage = {
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    estimatedCost: 0.05,
  };

  beforeEach(() => {
    vi.useFakeTimers();

    mockDaemonConfig = {
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

    mockLimitsConfig = {
      maxTokensPerTask: 500000,
      maxCostPerTask: 10.0,
      maxConcurrentTasks: 3,
      dailyBudget: 100.0,
    };

    usageManager = new UsageManager(mockDaemonConfig, mockLimitsConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getCurrentUsage', () => {
    it('should return day mode during day hours', () => {
      // Set time to 2:00 PM (14:00)
      const dayTime = new Date('2024-01-01T14:00:00Z');
      vi.setSystemTime(dayTime);

      const usage = usageManager.getCurrentUsage();

      expect(usage.currentMode).toBe('day');
      expect(usage.thresholds.maxTokensPerTask).toBe(100000);
      expect(usage.thresholds.maxCostPerTask).toBe(5.0);
      expect(usage.thresholds.maxConcurrentTasks).toBe(2);
    });

    it('should return night mode during night hours', () => {
      // Set time to 2:00 AM (02:00)
      const nightTime = new Date('2024-01-01T02:00:00Z');
      vi.setSystemTime(nightTime);

      const usage = usageManager.getCurrentUsage();

      expect(usage.currentMode).toBe('night');
      expect(usage.thresholds.maxTokensPerTask).toBe(1000000);
      expect(usage.thresholds.maxCostPerTask).toBe(20.0);
      expect(usage.thresholds.maxConcurrentTasks).toBe(5);
    });

    it('should return off-hours mode during transition hours', () => {
      // Set time to 8:00 AM (08:00) - between night and day
      const offHoursTime = new Date('2024-01-01T08:00:00Z');
      vi.setSystemTime(offHoursTime);

      const usage = usageManager.getCurrentUsage();

      expect(usage.currentMode).toBe('off-hours');
      expect(usage.thresholds.maxTokensPerTask).toBe(500000);
      expect(usage.thresholds.maxCostPerTask).toBe(10.0);
      expect(usage.thresholds.maxConcurrentTasks).toBe(3);
    });

    it('should return off-hours when time-based usage is disabled', () => {
      mockDaemonConfig.timeBasedUsage!.enabled = false;
      usageManager = new UsageManager(mockDaemonConfig, mockLimitsConfig);

      const dayTime = new Date('2024-01-01T14:00:00Z');
      vi.setSystemTime(dayTime);

      const usage = usageManager.getCurrentUsage();

      expect(usage.currentMode).toBe('off-hours');
    });
  });

  describe('canStartTask', () => {
    beforeEach(() => {
      // Set time to day mode for most tests
      const dayTime = new Date('2024-01-01T14:00:00Z');
      vi.setSystemTime(dayTime);
    });

    it('should allow task when within limits', () => {
      const result = usageManager.canStartTask();

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject task when concurrent task limit reached', () => {
      // Start two tasks (day mode limit is 2)
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskStart('task2');

      const result = usageManager.canStartTask();

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Maximum concurrent tasks reached (2)');
    });

    it('should reject task when estimated cost exceeds threshold', () => {
      const estimatedUsage: Partial<TaskUsage> = {
        estimatedCost: 10.0, // Exceeds day mode limit of 5.0
      };

      const result = usageManager.canStartTask(estimatedUsage);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Estimated task cost (10) exceeds limit (5)');
    });

    it('should reject task when estimated tokens exceed threshold', () => {
      const estimatedUsage: Partial<TaskUsage> = {
        totalTokens: 200000, // Exceeds day mode limit of 100000
      };

      const result = usageManager.canStartTask(estimatedUsage);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Estimated token usage (200000) exceeds limit (100000)');
    });

    it('should reject task when daily budget limit reached', () => {
      // Track high usage to exceed daily budget
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskCompletion('task1', {
        inputTokens: 50000,
        outputTokens: 50000,
        totalTokens: 100000,
        estimatedCost: 101.0, // Exceeds daily budget of 100
      }, true);

      const result = usageManager.canStartTask();

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Daily budget limit reached');
    });
  });

  describe('trackTaskStart', () => {
    it('should track active task', () => {
      usageManager.trackTaskStart('task1');

      const stats = usageManager.getUsageStats();
      expect(stats.active).toHaveLength(1);
      expect(stats.active[0].taskId).toBe('task1');
    });

    it('should update peak concurrent tasks', () => {
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskStart('task2');

      const stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.peakConcurrentTasks).toBe(2);
    });
  });

  describe('trackTaskCompletion', () => {
    beforeEach(() => {
      const dayTime = new Date('2024-01-01T14:00:00Z');
      vi.setSystemTime(dayTime);
    });

    it('should remove task from active tasks', () => {
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskCompletion('task1', mockTaskUsage, true);

      const stats = usageManager.getUsageStats();
      expect(stats.active).toHaveLength(0);
    });

    it('should update daily stats for successful task', () => {
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskCompletion('task1', mockTaskUsage, true);

      const stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.tasksCompleted).toBe(1);
      expect(stats.current.dailyUsage.tasksFailed).toBe(0);
      expect(stats.current.dailyUsage.totalTokens).toBe(1500);
      expect(stats.current.dailyUsage.totalCost).toBe(0.05);
    });

    it('should update daily stats for failed task', () => {
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskCompletion('task1', mockTaskUsage, false);

      const stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.tasksCompleted).toBe(0);
      expect(stats.current.dailyUsage.tasksFailed).toBe(1);
    });

    it('should update mode-specific breakdown for day mode', () => {
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskCompletion('task1', mockTaskUsage, true);

      const stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.modeBreakdown.day.tokens).toBe(1500);
      expect(stats.current.dailyUsage.modeBreakdown.day.cost).toBe(0.05);
      expect(stats.current.dailyUsage.modeBreakdown.day.tasks).toBe(1);
    });

    it('should update mode-specific breakdown for night mode', () => {
      const nightTime = new Date('2024-01-01T02:00:00Z');
      vi.setSystemTime(nightTime);

      usageManager.trackTaskStart('task1');
      usageManager.trackTaskCompletion('task1', mockTaskUsage, true);

      const stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.modeBreakdown.night.tokens).toBe(1500);
      expect(stats.current.dailyUsage.modeBreakdown.night.cost).toBe(0.05);
      expect(stats.current.dailyUsage.modeBreakdown.night.tasks).toBe(1);
    });
  });

  describe('updateTaskUsage', () => {
    it('should update usage for active task', () => {
      usageManager.trackTaskStart('task1');

      const updatedUsage: TaskUsage = {
        inputTokens: 2000,
        outputTokens: 1000,
        totalTokens: 3000,
        estimatedCost: 0.1,
      };

      usageManager.updateTaskUsage('task1', updatedUsage);

      const stats = usageManager.getUsageStats();
      expect(stats.active[0].usage).toEqual(updatedUsage);
    });
  });

  describe('getUsageStats', () => {
    beforeEach(() => {
      const dayTime = new Date('2024-01-01T12:00:00Z'); // Noon
      vi.setSystemTime(dayTime);
    });

    it('should calculate correct efficiency metrics', () => {
      // Complete some tasks
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskCompletion('task1', mockTaskUsage, true);

      usageManager.trackTaskStart('task2');
      usageManager.trackTaskCompletion('task2', mockTaskUsage, false);

      const stats = usageManager.getUsageStats();

      expect(stats.efficiency.successRate).toBe(0.5); // 1 success out of 2 tasks
      expect(stats.efficiency.avgCostPerTask).toBe(0.05); // (0.05 + 0.05) / 2
      expect(stats.efficiency.avgTokensPerTask).toBe(1500); // (1500 + 1500) / 2
    });

    it('should calculate projected daily cost', () => {
      // Add some usage at noon (12 hours into day)
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskCompletion('task1', mockTaskUsage, true);

      const stats = usageManager.getUsageStats();

      // At noon with 0.05 cost, projected daily cost should be 0.1
      expect(stats.projectedDailyCost).toBe(0.1);
    });
  });

  describe('resetDailyStats', () => {
    it('should reset all daily statistics', () => {
      // Add some usage
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskCompletion('task1', mockTaskUsage, true);

      // Reset
      usageManager.resetDailyStats();

      const stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.totalTokens).toBe(0);
      expect(stats.current.dailyUsage.totalCost).toBe(0);
      expect(stats.current.dailyUsage.tasksCompleted).toBe(0);
      expect(stats.current.dailyUsage.tasksFailed).toBe(0);
      expect(stats.current.dailyUsage.peakConcurrentTasks).toBe(0);
    });
  });

  describe('getNextModeSwitch', () => {
    it('should calculate next transition correctly', () => {
      const morningTime = new Date('2024-01-01T08:00:00Z');
      vi.setSystemTime(morningTime);

      const usage = usageManager.getCurrentUsage();

      // Next transition should be 9:00 AM (start of day mode)
      const expectedNext = new Date('2024-01-01T09:00:00Z');
      expect(usage.nextModeSwitch).toEqual(expectedNext);
    });

    it('should wrap to next day when necessary', () => {
      const lateNightTime = new Date('2024-01-01T23:00:00Z');
      vi.setSystemTime(lateNightTime);

      const usage = usageManager.getCurrentUsage();

      // Next transition should be midnight (0:00 next day)
      const expectedNext = new Date('2024-01-02T00:00:00Z');
      expect(usage.nextModeSwitch).toEqual(expectedNext);
    });
  });

  describe('error handling', () => {
    it('should handle undefined config gracefully', () => {
      const minimalConfig: DaemonConfig = {};
      const minimalLimits: LimitsConfig = {};

      const manager = new UsageManager(minimalConfig, minimalLimits);
      const usage = manager.getCurrentUsage();

      expect(usage.currentMode).toBe('off-hours');
    });

    it('should handle missing thresholds with defaults', () => {
      const configWithoutThresholds: DaemonConfig = {
        timeBasedUsage: {
          enabled: true,
        },
      };

      const manager = new UsageManager(configWithoutThresholds, mockLimitsConfig);
      const dayTime = new Date('2024-01-01T14:00:00Z');
      vi.setSystemTime(dayTime);

      const usage = manager.getCurrentUsage();
      expect(usage.thresholds.maxTokensPerTask).toBe(100000); // Default day threshold
    });
  });
});