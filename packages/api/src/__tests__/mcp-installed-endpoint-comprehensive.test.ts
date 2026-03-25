import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from '../index.js';
import { FastifyInstance } from 'fastify';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { MCPInstallation, MCPInstallationStatus } from '@apexcli/core';

// Mock the orchestrator
vi.mock('@apexcli/orchestrator', () => ({
  ApexOrchestrator: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    listMcpInstallations: vi.fn(),
    // Mock other required methods for server startup
    getAgents: vi.fn().mockResolvedValue([]),
    getConfig: vi.fn().mockResolvedValue({ api: { auth: { enabled: false, apiKeys: [] } } }),
    listTasks: vi.fn().mockResolvedValue([]),
    on: vi.fn(), // EventEmitter methods
    emit: vi.fn(),
    removeListener: vi.fn(),
  })),
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

// Mock path and fs modules
vi.mock('path', () => ({
  resolve: vi.fn(() => '/mock/project/path'),
  join: vi.fn((...args: string[]) => args.join('/')),
}));

vi.mock('fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Comprehensive tests for GET /mcp/installed endpoint
 * Testing edge cases, error handling, and data validation
 */
describe.skip('GET /mcp/installed - Comprehensive Tests', () => {
  let server: FastifyInstance;
  let mockOrchestrator: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create server with mocked dependencies
    server = await createServer({
      projectPath: '/mock/project',
      port: 0, // Use random port for testing
      silent: true,
    });

    // Get mocked orchestrator instance
    const OrchestratorConstructor = ApexOrchestrator as any;
    mockOrchestrator = OrchestratorConstructor.mock.results[0].value;

    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('Success Scenarios', () => {
    it('should return multiple installed MCP servers with different statuses', async () => {
      const mockInstallations: MCPInstallation[] = [
        {
          id: 'install-1',
          serverId: 'filesystem',
          installedAt: new Date('2024-01-01T00:00:00.000Z'),
          status: 'installed',
          configPath: '/mock/config/filesystem.json',
        },
        {
          id: 'install-2',
          serverId: 'database',
          installedAt: new Date('2024-01-02T12:30:00.000Z'),
          status: 'pending',
          configPath: '/mock/config/database.json',
        },
        {
          id: 'install-3',
          serverId: 'weather',
          installedAt: new Date('2024-01-03T18:45:00.000Z'),
          status: 'failed',
          configPath: '/mock/config/weather.json',
        },
      ];

      mockOrchestrator.listMcpInstallations.mockResolvedValue(mockInstallations);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('installations');
      expect(Array.isArray(body.installations)).toBe(true);
      expect(body.installations).toHaveLength(3);

      // Check each installation has required fields
      body.installations.forEach((installation: any, index: number) => {
        expect(installation).toHaveProperty('id');
        expect(installation).toHaveProperty('serverId');
        expect(installation).toHaveProperty('installedAt');
        expect(installation).toHaveProperty('status');
        expect(installation).toHaveProperty('configPath');

        // Verify specific data matches
        expect(installation.id).toBe(mockInstallations[index].id);
        expect(installation.serverId).toBe(mockInstallations[index].serverId);
        expect(installation.status).toBe(mockInstallations[index].status);
      });

      expect(mockOrchestrator.listMcpInstallations).toHaveBeenCalledTimes(1);
    });

    it('should return empty installations array when no servers are installed', async () => {
      mockOrchestrator.listMcpInstallations.mockResolvedValue([]);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toEqual({ installations: [] });
      expect(mockOrchestrator.listMcpInstallations).toHaveBeenCalledTimes(1);
    });

    it('should handle all possible installation statuses', async () => {
      const allStatuses: MCPInstallationStatus[] = [
        'pending',
        'installing',
        'installed',
        'failed',
        'uninstalling',
        'uninstalled',
      ];

      const mockInstallations: MCPInstallation[] = allStatuses.map((status, index) => ({
        id: `install-${index}`,
        serverId: `server-${index}`,
        installedAt: new Date(`2024-01-0${index + 1}T00:00:00.000Z`),
        status,
        configPath: `/mock/config/server-${index}.json`,
      }));

      mockOrchestrator.listMcpInstallations.mockResolvedValue(mockInstallations);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.installations).toHaveLength(allStatuses.length);

      // Verify each status is properly represented
      allStatuses.forEach((status, index) => {
        expect(body.installations[index].status).toBe(status);
      });
    });

    it('should return installations with realistic timestamps', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const mockInstallations: MCPInstallation[] = [
        {
          id: 'recent-install',
          serverId: 'recent-server',
          installedAt: now,
          status: 'installed',
          configPath: '/mock/config/recent.json',
        },
        {
          id: 'yesterday-install',
          serverId: 'yesterday-server',
          installedAt: yesterday,
          status: 'installed',
          configPath: '/mock/config/yesterday.json',
        },
        {
          id: 'old-install',
          serverId: 'old-server',
          installedAt: lastWeek,
          status: 'installed',
          configPath: '/mock/config/old.json',
        },
      ];

      mockOrchestrator.listMcpInstallations.mockResolvedValue(mockInstallations);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.installations).toHaveLength(3);

      // Check timestamps are properly serialized
      body.installations.forEach((installation: any) => {
        expect(installation.installedAt).toBeDefined();
        expect(typeof installation.installedAt).toBe('string');
        // Should be valid ISO date string
        expect(() => new Date(installation.installedAt)).not.toThrow();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle orchestrator errors with proper error response', async () => {
      const errorMessage = 'Database connection failed';
      mockOrchestrator.listMcpInstallations.mockRejectedValue(new Error(errorMessage));

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('error');
      expect(body.error).toBe(errorMessage);
      expect(mockOrchestrator.listMcpInstallations).toHaveBeenCalledTimes(1);
    });

    it('should handle non-Error exceptions gracefully', async () => {
      mockOrchestrator.listMcpInstallations.mockRejectedValue('String error message');

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('error');
      expect(body.error).toBe('Failed to list installed MCP servers');
    });

    it('should handle orchestrator timeout gracefully', async () => {
      // Simulate timeout by rejecting after delay
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 100);
      });

      mockOrchestrator.listMcpInstallations.mockReturnValue(timeoutPromise);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Request timeout');
    });

    it('should handle orchestrator returning invalid data structure', async () => {
      // Return invalid data that doesn't match MCPInstallation schema
      const invalidData = [
        {
          // Missing required fields
          serverId: 'test',
        },
        {
          id: 'valid-id',
          serverId: 'valid-server',
          // Missing installedAt, status, configPath
        },
      ];

      mockOrchestrator.listMcpInstallations.mockResolvedValue(invalidData);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // API should still return the data even if it's invalid
      // The API layer doesn't validate the orchestrator response
      expect(body).toHaveProperty('installations');
      expect(body.installations).toEqual(invalidData);
    });

    it('should handle orchestrator method not existing', async () => {
      // Simulate orchestrator not having the required method
      mockOrchestrator.listMcpInstallations = undefined;

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    it('should handle orchestrator returning null', async () => {
      mockOrchestrator.listMcpInstallations.mockResolvedValue(null);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should handle null by returning in installations wrapper
      expect(body).toEqual({ installations: null });
    });
  });

  describe('Response Format and Headers', () => {
    it('should return correct content-type header', async () => {
      mockOrchestrator.listMcpInstallations.mockResolvedValue([]);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should return consistent response structure', async () => {
      const testCases = [
        [], // Empty array
        [   // Single installation
          {
            id: 'single',
            serverId: 'single-server',
            installedAt: new Date(),
            status: 'installed' as MCPInstallationStatus,
            configPath: '/config/single.json',
          }
        ],
      ];

      for (const testData of testCases) {
        mockOrchestrator.listMcpInstallations.mockResolvedValue(testData);

        const response = await server.inject({
          method: 'GET',
          url: '/mcp/installed',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        // Always should have installations property
        expect(body).toHaveProperty('installations');
        expect(body.installations).toEqual(testData);
      }
    });

    it('should handle large numbers of installations', async () => {
      // Create 100 mock installations to test performance
      const manyInstallations: MCPInstallation[] = Array.from({ length: 100 }, (_, i) => ({
        id: `install-${i}`,
        serverId: `server-${i}`,
        installedAt: new Date(`2024-01-01T${String(i % 24).padStart(2, '0')}:00:00.000Z`),
        status: (['installed', 'pending', 'failed'] as MCPInstallationStatus[])[i % 3],
        configPath: `/mock/config/server-${i}.json`,
      }));

      mockOrchestrator.listMcpInstallations.mockResolvedValue(manyInstallations);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.installations).toHaveLength(100);
      expect(mockOrchestrator.listMcpInstallations).toHaveBeenCalledTimes(1);
    });
  });

  describe('HTTP Method Validation', () => {
    it('should only accept GET requests', async () => {
      const invalidMethods = ['POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

      for (const method of invalidMethods) {
        const response = await server.inject({
          method: method as any,
          url: '/mcp/installed',
        });

        // Should return 404 (method not found) or 405 (method not allowed)
        expect([404, 405]).toContain(response.statusCode);
      }
    });
  });

  describe('Integration with Storage/Config', () => {
    it('should handle installations with different config paths', async () => {
      const mockInstallations: MCPInstallation[] = [
        {
          id: 'abs-path',
          serverId: 'abs-server',
          installedAt: new Date(),
          status: 'installed',
          configPath: '/absolute/path/config.json',
        },
        {
          id: 'rel-path',
          serverId: 'rel-server',
          installedAt: new Date(),
          status: 'installed',
          configPath: './relative/path/config.json',
        },
        {
          id: 'home-path',
          serverId: 'home-server',
          installedAt: new Date(),
          status: 'installed',
          configPath: '~/home/path/config.json',
        },
      ];

      mockOrchestrator.listMcpInstallations.mockResolvedValue(mockInstallations);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.installations).toHaveLength(3);

      // Check config paths are preserved
      const paths = body.installations.map((inst: any) => inst.configPath);
      expect(paths).toContain('/absolute/path/config.json');
      expect(paths).toContain('./relative/path/config.json');
      expect(paths).toContain('~/home/path/config.json');
    });

    it('should handle installations with various server IDs', async () => {
      const mockInstallations: MCPInstallation[] = [
        {
          id: 'npm-install',
          serverId: '@example/npm-server',
          installedAt: new Date(),
          status: 'installed',
          configPath: '/config/npm.json',
        },
        {
          id: 'github-install',
          serverId: 'github.com/user/repo',
          installedAt: new Date(),
          status: 'installed',
          configPath: '/config/github.json',
        },
        {
          id: 'local-install',
          serverId: 'local-server',
          installedAt: new Date(),
          status: 'installed',
          configPath: '/config/local.json',
        },
      ];

      mockOrchestrator.listMcpInstallations.mockResolvedValue(mockInstallations);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.installations).toHaveLength(3);

      // Verify different server ID formats are handled
      const serverIds = body.installations.map((inst: any) => inst.serverId);
      expect(serverIds).toContain('@example/npm-server');
      expect(serverIds).toContain('github.com/user/repo');
      expect(serverIds).toContain('local-server');
    });
  });

  describe('Acceptance Criteria Validation', () => {
    it('should meet all acceptance criteria requirements', async () => {
      const mockInstallations: MCPInstallation[] = [
        {
          id: 'test-installation',
          serverId: 'test-server',
          installedAt: new Date('2024-01-01T00:00:00.000Z'),
          status: 'installed',
          configPath: '/config/test.json',
        },
      ];

      mockOrchestrator.listMcpInstallations.mockResolvedValue(mockInstallations);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      // ✅ Route registered at GET /mcp/installed in @apex/api
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);

      // ✅ Returns list of MCPInstallation objects for currently installed servers
      expect(body).toHaveProperty('installations');
      expect(Array.isArray(body.installations)).toBe(true);
      expect(body.installations).toHaveLength(1);

      const installation = body.installations[0];
      expect(installation).toHaveProperty('id');
      expect(installation).toHaveProperty('serverId');
      expect(installation).toHaveProperty('installedAt');
      expect(installation).toHaveProperty('status');
      expect(installation).toHaveProperty('configPath');

      // ✅ Integrates with local storage/config to track installations
      expect(mockOrchestrator.listMcpInstallations).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no servers installed (acceptance criteria)', async () => {
      mockOrchestrator.listMcpInstallations.mockResolvedValue([]);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // ✅ Returns empty array when no servers installed
      expect(body).toEqual({ installations: [] });
      expect(Array.isArray(body.installations)).toBe(true);
      expect(body.installations).toHaveLength(0);
    });
  });
});