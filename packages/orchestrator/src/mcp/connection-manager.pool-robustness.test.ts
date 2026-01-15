/**
 * MCPConnectionManager Pool Robustness Tests
 *
 * Tests for edge cases, error handling, and robustness scenarios
 * for connection pool operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { ApexConfig, MCPConnectionConfig } from '@apexcli/core';
import {
  MCPConnectionManager,
  type PooledConnection,
} from './connection-manager.js';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the transport and client modules with configurable behavior
vi.mock('./transports/index.js', () => ({
  StdioTransport: vi.fn().mockImplementation(() => createMockTransport()),
}));

vi.mock('./client.js', () => ({
  MCPClient: vi.fn().mockImplementation(({ transport }) => createMockClient(transport)),
}));

let mockTransportBehavior = { shouldFail: false, disconnectAfter: 0 };

// Helper to create a mock transport with configurable behavior
function createMockTransport() {
  const emitter = new EventEmitter();
  return {
    on: vi.fn((event, handler) => {
      emitter.on(event, handler);
      return emitter;
    }),
    off: vi.fn((event, handler) => {
      emitter.off(event, handler);
      return emitter;
    }),
    emit: vi.fn((event, ...args) => emitter.emit(event, ...args)),
    connect: vi.fn().mockImplementation(async () => {
      if (mockTransportBehavior.shouldFail) {
        throw new Error('Transport connection failed');
      }
      if (mockTransportBehavior.disconnectAfter > 0) {
        setTimeout(() => {
          emitter.emit('disconnected', 'Transport disconnected unexpectedly');
        }, mockTransportBehavior.disconnectAfter);
      }
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    getState: vi.fn().mockReturnValue('connected'),
    _eventEmitter: emitter,
  };
}

// Helper to create a mock client
function createMockClient(transport: any) {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockImplementation(async () => {
      if (mockTransportBehavior.shouldFail) {
        throw new Error('Client disconnect failed');
      }
    }),
    listTools: vi.fn().mockResolvedValue([]),
    callTool: vi.fn().mockResolvedValue({ result: 'success' }),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
}

// ============================================================================
// Test Configuration
// ============================================================================

const createTestConfig = (connectionConfig: Partial<MCPConnectionConfig> = {}): ApexConfig => ({
  projectName: 'test-project',
  projectDescription: 'Test project',
  version: '1.0.0',
  mcp: {
    enabled: true,
    connection: {
      maxRetries: 2,
      retryDelayMs: 100,
      backoffFactor: 2,
      maxRetryDelayMs: 1000,
      connectionTimeoutMs: 5000,
      requestTimeoutMs: 10000,
      idleTimeoutMs: 60000,
      poolSize: 3,
      poolMinSize: 1,
      healthCheckIntervalMs: 0,
      healthCheckTimeoutMs: 500,
      healthCheckFailureThreshold: 2,
      autoReconnect: false,
      keepAlive: true,
      keepAliveIntervalMs: 5000,
      ...connectionConfig,
    },
    servers: {
      'test-server': {
        name: 'Test Server',
        type: 'stdio',
        command: 'node',
        args: ['test-server.js'],
      } as const,
    },
  },
});

// ============================================================================
// Test Suites
// ============================================================================

describe('MCPConnectionManager - Pool Robustness', () => {
  let manager: MCPConnectionManager;
  let config: ApexConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransportBehavior = { shouldFail: false, disconnectAfter: 0 };
    config = createTestConfig();
  });

  afterEach(async () => {
    if (manager) {
      await manager.disconnectAll();
    }
  });

  describe('Pool Boundary Conditions', () => {
    it('should handle poolSize of 0', async () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config: createTestConfig({ poolSize: 0 }),
      });

      await manager.connect('test-server');

      // With poolSize 0, pooling should be disabled
      const context = (manager as any).connections.get('test-server');
      expect(context.pool).toBeUndefined();

      await expect(manager.acquirePooledConnection('test-server')).rejects.toThrow(
        'Connection pooling is not enabled for \'test-server\''
      );
    });

    it('should handle negative poolSize', async () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config: createTestConfig({ poolSize: -1 }),
      });

      await manager.connect('test-server');

      // Negative poolSize should be treated as disabled
      const context = (manager as any).connections.get('test-server');
      expect(context.pool).toBeUndefined();
    });

    it('should handle poolMinSize greater than poolSize', async () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config: createTestConfig({ poolSize: 3, poolMinSize: 5 }),
      });

      await manager.connect('test-server');

      const context = (manager as any).connections.get('test-server');
      expect(context.pool).toBeDefined();
      // Should cap minSize at maxSize
      expect(context.pool.config.minConnections).toBeLessThanOrEqual(context.pool.config.maxConnections);
    });

    it('should handle very large pool sizes', async () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config: createTestConfig({ poolSize: 1000 }),
      });

      await manager.connect('test-server');

      const context = (manager as any).connections.get('test-server');
      expect(context.pool).toBeDefined();
      expect(context.pool.config.maxConnections).toBe(1000);

      // Should be able to create multiple connections up to reasonable limit
      const connections: PooledConnection[] = [];
      for (let i = 0; i < 5; i++) {
        const conn = await manager.acquirePooledConnection('test-server');
        connections.push(conn);
      }

      expect(connections).toHaveLength(5);
      expect(new Set(connections.map(c => c.id))).toHaveProperty('size', 5);
    });
  });

  describe('Connection Creation Failures', () => {
    it('should handle transport connection failures', async () => {
      mockTransportBehavior.shouldFail = true;

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      await manager.connect('test-server');

      // Acquiring pooled connection should fail when transport fails
      await expect(manager.acquirePooledConnection('test-server')).rejects.toThrow(
        'Transport connection failed'
      );

      const context = (manager as any).connections.get('test-server');
      expect(context.pool.connections.size).toBe(0);
    });

    it('should not add failed connections to pool', async () => {
      let shouldFail = true;

      // Mock client creation to fail initially, then succeed
      const { MCPClient } = await import('./client.js');
      vi.mocked(MCPClient).mockImplementation(({ transport }) => {
        if (shouldFail) {
          return {
            connect: vi.fn().mockRejectedValue(new Error('Client connection failed')),
            disconnect: vi.fn().mockResolvedValue(undefined),
          } as any;
        }
        return createMockClient(transport);
      });

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      await manager.connect('test-server');

      // First attempt should fail
      await expect(manager.acquirePooledConnection('test-server')).rejects.toThrow(
        'Client connection failed'
      );

      const context = (manager as any).connections.get('test-server');
      expect(context.pool.connections.size).toBe(0);

      // Second attempt should succeed
      shouldFail = false;
      const conn = await manager.acquirePooledConnection('test-server');
      expect(conn).toBeDefined();
      expect(context.pool.connections.size).toBe(1);
    });
  });

  describe('Pool Cleanup Robustness', () => {
    it('should handle disconnect failures during pool cleanup', async () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      await manager.connect('test-server');

      // Create some pooled connections
      const conn1 = await manager.acquirePooledConnection('test-server');
      const conn2 = await manager.acquirePooledConnection('test-server');

      // Configure disconnect to fail
      mockTransportBehavior.shouldFail = true;

      // Disconnect should complete despite disconnect failures
      await expect(manager.disconnect('test-server')).resolves.not.toThrow();

      // Connection should still be removed from manager
      const context = (manager as any).connections.get('test-server');
      expect(context).toBeUndefined();
    });

    it('should handle partial pool cleanup failures', async () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      await manager.connect('test-server');

      // Create multiple pooled connections
      const connections: PooledConnection[] = [];
      for (let i = 0; i < 3; i++) {
        const conn = await manager.acquirePooledConnection('test-server');
        connections.push(conn);
        manager.releasePooledConnection('test-server', conn.id);
      }

      // Mock some disconnections to fail
      let disconnectCallCount = 0;
      const { MCPClient } = await import('./client.js');
      vi.mocked(MCPClient).mockImplementation(({ transport }) => ({
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockImplementation(async () => {
          disconnectCallCount++;
          if (disconnectCallCount === 2) {
            throw new Error('Disconnect failed for connection 2');
          }
        }),
        listTools: vi.fn().mockResolvedValue([]),
        callTool: vi.fn().mockResolvedValue({}),
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      }));

      // Cleanup should complete despite some failures
      await expect(manager.disconnect('test-server')).resolves.not.toThrow();
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent pool acquisitions', async () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config: createTestConfig({ poolSize: 2 }),
      });

      await manager.connect('test-server');

      // Create multiple concurrent acquisition requests
      const acquisitionPromises = Array.from({ length: 5 }, () =>
        manager.acquirePooledConnection('test-server').catch(err => err)
      );

      const results = await Promise.all(acquisitionPromises);

      // Should get 2 successful connections and 3 errors
      const successfulConnections = results.filter(r => !(r instanceof Error));
      const errors = results.filter(r => r instanceof Error);

      expect(successfulConnections).toHaveLength(2);
      expect(errors).toHaveLength(3);

      // All successful connections should be unique
      const connectionIds = successfulConnections.map((conn: PooledConnection) => conn.id);
      expect(new Set(connectionIds)).toHaveProperty('size', 2);

      // All errors should be pool exhaustion errors
      errors.forEach(error => {
        expect(error.message).toContain('No available connections in pool');
      });
    });

    it('should handle concurrent releases', async () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      await manager.connect('test-server');

      // Acquire multiple connections
      const connections: PooledConnection[] = [];
      for (let i = 0; i < 3; i++) {
        const conn = await manager.acquirePooledConnection('test-server');
        connections.push(conn);
      }

      // Release all connections concurrently
      const releasePromises = connections.map(conn =>
        Promise.resolve(manager.releasePooledConnection('test-server', conn.id))
      );

      await Promise.all(releasePromises);

      // All connections should be available again
      const context = (manager as any).connections.get('test-server');
      const availableConnections = Array.from(context.pool.connections.values())
        .filter(c => !c.inUse);
      expect(availableConnections).toHaveLength(3);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak connection references after cleanup', async () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      await manager.connect('test-server');

      // Create and release connections
      const connectionIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const conn = await manager.acquirePooledConnection('test-server');
        connectionIds.push(conn.id);
        manager.releasePooledConnection('test-server', conn.id);
      }

      const context = (manager as any).connections.get('test-server');
      expect(context.pool.connections.size).toBeGreaterThan(0);

      // Disconnect should clean up all references
      await manager.disconnect('test-server');

      // No connections should remain in the manager
      expect((manager as any).connections.get('test-server')).toBeUndefined();
    });

    it('should handle connection ID collisions gracefully', async () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      await manager.connect('test-server');

      // Create multiple connections
      const connections: PooledConnection[] = [];
      for (let i = 0; i < 3; i++) {
        const conn = await manager.acquirePooledConnection('test-server');
        connections.push(conn);
      }

      // All connection IDs should be unique
      const uniqueIds = new Set(connections.map(c => c.id));
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('Invalid Operations', () => {
    it('should handle release of already released connection', () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      // Should not throw when releasing non-existent connection
      expect(() => {
        manager.releasePooledConnection('test-server', 'non-existent-id');
      }).not.toThrow();
    });

    it('should handle operations on non-existent server', async () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      await expect(manager.acquirePooledConnection('non-existent-server')).rejects.toThrow(
        'Connection \'non-existent-server\' not found'
      );

      expect(() => {
        manager.releasePooledConnection('non-existent-server', 'some-id');
      }).not.toThrow();
    });

    it('should handle malformed connection IDs', () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      // Should handle various malformed IDs gracefully
      const malformedIds = ['', null, undefined, 123, {}, []];

      malformedIds.forEach(malformedId => {
        expect(() => {
          manager.releasePooledConnection('test-server', malformedId as any);
        }).not.toThrow();
      });
    });
  });
});