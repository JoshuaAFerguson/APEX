/**
 * Comprehensive integration tests for MCP list and search commands
 * Tests both commands together with various scenarios and edge cases
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

describe('MCP Commands Integration Tests', () => {
  let mockContext: CliContext;
  let mockLoadMCPTemplates: any;

  const comprehensiveTemplates: Record<string, MCPTemplate> = {
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
      category: 'Files',
      tags: ['filesystem', 'files', 'storage'],
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
      capabilities: ['git', 'api', 'repositories'],
      verified: true,
      defaultEnabled: false,
      category: 'Git',
      tags: ['github', 'git', 'version-control'],
    },
    slack: {
      id: 'slack',
      name: 'Slack Integration',
      description: 'Connect with Slack workspaces and channels',
      package: '@slack/mcp-server',
      config: {
        name: 'slack',
        type: 'stdio',
        command: 'npx',
        args: ['@slack/mcp-server'],
      },
      capabilities: ['messaging', 'api'],
      verified: false,
      defaultEnabled: false,
      category: 'Communication',
      tags: ['slack', 'messaging', 'collaboration'],
    },
    postgres: {
      id: 'postgres',
      name: 'PostgreSQL Database',
      description: 'PostgreSQL database integration for SQL operations',
      package: '@database/postgres-mcp',
      config: {
        name: 'postgres',
        type: 'stdio',
        command: 'postgres-mcp',
        args: ['--config', 'pg.json'],
      },
      envVars: [
        {
          name: 'DATABASE_URL',
          description: 'PostgreSQL connection string',
          required: true,
        },
      ],
      capabilities: ['database', 'sql', 'queries'],
      verified: true,
      defaultEnabled: false,
      category: 'Database',
      tags: ['postgresql', 'database', 'sql'],
    },
    'web-browser': {
      id: 'web-browser',
      name: 'Web Browser Automation',
      description: 'Automate web browser interactions and scraping',
      package: '@automation/web-browser-mcp',
      config: {
        name: 'web-browser',
        type: 'stdio',
        command: 'web-browser-mcp',
        args: ['--headless'],
      },
      capabilities: ['web', 'automation', 'scraping'],
      verified: true,
      defaultEnabled: false,
      category: 'Web',
      tags: ['browser', 'automation', 'scraping', 'selenium'],
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
    const { loadMCPTemplates } = await import('@apexcli/core');
    mockLoadMCPTemplates = vi.mocked(loadMCPTemplates);

    mockConsoleLog.mockClear();
    mockLoadMCPTemplates.mockClear();
    mockLoadMCPTemplates.mockResolvedValue(comprehensiveTemplates);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Command behavior consistency', () => {
    it('should show all templates with mcp list and filter correctly with mcp search', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Test list command
      await mcpCommand?.handler(mockContext, ['list', '--json']);
      const listOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);

      expect(listOutput).toHaveLength(5);
      const listIds = listOutput.map((t: any) => t.id).sort();
      expect(listIds).toEqual(['filesystem', 'github', 'postgres', 'slack', 'web-browser']);

      // Test search command with 'database'
      mockConsoleLog.mockClear();
      await mcpCommand?.handler(mockContext, ['search', 'database', '--json']);
      const searchOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);

      expect(searchOutput).toHaveLength(1);
      expect(searchOutput[0].id).toBe('postgres');

      // Test search command with 'server'
      mockConsoleLog.mockClear();
      await mcpCommand?.handler(mockContext, ['search', 'server', '--json']);
      const serverSearchOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);

      // Should match filesystem and github (both have "server" in description)
      expect(serverSearchOutput).toHaveLength(2);
      const serverSearchIds = serverSearchOutput.map((t: any) => t.id).sort();
      expect(serverSearchIds).toEqual(['filesystem', 'github']);
    });

    it('should maintain same template structure between list and search results', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Get template from list
      await mcpCommand?.handler(mockContext, ['list', '--json']);
      const listOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      const filesystemFromList = listOutput.find((t: any) => t.id === 'filesystem');

      // Get same template from search
      mockConsoleLog.mockClear();
      await mcpCommand?.handler(mockContext, ['search', 'filesystem', '--json']);
      const searchOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      const filesystemFromSearch = searchOutput[0];

      // Should be identical
      expect(filesystemFromList).toEqual(filesystemFromSearch);

      // Verify key properties exist
      expect(filesystemFromList).toHaveProperty('id', 'filesystem');
      expect(filesystemFromList).toHaveProperty('name', 'Filesystem Server');
      expect(filesystemFromList).toHaveProperty('config');
      expect(filesystemFromList).toHaveProperty('capabilities');
      expect(filesystemFromList).toHaveProperty('verified');
    });

    it('should handle empty results consistently', async () => {
      // Mock empty templates
      mockLoadMCPTemplates.mockResolvedValue({});

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Test list with no templates
      await mcpCommand?.handler(mockContext, ['list', '--json']);
      const listOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(listOutput).toEqual([]);

      // Test search with no templates
      mockConsoleLog.mockClear();
      await mcpCommand?.handler(mockContext, ['search', 'anything', '--json']);
      const searchOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(searchOutput).toEqual([]);
    });
  });

  describe('Flag handling consistency', () => {
    it('should handle --json flag in various positions for both commands', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const positions = [
        ['list', '--json'],
        ['--json', 'list'],
        ['search', 'git', '--json'],
        ['search', '--json', 'git'],
        ['--json', 'search', 'git'],
      ];

      for (const args of positions) {
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

    it('should not output JSON when --json flag is not present', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const nonJsonCommands = [
        ['list'],
        ['search', 'git'],
      ];

      for (const args of nonJsonCommands) {
        mockConsoleLog.mockClear();
        await mcpCommand?.handler(mockContext, args);

        const outputs = mockConsoleLog.mock.calls.map(call => call[0]);

        // Should have multiple calls for formatted output
        expect(outputs.length).toBeGreaterThan(1);

        // Combined output should not be valid JSON
        const combinedOutput = outputs.join('\n');
        expect(() => JSON.parse(combinedOutput)).toThrow();
      }
    });
  });

  describe('Error handling consistency', () => {
    it('should handle template loading errors consistently for both commands', async () => {
      const error = new Error('Network error loading templates');
      mockLoadMCPTemplates.mockRejectedValue(error);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Test list error handling
      await mcpCommand?.handler(mockContext, ['list', '--json']);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP marketplace: Network error loading templates')
      );

      // Test search error handling
      mockConsoleLog.mockClear();
      await mcpCommand?.handler(mockContext, ['search', 'test', '--json']);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error searching MCP marketplace: Network error loading templates')
      );

      // Neither should output JSON
      const allOutputs = mockConsoleLog.mock.calls.map(call => call[0]);
      allOutputs.forEach(output => {
        expect(() => JSON.parse(output)).toThrow();
      });
    });

    it('should handle missing query in search command properly', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const missingQueryCases = [
        ['search'],
        ['search', '--json'],
        ['--json', 'search'],
      ];

      for (const args of missingQueryCases) {
        mockConsoleLog.mockClear();
        await mcpCommand?.handler(mockContext, args);

        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('❌ Error: Search query is required')
        );
      }
    });
  });

  describe('Search functionality completeness', () => {
    it('should search across all searchable fields consistently', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const searchTests = [
        { query: 'filesystem', expectedIds: ['filesystem'] }, // name match
        { query: 'PostgreSQL', expectedIds: ['postgres'] }, // description match
        { query: 'Git', expectedIds: ['github'] }, // category match
        { query: 'selenium', expectedIds: ['web-browser'] }, // tag match
        { query: 'api', expectedIds: ['github', 'slack'] }, // capability match
        { query: 'MCP', expectedIds: ['filesystem', 'github'] }, // description contains "MCP server"
      ];

      for (const test of searchTests) {
        mockConsoleLog.mockClear();
        await mcpCommand?.handler(mockContext, ['search', test.query, '--json']);

        const searchOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
        const resultIds = searchOutput.map((t: any) => t.id).sort();

        expect(resultIds).toEqual(test.expectedIds.sort());
      }
    });

    it('should handle case-insensitive searches properly', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const caseVariations = [
        'GITHUB',
        'github',
        'GitHub',
        'GitHuB',
        'gItHuB',
      ];

      for (const variation of caseVariations) {
        mockConsoleLog.mockClear();
        await mcpCommand?.handler(mockContext, ['search', variation, '--json']);

        const searchOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
        expect(searchOutput).toHaveLength(1);
        expect(searchOutput[0].id).toBe('github');
      }
    });
  });

  describe('Data integrity and validation', () => {
    it('should validate that all list results have required properties', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list', '--json']);
      const listOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);

      listOutput.forEach((template: any) => {
        // Required properties
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('package');
        expect(template).toHaveProperty('config');
        expect(template).toHaveProperty('capabilities');
        expect(template).toHaveProperty('verified');
        expect(template).toHaveProperty('defaultEnabled');

        // Types validation
        expect(typeof template.id).toBe('string');
        expect(typeof template.name).toBe('string');
        expect(typeof template.description).toBe('string');
        expect(typeof template.package).toBe('string');
        expect(typeof template.config).toBe('object');
        expect(Array.isArray(template.capabilities)).toBe(true);
        expect(typeof template.verified).toBe('boolean');
        expect(typeof template.defaultEnabled).toBe('boolean');
      });
    });

    it('should validate that search results maintain data consistency', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'server', '--json']);
      const searchOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);

      searchOutput.forEach((template: any) => {
        // Should contain the search term in at least one searchable field
        const searchTerm = 'server';
        const searchableText = [
          template.name,
          template.description,
          template.category,
          ...(template.tags || []),
          ...(template.capabilities || []),
        ].join(' ').toLowerCase();

        expect(searchableText).toContain(searchTerm);
      });
    });

    it('should maintain sorting consistency between commands', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Get all templates from list
      await mcpCommand?.handler(mockContext, ['list', '--json']);
      const listOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);

      // Get all templates from search that matches everything
      mockConsoleLog.mockClear();
      await mcpCommand?.handler(mockContext, ['search', 'MCP', '--json']);
      const searchOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);

      // Both should be sorted alphabetically by name
      const listNames = listOutput.map((t: any) => t.name);
      const searchNames = searchOutput.map((t: any) => t.name);

      const sortedListNames = [...listNames].sort();
      const sortedSearchNames = [...searchNames].sort();

      expect(listNames).toEqual(sortedListNames);
      expect(searchNames).toEqual(sortedSearchNames);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle templates with missing optional properties', async () => {
      const templatesWithMissingProps = {
        minimal: {
          id: 'minimal',
          name: 'Minimal Template',
          description: 'Template with minimal properties',
          package: '@test/minimal',
          config: {},
          capabilities: [],
          verified: true,
          defaultEnabled: false,
          // Missing: category, tags, documentationUrl, envVars
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(templatesWithMissingProps);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Test list
      await expect(mcpCommand?.handler(mockContext, ['list', '--json'])).resolves.not.toThrow();
      const listOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(listOutput).toHaveLength(1);

      // Test search
      mockConsoleLog.mockClear();
      await expect(mcpCommand?.handler(mockContext, ['search', 'minimal', '--json'])).resolves.not.toThrow();
      const searchOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(searchOutput).toHaveLength(1);
    });

    it('should handle templates with empty arrays and strings', async () => {
      const templatesWithEmptyValues = {
        empty: {
          id: 'empty',
          name: '',
          description: '',
          package: '@test/empty',
          config: {},
          capabilities: [],
          verified: false,
          defaultEnabled: false,
          category: '',
          tags: [],
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(templatesWithEmptyValues);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await expect(mcpCommand?.handler(mockContext, ['list', '--json'])).resolves.not.toThrow();
      await expect(mcpCommand?.handler(mockContext, ['search', 'empty', '--json'])).resolves.not.toThrow();
    });
  });
});