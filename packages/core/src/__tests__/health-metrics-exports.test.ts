import { describe, it, expect } from 'vitest';
import type {
  HealthMetrics,
  DaemonMemoryUsage,
  DaemonTaskCounts,
  RestartRecord,
} from '../types.js';

describe('HealthMetrics Type Exports from @apexcli/core', () => {
  describe('Type availability and structure', () => {
    it('should export HealthMetrics interface', () => {
      // Test that HealthMetrics interface is properly exported and can be used
      const healthMetrics: HealthMetrics = {
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
      };

      // Verify all required properties are accessible
      expect(typeof healthMetrics.uptime).toBe('number');
      expect(typeof healthMetrics.memoryUsage).toBe('object');
      expect(typeof healthMetrics.taskCounts).toBe('object');
      expect(healthMetrics.lastHealthCheck).toBeInstanceOf(Date);
      expect(typeof healthMetrics.healthChecksPassed).toBe('number');
      expect(typeof healthMetrics.healthChecksFailed).toBe('number');
      expect(Array.isArray(healthMetrics.restartHistory)).toBe(true);
    });

    it('should export DaemonMemoryUsage interface', () => {
      const memoryUsage: DaemonMemoryUsage = {
        heapUsed: 50 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        rss: 120 * 1024 * 1024,
      };

      expect(typeof memoryUsage.heapUsed).toBe('number');
      expect(typeof memoryUsage.heapTotal).toBe('number');
      expect(typeof memoryUsage.rss).toBe('number');
    });

    it('should export DaemonTaskCounts interface', () => {
      const taskCounts: DaemonTaskCounts = {
        processed: 100,
        succeeded: 85,
        failed: 10,
        active: 5,
      };

      expect(typeof taskCounts.processed).toBe('number');
      expect(typeof taskCounts.succeeded).toBe('number');
      expect(typeof taskCounts.failed).toBe('number');
      expect(typeof taskCounts.active).toBe('number');
    });

    it('should export RestartRecord interface', () => {
      const restartRecord: RestartRecord = {
        timestamp: new Date(),
        reason: 'crash',
        exitCode: 1,
        triggeredByWatchdog: false,
      };

      expect(restartRecord.timestamp).toBeInstanceOf(Date);
      expect(typeof restartRecord.reason).toBe('string');
      expect(typeof restartRecord.exitCode).toBe('number');
      expect(typeof restartRecord.triggeredByWatchdog).toBe('boolean');
    });
  });

  describe('Type compatibility and composition', () => {
    it('should allow HealthMetrics to be composed from individual interfaces', () => {
      const memory: DaemonMemoryUsage = {
        heapUsed: 30 * 1024 * 1024,
        heapTotal: 60 * 1024 * 1024,
        rss: 75 * 1024 * 1024,
      };

      const tasks: DaemonTaskCounts = {
        processed: 50,
        succeeded: 45,
        failed: 3,
        active: 2,
      };

      const restart: RestartRecord = {
        timestamp: new Date('2023-10-15T12:00:00Z'),
        reason: 'manual',
        triggeredByWatchdog: false,
      };

      const composed: HealthMetrics = {
        uptime: 3600000,
        memoryUsage: memory,
        taskCounts: tasks,
        lastHealthCheck: new Date(),
        healthChecksPassed: 120,
        healthChecksFailed: 2,
        restartHistory: [restart],
      };

      expect(composed.memoryUsage).toEqual(memory);
      expect(composed.taskCounts).toEqual(tasks);
      expect(composed.restartHistory[0]).toEqual(restart);
    });

    it('should support function parameters and return types', () => {
      const getMemoryUsage = (): DaemonMemoryUsage => ({
        heapUsed: process.memoryUsage?.()?.heapUsed || 1024,
        heapTotal: process.memoryUsage?.()?.heapTotal || 2048,
        rss: process.memoryUsage?.()?.rss || 3072,
      });

      const updateTaskCounts = (current: DaemonTaskCounts, increment: Partial<DaemonTaskCounts>): DaemonTaskCounts => ({
        processed: current.processed + (increment.processed || 0),
        succeeded: current.succeeded + (increment.succeeded || 0),
        failed: current.failed + (increment.failed || 0),
        active: increment.active !== undefined ? increment.active : current.active,
      });

      const addRestartRecord = (history: RestartRecord[], record: RestartRecord): RestartRecord[] => {
        return [record, ...history].slice(0, 10); // Keep last 10 restarts
      };

      const buildHealthMetrics = (
        uptime: number,
        memory: DaemonMemoryUsage,
        tasks: DaemonTaskCounts,
        restarts: RestartRecord[]
      ): HealthMetrics => ({
        uptime,
        memoryUsage: memory,
        taskCounts: tasks,
        lastHealthCheck: new Date(),
        healthChecksPassed: 100,
        healthChecksFailed: 5,
        restartHistory: restarts,
      });

      const memory = getMemoryUsage();
      const initialTasks: DaemonTaskCounts = { processed: 0, succeeded: 0, failed: 0, active: 0 };
      const updatedTasks = updateTaskCounts(initialTasks, { processed: 1, succeeded: 1 });
      const restartHistory = addRestartRecord([], {
        timestamp: new Date(),
        reason: 'test',
        triggeredByWatchdog: false,
      });

      const metrics = buildHealthMetrics(1000, memory, updatedTasks, restartHistory);

      expect(metrics.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(metrics.taskCounts.processed).toBe(1);
      expect(metrics.restartHistory).toHaveLength(1);
    });

    it('should support array operations with RestartRecord[]', () => {
      const restarts: RestartRecord[] = [
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
        {
          timestamp: new Date('2023-10-15T10:00:00Z'),
          reason: 'manual',
          triggeredByWatchdog: false,
        },
      ];

      // Filter operations
      const watchdogRestarts = restarts.filter(r => r.triggeredByWatchdog);
      const crashRestarts = restarts.filter(r => r.reason === 'crash');

      // Map operations
      const reasons = restarts.map(r => r.reason);
      const timestamps = restarts.map(r => r.timestamp);

      // Reduce operations
      const totalWithExitCode = restarts.reduce((count, r) => count + (r.exitCode ? 1 : 0), 0);

      expect(watchdogRestarts).toHaveLength(1);
      expect(crashRestarts).toHaveLength(1);
      expect(reasons).toEqual(['crash', 'oom', 'manual']);
      expect(timestamps).toHaveLength(3);
      expect(totalWithExitCode).toBe(2);
    });
  });

  describe('Type inference and utility types', () => {
    it('should support Partial<HealthMetrics> for updates', () => {
      const baseMetrics: HealthMetrics = {
        uptime: 1000,
        memoryUsage: { heapUsed: 1024, heapTotal: 2048, rss: 3072 },
        taskCounts: { processed: 1, succeeded: 1, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 1,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      const update: Partial<HealthMetrics> = {
        uptime: 2000,
        healthChecksPassed: 2,
      };

      const mergedMetrics: HealthMetrics = { ...baseMetrics, ...update };

      expect(mergedMetrics.uptime).toBe(2000);
      expect(mergedMetrics.healthChecksPassed).toBe(2);
      expect(mergedMetrics.memoryUsage).toEqual(baseMetrics.memoryUsage);
    });

    it('should support Pick<HealthMetrics> for specific fields', () => {
      type MemoryAndTasks = Pick<HealthMetrics, 'memoryUsage' | 'taskCounts'>;

      const memoryAndTasks: MemoryAndTasks = {
        memoryUsage: { heapUsed: 1024, heapTotal: 2048, rss: 3072 },
        taskCounts: { processed: 10, succeeded: 8, failed: 2, active: 0 },
      };

      expect(memoryAndTasks.memoryUsage.heapUsed).toBe(1024);
      expect(memoryAndTasks.taskCounts.processed).toBe(10);
    });

    it('should support Omit<HealthMetrics> for creating subsets', () => {
      type MetricsWithoutHistory = Omit<HealthMetrics, 'restartHistory'>;

      const metricsWithoutHistory: MetricsWithoutHistory = {
        uptime: 1000,
        memoryUsage: { heapUsed: 1024, heapTotal: 2048, rss: 3072 },
        taskCounts: { processed: 1, succeeded: 1, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 1,
        healthChecksFailed: 0,
      };

      expect(metricsWithoutHistory.uptime).toBe(1000);
      expect(metricsWithoutHistory.memoryUsage).toBeDefined();
      // Ensure restartHistory is not present in the type
      // @ts-expect-error - restartHistory should not exist on this type
      expect(metricsWithoutHistory.restartHistory).toBeUndefined();
    });

    it('should support keyof operator for dynamic property access', () => {
      type HealthMetricsKey = keyof HealthMetrics;

      const keys: HealthMetricsKey[] = [
        'uptime',
        'memoryUsage',
        'taskCounts',
        'lastHealthCheck',
        'healthChecksPassed',
        'healthChecksFailed',
        'restartHistory',
      ];

      const metrics: HealthMetrics = {
        uptime: 1000,
        memoryUsage: { heapUsed: 1024, heapTotal: 2048, rss: 3072 },
        taskCounts: { processed: 1, succeeded: 1, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 1,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      keys.forEach(key => {
        expect(metrics[key]).toBeDefined();
      });

      expect(keys).toHaveLength(7);
      expect(keys).toContain('uptime');
      expect(keys).toContain('memoryUsage');
      expect(keys).toContain('restartHistory');
    });
  });

  describe('Generic type constraints', () => {
    it('should support generic functions with HealthMetrics constraints', () => {
      function createMetricsSnapshot<T extends HealthMetrics>(metrics: T): T & { snapshotTime: Date } {
        return {
          ...metrics,
          snapshotTime: new Date(),
        };
      }

      const originalMetrics: HealthMetrics = {
        uptime: 1000,
        memoryUsage: { heapUsed: 1024, heapTotal: 2048, rss: 3072 },
        taskCounts: { processed: 1, succeeded: 1, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 1,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      const snapshot = createMetricsSnapshot(originalMetrics);

      expect(snapshot.uptime).toBe(1000);
      expect(snapshot.snapshotTime).toBeInstanceOf(Date);
      expect(snapshot.memoryUsage).toEqual(originalMetrics.memoryUsage);
    });

    it('should support conditional types with HealthMetrics', () => {
      type MetricsProperty<T> = T extends HealthMetrics
        ? T['memoryUsage']
        : never;

      type MemoryFromMetrics = MetricsProperty<HealthMetrics>;

      const memory: MemoryFromMetrics = {
        heapUsed: 1024,
        heapTotal: 2048,
        rss: 3072,
      };

      expect(memory.heapUsed).toBe(1024);
      expect(memory.heapTotal).toBe(2048);
      expect(memory.rss).toBe(3072);
    });
  });

  describe('Integration with external libraries', () => {
    it('should be serializable to JSON', () => {
      const metrics: HealthMetrics = {
        uptime: 3600000,
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
        ],
      };

      const json = JSON.stringify(metrics);
      const parsed = JSON.parse(json);

      expect(parsed.uptime).toBe(3600000);
      expect(parsed.memoryUsage.heapUsed).toBe(52428800);
      expect(parsed.taskCounts.processed).toBe(100);
      expect(typeof parsed.lastHealthCheck).toBe('string'); // Date becomes string
      expect(parsed.restartHistory).toHaveLength(1);
    });

    it('should support Object.entries and Object.keys', () => {
      const memory: DaemonMemoryUsage = {
        heapUsed: 1024,
        heapTotal: 2048,
        rss: 3072,
      };

      const entries = Object.entries(memory);
      const keys = Object.keys(memory);
      const values = Object.values(memory);

      expect(entries).toHaveLength(3);
      expect(keys).toEqual(['heapUsed', 'heapTotal', 'rss']);
      expect(values).toEqual([1024, 2048, 3072]);

      entries.forEach(([key, value]) => {
        expect(typeof key).toBe('string');
        expect(typeof value).toBe('number');
      });
    });

    it('should support destructuring', () => {
      const metrics: HealthMetrics = {
        uptime: 1000,
        memoryUsage: { heapUsed: 1024, heapTotal: 2048, rss: 3072 },
        taskCounts: { processed: 10, succeeded: 8, failed: 2, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 5,
        healthChecksFailed: 1,
        restartHistory: [],
      };

      // Destructure top-level properties
      const { uptime, memoryUsage, taskCounts, restartHistory } = metrics;

      // Destructure nested properties
      const { heapUsed, heapTotal, rss } = memoryUsage;
      const { processed, succeeded, failed, active } = taskCounts;

      expect(uptime).toBe(1000);
      expect(heapUsed).toBe(1024);
      expect(heapTotal).toBe(2048);
      expect(rss).toBe(3072);
      expect(processed).toBe(10);
      expect(succeeded).toBe(8);
      expect(failed).toBe(2);
      expect(active).toBe(0);
      expect(restartHistory).toEqual([]);
    });
  });
});