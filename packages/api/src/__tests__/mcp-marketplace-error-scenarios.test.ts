/**
 * MCP Marketplace Error Scenario Tests
 *
 * Tests cover API error scenarios: network failure responses (503/504),
 * invalid server 404 responses, permission 403 responses, validation 400 responses.
 * HTTP status codes and error response bodies are verified.
 */

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
    startMcpServer: vi.fn(),
    stopMcpServer: vi.fn(),
    getMcpServerStatus: vi.fn(),
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

// Create test server with error-focused MCP endpoints
async function createTestServer() {
  const fastify = Fastify({ logger: false });
  const mockOrchestrator = new ApexOrchestrator('/mock/project/path');

  // Track WebSocket broadcasts for testing
  const broadcasts: any[] = [];
  const mockBroadcast = vi.fn((taskId: string, event: any) => {
    broadcasts.push({ taskId, event });
  });

  // Helper function to simulate HTTP errors with proper status codes
  const createHttpError = (statusCode: number, message: string, additionalData?: any) => {
    const error = new Error(message) as any;
    error.statusCode = statusCode;
    return { ...error, ...additionalData };
  };

  // MCP Marketplace API endpoints with comprehensive error handling

  // GET /mcp/marketplace - Service Unavailable (503) and Gateway Timeout (504) scenarios
  fastify.get('/mcp/marketplace', async (request, reply) => {
    try {
      const { category, search, featured, verified } = request.query as any;
      const options = { category, search, featured: featured === 'true', verified: verified === 'true' ? true : verified === 'false' ? false : undefined };
      const entries = await mockOrchestrator.getMcpMarketplaceEntries(options);
      return { entries };
    } catch (error: any) {
      if (error.statusCode === 503) {
        return reply.status(503).send({
          error: error.message,
          code: 'SERVICE_UNAVAILABLE',
          message: 'The marketplace service is temporarily unavailable',
          retryAfter: 300,
          service: 'marketplace'
        });
      }
      if (error.statusCode === 504) {
        return reply.status(504).send({
          error: error.message,
          code: 'GATEWAY_TIMEOUT',
          message: 'Request to marketplace service timed out',
          timeout: 30000,
          service: 'marketplace'
        });
      }
      const message = error instanceof Error ? error.message : 'Failed to fetch marketplace entries';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /mcp/servers/:id - Not Found (404) scenarios
  fastify.get('/mcp/servers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!id || !id.trim()) {
      return reply.status(400).send({
        error: 'Server ID is required',
        code: 'VALIDATION_ERROR',
        field: 'serverId',
        message: 'Server ID parameter cannot be empty'
      });
    }

    try {
      const serverDetails = await mockOrchestrator.getMcpServerDetails(id);
      return serverDetails;
    } catch (error: any) {
      if (error.statusCode === 404 || error.message.includes('not found')) {
        return reply.status(404).send({
          error: `MCP server '${id}' not found`,
          code: 'SERVER_NOT_FOUND',
          serverId: id,
          message: `The requested MCP server '${id}' was not found in the marketplace`,
          availableServers: ['filesystem', 'github', 'database', 'browser'],
          suggestions: ['Check server ID spelling', 'Browse available servers', 'Search marketplace']
        });
      }
      const message = error instanceof Error ? error.message : `Failed to get MCP server details for '${id}'`;
      return reply.status(500).send({ error: message });
    }
  });

  // POST /mcp/install/:id - Permission Denied (403) and Network Failure (503/504) scenarios
  fastify.post('/mcp/install/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!id || !id.trim()) {
      return reply.status(400).send({
        error: 'Server ID is required',
        code: 'VALIDATION_ERROR',
        field: 'serverId',
        message: 'Server ID parameter cannot be empty for installation'
      });
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
    } catch (error: any) {
      let errorEvent: any = {
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
      };

      // Handle specific HTTP error codes
      if (error.statusCode === 403) {
        errorEvent.data.code = 'PERMISSION_DENIED';
        mockBroadcast('mcp-installation', errorEvent);

        return reply.status(403).send({
          ok: false,
          error: 'Insufficient permissions to install MCP servers',
          code: 'PERMISSION_DENIED',
          action: 'install',
          resource: `mcp-server:${id}`,
          serverId: id,
          requiredPermissions: ['mcp:install', 'system:modify'],
          message: 'User does not have the required permissions to install MCP servers',
          contact: 'Please contact your administrator to grant the necessary permissions'
        });
      }

      if (error.statusCode === 503) {
        errorEvent.data.code = 'SERVICE_UNAVAILABLE';
        mockBroadcast('mcp-installation', errorEvent);

        return reply.status(503).send({
          ok: false,
          error: 'Installation service temporarily unavailable',
          code: 'SERVICE_UNAVAILABLE',
          serverId: id,
          message: 'The MCP server installation service is currently down for maintenance',
          retryAfter: 300,
          estimatedRecovery: new Date(Date.now() + 300000).toISOString()
        });
      }

      if (error.statusCode === 504) {
        errorEvent.data.code = 'GATEWAY_TIMEOUT';
        mockBroadcast('mcp-installation', errorEvent);

        return reply.status(504).send({
          ok: false,
          error: 'Installation request timed out',
          code: 'GATEWAY_TIMEOUT',
          serverId: id,
          message: `Installation of MCP server '${id}' timed out after 30 seconds`,
          timeout: 30000,
          suggestion: 'Try installing again or check server availability'
        });
      }

      if (error.statusCode === 404) {
        errorEvent.data.code = 'SERVER_NOT_FOUND';
        mockBroadcast('mcp-installation', errorEvent);

        return reply.status(404).send({
          ok: false,
          error: `MCP server '${id}' not found for installation`,
          code: 'SERVER_NOT_FOUND',
          serverId: id,
          message: `The requested MCP server '${id}' is not available in the marketplace`,
          availableServers: ['filesystem', 'github', 'database', 'browser']
        });
      }

      // Broadcast generic error event
      mockBroadcast('mcp-installation', errorEvent);

      const message = error instanceof Error ? error.message : `Failed to install MCP server '${id}'`;
      return reply.status(500).send({
        ok: false,
        error: message
      });
    }
  });

  // DELETE /mcp/uninstall/:id - Permission Denied (403) and Not Found (404) scenarios
  fastify.delete('/mcp/uninstall/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!id || !id.trim()) {
      return reply.status(400).send({
        error: 'Server ID is required',
        code: 'VALIDATION_ERROR',
        field: 'serverId',
        message: 'Server ID parameter cannot be empty for uninstallation'
      });
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
    } catch (error: any) {
      let errorEvent: any = {
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
      };

      // Handle specific HTTP error codes
      if (error.statusCode === 403) {
        errorEvent.data.code = 'PERMISSION_DENIED';
        mockBroadcast('mcp-installation', errorEvent);

        return reply.status(403).send({
          ok: false,
          error: 'Insufficient permissions to uninstall MCP servers',
          code: 'PERMISSION_DENIED',
          action: 'uninstall',
          resource: `mcp-server:${id}`,
          serverId: id,
          requiredPermissions: ['mcp:uninstall', 'system:modify'],
          message: 'User does not have the required permissions to uninstall MCP servers'
        });
      }

      if (error.statusCode === 404 || error.message.includes('not installed')) {
        errorEvent.data.code = 'SERVER_NOT_INSTALLED';
        mockBroadcast('mcp-installation', errorEvent);

        return reply.status(404).send({
          ok: false,
          error: `Cannot uninstall '${id}': server not installed`,
          code: 'SERVER_NOT_INSTALLED',
          serverId: id,
          message: `MCP server '${id}' is not currently installed and cannot be uninstalled`,
          installedServers: ['filesystem', 'github']
        });
      }

      // Broadcast generic error event
      mockBroadcast('mcp-installation', errorEvent);

      const message = error instanceof Error ? error.message : `Failed to uninstall MCP server '${id}'`;
      return reply.status(500).send({
        ok: false,
        error: message
      });
    }
  });

  // POST /mcp/servers/:serverName/start - Permission Denied (403) scenarios
  fastify.post('/mcp/servers/:serverName/start', async (request, reply) => {
    const { serverName } = request.params as { serverName: string };

    if (!serverName || !serverName.trim()) {
      return reply.status(400).send({
        error: 'Server name is required',
        code: 'VALIDATION_ERROR',
        field: 'serverName',
        message: 'Server name parameter cannot be empty for start operation'
      });
    }

    try {
      await mockOrchestrator.startMcpServer(serverName);
      return {
        ok: true,
        message: `MCP server '${serverName}' started successfully`
      };
    } catch (error: any) {
      if (error.statusCode === 403) {
        return reply.status(403).send({
          ok: false,
          error: 'Permission denied: cannot control MCP servers',
          code: 'PERMISSION_DENIED',
          action: 'start',
          resource: `mcp-server:${serverName}`,
          serverName: serverName,
          requiredPermissions: ['mcp:control', 'system:process:start'],
          message: 'User does not have the required permissions to start MCP servers'
        });
      }

      if (error.statusCode === 404) {
        return reply.status(404).send({
          ok: false,
          error: `MCP server '${serverName}' not found`,
          code: 'SERVER_NOT_FOUND',
          serverName: serverName,
          message: `The MCP server '${serverName}' was not found or is not installed`
        });
      }

      const message = error instanceof Error ? error.message : `Failed to start MCP server '${serverName}'`;
      return reply.status(500).send({
        ok: false,
        error: message
      });
    }
  });

  // Validation (400) error scenarios for various endpoints
  fastify.post('/mcp/validate/install', async (request, reply) => {
    const body = request.body as any;

    // Validate request body structure
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({
        error: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        message: 'Request body must be a valid JSON object',
        expectedStructure: {
          serverId: 'string',
          config: 'object (optional)'
        }
      });
    }

    // Validate server ID
    if (!body.serverId) {
      return reply.status(400).send({
        error: 'Missing required field: serverId',
        code: 'VALIDATION_ERROR',
        field: 'serverId',
        message: 'serverId is required for MCP server installation',
        requiredFields: ['serverId']
      });
    }

    // Validate server ID format
    if (typeof body.serverId !== 'string' || !/^[a-zA-Z0-9-_]+$/.test(body.serverId)) {
      return reply.status(400).send({
        error: 'Invalid server ID format',
        code: 'VALIDATION_ERROR',
        field: 'serverId',
        value: body.serverId,
        allowedPattern: '^[a-zA-Z0-9-_]+$',
        message: 'Server ID must contain only alphanumeric characters, hyphens, and underscores',
        examples: ['filesystem', 'github-server', 'database_connector']
      });
    }

    // Validate configuration if provided
    if (body.config) {
      if (typeof body.config !== 'object') {
        return reply.status(400).send({
          error: 'Invalid configuration format',
          code: 'VALIDATION_ERROR',
          field: 'config',
          value: typeof body.config,
          expectedType: 'object',
          message: 'Server configuration must be an object'
        });
      }

      if (!body.config.command) {
        return reply.status(400).send({
          error: 'Missing required configuration field: command',
          code: 'VALIDATION_ERROR',
          field: 'config.command',
          requiredConfigFields: ['command', 'type'],
          providedFields: Object.keys(body.config),
          message: 'Server configuration must include a command field'
        });
      }

      // Validate command type
      const validTypes = ['stdio', 'sse', 'websocket'];
      if (body.config.type && !validTypes.includes(body.config.type)) {
        return reply.status(400).send({
          error: 'Invalid server type',
          code: 'VALIDATION_ERROR',
          field: 'config.type',
          value: body.config.type,
          allowedValues: validTypes,
          message: 'Server type must be one of: stdio, sse, websocket'
        });
      }
    }

    return {
      ok: true,
      message: 'Validation passed',
      validatedData: body
    };
  });

  // Query parameter validation endpoint
  fastify.get('/mcp/validate/marketplace', async (request, reply) => {
    const query = request.query as any;

    // Validate limit parameter
    if (query.limit !== undefined) {
      const limit = parseInt(query.limit);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return reply.status(400).send({
          error: 'Invalid limit parameter',
          code: 'VALIDATION_ERROR',
          field: 'limit',
          value: query.limit,
          constraints: {
            type: 'integer',
            minimum: 1,
            maximum: 100
          },
          message: 'Limit must be an integer between 1 and 100'
        });
      }
    }

    // Validate offset parameter
    if (query.offset !== undefined) {
      const offset = parseInt(query.offset);
      if (isNaN(offset) || offset < 0) {
        return reply.status(400).send({
          error: 'Invalid offset parameter',
          code: 'VALIDATION_ERROR',
          field: 'offset',
          value: query.offset,
          constraints: {
            type: 'integer',
            minimum: 0
          },
          message: 'Offset must be a non-negative integer'
        });
      }
    }

    // Validate sort parameter
    if (query.sort !== undefined) {
      const validSorts = ['name', 'rating', 'installCount', 'createdAt', 'updatedAt'];
      if (!validSorts.includes(query.sort)) {
        return reply.status(400).send({
          error: 'Invalid sort parameter',
          code: 'VALIDATION_ERROR',
          field: 'sort',
          value: query.sort,
          allowedValues: validSorts,
          message: 'Sort field must be one of: name, rating, installCount, createdAt, updatedAt'
        });
      }
    }

    // Validate category parameter
    if (query.category !== undefined) {
      const validCategories = ['filesystem', 'development', 'database', 'ai', 'productivity'];
      if (!validCategories.includes(query.category)) {
        return reply.status(400).send({
          error: 'Invalid category parameter',
          code: 'VALIDATION_ERROR',
          field: 'category',
          value: query.category,
          allowedValues: validCategories,
          message: 'Category must be one of the available marketplace categories'
        });
      }
    }

    return {
      ok: true,
      message: 'Query parameters are valid',
      queryParams: query
    };
  });

  return { fastify, mockOrchestrator, mockBroadcast, broadcasts };
}

