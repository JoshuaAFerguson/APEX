import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MCPInstaller } from '../mcp-installer';
import { TaskStore } from '../store';
import { MCPServer, MCPMarketplaceEntry } from '@apexcli/core';
import { InstalledMCPResult } from '../mcp-installer';

// Mock child_process for exec
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
const { exec } = await import('child_process');
const mockExec = vi.mocked(exec);

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
      getMcpMarketplaceEntry: vi.fn().mockResolvedValue(null),
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
        package: '@test/mcp-server',
        command: 'npx',
        args: ['@test/mcp-server'],
        version: '1.0.0', env: {}, envVars: [],
      };

      // Mock exec to simulate successful installation
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
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
      const result = await installer.install(mockServer);

      expect(result).toMatchObject({
        name: 'test-server',
        installedFrom: 'npm',
      });
      expect(result.config.command).toBe('npx');

      // Verify store was called with installation record
      expect(mockStore.createMcpInstallation).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 'test-server',
          status: 'installed',
        })
      );

      // Step 2: Mock the installation in store for listing
      mockStore.listMcpInstallations.mockResolvedValue([{
        id: 'mock-id',
        serverId: 'test-server',
        installedAt: new Date(),
        status: 'installed' as any,
        installedFrom: 'npm',
        configPath: path.join(tempDir, '.apex', 'mcp-installations', 'mock-id.json'),
        configJson: JSON.stringify(result.config),
      }]);
      mockStore.getMcpInstallation.mockResolvedValue({
        id: 'mock-id',
        serverId: 'test-server',
        installedAt: new Date(),
        status: 'installed' as any,
        installedFrom: 'npm',
        configPath: path.join(tempDir, '.apex', 'mcp-installations', 'mock-id.json'),
        configJson: JSON.stringify(result.config),
      });

      // List installations
      const installations = await installer.listInstalled();
      expect(installations).toHaveLength(1);
      expect(installations[0].name).toBe('test-server');

      // Check if installed
      const isInstalled = await installer.isInstalled('test-server');
      expect(isInstalled).toBe(true);

      // Step 3: Uninstall the server
      await installer.uninstall('test-server');

      // Verify store methods were called
      expect(mockStore.removeMcpInstallation).toHaveBeenCalledWith('mock-id');
    });

    it('should handle concurrent installations gracefully', async () => {
      const server1: MCPServer = {
        name: 'server1',
        package: '@test/server1',
        command: 'npx',
        args: ['@test/server1'],
        version: '1.0.0', env: {}, envVars: [],
      };

      const server2: MCPServer = {
        name: 'server2',
        package: '@test/server2',
        command: 'npx',
        args: ['@test/server2'],
        version: '1.0.0', env: {}, envVars: [],
      };

      // Mock exec with delays
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
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

      expect(installation1.name).toBe('server1');
      expect(installation2.name).toBe('server2');



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
          serverConfig: { name: 'popular-server', type: 'stdio', command: 'npx', args: ['@test/popular-server'], autoStart: false },
          verified: false,
        },
        {
          name: 'dev-tools-server',
          description: 'Development tools server',
          author: 'DevTools Inc',
          version: '2.1.0',
          repository: 'https://github.com/devtools/server',
          serverConfig: { name: 'dev-tools-server', type: 'stdio', command: 'npx', args: ['@devtools/mcp-server'], autoStart: false },
          verified: false,
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
        serverConfig: { name: 'marketplace-server', type: 'stdio', command: 'npx', args: ['@marketplace/mcp-server'], autoStart: false },
        verified: false,
      };

      await installer.updateMarketplaceCache([marketplaceEntry]);

      // Create server definition based on marketplace entry
      const serverFromMarketplace: MCPServer = {
        name: marketplaceEntry.name,
        package: '@marketplace/mcp-server',
        command: 'npx',
        args: ['@marketplace/mcp-server'],
        version: 'latest', env: {}, envVars: [],
      };

      // Mock successful installation
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(null, { stdout: 'Marketplace server installed', stderr: '' });
        return {} as any;
      });

      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      // Install the server
      const installation = await installer.install(serverFromMarketplace);

      expect(installation.name).toBe('marketplace-server');
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
        package: '@test/failing-server',
        command: 'npx',
        args: ['@test/failing-server'],
        version: '1.0.0', env: {}, envVars: [],
      };

      // Mock exec failure
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
        package: '@test/permission-server',
        command: 'npx',
        args: ['@test/permission-server'],
        version: '1.0.0', env: {}, envVars: [],
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
        package: '@test/complex-server',
        command: 'node',
        args: ['--experimental-modules', './server.js', '--port=8080'],
        version: '1.0.0', env: {}, envVars: [],
      };

      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(null, { stdout: 'Success', stderr: '' });
        return {} as any;
      });

      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const installation = await installer.install(complexServer);

      // Validate the returned config
      expect(installation.config).toEqual({
        name: 'complex-server',
        type: 'stdio',
        command: 'node',
        args: ['--experimental-modules', './server.js', '--port=8080'],
        autoStart: false,
      });

      // Verify installation metadata
      expect(installation.name).toBe('complex-server');
      expect(installation.installedAt).toBeInstanceOf(Date);
    });
  });

  describe('Name Uniqueness', () => {
    it('should return unique names for multiple installations', async () => {
      const servers: MCPServer[] = Array.from({ length: 5 }, (_, i) => ({
        name: `server-${i}`,
        package: `@test/server-${i}`,
        command: 'npx',
        args: [`@test/server-${i}`],
        version: '1.0.0', env: {}, envVars: [],
      }));

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

      // Verify all names are unique
      const names = installations.map(inst => inst.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);

      // Verify name format matches server names
      names.forEach((name, i) => {
        expect(name).toBe(`server-${i}`);
      });
    });
  });
});