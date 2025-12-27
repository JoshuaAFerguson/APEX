/**
 * Comprehensive tests for the daemon health endpoint
 * Tests health metrics, WebSocket events, error scenarios, and integration with daemon manager
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index';
import path from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { WebSocket } from 'ws';
import { HealthMetrics, DaemonMemoryUsage, DaemonTaskCounts, RestartRecord } from '@apexcli/core';

// Mock data factories
function createMockMemoryUsage(): DaemonMemoryUsage {
  return {
    heapUsed: 123456789,
    heapTotal: 200000000,
    rss: 250000000,
  };
}

function createMockTaskCounts(): DaemonTaskCounts {
  return {
    processed: 25,
    succeeded: 20,
    failed: 3,
    active: 2,
  };
}

function createMockRestartHistory(): RestartRecord[] {
  return [
    {
      timestamp: new Date('2024-01-15T10:30:00Z'),
      reason: 'crash',
      exitCode: 1,
      triggeredByWatchdog: true,
    },
    {
      timestamp: new Date('2024-01-14T15:45:00Z'),
      reason: 'manual',
      exitCode: 0,
      triggeredByWatchdog: false,
    },
  ];
}

function createMockHealthMetrics(): HealthMetrics {
  return {
    uptime: 3600000, // 1 hour
    memoryUsage: createMockMemoryUsage(),
    taskCounts: createMockTaskCounts(),
    lastHealthCheck: new Date('2024-01-15T12:00:00Z'),
    healthChecksPassed: 100,
    healthChecksFailed: 2,
    restartHistory: createMockRestartHistory(),
  };
}

describe('/daemon/health endpoint', () => {
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
  });

  describe('Basic endpoint functionality', () => {
    it('should return health endpoint structure when daemon is not running', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('error', 'Daemon not running');
      expect(body).toHaveProperty('status', 'unavailable');
      expect(body).toHaveProperty('metrics', null);
      expect(body).toHaveProperty('message');
      expect(body.message).toContain('APEX daemon is not currently running');
      expect(body).toHaveProperty('timestamp');
    });

    it('should have correct endpoint path and method', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      // Should not be 404 (endpoint exists)
      expect(response.statusCode).not.toBe(404);
    });

    it('should handle invalid HTTP methods', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(404); // Fastify returns 404 for unsupported methods
    });

    it('should return JSON response', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, () =>
        app.inject({
          method: 'GET',
          url: '/daemon/health',
        })
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.statusCode).toBe(503);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('error', 'Daemon not running');
      });
    });
  });

  describe('Simulated daemon running scenarios', () => {
    beforeEach(async () => {
      // Mock a running daemon by creating PID and state files
      const pidFile = path.join(tempDir, '.apex', 'daemon.pid');
      const stateFile = path.join(tempDir, '.apex', 'daemon-state.json');

      const mockPid = 12345;
      const mockStartTime = new Date('2024-01-15T11:00:00Z').toISOString();

      // Create PID file
      await writeFile(pidFile, JSON.stringify({
        pid: mockPid,
        startedAt: mockStartTime,
        version: '0.3.0',
        projectPath: tempDir,
      }));

      // Create state file with health metrics
      const mockHealthMetrics = createMockHealthMetrics();
      await writeFile(stateFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        pid: mockPid,
        startedAt: mockStartTime,
        running: true,
        health: {
          ...mockHealthMetrics,
          lastHealthCheck: mockHealthMetrics.lastHealthCheck.toISOString(),
          restartHistory: mockHealthMetrics.restartHistory.map(record => ({
            ...record,
            timestamp: record.timestamp.toISOString(),
          })),
        },
      }));

      // Mock process.kill to simulate running process
      vi.spyOn(process, 'kill').mockImplementation((pid: number, signal?: string | number) => {
        if (pid === mockPid && (signal === 0 || signal === undefined)) {
          return true; // Process exists
        }
        throw new Error('ESRCH: No such process');
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return healthy status when daemon is running with good metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('status', 'healthy');
      expect(body).toHaveProperty('metrics');
      expect(body).toHaveProperty('daemon');
      expect(body).toHaveProperty('timestamp');

      // Validate metrics structure
      const metrics = body.metrics;
      expect(metrics).toHaveProperty('uptime', 3600000);
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics.memoryUsage).toHaveProperty('heapUsed');
      expect(metrics.memoryUsage).toHaveProperty('heapTotal');
      expect(metrics.memoryUsage).toHaveProperty('rss');
      expect(metrics).toHaveProperty('taskCounts');
      expect(metrics.taskCounts).toHaveProperty('processed', 25);
      expect(metrics.taskCounts).toHaveProperty('succeeded', 20);
      expect(metrics.taskCounts).toHaveProperty('failed', 3);
      expect(metrics.taskCounts).toHaveProperty('active', 2);
      expect(metrics).toHaveProperty('healthChecksPassed', 100);
      expect(metrics).toHaveProperty('healthChecksFailed', 2);
      expect(metrics).toHaveProperty('restartHistory');
      expect(Array.isArray(metrics.restartHistory)).toBe(true);

      // Validate daemon info
      const daemon = body.daemon;
      expect(daemon).toHaveProperty('isRunning', true);
      expect(daemon).toHaveProperty('pid', 12345);
      expect(daemon).toHaveProperty('version');
      expect(daemon).toHaveProperty('startedAt');
      expect(daemon).toHaveProperty('projectPath', tempDir);
    });

    it('should return degraded status for unhealthy metrics', async () => {
      // Create state file with unhealthy metrics (high memory usage)
      const stateFile = path.join(tempDir, '.apex', 'daemon-state.json');
      const mockHealthMetrics = createMockHealthMetrics();

      // Set unhealthy memory usage (over 1GB)
      mockHealthMetrics.memoryUsage.heapUsed = 2 * 1024 * 1024 * 1024; // 2GB

      await writeFile(stateFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        pid: 12345,
        startedAt: new Date('2024-01-15T11:00:00Z').toISOString(),
        running: true,
        health: {
          ...mockHealthMetrics,
          lastHealthCheck: mockHealthMetrics.lastHealthCheck.toISOString(),
          restartHistory: mockHealthMetrics.restartHistory.map(record => ({
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

      expect(body.status).toBe('degraded'); // Should be degraded due to high memory
      expect(body.metrics.memoryUsage.heapUsed).toBe(2 * 1024 * 1024 * 1024);
    });

    it('should handle stale state file gracefully', async () => {
      // Create stale state file (older than 2 minutes)
      const stateFile = path.join(tempDir, '.apex', 'daemon-state.json');
      const staleTimestamp = new Date(Date.now() - 3 * 60 * 1000).toISOString(); // 3 minutes ago

      await writeFile(stateFile, JSON.stringify({
        timestamp: staleTimestamp,
        pid: 12345,
        startedAt: new Date('2024-01-15T11:00:00Z').toISOString(),
        running: true,
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should still return metrics, but they might be from HealthMonitor fallback
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('metrics');
    });
  });

  describe('Error scenarios', () => {
    it('should handle corrupted PID file', async () => {
      const pidFile = path.join(tempDir, '.apex', 'daemon.pid');
      await writeFile(pidFile, 'invalid json');

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Daemon not running');
    });

    it('should handle missing .apex directory', async () => {
      await rm(path.join(tempDir, '.apex'), { recursive: true, force: true });

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Daemon not running');
    });

    it('should handle file system permission errors', async () => {
      // This is harder to test reliably across platforms, but we can ensure the endpoint doesn't crash
      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect([200, 503, 500]).toContain(response.statusCode);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status');
    });

    it('should handle internal errors gracefully', async () => {
      // Mock an internal error by creating invalid state
      const pidFile = path.join(tempDir, '.apex', 'daemon.pid');
      await writeFile(pidFile, JSON.stringify({
        pid: 'invalid-pid', // Invalid PID type
        startedAt: 'invalid-date',
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });
  });

  describe('Health metrics validation', () => {
    beforeEach(async () => {
      // Mock a running daemon
      const pidFile = path.join(tempDir, '.apex', 'daemon.pid');
      const mockPid = 12345;
      const mockStartTime = new Date('2024-01-15T11:00:00Z').toISOString();

      await writeFile(pidFile, JSON.stringify({
        pid: mockPid,
        startedAt: mockStartTime,
        version: '0.3.0',
        projectPath: tempDir,
      }));

      vi.spyOn(process, 'kill').mockImplementation((pid: number, signal?: string | number) => {
        if (pid === mockPid && (signal === 0 || signal === undefined)) {
          return true;
        }
        throw new Error('ESRCH: No such process');
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should validate required health metric fields', async () => {
      const stateFile = path.join(tempDir, '.apex', 'daemon-state.json');
      const mockHealthMetrics = createMockHealthMetrics();

      await writeFile(stateFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        pid: 12345,
        startedAt: new Date('2024-01-15T11:00:00Z').toISOString(),
        running: true,
        health: {
          ...mockHealthMetrics,
          lastHealthCheck: mockHealthMetrics.lastHealthCheck.toISOString(),
          restartHistory: mockHealthMetrics.restartHistory.map(record => ({
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
      const metrics = body.metrics;

      // Validate all required fields are present
      expect(metrics).toHaveProperty('uptime');
      expect(typeof metrics.uptime).toBe('number');

      expect(metrics).toHaveProperty('memoryUsage');
      expect(typeof metrics.memoryUsage).toBe('object');
      expect(metrics.memoryUsage).toHaveProperty('heapUsed');
      expect(metrics.memoryUsage).toHaveProperty('heapTotal');
      expect(metrics.memoryUsage).toHaveProperty('rss');

      expect(metrics).toHaveProperty('taskCounts');
      expect(typeof metrics.taskCounts).toBe('object');
      expect(metrics.taskCounts).toHaveProperty('processed');
      expect(metrics.taskCounts).toHaveProperty('succeeded');
      expect(metrics.taskCounts).toHaveProperty('failed');
      expect(metrics.taskCounts).toHaveProperty('active');

      expect(metrics).toHaveProperty('lastHealthCheck');
      expect(metrics).toHaveProperty('healthChecksPassed');
      expect(metrics).toHaveProperty('healthChecksFailed');
      expect(metrics).toHaveProperty('restartHistory');
      expect(Array.isArray(metrics.restartHistory)).toBe(true);
    });

    it('should handle edge case values in health metrics', async () => {
      const stateFile = path.join(tempDir, '.apex', 'daemon-state.json');

      // Create metrics with edge case values
      const edgeCaseMetrics: HealthMetrics = {
        uptime: 0, // Just started
        memoryUsage: {
          heapUsed: 0,
          heapTotal: 0,
          rss: 0,
        },
        taskCounts: {
          processed: 0,
          succeeded: 0,
          failed: 0,
          active: 0,
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: 0,
        healthChecksFailed: 0,
        restartHistory: [], // No restarts
      };

      await writeFile(stateFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        pid: 12345,
        startedAt: new Date().toISOString(),
        running: true,
        health: {
          ...edgeCaseMetrics,
          lastHealthCheck: edgeCaseMetrics.lastHealthCheck.toISOString(),
          restartHistory: [],
        },
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.status).toBe('healthy'); // Zero values should still be considered healthy
      expect(body.metrics.uptime).toBe(0);
      expect(body.metrics.restartHistory).toEqual([]);
    });
  });

  describe('Response format consistency', () => {
    it('should always include timestamp in responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('timestamp');
      expect(new Date(body.timestamp)).toBeInstanceOf(Date);
    });

    it('should have consistent error response format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('metrics');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('timestamp');
    });

    it('should have consistent success response format', async () => {
      // Create minimal mock for running daemon
      const pidFile = path.join(tempDir, '.apex', 'daemon.pid');
      const stateFile = path.join(tempDir, '.apex', 'daemon-state.json');

      await writeFile(pidFile, JSON.stringify({
        pid: 12345,
        startedAt: new Date().toISOString(),
      }));

      await writeFile(stateFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        pid: 12345,
        startedAt: new Date().toISOString(),
        running: true,
        health: createMockHealthMetrics(),
      }));

      vi.spyOn(process, 'kill').mockImplementation(() => true);

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('metrics');
      expect(body).toHaveProperty('daemon');
      expect(body).toHaveProperty('timestamp');

      vi.restoreAllMocks();
    });
  });
});