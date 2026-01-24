import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPInstaller } from '../mcp-installer';
import { MCPServer } from '@apexcli/core';

// Mock filesystem operations
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

// Mock child_process (used via promisify)
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

// Mock TaskStore
vi.mock('../store', () => ({
  TaskStore: vi.fn()
}));

import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { TaskStore } from '../store';

describe('MCPInstaller Rollback on Failure', () => {
  let installer: MCPInstaller;
  let mockStore: {
    createMcpInstallation: ReturnType<typeof vi.fn>;
    getMcpInstallation: ReturnType<typeof vi.fn>;
    removeMcpInstallation: ReturnType<typeof vi.fn>;
    listMcpInstallations: ReturnType<typeof vi.fn>;
    upsertMcpMarketplaceEntry: ReturnType<typeof vi.fn>;
    listMcpMarketplaceEntries: ReturnType<typeof vi.fn>;
  };
  let mockExec: ReturnType<typeof vi.fn>;
  let mockFs: {
    mkdir: ReturnType<typeof vi.fn>;
    writeFile: ReturnType<typeof vi.fn>;
    unlink: ReturnType<typeof vi.fn>;
    access: ReturnType<typeof vi.fn>;
    readFile: ReturnType<typeof vi.fn>;
  };

  const projectPath = '/test/project';

  function createTestServer(name: string = 'test-server', overrides: Partial<MCPServer> = {}): MCPServer {
    return {
      name,
      package: `@test/${name}`,
      command: 'npx',
      args: [`@test/${name}`],
      env: {},
      envVars: [],
      version: '1.0.0',
      ...overrides,
    };
  }

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup TaskStore mock
    mockStore = {
      createMcpInstallation: vi.fn().mockResolvedValue(undefined),
      getMcpInstallation: vi.fn().mockResolvedValue(null),
      removeMcpInstallation: vi.fn().mockResolvedValue(undefined),
      listMcpInstallations: vi.fn().mockResolvedValue([]),
      upsertMcpMarketplaceEntry: vi.fn().mockResolvedValue(undefined),
      listMcpMarketplaceEntries: vi.fn().mockResolvedValue([]),
      getMcpMarketplaceEntry: vi.fn().mockResolvedValue(null), // Added missing method
    };
    (TaskStore as any).mockImplementation(() => mockStore);

    // Setup child_process.exec mock
    mockExec = vi.mocked(exec);
    mockExec.mockImplementation((cmd: string, opts: any, cb?: Function) => {
      // Handle both callback and options-only signatures
      if (typeof opts === 'function') {
        cb = opts;
        opts = {};
      }
      if (cb) {
        // By default, all commands succeed
        cb(null, { stdout: 'success', stderr: '' });
      }
      return {} as any;
    });

    // Setup fs mocks
    mockFs = {
      mkdir: vi.mocked(fs.mkdir),
      writeFile: vi.mocked(fs.writeFile),
      unlink: vi.mocked(fs.unlink),
      access: vi.mocked(fs.access),
      readFile: vi.mocked(fs.readFile),
    };

    // Set default resolved values for fs operations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('{}');

    // Create installer instance
    installer = new MCPInstaller(projectPath, mockStore as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Category 1: Rollback on Download/Install Failure', () => {
    it('1.1 should propagate error when npm install fails with no rollback needed', async () => {
      const server = createTestServer();

      // Mock npm install to fail
      mockExec.mockImplementation((cmd: string, opts: any, cb?: Function) => {
        if (typeof opts === 'function') {
          cb = opts;
          opts = {};
        }
        if (cb && cmd.includes('npm install')) {
          cb(new Error('ENETUNREACH: network timeout'));
        }
        return {} as any;
      });

      await expect(installer.install(server)).rejects.toThrow(
        /Failed to install MCP server 'test-server': ENETUNREACH: network timeout/
      );

      // Verify no cleanup calls were made (nothing to rollback)
      expect(mockFs.unlink).not.toHaveBeenCalled();
      expect(mockStore.removeMcpInstallation).not.toHaveBeenCalled();
      expect(mockExec).toHaveBeenCalledTimes(1); // Only the failed install
    });

    it('1.2 should not call createConfigFile when npm install fails', async () => {
      const server = createTestServer();

      // Mock npm install to fail
      mockExec.mockImplementation((cmd: string, opts: any, cb?: Function) => {
        if (typeof opts === 'function') {
          cb = opts;
          opts = {};
        }
        if (cb && cmd.includes('npm install')) {
          cb(new Error('EACCES: permission denied'));
        }
        return {} as any;
      });

      await expect(installer.install(server)).rejects.toThrow();

      // Verify config file creation was not attempted
      expect(mockFs.mkdir).not.toHaveBeenCalled();
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('1.3 should not create store record when npm install fails', async () => {
      const server = createTestServer();

      // Mock npm install to fail
      mockExec.mockImplementation((cmd: string, opts: any, cb?: Function) => {
        if (typeof opts === 'function') {
          cb = opts;
          opts = {};
        }
        if (cb && cmd.includes('npm install')) {
          cb(new Error('ERR_INVALID_URL: Invalid package'));
        }
        return {} as any;
      });

      await expect(installer.install(server)).rejects.toThrow();

      // Verify store record was not created
      expect(mockStore.createMcpInstallation).not.toHaveBeenCalled();
    });

    it('1.4 should handle network timeout during npm install same as other failures', async () => {
      const server = createTestServer();

      // Mock network timeout
      mockExec.mockImplementation((cmd: string, opts: any, cb?: Function) => {
        if (typeof opts === 'function') {
          cb = opts;
          opts = {};
        }
        if (cb && cmd.includes('npm install')) {
          cb(new Error('ETIMEDOUT: timeout'));
        }
        return {} as any;
      });

      await expect(installer.install(server)).rejects.toThrow(
        /Failed to install MCP server 'test-server': ETIMEDOUT: timeout/
      );

      // Verify clean failure with no rollback attempts
      expect(mockExec).toHaveBeenCalledTimes(1);
      expect(mockFs.unlink).not.toHaveBeenCalled();
      expect(mockStore.removeMcpInstallation).not.toHaveBeenCalled();
    });
  });

  describe('Category 1.5: Rollback with Environment Variables', () => {
    it('should preserve environment variables during rollback operations', async () => {
      const server = createTestServer('env-server', {
        env: { TEST_VAR: 'test-value', API_KEY: 'secret' }
      });
      const customEnv = { INSTALL_MODE: 'dev', NODE_ENV: 'test' };

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          // Verify environment variables are passed to rollback command
          expect(opts.env).toMatchObject({
            ...process.env,
            INSTALL_MODE: 'dev',
            NODE_ENV: 'test'
          });
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Store operation fails, triggering rollback
      mockStore.createMcpInstallation.mockRejectedValueOnce(new Error('Store error'));

      await expect(installer.install(server, { env: customEnv })).rejects.toThrow();

      // Verify rollback uninstall was called with environment variables
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.objectContaining({
          env: expect.objectContaining(customEnv)
        }),
        expect.any(Function)
      );
    });

    it('should handle rollback when environment variable setup fails', async () => {
      const server = createTestServer('env-fail-server', {
        env: { REQUIRED_VAR: 'value' }
      });

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          // Simulate failure due to missing environment variable
          cb(new Error('Missing required environment variable: REQUIRED_VAR'));
        }
        return {} as any;
      });

      await expect(installer.install(server)).rejects.toThrow(
        /Failed to install MCP server 'env-fail-server': Missing required environment variable/
      );

      // No rollback should occur since install never succeeded
      expect(mockExec).toHaveBeenCalledTimes(1); // Only the failed install
      expect(mockFs.unlink).not.toHaveBeenCalled();
      expect(mockStore.removeMcpInstallation).not.toHaveBeenCalled();
    });
  });

  describe('Category 2: Rollback on Corrupted Files', () => {
    it('2.1 should rollback and uninstall package when config writeFile fails', async () => {
      const server = createTestServer();

      // Mock npm install to succeed, but writeFile to fail
      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      mockFs.writeFile.mockRejectedValueOnce(new Error('ENOSPC: disk full'));

      await expect(installer.install(server)).rejects.toThrow(
        /Failed to install MCP server 'test-server': ENOSPC: disk full/
      );

      // Verify rollback uninstall was triggered
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall @test/test-server'),
        expect.objectContaining({ cwd: projectPath }),
        expect.any(Function)
      );

      // Verify install happened first
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm install @test/test-server@1.0.0'),
        expect.objectContaining({ cwd: projectPath }),
        expect.any(Function)
      );

      expect(mockExec).toHaveBeenCalledTimes(2); // install + uninstall
    });

    it('2.2 should rollback when writeFile throws due to permissions', async () => {
      const server = createTestServer();

      // Mock successful npm install, failed writeFile
      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'success', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      mockFs.writeFile.mockRejectedValueOnce(new Error('EACCES: permission denied'));

      await expect(installer.install(server)).rejects.toThrow();

      // Verify rollback occurred
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('2.3 should rollback when mkdir fails for config directory', async () => {
      const server = createTestServer();

      // Mock successful npm install, failed mkdir
      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'success', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      mockFs.mkdir.mockRejectedValueOnce(new Error('EROFS: read-only file system'));

      await expect(installer.install(server)).rejects.toThrow();

      // Verify rollback occurred
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('2.4 should return false when verifyInstallation detects corruption', async () => {
      const server = createTestServer();

      // Mock existing installation
      const mockInstallation = {
        id: 'test-id',
        serverId: 'test-server',
        installedAt: new Date(),
        status: 'installed' as const,
        configPath: '/test/.apex/mcp-installations/test-id.json',
      };
      mockStore.getMcpInstallation.mockResolvedValue(mockInstallation);

      // Mock corrupted JSON file
      mockFs.readFile.mockResolvedValueOnce('{ invalid json }');

      const result = await installer.verifyInstallation('test-server');
      expect(result).toBe(false);
    });

    it('2.5 should handle complex file corruption scenarios during rollback', async () => {
      const server = createTestServer('complex-server', {
        env: { CONFIG_MODE: 'production' }
      });

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // File creation succeeds but config validation fails
      mockFs.writeFile.mockResolvedValueOnce(undefined);
      mockStore.createMcpInstallation.mockRejectedValueOnce(new Error('Config validation failed'));

      await expect(installer.install(server)).rejects.toThrow();

      // Verify rollback removes the config file even if store operation failed
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('.apex/mcp-installations/')
      );
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('Category 3: Rollback on Dependency Failure', () => {
    it('3.1 should rollback when store creation fails after successful install', async () => {
      const server = createTestServer('main-server');

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed main', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Store creation fails (simulates dependency/constraint failure)
      mockStore.createMcpInstallation.mockRejectedValueOnce(
        new Error('Dependency constraint violation')
      );

      await expect(installer.install(server)).rejects.toThrow();

      // Should have attempted rollback uninstall
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('3.2 should cleanup partial installs when dependency fails mid-chain', async () => {
      const server = createTestServer('main-server');

      // Mock npm install to succeed, then dependency resolution to fail later
      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install') && !cmd.includes('uninstall')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Make config file creation fail (simulating dependency failure)
      mockFs.writeFile.mockRejectedValueOnce(new Error('Dependency validation failed'));

      await expect(installer.install(server)).rejects.toThrow();

      // Verify rollback uninstall was called
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('3.3 should handle optional dependency failures gracefully', async () => {
      const server = createTestServer('main-server', {
        optionalDependencies: ['@test/optional-dep']
      });

      // This test verifies the current behavior - optional deps aren't handled differently yet
      // But the rollback mechanism should still work for the main installation
      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Make store operation fail to test rollback
      mockStore.createMcpInstallation.mockRejectedValueOnce(
        new Error('Database constraint violation')
      );

      await expect(installer.install(server)).rejects.toThrow();

      // Should still perform rollback
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('3.4 should cleanup all partial installs when dependency resolution fails', async () => {
      const server = createTestServer();

      // Mock install success, but store failure
      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      mockStore.createMcpInstallation.mockRejectedValueOnce(
        new Error('Dependency resolution failed')
      );

      await expect(installer.install(server)).rejects.toThrow();

      // Verify rollback cleaned up everything
      expect(mockFs.unlink).toHaveBeenCalled(); // config file removal
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      ); // package removal
    });
  });

  describe('Category 4: Partial Installation Cleanup', () => {
    it('4.1 should remove config file and uninstall package when store operation throws', async () => {
      const server = createTestServer();

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Store operation fails
      mockStore.createMcpInstallation.mockRejectedValueOnce(
        new Error('SQLITE_CONSTRAINT: unique violation')
      );

      await expect(installer.install(server)).rejects.toThrow();

      // Verify config file was cleaned up
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('.apex/mcp-installations/')
      );

      // Verify package was uninstalled
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.objectContaining({ cwd: projectPath }),
        expect.any(Function)
      );

      // Verify no store record was created (it failed)
      expect(mockStore.createMcpInstallation).toHaveBeenCalledTimes(1); // Only the failed attempt
    });

    it('4.2 should uninstall package when createConfigFile throws', async () => {
      const server = createTestServer();

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Config file creation fails
      mockFs.writeFile.mockRejectedValueOnce(new Error('File system error'));

      await expect(installer.install(server)).rejects.toThrow();

      // Verify package was uninstalled in rollback
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      );

      // Verify store operation was never attempted
      expect(mockStore.createMcpInstallation).not.toHaveBeenCalled();
    });

    it('4.3 should swallow rollback errors and preserve original error', async () => {
      const server = createTestServer();

      let callCount = 0;
      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        callCount++;
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          // Rollback uninstall fails
          cb(new Error('Uninstall failed - package in use'));
        }
        return {} as any;
      });

      // Store operation fails (original error)
      mockStore.createMcpInstallation.mockRejectedValueOnce(
        new Error('Original store error')
      );

      await expect(installer.install(server)).rejects.toThrow(
        /Failed to install MCP server 'test-server': Original store error/
      );

      // Verify rollback uninstall was attempted despite failing
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('4.4 should not cleanup shared config directory when installation fails', async () => {
      const server = createTestServer();

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Store operation fails
      mockStore.createMcpInstallation.mockRejectedValueOnce(new Error('Store error'));

      await expect(installer.install(server)).rejects.toThrow();

      // Verify individual config file was removed, but not the directory
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('.apex/mcp-installations/')
      );

      // Directory removal should not be attempted (shared resource)
      expect(mockFs.unlink).not.toHaveBeenCalledWith(
        expect.stringMatching(/\.apex\/mcp-installations\/?$/)
      );
    });

    it('4.5 should only cleanup failed installations artifacts, not existing ones', async () => {
      const server = createTestServer();

      // Mock existing installations
      mockStore.getMcpInstallation.mockResolvedValue(null); // No existing installation
      mockStore.listMcpInstallations.mockResolvedValue([
        {
          id: 'existing-1',
          serverId: 'other-server',
          installedAt: new Date(),
          status: 'installed' as const,
          configPath: '/test/.apex/mcp-installations/existing-1.json',
        }
      ]);

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Store operation fails
      mockStore.createMcpInstallation.mockRejectedValueOnce(new Error('Store error'));

      await expect(installer.install(server)).rejects.toThrow();

      // Verify only the failed installation's config was removed
      expect(mockFs.unlink).toHaveBeenCalledTimes(1);
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('.apex/mcp-installations/')
      );

      // Should not affect existing installations
      expect(mockStore.removeMcpInstallation).not.toHaveBeenCalledWith('existing-1');
    });
  });

  describe('Category 5: Rollback State Verification', () => {
    it('5.1 should have no installation record in store after rollback from config failure', async () => {
      const server = createTestServer();

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Config creation fails
      mockFs.writeFile.mockRejectedValueOnce(new Error('Config error'));

      await expect(installer.install(server)).rejects.toThrow();

      // Verify no installation record was created
      expect(mockStore.createMcpInstallation).not.toHaveBeenCalled();

      // Verify the server is not considered installed
      const isInstalled = await installer.isInstalled('test-server');
      expect(isInstalled).toBe(false);
    });

    it('5.2 should have no config file on disk after rollback from store failure', async () => {
      const server = createTestServer();

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Store operation fails
      mockStore.createMcpInstallation.mockRejectedValueOnce(new Error('Store error'));

      await expect(installer.install(server)).rejects.toThrow();

      // Verify config file was removed in rollback
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('.apex/mcp-installations/')
      );
    });

    it('5.3 should preserve previous installation state when force reinstall fails', async () => {
      const server = createTestServer();

      // Mock existing installation
      const existingInstallation = {
        id: 'existing-id',
        serverId: 'test-server',
        installedAt: new Date(),
        status: 'installed' as const,
        configPath: '/test/.apex/mcp-installations/existing-id.json',
      };
      mockStore.getMcpInstallation.mockResolvedValue(existingInstallation);

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Force reinstall, but store operation fails
      mockStore.createMcpInstallation.mockRejectedValueOnce(new Error('Store error'));

      await expect(installer.install(server, { force: true })).rejects.toThrow();

      // The existing installation should still be in the database
      // (rollback doesn't touch pre-existing installations)
      expect(mockStore.removeMcpInstallation).not.toHaveBeenCalledWith('existing-id');

      // But the new installation should not have been created
      const currentInstallation = await installer.getInstallation('test-server');
      expect(currentInstallation).toEqual(existingInstallation);
    });

    it('5.4 should return false for isInstalled after failed install and rollback', async () => {
      const server = createTestServer();

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Store operation fails
      mockStore.createMcpInstallation.mockRejectedValueOnce(new Error('Store error'));

      await expect(installer.install(server)).rejects.toThrow();

      // Verify server is not considered installed
      const isInstalled = await installer.isInstalled('test-server');
      expect(isInstalled).toBe(false);
    });

    it('5.5 should have no zombie entries in store after failed install and rollback', async () => {
      const server = createTestServer();

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Store operation fails
      mockStore.createMcpInstallation.mockRejectedValueOnce(new Error('Store error'));

      await expect(installer.install(server)).rejects.toThrow();

      // Verify no zombie entries exist
      const installations = await installer.listInstalled();
      expect(installations).toEqual([]);

      // Verify the failed installation ID is not in the store
      expect(mockStore.createMcpInstallation).toHaveBeenCalledTimes(1); // Only the failed attempt
    });
  });

  describe('verifyInstallation method', () => {
    it('should return false when installation does not exist', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);

      const result = await installer.verifyInstallation('nonexistent-server');
      expect(result).toBe(false);
    });

    it('should return false when config file does not exist', async () => {
      const mockInstallation = {
        id: 'test-id',
        serverId: 'test-server',
        installedAt: new Date(),
        status: 'installed' as const,
        configPath: '/test/.apex/mcp-installations/test-id.json',
      };
      mockStore.getMcpInstallation.mockResolvedValue(mockInstallation);

      // Mock file access failure
      mockFs.access.mockRejectedValueOnce(new Error('ENOENT: file not found'));

      const result = await installer.verifyInstallation('test-server');
      expect(result).toBe(false);
    });

    it('should return false when config file contains invalid JSON', async () => {
      const mockInstallation = {
        id: 'test-id',
        serverId: 'test-server',
        installedAt: new Date(),
        status: 'installed' as const,
        configPath: '/test/.apex/mcp-installations/test-id.json',
      };
      mockStore.getMcpInstallation.mockResolvedValue(mockInstallation);

      // Mock valid file access but invalid JSON
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{ invalid json content }');

      const result = await installer.verifyInstallation('test-server');
      expect(result).toBe(false);
    });

    it('should return true when installation is valid', async () => {
      const mockInstallation = {
        id: 'test-id',
        serverId: 'test-server',
        installedAt: new Date(),
        status: 'installed' as const,
        configPath: '/test/.apex/mcp-installations/test-id.json',
      };
      mockStore.getMcpInstallation.mockResolvedValue(mockInstallation);

      // Mock valid file access and valid JSON
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{"name": "test-server", "command": "npx"}');

      const result = await installer.verifyInstallation('test-server');
      expect(result).toBe(true);
    });
  });

  describe('executeUninstallCommand method', () => {
    it('should build correct uninstall command for standard package', async () => {
      const server = createTestServer('my-server', {
        package: '@test/my-package'
      });

      // Mock successful install first, then trigger rollback
      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Trigger rollback by making store fail
      mockStore.createMcpInstallation.mockRejectedValueOnce(new Error('Store error'));

      await expect(installer.install(server)).rejects.toThrow();

      // Verify correct uninstall command
      expect(mockExec).toHaveBeenCalledWith(
        'npm uninstall @test/my-package',
        expect.objectContaining({ cwd: projectPath }),
        expect.any(Function)
      );
    });

    it('should include global flag in uninstall command when global option is set', async () => {
      const server = createTestServer();

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Trigger rollback with global option
      mockStore.createMcpInstallation.mockRejectedValueOnce(new Error('Store error'));

      await expect(installer.install(server, { global: true })).rejects.toThrow();

      // Verify global flag in uninstall
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall -g'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle complete rollback when all three steps fail during cleanup', async () => {
      const server = createTestServer();

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          // Uninstall also fails during rollback
          cb(new Error('Uninstall failed - package locked'));
        }
        return {} as any;
      });

      // All rollback steps will fail
      mockStore.createMcpInstallation.mockRejectedValueOnce(new Error('Store error'));
      mockStore.removeMcpInstallation.mockRejectedValueOnce(new Error('Remove failed'));
      mockFs.unlink.mockRejectedValueOnce(new Error('File delete failed'));

      await expect(installer.install(server)).rejects.toThrow(
        /Failed to install MCP server 'test-server': Store error/
      );

      // Original error should be preserved despite rollback failures
      // Only steps that completed are rolled back:
      // - removeMcpInstallation is NOT called because createMcpInstallation threw
      //   before installationId was assigned to rollbackState
      // - unlink IS called (config file was created in step 2)
      // - npm uninstall IS called (package was installed in step 1)
      expect(mockStore.removeMcpInstallation).not.toHaveBeenCalled();
      expect(mockFs.unlink).toHaveBeenCalled();
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle network timeout during package uninstall in rollback gracefully', async () => {
      const server = createTestServer();

      let callCount = 0;
      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        callCount++;
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          // Simulate network timeout during rollback uninstall
          cb(new Error('ETIMEDOUT: network timeout during uninstall'));
        }
        return {} as any;
      });

      // Store operation fails, triggering rollback
      mockStore.createMcpInstallation.mockRejectedValueOnce(new Error('Original install error'));

      await expect(installer.install(server)).rejects.toThrow(
        /Failed to install MCP server 'test-server': Original install error/
      );

      // Verify rollback uninstall was attempted despite network timeout
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      );
      expect(callCount).toBe(2); // install + rollback uninstall
    });
  });
});