/**
 * Enhanced Comprehensive MCPConnectionManager Tests
 *
 * This test suite provides comprehensive test coverage for MCPConnectionManager
 * including edge cases, error conditions, and advanced scenarios.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { ApexConfig, MCPServerConfig } from '@apexcli/core';
import {
  MCPConnectionManager,
  type MCPConnectionManagerOptions,
  type MCPToolExecutionError,
} from '../mcp/connection-manager.js';

// ============================================================================
// Enhanced Mock Setup
// ============================================================================

// Mock transport with advanced simulation capabilities
class AdvancedMockTransport extends EventEmitter {
  private connected = false;
  private latency: number;
  private errorRate: number;
  private disconnectAfter: number;
  private requestCount = 0;

  constructor(private config: {
    latency?: number;
    errorRate?: number;
    disconnectAfter?: number;
    simulateConnectionFailure?: boolean;
  } = {}) {
    super();
    this.latency = config.latency || 0;
    this.errorRate = config.errorRate || 0;
    this.disconnectAfter = config.disconnectAfter || Infinity;
  }

  async connect(): Promise<void> {
    if (this.config.simulateConnectionFailure) {
      throw new Error('Simulated connection failure');
    }

    await this.delay(this.latency);
    this.connected = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit('disconnected', 'Manual disconnect');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async send(message: any): Promise<any> {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }

    this.requestCount++;

    // Simulate random errors
    if (Math.random() < this.errorRate) {
      throw new Error('Random transport error');
    }

    // Simulate disconnect after certain requests
    if (this.requestCount >= this.disconnectAfter) {
      this.connected = false;
      this.emit('disconnected', 'Connection lost');
      throw new Error('Connection lost during request');
    }

    await this.delay(this.latency);
    return { id: message.id, result: 'success' };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  simulateDisconnect(): void {
    if (this.connected) {
      this.connected = false;
      this.emit('disconnected', 'Network error');
    }
  }

  simulateError(): void {
    this.emit('error', new Error('Transport error'));
  }
}

// Mock client with advanced behavior
function createAdvancedMockClient(transport: AdvancedMockTransport) {
  return {
    connect: vi.fn().mockImplementation(() => transport.connect()),
    disconnect: vi.fn().mockImplementation(() => transport.disconnect()),
    listTools: vi.fn().mockImplementation(async () => {
      await transport.send({ method: 'tools/list' });
      return [
        {
          name: 'test-tool',
          description: 'A test tool',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string' }
            },
            required: ['input']
          }
        }
      ];
    }),
    callTool: vi.fn().mockImplementation(async (name: string, args: any) => {
      await transport.send({ method: 'tools/call', params: { name, arguments: args } });

      // Simulate different tool behaviors
      if (name === 'slow-tool') {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      if (name === 'error-tool') {
        throw new Error('Tool execution failed');
      }
      if (name === 'timeout-tool') {
        await new Promise(resolve => setTimeout(resolve, 10000));
      }

      return { result: `Success: ${name}`, args };
    }),
    ping: vi.fn().mockImplementation(async () => {
      await transport.send({ method: 'ping' });
      return { result: 'pong' };
    }),
    transport,
    on: vi.fn(),
    off: vi.fn(),
  };
}

// Mock modules
vi.mock('../mcp/transports/index.js', () => ({
  StdioTransport: vi.fn()
}));

vi.mock('../mcp/client.js', () => ({
  MCPClient: vi.fn()
}));

vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    ExponentialBackoffReconnector: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      scheduleReconnect: vi.fn(),
      notifyConnected: vi.fn(),
      notifyDisconnected: vi.fn(),
      notifyConnectionFailed: vi.fn(),
      isExhausted: vi.fn().mockReturnValue(false),
      destroy: vi.fn()
    })),
    ConnectionHealthManager: vi.fn().mockImplementation(() => ({
      register: vi.fn(),
      unregister: vi.fn(),
      performHealthCheck: vi.fn().mockResolvedValue({
        success: true,
        latencyMs: 50,
        consecutiveFailures: 0,
        isHealthy: true,
        startedAt: new Date()
      }),
      getHealthState: vi.fn(),
      getHealthStats: vi.fn(),
      notifyPingSent: vi.fn(),
      notifyPongReceived: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn()
    })),
    getMCPServers: vi.fn().mockImplementation((config: ApexConfig) => config.mcp?.servers || {})
  };
});

// ============================================================================
// Test Configuration
// ============================================================================

function createTestConfig(servers: Record<string, MCPServerConfig> = {}): ApexConfig {
  return {
    project: { name: 'test-project', version: '1.0.0' },
    limits: {
      maxConcurrentTasks: 10,
      maxDailyTasks: 100,
      maxTokensPerTask: 100000,
      maxTurns: 10
    },
    mcp: {
      enabled: true,
      servers,
      connection: {
        maxRetries: 3,
        retryDelayMs: 100,
        connectionTimeoutMs: 5000,
        autoReconnect: true,
        healthCheckIntervalMs: 30000
      }
    },
    autonomy: { level: 'manual' as const },
    agents: {},
    workflows: {}
  };
}

function createManagerOptions(
  config: ApexConfig,
  overrides: Partial<MCPConnectionManagerOptions> = {}
): MCPConnectionManagerOptions {
  return {
    projectPath: '/test/project',
    config,
    ...overrides
  };
}

// ============================================================================
// Enhanced Test Suite
// ============================================================================

describe('Enhanced MCPConnectionManager Tests', () => {
  let manager: MCPConnectionManager;
  let mockTransports: Map<string, AdvancedMockTransport>;
  let mockClients: Map<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransports = new Map();
    mockClients = new Map();

    // Setup transport factory
    const { StdioTransport } = require('../mcp/transports/index.js');
    StdioTransport.mockImplementation((options: any) => {
      const transport = new AdvancedMockTransport();
      mockTransports.set('default', transport);
      return transport;
    });

    // Setup client factory
    const { MCPClient } = require('../mcp/client.js');
    MCPClient.mockImplementation(({ transport }: any) => {
      const client = createAdvancedMockClient(transport);
      mockClients.set('default', client);
      return client;
    });
  });

  afterEach(async () => {
    if (manager) {
      await manager.disconnectAll();
    }
    mockTransports.clear();
    mockClients.clear();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Advanced Connection Scenarios
  // ==========================================================================

  describe('Advanced Connection Scenarios', () => {
    test('should handle high-latency connections', async () => {
      const { StdioTransport } = require('../mcp/transports/index.js');
      StdioTransport.mockImplementation(() => {
        const transport = new AdvancedMockTransport({ latency: 100 });
        mockTransports.set('high-latency', transport);
        return transport;
      });

      const config = createTestConfig({
        'slow-server': {
          name: 'Slow Server',
          type: 'stdio',
          command: 'slow-server'
        }
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      const startTime = Date.now();
      const connection = await manager.connect('slow-server');
      const endTime = Date.now();

      expect(connection.state).toBe('connected');
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    test('should handle unreliable connections with random errors', async () => {
      const { StdioTransport } = require('../mcp/transports/index.js');
      StdioTransport.mockImplementation(() => {
        const transport = new AdvancedMockTransport({ errorRate: 0.3 });
        mockTransports.set('unreliable', transport);
        return transport;
      });

      const config = createTestConfig({
        'unreliable-server': {
          name: 'Unreliable Server',
          type: 'stdio',
          command: 'unreliable-server'
        }
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      const connection = await manager.connect('unreliable-server');

      expect(connection.state).toBe('connected');

      // Test multiple tool calls to trigger random errors
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < 10; i++) {
        try {
          await manager.executeTool('unreliable-server', 'test-tool', { input: `test-${i}` });
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }

      // Should have some successes and some failures due to random errors
      expect(successCount).toBeGreaterThan(0);
      expect(errorCount).toBeGreaterThan(0);
    });

    test('should handle connections that disconnect after certain operations', async () => {
      const { StdioTransport } = require('../mcp/transports/index.js');
      StdioTransport.mockImplementation(() => {
        const transport = new AdvancedMockTransport({ disconnectAfter: 3 });
        mockTransports.set('disconnect-after', transport);
        return transport;
      });

      const config = createTestConfig({
        'disconnect-server': {
          name: 'Disconnect Server',
          type: 'stdio',
          command: 'disconnect-server'
        }
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      const disconnectedSpy = vi.fn();
      manager.on('disconnected', disconnectedSpy);

      await manager.connect('disconnect-server');

      // Execute tools until connection is lost
      let toolCallCount = 0;
      let connectionLost = false;

      while (toolCallCount < 5 && !connectionLost) {
        try {
          await manager.executeTool('disconnect-server', 'test-tool', { input: `test-${toolCallCount}` });
          toolCallCount++;
        } catch (error) {
          connectionLost = true;
        }
      }

      expect(connectionLost).toBe(true);
      expect(disconnectedSpy).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Error Handling and Recovery
  // ==========================================================================

  describe('Error Handling and Recovery', () => {
    test('should categorize different types of errors correctly', async () => {
      const config = createTestConfig({
        'test-server': {
          name: 'Test Server',
          type: 'stdio',
          command: 'test-server'
        }
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('test-server');

      const errorSpy = vi.fn();
      manager.on('tool:error', errorSpy);

      // Test different error types
      const errorTests = [
        { tool: 'error-tool', expectedCode: 'EXECUTION_ERROR' },
        { tool: 'timeout-tool', expectedCode: 'TIMEOUT' },
      ];

      for (const { tool, expectedCode } of errorTests) {
        try {
          await manager.executeTool('test-server', tool, {});
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          if (error.name === 'MCPToolExecutionError') {
            expect((error as any).code).toBe(expectedCode);
          }
        }
      }

      expect(errorSpy).toHaveBeenCalled();
    });

    test('should handle concurrent tool executions', async () => {
      const config = createTestConfig({
        'test-server': {
          name: 'Test Server',
          type: 'stdio',
          command: 'test-server'
        }
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('test-server');

      const startSpy = vi.fn();
      const completeSpy = vi.fn();

      manager.on('tool:start', startSpy);
      manager.on('tool:complete', completeSpy);

      // Execute multiple tools concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        manager.executeTool('test-server', 'test-tool', { input: `concurrent-${i}` })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(startSpy).toHaveBeenCalledTimes(5);
      expect(completeSpy).toHaveBeenCalledTimes(5);

      // Each result should be unique
      const inputs = results.map(r => r.args.input);
      expect(new Set(inputs).size).toBe(5);
    });

    test('should handle tool execution timeouts', async () => {
      const config = createTestConfig({
        'test-server': {
          name: 'Test Server',
          type: 'stdio',
          command: 'test-server'
        }
      });

      manager = new MCPConnectionManager(createManagerOptions(config, {
        connectionConfig: {
          requestTimeoutMs: 100 // Very short timeout
        }
      }));

      await manager.connect('test-server');

      const errorSpy = vi.fn();
      manager.on('tool:error', errorSpy);

      await expect(manager.executeTool('test-server', 'slow-tool', {}))
        .rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 'test-server',
          toolName: 'slow-tool',
          retriable: true
        })
      );
    });
  });

  // ==========================================================================
  // Health Monitoring and Metrics
  // ==========================================================================

  describe('Health Monitoring and Metrics', () => {
    test('should track comprehensive connection metrics', async () => {
      const config = createTestConfig({
        'metrics-server': {
          name: 'Metrics Server',
          type: 'stdio',
          command: 'metrics-server'
        }
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('metrics-server');

      // Execute several tools to generate metrics
      const toolCalls = 5;
      for (let i = 0; i < toolCalls; i++) {
        await manager.executeTool('metrics-server', 'test-tool', { input: `test-${i}` });
      }

      const metrics = manager.getMetrics('metrics-server');

      expect(metrics).toBeDefined();
      expect(metrics!.totalConnections).toBe(1);
      expect(metrics!.totalRequests).toBe(toolCalls);
      expect(metrics!.totalErrors).toBe(0);
      expect(metrics!.connectedAt).toBeInstanceOf(Date);
      expect(metrics!.uptimeMs).toBeGreaterThan(0);
    });

    test('should perform health checks with proper latency tracking', async () => {
      const config = createTestConfig({
        'health-server': {
          name: 'Health Server',
          type: 'stdio',
          command: 'health-server'
        }
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('health-server');

      const healthCheckSpy = vi.fn();
      manager.on('healthCheck', healthCheckSpy);

      const startTime = Date.now();
      const result = await manager.checkHealth('health-server');
      const endTime = Date.now();

      expect(result).toMatchObject({
        success: true,
        isHealthy: true,
        consecutiveFailures: 0
      });

      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.latencyMs).toBeLessThan(endTime - startTime + 100); // Allow some margin

      expect(healthCheckSpy).toHaveBeenCalledWith('health-server', result);
    });

    test('should handle health check failures and recovery', async () => {
      const { StdioTransport } = require('../mcp/transports/index.js');
      StdioTransport.mockImplementation(() => {
        // Transport that fails after a few requests
        const transport = new AdvancedMockTransport({ disconnectAfter: 2 });
        mockTransports.set('failing-health', transport);
        return transport;
      });

      const config = createTestConfig({
        'failing-server': {
          name: 'Failing Server',
          type: 'stdio',
          command: 'failing-server'
        }
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('failing-server');

      // First health check should succeed
      let result = await manager.checkHealth('failing-server');
      expect(result.success).toBe(true);

      // Trigger disconnection
      const transport = mockTransports.get('failing-health')!;
      transport.simulateDisconnect();

      // Health check should now fail
      result = await manager.checkHealth('failing-server');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ==========================================================================
  // Configuration and Update Scenarios
  // ==========================================================================

  describe('Configuration Updates', () => {
    test('should handle dynamic configuration updates', async () => {
      const initialConfig = createTestConfig({
        'initial-server': {
          name: 'Initial Server',
          type: 'stdio',
          command: 'initial-server'
        }
      });

      manager = new MCPConnectionManager(createManagerOptions(initialConfig));
      await manager.connect('initial-server');

      expect(manager.listConnections()).toHaveLength(1);
      expect(manager.getConnection('initial-server')).toBeDefined();

      // Update configuration
      const updatedConfig = createTestConfig({
        'initial-server': {
          name: 'Initial Server Updated',
          type: 'stdio',
          command: 'initial-server'
        },
        'new-server': {
          name: 'New Server',
          type: 'stdio',
          command: 'new-server'
        }
      });

      manager.updateConfig(updatedConfig);

      // Should now discover the new server
      const discoveredServers = manager.discoverServers();
      expect(discoveredServers).toHaveLength(2);
      expect(discoveredServers.map(s => s.name)).toContain('Initial Server Updated');
      expect(discoveredServers.map(s => s.name)).toContain('New Server');
    });

    test('should validate configuration edge cases', () => {
      // Test with minimal configuration
      const minimalConfig = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(minimalConfig));

      expect(manager.discoverServers()).toHaveLength(0);

      // Test with invalid server configurations
      const invalidConfig = createTestConfig({
        'stdio-no-command': {
          type: 'stdio'
          // Missing required command
        } as MCPServerConfig,
        'http-no-url': {
          type: 'http'
          // Missing required URL
        } as MCPServerConfig,
        'valid-server': {
          name: 'Valid Server',
          type: 'stdio',
          command: 'valid-command'
        }
      });

      manager.updateConfig(invalidConfig);
      const servers = manager.discoverServers();

      // Should only include the valid server
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('Valid Server');
    });
  });

  // ==========================================================================
  // Edge Cases and Boundary Conditions
  // ==========================================================================

  describe('Edge Cases', () => {
    test('should handle rapid connect/disconnect cycles', async () => {
      const config = createTestConfig({
        'cycle-server': {
          name: 'Cycle Server',
          type: 'stdio',
          command: 'cycle-server'
        }
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      const connectedSpy = vi.fn();
      const disconnectedSpy = vi.fn();

      manager.on('connected', connectedSpy);
      manager.on('disconnected', disconnectedSpy);

      // Rapid connect/disconnect cycles
      for (let i = 0; i < 3; i++) {
        await manager.connect('cycle-server');
        expect(manager.getConnection('cycle-server')?.state).toBe('connected');

        await manager.disconnect('cycle-server');
        expect(manager.getConnection('cycle-server')).toBeUndefined();
      }

      expect(connectedSpy).toHaveBeenCalledTimes(3);
      expect(disconnectedSpy).toHaveBeenCalledTimes(3);
    });

    test('should handle multiple simultaneous connections', async () => {
      const config = createTestConfig({
        'server1': { name: 'Server 1', type: 'stdio', command: 'server1' },
        'server2': { name: 'Server 2', type: 'stdio', command: 'server2' },
        'server3': { name: 'Server 3', type: 'stdio', command: 'server3' },
        'server4': { name: 'Server 4', type: 'stdio', command: 'server4' },
        'server5': { name: 'Server 5', type: 'stdio', command: 'server5' }
      });

      // Setup individual transports for each server
      const { StdioTransport } = require('../mcp/transports/index.js');
      let transportCounter = 0;
      StdioTransport.mockImplementation((options: any) => {
        const serverId = options.command;
        const transport = new AdvancedMockTransport();
        mockTransports.set(serverId, transport);
        return transport;
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      // Connect to all servers simultaneously
      const connectionPromises = ['server1', 'server2', 'server3', 'server4', 'server5']
        .map(serverId => manager.connect(serverId));

      const connections = await Promise.all(connectionPromises);

      expect(connections).toHaveLength(5);
      expect(manager.listConnections()).toHaveLength(5);

      // All connections should be active
      connections.forEach(conn => {
        expect(conn.state).toBe('connected');
      });

      // Execute tools on all connections simultaneously
      const toolPromises = connections.map(conn =>
        manager.executeTool(conn.serverId, 'test-tool', { input: `test-${conn.serverId}` })
      );

      const results = await Promise.all(toolPromises);
      expect(results).toHaveLength(5);
    });

    test('should handle empty or malformed server configurations', () => {
      const edgeCaseConfigs = [
        // Empty servers object
        createTestConfig({}),

        // Servers with missing required fields
        createTestConfig({
          'incomplete': {
            name: 'Incomplete Server'
            // Missing type and command
          } as MCPServerConfig
        }),

        // Servers with unknown types
        createTestConfig({
          'unknown-type': {
            name: 'Unknown Type',
            type: 'unknown' as any,
            command: 'test'
          }
        })
      ];

      edgeCaseConfigs.forEach((config, index) => {
        manager = new MCPConnectionManager(createManagerOptions(config));
        const servers = manager.discoverServers();

        // Should handle gracefully without throwing
        expect(Array.isArray(servers)).toBe(true);
        expect(servers.length).toBe(0);
      });
    });

    test('should handle extremely long server names and descriptions', async () => {
      const longName = 'A'.repeat(1000);
      const longDescription = 'B'.repeat(2000);

      const config = createTestConfig({
        'long-server': {
          name: longName,
          description: longDescription,
          type: 'stdio',
          command: 'long-server'
        }
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      // Should handle long strings without issues
      const connection = await manager.connect('long-server');

      expect(connection.serverName).toBe(longName);
      expect(connection.config.description).toBe(longDescription);
    });
  });
});