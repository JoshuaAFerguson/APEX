import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { MCPConnectionManager, type MCPConnectionManagerOptions } from '../connection-manager.js';
import { MCPClient } from '../client.js';
import { StdioTransport } from '../transports/stdio-transport.js';
import type { ApexConfig, MCPServerConfig } from '@apexcli/core';

// Mock the transport and client
vi.mock('../transports/stdio-transport.js');
vi.mock('../client.js');

const MockStdioTransport = vi.mocked(StdioTransport);
const MockMCPClient = vi.mocked(MCPClient);

describe('MCPConnectionManager Health Check Integration', () => {
  let connectionManager: MCPConnectionManager;
  let mockConfig: ApexConfig;
  let mockTransport: any;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Setup mock config
    mockConfig = {
      mcp: {
        enabled: true,
        servers: {
          'test-server': {
            type: 'stdio',
            command: 'test-mcp-server',
            args: ['--test'],
            name: 'Test Server',
          } as MCPServerConfig,
        },
        connection: {
          healthCheckIntervalMs: 1000,
          healthCheckTimeoutMs: 500,
          healthCheckFailureThreshold: 3,
          heartbeatEnabled: true,
          autoReconnect: true,
        },
      },
    } as ApexConfig;

    // Setup transport mock
    mockTransport = {
      on: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    MockStdioTransport.mockImplementation(() => mockTransport);

    // Setup client mock
    mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockResolvedValue([]),
      ping: vi.fn().mockResolvedValue({ pong: true }),
      on: vi.fn(),
    };
    MockMCPClient.mockImplementation(() => mockClient);

    const options: MCPConnectionManagerOptions = {
      projectPath: '/test/project',
      config: mockConfig,
    };

    connectionManager = new MCPConnectionManager(options);
  });

  afterEach(() => {
    connectionManager.disconnectAll();
    vi.useRealTimers();
  });

  describe('Health Check Integration with Unified Manager', () => {
    it('should register connection with unified health manager on connect', async () => {
      const serverId = 'test-server';

      const connection = await connectionManager.connect(serverId);

      expect(connection).toBeDefined();
      expect(connection.serverId).toBe(serverId);

      // Check that unified health state is available
      const unifiedState = connectionManager.getUnifiedHealthState(serverId);
      expect(unifiedState).toBeDefined();
      expect(unifiedState!.connectionId).toBe(serverId);
      expect(unifiedState!.isHealthy).toBe(true);
    });

    it('should perform health checks using unified manager', async () => {
      const serverId = 'test-server';
      await connectionManager.connect(serverId);

      const result = await connectionManager.checkHealth(serverId);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.isHealthy).toBe(true);
      expect(result.consecutiveFailures).toBe(0);
    });

    it('should collect health statistics through unified manager', async () => {
      const serverId = 'test-server';
      await connectionManager.connect(serverId);

      // Perform a few health checks
      await connectionManager.checkHealth(serverId);
      await connectionManager.checkHealth(serverId);
      await connectionManager.checkHealth(serverId);

      const stats = connectionManager.getHealthStatistics(serverId);
      expect(stats).toBeDefined();
      expect(stats!.totalChecks).toBeGreaterThan(0);
      expect(stats!.successfulChecks).toBeGreaterThan(0);
      expect(stats!.uptimePercentage).toBe(100);
    });

    it('should handle health check failures with unified manager', async () => {
      const serverId = 'test-server';
      let healthCheckEvents: any[] = [];

      // Mock client to fail health checks
      mockClient.ping.mockRejectedValue(new Error('Ping failed'));
      mockClient.listTools.mockRejectedValue(new Error('List tools failed'));

      connectionManager.on('healthCheck', (serverIdEvent, result) => {
        healthCheckEvents.push({ serverId: serverIdEvent, result });
      });

      await connectionManager.connect(serverId);

      const result = await connectionManager.checkHealth(serverId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.consecutiveFailures).toBe(1);
      expect(healthCheckEvents).toHaveLength(1);
    });

    it('should trigger reconnection through unified manager when threshold exceeded', async () => {
      const serverId = 'test-server';
      let reconnectAttempts = 0;

      // Mock client to always fail
      mockClient.ping.mockRejectedValue(new Error('Connection lost'));
      mockClient.listTools.mockRejectedValue(new Error('Connection lost'));

      connectionManager.on('reconnecting', (serverIdEvent) => {
        if (serverIdEvent === serverId) {
          reconnectAttempts++;
        }
      });

      await connectionManager.connect(serverId);

      // Perform health checks until failure threshold is exceeded
      for (let i = 0; i < 4; i++) {
        await connectionManager.checkHealth(serverId);
      }

      // Wait for reconnection logic to trigger
      vi.advanceTimersByTime(2000);

      expect(reconnectAttempts).toBeGreaterThan(0);
    });

    it('should integrate ping/pong notifications with unified manager', async () => {
      const serverId = 'test-server';
      let pongReceivedCount = 0;

      await connectionManager.connect(serverId);

      const unifiedState = connectionManager.getUnifiedHealthState(serverId);
      expect(unifiedState).toBeDefined();

      // Simulate external ping/pong (e.g., from transport layer)
      const pingId = 'test-ping-123';
      const timestamp = Date.now();
      const latency = 150;

      connectionManager.notifyPingSent(serverId, pingId, timestamp);
      connectionManager.notifyPongReceived(serverId, pingId, latency);

      const updatedState = connectionManager.getUnifiedHealthState(serverId);
      expect(updatedState!.lastPingAt).toBeDefined();
      expect(updatedState!.lastPongAt).toBeDefined();
      expect(updatedState!.averageLatencyMs).toBe(latency);
    });

    it('should maintain health metrics across multiple connections', async () => {
      const serverIds = ['test-server-1', 'test-server-2', 'test-server-3'];

      // Add multiple servers to config
      for (let i = 1; i <= 3; i++) {
        mockConfig.mcp!.servers![`test-server-${i}`] = {
          type: 'stdio',
          command: `test-mcp-server-${i}`,
          name: `Test Server ${i}`,
        };
      }

      // Connect all servers
      const connections = await Promise.all(
        serverIds.map(id => connectionManager.connect(id))
      );

      expect(connections).toHaveLength(3);

      // Perform health checks on all connections
      const healthResults = await Promise.all(
        serverIds.map(id => connectionManager.checkHealth(id))
      );

      healthResults.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.isHealthy).toBe(true);
      });

      // Check that each connection has independent health state
      const healthStates = serverIds.map(id => connectionManager.getUnifiedHealthState(id));
      healthStates.forEach((state, index) => {
        expect(state).toBeDefined();
        expect(state!.connectionId).toBe(serverIds[index]);
      });
    });

    it('should handle mixed success/failure scenarios correctly', async () => {
      const serverId = 'mixed-results-server';
      const healthCheckEvents: any[] = [];

      connectionManager.on('healthCheck', (serverIdEvent, result) => {
        if (serverIdEvent === serverId) {
          healthCheckEvents.push(result);
        }
      });

      await connectionManager.connect(serverId);

      // First check: success
      let result = await connectionManager.checkHealth(serverId);
      expect(result.success).toBe(true);

      // Second check: failure
      mockClient.ping.mockRejectedValueOnce(new Error('Temporary failure'));
      result = await connectionManager.checkHealth(serverId);
      expect(result.success).toBe(false);
      expect(result.consecutiveFailures).toBe(1);

      // Third check: success (recovery)
      result = await connectionManager.checkHealth(serverId);
      expect(result.success).toBe(true);
      expect(result.consecutiveFailures).toBe(0);

      // Check statistics reflect mixed results
      const stats = connectionManager.getHealthStatistics(serverId);
      expect(stats!.totalChecks).toBe(3);
      expect(stats!.successfulChecks).toBe(2);
      expect(stats!.failedChecks).toBe(1);
      expect(Math.round(stats!.uptimePercentage)).toBe(67);
    });
  });

  describe('Legacy Health Check Compatibility', () => {
    it('should maintain backward compatibility with legacy health check API', async () => {
      const serverId = 'legacy-compat-server';
      await connectionManager.connect(serverId);

      // Legacy getHealth method should still work
      const legacyHealth = connectionManager.getHealth(serverId);
      expect(legacyHealth).toBeDefined();
      expect(legacyHealth!.isHealthy).toBe(true);

      // Legacy getMetrics method should still work
      const legacyMetrics = connectionManager.getMetrics(serverId);
      expect(legacyMetrics).toBeDefined();
      expect(legacyMetrics!.totalConnections).toBe(1);
    });

    it('should emit legacy health check events alongside unified events', async () => {
      const serverId = 'event-compat-server';
      const legacyEvents: any[] = [];

      connectionManager.on('healthCheck', (serverIdEvent, result) => {
        legacyEvents.push({ serverId: serverIdEvent, result });
      });

      await connectionManager.connect(serverId);
      await connectionManager.checkHealth(serverId);

      expect(legacyEvents).toHaveLength(1);
      expect(legacyEvents[0].serverId).toBe(serverId);
      expect(legacyEvents[0].result.success).toBe(true);
    });
  });

  describe('Configuration Integration', () => {
    it('should respect health check configuration from APEX config', async () => {
      // Create manager with custom health check config
      const customConfig = {
        ...mockConfig,
        mcp: {
          ...mockConfig.mcp!,
          connection: {
            healthCheckIntervalMs: 2000,
            healthCheckTimeoutMs: 1000,
            healthCheckFailureThreshold: 5,
            heartbeatEnabled: false,
            autoReconnect: true,
          },
        },
      };

      const customManager = new MCPConnectionManager({
        projectPath: '/test/project',
        config: customConfig,
      });

      const serverId = 'custom-config-server';
      await customManager.connect(serverId);

      const unifiedState = customManager.getUnifiedHealthState(serverId);
      expect(unifiedState).toBeDefined();
      // The method should be 'custom' since heartbeatEnabled is false
      expect(unifiedState!.method).toBe('custom');

      await customManager.disconnectAll();
    });

    it('should allow per-connection health check configuration override', async () => {
      const serverId = 'per-connection-config';

      await connectionManager.connect(serverId);

      // This would typically be done through server-specific config,
      // but we can test the unified manager's updateConfig method
      const unifiedManager = (connectionManager as any).healthManager;

      unifiedManager.updateConfig(serverId, {
        failureThreshold: 10,
        intervalMs: 500,
      });

      // The configuration change should be reflected in behavior
      // We can verify this by checking that the connection doesn't fail
      // until we exceed the new threshold
      mockClient.ping.mockRejectedValue(new Error('Test failure'));

      for (let i = 0; i < 5; i++) {
        await connectionManager.checkHealth(serverId);
      }

      const state = connectionManager.getUnifiedHealthState(serverId);
      // Should still be healthy because new threshold is 10
      expect(state!.isHealthy).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle transport-level errors gracefully', async () => {
      const serverId = 'transport-error-server';

      // Mock transport to throw error during connection
      mockTransport.connect.mockRejectedValueOnce(new Error('Transport failed'));

      await expect(connectionManager.connect(serverId))
        .rejects.toThrow('Transport failed');

      // Should not have health state for failed connection
      const unifiedState = connectionManager.getUnifiedHealthState(serverId);
      expect(unifiedState).toBeUndefined();
    });

    it('should clean up health monitoring on disconnect', async () => {
      const serverId = 'cleanup-test-server';

      await connectionManager.connect(serverId);

      let unifiedState = connectionManager.getUnifiedHealthState(serverId);
      expect(unifiedState).toBeDefined();

      await connectionManager.disconnect(serverId);

      unifiedState = connectionManager.getUnifiedHealthState(serverId);
      expect(unifiedState).toBeUndefined();
    });

    it('should handle concurrent health checks without conflicts', async () => {
      const serverId = 'concurrent-health-server';

      await connectionManager.connect(serverId);

      // Start multiple concurrent health checks
      const healthCheckPromises = Array.from({ length: 5 }, () =>
        connectionManager.checkHealth(serverId)
      );

      const results = await Promise.all(healthCheckPromises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Statistics should account for all checks
      const stats = connectionManager.getHealthStatistics(serverId);
      expect(stats!.totalChecks).toBe(5);
    });
  });
});