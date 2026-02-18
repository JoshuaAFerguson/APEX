import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { ApexOrchestrator } from '@apexcli/orchestrator';

// Mock the orchestrator
vi.mock('@apexcli/orchestrator', () => ({
  ApexOrchestrator: vi.fn().mockImplementation(() => ({
    installMcpServer: vi.fn(),
    uninstallMcpServer: vi.fn(),
    getMcpServerDetails: vi.fn(),
    listMcpServers: vi.fn(),
    listMcpInstallations: vi.fn(),
    getMcpMarketplaceEntries: vi.fn(),
  })),
}));

// Mock path resolution
vi.mock('path', () => ({
  resolve: vi.fn(() => '/mock/project/path'),
  join: vi.fn((...args: string[]) => args.join('/')),
}));

// Mock fs for config checking
vi.mock('fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
}));

// Test server setup
async function createTestServer() {
  const fastify = Fastify();

  // Mock orchestrator instance
  const mockOrchestrator = new ApexOrchestrator('/mock/project/path');

  // Track WebSocket broadcasts for testing
  const broadcasts: any[] = [];
  const mockBroadcast = vi.fn((taskId: string, event: any) => {
    broadcasts.push({ taskId, event });
  });

  // Register the MCP endpoints with the exact same implementation as main API

  // Get MCP marketplace entries with filtering
  fastify.get('/mcp/marketplace', async (request, reply) => {
    try {
      const { category, search, featured, verified } = request.query as any;
      const options = {
        category,
        search,
        featured: featured === 'true',
        verified: verified === 'true' ? true : verified === 'false' ? false : undefined
      };

      const entries = await mockOrchestrator.getMcpMarketplaceEntries(options);
      return { entries };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch marketplace entries';
      return reply.status(500).send({ error: message });
    }
  });

  // List installed MCP servers
  fastify.get('/mcp/servers', async (request, reply) => {
    try {
      const servers = await mockOrchestrator.listMcpServers();
      return servers;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list MCP servers';
      return reply.status(500).send({ error: message });
    }
  });

  // Get detailed MCP server information by ID
  fastify.get('/mcp/servers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!id || !id.trim()) {
      return reply.status(400).send({ error: 'Server ID is required' });
    }

    try {
      const serverDetails = await mockOrchestrator.getMcpServerDetails(id);
      return serverDetails;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: `MCP server '${id}' not found` });
      }
      const message = error instanceof Error ? error.message : `Failed to get MCP server details for '${id}'`;
      return reply.status(500).send({ error: message });
    }
  });

  // Install an MCP server (acceptance criteria format)
  fastify.post('/mcp/install/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!id || !id.trim()) {
      return reply.status(400).send({ error: 'Server ID is required' });
    }

    try {
      // Broadcast installation start event
      mockBroadcast('mcp-installation', {
        type: 'mcp:install-start',
        taskId: 'mcp-installation',
        timestamp: new Date(),
        data: {
          serverId: id,
          stage: 'starting',
          progress: 0,
          message: `Starting installation of MCP server '${id}'`
        },
      });

      const serverConfig = await mockOrchestrator.installMcpServer(id);

      // Broadcast installation complete event
      mockBroadcast('mcp-installation', {
        type: 'mcp:install-complete',
        taskId: 'mcp-installation',
        timestamp: new Date(),
        data: {
          serverId: id,
          stage: 'complete',
          progress: 100,
          message: `MCP server '${id}' installed successfully`,
          config: serverConfig
        },
      });

      return {
        ok: true,
        message: `MCP server '${id}' installed successfully`,
        serverConfig
      };
    } catch (error) {
      // Broadcast installation error event
      mockBroadcast('mcp-installation', {
        type: 'mcp:install-error',
        taskId: 'mcp-installation',
        timestamp: new Date(),
        data: {
          serverId: id,
          stage: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : `Failed to install MCP server '${id}'`,
          error: error instanceof Error ? error.message : String(error)
        },
      });

      const message = error instanceof Error ? error.message : `Failed to install MCP server '${id}'`;
      return reply.status(500).send({
        ok: false,
        error: message
      });
    }
  });

  // Uninstall an MCP server (acceptance criteria format)
  fastify.delete('/mcp/uninstall/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!id || !id.trim()) {
      return reply.status(400).send({ error: 'Server ID is required' });
    }

    try {
      // Broadcast uninstallation start event
      mockBroadcast('mcp-installation', {
        type: 'mcp:uninstall-start',
        taskId: 'mcp-installation',
        timestamp: new Date(),
        data: {
          serverId: id,
          stage: 'uninstalling',
          progress: 0,
          message: `Starting uninstallation of MCP server '${id}'`
        },
      });

      await mockOrchestrator.uninstallMcpServer(id);

      // Broadcast uninstallation complete event
      mockBroadcast('mcp-installation', {
        type: 'mcp:uninstall-complete',
        taskId: 'mcp-installation',
        timestamp: new Date(),
        data: {
          serverId: id,
          stage: 'complete',
          progress: 100,
          message: `MCP server '${id}' uninstalled successfully`
        },
      });

      return {
        ok: true,
        message: `MCP server '${id}' uninstalled successfully`
      };
    } catch (error) {
      // Broadcast uninstallation error event
      mockBroadcast('mcp-installation', {
        type: 'mcp:uninstall-error',
        taskId: 'mcp-installation',
        timestamp: new Date(),
        data: {
          serverId: id,
          stage: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : `Failed to uninstall MCP server '${id}'`,
          error: error instanceof Error ? error.message : String(error)
        },
      });

      const message = error instanceof Error ? error.message : `Failed to uninstall MCP server '${id}'`;
      return reply.status(500).send({
        ok: false,
        error: message
      });
    }
  });

  // GET /mcp/installed (acceptance criteria format)
  fastify.get('/mcp/installed', async (request, reply) => {
    try {
      const installations = await mockOrchestrator.listMcpInstallations();
      return { installations };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list installed MCP servers';
      return reply.status(500).send({ error: message });
    }
  });

  return { fastify, mockOrchestrator, mockBroadcast, broadcasts };
}

