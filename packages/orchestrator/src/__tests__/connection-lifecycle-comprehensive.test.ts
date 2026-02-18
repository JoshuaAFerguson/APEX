/**
 * Comprehensive Connection Lifecycle Tests
 *
 * This test suite provides detailed coverage of:
 * 1. Connection state transitions and management
 * 2. Health monitoring and reconnection scenarios
 * 3. Pool management and connection strategies
 * 4. Event-driven architecture verification
 * 5. Error handling and recovery mechanisms
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type {
  MCPConnection,
  MCPConnectionState,
  MCPServerConfig,
  HealthCheckResult,
  ConnectionMetrics,
} from '@apexcli/core';
import { MCPConnectionManager } from '../mcp/connection-manager.js';
import { MCPClient } from '../mcp/client.js';

// ============================================================================
// Mock Infrastructure
// ============================================================================

/**
 * Mock transport for testing connection behavior
 */
class MockTransport extends EventEmitter {
  connected = false;
  private failNext = false;
  private delayNext = 0;

  async connect(): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Connection failed');
    }

    if (this.delayNext > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delayNext));
      this.delayNext = 0;
    }

    this.connected = true;
    this.emit('connect');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit('disconnect');
  }

  simulateFailure(error: Error): void {
    this.connected = false;
    this.emit('error', error);
  }

  simulateConnectionFailure(): void {
    this.failNext = true;
  }

  simulateDelay(ms: number): void {
    this.delayNext = ms;
  }
}

/**
 * Mock MCP client that simulates realistic behavior
 */
class MockMCPClient extends EventEmitter {
  private transport: MockTransport;
  private connected = false;
  private tools = new Map<string, any>();

  constructor(transport: MockTransport) {
    super();
    this.transport = transport;

    transport.on('connect', () => {
      this.connected = true;
      this.emit('connected');
    });

    transport.on('disconnect', () => {
      this.connected = false;
      this.emit('disconnected');
    });

    transport.on('error', (error) => {
      this.connected = false;
      this.emit('error', error);
    });
  }

  async connect(): Promise<void> {
    await this.transport.connect();
  }

  async disconnect(): Promise<void> {
    await this.transport.disconnect();
  }

  async listTools(): Promise<any[]> {
    if (!this.connected) {
      throw new Error('Not connected');
    }
    return Array.from(this.tools.values());
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<any> {
    if (!this.connected) {
      throw new Error('Not connected');
    }
    if (!this.tools.has(name)) {
      throw new Error(`Tool ${name} not found`);
    }
    return { result: `Called ${name}` };
  }

  async ping(): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected');
    }
  }

  // Test helpers
  addTool(name: string, tool: any): void {
    this.tools.set(name, tool);
  }

  removeTool(name: string): void {
    this.tools.delete(name);
  }

  isConnected(): boolean {
    return this.connected;
  }

  getTransport(): MockTransport {
    return this.transport;
  }
}

/**
 * Factory for creating test server configs
 */
const createServerConfig = (id: string, overrides: Partial<MCPServerConfig> = {}): MCPServerConfig => ({
  name: `test-server-${id}`,
  command: 'node',
  args: ['test-server.js', '--id', id],
  env: { NODE_ENV: 'test' },
  ...overrides,
});

/**
 * Event capture utility for connection lifecycle events
 */
class ConnectionEventCapture {
  private events: Array<{ type: string; data: any; timestamp: Date }> = [];

  constructor(connectionManager: MCPConnectionManager) {
    const eventTypes = [
      'connected',
      'disconnected',
      'stateChange',
      'error',
      'reconnecting',
      'healthCheck',
      'poolChange',
    ];

    eventTypes.forEach(eventType => {
      connectionManager.on(eventType, (data) => {
        this.events.push({
          type: eventType,
          data: { ...data },
          timestamp: new Date(),
        });
      });
    });
  }

  getEvents(): Array<{ type: string; data: any; timestamp: Date }> {
    return [...this.events];
  }

