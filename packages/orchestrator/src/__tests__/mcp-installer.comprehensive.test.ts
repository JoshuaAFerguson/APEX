/**
 * Comprehensive unit tests for MCPInstaller
 * Tests installation, uninstallation, version management, and marketplace integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPInstaller, type MCPInstallationOptions, type InstalledMCPResult } from '../mcp-installer.js';
import { TaskStore } from '../store.js';
import type {
  MCPServer,
  MCPServerConfig,
  MCPMarketplaceEntry,
  MCPInstallation,
  MCPInstallationStatus,
} from '@apexcli/core';
import * as childProcess from 'child_process';
import * as fs from 'fs/promises';

// Mock dependencies
vi.mock('child_process');
vi.mock('fs/promises');
vi.mock('../store.js');

const mockExec = vi.mocked(childProcess.exec);
const mockFs = vi.mocked(fs);
const MockTaskStore = vi.mocked(TaskStore);

describe('MCPInstaller', () => {
  let installer: MCPInstaller;
  let mockStore: TaskStore;
  const projectPath = '/test/project';

  const sampleMarketplaceEntry: MCPMarketplaceEntry = {
    name: 'filesystem',
    title: 'Filesystem Server',
    description: 'Secure filesystem access',
    version: '1.0.0',
    category: 'filesystem',
    verified: true,
    featured: true,
    capabilities: ['file:read', 'file:write'],
    serverConfig: {
      name: 'filesystem',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      autoStart: true,
    } as MCPServerConfig,
    envVars: [],
    tags: ['filesystem'],
    author: 'Anthropic',
    license: 'MIT',
    repository: 'https://github.com/modelcontextprotocol/servers',
    documentationUrl: 'https://docs.modelcontextprotocol.io/servers/filesystem',
    installCount: 1000,
    rating: 4.8,
    reviewCount: 125,
    lastUpdated: '2024-01-01T00:00:00.000Z',
    createdAt: '2023-12-01T00:00:00.000Z',
  };

  const sampleMCPServer: MCPServer = {
    name: 'filesystem',
    package: '@modelcontextprotocol/server-filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    env: {},
    envVars: [],
    version: '1.0.0',
  };

  const sampleInstallation: MCPInstallation = {
    id: 'test-installation-id',
    serverId: 'filesystem',
    installedAt: new Date('2024-01-01T00:00:00.000Z'),
    status: 'installed' as MCPInstallationStatus,
    configPath: '/test/project/.apex/mcp-installations/test-installation-id.json',
  };

  beforeEach(() => {
    // Create mock store
    mockStore = new MockTaskStore('test.db') as any;

    // Setup store methods
    mockStore.getMcpMarketplaceEntry = vi.fn();
    mockStore.createMcpInstallation = vi.fn();
    mockStore.getMcpInstallation = vi.fn();
    mockStore.removeMcpInstallation = vi.fn();
    mockStore.listMcpInstallations = vi.fn();
    mockStore.upsertMcpMarketplaceEntry = vi.fn();
    mockStore.listMcpMarketplaceEntries = vi.fn();

    installer = new MCPInstaller(projectPath, mockStore);

    // Mock fs operations
    mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
    mockFs.writeFile = vi.fn().mockResolvedValue(undefined);
    mockFs.readFile = vi.fn().mockResolvedValue('{}');
    mockFs.access = vi.fn().mockResolvedValue(undefined);
    mockFs.unlink = vi.fn().mockResolvedValue(undefined);

    // Mock exec
    mockExec.mockImplementation((cmd, opts, callback) => {
      if (typeof callback === 'function') {
        callback(null, { stdout: 'success', stderr: '' });
      }
      return {} as any;
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Installation from Marketplace', () => {
    beforeEach(() => {
      mockStore.getMcpMarketplaceEntry = vi.fn().mockResolvedValue(sampleMarketplaceEntry);
      mockStore.getMcpInstallation = vi.fn().mockResolvedValue(null); // Not already installed
      mockStore.createMcpInstallation = vi.fn().mockResolvedValue(undefined);
    });

    it('should install server from marketplace entry', async () => {
      const result = await installer.install('filesystem');

      expect(mockStore.getMcpMarketplaceEntry).toHaveBeenCalledWith('filesystem');
      expect(mockExec).toHaveBeenCalledWith(
        'npm install @modelcontextprotocol/server-filesystem',
        { cwd: projectPath, env: process.env },
        expect.any(Function)
      );
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(mockStore.createMcpInstallation).toHaveBeenCalled();

      expect(result.name).toBe('filesystem');
      expect(result.installedFrom).toBe('marketplace');
      expect(result.config.name).toBe('filesystem');
      expect(result.config.command).toBe('npx');
    });

    it('should install server with custom options', async () => {
      const options: MCPInstallationOptions = {
        global: true,
        version: '1.2.0',
        args: ['--verbose'],
        env: { DEBUG: '1' },
      };

      await installer.install('filesystem', options);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install -g @modelcontextprotocol/server-filesystem@1.2.0 --verbose',
        {
          cwd: projectPath,
          env: { ...process.env, DEBUG: '1' },
        },
        expect.any(Function)
      );
    });

    it('should handle force reinstallation', async () => {
      mockStore.getMcpInstallation = vi.fn().mockResolvedValue(sampleInstallation);

      const result = await installer.install('filesystem', { force: true });

      expect(result.name).toBe('filesystem');
    });

    it('should reject installation if already installed without force', async () => {
      mockStore.getMcpInstallation = vi.fn().mockResolvedValue(sampleInstallation);

      await expect(installer.install('filesystem')).rejects.toThrow(
        "MCP server 'filesystem' is already installed. Use force option to reinstall."
      );
    });

    it('should install from npx if not in marketplace', async () => {
      mockStore.getMcpMarketplaceEntry = vi.fn().mockResolvedValue(null);

      const result = await installer.install('unknown-server');

      expect(result.name).toBe('unknown-server');
      expect(result.installedFrom).toBe('npx');
      expect(result.config.command).toBe('npx');
      expect(result.config.args).toEqual(['unknown-server']);
    });

    it('should install from MCPServer object', async () => {
      const result = await installer.install(sampleMCPServer);

      expect(result.name).toBe('filesystem');
      expect(result.installedFrom).toBe('npm');
    });
  });

  describe('Installation from NPM', () => {
    beforeEach(() => {
      mockStore.getMcpInstallation = vi.fn().mockResolvedValue(null);
      mockStore.createMcpInstallation = vi.fn().mockResolvedValue(undefined);
    });

    it('should install from npm package name', async () => {
      const result = await installer.installFromNpm('@modelcontextprotocol/server-filesystem');

      expect(mockExec).toHaveBeenCalledWith(
        'npm install @modelcontextprotocol/server-filesystem',
        { cwd: projectPath, env: process.env },
        expect.any(Function)
      );
      expect(result.name).toBe('server-filesystem');
      expect(result.installedFrom).toBe('npx');
    });

    it('should extract server name from scoped package', async () => {
      const result = await installer.installFromNpm('@scope/server-test');
      expect(result.name).toBe('test');
    });

    it('should extract server name removing mcp-server prefix', async () => {
      const result = await installer.installFromNpm('mcp-server-database');
      expect(result.name).toBe('database');
    });

    it('should handle global installation', async () => {
      await installer.installFromNpm('test-package', { global: true });

      expect(mockExec).toHaveBeenCalledWith(
        'npm install -g test-package',
        { cwd: projectPath, env: process.env },
        expect.any(Function)
      );
    });

    it('should handle version specification', async () => {
      await installer.installFromNpm('test-package', { version: '1.2.3' });

      expect(mockExec).toHaveBeenCalledWith(
        'npm install test-package@1.2.3',
        { cwd: projectPath, env: process.env },
        expect.any(Function)
      );
    });
  });

  describe('Uninstallation', () => {
    beforeEach(() => {
      mockStore.getMcpInstallation = vi.fn().mockResolvedValue(sampleInstallation);
      mockStore.removeMcpInstallation = vi.fn().mockResolvedValue(undefined);
    });

    it('should uninstall server successfully', async () => {
      await installer.uninstall('filesystem');

      expect(mockStore.getMcpInstallation).toHaveBeenCalledWith('filesystem');
      expect(mockFs.unlink).toHaveBeenCalledWith(sampleInstallation.configPath);
      expect(mockStore.removeMcpInstallation).toHaveBeenCalledWith(sampleInstallation.id);
    });

    it('should handle uninstall of non-existent server', async () => {
      mockStore.getMcpInstallation = vi.fn().mockResolvedValue(null);

      await expect(installer.uninstall('nonexistent')).rejects.toThrow(
        "MCP server 'nonexistent' is not installed"
      );
    });

    it('should handle file deletion errors gracefully', async () => {
      mockFs.unlink = vi.fn().mockRejectedValue(new Error('Permission denied'));

      await expect(installer.uninstall('filesystem')).rejects.toThrow(
        "Failed to uninstall MCP server 'filesystem': Permission denied"
      );
    });

    it('should ignore ENOENT errors when removing config file', async () => {
      mockFs.unlink = vi.fn().mockRejectedValue({ code: 'ENOENT' });

      await installer.uninstall('filesystem');

      // Should complete successfully despite file not existing
      expect(mockStore.removeMcpInstallation).toHaveBeenCalledWith(sampleInstallation.id);
    });
  });

  describe('Installation Listing', () => {
    const mockInstallations: Array<MCPInstallation & { installedFrom?: string; configJson?: string }> = [
      {
        ...sampleInstallation,
        installedFrom: 'marketplace',
        configJson: JSON.stringify({
          name: 'filesystem',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          autoStart: true,
        }),
      },
      {
        id: 'test-installation-2',
        serverId: 'github',
        installedAt: new Date('2024-01-02T00:00:00.000Z'),
        status: 'installed' as MCPInstallationStatus,
        configPath: '/test/project/.apex/mcp-installations/test-installation-2.json',
        installedFrom: 'npm',
      },
    ];

    beforeEach(() => {
      mockStore.listMcpInstallations = vi.fn().mockResolvedValue(mockInstallations);
    });

    it('should list all installed servers', async () => {
      const installations = await installer.listInstalled();

      expect(installations).toHaveLength(2);
      expect(installations[0].name).toBe('filesystem');
      expect(installations[0].installedFrom).toBe('marketplace');
      expect(installations[1].name).toBe('github');
      expect(installations[1].installedFrom).toBe('npm');
    });

    it('should handle installations without configJson', async () => {
      const installations = await installer.listInstalled();

      expect(installations[1].config.name).toBe('github');
      expect(installations[1].config.command).toBe('github'); // Fallback
    });
  });

  describe('Server Details', () => {
    beforeEach(() => {
      const installationWithConfig = {
        ...sampleInstallation,
        configJson: JSON.stringify({
          name: 'filesystem',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          autoStart: true,
        }),
        installedFrom: 'marketplace',
      };
      mockStore.getMcpInstallation = vi.fn().mockResolvedValue(installationWithConfig);
    });

    it('should get installed server details', async () => {
      const result = await installer.getInstalledServer('filesystem');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('filesystem');
      expect(result?.config.command).toBe('npx');
      expect(result?.installedFrom).toBe('marketplace');
    });

    it('should return null for non-existent server', async () => {
      mockStore.getMcpInstallation = vi.fn().mockResolvedValue(null);

      const result = await installer.getInstalledServer('nonexistent');

      expect(result).toBeNull();
    });

    it('should fallback to file reading if no configJson', async () => {
      const installationWithoutJson = {
        ...sampleInstallation,
        configJson: undefined,
        installedFrom: 'npm',
      };
      mockStore.getMcpInstallation = vi.fn().mockResolvedValue(installationWithoutJson);
      mockFs.readFile = vi.fn().mockResolvedValue(JSON.stringify({
        name: 'filesystem',
        type: 'stdio',
        command: 'test-command',
      }));

      const result = await installer.getInstalledServer('filesystem');

      expect(result?.config.command).toBe('test-command');
    });

    it('should handle file read failure gracefully', async () => {
      const installationWithoutJson = {
        ...sampleInstallation,
        configJson: undefined,
      };
      mockStore.getMcpInstallation = vi.fn().mockResolvedValue(installationWithoutJson);
      mockFs.readFile = vi.fn().mockRejectedValue(new Error('File not found'));

      const result = await installer.getInstalledServer('filesystem');

      expect(result?.config.name).toBe('filesystem');
      expect(result?.config.command).toBe('filesystem'); // Fallback
    });
  });

  describe('Installation Verification', () => {
    beforeEach(() => {
      mockStore.getMcpInstallation = vi.fn().mockResolvedValue(sampleInstallation);
    });

    it('should verify valid installation', async () => {
      mockFs.access = vi.fn().mockResolvedValue(undefined);
      mockFs.readFile = vi.fn().mockResolvedValue('{"valid": "json"}');

      const isValid = await installer.verifyInstallation('filesystem');

      expect(isValid).toBe(true);
      expect(mockFs.access).toHaveBeenCalledWith(sampleInstallation.configPath);
      expect(mockFs.readFile).toHaveBeenCalledWith(sampleInstallation.configPath, 'utf-8');
    });

    it('should detect missing installation', async () => {
      mockStore.getMcpInstallation = vi.fn().mockResolvedValue(null);

      const isValid = await installer.verifyInstallation('nonexistent');

      expect(isValid).toBe(false);
    });

    it('should detect missing config file', async () => {
      mockFs.access = vi.fn().mockRejectedValue(new Error('File not found'));

      const isValid = await installer.verifyInstallation('filesystem');

      expect(isValid).toBe(false);
    });

    it('should detect invalid JSON config', async () => {
      mockFs.access = vi.fn().mockResolvedValue(undefined);
      mockFs.readFile = vi.fn().mockResolvedValue('invalid json');

      const isValid = await installer.verifyInstallation('filesystem');

      expect(isValid).toBe(false);
    });

    it('should check if server is installed', async () => {
      expect(await installer.isInstalled('filesystem')).toBe(true);

      mockStore.getMcpInstallation = vi.fn().mockResolvedValue(null);
      expect(await installer.isInstalled('nonexistent')).toBe(false);
    });
  });

  describe('Version Management', () => {
    describe('parseVersion', () => {
      it('should parse standard semantic versions', () => {
        expect(installer.parseVersion('1.2.3')).toEqual({
          major: 1,
          minor: 2,
          patch: 3,
        });

        expect(installer.parseVersion('v2.0.0')).toEqual({
          major: 2,
          minor: 0,
          patch: 0,
        });
      });

      it('should parse versions with prerelease', () => {
        expect(installer.parseVersion('1.0.0-alpha.1')).toEqual({
          major: 1,
          minor: 0,
          patch: 0,
          prerelease: 'alpha.1',
        });

        expect(installer.parseVersion('2.1.0-beta')).toEqual({
          major: 2,
          minor: 1,
          patch: 0,
          prerelease: 'beta',
        });
      });

      it('should parse partial versions', () => {
        expect(installer.parseVersion('1.2')).toEqual({
          major: 1,
          minor: 2,
          patch: 0,
        });

        expect(installer.parseVersion('3')).toEqual({
          major: 3,
          minor: 0,
          patch: 0,
        });
      });

      it('should handle version ranges', () => {
        expect(installer.parseVersion('^1.2.3')).toEqual({
          major: 1,
          minor: 2,
          patch: 3,
        });

        expect(installer.parseVersion('~2.1.0')).toEqual({
          major: 2,
          minor: 1,
          patch: 0,
        });

        expect(installer.parseVersion('>=1.0.0')).toEqual({
          major: 1,
          minor: 0,
          patch: 0,
        });
      });

      it('should handle special versions', () => {
        expect(installer.parseVersion('latest')).toEqual({
          major: Infinity,
          minor: Infinity,
          patch: Infinity,
        });

        expect(installer.parseVersion('*')).toEqual({
          major: Infinity,
          minor: Infinity,
          patch: Infinity,
        });
      });

      it('should ignore build metadata', () => {
        expect(installer.parseVersion('1.2.3+build.123')).toEqual({
          major: 1,
          minor: 2,
          patch: 3,
        });
      });

      it('should throw for invalid versions', () => {
        expect(() => installer.parseVersion('invalid')).toThrow('Invalid version format');
        expect(() => installer.parseVersion('1.2.3-')).toThrow('Invalid version format');
        expect(() => installer.parseVersion('1.2.3-alpha.')).toThrow('Invalid version format');
      });
    });

    describe('compareVersions', () => {
      it('should compare major versions', () => {
        expect(installer.compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
        expect(installer.compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
        expect(installer.compareVersions('1.0.0', '1.0.0')).toBe(0);
      });

      it('should compare minor versions', () => {
        expect(installer.compareVersions('1.2.0', '1.1.0')).toBeGreaterThan(0);
        expect(installer.compareVersions('1.1.0', '1.2.0')).toBeLessThan(0);
      });

      it('should compare patch versions', () => {
        expect(installer.compareVersions('1.0.2', '1.0.1')).toBeGreaterThan(0);
        expect(installer.compareVersions('1.0.1', '1.0.2')).toBeLessThan(0);
      });

      it('should compare prerelease versions', () => {
        expect(installer.compareVersions('1.0.0-alpha', '1.0.0')).toBeLessThan(0);
        expect(installer.compareVersions('1.0.0', '1.0.0-alpha')).toBeGreaterThan(0);
        expect(installer.compareVersions('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
      });
    });

    describe('satisfiesRange', () => {
      it('should handle exact matches', () => {
        expect(installer.satisfiesRange('1.2.3', '1.2.3')).toBe(true);
        expect(installer.satisfiesRange('1.2.3', '1.2.4')).toBe(false);
      });

      it('should handle caret ranges', () => {
        expect(installer.satisfiesRange('1.2.5', '^1.2.3')).toBe(true);
        expect(installer.satisfiesRange('1.3.0', '^1.2.3')).toBe(true);
        expect(installer.satisfiesRange('2.0.0', '^1.2.3')).toBe(false);
        expect(installer.satisfiesRange('1.2.2', '^1.2.3')).toBe(false);
      });

      it('should handle tilde ranges', () => {
        expect(installer.satisfiesRange('1.2.5', '~1.2.3')).toBe(true);
        expect(installer.satisfiesRange('1.3.0', '~1.2.3')).toBe(false);
        expect(installer.satisfiesRange('1.2.2', '~1.2.3')).toBe(false);
      });

      it('should handle comparison operators', () => {
        expect(installer.satisfiesRange('1.2.4', '>1.2.3')).toBe(true);
        expect(installer.satisfiesRange('1.2.3', '>1.2.3')).toBe(false);
        expect(installer.satisfiesRange('1.2.3', '>=1.2.3')).toBe(true);
        expect(installer.satisfiesRange('1.2.2', '<1.2.3')).toBe(true);
        expect(installer.satisfiesRange('1.2.3', '<1.2.3')).toBe(false);
        expect(installer.satisfiesRange('1.2.3', '<=1.2.3')).toBe(true);
      });

      it('should handle latest and wildcard', () => {
        expect(installer.satisfiesRange('1.2.3', 'latest')).toBe(true);
        expect(installer.satisfiesRange('999.999.999', '*')).toBe(true);
      });
    });

    describe('resolveLatestVersion', () => {
      beforeEach(() => {
        mockExec.mockImplementation((cmd, opts, callback) => {
          if (cmd.includes('npm view') && cmd.includes('version')) {
            if (typeof callback === 'function') {
              callback(null, { stdout: '"1.2.3"', stderr: '' });
            }
          }
          return {} as any;
        });
      });

      it('should resolve latest version from npm', async () => {
        const version = await installer.resolveLatestVersion('test-package');
        expect(version).toBe('1.2.3');
        expect(mockExec).toHaveBeenCalledWith(
          'npm view test-package version --json',
          { cwd: projectPath },
          expect.any(Function)
        );
      });

      it('should handle array response from npm', async () => {
        mockExec.mockImplementation((cmd, opts, callback) => {
          if (typeof callback === 'function') {
            callback(null, { stdout: '["1.0.0", "1.1.0", "1.2.3"]', stderr: '' });
          }
          return {} as any;
        });

        const version = await installer.resolveLatestVersion('test-package');
        expect(version).toBe('1.2.3');
      });

      it('should handle npm errors', async () => {
        mockExec.mockImplementation((cmd, opts, callback) => {
          if (typeof callback === 'function') {
            callback(new Error('Package not found'), { stdout: '', stderr: '' });
          }
          return {} as any;
        });

        await expect(installer.resolveLatestVersion('nonexistent-package')).rejects.toThrow(
          'Failed to resolve latest version for nonexistent-package: Package not found'
        );
      });
    });

    describe('getAvailableVersions', () => {
      beforeEach(() => {
        mockExec.mockImplementation((cmd, opts, callback) => {
          if (cmd.includes('npm view') && cmd.includes('versions')) {
            if (typeof callback === 'function') {
              callback(null, { stdout: '["1.0.0", "1.1.0", "1.2.3"]', stderr: '' });
            }
          }
          return {} as any;
        });
      });

      it('should get available versions from npm', async () => {
        const versions = await installer.getAvailableVersions('test-package');
        expect(versions).toEqual(['1.0.0', '1.1.0', '1.2.3']);
      });

      it('should handle single version response', async () => {
        mockExec.mockImplementation((cmd, opts, callback) => {
          if (typeof callback === 'function') {
            callback(null, { stdout: '"1.0.0"', stderr: '' });
          }
          return {} as any;
        });

        const versions = await installer.getAvailableVersions('test-package');
        expect(versions).toEqual(['1.0.0']);
      });

      it('should handle npm errors', async () => {
        mockExec.mockImplementation((cmd, opts, callback) => {
          if (typeof callback === 'function') {
            callback(new Error('Package not found'), { stdout: '', stderr: '' });
          }
          return {} as any;
        });

        await expect(installer.getAvailableVersions('nonexistent-package')).rejects.toThrow(
          'Failed to get available versions for nonexistent-package: Package not found'
        );
      });
    });
  });

  describe('Marketplace Cache Management', () => {
    it('should update marketplace cache', async () => {
      const entries = [sampleMarketplaceEntry];

      await installer.updateMarketplaceCache(entries);

      expect(mockStore.upsertMcpMarketplaceEntry).toHaveBeenCalledWith(sampleMarketplaceEntry);
    });

    it('should get marketplace entries', async () => {
      mockStore.listMcpMarketplaceEntries = vi.fn().mockResolvedValue([sampleMarketplaceEntry]);

      const entries = await installer.getMarketplaceEntries();

      expect(entries).toEqual([sampleMarketplaceEntry]);
      expect(mockStore.listMcpMarketplaceEntries).toHaveBeenCalled();
    });
  });

  describe('Rollback Functionality', () => {
    beforeEach(() => {
      mockStore.getMcpMarketplaceEntry = vi.fn().mockResolvedValue(sampleMarketplaceEntry);
      mockStore.getMcpInstallation = vi.fn().mockResolvedValue(null);
    });

    it('should rollback on npm install failure', async () => {
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (cmd.includes('npm install')) {
          if (typeof callback === 'function') {
            callback(new Error('Network error'), { stdout: '', stderr: 'Network error' });
          }
        } else if (cmd.includes('npm uninstall')) {
          if (typeof callback === 'function') {
            callback(null, { stdout: 'uninstalled', stderr: '' });
          }
        }
        return {} as any;
      });

      await expect(installer.install('filesystem')).rejects.toThrow('Network error');

      // Should not create config file or database record
      expect(mockFs.writeFile).not.toHaveBeenCalled();
      expect(mockStore.createMcpInstallation).not.toHaveBeenCalled();
    });

    it('should rollback on config file creation failure', async () => {
      mockFs.writeFile = vi.fn().mockRejectedValue(new Error('Permission denied'));

      await expect(installer.install('filesystem')).rejects.toThrow('Permission denied');

      // Should attempt to uninstall npm package
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should rollback on database record creation failure', async () => {
      mockStore.createMcpInstallation = vi.fn().mockRejectedValue(new Error('Database error'));

      await expect(installer.install('filesystem')).rejects.toThrow('Database error');

      // Should attempt to remove config file and uninstall package
      expect(mockFs.unlink).toHaveBeenCalled();
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle rollback errors gracefully', async () => {
      // Make npm install fail, and also make rollback fail
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Operation failed'), { stdout: '', stderr: 'Operation failed' });
        }
        return {} as any;
      });

      await expect(installer.install('filesystem')).rejects.toThrow('Operation failed');

      // Should complete the rollback even if some steps fail
    });
  });

  describe('Package Name Extraction', () => {
    it('should extract package name from server with package field', async () => {
      const server: MCPServer = {
        ...sampleMCPServer,
        package: '@custom/package-name',
      };

      await installer.install(server);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install @custom/package-name',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should extract package name from npx command', async () => {
      const server: MCPServer = {
        ...sampleMCPServer,
        command: 'npx',
        args: ['@scope/custom-server', '--arg'],
        package: undefined,
      };

      await installer.install(server);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install @scope/custom-server',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should use command if it looks like scoped package', async () => {
      const server: MCPServer = {
        ...sampleMCPServer,
        command: '@scope/server-name',
        package: undefined,
      };

      await installer.install(server);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install @scope/server-name',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should fallback to server name', async () => {
      const server: MCPServer = {
        ...sampleMCPServer,
        command: 'custom-command',
        args: [],
        package: undefined,
      };

      await installer.install(server);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install filesystem',
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle exec callback errors', async () => {
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Command failed'), { stdout: '', stderr: 'Command failed' });
        }
        return {} as any;
      });

      mockStore.getMcpMarketplaceEntry = vi.fn().mockResolvedValue(sampleMarketplaceEntry);
      mockStore.getMcpInstallation = vi.fn().mockResolvedValue(null);

      await expect(installer.install('filesystem')).rejects.toThrow(
        "Failed to install MCP server 'filesystem': Command failed"
      );
    });

    it('should handle store errors', async () => {
      mockStore.getMcpMarketplaceEntry = vi.fn().mockRejectedValue(new Error('Database connection failed'));

      await expect(installer.install('filesystem')).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle filesystem errors', async () => {
      mockStore.getMcpMarketplaceEntry = vi.fn().mockResolvedValue(sampleMarketplaceEntry);
      mockStore.getMcpInstallation = vi.fn().mockResolvedValue(null);
      mockFs.mkdir = vi.fn().mockRejectedValue(new Error('No space left on device'));

      await expect(installer.install('filesystem')).rejects.toThrow(
        'No space left on device'
      );
    });
  });
});