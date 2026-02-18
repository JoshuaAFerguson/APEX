/**
 * Enhanced Comprehensive MCPToolRegistry Tests
 *
 * This test suite provides comprehensive test coverage for MCPToolRegistry
 * including advanced scenarios, edge cases, and performance testing.
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
  type MCPToolRegistryOptions,
} from '../mcp-tool-registry.js';
import { MCPClient, type MCPToolDefinition } from '../mcp/client.js';
import { SchemaTranslator } from '../schema-translator.js';

// ============================================================================
// Advanced Test Fixtures and Utilities
// ============================================================================

interface AdvancedMockClientOptions {
  tools?: MCPToolDefinition[];
  latency?: number;
  errorRate?: number;
  maxTools?: number;
  simulateTimeout?: boolean;
}

class AdvancedMockClient {
  private tools: MCPToolDefinition[];
  private latency: number;
  private errorRate: number;
  private requestCount = 0;

  constructor(private options: AdvancedMockClientOptions = {}) {
    this.tools = options.tools || [];
    this.latency = options.latency || 0;
    this.errorRate = options.errorRate || 0;
  }

  async connect(): Promise<void> {
    await this.delay(this.latency);
  }

  async disconnect(): Promise<void> {
    await this.delay(this.latency);
  }

  async listTools(): Promise<MCPToolDefinition[]> {
    this.requestCount++;

    if (this.options.simulateTimeout) {
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    if (Math.random() < this.errorRate) {
      throw new Error(`Random client error (request ${this.requestCount})`);
    }

    await this.delay(this.latency);

    // Simulate tools appearing/disappearing based on request count
    if (this.options.maxTools && this.tools.length > this.options.maxTools) {
      return this.tools.slice(0, this.options.maxTools);
    }

    return [...this.tools];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    await this.delay(this.latency);

    const tool = this.tools.find(t => t.name === name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    return { result: `Called ${name}`, args };
  }

  async ping(): Promise<void> {
    await this.delay(this.latency);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test utilities
  addTool(tool: MCPToolDefinition): void {
    this.tools.push(tool);
  }

  removeTool(name: string): void {
    const index = this.tools.findIndex(t => t.name === name);
    if (index >= 0) {
      this.tools.splice(index, 1);
    }
  }

  updateTool(name: string, updates: Partial<MCPToolDefinition>): void {
    const tool = this.tools.find(t => t.name === name);
    if (tool) {
      Object.assign(tool, updates);
    }
  }
}

// Generate diverse tool configurations for testing
function generateToolSuite(serverId: string, count: number = 10): MCPToolDefinition[] {
  const tools: MCPToolDefinition[] = [];

  for (let i = 0; i < count; i++) {
    const toolTypes = ['file', 'database', 'api', 'utility', 'transform'];
    const type = toolTypes[i % toolTypes.length];

    tools.push({
      name: `${type}-tool-${i}`,
      description: `A ${type} tool for testing (${serverId})`,
      inputSchema: generateComplexSchema(type, i)
    });
  }

  return tools;
}

function generateComplexSchema(type: string, variant: number): MCPToolSchema {
  const baseSchemas = {
    file: {
      type: 'object',
      properties: {
        path: { type: 'string', pattern: '^/.*' },
        mode: { type: 'string', enum: ['read', 'write', 'append'] },
        encoding: { type: 'string', default: 'utf8' }
      },
      required: ['path', 'mode']
    },
    database: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1 },
        params: { type: 'array', items: { type: 'string' } },
        timeout: { type: 'number', minimum: 0, maximum: 30000 }
      },
      required: ['query']
    },
    api: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
        headers: { type: 'object', additionalProperties: { type: 'string' } },
        body: { type: 'string' }
      },
      required: ['url', 'method']
    },
    utility: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['hash', 'encode', 'decode', 'validate'] },
        input: { type: 'string' },
        options: {
          type: 'object',
          properties: {
            algorithm: { type: 'string' },
            format: { type: 'string' }
          }
        }
      },
      required: ['operation', 'input']
    },
    transform: {
      type: 'object',
      properties: {
        source: { type: 'string' },
        target: { type: 'string' },
        rules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pattern: { type: 'string' },
              replacement: { type: 'string' }
            },
            required: ['pattern', 'replacement']
          }
        }
      },
      required: ['source', 'target', 'rules']
    }
  };

  const schema = { ...baseSchemas[type as keyof typeof baseSchemas] };

  // Add variant-specific properties
  if (variant % 2 === 0) {
    (schema.properties as any).priority = { type: 'integer', minimum: 1, maximum: 10 };
  }

  if (variant % 3 === 0) {
    (schema.properties as any).metadata = {
      type: 'object',
      additionalProperties: true
    };
  }

  return schema;
}

// Mock connection manager with advanced behavior
function createAdvancedConnectionManager(
  connections: Map<string, MCPConnection>,
  clients: Map<string, AdvancedMockClient>
): MCPConnectionManager {
  return {
    listConnections: vi.fn().mockImplementation(() => Array.from(connections.values())),
    getConnection: vi.fn().mockImplementation((id: string) => connections.get(id)),
    getClient: vi.fn().mockImplementation((id: string) => clients.get(id) as any),
  };
}

function createMockConnection(
  serverId: string,
  state: MCPConnectionState = 'connected',
  serverName?: string
): MCPConnection {
  return {
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
  };
}

// ============================================================================
// Enhanced Test Suite
// ============================================================================

describe('Enhanced MCPToolRegistry Tests', () => {
  let registry: MCPToolRegistry;
  let mockConnections: Map<string, MCPConnection>;
  let mockClients: Map<string, AdvancedMockClient>;
  let mockConnectionManager: MCPConnectionManager;

  beforeEach(() => {
    mockConnections = new Map();
    mockClients = new Map();

    mockConnectionManager = createAdvancedConnectionManager(mockConnections, mockClients);

    registry = new MCPToolRegistry({
      operationTimeoutMs: 5000,
      autoRefresh: false,
      autoRefreshInterval: 0,
    });

    registry.setConnectionManager(mockConnectionManager);
  });

  afterEach(() => {
    registry.shutdown();
    mockConnections.clear();
    mockClients.clear();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Large-Scale Tool Management
  // ==========================================================================

  describe('Large-Scale Tool Management', () => {
    test('should handle registry with hundreds of tools from multiple servers', async () => {
      const serverCount = 5;
      const toolsPerServer = 50;

      // Setup multiple servers with many tools each
      for (let i = 0; i < serverCount; i++) {
        const serverId = `server-${i}`;
        const connection = createMockConnection(serverId);
        const tools = generateToolSuite(serverId, toolsPerServer);
        const client = new AdvancedMockClient({ tools });

        mockConnections.set(serverId, connection);
        mockClients.set(serverId, client);

        await registry.addConnection(connection);
      }

      await registry.refreshAllTools();

      const stats = registry.getStats();
      expect(stats.totalTools).toBe(serverCount * toolsPerServer);
      expect(stats.activeConnections).toBe(serverCount);

      // Verify all tools are accessible
      const allTools = registry.getAllTools();
      expect(allTools).toHaveLength(serverCount * toolsPerServer);

      // Verify tools from each server
      for (let i = 0; i < serverCount; i++) {
        const serverTools = registry.getToolsByConnection(`server-${i}`);
        expect(serverTools).toHaveLength(toolsPerServer);
      }
    });

    test('should efficiently handle rapid tool discovery updates', async () => {
      const serverId = 'dynamic-server';
      const connection = createMockConnection(serverId);
      const client = new AdvancedMockClient({ tools: [] });

      mockConnections.set(serverId, connection);
      mockClients.set(serverId, client);

      await registry.addConnection(connection);

      const registrationSpy = vi.fn();
      const unregistrationSpy = vi.fn();
      registry.on('tool:registered', registrationSpy);
      registry.on('tool:unregistered', unregistrationSpy);

      // Rapidly add and remove tools
      for (let cycle = 0; cycle < 10; cycle++) {
        // Add tools
        for (let i = 0; i < 5; i++) {
          client.addTool({
            name: `dynamic-tool-${cycle}-${i}`,
            description: `Dynamic tool ${i} in cycle ${cycle}`,
            inputSchema: { type: 'object', properties: {} }
          });
        }

        await registry.refreshAllTools();

        expect(registry.getAllTools()).toHaveLength((cycle + 1) * 5);

        // Remove some tools
        if (cycle > 0) {
          for (let i = 0; i < 3; i++) {
            client.removeTool(`dynamic-tool-${cycle - 1}-${i}`);
          }
          await registry.refreshAllTools();
        }
      }

      expect(registrationSpy).toHaveBeenCalled();
      expect(unregistrationSpy).toHaveBeenCalled();
    });

    test('should handle tool schema updates correctly', async () => {
      const serverId = 'schema-server';
      const connection = createMockConnection(serverId);
      const client = new AdvancedMockClient({
        tools: [{
          name: 'evolving-tool',
          description: 'A tool that evolves',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string' }
            },
            required: ['input']
          }
        }]
      });

      mockConnections.set(serverId, connection);
      mockClients.set(serverId, client);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      let tool = registry.getTool('evolving-tool');
      expect(tool?.mcpTool.inputSchema.required).toEqual(['input']);

      // Update the tool schema
      client.updateTool('evolving-tool', {
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' },
            options: { type: 'object', additionalProperties: true }
          },
          required: ['input', 'options']
        }
      });

      await registry.refreshAllTools();

      tool = registry.getTool('evolving-tool');
      expect(tool?.mcpTool.inputSchema.required).toEqual(['input', 'options']);
    });
  });

  // ==========================================================================
  // Error Resilience and Recovery
  // ==========================================================================

  describe('Error Resilience and Recovery', () => {
    test('should handle partial server failures during discovery', async () => {
      const stableServerId = 'stable-server';
      const unstableServerId = 'unstable-server';

      const stableConnection = createMockConnection(stableServerId);
      const unstableConnection = createMockConnection(unstableServerId);

      const stableClient = new AdvancedMockClient({
        tools: generateToolSuite(stableServerId, 3)
      });

      const unstableClient = new AdvancedMockClient({
        tools: generateToolSuite(unstableServerId, 3),
        errorRate: 0.8 // High error rate
      });

      mockConnections.set(stableServerId, stableConnection);
      mockConnections.set(unstableServerId, unstableConnection);
      mockClients.set(stableServerId, stableClient);
      mockClients.set(unstableServerId, unstableClient);

      await registry.addConnection(stableConnection);
      await registry.addConnection(unstableConnection);

      const errorSpy = vi.fn();
      registry.on('error', errorSpy);

      await registry.refreshAllTools();

      // Stable server tools should be registered
      const stableTools = registry.getToolsByConnection(stableServerId);
      expect(stableTools.length).toBeGreaterThan(0);

      // Unstable server may have failed
      const unstableTools = registry.getToolsByConnection(unstableServerId);
      // Should handle gracefully whether it succeeded or failed

      // Should have emitted errors for unstable server failures
      expect(errorSpy).toHaveBeenCalled();
    });

    test('should recover from temporary network issues', async () => {
      const serverId = 'recovery-server';
      const connection = createMockConnection(serverId);
      const client = new AdvancedMockClient({
        tools: generateToolSuite(serverId, 5),
        errorRate: 1.0 // Start with 100% error rate
      });

      mockConnections.set(serverId, connection);
      mockClients.set(serverId, client);

      await registry.addConnection(connection);

      // First refresh should fail
      await registry.refreshAllTools();
      expect(registry.getToolsByConnection(serverId)).toHaveLength(0);

      // Fix the network issue
      client.options.errorRate = 0.0;

      // Second refresh should succeed
      await registry.refreshAllTools();
      expect(registry.getToolsByConnection(serverId)).toHaveLength(5);
    });

    test('should handle malformed tool definitions gracefully', async () => {
      const serverId = 'malformed-server';
      const connection = createMockConnection(serverId);
      const client = new AdvancedMockClient({
        tools: [
          // Valid tool
          {
            name: 'valid-tool',
            description: 'A valid tool',
            inputSchema: {
              type: 'object',
              properties: { input: { type: 'string' } },
              required: ['input']
            }
          },
          // Tool with malformed schema
          {
            name: 'malformed-tool',
            description: 'A malformed tool',
            inputSchema: null as any
          },
          // Tool with circular references (simulated)
          {
            name: 'circular-tool',
            description: 'A tool with circular refs',
            inputSchema: {
              type: 'object',
              properties: {
                self: { $ref: '#' } // Circular reference
              }
            }
          }
        ]
      });

      mockConnections.set(serverId, connection);
      mockClients.set(serverId, client);

      await registry.addConnection(connection);

      const errorSpy = vi.fn();
      registry.on('error', errorSpy);

      await registry.refreshAllTools();

      // Should have registered what it could
      const tools = registry.getToolsByConnection(serverId);
      expect(tools.length).toBeGreaterThanOrEqual(1); // At least the valid tool

      const validTool = registry.getTool('valid-tool');
      expect(validTool).toBeDefined();
    });
  });

  // ==========================================================================
  // Performance and Optimization
  // ==========================================================================

  describe('Performance and Optimization', () => {
    test('should handle high-frequency registry updates efficiently', async () => {
      const serverId = 'performance-server';
      const connection = createMockConnection(serverId);
      const client = new AdvancedMockClient({
        tools: generateToolSuite(serverId, 10),
        latency: 1 // Minimal latency
      });

      mockConnections.set(serverId, connection);
      mockClients.set(serverId, client);

      await registry.addConnection(connection);

      // Measure performance of multiple rapid updates
      const updateCount = 50;
      const startTime = Date.now();

      for (let i = 0; i < updateCount; i++) {
        await registry.refreshAllTools();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      const avgTimePerUpdate = duration / updateCount;

      // Should complete reasonably quickly (under 100ms per update)
      expect(avgTimePerUpdate).toBeLessThan(100);

      // Should still have all tools registered
      expect(registry.getAllTools()).toHaveLength(10);
    });

    test('should efficiently manage memory with large tool counts', async () => {
      const serverCount = 10;
      const toolsPerServer = 20;

      // Setup many servers with many tools
      for (let i = 0; i < serverCount; i++) {
        const serverId = `memory-server-${i}`;
        const connection = createMockConnection(serverId);
        const tools = generateToolSuite(serverId, toolsPerServer);
        const client = new AdvancedMockClient({ tools });

        mockConnections.set(serverId, connection);
        mockClients.set(serverId, client);

        await registry.addConnection(connection);
      }

      await registry.refreshAllTools();

      const initialStats = registry.getStats();
      expect(initialStats.totalTools).toBe(serverCount * toolsPerServer);

      // Remove half the servers
      for (let i = 0; i < serverCount / 2; i++) {
        await registry.removeConnection(`memory-server-${i}`);
      }

      const afterRemovalStats = registry.getStats();
      expect(afterRemovalStats.totalTools).toBe((serverCount / 2) * toolsPerServer);

      // Clear all
      registry.clear();
      const afterClearStats = registry.getStats();
      expect(afterClearStats.totalTools).toBe(0);
    });

    test('should handle concurrent access patterns safely', async () => {
      const serverId = 'concurrent-server';
      const connection = createMockConnection(serverId);
      const client = new AdvancedMockClient({
        tools: generateToolSuite(serverId, 10)
      });

      mockConnections.set(serverId, connection);
      mockClients.set(serverId, client);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      // Simulate concurrent access
      const concurrentOperations = [
        // Multiple tool lookups
        ...Array.from({ length: 5 }, (_, i) =>
          () => registry.getTool(`file-tool-${i}`)
        ),
        // Multiple stats requests
        ...Array.from({ length: 5 }, () =>
          () => registry.getStats()
        ),
        // Multiple connection-based queries
        ...Array.from({ length: 5 }, () =>
          () => registry.getToolsByConnection(serverId)
        ),
        // State updates
        ...Array.from({ length: 3 }, () =>
          () => registry.updateConnectionState(serverId, 'connected')
        )
      ];

      // Execute all operations concurrently
      const results = await Promise.all(
        concurrentOperations.map(op => op())
      );

      // All operations should complete successfully
      expect(results).toHaveLength(concurrentOperations.length);

      // Registry should remain in consistent state
      const finalStats = registry.getStats();
      expect(finalStats.totalTools).toBe(10);
      expect(finalStats.activeConnections).toBe(1);
    });
  });

  // ==========================================================================
  // Auto-Refresh and State Management
  // ==========================================================================

  describe('Auto-Refresh and State Management', () => {
    test('should handle auto-refresh with dynamic tool changes', async () => {
      const autoRefreshRegistry = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 100, // Fast refresh for testing
        operationTimeoutMs: 5000
      });

      autoRefreshRegistry.setConnectionManager(mockConnectionManager);

      const serverId = 'auto-refresh-server';
      const connection = createMockConnection(serverId);
      const client = new AdvancedMockClient({
        tools: generateToolSuite(serverId, 3)
      });

      mockConnections.set(serverId, connection);
      mockClients.set(serverId, client);

      const refreshSpy = vi.fn();
      autoRefreshRegistry.on('registry:refreshed', refreshSpy);

      await autoRefreshRegistry.addConnection(connection);

      // Wait for auto-refresh cycles
      await new Promise(resolve => setTimeout(resolve, 250));

      // Should have performed auto-refreshes
      expect(refreshSpy).toHaveBeenCalled();

      autoRefreshRegistry.shutdown();
    });

    test('should maintain tool availability across connection state changes', async () => {
      const serverId = 'state-server';
      const connection = createMockConnection(serverId, 'connected');
      const client = new AdvancedMockClient({
        tools: generateToolSuite(serverId, 5)
      });

      mockConnections.set(serverId, connection);
      mockClients.set(serverId, client);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      // Initially all tools should be available
      const availableTools = registry.getAvailableTools();
      expect(availableTools).toHaveLength(5);

      // Simulate connection state changes
      const stateChanges: MCPConnectionState[] = [
        'disconnected',
        'reconnecting',
        'connected',
        'error',
        'connected'
      ];

      for (const newState of stateChanges) {
        registry.updateConnectionState(serverId, newState);

        const toolsAfterStateChange = registry.getAvailableTools();
        const isConnected = newState === 'connected';

        expect(toolsAfterStateChange).toHaveLength(isConnected ? 5 : 0);

        // Individual tool availability should match connection state
        for (let i = 0; i < 5; i++) {
          const toolName = `file-tool-${i}`;
          expect(registry.isToolAvailable(toolName)).toBe(isConnected);
        }
      }
    });

    test('should handle registry statistics accurately under various conditions', async () => {
      const serverConfigs = [
        { id: 'server1', state: 'connected' as MCPConnectionState, toolCount: 5 },
        { id: 'server2', state: 'disconnected' as MCPConnectionState, toolCount: 3 },
        { id: 'server3', state: 'connected' as MCPConnectionState, toolCount: 7 },
        { id: 'server4', state: 'error' as MCPConnectionState, toolCount: 2 }
      ];

      for (const config of serverConfigs) {
        const connection = createMockConnection(config.id, config.state);
        const client = new AdvancedMockClient({
          tools: generateToolSuite(config.id, config.toolCount)
        });

        mockConnections.set(config.id, connection);
        mockClients.set(config.id, client);

        await registry.addConnection(connection);
      }

      await registry.refreshAllTools();

      const stats = registry.getStats();

      // Only tools from connected servers should be available
      const expectedAvailableTools = serverConfigs
        .filter(c => c.state === 'connected')
        .reduce((sum, c) => sum + c.toolCount, 0);

      const expectedTotalTools = serverConfigs
        .reduce((sum, c) => sum + c.toolCount, 0);

      const expectedActiveConnections = serverConfigs
        .filter(c => c.state === 'connected')
        .length;

      expect(stats.availableTools).toBe(expectedAvailableTools);
      expect(stats.totalTools).toBe(expectedTotalTools);
      expect(stats.activeConnections).toBe(expectedActiveConnections);

      // Verify per-connection tool counts
      for (const config of serverConfigs) {
        expect(stats.toolsByConnection[config.id]).toBe(config.toolCount);
      }
    });
  });

  // ==========================================================================
  // Complex Integration Scenarios
  // ==========================================================================

  describe('Complex Integration Scenarios', () => {
    test('should handle server migration scenarios', async () => {
      // Initial server setup
      const oldServerId = 'old-server';
      const newServerId = 'new-server';

      const oldConnection = createMockConnection(oldServerId);
      const oldClient = new AdvancedMockClient({
        tools: generateToolSuite(oldServerId, 8)
      });

      mockConnections.set(oldServerId, oldConnection);
      mockClients.set(oldServerId, oldClient);

      await registry.addConnection(oldConnection);
      await registry.refreshAllTools();

      expect(registry.getAllTools()).toHaveLength(8);

      // Migrate to new server
      const newConnection = createMockConnection(newServerId);
      const newClient = new AdvancedMockClient({
        tools: generateToolSuite(newServerId, 8) // Same tools, different server
      });

      mockConnections.set(newServerId, newConnection);
      mockClients.set(newServerId, newClient);

      // Add new server
      await registry.addConnection(newConnection);
      await registry.refreshAllTools();

      expect(registry.getAllTools()).toHaveLength(16); // Tools from both servers

      // Remove old server
      await registry.removeConnection(oldServerId);

      expect(registry.getAllTools()).toHaveLength(8); // Only new server tools
      expect(registry.getToolsByConnection(oldServerId)).toHaveLength(0);
      expect(registry.getToolsByConnection(newServerId)).toHaveLength(8);
    });

    test('should handle tool name conflicts between servers', async () => {
      const server1Id = 'file-server';
      const server2Id = 'db-server';

      // Both servers have tools with the same names
      const conflictingTools = [
        {
          name: 'backup-tool',
          description: 'File backup tool',
          inputSchema: { type: 'object', properties: { path: { type: 'string' } } }
        },
        {
          name: 'restore-tool',
          description: 'File restore tool',
          inputSchema: { type: 'object', properties: { path: { type: 'string' } } }
        }
      ];

      const server1Connection = createMockConnection(server1Id);
      const server1Client = new AdvancedMockClient({ tools: [...conflictingTools] });

      const server2Connection = createMockConnection(server2Id);
      const server2Client = new AdvancedMockClient({
        tools: conflictingTools.map(tool => ({
          ...tool,
          description: tool.description.replace('File', 'Database')
        }))
      });

      mockConnections.set(server1Id, server1Connection);
      mockConnections.set(server2Id, server2Connection);
      mockClients.set(server1Id, server1Client);
      mockClients.set(server2Id, server2Client);

      // Add servers in sequence
      await registry.addConnection(server1Connection);
      await registry.refreshAllTools();

      let backupTool = registry.getTool('backup-tool');
      expect(backupTool?.mcpTool.description).toContain('File');

      await registry.addConnection(server2Connection);
      await registry.refreshAllTools();

      // Last server wins for conflicting tool names
      backupTool = registry.getTool('backup-tool');
      expect(backupTool?.mcpTool.description).toContain('Database');

      // But tools should be accessible by connection
      const server1Tools = registry.getToolsByConnection(server1Id);
      const server2Tools = registry.getToolsByConnection(server2Id);

      expect(server1Tools).toHaveLength(2);
      expect(server2Tools).toHaveLength(2);
    });

    test('should handle gradual tool discovery and removal', async () => {
      const serverId = 'gradual-server';
      const connection = createMockConnection(serverId);
      const client = new AdvancedMockClient({ tools: [] });

      mockConnections.set(serverId, connection);
      mockClients.set(serverId, client);

      await registry.addConnection(connection);

      const registrationEvents: string[] = [];
      const unregistrationEvents: string[] = [];

      registry.on('tool:registered', (event) => {
        registrationEvents.push(event.toolName);
      });

      registry.on('tool:unregistered', (event) => {
        unregistrationEvents.push(event.toolName);
      });

      // Gradually add tools
      const toolsToAdd = generateToolSuite(serverId, 10);
      for (const tool of toolsToAdd) {
        client.addTool(tool);
        await registry.refreshAllTools();

        expect(registry.hasTool(tool.name)).toBe(true);
      }

      expect(registrationEvents).toHaveLength(10);

      // Gradually remove tools
      for (const tool of toolsToAdd.slice(0, 5)) {
        client.removeTool(tool.name);
        await registry.refreshAllTools();

        expect(registry.hasTool(tool.name)).toBe(false);
      }

      expect(unregistrationEvents).toHaveLength(5);
      expect(registry.getAllTools()).toHaveLength(5);
    });
  });
});