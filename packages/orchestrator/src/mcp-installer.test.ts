import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { MCPInstaller, InstallationResult, MCPInstallationOptions } from './mcp-installer';
import { TaskStore } from './store';
import { MCPMarketplaceEntry, MCPServerConfig } from '@apexcli/core';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

const { exec } = await import('child_process');
const execMock = vi.mocked(exec);

describe('MCPInstaller', () => {
  let tempDir: string;
  let store: TaskStore;
  let installer: MCPInstaller;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = path.join(__dirname, '..', '..', 'test-temp', `mcp-installer-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Initialize store and installer
    store = new TaskStore(tempDir);
    await store.initialize();
    installer = new MCPInstaller(tempDir, store);

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('install from marketplace', () => {
    it('should install server from marketplace entry', async () => {
      // Setup marketplace entry
      const entry: MCPMarketplaceEntry = {
        name: 'filesystem',
        description: 'File system server',
        version: '1.0.0',
        installCommand: 'npm install -g @modelcontextprotocol/server-filesystem',
        serverConfig: {
          name: 'filesystem',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
          autoStart: false,
        },
      };

      await store.upsertMcpMarketplaceEntry(entry);

      // Mock exec to succeed
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      const result = await installer.install('filesystem');

      expect(result.name).toBe('filesystem');
      expect(result.installedFrom).toBe('marketplace');
      expect(execMock).toHaveBeenCalledWith(
        'npm install -g @modelcontextprotocol/server-filesystem',
        expect.objectContaining({
          cwd: tempDir,
        }),
        expect.any(Function)
      );

      // Verify it's tracked in the store
      const installed = await installer.getInstalledServer('filesystem');
      expect(installed).not.toBeNull();
      expect(installed!.name).toBe('filesystem');
    });

    it('should fail when marketplace entry not found', async () => {
      await expect(installer.install('nonexistent')).rejects.toThrow('Failed to install MCP server from npm');
    });

    it('should prevent reinstallation without force flag', async () => {
      const entry: MCPMarketplaceEntry = {
        name: 'filesystem',
        description: 'File system server',
        version: '1.0.0',
        serverConfig: {
          name: 'filesystem',
          type: 'stdio',
          command: 'filesystem',
          autoStart: false,
        },
      };

      await store.upsertMcpMarketplaceEntry(entry);
      await store.upsertMcpServerConfig('filesystem', entry.serverConfig);

      await expect(installer.install('filesystem')).rejects.toThrow(
        "MCP server 'filesystem' is already installed. Use force option to reinstall."
      );
    });

    it('should allow reinstallation with force flag', async () => {
      const entry: MCPMarketplaceEntry = {
        name: 'filesystem',
        description: 'File system server',
        version: '1.0.0',
        serverConfig: {
          name: 'filesystem',
          type: 'stdio',
          command: 'filesystem',
          autoStart: false,
        },
      };

      await store.upsertMcpMarketplaceEntry(entry);
      await store.upsertMcpServerConfig('filesystem', entry.serverConfig);

      // Mock exec to succeed
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      const result = await installer.install('filesystem', { force: true });

      expect(result.name).toBe('filesystem');
      expect(result.installedFrom).toBe('marketplace');
    });
  });

  describe('install from npm', () => {
    it('should install npm package with npm command', async () => {
      // Mock exec to succeed
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('npm list -g')) {
            // Simulate global install found
            callback(null, { stdout: 'mcp-server-test@1.0.0', stderr: '' } as any);
          } else {
            callback(null, { stdout: 'installed', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      const result = await installer.installFromNpm('mcp-server-test');

      expect(result.name).toBe('test');
      expect(result.installedFrom).toBe('npm');
      expect(execMock).toHaveBeenCalledWith(
        'npm install mcp-server-test',
        expect.objectContaining({
          cwd: tempDir,
        }),
        expect.any(Function)
      );
    });

    it('should install scoped package with npx', async () => {
      // Mock exec to succeed
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      const result = await installer.installFromNpm('@modelcontextprotocol/server-filesystem');

      expect(result.name).toBe('filesystem');
      expect(result.installedFrom).toBe('npx');
      expect(result.config.command).toBe('npx');
      expect(result.config.args).toEqual(['@modelcontextprotocol/server-filesystem']);
    });

    it('should handle installation errors', async () => {
      // Mock exec to fail
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Installation failed'), null, null);
        }
        return {} as any;
      });

      await expect(installer.installFromNpm('failing-package')).rejects.toThrow(
        "Failed to install MCP server from npm 'failing-package'"
      );
    });

    it('should use global flag when specified', async () => {
      // Mock exec to succeed
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      await installer.installFromNpm('test-package', { global: true });

      expect(execMock).toHaveBeenCalledWith(
        'npm install -g test-package',
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('uninstall', () => {
    it('should uninstall existing server', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        type: 'stdio',
        command: 'test',
        autoStart: false,
      };

      await store.upsertMcpServerConfig('test-server', config);

      await installer.uninstall('test-server');

      const server = await installer.getInstalledServer('test-server');
      expect(server).toBeNull();
    });

    it('should fail when uninstalling non-existent server', async () => {
      await expect(installer.uninstall('nonexistent')).rejects.toThrow(
        "MCP server 'nonexistent' is not installed"
      );
    });
  });

  describe('listInstalled', () => {
    it('should list all installed servers', async () => {
      const configs = [
        {
          name: 'filesystem',
          type: 'stdio' as const,
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
          autoStart: false,
        },
        {
          name: 'test',
          type: 'stdio' as const,
          command: 'test-command',
          autoStart: false,
        },
      ];

      for (const config of configs) {
        await store.upsertMcpServerConfig(config.name, config);
      }

      const installed = await installer.listInstalled();

      expect(installed).toHaveLength(2);
      expect(installed.map(s => s.name)).toContain('filesystem');
      expect(installed.map(s => s.name)).toContain('test');
    });

    it('should return empty list when no servers installed', async () => {
      const installed = await installer.listInstalled();
      expect(installed).toHaveLength(0);
    });
  });

  describe('isInstalled', () => {
    it('should return true for installed server', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        type: 'stdio',
        command: 'test',
        autoStart: false,
      };

      await store.upsertMcpServerConfig('test-server', config);

      const isInstalled = await installer.isInstalled('test-server');
      expect(isInstalled).toBe(true);
    });

    it('should return false for non-installed server', async () => {
      const isInstalled = await installer.isInstalled('nonexistent');
      expect(isInstalled).toBe(false);
    });
  });

  describe('marketplace cache', () => {
    it('should update marketplace cache', async () => {
      const entries: MCPMarketplaceEntry[] = [
        {
          name: 'filesystem',
          description: 'File system server',
          version: '1.0.0',
          serverConfig: {
            name: 'filesystem',
            type: 'stdio',
            command: 'filesystem',
            autoStart: false,
          },
        },
        {
          name: 'sqlite',
          description: 'SQLite server',
          version: '1.0.0',
          serverConfig: {
            name: 'sqlite',
            type: 'stdio',
            command: 'sqlite',
            autoStart: false,
          },
        },
      ];

      await installer.updateMarketplaceCache(entries);

      const cached = await installer.getMarketplaceEntries();
      expect(cached).toHaveLength(2);
      expect(cached.map(e => e.name)).toContain('filesystem');
      expect(cached.map(e => e.name)).toContain('sqlite');
    });
  });

  describe('helper methods', () => {
    it('should extract server name from package names', async () => {
      const installer = new MCPInstaller(tempDir, store);

      // Test via the install method which uses extractServerName internally
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      // Test scoped package
      const result1 = await installer.installFromNpm('@modelcontextprotocol/server-filesystem');
      expect(result1.name).toBe('filesystem');

      // Test package with mcp-server- prefix
      const result2 = await installer.installFromNpm('mcp-server-sqlite');
      expect(result2.name).toBe('sqlite');

      // Test regular package
      const result3 = await installer.installFromNpm('some-package');
      expect(result3.name).toBe('some-package');
    });

    it('should handle complex package name extraction', async () => {
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      // Test scoped package with complex path
      const result1 = await installer.installFromNpm('@org/nested/package-name');
      expect(result1.name).toBe('package-name');

      // Test scoped package without server- prefix
      const result2 = await installer.installFromNpm('@modelcontextprotocol/something-else');
      expect(result2.name).toBe('something-else');

      // Test edge case: empty name after extraction
      const result3 = await installer.installFromNpm('@');
      expect(result3.name).toBe('@');
    });

    it('should guess installation source correctly', async () => {
      const npxConfig: MCPServerConfig = {
        name: 'test-npx',
        type: 'stdio',
        command: 'npx',
        args: ['@test/package'],
        autoStart: false,
      };
      await store.upsertMcpServerConfig('test-npx', npxConfig);

      const globalConfig: MCPServerConfig = {
        name: 'test-global',
        type: 'stdio',
        command: 'test-binary',
        autoStart: false,
      };
      await store.upsertMcpServerConfig('test-global', globalConfig);

      const manualConfig: MCPServerConfig = {
        name: 'test-manual',
        type: 'stdio',
        command: '/usr/local/bin/custom-server',
        autoStart: false,
      };
      await store.upsertMcpServerConfig('test-manual', manualConfig);

      const servers = await installer.listInstalled();

      const npxServer = servers.find(s => s.name === 'test-npx');
      const globalServer = servers.find(s => s.name === 'test-global');
      const manualServer = servers.find(s => s.name === 'test-manual');

      expect(npxServer?.installedFrom).toBe('npx');
      expect(globalServer?.installedFrom).toBe('npm');
      expect(manualServer?.installedFrom).toBe('manual');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle marketplace entry without install command', async () => {
      const entry: MCPMarketplaceEntry = {
        name: 'no-install-command',
        description: 'Server without install command',
        version: '1.0.0',
        serverConfig: {
          name: 'no-install-command',
          type: 'stdio',
          command: 'manual-install',
          autoStart: false,
        },
      };

      await store.upsertMcpMarketplaceEntry(entry);

      const result = await installer.install('no-install-command');

      expect(result.name).toBe('no-install-command');
      expect(result.installedFrom).toBe('marketplace');
      // Should not have called exec since no installCommand
      expect(execMock).not.toHaveBeenCalled();
    });

    it('should handle exec callback not being function', async () => {
      const entry: MCPMarketplaceEntry = {
        name: 'test-entry',
        description: 'Test entry',
        version: '1.0.0',
        installCommand: 'npm install test-package',
        serverConfig: {
          name: 'test-entry',
          type: 'stdio',
          command: 'test',
          autoStart: false,
        },
      };

      await store.upsertMcpMarketplaceEntry(entry);

      // Mock exec to return without callback
      execMock.mockImplementation(() => {
        return {} as any;
      });

      const result = await installer.install('test-entry');
      expect(result.name).toBe('test-entry');
    });

    it('should handle npm list command failures gracefully', async () => {
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('npm list -g')) {
            // Simulate npm list failure
            callback(new Error('npm list failed'), null, null);
          } else {
            callback(null, { stdout: 'installed', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      const result = await installer.installFromNpm('test-package');

      expect(result.name).toBe('test-package');
      expect(result.config.command).toBe('npx');
      expect(result.config.args).toEqual(['test-package']);
    });

    it('should handle environment variables in installation', async () => {
      const entry: MCPMarketplaceEntry = {
        name: 'env-test',
        description: 'Test with env vars',
        version: '1.0.0',
        installCommand: 'npm install env-package',
        serverConfig: {
          name: 'env-test',
          type: 'stdio',
          command: 'env-test',
          autoStart: false,
        },
      };

      await store.upsertMcpMarketplaceEntry(entry);

      let capturedEnv: any;
      execMock.mockImplementation((command, options, callback) => {
        capturedEnv = options.env;
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      const customEnv = { CUSTOM_VAR: 'test-value' };
      await installer.install('env-test', { env: customEnv });

      expect(capturedEnv).toEqual(expect.objectContaining(customEnv));
      expect(capturedEnv).toEqual(expect.objectContaining(process.env));
    });

    it('should handle additional npm arguments', async () => {
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      await installer.installFromNpm('test-package', {
        global: true,
        args: ['--save-dev', '--verbose']
      });

      expect(execMock).toHaveBeenCalledWith(
        'npm install -g test-package --save-dev --verbose',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle database access through getDatabase method', async () => {
      const config: MCPServerConfig = {
        name: 'db-test-server',
        type: 'stdio',
        command: 'test',
        autoStart: false,
      };

      await store.upsertMcpServerConfig('db-test-server', config);

      // Verify server was stored
      const server = await installer.getInstalledServer('db-test-server');
      expect(server).not.toBeNull();

      // Test removal through SQL
      await installer.uninstall('db-test-server');

      // Verify server was removed
      const removedServer = await installer.getInstalledServer('db-test-server');
      expect(removedServer).toBeNull();
    });

    it('should handle concurrent installations', async () => {
      execMock.mockImplementation((command, options, callback) => {
        setTimeout(() => {
          if (typeof callback === 'function') {
            callback(null, { stdout: 'installed', stderr: '' } as any);
          }
        }, 10);
        return {} as any;
      });

      const promises = [
        installer.installFromNpm('package1'),
        installer.installFromNpm('package2'),
        installer.installFromNpm('package3')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results.map(r => r.name)).toEqual(['package1', 'package2', 'package3']);
    });
  });

  describe('marketplace cache operations', () => {
    it('should handle empty marketplace cache', async () => {
      const entries = await installer.getMarketplaceEntries();
      expect(entries).toHaveLength(0);
    });

    it('should update marketplace cache with multiple entries efficiently', async () => {
      const entries: MCPMarketplaceEntry[] = Array.from({ length: 10 }, (_, i) => ({
        name: `server-${i}`,
        description: `Server ${i}`,
        version: '1.0.0',
        serverConfig: {
          name: `server-${i}`,
          type: 'stdio',
          command: `server-${i}`,
          autoStart: false,
        },
      }));

      await installer.updateMarketplaceCache(entries);

      const cached = await installer.getMarketplaceEntries();
      expect(cached).toHaveLength(10);
      expect(cached.map(e => e.name)).toEqual(entries.map(e => e.name));
    });

    it('should handle marketplace entries with all optional fields', async () => {
      const fullEntry: MCPMarketplaceEntry = {
        name: 'full-featured-server',
        description: 'A fully featured test server',
        version: '2.1.0',
        author: 'Test Author',
        homepage: 'https://example.com',
        repository: 'https://github.com/test/repo',
        installCommand: 'npm install -g full-featured-server',
        capabilities: ['filesystem', 'database'],
        verified: true,
        serverConfig: {
          name: 'full-featured-server',
          type: 'stdio',
          command: 'full-featured',
          args: ['--config', 'production'],
          autoStart: true,
          env: { NODE_ENV: 'production' },
        },
      };

      await installer.updateMarketplaceCache([fullEntry]);

      const cached = await installer.getMarketplaceEntries();
      expect(cached).toHaveLength(1);

      const retrieved = cached[0];
      expect(retrieved.author).toBe('Test Author');
      expect(retrieved.homepage).toBe('https://example.com');
      expect(retrieved.repository).toBe('https://github.com/test/repo');
      expect(retrieved.capabilities).toEqual(['filesystem', 'database']);
      expect(retrieved.verified).toBe(true);
    });
  });

  describe('installation options', () => {
    it('should respect force flag for marketplace installations', async () => {
      const entry: MCPMarketplaceEntry = {
        name: 'force-test',
        description: 'Force installation test',
        version: '1.0.0',
        installCommand: 'npm install force-test',
        serverConfig: {
          name: 'force-test',
          type: 'stdio',
          command: 'force-test',
          autoStart: false,
        },
      };

      await store.upsertMcpMarketplaceEntry(entry);
      await store.upsertMcpServerConfig('force-test', entry.serverConfig);

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      // Should not throw with force flag
      const result = await installer.install('force-test', { force: true });
      expect(result.name).toBe('force-test');

      // Should have called exec for reinstallation
      expect(execMock).toHaveBeenCalledWith(
        'npm install force-test',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle complex installation scenarios', async () => {
      const options: MCPInstallationOptions = {
        force: true,
        global: true,
        args: ['--production', '--no-optional'],
        env: {
          NODE_ENV: 'production',
          CUSTOM_FLAG: 'true'
        }
      };

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      const result = await installer.installFromNpm('complex-package', options);

      expect(result.name).toBe('complex-package');
      expect(result.installedFrom).toBe('npm');

      expect(execMock).toHaveBeenCalledWith(
        'npm install -g complex-package --production --no-optional',
        expect.objectContaining({
          env: expect.objectContaining({
            NODE_ENV: 'production',
            CUSTOM_FLAG: 'true'
          })
        }),
        expect.any(Function)
      );
    });
  });

  describe('integration with TaskStore', () => {
    it('should persist installation metadata correctly', async () => {
      const config: MCPServerConfig = {
        name: 'metadata-test',
        type: 'stdio',
        command: 'test',
        autoStart: false,
      };

      await store.upsertMcpServerConfig('metadata-test', config);

      const server = await installer.getInstalledServer('metadata-test');
      expect(server).not.toBeNull();
      expect(server!.name).toBe('metadata-test');
      expect(server!.config).toEqual(config);
      expect(server!.installedAt).toBeInstanceOf(Date);
    });

    it('should handle store errors gracefully', async () => {
      // Close the store to simulate database errors
      store.close();

      await expect(installer.listInstalled()).rejects.toThrow();
      await expect(installer.getInstalledServer('test')).rejects.toThrow();
      await expect(installer.isInstalled('test')).rejects.toThrow();

      // Reinitialize store for cleanup
      store = new TaskStore(tempDir);
      await store.initialize();
      installer = new MCPInstaller(tempDir, store);
    });
  });
});