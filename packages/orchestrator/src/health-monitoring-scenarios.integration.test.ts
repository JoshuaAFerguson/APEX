import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthMonitor } from './health-monitor';
import { DaemonRunner } from './runner';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import type { HealthMetrics, DaemonMemoryUsage, DaemonTaskCounts } from '@apexcli/core';
import type { DaemonMetrics } from './runner';

/**
 * Health Monitoring Scenarios Integration Tests
 *
 * This test file covers the following 4 scenario categories:
 * 1. Health check during task execution tests
 * 2. Health state after graceful shutdown tests
 * 3. Health metrics accuracy during mode transitions tests
 * 4. Watchdog trigger scenario tests
 */

// Mock dependencies
vi.mock('./index', () => ({
  ApexOrchestrator: vi.fn(),
}));

vi.mock('./store', () => ({
  TaskStore: vi.fn(),
}));

vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadConfig: vi.fn(),
    getEffectiveConfig: vi.fn(),
  };
});

vi.mock('./usage-manager', () => ({
  UsageManager: vi.fn(),
}));

vi.mock('./daemon-scheduler', () => ({
  DaemonScheduler: vi.fn(),
}));

describe('Health Monitoring Scenarios Integration Tests', () => {
  let healthMonitor: HealthMonitor;
  let daemonRunner: DaemonRunner;
  let mockDaemonMetrics: DaemonMetrics;

  beforeEach(() => {
    vi.useFakeTimers();

    // Initialize HealthMonitor with custom settings
    healthMonitor = new HealthMonitor({ maxRestartHistorySize: 10 });

    // Initialize DaemonRunner with proper options
    daemonRunner = new DaemonRunner({
      projectPath: '/tmp/test-project',
      pollIntervalMs: 1000,
      maxConcurrentTasks: 4,
      logToStdout: false,
      healthMonitor: healthMonitor,
    });

    // Default mock for daemon metrics
    mockDaemonMetrics = {
      startedAt: new Date(),
      uptime: 0,
      tasksProcessed: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      activeTaskCount: 0,
      activeTaskIds: [],
      lastPollAt: new Date(),
      pollCount: 0,
      isRunning: true,
      isPaused: false,
    };

    // Mock process.memoryUsage for consistent testing
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: 100 * 1024 * 1024, // 100MB
      heapTotal: 200 * 1024 * 1024, // 200MB
      rss: 300 * 1024 * 1024, // 300MB
      external: 10 * 1024 * 1024,
      arrayBuffers: 5 * 1024 * 1024,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();

    // Clean up daemon runner
    if (daemonRunner) {
      daemonRunner.stop();
    }
  });

  // ============================================================================
  // 1. Health Check During Task Execution Tests
  // ============================================================================
  describe('Scenario 1: Health check during task execution', () => {
    it('should maintain health check accuracy while tasks are actively processing', () => {
      daemonRunner.start();

      // Simulate task execution phase
      mockDaemonMetrics = {
        ...mockDaemonMetrics,
        tasksProcessed: 5,
        tasksSucceeded: 3,
        tasksFailed: 1,
        activeTaskCount: 2,
        isRunning: true,
      };

      vi.spyOn(daemonRunner, 'getMetrics').mockReturnValue(mockDaemonMetrics);

      // Perform health checks during active task processing
      healthMonitor.performHealthCheck(true);
      vi.advanceTimersByTime(5000);
      healthMonitor.performHealthCheck(true);
      vi.advanceTimersByTime(5000);
      healthMonitor.performHealthCheck(true);

      const report = healthMonitor.getHealthReport(daemonRunner);

      // Verify task counts are accurately reflected
      expect(report.taskCounts.processed).toBe(5);
      expect(report.taskCounts.succeeded).toBe(3);
      expect(report.taskCounts.failed).toBe(1);
      expect(report.taskCounts.active).toBe(2);

      // Verify health checks are tracked
      expect(report.healthChecksPassed).toBe(3);
      expect(report.healthChecksFailed).toBe(0);
    });

    it('should track health check failures during task overload scenarios', () => {
      daemonRunner.start();

      // Simulate task overload with high concurrency
      mockDaemonMetrics = {
        ...mockDaemonMetrics,
        tasksProcessed: 50,
        tasksSucceeded: 30,
        tasksFailed: 15,
        activeTaskCount: 4, // At max concurrency
        isRunning: true,
      };

      vi.spyOn(daemonRunner, 'getMetrics').mockReturnValue(mockDaemonMetrics);

      // Simulate mixed health check results during overload
      healthMonitor.performHealthCheck(true);
      vi.advanceTimersByTime(30000);
      healthMonitor.performHealthCheck(false); // Overload causes failure
      vi.advanceTimersByTime(30000);
      healthMonitor.performHealthCheck(false); // Still overloaded
      vi.advanceTimersByTime(30000);
      healthMonitor.performHealthCheck(true); // Recovery

      const report = healthMonitor.getHealthReport(daemonRunner);

      expect(report.healthChecksPassed).toBe(2);
      expect(report.healthChecksFailed).toBe(2);
      expect(report.taskCounts.active).toBe(4);
    });

    it('should correlate health check timing with task completion events', () => {
      daemonRunner.start();

      const taskPhases = [
        { tasksProcessed: 0, activeTaskCount: 0, checkPassed: true },
        { tasksProcessed: 5, activeTaskCount: 3, checkPassed: true },
        { tasksProcessed: 10, activeTaskCount: 4, checkPassed: false }, // At capacity
        { tasksProcessed: 15, activeTaskCount: 2, checkPassed: true },
        { tasksProcessed: 20, activeTaskCount: 0, checkPassed: true }, // All complete
      ];

      taskPhases.forEach((phase, index) => {
        mockDaemonMetrics = {
          ...mockDaemonMetrics,
          tasksProcessed: phase.tasksProcessed,
          activeTaskCount: phase.activeTaskCount,
          tasksSucceeded: phase.tasksProcessed - phase.activeTaskCount,
        };

        vi.spyOn(daemonRunner, 'getMetrics').mockReturnValue(mockDaemonMetrics);
        healthMonitor.performHealthCheck(phase.checkPassed);
        vi.advanceTimersByTime(60000); // 1 minute between phases
      });

      const finalReport = healthMonitor.getHealthReport(daemonRunner);

      expect(finalReport.healthChecksPassed).toBe(4);
      expect(finalReport.healthChecksFailed).toBe(1);
      expect(finalReport.uptime).toBeGreaterThanOrEqual(240000); // 4 minutes elapsed
    });

    it('should handle rapid task creation and completion with concurrent health checks', async () => {
      daemonRunner.start();

      // Simulate rapid task churn
      const checkPromises = [];
      for (let i = 0; i < 20; i++) {
        checkPromises.push(
          Promise.resolve().then(() => {
            mockDaemonMetrics = {
              ...mockDaemonMetrics,
              tasksProcessed: i * 2,
              activeTaskCount: Math.floor(Math.random() * 4),
              tasksSucceeded: Math.floor(i * 1.5),
              tasksFailed: Math.floor(i * 0.1),
            };

            vi.spyOn(daemonRunner, 'getMetrics').mockReturnValue(mockDaemonMetrics);
            healthMonitor.performHealthCheck(Math.random() > 0.2);
            return healthMonitor.getHealthReport(daemonRunner);
          })
        );
      }

      const reports = await Promise.all(checkPromises);

      expect(reports).toHaveLength(20);
      reports.forEach(report => {
        expect(report).toHaveProperty('taskCounts');
        expect(report).toHaveProperty('healthChecksPassed');
        expect(report).toHaveProperty('healthChecksFailed');
      });

      const finalReport = healthMonitor.getHealthReport(daemonRunner);
      expect(finalReport.healthChecksPassed + finalReport.healthChecksFailed).toBe(20);
    });
  });

  // ============================================================================
  // 2. Health State After Graceful Shutdown Tests
  // ============================================================================
  describe('Scenario 2: Health state after graceful shutdown', () => {
    it('should preserve health metrics after daemon graceful shutdown', () => {
      daemonRunner.start();

      // Build up health history during operation
      for (let i = 0; i < 10; i++) {
        healthMonitor.performHealthCheck(i % 3 !== 0);
        vi.advanceTimersByTime(30000);
      }

      healthMonitor.recordRestart('crash', 1, false);

      // Capture pre-shutdown state
      const preShutdownReport = healthMonitor.getHealthReport(daemonRunner);
      const preShutdownPassed = preShutdownReport.healthChecksPassed;
      const preShutdownFailed = preShutdownReport.healthChecksFailed;
      const preShutdownRestarts = preShutdownReport.restartHistory.length;

      // Graceful shutdown
      daemonRunner.stop();

      // Health metrics should persist after shutdown
      const postShutdownReport = healthMonitor.getHealthReport();

      expect(postShutdownReport.healthChecksPassed).toBe(preShutdownPassed);
      expect(postShutdownReport.healthChecksFailed).toBe(preShutdownFailed);
      expect(postShutdownReport.restartHistory).toHaveLength(preShutdownRestarts);
    });

    it('should correctly track restart events across multiple shutdown cycles', () => {
      const shutdownCycles = [
        { reason: 'manual', exitCode: 0, watchdog: false },
        { reason: 'config-reload', exitCode: 0, watchdog: false },
        { reason: 'oom', exitCode: 137, watchdog: true },
        { reason: 'crash', exitCode: 1, watchdog: false },
      ];

      shutdownCycles.forEach((cycle, index) => {
        daemonRunner.start();
        healthMonitor.performHealthCheck(true);
        vi.advanceTimersByTime(60000);

        // Record restart before shutdown
        healthMonitor.recordRestart(cycle.reason, cycle.exitCode, cycle.watchdog);

        daemonRunner.stop();
        vi.advanceTimersByTime(5000);
      });

      const finalReport = healthMonitor.getHealthReport();

      expect(finalReport.restartHistory).toHaveLength(4);
      expect(finalReport.restartHistory[0].reason).toBe('crash'); // Most recent first
      expect(finalReport.restartHistory[3].reason).toBe('manual'); // Oldest last
      expect(healthMonitor.hasWatchdogRestarts()).toBe(true);
    });

    it('should maintain uptime accuracy through graceful shutdown and restart', () => {
      const startTime = Date.now();

      daemonRunner.start();
      healthMonitor.performHealthCheck(true);

      // Simulate 5 minutes of operation
      vi.advanceTimersByTime(300000);

      const preShutdownUptime = healthMonitor.getUptime();
      expect(preShutdownUptime).toBeGreaterThanOrEqual(300000);

      // Graceful shutdown
      daemonRunner.stop();
      vi.advanceTimersByTime(2000);

      // Uptime continues to track (HealthMonitor wasn't restarted)
      const postShutdownUptime = healthMonitor.getUptime();
      expect(postShutdownUptime).toBeGreaterThan(preShutdownUptime);
    });

    it('should reset task counts correctly when daemon restarts after graceful shutdown', () => {
      daemonRunner.start();

      // Initial task processing
      mockDaemonMetrics = {
        ...mockDaemonMetrics,
        tasksProcessed: 100,
        tasksSucceeded: 95,
        tasksFailed: 5,
        activeTaskCount: 0,
      };

      vi.spyOn(daemonRunner, 'getMetrics').mockReturnValue(mockDaemonMetrics);

      const preShutdownReport = healthMonitor.getHealthReport(daemonRunner);
      expect(preShutdownReport.taskCounts.processed).toBe(100);

      // Graceful shutdown
      daemonRunner.stop();

      // Report without daemonRunner should show zero task counts
      const shutdownReport = healthMonitor.getHealthReport();
      expect(shutdownReport.taskCounts.processed).toBe(0);
      expect(shutdownReport.taskCounts.active).toBe(0);

      // Restart daemon
      daemonRunner.start();

      // After restart, metrics should reflect new daemon's state
      const newMockMetrics = {
        ...mockDaemonMetrics,
        tasksProcessed: 0,
        tasksSucceeded: 0,
        tasksFailed: 0,
        activeTaskCount: 0,
      };

      vi.spyOn(daemonRunner, 'getMetrics').mockReturnValue(newMockMetrics);

      const postRestartReport = healthMonitor.getHealthReport(daemonRunner);
      expect(postRestartReport.taskCounts.processed).toBe(0);
    });

    it('should handle health check counters consistently through shutdown-restart cycles', () => {
      // First session
      daemonRunner.start();
      healthMonitor.performHealthCheck(true);
      healthMonitor.performHealthCheck(true);
      healthMonitor.performHealthCheck(false);
      daemonRunner.stop();

      // Second session
      daemonRunner.start();
      healthMonitor.performHealthCheck(true);
      healthMonitor.performHealthCheck(false);
      daemonRunner.stop();

      const finalReport = healthMonitor.getHealthReport();

      // Health check counters accumulate across sessions
      expect(finalReport.healthChecksPassed).toBe(3);
      expect(finalReport.healthChecksFailed).toBe(2);
    });
  });

  // ============================================================================
  // 3. Health Metrics Accuracy During Mode Transitions Tests
  // ============================================================================
  describe('Scenario 3: Health metrics accuracy during mode transitions', () => {
    it('should maintain accurate health metrics during day-to-night mode transition', () => {
      daemonRunner.start();

      // Simulate day mode operation (08:00 - 18:00)
      const dayModePhases = [
        { hour: 8, checks: 5, memoryHeap: 50 * 1024 * 1024 },
        { hour: 12, checks: 10, memoryHeap: 75 * 1024 * 1024 },
        { hour: 17, checks: 15, memoryHeap: 100 * 1024 * 1024 },
      ];

      dayModePhases.forEach(phase => {
        vi.spyOn(process, 'memoryUsage').mockReturnValue({
          heapUsed: phase.memoryHeap,
          heapTotal: phase.memoryHeap * 2,
          rss: phase.memoryHeap * 3,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        });

        for (let i = 0; i < phase.checks; i++) {
          healthMonitor.performHealthCheck(true);
        }
      });

      const dayModeReport = healthMonitor.getHealthReport(daemonRunner);
      expect(dayModeReport.healthChecksPassed).toBe(30);

      // Transition to night mode
      healthMonitor.recordRestart('mode_switch', 0, false);

      // Simulate night mode operation with different memory profile
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 150 * 1024 * 1024, // Higher for night batch processing
        heapTotal: 300 * 1024 * 1024,
        rss: 450 * 1024 * 1024,
        external: 20 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024,
      });

      for (let i = 0; i < 10; i++) {
        healthMonitor.performHealthCheck(true);
        vi.advanceTimersByTime(60000);
      }

      const nightModeReport = healthMonitor.getHealthReport(daemonRunner);

      expect(nightModeReport.healthChecksPassed).toBe(40);
      expect(nightModeReport.memoryUsage.heapUsed).toBe(150 * 1024 * 1024);
      expect(nightModeReport.restartHistory[0].reason).toBe('mode_switch');
    });

    it('should accurately track memory usage fluctuations during mode transitions', () => {
      daemonRunner.start();

      const memoryTransitions = [
        { mode: 'startup', heapUsed: 30 * 1024 * 1024, duration: 5000 },
        { mode: 'day-warmup', heapUsed: 80 * 1024 * 1024, duration: 60000 },
        { mode: 'day-peak', heapUsed: 150 * 1024 * 1024, duration: 300000 },
        { mode: 'transition', heapUsed: 200 * 1024 * 1024, duration: 10000 },
        { mode: 'night-batch', heapUsed: 250 * 1024 * 1024, duration: 600000 },
        { mode: 'night-idle', heapUsed: 100 * 1024 * 1024, duration: 300000 },
      ];

      const memoryReadings: number[] = [];

      memoryTransitions.forEach(transition => {
        vi.spyOn(process, 'memoryUsage').mockReturnValue({
          heapUsed: transition.heapUsed,
          heapTotal: transition.heapUsed * 2,
          rss: transition.heapUsed * 3,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        });

        healthMonitor.performHealthCheck(true);
        const report = healthMonitor.getHealthReport(daemonRunner);
        memoryReadings.push(report.memoryUsage.heapUsed);

        vi.advanceTimersByTime(transition.duration);
      });

      // Verify memory readings capture all transitions
      expect(memoryReadings).toEqual([
        30 * 1024 * 1024,
        80 * 1024 * 1024,
        150 * 1024 * 1024,
        200 * 1024 * 1024,
        250 * 1024 * 1024,
        100 * 1024 * 1024,
      ]);
    });

    it('should preserve health check history across capacity threshold changes', () => {
      daemonRunner.start();

      // Day mode: conservative thresholds
      for (let i = 0; i < 20; i++) {
        const success = i % 5 !== 0; // 80% success rate
        healthMonitor.performHealthCheck(success);
        vi.advanceTimersByTime(30000);
      }

      const dayModeReport = healthMonitor.getHealthReport(daemonRunner);
      expect(dayModeReport.healthChecksPassed).toBe(16);
      expect(dayModeReport.healthChecksFailed).toBe(4);

      // Night mode: aggressive thresholds (may have more failures)
      for (let i = 0; i < 20; i++) {
        const success = i % 3 !== 0; // 66% success rate
        healthMonitor.performHealthCheck(success);
        vi.advanceTimersByTime(30000);
      }

      const nightModeReport = healthMonitor.getHealthReport(daemonRunner);
      const additionalPassed = 14; // ~66% of 20
      const additionalFailed = 6; // ~33% of 20

      expect(nightModeReport.healthChecksPassed).toBe(16 + additionalPassed);
      expect(nightModeReport.healthChecksFailed).toBe(4 + additionalFailed);
    });

    it('should handle budget reset transitions with accurate metrics', () => {
      daemonRunner.start();

      // End of budget period with high usage
      mockDaemonMetrics = {
        ...mockDaemonMetrics,
        tasksProcessed: 1000,
        tasksSucceeded: 950,
        tasksFailed: 50,
        activeTaskCount: 0,
      };

      vi.spyOn(daemonRunner, 'getMetrics').mockReturnValue(mockDaemonMetrics);
      healthMonitor.performHealthCheck(true);

      const preResetReport = healthMonitor.getHealthReport(daemonRunner);
      expect(preResetReport.taskCounts.processed).toBe(1000);

      // Simulate budget reset (midnight)
      healthMonitor.recordRestart('budget_reset', 0, false);

      // After budget reset, daemon may restart with fresh counters
      const newDaemonMetrics = {
        ...mockDaemonMetrics,
        tasksProcessed: 0,
        tasksSucceeded: 0,
        tasksFailed: 0,
        activeTaskCount: 0,
      };

      vi.spyOn(daemonRunner, 'getMetrics').mockReturnValue(newDaemonMetrics);
      healthMonitor.performHealthCheck(true);

      const postResetReport = healthMonitor.getHealthReport(daemonRunner);

      // Task counts reset, but health history preserved
      expect(postResetReport.taskCounts.processed).toBe(0);
      expect(postResetReport.healthChecksPassed).toBe(2); // Pre and post reset checks
      expect(postResetReport.restartHistory[0].reason).toBe('budget_reset');
    });

    it('should maintain data consistency during rapid mode switches', () => {
      daemonRunner.start();

      const modeSwitches = [
        'day-start',
        'day-peak',
        'transition-to-night',
        'night-batch',
        'night-idle',
        'transition-to-day',
      ];

      modeSwitches.forEach((mode, index) => {
        // Perform health checks
        healthMonitor.performHealthCheck(true);

        // Record mode transition if not the first
        if (index > 0) {
          healthMonitor.recordRestart('mode_switch', 0, false);
        }

        vi.advanceTimersByTime(10000);
      });

      const finalReport = healthMonitor.getHealthReport(daemonRunner);

      expect(finalReport.healthChecksPassed).toBe(6);
      expect(finalReport.restartHistory).toHaveLength(5); // 5 mode switches recorded
    });
  });

  // ============================================================================
  // 4. Watchdog Trigger Scenario Tests
  // ============================================================================
  describe('Scenario 4: Watchdog trigger scenarios', () => {
    it('should correctly record watchdog-triggered restarts', () => {
      daemonRunner.start();
      healthMonitor.performHealthCheck(true);

      // Simulate health check failure pattern leading to watchdog intervention
      healthMonitor.performHealthCheck(false);
      vi.advanceTimersByTime(30000);
      healthMonitor.performHealthCheck(false);
      vi.advanceTimersByTime(30000);
      healthMonitor.performHealthCheck(false);

      // Watchdog triggers restart
      healthMonitor.recordRestart('health_check_timeout', 143, true);

      const report = healthMonitor.getHealthReport(daemonRunner);

      expect(report.healthChecksPassed).toBe(1);
      expect(report.healthChecksFailed).toBe(3);
      expect(report.restartHistory).toHaveLength(1);
      expect(report.restartHistory[0].triggeredByWatchdog).toBe(true);
      expect(report.restartHistory[0].reason).toBe('health_check_timeout');
      expect(report.restartHistory[0].exitCode).toBe(143);
      expect(healthMonitor.hasWatchdogRestarts()).toBe(true);
    });

    it('should track multiple watchdog interventions over time', () => {
      daemonRunner.start();

      const watchdogEvents = [
        { reason: 'unresponsive', exitCode: 143, delay: 3600000 },
        { reason: 'memory_exhaustion', exitCode: 137, delay: 7200000 },
        { reason: 'cpu_deadlock', exitCode: 124, delay: 1800000 },
        { reason: 'health_check_timeout', exitCode: 143, delay: 3600000 },
      ];

      watchdogEvents.forEach(event => {
        // Simulate normal operation
        for (let i = 0; i < 5; i++) {
          healthMonitor.performHealthCheck(true);
          vi.advanceTimersByTime(event.delay / 5);
        }

        // Watchdog intervention
        healthMonitor.performHealthCheck(false);
        healthMonitor.recordRestart(event.reason, event.exitCode, true);

        vi.advanceTimersByTime(5000); // Recovery time
      });

      const report = healthMonitor.getHealthReport(daemonRunner);

      expect(report.restartHistory).toHaveLength(4);
      expect(healthMonitor.hasWatchdogRestarts()).toBe(true);

      // All restarts were triggered by watchdog
      report.restartHistory.forEach(restart => {
        expect(restart.triggeredByWatchdog).toBe(true);
      });

      // Verify health check pattern
      expect(report.healthChecksPassed).toBe(20); // 5 per watchdog event
      expect(report.healthChecksFailed).toBe(4); // 1 per watchdog event
    });

    it('should differentiate between watchdog and manual restarts', () => {
      daemonRunner.start();

      // Mix of restart types
      healthMonitor.recordRestart('manual_restart', 0, false);
      vi.advanceTimersByTime(60000);

      healthMonitor.recordRestart('watchdog_intervention', 143, true);
      vi.advanceTimersByTime(60000);

      healthMonitor.recordRestart('config_reload', 0, false);
      vi.advanceTimersByTime(60000);

      healthMonitor.recordRestart('oom_killed', 137, true);
      vi.advanceTimersByTime(60000);

      healthMonitor.recordRestart('graceful_shutdown', 0, false);

      const report = healthMonitor.getHealthReport(daemonRunner);

      expect(report.restartHistory).toHaveLength(5);
      expect(healthMonitor.hasWatchdogRestarts()).toBe(true);

      // Count watchdog vs manual restarts
      const watchdogRestarts = report.restartHistory.filter(r => r.triggeredByWatchdog);
      const manualRestarts = report.restartHistory.filter(r => !r.triggeredByWatchdog);

      expect(watchdogRestarts).toHaveLength(2);
      expect(manualRestarts).toHaveLength(3);

      // Verify most recent is first
      expect(report.restartHistory[0].reason).toBe('graceful_shutdown');
      expect(report.restartHistory[4].reason).toBe('manual_restart');
    });

    it('should handle watchdog restart window and max restart limits', () => {
      const monitorWithSmallHistory = new HealthMonitor({ maxRestartHistorySize: 3 });
      daemonRunner.start();

      // Simulate rapid watchdog restarts (exceeding max)
      const rapidRestarts = [
        { reason: 'restart_1', exitCode: 1, watchdog: true },
        { reason: 'restart_2', exitCode: 2, watchdog: false },
        { reason: 'restart_3', exitCode: 3, watchdog: true },
        { reason: 'restart_4', exitCode: 4, watchdog: true },
        { reason: 'restart_5', exitCode: 5, watchdog: false },
      ];

      rapidRestarts.forEach(restart => {
        monitorWithSmallHistory.recordRestart(restart.reason, restart.exitCode, restart.watchdog);
        vi.advanceTimersByTime(30000);
      });

      const report = monitorWithSmallHistory.getHealthReport(daemonRunner);

      // Should only keep most recent 3
      expect(report.restartHistory).toHaveLength(3);
      expect(report.restartHistory[0].reason).toBe('restart_5');
      expect(report.restartHistory[1].reason).toBe('restart_4');
      expect(report.restartHistory[2].reason).toBe('restart_3');

      // Watchdog detection should only check current history
      expect(monitorWithSmallHistory.hasWatchdogRestarts()).toBe(true);
    });

    it('should simulate complete watchdog lifecycle with health degradation', () => {
      daemonRunner.start();

      // Phase 1: Healthy operation
      for (let i = 0; i < 10; i++) {
        healthMonitor.performHealthCheck(true);
        vi.advanceTimersByTime(30000);
      }

      let report = healthMonitor.getHealthReport(daemonRunner);
      expect(report.healthChecksPassed).toBe(10);
      expect(report.healthChecksFailed).toBe(0);

      // Phase 2: Degradation begins
      for (let i = 0; i < 5; i++) {
        healthMonitor.performHealthCheck(i < 2); // First 2 pass, rest fail
        vi.advanceTimersByTime(30000);
      }

      report = healthMonitor.getHealthReport(daemonRunner);
      expect(report.healthChecksPassed).toBe(12);
      expect(report.healthChecksFailed).toBe(3);

      // Phase 3: Watchdog intervention
      healthMonitor.performHealthCheck(false);
      healthMonitor.recordRestart('accumulated_failures', 1, true);

      report = healthMonitor.getHealthReport(daemonRunner);
      expect(report.healthChecksFailed).toBe(4);
      expect(report.restartHistory).toHaveLength(1);

      // Phase 4: Recovery and stabilization
      for (let i = 0; i < 5; i++) {
        healthMonitor.performHealthCheck(true);
        vi.advanceTimersByTime(30000);
      }

      const finalReport = healthMonitor.getHealthReport(daemonRunner);
      expect(finalReport.healthChecksPassed).toBe(17);
      expect(finalReport.healthChecksFailed).toBe(4);
      expect(finalReport.restartHistory[0].triggeredByWatchdog).toBe(true);
    });

    it('should handle watchdog restart with memory pressure scenarios', () => {
      daemonRunner.start();

      // Normal memory
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 100 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        rss: 300 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      });

      healthMonitor.performHealthCheck(true);
      const normalReport = healthMonitor.getHealthReport(daemonRunner);
      const normalMemory = normalReport.memoryUsage.heapUsed;

      // Memory pressure builds
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 400 * 1024 * 1024,
        heapTotal: 450 * 1024 * 1024,
        rss: 600 * 1024 * 1024,
        external: 50 * 1024 * 1024,
        arrayBuffers: 25 * 1024 * 1024,
      });

      healthMonitor.performHealthCheck(false);
      vi.advanceTimersByTime(10000);
      healthMonitor.performHealthCheck(false);

      const pressureReport = healthMonitor.getHealthReport(daemonRunner);
      expect(pressureReport.memoryUsage.heapUsed).toBeGreaterThan(normalMemory);

      // Watchdog triggers OOM restart
      healthMonitor.recordRestart('oom_detected', 137, true);

      // After restart, memory should be lower
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 50 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        rss: 150 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
      });

      healthMonitor.performHealthCheck(true);

      const recoveryReport = healthMonitor.getHealthReport(daemonRunner);
      expect(recoveryReport.memoryUsage.heapUsed).toBeLessThan(pressureReport.memoryUsage.heapUsed);
      expect(recoveryReport.restartHistory[0].reason).toBe('oom_detected');
      expect(recoveryReport.restartHistory[0].exitCode).toBe(137);
    });

    it('should track exit codes correctly for different watchdog scenarios', () => {
      daemonRunner.start();

      const exitCodeScenarios = [
        { reason: 'sigterm', exitCode: 143, description: 'SIGTERM (128+15)' },
        { reason: 'sigkill', exitCode: 137, description: 'SIGKILL (128+9)' },
        { reason: 'timeout', exitCode: 124, description: 'Timeout exit' },
        { reason: 'segfault', exitCode: 139, description: 'SIGSEGV (128+11)' },
        { reason: 'sigabrt', exitCode: 134, description: 'SIGABRT (128+6)' },
      ];

      exitCodeScenarios.forEach(scenario => {
        healthMonitor.recordRestart(scenario.reason, scenario.exitCode, true);
        vi.advanceTimersByTime(60000);
      });

      const report = healthMonitor.getHealthReport(daemonRunner);

      expect(report.restartHistory).toHaveLength(5);

      // Verify exit codes are preserved
      expect(report.restartHistory[0].exitCode).toBe(134); // Most recent
      expect(report.restartHistory[4].exitCode).toBe(143); // Oldest

      // Verify all were watchdog-triggered
      report.restartHistory.forEach(restart => {
        expect(restart.triggeredByWatchdog).toBe(true);
        expect(restart.exitCode).toBeDefined();
      });
    });
  });

  // ============================================================================
  // Additional Integration Scenarios
  // ============================================================================
  describe('Cross-scenario integration tests', () => {
    it('should maintain consistent state across all 4 scenario types combined', () => {
      daemonRunner.start();

      // Scenario 1: Task execution
      mockDaemonMetrics = {
        ...mockDaemonMetrics,
        tasksProcessed: 10,
        tasksSucceeded: 8,
        tasksFailed: 2,
        activeTaskCount: 1,
      };
      vi.spyOn(daemonRunner, 'getMetrics').mockReturnValue(mockDaemonMetrics);
      healthMonitor.performHealthCheck(true);

      // Scenario 2: Graceful shutdown
      daemonRunner.stop();
      healthMonitor.recordRestart('graceful_shutdown', 0, false);
      daemonRunner.start();

      // Scenario 3: Mode transition
      healthMonitor.recordRestart('mode_switch', 0, false);
      healthMonitor.performHealthCheck(true);

      // Scenario 4: Watchdog intervention
      healthMonitor.performHealthCheck(false);
      healthMonitor.performHealthCheck(false);
      healthMonitor.recordRestart('watchdog_timeout', 143, true);

      const finalReport = healthMonitor.getHealthReport(daemonRunner);

      // Verify all scenarios contributed to the report
      expect(finalReport.healthChecksPassed).toBe(2);
      expect(finalReport.healthChecksFailed).toBe(2);
      expect(finalReport.restartHistory).toHaveLength(3);
      expect(healthMonitor.hasWatchdogRestarts()).toBe(true);

      // Verify restart history order
      expect(finalReport.restartHistory[0].reason).toBe('watchdog_timeout');
      expect(finalReport.restartHistory[1].reason).toBe('mode_switch');
      expect(finalReport.restartHistory[2].reason).toBe('graceful_shutdown');
    });

    it('should handle edge cases in health report generation', () => {
      // Empty state
      let report = healthMonitor.getHealthReport();
      expect(report.healthChecksPassed).toBe(0);
      expect(report.healthChecksFailed).toBe(0);
      expect(report.restartHistory).toHaveLength(0);

      // Only restarts, no health checks
      healthMonitor.recordRestart('test', 0, false);
      report = healthMonitor.getHealthReport();
      expect(report.healthChecksPassed).toBe(0);
      expect(report.restartHistory).toHaveLength(1);

      // Reset health checks but keep restart history
      healthMonitor.resetHealthCheckCounters();
      report = healthMonitor.getHealthReport();
      expect(report.healthChecksPassed).toBe(0);
      expect(report.restartHistory).toHaveLength(1);

      // Clear restart history but health checks were reset
      healthMonitor.performHealthCheck(true);
      healthMonitor.clearRestartHistory();
      report = healthMonitor.getHealthReport();
      expect(report.healthChecksPassed).toBe(1);
      expect(report.restartHistory).toHaveLength(0);
    });
  });
});
