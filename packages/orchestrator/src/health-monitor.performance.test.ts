import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthMonitor } from './health-monitor';
import type { DaemonRunner, DaemonMetrics } from './runner';

describe('HealthMonitor Performance Tests', () => {
  let healthMonitor: HealthMonitor;
  let mockDaemonRunner: DaemonRunner;

  beforeEach(() => {
    vi.useFakeTimers();

    healthMonitor = new HealthMonitor({ maxRestartHistorySize: 1000 });

    // Mock DaemonRunner for performance tests
    mockDaemonRunner = {
      getMetrics: vi.fn().mockReturnValue({
        startedAt: new Date('2023-01-01T00:00:00Z'),
        uptime: 1000,
        tasksProcessed: 100,
        tasksSucceeded: 90,
        tasksFailed: 10,
        activeTaskCount: 5,
        isRunning: true,
      } as DaemonMetrics),
    } as any;

    // Mock process.memoryUsage for performance tests
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: 100 * 1024 * 1024,
      heapTotal: 200 * 1024 * 1024,
      rss: 300 * 1024 * 1024,
      external: 10 * 1024 * 1024,
      arrayBuffers: 5 * 1024 * 1024,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('High Volume Operations', () => {
    it('should handle thousands of health checks efficiently', () => {
      const startTime = Date.now();

      // Perform many health checks
      for (let i = 0; i < 10000; i++) {
        healthMonitor.performHealthCheck(i % 2 === 0);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(100); // 100ms for 10k operations

      const report = healthMonitor.getHealthReport();
      expect(report.healthChecksPassed).toBe(5000);
      expect(report.healthChecksFailed).toBe(5000);
    });

    it('should handle thousands of restart records efficiently', () => {
      const startTime = Date.now();

      // Add many restart records (will be limited by maxRestartHistorySize)
      for (let i = 0; i < 5000; i++) {
        healthMonitor.recordRestart(`restart-${i}`, i % 10, i % 3 === 0);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(50); // 50ms for 5k operations

      // Should be limited to maxRestartHistorySize
      expect(healthMonitor.getRestartCount()).toBe(1000);

      // Most recent should be the last added
      const lastRestart = healthMonitor.getLastRestart();
      expect(lastRestart?.reason).toBe('restart-4999');
    });

    it('should generate health reports quickly under load', () => {
      // Setup some data
      for (let i = 0; i < 1000; i++) {
        healthMonitor.performHealthCheck(i % 3 !== 0);
        if (i % 10 === 0) {
          healthMonitor.recordRestart(`load-${i}`, i, i % 2 === 0);
        }
      }

      const startTime = Date.now();

      // Generate many reports
      const reports = [];
      for (let i = 0; i < 1000; i++) {
        reports.push(healthMonitor.getHealthReport(mockDaemonRunner));
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(200); // 200ms for 1k reports

      // All reports should be complete and identical
      expect(reports).toHaveLength(1000);
      reports.forEach(report => {
        expect(report.healthChecksPassed).toBe(667); // ~2/3 of 1000
        expect(report.healthChecksFailed).toBe(333); // ~1/3 of 1000
      });
    });
  });

  describe('Memory Usage and Efficiency', () => {
    it('should maintain bounded memory usage with restart history limit', () => {
      const monitor = new HealthMonitor({ maxRestartHistorySize: 100 });

      // Add many more restarts than the limit
      for (let i = 0; i < 1000; i++) {
        monitor.recordRestart(`restart-${i}`, i, i % 2 === 0);
      }

      // Memory usage should be bounded
      expect(monitor.getRestartCount()).toBe(100);

      // Should maintain performance
      const startTime = Date.now();
      const report = monitor.getHealthReport();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5);
      expect(report.restartHistory).toHaveLength(100);
    });

    it('should handle zero restart history size efficiently', () => {
      const monitor = new HealthMonitor({ maxRestartHistorySize: 0 });

      const startTime = Date.now();

      // Add many restarts (should all be discarded)
      for (let i = 0; i < 1000; i++) {
        monitor.recordRestart(`restart-${i}`, i, false);
      }

      const endTime = Date.now();

      // Should be very fast since no history is kept
      expect(endTime - startTime).toBeLessThan(10);
      expect(monitor.getRestartCount()).toBe(0);
    });

    it('should efficiently copy restart history for immutability', () => {
      // Fill with maximum history
      for (let i = 0; i < 1000; i++) {
        healthMonitor.recordRestart(`restart-${i}`, i, i % 4 === 0);
      }

      const startTime = Date.now();

      // Get multiple reports (should copy history each time)
      const reports = [];
      for (let i = 0; i < 100; i++) {
        reports.push(healthMonitor.getHealthReport());
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time despite copying
      expect(duration).toBeLessThan(50);

      // Verify immutability
      reports[0].restartHistory[0].reason = 'modified';
      expect(reports[1].restartHistory[0].reason).toBe('restart-999');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent health checks and restarts', () => {
      const promises = [];

      // Simulate concurrent operations
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            // Mix of health checks and restarts
            healthMonitor.performHealthCheck(Math.random() > 0.3);

            if (i % 10 === 0) {
              healthMonitor.recordRestart(`concurrent-${i}`, i, i % 2 === 0);
            }

            return healthMonitor.getHealthReport(mockDaemonRunner);
          })
        );
      }

      const startTime = Date.now();

      return Promise.all(promises).then((reports) => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should handle concurrent operations efficiently
        expect(duration).toBeLessThan(100);
        expect(reports).toHaveLength(100);

        // State should be consistent
        const finalReport = healthMonitor.getHealthReport(mockDaemonRunner);
        expect(finalReport.healthChecksPassed + finalReport.healthChecksFailed).toBe(100);
      });
    });

    it('should maintain performance under rapid state changes', () => {
      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        // Rapid sequence of operations
        healthMonitor.performHealthCheck(true);
        healthMonitor.performHealthCheck(false);

        if (i % 50 === 0) {
          healthMonitor.recordRestart(`rapid-${i}`, 0, false);
        }

        if (i % 100 === 0) {
          const report = healthMonitor.getHealthReport(mockDaemonRunner);
          expect(report).toBeDefined();
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle rapid changes efficiently
      expect(duration).toBeLessThan(100);

      const finalReport = healthMonitor.getHealthReport(mockDaemonRunner);
      expect(finalReport.healthChecksPassed).toBe(iterations);
      expect(finalReport.healthChecksFailed).toBe(iterations);
    });
  });

  describe('Large Scale Monitoring Scenarios', () => {
    it('should handle extended monitoring periods efficiently', () => {
      const monitor = new HealthMonitor({ maxRestartHistorySize: 50 });

      // Simulate 24 hours of monitoring (health check every minute)
      const minutesInDay = 24 * 60;
      const startTime = Date.now();

      for (let minute = 0; minute < minutesInDay; minute++) {
        // Most health checks succeed
        const success = Math.random() > 0.05; // 95% success rate
        monitor.performHealthCheck(success);

        // Occasional restarts (once per hour on average)
        if (minute % 60 === 0 && Math.random() > 0.5) {
          monitor.recordRestart(`scheduled-${minute}`, 0, false);
        }

        // Rare watchdog restarts
        if (Math.random() > 0.998) {
          monitor.recordRestart(`watchdog-${minute}`, 9, true);
        }

        // Advance time
        vi.advanceTimersByTime(60000); // 1 minute
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle extended period efficiently
      expect(duration).toBeLessThan(500);

      const report = monitor.getHealthReport();
      expect(report.healthChecksPassed + report.healthChecksFailed).toBe(minutesInDay);
      expect(report.uptime).toBe(minutesInDay * 60000); // 24 hours in ms
      expect(monitor.getRestartCount()).toBeLessThanOrEqual(50); // Limited by maxRestartHistorySize
    });

    it('should efficiently track high-frequency daemon metrics', () => {
      // Mock high-frequency metrics updates
      let metricsCallCount = 0;
      vi.mocked(mockDaemonRunner.getMetrics).mockImplementation(() => {
        metricsCallCount++;
        return {
          startedAt: new Date('2023-01-01T00:00:00Z'),
          uptime: metricsCallCount * 1000,
          tasksProcessed: metricsCallCount * 2,
          tasksSucceeded: Math.floor(metricsCallCount * 1.8),
          tasksFailed: Math.floor(metricsCallCount * 0.2),
          activeTaskCount: Math.min(metricsCallCount, 10),
          isRunning: true,
        } as DaemonMetrics;
      });

      const startTime = Date.now();

      // Generate many health reports (simulating high-frequency monitoring)
      for (let i = 0; i < 1000; i++) {
        const report = healthMonitor.getHealthReport(mockDaemonRunner);
        expect(report.taskCounts.processed).toBe(i * 2 + 2);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle high-frequency metrics efficiently
      expect(duration).toBeLessThan(100);
      expect(metricsCallCount).toBe(1000);
    });

    it('should maintain performance with large memory usage values', () => {
      // Mock large memory usage values
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 2 * 1024 * 1024 * 1024, // 2GB
        heapTotal: 4 * 1024 * 1024 * 1024, // 4GB
        rss: 8 * 1024 * 1024 * 1024, // 8GB
        external: 500 * 1024 * 1024, // 500MB
        arrayBuffers: 100 * 1024 * 1024, // 100MB
      });

      const startTime = Date.now();

      // Generate reports with large memory values
      const reports = [];
      for (let i = 0; i < 100; i++) {
        reports.push(healthMonitor.getHealthReport(mockDaemonRunner));
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle large values efficiently
      expect(duration).toBeLessThan(20);

      // Verify large values are handled correctly
      reports.forEach(report => {
        expect(report.memoryUsage.heapUsed).toBe(2 * 1024 * 1024 * 1024);
        expect(report.memoryUsage.heapTotal).toBe(4 * 1024 * 1024 * 1024);
        expect(report.memoryUsage.rss).toBe(8 * 1024 * 1024 * 1024);
      });
    });
  });

  describe('Resource Management', () => {
    it('should clean up resources efficiently', () => {
      // Create monitor with data
      for (let i = 0; i < 500; i++) {
        healthMonitor.performHealthCheck(i % 2 === 0);
        healthMonitor.recordRestart(`cleanup-${i}`, i, i % 3 === 0);
      }

      const beforeCleanup = Date.now();

      // Clear all data
      healthMonitor.resetHealthCheckCounters();
      healthMonitor.clearRestartHistory();

      const afterCleanup = Date.now();

      // Cleanup should be immediate
      expect(afterCleanup - beforeCleanup).toBeLessThan(5);

      // State should be clean
      const report = healthMonitor.getHealthReport();
      expect(report.healthChecksPassed).toBe(0);
      expect(report.healthChecksFailed).toBe(0);
      expect(report.restartHistory).toHaveLength(0);
    });

    it('should handle utility method calls efficiently', () => {
      // Setup data
      for (let i = 0; i < 1000; i++) {
        healthMonitor.recordRestart(`util-${i}`, i, i % 4 === 0);
      }

      const startTime = Date.now();

      // Call utility methods many times
      for (let i = 0; i < 1000; i++) {
        expect(healthMonitor.getUptime()).toBeGreaterThanOrEqual(0);
        expect(healthMonitor.getRestartCount()).toBe(1000);
        expect(healthMonitor.hasWatchdogRestarts()).toBe(true);

        if (i % 100 === 0) {
          expect(healthMonitor.getLastRestart()?.reason).toBe('util-999');
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Utility methods should be very fast
      expect(duration).toBeLessThan(20);
    });
  });
});