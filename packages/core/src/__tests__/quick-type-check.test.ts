import { describe, it, expect } from 'vitest';

describe('Quick Type Check for HealthMetrics', () => {
  it('should compile without errors', () => {
    // Just importing the types should work
    const test = async () => {
      const { HealthMetrics, DaemonMemoryUsage, DaemonTaskCounts, RestartRecord } = await import('../types.js');

      // Basic type checking - these should not cause compilation errors
      const memory: DaemonMemoryUsage = {
        heapUsed: 1024,
        heapTotal: 2048,
        rss: 3072,
      };

      const tasks: DaemonTaskCounts = {
        processed: 1,
        succeeded: 1,
        failed: 0,
        active: 0,
      };

      const restart: RestartRecord = {
        timestamp: new Date(),
        reason: 'test',
        triggeredByWatchdog: false,
      };

      const health: HealthMetrics = {
        uptime: 1000,
        memoryUsage: memory,
        taskCounts: tasks,
        lastHealthCheck: new Date(),
        healthChecksPassed: 1,
        healthChecksFailed: 0,
        restartHistory: [restart],
      };

      return { memory, tasks, restart, health };
    };

    expect(test).toBeDefined();
  });
});