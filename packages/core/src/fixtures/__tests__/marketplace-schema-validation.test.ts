/**
 * @fileoverview Schema Validation Tests for Marketplace Types
 *
 * Tests that marketplace fixtures and types work correctly with Zod validation schemas.
 * Ensures type safety and data integrity across the marketplace system.
 */

import { describe, expect, it } from 'vitest';
import {
  MCPMarketplaceEntrySchema,
  MCPMarketplaceSchema,
  MCPMarketplaceSourceSchema,
  MCPServerConfigSchema,
  MCPServerSchema,
} from '../../types.js';
import {
  baseFilesystemMarketplaceEntry,
  baseMemoryMarketplaceEntry,
  baseGitMarketplaceEntry,
  baseFetchMarketplaceEntry,
  basePostgresMarketplaceEntry,
  baseMarketplace,
  baseDevelopmentMarketplace,
  baseMarketplaceSource,
  baseDevelopmentMarketplaceSource,
  baseLocalMarketplaceSource,
  baseFilesystemServerConfig,
  baseMemoryServerConfig,
  baseGitServerConfig,
  baseFetchServerConfig,
  basePostgresServerConfig,
  baseFilesystemServer,
  baseMemoryServer,
  baseGitServer,
  createMarketplaceEntry,
  createServerConfig,
  createMarketplace,
} from '../marketplace.js';

