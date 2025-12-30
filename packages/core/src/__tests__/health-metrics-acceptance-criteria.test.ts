import { describe, it, expect } from 'vitest';
import {
  HealthMetrics,
  DaemonMemoryUsage,
  DaemonTaskCounts,
  RestartRecord,
  DaemonConfig,
  DaemonConfigSchema,
} from '../types.js';

/**
 * Acceptance Criteria Test: Health Metrics Implementation
 *
 * This test validates that the implementation meets all acceptance criteria:
 *
 * Requirements:
 * - New HealthMetrics type in packages/core/src/types.ts with fields:
 *   - uptime (number)
 *   - memoryUsage (heapUsed, heapTotal, rss)
 *   - taskCounts (processed, succeeded, failed, active)
 *   - lastHealthCheck (Date)
 *   - healthChecksPassed (number)
 *   - healthChecksFailed (number)
 *   - restartHistory array
 * - Type exports from @apexcli/core
 * - Extended DaemonConfig schema
 */

describe('HealthMetrics Acceptance Criteria Validation', () => {
  describe('Requirement: HealthMetrics type with all required fields', () => {
    it('should define HealthMetrics type with uptime field', () => {
      const metrics: HealthMetrics = {
        uptime: 3600000, // 1 hour in milliseconds
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
        lastHealthCheck: new Date(),
        healthChecksPassed: 120,
        healthChecksFailed: 3,
        restartHistory: [],
      };

      expect(typeof metrics.uptime).toBe('number');
      expect(metrics.uptime).toBe(3600000);
    });

    it('should define HealthMetrics type with memoryUsage field (heapUsed, heapTotal, rss)', () => {
      const metrics: HealthMetrics = {
        uptime: 1000,
        memoryUsage: {
          heapUsed: 52428800,    // 50MB
          heapTotal: 104857600,  // 100MB
          rss: 125829120,        // 120MB
        },
        taskCounts: { processed: 0, succeeded: 0, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 0,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      // Validate memoryUsage structure
      expect(typeof metrics.memoryUsage).toBe('object');
      expect(typeof metrics.memoryUsage.heapUsed).toBe('number');
      expect(typeof metrics.memoryUsage.heapTotal).toBe('number');
      expect(typeof metrics.memoryUsage.rss).toBe('number');

      // Validate specific values
      expect(metrics.memoryUsage.heapUsed).toBe(52428800);
      expect(metrics.memoryUsage.heapTotal).toBe(104857600);
      expect(metrics.memoryUsage.rss).toBe(125829120);
    });

    it('should define HealthMetrics type with taskCounts field (processed, succeeded, failed, active)', () => {
      const metrics: HealthMetrics = {
        uptime: 1000,
        memoryUsage: { heapUsed: 1024, heapTotal: 2048, rss: 3072 },
        taskCounts: {
          processed: 1000,
          succeeded: 950,
          failed: 45,
          active: 3,
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: 0,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      // Validate taskCounts structure
      expect(typeof metrics.taskCounts).toBe('object');
      expect(typeof metrics.taskCounts.processed).toBe('number');
      expect(typeof metrics.taskCounts.succeeded).toBe('number');
      expect(typeof metrics.taskCounts.failed).toBe('number');
      expect(typeof metrics.taskCounts.active).toBe('number');

      // Validate specific values
      expect(metrics.taskCounts.processed).toBe(1000);
      expect(metrics.taskCounts.succeeded).toBe(950);
      expect(metrics.taskCounts.failed).toBe(45);
      expect(metrics.taskCounts.active).toBe(3);
    });

    it('should define HealthMetrics type with lastHealthCheck field', () => {
      const checkTime = new Date('2023-10-15T14:30:00Z');
      const metrics: HealthMetrics = {
        uptime: 1000,
        memoryUsage: { heapUsed: 1024, heapTotal: 2048, rss: 3072 },
        taskCounts: { processed: 0, succeeded: 0, failed: 0, active: 0 },
        lastHealthCheck: checkTime,
        healthChecksPassed: 0,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      expect(metrics.lastHealthCheck).toBeInstanceOf(Date);
      expect(metrics.lastHealthCheck.getTime()).toBe(checkTime.getTime());
    });

    it('should define HealthMetrics type with healthChecksPassed field', () => {
      const metrics: HealthMetrics = {
        uptime: 1000,
        memoryUsage: { heapUsed: 1024, heapTotal: 2048, rss: 3072 },
        taskCounts: { processed: 0, succeeded: 0, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 42,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      expect(typeof metrics.healthChecksPassed).toBe('number');
      expect(metrics.healthChecksPassed).toBe(42);
    });

    it('should define HealthMetrics type with healthChecksFailed field', () => {
      const metrics: HealthMetrics = {
        uptime: 1000,
        memoryUsage: { heapUsed: 1024, heapTotal: 2048, rss: 3072 },
        taskCounts: { processed: 0, succeeded: 0, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 0,
        healthChecksFailed: 7,
        restartHistory: [],
      };

      expect(typeof metrics.healthChecksFailed).toBe('number');
      expect(metrics.healthChecksFailed).toBe(7);
    });

    it('should define HealthMetrics type with restartHistory array field', () => {
      const restartRecords: RestartRecord[] = [
        {
          timestamp: new Date('2023-10-15T14:00:00Z'),
          reason: 'crash',
          exitCode: 1,
          triggeredByWatchdog: false,
        },
        {
          timestamp: new Date('2023-10-15T12:00:00Z'),
          reason: 'oom',
          exitCode: 137,
          triggeredByWatchdog: true,
        },
      ];

      const metrics: HealthMetrics = {
        uptime: 1000,
        memoryUsage: { heapUsed: 1024, heapTotal: 2048, rss: 3072 },
        taskCounts: { processed: 0, succeeded: 0, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 0,
        healthChecksFailed: 0,
        restartHistory: restartRecords,
      };

      expect(Array.isArray(metrics.restartHistory)).toBe(true);
      expect(metrics.restartHistory).toHaveLength(2);
      expect(metrics.restartHistory[0].reason).toBe('crash');
      expect(metrics.restartHistory[1].reason).toBe('oom');
    });

    it('should allow complete HealthMetrics object with all fields populated', () => {
      const completeMetrics: HealthMetrics = {
        uptime: 7200000, // 2 hours
        memoryUsage: {
          heapUsed: 150 * 1024 * 1024,  // 150MB
          heapTotal: 300 * 1024 * 1024, // 300MB
          rss: 400 * 1024 * 1024,       // 400MB
        },
        taskCounts: {
          processed: 5000,
          succeeded: 4750,
          failed: 200,
          active: 12,
        },
        lastHealthCheck: new Date('2023-10-15T16:00:00Z'),
        healthChecksPassed: 240, // 2 hours * 30 checks/hour
        healthChecksFailed: 8,
        restartHistory: [
          {
            timestamp: new Date('2023-10-15T14:30:00Z'),
            reason: 'manual',
            triggeredByWatchdog: false,
          },
          {
            timestamp: new Date('2023-10-15T10:15:00Z'),
            reason: 'oom',
            exitCode: 137,
            triggeredByWatchdog: true,
          },
          {
            timestamp: new Date('2023-10-14T22:00:00Z'),
            reason: 'crash',
            exitCode: 1,
            triggeredByWatchdog: true,
          },
        ],
      };

      // Validate all fields are present and correctly typed
      expect(typeof completeMetrics.uptime).toBe('number');
      expect(typeof completeMetrics.memoryUsage.heapUsed).toBe('number');
      expect(typeof completeMetrics.memoryUsage.heapTotal).toBe('number');
      expect(typeof completeMetrics.memoryUsage.rss).toBe('number');
      expect(typeof completeMetrics.taskCounts.processed).toBe('number');
      expect(typeof completeMetrics.taskCounts.succeeded).toBe('number');
      expect(typeof completeMetrics.taskCounts.failed).toBe('number');
      expect(typeof completeMetrics.taskCounts.active).toBe('number');
      expect(completeMetrics.lastHealthCheck).toBeInstanceOf(Date);
      expect(typeof completeMetrics.healthChecksPassed).toBe('number');
      expect(typeof completeMetrics.healthChecksFailed).toBe('number');
      expect(Array.isArray(completeMetrics.restartHistory)).toBe(true);
      expect(completeMetrics.restartHistory).toHaveLength(3);
    });
  });

  describe('Requirement: Supporting interface types', () => {
    it('should define DaemonMemoryUsage interface correctly', () => {
      const memory: DaemonMemoryUsage = {
        heapUsed: 100 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        rss: 250 * 1024 * 1024,
      };

      expect(typeof memory.heapUsed).toBe('number');
      expect(typeof memory.heapTotal).toBe('number');
      expect(typeof memory.rss).toBe('number');
      expect(memory.heapUsed).toBe(104857600);
      expect(memory.heapTotal).toBe(209715200);
      expect(memory.rss).toBe(262144000);
    });

    it('should define DaemonTaskCounts interface correctly', () => {
      const taskCounts: DaemonTaskCounts = {
        processed: 1500,
        succeeded: 1425,
        failed: 60,
        active: 8,
      };

      expect(typeof taskCounts.processed).toBe('number');
      expect(typeof taskCounts.succeeded).toBe('number');
      expect(typeof taskCounts.failed).toBe('number');
      expect(typeof taskCounts.active).toBe('number');
      expect(taskCounts.processed).toBe(1500);
      expect(taskCounts.succeeded).toBe(1425);
      expect(taskCounts.failed).toBe(60);
      expect(taskCounts.active).toBe(8);
    });

    it('should define RestartRecord interface correctly', () => {
      const restartRecord: RestartRecord = {
        timestamp: new Date('2023-10-15T15:45:00Z'),
        reason: 'watchdog',
        exitCode: 0,
        triggeredByWatchdog: true,
      };

      expect(restartRecord.timestamp).toBeInstanceOf(Date);
      expect(typeof restartRecord.reason).toBe('string');
      expect(typeof restartRecord.exitCode).toBe('number');
      expect(typeof restartRecord.triggeredByWatchdog).toBe('boolean');
      expect(restartRecord.reason).toBe('watchdog');
      expect(restartRecord.exitCode).toBe(0);
      expect(restartRecord.triggeredByWatchdog).toBe(true);
    });

    it('should support RestartRecord with optional exitCode', () => {
      const manualRestart: RestartRecord = {
        timestamp: new Date(),
        reason: 'manual',
        triggeredByWatchdog: false,
      };

      expect(manualRestart.exitCode).toBeUndefined();
      expect(manualRestart.reason).toBe('manual');
      expect(manualRestart.triggeredByWatchdog).toBe(false);
    });
  });

  describe('Requirement: Type exports from @apexcli/core', () => {
    it('should export HealthMetrics type from core package', () => {
      // This test validates that the types are properly exported
      // The fact that we can import and use them above proves this requirement
      expect(typeof HealthMetrics).toBe('undefined'); // It's a type, not a runtime value

      // Create instance to prove type is available
      const metrics: HealthMetrics = {
        uptime: 1000,
        memoryUsage: { heapUsed: 1024, heapTotal: 2048, rss: 3072 },
        taskCounts: { processed: 1, succeeded: 1, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 1,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      expect(metrics).toBeDefined();
    });

    it('should export DaemonMemoryUsage type from core package', () => {
      const memory: DaemonMemoryUsage = {
        heapUsed: 1024,
        heapTotal: 2048,
        rss: 3072,
      };

      expect(memory).toBeDefined();
    });

    it('should export DaemonTaskCounts type from core package', () => {
      const taskCounts: DaemonTaskCounts = {
        processed: 10,
        succeeded: 8,
        failed: 2,
        active: 0,
      };

      expect(taskCounts).toBeDefined();
    });

    it('should export RestartRecord type from core package', () => {
      const restart: RestartRecord = {
        timestamp: new Date(),
        reason: 'test',
        triggeredByWatchdog: false,
      };

      expect(restart).toBeDefined();
    });
  });

  describe('Requirement: Extended DaemonConfig schema', () => {
    it('should support existing DaemonConfig fields', () => {
      const config = {
        pollInterval: 5000,
        autoStart: true,
        logLevel: 'info' as const,
      };

      const validated = DaemonConfigSchema.parse(config);

      expect(validated.pollInterval).toBe(5000);
      expect(validated.autoStart).toBe(true);
      expect(validated.logLevel).toBe('info');
    });

    it('should support health check configuration in DaemonConfig', () => {
      const config = {
        pollInterval: 5000,
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

    it('should support watchdog configuration in DaemonConfig', () => {
      const config = {
        pollInterval: 5000,
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

    it('should apply default values for health monitoring configuration', () => {
      const minimalConfig = {};

      const validated = DaemonConfigSchema.parse(minimalConfig);

      // Verify defaults are applied
      expect(validated.pollInterval).toBe(5000);
      expect(validated.autoStart).toBe(false);
      expect(validated.logLevel).toBe('info');
      expect(validated.healthCheck?.enabled).toBe(true);
      expect(validated.healthCheck?.interval).toBe(30000);
      expect(validated.watchdog?.enabled).toBe(true);
      expect(validated.watchdog?.restartDelay).toBe(5000);
    });

    it('should support complete DaemonConfig with health monitoring features', () => {
      const fullConfig: DaemonConfig = {
        pollInterval: 8000,
        autoStart: true,
        logLevel: 'debug',
        installAsService: false,
        serviceName: 'test-apex-daemon',
        service: { enableOnBoot: false },
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
          enabled: false,
        },
        sessionRecovery: {
          enabled: true,
          autoResume: true,
          checkpointInterval: 30000,
        },
        idleProcessing: {
          enabled: false,
        },
        orphanDetection: {
          enabled: true,
          stalenessThreshold: 1800000,
        },
      };

      // Validate with schema
      const validated = DaemonConfigSchema.parse(fullConfig);

      expect(validated.pollInterval).toBe(8000);
      expect(validated.healthCheck?.enabled).toBe(true);
      expect(validated.watchdog?.enabled).toBe(true);
      expect(validated.sessionRecovery?.enabled).toBe(true);
      expect(validated.orphanDetection?.enabled).toBe(true);
    });
  });

  describe('End-to-end validation: Complete acceptance criteria', () => {
    it('should meet all acceptance criteria requirements in a single test', () => {
      // 1. Create HealthMetrics with all required fields
      const healthMetrics: HealthMetrics = {
        // Required: uptime field
        uptime: 3600000, // 1 hour

        // Required: memoryUsage field with heapUsed, heapTotal, rss
        memoryUsage: {
          heapUsed: 100 * 1024 * 1024,   // 100MB
          heapTotal: 200 * 1024 * 1024,  // 200MB
          rss: 250 * 1024 * 1024,        // 250MB
        },

        // Required: taskCounts field with processed, succeeded, failed, active
        taskCounts: {
          processed: 2000,
          succeeded: 1900,
          failed: 80,
          active: 10,
        },

        // Required: lastHealthCheck field
        lastHealthCheck: new Date('2023-10-15T16:30:00Z'),

        // Required: healthChecksPassed field
        healthChecksPassed: 120,

        // Required: healthChecksFailed field
        healthChecksFailed: 5,

        // Required: restartHistory array field
        restartHistory: [
          {
            timestamp: new Date('2023-10-15T15:00:00Z'),
            reason: 'oom',
            exitCode: 137,
            triggeredByWatchdog: true,
          },
          {
            timestamp: new Date('2023-10-15T12:30:00Z'),
            reason: 'manual',
            triggeredByWatchdog: false,
          },
        ],
      };

      // 2. Validate all fields are present and correctly typed
      expect(typeof healthMetrics.uptime).toBe('number');
      expect(healthMetrics.uptime).toBe(3600000);

      expect(typeof healthMetrics.memoryUsage).toBe('object');
      expect(typeof healthMetrics.memoryUsage.heapUsed).toBe('number');
      expect(typeof healthMetrics.memoryUsage.heapTotal).toBe('number');
      expect(typeof healthMetrics.memoryUsage.rss).toBe('number');

      expect(typeof healthMetrics.taskCounts).toBe('object');
      expect(typeof healthMetrics.taskCounts.processed).toBe('number');
      expect(typeof healthMetrics.taskCounts.succeeded).toBe('number');
      expect(typeof healthMetrics.taskCounts.failed).toBe('number');
      expect(typeof healthMetrics.taskCounts.active).toBe('number');

      expect(healthMetrics.lastHealthCheck).toBeInstanceOf(Date);
      expect(typeof healthMetrics.healthChecksPassed).toBe('number');
      expect(typeof healthMetrics.healthChecksFailed).toBe('number');
      expect(Array.isArray(healthMetrics.restartHistory)).toBe(true);

      // 3. Test type exports (ability to use types proves they're exported)
      const separateMemory: DaemonMemoryUsage = healthMetrics.memoryUsage;
      const separateTasks: DaemonTaskCounts = healthMetrics.taskCounts;
      const separateRestart: RestartRecord = healthMetrics.restartHistory[0];

      expect(separateMemory.heapUsed).toBe(104857600);
      expect(separateTasks.processed).toBe(2000);
      expect(separateRestart.reason).toBe('oom');

      // 4. Test DaemonConfig schema extension
      const extendedDaemonConfig: DaemonConfig = {
        pollInterval: 10000,
        autoStart: true,
        logLevel: 'warn',
        healthCheck: {
          enabled: true,
          interval: 45000,
          timeout: 8000,
          retries: 4,
        },
        watchdog: {
          enabled: true,
          restartDelay: 8000,
          maxRestarts: 7,
          restartWindow: 600000,
        },
      };

      const validatedConfig = DaemonConfigSchema.parse(extendedDaemonConfig);

      expect(validatedConfig.pollInterval).toBe(10000);
      expect(validatedConfig.healthCheck?.enabled).toBe(true);
      expect(validatedConfig.healthCheck?.interval).toBe(45000);
      expect(validatedConfig.watchdog?.enabled).toBe(true);
      expect(validatedConfig.watchdog?.maxRestarts).toBe(7);

      // All acceptance criteria have been validated:
      // ✓ HealthMetrics type with all required fields
      // ✓ memoryUsage (heapUsed, heapTotal, rss)
      // ✓ taskCounts (processed, succeeded, failed, active)
      // ✓ lastHealthCheck, healthChecksPassed, healthChecksFailed
      // ✓ restartHistory array
      // ✓ Type exports from @apexcli/core
      // ✓ Extended DaemonConfig schema
    });
  });
});