import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { ApexOrchestrator } from '@apexcli/orchestrator';

// Mock the orchestrator
vi.mock('@apexcli/orchestrator', () => ({
  ApexOrchestrator: vi.fn().mockImplementation(() => ({
    listMcpMarketplaceEntries: vi.fn(),
    listMcpServers: vi.fn(),
    listMcpInstallations: vi.fn(),
    getMcpServerDetails: vi.fn(),
    installMcpServer: vi.fn(),
    uninstallMcpServer: vi.fn(),
    getMcpServerStatus: vi.fn(),
    startMcpServer: vi.fn(),
    stopMcpServer: vi.fn(),
  })),
}));

// Mock the path resolution for creating the server
vi.mock('path', () => ({
  resolve: vi.fn(() => '/mock/project/path'),
  join: vi.fn((...args: string[]) => args.join('/')),
}));

// Mock fs for config checking
vi.mock('fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
}));

// Import and set up API server after mocking
async function createTestServer() {
  const fastify = Fastify();

  // Mock orchestrator instance
  const mockOrchestrator = new ApexOrchestrator('/mock/project/path');

  // Manually register the MCP endpoints (simplified version of main API)

  // Get MCP marketplace entries
  fastify.get('/mcp/marketplace', async (request, reply) => {
    try {
      const entries = await mockOrchestrator.listMcpMarketplaceEntries();
      return { entries };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch marketplace entries';
      return reply.code(500).send({ error: message });
    }
  });

  // List installed MCP servers
  fastify.get('/mcp/servers', async (request, reply) => {
    try {
      const servers = await mockOrchestrator.listMcpServers();
      return servers;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list MCP servers';
      return reply.code(500).send({ error: message });
    }
  });

  // List installed MCP servers as MCPInstallation objects
  fastify.get('/mcp/installed', async (request, reply) => {
    try {
      const installations = await mockOrchestrator.listMcpInstallations();
      return { installations };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list installed MCP servers';
      return reply.code(500).send({ error: message });
    }
  });

  // Get detailed MCP server information by ID
  fastify.get('/mcp/servers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!id || !id.trim()) {
      return reply.code(400).send({ error: 'Server ID is required' });
    }

    try {
      const serverDetails = await mockOrchestrator.getMcpServerDetails(id);
      return serverDetails;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({ error: `MCP server '${id}' not found` });
      }
      const message = error instanceof Error ? error.message : `Failed to get MCP server details for '${id}'`;
      return reply.code(500).send({ error: message });
    }
  });

  // Install an MCP server
  fastify.post('/mcp/servers/:serverName/install', async (request, reply) => {
    const { serverName } = request.params as { serverName: string };

    if (!serverName || typeof serverName !== 'string') {
      return reply.code(400).send({ error: 'Server name is required' });
    }

    try {
      const serverConfig = await mockOrchestrator.installMcpServer(serverName);
      return {
        ok: true,
        message: `MCP server '${serverName}' installed successfully`,
        serverConfig,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to install MCP server '${serverName}'`;
      return reply.code(500).send({
        error: message,
        ok: false,
        serverName,
      });
    }
  });

  // Uninstall an MCP server
  fastify.delete('/mcp/servers/:serverName', async (request, reply) => {
    const { serverName } = request.params as { serverName: string };

    if (!serverName || typeof serverName !== 'string') {
      return reply.code(400).send({ error: 'Server name is required' });
    }

    try {
      await mockOrchestrator.uninstallMcpServer(serverName);
      return {
        ok: true,
        message: `MCP server '${serverName}' uninstalled successfully`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to uninstall MCP server '${serverName}'`;
      return reply.code(500).send({
        error: message,
        ok: false,
        serverName,
      });
    }
  });

  // Get MCP server status
  fastify.get('/mcp/servers/:serverName/status', async (request, reply) => {
    const { serverName } = request.params as { serverName: string };

    if (!serverName || typeof serverName !== 'string') {
      return reply.code(400).send({ error: 'Server name is required' });
    }

    try {
      const status = await mockOrchestrator.getMcpServerStatus(serverName);
      return status;
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to get status for MCP server '${serverName}'`;
      return reply.code(500).send({ error: message });
    }
  });

  // Start an MCP server
  fastify.post('/mcp/servers/:serverName/start', async (request, reply) => {
    const { serverName } = request.params as { serverName: string };

    if (!serverName || typeof serverName !== 'string') {
      return reply.code(400).send({ error: 'Server name is required' });
    }

    try {
      await mockOrchestrator.startMcpServer(serverName);
      return {
        ok: true,
        message: `MCP server '${serverName}' started successfully`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to start MCP server '${serverName}'`;
      return reply.code(500).send({
        error: message,
        ok: false,
        serverName,
      });
    }
  });

  // Stop an MCP server
  fastify.post('/mcp/servers/:serverName/stop', async (request, reply) => {
    const { serverName } = request.params as { serverName: string };

    if (!serverName || typeof serverName !== 'string') {
      return reply.code(400).send({ error: 'Server name is required' });
    }

    try {
      await mockOrchestrator.stopMcpServer(serverName);
      return {
        ok: true,
        message: `MCP server '${serverName}' stopped successfully`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to stop MCP server '${serverName}'`;
      return reply.code(500).send({
        error: message,
        ok: false,
        serverName,
      });
    }
  });

  return { fastify, mockOrchestrator };
}

describe('MCP API Endpoints', () => {
  let server: FastifyInstance;
  let mockOrchestrator: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const testServer = await createTestServer();
    server = testServer.fastify;
    mockOrchestrator = testServer.mockOrchestrator;
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('GET /mcp/marketplace', () => {
    it('returns marketplace entries successfully', async () => {
      const mockEntries = [
        {
          name: 'test-server',
          description: 'Test MCP server',
          version: '1.0.0',
          serverConfig: {
            type: 'stdio',
            command: 'node',
            args: ['server.js'],
          },
        },
      ];

      mockOrchestrator.listMcpMarketplaceEntries.mockResolvedValue(mockEntries);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/marketplace',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ entries: mockEntries });
      expect(mockOrchestrator.listMcpMarketplaceEntries).toHaveBeenCalledTimes(1);
    });

    it('handles errors when fetching marketplace entries', async () => {
      const errorMessage = 'Failed to fetch marketplace';
      mockOrchestrator.listMcpMarketplaceEntries.mockRejectedValue(new Error(errorMessage));

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/marketplace',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: errorMessage });
    });

    it('handles non-Error exceptions', async () => {
      mockOrchestrator.listMcpMarketplaceEntries.mockRejectedValue('String error');

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/marketplace',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: 'Failed to fetch marketplace entries' });
    });
  });

  describe('GET /mcp/servers', () => {
    it('returns installed servers successfully', async () => {
      const mockServers = [
        {
          name: 'installed-server',
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
        },
      ];

      mockOrchestrator.listMcpServers.mockResolvedValue(mockServers);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/servers',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual(mockServers);
      expect(mockOrchestrator.listMcpServers).toHaveBeenCalledTimes(1);
    });

    it('handles errors when listing servers', async () => {
      const errorMessage = 'Failed to list servers';
      mockOrchestrator.listMcpServers.mockRejectedValue(new Error(errorMessage));

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/servers',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: errorMessage });
    });
  });

  describe('GET /mcp/installed', () => {
    it('returns installed MCP servers as MCPInstallation objects', async () => {
      const mockInstallations = [
        {
          serverId: 'filesystem',
          installedAt: new Date('2024-01-01T00:00:00.000Z'),
          config: {
            type: 'stdio',
            command: 'node',
            args: ['filesystem-server.js'],
          },
          status: 'installed',
        },
        {
          serverId: 'database',
          installedAt: new Date('2024-01-02T00:00:00.000Z'),
          config: {
            type: 'stdio',
            command: 'npx',
            args: ['@example/database-server'],
          },
          status: 'running',
        },
      ];

      mockOrchestrator.listMcpInstallations.mockResolvedValue(mockInstallations);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ installations: mockInstallations });
      expect(mockOrchestrator.listMcpInstallations).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no servers are installed', async () => {
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

    it('handles errors when listing installations', async () => {
      const errorMessage = 'Failed to list installations';
      mockOrchestrator.listMcpInstallations.mockRejectedValue(new Error(errorMessage));

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: errorMessage });
    });

    it('handles non-Error exceptions', async () => {
      mockOrchestrator.listMcpInstallations.mockRejectedValue('String error');

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: 'Failed to list installed MCP servers' });
    });
  });

  describe('GET /mcp/servers/:id', () => {
    it('returns server details successfully', async () => {
      const serverId = 'test-server';
      const mockServerDetails = {
        id: serverId,
        name: 'Test MCP Server',
        config: {
          name: 'Test MCP Server',
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
        },
        status: 'stopped',
        tools: ['read_file', 'write_file'],
        readme: '# Test Server\nThis is a test MCP server.',
        installationInstructions: 'npm install test-mcp-server',
        metadata: {
          version: '1.0.0',
          author: 'Test Author',
          description: 'A test MCP server for unit testing',
          lastUpdated: new Date('2024-01-01'),
        },
      };

      mockOrchestrator.getMcpServerDetails.mockResolvedValue(mockServerDetails);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual(mockServerDetails);
      expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledWith(serverId);
    });

    it('returns 404 for non-existent server', async () => {
      const serverId = 'non-existent-server';
      const errorMessage = `MCP server '${serverId}' not found`;

      mockOrchestrator.getMcpServerDetails.mockRejectedValue(new Error(errorMessage));

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: `MCP server '${serverId}' not found` });
      expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledWith(serverId);
    });

    it('handles server details fetch errors', async () => {
      const serverId = 'error-server';
      const errorMessage = 'Internal server error';

      mockOrchestrator.getMcpServerDetails.mockRejectedValue(new Error(errorMessage));

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: errorMessage });
    });

    it('validates server ID parameter', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/mcp/servers/', // Empty server ID
      });

      expect(response.statusCode).toBe(404);
    });

    it('handles empty server ID parameter', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/mcp/servers/ ', // Space only
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: 'Server ID is required' });
    });

    it('handles non-Error exceptions', async () => {
      const serverId = 'string-error-server';
      mockOrchestrator.getMcpServerDetails.mockRejectedValue('String error');

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: `Failed to get MCP server details for '${serverId}'` });
    });

    it('returns proper response structure with minimal data', async () => {
      const serverId = 'minimal-server';
      const mockMinimalDetails = {
        id: serverId,
        name: 'Minimal Server',
        config: {
          name: 'Minimal Server',
          type: 'stdio',
          command: 'node',
        },
        status: 'running',
      };

      mockOrchestrator.getMcpServerDetails.mockResolvedValue(mockMinimalDetails);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual(mockMinimalDetails);
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('config');
      expect(body).toHaveProperty('status');
    });
  });

  describe('POST /mcp/servers/:serverName/install', () => {
    it('installs server successfully', async () => {
      const serverName = 'test-server';
      const mockConfig = {
        type: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      mockOrchestrator.installMcpServer.mockResolvedValue(mockConfig);

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/servers/${serverName}/install`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        ok: true,
        message: `MCP server '${serverName}' installed successfully`,
        serverConfig: mockConfig,
      });
      expect(mockOrchestrator.installMcpServer).toHaveBeenCalledWith(serverName);
    });

    it('handles installation errors', async () => {
      const serverName = 'failing-server';
      const errorMessage = 'Installation failed';

      mockOrchestrator.installMcpServer.mockRejectedValue(new Error(errorMessage));

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/servers/${serverName}/install`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        error: errorMessage,
        ok: false,
        serverName,
      });
    });

    it('validates server name parameter', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/servers//install', // Empty server name
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: 'Server name is required' });
    });
  });

  describe('DELETE /mcp/servers/:serverName', () => {
    it('uninstalls server successfully', async () => {
      const serverName = 'test-server';
      mockOrchestrator.uninstallMcpServer.mockResolvedValue(undefined);

      const response = await server.inject({
        method: 'DELETE',
        url: `/mcp/servers/${serverName}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        ok: true,
        message: `MCP server '${serverName}' uninstalled successfully`,
      });
      expect(mockOrchestrator.uninstallMcpServer).toHaveBeenCalledWith(serverName);
    });

    it('handles uninstallation errors', async () => {
      const serverName = 'non-existent-server';
      const errorMessage = 'Server not found';

      mockOrchestrator.uninstallMcpServer.mockRejectedValue(new Error(errorMessage));

      const response = await server.inject({
        method: 'DELETE',
        url: `/mcp/servers/${serverName}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        error: errorMessage,
        ok: false,
        serverName,
      });
    });

    it('validates server name parameter', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/mcp/servers/', // Missing server name
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /mcp/servers/:serverName/status', () => {
    it('returns server status successfully', async () => {
      const serverName = 'test-server';
      const mockStatus = {
        name: serverName,
        status: 'running',
      };

      mockOrchestrator.getMcpServerStatus.mockResolvedValue(mockStatus);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverName}/status`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual(mockStatus);
      expect(mockOrchestrator.getMcpServerStatus).toHaveBeenCalledWith(serverName);
    });

    it('handles status check errors', async () => {
      const serverName = 'non-existent-server';
      const errorMessage = 'Server not found';

      mockOrchestrator.getMcpServerStatus.mockRejectedValue(new Error(errorMessage));

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverName}/status`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: errorMessage });
    });

    it('validates server name parameter', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/mcp/servers//status', // Empty server name
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: 'Server name is required' });
    });
  });

  describe('POST /mcp/servers/:serverName/start', () => {
    it('starts server successfully', async () => {
      const serverName = 'test-server';
      mockOrchestrator.startMcpServer.mockResolvedValue(undefined);

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/servers/${serverName}/start`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        ok: true,
        message: `MCP server '${serverName}' started successfully`,
      });
      expect(mockOrchestrator.startMcpServer).toHaveBeenCalledWith(serverName);
    });

    it('handles start errors', async () => {
      const serverName = 'failing-server';
      const errorMessage = 'Failed to start';

      mockOrchestrator.startMcpServer.mockRejectedValue(new Error(errorMessage));

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/servers/${serverName}/start`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        error: errorMessage,
        ok: false,
        serverName,
      });
    });

    it('validates server name parameter', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/servers//start', // Empty server name
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: 'Server name is required' });
    });
  });

  describe('POST /mcp/servers/:serverName/stop', () => {
    it('stops server successfully', async () => {
      const serverName = 'test-server';
      mockOrchestrator.stopMcpServer.mockResolvedValue(undefined);

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/servers/${serverName}/stop`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        ok: true,
        message: `MCP server '${serverName}' stopped successfully`,
      });
      expect(mockOrchestrator.stopMcpServer).toHaveBeenCalledWith(serverName);
    });

    it('stops server with stop errors', async () => {
      const serverName = 'failing-server';
      const errorMessage = 'Failed to stop';

      mockOrchestrator.stopMcpServer.mockRejectedValue(new Error(errorMessage));

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/servers/${serverName}/stop`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        error: errorMessage,
        ok: false,
        serverName,
      });
    });

    it('validates server name parameter', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/servers//stop', // Empty server name
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: 'Server name is required' });
    });
  });

  describe('Server name validation across endpoints', () => {
    const endpoints = [
      { method: 'POST', path: '/mcp/servers/{name}/install' },
      { method: 'DELETE', path: '/mcp/servers/{name}' },
      { method: 'GET', path: '/mcp/servers/{name}/status' },
      { method: 'POST', path: '/mcp/servers/{name}/start' },
      { method: 'POST', path: '/mcp/servers/{name}/stop' },
    ];

    endpoints.forEach(({ method, path }) => {
      it(`validates server name for ${method} ${path}`, async () => {
        const url = path.replace('{name}', '');

        const response = await server.inject({
          method: method as any,
          url,
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body).toEqual({ error: 'Server name is required' });
      });
    });
  });

  describe('Error handling consistency', () => {
    it('handles orchestrator method not found gracefully', async () => {
      // Simulate missing method by setting it to undefined
      mockOrchestrator.listMcpMarketplaceEntries = undefined;

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/marketplace',
      });

      expect(response.statusCode).toBe(500);
    });

    it('maintains consistent error response format', async () => {
      const endpoints = [
        { method: 'GET', url: '/mcp/marketplace' },
        { method: 'GET', url: '/mcp/servers' },
        { method: 'GET', url: '/mcp/installed' },
        { method: 'GET', url: '/mcp/servers/test' },
        { method: 'POST', url: '/mcp/servers/test/install' },
        { method: 'DELETE', url: '/mcp/servers/test' },
        { method: 'GET', url: '/mcp/servers/test/status' },
        { method: 'POST', url: '/mcp/servers/test/start' },
        { method: 'POST', url: '/mcp/servers/test/stop' },
      ];

      // Setup error responses for all orchestrator methods
      Object.keys(mockOrchestrator).forEach(method => {
        mockOrchestrator[method].mockRejectedValue(new Error('Test error'));
      });

      for (const { method, url } of endpoints) {
        const response = await server.inject({ method: method as any, url });
        expect(response.statusCode).toBe(500);

        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('error');
        expect(typeof body.error).toBe('string');
      }
    });
  });
});