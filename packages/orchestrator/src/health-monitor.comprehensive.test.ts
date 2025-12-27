import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthMonitor } from './health-monitor';
import { DaemonRunner, type DaemonMetrics } from './runner';

/**
 * Comprehensive integration tests for HealthMonitor
 * These tests focus on cross-functional scenarios and comprehensive workflows
 */
describe('HealthMonitor - Comprehensive Integration Tests', () => {
  let healthMonitor: HealthMonitor;
  let mockDaemonRunner: DaemonRunner;

  beforeEach(() => {
    vi.useFakeTimers();
    healthMonitor = new HealthMonitor({ maxRestartHistorySize: 10 });

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

    // Mock process.memoryUsage with realistic values
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: 134217728,  // 128MB
      heapTotal: 268435456, // 256MB
      rss: 402653184,       // 384MB
      external: 1024000,
      arrayBuffers: 512000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Production-like monitoring scenarios', () => {
    it('should handle a complete daemon lifecycle with monitoring', () => {
      // Phase 1: Initial startup
      healthMonitor.performHealthCheck(true);

      let report = healthMonitor.getHealthReport(mockDaemonRunner);
      expect(report.healthChecksPassed).toBe(1);
      expect(report.healthChecksFailed).toBe(0);
      expect(report.taskCounts.processed).toBe(10);

      // Phase 2: Some processing time passes
      vi.advanceTimersByTime(3600000); // 1 hour

      // Update daemon metrics to reflect processing
      vi.mocked(mockDaemonRunner.getMetrics).mockReturnValue({
        startedAt: new Date('2023-01-01T00:00:00Z'),
        uptime: 3600000,
        tasksProcessed: 150,
        tasksSucceeded: 140,
        tasksFailed: 10,
        activeTaskCount: 3,
        isRunning: true,
      } as DaemonMetrics);

      // Continue health checking
      for (let i = 0; i < 60; i++) {
        healthMonitor.performHealthCheck(Math.random() > 0.05); // 95% success rate
        vi.advanceTimersByTime(60000); // Every minute
      }

      report = healthMonitor.getHealthReport(mockDaemonRunner);
      expect(report.healthChecksPassed).toBeGreaterThan(50);
      expect(report.taskCounts.processed).toBe(150);
      expect(report.uptime).toBeGreaterThan(3600000);

      // Phase 3: Memory pressure and restart
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 1073741824,   // 1GB (high memory usage)
        heapTotal: 1073741824,  // 1GB
        rss: 1610612736,        // 1.5GB
        external: 1024000,
        arrayBuffers: 512000,
      });

      healthMonitor.recordRestart('memory-pressure', 137, true);

      // Phase 4: After restart recovery
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 67108864,     // 64MB (back to normal)
        heapTotal: 134217728,   // 128MB
        rss: 201326592,         // 192MB
        external: 1024000,
        arrayBuffers: 512000,
      });

      vi.mocked(mockDaemonRunner.getMetrics).mockReturnValue({
        startedAt: new Date(),
        uptime: 60000, // Just restarted
        tasksProcessed: 5,
        tasksSucceeded: 5,
        tasksFailed: 0,
        activeTaskCount: 0,
        isRunning: true,
      } as DaemonMetrics);

      healthMonitor.performHealthCheck(true);

      const finalReport = healthMonitor.getHealthReport(mockDaemonRunner);

      // Verify complete lifecycle tracking
      expect(finalReport.restartHistory).toHaveLength(1);
      expect(finalReport.restartHistory[0].reason).toBe('memory-pressure');
      expect(finalReport.restartHistory[0].triggeredByWatchdog).toBe(true);
      expect(healthMonitor.hasWatchdogRestarts()).toBe(true);
      expect(finalReport.memoryUsage.heapUsed).toBe(67108864);
    });

    it('should maintain monitoring accuracy during high-stress scenarios', () => {
      // Simulate high-frequency operations
      const iterations = 500;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        // Vary memory usage
        vi.spyOn(process, 'memoryUsage').mockReturnValue({
          heapUsed: 52428800 + (i * 10240), // Gradually increasing
          heapTotal: 104857600 + (i * 20480),
          rss: 157286400 + (i * 30720),
          external: 1024000,
          arrayBuffers: 512000,
        });

        // Vary daemon metrics
        vi.mocked(mockDaemonRunner.getMetrics).mockReturnValue({
          startedAt: new Date('2023-01-01T00:00:00Z'),
          uptime: i * 1000,
          tasksProcessed: i * 2,
          tasksSucceeded: Math.floor(i * 1.8),
          tasksFailed: Math.floor(i * 0.2),
          activeTaskCount: i % 10,
          isRunning: true,
        } as DaemonMetrics);

        // Perform health checks
        healthMonitor.performHealthCheck(i % 20 !== 0); // 95% success rate

        // Occasional restarts
        if (i % 100 === 0 && i > 0) {
          healthMonitor.recordRestart(`stress-restart-${i}`, i % 3, i % 150 === 0);
        }

        // Get health report
        const report = healthMonitor.getHealthReport(mockDaemonRunner);

        // Verify data consistency
        expect(report.memoryUsage.heapUsed).toBe(52428800 + (i * 10240));
        expect(report.taskCounts.processed).toBe(i * 2);

        vi.advanceTimersByTime(100); // 100ms per iteration
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete efficiently
      expect(duration).toBeLessThan(1000); // 1 second for 500 iterations

      const finalReport = healthMonitor.getHealthReport(mockDaemonRunner);

      // Verify accumulated data
      expect(finalReport.healthChecksPassed + finalReport.healthChecksFailed).toBe(iterations);
      expect(finalReport.restartHistory.length).toBeLessThanOrEqual(10); // Bounded by maxRestartHistorySize
      expect(finalReport.uptime).toBeGreaterThan(40000); // 50 seconds of simulated time
    });

    it('should handle complex restart patterns and recovery scenarios', () => {
      const restartScenarios = [
        // Normal startup and operation
        {
          phase: 'startup',
          delay: 0,
          restart: null,
          healthChecks: 5,
          tasks: { processed: 0, succeeded: 0, failed: 0, active: 0 }
        },
        // Initial load
        {
          phase: 'initial-load',
          delay: 300000, // 5 minutes
          restart: null,
          healthChecks: 10,
          tasks: { processed: 50, succeeded: 48, failed: 2, active: 5 }
        },
        // First issue - application crash
        {
          phase: 'application-crash',
          delay: 600000, // 10 minutes
          restart: { reason: 'unhandled-exception', exitCode: 1, watchdog: false },
          healthChecks: 3,
          tasks: { processed: 5, succeeded: 5, failed: 0, active: 0 }
        },
        // Recovery and normal operation
        {
          phase: 'recovery',
          delay: 1200000, // 20 minutes
          restart: null,
          healthChecks: 20,
          tasks: { processed: 100, succeeded: 95, failed: 5, active: 3 }
        },
        // Memory leak detected by monitoring
        {
          phase: 'memory-leak',
          delay: 2400000, // 40 minutes
          restart: { reason: 'memory-leak-detected', exitCode: 9, watchdog: true },
          healthChecks: 5,
          tasks: { processed: 10, succeeded: 8, failed: 2, active: 1 }
        },
        // Stable operation after memory fix
        {
          phase: 'stable-operation',
          delay: 3600000, // 60 minutes
          restart: null,
          healthChecks: 30,
          tasks: { processed: 200, succeeded: 190, failed: 10, active: 2 }
        },
        // Watchdog intervention due to hanging
        {
          phase: 'watchdog-intervention',
          delay: 4800000, // 80 minutes
          restart: { reason: 'health-check-timeout', exitCode: 143, watchdog: true },
          healthChecks: 2,
          tasks: { processed: 2, succeeded: 2, failed: 0, active: 0 }
        },
        // Final recovery
        {
          phase: 'final-recovery',
          delay: 5400000, // 90 minutes
          restart: null,
          healthChecks: 15,
          tasks: { processed: 75, succeeded: 73, failed: 2, active: 1 }
        }
      ];

      for (const scenario of restartScenarios) {
        vi.setSystemTime(new Date('2023-01-01T00:00:00Z').getTime() + scenario.delay);

        // Apply restart if specified
        if (scenario.restart) {
          healthMonitor.recordRestart(
            scenario.restart.reason,
            scenario.restart.exitCode,
            scenario.restart.watchdog
          );
        }

        // Update daemon metrics
        vi.mocked(mockDaemonRunner.getMetrics).mockReturnValue({
          startedAt: new Date('2023-01-01T00:00:00Z'),
          uptime: scenario.delay,
          tasksProcessed: scenario.tasks.processed,
          tasksSucceeded: scenario.tasks.succeeded,
          tasksFailed: scenario.tasks.failed,
          activeTaskCount: scenario.tasks.active,
          isRunning: true,
        } as DaemonMetrics);

        // Perform health checks
        for (let i = 0; i < scenario.healthChecks; i++) {
          healthMonitor.performHealthCheck(scenario.phase !== 'memory-leak' && scenario.phase !== 'watchdog-intervention');
        }
      }

      const finalReport = healthMonitor.getHealthReport(mockDaemonRunner);

      // Verify comprehensive tracking
      expect(finalReport.restartHistory).toHaveLength(3); // 3 restarts in scenarios
      expect(healthMonitor.hasWatchdogRestarts()).toBe(true);

      // Check restart types
      const restartReasons = finalReport.restartHistory.map(r => r.reason);
      expect(restartReasons).toContain('unhandled-exception');
      expect(restartReasons).toContain('memory-leak-detected');
      expect(restartReasons).toContain('health-check-timeout');

      // Verify health check accumulation
      const totalHealthChecks = finalReport.healthChecksPassed + finalReport.healthChecksFailed;
      expect(totalHealthChecks).toBe(90); // Sum of all healthChecks in scenarios

      // Verify watchdog detection
      const watchdogRestarts = finalReport.restartHistory.filter(r => r.triggeredByWatchdog);
      expect(watchdogRestarts).toHaveLength(2);
    });

    it('should maintain data integrity during concurrent monitoring operations', () => {
      const concurrentOperations = Array.from({ length: 50 }, (_, i) => {
        return Promise.resolve().then(() => {
          // Simulate concurrent health checks
          healthMonitor.performHealthCheck(Math.random() > 0.1);

          // Simulate occasional restarts
          if (i % 10 === 0) {
            healthMonitor.recordRestart(`concurrent-${i}`, i, i % 20 === 0);
          }

          // Simulate memory usage changes
          vi.spyOn(process, 'memoryUsage').mockReturnValue({
            heapUsed: 52428800 + (i * 1048576), // 50MB + i MB
            heapTotal: 104857600 + (i * 2097152), // 100MB + i*2 MB
            rss: 157286400 + (i * 3145728), // 150MB + i*3 MB
            external: 1024000,
            arrayBuffers: 512000,
          });

          // Get health report
          const report = healthMonitor.getHealthReport(mockDaemonRunner);

          // Verify basic data integrity
          expect(report).toBeDefined();
          expect(report.memoryUsage).toBeDefined();
          expect(report.taskCounts).toBeDefined();
          expect(report.restartHistory).toBeDefined();

          return report;
        });
      });

      return Promise.all(concurrentOperations).then(reports => {
        expect(reports).toHaveLength(50);

        // All reports should be valid
        reports.forEach(report => {
          expect(typeof report.uptime).toBe('number');
          expect(typeof report.healthChecksPassed).toBe('number');
          expect(typeof report.healthChecksFailed).toBe('number');
          expect(Array.isArray(report.restartHistory)).toBe(true);
        });

        // Final state should be consistent
        const finalReport = healthMonitor.getHealthReport();
        expect(finalReport.healthChecksPassed + finalReport.healthChecksFailed).toBe(50);
        expect(finalReport.restartHistory.length).toBeLessThanOrEqual(10);
      });
    });
  });

  describe('Cross-component integration validation', () => {
    it('should properly integrate health monitoring with daemon runner lifecycle', () => {
      // Simulate daemon startup
      let currentMetrics: DaemonMetrics = {
        startedAt: new Date('2023-01-01T00:00:00Z'),
        uptime: 0,
        tasksProcessed: 0,
        tasksSucceeded: 0,
        tasksFailed: 0,
        activeTaskCount: 0,
        isRunning: true,
      };

      vi.mocked(mockDaemonRunner.getMetrics).mockImplementation(() => currentMetrics);

      // Initial health check
      healthMonitor.performHealthCheck(true);
      let report = healthMonitor.getHealthReport(mockDaemonRunner);

      expect(report.taskCounts.processed).toBe(0);
      expect(report.healthChecksPassed).toBe(1);

      // Simulate task processing
      const processingSteps = [
        { time: 60000, processed: 10, succeeded: 10, failed: 0, active: 2 },
        { time: 120000, processed: 25, succeeded: 23, failed: 2, active: 1 },
        { time: 180000, processed: 50, succeeded: 45, failed: 5, active: 3 },
        { time: 240000, processed: 100, succeeded: 90, failed: 10, active: 0 },
      ];

      for (const step of processingSteps) {
        vi.setSystemTime(new Date('2023-01-01T00:00:00Z').getTime() + step.time);

        currentMetrics = {
          startedAt: new Date('2023-01-01T00:00:00Z'),
          uptime: step.time,
          tasksProcessed: step.processed,
          tasksSucceeded: step.succeeded,
          tasksFailed: step.failed,
          activeTaskCount: step.active,
          isRunning: true,
        };

        healthMonitor.performHealthCheck(step.failed === 0 || step.failed < step.processed * 0.1);
        report = healthMonitor.getHealthReport(mockDaemonRunner);

        expect(report.taskCounts.processed).toBe(step.processed);
        expect(report.taskCounts.succeeded).toBe(step.succeeded);
        expect(report.taskCounts.failed).toBe(step.failed);
        expect(report.taskCounts.active).toBe(step.active);
        expect(report.uptime).toBeGreaterThanOrEqual(step.time);
      }

      // Simulate daemon restart
      healthMonitor.recordRestart('planned-restart', 0, false);

      // Reset daemon metrics after restart
      currentMetrics = {
        startedAt: new Date(Date.now()),
        uptime: 0,
        tasksProcessed: 0,
        tasksSucceeded: 0,
        tasksFailed: 0,
        activeTaskCount: 0,
        isRunning: true,
      };

      report = healthMonitor.getHealthReport(mockDaemonRunner);

      // Task counts should reflect new daemon state
      expect(report.taskCounts.processed).toBe(0);
      expect(report.taskCounts.succeeded).toBe(0);
      expect(report.taskCounts.failed).toBe(0);
      expect(report.taskCounts.active).toBe(0);

      // But monitoring data should persist
      expect(report.healthChecksPassed).toBeGreaterThan(0);
      expect(report.restartHistory).toHaveLength(1);
      expect(report.restartHistory[0].reason).toBe('planned-restart');
    });

    it('should handle daemon runner errors gracefully while maintaining monitoring', () => {
      // Start with working daemon runner
      healthMonitor.performHealthCheck(true);
      let report = healthMonitor.getHealthReport(mockDaemonRunner);
      expect(report.taskCounts.processed).toBe(10);

      // Daemon runner starts throwing errors
      vi.mocked(mockDaemonRunner.getMetrics).mockImplementation(() => {
        throw new Error('Daemon unreachable');
      });

      // Health monitoring should still work independently
      healthMonitor.performHealthCheck(false); // Health check fails due to daemon issue
      healthMonitor.recordRestart('daemon-unreachable', 1, true);

      // Should throw when trying to get daemon metrics, but monitoring data persists
      expect(() => {
        healthMonitor.getHealthReport(mockDaemonRunner);
      }).toThrow('Daemon unreachable');

      // But should work without daemon runner
      report = healthMonitor.getHealthReport();
      expect(report.taskCounts.processed).toBe(0); // Fallback values
      expect(report.healthChecksPassed).toBe(1); // Previous checks preserved
      expect(report.healthChecksFailed).toBe(1); // Recent failed check
      expect(report.restartHistory).toHaveLength(1);
      expect(report.restartHistory[0].reason).toBe('daemon-unreachable');
    });
  });
});