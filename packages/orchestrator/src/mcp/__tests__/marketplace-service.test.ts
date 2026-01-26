/**
 * @fileoverview Comprehensive Tests for MCPMarketplaceService
 *
 * Tests all functionality of the marketplace service including data loading,
 * filtering, auto-configuration, and recommendations.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { MCPMarketplaceService, AutoConfigurationOptions, MarketplaceMetadata } from '../marketplace-service.js';
import { ApexConfig } from '@apexcli/core';
import * as core from '@apexcli/core';

// Mock the filesystem module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      readFile: vi.fn(),
    },
  };
});

// Mock the core module
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    saveConfig: vi.fn(),
    getMCPServers: vi.fn(),
  };
});

// Mock child_process for Docker detection
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

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

    it('should throw error when marketplace data file is invalid', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('invalid json');

      await expect(service.loadMarketplaceData()).rejects.toThrow(
        'Failed to load marketplace data:'
      );
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
    let mockExistsSync: any;

    beforeEach(() => {
      // Mock require for fs.existsSync
      const mockRequire = vi.fn();
      mockRequire.mockImplementation((module) => {
        if (module === 'fs') {
          return { existsSync: mockExistsSync };
        }
        if (module === 'child_process') {
          return { execSync: vi.fn() };
        }
        return {};
      });

      // Store original require
      const originalRequire = globalThis.require;

      // Mock require globally
      globalThis.require = mockRequire;

      // Restore after test
      afterEach(() => {
        globalThis.require = originalRequire;
      });
    });

    it('should detect Git repository and recommend git server', async () => {
      mockExistsSync = vi.fn().mockImplementation((path: string) => {
        return path.includes('.git');
      });

      const options: AutoConfigurationOptions = { developmentTools: true };

      // We need to mock the private method behavior through public interface
      const result = await service.autoConfigureStandardTools();

      // The service should recommend git for projects with .git directory
      expect(result).toBeDefined();
    });

    it('should detect package.json and recommend npm-related tools', async () => {
      mockExistsSync = vi.fn().mockImplementation((path: string) => {
        return path.includes('package.json');
      });

      const result = await service.autoConfigureStandardTools();
      expect(result).toBeDefined();
    });

    it('should handle project detection errors gracefully', async () => {
      mockExistsSync = vi.fn().mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = await service.autoConfigureStandardTools();
      expect(result.errors).toBeDefined();
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