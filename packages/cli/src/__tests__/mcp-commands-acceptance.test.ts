/**
 * Acceptance criteria tests for MCP list and search commands
 * Tests the specific requirements from the task description
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  };
});

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

describe('MCP Commands - Acceptance Criteria Tests', () => {
  let mockContext: CliContext;
  let mockLoadMCPTemplates: any;

  const mockTemplates: Record<string, MCPTemplate> = {
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
      },
      capabilities: ['filesystem', 'read', 'write'],
      verified: true,
      defaultEnabled: true,
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
      },
      capabilities: ['git', 'api'],
      verified: true,
      defaultEnabled: false,
    },
    database: {
      id: 'database',
      name: 'Database Server',
      description: 'Database operations server',
      package: '@test/database',
      config: {
        name: 'database',
        type: 'stdio',
        command: 'db-server',
        args: [],
      },
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

    const { loadMCPTemplates } = await import('@apexcli/core');
    mockLoadMCPTemplates = vi.mocked(loadMCPTemplates);
    mockLoadMCPTemplates.mockResolvedValue(mockTemplates);

    mockConsoleLog.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria: apex mcp list displays available marketplace servers in formatted table', () => {
    it('should display available servers in formatted table structure', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      // Verify header is displayed
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📦 Available MCP Server Templates:')
      );

      // Verify templates are displayed in table-like format
      const outputs = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // Should contain all template names
      expect(outputs).toContain('Filesystem Server');
      expect(outputs).toContain('GitHub Server');
      expect(outputs).toContain('Database Server');

      // Should contain descriptions
      expect(outputs).toContain('MCP server providing secure filesystem access');
      expect(outputs).toContain('MCP server for GitHub repository integration');
      expect(outputs).toContain('Database operations server');

      // Should show total count
      expect(outputs).toContain('Total: 3 templates available');

      // Should have formatted structure (entries start with spaces for indentation)
      const templateLines = mockConsoleLog.mock.calls
        .map(call => call[0])
        .filter(output =>
          output.includes('Filesystem Server') ||
          output.includes('GitHub Server') ||
          output.includes('Database Server')
        );

      templateLines.forEach(line => {
        expect(line).toMatch(/^\s+\w/); // Should start with spaces
      });
    });

    it('should display formatted table with proper alignment', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      const templateLines = mockConsoleLog.mock.calls
        .map(call => call[0])
        .filter(output =>
          output.includes('Filesystem Server') ||
          output.includes('GitHub Server') ||
          output.includes('Database Server')
        );

      // Verify proper spacing between name and description
      templateLines.forEach(line => {
        // Should have at least 2 spaces between name and description for table formatting
        expect(line).toMatch(/\w\s{2,}\w/);
      });
    });

    it('should handle empty marketplace gracefully', async () => {
      mockLoadMCPTemplates.mockResolvedValue({});

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith('No MCP servers found in marketplace.');
    });
  });

  describe('Acceptance Criteria: apex mcp search <query> filters and displays matching servers', () => {
    it('should filter servers based on search query', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'filesystem']);

      const outputs = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // Should display search header
      expect(outputs).toContain('🔍 Searching MCP marketplace for "filesystem"');

      // Should contain only matching result
      expect(outputs).toContain('Filesystem Server');
      expect(outputs).not.toContain('GitHub Server');
      expect(outputs).not.toContain('Database Server');
    });

    it('should search across multiple fields (name, description, capabilities)', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Search by capability
      await mcpCommand?.handler(mockContext, ['search', 'git']);

      let outputs = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(outputs).toContain('GitHub Server');

      // Search by description keyword
      mockConsoleLog.mockClear();
      await mcpCommand?.handler(mockContext, ['search', 'repository']);

      outputs = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(outputs).toContain('GitHub Server');

      // Search by partial name
      mockConsoleLog.mockClear();
      await mcpCommand?.handler(mockContext, ['search', 'Database']);

      outputs = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(outputs).toContain('Database Server');
    });

    it('should handle no search results gracefully', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'nonexistent']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No MCP servers found matching "nonexistent"')
      );

      const outputs = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(outputs).toContain('Try:');
      expect(outputs).toContain('Using broader search terms');
      expect(outputs).toContain('Running "/mcp list" to see all available servers');
    });

    it('should require search query parameter', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search']);

      expect(mockConsoleLog).toHaveBeenCalledWith('❌ Error: Search query is required');
      expect(mockConsoleLog).toHaveBeenCalledWith('Usage: /mcp search <query>');
      expect(mockConsoleLog).toHaveBeenCalledWith('Example: /mcp search filesystem');
    });

    it('should display search results with proper formatting', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'server']);

      const outputs = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // Should show helpful commands at the end
      expect(outputs).toContain('To install: /mcp install <server-name>');
      expect(outputs).toContain('To see all servers: /mcp list');
    });
  });

  describe('Acceptance Criteria: Both commands have proper error handling', () => {
    it('should handle template loading errors for list command', async () => {
      const error = new Error('Failed to load marketplace data');
      mockLoadMCPTemplates.mockRejectedValue(error);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '❌ Error loading MCP marketplace: Failed to load marketplace data'
      );
    });

    it('should handle template loading errors for search command', async () => {
      const error = new Error('Network timeout');
      mockLoadMCPTemplates.mockRejectedValue(error);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'test']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '❌ Error searching MCP marketplace: Network timeout'
      );
    });

    it('should handle malformed template data gracefully', async () => {
      // Mock templates with missing required properties
      const malformedTemplates = {
        broken: {
          id: 'broken',
          // missing name and description
          package: '@test/broken',
          config: {},
          capabilities: [],
          verified: true,
          defaultEnabled: false,
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(malformedTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Should not throw errors
      await expect(mcpCommand?.handler(mockContext, ['list'])).resolves.not.toThrow();
      await expect(mcpCommand?.handler(mockContext, ['search', 'test'])).resolves.not.toThrow();
    });
  });

  describe('Acceptance Criteria: Both commands have --json output option', () => {
    it('should support --json flag for list command', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list', '--json']);

      const outputs = mockConsoleLog.mock.calls.map(call => call[0]);
      expect(outputs).toHaveLength(1);

      // Should be valid JSON
      const jsonOutput = JSON.parse(outputs[0]);
      expect(Array.isArray(jsonOutput)).toBe(true);
      expect(jsonOutput).toHaveLength(3);

      // Should contain all templates
      const templateIds = jsonOutput.map((t: any) => t.id);
      expect(templateIds).toEqual(expect.arrayContaining(['filesystem', 'github', 'database']));
    });

    it('should support --json flag for search command', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'filesystem', '--json']);

      const outputs = mockConsoleLog.mock.calls.map(call => call[0]);
      expect(outputs).toHaveLength(1);

      // Should be valid JSON
      const jsonOutput = JSON.parse(outputs[0]);
      expect(Array.isArray(jsonOutput)).toBe(true);
      expect(jsonOutput).toHaveLength(1);
      expect(jsonOutput[0].id).toBe('filesystem');
    });

    it('should output empty array in JSON when no results', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Test list with empty templates
      mockLoadMCPTemplates.mockResolvedValue({});
      await mcpCommand?.handler(mockContext, ['list', '--json']);

      let jsonOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(jsonOutput).toEqual([]);

      // Test search with no matches
      mockLoadMCPTemplates.mockResolvedValue(mockTemplates);
      mockConsoleLog.mockClear();
      await mcpCommand?.handler(mockContext, ['search', 'nonexistent', '--json']);

      jsonOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(jsonOutput).toEqual([]);
    });

    it('should format JSON output with proper indentation', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list', '--json']);

      const jsonString = mockConsoleLog.mock.calls[0][0];

      // Should be formatted with 2-space indentation
      expect(jsonString).toContain('[\n  {\n    "');
      expect(jsonString).toContain('\n]');

      // Should be parseable
      expect(() => JSON.parse(jsonString)).not.toThrow();
    });

    it('should not output formatted text when --json flag is used', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Test list with --json
      await mcpCommand?.handler(mockContext, ['list', '--json']);

      let outputs = mockConsoleLog.mock.calls.map(call => call[0]);
      expect(outputs).toHaveLength(1);

      // Should not contain formatted headers
      expect(outputs[0]).not.toContain('📦 Available MCP Server Templates:');
      expect(outputs[0]).not.toContain('Total:');

      // Test search with --json
      mockConsoleLog.mockClear();
      await mcpCommand?.handler(mockContext, ['search', 'filesystem', '--json']);

      outputs = mockConsoleLog.mock.calls.map(call => call[0]);
      expect(outputs).toHaveLength(1);

      // Should not contain formatted search headers
      expect(outputs[0]).not.toContain('🔍 Searching MCP marketplace');
      expect(outputs[0]).not.toContain('To install:');
    });

    it('should handle --json flag in various positions', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const testCases = [
        ['list', '--json'],
        ['--json', 'list'],
        ['search', 'filesystem', '--json'],
        ['search', '--json', 'filesystem'],
        ['--json', 'search', 'filesystem'],
      ];

      for (const args of testCases) {
        mockConsoleLog.mockClear();
        await mcpCommand?.handler(mockContext, args);

        const outputs = mockConsoleLog.mock.calls.map(call => call[0]);
        expect(outputs).toHaveLength(1);

        // Should be valid JSON
        expect(() => JSON.parse(outputs[0])).not.toThrow();
        const parsed = JSON.parse(outputs[0]);
        expect(Array.isArray(parsed)).toBe(true);
      }
    });
  });

  describe('Command usage validation', () => {
    it('should include correct usage information in command definition', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      expect(mcpCommand).toBeDefined();
      expect(mcpCommand?.usage).toContain('/mcp list [--json]');
      expect(mcpCommand?.usage).toContain('/mcp search <query> [--json]');
      expect(mcpCommand?.description).toContain('MCP');
      expect(mcpCommand?.description).toContain('marketplace');
    });

    it('should handle unknown subcommands gracefully', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['unknown']);

      expect(mockConsoleLog).toHaveBeenCalledWith('Unknown subcommand: unknown');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /mcp init | /mcp list | /mcp search <query>')
      );
    });
  });

  describe('Integration with existing MCP system', () => {
    it('should use the same loadMCPTemplates function as other MCP commands', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockLoadMCPTemplates).toHaveBeenCalledWith();
      expect(mockLoadMCPTemplates).toHaveBeenCalledTimes(1);
    });

    it('should work with the existing MCP command structure', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Should be part of the commands array
      expect(mcpCommand).toBeDefined();
      expect(mcpCommand?.name).toBe('mcp');
      expect(typeof mcpCommand?.handler).toBe('function');

      // Should accept the standard context and args parameters
      await expect(mcpCommand?.handler(mockContext, ['list'])).resolves.not.toThrow();
      await expect(mcpCommand?.handler(mockContext, ['search', 'test'])).resolves.not.toThrow();
    });
  });
});