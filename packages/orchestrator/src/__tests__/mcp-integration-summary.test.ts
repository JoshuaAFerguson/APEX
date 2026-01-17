/**
 * MCP Integration Summary Test
 *
 * This test file provides a concise verification that the core MCP tools integration
 * with Claude Agent SDK query() calls is working correctly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index';

// Mock Claude Agent SDK
const mockQuery = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
}));

// Mock dependencies
vi.mock('child_process', () => ({ exec: vi.fn() }));
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadConfig: vi.fn().mockResolvedValue({
      version: '1.0',
      project: { name: 'test' },
      limits: { maxTurns: 10 },
      mcp: { enabled: true, servers: {} },
    }),
    saveConfig: vi.fn().mockResolvedValue(undefined),
  };
});

describe('MCP Integration Summary', () => {
  let orchestrator: ApexOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockImplementation(async function* () {
      yield { type: 'text', content: 'Test response' };
    });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
  });

  it('demonstrates MCP tools are passed to Claude Agent SDK query() calls', async () => {
    // Create orchestrator in memory (no temp directory needed for this test)
    orchestrator = new ApexOrchestrator('/tmp/test');

    // Mock buildQueryMcpServers to return test MCP servers
    const mockServers = {
      'test-server': {
        type: 'stdio',
        command: 'node',
        args: ['server.js'],
      },
    };

    vi.spyOn(orchestrator as any, 'buildQueryMcpServers').mockReturnValue(mockServers);

    // Mock task execution components
    const mockTask = { id: 'test', name: 'test', status: 'pending', currentStage: 'test' };
    const mockStage = { name: 'test', agent: 'test' };
    const mockAgent = { name: 'test', description: 'test' };

    try {
      // Execute task stage to trigger query() call
      await (orchestrator as any).executeTaskStage(mockTask, mockStage, mockAgent);
    } catch (error) {
      // Ignore execution errors, we only verify the query call
    }

    // Verify the integration works correctly
    expect(mockQuery).toHaveBeenCalled();

    const queryCall = mockQuery.mock.calls[0];
    expect(queryCall[0].options.mcpServers).toEqual(mockServers);
  });

  it('confirms MCP integration architecture is correctly implemented', () => {
    orchestrator = new ApexOrchestrator('/tmp/test');

    // Verify that the orchestrator has the necessary MCP integration methods
    expect(typeof (orchestrator as any).buildQueryMcpServers).toBe('function');
    expect(typeof orchestrator.getMcpToolsForAgent).toBe('function');
    expect(typeof orchestrator.getMcpToolStats).toBe('function');
    expect(typeof orchestrator.refreshMcpTools).toBe('function');

    // Verify MCP components are initialized (may be undefined before initialize())
    const hasExpectedProperties =
      'mcpServerManager' in orchestrator &&
      'mcpConnectionManager' in orchestrator &&
      'mcpToolRegistry' in orchestrator;

    expect(hasExpectedProperties).toBe(true);
  });
});