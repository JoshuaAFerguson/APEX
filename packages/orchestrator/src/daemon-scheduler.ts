import { DaemonConfig, LimitsConfig } from '@apexcli/core';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Usage statistics provider interface for abstracting usage data sources
 */
export interface UsageStatsProvider {
  /**
   * Get current daily usage statistics
   */
  getCurrentDailyUsage(): {
    totalTokens: number;
    totalCost: number;
    tasksCompleted: number;
    tasksFailed: number;
  };

  /**
   * Get current active task count
   */
  getActiveTasks(): number;

  /**
   * Get daily budget limit
   */
  getDailyBudget(): number;
}

/**
 * Time window information
 */
export interface TimeWindow {
  mode: 'day' | 'night' | 'off-hours';
  startHour: number;
  endHour: number;
  isActive: boolean;
  nextTransition: Date;
}

/**
 * Capacity information for the current time window
 */
export interface CapacityInfo {
  currentPercentage: number;
  threshold: number;
  shouldPause: boolean;
  reason?: string;
}

/**
 * Scheduling decision result
 */
export interface SchedulingDecision {
  shouldPause: boolean;
  reason?: string;
  timeWindow: TimeWindow;
  capacity: CapacityInfo;
  nextResetTime: Date;
  recommendations?: string[];
}

/**
 * Reason for capacity restoration
 */
export type CapacityRestoredReason =
  | 'mode_switch'      // Day/night transition
  | 'budget_reset'     // Midnight budget reset
  | 'usage_decreased'; // External usage update dropped below threshold

/**
 * Capacity restoration event details
 */
export interface CapacityRestoredEvent {
  reason: CapacityRestoredReason;
  previousCapacity: CapacityInfo;
  newCapacity: CapacityInfo;
  timeWindow: TimeWindow;
  timestamp: Date;
}

/**
 * Callback function for capacity restoration events
 */
export type CapacityRestoredCallback = (event: CapacityRestoredEvent) => void;

// ============================================================================
// DaemonScheduler Implementation
// ============================================================================

/**
 * Manages daemon scheduling decisions based on time windows and capacity thresholds
 */
export class DaemonScheduler {
  private config: DaemonConfig;
  private baseLimits: LimitsConfig;
  private usageProvider: UsageStatsProvider;

  // Capacity restoration callback system
  private capacityCallbacks: Set<CapacityRestoredCallback> = new Set();
  private monitoringTimer?: ReturnType<typeof setTimeout>;
  private lastCapacityState?: { shouldPause: boolean; capacity: CapacityInfo; timeWindow: TimeWindow };

  constructor(
    config: DaemonConfig,
    baseLimits: LimitsConfig,
    usageProvider: UsageStatsProvider
  ) {
    this.config = config;
    this.baseLimits = baseLimits;
    this.usageProvider = usageProvider;
  }

