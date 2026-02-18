/**
 * Performance tests for MockServer class
 *
 * Tests for high-load scenarios, memory usage, and response times
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockServer } from '../mock-server';

describe('MockServer Performance', () => {
  let mockServer: MockServer;

  afterEach(async () => {
    if (mockServer && mockServer.isRunning()) {
      await mockServer.stop();
    }
  });

  describe('Response time tests', () => {
    it('should respond to health checks quickly', async () => {
      mockServer = new MockServer();
      await mockServer.start();

      const startTime = Date.now();
      const response = await fetch(`${mockServer.getUrl()}/health`);
      const endTime = Date.now();

      expect(response.status).toBe(200);

      // Response should be under 100ms for local health check
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(100);
    });

    it('should handle burst requests efficiently', async () => {
      mockServer = new MockServer();
      await mockServer.start();

      const burstSize = 100;
      const startTime = Date.now();

      // Create burst of concurrent requests
      const requests = Array.from({ length: burstSize }, () =>
        fetch(`${mockServer.getUrl()}/ping`).then(r => r.json())
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();

      // All requests should succeed
      expect(responses).toHaveLength(burstSize);
      responses.forEach(response => {
        expect(response).toEqual({ message: 'pong' });
      });

      // Total time should be reasonable (under 5 seconds for 100 requests)
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(5000);
    });
  });

  describe('Memory usage tests', () => {
    it('should handle many route registrations without memory leaks', async () => {
      mockServer = new MockServer();

      // Register many routes
      for (let i = 0; i < 100; i++) {
        await mockServer.addRoutes((app) => {
          app.get(`/route-${i}`, async () => ({ id: i }));
        });
      }

      await mockServer.start();

      // Test a sample of routes to ensure they work
      const testRoutes = [0, 25, 50, 75, 99];
      for (const routeId of testRoutes) {
        const response = await fetch(`${mockServer.getUrl()}/route-${routeId}`);
        const data = await response.json();
        expect(data).toEqual({ id: routeId });
      }
    });

    it('should handle multiple server instances efficiently', async () => {
      const servers: MockServer[] = [];

      try {
        // Create and start multiple servers
        for (let i = 0; i < 10; i++) {
          const server = new MockServer();
          await server.start();
          servers.push(server);
        }

        // All servers should be running on different ports
        const ports = servers.map(s => s.getPort());
        const uniquePorts = new Set(ports);
        expect(uniquePorts.size).toBe(10);

        // Test each server
        for (let i = 0; i < servers.length; i++) {
          const response = await fetch(`${servers[i].getUrl()}/health`);
          expect(response.status).toBe(200);
        }
      } finally {
        // Cleanup all servers
        await Promise.all(servers.map(server =>
          server.isRunning() ? server.stop() : Promise.resolve()
        ));
      }
    });
  });

  describe('Scalability tests', () => {
    it('should handle large response payloads efficiently', async () => {
      mockServer = new MockServer();

      await mockServer.addRoutes((app) => {
        app.get('/large-data', async () => {
          // Generate a large JSON response (~1MB)
          const largeArray = Array.from({ length: 50000 }, (_, i) => ({
            id: i,
            data: `item-${i}-${'x'.repeat(10)}`,
            timestamp: Date.now(),
          }));
          return { items: largeArray, total: largeArray.length };
        });
      });

      await mockServer.start();

      const startTime = Date.now();
      const response = await fetch(`${mockServer.getUrl()}/large-data`);
      const data = await response.json();
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(50000);

      // Should handle large response in reasonable time (under 2 seconds)
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(2000);
    });

    it('should maintain performance under sustained load', async () => {
      mockServer = new MockServer();
      await mockServer.start();

      const rounds = 5;
      const requestsPerRound = 20;
      const responseTimes: number[] = [];

      for (let round = 0; round < rounds; round++) {
        const roundStartTime = Date.now();

        const requests = Array.from({ length: requestsPerRound }, () =>
          fetch(`${mockServer.getUrl()}/health`)
        );

        const responses = await Promise.all(requests);
        const roundEndTime = Date.now();

        // All requests should succeed
        responses.forEach(response => {
          expect(response.status).toBe(200);
        });

        const roundTime = roundEndTime - roundStartTime;
        responseTimes.push(roundTime);
      }

      // Performance should be consistent across rounds
      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxTime = Math.max(...responseTimes);
      const minTime = Math.min(...responseTimes);

      // Performance variance should be reasonable
      expect(maxTime - minTime).toBeLessThan(avgTime * 2);
      expect(avgTime).toBeLessThan(1000); // Average round should be under 1 second
    });
  });

  describe('Resource cleanup tests', () => {
    it('should properly clean up resources on stop', async () => {
      mockServer = new MockServer();
      await mockServer.start();

      const initialPort = mockServer.getPort();
      await mockServer.stop();

      // Should be able to start again (resources properly cleaned up)
      await mockServer.start();
      expect(mockServer.isRunning()).toBe(true);

      // May get same or different port
      const newPort = mockServer.getPort();
      expect(newPort).toBeGreaterThan(0);
    });

    it('should handle abrupt termination scenarios', async () => {
      mockServer = new MockServer();
      await mockServer.start();

      const fastifyInstance = await mockServer.getFastifyInstance();

      // Simulate abrupt termination
      await fastifyInstance.close();

      // Server should recognize it's not running
      expect(mockServer.isRunning()).toBe(false);

      // Should be able to start a new instance
      const newServer = new MockServer();
      await newServer.start();

      expect(newServer.isRunning()).toBe(true);
      await newServer.stop();
    });
  });
});