/**
 * Integration tests for health monitoring system
 * Tests integration between DaemonManager, HealthMonitor, and API health endpoint
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index';
import path from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { HealthMetrics, DaemonMemoryUsage, DaemonTaskCounts, RestartRecord } from '@apexcli/core';

// Mock data generators for various health scenarios
function createHealthyMetrics(): HealthMetrics {
  return {
    uptime: 7200000, // 2 hours
    memoryUsage: {
      heapUsed: 100 * 1024 * 1024, // 100MB
      heapTotal: 150 * 1024 * 1024, // 150MB
      rss: 200 * 1024 * 1024, // 200MB
    },
    taskCounts: {
      processed: 50,
      succeeded: 48,
      failed: 2,
      active: 1,
    },
    lastHealthCheck: new Date(),
    healthChecksPassed: 120,
    healthChecksFailed: 1,
    restartHistory: [],
  };
}

function createDegradedMemoryMetrics(): HealthMetrics {
  const metrics = createHealthyMetrics();
  metrics.memoryUsage.heapUsed = 2 * 1024 * 1024 * 1024; // 2GB - over threshold
  return metrics;
}

function createHighFailureRateMetrics(): HealthMetrics {
  const metrics = createHealthyMetrics();
  metrics.healthChecksPassed = 80;
  metrics.healthChecksFailed = 20; // 20% failure rate - over threshold
  return metrics;
}

function createRecentRestartMetrics(): HealthMetrics {
  const metrics = createHealthyMetrics();
  metrics.restartHistory = [
    {
      timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      reason: 'crash',
      exitCode: 1,
      triggeredByWatchdog: true,
    },
  ];
  return metrics;
}

function createHighActiveTasksMetrics(): HealthMetrics {
  const metrics = createHealthyMetrics();
  metrics.taskCounts.active = 60; // Over 50 threshold
  return metrics;
}

describe('Health Monitoring Integration', () => {
  let app: FastifyInstance;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for the project
    tempDir = await mkdtemp(path.join(tmpdir(), 'apex-test-'));

    // Create .apex directory
    await mkdir(path.join(tempDir, '.apex'), { recursive: true });

    // Create server with test configuration
    app = await createServer({
      projectPath: tempDir,
      port: 0, // Use dynamic port
      silent: true, // Suppress logs during tests
    });
  });

  afterEach(async () => {
    // Clean up
    if (app) {
      await app.close();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('Health assessment logic integration', () => {
    beforeEach(async () => {
      // Mock a running daemon
      const pidFile = path.join(tempDir, '.apex', 'daemon.pid');
      await writeFile(pidFile, JSON.stringify({
        pid: 12345,
        startedAt: new Date().toISOString(),
        version: '0.3.0',
        projectPath: tempDir,
      }));

      vi.spyOn(process, 'kill').mockImplementation(() => true);
    });

    it('should assess daemon as healthy with good metrics', async () => {
      const stateFile = path.join(tempDir, '.apex', 'daemon-state.json');
      const healthyMetrics = createHealthyMetrics();

      await writeFile(stateFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        pid: 12345,
        startedAt: new Date().toISOString(),
        running: true,
        health: {
          ...healthyMetrics,
          lastHealthCheck: healthyMetrics.lastHealthCheck.toISOString(),
          restartHistory: healthyMetrics.restartHistory.map(record => ({
            ...record,
            timestamp: record.timestamp.toISOString(),
          })),
        },
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.status).toBe('healthy');
      expect(body.metrics.memoryUsage.heapUsed).toBe(100 * 1024 * 1024);
      expect(body.metrics.taskCounts.active).toBe(1);
      expect(body.metrics.healthChecksFailed).toBe(1);
      expect(body.metrics.restartHistory).toEqual([]);
    });

    it('should assess daemon as degraded due to high memory usage', async () => {
      const stateFile = path.join(tempDir, '.apex', 'daemon-state.json');
      const degradedMetrics = createDegradedMemoryMetrics();

      await writeFile(stateFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        pid: 12345,
        startedAt: new Date().toISOString(),
        running: true,
        health: {
          ...degradedMetrics,
          lastHealthCheck: degradedMetrics.lastHealthCheck.toISOString(),
          restartHistory: degradedMetrics.restartHistory.map(record => ({
            ...record,
            timestamp: record.timestamp.toISOString(),
          })),
        },
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.status).toBe('degraded');
      expect(body.metrics.memoryUsage.heapUsed).toBe(2 * 1024 * 1024 * 1024);
    });

    it('should assess daemon as degraded due to high health check failure rate', async () => {
      const stateFile = path.join(tempDir, '.apex', 'daemon-state.json');
      const failureMetrics = createHighFailureRateMetrics();

      await writeFile(stateFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        pid: 12345,
        startedAt: new Date().toISOString(),
        running: true,
        health: {
          ...failureMetrics,
          lastHealthCheck: failureMetrics.lastHealthCheck.toISOString(),
          restartHistory: failureMetrics.restartHistory.map(record => ({
            ...record,
            timestamp: record.timestamp.toISOString(),
          })),
        },
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.status).toBe('degraded');
      expect(body.metrics.healthChecksFailed).toBe(20);
      expect(body.metrics.healthChecksPassed).toBe(80);
    });

    it('should assess daemon as degraded due to recent restarts', async () => {
      const stateFile = path.join(tempDir, '.apex', 'daemon-state.json');
      const restartMetrics = createRecentRestartMetrics();

      await writeFile(stateFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        pid: 12345,
        startedAt: new Date().toISOString(),
        running: true,
        health: {
          ...restartMetrics,
          lastHealthCheck: restartMetrics.lastHealthCheck.toISOString(),
          restartHistory: restartMetrics.restartHistory.map(record => ({
            ...record,
            timestamp: record.timestamp.toISOString(),
          })),
        },
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.status).toBe('degraded');
      expect(body.metrics.restartHistory).toHaveLength(1);
      expect(body.metrics.restartHistory[0].reason).toBe('crash');
      expect(body.metrics.restartHistory[0].triggeredByWatchdog).toBe(true);
    });

    it('should assess daemon as degraded due to too many active tasks', async () => {
      const stateFile = path.join(tempDir, '.apex', 'daemon-state.json');
      const highTasksMetrics = createHighActiveTasksMetrics();

      await writeFile(stateFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        pid: 12345,
        startedAt: new Date().toISOString(),
        running: true,
        health: {
          ...highTasksMetrics,
          lastHealthCheck: highTasksMetrics.lastHealthCheck.toISOString(),
          restartHistory: highTasksMetrics.restartHistory.map(record => ({
            ...record,
            timestamp: record.timestamp.toISOString(),
          })),
        },
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.status).toBe('degraded');
      expect(body.metrics.taskCounts.active).toBe(60);
    });
  });

  describe('DaemonManager and HealthMonitor integration', () => {
    it('should fall back to HealthMonitor when daemon state is missing health data', async () => {
      // Mock a running daemon without health data in state
      const pidFile = path.join(tempDir, '.apex', 'daemon.pid');
      const stateFile = path.join(tempDir, '.apex', 'daemon-state.json');

      await writeFile(pidFile, JSON.stringify({
        pid: 12345,
        startedAt: new Date().toISOString(),
      }));

      // State file without health data
      await writeFile(stateFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        pid: 12345,
        startedAt: new Date().toISOString(),
        running: true,
        // No health field
      }));

      vi.spyOn(process, 'kill').mockImplementation(() => true);

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should have metrics from HealthMonitor fallback
      expect(body).toHaveProperty('metrics');
      expect(body.metrics).toHaveProperty('uptime');
      expect(body.metrics).toHaveProperty('memoryUsage');
      expect(body.metrics).toHaveProperty('taskCounts');
    });

    it('should handle case where both daemon state and HealthMonitor fail', async () => {
      // Mock a running process but no state file
      const pidFile = path.join(tempDir, '.apex', 'daemon.pid');

      await writeFile(pidFile, JSON.stringify({
        pid: 12345,
        startedAt: new Date().toISOString(),
      }));

      vi.spyOn(process, 'kill').mockImplementation(() => true);
      // Don't create state file - should cause fallback

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should still return metrics, even if basic/default ones
      expect(body).toHaveProperty('metrics');
      expect(body).toHaveProperty('status');
    });

    it('should correctly detect when daemon process is not running despite PID file', async () => {
      // Create PID file but don't mock process.kill (will throw ESRCH)
      const pidFile = path.join(tempDir, '.apex', 'daemon.pid');

      await writeFile(pidFile, JSON.stringify({
        pid: 99999, // Non-existent PID
        startedAt: new Date().toISOString(),
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);

      expect(body.error).toBe('Daemon not running');
      expect(body.metrics).toBeNull();
    });
  });

  describe('Health monitoring edge cases', () => {
    it('should handle corrupted state file gracefully', async () => {
      const pidFile = path.join(tempDir, '.apex', 'daemon.pid');
      const stateFile = path.join(tempDir, '.apex', 'daemon-state.json');

      await writeFile(pidFile, JSON.stringify({
        pid: 12345,
        startedAt: new Date().toISOString(),
      }));

      // Write invalid JSON to state file
      await writeFile(stateFile, 'invalid json content');

      vi.spyOn(process, 'kill').mockImplementation(() => true);

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should fall back to HealthMonitor and still provide metrics
      expect(body).toHaveProperty('metrics');
      expect(body).toHaveProperty('status');
    });

    it('should handle missing required fields in health data', async () => {
      const pidFile = path.join(tempDir, '.apex', 'daemon.pid');
      const stateFile = path.join(tempDir, '.apex', 'daemon-state.json');

      await writeFile(pidFile, JSON.stringify({
        pid: 12345,
        startedAt: new Date().toISOString(),
      }));

      // State with incomplete health data
      await writeFile(stateFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        pid: 12345,
        startedAt: new Date().toISOString(),
        running: true,
        health: {
          uptime: 3600000,
          // Missing memoryUsage, taskCounts, etc.
        },
      }));

      vi.spyOn(process, 'kill').mockImplementation(() => true);

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      // Should handle gracefully - either return partial data or fall back
      expect([200, 500]).toContain(response.statusCode);
    });

    it('should handle very large health metrics values', async () => {
      const pidFile = path.join(tempDir, '.apex', 'daemon.pid');
      const stateFile = path.join(tempDir, '.apex', 'daemon-state.json');

      await writeFile(pidFile, JSON.stringify({
        pid: 12345,
        startedAt: new Date().toISOString(),
      }));

      const extremeMetrics = createHealthyMetrics();
      extremeMetrics.uptime = Number.MAX_SAFE_INTEGER;
      extremeMetrics.memoryUsage.heapUsed = Number.MAX_SAFE_INTEGER;
      extremeMetrics.taskCounts.processed = Number.MAX_SAFE_INTEGER;
      extremeMetrics.healthChecksPassed = Number.MAX_SAFE_INTEGER;

      await writeFile(stateFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        pid: 12345,
        startedAt: new Date().toISOString(),
        running: true,
        health: {
          ...extremeMetrics,
          lastHealthCheck: extremeMetrics.lastHealthCheck.toISOString(),
          restartHistory: extremeMetrics.restartHistory.map(record => ({
            ...record,
            timestamp: record.timestamp.toISOString(),
          })),
        },
      }));

      vi.spyOn(process, 'kill').mockImplementation(() => true);

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should handle extreme values without crashing
      expect(body).toHaveProperty('metrics');
      expect(body.metrics.uptime).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('Health monitoring performance', () => {
    it('should respond quickly even with large restart history', async () => {
      const pidFile = path.join(tempDir, '.apex', 'daemon.pid');
      const stateFile = path.join(tempDir, '.apex', 'daemon-state.json');

      await writeFile(pidFile, JSON.stringify({
        pid: 12345,
        startedAt: new Date().toISOString(),
      }));

      const metricsWithLargeHistory = createHealthyMetrics();

      // Create 1000 restart records
      metricsWithLargeHistory.restartHistory = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 60000), // 1 minute apart
        reason: i % 2 === 0 ? 'crash' : 'manual',
        exitCode: i % 2,
        triggeredByWatchdog: i % 3 === 0,
      }));

      await writeFile(stateFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        pid: 12345,
        startedAt: new Date().toISOString(),
        running: true,
        health: {
          ...metricsWithLargeHistory,
          lastHealthCheck: metricsWithLargeHistory.lastHealthCheck.toISOString(),
          restartHistory: metricsWithLargeHistory.restartHistory.map(record => ({
            ...record,
            timestamp: record.timestamp.toISOString(),
          })),
        },
      }));

      vi.spyOn(process, 'kill').mockImplementation(() => true);

      const startTime = Date.now();
      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });
      const endTime = Date.now();

      const responseTime = endTime - startTime;

      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second

      const body = JSON.parse(response.body);
      expect(body.metrics.restartHistory).toHaveLength(1000);
    });

    it('should handle concurrent health requests efficiently', async () => {
      const pidFile = path.join(tempDir, '.apex', 'daemon.pid');
      const stateFile = path.join(tempDir, '.apex', 'daemon-state.json');

      await writeFile(pidFile, JSON.stringify({
        pid: 12345,
        startedAt: new Date().toISOString(),
      }));

      const healthyMetrics = createHealthyMetrics();
      await writeFile(stateFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        pid: 12345,
        startedAt: new Date().toISOString(),
        running: true,
        health: {
          ...healthyMetrics,
          lastHealthCheck: healthyMetrics.lastHealthCheck.toISOString(),
          restartHistory: healthyMetrics.restartHistory.map(record => ({
            ...record,
            timestamp: record.timestamp.toISOString(),
          })),
        },
      }));

      vi.spyOn(process, 'kill').mockImplementation(() => true);

      // Make 10 concurrent requests
      const requests = Array.from({ length: 10 }, () =>
        app.inject({
          method: 'GET',
          url: '/daemon/health',
        })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.status).toBe('healthy');
      });

      // Concurrent requests should not take significantly longer than a single request
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});