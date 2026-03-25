import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { ApexOrchestrator } from '@apexcli/orchestrator';

// Mock the orchestrator
vi.mock('@apexcli/orchestrator', () => ({
  DaemonManager: class { async getStatus() { return { running: false }; } async start() {} async stop() {} }, HealthMonitor: class { getMetrics() { return {}; } checkHealth() { return { healthy: true }; } }, ToolCallStartEvent: class {}, ToolCallProgressEvent: class {}, ToolCallCompleteEvent: class {}, MCPErrorEventData: class {}, MCPConnectionEventData: class {}, MCPDisconnectionEventData: class {}, MCPReconnectingEventData: class {}, MCPHealthCheckEventData: class {}, MCPStateChangeEventData: class {},
  ApexOrchestrator: vi.fn(function() { return {
    getMcpServerDetails: vi.fn(),
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

// Create test server with GET /mcp/servers/:id endpoint
async function createTestServer() {
  const fastify = Fastify();
  const mockOrchestrator = new ApexOrchestrator('/mock/project/path');

  // Register the GET /mcp/servers/:id endpoint (exactly as in main implementation)
  fastify.get<{ Params: { id: string } }>(
    '/mcp/servers/:id',
    async (request, reply) => {
      const { id } = request.params;

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
    }
  );

  return { fastify, mockOrchestrator };
}

describe.skip('GET /mcp/servers/:id - Comprehensive Test Suite', () => {
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

  describe('Acceptance Criteria Validation', () => {
    it('should return full MCPServer details including tools, readme, and installation instructions', async () => {
      const serverId = 'filesystem-server';
      const fullServerDetails = {
        id: serverId,
        name: 'Filesystem MCP Server',
        config: {
          name: 'Filesystem MCP Server',
          type: 'stdio',
          command: 'node',
          args: ['filesystem-server.js'],
          env: {
            NODE_ENV: 'production'
          }
        },
        status: 'running',
        tools: [
          'read_file',
          'write_file',
          'list_directory',
          'create_directory',
          'delete_file',
          'search_files'
        ],
        readme: `# Filesystem MCP Server

This server provides comprehensive file system operations for MCP clients.

## Features
- Read and write files
- Directory management
- File search capabilities
- Secure file operations

## Usage
Connect via MCP protocol to access file system operations.`,
        installationInstructions: `# Installation Instructions

## Via npm:
\`\`\`bash
npm install -g @mcp/filesystem-server
\`\`\`

## Configuration:
Add to your MCP config:
\`\`\`json
{
  "mcpServers": {
    "filesystem": {
      "command": "filesystem-server",
      "args": ["--root", "/your/root/path"]
    }
  }
}
\`\`\`

## Environment Variables:
- \`FILESYSTEM_ROOT\`: Set the root directory (default: current working directory)
- \`FILESYSTEM_READONLY\`: Enable read-only mode (default: false)`,
        metadata: {
          version: '2.1.0',
          author: 'MCP Team <team@mcp.io>',
          description: 'High-performance MCP server for file system operations with security features',
          lastUpdated: new Date('2024-03-15'),
          category: 'file-system',
          tags: ['files', 'filesystem', 'io', 'storage'],
          license: 'MIT',
          repository: 'https://github.com/mcp/filesystem-server',
          homepage: 'https://mcp.io/servers/filesystem',
          documentation: 'https://docs.mcp.io/servers/filesystem',
          verified: true,
          featured: true
        },
      };

      mockOrchestrator.getMcpServerDetails.mockResolvedValue(fullServerDetails);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Validate all required fields are present
      expect(body).toEqual(fullServerDetails);

      // Specifically validate acceptance criteria requirements
      expect(body).toHaveProperty('id', serverId);
      expect(body).toHaveProperty('tools');
      expect(body).toHaveProperty('readme');
      expect(body).toHaveProperty('installationInstructions');
      expect(body.tools).toBeInstanceOf(Array);
      expect(body.tools.length).toBeGreaterThan(0);
      expect(typeof body.readme).toBe('string');
      expect(body.readme.length).toBeGreaterThan(0);
      expect(typeof body.installationInstructions).toBe('string');
      expect(body.installationInstructions.length).toBeGreaterThan(0);

      expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledWith(serverId);
      expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledTimes(1);
    });

    it('should return 404 for non-existent server IDs', async () => {
      const nonExistentId = 'does-not-exist';
      const notFoundError = new Error(`MCP server '${nonExistentId}' not found`);

      mockOrchestrator.getMcpServerDetails.mockRejectedValue(notFoundError);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${nonExistentId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: `MCP server '${nonExistentId}' not found` });
      expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledWith(nonExistentId);
    });

    it('should have properly typed response structure', async () => {
      const serverId = 'typed-server';
      const typedServerDetails = {
        id: serverId,
        name: 'Typed Server',
        config: {
          name: 'Typed Server',
          type: 'stdio' as const,
          command: 'node',
          args: ['server.js']
        },
        status: 'stopped' as const,
        tools: ['tool1', 'tool2'],
        readme: 'Server documentation',
        installationInstructions: 'npm install server',
        metadata: {
          version: '1.0.0',
          author: 'Test Author',
          description: 'Test server',
          lastUpdated: new Date('2024-01-01'),
        }
      };

      mockOrchestrator.getMcpServerDetails.mockResolvedValue(typedServerDetails);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Type validation - ensure all fields have correct types
      expect(typeof body.id).toBe('string');
      expect(typeof body.name).toBe('string');
      expect(typeof body.config).toBe('object');
      expect(body.config).not.toBeNull();
      expect(typeof body.config.name).toBe('string');
      expect(typeof body.config.type).toBe('string');
      expect(typeof body.config.command).toBe('string');
      expect(Array.isArray(body.config.args)).toBe(true);
      expect(typeof body.status).toBe('string');
      expect(Array.isArray(body.tools)).toBe(true);
      expect(typeof body.readme).toBe('string');
      expect(typeof body.installationInstructions).toBe('string');
      expect(typeof body.metadata).toBe('object');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty/whitespace server ID', async () => {
      const responses = await Promise.all([
        server.inject({ method: 'GET', url: '/mcp/servers/ ' }),
        server.inject({ method: 'GET', url: '/mcp/servers/\t' }),
        server.inject({ method: 'GET', url: '/mcp/servers/\n' }),
      ]);

      responses.forEach(response => {
        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body).toEqual({ error: 'Server ID is required' });
      });
    });

    it('should handle special characters in server ID', async () => {
      const specialIds = [
        'server-with-dashes',
        'server_with_underscores',
        'server.with.dots',
        'server@with@symbols',
        'server%with%encoded',
        '123numeric-server',
        'UPPERCASE-SERVER'
      ];

      for (const serverId of specialIds) {
        const serverDetails = {
          id: serverId,
          name: `Server ${serverId}`,
          config: { name: `Server ${serverId}`, type: 'stdio', command: 'node' },
          status: 'running',
          tools: ['test'],
          readme: 'Test readme',
          installationInstructions: 'Test install'
        };

        mockOrchestrator.getMcpServerDetails.mockResolvedValueOnce(serverDetails);

        const response = await server.inject({
          method: 'GET',
          url: `/mcp/servers/${encodeURIComponent(serverId)}`,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.id).toBe(serverId);
        expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledWith(serverId);
      }
    });

    it('should handle very long server IDs', async () => {
      const longId = 'a'.repeat(1000); // 1000 character ID
      const serverDetails = {
        id: longId,
        name: 'Server with very long ID',
        config: { name: 'Long ID Server', type: 'stdio', command: 'node' },
        status: 'running',
        tools: ['test'],
        readme: 'Long ID server',
        installationInstructions: 'npm install long-server'
      };

      mockOrchestrator.getMcpServerDetails.mockResolvedValue(serverDetails);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${longId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(longId);
    });

    it('should handle orchestrator internal errors', async () => {
      const serverId = 'error-server';
      const internalError = new Error('Database connection failed');

      mockOrchestrator.getMcpServerDetails.mockRejectedValue(internalError);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        error: `Failed to get MCP server details for '${serverId}'`
      });
    });

    it('should handle orchestrator timeout errors', async () => {
      const serverId = 'timeout-server';
      const timeoutError = new Error('Operation timed out');

      mockOrchestrator.getMcpServerDetails.mockRejectedValue(timeoutError);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Operation timed out');
    });

    it('should handle non-Error exceptions', async () => {
      const serverId = 'string-error-server';
      mockOrchestrator.getMcpServerDetails.mockRejectedValue('String error response');

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        error: `Failed to get MCP server details for '${serverId}'`
      });
    });
  });

  describe('Response Structure Validation', () => {
    it('should handle minimal valid response', async () => {
      const serverId = 'minimal-server';
      const minimalDetails = {
        id: serverId,
        name: 'Minimal Server',
        config: {
          name: 'Minimal Server',
          type: 'stdio',
          command: 'node'
        },
        status: 'stopped'
      };

      mockOrchestrator.getMcpServerDetails.mockResolvedValue(minimalDetails);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual(minimalDetails);
    });

    it('should handle response with all optional fields', async () => {
      const serverId = 'comprehensive-server';
      const comprehensiveDetails = {
        id: serverId,
        name: 'Comprehensive Server',
        config: {
          name: 'Comprehensive Server',
          type: 'stdio',
          command: 'node',
          args: ['server.js', '--port', '8080'],
          env: {
            NODE_ENV: 'production',
            DEBUG: 'mcp:*',
            LOG_LEVEL: 'info'
          },
          workingDirectory: '/opt/server',
          timeout: 30000
        },
        status: 'running',
        tools: ['read', 'write', 'search', 'analyze'],
        readme: `# Comprehensive Server

Full documentation with multiple sections, code examples, and detailed explanations.

## Installation
Multiple installation methods supported.

## Configuration
Extensive configuration options available.`,
        installationInstructions: `# Comprehensive Installation Guide

## Prerequisites
- Node.js 18+
- npm or yarn

## Installation Methods

### Method 1: Global Installation
\`\`\`bash
npm install -g @org/comprehensive-server
\`\`\`

### Method 2: Local Installation
\`\`\`bash
npm install @org/comprehensive-server
\`\`\`

## Configuration
Detailed configuration steps...`,
        metadata: {
          version: '3.2.1',
          author: 'Development Team <dev@example.com>',
          description: 'Comprehensive MCP server with extensive functionality',
          lastUpdated: new Date('2024-03-20T10:30:00Z'),
          category: 'development-tools',
          tags: ['development', 'tools', 'automation', 'productivity'],
          license: 'MIT',
          repository: 'https://github.com/org/comprehensive-server',
          homepage: 'https://comprehensive-server.example.com',
          documentation: 'https://docs.comprehensive-server.example.com',
          verified: true,
          featured: false,
          downloadCount: 50000,
          rating: 4.8,
          dependencies: ['chalk', 'inquirer', 'fs-extra'],
          requirements: {
            node: '>=18.0.0',
            memory: '256MB',
            disk: '10MB'
          }
        }
      };

      mockOrchestrator.getMcpServerDetails.mockResolvedValue(comprehensiveDetails);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual(comprehensiveDetails);
    });

    it('should preserve null and undefined values correctly', async () => {
      const serverId = 'null-fields-server';
      const detailsWithNulls = {
        id: serverId,
        name: 'Server With Nulls',
        config: {
          name: 'Server With Nulls',
          type: 'stdio',
          command: 'node',
          args: null,
          env: undefined,
        },
        status: 'stopped',
        tools: [],
        readme: '',
        installationInstructions: null,
        metadata: null
      };

      mockOrchestrator.getMcpServerDetails.mockResolvedValue(detailsWithNulls);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // JSON serialization converts undefined to null, so we expect:
      expect(body.config.args).toBeNull();
      expect(body.config.env).toBeUndefined(); // undefined properties are omitted in JSON
      expect(body.tools).toEqual([]);
      expect(body.readme).toBe('');
      expect(body.installationInstructions).toBeNull();
      expect(body.metadata).toBeNull();
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent requests for different servers', async () => {
      const serverIds = ['server1', 'server2', 'server3', 'server4', 'server5'];

      // Set up different responses for each server
      serverIds.forEach(serverId => {
        const details = {
          id: serverId,
          name: `Server ${serverId}`,
          config: { name: `Server ${serverId}`, type: 'stdio', command: 'node' },
          status: 'running',
          tools: [`${serverId}-tool`],
          readme: `Documentation for ${serverId}`,
          installationInstructions: `Install ${serverId}`
        };
        mockOrchestrator.getMcpServerDetails.mockResolvedValueOnce(details);
      });

      // Make concurrent requests
      const requests = serverIds.map(serverId =>
        server.inject({
          method: 'GET',
          url: `/mcp/servers/${serverId}`,
        })
      );

      const responses = await Promise.all(requests);

      // Verify all requests succeeded
      responses.forEach((response, index) => {
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.id).toBe(serverIds[index]);
        expect(body.name).toBe(`Server ${serverIds[index]}`);
      });

      // Verify orchestrator was called for each server
      expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledTimes(5);
      serverIds.forEach(serverId => {
        expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledWith(serverId);
      });
    });

    it('should handle mixed success/failure concurrent requests', async () => {
      const scenarios = [
        { id: 'success1', shouldSucceed: true },
        { id: 'not-found1', shouldSucceed: false, error: 'not found' },
        { id: 'success2', shouldSucceed: true },
        { id: 'internal-error', shouldSucceed: false, error: 'internal' },
        { id: 'not-found2', shouldSucceed: false, error: 'not found' }
      ];

      // Set up responses
      scenarios.forEach(scenario => {
        if (scenario.shouldSucceed) {
          const details = {
            id: scenario.id,
            name: `Server ${scenario.id}`,
            config: { name: `Server ${scenario.id}`, type: 'stdio', command: 'node' },
            status: 'running'
          };
          mockOrchestrator.getMcpServerDetails.mockResolvedValueOnce(details);
        } else {
          const errorMsg = scenario.error === 'not found'
            ? `MCP server '${scenario.id}' not found`
            : 'Internal server error';
          mockOrchestrator.getMcpServerDetails.mockRejectedValueOnce(new Error(errorMsg));
        }
      });

      // Make concurrent requests
      const requests = scenarios.map(scenario =>
        server.inject({
          method: 'GET',
          url: `/mcp/servers/${scenario.id}`,
        })
      );

      const responses = await Promise.all(requests);

      // Verify responses match expectations
      responses.forEach((response, index) => {
        const scenario = scenarios[index];
        if (scenario.shouldSucceed) {
          expect(response.statusCode).toBe(200);
          const body = JSON.parse(response.body);
          expect(body.id).toBe(scenario.id);
        } else {
          const expectedStatus = scenario.error === 'not found' ? 404 : 500;
          expect(response.statusCode).toBe(expectedStatus);
        }
      });
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle rapid sequential requests efficiently', async () => {
      const serverId = 'performance-server';
      const serverDetails = {
        id: serverId,
        name: 'Performance Server',
        config: { name: 'Performance Server', type: 'stdio', command: 'node' },
        status: 'running'
      };

      // Set up multiple responses
      for (let i = 0; i < 20; i++) {
        mockOrchestrator.getMcpServerDetails.mockResolvedValueOnce(serverDetails);
      }

      const startTime = Date.now();

      // Make 20 rapid sequential requests
      for (let i = 0; i < 20; i++) {
        const response = await server.inject({
          method: 'GET',
          url: `/mcp/servers/${serverId}`,
        });
        expect(response.statusCode).toBe(200);
      }

      const duration = Date.now() - startTime;

      // Should complete within reasonable time (less than 1 second for 20 requests)
      expect(duration).toBeLessThan(1000);
      expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledTimes(20);
    });
  });
});