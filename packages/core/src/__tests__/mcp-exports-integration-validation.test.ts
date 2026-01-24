import { describe, it, expect } from 'vitest';

/**
 * Integration test to verify all MCP-related exports work correctly when imported
 * by external packages. This test simulates how other packages in the monorepo
 * and external consumers would import and use these types.
 *
 * Tests the acceptance criteria:
 * "A test file can import every MCP-related schema and type without errors"
 */

describe('MCP Exports Integration Validation', () => {
  describe('External Package Import Simulation', () => {
    it('can import and instantiate all MCP schemas from main index', async () => {
      // Dynamically import from the main package entry point
      const coreExports = await import('../index.js');

      // Verify main MCP schemas are exported and functional
      expect(coreExports.MCPServerConfigSchema).toBeDefined();
      expect(typeof coreExports.MCPServerConfigSchema.parse).toBe('function');

      expect(coreExports.MCPConnectionConfigSchema).toBeDefined();
      expect(typeof coreExports.MCPConnectionConfigSchema.parse).toBe('function');

      expect(coreExports.MCPToolSchema).toBeDefined();
      expect(typeof coreExports.MCPToolSchema.parse).toBe('function');

      expect(coreExports.JsonRpcRequestSchema).toBeDefined();
      expect(typeof coreExports.JsonRpcRequestSchema.parse).toBe('function');

      expect(coreExports.MockMCPServerConfigSchema).toBeDefined();
      expect(typeof coreExports.MockMCPServerConfigSchema.parse).toBe('function');
    });

    it('can import and instantiate all MCP schemas from mcp subpath', async () => {
      // Dynamically import from the mcp subpath entry point
      const mcpExports = await import('../mcp/index.js');

      // Verify MCP-specific exports work
      expect(mcpExports.MCPServerConfigSchema).toBeDefined();
      expect(typeof mcpExports.MCPServerConfigSchema.parse).toBe('function');

      expect(mcpExports.JsonRpcRequestSchema).toBeDefined();
      expect(typeof mcpExports.JsonRpcRequestSchema.parse).toBe('function');

      expect(mcpExports.MockMCPServerConfigSchema).toBeDefined();
      expect(typeof mcpExports.MockMCPServerConfigSchema.parse).toBe('function');
    });

    it('validates that schema parsing works correctly in integration context', async () => {
      const { MCPServerConfigSchema, JsonRpcRequestSchema, MockMCPServerConfigSchema } = await import('../index.js');

      // Test MCP Server Config parsing
      const validServerConfig = {
        command: 'node',
        args: ['server.js'],
        env: { NODE_ENV: 'production' }
      };

      const parsedServerConfig = MCPServerConfigSchema.parse(validServerConfig);
      expect(parsedServerConfig).toEqual(validServerConfig);

      // Test JSON-RPC Request parsing
      const validRequest = {
        jsonrpc: '2.0' as const,
        id: 'test-request-123',
        method: 'tools/list',
        params: {}
      };

      const parsedRequest = JsonRpcRequestSchema.parse(validRequest);
      expect(parsedRequest).toEqual(validRequest);

      // Test Mock Server Config parsing
      const validMockConfig = {
        name: 'test-mock-server',
        transport: 'stdio' as const,
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true }
        },
        serverInfo: {
          name: 'Mock Server',
          version: '1.0.0'
        }
      };

      const parsedMockConfig = MockMCPServerConfigSchema.parse(validMockConfig);
      expect(parsedMockConfig).toEqual(validMockConfig);
    });

    it('ensures error handling works in integration context', async () => {
      const { MCPServerConfigSchema, JsonRpcRequestSchema } = await import('../index.js');

      // Test invalid MCP Server Config
      expect(() => {
        MCPServerConfigSchema.parse({
          // Missing required 'command' field
          args: ['--invalid']
        });
      }).toThrow();

      // Test invalid JSON-RPC Request
      expect(() => {
        JsonRpcRequestSchema.parse({
          jsonrpc: '1.0', // Wrong version
          id: 'test',
          method: 'test'
        });
      }).toThrow();
    });
  });

  describe('Type Inference Validation', () => {
    it('validates that TypeScript type inference works correctly for all MCP types', async () => {
      const exports = await import('../index.js');

      // Test that type inference works for all major MCP types
      const serverConfig: typeof exports.MCPServerConfig = {
        command: 'node',
        args: ['server.js']
      };

      const connectionConfig: typeof exports.MCPConnectionConfig = {
        transport: 'stdio',
        command: 'node',
        args: ['client.js']
      };

      const toolInvocation: typeof exports.MCPToolInvocationRequest = {
        name: 'test-tool',
        arguments: { param: 'value' }
      };

      const protocolRequest: typeof exports.JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'test',
        method: 'initialize'
      };

      // Verify types compile and values are defined
      expect(serverConfig).toBeDefined();
      expect(connectionConfig).toBeDefined();
      expect(toolInvocation).toBeDefined();
      expect(protocolRequest).toBeDefined();
    });

    it('validates that all protocol enum types are properly exported', async () => {
      const exports = await import('../index.js');

      // Test protocol method enum
      expect(exports.MCPProtocolMethod).toBeDefined();
      expect(typeof exports.MCPProtocolMethod).toBe('object');
      expect(exports.MCPProtocolMethod.INITIALIZE).toBeDefined();

      // Test error code enum
      expect(exports.MCPErrorCode).toBeDefined();
      expect(typeof exports.MCPErrorCode).toBe('object');
      expect(exports.MCPErrorCode.PARSE_ERROR).toBeDefined();

      // Test log level enum
      expect(exports.MCPLogLevel).toBeDefined();
      expect(typeof exports.MCPLogLevel).toBe('object');
    });
  });

  describe('Cross-Package Compatibility', () => {
    it('validates compatibility with orchestrator package expectations', async () => {
      // Test that the exports match what the orchestrator package expects
      const coreExports = await import('../index.js');

      // These are the key types orchestrator would use
      const requiredForOrchestrator = [
        'MCPConfig',
        'MCPServer',
        'MCPConnection',
        'MCPTool',
        'MCPConnectionEvent',
        'JsonRpcRequest',
        'JsonRpcResponse'
      ];

      for (const exportName of requiredForOrchestrator) {
        expect(coreExports[exportName as keyof typeof coreExports]).toBeDefined();
      }
    });

    it('validates compatibility with CLI package expectations', async () => {
      // Test that the exports match what the CLI package expects
      const coreExports = await import('../index.js');

      // These are the key types CLI would use
      const requiredForCLI = [
        'MCPServerConfig',
        'MCPConnectionConfig',
        'MCPInstallationStatus',
        'MCPRegistryServer',
        'MCPMarketplace'
      ];

      for (const exportName of requiredForCLI) {
        expect(coreExports[exportName as keyof typeof coreExports]).toBeDefined();
      }
    });

    it('validates compatibility with API package expectations', async () => {
      // Test that the exports match what the API package expects
      const coreExports = await import('../index.js');

      // These are the key types API would use
      const requiredForAPI = [
        'MCPConnectionEvent',
        'MCPConnectionState',
        'MCPToolInvocationRequest',
        'MCPToolInvocationResponse',
        'JsonRpcRequest',
        'JsonRpcResponse'
      ];

      for (const exportName of requiredForAPI) {
        expect(coreExports[exportName as keyof typeof coreExports]).toBeDefined();
      }
    });
  });

  describe('Real-World Usage Scenarios', () => {
    it('validates a complete MCP server configuration workflow', async () => {
      const {
        MCPServerConfigSchema,
        MCPConnectionConfigSchema,
        MCPToolSchemaSchema,
        MCPConfig,
        MCPServerConfig,
        MCPConnectionConfig,
        MCPToolSchema
      } = await import('../index.js');

      // Simulate real-world MCP server setup
      const serverConfig: MCPServerConfig = {
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem'],
        env: {
          NODE_ENV: 'production',
          FILESYSTEM_ALLOW_ROOT: '/workspace'
        }
      };

      const connectionConfig: MCPConnectionConfig = {
        transport: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem']
      };

      const toolSchema: MCPToolSchema = {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' }
        },
        required: ['path']
      };

      const fullConfig: MCPConfig = {
        servers: {
          filesystem: serverConfig
        }
      };

      // Validate all schemas parse correctly
      expect(() => MCPServerConfigSchema.parse(serverConfig)).not.toThrow();
      expect(() => MCPConnectionConfigSchema.parse(connectionConfig)).not.toThrow();
      expect(() => MCPToolSchemaSchema.parse(toolSchema)).not.toThrow();
      expect(() => fullConfig.servers.filesystem).not.toThrow();
    });

    it('validates a complete JSON-RPC communication workflow', async () => {
      const {
        JsonRpcRequestSchema,
        JsonRpcResponseSchema,
        MCPInitializeParamsSchema,
        MCPToolsCallParamsSchema,
        JsonRpcRequest,
        JsonRpcResponse,
        MCPInitializeParams,
        MCPToolsCallParams
      } = await import('../index.js');

      // Simulate initialization request
      const initRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'init-1',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: { listChanged: true },
            sampling: {}
          },
          clientInfo: {
            name: 'APEX',
            version: '0.4.0'
          }
        } as MCPInitializeParams
      };

      // Simulate tool call request
      const toolCallRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'tool-1',
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: {
            path: '/workspace/src/index.ts'
          }
        } as MCPToolsCallParams
      };

      // Simulate success response
      const successResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 'tool-1',
        result: {
          content: [
            {
              type: 'text',
              text: 'File contents here...'
            }
          ]
        }
      };

      // Validate all messages parse correctly
      expect(() => JsonRpcRequestSchema.parse(initRequest)).not.toThrow();
      expect(() => JsonRpcRequestSchema.parse(toolCallRequest)).not.toThrow();
      expect(() => JsonRpcResponseSchema.parse(successResponse)).not.toThrow();
    });
  });
});