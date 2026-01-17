/**
 * Integration tests for MCP marketplace commands
 * Tests the complete workflow: search -> install -> installed -> uninstall
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CliContext } from '../index.js';

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => `CYAN:${str}`,
    red: (str: string) => `RED:${str}`,
    green: (str: string) => `GREEN:${str}`,
    yellow: (str: string) => `YELLOW:${str}`,
    gray: (str: string) => `GRAY:${str}`,
    blue: (str: string) => `BLUE:${str}`,
  },
}));

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// Mock MCP functions
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadMCPTemplates: vi.fn(),
    getMCPTemplate: vi.fn(),
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
  };
});

import inquirer from 'inquirer';
import { loadMCPTemplates, getMCPTemplate, loadConfig, saveConfig } from '@apexcli/core';
import { commands } from '../index.js';

describe('MCP Marketplace Integration Tests', () => {
  let mockContext: CliContext;
  let mcpCommand: any;
  let mockLoadMCPTemplates: any;
  let mockGetMCPTemplate: any;
  let mockLoadConfig: any;
  let mockSaveConfig: any;
  let mockInquirerPrompt: any;

  // Test data
  const marketplaceTemplates = {
    filesystem: {
      id: 'filesystem',
      name: 'Filesystem Server',
      description: 'Secure filesystem access',
      category: 'Files',
      tags: ['filesystem', 'files'],
      capabilities: ['read', 'write'],
      verified: true,
      config: {
        name: 'filesystem',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        autoStart: true,
      },
    },
    database: {
      id: 'database',
      name: 'Database Server',
      description: 'SQL database connections',
      category: 'Database',
      tags: ['database', 'sql'],
      capabilities: ['sql'],
      verified: false,
      config: {
        name: 'database',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-database'],
        autoStart: true,
      },
    },
  };

  const emptyConfig = {
    project: { name: 'test-project', description: 'Test project' },
    mcp: { enabled: true, servers: {} },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();

    mockContext = {
      cwd: '/test',
      initialized: true,
    };

    mockLoadMCPTemplates = vi.mocked(loadMCPTemplates);
    mockGetMCPTemplate = vi.mocked(getMCPTemplate);
    mockLoadConfig = vi.mocked(loadConfig);
    mockSaveConfig = vi.mocked(saveConfig);
    mockInquirerPrompt = vi.mocked(inquirer.prompt);

    // Default mock implementations
    mockLoadMCPTemplates.mockResolvedValue(marketplaceTemplates);
    mockLoadConfig.mockResolvedValue(emptyConfig);
    mockSaveConfig.mockResolvedValue(undefined);

    mcpCommand = commands.find(cmd => cmd.name === 'mcp');
  });

  describe('Complete Marketplace Workflow', () => {
    it('should support search -> install -> installed -> uninstall workflow', async () => {
      // Step 1: Search for a server
      await mcpCommand.handler(mockContext, ['search', 'database']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('CYAN:🔍 Searching MCP marketplace for "database"')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('YELLOW:Database Server')
      );

      mockConsoleLog.mockClear();

      // Step 2: Install the server
      mockGetMCPTemplate.mockResolvedValue(marketplaceTemplates.database);

      await mcpCommand.handler(mockContext, ['install', 'database']);

      expect(mockGetMCPTemplate).toHaveBeenCalledWith('database');
      expect(mockSaveConfig).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GREEN:✅ Successfully added MCP server \'Database Server\' (database)')
      );

      mockConsoleLog.mockClear();

      // Step 3: List installed servers
      const configWithDatabase = {
        ...emptyConfig,
        mcp: {
          enabled: true,
          servers: {
            database: {
              name: 'Database Server',
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-database'],
              autoStart: true,
            },
          },
        },
      };
      mockLoadConfig.mockResolvedValue(configWithDatabase);

      await mcpCommand.handler(mockContext, ['installed']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('CYAN:📦 Installed MCP Servers:')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('YELLOW:Database Server')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Total: 1 server installed')
      );

      mockConsoleLog.mockClear();

      // Step 4: Uninstall the server
      mockInquirerPrompt.mockResolvedValue({ confirm: true });

      await mcpCommand.handler(mockContext, ['uninstall', 'database']);

      expect(mockInquirerPrompt).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GREEN:✅ Successfully uninstalled MCP server \'Database Server\' (database)')
      );
    });

    it('should handle cancelled uninstall in workflow', async () => {
      // Install server first
      mockGetMCPTemplate.mockResolvedValue(marketplaceTemplates.filesystem);
      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      mockConsoleLog.mockClear();

      // Try to uninstall but cancel
      mockInquirerPrompt.mockResolvedValue({ confirm: false });

      const configWithFilesystem = {
        ...emptyConfig,
        mcp: {
          enabled: true,
          servers: {
            filesystem: {
              name: 'Filesystem Server',
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem'],
              autoStart: true,
            },
          },
        },
      };
      mockLoadConfig.mockResolvedValue(configWithFilesystem);

      await mcpCommand.handler(mockContext, ['uninstall', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('YELLOW:❌ Uninstallation cancelled')
      );

      mockConsoleLog.mockClear();

      // Verify server is still installed
      await mcpCommand.handler(mockContext, ['installed']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('YELLOW:Filesystem Server')
      );
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle search -> install with non-existent server', async () => {
      // Search returns results
      await mcpCommand.handler(mockContext, ['search', 'filesystem']);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('YELLOW:Filesystem Server')
      );

      mockConsoleLog.mockClear();

      // Try to install non-existent server
      mockGetMCPTemplate.mockResolvedValue(null);

      await mcpCommand.handler(mockContext, ['install', 'nonexistent']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error: Template \'nonexistent\' not found')
      );
    });

    it('should handle install -> uninstall with config errors', async () => {
      // Successful install
      mockGetMCPTemplate.mockResolvedValue(marketplaceTemplates.database);
      await mcpCommand.handler(mockContext, ['install', 'database']);

      mockConsoleLog.mockClear();

      // Uninstall with config error
      mockLoadConfig.mockRejectedValue(new Error('Config load error'));

      await mcpCommand.handler(mockContext, ['uninstall', 'database']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error uninstalling MCP server: Config load error')
      );
    });
  });

  describe('Command Help and Guidance', () => {
    it('should provide proper command guidance', async () => {
      // Test unknown subcommand
      await mcpCommand.handler(mockContext, ['unknown']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:Unknown subcommand: unknown')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /mcp init | /mcp list | /mcp search <query> | /mcp install <server> | /mcp uninstall <server> | /mcp installed | /mcp validate')
      );
    });

    it('should show help when commands are called incorrectly', async () => {
      // Search without query
      mockConsoleLog.mockClear();
      await mcpCommand.handler(mockContext, ['search']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error: Search query is required')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Usage: /mcp search <query>')
      );

      // Install without server name
      mockConsoleLog.mockClear();
      await mcpCommand.handler(mockContext, ['install']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error: Server name is required')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Usage: /mcp install <server-name>')
      );

      // Uninstall without server name
      mockConsoleLog.mockClear();
      await mcpCommand.handler(mockContext, ['uninstall']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error: Server name is required')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Usage: /mcp uninstall <server-name>')
      );
    });
  });

  describe('Command Cross-References', () => {
    it('should cross-reference commands appropriately', async () => {
      // Search should suggest install command
      await mcpCommand.handler(mockContext, ['search', 'database']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:To install: /mcp install <server-name>')
      );

      mockConsoleLog.mockClear();

      // No servers installed should suggest list and search
      await mcpCommand.handler(mockContext, ['installed']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:• Browse available servers: /mcp list')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:• Search for servers: /mcp search <query>')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:• Install a server: /mcp install <server-name>')
      );

      mockConsoleLog.mockClear();

      // Template not found should suggest list command
      mockGetMCPTemplate.mockResolvedValue(null);
      await mcpCommand.handler(mockContext, ['install', 'nonexistent']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Run "/mcp list" to see available templates')
      );
    });
  });

  describe('Multiple Server Management', () => {
    it('should handle multiple servers correctly', async () => {
      // Install first server
      mockGetMCPTemplate.mockResolvedValue(marketplaceTemplates.filesystem);
      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      // Install second server
      mockGetMCPTemplate.mockResolvedValue(marketplaceTemplates.database);
      await mcpCommand.handler(mockContext, ['install', 'database']);

      mockConsoleLog.mockClear();

      // Check both are installed
      const configWithBothServers = {
        ...emptyConfig,
        mcp: {
          enabled: true,
          servers: {
            filesystem: {
              name: 'Filesystem Server',
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem'],
              autoStart: true,
            },
            database: {
              name: 'Database Server',
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-database'],
              autoStart: true,
            },
          },
        },
      };
      mockLoadConfig.mockResolvedValue(configWithBothServers);

      await mcpCommand.handler(mockContext, ['installed']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Total: 2 servers installed')
      );

      mockConsoleLog.mockClear();

      // Uninstall one server
      mockInquirerPrompt.mockResolvedValue({ confirm: true });
      await mcpCommand.handler(mockContext, ['uninstall', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Remaining installed servers: 1')
      );
    });
  });
});