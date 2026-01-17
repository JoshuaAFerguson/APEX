/**
 * Test suite for MCPToolRegistry
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type {
  MCPConnection,
  MCPConnectionState,
  MCPToolSchema,
} from '@apexcli/core';
import {
  MCPToolRegistry,
  type MCPConnectionManager,
  type MCPToolRegistryEntry,
} from './mcp-tool-registry.js';
import { MCPClient, type MCPToolDefinition } from './mcp/client.js';
import { SchemaTranslator } from './schema-translator.js';

// ============================================================================
// Test Fixtures and Mocks
// ============================================================================

const createMockMCPTool = (name: string, description?: string): MCPToolDefinition => ({
  name,
  description: description || `Mock tool ${name}`,
  inputSchema: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Input parameter',
      },
    },
    required: ['input'],
  } as MCPToolSchema,
});

const createMockConnection = (
  serverId: string,
  state: MCPConnectionState = 'connected',
  serverName?: string
): MCPConnection => ({
  serverId,
  serverName: serverName || `Server ${serverId}`,
  state,
  config: {
    name: serverId,
    command: 'mock-command',
    args: [],
    env: {},
  },
  connectedAt: new Date(),
  lastHeartbeat: new Date(),
  heartbeatInterval: 30000,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
});

const createMockClient = (tools: MCPToolDefinition[] = []): MCPClient => {
  const mockClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue(tools),
    callTool: vi.fn().mockImplementation((name: string, args: Record<string, unknown>) =>
      Promise.resolve({ result: `Called ${name} with ${JSON.stringify(args)}` })
    ),
    ping: vi.fn().mockResolvedValue(undefined),
  } as any;

  return mockClient;
};

const createMockConnectionManager = (connections: MCPConnection[] = [], clients: Map<string, MCPClient> = new Map()): MCPConnectionManager => ({
  listConnections: vi.fn().mockReturnValue(connections),
  getConnection: vi.fn().mockImplementation((id: string) =>
    connections.find(conn => conn.serverId === id)
  ),
  getClient: vi.fn().mockImplementation((id: string) => clients.get(id)),
});

// ============================================================================
// Test Suite
// ============================================================================

describe('MCPToolRegistry', () => {
  let registry: MCPToolRegistry;
  let mockSchemaTranslator: SchemaTranslator;
  let mockConnectionManager: MCPConnectionManager;

  beforeEach(() => {
    mockSchemaTranslator = new SchemaTranslator();
    registry = new MCPToolRegistry({
      schemaTranslator: mockSchemaTranslator,
      operationTimeoutMs: 5000,
      autoRefresh: false, // Disable auto-refresh for tests
    });
  });

  afterEach(() => {
    registry.shutdown();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Basic Registry Operations
  // ==========================================================================

  describe('Basic Operations', () => {
    test('should initialize with empty registry', () => {
      const stats = registry.getStats();
      expect(stats.totalTools).toBe(0);
      expect(stats.availableTools).toBe(0);
      expect(stats.activeConnections).toBe(0);
    });

    test('should handle connection manager assignment', () => {
      const mockConnMgr = createMockConnectionManager();
      registry.setConnectionManager(mockConnMgr);

      // Connection manager should be set (internal state)
      expect(mockConnMgr).toBeDefined();
    });

    test('should clear registry completely', () => {
      const connection = createMockConnection('test-server');
      registry.addConnection(connection);

      registry.clear();

      const stats = registry.getStats();
      expect(stats.totalTools).toBe(0);
      expect(stats.totalTools).toBe(0);
    });
  });

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  describe('Connection Management', () => {
    test('should add connection and emit event', async () => {
      const connection = createMockConnection('test-server', 'connected', 'Test Server');

      const eventSpy = vi.fn();
      registry.on('connection:added', eventSpy);

      await registry.addConnection(connection);

      expect(eventSpy).toHaveBeenCalledWith({
        connectionId: 'test-server',
        serverName: 'Test Server',
      });
    });

    test('should remove connection and all its tools', async () => {
      const connection = createMockConnection('test-server');
      const tools = [
        createMockMCPTool('tool1'),
        createMockMCPTool('tool2'),
      ];

      const mockClient = createMockClient(tools);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['test-server', mockClient]]));
      registry.setConnectionManager(mockConnMgr);

      // Add connection and tools
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      expect(registry.getAllTools()).toHaveLength(2);

      const eventSpy = vi.fn();
      registry.on('connection:removed', eventSpy);
      registry.on('tool:unregistered', eventSpy);

      // Remove connection
      await registry.removeConnection('test-server', 'test removal');

      expect(registry.getAllTools()).toHaveLength(0);
      expect(eventSpy).toHaveBeenCalledWith({
        connectionId: 'test-server',
        reason: 'test removal',
      });
    });

    test('should update connection state and tool availability', () => {
      const connection = createMockConnection('test-server', 'connected');
      registry.addConnection(connection);

      // Simulate tool registration
      const mockTool = createMockMCPTool('test-tool');
      const registryEntry: MCPToolRegistryEntry = {
        mcpTool: mockTool,
        claudeTool: mockSchemaTranslator.translateTool({
          name: mockTool.name,
          description: mockTool.description || '',
          serverId: 'test-server',
          inputSchema: mockTool.inputSchema as any,
        }),
        connectionId: 'test-server',
        serverName: 'Test Server',
        discoveredAt: new Date(),
        lastRefreshed: new Date(),
        available: true,
      };

      (registry as any).toolRegistry.set('test-tool', registryEntry);
      (registry as any).connectionTools.set('test-server', new Set(['test-tool']));

      // Update connection state to disconnected
      registry.updateConnectionState('test-server', 'disconnected');

      const tool = registry.getTool('test-tool');
      expect(tool?.available).toBe(false);
    });
  });

  // ==========================================================================
  // Tool Discovery and Registration
  // ==========================================================================

  describe('Tool Discovery', () => {
    test('should refresh all tools from connection manager', async () => {
      const connection = createMockConnection('test-server');
      const tools = [
        createMockMCPTool('tool1', 'First tool'),
        createMockMCPTool('tool2', 'Second tool'),
      ];

      const mockClient = createMockClient(tools);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['test-server', mockClient]]));
      registry.setConnectionManager(mockConnMgr);

      const eventSpy = vi.fn();
      registry.on('registry:refreshed', eventSpy);
      registry.on('tool:registered', eventSpy);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      expect(registry.getAllTools()).toHaveLength(2);
      expect(registry.hasTool('tool1')).toBe(true);
      expect(registry.hasTool('tool2')).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        connectionsRefreshed: 1,
        toolsDiscovered: 2,
      }));
    });

    test('should handle tool registration with schema translation', async () => {
      const connection = createMockConnection('test-server');
      const mockTool = createMockMCPTool('complex-tool', 'A complex tool');
      mockTool.inputSchema = {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          count: { type: 'integer', minimum: 0 },
          options: {
            type: 'object',
            properties: {
              flag: { type: 'boolean' },
            },
          },
        },
        required: ['name'],
      } as MCPToolSchema;

      const mockClient = createMockClient([mockTool]);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['test-server', mockClient]]));
      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      const registeredTool = registry.getTool('complex-tool');
      expect(registeredTool).toBeDefined();
      expect(registeredTool!.claudeTool.name).toBe('complex-tool');
      expect(registeredTool!.claudeTool.description).toBe('A complex tool');
      expect(registeredTool!.claudeTool.parameters).toBeDefined();
    });

    test('should handle tool refresh timeout', async () => {
      const connection = createMockConnection('test-server');
      const mockClient = {
        listTools: vi.fn().mockImplementation(() =>
          new Promise((resolve) => setTimeout(resolve, 10000)) // Long delay
        ),
      } as any;

      const mockConnMgr = createMockConnectionManager([connection], new Map([['test-server', mockClient]]));
      registry.setConnectionManager(mockConnMgr);

      const errorSpy = vi.fn();
      registry.on('error', errorSpy);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'refreshConnectionTools',
        connectionId: 'test-server',
        error: expect.stringContaining('timeout'),
      }));
    });

    test('should skip inactive connections during refresh', async () => {
      const activeConnection = createMockConnection('active-server', 'connected');
      const inactiveConnection = createMockConnection('inactive-server', 'disconnected');

      const tools = [createMockMCPTool('tool1')];
      const mockClient = createMockClient(tools);
      const mockConnMgr = createMockConnectionManager(
        [activeConnection, inactiveConnection],
        new Map([['active-server', mockClient]])
      );
      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(activeConnection);
      await registry.addConnection(inactiveConnection);
      await registry.refreshAllTools();

      // Should only have tools from active connection
      const toolsByActiveConn = registry.getToolsByConnection('active-server');
      const toolsByInactiveConn = registry.getToolsByConnection('inactive-server');

      expect(toolsByActiveConn).toHaveLength(1);
      expect(toolsByInactiveConn).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Registry Access Methods
  // ==========================================================================

  describe('Registry Access', () => {
    beforeEach(async () => {
      // Set up test data
      const connection1 = createMockConnection('server1', 'connected');
      const connection2 = createMockConnection('server2', 'disconnected');

      const tools1 = [createMockMCPTool('tool1'), createMockMCPTool('tool2')];
      const tools2 = [createMockMCPTool('tool3')];

      const client1 = createMockClient(tools1);
      const client2 = createMockClient(tools2);

      const mockConnMgr = createMockConnectionManager(
        [connection1, connection2],
        new Map([['server1', client1], ['server2', client2]])
      );
      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection1);
      await registry.addConnection(connection2);
      await registry.refreshAllTools();
    });

    test('should get all registered tools', () => {
      const allTools = registry.getAllTools();
      expect(allTools).toHaveLength(2); // Only from connected server
      expect(allTools.map(t => t.mcpTool.name)).toContain('tool1');
      expect(allTools.map(t => t.mcpTool.name)).toContain('tool2');
    });

    test('should get only available tools', () => {
      const availableTools = registry.getAvailableTools();
      expect(availableTools).toHaveLength(2); // Only from connected server
      expect(availableTools.every(t => t.available)).toBe(true);
    });

    test('should get tools by connection', () => {
      const server1Tools = registry.getToolsByConnection('server1');
      const server2Tools = registry.getToolsByConnection('server2');

      expect(server1Tools).toHaveLength(2);
      expect(server2Tools).toHaveLength(0); // Disconnected server
    });

    test('should check tool existence and availability', () => {
      expect(registry.hasTool('tool1')).toBe(true);
      expect(registry.hasTool('nonexistent')).toBe(false);

      expect(registry.isToolAvailable('tool1')).toBe(true);
      expect(registry.isToolAvailable('nonexistent')).toBe(false);
    });

    test('should get correct registry statistics', () => {
      const stats = registry.getStats();

      expect(stats.totalTools).toBe(2);
      expect(stats.availableTools).toBe(2);
      expect(stats.activeConnections).toBe(1);
      expect(stats.toolsByConnection['server1']).toBe(2);
      expect(stats.toolsByConnection['server2']).toBe(0);
    });
  });

  // ==========================================================================
  // Event System
  // ==========================================================================

  describe('Event System', () => {
    test('should emit tool registration events', async () => {
      const connection = createMockConnection('test-server');
      const mockTool = createMockMCPTool('test-tool');
      const mockClient = createMockClient([mockTool]);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['test-server', mockClient]]));

      registry.setConnectionManager(mockConnMgr);

      const eventSpy = vi.fn();
      registry.on('tool:registered', eventSpy);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      expect(eventSpy).toHaveBeenCalledWith({
        toolName: 'test-tool',
        connectionId: 'test-server',
        entry: expect.objectContaining({
          mcpTool: mockTool,
          connectionId: 'test-server',
        }),
      });
    });

    test('should emit error events for failed operations', async () => {
      const connection = createMockConnection('error-server');
      const mockClient = {
        listTools: vi.fn().mockRejectedValue(new Error('Connection failed')),
      } as any;

      const mockConnMgr = createMockConnectionManager([connection], new Map([['error-server', mockClient]]));
      registry.setConnectionManager(mockConnMgr);

      const errorSpy = vi.fn();
      registry.on('error', errorSpy);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      expect(errorSpy).toHaveBeenCalledWith({
        operation: 'refreshConnectionTools',
        connectionId: 'error-server',
        error: expect.stringContaining('Connection failed'),
      });
    });
  });

  // ==========================================================================
  // Auto-Refresh Functionality
  // ==========================================================================

  describe('Auto-Refresh', () => {
    test('should handle auto-refresh enable/disable', () => {
      const registryWithAutoRefresh = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 1000,
      });

      // Should start auto-refresh
      expect((registryWithAutoRefresh as any).autoRefreshTimer).toBeDefined();

      registryWithAutoRefresh.stopAutoRefresh();
      expect((registryWithAutoRefresh as any).autoRefreshTimer).toBeUndefined();

      registryWithAutoRefresh.shutdown();
    });

    test('should update auto-refresh interval', () => {
      registry.setAutoRefreshInterval(5000);
      expect((registry as any).autoRefreshInterval).toBe(5000);
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    test('should handle missing connection manager gracefully', async () => {
      const connection = createMockConnection('test-server');

      // Don't set connection manager
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      // Should not crash, but no tools should be discovered
      expect(registry.getAllTools()).toHaveLength(0);
    });

    test('should handle malformed tool schemas', async () => {
      const connection = createMockConnection('test-server');
      const malformedTool: MCPToolDefinition = {
        name: 'malformed-tool',
        description: 'Tool with invalid schema',
        inputSchema: null as any, // Invalid schema
      };

      const mockClient = createMockClient([malformedTool]);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['test-server', mockClient]]));
      registry.setConnectionManager(mockConnMgr);

      const errorSpy = vi.fn();
      registry.on('error', errorSpy);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      // Should handle gracefully and still attempt to register
      const registeredTool = registry.getTool('malformed-tool');
      expect(registeredTool).toBeDefined();
    });

    test('should handle connection removal for non-existent connection', async () => {
      // Should not throw error
      await registry.removeConnection('non-existent-server');

      const stats = registry.getStats();
      expect(stats.totalTools).toBe(0);
    });
  });

  // ==========================================================================
  // Integration Scenarios
  // ==========================================================================

  describe('Integration Scenarios', () => {
    test('should handle rapid connection state changes', async () => {
      const connection = createMockConnection('test-server', 'connected');
      const tools = [createMockMCPTool('test-tool')];
      const mockClient = createMockClient(tools);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['test-server', mockClient]]));

      registry.setConnectionManager(mockConnMgr);

      // Add connection and discover tools
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      expect(registry.isToolAvailable('test-tool')).toBe(true);

      // Disconnect
      registry.updateConnectionState('test-server', 'disconnected');
      expect(registry.isToolAvailable('test-tool')).toBe(false);

      // Reconnect
      registry.updateConnectionState('test-server', 'connected');
      expect(registry.isToolAvailable('test-tool')).toBe(true);
    });

    test('should handle multiple connections with overlapping tool names', async () => {
      const connection1 = createMockConnection('server1');
      const connection2 = createMockConnection('server2');

      // Both servers have a tool with the same name
      const tool1 = createMockMCPTool('common-tool', 'From server 1');
      const tool2 = createMockMCPTool('common-tool', 'From server 2');

      const client1 = createMockClient([tool1]);
      const client2 = createMockClient([tool2]);

      const mockConnMgr = createMockConnectionManager(
        [connection1, connection2],
        new Map([['server1', client1], ['server2', client2]])
      );
      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection1);
      await registry.refreshAllTools();

      expect(registry.hasTool('common-tool')).toBe(true);

      await registry.addConnection(connection2);
      await registry.refreshAllTools();

      // Second tool should override the first (latest wins)
      const tool = registry.getTool('common-tool');
      expect(tool?.mcpTool.description).toBe('From server 2');
    });
  });
});