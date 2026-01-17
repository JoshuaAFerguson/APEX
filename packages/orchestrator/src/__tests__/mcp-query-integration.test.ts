/**
 * Comprehensive test suite for MCP tools integration with Claude Agent SDK query() calls
 * Tests that MCP tools are properly discovered and passed to the Claude Agent SDK query() method
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import type { ApexConfig, Task, Agent, WorkflowStage } from '@apexcli/core';

// Mock Claude Agent SDK
const mockQuery = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
}));

// Mock other dependencies
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadConfig: vi.fn(),
    saveConfig: vi.fn().mockResolvedValue(undefined),
  };
});

describe('MCP Tools Integration with Claude Agent SDK Query', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let mockTask: Task;
  let mockAgent: Agent;
  let mockStage: WorkflowStage;

  const createTestConfig = (mcpServers?: Record<string, any>): ApexConfig => ({
    version: '1.0',
    project: {
      name: 'mcp-query-integration-test',
    },
    limits: {
      maxConcurrentTasks: 5,
      maxDailyTasks: 100,
      maxTokensPerTask: 100000,
      maxTurns: 10,
    },
    mcp: {
      enabled: true,
      servers: mcpServers || {
        'filesystem-server': {
          name: 'filesystem-server',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
        },
        'web-server': {
          name: 'web-server',
          type: 'http',
          url: 'http://localhost:3000/mcp',
          headers: { 'Authorization': 'Bearer token123' },
        },
        'sse-server': {
          name: 'sse-server',
          type: 'sse',
          url: 'http://localhost:3001/events',
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mcp-query-test-'));

    // Set up .apex directory structure
    const apexDir = path.join(tempDir, '.apex');
    await fs.mkdir(apexDir);
    await fs.mkdir(path.join(apexDir, 'agents'));
    await fs.mkdir(path.join(apexDir, 'workflows'));

    // Create minimal agent and workflow files
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

    // Mock configuration loading
    const { loadConfig } = await import('@apexcli/core');
    vi.mocked(loadConfig).mockResolvedValue(createTestConfig());

    // Set up mock objects
    mockTask = {
      id: 'test-task-123',
      name: 'Test MCP Integration',
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

    // Clear all mocks
    vi.clearAllMocks();
    mockQuery.mockImplementation(async function* () {
      yield { type: 'text', content: 'Test completed successfully' };
    });

    orchestrator = new ApexOrchestrator(tempDir);
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('MCP Server Discovery and Query Integration', () => {
    it('should pass discovered MCP servers to Claude Agent SDK query() call', async () => {
      await orchestrator.initialize();

      // Mock the server manager to return configured servers
      const mockServerManager = (orchestrator as any).mcpServerManager;
      if (mockServerManager) {
        vi.spyOn(mockServerManager, 'getSdkServerConfigs').mockReturnValue({
          'filesystem-server': {
            name: 'filesystem-server',
            type: 'stdio',
            command: 'npx',
            args: ['@modelcontextprotocol/server-filesystem'],
          },
          'web-server': {
            name: 'web-server',
            type: 'http',
            url: 'http://localhost:3000/mcp',
            headers: { 'Authorization': 'Bearer token123' },
          },
        });
      }

      // Execute a task stage to trigger query() call
      try {
        await (orchestrator as any).executeTaskStage(mockTask, mockStage, mockAgent);
      } catch (error) {
        // Ignore execution errors, we only care about the query call
      }

      // Verify query was called with MCP servers
      expect(mockQuery).toHaveBeenCalled();
      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall).toBeDefined();
      expect(queryCall[0]).toHaveProperty('options');
      expect(queryCall[0].options).toHaveProperty('mcpServers');

      const mcpServers = queryCall[0].options.mcpServers;
      expect(mcpServers).toBeDefined();
      expect(typeof mcpServers).toBe('object');

      // Verify filesystem server configuration
      expect(mcpServers['filesystem-server']).toEqual({
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem'],
      });

      // Verify web server configuration
      expect(mcpServers['web-server']).toEqual({
        type: 'http',
        url: 'http://localhost:3000/mcp',
        headers: { 'Authorization': 'Bearer token123' },
      });
    });

    it('should handle different MCP server types correctly in query calls', async () => {
      // Configure with all three server types
      const { loadConfig } = await import('@apexcli/core');
      vi.mocked(loadConfig).mockResolvedValue(createTestConfig({
        'stdio-server': {
          name: 'stdio-server',
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
          env: { NODE_ENV: 'production' },
        },
        'http-server': {
          name: 'http-server',
          type: 'http',
          url: 'https://api.example.com/mcp',
          headers: { 'X-API-Key': 'secret' },
        },
        'sse-server': {
          name: 'sse-server',
          type: 'sse',
          url: 'https://events.example.com/stream',
        },
      }));

      orchestrator = new ApexOrchestrator(tempDir);
      await orchestrator.initialize();

      // Mock server manager
      const mockServerManager = (orchestrator as any).mcpServerManager;
      if (mockServerManager) {
        vi.spyOn(mockServerManager, 'getSdkServerConfigs').mockReturnValue({
          'stdio-server': {
            type: 'stdio',
            command: 'node',
            args: ['server.js'],
            env: { NODE_ENV: 'production' },
          },
          'http-server': {
            type: 'http',
            url: 'https://api.example.com/mcp',
            headers: { 'X-API-Key': 'secret' },
          },
          'sse-server': {
            type: 'sse',
            url: 'https://events.example.com/stream',
          },
        });
      }

      try {
        await (orchestrator as any).executeTaskStage(mockTask, mockStage, mockAgent);
      } catch (error) {
        // Ignore execution errors
      }

      expect(mockQuery).toHaveBeenCalled();
      const mcpServers = mockQuery.mock.calls[0][0].options.mcpServers;

      // Verify stdio server
      expect(mcpServers['stdio-server']).toEqual({
        type: 'stdio',
        command: 'node',
        args: ['server.js'],
        env: { NODE_ENV: 'production' },
      });

      // Verify HTTP server
      expect(mcpServers['http-server']).toEqual({
        type: 'http',
        url: 'https://api.example.com/mcp',
        headers: { 'X-API-Key': 'secret' },
      });

      // Verify SSE server
      expect(mcpServers['sse-server']).toEqual({
        type: 'sse',
        url: 'https://events.example.com/stream',
      });
    });

    it('should include custom tools server and browser tools server in query calls', async () => {
      await orchestrator.initialize();

      // Mock the custom tools and browser tools servers
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

      try {
        await (orchestrator as any).executeTaskStage(mockTask, mockStage, mockAgent);
      } catch (error) {
        // Ignore execution errors
      }

      expect(mockQuery).toHaveBeenCalled();
      const mcpServers = mockQuery.mock.calls[0][0].options.mcpServers;

      // Verify custom tools server is included
      expect(mcpServers['custom-tools']).toBeDefined();
      expect(mcpServers['browser-tools']).toBeDefined();
    });

    it('should pass undefined mcpServers when no servers are configured', async () => {
      // Configure with no MCP servers
      const { loadConfig } = await import('@apexcli/core');
      vi.mocked(loadConfig).mockResolvedValue(createTestConfig({}));

      orchestrator = new ApexOrchestrator(tempDir);
      await orchestrator.initialize();

      // Mock server manager to return empty config
      const mockServerManager = (orchestrator as any).mcpServerManager;
      if (mockServerManager) {
        vi.spyOn(mockServerManager, 'getSdkServerConfigs').mockReturnValue({});
      }

      try {
        await (orchestrator as any).executeTaskStage(mockTask, mockStage, mockAgent);
      } catch (error) {
        // Ignore execution errors
      }

      expect(mockQuery).toHaveBeenCalled();
      const mcpServers = mockQuery.mock.calls[0][0].options.mcpServers;

      // Should be undefined when no servers are configured
      expect(mcpServers).toBeUndefined();
    });

    it('should handle MCP server manager initialization failure gracefully', async () => {
      // Clear the server manager to simulate initialization failure
      (orchestrator as any).mcpServerManager = undefined;

      await orchestrator.initialize();

      try {
        await (orchestrator as any).executeTaskStage(mockTask, mockStage, mockAgent);
      } catch (error) {
        // Ignore execution errors
      }

      expect(mockQuery).toHaveBeenCalled();
      const mcpServers = mockQuery.mock.calls[0][0].options.mcpServers;

      // Should be undefined when server manager is not available
      expect(mcpServers).toBeUndefined();
    });
  });

  describe('buildQueryMcpServers Method', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should correctly transform internal server configs to SDK format', () => {
      // Mock server manager with various configurations
      const mockServerManager = (orchestrator as any).mcpServerManager;
      if (mockServerManager) {
        vi.spyOn(mockServerManager, 'getSdkServerConfigs').mockReturnValue({
          'test-stdio': {
            type: 'stdio',
            command: 'node',
            args: ['server.js'],
            env: { TEST: 'true' },
          },
          'test-http': {
            type: 'http',
            url: 'http://localhost:8080',
            headers: { 'Content-Type': 'application/json' },
          },
          'test-sse': {
            type: 'sse',
            url: 'http://localhost:8081/events',
            headers: { 'Accept': 'text/event-stream' },
          },
          'test-default-type': {
            // No type specified, should default to stdio
            command: 'python',
            args: ['script.py'],
          },
        });
      }

      const result = (orchestrator as any).buildQueryMcpServers();

      expect(result).toEqual({
        'test-stdio': {
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
          env: { TEST: 'true' },
        },
        'test-http': {
          type: 'http',
          url: 'http://localhost:8080',
          headers: { 'Content-Type': 'application/json' },
        },
        'test-sse': {
          type: 'sse',
          url: 'http://localhost:8081/events',
          headers: { 'Accept': 'text/event-stream' },
        },
        'test-default-type': {
          type: 'stdio',
          command: 'python',
          args: ['script.py'],
        },
      });
    });

    it('should return undefined when no servers are available', () => {
      // Mock empty server config
      const mockServerManager = (orchestrator as any).mcpServerManager;
      if (mockServerManager) {
        vi.spyOn(mockServerManager, 'getSdkServerConfigs').mockReturnValue({});
      }

      // Also ensure no custom/browser tools servers
      (orchestrator as any).customToolsServer = undefined;
      (orchestrator as any).browserToolsServer = undefined;

      const result = (orchestrator as any).buildQueryMcpServers();

      expect(result).toBeUndefined();
    });

    it('should handle missing server manager gracefully', () => {
      // Clear server manager
      (orchestrator as any).mcpServerManager = undefined;

      const result = (orchestrator as any).buildQueryMcpServers();

      expect(result).toBeUndefined();
    });

    it('should skip invalid server configurations', () => {
      // Mock server manager with some invalid configs
      const mockServerManager = (orchestrator as any).mcpServerManager;
      if (mockServerManager) {
        vi.spyOn(mockServerManager, 'getSdkServerConfigs').mockReturnValue({
          'valid-stdio': {
            type: 'stdio',
            command: 'node',
            args: ['server.js'],
          },
          'invalid-stdio': {
            type: 'stdio',
            // Missing required command
            args: ['server.js'],
          },
          'invalid-http': {
            type: 'http',
            // Missing required URL
            headers: {},
          },
          'valid-http': {
            type: 'http',
            url: 'http://localhost:3000',
          },
        });
      }

      const result = (orchestrator as any).buildQueryMcpServers();

      // Should only include valid configurations
      expect(result).toEqual({
        'valid-stdio': {
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
        },
        'valid-http': {
          type: 'http',
          url: 'http://localhost:3000',
        },
      });
    });
  });

  describe('MCP Integration Logging and Observability', () => {
    it('should log MCP tool availability during query execution', async () => {
      const logSpy = vi.spyOn(orchestrator as any, 'log').mockImplementation(() => {});

      await orchestrator.initialize();

      // Mock server manager and tool registry
      const mockServerManager = (orchestrator as any).mcpServerManager;
      if (mockServerManager) {
        vi.spyOn(mockServerManager, 'getSdkServerConfigs').mockReturnValue({
          'test-server': {
            type: 'stdio',
            command: 'node',
            args: ['server.js'],
          },
        });
      }

      const mockToolRegistry = (orchestrator as any).mcpToolRegistry;
      if (mockToolRegistry) {
        vi.spyOn(mockToolRegistry, 'getStats').mockReturnValue({
          totalTools: 5,
          totalServers: 1,
          lastRefresh: Date.now(),
        });
      }

      const mockConnectionManager = (orchestrator as any).mcpConnectionManager;
      if (mockConnectionManager) {
        vi.spyOn(mockConnectionManager, 'listConnections').mockReturnValue([
          {
            serverId: 'test-server',
            state: 'connected',
            serverName: 'Test Server',
          },
        ]);
      }

      try {
        await (orchestrator as any).executeTaskStage(mockTask, mockStage, mockAgent);
      } catch (error) {
        // Ignore execution errors
      }

      // Verify logging calls
      expect(logSpy).toHaveBeenCalledWith('MCP Integration: 1 servers available: test-server');
      expect(logSpy).toHaveBeenCalledWith('MCP Tools: 5 tools discovered across 1 servers');
      expect(logSpy).toHaveBeenCalledWith('MCP Connections: 1 active connections: test-server');

      logSpy.mockRestore();
    });

    it('should not log when no MCP servers are available', async () => {
      const logSpy = vi.spyOn(orchestrator as any, 'log').mockImplementation(() => {});

      await orchestrator.initialize();

      // Mock empty server config
      const mockServerManager = (orchestrator as any).mcpServerManager;
      if (mockServerManager) {
        vi.spyOn(mockServerManager, 'getSdkServerConfigs').mockReturnValue({});
      }

      try {
        await (orchestrator as any).executeTaskStage(mockTask, mockStage, mockAgent);
      } catch (error) {
        // Ignore execution errors
      }

      // Should not log MCP integration messages when no servers are available
      expect(logSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('MCP Integration:')
      );

      logSpy.mockRestore();
    });
  });

  describe('Error Handling in MCP Query Integration', () => {
    it('should handle buildQueryMcpServers errors gracefully', async () => {
      await orchestrator.initialize();

      // Mock server manager to throw error
      const mockServerManager = (orchestrator as any).mcpServerManager;
      if (mockServerManager) {
        vi.spyOn(mockServerManager, 'getSdkServerConfigs').mockImplementation(() => {
          throw new Error('Server config fetch failed');
        });
      }

      try {
        await (orchestrator as any).executeTaskStage(mockTask, mockStage, mockAgent);
      } catch (error) {
        // Ignore execution errors
      }

      // Query should still be called even if MCP server fetching fails
      expect(mockQuery).toHaveBeenCalled();
      const mcpServers = mockQuery.mock.calls[0][0].options.mcpServers;

      // Should be undefined due to error
      expect(mcpServers).toBeUndefined();
    });

    it('should continue execution when MCP tool registry fails', async () => {
      await orchestrator.initialize();

      // Mock tool registry to throw error
      const mockToolRegistry = (orchestrator as any).mcpToolRegistry;
      if (mockToolRegistry) {
        vi.spyOn(mockToolRegistry, 'getStats').mockImplementation(() => {
          throw new Error('Registry stats failed');
        });
      }

      // Should not throw and should still call query
      try {
        await (orchestrator as any).executeTaskStage(mockTask, mockStage, mockAgent);
      } catch (error) {
        // Ignore execution errors
      }

      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('Integration with Real-World Scenarios', () => {
    it('should properly integrate MCP tools in a complete task execution flow', async () => {
      await orchestrator.initialize();

      // Mock realistic MCP server configuration
      const mockServerManager = (orchestrator as any).mcpServerManager;
      if (mockServerManager) {
        vi.spyOn(mockServerManager, 'getSdkServerConfigs').mockReturnValue({
          'filesystem': {
            type: 'stdio',
            command: 'npx',
            args: ['@modelcontextprotocol/server-filesystem', '/workspace'],
          },
          'web-search': {
            type: 'http',
            url: 'https://api.search.com/mcp',
            headers: { 'Authorization': 'Bearer api-key' },
          },
          'git': {
            type: 'stdio',
            command: 'npx',
            args: ['@modelcontextprotocol/server-git'],
          },
        });
      }

      // Mock tool registry with realistic tools
      const mockToolRegistry = (orchestrator as any).mcpToolRegistry;
      if (mockToolRegistry) {
        vi.spyOn(mockToolRegistry, 'getStats').mockReturnValue({
          totalTools: 15,
          totalServers: 3,
          lastRefresh: Date.now(),
        });
      }

      // Execute task stage
      try {
        await (orchestrator as any).executeTaskStage(mockTask, mockStage, mockAgent);
      } catch (error) {
        // Ignore execution errors
      }

      // Verify complete integration
      expect(mockQuery).toHaveBeenCalled();
      const queryOptions = mockQuery.mock.calls[0][0].options;

      expect(queryOptions.mcpServers).toEqual({
        'filesystem': {
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem', '/workspace'],
        },
        'web-search': {
          type: 'http',
          url: 'https://api.search.com/mcp',
          headers: { 'Authorization': 'Bearer api-key' },
        },
        'git': {
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-git'],
        },
      });

      // Verify other query options are properly set
      expect(queryOptions.model).toBeDefined();
      expect(queryOptions.permissionMode).toBe('acceptEdits');
      expect(queryOptions.maxTurns).toBeDefined();
      expect(queryOptions.cwd).toBeDefined();
    });
  });
});