import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthMonitor } from './health-monitor';
import { DaemonRunner, type DaemonMetrics } from './runner';
import { DaemonMemoryUsage, DaemonTaskCounts, RestartRecord } from '@apexcli/core';

describe('HealthMonitor', () => {
  let healthMonitor: HealthMonitor;
  let mockDaemonRunner: DaemonRunner;

  beforeEach(() => {
    vi.useFakeTimers();
    healthMonitor = new HealthMonitor();

    // Mock DaemonRunner
    mockDaemonRunner = {
      getMetrics: vi.fn().mockReturnValue({
        startedAt: new Date('2023-01-01T00:00:00Z'),
        uptime: 1000,
        tasksProcessed: 10,
        tasksSucceeded: 8,
        tasksFailed: 2,
        activeTaskCount: 1,
        isRunning: true,
      } as DaemonMetrics),
    } as any;

    // Mock process.memoryUsage
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: 52428800, // 50MB
      heapTotal: 104857600, // 100MB
      rss: 157286400, // 150MB
      external: 1024000,
      arrayBuffers: 512000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default max restart history size', () => {
      const monitor = new HealthMonitor();
      expect(monitor.getRestartCount()).toBe(0);
    });

    it('should initialize with custom max restart history size', () => {
      const monitor = new HealthMonitor({ maxRestartHistorySize: 5 });
      expect(monitor.getRestartCount()).toBe(0);
    });
  });

  describe('recordRestart', () => {
    it('should record a restart event', () => {
      healthMonitor.recordRestart('crash', 1, false);

      expect(healthMonitor.getRestartCount()).toBe(1);

      const lastRestart = healthMonitor.getLastRestart();
      expect(lastRestart).toBeDefined();
      expect(lastRestart?.reason).toBe('crash');
      expect(lastRestart?.exitCode).toBe(1);
      expect(lastRestart?.triggeredByWatchdog).toBe(false);
    });

    it('should limit restart history to max size', () => {
      const monitor = new HealthMonitor({ maxRestartHistorySize: 2 });

      monitor.recordRestart('crash1', 1);
      monitor.recordRestart('crash2', 2);
      monitor.recordRestart('crash3', 3);

      expect(monitor.getRestartCount()).toBe(2);

      const lastRestart = monitor.getLastRestart();
      expect(lastRestart?.reason).toBe('crash3');
    });

    it('should track watchdog restarts', () => {
      healthMonitor.recordRestart('watchdog', undefined, true);

      expect(healthMonitor.hasWatchdogRestarts()).toBe(true);
    });
  });

  describe('performHealthCheck', () => {
    it('should increment passed counter on successful check', () => {
      healthMonitor.performHealthCheck(true);

      const report = healthMonitor.getHealthReport();
      expect(report.healthChecksPassed).toBe(1);
      expect(report.healthChecksFailed).toBe(0);
    });

    it('should increment failed counter on failed check', () => {
      healthMonitor.performHealthCheck(false);

      const report = healthMonitor.getHealthReport();
      expect(report.healthChecksPassed).toBe(0);
      expect(report.healthChecksFailed).toBe(1);
    });

    it('should update last health check timestamp', () => {
      const beforeCheck = Date.now();
      healthMonitor.performHealthCheck(true);
      const afterCheck = Date.now();

      const report = healthMonitor.getHealthReport();
      const checkTime = report.lastHealthCheck.getTime();

      expect(checkTime).toBeGreaterThanOrEqual(beforeCheck);
      expect(checkTime).toBeLessThanOrEqual(afterCheck);
    });
  });

  describe('getHealthReport', () => {
    it('should return basic health report without daemon runner', () => {
      const report = healthMonitor.getHealthReport();

      expect(report).toHaveProperty('uptime');
      expect(report).toHaveProperty('memoryUsage');
      expect(report).toHaveProperty('taskCounts');
      expect(report).toHaveProperty('lastHealthCheck');
      expect(report).toHaveProperty('healthChecksPassed');
      expect(report).toHaveProperty('healthChecksFailed');
      expect(report).toHaveProperty('restartHistory');

      expect(report.taskCounts).toEqual({
        processed: 0,
        succeeded: 0,
        failed: 0,
        active: 0,
      });
    });

    it('should integrate with daemon runner metrics', () => {
      const report = healthMonitor.getHealthReport(mockDaemonRunner);

      expect(report.taskCounts).toEqual({
        processed: 10,
        succeeded: 8,
        failed: 2,
        active: 1,
      });
    });

    it('should include memory usage from process.memoryUsage()', () => {
      const report = healthMonitor.getHealthReport();

      expect(report.memoryUsage).toEqual({
        heapUsed: 52428800,
        heapTotal: 104857600,
        rss: 157286400,
      });
    });

    it('should include restart history', () => {
      healthMonitor.recordRestart('crash', 1);
      healthMonitor.recordRestart('oom', 2);

      const report = healthMonitor.getHealthReport();

      expect(report.restartHistory).toHaveLength(2);
      expect(report.restartHistory[0].reason).toBe('oom'); // Most recent first
      expect(report.restartHistory[1].reason).toBe('crash');
    });

    it('should return copy of restart history to prevent mutation', () => {
      healthMonitor.recordRestart('crash', 1);

      const report = healthMonitor.getHealthReport();
      report.restartHistory.push({
        timestamp: new Date(),
        reason: 'manual',
        triggeredByWatchdog: false,
      });

      const newReport = healthMonitor.getHealthReport();
      expect(newReport.restartHistory).toHaveLength(1);
    });
  });

  describe('utility methods', () => {
    it('should reset health check counters', () => {
      healthMonitor.performHealthCheck(true);
      healthMonitor.performHealthCheck(false);

      expect(healthMonitor.getHealthReport().healthChecksPassed).toBe(1);
      expect(healthMonitor.getHealthReport().healthChecksFailed).toBe(1);

      healthMonitor.resetHealthCheckCounters();

      expect(healthMonitor.getHealthReport().healthChecksPassed).toBe(0);
      expect(healthMonitor.getHealthReport().healthChecksFailed).toBe(0);
    });

    it('should clear restart history', () => {
      healthMonitor.recordRestart('crash', 1);
      healthMonitor.recordRestart('oom', 2);

      expect(healthMonitor.getRestartCount()).toBe(2);

      healthMonitor.clearRestartHistory();

      expect(healthMonitor.getRestartCount()).toBe(0);
      expect(healthMonitor.getLastRestart()).toBeUndefined();
    });

    it('should calculate uptime correctly', () => {
      const startTime = Date.now();
      vi.advanceTimersByTime(5000); // 5 seconds

      const uptime = healthMonitor.getUptime();
      expect(uptime).toBeGreaterThanOrEqual(5000);
    });
  });

  describe('watchdog detection', () => {
    it('should detect no watchdog restarts initially', () => {
      expect(healthMonitor.hasWatchdogRestarts()).toBe(false);
    });

    it('should detect watchdog restarts when present', () => {
      healthMonitor.recordRestart('crash', 1, false);
      healthMonitor.recordRestart('watchdog', undefined, true);

      expect(healthMonitor.hasWatchdogRestarts()).toBe(true);
    });

    it('should not detect watchdog restarts when only manual restarts', () => {
      healthMonitor.recordRestart('manual', undefined, false);
      healthMonitor.recordRestart('crash', 1, false);

      expect(healthMonitor.hasWatchdogRestarts()).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle zero maxRestartHistorySize', () => {
      const monitor = new HealthMonitor({ maxRestartHistorySize: 0 });
      monitor.recordRestart('test');

      expect(monitor.getRestartCount()).toBe(0);
    });

    it('should handle negative maxRestartHistorySize gracefully', () => {
      const monitor = new HealthMonitor({ maxRestartHistorySize: -1 });
      monitor.recordRestart('test');

      expect(monitor.getRestartCount()).toBe(0);
    });

    it('should handle missing exit code', () => {
      healthMonitor.recordRestart('crash');

      const lastRestart = healthMonitor.getLastRestart();
      expect(lastRestart?.exitCode).toBeUndefined();
    });

    it('should handle DaemonRunner throwing error', () => {
      const errorRunner = {
        getMetrics: vi.fn().mockImplementation(() => {
          throw new Error('Metrics unavailable');
        }),
      } as any;

      expect(() => {
        healthMonitor.getHealthReport(errorRunner);
      }).toThrow('Metrics unavailable');
    });

    it('should handle process.memoryUsage throwing error', () => {
      vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
        throw new Error('Memory unavailable');
      });

      expect(() => {
        healthMonitor.getHealthReport();
      }).toThrow('Memory unavailable');
    });

    it('should handle rapid consecutive operations', () => {
      for (let i = 0; i < 100; i++) {
        healthMonitor.performHealthCheck(i % 2 === 0);
        healthMonitor.recordRestart(`restart-${i}`);
      }

      const report = healthMonitor.getHealthReport();
      expect(report.healthChecksPassed).toBe(50);
      expect(report.healthChecksFailed).toBe(50);
      expect(report.restartHistory).toHaveLength(10); // Limited by default maxRestartHistorySize
    });

    it('should handle empty restart reason', () => {
      healthMonitor.recordRestart('');

      const lastRestart = healthMonitor.getLastRestart();
      expect(lastRestart?.reason).toBe('');
    });

    it('should handle special characters in restart reason', () => {
      const specialReason = 'restart with 特殊字符 and emojis 🚀💥';
      healthMonitor.recordRestart(specialReason);

      const lastRestart = healthMonitor.getLastRestart();
      expect(lastRestart?.reason).toBe(specialReason);
    });
  });

  describe('integration and realistic scenarios', () => {
    it('should work in a complete daemon monitoring scenario', () => {
      const monitor = new HealthMonitor({ maxRestartHistorySize: 5 });

      // Initial health check
      monitor.performHealthCheck(true);

      // Simulate daemon processing tasks
      const mockMetrics: DaemonMetrics = {
        startedAt: new Date('2023-01-01T00:00:00Z'),
        uptime: 3600000, // 1 hour
        tasksProcessed: 50,
        tasksSucceeded: 45,
        tasksFailed: 5,
        activeTaskCount: 2,
        isRunning: true,
      };

      vi.mocked(mockDaemonRunner.getMetrics).mockReturnValue(mockMetrics);

      // Simulate a crash and restart
      monitor.recordRestart('oom', 9, true);

      // Health check after restart
      monitor.performHealthCheck(true);

      const report = monitor.getHealthReport(mockDaemonRunner);

      // Verify comprehensive health report
      expect(report.taskCounts.processed).toBe(50);
      expect(report.taskCounts.succeeded).toBe(45);
      expect(report.taskCounts.failed).toBe(5);
      expect(report.taskCounts.active).toBe(2);
      expect(report.healthChecksPassed).toBe(2);
      expect(report.healthChecksFailed).toBe(0);
      expect(report.restartHistory).toHaveLength(1);
      expect(report.restartHistory[0].reason).toBe('oom');
      expect(report.restartHistory[0].triggeredByWatchdog).toBe(true);
      expect(report.memoryUsage.heapUsed).toBe(52428800);
      expect(monitor.hasWatchdogRestarts()).toBe(true);
    });

    it('should handle multiple restart types correctly', () => {
      const monitor = new HealthMonitor({ maxRestartHistorySize: 10 });

      // Add various restart types
      monitor.recordRestart('manual', 0, false);
      monitor.recordRestart('crash', 1, false);
      monitor.recordRestart('oom', 9, true);
      monitor.recordRestart('watchdog', undefined, true);
      monitor.recordRestart('signal', 15, false);

      const report = monitor.getHealthReport();

      expect(report.restartHistory).toHaveLength(5);
      expect(monitor.hasWatchdogRestarts()).toBe(true);

      // Check restart order (most recent first)
      const reasons = report.restartHistory.map(r => r.reason);
      expect(reasons).toEqual(['signal', 'watchdog', 'oom', 'crash', 'manual']);
    });

    it('should maintain performance with large restart history', () => {
      const monitor = new HealthMonitor({ maxRestartHistorySize: 1000 });

      const startTime = Date.now();

      // Add many restarts
      for (let i = 0; i < 1500; i++) {
        monitor.recordRestart(`restart-${i}`, i % 10, i % 3 === 0);
      }

      const endTime = Date.now();

      // Should complete quickly and limit history size
      expect(endTime - startTime).toBeLessThan(100);
      expect(monitor.getRestartCount()).toBe(1000);

      // Should still detect watchdog restarts efficiently
      expect(monitor.hasWatchdogRestarts()).toBe(true);
    });

    it('should handle concurrent operations gracefully', () => {
      const monitor = new HealthMonitor();

      // Simulate concurrent health checks and restart recording
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(Promise.resolve().then(() => {
          monitor.performHealthCheck(Math.random() > 0.5);
          if (i % 10 === 0) {
            monitor.recordRestart(`concurrent-${i}`);
          }
        }));
      }

      return Promise.all(promises).then(() => {
        const report = monitor.getHealthReport();

        expect(report.healthChecksPassed + report.healthChecksFailed).toBe(100);
        expect(monitor.getRestartCount()).toBe(10);
      });
    });

    it('should provide accurate uptime calculations', () => {
      const monitor = new HealthMonitor();

      // Advance time
      vi.advanceTimersByTime(5000);

      expect(monitor.getUptime()).toBeGreaterThanOrEqual(5000);

      const report = monitor.getHealthReport();
      expect(report.uptime).toBeGreaterThanOrEqual(5000);
    });
  });

  describe('data immutability and thread safety', () => {
    it('should return independent copies of restart history', () => {
      healthMonitor.recordRestart('original');

      const report1 = healthMonitor.getHealthReport();
      const report2 = healthMonitor.getHealthReport();

      // Modify first report
      report1.restartHistory[0].reason = 'modified';

      // Second report should be unchanged
      expect(report2.restartHistory[0].reason).toBe('original');
    });

    it('should not allow external modification of internal state', () => {
      healthMonitor.recordRestart('test');

      const report = healthMonitor.getHealthReport();

      // Try to modify the returned array
      report.restartHistory.push({
        timestamp: new Date(),
        reason: 'injected',
        triggeredByWatchdog: false,
      });

      // Internal state should remain unchanged
      expect(healthMonitor.getRestartCount()).toBe(1);
      expect(healthMonitor.getLastRestart()?.reason).toBe('test');
    });

    it('should maintain data consistency during reset operations', () => {
      healthMonitor.performHealthCheck(true);
      healthMonitor.performHealthCheck(false);
      healthMonitor.recordRestart('test-restart');

      // Get initial state
      const beforeReset = healthMonitor.getHealthReport();
      expect(beforeReset.healthChecksPassed).toBe(1);
      expect(beforeReset.healthChecksFailed).toBe(1);

      // Reset only health checks
      healthMonitor.resetHealthCheckCounters();

      const afterHealthReset = healthMonitor.getHealthReport();
      expect(afterHealthReset.healthChecksPassed).toBe(0);
      expect(afterHealthReset.healthChecksFailed).toBe(0);
      expect(afterHealthReset.restartHistory).toHaveLength(1); // Should remain

      // Reset only restart history
      healthMonitor.clearRestartHistory();

      const afterRestartReset = healthMonitor.getHealthReport();
      expect(afterRestartReset.healthChecksPassed).toBe(0);
      expect(afterRestartReset.healthChecksFailed).toBe(0);
      expect(afterRestartReset.restartHistory).toHaveLength(0);
    });
  });
});