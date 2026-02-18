/**
 * Enhanced tests for MCP list command
 * Tests the actual implementation format and edge cases
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
  };
});

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

describe('MCP List Command - Enhanced Tests', () => {
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
    // Template with longer name to test formatting
    'very-long-template-name': {
      id: 'very-long-template-name',
      name: 'Very Long Template Name For Testing',
      description: 'Template with a very long name to test formatting alignment',
      package: '@test/very-long-template-name',
      config: {
        name: 'very-long-template-name',
        type: 'stdio',
        command: 'test',
        args: [],
      },
      capabilities: ['test'],
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
    const { loadMCPTemplates } = await import('@apexcli/core');
    mockLoadMCPTemplates = vi.mocked(loadMCPTemplates);

    mockConsoleLog.mockClear();
    mockLoadMCPTemplates.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Actual format implementation tests', () => {
    it('should display templates with correct simple format', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      // Check for header
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📦 Available MCP Server Templates:')
      );

      // Check for total count
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Total: 3 templates available')
      );

      // Verify that all template entries are displayed with simple format: name + description
      const allOutputs = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      expect(allOutputs).toContain('Filesystem Server');
      expect(allOutputs).toContain('MCP server providing secure filesystem access');
      expect(allOutputs).toContain('GitHub Server');
      expect(allOutputs).toContain('MCP server for GitHub repository integration');
      expect(allOutputs).toContain('Very Long Template Name For Testing');
      expect(allOutputs).toContain('Template with a very long name to test formatting alignment');
    });

    it('should sort templates alphabetically by name', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      const templateOutputs = mockConsoleLog.mock.calls
        .map(call => call[0])
        .filter(output =>
          output.includes('Filesystem Server') ||
          output.includes('GitHub Server') ||
          output.includes('Very Long Template Name For Testing')
        );

      expect(templateOutputs).toHaveLength(3);

      // Check alphabetical order
      const indexOfFilesystem = templateOutputs.findIndex(o => o.includes('Filesystem Server'));
      const indexOfGitHub = templateOutputs.findIndex(o => o.includes('GitHub Server'));
      const indexOfVeryLong = templateOutputs.findIndex(o => o.includes('Very Long Template Name For Testing'));

      expect(indexOfFilesystem).toBeLessThan(indexOfGitHub);
      expect(indexOfGitHub).toBeLessThan(indexOfVeryLong);
    });

    it('should handle templates with alignment padding correctly', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      const templateOutputs = mockConsoleLog.mock.calls
        .map(call => call[0])
        .filter(output =>
          output.includes('Filesystem Server') ||
          output.includes('GitHub Server') ||
          output.includes('Very Long Template Name For Testing')
        );

      // All template outputs should start with two spaces
      templateOutputs.forEach(output => {
        expect(output).toMatch(/^  /);
      });

      // The longest name should determine padding, so shorter names should have more spaces
      const filesystemOutput = templateOutputs.find(o => o.includes('Filesystem Server'));
      const veryLongOutput = templateOutputs.find(o => o.includes('Very Long Template Name For Testing'));

      // Count spaces between name and description in filesystem output (should be more)
      const filesystemMatch = filesystemOutput?.match(/Filesystem Server(\s+)MCP server/);
      const veryLongMatch = veryLongOutput?.match(/Very Long Template Name For Testing(\s+)Template with/);

      if (filesystemMatch && veryLongMatch) {
        expect(filesystemMatch[1].length).toBeGreaterThan(veryLongMatch[1].length);
      }
    });
  });

  describe('Edge cases and special scenarios', () => {
    it('should handle templates with empty descriptions', async () => {
      const templatesWithEmptyDesc = {
        empty: {
          id: 'empty',
          name: 'Empty Description',
          description: '',
          package: '@test/empty',
          config: {},
          capabilities: [],
          verified: true,
          defaultEnabled: false,
        },
      };
      mockLoadMCPTemplates.mockResolvedValue(templatesWithEmptyDesc);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      const allOutputs = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutputs).toContain('Empty Description');
    });

    it('should handle templates with very long descriptions', async () => {
      const templatesWithLongDesc = {
        long: {
          id: 'long',
          name: 'Long Description',
          description: 'This is a very long description that should still be displayed properly without breaking the formatting or causing any issues with the console output display mechanism',
          package: '@test/long',
          config: {},
          capabilities: [],
          verified: true,
          defaultEnabled: false,
        },
      };
      mockLoadMCPTemplates.mockResolvedValue(templatesWithLongDesc);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      const allOutputs = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutputs).toContain('This is a very long description');
    });

    it('should handle templates with special characters in names', async () => {
      const templatesWithSpecialChars = {
        special: {
          id: 'special',
          name: 'Special-Chars_Template@2024',
          description: 'Template with special characters: @#$%^&*()',
          package: '@test/special-chars',
          config: {},
          capabilities: [],
          verified: true,
          defaultEnabled: false,
        },
      };
      mockLoadMCPTemplates.mockResolvedValue(templatesWithSpecialChars);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      const allOutputs = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutputs).toContain('Special-Chars_Template@2024');
      expect(allOutputs).toContain('@#$%^&*()');
    });

    it('should handle single template correctly', async () => {
      mockLoadMCPTemplates.mockResolvedValue({
        single: sampleTemplates.filesystem
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Total: 1 templates available')
      );

      const allOutputs = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutputs).toContain('Filesystem Server');
    });

    it('should handle many templates without performance issues', async () => {
      const manyTemplates: Record<string, MCPTemplate> = {};
      for (let i = 0; i < 50; i++) {
        manyTemplates[`template-${i.toString().padStart(2, '0')}`] = {
          id: `template-${i}`,
          name: `Template ${i.toString().padStart(2, '0')}`,
          description: `Description for template number ${i}`,
          package: `@test/template-${i}`,
          config: {},
          capabilities: [],
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

      expect(end - start).toBeLessThan(100); // Should complete quickly
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Total: 50 templates available')
      );
    });
  });

  describe('Output formatting verification', () => {
    it('should use consistent spacing format', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      const templateOutputs = mockConsoleLog.mock.calls
        .map(call => call[0])
        .filter(output =>
          output.includes('Filesystem Server') ||
          output.includes('GitHub Server') ||
          output.includes('Very Long Template Name For Testing')
        );

      // All template entries should follow the pattern: "  NAME[spaces]DESCRIPTION"
      templateOutputs.forEach(output => {
        expect(output).toMatch(/^  \S+.*\s{2,}\S+/);
      });
    });

    it('should display total count with proper format', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      // Should have exactly the format shown in implementation
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Total: 3 templates available'
      );
    });

    it('should handle templates with null or undefined properties gracefully', async () => {
      const templatesWithMissingProps = {
        minimal: {
          id: 'minimal',
          name: 'Minimal Template',
          description: 'Minimal template with only required properties',
          package: '@test/minimal',
          config: {},
          capabilities: [],
          verified: true,
          defaultEnabled: false,
          // Missing optional properties like documentationUrl
        },
      };
      mockLoadMCPTemplates.mockResolvedValue(templatesWithMissingProps);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await expect(mcpCommand?.handler(mockContext, ['list'])).resolves.not.toThrow();

      const allOutputs = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutputs).toContain('Minimal Template');
    });
  });

  describe('Case sensitivity and subcommand variations', () => {
    it('should handle "list" subcommand case variations', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Test different case variations
      const variations = ['list', 'LIST', 'List', 'LiSt'];

      for (const variation of variations) {
        mockConsoleLog.mockClear();
        mockLoadMCPTemplates.mockClear();

        await mcpCommand?.handler(mockContext, [variation]);

        expect(mockLoadMCPTemplates).toHaveBeenCalledOnce();
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('📦 Available MCP Server Templates:')
        );
      }
    });

    it('should default to list when no subcommand provided', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, []);

      expect(mockLoadMCPTemplates).toHaveBeenCalledOnce();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📦 Available MCP Server Templates:')
      );
    });

    it('should default to list when empty string subcommand provided', async () => {
      mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['']);

      expect(mockLoadMCPTemplates).toHaveBeenCalledOnce();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📦 Available MCP Server Templates:')
      );
    });
  });
});