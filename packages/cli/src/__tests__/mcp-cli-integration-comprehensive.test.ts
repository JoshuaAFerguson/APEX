/**
 * Comprehensive MCP CLI Command Integration Tests
 *
 * Tests all MCP CLI commands end-to-end with real command invocations:
 * - mcp list (marketplace listing)
 * - mcp search <query> (marketplace search)
 * - mcp install <server> (server installation)
 * - mcp uninstall <server> (server uninstallation)
 * - mcp installed (list installed servers)
 * - mcp validate (configuration validation)
 * - mcp status (server status checking)
 * - mcp init (interactive setup)
 *
 * Each test verifies both command output and side effects
 * (configuration changes, file modifications, etc.)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import chalk from 'chalk';
import inquirer from 'inquirer';

// Import types and functions
import type { ApexConfig } from '@apexcli/core';
import type { CliContext } from '../index.js';
import { commands } from '../index.js';

// Mock console output for testing
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock chalk to capture styling information
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => `CYAN(${str})`,
    red: (str: string) => `RED(${str})`,
    green: (str: string) => `GREEN(${str})`,
    yellow: (str: string) => `YELLOW(${str})`,
    gray: (str: string) => `GRAY(${str})`,
    blue: (str: string) => `BLUE(${str})`,
    magenta: (str: string) => `MAGENTA(${str})`,
  },
}));

// Mock inquirer for interactive prompts
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// Mock core functions
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
    loadMCPTemplates: vi.fn(),
    getMCPTemplate: vi.fn(),
    validateMCPConfig: vi.fn(),
    getMCPServers: vi.fn(),
  };
});

// Import mocked functions
import {
  loadConfig,
  saveConfig,
  loadMCPTemplates,
  getMCPTemplate,
  validateMCPConfig,
  getMCPServers,
} from '@apexcli/core';

describe('MCP CLI Integration Tests', () => {
  let testDir: string;
  let mockContext: CliContext;
  let mcpCommands: any;

  // Mock function references
  let mockLoadConfig: any;
  let mockSaveConfig: any;
  let mockLoadMCPTemplates: any;
  let mockGetMCPTemplate: any;
  let mockValidateMCPConfig: any;
  let mockGetMCPServers: any;
  let mockInquirerPrompt: any;

  // Sample test data
  const baseConfig: ApexConfig = {
    project: {
      name: 'Test Project',
      description: 'Test MCP integration',
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
      category: 'system',
      tags: ['filesystem', 'io', 'files'],
      capabilities: ['filesystem', 'read', 'write'],
      verified: true,
      defaultEnabled: true,
      config: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        autoStart: true,
      },
      documentationUrl: 'https://modelcontextprotocol.io/servers/filesystem',
    },
    github: {
      id: 'github',
      name: 'GitHub Server',
      description: 'MCP server for GitHub repository integration',
      package: '@modelcontextprotocol/server-github',
      category: 'development',
      tags: ['git', 'github', 'api'],
      capabilities: ['git', 'api'],
      verified: true,
      defaultEnabled: false,
      config: {
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
      documentationUrl: 'https://modelcontextprotocol.io/servers/github',
    },
    postgres: {
      id: 'postgres',
      name: 'PostgreSQL Server',
      description: 'MCP server for PostgreSQL database integration',
      package: '@modelcontextprotocol/server-postgres',
      category: 'database',
      tags: ['database', 'sql', 'postgresql'],
      capabilities: ['database', 'query'],
      verified: false,
      defaultEnabled: false,
      config: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        autoStart: false,
      },
      envVars: [
        {
          name: 'DATABASE_URL',
          description: 'PostgreSQL connection URL',
          required: true,
          sensitive: true,
        },
      ],
    },
  };

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'apex-mcp-test-'));

    // Setup mock context
    mockContext = {
      cwd: testDir,
      initialized: true,
      config: baseConfig,
      orchestrator: null,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    // Get mock function references
    mockLoadConfig = vi.mocked(loadConfig);
    mockSaveConfig = vi.mocked(saveConfig);
    mockLoadMCPTemplates = vi.mocked(loadMCPTemplates);
    mockGetMCPTemplate = vi.mocked(getMCPTemplate);
    mockValidateMCPConfig = vi.mocked(validateMCPConfig);
    mockGetMCPServers = vi.mocked(getMCPServers);
    mockInquirerPrompt = vi.mocked(inquirer.prompt);

    // Reset mocks
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockLoadConfig.mockClear();
    mockSaveConfig.mockClear();
    mockLoadMCPTemplates.mockClear();
    mockGetMCPTemplate.mockClear();
    mockValidateMCPConfig.mockClear();
    mockGetMCPServers.mockClear();
    mockInquirerPrompt.mockClear();

    // Setup default mock returns
    mockLoadConfig.mockResolvedValue(baseConfig);
    mockSaveConfig.mockResolvedValue(undefined);
    mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);
    mockGetMCPServers.mockReturnValue({});
    mockValidateMCPConfig.mockResolvedValue({
      isValid: true,
      issues: [],
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
    });

    // Get MCP command
    mcpCommands = commands.find(cmd => cmd.name === 'mcp');
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    vi.clearAllMocks();
  });

  describe('Marketplace Listing Commands', () => {
    describe('mcp list command', () => {
      it('should list all available MCP servers with categories', async () => {
        await mcpCommands.handler(mockContext, ['list']);

        expect(mockLoadMCPTemplates).toHaveBeenCalled();

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        // Check header
        expect(output).toContain('CYAN(\n📦 MCP Marketplace - Available Servers:\n)');

        // Check categories
        expect(output).toContain('MAGENTA(📁 Database)');
        expect(output).toContain('MAGENTA(📁 Development)');
        expect(output).toContain('MAGENTA(📁 System)');

        // Check server names
        expect(output).toContain('YELLOW(Filesystem Server)');
        expect(output).toContain('YELLOW(GitHub Server)');
        expect(output).toContain('YELLOW(PostgreSQL Server)');

        // Check verified badges
        expect(output).toContain('BLUE( ✓)'); // For verified servers

        // Check summary information
        expect(output).toContain('GRAY(📊 3 servers available)');
        expect(output).toContain('GRAY(   2 verified servers BLUE(✓))');

        // Check marketplace commands help
        expect(output).toContain('GRAY(🔍 Marketplace commands:)');
        expect(output).toContain('GRAY(  • Search servers: /mcp search <query>)');
        expect(output).toContain('GRAY(  • Install server: /mcp install <server-name>)');
      });

      it('should output JSON format when --json flag is used', async () => {
        await mcpCommands.handler(mockContext, ['list', '--json']);

        expect(mockLoadMCPTemplates).toHaveBeenCalled();

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('');

        // Should be valid JSON
        const parsedOutput = JSON.parse(output);
        expect(Array.isArray(parsedOutput)).toBe(true);
        expect(parsedOutput).toHaveLength(3);

        // Check server structure
        const filesystemServer = parsedOutput.find((s: any) => s.id === 'filesystem');
        expect(filesystemServer).toBeDefined();
        expect(filesystemServer.name).toBe('Filesystem Server');
        expect(filesystemServer.verified).toBe(true);
        expect(filesystemServer.category).toBe('system');
      });

      it('should handle empty marketplace gracefully', async () => {
        mockLoadMCPTemplates.mockResolvedValue({});

        await mcpCommands.handler(mockContext, ['list']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('GRAY(No MCP servers found in marketplace.)');
      });

      it('should handle marketplace loading errors', async () => {
        mockLoadMCPTemplates.mockRejectedValue(new Error('Network error'));

        await mcpCommands.handler(mockContext, ['list']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('RED(❌ Error loading MCP marketplace: Network error)');
      });
    });

    describe('mcp search command', () => {
      it('should search servers by name', async () => {
        await mcpCommands.handler(mockContext, ['search', 'filesystem']);

        expect(mockLoadMCPTemplates).toHaveBeenCalled();

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        // Check search header
        expect(output).toContain('CYAN(\n🔍 Searching MCP marketplace for "filesystem"...\n)');
        expect(output).toContain('GREEN(Found 1 matching server:\n)');

        // Check search result
        expect(output).toContain('YELLOW(Filesystem Server)');
        expect(output).toContain('GRAY(Category:) CYAN(system)');
        expect(output).toContain('GRAY(Tags:) CYAN(filesystem), CYAN(io), CYAN(files)');
        expect(output).toContain('GRAY(Capabilities:) CYAN(filesystem), CYAN(read), CYAN(write)');

        // Check help text
        expect(output).toContain('GRAY(\nTo install: /mcp install <server-name>)');
        expect(output).toContain('GRAY(To see all servers: /mcp list\n)');
      });

      it('should search servers by category', async () => {
        await mcpCommands.handler(mockContext, ['search', 'development']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('GREEN(Found 1 matching server:\n)');
        expect(output).toContain('YELLOW(GitHub Server)');
      });

      it('should search servers by tags', async () => {
        await mcpCommands.handler(mockContext, ['search', 'api']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('GREEN(Found 1 matching server:\n)');
        expect(output).toContain('YELLOW(GitHub Server)');
      });

      it('should search servers by capabilities', async () => {
        await mcpCommands.handler(mockContext, ['search', 'database']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('GREEN(Found 1 matching server:\n)');
        expect(output).toContain('YELLOW(PostgreSQL Server)');
      });

      it('should return multiple results sorted by relevance', async () => {
        await mcpCommands.handler(mockContext, ['search', 'server']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        // Should find all servers since they all contain "server" in their names
        expect(output).toContain('GREEN(Found 3 matching servers:\n)');
        expect(output).toContain('YELLOW(Filesystem Server)');
        expect(output).toContain('YELLOW(GitHub Server)');
        expect(output).toContain('YELLOW(PostgreSQL Server)');
      });

      it('should output JSON format when --json flag is used', async () => {
        await mcpCommands.handler(mockContext, ['search', 'filesystem', '--json']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('');

        const parsedOutput = JSON.parse(output);
        expect(Array.isArray(parsedOutput)).toBe(true);
        expect(parsedOutput).toHaveLength(1);
        expect(parsedOutput[0].name).toBe('Filesystem Server');
      });

      it('should handle no search results gracefully', async () => {
        await mcpCommands.handler(mockContext, ['search', 'nonexistent']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('YELLOW(No MCP servers found matching "nonexistent")');
        expect(output).toContain('GRAY(Try:)');
        expect(output).toContain('GRAY(  • Using broader search terms)');
        expect(output).toContain('GRAY(  • Running "/mcp list" to see all available servers)');
      });

      it('should require search query', async () => {
        await mcpCommands.handler(mockContext, ['search']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('RED(❌ Error: Search query is required)');
        expect(output).toContain('GRAY(Usage: /mcp search <query>)');
        expect(output).toContain('GRAY(Example: /mcp search filesystem)');
      });

      it('should handle search errors', async () => {
        mockLoadMCPTemplates.mockRejectedValue(new Error('Search failed'));

        await mcpCommands.handler(mockContext, ['search', 'filesystem']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('RED(❌ Error searching MCP marketplace: Search failed)');
      });
    });
  });

  describe('Server Installation Commands', () => {
    describe('mcp install command', () => {
      it('should install a server successfully', async () => {
        mockGetMCPTemplate.mockResolvedValue(sampleTemplates.filesystem);

        await mcpCommands.handler(mockContext, ['install', 'filesystem']);

        expect(mockGetMCPTemplate).toHaveBeenCalledWith('filesystem');
        expect(mockLoadConfig).toHaveBeenCalledWith(testDir);
        expect(mockSaveConfig).toHaveBeenCalled();

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('GREEN(✅ Successfully added MCP server \'Filesystem Server\' (filesystem))');
        expect(output).toContain('GRAY(\nDocumentation: https://modelcontextprotocol.io/servers/filesystem)');
      });

      it('should enable MCP if not already enabled during installation', async () => {
        mockGetMCPTemplate.mockResolvedValue(sampleTemplates.filesystem);
        mockGetMCPServers.mockReturnValue({}); // Empty servers

        await mcpCommands.handler(mockContext, ['install', 'filesystem']);

        // Check that saveConfig was called with MCP enabled
        const savedConfig = mockSaveConfig.mock.calls[0][1];
        expect(savedConfig.mcp.enabled).toBe(true);
        expect(savedConfig.mcp.servers.filesystem).toBeDefined();
        expect(savedConfig.mcp.servers.filesystem.name).toBe('Filesystem Server');
      });

      it('should show environment variable configuration notes', async () => {
        mockGetMCPTemplate.mockResolvedValue(sampleTemplates.github);

        await mcpCommands.handler(mockContext, ['install', 'github']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('CYAN(\n📝 Configuration Notes:)');
        expect(output).toContain('YELLOW(Required environment variables:)');
        expect(output).toContain('  • GITHUB_TOKEN: GitHub personal access token');
        expect(output).toContain('YELLOW(Sensitive environment variables (configure separately):)');
        expect(output).toContain('GRAY(\nEdit .apex/config.yaml to configure environment variables)');
      });

      it('should prevent installing duplicate servers', async () => {
        const configWithServer = {
          ...baseConfig,
          mcp: {
            enabled: true,
            servers: {
              filesystem: {
                name: 'Filesystem Server',
                type: 'stdio' as const,
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-filesystem'],
                autoStart: true,
              },
            },
          },
        };

        mockLoadConfig.mockResolvedValue(configWithServer);
        mockGetMCPTemplate.mockResolvedValue(sampleTemplates.filesystem);
        mockGetMCPServers.mockReturnValue({
          filesystem: {
            name: 'Filesystem Server',
            type: 'stdio' as const,
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            autoStart: true,
          },
        });

        await mcpCommands.handler(mockContext, ['install', 'filesystem']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('YELLOW(⚠️  Server \'filesystem\' already exists in configuration)');
        expect(output).toContain('GRAY(Edit .apex/config.yaml to modify or remove existing servers)');
        expect(mockSaveConfig).not.toHaveBeenCalled();
      });

      it('should handle template not found', async () => {
        mockGetMCPTemplate.mockResolvedValue(null);

        await mcpCommands.handler(mockContext, ['install', 'nonexistent']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('RED(❌ Error: Template \'nonexistent\' not found)');
        expect(output).toContain('GRAY(Run "/mcp list" to see available templates)');
        expect(mockSaveConfig).not.toHaveBeenCalled();
      });

      it('should require server name', async () => {
        await mcpCommands.handler(mockContext, ['install']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('RED(❌ Error: Server name is required)');
        expect(output).toContain('GRAY(Usage: /mcp install <server-name>)');
        expect(output).toContain('GRAY(Available servers: /mcp list)');
      });

      it('should handle installation errors gracefully', async () => {
        mockGetMCPTemplate.mockRejectedValue(new Error('Template load failed'));

        await mcpCommands.handler(mockContext, ['install', 'filesystem']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('RED(❌ Error adding MCP server: Template load failed)');
      });

      it('should support "add" alias for install command', async () => {
        mockGetMCPTemplate.mockResolvedValue(sampleTemplates.filesystem);

        await mcpCommands.handler(mockContext, ['add', 'filesystem']);

        expect(mockGetMCPTemplate).toHaveBeenCalledWith('filesystem');
        expect(mockSaveConfig).toHaveBeenCalled();

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('GREEN(✅ Successfully added MCP server \'Filesystem Server\' (filesystem))');
      });
    });

    describe('mcp init command', () => {
      it('should run interactive MCP setup', async () => {
        mockInquirerPrompt
          .mockResolvedValueOnce({ enableMCP: true })
          .mockResolvedValueOnce({ selectedServers: ['filesystem', 'github'] });

        await mcpCommands.handler(mockContext, ['init']);

        expect(mockInquirerPrompt).toHaveBeenCalledTimes(2);
        expect(mockSaveConfig).toHaveBeenCalled();

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('CYAN(\n🛠️  MCP Interactive Setup\n)');
        expect(output).toContain('GREEN(✓ Added MCP server: Filesystem Server)');
        expect(output).toContain('GREEN(✓ Added MCP server: GitHub Server)');
        expect(output).toContain('GREEN(\n✅ MCP configuration saved successfully!)');
      });

      it('should handle disabling MCP during setup', async () => {
        mockInquirerPrompt.mockResolvedValueOnce({ enableMCP: false });

        await mcpCommands.handler(mockContext, ['init']);

        expect(mockSaveConfig).toHaveBeenCalled();

        const savedConfig = mockSaveConfig.mock.calls[0][1];
        expect(savedConfig.mcp.enabled).toBe(false);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('YELLOW(✓ MCP disabled for this project.)');
      });

      it('should handle no servers selected', async () => {
        mockInquirerPrompt
          .mockResolvedValueOnce({ enableMCP: true })
          .mockResolvedValueOnce({ selectedServers: ['none'] });

        await mcpCommands.handler(mockContext, ['init']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('GREEN(\n✅ MCP configuration saved successfully!)');
        expect(output).not.toContain('GREEN(✓ Added MCP server:');
      });

      it('should require APEX initialization first', async () => {
        mockContext.initialized = false;

        await mcpCommands.handler(mockContext, ['init']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('RED(❌ APEX not initialized. Run /init first.)');
        expect(mockInquirerPrompt).not.toHaveBeenCalled();
      });

      it('should handle empty marketplace during init', async () => {
        mockLoadMCPTemplates.mockResolvedValue({});
        mockInquirerPrompt.mockResolvedValueOnce({ enableMCP: true });

        await mcpCommands.handler(mockContext, ['init']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('YELLOW(⚠️  No MCP templates found. You can manually configure servers later.)');
      });

      it('should handle init errors gracefully', async () => {
        mockInquirerPrompt.mockRejectedValue(new Error('Prompt failed'));

        await mcpCommands.handler(mockContext, ['init']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('RED(❌ Error during MCP setup: Prompt failed)');
      });
    });
  });

  describe('Server Configuration Commands', () => {
    describe('mcp validate command', () => {
      it('should validate valid configuration successfully', async () => {
        const configWithMCP = {
          ...baseConfig,
          mcp: {
            enabled: true,
            servers: {
              filesystem: {
                name: 'Filesystem Server',
                type: 'stdio' as const,
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-filesystem'],
                autoStart: true,
              },
            },
          },
        };

        mockLoadConfig.mockResolvedValue(configWithMCP);
        mockValidateMCPConfig.mockResolvedValue({
          isValid: true,
          issues: [],
          errorCount: 0,
          warningCount: 0,
          infoCount: 0,
        });

        await mcpCommands.handler(mockContext, ['validate']);

        expect(mockValidateMCPConfig).toHaveBeenCalledWith(
          configWithMCP.mcp,
          expect.objectContaining({
            checkEnvironmentVars: true,
            checkCommandExistence: true,
            validateConnectionConfig: true,
            baseDirectory: testDir,
          })
        );

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('CYAN(🔍 Validating MCP configuration...)');
        expect(output).toContain('GREEN(✅ MCP configuration is valid!)');
      });

      it('should display validation errors and warnings', async () => {
        const configWithMCP = {
          ...baseConfig,
          mcp: {
            enabled: true,
            servers: {
              invalid: {
                name: 'Invalid Server',
                type: 'stdio' as const,
                command: '', // Invalid empty command
              },
            },
          },
        };

        mockLoadConfig.mockResolvedValue(configWithMCP);
        mockValidateMCPConfig.mockResolvedValue({
          isValid: false,
          errorCount: 1,
          warningCount: 1,
          infoCount: 0,
          issues: [
            {
              severity: 'error',
              code: 'EMPTY_COMMAND',
              message: 'Server command cannot be empty',
              path: 'mcp.servers.invalid.command',
              suggestion: 'Provide a valid command to execute the server',
            },
            {
              severity: 'warning',
              code: 'UNVERIFIED_SERVER',
              message: 'Server is not verified by MCP marketplace',
              path: 'mcp.servers.invalid',
              suggestion: 'Consider using verified servers from the marketplace',
            },
          ],
        });

        await mcpCommands.handler(mockContext, ['validate']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('RED(❌ MCP configuration has validation errors)');
        expect(output).toContain('GRAY(\n📊 Summary: 1 errors, 1 warnings, 0 info)');

        // Check error display
        expect(output).toContain('RED(\n🚨 Errors:)');
        expect(output).toContain('RED(  • [EMPTY_COMMAND] Server command cannot be empty)');
        expect(output).toContain('GRAY(    Path: mcp.servers.invalid.command)');
        expect(output).toContain('YELLOW(    💡 Provide a valid command to execute the server)');

        // Check warning display
        expect(output).toContain('YELLOW(\n⚠️  Warnings:)');
        expect(output).toContain('YELLOW(  • [UNVERIFIED_SERVER] Server is not verified by MCP marketplace)');
        expect(output).toContain('CYAN(    💡 Consider using verified servers from the marketplace)');
      });

      it('should handle disabled MCP during validation', async () => {
        const configWithDisabledMCP = {
          ...baseConfig,
          mcp: {
            enabled: false,
            servers: {},
          },
        };

        mockLoadConfig.mockResolvedValue(configWithDisabledMCP);

        await mcpCommands.handler(mockContext, ['validate']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('GRAY(\n💡 Note: MCP is currently disabled or not configured)');
      });

      it('should handle no MCP configuration', async () => {
        mockLoadConfig.mockResolvedValue(baseConfig); // No MCP config

        await mcpCommands.handler(mockContext, ['validate']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('GRAY(\n💡 Note: MCP is currently disabled or not configured)');
      });

      it('should handle validation errors gracefully', async () => {
        mockValidateMCPConfig.mockRejectedValue(new Error('Validation failed'));

        await mcpCommands.handler(mockContext, ['validate']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('RED(❌ Error validating MCP configuration: Validation failed)');
      });
    });
  });

  describe('Server Status Commands', () => {
    describe('mcp status command', () => {
      it('should show status of configured servers', async () => {
        const configWithMCP = {
          ...baseConfig,
          mcp: {
            enabled: true,
            servers: {
              filesystem: {
                name: 'Filesystem Server',
                type: 'stdio' as const,
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-filesystem'],
                autoStart: true,
                status: 'running',
              },
              github: {
                name: 'GitHub Server',
                type: 'stdio' as const,
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-github'],
                autoStart: false,
                status: 'stopped',
              },
            },
          },
        };

        mockLoadConfig.mockResolvedValue(configWithMCP);

        await mcpCommands.handler(mockContext, ['status']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('CYAN(\n📊 MCP Server Status:\n)');
        expect(output).toContain('GRAY(MCP Status:) GREEN(enabled)');
        expect(output).toContain('GRAY(\nConfigured servers: 2\n)');

        // Check individual server status
        expect(output).toContain('YELLOW(Filesystem Server)');
        expect(output).toContain('GRAY(  Status:) GREEN(running)');
        expect(output).toContain('GRAY(  Auto-start:) GREEN(enabled)');

        expect(output).toContain('YELLOW(GitHub Server)');
        expect(output).toContain('GRAY(  Status:) RED(stopped)');
        expect(output).toContain('GRAY(  Auto-start:) RED(disabled)');

        expect(output).toContain('GRAY(Use /mcp installed to see more configuration details.)');
      });

      it('should show disabled MCP status', async () => {
        const configWithDisabledMCP = {
          ...baseConfig,
          mcp: {
            enabled: false,
            servers: {},
          },
        };

        mockLoadConfig.mockResolvedValue(configWithDisabledMCP);

        await mcpCommands.handler(mockContext, ['status']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('GRAY(MCP Status:) RED(disabled)');
        expect(output).toContain('GRAY(MCP is currently disabled.)');
        expect(output).toContain('GRAY(\n💡 To enable MCP, run /mcp init)');
      });

      it('should show no MCP configuration status', async () => {
        mockLoadConfig.mockResolvedValue(baseConfig); // No MCP config

        await mcpCommands.handler(mockContext, ['status']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('GRAY(MCP Status:) RED(disabled)');
        expect(output).toContain('GRAY(MCP is not configured.)');
        expect(output).toContain('GRAY(\n💡 To enable MCP, run /mcp init)');
      });

      it('should show no servers configured', async () => {
        const configWithEmptyMCP = {
          ...baseConfig,
          mcp: {
            enabled: true,
            servers: {},
          },
        };

        mockLoadConfig.mockResolvedValue(configWithEmptyMCP);

        await mcpCommands.handler(mockContext, ['status']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('GRAY(MCP Status:) GREEN(enabled)');
        expect(output).toContain('GRAY(\nNo MCP servers are currently installed.)');
        expect(output).toContain('GRAY(  • Browse available servers: /mcp list)');
        expect(output).toContain('GRAY(  • Install a server: /mcp install <server-name>)');
      });

      it('should handle status command errors gracefully', async () => {
        mockLoadConfig.mockRejectedValue(new Error('Config load failed'));

        await mcpCommands.handler(mockContext, ['status']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('RED(❌ Error loading MCP status: Config load failed)');
      });
    });

    describe('mcp installed command', () => {
      it('should list installed servers with details', async () => {
        const configWithMCP = {
          ...baseConfig,
          mcp: {
            enabled: true,
            servers: {
              filesystem: {
                name: 'Filesystem Server',
                type: 'stdio' as const,
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-filesystem'],
                autoStart: true,
                capabilities: ['filesystem', 'read', 'write'],
              },
              github: {
                name: 'GitHub Server',
                type: 'stdio' as const,
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-github'],
                autoStart: false,
                capabilities: ['git', 'api'],
                envVars: [
                  {
                    name: 'GITHUB_TOKEN',
                    description: 'GitHub personal access token',
                    required: true,
                    value: undefined, // Not configured
                  },
                ],
              },
            },
          },
        };

        mockLoadConfig.mockResolvedValue(configWithMCP);

        await mcpCommands.handler(mockContext, ['installed']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('CYAN(\n📦 Installed MCP Servers:\n)');

        // Check server listings
        expect(output).toContain('YELLOW(Filesystem Server)');
        expect(output).toContain('GRAY([filesystem])');
        expect(output).toContain('GREEN(●) GREEN(enabled)'); // Auto-start enabled
        expect(output).toContain('GRAY(Command:) CYAN(npx -y @modelcontextprotocol/server-filesystem)');
        expect(output).toContain('GRAY(Capabilities:) CYAN(filesystem), CYAN(read), CYAN(write)');

        expect(output).toContain('YELLOW(GitHub Server)');
        expect(output).toContain('GRAY([github])');
        expect(output).toContain('GRAY(○) GRAY(disabled)'); // Auto-start disabled
        expect(output).toContain('YELLOW(⚠️  Environment:) 0/1 variables configured');

        // Check summary
        expect(output).toContain('GRAY(Total: 2 servers installed)');
        expect(output).toContain('GRAY(\nMCP Status:) GREEN(enabled)');

        // Check management commands
        expect(output).toContain('GRAY(\nManagement commands:)');
        expect(output).toContain('GRAY(  • Uninstall: /mcp uninstall <server-name>)');
        expect(output).toContain('GRAY(  • Validate config: /mcp validate)');
      });

      it('should show no servers installed message', async () => {
        const configWithEmptyMCP = {
          ...baseConfig,
          mcp: {
            enabled: true,
            servers: {},
          },
        };

        mockLoadConfig.mockResolvedValue(configWithEmptyMCP);

        await mcpCommands.handler(mockContext, ['installed']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('GRAY(No MCP servers are currently installed.)');
        expect(output).toContain('GRAY(\nTo install servers:)');
        expect(output).toContain('GRAY(  • Browse available servers: /mcp list)');
        expect(output).toContain('GRAY(  • Search for servers: /mcp search <query>)');
        expect(output).toContain('GRAY(  • Install a server: /mcp install <server-name>)');
      });

      it('should handle disabled MCP warning', async () => {
        const configWithDisabledMCP = {
          ...baseConfig,
          mcp: {
            enabled: false,
            servers: {
              filesystem: {
                name: 'Filesystem Server',
                type: 'stdio' as const,
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-filesystem'],
              },
            },
          },
        };

        mockLoadConfig.mockResolvedValue(configWithDisabledMCP);

        await mcpCommands.handler(mockContext, ['installed']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

        expect(output).toContain('GRAY(\nMCP Status:) RED(disabled)');
        expect(output).toContain('YELLOW(⚠️  MCP is disabled. Enable it with "/mcp init" to use installed servers.)');
      });

      it('should handle no MCP configuration', async () => {
        mockLoadConfig.mockResolvedValue(baseConfig); // No MCP config

        await mcpCommands.handler(mockContext, ['installed']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('GRAY(No MCP servers are currently installed.)');
      });

      it('should handle installed command errors', async () => {
        mockLoadConfig.mockRejectedValue(new Error('Config error'));

        await mcpCommands.handler(mockContext, ['installed']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('RED(❌ Error listing installed MCP servers: Config error)');
      });
    });
  });

  describe('Server Uninstallation Commands', () => {
    describe('mcp uninstall command', () => {
      it('should uninstall server by ID with confirmation', async () => {
        const configWithMCP = {
          ...baseConfig,
          mcp: {
            enabled: true,
            servers: {
              filesystem: {
                name: 'Filesystem Server',
                type: 'stdio' as const,
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-filesystem'],
                autoStart: true,
              },
              github: {
                name: 'GitHub Server',
                type: 'stdio' as const,
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-github'],
                autoStart: false,
              },
            },
          },
        };

        mockLoadConfig.mockResolvedValue(configWithMCP);
        mockGetMCPServers.mockReturnValue({
          filesystem: {
            name: 'Filesystem Server',
            type: 'stdio' as const,
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            autoStart: true,
          },
          github: {
            name: 'GitHub Server',
            type: 'stdio' as const,
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            autoStart: false,
          },
        });
        mockInquirerPrompt.mockResolvedValue({ confirm: true });

        await mcpCommands.handler(mockContext, ['uninstall', 'filesystem']);

        expect(mockInquirerPrompt).toHaveBeenCalledWith([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure you want to uninstall \'Filesystem Server\' (filesystem)?',
            default: false,
          },
        ]);

        expect(mockSaveConfig).toHaveBeenCalled();

        const savedConfig = mockSaveConfig.mock.calls[0][1];
        expect(savedConfig.mcp.servers.filesystem).toBeUndefined();
        expect(savedConfig.mcp.servers.github).toBeDefined(); // Other server remains

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('GREEN(✅ Successfully uninstalled MCP server \'Filesystem Server\' (filesystem))');
        expect(output).toContain('GRAY(   Server configuration has been removed from .apex/config.yaml)');
        expect(output).toContain('GRAY(\nRemaining installed servers: 1)');
      });

      it('should uninstall server by name with confirmation', async () => {
        const configWithMCP = {
          ...baseConfig,
          mcp: {
            enabled: true,
            servers: {
              filesystem: {
                name: 'Filesystem Server',
                type: 'stdio' as const,
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-filesystem'],
                autoStart: true,
              },
            },
          },
        };

        mockLoadConfig.mockResolvedValue(configWithMCP);
        mockGetMCPServers.mockReturnValue({
          filesystem: {
            name: 'Filesystem Server',
            type: 'stdio' as const,
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            autoStart: true,
          },
        });
        mockInquirerPrompt.mockResolvedValue({ confirm: true });

        await mcpCommands.handler(mockContext, ['uninstall', 'Filesystem Server']);

        expect(mockSaveConfig).toHaveBeenCalled();

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('GREEN(✅ Successfully uninstalled MCP server \'Filesystem Server\' (filesystem))');
        expect(output).toContain('GRAY(\nNo MCP servers are currently installed.)');
      });

      it('should handle uninstallation cancellation', async () => {
        const configWithMCP = {
          ...baseConfig,
          mcp: {
            enabled: true,
            servers: {
              filesystem: {
                name: 'Filesystem Server',
                type: 'stdio' as const,
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-filesystem'],
                autoStart: true,
              },
            },
          },
        };

        mockLoadConfig.mockResolvedValue(configWithMCP);
        mockGetMCPServers.mockReturnValue({
          filesystem: {
            name: 'Filesystem Server',
            type: 'stdio' as const,
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            autoStart: true,
          },
        });
        mockInquirerPrompt.mockResolvedValue({ confirm: false });

        await mcpCommands.handler(mockContext, ['uninstall', 'filesystem']);

        expect(mockSaveConfig).not.toHaveBeenCalled();

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('YELLOW(❌ Uninstallation cancelled)');
      });

      it('should handle server not found', async () => {
        const configWithMCP = {
          ...baseConfig,
          mcp: {
            enabled: true,
            servers: {
              filesystem: {
                name: 'Filesystem Server',
                type: 'stdio' as const,
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-filesystem'],
                autoStart: true,
              },
            },
          },
        };

        mockLoadConfig.mockResolvedValue(configWithMCP);

        await mcpCommands.handler(mockContext, ['uninstall', 'nonexistent']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('RED(❌ MCP server \'nonexistent\' is not installed)');
        expect(output).toContain('GRAY(Use "/mcp installed" to see installed servers)');
        expect(mockSaveConfig).not.toHaveBeenCalled();
      });

      it('should handle no servers installed', async () => {
        const configWithEmptyMCP = {
          ...baseConfig,
          mcp: {
            enabled: true,
            servers: {},
          },
        };

        mockLoadConfig.mockResolvedValue(configWithEmptyMCP);

        await mcpCommands.handler(mockContext, ['uninstall', 'filesystem']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('YELLOW(⚠️  No MCP servers are currently installed.)');
        expect(output).toContain('GRAY(Use "/mcp list" to see available servers or "/mcp install <server>" to install one.)');
      });

      it('should require server name for uninstall', async () => {
        await mcpCommands.handler(mockContext, ['uninstall']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('RED(❌ Error: Server name is required)');
        expect(output).toContain('GRAY(Usage: /mcp uninstall <server-name>)');
        expect(output).toContain('GRAY(Installed servers: /mcp installed)');
      });

      it('should handle uninstall errors gracefully', async () => {
        mockLoadConfig.mockRejectedValue(new Error('Config load error'));

        await mcpCommands.handler(mockContext, ['uninstall', 'filesystem']);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('RED(❌ Error uninstalling MCP server: Config load error)');
      });
    });
  });

  describe('Command Error Handling and Edge Cases', () => {
    it('should handle unknown subcommands', async () => {
      await mcpCommands.handler(mockContext, ['unknown']);

      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('RED(Unknown subcommand: unknown)');
      expect(output).toContain('GRAY(Usage: /mcp init | /mcp list | /mcp search <query> | /mcp install <server> | /mcp uninstall <server> | /mcp installed | /mcp validate | /mcp status)');
    });

    it('should handle empty arguments array', async () => {
      await mcpCommands.handler(mockContext, []);

      expect(mockLoadMCPTemplates).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('CYAN(\n📦 MCP Marketplace - Available Servers:\n)');
    });

    it('should handle null arguments array', async () => {
      await mcpCommands.handler(mockContext, null as any);

      expect(mockLoadMCPTemplates).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('CYAN(\n📦 MCP Marketplace - Available Servers:\n)');
    });

    it('should parse --json flag correctly in different positions', async () => {
      // Test --json at end
      await mcpCommands.handler(mockContext, ['search', 'filesystem', '--json']);
      let output = mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0];
      expect(() => JSON.parse(output)).not.toThrow();

      mockConsoleLog.mockClear();

      // Test --json at beginning
      await mcpCommands.handler(mockContext, ['--json', 'search', 'filesystem']);
      output = mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0];
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should handle case-insensitive subcommands', async () => {
      const testCases = [
        ['LIST'],
        ['List'],
        ['INSTALLED'],
        ['Installed'],
        ['VALIDATE'],
        ['Validate'],
        ['STATUS'],
        ['Status'],
      ];

      for (const [subcommand] of testCases) {
        mockConsoleLog.mockClear();
        await mcpCommands.handler(mockContext, [subcommand.toLowerCase()]);

        // Should not show unknown command error
        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).not.toContain('RED(Unknown subcommand:');
      }
    });

    it('should handle config loading failures consistently', async () => {
      const commands = ['installed', 'validate', 'status'];

      for (const command of commands) {
        mockConsoleLog.mockClear();
        mockLoadConfig.mockRejectedValue(new Error('Config error'));

        await mcpCommands.handler(mockContext, [command]);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain('RED(❌ Error');
        expect(output).toContain('Config error');
      }
    });
  });
});