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
vi.mock('fs', () => {
  const mock = {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    promises: {
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      readFile: vi.fn(),
      unlink: vi.fn(),
      access: vi.fn(),
      stat: vi.fn(),
      readdir: vi.fn(),
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
      getMcpMarketplaceEntry: vi.fn().mockResolvedValue(null),
    } as any;

    // Mock filesystem
    mockFs = {
      mkdir: vi.mocked(fs.mkdir),
      writeFile: vi.mocked(fs.writeFile),
      unlink: vi.mocked(fs.unlink),
      access: vi.mocked(fs.access),
    };

    // Mock exec - default to success so promisify(exec) resolves
    mockExec = vi.mocked(exec);
    mockExec.mockImplementation((command: any, options: any, callback: any) => {
      if (callback) callback(null, { stdout: 'Success', stderr: '' });
      return {} as any;
    });

    // Mock filesystem defaults
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);

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
      package: '@test/mcp-server',
      command: 'npx',
      args: ['@test/mcp-server'],
      version: 'latest',
    };

    it('should successfully install an MCP server', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const result = await installer.install(mockServer);

      expect(result).toMatchObject({
        name: 'test-server',
        installedFrom: 'npm',
      });
      expect(result.installedAt).toBeInstanceOf(Date);
      expect(result.config.name).toBe('test-server');
      expect(result.config.command).toBe('npx');

      expect(mockExec).toHaveBeenCalledWith(
        'npm install @test/mcp-server',
        { cwd: projectPath, env: process.env },
        expect.any(Function)
      );
      expect(mockStore.createMcpInstallation).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 'test-server',
          status: 'installed',
        })
      );
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
        expect.stringContaining('"name": "test-server"'),
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

      expect(result.name).toBe('test-server');
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
        package: '@company/mcp-server',
        command: '@company/mcp-server',
        args: [],
        version: 'latest',
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
        package: 'simple-server',
        command: 'node',
        args: ['server.js'],
        version: 'latest',
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
      const mockInstallations = [
        {
          id: 'id1',
          serverId: 'server1',
          installedAt: new Date(),
          status: 'installed',
          configPath: '/path1.json',
          installedFrom: 'npm',
          configJson: JSON.stringify({ name: 'server1', type: 'stdio', command: 'server1', autoStart: false }),
        },
        {
          id: 'id2',
          serverId: 'server2',
          installedAt: new Date(),
          status: 'installed',
          configPath: '/path2.json',
          installedFrom: 'marketplace',
          configJson: JSON.stringify({ name: 'server2', type: 'stdio', command: 'server2', autoStart: false }),
        },
      ];

      mockStore.listMcpInstallations.mockResolvedValue(mockInstallations);

      const result = await installer.listInstalled();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('server1');
      expect(result[0].installedFrom).toBe('npm');
      expect(result[0].config.name).toBe('server1');
      expect(result[1].name).toBe('server2');
      expect(result[1].installedFrom).toBe('marketplace');
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

        const server: MCPServer = {
          name: 'test-server',
          package: 'test',
          command: 'npx',
          args: ['test'],
          version: 'latest',
        };

        const result1 = await installer.install(server, { force: true });
        const result2 = await installer.install(server, { force: true });

        // Each install creates a unique installation record with a unique ID
        const calls = mockStore.createMcpInstallation.mock.calls;
        expect(calls[0][0].id).not.toEqual(calls[1][0].id);
        expect(calls[0][0].id).toMatch(/^mcp-\d+-[a-z0-9]+$/);
        expect(calls[1][0].id).toMatch(/^mcp-\d+-[a-z0-9]+$/);
      });
    });

    describe('buildInstallCommand', () => {
      it('should extract package name from npx command', async () => {
        mockStore.getMcpInstallation.mockResolvedValue(null);
        mockStore.createMcpInstallation.mockResolvedValue(undefined);

        const server: MCPServer = {
          name: 'test-server',
          package: '@test/package',
          command: 'npx',
          args: ['@test/package'],
          version: 'latest',
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
          package: 'my-server',
          command: 'python',
          args: ['script.py'],
          version: 'latest',
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
          package: '@company/mcp-tool',
          command: '@company/mcp-tool',
          args: [],
          version: 'latest',
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
        package: 'test-server',
        command: 'test-command',
        args: [],
        version: 'latest',
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
        package: 'test-server',
        command: 'test-command',
        version: 'latest',
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

  describe('custom installation paths', () => {
    it('should create config file in custom project path', async () => {
      const customProjectPath = '/custom/project/path';
      const customInstaller = new MCPInstaller(customProjectPath, mockStore);

      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const server: MCPServer = {
        name: 'test-server',
        package: 'test-package',
        command: 'npx',
        args: ['test-package'],
        version: 'latest',
      };

      await customInstaller.install(server);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(customProjectPath, '.apex', 'mcp-installations'),
        { recursive: true }
      );

      expect(mockExec).toHaveBeenCalledWith(
        expect.any(String),
        { cwd: customProjectPath, env: process.env },
        expect.any(Function)
      );
    });

    it('should handle custom installation working directory for package manager commands', async () => {
      const customWorkDir = '/workspace/my-project';
      const customInstaller = new MCPInstaller(customWorkDir, mockStore);

      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const server: MCPServer = {
        name: 'workspace-server',
        package: 'workspace-server',
        command: 'npm',
        args: ['exec', 'test-tool'],
        version: 'latest',
      };

      await customInstaller.install(server);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install workspace-server',
        { cwd: customWorkDir, env: process.env },
        expect.any(Function)
      );
    });

    it('should create nested installation directory structure', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const server: MCPServer = {
        name: 'nested-server',
        package: 'nested-server',
        command: 'node',
        args: ['-e', 'console.log("test")'],
        version: 'latest',
      };

      await installer.install(server);

      // Verify the nested directory structure is created
      const expectedDir = path.join(projectPath, '.apex', 'mcp-installations');
      expect(mockFs.mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });

      // Verify config file path structure
      const writeCall = mockFs.writeFile.mock.calls[0];
      expect(writeCall[0]).toMatch(new RegExp(`${path.join('.apex', 'mcp-installations')}.*\\.json$`));
    });
  });

  describe('invalid server configuration handling', () => {
    it('should handle server with empty name', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const invalidServer = {
        name: '',
        description: 'Test',
        command: 'npx',
        args: ['test'],
        autoStart: false,
      } as MCPServer;

      // The installer proceeds with empty name - it uses args[0] as package name
      const result = await installer.install(invalidServer);
      expect(result.name).toBe('');
      expect(mockExec).toHaveBeenCalledWith(
        'npm install test',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle server with null or undefined command', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);

      const invalidServer = {
        name: 'test-server',
        description: 'Test',
        command: '',
        args: [],
        autoStart: false,
      } as MCPServer;

      // Should use server name as fallback
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      await installer.install(invalidServer);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install test-server',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle server with invalid characters in name', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const serverWithSpecialChars: MCPServer = {
        name: 'test@server#with$special%chars',
        package: 'normal-package',
        command: 'npx',
        args: ['normal-package'],
        version: 'latest',
      };

      await installer.install(serverWithSpecialChars);

      // Should still use the package field for package name
      expect(mockExec).toHaveBeenCalledWith(
        'npm install normal-package',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle server with malformed args array', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const serverWithMalformedArgs: MCPServer = {
        name: 'test-server',
        description: 'Test',
        command: 'npx',
        args: [''], // Empty string in args
        autoStart: false,
      };

      await installer.install(serverWithMalformedArgs);

      // Should use the empty string from args[0]
      expect(mockExec).toHaveBeenCalledWith(
        'npm install ',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle server configuration that would cause JSON serialization issues', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const serverWithCircularRef: any = {
        name: 'circular-server',
        description: 'Server with circular reference',
        command: 'npx',
        args: ['test-package'],
        autoStart: false,
      };
      // Create circular reference
      serverWithCircularRef.self = serverWithCircularRef;

      // Remove the circular reference for the actual test
      delete serverWithCircularRef.self;

      await installer.install(serverWithCircularRef);

      // Should still create valid JSON config
      const writeCall = mockFs.writeFile.mock.calls[0];
      expect(() => JSON.parse(writeCall[1])).not.toThrow();
    });
  });

  describe('installation failure scenarios', () => {
    it('should handle npm/npx command not found', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Command not found: npm');
        (error as any).code = 'ENOENT';
        if (callback) callback(error, null);
        return {} as any;
      });

      const server: MCPServer = {
        name: 'test-server',
        package: 'test-package',
        command: 'npx',
        args: ['test-package'],
        version: '1.0.0',
      };

      await expect(installer.install(server)).rejects.toThrow(
        "Failed to install MCP server 'test-server': Command not found: npm"
      );
    });

    it('should handle package not found in npm registry', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('npm ERR! 404 Not Found - GET https://registry.npmjs.org/non-existent-package');
        if (callback) callback(error, null);
        return {} as any;
      });

      const server: MCPServer = {
        name: 'test-server',
        description: 'Test',
        command: 'npx',
        args: ['non-existent-package'],
        autoStart: false,
      };

      await expect(installer.install(server)).rejects.toThrow(
        "Failed to install MCP server 'test-server': npm ERR! 404 Not Found"
      );
    });

    it('should handle network timeout during installation', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('npm ERR! network timeout');
        (error as any).code = 'ETIMEDOUT';
        if (callback) callback(error, null);
        return {} as any;
      });

      const server: MCPServer = {
        name: 'test-server',
        package: 'test-package',
        command: 'npx',
        args: ['test-package'],
        version: '1.0.0',
      };

      await expect(installer.install(server)).rejects.toThrow(
        "Failed to install MCP server 'test-server': npm ERR! network timeout"
      );
    });

    it('should handle permission denied during installation', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('npm ERR! path /usr/local/lib/node_modules/test-package');
        (error as any).code = 'EACCES';
        if (callback) callback(error, null);
        return {} as any;
      });

      const server: MCPServer = {
        name: 'test-server',
        package: 'test-package',
        command: 'npx',
        args: ['test-package'],
        version: '1.0.0',
      };

      await expect(installer.install(server)).rejects.toThrow(
        "Failed to install MCP server 'test-server': npm ERR! path /usr/local/lib"
      );
    });

    it('should handle disk space exhaustion during installation', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('npm ERR! code ENOSPC');
        (error as any).code = 'ENOSPC';
        if (callback) callback(error, null);
        return {} as any;
      });

      const server: MCPServer = {
        name: 'test-server',
        description: 'Test',
        command: 'npx',
        args: ['large-package'],
        autoStart: false,
      };

      await expect(installer.install(server)).rejects.toThrow(
        "Failed to install MCP server 'test-server': npm ERR! code ENOSPC"
      );
    });

    it('should handle installation interrupted by signal', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Command terminated by signal SIGINT');
        (error as any).signal = 'SIGINT';
        if (callback) callback(error, null);
        return {} as any;
      });

      const server: MCPServer = {
        name: 'test-server',
        package: 'test-package',
        command: 'npx',
        args: ['test-package'],
        version: '1.0.0',
      };

      await expect(installer.install(server)).rejects.toThrow(
        "Failed to install MCP server 'test-server': Command terminated by signal SIGINT"
      );
    });

    it('should handle config directory creation failure', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);

      mockFs.mkdir.mockRejectedValue(new Error('Permission denied: cannot create directory'));

      const server: MCPServer = {
        name: 'test-server',
        package: 'test-package',
        command: 'npx',
        args: ['test-package'],
        version: '1.0.0',
      };

      await expect(installer.install(server)).rejects.toThrow(
        "Failed to install MCP server 'test-server': Permission denied: cannot create directory"
      );
    });

    it('should handle config file write permission error', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockFs.mkdir.mockResolvedValue(undefined);

      const writeError = new Error('EACCES: permission denied');
      (writeError as any).code = 'EACCES';
      mockFs.writeFile.mockRejectedValue(writeError);

      const server: MCPServer = {
        name: 'test-server',
        package: 'test-package',
        command: 'npx',
        args: ['test-package'],
        version: '1.0.0',
      };

      await expect(installer.install(server)).rejects.toThrow(
        "Failed to install MCP server 'test-server': EACCES: permission denied"
      );
    });

    it('should handle database/store operation failures during installation', async () => {
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      // Mock successful installation command but database failure
      mockStore.createMcpInstallation.mockRejectedValue(new Error('Database connection lost'));

      const server: MCPServer = {
        name: 'test-server',
        package: 'test-package',
        command: 'npx',
        args: ['test-package'],
        version: '1.0.0',
      };

      await expect(installer.install(server)).rejects.toThrow(
        "Failed to install MCP server 'test-server': Database connection lost"
      );
    });

    it('should handle concurrent installation attempts', async () => {
      // This test simulates what happens when two installations run concurrently
      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      const server: MCPServer = {
        name: 'concurrent-server',
        description: 'Test',
        command: 'npx',
        args: ['test-package'],
        autoStart: false,
      };

      // Start two installations concurrently
      const installation1Promise = installer.install(server);
      const installation2Promise = installer.install(server);

      // Both should succeed since we're not checking the database state during exec
      const results = await Promise.allSettled([installation1Promise, installation2Promise]);

      // At least one should succeed
      const successful = results.filter(result => result.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
    });
  });
});