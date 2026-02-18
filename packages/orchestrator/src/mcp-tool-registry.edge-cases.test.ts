/**
 * Additional edge case tests for MCPToolRegistry
 * Covers scenarios not fully tested in the main test suite
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

const createComplexMCPTool = (name: string): MCPToolDefinition => ({
  name,
  description: `Complex tool ${name} with nested schema`,
  inputSchema: {
    type: 'object',
    properties: {
      config: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['fast', 'thorough'],
            default: 'fast'
          },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string', minLength: 1 },
                value: {
                  oneOf: [
                    { type: 'string' },
                    { type: 'number' },
                    { type: 'boolean' }
                  ]
                }
              },
              required: ['key']
            },
            minItems: 1
          },
          metadata: {
            type: 'object',
            additionalProperties: true
          }
        },
        required: ['mode']
      },
      files: {
        type: 'array',
        items: {
          type: 'string',
          pattern: '\\.(js|ts|json)$'
        },
        maxItems: 10
      }
    },
    required: ['config'],
    additionalProperties: false
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

const createSlowMockClient = (tools: MCPToolDefinition[] = [], delayMs: number = 1000): MCPClient => {
  const mockClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve(tools), delayMs))
    ),
    callTool: vi.fn().mockImplementation((name: string, args: Record<string, unknown>) =>
      Promise.resolve({ result: `Called ${name} with ${JSON.stringify(args)}` })
    ),
    ping: vi.fn().mockResolvedValue(undefined),
  } as any;

  return mockClient;
};

// ============================================================================
// Edge Case Tests
// ============================================================================

describe('MCPToolRegistry - Edge Cases', () => {
  let registry: MCPToolRegistry;
  let mockSchemaTranslator: SchemaTranslator;

  beforeEach(() => {
    mockSchemaTranslator = new SchemaTranslator();
    registry = new MCPToolRegistry({
      schemaTranslator: mockSchemaTranslator,
      operationTimeoutMs: 1000, // Short timeout for testing
      autoRefresh: false,
    });
  });

  afterEach(() => {
    registry.shutdown();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Complex Schema Translation Tests
  // ==========================================================================

  describe('Complex Schema Translation', () => {
    test('should handle deeply nested object schemas', async () => {
      const connection = createMockConnection('test-server');
      const complexTool = createComplexMCPTool('nested-tool');
      const mockClient = createSlowMockClient([complexTool], 50);

      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(mockClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      const tool = registry.getTool('nested-tool');
      expect(tool).toBeDefined();
      expect(tool!.claudeTool.parameters).toBeDefined();
      expect(tool!.claudeTool.parameters._def.shape).toBeDefined();
    });

    test('should handle malformed JSON schemas gracefully', async () => {
      const connection = createMockConnection('test-server');
      const malformedTool: MCPToolDefinition = {
        name: 'malformed-tool',
        description: 'Tool with malformed schema',
        inputSchema: {
          type: 'object',
          properties: {
            invalid: {
              type: 'nonexistent-type' as any,
              properties: 'not-an-object' as any,
              required: 'not-an-array' as any,
            },
          },
          required: ['invalid'],
        } as MCPToolSchema,
      };

      const mockClient = createSlowMockClient([malformedTool], 50);
      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(mockClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      const tool = registry.getTool('malformed-tool');
      expect(tool).toBeDefined();
      // Should still register the tool with fallback schema
      expect(tool!.claudeTool.parameters).toBeDefined();
    });

    test('should handle circular references in schemas', async () => {
      const connection = createMockConnection('test-server');
      const circularTool: MCPToolDefinition = {
        name: 'circular-tool',
        description: 'Tool with circular schema references',
        inputSchema: {
          type: 'object',
          properties: {
            node: {
              type: 'object',
              properties: {
                value: { type: 'string' },
                // This would normally create a circular reference
                children: {
                  type: 'array',
                  items: { $ref: '#/properties/node' } as any,
                },
              },
            },
          },
          required: ['node'],
        } as MCPToolSchema,
      };

      const mockClient = createSlowMockClient([circularTool], 50);
      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(mockClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      const tool = registry.getTool('circular-tool');
      expect(tool).toBeDefined();
      // Should handle circular references without infinite loops
    });
  });

  // ==========================================================================
  // Concurrent Operations Tests
  // ==========================================================================

  describe('Concurrent Operations', () => {
    test('should handle concurrent connection additions', async () => {
      const connections = Array.from({ length: 5 }, (_, i) =>
        createMockConnection(`server-${i}`, 'connected')
      );

      const tools = connections.map((_, i) => [
        { name: `tool-${i}-1`, description: `Tool 1 from server ${i}`, inputSchema: { type: 'object', properties: {} } },
        { name: `tool-${i}-2`, description: `Tool 2 from server ${i}`, inputSchema: { type: 'object', properties: {} } },
      ]);

      const clients = new Map(
        connections.map((conn, i) => [
          conn.serverId,
          createSlowMockClient(tools[i] as MCPToolDefinition[], 100),
        ])
      );

      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue(connections),
        getConnection: vi.fn().mockImplementation((id: string) =>
          connections.find(c => c.serverId === id)
        ),
        getClient: vi.fn().mockImplementation((id: string) => clients.get(id)),
      };

      registry.setConnectionManager(mockConnMgr);

      // Add all connections concurrently
      const addPromises = connections.map(conn => registry.addConnection(conn));
      await Promise.all(addPromises);

      // Refresh all tools concurrently
      await registry.refreshAllTools();

      const allTools = registry.getAllTools();
      expect(allTools.length).toBe(10); // 5 servers × 2 tools each
    });

    test('should handle rapid connection state changes', async () => {
      const connection = createMockConnection('flaky-server');
      const tools = [{
        name: 'flaky-tool',
        description: 'Tool from flaky server',
        inputSchema: { type: 'object', properties: {} } as MCPToolSchema
      }];

      const mockClient = createSlowMockClient(tools, 50);
      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(mockClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      expect(registry.isToolAvailable('flaky-tool')).toBe(true);

      // Rapidly change connection states
      registry.updateConnectionState('flaky-server', 'disconnected');
      expect(registry.isToolAvailable('flaky-tool')).toBe(false);

      registry.updateConnectionState('flaky-server', 'connecting');
      expect(registry.isToolAvailable('flaky-tool')).toBe(false);

      registry.updateConnectionState('flaky-server', 'connected');
      expect(registry.isToolAvailable('flaky-tool')).toBe(true);

      registry.updateConnectionState('flaky-server', 'error');
      expect(registry.isToolAvailable('flaky-tool')).toBe(false);
    });
  });

  // ==========================================================================
  // Memory Management Tests
  // ==========================================================================

  describe('Memory Management', () => {
    test('should handle registry with large number of tools', async () => {
      const connection = createMockConnection('bulk-server');
      const tools: MCPToolDefinition[] = Array.from({ length: 1000 }, (_, i) => ({
        name: `bulk-tool-${i}`,
        description: `Bulk tool ${i}`,
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' },
            index: { type: 'number', default: i },
          },
          required: ['input'],
        } as MCPToolSchema,
      }));

      const mockClient = createSlowMockClient(tools, 100);
      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(mockClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      expect(registry.getAllTools().length).toBe(1000);

      const stats = registry.getStats();
      expect(stats.totalTools).toBe(1000);
      expect(stats.availableTools).toBe(1000);
      expect(stats.toolsByConnection['bulk-server']).toBe(1000);

      // Cleanup should handle large registry
      registry.clear();
      expect(registry.getAllTools().length).toBe(0);
    });

    test('should handle repeated connection add/remove cycles', async () => {
      const connection = createMockConnection('cycling-server');
      const tools = [{
        name: 'cycling-tool',
        description: 'Tool for cycling test',
        inputSchema: { type: 'object', properties: {} } as MCPToolSchema
      }];

      const mockClient = createSlowMockClient(tools, 10);
      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(mockClient),
      };

      registry.setConnectionManager(mockConnMgr);

      // Perform multiple add/remove cycles
      for (let i = 0; i < 10; i++) {
        await registry.addConnection(connection);
        await registry.refreshAllTools();
        expect(registry.hasTool('cycling-tool')).toBe(true);

        await registry.removeConnection('cycling-server', `cycle ${i}`);
        expect(registry.hasTool('cycling-tool')).toBe(false);
      }

      const stats = registry.getStats();
      expect(stats.totalTools).toBe(0);
    });
  });

  // ==========================================================================
  // Error Recovery Tests
  // ==========================================================================

  describe('Error Recovery', () => {
    test('should recover from transient network errors', async () => {
      const connection = createMockConnection('unreliable-server');
      let callCount = 0;

      const unreliableClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 2) {
            return Promise.reject(new Error('Network timeout'));
          }
          return Promise.resolve([{
            name: 'recovered-tool',
            description: 'Tool after recovery',
            inputSchema: { type: 'object', properties: {} } as MCPToolSchema
          }]);
        }),
        callTool: vi.fn().mockImplementation((name: string, args: Record<string, unknown>) =>
          Promise.resolve({ result: `Called ${name} with ${JSON.stringify(args)}` })
        ),
        ping: vi.fn().mockResolvedValue(undefined),
      } as any;

      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(unreliableClient),
      };

      const errorSpy = vi.fn();
      registry.on('error', errorSpy);
      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection);

      // First two attempts should fail
      await registry.refreshAllTools();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(registry.hasTool('recovered-tool')).toBe(false);

      await registry.refreshAllTools();
      expect(errorSpy).toHaveBeenCalledTimes(2);

      // Third attempt should succeed
      await registry.refreshAllTools();
      expect(registry.hasTool('recovered-tool')).toBe(true);
    });

    test('should handle schema translation errors gracefully', async () => {
      const connection = createMockConnection('error-server');

      // Mock schema translator that throws on specific tools
      const errorTranslator = {
        translateTool: vi.fn().mockImplementation((tool: any) => {
          if (tool.name === 'error-tool') {
            throw new Error('Schema translation failed');
          }
          return mockSchemaTranslator.translateTool(tool);
        }),
      } as any;

      const errorRegistry = new MCPToolRegistry({
        schemaTranslator: errorTranslator,
        operationTimeoutMs: 1000,
        autoRefresh: false,
      });

      const tools = [
        { name: 'error-tool', description: 'Tool that causes translation error', inputSchema: { type: 'object', properties: {} } },
        { name: 'good-tool', description: 'Tool that translates fine', inputSchema: { type: 'object', properties: {} } },
      ];

      const mockClient = createSlowMockClient(tools as MCPToolDefinition[], 50);
      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(mockClient),
      };

      const errorSpy = vi.fn();
      errorRegistry.on('error', errorSpy);
      errorRegistry.setConnectionManager(mockConnMgr);

      await errorRegistry.addConnection(connection);
      await errorRegistry.refreshAllTools();

      // Should register the good tool, skip the error tool
      expect(errorRegistry.hasTool('good-tool')).toBe(true);
      expect(errorRegistry.hasTool('error-tool')).toBe(false);

      errorRegistry.shutdown();
    });
  });

  // ==========================================================================
  // Auto-Refresh Edge Cases
  // ==========================================================================

  describe('Auto-Refresh Edge Cases', () => {
    test('should handle auto-refresh with changing connection states', async () => {
      const autoRefreshRegistry = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 100, // Very fast for testing
        operationTimeoutMs: 1000,
      });

      const connection = createMockConnection('auto-server', 'connected');
      const tools = [{
        name: 'auto-tool',
        description: 'Auto refresh tool',
        inputSchema: { type: 'object', properties: {} } as MCPToolSchema
      }];

      const mockClient = createSlowMockClient(tools, 50);
      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(mockClient),
      };

      autoRefreshRegistry.setConnectionManager(mockConnMgr);
      await autoRefreshRegistry.addConnection(connection);

      // Wait for auto-refresh to trigger
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(autoRefreshRegistry.hasTool('auto-tool')).toBe(true);

      // Disconnect and wait for auto-refresh
      autoRefreshRegistry.updateConnectionState('auto-server', 'disconnected');
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(autoRefreshRegistry.isToolAvailable('auto-tool')).toBe(false);

      autoRefreshRegistry.shutdown();
    });

    test('should handle auto-refresh interval changes', () => {
      const autoRefreshRegistry = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 1000,
      });

      expect((autoRefreshRegistry as any).autoRefreshInterval).toBe(1000);
      expect((autoRefreshRegistry as any).autoRefreshTimer).toBeDefined();

      autoRefreshRegistry.setAutoRefreshInterval(5000);
      expect((autoRefreshRegistry as any).autoRefreshInterval).toBe(5000);

      autoRefreshRegistry.setAutoRefreshInterval(0);
      expect((autoRefreshRegistry as any).autoRefreshTimer).toBeUndefined();

      autoRefreshRegistry.shutdown();
    });
  });

  // ==========================================================================
  // Event System Edge Cases
  // ==========================================================================

  describe('Event System Edge Cases', () => {
    test('should handle listener removal during event emission', async () => {
      const connection = createMockConnection('event-server');
      const tools = [{
        name: 'event-tool',
        description: 'Tool for event tests',
        inputSchema: { type: 'object', properties: {} } as MCPToolSchema
      }];

      const mockClient = createSlowMockClient(tools, 50);
      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(mockClient),
      };

      let listenerCallCount = 0;
      const selfRemovingListener = () => {
        listenerCallCount++;
        registry.off('tool:registered', selfRemovingListener);
      };

      registry.on('tool:registered', selfRemovingListener);
      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      expect(listenerCallCount).toBe(1);

      // Should not trigger listener again
      await registry.refreshAllTools();
      expect(listenerCallCount).toBe(1);
    });

    test('should handle errors in event listeners', async () => {
      const connection = createMockConnection('listener-error-server');
      const tools = [{
        name: 'listener-error-tool',
        description: 'Tool that triggers listener errors',
        inputSchema: { type: 'object', properties: {} } as MCPToolSchema
      }];

      const mockClient = createSlowMockClient(tools, 50);
      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(mockClient),
      };

      const errorThrowingListener = () => {
        throw new Error('Listener error');
      };

      const normalListener = vi.fn();

      registry.on('tool:registered', errorThrowingListener);
      registry.on('tool:registered', normalListener);
      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection);

      // Should not prevent normal operation even if listener throws
      await expect(registry.refreshAllTools()).resolves.not.toThrow();
      expect(registry.hasTool('listener-error-tool')).toBe(true);
      expect(normalListener).toHaveBeenCalled();
    });
  });
});