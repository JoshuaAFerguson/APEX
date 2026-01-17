/**
 * Unit and integration tests for /mcp command in CLI mode
 * Tests the MCP template listing functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import type { CliContext } from '../index.js';
import type { MCPTemplate } from '@apexcli/core';

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

describe('MCP Command', () => {
  let mockContext: CliContext;
  let mockLoadMCPTemplates: any;
  let mockGetMCPTemplate: any;
  let mockLoadConfig: any;
  let mockSaveConfig: any;

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
        },
      ],
      capabilities: ['database', 'sql'],
      verified: false,
      defaultEnabled: false,
    },
  };

  beforeEach(async () => {
    mockContext = {
      cwd: '/test/project',
      initialized: true,
      config: {
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
      },
    };

    // Get the mocked functions
    const { loadMCPTemplates, getMCPTemplate, loadConfig, saveConfig } = await import('@apexcli/core');
    mockLoadMCPTemplates = vi.mocked(loadMCPTemplates);
    mockGetMCPTemplate = vi.mocked(getMCPTemplate);
    mockLoadConfig = vi.mocked(loadConfig);
    mockSaveConfig = vi.mocked(saveConfig);

    mockConsoleLog.mockClear();
    mockLoadMCPTemplates.mockClear();
    mockGetMCPTemplate.mockClear();
    mockLoadConfig.mockClear();
    mockSaveConfig.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Command registration and recognition', () => {
    it('should have mcp command registered with correct properties', async () => {
      const { commands } = await import('../index.js');

      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      expect(mcpCommand).toBeDefined();
      expect(mcpCommand?.name).toBe('mcp');
      expect(mcpCommand?.aliases).toEqual([]);
      expect(mcpCommand?.description).toBe('Manage MCP (Model Context Protocol) server templates');
      expect(mcpCommand?.usage).toBe('/mcp list | /mcp add <server-name>');
    });

    it('should have proper handler function signature', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      expect(mcpCommand?.handler).toBeTypeOf('function');
      expect(mcpCommand?.handler.length).toBe(2); // (ctx, args) parameters
    });
  });

  describe('MCP list command functionality', () => {
    it('should display templates when list subcommand is used', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockLoadMCPTemplates).toHaveBeenCalledOnce();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📦 Available MCP Server Templates:')
      );

      // Should display each template
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Filesystem Server')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GitHub Server')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('PostgreSQL Server')
      );
    });

    it('should default to list when no subcommand is provided', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, []);

      expect(mockLoadMCPTemplates).toHaveBeenCalledOnce();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📦 Available MCP Server Templates:')
      );
    });

    it('should handle empty templates gracefully', async () => {
      mockLoadMCPTemplates.mockResolvedValue({});

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockLoadMCPTemplates).toHaveBeenCalledOnce();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No MCP templates found')
      );
    });

    it('should display template details correctly', async () => {
      const singleTemplate = {
        filesystem: sampleTemplates.filesystem,
      };
      mockLoadMCPTemplates.mockResolvedValue(singleTemplate);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      // Check that all template details are displayed
      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');

      expect(allOutput).toContain('Filesystem Server');
      expect(allOutput).toContain('MCP server providing secure filesystem access');
      expect(allOutput).toContain('@modelcontextprotocol/server-filesystem');
      expect(allOutput).toContain('Verified');
      expect(allOutput).toContain('filesystem, read, write');
    });

    it('should format template output properly with alignment', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      // Should calculate max name length for formatting
      const outputs = mockConsoleLog.mock.calls.map(call => call[0]);
      const templateOutputs = outputs.filter(output =>
        output.includes('Filesystem Server') ||
        output.includes('GitHub Server') ||
        output.includes('PostgreSQL Server')
      );

      // All template entries should have consistent formatting
      expect(templateOutputs.length).toBe(3);
    });

    it('should handle templates with different verification status', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');

      // Should show verified status appropriately
      expect(allOutput).toContain('Verified'); // For verified templates
      expect(allOutput).toContain('Unverified'); // For unverified templates
    });

    it('should display environment variables when present', async () => {
      const templatesWithEnv = {
        github: sampleTemplates.github,
      };
      mockLoadMCPTemplates.mockResolvedValue(templatesWithEnv);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');
      expect(allOutput).toContain('Env: GITHUB_TOKEN');
    });
  });

  describe('Error handling', () => {
    it('should handle loadMCPTemplates error gracefully', async () => {
      const errorMessage = 'Templates directory not found';
      mockLoadMCPTemplates.mockRejectedValue(new Error(errorMessage));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP templates')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(errorMessage)
      );
    });

    it('should handle unknown subcommands', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['unknown']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Unknown subcommand: unknown')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /mcp list | /mcp add <server-name>')
      );
    });

    it('should handle templates loading timeout gracefully', async () => {
      mockLoadMCPTemplates.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 0)
        )
      );

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP templates')
      );
    });

    it('should handle malformed template data', async () => {
      mockLoadMCPTemplates.mockRejectedValue(new Error('Failed to parse MCP template invalid.yaml: Invalid YAML syntax'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP templates')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Invalid YAML syntax')
      );
    });
  });

  describe('Edge cases and argument handling', () => {
    it('should handle null arguments gracefully', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, null as any);

      // Should default to list behavior
      expect(mockLoadMCPTemplates).toHaveBeenCalledOnce();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📦 Available MCP Server Templates:')
      );
    });

    it('should handle undefined arguments', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, undefined as any);

      // Should default to list behavior
      expect(mockLoadMCPTemplates).toHaveBeenCalledOnce();
    });

    it('should handle case-insensitive subcommands', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Test different cases
      const testCases = ['LIST', 'List', 'LiSt'];

      for (const testCase of testCases) {
        mockConsoleLog.mockClear();
        mockLoadMCPTemplates.mockClear();

        await mcpCommand?.handler(mockContext, [testCase]);

        expect(mockLoadMCPTemplates).toHaveBeenCalledOnce();
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('📦 Available MCP Server Templates:')
        );
      }
    });

    it('should handle multiple arguments gracefully', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['unknown', 'extra', 'args']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Unknown subcommand: unknown')
      );
    });

    it('should handle empty string subcommand', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['']);

      // Should default to list behavior for empty string
      expect(mockLoadMCPTemplates).toHaveBeenCalledOnce();
    });
  });

  describe('Performance and efficiency', () => {
    it('should execute quickly for list command', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const start = performance.now();
      await mcpCommand?.handler(mockContext, ['list']);
      const end = performance.now();

      expect(end - start).toBeLessThan(100); // Should be reasonably fast
    });

    it('should handle large numbers of templates efficiently', async () => {
      // Create many templates
      const manyTemplates: Record<string, MCPTemplate> = {};
      for (let i = 0; i < 100; i++) {
        manyTemplates[`template${i}`] = {
          id: `template${i}`,
          name: `Template ${i}`,
          description: `Description for template ${i}`,
          package: `@test/template${i}`,
          config: {},
          capabilities: [`cap${i}`],
          verified: i % 2 === 0,
          defaultEnabled: false,
        };
      }

      mockLoadMCPTemplates.mockResolvedValue(manyTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const start = performance.now();
      await mcpCommand?.handler(mockContext, ['list']);
      const end = performance.now();

      expect(end - start).toBeLessThan(500); // Should handle large lists efficiently
      expect(mockConsoleLog).toHaveBeenCalledTimes(101); // Header + 100 templates
    });

    it('should not leak memory on repeated calls', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Call command many times
      for (let i = 0; i < 10; i++) {
        mockConsoleLog.mockClear();
        await mcpCommand?.handler(mockContext, ['list']);
      }

      // Should complete without issues
      expect(mockLoadMCPTemplates).toHaveBeenCalledTimes(10);
    });
  });

  describe('Output formatting and consistency', () => {
    it('should use emojis consistently', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      // Check for consistent emoji usage
      const headerCall = mockConsoleLog.mock.calls.find(call =>
        call[0].includes('📦 Available MCP Server Templates')
      );
      expect(headerCall).toBeDefined();

      // Check for verification emojis
      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');
      expect(allOutput).toContain('✅'); // Verified
      expect(allOutput).toContain('⚠️'); // Unverified
    });

    it('should maintain consistent spacing and alignment', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      // Check that template entries have consistent structure
      const templateLines = mockConsoleLog.mock.calls
        .map(call => call[0])
        .filter(output => output.includes(' - ') && !output.includes('📦'));

      expect(templateLines.length).toBe(3); // Three templates

      // All should follow similar pattern
      templateLines.forEach(line => {
        expect(line).toMatch(/^\s*\w+.*-.*$/); // Basic format check
      });
    });

    it('should handle unicode characters in template names/descriptions', async () => {
      const unicodeTemplates = {
        unicode: {
          id: 'unicode',
          name: 'Unicode 测试 Template 🚀',
          description: 'A template with émojis and ñon-ASCII characters',
          package: '@test/unicode',
          config: {},
          capabilities: ['unicode'],
          verified: true,
          defaultEnabled: false,
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(unicodeTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');
      expect(allOutput).toContain('Unicode 测试 Template 🚀');
      expect(allOutput).toContain('émojis and ñon-ASCII');
    });
  });

  describe('Integration with CLI framework', () => {
    it('should be properly integrated in commands array', async () => {
      const { commands } = await import('../index.js');

      expect(commands).toContainEqual(
        expect.objectContaining({
          name: 'mcp',
          description: 'Manage MCP (Model Context Protocol) server templates',
        })
      );
    });

    it('should not interfere with other commands', async () => {
      const { commands } = await import('../index.js');

      // Check that mcp command doesn't break other commands
      expect(commands.length).toBeGreaterThan(1);

      // Should have other essential commands
      const commandNames = commands.map(cmd => cmd.name);
      expect(commandNames).toContain('version');
      expect(commandNames).toContain('help');
    });

    it('should maintain proper command ordering', async () => {
      const { commands } = await import('../index.js');
      const mcpIndex = commands.findIndex(cmd => cmd.name === 'mcp');

      expect(mcpIndex).toBeGreaterThan(-1);

      // Should be positioned logically among other commands
      expect(mcpIndex).toBeLessThan(commands.length);
    });
  });

  describe('MCP add command functionality', () => {
    beforeEach(() => {
      // Setup default config for add tests
      mockLoadConfig.mockResolvedValue({
        ...mockContext.config,
        mcp: { servers: {} }
      });
      mockSaveConfig.mockResolvedValue(undefined);
    });

    it('should successfully add a valid MCP server', async () => {
      const template = sampleTemplates.filesystem;
      mockGetMCPTemplate.mockResolvedValue(template);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'filesystem']);

      expect(mockGetMCPTemplate).toHaveBeenCalledWith('filesystem');
      expect(mockLoadConfig).toHaveBeenCalledWith(mockContext.cwd);
      expect(mockSaveConfig).toHaveBeenCalledWith(mockContext.cwd, expect.objectContaining({
        mcp: {
          servers: {
            filesystem: expect.objectContaining({
              name: 'Filesystem Server',
              type: 'stdio',
              command: 'npx',
              autoStart: true,
            })
          }
        }
      }));

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ Successfully added MCP server \'Filesystem Server\' (filesystem)')
      );
    });

    it('should handle missing server name', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: Server name is required')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /mcp add <server-name>')
      );
    });

    it('should handle invalid template', async () => {
      mockGetMCPTemplate.mockResolvedValue(null);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'invalid-template']);

      expect(mockGetMCPTemplate).toHaveBeenCalledWith('invalid-template');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: Template \'invalid-template\' not found')
      );
    });

    it('should handle duplicate server', async () => {
      const template = sampleTemplates.filesystem;
      mockGetMCPTemplate.mockResolvedValue(template);
      mockLoadConfig.mockResolvedValue({
        ...mockContext.config,
        mcp: {
          servers: {
            filesystem: { name: 'Existing Server' }
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

    it('should properly handle environment variables', async () => {
      const template = sampleTemplates.github;
      mockGetMCPTemplate.mockResolvedValue(template);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'github']);

      expect(mockSaveConfig).toHaveBeenCalledWith(mockContext.cwd, expect.objectContaining({
        mcp: {
          servers: {
            github: expect.objectContaining({
              name: 'GitHub Server',
              envVars: expect.arrayContaining([
                expect.objectContaining({
                  name: 'GITHUB_TOKEN',
                  description: 'GitHub personal access token',
                  required: true,
                  value: undefined, // Should be undefined for sensitive vars
                })
              ])
            })
          }
        }
      }));

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📝 Configuration Notes:')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GITHUB_TOKEN')
      );
    });

    it('should handle errors during template loading', async () => {
      mockGetMCPTemplate.mockRejectedValue(new Error('Template file not readable'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error adding MCP server: Template file not readable')
      );
    });

    it('should handle errors during config saving', async () => {
      const template = sampleTemplates.filesystem;
      mockGetMCPTemplate.mockResolvedValue(template);
      mockSaveConfig.mockRejectedValue(new Error('Failed to write config file'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error adding MCP server: Failed to write config file')
      );
    });

    it('should include documentation URL when available', async () => {
      const template = sampleTemplates.filesystem;
      mockGetMCPTemplate.mockResolvedValue(template);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Documentation: https://modelcontextprotocol.io/servers/filesystem')
      );
    });
  });
});