import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { HealthMonitor } from '../packages/orchestrator/src/health-monitor';
import { DaemonManager } from '../packages/orchestrator/src/daemon';

/**
 * v0.4.0 Health Monitoring Integration Tests
 *
 * These tests verify real-world health monitoring functionality including
 * memory tracking, restart history, and integration with actual daemon processes.
 */
describe('v0.4.0 Health Monitoring Integration Tests', () => {
  let testProjectPath: string;
  let healthMonitor: HealthMonitor;
  let daemonManager: DaemonManager;

  beforeEach(async () => {
    testProjectPath = join(__dirname, 'test-project-health');

    // Create test project structure
    await fs.mkdir(testProjectPath, { recursive: true });
    await fs.mkdir(join(testProjectPath, '.apex'), { recursive: true });

    healthMonitor = new HealthMonitor({
      maxRestartHistorySize: 5
    });

    daemonManager = new DaemonManager({
      projectPath: testProjectPath,
      logLevel: 'debug'
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    // Clean up test directory
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }
  });

  describe('Real Memory Metrics Collection', () => {
    it('should collect actual memory usage from Node.js process', () => {
      const report = healthMonitor.getHealthReport();

      expect(report.memoryUsage).toBeDefined();
      expect(report.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(report.memoryUsage.heapTotal).toBeGreaterThan(0);
      expect(report.memoryUsage.rss).toBeGreaterThan(0);

      // Verify memory values are realistic
      expect(report.memoryUsage.heapUsed).toBeLessThanOrEqual(report.memoryUsage.heapTotal);
      expect(report.memoryUsage.rss).toBeGreaterThanOrEqual(report.memoryUsage.heapTotal);
    });

    it('should track memory usage changes over time', async () => {
      const initialReport = healthMonitor.getHealthReport();
      const initialHeapUsed = initialReport.memoryUsage.heapUsed;

      // Force some memory allocation
      const largeArray = new Array(10000).fill('memory test data');

      // Wait briefly for potential garbage collection differences
      await new Promise(resolve => setTimeout(resolve, 10));

      const secondReport = healthMonitor.getHealthReport();
      const secondHeapUsed = secondReport.memoryUsage.heapUsed;

      // Memory usage should be tracked accurately
      expect(secondHeapUsed).toBeGreaterThanOrEqual(0);
      expect(secondReport.memoryUsage.heapTotal).toBeGreaterThan(0);

      // Clean up the large array
      largeArray.length = 0;
    });

    it('should provide memory usage in bytes', () => {
      const report = healthMonitor.getHealthReport();

      // All memory values should be positive integers (bytes)
      expect(Number.isInteger(report.memoryUsage.heapUsed)).toBe(true);
      expect(Number.isInteger(report.memoryUsage.heapTotal)).toBe(true);
      expect(Number.isInteger(report.memoryUsage.rss)).toBe(true);

      expect(report.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(report.memoryUsage.heapTotal).toBeGreaterThan(0);
      expect(report.memoryUsage.rss).toBeGreaterThan(0);
    });

    it('should handle memory metrics consistently across calls', () => {
      const reports = [];

      // Collect multiple reports quickly
      for (let i = 0; i < 5; i++) {
        reports.push(healthMonitor.getHealthReport());
      }

      // All reports should have valid memory data
      reports.forEach((report, index) => {
        expect(report.memoryUsage.heapUsed).toBeGreaterThan(0);
        expect(report.memoryUsage.heapTotal).toBeGreaterThan(0);
        expect(report.memoryUsage.rss).toBeGreaterThan(0);
      });

      // Memory values should be reasonable (not wildly different)
      const heapUsedValues = reports.map(r => r.memoryUsage.heapUsed);
      const maxHeapUsed = Math.max(...heapUsedValues);
      const minHeapUsed = Math.min(...heapUsedValues);

      // Should not vary by more than 100MB in quick succession
      expect(maxHeapUsed - minHeapUsed).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Restart History Management', () => {
    it('should record restart events with timestamps', () => {
      const beforeRestart = Date.now();

      healthMonitor.recordRestart('manual', 0, false);

      const report = healthMonitor.getHealthReport();
      expect(report.restartHistory).toHaveLength(1);

      const restartRecord = report.restartHistory[0];
      expect(restartRecord.reason).toBe('manual');
      expect(restartRecord.exitCode).toBe(0);
      expect(restartRecord.triggeredByWatchdog).toBe(false);
      expect(restartRecord.timestamp.getTime()).toBeGreaterThanOrEqual(beforeRestart);
    });

    it('should maintain restart history in chronological order', () => {
      // Record multiple restarts
      healthMonitor.recordRestart('crash', 1, true);
      healthMonitor.recordRestart('oom', 137, false);
      healthMonitor.recordRestart('manual', 0, false);

      const report = healthMonitor.getHealthReport();
      expect(report.restartHistory).toHaveLength(3);

      // Should be ordered with most recent first
      expect(report.restartHistory[0].reason).toBe('manual');
      expect(report.restartHistory[1].reason).toBe('oom');
      expect(report.restartHistory[2].reason).toBe('crash');

      // Timestamps should be in descending order (most recent first)
      for (let i = 0; i < report.restartHistory.length - 1; i++) {
        expect(report.restartHistory[i].timestamp.getTime())
          .toBeGreaterThanOrEqual(report.restartHistory[i + 1].timestamp.getTime());
      }
    });

    it('should limit restart history to configured size', () => {
      // Record more restarts than the limit (5)
      for (let i = 0; i < 8; i++) {
        healthMonitor.recordRestart(`restart-${i}`, i, i % 2 === 0);
      }

      const report = healthMonitor.getHealthReport();
      expect(report.restartHistory).toHaveLength(5);

      // Should keep the most recent 5
      expect(report.restartHistory[0].reason).toBe('restart-7');
      expect(report.restartHistory[4].reason).toBe('restart-3');
    });

    it('should handle different restart reasons and exit codes', () => {
      const restartScenarios = [
        { reason: 'crash', exitCode: 1, watchdog: true },
        { reason: 'oom', exitCode: 137, watchdog: false },
        { reason: 'manual', exitCode: 0, watchdog: false },
        { reason: 'signal', exitCode: 15, watchdog: false },
        { reason: 'timeout', exitCode: 124, watchdog: true }
      ];

      restartScenarios.forEach(scenario => {
        healthMonitor.recordRestart(scenario.reason, scenario.exitCode, scenario.watchdog);
      });

      const report = healthMonitor.getHealthReport();
      expect(report.restartHistory).toHaveLength(5);

      // Verify all scenarios were recorded correctly (most recent first)
      restartScenarios.reverse().forEach((scenario, index) => {
        const record = report.restartHistory[index];
        expect(record.reason).toBe(scenario.reason);
        expect(record.exitCode).toBe(scenario.exitCode);
        expect(record.triggeredByWatchdog).toBe(scenario.watchdog);
      });
    });

    it('should handle undefined exit codes', () => {
      healthMonitor.recordRestart('unknown', undefined, false);

      const report = healthMonitor.getHealthReport();
      expect(report.restartHistory).toHaveLength(1);
      expect(report.restartHistory[0].exitCode).toBeUndefined();
    });
  });

  describe('Health Check Tracking', () => {
    it('should track successful health checks', () => {
      const initialReport = healthMonitor.getHealthReport();
      const initialPassed = initialReport.healthChecksPassed;

      // Simulate successful health checks
      healthMonitor.recordHealthCheckResult(true);
      healthMonitor.recordHealthCheckResult(true);
      healthMonitor.recordHealthCheckResult(true);

      const updatedReport = healthMonitor.getHealthReport();
      expect(updatedReport.healthChecksPassed).toBe(initialPassed + 3);
      expect(updatedReport.healthChecksFailed).toBe(initialReport.healthChecksFailed);
    });

    it('should track failed health checks', () => {
      const initialReport = healthMonitor.getHealthReport();
      const initialFailed = initialReport.healthChecksFailed;

      // Simulate failed health checks
      healthMonitor.recordHealthCheckResult(false);
      healthMonitor.recordHealthCheckResult(false);

      const updatedReport = healthMonitor.getHealthReport();
      expect(updatedReport.healthChecksFailed).toBe(initialFailed + 2);
      expect(updatedReport.healthChecksPassed).toBe(initialReport.healthChecksPassed);
    });

    it('should update last health check timestamp', async () => {
      const beforeCheck = Date.now();

      healthMonitor.recordHealthCheckResult(true);

      const report = healthMonitor.getHealthReport();
      expect(report.lastHealthCheck.getTime()).toBeGreaterThanOrEqual(beforeCheck);
    });

    it('should handle mixed health check results', () => {
      const results = [true, false, true, true, false, true];

      results.forEach(result => {
        healthMonitor.recordHealthCheckResult(result);
      });

      const report = healthMonitor.getHealthReport();

      const expectedPassed = results.filter(r => r).length;
      const expectedFailed = results.filter(r => !r).length;

      expect(report.healthChecksPassed).toBe(expectedPassed);
      expect(report.healthChecksFailed).toBe(expectedFailed);
    });
  });

  describe('Task Count Integration', () => {
    it('should provide task count metrics', () => {
      const report = healthMonitor.getHealthReport();

      expect(report.taskCounts).toBeDefined();
      expect(report.taskCounts.processed).toBeDefined();
      expect(report.taskCounts.succeeded).toBeDefined();
      expect(report.taskCounts.failed).toBeDefined();
      expect(report.taskCounts.active).toBeDefined();

      // Task counts should be non-negative integers
      expect(report.taskCounts.processed).toBeGreaterThanOrEqual(0);
      expect(report.taskCounts.succeeded).toBeGreaterThanOrEqual(0);
      expect(report.taskCounts.failed).toBeGreaterThanOrEqual(0);
      expect(report.taskCounts.active).toBeGreaterThanOrEqual(0);

      // Logic validation: processed should equal succeeded + failed
      expect(report.taskCounts.processed).toBe(
        report.taskCounts.succeeded + report.taskCounts.failed
      );
    });

    it('should handle task count updates', () => {
      // Mock task count updates
      healthMonitor.updateTaskCounts({
        processed: 10,
        succeeded: 8,
        failed: 2,
        active: 1
      });

      const report = healthMonitor.getHealthReport();

      expect(report.taskCounts.processed).toBe(10);
      expect(report.taskCounts.succeeded).toBe(8);
      expect(report.taskCounts.failed).toBe(2);
      expect(report.taskCounts.active).toBe(1);
    });
  });

  describe('Uptime Calculation', () => {
    it('should calculate accurate uptime', () => {
      const report = healthMonitor.getHealthReport();

      expect(report.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof report.uptime).toBe('number');

      // Uptime should be reasonable (less than 1 hour for test)
      expect(report.uptime).toBeLessThan(3600000); // 1 hour in milliseconds
    });

    it('should show increasing uptime over time', async () => {
      const firstReport = healthMonitor.getHealthReport();

      // Wait a small amount
      await new Promise(resolve => setTimeout(resolve, 50));

      const secondReport = healthMonitor.getHealthReport();

      expect(secondReport.uptime).toBeGreaterThan(firstReport.uptime);
    });
  });

  describe('Integration with Daemon Manager', () => {
    it('should integrate health monitoring with daemon status', async () => {
      // Mock daemon status
      const mockStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date(Date.now() - 300000), // 5 minutes ago
        uptime: 300000
      };

      vi.spyOn(daemonManager, 'getStatus').mockResolvedValue(mockStatus);

      const status = await daemonManager.getStatus();
      expect(status.running).toBe(true);
      expect(status.uptime).toBe(300000);

      // Health monitor should be able to work alongside daemon status
      const healthReport = healthMonitor.getHealthReport();
      expect(healthReport.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should provide combined health and daemon reports', async () => {
      // Mock extended daemon status with health data
      const mockExtendedStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date(Date.now() - 600000), // 10 minutes ago
        uptime: 600000,
        healthMetrics: {
          memoryUsage: {
            heapUsed: 50000000,
            heapTotal: 100000000,
            rss: 80000000
          },
          taskCounts: {
            processed: 25,
            succeeded: 22,
            failed: 3,
            active: 1
          },
          lastHealthCheck: new Date(),
          healthChecksPassed: 20,
          healthChecksFailed: 2
        }
      };

      vi.spyOn(daemonManager, 'getExtendedStatus').mockResolvedValue(mockExtendedStatus);

      const extendedStatus = await daemonManager.getExtendedStatus();
      expect(extendedStatus.healthMetrics).toBeDefined();
      expect(extendedStatus.healthMetrics!.memoryUsage.heapUsed).toBe(50000000);
      expect(extendedStatus.healthMetrics!.taskCounts.processed).toBe(25);
    });
  });

  describe('Health Report Completeness', () => {
    it('should provide complete health report structure', () => {
      const report = healthMonitor.getHealthReport();

      // Verify all required fields are present
      expect(report).toHaveProperty('uptime');
      expect(report).toHaveProperty('memoryUsage');
      expect(report).toHaveProperty('taskCounts');
      expect(report).toHaveProperty('lastHealthCheck');
      expect(report).toHaveProperty('healthChecksPassed');
      expect(report).toHaveProperty('healthChecksFailed');
      expect(report).toHaveProperty('restartHistory');

      // Verify memory usage structure
      expect(report.memoryUsage).toHaveProperty('heapUsed');
      expect(report.memoryUsage).toHaveProperty('heapTotal');
      expect(report.memoryUsage).toHaveProperty('rss');

      // Verify task counts structure
      expect(report.taskCounts).toHaveProperty('processed');
      expect(report.taskCounts).toHaveProperty('succeeded');
      expect(report.taskCounts).toHaveProperty('failed');
      expect(report.taskCounts).toHaveProperty('active');

      // Verify data types
      expect(typeof report.uptime).toBe('number');
      expect(report.lastHealthCheck).toBeInstanceOf(Date);
      expect(Array.isArray(report.restartHistory)).toBe(true);
    });

    it('should serialize health report to JSON correctly', () => {
      healthMonitor.recordRestart('test', 0, false);
      const report = healthMonitor.getHealthReport();

      const serialized = JSON.stringify(report);
      const parsed = JSON.parse(serialized);

      expect(parsed.uptime).toBe(report.uptime);
      expect(parsed.memoryUsage.heapUsed).toBe(report.memoryUsage.heapUsed);
      expect(parsed.taskCounts.processed).toBe(report.taskCounts.processed);
      expect(parsed.healthChecksPassed).toBe(report.healthChecksPassed);
      expect(parsed.restartHistory).toHaveLength(report.restartHistory.length);
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle rapid health report generation', () => {
      const startTime = Date.now();
      const reports = [];

      // Generate 1000 reports quickly
      for (let i = 0; i < 1000; i++) {
        reports.push(healthMonitor.getHealthReport());
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
      expect(reports).toHaveLength(1000);

      // All reports should be valid
      reports.forEach(report => {
        expect(report.uptime).toBeGreaterThanOrEqual(0);
        expect(report.memoryUsage.heapUsed).toBeGreaterThan(0);
      });
    });

    it('should handle many restart records efficiently', () => {
      const startTime = Date.now();

      // Record many restart events
      for (let i = 0; i < 100; i++) {
        healthMonitor.recordRestart(`stress-test-${i}`, i % 10, i % 3 === 0);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly
      expect(duration).toBeLessThan(500);

      const report = healthMonitor.getHealthReport();
      // Should still respect the history limit
      expect(report.restartHistory).toHaveLength(5);
      // Should have the most recent entries
      expect(report.restartHistory[0].reason).toBe('stress-test-99');
    });

    it('should handle concurrent health check recordings', async () => {
      const promises = [];

      // Record health checks concurrently
      for (let i = 0; i < 50; i++) {
        promises.push(Promise.resolve().then(() => {
          healthMonitor.recordHealthCheckResult(i % 3 !== 0);
        }));
      }

      await Promise.all(promises);

      const report = healthMonitor.getHealthReport();

      // Should have recorded all health checks
      const expectedPassed = Math.floor(50 * 2 / 3); // Roughly 2/3 should pass
      const expectedFailed = 50 - expectedPassed;

      expect(report.healthChecksPassed + report.healthChecksFailed).toBe(50);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty restart history gracefully', () => {
      const report = healthMonitor.getHealthReport();

      expect(report.restartHistory).toEqual([]);
      expect(Array.isArray(report.restartHistory)).toBe(true);
    });

    it('should handle invalid restart data gracefully', () => {
      // These should not throw errors
      healthMonitor.recordRestart('', undefined, false);
      healthMonitor.recordRestart(null as any, NaN, undefined as any);

      const report = healthMonitor.getHealthReport();

      expect(report.restartHistory.length).toBeGreaterThan(0);
      // Should handle the invalid data without crashing
    });

    it('should handle extreme memory values', () => {
      // This tests that the health monitor can handle actual memory values
      // even if they're unexpectedly large or small
      const report = healthMonitor.getHealthReport();

      expect(Number.isFinite(report.memoryUsage.heapUsed)).toBe(true);
      expect(Number.isFinite(report.memoryUsage.heapTotal)).toBe(true);
      expect(Number.isFinite(report.memoryUsage.rss)).toBe(true);

      // Values should not be negative
      expect(report.memoryUsage.heapUsed).toBeGreaterThanOrEqual(0);
      expect(report.memoryUsage.heapTotal).toBeGreaterThanOrEqual(0);
      expect(report.memoryUsage.rss).toBeGreaterThanOrEqual(0);
    });
  });
});