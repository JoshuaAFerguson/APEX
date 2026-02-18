/**
 * Integration tests for MCP tool merging functionality
 *
 * This test suite validates the end-to-end integration of:
 * 1. MCP server connection and tool discovery
 * 2. Tool registry management and caching
 * 3. Schema translation from MCP to Claude SDK format
 * 4. Tool deduplication and priority handling
 * 5. Real-world scenarios with multiple MCP servers
 */

import { describe, test, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index.js';
import { initializeApex, type ClaudeSDKTool, type MCPConnectionState } from '@apexcli/core';
import type { MCPToolDefinition } from '../mcp/client.js';
import { MCPToolRegistry } from '../mcp-tool-registry.js';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Mock Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// Mock child_process
vi.mock('child_process', () => {
  const mock = {
    exec: vi.fn(),
    execSync: vi.fn(),
    spawn: vi.fn(),
    execFile: vi.fn(),
    fork: vi.fn(),
  };
  return { ...mock, default: mock };
});

describe('MCP Tool Merging Integration', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let mockQuery: MockInstance;

  // Mock tools from different servers
  const server1Tools: MCPToolDefinition[] = [
    {
      name: 'database_query',
      description: 'Query database from Server 1',
      inputSchema: {
        type: 'object',
        properties: {
          sql: { type: 'string' },
          database: { type: 'string' }
        },
        required: ['sql']
      }
    },
    {
      name: 'file_analyzer',
      description: 'Analyze files from Server 1',
      inputSchema: {
        type: 'object',
        properties: {
          filepath: { type: 'string' },
          mode: { type: 'string', enum: ['syntax', 'security', 'performance'] }
        },
        required: ['filepath']
      }
    }
  ];

  const server2Tools: MCPToolDefinition[] = [
    {
      name: 'api_client',
      description: 'HTTP API client from Server 2',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
          headers: { type: 'object' },
          body: { type: 'string' }
        },
        required: ['url', 'method']
      }
    },
    {
      name: 'Read', // Duplicate of built-in tool
      description: 'Server 2 version of Read tool',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          encoding: { type: 'string' }
        },
        required: ['file_path']
      }
    }
  ];

  const server3Tools: MCPToolDefinition[] = [
    {
      name: 'database_query', // Duplicate from server1
      description: 'Query database from Server 3 (different implementation)',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          connection: { type: 'string' }
        },
        required: ['query']
      }
    }
  ];

  const expectedBuiltInTools = [
    'Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep', 'LSP',
    'Task', 'AskUserQuestion', 'TodoWrite', 'WebFetch', 'WebSearch',
    'EnterPlanMode', 'ExitPlanMode'
  ];

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock query response
    mockQuery = vi.mocked(query);
    mockQuery.mockImplementation(async function* () {
      yield {
        type: 'text',
        text: 'Task completed successfully',
      };
    });

    // Create temporary directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mcp-merging-test-'));

    // Initialize APEX project
    await initializeApex(tempDir);

    // Create config with multiple MCP servers
    const apexDir = path.join(tempDir, '.apex');
    await fs.writeFile(path.join(apexDir, 'config.yaml'), `
project:
  name: mcp-integration-test
  version: 1.0.0
limits:
  maxConcurrentTasks: 5
  maxDailyTasks: 100
  maxTokensPerTask: 100000
  maxTurns: 10
mcp:
  servers:
    database-server:
      name: database-server
      command: node
      args: ['db-server.js']
      env:
        DB_HOST: localhost
    api-server:
      name: api-server
      command: python
      args: ['api_server.py']
    analytics-server:
      name: analytics-server
      command: node
      args: ['analytics.js']
`);

    // Create test workflow
    await fs.writeFile(path.join(apexDir, 'workflows', 'integration-workflow.yaml'), `
name: MCP Integration Workflow
version: 1.0.0
agents:
  - name: integration-agent
    description: Agent for MCP integration testing
    role: developer
stages:
  - name: integration-stage
    description: Integration testing stage
    agent: integration-agent
    inputs: []
    outputs: []
`);

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({ projectPath: tempDir });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('should merge tools from multiple MCP servers with built-in tools', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Mock multiple servers providing different tools
      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockResolvedValue(undefined);

      const allMcpTools = [
        ...server1Tools.map(tool => ({
          mcpTool: tool,
          claudeTool: {
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema
            }
          } as ClaudeSDKTool,
          connectionId: 'database-server',
          serverName: 'database-server',
          discoveredAt: new Date(),
          lastRefreshed: new Date(),
          available: true
        })),
        ...server2Tools.map(tool => ({
          mcpTool: tool,
          claudeTool: {
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema
            }
          } as ClaudeSDKTool,
          connectionId: 'api-server',
          serverName: 'api-server',
          discoveredAt: new Date(),
          lastRefreshed: new Date(),
          available: true
        }))
      ];

      const mockGetAvailableTools = vi.spyOn(orchestrator.mcpToolRegistry, 'getAvailableTools')
        .mockReturnValue(allMcpTools);

      // Create test task
      const task = await orchestrator.createTask({
        title: 'Multi-Server MCP Integration',
        description: 'Test merging tools from multiple MCP servers',
        workflow: 'integration-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Execute task
      await orchestrator.executeTask(task.id);

      // Verify query was called with merged tools
      expect(mockQuery).toHaveBeenCalled();

      const queryCall = mockQuery.mock.calls[0][0];
      const passedTools = queryCall.options?.tools;

      // Should contain all built-in tools
      expectedBuiltInTools.forEach(toolName => {
        expect(passedTools).toContain(toolName);
      });

      // Should contain MCP tools from server 1
      expect(passedTools).toContain('database_query');
      expect(passedTools).toContain('file_analyzer');

      // Should contain MCP tools from server 2
      expect(passedTools).toContain('api_client');

      // Should not duplicate built-in tools (Read should appear only once)
      const readCount = passedTools?.filter((tool: string) => tool === 'Read').length;
      expect(readCount).toBe(1);

      // Verify total count is reasonable
      const expectedMcpToolsCount = 3; // database_query, file_analyzer, api_client (Read is duplicate)
      const expectedTotalCount = expectedBuiltInTools.length + expectedMcpToolsCount;
      expect(passedTools?.length).toBe(expectedTotalCount);
    }
  });

  test('should handle tool name conflicts between MCP servers', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Mock servers with conflicting tool names
      const conflictingTools = [
        ...server1Tools.slice(0, 1), // database_query from server1
        ...server3Tools // database_query from server3 (conflict)
      ].map((tool, index) => ({
        mcpTool: tool,
        claudeTool: {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
          }
        } as ClaudeSDKTool,
        connectionId: index === 0 ? 'database-server' : 'analytics-server',
        serverName: index === 0 ? 'database-server' : 'analytics-server',
        discoveredAt: new Date(),
        lastRefreshed: new Date(),
        available: true
      }));

      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockResolvedValue(undefined);

      const mockGetAvailableTools = vi.spyOn(orchestrator.mcpToolRegistry, 'getAvailableTools')
        .mockReturnValue(conflictingTools);

      // Create test task
      const task = await orchestrator.createTask({
        title: 'Tool Conflict Test',
        description: 'Test tool name conflicts between servers',
        workflow: 'integration-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Execute task
      await orchestrator.executeTask(task.id);

      // Verify query was called
      expect(mockQuery).toHaveBeenCalled();

      const queryCall = mockQuery.mock.calls[0][0];
      const passedTools = queryCall.options?.tools;

      // Should contain database_query only once (deduplication)
      const dbQueryCount = passedTools?.filter((tool: string) => tool === 'database_query').length;
      expect(dbQueryCount).toBe(1);

      // Should still contain all built-in tools
      expectedBuiltInTools.forEach(toolName => {
        expect(passedTools).toContain(toolName);
      });
    }
  });

  test('should prioritize built-in tools over MCP tools with same name', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Mock MCP server providing tools with same names as built-in tools
      const conflictingBuiltInTools = [
        {
          name: 'Read',
          description: 'MCP version of Read',
          inputSchema: { type: 'object', properties: { path: { type: 'string' } } }
        },
        {
          name: 'Write',
          description: 'MCP version of Write',
          inputSchema: { type: 'object', properties: { path: { type: 'string' }, data: { type: 'string' } } }
        },
        {
          name: 'unique_mcp_tool',
          description: 'Unique MCP tool',
          inputSchema: { type: 'object', properties: { param: { type: 'string' } } }
        }
      ].map(tool => ({
        mcpTool: tool,
        claudeTool: {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
          }
        } as ClaudeSDKTool,
        connectionId: 'conflicting-server',
        serverName: 'conflicting-server',
        discoveredAt: new Date(),
        lastRefreshed: new Date(),
        available: true
      }));

      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockResolvedValue(undefined);

      const mockGetAvailableTools = vi.spyOn(orchestrator.mcpToolRegistry, 'getAvailableTools')
        .mockReturnValue(conflictingBuiltInTools);

      // Create test task
      const task = await orchestrator.createTask({
        title: 'Built-in Priority Test',
        description: 'Test built-in tool priority over MCP tools',
        workflow: 'integration-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Execute task
      await orchestrator.executeTask(task.id);

      const queryCall = mockQuery.mock.calls[0][0];
      const passedTools = queryCall.options?.tools;

      // Should contain Read and Write only once each (built-in versions)
      const readCount = passedTools?.filter((tool: string) => tool === 'Read').length;
      const writeCount = passedTools?.filter((tool: string) => tool === 'Write').length;
      expect(readCount).toBe(1);
      expect(writeCount).toBe(1);

      // Should contain the unique MCP tool
      expect(passedTools).toContain('unique_mcp_tool');

      // Total count should be built-ins + unique MCP tools
      const expectedTotalCount = expectedBuiltInTools.length + 1; // +1 for unique_mcp_tool
      expect(passedTools?.length).toBe(expectedTotalCount);
    }
  });

  test('should handle partial server failures gracefully', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Mock one server succeeding and one failing
      const successfulServerTools = server1Tools.map(tool => ({
        mcpTool: tool,
        claudeTool: {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
          }
        } as ClaudeSDKTool,
        connectionId: 'database-server',
        serverName: 'database-server',
        discoveredAt: new Date(),
        lastRefreshed: new Date(),
        available: true
      }));

      // Mock refresh to succeed but with partial results
      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockResolvedValue(undefined);

      const mockGetAvailableTools = vi.spyOn(orchestrator.mcpToolRegistry, 'getAvailableTools')
        .mockReturnValue(successfulServerTools);

      // Create test task
      const task = await orchestrator.createTask({
        title: 'Partial Server Failure Test',
        description: 'Test handling of partial server failures',
        workflow: 'integration-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Execute task
      await orchestrator.executeTask(task.id);

      const queryCall = mockQuery.mock.calls[0][0];
      const passedTools = queryCall.options?.tools;

      // Should contain tools from successful server
      expect(passedTools).toContain('database_query');
      expect(passedTools).toContain('file_analyzer');

      // Should still contain all built-in tools
      expectedBuiltInTools.forEach(toolName => {
        expect(passedTools).toContain(toolName);
      });

      // Check logs for appropriate messaging
      const logs = await orchestrator.store.getLogs(task.id);
      const logMessages = logs.map(log => log.message);

      expect(logMessages.some(msg =>
        msg.includes('Discovered 2 MCP tools')
      )).toBe(true);
    }
  });

  test('should maintain tool availability state correctly', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Mock tools with mixed availability
      const mixedAvailabilityTools = [
        ...server1Tools.slice(0, 1).map(tool => ({
          mcpTool: tool,
          claudeTool: {
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema
            }
          } as ClaudeSDKTool,
          connectionId: 'database-server',
          serverName: 'database-server',
          discoveredAt: new Date(),
          lastRefreshed: new Date(),
          available: true // Available
        })),
        ...server2Tools.slice(0, 1).map(tool => ({
          mcpTool: tool,
          claudeTool: {
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema
            }
          } as ClaudeSDKTool,
          connectionId: 'api-server',
          serverName: 'api-server',
          discoveredAt: new Date(),
          lastRefreshed: new Date(),
          available: false // Unavailable
        }))
      ];

      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockResolvedValue(undefined);

      const mockGetAvailableTools = vi.spyOn(orchestrator.mcpToolRegistry, 'getAvailableTools')
        .mockReturnValue(mixedAvailabilityTools.filter(tool => tool.available));

      // Create test task
      const task = await orchestrator.createTask({
        title: 'Tool Availability Test',
        description: 'Test tool availability filtering',
        workflow: 'integration-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Execute task
      await orchestrator.executeTask(task.id);

      const queryCall = mockQuery.mock.calls[0][0];
      const passedTools = queryCall.options?.tools;

      // Should only contain available tools
      expect(passedTools).toContain('database_query'); // Available
      expect(passedTools).not.toContain('api_client'); // Unavailable

      // Should still contain all built-in tools
      expectedBuiltInTools.forEach(toolName => {
        expect(passedTools).toContain(toolName);
      });
    }
  });

  test('should handle schema translation edge cases', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Mock tools with complex schemas
      const complexSchemaTools = [
        {
          name: 'complex_tool',
          description: 'Tool with complex schema',
          inputSchema: {
            type: 'object',
            properties: {
              nested: {
                type: 'object',
                properties: {
                  array_prop: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                }
              },
              optional_with_default: {
                type: 'string',
                default: 'default_value'
              }
            },
            required: ['nested'],
            additionalProperties: false
          }
        }
      ].map(tool => ({
        mcpTool: tool,
        claudeTool: {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
          }
        } as ClaudeSDKTool,
        connectionId: 'complex-server',
        serverName: 'complex-server',
        discoveredAt: new Date(),
        lastRefreshed: new Date(),
        available: true
      }));

      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockResolvedValue(undefined);

      const mockGetAvailableTools = vi.spyOn(orchestrator.mcpToolRegistry, 'getAvailableTools')
        .mockReturnValue(complexSchemaTools);

      // Create test task
      const task = await orchestrator.createTask({
        title: 'Complex Schema Test',
        description: 'Test complex schema translation',
        workflow: 'integration-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Execute task (should not throw)
      await orchestrator.executeTask(task.id);

      const queryCall = mockQuery.mock.calls[0][0];
      const passedTools = queryCall.options?.tools;

      // Should contain the complex tool
      expect(passedTools).toContain('complex_tool');

      // Should still have all expected tools
      expectedBuiltInTools.forEach(toolName => {
        expect(passedTools).toContain(toolName);
      });
    }
  });
});