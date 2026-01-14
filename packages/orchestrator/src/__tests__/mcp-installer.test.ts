import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import * as path from 'path';
import { MCPInstaller, MCPInstallationOptions } from '../mcp-installer';
import { TaskStore } from '../store';
import {
  MCPServer,
  MCPInstallation,
  MCPInstallationStatus,
  MCPMarketplaceEntry,
} from '@apexcli/core';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    access: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('../store');

describe('MCPInstaller', () => {
  let installer: MCPInstaller;
  let mockStore: vi.Mocked<TaskStore>;
  let mockFs: {
    mkdir: MockedFunction<any>;
    writeFile: MockedFunction<any>;
    unlink: MockedFunction<any>;
    access: MockedFunction<any>;
  };
  let mockExec: MockedFunction<any>;

  const projectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock store
    mockStore = {
      createMcpInstallation: vi.fn(),
      getMcpInstallation: vi.fn(),
      listMcpInstallations: vi.fn(),
      removeMcpInstallation: vi.fn(),
      upsertMcpMarketplaceEntry: vi.fn(),
      listMcpMarketplaceEntries: vi.fn(),
    } as any;

    // Mock filesystem
    mockFs = {
      mkdir: vi.mocked(fs.mkdir),
      writeFile: vi.mocked(fs.writeFile),
      unlink: vi.mocked(fs.unlink),
      access: vi.mocked(fs.access),
    };

    // Mock exec
    mockExec = vi.mocked(exec);

    installer = new MCPInstaller(projectPath, mockStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with project path and store', () => {
      expect(installer).toBeInstanceOf(MCPInstaller);
    });
  });

  describe('install', () => {
    const mockServer: MCPServer = {
      name: 'test-server',
      description: 'Test MCP server',
      command: 'npx',
      args: ['@test/mcp-server'],
      autoStart: false,
    };

    beforeEach(() => {
      // Mock successful exec
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(null, { stdout: 'Success', stderr: '' });
        return {} as any;
      });

      // Mock filesystem operations
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should successfully install an MCP server', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const result = await installer.install(mockServer);

      expect(result).toMatchObject({
        serverId: 'test-server',
        status: 'installed',
      });
      expect(result.id).toMatch(/^mcp-\d+-[a-z0-9]+$/);
      expect(result.installedAt).toBeInstanceOf(Date);
      expect(result.configPath).toMatch(/\.apex\/mcp-installations\/.*\.json$/);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install @test/mcp-server',
        { cwd: projectPath, env: process.env },
        expect.any(Function)
      );
      expect(mockStore.createMcpInstallation).toHaveBeenCalledWith(result);
    });

    it('should create config file with correct structure', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      await installer.install(mockServer);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(projectPath, '.apex', 'mcp-installations'),
        { recursive: true }
      );

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/\.apex\/mcp-installations\/.*\.json$/),
        expect.stringContaining('"name":"test-server"'),
        'utf-8'
      );
    });

    it('should throw error if server is already installed without force option', async () => {
      const existingInstallation: MCPInstallation = {
        id: 'existing-id',
        serverId: 'test-server',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/path/to/config.json',
      };

      mockStore.getMcpInstallation.mockResolvedValue(existingInstallation);

      await expect(installer.install(mockServer)).rejects.toThrow(
        "MCP server 'test-server' is already installed. Use force option to reinstall."
      );

      expect(mockExec).not.toHaveBeenCalled();
      expect(mockStore.createMcpInstallation).not.toHaveBeenCalled();
    });

    it('should reinstall if server exists and force option is used', async () => {
      const existingInstallation: MCPInstallation = {
        id: 'existing-id',
        serverId: 'test-server',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/path/to/config.json',
      };

      mockStore.getMcpInstallation.mockResolvedValue(existingInstallation);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const options: MCPInstallationOptions = { force: true };
      const result = await installer.install(mockServer, options);

      expect(result.serverId).toBe('test-server');
      expect(mockExec).toHaveBeenCalled();
      expect(mockStore.createMcpInstallation).toHaveBeenCalled();
    });

    it('should handle global installation option', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const options: MCPInstallationOptions = { global: true };
      await installer.install(mockServer, options);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install -g @test/mcp-server',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle additional args option', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const options: MCPInstallationOptions = { args: ['--save-dev', '--verbose'] };
      await installer.install(mockServer, options);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install @test/mcp-server --save-dev --verbose',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle custom environment variables', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const options: MCPInstallationOptions = { env: { NODE_ENV: 'test', CUSTOM_VAR: 'value' } };
      await installer.install(mockServer, options);

      expect(mockExec).toHaveBeenCalledWith(
        expect.any(String),
        {
          cwd: projectPath,
          env: { ...process.env, NODE_ENV: 'test', CUSTOM_VAR: 'value' },
        },
        expect.any(Function)
      );
    });

    it('should handle different server command types', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      // Test with scoped package command
      const scopedServer: MCPServer = {
        name: 'scoped-server',
        description: 'Scoped package server',
        command: '@company/mcp-server',
        args: [],
        autoStart: false,
      };

      await installer.install(scopedServer);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install @company/mcp-server',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle server name fallback when extracting package name', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const simpleServer: MCPServer = {
        name: 'simple-server',
        description: 'Simple server',
        command: 'node',
        args: ['server.js'],
        autoStart: false,
      };

      await installer.install(simpleServer);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install simple-server',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should throw error if installation command fails', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);

      // Mock failed exec
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(new Error('Installation failed'), null);
        return {} as any;
      });

      await expect(installer.install(mockServer)).rejects.toThrow(
        "Failed to install MCP server 'test-server': Installation failed"
      );

      expect(mockStore.createMcpInstallation).not.toHaveBeenCalled();
    });

    it('should throw error if config file creation fails', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(installer.install(mockServer)).rejects.toThrow(
        "Failed to install MCP server 'test-server': Write failed"
      );
    });
  });

  describe('uninstall', () => {
    const mockInstallation: MCPInstallation = {
      id: 'test-id',
      serverId: 'test-server',
      installedAt: new Date(),
      status: 'active',
      configPath: '/project/.apex/mcp-installations/test-id.json',
    };

    it('should successfully uninstall an MCP server', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(mockInstallation);
      mockStore.removeMcpInstallation.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      await installer.uninstall('test-server');

      expect(mockStore.getMcpInstallation).toHaveBeenCalledWith('test-server');
      expect(mockFs.unlink).toHaveBeenCalledWith(mockInstallation.configPath);
      expect(mockStore.removeMcpInstallation).toHaveBeenCalledWith('test-id');
    });

    it('should throw error if server is not installed', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);

      await expect(installer.uninstall('non-existent-server')).rejects.toThrow(
        "MCP server 'non-existent-server' is not installed"
      );

      expect(mockFs.unlink).not.toHaveBeenCalled();
      expect(mockStore.removeMcpInstallation).not.toHaveBeenCalled();
    });

    it('should handle missing config file gracefully (ENOENT)', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(mockInstallation);
      mockStore.removeMcpInstallation.mockResolvedValue(undefined);

      const enoentError = new Error('File not found');
      (enoentError as any).code = 'ENOENT';
      mockFs.unlink.mockRejectedValue(enoentError);

      await installer.uninstall('test-server');

      expect(mockStore.removeMcpInstallation).toHaveBeenCalledWith('test-id');
    });

    it('should throw error for other filesystem errors', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(mockInstallation);

      const otherError = new Error('Permission denied');
      (otherError as any).code = 'EACCES';
      mockFs.unlink.mockRejectedValue(otherError);

      await expect(installer.uninstall('test-server')).rejects.toThrow(
        "Failed to uninstall MCP server 'test-server': Permission denied"
      );
    });

    it('should handle store removal failure', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(mockInstallation);
      mockFs.unlink.mockResolvedValue(undefined);
      mockStore.removeMcpInstallation.mockRejectedValue(new Error('Database error'));

      await expect(installer.uninstall('test-server')).rejects.toThrow(
        "Failed to uninstall MCP server 'test-server': Database error"
      );
    });
  });

  describe('listInstalled', () => {
    it('should return list of installed MCP servers', async () => {
      const mockInstallations: MCPInstallation[] = [
        {
          id: 'id1',
          serverId: 'server1',
          installedAt: new Date(),
          status: 'installed',
          configPath: '/path1.json',
        },
        {
          id: 'id2',
          serverId: 'server2',
          installedAt: new Date(),
          status: 'failed',
          configPath: '/path2.json',
        },
      ];

      mockStore.listMcpInstallations.mockResolvedValue(mockInstallations);

      const result = await installer.listInstalled();

      expect(result).toEqual(mockInstallations);
      expect(mockStore.listMcpInstallations).toHaveBeenCalled();
    });

    it('should return empty array when no servers are installed', async () => {
      mockStore.listMcpInstallations.mockResolvedValue([]);

      const result = await installer.listInstalled();

      expect(result).toEqual([]);
      expect(mockStore.listMcpInstallations).toHaveBeenCalled();
    });
  });

  describe('getInstallation', () => {
    it('should return installation for existing server', async () => {
      const mockInstallation: MCPInstallation = {
        id: 'test-id',
        serverId: 'test-server',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/path.json',
      };

      mockStore.getMcpInstallation.mockResolvedValue(mockInstallation);

      const result = await installer.getInstallation('test-server');

      expect(result).toEqual(mockInstallation);
      expect(mockStore.getMcpInstallation).toHaveBeenCalledWith('test-server');
    });

    it('should return null for non-existent server', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);

      const result = await installer.getInstallation('non-existent');

      expect(result).toBeNull();
      expect(mockStore.getMcpInstallation).toHaveBeenCalledWith('non-existent');
    });
  });

  describe('isInstalled', () => {
    it('should return true for installed server', async () => {
      const mockInstallation: MCPInstallation = {
        id: 'test-id',
        serverId: 'test-server',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/path.json',
      };

      mockStore.getMcpInstallation.mockResolvedValue(mockInstallation);

      const result = await installer.isInstalled('test-server');

      expect(result).toBe(true);
    });

    it('should return false for non-installed server', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);

      const result = await installer.isInstalled('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('updateMarketplaceCache', () => {
    it('should update marketplace cache with provided entries', async () => {
      const mockEntries: MCPMarketplaceEntry[] = [
        {
          name: 'server1',
          description: 'Test server 1',
          author: 'Author 1',
          version: '1.0.0',
          repository: 'https://github.com/author/server1',
          package: '@author/server1',
          category: 'productivity',
          tags: ['test', 'server'],
          rating: 4.5,
          downloads: 1000,
          lastUpdated: new Date(),
        },
        {
          name: 'server2',
          description: 'Test server 2',
          author: 'Author 2',
          version: '2.0.0',
          repository: 'https://github.com/author/server2',
          package: '@author/server2',
          category: 'development',
          tags: ['dev', 'tools'],
          rating: 4.8,
          downloads: 2000,
          lastUpdated: new Date(),
        },
      ];

      mockStore.upsertMcpMarketplaceEntry.mockResolvedValue(undefined);

      await installer.updateMarketplaceCache(mockEntries);

      expect(mockStore.upsertMcpMarketplaceEntry).toHaveBeenCalledTimes(2);
      expect(mockStore.upsertMcpMarketplaceEntry).toHaveBeenCalledWith(mockEntries[0]);
      expect(mockStore.upsertMcpMarketplaceEntry).toHaveBeenCalledWith(mockEntries[1]);
    });

    it('should handle empty entries array', async () => {
      await installer.updateMarketplaceCache([]);

      expect(mockStore.upsertMcpMarketplaceEntry).not.toHaveBeenCalled();
    });

    it('should handle individual entry update failures', async () => {
      const mockEntries: MCPMarketplaceEntry[] = [
        {
          name: 'server1',
          description: 'Test server 1',
          author: 'Author 1',
          version: '1.0.0',
          repository: 'https://github.com/author/server1',
          package: '@author/server1',
          category: 'productivity',
          tags: ['test'],
          rating: 4.5,
          downloads: 1000,
          lastUpdated: new Date(),
        },
      ];

      mockStore.upsertMcpMarketplaceEntry.mockRejectedValue(new Error('Database error'));

      await expect(installer.updateMarketplaceCache(mockEntries)).rejects.toThrow('Database error');
    });
  });

  describe('getMarketplaceEntries', () => {
    it('should return marketplace entries from store', async () => {
      const mockEntries: MCPMarketplaceEntry[] = [
        {
          name: 'server1',
          description: 'Test server 1',
          author: 'Author 1',
          version: '1.0.0',
          repository: 'https://github.com/author/server1',
          package: '@author/server1',
          category: 'productivity',
          tags: ['test'],
          rating: 4.5,
          downloads: 1000,
          lastUpdated: new Date(),
        },
      ];

      mockStore.listMcpMarketplaceEntries.mockResolvedValue(mockEntries);

      const result = await installer.getMarketplaceEntries();

      expect(result).toEqual(mockEntries);
      expect(mockStore.listMcpMarketplaceEntries).toHaveBeenCalled();
    });

    it('should return empty array when no entries exist', async () => {
      mockStore.listMcpMarketplaceEntries.mockResolvedValue([]);

      const result = await installer.getMarketplaceEntries();

      expect(result).toEqual([]);
    });
  });

  describe('private helper methods', () => {
    describe('generateInstallationId', () => {
      it('should generate unique installation IDs', async () => {
        mockStore.getMcpInstallation.mockResolvedValue(null);
        mockStore.createMcpInstallation.mockResolvedValue(undefined);
        mockFs.mkdir.mockResolvedValue(undefined);
        mockFs.writeFile.mockResolvedValue(undefined);

        const server: MCPServer = {
          name: 'test-server',
          description: 'Test',
          command: 'npx',
          args: ['test'],
          autoStart: false,
        };

        const result1 = await installer.install(server, { force: true });
        const result2 = await installer.install(server, { force: true });

        expect(result1.id).not.toEqual(result2.id);
        expect(result1.id).toMatch(/^mcp-\d+-[a-z0-9]+$/);
        expect(result2.id).toMatch(/^mcp-\d+-[a-z0-9]+$/);
      });
    });

    describe('buildInstallCommand', () => {
      it('should extract package name from npx command', async () => {
        mockStore.getMcpInstallation.mockResolvedValue(null);
        mockStore.createMcpInstallation.mockResolvedValue(undefined);

        const server: MCPServer = {
          name: 'test-server',
          description: 'Test',
          command: 'npx',
          args: ['@test/package'],
          autoStart: false,
        };

        await installer.install(server);

        expect(mockExec).toHaveBeenCalledWith(
          'npm install @test/package',
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should use server name as fallback package name', async () => {
        mockStore.getMcpInstallation.mockResolvedValue(null);
        mockStore.createMcpInstallation.mockResolvedValue(undefined);

        const server: MCPServer = {
          name: 'my-server',
          description: 'Test',
          command: 'python',
          args: ['script.py'],
          autoStart: false,
        };

        await installer.install(server);

        expect(mockExec).toHaveBeenCalledWith(
          'npm install my-server',
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should use scoped package command directly', async () => {
        mockStore.getMcpInstallation.mockResolvedValue(null);
        mockStore.createMcpInstallation.mockResolvedValue(undefined);

        const server: MCPServer = {
          name: 'scoped-server',
          description: 'Test',
          command: '@company/mcp-tool',
          args: [],
          autoStart: false,
        };

        await installer.install(server);

        expect(mockExec).toHaveBeenCalledWith(
          'npm install @company/mcp-tool',
          expect.any(Object),
          expect.any(Function)
        );
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle installation with no args', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const server: MCPServer = {
        name: 'test-server',
        description: 'Test',
        command: 'test-command',
        args: [],
        autoStart: false,
      };

      await installer.install(server);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install test-server',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle installation with undefined args', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const server: MCPServer = {
        name: 'test-server',
        description: 'Test',
        command: 'test-command',
        autoStart: false,
      };

      await installer.install(server);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install test-server',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle non-Error thrown values in installation', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);

      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback('string error' as any, null);
        return {} as any;
      });

      await expect(installer.install({
        name: 'test-server',
        description: 'Test',
        command: 'test',
        args: [],
        autoStart: false,
      })).rejects.toThrow(
        "Failed to install MCP server 'test-server': string error"
      );
    });

    it('should handle non-Error thrown values in uninstall', async () => {
      const mockInstallation: MCPInstallation = {
        id: 'test-id',
        serverId: 'test-server',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/path.json',
      };

      mockStore.getMcpInstallation.mockResolvedValue(mockInstallation);
      mockStore.removeMcpInstallation.mockRejectedValue('string error');

      await expect(installer.uninstall('test-server')).rejects.toThrow(
        "Failed to uninstall MCP server 'test-server': string error"
      );
    });
  });
});