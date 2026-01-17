/**
 * Performance and stress tests for MCPToolRegistry
 * Tests scalability and performance characteristics
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type {
  MCPConnection,
  MCPToolSchema,
} from '@apexcli/core';
import {
  MCPToolRegistry,
  type MCPConnectionManager,
} from './mcp-tool-registry.js';
import { MCPClient, type MCPToolDefinition } from './mcp/client.js';
import { SchemaTranslator } from './schema-translator.js';

// ============================================================================
// Performance Test Utilities
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

const generateToolBatch = (batchId: string, count: number): MCPToolDefinition[] => {
  return Array.from({ length: count }, (_, i) => ({
    name: `tool-${batchId}-${i}`,
    description: `Performance test tool ${i} from batch ${batchId}`,
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          minLength: 1,
          maxLength: 1000,
        },
        options: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['fast', 'accurate', 'balanced'],
              default: 'balanced'
            },
            iterations: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              default: 10
            },
            async: {
              type: 'boolean',
              default: false
            },
          },
        },
        metadata: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              value: {
                oneOf: [
                  { type: 'string' },
                  { type: 'number' },
                  { type: 'boolean' }
                ]
              }
            },
            required: ['key', 'value']
          },
          maxItems: 50,
        },
      },
      required: ['input'],
      additionalProperties: false,
    } as MCPToolSchema,
  }));
};

const createMockClientWithTools = (tools: MCPToolDefinition[]): MCPClient => {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue(tools),
    callTool: vi.fn().mockImplementation((name: string, args: Record<string, unknown>) =>
      Promise.resolve({ result: `Called ${name} with ${JSON.stringify(args)}` })
    ),
    ping: vi.fn().mockResolvedValue(undefined),
  } as any;
};

const measurePerformance = async (fn: () => Promise<void>): Promise<number> => {
  const start = performance.now();
  await fn();
  return performance.now() - start;
};

// ============================================================================
// Performance Tests
// ============================================================================

describe('MCPToolRegistry - Performance Tests', () => {
  let registry: MCPToolRegistry;

  beforeEach(() => {
    registry = new MCPToolRegistry({
      schemaTranslator: new SchemaTranslator(),
      operationTimeoutMs: 30000, // Longer timeout for performance tests
      autoRefresh: false,
    });
  });

  afterEach(() => {
    registry.shutdown();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Scale Tests
  // ==========================================================================

  describe('Scale Tests', () => {
    test('should handle 100 connections with 50 tools each efficiently', async () => {
      const connectionCount = 100;
      const toolsPerConnection = 50;
      const expectedTotalTools = connectionCount * toolsPerConnection;

      const connections: MCPConnection[] = [];
      const clients = new Map<string, MCPClient>();

      // Generate test data
      for (let i = 0; i < connectionCount; i++) {
        const connection = createMockConnection(`server-${i}`);
        const tools = generateToolBatch(`server-${i}`, toolsPerConnection);
        const client = createMockClientWithTools(tools);

        connections.push(connection);
        clients.set(connection.serverId, client);
      }

      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue(connections),
        getConnection: vi.fn().mockImplementation((id: string) =>
          connections.find(c => c.serverId === id)
        ),
        getClient: vi.fn().mockImplementation((id: string) => clients.get(id)),
      };

      registry.setConnectionManager(mockConnMgr);

      // Measure connection addition time
      const addTime = await measurePerformance(async () => {
        for (const connection of connections) {
          await registry.addConnection(connection);
        }
      });

      console.log(`Added ${connectionCount} connections in ${addTime.toFixed(2)}ms`);

      // Measure tool discovery time
      const refreshTime = await measurePerformance(async () => {
        await registry.refreshAllTools();
      });

      console.log(`Discovered ${expectedTotalTools} tools in ${refreshTime.toFixed(2)}ms`);

      // Verify results
      expect(registry.getAllTools()).toHaveLength(expectedTotalTools);
      expect(registry.getAvailableTools()).toHaveLength(expectedTotalTools);

      // Performance assertions (adjust based on environment)
      expect(addTime).toBeLessThan(5000); // Should add connections in under 5 seconds
      expect(refreshTime).toBeLessThan(10000); // Should refresh tools in under 10 seconds

      const stats = registry.getStats();
      expect(stats.totalTools).toBe(expectedTotalTools);
      expect(stats.availableTools).toBe(expectedTotalTools);
      expect(stats.activeConnections).toBe(connectionCount);
    }, 30000); // 30 second timeout for this test

    test('should handle rapid tool registry operations', async () => {
      const connection = createMockConnection('rapid-server');
      const tools = generateToolBatch('rapid', 1000);
      const mockClient = createMockClientWithTools(tools);

      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(mockClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      // Measure rapid access operations
      const accessTime = await measurePerformance(async () => {
        for (let i = 0; i < 1000; i++) {
          registry.getTool(`tool-rapid-${i % 100}`); // Test with existing and non-existing tools
          registry.hasTool(`tool-rapid-${i % 100}`);
          registry.isToolAvailable(`tool-rapid-${i % 100}`);
        }
      });

      console.log(`Performed 3000 registry access operations in ${accessTime.toFixed(2)}ms`);

      // Should complete rapid access operations quickly
      expect(accessTime).toBeLessThan(1000); // Under 1 second for 3000 operations

      // Measure rapid filter operations
      const filterTime = await measurePerformance(async () => {
        for (let i = 0; i < 100; i++) {
          registry.getAllTools();
          registry.getAvailableTools();
          registry.getToolsByConnection('rapid-server');
          registry.getStats();
        }
      });

      console.log(`Performed 400 registry filter operations in ${filterTime.toFixed(2)}ms`);

      // Should complete filter operations quickly
      expect(filterTime).toBeLessThan(1000); // Under 1 second for 400 operations
    }, 15000);
  });

  // ==========================================================================
  // Memory Usage Tests
  // ==========================================================================

  describe('Memory Usage Tests', () => {
    test('should handle memory efficiently with large tool sets', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Add large number of connections and tools
      const connectionCount = 50;
      const toolsPerConnection = 100;

      const connections: MCPConnection[] = [];
      const clients = new Map<string, MCPClient>();

      for (let i = 0; i < connectionCount; i++) {
        const connection = createMockConnection(`mem-server-${i}`);
        const tools = generateToolBatch(`mem-${i}`, toolsPerConnection);
        const client = createMockClientWithTools(tools);

        connections.push(connection);
        clients.set(connection.serverId, client);
      }

      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue(connections),
        getConnection: vi.fn().mockImplementation((id: string) =>
          connections.find(c => c.serverId === id)
        ),
        getClient: vi.fn().mockImplementation((id: string) => clients.get(id)),
      };

      registry.setConnectionManager(mockConnMgr);

      for (const connection of connections) {
        await registry.addConnection(connection);
      }
      await registry.refreshAllTools();

      const afterLoadMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterLoadMemory - initialMemory;

      console.log(`Memory increase after loading ${connectionCount * toolsPerConnection} tools: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);

      // Memory increase should be reasonable (adjust based on environment)
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024); // Under 500MB

      // Test memory cleanup
      registry.clear();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const afterClearMemory = process.memoryUsage().heapUsed;
      console.log(`Memory after clear: ${((afterClearMemory - initialMemory) / 1024 / 1024).toFixed(2)} MB increase from initial`);

      // Memory should be released (with some tolerance for GC timing)
      expect(afterClearMemory - initialMemory).toBeLessThan(memoryIncrease * 0.5);
    }, 20000);
  });

  // ==========================================================================
  // Concurrent Access Tests
  // ==========================================================================

  describe('Concurrent Access Tests', () => {
    test('should handle concurrent read operations safely', async () => {
      const connection = createMockConnection('concurrent-server');
      const tools = generateToolBatch('concurrent', 200);
      const mockClient = createMockClientWithTools(tools);

      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(mockClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      // Simulate concurrent readers
      const readerPromises = Array.from({ length: 10 }, async (_, i) => {
        const results: any[] = [];
        for (let j = 0; j < 100; j++) {
          const toolName = `tool-concurrent-${j}`;
          results.push({
            tool: registry.getTool(toolName),
            has: registry.hasTool(toolName),
            available: registry.isToolAvailable(toolName),
            stats: registry.getStats(),
          });
        }
        return results;
      });

      const concurrentTime = await measurePerformance(async () => {
        await Promise.all(readerPromises);
      });

      console.log(`Completed concurrent read operations in ${concurrentTime.toFixed(2)}ms`);

      // Should handle concurrent reads efficiently
      expect(concurrentTime).toBeLessThan(2000); // Under 2 seconds

      const results = await Promise.all(readerPromises);
      expect(results).toHaveLength(10);
      expect(results[0]).toHaveLength(100);
    });

    test('should handle concurrent refresh operations', async () => {
      const connections = Array.from({ length: 5 }, (_, i) =>
        createMockConnection(`refresh-server-${i}`)
      );

      const clients = new Map(
        connections.map((conn, i) => [
          conn.serverId,
          createMockClientWithTools(generateToolBatch(`refresh-${i}`, 50)),
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

      for (const connection of connections) {
        await registry.addConnection(connection);
      }

      // Perform multiple concurrent refreshes
      const refreshPromises = Array.from({ length: 3 }, () =>
        registry.refreshAllTools()
      );

      const concurrentRefreshTime = await measurePerformance(async () => {
        await Promise.all(refreshPromises);
      });

      console.log(`Completed concurrent refresh operations in ${concurrentRefreshTime.toFixed(2)}ms`);

      // Should handle concurrent refreshes without errors
      expect(registry.getAllTools()).toHaveLength(250); // 5 servers × 50 tools
      expect(concurrentRefreshTime).toBeLessThan(5000); // Under 5 seconds
    });
  });

  // ==========================================================================
  // Event Performance Tests
  // ==========================================================================

  describe('Event Performance Tests', () => {
    test('should handle high-frequency events efficiently', async () => {
      const eventCounts = {
        registered: 0,
        unregistered: 0,
        refreshed: 0,
        connectionAdded: 0,
        connectionRemoved: 0,
      };

      const eventListeners = {
        'tool:registered': () => eventCounts.registered++,
        'tool:unregistered': () => eventCounts.unregistered++,
        'registry:refreshed': () => eventCounts.refreshed++,
        'connection:added': () => eventCounts.connectionAdded++,
        'connection:removed': () => eventCounts.connectionRemoved++,
      };

      // Add multiple listeners for each event
      Object.entries(eventListeners).forEach(([event, listener]) => {
        for (let i = 0; i < 5; i++) { // 5 listeners per event type
          registry.on(event as any, listener);
        }
      });

      const connections = Array.from({ length: 20 }, (_, i) =>
        createMockConnection(`event-server-${i}`)
      );

      const clients = new Map(
        connections.map((conn, i) => [
          conn.serverId,
          createMockClientWithTools(generateToolBatch(`event-${i}`, 25)),
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

      const eventTime = await measurePerformance(async () => {
        // Add connections (triggers connection:added and tool:registered events)
        for (const connection of connections) {
          await registry.addConnection(connection);
        }

        await registry.refreshAllTools();

        // Remove connections (triggers connection:removed and tool:unregistered events)
        for (const connection of connections) {
          await registry.removeConnection(connection.serverId);
        }
      });

      console.log(`Processed high-frequency events in ${eventTime.toFixed(2)}ms`);
      console.log(`Event counts:`, eventCounts);

      // Verify all events were fired
      expect(eventCounts.connectionAdded).toBe(20 * 5); // 20 connections × 5 listeners
      expect(eventCounts.connectionRemoved).toBe(20 * 5);
      expect(eventCounts.registered).toBe(500 * 5); // 20 × 25 tools × 5 listeners
      expect(eventCounts.unregistered).toBe(500 * 5);
      expect(eventCounts.refreshed).toBe(1 * 5); // 1 refresh × 5 listeners

      // Should handle high event frequency efficiently
      expect(eventTime).toBeLessThan(5000); // Under 5 seconds
    });
  });
});