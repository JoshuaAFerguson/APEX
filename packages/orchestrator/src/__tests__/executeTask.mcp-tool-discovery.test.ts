/**
 * Comprehensive test suite for executeTask() MCP tool discovery integration
 *
 * This test suite validates:
 * 1. MCP tools are discovered at task start
 * 2. Built-in tools are merged with discovered MCP tools
 * 3. Combined tools are passed to Claude Agent SDK query()
 * 4. Error handling and fallback scenarios
 * 5. Tool deduplication and priority
 */

import { describe, test, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index.js';
import { initializeApex, type ClaudeSDKTool } from '@apexcli/core';
import type { MCPToolDefinition } from '../mcp/client.js';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Mock Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// Mock child_process for git operations
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

describe('executeTask MCP Tool Discovery Integration', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let mockQuery: MockInstance;

  const mockMcpTools: MCPToolDefinition[] = [
    {
      name: 'mcp_test_tool',
      description: 'Test MCP tool',
      inputSchema: {
        type: 'object',
        properties: {
          test_param: { type: 'string' }
        }
      }
    },
    {
      name: 'mcp_database_tool',
      description: 'Database query tool from MCP',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          database: { type: 'string' }
        }
      }
    },
    {
      name: 'Read', // Duplicate of built-in tool
      description: 'MCP version of Read tool',
      inputSchema: {
        type: 'object',
        properties: {
          file: { type: 'string' }
        }
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-execute-task-mcp-test-'));

    // Initialize APEX project
    await initializeApex(tempDir);

    // Create config with MCP server configuration
    const apexDir = path.join(tempDir, '.apex');
    await fs.writeFile(path.join(apexDir, 'config.yaml'), `
project:
  name: test-project
  version: 1.0.0
limits:
  maxConcurrentTasks: 5
  maxDailyTasks: 100
  maxTokensPerTask: 100000
  maxTurns: 10
mcp:
  servers:
    test-server:
      name: test-server
      command: node
      args: ['mock-server.js']
`);

    // Create test workflow
    await fs.writeFile(path.join(apexDir, 'workflows', 'test-workflow.yaml'), `
name: Test Workflow
version: 1.0.0
agents:
  - name: test-agent
    description: Test agent
    role: developer
stages:
  - name: test-stage
    description: Test stage
    agent: test-agent
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

  test('should discover MCP tools and merge with built-in tools at task start', async () => {
    // Mock MCP tool registry to return test tools
    if (orchestrator.mcpToolRegistry) {
      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockResolvedValue(undefined);

      const mockGetAvailableTools = vi.spyOn(orchestrator.mcpToolRegistry, 'getAvailableTools')
        .mockReturnValue(mockMcpTools.map(tool => ({
          mcpTool: tool,
          claudeTool: {
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema
            }
          } as ClaudeSDKTool,
          connectionId: 'test-connection',
          serverName: 'test-server',
          discoveredAt: new Date(),
          lastRefreshed: new Date(),
          available: true
        })));

      // Create test task
      const task = await orchestrator.createTask({
        title: 'Test MCP Integration',
        description: 'Test task for MCP tool discovery',
        workflow: 'test-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Execute task
      await orchestrator.executeTask(task.id);

      // Verify MCP tools were refreshed
      expect(mockRefreshAllTools).toHaveBeenCalled();

      // Verify available tools were retrieved
      expect(mockGetAvailableTools).toHaveBeenCalled();

      // Verify query was called with combined tools
      expect(mockQuery).toHaveBeenCalled();

      const queryCall = mockQuery.mock.calls[0][0];
      const passedTools = queryCall.options?.tools;

      // Should contain all built-in tools
      expectedBuiltInTools.forEach(toolName => {
        expect(passedTools).toContain(toolName);
      });

      // Should contain MCP tools (excluding duplicates)
      expect(passedTools).toContain('mcp_test_tool');
      expect(passedTools).toContain('mcp_database_tool');

      // Should not have duplicate 'Read' tool
      const readCount = passedTools?.filter((tool: string) => tool === 'Read').length;
      expect(readCount).toBe(1);

      // Verify total tools count makes sense
      expect(passedTools?.length).toBeGreaterThan(expectedBuiltInTools.length);
    }
  });

  test('should handle MCP tool registry refresh failure gracefully', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Mock refresh to fail
      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockRejectedValue(new Error('MCP refresh failed'));

      // Create test task
      const task = await orchestrator.createTask({
        title: 'Test MCP Failure',
        description: 'Test task for MCP failure handling',
        workflow: 'test-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Execute task (should not throw)
      await orchestrator.executeTask(task.id);

      // Verify query was still called with built-in tools only
      expect(mockQuery).toHaveBeenCalled();

      const queryCall = mockQuery.mock.calls[0][0];
      const passedTools = queryCall.options?.tools;

      // Should contain all built-in tools
      expectedBuiltInTools.forEach(toolName => {
        expect(passedTools).toContain(toolName);
      });

      // Should only have built-in tools (no MCP tools)
      expect(passedTools?.length).toBe(expectedBuiltInTools.length);
    }
  });

  test('should handle missing MCP tool registry gracefully', async () => {
    // Temporarily remove MCP tool registry
    const originalRegistry = orchestrator.mcpToolRegistry;
    orchestrator.mcpToolRegistry = undefined;

    try {
      // Create test task
      const task = await orchestrator.createTask({
        title: 'Test No MCP Registry',
        description: 'Test task with no MCP registry',
        workflow: 'test-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Execute task (should not throw)
      await orchestrator.executeTask(task.id);

      // Verify query was called with built-in tools only
      expect(mockQuery).toHaveBeenCalled();

      const queryCall = mockQuery.mock.calls[0][0];
      const passedTools = queryCall.options?.tools;

      // Should contain all built-in tools
      expectedBuiltInTools.forEach(toolName => {
        expect(passedTools).toContain(toolName);
      });

      // Should only have built-in tools
      expect(passedTools?.length).toBe(expectedBuiltInTools.length);
    } finally {
      // Restore MCP tool registry
      orchestrator.mcpToolRegistry = originalRegistry;
    }
  });

  test('should handle empty MCP tool list', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Mock empty tool list
      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockResolvedValue(undefined);

      const mockGetAvailableTools = vi.spyOn(orchestrator.mcpToolRegistry, 'getAvailableTools')
        .mockReturnValue([]);

      // Create test task
      const task = await orchestrator.createTask({
        title: 'Test Empty MCP Tools',
        description: 'Test task with empty MCP tool list',
        workflow: 'test-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Execute task
      await orchestrator.executeTask(task.id);

      // Verify query was called with built-in tools only
      expect(mockQuery).toHaveBeenCalled();

      const queryCall = mockQuery.mock.calls[0][0];
      const passedTools = queryCall.options?.tools;

      // Should contain all built-in tools
      expectedBuiltInTools.forEach(toolName => {
        expect(passedTools).toContain(toolName);
      });

      // Should only have built-in tools
      expect(passedTools?.length).toBe(expectedBuiltInTools.length);
    }
  });

  test('should store combined tools in currentTaskTools property', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Mock MCP tools
      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockResolvedValue(undefined);

      const mockGetAvailableTools = vi.spyOn(orchestrator.mcpToolRegistry, 'getAvailableTools')
        .mockReturnValue(mockMcpTools.slice(0, 2).map(tool => ({ // Only first 2 tools, no duplicates
          mcpTool: tool,
          claudeTool: {
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema
            }
          } as ClaudeSDKTool,
          connectionId: 'test-connection',
          serverName: 'test-server',
          discoveredAt: new Date(),
          lastRefreshed: new Date(),
          available: true
        })));

      // Create test task
      const task = await orchestrator.createTask({
        title: 'Test Current Task Tools',
        description: 'Test currentTaskTools property',
        workflow: 'test-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Execute task
      await orchestrator.executeTask(task.id);

      // Check that currentTaskTools is set correctly
      const currentTaskTools = orchestrator.currentTaskTools;
      expect(currentTaskTools).toBeDefined();

      if (currentTaskTools) {
        // Should contain all built-in tools
        expectedBuiltInTools.forEach(toolName => {
          expect(currentTaskTools).toContain(toolName);
        });

        // Should contain MCP tools
        expect(currentTaskTools).toContain('mcp_test_tool');
        expect(currentTaskTools).toContain('mcp_database_tool');

        // Should have no duplicates
        const uniqueTools = Array.from(new Set(currentTaskTools));
        expect(currentTaskTools.length).toBe(uniqueTools.length);
      }
    }
  });

  test('should log tool discovery process appropriately', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Mock MCP tools
      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockResolvedValue(undefined);

      const mockGetAvailableTools = vi.spyOn(orchestrator.mcpToolRegistry, 'getAvailableTools')
        .mockReturnValue(mockMcpTools.slice(0, 2).map(tool => ({
          mcpTool: tool,
          claudeTool: {
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema
            }
          } as ClaudeSDKTool,
          connectionId: 'test-connection',
          serverName: 'test-server',
          discoveredAt: new Date(),
          lastRefreshed: new Date(),
          available: true
        })));

      // Create test task
      const task = await orchestrator.createTask({
        title: 'Test Logging',
        description: 'Test tool discovery logging',
        workflow: 'test-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Execute task
      await orchestrator.executeTask(task.id);

      // Get task logs
      const logs = await orchestrator.store.getLogs(task.id);

      // Verify key log messages exist
      const logMessages = logs.map(log => log.message);

      expect(logMessages).toContain('Refreshed MCP tool registry at task start');
      expect(logMessages.some(msg => msg.includes('Discovered 2 MCP tools:'))).toBe(true);
      expect(logMessages.some(msg =>
        msg.includes('configured with') &&
        msg.includes('total tools') &&
        msg.includes('built-in') &&
        msg.includes('MCP')
      )).toBe(true);
    }
  });

  test('should log fallback scenario when MCP discovery fails', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Mock refresh to fail
      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockRejectedValue(new Error('Connection timeout'));

      // Create test task
      const task = await orchestrator.createTask({
        title: 'Test Fallback Logging',
        description: 'Test fallback logging when MCP fails',
        workflow: 'test-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Execute task
      await orchestrator.executeTask(task.id);

      // Get task logs
      const logs = await orchestrator.store.getLogs(task.id);

      // Verify error log and fallback message exist
      const logMessages = logs.map(log => log.message);

      expect(logMessages.some(msg =>
        msg.includes('Failed to discover MCP tools') &&
        msg.includes('Connection timeout') &&
        msg.includes('Using built-in tools only')
      )).toBe(true);
    }
  });

  test('should handle subtask execution with inherited tools', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Mock MCP tools
      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockResolvedValue(undefined);

      const mockGetAvailableTools = vi.spyOn(orchestrator.mcpToolRegistry, 'getAvailableTools')
        .mockReturnValue([mockMcpTools[0]].map(tool => ({
          mcpTool: tool,
          claudeTool: {
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema
            }
          } as ClaudeSDKTool,
          connectionId: 'test-connection',
          serverName: 'test-server',
          discoveredAt: new Date(),
          lastRefreshed: new Date(),
          available: true
        })));

      // Create parent task
      const parentTask = await orchestrator.createTask({
        title: 'Parent Task',
        description: 'Parent task with subtasks',
        workflow: 'test-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Create subtask
      const subtask = await orchestrator.createSubtask(parentTask.id, {
        title: 'Subtask',
        description: 'Child subtask',
        workflow: 'test-workflow',
        priority: 'medium'
      });

      // Execute parent task (will execute subtasks)
      await orchestrator.executeTask(parentTask.id);

      // Verify query was called for both parent and subtask contexts
      expect(mockQuery).toHaveBeenCalled();

      // Check that all query calls have the same combined tools
      const allQueryCalls = mockQuery.mock.calls;
      for (const call of allQueryCalls) {
        const passedTools = call[0].options?.tools;
        expect(passedTools).toContain('mcp_test_tool');
        expectedBuiltInTools.forEach(toolName => {
          expect(passedTools).toContain(toolName);
        });
      }
    }
  });
});