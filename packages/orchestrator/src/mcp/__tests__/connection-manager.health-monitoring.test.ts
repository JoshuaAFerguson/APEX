/**
 * Health Monitoring and Heartbeat Tests for MCPConnectionManager
 *
 * This test suite covers the health monitoring and heartbeat functionality:
 * - Health check execution and timing
 * - Heartbeat ping/pong protocol
 * - Health state tracking and statistics
 * - Health-based reconnection triggers
 * - Health check event emission
 * - Integration with unified health manager
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { ApexConfig, MCPServerConfig, MCPConnectionConfig } from '@apexcli/core';
import {
  MCPConnectionManager,
  type MCPConnectionManagerOptions,
  type HealthCheckResult,
  type HealthState,
} from '../connection-manager.js';

// ============================================================================
// Mock Setup
// ============================================================================

class MockTransport extends EventEmitter {
  public isConnectedState = false;
  public shouldDisconnect = false;

  async connect(): Promise<void> {
    this.isConnectedState = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    if (this.isConnectedState) {
      this.isConnectedState = false;
      this.emit('disconnected', 'Manual disconnect');
    }
  }

  simulateUnexpectedDisconnection(reason = 'Unexpected disconnection'): void {
    if (this.isConnectedState) {
      this.isConnectedState = false;
      this.emit('disconnected', reason);
    }
  }

  isConnected(): boolean {
    return this.isConnectedState;
  }

  reset(): void {
    this.isConnectedState = false;
    this.shouldDisconnect = false;
    this.removeAllListeners();
  }
}

class MockClient extends EventEmitter {
  public shouldFailPing = false;
  public shouldFailListTools = false;
  public pingLatency = 50;
  public listToolsLatency = 100;
  public transport: MockTransport;
  public pingCount = 0;
  public listToolsCount = 0;

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
    this.pingCount++;

    if (this.shouldFailPing) {
      throw new Error('Mock client ping failed');
    }

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, this.pingLatency));
    return { pong: true };
  }

  async listTools(): Promise<any[]> {
    this.listToolsCount++;

    if (this.shouldFailListTools) {
      throw new Error('Mock client listTools failed');
    }

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, this.listToolsLatency));
    return [
      { name: 'test-tool', description: 'A test tool' }
    ];
  }

  // Test helpers
  setFailPing(fail: boolean): void {
    this.shouldFailPing = fail;
  }

  setFailListTools(fail: boolean): void {
    this.shouldFailListTools = fail;
  }

  setPingLatency(ms: number): void {
    this.pingLatency = ms;
  }

  setListToolsLatency(ms: number): void {
    this.listToolsLatency = ms;
  }

  getPingCount(): number {
    return this.pingCount;
  }

  getListToolsCount(): number {
    return this.listToolsCount;
  }

  reset(): void {
    this.shouldFailPing = false;
    this.shouldFailListTools = false;
    this.pingLatency = 50;
    this.listToolsLatency = 100;
    this.pingCount = 0;
    this.listToolsCount = 0;
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
    description: 'Test project for health monitoring',
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
      healthCheckIntervalMs: 5000, // 5 seconds for testing
      healthCheckTimeoutMs: 2000,  // 2 seconds for testing
      healthCheckFailureThreshold: 3,
      autoReconnect: true,
      keepAlive: true,
      keepAliveIntervalMs: 15000,
      heartbeatEnabled: true,
      heartbeatIntervalMs: 3000,   // 3 seconds for testing
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

interface EventCapture<T = any> {
  events: Array<{ event: string; args: T[]; timestamp: number }>;
  clear(): void;
  getEvents(eventName: string): Array<{ args: T[]; timestamp: number }>;
  waitForEvent(eventName: string, timeout?: number): Promise<T[]>;
  getEventCount(eventName: string): number;
}

const createEventCapture = <T = any>(emitter: EventEmitter): EventCapture<T> => {
  const events: Array<{ event: string; args: T[]; timestamp: number }> = [];

  const originalEmit = emitter.emit.bind(emitter);
  emitter.emit = function(event: string, ...args: T[]) {
    events.push({ event, args, timestamp: Date.now() });
    return originalEmit(event, ...args);
  };

  return {
    events,
    clear() { events.length = 0; },
    getEvents(eventName: string) {
      return events.filter(e => e.event === eventName).map(e => ({ args: e.args, timestamp: e.timestamp }));
    },
    getEventCount(eventName: string) {
      return events.filter(e => e.event === eventName).length;
    },
    async waitForEvent(eventName: string, timeout = 5000) {
      return new Promise<T[]>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Event ${eventName} not received within ${timeout}ms`));
        }, timeout);

        const check = () => {
          const matchingEvents = events.filter(e => e.event === eventName);
          if (matchingEvents.length > 0) {
            clearTimeout(timer);
            resolve(matchingEvents[matchingEvents.length - 1].args);
          } else {
            setTimeout(check, 10);
          }
        };
        check();
      });
    }
  };
};

// ============================================================================
// Test Suite
// ============================================================================

describe('MCPConnectionManager - Health Monitoring', () => {
  let manager: MCPConnectionManager;
  let mockTransport: MockTransport;
  let mockClient: MockClient;
  let eventCapture: EventCapture;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

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
    vi.useRealTimers();
    mockTransport?.reset();
    mockClient?.reset();
  });

  // ==========================================================================
  // Health Check Execution Tests
  // ==========================================================================

  describe('Health Check Execution', () => {
    it('should perform successful health checks using ping when heartbeat enabled', async () => {
      const config = createTestConfig({
        'heartbeat-server': {
          name: 'Heartbeat Server',
          type: 'stdio',
          command: 'node',
        },
      }, {
        heartbeatEnabled: true,
        healthCheckIntervalMs: 1000
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      await manager.connect('heartbeat-server');

      const result = await manager.checkHealth('heartbeat-server');

      expect(result.success).toBe(true);
      expect(result.isHealthy).toBe(true);
      expect(typeof result.latencyMs).toBe('number');
      expect(result.latencyMs).toBeGreaterThan(0);
      expect(result.consecutiveFailures).toBe(0);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.error).toBeUndefined();

      // Verify ping was called, not listTools
      expect(mockClient.getPingCount()).toBe(1);
      expect(mockClient.getListToolsCount()).toBe(0);
    });

    it('should perform health checks using listTools when heartbeat disabled', async () => {
      const config = createTestConfig({
        'no-heartbeat-server': {
          name: 'No Heartbeat Server',
          type: 'stdio',
          command: 'node',
        },
      }, {
        heartbeatEnabled: false,
        healthCheckIntervalMs: 1000
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('no-heartbeat-server');

      const result = await manager.checkHealth('no-heartbeat-server');

      expect(result.success).toBe(true);
      expect(result.isHealthy).toBe(true);

      // Verify listTools was called, not ping
      expect(mockClient.getListToolsCount()).toBe(1);
      expect(mockClient.getPingCount()).toBe(0);
    });

    it('should handle health check failures', async () => {
      const config = createTestConfig({
        'failing-server': {
          name: 'Failing Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);
      await manager.connect('failing-server');

      // Make ping fail
      mockClient.setFailPing(true);

      const result = await manager.checkHealth('failing-server');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Mock client ping failed');
      expect(result.consecutiveFailures).toBe(1);
      expect(result.isHealthy).toBe(true); // Still healthy after first failure

      // Health check event should be emitted
      const healthEvents = eventCapture.getEvents('healthCheck');
      expect(healthEvents).toHaveLength(1);
      expect(healthEvents[0].args[0]).toBe('failing-server');
      expect(healthEvents[0].args[1]).toMatchObject({
        success: false,
        error: expect.any(Error),
      });
    });

    it('should handle health check timeouts', async () => {
      const config = createTestConfig({
        'slow-server': {
          name: 'Slow Server',
          type: 'stdio',
          command: 'node',
        },
      }, {
        healthCheckTimeoutMs: 100, // Very short timeout
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('slow-server');

      // Make ping very slow
      mockClient.setPingLatency(200); // Longer than timeout

      const startTime = Date.now();
      const result = await manager.checkHealth('slow-server');
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Health check timeout');
      expect(elapsed).toBeLessThan(150); // Should timeout quickly
    });

    it('should track consecutive failures', async () => {
      const config = createTestConfig({
        'consecutive-fail-server': {
          name: 'Consecutive Fail Server',
          type: 'stdio',
          command: 'node',
        },
      }, {
        healthCheckFailureThreshold: 3,
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('consecutive-fail-server');

      // Make ping fail
      mockClient.setFailPing(true);

      // First failure
      let result = await manager.checkHealth('consecutive-fail-server');
      expect(result.success).toBe(false);
      expect(result.consecutiveFailures).toBe(1);
      expect(result.isHealthy).toBe(true); // Still healthy

      // Second failure
      result = await manager.checkHealth('consecutive-fail-server');
      expect(result.success).toBe(false);
      expect(result.consecutiveFailures).toBe(2);
      expect(result.isHealthy).toBe(true); // Still healthy

      // Third failure - should mark as unhealthy
      result = await manager.checkHealth('consecutive-fail-server');
      expect(result.success).toBe(false);
      expect(result.consecutiveFailures).toBe(3);
      expect(result.isHealthy).toBe(false); // Now unhealthy
    });
  });

  // ==========================================================================
  // Health State Tracking Tests
  // ==========================================================================

  describe('Health State Tracking', () => {
    it('should initialize health state correctly', async () => {
      const config = createTestConfig({
        'state-server': {
          name: 'State Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('state-server');

      const health = manager.getHealth('state-server');

      expect(health).toBeDefined();
      expect(health!.isHealthy).toBe(true);
      expect(health!.consecutiveFailures).toBe(0);
      expect(health!.averageLatencyMs).toBe(0);
      expect(health!.latencyHistory).toEqual([]);
      expect(health!.usingHeartbeat).toBe(true); // Default config enables heartbeat
    });

    it('should update latency history and average', async () => {
      const config = createTestConfig({
        'latency-server': {
          name: 'Latency Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('latency-server');

      // Set different latencies for multiple checks
      const latencies = [50, 100, 75, 200, 25];

      for (const latency of latencies) {
        mockClient.setPingLatency(latency);
        await manager.checkHealth('latency-server');
      }

      const health = manager.getHealth('latency-server');

      expect(health).toBeDefined();
      expect(health!.latencyHistory).toHaveLength(5);
      expect(health!.averageLatencyMs).toBe(90); // Average of latencies

      // Should track last successful check times
      expect(health!.lastHealthyAt).toBeInstanceOf(Date);
      expect(health!.lastCheckAt).toBeInstanceOf(Date);
    });

    it('should limit latency history to last 10 entries', async () => {
      const config = createTestConfig({
        'history-server': {
          name: 'History Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('history-server');

      // Perform 15 health checks
      for (let i = 0; i < 15; i++) {
        mockClient.setPingLatency(i * 10); // Varying latencies
        await manager.checkHealth('history-server');
      }

      const health = manager.getHealth('history-server');

      expect(health).toBeDefined();
      expect(health!.latencyHistory).toHaveLength(10); // Should be capped at 10

      // Should contain the last 10 latencies (50ms to 140ms)
      const expectedLatencies = Array.from({ length: 10 }, (_, i) => (i + 5) * 10);
      expect(health!.latencyHistory).toEqual(expectedLatencies);
    });

    it('should provide unified health state', async () => {
      const config = createTestConfig({
        'unified-server': {
          name: 'Unified Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('unified-server');

      // Perform a health check first
      await manager.checkHealth('unified-server');

      const unifiedState = manager.getUnifiedHealthState('unified-server');

      expect(unifiedState).toBeDefined();
      expect(unifiedState!.connectionId).toBe('unified-server');
      expect(unifiedState!.isHealthy).toBe(true);
      expect(unifiedState!.consecutiveFailures).toBe(0);
    });

    it('should provide health statistics', async () => {
      const config = createTestConfig({
        'stats-server': {
          name: 'Stats Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('stats-server');

      // Perform multiple health checks with some failures
      await manager.checkHealth('stats-server'); // Success
      mockClient.setFailPing(true);
      await manager.checkHealth('stats-server'); // Failure
      mockClient.setFailPing(false);
      await manager.checkHealth('stats-server'); // Success

      const stats = manager.getHealthStatistics('stats-server');

      expect(stats).toBeDefined();
      expect(stats!.totalChecks).toBe(3);
      expect(stats!.successfulChecks).toBe(2);
      expect(stats!.failedChecks).toBe(1);
      expect(stats!.averageLatencyMs).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Automatic Health Monitoring Tests
  // ==========================================================================

  describe('Automatic Health Monitoring', () => {
    it('should start periodic health checks after connection', async () => {
      const config = createTestConfig({
        'periodic-server': {
          name: 'Periodic Server',
          type: 'stdio',
          command: 'node',
        },
      }, {
        healthCheckIntervalMs: 1000, // 1 second
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      await manager.connect('periodic-server');

      // Advance time to trigger health checks
      vi.advanceTimersByTime(3500); // 3.5 seconds

      // Should have triggered multiple health checks
      const healthEvents = eventCapture.getEvents('healthCheck');
      expect(healthEvents.length).toBeGreaterThanOrEqual(3); // At least 3 checks

      // All checks should be for the correct server
      healthEvents.forEach(event => {
        expect(event.args[0]).toBe('periodic-server');
      });
    });

    it('should stop periodic health checks after disconnection', async () => {
      const config = createTestConfig({
        'disconnect-server': {
          name: 'Disconnect Server',
          type: 'stdio',
          command: 'node',
        },
      }, {
        healthCheckIntervalMs: 500, // 0.5 seconds
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      await manager.connect('disconnect-server');

      // Let some health checks happen
      vi.advanceTimersByTime(1500);
      const beforeDisconnect = eventCapture.getEventCount('healthCheck');

      // Disconnect
      await manager.disconnect('disconnect-server');
      eventCapture.clear();

      // Advance time - no more health checks should occur
      vi.advanceTimersByTime(2000);
      const afterDisconnect = eventCapture.getEventCount('healthCheck');

      expect(beforeDisconnect).toBeGreaterThan(0);
      expect(afterDisconnect).toBe(0);
    });

    it('should disable health monitoring when interval is 0', async () => {
      const config = createTestConfig({
        'no-monitoring-server': {
          name: 'No Monitoring Server',
          type: 'stdio',
          command: 'node',
        },
      }, {
        healthCheckIntervalMs: 0, // Disabled
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      await manager.connect('no-monitoring-server');

      // Advance time - no health checks should occur
      vi.advanceTimersByTime(10000); // 10 seconds

      const healthEvents = eventCapture.getEvents('healthCheck');
      expect(healthEvents).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Health-Based Reconnection Tests
  // ==========================================================================

  describe('Health-Based Reconnection', () => {
    it('should trigger reconnection after health failure threshold', async () => {
      vi.useRealTimers(); // Need real timers for reconnection logic

      const config = createTestConfig({
        'reconnect-server': {
          name: 'Reconnect Server',
          type: 'stdio',
          command: 'node',
        },
      }, {
        healthCheckFailureThreshold: 2,
        autoReconnect: true,
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      await manager.connect('reconnect-server');

      // Make health checks fail to trigger reconnection
      mockClient.setFailPing(true);

      // Manually trigger health check failures
      await manager.checkHealth('reconnect-server'); // Failure 1
      await manager.checkHealth('reconnect-server'); // Failure 2 - should trigger reconnection

      const health = manager.getHealth('reconnect-server');
      expect(health?.isHealthy).toBe(false);

      // Check for state change events
      const stateEvents = eventCapture.getEvents('stateChange');
      expect(stateEvents.length).toBeGreaterThan(0);

      vi.useFakeTimers();
    });

    it('should not reconnect when auto-reconnect is disabled', async () => {
      const config = createTestConfig({
        'no-reconnect-server': {
          name: 'No Reconnect Server',
          type: 'stdio',
          command: 'node',
        },
      }, {
        healthCheckFailureThreshold: 1,
        autoReconnect: false, // Disabled
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      await manager.connect('no-reconnect-server');

      // Make health check fail
      mockClient.setFailPing(true);
      await manager.checkHealth('no-reconnect-server');

      // Should not trigger reconnection events
      const reconnectingEvents = eventCapture.getEvents('reconnecting');
      expect(reconnectingEvents).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Ping/Pong Integration Tests
  // ==========================================================================

  describe('Ping/Pong Protocol Integration', () => {
    it('should support external ping/pong notifications', async () => {
      const config = createTestConfig({
        'ping-pong-server': {
          name: 'Ping Pong Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('ping-pong-server');

      const pingId = 'test-ping-123';
      const pingTime = Date.now();

      // Notify about ping sent
      manager.notifyPingSent('ping-pong-server', pingId, pingTime);

      const health = manager.getHealth('ping-pong-server');
      expect(health?.lastPingAt).toBeInstanceOf(Date);
      expect(health?.lastPingAt?.getTime()).toBeCloseTo(pingTime, -1);

      // Notify about pong received
      const latency = 150;
      manager.notifyPongReceived('ping-pong-server', pingId, latency);

      const updatedHealth = manager.getHealth('ping-pong-server');
      expect(updatedHealth?.lastPongAt).toBeInstanceOf(Date);
      expect(updatedHealth?.latencyHistory).toContain(latency);
      expect(updatedHealth?.averageLatencyMs).toBe(latency);
    });

    it('should update heartbeat state tracking', async () => {
      const config = createTestConfig({
        'heartbeat-tracking-server': {
          name: 'Heartbeat Tracking Server',
          type: 'stdio',
          command: 'node',
        },
      }, {
        heartbeatEnabled: true,
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('heartbeat-tracking-server');

      const health = manager.getHealth('heartbeat-tracking-server');
      expect(health?.usingHeartbeat).toBe(true);

      // Perform health check using ping
      await manager.checkHealth('heartbeat-tracking-server');

      const updatedHealth = manager.getHealth('heartbeat-tracking-server');
      expect(updatedHealth?.lastPingAt).toBeInstanceOf(Date);
      expect(updatedHealth?.lastPongAt).toBeInstanceOf(Date);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Health Check Error Handling', () => {
    it('should handle health check on non-existent connection', async () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(config));

      await expect(manager.checkHealth('non-existent')).rejects.toThrow(
        "Connection 'non-existent' not found"
      );
    });

    it('should return undefined health state for non-existent connection', () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(config));

      expect(manager.getHealth('non-existent')).toBeUndefined();
      expect(manager.getUnifiedHealthState('non-existent')).toBeUndefined();
      expect(manager.getHealthStatistics('non-existent')).toBeUndefined();
    });

    it('should handle health check exceptions gracefully', async () => {
      const config = createTestConfig({
        'exception-server': {
          name: 'Exception Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('exception-server');

      // Override the client to throw unexpected exception
      const originalPing = mockClient.ping;
      mockClient.ping = vi.fn().mockRejectedValue(new Error('Unexpected ping error'));

      const result = await manager.checkHealth('exception-server');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Unexpected ping error');

      // Restore original method
      mockClient.ping = originalPing;
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Health Monitoring Integration', () => {
    it('should work correctly with connection pooling disabled', async () => {
      const config = createTestConfig({
        'health-no-pool-server': {
          name: 'Health No Pool Server',
          type: 'stdio',
          command: 'node',
        },
      }, {
        poolSize: 1, // No pooling
        healthCheckIntervalMs: 1000,
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('health-no-pool-server');

      const result = await manager.checkHealth('health-no-pool-server');
      expect(result.success).toBe(true);

      const health = manager.getHealth('health-no-pool-server');
      expect(health?.isHealthy).toBe(true);
    });

    it('should handle multiple connections with different health states', async () => {
      const config = createTestConfig({
        'healthy-server': {
          name: 'Healthy Server',
          type: 'stdio',
          command: 'node',
        },
        'unhealthy-server': {
          name: 'Unhealthy Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      // Create separate clients for each server
      const healthyTransport = new MockTransport();
      const unhealthyTransport = new MockTransport();
      const healthyClient = new MockClient({ transport: healthyTransport });
      const unhealthyClient = new MockClient({ transport: unhealthyTransport });

      // Configure unhealthy client to fail
      unhealthyClient.setFailPing(true);

      const { StdioTransport } = await import('../transports/index.js');
      const { MCPClient } = await import('../client.js');
      const MockedStdioTransport = vi.mocked(StdioTransport);
      const MockedMCPClient = vi.mocked(MCPClient);

      // Set up transport mocks to return different instances
      let transportCallCount = 0;
      MockedStdioTransport.mockImplementation(() => {
        transportCallCount++;
        return (transportCallCount === 1 ? healthyTransport : unhealthyTransport) as any;
      });

      let clientCallCount = 0;
      MockedMCPClient.mockImplementation((options: any) => {
        clientCallCount++;
        return (clientCallCount === 1 ? healthyClient : unhealthyClient) as any;
      });

      // Connect to both servers
      await manager.connect('healthy-server');
      await manager.connect('unhealthy-server');

      // Check health of both
      const healthyResult = await manager.checkHealth('healthy-server');
      const unhealthyResult = await manager.checkHealth('unhealthy-server');

      expect(healthyResult.success).toBe(true);
      expect(unhealthyResult.success).toBe(false);

      const healthyState = manager.getHealth('healthy-server');
      const unhealthyState = manager.getHealth('unhealthy-server');

      expect(healthyState?.isHealthy).toBe(true);
      expect(unhealthyState?.consecutiveFailures).toBe(1);
    });
  });
});