import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthMonitor } from './health-monitor';
import { DaemonRunner } from './runner';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import type { HealthMetrics } from '@apexcli/core';
import type { DaemonMetrics } from './runner';

// Mock dependencies similar to DaemonRunner tests
vi.mock('./index', () => ({
  ApexOrchestrator: vi.fn(),
}));

vi.mock('./store', () => ({
  TaskStore: vi.fn(),
}));

vi.mock('@apexcli/core', () => ({
  loadConfig: vi.fn(),
  getEffectiveConfig: vi.fn(),
}));

vi.mock('./usage-manager', () => ({
  UsageManager: vi.fn(),
}));

vi.mock('./daemon-scheduler', () => ({
  DaemonScheduler: vi.fn(),
}));

describe('HealthMonitor Integration Tests', () => {
  let healthMonitor: HealthMonitor;
  let daemonRunner: DaemonRunner;

  beforeEach(() => {
    vi.useFakeTimers();

    // Initialize HealthMonitor
    healthMonitor = new HealthMonitor({ maxRestartHistorySize: 5 });

    // Initialize DaemonRunner with mocked dependencies
    const mockOrchestrator = {} as ApexOrchestrator;
    const mockStore = {} as TaskStore;

    daemonRunner = new DaemonRunner(mockOrchestrator, mockStore, {
      pollInterval: 1000,
      maxConcurrency: 2,
    });

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

  describe('Integration with real DaemonRunner', () => {
    it('should collect metrics from running DaemonRunner', () => {
      // Start the daemon runner to initialize metrics
      daemonRunner.start();

      // Wait for initialization
      vi.advanceTimersByTime(100);

      // Perform a health check
      healthMonitor.performHealthCheck(true);

      // Get health report with real daemon metrics
      const report = healthMonitor.getHealthReport(daemonRunner);

      expect(report).toBeDefined();
      expect(report.memoryUsage).toEqual({
        heapUsed: 100 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        rss: 300 * 1024 * 1024,
      });

      expect(report.taskCounts).toEqual({
        processed: 0, // No tasks processed yet
        succeeded: 0,
        failed: 0,
        active: 0,
      });

      expect(report.healthChecksPassed).toBe(1);
      expect(report.healthChecksFailed).toBe(0);
      expect(report.uptime).toBeGreaterThan(0);
    });

    it('should track daemon state changes through health monitoring', () => {
      // Start daemon
      daemonRunner.start();
      healthMonitor.performHealthCheck(true);

      // Stop daemon
      daemonRunner.stop();
      healthMonitor.performHealthCheck(false);

      // Restart daemon
      daemonRunner.start();
      healthMonitor.recordRestart('manual', 0, false);
      healthMonitor.performHealthCheck(true);

      const report = healthMonitor.getHealthReport(daemonRunner);

      expect(report.healthChecksPassed).toBe(2);
      expect(report.healthChecksFailed).toBe(1);
      expect(report.restartHistory).toHaveLength(1);
      expect(report.restartHistory[0].reason).toBe('manual');
    });

    it('should monitor daemon over extended time period', () => {
      // Start monitoring
      daemonRunner.start();
      healthMonitor.performHealthCheck(true);

      // Simulate extended operation
      const healthCheckCount = 10;
      const timeInterval = 30000; // 30 seconds each

      for (let i = 0; i < healthCheckCount; i++) {
        vi.advanceTimersByTime(timeInterval);

        // Simulate occasional failed health checks
        const success = i % 4 !== 0; // Fail every 4th check
        healthMonitor.performHealthCheck(success);

        if (i === 5) {
          // Simulate a restart mid-monitoring
          healthMonitor.recordRestart('watchdog', undefined, true);
        }
      }

      const report = healthMonitor.getHealthReport(daemonRunner);

      expect(report.uptime).toBeGreaterThan(healthCheckCount * timeInterval);
      expect(report.healthChecksPassed).toBe(8); // 1 initial + 7 passed out of 10
      expect(report.healthChecksFailed).toBe(3); // 3 failed out of 10
      expect(report.restartHistory).toHaveLength(1);
      expect(healthMonitor.hasWatchdogRestarts()).toBe(true);
    });
  });

  describe('Health monitoring workflows', () => {
    it('should support typical daemon monitoring lifecycle', () => {
      // Phase 1: Initial startup
      daemonRunner.start();
      healthMonitor.performHealthCheck(true);

      let report = healthMonitor.getHealthReport(daemonRunner);
      expect(report.healthChecksPassed).toBe(1);

      // Phase 2: Normal operation with periodic health checks
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(60000); // 1 minute intervals
        healthMonitor.performHealthCheck(true);
      }

      report = healthMonitor.getHealthReport(daemonRunner);
      expect(report.healthChecksPassed).toBe(6); // Initial + 5 periodic

      // Phase 3: Simulated crash and recovery
      daemonRunner.stop();
      healthMonitor.recordRestart('crash', 1, false);

      // Phase 4: Restart and health check
      daemonRunner.start();
      healthMonitor.performHealthCheck(true);

      // Phase 5: Watchdog-triggered restart
      healthMonitor.recordRestart('oom', 9, true);

      const finalReport = healthMonitor.getHealthReport(daemonRunner);
      expect(finalReport.healthChecksPassed).toBe(7);
      expect(finalReport.restartHistory).toHaveLength(2);
      expect(finalReport.restartHistory[0].reason).toBe('oom');
      expect(finalReport.restartHistory[1].reason).toBe('crash');
      expect(healthMonitor.hasWatchdogRestarts()).toBe(true);
    });

    it('should handle health monitoring during daemon errors', () => {
      // Start normally
      daemonRunner.start();
      healthMonitor.performHealthCheck(true);

      // Simulate daemon entering error state (mock getMetrics to throw)
      const originalGetMetrics = daemonRunner.getMetrics;
      vi.spyOn(daemonRunner, 'getMetrics').mockImplementation(() => {
        throw new Error('Daemon in error state');
      });

      // Health monitor should handle this gracefully
      expect(() => {
        healthMonitor.getHealthReport(daemonRunner);
      }).toThrow('Daemon in error state');

      // Record the error and restart
      healthMonitor.performHealthCheck(false);
      healthMonitor.recordRestart('error', 1, false);

      // Restore normal operation
      vi.mocked(daemonRunner.getMetrics).mockRestore();
      healthMonitor.performHealthCheck(true);

      const report = healthMonitor.getHealthReport(daemonRunner);
      expect(report.healthChecksPassed).toBe(2);
      expect(report.healthChecksFailed).toBe(1);
      expect(report.restartHistory).toHaveLength(1);
    });
  });

  describe('Performance and resource monitoring', () => {
    it('should track memory usage changes over time', () => {
      daemonRunner.start();

      // Initial memory reading
      let report = healthMonitor.getHealthReport(daemonRunner);
      const initialMemory = report.memoryUsage;

      // Simulate memory increase
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 150 * 1024 * 1024, // Increased to 150MB
        heapTotal: 250 * 1024 * 1024, // Increased to 250MB
        rss: 400 * 1024 * 1024, // Increased to 400MB
        external: 15 * 1024 * 1024,
        arrayBuffers: 8 * 1024 * 1024,
      });

      // Take another reading
      report = healthMonitor.getHealthReport(daemonRunner);
      const newMemory = report.memoryUsage;

      expect(newMemory.heapUsed).toBeGreaterThan(initialMemory.heapUsed);
      expect(newMemory.heapTotal).toBeGreaterThan(initialMemory.heapTotal);
      expect(newMemory.rss).toBeGreaterThan(initialMemory.rss);
    });

    it('should maintain accurate uptime tracking', () => {
      const startTime = Date.now();

      daemonRunner.start();
      healthMonitor.performHealthCheck(true);

      // Simulate time passing
      const timeElapsed = 300000; // 5 minutes
      vi.advanceTimersByTime(timeElapsed);

      const report = healthMonitor.getHealthReport(daemonRunner);

      expect(report.uptime).toBeGreaterThanOrEqual(timeElapsed);
      expect(healthMonitor.getUptime()).toBeGreaterThanOrEqual(timeElapsed);
    });

    it('should handle rapid health check sequences efficiently', () => {
      daemonRunner.start();

      const startTime = Date.now();

      // Perform many rapid health checks
      for (let i = 0; i < 1000; i++) {
        healthMonitor.performHealthCheck(i % 2 === 0);
      }

      const endTime = Date.now();
      const report = healthMonitor.getHealthReport(daemonRunner);

      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(100);

      // Should track all checks correctly
      expect(report.healthChecksPassed).toBe(500);
      expect(report.healthChecksFailed).toBe(500);
    });
  });

  describe('Edge cases in integration', () => {
    it('should handle daemon stop/start cycles', () => {
      // Multiple stop/start cycles
      for (let cycle = 0; cycle < 3; cycle++) {
        daemonRunner.start();
        healthMonitor.performHealthCheck(true);

        vi.advanceTimersByTime(10000); // Run for 10 seconds

        daemonRunner.stop();
        healthMonitor.recordRestart(`cycle-${cycle}`, 0, false);
      }

      const report = healthMonitor.getHealthReport();
      expect(report.healthChecksPassed).toBe(3);
      expect(report.restartHistory).toHaveLength(3);
    });

    it('should handle concurrent daemon and health monitor operations', () => {
      daemonRunner.start();

      const promises = [];

      // Concurrent operations
      for (let i = 0; i < 50; i++) {
        promises.push(
          Promise.resolve().then(() => {
            healthMonitor.performHealthCheck(Math.random() > 0.3);

            if (i % 20 === 0) {
              healthMonitor.recordRestart(`load-test-${i}`, i, i % 2 === 0);
            }

            // Get health reports concurrently
            return healthMonitor.getHealthReport(daemonRunner);
          })
        );
      }

      return Promise.all(promises).then((reports) => {
        expect(reports).toHaveLength(50);

        const finalReport = healthMonitor.getHealthReport(daemonRunner);
        expect(finalReport.healthChecksPassed + finalReport.healthChecksFailed).toBe(50);
        expect(healthMonitor.getRestartCount()).toBeLessThanOrEqual(5); // Limited by maxRestartHistorySize
      });
    });
  });

  describe('Data consistency and validation', () => {
    it('should maintain consistent state across daemon restarts', () => {
      // Initial state
      daemonRunner.start();
      healthMonitor.performHealthCheck(true);
      healthMonitor.recordRestart('initial', 0, false);

      const beforeStop = healthMonitor.getHealthReport(daemonRunner);

      // Stop daemon
      daemonRunner.stop();

      // Health monitor state should persist
      const afterStop = healthMonitor.getHealthReport();
      expect(afterStop.healthChecksPassed).toBe(beforeStop.healthChecksPassed);
      expect(afterStop.restartHistory).toEqual(beforeStop.restartHistory);

      // Restart daemon
      daemonRunner.start();
      healthMonitor.performHealthCheck(true);

      const afterRestart = healthMonitor.getHealthReport(daemonRunner);
      expect(afterRestart.healthChecksPassed).toBe(2); // 1 + 1 new check
      expect(afterRestart.restartHistory).toEqual(beforeStop.restartHistory);
    });

    it('should validate health report completeness', () => {
      daemonRunner.start();
      healthMonitor.performHealthCheck(true);
      healthMonitor.recordRestart('validation-test', 0, true);

      const report = healthMonitor.getHealthReport(daemonRunner);

      // Validate all required fields are present and valid
      expect(typeof report.uptime).toBe('number');
      expect(report.uptime).toBeGreaterThan(0);

      expect(report.memoryUsage).toBeDefined();
      expect(typeof report.memoryUsage.heapUsed).toBe('number');
      expect(typeof report.memoryUsage.heapTotal).toBe('number');
      expect(typeof report.memoryUsage.rss).toBe('number');

      expect(report.taskCounts).toBeDefined();
      expect(typeof report.taskCounts.processed).toBe('number');
      expect(typeof report.taskCounts.succeeded).toBe('number');
      expect(typeof report.taskCounts.failed).toBe('number');
      expect(typeof report.taskCounts.active).toBe('number');

      expect(report.lastHealthCheck).toBeInstanceOf(Date);
      expect(typeof report.healthChecksPassed).toBe('number');
      expect(typeof report.healthChecksFailed).toBe('number');

      expect(Array.isArray(report.restartHistory)).toBe(true);
      expect(report.restartHistory).toHaveLength(1);
      expect(report.restartHistory[0].reason).toBe('validation-test');
    });
  });
});