/**
 * Connection Metrics and Edge Cases Tests for MCPConnectionManager
 *
 * This test suite covers:
 * - Connection metrics tracking and calculation
 * - Configuration edge cases and validation
 * - Transport type error handling
 * - Complex integration scenarios
 * - Resource cleanup and memory management
 * - Concurrent operation handling
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { ApexConfig, MCPServerConfig, MCPConnectionConfig } from '@apexcli/core';
import {
  MCPConnectionManager,
  type MCPConnectionManagerOptions,
  type ConnectionMetrics,
} from '../connection-manager.js';

// ============================================================================
// Mock Setup
// ============================================================================

class MockTransport extends EventEmitter {
  public isConnectedState = false;
  public connectionDelay = 0;
  public disconnectionDelay = 0;
  public shouldFailConnect = false;

  async connect(): Promise<void> {
    if (this.shouldFailConnect) {
      throw new Error('Mock transport connection failed');
    }

    if (this.connectionDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.connectionDelay));
    }

    this.isConnectedState = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    if (this.disconnectionDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.disconnectionDelay));
    }

    if (this.isConnectedState) {
      this.isConnectedState = false;
      this.emit('disconnected', 'Manual disconnect');
    }
  }

  simulateError(error: Error): void {
    this.emit('error', error);
  }

  simulateDisconnection(reason = 'Simulated disconnection'): void {
    if (this.isConnectedState) {
      this.isConnectedState = false;
      this.emit('disconnected', reason);
    }
  }

  setConnectionDelay(ms: number): void {
    this.connectionDelay = ms;
  }

  setDisconnectionDelay(ms: number): void {
    this.disconnectionDelay = ms;
  }

  setFailConnect(fail: boolean): void {
    this.shouldFailConnect = fail;
  }

  reset(): void {
    this.isConnectedState = false;
    this.connectionDelay = 0;
    this.disconnectionDelay = 0;
    this.shouldFailConnect = false;
    this.removeAllListeners();
  }
}

class MockClient extends EventEmitter {
  public transport: MockTransport;
  public requestCount = 0;
  public errorCount = 0;
  public shouldFailRequests = false;
  public requestLatency = 50;

  constructor(options: { transport: MockTransport }) {
    super();
    this.transport = options.transport;
  }

  async connect(): Promise<void> {
    // Connection handled by transport
  }

  async disconnect(): Promise<void> {
    // Disconnection handled by transport
  }

  async ping(): Promise<any> {
    return this.simulateRequest('ping');
  }

  async listTools(): Promise<any[]> {
    const result = await this.simulateRequest('listTools');
    return result ? [{ name: 'test-tool', description: 'A test tool' }] : [];
  }

  async callTool(name: string, args?: any): Promise<any> {
    const result = await this.simulateRequest('callTool');
    return result ? { result: `Called ${name}` } : null;
  }

  private async simulateRequest(requestType: string): Promise<any> {
    this.requestCount++;

    if (this.shouldFailRequests) {
      this.errorCount++;
      throw new Error(`Mock client ${requestType} failed`);
    }

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, this.requestLatency));
    return { success: true, type: requestType };
  }

  setFailRequests(fail: boolean): void {
    this.shouldFailRequests = fail;
  }

  setRequestLatency(ms: number): void {
    this.requestLatency = ms;
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  getErrorCount(): number {
    return this.errorCount;
  }

  reset(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.shouldFailRequests = false;
    this.requestLatency = 50;
    this.removeAllListeners();
  }
}

// Mock the imports
vi.mock('../transports/index.js', () => ({
  StdioTransport: vi.fn(),
}));

vi.mock('../client.js', () => ({
  MCPClient: vi.fn(),
}));

// ============================================================================
// Test Utilities
// ============================================================================

const createTestConfig = (
  servers: Record<string, MCPServerConfig> = {},
  connectionOverrides: Partial<MCPConnectionConfig> = {}
): ApexConfig => ({
  version: '1.0',
  project: {
    name: 'test-project',
    version: '1.0.0',
    description: 'Test project for metrics and edge cases',
  },
  mcp: {
    enabled: true,
    servers,
    connection: {
      maxRetries: 3,
      retryDelayMs: 1000,
      backoffFactor: 2,
      maxRetryDelayMs: 30000,
      connectionTimeoutMs: 10000,
      requestTimeoutMs: 30000,
      idleTimeoutMs: 300000,
      poolSize: 1,
      poolMinSize: 0,
      healthCheckIntervalMs: 0, // Disabled for most tests
      healthCheckTimeoutMs: 5000,
      healthCheckFailureThreshold: 3,
      autoReconnect: true,
      keepAlive: true,
      keepAliveIntervalMs: 15000,
      heartbeatEnabled: true,
      heartbeatIntervalMs: 30000,
      ...connectionOverrides,
    },
  },
});

const createManagerOptions = (
  config: ApexConfig,
  overrides: Partial<MCPConnectionManagerOptions> = {}
): MCPConnectionManagerOptions => ({
  projectPath: '/test/project',
  config,
  ...overrides,
});

// Sleep helper for timing tests
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// Test Suite
// ============================================================================

describe('MCPConnectionManager - Metrics and Edge Cases', () => {
  let manager: MCPConnectionManager;
  let mockTransport: MockTransport;
  let mockClient: MockClient;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create fresh mock instances for each test
    mockTransport = new MockTransport();
    mockClient = new MockClient({ transport: mockTransport });

    // Get references to mocked classes
    const { StdioTransport } = await import('../transports/index.js');
    const { MCPClient } = await import('../client.js');
    const MockedStdioTransport = vi.mocked(StdioTransport);
    const MockedMCPClient = vi.mocked(MCPClient);

    // Configure mocks to return our instances
    MockedStdioTransport.mockReturnValue(mockTransport as any);
    MockedMCPClient.mockReturnValue(mockClient as any);
  });

  afterEach(async () => {
    if (manager) {
      await manager.disconnectAll();
    }
    mockTransport?.reset();
    mockClient?.reset();
  });

  // ==========================================================================
  // Connection Metrics Tests
  // ==========================================================================

  describe('Connection Metrics Tracking', () => {
    it('should initialize metrics correctly', async () => {
      const config = createTestConfig({
        'metrics-server': {
          name: 'Metrics Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      // Should return undefined before connection
      expect(manager.getMetrics('metrics-server')).toBeUndefined();

      await manager.connect('metrics-server');

      const metrics = manager.getMetrics('metrics-server');

      expect(metrics).toBeDefined();
      expect(metrics!.totalConnections).toBe(1);
      expect(metrics!.totalReconnections).toBe(0);
      expect(metrics!.averageLatencyMs).toBe(0);
      expect(metrics!.connectedAt).toBeInstanceOf(Date);
      expect(metrics!.totalRequests).toBe(0);
      expect(metrics!.totalErrors).toBe(0);
      expect(metrics!.lastError).toBeUndefined();
      expect(typeof metrics!.uptimeMs).toBe('number');
    });

    it('should track connection uptime correctly', async () => {
      vi.useRealTimers(); // Need real timers for uptime calculation

      const config = createTestConfig({
        'uptime-server': {
          name: 'Uptime Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('uptime-server');

      const startTime = Date.now();
      await sleep(100); // Wait 100ms

      const metrics = manager.getMetrics('uptime-server');

      expect(metrics).toBeDefined();
      expect(metrics!.uptimeMs).toBeGreaterThan(90); // At least 90ms
      expect(metrics!.uptimeMs).toBeLessThan(200);   // Less than 200ms

      vi.useFakeTimers();
    });

    it('should track reconnection attempts', async () => {
      const config = createTestConfig({
        'reconnect-metrics-server': {
          name: 'Reconnect Metrics Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('reconnect-metrics-server');

      // Initial metrics
      let metrics = manager.getMetrics('reconnect-metrics-server');
      expect(metrics!.totalConnections).toBe(1);
      expect(metrics!.totalReconnections).toBe(0);

      // Simulate disconnection and reconnection
      mockTransport.simulateDisconnection('test disconnection');

      // Allow reconnection to succeed
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // Check updated metrics
      metrics = manager.getMetrics('reconnect-metrics-server');
      expect(metrics!.totalReconnections).toBeGreaterThan(0);
    });

    it('should track request and error counts through health checks', async () => {
      const config = createTestConfig({
        'request-tracking-server': {
          name: 'Request Tracking Server',
          type: 'stdio',
          command: 'node',
        },
      }, {
        healthCheckIntervalMs: 100, // Fast health checks
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('request-tracking-server');

      // Perform some health checks to generate requests
      await manager.checkHealth('request-tracking-server');
      await manager.checkHealth('request-tracking-server');

      // Make next health check fail
      mockClient.setFailRequests(true);
      await manager.checkHealth('request-tracking-server').catch(() => {}); // Ignore error

      const metrics = manager.getMetrics('request-tracking-server');

      expect(metrics!.totalRequests).toBeGreaterThan(0);
      expect(metrics!.totalErrors).toBeGreaterThan(0);
      expect(metrics!.lastError).toBeDefined();
      expect(metrics!.lastError!.message).toContain('failed');
      expect(metrics!.lastError!.timestamp).toBeInstanceOf(Date);
      expect(metrics!.lastError!.code).toBe('HEALTH_CHECK_FAILED');
    });

    it('should calculate average latency correctly', async () => {
      const config = createTestConfig({
        'latency-server': {
          name: 'Latency Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('latency-server');

      // Perform health checks with different latencies
      const latencies = [50, 100, 150];

      for (const latency of latencies) {
        mockClient.setRequestLatency(latency);
        await manager.checkHealth('latency-server');
      }

      const health = manager.getHealth('latency-server');
      const expectedAverage = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;

      expect(health).toBeDefined();
      expect(health!.averageLatencyMs).toBeCloseTo(expectedAverage, 0);
    });

    it('should handle metrics for non-existent connections', () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(config));

      expect(manager.getMetrics('non-existent')).toBeUndefined();
    });
  });

  // ==========================================================================
  // Configuration Edge Cases
  // ==========================================================================

  describe('Configuration Edge Cases', () => {
    it('should handle missing MCP configuration', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          version: '1.0.0',
          description: 'Test project',
        },
        // No MCP configuration
      };

      manager = new MCPConnectionManager(createManagerOptions(config));
      const servers = manager.discoverServers();

      expect(servers).toEqual([]);
    });

    it('should handle disabled MCP configuration', () => {
      const config = createTestConfig({
        'test-server': {
          name: 'Test Server',
          type: 'stdio',
          command: 'node',
        },
      });

      config.mcp!.enabled = false;

      manager = new MCPConnectionManager(createManagerOptions(config));
      const servers = manager.discoverServers();

      expect(servers).toEqual([]);
    });

    it('should apply default connection configuration values', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          version: '1.0.0',
          description: 'Test project',
        },
        mcp: {
          enabled: true,
          servers: {
            'test-server': {
              name: 'Test Server',
              type: 'stdio',
              command: 'node',
            },
          },
          // No connection configuration - should use defaults
        },
      };

      manager = new MCPConnectionManager(createManagerOptions(config));

      // Manager should be created successfully with defaults
      expect(manager).toBeDefined();
      expect(typeof manager.connect).toBe('function');
    });

    it('should override connection configuration', () => {
      const config = createTestConfig({
        'override-server': {
          name: 'Override Server',
          type: 'stdio',
          command: 'node',
        },
      });

      const customOptions = createManagerOptions(config, {
        connectionConfig: {
          maxRetries: 10,
          retryDelayMs: 500,
          poolSize: 5,
          healthCheckIntervalMs: 1000,
        },
      });

      manager = new MCPConnectionManager(customOptions);

      // Manager should be created with custom configuration
      expect(manager).toBeDefined();
    });

    it('should handle partial connection configuration overrides', () => {
      const config = createTestConfig({
        'partial-server': {
          name: 'Partial Server',
          type: 'stdio',
          command: 'node',
        },
      });

      // Only override some fields
      config.mcp!.connection = {
        maxRetries: 5,
        // Other fields should use defaults
      } as any;

      manager = new MCPConnectionManager(createManagerOptions(config));

      // Manager should work with partial configuration
      expect(manager).toBeDefined();
    });
  });

  // ==========================================================================
  // Transport Type Error Handling
  // ==========================================================================

  describe('Transport Type Error Handling', () => {
    it('should reject unsupported transport types', async () => {
      const config = createTestConfig({
        'websocket-server': {
          name: 'WebSocket Server',
          type: 'websocket' as any, // Unsupported type
          url: 'ws://localhost:8080',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      await expect(manager.connect('websocket-server')).rejects.toThrow(
        'Unknown transport type: websocket'
      );
    });

    it('should reject stdio transport without command', async () => {
      const config = createTestConfig({
        'invalid-stdio-server': {
          name: 'Invalid Stdio Server',
          type: 'stdio',
          // Missing command
        } as MCPServerConfig,
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      await expect(manager.connect('invalid-stdio-server')).rejects.toThrow(
        'Stdio transport requires a command'
      );
    });

    it('should reject HTTP transport (not yet implemented)', async () => {
      const config = createTestConfig({
        'http-server': {
          name: 'HTTP Server',
          type: 'http',
          url: 'http://localhost:3000/mcp',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      await expect(manager.connect('http-server')).rejects.toThrow(
        "Transport type 'http' is not yet implemented"
      );
    });

    it('should reject SSE transport (not yet implemented)', async () => {
      const config = createTestConfig({
        'sse-server': {
          name: 'SSE Server',
          type: 'sse',
          url: 'http://localhost:3000/sse',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      await expect(manager.connect('sse-server')).rejects.toThrow(
        "Transport type 'sse' is not yet implemented"
      );
    });

    it('should reject SDK transport type', async () => {
      const config = createTestConfig({
        'sdk-server': {
          name: 'SDK Server',
          type: 'sdk',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      await expect(manager.connect('sdk-server')).rejects.toThrow(
        'SDK type servers should not use MCPConnectionManager'
      );
    });
  });

  // ==========================================================================
  // Complex Integration Scenarios
  // ==========================================================================

  describe('Complex Integration Scenarios', () => {
    it('should handle rapid connect/disconnect cycles', async () => {
      const config = createTestConfig({
        'rapid-cycle-server': {
          name: 'Rapid Cycle Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      // Perform multiple rapid connect/disconnect cycles
      for (let i = 0; i < 5; i++) {
        await manager.connect('rapid-cycle-server');
        expect(manager.getConnection('rapid-cycle-server')).toBeDefined();

        await manager.disconnect('rapid-cycle-server');
        expect(manager.getConnection('rapid-cycle-server')).toBeUndefined();
      }

      // Final metrics should show multiple connections
      await manager.connect('rapid-cycle-server');
      const metrics = manager.getMetrics('rapid-cycle-server');
      expect(metrics!.totalConnections).toBe(6); // 5 cycles + final connect
    });

    it('should handle concurrent connections to multiple servers', async () => {
      const config = createTestConfig({
        'concurrent1': {
          name: 'Concurrent Server 1',
          type: 'stdio',
          command: 'node',
          args: ['server1.js'],
        },
        'concurrent2': {
          name: 'Concurrent Server 2',
          type: 'stdio',
          command: 'python',
          args: ['server2.py'],
        },
        'concurrent3': {
          name: 'Concurrent Server 3',
          type: 'stdio',
          command: 'java',
          args: ['Server3'],
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      // Connect to all servers concurrently
      const connectionPromises = [
        manager.connect('concurrent1'),
        manager.connect('concurrent2'),
        manager.connect('concurrent3'),
      ];

      const connections = await Promise.all(connectionPromises);

      // All connections should succeed
      expect(connections).toHaveLength(3);
      connections.forEach((conn, index) => {
        expect(conn.state).toBe('connected');
        expect(conn.serverId).toBe(`concurrent${index + 1}`);
      });

      // Should have all connections listed
      const allConnections = manager.listConnections();
      expect(allConnections).toHaveLength(3);

      // Each should have its own client
      expect(manager.getClient('concurrent1')).toBeDefined();
      expect(manager.getClient('concurrent2')).toBeDefined();
      expect(manager.getClient('concurrent3')).toBeDefined();
    });

    it('should handle connection during active disconnection', async () => {
      const config = createTestConfig({
        'disconnect-race-server': {
          name: 'Disconnect Race Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('disconnect-race-server');

      // Make disconnection slow
      mockTransport.setDisconnectionDelay(100);

      // Start disconnection
      const disconnectPromise = manager.disconnect('disconnect-race-server');

      // Try to connect again immediately (should wait for disconnect to complete)
      const connectPromise = manager.connect('disconnect-race-server');

      // Both should complete successfully
      await disconnectPromise;
      const connection = await connectPromise;

      expect(connection.state).toBe('connected');
    });

    it('should handle error recovery scenarios', async () => {
      const config = createTestConfig({
        'error-recovery-server': {
          name: 'Error Recovery Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      // Initial successful connection
      await manager.connect('error-recovery-server');
      expect(manager.getConnection('error-recovery-server')?.state).toBe('connected');

      // Simulate transport error
      const error = new Error('Simulated transport error');
      mockTransport.simulateError(error);

      // Connection should still exist but may have updated error state
      const connection = manager.getConnection('error-recovery-server');
      expect(connection).toBeDefined();

      // Metrics should track the error
      const metrics = manager.getMetrics('error-recovery-server');
      expect(metrics!.totalErrors).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Resource Cleanup and Memory Management
  // ==========================================================================

  describe('Resource Cleanup and Memory Management', () => {
    it('should clean up all resources on disconnectAll', async () => {
      const config = createTestConfig({
        'cleanup1': {
          name: 'Cleanup Server 1',
          type: 'stdio',
          command: 'node',
        },
        'cleanup2': {
          name: 'Cleanup Server 2',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      // Connect to multiple servers
      await manager.connect('cleanup1');
      await manager.connect('cleanup2');

      expect(manager.listConnections()).toHaveLength(2);

      // Clean up all
      await manager.disconnectAll();

      expect(manager.listConnections()).toHaveLength(0);
      expect(manager.getConnection('cleanup1')).toBeUndefined();
      expect(manager.getConnection('cleanup2')).toBeUndefined();
      expect(manager.getClient('cleanup1')).toBeUndefined();
      expect(manager.getClient('cleanup2')).toBeUndefined();
      expect(manager.getMetrics('cleanup1')).toBeUndefined();
      expect(manager.getMetrics('cleanup2')).toBeUndefined();
    });

    it('should handle disconnect cleanup errors gracefully', async () => {
      const config = createTestConfig({
        'error-disconnect-server': {
          name: 'Error Disconnect Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('error-disconnect-server');

      // Make client disconnect fail
      const originalDisconnect = mockClient.disconnect;
      mockClient.disconnect = vi.fn().mockRejectedValue(new Error('Disconnect failed'));

      // Should not throw despite client disconnect failure
      await expect(manager.disconnect('error-disconnect-server')).resolves.not.toThrow();

      // Connection should still be removed from manager
      expect(manager.getConnection('error-disconnect-server')).toBeUndefined();

      // Restore original method
      mockClient.disconnect = originalDisconnect;
    });

    it('should prevent memory leaks with repeated connections', async () => {
      const config = createTestConfig({
        'memory-test-server': {
          name: 'Memory Test Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      // Create and destroy many connections
      for (let i = 0; i < 10; i++) {
        await manager.connect('memory-test-server');
        await manager.disconnect('memory-test-server');
      }

      // Should not have any lingering connections
      expect(manager.listConnections()).toHaveLength(0);
      expect(manager.getConnection('memory-test-server')).toBeUndefined();
    });

    it('should clean up health monitoring resources', async () => {
      const config = createTestConfig({
        'health-cleanup-server': {
          name: 'Health Cleanup Server',
          type: 'stdio',
          command: 'node',
        },
      }, {
        healthCheckIntervalMs: 100,
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('health-cleanup-server');

      // Verify health monitoring is active
      const health = manager.getHealth('health-cleanup-server');
      expect(health).toBeDefined();

      // Disconnect should clean up health monitoring
      await manager.disconnect('health-cleanup-server');

      // Health state should be gone
      expect(manager.getHealth('health-cleanup-server')).toBeUndefined();
    });
  });

  // ==========================================================================
  // Concurrent Operation Handling
  // ==========================================================================

  describe('Concurrent Operation Handling', () => {
    it('should handle concurrent health checks', async () => {
      const config = createTestConfig({
        'concurrent-health-server': {
          name: 'Concurrent Health Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('concurrent-health-server');

      // Perform multiple concurrent health checks
      const healthPromises = Array.from({ length: 5 }, () =>
        manager.checkHealth('concurrent-health-server')
      );

      const results = await Promise.all(healthPromises);

      // All health checks should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.isHealthy).toBe(true);
      });

      // Client should have been called multiple times
      expect(mockClient.getRequestCount()).toBe(5);
    });

    it('should handle concurrent connect attempts to same server', async () => {
      const config = createTestConfig({
        'concurrent-connect-server': {
          name: 'Concurrent Connect Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      // Make connection slow
      mockTransport.setConnectionDelay(100);

      // Start multiple concurrent connection attempts
      const connectPromises = Array.from({ length: 3 }, () =>
        manager.connect('concurrent-connect-server').catch(error => error)
      );

      const results = await Promise.all(connectPromises);

      // One should succeed, others should get "already in progress" error
      const successes = results.filter(r => r && r.state === 'connected');
      const errors = results.filter(r => r instanceof Error);

      expect(successes).toHaveLength(1);
      expect(errors.length).toBeGreaterThan(0);
      errors.forEach(error => {
        expect(error.message).toContain('already in progress');
      });
    });

    it('should maintain connection stability under concurrent operations', async () => {
      const config = createTestConfig({
        'stability-server': {
          name: 'Stability Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('stability-server');

      // Perform various concurrent operations
      const operations = [
        manager.checkHealth('stability-server'),
        manager.checkHealth('stability-server'),
        manager.getMetrics('stability-server'),
        manager.getHealth('stability-server'),
        manager.getClient('stability-server'),
      ];

      const results = await Promise.allSettled(operations);

      // All operations should complete successfully
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          throw new Error(`Operation ${index} failed: ${result.reason}`);
        }
      });

      // Connection should still be stable
      const connection = manager.getConnection('stability-server');
      expect(connection?.state).toBe('connected');
    });
  });
});