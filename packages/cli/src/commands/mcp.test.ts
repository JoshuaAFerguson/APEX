/**
 * Unit tests for MCP CLI commands
 *
 * Tests for:
 * - 'mcp installed' command output
 * - Help text rendering for all MCP subcommands
 * - Edge cases (no config, empty servers)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import type { CliContext } from '../index.js';

// Mock chalk to avoid ANSI codes in test outputs
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

// Mock MCP and config functions
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadMCPTemplates: vi.fn(),
    getMCPTemplate: vi.fn(),
    getMCPServers: vi.fn(),
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
    validateMCPConfig: vi.fn(),
  };
});

// Mock inquirer for interactive prompts
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

// Import after mocks are set up
import { loadMCPTemplates, getMCPTemplate, getMCPServers, loadConfig, saveConfig, validateMCPConfig } from '@apexcli/core';
import inquirer from 'inquirer';

describe('MCP CLI Commands', () => {
  let mockContext: CliContext;
  let mockLoadMCPTemplates: any;
  let mockGetMCPTemplate: any;
  let mockGetMCPServers: any;
  let mockLoadConfig: any;
  let mockSaveConfig: any;
  let mockValidateMCPConfig: any;
  let mockInquirerPrompt: any;

  const sampleConfig = {
    project: {
      name: 'Test Project',
      description: 'Test project',
    },
    agents: {},
    workflows: {},
    limits: {
      maxTokens: 100000,
      maxCost: 10.0,
      timeoutMs: 300000,
    },
    autonomy: {
      level: 'medium' as const,
      autoApprove: false,
    },
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
        github: {
          name: 'GitHub Server',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          autoStart: false,
          envVars: [
            {
              name: 'GITHUB_TOKEN',
              description: 'GitHub personal access token',
              required: true,
            },
          ],
        },
      },
    },
  };

  const emptyConfig = {
    project: {
      name: 'Test Project',
      description: 'Test project',
    },
    agents: {},
    workflows: {},
    limits: {
      maxTokens: 100000,
      maxCost: 10.0,
      timeoutMs: 300000,
    },
    autonomy: {
      level: 'medium' as const,
      autoApprove: false,
    },
  };

  const sampleTemplates = {
    filesystem: {
      id: 'filesystem',
      name: 'Filesystem Server',
      description: 'MCP server providing secure filesystem access',
      package: '@modelcontextprotocol/server-filesystem',
      config: {
        name: 'filesystem',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        autoStart: true,
      },
      capabilities: ['filesystem', 'read', 'write'],
      verified: true,
      defaultEnabled: true,
      documentationUrl: 'https://modelcontextprotocol.io/servers/filesystem',
    },
    github: {
      id: 'github',
      name: 'GitHub Server',
      description: 'MCP server for GitHub repository integration',
      package: '@modelcontextprotocol/server-github',
      config: {
        name: 'github',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        autoStart: false,
      },
      envVars: [
        {
          name: 'GITHUB_TOKEN',
          description: 'GitHub personal access token',
          required: true,
        },
      ],
      capabilities: ['git', 'api'],
      verified: true,
      defaultEnabled: false,
    },
  };

  beforeEach(async () => {
    mockContext = {
      cwd: '/test/project',
      initialized: true,
      config: sampleConfig,
      orchestrator: null,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    // Get the mocked functions
    mockLoadMCPTemplates = vi.mocked(loadMCPTemplates);
    mockGetMCPTemplate = vi.mocked(getMCPTemplate);
    mockGetMCPServers = vi.mocked(getMCPServers);
    mockLoadConfig = vi.mocked(loadConfig);
    mockSaveConfig = vi.mocked(saveConfig);
    mockValidateMCPConfig = vi.mocked(validateMCPConfig);
    mockInquirerPrompt = vi.mocked(inquirer.prompt);

    mockConsoleLog.mockClear();
    mockLoadMCPTemplates.mockClear();
    mockGetMCPTemplate.mockClear();
    mockGetMCPServers.mockClear();
    mockLoadConfig.mockClear();
    mockSaveConfig.mockClear();
    mockValidateMCPConfig.mockClear();
    mockInquirerPrompt.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('mcp installed command', () => {
    it('should display installed servers correctly', async () => {
      mockLoadConfig.mockResolvedValue(sampleConfig);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['installed']);

      expect(mockLoadConfig).toHaveBeenCalledWith(mockContext.cwd);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('CYAN:\n📦 Installed MCP Servers:\n')
      );

      // Should display both servers
      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('Filesystem Server');
      expect(allOutput).toContain('GitHub Server');
    });

    it('should show server configuration details', async () => {
      mockLoadConfig.mockResolvedValue(sampleConfig);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['installed']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // Should show auto-start status
      expect(allOutput).toContain('GREEN:enabled'); // For filesystem auto-start
      expect(allOutput).toContain('RED:disabled'); // For github auto-start

      // Should show total count
      expect(allOutput).toContain('GRAY:Total: 2 servers installed');

      // Should show MCP enabled status
      expect(allOutput).toContain('GRAY:MCP Status:');
      expect(allOutput).toContain('GREEN:enabled');
    });

    it('should display management commands', async () => {
      mockLoadConfig.mockResolvedValue(sampleConfig);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['installed']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('GRAY:Management commands:');
      expect(allOutput).toContain('GRAY:  • Uninstall: /mcp uninstall <server-name>');
      expect(allOutput).toContain('GRAY:  • Validate config: /mcp validate');
      expect(allOutput).toContain('GRAY:  • Configure servers: edit .apex/config.yaml');
    });

    it('should handle no installed servers', async () => {
      const configWithEmptyServers = {
        ...sampleConfig,
        mcp: {
          enabled: true,
          servers: {},
        },
      };
      mockLoadConfig.mockResolvedValue(configWithEmptyServers);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['installed']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:No MCP servers are currently installed.')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:  • Browse available servers: /mcp list')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:  • Search for servers: /mcp search <query>')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:  • Install a server: /mcp install <server-name>')
      );
    });

    it('should handle disabled MCP', async () => {
      const configWithDisabledMCP = {
        ...sampleConfig,
        mcp: {
          enabled: false,
          servers: sampleConfig.mcp.servers,
        },
      };
      mockLoadConfig.mockResolvedValue(configWithDisabledMCP);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['installed']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('RED:disabled');
      expect(allOutput).toContain('YELLOW:⚠️  MCP is disabled. Enable it with "/mcp init" to use installed servers.');
    });

    it('should handle missing MCP config section', async () => {
      mockLoadConfig.mockResolvedValue(emptyConfig);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['installed']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:No MCP servers are currently installed.')
      );
    });

    it('should handle errors gracefully', async () => {
      mockLoadConfig.mockRejectedValue(new Error('Config load failed'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['installed']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error listing installed MCP servers: Config load failed')
      );
    });
  });

  describe('help text rendering for all mcp subcommands', () => {
    it('should display correct usage for unknown subcommands', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['unknown-command']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:Unknown subcommand: unknown-command')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Usage: /mcp init | /mcp list | /mcp search <query> | /mcp install <server> | /mcp uninstall <server> | /mcp installed | /mcp validate')
      );
    });

    it('should show help for install subcommand with missing argument', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['install']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Usage: /mcp install <server-name>')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Available servers: /mcp list')
      );
    });

    it('should show help for uninstall subcommand with missing argument', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['uninstall']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Usage: /mcp uninstall <server-name>')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Installed servers: /mcp installed')
      );
    });

    it('should show help for search subcommand with missing argument', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Usage: /mcp search <query>')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Example: /mcp search filesystem')
      );
    });

    it('should display marketplace commands in list output', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('GRAY:\n🔍 Marketplace commands:');
      expect(allOutput).toContain('GRAY:  • Search servers: /mcp search <query>');
      expect(allOutput).toContain('GRAY:  • Install server: /mcp install <server-name>');
      expect(allOutput).toContain('GRAY:  • View installed: /mcp installed');
      expect(allOutput).toContain('GRAY:  • Interactive setup: /mcp init\n');
    });

    it('should provide navigation hints when no search results found', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'nonexistent']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('YELLOW:No MCP servers found matching "nonexistent"');
      expect(allOutput).toContain('GRAY:  • Running "/mcp list" to see all available servers');
    });

    it('should show available commands after search results', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'filesystem']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('GRAY:\nTo install: /mcp install <server-name>');
      expect(allOutput).toContain('GRAY:To see all servers: /mcp list\n');
    });
  });

  describe('edge cases', () => {
    it('should handle null arguments array', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, null as any);

      // Should default to list command
      expect(mockLoadMCPTemplates).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('CYAN:\n📦 MCP Marketplace - Available Servers:\n')
      );
    });

    it('should handle undefined arguments array', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, undefined as any);

      // Should default to list command
      expect(mockLoadMCPTemplates).toHaveBeenCalled();
    });

    it('should handle empty arguments array', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, []);

      // Should default to list command
      expect(mockLoadMCPTemplates).toHaveBeenCalled();
    });

    it('should handle no config found', async () => {
      mockLoadConfig.mockRejectedValue(new Error('Config file not found'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['installed']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error listing installed MCP servers: Config file not found')
      );
    });

    it('should handle empty servers object', async () => {
      const configWithNullServers = {
        ...sampleConfig,
        mcp: {
          enabled: true,
          servers: null as any,
        },
      };
      mockLoadConfig.mockResolvedValue(configWithNullServers);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['installed']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:No MCP servers are currently installed.')
      );
    });

    it('should handle templates loading failure', async () => {
      mockLoadMCPTemplates.mockRejectedValue(new Error('Template directory not found'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error loading MCP marketplace: Template directory not found')
      );
    });

    it('should handle empty templates in list command', async () => {
      mockLoadMCPTemplates.mockResolvedValue({});

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:No MCP servers found in marketplace.')
      );
    });

    it('should handle case-insensitive subcommands', async () => {
      mockLoadConfig.mockResolvedValue(sampleConfig);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Test different cases
      const testCases = ['INSTALLED', 'Installed', 'InStAlLeD'];

      for (const testCase of testCases) {
        mockConsoleLog.mockClear();
        mockLoadConfig.mockClear();

        await mcpCommand?.handler(mockContext, [testCase]);

        expect(mockLoadConfig).toHaveBeenCalledWith(mockContext.cwd);
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('CYAN:\n📦 Installed MCP Servers:\n')
        );
      }
    });

    it('should handle validate command with valid config', async () => {
      const validationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };
      mockValidateMCPConfig.mockResolvedValue(validationResult);
      mockLoadConfig.mockResolvedValue(sampleConfig);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockValidateMCPConfig).toHaveBeenCalledWith(sampleConfig.mcp, expect.any(Object));
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GREEN:✅ MCP configuration is valid!')
      );
    });

    it('should handle validate command with invalid config', async () => {
      const validationResult = {
        valid: false,
        errors: ['Missing required server configuration'],
        warnings: ['Server not verified'],
      };
      mockValidateMCPConfig.mockResolvedValue(validationResult);
      mockLoadConfig.mockResolvedValue(sampleConfig);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ MCP configuration has validation errors')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Missing required server configuration')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Server not verified')
      );
    });

    it('should handle MCP disabled status in validate command', async () => {
      const validationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };
      const configWithDisabledMCP = {
        ...sampleConfig,
        mcp: {
          enabled: false,
          servers: {},
        },
      };
      mockValidateMCPConfig.mockResolvedValue(validationResult);
      mockLoadConfig.mockResolvedValue(configWithDisabledMCP);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('GRAY:\n💡 Note: MCP is currently disabled or not configured');
    });
  });

  describe('command registration', () => {
    it('should have proper command definition', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      expect(mcpCommand).toBeDefined();
      expect(mcpCommand?.name).toBe('mcp');
      expect(mcpCommand?.aliases).toEqual([]);
      expect(mcpCommand?.description).toBe('Manage MCP (Model Context Protocol) marketplace and servers');
      expect(mcpCommand?.usage).toBe('/mcp init | /mcp list [--json] | /mcp search <query> [--json] | /mcp install <server> | /mcp uninstall <server> | /mcp installed | /mcp validate');
      expect(mcpCommand?.handler).toBeTypeOf('function');
    });

    it('should have correct handler signature', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      expect(mcpCommand?.handler.length).toBe(2); // (ctx, args) parameters
    });

    it('should be properly positioned in commands array', async () => {
      const { commands } = await import('../index.js');
      const mcpIndex = commands.findIndex(cmd => cmd.name === 'mcp');

      expect(mcpIndex).toBeGreaterThan(-1);
      expect(mcpIndex).toBeLessThan(commands.length);
    });
  });
});