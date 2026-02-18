import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { readFileSync } from 'fs';

/**
 * Validation test for package.json exports and import paths.
 * This ensures that all MCP-related exports are properly configured
 * in package.json and accessible through documented import paths.
 */

describe('MCP Package Exports Validation', () => {
  describe('Package.json Export Configuration', () => {
    it('validates package.json exports include MCP paths', () => {
      const packageJsonPath = resolve(__dirname, '../../package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      // Verify main exports exist
      expect(packageJson.exports).toBeDefined();
      expect(packageJson.exports['.']).toBeDefined();
      expect(packageJson.exports['./mcp']).toBeDefined();

      // Verify MCP export paths are properly configured
      const mcpExport = packageJson.exports['./mcp'];
      expect(mcpExport.types).toBe('./dist/mcp/index.d.ts');
      expect(mcpExport.import).toBe('./dist/mcp/index.js');
      expect(mcpExport.require).toBe('./dist/mcp/index.js');
      expect(mcpExport.default).toBe('./dist/mcp/index.js');
    });

    it('validates that main export path includes MCP re-exports', () => {
      const packageJsonPath = resolve(__dirname, '../../package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      const mainExport = packageJson.exports['.'];
      expect(mainExport.types).toBe('./dist/index.d.ts');
      expect(mainExport.import).toBe('./dist/index.js');
    });
  });

  describe('Import Path Validation', () => {
    it('can import MCP schemas from main package path', async () => {
      // Test importing from '@apexcli/core' (main export)
      const mainExports = await import('../index.js');

      const expectedMCPExports = [
        'MCPServerConfigSchema',
        'MCPConnectionConfigSchema',
        'MCPToolSchema',
        'JsonRpcRequestSchema',
        'MockMCPServerConfigSchema',
        'MCPProtocolMethod',
        'MCPErrorCode'
      ];

      for (const exportName of expectedMCPExports) {
        expect(mainExports[exportName as keyof typeof mainExports]).toBeDefined();
      }
    });

    it('can import MCP schemas from mcp subpath', async () => {
      // Test importing from '@apexcli/core/mcp' (mcp export)
      const mcpExports = await import('../mcp/index.js');

      const expectedMCPSubpathExports = [
        'MCPServerConfigSchema',
        'MCPConnectionConfigSchema',
        'JsonRpcRequestSchema',
        'MockMCPServerConfigSchema'
      ];

      for (const exportName of expectedMCPSubpathExports) {
        expect(mcpExports[exportName as keyof typeof mcpExports]).toBeDefined();
      }
    });

    it('validates that both import paths provide the same schemas', async () => {
      const mainExports = await import('../index.js');
      const mcpExports = await import('../mcp/index.js');

      // Test that the same schemas are available from both paths
      const commonExports = [
        'MCPServerConfigSchema',
        'JsonRpcRequestSchema',
        'MockMCPServerConfigSchema'
      ];

      for (const exportName of commonExports) {
        const mainSchema = mainExports[exportName as keyof typeof mainExports];
        const mcpSchema = mcpExports[exportName as keyof typeof mcpExports];

        expect(mainSchema).toBeDefined();
        expect(mcpSchema).toBeDefined();

        // They should be the same schema (reference equality)
        expect(mainSchema).toBe(mcpSchema);
      }
    });
  });

  describe('TypeScript Declaration Validation', () => {
    it('validates that TypeScript declarations are properly generated', async () => {
      // Import and check that types are properly inferred
      const exports = await import('../index.js');

      // These should be type constructors, not runtime values
      type MCPServerConfig = typeof exports.MCPServerConfig;
      type JsonRpcRequest = typeof exports.JsonRpcRequest;
      type MockMCPServerConfig = typeof exports.MockMCPServerConfig;

      // Create test instances to ensure types work
      const serverConfig: MCPServerConfig = {
        command: 'node',
        args: ['server.js']
      };

      const jsonRpcRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'test',
        method: 'test'
      };

      const mockConfig: MockMCPServerConfig = {
        name: 'test-mock',
        transport: 'stdio',
        protocolVersion: '2024-11-05',
        capabilities: {},
        serverInfo: { name: 'test', version: '1.0.0' }
      };

      // Verify instances can be created
      expect(serverConfig).toBeDefined();
      expect(jsonRpcRequest).toBeDefined();
      expect(mockConfig).toBeDefined();
    });

    it('validates that schema validation works with TypeScript types', async () => {
      const { MCPServerConfigSchema, JsonRpcRequestSchema } = await import('../index.js');

      // Test with properly typed objects
      const validServerConfig = {
        command: 'node' as const,
        args: ['--server'] as string[]
      };

      const validRequest = {
        jsonrpc: '2.0' as const,
        id: 'test-123',
        method: 'test-method'
      };

      // Should parse without issues
      expect(() => MCPServerConfigSchema.parse(validServerConfig)).not.toThrow();
      expect(() => JsonRpcRequestSchema.parse(validRequest)).not.toThrow();

      // Results should match input
      expect(MCPServerConfigSchema.parse(validServerConfig)).toEqual(validServerConfig);
      expect(JsonRpcRequestSchema.parse(validRequest)).toEqual(validRequest);
    });
  });

  describe('Consumer Package Compatibility', () => {
    it('validates exports work for typical orchestrator usage', async () => {
      const exports = await import('../index.js');

      // Simulate how orchestrator might use these exports
      const createMCPConnection = (config: typeof exports.MCPConnectionConfig) => {
        return exports.MCPConnectionConfigSchema.parse(config);
      };

      const handleJsonRpcMessage = (message: typeof exports.JsonRpcRequest) => {
        return exports.JsonRpcRequestSchema.parse(message);
      };

      // Test that these functions work with the exported types
      const connectionConfig = createMCPConnection({
        transport: 'stdio',
        command: 'node',
        args: ['server.js']
      });

      const rpcMessage = handleJsonRpcMessage({
        jsonrpc: '2.0',
        id: 'test',
        method: 'initialize'
      });

      expect(connectionConfig).toBeDefined();
      expect(rpcMessage).toBeDefined();
    });

    it('validates exports work for typical CLI usage', async () => {
      const exports = await import('../index.js');

      // Simulate how CLI might use these exports
      const validateServerConfig = (config: unknown) => {
        return exports.MCPServerConfigSchema.parse(config);
      };

      const createMCPConfig = (servers: Record<string, typeof exports.MCPServerConfig>) => {
        return exports.MCPConfigSchema.parse({ servers });
      };

      // Test that these functions work
      const serverConfig = validateServerConfig({
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem']
      });

      const fullConfig = createMCPConfig({
        filesystem: serverConfig
      });

      expect(serverConfig).toBeDefined();
      expect(fullConfig).toBeDefined();
      expect(fullConfig.servers.filesystem).toEqual(serverConfig);
    });

    it('validates exports work for typical API usage', async () => {
      const exports = await import('../index.js');

      // Simulate how API might use these exports
      const createToolInvocation = (params: typeof exports.MCPToolInvocationRequest) => {
        return exports.MCPToolInvocationRequestSchema.parse(params);
      };

      const createToolResponse = (result: typeof exports.MCPToolInvocationResponse) => {
        return exports.MCPToolInvocationResponseSchema.parse(result);
      };

      // Test that these functions work
      const toolCall = createToolInvocation({
        name: 'read_file',
        arguments: { path: '/test/file.txt' }
      });

      const toolResponse = createToolResponse({
        content: [{
          type: 'text',
          text: 'File contents'
        }]
      });

      expect(toolCall).toBeDefined();
      expect(toolResponse).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles import errors gracefully', async () => {
      // This test ensures we can catch import errors if they occur
      try {
        const exports = await import('../index.js');
        expect(exports).toBeDefined();
      } catch (error) {
        // If there's an import error, the test should fail with a clear message
        throw new Error(`Failed to import MCP exports: ${error}`);
      }
    });

    it('validates that schema errors provide helpful messages', async () => {
      const { MCPServerConfigSchema, JsonRpcRequestSchema } = await import('../index.js');

      // Test invalid server config
      try {
        MCPServerConfigSchema.parse({ args: ['--missing-command'] });
        throw new Error('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeDefined();
        expect(String(error)).toContain('command'); // Should mention missing field
      }

      // Test invalid JSON-RPC request
      try {
        JsonRpcRequestSchema.parse({ jsonrpc: '1.0', id: 'test' });
        throw new Error('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeDefined();
        expect(String(error)).toContain('method'); // Should mention missing field
      }
    });

    it('validates schema consistency across different import methods', async () => {
      const mainExports = await import('../index.js');
      const mcpExports = await import('../mcp/index.js');

      // Test that schemas behave identically regardless of import path
      const testConfig = {
        command: 'node',
        args: ['test.js']
      };

      const mainResult = mainExports.MCPServerConfigSchema.parse(testConfig);
      const mcpResult = mcpExports.MCPServerConfigSchema.parse(testConfig);

      expect(mainResult).toEqual(mcpResult);
    });
  });
});