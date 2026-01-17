/**
 * Integration test for MCP Tool Discovery in ApexOrchestrator
 * Tests the complete end-to-end flow from initialization to tool execution
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index.js';
import { initializeApex } from '@apexcli/core';
import type {
  MCPConnection,
  MCPConnectionState,
  MCPToolSchema,
  ClaudeSDKTool,
  ApexConfig
} from '@apexcli/core';
import { EventEmitter } from 'eventemitter3';

// Mock Claude Agent SDK
const mockQuery = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, opts: unknown, callback?: unknown) => {
    const cb = (typeof opts === 'function' ? opts : callback) as (error: Error | null, result?: { stdout: string }) => void;
    cb(null, { stdout: 'mock output' });
  }),
}));

describe('MCP Tool Discovery Integration', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;

  // Mock MCP tool definitions
  const mockMCPTools = [
    {
      name: 'file_reader',
      description: 'Read files from the file system',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to read',
          },
        },
        required: ['path'],
      } as MCPToolSchema,
    },
    {
      name: 'web_scraper',
      description: 'Scrape content from web pages',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to scrape',
          },
          selector: {
            type: 'string',
            description: 'CSS selector for content',
          },
        },
        required: ['url'],
      } as MCPToolSchema,
    },
  ];

  const mockClaudeSDKTools: ClaudeSDKTool[] = mockMCPTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));

  beforeEach(async () => {
    // Create temporary directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mcp-integration-'));

    // Initialize APEX project
    await initializeApex(tempDir);

    // Create comprehensive APEX configuration with MCP servers
    const apexDir = path.join(tempDir, '.apex');
    await fs.writeFile(path.join(apexDir, 'config.yaml'), `
project:
  name: mcp-integration-test
  version: 1.0.0
  description: Integration test for MCP tool discovery

limits:
  maxConcurrentTasks: 5
  maxDailyTasks: 100
  maxTokensPerTask: 100000

mcp:
  servers:
    filesystem:
      name: filesystem
      command: npx
      args:
        - "@modelcontextprotocol/server-filesystem"
        - "/tmp"
      env:
        NODE_ENV: test
    web-tools:
      name: web-tools
      command: python
      args:
        - "-m"
        - "web_tools_server"
      env:
        PYTHONPATH: /opt/mcp-servers
`);

    // Create agent definitions
    const agentsDir = path.join(apexDir, 'agents');
    await fs.writeFile(path.join(agentsDir, 'developer.md'), `
# Developer Agent

You are a software developer specialized in creating and modifying code files.

## Tools Available
- Standard development tools
- MCP tools for file operations and web research
`);

    await fs.writeFile(path.join(agentsDir, 'researcher.md'), `
# Research Agent

You are a research specialist who gathers information from various sources.

## Tools Available
- Web scraping and content analysis tools
- File system access for document analysis
`);

    // Create workflow definitions
    const workflowsDir = path.join(apexDir, 'workflows');
    await fs.writeFile(path.join(workflowsDir, 'feature-development.yaml'), `
name: Feature Development
description: Complete feature development workflow
gates: []
stages:
  - name: research
    agent: researcher
    description: Research requirements and existing implementations
  - name: development
    agent: developer
    description: Implement the feature
  - name: testing
    agent: developer
    description: Create and run tests
`);

    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Initialization with Real MCP Configuration', () => {
    test('should initialize orchestrator with MCP tool discovery', async () => {
      orchestrator = new ApexOrchestrator(tempDir);

      // Mock the MCP connection and tool discovery process
      const mockConnectionManager = {
        discoverServers: vi.fn().mockReturnValue([
          { name: 'filesystem', command: 'npx', args: ['@modelcontextprotocol/server-filesystem', '/tmp'] },
          { name: 'web-tools', command: 'python', args: ['-m', 'web_tools_server'] }
        ]),
        connect: vi.fn().mockImplementation((serverId: string) => {
          return Promise.resolve({
            serverId,
            serverName: serverId,
            state: 'connected' as MCPConnectionState,
            config: { name: serverId, command: 'mock', args: [] },
            client: new EventEmitter(),
            lastHealthCheck: Date.now(),
          } as MCPConnection);
        })
      };

      const mockToolRegistry = {
        addConnection: vi.fn().mockResolvedValue(undefined),
        refreshAllTools: vi.fn().mockResolvedValue(undefined),
        getAvailableTools: vi.fn().mockReturnValue(
          mockMCPTools.map((tool, index) => ({
            tool,
            claudeTool: mockClaudeSDKTools[index],
            serverId: index === 0 ? 'filesystem' : 'web-tools',
            serverName: index === 0 ? 'filesystem' : 'web-tools',
          }))
        ),
        getStats: vi.fn().mockReturnValue({
          totalTools: 2,
          serverCount: 2,
          lastRefresh: Date.now(),
          connectionStats: {
            'filesystem': {
              state: 'connected' as MCPConnectionState,
              toolCount: 1,
              lastSeen: Date.now(),
            },
            'web-tools': {
              state: 'connected' as MCPConnectionState,
              toolCount: 1,
              lastSeen: Date.now(),
            },
          },
        }),
      };

      await orchestrator.initialize();

      // Inject mocks after initialization
      (orchestrator as any).mcpConnectionManager = mockConnectionManager;
      (orchestrator as any).mcpToolRegistry = mockToolRegistry;

      // Verify MCP components are set up
      expect((orchestrator as any).mcpConnectionManager).toBeDefined();
      expect((orchestrator as any).mcpToolRegistry).toBeDefined();

      // Verify tool discovery works
      const availableTools = orchestrator.getMcpToolsForAgent();
      expect(availableTools).toHaveLength(2);
      expect(availableTools.map(t => t.name)).toEqual(['file_reader', 'web_scraper']);
    });

    test('should handle partial MCP server connection failures', async () => {
      orchestrator = new ApexOrchestrator(tempDir);

      const mockConnectionManager = {
        discoverServers: vi.fn().mockReturnValue([
          { name: 'filesystem', command: 'npx', args: ['@modelcontextprotocol/server-filesystem', '/tmp'] },
          { name: 'web-tools', command: 'python', args: ['-m', 'web_tools_server'] }
        ]),
        connect: vi.fn().mockImplementation((serverId: string) => {
          if (serverId === 'filesystem') {
            return Promise.resolve({
              serverId,
              serverName: serverId,
              state: 'connected' as MCPConnectionState,
              config: { name: serverId, command: 'mock', args: [] },
              client: new EventEmitter(),
              lastHealthCheck: Date.now(),
            } as MCPConnection);
          } else {
            return Promise.reject(new Error(`Failed to connect to ${serverId}`));
          }
        })
      };

      const mockToolRegistry = {
        addConnection: vi.fn().mockResolvedValue(undefined),
        refreshAllTools: vi.fn().mockResolvedValue(undefined),
        getAvailableTools: vi.fn().mockReturnValue([
          {
            tool: mockMCPTools[0],
            claudeTool: mockClaudeSDKTools[0],
            serverId: 'filesystem',
            serverName: 'filesystem',
          }
        ]),
        getStats: vi.fn().mockReturnValue({
          totalTools: 1,
          serverCount: 1,
          lastRefresh: Date.now(),
          connectionStats: {
            'filesystem': {
              state: 'connected' as MCPConnectionState,
              toolCount: 1,
              lastSeen: Date.now(),
            },
          },
        }),
      };

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await orchestrator.initialize();

      // Inject mocks
      (orchestrator as any).mcpConnectionManager = mockConnectionManager;
      (orchestrator as any).mcpToolRegistry = mockToolRegistry;

      // Should still provide tools from successful connections
      const availableTools = orchestrator.getMcpToolsForAgent();
      expect(availableTools).toHaveLength(1);
      expect(availableTools[0].name).toBe('file_reader');

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Tool Integration with Task Execution', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator(tempDir);
      await orchestrator.initialize();

      // Set up comprehensive mock for tool registry
      const mockToolRegistry = {
        addConnection: vi.fn().mockResolvedValue(undefined),
        refreshAllTools: vi.fn().mockResolvedValue(undefined),
        getAvailableTools: vi.fn().mockReturnValue(
          mockMCPTools.map((tool, index) => ({
            tool,
            claudeTool: mockClaudeSDKTools[index],
            serverId: index === 0 ? 'filesystem' : 'web-tools',
            serverName: index === 0 ? 'Filesystem Server' : 'Web Tools Server',
          }))
        ),
        getStats: vi.fn().mockReturnValue({
          totalTools: 2,
          serverCount: 2,
          lastRefresh: Date.now(),
          connectionStats: {
            'filesystem': {
              state: 'connected' as MCPConnectionState,
              toolCount: 1,
              lastSeen: Date.now(),
            },
            'web-tools': {
              state: 'connected' as MCPConnectionState,
              toolCount: 1,
              lastSeen: Date.now(),
            },
          },
        }),
      };

      (orchestrator as any).mcpToolRegistry = mockToolRegistry;
    });

    test('should provide MCP tools to agents during task execution', async () => {
      // Mock Claude Agent SDK to verify tools are provided
      mockQuery.mockResolvedValue({
        result: 'Task completed successfully',
        usage: { tokens: 100 },
      });

      // Create a simple task
      const task = await orchestrator.createTask({
        title: 'Test MCP Tool Integration',
        description: 'Test that MCP tools are available to agents',
        workflow: 'feature-development',
        stage: 'research',
      });

      // Start task execution
      await orchestrator.startTask(task.id);

      // Wait for task to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify that getMcpToolsForAgent was called during execution
      const availableTools = orchestrator.getMcpToolsForAgent();
      expect(availableTools).toHaveLength(2);

      // Verify tool format is correct for Claude SDK
      availableTools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('input_schema');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.input_schema).toBe('object');
      });
    });

    test('should handle tool refresh during execution', async () => {
      const mockToolRegistry = (orchestrator as any).mcpToolRegistry;

      // Initial tools
      expect(orchestrator.getMcpToolsForAgent()).toHaveLength(2);

      // Mock adding a new tool during refresh
      mockToolRegistry.getAvailableTools.mockReturnValue([
        ...mockMCPTools.map((tool, index) => ({
          tool,
          claudeTool: mockClaudeSDKTools[index],
          serverId: index === 0 ? 'filesystem' : 'web-tools',
          serverName: index === 0 ? 'Filesystem Server' : 'Web Tools Server',
        })),
        {
          tool: {
            name: 'database_query',
            description: 'Query database for information',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'SQL query' },
              },
              required: ['query'],
            },
          },
          claudeTool: {
            name: 'database_query',
            description: 'Query database for information',
            input_schema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'SQL query' },
              },
              required: ['query'],
            },
          },
          serverId: 'database',
          serverName: 'Database Server',
        },
      ]);

      // Refresh tools
      await orchestrator.refreshMcpTools();

      // Verify new tools are available
      const refreshedTools = orchestrator.getMcpToolsForAgent();
      expect(refreshedTools).toHaveLength(3);
      expect(refreshedTools.find(t => t.name === 'database_query')).toBeDefined();
    });

    test('should provide accurate tool statistics', () => {
      const stats = orchestrator.getMcpToolStats();

      expect(stats).toBeDefined();
      expect(stats?.totalTools).toBe(2);
      expect(stats?.serverCount).toBe(2);
      expect(stats?.lastRefresh).toBeTypeOf('number');
      expect(stats?.connectionStats).toBeDefined();

      // Verify connection stats
      expect(stats?.connectionStats).toHaveProperty('filesystem');
      expect(stats?.connectionStats).toHaveProperty('web-tools');
      expect(stats?.connectionStats?.['filesystem'].state).toBe('connected');
      expect(stats?.connectionStats?.['web-tools'].state).toBe('connected');
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should continue operation when tool registry fails', async () => {
      orchestrator = new ApexOrchestrator(tempDir);
      await orchestrator.initialize();

      // Mock failing tool registry
      const mockToolRegistry = {
        getAvailableTools: vi.fn().mockImplementation(() => {
          throw new Error('Registry connection lost');
        }),
        refreshAllTools: vi.fn().mockRejectedValue(new Error('Refresh failed')),
        getStats: vi.fn().mockImplementation(() => {
          throw new Error('Stats unavailable');
        }),
      };

      (orchestrator as any).mcpToolRegistry = mockToolRegistry;

      // Should handle failures gracefully
      expect(orchestrator.getMcpToolsForAgent()).toEqual([]);
      expect(orchestrator.getMcpToolStats()).toBeUndefined();
      await expect(orchestrator.refreshMcpTools()).rejects.toThrow('Refresh failed');
    });

    test('should handle MCP server disconnections during execution', async () => {
      orchestrator = new ApexOrchestrator(tempDir);
      await orchestrator.initialize();

      const mockToolRegistry = {
        getAvailableTools: vi.fn()
          .mockReturnValueOnce([
            {
              tool: mockMCPTools[0],
              claudeTool: mockClaudeSDKTools[0],
              serverId: 'filesystem',
              serverName: 'Filesystem Server',
            }
          ])
          .mockReturnValueOnce([]), // Simulate disconnection
        getStats: vi.fn()
          .mockReturnValueOnce({
            totalTools: 1,
            serverCount: 1,
            lastRefresh: Date.now(),
            connectionStats: {
              'filesystem': { state: 'connected' as MCPConnectionState, toolCount: 1, lastSeen: Date.now() },
            },
          })
          .mockReturnValueOnce({
            totalTools: 0,
            serverCount: 1,
            lastRefresh: Date.now(),
            connectionStats: {
              'filesystem': { state: 'disconnected' as MCPConnectionState, toolCount: 0, lastSeen: Date.now() },
            },
          }),
        refreshAllTools: vi.fn().mockResolvedValue(undefined),
      };

      (orchestrator as any).mcpToolRegistry = mockToolRegistry;

      // Initially has tools
      expect(orchestrator.getMcpToolsForAgent()).toHaveLength(1);
      let stats = orchestrator.getMcpToolStats();
      expect(stats?.connectionStats?.['filesystem'].state).toBe('connected');

      // After disconnection
      expect(orchestrator.getMcpToolsForAgent()).toHaveLength(0);
      stats = orchestrator.getMcpToolStats();
      expect(stats?.connectionStats?.['filesystem'].state).toBe('disconnected');
    });
  });

  describe('Configuration Validation', () => {
    test('should validate MCP server configurations during initialization', async () => {
      // Create config with invalid MCP server configuration
      const apexDir = path.join(tempDir, '.apex');
      await fs.writeFile(path.join(apexDir, 'config.yaml'), `
project:
  name: invalid-mcp-config
  version: 1.0.0
limits:
  maxConcurrentTasks: 5
  maxDailyTasks: 100
  maxTokensPerTask: 100000
mcp:
  servers:
    incomplete-server:
      name: incomplete-server
      # Missing command and args
    invalid-server:
      command: ""  # Empty command
      args: []
`);

      orchestrator = new ApexOrchestrator(tempDir);

      // Should initialize without throwing, but log warnings
      await expect(orchestrator.initialize()).resolves.not.toThrow();

      // Should have no tools available due to invalid configuration
      expect(orchestrator.getMcpToolsForAgent()).toEqual([]);
    });

    test('should handle missing MCP configuration section gracefully', async () => {
      // Create config without MCP section
      const apexDir = path.join(tempDir, '.apex');
      await fs.writeFile(path.join(apexDir, 'config.yaml'), `
project:
  name: no-mcp-config
  version: 1.0.0
limits:
  maxConcurrentTasks: 5
  maxDailyTasks: 100
  maxTokensPerTask: 100000
# No MCP section
`);

      orchestrator = new ApexOrchestrator(tempDir);
      await orchestrator.initialize();

      // Should handle gracefully
      expect(orchestrator.getMcpToolsForAgent()).toEqual([]);
      expect(orchestrator.getMcpToolStats()).toBeUndefined();
      await expect(orchestrator.refreshMcpTools()).resolves.not.toThrow();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent tool requests', async () => {
      orchestrator = new ApexOrchestrator(tempDir);
      await orchestrator.initialize();

      // Set up mock with many tools
      const manyMockTools = Array.from({ length: 50 }, (_, i) => ({
        name: `tool_${i}`,
        description: `Mock tool ${i}`,
        inputSchema: {
          type: 'object',
          properties: {
            param: { type: 'string' },
          },
        } as MCPToolSchema,
      }));

      const manyClaudeTools = manyMockTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      }));

      const mockToolRegistry = {
        getAvailableTools: vi.fn().mockReturnValue(
          manyMockTools.map((tool, index) => ({
            tool,
            claudeTool: manyClaudeTools[index],
            serverId: `server_${Math.floor(index / 10)}`,
            serverName: `Server ${Math.floor(index / 10)}`,
          }))
        ),
        getStats: vi.fn().mockReturnValue({
          totalTools: 50,
          serverCount: 5,
          lastRefresh: Date.now(),
        }),
        refreshAllTools: vi.fn().mockResolvedValue(undefined),
      };

      (orchestrator as any).mcpToolRegistry = mockToolRegistry;

      // Make concurrent requests
      const requests = Array.from({ length: 10 }, () =>
        Promise.resolve(orchestrator.getMcpToolsForAgent())
      );

      const results = await Promise.all(requests);

      // All requests should succeed and return the same tools
      results.forEach(tools => {
        expect(tools).toHaveLength(50);
        expect(tools[0].name).toBe('tool_0');
        expect(tools[49].name).toBe('tool_49');
      });
    });
  });
});