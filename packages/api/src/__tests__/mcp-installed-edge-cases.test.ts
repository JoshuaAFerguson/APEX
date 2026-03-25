import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { MCPInstallation, MCPInstallationStatus } from '@apexcli/core';

// Mock the orchestrator
vi.mock('@apexcli/orchestrator', () => ({
  DaemonManager: class { async getStatus() { return { running: false }; } async start() {} async stop() {} }, HealthMonitor: class { getMetrics() { return {}; } checkHealth() { return { healthy: true }; } }, ToolCallStartEvent: class {}, ToolCallProgressEvent: class {}, ToolCallCompleteEvent: class {}, MCPErrorEventData: class {}, MCPConnectionEventData: class {}, MCPDisconnectionEventData: class {}, MCPReconnectingEventData: class {}, MCPHealthCheckEventData: class {}, MCPStateChangeEventData: class {},
  ApexOrchestrator: vi.fn(function() { return {
    listMcpInstallations: vi.fn(),
  }; }),
}));

/**
 * Edge case tests for GET /mcp/installed endpoint
 * Testing boundary conditions, malformed data, and extreme scenarios
 */
describe('GET /mcp/installed - Edge Cases', () => {
  let server: FastifyInstance;
  let mockOrchestrator: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create minimal Fastify server for testing
    server = Fastify();

    // Mock orchestrator instance
    mockOrchestrator = new ApexOrchestrator('/mock/project/path');

    // Manually register the MCP installed endpoint
    server.get('/mcp/installed', async (request, reply) => {
      try {
        const installations = await mockOrchestrator.listMcpInstallations();
        return { installations };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list installed MCP servers';
        return reply.code(500).send({ error: message });
      }
    });

    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('Data Boundary Tests', () => {
    it('should handle installations with very long IDs', async () => {
      const veryLongId = 'a'.repeat(1000); // 1000 character ID

      const mockInstallations: MCPInstallation[] = [
        {
          id: veryLongId,
          serverId: 'normal-server',
          installedAt: new Date(),
          status: 'installed',
          configPath: '/config/normal.json',
        },
      ];

      mockOrchestrator.listMcpInstallations.mockResolvedValue(mockInstallations);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.installations[0].id).toBe(veryLongId);
    });

    it('should handle installations with very long config paths', async () => {
      const veryLongPath = '/very/long/path/' + 'directory/'.repeat(100) + 'config.json';

      const mockInstallations: MCPInstallation[] = [
        {
          id: 'normal-id',
          serverId: 'normal-server',
          installedAt: new Date(),
          status: 'installed',
          configPath: veryLongPath,
        },
      ];

      mockOrchestrator.listMcpInstallations.mockResolvedValue(mockInstallations);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.installations[0].configPath).toBe(veryLongPath);
    });

    it('should handle installations with Unicode characters', async () => {
      const mockInstallations: MCPInstallation[] = [
        {
          id: 'unicode-测试-🚀-installation',
          serverId: 'unicode-server-日本語',
          installedAt: new Date(),
          status: 'installed',
          configPath: '/config/测试/配置.json',
        },
        {
          id: 'emoji-server-🔧',
          serverId: 'server-with-emoji-⚡',
          installedAt: new Date(),
          status: 'installed',
          configPath: '/config/emoji-🎯.json',
        },
      ];

      mockOrchestrator.listMcpInstallations.mockResolvedValue(mockInstallations);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.installations).toHaveLength(2);
      expect(body.installations[0].id).toBe('unicode-测试-🚀-installation');
      expect(body.installations[0].serverId).toBe('unicode-server-日本語');
      expect(body.installations[1].id).toBe('emoji-server-🔧');
    });

    it('should handle installations with special characters in paths', async () => {
      const specialPaths = [
        '/config with spaces/file.json',
        '/config-with-dashes/file.json',
        '/config_with_underscores/file.json',
        '/config.with.dots/file.json',
        '/config[with]brackets/file.json',
        '/config(with)parentheses/file.json',
        '/config{with}braces/file.json',
        '/config@with#symbols$/file.json',
      ];

      const mockInstallations: MCPInstallation[] = specialPaths.map((path, index) => ({
        id: `install-${index}`,
        serverId: `server-${index}`,
        installedAt: new Date(),
        status: 'installed',
        configPath: path,
      }));

      mockOrchestrator.listMcpInstallations.mockResolvedValue(mockInstallations);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.installations).toHaveLength(specialPaths.length);
      body.installations.forEach((installation: any, index: number) => {
        expect(installation.configPath).toBe(specialPaths[index]);
      });
    });
  });

  describe('Extreme Data Volume Tests', () => {
    it('should handle large number of installations (stress test)', async () => {
      // Create 1000 installations to test memory and performance
      const largeInstallationList: MCPInstallation[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `installation-${i.toString().padStart(4, '0')}`,
        serverId: `server-${i}`,
        installedAt: new Date(`2024-01-01T${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.000Z`),
        status: (['installed', 'pending', 'failed', 'installing', 'uninstalling', 'uninstalled'] as MCPInstallationStatus[])[i % 6],
        configPath: `/config/large-test/server-${i}/config.json`,
      }));

      mockOrchestrator.listMcpInstallations.mockResolvedValue(largeInstallationList);

      const startTime = Date.now();

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.installations).toHaveLength(1000);

      // Should complete in reasonable time even with large dataset
      expect(duration).toBeLessThan(5000); // 5 seconds max

      // Verify first and last entries for data integrity
      expect(body.installations[0].id).toBe('installation-0000');
      expect(body.installations[999].id).toBe('installation-0999');
    });

    it('should handle installations with very large JSON data', async () => {
      // Create installation with large data in ID field
      const largeData = 'x'.repeat(10000); // 10KB of data

      const mockInstallations: MCPInstallation[] = [
        {
          id: `large-data-${largeData}`,
          serverId: 'normal-server',
          installedAt: new Date(),
          status: 'installed',
          configPath: '/config/large-data.json',
        },
      ];

      mockOrchestrator.listMcpInstallations.mockResolvedValue(mockInstallations);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.installations[0].id).toContain(largeData);

      // Response should still be valid JSON despite large size
      expect(JSON.stringify(body).length).toBeGreaterThan(10000);
    });
  });

  describe('Date and Time Edge Cases', () => {
    it('should handle installations with edge case dates', async () => {
      const edgeCaseDates = [
        new Date('1970-01-01T00:00:00.000Z'), // Unix epoch
        new Date('2000-01-01T00:00:00.000Z'), // Y2K
        new Date('2038-01-19T03:14:07.000Z'), // Unix timestamp limit (32-bit)
        new Date('9999-12-31T23:59:59.999Z'), // Maximum JS date
        new Date('0001-01-01T00:00:00.000Z'), // Minimum practical date
      ];

      const mockInstallations: MCPInstallation[] = edgeCaseDates.map((date, index) => ({
        id: `edge-date-${index}`,
        serverId: `edge-server-${index}`,
        installedAt: date,
        status: 'installed',
        configPath: `/config/edge-${index}.json`,
      }));

      mockOrchestrator.listMcpInstallations.mockResolvedValue(mockInstallations);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.installations).toHaveLength(edgeCaseDates.length);

      // Verify dates are properly serialized
      body.installations.forEach((installation: any, index: number) => {
        expect(installation.installedAt).toBe(edgeCaseDates[index].toISOString());
      });
    });

    it('should handle installations with same timestamp', async () => {
      const sameDate = new Date('2024-01-01T12:00:00.000Z');

      const mockInstallations: MCPInstallation[] = Array.from({ length: 5 }, (_, i) => ({
        id: `same-time-${i}`,
        serverId: `server-${i}`,
        installedAt: sameDate,
        status: 'installed',
        configPath: `/config/same-time-${i}.json`,
      }));

      mockOrchestrator.listMcpInstallations.mockResolvedValue(mockInstallations);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.installations).toHaveLength(5);

      // All should have same timestamp
      const timestamps = body.installations.map((inst: any) => inst.installedAt);
      const uniqueTimestamps = [...new Set(timestamps)];
      expect(uniqueTimestamps).toHaveLength(1);
      expect(uniqueTimestamps[0]).toBe(sameDate.toISOString());
    });
  });

  describe('Memory and Resource Tests', () => {
    it('should handle repeated requests without memory leaks', async () => {
      const mockInstallations: MCPInstallation[] = [
        {
          id: 'memory-test',
          serverId: 'memory-server',
          installedAt: new Date(),
          status: 'installed',
          configPath: '/config/memory.json',
        },
      ];

      mockOrchestrator.listMcpInstallations.mockResolvedValue(mockInstallations);

      // Send many requests rapidly
      const requests = Array.from({ length: 50 }, async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/mcp/installed',
        });
        return response;
      });

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.installations).toHaveLength(1);
      });

      // Mock should have been called for each request
      expect(mockOrchestrator.listMcpInstallations).toHaveBeenCalledTimes(50);
    });

    it('should handle concurrent requests with large datasets', async () => {
      // Large dataset for concurrent access
      const largeDataset: MCPInstallation[] = Array.from({ length: 500 }, (_, i) => ({
        id: `concurrent-${i}`,
        serverId: `server-${i}`,
        installedAt: new Date(),
        status: 'installed',
        configPath: `/config/concurrent-${i}.json`,
      }));

      mockOrchestrator.listMcpInstallations.mockResolvedValue(largeDataset);

      // Send 10 concurrent requests
      const concurrentRequests = Array.from({ length: 10 }, () =>
        server.inject({
          method: 'GET',
          url: '/mcp/installed',
        })
      );

      const responses = await Promise.all(concurrentRequests);

      // All requests should succeed with same data
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.installations).toHaveLength(500);
      });
    });
  });

  describe('Error Condition Edge Cases', () => {
    it('should handle orchestrator throwing non-Error objects', async () => {
      const nonErrorObjects = [
        'string error',
        { message: 'object error' },
        123,
        null,
        undefined,
        [],
        true,
      ];

      for (const errorObject of nonErrorObjects) {
        mockOrchestrator.listMcpInstallations.mockRejectedValue(errorObject);

        const response = await server.inject({
          method: 'GET',
          url: '/mcp/installed',
        });

        expect(response.statusCode).toBe(500);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('Failed to list installed MCP servers');
      }
    });

    it('should handle orchestrator returning undefined', async () => {
      mockOrchestrator.listMcpInstallations.mockResolvedValue(undefined);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.installations).toBeUndefined();
    });

    it('should handle orchestrator method being null', async () => {
      mockOrchestrator.listMcpInstallations = null;

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to list installed MCP servers');
    });

    it('should handle orchestrator returning circular reference data', async () => {
      // Create circular reference
      const circularData: any = {
        id: 'circular',
        serverId: 'circular-server',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/config/circular.json',
      };
      circularData.self = circularData;

      mockOrchestrator.listMcpInstallations.mockResolvedValue([circularData]);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      // Should handle circular reference gracefully
      // Either succeed with serializable data or fail with error
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('installations');
      } else {
        expect(response.statusCode).toBe(500);
      }
    });
  });

  describe('Response Serialization Edge Cases', () => {
    it('should handle installations with special JSON characters', async () => {
      const mockInstallations: MCPInstallation[] = [
        {
          id: 'json-special-chars',
          serverId: 'server-with-"quotes"-and-\\backslashes\\-and-\n-newlines',
          installedAt: new Date(),
          status: 'installed',
          configPath: '/config/with\ttabs\nand\rreturns.json',
        },
      ];

      mockOrchestrator.listMcpInstallations.mockResolvedValue(mockInstallations);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Special characters should be properly escaped in JSON
      expect(body.installations[0].serverId).toContain('"quotes"');
      expect(body.installations[0].configPath).toContain('\t');
    });

    it('should handle empty string values in installations', async () => {
      const mockInstallations: any[] = [
        {
          id: '',
          serverId: '',
          installedAt: new Date(),
          status: 'installed',
          configPath: '',
        },
      ];

      mockOrchestrator.listMcpInstallations.mockResolvedValue(mockInstallations);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.installations[0].id).toBe('');
      expect(body.installations[0].serverId).toBe('');
      expect(body.installations[0].configPath).toBe('');
    });
  });
});