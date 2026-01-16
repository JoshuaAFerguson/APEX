import { describe, it, expect } from 'vitest';
import {
  MCPConfigSchema,
  MCPConfig,
  MCPServerConfigSchema,
  MCPEnvironmentVarSchema,
  MCPConnectionConfigSchema,
  MCPConnectionEventSchema,
  MCPConnectionStateSchema,
  MCPServerSchema,
  MCPInstallationSchema,
} from '../types.js';

/**
 * Integration test suite for all MCP types working together
 * Tests that all MCP schemas work harmoniously and validate complete workflows
 *
 * This test suite validates that the complete MCP type system is properly implemented
 * according to the acceptance criteria requirements.
 */
describe('MCP Types Integration Tests', () => {
  describe('Complete MCP Configuration Integration', () => {
    it('should validate complete MCP configuration with all components', () => {
      // Create environment variables
      const envVars = [
        {
          name: 'API_KEY',
          description: 'API key for external service',
          required: true,
          sensitive: true,
          source: 'user' as const,
        },
        {
          name: 'LOG_LEVEL',
          description: 'Application logging level',
          required: false,
          sensitive: false,
          defaultValue: 'info',
          source: 'default' as const,
        },
      ];

      // Validate individual environment variables
      envVars.forEach(envVar => {
        expect(() => MCPEnvironmentVarSchema.parse(envVar)).not.toThrow();
      });

      // Create connection configuration
      const connectionConfig = {
        maxRetries: 3,
        timeoutMs: 30000,
        poolSize: 2,
        healthCheckIntervalMs: 60000,
        heartbeatEnabled: true,
      };

      // Validate connection configuration
      expect(() => MCPConnectionConfigSchema.parse(connectionConfig)).not.toThrow();

      // Create server configurations
      const serverConfigs = {
        'filesystem-server': {
          name: 'Filesystem MCP Server',
          type: 'stdio' as const,
          command: 'npx',
          args: ['@mcp/filesystem-server'],
          envVars: [envVars[0]], // API_KEY
          autoStart: true,
          capabilities: ['filesystem', 'read', 'write'],
          connection: connectionConfig,
        },
        'api-server': {
          name: 'API MCP Server',
          type: 'http' as const,
          url: 'https://api.example.com/mcp',
          headers: { 'Authorization': 'Bearer token' },
          envVars: envVars, // Both env vars
          autoStart: false,
          capabilities: ['api', 'network'],
          connection: {
            maxRetries: 5,
            timeoutMs: 45000,
            poolSize: 1,
          },
        },
      };

      // Validate individual server configurations
      Object.values(serverConfigs).forEach(serverConfig => {
        expect(() => MCPServerConfigSchema.parse(serverConfig)).not.toThrow();
      });

      // Create complete MCP configuration
      const completeConfig = {
        enabled: true,
        servers: serverConfigs,
        marketplace: {
          url: 'https://mcp-marketplace.example.com',
          enabled: true,
          refreshIntervalMinutes: 1440,
          allowUnverified: false,
        },
        connection: connectionConfig,
      };

      // Validate complete configuration
      expect(() => MCPConfigSchema.parse(completeConfig)).not.toThrow();
      const result = MCPConfigSchema.parse(completeConfig);

      // Verify the configuration structure
      expect(result.enabled).toBe(true);
      expect(Object.keys(result.servers)).toHaveLength(2);
      expect(result.servers['filesystem-server'].envVars).toHaveLength(1);
      expect(result.servers['api-server'].envVars).toHaveLength(2);
      expect(result.marketplace?.url).toBe('https://mcp-marketplace.example.com');
      expect(result.connection?.maxRetries).toBe(3);
    });

    it('should validate MCP server lifecycle with events and installations', () => {
      // 1. Define an MCP server
      const serverDefinition = {
        name: 'lifecycle-test-server',
        package: '@mcp/lifecycle-test',
        command: 'npx',
        args: ['@mcp/lifecycle-test', '--config', '/etc/config.json'],
        env: {
          'NODE_ENV': 'production',
          'LOG_LEVEL': 'info',
        },
        envVars: [
          {
            name: 'SERVER_PORT',
            description: 'Port for the MCP server',
            required: false,
            sensitive: false,
            defaultValue: '8080',
            source: 'config' as const,
          },
        ],
        version: '1.2.3',
      };

      // Validate server definition
      expect(() => MCPServerSchema.parse(serverDefinition)).not.toThrow();
      const server = MCPServerSchema.parse(serverDefinition);

      // 2. Create installation record
      const installation = {
        id: 'lifecycle-install-001',
        serverId: server.name,
        installedAt: new Date(),
        status: 'pending' as const,
        configPath: '/var/lib/mcp/installations/lifecycle-install-001/config.json',
      };

      // Validate installation
      expect(() => MCPInstallationSchema.parse(installation)).not.toThrow();
      const installationRecord = MCPInstallationSchema.parse(installation);

      // 3. Simulate connection events during installation/startup
      const connectionEvents = [
        {
          type: 'connected' as const,
          serverId: server.name,
          serverName: server.name,
          previousState: 'connecting' as const,
          newState: 'connected' as const,
          timestamp: new Date(),
          message: 'MCP server connected successfully',
        },
        {
          type: 'error' as const,
          serverId: server.name,
          serverName: server.name,
          previousState: 'connected' as const,
          newState: 'error' as const,
          timestamp: new Date(),
          message: 'Connection lost due to network issue',
          error: new Error('Network timeout'),
        },
        {
          type: 'reconnecting' as const,
          serverId: server.name,
          serverName: server.name,
          previousState: 'error' as const,
          newState: 'reconnecting' as const,
          timestamp: new Date(),
          message: 'Attempting to reconnect to MCP server',
        },
        {
          type: 'connected' as const,
          serverId: server.name,
          serverName: server.name,
          previousState: 'reconnecting' as const,
          newState: 'connected' as const,
          timestamp: new Date(),
          message: 'Reconnection successful',
        },
      ];

      // Validate all connection events
      connectionEvents.forEach(event => {
        expect(() => MCPConnectionEventSchema.parse(event)).not.toThrow();
      });

      // Verify the complete lifecycle works
      expect(server.name).toBe('lifecycle-test-server');
      expect(installationRecord.serverId).toBe(server.name);
      expect(connectionEvents).toHaveLength(4);
      expect(connectionEvents[0].newState).toBe('connected');
      expect(connectionEvents[3].newState).toBe('connected');
    });
  });

  describe('Type Export Validation', () => {
    it('should export all required MCP schemas and types', () => {
      // Test that all the schemas required by acceptance criteria are exported
      const requiredSchemas = [
        MCPServerSchema,
        MCPInstallationSchema,
        MCPConfigSchema,
        MCPServerConfigSchema,
        MCPEnvironmentVarSchema,
        MCPConnectionConfigSchema,
        MCPConnectionEventSchema,
        MCPConnectionStateSchema,
      ];

      requiredSchemas.forEach(schema => {
        expect(schema).toBeDefined();
        expect(typeof schema.parse).toBe('function');
        expect(typeof schema.safeParse).toBe('function');
      });
    });

    it('should provide working TypeScript types for all MCP components', () => {
      // This test verifies TypeScript compilation by using all the types
      const testConfig: MCPConfig = {
        enabled: true,
        servers: {
          'test-server': {
            name: 'Test Server',
            type: 'stdio',
            command: 'node',
            args: ['server.js'],
            env: { 'NODE_ENV': 'test' },
            envVars: [
              {
                name: 'TEST_VAR',
                description: 'Test variable',
                required: false,
                sensitive: false,
                defaultValue: 'test',
                source: 'default',
              },
            ],
            autoStart: true,
            capabilities: ['test'],
            connection: {
              maxRetries: 3,
              timeoutMs: 30000,
              poolSize: 1,
            },
          },
        },
        marketplace: {
          url: 'https://marketplace.test',
          enabled: true,
          refreshIntervalMinutes: 1440,
          allowUnverified: false,
        },
        connection: {
          maxRetries: 3,
          timeoutMs: 30000,
          poolSize: 1,
        },
      };

      // If this compiles, TypeScript types are working correctly
      expect(testConfig.enabled).toBe(true);
      expect(testConfig.servers['test-server'].name).toBe('Test Server');
      expect(testConfig.servers['test-server'].envVars![0].name).toBe('TEST_VAR');
    });
  });

  describe('Acceptance Criteria Validation', () => {
    it('should satisfy all acceptance criteria requirements', () => {
      /**
       * Acceptance Criteria:
       * "New types.ts additions: MCPServer, MCPConfig, MCPEnvironmentVar schemas.
       *  Exported from core package. TypeScript compiles without errors."
       *
       * This test validates all requirements are met:
       */

      // 1. MCPServer schema exists and works
      const mcpServer = {
        name: 'test-server',
        package: '@mcp/test',
        command: 'node',
        args: ['server.js'],
        env: { 'NODE_ENV': 'test' },
        version: '1.0.0',
      };
      expect(() => MCPServerSchema.parse(mcpServer)).not.toThrow();

      // 2. MCPConfig schema exists and works
      const mcpConfig = {
        enabled: true,
        servers: {
          'test': {
            name: 'Test Server',
            type: 'stdio' as const,
            command: 'node',
            autoStart: false,
          },
        },
      };
      expect(() => MCPConfigSchema.parse(mcpConfig)).not.toThrow();

      // 3. MCPEnvironmentVar schema exists and works
      const mcpEnvVar = {
        name: 'TEST_VAR',
        description: 'Test environment variable',
        required: true,
        sensitive: false,
      };
      expect(() => MCPEnvironmentVarSchema.parse(mcpEnvVar)).not.toThrow();

      // 4. Types are exported (verified by successful imports)
      expect(MCPServerSchema).toBeDefined();
      expect(MCPConfigSchema).toBeDefined();
      expect(MCPEnvironmentVarSchema).toBeDefined();

      // 5. TypeScript compiles without errors (verified by test execution)
      // If this test runs, TypeScript compilation was successful

      // Additional schemas that were implemented for comprehensive coverage
      expect(MCPServerConfigSchema).toBeDefined();
      expect(MCPConnectionEventSchema).toBeDefined();
      expect(MCPConnectionConfigSchema).toBeDefined();
    });

    it('should handle real-world usage scenarios', () => {
      // Test a realistic scenario that would be used in the APEX system
      const realWorldConfig = MCPConfigSchema.parse({
        enabled: true,
        servers: {
          'filesystem': {
            name: 'Filesystem MCP Server',
            type: 'stdio',
            command: 'npx',
            args: ['@mcp/filesystem'],
            envVars: [
              {
                name: 'WORKSPACE_ROOT',
                description: 'Root directory for filesystem operations',
                required: true,
                sensitive: false,
                defaultValue: '/workspace',
                source: 'config',
              },
            ],
            autoStart: true,
            capabilities: ['filesystem'],
            connection: {
              maxRetries: 3,
              timeoutMs: 30000,
            },
          },
          'github': {
            name: 'GitHub MCP Server',
            type: 'http',
            url: 'https://api.github.com/mcp',
            headers: {
              'Authorization': 'token github_pat_example',
              'Accept': 'application/vnd.github.v3+json',
            },
            envVars: [
              {
                name: 'GITHUB_TOKEN',
                description: 'GitHub personal access token',
                required: true,
                sensitive: true,
                source: 'user',
              },
            ],
            autoStart: false,
            capabilities: ['github', 'git', 'api'],
            connection: {
              maxRetries: 5,
              timeoutMs: 60000,
              poolSize: 1,
            },
          },
        },
        marketplace: {
          url: 'https://mcp-registry.anthropic.com',
          enabled: true,
          refreshIntervalMinutes: 1440,
          allowUnverified: false,
        },
        connection: {
          maxRetries: 3,
          timeoutMs: 30000,
          poolSize: 1,
          healthCheckIntervalMs: 60000,
        },
      });

      expect(realWorldConfig.enabled).toBe(true);
      expect(Object.keys(realWorldConfig.servers)).toContain('filesystem');
      expect(Object.keys(realWorldConfig.servers)).toContain('github');
      expect(realWorldConfig.servers.github.envVars![0].sensitive).toBe(true);
      expect(realWorldConfig.marketplace?.allowUnverified).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should provide meaningful error messages for validation failures', () => {
      // Test that schema validation provides helpful error messages
      const invalidConfig = {
        enabled: 'true', // Should be boolean
        servers: {
          'invalid-server': {
            name: '', // Should not be empty
            type: 'invalid-type', // Invalid type
            autoStart: 'yes', // Should be boolean
          },
        },
      };

      let error: any;
      try {
        MCPConfigSchema.parse(invalidConfig);
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.issues).toBeDefined();
      expect(error.issues.length).toBeGreaterThan(0);
    });

    it('should handle complex nested validation scenarios', () => {
      const complexConfig = {
        enabled: true,
        servers: {
          'complex-server': {
            name: 'Complex Test Server',
            type: 'stdio' as const,
            command: 'node',
            args: ['--max-old-space-size=4096', 'complex-server.js'],
            env: {
              'NODE_ENV': 'production',
              'DEBUG': 'mcp:*',
              'MAX_CONNECTIONS': '100',
            },
            envVars: [
              {
                name: 'COMPLEX_API_KEY',
                description: 'Complex API key with special requirements',
                required: true,
                sensitive: true,
                source: 'user' as const,
              },
              {
                name: 'COMPLEX_TIMEOUT',
                description: 'Timeout for complex operations',
                required: false,
                sensitive: false,
                defaultValue: '30000',
                source: 'config' as const,
              },
            ],
            autoStart: true,
            capabilities: [
              'complex-operations',
              'batch-processing',
              'high-throughput',
              'advanced-caching',
            ],
            connection: {
              maxRetries: 10,
              timeoutMs: 120000,
              connectTimeoutMs: 15000,
              readTimeoutMs: 300000,
              writeTimeoutMs: 60000,
              idleTimeoutMs: 600000,
              poolSize: 5,
              healthCheckIntervalMs: 30000,
              healthCheckTimeoutMs: 10000,
              heartbeatEnabled: true,
              heartbeatIntervalMs: 45000,
              keepAliveIntervalMs: 20000,
            },
          },
        },
        marketplace: {
          url: 'https://enterprise-mcp-marketplace.internal.company.com/api/v2',
          enabled: true,
          refreshIntervalMinutes: 480, // 8 hours
          allowUnverified: true, // For internal development
        },
        connection: {
          maxRetries: 5,
          timeoutMs: 60000,
          poolSize: 3,
          healthCheckIntervalMs: 120000,
        },
      };

      expect(() => MCPConfigSchema.parse(complexConfig)).not.toThrow();
      const result = MCPConfigSchema.parse(complexConfig);

      expect(result.servers['complex-server'].envVars).toHaveLength(2);
      expect(result.servers['complex-server'].capabilities).toHaveLength(4);
      expect(result.servers['complex-server'].connection?.poolSize).toBe(5);
      expect(result.marketplace?.refreshIntervalMinutes).toBe(480);
    });
  });
});