import { describe, it, expect } from 'vitest';
import {
  HealthMetrics,
  DaemonMemoryUsage,
  DaemonTaskCounts,
  RestartRecord,
  DaemonConfig,
  DaemonConfigSchema,
} from '../types.js';

describe('HealthMetrics Type and DaemonConfig Integration', () => {
  describe('HealthMetrics interface', () => {
    it('should allow creating valid HealthMetrics objects', () => {
      const memoryUsage: DaemonMemoryUsage = {
        heapUsed: 45000000,
        heapTotal: 80000000,
        rss: 120000000,
      };

      const taskCounts: DaemonTaskCounts = {
        processed: 150,
        succeeded: 140,
        failed: 10,
        active: 3,
      };

      const restartRecord: RestartRecord = {
        timestamp: new Date('2023-10-15T10:30:00Z'),
        reason: 'oom',
        exitCode: 137,
        triggeredByWatchdog: true,
      };

      const healthMetrics: HealthMetrics = {
        uptime: 3600000, // 1 hour in milliseconds
        memoryUsage,
        taskCounts,
        lastHealthCheck: new Date('2023-10-15T11:00:00Z'),
        healthChecksPassed: 120,
        healthChecksFailed: 2,
        restartHistory: [restartRecord],
      };

      expect(healthMetrics.uptime).toBe(3600000);
      expect(healthMetrics.memoryUsage.heapUsed).toBe(45000000);
      expect(healthMetrics.memoryUsage.heapTotal).toBe(80000000);
      expect(healthMetrics.memoryUsage.rss).toBe(120000000);
      expect(healthMetrics.taskCounts.processed).toBe(150);
      expect(healthMetrics.taskCounts.succeeded).toBe(140);
      expect(healthMetrics.taskCounts.failed).toBe(10);
      expect(healthMetrics.taskCounts.active).toBe(3);
      expect(healthMetrics.lastHealthCheck).toBeInstanceOf(Date);
      expect(healthMetrics.healthChecksPassed).toBe(120);
      expect(healthMetrics.healthChecksFailed).toBe(2);
      expect(healthMetrics.restartHistory).toHaveLength(1);
      expect(healthMetrics.restartHistory[0].reason).toBe('oom');
      expect(healthMetrics.restartHistory[0].triggeredByWatchdog).toBe(true);
    });

    it('should support empty restart history', () => {
      const healthMetrics: HealthMetrics = {
        uptime: 1800000, // 30 minutes
        memoryUsage: {
          heapUsed: 30000000,
          heapTotal: 60000000,
          rss: 90000000,
        },
        taskCounts: {
          processed: 50,
          succeeded: 48,
          failed: 2,
          active: 1,
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: 60,
        healthChecksFailed: 0,
        restartHistory: [], // Empty restart history
      };

      expect(healthMetrics.restartHistory).toHaveLength(0);
      expect(healthMetrics.healthChecksFailed).toBe(0);
    });
  });

  describe('DaemonMemoryUsage interface', () => {
    it('should properly represent Node.js process.memoryUsage() structure', () => {
      const memoryUsage: DaemonMemoryUsage = {
        heapUsed: 25123456,
        heapTotal: 50246912,
        rss: 75370368,
      };

      expect(typeof memoryUsage.heapUsed).toBe('number');
      expect(typeof memoryUsage.heapTotal).toBe('number');
      expect(typeof memoryUsage.rss).toBe('number');
      expect(memoryUsage.heapUsed).toBeLessThan(memoryUsage.heapTotal);
      expect(memoryUsage.heapTotal).toBeLessThan(memoryUsage.rss);
    });
  });

  describe('DaemonTaskCounts interface', () => {
    it('should maintain consistent task count relationships', () => {
      const taskCounts: DaemonTaskCounts = {
        processed: 100,
        succeeded: 85,
        failed: 15,
        active: 5,
      };

      // Logical validations
      expect(taskCounts.succeeded + taskCounts.failed).toBe(taskCounts.processed);
      expect(taskCounts.active).toBeGreaterThanOrEqual(0);
      expect(taskCounts.processed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('RestartRecord interface', () => {
    it('should capture restart information correctly', () => {
      const manualRestart: RestartRecord = {
        timestamp: new Date('2023-10-15T09:00:00Z'),
        reason: 'manual',
        triggeredByWatchdog: false,
      };

      const crashRestart: RestartRecord = {
        timestamp: new Date('2023-10-15T10:15:00Z'),
        reason: 'crash',
        exitCode: 1,
        triggeredByWatchdog: true,
      };

      expect(manualRestart.reason).toBe('manual');
      expect(manualRestart.triggeredByWatchdog).toBe(false);
      expect(manualRestart.exitCode).toBeUndefined();

      expect(crashRestart.reason).toBe('crash');
      expect(crashRestart.triggeredByWatchdog).toBe(true);
      expect(crashRestart.exitCode).toBe(1);
    });
  });

  describe('DaemonConfig health configuration', () => {
    it('should include healthCheck configuration in DaemonConfig', () => {
      const daemonConfig: DaemonConfig = {
        pollInterval: 5000,
        autoStart: true,
        logLevel: 'info',
        healthCheck: {
          enabled: true,
          interval: 30000,
          timeout: 5000,
          retries: 3,
        },
      };

      expect(daemonConfig.healthCheck).toBeDefined();
      expect(daemonConfig.healthCheck?.enabled).toBe(true);
      expect(daemonConfig.healthCheck?.interval).toBe(30000);
      expect(daemonConfig.healthCheck?.timeout).toBe(5000);
      expect(daemonConfig.healthCheck?.retries).toBe(3);
    });

    it('should validate DaemonConfig with healthCheck via schema', () => {
      const configWithHealthCheck = {
        pollInterval: 10000,
        autoStart: false,
        logLevel: 'warn',
        healthCheck: {
          enabled: true,
          interval: 60000,
          timeout: 10000,
          retries: 5,
        },
      };

      const result = DaemonConfigSchema.parse(configWithHealthCheck);
      expect(result.healthCheck?.enabled).toBe(true);
      expect(result.healthCheck?.interval).toBe(60000);
      expect(result.healthCheck?.timeout).toBe(10000);
      expect(result.healthCheck?.retries).toBe(5);
    });

    it('should apply healthCheck defaults correctly via schema', () => {
      const configWithoutHealthCheck = {
        pollInterval: 8000,
        autoStart: true,
        logLevel: 'debug',
      };

      const result = DaemonConfigSchema.parse(configWithoutHealthCheck);

      // Should use defaults for healthCheck when not specified
      expect(result.healthCheck).toBeUndefined(); // healthCheck is optional

      // But when healthCheck is provided without all fields, defaults should apply
      const configWithPartialHealthCheck = {
        pollInterval: 8000,
        healthCheck: {
          enabled: false,
        },
      };

      const resultWithPartial = DaemonConfigSchema.parse(configWithPartialHealthCheck);
      expect(resultWithPartial.healthCheck?.enabled).toBe(false);
      expect(resultWithPartial.healthCheck?.interval).toBe(30000); // Default
      expect(resultWithPartial.healthCheck?.timeout).toBe(5000); // Default
      expect(resultWithPartial.healthCheck?.retries).toBe(3); // Default
    });
  });

  describe('Integration scenarios', () => {
    it('should support creating comprehensive daemon health monitoring', () => {
      // Simulate a daemon that has been running with some activity
      const daemonStartTime = new Date('2023-10-15T08:00:00Z');
      const currentTime = new Date('2023-10-15T11:30:00Z');
      const uptime = currentTime.getTime() - daemonStartTime.getTime();

      const healthMetrics: HealthMetrics = {
        uptime,
        memoryUsage: {
          heapUsed: 67108864,   // 64 MB
          heapTotal: 134217728, // 128 MB
          rss: 201326592,       // 192 MB
        },
        taskCounts: {
          processed: 42,
          succeeded: 38,
          failed: 4,
          active: 2,
        },
        lastHealthCheck: currentTime,
        healthChecksPassed: 210, // 30-second intervals for 3.5 hours
        healthChecksFailed: 1,
        restartHistory: [
          {
            timestamp: new Date('2023-10-15T09:45:00Z'),
            reason: 'watchdog',
            exitCode: 143,
            triggeredByWatchdog: true,
          },
        ],
      };

      const daemonConfig: DaemonConfig = {
        pollInterval: 5000,
        autoStart: true,
        logLevel: 'info',
        healthCheck: {
          enabled: true,
          interval: 30000,
          timeout: 5000,
          retries: 3,
        },
        watchdog: {
          enabled: true,
          restartDelay: 5000,
          maxRestarts: 5,
          restartWindow: 300000,
        },
      };

      // Validate the comprehensive setup
      expect(healthMetrics.uptime).toBe(3.5 * 60 * 60 * 1000); // 3.5 hours
      expect(healthMetrics.taskCounts.processed).toBe(
        healthMetrics.taskCounts.succeeded + healthMetrics.taskCounts.failed
      );
      expect(healthMetrics.restartHistory).toHaveLength(1);
      expect(daemonConfig.healthCheck?.enabled).toBe(true);
      expect(daemonConfig.watchdog?.enabled).toBe(true);

      // This represents a realistic daemon monitoring scenario
      const healthCheckSuccess = 210 / (210 + 1); // ~99.5% success rate
      expect(healthCheckSuccess).toBeGreaterThan(0.99);
    });
  });
});