describe('Marketplace Schema Validation', () => {
  describe('MCPServerConfig Schema Validation', () => {
    it('should validate all base server configurations', () => {
      const configs = [
        baseFilesystemServerConfig,
        baseMemoryServerConfig,
        baseGitServerConfig,
        baseFetchServerConfig,
        basePostgresServerConfig,
      ];

      for (const config of configs) {
        expect(() => MCPServerConfigSchema.parse(config)).not.toThrow();
      }
    });

    it('should validate server config with minimal required fields', () => {
      const minimalConfig = {
        name: 'minimal-server',
        type: 'stdio' as const,
        command: 'test-command',
        autoStart: false,
      };

      expect(() => MCPServerConfigSchema.parse(minimalConfig)).not.toThrow();
    });

    it('should validate server config with all optional fields', () => {
      const fullConfig = {
        name: 'full-server',
        type: 'stdio' as const,
        command: 'test-command',
        args: ['--arg1', '--arg2'],
        env: { TEST_VAR: 'value' },
        autoStart: true,
      };

      expect(() => MCPServerConfigSchema.parse(fullConfig)).not.toThrow();
    });

    it('should reject server config with invalid type', () => {
      const invalidConfig = {
        name: 'invalid-server',
        type: 'invalid-type', // Should only be 'stdio'
        command: 'test-command',
        autoStart: false,
      };

      expect(() => MCPServerConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject server config with missing required fields', () => {
      const invalidConfig = {
        name: 'incomplete-server',
        // Missing type and command
        autoStart: false,
      };

      expect(() => MCPServerConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should validate environment variables as record of strings', () => {
      const configWithEnv = {
        ...baseFilesystemServerConfig,
        env: {
          STRING_VAR: 'string-value',
          NUMBER_VAR: '123', // Should be string in env
          BOOLEAN_VAR: 'true', // Should be string in env
        },
      };

      expect(() => MCPServerConfigSchema.parse(configWithEnv)).not.toThrow();
    });
  });

  describe('MCPServer Schema Validation', () => {
    it('should validate all base MCP servers', () => {
      const servers = [
        baseFilesystemServer,
        baseMemoryServer,
        baseGitServer,
      ];

      for (const server of servers) {
        expect(() => MCPServerSchema.parse(server)).not.toThrow();
      }
    });

    it('should validate server with minimal required fields', () => {
      const minimalServer = {
        name: 'minimal-server',
        package: '@test/minimal-server',
        command: 'test-command',
        args: [],
        env: {},
        envVars: [],
        version: '1.0.0',
      };

      expect(() => MCPServerSchema.parse(minimalServer)).not.toThrow();
    });

    it('should reject server with invalid version format', () => {
      const invalidServer = {
        ...baseFilesystemServer,
        version: 'invalid-version',
      };

      expect(() => MCPServerSchema.parse(invalidServer)).toThrow();
    });
  });

  describe('MCPMarketplaceEntry Schema Validation', () => {
    it('should validate all base marketplace entries', () => {
      const entries = [
        baseFilesystemMarketplaceEntry,
        baseMemoryMarketplaceEntry,
        baseGitMarketplaceEntry,
        baseFetchMarketplaceEntry,
        basePostgresMarketplaceEntry,
      ];

      for (const entry of entries) {
        expect(() => MCPMarketplaceEntrySchema.parse(entry)).not.toThrow();
      }
    });

    it('should validate entry with minimal required fields', () => {
      const minimalEntry = {
        name: 'minimal-entry',
        description: 'Minimal test entry',
        version: '1.0.0',
        author: 'Test Author',
        serverConfig: {
          name: 'minimal',
          type: 'stdio' as const,
          command: 'test',
          autoStart: false,
        },
        verified: true,
      };

      expect(() => MCPMarketplaceEntrySchema.parse(minimalEntry)).not.toThrow();
    });

    it('should validate entry with all optional fields', () => {
      const fullEntry = {
        name: 'full-entry',
        description: 'Complete test entry with all fields',
        version: '1.2.3',
        author: 'Test Author',
        homepage: 'https://example.com',
        repository: 'https://github.com/example/repo',
        installCommand: 'npm install @example/package',
        serverConfig: {
          name: 'full-server',
          type: 'stdio' as const,
          command: 'npx',
          args: ['@example/package'],
          env: { API_KEY: 'test' },
          autoStart: true,
        },
        capabilities: ['tools', 'resources'],
        verified: true,
      };

      expect(() => MCPMarketplaceEntrySchema.parse(fullEntry)).not.toThrow();
    });

    it('should reject entry with invalid serverConfig', () => {
      const invalidEntry = {
        name: 'invalid-entry',
        description: 'Entry with invalid server config',
        version: '1.0.0',
        author: 'Test',
        serverConfig: {
          // Missing required fields
          name: 'incomplete',
        },
        verified: true,
      };

      expect(() => MCPMarketplaceEntrySchema.parse(invalidEntry)).toThrow();
    });

    it('should validate capabilities array', () => {
      const entryWithCapabilities = {
        ...baseFilesystemMarketplaceEntry,
        capabilities: ['files', 'directories', 'search', 'permissions'],
      };

      expect(() => MCPMarketplaceEntrySchema.parse(entryWithCapabilities)).not.toThrow();
    });

    it('should allow undefined capabilities', () => {
      const entryWithoutCapabilities = {
        ...baseFilesystemMarketplaceEntry,
        capabilities: undefined,
      };

      expect(() => MCPMarketplaceEntrySchema.parse(entryWithoutCapabilities)).not.toThrow();
    });
  });

  describe('MCPMarketplaceSource Schema Validation', () => {
    it('should validate all base marketplace sources', () => {
      const sources = [
        baseMarketplaceSource,
        baseDevelopmentMarketplaceSource,
        baseLocalMarketplaceSource,
      ];

      for (const source of sources) {
        expect(() => MCPMarketplaceSourceSchema.parse(source)).not.toThrow();
      }
    });

    it('should validate source with HTTP URL', () => {
      const httpSource = {
        url: 'http://example.com/catalog.json',
        enabled: true,
        refreshIntervalMinutes: 60,
        allowUnverified: false,
      };

      expect(() => MCPMarketplaceSourceSchema.parse(httpSource)).not.toThrow();
    });

    it('should validate source with HTTPS URL', () => {
      const httpsSource = {
        url: 'https://example.com/catalog.json',
        enabled: true,
        refreshIntervalMinutes: 60,
        allowUnverified: false,
      };

      expect(() => MCPMarketplaceSourceSchema.parse(httpsSource)).not.toThrow();
    });

    it('should validate source with file URL', () => {
      const fileSource = {
        url: 'file:///path/to/catalog.json',
        enabled: true,
        refreshIntervalMinutes: 1,
        allowUnverified: true,
      };

      expect(() => MCPMarketplaceSourceSchema.parse(fileSource)).not.toThrow();
    });

    it('should reject source with invalid URL', () => {
      const invalidSource = {
        url: 'not-a-valid-url',
        enabled: true,
        refreshIntervalMinutes: 60,
        allowUnverified: false,
      };

      expect(() => MCPMarketplaceSourceSchema.parse(invalidSource)).toThrow();
    });

    it('should reject source with negative refresh interval', () => {
      const invalidSource = {
        url: 'https://example.com/catalog.json',
        enabled: true,
        refreshIntervalMinutes: -1,
        allowUnverified: false,
      };

      expect(() => MCPMarketplaceSourceSchema.parse(invalidSource)).toThrow();
    });

    it('should reject source with zero refresh interval', () => {
      const invalidSource = {
        url: 'https://example.com/catalog.json',
        enabled: true,
        refreshIntervalMinutes: 0,
        allowUnverified: false,
      };

      expect(() => MCPMarketplaceSourceSchema.parse(invalidSource)).toThrow();
    });
  });

  describe('MCPMarketplace Schema Validation', () => {
    it('should validate all base marketplaces', () => {
      const marketplaces = [
        baseMarketplace,
        baseDevelopmentMarketplace,
      ];

      for (const marketplace of marketplaces) {
        expect(() => MCPMarketplaceSchema.parse(marketplace)).not.toThrow();
      }
    });

    it('should validate marketplace with minimal required fields', () => {
      const minimalMarketplace = {
        name: 'Minimal Marketplace',
        description: 'A minimal marketplace for testing',
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        servers: [],
      };

      expect(() => MCPMarketplaceSchema.parse(minimalMarketplace)).not.toThrow();
    });

    it('should validate marketplace with source', () => {
      const marketplaceWithSource = {
        ...baseMarketplace,
        source: baseMarketplaceSource,
      };

      expect(() => MCPMarketplaceSchema.parse(marketplaceWithSource)).not.toThrow();
    });

    it('should allow undefined source', () => {
      const marketplaceWithoutSource = {
        ...baseMarketplace,
        source: undefined,
      };

      expect(() => MCPMarketplaceSchema.parse(marketplaceWithoutSource)).not.toThrow();
    });

    it('should validate lastUpdated as ISO string', () => {
      const now = new Date();
      const isoString = now.toISOString();

      const marketplace = {
        ...baseMarketplace,
        lastUpdated: isoString,
      };

      expect(() => MCPMarketplaceSchema.parse(marketplace)).not.toThrow();
    });

    it('should reject marketplace with invalid lastUpdated format', () => {
      const invalidMarketplace = {
        ...baseMarketplace,
        lastUpdated: 'not-a-date',
      };

      expect(() => MCPMarketplaceSchema.parse(invalidMarketplace)).toThrow();
    });

    it('should validate servers array', () => {
      const marketplaceWithServers = {
        ...baseMarketplace,
        servers: [
          baseFilesystemMarketplaceEntry,
          baseMemoryMarketplaceEntry,
          baseGitMarketplaceEntry,
        ],
      };

      expect(() => MCPMarketplaceSchema.parse(marketplaceWithServers)).not.toThrow();
    });

    it('should reject marketplace with invalid server entries', () => {
      const invalidMarketplace = {
        ...baseMarketplace,
        servers: [
          {
            name: 'invalid-server',
            // Missing required fields
          },
        ],
      };

      expect(() => MCPMarketplaceSchema.parse(invalidMarketplace)).toThrow();
    });
  });

  describe('Fixture Utility Functions Schema Validation', () => {
    it('should validate createMarketplaceEntry output', () => {
      const customEntry = createMarketplaceEntry(baseFilesystemMarketplaceEntry, {
        name: 'custom-filesystem',
        verified: false,
        capabilities: ['files', 'directories', 'custom'],
      });

      expect(() => MCPMarketplaceEntrySchema.parse(customEntry)).not.toThrow();
      expect(customEntry.name).toBe('custom-filesystem');
      expect(customEntry.verified).toBe(false);
      expect(customEntry.capabilities).toContain('custom');
    });

    it('should validate createServerConfig output', () => {
      const customConfig = createServerConfig(baseFilesystemServerConfig, {
        autoStart: true,
        args: ['custom', 'args'],
        env: { CUSTOM_VAR: 'value' },
      });

      expect(() => MCPServerConfigSchema.parse(customConfig)).not.toThrow();
      expect(customConfig.autoStart).toBe(true);
      expect(customConfig.args).toEqual(['custom', 'args']);
      expect(customConfig.env).toEqual({ CUSTOM_VAR: 'value' });
    });

    it('should validate createMarketplace output', () => {
      const customMarketplace = createMarketplace(baseMarketplace, {
        name: 'Custom Registry',
        version: '2.0.0',
        servers: [baseFilesystemMarketplaceEntry],
      });

      expect(() => MCPMarketplaceSchema.parse(customMarketplace)).not.toThrow();
      expect(customMarketplace.name).toBe('Custom Registry');
      expect(customMarketplace.version).toBe('2.0.0');
      expect(customMarketplace.servers).toHaveLength(1);
    });

    it('should handle server config overrides in createMarketplaceEntry', () => {
      const customEntry = createMarketplaceEntry(baseFilesystemMarketplaceEntry, {
        serverConfig: {
          autoStart: true,
          env: { CUSTOM_PATH: '/custom/path' },
        },
      });

      expect(() => MCPMarketplaceEntrySchema.parse(customEntry)).not.toThrow();
      expect(customEntry.serverConfig.autoStart).toBe(true);
      expect(customEntry.serverConfig.env).toEqual({ CUSTOM_PATH: '/custom/path' });
      // Should preserve original fields
      expect(customEntry.serverConfig.name).toBe(baseFilesystemMarketplaceEntry.serverConfig.name);
      expect(customEntry.serverConfig.command).toBe(baseFilesystemMarketplaceEntry.serverConfig.command);
    });
  });

  describe('Cross-Schema Compatibility', () => {
    it('should ensure marketplace entries have compatible server configs', () => {
      const entries = [
        baseFilesystemMarketplaceEntry,
        baseMemoryMarketplaceEntry,
        baseGitMarketplaceEntry,
        baseFetchMarketplaceEntry,
        basePostgresMarketplaceEntry,
      ];

      for (const entry of entries) {
        // Validate the entry
        expect(() => MCPMarketplaceEntrySchema.parse(entry)).not.toThrow();

        // Validate the nested server config
        expect(() => MCPServerConfigSchema.parse(entry.serverConfig)).not.toThrow();
      }
    });

    it('should ensure marketplace contains valid entries and sources', () => {
      const marketplaces = [baseMarketplace, baseDevelopmentMarketplace];

      for (const marketplace of marketplaces) {
        // Validate the marketplace
        expect(() => MCPMarketplaceSchema.parse(marketplace)).not.toThrow();

        // Validate each server entry
        for (const server of marketplace.servers) {
          expect(() => MCPMarketplaceEntrySchema.parse(server)).not.toThrow();
        }

        // Validate the source if present
        if (marketplace.source) {
          expect(() => MCPMarketplaceSourceSchema.parse(marketplace.source)).not.toThrow();
        }
      }
    });
  });

  describe('Edge Cases and Boundary Values', () => {
    it('should handle empty arrays and objects', () => {
      const entryWithEmptyArrays = {
        name: 'empty-arrays',
        description: 'Entry with empty arrays',
        version: '1.0.0',
        author: 'Test',
        serverConfig: {
          name: 'empty-config',
          type: 'stdio' as const,
          command: 'test',
          args: [], // Empty array
          env: {}, // Empty object
          autoStart: false,
        },
        capabilities: [], // Empty array
        verified: true,
      };

      expect(() => MCPMarketplaceEntrySchema.parse(entryWithEmptyArrays)).not.toThrow();
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);

      const entryWithLongStrings = {
        name: 'long-name',
        description: longString,
        version: '1.0.0',
        author: longString,
        homepage: `https://example.com/${longString}`,
        repository: `https://github.com/user/${longString}`,
        installCommand: `npm install ${longString}`,
        serverConfig: {
          name: longString,
          type: 'stdio' as const,
          command: longString,
          args: [longString, longString],
          autoStart: false,
        },
        verified: true,
      };

      expect(() => MCPMarketplaceEntrySchema.parse(entryWithLongStrings)).not.toThrow();
    });

    it('should handle maximum refresh interval values', () => {
      const sourceWithMaxInterval = {
        url: 'https://example.com/catalog.json',
        enabled: true,
        refreshIntervalMinutes: Number.MAX_SAFE_INTEGER,
        allowUnverified: false,
      };

      expect(() => MCPMarketplaceSourceSchema.parse(sourceWithMaxInterval)).not.toThrow();
    });

    it('should handle large numbers of servers in marketplace', () => {
      const manyServers = Array.from({ length: 1000 }, (_, i) => ({
        ...baseFilesystemMarketplaceEntry,
        name: `server-${i}`,
      }));

      const largeMarketplace = {
        ...baseMarketplace,
        servers: manyServers,
      };

      expect(() => MCPMarketplaceSchema.parse(largeMarketplace)).not.toThrow();
    });

    it('should handle unicode and special characters', () => {
      const unicodeEntry = {
        name: 'unicode-server-🚀',
        description: 'Unicode test: 你好世界 🌍 émoji ñoño',
        version: '1.0.0',
        author: 'Test Author 👨‍💻',
        serverConfig: {
          name: 'unicode-config-🔧',
          type: 'stdio' as const,
          command: 'test',
          args: ['--unicode', '🌟'],
          env: { 'UNICODE_VAR': '测试值' },
          autoStart: false,
        },
        capabilities: ['unicode-support', 'emoji-🎉'],
        verified: true,
      };

      expect(() => MCPMarketplaceEntrySchema.parse(unicodeEntry)).not.toThrow();
    });
  });
});