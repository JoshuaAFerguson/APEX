/**
 * @fileoverview Integration Tests for Marketplace Factory Functions
 *
 * Tests the integration of new factory functions with existing fixtures
 * and validates real-world usage scenarios.
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
  // Existing utilities for comparison
  createServerConfig,
  createMarketplaceEntry,
  baseFilesystemServerConfig,
  baseFilesystemMarketplaceEntry,
} from '../marketplace.js';

describe('Marketplace Factory Functions Integration', () => {
  describe('Comparison with existing utilities', () => {
    it('should produce equivalent results to existing createServerConfig', () => {
      // Old way - requires base object
      const oldConfig = createServerConfig(baseFilesystemServerConfig, {
        autoStart: true,
      });

      // New way - standalone creation
      const newConfig = createMCPServerConfig({
        name: 'filesystem-server',
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
        autoStart: true,
      });

      expect(oldConfig.autoStart).toBe(newConfig.autoStart);
      expect(oldConfig.type).toBe(newConfig.type);
      expect(oldConfig.command).toBe(newConfig.command);
    });

    it('should produce equivalent results to existing createMarketplaceEntry', () => {
      // Old way - requires base object
      const oldEntry = createMarketplaceEntry(baseFilesystemMarketplaceEntry, {
        verified: false,
      });

      // New way - standalone creation
      const newEntry = createMCPMarketplaceEntry({
        name: 'filesystem-server',
        description: 'MCP server for filesystem operations - read, write, and list files and directories',
        version: '1.0.0',
        author: 'Anthropic',
        homepage: 'https://github.com/modelcontextprotocol/servers',
        repository: 'https://github.com/modelcontextprotocol/servers',
        installCommand: 'npm install -g @modelcontextprotocol/server-filesystem',
        capabilities: ['resources', 'tools'],
        verified: false,
      });

      expect(oldEntry.verified).toBe(newEntry.verified);
      expect(oldEntry.name).toBe(newEntry.name);
      expect(oldEntry.description).toBe(newEntry.description);
    });
  });

  describe('Real-world usage scenarios', () => {
    it('should support PostgreSQL server setup scenario', () => {
      const postgresServer = createMCPServer({
        name: 'postgres-server',
        package: '@modelcontextprotocol/server-postgres',
        command: 'npx',
        args: ['@modelcontextprotocol/server-postgres'],
        env: {
          POSTGRES_URL: 'postgresql://localhost:5432/testdb',
        },
      });

      const postgresConfig = createMCPServerConfig({
        name: 'postgres-server',
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-postgres'],
        env: {
          POSTGRES_URL: 'postgresql://localhost:5432/testdb',
        },
        autoStart: false,
      });

      const postgresEntry = createMCPMarketplaceEntry({
        name: 'postgres-server',
        description: 'MCP server for PostgreSQL database operations',
        version: '1.0.0',
        author: 'Anthropic',
        installCommand: 'npm install -g @modelcontextprotocol/server-postgres',
        serverConfig: postgresConfig,
        capabilities: ['tools'],
        verified: true,
      });

      // All should be valid
      expect(MCPServerSchema.safeParse(postgresServer).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(postgresConfig).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(postgresEntry).success).toBe(true);

      // Should have expected properties
      expect(postgresServer.env.POSTGRES_URL).toBe('postgresql://localhost:5432/testdb');
      expect(postgresEntry.serverConfig.env?.POSTGRES_URL).toBe('postgresql://localhost:5432/testdb');
    });

    it('should support HTTP server setup scenario', () => {
      const httpConfig = createMCPServerConfig({
        name: 'http-server',
        type: 'http',
        command: 'node',
        args: ['server.js'],
        autoStart: true,
      }, { includeEnv: true });

      const httpEntry = createMCPMarketplaceEntry({
        name: 'http-server',
        description: 'HTTP-based MCP server',
        serverConfig: httpConfig,
      }, { verified: true });

      expect(httpConfig.type).toBe('http');
      expect(httpConfig.autoStart).toBe(true);
      expect(httpConfig.env?.NODE_ENV).toBe('test');
      expect(httpEntry.verified).toBe(true);
      expect(httpEntry.serverConfig.type).toBe('http');

      // Validate against schemas
      expect(MCPServerConfigSchema.safeParse(httpConfig).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(httpEntry).success).toBe(true);
    });

    it('should support development testing scenario', () => {
      const devServer = createMCPServer({
        name: 'dev-test-server',
        package: '@test/mcp-server',
        version: '0.1.0-alpha',
      }, { includeEnv: true, includeEnvVars: true });

      const devEntry = createMCPMarketplaceEntry({
        name: 'dev-test-server',
        description: 'Development test server',
        version: '0.1.0-alpha',
        serverConfig: createMCPServerConfig({
          name: 'dev-test-server',
          autoStart: false,
        }),
      }, { verified: false, includeCapabilities: false });

      expect(devServer.version).toBe('0.1.0-alpha');
      expect(devServer.env.NODE_ENV).toBe('test');
      expect(devEntry.verified).toBe(false);
      expect(devEntry.capabilities).toBeUndefined();

      // Validate against schemas
      expect(MCPServerSchema.safeParse(devServer).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(devEntry).success).toBe(true);
    });
  });

  describe('Preset usage in real scenarios', () => {
    it('should support quick filesystem server setup', () => {
      const filesystemServer = MCPServerPresets.basic.filesystem();
      const filesystemConfig = MCPServerPresets.configs.stdio();
      const filesystemEntry = MCPServerPresets.marketplace.verified();

      // Should create valid entities
      expect(MCPServerSchema.safeParse(filesystemServer).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(filesystemConfig).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(filesystemEntry).success).toBe(true);

      // Should have expected configurations
      expect(filesystemServer.package).toBe('@modelcontextprotocol/server-filesystem');
      expect(filesystemConfig.type).toBe('stdio');
      expect(filesystemEntry.verified).toBe(true);
    });

    it('should support creating test suite data arrays', () => {
      const testServers = [
        MCPServerPresets.basic.filesystem(),
        MCPServerPresets.basic.memory(),
        MCPServerPresets.basic.git(),
      ];

      const testConfigs = [
        MCPServerPresets.configs.stdio(),
        MCPServerPresets.configs.http(),
        MCPServerPresets.configs.sse(),
        MCPServerPresets.configs.sdk(),
      ];

      const testEntries = [
        MCPServerPresets.marketplace.verified(),
        MCPServerPresets.marketplace.unverified(),
        MCPServerPresets.marketplace.withCapabilities(),
      ];

      // All should be valid
      testServers.forEach(server => {
        expect(MCPServerSchema.safeParse(server).success).toBe(true);
      });

      testConfigs.forEach(config => {
        expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
      });

      testEntries.forEach(entry => {
        expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);
      });

      // Should have unique names for generated items
      const entryNames = testEntries.map(e => e.name);
      const uniqueNames = new Set(entryNames);
      expect(uniqueNames.size).toBe(entryNames.length);
    });
  });

  describe('Complex nested object creation', () => {
    it('should handle complex serverConfig merging', () => {
      const entry = createMCPMarketplaceEntry({
        name: 'complex-server',
        serverConfig: {
          type: 'http',
          command: 'node',
          args: ['--experimental-modules', 'server.js'],
          env: {
            PORT: '3000',
            NODE_ENV: 'production',
          },
          autoStart: true,
        },
      });

      expect(entry.serverConfig.type).toBe('http');
      expect(entry.serverConfig.command).toBe('node');
      expect(entry.serverConfig.args).toEqual(['--experimental-modules', 'server.js']);
      expect(entry.serverConfig.env?.PORT).toBe('3000');
      expect(entry.serverConfig.env?.NODE_ENV).toBe('production');
      expect(entry.serverConfig.autoStart).toBe(true);

      // Validate against schema
      expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);
    });

    it('should support factory chaining patterns', () => {
      // Create a server config first
      const config = createMCPServerConfig({
        name: 'chained-server',
        type: 'sse',
      }, { includeEnv: true });

      // Use that config in a marketplace entry
      const entry = createMCPMarketplaceEntry({
        name: 'chained-server',
        serverConfig: config,
      }, { verified: true });

      // Create a server that matches
      const server = createMCPServer({
        name: 'chained-server',
        package: entry.installCommand?.includes('@test') ? '@test/package' : '@prod/package',
      });

      // All should be valid and connected
      expect(entry.serverConfig.name).toBe('chained-server');
      expect(entry.serverConfig.type).toBe('sse');
      expect(entry.serverConfig.env?.NODE_ENV).toBe('test');
      expect(entry.verified).toBe(true);
      expect(server.name).toBe('chained-server');

      // Validate against schemas
      expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);
      expect(MCPServerSchema.safeParse(server).success).toBe(true);
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle empty overrides gracefully', () => {
      const server = createMCPServer({});
      const config = createMCPServerConfig({});
      const entry = createMCPMarketplaceEntry({});

      expect(MCPServerSchema.safeParse(server).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);
    });

    it('should handle null and undefined values properly', () => {
      const entry = createMCPMarketplaceEntry({
        author: undefined,
        homepage: undefined,
        repository: undefined,
        installCommand: undefined,
      });

      // Should still be valid - these are optional fields
      expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);
      expect(entry.author).toBeUndefined();
    });

    it('should validate required fields are always present', () => {
      const server = createMCPServer();
      const config = createMCPServerConfig();
      const entry = createMCPMarketplaceEntry();

      // Required fields should always be present
      expect(server.name).toBeDefined();
      expect(server.package).toBeDefined();
      expect(server.command).toBeDefined();
      expect(server.version).toBeDefined();

      expect(config.name).toBeDefined();
      expect(config.command).toBeDefined();

      expect(entry.name).toBeDefined();
      expect(entry.description).toBeDefined();
      expect(entry.version).toBeDefined();
      expect(entry.serverConfig).toBeDefined();
    });
  });
});