/**
 * Comprehensive Unit Tests for MCPToolRegistry
 *
 * This test suite provides comprehensive unit testing for the MCPToolRegistry
 * class to ensure all acceptance criteria are met:
 *
 * 1. Unit tests for MCPToolRegistry ✅
 * 2. Tool discovery and registration ✅
 * 3. Schema translation integration ✅
 * 4. Connection state management ✅
 * 5. Auto-refresh functionality ✅
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPToolRegistry } from '../mcp-tool-registry.js';
import type { MCPConnection, MCPConnectionState } from '@apexcli/core';
import type { MCPToolDefinition } from '../mcp/client.js';
import { SchemaTranslator } from '../schema-translator.js';

// Mock SchemaTranslator
vi.mock('../schema-translator.js');

// Mock setTimeout to speed up tests
vi.stubGlobal('setTimeout', vi.fn((fn) => {
  fn();
  return 123;
}));
vi.stubGlobal('setInterval', vi.fn((fn) => {
  return 456;
}));
vi.stubGlobal('clearInterval', vi.fn());

describe('MCPToolRegistry - Comprehensive Unit Tests', () => {
  let toolRegistry: MCPToolRegistry;
  let mockConnectionManager: any;
  let mockMCPClient: any;
  let mockSchemaTranslator: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock schema translator
    mockSchemaTranslator = {
      translateTool: vi.fn().mockImplementation((mcpTool) => ({
        name: mcpTool.name,
        description: mcpTool.description,
        input_schema: {
          type: 'object',
          properties: mcpTool.inputSchema?.properties || {},
          required: mcpTool.inputSchema?.required || []
        }
      }))
    };

    (SchemaTranslator as any).mockImplementation(() => mockSchemaTranslator);

    // Setup mock MCP client
    mockMCPClient = {
      listTools: vi.fn().mockResolvedValue([])
    };

    // Setup mock connection manager
    mockConnectionManager = {
      listConnections: vi.fn().mockReturnValue([]),
      getConnection: vi.fn().mockReturnValue(undefined),
      getClient: vi.fn().mockReturnValue(mockMCPClient)
    };

    // Create registry instance
    toolRegistry = new MCPToolRegistry({
      autoRefresh: false, // Disable auto-refresh for most tests
      operationTimeoutMs: 1000
    });

    toolRegistry.setConnectionManager(mockConnectionManager);
  });

  afterEach(() => {
    toolRegistry.shutdown();
    vi.restoreAllMocks();
  });

  describe('🔧 Registry Initialization', () => {
    it('should initialize with default options', () => {
      const registry = new MCPToolRegistry();
      expect(registry).toBeDefined();
      registry.shutdown();
    });

    it('should initialize with custom options', () => {
      const registry = new MCPToolRegistry({
        operationTimeoutMs: 5000,
        autoRefresh: true,
        autoRefreshInterval: 30000
      });

      expect(registry).toBeDefined();
      registry.shutdown();
    });

    it('should set up auto-refresh when enabled', () => {
      const registry = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 1000
      });

      // Auto-refresh should be set up
      expect(vi.mocked(setInterval)).toHaveBeenCalled();
      registry.shutdown();
    });
  });

  describe('🔗 Connection Management', () => {
    let mockConnection: MCPConnection;

    beforeEach(() => {
      mockConnection = {
        serverId: 'test-server',
        serverName: 'Test Server',
        config: {
          name: 'Test Server',
          type: 'stdio',
          command: 'test-command'
        },
        state: 'connected',
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        reconnectAttempts: 0
      };
    });

    it('should add a connection and discover tools', async () => {
      const mockTools: MCPToolDefinition[] = [
        {
          name: 'test-tool',
          description: 'A test tool',
          inputSchema: {
            type: 'object',
            properties: { param: { type: 'string' } },
            required: ['param']
          }
        }
      ];

      mockMCPClient.listTools.mockResolvedValue(mockTools);

      const connectionAddedSpy = vi.fn();
      const toolRegisteredSpy = vi.fn();

      toolRegistry.on('connection:added', connectionAddedSpy);
      toolRegistry.on('tool:registered', toolRegisteredSpy);

      await toolRegistry.addConnection(mockConnection);

      expect(connectionAddedSpy).toHaveBeenCalledWith({
        connectionId: 'test-server',
        serverName: 'Test Server'
      });

      expect(toolRegisteredSpy).toHaveBeenCalledWith({
        toolName: 'test-tool',
        connectionId: 'test-server',
        entry: expect.objectContaining({
          mcpTool: mockTools[0],
          connectionId: 'test-server',
          serverName: 'Test Server',
          available: true
        })
      });

      expect(toolRegistry.hasTool('test-tool')).toBe(true);
    });

    it('should handle connection addition errors', async () => {
      mockMCPClient.listTools.mockRejectedValue(new Error('Failed to list tools'));

      const errorSpy = vi.fn();
      toolRegistry.on('error', errorSpy);

      await toolRegistry.addConnection(mockConnection);

      expect(errorSpy).toHaveBeenCalledWith({
        operation: 'addConnection',
        connectionId: 'test-server',
        error: 'Failed to list tools'
      });
    });

    it('should remove a connection and its tools', async () => {
      // First add a connection with tools
      const mockTools: MCPToolDefinition[] = [
        {
          name: 'test-tool',
          description: 'A test tool'
        }
      ];

      mockMCPClient.listTools.mockResolvedValue(mockTools);
      await toolRegistry.addConnection(mockConnection);

      expect(toolRegistry.hasTool('test-tool')).toBe(true);

      // Now remove the connection
      const connectionRemovedSpy = vi.fn();
      const toolUnregisteredSpy = vi.fn();

      toolRegistry.on('connection:removed', connectionRemovedSpy);
      toolRegistry.on('tool:unregistered', toolUnregisteredSpy);

      await toolRegistry.removeConnection('test-server', 'Test removal');

      expect(connectionRemovedSpy).toHaveBeenCalledWith({
        connectionId: 'test-server',
        reason: 'Test removal'
      });

      expect(toolUnregisteredSpy).toHaveBeenCalledWith({
        toolName: 'test-tool',
        connectionId: 'test-server'
      });

      expect(toolRegistry.hasTool('test-tool')).toBe(false);
    });

    it('should update connection state and tool availability', () => {
      toolRegistry.addConnection(mockConnection);

      // Update to disconnected state
      toolRegistry.updateConnectionState('test-server', 'disconnected');

      // Tools should be marked as unavailable
      const tools = toolRegistry.getToolsByConnection('test-server');
      tools.forEach(tool => {
        expect(tool.available).toBe(false);
      });
    });

    it('should trigger auto-refresh when connection becomes active', async () => {
      toolRegistry = new MCPToolRegistry({ autoRefresh: true });
      toolRegistry.setConnectionManager(mockConnectionManager);

      const refreshSpy = vi.spyOn(toolRegistry as any, 'refreshConnectionTools')
        .mockResolvedValue(1);

      await toolRegistry.addConnection(mockConnection);

      // Simulate connection becoming active
      toolRegistry.updateConnectionState('test-server', 'connected');

      expect(refreshSpy).toHaveBeenCalledWith('test-server');
    });
  });

  describe('🔍 Tool Discovery', () => {
    let mockConnection: MCPConnection;

    beforeEach(() => {
      mockConnection = {
        serverId: 'test-server',
        serverName: 'Test Server',
        config: {
          name: 'Test Server',
          type: 'stdio',
          command: 'test-command'
        },
        state: 'connected',
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        reconnectAttempts: 0
      };

      mockConnectionManager.listConnections.mockReturnValue([mockConnection]);
      mockConnectionManager.getConnection.mockReturnValue(mockConnection);
    });

    it('should refresh all tools from all connections', async () => {
      const mockTools: MCPToolDefinition[] = [
        {
          name: 'file-read',
          description: 'Read a file',
          inputSchema: {
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path']
          }
        },
        {
          name: 'file-write',
          description: 'Write a file',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['path', 'content']
          }
        }
      ];

      mockMCPClient.listTools.mockResolvedValue(mockTools);

      const registryRefreshedSpy = vi.fn();
      toolRegistry.on('registry:refreshed', registryRefreshedSpy);

      await toolRegistry.refreshAllTools();

      expect(registryRefreshedSpy).toHaveBeenCalledWith({
        connectionsRefreshed: 1,
        toolsDiscovered: 2,
        duration: expect.any(Number)
      });

      expect(toolRegistry.getAllTools()).toHaveLength(2);
      expect(toolRegistry.hasTool('file-read')).toBe(true);
      expect(toolRegistry.hasTool('file-write')).toBe(true);
    });

    it('should handle tool discovery timeout', async () => {
      // Mock a slow tool discovery that times out
      mockMCPClient.listTools.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 2000))
      );

      const errorSpy = vi.fn();
      toolRegistry.on('error', errorSpy);

      await toolRegistry.refreshAllTools();

      expect(errorSpy).toHaveBeenCalledWith({
        operation: 'refreshConnectionTools',
        connectionId: 'test-server',
        error: expect.stringContaining('timeout')
      });
    });

    it('should handle missing MCP client gracefully', async () => {
      mockConnectionManager.getClient.mockReturnValue(undefined);

      const errorSpy = vi.fn();
      toolRegistry.on('error', errorSpy);

      await toolRegistry.refreshAllTools();

      expect(errorSpy).toHaveBeenCalledWith({
        operation: 'refreshConnectionTools',
        connectionId: 'test-server',
        error: expect.stringContaining('No MCP client available')
      });
    });

    it('should clear existing tools before registering new ones', async () => {
      // First discovery
      mockMCPClient.listTools.mockResolvedValue([
        { name: 'tool-1', description: 'Tool 1' },
        { name: 'tool-2', description: 'Tool 2' }
      ]);

      await toolRegistry.addConnection(mockConnection);
      expect(toolRegistry.getAllTools()).toHaveLength(2);

      // Second discovery with different tools
      mockMCPClient.listTools.mockResolvedValue([
        { name: 'tool-3', description: 'Tool 3' }
      ]);

      await toolRegistry.refreshAllTools();

      // Should only have the new tool
      expect(toolRegistry.getAllTools()).toHaveLength(1);
      expect(toolRegistry.hasTool('tool-1')).toBe(false);
      expect(toolRegistry.hasTool('tool-2')).toBe(false);
      expect(toolRegistry.hasTool('tool-3')).toBe(true);
    });
  });

  describe('🔧 Schema Translation', () => {
    let mockConnection: MCPConnection;

    beforeEach(() => {
      mockConnection = {
        serverId: 'test-server',
        serverName: 'Test Server',
        config: {
          name: 'Test Server',
          type: 'stdio',
          command: 'test-command'
        },
        state: 'connected',
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        reconnectAttempts: 0
      };
    });

    it('should translate MCP tools to Claude Agent SDK format', async () => {
      const mockMCPTool: MCPToolDefinition = {
        name: 'complex-tool',
        description: 'A complex tool with schema',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            count: { type: 'number', minimum: 1, maximum: 100 },
            items: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['id', 'count']
        }
      };

      const expectedClaudeTool = {
        name: 'complex-tool',
        description: 'A complex tool with schema',
        input_schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            count: { type: 'number', minimum: 1, maximum: 100 },
            items: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['id', 'count']
        }
      };

      mockSchemaTranslator.translateTool.mockReturnValue(expectedClaudeTool);
      mockMCPClient.listTools.mockResolvedValue([mockMCPTool]);

      await toolRegistry.addConnection(mockConnection);

      expect(mockSchemaTranslator.translateTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'complex-tool',
          description: 'A complex tool with schema',
          serverId: 'test-server',
          serverName: 'Test Server'
        })
      );

      const registeredTool = toolRegistry.getTool('complex-tool');
      expect(registeredTool?.claudeTool).toEqual(expectedClaudeTool);
    });

    it('should handle tools without input schema', async () => {
      const mockMCPTool: MCPToolDefinition = {
        name: 'simple-tool',
        description: 'A simple tool'
        // No inputSchema
      };

      mockMCPClient.listTools.mockResolvedValue([mockMCPTool]);

      await toolRegistry.addConnection(mockConnection);

      expect(mockSchemaTranslator.translateTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'simple-tool',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: true
          }
        })
      );
    });

    it('should handle schema translation errors', async () => {
      const mockMCPTool: MCPToolDefinition = {
        name: 'problematic-tool',
        description: 'A tool that causes translation errors'
      };

      mockSchemaTranslator.translateTool.mockImplementation(() => {
        throw new Error('Schema translation failed');
      });

      mockMCPClient.listTools.mockResolvedValue([mockMCPTool]);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await toolRegistry.addConnection(mockConnection);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to register tool problematic-tool'),
        expect.any(Error)
      );

      expect(toolRegistry.hasTool('problematic-tool')).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe('📊 Registry Access and Statistics', () => {
    let mockConnection: MCPConnection;

    beforeEach(async () => {
      mockConnection = {
        serverId: 'test-server',
        serverName: 'Test Server',
        config: {
          name: 'Test Server',
          type: 'stdio',
          command: 'test-command'
        },
        state: 'connected',
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        reconnectAttempts: 0
      };

      const mockTools: MCPToolDefinition[] = [
        { name: 'tool-1', description: 'Tool 1' },
        { name: 'tool-2', description: 'Tool 2' },
        { name: 'tool-3', description: 'Tool 3' }
      ];

      mockMCPClient.listTools.mockResolvedValue(mockTools);
      await toolRegistry.addConnection(mockConnection);
    });

    it('should get all registered tools', () => {
      const tools = toolRegistry.getAllTools();

      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.mcpTool.name)).toEqual(['tool-1', 'tool-2', 'tool-3']);
    });

    it('should get available tools only', () => {
      // Mark connection as disconnected
      toolRegistry.updateConnectionState('test-server', 'disconnected');

      const availableTools = toolRegistry.getAvailableTools();
      expect(availableTools).toHaveLength(0);

      // Mark connection as connected again
      toolRegistry.updateConnectionState('test-server', 'connected');

      const availableToolsAfter = toolRegistry.getAvailableTools();
      expect(availableToolsAfter).toHaveLength(3);
    });

    it('should get tools by connection', () => {
      const connectionTools = toolRegistry.getToolsByConnection('test-server');

      expect(connectionTools).toHaveLength(3);
      expect(connectionTools.every(t => t.connectionId === 'test-server')).toBe(true);
    });

    it('should get specific tool by name', () => {
      const tool = toolRegistry.getTool('tool-2');

      expect(tool).toBeDefined();
      expect(tool?.mcpTool.name).toBe('tool-2');
      expect(tool?.connectionId).toBe('test-server');
    });

    it('should check tool existence and availability', () => {
      expect(toolRegistry.hasTool('tool-1')).toBe(true);
      expect(toolRegistry.hasTool('non-existent')).toBe(false);

      expect(toolRegistry.isToolAvailable('tool-1')).toBe(true);

      // Mark connection as disconnected
      toolRegistry.updateConnectionState('test-server', 'disconnected');
      expect(toolRegistry.isToolAvailable('tool-1')).toBe(false);
    });

    it('should provide comprehensive registry statistics', () => {
      const stats = toolRegistry.getStats();

      expect(stats).toMatchObject({
        totalTools: 3,
        availableTools: 3,
        activeConnections: 1,
        toolsByConnection: {
          'test-server': 3
        },
        lastRefresh: expect.any(Date)
      });
    });
  });

  describe('🔄 Auto-Refresh Management', () => {
    it('should start and stop auto-refresh', () => {
      const registry = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 5000
      });

      expect(vi.mocked(setInterval)).toHaveBeenCalled();

      registry.stopAutoRefresh();
      expect(vi.mocked(clearInterval)).toHaveBeenCalled();

      registry.shutdown();
    });

    it('should update auto-refresh interval', () => {
      const registry = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 1000
      });

      // Clear previous call counts
      vi.mocked(setInterval).mockClear();
      vi.mocked(clearInterval).mockClear();

      registry.setAutoRefreshInterval(2000);

      expect(vi.mocked(clearInterval)).toHaveBeenCalled();
      expect(vi.mocked(setInterval)).toHaveBeenCalled();

      registry.shutdown();
    });

    it('should handle auto-refresh errors gracefully', () => {
      const registry = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 100
      });

      const errorSpy = vi.fn();
      registry.on('error', errorSpy);

      // Mock refreshAllTools to throw error
      const refreshSpy = vi.spyOn(registry, 'refreshAllTools')
        .mockRejectedValue(new Error('Auto-refresh failed'));

      // Trigger auto-refresh
      const [callback] = vi.mocked(setInterval).mock.calls[0];
      callback();

      expect(refreshSpy).toHaveBeenCalled();
      registry.shutdown();
    });
  });

  describe('🧹 Cleanup and Resource Management', () => {
    it('should clear all tools and connections', () => {
      const mockConnection: MCPConnection = {
        serverId: 'test-server',
        serverName: 'Test Server',
        config: { name: 'Test Server', type: 'stdio', command: 'test-command' },
        state: 'connected',
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        reconnectAttempts: 0
      };

      toolRegistry.addConnection(mockConnection);

      expect(toolRegistry.getAllTools().length).toBeGreaterThan(0);

      toolRegistry.clear();

      expect(toolRegistry.getAllTools()).toHaveLength(0);
      expect(toolRegistry.getStats().totalTools).toBe(0);
    });

    it('should shutdown cleanly', () => {
      const registry = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 1000
      });

      const clearSpy = vi.spyOn(registry, 'clear');
      const stopRefreshSpy = vi.spyOn(registry, 'stopAutoRefresh');

      registry.shutdown();

      expect(stopRefreshSpy).toHaveBeenCalled();
      expect(clearSpy).toHaveBeenCalled();
    });

    it('should remove all event listeners on shutdown', () => {
      const listener = vi.fn();
      toolRegistry.on('tool:registered', listener);

      const removeAllListenersSpy = vi.spyOn(toolRegistry, 'removeAllListeners');

      toolRegistry.shutdown();

      expect(removeAllListenersSpy).toHaveBeenCalled();
    });
  });

  describe('🎯 Event System', () => {
    it('should emit all expected events during normal operation', async () => {
      const events = {
        'connection:added': vi.fn(),
        'tool:registered': vi.fn(),
        'tool:unregistered': vi.fn(),
        'connection:removed': vi.fn(),
        'registry:refreshed': vi.fn(),
        'error': vi.fn()
      };

      // Register all event listeners
      Object.entries(events).forEach(([event, spy]) => {
        toolRegistry.on(event as any, spy);
      });

      const mockConnection: MCPConnection = {
        serverId: 'test-server',
        serverName: 'Test Server',
        config: { name: 'Test Server', type: 'stdio', command: 'test-command' },
        state: 'connected',
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        reconnectAttempts: 0
      };

      mockMCPClient.listTools.mockResolvedValue([
        { name: 'test-tool', description: 'Test tool' }
      ]);

      // Add connection (should emit connection:added and tool:registered)
      await toolRegistry.addConnection(mockConnection);

      expect(events['connection:added']).toHaveBeenCalled();
      expect(events['tool:registered']).toHaveBeenCalled();

      // Remove connection (should emit tool:unregistered and connection:removed)
      await toolRegistry.removeConnection('test-server');

      expect(events['tool:unregistered']).toHaveBeenCalled();
      expect(events['connection:removed']).toHaveBeenCalled();
    });
  });
});