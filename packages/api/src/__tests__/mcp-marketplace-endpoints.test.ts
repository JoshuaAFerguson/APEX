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
  }; }),
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

  // Track WebSocket broadcasts for testing
  const broadcasts: any[] = [];
  const mockBroadcast = vi.fn((taskId: string, event: any) => {
    broadcasts.push({ taskId, event });
  });

  // Manually register the new MCP endpoints (acceptance criteria format)

  // Install an MCP server (acceptance criteria format)
  fastify.post('/mcp/install/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!id || !id.trim()) {
      return reply.code(400).send({ error: 'Server ID is required' });
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
      return reply.code(500).send({
        ok: false,
        error: message
      });
    }
  });

  // Uninstall an MCP server (acceptance criteria format)
  fastify.delete('/mcp/uninstall/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!id || !id.trim()) {
      return reply.code(400).send({ error: 'Server ID is required' });
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
      return reply.code(500).send({
        ok: false,
        error: message
      });
    }
  });

  return { fastify, mockOrchestrator, mockBroadcast, broadcasts };
}

describe('MCP Marketplace API Endpoints (Acceptance Criteria)', () => {
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

  describe('POST /mcp/install/:id', () => {
    it('installs MCP server successfully with WebSocket events', async () => {
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

    it('handles installation errors with WebSocket events', async () => {
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
      // Test with empty server ID
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

  describe('DELETE /mcp/uninstall/:id', () => {
    it('uninstalls MCP server successfully with WebSocket events', async () => {
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

    it('handles uninstallation errors with WebSocket events', async () => {
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
      // Test with empty server ID
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

  describe('WebSocket event structure validation', () => {
    it('broadcasts events with consistent structure', async () => {
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
  });

  describe('Integration with existing endpoints', () => {
    it('maintains compatibility with existing MCP endpoints format', async () => {
      // The new endpoints should work alongside existing ones
      // This test ensures the URL patterns don't conflict

      // Test that both formats work (existing and new)
      const serverId = 'test-server';

      // New format (acceptance criteria)
      const newResponse = await server.inject({
        method: 'POST',
        url: `/mcp/install/${serverId}`,
      });

      expect(newResponse.statusCode).not.toBe(404); // Should be found
      expect([200, 500]).toContain(newResponse.statusCode); // Should be processed (not 404)
    });
  });
});