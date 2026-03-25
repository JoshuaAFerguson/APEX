import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { ApexOrchestrator } from '@apexcli/orchestrator';

// Mock the orchestrator
vi.mock('@apexcli/orchestrator', () => ({
  DaemonManager: class { async getStatus() { return { running: false }; } async start() {} async stop() {} }, HealthMonitor: class { getMetrics() { return {}; } checkHealth() { return { healthy: true }; } }, ToolCallStartEvent: class {}, ToolCallProgressEvent: class {}, ToolCallCompleteEvent: class {}, MCPErrorEventData: class {}, MCPConnectionEventData: class {}, MCPDisconnectionEventData: class {}, MCPReconnectingEventData: class {}, MCPHealthCheckEventData: class {}, MCPStateChangeEventData: class {},
  ApexOrchestrator: vi.fn(function() { return {
    installMcpServer: vi.fn(),
    uninstallMcpServer: vi.fn(),
    getMcpServerDetails: vi.fn(),
    listMcpServers: vi.fn(),
    listMcpInstallations: vi.fn(),
    getMcpMarketplaceEntries: vi.fn(),
    getMcpMarketplaceCategories: vi.fn(),
    getFeaturedMcpEntries: vi.fn(),
    getMcpInstallationRecommendations: vi.fn(),
    autoConfigureMcpTools: vi.fn(),
  }; }),
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

// Import and set up API server after mocking
async function createTestServer() {
  const fastify = Fastify();

  // Mock orchestrator instance
  const mockOrchestrator = new ApexOrchestrator('/mock/project/path');

  // Track WebSocket broadcasts for testing
  const broadcasts: any[] = [];
  const mockBroadcast = vi.fn((taskId: string, event: any) => {
    broadcasts.push({ taskId, event });
  });

  // Register the full MCP marketplace API endpoints from the main API

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

  // List installed MCP servers as MCPInstallation objects (acceptance criteria format)
  fastify.get('/mcp/installed', async (request, reply) => {
    try {
      const installations = await mockOrchestrator.listMcpInstallations();
      return { installations };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list installed MCP servers';
      return reply.status(500).send({ error: message });
    }
  });

  // Get detailed MCP server information by ID (acceptance criteria format)
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

  // Get marketplace categories
  fastify.get('/mcp/marketplace/categories', async (request, reply) => {
    try {
      const categories = await mockOrchestrator.getMcpMarketplaceCategories();
      return { categories };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch marketplace categories';
      return reply.status(500).send({ error: message });
    }
  });

  // Get featured marketplace entries
  fastify.get('/mcp/marketplace/featured', async (request, reply) => {
    try {
      const entries = await mockOrchestrator.getFeaturedMcpEntries();
      return { entries };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch featured entries';
      return reply.status(500).send({ error: message });
    }
  });

  // Get installation recommendations
  fastify.get('/mcp/recommendations', async (request, reply) => {
    try {
      const recommendations = await mockOrchestrator.getMcpInstallationRecommendations();
      return recommendations;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get recommendations';
      return reply.status(500).send({ error: message });
    }
  });

  // Auto-configure standard tools
  fastify.post('/mcp/auto-configure', async (request, reply) => {
    try {
      const options = request.body as any;
      const result = await mockOrchestrator.autoConfigureMcpTools(options);
      return {
        ok: true,
        message: `Auto-configuration completed: ${result.configured.length} servers configured, ${result.skipped.length} skipped, ${result.errors.length} errors`,
        ...result
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to auto-configure tools';
      return reply.status(500).send({
        ok: false,
        error: message
      });
    }
  });

  return { fastify, mockOrchestrator, mockBroadcast, broadcasts };
}

describe('MCP Marketplace Integration Tests (Acceptance Criteria)', () => {
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

  describe('GET /mcp/servers (list/search) - Acceptance Criteria', () => {
    it('lists installed MCP servers successfully', async () => {
      const mockServers = [
        {
          name: 'filesystem-server',
          type: 'stdio',
          command: 'node',
          args: ['filesystem-server.js'],
          status: 'running'
        },
        {
          name: 'database-server',
          type: 'stdio',
          command: 'npx',
          args: ['@example/database-server'],
          status: 'stopped'
        }
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

    it('returns empty array when no servers are installed', async () => {
      mockOrchestrator.listMcpServers.mockResolvedValue([]);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/servers',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual([]);
    });

    it('handles errors when listing servers', async () => {
      const errorMessage = 'Database connection failed';
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

  describe('GET /mcp/servers/:id (details) - Acceptance Criteria', () => {
    it('returns detailed server information successfully', async () => {
      const serverId = 'filesystem-server';
      const mockServerDetails = {
        id: serverId,
        name: 'Filesystem MCP Server',
        config: {
          name: 'Filesystem MCP Server',
          type: 'stdio',
          command: 'node',
          args: ['filesystem-server.js'],
        },
        status: 'running',
        tools: ['read_file', 'write_file', 'list_directory', 'create_directory'],
        readme: '# Filesystem MCP Server\n\nProvides file system access for MCP clients.',
        installationInstructions: 'npm install @modelcontextprotocol/server-filesystem',
        metadata: {
          version: '0.4.0',
          author: 'Anthropic',
          description: 'MCP server for filesystem operations',
          lastUpdated: new Date('2024-01-15'),
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
    });

    it('validates server ID parameter', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/mcp/servers/ ', // Empty server ID (space only)
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: 'Server ID is required' });
    });

    it('handles internal server errors gracefully', async () => {
      const serverId = 'error-server';
      const errorMessage = 'Internal server error during details fetch';

      mockOrchestrator.getMcpServerDetails.mockRejectedValue(new Error(errorMessage));

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: errorMessage });
    });
  });

  describe('POST /mcp/install/:id - Acceptance Criteria', () => {
    it('installs MCP server successfully with WebSocket progress events', async () => {
      const serverId = 'filesystem-server';
      const mockConfig = {
        type: 'stdio',
        command: 'node',
        args: ['filesystem-server.js'],
      };

      mockOrchestrator.installMcpServer.mockResolvedValue(mockConfig);

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        ok: true,
        message: `MCP server '${serverId}' installed successfully`,
        serverConfig: mockConfig,
      });

      // Verify orchestrator was called correctly
      expect(mockOrchestrator.installMcpServer).toHaveBeenCalledWith(serverId);
      expect(mockOrchestrator.installMcpServer).toHaveBeenCalledTimes(1);

      // Verify WebSocket events were broadcasted
      expect(mockBroadcast).toHaveBeenCalledTimes(2);

      // Check start event
      expect(broadcasts[0]).toMatchObject({
        taskId: 'mcp-installation',
        event: {
          type: 'mcp:install-start',
          data: {
            serverId,
            stage: 'starting',
            progress: 0,
            message: `Starting installation of MCP server '${serverId}'`
          }
        }
      });

      // Check complete event
      expect(broadcasts[1]).toMatchObject({
        taskId: 'mcp-installation',
        event: {
          type: 'mcp:install-complete',
          data: {
            serverId,
            stage: 'complete',
            progress: 100,
            message: `MCP server '${serverId}' installed successfully`,
            config: mockConfig
          }
        }
      });
    });

    it('handles installation errors with WebSocket error events', async () => {
      const serverId = 'failing-server';
      const errorMessage = 'Installation failed: package not found';

      mockOrchestrator.installMcpServer.mockRejectedValue(new Error(errorMessage));

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        ok: false,
        error: errorMessage,
      });

      // Verify WebSocket events were broadcasted
      expect(mockBroadcast).toHaveBeenCalledTimes(2);

      // Check start event
      expect(broadcasts[0].event.type).toBe('mcp:install-start');

      // Check error event
      expect(broadcasts[1]).toMatchObject({
        taskId: 'mcp-installation',
        event: {
          type: 'mcp:install-error',
          data: {
            serverId,
            stage: 'error',
            progress: 0,
            message: errorMessage,
            error: errorMessage
          }
        }
      });
    });

    it('validates server ID parameter', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/install/', // Missing server ID
      });

      expect(response.statusCode).toBe(404);
    });

    it('handles empty server ID', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/install/ ', // Space only
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: 'Server ID is required' });

      // Ensure no broadcasts occurred for invalid request
      expect(mockBroadcast).not.toHaveBeenCalled();
    });

    it('handles non-Error exceptions with WebSocket events', async () => {
      const serverId = 'string-error-server';
      const stringError = 'String error message';

      mockOrchestrator.installMcpServer.mockRejectedValue(stringError);

      const response = await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        ok: false,
        error: `Failed to install MCP server '${serverId}'`,
      });

      // Check error event contains string error
      expect(broadcasts[1]).toMatchObject({
        event: {
          type: 'mcp:install-error',
          data: {
            serverId,
            error: stringError
          }
        }
      });
    });
  });

  describe('DELETE /mcp/uninstall/:id - Acceptance Criteria', () => {
    it('uninstalls MCP server successfully with WebSocket progress events', async () => {
      const serverId = 'filesystem-server';

      mockOrchestrator.uninstallMcpServer.mockResolvedValue(undefined);

      const response = await server.inject({
        method: 'DELETE',
        url: `/mcp/uninstall/${serverId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        ok: true,
        message: `MCP server '${serverId}' uninstalled successfully`,
      });

      // Verify orchestrator was called correctly
      expect(mockOrchestrator.uninstallMcpServer).toHaveBeenCalledWith(serverId);
      expect(mockOrchestrator.uninstallMcpServer).toHaveBeenCalledTimes(1);

      // Verify WebSocket events were broadcasted
      expect(mockBroadcast).toHaveBeenCalledTimes(2);

      // Check start event
      expect(broadcasts[0]).toMatchObject({
        taskId: 'mcp-installation',
        event: {
          type: 'mcp:uninstall-start',
          data: {
            serverId,
            stage: 'uninstalling',
            progress: 0,
            message: `Starting uninstallation of MCP server '${serverId}'`
          }
        }
      });

      // Check complete event
      expect(broadcasts[1]).toMatchObject({
        taskId: 'mcp-installation',
        event: {
          type: 'mcp:uninstall-complete',
          data: {
            serverId,
            stage: 'complete',
            progress: 100,
            message: `MCP server '${serverId}' uninstalled successfully`
          }
        }
      });
    });

    it('handles uninstallation errors with WebSocket error events', async () => {
      const serverId = 'non-existent-server';
      const errorMessage = 'Server not found';

      mockOrchestrator.uninstallMcpServer.mockRejectedValue(new Error(errorMessage));

      const response = await server.inject({
        method: 'DELETE',
        url: `/mcp/uninstall/${serverId}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        ok: false,
        error: errorMessage,
      });

      // Verify WebSocket events were broadcasted
      expect(mockBroadcast).toHaveBeenCalledTimes(2);

      // Check error event
      expect(broadcasts[1]).toMatchObject({
        taskId: 'mcp-installation',
        event: {
          type: 'mcp:uninstall-error',
          data: {
            serverId,
            stage: 'error',
            progress: 0,
            message: errorMessage,
            error: errorMessage
          }
        }
      });
    });

    it('validates server ID parameter', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/mcp/uninstall/ ', // Space only
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: 'Server ID is required' });

      // Ensure no broadcasts occurred for invalid request
      expect(mockBroadcast).not.toHaveBeenCalled();
    });
  });

  describe('GET /mcp/installed - Acceptance Criteria', () => {
    it('returns installed servers as MCPInstallation objects', async () => {
      const mockInstallations = [
        {
          serverId: 'filesystem',
          installedAt: new Date('2024-01-01T00:00:00.000Z'),
          config: {
            type: 'stdio',
            command: 'node',
            args: ['filesystem-server.js'],
          },
          status: 'running',
          version: '0.4.0'
        },
        {
          serverId: 'database',
          installedAt: new Date('2024-01-02T00:00:00.000Z'),
          config: {
            type: 'stdio',
            command: 'npx',
            args: ['@example/database-server'],
          },
          status: 'stopped',
          version: '1.2.0'
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

    it('returns empty array when no installations exist', async () => {
      mockOrchestrator.listMcpInstallations.mockResolvedValue([]);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ installations: [] });
    });

    it('handles errors when listing installations', async () => {
      const errorMessage = 'Failed to read installation database';
      mockOrchestrator.listMcpInstallations.mockRejectedValue(new Error(errorMessage));

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: errorMessage });
    });
  });

  describe('WebSocket event structure validation', () => {
    it('broadcasts events with consistent structure for install operations', async () => {
      const serverId = 'test-server';
      mockOrchestrator.installMcpServer.mockResolvedValue({ type: 'stdio' });

      await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      // Check that all events have required structure
      broadcasts.forEach(({ taskId, event }) => {
        expect(taskId).toBe('mcp-installation');
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('taskId', 'mcp-installation');
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('data');
        expect(event.data).toHaveProperty('serverId', serverId);
        expect(event.data).toHaveProperty('stage');
        expect(event.data).toHaveProperty('progress');
        expect(event.data).toHaveProperty('message');
        expect(typeof event.data.progress).toBe('number');
        expect(event.data.progress).toBeGreaterThanOrEqual(0);
        expect(event.data.progress).toBeLessThanOrEqual(100);
      });
    });

    it('broadcasts events with consistent structure for uninstall operations', async () => {
      const serverId = 'test-server';
      mockOrchestrator.uninstallMcpServer.mockResolvedValue(undefined);

      await server.inject({
        method: 'DELETE',
        url: `/mcp/uninstall/${serverId}`,
      });

      // Check that all events have required structure
      broadcasts.forEach(({ taskId, event }) => {
        expect(taskId).toBe('mcp-installation');
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('taskId', 'mcp-installation');
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('data');
        expect(event.data).toHaveProperty('serverId', serverId);
        expect(event.data).toHaveProperty('stage');
        expect(event.data).toHaveProperty('progress');
        expect(event.data).toHaveProperty('message');
      });
    });

    it('includes installation config in complete event', async () => {
      const serverId = 'test-server';
      const config = { type: 'stdio', command: 'test' };
      mockOrchestrator.installMcpServer.mockResolvedValue(config);

      await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      const completeEvent = broadcasts.find(b => b.event.type === 'mcp:install-complete');
      expect(completeEvent?.event.data.config).toEqual(config);
    });

    it('includes error details in error events', async () => {
      const serverId = 'test-server';
      const errorMessage = 'Installation failed';
      mockOrchestrator.installMcpServer.mockRejectedValue(new Error(errorMessage));

      await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      const errorEvent = broadcasts.find(b => b.event.type === 'mcp:install-error');
      expect(errorEvent?.event.data.error).toBe(errorMessage);
      expect(errorEvent?.event.data.message).toBe(errorMessage);
      expect(errorEvent?.event.data.stage).toBe('error');
      expect(errorEvent?.event.data.progress).toBe(0);
    });
  });

  describe('Integration with marketplace features', () => {
    it('can fetch marketplace categories', async () => {
      const mockCategories = ['Development', 'Productivity', 'DevOps', 'AI/ML'];
      mockOrchestrator.getMcpMarketplaceCategories.mockResolvedValue(mockCategories);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/marketplace/categories',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ categories: mockCategories });
    });

    it('can fetch featured marketplace entries', async () => {
      const mockFeatured = [
        { name: 'filesystem-server', featured: true },
        { name: 'git-server', featured: true }
      ];
      mockOrchestrator.getFeaturedMcpEntries.mockResolvedValue(mockFeatured);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/marketplace/featured',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ entries: mockFeatured });
    });

    it('can get installation recommendations', async () => {
      const mockRecommendations = {
        recommended: ['filesystem-server', 'git-server'],
        popular: ['database-server'],
        reasons: {
          'filesystem-server': 'Essential for file operations',
          'git-server': 'Great for version control'
        }
      };
      mockOrchestrator.getMcpInstallationRecommendations.mockResolvedValue(mockRecommendations);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/recommendations',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual(mockRecommendations);
    });

    it('can auto-configure standard tools', async () => {
      const mockResult = {
        configured: ['filesystem-server', 'git-server'],
        skipped: [],
        errors: []
      };
      mockOrchestrator.autoConfigureMcpTools.mockResolvedValue(mockResult);

      const response = await server.inject({
        method: 'POST',
        url: '/mcp/auto-configure',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          developmentTools: true,
          productivityTools: false
        }),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.configured).toEqual(mockResult.configured);
      expect(body.message).toContain('2 servers configured');
    });
  });

  describe('Error handling and edge cases', () => {
    it('handles malformed marketplace entries gracefully', async () => {
      mockOrchestrator.getMcpMarketplaceEntries.mockResolvedValue(null);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/marketplace',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ entries: null });
    });

    it('handles marketplace filtering parameters', async () => {
      const mockEntries = [{ name: 'test-server', category: 'Development' }];
      mockOrchestrator.getMcpMarketplaceEntries.mockResolvedValue(mockEntries);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/marketplace?category=Development&search=test&featured=true&verified=false',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ entries: mockEntries });

      // Verify filtering options were passed correctly
      expect(mockOrchestrator.getMcpMarketplaceEntries).toHaveBeenCalledWith({
        category: 'Development',
        search: 'test',
        featured: true,
        verified: false
      });
    });

    it('handles undefined/null responses from orchestrator gracefully', async () => {
      mockOrchestrator.getMcpServerDetails.mockResolvedValue(null);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/servers/test-server',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toBeNull();
    });

    it('maintains proper HTTP status codes for different error types', async () => {
      const testCases = [
        {
          endpoint: '/mcp/servers/test',
          method: 'GET',
          error: 'not found',
          expectedStatus: 404
        },
        {
          endpoint: '/mcp/servers/test',
          method: 'GET',
          error: 'database error',
          expectedStatus: 500
        }
      ];

      for (const testCase of testCases) {
        mockOrchestrator.getMcpServerDetails.mockRejectedValue(new Error(testCase.error));

        const response = await server.inject({
          method: testCase.method,
          url: testCase.endpoint,
        });

        expect(response.statusCode).toBe(testCase.expectedStatus);
      }
    });
  });
});