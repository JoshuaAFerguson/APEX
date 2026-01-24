/**
 * Integration tests for MCP marketplace list command
 *
 * Tests verify:
 * - Listing available servers returns expected format
 * - Filtering options work correctly
 * - Empty results are handled gracefully
 * - Error states (network issues) are handled properly
 * - All tests pass
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CliContext } from '../index.js';
import type { MCPTemplate } from '@apexcli/core';

// Mock chalk to avoid color codes in tests
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => `CYAN:${str}`,
    red: (str: string) => `RED:${str}`,
    green: (str: string) => `GREEN:${str}`,
    yellow: (str: string) => `YELLOW:${str}`,
    gray: (str: string) => `GRAY:${str}`,
    blue: (str: string) => `BLUE:${str}`,
    magenta: (str: string) => `MAGENTA:${str}`,
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
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

// Import after mocks are set up
import { loadMCPTemplates } from '@apexcli/core';
import { commands } from '../index.js';

describe('MCP Marketplace List Integration Tests', () => {
  let mockContext: CliContext;
  let mockLoadMCPTemplates: any;
  let mcpCommand: any;

  // Comprehensive test data representing different server types
  const marketplaceTemplates: Record<string, MCPTemplate> = {
    filesystem: {
      id: 'filesystem',
      name: 'Filesystem Server',
      description: 'Secure filesystem access with sandboxing',
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
      description: 'GitHub repository integration for code management',
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
      description: 'SQL database connections and operations',
      package: '@test/database-server',
      config: {
        name: 'database',
        type: 'stdio',
        command: 'test-db',
        args: ['--config', 'db.json'],
      },
      capabilities: ['database', 'sql', 'query'],
      verified: false,
      defaultEnabled: false,
      category: 'Database',
      tags: ['database', 'sql', 'postgres', 'mysql'],
    },
    webscraper: {
      id: 'webscraper',
      name: 'Web Scraper',
      description: 'Extract data from web pages efficiently',
      package: '@third-party/web-scraper',
      config: {
        name: 'webscraper',
        type: 'stdio',
        command: 'web-scraper',
        args: ['--mode', 'server'],
      },
      capabilities: ['web', 'scraping', 'data-extraction'],
      verified: false,
      defaultEnabled: false,
      // No category - should be in "Other" section
      tags: ['web', 'scraping', 'data'],
    },
    api_client: {
      id: 'api_client',
      name: 'REST API Client',
      description: 'Generic REST API client for external integrations',
      package: '@modelcontextprotocol/server-api-client',
      config: {
        name: 'api_client',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-api-client'],
      },
      capabilities: ['api', 'http', 'rest'],
      verified: true,
      defaultEnabled: false,
      category: 'Network',
      tags: ['api', 'rest', 'http', 'client'],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();

    mockContext = {
      cwd: '/test/project',
      initialized: true,
      config: null,
      orchestrator: null,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    } as CliContext;

    mockLoadMCPTemplates = vi.mocked(loadMCPTemplates);
    mcpCommand = commands.find(cmd => cmd.name === 'mcp');

    // Default successful response
    mockLoadMCPTemplates.mockResolvedValue(marketplaceTemplates);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Listing Available Servers - Expected Format', () => {
    it('should display servers in categorized format with proper headers', async () => {
      await mcpCommand.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // Verify main header
      expect(allOutput).toContain('CYAN:\n📦 MCP Marketplace - Available Servers:\n');

      // Verify category headers are displayed
      expect(allOutput).toContain('MAGENTA:📁 Database');
      expect(allOutput).toContain('MAGENTA:📁 Files');
      expect(allOutput).toContain('MAGENTA:📁 Git');
      expect(allOutput).toContain('MAGENTA:📁 Network');
      expect(allOutput).toContain('MAGENTA:📁 Other'); // For uncategorized items
    });

    it('should show server details with verification badges', async () => {
      await mcpCommand.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // Verified servers should have blue checkmark
      expect(allOutput).toContain('YELLOW:Filesystem Server BLUE: ✓');
      expect(allOutput).toContain('YELLOW:GitHub Server BLUE: ✓');
      expect(allOutput).toContain('YELLOW:REST API Client BLUE: ✓');

      // Unverified servers should not have checkmark
      expect(allOutput).toContain('YELLOW:Database Server    '); // No checkmark
      expect(allOutput).toContain('YELLOW:Web Scraper    '); // No checkmark
    });

    it('should display server descriptions correctly', async () => {
      await mcpCommand.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      expect(allOutput).toContain('GRAY:Secure filesystem access with sandboxing');
      expect(allOutput).toContain('GRAY:GitHub repository integration for code management');
      expect(allOutput).toContain('GRAY:SQL database connections and operations');
      expect(allOutput).toContain('GRAY:Extract data from web pages efficiently');
      expect(allOutput).toContain('GRAY:Generic REST API client for external integrations');
    });

    it('should show tags for each server', async () => {
      await mcpCommand.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // Check tag display format
      expect(allOutput).toContain('GRAY:Tags: CYAN:#filesystem CYAN:#files CYAN:#storage');
      expect(allOutput).toContain('GRAY:Tags: CYAN:#github CYAN:#git CYAN:#version-control');
      expect(allOutput).toContain('GRAY:Tags: CYAN:#database CYAN:#sql CYAN:#postgres CYAN:#mysql');
      expect(allOutput).toContain('GRAY:Tags: CYAN:#web CYAN:#scraping CYAN:#data');
      expect(allOutput).toContain('GRAY:Tags: CYAN:#api CYAN:#rest CYAN:#http CYAN:#client');
    });

    it('should display summary statistics', async () => {
      await mcpCommand.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // Summary stats
      expect(allOutput).toContain('GRAY:📊 5 servers available');
      expect(allOutput).toContain('GRAY:   3 verified servers BLUE:✓');
    });

    it('should show marketplace command guidance', async () => {
      await mcpCommand.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // Command guidance
      expect(allOutput).toContain('GRAY:\n🔍 Marketplace commands:');
      expect(allOutput).toContain('GRAY:  • Search servers: /mcp search <query>');
      expect(allOutput).toContain('GRAY:  • Install server: /mcp install <server-name>');
      expect(allOutput).toContain('GRAY:  • View installed: /mcp installed');
      expect(allOutput).toContain('GRAY:  • Interactive setup: /mcp init\n');
    });

    it('should sort categories alphabetically', async () => {
      await mcpCommand.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // Find category headers in order
      const databasePos = allOutput.indexOf('MAGENTA:📁 Database');
      const filesPos = allOutput.indexOf('MAGENTA:📁 Files');
      const gitPos = allOutput.indexOf('MAGENTA:📁 Git');
      const networkPos = allOutput.indexOf('MAGENTA:📁 Network');
      const otherPos = allOutput.indexOf('MAGENTA:📁 Other');

      // Verify alphabetical order
      expect(databasePos).toBeLessThan(filesPos);
      expect(filesPos).toBeLessThan(gitPos);
      expect(gitPos).toBeLessThan(networkPos);
      expect(networkPos).toBeLessThan(otherPos);
    });

    it('should sort servers within categories alphabetically', async () => {
      await mcpCommand.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // In Files category - should be just Filesystem Server
      const filesSection = allOutput.substring(
        allOutput.indexOf('MAGENTA:📁 Files'),
        allOutput.indexOf('MAGENTA:📁 Git')
      );
      expect(filesSection).toContain('YELLOW:Filesystem Server');

      // In Git category - should be just GitHub Server
      const gitSection = allOutput.substring(
        allOutput.indexOf('MAGENTA:📁 Git'),
        allOutput.indexOf('MAGENTA:📁 Network')
      );
      expect(gitSection).toContain('YELLOW:GitHub Server');
    });
  });

  describe('JSON Output Format', () => {
    it('should return valid JSON when --json flag is used', async () => {
      await mcpCommand.handler(mockContext, ['list', '--json']);

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const output = mockConsoleLog.mock.calls[0][0];

      // Should be valid JSON
      expect(() => JSON.parse(output)).not.toThrow();

      const parsedOutput = JSON.parse(output);
      expect(Array.isArray(parsedOutput)).toBe(true);
      expect(parsedOutput).toHaveLength(5);
    });

    it('should contain all server data in JSON format', async () => {
      await mcpCommand.handler(mockContext, ['list', '--json']);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsedOutput = JSON.parse(output);

      // Check that all servers are included
      const serverIds = parsedOutput.map((server: any) => server.id);
      expect(serverIds).toContain('filesystem');
      expect(serverIds).toContain('github');
      expect(serverIds).toContain('database');
      expect(serverIds).toContain('webscraper');
      expect(serverIds).toContain('api_client');

      // Check structure of first server
      const firstServer = parsedOutput[0];
      expect(firstServer).toHaveProperty('id');
      expect(firstServer).toHaveProperty('name');
      expect(firstServer).toHaveProperty('description');
      expect(firstServer).toHaveProperty('config');
      expect(firstServer).toHaveProperty('capabilities');
      expect(firstServer).toHaveProperty('verified');
    });

    it('should handle --json flag in different positions', async () => {
      // Test --json before list
      mockConsoleLog.mockClear();
      await mcpCommand.handler(mockContext, ['--json', 'list']);

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const output1 = mockConsoleLog.mock.calls[0][0];
      expect(() => JSON.parse(output1)).not.toThrow();

      // Test --json after list
      mockConsoleLog.mockClear();
      await mcpCommand.handler(mockContext, ['list', '--json']);

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const output2 = mockConsoleLog.mock.calls[0][0];
      expect(() => JSON.parse(output2)).not.toThrow();

      // Both should produce the same result
      expect(JSON.parse(output1)).toEqual(JSON.parse(output2));
    });
  });

  describe('Filtering Options', () => {
    it('should handle list command with no arguments (default to list)', async () => {
      await mcpCommand.handler(mockContext, []);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('CYAN:\n📦 MCP Marketplace - Available Servers:\n');
    });

    it('should handle list command with explicit "list" argument', async () => {
      await mcpCommand.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('CYAN:\n📦 MCP Marketplace - Available Servers:\n');
    });

    it('should handle case-insensitive list command', async () => {
      const testCases = ['LIST', 'List', 'LiSt'];

      for (const testCase of testCases) {
        mockConsoleLog.mockClear();
        await mcpCommand.handler(mockContext, [testCase.toLowerCase()]);

        const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
        expect(allOutput).toContain('CYAN:\n📦 MCP Marketplace - Available Servers:\n');
      }
    });
  });

  describe('Empty Results Handling', () => {
    it('should handle empty marketplace gracefully', async () => {
      mockLoadMCPTemplates.mockResolvedValue({});

      await mcpCommand.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'GRAY:No MCP servers found in marketplace.'
      );
    });

    it('should return empty JSON array for empty marketplace with --json', async () => {
      mockLoadMCPTemplates.mockResolvedValue({});

      await mcpCommand.handler(mockContext, ['list', '--json']);

      expect(mockConsoleLog).toHaveBeenCalledWith('[]');

      // Verify it's valid JSON
      const output = mockConsoleLog.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      expect(JSON.parse(output)).toEqual([]);
    });

    it('should handle null marketplace data', async () => {
      mockLoadMCPTemplates.mockResolvedValue(null);

      await mcpCommand.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'GRAY:No MCP servers found in marketplace.'
      );
    });

    it('should handle undefined marketplace data', async () => {
      mockLoadMCPTemplates.mockResolvedValue(undefined);

      await mcpCommand.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'GRAY:No MCP servers found in marketplace.'
      );
    });
  });

  describe('Error State Handling', () => {
    it('should handle network/loading errors gracefully', async () => {
      const networkError = new Error('Network request failed');
      mockLoadMCPTemplates.mockRejectedValue(networkError);

      await mcpCommand.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'RED:❌ Error loading MCP marketplace: Network request failed'
      );
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      mockLoadMCPTemplates.mockRejectedValue(timeoutError);

      await mcpCommand.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'RED:❌ Error loading MCP marketplace: Request timeout'
      );
    });

    it('should handle file system errors', async () => {
      const fsError = new Error('ENOENT: no such file or directory');
      mockLoadMCPTemplates.mockRejectedValue(fsError);

      await mcpCommand.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'RED:❌ Error loading MCP marketplace: ENOENT: no such file or directory'
      );
    });

    it('should handle malformed JSON errors', async () => {
      const jsonError = new Error('Unexpected token in JSON');
      mockLoadMCPTemplates.mockRejectedValue(jsonError);

      await mcpCommand.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'RED:❌ Error loading MCP marketplace: Unexpected token in JSON'
      );
    });

    it('should handle permission errors', async () => {
      const permError = new Error('EACCES: permission denied');
      mockLoadMCPTemplates.mockRejectedValue(permError);

      await mcpCommand.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'RED:❌ Error loading MCP marketplace: EACCES: permission denied'
      );
    });

    it('should handle unknown errors gracefully', async () => {
      const unknownError = new Error('Unknown error occurred');
      mockLoadMCPTemplates.mockRejectedValue(unknownError);

      await mcpCommand.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'RED:❌ Error loading MCP marketplace: Unknown error occurred'
      );
    });

    it('should handle non-Error exceptions', async () => {
      const stringError = 'Something went wrong';
      mockLoadMCPTemplates.mockRejectedValue(stringError);

      await mcpCommand.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'RED:❌ Error loading MCP marketplace: Something went wrong'
      );
    });
  });

  describe('Data Validation and Edge Cases', () => {
    it('should handle servers without categories correctly', async () => {
      const templatesWithoutCategories = {
        nocategory1: {
          id: 'nocategory1',
          name: 'No Category Server 1',
          description: 'Server without category',
          config: { name: 'nocategory1', type: 'stdio', command: 'test' },
          verified: true,
          tags: ['test'],
        },
        nocategory2: {
          id: 'nocategory2',
          name: 'No Category Server 2',
          description: 'Another server without category',
          config: { name: 'nocategory2', type: 'stdio', command: 'test2' },
          verified: false,
          tags: ['test2'],
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(templatesWithoutCategories);

      await mcpCommand.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // Should show "Other" category
      expect(allOutput).toContain('MAGENTA:📁 Other');
      expect(allOutput).toContain('YELLOW:No Category Server 1');
      expect(allOutput).toContain('YELLOW:No Category Server 2');
    });

    it('should handle servers without tags', async () => {
      const templatesWithoutTags = {
        notags: {
          id: 'notags',
          name: 'No Tags Server',
          description: 'Server without tags',
          config: { name: 'notags', type: 'stdio', command: 'test' },
          verified: true,
          category: 'Test',
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(templatesWithoutTags);

      await mcpCommand.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // Should not show tags section for servers without tags
      expect(allOutput).toContain('YELLOW:No Tags Server');
      expect(allOutput).not.toContain('GRAY:Tags:');
    });

    it('should handle servers with empty tags array', async () => {
      const templatesWithEmptyTags = {
        emptytags: {
          id: 'emptytags',
          name: 'Empty Tags Server',
          description: 'Server with empty tags array',
          config: { name: 'emptytags', type: 'stdio', command: 'test' },
          verified: false,
          category: 'Test',
          tags: [],
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(templatesWithEmptyTags);

      await mcpCommand.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // Should not show tags section for servers with empty tags
      expect(allOutput).toContain('YELLOW:Empty Tags Server');
      expect(allOutput).not.toContain('GRAY:Tags:');
    });

    it('should handle very long server names correctly', async () => {
      const templatesWithLongNames = {
        longname: {
          id: 'longname',
          name: 'This is a Very Long Server Name That Might Break Formatting',
          description: 'Server with very long name',
          config: { name: 'longname', type: 'stdio', command: 'test' },
          verified: true,
          category: 'Test',
          tags: ['test'],
        },
        shortname: {
          id: 'short',
          name: 'Short',
          description: 'Server with short name',
          config: { name: 'short', type: 'stdio', command: 'test' },
          verified: false,
          category: 'Test',
          tags: ['test'],
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(templatesWithLongNames);

      await mcpCommand.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // Should handle both names correctly
      expect(allOutput).toContain('YELLOW:This is a Very Long Server Name That Might Break Formatting');
      expect(allOutput).toContain('YELLOW:Short');
    });

    it('should handle special characters in names and descriptions', async () => {
      const templatesWithSpecialChars = {
        special: {
          id: 'special',
          name: 'Server with "Quotes" & Symbols',
          description: 'Description with special chars: @#$%^&*()_+{}[]|\\:";\'<>?,./~`',
          config: { name: 'special', type: 'stdio', command: 'test' },
          verified: true,
          category: 'Test',
          tags: ['special-chars', 'test@example'],
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(templatesWithSpecialChars);

      await mcpCommand.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // Should display special characters correctly
      expect(allOutput).toContain('YELLOW:Server with "Quotes" & Symbols');
      expect(allOutput).toContain('GRAY:Description with special chars: @#$%^&*()_+{}[]|\\:";\'<>?,./~`');
      expect(allOutput).toContain('CYAN:#special-chars CYAN:#test@example');
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle large numbers of servers efficiently', async () => {
      // Generate 100 test servers
      const largeTemplateSet: Record<string, MCPTemplate> = {};
      for (let i = 1; i <= 100; i++) {
        largeTemplateSet[`server${i}`] = {
          id: `server${i}`,
          name: `Test Server ${i}`,
          description: `Description for server ${i}`,
          config: { name: `server${i}`, type: 'stdio', command: 'test' },
          verified: i % 3 === 0, // Every third server is verified
          category: `Category${i % 5 + 1}`, // 5 different categories
          tags: [`tag${i}`, 'test'],
        };
      }

      mockLoadMCPTemplates.mockResolvedValue(largeTemplateSet);

      const startTime = Date.now();
      await mcpCommand.handler(mockContext, ['list']);
      const endTime = Date.now();

      // Should complete within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // Should show correct count
      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('GRAY:📊 100 servers available');
    });

    it('should handle concurrent list requests', async () => {
      const promises: Promise<void>[] = [];

      // Execute 5 concurrent list commands
      for (let i = 0; i < 5; i++) {
        promises.push(mcpCommand.handler(mockContext, ['list']));
      }

      // All should complete without error
      await expect(Promise.all(promises)).resolves.not.toThrow();

      // Should call loadMCPTemplates for each request
      expect(mockLoadMCPTemplates).toHaveBeenCalledTimes(5);
    });
  });
});