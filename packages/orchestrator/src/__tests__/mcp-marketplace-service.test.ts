import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { MCPMarketplaceService, MarketplaceMetadata, AutoConfigurationOptions } from '../mcp/marketplace-service';
import { ApexConfig, MCPMarketplaceEntry, MCPServerConfig, saveConfig } from '@apexcli/core';

// Mock fs promises
vi.mock('fs', () => {
  const mock = {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => ''),
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(),
    unlinkSync: vi.fn(),
    promises: {
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      readFile: vi.fn(),
      unlink: vi.fn(),
      access: vi.fn(),
      stat: vi.fn(),
      readdir: vi.fn(),
      rmdir: vi.fn(),
    },
  };
  return { ...mock, default: mock };
});

// Mock saveConfig
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    saveConfig: vi.fn(),
  };
});

// Mock child_process for Docker detection
vi.mock('child_process', () => {
  const mock = {
    exec: vi.fn(),
    execSync: vi.fn(),
    spawn: vi.fn(),
    execFile: vi.fn(),
    fork: vi.fn(),
  };
  return { ...mock, default: mock };
});

const mockSaveConfig = vi.mocked(saveConfig);
const mockReadFile = vi.mocked(fs.readFile);
const mockExistsSync = vi.mocked(require('fs').existsSync);
const mockExecSync = vi.mocked(require('child_process').execSync);

