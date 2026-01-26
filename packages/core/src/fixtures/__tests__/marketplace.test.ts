/**
 * @fileoverview Tests for Marketplace Fixtures
 *
 * Validates that marketplace fixtures are properly typed and exportable.
 */

import { describe, expect, it } from 'vitest';
import type {
  MCPMarketplaceEntry,
  MCPServer,
  MCPServerConfig,
  MCPMarketplace,
  MCPMarketplaceSource,
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
  baseServerConfigs,
  baseMarketplaceEntries,
  baseMarketplaceSources,
  baseMarketplaces,
  createMarketplaceEntry,
  createServerConfig,
  createMarketplace,
  getVerifiedEntries,
  getEntriesByCapability,
} from '../marketplace.js';

describe('Marketplace Fixtures', () => {
  describe('Base marketplace entries', () => {
    it('should export valid filesystem marketplace entry', () => {
      expect(baseFilesystemMarketplaceEntry).toBeDefined();
      expect(baseFilesystemMarketplaceEntry.name).toBe('filesystem-server');
      expect(baseFilesystemMarketplaceEntry.description).toContain('filesystem');
      expect(baseFilesystemMarketplaceEntry.verified).toBe(true);
      expect(baseFilesystemMarketplaceEntry.serverConfig).toBeDefined();
      expect(baseFilesystemMarketplaceEntry.serverConfig.type).toBe('stdio');
    });

    it('should export valid memory marketplace entry', () => {
      expect(baseMemoryMarketplaceEntry).toBeDefined();
      expect(baseMemoryMarketplaceEntry.name).toBe('memory-server');
      expect(baseMemoryMarketplaceEntry.description).toContain('memory');
      expect(baseMemoryMarketplaceEntry.verified).toBe(true);
    });

    it('should export valid git marketplace entry', () => {
      expect(baseGitMarketplaceEntry).toBeDefined();
      expect(baseGitMarketplaceEntry.name).toBe('git-server');
      expect(baseGitMarketplaceEntry.description).toContain('git');
      expect(baseGitMarketplaceEntry.verified).toBe(true);
    });

    it('should export valid fetch marketplace entry', () => {
      expect(baseFetchMarketplaceEntry).toBeDefined();
      expect(baseFetchMarketplaceEntry.name).toBe('fetch-server');
      expect(baseFetchMarketplaceEntry.description).toContain('HTTP');
      expect(baseFetchMarketplaceEntry.verified).toBe(true);
    });

    it('should export valid postgres marketplace entry', () => {
      expect(basePostgresMarketplaceEntry).toBeDefined();
      expect(basePostgresMarketplaceEntry.name).toBe('postgres-server');
      expect(basePostgresMarketplaceEntry.description).toContain('PostgreSQL');
      expect(basePostgresMarketplaceEntry.verified).toBe(true);
    });
  });

  describe('Marketplace sources', () => {
    it('should export valid base marketplace source', () => {
      expect(baseMarketplaceSource).toBeDefined();
      expect(baseMarketplaceSource.url).toContain('registry.modelcontextprotocol.io');
      expect(baseMarketplaceSource.enabled).toBe(true);
      expect(baseMarketplaceSource.allowUnverified).toBe(false);
    });

    it('should export valid development marketplace source', () => {
      expect(baseDevelopmentMarketplaceSource).toBeDefined();
      expect(baseDevelopmentMarketplaceSource.url).toContain('dev.registry');
      expect(baseDevelopmentMarketplaceSource.allowUnverified).toBe(true);
    });

    it('should export valid local marketplace source', () => {
      expect(baseLocalMarketplaceSource).toBeDefined();
      expect(baseLocalMarketplaceSource.url).toContain('file://');
      expect(baseLocalMarketplaceSource.allowUnverified).toBe(true);
    });
  });

  describe('Complete marketplaces', () => {
    it('should export valid base marketplace', () => {
      expect(baseMarketplace).toBeDefined();
      expect(baseMarketplace.name).toBe('MCP Registry');
      expect(baseMarketplace.servers).toHaveLength(5);
      expect(baseMarketplace.source).toBeDefined();
    });

    it('should export valid development marketplace', () => {
      expect(baseDevelopmentMarketplace).toBeDefined();
      expect(baseDevelopmentMarketplace.name).toBe('MCP Development Registry');
      expect(baseDevelopmentMarketplace.servers).toHaveLength(3);
    });
  });

  describe('Fixture collections', () => {
    it('should export server config collection', () => {
      expect(baseServerConfigs).toBeDefined();
      expect(baseServerConfigs.filesystem).toBeDefined();
      expect(baseServerConfigs.memory).toBeDefined();
      expect(baseServerConfigs.git).toBeDefined();
      expect(baseServerConfigs.fetch).toBeDefined();
      expect(baseServerConfigs.postgres).toBeDefined();
    });

    it('should export marketplace entries collection', () => {
      expect(baseMarketplaceEntries).toBeDefined();
      expect(baseMarketplaceEntries.filesystem).toBeDefined();
      expect(baseMarketplaceEntries.memory).toBeDefined();
      expect(baseMarketplaceEntries.git).toBeDefined();
      expect(baseMarketplaceEntries.fetch).toBeDefined();
      expect(baseMarketplaceEntries.postgres).toBeDefined();
    });

    it('should export marketplace sources collection', () => {
      expect(baseMarketplaceSources).toBeDefined();
      expect(baseMarketplaceSources.default).toBeDefined();
      expect(baseMarketplaceSources.development).toBeDefined();
      expect(baseMarketplaceSources.local).toBeDefined();
    });

    it('should export marketplaces collection', () => {
      expect(baseMarketplaces).toBeDefined();
      expect(baseMarketplaces.default).toBeDefined();
      expect(baseMarketplaces.development).toBeDefined();
    });
  });

  describe('Utility functions', () => {
    it('should create custom marketplace entry', () => {
      const customEntry = createMarketplaceEntry(baseFilesystemMarketplaceEntry, {
        name: 'custom-filesystem',
        verified: false,
      });

      expect(customEntry.name).toBe('custom-filesystem');
      expect(customEntry.verified).toBe(false);
      expect(customEntry.description).toBe(baseFilesystemMarketplaceEntry.description);
    });

    it('should create custom server config', () => {
      const customConfig = createServerConfig(baseServerConfigs.filesystem, {
        autoStart: true,
        args: ['custom-arg'],
      });

      expect(customConfig.autoStart).toBe(true);
      expect(customConfig.args).toEqual(['custom-arg']);
      expect(customConfig.name).toBe(baseServerConfigs.filesystem.name);
    });

    it('should create custom marketplace', () => {
      const customMarketplace = createMarketplace(baseMarketplace, {
        name: 'Custom Registry',
        servers: [baseFilesystemMarketplaceEntry],
      });

      expect(customMarketplace.name).toBe('Custom Registry');
      expect(customMarketplace.servers).toHaveLength(1);
      expect(customMarketplace.servers[0]).toBe(baseFilesystemMarketplaceEntry);
    });

    it('should filter verified entries', () => {
      const verifiedEntries = getVerifiedEntries();

      expect(verifiedEntries).toBeInstanceOf(Array);
      expect(verifiedEntries.length).toBeGreaterThan(0);
      expect(verifiedEntries.every(entry => entry.verified === true)).toBe(true);
    });

    it('should filter entries by capability', () => {
      const toolsEntries = getEntriesByCapability('tools');

      expect(toolsEntries).toBeInstanceOf(Array);
      expect(toolsEntries.length).toBeGreaterThan(0);
      expect(toolsEntries.every(entry => entry.capabilities?.includes('tools'))).toBe(true);
    });
  });

  describe('Type compatibility', () => {
    it('should be compatible with MCPMarketplaceEntry type', () => {
      const entry: MCPMarketplaceEntry = baseFilesystemMarketplaceEntry;
      expect(entry).toBeDefined();
    });

    it('should be compatible with MCPServerConfig type', () => {
      const config: MCPServerConfig = baseServerConfigs.filesystem;
      expect(config).toBeDefined();
    });

    it('should be compatible with MCPMarketplace type', () => {
      const marketplace: MCPMarketplace = baseMarketplace;
      expect(marketplace).toBeDefined();
    });

    it('should be compatible with MCPMarketplaceSource type', () => {
      const source: MCPMarketplaceSource = baseMarketplaceSource;
      expect(source).toBeDefined();
    });
  });
});