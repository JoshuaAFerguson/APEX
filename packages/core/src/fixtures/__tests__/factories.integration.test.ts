/**
 * @fileoverview Integration Tests for Marketplace Factory Functions
 *
 * Tests real-world usage scenarios, complex configurations, and interactions
 * between factory functions to ensure they work correctly in typical usage patterns.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  MCPServerConfigSchema,
  MCPServerSchema,
  MCPMarketplaceEntrySchema,
  type MCPServerConfig,
  type MCPServer,
  type MCPMarketplaceEntry,
} from '../../types.js';
import {
  createMCPServer,
  createMCPServerConfig,
  createMCPMarketplaceEntry,
  MCPServerPresets,
  type MCPServerFactoryOptions,
  type MCPServerConfigFactoryOptions,
  type MCPMarketplaceEntryFactoryOptions,
} from '../marketplace.js';

describe('Marketplace Factory Integration Tests', () => {
  let createdServers: MCPServer[] = [];
  let createdConfigs: MCPServerConfig[] = [];
  let createdEntries: MCPMarketplaceEntry[] = [];

  beforeEach(() => {
    // Clear tracking arrays
    createdServers = [];
    createdConfigs = [];
    createdEntries = [];
  });

  afterEach(() => {
    // Cleanup tracking (could be extended for cleanup operations if needed)
    createdServers.length = 0;
    createdConfigs.length = 0;
    createdEntries.length = 0;
  });

  describe('Real-world Configuration Scenarios', () => {
    it('should create a complete database server setup', () => {
      // Create a postgres-like server configuration
      const server = createMCPServer({
        name: 'postgres-server',
        package: '@modelcontextprotocol/server-postgres',
        args: ['@modelcontextprotocol/server-postgres', '--database', 'testdb'],
        env: {
          DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
          DB_SCHEMA: 'public',
        },
        envVars: [
          {
            name: 'DATABASE_URL',
            description: 'PostgreSQL connection string',
            required: true,
          },
        ],
      });

      const config = createMCPServerConfig({
        name: 'postgres-config',
        type: 'stdio',
        command: 'npx',
        args: server.args,
        env: server.env,
        autoStart: true,
      });

      const entry = createMCPMarketplaceEntry({
        name: 'PostgreSQL Server',
        description: 'Connect to PostgreSQL databases for data operations',
        author: 'Model Context Protocol',
        capabilities: ['tools', 'resources'],
        verified: true,
        serverConfig: config,
      });

      createdServers.push(server);
      createdConfigs.push(config);
      createdEntries.push(entry);

      // Verify all components are valid
      expect(MCPServerSchema.safeParse(server).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);

      // Verify configuration consistency
      expect(server.name).toBe('postgres-server');
      expect(config.name).toBe('postgres-config');
      expect(entry.name).toBe('PostgreSQL Server');
      expect(entry.serverConfig.env).toEqual(server.env);
      expect(entry.verified).toBe(true);
    });

    it('should create a filesystem server with custom paths', () => {
      const server = createMCPServer({
        name: 'filesystem-server',
        package: '@modelcontextprotocol/server-filesystem',
        args: [
          '@modelcontextprotocol/server-filesystem',
          '--root', '/home/user/documents',
          '--readonly',
        ],
        env: {
          FS_ROOT: '/home/user/documents',
          FS_MODE: 'readonly',
        },
      });

      const config = createMCPServerConfig({
        name: 'filesystem-config',
        type: 'stdio',
        command: 'npx',
        args: server.args,
        env: server.env,
        autoStart: false,
      });

      const entry = createMCPMarketplaceEntry({
        name: 'Filesystem Access Server',
        description: 'Secure filesystem operations with configurable root paths',
        capabilities: ['resources'],
        verified: false,
        serverConfig: config,
      });

      createdServers.push(server);
      createdConfigs.push(config);
      createdEntries.push(entry);

      // Verify filesystem-specific configuration
      expect(server.args).toContain('--root');
      expect(server.args).toContain('/home/user/documents');
      expect(server.args).toContain('--readonly');
      expect(config.autoStart).toBe(false);
      expect(entry.capabilities).toEqual(['resources']);
    });

    it('should create an HTTP-based server configuration', () => {
      const server = createMCPServer({
        name: 'web-api-server',
        package: '@custom/web-api-server',
        command: 'node',
        args: ['dist/index.js'],
        env: {
          PORT: '3000',
          API_KEY: 'test-key',
        },
      });

      const config = createMCPServerConfig({
        name: 'web-api-config',
        type: 'http',
        url: 'http://localhost:3000/mcp',
        env: server.env,
        autoStart: true,
      }, { type: 'http' });

      const entry = createMCPMarketplaceEntry({
        name: 'Web API Server',
        description: 'HTTP-based MCP server for web API integration',
        capabilities: ['tools'],
        verified: true,
        serverConfig: config,
      });

      createdServers.push(server);
      createdConfigs.push(config);
      createdEntries.push(entry);

      // Verify HTTP-specific configuration
      expect(config.type).toBe('http');
      expect(config.url).toBe('http://localhost:3000/mcp');
      expect(config.autoStart).toBe(true);
      expect(server.env.PORT).toBe('3000');
    });
  });

  describe('Complex Factory Interactions', () => {
    it('should handle nested configuration overrides correctly', () => {
      // Start with a preset
      const baseServer = MCPServerPresets.basic.filesystem();

      // Override with complex configuration
      const customServer = createMCPServer({
        ...baseServer,
        name: 'custom-filesystem-server',
        args: [...baseServer.args, '--custom-flag', 'value'],
        env: {
          ...baseServer.env,
          CUSTOM_VAR: 'custom-value',
        },
      });

      // Create config using the server's properties
      const config = createMCPServerConfig({
        name: `${customServer.name}-config`,
        command: customServer.command,
        args: customServer.args,
        env: customServer.env,
      });

      // Create marketplace entry with the configuration
      const entry = createMCPMarketplaceEntry({
        name: customServer.name.replace('-server', '').split('-').map(w =>
          w.charAt(0).toUpperCase() + w.slice(1)
        ).join(' '),
        description: `Custom configuration for ${customServer.package}`,
        serverConfig: config,
      });

      createdServers.push(customServer);
      createdConfigs.push(config);
      createdEntries.push(entry);

      // Verify inheritance and overrides
      expect(customServer.package).toBe('@modelcontextprotocol/server-filesystem');
      expect(customServer.name).toBe('custom-filesystem-server');
      expect(customServer.args).toContain('--custom-flag');
      expect(customServer.args).toContain('value');
      expect(customServer.env.CUSTOM_VAR).toBe('custom-value');

      expect(config.name).toBe('custom-filesystem-server-config');
      expect(config.args).toEqual(customServer.args);
      expect(config.env).toEqual(customServer.env);

      expect(entry.name).toBe('Custom Filesystem');
      expect(entry.serverConfig).toEqual(config);
    });

    it('should support environment variable inheritance across factories', () => {
      const commonEnv = {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        TIMEOUT: '30000',
      };

      const server = createMCPServer({
        name: 'production-server',
        env: {
          ...commonEnv,
          SERVER_SPECIFIC: 'server-value',
        },
      });

      const config = createMCPServerConfig({
        name: 'production-config',
        env: {
          ...commonEnv,
          CONFIG_SPECIFIC: 'config-value',
        },
      });

      const entry = createMCPMarketplaceEntry({
        name: 'Production Server',
        serverConfig: {
          ...config,
          env: {
            ...server.env,
            ...config.env,
            MERGED_VAR: 'merged-value',
          },
        },
      });

      createdServers.push(server);
      createdConfigs.push(config);
      createdEntries.push(entry);

      // Verify environment variable inheritance and merging
      expect(server.env.NODE_ENV).toBe('production');
      expect(server.env.SERVER_SPECIFIC).toBe('server-value');

      expect(config.env.NODE_ENV).toBe('production');
      expect(config.env.CONFIG_SPECIFIC).toBe('config-value');

      expect(entry.serverConfig.env.NODE_ENV).toBe('production');
      expect(entry.serverConfig.env.SERVER_SPECIFIC).toBe('server-value');
      expect(entry.serverConfig.env.CONFIG_SPECIFIC).toBe('config-value');
      expect(entry.serverConfig.env.MERGED_VAR).toBe('merged-value');
    });
  });

  describe('Factory Options Interaction', () => {
    it('should handle complex option combinations for different connection types', () => {
      const connectionTypes: Array<'stdio' | 'http' | 'sse' | 'sdk'> = ['stdio', 'http', 'sse', 'sdk'];

      for (const type of connectionTypes) {
        const serverOptions: MCPServerFactoryOptions = {
          includeEnv: true,
          includeEnvVars: true,
        };

        const configOptions: MCPServerConfigFactoryOptions = {
          type,
          autoStart: true,
          includeEnv: true,
        };

        const entryOptions: MCPMarketplaceEntryFactoryOptions = {
          verified: type === 'stdio' || type === 'http', // Only verify common types
          includeCapabilities: true,
        };

        const server = createMCPServer({
          name: `${type}-test-server`,
        }, serverOptions);

        const config = createMCPServerConfig({
          name: `${type}-test-config`,
        }, configOptions);

        const entry = createMCPMarketplaceEntry({
          name: `${type.toUpperCase()} Test Server`,
          serverConfig: config,
        }, entryOptions);

        createdServers.push(server);
        createdConfigs.push(config);
        createdEntries.push(entry);

        // Verify type-specific behavior
        expect(config.type).toBe(type);
        expect(config.autoStart).toBe(true);
        expect(server.env).toEqual({ NODE_ENV: 'test' });
        expect(entry.capabilities).toEqual(['tools']);

        if (type === 'stdio' || type === 'http') {
          expect(entry.verified).toBe(true);
        } else {
          expect(entry.verified).toBe(false);
        }
      }
    });

    it('should create a complete development environment setup', () => {
      // Create multiple servers for a development environment
      const servers = [
        createMCPServer({
          name: 'git-server',
          package: '@modelcontextprotocol/server-git',
        }),
        createMCPServer({
          name: 'filesystem-server',
          package: '@modelcontextprotocol/server-filesystem',
          args: ['@modelcontextprotocol/server-filesystem', '/workspace'],
        }),
        createMCPServer({
          name: 'memory-server',
          package: '@modelcontextprotocol/server-memory',
        }),
      ];

      // Create configurations for each server
      const configs = servers.map(server =>
        createMCPServerConfig({
          name: `${server.name}-config`,
          command: server.command,
          args: server.args,
          env: server.env,
          autoStart: true,
        })
      );

      // Create marketplace entries for each
      const entries = servers.map((server, index) =>
        createMCPMarketplaceEntry({
          name: `${server.name.replace('-server', '').split('-').map(w =>
            w.charAt(0).toUpperCase() + w.slice(1)
          ).join(' ')} Server`,
          description: `Development environment ${server.name}`,
          capabilities: server.name === 'memory-server' ? ['resources'] : ['tools', 'resources'],
          verified: true,
          serverConfig: configs[index],
        })
      );

      createdServers.push(...servers);
      createdConfigs.push(...configs);
      createdEntries.push(...entries);

      // Verify the complete setup
      expect(servers).toHaveLength(3);
      expect(configs).toHaveLength(3);
      expect(entries).toHaveLength(3);

      // Verify each server is configured correctly
      servers.forEach((server, index) => {
        expect(MCPServerSchema.safeParse(server).success).toBe(true);
        expect(MCPServerConfigSchema.safeParse(configs[index]).success).toBe(true);
        expect(MCPMarketplaceEntrySchema.safeParse(entries[index]).success).toBe(true);

        expect(configs[index].name).toBe(`${server.name}-config`);
        expect(configs[index].autoStart).toBe(true);
        expect(entries[index].verified).toBe(true);
      });

      // Verify specific server configurations
      const gitServer = servers.find(s => s.name === 'git-server');
      const filesystemServer = servers.find(s => s.name === 'filesystem-server');
      const memoryServer = servers.find(s => s.name === 'memory-server');

      expect(gitServer?.package).toBe('@modelcontextprotocol/server-git');
      expect(filesystemServer?.args).toContain('/workspace');
      expect(memoryServer?.package).toBe('@modelcontextprotocol/server-memory');
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle partial configuration overrides gracefully', () => {
      // Test scenario where some properties are undefined or null
      const server = createMCPServer({
        name: 'partial-server',
        package: '@test/partial-server',
        // Deliberately not setting some optional fields
        env: undefined, // This should use default
        envVars: [], // This should be respected
      });

      const config = createMCPServerConfig({
        name: 'partial-config',
        type: 'stdio',
        // Not setting optional fields
        env: undefined,
        url: undefined,
      });

      const entry = createMCPMarketplaceEntry({
        name: 'Partial Server',
        description: 'Server with partial configuration',
        // Not setting optional fields
        author: undefined,
        homepage: undefined,
        capabilities: undefined,
      });

      createdServers.push(server);
      createdConfigs.push(config);
      createdEntries.push(entry);

      // Verify that defaults are applied correctly
      expect(server.env).toEqual({});
      expect(server.envVars).toEqual([]);
      expect(config.env).toBeUndefined();
      expect(config.url).toBeUndefined();
      expect(entry.capabilities).toEqual(['tools']); // Default from factory

      // Ensure all are still valid
      expect(MCPServerSchema.safeParse(server).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);
    });

    it('should maintain data integrity across multiple factory calls', () => {
      const batchSize = 10;
      const servers: MCPServer[] = [];
      const configs: MCPServerConfig[] = [];
      const entries: MCPMarketplaceEntry[] = [];

      // Create multiple instances rapidly
      for (let i = 0; i < batchSize; i++) {
        const server = createMCPServer({
          name: `batch-server-${i}`,
          package: `@test/batch-server-${i}`,
        });

        const config = createMCPServerConfig({
          name: `batch-config-${i}`,
        });

        const entry = createMCPMarketplaceEntry({
          name: `Batch Server ${i}`,
          description: `Server created in batch operation ${i}`,
          serverConfig: config,
        });

        servers.push(server);
        configs.push(config);
        entries.push(entry);
      }

      createdServers.push(...servers);
      createdConfigs.push(...configs);
      createdEntries.push(...entries);

      // Verify uniqueness of generated IDs and names
      const serverNames = servers.map(s => s.name);
      const configNames = configs.map(c => c.name);
      const entryNames = entries.map(e => e.name);

      expect(new Set(serverNames).size).toBe(batchSize); // All unique
      expect(new Set(configNames).size).toBe(batchSize); // All unique
      expect(new Set(entryNames).size).toBe(batchSize); // All unique

      // Verify all instances are valid
      servers.forEach(server => {
        expect(MCPServerSchema.safeParse(server).success).toBe(true);
      });

      configs.forEach(config => {
        expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
      });

      entries.forEach(entry => {
        expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);
      });
    });
  });

  describe('Cross-Factory Validation', () => {
    it('should ensure factory functions work together in complex workflows', () => {
      // Simulate a workflow where factories are used in sequence

      // Step 1: Create base server using preset
      const baseServer = MCPServerPresets.basic.filesystem();

      // Step 2: Customize the server
      const customServer = createMCPServer({
        ...baseServer,
        name: 'workflow-filesystem-server',
        env: {
          ...baseServer.env,
          WORKFLOW_STAGE: 'server-creation',
        },
      });

      // Step 3: Create config based on server
      const serverConfig = createMCPServerConfig({
        name: 'workflow-filesystem-config',
        type: 'stdio',
        command: customServer.command,
        args: customServer.args,
        env: {
          ...customServer.env,
          WORKFLOW_STAGE: 'config-creation',
        },
      });

      // Step 4: Create marketplace entry with the config
      const marketplaceEntry = createMCPMarketplaceEntry({
        name: 'Workflow Filesystem Server',
        description: 'Server created through complex workflow',
        capabilities: ['resources', 'tools'],
        verified: true,
        serverConfig: {
          ...serverConfig,
          env: {
            ...serverConfig.env,
            WORKFLOW_STAGE: 'entry-creation',
          },
        },
      });

      // Step 5: Use preset configurations
      const configPreset = MCPServerPresets.configs.autoStart();
      const finalConfig = createMCPServerConfig({
        ...serverConfig,
        ...configPreset,
        name: 'workflow-final-config',
      });

      createdServers.push(customServer);
      createdConfigs.push(serverConfig, finalConfig);
      createdEntries.push(marketplaceEntry);

      // Verify the complete workflow
      expect(customServer.name).toBe('workflow-filesystem-server');
      expect(customServer.env.WORKFLOW_STAGE).toBe('server-creation');

      expect(serverConfig.name).toBe('workflow-filesystem-config');
      expect(serverConfig.env.WORKFLOW_STAGE).toBe('config-creation');

      expect(marketplaceEntry.name).toBe('Workflow Filesystem Server');
      expect(marketplaceEntry.serverConfig.env.WORKFLOW_STAGE).toBe('entry-creation');

      expect(finalConfig.autoStart).toBe(true); // From preset
      expect(finalConfig.name).toBe('workflow-final-config');

      // Verify all components are valid
      expect(MCPServerSchema.safeParse(customServer).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(serverConfig).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(finalConfig).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(marketplaceEntry).success).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large-scale factory operations efficiently', () => {
      const startTime = Date.now();
      const largeScale = 100;
      const createdItems: any[] = [];

      // Create many items quickly
      for (let i = 0; i < largeScale; i++) {
        const server = createMCPServer({ name: `scale-server-${i}` });
        const config = createMCPServerConfig({ name: `scale-config-${i}` });
        const entry = createMCPMarketplaceEntry({
          name: `Scale Server ${i}`,
          serverConfig: config,
        });

        createdItems.push({ server, config, entry });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance assertion (should complete within reasonable time)
      expect(duration).toBeLessThan(5000); // 5 seconds for 100 items

      // Verify all items are valid
      createdItems.forEach(({ server, config, entry }) => {
        expect(MCPServerSchema.safeParse(server).success).toBe(true);
        expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
        expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);
      });

      // Verify uniqueness at scale
      const allServerNames = createdItems.map(item => item.server.name);
      expect(new Set(allServerNames).size).toBe(largeScale);

      // Track for cleanup
      createdServers.push(...createdItems.map(item => item.server));
      createdConfigs.push(...createdItems.map(item => item.config));
      createdEntries.push(...createdItems.map(item => item.entry));
    });
  });
});