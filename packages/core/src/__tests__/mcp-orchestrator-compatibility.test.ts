import { describe, it, expect } from 'vitest';

/**
 * Compatibility test to ensure MCP types work correctly with orchestrator patterns
 *
 * This test verifies that the MCP types exported from the core package
 * are compatible with the patterns used by the orchestrator package.
 */
describe('MCP Orchestrator Compatibility', () => {
  describe('Type imports from both sources work identically', () => {
    it('should import MCP types from main types and dedicated mcp module', async () => {
      // Import from main types file (current pattern)
      const typesImport = await import('../types');

      // Import from dedicated mcp file (new pattern)
      const mcpImport = await import('../mcp');

      // Verify key schemas exist in both
      expect(typesImport.MCPServerConfigSchema).toBeDefined();
      expect(mcpImport.MCPServerConfigSchema).toBeDefined();

      expect(typesImport.MCPConnectionInfoSchema).toBeDefined();
      expect(mcpImport.MCPConnectionInfoSchema).toBeDefined();

      expect(typesImport.MCPToolSchema).toBeDefined();
      expect(mcpImport.MCPToolSchema).toBeDefined();

      // Verify they are the same objects (re-exports work correctly)
      expect(mcpImport.MCPServerConfigSchema).toBe(typesImport.MCPServerConfigSchema);
      expect(mcpImport.MCPConnectionInfoSchema).toBe(typesImport.MCPConnectionInfoSchema);
      expect(mcpImport.MCPToolSchema).toBe(typesImport.MCPToolSchema);
    });

    it('should import MCP types from main index and dedicated mcp module', async () => {
      // Import from main index (what orchestrator uses)
      const indexImport = await import('../index');

      // Import from dedicated mcp file (new pattern)
      const mcpImport = await import('../mcp');

      // Verify key schemas exist in both
      expect(indexImport.MCPServerConfigSchema).toBeDefined();
      expect(mcpImport.MCPServerConfigSchema).toBeDefined();

      expect(indexImport.MCPConnectionInfoSchema).toBeDefined();
      expect(mcpImport.MCPConnectionInfoSchema).toBeDefined();

      expect(indexImport.MCPToolSchema).toBeDefined();
      expect(mcpImport.MCPToolSchema).toBeDefined();

      // Verify they are the same objects (re-exports work correctly)
      expect(mcpImport.MCPServerConfigSchema).toBe(indexImport.MCPServerConfigSchema);
      expect(mcpImport.MCPConnectionInfoSchema).toBe(indexImport.MCPConnectionInfoSchema);
      expect(mcpImport.MCPToolSchema).toBe(indexImport.MCPToolSchema);
    });
  });

  describe('Orchestrator usage patterns', () => {
    it('should support orchestrator MCP server configuration pattern', async () => {
      const { MCPServerConfigSchema, MCPInstallationSchema } = await import('../mcp');

      // Pattern used in mcp-installer.ts
      const serverConfig = MCPServerConfigSchema.parse({
        name: 'filesystem-server',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
        envVars: [{
          name: 'MCP_FS_ROOT',
          value: '/tmp',
          description: 'Root directory for filesystem operations'
        }]
      });

      const installation = MCPInstallationSchema.parse({
        id: 'filesystem-install',
        serverId: 'filesystem-server',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/config/filesystem.json'
      });

      expect(serverConfig.name).toBe('filesystem-server');
      expect(installation.serverId).toBe('filesystem-server');
    });

    it('should support orchestrator MCP connection management pattern', async () => {
      const {
        MCPConnectionInfoSchema,
        MCPConnectionStateSchema,
        MCPConnectionEventSchema
      } = await import('../mcp');

      // Pattern used in mcp/connection-manager.ts
      const connectionInfo = MCPConnectionInfoSchema.parse({
        id: 'conn-1',
        serverId: 'test-server',
        config: {
          name: 'test-server',
          command: 'node',
          args: ['server.js']
        },
        state: 'connected',
        connectedAt: new Date(),
        lastHeartbeat: new Date()
      });

      const connectionEvent = MCPConnectionEventSchema.parse({
        type: 'connected',
        serverId: 'test-server',
        previousState: 'connecting',
        newState: 'connected',
        timestamp: new Date()
      });

      expect(connectionInfo.state).toBe('connected');
      expect(connectionEvent.newState).toBe('connected');
    });

    it('should support orchestrator MCP tool discovery pattern', async () => {
      const { MCPToolSchema, MCPToolInvocationRequestSchema } = await import('../mcp');

      // Pattern used in schema-translator.ts and mcp-tool-registry.ts
      const tool = MCPToolSchema.parse({
        name: 'list_files',
        description: 'List files in a directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path']
        },
        serverId: 'filesystem-server',
        serverName: 'Filesystem Server'
      });

      const invocationRequest = MCPToolInvocationRequestSchema.parse({
        id: 'req-123',
        toolName: 'list_files',
        serverId: 'filesystem-server',
        arguments: { path: '/tmp' }
      });

      expect(tool.name).toBe('list_files');
      expect(invocationRequest.toolName).toBe('list_files');
    });

    it('should support orchestrator MCP registry pattern', async () => {
      const {
        MCPRegistryServerSchema,
        MCPRegistryInstallationSchema,
        MCPInstallProgressSchema
      } = await import('../mcp');

      // Pattern used in mcp/marketplace-service.ts
      const registryServer = MCPRegistryServerSchema.parse({
        id: 'filesystem',
        name: 'Filesystem Server',
        description: 'MCP server for filesystem operations',
        package: '@modelcontextprotocol/server-filesystem',
        version: '1.0.0',
        author: 'Anthropic',
        tools: ['list_files', 'read_file', 'write_file']
      });

      const installProgress = MCPInstallProgressSchema.parse({
        serverId: 'filesystem',
        stage: 'installing',
        progress: 50,
        message: 'Installing npm package...'
      });

      expect(registryServer.id).toBe('filesystem');
      expect(installProgress.serverId).toBe('filesystem');
    });

    it('should support orchestrator JSON-RPC integration pattern', async () => {
      const { MCPToolInvocationResponseSchema } = await import('../mcp');

      // Pattern used for tool execution results
      const response = MCPToolInvocationResponseSchema.parse({
        id: 'resp-123',
        success: true,
        toolName: 'list_files',
        serverId: 'filesystem-server',
        content: [
          {
            type: 'text',
            text: '["file1.txt", "file2.txt"]'
          }
        ]
      });

      expect(response.success).toBe(true);
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');
    });
  });

  describe('Backward compatibility', () => {
    it('should maintain backward compatibility aliases', async () => {
      const {
        MCPConnectionSchema,
        MCPConnectionInfoSchema,
        MCPServerTemplateSchema,
        MCPTemplateSchema
      } = await import('../mcp');

      // Verify backward compatibility aliases work
      expect(MCPConnectionSchema).toBe(MCPConnectionInfoSchema);
      expect(MCPServerTemplateSchema).toBe(MCPTemplateSchema);

      // Test that both can be used interchangeably
      const connectionData = {
        id: 'test-connection',
        serverId: 'test-server',
        config: {
          name: 'test-server',
          command: 'node',
          args: ['server.js']
        },
        state: 'connected' as const,
        connectedAt: new Date(),
        lastHeartbeat: new Date()
      };

      const parsedWithOld = MCPConnectionSchema.parse(connectionData);
      const parsedWithNew = MCPConnectionInfoSchema.parse(connectionData);

      expect(parsedWithOld).toEqual(parsedWithNew);
    });
  });

  describe('Cross-package type safety', () => {
    it('should ensure type safety across package boundaries', async () => {
      const { MCPServerConfigSchema, MCPConnectionInfoSchema } = await import('../mcp');

      // This simulates how the orchestrator would use these types
      const createConnection = (config: any) => {
        const parsedConfig = MCPServerConfigSchema.parse(config);

        return MCPConnectionInfoSchema.parse({
          id: 'test-connection',
          serverId: parsedConfig.name,
          config: parsedConfig,
          state: 'connecting',
          connectedAt: new Date(),
          lastHeartbeat: new Date()
        });
      };

      const config = {
        name: 'test-server',
        command: 'node',
        args: ['server.js'],
        envVars: [
          {
            name: 'NODE_ENV',
            value: 'production',
            description: 'Node environment'
          }
        ]
      };

      const connection = createConnection(config);
      expect(connection.serverId).toBe('test-server');
      expect(connection.config.name).toBe('test-server');
    });
  });
});