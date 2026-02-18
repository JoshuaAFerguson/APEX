import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { MCPConnectionManager, type MCPConnectionManagerOptions } from './connection-manager.js';
import type { ApexConfig, MCPConnectionConfig } from '@apexcli/core';

// Mock the core module
vi.mock('@apexcli/core', () => ({
  ExponentialBackoffReconnector: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    notifyConnected: vi.fn(),
    notifyDisconnected: vi.fn(),
    notifyConnectionFailed: vi.fn(),
    scheduleReconnect: vi.fn(),
    isExhausted: vi.fn(() => false),
    destroy: vi.fn(),
  })),
}));

// Mock the transport
const mockTransport = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  send: vi.fn(),
  on: vi.fn(),
  emit: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
};

// Mock the client
const createMockClient = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  listTools: vi.fn().mockResolvedValue([]),
  callTool: vi.fn().mockResolvedValue({}),
  ping: vi.fn().mockResolvedValue(undefined), // Mock heartbeat ping
  transport: mockTransport,
});

// Mock the transport creation
vi.mock('./transports/index.js', () => ({
  StdioTransport: vi.fn().mockImplementation(() => mockTransport),
}));

// Mock the client creation
vi.mock('./client.js', () => ({
  MCPClient: vi.fn().mockImplementation(createMockClient),
}));

