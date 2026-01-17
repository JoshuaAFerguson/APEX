/**
 * Comprehensive integration tests for all MCP CLI commands
 * Tests the complete functionality of init, list, add, and validate commands
 * Verifies command output, config file changes, and cross-command interactions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
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
    dim: (str: string) => str,
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
    validateMCPConfig: vi.fn(),
  };
});

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

describe('MCP Commands Comprehensive Tests', () => {
  let mockContext: CliContext;
  let tempDir: string;
  let mockLoadMCPTemplates: any;
  let mockGetMCPTemplate: any;
  let mockLoadConfig: any;
  let mockSaveConfig: any;
  let mockValidateMCPConfig: any;
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
    postgres: {
      id: 'postgres',
      name: 'PostgreSQL Server',
      description: 'MCP server for PostgreSQL database operations',
      package: '@modelcontextprotocol/server-postgres',
      config: {
        name: 'postgres',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        autoStart: false,
      },
      envVars: [
        {
          name: 'POSTGRES_CONNECTION_STRING',
          description: 'PostgreSQL connection string',
          required: true,
          sensitive: true,
        },
      ],
      capabilities: ['database', 'sql'],
      verified: false,
      defaultEnabled: false,
    },
  };

  const baseConfig: ApexConfig = {
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
    // Create temporary directory for test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mcp-test-'));

    mockContext = {
      cwd: tempDir,
      initialized: true,
      config: baseConfig,
    } as CliContext;

    // Get the mocked functions
    const {
      loadMCPTemplates,
      getMCPTemplate,
      loadConfig,
      saveConfig,
      validateMCPConfig
    } = await import('@apexcli/core');

    mockLoadMCPTemplates = vi.mocked(loadMCPTemplates);
    mockGetMCPTemplate = vi.mocked(getMCPTemplate);
    mockLoadConfig = vi.mocked(loadConfig);
    mockSaveConfig = vi.mocked(saveConfig);
    mockValidateMCPConfig = vi.mocked(validateMCPConfig);
    mockInquirerPrompt = vi.mocked(inquirer.prompt);

    // Reset all mocks
    mockConsoleLog.mockClear();
    mockLoadMCPTemplates.mockClear();
    mockGetMCPTemplate.mockClear();
    mockLoadConfig.mockClear();
    mockSaveConfig.mockClear();
    mockValidateMCPConfig.mockClear();
    mockInquirerPrompt.mockClear();

    // Default mock implementations
    mockLoadConfig.mockResolvedValue(baseConfig);
    mockSaveConfig.mockResolvedValue(undefined);
    mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);
    mockValidateMCPConfig.mockResolvedValue({
      isValid: true,
      issues: [],
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
    });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('MCP List Command', () => {
    it('should display all available templates with proper formatting', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockLoadMCPTemplates).toHaveBeenCalledOnce();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📦 Available MCP Server Templates:')
      );

      // Verify all templates are displayed
      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');
      expect(allOutput).toContain('Filesystem Server');
      expect(allOutput).toContain('GitHub Server');
      expect(allOutput).toContain('PostgreSQL Server');
      expect(allOutput).toContain('Total: 3 templates available');
    });

    it('should handle empty template list gracefully', async () => {
      mockLoadMCPTemplates.mockResolvedValue({});

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No MCP templates found')
      );
    });

    it('should default to list when no subcommand provided', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, []);

      expect(mockLoadMCPTemplates).toHaveBeenCalledOnce();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📦 Available MCP Server Templates:')
      );
    });
  });

  describe('MCP Add Command', () => {
    it('should successfully add a server to config', async () => {
      const template = sampleTemplates.filesystem;
      mockGetMCPTemplate.mockResolvedValue(template);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'filesystem']);

      expect(mockGetMCPTemplate).toHaveBeenCalledWith('filesystem');
      expect(mockLoadConfig).toHaveBeenCalledWith(tempDir);
      expect(mockSaveConfig).toHaveBeenCalledWith(tempDir, expect.objectContaining({
        mcp: expect.objectContaining({
          servers: expect.objectContaining({
            filesystem: expect.objectContaining({
              name: 'Filesystem Server',
              type: 'stdio',
              command: 'npx',
              autoStart: true,
            })
          })
        })
      }));

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ Successfully added MCP server \'Filesystem Server\' (filesystem)')
      );
    });

    it('should handle server addition with environment variables', async () => {
      const template = sampleTemplates.github;
      mockGetMCPTemplate.mockResolvedValue(template);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'github']);

      const savedConfig = mockSaveConfig.mock.calls[0][1];
      const githubServer = savedConfig.mcp.servers.github;

      expect(githubServer.envVars).toHaveLength(1);
      expect(githubServer.envVars[0]).toMatchObject({
        name: 'GITHUB_TOKEN',
        description: 'GitHub personal access token',
        required: true,
        sensitive: true,
        value: undefined, // Should be undefined for sensitive vars
      });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📝 Configuration Notes:')
      );
    });

    it('should handle missing server name error', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: Server name is required')
      );
      expect(mockGetMCPTemplate).not.toHaveBeenCalled();
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });

    it('should handle template not found error', async () => {
      mockGetMCPTemplate.mockResolvedValue(null);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'nonexistent']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: Template \'nonexistent\' not found')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Run "/mcp list" to see available templates')
      );
    });

    it('should warn when server already exists', async () => {
      const template = sampleTemplates.filesystem;
      mockGetMCPTemplate.mockResolvedValue(template);
      mockLoadConfig.mockResolvedValue({
        ...baseConfig,
        mcp: {
          servers: {
            filesystem: { name: 'Existing Filesystem Server' }
          }
        }
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Server \'filesystem\' already exists in configuration')
      );
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });
  });

  describe('MCP Init Command', () => {
    it('should require APEX to be initialized', async () => {
      const uninitializedContext = { ...mockContext, initialized: false };

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(uninitializedContext, ['init']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ APEX not initialized. Run /init first.')
      );
      expect(mockLoadConfig).not.toHaveBeenCalled();
    });

    it('should enable MCP and select servers interactively', async () => {
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['filesystem', 'github'] });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🛠️  MCP Interactive Setup')
      );
      expect(mockLoadMCPTemplates).toHaveBeenCalled();
      expect(mockSaveConfig).toHaveBeenCalledWith(tempDir,
        expect.objectContaining({
          mcp: expect.objectContaining({
            enabled: true,
            servers: expect.objectContaining({
              filesystem: expect.any(Object),
              github: expect.any(Object),
            })
          })
        })
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ MCP configuration saved successfully!')
      );
    });

    it('should disable MCP when user chooses not to enable it', async () => {
      mockInquirerPrompt.mockResolvedValue({ enableMCP: false });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockSaveConfig).toHaveBeenCalledWith(tempDir,
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

    it('should handle no templates available gracefully', async () => {
      mockLoadMCPTemplates.mockResolvedValue({});
      mockInquirerPrompt.mockResolvedValue({ enableMCP: true });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  No MCP templates found. You can manually configure servers later.')
      );
    });

    it('should skip existing servers without error', async () => {
      const configWithExistingServer = {
        ...baseConfig,
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
  });

  describe('MCP Validate Command', () => {
    it('should validate valid MCP configuration successfully', async () => {
      const configWithMCP = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'test-server': {
              command: 'node',
              args: ['server.js'],
              enabled: true,
            },
          },
        },
      };
      mockLoadConfig.mockResolvedValue(configWithMCP);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🔍 Validating MCP configuration...')
      );
      expect(mockValidateMCPConfig).toHaveBeenCalledWith(configWithMCP.mcp, {
        checkEnvironmentVars: true,
        checkCommandExistence: true,
        validateConnectionConfig: true,
        baseDirectory: tempDir,
      });
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ MCP configuration is valid!')
      );
    });

    it('should handle validation errors properly', async () => {
      const configWithErrors = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'problematic-server': {
              // Missing required command field
              args: ['server.js'],
            },
          },
        },
      };
      mockLoadConfig.mockResolvedValue(configWithErrors);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: false,
        issues: [
          {
            code: 'MISSING_COMMAND',
            message: 'Server \'problematic-server\' is missing required \'command\' field',
            severity: 'error' as const,
            path: 'servers.problematic-server.command',
            suggestion: 'Specify the command to execute the MCP server',
          },
        ],
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ MCP configuration has validation errors')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🚨 Errors (1):')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Server \'problematic-server\' is missing required \'command\' field')
      );
    });

    it('should handle disabled MCP configuration', async () => {
      const configWithDisabledMCP = {
        ...baseConfig,
        mcp: {
          enabled: false,
          servers: {},
        },
      };
      mockLoadConfig.mockResolvedValue(configWithDisabledMCP);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ MCP configuration is valid!')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('💡 Note: MCP is currently disabled or not configured')
      );
    });

    it('should handle missing MCP configuration section', async () => {
      const configWithoutMCP = { ...baseConfig };
      mockLoadConfig.mockResolvedValue(configWithoutMCP);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockValidateMCPConfig).toHaveBeenCalledWith(
        { enabled: false, servers: {} },
        expect.any(Object)
      );
    });
  });

  describe('Cross-command integration tests', () => {
    it('should complete a full MCP setup workflow', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Step 1: List available templates
      await mcpCommand?.handler(mockContext, ['list']);
      expect(mockLoadMCPTemplates).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📦 Available MCP Server Templates:')
      );

      // Reset for next step
      mockConsoleLog.mockClear();
      mockLoadMCPTemplates.mockClear();

      // Step 2: Initialize MCP with selected servers
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['filesystem'] });

      await mcpCommand?.handler(mockContext, ['init']);
      expect(mockSaveConfig).toHaveBeenCalledWith(tempDir,
        expect.objectContaining({
          mcp: expect.objectContaining({
            enabled: true,
            servers: expect.objectContaining({
              filesystem: expect.any(Object)
            })
          })
        })
      );

      // Reset for next step
      mockConsoleLog.mockClear();
      const savedConfig = mockSaveConfig.mock.calls[0][1];
      mockLoadConfig.mockResolvedValue(savedConfig);
      mockSaveConfig.mockClear();

      // Step 3: Add another server
      const githubTemplate = sampleTemplates.github;
      mockGetMCPTemplate.mockResolvedValue(githubTemplate);

      await mcpCommand?.handler(mockContext, ['add', 'github']);
      expect(mockSaveConfig).toHaveBeenCalledWith(tempDir,
        expect.objectContaining({
          mcp: expect.objectContaining({
            servers: expect.objectContaining({
              filesystem: expect.any(Object),
              github: expect.any(Object)
            })
          })
        })
      );

      // Reset for final step
      mockConsoleLog.mockClear();
      const finalConfig = mockSaveConfig.mock.calls[0][1];
      mockLoadConfig.mockResolvedValue(finalConfig);

      // Step 4: Validate the final configuration
      await mcpCommand?.handler(mockContext, ['validate']);
      expect(mockValidateMCPConfig).toHaveBeenCalledWith(finalConfig.mcp, expect.any(Object));
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ MCP configuration is valid!')
      );
    });

    it('should handle command errors gracefully without affecting other commands', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Try to add an invalid server
      mockGetMCPTemplate.mockResolvedValue(null);
      await mcpCommand?.handler(mockContext, ['add', 'invalid']);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: Template \'invalid\' not found')
      );

      // Reset and try list command - should still work
      mockConsoleLog.mockClear();
      mockGetMCPTemplate.mockClear();

      await mcpCommand?.handler(mockContext, ['list']);
      expect(mockLoadMCPTemplates).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📦 Available MCP Server Templates:')
      );
    });
  });

  describe('Command validation and error handling', () => {
    it('should handle unknown subcommands with helpful error messages', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['unknown']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Unknown subcommand: unknown')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /mcp init | /mcp list | /mcp add <server-name> | /mcp validate')
      );
    });

    it('should verify correct command metadata', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      expect(mcpCommand).toBeDefined();
      expect(mcpCommand?.name).toBe('mcp');
      expect(mcpCommand?.aliases).toEqual([]);
      expect(mcpCommand?.description).toBe('Manage MCP (Model Context Protocol) server templates');
      expect(mcpCommand?.usage).toBe('/mcp init | /mcp list | /mcp add <server-name> | /mcp validate');
      expect(mcpCommand?.handler).toBeTypeOf('function');
    });

    it('should handle service errors gracefully', async () => {
      mockLoadMCPTemplates.mockRejectedValue(new Error('Service unavailable'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP templates: Service unavailable')
      );
    });

    it('should handle config file errors gracefully', async () => {
      mockLoadConfig.mockRejectedValue(new Error('Config file not found'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error validating MCP configuration: Config file not found')
      );
    });
  });

  describe('Output verification', () => {
    it('should produce consistent output format across commands', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Test list command output format
      await mcpCommand?.handler(mockContext, ['list']);
      const listOutputs = mockConsoleLog.mock.calls.map(call => call[0]);
      expect(listOutputs.some(output => output.includes('📦'))).toBe(true);

      mockConsoleLog.mockClear();

      // Test validate command output format
      await mcpCommand?.handler(mockContext, ['validate']);
      const validateOutputs = mockConsoleLog.mock.calls.map(call => call[0]);
      expect(validateOutputs.some(output => output.includes('🔍'))).toBe(true);
      expect(validateOutputs.some(output => output.includes('✅'))).toBe(true);
    });

    it('should handle config file changes verification', async () => {
      const template = sampleTemplates.filesystem;
      mockGetMCPTemplate.mockResolvedValue(template);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'filesystem']);

      // Verify saveConfig was called with correct structure
      expect(mockSaveConfig).toHaveBeenCalledTimes(1);
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      expect(savedConfig).toHaveProperty('mcp');
      expect(savedConfig.mcp).toHaveProperty('servers');
      expect(savedConfig.mcp.servers).toHaveProperty('filesystem');
      expect(savedConfig.mcp.servers.filesystem).toMatchObject({
        name: 'Filesystem Server',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        autoStart: true,
      });
    });

    it('should verify all four commands complete successfully', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      let allTestsPassed = true;

      // Test list command
      try {
        await mcpCommand?.handler(mockContext, ['list']);
        expect(mockLoadMCPTemplates).toHaveBeenCalled();
      } catch (error) {
        allTestsPassed = false;
      }

      // Test add command
      mockConsoleLog.mockClear();
      mockGetMCPTemplate.mockResolvedValue(sampleTemplates.filesystem);
      try {
        await mcpCommand?.handler(mockContext, ['add', 'filesystem']);
        expect(mockSaveConfig).toHaveBeenCalled();
      } catch (error) {
        allTestsPassed = false;
      }

      // Test validate command
      mockConsoleLog.mockClear();
      try {
        await mcpCommand?.handler(mockContext, ['validate']);
        expect(mockValidateMCPConfig).toHaveBeenCalled();
      } catch (error) {
        allTestsPassed = false;
      }

      // Test init command
      mockConsoleLog.mockClear();
      mockInquirerPrompt.mockResolvedValue({ enableMCP: false });
      try {
        await mcpCommand?.handler(mockContext, ['init']);
        expect(mockSaveConfig).toHaveBeenCalled();
      } catch (error) {
        allTestsPassed = false;
      }

      expect(allTestsPassed).toBe(true);
    });
  });
});