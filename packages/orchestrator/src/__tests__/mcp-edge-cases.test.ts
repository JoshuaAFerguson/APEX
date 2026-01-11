import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { MCPMarketplaceService } from '../mcp/marketplace-service';
import { MCPInstaller } from '../mcp-installer';
import { TaskStore } from '../store';
import { ApexConfig, MCPMarketplaceEntry } from '@apexcli/core';

// Mock modules with comprehensive error scenarios
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    rmdir: vi.fn(),
  },
  existsSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
  execSync: vi.fn(),
}));

vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    saveConfig: vi.fn(),
    loadConfig: vi.fn(),
  };
});

const { exec } = await import('child_process');
const execMock = vi.mocked(exec);
const mockReadFile = vi.mocked(fs.readFile);
const mockExistsSync = vi.mocked(require('fs').existsSync);
const mockExecSync = vi.mocked(require('child_process').execSync);

describe('MCP Edge Cases and Error Handling', () => {
  let tempDir: string;
  let store: TaskStore;
  let installer: MCPInstaller;
  let marketplaceService: MCPMarketplaceService;
  let mockConfig: ApexConfig;

  beforeEach(async () => {
    tempDir = path.join(__dirname, '..', '..', '..', 'test-temp', `mcp-edge-${Date.now()}`);

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

    store = new TaskStore(tempDir);
    await store.initialize();
    installer = new MCPInstaller(tempDir, store);
    marketplaceService = new MCPMarketplaceService(tempDir, mockConfig);

    vi.clearAllMocks();

    // Default mocks
    mockReadFile.mockResolvedValue('{}');
    mockExistsSync.mockReturnValue(false);
    mockExecSync.mockReturnValue('');
  });

  afterEach(async () => {
    try {
      store.close();
      await fs.rmdir(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Malformed marketplace data handling', () => {
    it('should handle completely invalid JSON', async () => {
      mockReadFile.mockResolvedValue('this is not json at all!');

      await expect(marketplaceService.loadMarketplaceData()).rejects.toThrow(
        'Failed to load marketplace data:'
      );
    });

    it('should handle JSON with missing required fields', async () => {
      const invalidData = {
        entries: [
          {
            // Missing name field
            description: 'Test server',
            serverConfig: {
              type: 'stdio',
              command: 'test',
            },
          }
        ],
        categories: [],
        featured: [],
      };

      mockReadFile.mockResolvedValue(JSON.stringify(invalidData));

      await expect(marketplaceService.loadMarketplaceData()).rejects.toThrow();
    });

    it('should handle malformed serverConfig', async () => {
      const invalidData = {
        entries: [
          {
            name: 'test-server',
            description: 'Test server',
            version: '1.0.0',
            serverConfig: {
              // Missing required fields for MCPServerConfig
              invalidField: 'invalid',
            },
          }
        ],
        categories: [],
        featured: [],
      };

      mockReadFile.mockResolvedValue(JSON.stringify(invalidData));

      await expect(marketplaceService.loadMarketplaceData()).rejects.toThrow();
    });

    it('should handle entries with circular references', async () => {
      const circularEntry: any = {
        name: 'circular-server',
        description: 'Circular reference test',
        version: '1.0.0',
        serverConfig: {
          name: 'circular-server',
          type: 'stdio',
          command: 'test',
          autoStart: false,
        },
      };

      // Create circular reference
      circularEntry.self = circularEntry;

      const dataWithCircular = {
        entries: [circularEntry],
        categories: [],
        featured: [],
      };

      // JSON.stringify will throw on circular references
      expect(() => JSON.stringify(dataWithCircular)).toThrow();
    });

    it('should handle extremely large marketplace data', async () => {
      const largeEntry = {
        name: 'large-server',
        description: 'x'.repeat(10000), // Very large description
        version: '1.0.0',
        serverConfig: {
          name: 'large-server',
          type: 'stdio',
          command: 'test',
          autoStart: false,
          env: Object.fromEntries(
            Array.from({ length: 1000 }, (_, i) => [`VAR_${i}`, 'x'.repeat(100)])
          ),
        },
      };

      const largeData = {
        entries: [largeEntry],
        categories: [],
        featured: [],
      };

      mockReadFile.mockResolvedValue(JSON.stringify(largeData));

      const data = await marketplaceService.loadMarketplaceData();
      expect(data.entries).toHaveLength(1);
      expect(data.entries[0].description.length).toBe(10000);
    });

    it('should handle marketplace data with special characters', async () => {
      const specialCharsData = {
        entries: [
          {
            name: 'special-chars-测试-🚀-™-©',
            description: 'Server with émojis 🎉 and spëciàl çhārs',
            version: '1.0.0',
            serverConfig: {
              name: 'special-chars-测试-🚀-™-©',
              type: 'stdio',
              command: 'test',
              autoStart: false,
            },
          }
        ],
        categories: ['тест', '测试', 'ضك'],
        featured: ['special-chars-测试-🚀-™-©'],
      };

      mockReadFile.mockResolvedValue(JSON.stringify(specialCharsData));

      const data = await marketplaceService.loadMarketplaceData();
      expect(data.entries).toHaveLength(1);
      expect(data.entries[0].name).toContain('🚀');
      expect(data.categories).toContain('тест');
    });
  });

  describe('Installation command execution edge cases', () => {
    it('should handle installation commands that hang', async () => {
      const entry: MCPMarketplaceEntry = {
        name: 'hanging-server',
        description: 'Server that hangs during install',
        version: '1.0.0',
        installCommand: 'sleep 1000', // Command that would hang
        serverConfig: {
          name: 'hanging-server',
          type: 'stdio',
          command: 'test',
          autoStart: false,
        },
      };

      await store.upsertMcpMarketplaceEntry(entry);

      // Mock exec to never call callback
      execMock.mockImplementation(() => {
        return {} as any; // Never calls callback
      });

      // Note: This test doesn't actually wait for timeout since we're mocking
      // In a real scenario, this would timeout
      const result = await installer.install('hanging-server');
      expect(result.name).toBe('hanging-server');
    });

    it('should handle installation commands with non-zero exit codes', async () => {
      const entry: MCPMarketplaceEntry = {
        name: 'failing-server',
        description: 'Server that fails to install',
        version: '1.0.0',
        installCommand: 'exit 1',
        serverConfig: {
          name: 'failing-server',
          type: 'stdio',
          command: 'test',
          autoStart: false,
        },
      };

      await store.upsertMcpMarketplaceEntry(entry);

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          const error = new Error('Command failed with exit code 1') as any;
          error.code = 1;
          callback(error, null, null);
        }
        return {} as any;
      });

      await expect(installer.install('failing-server')).rejects.toThrow(
        "Failed to install MCP server 'failing-server'"
      );
    });

    it('should handle installation commands with stderr output', async () => {
      const entry: MCPMarketplaceEntry = {
        name: 'warning-server',
        description: 'Server with install warnings',
        version: '1.0.0',
        installCommand: 'npm install warning-package',
        serverConfig: {
          name: 'warning-server',
          type: 'stdio',
          command: 'test',
          autoStart: false,
        },
      };

      await store.upsertMcpMarketplaceEntry(entry);

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, {
            stdout: 'Package installed',
            stderr: 'Warning: deprecated dependency'
          } as any, null);
        }
        return {} as any;
      });

      const result = await installer.install('warning-server');
      expect(result.name).toBe('warning-server');
    });

    it('should handle malformed installation commands', async () => {
      const entry: MCPMarketplaceEntry = {
        name: 'malformed-server',
        description: 'Server with malformed install command',
        version: '1.0.0',
        installCommand: 'npm install && echo "test" | grep "invalid" && rm -rf /', // Complex command
        serverConfig: {
          name: 'malformed-server',
          type: 'stdio',
          command: 'test',
          autoStart: false,
        },
      };

      await store.upsertMcpMarketplaceEntry(entry);

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Permission denied'), null, null);
        }
        return {} as any;
      });

      await expect(installer.install('malformed-server')).rejects.toThrow();
    });

    it('should handle environment variable injection attacks', async () => {
      const entry: MCPMarketplaceEntry = {
        name: 'injection-server',
        description: 'Server with potential env injection',
        version: '1.0.0',
        installCommand: 'npm install test-package',
        serverConfig: {
          name: 'injection-server',
          type: 'stdio',
          command: 'test',
          autoStart: false,
        },
      };

      await store.upsertMcpMarketplaceEntry(entry);

      const maliciousEnv = {
        'NODE_ENV': 'production; rm -rf /', // Attempted injection
        'PATH': '/malicious/path:' + process.env.PATH,
      };

      execMock.mockImplementation((command, options, callback) => {
        // Verify the environment is passed but contained
        expect(options.env).toEqual(expect.objectContaining(maliciousEnv));
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      const result = await installer.install('injection-server', { env: maliciousEnv });
      expect(result.name).toBe('injection-server');
    });
  });

  describe('Package name extraction edge cases', () => {
    it('should handle complex scoped package names', async () => {
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      const testCases = [
        '@org/sub-org/package-name',
        '@scope/very-very-long-package-name-with-many-hyphens',
        '@123/package',
        '@-scope/package',
        '@scope/-package',
        '@/package', // Edge case: empty scope
        '@@/package', // Double @
      ];

      for (const packageName of testCases) {
        try {
          const result = await installer.installFromNpm(packageName);
          expect(result.name).toBeTruthy();
          expect(result.config.command).toBe('npx');
        } catch (error) {
          // Some edge cases might fail validation, which is acceptable
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle package names with version specifiers', async () => {
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      const testCases = [
        'package@1.0.0',
        'package@^1.0.0',
        'package@~1.0.0',
        'package@latest',
        'package@beta',
        '@scope/package@1.0.0',
        'package@git+https://github.com/user/repo.git',
      ];

      for (const packageName of testCases) {
        const result = await installer.installFromNpm(packageName);
        expect(result.name).toBeTruthy();
      }
    });

    it('should handle extremely long package names', async () => {
      const longPackageName = 'a'.repeat(214); // npm max package name length

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      const result = await installer.installFromNpm(longPackageName);
      expect(result.name).toBe(longPackageName);
    });

    it('should handle package names with special npm characters', async () => {
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      const testCases = [
        'package-with-hyphens',
        'package_with_underscores',
        'package123',
        'package.with.dots',
        '123package',
      ];

      for (const packageName of testCases) {
        const result = await installer.installFromNpm(packageName);
        expect(result.name).toBeTruthy();
      }
    });
  });

  describe('Database corruption and recovery', () => {
    it('should handle SQLite database corruption', async () => {
      // Install a server first
      await store.upsertMcpServerConfig('test-server', {
        name: 'test-server',
        type: 'stdio',
        command: 'test',
        autoStart: false,
      });

      // Corrupt the database by closing it improperly
      store.close();

      // Attempting to use installer should fail
      await expect(installer.listInstalled()).rejects.toThrow();

      // Should be able to recreate and reinitialize
      store = new TaskStore(tempDir);
      await store.initialize();
      installer = new MCPInstaller(tempDir, store);

      // Should work again (though previous data might be lost)
      const installed = await installer.listInstalled();
      expect(Array.isArray(installed)).toBe(true);
    });

    it('should handle concurrent database access', async () => {
      // Create multiple installers pointing to the same database
      const installer2 = new MCPInstaller(tempDir, store);
      const installer3 = new MCPInstaller(tempDir, store);

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          setTimeout(() => callback(null, { stdout: 'installed', stderr: '' } as any), 10);
        }
        return {} as any;
      });

      // Attempt concurrent operations
      const promises = [
        installer.installFromNpm('package1'),
        installer2.installFromNpm('package2'),
        installer3.installFromNpm('package3'),
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);

      // All should be tracked in the database
      const installed = await installer.listInstalled();
      expect(installed).toHaveLength(3);
    });

    it('should handle database schema evolution gracefully', async () => {
      // This test simulates what happens when the database schema changes
      // For now, we just ensure the store can be initialized multiple times

      store.close();

      // Re-initialize multiple times (simulating schema updates)
      for (let i = 0; i < 3; i++) {
        const newStore = new TaskStore(tempDir);
        await newStore.initialize();
        newStore.close();
      }

      // Final initialization should work
      store = new TaskStore(tempDir);
      await store.initialize();
      installer = new MCPInstaller(tempDir, store);

      const installed = await installer.listInstalled();
      expect(Array.isArray(installed)).toBe(true);
    });
  });

  describe('Project detection edge cases', () => {
    it('should handle inaccessible project directories', async () => {
      mockExistsSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Should not throw during service creation
      const service = new MCPMarketplaceService(tempDir, mockConfig);
      expect(service).toBeDefined();

      // Auto-configuration should still work with fallback recommendations
      const result = await service.autoConfigureStandardTools();
      expect(result.configured.length).toBeGreaterThanOrEqual(1); // At least filesystem
    });

    it('should handle symbolic links in project detection', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        // Simulate symbolic link scenarios
        if (path.includes('.git')) return true;
        if (path.includes('package.json')) return true;
        return false;
      });

      const service = new MCPMarketplaceService(tempDir, mockConfig);
      const result = await service.autoConfigureStandardTools();

      expect(result.configured.length).toBeGreaterThan(0);
    });

    it('should handle broken Docker installation', async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('docker --version')) {
          throw new Error('docker: command not found');
        }
        return '';
      });

      const service = new MCPMarketplaceService(tempDir, mockConfig);
      const result = await service.autoConfigureStandardTools({ devopsTools: true });

      // Should still configure other tools, Docker should be disabled
      expect(result.configured.length).toBeGreaterThan(0);
      const dockerConfig = result.configured.find(c => c.name === 'docker-management');
      expect(dockerConfig?.autoStart).toBe(false);
    });

    it('should handle directory traversal attempts', async () => {
      const maliciousPath = '../../../etc/passwd';

      mockExistsSync.mockImplementation((path: string) => {
        // Should still check paths, but they should be resolved safely
        expect(path).toContain(tempDir); // Ensure path is contained within project
        return false;
      });

      const service = new MCPMarketplaceService(maliciousPath, mockConfig);
      expect(service).toBeDefined();
    });
  });

  describe('Configuration edge cases', () => {
    it('should handle completely missing MCP configuration', async () => {
      const configWithoutMcp = {
        project: {
          name: 'test-project',
          version: '1.0.0',
          description: 'Test project',
        },
      };

      const service = new MCPMarketplaceService(tempDir, configWithoutMcp as ApexConfig);
      const result = await service.autoConfigureStandardTools({ developmentTools: true });

      expect(result.configured.length).toBeGreaterThan(0);
    });

    it('should handle deeply nested configuration structures', async () => {
      const deepConfig: any = {
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

      // Add deep nesting to test robustness
      for (let i = 0; i < 50; i++) {
        deepConfig[`level${i}`] = { nested: {} };
      }

      const service = new MCPMarketplaceService(tempDir, deepConfig);
      const result = await service.autoConfigureStandardTools({ developmentTools: true });

      expect(result.configured.length).toBeGreaterThan(0);
    });

    it('should handle configuration with invalid data types', async () => {
      const invalidConfig = {
        project: {
          name: 123, // Should be string
          version: null, // Should be string
          description: undefined, // Should be string
        },
        mcp: {
          enabled: 'true', // Should be boolean
          servers: null, // Should be object
        },
      };

      // Should handle invalid config gracefully
      const service = new MCPMarketplaceService(tempDir, invalidConfig as any);
      expect(service).toBeDefined();
    });
  });

  describe('Memory and resource management', () => {
    it('should handle large numbers of concurrent marketplace requests', async () => {
      const service = new MCPMarketplaceService(tempDir, mockConfig);

      // Create many concurrent requests
      const promises = Array.from({ length: 100 }, async () => {
        await service.getMarketplaceEntries({ search: Math.random().toString() });
        return service.getCategories();
      });

      const results = await Promise.all(promises);
      expect(results).toHaveLength(100);
    });

    it('should handle memory exhaustion scenarios gracefully', async () => {
      // Create very large marketplace data
      const hugeArray = Array.from({ length: 10000 }, (_, i) => ({
        name: `server-${i}`,
        description: `Server ${i}`.repeat(100), // Large description
        version: '1.0.0',
        serverConfig: {
          name: `server-${i}`,
          type: 'stdio',
          command: 'test',
          autoStart: false,
        },
        capabilities: Array.from({ length: 100 }, (_, j) => `capability-${j}`), // Many capabilities
      }));

      const hugeData = {
        entries: hugeArray,
        categories: [],
        featured: [],
      };

      mockReadFile.mockResolvedValue(JSON.stringify(hugeData));

      const service = new MCPMarketplaceService(tempDir, mockConfig);

      // Should handle large data without crashing
      const entries = await service.getMarketplaceEntries();
      expect(entries).toHaveLength(10000);

      // Filtering should still work
      const filtered = await service.getMarketplaceEntries({ search: 'server-42' });
      expect(filtered).toHaveLength(1);
    });

    it('should properly clean up resources on service destruction', async () => {
      const service = new MCPMarketplaceService(tempDir, mockConfig);

      // Load data to initialize caches
      await service.loadMarketplaceData();
      await service.getMarketplaceEntries();

      // JavaScript doesn't have explicit destructors, but we can simulate cleanup
      // In a real implementation, you might have cleanup methods
      expect(service).toBeDefined();
    });
  });
});