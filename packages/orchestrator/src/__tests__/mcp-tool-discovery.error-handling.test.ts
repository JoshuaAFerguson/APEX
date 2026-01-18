/**
 * Error handling and edge case tests for MCP tool discovery
 *
 * This test suite validates robust error handling in:
 * 1. Network timeouts and connection failures
 * 2. Malformed tool schemas and invalid responses
 * 3. Registry corruption and recovery scenarios
 * 4. Memory pressure and resource constraints
 * 5. Concurrent access and race conditions
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

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, opts: unknown, callback?: unknown) => {
    const cb = (typeof opts === 'function' ? opts : callback) as (error: Error | null, result?: { stdout: string }) => void;
    cb(null, { stdout: '' });
  }),
}));

describe('MCP Tool Discovery Error Handling', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let mockQuery: MockInstance;

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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mcp-error-test-'));

    // Initialize APEX project
    await initializeApex(tempDir);

    // Create config
    const apexDir = path.join(tempDir, '.apex');
    await fs.writeFile(path.join(apexDir, 'config.yaml'), `
project:
  name: error-test-project
  version: 1.0.0
limits:
  maxConcurrentTasks: 5
  maxDailyTasks: 100
  maxTokensPerTask: 100000
  maxTurns: 10
mcp:
  servers:
    error-server:
      name: error-server
      command: node
      args: ['error-server.js']
`);

    // Create test workflow
    await fs.writeFile(path.join(apexDir, 'workflows', 'error-workflow.yaml'), `
name: Error Test Workflow
version: 1.0.0
agents:
  - name: error-agent
    description: Agent for error testing
    role: developer
stages:
  - name: error-stage
    description: Error testing stage
    agent: error-agent
    inputs: []
    outputs: []
`);

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator(tempDir);
    await orchestrator.initialize();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('should handle registry refresh timeout gracefully', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Mock refresh to timeout
      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockImplementation(async () => {
          // Simulate timeout
          await new Promise((_, reject) => {
            setTimeout(() => reject(new Error('TIMEOUT: Registry refresh timed out')), 50);
          });
        });

      // Create test task
      const task = await orchestrator.createTask({
        title: 'Timeout Test',
        description: 'Test registry refresh timeout handling',
        workflow: 'error-workflow',
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

      // Should only have built-in tools (no MCP tools due to timeout)
      expect(passedTools?.length).toBe(expectedBuiltInTools.length);

      // Check error was logged
      const logs = await orchestrator.store.getLogs(task.id);
      const logMessages = logs.map(log => log.message);

      expect(logMessages.some(msg =>
        msg.includes('Failed to discover MCP tools') &&
        msg.includes('TIMEOUT') &&
        msg.includes('Using built-in tools only')
      )).toBe(true);
    }
  });

  test('should handle malformed tool schemas', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Mock registry to return malformed tools
      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockResolvedValue(undefined);

      const malformedTools = [
        {
          mcpTool: {
            name: 'valid_tool',
            description: 'A valid tool',
            inputSchema: {
              type: 'object',
              properties: {
                param: { type: 'string' }
              }
            }
          },
          claudeTool: {
            type: 'function',
            function: {
              name: 'valid_tool',
              description: 'A valid tool',
              parameters: {
                type: 'object',
                properties: {
                  param: { type: 'string' }
                }
              }
            }
          } as ClaudeSDKTool,
          connectionId: 'test-connection',
          serverName: 'test-server',
          discoveredAt: new Date(),
          lastRefreshed: new Date(),
          available: true
        },
        {
          mcpTool: {
            name: '', // Invalid empty name
            description: 'Tool with empty name',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          } as MCPToolDefinition,
          claudeTool: {
            type: 'function',
            function: {
              name: '',
              description: 'Tool with empty name',
              parameters: {}
            }
          } as ClaudeSDKTool,
          connectionId: 'test-connection',
          serverName: 'test-server',
          discoveredAt: new Date(),
          lastRefreshed: new Date(),
          available: true
        }
      ];

      const mockGetAvailableTools = vi.spyOn(orchestrator.mcpToolRegistry, 'getAvailableTools')
        .mockReturnValue(malformedTools);

      // Create test task
      const task = await orchestrator.createTask({
        title: 'Malformed Schema Test',
        description: 'Test handling of malformed tool schemas',
        workflow: 'error-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Execute task (should not throw)
      await orchestrator.executeTask(task.id);

      const queryCall = mockQuery.mock.calls[0][0];
      const passedTools = queryCall.options?.tools;

      // Should contain valid tool
      expect(passedTools).toContain('valid_tool');

      // Should not contain malformed tool (empty name)
      expect(passedTools?.filter((tool: string) => tool === '').length).toBe(0);

      // Should still contain built-in tools
      expectedBuiltInTools.forEach(toolName => {
        expect(passedTools).toContain(toolName);
      });
    }
  });

  test('should handle registry getAvailableTools throwing error', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Mock refresh to succeed but getAvailableTools to fail
      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockResolvedValue(undefined);

      const mockGetAvailableTools = vi.spyOn(orchestrator.mcpToolRegistry, 'getAvailableTools')
        .mockImplementation(() => {
          throw new Error('Registry corrupted - unable to retrieve tools');
        });

      // Create test task
      const task = await orchestrator.createTask({
        title: 'Registry Corruption Test',
        description: 'Test handling of registry corruption',
        workflow: 'error-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Execute task (should not throw)
      await orchestrator.executeTask(task.id);

      const queryCall = mockQuery.mock.calls[0][0];
      const passedTools = queryCall.options?.tools;

      // Should only have built-in tools
      expect(passedTools?.length).toBe(expectedBuiltInTools.length);
      expectedBuiltInTools.forEach(toolName => {
        expect(passedTools).toContain(toolName);
      });

      // Check error was logged
      const logs = await orchestrator.store.getLogs(task.id);
      const logMessages = logs.map(log => log.message);

      expect(logMessages.some(msg =>
        msg.includes('Failed to discover MCP tools') &&
        msg.includes('Registry corrupted') &&
        msg.includes('Using built-in tools only')
      )).toBe(true);
    }
  });

  test('should handle tools with null or undefined properties', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Mock registry with tools having null/undefined properties
      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockResolvedValue(undefined);

      const problematicTools = [
        {
          mcpTool: {
            name: 'null_description_tool',
            description: null as any,
            inputSchema: {
              type: 'object',
              properties: {
                param: { type: 'string' }
              }
            }
          } as MCPToolDefinition,
          claudeTool: {
            type: 'function',
            function: {
              name: 'null_description_tool',
              description: '',
              parameters: {
                type: 'object',
                properties: {
                  param: { type: 'string' }
                }
              }
            }
          } as ClaudeSDKTool,
          connectionId: 'test-connection',
          serverName: 'test-server',
          discoveredAt: new Date(),
          lastRefreshed: new Date(),
          available: true
        },
        {
          mcpTool: {
            name: 'undefined_schema_tool',
            description: 'Tool with undefined schema',
            inputSchema: undefined as any
          } as MCPToolDefinition,
          claudeTool: {
            type: 'function',
            function: {
              name: 'undefined_schema_tool',
              description: 'Tool with undefined schema',
              parameters: {}
            }
          } as ClaudeSDKTool,
          connectionId: 'test-connection',
          serverName: 'test-server',
          discoveredAt: new Date(),
          lastRefreshed: new Date(),
          available: true
        }
      ];

      const mockGetAvailableTools = vi.spyOn(orchestrator.mcpToolRegistry, 'getAvailableTools')
        .mockReturnValue(problematicTools);

      // Create test task
      const task = await orchestrator.createTask({
        title: 'Null Properties Test',
        description: 'Test handling of tools with null/undefined properties',
        workflow: 'error-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Execute task (should not throw)
      await orchestrator.executeTask(task.id);

      const queryCall = mockQuery.mock.calls[0][0];
      const passedTools = queryCall.options?.tools;

      // Tools might be included if they have valid names, but execution should be stable
      expect(Array.isArray(passedTools)).toBe(true);

      // Should still contain built-in tools
      expectedBuiltInTools.forEach(toolName => {
        expect(passedTools).toContain(toolName);
      });
    }
  });

  test('should handle registry returning extremely large tool list', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Create a large number of tools to test memory/performance handling
      const largeMcpTools = Array.from({ length: 1000 }, (_, i) => ({
        mcpTool: {
          name: `large_tool_${i}`,
          description: `Large tool number ${i}`,
          inputSchema: {
            type: 'object',
            properties: {
              param: { type: 'string' }
            }
          }
        } as MCPToolDefinition,
        claudeTool: {
          type: 'function',
          function: {
            name: `large_tool_${i}`,
            description: `Large tool number ${i}`,
            parameters: {
              type: 'object',
              properties: {
                param: { type: 'string' }
              }
            }
          }
        } as ClaudeSDKTool,
        connectionId: 'large-server',
        serverName: 'large-server',
        discoveredAt: new Date(),
        lastRefreshed: new Date(),
        available: true
      }));

      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockResolvedValue(undefined);

      const mockGetAvailableTools = vi.spyOn(orchestrator.mcpToolRegistry, 'getAvailableTools')
        .mockReturnValue(largeMcpTools);

      // Create test task
      const task = await orchestrator.createTask({
        title: 'Large Tool List Test',
        description: 'Test handling of large tool lists',
        workflow: 'error-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Execute task (should not throw or timeout)
      const startTime = Date.now();
      await orchestrator.executeTask(task.id);
      const endTime = Date.now();

      // Should complete within reasonable time (less than 30 seconds)
      expect(endTime - startTime).toBeLessThan(30000);

      const queryCall = mockQuery.mock.calls[0][0];
      const passedTools = queryCall.options?.tools;

      // Should have all tools (built-in + large list)
      expect(passedTools?.length).toBe(expectedBuiltInTools.length + 1000);

      // Should still contain built-in tools
      expectedBuiltInTools.forEach(toolName => {
        expect(passedTools).toContain(toolName);
      });

      // Should contain some of the large tools
      expect(passedTools).toContain('large_tool_0');
      expect(passedTools).toContain('large_tool_999');
    }
  });

  test('should handle concurrent task executions with MCP discovery', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Mock MCP tools with slight delay to increase chance of race conditions
      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 10)); // 10ms delay
        });

      const concurrentTools = [
        {
          mcpTool: {
            name: 'concurrent_tool',
            description: 'Tool for concurrent testing',
            inputSchema: {
              type: 'object',
              properties: {
                param: { type: 'string' }
              }
            }
          } as MCPToolDefinition,
          claudeTool: {
            type: 'function',
            function: {
              name: 'concurrent_tool',
              description: 'Tool for concurrent testing',
              parameters: {
                type: 'object',
                properties: {
                  param: { type: 'string' }
                }
              }
            }
          } as ClaudeSDKTool,
          connectionId: 'concurrent-server',
          serverName: 'concurrent-server',
          discoveredAt: new Date(),
          lastRefreshed: new Date(),
          available: true
        }
      ];

      const mockGetAvailableTools = vi.spyOn(orchestrator.mcpToolRegistry, 'getAvailableTools')
        .mockReturnValue(concurrentTools);

      // Create multiple tasks
      const tasks = await Promise.all([
        orchestrator.createTask({
          title: 'Concurrent Task 1',
          description: 'First concurrent task',
          workflow: 'error-workflow',
          priority: 'medium',
          dependencies: []
        }),
        orchestrator.createTask({
          title: 'Concurrent Task 2',
          description: 'Second concurrent task',
          workflow: 'error-workflow',
          priority: 'medium',
          dependencies: []
        }),
        orchestrator.createTask({
          title: 'Concurrent Task 3',
          description: 'Third concurrent task',
          workflow: 'error-workflow',
          priority: 'medium',
          dependencies: []
        })
      ]);

      // Execute tasks concurrently
      await Promise.all(tasks.map(task => orchestrator.executeTask(task.id)));

      // All tasks should complete successfully
      expect(mockQuery).toHaveBeenCalledTimes(3);

      // Each call should have the same tool set
      const allQueryCalls = mockQuery.mock.calls;
      for (const call of allQueryCalls) {
        const passedTools = call[0].options?.tools;

        // Should contain built-in tools
        expectedBuiltInTools.forEach(toolName => {
          expect(passedTools).toContain(toolName);
        });

        // Should contain concurrent tool
        expect(passedTools).toContain('concurrent_tool');
      }
    }
  });

  test('should handle MCP registry being undefined during execution', async () => {
    // Create test task
    const task = await orchestrator.createTask({
      title: 'Undefined Registry Test',
      description: 'Test handling of undefined registry during execution',
      workflow: 'error-workflow',
      priority: 'medium',
      dependencies: []
    });

    // Remove registry after task creation but before execution
    orchestrator.mcpToolRegistry = undefined;

    // Execute task (should not throw)
    await orchestrator.executeTask(task.id);

    const queryCall = mockQuery.mock.calls[0][0];
    const passedTools = queryCall.options?.tools;

    // Should only have built-in tools
    expect(passedTools?.length).toBe(expectedBuiltInTools.length);
    expectedBuiltInTools.forEach(toolName => {
      expect(passedTools).toContain(toolName);
    });
  });

  test('should handle memory exhaustion during tool discovery', async () => {
    if (orchestrator.mcpToolRegistry) {
      // Mock memory-intensive operation
      const mockRefreshAllTools = vi.spyOn(orchestrator.mcpToolRegistry, 'refreshAllTools')
        .mockImplementation(async () => {
          // Simulate memory exhaustion
          throw new Error('ENOMEM: Not enough memory');
        });

      // Create test task
      const task = await orchestrator.createTask({
        title: 'Memory Exhaustion Test',
        description: 'Test handling of memory exhaustion',
        workflow: 'error-workflow',
        priority: 'medium',
        dependencies: []
      });

      // Execute task (should not throw)
      await orchestrator.executeTask(task.id);

      const queryCall = mockQuery.mock.calls[0][0];
      const passedTools = queryCall.options?.tools;

      // Should fallback to built-in tools
      expect(passedTools?.length).toBe(expectedBuiltInTools.length);
      expectedBuiltInTools.forEach(toolName => {
        expect(passedTools).toContain(toolName);
      });

      // Check error was logged appropriately
      const logs = await orchestrator.store.getLogs(task.id);
      const logMessages = logs.map(log => log.message);

      expect(logMessages.some(msg =>
        msg.includes('Failed to discover MCP tools') &&
        msg.includes('ENOMEM') &&
        msg.includes('Using built-in tools only')
      )).toBe(true);
    }
  });
});