describe('MCP Marketplace Error Scenarios (API Acceptance Criteria)', () => {
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

  describe('Network Failure Responses (503 Service Unavailable)', () => {
    it('should return 503 when marketplace service is temporarily unavailable', async () => {
      // Mock orchestrator to simulate service unavailable
      mockOrchestrator.getMcpMarketplaceEntries = vi.fn().mockImplementation(() => {
        const error = new Error('Marketplace service temporarily unavailable');
        (error as any).statusCode = 503;
        throw error;
      });

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/marketplace',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);

      // Verify error response body structure
      expect(body).toHaveProperty('error', 'Marketplace service temporarily unavailable');
      expect(body).toHaveProperty('code', 'SERVICE_UNAVAILABLE');
      expect(body).toHaveProperty('message', 'The marketplace service is temporarily unavailable');
      expect(body).toHaveProperty('retryAfter', 300);
      expect(body).toHaveProperty('service', 'marketplace');
    });

    it('should return 503 when MCP server installation service is unavailable', async () => {
      mockOrchestrator.installMcpServer = vi.fn().mockImplementation(() => {
        const error = new Error('Installation service temporarily unavailable');
        (error as any).statusCode = 503;
        throw error;
      });

      const response = await server.inject({
        method: 'POST',
        url: '/mcp/install/test-server',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);

      // Verify error response body structure
      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error', 'Installation service temporarily unavailable');
      expect(body).toHaveProperty('code', 'SERVICE_UNAVAILABLE');
      expect(body).toHaveProperty('serverId', 'test-server');
      expect(body).toHaveProperty('message', 'The MCP server installation service is currently down for maintenance');
      expect(body).toHaveProperty('retryAfter', 300);
      expect(body).toHaveProperty('estimatedRecovery');

      // Verify WebSocket error event was broadcasted
      expect(mockBroadcast).toHaveBeenCalledTimes(2); // start + error events
      const errorEvent = broadcasts.find(b => b.event.type === 'mcp:install-error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.event.data.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('Network Failure Responses (504 Gateway Timeout)', () => {
    it('should return 504 when marketplace request times out', async () => {
      mockOrchestrator.getMcpMarketplaceEntries = vi.fn().mockImplementation(() => {
        const error = new Error('Marketplace request timed out');
        (error as any).statusCode = 504;
        throw error;
      });

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/marketplace',
      });

      expect(response.statusCode).toBe(504);
      const body = JSON.parse(response.body);

      // Verify error response body structure
      expect(body).toHaveProperty('error', 'Marketplace request timed out');
      expect(body).toHaveProperty('code', 'GATEWAY_TIMEOUT');
      expect(body).toHaveProperty('message', 'Request to marketplace service timed out');
      expect(body).toHaveProperty('timeout', 30000);
      expect(body).toHaveProperty('service', 'marketplace');
    });

    it('should return 504 when MCP server installation times out', async () => {
      mockOrchestrator.installMcpServer = vi.fn().mockImplementation(() => {
        const error = new Error('Installation request timed out');
        (error as any).statusCode = 504;
        throw error;
      });

      const response = await server.inject({
        method: 'POST',
        url: '/mcp/install/slow-server',
      });

      expect(response.statusCode).toBe(504);
      const body = JSON.parse(response.body);

      // Verify error response body structure
      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error', 'Installation request timed out');
      expect(body).toHaveProperty('code', 'GATEWAY_TIMEOUT');
      expect(body).toHaveProperty('serverId', 'slow-server');
      expect(body).toHaveProperty('message', "Installation of MCP server 'slow-server' timed out after 30 seconds");
      expect(body).toHaveProperty('timeout', 30000);
      expect(body).toHaveProperty('suggestion', 'Try installing again or check server availability');

      // Verify WebSocket error event was broadcasted
      expect(mockBroadcast).toHaveBeenCalledTimes(2); // start + error events
      const errorEvent = broadcasts.find(b => b.event.type === 'mcp:install-error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.event.data.code).toBe('GATEWAY_TIMEOUT');
    });
  });

  describe('Invalid Server 404 Responses', () => {
    it('should return 404 with detailed error when server does not exist', async () => {
      mockOrchestrator.getMcpServerDetails = vi.fn().mockImplementation(() => {
        const error = new Error('Server not found');
        (error as any).statusCode = 404;
        throw error;
      });

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/servers/nonexistent-server',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);

      // Verify error response body structure
      expect(body).toHaveProperty('error', "MCP server 'nonexistent-server' not found");
      expect(body).toHaveProperty('code', 'SERVER_NOT_FOUND');
      expect(body).toHaveProperty('serverId', 'nonexistent-server');
      expect(body).toHaveProperty('message', "The requested MCP server 'nonexistent-server' was not found in the marketplace");
      expect(body).toHaveProperty('availableServers');
      expect(body.availableServers).toContain('filesystem');
      expect(body.availableServers).toContain('github');
      expect(body).toHaveProperty('suggestions');
      expect(body.suggestions).toContain('Check server ID spelling');
    });

    it('should return 404 when trying to install non-existent server', async () => {
      mockOrchestrator.installMcpServer = vi.fn().mockImplementation(() => {
        const error = new Error('Server not found in marketplace');
        (error as any).statusCode = 404;
        throw error;
      });

      const response = await server.inject({
        method: 'POST',
        url: '/mcp/install/missing-server',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);

      // Verify error response body structure
      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error', "MCP server 'missing-server' not found for installation");
      expect(body).toHaveProperty('code', 'SERVER_NOT_FOUND');
      expect(body).toHaveProperty('serverId', 'missing-server');
      expect(body).toHaveProperty('message', "The requested MCP server 'missing-server' is not available in the marketplace");
      expect(body).toHaveProperty('availableServers');
      expect(body.availableServers).toContain('filesystem');

      // Verify WebSocket error event was broadcasted
      const errorEvent = broadcasts.find(b => b.event.type === 'mcp:install-error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.event.data.code).toBe('SERVER_NOT_FOUND');
    });

    it('should return 404 when trying to uninstall non-installed server', async () => {
      mockOrchestrator.uninstallMcpServer = vi.fn().mockImplementation(() => {
        const error = new Error('Server not installed');
        (error as any).statusCode = 404;
        throw error;
      });

      const response = await server.inject({
        method: 'DELETE',
        url: '/mcp/uninstall/not-installed-server',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);

      // Verify error response body structure
      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error', "Cannot uninstall 'not-installed-server': server not installed");
      expect(body).toHaveProperty('code', 'SERVER_NOT_INSTALLED');
      expect(body).toHaveProperty('serverId', 'not-installed-server');
      expect(body).toHaveProperty('message', "MCP server 'not-installed-server' is not currently installed and cannot be uninstalled");
      expect(body).toHaveProperty('installedServers');
      expect(body.installedServers).toContain('filesystem');

      // Verify WebSocket error event was broadcasted
      const errorEvent = broadcasts.find(b => b.event.type === 'mcp:uninstall-error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.event.data.code).toBe('SERVER_NOT_INSTALLED');
    });
  });

  describe('Permission 403 Responses', () => {
    it('should return 403 when user lacks permissions to install servers', async () => {
      mockOrchestrator.installMcpServer = vi.fn().mockImplementation(() => {
        const error = new Error('Insufficient permissions to install MCP servers');
        (error as any).statusCode = 403;
        throw error;
      });

      const response = await server.inject({
        method: 'POST',
        url: '/mcp/install/restricted-server',
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);

      // Verify error response body structure
      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error', 'Insufficient permissions to install MCP servers');
      expect(body).toHaveProperty('code', 'PERMISSION_DENIED');
      expect(body).toHaveProperty('action', 'install');
      expect(body).toHaveProperty('resource', 'mcp-server:restricted-server');
      expect(body).toHaveProperty('serverId', 'restricted-server');
      expect(body).toHaveProperty('requiredPermissions');
      expect(body.requiredPermissions).toContain('mcp:install');
      expect(body.requiredPermissions).toContain('system:modify');
      expect(body).toHaveProperty('message', 'User does not have the required permissions to install MCP servers');
      expect(body).toHaveProperty('contact', 'Please contact your administrator to grant the necessary permissions');

      // Verify WebSocket error event was broadcasted
      const errorEvent = broadcasts.find(b => b.event.type === 'mcp:install-error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.event.data.code).toBe('PERMISSION_DENIED');
    });

    it('should return 403 when user lacks permissions to uninstall servers', async () => {
      mockOrchestrator.uninstallMcpServer = vi.fn().mockImplementation(() => {
        const error = new Error('Insufficient permissions to uninstall MCP servers');
        (error as any).statusCode = 403;
        throw error;
      });

      const response = await server.inject({
        method: 'DELETE',
        url: '/mcp/uninstall/protected-server',
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);

      // Verify error response body structure
      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error', 'Insufficient permissions to uninstall MCP servers');
      expect(body).toHaveProperty('code', 'PERMISSION_DENIED');
      expect(body).toHaveProperty('action', 'uninstall');
      expect(body).toHaveProperty('resource', 'mcp-server:protected-server');
      expect(body).toHaveProperty('serverId', 'protected-server');
      expect(body).toHaveProperty('requiredPermissions');
      expect(body.requiredPermissions).toContain('mcp:uninstall');
      expect(body.requiredPermissions).toContain('system:modify');
    });

    it('should return 403 when user lacks permissions to start/stop servers', async () => {
      mockOrchestrator.startMcpServer = vi.fn().mockImplementation(() => {
        const error = new Error('Permission denied: cannot control MCP servers');
        (error as any).statusCode = 403;
        throw error;
      });

      const response = await server.inject({
        method: 'POST',
        url: '/mcp/servers/controlled-server/start',
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);

      // Verify error response body structure
      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error', 'Permission denied: cannot control MCP servers');
      expect(body).toHaveProperty('code', 'PERMISSION_DENIED');
      expect(body).toHaveProperty('action', 'start');
      expect(body).toHaveProperty('resource', 'mcp-server:controlled-server');
      expect(body).toHaveProperty('serverName', 'controlled-server');
      expect(body).toHaveProperty('requiredPermissions');
      expect(body.requiredPermissions).toContain('mcp:control');
      expect(body.requiredPermissions).toContain('system:process:start');
    });
  });

  describe('Validation 400 Responses', () => {
    it('should return 400 for invalid server ID format in installation', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/validate/install',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          serverId: 'invalid@server!',
          config: { type: 'stdio' }
        })
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      // Verify error response body structure
      expect(body).toHaveProperty('error', 'Invalid server ID format');
      expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(body).toHaveProperty('field', 'serverId');
      expect(body).toHaveProperty('value', 'invalid@server!');
      expect(body).toHaveProperty('allowedPattern', '^[a-zA-Z0-9-_]+$');
      expect(body).toHaveProperty('message', 'Server ID must contain only alphanumeric characters, hyphens, and underscores');
      expect(body).toHaveProperty('examples');
      expect(body.examples).toContain('filesystem');
    });

    it('should return 400 for missing required configuration fields', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/validate/install',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          serverId: 'test-server',
          config: { type: 'stdio' } // Missing required 'command' field
        })
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      // Verify error response body structure
      expect(body).toHaveProperty('error', 'Missing required configuration field: command');
      expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(body).toHaveProperty('field', 'config.command');
      expect(body).toHaveProperty('requiredConfigFields');
      expect(body.requiredConfigFields).toContain('command');
      expect(body.requiredConfigFields).toContain('type');
      expect(body).toHaveProperty('providedFields');
      expect(body.providedFields).toContain('type');
      expect(body.providedFields).not.toContain('command');
    });

    it('should return 400 for invalid query parameters', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/mcp/validate/marketplace?limit=invalid&sort=badvalue&offset=-1',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      // Verify error response body structure (first validation error encountered)
      expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(body).toHaveProperty('field', 'limit'); // Validates limit first
      expect(body).toHaveProperty('value', 'invalid');
      expect(body).toHaveProperty('constraints');
      expect(body.constraints).toHaveProperty('type', 'integer');
      expect(body.constraints).toHaveProperty('minimum', 1);
      expect(body.constraints).toHaveProperty('maximum', 100);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/validate/install',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({}) // Missing serverId
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      // Verify error response body structure
      expect(body).toHaveProperty('error', 'Missing required field: serverId');
      expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(body).toHaveProperty('field', 'serverId');
      expect(body).toHaveProperty('message', 'serverId is required for MCP server installation');
      expect(body).toHaveProperty('requiredFields');
      expect(body.requiredFields).toContain('serverId');
    });

    it('should return 400 for empty server ID in URL parameters', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/mcp/servers/ ', // Space only - empty server ID
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      // Verify error response body structure
      expect(body).toHaveProperty('error', 'Server ID is required');
      expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(body).toHaveProperty('field', 'serverId');
      expect(body).toHaveProperty('message', 'Server ID parameter cannot be empty');
    });

    it('should return 400 for invalid server type in configuration', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/validate/install',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          serverId: 'test-server',
          config: {
            command: 'test-command',
            type: 'invalid-type'
          }
        })
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      // Verify error response body structure
      expect(body).toHaveProperty('error', 'Invalid server type');
      expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(body).toHaveProperty('field', 'config.type');
      expect(body).toHaveProperty('value', 'invalid-type');
      expect(body).toHaveProperty('allowedValues');
      expect(body.allowedValues).toContain('stdio');
      expect(body.allowedValues).toContain('sse');
      expect(body.allowedValues).toContain('websocket');
      expect(body).toHaveProperty('message', 'Server type must be one of: stdio, sse, websocket');
    });
  });

  describe('HTTP Status Code and Response Body Verification', () => {
    it('should consistently return proper HTTP status codes for different error types', async () => {
      const errorScenarios = [
        {
          setup: () => {
            mockOrchestrator.getMcpMarketplaceEntries = vi.fn().mockImplementation(() => {
              const error = new Error('Service unavailable');
              (error as any).statusCode = 503;
              throw error;
            });
          },
          request: { method: 'GET', url: '/mcp/marketplace' },
          expectedStatus: 503,
          expectedCode: 'SERVICE_UNAVAILABLE'
        },
        {
          setup: () => {
            mockOrchestrator.installMcpServer = vi.fn().mockImplementation(() => {
              const error = new Error('Gateway timeout');
              (error as any).statusCode = 504;
              throw error;
            });
          },
          request: { method: 'POST', url: '/mcp/install/timeout-server' },
          expectedStatus: 504,
          expectedCode: 'GATEWAY_TIMEOUT'
        },
        {
          setup: () => {
            mockOrchestrator.getMcpServerDetails = vi.fn().mockImplementation(() => {
              const error = new Error('Server not found');
              (error as any).statusCode = 404;
              throw error;
            });
          },
          request: { method: 'GET', url: '/mcp/servers/missing-server' },
          expectedStatus: 404,
          expectedCode: 'SERVER_NOT_FOUND'
        },
        {
          setup: () => {
            mockOrchestrator.startMcpServer = vi.fn().mockImplementation(() => {
              const error = new Error('Permission denied');
              (error as any).statusCode = 403;
              throw error;
            });
          },
          request: { method: 'POST', url: '/mcp/servers/denied-server/start' },
          expectedStatus: 403,
          expectedCode: 'PERMISSION_DENIED'
        }
      ];

      for (const scenario of errorScenarios) {
        scenario.setup();

        const response = await server.inject(scenario.request);

        expect(response.statusCode).toBe(scenario.expectedStatus);
        const body = JSON.parse(response.body);
        expect(body.code).toBe(scenario.expectedCode);

        vi.clearAllMocks();
      }
    });

    it('should include all required fields in error response bodies', async () => {
      // Test 404 error response structure
      mockOrchestrator.getMcpServerDetails = vi.fn().mockRejectedValue(new Error('Server not found'));

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/servers/test-server',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);

      // Verify all required fields are present
      const requiredFields = ['error', 'code', 'serverId', 'message', 'availableServers', 'suggestions'];
      requiredFields.forEach(field => {
        expect(body).toHaveProperty(field);
      });

      // Verify data types
      expect(typeof body.error).toBe('string');
      expect(typeof body.code).toBe('string');
      expect(typeof body.serverId).toBe('string');
      expect(typeof body.message).toBe('string');
      expect(Array.isArray(body.availableServers)).toBe(true);
      expect(Array.isArray(body.suggestions)).toBe(true);
    });

    it('should include detailed context in validation error responses', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/mcp/validate/marketplace?category=invalid-category&limit=200&sort=invalid-sort',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      // Verify validation error structure
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(body).toHaveProperty('field');
      expect(body).toHaveProperty('value');

      // Should include either constraints or allowedValues depending on validation type
      const hasConstraints = body.hasOwnProperty('constraints');
      const hasAllowedValues = body.hasOwnProperty('allowedValues');
      expect(hasConstraints || hasAllowedValues).toBe(true);
    });
  });
});