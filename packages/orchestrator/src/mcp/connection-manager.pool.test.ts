/**
 * MCPConnectionManager Connection Pool Tests
 *
 * Comprehensive tests for connection pool operations including:
 * - Pool initialization and configuration
 * - Connection acquisition and release
 * - Pool size limits enforcement
 * - Connection selection strategies
 * - Pool cleanup and lifecycle management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { ApexConfig, MCPConnectionConfig } from '@apexcli/core';
import {
  MCPConnectionManager,
  type MCPConnectionManagerOptions,
  type PooledConnection,
} from './connection-manager.js';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the transport and client modules
vi.mock('./transports/index.js', () => ({
  StdioTransport: vi.fn().mockImplementation(() => createMockTransport()),
}));

vi.mock('./client.js', () => ({
  MCPClient: vi.fn().mockImplementation(({ transport }) => createMockClient(transport)),
}));

// Helper to create a mock transport
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
    connect: vi.fn().mockResolvedValue(undefined),
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
    disconnect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue([{ name: 'test-tool', description: 'Test tool' }]),
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
      poolSize: 3, // Enable pooling by default
      poolMinSize: 1,
      healthCheckIntervalMs: 0, // Disable for pool tests
      healthCheckTimeoutMs: 500,
      healthCheckFailureThreshold: 2,
      autoReconnect: false, // Disable for pool tests
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

describe('MCPConnectionManager - Pool Initialization', () => {
  let manager: MCPConnectionManager;
  let config: ApexConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = createTestConfig();
  });

  afterEach(async () => {
    if (manager) {
      await manager.disconnectAll();
    }
  });

  it('should create connection pool when poolSize > 1', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config: createTestConfig({ poolSize: 5, poolMinSize: 2 }),
    });

    await manager.connect('test-server');

    const context = (manager as any).connections.get('test-server');
    expect(context.pool).toBeDefined();
    expect(context.pool.config.maxConnections).toBe(5);
    expect(context.pool.config.minConnections).toBe(2);
    expect(context.pool.strategy).toBe('round-robin');
    expect(context.pool.connections).toBeInstanceOf(Map);
    expect(context.pool.roundRobinIndex).toBe(0);
  });

  it('should not create connection pool when poolSize = 1', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config: createTestConfig({ poolSize: 1 }),
    });

    await manager.connect('test-server');

    const context = (manager as any).connections.get('test-server');
    expect(context.pool).toBeUndefined();
  });

  it('should throw error when acquiring pooled connection without pool', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config: createTestConfig({ poolSize: 1 }),
    });

    await manager.connect('test-server');

    await expect(manager.acquirePooledConnection('test-server')).rejects.toThrow(
      'Connection pooling is not enabled for \'test-server\''
    );
  });

  it('should throw error when acquiring connection for non-existent server', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    await expect(manager.acquirePooledConnection('non-existent')).rejects.toThrow(
      'Connection \'non-existent\' not found'
    );
  });
});

describe('MCPConnectionManager - Pool Acquisition and Release', () => {
  let manager: MCPConnectionManager;
  let config: ApexConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = createTestConfig({ poolSize: 3, poolMinSize: 1 });
  });

  afterEach(async () => {
    if (manager) {
      await manager.disconnectAll();
    }
  });

  it('should acquire and release pooled connections correctly', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    const poolChangeSpy = vi.fn();
    manager.on('poolChange', poolChangeSpy);

    await manager.connect('test-server');

    // Acquire first connection - should create a new pooled connection
    const conn1 = await manager.acquirePooledConnection('test-server');

    expect(conn1).toBeDefined();
    expect(conn1.id).toBeDefined();
    expect(conn1.inUse).toBe(true);
    expect(conn1.requestCount).toBe(1);
    expect(conn1.lastUsedAt).toBeInstanceOf(Date);
    expect(conn1.createdAt).toBeInstanceOf(Date);
    expect(poolChangeSpy).toHaveBeenCalledWith('test-server', 1, 1);

    // Release the connection
    manager.releasePooledConnection('test-server', conn1.id);

    expect(conn1.inUse).toBe(false);
    expect(poolChangeSpy).toHaveBeenCalledWith('test-server', 1, 0);
  });

  it('should reuse released connections', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    await manager.connect('test-server');

    // Acquire and release a connection
    const conn1 = await manager.acquirePooledConnection('test-server');
    const conn1Id = conn1.id;
    manager.releasePooledConnection('test-server', conn1.id);

    // Acquire again - should reuse the same connection
    const conn2 = await manager.acquirePooledConnection('test-server');

    expect(conn2.id).toBe(conn1Id);
    expect(conn2.inUse).toBe(true);
    expect(conn2.requestCount).toBe(2); // Should increment
  });

  it('should create new connections up to pool limit', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config: createTestConfig({ poolSize: 2 }),
    });

    await manager.connect('test-server');

    // Acquire multiple connections
    const conn1 = await manager.acquirePooledConnection('test-server');
    const conn2 = await manager.acquirePooledConnection('test-server');

    expect(conn1.id).not.toBe(conn2.id);
    expect(conn1.inUse).toBe(true);
    expect(conn2.inUse).toBe(true);

    const context = (manager as any).connections.get('test-server');
    expect(context.pool.connections.size).toBe(2);
  });

  it('should throw error when pool is exhausted', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config: createTestConfig({ poolSize: 1 }),
    });

    await manager.connect('test-server');

    // Acquire the only available connection
    await manager.acquirePooledConnection('test-server');

    // Try to acquire another - should fail
    await expect(manager.acquirePooledConnection('test-server')).rejects.toThrow(
      'No available connections in pool for test-server'
    );
  });

  it('should handle release of non-existent connection gracefully', () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    // Should not throw when releasing non-existent connection
    expect(() => {
      manager.releasePooledConnection('test-server', 'non-existent-id');
    }).not.toThrow();

    // Should not throw when releasing connection for non-existent server
    expect(() => {
      manager.releasePooledConnection('non-existent-server', 'some-id');
    }).not.toThrow();
  });
});

describe('MCPConnectionManager - Pool Selection Strategies', () => {
  let manager: MCPConnectionManager;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (manager) {
      await manager.disconnectAll();
    }
  });

  it('should use round-robin strategy by default', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config: createTestConfig({ poolSize: 3 }),
    });

    await manager.connect('test-server');

    const context = (manager as any).connections.get('test-server');
    expect(context.pool.strategy).toBe('round-robin');
  });

  it('should cycle through connections in round-robin order', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config: createTestConfig({ poolSize: 3 }),
    });

    await manager.connect('test-server');

    // Pre-populate pool with connections and release them
    const conn1 = await manager.acquirePooledConnection('test-server');
    const conn2 = await manager.acquirePooledConnection('test-server');
    const conn3 = await manager.acquirePooledConnection('test-server');

    manager.releasePooledConnection('test-server', conn1.id);
    manager.releasePooledConnection('test-server', conn2.id);
    manager.releasePooledConnection('test-server', conn3.id);

    // Now acquire in round-robin order
    const acquire1 = await manager.acquirePooledConnection('test-server');
    manager.releasePooledConnection('test-server', acquire1.id);

    const acquire2 = await manager.acquirePooledConnection('test-server');
    manager.releasePooledConnection('test-server', acquire2.id);

    const acquire3 = await manager.acquirePooledConnection('test-server');

    // Should cycle through different connections
    const ids = new Set([acquire1.id, acquire2.id, acquire3.id]);
    expect(ids.size).toBe(3); // All three should be different
  });
});

describe('MCPConnectionManager - Pool Lifecycle Management', () => {
  let manager: MCPConnectionManager;
  let config: ApexConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = createTestConfig({ poolSize: 3 });
  });

  afterEach(async () => {
    if (manager) {
      await manager.disconnectAll();
    }
  });

  it('should clean up pool on disconnect', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    await manager.connect('test-server');

    // Create some pooled connections
    const conn1 = await manager.acquirePooledConnection('test-server');
    const conn2 = await manager.acquirePooledConnection('test-server');

    const context = (manager as any).connections.get('test-server');
    expect(context.pool.connections.size).toBe(2);

    // Disconnect should clean up pool
    await manager.disconnect('test-server');

    // Connection should be removed
    const contextAfter = (manager as any).connections.get('test-server');
    expect(contextAfter).toBeUndefined();
  });

  it('should emit poolChange events correctly', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    const poolChangeSpy = vi.fn();
    manager.on('poolChange', poolChangeSpy);

    await manager.connect('test-server');

    // Acquire connections and verify events
    const conn1 = await manager.acquirePooledConnection('test-server');
    expect(poolChangeSpy).toHaveBeenCalledWith('test-server', 1, 1); // 1 total, 1 active

    const conn2 = await manager.acquirePooledConnection('test-server');
    expect(poolChangeSpy).toHaveBeenCalledWith('test-server', 2, 2); // 2 total, 2 active

    // Release one connection
    manager.releasePooledConnection('test-server', conn1.id);
    expect(poolChangeSpy).toHaveBeenCalledWith('test-server', 2, 1); // 2 total, 1 active
  });

  it('should track connection usage metrics', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    await manager.connect('test-server');

    const conn = await manager.acquirePooledConnection('test-server');

    expect(conn.requestCount).toBe(1);
    expect(conn.lastUsedAt).toBeInstanceOf(Date);
    expect(conn.createdAt).toBeInstanceOf(Date);
    expect(conn.connection.serverId).toBe('test-server');
    expect(conn.connection.state).toBe('connected');

    // Release and acquire again to verify request count increment
    manager.releasePooledConnection('test-server', conn.id);
    const connAgain = await manager.acquirePooledConnection('test-server');

    expect(connAgain.id).toBe(conn.id); // Same connection
    expect(connAgain.requestCount).toBe(2); // Incremented
  });
});

describe('MCPConnectionManager - Pool Error Handling', () => {
  let manager: MCPConnectionManager;
  let config: ApexConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = createTestConfig({ poolSize: 2 });
  });

  afterEach(async () => {
    if (manager) {
      await manager.disconnectAll();
    }
  });

  it('should handle connection creation failures gracefully', async () => {
    // Mock client creation to fail
    const { MCPClient } = await import('./client.js');
    vi.mocked(MCPClient).mockImplementationOnce(() => ({
      connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
      disconnect: vi.fn().mockResolvedValue(undefined),
    } as any));

    manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    await manager.connect('test-server');

    // Acquiring pooled connection should fail gracefully
    await expect(manager.acquirePooledConnection('test-server')).rejects.toThrow('Connection failed');
  });

  it('should handle pool cleanup errors gracefully', async () => {
    // Mock disconnect to fail
    const { MCPClient } = await import('./client.js');
    vi.mocked(MCPClient).mockImplementation(({ transport }) => ({
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockRejectedValue(new Error('Disconnect failed')),
      listTools: vi.fn().mockResolvedValue([]),
      callTool: vi.fn().mockResolvedValue({}),
    } as any));

    manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    await manager.connect('test-server');
    await manager.acquirePooledConnection('test-server');

    // Disconnect should handle cleanup errors gracefully (logged but not thrown)
    await expect(manager.disconnect('test-server')).resolves.not.toThrow();
  });
});