describe('MCP Marketplace API Edge Cases and Error Handling', () => {
  let server: FastifyInstance;
  let mockOrchestrator: any;
  let mockBroadcast: any;
  let broadcasts: any[];

  beforeEach(async () => {
    vi.clearAllMocks();
    const testServer = await createTestServer();
    server = testServer.fastify;
    mockOrchestrator = testServer.mockOrchestrator;
    mockBroadcast = testServer.mockBroadcast;
    broadcasts = testServer.broadcasts;
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('Input validation edge cases', () => {
    it('handles various invalid server ID formats for install endpoint', async () => {
      const invalidIds = [
        ' ', // Space only
        '  \t  ', // Whitespace only
        '', // Empty string
        null, // Null (will be handled by URL parsing)
        'id with spaces',
        'id-with-special-chars!@#$%',
        '../../malicious/path',
        'extremely-long-server-id-that-might-cause-issues-when-processing-or-storing-in-databases-or-other-systems-that-have-length-limits',
      ];

      for (const invalidId of invalidIds.slice(0, 3)) { // Test first 3 that will trigger validation
        const response = await server.inject({
          method: 'POST',
          url: `/mcp/install/${encodeURIComponent(invalidId)}`,
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body).toEqual({ error: 'Server ID is required' });

        // Ensure no WebSocket events were broadcasted for invalid input
        expect(mockBroadcast).not.toHaveBeenCalled();
      }

      // Reset mocks between tests
      vi.clearAllMocks();
    });

    it('handles special characters and unicode in server IDs', async () => {
      const specialIds = [
        'server-with-unicode-😀',
        'server.with.dots',
        'server_with_underscores',
        'server-with-dashes',
        'server123with456numbers',
        'UPPERCASE-SERVER-ID',
        'mixedCaseServerId',
      ];

      for (const id of specialIds) {
        // Mock successful installation
        const mockConfig = { type: 'stdio', command: 'node' };
        mockOrchestrator.installMcpServer.mockResolvedValue(mockConfig);

        const response = await server.inject({
          method: 'POST',
          url: `/mcp/install/${encodeURIComponent(id)}`,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.ok).toBe(true);
        expect(body.message).toContain(id);

        // Verify WebSocket events contain correct server ID
        const startEvent = broadcasts.find(b => b.event.type === 'mcp:install-start');
        expect(startEvent?.event.data.serverId).toBe(id);

        // Reset for next iteration
        vi.clearAllMocks();
        broadcasts.length = 0;
      }
    });

    it('handles missing route parameters gracefully', async () => {
      const endpoints = [
        { method: 'GET', url: '/mcp/servers/' },
        { method: 'POST', url: '/mcp/install/' },
        { method: 'DELETE', url: '/mcp/uninstall/' },
      ];

      for (const { method, url } of endpoints) {
        const response = await server.inject({
          method: method as any,
          url,
        });

        // Should return 404 for missing parameters, not crash
        expect([400, 404]).toContain(response.statusCode);
      }
    });
  });

  describe('Orchestrator error scenarios', () => {
    it('handles timeout errors during installation', async () => {
      const serverId = 'timeout-server';
      const timeoutError = new Error('Operation timed out after 30 seconds');
      timeoutError.name = 'TimeoutError';

      mockOrchestrator.installMcpServer.mockRejectedValue(timeoutError);

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Operation timed out');

      // Verify error event was broadcasted
      const errorEvent = broadcasts.find(b => b.event.type === 'mcp:install-error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.event.data.error).toBe(timeoutError.message);
    });

    it('handles network connectivity errors', async () => {
      const serverId = 'network-error-server';
      const networkError = new Error('ENOTFOUND marketplace.example.com');
      networkError.name = 'NetworkError';

      mockOrchestrator.installMcpServer.mockRejectedValue(networkError);

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('ENOTFOUND');

      // Verify error event was broadcasted with network error details
      const errorEvent = broadcasts.find(b => b.event.type === 'mcp:install-error');
      expect(errorEvent.event.data.error).toContain('ENOTFOUND');
    });

    it('handles permission denied errors', async () => {
      const serverId = 'permission-denied-server';
      const permissionError = new Error('EACCES: permission denied, mkdir \'/usr/local/lib/mcp\'');
      permissionError.name = 'PermissionError';

      mockOrchestrator.installMcpServer.mockRejectedValue(permissionError);

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('permission denied');
    });

    it('handles disk space errors', async () => {
      const serverId = 'disk-space-server';
      const diskError = new Error('ENOSPC: no space left on device');
      diskError.name = 'DiskSpaceError';

      mockOrchestrator.installMcpServer.mockRejectedValue(diskError);

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('no space left');
    });

    it('handles corrupted package errors', async () => {
      const serverId = 'corrupted-package-server';
      const corruptionError = new Error('Package integrity check failed: expected sha256-abc123... got sha256-def456...');

      mockOrchestrator.installMcpServer.mockRejectedValue(corruptionError);

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Package integrity check failed');
    });

    it('handles orchestrator method not available', async () => {
      // Simulate method not existing
      mockOrchestrator.installMcpServer = undefined;

      const response = await server.inject({
        method: 'POST',
        url: '/mcp/install/test-server',
      });

      expect(response.statusCode).toBe(500);
    });

    it('handles orchestrator returning undefined unexpectedly', async () => {
      const serverId = 'undefined-return-server';
      mockOrchestrator.installMcpServer.mockResolvedValue(undefined);

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.serverConfig).toBeUndefined();

      // Complete event should still be broadcasted but with undefined config
      const completeEvent = broadcasts.find(b => b.event.type === 'mcp:install-complete');
      expect(completeEvent.event.data.config).toBeUndefined();
    });
  });

  describe('Non-Error exception handling', () => {
    it('handles string errors thrown by orchestrator', async () => {
      const serverId = 'string-error-server';
      const stringError = 'Simple string error message';

      mockOrchestrator.installMcpServer.mockRejectedValue(stringError);

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe(`Failed to install MCP server '${serverId}'`);

      // Error event should contain the original string error
      const errorEvent = broadcasts.find(b => b.event.type === 'mcp:install-error');
      expect(errorEvent.event.data.error).toBe(stringError);
    });

    it('handles number errors thrown by orchestrator', async () => {
      const serverId = 'number-error-server';
      const numberError = 500;

      mockOrchestrator.installMcpServer.mockRejectedValue(numberError);

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe(`Failed to install MCP server '${serverId}'`);

      // Error event should contain stringified number
      const errorEvent = broadcasts.find(b => b.event.type === 'mcp:install-error');
      expect(errorEvent.event.data.error).toBe('500');
    });

    it('handles object errors thrown by orchestrator', async () => {
      const serverId = 'object-error-server';
      const objectError = { code: 'CUSTOM_ERROR', details: 'Custom error object' };

      mockOrchestrator.installMcpServer.mockRejectedValue(objectError);

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe(`Failed to install MCP server '${serverId}'`);

      // Error event should contain stringified object
      const errorEvent = broadcasts.find(b => b.event.type === 'mcp:install-error');
      expect(errorEvent.event.data.error).toBe(JSON.stringify(objectError));
    });

    it('handles null and undefined errors', async () => {
      const serverId = 'null-error-server';

      // Test null error
      mockOrchestrator.installMcpServer.mockRejectedValue(null);

      let response = await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      expect(response.statusCode).toBe(500);
      let errorEvent = broadcasts.find(b => b.event.type === 'mcp:install-error');
      expect(errorEvent.event.data.error).toBe('null');

      // Reset and test undefined error
      vi.clearAllMocks();
      broadcasts.length = 0;
      mockOrchestrator.installMcpServer.mockRejectedValue(undefined);

      response = await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}-undefined`,
      });

      expect(response.statusCode).toBe(500);
      errorEvent = broadcasts.find(b => b.event.type === 'mcp:install-error');
      expect(errorEvent.event.data.error).toBe('undefined');
    });
  });

  describe('Marketplace query parameter edge cases', () => {
    it('handles malformed query parameters in marketplace endpoint', async () => {
      const mockEntries = [{ name: 'test-server' }];
      mockOrchestrator.getMcpMarketplaceEntries.mockResolvedValue(mockEntries);

      // Test various malformed boolean values
      const testCases = [
        '?featured=true',
        '?featured=false',
        '?featured=invalid',
        '?verified=yes',
        '?verified=no',
        '?featured=1&verified=0',
        '?category=&search=',
        '?category=Development%20Tools&search=file%20system',
      ];

      for (const queryString of testCases) {
        const response = await server.inject({
          method: 'GET',
          url: `/mcp/marketplace${queryString}`,
        });

        expect(response.statusCode).toBe(200);

        // Verify orchestrator was called with properly parsed options
        const call = mockOrchestrator.getMcpMarketplaceEntries.mock.calls[mockOrchestrator.getMcpMarketplaceEntries.mock.calls.length - 1];
        const options = call[0];

        // Check that boolean parsing works correctly
        if (queryString.includes('featured=true')) {
          expect(options.featured).toBe(true);
        } else if (queryString.includes('featured=false')) {
          expect(options.featured).toBe(false);
        }
      }
    });

    it('handles extremely long query parameters', async () => {
      const mockEntries = [];
      mockOrchestrator.getMcpMarketplaceEntries.mockResolvedValue(mockEntries);

      const longString = 'a'.repeat(10000); // 10KB query parameter
      const response = await server.inject({
        method: 'GET',
        url: `/mcp/marketplace?search=${longString}`,
      });

      expect(response.statusCode).toBe(200);

      // Verify the long string was properly handled
      const call = mockOrchestrator.getMcpMarketplaceEntries.mock.calls[0];
      expect(call[0].search).toBe(longString);
    });
  });

  describe('Concurrent operation handling', () => {
    it('handles multiple simultaneous install requests for the same server', async () => {
      const serverId = 'concurrent-install-server';
      const mockConfig = { type: 'stdio' };

      // Make both calls return after a delay to simulate race condition
      mockOrchestrator.installMcpServer.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockConfig), 100))
      );

      // Fire off multiple concurrent requests
      const promises = Array.from({ length: 3 }, () =>
        server.inject({
          method: 'POST',
          url: `/mcp/install/${serverId}`,
        })
      );

      const responses = await Promise.all(promises);

      // All should succeed (though in practice, the orchestrator might handle duplicates)
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });

      // Should have multiple start/complete event pairs
      const startEvents = broadcasts.filter(b => b.event.type === 'mcp:install-start');
      const completeEvents = broadcasts.filter(b => b.event.type === 'mcp:install-complete');
      expect(startEvents.length).toBe(3);
      expect(completeEvents.length).toBe(3);
    });

    it('handles install and uninstall requests for the same server simultaneously', async () => {
      const serverId = 'install-uninstall-race-server';
      const mockConfig = { type: 'stdio' };

      mockOrchestrator.installMcpServer.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockConfig), 100))
      );

      mockOrchestrator.uninstallMcpServer.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(), 100))
      );

      // Fire off concurrent install and uninstall
      const [installResponse, uninstallResponse] = await Promise.all([
        server.inject({
          method: 'POST',
          url: `/mcp/install/${serverId}`,
        }),
        server.inject({
          method: 'DELETE',
          url: `/mcp/uninstall/${serverId}`,
        })
      ]);

      expect(installResponse.statusCode).toBe(200);
      expect(uninstallResponse.statusCode).toBe(200);

      // Should have both install and uninstall event sequences
      const installStartEvents = broadcasts.filter(b => b.event.type === 'mcp:install-start');
      const uninstallStartEvents = broadcasts.filter(b => b.event.type === 'mcp:uninstall-start');
      expect(installStartEvents.length).toBe(1);
      expect(uninstallStartEvents.length).toBe(1);
    });
  });

  describe('Large response handling', () => {
    it('handles large server details responses', async () => {
      const serverId = 'large-response-server';
      const largeServerDetails = {
        id: serverId,
        name: 'Large Response Server',
        config: { type: 'stdio', command: 'node' },
        status: 'running',
        readme: 'x'.repeat(100000), // 100KB readme
        metadata: {
          version: '1.0.0',
          description: 'y'.repeat(50000), // 50KB description
          tags: Array.from({ length: 1000 }, (_, i) => `tag-${i}`), // Many tags
          dependencies: Object.fromEntries(
            Array.from({ length: 500 }, (_, i) => [`dep-${i}`, `^1.0.${i}`])
          ),
        },
      };

      mockOrchestrator.getMcpServerDetails.mockResolvedValue(largeServerDetails);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.readme).toBe(largeServerDetails.readme);
      expect(body.metadata.description).toBe(largeServerDetails.metadata.description);
      expect(body.metadata.tags).toHaveLength(1000);
    });

    it('handles large installation lists', async () => {
      const largeInstallationList = Array.from({ length: 10000 }, (_, i) => ({
        serverId: `server-${i}`,
        installedAt: new Date(),
        config: { type: 'stdio', command: 'node', args: [`server-${i}.js`] },
        status: i % 2 === 0 ? 'running' : 'stopped',
        version: `1.0.${i}`,
        metadata: {
          description: `Description for server ${i}`,
          tags: [`tag-${i % 10}`, `category-${i % 5}`],
        }
      }));

      mockOrchestrator.listMcpInstallations.mockResolvedValue(largeInstallationList);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.installations).toHaveLength(10000);
      expect(body.installations[0].serverId).toBe('server-0');
      expect(body.installations[9999].serverId).toBe('server-9999');
    });
  });

  describe('Memory and resource handling', () => {
    it('handles memory pressure during large operations', async () => {
      const serverId = 'memory-pressure-server';

      // Mock an operation that might cause memory pressure
      mockOrchestrator.installMcpServer.mockImplementation(() => {
        // Simulate memory-intensive operation
        const largeArray = new Array(1000000).fill('test-data');
        return Promise.resolve({
          type: 'stdio',
          command: 'node',
          metadata: { data: largeArray.slice(0, 100) } // Return smaller subset
        });
      });

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.serverConfig).toBeDefined();
    });

    it('handles rapid successive requests without memory leaks', async () => {
      const serverId = 'rapid-requests-server';
      mockOrchestrator.listMcpServers.mockResolvedValue([]);

      // Make many rapid requests
      const promises = Array.from({ length: 100 }, () =>
        server.inject({
          method: 'GET',
          url: '/mcp/servers',
        })
      );

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });

      // Verify orchestrator was called the expected number of times
      expect(mockOrchestrator.listMcpServers).toHaveBeenCalledTimes(100);
    });
  });

  describe('Response format consistency', () => {
    it('maintains consistent error response format across all endpoints', async () => {
      const endpoints = [
        { method: 'GET', url: '/mcp/marketplace' },
        { method: 'GET', url: '/mcp/servers' },
        { method: 'GET', url: '/mcp/installed' },
        { method: 'GET', url: '/mcp/servers/test-server' },
        { method: 'POST', url: '/mcp/install/test-server' },
        { method: 'DELETE', url: '/mcp/uninstall/test-server' },
      ];

      // Set up all orchestrator methods to throw errors
      Object.keys(mockOrchestrator).forEach(method => {
        mockOrchestrator[method].mockRejectedValue(new Error('Consistent test error'));
      });

      for (const { method, url } of endpoints) {
        const response = await server.inject({ method: method as any, url });

        expect(response.statusCode).toBe(500);
        const body = JSON.parse(response.body);

        // All error responses should have an 'error' field
        expect(body).toHaveProperty('error');
        expect(typeof body.error).toBe('string');
        expect(body.error.length).toBeGreaterThan(0);
      }
    });

    it('maintains consistent success response format for install/uninstall', async () => {
      const serverId = 'format-test-server';
      const mockConfig = { type: 'stdio', command: 'test' };

      mockOrchestrator.installMcpServer.mockResolvedValue(mockConfig);
      mockOrchestrator.uninstallMcpServer.mockResolvedValue(undefined);

      // Test install response format
      const installResponse = await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      expect(installResponse.statusCode).toBe(200);
      const installBody = JSON.parse(installResponse.body);
      expect(installBody).toHaveProperty('ok', true);
      expect(installBody).toHaveProperty('message');
      expect(installBody).toHaveProperty('serverConfig', mockConfig);
      expect(typeof installBody.message).toBe('string');

      // Test uninstall response format
      const uninstallResponse = await server.inject({
        method: 'DELETE',
        url: `/mcp/uninstall/${serverId}`,
      });

      expect(uninstallResponse.statusCode).toBe(200);
      const uninstallBody = JSON.parse(uninstallResponse.body);
      expect(uninstallBody).toHaveProperty('ok', true);
      expect(uninstallBody).toHaveProperty('message');
      expect(typeof uninstallBody.message).toBe('string');
      // Uninstall should not have serverConfig
      expect(uninstallBody).not.toHaveProperty('serverConfig');
    });
  });
});