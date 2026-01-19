/**
 * Unit Tests for MCPToolRegistry
 *
 * This test suite provides comprehensive unit testing for the MCPToolRegistry
 * class, covering tool discovery, registration, schema translation,
 * connection management, and auto-refresh functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { MCPConnection, MCPConnectionState } from '@apexcli/core';
import { MCPToolRegistry, type MCPConnectionManager } from '../mcp-tool-registry.js';
import { MCPClient, type MCPToolDefinition } from '../mcp/client.js';
import { SchemaTranslator } from '../schema-translator.js';

// Mock dependencies
vi.mock('../schema-translator.js');
vi.mock('../mcp/client.js');

describe('MCPToolRegistry', () => {
  let registry: MCPToolRegistry;
  let mockConnectionManager: MCPConnectionManager;
  let mockSchemaTranslator: any;
  let mockClient: any;

  const TEST_CONNECTION_ID = 'test-server';
  const TEST_SERVER_NAME = 'Test Server';
  const TEST_TOOL_NAME = 'test-tool';

  const mockConnection: MCPConnection = {
    serverId: TEST_CONNECTION_ID,
    serverName: TEST_SERVER_NAME,
    state: 'connected',
    config: {
      name: TEST_SERVER_NAME,
      command: 'test-command',
      args: [],
      env: {},
    },
    connectedAt: new Date(),
    lastActivityAt: new Date(),
    reconnectAttempts: 0,
  };

  const mockToolDefinition: MCPToolDefinition = {
    name: TEST_TOOL_NAME,
    description: 'A test tool',
    inputSchema: {
      type: 'object',
      properties: {
        param1: { type: 'string' },
        param2: { type: 'number' },
      },
      required: ['param1'],
    },
  };

  const mockTranslatedTool = {
    name: TEST_TOOL_NAME,
    description: 'A test tool',
    input_schema: {
      type: 'object',
      properties: {
        param1: { type: 'string' },
        param2: { type: 'number' },
      },
      required: ['param1'],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock schema translator
    mockSchemaTranslator = {
      translateTool: vi.fn().mockReturnValue(mockTranslatedTool),
    };
    (SchemaTranslator as Mock).mockImplementation(() => mockSchemaTranslator);

    // Mock MCP client
    mockClient = {
      listTools: vi.fn().mockResolvedValue([mockToolDefinition]),
    };

    // Mock connection manager
    mockConnectionManager = {
      listConnections: vi.fn().mockReturnValue([mockConnection]),
      getConnection: vi.fn().mockReturnValue(mockConnection),
      getClient: vi.fn().mockReturnValue(mockClient),
    };

    registry = new MCPToolRegistry({
      autoRefresh: false, // Disable auto-refresh for unit tests
      operationTimeoutMs: 5000,
    });

    registry.setConnectionManager(mockConnectionManager);
  });

  afterEach(() => {
    registry.shutdown();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultRegistry = new MCPToolRegistry();
      expect(defaultRegistry).toBeDefined();
      defaultRegistry.shutdown();
    });

    it('should initialize with custom options', () => {
      const customRegistry = new MCPToolRegistry({
        operationTimeoutMs: 10000,
        autoRefresh: true,
        autoRefreshInterval: 30000,
      });

      expect(customRegistry).toBeDefined();
      customRegistry.shutdown();
    });

    it('should start auto-refresh when enabled', () => {
      const autoRefreshRegistry = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 100, // Short interval for testing
      });

      expect(autoRefreshRegistry).toBeDefined();
      autoRefreshRegistry.shutdown();
    });
  });

  describe('connection management', () => {
    it('should set connection manager', () => {
      const newRegistry = new MCPToolRegistry();
      newRegistry.setConnectionManager(mockConnectionManager);

      expect(newRegistry).toBeDefined();
      newRegistry.shutdown();
    });

    it('should add connection successfully', async () => {
      const connectionAddedSpy = vi.fn();
      registry.on('connection:added', connectionAddedSpy);

      await registry.addConnection(mockConnection);

      expect(connectionAddedSpy).toHaveBeenCalledWith({
        connectionId: TEST_CONNECTION_ID,
        serverName: TEST_SERVER_NAME,
      });

      // Should discover tools automatically for connected servers
      expect(mockClient.listTools).toHaveBeenCalledOnce();
    });

    it('should handle connection addition errors', async () => {
      const errorSpy = vi.fn();
      registry.on('error', errorSpy);

      mockClient.listTools.mockRejectedValue(new Error('Tool discovery failed'));

      await registry.addConnection(mockConnection);

      expect(errorSpy).toHaveBeenCalledWith({
        operation: 'addConnection',
        connectionId: TEST_CONNECTION_ID,
        error: 'Tool discovery failed',
      });
    });

    it('should remove connection and clean up tools', async () => {
      const connectionRemovedSpy = vi.fn();
      const toolUnregisteredSpy = vi.fn();
      registry.on('connection:removed', connectionRemovedSpy);
      registry.on('tool:unregistered', toolUnregisteredSpy);

      // Add connection first
      await registry.addConnection(mockConnection);

      // Then remove it
      await registry.removeConnection(TEST_CONNECTION_ID, 'Test removal');

      expect(connectionRemovedSpy).toHaveBeenCalledWith({
        connectionId: TEST_CONNECTION_ID,
        reason: 'Test removal',
      });

      expect(toolUnregisteredSpy).toHaveBeenCalledWith({
        toolName: TEST_TOOL_NAME,
        connectionId: TEST_CONNECTION_ID,
      });
    });

    it('should handle connection removal errors gracefully', async () => {
      const errorSpy = vi.fn();
      registry.on('error', errorSpy);

      await registry.removeConnection('non-existent');

      // Should not emit error for non-existent connection removal
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should update connection state and tool availability', async () => {
      await registry.addConnection(mockConnection);

      // Tool should initially be available
      const tool = registry.getTool(TEST_TOOL_NAME);
      expect(tool?.available).toBe(true);

      // Update to disconnected state
      registry.updateConnectionState(TEST_CONNECTION_ID, 'disconnected');

      expect(tool?.available).toBe(false);
    });

    it('should auto-refresh tools when connection becomes active', async () => {
      const autoRefreshRegistry = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 60000,
      });
      autoRefreshRegistry.setConnectionManager(mockConnectionManager);

      await autoRefreshRegistry.addConnection({
        ...mockConnection,
        state: 'disconnected',
      });

      // Reset call count
      mockClient.listTools.mockClear();

      // Update to connected state - should trigger auto-refresh
      autoRefreshRegistry.updateConnectionState(TEST_CONNECTION_ID, 'connected');

      // Give some time for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockClient.listTools).toHaveBeenCalled();
      autoRefreshRegistry.shutdown();
    });
  });

  describe('tool discovery and registration', () => {
    beforeEach(async () => {
      await registry.addConnection(mockConnection);
    });

    it('should refresh all tools from all connections', async () => {
      const registryRefreshedSpy = vi.fn();
      registry.on('registry:refreshed', registryRefreshedSpy);

      await registry.refreshAllTools();

      expect(registryRefreshedSpy).toHaveBeenCalledWith({
        connectionsRefreshed: 1,
        toolsDiscovered: 1,
        duration: expect.any(Number),
      });

      expect(mockClient.listTools).toHaveBeenCalled();
    });

    it('should handle tool discovery timeout', async () => {
      const timeoutRegistry = new MCPToolRegistry({
        operationTimeoutMs: 50, // Very short timeout
      });
      timeoutRegistry.setConnectionManager(mockConnectionManager);

      // Mock client to hang
      mockClient.listTools.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      await timeoutRegistry.addConnection(mockConnection);

      const errorSpy = vi.fn();
      timeoutRegistry.on('error', errorSpy);

      await timeoutRegistry.refreshAllTools();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'refreshConnectionTools',
          connectionId: TEST_CONNECTION_ID,
          error: expect.stringContaining('timeout'),
        })
      );

      timeoutRegistry.shutdown();
    });

    it('should register tools and emit events', async () => {
      const toolRegisteredSpy = vi.fn();
      registry.on('tool:registered', toolRegisteredSpy);

      // Clear the initial registration from beforeEach
      toolRegisteredSpy.mockClear();

      await registry.refreshAllTools();

      expect(toolRegisteredSpy).toHaveBeenCalledWith({
        toolName: TEST_TOOL_NAME,
        connectionId: TEST_CONNECTION_ID,
        entry: expect.objectContaining({
          mcpTool: mockToolDefinition,
          claudeTool: mockTranslatedTool,
          connectionId: TEST_CONNECTION_ID,
          serverName: TEST_SERVER_NAME,
          available: true,
        }),
      });
    });

    it('should handle schema translation errors', async () => {
      mockSchemaTranslator.translateTool.mockImplementation(() => {
        throw new Error('Translation failed');
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await registry.refreshAllTools();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to register tool'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should skip disconnected connections during refresh', async () => {
      registry.updateConnectionState(TEST_CONNECTION_ID, 'disconnected');
      mockClient.listTools.mockClear();

      await registry.refreshAllTools();

      // Should not call listTools for disconnected connection
      expect(mockClient.listTools).not.toHaveBeenCalled();
    });

    it('should handle missing client during refresh', async () => {
      mockConnectionManager.getClient = vi.fn().mockReturnValue(undefined);

      const errorSpy = vi.fn();
      registry.on('error', errorSpy);

      await registry.refreshAllTools();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'refreshConnectionTools',
          connectionId: TEST_CONNECTION_ID,
          error: expect.stringContaining('No MCP client available'),
        })
      );
    });
  });

  describe('registry access', () => {
    beforeEach(async () => {
      await registry.addConnection(mockConnection);
    });

    it('should get all registered tools', () => {
      const allTools = registry.getAllTools();

      expect(allTools).toHaveLength(1);
      expect(allTools[0].mcpTool.name).toBe(TEST_TOOL_NAME);
    });

    it('should get available tools only', () => {
      // Initially available
      let availableTools = registry.getAvailableTools();
      expect(availableTools).toHaveLength(1);

      // Mark as unavailable
      registry.updateConnectionState(TEST_CONNECTION_ID, 'disconnected');
      availableTools = registry.getAvailableTools();
      expect(availableTools).toHaveLength(0);
    });

    it('should get tools by connection', () => {
      const toolsByConnection = registry.getToolsByConnection(TEST_CONNECTION_ID);

      expect(toolsByConnection).toHaveLength(1);
      expect(toolsByConnection[0].connectionId).toBe(TEST_CONNECTION_ID);
    });

    it('should get specific tool by name', () => {
      const tool = registry.getTool(TEST_TOOL_NAME);

      expect(tool).toBeDefined();
      expect(tool!.mcpTool.name).toBe(TEST_TOOL_NAME);
    });

    it('should return undefined for non-existent tool', () => {
      const tool = registry.getTool('non-existent');
      expect(tool).toBeUndefined();
    });

    it('should check if tool exists', () => {
      expect(registry.hasTool(TEST_TOOL_NAME)).toBe(true);
      expect(registry.hasTool('non-existent')).toBe(false);
    });

    it('should check tool availability', () => {
      expect(registry.isToolAvailable(TEST_TOOL_NAME)).toBe(true);

      registry.updateConnectionState(TEST_CONNECTION_ID, 'disconnected');
      expect(registry.isToolAvailable(TEST_TOOL_NAME)).toBe(false);
    });

    it('should get registry statistics', () => {
      const stats = registry.getStats();

      expect(stats).toMatchObject({
        totalTools: 1,
        availableTools: 1,
        activeConnections: 1,
        toolsByConnection: {
          [TEST_CONNECTION_ID]: 1,
        },
        lastRefresh: expect.any(Date),
      });
    });
  });

  describe('auto-refresh management', () => {
    it('should start auto-refresh', () => {
      const autoRefreshRegistry = new MCPToolRegistry({
        autoRefresh: false,
        autoRefreshInterval: 100,
      });

      // Manually start auto-refresh (normally done in constructor)
      autoRefreshRegistry.setAutoRefreshInterval(100);

      expect(autoRefreshRegistry).toBeDefined();
      autoRefreshRegistry.shutdown();
    });

    it('should stop auto-refresh', () => {
      const autoRefreshRegistry = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 100,
      });

      autoRefreshRegistry.stopAutoRefresh();
      expect(autoRefreshRegistry).toBeDefined();
      autoRefreshRegistry.shutdown();
    });

    it('should set auto-refresh interval', () => {
      registry.setAutoRefreshInterval(5000);
      expect(registry).toBeDefined();
    });
  });

  describe('cleanup and shutdown', () => {
    beforeEach(async () => {
      await registry.addConnection(mockConnection);
    });

    it('should clear all tools and connections', () => {
      registry.clear();

      expect(registry.getAllTools()).toHaveLength(0);
      expect(registry.getStats().totalTools).toBe(0);
    });

    it('should shutdown properly', () => {
      const removeAllListenersSpy = vi.spyOn(registry, 'removeAllListeners');

      registry.shutdown();

      expect(removeAllListenersSpy).toHaveBeenCalledOnce();
      expect(registry.getAllTools()).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle errors during refresh all tools', async () => {
      const errorSpy = vi.fn();
      registry.on('error', errorSpy);

      // Force an error by making listConnections throw
      mockConnectionManager.listConnections = vi.fn().mockImplementation(() => {
        throw new Error('Connection manager error');
      });

      await registry.refreshAllTools();

      expect(errorSpy).toHaveBeenCalledWith({
        operation: 'refreshAllTools',
        error: 'Connection manager error',
      });
    });

    it('should handle connection manager unavailable during refresh', async () => {
      const registryWithoutManager = new MCPToolRegistry();
      // Don't set connection manager

      await registryWithoutManager.addConnection(mockConnection);

      const registryRefreshedSpy = vi.fn();
      registryWithoutManager.on('registry:refreshed', registryRefreshedSpy);

      await registryWithoutManager.refreshAllTools();

      // Should still work with stored connections
      expect(registryRefreshedSpy).toHaveBeenCalled();
      registryWithoutManager.shutdown();
    });
  });

  describe('tool schema handling', () => {
    it('should handle tools without description', async () => {
      const toolWithoutDescription: MCPToolDefinition = {
        name: 'no-desc-tool',
        inputSchema: { type: 'object', properties: {} },
      };

      mockClient.listTools.mockResolvedValue([toolWithoutDescription]);

      await registry.refreshAllTools();

      const tool = registry.getTool('no-desc-tool');
      expect(tool).toBeDefined();
      expect(tool!.mcpTool.description).toBeUndefined();
    });

    it('should handle tools without input schema', async () => {
      const toolWithoutSchema: MCPToolDefinition = {
        name: 'no-schema-tool',
        description: 'Tool without schema',
      };

      mockClient.listTools.mockResolvedValue([toolWithoutSchema]);

      const translatedToolWithDefaults = {
        name: 'no-schema-tool',
        description: 'Tool without schema',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: true,
        },
      };

      mockSchemaTranslator.translateTool.mockReturnValue(translatedToolWithDefaults);

      await registry.refreshAllTools();

      const tool = registry.getTool('no-schema-tool');
      expect(tool).toBeDefined();
      expect(mockSchemaTranslator.translateTool).toHaveBeenCalledWith(
        expect.objectContaining({
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: true,
          },
        })
      );
    });
  });

  describe('connection state updates', () => {
    it('should handle updates for non-existent connections', () => {
      // Should not throw
      registry.updateConnectionState('non-existent', 'connected');
      expect(registry).toBeDefined();
    });

    it('should handle state changes for connections without tools', async () => {
      await registry.addConnection({
        ...mockConnection,
        serverId: 'empty-server',
      });

      mockClient.listTools.mockResolvedValue([]);

      registry.updateConnectionState('empty-server', 'disconnected');
      expect(registry).toBeDefined();
    });
  });

  describe('multiple tools handling', () => {
    const additionalTool: MCPToolDefinition = {
      name: 'second-tool',
      description: 'Second test tool',
      inputSchema: {
        type: 'object',
        properties: {
          value: { type: 'string' },
        },
      },
    };

    it('should handle multiple tools from same connection', async () => {
      mockClient.listTools.mockResolvedValue([mockToolDefinition, additionalTool]);

      await registry.refreshAllTools();

      expect(registry.getAllTools()).toHaveLength(2);
      expect(registry.hasTool(TEST_TOOL_NAME)).toBe(true);
      expect(registry.hasTool('second-tool')).toBe(true);
    });

    it('should replace tools when refreshing connection', async () => {
      // First refresh with two tools
      mockClient.listTools.mockResolvedValue([mockToolDefinition, additionalTool]);
      await registry.refreshAllTools();
      expect(registry.getAllTools()).toHaveLength(2);

      // Second refresh with only one tool
      mockClient.listTools.mockResolvedValue([mockToolDefinition]);
      await registry.refreshAllTools();
      expect(registry.getAllTools()).toHaveLength(1);
      expect(registry.hasTool(TEST_TOOL_NAME)).toBe(true);
      expect(registry.hasTool('second-tool')).toBe(false);
    });
  });
});