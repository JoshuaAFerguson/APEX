/**
 * Edge case tests for MockServer class
 *
 * Tests for error handling, resource constraints, and unusual scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockServer } from '../mock-server';

describe('MockServer Edge Cases', () => {
  let mockServer: MockServer;

  afterEach(async () => {
    // Cleanup: ensure server is stopped after each test
    if (mockServer && mockServer.isRunning()) {
      await mockServer.stop();
    }
  });

  describe('Error handling scenarios', () => {
    it('should handle null/undefined in route registration', async () => {
      mockServer = new MockServer();

      // Should not crash when registering empty route handler
      await expect(
        mockServer.addRoutes((app) => {
          // Empty registration function
        })
      ).resolves.toBeUndefined();
    });

    it('should handle server close during operation', async () => {
      mockServer = new MockServer();
      await mockServer.start();

      const fastifyInstance = await mockServer.getFastifyInstance();

      // Forcefully close the underlying server
      await fastifyInstance.close();

      // Should handle the case gracefully
      expect(mockServer.isRunning()).toBe(false);
    });

    it('should handle requests to non-existent routes', async () => {
      mockServer = new MockServer();
      await mockServer.start();

      const response = await fetch(`${mockServer.getUrl()}/nonexistent`);
      expect(response.status).toBe(404);
    });

    it('should handle invalid JSON in POST requests', async () => {
      mockServer = new MockServer();
      await mockServer.start();

      const response = await fetch(`${mockServer.getUrl()}/echo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid-json{',
      });

      // Should handle malformed JSON gracefully
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Resource limits and constraints', () => {
    it('should handle large request bodies', async () => {
      mockServer = new MockServer();
      await mockServer.start();

      // Create a large request body (1MB)
      const largeData = 'x'.repeat(1024 * 1024);

      const response = await fetch(`${mockServer.getUrl()}/echo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: largeData }),
      });

      // Should handle large requests (may have limits based on Fastify config)
      expect(response.status).toBeLessThan(500);
    });

    it('should handle concurrent requests', async () => {
      mockServer = new MockServer();
      await mockServer.start();

      const requests = [];
      for (let i = 0; i < 50; i++) {
        requests.push(
          fetch(`${mockServer.getUrl()}/health`).then(r => r.json())
        );
      }

      const responses = await Promise.all(requests);

      // All requests should succeed
      expect(responses).toHaveLength(50);
      responses.forEach(response => {
        expect(response).toHaveProperty('status', 'ok');
      });
    });

    it('should handle multiple start/stop cycles with custom routes', async () => {
      mockServer = new MockServer();

      for (let cycle = 0; cycle < 5; cycle++) {
        await mockServer.addRoutes((app) => {
          app.get(`/test-${cycle}`, async () => ({ cycle }));
        });

        await mockServer.start();

        const response = await fetch(`${mockServer.getUrl()}/test-${cycle}`);
        const data = await response.json();
        expect(data).toEqual({ cycle });

        await mockServer.stop();
      }
    });
  });

  describe('Configuration edge cases', () => {
    it('should handle empty server options', () => {
      const server = new MockServer({
        serverOptions: {},
      });

      expect(server.getHost()).toBe('127.0.0.1');
    });

    it('should handle custom host configurations', async () => {
      // Test with localhost
      const server1 = new MockServer({ host: 'localhost' });
      expect(server1.getHost()).toBe('localhost');

      // Test with 0.0.0.0
      const server2 = new MockServer({ host: '0.0.0.0' });
      expect(server2.getHost()).toBe('0.0.0.0');
    });

    it('should handle complex logger configuration', () => {
      const server = new MockServer({
        logger: {
          level: 'info',
          transport: {
            target: 'pino-pretty'
          }
        }
      });

      expect(server.getHost()).toBe('127.0.0.1');
    });
  });

  describe('Route parameter edge cases', () => {
    it('should handle special characters in status route', async () => {
      mockServer = new MockServer();
      await mockServer.start();

      // Test non-numeric status codes
      const response1 = await fetch(`${mockServer.getUrl()}/status/abc`);
      expect(response1.status).toBe(400);

      // Test negative numbers
      const response2 = await fetch(`${mockServer.getUrl()}/status/-1`);
      expect(response2.status).toBe(400);

      // Test out-of-range status codes
      const response3 = await fetch(`${mockServer.getUrl()}/status/999`);
      expect(response3.status).toBe(400);
    });

    it('should handle complex request headers in echo route', async () => {
      mockServer = new MockServer();
      await mockServer.start();

      const response = await fetch(`${mockServer.getUrl()}/echo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'test-value',
          'Authorization': 'Bearer token123',
        },
        body: JSON.stringify({ test: 'data' }),
      });

      const data = await response.json();
      expect(data.headers).toHaveProperty('x-custom-header', 'test-value');
      expect(data.headers).toHaveProperty('authorization', 'Bearer token123');
    });
  });

  describe('Timing and async behavior', () => {
    it('should handle rapid start/stop without race conditions', async () => {
      mockServer = new MockServer();

      // Rapidly start and stop the server
      await mockServer.start();
      const port1 = mockServer.getPort();
      await mockServer.stop();

      await mockServer.start();
      const port2 = mockServer.getPort();
      await mockServer.stop();

      // Ports may be the same or different, but operations should succeed
      expect(port1).toBeGreaterThan(0);
      expect(port2).toBeGreaterThan(0);
    });

    it('should handle route addition after Fastify initialization', async () => {
      mockServer = new MockServer();

      // Initialize Fastify instance
      const fastifyInstance = await mockServer.getFastifyInstance();
      expect(fastifyInstance).toBeDefined();

      // Add routes after initialization
      await mockServer.addRoutes((app) => {
        app.get('/late-route', async () => ({ late: true }));
      });

      await mockServer.start();

      const response = await fetch(`${mockServer.getUrl()}/late-route`);
      const data = await response.json();
      expect(data).toEqual({ late: true });
    });
  });
});