  /**
   * Determine if daemon should pause task execution based on current capacity and time window
   */
  shouldPauseTasks(now: Date = new Date()): SchedulingDecision {
    const timeWindow = this.getCurrentTimeWindow(now);
    const capacity = this.getCapacityInfo(timeWindow, now);
    const nextResetTime = this.getNextResetTime(now);

    // Main decision logic
    const shouldPause = capacity.shouldPause || !timeWindow.isActive;

    let reason: string | undefined;
    if (!timeWindow.isActive) {
      reason = `Outside active time window (${timeWindow.mode} mode)`;
    } else if (capacity.shouldPause) {
      reason = capacity.reason;
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(timeWindow, capacity, now);

    return {
      shouldPause,
      reason,
      timeWindow,
      capacity,
      nextResetTime,
      recommendations,
    };
  }

  /**
   * Get current time window based on configuration
   */
  getCurrentTimeWindow(now: Date): TimeWindow {
    if (!this.config.timeBasedUsage?.enabled) {
      return {
        mode: 'off-hours',
        startHour: 0,
        endHour: 23,
        isActive: false,
        nextTransition: this.getNextMidnight(now),
      };
    }

    const hour = now.getHours();
    const dayHours = this.config.timeBasedUsage.dayModeHours || [9, 10, 11, 12, 13, 14, 15, 16, 17];
    const nightHours = this.config.timeBasedUsage.nightModeHours || [22, 23, 0, 1, 2, 3, 4, 5, 6];

    let mode: 'day' | 'night' | 'off-hours';
    let isActive: boolean;
    let startHour: number;
    let endHour: number;

    if (dayHours.includes(hour)) {
      mode = 'day';
      isActive = true;
      startHour = Math.min(...dayHours);
      endHour = Math.max(...dayHours);
    } else if (nightHours.includes(hour)) {
      mode = 'night';
      isActive = true;
      startHour = Math.min(...nightHours);
      endHour = Math.max(...nightHours);
    } else {
      mode = 'off-hours';
      isActive = false;
      startHour = 0;
      endHour = 23;
    }

    const nextTransition = this.getNextModeTransition(now);

    return {
      mode,
      startHour,
      endHour,
      isActive,
      nextTransition,
    };
  }

  /**
   * Calculate current capacity percentage and determine if threshold is exceeded
   */
  getCapacityInfo(timeWindow: TimeWindow, now: Date): CapacityInfo {
    const dailyUsage = this.usageProvider.getCurrentDailyUsage();
    const dailyBudget = this.usageProvider.getDailyBudget();
    const activeTasks = this.usageProvider.getActiveTasks();

    // Calculate capacity percentage based on daily budget
    const currentPercentage = dailyBudget > 0 ? dailyUsage.totalCost / dailyBudget : 0;

    // Get threshold for current time window
    let threshold: number;
    if (!this.config.timeBasedUsage?.enabled || timeWindow.mode === 'off-hours') {
      threshold = 1.0; // 100% - only stop when budget is completely exhausted
    } else if (timeWindow.mode === 'day') {
      threshold = this.config.timeBasedUsage.dayModeCapacityThreshold || 0.90;
    } else {
      threshold = this.config.timeBasedUsage.nightModeCapacityThreshold || 0.96;
    }

    // Determine if should pause
    const shouldPause = currentPercentage >= threshold;
    let reason: string | undefined;

    if (shouldPause) {
      reason = `Capacity threshold exceeded (${(currentPercentage * 100).toFixed(1)}% >= ${(threshold * 100).toFixed(1)}%)`;
    }

    return {
      currentPercentage,
      threshold,
      shouldPause,
      reason,
    };
  }

  /**
   * Get the next time daily stats will reset (midnight in local timezone)
   */
  getNextResetTime(now: Date): Date {
    return this.getNextMidnight(now);
  }

  /**
   * Get usage statistics formatted for display
   */
  getUsageStats(now: Date = new Date()): {
    timeWindow: TimeWindow;
    capacity: CapacityInfo;
    dailyUsage: ReturnType<UsageStatsProvider['getCurrentDailyUsage']>;
    activeTasks: number;
    nextResetTime: Date;
  } {
    const timeWindow = this.getCurrentTimeWindow(now);
    const capacity = this.getCapacityInfo(timeWindow, now);
    const dailyUsage = this.usageProvider.getCurrentDailyUsage();
    const activeTasks = this.usageProvider.getActiveTasks();
    const nextResetTime = this.getNextResetTime(now);

    return {
      timeWindow,
      capacity,
      dailyUsage,
      activeTasks,
      nextResetTime,
    };
  }

  /**
   * Calculate milliseconds until the next day/night mode switch
   * Handles edge cases: midnight wraparound, same-day transitions
   */
  getTimeUntilModeSwitch(now: Date = new Date()): number {
    const timeWindow = this.getCurrentTimeWindow(now);
    return timeWindow.nextTransition.getTime() - now.getTime();
  }

  /**
   * Calculate milliseconds until budget resets at midnight
   * Always returns time until next local midnight
   */
  getTimeUntilBudgetReset(now: Date = new Date()): number {
    const nextMidnight = this.getNextMidnight(now);
    return nextMidnight.getTime() - now.getTime();
  }

  /**
   * Register a callback to be invoked when capacity is restored
   * Capacity restoration events:
   *   - Mode switch from day to night (higher thresholds)
   *   - Budget reset at midnight
   *   - Capacity drops below threshold (external usage tracking update)
   * Returns an unsubscribe function
   */
  onCapacityRestored(callback: CapacityRestoredCallback): () => void {
    this.capacityCallbacks.add(callback);
    this.ensureMonitoring();

    // Return unsubscribe function
    return () => {
      this.capacityCallbacks.delete(callback);
      if (this.capacityCallbacks.size === 0) {
        this.stopMonitoring();
      }
    };
  }

  /**
   * Cleanup resources when scheduler is no longer needed
   */
  destroy(): void {
    this.stopMonitoring();
    this.capacityCallbacks.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get the next mode transition time
   */
  private getNextModeTransition(now: Date): Date {
    if (!this.config.timeBasedUsage?.enabled) {
      return this.getNextMidnight(now);
    }

    const dayHours = this.config.timeBasedUsage.dayModeHours || [9, 10, 11, 12, 13, 14, 15, 16, 17];
    const nightHours = this.config.timeBasedUsage.nightModeHours || [22, 23, 0, 1, 2, 3, 4, 5, 6];
    const currentHour = now.getHours();

    // Combine and sort all transition hours
    const allTransitions = [...new Set([...dayHours, ...nightHours])].sort((a, b) => a - b);

    // Find next transition hour after current hour
    const nextTransition = allTransitions.find(hour => hour > currentHour);

    const nextSwitch = new Date(now);
    if (nextTransition !== undefined) {
      nextSwitch.setHours(nextTransition, 0, 0, 0);
    } else {
      // Next transition is tomorrow
      nextSwitch.setDate(nextSwitch.getDate() + 1);
      nextSwitch.setHours(allTransitions[0], 0, 0, 0);
    }

    return nextSwitch;
  }

  /**
   * Get next midnight in local timezone
   */
  private getNextMidnight(now: Date): Date {
    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);
    return nextDay;
  }

  /**
   * Generate helpful recommendations based on current state
   */
  private generateRecommendations(
    timeWindow: TimeWindow,
    capacity: CapacityInfo,
    now: Date
  ): string[] {
    const recommendations: string[] = [];

    if (!timeWindow.isActive) {
      recommendations.push(
        `Consider enabling time-based usage or waiting until ${timeWindow.nextTransition.toLocaleTimeString()}`
      );
    }

    if (capacity.shouldPause && capacity.currentPercentage >= 0.8) {
      recommendations.push('Consider increasing daily budget or adjusting capacity thresholds');

      if (timeWindow.mode === 'day') {
        recommendations.push('Tasks will resume with higher limits during night mode');
      }
    }

    if (timeWindow.mode === 'day' && capacity.currentPercentage > 0.5) {
      const nightStart = this.config.timeBasedUsage?.nightModeHours?.[0] || 22;
      const hoursUntilNight = (nightStart - now.getHours() + 24) % 24;
      if (hoursUntilNight <= 6) {
        recommendations.push(`Night mode starts in ${hoursUntilNight} hours with higher limits`);
      }
    }

    return recommendations;
  }

  /**
   * Ensure capacity monitoring is active when callbacks are registered
   */
  private ensureMonitoring(): void {
    if (this.monitoringTimer) return;
    this.scheduleNextCheck();
  }

  /**
   * Stop capacity monitoring
   */
  private stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearTimeout(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }
  }

