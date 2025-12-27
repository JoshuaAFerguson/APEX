import { HealthMetrics, DaemonMemoryUsage, DaemonTaskCounts, RestartRecord } from '@apexcli/core';
import { DaemonRunner, DaemonMetrics } from './runner';

/**
 * HealthMonitor tracks system health metrics for the APEX daemon
 * Collects memory usage, task processing statistics, and restart history
 * Integrates with existing DaemonRunner metrics to provide comprehensive health reporting
 */
export class HealthMonitor {
  private startTime: Date;
  private healthChecksPassed = 0;
  private healthChecksFailed = 0;
  private restartHistory: RestartRecord[] = [];
  private lastHealthCheck: Date;
  private readonly maxRestartHistorySize: number;

  constructor(options?: { maxRestartHistorySize?: number }) {
    this.startTime = new Date();
    this.lastHealthCheck = new Date();
    this.maxRestartHistorySize = options?.maxRestartHistorySize ?? 10;
  }

  /**
   * Record a restart event in the history
   * @param reason - The reason for the restart (e.g., 'crash', 'oom', 'watchdog', 'manual')
   * @param exitCode - Exit code from the previous instance (if applicable)
   * @param triggeredByWatchdog - Whether the restart was triggered by the watchdog
   */
  recordRestart(reason: string, exitCode?: number, triggeredByWatchdog = false): void {
    const restartRecord: RestartRecord = {
      timestamp: new Date(),
      reason,
      exitCode,
      triggeredByWatchdog,
    };

    // Add to beginning of array (most recent first)
    this.restartHistory.unshift(restartRecord);

    // Trim to maximum size
    if (this.restartHistory.length > this.maxRestartHistorySize) {
      this.restartHistory = this.restartHistory.slice(0, this.maxRestartHistorySize);
    }
  }

  /**
   * Collect current memory usage metrics from process.memoryUsage()
   * @returns Current memory usage statistics
   */
  private collectMemoryMetrics(): DaemonMemoryUsage {
    const memUsage = process.memoryUsage();

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
    };
  }

  /**
   * Convert DaemonRunner metrics to task count format
   * @param daemonMetrics - Metrics from DaemonRunner
   * @returns Task count statistics
   */
  private convertTaskMetrics(daemonMetrics: DaemonMetrics): DaemonTaskCounts {
    return {
      processed: daemonMetrics.tasksProcessed,
      succeeded: daemonMetrics.tasksSucceeded,
      failed: daemonMetrics.tasksFailed,
      active: daemonMetrics.activeTaskCount,
    };
  }

  /**
   * Perform a health check and update counters
   * @param success - Whether the health check passed
   */
  performHealthCheck(success: boolean): void {
    this.lastHealthCheck = new Date();

    if (success) {
      this.healthChecksPassed++;
    } else {
      this.healthChecksFailed++;
    }
  }

  /**
   * Get comprehensive health report combining memory, task, and restart metrics
   * @param daemonRunner - Optional DaemonRunner instance to get current task metrics
   * @returns Complete health metrics report
   */
  getHealthReport(daemonRunner?: DaemonRunner): HealthMetrics {
    const now = new Date();
    const uptime = now.getTime() - this.startTime.getTime();

    // Get current task metrics from DaemonRunner if available
    let taskCounts: DaemonTaskCounts;
    if (daemonRunner) {
      const daemonMetrics = daemonRunner.getMetrics();
      taskCounts = this.convertTaskMetrics(daemonMetrics);
    } else {
      // Fallback to basic counts if no DaemonRunner provided
      taskCounts = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        active: 0,
      };
    }

    return {
      uptime,
      memoryUsage: this.collectMemoryMetrics(),
      taskCounts,
      lastHealthCheck: this.lastHealthCheck,
      healthChecksPassed: this.healthChecksPassed,
      healthChecksFailed: this.healthChecksFailed,
      restartHistory: [...this.restartHistory], // Return copy to prevent mutation
    };
  }

  /**
   * Reset health check counters (useful for testing or periodic resets)
   */
  resetHealthCheckCounters(): void {
    this.healthChecksPassed = 0;
    this.healthChecksFailed = 0;
  }

  /**
   * Clear restart history (useful for testing)
   */
  clearRestartHistory(): void {
    this.restartHistory = [];
  }

  /**
   * Get current uptime in milliseconds
   * @returns Uptime since HealthMonitor was created
   */
  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Get the number of restart events in history
   * @returns Count of recorded restart events
   */
  getRestartCount(): number {
    return this.restartHistory.length;
  }

  /**
   * Get the most recent restart event
   * @returns Most recent restart record or undefined if no restarts recorded
   */
  getLastRestart(): RestartRecord | undefined {
    return this.restartHistory[0];
  }

  /**
   * Check if the daemon has had any restarts triggered by watchdog
   * @returns True if any restart was triggered by watchdog
   */
  hasWatchdogRestarts(): boolean {
    return this.restartHistory.some(restart => restart.triggeredByWatchdog);
  }
}