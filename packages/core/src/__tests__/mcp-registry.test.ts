import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  MCPRegistry,
  MCPCatalogLoadError,
  MCPCatalogValidationError,
  MCPCatalogErrorCode,
  DEFAULT_EMPTY_CATALOG,
  getMCPRegistry,
  listMCPServers,
  getMCPServer,
  getMCPServerConfig,
  type MCPCatalog,
  type MCPFilterOptions,
  type MCPRegistryOptions,
  type ValidationErrorDetail,
} from '../mcp/mcp-registry.js';
import type { MCPMarketplaceEntry, MCPServerConfig } from '../types.js';

// Mock fs to control file system operations
vi.mock('fs', () => {
  const readFileSyncMock = vi.fn();
  return {
    readFileSync: readFileSyncMock,
    default: { readFileSync: readFileSyncMock },
  };
});
const mockReadFileSync = vi.mocked(readFileSync);

describe('MCPRegistry', () => {
  // Sample test catalog for testing
  const mockCatalog: MCPCatalog = {
    version: '1.0.0',
    updated: '2024-01-01T00:00:00Z',
    description: 'Test catalog',
    categories: {
      filesystem: { name: 'File System', description: 'File operations' },
      web: { name: 'Web & HTTP', description: 'Web requests' },
      development: { name: 'Development', description: 'Dev tools' },
      database: { name: 'Database', description: 'Database operations' },
      system: { name: 'System', description: 'System operations' },
      search: { name: 'Search', description: 'Search operations' },
    },
    servers: [
      {
        name: 'filesystem',
        description: 'File system operations',
        version: '1.0.0',
        author: 'Test Author',
        verified: true,
        capabilities: ['file:read', 'file:write', 'directory:list'],
        serverConfig: {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          env: {},
        },
      },
      {
        name: 'fetch',
        description: 'HTTP client for web requests',
        version: '1.0.0',
        author: 'Test Author',
        verified: false,
        capabilities: ['http:get', 'http:post', 'web:request'],
        serverConfig: {
          name: 'fetch',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-fetch'],
          env: {},
        },
      },
      {
        name: 'postgres',
        description: 'PostgreSQL database operations',
        version: '1.0.0',
        verified: true,
        capabilities: ['db:query', 'sql:execute'],
        serverConfig: {
          name: 'postgres',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-postgres'],
          env: { POSTGRES_CONNECTION_STRING: 'required' },
        },
      },
      {
        name: 'uncategorized-server',
        description: 'Server without clear category',
        version: '1.0.0',
        verified: false,
        capabilities: ['misc:operation'],
        serverConfig: {
          name: 'uncategorized-server',
          command: 'npx',
          args: ['-y', '@example/server'],
          env: {},
        },
      },
    ],
  };

  beforeEach(() => {
    // Reset singleton instance before each test
    MCPRegistry.resetInstance();

    // Mock successful file read by default
    mockReadFileSync.mockReturnValue(JSON.stringify(mockCatalog));

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset singleton instance after each test
    MCPRegistry.resetInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const registry1 = MCPRegistry.getInstance();
      const registry2 = MCPRegistry.getInstance();

      expect(registry1).toBe(registry2);
    });

    it('should use options only on first getInstance call', () => {
      const customPath = '/custom/path/catalog.json';

      const registry1 = MCPRegistry.getInstance({ catalogPath: customPath });
      const registry2 = MCPRegistry.getInstance({ catalogPath: '/different/path.json' });

      expect(registry1).toBe(registry2);
      expect(mockReadFileSync).toHaveBeenCalledWith(customPath, 'utf-8');
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('should reset instance correctly', () => {
      const registry1 = MCPRegistry.getInstance();

      MCPRegistry.resetInstance();

      const registry2 = MCPRegistry.getInstance();

      expect(registry1).not.toBe(registry2);
    });
  });

  describe('Catalog Loading', () => {
    it('should load catalog successfully', () => {
      const registry = MCPRegistry.getInstance();

      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
      expect(registry.size).toBe(4);
    });

    it('should use default catalog path when none provided', () => {
      MCPRegistry.getInstance();

      const callArgs = mockReadFileSync.mock.calls[0];
      expect(callArgs[0]).toMatch(/catalog\.json$/);
      expect(callArgs[1]).toBe('utf-8');
    });

    it('should use custom catalog path when provided', () => {
      const customPath = '/custom/catalog.json';

      MCPRegistry.getInstance({ catalogPath: customPath });

      expect(mockReadFileSync).toHaveBeenCalledWith(customPath, 'utf-8');
    });

    it('should throw MCPCatalogLoadError when file cannot be read', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogLoadError);
    });

    it('should throw MCPCatalogLoadError when JSON is invalid', () => {
      mockReadFileSync.mockReturnValue('invalid json {');

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogLoadError);
    });
  });

  describe('Catalog Validation', () => {
    it('should validate catalog successfully with valid data', () => {
      expect(() => MCPRegistry.getInstance()).not.toThrow();
    });

    it('should throw MCPCatalogValidationError when version is missing', () => {
      const invalidCatalog = { ...mockCatalog, version: '' };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogValidationError);
    });

    it('should throw MCPCatalogValidationError when servers is not an array', () => {
      const invalidCatalog = { ...mockCatalog, servers: 'not an array' as any };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogValidationError);
    });

    it('should throw MCPCatalogValidationError when categories is missing', () => {
      const invalidCatalog = { ...mockCatalog, categories: undefined as any };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogValidationError);
    });

    it('should throw MCPCatalogValidationError when server is missing name', () => {
      const invalidCatalog = {
        ...mockCatalog,
        servers: [{ ...mockCatalog.servers[0], name: '' }],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogValidationError);
    });

    it('should throw MCPCatalogValidationError when server is missing description', () => {
      const invalidCatalog = {
        ...mockCatalog,
        servers: [{ ...mockCatalog.servers[0], description: '' }],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogValidationError);
    });

    it('should throw MCPCatalogValidationError when server is missing serverConfig', () => {
      const invalidCatalog = {
        ...mockCatalog,
        servers: [{ ...mockCatalog.servers[0], serverConfig: undefined as any }],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogValidationError);
    });

    it('should skip validation when validateOnLoad is false', () => {
      const invalidCatalog = { ...mockCatalog, version: '' };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() =>
        MCPRegistry.getInstance({ validateOnLoad: false })
      ).not.toThrow();
    });
  });

  describe('listServers', () => {
    let registry: MCPRegistry;

    beforeEach(() => {
      registry = MCPRegistry.getInstance();
    });

    it('should return all servers when no filter is provided', () => {
      const servers = registry.listServers();

      expect(servers).toHaveLength(4);
      expect(servers.map(s => s.name)).toEqual([
        'filesystem',
        'fetch',
        'postgres',
        'uncategorized-server'
      ]);
    });

    it('should filter by category correctly', () => {
      const servers = registry.listServers({ category: 'filesystem' });

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('filesystem');
    });

    it('should return empty array for non-existent category', () => {
      const servers = registry.listServers({ category: 'nonexistent' });

      expect(servers).toHaveLength(0);
    });

    it('should filter by verified status', () => {
      const verifiedServers = registry.listServers({ verified: true });
      const unverifiedServers = registry.listServers({ verified: false });

      expect(verifiedServers).toHaveLength(2);
      expect(verifiedServers.map(s => s.name)).toEqual(['filesystem', 'postgres']);

      expect(unverifiedServers).toHaveLength(2);
      expect(unverifiedServers.map(s => s.name)).toEqual(['fetch', 'uncategorized-server']);
    });

    it('should filter by capabilities (all must be present)', () => {
      const fileServers = registry.listServers({ capabilities: ['file:read'] });
      const httpServers = registry.listServers({ capabilities: ['http:get', 'web:request'] });
      const noMatch = registry.listServers({ capabilities: ['nonexistent:capability'] });

      expect(fileServers).toHaveLength(1);
      expect(fileServers[0].name).toBe('filesystem');

      expect(httpServers).toHaveLength(1);
      expect(httpServers[0].name).toBe('fetch');

      expect(noMatch).toHaveLength(0);
    });

    it('should filter by search text (case insensitive)', () => {
      const postgresServers = registry.listServers({ search: 'postgres' });
      const httpServers = registry.listServers({ search: 'HTTP' });
      const fileServers = registry.listServers({ search: 'file' });

      expect(postgresServers).toHaveLength(1);
      expect(postgresServers[0].name).toBe('postgres');

      expect(httpServers).toHaveLength(1);
      expect(httpServers[0].name).toBe('fetch');

      expect(fileServers).toHaveLength(1);
      expect(fileServers[0].name).toBe('filesystem');
    });

    it('should apply multiple filters correctly', () => {
      const servers = registry.listServers({
        verified: true,
        capabilities: ['file:read'],
        search: 'file'
      });

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('filesystem');
    });

    it('should return empty array when no servers match all criteria', () => {
      const servers = registry.listServers({
        verified: true,
        capabilities: ['nonexistent:capability'],
        search: 'file'
      });

      expect(servers).toHaveLength(0);
    });
  });

  describe('getServer', () => {
    let registry: MCPRegistry;

    beforeEach(() => {
      registry = MCPRegistry.getInstance();
    });

    it('should return server when it exists', () => {
      const server = registry.getServer('filesystem');

      expect(server).not.toBeNull();
      expect(server!.name).toBe('filesystem');
      expect(server!.description).toBe('File system operations');
    });

    it('should return null when server does not exist', () => {
      const server = registry.getServer('nonexistent');

      expect(server).toBeNull();
    });

    it('should be case sensitive', () => {
      const server = registry.getServer('FILESYSTEM');

      expect(server).toBeNull();
    });
  });

  describe('getServerConfig', () => {
    let registry: MCPRegistry;

    beforeEach(() => {
      registry = MCPRegistry.getInstance();
    });

    it('should return server config when server exists', () => {
      const config = registry.getServerConfig('filesystem');

      expect(config).not.toBeNull();
      expect(config!.name).toBe('filesystem');
      expect(config!.command).toBe('npx');
      expect(config!.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem']);
    });

    it('should return null when server does not exist', () => {
      const config = registry.getServerConfig('nonexistent');

      expect(config).toBeNull();
    });
  });

  describe('hasServer', () => {
    let registry: MCPRegistry;

    beforeEach(() => {
      registry = MCPRegistry.getInstance();
    });

    it('should return true when server exists', () => {
      expect(registry.hasServer('filesystem')).toBe(true);
      expect(registry.hasServer('fetch')).toBe(true);
    });

    it('should return false when server does not exist', () => {
      expect(registry.hasServer('nonexistent')).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(registry.hasServer('FILESYSTEM')).toBe(false);
    });
  });

  describe('getCategories', () => {
    let registry: MCPRegistry;

    beforeEach(() => {
      registry = MCPRegistry.getInstance();
    });

    it('should return all categories with metadata', () => {
      const categories = registry.getCategories();

      expect(categories).toHaveLength(6);

      const filesystemCategory = categories.find(c => c.id === 'filesystem');
      expect(filesystemCategory).toEqual({
        id: 'filesystem',
        name: 'File System',
        description: 'File operations'
      });
    });

    it('should return categories in consistent order', () => {
      const categories1 = registry.getCategories();
      const categories2 = registry.getCategories();

      expect(categories1.map(c => c.id)).toEqual(categories2.map(c => c.id));
    });
  });

  describe('getServersByCategory', () => {
    let registry: MCPRegistry;

    beforeEach(() => {
      registry = MCPRegistry.getInstance();
    });

    it('should return servers for existing category', () => {
      const servers = registry.getServersByCategory('filesystem');

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('filesystem');
    });

    it('should return empty array for non-existent category', () => {
      const servers = registry.getServersByCategory('nonexistent');

      expect(servers).toHaveLength(0);
    });

    it('should return servers for inferred categories', () => {
      const webServers = registry.getServersByCategory('web');
      const databaseServers = registry.getServersByCategory('database');

      expect(webServers).toHaveLength(1);
      expect(webServers[0].name).toBe('fetch');

      expect(databaseServers).toHaveLength(1);
      expect(databaseServers[0].name).toBe('postgres');
    });
  });

  describe('getServersByCapability', () => {
    let registry: MCPRegistry;

    beforeEach(() => {
      registry = MCPRegistry.getInstance();
    });

    it('should return servers with specified capability', () => {
      const fileReadServers = registry.getServersByCapability('file:read');
      const httpGetServers = registry.getServersByCapability('http:get');

      expect(fileReadServers).toHaveLength(1);
      expect(fileReadServers[0].name).toBe('filesystem');

      expect(httpGetServers).toHaveLength(1);
      expect(httpGetServers[0].name).toBe('fetch');
    });

    it('should return empty array when no servers have capability', () => {
      const servers = registry.getServersByCapability('nonexistent:capability');

      expect(servers).toHaveLength(0);
    });
  });

  describe('getAllCapabilities', () => {
    let registry: MCPRegistry;

    beforeEach(() => {
      registry = MCPRegistry.getInstance();
    });

    it('should return all unique capabilities sorted', () => {
      const capabilities = registry.getAllCapabilities();

      expect(capabilities).toEqual([
        'db:query',
        'directory:list',
        'file:read',
        'file:write',
        'http:get',
        'http:post',
        'misc:operation',
        'sql:execute',
        'web:request'
      ]);
    });

    it('should handle servers without capabilities', () => {
      const catalogWithoutCaps = {
        ...mockCatalog,
        servers: [
          {
            ...mockCatalog.servers[0],
            capabilities: undefined
          }
        ]
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(catalogWithoutCaps));
      MCPRegistry.resetInstance();

      const registry = MCPRegistry.getInstance();
      const capabilities = registry.getAllCapabilities();

      expect(capabilities).toEqual([]);
    });
  });

  describe('Utility Methods', () => {
    let registry: MCPRegistry;

    beforeEach(() => {
      registry = MCPRegistry.getInstance();
    });

    it('should return correct size', () => {
      expect(registry.size).toBe(4);
    });

    it('should return catalog info', () => {
      const info = registry.getCatalogInfo();

      expect(info).toEqual({
        version: '1.0.0',
        updated: '2024-01-01T00:00:00Z',
        description: 'Test catalog'
      });
    });

    it('should return all server names sorted', () => {
      const names = registry.getServerNames();

      expect(names).toEqual([
        'fetch',
        'filesystem',
        'postgres',
        'uncategorized-server'
      ]);
    });
  });

  describe('Category Inference', () => {
    it('should infer filesystem category from capabilities', () => {
      const catalogWithFileCapabilities = {
        ...mockCatalog,
        servers: [
          {
            name: 'file-server',
            description: 'File operations',
            version: '1.0.0',
            capabilities: ['file:read', 'directory:create'],
            serverConfig: {
              name: 'file-server',
              command: 'npx',
              args: ['-y', 'file-server'],
              env: {},
            },
          }
        ]
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(catalogWithFileCapabilities));
      MCPRegistry.resetInstance();

      const registry = MCPRegistry.getInstance();
      const servers = registry.getServersByCategory('filesystem');

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('file-server');
    });

    it('should infer web category from HTTP capabilities', () => {
      const catalogWithWebCapabilities = {
        ...mockCatalog,
        servers: [
          {
            name: 'web-server',
            description: 'Web operations',
            version: '1.0.0',
            capabilities: ['browser:navigate', 'http:post'],
            serverConfig: {
              name: 'web-server',
              command: 'npx',
              args: ['-y', 'web-server'],
              env: {},
            },
          }
        ]
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(catalogWithWebCapabilities));
      MCPRegistry.resetInstance();

      const registry = MCPRegistry.getInstance();
      const servers = registry.getServersByCategory('web');

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('web-server');
    });

    it('should infer development category from git capabilities', () => {
      const catalogWithGitCapabilities = {
        ...mockCatalog,
        servers: [
          {
            name: 'git-server',
            description: 'Git operations',
            version: '1.0.0',
            capabilities: ['git:commit', 'git:push'],
            serverConfig: {
              name: 'git-server',
              command: 'npx',
              args: ['-y', 'git-server'],
              env: {},
            },
          }
        ]
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(catalogWithGitCapabilities));
      MCPRegistry.resetInstance();

      const registry = MCPRegistry.getInstance();
      const servers = registry.getServersByCategory('development');

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('git-server');
    });

    it('should infer system category from system capabilities', () => {
      const catalogWithSystemCapabilities = {
        ...mockCatalog,
        servers: [
          {
            name: 'system-server',
            description: 'System operations',
            version: '1.0.0',
            capabilities: ['shell:execute', 'docker:run'],
            serverConfig: {
              name: 'system-server',
              command: 'npx',
              args: ['-y', 'system-server'],
              env: {},
            },
          }
        ]
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(catalogWithSystemCapabilities));
      MCPRegistry.resetInstance();

      const registry = MCPRegistry.getInstance();
      const servers = registry.getServersByCategory('system');

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('system-server');
    });

    it('should infer search category from search capabilities', () => {
      const catalogWithSearchCapabilities = {
        ...mockCatalog,
        servers: [
          {
            name: 'search-server',
            description: 'Search operations',
            version: '1.0.0',
            capabilities: ['search:web', 'search:documents'],
            serverConfig: {
              name: 'search-server',
              command: 'npx',
              args: ['-y', 'search-server'],
              env: {},
            },
          }
        ]
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(catalogWithSearchCapabilities));
      MCPRegistry.resetInstance();

      const registry = MCPRegistry.getInstance();
      const servers = registry.getServersByCategory('search');

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('search-server');
    });

    it('should use uncategorized for servers without clear category', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.getServersByCategory('uncategorized');

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('uncategorized-server');
    });
  });

  describe('Error Classes', () => {
    describe('MCPCatalogLoadError', () => {
      it('should create error with correct properties', () => {
        const catalogPath = '/path/to/catalog.json';
        const cause = new Error('File not found');
        const error = new MCPCatalogLoadError(catalogPath, cause);

        expect(error.name).toBe('MCPCatalogLoadError');
        expect(error.catalogPath).toBe(catalogPath);
        expect(error.cause).toBe(cause);
        expect(error.message).toContain(catalogPath);
        expect(error.message).toContain('File not found');
      });

      it('should create error without cause', () => {
        const catalogPath = '/path/to/catalog.json';
        const error = new MCPCatalogLoadError(catalogPath);

        expect(error.name).toBe('MCPCatalogLoadError');
        expect(error.catalogPath).toBe(catalogPath);
        expect(error.cause).toBeUndefined();
        expect(error.message).toContain('Unknown error');
      });
    });

    describe('MCPCatalogValidationError', () => {
      it('should create error with validation details', () => {
        const details = ['Version missing', 'Invalid server config'];
        const error = new MCPCatalogValidationError(details);

        expect(error.name).toBe('MCPCatalogValidationError');
        expect(error.details).toEqual(details);
        expect(error.message).toContain('Version missing');
        expect(error.message).toContain('Invalid server config');
      });
    });
  });

  describe('Convenience Functions', () => {
    beforeEach(() => {
      // Ensure we have a fresh instance for each test
      MCPRegistry.resetInstance();
    });

    it('getMCPRegistry should return singleton instance', () => {
      const registry1 = getMCPRegistry();
      const registry2 = getMCPRegistry();
      const registry3 = MCPRegistry.getInstance();

      expect(registry1).toBe(registry2);
      expect(registry1).toBe(registry3);
    });

    it('listMCPServers should work like registry.listServers', () => {
      const servers1 = listMCPServers();
      const servers2 = listMCPServers({ verified: true });

      const registry = getMCPRegistry();
      const servers3 = registry.listServers();
      const servers4 = registry.listServers({ verified: true });

      expect(servers1).toEqual(servers3);
      expect(servers2).toEqual(servers4);
    });

    it('getMCPServer should work like registry.getServer', () => {
      const server1 = getMCPServer('filesystem');
      const server2 = getMCPServer('nonexistent');

      const registry = getMCPRegistry();
      const server3 = registry.getServer('filesystem');
      const server4 = registry.getServer('nonexistent');

      expect(server1).toEqual(server3);
      expect(server2).toEqual(server4);
    });

    it('getMCPServerConfig should work like registry.getServerConfig', () => {
      const config1 = getMCPServerConfig('filesystem');
      const config2 = getMCPServerConfig('nonexistent');

      const registry = getMCPRegistry();
      const config3 = registry.getServerConfig('filesystem');
      const config4 = registry.getServerConfig('nonexistent');

      expect(config1).toEqual(config3);
      expect(config2).toEqual(config4);
    });
  });
});