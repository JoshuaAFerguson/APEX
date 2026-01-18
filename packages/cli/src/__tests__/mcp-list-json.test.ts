/**
 * Tests for MCP list command with --json output option
 * Testing the implementation of --json flag for apex mcp list
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

describe('MCP List Command - JSON Output Tests', () => {
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
      tags: ['filesystem', 'files'],
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
      category: 'Git',
      tags: ['github', 'git'],
    },
    database: {
      id: 'database',
      name: 'Database Server',
      description: 'MCP server for database operations',
      package: '@test/database-server',
      config: {
        name: 'database',
        type: 'stdio',
        command: 'test-db',
        args: ['--config', 'db.json'],
      },
      capabilities: ['database', 'sql'],
      verified: false,
      defaultEnabled: false,
      category: 'Database',
      tags: ['database', 'sql'],
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('JSON output functionality', () => {
    it('should output valid JSON when --json flag is provided', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list', '--json']);

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
      expect(parsedJson).toHaveLength(3);

      // Verify all templates are included
      const templateIds = parsedJson.map((t: any) => t.id);
      expect(templateIds).toEqual(expect.arrayContaining(['filesystem', 'github', 'database']));
    });

    it('should include all template properties in JSON output', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list', '--json']);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);

      const filesystemTemplate = parsedJson.find((t: any) => t.id === 'filesystem');

      // Verify all expected properties are present
      expect(filesystemTemplate).toMatchObject({
        id: 'filesystem',
        name: 'Filesystem Server',
        description: 'MCP server providing secure filesystem access',
        package: '@modelcontextprotocol/server-filesystem',
        capabilities: ['filesystem', 'read', 'write'],
        verified: true,
        defaultEnabled: true,
        documentationUrl: 'https://modelcontextprotocol.io/servers/filesystem',
        category: 'Files',
        tags: ['filesystem', 'files'],
        config: {
          name: 'filesystem',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          autoStart: true,
        },
      });
    });

    it('should handle envVars in JSON output correctly', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list', '--json']);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);

      const githubTemplate = parsedJson.find((t: any) => t.id === 'github');

      expect(githubTemplate.envVars).toEqual([
        {
          name: 'GITHUB_TOKEN',
          description: 'GitHub personal access token',
          required: true,
        },
      ]);
    });

    it('should preserve alphabetical sorting in JSON output', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list', '--json']);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);

      const names = parsedJson.map((t: any) => t.name);
      const sortedNames = [...names].sort();

      expect(names).toEqual(sortedNames);
    });

    it('should return empty array JSON when no templates exist', async () => {
      mockLoadMCPTemplates.mockResolvedValue({});

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list', '--json']);

      const outputs = mockConsoleLog.mock.calls.map(call => call[0]);
      expect(outputs).toHaveLength(1);

      const jsonOutput = outputs[0];
      expect(JSON.parse(jsonOutput)).toEqual([]);
    });

    it('should format JSON with proper indentation', async () => {
      mockLoadMCPTemplates.mockResolvedValue({
        test: {
          id: 'test',
          name: 'Test Server',
          description: 'A test server',
          package: '@test/server',
          config: {},
          capabilities: ['test'],
          verified: true,
          defaultEnabled: false,
        },
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list', '--json']);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];

      // Should be formatted with 2-space indentation
      expect(jsonOutput).toContain('[\n  {\n    "');
      expect(jsonOutput).toContain('\n]');
    });

    it('should handle --json flag in different positions', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Test --json at the end
      mockConsoleLog.mockClear();
      await mcpCommand?.handler(mockContext, ['list', '--json']);

      let jsonOutput = mockConsoleLog.mock.calls[0][0];
      let parsedJson = JSON.parse(jsonOutput);
      expect(Array.isArray(parsedJson)).toBe(true);

      // Test --json at the beginning
      mockConsoleLog.mockClear();
      await mcpCommand?.handler(mockContext, ['--json', 'list']);

      jsonOutput = mockConsoleLog.mock.calls[0][0];
      parsedJson = JSON.parse(jsonOutput);
      expect(Array.isArray(parsedJson)).toBe(true);

      // Test no subcommand with --json (defaults to list)
      mockConsoleLog.mockClear();
      await mcpCommand?.handler(mockContext, ['--json']);

      jsonOutput = mockConsoleLog.mock.calls[0][0];
      parsedJson = JSON.parse(jsonOutput);
      expect(Array.isArray(parsedJson)).toBe(true);
    });
  });

  describe('Regular output behavior (without --json)', () => {
    it('should display formatted text output when --json flag is not provided', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      // Should not output JSON
      const outputs = mockConsoleLog.mock.calls.map(call => call[0]);

      // Should have multiple calls for formatted output
      expect(outputs.length).toBeGreaterThan(1);

      // Should contain header
      expect(outputs.some(output => output.includes('📦 Available MCP Server Templates:'))).toBe(true);

      // Should contain template names
      expect(outputs.some(output => output.includes('Filesystem Server'))).toBe(true);
      expect(outputs.some(output => output.includes('GitHub Server'))).toBe(true);
      expect(outputs.some(output => output.includes('Database Server'))).toBe(true);

      // Should not be valid JSON
      const combinedOutput = outputs.join('\n');
      expect(() => JSON.parse(combinedOutput)).toThrow();
    });

    it('should display empty message when no templates and no --json flag', async () => {
      mockLoadMCPTemplates.mockResolvedValue({});

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith('No MCP servers found in marketplace.');
    });
  });

  describe('Error handling with JSON output', () => {
    it('should handle loadMCPTemplates error and not output JSON', async () => {
      const error = new Error('Failed to load templates');
      mockLoadMCPTemplates.mockRejectedValue(error);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list', '--json']);

      // Should output error message, not JSON
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP marketplace: Failed to load templates')
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
  });

  describe('Template properties validation', () => {
    it('should handle templates with minimal properties in JSON output', async () => {
      const minimalTemplate = {
        minimal: {
          id: 'minimal',
          name: 'Minimal Template',
          description: 'Minimal description',
          package: '@test/minimal',
          config: {},
          capabilities: [],
          verified: false,
          defaultEnabled: false,
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(minimalTemplate);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list', '--json']);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);

      expect(parsedJson).toHaveLength(1);
      expect(parsedJson[0]).toMatchObject({
        id: 'minimal',
        name: 'Minimal Template',
        description: 'Minimal description',
        package: '@test/minimal',
        config: {},
        capabilities: [],
        verified: false,
        defaultEnabled: false,
      });
    });

    it('should handle templates with null/undefined optional properties', async () => {
      const templateWithNulls = {
        withNulls: {
          id: 'withNulls',
          name: 'Template With Nulls',
          description: 'Template with null properties',
          package: '@test/nulls',
          config: {},
          capabilities: [],
          verified: true,
          defaultEnabled: false,
          category: null,
          tags: undefined,
          documentationUrl: null,
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(templateWithNulls);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list', '--json']);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      let parsedJson;

      expect(() => {
        parsedJson = JSON.parse(jsonOutput);
      }).not.toThrow();

      expect(parsedJson).toHaveLength(1);
      expect(parsedJson[0].id).toBe('withNulls');
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle large number of templates with JSON output efficiently', async () => {
      const manyTemplates: Record<string, MCPTemplate> = {};
      for (let i = 0; i < 100; i++) {
        manyTemplates[`template-${i}`] = {
          id: `template-${i}`,
          name: `Template ${i}`,
          description: `Description for template ${i}`,
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
      await mcpCommand?.handler(mockContext, ['list', '--json']);
      const end = performance.now();

      expect(end - start).toBeLessThan(100); // Should be fast

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);

      expect(parsedJson).toHaveLength(100);
    });
  });
});