/**
 * MCPConnectionManager Enhanced Features Tests
 *
 * Tests for the enhanced MCPConnectionManager features:
 * - Health check monitoring
 * - Connection pooling
 * - Enhanced metrics tracking
 * - New configuration options
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { ApexConfig, MCPConnectionConfig } from '@apexcli/core';
import {
  MCPConnectionManager,
  type MCPConnectionManagerOptions,
  type HealthCheckResult,
  type ConnectionMetrics,
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
    _eventEmitter: emitter, // Expose for manual event triggering
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
      poolSize: 1,
      poolMinSize: 0,
      healthCheckIntervalMs: 1000, // Fast for testing
      healthCheckTimeoutMs: 500,
      healthCheckFailureThreshold: 2,
      autoReconnect: true,
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

describe('MCPConnectionManager - Health Checks', () => {
  let manager: MCPConnectionManager;
  let config: ApexConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    config = createTestConfig();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start health monitoring when connection is established', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    const healthCheckSpy = vi.fn();
    manager.on('healthCheck', healthCheckSpy);

    // Connect to server
    await manager.connect('test-server');

    // Fast-forward to trigger health check
    vi.advanceTimersByTime(1000);
    await vi.runAllTimersAsync();

    // Should have performed a health check
    expect(healthCheckSpy).toHaveBeenCalledWith(
      'test-server',
      expect.objectContaining({
        success: true,
        isHealthy: true,
        consecutiveFailures: 0,
      })
    );
  });

  it('should handle health check failures correctly', async () => {
    const configWithFailingHealthChecks = createTestConfig({
      healthCheckFailureThreshold: 1, // Fail after 1 failure
    });

    manager = new MCPConnectionManager({
      projectPath: '/test',
      config: configWithFailingHealthChecks,
    });

    const healthCheckSpy = vi.fn();
    const stateChangeSpy = vi.fn();
    manager.on('healthCheck', healthCheckSpy);
    manager.on('stateChange', stateChangeSpy);

    // Connect to server
    await manager.connect('test-server');

    // Mock client to fail health checks
    const context = (manager as any).connections.get('test-server');
    context.client.listTools.mockRejectedValue(new Error('Health check failed'));

    // Fast-forward to trigger health check
    vi.advanceTimersByTime(1000);
    await vi.runAllTimersAsync();

    // Should have performed a health check that failed
    expect(healthCheckSpy).toHaveBeenCalledWith(
      'test-server',
      expect.objectContaining({
        success: false,
        isHealthy: false,
        consecutiveFailures: 1,
        error: expect.any(Error),
      })
    );

    // Should trigger state change to disconnected
    expect(stateChangeSpy).toHaveBeenCalledWith('test-server', 'connected', 'disconnected');
  });

  it('should provide manual health check functionality', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    await manager.connect('test-server');

    const result = await manager.checkHealth('test-server');

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        isHealthy: true,
        consecutiveFailures: 0,
        latencyMs: expect.any(Number),
        timestamp: expect.any(Date),
      })
    );
  });

  it('should track health state correctly', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    await manager.connect('test-server');

    const healthState = manager.getHealth('test-server');
    expect(healthState).toBeDefined();
    expect(healthState?.isHealthy).toBe(true);
    expect(healthState?.consecutiveFailures).toBe(0);
  });
});

describe('MCPConnectionManager - Connection Pooling', () => {
  let manager: MCPConnectionManager;
  let config: ApexConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = createTestConfig({
      poolSize: 3, // Enable pooling
      poolMinSize: 1,
    });
  });

  it('should initialize connection pool when poolSize > 1', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    await manager.connect('test-server');

    const context = (manager as any).connections.get('test-server');
    expect(context.pool).toBeDefined();
    expect(context.pool?.config.maxConnections).toBe(3);
    expect(context.pool?.config.minConnections).toBe(1);
  });

  it('should not initialize connection pool when poolSize = 1', async () => {
    const configNoPool = createTestConfig({ poolSize: 1 });
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config: configNoPool,
    });

    await manager.connect('test-server');

    const context = (manager as any).connections.get('test-server');
    expect(context.pool).toBeUndefined();
  });

  it('should throw error when trying to acquire pooled connection without pool', async () => {
    const configNoPool = createTestConfig({ poolSize: 1 });
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config: configNoPool,
    });

    await manager.connect('test-server');

    await expect(manager.acquirePooledConnection('test-server')).rejects.toThrow(
      'Connection pooling is not enabled'
    );
  });

  it('should emit poolChange events', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    const poolChangeSpy = vi.fn();
    manager.on('poolChange', poolChangeSpy);

    await manager.connect('test-server');

    // Acquire a pooled connection (this will create one since pool starts empty)
    await manager.acquirePooledConnection('test-server');

    expect(poolChangeSpy).toHaveBeenCalledWith('test-server', 1, 1);
  });
});

describe('MCPConnectionManager - Enhanced Metrics', () => {
  let manager: MCPConnectionManager;
  let config: ApexConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = createTestConfig();
  });

  it('should track connection metrics', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    await manager.connect('test-server');

    const metrics = manager.getMetrics('test-server');
    expect(metrics).toBeDefined();
    expect(metrics?.totalConnections).toBe(1);
    expect(metrics?.totalReconnections).toBe(0);
    expect(metrics?.connectedAt).toBeInstanceOf(Date);
    expect(metrics?.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should update metrics on reconnection', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    await manager.connect('test-server');

    // Simulate a disconnection and reconnection
    const context = (manager as any).connections.get('test-server');
    context.connection.reconnectAttempts = 1;
    context.metrics.totalReconnections = 1;

    const metrics = manager.getMetrics('test-server');
    expect(metrics?.totalReconnections).toBe(1);
  });

  it('should track error metrics', async () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    await manager.connect('test-server');

    // Simulate an error in health check
    const context = (manager as any).connections.get('test-server');
    context.metrics.totalErrors = 1;
    context.metrics.lastError = {
      message: 'Test error',
      timestamp: new Date(),
      code: 'TEST_ERROR',
    };

    const metrics = manager.getMetrics('test-server');
    expect(metrics?.totalErrors).toBe(1);
    expect(metrics?.lastError?.message).toBe('Test error');
  });

  it('should return undefined metrics for non-existent connection', () => {
    manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    const metrics = manager.getMetrics('non-existent');
    expect(metrics).toBeUndefined();
  });
});

describe('MCPConnectionManager - Configuration Integration', () => {
  it('should use configuration defaults correctly', () => {
    const config = createTestConfig();
    const manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
    });

    // Access private connectionConfig for testing
    const connectionConfig = (manager as any).connectionConfig;
    expect(connectionConfig.maxRetries).toBe(2);
    expect(connectionConfig.healthCheckIntervalMs).toBe(1000);
    expect(connectionConfig.poolSize).toBe(1);
  });

  it('should allow override of connection configuration', () => {
    const config = createTestConfig();
    const customConnectionConfig = {
      maxRetries: 5,
      healthCheckIntervalMs: 2000,
      poolSize: 4,
    };

    const manager = new MCPConnectionManager({
      projectPath: '/test',
      config,
      connectionConfig: customConnectionConfig,
    });

    const connectionConfig = (manager as any).connectionConfig;
    expect(connectionConfig.maxRetries).toBe(5);
    expect(connectionConfig.healthCheckIntervalMs).toBe(2000);
    expect(connectionConfig.poolSize).toBe(4);
  });

  it('should handle missing mcp configuration gracefully', () => {
    const configWithoutMcp: ApexConfig = {
      projectName: 'test-project',
      projectDescription: 'Test project',
      version: '1.0.0',
    };

    expect(() => {
      new MCPConnectionManager({
        projectPath: '/test',
        config: configWithoutMcp,
      });
    }).not.toThrow();
  });
});