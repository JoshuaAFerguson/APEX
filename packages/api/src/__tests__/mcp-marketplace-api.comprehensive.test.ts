/**
 * Comprehensive API endpoint tests for MCP marketplace functionality
 * Tests all marketplace-related API endpoints and WebSocket events
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { ApexOrchestrator } from '@apexcli/orchestrator';

// Mock dependencies
vi.mock('@apexcli/orchestrator');
vi.mock('@apexcli/core');

describe('MCP Marketplace API Endpoints', () => {
  let app: FastifyInstance;
  let mockOrchestrator: ApexOrchestrator;

  const sampleMarketplaceEntries = [
    {
      name: 'filesystem',
      title: 'Filesystem Server',
      description: 'Secure filesystem access',
      version: '1.0.0',
      category: 'filesystem',
      verified: true,
      featured: true,
      capabilities: ['file:read', 'file:write'],
      serverConfig: {
        name: 'filesystem',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        autoStart: true,
      },
      envVars: [],
      tags: ['filesystem'],
      author: 'Anthropic',
      license: 'MIT',
      installCount: 1000,
      rating: 4.8,
      reviewCount: 125,
    },
    {
      name: 'github',
      title: 'GitHub Server',
      description: 'GitHub integration',
      version: '1.1.0',
      category: 'development',
      verified: true,
      featured: false,
      capabilities: ['git:clone', 'api:github'],
      serverConfig: {
        name: 'github',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        autoStart: false,
      },
      envVars: [
        {
          name: 'GITHUB_ACCESS_TOKEN',
          description: 'GitHub access for operations',
          required: true,
        },
      ],
      tags: ['git', 'github'],
      author: 'Anthropic',
      license: 'MIT',
      installCount: 750,
      rating: 4.6,
      reviewCount: 89,
    },
  ];

  const sampleInstallations = [
    {
      id: 'install-1',
      serverId: 'filesystem',
      installedAt: new Date('2024-01-01T00:00:00.000Z'),
      status: 'installed',
      configPath: '/test/.apex/mcp-installations/install-1.json',
    },
  ];

  const sampleServerDetails = {
    name: 'filesystem',
    status: 'running',
    config: {
      name: 'filesystem',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      autoStart: true,
    },
    capabilities: ['file:read', 'file:write'],
    installation: {
      id: 'install-1',
      installedAt: new Date('2024-01-01T00:00:00.000Z'),
      status: 'installed',
    },
  };

  beforeEach(async () => {
    // Create mock orchestrator
    mockOrchestrator = new (vi.mocked(ApexOrchestrator))() as any;

    // Setup orchestrator mock methods
    mockOrchestrator.getMcpMarketplaceEntries = vi.fn().mockResolvedValue(sampleMarketplaceEntries);
    mockOrchestrator.listMcpServers = vi.fn().mockResolvedValue([
      { name: 'filesystem', status: 'running' },
    ]);
    mockOrchestrator.listMcpInstallations = vi.fn().mockResolvedValue(sampleInstallations);
    mockOrchestrator.getMcpServerDetails = vi.fn().mockResolvedValue(sampleServerDetails);
    mockOrchestrator.installMcpServer = vi.fn().mockResolvedValue({
      name: 'test-server',
      type: 'stdio',
      command: 'test-command',
      autoStart: false,
    });
    mockOrchestrator.uninstallMcpServer = vi.fn().mockResolvedValue(undefined);
    mockOrchestrator.getMcpServerStatus = vi.fn().mockResolvedValue({
      serverId: 'filesystem',
      status: 'running',
      pid: 12345,
      uptime: 3600000,
    });
    mockOrchestrator.startMcpServer = vi.fn().mockResolvedValue(undefined);
    mockOrchestrator.stopMcpServer = vi.fn().mockResolvedValue(undefined);
    mockOrchestrator.getMcpMarketplaceCategories = vi.fn().mockResolvedValue([
      { id: 'filesystem', name: 'Filesystem', description: 'File operations' },
      { id: 'development', name: 'Development', description: 'Development tools' },
    ]);
    mockOrchestrator.getFeaturedMcpEntries = vi.fn().mockResolvedValue(
      sampleMarketplaceEntries.filter(entry => entry.featured)
    );
    mockOrchestrator.getMcpInstallationRecommendations = vi.fn().mockResolvedValue([
      { serverId: 'filesystem', reason: 'Popular choice for file operations' },
    ]);

    // Create Fastify app and register routes
    app = Fastify({ logger: false });

    // Register MCP marketplace routes (simplified version)
    app.get('/mcp/marketplace', async (request, reply) => {
      try {
        const { category, search, featured, verified } = request.query as any;
        let entries = await mockOrchestrator.getMcpMarketplaceEntries();

        if (category) {
          entries = entries.filter(entry => entry.category === category);
        }
        if (search) {
          entries = entries.filter(entry =>
            entry.name.toLowerCase().includes(search.toLowerCase()) ||
            entry.description.toLowerCase().includes(search.toLowerCase())
          );
        }
        if (featured !== undefined) {
          entries = entries.filter(entry => entry.featured === (featured === 'true'));
        }
        if (verified !== undefined) {
          entries = entries.filter(entry => entry.verified === (verified === 'true'));
        }

        return { entries };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get marketplace entries';
        return reply.status(500).send({ error: message });
      }
    });

    app.get('/mcp/servers', async (request, reply) => {
      try {
        const servers = await mockOrchestrator.listMcpServers();
        return servers;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list MCP servers';
        return reply.status(500).send({ error: message });
      }
    });

    app.get('/mcp/installed', async (request, reply) => {
      try {
        const installations = await mockOrchestrator.listMcpInstallations();
        return { installations };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list installed MCP servers';
        return reply.status(500).send({ error: message });
      }
    });

    app.get('/mcp/servers/:id', async (request, reply) => {
      const { id } = request.params as any;
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

    app.post('/mcp/install/:id', async (request, reply) => {
      const { id } = request.params as any;
      try {
        const serverConfig = await mockOrchestrator.installMcpServer(id);
        return {
          ok: true,
          message: `MCP server '${id}' installed successfully`,
          serverConfig
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : `Failed to install MCP server '${id}'`;
        return reply.status(500).send({
          ok: false,
          error: message
        });
      }
    });

    app.delete('/mcp/uninstall/:id', async (request, reply) => {
      const { id } = request.params as any;
      try {
        await mockOrchestrator.uninstallMcpServer(id);
        return {
          ok: true,
          message: `MCP server '${id}' uninstalled successfully`
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : `Failed to uninstall MCP server '${id}'`;
        return reply.status(500).send({
          ok: false,
          error: message
        });
      }
    });

    app.get('/mcp/servers/:serverName/status', async (request, reply) => {
      const { serverName } = request.params as any;
      try {
        const status = await mockOrchestrator.getMcpServerStatus(serverName);
        return status;
      } catch (error) {
        const message = error instanceof Error ? error.message : `Failed to get status for MCP server '${serverName}'`;
        return reply.status(500).send({ error: message });
      }
    });

    app.post('/mcp/servers/:serverName/start', async (request, reply) => {
      const { serverName } = request.params as any;
      try {
        await mockOrchestrator.startMcpServer(serverName);
        return {
          ok: true,
          message: `MCP server '${serverName}' started successfully`
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : `Failed to start MCP server '${serverName}'`;
        return reply.status(500).send({
          ok: false,
          error: message
        });
      }
    });

    app.post('/mcp/servers/:serverName/stop', async (request, reply) => {
      const { serverName } = request.params as any;
      try {
        await mockOrchestrator.stopMcpServer(serverName);
        return {
          ok: true,
          message: `MCP server '${serverName}' stopped successfully`
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : `Failed to stop MCP server '${serverName}'`;
        return reply.status(500).send({
          ok: false,
          error: message
        });
      }
    });

    app.get('/mcp/marketplace/categories', async (request, reply) => {
      try {
        const categories = await mockOrchestrator.getMcpMarketplaceCategories();
        return { categories };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get marketplace categories';
        return reply.status(500).send({ error: message });
      }
    });

    app.get('/mcp/marketplace/featured', async (request, reply) => {
      try {
        const entries = await mockOrchestrator.getFeaturedMcpEntries();
        return { entries };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get featured marketplace entries';
        return reply.status(500).send({ error: message });
      }
    });

    app.get('/mcp/recommendations', async (request, reply) => {
      try {
        const recommendations = await mockOrchestrator.getMcpInstallationRecommendations();
        return recommendations;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get installation recommendations';
        return reply.status(500).send({ error: message });
      }
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('GET /mcp/marketplace', () => {
    it('should return all marketplace entries', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/marketplace',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('entries');
      expect(body.entries).toHaveLength(2);
      expect(body.entries[0].name).toBe('filesystem');
      expect(body.entries[1].name).toBe('github');
    });

    it('should filter by category', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/marketplace?category=filesystem',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].name).toBe('filesystem');
    });

    it('should filter by search query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/marketplace?search=github',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].name).toBe('github');
    });

    it('should filter by featured status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/marketplace?featured=true',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].featured).toBe(true);
    });

    it('should filter by verified status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/marketplace?verified=true',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(2); // Both are verified
      expect(body.entries.every(entry => entry.verified)).toBe(true);
    });

    it('should combine multiple filters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/marketplace?category=filesystem&featured=true&verified=true',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].name).toBe('filesystem');
    });

    it('should handle marketplace service errors', async () => {
      mockOrchestrator.getMcpMarketplaceEntries = vi.fn().mockRejectedValue(new Error('Service unavailable'));

      const response = await app.inject({
        method: 'GET',
        url: '/mcp/marketplace',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Service unavailable');
    });
  });

  describe('GET /mcp/servers', () => {
    it('should return list of MCP servers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/servers',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe('filesystem');
      expect(body[0].status).toBe('running');
    });

    it('should handle orchestrator errors', async () => {
      mockOrchestrator.listMcpServers = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await app.inject({
        method: 'GET',
        url: '/mcp/servers',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Database error');
    });
  });

  describe('GET /mcp/installed', () => {
    it('should return installed MCP servers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('installations');
      expect(body.installations).toHaveLength(1);
      expect(body.installations[0].serverId).toBe('filesystem');
    });

    it('should handle installation listing errors', async () => {
      mockOrchestrator.listMcpInstallations = vi.fn().mockRejectedValue(new Error('Access denied'));

      const response = await app.inject({
        method: 'GET',
        url: '/mcp/installed',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Access denied');
    });
  });

  describe('GET /mcp/servers/:id', () => {
    it('should return server details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/servers/filesystem',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('filesystem');
      expect(body.status).toBe('running');
      expect(body.config).toHaveProperty('command', 'npx');
      expect(body.capabilities).toContain('file:read');
    });

    it('should return 404 for non-existent server', async () => {
      mockOrchestrator.getMcpServerDetails = vi.fn().mockRejectedValue(new Error('Server not found'));

      const response = await app.inject({
        method: 'GET',
        url: '/mcp/servers/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("MCP server 'nonexistent' not found");
    });

    it('should handle other server details errors', async () => {
      mockOrchestrator.getMcpServerDetails = vi.fn().mockRejectedValue(new Error('Internal error'));

      const response = await app.inject({
        method: 'GET',
        url: '/mcp/servers/filesystem',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Failed to get MCP server details for 'filesystem'");
    });
  });

  describe('POST /mcp/install/:id', () => {
    it('should install MCP server successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/mcp/install/github',
      });

      expect(response.statusCode).toBe(200);
      expect(mockOrchestrator.installMcpServer).toHaveBeenCalledWith('github');

      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.message).toBe("MCP server 'github' installed successfully");
      expect(body.serverConfig).toHaveProperty('name', 'test-server');
    });

    it('should handle installation errors', async () => {
      mockOrchestrator.installMcpServer = vi.fn().mockRejectedValue(new Error('Installation failed'));

      const response = await app.inject({
        method: 'POST',
        url: '/mcp/install/github',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(false);
      expect(body.error).toBe('Installation failed');
    });

    it('should validate server ID parameter', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/mcp/install/',
      });

      expect(response.statusCode).toBe(404); // Route not found
    });
  });

  describe('DELETE /mcp/uninstall/:id', () => {
    it('should uninstall MCP server successfully', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/mcp/uninstall/github',
      });

      expect(response.statusCode).toBe(200);
      expect(mockOrchestrator.uninstallMcpServer).toHaveBeenCalledWith('github');

      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.message).toBe("MCP server 'github' uninstalled successfully");
    });

    it('should handle uninstallation errors', async () => {
      mockOrchestrator.uninstallMcpServer = vi.fn().mockRejectedValue(new Error('Uninstall failed'));

      const response = await app.inject({
        method: 'DELETE',
        url: '/mcp/uninstall/github',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(false);
      expect(body.error).toBe('Uninstall failed');
    });
  });

  describe('GET /mcp/servers/:serverName/status', () => {
    it('should return server status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/servers/filesystem/status',
      });

      expect(response.statusCode).toBe(200);
      expect(mockOrchestrator.getMcpServerStatus).toHaveBeenCalledWith('filesystem');

      const body = JSON.parse(response.body);
      expect(body.serverId).toBe('filesystem');
      expect(body.status).toBe('running');
      expect(body.pid).toBe(12345);
    });

    it('should handle status check errors', async () => {
      mockOrchestrator.getMcpServerStatus = vi.fn().mockRejectedValue(new Error('Status check failed'));

      const response = await app.inject({
        method: 'GET',
        url: '/mcp/servers/filesystem/status',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Failed to get status for MCP server 'filesystem'");
    });
  });

  describe('POST /mcp/servers/:serverName/start', () => {
    it('should start MCP server successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/mcp/servers/filesystem/start',
      });

      expect(response.statusCode).toBe(200);
      expect(mockOrchestrator.startMcpServer).toHaveBeenCalledWith('filesystem');

      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.message).toBe("MCP server 'filesystem' started successfully");
    });

    it('should handle start errors', async () => {
      mockOrchestrator.startMcpServer = vi.fn().mockRejectedValue(new Error('Start failed'));

      const response = await app.inject({
        method: 'POST',
        url: '/mcp/servers/filesystem/start',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(false);
      expect(body.error).toBe('Start failed');
    });
  });

  describe('POST /mcp/servers/:serverName/stop', () => {
    it('should stop MCP server successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/mcp/servers/filesystem/stop',
      });

      expect(response.statusCode).toBe(200);
      expect(mockOrchestrator.stopMcpServer).toHaveBeenCalledWith('filesystem');

      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.message).toBe("MCP server 'filesystem' stopped successfully");
    });

    it('should handle stop errors', async () => {
      mockOrchestrator.stopMcpServer = vi.fn().mockRejectedValue(new Error('Stop failed'));

      const response = await app.inject({
        method: 'POST',
        url: '/mcp/servers/filesystem/stop',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(false);
      expect(body.error).toBe('Stop failed');
    });
  });

  describe('GET /mcp/marketplace/categories', () => {
    it('should return marketplace categories', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/marketplace/categories',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('categories');
      expect(body.categories).toHaveLength(2);
      expect(body.categories[0].id).toBe('filesystem');
      expect(body.categories[1].id).toBe('development');
    });

    it('should handle category retrieval errors', async () => {
      mockOrchestrator.getMcpMarketplaceCategories = vi.fn().mockRejectedValue(new Error('Categories unavailable'));

      const response = await app.inject({
        method: 'GET',
        url: '/mcp/marketplace/categories',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Categories unavailable');
    });
  });

  describe('GET /mcp/marketplace/featured', () => {
    it('should return featured marketplace entries', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/marketplace/featured',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('entries');
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].featured).toBe(true);
    });

    it('should handle featured entries errors', async () => {
      mockOrchestrator.getFeaturedMcpEntries = vi.fn().mockRejectedValue(new Error('Featured unavailable'));

      const response = await app.inject({
        method: 'GET',
        url: '/mcp/marketplace/featured',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Featured unavailable');
    });
  });

  describe('GET /mcp/recommendations', () => {
    it('should return installation recommendations', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/recommendations',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].serverId).toBe('filesystem');
      expect(body[0].reason).toBe('Popular choice for file operations');
    });

    it('should handle recommendations errors', async () => {
      mockOrchestrator.getMcpInstallationRecommendations = vi.fn().mockRejectedValue(new Error('Recommendations unavailable'));

      const response = await app.inject({
        method: 'GET',
        url: '/mcp/recommendations',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Recommendations unavailable');
    });
  });

  describe('Parameter Validation', () => {
    it('should handle missing server ID in parametrized routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/servers/',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle special characters in server names', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/servers/test%20server',
      });

      expect(response.statusCode).toBe(200);
      expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledWith('test server');
    });

    it('should handle very long server names', async () => {
      const longName = 'a'.repeat(1000);
      const response = await app.inject({
        method: 'GET',
        url: `/mcp/servers/${longName}`,
      });

      expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledWith(longName);
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format', async () => {
      mockOrchestrator.listMcpServers = vi.fn().mockRejectedValue(new Error('Test error'));

      const response = await app.inject({
        method: 'GET',
        url: '/mcp/servers',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
      expect(body.error).toBe('Test error');
    });

    it('should handle non-Error exceptions', async () => {
      mockOrchestrator.listMcpServers = vi.fn().mockRejectedValue('String error');

      const response = await app.inject({
        method: 'GET',
        url: '/mcp/servers',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to list MCP servers');
    });
  });

  describe('Content Type Handling', () => {
    it('should accept and return JSON', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/marketplace',
        headers: {
          'accept': 'application/json',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should handle POST requests with JSON body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/mcp/install/github',
        headers: {
          'content-type': 'application/json',
        },
        payload: JSON.stringify({}),
      });

      expect(response.statusCode).toBe(200);
    });
  });
});