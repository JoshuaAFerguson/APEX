import { describe, it, expect } from 'vitest';

/**
 * Quick validation test for MCP exports
 * Tests that can run without requiring a full build process
 */
describe('Quick MCP Exports Validation', () => {
  describe('Direct type imports from types.ts', () => {
    it('should import all v0.5.0 MCP schemas directly', async () => {
      const types = await import('../types');

      // v0.5.0 New Types
      expect(types.MCPServerV050Schema).toBeDefined();
      expect(types.MCPInstallationV050Schema).toBeDefined();
      expect(types.MCPInstallProgressV050Schema).toBeDefined();

      console.log('✓ v0.5.0 schemas imported from types.ts');
    });

    it('should validate v0.5.0 schemas have correct Zod structure', async () => {
      const {
        MCPServerV050Schema,
        MCPInstallationV050Schema,
        MCPInstallProgressV050Schema,
      } = await import('../types');

      // Test that schemas are Zod schemas
      expect(typeof MCPServerV050Schema.parse).toBe('function');
      expect(typeof MCPServerV050Schema.safeParse).toBe('function');
      expect(typeof MCPInstallationV050Schema.parse).toBe('function');
      expect(typeof MCPInstallProgressV050Schema.parse).toBe('function');

      // Test basic parsing with minimal valid data
      const minimalServer = {
        id: 'test',
        name: 'Test Server',
        description: 'Test',
        version: '1.0.0',
        author: 'Test',
        tools: [],
      };

      const serverResult = MCPServerV050Schema.safeParse(minimalServer);
      expect(serverResult.success).toBe(true);

      console.log('✓ v0.5.0 schemas have correct Zod structure');
    });
  });

  describe('Direct imports from mcp.ts', () => {
    it('should import all MCP schemas from mcp module', async () => {
      const mcp = await import('../mcp');

      // v0.5.0 Types
      expect(mcp.MCPServerV050Schema).toBeDefined();
      expect(mcp.MCPInstallationV050Schema).toBeDefined();
      expect(mcp.MCPInstallProgressV050Schema).toBeDefined();

      // Core Types
      expect(mcp.MCPConnectionConfigSchema).toBeDefined();
      expect(mcp.MCPServerConfigSchema).toBeDefined();
      expect(mcp.MCPConfigSchema).toBeDefined();

      // Tool Types
      expect(mcp.MCPToolSchemaSchema).toBeDefined();
      expect(mcp.MCPToolDefinitionSchema).toBeDefined(); // Aliased MCPToolSchema

      console.log('✓ All MCP schemas imported from mcp.ts');
    });

    it('should validate mcp module re-exports are identical to types', async () => {
      const types = await import('../types');
      const mcp = await import('../mcp');

      // Check that re-exports are the same objects
      expect(mcp.MCPServerV050Schema).toBe(types.MCPServerV050Schema);
      expect(mcp.MCPInstallationV050Schema).toBe(types.MCPInstallationV050Schema);
      expect(mcp.MCPInstallProgressV050Schema).toBe(types.MCPInstallProgressV050Schema);

      expect(mcp.MCPServerConfigSchema).toBe(types.MCPServerConfigSchema);
      expect(mcp.MCPConnectionConfigSchema).toBe(types.MCPConnectionConfigSchema);

      console.log('✓ mcp.ts re-exports are identical to types.ts');
    });
  });

  describe('Basic validation functionality', () => {
    it('should validate MCPServerV050 with minimal data', async () => {
      const { MCPServerV050Schema } = await import('../mcp');

      const minimalServer = {
        id: 'minimal-test',
        name: 'Minimal Test Server',
        description: 'A minimal server for testing',
        version: '1.0.0',
        author: 'Test Author',
        tools: [],
      };

      const result = MCPServerV050Schema.parse(minimalServer);
      expect(result.id).toBe('minimal-test');
      expect(result.categories).toEqual([]); // Default value
      expect(result.tools).toEqual([]);

      console.log('✓ MCPServerV050Schema validates minimal data');
    });

    it('should validate MCPInstallationV050 with minimal data', async () => {
      const { MCPInstallationV050Schema } = await import('../mcp');

      const minimalInstallation = {
        serverId: 'test-server',
        installedAt: new Date(),
        config: {
          name: 'test-server',
          command: 'node',
        },
        status: 'installed' as const,
      };

      const result = MCPInstallationV050Schema.parse(minimalInstallation);
      expect(result.serverId).toBe('test-server');
      expect(result.status).toBe('installed');
      expect(result.config.name).toBe('test-server');

      console.log('✓ MCPInstallationV050Schema validates minimal data');
    });

    it('should validate MCPInstallProgressV050 with minimal data', async () => {
      const { MCPInstallProgressV050Schema } = await import('../mcp');

      const minimalProgress = {
        serverId: 'test-server',
        stage: 'downloading' as const,
      };

      const result = MCPInstallProgressV050Schema.parse(minimalProgress);
      expect(result.serverId).toBe('test-server');
      expect(result.stage).toBe('downloading');

      console.log('✓ MCPInstallProgressV050Schema validates minimal data');
    });
  });

  describe('Error handling validation', () => {
    it('should properly reject invalid MCPServerV050 data', async () => {
      const { MCPServerV050Schema } = await import('../mcp');

      const invalidServers = [
        {}, // Missing all required fields
        { id: '' }, // Empty id
        { id: 'test', name: '', description: 'test', version: '1.0.0', author: 'test', tools: [] }, // Empty name
        { id: 'test', name: 'test', description: 'test', version: '1.0.0', author: 'test', tools: [], categories: ['invalid'] }, // Invalid category
      ];

      invalidServers.forEach((server, index) => {
        const result = MCPServerV050Schema.safeParse(server);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
        }
      });

      console.log('✓ MCPServerV050Schema properly rejects invalid data');
    });

    it('should properly reject invalid MCPInstallationV050 data', async () => {
      const { MCPInstallationV050Schema } = await import('../mcp');

      const invalidInstallations = [
        {}, // Missing all required fields
        { serverId: 'test' }, // Missing other required fields
        { serverId: 'test', installedAt: new Date(), config: { name: 'test', command: 'node' }, status: 'invalid' }, // Invalid status
      ];

      invalidInstallations.forEach((installation) => {
        const result = MCPInstallationV050Schema.safeParse(installation);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
        }
      });

      console.log('✓ MCPInstallationV050Schema properly rejects invalid data');
    });

    it('should properly reject invalid MCPInstallProgressV050 data', async () => {
      const { MCPInstallProgressV050Schema } = await import('../mcp');

      const invalidProgress = [
        {}, // Missing required fields
        { serverId: 'test', stage: 'invalid' }, // Invalid stage
        { serverId: 'test', stage: 'downloading', progress: -1 }, // Invalid progress
        { serverId: 'test', stage: 'downloading', progress: 101 }, // Invalid progress
      ];

      invalidProgress.forEach((progress) => {
        const result = MCPInstallProgressV050Schema.safeParse(progress);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
        }
      });

      console.log('✓ MCPInstallProgressV050Schema properly rejects invalid data');
    });
  });

  describe('Compatibility with existing types', () => {
    it('should work with existing MCPServerConfig in v0.5.0 installation', async () => {
      const {
        MCPServerConfigSchema,
        MCPInstallationV050Schema,
      } = await import('../mcp');

      // Create a server config using existing schema
      const serverConfig = MCPServerConfigSchema.parse({
        name: 'compatibility-test',
        command: 'npx',
        args: ['@test/server'],
        envVars: [
          {
            name: 'NODE_ENV',
            value: 'production',
            description: 'Node environment',
          },
        ],
        connection: {
          maxRetries: 3,
          retryDelayMs: 1000,
          timeoutMs: 30000,
        },
      });

      // Use it in v0.5.0 installation
      const installation = MCPInstallationV050Schema.parse({
        serverId: 'compatibility-test-server',
        installedAt: new Date(),
        config: serverConfig,
        status: 'installed',
      });

      expect(installation.config.name).toBe('compatibility-test');
      expect(installation.config.envVars?.[0]?.name).toBe('NODE_ENV');

      console.log('✓ v0.5.0 types work with existing MCPServerConfig');
    });

    it('should work with existing connection management types', async () => {
      const {
        MCPConnectionInfoSchema,
        MCPServerConfigSchema,
        MCPConnectionEventSchema,
      } = await import('../mcp');

      const serverConfig = {
        name: 'connection-test',
        command: 'node',
        args: ['server.js'],
      };

      const connectionInfo = MCPConnectionInfoSchema.parse({
        id: 'conn-test',
        serverId: 'connection-test-server',
        config: serverConfig,
        state: 'connected',
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
      });

      const connectionEvent = MCPConnectionEventSchema.parse({
        type: 'connected',
        serverId: connectionInfo.serverId,
        previousState: 'connecting',
        newState: 'connected',
        timestamp: new Date(),
      });

      expect(connectionInfo.state).toBe('connected');
      expect(connectionEvent.serverId).toBe(connectionInfo.serverId);

      console.log('✓ Works with existing connection management types');
    });
  });

  describe('Type consistency validation', () => {
    it('should maintain consistent types across schemas', async () => {
      const {
        MCPServerV050Schema,
        MCPInstallationV050Schema,
        MCPInstallationStatusSchema,
        MCPInstallStageSchema,
      } = await import('../mcp');

      // Test that types are consistent
      const server = MCPServerV050Schema.parse({
        id: 'consistency-test',
        name: 'Consistency Test',
        description: 'Testing type consistency',
        version: '1.0.0',
        author: 'Test',
        tools: [],
      });

      // Use server id in installation
      const installation = MCPInstallationV050Schema.parse({
        serverId: server.id, // Should be type-compatible
        installedAt: new Date(),
        config: { name: 'test', command: 'node' },
        status: 'installed',
      });

      // Test enum consistency
      const validStatuses = ['pending', 'installing', 'installed', 'failed', 'uninstalling', 'uninstalled'];
      validStatuses.forEach(status => {
        const result = MCPInstallationStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      });

      const validStages = ['preparing', 'downloading', 'extracting', 'installing', 'configuring', 'testing', 'complete'];
      validStages.forEach(stage => {
        const result = MCPInstallStageSchema.safeParse(stage);
        expect(result.success).toBe(true);
      });

      expect(installation.serverId).toBe(server.id);
      console.log('✓ Type consistency maintained across schemas');
    });
  });
});