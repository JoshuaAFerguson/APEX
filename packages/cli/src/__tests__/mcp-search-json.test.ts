/**
 * Tests for MCP search command with --json output option
 * Testing the implementation of --json flag for apex mcp search
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

describe('MCP Search Command - JSON Output Tests', () => {
  let mockContext: CliContext;
  let mockLoadMCPTemplates: any;

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
      category: 'Files',
      tags: ['filesystem', 'files', 'storage'],
    },
    github: {
      id: 'github',
      name: 'GitHub Server',
      description: 'MCP server for GitHub repository integration and git operations',
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
    database: {
      id: 'database',
      name: 'Database Server',
      description: 'MCP server for SQL database operations and queries',
      package: '@test/database-server',
      config: {
        name: 'database',
        type: 'stdio',
        command: 'test-db',
        args: ['--config', 'db.json'],
      },
      capabilities: ['database', 'sql', 'queries'],
      verified: false,
      defaultEnabled: false,
      category: 'Database',
      tags: ['database', 'sql', 'mysql', 'postgresql'],
    },
    web: {
      id: 'web',
      name: 'Web Scraper',
      description: 'Web scraping server for fetching web content',
      package: '@test/web-server',
      config: {
        name: 'web',
        type: 'stdio',
        command: 'web-scraper',
        args: [],
      },
      capabilities: ['web', 'scraping', 'http'],
      verified: true,
      defaultEnabled: false,
      category: 'Web',
      tags: ['web', 'scraping', 'http', 'browser'],
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
    mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('JSON output functionality', () => {
    it('should output valid JSON when --json flag is provided with search results', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'filesystem', '--json']);

      expect(mockLoadMCPTemplates).toHaveBeenCalledOnce();

      // Should output only JSON, no formatted text
      const outputs = mockConsoleLog.mock.calls.map(call => call[0]);
      expect(outputs).toHaveLength(1);

      const jsonOutput = outputs[0];
      let parsedJson;

      expect(() => {
        parsedJson = JSON.parse(jsonOutput);
      }).not.toThrow();

      // Verify JSON structure
      expect(Array.isArray(parsedJson)).toBe(true);
      expect(parsedJson).toHaveLength(1); // Only filesystem should match

      // Verify the matching template is included
      expect(parsedJson[0]).toMatchObject({
        id: 'filesystem',
        name: 'Filesystem Server',
        description: 'MCP server providing secure filesystem access',
      });
    });

    it('should include all properties of matching templates in JSON output', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'git', '--json']);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);

      expect(parsedJson).toHaveLength(1);
      const githubTemplate = parsedJson[0];

      // Verify all expected properties are present
      expect(githubTemplate).toMatchObject({
        id: 'github',
        name: 'GitHub Server',
        description: 'MCP server for GitHub repository integration and git operations',
        package: '@modelcontextprotocol/server-github',
        capabilities: ['git', 'api', 'repositories'],
        verified: true,
        defaultEnabled: false,
        category: 'Git',
        tags: ['github', 'git', 'version-control'],
        envVars: [
          {
            name: 'GITHUB_TOKEN',
            description: 'GitHub personal access token',
            required: true,
          },
        ],
        config: {
          name: 'github',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          autoStart: false,
        },
      });
    });

    it('should return empty array JSON when no search results found', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'nonexistent-query', '--json']);

      const outputs = mockConsoleLog.mock.calls.map(call => call[0]);
      expect(outputs).toHaveLength(1);

      const jsonOutput = outputs[0];
      expect(JSON.parse(jsonOutput)).toEqual([]);
    });

    it('should format JSON with proper indentation', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'filesystem', '--json']);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];

      // Should be formatted with 2-space indentation
      expect(jsonOutput).toContain('[\n  {\n    "');
      expect(jsonOutput).toContain('\n]');
    });

    it('should handle --json flag in different positions with search', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Test --json at the end
      mockConsoleLog.mockClear();
      await mcpCommand?.handler(mockContext, ['search', 'database', '--json']);

      let jsonOutput = mockConsoleLog.mock.calls[0][0];
      let parsedJson = JSON.parse(jsonOutput);
      expect(Array.isArray(parsedJson)).toBe(true);
      expect(parsedJson).toHaveLength(1);

      // Test --json in the middle
      mockConsoleLog.mockClear();
      await mcpCommand?.handler(mockContext, ['search', '--json', 'database']);

      jsonOutput = mockConsoleLog.mock.calls[0][0];
      parsedJson = JSON.parse(jsonOutput);
      expect(Array.isArray(parsedJson)).toBe(true);
      expect(parsedJson).toHaveLength(1);
    });

    it('should preserve search result ranking in JSON output', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Search for "server" which should match multiple results
      await mcpCommand?.handler(mockContext, ['search', 'server', '--json']);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);

      expect(parsedJson.length).toBeGreaterThan(1);

      // Results should be sorted alphabetically for consistency
      const names = parsedJson.map((t: any) => t.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });
  });

  describe('Search functionality with various query types', () => {
    it('should search by name and return JSON results', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'GitHub', '--json']);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);

      expect(parsedJson).toHaveLength(1);
      expect(parsedJson[0].name).toBe('GitHub Server');
    });

    it('should search by description and return JSON results', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'scraping', '--json']);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);

      expect(parsedJson).toHaveLength(1);
      expect(parsedJson[0].id).toBe('web');
    });

    it('should search by category and return JSON results', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'Files', '--json']);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);

      expect(parsedJson).toHaveLength(1);
      expect(parsedJson[0].category).toBe('Files');
    });

    it('should search by tags and return JSON results', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'postgresql', '--json']);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);

      expect(parsedJson).toHaveLength(1);
      expect(parsedJson[0].tags).toContain('postgresql');
    });

    it('should search by capabilities and return JSON results', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'api', '--json']);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);

      expect(parsedJson).toHaveLength(1);
      expect(parsedJson[0].capabilities).toContain('api');
    });

    it('should handle case-insensitive search in JSON output', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Test with different cases
      const testCases = ['FILESYSTEM', 'filesystem', 'FileSystem', 'FileSYSTEM'];

      for (const testCase of testCases) {
        mockConsoleLog.mockClear();
        await mcpCommand?.handler(mockContext, ['search', testCase, '--json']);

        const jsonOutput = mockConsoleLog.mock.calls[0][0];
        const parsedJson = JSON.parse(jsonOutput);

        expect(parsedJson).toHaveLength(1);
        expect(parsedJson[0].id).toBe('filesystem');
      }
    });

    it('should return multiple matching results in JSON', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Search for "MCP" which appears in multiple descriptions
      await mcpCommand?.handler(mockContext, ['search', 'MCP', '--json']);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);

      expect(parsedJson.length).toBeGreaterThan(1);

      // All results should contain "MCP" in description
      parsedJson.forEach((template: any) => {
        expect(template.description.toLowerCase()).toContain('mcp');
      });
    });
  });

  describe('Regular output behavior (without --json)', () => {
    it('should display formatted text output when --json flag is not provided', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'filesystem']);

      // Should not output JSON
      const outputs = mockConsoleLog.mock.calls.map(call => call[0]);

      // Should have multiple calls for formatted output
      expect(outputs.length).toBeGreaterThan(1);

      // Should contain search header
      expect(outputs.some(output => output.includes('🔍 Searching MCP marketplace'))).toBe(true);

      // Should contain template name
      expect(outputs.some(output => output.includes('Filesystem Server'))).toBe(true);

      // Should not be valid JSON
      const combinedOutput = outputs.join('\n');
      expect(() => JSON.parse(combinedOutput)).toThrow();
    });

    it('should display empty message when no search results and no --json flag', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'nonexistent']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No MCP servers found matching "nonexistent"')
      );
    });
  });

  describe('Error handling', () => {
    it('should require search query even with --json flag', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', '--json']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: Search query is required')
      );

      // Should not output JSON when there's an error
      const outputs = mockConsoleLog.mock.calls.map(call => call[0]);
      const hasJsonOutput = outputs.some(output => {
        try {
          JSON.parse(output);
          return true;
        } catch {
          return false;
        }
      });
      expect(hasJsonOutput).toBe(false);
    });

    it('should handle loadMCPTemplates error and not output JSON', async () => {
      const error = new Error('Failed to load templates');
      mockLoadMCPTemplates.mockRejectedValue(error);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'filesystem', '--json']);

      // Should output error message, not JSON
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error searching MCP marketplace: Failed to load templates')
      );

      // Should not output JSON
      const outputs = mockConsoleLog.mock.calls.map(call => call[0]);
      const hasJsonOutput = outputs.some(output => {
        try {
          JSON.parse(output);
          return true;
        } catch {
          return false;
        }
      });
      expect(hasJsonOutput).toBe(false);
    });

    it('should handle empty query string with --json', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', '', '--json']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: Search query is required')
      );
    });

    it('should handle whitespace-only query with --json', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', '   ', '--json']);

      // Should return empty results as whitespace query won't match anything
      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);
      expect(parsedJson).toEqual([]);
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle search with many templates efficiently', async () => {
      const manyTemplates: Record<string, MCPTemplate> = {};
      for (let i = 0; i < 100; i++) {
        manyTemplates[`template-${i}`] = {
          id: `template-${i}`,
          name: `Template ${i}`,
          description: `Description for template ${i} server functionality`,
          package: `@test/template-${i}`,
          config: {},
          capabilities: [`capability-${i}`],
          verified: i % 2 === 0,
          defaultEnabled: false,
        };
      }

      mockLoadMCPTemplates.mockResolvedValue(manyTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const start = performance.now();
      await mcpCommand?.handler(mockContext, ['search', 'server', '--json']);
      const end = performance.now();

      expect(end - start).toBeLessThan(200); // Should be fast

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);

      // Should match all templates (they all have "server" in description)
      expect(parsedJson).toHaveLength(100);
    });

    it('should handle special characters in search query with JSON output', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const specialQueries = ['@test', 'sql-', 'web/scraper', 'MCP.server'];

      for (const query of specialQueries) {
        mockConsoleLog.mockClear();
        await mcpCommand?.handler(mockContext, ['search', query, '--json']);

        const jsonOutput = mockConsoleLog.mock.calls[0][0];
        let parsedJson;

        expect(() => {
          parsedJson = JSON.parse(jsonOutput);
        }).not.toThrow();

        expect(Array.isArray(parsedJson)).toBe(true);
      }
    });

    it('should handle very long search queries with JSON output', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const longQuery = 'filesystem server providing secure access to files and directories with read write capabilities';

      await mcpCommand?.handler(mockContext, ['search', longQuery, '--json']);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);

      expect(Array.isArray(parsedJson)).toBe(true);
      // Might match filesystem server due to overlapping words
      if (parsedJson.length > 0) {
        expect(parsedJson[0]).toHaveProperty('id');
        expect(parsedJson[0]).toHaveProperty('name');
      }
    });

    it('should handle Unicode characters in search query with JSON output', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const unicodeQueries = ['filesystem 🗂️', 'データベース', 'файловая система'];

      for (const query of unicodeQueries) {
        mockConsoleLog.mockClear();
        await mcpCommand?.handler(mockContext, ['search', query, '--json']);

        const jsonOutput = mockConsoleLog.mock.calls[0][0];
        let parsedJson;

        expect(() => {
          parsedJson = JSON.parse(jsonOutput);
        }).not.toThrow();

        expect(Array.isArray(parsedJson)).toBe(true);
      }
    });
  });
});