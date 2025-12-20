import { DaemonConfig, LimitsConfig, TaskUsage } from '@apexcli/core';

export interface UsageThresholds {
  maxTokensPerTask: number;
  maxCostPerTask: number;
  maxConcurrentTasks: number;
}

export interface TimeBasedUsage {
  currentMode: 'day' | 'night' | 'off-hours';
  thresholds: UsageThresholds;
  dailyUsage: DailyUsageStats;
  nextModeSwitch: Date;
}

export interface DailyUsageStats {
  date: string; // YYYY-MM-DD format
  totalTokens: number;
  totalCost: number;
  tasksCompleted: number;
  tasksFailed: number;
  peakConcurrentTasks: number;
  modeBreakdown: {
    day: { tokens: number; cost: number; tasks: number };
    night: { tokens: number; cost: number; tasks: number };
  };
}

/**
 * Manages time-based usage thresholds and tracks daily consumption
 */
export class UsageManager {
  private config: DaemonConfig;
  private baseLimits: LimitsConfig;
  private currentDayStats: DailyUsageStats;
  private activeTasks: Map<string, TaskUsage> = new Map();

  constructor(config: DaemonConfig, baseLimits: LimitsConfig) {
    this.config = config;
    this.baseLimits = baseLimits;
    this.currentDayStats = this.initializeDayStats();
  }

  /**
   * Get current usage mode and thresholds
   */
  getCurrentUsage(): TimeBasedUsage {
    const now = new Date();
    const currentMode = this.getCurrentMode(now);
    const thresholds = this.getThresholds(currentMode);
    const nextModeSwitch = this.getNextModeSwitch(now);

    return {
      currentMode,
      thresholds,
      dailyUsage: this.currentDayStats,
      nextModeSwitch,
    };
  }

  /**
   * Check if a new task can be started given current usage and limits
   */
  canStartTask(estimatedUsage?: Partial<TaskUsage>): {
    allowed: boolean;
    reason?: string;
    thresholds: UsageThresholds;
  } {
    const { thresholds } = this.getCurrentUsage();

    // Check concurrent task limit
    if (this.activeTasks.size >= thresholds.maxConcurrentTasks) {
      return {
        allowed: false,
        reason: `Maximum concurrent tasks reached (${thresholds.maxConcurrentTasks})`,
        thresholds,
      };
    }

    // Check daily budget
    if (this.currentDayStats.totalCost >= (this.baseLimits.dailyBudget || 100)) {
      return {
        allowed: false,
        reason: 'Daily budget limit reached',
        thresholds,
      };
    }

    // Check estimated task cost if provided
    if (estimatedUsage?.estimatedCost && estimatedUsage.estimatedCost > thresholds.maxCostPerTask) {
      return {
        allowed: false,
        reason: `Estimated task cost (${estimatedUsage.estimatedCost}) exceeds limit (${thresholds.maxCostPerTask})`,
        thresholds,
      };
    }

    // Check estimated token usage if provided
    if (estimatedUsage?.totalTokens && estimatedUsage.totalTokens > thresholds.maxTokensPerTask) {
      return {
        allowed: false,
        reason: `Estimated token usage (${estimatedUsage.totalTokens}) exceeds limit (${thresholds.maxTokensPerTask})`,
        thresholds,
      };
    }

    return { allowed: true, thresholds };
  }

  /**
   * Track task start
   */
  trackTaskStart(taskId: string): void {
    this.activeTasks.set(taskId, {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    });

    // Update peak concurrent tasks
    if (this.activeTasks.size > this.currentDayStats.peakConcurrentTasks) {
      this.currentDayStats.peakConcurrentTasks = this.activeTasks.size;
    }
  }

  /**
   * Track task completion and update daily stats
   */
  trackTaskCompletion(taskId: string, usage: TaskUsage, success: boolean): void {
    // Remove from active tasks
    this.activeTasks.delete(taskId);

    // Update daily stats
    this.currentDayStats.totalTokens += usage.totalTokens;
    this.currentDayStats.totalCost += usage.estimatedCost;

    if (success) {
      this.currentDayStats.tasksCompleted++;
    } else {
      this.currentDayStats.tasksFailed++;
    }

    // Update mode-specific breakdown
    const currentMode = this.getCurrentMode(new Date());
    if (currentMode === 'day') {
      this.currentDayStats.modeBreakdown.day.tokens += usage.totalTokens;
      this.currentDayStats.modeBreakdown.day.cost += usage.estimatedCost;
      this.currentDayStats.modeBreakdown.day.tasks++;
    } else if (currentMode === 'night') {
      this.currentDayStats.modeBreakdown.night.tokens += usage.totalTokens;
      this.currentDayStats.modeBreakdown.night.cost += usage.estimatedCost;
      this.currentDayStats.modeBreakdown.night.tasks++;
    }
  }

  /**
   * Update usage for an active task
   */
  updateTaskUsage(taskId: string, usage: TaskUsage): void {
    this.activeTasks.set(taskId, usage);
  }