describe('MCPConnectionManager - Heartbeat/Ping-Pong Protocol', () => {
  let manager: MCPConnectionManager;
  let baseConfig: ApexConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    baseConfig = {
      mcp: {
        enabled: true,
        servers: {
          'heartbeat-server': {
            name: 'Heartbeat Test Server',
            type: 'stdio' as const,
            command: 'test-heartbeat',
          },
        },
        connection: {
          heartbeatEnabled: true,
          heartbeatIntervalMs: 1000,
          healthCheckIntervalMs: 1000,
          healthCheckTimeoutMs: 500,
          healthCheckFailureThreshold: 3,
          autoReconnect: true,
        } as MCPConnectionConfig,
      },
    } as ApexConfig;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Heartbeat Configuration', () => {
    it('should enable heartbeat when heartbeatEnabled is true', () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config: baseConfig,
      });

      const connectionConfig = (manager as any).connectionConfig;
      expect(connectionConfig.heartbeatEnabled).toBe(true);
      expect(connectionConfig.heartbeatIntervalMs).toBe(1000);
    });

    it('should disable heartbeat when heartbeatEnabled is false', () => {
      const configWithoutHeartbeat = {
        ...baseConfig,
        mcp: {
          ...baseConfig.mcp!,
          connection: {
            ...baseConfig.mcp!.connection,
            heartbeatEnabled: false,
          },
        },
      };

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config: configWithoutHeartbeat,
      });

      const connectionConfig = (manager as any).connectionConfig;
      expect(connectionConfig.heartbeatEnabled).toBe(false);
    });

    it('should apply default heartbeat configuration values', () => {
      const configMinimal: ApexConfig = {
        mcp: {
          enabled: true,
          servers: {
            'test-server': {
              type: 'stdio' as const,
              command: 'test',
            },
          },
        },
      };

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config: configMinimal,
      });

      const connectionConfig = (manager as any).connectionConfig;
      expect(connectionConfig.heartbeatEnabled).toBe(true); // default
      expect(connectionConfig.heartbeatIntervalMs).toBe(30000); // default
    });
  });

  describe('Ping Health Checks', () => {
    beforeEach(async () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config: baseConfig,
      });
    });

    it('should use ping for health checks when heartbeat is enabled', async () => {
      const healthCheckSpy = vi.fn();
      manager.on('healthCheck', healthCheckSpy);

      // Connect to server
      await manager.connect('heartbeat-server');

      // Get the mock client to verify ping is called
      const context = (manager as any).connections.get('heartbeat-server');
      const pingMock = context.client.ping;
      const listToolsMock = context.client.listTools;

      // Reset mock call counts
      pingMock.mockClear();
      listToolsMock.mockClear();

      // Advance timers to trigger health check
      vi.advanceTimersByTime(1200);
      await vi.runAllTimersAsync();

      // Should have called ping (not listTools) for health check
      expect(pingMock).toHaveBeenCalled();
      expect(listToolsMock).not.toHaveBeenCalled();

      // Should have recorded successful health check
      expect(healthCheckSpy).toHaveBeenCalledWith(
        'heartbeat-server',
        expect.objectContaining({
          success: true,
          isHealthy: true,
          consecutiveFailures: 0,
        }),
      );
    });

    it('should update lastPingAt timestamp when sending ping', async () => {
      await manager.connect('heartbeat-server');

      const context = (manager as any).connections.get('heartbeat-server');
      const initialPingAt = context.health.lastPingAt;

      // Advance time and trigger health check
      vi.advanceTimersByTime(1200);
      await vi.runAllTimersAsync();

      // Should have updated ping timestamp
      expect(context.health.lastPingAt).toBeDefined();
      expect(context.health.lastPingAt).not.toEqual(initialPingAt);
    });

    it('should update lastPongAt timestamp on successful ping response', async () => {
      await manager.connect('heartbeat-server');

      const context = (manager as any).connections.get('heartbeat-server');

      // Advance time and trigger health check
      vi.advanceTimersByTime(1200);
      await vi.runAllTimersAsync();

      // Should have updated pong timestamp
      expect(context.health.lastPongAt).toBeDefined();
      expect(context.health.usingHeartbeat).toBe(true);
    });
  });

  describe('Pong Timeout Detection', () => {
    beforeEach(async () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config: baseConfig,
      });
    });

    it('should detect timeout when ping takes too long to respond', async () => {
      const healthCheckSpy = vi.fn();
      const errorSpy = vi.fn();

      manager.on('healthCheck', healthCheckSpy);
      manager.on('error', errorSpy);

      await manager.connect('heartbeat-server');

      const context = (manager as any).connections.get('heartbeat-server');

      // Mock ping to hang longer than timeout
      context.client.ping.mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(resolve, 1000); // Longer than healthCheckTimeoutMs (500ms)
        })
      );

      // Advance time to trigger health check
      vi.advanceTimersByTime(1200);
      await vi.runAllTimersAsync();

      // Should have recorded a failed health check due to timeout
      expect(healthCheckSpy).toHaveBeenCalledWith(
        'heartbeat-server',
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Health check timeout',
          }),
          consecutiveFailures: 1,
        }),
      );
    });

    it('should handle consecutive ping timeouts and mark connection unhealthy', async () => {
      const healthCheckSpy = vi.fn();
      const stateChangeSpy = vi.fn();

      manager.on('healthCheck', healthCheckSpy);
      manager.on('stateChange', stateChangeSpy);

      await manager.connect('heartbeat-server');

      const context = (manager as any).connections.get('heartbeat-server');

      // Mock ping to always timeout
      context.client.ping.mockImplementation(() =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Ping timeout')), 1000);
        })
      );

      // Trigger multiple failed health checks
      for (let i = 1; i <= 3; i++) {
        vi.advanceTimersByTime(1200);
        await vi.runAllTimersAsync();

        expect(healthCheckSpy).toHaveBeenCalledWith(
          'heartbeat-server',
          expect.objectContaining({
            success: false,
            consecutiveFailures: i,
          }),
        );
      }

      // After 3 failures (threshold), should mark connection as unhealthy
      const healthState = manager.getHealth('heartbeat-server');
      expect(healthState?.isHealthy).toBe(false);
      expect(healthState?.consecutiveFailures).toBe(3);
    });

    it('should reset consecutive failures on successful ping after timeout', async () => {
      const healthCheckSpy = vi.fn();

      manager.on('healthCheck', healthCheckSpy);

      await manager.connect('heartbeat-server');

      const context = (manager as any).connections.get('heartbeat-server');

      // First ping fails
      context.client.ping.mockRejectedValueOnce(new Error('Timeout'));

      vi.advanceTimersByTime(1200);
      await vi.runAllTimersAsync();

      expect(healthCheckSpy).toHaveBeenCalledWith(
        'heartbeat-server',
        expect.objectContaining({
          success: false,
          consecutiveFailures: 1,
        }),
      );

      // Reset ping to succeed
      context.client.ping.mockResolvedValue(undefined);

      vi.advanceTimersByTime(1200);
      await vi.runAllTimersAsync();

      // Should reset consecutive failures
      expect(healthCheckSpy).toHaveBeenCalledWith(
        'heartbeat-server',
        expect.objectContaining({
          success: true,
          consecutiveFailures: 0,
        }),
      );

      const healthState = manager.getHealth('heartbeat-server');
      expect(healthState?.consecutiveFailures).toBe(0);
      expect(healthState?.isHealthy).toBe(true);
    });
  });

  describe('Health State Tracking', () => {
    beforeEach(async () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config: baseConfig,
      });
    });

    it('should track heartbeat health state properly', async () => {
      await manager.connect('heartbeat-server');

      const healthState = manager.getHealth('heartbeat-server');

      expect(healthState).toBeDefined();
      expect(healthState?.usingHeartbeat).toBe(true);
      expect(healthState?.isHealthy).toBe(true);
      expect(healthState?.consecutiveFailures).toBe(0);
      expect(healthState?.latencyHistory).toEqual([]);
    });

    it('should track ping/pong timestamps', async () => {
      await manager.connect('heartbeat-server');

      // Trigger a health check
      vi.advanceTimersByTime(1200);
      await vi.runAllTimersAsync();

      const healthState = manager.getHealth('heartbeat-server');

      expect(healthState?.lastPingAt).toBeDefined();
      expect(healthState?.lastPongAt).toBeDefined();
      expect(healthState?.lastHealthyAt).toBeDefined();
      expect(healthState?.lastCheckAt).toBeDefined();
    });

    it('should track response latency for heartbeat pings', async () => {
      await manager.connect('heartbeat-server');

      const context = (manager as any).connections.get('heartbeat-server');

      // Mock ping with slight delay to create measurable latency
      context.client.ping.mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(resolve, 50); // 50ms simulated latency
        })
      );

      vi.advanceTimersByTime(1200);
      await vi.runAllTimersAsync();

      const healthState = manager.getHealth('heartbeat-server');

      expect(healthState?.latencyHistory.length).toBeGreaterThan(0);
      expect(healthState?.averageLatencyMs).toBeGreaterThan(0);
    });

    it('should maintain rolling latency history (last 10 checks)', async () => {
      await manager.connect('heartbeat-server');

      // Perform 15 health checks to test rolling history
      for (let i = 0; i < 15; i++) {
        vi.advanceTimersByTime(1200);
        await vi.runAllTimersAsync();
      }

      const healthState = manager.getHealth('heartbeat-server');

      // Should keep only last 10 latency measurements
      expect(healthState?.latencyHistory.length).toBe(10);
    });
  });

  describe('Configurable Ping Interval', () => {
    it('should respect custom heartbeat interval', async () => {
      const customConfig = {
        ...baseConfig,
        mcp: {
          ...baseConfig.mcp!,
          connection: {
            ...baseConfig.mcp!.connection,
            heartbeatIntervalMs: 2000, // 2 second interval
            healthCheckIntervalMs: 2000,
          },
        },
      };

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config: customConfig,
      });

      const healthCheckSpy = vi.fn();
      manager.on('healthCheck', healthCheckSpy);

      await manager.connect('heartbeat-server');

      // Advance by 1 second - should not trigger health check yet
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(healthCheckSpy).not.toHaveBeenCalled();

      // Advance by another 1.2 seconds - should trigger health check
      vi.advanceTimersByTime(1200);
      await vi.runAllTimersAsync();

      expect(healthCheckSpy).toHaveBeenCalled();
    });

    it('should use separate intervals for heartbeat and health checks if configured differently', async () => {
      const customConfig = {
        ...baseConfig,
        mcp: {
          ...baseConfig.mcp!,
          connection: {
            ...baseConfig.mcp!.connection,
            heartbeatIntervalMs: 5000, // Different from healthCheckIntervalMs
            healthCheckIntervalMs: 1000,
          },
        },
      };

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config: customConfig,
      });

      const connectionConfig = (manager as any).connectionConfig;
      expect(connectionConfig.heartbeatIntervalMs).toBe(5000);
      expect(connectionConfig.healthCheckIntervalMs).toBe(1000);
    });
  });

  describe('Heartbeat vs ListTools Fallback', () => {
    it('should fallback to listTools when heartbeat is disabled', async () => {
      const configWithoutHeartbeat = {
        ...baseConfig,
        mcp: {
          ...baseConfig.mcp!,
          connection: {
            ...baseConfig.mcp!.connection,
            heartbeatEnabled: false,
          },
        },
      };

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config: configWithoutHeartbeat,
      });

      const healthCheckSpy = vi.fn();
      manager.on('healthCheck', healthCheckSpy);

      await manager.connect('heartbeat-server');

      const context = (manager as any).connections.get('heartbeat-server');
      const pingMock = context.client.ping;
      const listToolsMock = context.client.listTools;

      // Reset mock call counts
      pingMock.mockClear();
      listToolsMock.mockClear();

      // Advance timers to trigger health check
      vi.advanceTimersByTime(1200);
      await vi.runAllTimersAsync();

      // Should use listTools instead of ping
      expect(listToolsMock).toHaveBeenCalled();
      expect(pingMock).not.toHaveBeenCalled();

      // Health state should reflect non-heartbeat mode
      const healthState = manager.getHealth('heartbeat-server');
      expect(healthState?.usingHeartbeat).toBe(false);
    });
  });

  describe('Health Check Integration with Reconnection', () => {
    beforeEach(async () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config: baseConfig,
      });
    });

    it('should trigger reconnection when heartbeat health checks fail threshold', async () => {
      const stateChangeSpy = vi.fn();
      manager.on('stateChange', stateChangeSpy);

      await manager.connect('heartbeat-server');

      const context = (manager as any).connections.get('heartbeat-server');

      // Mock ping to consistently fail
      context.client.ping.mockRejectedValue(new Error('Ping failed'));

      // Trigger health check failures up to threshold (3)
      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(1200);
        await vi.runAllTimersAsync();
      }

      // Should have triggered state change to disconnected
      expect(stateChangeSpy).toHaveBeenCalledWith(
        'heartbeat-server',
        'connected',
        'disconnected'
      );

      const healthState = manager.getHealth('heartbeat-server');
      expect(healthState?.isHealthy).toBe(false);
    });

    it('should cleanup health monitoring timers on disconnect', async () => {
      await manager.connect('heartbeat-server');

      const context = (manager as any).connections.get('heartbeat-server');
      expect(context.health.healthCheckTimer).toBeDefined();

      await manager.disconnect('heartbeat-server');

      // Timer should be cleaned up
      expect(context.health.healthCheckTimer).toBeUndefined();
    });
  });

  describe('Manual Health Check with Heartbeat', () => {
    beforeEach(async () => {
      manager = new MCPConnectionManager({
        projectPath: '/test',
        config: baseConfig,
      });
    });

    it('should perform manual heartbeat health check', async () => {
      await manager.connect('heartbeat-server');

      const context = (manager as any).connections.get('heartbeat-server');
      const pingMock = context.client.ping;
      pingMock.mockClear();

      // Perform manual health check
      const result = await manager.checkHealth('heartbeat-server');

      expect(pingMock).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.isHealthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle manual health check timeout', async () => {
      await manager.connect('heartbeat-server');

      const context = (manager as any).connections.get('heartbeat-server');

      // Mock ping to timeout
      context.client.ping.mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(resolve, 1000); // Longer than timeout
        })
      );

      // Should reject due to timeout
      const result = await manager.checkHealth('heartbeat-server');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Health check timeout');
    });
  });
});