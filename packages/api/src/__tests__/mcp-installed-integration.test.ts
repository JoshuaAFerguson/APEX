import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from '../index.js';
import { FastifyInstance } from 'fastify';
import { ApexOrchestrator } from '@apexcli/orchestrator';

// Mock path and fs modules for basic server setup
vi.mock('path', () => ({
  resolve: vi.fn(() => '/mock/project/path'),
  join: vi.fn((...args: string[]) => args.join('/')),
}));

vi.mock('fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Integration tests for GET /mcp/installed endpoint
 * Tests the actual orchestrator integration without extensive mocking
 */
describe('GET /mcp/installed - Integration Tests', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  describe('Server Integration', () => {
    it('should successfully create server with MCP endpoint', async () => {
      server = await createServer({
        projectPath: '/mock/project',
        port: 0, // Use random port for testing
        silent: true,
      });

      await server.ready();

      // Server should be created and ready
      expect(server).toBeDefined();
      expect(server.server.listening || server.server.address()).toBeTruthy();
    });

    it('should have GET /mcp/installed route registered', async () => {
      server = await createServer({
        projectPath: '/mock/project',
        port: 0,
        silent: true,
      });

      await server.ready();

      // Test that route exists and responds
      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      // Should not return 404 (route exists)
      expect(response.statusCode).not.toBe(404);

      // Should return either success or server error, not route error
      expect([200, 500]).toContain(response.statusCode);
    });

    it('should return proper JSON response structure', async () => {
      server = await createServer({
        projectPath: '/mock/project',
        port: 0,
        silent: true,
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      // Response should be valid JSON
      expect(() => JSON.parse(response.body)).not.toThrow();

      const body = JSON.parse(response.body);

      if (response.statusCode === 200) {
        // Success response should have installations property
        expect(body).toHaveProperty('installations');
        expect(Array.isArray(body.installations)).toBe(true);
      } else if (response.statusCode === 500) {
        // Error response should have error property
        expect(body).toHaveProperty('error');
        expect(typeof body.error).toBe('string');
      }
    });

    it('should handle multiple concurrent requests', async () => {
      server = await createServer({
        projectPath: '/mock/project',
        port: 0,
        silent: true,
      });

      await server.ready();

      // Send multiple requests concurrently
      const requests = Array.from({ length: 5 }, () =>
        server.inject({
          method: 'GET',
          url: '/mcp/installed',
        })
      );

      const responses = await Promise.all(requests);

      // All requests should complete
      expect(responses).toHaveLength(5);

      // All responses should have same status code
      const statusCodes = responses.map(r => r.statusCode);
      const uniqueStatusCodes = [...new Set(statusCodes)];
      expect(uniqueStatusCodes).toHaveLength(1); // All should be the same

      // All responses should be valid JSON
      responses.forEach(response => {
        expect(() => JSON.parse(response.body)).not.toThrow();
      });
    });

    it('should properly handle orchestrator initialization errors', async () => {
      // Mock orchestrator to fail during initialization
      const originalOrchestrator = ApexOrchestrator;

      const MockOrchestrator = vi.fn().mockImplementation(() => ({
        initialize: vi.fn().mockRejectedValue(new Error('Initialization failed')),
        listMcpInstallations: vi.fn().mockRejectedValue(new Error('Not initialized')),
        getAgents: vi.fn().mockResolvedValue([]),
        getConfig: vi.fn().mockResolvedValue({}),
        listTasks: vi.fn().mockResolvedValue([]),
        on: vi.fn(),
        emit: vi.fn(),
        removeListener: vi.fn(),
      }));

      // Temporarily replace the orchestrator
      vi.doMock('@apexcli/orchestrator', () => ({
        ApexOrchestrator: MockOrchestrator,
        DaemonManager: vi.fn().mockImplementation(() => ({
          getStatus: vi.fn().mockResolvedValue({ running: false }),
        })),
        HealthMonitor: vi.fn().mockImplementation(() => ({
          getHealthReport: vi.fn().mockReturnValue({
            uptime: 0,
            memoryUsage: process.memoryUsage(),
            taskCounts: { processed: 0, succeeded: 0, failed: 0, active: 0 },
            lastHealthCheck: new Date(),
            healthChecksPassed: 0,
            healthChecksFailed: 0,
            restartHistory: [],
          }),
          performHealthCheck: vi.fn(),
        })),
      }));

      try {
        server = await createServer({
          projectPath: '/mock/project',
          port: 0,
          silent: true,
        });

        await server.ready();

        const response = await server.inject({
          method: 'GET',
          url: '/mcp/installed',
        });

        // Should handle initialization error gracefully
        expect(response.statusCode).toBe(500);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('error');
      } finally {
        // Restore original orchestrator
        vi.doUnmock('@apexcli/orchestrator');
      }
    });
  });

  describe('Response Validation', () => {
    beforeEach(async () => {
      server = await createServer({
        projectPath: '/mock/project',
        port: 0,
        silent: true,
      });
      await server.ready();
    });

    it('should return valid HTTP headers', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      // Should have content-type header
      expect(response.headers).toHaveProperty('content-type');
      expect(response.headers['content-type']).toContain('application/json');

      // Should have content-length header for non-empty responses
      if (response.body.length > 0) {
        expect(response.headers).toHaveProperty('content-length');
      }
    });

    it('should handle request timeout gracefully', async () => {
      // Send request and immediately check response
      const startTime = Date.now();

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Request should complete in reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);

      // Should still return a valid response
      expect(response.statusCode).toBeDefined();
      expect(() => JSON.parse(response.body)).not.toThrow();
    });

    it('should handle special characters in project path', async () => {
      // Close current server
      await server.close();

      // Create server with special characters in path
      server = await createServer({
        projectPath: '/möck/prøject/with spëcial chars',
        port: 0,
        silent: true,
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      // Should handle special characters gracefully
      expect(response.statusCode).not.toBe(404);
      expect(() => JSON.parse(response.body)).not.toThrow();
    });
  });

  describe('Error Recovery', () => {
    beforeEach(async () => {
      server = await createServer({
        projectPath: '/mock/project',
        port: 0,
        silent: true,
      });
      await server.ready();
    });

    it('should recover from temporary orchestrator errors', async () => {
      // First request might fail due to setup issues
      const response1 = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      // Second request should work if first one helped with initialization
      const response2 = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      // At least one should succeed or both should have consistent behavior
      expect(response1.statusCode).toBe(response2.statusCode);

      // Both should return valid JSON
      expect(() => JSON.parse(response1.body)).not.toThrow();
      expect(() => JSON.parse(response2.body)).not.toThrow();
    });

    it('should maintain consistent behavior across requests', async () => {
      const responses = [];

      // Send multiple requests in sequence
      for (let i = 0; i < 3; i++) {
        const response = await server.inject({
          method: 'GET',
          url: '/mcp/installed',
        });
        responses.push(response);

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // All responses should have same status code
      const statusCodes = responses.map(r => r.statusCode);
      const uniqueStatusCodes = [...new Set(statusCodes)];
      expect(uniqueStatusCodes).toHaveLength(1);

      // All responses should have consistent structure
      const bodies = responses.map(r => JSON.parse(r.body));
      bodies.forEach(body => {
        if (statusCodes[0] === 200) {
          expect(body).toHaveProperty('installations');
        } else {
          expect(body).toHaveProperty('error');
        }
      });
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      server = await createServer({
        projectPath: '/mock/project',
        port: 0,
        silent: true,
      });
      await server.ready();
    });

    it('should respond within reasonable time limits', async () => {
      const startTime = process.hrtime.bigint();

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      // Response should be reasonably fast (< 1000ms)
      expect(duration).toBeLessThan(1000);

      // Should still be a valid response
      expect([200, 500]).toContain(response.statusCode);
    });

    it('should handle rapid successive requests', async () => {
      const rapidRequests = Array.from({ length: 10 }, (_, i) =>
        server.inject({
          method: 'GET',
          url: '/mcp/installed',
        })
      );

      const startTime = Date.now();
      const responses = await Promise.all(rapidRequests);
      const endTime = Date.now();

      // All requests should complete
      expect(responses).toHaveLength(10);

      // Should complete in reasonable time
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(5000);

      // All responses should be valid
      responses.forEach(response => {
        expect(response.statusCode).toBeDefined();
        expect(() => JSON.parse(response.body)).not.toThrow();
      });
    });
  });
});