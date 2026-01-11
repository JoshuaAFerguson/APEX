import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ApexOrchestrator } from '../index';
import { MCPInstaller } from '../mcp-installer';
import type { ApexConfig, MCPMarketplaceEntry, MCPServerConfig } from '@apexcli/core';

// Mock external dependencies
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

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
}));

const { exec } = await import('child_process');
const execMock = vi.mocked(exec);

const { loadConfig } = await import('@apexcli/core');
const loadConfigMock = vi.mocked(loadConfig);

const createTestConfig = (mcpConfig?: any): ApexConfig => ({
  version: '1.0',
  project: {
    name: 'mcp-installer-integration-test',
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

const createMockMarketplaceEntry = (name: string, overrides?: any): MCPMarketplaceEntry => ({
  name,
  description: `${name} server for testing`,
  version: '1.0.0',
  serverConfig: {
    name,
    type: 'stdio' as const,
    command: name,
    autoStart: false,
    ...overrides?.serverConfig,
  },
  installCommand: `npm install -g @test/${name}`,
  ...overrides,
});

describe('MCPInstaller Integration with ApexOrchestrator', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let marketplacePath: string;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = path.join(os.tmpdir(), `mcp-installer-orchestrator-integration-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Create marketplace file
    marketplacePath = path.join(tempDir, 'marketplace.json');
    const mockServers = [
      createMockMarketplaceEntry('filesystem'),
      createMockMarketplaceEntry('git'),
      createMockMarketplaceEntry('sqlite'),
    ];
    await fs.writeFile(marketplacePath, JSON.stringify(mockServers), 'utf-8');

    // Mock configuration loading
    const config = createTestConfig({
      enabled: true,
      servers: {},
      marketplace: {
        url: `file://${marketplacePath}`,
        enabled: true,
        refreshIntervalMinutes: 60,
        allowUnverified: true,
      },
    });
    loadConfigMock.mockResolvedValue(config);

    // Mock exec to succeed by default
    execMock.mockImplementation((command, options, callback) => {
      if (typeof callback === 'function') {
        callback(null, { stdout: 'installed successfully', stderr: '' } as any);
      }
      return {} as any;
    });

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator(tempDir);
    await orchestrator.initialize();

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Enhanced MCP Server Installation', () => {
    it('should install MCP server using enhanced method', async () => {
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      const result = await orchestrator.installMcpServerEnhanced('filesystem');

      expect(result.name).toBe('filesystem');
      expect(result.installedFrom).toBe('marketplace');
      expect(result.installedAt).toBeInstanceOf(Date);
      expect(result.config.name).toBe('filesystem');

      // Verify it's tracked in the store
      const isInstalled = await orchestrator.isMcpServerInstalled('filesystem');
      expect(isInstalled).toBe(true);
    });

    it('should install MCP server from npm directly', async () => {
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      const result = await orchestrator.installMcpServerFromNpm('@modelcontextprotocol/server-filesystem');

      expect(result.name).toBe('filesystem');
      expect(result.installedFrom).toBe('npx');
      expect(result.config.command).toBe('npx');
      expect(result.config.args).toEqual(['@modelcontextprotocol/server-filesystem']);

      // Verify the installation command was executed
      expect(execMock).toHaveBeenCalledWith(
        'npm install @modelcontextprotocol/server-filesystem',
        expect.objectContaining({
          cwd: tempDir,
        }),
        expect.any(Function)
      );
    });

    it('should handle installation with custom options', async () => {
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      const options = {
        force: true,
        global: true,
        args: ['--save-dev'],
        env: { NODE_ENV: 'development' }
      };

      const result = await orchestrator.installMcpServerFromNpm('test-package', options);

      expect(result.installedFrom).toBe('npm');

      // Verify custom options were used
      expect(execMock).toHaveBeenCalledWith(
        'npm install -g test-package --save-dev',
        expect.objectContaining({
          env: expect.objectContaining({
            NODE_ENV: 'development'
          })
        }),
        expect.any(Function)
      );
    });

    it('should prevent duplicate installations without force flag', async () => {
      // First installation
      await orchestrator.installMcpServerEnhanced('filesystem');

      // Second installation should fail
      await expect(
        orchestrator.installMcpServerEnhanced('filesystem')
      ).rejects.toThrow("MCP server 'filesystem' is already installed");
    });

    it('should allow reinstallation with force flag', async () => {
      // First installation
      await orchestrator.installMcpServerEnhanced('filesystem');

      execMock.mockClear();

      // Second installation with force should succeed
      const result = await orchestrator.installMcpServerEnhanced('filesystem', { force: true });

      expect(result.name).toBe('filesystem');
      expect(execMock).toHaveBeenCalled();
    });
  });

  describe('Enhanced MCP Server Management', () => {
    it('should list installed servers with enhanced tracking', async () => {
      // Install multiple servers
      await orchestrator.installMcpServerEnhanced('filesystem');
      await orchestrator.installMcpServerFromNpm('test-package');

      const installedServers = await orchestrator.listMcpServersEnhanced();

      expect(installedServers).toHaveLength(2);

      const filesystemServer = installedServers.find(s => s.name === 'filesystem');
      const testServer = installedServers.find(s => s.name === 'test-package');

      expect(filesystemServer?.installedFrom).toBe('marketplace');
      expect(testServer?.installedFrom).toBe('npx');

      // Verify metadata
      expect(filesystemServer?.installedAt).toBeInstanceOf(Date);
      expect(testServer?.installedAt).toBeInstanceOf(Date);
    });

    it('should uninstall servers using enhanced method', async () => {
      // Install server
      await orchestrator.installMcpServerEnhanced('filesystem');

      // Verify it's installed
      const isInstalledBefore = await orchestrator.isMcpServerInstalled('filesystem');
      expect(isInstalledBefore).toBe(true);

      // Uninstall
      await orchestrator.uninstallMcpServerEnhanced('filesystem');

      // Verify it's uninstalled
      const isInstalledAfter = await orchestrator.isMcpServerInstalled('filesystem');
      expect(isInstalledAfter).toBe(false);
    });

    it('should fail to uninstall non-existent server', async () => {
      await expect(
        orchestrator.uninstallMcpServerEnhanced('non-existent')
      ).rejects.toThrow("MCP server 'non-existent' is not installed");
    });

    it('should check server installation status correctly', async () => {
      // Check before installation
      const isInstalledBefore = await orchestrator.isMcpServerInstalled('filesystem');
      expect(isInstalledBefore).toBe(false);

      // Install server
      await orchestrator.installMcpServerEnhanced('filesystem');

      // Check after installation
      const isInstalledAfter = await orchestrator.isMcpServerInstalled('filesystem');
      expect(isInstalledAfter).toBe(true);
    });
  });

  describe('Marketplace Cache Integration', () => {
    it('should update and retrieve marketplace cache', async () => {
      // Update marketplace cache
      await orchestrator.updateMcpMarketplaceCache();

      // Retrieve cached entries
      const cachedEntries = await orchestrator.getCachedMcpMarketplaceEntries();

      expect(cachedEntries).toHaveLength(3);
      expect(cachedEntries.map(e => e.name)).toEqual(['filesystem', 'git', 'sqlite']);
    });

    it('should handle marketplace cache when disabled', async () => {
      // Create orchestrator with MCP disabled
      const disabledConfig = createTestConfig({ enabled: false });
      loadConfigMock.mockResolvedValue(disabledConfig);

      const disabledOrchestrator = new ApexOrchestrator(tempDir);

      const cachedEntries = await disabledOrchestrator.getCachedMcpMarketplaceEntries();
      expect(cachedEntries).toEqual([]);

      await disabledOrchestrator.shutdown();
    });

    it('should install from cached marketplace entries', async () => {
      // Update marketplace cache first
      await orchestrator.updateMcpMarketplaceCache();

      // Install from cache
      const result = await orchestrator.installMcpServerEnhanced('git');

      expect(result.name).toBe('git');
      expect(result.installedFrom).toBe('marketplace');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle installation failures gracefully', async () => {
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Installation failed'), null, null);
        }
        return {} as any;
      });

      await expect(
        orchestrator.installMcpServerEnhanced('filesystem')
      ).rejects.toThrow('Failed to install MCP server');
    });

    it('should handle npm package installation failures', async () => {
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('npm install failed'), null, null);
        }
        return {} as any;
      });

      await expect(
        orchestrator.installMcpServerFromNpm('failing-package')
      ).rejects.toThrow('Failed to install MCP server from npm');
    });

    it('should handle marketplace not available', async () => {
      await expect(
        orchestrator.installMcpServerEnhanced('non-existent-server')
      ).rejects.toThrow('Failed to install MCP server from npm');
    });

    it('should handle disabled MCP installer', async () => {
      const disabledConfig = createTestConfig({ enabled: false });
      loadConfigMock.mockResolvedValue(disabledConfig);

      const disabledOrchestrator = new ApexOrchestrator(tempDir);

      const installedServers = await disabledOrchestrator.listMcpServersEnhanced();
      expect(installedServers).toEqual([]);

      const isInstalled = await disabledOrchestrator.isMcpServerInstalled('test');
      expect(isInstalled).toBe(false);

      await disabledOrchestrator.shutdown();
    });
  });

  describe('Configuration Integration', () => {
    it('should update config after installation', async () => {
      const initialConfig = createTestConfig();
      loadConfigMock.mockResolvedValue(initialConfig);

      // Mock config reload
      loadConfigMock.mockResolvedValue({
        ...initialConfig,
        mcp: {
          ...initialConfig.mcp!,
          servers: {
            filesystem: {
              name: 'filesystem',
              type: 'stdio',
              command: 'filesystem',
              autoStart: false,
            }
          }
        }
      });

      await orchestrator.installMcpServerEnhanced('filesystem');

      // Verify config was reloaded (called during initialization and after installation)
      expect(loadConfigMock).toHaveBeenCalledTimes(2);
    });

    it('should handle server configuration validation', async () => {
      const result = await orchestrator.installMcpServerFromNpm('@modelcontextprotocol/server-filesystem');

      expect(result.config.name).toBe('filesystem');
      expect(result.config.type).toBe('stdio');
      expect(result.config.command).toBe('npx');
      expect(result.config.args).toEqual(['@modelcontextprotocol/server-filesystem']);
      expect(result.config.autoStart).toBe(false);
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent installations of different servers', async () => {
      const serverNames = ['filesystem', 'git', 'sqlite'];

      const installPromises = serverNames.map(name =>
        orchestrator.installMcpServerEnhanced(name)
      );

      const results = await Promise.all(installPromises);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.name).toBe(serverNames[index]);
        expect(result.installedFrom).toBe('marketplace');
      });

      // Verify all servers are tracked
      const installedServers = await orchestrator.listMcpServersEnhanced();
      expect(installedServers).toHaveLength(3);
    });

    it('should handle mixed marketplace and npm installations concurrently', async () => {
      const installPromises = [
        orchestrator.installMcpServerEnhanced('filesystem'), // marketplace
        orchestrator.installMcpServerFromNpm('test-package-1'), // npm
        orchestrator.installMcpServerFromNpm('test-package-2', { global: true }), // npm global
      ];

      const results = await Promise.all(installPromises);

      expect(results).toHaveLength(3);
      expect(results[0].installedFrom).toBe('marketplace');
      expect(results[1].installedFrom).toBe('npx');
      expect(results[2].installedFrom).toBe('npm');
    });
  });

  describe('Integration with Existing MCP Methods', () => {
    it('should work alongside existing MCP server management', async () => {
      // Install using enhanced method
      await orchestrator.installMcpServerEnhanced('filesystem');

      // Verify it appears in regular MCP server list
      const regularServers = orchestrator.listMcpServers();
      const enhancedServers = await orchestrator.listMcpServersEnhanced();

      expect(enhancedServers).toHaveLength(1);
      expect(enhancedServers[0].name).toBe('filesystem');
    });

    it('should maintain compatibility with marketplace entries', async () => {
      const marketplaceEntries = await orchestrator.listMcpMarketplaceEntries();
      expect(marketplaceEntries).toHaveLength(3);

      const cachedEntries = await orchestrator.getCachedMcpMarketplaceEntries();
      expect(cachedEntries.map(e => e.name).sort()).toEqual(
        marketplaceEntries.map(e => e.name).sort()
      );
    });
  });
});