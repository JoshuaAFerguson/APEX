/**
 * Comprehensive unit tests for MCPRegistry
 * Tests all registry functionality including server discovery, filtering, and catalog management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPRegistry, MCPCatalogLoadError, MCPCatalogValidationError } from '../mcp/mcp-registry.js';
import type { MCPMarketplaceEntry, MCPServerConfig } from '../types.js';
import fs from 'fs';

// Mock fs module
vi.mock('fs');
const mockReadFileSync = vi.mocked(fs.readFileSync);

describe('MCPRegistry', () => {
  const mockCatalog = {
    version: '1.0.0',
    updated: '2024-01-01T00:00:00.000Z',
    description: 'Test MCP catalog',
    servers: [
      {
        name: 'filesystem',
        title: 'Filesystem Server',
        description: 'Secure filesystem access for MCP',
        version: '1.0.0',
        category: 'filesystem',
        verified: true,
        featured: true,
        capabilities: ['file:read', 'file:write', 'directory:list'],
        serverConfig: {
          name: 'filesystem',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          autoStart: true,
        } as MCPServerConfig,
        envVars: [],
        tags: ['filesystem', 'files'],
        author: 'Anthropic',
        license: 'MIT',
        repository: 'https://github.com/modelcontextprotocol/servers',
        documentationUrl: 'https://docs.modelcontextprotocol.io/servers/filesystem',
        installCount: 1000,
        rating: 4.8,
        reviewCount: 125,
        lastUpdated: '2024-01-01T00:00:00.000Z',
        createdAt: '2023-12-01T00:00:00.000Z',
      } as MCPMarketplaceEntry,
      {
        name: 'github',
        title: 'GitHub Server',
        description: 'GitHub integration for MCP',
        version: '1.1.0',
        category: 'development',
        verified: true,
        featured: false,
        capabilities: ['git:clone', 'git:push', 'api:github'],
        serverConfig: {
          name: 'github',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          autoStart: false,
        } as MCPServerConfig,
        envVars: [
          {
            name: 'GITHUB_TOKEN',
            description: 'GitHub personal access token',
            required: true,
          },
        ],
        tags: ['git', 'github', 'development'],
        author: 'Anthropic',
        license: 'MIT',
        repository: 'https://github.com/modelcontextprotocol/servers',
        documentationUrl: 'https://docs.modelcontextprotocol.io/servers/github',
        installCount: 750,
        rating: 4.6,
        reviewCount: 89,
        lastUpdated: '2024-01-15T00:00:00.000Z',
        createdAt: '2023-11-15T00:00:00.000Z',
      } as MCPMarketplaceEntry,
      {
        name: 'postgres',
        title: 'PostgreSQL Server',
        description: 'PostgreSQL database access',
        version: '1.2.0',
        category: 'database',
        verified: false,
        featured: false,
        capabilities: ['db:query', 'db:schema', 'sql:execute'],
        serverConfig: {
          name: 'postgres',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-postgres'],
          autoStart: false,
        } as MCPServerConfig,
        envVars: [
          {
            name: 'DATABASE_URL',
            description: 'PostgreSQL connection string',
            required: true,
          },
        ],
        tags: ['database', 'sql', 'postgres'],
        author: 'Community',
        license: 'MIT',
        repository: 'https://github.com/modelcontextprotocol/servers',
        documentationUrl: 'https://docs.modelcontextprotocol.io/servers/postgres',
        installCount: 300,
        rating: 4.2,
        reviewCount: 45,
        lastUpdated: '2024-01-10T00:00:00.000Z',
        createdAt: '2023-10-01T00:00:00.000Z',
      } as MCPMarketplaceEntry,
    ],
    categories: {
      filesystem: {
        name: 'Filesystem',
        description: 'File and directory operations',
      },
      development: {
        name: 'Development',
        description: 'Development and version control tools',
      },
      database: {
        name: 'Database',
        description: 'Database connectivity and operations',
      },
    },
  };

  beforeEach(() => {
    // Reset singleton
    MCPRegistry.resetInstance();

    // Mock successful catalog loading
    mockReadFileSync.mockReturnValue(JSON.stringify(mockCatalog));
  });

  afterEach(() => {
    vi.clearAllMocks();
    MCPRegistry.resetInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = MCPRegistry.getInstance();
      const instance2 = MCPRegistry.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = MCPRegistry.getInstance();
      MCPRegistry.resetInstance();
      const instance2 = MCPRegistry.getInstance();

      expect(instance1).not.toBe(instance2);
    });

    it('should only use options from first getInstance call', () => {
      const instance1 = MCPRegistry.getInstance({ validateOnLoad: false });
      const instance2 = MCPRegistry.getInstance({ validateOnLoad: true });

      expect(instance1).toBe(instance2);
      // Validation behavior should be from first call (false)
    });
  });

  describe('Catalog Loading', () => {
    it('should load catalog successfully', () => {
      const registry = MCPRegistry.getInstance();

      expect(mockReadFileSync).toHaveBeenCalled();
      expect(registry.size).toBe(3);
    });

    it('should throw MCPCatalogLoadError for invalid JSON', () => {
      MCPRegistry.resetInstance();
      mockReadFileSync.mockReturnValue('invalid json');

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogLoadError);
    });

    it('should throw MCPCatalogLoadError for file read error', () => {
      MCPRegistry.resetInstance();
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogLoadError);
    });

    it('should use custom catalog path when provided', () => {
      MCPRegistry.resetInstance();
      const customPath = '/custom/catalog.json';

      MCPRegistry.getInstance({ catalogPath: customPath });

      expect(mockReadFileSync).toHaveBeenCalledWith(customPath, 'utf-8');
    });

    it('should skip validation when validateOnLoad is false', () => {
      MCPRegistry.resetInstance();
      const invalidCatalog = { ...mockCatalog };
      delete invalidCatalog.version;
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance({ validateOnLoad: false })).not.toThrow();
    });
  });

  describe('Catalog Validation', () => {
    it('should validate required fields', () => {
      MCPRegistry.resetInstance();
      const invalidCatalog = { ...mockCatalog };
      delete invalidCatalog.version;
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogValidationError);
    });

    it('should validate servers array', () => {
      MCPRegistry.resetInstance();
      const invalidCatalog = { ...mockCatalog, servers: 'not an array' as any };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogValidationError);
    });

    it('should validate server structure', () => {
      MCPRegistry.resetInstance();
      const invalidCatalog = {
        ...mockCatalog,
        servers: [
          {
            // Missing name
            description: 'Test server',
            serverConfig: { type: 'stdio', command: 'test' }
          }
        ]
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogValidationError);
    });

    it('should validate categories object', () => {
      MCPRegistry.resetInstance();
      const invalidCatalog = { ...mockCatalog, categories: 'not an object' as any };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogValidationError);
    });
  });

  describe('Server Listing', () => {
    let registry: MCPRegistry;

    beforeEach(() => {
      registry = MCPRegistry.getInstance();
    });

    it('should list all servers without filter', () => {
      const servers = registry.listServers();

      expect(servers).toHaveLength(3);
      expect(servers.map(s => s.name)).toEqual(['filesystem', 'github', 'postgres']);
    });

    it('should filter by category', () => {
      const servers = registry.listServers({ category: 'development' });

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('github');
    });

    it('should return empty array for non-existent category', () => {
      const servers = registry.listServers({ category: 'nonexistent' });

      expect(servers).toHaveLength(0);
    });

    it('should filter by verification status', () => {
      const verifiedServers = registry.listServers({ verified: true });
      const unverifiedServers = registry.listServers({ verified: false });

      expect(verifiedServers).toHaveLength(2);
      expect(verifiedServers.map(s => s.name)).toEqual(['filesystem', 'github']);
      expect(unverifiedServers).toHaveLength(1);
      expect(unverifiedServers[0].name).toBe('postgres');
    });

    it('should filter by capabilities', () => {
      const fileServers = registry.listServers({ capabilities: ['file:read'] });
      const gitServers = registry.listServers({ capabilities: ['git:clone'] });

      expect(fileServers).toHaveLength(1);
      expect(fileServers[0].name).toBe('filesystem');
      expect(gitServers).toHaveLength(1);
      expect(gitServers[0].name).toBe('github');
    });

    it('should filter by multiple capabilities (AND logic)', () => {
      const servers = registry.listServers({ capabilities: ['file:read', 'file:write'] });

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('filesystem');
    });

    it('should filter by search text', () => {
      const fsServers = registry.listServers({ search: 'filesystem' });
      const gitServers = registry.listServers({ search: 'GitHub' });
      const dbServers = registry.listServers({ search: 'database' });

      expect(fsServers).toHaveLength(1);
      expect(fsServers[0].name).toBe('filesystem');
      expect(gitServers).toHaveLength(1);
      expect(gitServers[0].name).toBe('github');
      expect(dbServers).toHaveLength(1);
      expect(dbServers[0].name).toBe('postgres');
    });

    it('should search case-insensitively', () => {
      const servers = registry.listServers({ search: 'GITHUB' });

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('github');
    });

    it('should combine multiple filters', () => {
      const servers = registry.listServers({
        verified: true,
        capabilities: ['file:read'],
        search: 'filesystem'
      });

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('filesystem');
    });

    it('should return empty array when no servers match combined filters', () => {
      const servers = registry.listServers({
        verified: false,
        capabilities: ['file:read']
      });

      expect(servers).toHaveLength(0);
    });
  });

  describe('Server Lookup', () => {
    let registry: MCPRegistry;

    beforeEach(() => {
      registry = MCPRegistry.getInstance();
    });

    it('should get server by name', () => {
      const server = registry.getServer('filesystem');

      expect(server).not.toBeNull();
      expect(server?.name).toBe('filesystem');
      expect(server?.description).toBe('Secure filesystem access for MCP');
    });

    it('should return null for non-existent server', () => {
      const server = registry.getServer('nonexistent');

      expect(server).toBeNull();
    });

    it('should check if server exists', () => {
      expect(registry.hasServer('filesystem')).toBe(true);
      expect(registry.hasServer('nonexistent')).toBe(false);
    });

    it('should get server configuration', () => {
      const config = registry.getServerConfig('filesystem');

      expect(config).not.toBeNull();
      expect(config?.name).toBe('filesystem');
      expect(config?.command).toBe('npx');
      expect(config?.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem']);
    });

    it('should return null for non-existent server config', () => {
      const config = registry.getServerConfig('nonexistent');

      expect(config).toBeNull();
    });
  });

  describe('Category Management', () => {
    let registry: MCPRegistry;

    beforeEach(() => {
      registry = MCPRegistry.getInstance();
    });

    it('should get all categories', () => {
      const categories = registry.getCategories();

      expect(categories).toHaveLength(3);
      expect(categories.map(c => c.id)).toEqual(['filesystem', 'development', 'database']);
      expect(categories[0]).toEqual({
        id: 'filesystem',
        name: 'Filesystem',
        description: 'File and directory operations',
      });
    });

    it('should get servers by category', () => {
      const developmentServers = registry.getServersByCategory('development');
      const filesystemServers = registry.getServersByCategory('filesystem');

      expect(developmentServers).toHaveLength(1);
      expect(developmentServers[0].name).toBe('github');
      expect(filesystemServers).toHaveLength(1);
      expect(filesystemServers[0].name).toBe('filesystem');
    });

    it('should return empty array for non-existent category', () => {
      const servers = registry.getServersByCategory('nonexistent');

      expect(servers).toHaveLength(0);
    });
  });

  describe('Capability Management', () => {
    let registry: MCPRegistry;

    beforeEach(() => {
      registry = MCPRegistry.getInstance();
    });

    it('should get servers by capability', () => {
      const fileServers = registry.getServersByCapability('file:read');
      const gitServers = registry.getServersByCapability('git:clone');
      const dbServers = registry.getServersByCapability('db:query');

      expect(fileServers).toHaveLength(1);
      expect(fileServers[0].name).toBe('filesystem');
      expect(gitServers).toHaveLength(1);
      expect(gitServers[0].name).toBe('github');
      expect(dbServers).toHaveLength(1);
      expect(dbServers[0].name).toBe('postgres');
    });

    it('should return empty array for non-existent capability', () => {
      const servers = registry.getServersByCapability('nonexistent:capability');

      expect(servers).toHaveLength(0);
    });

    it('should get all unique capabilities', () => {
      const capabilities = registry.getAllCapabilities();

      expect(capabilities).toEqual([
        'api:github',
        'db:query',
        'db:schema',
        'directory:list',
        'file:read',
        'file:write',
        'git:clone',
        'git:push',
        'sql:execute',
      ]);
    });
  });

  describe('Utility Methods', () => {
    let registry: MCPRegistry;

    beforeEach(() => {
      registry = MCPRegistry.getInstance();
    });

    it('should get catalog size', () => {
      expect(registry.size).toBe(3);
    });

    it('should get catalog info', () => {
      const info = registry.getCatalogInfo();

      expect(info).toEqual({
        version: '1.0.0',
        updated: '2024-01-01T00:00:00.000Z',
        description: 'Test MCP catalog',
      });
    });

    it('should get all server names', () => {
      const names = registry.getServerNames();

      expect(names).toEqual(['filesystem', 'github', 'postgres']);
    });
  });

  describe('Category Inference', () => {
    beforeEach(() => {
      // Create a mock catalog with servers that need category inference
      const catalogWithInference = {
        ...mockCatalog,
        servers: [
          {
            name: 'file-server',
            description: 'File operations',
            serverConfig: { name: 'file-server', type: 'stdio', command: 'test' },
            capabilities: ['file:read', 'directory:list'],
          },
          {
            name: 'web-server',
            description: 'Web operations',
            serverConfig: { name: 'web-server', type: 'stdio', command: 'test' },
            capabilities: ['http:get', 'browser:navigate'],
          },
          {
            name: 'git-server',
            description: 'Git operations',
            serverConfig: { name: 'git-server', type: 'stdio', command: 'test' },
            capabilities: ['git:clone'],
          },
          {
            name: 'db-server',
            description: 'Database operations',
            serverConfig: { name: 'db-server', type: 'stdio', command: 'test' },
            capabilities: ['db:query', 'sql:execute'],
          },
          {
            name: 'system-server',
            description: 'System operations',
            serverConfig: { name: 'system-server', type: 'stdio', command: 'test' },
            capabilities: ['shell:exec', 'docker:run'],
          },
          {
            name: 'search-server',
            description: 'Search operations',
            serverConfig: { name: 'search-server', type: 'stdio', command: 'test' },
            capabilities: ['search:web'],
          },
          {
            name: 'mixed-server',
            description: 'Mixed operations',
            serverConfig: { name: 'mixed-server', type: 'stdio', command: 'test' },
            capabilities: ['file:read', 'http:get'], // Multiple categories - should be uncategorized
          },
          {
            name: 'no-caps-server',
            description: 'No capabilities',
            serverConfig: { name: 'no-caps-server', type: 'stdio', command: 'test' },
            capabilities: [],
          },
        ] as MCPMarketplaceEntry[],
      };

      MCPRegistry.resetInstance();
      mockReadFileSync.mockReturnValue(JSON.stringify(catalogWithInference));
    });

    it('should infer filesystem category from capabilities', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.getServersByCategory('filesystem');

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('file-server');
    });

    it('should infer web category from capabilities', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.getServersByCategory('web');

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('web-server');
    });

    it('should infer development category from git capabilities', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.getServersByCategory('development');

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('git-server');
    });

    it('should infer database category from capabilities', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.getServersByCategory('database');

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('db-server');
    });

    it('should infer system category from capabilities', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.getServersByCategory('system');

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('system-server');
    });

    it('should infer search category from capabilities', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.getServersByCategory('search');

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('search-server');
    });

    it('should use uncategorized for servers with multiple category matches', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.getServersByCategory('uncategorized');

      expect(servers).toHaveLength(2); // mixed-server and no-caps-server
      expect(servers.map(s => s.name)).toEqual(['mixed-server', 'no-caps-server']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty catalog', () => {
      MCPRegistry.resetInstance();
      const emptyCatalog = {
        version: '1.0.0',
        updated: '2024-01-01T00:00:00.000Z',
        description: 'Empty catalog',
        servers: [],
        categories: {},
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(emptyCatalog));

      const registry = MCPRegistry.getInstance();

      expect(registry.size).toBe(0);
      expect(registry.listServers()).toHaveLength(0);
      expect(registry.getCategories()).toHaveLength(0);
      expect(registry.getAllCapabilities()).toHaveLength(0);
    });

    it('should handle servers with missing optional fields', () => {
      MCPRegistry.resetInstance();
      const minimalCatalog = {
        version: '1.0.0',
        updated: '2024-01-01T00:00:00.000Z',
        description: 'Minimal catalog',
        servers: [
          {
            name: 'minimal-server',
            description: 'Minimal server',
            serverConfig: {
              name: 'minimal-server',
              type: 'stdio',
              command: 'test',
              autoStart: false,
            },
          } as MCPMarketplaceEntry,
        ],
        categories: {},
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(minimalCatalog));

      const registry = MCPRegistry.getInstance();
      const servers = registry.listServers();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('minimal-server');
      expect(servers[0].capabilities).toBeUndefined();
    });

    it('should handle null and undefined filter values', () => {
      const registry = MCPRegistry.getInstance();

      const servers1 = registry.listServers({ category: undefined });
      const servers2 = registry.listServers({ search: undefined });
      const servers3 = registry.listServers({ capabilities: undefined });
      const servers4 = registry.listServers({ verified: undefined });

      expect(servers1).toHaveLength(3);
      expect(servers2).toHaveLength(3);
      expect(servers3).toHaveLength(3);
      expect(servers4).toHaveLength(3);
    });

    it('should handle empty string search', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.listServers({ search: '' });

      expect(servers).toHaveLength(3);
    });

    it('should handle empty capabilities array', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.listServers({ capabilities: [] });

      expect(servers).toHaveLength(3);
    });
  });

  describe('Convenience Functions', () => {
    beforeEach(() => {
      // Reset to ensure clean state
      MCPRegistry.resetInstance();
    });

    it('should provide getMCPRegistry convenience function', async () => {
      const { getMCPRegistry } = await import('../mcp/mcp-registry.js');

      const registry1 = getMCPRegistry();
      const registry2 = getMCPRegistry();

      expect(registry1).toBe(registry2);
    });

    it('should provide listMCPServers convenience function', async () => {
      const { listMCPServers } = await import('../mcp/mcp-registry.js');

      const servers = listMCPServers({ search: 'filesystem' });

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('filesystem');
    });

    it('should provide getMCPServer convenience function', async () => {
      const { getMCPServer } = await import('../mcp/mcp-registry.js');

      const server = getMCPServer('filesystem');

      expect(server?.name).toBe('filesystem');
    });

    it('should provide getMCPServerConfig convenience function', async () => {
      const { getMCPServerConfig } = await import('../mcp/mcp-registry.js');

      const config = getMCPServerConfig('filesystem');

      expect(config?.name).toBe('filesystem');
      expect(config?.command).toBe('npx');
    });

    it('should handle non-existent servers in convenience functions', async () => {
      const { getMCPServer, getMCPServerConfig } = await import('../mcp/mcp-registry.js');

      expect(getMCPServer('nonexistent')).toBeNull();
      expect(getMCPServerConfig('nonexistent')).toBeNull();
    });
  });
});