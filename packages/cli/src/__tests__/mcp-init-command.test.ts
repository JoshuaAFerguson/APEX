/**
 * Comprehensive tests for MCP init command
 * Tests the interactive MCP setup workflow including prompts and config changes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import inquirer from 'inquirer';
import type { CliContext } from '../index.js';
import type { MCPTemplate, ApexConfig } from '@apexcli/core';

// Mock chalk to avoid color codes in tests
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => str,
    red: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    gray: (str: string) => str,
    blue: (str: string) => str,
  },
}));

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// Mock the MCP and config functions
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

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

describe('MCP Init Command', () => {
  let mockContext: CliContext;
  let mockLoadMCPTemplates: any;
  let mockLoadConfig: any;
  let mockSaveConfig: any;
  let mockInquirerPrompt: any;

  const sampleTemplates: Record<string, MCPTemplate> = {
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
          sensitive: true,
        },
      ],
      capabilities: ['git', 'api'],
      verified: true,
      defaultEnabled: false,
    },
  };

  const mockConfig: ApexConfig = {
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
      level: 'medium',
      autoApprove: false,
    },
  };

  beforeEach(async () => {
    mockContext = {
      cwd: '/test/project',
      initialized: true,
      config: mockConfig,
    } as CliContext;

    // Get the mocked functions
    const { loadMCPTemplates, loadConfig, saveConfig } = await import('@apexcli/core');
    mockLoadMCPTemplates = vi.mocked(loadMCPTemplates);
    mockLoadConfig = vi.mocked(loadConfig);
    mockSaveConfig = vi.mocked(saveConfig);
    mockInquirerPrompt = vi.mocked(inquirer.prompt);

    // Reset all mocks
    mockConsoleLog.mockClear();
    mockLoadMCPTemplates.mockClear();
    mockLoadConfig.mockClear();
    mockSaveConfig.mockClear();
    mockInquirerPrompt.mockClear();

    // Default mock implementations
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockSaveConfig.mockResolvedValue(undefined);
    mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('should require APEX to be initialized', async () => {
      const uninitialized = { ...mockContext, initialized: false };
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(uninitialized, ['init']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ APEX not initialized. Run /init first.')
      );
      expect(mockLoadConfig).not.toHaveBeenCalled();
    });

    it('should display welcome message and guidance', async () => {
      mockInquirerPrompt.mockResolvedValue({ enableMCP: false });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🛠️  MCP Interactive Setup')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('This will help you configure MCP (Model Context Protocol) for your APEX project.')
      );
    });

    it('should load current config before starting setup', async () => {
      mockInquirerPrompt.mockResolvedValue({ enableMCP: false });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockLoadConfig).toHaveBeenCalledWith(mockContext.cwd);
    });
  });

  describe('MCP enable/disable flow', () => {
    it('should prompt user to enable MCP with existing config as default', async () => {
      const configWithMCP = {
        ...mockConfig,
        mcp: { enabled: true, servers: {} }
      };
      mockLoadConfig.mockResolvedValue(configWithMCP);
      mockInquirerPrompt.mockResolvedValue({ enableMCP: false });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockInquirerPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          name: 'enableMCP',
          message: 'Enable MCP (Model Context Protocol) for this project?',
          default: true // Should use existing config value
        })
      ]);
    });

    it('should save config and exit when user chooses not to enable MCP', async () => {
      mockInquirerPrompt.mockResolvedValue({ enableMCP: false });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockSaveConfig).toHaveBeenCalledWith(mockContext.cwd,
        expect.objectContaining({
          mcp: expect.objectContaining({
            enabled: false
          })
        })
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✓ MCP disabled for this project.')
      );
    });

    it('should initialize MCP config if it does not exist', async () => {
      mockInquirerPrompt.mockResolvedValue({ enableMCP: false });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockSaveConfig).toHaveBeenCalledWith(mockContext.cwd,
        expect.objectContaining({
          mcp: expect.objectContaining({
            enabled: false,
            servers: {}
          })
        })
      );
    });
  });

  describe('Template selection flow', () => {
    it('should proceed to template selection when MCP is enabled', async () => {
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['none'] });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockLoadMCPTemplates).toHaveBeenCalled();
      expect(mockInquirerPrompt).toHaveBeenCalledTimes(2);
    });

    it('should handle no available templates gracefully', async () => {
      mockLoadMCPTemplates.mockResolvedValue({});
      mockInquirerPrompt.mockResolvedValue({ enableMCP: true });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  No MCP templates found. You can manually configure servers later.')
      );
      expect(mockSaveConfig).toHaveBeenCalled();
    });

    it('should present template choices with proper formatting', async () => {
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['none'] });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      const secondCall = mockInquirerPrompt.mock.calls[1];
      expect(secondCall[0]).toContainEqual(
        expect.objectContaining({
          type: 'checkbox',
          name: 'selectedServers',
          message: 'Which MCP servers would you like to add?',
          choices: expect.arrayContaining([
            expect.objectContaining({
              name: 'Filesystem Server - MCP server providing secure filesystem access',
              value: 'filesystem',
              short: 'Filesystem Server'
            }),
            expect.objectContaining({
              name: 'GitHub Server - MCP server for GitHub repository integration',
              value: 'github',
              short: 'GitHub Server'
            }),
            expect.objectContaining({
              name: 'None (configure manually later)',
              value: 'none'
            })
          ])
        })
      );
    });

    it('should require at least one selection in template prompt', async () => {
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['none'] });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      const secondCall = mockInquirerPrompt.mock.calls[1];
      const validateFunction = secondCall[0][0].validate;

      expect(validateFunction([])).toBe('Please select at least one option or choose "None"');
      expect(validateFunction(['filesystem'])).toBe(true);
      expect(validateFunction(['none'])).toBe(true);
    });
  });

  describe('Server configuration', () => {
    it('should add selected servers to configuration', async () => {
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['filesystem', 'github'] });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockSaveConfig).toHaveBeenCalledWith(mockContext.cwd,
        expect.objectContaining({
          mcp: expect.objectContaining({
            enabled: true,
            servers: expect.objectContaining({
              filesystem: expect.objectContaining({
                name: 'Filesystem Server',
                type: 'stdio',
                command: 'npx',
                autoStart: true,
              }),
              github: expect.objectContaining({
                name: 'GitHub Server',
                type: 'stdio',
                command: 'npx',
                autoStart: false,
                envVars: expect.arrayContaining([
                  expect.objectContaining({
                    name: 'GITHUB_TOKEN',
                    required: true,
                    sensitive: true,
                    value: undefined, // Should be undefined for sensitive vars
                  })
                ])
              })
            })
          })
        })
      );
    });

    it('should skip existing servers without error', async () => {
      const configWithExistingServer = {
        ...mockConfig,
        mcp: {
          enabled: true,
          servers: {
            filesystem: { name: 'Existing Filesystem Server' }
          }
        }
      };
      mockLoadConfig.mockResolvedValue(configWithExistingServer);
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['filesystem', 'github'] });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Server \'Filesystem Server\' already exists, skipping...')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✓ Added MCP server: GitHub Server')
      );
    });

    it('should handle environment variables correctly', async () => {
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['github'] });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      const savedConfig = mockSaveConfig.mock.calls[0][1];
      const githubServer = savedConfig.mcp.servers.github;

      expect(githubServer.envVars).toHaveLength(1);
      expect(githubServer.envVars[0]).toMatchObject({
        name: 'GITHUB_TOKEN',
        description: 'GitHub personal access token',
        required: true,
        sensitive: true,
        value: undefined // Sensitive vars should not have values
      });
    });

    it('should set capabilities when defined in template', async () => {
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['filesystem'] });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      const savedConfig = mockSaveConfig.mock.calls[0][1];
      const filesystemServer = savedConfig.mcp.servers.filesystem;

      expect(filesystemServer.capabilities).toEqual(['filesystem', 'read', 'write']);
    });

    it('should handle defaultEnabled property correctly', async () => {
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['filesystem', 'github'] });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      const savedConfig = mockSaveConfig.mock.calls[0][1];

      expect(savedConfig.mcp.servers.filesystem.autoStart).toBe(true);
      expect(savedConfig.mcp.servers.github.autoStart).toBe(false);
    });

    it('should skip server addition when "none" is selected', async () => {
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['none'] });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockSaveConfig).toHaveBeenCalledWith(mockContext.cwd,
        expect.objectContaining({
          mcp: expect.objectContaining({
            enabled: true,
            servers: {}
          })
        })
      );
      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining('📦 Adding selected MCP servers...')
      );
    });
  });

  describe('Success messaging and next steps', () => {
    it('should display success message and helpful next steps', async () => {
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['filesystem'] });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ MCP configuration saved successfully!')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Next steps:')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Use /mcp validate to check your configuration')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Use /mcp add <server-name> to add more servers')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Edit .apex/config.yaml to configure environment variables')
      );
    });

    it('should display server addition confirmation messages', async () => {
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['filesystem', 'github'] });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📦 Adding selected MCP servers...')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✓ Added MCP server: Filesystem Server')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✓ Added MCP server: GitHub Server')
      );
    });
  });

  describe('Error handling', () => {
    it('should handle config loading errors', async () => {
      mockLoadConfig.mockRejectedValue(new Error('Config file not found'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error during MCP setup: Config file not found')
      );
    });

    it('should handle template loading errors', async () => {
      mockLoadMCPTemplates.mockRejectedValue(new Error('Templates directory not accessible'));
      mockInquirerPrompt.mockResolvedValue({ enableMCP: true });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error during MCP setup: Templates directory not accessible')
      );
    });

    it('should handle config saving errors', async () => {
      mockSaveConfig.mockRejectedValue(new Error('Permission denied'));
      mockInquirerPrompt.mockResolvedValue({ enableMCP: false });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error during MCP setup: Permission denied')
      );
    });

    it('should handle inquirer prompt errors', async () => {
      mockInquirerPrompt.mockRejectedValue(new Error('User cancelled prompt'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error during MCP setup: User cancelled prompt')
      );
    });

    it('should handle missing template during server addition', async () => {
      // Simulate template being missing during server addition
      const incompleteTemplates = { filesystem: sampleTemplates.filesystem };
      mockLoadMCPTemplates.mockResolvedValue(incompleteTemplates);
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['filesystem', 'github'] });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      // Should skip the missing template without error
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✓ Added MCP server: Filesystem Server')
      );
      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining('✓ Added MCP server: GitHub Server')
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle templates with non-sensitive environment variables', async () => {
      const templateWithNonSensitiveVars = {
        custom: {
          id: 'custom',
          name: 'Custom Server',
          description: 'Custom test server',
          package: '@test/custom',
          config: {
            name: 'custom',
            type: 'stdio',
            command: 'node',
            args: ['server.js'],
            autoStart: true,
          },
          envVars: [
            {
              name: 'API_URL',
              description: 'API endpoint URL',
              required: true,
              sensitive: false,
              defaultValue: 'https://api.example.com',
            },
          ],
          capabilities: ['api'],
          verified: true,
          defaultEnabled: true,
        }
      };

      mockLoadMCPTemplates.mockResolvedValue(templateWithNonSensitiveVars);
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['custom'] });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      const savedConfig = mockSaveConfig.mock.calls[0][1];
      const customServer = savedConfig.mcp.servers.custom;

      expect(customServer.envVars[0]).toMatchObject({
        name: 'API_URL',
        description: 'API endpoint URL',
        required: true,
        sensitive: false,
        value: 'https://api.example.com', // Should include default for non-sensitive
      });
    });

    it('should handle templates without capabilities', async () => {
      const templateWithoutCapabilities = {
        simple: {
          id: 'simple',
          name: 'Simple Server',
          description: 'Simple test server',
          package: '@test/simple',
          config: {
            name: 'simple',
            type: 'stdio',
            command: 'node',
            args: ['simple.js'],
          },
          verified: true,
          defaultEnabled: true,
        }
      };

      mockLoadMCPTemplates.mockResolvedValue(templateWithoutCapabilities);
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['simple'] });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      const savedConfig = mockSaveConfig.mock.calls[0][1];
      const simpleServer = savedConfig.mcp.servers.simple;

      expect(simpleServer).not.toHaveProperty('capabilities');
    });

    it('should handle templates without environment variables', async () => {
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['filesystem'] });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      const savedConfig = mockSaveConfig.mock.calls[0][1];
      const filesystemServer = savedConfig.mcp.servers.filesystem;

      expect(filesystemServer).not.toHaveProperty('envVars');
    });

    it('should handle empty server selection array', async () => {
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: [] });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockSaveConfig).toHaveBeenCalledWith(mockContext.cwd,
        expect.objectContaining({
          mcp: expect.objectContaining({
            enabled: true,
            servers: {}
          })
        })
      );
    });
  });
});