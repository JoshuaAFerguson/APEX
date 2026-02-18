import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { MCPMarketplaceService } from '../mcp/marketplace-service';
import { MCPInstaller } from '../mcp-installer';
import { TaskStore } from '../store';
import { ApexConfig, MCPMarketplaceEntry, saveConfig, loadConfig } from '@apexcli/core';

// Mock modules
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
const mockSaveConfig = vi.mocked(saveConfig);
const mockLoadConfig = vi.mocked(loadConfig);
const mockExistsSync = vi.mocked(require('fs').existsSync);
const mockExecSync = vi.mocked(require('child_process').execSync);

describe('MCP Marketplace Integration Tests', () => {
  let tempDir: string;
  let store: TaskStore;
  let installer: MCPInstaller;
  let marketplaceService: MCPMarketplaceService;
  let mockConfig: ApexConfig;

  const sampleMarketplaceData = {
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
    ],
    categories: ['development', 'filesystem', 'git'],
    featured: ['filesystem', 'git'],
  };

  beforeEach(async () => {
    tempDir = path.join(__dirname, '..', '..', '..', 'test-temp', `mcp-integration-${Date.now()}`);

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

    // Initialize components
    store = new TaskStore(tempDir);
    await store.initialize();
    installer = new MCPInstaller(tempDir, store);
    marketplaceService = new MCPMarketplaceService(tempDir, mockConfig);

    // Clear all mocks
    vi.clearAllMocks();

    // Setup default mock responses
    mockReadFile.mockResolvedValue(JSON.stringify(sampleMarketplaceData));
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockSaveConfig.mockResolvedValue();
    mockExistsSync.mockReturnValue(true);
    mockExecSync.mockReturnValue('Docker version 20.10.0');

    // Mock exec to succeed by default
    execMock.mockImplementation((command, options, callback) => {
      if (typeof callback === 'function') {
        setTimeout(() => callback(null, { stdout: 'success', stderr: '' } as any), 10);
      }
      return {} as any;
    });
  });

  afterEach(async () => {
    try {
      store.close();
      await fs.rmdir(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Complete marketplace to installation flow', () => {
    it('should discover, install, and track MCP server from marketplace', async () => {
      // 1. Browse marketplace and find a server
      const entries = await marketplaceService.getMarketplaceEntries();
      expect(entries).toHaveLength(2);

      const filesystemEntry = entries.find(e => e.name === 'filesystem');
      expect(filesystemEntry).toBeDefined();
      expect(filesystemEntry?.verified).toBe(true);

      // 2. Install server via marketplace
      const installResult = await installer.install('filesystem');
      expect(installResult.name).toBe('filesystem');
      expect(installResult.installedFrom).toBe('marketplace');

      // 3. Verify server is tracked in store
      const installedServer = await installer.getInstalledServer('filesystem');
      expect(installedServer).not.toBeNull();
      expect(installedServer?.name).toBe('filesystem');

      // 4. Verify installation command was executed
      expect(execMock).toHaveBeenCalledWith(
        'npm install -g @modelcontextprotocol/server-filesystem',
        expect.objectContaining({ cwd: tempDir }),
        expect.any(Function)
      );

      // 5. List installed servers
      const installed = await installer.listInstalled();
      expect(installed).toHaveLength(1);
      expect(installed[0].name).toBe('filesystem');
    });

    it('should handle auto-configuration and installation', async () => {
      // 1. Auto-configure standard development tools
      const autoConfig = await marketplaceService.autoConfigureStandardTools({
        developmentTools: true
      });

      expect(autoConfig.configured.length).toBeGreaterThan(0);
      expect(autoConfig.configured.find(c => c.name === 'filesystem')).toBeDefined();

      // 2. Verify configuration was saved
      expect(mockSaveConfig).toHaveBeenCalledWith(tempDir, mockConfig);

      // 3. Install one of the auto-configured servers
      const filesystemConfig = autoConfig.configured.find(c => c.name === 'filesystem');
      expect(filesystemConfig?.args).toContain(tempDir); // Should have project path
    });

    it('should update marketplace cache and install new server', async () => {
      // 1. Add new entry to marketplace cache
      const newEntry: MCPMarketplaceEntry = {
        name: 'database',
        description: 'Database access server',
        version: '1.0.0',
        serverConfig: {
          name: 'database',
          type: 'stdio',
          command: 'db-server',
          autoStart: false,
        },
        installCommand: 'npm install -g database-mcp-server',
      };

      await installer.updateMarketplaceCache([newEntry]);

      // 2. Verify entry is in cache
      const cached = await installer.getMarketplaceEntries();
      expect(cached.find(e => e.name === 'database')).toBeDefined();

      // 3. Install from cache
      const installResult = await installer.install('database');
      expect(installResult.name).toBe('database');
      expect(installResult.installedFrom).toBe('marketplace');

      // 4. Verify installation command was executed
      expect(execMock).toHaveBeenCalledWith(
        'npm install -g database-mcp-server',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle marketplace search and filtering workflow', async () => {
      // 1. Search for development tools
      const devEntries = await marketplaceService.getMarketplaceEntries({
        category: 'development'
      });
      expect(devEntries).toHaveLength(2);

      // 2. Filter for verified only
      const verifiedEntries = await marketplaceService.getMarketplaceEntries({
        verified: true
      });
      expect(verifiedEntries).toHaveLength(2);

      // 3. Search by text
      const searchEntries = await marketplaceService.getMarketplaceEntries({
        search: 'git'
      });
      expect(searchEntries).toHaveLength(1);
      expect(searchEntries[0].name).toBe('git');

      // 4. Get recommendations
      const recommendations = await marketplaceService.getInstallationRecommendations();
      expect(recommendations.essential).toHaveLength(2); // filesystem, git
    });

    it('should handle server lifecycle management', async () => {
      // 1. Install server
      await installer.install('filesystem');

      // 2. Check if installed
      const isInstalled = await installer.isInstalled('filesystem');
      expect(isInstalled).toBe(true);

      // 3. Get server details
      const serverDetails = await installer.getInstalledServer('filesystem');
      expect(serverDetails).not.toBeNull();
      expect(serverDetails?.config.command).toBe('npx');

      // 4. Uninstall server
      await installer.uninstall('filesystem');

      // 5. Verify server is removed
      const isStillInstalled = await installer.isInstalled('filesystem');
      expect(isStillInstalled).toBe(false);
    });

    it('should prevent duplicate installations', async () => {
      // 1. Install server first time
      await installer.install('filesystem');

      // 2. Try to install again without force
      await expect(installer.install('filesystem')).rejects.toThrow(
        "MCP server 'filesystem' is already installed"
      );

      // 3. Reinstall with force flag
      const reinstallResult = await installer.install('filesystem', { force: true });
      expect(reinstallResult.name).toBe('filesystem');

      // 4. Verify exec was called twice (initial + force reinstall)
      expect(execMock).toHaveBeenCalledTimes(2);
    });

    it('should handle installation failures gracefully', async () => {
      // Mock exec to fail
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Installation failed'), null, null);
        }
        return {} as any;
      });

      // Try to install and expect failure
      await expect(installer.install('filesystem')).rejects.toThrow(
        "Failed to install MCP server 'filesystem'"
      );

      // Verify server is not tracked as installed
      const installed = await installer.listInstalled();
      expect(installed).toHaveLength(0);
    });

    it('should handle NPM package installation when not in marketplace', async () => {
      // Try to install a package not in marketplace
      const installResult = await installer.install('@custom/mcp-server');

      expect(installResult.name).toBe('mcp-server');
      expect(installResult.installedFrom).toBe('npx');
      expect(installResult.config.command).toBe('npx');
      expect(installResult.config.args).toEqual(['@custom/mcp-server']);
    });

    it('should support concurrent installations', async () => {
      // Start multiple installations concurrently
      const promises = [
        installer.install('filesystem'),
        installer.install('git'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      expect(results.map(r => r.name)).toEqual(['filesystem', 'git']);

      // Both should be installed
      const installed = await installer.listInstalled();
      expect(installed).toHaveLength(2);
    });

    it('should integrate with configuration management', async () => {
      // 1. Auto-configure tools
      const autoConfigResult = await marketplaceService.autoConfigureStandardTools({
        developmentTools: true
      });

      expect(autoConfigResult.configured.length).toBeGreaterThan(0);

      // 2. Verify mcp configuration was updated
      const filesystemConfig = autoConfigResult.configured.find(c => c.name === 'filesystem');
      expect(filesystemConfig).toBeDefined();

      // 3. Verify saveConfig was called
      expect(mockSaveConfig).toHaveBeenCalledWith(tempDir, mockConfig);

      // 4. Verify the config structure
      expect(mockConfig.mcp?.servers).toHaveProperty('filesystem');
    });
  });

  describe('Error scenarios and edge cases', () => {
    it('should handle marketplace data corruption', async () => {
      mockReadFile.mockResolvedValue('invalid json');

      await expect(marketplaceService.loadMarketplaceData()).rejects.toThrow(
        'Failed to load marketplace data'
      );
    });

    it('should handle store initialization failure', async () => {
      store.close();

      await expect(installer.listInstalled()).rejects.toThrow();
    });

    it('should handle network failures during installation', async () => {
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Network error'), null, null);
        }
        return {} as any;
      });

      await expect(installer.install('filesystem')).rejects.toThrow('Network error');
    });

    it('should handle partial installation cleanup', async () => {
      let callCount = 0;
      execMock.mockImplementation((command, options, callback) => {
        callCount++;
        if (typeof callback === 'function') {
          if (callCount === 1) {
            // Succeed on first call (installation)
            callback(null, { stdout: 'success', stderr: '' } as any);
          } else {
            // Fail on subsequent calls
            callback(new Error('Cleanup failed'), null, null);
          }
        }
        return {} as any;
      });

      const installResult = await installer.install('filesystem');
      expect(installResult.name).toBe('filesystem');

      // Uninstall should still work even if NPM cleanup fails
      await expect(installer.uninstall('filesystem')).resolves.not.toThrow();
    });

    it('should handle configuration save failures', async () => {
      mockSaveConfig.mockRejectedValue(new Error('Config save failed'));

      // Auto-configuration should handle config save errors gracefully
      const result = await marketplaceService.autoConfigureStandardTools({
        developmentTools: true
      });

      expect(result.configured.length).toBeGreaterThan(0);
      // Should not throw, but should still configure servers
    });
  });

  describe('Performance and scalability', () => {
    it('should handle large marketplace efficiently', async () => {
      // Create a large marketplace dataset
      const largeMarketplace = {
        entries: Array.from({ length: 100 }, (_, i) => ({
          name: `server-${i}`,
          description: `Server ${i}`,
          version: '1.0.0',
          serverConfig: {
            name: `server-${i}`,
            type: 'stdio',
            command: `server-${i}`,
            autoStart: false,
          },
          capabilities: [`capability-${i % 5}`],
        })),
        categories: Array.from({ length: 5 }, (_, i) => `capability-${i}`),
        featured: [`server-0`, `server-1`],
      };

      mockReadFile.mockResolvedValue(JSON.stringify(largeMarketplace));

      const service = new MCPMarketplaceService(tempDir, mockConfig);

      // Should load efficiently
      const start = Date.now();
      const entries = await service.getMarketplaceEntries();
      const loadTime = Date.now() - start;

      expect(entries).toHaveLength(100);
      expect(loadTime).toBeLessThan(100); // Should load in under 100ms

      // Filtering should be efficient
      const filteredStart = Date.now();
      const filtered = await service.getMarketplaceEntries({ category: 'capability-0' });
      const filterTime = Date.now() - filteredStart;

      expect(filtered).toHaveLength(20); // Every 5th entry
      expect(filterTime).toBeLessThan(50); // Filtering should be fast
    });

    it('should cache marketplace data efficiently', async () => {
      // Multiple concurrent requests should only load data once
      const promises = Array.from({ length: 10 }, () =>
        marketplaceService.loadMarketplaceData()
      );

      const results = await Promise.all(promises);

      // All results should be the same
      results.forEach(result => {
        expect(result).toEqual(sampleMarketplaceData);
      });

      // Should only read file once due to caching
      expect(mockReadFile).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid install/uninstall cycles', async () => {
      // Simulate rapid install/uninstall
      for (let i = 0; i < 5; i++) {
        await installer.install('filesystem', { force: i > 0 });
        await installer.uninstall('filesystem');
      }

      // Should end with no installed servers
      const installed = await installer.listInstalled();
      expect(installed).toHaveLength(0);

      // Should have called exec 5 times for installations
      expect(execMock).toHaveBeenCalledTimes(5);
    });
  });

  describe('Data persistence and recovery', () => {
    it('should persist installation data across store restarts', async () => {
      // Install a server
      await installer.install('filesystem');

      // Close and recreate store
      store.close();
      store = new TaskStore(tempDir);
      await store.initialize();
      installer = new MCPInstaller(tempDir, store);

      // Should still show as installed
      const isInstalled = await installer.isInstalled('filesystem');
      expect(isInstalled).toBe(true);

      const installed = await installer.listInstalled();
      expect(installed).toHaveLength(1);
      expect(installed[0].name).toBe('filesystem');
    });

    it('should handle database corruption gracefully', async () => {
      // Install a server first
      await installer.install('filesystem');

      // Simulate database corruption by closing store improperly
      store.close();

      // Try to access - should throw
      await expect(installer.listInstalled()).rejects.toThrow();

      // Should be able to reinitialize
      store = new TaskStore(tempDir);
      await store.initialize();
      installer = new MCPInstaller(tempDir, store);

      // Should work again (though data may be lost)
      const installed = await installer.listInstalled();
      expect(Array.isArray(installed)).toBe(true);
    });
  });
});