/**
 * ApexOrchestrator MCP Agent Access Tests
 *
 * Tests to verify that agents can access MCP connections through
 * the ApexOrchestrator public API according to the acceptance criteria:
 *
 * - ApexOrchestrator exposes MCP connections to agents
 * - Public methods allow agents to get MCP connections
 * - MCP connection management is properly exposed
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index.js';
import { TaskStore } from '../store.js';
import type { ApexConfig, MCPConnection } from '@apexcli/core';
import fs from 'fs/promises';

// Mock dependencies
vi.mock('../store.js');
vi.mock('fs/promises');

// Mock MCPConnectionManager with more realistic behavior
vi.mock('../mcp/connection-manager.js', () => ({
  MCPConnectionManager: vi.fn().mockImplementation(() => ({
    discoverServers: vi.fn().mockReturnValue([
      {
        name: 'test-server',
        type: 'stdio',
        command: 'node',
        args: ['test-server.js']
      }
    ]),
    connect: vi.fn().mockResolvedValue({
      serverId: 'test-server',
      serverName: 'Test MCP Server',
      config: { name: 'test-server', type: 'stdio', command: 'node', args: ['test-server.js'] },
      state: 'connected',
      connectedAt: new Date(),
      lastActivityAt: new Date(),
      reconnectAttempts: 0
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    disconnectAll: vi.fn().mockResolvedValue(undefined),
    listConnections: vi.fn().mockReturnValue([
      {
        serverId: 'test-server',
        serverName: 'Test MCP Server',
        config: { name: 'test-server', type: 'stdio', command: 'node', args: ['test-server.js'] },
        state: 'connected',
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        reconnectAttempts: 0
      }
    ]),
    getConnection: vi.fn().mockReturnValue({
      serverId: 'test-server',
      serverName: 'Test MCP Server',
      config: { name: 'test-server', type: 'stdio', command: 'node', args: ['test-server.js'] },
      state: 'connected',
      connectedAt: new Date(),
      lastActivityAt: new Date(),
      reconnectAttempts: 0
    }),
    getClient: vi.fn().mockReturnValue({
      listTools: vi.fn().mockResolvedValue([]),
      callTool: vi.fn().mockResolvedValue({ result: {} }),
      ping: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined)
    }),
    updateConfig: vi.fn(),
    checkHealth: vi.fn().mockResolvedValue({
      success: true,
      latencyMs: 10,
      consecutiveFailures: 0,
      isHealthy: true,
      timestamp: new Date()
    }),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }))
}));

const MockTaskStore = vi.mocked(TaskStore);
const mockFS = vi.mocked(fs);

describe('ApexOrchestrator - MCP Agent Access', () => {
  let testProjectPath: string;
  let testConfig: ApexConfig;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    vi.clearAllMocks();

    testProjectPath = '/tmp/test-apex-project';

    testConfig = {
      project: {
        name: 'test-project',
        description: 'Test project for MCP agent access',
        version: '1.0.0',
      },
      mcp: {
        enabled: true,
        connection: {
          maxRetries: 3,
          retryDelayMs: 1000,
          connectionTimeoutMs: 10000,
          healthCheckIntervalMs: 30000,
          autoReconnect: true,
        },
        servers: {
          'test-server': {
            name: 'Test MCP Server',
            type: 'stdio',
            command: 'node',
            args: ['test-server.js'],
          },
          'second-server': {
            name: 'Second MCP Server',
            type: 'stdio',
            command: 'node',
            args: ['second-server.js'],
          }
        }
      },
      agents: {},
      workflows: {},
    };

    // Mock file system operations
    mockFS.access.mockResolvedValue(undefined);
    mockFS.mkdir.mockResolvedValue(undefined);
    mockFS.readFile.mockResolvedValue('{}');
    mockFS.writeFile.mockResolvedValue(undefined);

    // Mock TaskStore
    const mockStore = {
      getTasks: vi.fn().mockResolvedValue([]),
      getTaskById: vi.fn().mockResolvedValue(null),
      createTask: vi.fn().mockResolvedValue('task-1'),
      updateTask: vi.fn().mockResolvedValue(undefined),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    MockTaskStore.mockImplementation(() => mockStore as any);

    orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });
  });

  afterEach(async () => {
    if (orchestrator) {
      try {
        // Clean up orchestrator if it was created
        await orchestrator.disconnectAll?.();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('Public MCP API for Agents', () => {
    it('should expose getMCPConnections() method for agents', () => {
      // Verify the public method exists
      expect(typeof orchestrator.getMCPConnections).toBe('function');

      // Test the method returns connections
      const connections = orchestrator.getMCPConnections();
      expect(Array.isArray(connections)).toBe(true);
      expect(connections).toHaveLength(1);
      expect(connections[0]).toMatchObject({
        serverId: 'test-server',
        serverName: 'Test MCP Server',
        state: 'connected'
      });
    });

    it('should expose getMCPConnection() method for agents', () => {
      // Verify the public method exists
      expect(typeof orchestrator.getMCPConnection).toBe('function');

      // Test getting a specific connection
      const connection = orchestrator.getMCPConnection('test-server');
      expect(connection).toBeDefined();
      expect(connection).toMatchObject({
        serverId: 'test-server',
        serverName: 'Test MCP Server',
        state: 'connected'
      });
    });

    it('should expose connectMCPServer() method for agents', async () => {
      // Verify the public method exists
      expect(typeof orchestrator.connectMCPServer).toBe('function');

      // Test connecting to a server
      const connection = await orchestrator.connectMCPServer('test-server');
      expect(connection).toBeDefined();
      expect(connection).toMatchObject({
        serverId: 'test-server',
        serverName: 'Test MCP Server',
        state: 'connected'
      });
    });

    it('should expose disconnectMCPServer() method for agents', async () => {
      // Verify the public method exists
      expect(typeof orchestrator.disconnectMCPServer).toBe('function');

      // Test disconnecting from a server
      await expect(orchestrator.disconnectMCPServer('test-server')).resolves.toBeUndefined();
    });

    it('should expose checkMCPServerHealth() method for agents', async () => {
      // Verify the public method exists
      expect(typeof orchestrator.checkMCPServerHealth).toBe('function');

      // Test health check
      const health = await orchestrator.checkMCPServerHealth('test-server');
      expect(health).toBeDefined();
      expect(health).toMatchObject({
        success: true,
        isHealthy: true,
        consecutiveFailures: 0
      });
    });
  });

  describe('MCP Connection Data Structure', () => {
    it('should return properly structured MCPConnection objects', () => {
      const connections = orchestrator.getMCPConnections();

      expect(connections).toHaveLength(1);
      const connection = connections[0];

      // Verify required MCPConnection fields
      expect(connection).toHaveProperty('serverId');
      expect(connection).toHaveProperty('serverName');
      expect(connection).toHaveProperty('config');
      expect(connection).toHaveProperty('state');
      expect(connection).toHaveProperty('connectedAt');
      expect(connection).toHaveProperty('lastActivityAt');
      expect(connection).toHaveProperty('reconnectAttempts');

      // Verify types
      expect(typeof connection.serverId).toBe('string');
      expect(typeof connection.serverName).toBe('string');
      expect(typeof connection.config).toBe('object');
      expect(typeof connection.state).toBe('string');
      expect(connection.connectedAt).toBeInstanceOf(Date);
      expect(connection.lastActivityAt).toBeInstanceOf(Date);
      expect(typeof connection.reconnectAttempts).toBe('number');
    });

    it('should handle empty connection lists gracefully', () => {
      // Mock empty connection list
      const { MCPConnectionManager } = require('../mcp/connection-manager.js');
      const mcpManagerInstance = vi.mocked(MCPConnectionManager).mock.results[0]?.value;
      mcpManagerInstance.listConnections.mockReturnValueOnce([]);

      const connections = orchestrator.getMCPConnections();
      expect(connections).toEqual([]);
      expect(Array.isArray(connections)).toBe(true);
    });

    it('should handle missing connections gracefully', () => {
      // Mock connection not found
      const { MCPConnectionManager } = require('../mcp/connection-manager.js');
      const mcpManagerInstance = vi.mocked(MCPConnectionManager).mock.results[0]?.value;
      mcpManagerInstance.getConnection.mockReturnValueOnce(undefined);

      const connection = orchestrator.getMCPConnection('non-existent-server');
      expect(connection).toBeUndefined();
    });
  });

  describe('Error Handling for Agent Access', () => {
    it('should handle MCP Connection Manager not initialized for connect', async () => {
      // Create orchestrator without proper initialization
      const { MCPConnectionManager } = require('../mcp/connection-manager.js');
      vi.mocked(MCPConnectionManager).mockImplementationOnce(() => null as any);

      const uninitializedOrchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });

      // Test that error is thrown when MCPConnectionManager is not initialized
      await expect(uninitializedOrchestrator.connectMCPServer('test-server'))
        .rejects.toThrow('MCP Connection Manager is not initialized');
    });

    it('should handle MCP Connection Manager not initialized for disconnect', async () => {
      // Create orchestrator without proper initialization
      const { MCPConnectionManager } = require('../mcp/connection-manager.js');
      vi.mocked(MCPConnectionManager).mockImplementationOnce(() => null as any);

      const uninitializedOrchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });

      // Test that error is thrown when MCPConnectionManager is not initialized
      await expect(uninitializedOrchestrator.disconnectMCPServer('test-server'))
        .rejects.toThrow('MCP Connection Manager is not initialized');
    });

    it('should handle MCP Connection Manager not initialized for health check', async () => {
      // Create orchestrator without proper initialization
      const { MCPConnectionManager } = require('../mcp/connection-manager.js');
      vi.mocked(MCPConnectionManager).mockImplementationOnce(() => null as any);

      const uninitializedOrchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });

      // Test that error is thrown when MCPConnectionManager is not initialized
      await expect(uninitializedOrchestrator.checkMCPServerHealth('test-server'))
        .rejects.toThrow('MCP Connection Manager is not initialized');
    });

    it('should handle MCP Connection Manager not initialized for getting connections', () => {
      // Create orchestrator without proper initialization
      const { MCPConnectionManager } = require('../mcp/connection-manager.js');
      vi.mocked(MCPConnectionManager).mockImplementationOnce(() => null as any);

      const uninitializedOrchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });

      // Should return empty array when MCPConnectionManager is not initialized
      const connections = uninitializedOrchestrator.getMCPConnections();
      expect(connections).toEqual([]);
    });

    it('should handle MCP Connection Manager not initialized for getting single connection', () => {
      // Create orchestrator without proper initialization
      const { MCPConnectionManager } = require('../mcp/connection-manager.js');
      vi.mocked(MCPConnectionManager).mockImplementationOnce(() => null as any);

      const uninitializedOrchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });

      // Should return undefined when MCPConnectionManager is not initialized
      const connection = uninitializedOrchestrator.getMCPConnection('test-server');
      expect(connection).toBeUndefined();
    });
  });

  describe('Agent Workflow Integration', () => {
    it('should allow agents to discover available MCP servers', () => {
      // Simulate agent discovering servers
      const connections = orchestrator.getMCPConnections();

      // Agent can see available servers
      expect(connections).toHaveLength(1);
      expect(connections[0].serverId).toBe('test-server');
      expect(connections[0].config.type).toBe('stdio');
    });

    it('should allow agents to check connection states', () => {
      // Simulate agent checking connection state
      const connection = orchestrator.getMCPConnection('test-server');

      expect(connection).toBeDefined();
      expect(connection!.state).toBe('connected');
      expect(connection!.reconnectAttempts).toBe(0);
    });

    it('should allow agents to establish new connections', async () => {
      // Simulate agent connecting to a server
      const connection = await orchestrator.connectMCPServer('test-server');

      expect(connection).toBeDefined();
      expect(connection.serverId).toBe('test-server');
      expect(connection.state).toBe('connected');
    });

    it('should allow agents to monitor connection health', async () => {
      // Simulate agent monitoring connection health
      const health = await orchestrator.checkMCPServerHealth('test-server');

      expect(health.success).toBe(true);
      expect(health.isHealthy).toBe(true);
      expect(typeof health.latencyMs).toBe('number');
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should allow agents to clean up connections', async () => {
      // Simulate agent cleaning up connection
      await expect(orchestrator.disconnectMCPServer('test-server')).resolves.toBeUndefined();
    });
  });

  describe('Multiple Server Management', () => {
    it('should handle multiple MCP servers for agent access', () => {
      // Mock multiple connections
      const { MCPConnectionManager } = require('../mcp/connection-manager.js');
      const mcpManagerInstance = vi.mocked(MCPConnectionManager).mock.results[0]?.value;

      mcpManagerInstance.listConnections.mockReturnValueOnce([
        {
          serverId: 'test-server',
          serverName: 'Test MCP Server',
          config: { name: 'test-server', type: 'stdio', command: 'node', args: ['test-server.js'] },
          state: 'connected',
          connectedAt: new Date(),
          lastActivityAt: new Date(),
          reconnectAttempts: 0
        },
        {
          serverId: 'second-server',
          serverName: 'Second MCP Server',
          config: { name: 'second-server', type: 'stdio', command: 'node', args: ['second-server.js'] },
          state: 'connected',
          connectedAt: new Date(),
          lastActivityAt: new Date(),
          reconnectAttempts: 0
        }
      ]);

      const connections = orchestrator.getMCPConnections();
      expect(connections).toHaveLength(2);
      expect(connections.map(c => c.serverId)).toContain('test-server');
      expect(connections.map(c => c.serverId)).toContain('second-server');
    });

    it('should allow agents to access specific servers by ID', () => {
      // Mock getting specific connection
      const { MCPConnectionManager } = require('../mcp/connection-manager.js');
      const mcpManagerInstance = vi.mocked(MCPConnectionManager).mock.results[0]?.value;

      mcpManagerInstance.getConnection.mockReturnValueOnce({
        serverId: 'second-server',
        serverName: 'Second MCP Server',
        config: { name: 'second-server', type: 'stdio', command: 'node', args: ['second-server.js'] },
        state: 'connected',
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        reconnectAttempts: 0
      });

      const connection = orchestrator.getMCPConnection('second-server');
      expect(connection).toBeDefined();
      expect(connection!.serverId).toBe('second-server');
      expect(connection!.serverName).toBe('Second MCP Server');
    });
  });

  describe('Agent API Consistency', () => {
    it('should maintain consistent API signatures for agents', () => {
      // Verify all agent-facing methods have consistent signatures
      expect(orchestrator.getMCPConnections).toBeInstanceOf(Function);
      expect(orchestrator.getMCPConnection).toBeInstanceOf(Function);
      expect(orchestrator.connectMCPServer).toBeInstanceOf(Function);
      expect(orchestrator.disconnectMCPServer).toBeInstanceOf(Function);
      expect(orchestrator.checkMCPServerHealth).toBeInstanceOf(Function);

      // Verify parameter expectations
      expect(orchestrator.getMCPConnections.length).toBe(0); // no parameters
      expect(orchestrator.getMCPConnection.length).toBe(1); // serverId parameter
      expect(orchestrator.connectMCPServer.length).toBe(1); // serverId parameter
      expect(orchestrator.disconnectMCPServer.length).toBe(1); // serverId parameter
      expect(orchestrator.checkMCPServerHealth.length).toBe(1); // serverId parameter
    });

    it('should return the expected data types for agents', () => {
      // Test return types
      const connections = orchestrator.getMCPConnections();
      const connection = orchestrator.getMCPConnection('test-server');

      expect(Array.isArray(connections)).toBe(true);
      expect(typeof connection === 'object' || connection === undefined).toBe(true);
    });
  });
});