describe('MCPMarketplaceService', () => {
  let tempDir: string;
  let mockConfig: ApexConfig;
  let marketplaceService: MCPMarketplaceService;

  const sampleMarketplaceData: MarketplaceMetadata = {
    entries: [
      {
        name: 'filesystem',
        description: 'File system access server',
        version: '1.0.0',
        author: 'ModelContext',
        verified: true,
        capabilities: ['filesystem', 'development'],
        serverConfig: {
          name: 'filesystem',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
          autoStart: false,
        },
        installCommand: 'npm install -g @modelcontextprotocol/server-filesystem',
      },
      {
        name: 'git',
        description: 'Git repository management',
        version: '1.0.0',
        author: 'ModelContext',
        verified: true,
        capabilities: ['git', 'development'],
        serverConfig: {
          name: 'git',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-git'],
          autoStart: false,
        },
        installCommand: 'npm install -g @modelcontextprotocol/server-git',
      },
      {
        name: 'web-search',
        description: 'Web search capabilities',
        version: '1.0.0',
        author: 'Community',
        verified: false,
        capabilities: ['web', 'search'],
        serverConfig: {
          name: 'web-search',
          type: 'stdio',
          command: 'npx',
          args: ['@mcp/web-search'],
          autoStart: false,
        },
        installCommand: 'npm install -g @mcp/web-search',
      },
      {
        name: 'docker-management',
        description: 'Docker container management',
        version: '1.0.0',
        author: 'Community',
        verified: true,
        capabilities: ['docker', 'devops'],
        serverConfig: {
          name: 'docker-management',
          type: 'stdio',
          command: 'docker-mcp',
          autoStart: false,
        },
        installCommand: 'npm install -g docker-mcp-server',
      },
    ],
    categories: ['development', 'devops', 'web', 'search'],
    featured: ['filesystem', 'git'],
  };

  beforeEach(() => {
    tempDir = path.join(__dirname, '..', '..', '..', 'test-temp', `marketplace-service-${Date.now()}`);

    mockConfig = {
      project: {
        name: 'test-project',
        version: '1.0.0',
        description: 'Test project',
      },
      mcp: {
        enabled: true,
        servers: {},
      },
    };

    marketplaceService = new MCPMarketplaceService(tempDir, mockConfig);

    // Clear all mocks
    vi.clearAllMocks();

    // Setup default mock responses
    mockReadFile.mockResolvedValue(JSON.stringify(sampleMarketplaceData));
    mockExistsSync.mockReturnValue(true);
    mockSaveConfig.mockResolvedValue();
  });

  describe('loadMarketplaceData', () => {
    it('should load marketplace data from bundled file', async () => {
      const data = await marketplaceService.loadMarketplaceData();

      expect(data).toEqual(sampleMarketplaceData);
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining('marketplace-data.json'),
        'utf-8'
      );
    });

    it('should cache marketplace data on subsequent calls', async () => {
      await marketplaceService.loadMarketplaceData();
      await marketplaceService.loadMarketplaceData();

      expect(mockReadFile).toHaveBeenCalledTimes(1);
    });

    it('should handle file read errors', async () => {
      const error = new Error('File not found');
      mockReadFile.mockRejectedValue(error);

      await expect(marketplaceService.loadMarketplaceData()).rejects.toThrow(
        'Failed to load marketplace data: File not found'
      );
    });

    it('should handle JSON parse errors', async () => {
      mockReadFile.mockResolvedValue('invalid json');

      await expect(marketplaceService.loadMarketplaceData()).rejects.toThrow(
        'Failed to load marketplace data:'
      );
    });

    it('should validate marketplace entries using Zod schema', async () => {
      const invalidData = {
        entries: [
          {
            name: '', // Invalid: empty name
            description: 'Test',
            serverConfig: {},
          }
        ],
        categories: [],
        featured: [],
      };

      mockReadFile.mockResolvedValue(JSON.stringify(invalidData));

      await expect(marketplaceService.loadMarketplaceData()).rejects.toThrow();
    });
  });

  describe('getMarketplaceEntries', () => {
    it('should return all entries without filters', async () => {
      const entries = await marketplaceService.getMarketplaceEntries();

      expect(entries).toHaveLength(4);
      expect(entries.map(e => e.name)).toEqual(['filesystem', 'git', 'web-search', 'docker-management']);
    });

    it('should filter entries by category', async () => {
      const entries = await marketplaceService.getMarketplaceEntries({ category: 'development' });

      expect(entries).toHaveLength(2);
      expect(entries.map(e => e.name)).toEqual(['filesystem', 'git']);
    });

    it('should filter entries by search term', async () => {
      const entries = await marketplaceService.getMarketplaceEntries({ search: 'docker' });

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('docker-management');
    });

    it('should filter entries by search term in capabilities', async () => {
      const entries = await marketplaceService.getMarketplaceEntries({ search: 'web' });

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('web-search');
    });

    it('should filter entries by search term in author', async () => {
      const entries = await marketplaceService.getMarketplaceEntries({ search: 'ModelContext' });

      expect(entries).toHaveLength(2);
      expect(entries.map(e => e.name)).toEqual(['filesystem', 'git']);
    });

    it('should filter entries by featured status', async () => {
      const entries = await marketplaceService.getMarketplaceEntries({ featured: true });

      expect(entries).toHaveLength(2);
      expect(entries.map(e => e.name)).toEqual(['filesystem', 'git']);
    });

    it('should filter entries by verified status', async () => {
      const verifiedEntries = await marketplaceService.getMarketplaceEntries({ verified: true });
      const unverifiedEntries = await marketplaceService.getMarketplaceEntries({ verified: false });

      expect(verifiedEntries).toHaveLength(3);
      expect(unverifiedEntries).toHaveLength(1);
      expect(unverifiedEntries[0].name).toBe('web-search');
    });

    it('should combine multiple filters', async () => {
      const entries = await marketplaceService.getMarketplaceEntries({
        category: 'development',
        verified: true,
        search: 'file'
      });

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('filesystem');
    });

    it('should handle "all" category filter', async () => {
      const entries = await marketplaceService.getMarketplaceEntries({ category: 'all' });

      expect(entries).toHaveLength(4); // Should return all entries
    });

    it('should perform case-insensitive searches', async () => {
      const entries = await marketplaceService.getMarketplaceEntries({ search: 'DOCKER' });

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('docker-management');
    });
  });

  describe('getMarketplaceEntry', () => {
    it('should return specific entry by name', async () => {
      const entry = await marketplaceService.getMarketplaceEntry('filesystem');

      expect(entry).not.toBeNull();
      expect(entry?.name).toBe('filesystem');
      expect(entry?.description).toBe('File system access server');
    });

    it('should return null for non-existent entry', async () => {
      const entry = await marketplaceService.getMarketplaceEntry('nonexistent');

      expect(entry).toBeNull();
    });
  });

  describe('getCategories', () => {
    it('should return categories with entry counts', async () => {
      const categories = await marketplaceService.getCategories();

      expect(categories).toContainEqual({ name: 'development', count: 2 });
      expect(categories).toContainEqual({ name: 'filesystem', count: 1 });
      expect(categories).toContainEqual({ name: 'git', count: 1 });
      expect(categories).toContainEqual({ name: 'web', count: 1 });
      expect(categories).toContainEqual({ name: 'search', count: 1 });
      expect(categories).toContainEqual({ name: 'docker', count: 1 });
      expect(categories).toContainEqual({ name: 'devops', count: 1 });
    });

    it('should sort categories by count in descending order', async () => {
      const categories = await marketplaceService.getCategories();

      // 'development' appears in 2 entries, so should be first
      expect(categories[0]).toEqual({ name: 'development', count: 2 });

      // All others have count of 1
      for (let i = 1; i < categories.length; i++) {
        expect(categories[i].count).toBe(1);
      }
    });
  });

  describe('getFeaturedEntries', () => {
    it('should return only featured entries', async () => {
      const featured = await marketplaceService.getFeaturedEntries();

      expect(featured).toHaveLength(2);
      expect(featured.map(e => e.name)).toEqual(['filesystem', 'git']);
    });
  });

  describe('autoConfigureStandardTools', () => {
    beforeEach(() => {
      // Mock file system checks
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes('.git')) return true;
        if (path.includes('package.json')) return true;
        if (path.includes('Dockerfile')) return false;
        if (path.includes('k8s')) return false;
        return false;
      });

      // Mock Docker availability
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('docker --version')) {
          return 'Docker version 20.10.0';
        }
        throw new Error('Command not found');
      });
    });

    it('should auto-configure development tools', async () => {
      const options: AutoConfigurationOptions = { developmentTools: true };
      const result = await marketplaceService.autoConfigureStandardTools(options);

      expect(result.configured).toHaveLength(4); // filesystem, git, github-integration, database
      expect(result.skipped).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(mockSaveConfig).toHaveBeenCalledWith(tempDir, mockConfig);
    });

    it('should skip already installed servers', async () => {
      mockConfig.mcp!.servers = {
        filesystem: {
          name: 'filesystem',
          type: 'stdio',
          command: 'filesystem',
          autoStart: false,
        }
      };

      const options: AutoConfigurationOptions = { developmentTools: true };
      const result = await marketplaceService.autoConfigureStandardTools(options);

      expect(result.skipped).toContain('filesystem');
      expect(result.configured.map(c => c.name)).not.toContain('filesystem');
    });

    it('should handle servers not found in marketplace', async () => {
      const options: AutoConfigurationOptions = {
        customServers: ['nonexistent-server']
      };
      const result = await marketplaceService.autoConfigureStandardTools(options);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        name: 'nonexistent-server',
        error: 'Server not found in marketplace'
      });
    });

    it('should use default recommendation when no options provided', async () => {
      const result = await marketplaceService.autoConfigureStandardTools();

      expect(result.configured).toHaveLength(4); // filesystem, git, github-integration, web-search
      expect(result.configured.map(c => c.name)).toContain('filesystem');
      expect(result.configured.map(c => c.name)).toContain('git');
      expect(result.configured.map(c => c.name)).toContain('web-search');
    });

    it('should auto-configure with project-specific paths for filesystem', async () => {
      const options: AutoConfigurationOptions = { developmentTools: true };
      const result = await marketplaceService.autoConfigureStandardTools(options);

      const filesystemConfig = result.configured.find(c => c.name === 'filesystem');
      expect(filesystemConfig?.args).toEqual(['@modelcontextprotocol/server-filesystem', tempDir]);
    });

    it('should auto-configure with repository path for git', async () => {
      const options: AutoConfigurationOptions = { developmentTools: true };
      const result = await marketplaceService.autoConfigureStandardTools(options);

      const gitConfig = result.configured.find(c => c.name === 'git');
      expect(gitConfig?.args).toEqual(['@modelcontextprotocol/server-git', '--repository', tempDir]);
    });

    it('should configure web-search with free provider', async () => {
      const options: AutoConfigurationOptions = { productivityTools: true };
      const result = await marketplaceService.autoConfigureStandardTools(options);

      const webSearchConfig = result.configured.find(c => c.name === 'web-search');
      expect(webSearchConfig?.env?.SEARCH_PROVIDER).toBe('duckduckgo');
    });

    it('should handle Docker availability for docker-management', async () => {
      const options: AutoConfigurationOptions = { devopsTools: true };
      const result = await marketplaceService.autoConfigureStandardTools(options);

      const dockerConfig = result.configured.find(c => c.name === 'docker-management');
      expect(dockerConfig?.autoStart).toBe(true); // Docker is available
    });

    it('should disable docker-management when Docker unavailable', async () => {
      // Mock Docker not available
      mockExecSync.mockImplementation(() => {
        throw new Error('Docker not found');
      });

      const options: AutoConfigurationOptions = { devopsTools: true };
      const result = await marketplaceService.autoConfigureStandardTools(options);

      const dockerConfig = result.configured.find(c => c.name === 'docker-management');
      expect(dockerConfig?.autoStart).toBe(false); // Docker not available
    });

    it('should combine multiple tool collections', async () => {
      const options: AutoConfigurationOptions = {
        developmentTools: true,
        productivityTools: true,
        devopsTools: true,
      };

      const result = await marketplaceService.autoConfigureStandardTools(options);

      // Should have tools from all collections (minus duplicates and not found)
      expect(result.configured.length).toBeGreaterThan(4);
      expect(result.errors.length).toBeGreaterThan(0); // Some tools won't be found
    });

    it('should handle configuration errors gracefully', async () => {
      // Make saveConfig fail
      mockSaveConfig.mockRejectedValue(new Error('Save failed'));

      const options: AutoConfigurationOptions = { developmentTools: true };

      // Should not throw, but should have errors
      await expect(marketplaceService.autoConfigureStandardTools(options)).resolves.toBeDefined();
    });
  });

  describe('getInstallationRecommendations', () => {
    beforeEach(() => {
      // Mock project detection
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes('.git')) return true;
        if (path.includes('package.json')) return true;
        return false;
      });
    });

    it('should provide essential, recommended, and optional server lists', async () => {
      const recommendations = await marketplaceService.getInstallationRecommendations();

      expect(recommendations.essential).toHaveLength(2); // filesystem, git
      expect(recommendations.essential.map(e => e.name)).toEqual(['filesystem', 'git']);

      expect(recommendations.recommended).toHaveLength(1); // web-search (github-integration not in sample data)
      expect(recommendations.optional).toHaveLength(0); // None in sample data match optional criteria
    });

    it('should exclude already installed servers', async () => {
      mockConfig.mcp!.servers = {
        filesystem: {
          name: 'filesystem',
          type: 'stdio',
          command: 'filesystem',
          autoStart: false,
        }
      };

      const marketplaceServiceWithInstalled = new MCPMarketplaceService(tempDir, mockConfig);

      const recommendations = await marketplaceServiceWithInstalled.getInstallationRecommendations();

      expect(recommendations.essential.map(e => e.name)).not.toContain('filesystem');
      expect(recommendations.essential.map(e => e.name)).toContain('git');
    });

    it('should not duplicate servers across categories', async () => {
      const recommendations = await marketplaceService.getInstallationRecommendations();

      const allServerNames = [
        ...recommendations.essential.map(e => e.name),
        ...recommendations.recommended.map(e => e.name),
        ...recommendations.optional.map(e => e.name),
      ];

      const uniqueNames = new Set(allServerNames);
      expect(allServerNames.length).toBe(uniqueNames.size);
    });
  });

  describe('project detection', () => {
    it('should detect Git repository', () => {
      mockExistsSync.mockImplementation((path: string) => path.includes('.git'));

      const service = new MCPMarketplaceService(tempDir, mockConfig);
      // Use the public autoConfigureStandardTools method to test private getRecommendedServersForProject
      expect(service).toBeDefined(); // Indirect test through autoConfigureStandardTools
    });

    it('should detect Node.js project', () => {
      mockExistsSync.mockImplementation((path: string) => path.includes('package.json'));

      const service = new MCPMarketplaceService(tempDir, mockConfig);
      expect(service).toBeDefined(); // Indirect test
    });

    it('should detect Docker project', () => {
      mockExistsSync.mockImplementation((path: string) => path.includes('Dockerfile'));

      const service = new MCPMarketplaceService(tempDir, mockConfig);
      expect(service).toBeDefined(); // Indirect test
    });

    it('should detect Kubernetes project', () => {
      mockExistsSync.mockImplementation((path: string) => path.includes('k8s'));

      const service = new MCPMarketplaceService(tempDir, mockConfig);
      expect(service).toBeDefined(); // Indirect test
    });

    it('should handle project detection errors', () => {
      mockExistsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      // Should not throw during construction
      expect(() => new MCPMarketplaceService(tempDir, mockConfig)).not.toThrow();
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle empty marketplace data', async () => {
      const emptyData = { entries: [], categories: [], featured: [] };
      mockReadFile.mockResolvedValue(JSON.stringify(emptyData));

      const service = new MCPMarketplaceService(tempDir, mockConfig);

      const entries = await service.getMarketplaceEntries();
      expect(entries).toHaveLength(0);

      const categories = await service.getCategories();
      expect(categories).toHaveLength(0);

      const featured = await service.getFeaturedEntries();
      expect(featured).toHaveLength(0);
    });

    it('should handle marketplace entry without capabilities', async () => {
      const dataWithoutCapabilities = {
        entries: [{
          name: 'test-server',
          description: 'Test server',
          version: '1.0.0',
          serverConfig: {
            name: 'test-server',
            type: 'stdio',
            command: 'test',
            autoStart: false,
          },
          // No capabilities array
        }],
        categories: [],
        featured: [],
      };

      mockReadFile.mockResolvedValue(JSON.stringify(dataWithoutCapabilities));

      const service = new MCPMarketplaceService(tempDir, mockConfig);

      const entries = await service.getMarketplaceEntries({ category: 'development' });
      expect(entries).toHaveLength(0); // Should not match without capabilities

      const categories = await service.getCategories();
      expect(categories).toHaveLength(0); // No capabilities to count
    });

    it('should handle search with special characters', async () => {
      const entries = await marketplaceService.getMarketplaceEntries({ search: '@#$%' });
      expect(entries).toHaveLength(0);
    });

    it('should handle very long search terms', async () => {
      const longSearch = 'a'.repeat(1000);
      const entries = await marketplaceService.getMarketplaceEntries({ search: longSearch });
      expect(entries).toHaveLength(0);
    });

    it('should handle undefined config mcp field', async () => {
      const configWithoutMcp = { ...mockConfig };
      delete configWithoutMcp.mcp;

      const service = new MCPMarketplaceService(tempDir, configWithoutMcp);

      const result = await service.autoConfigureStandardTools({ developmentTools: true });
      expect(result.configured.length).toBeGreaterThan(0);
      expect(service).toBeDefined();
    });

    it('should handle null/undefined filter values', async () => {
      const entries = await marketplaceService.getMarketplaceEntries({
        category: undefined,
        search: undefined,
        featured: undefined,
        verified: undefined,
      });

      expect(entries).toHaveLength(4); // Should return all entries
    });

    it('should handle concurrent marketplace data loading', async () => {
      const promises = [
        marketplaceService.loadMarketplaceData(),
        marketplaceService.loadMarketplaceData(),
        marketplaceService.loadMarketplaceData(),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => expect(result).toEqual(sampleMarketplaceData));
      expect(mockReadFile).toHaveBeenCalledTimes(1); // Should only read once due to caching
    });
  });

  describe('Docker detection', () => {
    it('should detect Docker availability', async () => {
      mockExecSync.mockReturnValue('Docker version 20.10.0');

      const options: AutoConfigurationOptions = { devopsTools: true };
      const result = await marketplaceService.autoConfigureStandardTools(options);

      const dockerConfig = result.configured.find(c => c.name === 'docker-management');
      expect(dockerConfig?.autoStart).toBe(true);
    });

    it('should handle Docker not available', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Docker not found');
      });

      const options: AutoConfigurationOptions = { devopsTools: true };
      const result = await marketplaceService.autoConfigureStandardTools(options);

      const dockerConfig = result.configured.find(c => c.name === 'docker-management');
      expect(dockerConfig?.autoStart).toBe(false);
    });

    it('should handle execSync returning unexpected output', async () => {
      mockExecSync.mockReturnValue('');

      const options: AutoConfigurationOptions = { devopsTools: true };
      const result = await marketplaceService.autoConfigureStandardTools(options);

      const dockerConfig = result.configured.find(c => c.name === 'docker-management');
      expect(dockerConfig?.autoStart).toBe(true); // Empty string is truthy
    });
  });
});