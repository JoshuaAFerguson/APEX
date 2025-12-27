import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DaemonConfig,
  DaemonConfigSchema,
  HealthMetrics,
  DaemonMemoryUsage,
  DaemonTaskCounts,
  RestartRecord,
} from '../types.js';

describe('HealthMetrics and DaemonConfig Integration', () => {
  let mockProcessMemoryUsage: () => NodeJS.MemoryUsage;

  beforeEach(() => {
    mockProcessMemoryUsage = vi.fn(() => ({
      rss: 4935680,
      heapTotal: 1826816,
      heapUsed: 650472,
      external: 49879,
      arrayBuffers: 9386,
    }));
  });

  describe('Health monitoring configuration validation', () => {
    it('should validate daemon config with health check settings', () => {
      const config = {
        pollInterval: 5000,
        autoStart: true,
        logLevel: 'info' as const,
        healthCheck: {
          enabled: true,
          interval: 30000,
          timeout: 5000,
          retries: 3,
        },
      };

      const validated = DaemonConfigSchema.parse(config);

      expect(validated.healthCheck?.enabled).toBe(true);
      expect(validated.healthCheck?.interval).toBe(30000);
      expect(validated.healthCheck?.timeout).toBe(5000);
      expect(validated.healthCheck?.retries).toBe(3);
    });

    it('should validate daemon config with watchdog settings', () => {
      const config = {
        pollInterval: 5000,
        autoStart: true,
        logLevel: 'warn' as const,
        watchdog: {
          enabled: true,
          restartDelay: 5000,
          maxRestarts: 5,
          restartWindow: 300000,
        },
      };

      const validated = DaemonConfigSchema.parse(config);

      expect(validated.watchdog?.enabled).toBe(true);
      expect(validated.watchdog?.restartDelay).toBe(5000);
      expect(validated.watchdog?.maxRestarts).toBe(5);
      expect(validated.watchdog?.restartWindow).toBe(300000);
    });

    it('should reject invalid health check configuration', () => {
      const invalidConfig = {
        pollInterval: 5000,
        healthCheck: {
          enabled: true,
          interval: -1000, // Invalid negative interval
          timeout: 5000,
          retries: 3,
        },
      };

      expect(() => DaemonConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject invalid watchdog configuration', () => {
      const invalidConfig = {
        pollInterval: 5000,
        watchdog: {
          enabled: true,
          restartDelay: 5000,
          maxRestarts: -1, // Invalid negative max restarts
          restartWindow: 300000,
        },
      };

      expect(() => DaemonConfigSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('Health metrics lifecycle simulation', () => {
    it('should simulate daemon startup with initial health metrics', () => {
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

      const startupTime = new Date();
      const memoryAtStartup = mockProcessMemoryUsage();

      const initialHealthMetrics: HealthMetrics = {
        uptime: 0,
        memoryUsage: {
          heapUsed: memoryAtStartup.heapUsed,
          heapTotal: memoryAtStartup.heapTotal,
          rss: memoryAtStartup.rss,
        },
        taskCounts: {
          processed: 0,
          succeeded: 0,
          failed: 0,
          active: 0,
        },
        lastHealthCheck: startupTime,
        healthChecksPassed: 0,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      expect(initialHealthMetrics.uptime).toBe(0);
      expect(initialHealthMetrics.taskCounts.processed).toBe(0);
      expect(initialHealthMetrics.healthChecksPassed).toBe(0);
      expect(initialHealthMetrics.restartHistory).toHaveLength(0);
      expect(daemonConfig.healthCheck?.enabled).toBe(true);
    });

    it('should simulate health check execution and metrics update', () => {
      const config: DaemonConfig = {
        pollInterval: 5000,
        healthCheck: {
          enabled: true,
          interval: 30000,
          timeout: 5000,
          retries: 3,
        },
      };

      let healthMetrics: HealthMetrics = {
        uptime: 60000, // 1 minute
        memoryUsage: {
          heapUsed: 50 * 1024 * 1024,
          heapTotal: 100 * 1024 * 1024,
          rss: 120 * 1024 * 1024,
        },
        taskCounts: {
          processed: 10,
          succeeded: 9,
          failed: 1,
          active: 2,
        },
        lastHealthCheck: new Date(Date.now() - 30000), // 30 seconds ago
        healthChecksPassed: 1,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      // Simulate health check execution
      const healthCheckResult = {
        success: true,
        timestamp: new Date(),
        memoryUsage: mockProcessMemoryUsage(),
      };

      if (healthCheckResult.success) {
        healthMetrics = {
          ...healthMetrics,
          uptime: healthMetrics.uptime + 30000,
          memoryUsage: {
            heapUsed: healthCheckResult.memoryUsage.heapUsed,
            heapTotal: healthCheckResult.memoryUsage.heapTotal,
            rss: healthCheckResult.memoryUsage.rss,
          },
          lastHealthCheck: healthCheckResult.timestamp,
          healthChecksPassed: healthMetrics.healthChecksPassed + 1,
        };
      }

      expect(healthMetrics.uptime).toBe(90000);
      expect(healthMetrics.healthChecksPassed).toBe(2);
      expect(healthMetrics.healthChecksFailed).toBe(0);
      expect(config.healthCheck?.interval).toBe(30000);
    });

    it('should simulate failed health check with retry logic', () => {
      const config: DaemonConfig = {
        pollInterval: 5000,
        healthCheck: {
          enabled: true,
          interval: 30000,
          timeout: 5000,
          retries: 3,
        },
      };

      let healthMetrics: HealthMetrics = {
        uptime: 120000, // 2 minutes
        memoryUsage: {
          heapUsed: 200 * 1024 * 1024, // High memory usage
          heapTotal: 250 * 1024 * 1024,
          rss: 300 * 1024 * 1024,
        },
        taskCounts: {
          processed: 50,
          succeeded: 40,
          failed: 5,
          active: 3,
        },
        lastHealthCheck: new Date(Date.now() - 60000), // 1 minute ago
        healthChecksPassed: 3,
        healthChecksFailed: 1,
        restartHistory: [],
      };

      // Simulate failed health check
      const healthCheckAttempts = Array.from({ length: config.healthCheck!.retries }, (_, i) => ({
        attempt: i + 1,
        success: false,
        error: 'Health check timeout',
      }));

      healthCheckAttempts.forEach(attempt => {
        if (!attempt.success) {
          healthMetrics = {
            ...healthMetrics,
            healthChecksFailed: healthMetrics.healthChecksFailed + 1,
            lastHealthCheck: new Date(),
          };
        }
      });

      expect(healthMetrics.healthChecksFailed).toBe(4); // 1 initial + 3 retries
      expect(healthMetrics.healthChecksPassed).toBe(3); // Unchanged
      expect(config.healthCheck?.retries).toBe(3);
    });

    it('should simulate watchdog-triggered restart', () => {
      const config: DaemonConfig = {
        pollInterval: 5000,
        watchdog: {
          enabled: true,
          restartDelay: 5000,
          maxRestarts: 5,
          restartWindow: 300000,
        },
      };

      let healthMetrics: HealthMetrics = {
        uptime: 300000, // 5 minutes
        memoryUsage: {
          heapUsed: 400 * 1024 * 1024, // Very high memory usage
          heapTotal: 450 * 1024 * 1024,
          rss: 500 * 1024 * 1024,
        },
        taskCounts: {
          processed: 100,
          succeeded: 70,
          failed: 25,
          active: 0, // Tasks have crashed
        },
        lastHealthCheck: new Date(Date.now() - 120000), // 2 minutes ago
        healthChecksPassed: 5,
        healthChecksFailed: 10,
        restartHistory: [],
      };

      // Simulate watchdog detecting unhealthy state and triggering restart
      const restartRecord: RestartRecord = {
        timestamp: new Date(),
        reason: 'oom',
        exitCode: 137,
        triggeredByWatchdog: true,
      };

      // After restart, daemon would reinitialize with fresh metrics
      const postRestartMetrics: HealthMetrics = {
        uptime: 0, // Reset after restart
        memoryUsage: {
          heapUsed: 25 * 1024 * 1024, // Fresh start
          heapTotal: 50 * 1024 * 1024,
          rss: 60 * 1024 * 1024,
        },
        taskCounts: {
          processed: 0, // Reset counters
          succeeded: 0,
          failed: 0,
          active: 0,
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: 0,
        healthChecksFailed: 0,
        restartHistory: [restartRecord], // Add restart record
      };

      expect(postRestartMetrics.uptime).toBe(0);
      expect(postRestartMetrics.restartHistory).toHaveLength(1);
      expect(postRestartMetrics.restartHistory[0].reason).toBe('oom');
      expect(postRestartMetrics.restartHistory[0].triggeredByWatchdog).toBe(true);
      expect(config.watchdog?.enabled).toBe(true);
      expect(config.watchdog?.maxRestarts).toBe(5);
    });
  });

  describe('Configuration-driven health monitoring scenarios', () => {
    it('should handle different health check intervals', () => {
      const fastHealthCheck: DaemonConfig = {
        pollInterval: 1000,
        healthCheck: {
          enabled: true,
          interval: 10000, // 10 seconds
          timeout: 2000,
          retries: 2,
        },
      };

      const slowHealthCheck: DaemonConfig = {
        pollInterval: 10000,
        healthCheck: {
          enabled: true,
          interval: 60000, // 1 minute
          timeout: 10000,
          retries: 5,
        },
      };

      // Simulate metrics over time for different configurations
      const baseTime = Date.now();
      const fastMetrics: HealthMetrics = {
        uptime: 60000, // 1 minute
        memoryUsage: { heapUsed: 50 * 1024 * 1024, heapTotal: 100 * 1024 * 1024, rss: 120 * 1024 * 1024 },
        taskCounts: { processed: 20, succeeded: 18, failed: 2, active: 1 },
        lastHealthCheck: new Date(baseTime),
        healthChecksPassed: 6, // 60s / 10s = 6 checks
        healthChecksFailed: 0,
        restartHistory: [],
      };

      const slowMetrics: HealthMetrics = {
        uptime: 60000, // 1 minute
        memoryUsage: { heapUsed: 50 * 1024 * 1024, heapTotal: 100 * 1024 * 1024, rss: 120 * 1024 * 1024 },
        taskCounts: { processed: 20, succeeded: 18, failed: 2, active: 1 },
        lastHealthCheck: new Date(baseTime),
        healthChecksPassed: 1, // 60s / 60s = 1 check
        healthChecksFailed: 0,
        restartHistory: [],
      };

      expect(fastHealthCheck.healthCheck?.interval).toBe(10000);
      expect(slowHealthCheck.healthCheck?.interval).toBe(60000);
      expect(fastMetrics.healthChecksPassed).toBeGreaterThan(slowMetrics.healthChecksPassed);
    });

    it('should handle watchdog configuration variations', () => {
      const aggressiveWatchdog: DaemonConfig = {
        pollInterval: 5000,
        watchdog: {
          enabled: true,
          restartDelay: 1000, // 1 second
          maxRestarts: 3,
          restartWindow: 60000, // 1 minute
        },
      };

      const conservativeWatchdog: DaemonConfig = {
        pollInterval: 5000,
        watchdog: {
          enabled: true,
          restartDelay: 30000, // 30 seconds
          maxRestarts: 10,
          restartWindow: 3600000, // 1 hour
        },
      };

      // Simulate multiple restarts under aggressive watchdog
      const aggressiveRestarts: RestartRecord[] = [
        {
          timestamp: new Date(Date.now() - 45000),
          reason: 'crash',
          exitCode: 1,
          triggeredByWatchdog: true,
        },
        {
          timestamp: new Date(Date.now() - 30000),
          reason: 'crash',
          exitCode: 1,
          triggeredByWatchdog: true,
        },
        {
          timestamp: new Date(Date.now() - 15000),
          reason: 'crash',
          exitCode: 1,
          triggeredByWatchdog: true,
        },
      ];

      const conservativeRestarts: RestartRecord[] = [
        {
          timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
          reason: 'manual',
          triggeredByWatchdog: false,
        },
      ];

      const aggressiveMetrics: HealthMetrics = {
        uptime: 15000, // Recently restarted
        memoryUsage: { heapUsed: 30 * 1024 * 1024, heapTotal: 60 * 1024 * 1024, rss: 80 * 1024 * 1024 },
        taskCounts: { processed: 5, succeeded: 3, failed: 2, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 1,
        healthChecksFailed: 0,
        restartHistory: aggressiveRestarts,
      };

      const conservativeMetrics: HealthMetrics = {
        uptime: 1800000, // 30 minutes
        memoryUsage: { heapUsed: 100 * 1024 * 1024, heapTotal: 200 * 1024 * 1024, rss: 250 * 1024 * 1024 },
        taskCounts: { processed: 500, succeeded: 480, failed: 15, active: 3 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 60,
        healthChecksFailed: 2,
        restartHistory: conservativeRestarts,
      };

      expect(aggressiveWatchdog.watchdog?.maxRestarts).toBe(3);
      expect(conservativeWatchdog.watchdog?.maxRestarts).toBe(10);
      expect(aggressiveMetrics.restartHistory).toHaveLength(3);
      expect(conservativeMetrics.restartHistory).toHaveLength(1);
      expect(aggressiveMetrics.uptime).toBeLessThan(conservativeMetrics.uptime);
    });

    it('should handle disabled health monitoring', () => {
      const disabledHealthCheck: DaemonConfig = {
        pollInterval: 5000,
        healthCheck: {
          enabled: false,
          interval: 30000,
          timeout: 5000,
          retries: 3,
        },
        watchdog: {
          enabled: false,
          restartDelay: 5000,
          maxRestarts: 5,
          restartWindow: 300000,
        },
      };

      // With disabled health monitoring, metrics might be updated less frequently
      const metricsWithDisabledMonitoring: HealthMetrics = {
        uptime: 3600000, // 1 hour - longer uptime without restarts
        memoryUsage: { heapUsed: 150 * 1024 * 1024, heapTotal: 300 * 1024 * 1024, rss: 400 * 1024 * 1024 },
        taskCounts: { processed: 1000, succeeded: 950, failed: 40, active: 5 },
        lastHealthCheck: new Date(Date.now() - 3600000), // Last check 1 hour ago
        healthChecksPassed: 1, // Only manual/startup check
        healthChecksFailed: 0,
        restartHistory: [],
      };

      expect(disabledHealthCheck.healthCheck?.enabled).toBe(false);
      expect(disabledHealthCheck.watchdog?.enabled).toBe(false);
      expect(metricsWithDisabledMonitoring.healthChecksPassed).toBe(1);
      expect(metricsWithDisabledMonitoring.restartHistory).toHaveLength(0);
    });
  });

  describe('Real-world health monitoring scenarios', () => {
    it('should simulate production daemon with mixed health states', () => {
      const productionConfig: DaemonConfig = {
        pollInterval: 5000,
        autoStart: true,
        logLevel: 'warn',
        healthCheck: {
          enabled: true,
          interval: 60000, // 1 minute
          timeout: 10000, // 10 seconds
          retries: 3,
        },
        watchdog: {
          enabled: true,
          restartDelay: 10000, // 10 seconds
          maxRestarts: 5,
          restartWindow: 3600000, // 1 hour
        },
      };

      const productionMetrics: HealthMetrics = {
        uptime: 86400000, // 24 hours
        memoryUsage: {
          heapUsed: 200 * 1024 * 1024,
          heapTotal: 400 * 1024 * 1024,
          rss: 500 * 1024 * 1024,
        },
        taskCounts: {
          processed: 10000,
          succeeded: 9500,
          failed: 450,
          active: 8,
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: 1440, // 24 hours * 60 minutes
        healthChecksFailed: 15,
        restartHistory: [
          {
            timestamp: new Date(Date.now() - 43200000), // 12 hours ago
            reason: 'manual',
            triggeredByWatchdog: false,
          },
          {
            timestamp: new Date(Date.now() - 86400000 * 2), // 2 days ago
            reason: 'oom',
            exitCode: 137,
            triggeredByWatchdog: true,
          },
        ],
      };

      // Calculate health metrics
      const successRate = productionMetrics.taskCounts.succeeded / productionMetrics.taskCounts.processed;
      const healthCheckSuccessRate = productionMetrics.healthChecksPassed /
        (productionMetrics.healthChecksPassed + productionMetrics.healthChecksFailed);
      const averageRestartInterval = productionConfig.watchdog?.restartWindow! /
        (productionMetrics.restartHistory.length || 1);

      expect(successRate).toBeGreaterThan(0.9); // > 90% success rate
      expect(healthCheckSuccessRate).toBeGreaterThan(0.98); // > 98% health check success
      expect(productionMetrics.uptime).toBe(86400000);
      expect(averageRestartInterval).toBeGreaterThan(productionConfig.watchdog?.restartWindow! / 5);
    });
  });
});