import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import {
  MCPRegistry,
  MCPCatalogLoadError,
  MCPCatalogValidationError,
  getMCPRegistry,
  type MCPCatalog,
} from '../mcp/mcp-registry.js';

// Mock fs to control file system operations
vi.mock('fs');
const mockReadFileSync = vi.mocked(readFileSync);

/**
 * Edge case and error handling tests for MCPRegistry
 * Tests boundary conditions, error scenarios, and malformed data handling
 */
describe('MCPRegistry Edge Cases and Error Handling', () => {
  beforeEach(() => {
    // Reset singleton instance before each test
    MCPRegistry.resetInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset singleton instance after each test
    MCPRegistry.resetInstance();
  });

  describe('File System Error Handling', () => {
    it('should handle file not found error', () => {
      const fileError = new Error('ENOENT: no such file or directory');
      mockReadFileSync.mockImplementation(() => {
        throw fileError;
      });

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogLoadError);

      try {
        MCPRegistry.getInstance();
      } catch (error) {
        expect(error).toBeInstanceOf(MCPCatalogLoadError);
        expect((error as MCPCatalogLoadError).cause).toBe(fileError);
        expect((error as MCPCatalogLoadError).catalogPath).toMatch(/catalog\.json$/);
      }
    });

    it('should handle permission denied error', () => {
      const permissionError = new Error('EACCES: permission denied');
      mockReadFileSync.mockImplementation(() => {
        throw permissionError;
      });

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogLoadError);

      try {
        MCPRegistry.getInstance();
      } catch (error) {
        expect(error).toBeInstanceOf(MCPCatalogLoadError);
        expect((error as MCPCatalogLoadError).cause).toBe(permissionError);
      }
    });

    it('should handle custom catalog path errors', () => {
      const customPath = '/invalid/path/catalog.json';
      const fileError = new Error('File not found');
      mockReadFileSync.mockImplementation(() => {
        throw fileError;
      });

      expect(() => MCPRegistry.getInstance({ catalogPath: customPath })).toThrow(MCPCatalogLoadError);

      try {
        MCPRegistry.getInstance({ catalogPath: customPath });
      } catch (error) {
        expect(error).toBeInstanceOf(MCPCatalogLoadError);
        expect((error as MCPCatalogLoadError).catalogPath).toBe(customPath);
      }
    });
  });

  describe('JSON Parsing Error Handling', () => {
    it('should handle invalid JSON syntax', () => {
      mockReadFileSync.mockReturnValue('{ invalid json }');

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogLoadError);

      try {
        MCPRegistry.getInstance();
      } catch (error) {
        expect(error).toBeInstanceOf(MCPCatalogLoadError);
        expect(error.message).toContain('JSON');
      }
    });

    it('should handle empty file', () => {
      mockReadFileSync.mockReturnValue('');

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogLoadError);
    });

    it('should handle non-JSON content', () => {
      mockReadFileSync.mockReturnValue('This is not JSON content');

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogLoadError);
    });

    it('should handle partial JSON', () => {
      mockReadFileSync.mockReturnValue('{"version": "1.0.0", "servers": [');

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogLoadError);
    });

    it('should handle non-object JSON', () => {
      mockReadFileSync.mockReturnValue('"string value"');

      expect(() => MCPRegistry.getInstance()).toThrow();
    });

    it('should handle null JSON', () => {
      mockReadFileSync.mockReturnValue('null');

      expect(() => MCPRegistry.getInstance()).toThrow();
    });

    it('should handle array JSON', () => {
      mockReadFileSync.mockReturnValue('[]');

      expect(() => MCPRegistry.getInstance()).toThrow();
    });
  });

  describe('Catalog Validation Edge Cases', () => {
    const baseCatalog: MCPCatalog = {
      version: '1.0.0',
      updated: '2024-01-01T00:00:00Z',
      description: 'Test catalog',
      categories: {
        filesystem: { name: 'File System', description: 'File operations' },
      },
      servers: [
        {
          name: 'test-server',
          description: 'Test server',
          version: '1.0.0',
          serverConfig: {
            name: 'test-server',
            command: 'npx',
            args: ['test'],
            env: {},
          },
        },
      ],
    };

    it('should handle missing version field', () => {
      const invalidCatalog = { ...baseCatalog };
      delete (invalidCatalog as any).version;
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogValidationError);
    });

    it('should handle empty version field', () => {
      const invalidCatalog = { ...baseCatalog, version: '' };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogValidationError);
    });

    it('should handle missing servers field', () => {
      const invalidCatalog = { ...baseCatalog };
      delete (invalidCatalog as any).servers;
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogValidationError);
    });

    it('should handle non-array servers field', () => {
      const invalidCatalog = { ...baseCatalog, servers: 'not an array' as any };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogValidationError);
    });

    it('should handle missing categories field', () => {
      const invalidCatalog = { ...baseCatalog };
      delete (invalidCatalog as any).categories;
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogValidationError);
    });

    it('should handle servers with missing names', () => {
      const invalidCatalog = {
        ...baseCatalog,
        servers: [
          { ...baseCatalog.servers[0], name: '' },
          { ...baseCatalog.servers[0] },
        ],
      };
      delete (invalidCatalog.servers[1] as any).name;
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogValidationError);

      try {
        MCPRegistry.getInstance();
      } catch (error) {
        expect(error).toBeInstanceOf(MCPCatalogValidationError);
        const validationError = error as MCPCatalogValidationError;
        expect(validationError.details).toContain('Server at index 0 missing name');
        expect(validationError.details).toContain('Server at index 1 missing name');
      }
    });

    it('should handle servers with missing descriptions', () => {
      const invalidCatalog = {
        ...baseCatalog,
        servers: [{ ...baseCatalog.servers[0], description: '' }],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogValidationError);
    });

    it('should handle servers with missing serverConfig', () => {
      const invalidCatalog = {
        ...baseCatalog,
        servers: [{ ...baseCatalog.servers[0] }],
      };
      delete (invalidCatalog.servers[0] as any).serverConfig;
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => MCPRegistry.getInstance()).toThrow(MCPCatalogValidationError);
    });

    it('should accumulate multiple validation errors', () => {
      const invalidCatalog = {
        version: '', // Missing version
        servers: 'not an array', // Invalid servers
        // Missing categories
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      try {
        MCPRegistry.getInstance();
      } catch (error) {
        expect(error).toBeInstanceOf(MCPCatalogValidationError);
        const validationError = error as MCPCatalogValidationError;
        expect(validationError.details.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('Empty and Minimal Catalogs', () => {
    it('should handle empty servers array', () => {
      const emptyCatalog: MCPCatalog = {
        version: '1.0.0',
        updated: '2024-01-01T00:00:00Z',
        description: 'Empty catalog',
        categories: {},
        servers: [],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(emptyCatalog));

      const registry = MCPRegistry.getInstance();

      expect(registry.size).toBe(0);
      expect(registry.listServers()).toEqual([]);
      expect(registry.getServerNames()).toEqual([]);
      expect(registry.getAllCapabilities()).toEqual([]);
      expect(registry.getCategories()).toEqual([]);
    });

    it('should handle minimal valid catalog', () => {
      const minimalCatalog: MCPCatalog = {
        version: '1.0.0',
        updated: '2024-01-01T00:00:00Z',
        description: 'Minimal catalog',
        categories: {
          test: { name: 'Test', description: 'Test category' },
        },
        servers: [
          {
            name: 'minimal-server',
            description: 'Minimal server',
            version: '1.0.0',
            serverConfig: {
              name: 'minimal-server',
              command: 'echo',
              args: [],
              env: {},
            },
          },
        ],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(minimalCatalog));

      const registry = MCPRegistry.getInstance();

      expect(registry.size).toBe(1);
      expect(registry.getServer('minimal-server')).not.toBeNull();
      expect(registry.hasServer('minimal-server')).toBe(true);
    });
  });

  describe('Malformed Server Data', () => {
    const createCatalogWithServer = (server: any): MCPCatalog => ({
      version: '1.0.0',
      updated: '2024-01-01T00:00:00Z',
      description: 'Test catalog',
      categories: {
        test: { name: 'Test', description: 'Test category' },
      },
      servers: [server],
    });

    it('should handle servers with null values', () => {
      const serverWithNulls = {
        name: 'test-server',
        description: 'Test server',
        version: '1.0.0',
        author: null,
        repository: null,
        capabilities: null,
        serverConfig: {
          name: 'test-server',
          command: 'npx',
          args: [],
          env: {},
        },
      };
      const catalog = createCatalogWithServer(serverWithNulls);
      mockReadFileSync.mockReturnValue(JSON.stringify(catalog));

      const registry = MCPRegistry.getInstance();

      expect(registry.size).toBe(1);
      const server = registry.getServer('test-server');
      expect(server).not.toBeNull();
    });

    it('should handle servers with empty arrays', () => {
      const serverWithEmptyArrays = {
        name: 'test-server',
        description: 'Test server',
        version: '1.0.0',
        capabilities: [],
        serverConfig: {
          name: 'test-server',
          command: 'npx',
          args: [],
          env: {},
        },
      };
      const catalog = createCatalogWithServer(serverWithEmptyArrays);
      mockReadFileSync.mockReturnValue(JSON.stringify(catalog));

      const registry = MCPRegistry.getInstance();

      expect(registry.size).toBe(1);
      expect(registry.getAllCapabilities()).toEqual([]);
      expect(registry.getServersByCapability('any')).toEqual([]);
    });

    it('should handle servers with empty objects', () => {
      const serverWithEmptyObjects = {
        name: 'test-server',
        description: 'Test server',
        version: '1.0.0',
        capabilities: ['test:capability'],
        serverConfig: {
          name: 'test-server',
          command: 'npx',
          args: [],
          env: {},
        },
      };
      const catalog = createCatalogWithServer(serverWithEmptyObjects);
      mockReadFileSync.mockReturnValue(JSON.stringify(catalog));

      const registry = MCPRegistry.getInstance();

      expect(registry.size).toBe(1);
      const server = registry.getServer('test-server');
      expect(server?.serverConfig.env).toEqual({});
    });
  });

  describe('Filter Edge Cases', () => {
    const testCatalog: MCPCatalog = {
      version: '1.0.0',
      updated: '2024-01-01T00:00:00Z',
      description: 'Test catalog',
      categories: {
        filesystem: { name: 'File System', description: 'File operations' },
      },
      servers: [
        {
          name: 'server-with-caps',
          description: 'Server with capabilities',
          version: '1.0.0',
          capabilities: ['file:read', 'file:write'],
          verified: true,
          serverConfig: {
            name: 'server-with-caps',
            command: 'npx',
            args: [],
            env: {},
          },
        },
        {
          name: 'server-without-caps',
          description: 'Server without capabilities',
          version: '1.0.0',
          verified: false,
          serverConfig: {
            name: 'server-without-caps',
            command: 'npx',
            args: [],
            env: {},
          },
        },
      ],
    };

    beforeEach(() => {
      mockReadFileSync.mockReturnValue(JSON.stringify(testCatalog));
    });

    it('should handle filtering with empty capabilities array', () => {
      const registry = MCPRegistry.getInstance();

      const servers = registry.listServers({ capabilities: [] });

      expect(servers).toHaveLength(2); // Should return all servers
    });

    it('should handle filtering with non-existent capabilities', () => {
      const registry = MCPRegistry.getInstance();

      const servers = registry.listServers({ capabilities: ['nonexistent:capability'] });

      expect(servers).toHaveLength(0);
    });

    it('should handle filtering servers without capabilities field', () => {
      const registry = MCPRegistry.getInstance();

      const servers = registry.listServers({ capabilities: ['file:read'] });

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('server-with-caps');
    });

    it('should handle case-sensitive search', () => {
      const registry = MCPRegistry.getInstance();

      const lowerSearch = registry.listServers({ search: 'server' });
      const upperSearch = registry.listServers({ search: 'SERVER' });
      const mixedSearch = registry.listServers({ search: 'Server' });

      expect(lowerSearch).toHaveLength(2);
      expect(upperSearch).toHaveLength(2);
      expect(mixedSearch).toHaveLength(2);
    });

    it('should handle empty search string', () => {
      const registry = MCPRegistry.getInstance();

      const servers = registry.listServers({ search: '' });

      expect(servers).toHaveLength(2); // Should return all servers
    });

    it('should handle whitespace-only search string', () => {
      const registry = MCPRegistry.getInstance();

      const servers = registry.listServers({ search: '   ' });

      expect(servers).toHaveLength(0); // Should not match any servers
    });

    it('should handle special characters in search', () => {
      const registry = MCPRegistry.getInstance();

      const servers = registry.listServers({ search: 'server-with' });

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('server-with-caps');
    });
  });

  describe('Category Inference Edge Cases', () => {
    it('should handle servers with conflicting capability categories', () => {
      const conflictingCatalog: MCPCatalog = {
        version: '1.0.0',
        updated: '2024-01-01T00:00:00Z',
        description: 'Test catalog',
        categories: {
          filesystem: { name: 'File System', description: 'File operations' },
          web: { name: 'Web', description: 'Web operations' },
        },
        servers: [
          {
            name: 'multi-capability-server',
            description: 'Server with multiple capability types',
            version: '1.0.0',
            capabilities: ['file:read', 'http:get', 'db:query'], // Multiple categories
            serverConfig: {
              name: 'multi-capability-server',
              command: 'npx',
              args: [],
              env: {},
            },
          },
        ],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(conflictingCatalog));

      const registry = MCPRegistry.getInstance();

      // Should categorize based on first matching capability category
      const filesystemServers = registry.getServersByCategory('filesystem');
      expect(filesystemServers).toHaveLength(1);
    });

    it('should handle servers with unknown capability patterns', () => {
      const unknownCapsCatalog: MCPCatalog = {
        version: '1.0.0',
        updated: '2024-01-01T00:00:00Z',
        description: 'Test catalog',
        categories: {
          uncategorized: { name: 'Uncategorized', description: 'Unknown category' },
        },
        servers: [
          {
            name: 'unknown-server',
            description: 'Server with unknown capabilities',
            version: '1.0.0',
            capabilities: ['unknown:capability', 'custom:action'],
            serverConfig: {
              name: 'unknown-server',
              command: 'npx',
              args: [],
              env: {},
            },
          },
        ],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(unknownCapsCatalog));

      const registry = MCPRegistry.getInstance();

      // Should fall back to uncategorized
      const uncategorizedServers = registry.getServersByCategory('uncategorized');
      expect(uncategorizedServers).toHaveLength(1);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should handle large catalogs efficiently', () => {
      const largeCatalog: MCPCatalog = {
        version: '1.0.0',
        updated: '2024-01-01T00:00:00Z',
        description: 'Large catalog',
        categories: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [
            `category-${i}`,
            { name: `Category ${i}`, description: `Description ${i}` },
          ])
        ),
        servers: Array.from({ length: 1000 }, (_, i) => ({
          name: `server-${i}`,
          description: `Server ${i}`,
          version: '1.0.0',
          capabilities: [`action-${i % 10}:capability`],
          serverConfig: {
            name: `server-${i}`,
            command: 'npx',
            args: [`server-${i}`],
            env: {},
          },
        })),
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(largeCatalog));

      const startTime = Date.now();
      const registry = MCPRegistry.getInstance();
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(5000); // Should load reasonably quickly
      expect(registry.size).toBe(1000);

      // Test that lookups are still fast
      const lookupStart = Date.now();
      const server = registry.getServer('server-500');
      const lookupTime = Date.now() - lookupStart;

      expect(lookupTime).toBeLessThan(10);
      expect(server).not.toBeNull();
    });

    it('should not leak memory with repeated operations', () => {
      const normalCatalog: MCPCatalog = {
        version: '1.0.0',
        updated: '2024-01-01T00:00:00Z',
        description: 'Normal catalog',
        categories: {
          test: { name: 'Test', description: 'Test category' },
        },
        servers: Array.from({ length: 10 }, (_, i) => ({
          name: `server-${i}`,
          description: `Server ${i}`,
          version: '1.0.0',
          capabilities: [`action:${i}`],
          serverConfig: {
            name: `server-${i}`,
            command: 'npx',
            args: [],
            env: {},
          },
        })),
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(normalCatalog));

      const registry = MCPRegistry.getInstance();

      // Perform many operations to check for memory leaks
      for (let i = 0; i < 1000; i++) {
        registry.listServers();
        registry.getCategories();
        registry.getAllCapabilities();
        registry.listServers({ search: 'server' });
        registry.listServers({ verified: true });
      }

      // Test should complete without running out of memory
      expect(registry.size).toBe(10);
    });
  });

  describe('Thread Safety and Singleton Edge Cases', () => {
    it('should maintain singleton integrity after errors', () => {
      // First attempt fails
      mockReadFileSync.mockImplementationOnce(() => {
        throw new Error('File not found');
      });

      expect(() => MCPRegistry.getInstance()).toThrow();

      // Reset and try again with valid data
      MCPRegistry.resetInstance();
      mockReadFileSync.mockReturnValue(JSON.stringify({
        version: '1.0.0',
        updated: '2024-01-01T00:00:00Z',
        description: 'Valid catalog',
        categories: {},
        servers: [],
      }));

      const registry = MCPRegistry.getInstance();
      expect(registry.size).toBe(0);
    });

    it('should handle concurrent getInstance calls correctly', () => {
      const validCatalog = {
        version: '1.0.0',
        updated: '2024-01-01T00:00:00Z',
        description: 'Valid catalog',
        categories: {},
        servers: [],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(validCatalog));

      // Simulate concurrent access (though JavaScript is single-threaded)
      const instances = Array.from({ length: 10 }, () => MCPRegistry.getInstance());

      // All instances should be the same
      instances.forEach(instance => {
        expect(instance).toBe(instances[0]);
      });

      // File should only be read once
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });
  });
});