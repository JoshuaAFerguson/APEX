import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { ApexConfig } from '@apexcli/core';
import { MCPServerManager } from './server-manager';

// Mock external dependencies
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    saveConfig: vi.fn().mockResolvedValue(undefined),
  };
});

const baseConfig: ApexConfig = {
  version: '1.0',
  project: {
    name: 'mcp-test',
  },
};

describe('MCPServerManager', () => {
  let tempDir: string;
  let manager: MCPServerManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mcp-test-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Server Configuration Management', () => {
    it('filters invalid MCP server configs', () => {
      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            valid: {
              name: 'valid',
              type: 'stdio',
              command: 'node',
            },
            invalid: {
              name: 'invalid',
              type: 'stdio',
              // Missing required command
            },
          },
        },
      };

      const manager = new MCPServerManager('/tmp', config);
      const servers = manager.getSdkServerConfigs();
      expect(Object.keys(servers)).toEqual(['valid']);
    });

    it('filters servers without required URL for http/sse types', () => {
      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            httpValid: {
              name: 'httpValid',
              type: 'http',
              url: 'http://localhost:3000',
            },
            httpInvalid: {
              name: 'httpInvalid',
              type: 'http',
              // Missing required URL
            },
            sseValid: {
              name: 'sseValid',
              type: 'sse',
              url: 'http://localhost:3001',
            },
            sseInvalid: {
              name: 'sseInvalid',
              type: 'sse',
              // Missing required URL
            },
          },
        },
      };

      const manager = new MCPServerManager('/tmp', config);
      const servers = manager.getSdkServerConfigs();
      expect(Object.keys(servers).sort()).toEqual(['httpValid', 'sseValid']);
    });

    it('excludes SDK type servers from SDK config', () => {
      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            stdio: {
              name: 'stdio',
              type: 'stdio',
              command: 'node',
            },
            sdk: {
              name: 'sdk',
              type: 'sdk',
              command: 'node',
            },
          },
        },
      };

      const manager = new MCPServerManager('/tmp', config);
      const servers = manager.getSdkServerConfigs();
      expect(Object.keys(servers)).toEqual(['stdio']);
    });

    it('returns empty config when MCP is disabled', () => {
      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: false,
          servers: {
            server: {
              name: 'server',
              type: 'stdio',
              command: 'node',
            },
          },
        },
      };

      const manager = new MCPServerManager('/tmp', config);
      const servers = manager.getSdkServerConfigs();
      expect(servers).toEqual({});
    });

    it('lists all servers regardless of validity', () => {
      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            valid: {
              name: 'valid',
              type: 'stdio',
              command: 'node',
            },
            invalid: {
              name: 'invalid',
              type: 'stdio',
            },
          },
        },
      };

      const manager = new MCPServerManager('/tmp', config);
      const servers = manager.listServers();
      expect(servers).toHaveLength(2);
      expect(servers.map(s => s.name)).toEqual(['valid', 'invalid']);
    });

    it('updates config correctly', () => {
      const initialConfig: ApexConfig = { ...baseConfig };
      const manager = new MCPServerManager('/tmp', initialConfig);

      const updatedConfig: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            newServer: {
              name: 'newServer',
              type: 'stdio',
              command: 'node',
            },
          },
        },
      };

      manager.updateConfig(updatedConfig);
      const servers = manager.listServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('newServer');
    });
  });

  describe('Marketplace Management', () => {
    it('loads marketplace entries from a local file', async () => {
      const marketplacePath = path.join(tempDir, 'marketplace.json');

      await fs.writeFile(
        marketplacePath,
        JSON.stringify([
          {
            name: 'example-server',
            description: 'Example MCP server',
            version: '1.0.0',
            serverConfig: {
              name: 'example-server',
              type: 'stdio',
              command: 'node',
              args: ['server.js'],
            },
            verified: true,
          },
        ]),
        'utf-8'
      );

      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {},
          marketplace: {
            url: marketplacePath,
            enabled: true,
            refreshIntervalMinutes: 60,
            allowUnverified: false,
          },
        },
      };

      const manager = new MCPServerManager(tempDir, config);
      const entries = await manager.listMarketplaceEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('example-server');
    });

    it('loads marketplace entries from a file:// URL', async () => {
      const marketplacePath = path.join(tempDir, 'marketplace.json');

      await fs.writeFile(
        marketplacePath,
        JSON.stringify([
          {
            name: 'file-server',
            description: 'File-based MCP server',
            version: '1.0.0',
            serverConfig: {
              name: 'file-server',
              type: 'stdio',
              command: 'node',
            },
            verified: true,
          },
        ]),
        'utf-8'
      );

      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {},
          marketplace: {
            url: `file://${marketplacePath}`,
            enabled: true,
            refreshIntervalMinutes: 60,
            allowUnverified: false,
          },
        },
      };

      const manager = new MCPServerManager(tempDir, config);
      const entries = await manager.listMarketplaceEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('file-server');
    });

    it('returns empty array when marketplace is disabled', async () => {
      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {},
          marketplace: {
            url: 'http://example.com/marketplace.json',
            enabled: false,
            refreshIntervalMinutes: 60,
            allowUnverified: false,
          },
        },
      };

      const manager = new MCPServerManager(tempDir, config);
      const entries = await manager.listMarketplaceEntries();
      expect(entries).toEqual([]);
    });

    it('returns empty array when marketplace URL is missing', async () => {
      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {},
          marketplace: {
            url: '',
            enabled: true,
            refreshIntervalMinutes: 60,
            allowUnverified: false,
          },
        },
      };

      const manager = new MCPServerManager(tempDir, config);
      const entries = await manager.listMarketplaceEntries();
      expect(entries).toEqual([]);
    });

    it('caches marketplace entries based on refresh interval', async () => {
      const marketplacePath = path.join(tempDir, 'marketplace.json');

      await fs.writeFile(
        marketplacePath,
        JSON.stringify([{
          name: 'cached-server',
          description: 'Cached server',
          version: '1.0.0',
          serverConfig: { name: 'cached-server', type: 'stdio', command: 'node' },
          verified: true
        }]),
        'utf-8'
      );

      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {},
          marketplace: {
            url: marketplacePath,
            enabled: true,
            refreshIntervalMinutes: 60,
            allowUnverified: false,
          },
        },
      };

      const manager = new MCPServerManager(tempDir, config);

      // First call should read from file
      const entries1 = await manager.listMarketplaceEntries();
      expect(entries1).toHaveLength(1);

      // Update file
      await fs.writeFile(
        marketplacePath,
        JSON.stringify([{
          name: 'updated-server',
          description: 'Updated server',
          version: '2.0.0',
          serverConfig: { name: 'updated-server', type: 'stdio', command: 'node' },
          verified: true
        }]),
        'utf-8'
      );

      // Second call should return cached results (within refresh interval)
      const entries2 = await manager.listMarketplaceEntries();
      expect(entries2).toHaveLength(1);
      expect(entries2[0].name).toBe('cached-server'); // Still cached
    });

    it('handles invalid JSON in marketplace file', async () => {
      const marketplacePath = path.join(tempDir, 'invalid.json');
      await fs.writeFile(marketplacePath, 'invalid json', 'utf-8');

      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {},
          marketplace: {
            url: marketplacePath,
            enabled: true,
            refreshIntervalMinutes: 60,
            allowUnverified: false,
          },
        },
      };

      const manager = new MCPServerManager(tempDir, config);
      await expect(manager.listMarketplaceEntries()).rejects.toThrow('Invalid marketplace JSON');
    });
  });

  describe('Server Installation and Management', () => {
    it('installs a server from marketplace', async () => {
      const marketplacePath = path.join(tempDir, 'marketplace.json');
      const serverEntry = {
        name: 'install-server',
        description: 'Server to install',
        version: '1.0.0',
        installCommand: 'npm install install-server',
        serverConfig: {
          name: 'install-server',
          type: 'stdio',
          command: 'npx',
          args: ['install-server'],
        },
        verified: true,
      };

      await fs.writeFile(marketplacePath, JSON.stringify([serverEntry]), 'utf-8');

      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {},
          marketplace: {
            url: marketplacePath,
            enabled: true,
            refreshIntervalMinutes: 60,
            allowUnverified: false,
          },
        },
      };

      const manager = new MCPServerManager(tempDir, config);

      // Mock execAsync
      const { exec } = await import('child_process');
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'success', '');
        }
        return {} as any;
      });

      const result = await manager.installServer('install-server');
      expect(result).toEqual(serverEntry.serverConfig);
    });

    it('throws error when installing non-existent server', async () => {
      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {},
          marketplace: {
            url: path.join(tempDir, 'empty.json'),
            enabled: true,
            refreshIntervalMinutes: 60,
            allowUnverified: false,
          },
        },
      };

      await fs.writeFile(path.join(tempDir, 'empty.json'), '[]', 'utf-8');

      const manager = new MCPServerManager(tempDir, config);
      await expect(manager.installServer('non-existent')).rejects.toThrow('Marketplace entry not found: non-existent');
    });

    it('uninstalls a server', async () => {
      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'test-server': {
              name: 'test-server',
              type: 'stdio',
              command: 'node',
            },
          },
        },
      };

      const manager = new MCPServerManager(tempDir, config);
      await manager.uninstallServer('test-server');

      const servers = manager.listServers();
      expect(servers).toHaveLength(0);
    });

    it('throws error when uninstalling non-existent server', async () => {
      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {},
        },
      };

      const manager = new MCPServerManager(tempDir, config);
      await expect(manager.uninstallServer('non-existent')).rejects.toThrow("MCP server 'non-existent' is not installed");
    });

    it('gets server status', async () => {
      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'status-server': {
              name: 'status-server',
              type: 'stdio',
              command: 'node',
            },
          },
        },
      };

      const manager = new MCPServerManager(tempDir, config);
      const status = await manager.getServerStatus('status-server');
      expect(status).toEqual({
        name: 'status-server',
        status: 'stopped',
      });
    });

    it('throws error when getting status of non-existent server', async () => {
      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {},
        },
      };

      const manager = new MCPServerManager(tempDir, config);
      await expect(manager.getServerStatus('non-existent')).rejects.toThrow("MCP server 'non-existent' is not installed");
    });

    it('starts a server', async () => {
      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'start-server': {
              name: 'start-server',
              type: 'stdio',
              command: 'node',
            },
          },
        },
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const manager = new MCPServerManager(tempDir, config);
      await manager.startServer('start-server');

      expect(consoleSpy).toHaveBeenCalledWith('Starting MCP server: start-server');
      consoleSpy.mockRestore();
    });

    it('stops a server', async () => {
      const config: ApexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'stop-server': {
              name: 'stop-server',
              type: 'stdio',
              command: 'node',
            },
          },
        },
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const manager = new MCPServerManager(tempDir, config);
      await manager.stopServer('stop-server');

      expect(consoleSpy).toHaveBeenCalledWith('Stopping MCP server: stop-server');
      consoleSpy.mockRestore();
    });
  });
});
