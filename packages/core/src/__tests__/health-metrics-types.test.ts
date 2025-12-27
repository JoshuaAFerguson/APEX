import { describe, it, expect } from 'vitest';
import {
  DaemonConfig,
  DaemonConfigSchema,
  HealthMetrics,
  DaemonMemoryUsage,
  DaemonTaskCounts,
  RestartRecord,
} from '../types.js';

describe('HealthMetrics Types and DaemonConfig Integration', () => {
  describe('DaemonMemoryUsage interface', () => {
    it('should define correct memory usage structure', () => {
      const memoryUsage: DaemonMemoryUsage = {
        heapUsed: 50 * 1024 * 1024, // 50MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        rss: 120 * 1024 * 1024, // 120MB
      };

      expect(memoryUsage.heapUsed).toBe(52428800);
      expect(memoryUsage.heapTotal).toBe(104857600);
      expect(memoryUsage.rss).toBe(125829120);
      expect(typeof memoryUsage.heapUsed).toBe('number');
      expect(typeof memoryUsage.heapTotal).toBe('number');
      expect(typeof memoryUsage.rss).toBe('number');
    });

    it('should allow zero values for memory usage', () => {
      const emptyMemory: DaemonMemoryUsage = {
        heapUsed: 0,
        heapTotal: 0,
        rss: 0,
      };

      expect(emptyMemory.heapUsed).toBe(0);
      expect(emptyMemory.heapTotal).toBe(0);
      expect(emptyMemory.rss).toBe(0);
    });

    it('should work with Node.js process.memoryUsage() output', () => {
      // Mock Node.js memory usage structure
      const nodeMemoryUsage = {
        rss: 4935680,
        heapTotal: 1826816,
        heapUsed: 650472,
        external: 49879,
        arrayBuffers: 9386,
      };

      // Extract only the fields we need
      const daemonMemory: DaemonMemoryUsage = {
        heapUsed: nodeMemoryUsage.heapUsed,
        heapTotal: nodeMemoryUsage.heapTotal,
        rss: nodeMemoryUsage.rss,
      };

      expect(daemonMemory.heapUsed).toBe(650472);
      expect(daemonMemory.heapTotal).toBe(1826816);
      expect(daemonMemory.rss).toBe(4935680);
    });
  });

  describe('DaemonTaskCounts interface', () => {
    it('should define correct task counting structure', () => {
      const taskCounts: DaemonTaskCounts = {
        processed: 100,
        succeeded: 85,
        failed: 10,
        active: 5,
      };

      expect(taskCounts.processed).toBe(100);
      expect(taskCounts.succeeded).toBe(85);
      expect(taskCounts.failed).toBe(10);
      expect(taskCounts.active).toBe(5);
      expect(taskCounts.succeeded + taskCounts.failed).toBeLessThanOrEqual(taskCounts.processed);
    });

    it('should allow zero values for task counts', () => {
      const zeroCounts: DaemonTaskCounts = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        active: 0,
      };

      expect(zeroCounts.processed).toBe(0);
      expect(zeroCounts.succeeded).toBe(0);
      expect(zeroCounts.failed).toBe(0);
      expect(zeroCounts.active).toBe(0);
    });

    it('should support realistic task counting scenarios', () => {
      const activeDaemon: DaemonTaskCounts = {
        processed: 1000,
        succeeded: 950,
        failed: 45,
        active: 3,
      };

      expect(activeDaemon.processed).toBeGreaterThan(activeDaemon.succeeded + activeDaemon.failed);
      expect(activeDaemon.active).toBeGreaterThan(0);

      const idleDaemon: DaemonTaskCounts = {
        processed: 500,
        succeeded: 480,
        failed: 20,
        active: 0,
      };

      expect(idleDaemon.active).toBe(0);
      expect(idleDaemon.succeeded + idleDaemon.failed).toBe(idleDaemon.processed);
    });
  });

  describe('RestartRecord interface', () => {
    it('should define correct restart record structure', () => {
      const restartRecord: RestartRecord = {
        timestamp: new Date('2023-10-15T14:30:00Z'),
        reason: 'crash',
        exitCode: 1,
        triggeredByWatchdog: false,
      };

      expect(restartRecord.timestamp).toBeInstanceOf(Date);
      expect(restartRecord.reason).toBe('crash');
      expect(restartRecord.exitCode).toBe(1);
      expect(restartRecord.triggeredByWatchdog).toBe(false);
    });

    it('should support different restart reasons', () => {
      const crashRestart: RestartRecord = {
        timestamp: new Date(),
        reason: 'crash',
        exitCode: 1,
        triggeredByWatchdog: false,
      };

      const oomRestart: RestartRecord = {
        timestamp: new Date(),
        reason: 'oom',
        exitCode: 137,
        triggeredByWatchdog: true,
      };

      const manualRestart: RestartRecord = {
        timestamp: new Date(),
        reason: 'manual',
        triggeredByWatchdog: false,
      };

      const watchdogRestart: RestartRecord = {
        timestamp: new Date(),
        reason: 'watchdog',
        exitCode: 0,
        triggeredByWatchdog: true,
      };

      expect(crashRestart.reason).toBe('crash');
      expect(oomRestart.reason).toBe('oom');
      expect(manualRestart.reason).toBe('manual');
      expect(watchdogRestart.reason).toBe('watchdog');

      expect(manualRestart.exitCode).toBeUndefined();
      expect(oomRestart.exitCode).toBe(137);
      expect(watchdogRestart.triggeredByWatchdog).toBe(true);
    });
  });

  describe('HealthMetrics interface', () => {
    it('should define complete health metrics structure', () => {
      const healthMetrics: HealthMetrics = {
        uptime: 3600000, // 1 hour
        memoryUsage: {
          heapUsed: 50 * 1024 * 1024,
          heapTotal: 100 * 1024 * 1024,
          rss: 120 * 1024 * 1024,
        },
        taskCounts: {
          processed: 100,
          succeeded: 85,
          failed: 10,
          active: 5,
        },
        lastHealthCheck: new Date('2023-10-15T14:30:00Z'),
        healthChecksPassed: 120,
        healthChecksFailed: 3,
        restartHistory: [
          {
            timestamp: new Date('2023-10-15T12:00:00Z'),
            reason: 'oom',
            exitCode: 137,
            triggeredByWatchdog: true,
          },
          {
            timestamp: new Date('2023-10-14T09:15:00Z'),
            reason: 'manual',
            triggeredByWatchdog: false,
          },
        ],
      };

      expect(healthMetrics.uptime).toBe(3600000);
      expect(healthMetrics.memoryUsage.heapUsed).toBe(52428800);
      expect(healthMetrics.taskCounts.processed).toBe(100);
      expect(healthMetrics.lastHealthCheck).toBeInstanceOf(Date);
      expect(healthMetrics.healthChecksPassed).toBe(120);
      expect(healthMetrics.healthChecksFailed).toBe(3);
      expect(healthMetrics.restartHistory).toHaveLength(2);
      expect(healthMetrics.restartHistory[0].reason).toBe('oom');
      expect(healthMetrics.restartHistory[1].reason).toBe('manual');
    });

    it('should support empty restart history', () => {
      const newDaemonMetrics: HealthMetrics = {
        uptime: 30000, // 30 seconds
        memoryUsage: {
          heapUsed: 25 * 1024 * 1024,
          heapTotal: 50 * 1024 * 1024,
          rss: 60 * 1024 * 1024,
        },
        taskCounts: {
          processed: 0,
          succeeded: 0,
          failed: 0,
          active: 0,
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: 1,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      expect(newDaemonMetrics.uptime).toBe(30000);
      expect(newDaemonMetrics.taskCounts.processed).toBe(0);
      expect(newDaemonMetrics.healthChecksPassed).toBe(1);
      expect(newDaemonMetrics.healthChecksFailed).toBe(0);
      expect(newDaemonMetrics.restartHistory).toHaveLength(0);
    });

    it('should support monitoring scenarios', () => {
      const healthyDaemon: HealthMetrics = {
        uptime: 86400000, // 24 hours
        memoryUsage: {
          heapUsed: 75 * 1024 * 1024,
          heapTotal: 150 * 1024 * 1024,
          rss: 180 * 1024 * 1024,
        },
        taskCounts: {
          processed: 2000,
          succeeded: 1950,
          failed: 45,
          active: 2,
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: 2880, // Every 30 seconds for 24 hours
        healthChecksFailed: 5,
        restartHistory: [],
      };

      const unhealthyDaemon: HealthMetrics = {
        uptime: 300000, // 5 minutes - recently restarted
        memoryUsage: {
          heapUsed: 400 * 1024 * 1024, // High memory usage
          heapTotal: 450 * 1024 * 1024,
          rss: 500 * 1024 * 1024,
        },
        taskCounts: {
          processed: 50,
          succeeded: 30,
          failed: 15,
          active: 0,
        },
        lastHealthCheck: new Date(Date.now() - 120000), // 2 minutes ago
        healthChecksPassed: 5,
        healthChecksFailed: 15,
        restartHistory: [
          {
            timestamp: new Date(Date.now() - 300000),
            reason: 'crash',
            exitCode: 1,
            triggeredByWatchdog: true,
          },
          {
            timestamp: new Date(Date.now() - 600000),
            reason: 'oom',
            exitCode: 137,
            triggeredByWatchdog: true,
          },
        ],
      };

      expect(healthyDaemon.uptime).toBeGreaterThan(unhealthyDaemon.uptime);
      expect(healthyDaemon.healthChecksPassed).toBeGreaterThan(healthyDaemon.healthChecksFailed);
      expect(unhealthyDaemon.healthChecksFailed).toBeGreaterThan(unhealthyDaemon.healthChecksPassed);
      expect(healthyDaemon.restartHistory).toHaveLength(0);
      expect(unhealthyDaemon.restartHistory).toHaveLength(2);
    });
  });

  describe('DaemonConfig integration with health monitoring', () => {
    it('should validate DaemonConfig with health check configuration', () => {
      const configWithHealthCheck = {
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

      const result = DaemonConfigSchema.parse(configWithHealthCheck);

      expect(result.healthCheck?.enabled).toBe(true);
      expect(result.healthCheck?.interval).toBe(30000);
      expect(result.healthCheck?.timeout).toBe(5000);
      expect(result.healthCheck?.retries).toBe(3);
    });

    it('should validate DaemonConfig with watchdog configuration', () => {
      const configWithWatchdog = {
        pollInterval: 5000,
        autoStart: true,
        logLevel: 'info',
        watchdog: {
          enabled: true,
          restartDelay: 5000,
          maxRestarts: 5,
          restartWindow: 300000,
        },
      };

      const result = DaemonConfigSchema.parse(configWithWatchdog);

      expect(result.watchdog?.enabled).toBe(true);
      expect(result.watchdog?.restartDelay).toBe(5000);
      expect(result.watchdog?.maxRestarts).toBe(5);
      expect(result.watchdog?.restartWindow).toBe(300000);
    });

    it('should apply defaults for health check configuration', () => {
      const minimalConfig = {
        pollInterval: 10000,
      };

      const result = DaemonConfigSchema.parse(minimalConfig);

      expect(result.healthCheck?.enabled).toBe(true);
      expect(result.healthCheck?.interval).toBe(30000);
      expect(result.healthCheck?.timeout).toBe(5000);
      expect(result.healthCheck?.retries).toBe(3);
    });

    it('should apply defaults for watchdog configuration', () => {
      const minimalConfig = {
        autoStart: false,
      };

      const result = DaemonConfigSchema.parse(minimalConfig);

      expect(result.watchdog?.enabled).toBe(true);
      expect(result.watchdog?.restartDelay).toBe(5000);
      expect(result.watchdog?.maxRestarts).toBe(5);
      expect(result.watchdog?.restartWindow).toBe(300000);
    });

    it('should support complete DaemonConfig with health monitoring features', () => {
      const fullDaemonConfig: DaemonConfig = {
        pollInterval: 8000,
        autoStart: true,
        logLevel: 'debug',
        installAsService: false,
        serviceName: 'test-apex-daemon',
        service: {
          enableOnBoot: false,
        },
        healthCheck: {
          enabled: true,
          interval: 15000,
          timeout: 3000,
          retries: 5,
        },
        watchdog: {
          enabled: true,
          restartDelay: 3000,
          maxRestarts: 3,
          restartWindow: 180000,
        },
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
          dayModeCapacityThreshold: 0.80,
          nightModeCapacityThreshold: 0.95,
        },
        sessionRecovery: {
          enabled: true,
          autoResume: true,
          checkpointInterval: 30000,
          contextSummarizationThreshold: 40,
          maxResumeAttempts: 5,
          contextWindowThreshold: 0.75,
        },
        idleProcessing: {
          enabled: false,
          idleThreshold: 600000,
          taskGenerationInterval: 1800000,
          maxIdleTasks: 2,
        },
        orphanDetection: {
          enabled: true,
          stalenessThreshold: 1800000,
          recoveryPolicy: 'retry',
          periodicCheck: true,
          periodicCheckInterval: 600000,
        },
      };

      expect(fullDaemonConfig.healthCheck?.enabled).toBe(true);
      expect(fullDaemonConfig.healthCheck?.interval).toBe(15000);
      expect(fullDaemonConfig.watchdog?.enabled).toBe(true);
      expect(fullDaemonConfig.watchdog?.maxRestarts).toBe(3);
      expect(fullDaemonConfig.sessionRecovery?.enabled).toBe(true);
      expect(fullDaemonConfig.orphanDetection?.enabled).toBe(true);

      // Validate with schema
      const result = DaemonConfigSchema.parse(fullDaemonConfig);
      expect(result).toEqual(fullDaemonConfig);
    });
  });

  describe('Type exports and usage', () => {
    it('should export HealthMetrics type for external usage', () => {
      // Test that HealthMetrics can be used as a type annotation
      const createHealthMetrics = (): HealthMetrics => ({
        uptime: 1000,
        memoryUsage: {
          heapUsed: 1024,
          heapTotal: 2048,
          rss: 3072,
        },
        taskCounts: {
          processed: 1,
          succeeded: 1,
          failed: 0,
          active: 0,
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: 1,
        healthChecksFailed: 0,
        restartHistory: [],
      });

      const metrics = createHealthMetrics();
      expect(metrics.uptime).toBe(1000);
      expect(metrics.memoryUsage.heapUsed).toBe(1024);
    });

    it('should export DaemonMemoryUsage, DaemonTaskCounts, and RestartRecord types', () => {
      const memory: DaemonMemoryUsage = {
        heapUsed: 1024,
        heapTotal: 2048,
        rss: 3072,
      };

      const taskCounts: DaemonTaskCounts = {
        processed: 10,
        succeeded: 8,
        failed: 2,
        active: 0,
      };

      const restartRecord: RestartRecord = {
        timestamp: new Date(),
        reason: 'test',
        triggeredByWatchdog: false,
      };

      expect(memory.heapUsed).toBe(1024);
      expect(taskCounts.processed).toBe(10);
      expect(restartRecord.reason).toBe('test');
    });

    it('should support partial types for health metrics updates', () => {
      const baseMetrics: HealthMetrics = {
        uptime: 1000,
        memoryUsage: {
          heapUsed: 1024,
          heapTotal: 2048,
          rss: 3072,
        },
        taskCounts: {
          processed: 10,
          succeeded: 8,
          failed: 2,
          active: 0,
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: 5,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      const memoryUpdate: Partial<DaemonMemoryUsage> = {
        heapUsed: 2048,
      };

      const taskUpdate: Partial<DaemonTaskCounts> = {
        processed: 11,
        succeeded: 9,
        active: 1,
      };

      const updatedMetrics: HealthMetrics = {
        ...baseMetrics,
        memoryUsage: {
          ...baseMetrics.memoryUsage,
          ...memoryUpdate,
        },
        taskCounts: {
          ...baseMetrics.taskCounts,
          ...taskUpdate,
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: baseMetrics.healthChecksPassed + 1,
      };

      expect(updatedMetrics.memoryUsage.heapUsed).toBe(2048);
      expect(updatedMetrics.memoryUsage.heapTotal).toBe(2048); // unchanged
      expect(updatedMetrics.taskCounts.processed).toBe(11);
      expect(updatedMetrics.taskCounts.succeeded).toBe(9);
      expect(updatedMetrics.taskCounts.active).toBe(1);
      expect(updatedMetrics.healthChecksPassed).toBe(6);
    });
  });

  describe('Edge cases and error conditions', () => {
    it('should handle large numbers for memory usage', () => {
      const largeMemory: DaemonMemoryUsage = {
        heapUsed: Number.MAX_SAFE_INTEGER,
        heapTotal: Number.MAX_SAFE_INTEGER,
        rss: Number.MAX_SAFE_INTEGER,
      };

      expect(largeMemory.heapUsed).toBe(Number.MAX_SAFE_INTEGER);
      expect(largeMemory.heapTotal).toBe(Number.MAX_SAFE_INTEGER);
      expect(largeMemory.rss).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle large numbers for task counts', () => {
      const largeCounts: DaemonTaskCounts = {
        processed: Number.MAX_SAFE_INTEGER,
        succeeded: Number.MAX_SAFE_INTEGER - 1000,
        failed: 500,
        active: 100,
      };

      expect(largeCounts.processed).toBe(Number.MAX_SAFE_INTEGER);
      expect(largeCounts.succeeded).toBe(Number.MAX_SAFE_INTEGER - 1000);
    });

    it('should handle very large restart history arrays', () => {
      const manyRestarts: RestartRecord[] = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 60000),
        reason: i % 2 === 0 ? 'crash' : 'oom',
        exitCode: i % 2 === 0 ? 1 : 137,
        triggeredByWatchdog: i % 3 === 0,
      }));

      const metrics: HealthMetrics = {
        uptime: 86400000,
        memoryUsage: {
          heapUsed: 100 * 1024 * 1024,
          heapTotal: 200 * 1024 * 1024,
          rss: 250 * 1024 * 1024,
        },
        taskCounts: {
          processed: 5000,
          succeeded: 4000,
          failed: 1000,
          active: 0,
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: 100,
        healthChecksFailed: 900,
        restartHistory: manyRestarts,
      };

      expect(metrics.restartHistory).toHaveLength(1000);
      expect(metrics.restartHistory[0].reason).toBe('crash');
      expect(metrics.restartHistory[999].reason).toBe('oom');
    });

    it('should handle edge cases for health check timing', () => {
      const oldHealthCheck = new Date(Date.now() - 3600000); // 1 hour ago

      const staleMetrics: HealthMetrics = {
        uptime: 7200000, // 2 hours
        memoryUsage: {
          heapUsed: 50 * 1024 * 1024,
          heapTotal: 100 * 1024 * 1024,
          rss: 120 * 1024 * 1024,
        },
        taskCounts: {
          processed: 100,
          succeeded: 80,
          failed: 15,
          active: 5,
        },
        lastHealthCheck: oldHealthCheck,
        healthChecksPassed: 240, // Should be more for 2 hours
        healthChecksFailed: 0,
        restartHistory: [],
      };

      const timeSinceHealthCheck = Date.now() - staleMetrics.lastHealthCheck.getTime();
      expect(timeSinceHealthCheck).toBeGreaterThan(3000000); // More than 50 minutes
      expect(staleMetrics.uptime).toBeGreaterThan(timeSinceHealthCheck);
    });
  });
});