/**
 * Example integration of DaemonScheduler with UsageManager
 * This file shows how to use the DaemonScheduler in practice
 */

import { DaemonScheduler, UsageManagerProvider } from './daemon-scheduler';
import { UsageManager } from './usage-manager';
import { DaemonConfig, LimitsConfig } from '@apex/core';

/**
 * Example function showing how to integrate DaemonScheduler with existing daemon logic
 */
export function createDaemonScheduler(
  daemonConfig: DaemonConfig,
  limitsConfig: LimitsConfig,
  usageManager: UsageManager
): DaemonScheduler {
  // Create the usage provider adapter
  const usageProvider = new UsageManagerProvider(usageManager);

  // Create the scheduler
  const scheduler = new DaemonScheduler(daemonConfig, limitsConfig, usageProvider);

  return scheduler;
}

/**
 * Example of how daemon might use the scheduler to make decisions
 */
export async function checkShouldPauseTasks(scheduler: DaemonScheduler): Promise<{
  shouldPause: boolean;
  reason?: string;
  nextCheck: Date;
}> {
  const decision = scheduler.shouldPauseTasks();

  console.log('Scheduling Decision:', {
    shouldPause: decision.shouldPause,
    reason: decision.reason,
    timeWindow: decision.timeWindow.mode,
    capacityUsed: `${(decision.capacity.currentPercentage * 100).toFixed(1)}%`,
    threshold: `${(decision.capacity.threshold * 100).toFixed(1)}%`,
    nextReset: decision.nextResetTime.toISOString(),
  });

  if (decision.recommendations && decision.recommendations.length > 0) {
    console.log('Recommendations:');
    decision.recommendations.forEach((rec, idx) => {
      console.log(`  ${idx + 1}. ${rec}`);
    });
  }

  return {
    shouldPause: decision.shouldPause,
    reason: decision.reason,
    nextCheck: decision.shouldPause ? decision.timeWindow.nextTransition : new Date(Date.now() + 60000), // Check again in 1 minute if not paused
  };
}

/**
 * Example of how to get usage statistics for monitoring
 */
export function logUsageStatistics(scheduler: DaemonScheduler): void {
  const stats = scheduler.getUsageStats();

  console.log('Current Usage Statistics:', {
    timeWindow: {
      mode: stats.timeWindow.mode,
      active: stats.timeWindow.isActive,
      nextTransition: stats.timeWindow.nextTransition.toLocaleTimeString(),
    },
    capacity: {
      used: `${(stats.capacity.currentPercentage * 100).toFixed(1)}%`,
      threshold: `${(stats.capacity.threshold * 100).toFixed(1)}%`,
      shouldPause: stats.capacity.shouldPause,
    },
    dailyUsage: {
      cost: `$${stats.dailyUsage.totalCost.toFixed(2)}`,
      tokens: stats.dailyUsage.totalTokens.toLocaleString(),
      tasks: `${stats.dailyUsage.tasksCompleted} completed, ${stats.dailyUsage.tasksFailed} failed`,
    },
    activeTasks: stats.activeTasks,
    nextReset: stats.nextResetTime.toLocaleTimeString(),
  });
}

/**
 * Example configuration for time-based usage
 */
export const exampleDaemonConfig: Partial<DaemonConfig> = {
  timeBasedUsage: {
    enabled: true,
    dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17], // 9 AM - 5 PM
    nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6], // 10 PM - 6 AM
    dayModeCapacityThreshold: 0.80, // Pause at 80% during day
    nightModeCapacityThreshold: 0.95, // Pause at 95% during night
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