import { describe, it, expect } from 'vitest';
import * as mcpExports from '../mcp';

/**
 * Integration test for the dedicated mcp.ts exports file
 *
 * This validates that all MCP types and schemas are properly exported through
 * the dedicated mcp.ts module, which is used by the orchestrator package.
 */
describe('MCP Exports Validation', () => {
  describe('MCP Configuration exports', () => {
    it('should export MCPConnectionConfigSchema and type', () => {
      expect(mcpExports.MCPConnectionConfigSchema).toBeDefined();
      expect(typeof mcpExports.MCPConnectionConfigSchema.parse).toBe('function');

      // Test valid connection config
      const validConfig = {
        maxRetries: 3,
        retryDelayMs: 1000,
        timeoutMs: 30000
      };

      const parsed = mcpExports.MCPConnectionConfigSchema.parse(validConfig);
      expect(parsed.maxRetries).toBe(3);
    });

    it('should export MCPEnvironmentVarSchema and type', () => {
      expect(mcpExports.MCPEnvironmentVarSchema).toBeDefined();

      const validEnvVar = {
        name: 'TEST_VAR',
        value: 'test_value',
        description: 'Test environment variable'
      };

      const parsed = mcpExports.MCPEnvironmentVarSchema.parse(validEnvVar);
      expect(parsed.name).toBe('TEST_VAR');
    });

    it('should export MCPServerConfigSchema and type', () => {
      expect(mcpExports.MCPServerConfigSchema).toBeDefined();

      const validConfig = {
        name: 'test-server',
        command: 'node',
        args: ['server.js']
      };

      const parsed = mcpExports.MCPServerConfigSchema.parse(validConfig);
      expect(parsed.name).toBe('test-server');
    });

    it('should export MCPConfigSchema and type', () => {
      expect(mcpExports.MCPConfigSchema).toBeDefined();

      const validConfig = {
        enabled: true,
        servers: []
      };

      const parsed = mcpExports.MCPConfigSchema.parse(validConfig);
      expect(parsed.enabled).toBe(true);
    });
  });

  describe('MCP Marketplace exports', () => {
    it('should export MCPMarketplaceEntrySchema and type', () => {
      expect(mcpExports.MCPMarketplaceEntrySchema).toBeDefined();

      const validEntry = {
        name: 'test-marketplace-server',
        description: 'Test marketplace server',
        serverConfig: {
          name: 'test-server',
          command: 'node',
          args: ['server.js']
        }
      };

      const parsed = mcpExports.MCPMarketplaceEntrySchema.parse(validEntry);
      expect(parsed.name).toBe('test-marketplace-server');
    });

    it('should export MCPMarketplaceSchema and type', () => {
      expect(mcpExports.MCPMarketplaceSchema).toBeDefined();

      const validMarketplace = {
        name: 'test-marketplace',
        version: '1.0.0',
        servers: []
      };

      const parsed = mcpExports.MCPMarketplaceSchema.parse(validMarketplace);
      expect(parsed.name).toBe('test-marketplace');
    });
  });

  describe('MCP Server exports', () => {
    it('should export MCPServerSchema and type', () => {
      expect(mcpExports.MCPServerSchema).toBeDefined();

      const validServer = {
        name: 'test-server',
        package: '@test/mcp-server',
        command: 'npx',
        args: ['@test/mcp-server'],
        version: '1.0.0'
      };

      const parsed = mcpExports.MCPServerSchema.parse(validServer);
      expect(parsed.name).toBe('test-server');
    });

    it('should export MCPInstallationSchema and type', () => {
      expect(mcpExports.MCPInstallationSchema).toBeDefined();

      const validInstallation = {
        id: 'test-installation',
        serverId: 'test-server',
        installedAt: new Date(),
        status: 'installed' as const,
        configPath: '/test/config.json'
      };

      const parsed = mcpExports.MCPInstallationSchema.parse(validInstallation);
      expect(parsed.id).toBe('test-installation');
    });

    it('should export InstalledMCPServerSchema and type', () => {
      expect(mcpExports.InstalledMCPServerSchema).toBeDefined();

      const validInstalledServer = {
        id: 'test-installed',
        name: 'test-server',
        server: {
          name: 'test-server',
          package: '@test/mcp-server',
          command: 'npx',
          args: ['@test/mcp-server'],
          version: '1.0.0'
        },
        config: {
          name: 'test-server',
          command: 'node',
          args: ['server.js']
        },
        status: 'installed' as const,
        installedAt: new Date(),
        configPath: '/test/config.json'
      };

      const parsed = mcpExports.InstalledMCPServerSchema.parse(validInstalledServer);
      expect(parsed.name).toBe('test-server');
    });
  });

  describe('MCP Registry exports', () => {
    it('should export MCPServerCategorySchema and type', () => {
      expect(mcpExports.MCPServerCategorySchema).toBeDefined();

      const validCategory = 'development';
      const parsed = mcpExports.MCPServerCategorySchema.parse(validCategory);
      expect(parsed).toBe('development');
    });

    it('should export MCPRegistryServerSchema and type', () => {
      expect(mcpExports.MCPRegistryServerSchema).toBeDefined();

      const validRegistryServer = {
        id: 'test-registry-server',
        name: 'Test Registry Server',
        description: 'A test server from registry',
        package: '@test/registry-server',
        version: '2.0.0',
        author: 'Test Author',
        tools: ['test-tool']
      };

      const parsed = mcpExports.MCPRegistryServerSchema.parse(validRegistryServer);
      expect(parsed.id).toBe('test-registry-server');
    });

    it('should export MCPInstallProgressSchema and type', () => {
      expect(mcpExports.MCPInstallProgressSchema).toBeDefined();

      const validProgress = {
        serverId: 'test-server',
        stage: 'downloading' as const,
        progress: 50,
        message: 'Downloading server package...'
      };

      const parsed = mcpExports.MCPInstallProgressSchema.parse(validProgress);
      expect(parsed.serverId).toBe('test-server');
      expect(parsed.progress).toBe(50);
    });
  });

  describe('MCP Connection Management exports', () => {
    it('should export MCPConnectionStateSchema and type', () => {
      expect(mcpExports.MCPConnectionStateSchema).toBeDefined();

      const validState = 'connected';
      const parsed = mcpExports.MCPConnectionStateSchema.parse(validState);
      expect(parsed).toBe('connected');
    });

    it('should export MCPConnectionInfoSchema and type', () => {
      expect(mcpExports.MCPConnectionInfoSchema).toBeDefined();

      const validConnectionInfo = {
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

      const parsed = mcpExports.MCPConnectionInfoSchema.parse(validConnectionInfo);
      expect(parsed.id).toBe('test-connection');
      expect(parsed.state).toBe('connected');
    });

    it('should export backward compatibility aliases', () => {
      expect(mcpExports.MCPConnectionSchema).toBeDefined();
      expect(mcpExports.MCPConnectionSchema).toBe(mcpExports.MCPConnectionInfoSchema);
    });

    it('should export MCPConnectionEventSchema and type', () => {
      expect(mcpExports.MCPConnectionEventSchema).toBeDefined();

      const validEvent = {
        type: 'connected' as const,
        serverId: 'test-server',
        previousState: 'connecting' as const,
        newState: 'connected' as const,
        timestamp: new Date()
      };

      const parsed = mcpExports.MCPConnectionEventSchema.parse(validEvent);
      expect(parsed.type).toBe('connected');
    });
  });

  describe('MCP Tool types exports', () => {
    it('should export MCPToolSchemaSchema and type', () => {
      expect(mcpExports.MCPToolSchemaSchema).toBeDefined();

      const validSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };

      const parsed = mcpExports.MCPToolSchemaSchema.parse(validSchema);
      expect(parsed.type).toBe('object');
    });

    it('should export MCPToolDefinitionSchema and type', () => {
      expect(mcpExports.MCPToolDefinitionSchema).toBeDefined();

      const validTool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        serverId: 'test-server',
        serverName: 'Test Server'
      };

      const parsed = mcpExports.MCPToolDefinitionSchema.parse(validTool);
      expect(parsed.name).toBe('test-tool');
    });

    it('should export MCPToolInvocationRequestSchema and type', () => {
      expect(mcpExports.MCPToolInvocationRequestSchema).toBeDefined();

      const validRequest = {
        id: 'test-request',
        toolName: 'test-tool',
        serverId: 'test-server',
        arguments: { arg1: 'value1' }
      };

      const parsed = mcpExports.MCPToolInvocationRequestSchema.parse(validRequest);
      expect(parsed.toolName).toBe('test-tool');
    });

    it('should export MCPToolInvocationResponseSchema and type', () => {
      expect(mcpExports.MCPToolInvocationResponseSchema).toBeDefined();

      const validResponse = {
        id: 'test-response',
        success: true,
        toolName: 'test-tool',
        serverId: 'test-server'
      };

      const parsed = mcpExports.MCPToolInvocationResponseSchema.parse(validResponse);
      expect(parsed.success).toBe(true);
    });
  });

  describe('MCP Template exports', () => {
    it('should export MCPTemplateSchema and type', () => {
      expect(mcpExports.MCPTemplateSchema).toBeDefined();

      const validTemplate = {
        id: 'test-template',
        name: 'Test Template',
        description: 'A test template',
        packageName: '@test/template-server',
        config: {}
      };

      const parsed = mcpExports.MCPTemplateSchema.parse(validTemplate);
      expect(parsed.id).toBe('test-template');
    });

    it('should export backward compatibility template aliases', () => {
      expect(mcpExports.MCPServerTemplateSchema).toBeDefined();
      expect(mcpExports.MCPServerTemplateSchema).toBe(mcpExports.MCPTemplateSchema);
    });
  });

  describe('MCP v0.5.0 Feature Development exports', () => {
    it('should export MCPServerV050Schema and type', () => {
      expect(mcpExports.MCPServerV050Schema).toBeDefined();

      const validServerV050 = {
        id: 'test-server-v050',
        name: 'Test Server v0.5.0',
        description: 'Test server for v0.5.0',
        version: '0.5.0',
        author: 'Test Author',
        tools: []
      };

      const parsed = mcpExports.MCPServerV050Schema.parse(validServerV050);
      expect(parsed.id).toBe('test-server-v050');
    });

    it('should export MCPInstallationV050Schema and type', () => {
      expect(mcpExports.MCPInstallationV050Schema).toBeDefined();

      const validInstallationV050 = {
        serverId: 'test-server-v050',
        installedAt: new Date(),
        config: {
          name: 'test-server',
          command: 'node',
          args: ['server.js']
        },
        status: 'installed' as const
      };

      const parsed = mcpExports.MCPInstallationV050Schema.parse(validInstallationV050);
      expect(parsed.serverId).toBe('test-server-v050');
    });

    it('should export MCPInstallProgressV050Schema and type', () => {
      expect(mcpExports.MCPInstallProgressV050Schema).toBeDefined();

      const validProgressV050 = {
        serverId: 'test-server-v050',
        stage: 'downloading' as const,
        progress: 75,
        message: 'Downloading v0.5.0 server...'
      };

      const parsed = mcpExports.MCPInstallProgressV050Schema.parse(validProgressV050);
      expect(parsed.serverId).toBe('test-server-v050');
      expect(parsed.progress).toBe(75);
    });
  });

  describe('Comprehensive export verification', () => {
    it('should export all expected MCP schemas', () => {
      const expectedSchemas = [
        'MCPConnectionConfigSchema',
        'MCPEnvironmentVarSchema',
        'MCPServerConfigSchema',
        'MCPMarketplaceEntrySchema',
        'MCPMarketplaceSourceSchema',
        'MCPMarketplaceSchema',
        'MCPToolsConfigSchema',
        'MCPConfigSchema',
        'MCPTemplateSchema',
        'MCPServerTemplateSchema', // backwards compatibility
        'MCPServerSchema',
        'MCPInstallationStatusSchema',
        'MCPInstallationSchema',
        'InstalledMCPServerSchema',
        'MCPServerCategorySchema',
        'MCPRegistryServerSchema',
        'MCPRegistryInstallConfigSchema',
        'MCPRegistryInstallationSchema',
        'MCPInstallStageSchema',
        'MCPInstallProgressSchema',
        'MCPConnectionStateSchema',
        'MCPConnectionInfoSchema',
        'MCPConnectionSchema', // backwards compatibility
        'MCPConnectionEventTypeSchema',
        'MCPConnectionEventSchema',
        'MCPToolSchemaSchema',
        'MCPToolCapabilitiesSchema',
        'MCPToolDefinitionSchema',
        'MCPToolRegistryEntrySchema',
        'MCPToolInvocationRequestSchema',
        'MCPToolResultContentTypeSchema',
        'MCPToolResultContentSchema',
        'MCPToolInvocationResponseSchema',
        'MCPServerV050Schema',
        'MCPInstallationV050Schema',
        'MCPInstallProgressV050Schema'
      ];

      expectedSchemas.forEach(schemaName => {
        expect(mcpExports[schemaName as keyof typeof mcpExports]).toBeDefined();
      });
    });

    it('should have all schemas be Zod schemas with parse method', () => {
      const schemaExports = Object.entries(mcpExports)
        .filter(([key]) => key.endsWith('Schema'))
        .map(([, value]) => value);

      schemaExports.forEach(schema => {
        expect(typeof schema.parse).toBe('function');
        expect(typeof schema.safeParse).toBe('function');
      });
    });

    it('should validate cross-schema compatibility', () => {
      // Test that related schemas work together correctly
      const serverConfig = mcpExports.MCPServerConfigSchema.parse({
        name: 'test-server',
        command: 'node',
        args: ['server.js']
      });

      const installation = mcpExports.MCPInstallationSchema.parse({
        id: 'test-installation',
        serverId: 'test-server',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/test/config.json'
      });

      const connectionInfo = mcpExports.MCPConnectionInfoSchema.parse({
        id: 'test-connection',
        serverId: installation.serverId,
        config: serverConfig,
        state: 'connected',
        connectedAt: new Date(),
        lastHeartbeat: new Date()
      });

      expect(connectionInfo.serverId).toBe(installation.serverId);
      expect(connectionInfo.config.name).toBe(serverConfig.name);
    });
  });

  describe('Error handling and validation', () => {
    it('should provide meaningful errors for invalid data', () => {
      const invalidData = {
        name: '', // Invalid empty name
        command: 123 // Invalid type
      };

      const result = mcpExports.MCPServerConfigSchema.safeParse(invalidData);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        const issues = result.error.issues;
        expect(issues.some(issue => issue.path.includes('name'))).toBe(true);
        expect(issues.some(issue => issue.path.includes('command'))).toBe(true);
      }
    });

    it('should validate enum values strictly', () => {
      const invalidStatus = 'invalid-status';
      const result = mcpExports.MCPInstallationStatusSchema.safeParse(invalidStatus);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('invalid_enum_value');
      }
    });

    it('should handle optional fields correctly', () => {
      // MCPServerConfig has optional fields that should parse correctly
      const minimalConfig = {
        name: 'minimal-server',
        command: 'node'
      };

      const parsed = mcpExports.MCPServerConfigSchema.parse(minimalConfig);
      expect(parsed.name).toBe('minimal-server');
      expect(parsed.command).toBe('node');
    });
  });
});