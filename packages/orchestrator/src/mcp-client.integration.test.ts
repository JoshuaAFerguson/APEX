/**
 * @fileoverview Integration tests for MCPClientUtility
 *
 * These tests focus on real-world scenarios and integration with the MCP ecosystem.
 * They test the utility against realistic MCP server configurations and actual
 * tool discovery workflows.
 *
 * Test Scenarios:
 * - Realistic MCP server configurations
 * - Tool discovery workflows
 * - Error recovery scenarios
 * - Performance under realistic loads
 * - Integration with actual transport implementations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MCPServerConfig } from '@apexcli/core';
import {
  MCPClientUtility,
  createMCPClientUtility,
  connectAndDiscoverMCPServer,
  type MCPClientUtilityOptions,
  type MCPServerConnection,
} from './mcp-client.js';

// ============================================================================
// Integration Test Suite
// ============================================================================

describe('MCPClientUtility - Integration Tests', () => {
  let utility: MCPClientUtility;

  beforeEach(() => {
    utility = createMCPClientUtility({
      enableLogging: false,
      maxConcurrentConnections: 5,
      defaultTimeoutMs: 10000,
    });
  });

  afterEach(async () => {
    await utility.disconnectAll();
  });

  describe('realistic MCP server configurations', () => {
    it('should handle filesystem server configuration', async () => {
      const filesystemConfig: MCPServerConfig = {
        name: 'filesystem-server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        envVars: [
          { name: 'NODE_ENV', value: 'test' },
        ],
        autoStart: true,
        connection: {
          timeoutMs: 15000,
        },
      };

      // Mock the underlying MCP dependencies for this integration test
      vi.doMock('./mcp/index.js', () => ({
        MCPClient: vi.fn(() => ({
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined),
          listTools: vi.fn().mockResolvedValue([
            { name: 'read_file', description: 'Read a file from the filesystem', inputSchema: { type: 'object' } },
            { name: 'write_file', description: 'Write content to a file', inputSchema: { type: 'object' } },
            { name: 'list_directory', description: 'List directory contents', inputSchema: { type: 'object' } },
          ]),
          on: vi.fn(),
        })),
        StdioTransport: vi.fn(() => ({
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined),
          on: vi.fn(),
          send: vi.fn(),
        })),
      }));

      const mockSpawn = vi.fn(() => ({
        on: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'spawn') {
            setTimeout(() => callback(), 50);
          }
          return { on: vi.fn() };
        }),
        kill: vi.fn(),
        killed: false,
        stderr: { on: vi.fn() },
      }));

      vi.doMock('child_process', () => ({
        spawn: mockSpawn,
      }));

      const result = await utility.connectServer(filesystemConfig);

      expect(result.success).toBe(true);
      expect(result.connection).toBeDefined();
      expect(result.connection?.tools.length).toBeGreaterThan(0);

      const tools = result.connection?.tools || [];
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('write_file');
      expect(toolNames).toContain('list_directory');
    });

    it('should handle git server configuration', async () => {
      const gitConfig: MCPServerConfig = {
        name: 'git-server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-git'],
        envVars: [
          { name: 'GIT_SAFE_DIRECTORY', value: '*' },
        ],
        autoStart: true,
        connection: {
          timeoutMs: 20000,
        },
      };

      // Mock git-specific tools
      vi.doMock('./mcp/index.js', () => ({
        MCPClient: vi.fn(() => ({
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined),
          listTools: vi.fn().mockResolvedValue([
            { name: 'git_status', description: 'Get git repository status', inputSchema: { type: 'object' } },
            { name: 'git_log', description: 'Get git commit history', inputSchema: { type: 'object' } },
            { name: 'git_diff', description: 'Show git diff', inputSchema: { type: 'object' } },
            { name: 'git_commit', description: 'Create a git commit', inputSchema: { type: 'object' } },
          ]),
          on: vi.fn(),
        })),
        StdioTransport: vi.fn(() => ({
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined),
          on: vi.fn(),
          send: vi.fn(),
        })),
      }));

      const mockSpawn = vi.fn(() => ({
        on: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'spawn') {
            setTimeout(() => callback(), 50);
          }
          return { on: vi.fn() };
        }),
        kill: vi.fn(),
        killed: false,
        stderr: { on: vi.fn() },
      }));

      vi.doMock('child_process', () => ({
        spawn: mockSpawn,
      }));

      const result = await utility.connectServer(gitConfig);

      expect(result.success).toBe(true);
      expect(result.connection?.tools.length).toBeGreaterThan(0);

      const tools = result.connection?.tools || [];
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('git_status');
      expect(toolNames).toContain('git_log');
      expect(toolNames).toContain('git_diff');
      expect(toolNames).toContain('git_commit');
    });

    it('should handle browser automation server configuration', async () => {
      const browserConfig: MCPServerConfig = {
        name: 'browser-server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        envVars: [
          { name: 'BRAVE_API_KEY', value: 'test-api-key' },
        ],
        autoStart: true,
        connection: {
          timeoutMs: 30000, // Longer timeout for browser operations
        },
      };

      // Mock browser automation tools
      vi.doMock('./mcp/index.js', () => ({
        MCPClient: vi.fn(() => ({
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined),
          listTools: vi.fn().mockResolvedValue([
            { name: 'brave_search', description: 'Search the web using Brave Search', inputSchema: { type: 'object' } },
            { name: 'get_search_results', description: 'Get formatted search results', inputSchema: { type: 'object' } },
          ]),
          on: vi.fn(),
        })),
        StdioTransport: vi.fn(() => ({
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined),
          on: vi.fn(),
          send: vi.fn(),
        })),
      }));

      const mockSpawn = vi.fn(() => ({
        on: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'spawn') {
            setTimeout(() => callback(), 100); // Longer startup time
          }
          return { on: vi.fn() };
        }),
        kill: vi.fn(),
        killed: false,
        stderr: { on: vi.fn() },
      }));

      vi.doMock('child_process', () => ({
        spawn: mockSpawn,
      }));

      const result = await utility.connectServer(browserConfig);

      expect(result.success).toBe(true);
      expect(result.connection?.tools.length).toBeGreaterThan(0);

      const tools = result.connection?.tools || [];
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('brave_search');
    });
  });

  describe('workflow integration scenarios', () => {
    it('should handle multi-server development workflow', async () => {
      const servers = [
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
          autoStart: true,
        },
        {
          name: 'git',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-git'],
          autoStart: true,
        },
        {
          name: 'postgres',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-postgres'],
          envVars: [
            { name: 'DATABASE_URL', value: 'postgresql://user:pass@localhost:5432/db' },
          ],
          autoStart: true,
        },
      ] as MCPServerConfig[];

      // Mock each server's tools
      const mockToolSets = [
        [
          { name: 'read_file', description: 'Read file', inputSchema: {} },
          { name: 'write_file', description: 'Write file', inputSchema: {} },
        ],
        [
          { name: 'git_status', description: 'Git status', inputSchema: {} },
          { name: 'git_commit', description: 'Git commit', inputSchema: {} },
        ],
        [
          { name: 'query', description: 'Execute SQL query', inputSchema: {} },
          { name: 'schema', description: 'Get schema', inputSchema: {} },
        ],
      ];

      let mockCallCount = 0;
      vi.doMock('./mcp/index.js', () => ({
        MCPClient: vi.fn(() => ({
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined),
          listTools: vi.fn(() => Promise.resolve(mockToolSets[mockCallCount++] || [])),
          on: vi.fn(),
        })),
        StdioTransport: vi.fn(() => ({
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined),
          on: vi.fn(),
          send: vi.fn(),
        })),
      }));

      const mockSpawn = vi.fn(() => ({
        on: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'spawn') {
            setTimeout(() => callback(), 50);
          }
          return { on: vi.fn() };
        }),
        kill: vi.fn(),
        killed: false,
        stderr: { on: vi.fn() },
      }));

      vi.doMock('child_process', () => ({
        spawn: mockSpawn,
      }));

      // Connect to all servers
      const connections = await Promise.all(
        servers.map(config => utility.connectServer(config))
      );

      expect(connections.every(conn => conn.success)).toBe(true);
      expect(utility.getConnections()).toHaveLength(3);

      // Verify tool discovery across all servers
      const allTools = utility.getAllTools();
      expect(allTools.size).toBe(3);

      const allToolNames = Array.from(allTools.values())
        .flat()
        .map(tool => tool.name);

      expect(allToolNames).toContain('read_file');
      expect(allToolNames).toContain('git_status');
      expect(allToolNames).toContain('query');

      // Test refresh all tools
      const refreshResults = await utility.refreshAllTools();
      expect(refreshResults.size).toBe(3);
      expect(Array.from(refreshResults.values()).every(result => result.success)).toBe(true);
    });

    it('should handle server failure and recovery', async () => {
      const config: MCPServerConfig = {
        name: 'unstable-server',
        command: 'node',
        args: ['./unstable-server.js'],
        autoStart: true,
      };

      let shouldFail = true;

      // Mock a server that fails first, then succeeds
      vi.doMock('./mcp/index.js', () => ({
        MCPClient: vi.fn(() => ({
          connect: vi.fn(() => {
            if (shouldFail) {
              shouldFail = false;
              return Promise.reject(new Error('Server temporarily unavailable'));
            }
            return Promise.resolve();
          }),
          disconnect: vi.fn().mockResolvedValue(undefined),
          listTools: vi.fn().mockResolvedValue([
            { name: 'recovered_tool', description: 'Tool after recovery', inputSchema: {} },
          ]),
          on: vi.fn(),
        })),
        StdioTransport: vi.fn(() => ({
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined),
          on: vi.fn(),
          send: vi.fn(),
        })),
      }));

      const mockSpawn = vi.fn(() => ({
        on: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'spawn') {
            setTimeout(() => callback(), 50);
          }
          return { on: vi.fn() };
        }),
        kill: vi.fn(),
        killed: false,
        stderr: { on: vi.fn() },
      }));

      vi.doMock('child_process', () => ({
        spawn: mockSpawn,
      }));

      // First connection should fail
      const firstResult = await utility.connectServer(config);
      expect(firstResult.success).toBe(false);
      expect(firstResult.error).toContain('temporarily unavailable');

      // Second connection should succeed
      const secondResult = await utility.connectServer(config);
      expect(secondResult.success).toBe(true);
      expect(secondResult.connection?.tools).toHaveLength(1);
      expect(secondResult.connection?.tools[0].name).toBe('recovered_tool');
    });
  });

  describe('performance scenarios', () => {
    it('should handle rapid connection/disconnection cycles', async () => {
      const config: MCPServerConfig = {
        name: 'cycle-server',
        command: 'node',
        args: ['./cycle-server.js'],
        autoStart: true,
      };

      // Mock rapid operations
      vi.doMock('./mcp/index.js', () => ({
        MCPClient: vi.fn(() => ({
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined),
          listTools: vi.fn().mockResolvedValue([
            { name: 'cycle_tool', description: 'Cycle tool', inputSchema: {} },
          ]),
          on: vi.fn(),
        })),
        StdioTransport: vi.fn(() => ({
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined),
          on: vi.fn(),
          send: vi.fn(),
        })),
      }));

      const mockSpawn = vi.fn(() => ({
        on: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'spawn') {
            setTimeout(() => callback(), 10); // Fast startup
          }
          return { on: vi.fn() };
        }),
        kill: vi.fn(),
        killed: false,
        stderr: { on: vi.fn() },
      }));

      vi.doMock('child_process', () => ({
        spawn: mockSpawn,
      }));

      const cycles = 5;

      for (let i = 0; i < cycles; i++) {
        const connectResult = await utility.connectServer({
          ...config,
          name: `cycle-server-${i}`,
        });

        expect(connectResult.success).toBe(true);

        const connectionId = connectResult.connection!.id;
        await utility.disconnectServer(connectionId);
      }

      // All connections should be cleaned up
      expect(utility.getConnections()).toHaveLength(0);
      expect(utility.hasActiveConnections()).toBe(false);
    });

    it('should handle tool discovery under load', async () => {
      const configs = Array.from({ length: 10 }, (_, i) => ({
        name: `load-server-${i}`,
        command: 'node',
        args: [`./load-server-${i}.js`],
        autoStart: true,
      })) as MCPServerConfig[];

      // Mock servers with many tools
      vi.doMock('./mcp/index.js', () => ({
        MCPClient: vi.fn(() => ({
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined),
          listTools: vi.fn().mockResolvedValue(
            Array.from({ length: 20 }, (_, i) => ({
              name: `tool_${i}`,
              description: `Tool ${i}`,
              inputSchema: { type: 'object' },
            }))
          ),
          on: vi.fn(),
        })),
        StdioTransport: vi.fn(() => ({
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined),
          on: vi.fn(),
          send: vi.fn(),
        })),
      }));

      const mockSpawn = vi.fn(() => ({
        on: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'spawn') {
            setTimeout(() => callback(), 20);
          }
          return { on: vi.fn() };
        }),
        kill: vi.fn(),
        killed: false,
        stderr: { on: vi.fn() },
      }));

      vi.doMock('child_process', () => ({
        spawn: mockSpawn,
      }));

      // Connect to all servers concurrently
      const startTime = Date.now();
      const results = await Promise.all(
        configs.slice(0, 5).map(config => utility.connectServer(config)) // Limit to max connections
      );
      const endTime = Date.now();

      expect(results.every(result => result.success)).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all tools are discovered
      const allTools = utility.getAllTools();
      expect(allTools.size).toBe(5);

      const totalTools = Array.from(allTools.values())
        .reduce((sum, tools) => sum + tools.length, 0);
      expect(totalTools).toBe(100); // 5 servers × 20 tools each

      await utility.disconnectAll();
    });
  });

  describe('one-shot utility function', () => {
    it('should work with connectAndDiscoverMCPServer for quick operations', async () => {
      const config: MCPServerConfig = {
        name: 'quick-analysis-server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        autoStart: true,
      };

      // Mock for one-shot operation
      vi.doMock('./mcp/index.js', () => ({
        MCPClient: vi.fn(() => ({
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined),
          listTools: vi.fn().mockResolvedValue([
            { name: 'analyze', description: 'Analyze files', inputSchema: {} },
            { name: 'report', description: 'Generate report', inputSchema: {} },
          ]),
          on: vi.fn(),
        })),
        StdioTransport: vi.fn(() => ({
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined),
          on: vi.fn(),
          send: vi.fn(),
        })),
      }));

      const mockSpawn = vi.fn(() => ({
        on: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'spawn') {
            setTimeout(() => callback(), 50);
          }
          return { on: vi.fn() };
        }),
        kill: vi.fn(),
        killed: false,
        stderr: { on: vi.fn() },
      }));

      vi.doMock('child_process', () => ({
        spawn: mockSpawn,
      }));

      const result = await connectAndDiscoverMCPServer(config, {
        enableLogging: false,
        defaultTimeoutMs: 10000,
      });

      expect(result.success).toBe(true);
      expect(result.tools).toHaveLength(2);
      expect(result.tools.map(t => t.name)).toEqual(['analyze', 'report']);
      expect(result.connection).toBeDefined();

      // The connection should be automatically cleaned up
      // (checked by the utility's disconnectAll in the finally block)
    });

    it('should handle failures in one-shot operations', async () => {
      const config: MCPServerConfig = {
        name: 'failing-quick-server',
        command: 'non-existent-command',
        args: [],
        autoStart: true,
      };

      // Mock failure scenario
      vi.doMock('./mcp/index.js', () => ({
        MCPClient: vi.fn(() => ({
          connect: vi.fn().mockRejectedValue(new Error('Command not found')),
          disconnect: vi.fn().mockResolvedValue(undefined),
          listTools: vi.fn().mockResolvedValue([]),
          on: vi.fn(),
        })),
        StdioTransport: vi.fn(() => ({
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined),
          on: vi.fn(),
          send: vi.fn(),
        })),
      }));

      const mockSpawn = vi.fn(() => ({
        on: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Command not found')), 10);
          }
          return { on: vi.fn() };
        }),
        kill: vi.fn(),
        killed: false,
        stderr: { on: vi.fn() },
      }));

      vi.doMock('child_process', () => ({
        spawn: mockSpawn,
      }));

      const result = await connectAndDiscoverMCPServer(config);

      expect(result.success).toBe(false);
      expect(result.tools).toHaveLength(0);
      expect(result.error).toContain('Command not found');
      expect(result.connection).toBeUndefined();
    });
  });
});