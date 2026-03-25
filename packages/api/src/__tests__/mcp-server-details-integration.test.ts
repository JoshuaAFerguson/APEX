import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from '../index.js';
import { FastifyInstance } from 'fastify';
import { ApexOrchestrator } from '@apexcli/orchestrator';

// Mock the orchestrator
vi.mock('@apexcli/orchestrator', () => ({
  ApexOrchestrator: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getMcpServerDetails: vi.fn(),
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

describe.skip('MCP Server Details Integration Tests', () => {
  let server: FastifyInstance;
  let mockOrchestrator: any;

  beforeEach(async () => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Disable health monitoring for tests
    process.env.DISABLE_HEALTH_MONITORING = '1';

    // Create the server using the actual implementation
    server = await createServer({
      projectPath: '/mock/project/path',
      port: 3001, // Different port for tests
      silent: true, // Suppress logs during testing
    });

    // Get the mocked orchestrator instance
    const orchestratorInstances = (ApexOrchestrator as any).mock.instances;
    mockOrchestrator = orchestratorInstances[orchestratorInstances.length - 1];
  });

  afterEach(async () => {
    await server.close();
    delete process.env.DISABLE_HEALTH_MONITORING;
  });

  describe('Integration with Real Server', () => {
    it('should integrate correctly with actual Fastify server instance', async () => {
      const serverId = 'integration-test-server';
      const serverDetails = {
        id: serverId,
        name: 'Integration Test Server',
        config: {
          name: 'Integration Test Server',
          type: 'stdio' as const,
          command: 'node',
          args: ['test-server.js'],
          env: {
            NODE_ENV: 'test'
          }
        },
        status: 'running' as const,
        tools: ['test_tool_1', 'test_tool_2', 'integration_test_tool'],
        readme: `# Integration Test Server

This server is used for integration testing the GET /mcp/servers/:id endpoint.

## Features
- Comprehensive testing capabilities
- Full MCP protocol support
- Real-time testing feedback

## Testing
This server provides tools for validating MCP functionality.`,
        installationInstructions: `# Installation for Integration Testing

## Test Environment Setup:
\`\`\`bash
npm install --save-dev integration-test-server
\`\`\`

## Test Configuration:
\`\`\`json
{
  "mcpServers": {
    "test": {
      "command": "node",
      "args": ["test-server.js"],
      "env": {
        "NODE_ENV": "test"
      }
    }
  }
}
\`\`\``,
        metadata: {
          version: '1.0.0-test',
          author: 'APEX Testing Team',
          description: 'Integration testing server for MCP functionality validation',
          lastUpdated: new Date('2024-01-15'),
          category: 'testing',
          tags: ['testing', 'integration', 'mcp'],
          verified: true,
          featured: false
        }
      };

      // Setup mock response
      mockOrchestrator.getMcpServerDetails.mockResolvedValue(serverDetails);

      // Make the actual HTTP request to the real server
      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      // Validate response
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(serverDetails);

      // Verify orchestrator was called correctly
      expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledWith(serverId);
      expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledTimes(1);
    });

    it('should handle route registration and path parameter extraction', async () => {
      const testCases = [
        { id: 'simple-server', expected: 'simple-server' },
        { id: 'server-with-dashes', expected: 'server-with-dashes' },
        { id: 'server_with_underscores', expected: 'server_with_underscores' },
        { id: 'server.with.dots', expected: 'server.with.dots' },
        { id: '123-numeric', expected: '123-numeric' },
        { id: 'UPPERCASE-SERVER', expected: 'UPPERCASE-SERVER' },
      ];

      for (const testCase of testCases) {
        // Setup mock for each test case
        const serverDetails = {
          id: testCase.expected,
          name: `Test Server ${testCase.id}`,
          config: {
            name: `Test Server ${testCase.id}`,
            type: 'stdio' as const,
            command: 'node'
          },
          status: 'stopped' as const
        };

        mockOrchestrator.getMcpServerDetails.mockResolvedValueOnce(serverDetails);

        const response = await server.inject({
          method: 'GET',
          url: `/mcp/servers/${encodeURIComponent(testCase.id)}`,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.id).toBe(testCase.expected);
        expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledWith(testCase.expected);
      }
    });

    it('should properly handle error responses through the full stack', async () => {
      const errorScenarios = [
        {
          name: 'server not found',
          serverId: 'missing-server',
          mockError: new Error("MCP server 'missing-server' not found"),
          expectedStatus: 404,
          expectedMessage: "MCP server 'missing-server' not found"
        },
        {
          name: 'orchestrator connection error',
          serverId: 'connection-error',
          mockError: new Error('Failed to connect to MCP registry'),
          expectedStatus: 500,
          expectedMessage: "Failed to get MCP server details for 'connection-error'"
        },
        {
          name: 'timeout error',
          serverId: 'timeout-server',
          mockError: new Error('Request timeout'),
          expectedStatus: 500,
          expectedMessage: "Failed to get MCP server details for 'timeout-server'"
        },
        {
          name: 'non-Error exception',
          serverId: 'string-error',
          mockError: 'Raw string error',
          expectedStatus: 500,
          expectedMessage: "Failed to get MCP server details for 'string-error'"
        }
      ];

      for (const scenario of errorScenarios) {
        // Setup mock error
        mockOrchestrator.getMcpServerDetails.mockRejectedValueOnce(scenario.mockError);

        const response = await server.inject({
          method: 'GET',
          url: `/mcp/servers/${scenario.serverId}`,
        });

        expect(response.statusCode).toBe(scenario.expectedStatus);
        expect(response.headers['content-type']).toContain('application/json');

        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('error');
        expect(body.error).toContain(scenario.expectedMessage);
      }
    });

    it('should handle input validation at the route level', async () => {
      const invalidInputs = [
        { url: '/mcp/servers/ ', description: 'space only' },
        { url: '/mcp/servers/\t', description: 'tab character' },
        { url: '/mcp/servers/\n', description: 'newline character' },
        { url: '/mcp/servers/   \t  ', description: 'mixed whitespace' }
      ];

      for (const input of invalidInputs) {
        const response = await server.inject({
          method: 'GET',
          url: input.url,
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body).toEqual({ error: 'Server ID is required' });

        // Verify orchestrator is not called for invalid input
        expect(mockOrchestrator.getMcpServerDetails).not.toHaveBeenCalled();
        vi.clearAllMocks();
      }
    });

    it('should preserve response structure and content-type headers', async () => {
      const serverId = 'header-test-server';
      const serverDetails = {
        id: serverId,
        name: 'Header Test Server',
        config: { name: 'Header Test', type: 'stdio', command: 'node' },
        status: 'running',
        tools: ['header_test'],
        readme: 'Header test documentation',
        installationInstructions: 'npm install header-test'
      };

      mockOrchestrator.getMcpServerDetails.mockResolvedValue(serverDetails);

      const response = await server.inject({
        method: 'GET',
        url: `/mcp/servers/${serverId}`,
      });

      // Verify response structure
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      // Verify JSON is properly formatted and parseable
      expect(() => JSON.parse(response.body)).not.toThrow();

      const body = JSON.parse(response.body);
      expect(body).toEqual(serverDetails);

      // Verify all required properties are present and properly typed
      expect(typeof body.id).toBe('string');
      expect(typeof body.name).toBe('string');
      expect(typeof body.config).toBe('object');
      expect(typeof body.status).toBe('string');
      expect(Array.isArray(body.tools)).toBe(true);
      expect(typeof body.readme).toBe('string');
      expect(typeof body.installationInstructions).toBe('string');
    });

    it('should handle concurrent requests without interference', async () => {
      const concurrentRequests = 10;
      const serverIds = Array.from({ length: concurrentRequests }, (_, i) => `concurrent-server-${i}`);

      // Setup mock responses for all concurrent requests
      serverIds.forEach(serverId => {
        const details = {
          id: serverId,
          name: `Concurrent Test Server ${serverId}`,
          config: { name: `Server ${serverId}`, type: 'stdio', command: 'node' },
          status: 'running'
        };
        mockOrchestrator.getMcpServerDetails.mockResolvedValueOnce(details);
      });

      // Make concurrent requests
      const requestPromises = serverIds.map(serverId =>
        server.inject({
          method: 'GET',
          url: `/mcp/servers/${serverId}`,
        })
      );

      const responses = await Promise.all(requestPromises);

      // Verify all requests succeeded and returned correct data
      responses.forEach((response, index) => {
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.id).toBe(serverIds[index]);
        expect(body.name).toBe(`Concurrent Test Server ${serverIds[index]}`);
      });

      // Verify orchestrator was called for each request
      expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledTimes(concurrentRequests);
      serverIds.forEach(serverId => {
        expect(mockOrchestrator.getMcpServerDetails).toHaveBeenCalledWith(serverId);
      });
    });
  });
});