  /**
   * Schedule the next capacity check
   */
  private scheduleNextCheck(): void {
    const now = new Date();
    const timeToModeSwitch = this.getTimeUntilModeSwitch(now);
    const timeToBudgetReset = this.getTimeUntilBudgetReset(now);

    // Check at the earlier of: mode switch, budget reset, or periodic (60s)
    const checkIn = Math.min(
      timeToModeSwitch,
      timeToBudgetReset,
      60000 // Fallback check every 60 seconds for usage changes
    );

    this.monitoringTimer = setTimeout(() => {
      this.checkCapacityRestored();
      this.scheduleNextCheck();
    }, Math.max(100, checkIn)); // Minimum 100ms to prevent tight loops
  }

  /**
   * Check if capacity has been restored and fire callbacks
   */
  private checkCapacityRestored(): void {
    const now = new Date();
    const timeWindow = this.getCurrentTimeWindow(now);
    const capacity = this.getCapacityInfo(timeWindow, now);

    // If this is the first check, just store the state
    if (!this.lastCapacityState) {
      this.lastCapacityState = {
        shouldPause: capacity.shouldPause,
        capacity: { ...capacity },
        timeWindow: { ...timeWindow }
      };
      return;
    }

    // Check if capacity was restored
    const wasBlocked = this.lastCapacityState.shouldPause;
    const isNowUnblocked = !capacity.shouldPause;

    if (wasBlocked && isNowUnblocked && this.capacityCallbacks.size > 0) {
      // Determine the reason for restoration
      let reason: CapacityRestoredReason;

      // Check if time window mode changed
      if (this.lastCapacityState.timeWindow.mode !== timeWindow.mode) {
        reason = 'mode_switch';
      }
      // Check if it's a new day (budget reset) by comparing timestamps
      else if (this.hasDayChanged(this.lastCapacityState.timeWindow.nextTransition, now)) {
        reason = 'budget_reset';
      }
      // Otherwise it's due to usage decrease
      else {
        reason = 'usage_decreased';
      }

      const event: CapacityRestoredEvent = {
        reason,
        previousCapacity: { ...this.lastCapacityState.capacity },
        newCapacity: { ...capacity },
        timeWindow: { ...timeWindow },
        timestamp: now
      };

      // Fire callbacks (wrap in try-catch to prevent one failing callback from breaking others)
      this.capacityCallbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in capacity restored callback:', error);
        }
      });
    }

    // Update state for next check
    this.lastCapacityState = {
      shouldPause: capacity.shouldPause,
      capacity: { ...capacity },
      timeWindow: { ...timeWindow }
    };
  }

  /**
   * Check if the day has changed between two dates (for budget reset detection)
   */
  private hasDayChanged(previousDate: Date, currentDate: Date): boolean {
    return previousDate.getDate() !== currentDate.getDate() ||
           previousDate.getMonth() !== currentDate.getMonth() ||
           previousDate.getFullYear() !== currentDate.getFullYear();
  }
}

// ============================================================================
// Usage Manager Integration
// ============================================================================

/**
 * Adapter to use UsageManager as a UsageStatsProvider
 */
export class UsageManagerProvider implements UsageStatsProvider {
  constructor(private usageManager: any) {} // Use 'any' to avoid circular dependency

  getCurrentDailyUsage() {
    const stats = this.usageManager.getUsageStats();
    return {
      totalTokens: stats.current.dailyUsage.totalTokens,
      totalCost: stats.current.dailyUsage.totalCost,
      tasksCompleted: stats.current.dailyUsage.tasksCompleted,
      tasksFailed: stats.current.dailyUsage.tasksFailed,
    };
  }

  getActiveTasks(): number {
    const stats = this.usageManager.getUsageStats();
    return stats.active.length;
  }

  getDailyBudget(): number {
    const baseLimits = this.usageManager.getBaseLimits();
    return baseLimits.dailyBudget || 100.0;
  }
}