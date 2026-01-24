import { describe, it, expect } from 'vitest';
import {
  MCPConfigSchema,
  MCPConfig,
  MCPServerConfigSchema,
  MCPConnectionConfigSchema,
  MCPMarketplaceSourceSchema,
} from '../types.js';

/**
 * Comprehensive test suite for MCPConfig schema
 * Tests validation, edge cases, and TypeScript type inference for MCP configuration
 *
 * MCPConfig provides the main configuration structure for MCP (Model Context Protocol)
 * settings including server configurations, marketplace settings, and global connection options.
 */
describe('MCPConfig Schema Tests', () => {
  describe('Valid configurations', () => {
    it('should accept minimal configuration with all defaults', () => {
      const minimalConfig = {};

      const result = MCPConfigSchema.parse(minimalConfig);

      expect(result.enabled).toBe(true); // Default value
      expect(result.servers).toEqual({}); // Default empty object
      expect(result.marketplace).toBeUndefined();
      expect(result.connection).toBeUndefined();
    });

    it('should accept complete configuration with all fields', () => {
      const fullConfig = {
        enabled: true,
        servers: {
          'test-server-1': {
            name: 'Test Server 1',
            type: 'stdio' as const,
            command: 'npx',
            args: ['test-server-1'],
            env: { 'NODE_ENV': 'production' },
            envVars: [
              {
                name: 'API_KEY',
                description: 'API key for external service',
                required: true,
                sensitive: true,
                source: 'user' as const,
              },
            ],
            autoStart: true,
            capabilities: ['filesystem', 'network'],
            connection: {
              maxRetries: 5,
              requestTimeoutMs: 45000,
              poolSize: 2,
            },
          },
          'test-server-2': {
            name: 'Test Server 2',
            type: 'http' as const,
            url: 'https://api.example.com/mcp',
            headers: { 'Authorization': 'Bearer token' },
            autoStart: false,
            capabilities: ['api'],
          },
        },
        marketplace: {
          url: 'https://mcp-marketplace.example.com',
          enabled: true,
          refreshIntervalMinutes: 720,
          allowUnverified: false,
        },
        connection: {
          maxRetries: 3,
          requestTimeoutMs: 30000,
          poolSize: 1,
          healthCheckIntervalMs: 60000,
        },
      };

      const result = MCPConfigSchema.parse(fullConfig);

      expect(result.enabled).toBe(true);
      expect(Object.keys(result.servers)).toHaveLength(2);
      expect(result.servers['test-server-1'].name).toBe('Test Server 1');
      expect(result.servers['test-server-1'].type).toBe('stdio');
      expect(result.servers['test-server-2'].name).toBe('Test Server 2');
      expect(result.servers['test-server-2'].type).toBe('http');
      expect(result.marketplace?.url).toBe('https://mcp-marketplace.example.com');
      expect(result.marketplace?.enabled).toBe(true);
      expect(result.connection?.maxRetries).toBe(3);
      expect(result.connection?.requestTimeoutMs).toBe(30000);
    });

    it('should handle enabled flag variations', () => {
      const enabledVariations = [true, false];

      enabledVariations.forEach(enabled => {
        const config = { enabled };
        const result = MCPConfigSchema.parse(config);
        expect(result.enabled).toBe(enabled);
      });
    });

    it('should handle empty servers object', () => {
      const config = {
        enabled: true,
        servers: {},
      };

      const result = MCPConfigSchema.parse(config);
      expect(result.servers).toEqual({});
      expect(Object.keys(result.servers)).toHaveLength(0);
    });

    it('should handle multiple server configurations', () => {
      const config = {
        servers: {
          'stdio-server': {
            name: 'STDIO Server',
            type: 'stdio' as const,
            command: 'node',
            args: ['server.js'],
            autoStart: true,
          },
          'http-server': {
            name: 'HTTP Server',
            type: 'http' as const,
            url: 'http://localhost:3000/mcp',
            autoStart: false,
          },
          'sse-server': {
            name: 'SSE Server',
            type: 'sse' as const,
            url: 'http://localhost:3001/events',
            headers: { 'Accept': 'text/event-stream' },
            autoStart: true,
          },
          'sdk-server': {
            name: 'SDK Server',
            type: 'sdk' as const,
            autoStart: false,
          },
        },
      };

      const result = MCPConfigSchema.parse(config);
      expect(Object.keys(result.servers)).toHaveLength(4);
      expect(result.servers['stdio-server'].type).toBe('stdio');
      expect(result.servers['http-server'].type).toBe('http');
      expect(result.servers['sse-server'].type).toBe('sse');
      expect(result.servers['sdk-server'].type).toBe('sdk');
    });

    it('should handle various marketplace configurations', () => {
      const marketplaceConfigs = [
        {
          url: 'https://marketplace.example.com',
        },
        {
          url: 'https://custom-marketplace.org',
          enabled: false,
        },
        {
          url: 'https://dev-marketplace.localhost',
          enabled: true,
          refreshIntervalMinutes: 60,
        },
        {
          url: 'https://secure-marketplace.com',
          enabled: true,
          refreshIntervalMinutes: 2880,
          allowUnverified: true,
        },
      ];

      marketplaceConfigs.forEach(marketplace => {
        const config = { marketplace };
        const result = MCPConfigSchema.parse(config);
        expect(result.marketplace?.url).toBe(marketplace.url);
        expect(result.marketplace?.enabled).toBe(marketplace.enabled ?? true); // Default true
        expect(result.marketplace?.refreshIntervalMinutes).toBe(marketplace.refreshIntervalMinutes ?? 1440); // Default 1440
        expect(result.marketplace?.allowUnverified).toBe(marketplace.allowUnverified ?? false); // Default false
      });
    });

    it('should handle various global connection configurations', () => {
      const connectionConfigs = [
        {
          maxRetries: 0,
        },
        {
          maxRetries: 5,
          requestTimeoutMs: 60000,
        },
        {
          poolSize: 3,
          healthCheckIntervalMs: 120000,
        },
        {
          maxRetries: 2,
          requestTimeoutMs: 15000,
          poolSize: 1,
          healthCheckIntervalMs: 30000,
          heartbeatEnabled: false,
        },
      ];

      connectionConfigs.forEach(connection => {
        const config = { connection };
        const result = MCPConfigSchema.parse(config);
        expect(result.connection?.maxRetries).toBe(connection.maxRetries ?? 3); // Default 3
        expect(result.connection?.requestTimeoutMs).toBe(connection.requestTimeoutMs ?? 30000); // Default 30000
        expect(result.connection?.poolSize).toBe(connection.poolSize ?? 1); // Default 1
      });
    });

    it('should handle server-specific connection overrides', () => {
      const config = {
        connection: {
          maxRetries: 3,
          requestTimeoutMs: 30000,
          poolSize: 1,
        },
        servers: {
          'server-with-override': {
            name: 'Server with Override',
            type: 'stdio' as const,
            command: 'node',
            autoStart: false,
            connection: {
              maxRetries: 5,
              requestTimeoutMs: 60000,
              poolSize: 2,
            },
          },
          'server-without-override': {
            name: 'Server without Override',
            type: 'http' as const,
            url: 'http://localhost:3000',
            autoStart: false,
          },
        },
      };

      const result = MCPConfigSchema.parse(config);

      // Global connection config
      expect(result.connection?.maxRetries).toBe(3);
      expect(result.connection?.requestTimeoutMs).toBe(30000);

      // Server with override
      expect(result.servers['server-with-override'].connection?.maxRetries).toBe(5);
      expect(result.servers['server-with-override'].connection?.requestTimeoutMs).toBe(60000);

      // Server without override
      expect(result.servers['server-without-override'].connection).toBeUndefined();
    });
  });

  describe('Validation errors', () => {
    it('should reject invalid enabled values', () => {
      const invalidEnabledValues = [
        'true',
        'false',
        1,
        0,
        {},
        [],
        null,
      ];

      invalidEnabledValues.forEach(enabled => {
        const config = { enabled };
        expect(() => MCPConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid servers configurations', () => {
      const invalidServersConfigs = [
        { servers: 'not-an-object' },
        { servers: null },
        { servers: 123 },
        { servers: true },
      ];

      invalidServersConfigs.forEach(config => {
        expect(() => MCPConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid server configurations within servers object', () => {
      const invalidConfigs = [
        {
          servers: {
            'invalid-server': {
              // Missing required name field
              type: 'stdio',
              command: 'node',
              autoStart: false,
            },
          },
        },
        {
          servers: {
            'invalid-server': {
              name: 'Test',
              type: 'invalid-type', // Invalid type
              autoStart: false,
            },
          },
        },
        {
          servers: {
            'invalid-server': 'not-an-object', // Server config should be object
          },
        },
      ];

      invalidConfigs.forEach(config => {
        expect(() => MCPConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid marketplace configurations', () => {
      const invalidMarketplaceConfigs = [
        {
          marketplace: {
            // Missing required url field
            enabled: true,
          },
        },
        {
          marketplace: {
            url: '', // Empty URL
            enabled: true,
          },
        },
        {
          marketplace: {
            url: 'https://example.com',
            enabled: 'true', // Should be boolean
          },
        },
        {
          marketplace: {
            url: 'https://example.com',
            refreshIntervalMinutes: 0, // Should be >= 1
          },
        },
        {
          marketplace: {
            url: 'https://example.com',
            allowUnverified: 'false', // Should be boolean
          },
        },
        {
          marketplace: 'not-an-object',
        },
      ];

      invalidMarketplaceConfigs.forEach(config => {
        expect(() => MCPConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid connection configurations', () => {
      const invalidConnectionConfigs = [
        {
          connection: {
            maxRetries: -1, // Should be >= 0
          },
        },
        {
          connection: {
            requestTimeoutMs: -1, // Should be >= 0
          },
        },
        {
          connection: {
            poolSize: 0, // Should be >= 1
          },
        },
        {
          connection: 'not-an-object',
        },
      ];

      invalidConnectionConfigs.forEach(config => {
        expect(() => MCPConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject configurations with invalid nested schemas', () => {
      const invalidNestedConfigs = [
        {
          servers: {
            'test-server': {
              name: 'Test',
              type: 'stdio',
              command: 'node',
              autoStart: false,
              envVars: [
                {
                  // Missing required name field in envVar
                  description: 'Test var',
                  required: true,
                },
              ],
            },
          },
        },
        {
          servers: {
            'test-server': {
              name: 'Test',
              type: 'stdio',
              command: 'node',
              autoStart: false,
              connection: {
                maxRetries: -5, // Invalid connection config
              },
            },
          },
        },
      ];

      invalidNestedConfigs.forEach(config => {
        expect(() => MCPConfigSchema.parse(config)).toThrow();
      });
    });
  });

  describe('TypeScript type inference', () => {
    it('should provide correct TypeScript types', () => {
      const config = MCPConfigSchema.parse({
        enabled: true,
        servers: {
          'type-test-server': {
            name: 'Type Test Server',
            type: 'stdio',
            command: 'node',
            args: ['server.js'],
            autoStart: true,
            capabilities: ['filesystem'],
            connection: {
              maxRetries: 3,
              requestTimeoutMs: 30000,
            },
          },
        },
        marketplace: {
          url: 'https://marketplace.example.com',
          enabled: true,
          refreshIntervalMinutes: 1440,
        },
        connection: {
          maxRetries: 2,
          requestTimeoutMs: 20000,
          poolSize: 1,
        },
      });

      // Type assertions to ensure TypeScript compilation
      const enabled: boolean = config.enabled;
      const servers: Record<string, any> = config.servers;
      const marketplace: any | undefined = config.marketplace;
      const connection: any | undefined = config.connection;

      expect(typeof enabled).toBe('boolean');
      expect(typeof servers).toBe('object');
      expect(typeof marketplace).toBe('object');
      expect(typeof connection).toBe('object');

      expect(enabled).toBe(true);
      expect(servers['type-test-server'].name).toBe('Type Test Server');
      expect(marketplace?.url).toBe('https://marketplace.example.com');
      expect(connection?.maxRetries).toBe(2);
    });

    it('should handle optional fields correctly in TypeScript', () => {
      const config: MCPConfig = {
        enabled: true,
        servers: {},
      };

      expect(config.enabled).toBe(true);
      expect(config.servers).toEqual({});
      expect(config.marketplace).toBeUndefined();
      expect(config.connection).toBeUndefined();
    });
  });

  describe('Real-world configuration scenarios', () => {
    it('should handle development environment configuration', () => {
      const devConfig = {
        enabled: true,
        servers: {
          'filesystem-server': {
            name: 'Filesystem MCP Server',
            type: 'stdio' as const,
            command: 'npx',
            args: ['@mcp/filesystem-server'],
            envVars: [
              {
                name: 'WORKSPACE_DIR',
                description: 'Workspace directory path',
                required: true,
                sensitive: false,
                defaultValue: '/workspace',
                source: 'config' as const,
              },
            ],
            autoStart: true,
            capabilities: ['filesystem'],
          },
          'api-server': {
            name: 'API MCP Server',
            type: 'http' as const,
            url: 'http://localhost:3001/mcp',
            headers: { 'Content-Type': 'application/json' },
            autoStart: false,
            capabilities: ['api', 'network'],
          },
        },
        marketplace: {
          url: 'https://mcp-marketplace.dev',
          enabled: true,
          refreshIntervalMinutes: 60,
          allowUnverified: true,
        },
        connection: {
          maxRetries: 5,
          requestTimeoutMs: 45000,
          poolSize: 2,
          healthCheckIntervalMs: 30000,
          heartbeatEnabled: true,
        },
      };

      const result = MCPConfigSchema.parse(devConfig);

      expect(result.enabled).toBe(true);
      expect(Object.keys(result.servers)).toHaveLength(2);
      expect(result.servers['filesystem-server'].envVars).toHaveLength(1);
      expect(result.servers['filesystem-server'].envVars![0].name).toBe('WORKSPACE_DIR');
      expect(result.servers['api-server'].type).toBe('http');
      expect(result.marketplace?.allowUnverified).toBe(true);
      expect(result.connection?.heartbeatEnabled).toBe(true);
    });

    it('should handle production environment configuration', () => {
      const prodConfig = {
        enabled: true,
        servers: {
          'secure-api-server': {
            name: 'Secure API MCP Server',
            type: 'http' as const,
            url: 'https://secure-api.company.com/mcp',
            headers: {
              'Authorization': 'Bearer production-token',
              'X-API-Version': 'v1',
            },
            envVars: [
              {
                name: 'API_TOKEN',
                description: 'Production API authentication token',
                required: true,
                sensitive: true,
                source: 'user' as const,
              },
              {
                name: 'LOG_LEVEL',
                description: 'Application logging level',
                required: false,
                sensitive: false,
                defaultValue: 'error',
                source: 'default' as const,
              },
            ],
            autoStart: true,
            capabilities: ['api', 'secure'],
            connection: {
              maxRetries: 3,
              requestTimeoutMs: 60000,
              poolSize: 1,
              healthCheckIntervalMs: 120000,
              heartbeatEnabled: true,
            },
          },
        },
        marketplace: {
          url: 'https://verified-mcp-marketplace.com',
          enabled: true,
          refreshIntervalMinutes: 2880, // 48 hours
          allowUnverified: false,
        },
        connection: {
          maxRetries: 2,
          requestTimeoutMs: 30000,
          poolSize: 1,
          healthCheckIntervalMs: 60000,
          heartbeatEnabled: true,
        },
      };

      const result = MCPConfigSchema.parse(prodConfig);

      expect(result.enabled).toBe(true);
      expect(result.servers['secure-api-server'].envVars).toHaveLength(2);
      expect(result.servers['secure-api-server'].envVars![0].sensitive).toBe(true);
      expect(result.servers['secure-api-server'].connection?.requestTimeoutMs).toBe(60000);
      expect(result.marketplace?.allowUnverified).toBe(false);
      expect(result.marketplace?.refreshIntervalMinutes).toBe(2880);
    });

    it('should handle minimal deployment configuration', () => {
      const minimalConfig = {
        enabled: true,
        servers: {
          'simple-server': {
            name: 'Simple MCP Server',
            type: 'stdio' as const,
            command: 'node',
            args: ['simple-server.js'],
            autoStart: true,
          },
        },
      };

      const result = MCPConfigSchema.parse(minimalConfig);

      expect(result.enabled).toBe(true);
      expect(Object.keys(result.servers)).toHaveLength(1);
      expect(result.servers['simple-server'].name).toBe('Simple MCP Server');
      expect(result.servers['simple-server'].autoStart).toBe(true);
      expect(result.marketplace).toBeUndefined();
      expect(result.connection).toBeUndefined();
    });

    it('should handle multi-environment server configurations', () => {
      const multiEnvConfig = {
        enabled: true,
        servers: {
          'dev-server': {
            name: 'Development Server',
            type: 'stdio' as const,
            command: 'npm',
            args: ['run', 'dev'],
            env: { 'NODE_ENV': 'development' },
            autoStart: true,
            connection: {
              maxRetries: 10,
              requestTimeoutMs: 5000,
            },
          },
          'test-server': {
            name: 'Test Server',
            type: 'http' as const,
            url: 'http://test-server:3000/mcp',
            autoStart: false,
            connection: {
              maxRetries: 5,
              requestTimeoutMs: 15000,
            },
          },
          'prod-server': {
            name: 'Production Server',
            type: 'http' as const,
            url: 'https://prod-server.company.com/mcp',
            headers: { 'X-Environment': 'production' },
            autoStart: false,
            connection: {
              maxRetries: 2,
              requestTimeoutMs: 30000,
              poolSize: 1,
            },
          },
        },
        connection: {
          maxRetries: 3,
          requestTimeoutMs: 20000,
          poolSize: 1,
        },
      };

      const result = MCPConfigSchema.parse(multiEnvConfig);

      expect(Object.keys(result.servers)).toHaveLength(3);
      expect(result.servers['dev-server'].env).toEqual({ 'NODE_ENV': 'development' });
      expect(result.servers['dev-server'].connection?.maxRetries).toBe(10);
      expect(result.servers['test-server'].connection?.maxRetries).toBe(5);
      expect(result.servers['prod-server'].connection?.maxRetries).toBe(2);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle very long server names and identifiers', () => {
      const longId = 'very-long-server-identifier-'.repeat(10);
      const longName = 'Very-Long-Server-Name-'.repeat(20) + 'End';

      const config = {
        servers: {
          [longId]: {
            name: longName,
            type: 'stdio' as const,
            command: 'node',
            autoStart: false,
          },
        },
      };

      const result = MCPConfigSchema.parse(config);
      expect(result.servers[longId].name).toBe(longName);
    });

    it('should handle special characters in server identifiers', () => {
      const specialIds = [
        'server-with-dashes',
        'server_with_underscores',
        'server123with456numbers',
        'server.with.dots',
      ];

      specialIds.forEach(id => {
        const config = {
          servers: {
            [id]: {
              name: `Server ${id}`,
              type: 'stdio' as const,
              command: 'node',
              autoStart: false,
            },
          },
        };

        expect(() => MCPConfigSchema.parse(config)).not.toThrow();
        const result = MCPConfigSchema.parse(config);
        expect(result.servers[id].name).toBe(`Server ${id}`);
      });
    });

    it('should handle Unicode characters in server configurations', () => {
      const unicodeConfig = {
        servers: {
          'unicode-server': {
            name: 'Unicode Server тест 서버 测试 🚀',
            type: 'stdio' as const,
            command: 'node',
            args: ['--config', '/path/with/unicode/тест/서버/测试🚀'],
            autoStart: false,
          },
        },
      };

      const result = MCPConfigSchema.parse(unicodeConfig);
      expect(result.servers['unicode-server'].name).toBe('Unicode Server тест 서버 测试 🚀');
      expect(result.servers['unicode-server'].args![1]).toBe('/path/with/unicode/тест/서버/测试🚀');
    });

    it('should handle extreme timeout and retry values within valid ranges', () => {
      const extremeConfig = {
        connection: {
          maxRetries: 0, // Minimum
          requestTimeoutMs: 1, // Very small
          poolSize: 100, // Maximum
          healthCheckIntervalMs: 5000, // Minimum
        },
        servers: {
          'extreme-server': {
            name: 'Extreme Server',
            type: 'stdio' as const,
            command: 'node',
            autoStart: false,
            connection: {
              maxRetries: 100, // Maximum
              requestTimeoutMs: 3600000, // 1 hour
              poolSize: 1, // Minimum
            },
          },
        },
      };

      const result = MCPConfigSchema.parse(extremeConfig);
      expect(result.connection?.maxRetries).toBe(0);
      expect(result.connection?.requestTimeoutMs).toBe(1);
      expect(result.connection?.poolSize).toBe(100);
      expect(result.servers['extreme-server'].connection?.maxRetries).toBe(100);
      expect(result.servers['extreme-server'].connection?.requestTimeoutMs).toBe(3600000);
    });

    it('should handle large numbers of servers', () => {
      const manyServers: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        manyServers[`server-${i}`] = {
          name: `Server ${i}`,
          type: 'stdio',
          command: 'node',
          args: [`server-${i}.js`],
          autoStart: i % 2 === 0, // Alternate autoStart
        };
      }

      const config = { servers: manyServers };
      const result = MCPConfigSchema.parse(config);

      expect(Object.keys(result.servers)).toHaveLength(100);
      expect(result.servers['server-0'].autoStart).toBe(true);
      expect(result.servers['server-1'].autoStart).toBe(false);
      expect(result.servers['server-99'].autoStart).toBe(false);
    });
  });

  describe('Integration with other schemas', () => {
    it('should properly validate nested server configurations', () => {
      const config = {
        servers: {
          'nested-test': {
            name: 'Nested Test Server',
            type: 'stdio' as const,
            command: 'npx',
            args: ['nested-test-server', '--verbose'],
            env: { 'DEBUG': '*' },
            envVars: [
              {
                name: 'NESTED_API_KEY',
                description: 'API key for nested service',
                required: true,
                sensitive: true,
                source: 'user' as const,
              },
              {
                name: 'NESTED_PORT',
                description: 'Port for nested service',
                required: false,
                sensitive: false,
                defaultValue: '8080',
                source: 'default' as const,
              },
            ],
            url: undefined, // Optional field not used for stdio
            headers: undefined, // Optional field not used for stdio
            autoStart: true,
            capabilities: ['nested', 'test'],
            connection: {
              maxRetries: 3,
              requestTimeoutMs: 30000,
              connectionTimeoutMs: 5000,
              readTimeoutMs: 120000,
              poolSize: 1,
              healthCheckIntervalMs: 30000,
              heartbeatEnabled: true,
            },
          },
        },
      };

      const result = MCPConfigSchema.parse(config);

      expect(result.servers['nested-test'].envVars).toHaveLength(2);
      expect(result.servers['nested-test'].envVars![0].name).toBe('NESTED_API_KEY');
      expect(result.servers['nested-test'].envVars![0].sensitive).toBe(true);
      expect(result.servers['nested-test'].envVars![1].name).toBe('NESTED_PORT');
      expect(result.servers['nested-test'].envVars![1].defaultValue).toBe('8080');
      expect(result.servers['nested-test'].connection?.heartbeatEnabled).toBe(true);
    });

    it('should maintain data consistency across parsing cycles', () => {
      const originalConfig = {
        enabled: true,
        servers: {
          'cycle-test': {
            name: 'Cycle Test Server',
            type: 'http' as const,
            url: 'http://localhost:3000',
            autoStart: true,
          },
        },
        marketplace: {
          url: 'https://marketplace.test',
          enabled: true,
        },
        connection: {
          maxRetries: 2,
          requestTimeoutMs: 25000,
        },
      };

      // Parse multiple times to ensure consistency
      let currentConfig = originalConfig;
      for (let i = 0; i < 5; i++) {
        const parsed = MCPConfigSchema.parse(currentConfig);
        expect(parsed.enabled).toBe(originalConfig.enabled);
        expect(parsed.servers['cycle-test'].name).toBe('Cycle Test Server');
        expect(parsed.marketplace?.url).toBe('https://marketplace.test');
        expect(parsed.connection?.maxRetries).toBe(2);
        currentConfig = parsed;
      }
    });
  });
});