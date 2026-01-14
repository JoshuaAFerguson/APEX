import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import { MCPInstaller } from '../mcp-installer';
import { TaskStore } from '../store';
import { MCPServer, MCPInstallation, MCPMarketplaceEntry } from '@apexcli/core';

describe('MCPInstaller Integration Tests', () => {
  let installer: MCPInstaller;
  let mockStore: vi.Mocked<TaskStore>;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-installer-test-'));

    // Create a mock store
    mockStore = {
      createMcpInstallation: vi.fn(),
      getMcpInstallation: vi.fn(),
      listMcpInstallations: vi.fn(),
      removeMcpInstallation: vi.fn(),
      upsertMcpMarketplaceEntry: vi.fn(),
      listMcpMarketplaceEntries: vi.fn(),
    } as any;

    installer = new MCPInstaller(tempDir, mockStore);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
  });

  describe('Full Installation Workflow', () => {
    it('should complete full install-list-uninstall workflow', async () => {
      const mockServer: MCPServer = {
        name: 'test-server',
        description: 'Test MCP server for integration testing',
        command: 'npx',
        args: ['@test/mcp-server'],
        autoStart: false,
      };

      // Mock exec to simulate successful installation
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          setTimeout(() => callback(null, { stdout: 'Package installed successfully', stderr: '' }), 10);
        }
        return {} as any;
      });

      // Mock store operations
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);
      mockStore.removeMcpInstallation.mockResolvedValue(undefined);

      // Step 1: Install the server
      const installation = await installer.install(mockServer);

      expect(installation).toMatchObject({
        serverId: 'test-server',
        status: 'installed',
      });

      // Verify config file was created
      const configExists = await fs.access(installation.configPath).then(() => true).catch(() => false);
      expect(configExists).toBe(true);

      // Verify config file content
      const configContent = await fs.readFile(installation.configPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config).toMatchObject({
        name: 'test-server',
        type: 'stdio',
        command: 'npx',
        args: ['@test/mcp-server'],
        autoStart: false,
      });

      // Step 2: Mock the installation in store for listing
      const mockInstallations: MCPInstallation[] = [installation];
      mockStore.listMcpInstallations.mockResolvedValue(mockInstallations);
      mockStore.getMcpInstallation.mockResolvedValue(installation);

      // List installations
      const installations = await installer.listInstalled();
      expect(installations).toContain(installation);

      // Check if installed
      const isInstalled = await installer.isInstalled('test-server');
      expect(isInstalled).toBe(true);

      // Step 3: Uninstall the server
      await installer.uninstall('test-server');

      // Verify config file was removed
      const configExistsAfter = await fs.access(installation.configPath).then(() => true).catch(() => false);
      expect(configExistsAfter).toBe(false);

      // Verify store methods were called
      expect(mockStore.createMcpInstallation).toHaveBeenCalledWith(installation);
      expect(mockStore.removeMcpInstallation).toHaveBeenCalledWith(installation.id);
    });

    it('should handle concurrent installations gracefully', async () => {
      const server1: MCPServer = {
        name: 'server1',
        description: 'Server 1',
        command: 'npx',
        args: ['@test/server1'],
        autoStart: false,
      };

      const server2: MCPServer = {
        name: 'server2',
        description: 'Server 2',
        command: 'npx',
        args: ['@test/server2'],
        autoStart: false,
      };

      // Mock exec with delays
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          const delay = command.includes('server1') ? 50 : 100;
          setTimeout(() => callback(null, { stdout: 'Success', stderr: '' }), delay);
        }
        return {} as any;
      });

      // Mock store operations
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      // Install both servers concurrently
      const [installation1, installation2] = await Promise.all([
        installer.install(server1),
        installer.install(server2),
      ]);

      expect(installation1.serverId).toBe('server1');
      expect(installation2.serverId).toBe('server2');

      // Verify both config files exist
      const config1Exists = await fs.access(installation1.configPath).then(() => true).catch(() => false);
      const config2Exists = await fs.access(installation2.configPath).then(() => true).catch(() => false);

      expect(config1Exists).toBe(true);
      expect(config2Exists).toBe(true);

      // Verify config files have different names
      expect(installation1.configPath).not.toBe(installation2.configPath);
    });
  });

  describe('Marketplace Integration', () => {
    it('should update and retrieve marketplace entries', async () => {
      const marketplaceEntries: MCPMarketplaceEntry[] = [
        {
          name: 'popular-server',
          description: 'A popular MCP server',
          author: 'TestAuthor',
          version: '1.0.0',
          repository: 'https://github.com/test/popular-server',
          package: '@test/popular-server',
          category: 'productivity',
          tags: ['popular', 'productivity'],
          rating: 4.8,
          downloads: 10000,
          lastUpdated: new Date(),
        },
        {
          name: 'dev-tools-server',
          description: 'Development tools server',
          author: 'DevTools Inc',
          version: '2.1.0',
          repository: 'https://github.com/devtools/server',
          package: '@devtools/mcp-server',
          category: 'development',
          tags: ['development', 'tools'],
          rating: 4.5,
          downloads: 5000,
          lastUpdated: new Date(),
        },
      ];

      // Mock store operations
      mockStore.upsertMcpMarketplaceEntry.mockResolvedValue(undefined);
      mockStore.listMcpMarketplaceEntries.mockResolvedValue(marketplaceEntries);

      // Update marketplace cache
      await installer.updateMarketplaceCache(marketplaceEntries);

      // Retrieve marketplace entries
      const retrievedEntries = await installer.getMarketplaceEntries();

      expect(retrievedEntries).toEqual(marketplaceEntries);
      expect(mockStore.upsertMcpMarketplaceEntry).toHaveBeenCalledTimes(2);
      expect(mockStore.listMcpMarketplaceEntries).toHaveBeenCalled();
    });

    it('should handle marketplace server installation', async () => {
      // First, populate marketplace
      const marketplaceEntry: MCPMarketplaceEntry = {
        name: 'marketplace-server',
        description: 'Server from marketplace',
        author: 'Marketplace Inc',
        version: '1.0.0',
        repository: 'https://github.com/marketplace/server',
        package: '@marketplace/mcp-server',
        category: 'productivity',
        tags: ['marketplace'],
        rating: 4.7,
        downloads: 8000,
        lastUpdated: new Date(),
      };

      await installer.updateMarketplaceCache([marketplaceEntry]);

      // Create server definition based on marketplace entry
      const serverFromMarketplace: MCPServer = {
        name: marketplaceEntry.name,
        description: marketplaceEntry.description,
        command: 'npx',
        args: [marketplaceEntry.package],
        autoStart: false,
      };

      // Mock successful installation
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(null, { stdout: 'Marketplace server installed', stderr: '' });
        return {} as any;
      });

      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      // Install the server
      const installation = await installer.install(serverFromMarketplace);

      expect(installation.serverId).toBe('marketplace-server');
      expect(mockExec).toHaveBeenCalledWith(
        'npm install @marketplace/mcp-server',
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle partial installation failure and cleanup', async () => {
      const mockServer: MCPServer = {
        name: 'failing-server',
        description: 'A server that fails to install',
        command: 'npx',
        args: ['@test/failing-server'],
        autoStart: false,
      };

      // Mock exec failure
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          setTimeout(() => callback(new Error('Network error: Package not found'), null), 10);
        }
        return {} as any;
      });

      mockStore.getMcpInstallation.mockResolvedValue(null);

      // Installation should fail
      await expect(installer.install(mockServer)).rejects.toThrow(
        "Failed to install MCP server 'failing-server': Network error: Package not found"
      );

      // Verify no installation record was created
      expect(mockStore.createMcpInstallation).not.toHaveBeenCalled();

      // Verify no config file was left behind in the .apex directory
      const apexDir = path.join(tempDir, '.apex');
      const apexExists = await fs.access(apexDir).then(() => true).catch(() => false);

      if (apexExists) {
        const installationsDir = path.join(apexDir, 'mcp-installations');
        const installationsDirExists = await fs.access(installationsDir).then(() => true).catch(() => false);

        if (installationsDirExists) {
          const files = await fs.readdir(installationsDir);
          expect(files).toHaveLength(0);
        }
      }
    });

    it('should handle filesystem permission errors gracefully', async () => {
      const mockServer: MCPServer = {
        name: 'permission-test-server',
        description: 'Server to test permission errors',
        command: 'npx',
        args: ['@test/permission-server'],
        autoStart: false,
      };

      // Create a read-only directory to simulate permission issues
      const readOnlyDir = path.join(tempDir, '.apex', 'mcp-installations');
      await fs.mkdir(path.dirname(readOnlyDir), { recursive: true });
      await fs.mkdir(readOnlyDir);

      // Make directory read-only (this might not work on all systems, but we'll test anyway)
      try {
        await fs.chmod(readOnlyDir, 0o444);
      } catch {
        // Skip this test if we can't change permissions
        return;
      }

      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(null, { stdout: 'Success', stderr: '' });
        return {} as any;
      });

      mockStore.getMcpInstallation.mockResolvedValue(null);

      // Installation should fail due to permission error when writing config
      await expect(installer.install(mockServer)).rejects.toThrow();

      // Cleanup: restore permissions
      try {
        await fs.chmod(readOnlyDir, 0o755);
      } catch {
        // Ignore cleanup errors
      }
    });
  });

  describe('Configuration File Validation', () => {
    it('should create valid configuration files with all required fields', async () => {
      const complexServer: MCPServer = {
        name: 'complex-server',
        description: 'A complex server with many options',
        command: 'node',
        args: ['--experimental-modules', './server.js', '--port=8080'],
        autoStart: true,
      };

      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(null, { stdout: 'Success', stderr: '' });
        return {} as any;
      });

      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const installation = await installer.install(complexServer);

      // Read and validate the configuration file
      const configContent = await fs.readFile(installation.configPath, 'utf-8');
      const config = JSON.parse(configContent);

      expect(config).toEqual({
        name: 'complex-server',
        type: 'stdio',
        command: 'node',
        args: ['--experimental-modules', './server.js', '--port=8080'],
        autoStart: false, // Note: This should be false as per the implementation
      });

      // Verify JSON is properly formatted (pretty-printed)
      expect(configContent).toMatch(/{\s+"name":/);
      expect(configContent).toContain('  '); // Should have indentation
    });
  });

  describe('ID Generation and Uniqueness', () => {
    it('should generate unique IDs for multiple installations', async () => {
      const servers: MCPServer[] = Array.from({ length: 5 }, (_, i) => ({
        name: `server-${i}`,
        description: `Test server ${i}`,
        command: 'npx',
        args: [`@test/server-${i}`],
        autoStart: false,
      }));

      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(null, { stdout: 'Success', stderr: '' });
        return {} as any;
      });

      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      // Install all servers
      const installations = await Promise.all(
        servers.map(server => installer.install(server))
      );

      // Verify all IDs are unique
      const ids = installations.map(inst => inst.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      // Verify ID format
      ids.forEach(id => {
        expect(id).toMatch(/^mcp-\d+-[a-z0-9]+$/);
      });
    });
  });
});