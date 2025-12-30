import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CapacityMonitor, CapacityUsageProvider, CapacityUsage, ModeInfo, CapacityThresholds } from './capacity-monitor';
import { UsageManager } from './usage-manager';
import { DaemonConfig, LimitsConfig } from '@apexcli/core';

/**
 * Integration test demonstrating how CapacityMonitor would integrate with
 * the existing UsageManager to provide proactive capacity monitoring.
 */
describe('CapacityMonitor Integration', () => {
  let capacityMonitor: CapacityMonitor;
  let usageManager: UsageManager;
  let mockConfig: DaemonConfig;
  let mockLimits: LimitsConfig;

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

    // Create real UsageManager instance
    usageManager = new UsageManager(mockConfig, mockLimits);
  });

  afterEach(() => {
    capacityMonitor?.stop();
    vi.useRealTimers();
  });

  describe('UsageManager Integration', () => {
    it('should create CapacityMonitor that works with UsageManager', () => {
      // Create usage provider that wraps UsageManager
      const usageProvider: CapacityUsageProvider = {
        getCurrentUsage: () => {
          const stats = usageManager.getUsageStats();
          const current = stats.current;

          return {
            currentTokens: current.dailyUsage.totalTokens,
            currentCost: current.dailyUsage.totalCost,
            activeTasks: stats.active.length,
            maxTokensPerTask: current.thresholds.maxTokensPerTask,
            maxCostPerTask: current.thresholds.maxCostPerTask,
            maxConcurrentTasks: current.thresholds.maxConcurrentTasks,
            dailyBudget: usageManager.getBaseLimits().dailyBudget || 100,
            dailySpent: current.dailyUsage.totalCost,
          };
        },

        getModeInfo: () => {
          const current = usageManager.getCurrentUsage();
          return {
            mode: current.currentMode,
            modeHours: current.currentMode === 'day'
              ? mockConfig.timeBasedUsage!.dayModeHours!
              : mockConfig.timeBasedUsage!.nightModeHours!,
            nextModeSwitch: current.nextModeSwitch,
            nextMidnight: this.calculateNextMidnight(new Date()),
          };
        },

        getThresholds: () => {
          const current = usageManager.getCurrentUsage();
          return {
            tokensThreshold: current.thresholds.maxTokensPerTask * 0.8,
            costThreshold: current.thresholds.maxCostPerTask * 0.8,
            budgetThreshold: (usageManager.getBaseLimits().dailyBudget || 100) * 0.8,
            concurrentThreshold: current.thresholds.maxConcurrentTasks,
          };
        },

        calculateNextMidnight: (now: Date) => {
          const midnight = new Date(now);
          midnight.setDate(midnight.getDate() + 1);
          midnight.setHours(0, 0, 0, 0);
          return midnight;
        },
      };

      capacityMonitor = new CapacityMonitor(mockConfig, mockLimits, usageProvider);

      expect(capacityMonitor).toBeInstanceOf(CapacityMonitor);
      expect(capacityMonitor.getStatus().isRunning).toBe(false);
    });

    it('should monitor capacity changes during task lifecycle', () => {
      const usageProvider: CapacityUsageProvider = {
        getCurrentUsage: () => {
          const stats = usageManager.getUsageStats();
          const current = stats.current;

          return {
            currentTokens: current.dailyUsage.totalTokens,
            currentCost: current.dailyUsage.totalCost,
            activeTasks: stats.active.length,
            maxTokensPerTask: current.thresholds.maxTokensPerTask,
            maxCostPerTask: current.thresholds.maxCostPerTask,
            maxConcurrentTasks: current.thresholds.maxConcurrentTasks,
            dailyBudget: usageManager.getBaseLimits().dailyBudget || 100,
            dailySpent: current.dailyUsage.totalCost,
          };
        },

        getModeInfo: () => ({
          mode: 'day',
          modeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nextModeSwitch: new Date('2024-01-01T18:00:00Z'),
          nextMidnight: new Date('2024-01-02T00:00:00Z'),
        }),

        getThresholds: () => ({
          tokensThreshold: 80000,
          costThreshold: 4.0,
          budgetThreshold: 80.0,
          concurrentThreshold: 2,
        }),
      };

      capacityMonitor = new CapacityMonitor(mockConfig, mockLimits, usageProvider);

      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      capacityMonitor.start();

      // Simulate task lifecycle
      usageManager.trackTaskStart('task-1');

      // Check initial state
      expect(capacityMonitor.getStatus().isRunning).toBe(true);

      // Complete task (should trigger capacity:restored event)
      usageManager.trackTaskCompletion('task-1', {
        inputTokens: 5000,
        outputTokens: 3000,
        totalTokens: 8000,
        estimatedCost: 0.8,
      }, true);

      // Check capacity manually to trigger event
      capacityMonitor.checkCapacity();

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'capacity_dropped',
          timestamp: expect.any(Date),
        })
      );
    });

    it('should handle mode transitions correctly', () => {
      let currentMode: 'day' | 'night' = 'day';
      let currentThresholds = {
        maxTokensPerTask: 100000,
        maxCostPerTask: 5.0,
        maxConcurrentTasks: 2,
      };

      const usageProvider: CapacityUsageProvider = {
        getCurrentUsage: () => ({
          currentTokens: 50000,
          currentCost: 2.5,
          activeTasks: 1,
          maxTokensPerTask: currentThresholds.maxTokensPerTask,
          maxCostPerTask: currentThresholds.maxCostPerTask,
          maxConcurrentTasks: currentThresholds.maxConcurrentTasks,
          dailyBudget: 100,
          dailySpent: 25,
        }),

        getModeInfo: () => ({
          mode: currentMode,
          modeHours: currentMode === 'day'
            ? [9, 10, 11, 12, 13, 14, 15, 16, 17]
            : [22, 23, 0, 1, 2, 3, 4, 5, 6],
          nextModeSwitch: new Date('2024-01-01T18:00:00Z'),
          nextMidnight: new Date('2024-01-02T00:00:00Z'),
        }),

        getThresholds: () => ({
          tokensThreshold: currentThresholds.maxTokensPerTask * 0.8,
          costThreshold: currentThresholds.maxCostPerTask * 0.8,
          budgetThreshold: 80.0,
          concurrentThreshold: currentThresholds.maxConcurrentTasks,
        }),
      };

      capacityMonitor = new CapacityMonitor(mockConfig, mockLimits, usageProvider);

      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      capacityMonitor.start();

      // Simulate mode switch to night mode with higher limits
      currentMode = 'night';
      currentThresholds = {
        maxTokensPerTask: 1000000,
        maxCostPerTask: 20.0,
        maxConcurrentTasks: 5,
      };

      // Trigger mode switch timer
      const timeToSwitch = new Date('2024-01-01T18:00:00Z').getTime() - new Date().getTime();
      vi.advanceTimersByTime(timeToSwitch + 1000);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'mode_switch',
          modeInfo: expect.objectContaining({
            mode: 'night',
          }),
        })
      );
    });

    it('should handle daily budget reset', () => {
      const usageProvider: CapacityUsageProvider = {
        getCurrentUsage: () => ({
          currentTokens: 50000,
          currentCost: 2.5,
          activeTasks: 1,
          maxTokensPerTask: 100000,
          maxCostPerTask: 5.0,
          maxConcurrentTasks: 2,
          dailyBudget: 100,
          dailySpent: 0, // Reset at midnight
        }),

        getModeInfo: () => ({
          mode: 'day',
          modeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nextModeSwitch: new Date('2024-01-01T18:00:00Z'),
          nextMidnight: new Date('2024-01-02T00:00:00Z'),
        }),

        getThresholds: () => ({
          tokensThreshold: 80000,
          costThreshold: 4.0,
          budgetThreshold: 80.0,
          concurrentThreshold: 2,
        }),
      };

      capacityMonitor = new CapacityMonitor(mockConfig, mockLimits, usageProvider);

      const eventSpy = vi.fn();
      capacityMonitor.on('capacity:restored', eventSpy);

      capacityMonitor.start();

      // Trigger midnight timer
      const timeToMidnight = new Date('2024-01-02T00:00:00Z').getTime() - new Date().getTime();
      vi.advanceTimersByTime(timeToMidnight + 1000);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'budget_reset',
          timestamp: expect.any(Date),
        })
      );
    });
  });

  describe('Real-world Scenarios', () => {
    it('should work in typical daemon operation', () => {
      // This test demonstrates how the CapacityMonitor would be used
      // in a real daemon environment with periodic task execution

      const usageProvider: CapacityUsageProvider = {
        getCurrentUsage: () => {
          const stats = usageManager.getUsageStats();
          const current = stats.current;

          return {
            currentTokens: current.dailyUsage.totalTokens,
            currentCost: current.dailyUsage.totalCost,
            activeTasks: stats.active.length,
            maxTokensPerTask: current.thresholds.maxTokensPerTask,
            maxCostPerTask: current.thresholds.maxCostPerTask,
            maxConcurrentTasks: current.thresholds.maxConcurrentTasks,
            dailyBudget: 100,
            dailySpent: current.dailyUsage.totalCost,
          };
        },

        getModeInfo: () => ({
          mode: 'day',
          modeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nextModeSwitch: new Date('2024-01-01T18:00:00Z'),
          nextMidnight: new Date('2024-01-02T00:00:00Z'),
        }),

        getThresholds: () => ({
          tokensThreshold: 80000,
          costThreshold: 4.0,
          budgetThreshold: 80.0,
          concurrentThreshold: 2,
        }),
      };

      capacityMonitor = new CapacityMonitor(mockConfig, mockLimits, usageProvider);

      const capacityRestoredEvents: any[] = [];
      capacityMonitor.on('capacity:restored', (event) => {
        capacityRestoredEvents.push(event);
      });

      // Start monitoring
      capacityMonitor.start();
      expect(capacityMonitor.getStatus().isRunning).toBe(true);

      // Simulate a busy period with multiple tasks
      for (let i = 0; i < 3; i++) {
        usageManager.trackTaskStart(`task-${i}`);
      }

      // Complete tasks one by one
      usageManager.trackTaskCompletion('task-0', {
        inputTokens: 5000,
        outputTokens: 3000,
        totalTokens: 8000,
        estimatedCost: 0.8,
      }, true);

      capacityMonitor.checkCapacity();

      usageManager.trackTaskCompletion('task-1', {
        inputTokens: 4000,
        outputTokens: 2000,
        totalTokens: 6000,
        estimatedCost: 0.6,
      }, true);

      capacityMonitor.checkCapacity();

      usageManager.trackTaskCompletion('task-2', {
        inputTokens: 3000,
        outputTokens: 1500,
        totalTokens: 4500,
        estimatedCost: 0.45,
      }, false); // This one failed

      capacityMonitor.checkCapacity();

      // Should have detected capacity drops after task completions
      expect(capacityRestoredEvents.length).toBeGreaterThan(0);
      expect(capacityRestoredEvents[0].reason).toBe('capacity_dropped');

      // Verify monitor is still running and monitoring
      expect(capacityMonitor.getStatus().isRunning).toBe(true);
      expect(capacityMonitor.getStatus().hasModeSwitchTimer).toBe(true);
      expect(capacityMonitor.getStatus().hasMidnightTimer).toBe(true);
    });
  });
});