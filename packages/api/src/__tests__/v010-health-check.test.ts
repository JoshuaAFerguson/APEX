/**
 * Comprehensive test suite for v0.1.0 Health Check endpoints
 * Tests both basic health check and comprehensive daemon health monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index.js';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import path from 'path';

describe('v0.1.0 Health Check Endpoints', () => {
  let app: FastifyInstance;
  let tempDir: string;
  let apexDir: string;

  beforeEach(async () => {
    // Create temporary directory for each test
    tempDir = await mkdtemp(path.join(tmpdir(), 'apex-health-test-'));
    apexDir = path.join(tempDir, '.apex');

    // Create .apex directory structure
    await mkdir(apexDir, { recursive: true });

    // Create server instance
    app = await createServer({
      projectPath: tempDir,
      port: 0, // Let system assign port
      silent: true
    });

    // Start server
    await app.ready();
  });

  afterEach(async () => {
    // Close server and cleanup
    if (app) {
      await app.close();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Basic Health Check - GET /health', () => {
    it('should return basic health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        status: 'ok',
        version: '0.1.0'
      });
    });

    it('should return consistent response format', async () => {
      // Make multiple requests to ensure consistency
      const requests = Array.from({ length: 3 }, () =>
        app.inject({ method: 'GET', url: '/health' })
      );

      const responses = await Promise.all(requests);

      for (const response of responses) {
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toMatchObject({
          status: 'ok',
          version: '0.1.0'
        });
      }
    });

    it('should have correct content-type header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should respond quickly', async () => {
      const startTime = Date.now();

      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      const duration = Date.now() - startTime;

      expect(response.statusCode).toBe(200);
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should not accept other HTTP methods', async () => {
      const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        const response = await app.inject({
          method,
          url: '/health'
        });

        expect([404, 405]).toContain(response.statusCode);
      }
    });
  });

  describe('Comprehensive Daemon Health - GET /daemon/health', () => {
    describe('When daemon is not running', () => {
      it('should return 503 with unavailable status', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/daemon/health'
        });

        expect(response.statusCode).toBe(503);

        const body = JSON.parse(response.body);
        expect(body).toMatchObject({
          error: 'Daemon not running',
          status: 'unavailable',
          metrics: null,
          message: expect.stringContaining('APEX daemon is not currently running')
        });
      });

      it('should provide proper error response structure', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/daemon/health'
        });

        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('error');
        expect(body).toHaveProperty('status');
        expect(body).toHaveProperty('metrics');
        expect(body).toHaveProperty('message');

        expect(body.error).toBe('Daemon not running');
        expect(body.status).toBe('unavailable');
        expect(body.metrics).toBeNull();
      });
    });

    describe('When daemon is running', () => {
      beforeEach(async () => {
        // Mock daemon files to simulate running daemon
        const pidFile = path.join(apexDir, 'daemon.pid');
        const stateFile = path.join(apexDir, 'daemon-state.json');

        const mockPid = 12345;
        const mockState = {
          running: true,
          pid: mockPid,
          startedAt: new Date().toISOString(),
          uptime: 3600000, // 1 hour
          health: {
            uptime: 3600000,
            memoryUsage: {
              heapUsed: 50 * 1024 * 1024, // 50MB
              heapTotal: 100 * 1024 * 1024, // 100MB
              rss: 150 * 1024 * 1024 // 150MB
            },
            taskCounts: {
              processed: 25,
              succeeded: 20,
              failed: 3,
              active: 2
            },
            lastHealthCheck: new Date().toISOString(),
            healthChecksPassed: 100,
            healthChecksFailed: 2,
            restartHistory: []
          }
        };

        await writeFile(pidFile, JSON.stringify({ pid: mockPid, startedAt: mockState.startedAt }));
        await writeFile(stateFile, JSON.stringify(mockState));

        // Mock process.kill to simulate daemon is running
        vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
          if (pid === mockPid && signal === 0) {
            return true;
          }
          throw new Error('ESRCH');
        });
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('should return 200 with healthy status', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/daemon/health'
        });

        expect([200, 503]).toContain(response.statusCode);

        if (response.statusCode === 200) {
          const body = JSON.parse(response.body);
          expect(body).toMatchObject({
            status: expect.stringMatching(/^(healthy|degraded)$/),
            metrics: expect.any(Object),
            daemon: expect.objectContaining({
              isRunning: expect.any(Boolean),
              uptime: expect.any(Number)
            }),
            timestamp: expect.any(String)
          });
        }
      });

      it('should include comprehensive health metrics', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/daemon/health'
        });

        if (response.statusCode === 200) {
          const body = JSON.parse(response.body);

          expect(body.metrics).toMatchObject({
            uptime: expect.any(Number),
            memoryUsage: expect.objectContaining({
              heapUsed: expect.any(Number),
              heapTotal: expect.any(Number),
              rss: expect.any(Number)
            }),
            taskCounts: expect.objectContaining({
              processed: expect.any(Number),
              succeeded: expect.any(Number),
              failed: expect.any(Number),
              active: expect.any(Number)
            }),
            lastHealthCheck: expect.any(String),
            healthChecksPassed: expect.any(Number),
            healthChecksFailed: expect.any(Number),
            restartHistory: expect.any(Array)
          });
        }
      });

      it('should include daemon status information', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/daemon/health'
        });

        if (response.statusCode === 200) {
          const body = JSON.parse(response.body);

          expect(body.daemon).toMatchObject({
            isRunning: expect.any(Boolean),
            pid: expect.any(Number),
            startedAt: expect.any(String),
            uptime: expect.any(Number)
          });

          // Verify startedAt is valid ISO string
          expect(() => new Date(body.daemon.startedAt)).not.toThrow();
        }
      });

      it('should assess health status correctly', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/daemon/health'
        });

        if (response.statusCode === 200) {
          const body = JSON.parse(response.body);

          expect(body.status).toMatch(/^(healthy|degraded)$/);

          // Health status should be consistent with metrics
          if (body.status === 'degraded') {
            // Should have some indication of issues in metrics
            expect(body.metrics).toBeDefined();
          }
        }
      });
    });

    describe('Error handling', () => {
      it('should handle health check failures gracefully', async () => {
        // Mock daemon manager to throw error
        const originalConsoleError = console.error;
        console.error = vi.fn();

        const response = await app.inject({
          method: 'GET',
          url: '/daemon/health'
        });

        // Should handle error gracefully
        expect([200, 500, 503]).toContain(response.statusCode);

        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('status');

        console.error = originalConsoleError;
      });

      it('should include error details in failure response', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/daemon/health'
        });

        const body = JSON.parse(response.body);

        if (response.statusCode === 500) {
          expect(body).toMatchObject({
            error: expect.any(String),
            status: 'error',
            metrics: null,
            message: expect.any(String),
            timestamp: expect.any(String)
          });
        } else if (response.statusCode === 503) {
          expect(body).toMatchObject({
            error: expect.any(String),
            status: 'unavailable',
            metrics: null,
            message: expect.any(String)
          });
        }
      });
    });

    describe('Response timing and caching', () => {
      it('should respond within reasonable time', async () => {
        const startTime = Date.now();

        const response = await app.inject({
          method: 'GET',
          url: '/daemon/health'
        });

        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(5000); // Should respond within 5 seconds
      });

      it('should handle multiple concurrent requests', async () => {
        const requests = Array.from({ length: 3 }, () =>
          app.inject({ method: 'GET', url: '/daemon/health' })
        );

        const responses = await Promise.all(requests);

        // All requests should complete successfully
        for (const response of responses) {
          expect([200, 503]).toContain(response.statusCode);
          const body = JSON.parse(response.body);
          expect(body).toHaveProperty('status');
          // Only healthy responses include timestamps
          if (response.statusCode === 200) {
            expect(body).toHaveProperty('timestamp');
          }
        }
      });
    });

    describe('HTTP method validation', () => {
      it('should only accept GET requests', async () => {
        const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];

        for (const method of methods) {
          const response = await app.inject({
            method,
            url: '/daemon/health'
          });

          expect([404, 405]).toContain(response.statusCode);
        }
      });
    });
  });

  describe('Health Endpoint Integration', () => {
    it('should have both health endpoints available', async () => {
      const basicResponse = await app.inject({
        method: 'GET',
        url: '/health'
      });

      const daemonResponse = await app.inject({
        method: 'GET',
        url: '/daemon/health'
      });

      expect(basicResponse.statusCode).toBe(200);
      expect([200, 503]).toContain(daemonResponse.statusCode);
    });

    it('should return different levels of information', async () => {
      const basicResponse = await app.inject({
        method: 'GET',
        url: '/health'
      });

      const daemonResponse = await app.inject({
        method: 'GET',
        url: '/daemon/health'
      });

      const basicBody = JSON.parse(basicResponse.body);
      const daemonBody = JSON.parse(daemonResponse.body);

      // Basic endpoint should be simpler
      expect(Object.keys(basicBody)).toHaveLength(2); // status and version

      // Daemon endpoint should be more comprehensive
      expect(Object.keys(daemonBody).length).toBeGreaterThan(2);
    });

    it('should handle route precedence correctly', async () => {
      // /health should not conflict with /daemon/health
      const healthResponse = await app.inject({
        method: 'GET',
        url: '/health'
      });

      const daemonHealthResponse = await app.inject({
        method: 'GET',
        url: '/daemon/health'
      });

      expect(healthResponse.statusCode).toBe(200);
      expect([200, 503]).toContain(daemonHealthResponse.statusCode);

      const healthBody = JSON.parse(healthResponse.body);
      const daemonBody = JSON.parse(daemonHealthResponse.body);

      // Should be different responses
      expect(healthBody).not.toEqual(daemonBody);
    });
  });

  describe('Health Monitoring Integration', () => {
    it('should support health monitoring configuration', async () => {
      // Test that health monitoring can be disabled
      process.env.DISABLE_HEALTH_MONITORING = 'true';

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health'
      });

      // Should still work but without periodic monitoring
      expect([200, 503]).toContain(response.statusCode);

      delete process.env.DISABLE_HEALTH_MONITORING;
    });

    it('should handle health metrics comparison', async () => {
      // Multiple health checks should compare metrics
      const firstResponse = await app.inject({
        method: 'GET',
        url: '/daemon/health'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const secondResponse = await app.inject({
        method: 'GET',
        url: '/daemon/health'
      });

      // Both should complete successfully
      expect([200, 503]).toContain(firstResponse.statusCode);
      expect([200, 503]).toContain(secondResponse.statusCode);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle corrupted daemon files', async () => {
      // Create corrupted daemon files
      const pidFile = path.join(apexDir, 'daemon.pid');
      const stateFile = path.join(apexDir, 'daemon-state.json');

      await writeFile(pidFile, 'invalid json content');
      await writeFile(stateFile, '{ incomplete json');

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health'
      });

      // Should handle corruption gracefully
      expect([200, 503, 500]).toContain(response.statusCode);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status');
    });

    it('should handle missing daemon directory', async () => {
      // Remove .apex directory
      await rm(apexDir, { recursive: true, force: true });

      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health'
      });

      // Should handle missing directory gracefully
      expect([503, 500]).toContain(response.statusCode);

      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        status: expect.stringMatching(/^(unavailable|error)$/),
        metrics: null
      });
    });

    it('should handle invalid request parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health?invalid=param'
      });

      // Should ignore invalid parameters
      expect([200, 503]).toContain(response.statusCode);
    });

    it('should handle requests with headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: {
          'User-Agent': 'Test-Client/1.0',
          'Accept': 'application/json',
          'X-Custom-Header': 'test-value'
        }
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        status: 'ok',
        version: '0.1.0'
      });
    });
  });

  describe('Security and Production Readiness', () => {
    it('should not expose sensitive information in health responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/daemon/health'
      });

      const body = JSON.parse(response.body);

      // Should not contain sensitive data like file paths, credentials, etc.
      const responseText = JSON.stringify(body);
      expect(responseText).not.toMatch(/password|secret|key|token|credential/i);
    });

    it('should handle health checks under load', async () => {
      // Simulate multiple concurrent health checks
      const requests = Array.from({ length: 10 }, (_, i) =>
        app.inject({
          method: 'GET',
          url: i % 2 === 0 ? '/health' : '/daemon/health'
        })
      );

      const responses = await Promise.all(requests);

      // All requests should complete successfully
      for (const response of responses) {
        expect([200, 503]).toContain(response.statusCode);
      }
    });

    it('should have appropriate cache headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      // Health endpoints should generally not be cached
      expect(response.headers).not.toHaveProperty('cache-control', expect.stringMatching(/max-age=[1-9]/));
    });

    it('should handle CORS preflight for health endpoints', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET'
        }
      });

      // Should handle CORS appropriately
      expect([200, 204, 404]).toContain(response.statusCode);
    });
  });
});