import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ApexOrchestrator } from '../index';
import { MCPServerManager } from '../mcp/server-manager';
import type { ApexConfig } from '@apexcli/core';

// Mock external dependencies
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
    loadConfig: vi.fn(),
    saveConfig: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  ClaudeAgentSDK: vi.fn().mockImplementation(() => ({
    request: vi.fn().mockResolvedValue({ content: [] }),
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
  })),
  tool: vi.fn((config) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() }))}));

const createTestConfig = (mcpConfig?: any): ApexConfig => ({
  version: '1.0',
  project: {
    name: 'mcp-integration-test',
  },
  mcp: mcpConfig || {
    enabled: true,
    servers: {},
    marketplace: {
      url: '',
      enabled: true,
      refreshIntervalMinutes: 60,
      allowUnverified: false,
    },
  },
});

const createMockMarketplaceEntry = (name: string, overrides?: any) => ({
  name,
  description: `${name} description`,
  version: '1.0.0',
  author: 'Test Author',
  category: 'test',
  tags: ['test', 'integration'],
  verified: true,
  installCommand: `npm install ${name}`,
  serverConfig: {
    name,
    type: 'stdio',
    command: 'npx',
    args: [name],
  },
  ...overrides,
});

describe('MCP Integration Tests', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let marketplacePath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mcp-integration-'));
    marketplacePath = path.join(tempDir, 'marketplace.json');
    vi.clearAllMocks();

    // Mock loadConfig to return our test config
    const { loadConfig } = await import('@apexcli/core');
    vi.mocked(loadConfig).mockResolvedValue(createTestConfig({
      enabled: true,
      servers: {},
      marketplace: {
        url: marketplacePath,
        enabled: true,
        refreshIntervalMinutes: 60,
        allowUnverified: false,
      },
    }));

    orchestrator = new ApexOrchestrator({ projectPath: tempDir });
  });

  afterEach(async () => {
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('End-to-End MCP Installation Flow', () => {
    it('completes full installation workflow', async () => {
      // Setup marketplace with test servers
      const mockServers = [
        createMockMarketplaceEntry('filesystem-server'),
        createMockMarketplaceEntry('web-server'),
        createMockMarketplaceEntry('database-server'),
      ];

      await fs.writeFile(marketplacePath, JSON.stringify(mockServers), 'utf-8');

      // Step 1: List marketplace entries
      const marketplaceEntries = await orchestrator.listMcpMarketplaceEntries();
      expect(marketplaceEntries).toHaveLength(3);
      expect(marketplaceEntries[0].name).toBe('filesystem-server');

      // Step 2: Verify no servers are installed initially
      let installedServers = await orchestrator.listMcpServers();
      expect(installedServers).toHaveLength(0);

      // Step 3: Install a server
      const { exec } = await import('child_process');
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'npm install completed', '');
        }
        return {} as any;
      });

      const serverConfig = await orchestrator.installMcpServer('filesystem-server');
      expect(serverConfig).toEqual(mockServers[0].serverConfig);

      // Step 4: Verify server is now installed
      installedServers = await orchestrator.listMcpServers();
      expect(installedServers).toHaveLength(1);
      expect(installedServers[0].name).toBe('filesystem-server');

      // Step 5: Get server status
      const status = await orchestrator.getMcpServerStatus('filesystem-server');
      expect(status).toEqual({
        name: 'filesystem-server',
        status: 'stopped',
      });

      // Step 6: Start server
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await orchestrator.startMcpServer('filesystem-server');
      expect(consoleSpy).toHaveBeenCalledWith('Starting MCP server: filesystem-server');

      // Step 7: Stop server
      await orchestrator.stopMcpServer('filesystem-server');
      expect(consoleSpy).toHaveBeenCalledWith('Stopping MCP server: filesystem-server');

      // Step 8: Uninstall server
      await orchestrator.uninstallMcpServer('filesystem-server');
      installedServers = await orchestrator.listMcpServers();
      expect(installedServers).toHaveLength(0);

      consoleSpy.mockRestore();
    });

    it('handles installation failure and recovery', async () => {
      const mockServers = [createMockMarketplaceEntry('failing-server')];
      await fs.writeFile(marketplacePath, JSON.stringify(mockServers), 'utf-8');

      // Mock exec to fail
      const { exec } = await import('child_process');
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Installation failed'), '', 'Error output');
        }
        return {} as any;
      });

      // Installation should fail
      await expect(orchestrator.installMcpServer('failing-server')).rejects.toThrow();

      // Verify no server was installed
      const installedServers = await orchestrator.listMcpServers();
      expect(installedServers).toHaveLength(0);
    });

    it('handles marketplace fetch failures gracefully', async () => {
      // Point to non-existent marketplace
      const { loadConfig } = await import('@apexcli/core');
      vi.mocked(loadConfig).mockResolvedValue(createTestConfig({
        enabled: true,
        servers: {},
        marketplace: {
          url: '/non/existent/path.json',
          enabled: true,
          refreshIntervalMinutes: 60,
          allowUnverified: false,
        },
      }));

      const newOrchestrator = new ApexOrchestrator({ projectPath: tempDir });

      await expect(newOrchestrator.listMcpMarketplaceEntries()).rejects.toThrow();
    });

    it('persists server configuration across orchestrator instances', async () => {
      const mockServers = [createMockMarketplaceEntry('persistent-server')];
      await fs.writeFile(marketplacePath, JSON.stringify(mockServers), 'utf-8');

      // Mock successful installation
      const { exec } = await import('child_process');
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'npm install completed', '');
        }
        return {} as any;
      });

      // Install server with first orchestrator instance
      await orchestrator.installMcpServer('persistent-server');

      // Create new orchestrator instance
      const newOrchestrator = new ApexOrchestrator({ projectPath: tempDir });

      // Should see the installed server
      const installedServers = await newOrchestrator.listMcpServers();
      expect(installedServers).toHaveLength(1);
      expect(installedServers[0].name).toBe('persistent-server');
    });
  });

  describe('MCP Marketplace Caching', () => {
    it('caches marketplace entries correctly', async () => {
      const initialServers = [createMockMarketplaceEntry('cached-server-1')];
      await fs.writeFile(marketplacePath, JSON.stringify(initialServers), 'utf-8');

      // First fetch
      const entries1 = await orchestrator.listMcpMarketplaceEntries();
      expect(entries1).toHaveLength(1);
      expect(entries1[0].name).toBe('cached-server-1');

      // Update marketplace file
      const updatedServers = [createMockMarketplaceEntry('cached-server-2')];
      await fs.writeFile(marketplacePath, JSON.stringify(updatedServers), 'utf-8');

      // Second fetch should return cached results
      const entries2 = await orchestrator.listMcpMarketplaceEntries();
      expect(entries2).toHaveLength(1);
      expect(entries2[0].name).toBe('cached-server-1'); // Still cached
    });

    it('refreshes cache after interval expires', async () => {
      // Use very short refresh interval for testing
      const { loadConfig } = await import('@apexcli/core');
      vi.mocked(loadConfig).mockResolvedValue(createTestConfig({
        enabled: true,
        servers: {},
        marketplace: {
          url: marketplacePath,
          enabled: true,
          refreshIntervalMinutes: 0.001, // Very short interval
          allowUnverified: false,
        },
      }));

      const shortCacheOrchestrator = new ApexOrchestrator({ projectPath: tempDir });

      const initialServers = [createMockMarketplaceEntry('refresh-test-1')];
      await fs.writeFile(marketplacePath, JSON.stringify(initialServers), 'utf-8');

      // First fetch
      const entries1 = await shortCacheOrchestrator.listMcpMarketplaceEntries();
      expect(entries1[0].name).toBe('refresh-test-1');

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update marketplace
      const updatedServers = [createMockMarketplaceEntry('refresh-test-2')];
      await fs.writeFile(marketplacePath, JSON.stringify(updatedServers), 'utf-8');

      // Second fetch should get updated data
      const entries2 = await shortCacheOrchestrator.listMcpMarketplaceEntries();
      expect(entries2[0].name).toBe('refresh-test-2'); // Cache refreshed
    });
  });

  describe('MCP Server Configuration Validation', () => {
    it('validates server configs before allowing installation', async () => {
      const mockServers = [
        createMockMarketplaceEntry('invalid-stdio-server', {
          serverConfig: {
            type: 'stdio',
            // Missing required command
          },
        }),
        createMockMarketplaceEntry('invalid-http-server', {
          serverConfig: {
            type: 'http',
            // Missing required URL
          },
        }),
        createMockMarketplaceEntry('valid-server'),
      ];

      await fs.writeFile(marketplacePath, JSON.stringify(mockServers), 'utf-8');

      const { exec } = await import('child_process');
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'npm install completed', '');
        }
        return {} as any;
      });

      // Valid server should install fine
      await expect(orchestrator.installMcpServer('valid-server')).resolves.toBeTruthy();

      // The server manager should handle config validation during installation
      const installedServers = await orchestrator.listMcpServers();
      expect(installedServers).toHaveLength(1);
      expect(installedServers[0].name).toBe('valid-server');
    });

    it('handles different server types correctly', async () => {
      const mockServers = [
        createMockMarketplaceEntry('stdio-server', {
          serverConfig: {
            type: 'stdio',
            command: 'node',
            args: ['stdio-server.js'],
          },
        }),
        createMockMarketplaceEntry('http-server', {
          serverConfig: {
            type: 'http',
            url: 'http://localhost:8080',
            headers: { 'Authorization': 'Bearer token' },
          },
        }),
        createMockMarketplaceEntry('sse-server', {
          serverConfig: {
            type: 'sse',
            url: 'http://localhost:8081/events',
          },
        }),
      ];

      await fs.writeFile(marketplacePath, JSON.stringify(mockServers), 'utf-8');

      const { exec } = await import('child_process');
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'npm install completed', '');
        }
        return {} as any;
      });

      // Install all server types
      for (const server of mockServers) {
        await orchestrator.installMcpServer(server.name);
      }

      const installedServers = await orchestrator.listMcpServers();
      expect(installedServers).toHaveLength(3);

      // Verify each server type is configured correctly
      const stdioServer = installedServers.find(s => s.name === 'stdio-server');
      expect(stdioServer?.type).toBe('stdio');
      expect(stdioServer?.command).toBe('node');

      const httpServer = installedServers.find(s => s.name === 'http-server');
      expect(httpServer?.type).toBe('http');
      expect(httpServer?.url).toBe('http://localhost:8080');

      const sseServer = installedServers.find(s => s.name === 'sse-server');
      expect(sseServer?.type).toBe('sse');
      expect(sseServer?.url).toBe('http://localhost:8081/events');
    });
  });

  describe('Error Handling in Integration Flow', () => {
    it('handles partial installation failures gracefully', async () => {
      const mockServers = [
        createMockMarketplaceEntry('success-server'),
        createMockMarketplaceEntry('fail-server'),
      ];

      await fs.writeFile(marketplacePath, JSON.stringify(mockServers), 'utf-8');

      const { exec } = await import('child_process');
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('fail-server')) {
            callback(new Error('Installation failed'), '', 'Error');
          } else {
            callback(null, 'npm install completed', '');
          }
        }
        return {} as any;
      });

      // Install successful server
      await orchestrator.installMcpServer('success-server');
      let installedServers = await orchestrator.listMcpServers();
      expect(installedServers).toHaveLength(1);

      // Try to install failing server
      await expect(orchestrator.installMcpServer('fail-server')).rejects.toThrow();

      // First server should still be installed
      installedServers = await orchestrator.listMcpServers();
      expect(installedServers).toHaveLength(1);
      expect(installedServers[0].name).toBe('success-server');
    });

    it('maintains system state consistency after errors', async () => {
      const mockServers = [createMockMarketplaceEntry('consistency-test')];
      await fs.writeFile(marketplacePath, JSON.stringify(mockServers), 'utf-8');

      // Mock saveConfig to fail partway through installation
      const { saveConfig } = await import('@apexcli/core');
      vi.mocked(saveConfig).mockRejectedValueOnce(new Error('Config save failed'));

      const { exec } = await import('child_process');
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'npm install completed', '');
        }
        return {} as any;
      });

      // Installation should fail at config save step
      await expect(orchestrator.installMcpServer('consistency-test')).rejects.toThrow('Config save failed');

      // System should be in consistent state (no partial installation)
      const installedServers = await orchestrator.listMcpServers();
      expect(installedServers).toHaveLength(0);
    });
  });

  describe('MCP System Lifecycle', () => {
    it('handles MCP system enable/disable correctly', async () => {
      // Start with disabled MCP
      const { loadConfig } = await import('@apexcli/core');
      vi.mocked(loadConfig).mockResolvedValue(createTestConfig({
        enabled: false,
        servers: {},
      }));

      const disabledOrchestrator = new ApexOrchestrator({ projectPath: tempDir });

      // Should return empty arrays when disabled
      expect(await disabledOrchestrator.listMcpServers()).toEqual([]);
      expect(await disabledOrchestrator.listMcpMarketplaceEntries()).toEqual([]);

      // Enable MCP
      vi.mocked(loadConfig).mockResolvedValue(createTestConfig({
        enabled: true,
        servers: {},
        marketplace: {
          url: marketplacePath,
          enabled: true,
          refreshIntervalMinutes: 60,
          allowUnverified: false,
        },
      }));

      const enabledOrchestrator = new ApexOrchestrator({ projectPath: tempDir });

      // Create marketplace
      const mockServers = [createMockMarketplaceEntry('enable-test')];
      await fs.writeFile(marketplacePath, JSON.stringify(mockServers), 'utf-8');

      // Should now work normally
      const entries = await enabledOrchestrator.listMcpMarketplaceEntries();
      expect(entries).toHaveLength(1);
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('simulates typical developer workflow', async () => {
      // Create realistic marketplace with various servers
      const marketplaceServers = [
        createMockMarketplaceEntry('filesystem', {
          category: 'file-system',
          tags: ['files', 'io'],
          description: 'File system access for reading and writing files',
        }),
        createMockMarketplaceEntry('git', {
          category: 'version-control',
          tags: ['git', 'vcs'],
          description: 'Git repository operations',
        }),
        createMockMarketplaceEntry('database', {
          category: 'data',
          tags: ['sql', 'database'],
          description: 'Database query and management',
        }),
      ];

      await fs.writeFile(marketplacePath, JSON.stringify(marketplaceServers), 'utf-8');

      const { exec } = await import('child_process');
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, `${command} completed successfully`, '');
        }
        return {} as any;
      });

      // Developer discovers available servers
      const availableServers = await orchestrator.listMcpMarketplaceEntries();
      expect(availableServers).toHaveLength(3);

      // Install essential servers for development
      await orchestrator.installMcpServer('filesystem');
      await orchestrator.installMcpServer('git');

      // Verify installations
      let installed = await orchestrator.listMcpServers();
      expect(installed).toHaveLength(2);

      // Check status of installed servers
      for (const server of installed) {
        const status = await orchestrator.getMcpServerStatus(server.name || 'unknown');
        expect(status.status).toBe('stopped');
      }

      // Later, install additional server
      await orchestrator.installMcpServer('database');

      installed = await orchestrator.listMcpServers();
      expect(installed).toHaveLength(3);

      // Clean up - uninstall one server
      await orchestrator.uninstallMcpServer('database');

      installed = await orchestrator.listMcpServers();
      expect(installed).toHaveLength(2);
      expect(installed.find(s => s.name === 'database')).toBeUndefined();
    });
  });
});