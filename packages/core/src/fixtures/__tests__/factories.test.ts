/**
 * @fileoverview Tests for Marketplace Factory Functions
 *
 * Validates the new factory functions for MCPServer, MCPServerConfig, and MCPMarketplaceEntry
 * as defined in ADR-002: Factory Functions for Marketplace Test Data Generation.
 */

import { describe, expect, it } from 'vitest';
import {
  MCPServerConfigSchema,
  MCPServerSchema,
  MCPMarketplaceEntrySchema,
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

describe('Marketplace Factory Functions', () => {
  describe('createMCPServerConfig', () => {
    it('should create a valid server config with defaults', () => {
      const config = createMCPServerConfig();

      expect(config.name).toMatch(/^test-config-\d+-[a-z0-9]+$/);
      expect(config.type).toBe('stdio');
      expect(config.command).toBe('npx');
      expect(config.args).toEqual(['@apex/test-mcp-server']);
      expect(config.autoStart).toBe(false);
      expect(config.env).toBeUndefined();

      // Validate against Zod schema
      const result = MCPServerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should support partial overrides', () => {
      const config = createMCPServerConfig({
        name: 'my-custom-server',
        autoStart: true,
        args: ['custom-arg1', 'custom-arg2'],
      });

      expect(config.name).toBe('my-custom-server');
      expect(config.autoStart).toBe(true);
      expect(config.args).toEqual(['custom-arg1', 'custom-arg2']);
      expect(config.type).toBe('stdio'); // default preserved
      expect(config.command).toBe('npx'); // default preserved

      // Validate against Zod schema
      const result = MCPServerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should support factory options', () => {
      const options: MCPServerConfigFactoryOptions = {
        type: 'http',
        autoStart: true,
        includeEnv: true,
      };

      const config = createMCPServerConfig({}, options);

      expect(config.type).toBe('http');
      expect(config.autoStart).toBe(true);
      expect(config.env).toEqual({ NODE_ENV: 'test' });

      // Validate against Zod schema
      const result = MCPServerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should generate unique names on each call', () => {
      const config1 = createMCPServerConfig();
      const config2 = createMCPServerConfig();

      expect(config1.name).not.toBe(config2.name);
    });

    it('should support all connection types', () => {
      const types: Array<'stdio' | 'http' | 'sse' | 'sdk'> = ['stdio', 'http', 'sse', 'sdk'];

      for (const type of types) {
        const config = createMCPServerConfig({}, { type });
        expect(config.type).toBe(type);

        // Validate against Zod schema
        const result = MCPServerConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('createMCPServer', () => {
    it('should create a valid server with defaults', () => {
      const server = createMCPServer();

      expect(server.name).toMatch(/^test-server-\d+-[a-z0-9]+$/);
      expect(server.package).toBe('@apex/test-mcp-server');
      expect(server.command).toBe('npx');
      expect(server.args).toEqual(['@apex/test-mcp-server']);
      expect(server.env).toEqual({});
      expect(server.envVars).toEqual([]);
      expect(server.version).toBe('1.0.0');

      // Validate against Zod schema
      const result = MCPServerSchema.safeParse(server);
      expect(result.success).toBe(true);
    });

    it('should support partial overrides', () => {
      const server = createMCPServer({
        name: 'postgres-server',
        package: '@modelcontextprotocol/server-postgres',
        version: '2.1.0',
      });

      expect(server.name).toBe('postgres-server');
      expect(server.package).toBe('@modelcontextprotocol/server-postgres');
      expect(server.version).toBe('2.1.0');
      expect(server.command).toBe('npx'); // default preserved
      expect(server.args).toEqual(['@apex/test-mcp-server']); // default preserved

      // Validate against Zod schema
      const result = MCPServerSchema.safeParse(server);
      expect(result.success).toBe(true);
    });

    it('should support factory options for environment variables', () => {
      const options: MCPServerFactoryOptions = {
        includeEnv: true,
        includeEnvVars: true,
      };

      const server = createMCPServer({}, options);

      expect(server.env).toEqual({ NODE_ENV: 'test' });
      expect(server.envVars).toEqual([]);

      // Validate against Zod schema
      const result = MCPServerSchema.safeParse(server);
      expect(result.success).toBe(true);
    });

    it('should generate unique names on each call', () => {
      const server1 = createMCPServer();
      const server2 = createMCPServer();

      expect(server1.name).not.toBe(server2.name);
    });

    it('should handle custom environment variables', () => {
      const server = createMCPServer({
        env: {
          DATABASE_URL: 'postgresql://localhost:5432/testdb',
          API_KEY: 'test-key',
        },
      });

      expect(server.env).toEqual({
        DATABASE_URL: 'postgresql://localhost:5432/testdb',
        API_KEY: 'test-key',
      });

      // Validate against Zod schema
      const result = MCPServerSchema.safeParse(server);
      expect(result.success).toBe(true);
    });
  });

  describe('createMCPMarketplaceEntry', () => {
    it('should create a valid marketplace entry with defaults', () => {
      const entry = createMCPMarketplaceEntry();

      expect(entry.name).toMatch(/^test-marketplace-entry-\d+-[a-z0-9]+$/);
      expect(entry.description).toBe('Test MCP server for testing purposes');
      expect(entry.version).toBe('1.0.0');
      expect(entry.author).toBe('Test Author');
      expect(entry.homepage).toBe('https://example.com/test-server');
      expect(entry.repository).toBe('https://github.com/test/test-server');
      expect(entry.installCommand).toBe('npm install -g @apex/test-mcp-server');
      expect(entry.serverConfig).toBeDefined();
      expect(entry.serverConfig.type).toBe('stdio');
      expect(entry.capabilities).toEqual(['tools']);
      expect(entry.verified).toBe(false);

      // Validate against Zod schema
      const result = MCPMarketplaceEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    });

    it('should support partial overrides', () => {
      const entry = createMCPMarketplaceEntry({
        name: 'filesystem-server',
        description: 'Custom filesystem server',
        verified: true,
        capabilities: ['resources', 'tools'],
      });

      expect(entry.name).toBe('filesystem-server');
      expect(entry.description).toBe('Custom filesystem server');
      expect(entry.verified).toBe(true);
      expect(entry.capabilities).toEqual(['resources', 'tools']);
      expect(entry.version).toBe('1.0.0'); // default preserved
      expect(entry.author).toBe('Test Author'); // default preserved

      // Validate against Zod schema
      const result = MCPMarketplaceEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    });

    it('should support server config overrides', () => {
      const entry = createMCPMarketplaceEntry({
        serverConfig: {
          type: 'http',
          autoStart: true,
        },
      });

      expect(entry.serverConfig.type).toBe('http');
      expect(entry.serverConfig.autoStart).toBe(true);
      expect(entry.serverConfig.command).toBe('npx'); // default preserved

      // Validate against Zod schema
      const result = MCPMarketplaceEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    });

    it('should support factory options', () => {
      const options: MCPMarketplaceEntryFactoryOptions = {
        verified: true,
        includeCapabilities: false,
      };

      const entry = createMCPMarketplaceEntry({}, options);

      expect(entry.verified).toBe(true);
      expect(entry.capabilities).toBeUndefined();

      // Validate against Zod schema
      const result = MCPMarketplaceEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    });

    it('should generate unique names on each call', () => {
      const entry1 = createMCPMarketplaceEntry();
      const entry2 = createMCPMarketplaceEntry();

      expect(entry1.name).not.toBe(entry2.name);
      expect(entry1.serverConfig.name).not.toBe(entry2.serverConfig.name);
    });

    it('should create valid serverConfig for marketplace entry', () => {
      const entry = createMCPMarketplaceEntry();

      // Server config should be valid on its own
      const configResult = MCPServerConfigSchema.safeParse(entry.serverConfig);
      expect(configResult.success).toBe(true);
    });
  });

  describe('MCPServerPresets', () => {
    describe('basic server presets', () => {
      it('should create filesystem server preset', () => {
        const server = MCPServerPresets.basic.filesystem();

        expect(server.name).toBe('filesystem-server');
        expect(server.package).toBe('@modelcontextprotocol/server-filesystem');
        expect(server.args).toEqual(['@modelcontextprotocol/server-filesystem', '/tmp']);

        // Validate against Zod schema
        const result = MCPServerSchema.safeParse(server);
        expect(result.success).toBe(true);
      });

      it('should create memory server preset', () => {
        const server = MCPServerPresets.basic.memory();

        expect(server.name).toBe('memory-server');
        expect(server.package).toBe('@modelcontextprotocol/server-memory');
        expect(server.args).toEqual(['@modelcontextprotocol/server-memory']);

        // Validate against Zod schema
        const result = MCPServerSchema.safeParse(server);
        expect(result.success).toBe(true);
      });

      it('should create git server preset', () => {
        const server = MCPServerPresets.basic.git();

        expect(server.name).toBe('git-server');
        expect(server.package).toBe('@modelcontextprotocol/server-git');
        expect(server.args).toEqual(['@modelcontextprotocol/server-git']);

        // Validate against Zod schema
        const result = MCPServerSchema.safeParse(server);
        expect(result.success).toBe(true);
      });
    });

    describe('config presets', () => {
      it('should create stdio config preset', () => {
        const config = MCPServerPresets.configs.stdio();

        expect(config.type).toBe('stdio');

        // Validate against Zod schema
        const result = MCPServerConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('should create http config preset', () => {
        const config = MCPServerPresets.configs.http();

        expect(config.type).toBe('http');

        // Validate against Zod schema
        const result = MCPServerConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('should create sse config preset', () => {
        const config = MCPServerPresets.configs.sse();

        expect(config.type).toBe('sse');

        // Validate against Zod schema
        const result = MCPServerConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('should create sdk config preset', () => {
        const config = MCPServerPresets.configs.sdk();

        expect(config.type).toBe('sdk');

        // Validate against Zod schema
        const result = MCPServerConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('should create config with environment variables', () => {
        const config = MCPServerPresets.configs.withEnv();

        expect(config.env).toEqual({ NODE_ENV: 'test' });

        // Validate against Zod schema
        const result = MCPServerConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('should create auto-start config', () => {
        const config = MCPServerPresets.configs.autoStart();

        expect(config.autoStart).toBe(true);

        // Validate against Zod schema
        const result = MCPServerConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    describe('marketplace entry presets', () => {
      it('should create verified entry preset', () => {
        const entry = MCPServerPresets.marketplace.verified();

        expect(entry.verified).toBe(true);

        // Validate against Zod schema
        const result = MCPMarketplaceEntrySchema.safeParse(entry);
        expect(result.success).toBe(true);
      });

      it('should create unverified entry preset', () => {
        const entry = MCPServerPresets.marketplace.unverified();

        expect(entry.verified).toBe(false);

        // Validate against Zod schema
        const result = MCPMarketplaceEntrySchema.safeParse(entry);
        expect(result.success).toBe(true);
      });

      it('should create entry with capabilities', () => {
        const entry = MCPServerPresets.marketplace.withCapabilities();

        expect(entry.capabilities).toEqual(['tools', 'resources', 'prompts']);

        // Validate against Zod schema
        const result = MCPMarketplaceEntrySchema.safeParse(entry);
        expect(result.success).toBe(true);
      });

      it('should create minimal entry preset', () => {
        const entry = MCPServerPresets.marketplace.minimal();

        expect(entry.description).toBe('Minimal test server');
        expect(entry.capabilities).toEqual([]);

        // Validate against Zod schema
        const result = MCPMarketplaceEntrySchema.safeParse(entry);
        expect(result.success).toBe(true);
      });
    });

    it('should create unique instances for each preset call', () => {
      const server1 = MCPServerPresets.basic.filesystem();
      const server2 = MCPServerPresets.basic.filesystem();

      // Names should be the same since they're preset values
      expect(server1.name).toBe(server2.name);

      // But the objects should be different instances
      expect(server1).not.toBe(server2);
    });
  });

  describe('Integration with existing patterns', () => {
    it('should follow the same pattern as task factory', () => {
      // Test that the factory follows the FixtureFactory<T, TOptions> pattern
      const config1 = createMCPServerConfig();
      const config2 = createMCPServerConfig({}, {});
      const config3 = createMCPServerConfig({ name: 'test' });
      const config4 = createMCPServerConfig({ name: 'test' }, { type: 'http' });

      // All should be valid
      expect(MCPServerConfigSchema.safeParse(config1).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(config2).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(config3).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(config4).success).toBe(true);

      expect(config3.name).toBe('test');
      expect(config4.name).toBe('test');
      expect(config4.type).toBe('http');
    });

    it('should work without any parameters', () => {
      // Test the standalone creation capability
      const server = createMCPServer();
      const config = createMCPServerConfig();
      const entry = createMCPMarketplaceEntry();

      expect(MCPServerSchema.safeParse(server).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);
    });
  });
});