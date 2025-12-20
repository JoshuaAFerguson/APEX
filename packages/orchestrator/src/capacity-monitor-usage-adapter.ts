import { CapacityUsageProvider, CapacityUsage, CapacityThresholds, ModeInfo } from './capacity-monitor';
import { UsageManager } from './usage-manager';
import { DaemonConfig, LimitsConfig } from '@apexcli/core';

/**
 * Adapter that bridges the existing UsageManager with CapacityMonitor's interface requirements.
 * This allows CapacityMonitor to work with the existing usage tracking infrastructure.
 */
export class CapacityMonitorUsageAdapter implements CapacityUsageProvider {
  constructor(
    private usageManager: UsageManager,
    private config: DaemonConfig,
    private baseLimits: LimitsConfig
  ) {}

  /**
   * Get current capacity usage information
   */
  getCurrentUsage(): CapacityUsage {
    const timeBasedUsage = this.usageManager.getCurrentUsage();
    const stats = this.usageManager.getUsageStats();

    return {
      currentTokens: timeBasedUsage.dailyUsage.totalTokens,
      currentCost: timeBasedUsage.dailyUsage.totalCost,
      activeTasks: stats.active.length,
      maxTokensPerTask: timeBasedUsage.thresholds.maxTokensPerTask,
      maxCostPerTask: timeBasedUsage.thresholds.maxCostPerTask,
      maxConcurrentTasks: timeBasedUsage.thresholds.maxConcurrentTasks,
      dailyBudget: this.baseLimits.dailyBudget || 100,
      dailySpent: timeBasedUsage.dailyUsage.totalCost,
    };
  }

  /**
   * Get current mode information
   */
  getModeInfo(): ModeInfo {
    const timeBasedUsage = this.usageManager.getCurrentUsage();
    const nextMidnight = this.getNextMidnight();

    return {
      mode: timeBasedUsage.currentMode,
      modeHours: this.getModeHours(timeBasedUsage.currentMode),
      nextModeSwitch: timeBasedUsage.nextModeSwitch,
      nextMidnight,
    };
  }

  /**
   * Get capacity thresholds for monitoring
   */
  getThresholds(): CapacityThresholds {
    const timeBasedUsage = this.usageManager.getCurrentUsage();

    return {
      tokensThreshold: timeBasedUsage.thresholds.maxTokensPerTask,
      costThreshold: timeBasedUsage.thresholds.maxCostPerTask,
      budgetThreshold: this.baseLimits.dailyBudget || 100,
      concurrentThreshold: timeBasedUsage.thresholds.maxConcurrentTasks,
    };
  }

  /**
   * Get the hours for a specific mode
   */
  private getModeHours(mode: 'day' | 'night' | 'off-hours'): number[] {
    const timeBasedUsage = this.config.timeBasedUsage;
    switch (mode) {
      case 'day':
        return timeBasedUsage?.dayModeHours || [9, 10, 11, 12, 13, 14, 15, 16, 17];
      case 'night':
        return timeBasedUsage?.nightModeHours || [22, 23, 0, 1, 2, 3, 4, 5, 6];
      case 'off-hours':
      default:
        return [0, 1, 2, 3, 4, 5, 6, 7, 8];
    }
  }

  /**
   * Calculate next midnight for daily budget reset
   */
  private getNextMidnight(): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }
}
