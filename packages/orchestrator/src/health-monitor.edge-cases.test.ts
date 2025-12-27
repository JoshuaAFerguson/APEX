import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthMonitor } from './health-monitor';
import type { DaemonRunner, DaemonMetrics } from './runner';

describe('HealthMonitor Edge Cases', () => {
  let healthMonitor: HealthMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    healthMonitor = new HealthMonitor();

    // Mock process.memoryUsage for consistent results
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: 50 * 1024 * 1024,
      heapTotal: 100 * 1024 * 1024,
      rss: 150 * 1024 * 1024,
      external: 5 * 1024 * 1024,
      arrayBuffers: 2 * 1024 * 1024,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Boundary conditions', () => {
    it('should handle maximum safe integer values', () => {
      const maxSafeInt = Number.MAX_SAFE_INTEGER;

      // Mock memory usage with very large values
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: maxSafeInt,
        heapTotal: maxSafeInt,
        rss: maxSafeInt,
        external: maxSafeInt,
        arrayBuffers: maxSafeInt,
      });

      const report = healthMonitor.getHealthReport();

      expect(report.memoryUsage.heapUsed).toBe(maxSafeInt);
      expect(report.memoryUsage.heapTotal).toBe(maxSafeInt);
      expect(report.memoryUsage.rss).toBe(maxSafeInt);
    });

    it('should handle very small maxRestartHistorySize values', () => {
      const monitor = new HealthMonitor({ maxRestartHistorySize: 1 });

      monitor.recordRestart('first', 1);
      monitor.recordRestart('second', 2);
      monitor.recordRestart('third', 3);

      expect(monitor.getRestartCount()).toBe(1);
      expect(monitor.getLastRestart()?.reason).toBe('third');
    });

    it('should handle extremely long restart reasons', () => {
      const longReason = 'restart-' + 'x'.repeat(10000);
      healthMonitor.recordRestart(longReason, 1);

      const lastRestart = healthMonitor.getLastRestart();
      expect(lastRestart?.reason).toBe(longReason);
      expect(lastRestart?.reason.length).toBe(10008);
    });

    it('should handle very large exit codes', () => {
      const largeExitCode = 999999;
      healthMonitor.recordRestart('test', largeExitCode);

      const lastRestart = healthMonitor.getLastRestart();
      expect(lastRestart?.exitCode).toBe(largeExitCode);
    });

    it('should handle negative exit codes', () => {
      const negativeExitCode = -1;
      healthMonitor.recordRestart('test', negativeExitCode);

      const lastRestart = healthMonitor.getLastRestart();
      expect(lastRestart?.exitCode).toBe(negativeExitCode);
    });
  });

  describe('Time-related edge cases', () => {
    it('should handle date changes correctly', () => {
      const initialTime = new Date('2023-01-01T00:00:00Z').getTime();
      vi.setSystemTime(initialTime);

      const monitor = new HealthMonitor();
      monitor.performHealthCheck(true);

      // Jump to next year
      const nextYear = new Date('2024-01-01T00:00:00Z').getTime();
      vi.setSystemTime(nextYear);

      const report = monitor.getHealthReport();

      expect(report.uptime).toBe(nextYear - initialTime);
      expect(monitor.getUptime()).toBe(nextYear - initialTime);
    });

    it('should handle very rapid timestamp changes', () => {
      const monitor = new HealthMonitor();

      // Record multiple restarts with rapidly changing timestamps
      const baseTime = Date.now();
      for (let i = 0; i < 10; i++) {
        vi.setSystemTime(baseTime + i);
        monitor.recordRestart(`rapid-${i}`, i);
      }

      const report = monitor.getHealthReport();
      expect(report.restartHistory).toHaveLength(10);

      // Verify timestamps are in correct order (most recent first)
      for (let i = 0; i < 9; i++) {
        expect(report.restartHistory[i].timestamp.getTime())
          .toBeGreaterThan(report.restartHistory[i + 1].timestamp.getTime());
      }
    });

    it('should handle clock going backwards gracefully', () => {
      const monitor = new HealthMonitor();

      // Start at some time
      const startTime = 1000000;
      vi.setSystemTime(startTime);
      monitor.performHealthCheck(true);

      // Move time backwards (system clock adjustment)
      const backwardsTime = 500000;
      vi.setSystemTime(backwardsTime);

      // Should handle negative uptime gracefully
      const uptime = monitor.getUptime();
      expect(uptime).toBe(backwardsTime - startTime); // Negative value
    });
  });

  describe('Data corruption scenarios', () => {
    it('should handle memory usage returning undefined values', () => {
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: undefined as any,
        heapTotal: undefined as any,
        rss: undefined as any,
        external: undefined as any,
        arrayBuffers: undefined as any,
      });

      const report = healthMonitor.getHealthReport();

      expect(report.memoryUsage.heapUsed).toBeUndefined();
      expect(report.memoryUsage.heapTotal).toBeUndefined();
      expect(report.memoryUsage.rss).toBeUndefined();
    });

    it('should handle memory usage returning NaN values', () => {
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: NaN,
        heapTotal: NaN,
        rss: NaN,
        external: NaN,
        arrayBuffers: NaN,
      });

      const report = healthMonitor.getHealthReport();

      expect(report.memoryUsage.heapUsed).toBeNaN();
      expect(report.memoryUsage.heapTotal).toBeNaN();
      expect(report.memoryUsage.rss).toBeNaN();
    });

    it('should handle daemon metrics with missing required fields', () => {
      const brokenDaemonRunner = {
        getMetrics: vi.fn().mockReturnValue({
          // Missing required fields
          tasksProcessed: undefined,
          tasksSucceeded: null,
          tasksFailed: NaN,
          activeTaskCount: 'invalid' as any,
          isRunning: true,
        }),
      } as any;

      const report = healthMonitor.getHealthReport(brokenDaemonRunner);

      expect(report.taskCounts.processed).toBeUndefined();
      expect(report.taskCounts.succeeded).toBeNull();
      expect(report.taskCounts.failed).toBeNaN();
      expect(report.taskCounts.active).toBe('invalid');
    });
  });

  describe('Memory and resource stress scenarios', () => {
    it('should handle operations when system is out of memory', () => {
      // Mock memory usage to simulate OOM condition
      vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
        throw new Error('Cannot allocate memory');
      });

      expect(() => {
        healthMonitor.getHealthReport();
      }).toThrow('Cannot allocate memory');
    });

    it('should handle very frequent operations without memory leaks', () => {
      const monitor = new HealthMonitor({ maxRestartHistorySize: 5 });

      // Perform operations that could potentially leak memory
      const iterations = 10000;
      for (let i = 0; i < iterations; i++) {
        // Create temporary objects that should be garbage collected
        const tempReasons = [`temp-${i}`, `another-${i}`, `third-${i}`];
        monitor.recordRestart(tempReasons[i % 3], i, i % 2 === 0);

        if (i % 100 === 0) {
          // Force garbage collection points
          const report = monitor.getHealthReport();
          expect(report).toBeDefined();
        }
      }

      // Verify memory usage is bounded
      expect(monitor.getRestartCount()).toBe(5);
      expect(monitor.getLastRestart()?.reason).toBe('third-9999');
    });

    it('should handle string interning edge cases', () => {
      const monitor = new HealthMonitor({ maxRestartHistorySize: 100 });

      // Add many restarts with similar but different reasons
      for (let i = 0; i < 500; i++) {
        // Each reason is slightly different to prevent string interning
        const reason = `restart-reason-number-${i}-with-suffix`;
        monitor.recordRestart(reason, i % 256, false);
      }

      expect(monitor.getRestartCount()).toBe(100);

      // Verify unique reasons are preserved
      const report = monitor.getHealthReport();
      const reasons = report.restartHistory.map(r => r.reason);
      const uniqueReasons = new Set(reasons);
      expect(uniqueReasons.size).toBe(100); // All should be unique
    });
  });

  describe('Unicode and special character handling', () => {
    it('should handle unicode restart reasons correctly', () => {
      const unicodeReasons = [
        '重启-测试', // Chinese
        'перезагрузка-тест', // Russian
        'إعادة-تشغيل-اختبار', // Arabic
        'リスタート-テスト', // Japanese
        '🚀💥🔄 emoji restart',
        'mixed 中文 English русский',
      ];

      unicodeReasons.forEach((reason, i) => {
        healthMonitor.recordRestart(reason, i);
      });

      const report = healthMonitor.getHealthReport();
      expect(report.restartHistory).toHaveLength(unicodeReasons.length);

      // Verify all unicode reasons are preserved correctly
      const retrievedReasons = report.restartHistory.map(r => r.reason).reverse();
      expect(retrievedReasons).toEqual(unicodeReasons);
    });

    it('should handle control characters in restart reasons', () => {
      const controlCharReason = 'restart\n\r\t\0with\x01controls';
      healthMonitor.recordRestart(controlCharReason, 1);

      const lastRestart = healthMonitor.getLastRestart();
      expect(lastRestart?.reason).toBe(controlCharReason);
    });

    it('should handle extremely long unicode strings', () => {
      const longUnicodeReason = '🎯'.repeat(1000) + '测试'.repeat(500) + '🚀'.repeat(1000);
      healthMonitor.recordRestart(longUnicodeReason, 1);

      const lastRestart = healthMonitor.getLastRestart();
      expect(lastRestart?.reason).toBe(longUnicodeReason);
      expect(lastRestart?.reason.length).toBe(3000);
    });
  });

  describe('Concurrency and race conditions', () => {
    it('should handle rapid alternating operations', () => {
      const monitor = new HealthMonitor({ maxRestartHistorySize: 1000 });

      // Alternate between different types of operations very rapidly
      for (let i = 0; i < 1000; i++) {
        if (i % 4 === 0) {
          monitor.performHealthCheck(true);
        } else if (i % 4 === 1) {
          monitor.performHealthCheck(false);
        } else if (i % 4 === 2) {
          monitor.recordRestart(`rapid-${i}`, i % 10, i % 3 === 0);
        } else {
          const report = monitor.getHealthReport();
          expect(report).toBeDefined();
        }
      }

      const finalReport = monitor.getHealthReport();
      expect(finalReport.healthChecksPassed).toBe(250); // Every 4th starting at 0
      expect(finalReport.healthChecksFailed).toBe(250); // Every 4th starting at 1
    });

    it('should maintain consistency during mixed operations', () => {
      const monitor = new HealthMonitor({ maxRestartHistorySize: 10 });

      // Mix different operations in a specific pattern
      const operations = [
        () => monitor.performHealthCheck(true),
        () => monitor.recordRestart('mixed-1', 1, false),
        () => monitor.getHealthReport(),
        () => monitor.performHealthCheck(false),
        () => monitor.recordRestart('mixed-2', 2, true),
        () => monitor.hasWatchdogRestarts(),
        () => monitor.getUptime(),
        () => monitor.resetHealthCheckCounters(),
        () => monitor.clearRestartHistory(),
      ];

      // Execute operations in various orders
      for (let round = 0; round < 100; round++) {
        const shuffled = [...operations].sort(() => Math.random() - 0.5);
        shuffled.forEach(op => op());
      }

      // State should be consistent after all operations
      const finalReport = monitor.getHealthReport();
      expect(finalReport).toBeDefined();
      expect(typeof finalReport.uptime).toBe('number');
      expect(Array.isArray(finalReport.restartHistory)).toBe(true);
    });
  });

  describe('Error propagation and recovery', () => {
    it('should propagate errors from process.memoryUsage appropriately', () => {
      const customError = new Error('Custom memory error');
      vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
        throw customError;
      });

      expect(() => {
        healthMonitor.getHealthReport();
      }).toThrow(customError);
    });

    it('should propagate errors from DaemonRunner.getMetrics appropriately', () => {
      const customError = new Error('Custom daemon error');
      const errorRunner = {
        getMetrics: vi.fn().mockImplementation(() => {
          throw customError;
        }),
      } as any;

      expect(() => {
        healthMonitor.getHealthReport(errorRunner);
      }).toThrow(customError);
    });

    it('should handle recovery after errors', () => {
      // Start with working conditions
      healthMonitor.performHealthCheck(true);
      healthMonitor.recordRestart('before-error', 0);

      // Cause an error
      vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
        throw new Error('Temporary error');
      });

      expect(() => {
        healthMonitor.getHealthReport();
      }).toThrow('Temporary error');

      // Restore normal conditions
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 50 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        rss: 150 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
      });

      // Should work normally again
      healthMonitor.performHealthCheck(true);
      const report = healthMonitor.getHealthReport();

      expect(report.healthChecksPassed).toBe(2);
      expect(report.restartHistory).toHaveLength(1);
      expect(report.restartHistory[0].reason).toBe('before-error');
    });
  });
});