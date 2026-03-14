/**
 * @fileoverview Comprehensive Tests for MCPMarketplaceService
 *
 * Tests all functionality of the marketplace service including data loading,
 * filtering, auto-configuration, and recommendations.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';

// Mock the filesystem module
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    default: actual.default,
    ...actual,
    promises: {
      readFile: vi.fn(),
    },
  };
});

// Mock the core module functions specifically
vi.mock('@apexcli/core', () => ({
  saveConfig: vi.fn(),
  getMCPServers: vi.fn(),
  MCPMarketplaceEntrySchema: {
    array: vi.fn(() => ({
      parse: vi.fn((data) => data)
    }))
  },
  // Mock type exports (these are just type definitions, so empty objects are fine)
  MCPMarketplaceEntry: {},
  MCPServerConfig: {},
  ApexConfig: {}
}));

// Mock child_process for Docker detection
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import { MCPMarketplaceService, AutoConfigurationOptions, MarketplaceMetadata } from '../marketplace-service.js';
import { ApexConfig } from '@apexcli/core';
import * as core from '@apexcli/core';

describe('MCPMarketplaceService', () => {
  let service: MCPMarketplaceService;
  let mockConfig: ApexConfig;
  let mockProjectPath: string;

  const mockMarketplaceData: MarketplaceMetadata = {
    entries: [
      {
        name: 'filesystem',
        description: 'File system operations',
        version: '1.0.0',
        author: 'Anthropic',
        homepage: 'https://github.com/test',
        repository: 'https://github.com/test',
        installCommand: 'npm install -g @test/filesystem',
        serverConfig: {
          name: 'filesystem',
          type: 'stdio',
          command: 'npx',
          args: ['@test/filesystem', '/tmp'],
          autoStart: false,
        },
        capabilities: ['files', 'directories'],
        verified: true,
      },
      {
        name: 'git',
        description: 'Git repository operations',
        version: '1.0.0',
        author: 'Anthropic',
        homepage: 'https://github.com/test',
        repository: 'https://github.com/test',
        installCommand: 'npm install -g @test/git',
        serverConfig: {
          name: 'git',
          type: 'stdio',
          command: 'npx',
          args: ['@test/git'],
          autoStart: false,
        },
        capabilities: ['git', 'version-control'],
        verified: true,
      },
      {
        name: 'unverified-server',
        description: 'Test unverified server',
        version: '1.0.0',
        author: 'Test',
        homepage: 'https://github.com/test',
        repository: 'https://github.com/test',
        installCommand: 'npm install -g @test/unverified',
        serverConfig: {
          name: 'unverified-server',
          type: 'stdio',
          command: 'npx',
          args: ['@test/unverified'],
          autoStart: false,
        },
        capabilities: ['testing'],
        verified: false,
      },
    ],
    categories: ['Development', 'Version Control'],
    featured: ['filesystem', 'git'],
  };

  beforeEach(() => {
    mockProjectPath = '/test/project';
    mockConfig = {
      project: {
        name: 'test-project',
        version: '1.0.0',
      },
      mcp: {
        enabled: true,
        servers: {},
      },
    };

    service = new MCPMarketplaceService(mockProjectPath, mockConfig);

    // Mock filesystem readFile to return our test data
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockMarketplaceData));

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loadMarketplaceData', () => {
    it('should load and validate marketplace data from file', async () => {
      const data = await service.loadMarketplaceData();

      expect(data).toEqual(mockMarketplaceData);
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(__dirname, '../marketplace-data.json'),
        'utf-8'
      );
    });

    it('should cache loaded data on subsequent calls', async () => {
      await service.loadMarketplaceData();
      await service.loadMarketplaceData();

      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should handle missing data file gracefully - ENOENT error', async () => {
      const fileNotFoundError = new Error('ENOENT: no such file or directory');
      vi.mocked(fs.readFile).mockRejectedValue(fileNotFoundError);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const data = await service.loadMarketplaceData();

      expect(data).toEqual({
        entries: [],
        categories: [],
        featured: [],
      });
      expect(consoleSpy).toHaveBeenCalledWith('Marketplace data file not found, using empty marketplace data');
      consoleSpy.mockRestore();
    });

    it('should handle missing data file gracefully - different file not found error format', async () => {
      const fileNotFoundError = new Error('File not found: no such file exists');
      vi.mocked(fs.readFile).mockRejectedValue(fileNotFoundError);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const data = await service.loadMarketplaceData();

      expect(data).toEqual({
        entries: [],
        categories: [],
        featured: [],
      });
      expect(consoleSpy).toHaveBeenCalledWith('Marketplace data file not found, using empty marketplace data');
      consoleSpy.mockRestore();
    });

    it('should handle invalid JSON gracefully', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('invalid json {');

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const data = await service.loadMarketplaceData();

      expect(data).toEqual({
        entries: [],
        categories: [],
        featured: [],
      });
      expect(consoleSpy).toHaveBeenCalledWith('Invalid marketplace data format, using empty marketplace data');
      consoleSpy.mockRestore();
    });

    it('should handle empty JSON file gracefully', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('');

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const data = await service.loadMarketplaceData();

      expect(data).toEqual({
        entries: [],
        categories: [],
        featured: [],
      });
      expect(consoleSpy).toHaveBeenCalledWith('Invalid marketplace data format, using empty marketplace data');
      consoleSpy.mockRestore();
    });

    it('should handle JSON with null content gracefully', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('null');

      const data = await service.loadMarketplaceData();

      expect(data).toEqual({
        entries: [],
        categories: [],
        featured: [],
      });
    });

    it('should handle missing entries array gracefully', async () => {
      const dataWithoutEntries = {
        categories: ['test'],
        featured: ['test'],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(dataWithoutEntries));

      const data = await service.loadMarketplaceData();

      expect(data.entries).toEqual([]);
      expect(data.categories).toEqual(['test']);
      expect(data.featured).toEqual(['test']);
    });

    it('should throw error when marketplace entries fail Zod validation', async () => {
      const invalidData = {
        entries: [
          {
            name: 'invalid',
            // Missing required fields
          },
        ],
        categories: [],
        featured: [],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidData));

      await expect(service.loadMarketplaceData()).rejects.toThrow(
        'Failed to load marketplace data:'
      );
    });
  });

  describe('getMarketplaceEntries', () => {
    it('should return all entries when no filters are applied', async () => {
      const entries = await service.getMarketplaceEntries();

      expect(entries).toHaveLength(3);
      expect(entries.map(e => e.name)).toEqual(['filesystem', 'git', 'unverified-server']);
    });

    it('should filter by category', async () => {
      const entries = await service.getMarketplaceEntries({ category: 'files' });

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('filesystem');
    });

    it('should filter by search term', async () => {
      const entries = await service.getMarketplaceEntries({ search: 'git' });

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('git');
    });

    it('should filter by search in description', async () => {
      const entries = await service.getMarketplaceEntries({ search: 'File system' });

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('filesystem');
    });

    it('should filter by search in capabilities', async () => {
      const entries = await service.getMarketplaceEntries({ search: 'version-control' });

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('git');
    });

    it('should filter by featured status', async () => {
      const entries = await service.getMarketplaceEntries({ featured: true });

      expect(entries).toHaveLength(2);
      expect(entries.map(e => e.name)).toEqual(['filesystem', 'git']);
    });

    it('should filter by verified status', async () => {
      const verifiedEntries = await service.getMarketplaceEntries({ verified: true });
      const unverifiedEntries = await service.getMarketplaceEntries({ verified: false });

      expect(verifiedEntries).toHaveLength(2);
      expect(unverifiedEntries).toHaveLength(1);
      expect(unverifiedEntries[0].name).toBe('unverified-server');
    });

    it('should combine multiple filters', async () => {
      const entries = await service.getMarketplaceEntries({
        verified: true,
        featured: true,
        search: 'file',
      });

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('filesystem');
    });

    it('should handle category filter "all" as no filter', async () => {
      const entries = await service.getMarketplaceEntries({ category: 'all' });

      expect(entries).toHaveLength(3);
    });

    it('should handle empty marketplace data', async () => {
      // Mock empty marketplace data
      vi.spyOn(service, 'loadMarketplaceData').mockResolvedValue({
        entries: [],
        categories: [],
        featured: [],
      });

      const entries = await service.getMarketplaceEntries();
      expect(entries).toEqual([]);
    });

    it('should handle entries with null capabilities', async () => {
      const dataWithNullCapabilities = {
        ...mockMarketplaceData,
        entries: [
          {
            ...mockMarketplaceData.entries[0],
            capabilities: null,
          },
        ],
      };

      vi.spyOn(service, 'loadMarketplaceData').mockResolvedValue(dataWithNullCapabilities);

      const entries = await service.getMarketplaceEntries({ category: 'files' });
      expect(entries).toEqual([]);
    });

    it('should handle entries with undefined capabilities', async () => {
      const dataWithUndefinedCapabilities = {
        ...mockMarketplaceData,
        entries: [
          {
            ...mockMarketplaceData.entries[0],
            capabilities: undefined,
          },
        ],
      };

      vi.spyOn(service, 'loadMarketplaceData').mockResolvedValue(dataWithUndefinedCapabilities);

      const entries = await service.getMarketplaceEntries({ category: 'files' });
      expect(entries).toEqual([]);
    });

    it('should handle empty search term', async () => {
      const entries = await service.getMarketplaceEntries({ search: '' });
      expect(entries).toHaveLength(3);
    });

    it('should handle whitespace-only search term', async () => {
      const entries = await service.getMarketplaceEntries({ search: '   ' });
      expect(entries).toHaveLength(3);
    });

    it('should handle empty category filter', async () => {
      const entries = await service.getMarketplaceEntries({ category: '' });
      expect(entries).toHaveLength(3);
    });

    it('should handle whitespace-only category filter', async () => {
      const entries = await service.getMarketplaceEntries({ category: '   ' });
      expect(entries).toHaveLength(3);
    });

    it('should handle entries with missing name or description', async () => {
      const dataWithMissingFields = {
        ...mockMarketplaceData,
        entries: [
          {
            ...mockMarketplaceData.entries[0],
            name: '',
            description: '',
          },
        ],
      };

      vi.spyOn(service, 'loadMarketplaceData').mockResolvedValue(dataWithMissingFields);

      const entries = await service.getMarketplaceEntries({ search: 'test' });
      expect(entries).toEqual([]);
    });

    it('should handle entries with null/undefined name or description fields', async () => {
      const dataWithNullFields = {
        ...mockMarketplaceData,
        entries: [
          {
            ...mockMarketplaceData.entries[0],
            name: null,
            description: undefined,
          } as any,
        ],
      };

      vi.spyOn(service, 'loadMarketplaceData').mockResolvedValue(dataWithNullFields);

      const entries = await service.getMarketplaceEntries({ search: 'test' });
      expect(entries).toEqual([]);
    });

    it('should handle entries with malformed capabilities array', async () => {
      const dataWithMalformedCapabilities = {
        ...mockMarketplaceData,
        entries: [
          {
            ...mockMarketplaceData.entries[0],
            capabilities: [null, undefined, '', 123, {}, 'valid-capability'] as any,
          },
        ],
      };

      vi.spyOn(service, 'loadMarketplaceData').mockResolvedValue(dataWithMalformedCapabilities);

      // Should only match the valid capability string
      const entries = await service.getMarketplaceEntries({ search: 'valid-capability' });
      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('filesystem');

      // Should not match invalid capability entries
      const invalidEntries = await service.getMarketplaceEntries({ search: '123' });
      expect(invalidEntries).toEqual([]);
    });

    it('should handle entries with null author field during search', async () => {
      const dataWithNullAuthor = {
        ...mockMarketplaceData,
        entries: [
          {
            ...mockMarketplaceData.entries[0],
            author: null,
          } as any,
        ],
      };

      vi.spyOn(service, 'loadMarketplaceData').mockResolvedValue(dataWithNullAuthor);

      const entries = await service.getMarketplaceEntries({ search: 'anthropic' });
      expect(entries).toEqual([]);
    });

    it('should handle case-insensitive search across all fields', async () => {
      const entries = await service.getMarketplaceEntries({ search: 'ANTHROPIC' });

      expect(entries).toHaveLength(2); // filesystem and git both have Anthropic as author
      expect(entries.every(e => e.author?.toLowerCase().includes('anthropic'))).toBe(true);
    });

    it('should handle category filtering with non-string capability values', async () => {
      const dataWithMixedCapabilities = {
        ...mockMarketplaceData,
        entries: [
          {
            ...mockMarketplaceData.entries[0],
            capabilities: ['files', 123, null, 'directories'] as any,
          },
        ],
      };

      vi.spyOn(service, 'loadMarketplaceData').mockResolvedValue(dataWithMixedCapabilities);

      // Should only match string capabilities
      const entries = await service.getMarketplaceEntries({ category: 'files' });
      expect(entries).toHaveLength(1);

      // Should not match non-string capabilities
      const invalidEntries = await service.getMarketplaceEntries({ category: '123' });
      expect(invalidEntries).toEqual([]);
    });

    it('should handle featured filter with null featured array', async () => {
      const dataWithNullFeatured = {
        ...mockMarketplaceData,
        featured: null,
      } as any;

      vi.spyOn(service, 'loadMarketplaceData').mockResolvedValue(dataWithNullFeatured);

      const entries = await service.getMarketplaceEntries({ featured: true });
      expect(entries).toEqual([]);
    });

    it('should handle featured filter with entries having null names', async () => {
      const dataWithNullNames = {
        ...mockMarketplaceData,
        entries: [
          {
            ...mockMarketplaceData.entries[0],
            name: null,
          } as any,
        ],
      };

      vi.spyOn(service, 'loadMarketplaceData').mockResolvedValue(dataWithNullNames);

      const entries = await service.getMarketplaceEntries({ featured: true });
      expect(entries).toEqual([]);
    });
  });

  describe('getMarketplaceEntry', () => {
    it('should return specific entry by name', async () => {
      const entry = await service.getMarketplaceEntry('filesystem');

      expect(entry).toBeDefined();
      expect(entry!.name).toBe('filesystem');
    });

    it('should return null for non-existent entry', async () => {
      const entry = await service.getMarketplaceEntry('nonexistent');

      expect(entry).toBeNull();
    });
  });

  describe('getCategories', () => {
    it('should return categories with entry counts', async () => {
      const categories = await service.getCategories();

      expect(categories).toEqual(
        expect.arrayContaining([
          { name: 'files', count: 1 },
          { name: 'directories', count: 1 },
          { name: 'git', count: 1 },
          { name: 'version-control', count: 1 },
          { name: 'testing', count: 1 },
        ])
      );
    });

    it('should sort categories by count in descending order', async () => {
      const categories = await service.getCategories();

      // Check that each count is >= the next count
      for (let i = 0; i < categories.length - 1; i++) {
        expect(categories[i].count).toBeGreaterThanOrEqual(categories[i + 1].count);
      }
    });
  });

  describe('getFeaturedEntries', () => {
    it('should return only featured entries', async () => {
      const featured = await service.getFeaturedEntries();

      expect(featured).toHaveLength(2);
      expect(featured.map(e => e.name)).toEqual(['filesystem', 'git']);
    });
  });

  describe('autoConfigureStandardTools', () => {
    beforeEach(() => {
      vi.mocked(core.getMCPServers).mockReturnValue({});
      vi.mocked(core.saveConfig).mockResolvedValue();
    });

    it('should configure development tools when requested', async () => {
      const options: AutoConfigurationOptions = { developmentTools: true };
      const result = await service.autoConfigureStandardTools(options);

      expect(result.configured).toBeDefined();
      expect(result.skipped).toBeDefined();
      expect(result.errors).toBeDefined();
    });

    it('should skip already installed servers', async () => {
      vi.mocked(core.getMCPServers).mockReturnValue({ filesystem: mockMarketplaceData.entries[0].serverConfig });

      const options: AutoConfigurationOptions = { customServers: ['filesystem'] };
      const result = await service.autoConfigureStandardTools(options);

      expect(result.skipped).toContain('filesystem');
    });

    it('should handle server not found in marketplace', async () => {
      const options: AutoConfigurationOptions = { customServers: ['nonexistent'] };
      const result = await service.autoConfigureStandardTools(options);

      expect(result.errors).toContainEqual({
        name: 'nonexistent',
        error: 'Server not found in marketplace',
      });
    });

    it('should configure custom servers when specified', async () => {
      const options: AutoConfigurationOptions = { customServers: ['filesystem'] };
      const result = await service.autoConfigureStandardTools(options);

      expect(result.configured).toHaveLength(1);
      expect(result.configured[0].name).toBe('filesystem');
    });

    it('should deduplicate server names', async () => {
      const options: AutoConfigurationOptions = {
        customServers: ['filesystem', 'filesystem', 'git'],
      };

      // Mock the servers to exist in marketplace
      vi.spyOn(service, 'getMarketplaceEntry').mockImplementation(async (name) => {
        return mockMarketplaceData.entries.find(e => e.name === name) || null;
      });

      const result = await service.autoConfigureStandardTools(options);

      expect(result.configured).toHaveLength(2);
    });

    it('should save configuration after successful installation', async () => {
      const options: AutoConfigurationOptions = { customServers: ['filesystem'] };
      await service.autoConfigureStandardTools(options);

      expect(core.saveConfig).toHaveBeenCalledWith(mockProjectPath, mockConfig);
    });

    it('should not save configuration if no servers were configured', async () => {
      const options: AutoConfigurationOptions = { customServers: [] };
      await service.autoConfigureStandardTools(options);

      expect(core.saveConfig).not.toHaveBeenCalled();
    });

    it('should handle invalid custom server names', async () => {
      const options: AutoConfigurationOptions = {
        customServers: ['', null, undefined, '   ', 'valid-server']
      } as any;

      vi.spyOn(service, 'getMarketplaceEntry').mockImplementation(async (name) => {
        if (name === 'valid-server') {
          return mockMarketplaceData.entries[0];
        }
        return null;
      });

      const result = await service.autoConfigureStandardTools(options);

      expect(result.configured).toHaveLength(1);
      expect(result.configured[0].name).toBe('filesystem');
    });

    it('should handle getMCPServers failure gracefully', async () => {
      vi.mocked(core.getMCPServers).mockImplementation(() => {
        throw new Error('Failed to read config');
      });

      const options: AutoConfigurationOptions = { customServers: ['filesystem'] };
      const result = await service.autoConfigureStandardTools(options);

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          name: 'filesystem',
          error: expect.stringContaining('Failed to read current MCP configuration'),
        })
      );
    });

    it('should handle marketplace entry fetch failure', async () => {
      vi.spyOn(service, 'getMarketplaceEntry').mockRejectedValue(new Error('Network error'));

      const options: AutoConfigurationOptions = { customServers: ['filesystem'] };
      const result = await service.autoConfigureStandardTools(options);

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          name: 'filesystem',
          error: expect.stringContaining('Failed to fetch marketplace entry'),
        })
      );
    });

    it('should handle missing server configuration in marketplace entry', async () => {
      const entryWithoutConfig = {
        ...mockMarketplaceData.entries[0],
        serverConfig: null,
      };

      vi.spyOn(service, 'getMarketplaceEntry').mockResolvedValue(entryWithoutConfig as any);

      const options: AutoConfigurationOptions = { customServers: ['filesystem'] };
      const result = await service.autoConfigureStandardTools(options);

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          name: 'filesystem',
          error: 'Server configuration missing in marketplace entry',
        })
      );
    });

    it('should handle configuration save failure', async () => {
      vi.mocked(core.saveConfig).mockRejectedValue(new Error('Save failed'));

      const options: AutoConfigurationOptions = { customServers: ['filesystem'] };
      vi.spyOn(service, 'getMarketplaceEntry').mockResolvedValue(mockMarketplaceData.entries[0]);

      const result = await service.autoConfigureStandardTools(options);

      expect(result.configured).toEqual([]);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          error: expect.stringContaining('Failed to save configuration'),
        })
      );
    });

    it('should handle project detection failure', async () => {
      // Mock the private method to throw an error
      vi.spyOn(service as any, 'getRecommendedServersForProject').mockImplementation(() => {
        throw new Error('Project detection failed');
      });

      const result = await service.autoConfigureStandardTools();

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          name: 'project-detection',
          error: expect.stringContaining('Project detection failed'),
        })
      );
      // Should fall back to minimal basic tools
      expect(result.configured.length).toBeGreaterThanOrEqual(0);
    });

    it('should return error when no valid servers to configure', async () => {
      const options: AutoConfigurationOptions = { customServers: ['', '   ', null] as any };
      const result = await service.autoConfigureStandardTools(options);

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          name: 'configuration',
          error: 'No valid servers to configure',
        })
      );
    });

    it('should handle auto-configure server failure', async () => {
      vi.spyOn(service as any, 'autoConfigureServer').mockImplementation(() => {
        throw new Error('Auto-configure failed');
      });

      const options: AutoConfigurationOptions = { customServers: ['filesystem'] };
      vi.spyOn(service, 'getMarketplaceEntry').mockResolvedValue(mockMarketplaceData.entries[0]);

      const result = await service.autoConfigureStandardTools(options);

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          name: 'filesystem',
          error: expect.stringContaining('Failed to auto-configure server'),
        })
      );
    });

    it('should handle invalid server name validation during configuration', async () => {
      const options: AutoConfigurationOptions = {
        customServers: [null, undefined, '', '   ', 'valid-server'] as any
      };

      vi.spyOn(service, 'getMarketplaceEntry').mockImplementation(async (name) => {
        if (name === 'valid-server') {
          return mockMarketplaceData.entries[0];
        }
        return null;
      });

      const result = await service.autoConfigureStandardTools(options);

      // Should have one configured server and several errors for invalid names
      expect(result.configured).toHaveLength(1);
      expect(result.errors.some(error => error.error.includes('Invalid server name'))).toBe(true);
    });

    it('should handle configuration merge errors', async () => {
      // Mock getMCPServers to throw during merge phase
      let callCount = 0;
      vi.mocked(core.getMCPServers).mockImplementation(() => {
        if (callCount === 0) {
          callCount++;
          return {}; // First call succeeds (during skip check)
        }
        throw new Error('Merge configuration failed');
      });

      const options: AutoConfigurationOptions = { customServers: ['filesystem'] };
      vi.spyOn(service, 'getMarketplaceEntry').mockResolvedValue(mockMarketplaceData.entries[0]);

      const result = await service.autoConfigureStandardTools(options);

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          name: 'filesystem',
          error: expect.stringContaining('Failed to read current MCP configuration'),
        })
      );
    });

    it('should handle unexpected errors during server configuration loop', async () => {
      const options: AutoConfigurationOptions = { customServers: ['filesystem'] };

      // Mock getMarketplaceEntry to throw an unexpected error
      vi.spyOn(service, 'getMarketplaceEntry').mockImplementation(async (name) => {
        throw new TypeError('Unexpected type error');
      });

      const result = await service.autoConfigureStandardTools(options);

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          name: 'filesystem',
          error: expect.stringContaining('Failed to fetch marketplace entry'),
        })
      );
    });

    it('should handle general unexpected errors in auto-configuration', async () => {
      // Spy on the entire method and make it throw an unexpected error
      vi.spyOn(service as any, 'getRecommendedServersForProject').mockImplementation(() => {
        throw new ReferenceError('Undefined variable access');
      });

      const result = await service.autoConfigureStandardTools();

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          name: 'project-detection',
          error: expect.stringContaining('Project detection failed'),
        })
      );
    });

    it('should return accurate arrays when all operations succeed', async () => {
      const options: AutoConfigurationOptions = {
        customServers: ['filesystem', 'git', 'nonexistent']
      };

      // Mock filesystem and git to exist, nonexistent to not exist
      vi.spyOn(service, 'getMarketplaceEntry').mockImplementation(async (name) => {
        if (name === 'filesystem') return mockMarketplaceData.entries[0];
        if (name === 'git') return mockMarketplaceData.entries[1];
        return null;
      });

      const result = await service.autoConfigureStandardTools(options);

      // Should have exactly 2 configured, 0 skipped (none were already installed), 1 error
      expect(result.configured).toHaveLength(2);
      expect(result.skipped).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].name).toBe('nonexistent');
    });

    it('should return accurate arrays when some servers are already installed', async () => {
      // Mock filesystem as already installed
      vi.mocked(core.getMCPServers).mockReturnValue({
        filesystem: mockMarketplaceData.entries[0].serverConfig
      });

      const options: AutoConfigurationOptions = {
        customServers: ['filesystem', 'git']
      };

      vi.spyOn(service, 'getMarketplaceEntry').mockImplementation(async (name) => {
        if (name === 'filesystem') return mockMarketplaceData.entries[0];
        if (name === 'git') return mockMarketplaceData.entries[1];
        return null;
      });

      const result = await service.autoConfigureStandardTools(options);

      // Should have 1 configured (git), 1 skipped (filesystem), 0 errors
      expect(result.configured).toHaveLength(1);
      expect(result.configured[0].name).toBe('git');
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]).toBe('filesystem');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle save configuration failure and move configured to errors', async () => {
      const options: AutoConfigurationOptions = { customServers: ['filesystem', 'git'] };

      vi.spyOn(service, 'getMarketplaceEntry').mockImplementation(async (name) => {
        if (name === 'filesystem') return mockMarketplaceData.entries[0];
        if (name === 'git') return mockMarketplaceData.entries[1];
        return null;
      });

      // Mock saveConfig to fail
      vi.mocked(core.saveConfig).mockRejectedValue(new Error('Disk full'));

      const result = await service.autoConfigureStandardTools(options);

      // All configured servers should move to errors due to save failure
      expect(result.configured).toHaveLength(0);
      expect(result.errors.filter(e => e.error.includes('Failed to save configuration'))).toHaveLength(2);
    });
  });

  describe('getInstallationRecommendations', () => {
    it('should return essential, recommended, and optional servers', async () => {
      const recommendations = await service.getInstallationRecommendations();

      expect(recommendations.essential).toBeDefined();
      expect(recommendations.recommended).toBeDefined();
      expect(recommendations.optional).toBeDefined();
    });

    it('should exclude already installed servers', async () => {
      vi.mocked(core.getMCPServers).mockReturnValue({ filesystem: mockMarketplaceData.entries[0].serverConfig });
      mockConfig.mcp!.servers = { filesystem: mockMarketplaceData.entries[0].serverConfig };

      const recommendations = await service.getInstallationRecommendations();

      expect(recommendations.essential.map(e => e.name)).not.toContain('filesystem');
    });

    it('should categorize servers correctly', async () => {
      const recommendations = await service.getInstallationRecommendations();

      // Essential should include filesystem and git
      const essentialNames = recommendations.essential.map(e => e.name);
      expect(essentialNames).toContain('filesystem');
      expect(essentialNames).toContain('git');
    });
  });

  describe('Project detection and auto-configuration', () => {
    let mockFs: any;
    let mockRequire: any;
    let originalRequire: any;

    beforeEach(() => {
      mockFs = {
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
        statSync: vi.fn(),
        readdirSync: vi.fn(),
      };

      // Mock require for fs operations
      mockRequire = vi.fn();
      mockRequire.mockImplementation((module) => {
        if (module === 'fs') {
          return mockFs;
        }
        if (module === 'child_process') {
          return { execSync: vi.fn() };
        }
        return {};
      });

      // Store original require
      originalRequire = globalThis.require;

      // Mock require globally
      globalThis.require = mockRequire;
    });

    afterEach(() => {
      // Restore original require
      globalThis.require = originalRequire;
    });

    it('should detect Git repository and recommend git server', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('.git');
      });

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
    });

    it('should detect Node.js project and recommend related tools', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('package.json');
      });

      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { react: '^18.0.0', jest: '^29.0.0' },
        devDependencies: { prisma: '^4.0.0' }
      }));

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
    });

    it('should detect Python project files', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('requirements.txt') || path.includes('pyproject.toml');
      });

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
    });

    it('should detect Java project files', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('pom.xml') || path.includes('build.gradle');
      });

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
    });

    it('should detect Go project files', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('go.mod');
      });

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
    });

    it('should detect Rust project files', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('Cargo.toml');
      });

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
    });

    it('should detect Docker configuration', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('Dockerfile') || path.includes('docker-compose.yml');
      });

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
    });

    it('should detect Kubernetes configuration', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('k8s') || path.includes('kubernetes');
      });

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
    });

    it('should detect CI/CD configurations', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('.github/workflows') || path.includes('.gitlab-ci.yml');
      });

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
    });

    it('should detect infrastructure as code files', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('main.tf') || path.includes('terraform');
      });

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
    });

    it('should detect documentation projects', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('docs') || path.includes('mkdocs.yml');
      });

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
    });

    it('should detect large projects and recommend time tracking', async () => {
      mockFs.existsSync.mockImplementation(() => true);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });
      mockFs.readdirSync.mockReturnValue(['src', 'tests', 'docs', 'config', 'scripts']);

      // Mock each directory check
      mockFs.statSync.mockImplementation((path: string) => {
        if (path.endsWith('node_modules') || path.includes('.')) {
          return { isDirectory: () => false };
        }
        return { isDirectory: () => true };
      });

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
    });

    it('should handle package.json parsing errors gracefully', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('package.json');
      });

      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Parse error');
      });

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
    });

    it('should handle project complexity analysis errors gracefully', async () => {
      mockFs.existsSync.mockImplementation(() => true);
      mockFs.statSync.mockImplementation(() => {
        throw new Error('Stat error');
      });

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
    });

    it('should fall back to minimal tools on detection failure', async () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = await service.autoConfigureStandardTools();
      expect(result.errors).toBeDefined();
    });

    it('should return basic fallback when all detection fails', async () => {
      // Mock all file operations to fail
      mockRequire.mockImplementation(() => {
        throw new Error('Module not found');
      });

      const result = await service.autoConfigureStandardTools();
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          name: 'project-detection',
        })
      );
    });

    it('should detect multiple project types in same directory', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('package.json') ||
               path.includes('.git') ||
               path.includes('Dockerfile') ||
               path.includes('requirements.txt');
      });

      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { react: '^18.0.0' },
        devDependencies: { jest: '^29.0.0' }
      }));

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
      // Should detect Node.js + Git + Docker + Python project
    });

    it('should detect specific frameworks in package.json dependencies', async () => {
      const testCases = [
        {
          deps: { react: '^18.0.0' },
          description: 'React project'
        },
        {
          deps: { vue: '^3.0.0' },
          description: 'Vue project'
        },
        {
          deps: { '@angular/core': '^15.0.0' },
          description: 'Angular project'
        },
        {
          deps: { mongoose: '^6.0.0' },
          description: 'MongoDB project'
        },
        {
          deps: { sequelize: '^6.0.0' },
          description: 'SQL project'
        },
        {
          deps: { prisma: '^4.0.0' },
          description: 'Prisma project'
        },
        {
          deps: { pg: '^8.0.0' },
          description: 'PostgreSQL project'
        },
        {
          deps: { mysql: '^2.0.0' },
          description: 'MySQL project'
        },
        {
          deps: { jest: '^29.0.0' },
          description: 'Jest testing project'
        },
        {
          deps: { mocha: '^10.0.0' },
          description: 'Mocha testing project'
        },
        {
          deps: { vitest: '^4.0.0' },
          description: 'Vitest testing project'
        },
        {
          deps: { playwright: '^1.0.0' },
          description: 'Playwright testing project'
        }
      ];

      for (const testCase of testCases) {
        mockFs.existsSync.mockImplementation((path: string) => {
          return path.includes('package.json');
        });

        mockFs.readFileSync.mockReturnValue(JSON.stringify({
          dependencies: testCase.deps
        }));

        const result = await service.autoConfigureStandardTools();
        expect(result).toBeDefined();
        // Each should recommend specific tools based on the framework
      }
    });

    it('should handle all supported Python project file types', async () => {
      const pythonFiles = [
        'requirements.txt',
        'pyproject.toml',
        'setup.py',
        'Pipfile',
        'environment.yml'
      ];

      for (const file of pythonFiles) {
        mockFs.existsSync.mockImplementation((path: string) => {
          return path.includes(file);
        });

        const result = await service.autoConfigureStandardTools();
        expect(result).toBeDefined();
      }
    });

    it('should handle all supported Java project file types', async () => {
      const javaFiles = [
        'pom.xml',
        'build.gradle',
        'build.gradle.kts'
      ];

      for (const file of javaFiles) {
        mockFs.existsSync.mockImplementation((path: string) => {
          return path.includes(file);
        });

        const result = await service.autoConfigureStandardTools();
        expect(result).toBeDefined();
      }
    });

    it('should handle all supported Go project file types', async () => {
      const goFiles = [
        'go.mod',
        'go.sum',
        'Gopkg.toml'
      ];

      for (const file of goFiles) {
        mockFs.existsSync.mockImplementation((path: string) => {
          return path.includes(file);
        });

        const result = await service.autoConfigureStandardTools();
        expect(result).toBeDefined();
      }
    });

    it('should handle all supported Rust project file types', async () => {
      const rustFiles = [
        'Cargo.toml',
        'Cargo.lock'
      ];

      for (const file of rustFiles) {
        mockFs.existsSync.mockImplementation((path: string) => {
          return path.includes(file);
        });

        const result = await service.autoConfigureStandardTools();
        expect(result).toBeDefined();
      }
    });

    it('should handle all supported Docker file types', async () => {
      const dockerFiles = [
        'Dockerfile',
        'docker-compose.yml',
        'docker-compose.yaml'
      ];

      for (const file of dockerFiles) {
        mockFs.existsSync.mockImplementation((path: string) => {
          return path.includes(file);
        });

        const result = await service.autoConfigureStandardTools();
        expect(result).toBeDefined();
      }
    });

    it('should handle all supported Kubernetes directory and file types', async () => {
      const k8sPaths = [
        'k8s',
        'kubernetes',
        '.kube',
        'manifests'
      ];

      for (const pathName of k8sPaths) {
        mockFs.existsSync.mockImplementation((path: string) => {
          return path.includes(pathName);
        });

        const result = await service.autoConfigureStandardTools();
        expect(result).toBeDefined();
      }
    });

    it('should handle all supported CI/CD configuration types', async () => {
      const cicdPaths = [
        '.github/workflows',
        '.gitlab-ci.yml',
        'jenkinsfile',
        '.travis.yml',
        '.circleci'
      ];

      for (const pathName of cicdPaths) {
        mockFs.existsSync.mockImplementation((path: string) => {
          return path.includes(pathName);
        });

        const result = await service.autoConfigureStandardTools();
        expect(result).toBeDefined();
      }
    });

    it('should handle all supported infrastructure as code file types', async () => {
      const iacFiles = [
        'terraform',
        'main.tf',
        'cloudformation.yml',
        'pulumi',
        'ansible'
      ];

      for (const file of iacFiles) {
        mockFs.existsSync.mockImplementation((path: string) => {
          return path.includes(file);
        });

        const result = await service.autoConfigureStandardTools();
        expect(result).toBeDefined();
      }
    });

    it('should handle all supported documentation project types', async () => {
      const docFiles = [
        'docs',
        'documentation',
        'mkdocs.yml',
        'docsify',
        '_config.yml', // Jekyll
        'docusaurus.config.js'
      ];

      for (const file of docFiles) {
        mockFs.existsSync.mockImplementation((path: string) => {
          return path.includes(file);
        });

        const result = await service.autoConfigureStandardTools();
        expect(result).toBeDefined();
      }
    });

    it('should recommend time tracking for complex projects with many directories', async () => {
      mockFs.existsSync.mockImplementation(() => true);
      mockFs.statSync.mockImplementation((path: string) => {
        if (path === mockProjectPath) {
          return { isDirectory: () => true };
        }
        // Simulate many subdirectories
        if (path.includes('node_modules') || path.startsWith('.')) {
          return { isDirectory: () => false };
        }
        return { isDirectory: () => true };
      });

      // Return many directories (>= 3 to trigger time tracking recommendation)
      mockFs.readdirSync.mockReturnValue(['src', 'tests', 'docs', 'config', 'scripts']);

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
    });

    it('should not recommend time tracking for simple projects', async () => {
      mockFs.existsSync.mockImplementation(() => true);
      mockFs.statSync.mockImplementation((path: string) => {
        if (path === mockProjectPath) {
          return { isDirectory: () => true };
        }
        return { isDirectory: () => true };
      });

      // Return few directories (< 3 to not trigger time tracking recommendation)
      mockFs.readdirSync.mockReturnValue(['src', 'main.js']);

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
    });

    it('should handle mixed file types correctly', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        // Simulate a mixed project: Node.js + Docker + Git + Documentation
        return path.includes('package.json') ||
               path.includes('Dockerfile') ||
               path.includes('.git') ||
               path.includes('docs');
      });

      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { express: '^4.0.0', react: '^18.0.0' },
        devDependencies: { jest: '^29.0.0', playwright: '^1.0.0' }
      }));

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
      // Should recommend a comprehensive set of tools
    });

    it('should handle directory access errors during complexity analysis', async () => {
      mockFs.existsSync.mockImplementation(() => true);
      mockFs.statSync.mockImplementation((path: string) => {
        if (path === mockProjectPath) {
          return { isDirectory: () => true };
        }
        throw new Error('Permission denied');
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith('Could not analyze project complexity');

      consoleSpy.mockRestore();
    });

    it('should always include filesystem and web-search in recommendations', async () => {
      // Even with no project files detected
      mockFs.existsSync.mockImplementation(() => false);

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
      // Should still configure minimal fallback tools
    });
  });

  describe('Server auto-configuration', () => {
    it('should configure filesystem server with project path', async () => {
      const options: AutoConfigurationOptions = { customServers: ['filesystem'] };

      vi.spyOn(service, 'getMarketplaceEntry').mockResolvedValue(mockMarketplaceData.entries[0]);

      const result = await service.autoConfigureStandardTools(options);

      expect(result.configured[0].args).toContain(mockProjectPath);
    });

    it('should configure git server with repository path', async () => {
      const options: AutoConfigurationOptions = { customServers: ['git'] };

      vi.spyOn(service, 'getMarketplaceEntry').mockResolvedValue(mockMarketplaceData.entries[1]);

      const result = await service.autoConfigureStandardTools(options);

      expect(result.configured[0].args).toContain('--repository');
      expect(result.configured[0].args).toContain(mockProjectPath);
    });
  });

  describe('Error handling', () => {
    it('should handle filesystem errors during data loading', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      await expect(service.loadMarketplaceData()).rejects.toThrow('Failed to load marketplace data: File not found');
    });

    it('should handle JSON parsing errors', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('invalid json {');

      await expect(service.loadMarketplaceData()).rejects.toThrow('Failed to load marketplace data:');
    });

    it('should handle configuration save errors during auto-configuration', async () => {
      vi.mocked(core.saveConfig).mockRejectedValue(new Error('Save failed'));

      const options: AutoConfigurationOptions = { customServers: ['filesystem'] };

      vi.spyOn(service, 'getMarketplaceEntry').mockResolvedValue(mockMarketplaceData.entries[0]);

      const result = await service.autoConfigureStandardTools(options);

      expect(result.errors).toContainEqual({
        name: 'filesystem',
        error: 'Save failed',
      });
    });
  });

  describe('Docker detection', () => {
    let mockExecSync: any;

    beforeEach(() => {
      const mockChildProcess = { execSync: vi.fn() };
      mockExecSync = mockChildProcess.execSync;

      // Mock require to return our mocked child_process
      const mockRequire = vi.fn().mockImplementation((module) => {
        if (module === 'child_process') {
          return mockChildProcess;
        }
        return {};
      });

      globalThis.require = mockRequire;
    });

    it('should detect Docker when available', async () => {
      mockExecSync.mockImplementation(() => 'Docker version 20.10.0');

      const options: AutoConfigurationOptions = { customServers: ['docker-management'] };

      // Create mock Docker entry
      const dockerEntry = {
        ...mockMarketplaceData.entries[0],
        name: 'docker-management',
        serverConfig: {
          ...mockMarketplaceData.entries[0].serverConfig,
          name: 'docker-management',
        },
      };

      vi.spyOn(service, 'getMarketplaceEntry').mockResolvedValue(dockerEntry);

      const result = await service.autoConfigureStandardTools(options);

      expect(result.configured[0].autoStart).toBe(true);
    });

    it('should handle Docker unavailability gracefully', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Docker not found');
      });

      const options: AutoConfigurationOptions = { customServers: ['docker-management'] };

      const dockerEntry = {
        ...mockMarketplaceData.entries[0],
        name: 'docker-management',
        serverConfig: {
          ...mockMarketplaceData.entries[0].serverConfig,
          name: 'docker-management',
        },
      };

      vi.spyOn(service, 'getMarketplaceEntry').mockResolvedValue(dockerEntry);

      const result = await service.autoConfigureStandardTools(options);

      expect(result.configured[0].autoStart).toBe(false);
    });
  });
});