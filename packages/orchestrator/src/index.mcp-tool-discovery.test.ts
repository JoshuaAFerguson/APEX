/**
 * Test suite for MCP Tool Discovery functionality in ApexOrchestrator
 * Tests the integration of MCP tool discovery with the orchestrator initialization and execution
 */

import { describe, test, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index.js';
import { initializeApex } from '@apexcli/core';
import type { MCPConnection, MCPConnectionState, MCPToolSchema, ClaudeSDKTool } from '@apexcli/core';
import { MCPToolRegistry } from './mcp-tool-registry.js';
import { MCPConnectionManager } from './mcp/connection-manager.js';
import { EventEmitter } from 'eventemitter3';

// Mock dependencies
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, opts: unknown, callback?: unknown) => {
    const cb = (typeof opts === 'function' ? opts : callback) as (error: Error | null, result?: { stdout: string }) => void;
    cb(null, { stdout: '' });
  }),
}));

describe('ApexOrchestrator MCP Tool Discovery', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;

  // Mock connection and server data
  const mockServerConfig = {
    name: 'test-server',
    command: 'node',
    args: ['test-server.js'],
  };

  const mockMCPTool = {
    name: 'test_tool',
    description: 'A test MCP tool',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Test input parameter',
        },
      },
      required: ['input'],
    } as MCPToolSchema,
  };

  const mockClaudeSDKTool: ClaudeSDKTool = {
    name: 'test_tool',
    description: 'A test MCP tool',
    input_schema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Test input parameter',
        },
      },
      required: ['input'],
    },
  };

  const mockConnection: MCPConnection = {
    serverId: 'test-server',
    serverName: 'Test Server',
    state: 'connected',
    config: mockServerConfig,
    client: new EventEmitter(),
    lastHealthCheck: Date.now(),
  };

  beforeEach(async () => {
    // Create temporary directory for test projects
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-'));

    // Create .apex directory and config
    const apexDir = path.join(tempDir, '.apex');
    await fs.mkdir(apexDir);

    // Create minimal config with MCP settings
    const config = {
      project: {
        name: 'test-project',
        version: '1.0.0',
      },
      limits: {
        maxConcurrentTasks: 5,
        maxDailyTasks: 100,
        maxTokensPerTask: 100000,
      },
      mcp: {
        servers: {
          'test-server': mockServerConfig,
        },
      },
    };

    await fs.writeFile(path.join(apexDir, 'config.yaml'), `
project:
  name: test-project
  version: 1.0.0
limits:
  maxConcurrentTasks: 5
  maxDailyTasks: 100
  maxTokensPerTask: 100000
mcp:
  servers:
    test-server:
      name: test-server
      command: node
      args:
        - test-server.js
`);

    // Create agents directory and minimal agent
    const agentsDir = path.join(apexDir, 'agents');
    await fs.mkdir(agentsDir);
    await fs.writeFile(path.join(agentsDir, 'test.md'), `# Test Agent\nA test agent.`);

    // Create workflows directory
    const workflowsDir = path.join(apexDir, 'workflows');
    await fs.mkdir(workflowsDir);

    // Initialize as git repository
    await initializeApex(tempDir);

    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Initialization with MCP Tool Discovery', () => {
    test('should initialize MCP tool registry during orchestrator initialization', async () => {
      orchestrator = new ApexOrchestrator(tempDir);

      // Mock MCP connection manager methods
      const mockDiscoverServers = vi.fn().mockReturnValue([mockServerConfig]);
      const mockConnect = vi.fn().mockResolvedValue(mockConnection);

      // Mock the MCPToolRegistry
      const mockAddConnection = vi.fn().mockResolvedValue(undefined);
      const mockGetAvailableTools = vi.fn().mockReturnValue([
        {
          tool: mockMCPTool,
          claudeTool: mockClaudeSDKTool,
          serverId: 'test-server',
          serverName: 'Test Server',
        },
      ]);
      const mockGetStats = vi.fn().mockReturnValue({
        totalTools: 1,
        serverCount: 1,
        lastRefresh: Date.now(),
      });

      // Replace methods after initialization but before initialize call
      await orchestrator.initialize();

      // Access private properties for testing
      const mcpConnectionManager = (orchestrator as any).mcpConnectionManager as MCPConnectionManager;
      const mcpToolRegistry = (orchestrator as any).mcpToolRegistry as MCPToolRegistry;

      expect(mcpConnectionManager).toBeDefined();
      expect(mcpToolRegistry).toBeDefined();
    });

    test('should handle missing MCP connection manager gracefully', async () => {
      orchestrator = new ApexOrchestrator(tempDir);

      // Mock the config to not have MCP servers
      const originalConfig = (orchestrator as any).config;
      (orchestrator as any).config = {
        ...originalConfig,
        mcp: undefined,
      };

      await expect(orchestrator.initialize()).resolves.not.toThrow();

      // Should not have MCP tool registry
      const mcpToolRegistry = (orchestrator as any).mcpToolRegistry;
      expect(mcpToolRegistry).toBeUndefined();
    });

    test('should continue initialization if MCP tool discovery fails', async () => {
      orchestrator = new ApexOrchestrator(tempDir);

      // Mock discoverAndRegisterMcpTools to throw an error
      const originalMethod = (ApexOrchestrator.prototype as any).discoverAndRegisterMcpTools;
      (ApexOrchestrator.prototype as any).discoverAndRegisterMcpTools = vi
        .fn()
        .mockRejectedValue(new Error('MCP discovery failed'));

      // Should not throw during initialization
      await expect(orchestrator.initialize()).resolves.not.toThrow();

      // Restore original method
      (ApexOrchestrator.prototype as any).discoverAndRegisterMcpTools = originalMethod;
    });
  });

  describe('discoverAndRegisterMcpTools method', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator(tempDir);
      await orchestrator.initialize();
    });

    test('should discover and register tools from all configured servers', async () => {
      // Mock MCP connection manager
      const mcpConnectionManager = (orchestrator as any).mcpConnectionManager as MCPConnectionManager;
      const mcpToolRegistry = (orchestrator as any).mcpToolRegistry as MCPToolRegistry;

      if (!mcpConnectionManager || !mcpToolRegistry) {
        throw new Error('MCP components not initialized');
      }

      // Mock methods
      vi.spyOn(mcpConnectionManager, 'discoverServers').mockReturnValue([mockServerConfig]);
      vi.spyOn(mcpConnectionManager, 'connect').mockResolvedValue(mockConnection);
      vi.spyOn(mcpToolRegistry, 'addConnection').mockResolvedValue(undefined);
      vi.spyOn(mcpToolRegistry, 'refreshAllTools').mockResolvedValue(undefined);

      // Call the private method
      await (orchestrator as any).discoverAndRegisterMcpTools();

      expect(mcpConnectionManager.discoverServers).toHaveBeenCalled();
      expect(mcpConnectionManager.connect).toHaveBeenCalledWith('test-server');
      expect(mcpToolRegistry.addConnection).toHaveBeenCalledWith(mockConnection);
      expect(mcpToolRegistry.refreshAllTools).toHaveBeenCalled();
    });

    test('should handle connection failures gracefully', async () => {
      const mcpConnectionManager = (orchestrator as any).mcpConnectionManager as MCPConnectionManager;
      const mcpToolRegistry = (orchestrator as any).mcpToolRegistry as MCPToolRegistry;

      if (!mcpConnectionManager || !mcpToolRegistry) {
        throw new Error('MCP components not initialized');
      }

      // Mock connection failure
      vi.spyOn(mcpConnectionManager, 'discoverServers').mockReturnValue([mockServerConfig]);
      vi.spyOn(mcpConnectionManager, 'connect').mockRejectedValue(new Error('Connection failed'));
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not throw
      await expect((orchestrator as any).discoverAndRegisterMcpTools()).resolves.not.toThrow();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to connect to MCP server 'test-server':",
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });

    test('should skip servers without valid server IDs', async () => {
      const mcpConnectionManager = (orchestrator as any).mcpConnectionManager as MCPConnectionManager;
      const mcpToolRegistry = (orchestrator as any).mcpToolRegistry as MCPToolRegistry;

      if (!mcpConnectionManager || !mcpToolRegistry) {
        throw new Error('MCP components not initialized');
      }

      // Mock server config without name that won't match config keys
      const invalidServerConfig = {
        command: 'invalid-server',
        args: [],
      };

      vi.spyOn(mcpConnectionManager, 'discoverServers').mockReturnValue([invalidServerConfig]);
      const connectSpy = vi.spyOn(mcpConnectionManager, 'connect');

      await (orchestrator as any).discoverAndRegisterMcpTools();

      expect(connectSpy).not.toHaveBeenCalled();
    });

    test('should return early if MCP components are not initialized', async () => {
      // Clear MCP components
      (orchestrator as any).mcpConnectionManager = undefined;
      (orchestrator as any).mcpToolRegistry = undefined;

      // Should return without error
      await expect((orchestrator as any).discoverAndRegisterMcpTools()).resolves.not.toThrow();
    });
  });

  describe('getMcpToolsForAgent method', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator(tempDir);
      await orchestrator.initialize();
    });

    test('should return available MCP tools in Claude SDK format', () => {
      const mcpToolRegistry = (orchestrator as any).mcpToolRegistry as MCPToolRegistry;

      if (!mcpToolRegistry) {
        throw new Error('MCP tool registry not initialized');
      }

      // Mock registry to return tools
      vi.spyOn(mcpToolRegistry, 'getAvailableTools').mockReturnValue([
        {
          tool: mockMCPTool,
          claudeTool: mockClaudeSDKTool,
          serverId: 'test-server',
          serverName: 'Test Server',
        },
      ]);

      const tools = orchestrator.getMcpToolsForAgent();

      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual(mockClaudeSDKTool);
      expect(tools[0].name).toBe('test_tool');
      expect(tools[0].description).toBe('A test MCP tool');
    });

    test('should return empty array when MCP tool registry is not available', () => {
      // Clear MCP tool registry
      (orchestrator as any).mcpToolRegistry = undefined;

      const tools = orchestrator.getMcpToolsForAgent();

      expect(tools).toEqual([]);
    });

    test('should return empty array when no tools are available', () => {
      const mcpToolRegistry = (orchestrator as any).mcpToolRegistry as MCPToolRegistry;

      if (!mcpToolRegistry) {
        throw new Error('MCP tool registry not initialized');
      }

      vi.spyOn(mcpToolRegistry, 'getAvailableTools').mockReturnValue([]);

      const tools = orchestrator.getMcpToolsForAgent();

      expect(tools).toEqual([]);
    });
  });

  describe('getMcpToolStats method', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator(tempDir);
      await orchestrator.initialize();
    });

    test('should return MCP tool registry statistics', () => {
      const mcpToolRegistry = (orchestrator as any).mcpToolRegistry as MCPToolRegistry;

      if (!mcpToolRegistry) {
        throw new Error('MCP tool registry not initialized');
      }

      const mockStats = {
        totalTools: 5,
        serverCount: 2,
        lastRefresh: Date.now(),
        connectionStats: {
          'test-server': {
            state: 'connected' as MCPConnectionState,
            toolCount: 3,
            lastSeen: Date.now(),
          },
        },
      };

      vi.spyOn(mcpToolRegistry, 'getStats').mockReturnValue(mockStats);

      const stats = orchestrator.getMcpToolStats();

      expect(stats).toEqual(mockStats);
      expect(stats?.totalTools).toBe(5);
      expect(stats?.serverCount).toBe(2);
    });

    test('should return undefined when MCP tool registry is not available', () => {
      // Clear MCP tool registry
      (orchestrator as any).mcpToolRegistry = undefined;

      const stats = orchestrator.getMcpToolStats();

      expect(stats).toBeUndefined();
    });
  });

  describe('refreshMcpTools method', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator(tempDir);
      await orchestrator.initialize();
    });

    test('should refresh MCP tools from all connected servers', async () => {
      const mcpToolRegistry = (orchestrator as any).mcpToolRegistry as MCPToolRegistry;

      if (!mcpToolRegistry) {
        throw new Error('MCP tool registry not initialized');
      }

      const refreshSpy = vi.spyOn(mcpToolRegistry, 'refreshAllTools').mockResolvedValue(undefined);

      await orchestrator.refreshMcpTools();

      expect(refreshSpy).toHaveBeenCalled();
    });

    test('should return early when MCP tool registry is not available', async () => {
      // Clear MCP tool registry
      (orchestrator as any).mcpToolRegistry = undefined;

      // Should not throw
      await expect(orchestrator.refreshMcpTools()).resolves.not.toThrow();
    });

    test('should propagate errors from registry refresh', async () => {
      const mcpToolRegistry = (orchestrator as any).mcpToolRegistry as MCPToolRegistry;

      if (!mcpToolRegistry) {
        throw new Error('MCP tool registry not initialized');
      }

      const refreshError = new Error('Refresh failed');
      vi.spyOn(mcpToolRegistry, 'refreshAllTools').mockRejectedValue(refreshError);

      await expect(orchestrator.refreshMcpTools()).rejects.toThrow('Refresh failed');
    });
  });

  describe('Integration with task execution', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator(tempDir);
      await orchestrator.initialize();
    });

    test('should make MCP tools available during agent execution', () => {
      const mcpToolRegistry = (orchestrator as any).mcpToolRegistry as MCPToolRegistry;

      if (!mcpToolRegistry) {
        throw new Error('MCP tool registry not initialized');
      }

      // Mock available tools
      vi.spyOn(mcpToolRegistry, 'getAvailableTools').mockReturnValue([
        {
          tool: mockMCPTool,
          claudeTool: mockClaudeSDKTool,
          serverId: 'test-server',
          serverName: 'Test Server',
        },
      ]);

      const tools = orchestrator.getMcpToolsForAgent();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test_tool');

      // Verify tool format is compatible with Claude SDK
      expect(tools[0]).toHaveProperty('name');
      expect(tools[0]).toHaveProperty('description');
      expect(tools[0]).toHaveProperty('input_schema');
      expect(tools[0].input_schema).toHaveProperty('type');
      expect(tools[0].input_schema).toHaveProperty('properties');
    });

    test('should handle tool discovery errors during execution', async () => {
      const mcpToolRegistry = (orchestrator as any).mcpToolRegistry as MCPToolRegistry;

      if (!mcpToolRegistry) {
        throw new Error('MCP tool registry not initialized');
      }

      // Mock registry to throw error
      vi.spyOn(mcpToolRegistry, 'getAvailableTools').mockImplementation(() => {
        throw new Error('Registry error');
      });

      // Should not throw, but return empty array
      const tools = orchestrator.getMcpToolsForAgent();

      expect(tools).toEqual([]);
    });
  });

  describe('MCP tool discovery with multiple servers', () => {
    beforeEach(async () => {
      // Create config with multiple servers
      const apexDir = path.join(tempDir, '.apex');
      await fs.writeFile(path.join(apexDir, 'config.yaml'), `
project:
  name: test-project
  version: 1.0.0
limits:
  maxConcurrentTasks: 5
  maxDailyTasks: 100
  maxTokensPerTask: 100000
mcp:
  servers:
    server-1:
      name: server-1
      command: node
      args:
        - server1.js
    server-2:
      name: server-2
      command: python
      args:
        - server2.py
`);

      orchestrator = new ApexOrchestrator(tempDir);
      await orchestrator.initialize();
    });

    test('should discover tools from multiple servers', async () => {
      const mcpConnectionManager = (orchestrator as any).mcpConnectionManager as MCPConnectionManager;
      const mcpToolRegistry = (orchestrator as any).mcpToolRegistry as MCPToolRegistry;

      if (!mcpConnectionManager || !mcpToolRegistry) {
        throw new Error('MCP components not initialized');
      }

      const server1Config = { name: 'server-1', command: 'node', args: ['server1.js'] };
      const server2Config = { name: 'server-2', command: 'python', args: ['server2.py'] };

      const connection1: MCPConnection = { ...mockConnection, serverId: 'server-1' };
      const connection2: MCPConnection = { ...mockConnection, serverId: 'server-2' };

      vi.spyOn(mcpConnectionManager, 'discoverServers').mockReturnValue([server1Config, server2Config]);
      vi.spyOn(mcpConnectionManager, 'connect')
        .mockResolvedValueOnce(connection1)
        .mockResolvedValueOnce(connection2);

      const addConnectionSpy = vi.spyOn(mcpToolRegistry, 'addConnection').mockResolvedValue(undefined);
      const refreshSpy = vi.spyOn(mcpToolRegistry, 'refreshAllTools').mockResolvedValue(undefined);

      await (orchestrator as any).discoverAndRegisterMcpTools();

      expect(mcpConnectionManager.connect).toHaveBeenCalledTimes(2);
      expect(mcpConnectionManager.connect).toHaveBeenCalledWith('server-1');
      expect(mcpConnectionManager.connect).toHaveBeenCalledWith('server-2');
      expect(addConnectionSpy).toHaveBeenCalledTimes(2);
      expect(refreshSpy).toHaveBeenCalled();
    });

    test('should continue with remaining servers if one fails', async () => {
      const mcpConnectionManager = (orchestrator as any).mcpConnectionManager as MCPConnectionManager;
      const mcpToolRegistry = (orchestrator as any).mcpToolRegistry as MCPToolRegistry;

      if (!mcpConnectionManager || !mcpToolRegistry) {
        throw new Error('MCP components not initialized');
      }

      const server1Config = { name: 'server-1', command: 'node', args: ['server1.js'] };
      const server2Config = { name: 'server-2', command: 'python', args: ['server2.py'] };

      const connection2: MCPConnection = { ...mockConnection, serverId: 'server-2' };

      vi.spyOn(mcpConnectionManager, 'discoverServers').mockReturnValue([server1Config, server2Config]);
      vi.spyOn(mcpConnectionManager, 'connect')
        .mockRejectedValueOnce(new Error('Server 1 connection failed'))
        .mockResolvedValueOnce(connection2);

      const addConnectionSpy = vi.spyOn(mcpToolRegistry, 'addConnection').mockResolvedValue(undefined);
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await (orchestrator as any).discoverAndRegisterMcpTools();

      expect(mcpConnectionManager.connect).toHaveBeenCalledTimes(2);
      expect(addConnectionSpy).toHaveBeenCalledTimes(1);
      expect(addConnectionSpy).toHaveBeenCalledWith(connection2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to connect to MCP server 'server-1':",
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Error boundary testing', () => {
    test('should handle malformed MCP server configurations', async () => {
      // Create config with malformed server config
      const apexDir = path.join(tempDir, '.apex');
      await fs.writeFile(path.join(apexDir, 'config.yaml'), `
project:
  name: test-project
  version: 1.0.0
limits:
  maxConcurrentTasks: 5
  maxDailyTasks: 100
  maxTokensPerTask: 100000
mcp:
  servers:
    malformed-server: "invalid-config"
`);

      orchestrator = new ApexOrchestrator(tempDir);

      // Should not throw during initialization
      await expect(orchestrator.initialize()).resolves.not.toThrow();
    });

    test('should handle MCP tool registry initialization failure', async () => {
      // Mock MCPToolRegistry constructor to throw
      const originalMCPToolRegistry = MCPToolRegistry;
      vi.mocked(MCPToolRegistry as any).mockImplementation(() => {
        throw new Error('Registry initialization failed');
      });

      orchestrator = new ApexOrchestrator(tempDir);

      await expect(orchestrator.initialize()).resolves.not.toThrow();

      // Restore original
      (MCPToolRegistry as any) = originalMCPToolRegistry;
    });
  });
});