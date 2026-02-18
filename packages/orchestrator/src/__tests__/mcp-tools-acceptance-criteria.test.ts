/**
 * Acceptance Criteria Test Suite for MCP Tools Integration
 *
 * This test suite specifically validates that:
 * "ApexOrchestrator passes discovered MCP tools to the Claude Agent SDK query() method.
 * Tools appear alongside any built-in tools."
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import type { ApexConfig, Task, Agent, WorkflowStage } from '@apexcli/core';

// Mock Claude Agent SDK to capture query calls
const mockQuery = vi.hoisted(() => vi.fn());
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
  tool: vi.fn((config) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() })),
}));

// Mock other dependencies
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

vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadConfig: vi.fn(),
    saveConfig: vi.fn().mockResolvedValue(undefined),
  };
});

describe('MCP Tools Integration - Acceptance Criteria', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let mockTask: Task;
  let mockAgent: Agent;
  let mockStage: WorkflowStage;

  const createTestConfig = (): ApexConfig => ({
    version: '1.0',
    project: {
      name: 'mcp-acceptance-test',
    },
    limits: {
      maxConcurrentTasks: 5,
      maxDailyTasks: 100,
      maxTokensPerTask: 100000,
      maxTurns: 10,
    },
    mcp: {
      enabled: true,
      servers: {
        'filesystem-server': {
          name: 'filesystem-server',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
        },
        'git-server': {
          name: 'git-server',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-git'],
        },
        'web-api-server': {
          name: 'web-api-server',
          type: 'http',
          url: 'https://api.example.com/mcp',
          headers: { 'Authorization': 'Bearer token' },
        },
      },
      marketplace: {
        url: '',
        enabled: true,
        refreshIntervalMinutes: 60,
        allowUnverified: false,
      },
    },
    agents: {},
    workflows: {},
    autonomy: {
      level: 'manual',
    },
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-acceptance-test-'));

    // Set up .apex directory structure
    const apexDir = path.join(tempDir, '.apex');
    await fs.mkdir(apexDir);
    await fs.mkdir(path.join(apexDir, 'agents'));
    await fs.mkdir(path.join(apexDir, 'workflows'));

    // Create test agent and workflow
    await fs.writeFile(
      path.join(apexDir, 'agents', 'tester.md'),
      '# Tester Agent\nCreates and runs tests.'
    );

    await fs.writeFile(
      path.join(apexDir, 'workflows', 'test-workflow.yaml'),
      `
name: test-workflow
stages:
  - name: testing
    agent: tester
    description: Create and run tests
`
    );

    // Mock configuration
    const { loadConfig } = await import('@apexcli/core');
    vi.mocked(loadConfig).mockResolvedValue(createTestConfig());

    // Set up mock objects
    mockTask = {
      id: 'acceptance-test-task',
      name: 'Acceptance Test Task',
      status: 'pending',
      currentStage: 'testing',
      workflow: 'test-workflow',
      createdAt: Date.now(),
    };

    mockAgent = {
      name: 'tester',
      description: 'Creates and runs tests',
      instructions: 'Create comprehensive tests',
    };

    mockStage = {
      name: 'testing',
      agent: 'tester',
      description: 'Create and run tests',
    };

    vi.clearAllMocks();
    mockQuery.mockImplementation(async function* () {
      yield { type: 'text', content: 'Task executed with MCP tools' };
    });

    orchestrator = new ApexOrchestrator({ projectPath: tempDir });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Acceptance Criteria: MCP Tools Passed to Claude Agent SDK', () => {
    it('ACCEPTANCE CRITERIA: ApexOrchestrator passes discovered MCP tools to Claude Agent SDK query() method', async () => {
      await orchestrator.initialize();

      // Mock the MCP server manager to simulate discovered servers
      const mockServerManager = (orchestrator as any).mcpServerManager;
      expect(mockServerManager).toBeDefined();

      vi.spyOn(mockServerManager, 'getSdkServerConfigs').mockReturnValue({
        'filesystem-server': {
          name: 'filesystem-server',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
        },
        'git-server': {
          name: 'git-server',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-git'],
        },
        'web-api-server': {
          name: 'web-api-server',
          type: 'http',
          url: 'https://api.example.com/mcp',
          headers: { 'Authorization': 'Bearer token' },
        },
      });

      // Execute a task stage to trigger Claude Agent SDK query() call
      try {
        await (orchestrator as any).executeTaskStage(mockTask, mockStage, mockAgent);
      } catch (error) {
        // We only care about verifying the query call, not the execution result
      }

      // VERIFY ACCEPTANCE CRITERIA:
      // 1. Claude Agent SDK query() method was called
      expect(mockQuery).toHaveBeenCalled();

      // 2. MCP servers were passed in the options
      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall[0]).toHaveProperty('options');
      expect(queryCall[0].options).toHaveProperty('mcpServers');

      const mcpServers = queryCall[0].options.mcpServers;

      // 3. MCP servers configuration is properly formatted
      expect(mcpServers).toBeDefined();
      expect(typeof mcpServers).toBe('object');
      expect(Object.keys(mcpServers)).toHaveLength(3);

      // 4. Each MCP server is correctly configured
      expect(mcpServers['filesystem-server']).toEqual({
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem'],
      });

      expect(mcpServers['git-server']).toEqual({
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-git'],
      });

      expect(mcpServers['web-api-server']).toEqual({
        type: 'http',
        url: 'https://api.example.com/mcp',
        headers: { 'Authorization': 'Bearer token' },
      });
    });

    it('ACCEPTANCE CRITERIA: MCP tools appear alongside built-in tools in Claude Agent SDK', async () => {
      await orchestrator.initialize();

      // Mock built-in tools (custom tools and browser tools)
      (orchestrator as any).customToolsServer = {
        name: 'custom-tools',
        config: {
          type: 'stdio',
          command: 'npx',
          args: ['@apex/custom-tools'],
        },
      };

      (orchestrator as any).browserToolsServer = {
        name: 'browser-tools',
        config: {
          type: 'stdio',
          command: 'npx',
          args: ['@apex/browser-tools'],
        },
      };

      // Mock discovered MCP servers
      const mockServerManager = (orchestrator as any).mcpServerManager;
      vi.spyOn(mockServerManager, 'getSdkServerConfigs').mockReturnValue({
        'filesystem-server': {
          name: 'filesystem-server',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
        },
      });

      try {
        await (orchestrator as any).executeTaskStage(mockTask, mockStage, mockAgent);
      } catch (error) {
        // Ignore execution errors
      }

      // VERIFY ACCEPTANCE CRITERIA:
      // MCP tools appear alongside built-in tools
      expect(mockQuery).toHaveBeenCalled();
      const mcpServers = mockQuery.mock.calls[0][0].options.mcpServers;

      // Should include both discovered MCP servers and built-in tools
      expect(mcpServers['filesystem-server']).toBeDefined(); // MCP discovered tool
      expect(mcpServers['custom-tools']).toBeDefined();      // Built-in tool
      expect(mcpServers['browser-tools']).toBeDefined();     // Built-in tool

      // Verify they coexist in the same configuration object
      expect(Object.keys(mcpServers)).toContain('filesystem-server');
      expect(Object.keys(mcpServers)).toContain('custom-tools');
      expect(Object.keys(mcpServers)).toContain('browser-tools');
    });

    it('ACCEPTANCE CRITERIA: Query method receives proper configuration when no MCP tools discovered', async () => {
      await orchestrator.initialize();

      // Mock server manager to return empty configuration (no MCP tools discovered)
      const mockServerManager = (orchestrator as any).mcpServerManager;
      vi.spyOn(mockServerManager, 'getSdkServerConfigs').mockReturnValue({});

      // Ensure no built-in tools either
      (orchestrator as any).customToolsServer = undefined;
      (orchestrator as any).browserToolsServer = undefined;

      try {
        await (orchestrator as any).executeTaskStage(mockTask, mockStage, mockAgent);
      } catch (error) {
        // Ignore execution errors
      }

      // VERIFY ACCEPTANCE CRITERIA:
      // When no tools are discovered, mcpServers should be undefined
      expect(mockQuery).toHaveBeenCalled();
      const mcpServers = mockQuery.mock.calls[0][0].options.mcpServers;

      expect(mcpServers).toBeUndefined();
    });

    it('ACCEPTANCE CRITERIA: MCP tool discovery errors do not prevent query execution', async () => {
      await orchestrator.initialize();

      // Mock server manager to throw error during discovery
      const mockServerManager = (orchestrator as any).mcpServerManager;
      vi.spyOn(mockServerManager, 'getSdkServerConfigs').mockImplementation(() => {
        throw new Error('MCP discovery failed');
      });

      try {
        await (orchestrator as any).executeTaskStage(mockTask, mockStage, mockAgent);
      } catch (error) {
        // Ignore execution errors
      }

      // VERIFY ACCEPTANCE CRITERIA:
      // Query should still be called even when MCP discovery fails
      expect(mockQuery).toHaveBeenCalled();

      // mcpServers should be undefined due to the error
      const mcpServers = mockQuery.mock.calls[0][0].options.mcpServers;
      expect(mcpServers).toBeUndefined();
    });

    it('ACCEPTANCE CRITERIA: All supported MCP server types are properly formatted for Claude Agent SDK', async () => {
      await orchestrator.initialize();

      // Mock server manager with all supported server types
      const mockServerManager = (orchestrator as any).mcpServerManager;
      vi.spyOn(mockServerManager, 'getSdkServerConfigs').mockReturnValue({
        'stdio-server': {
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
          env: { NODE_ENV: 'test' },
        },
        'http-server': {
          type: 'http',
          url: 'https://mcp.example.com',
          headers: { 'X-API-Version': '1.0' },
        },
        'sse-server': {
          type: 'sse',
          url: 'https://events.example.com/stream',
          headers: { 'Accept': 'text/event-stream' },
        },
        'default-type-server': {
          // No explicit type - should default to stdio
          command: 'python',
          args: ['script.py'],
        },
      });

      try {
        await (orchestrator as any).executeTaskStage(mockTask, mockStage, mockAgent);
      } catch (error) {
        // Ignore execution errors
      }

      // VERIFY ACCEPTANCE CRITERIA:
      // All server types are properly formatted according to Claude Agent SDK requirements
      expect(mockQuery).toHaveBeenCalled();
      const mcpServers = mockQuery.mock.calls[0][0].options.mcpServers;

      // Verify stdio server format
      expect(mcpServers['stdio-server']).toEqual({
        type: 'stdio',
        command: 'node',
        args: ['server.js'],
        env: { NODE_ENV: 'test' },
      });

      // Verify HTTP server format
      expect(mcpServers['http-server']).toEqual({
        type: 'http',
        url: 'https://mcp.example.com',
        headers: { 'X-API-Version': '1.0' },
      });

      // Verify SSE server format
      expect(mcpServers['sse-server']).toEqual({
        type: 'sse',
        url: 'https://events.example.com/stream',
        headers: { 'Accept': 'text/event-stream' },
      });

      // Verify default type handling (should become stdio)
      expect(mcpServers['default-type-server']).toEqual({
        type: 'stdio',
        command: 'python',
        args: ['script.py'],
      });
    });
  });

  describe('Integration Verification', () => {
    it('INTEGRATION VERIFICATION: End-to-end MCP tools integration workflow', async () => {
      await orchestrator.initialize();

      // Set up comprehensive test scenario
      const mockServerManager = (orchestrator as any).mcpServerManager;
      vi.spyOn(mockServerManager, 'getSdkServerConfigs').mockReturnValue({
        'filesystem': {
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
        },
        'web-search': {
          type: 'http',
          url: 'https://search-api.example.com/mcp',
          headers: { 'Authorization': 'Bearer search-token' },
        },
      });

      // Mock tool registry stats
      const mockToolRegistry = (orchestrator as any).mcpToolRegistry;
      if (mockToolRegistry) {
        vi.spyOn(mockToolRegistry, 'getStats').mockReturnValue({
          totalTools: 8,
          totalServers: 2,
          lastRefresh: Date.now(),
        });
      }

      // Mock connection manager
      const mockConnectionManager = (orchestrator as any).mcpConnectionManager;
      if (mockConnectionManager) {
        vi.spyOn(mockConnectionManager, 'listConnections').mockReturnValue([
          { serverId: 'filesystem', state: 'connected', serverName: 'Filesystem Server' },
          { serverId: 'web-search', state: 'connected', serverName: 'Web Search Server' },
        ]);
      }

      // Capture logging to verify observability
      const logSpy = vi.spyOn(orchestrator as any, 'log').mockImplementation(() => {});

      try {
        await (orchestrator as any).executeTaskStage(mockTask, mockStage, mockAgent);
      } catch (error) {
        // Ignore execution errors
      }

      // VERIFY COMPLETE INTEGRATION:

      // 1. Claude Agent SDK query was called
      expect(mockQuery).toHaveBeenCalled();

      // 2. MCP servers were passed correctly
      const queryCall = mockQuery.mock.calls[0];
      const mcpServers = queryCall[0].options.mcpServers;

      expect(mcpServers).toEqual({
        'filesystem': {
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
        },
        'web-search': {
          type: 'http',
          url: 'https://search-api.example.com/mcp',
          headers: { 'Authorization': 'Bearer search-token' },
        },
      });

      // 3. Observability logging occurred
      expect(logSpy).toHaveBeenCalledWith('MCP Integration: 2 servers available: filesystem, web-search');
      expect(logSpy).toHaveBeenCalledWith('MCP Tools: 8 tools discovered across 2 servers');
      expect(logSpy).toHaveBeenCalledWith('MCP Connections: 2 active connections: filesystem, web-search');

      // 4. Other query options are properly set alongside MCP servers
      const options = queryCall[0].options;
      expect(options.model).toBeDefined();
      expect(options.permissionMode).toBe('acceptEdits');
      expect(options.maxTurns).toBeDefined();
      expect(options.cwd).toBeDefined();

      logSpy.mockRestore();
    });
  });
});