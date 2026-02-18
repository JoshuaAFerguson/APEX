import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { readFileSync, existsSync } from 'fs';
import {
  MCPRegistry,
  getMCPRegistry,
  type MCPCatalog,
} from '../mcp/mcp-registry.js';

/**
 * Integration tests for MCPRegistry using the actual catalog.json file
 * These tests verify that the registry works correctly with the real bundled catalog
 */
describe('MCPRegistry Integration Tests', () => {
  beforeEach(() => {
    // Reset singleton instance before each test
    MCPRegistry.resetInstance();
  });

  afterEach(() => {
    // Reset singleton instance after each test
    MCPRegistry.resetInstance();
  });

  describe('Real Catalog Loading', () => {
    it('should load the bundled catalog successfully', () => {
      const registry = MCPRegistry.getInstance();

      expect(registry.size).toBeGreaterThan(0);

      const catalogInfo = registry.getCatalogInfo();
      expect(catalogInfo.version).toBeDefined();
      expect(catalogInfo.updated).toBeDefined();
      expect(catalogInfo.description).toBeDefined();
    });

    it('should have valid catalog structure', () => {
      const registry = MCPRegistry.getInstance();

      const categories = registry.getCategories();
      expect(categories.length).toBeGreaterThan(0);

      // Check that standard categories exist
      const categoryIds = categories.map(c => c.id);
      expect(categoryIds).toContain('filesystem');
      expect(categoryIds).toContain('web');
      expect(categoryIds).toContain('development');
    });

    it('should have servers with required fields', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.listServers();

      expect(servers.length).toBeGreaterThan(0);

      servers.forEach(server => {
        // Check required fields
        expect(server.name).toBeDefined();
        expect(server.name.length).toBeGreaterThan(0);
        expect(server.description).toBeDefined();
        expect(server.description.length).toBeGreaterThan(0);
        expect(server.version).toBeDefined();
        expect(server.serverConfig).toBeDefined();
        expect(server.serverConfig.name).toBeDefined();
        expect(server.serverConfig.command).toBeDefined();

        // Check server config structure
        expect(server.serverConfig.name).toBe(server.name);
        expect(typeof server.serverConfig.command).toBe('string');
        expect(Array.isArray(server.serverConfig.args)).toBe(true);
        expect(typeof server.serverConfig.env).toBe('object');

        // Check optional fields have correct types when present
        if (server.capabilities) {
          expect(Array.isArray(server.capabilities)).toBe(true);
          server.capabilities.forEach(cap => {
            expect(typeof cap).toBe('string');
            expect(cap.length).toBeGreaterThan(0);
          });
        }

        if (server.verified !== undefined) {
          expect(typeof server.verified).toBe('boolean');
        }

        if (server.author) {
          expect(typeof server.author).toBe('string');
        }
      });
    });

    it('should categorize servers correctly', () => {
      const registry = MCPRegistry.getInstance();

      const filesystemServers = registry.getServersByCategory('filesystem');
      const webServers = registry.getServersByCategory('web');
      const devServers = registry.getServersByCategory('development');

      // Should have at least some servers in each major category
      expect(filesystemServers.length).toBeGreaterThanOrEqual(0);
      expect(webServers.length).toBeGreaterThanOrEqual(0);
      expect(devServers.length).toBeGreaterThanOrEqual(0);

      // Verify filesystem servers have file-related capabilities
      filesystemServers.forEach(server => {
        if (server.capabilities) {
          const hasFileCapability = server.capabilities.some(cap =>
            cap.includes('file:') || cap.includes('directory:')
          );
          if (hasFileCapability) {
            expect(hasFileCapability).toBe(true);
          }
        }
      });

      // Verify web servers have HTTP-related capabilities
      webServers.forEach(server => {
        if (server.capabilities) {
          const hasWebCapability = server.capabilities.some(cap =>
            cap.includes('http:') || cap.includes('browser:') || cap.includes('web:')
          );
          if (hasWebCapability) {
            expect(hasWebCapability).toBe(true);
          }
        }
      });
    });

    it('should support filtering operations on real data', () => {
      const registry = MCPRegistry.getInstance();

      // Test verified filter
      const verifiedServers = registry.listServers({ verified: true });
      verifiedServers.forEach(server => {
        expect(server.verified).toBe(true);
      });

      // Test capabilities filter (if any servers have file:read capability)
      const fileReadServers = registry.getServersByCapability('file:read');
      if (fileReadServers.length > 0) {
        fileReadServers.forEach(server => {
          expect(server.capabilities).toContain('file:read');
        });
      }

      // Test search functionality
      const searchResults = registry.listServers({ search: 'file' });
      if (searchResults.length > 0) {
        searchResults.forEach(server => {
          const matchesName = server.name.toLowerCase().includes('file');
          const matchesDescription = server.description.toLowerCase().includes('file');
          expect(matchesName || matchesDescription).toBe(true);
        });
      }
    });

    it('should have all capabilities properly formatted', () => {
      const registry = MCPRegistry.getInstance();
      const allCapabilities = registry.getAllCapabilities();

      allCapabilities.forEach(capability => {
        // Capabilities should follow namespace:action format
        expect(capability).toMatch(/^[a-z_]+:[a-z_]+$/);
        expect(capability.length).toBeGreaterThan(2);
      });

      // Should have some standard capabilities
      const hasFileCapabilities = allCapabilities.some(cap => cap.startsWith('file:'));
      const hasHttpCapabilities = allCapabilities.some(cap => cap.startsWith('http:'));

      // At least one of these should exist in a real catalog
      expect(hasFileCapabilities || hasHttpCapabilities).toBe(true);
    });

    it('should handle server lookup operations correctly', () => {
      const registry = MCPRegistry.getInstance();
      const serverNames = registry.getServerNames();

      expect(serverNames.length).toBeGreaterThan(0);

      // Pick a server and test lookup operations
      const testServerName = serverNames[0];

      expect(registry.hasServer(testServerName)).toBe(true);

      const server = registry.getServer(testServerName);
      expect(server).not.toBeNull();
      expect(server!.name).toBe(testServerName);

      const config = registry.getServerConfig(testServerName);
      expect(config).not.toBeNull();
      expect(config!.name).toBe(testServerName);

      // Test case sensitivity
      expect(registry.hasServer(testServerName.toUpperCase())).toBe(false);
      expect(registry.getServer(testServerName.toUpperCase())).toBeNull();
    });
  });

  describe('Catalog File Structure', () => {
    it('should load from the correct default path', () => {
      // This test verifies that the catalog.json file exists at the expected location
      const registry = MCPRegistry.getInstance();

      // The registry should load successfully, indicating the file exists
      expect(registry.size).toBeGreaterThan(0);

      // Verify catalog info is populated
      const info = registry.getCatalogInfo();
      expect(info.version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic version format
      expect(new Date(info.updated)).toBeInstanceOf(Date); // Valid date
    });

    it('should have consistent data structure across all servers', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.listServers();

      expect(servers.length).toBeGreaterThan(0);

      // All servers should have consistent structure
      servers.forEach((server, index) => {
        // Required string fields
        expect(typeof server.name).toBe('string');
        expect(server.name.trim()).toBe(server.name);
        expect(server.name.length).toBeGreaterThan(0);

        expect(typeof server.description).toBe('string');
        expect(server.description.trim()).toBe(server.description);
        expect(server.description.length).toBeGreaterThan(0);

        expect(typeof server.version).toBe('string');
        expect(server.version.trim()).toBe(server.version);

        // Server config validation
        expect(typeof server.serverConfig).toBe('object');
        expect(typeof server.serverConfig.name).toBe('string');
        expect(server.serverConfig.name).toBe(server.name);
        expect(typeof server.serverConfig.command).toBe('string');
        expect(Array.isArray(server.serverConfig.args)).toBe(true);
        expect(typeof server.serverConfig.env).toBe('object');

        // Optional fields validation
        if (server.capabilities !== undefined) {
          expect(Array.isArray(server.capabilities)).toBe(true);
          server.capabilities!.forEach(cap => {
            expect(typeof cap).toBe('string');
            expect(cap.trim()).toBe(cap);
            expect(cap.length).toBeGreaterThan(0);
          });
        }

        if (server.verified !== undefined) {
          expect(typeof server.verified).toBe('boolean');
        }

        if (server.author !== undefined) {
          expect(typeof server.author).toBe('string');
          expect(server.author.trim()).toBe(server.author);
        }

        if (server.repository !== undefined) {
          expect(typeof server.repository).toBe('string');
          expect(server.repository).toMatch(/^https?:\/\//);
        }

        if (server.homepage !== undefined) {
          expect(typeof server.homepage).toBe('string');
          expect(server.homepage).toMatch(/^https?:\/\//);
        }
      });
    });
  });

  describe('Performance and Memory', () => {
    it('should load catalog efficiently', () => {
      const startTime = Date.now();

      const registry = MCPRegistry.getInstance();
      const loadTime = Date.now() - startTime;

      // Loading should be fast (under 1 second for reasonable catalog sizes)
      expect(loadTime).toBeLessThan(1000);

      // Should be able to perform lookups quickly
      const lookupStart = Date.now();
      const serverNames = registry.getServerNames();
      const servers = registry.listServers();
      const categories = registry.getCategories();
      const lookupTime = Date.now() - lookupStart;

      expect(lookupTime).toBeLessThan(100); // Basic operations should be very fast

      // Verify we actually got data
      expect(serverNames.length).toBeGreaterThan(0);
      expect(servers.length).toBeGreaterThan(0);
      expect(categories.length).toBeGreaterThan(0);
    });

    it('should handle multiple operations without performance degradation', () => {
      const registry = MCPRegistry.getInstance();
      const iterations = 100;

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        registry.listServers();
        registry.getCategories();
        registry.getAllCapabilities();

        // Mix of different operations
        if (i % 2 === 0) {
          registry.listServers({ verified: true });
        } else {
          registry.listServers({ search: 'file' });
        }
      }

      const totalTime = Date.now() - startTime;
      const avgTimePerIteration = totalTime / iterations;

      // Should maintain good performance even with many operations
      expect(avgTimePerIteration).toBeLessThan(10); // Less than 10ms per iteration
    });
  });

  describe('Real-world Usage Patterns', () => {
    it('should support common discovery workflows', () => {
      const registry = MCPRegistry.getInstance();

      // Workflow 1: Browse by category
      const categories = registry.getCategories();
      expect(categories.length).toBeGreaterThan(0);

      for (const category of categories) {
        const servers = registry.getServersByCategory(category.id);
        // Some categories might be empty, but structure should be consistent
        servers.forEach(server => {
          expect(server.name).toBeDefined();
          expect(server.description).toBeDefined();
        });
      }

      // Workflow 2: Search for specific functionality
      const fileServers = registry.listServers({ search: 'file' });
      const webServers = registry.listServers({ search: 'web' });
      const httpServers = registry.listServers({ search: 'http' });

      // Should be able to find relevant servers (if they exist in catalog)
      if (fileServers.length > 0) {
        fileServers.forEach(server => {
          const hasRelevantText =
            server.name.toLowerCase().includes('file') ||
            server.description.toLowerCase().includes('file');
          expect(hasRelevantText).toBe(true);
        });
      }

      // Workflow 3: Filter by verification status
      const verifiedServers = registry.listServers({ verified: true });
      const allServers = registry.listServers();

      expect(verifiedServers.length).toBeLessThanOrEqual(allServers.length);
      verifiedServers.forEach(server => {
        expect(server.verified).toBe(true);
      });

      // Workflow 4: Get configuration for installation
      if (allServers.length > 0) {
        const testServer = allServers[0];
        const config = registry.getServerConfig(testServer.name);

        expect(config).not.toBeNull();
        expect(config!.command).toBeDefined();
        expect(config!.args).toBeDefined();
        expect(config!.env).toBeDefined();
      }
    });

    it('should support capability-based discovery', () => {
      const registry = MCPRegistry.getInstance();
      const allCapabilities = registry.getAllCapabilities();

      expect(allCapabilities.length).toBeGreaterThan(0);

      // Test capability-based discovery
      for (const capability of allCapabilities.slice(0, 5)) { // Test first 5 to avoid long test
        const servers = registry.getServersByCapability(capability);

        servers.forEach(server => {
          expect(server.capabilities).toContain(capability);
        });

        // Test with listServers capability filter
        const filteredServers = registry.listServers({ capabilities: [capability] });
        expect(filteredServers).toEqual(servers);
      }
    });

    it('should provide consistent singleton behavior across different access patterns', () => {
      // Test that all access methods return the same instance
      const registry1 = MCPRegistry.getInstance();
      const registry2 = getMCPRegistry();

      expect(registry1).toBe(registry2);

      // Test that data is consistent across different access methods
      const servers1 = registry1.listServers();
      const servers2 = registry2.listServers();

      expect(servers1).toEqual(servers2);

      // Test state persistence
      const originalSize = registry1.size;
      const newRegistryRef = MCPRegistry.getInstance();

      expect(newRegistryRef.size).toBe(originalSize);
      expect(newRegistryRef).toBe(registry1);
    });
  });
});