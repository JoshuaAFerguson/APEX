import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import {
  MCPRegistry,
  type MCPCatalog,
} from '../mcp/mcp-registry.js';
import type { MCPMarketplaceEntry } from '../types.js';

// Mock fs to control file system operations
vi.mock('fs', () => {
  const readFileSyncMock = vi.fn();
  return {
    readFileSync: readFileSyncMock,
    default: { readFileSync: readFileSyncMock },
  };
});
const mockReadFileSync = vi.mocked(readFileSync);

describe('MCPRegistry - Caching Behavior', () => {
  // Sample test catalog for testing
  const mockCatalog: MCPCatalog = {
    version: '1.0.0',
    updated: '2024-01-01T00:00:00Z',
    description: 'Test catalog for caching behavior',
    categories: {
      filesystem: { name: 'File System', description: 'File operations' },
      web: { name: 'Web & HTTP', description: 'Web requests' },
      development: { name: 'Development', description: 'Dev tools' },
      database: { name: 'Database', description: 'Database operations' },
      system: { name: 'System', description: 'System operations' },
      search: { name: 'Search', description: 'Search operations' },
      uncategorized: { name: 'Uncategorized', description: 'Other servers' },
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
        capabilities: ['http:get', 'http:post', 'browser:navigate'],
        serverConfig: {
          name: 'fetch',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-fetch'],
          env: {},
        },
      },
      {
        name: 'git-server',
        description: 'Git repository operations',
        version: '1.0.0',
        author: 'Test Author',
        verified: true,
        capabilities: ['git:commit', 'git:push', 'git:status'],
        serverConfig: {
          name: 'git-server',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-git'],
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
        name: 'system-tools',
        description: 'System management tools',
        version: '1.0.0',
        verified: false,
        capabilities: ['shell:execute', 'docker:run', 'process:list'],
        serverConfig: {
          name: 'system-tools',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-system'],
          env: {},
        },
      },
      {
        name: 'search-engine',
        description: 'Web search capabilities',
        version: '1.0.0',
        verified: true,
        capabilities: ['search:web', 'search:documents'],
        serverConfig: {
          name: 'search-engine',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-search'],
          env: {},
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

  describe('Catalog Loading - Load Only Once', () => {
    it('should load catalog only once during singleton creation', () => {
      // Create first instance
      const registry1 = MCPRegistry.getInstance();

      // Verify catalog was loaded
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
      expect(registry1.size).toBe(7); // 7 servers in mock catalog

      // Get second reference to singleton
      const registry2 = MCPRegistry.getInstance();

      // Should be same instance
      expect(registry1).toBe(registry2);

      // File should still only be read once
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);

      // Subsequent operations should not trigger additional file reads
      registry2.listServers();
      registry2.getServer('filesystem');
      registry2.getCategories();

      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('should not reload catalog on multiple getInstance calls', () => {
      // Call getInstance multiple times rapidly
      const instances = Array.from({ length: 10 }, () => MCPRegistry.getInstance());

      // All should be the same instance
      instances.forEach(instance => {
        expect(instance).toBe(instances[0]);
      });

      // File should only be read once
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('should reload catalog only after resetInstance is called', () => {
      // First instance
      const registry1 = MCPRegistry.getInstance();
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
      expect(registry1.size).toBe(7);

      // Reset and create new instance
      MCPRegistry.resetInstance();
      const registry2 = MCPRegistry.getInstance();

      // Should have loaded catalog again
      expect(mockReadFileSync).toHaveBeenCalledTimes(2);
      expect(registry2.size).toBe(7);

      // Should be a different instance
      expect(registry1).not.toBe(registry2);
    });
  });

  describe('Lookup Maps Building', () => {
    it('should build serversByName map correctly during initialization', () => {
      const registry = MCPRegistry.getInstance();

      // Verify all servers are accessible by name
      mockCatalog.servers.forEach(server => {
        const retrievedServer = registry.getServer(server.name);
        expect(retrievedServer).not.toBeNull();
        expect(retrievedServer!.name).toBe(server.name);
        expect(retrievedServer!.description).toBe(server.description);
        expect(retrievedServer!.capabilities).toEqual(server.capabilities);
      });
    });

    it('should build serversByCategory map correctly during initialization', () => {
      const registry = MCPRegistry.getInstance();

      // Check filesystem category (explicit capability inference)
      const filesystemServers = registry.getServersByCategory('filesystem');
      expect(filesystemServers).toHaveLength(1);
      expect(filesystemServers[0].name).toBe('filesystem');

      // Check web category (HTTP capabilities)
      const webServers = registry.getServersByCategory('web');
      expect(webServers).toHaveLength(1);
      expect(webServers[0].name).toBe('fetch');

      // Check development category (Git capabilities)
      const devServers = registry.getServersByCategory('development');
      expect(devServers).toHaveLength(1);
      expect(devServers[0].name).toBe('git-server');

      // Check database category
      const dbServers = registry.getServersByCategory('database');
      expect(dbServers).toHaveLength(1);
      expect(dbServers[0].name).toBe('postgres');

      // Check system category
      const systemServers = registry.getServersByCategory('system');
      expect(systemServers).toHaveLength(1);
      expect(systemServers[0].name).toBe('system-tools');

      // Check search category
      const searchServers = registry.getServersByCategory('search');
      expect(searchServers).toHaveLength(1);
      expect(searchServers[0].name).toBe('search-engine');

      // Check uncategorized
      const uncategorizedServers = registry.getServersByCategory('uncategorized');
      expect(uncategorizedServers).toHaveLength(1);
      expect(uncategorizedServers[0].name).toBe('uncategorized-server');
    });

    it('should not rebuild maps on subsequent method calls', () => {
      const registry = MCPRegistry.getInstance();

      // First access should build maps (already done during construction)
      const server1 = registry.getServer('filesystem');
      const categories1 = registry.getServersByCategory('web');

      // Mock the private buildLookupMaps method to verify it's not called again
      const buildLookupMapsSpy = vi.spyOn(registry as any, 'buildLookupMaps');

      // Subsequent accesses should use cached maps
      const server2 = registry.getServer('filesystem');
      const categories2 = registry.getServersByCategory('web');

      expect(server1).toBe(server2);
      expect(categories1).toBe(categories2);
      expect(buildLookupMapsSpy).not.toHaveBeenCalled();

      buildLookupMapsSpy.mockRestore();
    });
  });

  describe('ServersByName Map Correctness', () => {
    it('should provide O(1) lookup for all servers by name', () => {
      const registry = MCPRegistry.getInstance();

      // Test all servers are findable
      const expectedServers = ['filesystem', 'fetch', 'git-server', 'postgres', 'system-tools', 'search-engine', 'uncategorized-server'];

      expectedServers.forEach(serverName => {
        const server = registry.getServer(serverName);
        expect(server).not.toBeNull();
        expect(server!.name).toBe(serverName);
      });
    });

    it('should return null for non-existent servers', () => {
      const registry = MCPRegistry.getInstance();

      expect(registry.getServer('nonexistent')).toBeNull();
      expect(registry.getServer('')).toBeNull();
      expect(registry.getServer('FILESYSTEM')).toBeNull(); // case sensitive
    });

    it('should handle hasServer method correctly', () => {
      const registry = MCPRegistry.getInstance();

      // Existing servers
      expect(registry.hasServer('filesystem')).toBe(true);
      expect(registry.hasServer('fetch')).toBe(true);
      expect(registry.hasServer('postgres')).toBe(true);

      // Non-existing servers
      expect(registry.hasServer('nonexistent')).toBe(false);
      expect(registry.hasServer('FILESYSTEM')).toBe(false); // case sensitive
      expect(registry.hasServer('')).toBe(false);
    });

    it('should maintain referential integrity between maps', () => {
      const registry = MCPRegistry.getInstance();

      // Get server by name
      const serverByName = registry.getServer('filesystem');

      // Get same server through category
      const serversByCategory = registry.getServersByCategory('filesystem');
      const serverByCategory = serversByCategory[0];

      // Should be the same object reference
      expect(serverByName).toBe(serverByCategory);
    });
  });

  describe('ServersByCategory Map Correctness', () => {
    it('should correctly categorize servers based on capabilities', () => {
      const registry = MCPRegistry.getInstance();

      // Test each category has expected servers
      const categoryTests = [
        { category: 'filesystem', expectedServers: ['filesystem'], capabilities: ['file:', 'directory:'] },
        { category: 'web', expectedServers: ['fetch'], capabilities: ['http:', 'browser:'] },
        { category: 'development', expectedServers: ['git-server'], capabilities: ['git:'] },
        { category: 'database', expectedServers: ['postgres'], capabilities: ['db:', 'sql:'] },
        { category: 'system', expectedServers: ['system-tools'], capabilities: ['shell:', 'docker:', 'process:'] },
        { category: 'search', expectedServers: ['search-engine'], capabilities: ['search:'] },
        { category: 'uncategorized', expectedServers: ['uncategorized-server'], capabilities: [] },
      ];

      categoryTests.forEach(({ category, expectedServers, capabilities }) => {
        const servers = registry.getServersByCategory(category);
        expect(servers.map(s => s.name)).toEqual(expectedServers);

        // Verify servers in this category have appropriate capabilities
        if (capabilities.length > 0) {
          servers.forEach(server => {
            const hasExpectedCapability = capabilities.some(capPrefix =>
              server.capabilities?.some(cap => cap.startsWith(capPrefix))
            );
            expect(hasExpectedCapability).toBe(true);
          });
        }
      });
    });

    it('should return empty array for non-existent categories', () => {
      const registry = MCPRegistry.getInstance();

      expect(registry.getServersByCategory('nonexistent')).toEqual([]);
      expect(registry.getServersByCategory('')).toEqual([]);
      expect(registry.getServersByCategory('FILESYSTEM')).toEqual([]); // case sensitive
    });

    it('should handle servers with multiple categorization criteria', () => {
      const registry = MCPRegistry.getInstance();

      // System-tools server has multiple system-related capabilities
      const systemServers = registry.getServersByCategory('system');
      expect(systemServers).toHaveLength(1);

      const systemServer = systemServers[0];
      expect(systemServer.name).toBe('system-tools');
      expect(systemServer.capabilities).toContain('shell:execute');
      expect(systemServer.capabilities).toContain('docker:run');
      expect(systemServer.capabilities).toContain('process:list');
    });

    it('should maintain consistent categorization across multiple calls', () => {
      const registry = MCPRegistry.getInstance();

      // Multiple calls should return identical results
      const web1 = registry.getServersByCategory('web');
      const web2 = registry.getServersByCategory('web');
      const web3 = registry.getServersByCategory('web');

      expect(web1).toEqual(web2);
      expect(web2).toEqual(web3);
      expect(web1[0]).toBe(web2[0]); // Same object reference
    });
  });

  describe('Cache Invalidation via resetInstance', () => {
    it('should clear all cached data when resetInstance is called', () => {
      // Create first instance and use it
      const registry1 = MCPRegistry.getInstance();
      const server1 = registry1.getServer('filesystem');
      const categories1 = registry1.getServersByCategory('web');

      expect(server1).not.toBeNull();
      expect(categories1).toHaveLength(1);
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);

      // Reset cache
      MCPRegistry.resetInstance();

      // Create new instance with different catalog
      const modifiedCatalog = {
        ...mockCatalog,
        servers: [
          {
            name: 'new-server',
            description: 'New server after reset',
            version: '2.0.0',
            author: 'New Author',
            verified: true,
            capabilities: ['new:capability'],
            serverConfig: {
              name: 'new-server',
              command: 'npx',
              args: ['-y', '@example/new-server'],
              env: {},
            },
          }
        ]
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(modifiedCatalog));

      const registry2 = MCPRegistry.getInstance();

      // Should have loaded new catalog
      expect(mockReadFileSync).toHaveBeenCalledTimes(2);
      expect(registry2.size).toBe(1); // Only new server

      // Old server should not exist
      expect(registry2.getServer('filesystem')).toBeNull();

      // New server should exist
      const newServer = registry2.getServer('new-server');
      expect(newServer).not.toBeNull();
      expect(newServer!.description).toBe('New server after reset');

      // Different instance
      expect(registry1).not.toBe(registry2);
    });

    it('should rebuild lookup maps after reset and reload', () => {
      const registry1 = MCPRegistry.getInstance();

      // Verify initial state
      expect(registry1.getServer('filesystem')).not.toBeNull();
      expect(registry1.getServersByCategory('filesystem')).toHaveLength(1);

      // Reset and create new instance
      MCPRegistry.resetInstance();
      const registry2 = MCPRegistry.getInstance();

      // Maps should be rebuilt with same data
      expect(registry2.getServer('filesystem')).not.toBeNull();
      expect(registry2.getServersByCategory('filesystem')).toHaveLength(1);

      // Verify all original functionality still works
      expect(registry2.listServers()).toHaveLength(7);
      expect(registry2.hasServer('postgres')).toBe(true);
      expect(registry2.getServerConfig('fetch')).not.toBeNull();
    });

    it('should handle multiple reset cycles correctly', () => {
      // Create instances and reset multiple times
      for (let i = 0; i < 5; i++) {
        const registry = MCPRegistry.getInstance();
        expect(registry.size).toBe(7);
        expect(registry.getServer('filesystem')).not.toBeNull();

        MCPRegistry.resetInstance();
      }

      // Should have read file 5 times
      expect(mockReadFileSync).toHaveBeenCalledTimes(5);

      // Final instance should still work correctly
      const finalRegistry = MCPRegistry.getInstance();
      expect(finalRegistry.size).toBe(7);
      expect(finalRegistry.listServers()).toHaveLength(7);
    });

    it('should preserve new instance behavior after reset', () => {
      // First instance with custom options
      const registry1 = MCPRegistry.getInstance({ validateOnLoad: false });
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);

      // Reset
      MCPRegistry.resetInstance();

      // New instance with different options (should be ignored per singleton pattern)
      const registry2 = MCPRegistry.getInstance({ validateOnLoad: true });
      expect(mockReadFileSync).toHaveBeenCalledTimes(2);

      // Should be different instances
      expect(registry1).not.toBe(registry2);

      // Both should function correctly
      expect(registry2.size).toBe(7);
      expect(registry2.getServer('filesystem')).not.toBeNull();
    });
  });
});