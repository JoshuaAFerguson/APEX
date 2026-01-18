/**
 * Edge cases and error scenarios tests for MCP list and search commands
 * Tests boundary conditions, malformed data, and error recovery
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

describe('MCP Commands - Edge Cases and Error Scenarios', () => {
  let mockContext: CliContext;
  let mockLoadMCPTemplates: any;

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

    mockConsoleLog.mockClear();
    mockLoadMCPTemplates.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Malformed template data handling', () => {
    it('should handle templates with missing required properties gracefully', async () => {
      const malformedTemplates = {
        incomplete: {
          id: 'incomplete',
          // Missing name, description, package
          config: {},
          capabilities: [],
          verified: true,
          defaultEnabled: false,
        },
        'null-values': {
          id: 'null-values',
          name: null,
          description: null,
          package: '@test/null',
          config: {},
          capabilities: [],
          verified: true,
          defaultEnabled: false,
        },
        'undefined-values': {
          id: 'undefined-values',
          name: undefined,
          description: undefined,
          package: '@test/undefined',
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
      await expect(mcpCommand?.handler(mockContext, ['list', '--json'])).resolves.not.toThrow();
      await expect(mcpCommand?.handler(mockContext, ['search', 'test'])).resolves.not.toThrow();
      await expect(mcpCommand?.handler(mockContext, ['search', 'test', '--json'])).resolves.not.toThrow();
    });

    it('should handle templates with circular references in config', async () => {
      const circularConfig: any = { name: 'circular' };
      circularConfig.self = circularConfig;

      const circularTemplates = {
        circular: {
          id: 'circular',
          name: 'Circular Template',
          description: 'Template with circular references',
          package: '@test/circular',
          config: circularConfig,
          capabilities: [],
          verified: true,
          defaultEnabled: false,
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(circularTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Should handle gracefully without infinite loops
      await expect(mcpCommand?.handler(mockContext, ['list', '--json'])).resolves.not.toThrow();
    });

    it('should handle templates with very large arrays and objects', async () => {
      const largeTags = Array(1000).fill(0).map((_, i) => `tag-${i}`);
      const largeCapabilities = Array(500).fill(0).map((_, i) => `capability-${i}`);
      const largeConfig = {
        name: 'large',
        type: 'stdio',
        command: 'test',
        args: Array(200).fill(0).map((_, i) => `arg-${i}`),
        env: Object.fromEntries(Array(100).fill(0).map((_, i) => [`VAR_${i}`, `value-${i}`])),
      };

      const largeTemplates = {
        large: {
          id: 'large',
          name: 'Large Template',
          description: 'Template with large data structures',
          package: '@test/large',
          config: largeConfig,
          capabilities: largeCapabilities,
          verified: true,
          defaultEnabled: false,
          tags: largeTags,
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(largeTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const start = performance.now();
      await mcpCommand?.handler(mockContext, ['list', '--json']);
      const end = performance.now();

      expect(end - start).toBeLessThan(500); // Should complete in reasonable time

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      expect(() => JSON.parse(jsonOutput)).not.toThrow();
    });
  });

  describe('Network and loading error scenarios', () => {
    it('should handle network timeouts gracefully', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockLoadMCPTemplates.mockRejectedValue(timeoutError);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP marketplace: Request timeout')
      );

      mockConsoleLog.mockClear();
      await mcpCommand?.handler(mockContext, ['search', 'test']);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error searching MCP marketplace: Request timeout')
      );
    });

    it('should handle JSON parsing errors', async () => {
      const parseError = new Error('Unexpected token in JSON');
      parseError.name = 'SyntaxError';
      mockLoadMCPTemplates.mockRejectedValue(parseError);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list', '--json']);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP marketplace: Unexpected token in JSON')
      );
    });

    it('should handle permission errors', async () => {
      const permissionError = new Error('Permission denied');
      permissionError.name = 'PermissionError';
      mockLoadMCPTemplates.mockRejectedValue(permissionError);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP marketplace: Permission denied')
      );
    });
  });

  describe('Extreme input scenarios', () => {
    it('should handle very long search queries', async () => {
      const normalTemplates = {
        test: {
          id: 'test',
          name: 'Test Server',
          description: 'A test server for testing purposes',
          package: '@test/server',
          config: {},
          capabilities: ['test'],
          verified: true,
          defaultEnabled: false,
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(normalTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Test with very long query (1000 characters)
      const longQuery = 'test'.repeat(250);

      await expect(mcpCommand?.handler(mockContext, ['search', longQuery, '--json'])).resolves.not.toThrow();

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);
      expect(Array.isArray(parsedJson)).toBe(true);
    });

    it('should handle search queries with special regex characters', async () => {
      const normalTemplates = {
        special: {
          id: 'special',
          name: 'Special [chars] (test)',
          description: 'Server with special characters: .*+?^${}()|[]\\',
          package: '@test/special',
          config: {},
          capabilities: ['special'],
          verified: true,
          defaultEnabled: false,
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(normalTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const specialQueries = [
        '.*',
        '[test]',
        '(chars)',
        '^start',
        'end$',
        'a|b',
        'test\\escape',
        '{}',
        '+',
        '?',
        '*',
      ];

      for (const query of specialQueries) {
        mockConsoleLog.mockClear();
        await expect(mcpCommand?.handler(mockContext, ['search', query, '--json'])).resolves.not.toThrow();
      }
    });

    it('should handle search queries with Unicode and emoji characters', async () => {
      const unicodeTemplates = {
        unicode: {
          id: 'unicode',
          name: '🌟 Unicode Server 中文',
          description: 'Server with Unicode: こんにちは 🎉 العربية',
          package: '@test/unicode',
          config: {},
          capabilities: ['unicode', 'emoji'],
          verified: true,
          defaultEnabled: false,
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(unicodeTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const unicodeQueries = [
        '🌟',
        '中文',
        'こんにちは',
        '🎉',
        'العربية',
        'emoji',
      ];

      for (const query of unicodeQueries) {
        mockConsoleLog.mockClear();
        await expect(mcpCommand?.handler(mockContext, ['search', query, '--json'])).resolves.not.toThrow();

        const jsonOutput = mockConsoleLog.mock.calls[0][0];
        const parsedJson = JSON.parse(jsonOutput);
        expect(Array.isArray(parsedJson)).toBe(true);
      }
    });
  });

  describe('Memory and performance stress tests', () => {
    it('should handle very large template datasets efficiently', async () => {
      // Create 1000 templates
      const largeDataset: Record<string, MCPTemplate> = {};
      for (let i = 0; i < 1000; i++) {
        largeDataset[`template-${i.toString().padStart(4, '0')}`] = {
          id: `template-${i}`,
          name: `Template ${i.toString().padStart(4, '0')}`,
          description: `This is a test template number ${i} for testing large datasets and ensuring performance remains acceptable`,
          package: `@test/template-${i}`,
          config: {
            name: `template-${i}`,
            type: 'stdio',
            command: 'test-command',
            args: [`--id=${i}`, `--name=template-${i}`],
          },
          capabilities: [`capability-${i % 10}`, `feature-${i % 5}`],
          verified: i % 3 === 0,
          defaultEnabled: i % 10 === 0,
          category: `Category-${i % 20}`,
          tags: [`tag-${i % 15}`, `type-${i % 7}`],
        };
      }

      mockLoadMCPTemplates.mockResolvedValue(largeDataset);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Test list performance
      const listStart = performance.now();
      await mcpCommand?.handler(mockContext, ['list', '--json']);
      const listEnd = performance.now();

      expect(listEnd - listStart).toBeLessThan(300); // Should be fast even with 1000 templates

      const listJson = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(listJson).toHaveLength(1000);

      // Test search performance
      mockConsoleLog.mockClear();
      const searchStart = performance.now();
      await mcpCommand?.handler(mockContext, ['search', 'capability-5', '--json']);
      const searchEnd = performance.now();

      expect(searchEnd - searchStart).toBeLessThan(200); // Search should be fast

      const searchJson = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(searchJson.length).toBeGreaterThan(0); // Should find matches
    });

    it('should handle repeated rapid calls without memory leaks', async () => {
      const templates = {
        test: {
          id: 'test',
          name: 'Test Server',
          description: 'Test server',
          package: '@test/server',
          config: {},
          capabilities: ['test'],
          verified: true,
          defaultEnabled: false,
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(templates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Simulate rapid repeated calls
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(mcpCommand?.handler(mockContext, ['list', '--json']));
        promises.push(mcpCommand?.handler(mockContext, ['search', 'test', '--json']));
      }

      await expect(Promise.all(promises)).resolves.not.toThrow();

      // Should have made many calls without errors
      expect(mockLoadMCPTemplates).toHaveBeenCalledTimes(100);
    });
  });

  describe('Concurrent access and state management', () => {
    it('should handle concurrent list and search commands safely', async () => {
      const templates = {
        concurrent: {
          id: 'concurrent',
          name: 'Concurrent Server',
          description: 'Server for testing concurrent access',
          package: '@test/concurrent',
          config: {},
          capabilities: ['concurrent'],
          verified: true,
          defaultEnabled: false,
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(templates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Run multiple commands concurrently
      const concurrentPromises = [
        mcpCommand?.handler(mockContext, ['list', '--json']),
        mcpCommand?.handler(mockContext, ['search', 'concurrent', '--json']),
        mcpCommand?.handler(mockContext, ['list']),
        mcpCommand?.handler(mockContext, ['search', 'server']),
      ];

      await expect(Promise.all(concurrentPromises)).resolves.not.toThrow();

      // All should have completed successfully
      expect(mockLoadMCPTemplates).toHaveBeenCalledTimes(4);
    });

    it('should not interfere with global state or other commands', async () => {
      const templates = {
        isolated: {
          id: 'isolated',
          name: 'Isolated Server',
          description: 'Server for isolation testing',
          package: '@test/isolated',
          config: {},
          capabilities: ['isolated'],
          verified: true,
          defaultEnabled: false,
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(templates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Run MCP commands
      await mcpCommand?.handler(mockContext, ['list']);
      await mcpCommand?.handler(mockContext, ['search', 'isolated']);

      // Context should remain unchanged
      expect(mockContext.cwd).toBe('/test/project');
      expect(mockContext.initialized).toBe(true);
      expect(mockContext.config?.project.name).toBe('Test Project');

      // Should not have modified any globals or other state
      expect(process.cwd()).not.toBe('/test/project');
    });
  });

  describe('Resource cleanup and error recovery', () => {
    it('should clean up resources after errors', async () => {
      let callCount = 0;
      mockLoadMCPTemplates.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First call fails');
        }
        return Promise.resolve({
          recovered: {
            id: 'recovered',
            name: 'Recovered Server',
            description: 'Server after error recovery',
            package: '@test/recovered',
            config: {},
            capabilities: ['recovery'],
            verified: true,
            defaultEnabled: false,
          },
        });
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // First call should fail
      await mcpCommand?.handler(mockContext, ['list']);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP marketplace')
      );

      // Second call should succeed (error recovery)
      mockConsoleLog.mockClear();
      await mcpCommand?.handler(mockContext, ['list', '--json']);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);
      expect(parsedJson).toHaveLength(1);
      expect(parsedJson[0].id).toBe('recovered');
    });

    it('should handle partial data corruption gracefully', async () => {
      // Mix of good and bad templates
      const mixedTemplates = {
        good: {
          id: 'good',
          name: 'Good Server',
          description: 'A properly formed server',
          package: '@test/good',
          config: {},
          capabilities: ['test'],
          verified: true,
          defaultEnabled: false,
        },
        bad: {
          id: 'bad',
          // Missing required fields
          config: null,
          capabilities: undefined,
        },
        corrupted: {
          // Missing id
          name: 'Corrupted',
          package: '@test/corrupted',
          config: 'invalid-config-type',
          capabilities: 'invalid-array-type',
          verified: 'invalid-boolean',
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(mixedTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Should handle mixed data without crashing
      await expect(mcpCommand?.handler(mockContext, ['list', '--json'])).resolves.not.toThrow();
      await expect(mcpCommand?.handler(mockContext, ['search', 'server', '--json'])).resolves.not.toThrow();
    });
  });
});