  /**
   * Get base limits configuration
   */
  getBaseLimits(): LimitsConfig {
    return this.baseLimits;
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): {
    current: TimeBasedUsage;
    active: { taskId: string; usage: TaskUsage }[];
    projectedDailyCost: number;
    efficiency: {
      successRate: number;
      avgCostPerTask: number;
      avgTokensPerTask: number;
    };
  } {
    const current = this.getCurrentUsage();
    const active = Array.from(this.activeTasks.entries()).map(([taskId, usage]) => ({
      taskId,
      usage,
    }));

    // Calculate projected daily cost based on current time and usage
    const now = new Date();
    const hoursInDay = 24;
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const projectedDailyCost = currentHour > 0
      ? (this.currentDayStats.totalCost / currentHour) * hoursInDay
      : this.currentDayStats.totalCost;

    // Calculate efficiency metrics
    const totalTasks = this.currentDayStats.tasksCompleted + this.currentDayStats.tasksFailed;
    const successRate = totalTasks > 0 ? this.currentDayStats.tasksCompleted / totalTasks : 0;
    const avgCostPerTask = totalTasks > 0 ? this.currentDayStats.totalCost / totalTasks : 0;
    const avgTokensPerTask = totalTasks > 0 ? this.currentDayStats.totalTokens / totalTasks : 0;

    return {
      current,
      active,
      projectedDailyCost,
      efficiency: {
        successRate,
        avgCostPerTask,
        avgTokensPerTask,
      },
    };
  }

  /**
   * Reset daily stats (called at midnight)
   */
  resetDailyStats(): void {
    this.currentDayStats = this.initializeDayStats();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private getCurrentMode(now: Date): 'day' | 'night' | 'off-hours' {
    if (!this.config.timeBasedUsage?.enabled) {
      return 'off-hours';
    }

    const hour = now.getHours();
    const dayHours = this.config.timeBasedUsage.dayModeHours || [9, 10, 11, 12, 13, 14, 15, 16, 17];
    const nightHours = this.config.timeBasedUsage.nightModeHours || [22, 23, 0, 1, 2, 3, 4, 5, 6];

    if (dayHours.includes(hour)) {
      return 'day';
    } else if (nightHours.includes(hour)) {
      return 'night';
    } else {
      return 'off-hours';
    }
  }

  private getThresholds(mode: 'day' | 'night' | 'off-hours'): UsageThresholds {
    const timeBasedConfig = this.config.timeBasedUsage;

    if (!timeBasedConfig?.enabled || mode === 'off-hours') {
      return {
        maxTokensPerTask: this.baseLimits.maxTokensPerTask || 500000,
        maxCostPerTask: this.baseLimits.maxCostPerTask || 10.0,
        maxConcurrentTasks: this.baseLimits.maxConcurrentTasks || 3,
      };
    }

    if (mode === 'day') {
      const dayThresholds = timeBasedConfig.dayModeThresholds;
      return {
        maxTokensPerTask: dayThresholds?.maxTokensPerTask || 100000,
        maxCostPerTask: dayThresholds?.maxCostPerTask || 5.0,
        maxConcurrentTasks: dayThresholds?.maxConcurrentTasks || 2,
      };
    } else {
      const nightThresholds = timeBasedConfig.nightModeThresholds;
      return {
        maxTokensPerTask: nightThresholds?.maxTokensPerTask || 1000000,
        maxCostPerTask: nightThresholds?.maxCostPerTask || 20.0,
        maxConcurrentTasks: nightThresholds?.maxConcurrentTasks || 5,
      };
    }
  }

  private getNextModeSwitch(now: Date): Date {
    if (!this.config.timeBasedUsage?.enabled) {
      // Return next day if time-based usage is disabled
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
    }

    const dayHours = this.config.timeBasedUsage.dayModeHours || [9, 10, 11, 12, 13, 14, 15, 16, 17];
    const nightHours = this.config.timeBasedUsage.nightModeHours || [22, 23, 0, 1, 2, 3, 4, 5, 6];
    const currentHour = now.getHours();

    // Find next transition hour
    const allTransitions = [...dayHours, ...nightHours].sort((a, b) => a - b);
    const nextTransition = allTransitions.find(hour => hour > currentHour) || allTransitions[0];

    const nextSwitch = new Date(now);
    if (nextTransition > currentHour) {
      nextSwitch.setHours(nextTransition, 0, 0, 0);
    } else {
      // Next transition is tomorrow
      nextSwitch.setDate(nextSwitch.getDate() + 1);
      nextSwitch.setHours(nextTransition, 0, 0, 0);
    }

    return nextSwitch;
  }

  private initializeDayStats(): DailyUsageStats {
    const today = new Date().toISOString().split('T')[0];
    return {
      date: today,
      totalTokens: 0,
      totalCost: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      peakConcurrentTasks: 0,
      modeBreakdown: {
        day: { tokens: 0, cost: 0, tasks: 0 },
        night: { tokens: 0, cost: 0, tasks: 0 },
      },
    };
  }
}