/**
 * Connection Pooling Tests for MCPConnectionManager
 *
 * This test suite covers the connection pooling functionality of MCPConnectionManager:
 * - Pool configuration and initialization
 * - Connection acquisition and release
 * - Pool strategies (round-robin, least-busy, random)
 * - Pool cleanup and management
 * - Pool event emission
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { ApexConfig, MCPServerConfig, MCPConnectionConfig } from '@apexcli/core';
import {
  MCPConnectionManager,
  type MCPConnectionManagerOptions,
  type PooledConnection,
} from '../connection-manager.js';

// ============================================================================
// Mock Setup
// ============================================================================

class MockTransport extends EventEmitter {
  public isConnectedState = false;
  public connectionAttempts = 0;

  async connect(): Promise<void> {
    this.connectionAttempts++;
    this.isConnectedState = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    if (this.isConnectedState) {
      this.isConnectedState = false;
      this.emit('disconnected', 'Manual disconnect');
    }
  }

  isConnected(): boolean {
    return this.isConnectedState;
  }

  reset(): void {
    this.isConnectedState = false;
    this.connectionAttempts = 0;
    this.removeAllListeners();
  }
}

class MockClient extends EventEmitter {
  public transport: MockTransport;

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

  async listTools(): Promise<any[]> {
    return [{ name: 'test-tool', description: 'A test tool' }];
  }

  async ping(): Promise<any> {
    return { pong: true };
  }

  async callTool(name: string, args?: any): Promise<any> {
    return { result: `Called ${name} with args ${JSON.stringify(args)}` };
  }

  reset(): void {
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
    description: 'Test project for MCPConnectionManager pooling',
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
      healthCheckIntervalMs: 0, // Disable for pooling tests
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

// ============================================================================
// Test Suite
// ============================================================================

describe('MCPConnectionManager - Connection Pooling', () => {
  let manager: MCPConnectionManager;
  let mockTransports: MockTransport[];
  let mockClients: MockClient[];

  beforeEach(async () => {
    vi.clearAllMocks();
    mockTransports = [];
    mockClients = [];

    // Get references to mocked classes
    const { StdioTransport } = await import('../transports/index.js');
    const { MCPClient } = await import('../client.js');
    const MockedStdioTransport = vi.mocked(StdioTransport);
    const MockedMCPClient = vi.mocked(MCPClient);

    // Configure mocks to create new instances for each call
    MockedStdioTransport.mockImplementation(() => {
      const transport = new MockTransport();
      mockTransports.push(transport);
      return transport as any;
    });

    MockedMCPClient.mockImplementation((options: { transport: MockTransport }) => {
      const client = new MockClient(options);
      mockClients.push(client);
      return client as any;
    });
  });

  afterEach(async () => {
    if (manager) {
      await manager.disconnectAll();
    }
    mockTransports.forEach(transport => transport.reset());
    mockClients.forEach(client => client.reset());
    mockTransports.length = 0;
    mockClients.length = 0;
  });

  // ==========================================================================
  // Pool Configuration Tests
  // ==========================================================================

  describe('Pool Configuration', () => {
    it('should disable pooling by default (poolSize = 1)', async () => {
      const config = createTestConfig({
        'single-server': {
          name: 'Single Connection Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('single-server');

      // Should throw error since pooling is disabled
      await expect(manager.acquirePooledConnection('single-server')).rejects.toThrow(
        'Connection pooling is not enabled'
      );
    });

    it('should enable pooling when poolSize > 1', async () => {
      const config = createTestConfig(
        {
          'pooled-server': {
            name: 'Pooled Server',
            type: 'stdio',
            command: 'node',
          },
        },
        { poolSize: 3, poolMinSize: 1 }
      );

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('pooled-server');

      // Should be able to acquire pooled connections
      const pooledConnection = await manager.acquirePooledConnection('pooled-server');
      expect(pooledConnection).toBeDefined();
      expect(pooledConnection.id).toBeDefined();
      expect(pooledConnection.connection.serverId).toBe('pooled-server');
    });

    it('should respect pool min and max size configuration', async () => {
      const config = createTestConfig(
        {
          'sized-pool-server': {
            name: 'Sized Pool Server',
            type: 'stdio',
            command: 'node',
          },
        },
        { poolSize: 5, poolMinSize: 2 }
      );

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('sized-pool-server');

      // Pool should create connections as needed up to max
      const connections: PooledConnection[] = [];

      for (let i = 0; i < 5; i++) {
        const conn = await manager.acquirePooledConnection('sized-pool-server');
        expect(conn).toBeDefined();
        connections.push(conn);
      }

      // Should have created 5 unique connections
      const uniqueIds = new Set(connections.map(c => c.id));
      expect(uniqueIds.size).toBe(5);

      // All should be in use
      expect(connections.every(c => c.inUse)).toBe(true);

      // Release all connections
      connections.forEach(conn => {
        manager.releasePooledConnection('sized-pool-server', conn.id);
      });

      // All should be released
      connections.forEach(conn => {
        expect(conn.inUse).toBe(false);
      });
    });

    it('should throw error when pool size exceeded', async () => {
      const config = createTestConfig(
        {
          'limited-pool-server': {
            name: 'Limited Pool Server',
            type: 'stdio',
            command: 'node',
          },
        },
        { poolSize: 2 }
      );

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('limited-pool-server');

      // Acquire all available connections
      const conn1 = await manager.acquirePooledConnection('limited-pool-server');
      const conn2 = await manager.acquirePooledConnection('limited-pool-server');

      expect(conn1).toBeDefined();
      expect(conn2).toBeDefined();

      // Next acquisition should fail
      await expect(manager.acquirePooledConnection('limited-pool-server')).rejects.toThrow(
        'No available connections in pool'
      );

      // Release one connection
      manager.releasePooledConnection('limited-pool-server', conn1.id);

      // Should be able to acquire again
      const conn3 = await manager.acquirePooledConnection('limited-pool-server');
      expect(conn3).toBeDefined();
    });
  });

  // ==========================================================================
  // Pool Strategies Tests
  // ==========================================================================

  describe('Pool Selection Strategies', () => {
    it('should support round-robin strategy (default)', async () => {
      const config = createTestConfig(
        {
          'round-robin-server': {
            name: 'Round Robin Server',
            type: 'stdio',
            command: 'node',
          },
        },
        { poolSize: 3 }
      );

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('round-robin-server');

      // Acquire and release multiple times to test round-robin
      const acquisitionOrder: string[] = [];

      for (let i = 0; i < 6; i++) {
        const conn = await manager.acquirePooledConnection('round-robin-server');
        acquisitionOrder.push(conn.id);
        manager.releasePooledConnection('round-robin-server', conn.id);
      }

      // Should cycle through connections (round-robin)
      expect(acquisitionOrder).toHaveLength(6);

      // First three should be unique
      const firstThree = acquisitionOrder.slice(0, 3);
      expect(new Set(firstThree).size).toBe(3);

      // Second three should repeat the pattern
      const secondThree = acquisitionOrder.slice(3, 6);
      expect(firstThree[0]).toBe(secondThree[0]);
      expect(firstThree[1]).toBe(secondThree[1]);
      expect(firstThree[2]).toBe(secondThree[2]);
    });

    // Note: Since we're testing the manager interface and not implementation details,
    // we can't easily test least-busy and random strategies without access to pool internals.
    // In a real implementation, you might expose methods to change strategies or
    // test them indirectly through behavior patterns.
  });

  // ==========================================================================
  // Connection Lifecycle Tests
  // ==========================================================================

  describe('Connection Lifecycle', () => {
    it('should track connection usage metrics', async () => {
      const config = createTestConfig(
        {
          'metrics-server': {
            name: 'Metrics Server',
            type: 'stdio',
            command: 'node',
          },
        },
        { poolSize: 2 }
      );

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('metrics-server');

      const conn = await manager.acquirePooledConnection('metrics-server');

      expect(conn.requestCount).toBe(0);
      expect(conn.createdAt).toBeInstanceOf(Date);
      expect(conn.lastUsedAt).toBeInstanceOf(Date);
      expect(conn.inUse).toBe(true);

      // Release and re-acquire to increment usage
      manager.releasePooledConnection('metrics-server', conn.id);
      expect(conn.inUse).toBe(false);

      const conn2 = await manager.acquirePooledConnection('metrics-server');
      expect(conn2.id).toBe(conn.id); // Should reuse the same connection
      expect(conn2.requestCount).toBe(1); // Should increment
    });

    it('should handle concurrent pool acquisitions', async () => {
      const config = createTestConfig(
        {
          'concurrent-server': {
            name: 'Concurrent Server',
            type: 'stdio',
            command: 'node',
          },
        },
        { poolSize: 3 }
      );

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('concurrent-server');

      // Simulate concurrent acquisitions
      const acquisitionPromises = Array.from({ length: 3 }, () =>
        manager.acquirePooledConnection('concurrent-server')
      );

      const connections = await Promise.all(acquisitionPromises);

      // All should succeed
      expect(connections).toHaveLength(3);
      connections.forEach(conn => {
        expect(conn).toBeDefined();
        expect(conn.inUse).toBe(true);
      });

      // All should be unique
      const uniqueIds = new Set(connections.map(c => c.id));
      expect(uniqueIds.size).toBe(3);

      // Clean up
      connections.forEach(conn => {
        manager.releasePooledConnection('concurrent-server', conn.id);
      });
    });

    it('should gracefully handle release of non-existent connections', () => {
      const config = createTestConfig(
        {
          'release-server': {
            name: 'Release Server',
            type: 'stdio',
            command: 'node',
          },
        },
        { poolSize: 2 }
      );

      manager = new MCPConnectionManager(createManagerOptions(config));

      // Should not throw when releasing non-existent connection
      expect(() => {
        manager.releasePooledConnection('release-server', 'non-existent-id');
      }).not.toThrow();

      // Should not throw when server doesn't exist
      expect(() => {
        manager.releasePooledConnection('non-existent-server', 'any-id');
      }).not.toThrow();
    });

    it('should clean up pool on server disconnect', async () => {
      const config = createTestConfig(
        {
          'cleanup-server': {
            name: 'Cleanup Server',
            type: 'stdio',
            command: 'node',
          },
        },
        { poolSize: 3 }
      );

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('cleanup-server');

      // Acquire some pooled connections
      const conn1 = await manager.acquirePooledConnection('cleanup-server');
      const conn2 = await manager.acquirePooledConnection('cleanup-server');

      expect(conn1).toBeDefined();
      expect(conn2).toBeDefined();

      // Disconnect the server
      await manager.disconnect('cleanup-server');

      // Should no longer be able to acquire from this pool
      await expect(manager.acquirePooledConnection('cleanup-server')).rejects.toThrow(
        "Connection 'cleanup-server' not found"
      );
    });
  });

  // ==========================================================================
  // Event Emission Tests
  // ==========================================================================

  describe('Pool Event Emission', () => {
    it('should emit poolChange events on acquisition and release', async () => {
      const config = createTestConfig(
        {
          'events-server': {
            name: 'Events Server',
            type: 'stdio',
            command: 'node',
          },
        },
        { poolSize: 3 }
      );

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('events-server');

      const poolEvents: Array<{ serverId: string; poolSize: number; activeConnections: number }> = [];

      manager.on('poolChange', (serverId, poolSize, activeConnections) => {
        poolEvents.push({ serverId, poolSize, activeConnections });
      });

      // Acquire connections and verify events
      const conn1 = await manager.acquirePooledConnection('events-server');
      expect(poolEvents).toHaveLength(1);
      expect(poolEvents[0]).toEqual({
        serverId: 'events-server',
        poolSize: 1,
        activeConnections: 1,
      });

      const conn2 = await manager.acquirePooledConnection('events-server');
      expect(poolEvents).toHaveLength(2);
      expect(poolEvents[1]).toEqual({
        serverId: 'events-server',
        poolSize: 2,
        activeConnections: 2,
      });

      // Release connections and verify events
      manager.releasePooledConnection('events-server', conn1.id);
      expect(poolEvents).toHaveLength(3);
      expect(poolEvents[2]).toEqual({
        serverId: 'events-server',
        poolSize: 2,
        activeConnections: 1,
      });

      manager.releasePooledConnection('events-server', conn2.id);
      expect(poolEvents).toHaveLength(4);
      expect(poolEvents[3]).toEqual({
        serverId: 'events-server',
        poolSize: 2,
        activeConnections: 0,
      });
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Pool Error Handling', () => {
    it('should handle pool acquisition errors gracefully', async () => {
      const config = createTestConfig({
        'error-server': {
          name: 'Error Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      // Try to acquire from non-existent connection
      await expect(manager.acquirePooledConnection('non-existent')).rejects.toThrow(
        "Connection 'non-existent' not found"
      );

      // Try to acquire from connection without pooling
      await manager.connect('error-server');
      await expect(manager.acquirePooledConnection('error-server')).rejects.toThrow(
        'Connection pooling is not enabled'
      );
    });

    it('should handle transport failures during pool creation', async () => {
      const config = createTestConfig(
        {
          'failing-transport-server': {
            name: 'Failing Transport Server',
            type: 'stdio',
            command: 'node',
          },
        },
        { poolSize: 3 }
      );

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('failing-transport-server');

      // Mock transport failure for new connections
      const { StdioTransport } = await import('../transports/index.js');
      const MockedStdioTransport = vi.mocked(StdioTransport);

      // Make next transport creation fail
      MockedStdioTransport.mockImplementationOnce(() => {
        throw new Error('Transport creation failed');
      });

      // Should handle pool connection creation failure
      await expect(manager.acquirePooledConnection('failing-transport-server')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Pool Integration', () => {
    it('should work correctly with health monitoring disabled', async () => {
      const config = createTestConfig(
        {
          'integration-server': {
            name: 'Integration Server',
            type: 'stdio',
            command: 'node',
          },
        },
        {
          poolSize: 2,
          healthCheckIntervalMs: 0, // Disabled
        }
      );

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('integration-server');

      // Pool should work normally without health monitoring
      const conn = await manager.acquirePooledConnection('integration-server');
      expect(conn).toBeDefined();

      manager.releasePooledConnection('integration-server', conn.id);
      expect(conn.inUse).toBe(false);
    });

    it('should handle multiple servers with different pool configurations', async () => {
      const config = createTestConfig({
        'single-server': {
          name: 'Single Server',
          type: 'stdio',
          command: 'node',
        },
        'pooled-server': {
          name: 'Pooled Server',
          type: 'stdio',
          command: 'node',
        },
      });

      // Override connection config for different pool sizes
      const options1 = createManagerOptions(config, {
        connectionConfig: { poolSize: 1 }
      });

      manager = new MCPConnectionManager(options1);

      // Connect to both servers
      await manager.connect('single-server');

      // Create second manager with pooling enabled for testing multiple configurations
      const pooledConfig = createTestConfig({
        'pooled-server': {
          name: 'Pooled Server',
          type: 'stdio',
          command: 'node',
        },
      }, { poolSize: 3 });

      const pooledManager = new MCPConnectionManager(createManagerOptions(pooledConfig));
      await pooledManager.connect('pooled-server');

      // Single connection server should not support pooling
      await expect(manager.acquirePooledConnection('single-server')).rejects.toThrow(
        'Connection pooling is not enabled'
      );

      // Pooled server should support pooling
      const pooledConn = await pooledManager.acquirePooledConnection('pooled-server');
      expect(pooledConn).toBeDefined();

      await pooledManager.disconnectAll();
    });
  });
});