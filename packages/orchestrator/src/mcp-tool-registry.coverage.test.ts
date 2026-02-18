/**
 * Coverage-focused tests for MCPToolRegistry
 * Ensures all code paths are exercised
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type {
  MCPConnection,
  MCPToolSchema,
} from '@apexcli/core';
import {
  MCPToolRegistry,
  type MCPConnectionManager,
  type MCPToolRegistryOptions,
} from './mcp-tool-registry.js';
import { MCPClient, type MCPToolDefinition } from './mcp/client.js';
import { SchemaTranslator } from './schema-translator.js';

// ============================================================================
// Coverage Test Utilities
// ============================================================================

const createMockConnection = (
  serverId: string,
  serverName?: string
): MCPConnection => ({
  serverId,
  serverName: serverName || `Server ${serverId}`,
  state: 'connected',
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

const createMinimalTool = (name: string): MCPToolDefinition => ({
  name,
  description: undefined, // Test missing description
  inputSchema: undefined as any, // Test missing schema
});

// ============================================================================
// Coverage Tests
// ============================================================================

describe('MCPToolRegistry - Coverage Tests', () => {
  let registry: MCPToolRegistry;

  beforeEach(() => {
    registry = new MCPToolRegistry();
  });

  afterEach(() => {
    registry.shutdown();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Constructor Options Coverage
  // ==========================================================================

  describe('Constructor Options', () => {
    test('should handle all default options', () => {
      const defaultRegistry = new MCPToolRegistry();
      expect(defaultRegistry).toBeDefined();

      const stats = defaultRegistry.getStats();
      expect(stats.totalTools).toBe(0);

      defaultRegistry.shutdown();
    });

    test('should handle custom schema translator', () => {
      const customTranslator = new SchemaTranslator({
        allOptional: true,
        allowAdditionalProperties: true,
        preserveDefaults: false,
      });

      const registryWithCustomTranslator = new MCPToolRegistry({
        schemaTranslator: customTranslator,
      });

      expect(registryWithCustomTranslator).toBeDefined();
      registryWithCustomTranslator.shutdown();
    });

    test('should handle all timeout and refresh options', () => {
      const customRegistry = new MCPToolRegistry({
        operationTimeoutMs: 5000,
        autoRefresh: false,
        autoRefreshInterval: 0,
      });

      expect((customRegistry as any).operationTimeoutMs).toBe(5000);
      expect((customRegistry as any).autoRefresh).toBe(false);
      expect((customRegistry as any).autoRefreshInterval).toBe(0);

      customRegistry.shutdown();
    });

    test('should handle auto-refresh disabled by zero interval', () => {
      const noAutoRefreshRegistry = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 0, // This should disable auto-refresh
      });

      expect((noAutoRefreshRegistry as any).autoRefreshTimer).toBeUndefined();
      noAutoRefreshRegistry.shutdown();
    });
  });

  // ==========================================================================
  // Edge Cases for Existing Methods
  // ==========================================================================

  describe('Method Edge Cases', () => {
    test('should handle updateConnectionState for non-existent connection', () => {
      // Should not throw
      expect(() => {
        registry.updateConnectionState('non-existent', 'connected');
      }).not.toThrow();

      // Should not affect stats
      const stats = registry.getStats();
      expect(stats.activeConnections).toBe(0);
    });

    test('should handle getToolsByConnection for non-existent connection', () => {
      const tools = registry.getToolsByConnection('non-existent');
      expect(tools).toEqual([]);
    });

    test('should handle tools with undefined/null schemas', async () => {
      const connection = createMockConnection('test-server');
      const minimalTool = createMinimalTool('minimal-tool');

      const mockClient: MCPClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue([minimalTool]),
        callTool: vi.fn().mockImplementation((name: string, args: Record<string, unknown>) =>
          Promise.resolve({ result: `Called ${name}` })
        ),
        ping: vi.fn().mockResolvedValue(undefined),
      } as any;

      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(mockClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      const tool = registry.getTool('minimal-tool');
      expect(tool).toBeDefined();
      expect(tool!.mcpTool.description).toContain('Server test-server'); // Fallback description
    });

    test('should handle refresh without connection manager', async () => {
      const connection = createMockConnection('isolated-server');
      await registry.addConnection(connection);

      // Should not crash when refreshing without connection manager
      await expect(registry.refreshAllTools()).resolves.not.toThrow();

      const stats = registry.getStats();
      expect(stats.totalTools).toBe(0); // No tools discovered without client
    });

    test('should handle refresh with stored connections vs connection manager', async () => {
      const storedConnection = createMockConnection('stored-server');
      const managerConnection = createMockConnection('manager-server');

      const tools = [{
        name: 'manager-tool',
        description: 'Tool from manager',
        inputSchema: { type: 'object', properties: {} } as MCPToolSchema
      }];

      const mockClient: MCPClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue(tools),
        callTool: vi.fn(),
        ping: vi.fn().mockResolvedValue(undefined),
      } as any;

      // Add stored connection first
      await registry.addConnection(storedConnection);

      // Then set up connection manager with different connection
      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([managerConnection]),
        getConnection: vi.fn().mockReturnValue(managerConnection),
        getClient: vi.fn().mockReturnValue(mockClient),
      };

      registry.setConnectionManager(mockConnMgr);

      // Should use manager connections, not stored ones
      await registry.refreshAllTools();

      expect(registry.hasTool('manager-tool')).toBe(true);
      const stats = registry.getStats();
      expect(stats.totalTools).toBe(1);
    });

    test('should handle tool with server name vs server ID', async () => {
      const connection = createMockConnection('server-id', 'Human Readable Server Name');
      const tools = [{
        name: 'named-tool',
        description: 'Tool with named server',
        inputSchema: { type: 'object', properties: {} } as MCPToolSchema
      }];

      const mockClient: MCPClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue(tools),
        callTool: vi.fn(),
        ping: vi.fn().mockResolvedValue(undefined),
      } as any;

      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(mockClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      const tool = registry.getTool('named-tool');
      expect(tool).toBeDefined();
      expect(tool!.serverName).toBe('Human Readable Server Name');
    });
  });

  // ==========================================================================
  // Error Path Coverage
  // ==========================================================================

  describe('Error Path Coverage', () => {
    test('should handle addConnection errors', async () => {
      const connection = createMockConnection('error-server');

      // Mock an error in schema translation or tool registration
      const errorRegistry = new MCPToolRegistry();
      const errorSpy = vi.fn();
      errorRegistry.on('error', errorSpy);

      // Force an error by mocking internal methods
      const originalRegisterTool = (errorRegistry as any).registerTool;
      (errorRegistry as any).registerTool = vi.fn().mockRejectedValue(new Error('Registration failed'));

      await errorRegistry.addConnection(connection);

      // Should not throw, but should emit error if refresh is attempted
      const tools = [{
        name: 'error-tool',
        description: 'Tool that causes error',
        inputSchema: { type: 'object', properties: {} } as MCPToolSchema
      }];

      const mockClient: MCPClient = {
        listTools: vi.fn().mockResolvedValue(tools),
      } as any;

      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(mockClient),
      };

      errorRegistry.setConnectionManager(mockConnMgr);
      await errorRegistry.refreshAllTools();

      errorRegistry.shutdown();
    });

    test('should handle removeConnection errors', async () => {
      const connection = createMockConnection('remove-error-server');
      await registry.addConnection(connection);

      const errorSpy = vi.fn();
      registry.on('error', errorSpy);

      // Mock an error in the unregisterTool method
      const originalUnregisterTool = (registry as any).unregisterTool;
      (registry as any).unregisterTool = vi.fn().mockImplementation(() => {
        throw new Error('Unregister failed');
      });

      // Should handle error gracefully
      await expect(registry.removeConnection('remove-error-server')).resolves.not.toThrow();

      // Restore original method
      (registry as any).unregisterTool = originalUnregisterTool;
    });

    test('should handle auto-refresh errors', async () => {
      const autoRefreshRegistry = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 100,
      });

      const connection = createMockConnection('auto-error-server');
      const errorSpy = vi.fn();
      autoRefreshRegistry.on('error', errorSpy);

      // Set up a client that will fail
      const failingClient: MCPClient = {
        listTools: vi.fn().mockRejectedValue(new Error('Auto-refresh failed')),
      } as any;

      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(failingClient),
      };

      autoRefreshRegistry.setConnectionManager(mockConnMgr);
      await autoRefreshRegistry.addConnection(connection);

      // Wait for auto-refresh to trigger and fail
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'autoRefresh',
        error: expect.stringContaining('Auto-refresh failed'),
      }));

      autoRefreshRegistry.shutdown();
    });

    test('should handle auto-refresh on connection state change errors', async () => {
      const connection = createMockConnection('state-change-error-server');

      const autoRefreshRegistry = new MCPToolRegistry({
        autoRefresh: true,
      });

      const errorSpy = vi.fn();
      autoRefreshRegistry.on('error', errorSpy);

      const failingClient: MCPClient = {
        listTools: vi.fn().mockRejectedValue(new Error('State change refresh failed')),
      } as any;

      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(failingClient),
      };

      autoRefreshRegistry.setConnectionManager(mockConnMgr);
      await autoRefreshRegistry.addConnection(connection);

      // Change state to disconnected then back to connected (should trigger refresh)
      autoRefreshRegistry.updateConnectionState('state-change-error-server', 'disconnected');
      autoRefreshRegistry.updateConnectionState('state-change-error-server', 'connected');

      // Wait for the refresh attempt
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'autoRefreshOnConnect',
        connectionId: 'state-change-error-server',
        error: expect.stringContaining('State change refresh failed'),
      }));

      autoRefreshRegistry.shutdown();
    });
  });

  // ==========================================================================
  // Event System Coverage
  // ==========================================================================

  describe('Event System Coverage', () => {
    test('should handle removeAllListeners in shutdown', () => {
      const testRegistry = new MCPToolRegistry();

      // Add some listeners
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      testRegistry.on('tool:registered', listener1);
      testRegistry.on('registry:refreshed', listener2);

      // Verify listeners are added
      expect(testRegistry.listenerCount('tool:registered')).toBe(1);
      expect(testRegistry.listenerCount('registry:refreshed')).toBe(1);

      // Shutdown should remove all listeners
      testRegistry.shutdown();

      expect(testRegistry.listenerCount('tool:registered')).toBe(0);
      expect(testRegistry.listenerCount('registry:refreshed')).toBe(0);
    });

    test('should emit all event types with proper data', async () => {
      const connection = createMockConnection('event-test-server', 'Event Test Server');
      const tools = [{
        name: 'event-tool',
        description: 'Tool for event testing',
        inputSchema: { type: 'object', properties: {} } as MCPToolSchema
      }];

      const mockClient: MCPClient = {
        listTools: vi.fn().mockResolvedValue(tools),
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        callTool: vi.fn(),
        ping: vi.fn().mockResolvedValue(undefined),
      } as any;

      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(mockClient),
      };

      const events: Record<string, any[]> = {};
      const eventTypes = [
        'tool:registered',
        'tool:unregistered',
        'registry:refreshed',
        'connection:added',
        'connection:removed',
        'error'
      ];

      eventTypes.forEach(eventType => {
        events[eventType] = [];
        registry.on(eventType as any, (data) => {
          events[eventType].push(data);
        });
      });

      registry.setConnectionManager(mockConnMgr);

      // Trigger connection:added and tool:registered
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      // Trigger registry:refreshed
      await registry.refreshAllTools();

      // Trigger tool:unregistered and connection:removed
      await registry.removeConnection('event-test-server', 'Test removal');

      // Verify all events were emitted with proper data
      expect(events['connection:added']).toHaveLength(1);
      expect(events['connection:added'][0]).toEqual({
        connectionId: 'event-test-server',
        serverName: 'Event Test Server',
      });

      expect(events['tool:registered']).toHaveLength(1);
      expect(events['tool:registered'][0]).toEqual(expect.objectContaining({
        toolName: 'event-tool',
        connectionId: 'event-test-server',
        entry: expect.any(Object),
      }));

      expect(events['registry:refreshed']).toHaveLength(2); // Two refresh calls
      expect(events['registry:refreshed'][0]).toEqual(expect.objectContaining({
        connectionsRefreshed: 1,
        toolsDiscovered: 1,
        duration: expect.any(Number),
      }));

      expect(events['tool:unregistered']).toHaveLength(1);
      expect(events['tool:unregistered'][0]).toEqual({
        toolName: 'event-tool',
        connectionId: 'event-test-server',
      });

      expect(events['connection:removed']).toHaveLength(1);
      expect(events['connection:removed'][0]).toEqual({
        connectionId: 'event-test-server',
        reason: 'Test removal',
      });
    });
  });

  // ==========================================================================
  // Auto-Refresh Timer Coverage
  // ==========================================================================

  describe('Auto-Refresh Timer Coverage', () => {
    test('should properly manage auto-refresh timer lifecycle', () => {
      // Test starting with auto-refresh enabled
      const autoRegistry = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 1000,
      });

      expect((autoRegistry as any).autoRefreshTimer).toBeDefined();

      // Test stopping auto-refresh
      autoRegistry.stopAutoRefresh();
      expect((autoRegistry as any).autoRefreshTimer).toBeUndefined();

      // Test restarting auto-refresh
      autoRegistry.setAutoRefreshInterval(2000);
      expect((autoRegistry as any).autoRefreshInterval).toBe(2000);
      // Timer should not be running since auto-refresh is disabled
      expect((autoRegistry as any).autoRefreshTimer).toBeUndefined();

      // Re-enable auto-refresh with existing interval
      (autoRegistry as any).autoRefresh = true;
      autoRegistry.setAutoRefreshInterval(3000);
      expect((autoRegistry as any).autoRefreshTimer).toBeDefined();

      autoRegistry.shutdown();
    });

    test('should handle timer restart when setting new interval', () => {
      const autoRegistry = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 1000,
      });

      const firstTimer = (autoRegistry as any).autoRefreshTimer;
      expect(firstTimer).toBeDefined();

      // Setting new interval should clear old timer and create new one
      autoRegistry.setAutoRefreshInterval(2000);
      const secondTimer = (autoRegistry as any).autoRefreshTimer;

      expect(secondTimer).toBeDefined();
      expect(secondTimer).not.toBe(firstTimer);

      autoRegistry.shutdown();
    });
  });
});