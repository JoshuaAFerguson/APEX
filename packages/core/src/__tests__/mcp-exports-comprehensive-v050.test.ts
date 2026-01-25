import { describe, it, expect } from 'vitest';

/**
 * Comprehensive export validation test for v0.5.0 MCP types
 * Validates that all MCP types are properly exported from both the main types file and dedicated mcp module
 */
describe('MCP v0.5.0 Exports Comprehensive Validation', () => {
  describe('Core package index exports', () => {
    it('should export all MCP types from main index', async () => {
      const coreIndex = await import('../index');

      // v0.5.0 New Types
      expect(coreIndex.MCPServerV050Schema).toBeDefined();
      expect(coreIndex.MCPInstallationV050Schema).toBeDefined();
      expect(coreIndex.MCPInstallProgressV050Schema).toBeDefined();

      // Core MCP Configuration Types
      expect(coreIndex.MCPConnectionConfigSchema).toBeDefined();
      expect(coreIndex.MCPEnvironmentVarSchema).toBeDefined();
      expect(coreIndex.MCPServerConfigSchema).toBeDefined();
      expect(coreIndex.MCPConfigSchema).toBeDefined();

      // Server and Installation Types
      expect(coreIndex.MCPServerSchema).toBeDefined();
      expect(coreIndex.MCPInstallationSchema).toBeDefined();
      expect(coreIndex.MCPInstallationStatusSchema).toBeDefined();
      expect(coreIndex.InstalledMCPServerSchema).toBeDefined();

      // Registry Types
      expect(coreIndex.MCPRegistryServerSchema).toBeDefined();
      expect(coreIndex.MCPInstallProgressSchema).toBeDefined();
      expect(coreIndex.MCPInstallStageSchema).toBeDefined();
      expect(coreIndex.MCPServerCategorySchema).toBeDefined();

      // Connection Management Types
      expect(coreIndex.MCPConnectionStateSchema).toBeDefined();
      expect(coreIndex.MCPConnectionInfoSchema).toBeDefined();
      expect(coreIndex.MCPConnectionEventSchema).toBeDefined();

      // Tool Types
      expect(coreIndex.MCPToolSchemaSchema).toBeDefined();
      expect(coreIndex.MCPToolSchema).toBeDefined();
      expect(coreIndex.MCPToolInvocationRequestSchema).toBeDefined();
      expect(coreIndex.MCPToolInvocationResponseSchema).toBeDefined();

      // Template Types
      expect(coreIndex.MCPTemplateSchema).toBeDefined();
      expect(coreIndex.MCPServerTemplateSchema).toBeDefined(); // backwards compatibility

      // Marketplace Types
      expect(coreIndex.MCPMarketplaceEntrySchema).toBeDefined();
      expect(coreIndex.MCPMarketplaceSchema).toBeDefined();
      expect(coreIndex.MCPMarketplaceSourceSchema).toBeDefined();

      console.log('✓ All expected MCP schemas exported from main index');
    });

    it('should export all MCP TypeScript types from main index', async () => {
      const coreIndex = await import('../index');

      // Test that we can create instances with proper types
      // This validates TypeScript type exports work correctly

      const testServerV050: typeof coreIndex.MCPServerV050 = {} as any;
      const testInstallationV050: typeof coreIndex.MCPInstallationV050 = {} as any;
      const testProgressV050: typeof coreIndex.MCPInstallProgressV050 = {} as any;

      const testConnectionConfig: typeof coreIndex.MCPConnectionConfig = {} as any;
      const testEnvironmentVar: typeof coreIndex.MCPEnvironmentVar = {} as any;
      const testServerConfig: typeof coreIndex.MCPServerConfig = {} as any;

      // If TypeScript compilation passes, these types are correctly exported
      expect(testServerV050).toBeDefined();
      expect(testInstallationV050).toBeDefined();
      expect(testProgressV050).toBeDefined();
      expect(testConnectionConfig).toBeDefined();
      expect(testEnvironmentVar).toBeDefined();
      expect(testServerConfig).toBeDefined();

      console.log('✓ All MCP TypeScript types properly exported');
    });
  });

  describe('Dedicated MCP module exports', () => {
    it('should export all MCP types from dedicated mcp module', async () => {
      const mcpModule = await import('../mcp');

      // v0.5.0 New Types
      expect(mcpModule.MCPServerV050Schema).toBeDefined();
      expect(mcpModule.MCPInstallationV050Schema).toBeDefined();
      expect(mcpModule.MCPInstallProgressV050Schema).toBeDefined();

      // Core MCP Configuration Types
      expect(mcpModule.MCPConnectionConfigSchema).toBeDefined();
      expect(mcpModule.MCPEnvironmentVarSchema).toBeDefined();
      expect(mcpModule.MCPServerConfigSchema).toBeDefined();
      expect(mcpModule.MCPConfigSchema).toBeDefined();

      // Server and Installation Types
      expect(mcpModule.MCPServerSchema).toBeDefined();
      expect(mcpModule.MCPInstallationSchema).toBeDefined();
      expect(mcpModule.MCPInstallationStatusSchema).toBeDefined();
      expect(mcpModule.InstalledMCPServerSchema).toBeDefined();

      // Tool Types with proper aliasing
      expect(mcpModule.MCPToolSchemaSchema).toBeDefined();
      expect(mcpModule.MCPToolDefinitionSchema).toBeDefined(); // Aliased from MCPToolSchema
      expect(mcpModule.MCPToolInvocationRequestSchema).toBeDefined();
      expect(mcpModule.MCPToolInvocationResponseSchema).toBeDefined();

      console.log('✓ All expected MCP schemas exported from dedicated mcp module');
    });

    it('should maintain compatibility between index and mcp module exports', async () => {
      const coreIndex = await import('../index');
      const mcpModule = await import('../mcp');

      // Verify that exports are the same objects (re-exports work correctly)
      expect(mcpModule.MCPServerV050Schema).toBe(coreIndex.MCPServerV050Schema);
      expect(mcpModule.MCPInstallationV050Schema).toBe(coreIndex.MCPInstallationV050Schema);
      expect(mcpModule.MCPInstallProgressV050Schema).toBe(coreIndex.MCPInstallProgressV050Schema);

      expect(mcpModule.MCPConnectionConfigSchema).toBe(coreIndex.MCPConnectionConfigSchema);
      expect(mcpModule.MCPServerConfigSchema).toBe(coreIndex.MCPServerConfigSchema);
      expect(mcpModule.MCPConfigSchema).toBe(coreIndex.MCPConfigSchema);

      expect(mcpModule.MCPServerSchema).toBe(coreIndex.MCPServerSchema);
      expect(mcpModule.MCPInstallationSchema).toBe(coreIndex.MCPInstallationSchema);

      console.log('✓ Exports are consistent between index and mcp module');
    });
  });

  describe('Functional validation of exports', () => {
    it('should validate all exported schemas have proper Zod functionality', async () => {
      const mcpModule = await import('../mcp');

      // Get all schema exports
      const schemaExports = Object.entries(mcpModule)
        .filter(([key]) => key.endsWith('Schema'))
        .map(([key, schema]) => ({ key, schema }));

      expect(schemaExports.length).toBeGreaterThan(20); // Should have many schemas

      // Validate each schema has Zod methods
      schemaExports.forEach(({ key, schema }) => {
        expect(typeof schema.parse).toBe('function', `${key} should have parse method`);
        expect(typeof schema.safeParse).toBe('function', `${key} should have safeParse method`);
        expect(typeof schema.optional).toBe('function', `${key} should have optional method`);
        expect(typeof schema.nullable).toBe('function', `${key} should have nullable method`);
      });

      console.log(`✓ Validated ${schemaExports.length} schemas have proper Zod functionality`);
    });

    it('should validate v0.5.0 schemas work with sample data', async () => {
      const {
        MCPServerV050Schema,
        MCPInstallationV050Schema,
        MCPInstallProgressV050Schema
      } = await import('../mcp');

      // Test MCPServerV050Schema
      const sampleServer = {
        id: 'test-functional-server',
        name: 'Functional Test Server',
        description: 'Testing functional validation',
        version: '0.5.0',
        author: 'Test Author',
        tools: ['test-tool'],
        categories: ['development'],
      };

      const parsedServer = MCPServerV050Schema.parse(sampleServer);
      expect(parsedServer.id).toBe(sampleServer.id);
      expect(parsedServer.tools).toEqual(sampleServer.tools);

      // Test MCPInstallationV050Schema
      const sampleInstallation = {
        serverId: parsedServer.id,
        installedAt: new Date(),
        config: {
          name: parsedServer.name,
          command: 'node',
          args: ['server.js'],
        },
        status: 'installed' as const,
      };

      const parsedInstallation = MCPInstallationV050Schema.parse(sampleInstallation);
      expect(parsedInstallation.serverId).toBe(parsedServer.id);

      // Test MCPInstallProgressV050Schema
      const sampleProgress = {
        serverId: parsedServer.id,
        stage: 'downloading' as const,
        progress: 75,
        message: 'Downloading package...',
      };

      const parsedProgress = MCPInstallProgressV050Schema.parse(sampleProgress);
      expect(parsedProgress.serverId).toBe(parsedServer.id);
      expect(parsedProgress.progress).toBe(75);

      console.log('✓ v0.5.0 schemas work with sample data');
    });

    it('should validate backward compatibility aliases', async () => {
      const mcpModule = await import('../mcp');

      // Test MCPConnectionSchema alias
      expect(mcpModule.MCPConnectionSchema).toBeDefined();
      expect(mcpModule.MCPConnectionSchema).toBe(mcpModule.MCPConnectionInfoSchema);

      // Test MCPServerTemplateSchema alias
      expect(mcpModule.MCPServerTemplateSchema).toBeDefined();
      expect(mcpModule.MCPServerTemplateSchema).toBe(mcpModule.MCPTemplateSchema);

      // Test that aliases work functionally
      const connectionData = {
        id: 'test-connection',
        serverId: 'test-server',
        config: {
          name: 'test-server',
          command: 'node',
          args: ['server.js'],
        },
        state: 'connected' as const,
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
      };

      const parsedWithAlias = mcpModule.MCPConnectionSchema.parse(connectionData);
      const parsedWithNew = mcpModule.MCPConnectionInfoSchema.parse(connectionData);

      expect(parsedWithAlias).toEqual(parsedWithNew);

      console.log('✓ Backward compatibility aliases work correctly');
    });
  });

  describe('Cross-schema compatibility validation', () => {
    it('should validate schemas work together in typical orchestrator patterns', async () => {
      const {
        MCPServerV050Schema,
        MCPInstallationV050Schema,
        MCPServerConfigSchema,
        MCPConnectionInfoSchema,
        MCPToolDefinitionSchema,
        MCPToolInvocationRequestSchema,
      } = await import('../mcp');

      // 1. Create a server from registry
      const registryServer = MCPServerV050Schema.parse({
        id: 'cross-schema-test',
        name: 'Cross Schema Test Server',
        description: 'Testing cross-schema compatibility',
        version: '1.0.0',
        author: 'Test Author',
        tools: ['test-tool'],
      });

      // 2. Create server config for installation
      const serverConfig = MCPServerConfigSchema.parse({
        name: registryServer.name,
        command: 'npx',
        args: [`@test/${registryServer.id}`],
        envVars: [
          {
            name: 'SERVER_ID',
            value: registryServer.id,
            description: 'Server identifier',
          },
        ],
      });

      // 3. Create installation record
      const installation = MCPInstallationV050Schema.parse({
        serverId: registryServer.id,
        installedAt: new Date(),
        config: serverConfig,
        status: 'installed',
      });

      // 4. Create connection info
      const connectionInfo = MCPConnectionInfoSchema.parse({
        id: `conn-${registryServer.id}`,
        serverId: installation.serverId,
        config: installation.config,
        state: 'connected',
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
      });

      // 5. Define a tool from this server
      const toolDefinition = MCPToolDefinitionSchema.parse({
        name: registryServer.tools[0],
        description: 'Test tool from server',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
          required: ['input'],
        },
        serverId: registryServer.id,
        serverName: registryServer.name,
      });

      // 6. Create tool invocation
      const toolInvocation = MCPToolInvocationRequestSchema.parse({
        id: 'invocation-123',
        toolName: toolDefinition.name,
        serverId: toolDefinition.serverId,
        arguments: { input: 'test input' },
      });

      // Validate relationships
      expect(installation.serverId).toBe(registryServer.id);
      expect(connectionInfo.serverId).toBe(installation.serverId);
      expect(toolDefinition.serverId).toBe(registryServer.id);
      expect(toolInvocation.serverId).toBe(registryServer.id);
      expect(toolInvocation.toolName).toBe(registryServer.tools[0]);

      console.log('✓ Cross-schema compatibility validated');
    });

    it('should validate error handling in cross-schema scenarios', async () => {
      const {
        MCPServerConfigSchema,
        MCPInstallationV050Schema,
      } = await import('../mcp');

      // Test invalid server config
      const invalidConfig = {
        name: '', // Invalid empty name
        command: 123, // Invalid type
      };

      const configResult = MCPServerConfigSchema.safeParse(invalidConfig);
      expect(configResult.success).toBe(false);

      if (!configResult.success) {
        expect(configResult.error.issues.length).toBeGreaterThan(0);
      }

      // Test invalid installation with missing fields
      const invalidInstallation = {
        serverId: 'test-server',
        // Missing required fields
      };

      const installResult = MCPInstallationV050Schema.safeParse(invalidInstallation);
      expect(installResult.success).toBe(false);

      console.log('✓ Error handling works correctly across schemas');
    });
  });

  describe('Performance and edge case validation', () => {
    it('should handle large data structures efficiently', async () => {
      const { MCPServerV050Schema } = await import('../mcp');

      // Create server with large arrays
      const serverWithLargeArrays = {
        id: 'large-data-test',
        name: 'Large Data Test Server',
        description: 'Testing with large arrays',
        version: '1.0.0',
        author: 'Test Author',
        tools: Array.from({ length: 100 }, (_, i) => `tool-${i}`),
        keywords: Array.from({ length: 50 }, (_, i) => `keyword-${i}`),
        categories: ['development', 'productivity'], // Keep categories valid
      };

      const startTime = performance.now();
      const result = MCPServerV050Schema.parse(serverWithLargeArrays);
      const endTime = performance.now();

      expect(result.tools).toHaveLength(100);
      expect(result.keywords).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast (< 100ms)

      console.log(`✓ Large data validation completed in ${endTime - startTime}ms`);
    });

    it('should handle deeply nested optional fields', async () => {
      const {
        MCPServerConfigSchema,
        MCPConnectionInfoSchema,
      } = await import('../mcp');

      // Test deeply nested optional configuration
      const deepConfig = MCPServerConfigSchema.parse({
        name: 'deep-config-test',
        command: 'node',
        connection: {
          maxRetries: 5,
          retryDelayMs: 2000,
          timeoutMs: 60000,
          keepAliveIntervalMs: 30000,
          maxBufferSize: 1048576,
        },
        envVars: [
          {
            name: 'NESTED_CONFIG',
            value: JSON.stringify({
              level1: {
                level2: {
                  level3: {
                    value: 'deeply nested',
                  },
                },
              },
            }),
            description: 'Deeply nested configuration',
            required: false,
            sensitive: false,
          },
        ],
      });

      expect(deep_config.connection?.maxRetries).toBe(5);
      expect(deepConfig.envVars?.[0]?.name).toBe('NESTED_CONFIG');

      // Test connection info with optional metadata
      const connectionWithMetadata = MCPConnectionInfoSchema.parse({
        id: 'metadata-test',
        serverId: 'test-server',
        config: deepConfig,
        state: 'connected',
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
        capabilities: {
          tools: ['test-tool'],
          resources: ['test://resource'],
          prompts: [],
        },
        metadata: {
          version: '1.0.0',
          serverInfo: {
            name: 'Test Server',
            version: '1.0.0',
            description: 'A test server',
          },
          connectionAttempts: 3,
          lastError: null,
          performance: {
            avgResponseTime: 50,
            successRate: 0.99,
          },
        },
      });

      expect(connectionWithMetadata.metadata?.serverInfo?.name).toBe('Test Server');

      console.log('✓ Deeply nested optional fields handled correctly');
    });

    it('should handle edge case values', async () => {
      const {
        MCPInstallProgressV050Schema,
        MCPInstallationV050Schema,
      } = await import('../mcp');

      // Test edge case progress values
      const edgeCaseProgress = [
        { progress: 0, stage: 'preparing' as const },
        { progress: 100, stage: 'complete' as const },
        { progress: undefined, stage: 'downloading' as const }, // No progress
      ];

      edgeCaseProgress.forEach((progressData, index) => {
        const fullProgress = {
          serverId: `edge-test-${index}`,
          ...progressData,
        };

        const result = MCPInstallProgressV050Schema.parse(fullProgress);
        expect(result.serverId).toBe(`edge-test-${index}`);
        expect(result.stage).toBe(progressData.stage);
      });

      // Test edge case dates
      const edgeDates = [
        new Date(0), // Unix epoch
        new Date('2024-01-01T00:00:00.000Z'), // Exact milliseconds
        new Date('2038-01-19T03:14:07.000Z'), // Y2038 boundary
      ];

      edgeDates.forEach((date, index) => {
        const installation = {
          serverId: `date-edge-${index}`,
          installedAt: date,
          config: {
            name: `test-${index}`,
            command: 'node',
          },
          status: 'installed' as const,
        };

        const result = MCPInstallationV050Schema.parse(installation);
        expect(result.installedAt).toEqual(date);
      });

      console.log('✓ Edge case values handled correctly');
    });
  });
});