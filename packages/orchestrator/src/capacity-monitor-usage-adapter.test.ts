import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CapacityMonitorUsageAdapter } from './capacity-monitor-usage-adapter';
import { UsageManager } from './usage-manager';
import { DaemonConfig, LimitsConfig } from '@apexcli/core';

describe('CapacityMonitorUsageAdapter', () => {
  let adapter: CapacityMonitorUsageAdapter;
  let mockUsageManager: UsageManager;
  let mockConfig: DaemonConfig;
  let mockLimits: LimitsConfig;

  beforeEach(() => {
    mockUsageManager = {
      getCurrentUsage: vi.fn().mockReturnValue({
        currentMode: 'day',
        dailyUsage: {
          totalTokens: 50000,
          totalCost: 2.5,
          tasksCompleted: 5,
        },
        thresholds: {
          maxTokensPerTask: 100000,
          maxCostPerTask: 5.0,
          maxConcurrentTasks: 3,
        },
        nextModeSwitch: new Date('2024-01-01T18:00:00Z'),
      }),
      getUsageStats: vi.fn().mockReturnValue({
        active: ['task-1', 'task-2'],
        completed: ['task-3', 'task-4', 'task-5'],
      }),
    } as any;

    mockConfig = {
      dayHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
      nightHours: [18, 19, 20, 21, 22, 23],
    };

    mockLimits = {
      maxTokensPerTask: 500000,
      maxCostPerTask: 10.0,
      maxConcurrentTasks: 3,
      dailyBudget: 100.0,
    };

    adapter = new CapacityMonitorUsageAdapter(mockUsageManager, mockConfig, mockLimits);
  });

  describe('getCurrentUsage', () => {
    it('should return properly formatted capacity usage information', () => {
      const usage = adapter.getCurrentUsage();

      expect(usage).toEqual({
        currentTokens: 50000,
        currentCost: 2.5,
        activeTasks: 2,
        maxTokensPerTask: 100000,
        maxCostPerTask: 5.0,
        maxConcurrentTasks: 3,
        dailyBudget: 100.0,
        dailySpent: 2.5,
      });
    });

    it('should use default daily budget when not configured', () => {
      const adapterWithoutBudget = new CapacityMonitorUsageAdapter(
        mockUsageManager,
        mockConfig,
        {} as LimitsConfig
      );

      const usage = adapterWithoutBudget.getCurrentUsage();

      expect(usage.dailyBudget).toBe(100);
    });

    it('should handle zero active tasks', () => {
      vi.mocked(mockUsageManager.getUsageStats).mockReturnValue({
        active: [],
        completed: ['task-1', 'task-2'],
      });

      const usage = adapter.getCurrentUsage();

      expect(usage.activeTasks).toBe(0);
    });
  });

  describe('getModeInfo', () => {
    it('should return proper mode information for day mode', () => {
      const modeInfo = adapter.getModeInfo();

      expect(modeInfo).toEqual({
        mode: 'day',
        modeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        nextModeSwitch: new Date('2024-01-01T18:00:00Z'),
        nextMidnight: expect.any(Date),
      });
    });

    it('should return proper mode information for night mode', () => {
      vi.mocked(mockUsageManager.getCurrentUsage).mockReturnValue({
        currentMode: 'night',
        dailyUsage: {
          totalTokens: 30000,
          totalCost: 1.5,
          tasksCompleted: 3,
        },
        thresholds: {
          maxTokensPerTask: 200000,
          maxCostPerTask: 8.0,
          maxConcurrentTasks: 5,
        },
        nextModeSwitch: new Date('2024-01-02T09:00:00Z'),
      });

      const modeInfo = adapter.getModeInfo();

      expect(modeInfo).toEqual({
        mode: 'night',
        modeHours: [18, 19, 20, 21, 22, 23],
        nextModeSwitch: new Date('2024-01-02T09:00:00Z'),
        nextMidnight: expect.any(Date),
      });
    });

    it('should return proper mode information for off-hours mode', () => {
      vi.mocked(mockUsageManager.getCurrentUsage).mockReturnValue({
        currentMode: 'off-hours',
        dailyUsage: {
          totalTokens: 10000,
          totalCost: 0.5,
          tasksCompleted: 1,
        },
        thresholds: {
          maxTokensPerTask: 50000,
          maxCostPerTask: 2.0,
          maxConcurrentTasks: 1,
        },
        nextModeSwitch: new Date('2024-01-02T09:00:00Z'),
      });

      const modeInfo = adapter.getModeInfo();

      expect(modeInfo).toEqual({
        mode: 'off-hours',
        modeHours: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        nextModeSwitch: new Date('2024-01-02T09:00:00Z'),
        nextMidnight: expect.any(Date),
      });
    });

    it('should use default hours when config is missing', () => {
      const adapterWithoutConfig = new CapacityMonitorUsageAdapter(
        mockUsageManager,
        {} as DaemonConfig,
        mockLimits
      );

      const modeInfo = adapterWithoutConfig.getModeInfo();

      expect(modeInfo.modeHours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
    });

    it('should calculate next midnight correctly', () => {
      const modeInfo = adapter.getModeInfo();
      const nextMidnight = modeInfo.nextMidnight;

      // Verify it's the next day at midnight
      expect(nextMidnight.getHours()).toBe(0);
      expect(nextMidnight.getMinutes()).toBe(0);
      expect(nextMidnight.getSeconds()).toBe(0);
      expect(nextMidnight.getMilliseconds()).toBe(0);
      expect(nextMidnight.getDate()).toBeGreaterThan(new Date().getDate() - 1);
    });
  });

  describe('getThresholds', () => {
    it('should return proper capacity thresholds', () => {
      const thresholds = adapter.getThresholds();

      expect(thresholds).toEqual({
        tokensThreshold: 100000,
        costThreshold: 5.0,
        budgetThreshold: 100.0,
        concurrentThreshold: 3,
      });
    });

    it('should use default budget threshold when not configured', () => {
      const adapterWithoutBudget = new CapacityMonitorUsageAdapter(
        mockUsageManager,
        mockConfig,
        {} as LimitsConfig
      );

      const thresholds = adapterWithoutBudget.getThresholds();

      expect(thresholds.budgetThreshold).toBe(100);
    });

    it('should reflect current usage manager thresholds', () => {
      vi.mocked(mockUsageManager.getCurrentUsage).mockReturnValue({
        currentMode: 'night',
        dailyUsage: {
          totalTokens: 30000,
          totalCost: 1.5,
          tasksCompleted: 3,
        },
        thresholds: {
          maxTokensPerTask: 250000,
          maxCostPerTask: 7.5,
          maxConcurrentTasks: 4,
        },
        nextModeSwitch: new Date('2024-01-02T09:00:00Z'),
      });

      const thresholds = adapter.getThresholds();

      expect(thresholds).toEqual({
        tokensThreshold: 250000,
        costThreshold: 7.5,
        budgetThreshold: 100.0,
        concurrentThreshold: 4,
      });
    });
  });

  describe('private methods', () => {
    it('should handle all mode types in getModeHours', () => {
      const adapterInstance = adapter as any;

      expect(adapterInstance.getModeHours('day')).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
      expect(adapterInstance.getModeHours('night')).toEqual([18, 19, 20, 21, 22, 23]);
      expect(adapterInstance.getModeHours('off-hours')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('should calculate next midnight correctly for different times', () => {
      const adapterInstance = adapter as any;

      // Mock different current times
      const originalDate = Date;
      const mockDate = vi.fn();

      // Test at 10 AM
      mockDate.mockImplementation(() => new Date('2024-01-15T10:00:00Z'));
      global.Date = mockDate as any;

      let nextMidnight = adapterInstance.getNextMidnight();
      expect(nextMidnight.toISOString()).toBe('2024-01-16T00:00:00.000Z');

      // Test at 11 PM
      mockDate.mockImplementation(() => new Date('2024-01-15T23:00:00Z'));
      global.Date = mockDate as any;

      nextMidnight = adapterInstance.getNextMidnight();
      expect(nextMidnight.toISOString()).toBe('2024-01-16T00:00:00.000Z');

      // Restore original Date
      global.Date = originalDate;
    });
  });

  describe('integration with UsageManager', () => {
    it('should call UsageManager methods appropriately', () => {
      adapter.getCurrentUsage();
      expect(mockUsageManager.getCurrentUsage).toHaveBeenCalled();
      expect(mockUsageManager.getUsageStats).toHaveBeenCalled();

      adapter.getModeInfo();
      expect(mockUsageManager.getCurrentUsage).toHaveBeenCalledTimes(2);

      adapter.getThresholds();
      expect(mockUsageManager.getCurrentUsage).toHaveBeenCalledTimes(3);
    });

    it('should handle errors from UsageManager gracefully', () => {
      vi.mocked(mockUsageManager.getCurrentUsage).mockImplementation(() => {
        throw new Error('UsageManager error');
      });

      expect(() => adapter.getCurrentUsage()).toThrow('UsageManager error');
      expect(() => adapter.getModeInfo()).toThrow('UsageManager error');
      expect(() => adapter.getThresholds()).toThrow('UsageManager error');
    });
  });
});