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
  // Registry Initialization (Enhanced)
  // ==========================================================================

  describe('Registry Initialization', () => {
    test('should initialize with default options', () => {
      const defaultRegistry = new MCPToolRegistry();
      const stats = defaultRegistry.getStats();

      expect(stats.totalTools).toBe(0);
      expect(stats.availableTools).toBe(0);
      expect(stats.activeConnections).toBe(0);
      expect(stats.toolsByConnection).toEqual({});

      // Check auto-refresh is enabled by default
      expect((defaultRegistry as any).autoRefresh).toBe(true);
      expect((defaultRegistry as any).autoRefreshInterval).toBe(60000);

      defaultRegistry.shutdown();
    });

    test('should initialize with custom options', () => {
      const customRegistry = new MCPToolRegistry({
        operationTimeoutMs: 15000,
        autoRefresh: false,
        autoRefreshInterval: 5000,
      });

      expect((customRegistry as any).operationTimeoutMs).toBe(15000);
      expect((customRegistry as any).autoRefresh).toBe(false);
      expect((customRegistry as any).autoRefreshInterval).toBe(5000);

      customRegistry.shutdown();
    });

    test('should initialize with custom schema translator', () => {
      const customTranslator = new SchemaTranslator();
      const customRegistry = new MCPToolRegistry({
        schemaTranslator: customTranslator,
      });

      expect((customRegistry as any).schemaTranslator).toBe(customTranslator);

      customRegistry.shutdown();
    });
  });

  // ==========================================================================
  // Listing Available MCP Servers
  // ==========================================================================

  describe('Listing Available MCP Servers', () => {
    test('should list all connected servers', async () => {
      const connections = [
        createMockConnection('server1', 'connected', 'File Server'),
        createMockConnection('server2', 'connected', 'Database Server'),
        createMockConnection('server3', 'disconnected', 'Web Server'),
      ];

      const mockConnMgr = createMockConnectionManager(connections);
      registry.setConnectionManager(mockConnMgr);

      // Add all connections
      for (const conn of connections) {
        await registry.addConnection(conn);
      }

      const stats = registry.getStats();
      expect(stats.activeConnections).toBe(2); // Only connected ones
    });

    test('should get servers by connection state', async () => {
      const activeConnection = createMockConnection('active-server', 'connected');
      const inactiveConnection = createMockConnection('inactive-server', 'disconnected');

      await registry.addConnection(activeConnection);
      await registry.addConnection(inactiveConnection);

      const stats = registry.getStats();
      expect(stats.activeConnections).toBe(1);
    });

    test('should return empty list when no connections exist', () => {
      const stats = registry.getStats();
      expect(stats.activeConnections).toBe(0);
      expect(stats.toolsByConnection).toEqual({});
    });
  });

  // ==========================================================================
  // Searching and Filtering Servers
  // ==========================================================================

  describe('Searching and Filtering Servers', () => {
    beforeEach(async () => {
      const connections = [
        createMockConnection('file-server', 'connected', 'File Management Server'),
        createMockConnection('db-server', 'connected', 'Database Server'),
        createMockConnection('web-server', 'disconnected', 'Web Server'),
      ];

      const tools = [
        createMockMCPTool('read-file', 'Read file contents'),
        createMockMCPTool('write-file', 'Write file contents'),
        createMockMCPTool('query-db', 'Execute database query'),
        createMockMCPTool('fetch-url', 'Fetch web content'),
      ];

      const client1 = createMockClient([tools[0], tools[1]]);
      const client2 = createMockClient([tools[2]]);
      const client3 = createMockClient([tools[3]]);

      const mockConnMgr = createMockConnectionManager(
        connections,
        new Map([
          ['file-server', client1],
          ['db-server', client2],
          ['web-server', client3],
        ])
      );
      registry.setConnectionManager(mockConnMgr);

      for (const conn of connections) {
        await registry.addConnection(conn);
      }
      await registry.refreshAllTools();
    });

    test('should filter tools by connection', () => {
      const fileServerTools = registry.getToolsByConnection('file-server');
      const dbServerTools = registry.getToolsByConnection('db-server');
      const webServerTools = registry.getToolsByConnection('web-server');

      expect(fileServerTools).toHaveLength(2);
      expect(fileServerTools.map(t => t.mcpTool.name)).toEqual(['read-file', 'write-file']);

      expect(dbServerTools).toHaveLength(1);
      expect(dbServerTools[0].mcpTool.name).toBe('query-db');

      expect(webServerTools).toHaveLength(0); // Disconnected server
    });

    test('should filter by tool availability', () => {
      const allTools = registry.getAllTools();
      const availableTools = registry.getAvailableTools();

      expect(allTools).toHaveLength(3); // All registered tools
      expect(availableTools).toHaveLength(3); // Only from connected servers
      expect(availableTools.every(t => t.available)).toBe(true);
    });

    test('should search for specific tools by name', () => {
      expect(registry.hasTool('read-file')).toBe(true);
      expect(registry.hasTool('query-db')).toBe(true);
      expect(registry.hasTool('fetch-url')).toBe(false); // From disconnected server
      expect(registry.hasTool('nonexistent-tool')).toBe(false);
    });

    test('should get specific tool details', () => {
      const readFileTool = registry.getTool('read-file');
      expect(readFileTool).toBeDefined();
      expect(readFileTool?.mcpTool.name).toBe('read-file');
      expect(readFileTool?.connectionId).toBe('file-server');
      expect(readFileTool?.serverName).toBe('File Management Server');
    });
  });

  // ==========================================================================
  // Fetching Server Metadata
  // ==========================================================================

  describe('Fetching Server Metadata', () => {
    test('should include server metadata in tool entries', async () => {
      const connection = createMockConnection('metadata-server', 'connected', 'Metadata Test Server');
      const tool = createMockMCPTool('test-tool', 'Test tool description');

      const mockClient = createMockClient([tool]);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['metadata-server', mockClient]]));
      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      const registeredTool = registry.getTool('test-tool');
      expect(registeredTool).toBeDefined();
      expect(registeredTool?.serverName).toBe('Metadata Test Server');
      expect(registeredTool?.connectionId).toBe('metadata-server');
      expect(registeredTool?.discoveredAt).toBeInstanceOf(Date);
      expect(registeredTool?.lastRefreshed).toBeInstanceOf(Date);
    });

    test('should handle server metadata updates', async () => {
      const connection = createMockConnection('changing-server', 'connected', 'Original Name');
      const tool = createMockMCPTool('test-tool');

      const mockClient = createMockClient([tool]);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['changing-server', mockClient]]));
      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      let registeredTool = registry.getTool('test-tool');
      expect(registeredTool?.serverName).toBe('Original Name');

      // Update connection metadata
      connection.serverName = 'Updated Name';
      await registry.refreshAllTools();

      registeredTool = registry.getTool('test-tool');
      expect(registeredTool?.serverName).toBe('Updated Name');
    });

    test('should track tool registration timestamps', async () => {
      const startTime = Date.now();

      const connection = createMockConnection('timestamp-server', 'connected');
      const tool = createMockMCPTool('timestamp-tool');

      const mockClient = createMockClient([tool]);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['timestamp-server', mockClient]]));
      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      const registeredTool = registry.getTool('timestamp-tool');
      expect(registeredTool).toBeDefined();
      expect(registeredTool!.discoveredAt.getTime()).toBeGreaterThanOrEqual(startTime);
      expect(registeredTool!.lastRefreshed.getTime()).toBeGreaterThanOrEqual(startTime);
      expect(registeredTool!.discoveredAt.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  // ==========================================================================
  // Caching Behavior
  // ==========================================================================

  describe('Caching Behavior', () => {
    test('should cache tools between refreshes', async () => {
      const connection = createMockConnection('cache-server', 'connected');
      const tools = [
        createMockMCPTool('cached-tool1'),
        createMockMCPTool('cached-tool2'),
      ];

      const mockClient = createMockClient(tools);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['cache-server', mockClient]]));
      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection);

      // First refresh
      await registry.refreshAllTools();
      const firstRefreshTools = registry.getAllTools();
      expect(firstRefreshTools).toHaveLength(2);

      // Verify listTools was called
      expect(mockClient.listTools).toHaveBeenCalledTimes(1);

      // Second refresh should call listTools again (not cached)
      await registry.refreshAllTools();
      const secondRefreshTools = registry.getAllTools();
      expect(secondRefreshTools).toHaveLength(2);
      expect(mockClient.listTools).toHaveBeenCalledTimes(2);
    });

    test('should clear cache when connection is removed', async () => {
      const connection = createMockConnection('removable-server', 'connected');
      const tools = [createMockMCPTool('removable-tool')];

      const mockClient = createMockClient(tools);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['removable-server', mockClient]]));
      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      expect(registry.getAllTools()).toHaveLength(1);

      // Remove connection should clear cached tools
      await registry.removeConnection('removable-server');
      expect(registry.getAllTools()).toHaveLength(0);
    });

    test('should update cache when tools change', async () => {
      const connection = createMockConnection('changing-server', 'connected');
      let tools = [createMockMCPTool('tool1')];

      const mockClient = createMockClient(tools);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['changing-server', mockClient]]));
      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      expect(registry.getAllTools()).toHaveLength(1);
      expect(registry.hasTool('tool1')).toBe(true);

      // Update mock client to return different tools
      tools = [createMockMCPTool('tool2'), createMockMCPTool('tool3')];
      mockClient.listTools.mockResolvedValue(tools);

      await registry.refreshAllTools();

      expect(registry.getAllTools()).toHaveLength(2);
      expect(registry.hasTool('tool1')).toBe(false); // Old tool removed
      expect(registry.hasTool('tool2')).toBe(true);
      expect(registry.hasTool('tool3')).toBe(true);
    });

    test('should preserve cache across connection state changes', async () => {
      const connection = createMockConnection('state-server', 'connected');
      const tools = [createMockMCPTool('persistent-tool')];

      const mockClient = createMockClient(tools);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['state-server', mockClient]]));
      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      expect(registry.hasTool('persistent-tool')).toBe(true);
      expect(registry.isToolAvailable('persistent-tool')).toBe(true);

      // Disconnect should preserve tool but mark unavailable
      registry.updateConnectionState('state-server', 'disconnected');
      expect(registry.hasTool('persistent-tool')).toBe(true);
      expect(registry.isToolAvailable('persistent-tool')).toBe(false);

      // Reconnect should make tool available again
      registry.updateConnectionState('state-server', 'connected');
      expect(registry.hasTool('persistent-tool')).toBe(true);
      expect(registry.isToolAvailable('persistent-tool')).toBe(true);
    });
  });

  // ==========================================================================
  // Network Failure Error Handling
  // ==========================================================================

  describe('Network Failure Error Handling', () => {
    test('should handle connection timeout gracefully', async () => {
      const connection = createMockConnection('timeout-server', 'connected');
      const mockClient = {
        listTools: vi.fn().mockImplementation(() =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), 100)
          )
        ),
      } as any;

      const mockConnMgr = createMockConnectionManager([connection], new Map([['timeout-server', mockClient]]));
      registry.setConnectionManager(mockConnMgr);

      const errorSpy = vi.fn();
      registry.on('error', errorSpy);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'refreshConnectionTools',
        connectionId: 'timeout-server',
        error: expect.stringContaining('Connection timeout'),
      }));
    });

    test('should handle network connection failures', async () => {
      const connection = createMockConnection('network-error-server', 'connected');
      const mockClient = {
        listTools: vi.fn().mockRejectedValue(new Error('ECONNREFUSED: Connection refused')),
      } as any;

      const mockConnMgr = createMockConnectionManager([connection], new Map([['network-error-server', mockClient]]));
      registry.setConnectionManager(mockConnMgr);

      const errorSpy = vi.fn();
      registry.on('error', errorSpy);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'refreshConnectionTools',
        connectionId: 'network-error-server',
        error: expect.stringContaining('ECONNREFUSED'),
      }));
    });

    test('should handle DNS resolution failures', async () => {
      const connection = createMockConnection('dns-error-server', 'connected');
      const mockClient = {
        listTools: vi.fn().mockRejectedValue(new Error('ENOTFOUND: DNS lookup failed')),
      } as any;

      const mockConnMgr = createMockConnectionManager([connection], new Map([['dns-error-server', mockClient]]));
      registry.setConnectionManager(mockConnMgr);

      const errorSpy = vi.fn();
      registry.on('error', errorSpy);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'refreshConnectionTools',
        connectionId: 'dns-error-server',
        error: expect.stringContaining('ENOTFOUND'),
      }));
    });

    test('should handle intermittent network failures', async () => {
      const connection = createMockConnection('intermittent-server', 'connected');
      let callCount = 0;
      const mockClient = {
        listTools: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('Temporary network error'));
          }
          return Promise.resolve([createMockMCPTool('recovered-tool')]);
        }),
      } as any;

      const mockConnMgr = createMockConnectionManager([connection], new Map([['intermittent-server', mockClient]]));
      registry.setConnectionManager(mockConnMgr);

      const errorSpy = vi.fn();
      registry.on('error', errorSpy);

      await registry.addConnection(connection);

      // First call should fail
      await registry.refreshAllTools();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(registry.getAllTools()).toHaveLength(0);

      // Second call should succeed
      await registry.refreshAllTools();
      expect(registry.getAllTools()).toHaveLength(1);
      expect(registry.hasTool('recovered-tool')).toBe(true);
    });

    test('should handle malformed server responses', async () => {
      const connection = createMockConnection('malformed-server', 'connected');
      const mockClient = {
        listTools: vi.fn().mockResolvedValue([
          { name: 'valid-tool', description: 'Valid tool' },
          { name: null, description: 'Invalid tool' }, // Malformed tool
          { description: 'Missing name' }, // Missing name
        ]),
      } as any;

      const mockConnMgr = createMockConnectionManager([connection], new Map([['malformed-server', mockClient]]));
      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      // Should only register valid tools
      expect(registry.getAllTools()).toHaveLength(1);
      expect(registry.hasTool('valid-tool')).toBe(true);
    });

    test('should handle server unavailability during auto-refresh', async () => {
      const registryWithAutoRefresh = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 100, // Very short for testing
      });

      const connection = createMockConnection('unavailable-server', 'connected');
      const mockClient = {
        listTools: vi.fn().mockRejectedValue(new Error('Server unavailable')),
      } as any;

      const mockConnMgr = createMockConnectionManager([connection], new Map([['unavailable-server', mockClient]]));
      registryWithAutoRefresh.setConnectionManager(mockConnMgr);

      const errorSpy = vi.fn();
      registryWithAutoRefresh.on('error', errorSpy);

      await registryWithAutoRefresh.addConnection(connection);

      // Wait for auto-refresh to trigger
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(errorSpy).toHaveBeenCalled();

      registryWithAutoRefresh.shutdown();
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