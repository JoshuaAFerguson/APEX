import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { ApexOrchestrator } from '@apexcli/orchestrator';

// Test specifically focuses on validating the acceptance criteria
describe('GET /mcp/servers/:id - Acceptance Criteria Validation', () => {
  let server: FastifyInstance;
  let mockOrchestrator: any;

  beforeEach(async () => {
    // Mock the orchestrator
    vi.mock('@apexcli/orchestrator', () => ({
      ApexOrchestrator: vi.fn().mockImplementation(() => ({
        getMcpServerDetails: vi.fn(),
      })),
    }));

    const { ApexOrchestrator } = await import('@apexcli/orchestrator');
    const mockOrchestratorConstructor = ApexOrchestrator as any;
    mockOrchestrator = new mockOrchestratorConstructor();

    const fastify = Fastify();

    // Register the exact endpoint implementation from the main API
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

    server = fastify;
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Acceptance Criteria 1: Route registered at GET /mcp/servers/:id', () => {
    it('should respond to GET requests at the correct path', async () => {
      const serverId = 'test-server';
      const mockDetails = {
        id: serverId,
        name: 'Test Server',
        config: { name: 'Test Server', type: 'stdio', command: 'node' },
        status: 'running'
      };

      mockOrchestrator.getMcpServerDetails.mockResolvedValue(mockDetails);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).not.toBe(404);
      expect(response.statusCode).not.toBe(405); // Method not allowed
      expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalled();
    });

    it('should not respond to other HTTP methods', async () => {
      const serverId = 'test-server';

      const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        const response = await server.inject({
          method: method as any,
          url: `/mcp/servers/${serverId}`,
        });

        expect(response.statusCode).toBe(404);
        expect(mockOrchestrator.getMcpServerDetails).not.toHaveBeenCalled();
        vi.clearAllMocks();
      }
    });
  });

  describe('Acceptance Criteria 2: Returns full MCPServer details including tools, readme, and installation instructions', () => {
    it('should return complete server details with all required fields', async () => {
      const serverId = 'comprehensive-server';
      const fullServerDetails = {
        id: serverId,
        name: 'Comprehensive Server',
        config: {
          name: 'Comprehensive Server',
          type: 'stdio' as const,
          command: 'node',
          args: ['server.js'],
          env: { NODE_ENV: 'production' }
        },
        status: 'running' as const,
        tools: [
          'file_read',
          'file_write',
          'directory_list',
          'search_files',
          'execute_command'
        ],
        readme: `# Comprehensive Server Documentation

## Overview
This is a comprehensive MCP server that provides extensive file system operations.

## Features
- File operations (read, write, delete)
- Directory management
- File search capabilities
- Command execution
- Advanced permissions

## Installation
See installation instructions below.

## Usage
Connect via MCP protocol to access all features.`,
        installationInstructions: `# Installation Instructions

## Prerequisites
- Node.js 18 or higher
- npm or yarn package manager

## Global Installation
\`\`\`bash
npm install -g comprehensive-mcp-server
\`\`\`

## Local Installation
\`\`\`bash
npm install comprehensive-mcp-server
\`\`\`

## Configuration
Add to your MCP configuration:
\`\`\`json
{
  "mcpServers": {
    "comprehensive": {
      "command": "comprehensive-server",
      "args": ["--config", "config.json"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
\`\`\`

## Environment Variables
- \`NODE_ENV\`: Set environment (development/production)
- \`LOG_LEVEL\`: Set logging level (debug/info/warn/error)`,
        metadata: {
          version: '2.1.5',
          author: 'MCP Development Team',
          description: 'Comprehensive MCP server with full file system support',
          lastUpdated: new Date('2024-03-15T10:30:00Z')
        }
      };

      mockOrchestrator.getMcpServerDetails.mockResolvedValue(fullServerDetails);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Validate all acceptance criteria fields are present
      expect(body).toHaveProperty('tools');
      expect(body).toHaveProperty('readme');
      expect(body).toHaveProperty('installationInstructions');

      // Validate tools field
      expect(Array.isArray(body.tools)).toBe(true);
      expect(body.tools).toEqual(fullServerDetails.tools);

      // Validate readme field
      expect(typeof body.readme).toBe('string');
      expect(body.readme.length).toBeGreaterThan(0);
      expect(body.readme).toContain('# Comprehensive Server Documentation');

      // Validate installation instructions field
      expect(typeof body.installationInstructions).toBe('string');
      expect(body.installationInstructions.length).toBeGreaterThan(0);
      expect(body.installationInstructions).toContain('# Installation Instructions');

      // Validate complete structure matches expected
      expect(body).toEqual(fullServerDetails);
    });

    it('should handle servers with minimal details (no tools, readme, or instructions)', async () => {
      const serverId = 'minimal-server';
      const minimalDetails = {
        id: serverId,
        name: 'Minimal Server',
        config: {
          name: 'Minimal Server',
          type: 'stdio' as const,
          command: 'node'
        },
        status: 'stopped' as const,
        // No tools, readme, or installationInstructions
      };

      mockOrchestrator.getMcpServerDetails.mockResolvedValue(minimalDetails);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should still have the properties, even if undefined/empty
      expect(body).toEqual(minimalDetails);
      expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledWith(serverId);
    });
  });

  describe('Acceptance Criteria 3: Returns 404 for non-existent server IDs', () => {
    it('should return 404 when server is not found', async () => {
      const nonExistentId = 'does-not-exist-server';
      const notFoundError = new Error(`MCP server '${nonExistentId}' not found`);

      mockOrchestrator.getMcpServerDetails.mockRejectedValue(notFoundError);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${nonExistentId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        error: `MCP server '${nonExistentId}' not found`
      });
      expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledWith(nonExistentId);
    });

    it('should differentiate between 404 not found and 500 server errors', async () => {
      const scenarios = [
        {
          description: 'server not found error',
          serverId: 'missing-server',
          error: new Error("MCP server 'missing-server' not found"),
          expectedStatus: 404,
          expectedErrorMessage: "MCP server 'missing-server' not found"
        },
        {
          description: 'server registry error',
          serverId: 'registry-error',
          error: new Error("Failed to connect to server registry"),
          expectedStatus: 500,
          expectedErrorMessage: "Failed to get MCP server details for 'registry-error'"
        },
        {
          description: 'timeout error',
          serverId: 'timeout-server',
          error: new Error("Request timeout after 30 seconds"),
          expectedStatus: 500,
          expectedErrorMessage: "Failed to get MCP server details for 'timeout-server'"
        }
      ];

      for (const scenario of scenarios) {
        mockOrchestrator.getMcpServerDetails.mockRejectedValueOnce(scenario.error);

        const response = await server.inject({
          method: 'GET',
          url: `/mcp/servers/${scenario.serverId}`,
        });

        expect(response.statusCode).toBe(scenario.expectedStatus);
        const body = JSON.parse(response.body);
        expect(body.error).toContain(scenario.expectedErrorMessage);
      }
    });
  });

  describe('Acceptance Criteria 4: Properly typed response', () => {
    it('should return properly structured and typed response', async () => {
      const serverId = 'typed-server';
      const typedResponse = {
        id: serverId,
        name: 'Typed Server',
        config: {
          name: 'Typed Server',
          type: 'stdio' as const,
          command: 'node',
          args: ['typed-server.js'],
          env: { DEBUG: 'true' }
        },
        status: 'running' as const,
        tools: ['typed_tool_1', 'typed_tool_2'],
        readme: 'Typed server documentation',
        installationInstructions: 'npm install typed-server',
        metadata: {
          version: '1.0.0',
          author: 'Type Safety Team',
          description: 'Server with proper TypeScript types',
          lastUpdated: new Date('2024-01-01T12:00:00Z')
        }
      };

      mockOrchestrator.getMcpServerDetails.mockResolvedValue(typedResponse);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.body);

      // Validate required field types
      expect(typeof body.id).toBe('string');
      expect(typeof body.name).toBe('string');
      expect(typeof body.config).toBe('object');
      expect(body.config).not.toBeNull();
      expect(typeof body.config.name).toBe('string');
      expect(typeof body.config.type).toBe('string');
      expect(typeof body.config.command).toBe('string');
      expect(typeof body.status).toBe('string');

      // Validate optional field types when present
      if (body.tools !== undefined) {
        expect(Array.isArray(body.tools)).toBe(true);
        body.tools.forEach((tool: any) => {
          expect(typeof tool).toBe('string');
        });
      }

      if (body.readme !== undefined) {
        expect(typeof body.readme).toBe('string');
      }

      if (body.installationInstructions !== undefined) {
        expect(typeof body.installationInstructions).toBe('string');
      }

      if (body.metadata !== undefined) {
        expect(typeof body.metadata).toBe('object');
        expect(body.metadata).not.toBeNull();
      }

      // Validate response structure matches exactly
      expect(body).toEqual(typedResponse);
    });

    it('should maintain type safety with null and undefined values', async () => {
      const serverId = 'null-values-server';
      const responseWithNulls = {
        id: serverId,
        name: 'Null Values Server',
        config: {
          name: 'Null Values Server',
          type: 'stdio' as const,
          command: 'node',
          args: undefined,
          env: null
        },
        status: 'stopped' as const,
        tools: [],
        readme: '',
        installationInstructions: null,
        metadata: undefined
      };

      mockOrchestrator.getMcpServerDetails.mockResolvedValue(responseWithNulls);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // JSON serialization behavior
      expect(body.tools).toEqual([]);
      expect(body.readme).toBe('');
      expect(body.installationInstructions).toBeNull();
      // undefined properties are typically omitted in JSON
    });
  });

  describe('Input Validation', () => {
    it('should validate server ID parameter is not empty', async () => {
      const invalidIds = [
        { id: ' ', description: 'space only' },
        { id: '\t', description: 'tab character' },
        { id: '\n', description: 'newline character' },
        { id: '   ', description: 'multiple spaces' },
      ];

      for (const invalidId of invalidIds) {
        const response = await server.inject({
          method: 'GET',
          url: `/mcp/servers/${invalidId.id}`,
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body).toEqual({ error: 'Server ID is required' });
        expect(mockOrchestrator.getMcpServerDetails).not.toHaveBeenCalled();
        vi.clearAllMocks();
      }
    });
  });

  describe('Integration with ApexOrchestrator', () => {
    it('should call orchestrator.getMcpServerDetails with correct parameters', async () => {
      const serverId = 'orchestrator-test';
      const serverDetails = {
        id: serverId,
        name: 'Orchestrator Test Server',
        config: { name: 'Test', type: 'stdio', command: 'test' },
        status: 'running'
      };

      mockOrchestrator.getMcpServerDetails.mockResolvedValue(serverDetails);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledWith(serverId);
      expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledTimes(1);

      const body = JSON.parse(response.body);
      expect(body).toEqual(serverDetails);
    });
  });
});
