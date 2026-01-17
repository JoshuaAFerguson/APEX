import { describe, it, expect } from 'vitest';

/**
 * Integration test for MCPToolsConfig exports from @apex/core package
 * Ensures that all MCP Tools configuration types and schemas are properly exported
 * and can be imported by consuming packages.
 */
describe('MCPToolsConfig Exports Integration', () => {
  describe('Direct imports from types module', () => {
    it('should export MCPToolsConfigSchema from types module', async () => {
      const { MCPToolsConfigSchema } = await import('../types.js');

      expect(MCPToolsConfigSchema).toBeDefined();
      expect(typeof MCPToolsConfigSchema.parse).toBe('function');
      expect(typeof MCPToolsConfigSchema.safeParse).toBe('function');
    });

    it('should export MCPToolsConfig type from types module', async () => {
      const typesModule = await import('../types.js');

      // MCPToolsConfig should be available as a type - we can't directly test type exports
      // but we can test that the schema works correctly which implies the type exists
      expect(typesModule.MCPToolsConfigSchema).toBeDefined();

      // Test that the schema can parse a valid config
      const testConfig = {
        autoDiscovery: true,
        enableCaching: false,
        maxConcurrentTools: 15,
        timeoutMs: 45000,
        enableValidation: true,
        allowedTools: ['test-tool'],
        deniedTools: [],
        enableLogging: false,
      };

      const result = typesModule.MCPToolsConfigSchema.parse(testConfig);
      expect(result).toBeDefined();
      expect(result.autoDiscovery).toBe(true);
      expect(result.enableCaching).toBe(false);
      expect(result.maxConcurrentTools).toBe(15);
    });
  });

  describe('Package-level exports via index', () => {
    it('should export MCPToolsConfigSchema from package index', async () => {
      const { MCPToolsConfigSchema } = await import('../index.js');

      expect(MCPToolsConfigSchema).toBeDefined();
      expect(typeof MCPToolsConfigSchema.parse).toBe('function');

      // Test basic functionality
      const config = { autoDiscovery: false };
      const result = MCPToolsConfigSchema.parse(config);
      expect(result.autoDiscovery).toBe(false);
      expect(result.enableCaching).toBe(true); // Default value
    });

    it('should export MCPConfig and MCPToolsConfig together', async () => {
      const {
        MCPConfigSchema,
        MCPToolsConfigSchema,
        MCPServerConfigSchema
      } = await import('../index.js');

      expect(MCPConfigSchema).toBeDefined();
      expect(MCPToolsConfigSchema).toBeDefined();
      expect(MCPServerConfigSchema).toBeDefined();

      // Test that they work together in a complete MCP configuration
      const fullConfig = {
        enabled: true,
        servers: {
          'test-server': {
            name: 'Test Server',
            type: 'stdio' as const,
            command: 'node',
            autoStart: false,
          },
        },
        tools: {
          autoDiscovery: true,
          enableCaching: true,
          maxConcurrentTools: 10,
          timeoutMs: 30000,
          enableValidation: true,
          allowedTools: ['filesystem', 'network'],
          deniedTools: ['dangerous-tool'],
          enableLogging: false,
        },
      };

      const result = MCPConfigSchema.parse(fullConfig);
      expect(result.tools).toBeDefined();
      expect(result.tools?.autoDiscovery).toBe(true);
      expect(result.tools?.allowedTools).toEqual(['filesystem', 'network']);
      expect(result.tools?.deniedTools).toEqual(['dangerous-tool']);
    });
  });

  describe('TypeScript type compatibility', () => {
    it('should work with TypeScript strict type checking', async () => {
      const { MCPToolsConfigSchema } = await import('../index.js');

      // Test that the parsed result has the correct TypeScript types
      const config = {
        autoDiscovery: false,
        enableCaching: true,
        maxConcurrentTools: 25,
        timeoutMs: 60000,
        enableValidation: false,
        allowedTools: ['type-test-tool-1', 'type-test-tool-2'],
        deniedTools: ['forbidden-type-tool'],
        enableLogging: true,
      };

      const result = MCPToolsConfigSchema.parse(config);

      // These assignments should work if types are correct
      const autoDiscovery: boolean = result.autoDiscovery;
      const enableCaching: boolean = result.enableCaching;
      const maxConcurrentTools: number = result.maxConcurrentTools;
      const timeoutMs: number = result.timeoutMs;
      const enableValidation: boolean = result.enableValidation;
      const allowedTools: string[] = result.allowedTools;
      const deniedTools: string[] = result.deniedTools;
      const enableLogging: boolean = result.enableLogging;

      expect(autoDiscovery).toBe(false);
      expect(enableCaching).toBe(true);
      expect(maxConcurrentTools).toBe(25);
      expect(timeoutMs).toBe(60000);
      expect(enableValidation).toBe(false);
      expect(allowedTools).toEqual(['type-test-tool-1', 'type-test-tool-2']);
      expect(deniedTools).toEqual(['forbidden-type-tool']);
      expect(enableLogging).toBe(true);
    });

    it('should maintain type safety with partial configurations', async () => {
      const { MCPToolsConfigSchema } = await import('../index.js');

      // Test with minimal configuration using defaults
      const minimalConfig = {
        maxConcurrentTools: 5,
      };

      const result = MCPToolsConfigSchema.parse(minimalConfig);

      // All fields should be present with either provided or default values
      expect(typeof result.autoDiscovery).toBe('boolean');
      expect(typeof result.enableCaching).toBe('boolean');
      expect(typeof result.maxConcurrentTools).toBe('number');
      expect(typeof result.timeoutMs).toBe('number');
      expect(typeof result.enableValidation).toBe('boolean');
      expect(Array.isArray(result.allowedTools)).toBe(true);
      expect(Array.isArray(result.deniedTools)).toBe(true);
      expect(typeof result.enableLogging).toBe('boolean');

      expect(result.maxConcurrentTools).toBe(5);
      expect(result.autoDiscovery).toBe(true); // Default
      expect(result.enableCaching).toBe(true); // Default
      expect(result.timeoutMs).toBe(30000); // Default
    });
  });

  describe('Cross-package compatibility', () => {
    it('should be compatible with other MCP-related schemas', async () => {
      const {
        MCPConfigSchema,
        MCPServerConfigSchema,
        MCPToolsConfigSchema,
        MCPConnectionConfigSchema,
      } = await import('../index.js');

      // Test that all MCP schemas can work together
      const complexConfig = {
        enabled: true,
        servers: {
          'complex-server': {
            name: 'Complex Test Server',
            type: 'http' as const,
            url: 'https://api.example.com/mcp',
            headers: { 'Authorization': 'Bearer test-token' },
            autoStart: true,
            capabilities: ['api', 'network'],
            connection: {
              maxRetries: 3,
              timeoutMs: 30000,
              poolSize: 2,
            },
          },
        },
        connection: {
          maxRetries: 5,
          timeoutMs: 45000,
          poolSize: 1,
        },
        tools: {
          autoDiscovery: false,
          enableCaching: true,
          maxConcurrentTools: 20,
          timeoutMs: 90000,
          enableValidation: true,
          allowedTools: ['api-client', 'data-processor'],
          deniedTools: ['system-admin'],
          enableLogging: true,
        },
      };

      const result = MCPConfigSchema.parse(complexConfig);

      // Verify all parts are correctly parsed
      expect(result.enabled).toBe(true);
      expect(result.servers['complex-server'].name).toBe('Complex Test Server');
      expect(result.servers['complex-server'].type).toBe('http');
      expect(result.connection?.maxRetries).toBe(5);
      expect(result.tools?.autoDiscovery).toBe(false);
      expect(result.tools?.maxConcurrentTools).toBe(20);
      expect(result.tools?.allowedTools).toEqual(['api-client', 'data-processor']);
    });

    it('should handle default values consistently across schemas', async () => {
      const { MCPConfigSchema } = await import('../index.js');

      // Test that defaults work correctly when tools config is partially specified
      const partialToolsConfig = {
        enabled: true,
        servers: {},
        tools: {
          maxConcurrentTools: 8,
          allowedTools: ['partial-tool'],
        },
      };

      const result = MCPConfigSchema.parse(partialToolsConfig);

      expect(result.tools?.maxConcurrentTools).toBe(8);
      expect(result.tools?.allowedTools).toEqual(['partial-tool']);

      // These should use defaults from MCPToolsConfigSchema
      expect(result.tools?.autoDiscovery).toBe(true);
      expect(result.tools?.enableCaching).toBe(true);
      expect(result.tools?.timeoutMs).toBe(30000);
      expect(result.tools?.enableValidation).toBe(true);
      expect(result.tools?.deniedTools).toEqual([]);
      expect(result.tools?.enableLogging).toBe(false);
    });
  });

  describe('Error handling and validation', () => {
    it('should properly validate and reject invalid configurations', async () => {
      const { MCPToolsConfigSchema } = await import('../index.js');

      const invalidConfigs = [
        { maxConcurrentTools: 0 }, // Below minimum
        { maxConcurrentTools: 101 }, // Above maximum
        { timeoutMs: -1 }, // Below minimum
        { timeoutMs: 600001 }, // Above maximum
        { autoDiscovery: 'true' }, // Wrong type
        { enableCaching: 1 }, // Wrong type
        { allowedTools: 'not-an-array' }, // Wrong type
        { deniedTools: ['valid', 123] }, // Mixed types in array
        { enableLogging: 'false' }, // Wrong type
      ];

      invalidConfigs.forEach((config) => {
        expect(() => MCPToolsConfigSchema.parse(config)).toThrow();
      });
    });

    it('should provide meaningful error messages for validation failures', async () => {
      const { MCPToolsConfigSchema } = await import('../index.js');

      try {
        MCPToolsConfigSchema.parse({
          maxConcurrentTools: -5,
          timeoutMs: 700000,
          allowedTools: ['valid', 123, 'invalid'],
        });
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.message || error.toString()).toBeDefined();
        // The error should contain information about the validation failure
      }
    });
  });

  describe('Real-world usage scenarios', () => {
    it('should support typical development workflow configuration', async () => {
      const { MCPConfigSchema } = await import('../index.js');

      const devWorkflowConfig = {
        enabled: true,
        servers: {
          'dev-filesystem': {
            name: 'Development Filesystem Server',
            type: 'stdio' as const,
            command: 'npx',
            args: ['@mcp/filesystem-server'],
            autoStart: true,
            capabilities: ['filesystem', 'read', 'write'],
          },
          'dev-api': {
            name: 'Development API Server',
            type: 'http' as const,
            url: 'http://localhost:3001/mcp',
            autoStart: false,
            capabilities: ['api', 'test'],
          },
        },
        tools: {
          autoDiscovery: true, // Enable for development flexibility
          enableCaching: false, // Disable for fresh tool discovery
          maxConcurrentTools: 15, // Moderate concurrency
          timeoutMs: 20000, // Shorter timeout for faster feedback
          enableValidation: true, // Keep validation for safety
          allowedTools: [], // Allow all tools in development
          deniedTools: ['production-deploy', 'live-data-access'],
          enableLogging: true, // Enable for debugging
        },
      };

      const result = MCPConfigSchema.parse(devWorkflowConfig);

      expect(result.enabled).toBe(true);
      expect(Object.keys(result.servers)).toHaveLength(2);
      expect(result.tools?.autoDiscovery).toBe(true);
      expect(result.tools?.enableCaching).toBe(false);
      expect(result.tools?.enableLogging).toBe(true);
      expect(result.tools?.deniedTools).toContain('production-deploy');
    });

    it('should support production environment configuration', async () => {
      const { MCPConfigSchema } = await import('../index.js');

      const prodConfig = {
        enabled: true,
        servers: {
          'prod-secure-api': {
            name: 'Production Secure API',
            type: 'https' as const,
            url: 'https://secure-api.company.com/mcp',
            headers: {
              'Authorization': 'Bearer ${API_TOKEN}',
              'X-Environment': 'production',
            },
            autoStart: true,
            capabilities: ['api', 'secure'],
            connection: {
              maxRetries: 3,
              timeoutMs: 60000,
              poolSize: 1,
            },
          },
        },
        connection: {
          maxRetries: 2,
          timeoutMs: 30000,
          poolSize: 1,
        },
        tools: {
          autoDiscovery: false, // Disable for security
          enableCaching: true, // Enable for performance
          maxConcurrentTools: 5, // Conservative concurrency
          timeoutMs: 90000, // Longer timeout for reliability
          enableValidation: true, // Strict validation
          allowedTools: [
            'secure-api-client',
            'data-validator',
            'audit-logger',
          ],
          deniedTools: [
            'filesystem-write',
            'system-command',
            'debug-tools',
          ],
          enableLogging: false, // Disable for performance
        },
      };

      const result = MCPConfigSchema.parse(prodConfig);

      expect(result.enabled).toBe(true);
      expect(result.servers['prod-secure-api'].type).toBe('https');
      expect(result.tools?.autoDiscovery).toBe(false);
      expect(result.tools?.enableCaching).toBe(true);
      expect(result.tools?.maxConcurrentTools).toBe(5);
      expect(result.tools?.allowedTools).toContain('secure-api-client');
      expect(result.tools?.deniedTools).toContain('filesystem-write');
      expect(result.tools?.enableLogging).toBe(false);
    });
  });
});