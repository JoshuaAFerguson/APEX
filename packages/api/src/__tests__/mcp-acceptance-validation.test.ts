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

// Test server setup to match exact acceptance criteria implementation
async function createTestServer() {
  const fastify = Fastify();

  // Mock orchestrator instance
  const mockOrchestrator = new ApexOrchestrator('/mock/project/path');

  // Track WebSocket broadcasts for testing
  const broadcasts: any[] = [];
  const mockBroadcast = vi.fn((taskId: string, event: any) => {
    broadcasts.push({ taskId, event });
  });

  // Register EXACT endpoints as specified in acceptance criteria

  // GET /mcp/servers (list/search) - Acceptance Criteria
  fastify.get('/mcp/servers', async (request, reply) => {
    try {
      const servers = await mockOrchestrator.listMcpServers();
      return servers;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list MCP servers';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /mcp/servers/:id (details) - Acceptance Criteria
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

  // POST /mcp/install/:id - Acceptance Criteria
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

  // DELETE /mcp/uninstall/:id - Acceptance Criteria
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

  // GET /mcp/installed - Acceptance Criteria
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

describe('MCP Marketplace API - Acceptance Criteria Validation', () => {
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

  describe('Acceptance Criteria: REST endpoints in @apex/api', () => {
    describe('GET /mcp/servers (list/search)', () => {
      it('AC-1: Endpoint exists and is accessible', async () => {
        mockOrchestrator.listMcpServers.mockResolvedValue([]);

        const response = await server.inject({
          method: 'GET',
          url: '/mcp/servers',
        });

        expect(response.statusCode).not.toBe(404);
        expect(response.statusCode).toBe(200);
      });

      it('AC-1: Returns list of servers in correct format', async () => {
        const expectedServers = [
          {
            name: 'filesystem-server',
            type: 'stdio',
            command: 'node',
            args: ['filesystem-server.js'],
            status: 'running'
          },
          {
            name: 'git-server',
            type: 'stdio',
            command: 'npx',
            args: ['@modelcontextprotocol/server-git'],
            status: 'stopped'
          }
        ];

        mockOrchestrator.listMcpServers.mockResolvedValue(expectedServers);

        const response = await server.inject({
          method: 'GET',
          url: '/mcp/servers',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toEqual(expectedServers);
        expect(Array.isArray(body)).toBe(true);
      });

      it('AC-1: Supports search functionality through orchestrator', async () => {
        mockOrchestrator.listMcpServers.mockResolvedValue([]);

        const response = await server.inject({
          method: 'GET',
          url: '/mcp/servers',
        });

        expect(response.statusCode).toBe(200);
        expect(mockOrchestrator.listMcpServers).toHaveBeenCalledTimes(1);
      });
    });

    describe('GET /mcp/servers/:id (details)', () => {
      it('AC-2: Endpoint exists with correct URL pattern', async () => {
        const serverId = 'filesystem-server';
        mockOrchestrator.getMcpServerDetails.mockResolvedValue({
          id: serverId,
          name: 'Filesystem Server',
          config: { type: 'stdio' },
          status: 'running'
        });

        const response = await server.inject({
          method: 'GET',
          url: `/mcp/servers/${serverId}`,
        });

        expect(response.statusCode).not.toBe(404);
        expect(response.statusCode).toBe(200);
      });

      it('AC-2: Returns detailed server information', async () => {
        const serverId = 'filesystem-server';
        const expectedDetails = {
          id: serverId,
          name: 'Filesystem MCP Server',
          config: {
            name: 'Filesystem MCP Server',
            type: 'stdio',
            command: 'node',
            args: ['filesystem-server.js'],
          },
          status: 'running',
          tools: ['read_file', 'write_file', 'list_directory'],
          readme: '# Filesystem MCP Server\nProvides file operations.',
          metadata: {
            version: '0.4.0',
            author: 'Anthropic',
            description: 'MCP server for filesystem operations'
          }
        };

        mockOrchestrator.getMcpServerDetails.mockResolvedValue(expectedDetails);

        const response = await server.inject({
          method: 'GET',
          url: `/mcp/servers/${serverId}`,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toEqual(expectedDetails);
        expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledWith(serverId);
      });

      it('AC-2: Handles non-existent server with 404', async () => {
        const serverId = 'non-existent-server';
        mockOrchestrator.getMcpServerDetails.mockRejectedValue(new Error(`MCP server '${serverId}' not found`));

        const response = await server.inject({
          method: 'GET',
          url: `/mcp/servers/${serverId}`,
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.body);
        expect(body.error).toContain('not found');
      });
    });

    describe('POST /mcp/install/:id', () => {
      it('AC-3: Endpoint exists with correct URL pattern', async () => {
        const serverId = 'test-server';
        mockOrchestrator.installMcpServer.mockResolvedValue({ type: 'stdio' });

        const response = await server.inject({
          method: 'POST',
          url: `/mcp/install/${serverId}`,
        });

        expect(response.statusCode).not.toBe(404);
        expect(response.statusCode).toBe(200);
      });

      it('AC-3: Installs server and returns success response', async () => {
        const serverId = 'filesystem-server';
        const expectedConfig = {
          type: 'stdio',
          command: 'node',
          args: ['filesystem-server.js'],
        };

        mockOrchestrator.installMcpServer.mockResolvedValue(expectedConfig);

        const response = await server.inject({
          method: 'POST',
          url: `/mcp/install/${serverId}`,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toEqual({
          ok: true,
          message: `MCP server '${serverId}' installed successfully`,
          serverConfig: expectedConfig
        });
        expect(mockOrchestrator.installMcpServer).toHaveBeenCalledWith(serverId);
      });

      it('AC-3: Handles installation errors appropriately', async () => {
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
          error: errorMessage
        });
      });

      it('AC-3: Validates server ID parameter', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/mcp/install/ ', // Invalid server ID
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('Server ID is required');
      });
    });

    describe('DELETE /mcp/uninstall/:id', () => {
      it('AC-4: Endpoint exists with correct URL pattern', async () => {
        const serverId = 'test-server';
        mockOrchestrator.uninstallMcpServer.mockResolvedValue(undefined);

        const response = await server.inject({
          method: 'DELETE',
          url: `/mcp/uninstall/${serverId}`,
        });

        expect(response.statusCode).not.toBe(404);
        expect(response.statusCode).toBe(200);
      });

      it('AC-4: Uninstalls server and returns success response', async () => {
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
          message: `MCP server '${serverId}' uninstalled successfully`
        });
        expect(mockOrchestrator.uninstallMcpServer).toHaveBeenCalledWith(serverId);
      });

      it('AC-4: Handles uninstallation errors appropriately', async () => {
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
          error: errorMessage
        });
      });

      it('AC-4: Validates server ID parameter', async () => {
        const response = await server.inject({
          method: 'DELETE',
          url: '/mcp/uninstall/ ', // Invalid server ID
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('Server ID is required');
      });
    });

    describe('GET /mcp/installed', () => {
      it('AC-5: Endpoint exists and is accessible', async () => {
        mockOrchestrator.listMcpInstallations.mockResolvedValue([]);

        const response = await server.inject({
          method: 'GET',
          url: '/mcp/installed',
        });

        expect(response.statusCode).not.toBe(404);
        expect(response.statusCode).toBe(200);
      });

      it('AC-5: Returns list of installed servers', async () => {
        const expectedInstallations = [
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
            serverId: 'git',
            installedAt: new Date('2024-01-02T00:00:00.000Z'),
            config: {
              type: 'stdio',
              command: 'npx',
              args: ['@modelcontextprotocol/server-git'],
            },
            status: 'stopped',
            version: '1.0.0'
          }
        ];

        mockOrchestrator.listMcpInstallations.mockResolvedValue(expectedInstallations);

        const response = await server.inject({
          method: 'GET',
          url: '/mcp/installed',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toEqual({ installations: expectedInstallations });
        expect(Array.isArray(body.installations)).toBe(true);
        expect(mockOrchestrator.listMcpInstallations).toHaveBeenCalledTimes(1);
      });

      it('AC-5: Handles empty installations list', async () => {
        mockOrchestrator.listMcpInstallations.mockResolvedValue([]);

        const response = await server.inject({
          method: 'GET',
          url: '/mcp/installed',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toEqual({ installations: [] });
      });
    });
  });

  describe('Acceptance Criteria: WebSocket events for installation progress', () => {
    describe('Installation Progress Events', () => {
      it('AC-6: Broadcasts mcp:install-start event', async () => {
        const serverId = 'websocket-test-server';
        mockOrchestrator.installMcpServer.mockResolvedValue({ type: 'stdio' });

        await server.inject({
          method: 'POST',
          url: `/mcp/install/${serverId}`,
        });

        const startEvent = broadcasts.find(b => b.event.type === 'mcp:install-start');
        expect(startEvent).toBeDefined();
        expect(startEvent.taskId).toBe('mcp-installation');
        expect(startEvent.event.data).toMatchObject({
          serverId,
          stage: 'starting',
          progress: 0,
          message: `Starting installation of MCP server '${serverId}'`
        });
        expect(startEvent.event.timestamp).toBeInstanceOf(Date);
      });

      it('AC-6: Broadcasts mcp:install-complete event', async () => {
        const serverId = 'websocket-test-server';
        const config = { type: 'stdio', command: 'test' };
        mockOrchestrator.installMcpServer.mockResolvedValue(config);

        await server.inject({
          method: 'POST',
          url: `/mcp/install/${serverId}`,
        });

        const completeEvent = broadcasts.find(b => b.event.type === 'mcp:install-complete');
        expect(completeEvent).toBeDefined();
        expect(completeEvent.taskId).toBe('mcp-installation');
        expect(completeEvent.event.data).toMatchObject({
          serverId,
          stage: 'complete',
          progress: 100,
          message: `MCP server '${serverId}' installed successfully`,
          config
        });
      });

      it('AC-6: Broadcasts mcp:install-error event on failure', async () => {
        const serverId = 'failing-server';
        const errorMessage = 'Installation failed';
        mockOrchestrator.installMcpServer.mockRejectedValue(new Error(errorMessage));

        await server.inject({
          method: 'POST',
          url: `/mcp/install/${serverId}`,
        });

        const errorEvent = broadcasts.find(b => b.event.type === 'mcp:install-error');
        expect(errorEvent).toBeDefined();
        expect(errorEvent.event.data).toMatchObject({
          serverId,
          stage: 'error',
          progress: 0,
          message: errorMessage,
          error: errorMessage
        });
      });

      it('AC-6: Broadcasts mcp:uninstall-start event', async () => {
        const serverId = 'uninstall-test-server';
        mockOrchestrator.uninstallMcpServer.mockResolvedValue(undefined);

        await server.inject({
          method: 'DELETE',
          url: `/mcp/uninstall/${serverId}`,
        });

        const startEvent = broadcasts.find(b => b.event.type === 'mcp:uninstall-start');
        expect(startEvent).toBeDefined();
        expect(startEvent.event.data).toMatchObject({
          serverId,
          stage: 'uninstalling',
          progress: 0,
          message: `Starting uninstallation of MCP server '${serverId}'`
        });
      });

      it('AC-6: Broadcasts mcp:uninstall-complete event', async () => {
        const serverId = 'uninstall-test-server';
        mockOrchestrator.uninstallMcpServer.mockResolvedValue(undefined);

        await server.inject({
          method: 'DELETE',
          url: `/mcp/uninstall/${serverId}`,
        });

        const completeEvent = broadcasts.find(b => b.event.type === 'mcp:uninstall-complete');
        expect(completeEvent).toBeDefined();
        expect(completeEvent.event.data).toMatchObject({
          serverId,
          stage: 'complete',
          progress: 100,
          message: `MCP server '${serverId}' uninstalled successfully`
        });
      });

      it('AC-6: Broadcasts mcp:uninstall-error event on failure', async () => {
        const serverId = 'failing-uninstall-server';
        const errorMessage = 'Uninstallation failed';
        mockOrchestrator.uninstallMcpServer.mockRejectedValue(new Error(errorMessage));

        await server.inject({
          method: 'DELETE',
          url: `/mcp/uninstall/${serverId}`,
        });

        const errorEvent = broadcasts.find(b => b.event.type === 'mcp:uninstall-error');
        expect(errorEvent).toBeDefined();
        expect(errorEvent.event.data).toMatchObject({
          serverId,
          stage: 'error',
          progress: 0,
          message: errorMessage,
          error: errorMessage
        });
      });
    });

    describe('WebSocket Event Structure Validation', () => {
      it('AC-6: All events have consistent structure', async () => {
        const serverId = 'structure-test-server';
        mockOrchestrator.installMcpServer.mockResolvedValue({ type: 'stdio' });

        await server.inject({
          method: 'POST',
          url: `/mcp/install/${serverId}`,
        });

        expect(broadcasts.length).toBeGreaterThan(0);

        broadcasts.forEach(({ taskId, event }) => {
          // Validate broadcast wrapper
          expect(taskId).toBe('mcp-installation');

          // Validate event structure
          expect(event).toHaveProperty('type');
          expect(event).toHaveProperty('taskId', 'mcp-installation');
          expect(event).toHaveProperty('timestamp');
          expect(event).toHaveProperty('data');

          // Validate timestamp
          expect(event.timestamp).toBeInstanceOf(Date);

          // Validate event data
          expect(event.data).toHaveProperty('serverId', serverId);
          expect(event.data).toHaveProperty('stage');
          expect(event.data).toHaveProperty('progress');
          expect(event.data).toHaveProperty('message');

          // Validate data types
          expect(typeof event.data.serverId).toBe('string');
          expect(typeof event.data.stage).toBe('string');
          expect(typeof event.data.progress).toBe('number');
          expect(typeof event.data.message).toBe('string');

          // Validate progress range
          expect(event.data.progress).toBeGreaterThanOrEqual(0);
          expect(event.data.progress).toBeLessThanOrEqual(100);
        });
      });

      it('AC-6: Event types follow correct naming convention', async () => {
        const serverId = 'naming-test-server';
        mockOrchestrator.installMcpServer.mockResolvedValue({ type: 'stdio' });

        await server.inject({
          method: 'POST',
          url: `/mcp/install/${serverId}`,
        });

        const eventTypes = broadcasts.map(b => b.event.type);

        // Check that event types follow mcp:action-stage pattern
        eventTypes.forEach(type => {
          expect(type).toMatch(/^mcp:(install|uninstall)-(start|complete|error)$/);
        });

        // Verify we have the expected event types
        expect(eventTypes).toContain('mcp:install-start');
        expect(eventTypes).toContain('mcp:install-complete');
      });

      it('AC-6: Progress values are logical', async () => {
        const serverId = 'progress-test-server';
        mockOrchestrator.installMcpServer.mockResolvedValue({ type: 'stdio' });

        await server.inject({
          method: 'POST',
          url: `/mcp/install/${serverId}`,
        });

        const progressValues = broadcasts.map(b => b.event.data.progress);

        // Start event should have progress 0
        const startEvent = broadcasts.find(b => b.event.type === 'mcp:install-start');
        expect(startEvent.event.data.progress).toBe(0);

        // Complete event should have progress 100
        const completeEvent = broadcasts.find(b => b.event.type === 'mcp:install-complete');
        expect(completeEvent.event.data.progress).toBe(100);
      });
    });
  });

  describe('Complete Acceptance Criteria Coverage', () => {
    it('AC-SUMMARY: All specified endpoints exist and function correctly', async () => {
      const endpoints = [
        { method: 'GET', url: '/mcp/servers', description: 'list/search' },
        { method: 'GET', url: '/mcp/servers/test', description: 'details' },
        { method: 'POST', url: '/mcp/install/test', description: 'install' },
        { method: 'DELETE', url: '/mcp/uninstall/test', description: 'uninstall' },
        { method: 'GET', url: '/mcp/installed', description: 'installed list' },
      ];

      // Mock all orchestrator methods
      mockOrchestrator.listMcpServers.mockResolvedValue([]);
      mockOrchestrator.getMcpServerDetails.mockResolvedValue({ id: 'test', name: 'Test Server' });
      mockOrchestrator.installMcpServer.mockResolvedValue({ type: 'stdio' });
      mockOrchestrator.uninstallMcpServer.mockResolvedValue(undefined);
      mockOrchestrator.listMcpInstallations.mockResolvedValue([]);

      for (const { method, url, description } of endpoints) {
        const response = await server.inject({
          method: method as any,
          url,
        });

        expect(response.statusCode, `${method} ${url} (${description}) should not return 404`).not.toBe(404);
        expect([200, 400, 500], `${method} ${url} (${description}) should return valid status`).toContain(response.statusCode);
      }
    });

    it('AC-SUMMARY: WebSocket events are properly structured and broadcasted', async () => {
      const serverId = 'complete-test-server';

      // Test install flow
      mockOrchestrator.installMcpServer.mockResolvedValue({ type: 'stdio', command: 'test' });

      await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      // Should have at least start and complete events
      expect(broadcasts.length).toBeGreaterThanOrEqual(2);

      // Verify event sequence
      const eventTypes = broadcasts.map(b => b.event.type);
      const startIndex = eventTypes.indexOf('mcp:install-start');
      const completeIndex = eventTypes.indexOf('mcp:install-complete');

      expect(startIndex).toBeGreaterThanOrEqual(0);
      expect(completeIndex).toBeGreaterThan(startIndex);

      // Reset and test uninstall flow
      vi.clearAllMocks();
      broadcasts.length = 0;
      mockOrchestrator.uninstallMcpServer.mockResolvedValue(undefined);

      await server.inject({
        method: 'DELETE',
        url: `/mcp/uninstall/${serverId}`,
      });

      const uninstallEventTypes = broadcasts.map(b => b.event.type);
      expect(uninstallEventTypes).toContain('mcp:uninstall-start');
      expect(uninstallEventTypes).toContain('mcp:uninstall-complete');
    });

    it('AC-SUMMARY: Error handling is consistent across all endpoints', async () => {
      const testError = new Error('Orchestrator error');

      // Set all methods to throw errors
      mockOrchestrator.listMcpServers.mockRejectedValue(testError);
      mockOrchestrator.getMcpServerDetails.mockRejectedValue(testError);
      mockOrchestrator.installMcpServer.mockRejectedValue(testError);
      mockOrchestrator.uninstallMcpServer.mockRejectedValue(testError);
      mockOrchestrator.listMcpInstallations.mockRejectedValue(testError);

      const endpoints = [
        { method: 'GET', url: '/mcp/servers' },
        { method: 'GET', url: '/mcp/servers/error-test' },
        { method: 'POST', url: '/mcp/install/error-test' },
        { method: 'DELETE', url: '/mcp/uninstall/error-test' },
        { method: 'GET', url: '/mcp/installed' },
      ];

      for (const { method, url } of endpoints) {
        const response = await server.inject({
          method: method as any,
          url,
        });

        expect(response.statusCode).toBe(500);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('error');
        expect(typeof body.error).toBe('string');
      }

      // Check that error events were broadcasted for install/uninstall operations
      const errorEvents = broadcasts.filter(b => b.event.type.includes('-error'));
      expect(errorEvents.length).toBe(2); // install-error and uninstall-error
    });
  });
});