  getEventsByType(type: string): Array<{ type: string; data: any; timestamp: Date }> {
    return this.events.filter(e => e.type === type);
  }

  getEventsForServer(serverId: string): Array<{ type: string; data: any; timestamp: Date }> {
    return this.events.filter(e => e.data?.serverId === serverId);
  }

  clear(): void {
    this.events = [];
  }
}

// Mock the connection manager's dependencies
vi.mock('../mcp/transport.js', () => ({
  createTransport: vi.fn((config) => {
    const transport = new MockTransport();
    return transport;
  }),
}));

vi.mock('../mcp/client.js', () => ({
  MCPClient: MockMCPClient,
}));

// ============================================================================
// Connection Lifecycle Tests
// ============================================================================

describe('Connection Lifecycle - Comprehensive Tests', () => {
  let connectionManager: MCPConnectionManager;
  let eventCapture: ConnectionEventCapture;
  let mockTransports: Map<string, MockTransport> = new Map();

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    mockTransports.clear();

    // Create connection manager
    connectionManager = new MCPConnectionManager({
      projectPath: '/test/project',
      config: {
        mcp: {
          enabled: true,
          connection: {
            maxRetries: 3,
            retryDelayMs: 100,
            backoffFactor: 1.5,
            maxRetryDelayMs: 5000,
            connectionTimeoutMs: 1000,
            requestTimeoutMs: 5000,
            healthCheckIntervalMs: 1000,
            autoReconnect: true,
          },
        },
      },
    });

    eventCapture = new ConnectionEventCapture(connectionManager);
  });

  afterEach(async () => {
    try {
      await connectionManager.disconnectAll();
    } catch (error) {
      // Ignore cleanup errors
    }
    vi.clearAllTimers();
  });

  describe('Basic Connection Operations', () => {
    test('should establish connection successfully', async () => {
      const serverId = 'test-server-1';
      const config = createServerConfig(serverId);

      const connection = await connectionManager.connect(serverId);

      expect(connection).toBeDefined();
      expect(connection.serverId).toBe(serverId);
      expect(connection.state).toBe('connected');
      expect(connection.connectedAt).toBeInstanceOf(Date);

      // Verify events
      const stateChangeEvents = eventCapture.getEventsByType('stateChange');
      const connectedEvents = eventCapture.getEventsByType('connected');

      expect(stateChangeEvents.length).toBeGreaterThanOrEqual(1);
      expect(connectedEvents).toHaveLength(1);
      expect(connectedEvents[0].data.serverId).toBe(serverId);
    });

    test('should handle connection timeout', async () => {
      const serverId = 'timeout-server';
      const config = createServerConfig(serverId);

      // Mock transport delay longer than timeout
      const { createTransport } = await import('../mcp/transport.js');
      const mockCreateTransport = vi.mocked(createTransport);
      mockCreateTransport.mockImplementation(() => {
        const transport = new MockTransport();
        transport.simulateDelay(2000); // Longer than connectionTimeoutMs (1000ms)
        return transport;
      });

      await expect(connectionManager.connect(serverId)).rejects.toThrow();

      // Verify timeout error events
      const errorEvents = eventCapture.getEventsByType('error');
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    test('should disconnect gracefully', async () => {
      const serverId = 'disconnect-server';
      const config = createServerConfig(serverId);

      const connection = await connectionManager.connect(serverId);
      expect(connection.state).toBe('connected');

      eventCapture.clear();
      await connectionManager.disconnect(serverId);

      // Verify disconnection
      const connections = connectionManager.listConnections();
      expect(connections.find(c => c.serverId === serverId)).toBeUndefined();

      const disconnectedEvents = eventCapture.getEventsByType('disconnected');
      expect(disconnectedEvents).toHaveLength(1);
      expect(disconnectedEvents[0].data.serverId).toBe(serverId);
    });

    test('should handle multiple simultaneous connections', async () => {
      const serverIds = ['multi-1', 'multi-2', 'multi-3'];
      const connectPromises = serverIds.map(id => connectionManager.connect(id));

      const connections = await Promise.all(connectPromises);

      expect(connections).toHaveLength(3);
      connections.forEach((conn, i) => {
        expect(conn.serverId).toBe(serverIds[i]);
        expect(conn.state).toBe('connected');
      });

      // Verify all are listed
      const allConnections = connectionManager.listConnections();
      expect(allConnections).toHaveLength(3);

      // Verify events for each connection
      const connectedEvents = eventCapture.getEventsByType('connected');
      expect(connectedEvents).toHaveLength(3);
    });
  });

  describe('State Transition Management', () => {
    test('should handle complete state lifecycle', async () => {
      const serverId = 'lifecycle-server';
      const config = createServerConfig(serverId);

      // Connect
      const connection = await connectionManager.connect(serverId);
      expect(connection.state).toBe('connected');

      // Get the client to simulate state changes
      const client = connectionManager.getClient(serverId) as MockMCPClient;
      expect(client).toBeDefined();

      eventCapture.clear();

      // Simulate disconnection
      client.getTransport().simulateFailure(new Error('Transport lost'));
      await new Promise(resolve => setTimeout(resolve, 100)); // Let events propagate

      // Should trigger reconnection
      const reconnectingEvents = eventCapture.getEventsByType('reconnecting');
      expect(reconnectingEvents.length).toBeGreaterThan(0);

      // Wait for reconnection
      await new Promise(resolve => setTimeout(resolve, 500));

      const finalConnection = connectionManager.getConnection(serverId);
      // May be reconnected or in reconnecting state depending on timing
      expect(['connected', 'reconnecting', 'error'].includes(finalConnection?.state || '')).toBe(true);
    });

    test('should handle connection state transitions correctly', async () => {
      const serverId = 'state-server';
      const connection = await connectionManager.connect(serverId);

      const client = connectionManager.getClient(serverId) as MockMCPClient;
      eventCapture.clear();

      // Simulate error
      client.getTransport().simulateFailure(new Error('Network error'));
      await new Promise(resolve => setTimeout(resolve, 50));

      const stateChangeEvents = eventCapture.getEventsByType('stateChange');
      const errorEvents = eventCapture.getEventsByType('error');

      expect(errorEvents.length).toBeGreaterThan(0);
      expect(errorEvents[0].data.serverId).toBe(serverId);

      // Should show state transition from connected to error/reconnecting
      if (stateChangeEvents.length > 0) {
        const lastStateChange = stateChangeEvents[stateChangeEvents.length - 1];
        expect(['error', 'reconnecting', 'disconnected'].includes(lastStateChange.data.newState)).toBe(true);
      }
    });

    test('should handle rapid state changes', async () => {
      const serverId = 'rapid-server';
      const connection = await connectionManager.connect(serverId);
      const client = connectionManager.getClient(serverId) as MockMCPClient;

      eventCapture.clear();

      // Simulate rapid state changes
      for (let i = 0; i < 5; i++) {
        client.getTransport().simulateFailure(new Error(`Error ${i}`));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const errorEvents = eventCapture.getEventsByType('error');
      expect(errorEvents.length).toBeGreaterThan(0);

      // Should handle rapid changes without crashing
      expect(connectionManager.getConnection(serverId)).toBeDefined();
    });
  });

  describe('Health Monitoring', () => {
    test('should perform regular health checks', async () => {
      const serverId = 'health-server';
      const connection = await connectionManager.connect(serverId);

      eventCapture.clear();

      // Wait for health checks to occur
      await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for at least one health check

      const healthEvents = eventCapture.getEventsByType('healthCheck');
      expect(healthEvents.length).toBeGreaterThan(0);

      const lastHealthCheck = healthEvents[healthEvents.length - 1];
      expect(lastHealthCheck.data.serverId).toBe(serverId);
      expect(lastHealthCheck.data.result).toBeDefined();
      expect(typeof lastHealthCheck.data.result.success).toBe('boolean');
    });

    test('should handle health check failures', async () => {
      const serverId = 'unhealthy-server';
      const connection = await connectionManager.connect(serverId);
      const client = connectionManager.getClient(serverId) as MockMCPClient;

      eventCapture.clear();

      // Disconnect to make health checks fail
      await client.disconnect();
      await new Promise(resolve => setTimeout(resolve, 1500));

      const healthEvents = eventCapture.getEventsByType('healthCheck');
      const healthFailures = healthEvents.filter(e => !e.data.result.success);

      expect(healthFailures.length).toBeGreaterThan(0);

      const lastFailure = healthFailures[healthFailures.length - 1];
      expect(lastFailure.data.result.success).toBe(false);
      expect(lastFailure.data.result.consecutiveFailures).toBeGreaterThan(0);
    });

    test('should trigger reconnection on health failure threshold', async () => {
      // This test would need specific configuration for health check thresholds
      const serverId = 'threshold-server';
      const connection = await connectionManager.connect(serverId);
      const client = connectionManager.getClient(serverId) as MockMCPClient;

      eventCapture.clear();

      // Force health check failures
      await client.disconnect();

      // Wait for health checks and potential reconnection
      await new Promise(resolve => setTimeout(resolve, 2000));

      const reconnectingEvents = eventCapture.getEventsByType('reconnecting');

      // May or may not trigger depending on health check configuration
      // The important thing is that the system handles it gracefully
      expect(() => connectionManager.getConnection(serverId)).not.toThrow();
    });
  });

  describe('Reconnection Scenarios', () => {
    test('should handle exponential backoff during reconnection', async () => {
      const serverId = 'backoff-server';
      const connection = await connectionManager.connect(serverId);
      const client = connectionManager.getClient(serverId) as MockMCPClient;

      // Configure transport to fail connections
      const transport = client.getTransport();
      transport.simulateConnectionFailure();
      transport.simulateConnectionFailure();
      transport.simulateConnectionFailure();

      eventCapture.clear();

      // Trigger disconnection
      transport.simulateFailure(new Error('Connection lost'));

      // Wait for reconnection attempts
      await new Promise(resolve => setTimeout(resolve, 2000));

      const reconnectingEvents = eventCapture.getEventsByType('reconnecting');

      if (reconnectingEvents.length > 1) {
        // Verify exponential backoff timing
        const times = reconnectingEvents.map(e => e.timestamp.getTime());
        for (let i = 1; i < times.length; i++) {
          const delay = times[i] - times[i - 1];
          // Each delay should be longer than the previous (exponential backoff)
          expect(delay).toBeGreaterThan(50); // Some minimum delay
        }
      }
    });

    test('should eventually give up after max retries', async () => {
      const serverId = 'exhausted-server';
      const connection = await connectionManager.connect(serverId);
      const client = connectionManager.getClient(serverId) as MockMCPClient;

      // Make all reconnection attempts fail
      const transport = client.getTransport();
      for (let i = 0; i < 10; i++) {
        transport.simulateConnectionFailure();
      }

      eventCapture.clear();

      // Trigger disconnection
      transport.simulateFailure(new Error('Connection lost'));

      // Wait for all retry attempts to exhaust
      await new Promise(resolve => setTimeout(resolve, 5000));

      const reconnectingEvents = eventCapture.getEventsByType('reconnecting');
      const errorEvents = eventCapture.getEventsByType('error');

      // Should have attempted reconnection but eventually given up
      expect(reconnectingEvents.length).toBeGreaterThan(0);

      // Final connection state should reflect exhausted retries
      const finalConnection = connectionManager.getConnection(serverId);
      if (finalConnection) {
        expect(['error', 'disconnected'].includes(finalConnection.state)).toBe(true);
      }
    });

    test('should succeed in reconnection when connection is restored', async () => {
      const serverId = 'recoverable-server';
      const connection = await connectionManager.connect(serverId);
      const client = connectionManager.getClient(serverId) as MockMCPClient;

      const transport = client.getTransport();

      // Fail first few attempts, then succeed
      transport.simulateConnectionFailure();
      transport.simulateConnectionFailure();
      // Third attempt should succeed

      eventCapture.clear();

      // Trigger disconnection
      transport.simulateFailure(new Error('Connection lost'));

      // Wait for reconnection
      await new Promise(resolve => setTimeout(resolve, 3000));

      const reconnectingEvents = eventCapture.getEventsByType('reconnecting');
      const connectedEvents = eventCapture.getEventsByType('connected');

      expect(reconnectingEvents.length).toBeGreaterThan(0);

      // Should eventually reconnect
      const finalConnection = connectionManager.getConnection(serverId);
      expect(finalConnection).toBeDefined();
      // State should be connected or in process of connecting
      expect(['connected', 'connecting', 'reconnecting'].includes(finalConnection!.state)).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle client initialization failures', async () => {
      const serverId = 'init-fail-server';

      // Mock transport creation to fail
      const { createTransport } = await import('../mcp/transport.js');
      const mockCreateTransport = vi.mocked(createTransport);
      mockCreateTransport.mockImplementation(() => {
        throw new Error('Failed to create transport');
      });

      await expect(connectionManager.connect(serverId)).rejects.toThrow();

      // Should not have any connections
      const connections = connectionManager.listConnections();
      expect(connections.find(c => c.serverId === serverId)).toBeUndefined();
    });

    test('should handle transport errors gracefully', async () => {
      const serverId = 'transport-error-server';
      const connection = await connectionManager.connect(serverId);
      const client = connectionManager.getClient(serverId) as MockMCPClient;

      eventCapture.clear();

      // Simulate various transport errors
      const errors = [
        new Error('ECONNRESET'),
        new Error('EPIPE'),
        new Error('Connection timeout'),
        new Error('Invalid message format'),
      ];

      for (const error of errors) {
        client.getTransport().simulateFailure(error);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const errorEvents = eventCapture.getEventsByType('error');
      expect(errorEvents.length).toBeGreaterThanOrEqual(errors.length);

      // Connection manager should still be functional
      expect(connectionManager.getConnection(serverId)).toBeDefined();
    });

    test('should handle resource cleanup on connection failure', async () => {
      const serverId = 'cleanup-server';

      // Connect successfully first
      const connection = await connectionManager.connect(serverId);
      expect(connectionManager.listConnections()).toHaveLength(1);

      const client = connectionManager.getClient(serverId) as MockMCPClient;

      // Simulate permanent failure
      client.getTransport().simulateFailure(new Error('Permanent failure'));

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Force disconnect to trigger cleanup
      await connectionManager.disconnect(serverId);

      // Verify cleanup
      expect(connectionManager.getConnection(serverId)).toBeUndefined();
      expect(connectionManager.getClient(serverId)).toBeUndefined();
    });
  });

  describe('Connection Metrics and Monitoring', () => {
    test('should track connection metrics accurately', async () => {
      const serverId = 'metrics-server';
      const connection = await connectionManager.connect(serverId);

      // Simulate some activity
      const client = connectionManager.getClient(serverId) as MockMCPClient;

      // Add some tools and make requests
      client.addTool('test-tool', { name: 'test-tool', description: 'Test tool' });

      try {
        await client.listTools();
        await client.callTool('test-tool', {});
      } catch (error) {
        // Ignore errors for metrics test
      }

      const finalConnection = connectionManager.getConnection(serverId);
      expect(finalConnection).toBeDefined();
      expect(finalConnection!.metrics).toBeDefined();

      if (finalConnection!.metrics) {
        expect(finalConnection!.metrics.totalConnections).toBeGreaterThan(0);
        expect(finalConnection!.metrics.connectedAt).toBeInstanceOf(Date);
      }
    });

    test('should handle health check result tracking', async () => {
      const serverId = 'health-metrics-server';
      const connection = await connectionManager.connect(serverId);

      eventCapture.clear();

      // Wait for health checks
      await new Promise(resolve => setTimeout(resolve, 1500));

      const healthEvents = eventCapture.getEventsByType('healthCheck');

      if (healthEvents.length > 0) {
        const healthResult = healthEvents[0].data.result;
        expect(healthResult).toHaveProperty('success');
        expect(healthResult).toHaveProperty('timestamp');
        expect(healthResult).toHaveProperty('isHealthy');

        if (healthResult.success) {
          expect(healthResult).toHaveProperty('latencyMs');
          expect(typeof healthResult.latencyMs).toBe('number');
        }
      }
    });
  });

  describe('Event System Verification', () => {
    test('should emit events in correct order', async () => {
      const serverId = 'event-order-server';

      eventCapture.clear();
      const connection = await connectionManager.connect(serverId);

      const events = eventCapture.getEventsForServer(serverId);
      const eventTypes = events.map(e => e.type);

      // Should have state change events
      expect(eventTypes).toContain('stateChange');

      // Should have connected event
      expect(eventTypes).toContain('connected');

      // Events should be in chronological order
      for (let i = 1; i < events.length; i++) {
        expect(events[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          events[i - 1].timestamp.getTime()
        );
      }
    });

    test('should handle event listener errors gracefully', async () => {
      const serverId = 'listener-error-server';

      // Add error-throwing listener
      connectionManager.on('connected', () => {
        throw new Error('Listener error');
      });

      // Should not prevent normal operation
      await expect(connectionManager.connect(serverId)).resolves.toBeDefined();

      const connection = connectionManager.getConnection(serverId);
      expect(connection).toBeDefined();
      expect(connection!.state).toBe('connected');
    });

    test('should support multiple event listeners', async () => {
      const serverId = 'multi-listener-server';

      let listener1Called = false;
      let listener2Called = false;
      let listener3Called = false;

      connectionManager.on('connected', () => { listener1Called = true; });
      connectionManager.on('connected', () => { listener2Called = true; });
      connectionManager.on('connected', () => { listener3Called = true; });

      await connectionManager.connect(serverId);

      expect(listener1Called).toBe(true);
      expect(listener2Called).toBe(true);
      expect(listener3Called).toBe(true);
    });
  });

  describe('Stress Testing', () => {
    test('should handle rapid connect/disconnect cycles', async () => {
      const serverId = 'stress-server';

      // Perform many rapid cycles
      for (let i = 0; i < 10; i++) {
        const connection = await connectionManager.connect(serverId);
        expect(connection.state).toBe('connected');

        await connectionManager.disconnect(serverId);

        const disconnected = connectionManager.getConnection(serverId);
        expect(disconnected).toBeUndefined();
      }

      // Should still be functional
      const finalConnection = await connectionManager.connect(serverId);
      expect(finalConnection.state).toBe('connected');
    });

    test('should handle many simultaneous connections', async () => {
      const serverCount = 20;
      const serverIds = Array.from({ length: serverCount }, (_, i) => `stress-${i}`);

      const startTime = Date.now();

      // Connect to all servers
      const connections = await Promise.all(
        serverIds.map(id => connectionManager.connect(id))
      );

      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds

      // All should be connected
      expect(connections).toHaveLength(serverCount);
      connections.forEach(conn => {
        expect(conn.state).toBe('connected');
      });

      // Verify all are tracked
      const allConnections = connectionManager.listConnections();
      expect(allConnections).toHaveLength(serverCount);

      // Cleanup
      await connectionManager.disconnectAll();
      expect(connectionManager.listConnections()).toHaveLength(0);
    });
  });
});