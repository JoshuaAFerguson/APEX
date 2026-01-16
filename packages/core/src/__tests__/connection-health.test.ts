import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import {
  ConnectionHealthManager,
  type HealthCheckConfig,
  type HealthCheckResult,
  type ConnectionHealthState,
  type HealthCheckEvents
} from '../connection-health.js';

describe('ConnectionHealthManager', () => {
  let healthManager: ConnectionHealthManager;
  let mockCustomHealthCheck: Mock;

  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();

    mockCustomHealthCheck = vi.fn();
    healthManager = new ConnectionHealthManager({
      enabled: true,
      method: 'custom',
      intervalMs: 1000,
      timeoutMs: 500,
      failureThreshold: 3,
      triggerReconnectOnFailure: true,
      customHealthCheck: mockCustomHealthCheck,
    });
  });

  afterEach(() => {
    healthManager.destroy();
    vi.useRealTimers();
  });

  describe('Connection Registration', () => {
    it('should register a connection with default configuration', () => {
      const connectionId = 'test-conn-1';
      healthManager.register(connectionId);

      const state = healthManager.getHealthState(connectionId);
      expect(state).toBeDefined();
      expect(state!.connectionId).toBe(connectionId);
      expect(state!.isHealthy).toBe(true);
      expect(state!.consecutiveFailures).toBe(0);
    });

    it('should register a connection with custom configuration', () => {
      const connectionId = 'test-conn-2';
      const customConfig = {
        method: 'ping' as const,
        intervalMs: 2000,
        failureThreshold: 5,
      };

      healthManager.register(connectionId, customConfig);

      const state = healthManager.getHealthState(connectionId);
      expect(state).toBeDefined();
      expect(state!.method).toBe('ping');
    });

    it('should unregister a connection', () => {
      const connectionId = 'test-conn-3';
      healthManager.register(connectionId);

      expect(healthManager.getHealthState(connectionId)).toBeDefined();

      healthManager.unregister(connectionId);

      expect(healthManager.getHealthState(connectionId)).toBeUndefined();
    });

    it('should list all registered connections', () => {
      const connections = ['conn-1', 'conn-2', 'conn-3'];
      connections.forEach(id => healthManager.register(id));

      const registered = healthManager.getRegisteredConnections();
      expect(registered).toHaveLength(3);
      expect(registered).toEqual(expect.arrayContaining(connections));
    });
  });

  describe('Health Check Methods', () => {
    describe('Custom Health Check', () => {
      it('should perform successful custom health check', async () => {
        const connectionId = 'custom-conn';
        const expectedLatency = 150;

        mockCustomHealthCheck.mockResolvedValueOnce({
          success: true,
          latencyMs: expectedLatency,
        });

        healthManager.register(connectionId, {
          method: 'custom',
          customHealthCheck: mockCustomHealthCheck,
        });

        const result = await healthManager.performHealthCheck(connectionId);

        expect(result.success).toBe(true);
        expect(result.latencyMs).toBe(expectedLatency);
        expect(result.isHealthy).toBe(true);
        expect(result.consecutiveFailures).toBe(0);
        expect(mockCustomHealthCheck).toHaveBeenCalledWith(connectionId);
      });

      it('should handle custom health check failure', async () => {
        const connectionId = 'custom-conn-fail';
        const errorMessage = 'Connection failed';

        mockCustomHealthCheck.mockResolvedValueOnce({
          success: false,
          error: errorMessage,
        });

        healthManager.register(connectionId, {
          method: 'custom',
          customHealthCheck: mockCustomHealthCheck,
        });

        const result = await healthManager.performHealthCheck(connectionId);

        expect(result.success).toBe(false);
        expect(result.error).toBe(errorMessage);
        expect(result.isHealthy).toBe(false);
        expect(result.consecutiveFailures).toBe(1);
      });

      it('should handle custom health check timeout', async () => {
        const connectionId = 'custom-conn-timeout';

        // Mock a health check that takes longer than timeout
        mockCustomHealthCheck.mockImplementation(() =>
          new Promise(resolve => setTimeout(() => resolve({ success: true }), 1000))
        );

        healthManager.register(connectionId, {
          method: 'custom',
          timeoutMs: 500,
          customHealthCheck: mockCustomHealthCheck,
        });

        const checkPromise = healthManager.performHealthCheck(connectionId);

        // Advance time to trigger timeout
        vi.advanceTimersByTime(600);

        const result = await checkPromise;

        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error!.message).toContain('timeout');
      });
    });

    describe('Ping Health Check', () => {
      beforeEach(() => {
        vi.clearAllMocks();
      });

      it('should handle ping/pong flow correctly', async () => {
        const connectionId = 'ping-conn';
        let pingEventHandler: any;
        let pingId: string;
        let timestamp: number;

        healthManager.register(connectionId, { method: 'ping' });

        // Set up ping event listener
        healthManager.on('ping:sent', (connId, pId, ts) => {
          pingId = pId;
          timestamp = ts;
        });

        // Start health check (this will emit ping:sent)
        const checkPromise = healthManager.performHealthCheck(connectionId);

        // Advance time to allow ping to be sent
        vi.advanceTimersByTime(10);

        // Simulate external system receiving ping and sending pong
        const latency = 100;
        vi.advanceTimersByTime(latency);
        healthManager.notifyPongReceived(connectionId, pingId!, latency);

        const result = await checkPromise;

        expect(result.success).toBe(true);
        expect(result.latencyMs).toBe(latency);
        expect(result.isHealthy).toBe(true);
      });

      it('should handle ping timeout', async () => {
        const connectionId = 'ping-timeout-conn';
        let pingId: string;

        healthManager.register(connectionId, {
          method: 'ping',
          timeoutMs: 500,
        });

        // Set up ping event listener
        healthManager.on('ping:sent', (connId, pId) => {
          pingId = pId;
        });

        const checkPromise = healthManager.performHealthCheck(connectionId);

        // Advance time to allow ping to be sent
        vi.advanceTimersByTime(10);

        // Advance time to trigger timeout
        vi.advanceTimersByTime(600);

        // Simulate timeout notification
        healthManager.notifyPingTimeout(connectionId, pingId!);

        const result = await checkPromise;

        expect(result.success).toBe(false);
        expect(result.error).toBe('Ping timeout');
      });
    });

    describe('Heartbeat Health Check', () => {
      it('should pass heartbeat check when recent pong received', async () => {
        const connectionId = 'heartbeat-conn';
        healthManager.register(connectionId, { method: 'heartbeat', intervalMs: 1000 });

        // Simulate recent pong
        const state = healthManager.getHealthState(connectionId)!;
        state.lastPongAt = new Date(Date.now() - 500); // 500ms ago
        state.lastPingAt = new Date(Date.now() - 600); // 600ms ago

        const result = await healthManager.performHealthCheck(connectionId);

        expect(result.success).toBe(true);
        expect(result.isHealthy).toBe(true);
      });

      it('should fail heartbeat check when pong is stale', async () => {
        const connectionId = 'heartbeat-stale-conn';
        healthManager.register(connectionId, { method: 'heartbeat', intervalMs: 1000 });

        // Simulate stale pong (older than threshold)
        const state = healthManager.getHealthState(connectionId)!;
        state.lastPongAt = new Date(Date.now() - 3000); // 3 seconds ago
        state.lastPingAt = new Date(Date.now() - 3100); // 3.1 seconds ago

        const result = await healthManager.performHealthCheck(connectionId);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Heartbeat timeout');
      });
    });
  });

  describe('Health State Management', () => {
    it('should track consecutive failures', async () => {
      const connectionId = 'failure-tracking';
      mockCustomHealthCheck.mockResolvedValue({ success: false, error: 'Test failure' });

      healthManager.register(connectionId, {
        method: 'custom',
        customHealthCheck: mockCustomHealthCheck,
      });

      // First failure
      let result = await healthManager.performHealthCheck(connectionId);
      expect(result.consecutiveFailures).toBe(1);

      // Second failure
      result = await healthManager.performHealthCheck(connectionId);
      expect(result.consecutiveFailures).toBe(2);

      // Recovery
      mockCustomHealthCheck.mockResolvedValueOnce({ success: true });
      result = await healthManager.performHealthCheck(connectionId);
      expect(result.consecutiveFailures).toBe(0);
    });

    it('should update latency metrics', async () => {
      const connectionId = 'latency-tracking';
      const latencies = [100, 150, 200, 120, 180];

      healthManager.register(connectionId, { method: 'ping' });

      for (const latency of latencies) {
        const pingId = `ping-${latency}`;
        healthManager.notifyPingSent(connectionId, pingId, Date.now());
        healthManager.notifyPongReceived(connectionId, pingId, latency);
      }

      const state = healthManager.getHealthState(connectionId);
      expect(state!.latencyHistory).toEqual(latencies);

      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      expect(state!.averageLatencyMs).toBe(avgLatency);
    });

    it('should maintain limited latency history', async () => {
      const connectionId = 'history-limit';
      healthManager.register(connectionId, {
        method: 'ping',
        latencyHistorySize: 3, // Limit to 3 entries
      });

      const latencies = [100, 150, 200, 120, 180]; // 5 latencies

      for (const latency of latencies) {
        const pingId = `ping-${latency}`;
        healthManager.notifyPingSent(connectionId, pingId, Date.now());
        healthManager.notifyPongReceived(connectionId, pingId, latency);
      }

      const state = healthManager.getHealthState(connectionId);
      expect(state!.latencyHistory).toHaveLength(3);
      expect(state!.latencyHistory).toEqual([200, 120, 180]); // Last 3
    });
  });

  describe('Event Emission', () => {
    it('should emit health check events', async () => {
      const connectionId = 'event-test';
      const healthCheckEvents: any[] = [];

      healthManager.on('health:check', (result) => {
        healthCheckEvents.push(result);
      });

      mockCustomHealthCheck.mockResolvedValueOnce({ success: true, latencyMs: 100 });
      healthManager.register(connectionId, {
        method: 'custom',
        customHealthCheck: mockCustomHealthCheck,
      });

      await healthManager.performHealthCheck(connectionId);

      expect(healthCheckEvents).toHaveLength(1);
      expect(healthCheckEvents[0].connectionId).toBe(connectionId);
      expect(healthCheckEvents[0].success).toBe(true);
    });

    it('should emit healthy/unhealthy state changes', async () => {
      const connectionId = 'state-events';
      const stateEvents: string[] = [];

      healthManager.on('health:healthy', () => stateEvents.push('healthy'));
      healthManager.on('health:unhealthy', () => stateEvents.push('unhealthy'));
      healthManager.on('health:recovered', () => stateEvents.push('recovered'));

      healthManager.register(connectionId, {
        method: 'custom',
        customHealthCheck: mockCustomHealthCheck,
      });

      // Start healthy, trigger unhealthy
      mockCustomHealthCheck.mockResolvedValueOnce({ success: false });
      await healthManager.performHealthCheck(connectionId);
      expect(stateEvents).toContain('unhealthy');

      // Recover
      mockCustomHealthCheck.mockResolvedValueOnce({ success: true });
      await healthManager.performHealthCheck(connectionId);
      expect(stateEvents).toContain('recovered');
    });

    it('should emit reconnect-required event when threshold exceeded', async () => {
      const connectionId = 'reconnect-test';
      const reconnectEvents: any[] = [];

      healthManager.on('health:reconnect-required', (connId, state, result) => {
        reconnectEvents.push({ connectionId: connId, state, result });
      });

      mockCustomHealthCheck.mockResolvedValue({ success: false, error: 'Connection lost' });

      healthManager.register(connectionId, {
        method: 'custom',
        failureThreshold: 2,
        customHealthCheck: mockCustomHealthCheck,
      });

      // First failure - no reconnect yet
      await healthManager.performHealthCheck(connectionId);
      expect(reconnectEvents).toHaveLength(0);

      // Second failure - should trigger reconnect
      await healthManager.performHealthCheck(connectionId);
      expect(reconnectEvents).toHaveLength(1);
      expect(reconnectEvents[0].connectionId).toBe(connectionId);
    });
  });

  describe('Statistics', () => {
    it('should track health check statistics', async () => {
      const connectionId = 'stats-test';
      mockCustomHealthCheck
        .mockResolvedValueOnce({ success: true, latencyMs: 100 })
        .mockResolvedValueOnce({ success: false, error: 'Fail' })
        .mockResolvedValueOnce({ success: true, latencyMs: 150 });

      healthManager.register(connectionId, {
        method: 'custom',
        customHealthCheck: mockCustomHealthCheck,
      });

      // Perform health checks
      await healthManager.performHealthCheck(connectionId);
      await healthManager.performHealthCheck(connectionId);
      await healthManager.performHealthCheck(connectionId);

      const stats = healthManager.getHealthStats(connectionId);
      expect(stats).toBeDefined();
      expect(stats!.totalChecks).toBe(3);
      expect(stats!.successfulChecks).toBe(2);
      expect(stats!.failedChecks).toBe(1);
      expect(stats!.uptimePercentage).toBeCloseTo(66.67, 1);
      expect(stats!.averageLatencyMs).toBe(125); // (100 + 150) / 2
    });

    it('should update min/max latency statistics', async () => {
      const connectionId = 'minmax-stats';
      const latencies = [200, 50, 300, 100];

      healthManager.register(connectionId, { method: 'ping' });

      for (const latency of latencies) {
        const pingId = `ping-${latency}`;
        healthManager.notifyPingSent(connectionId, pingId, Date.now());
        healthManager.notifyPongReceived(connectionId, pingId, latency);
      }

      const stats = healthManager.getHealthStats(connectionId);
      expect(stats!.minLatencyMs).toBe(50);
      expect(stats!.maxLatencyMs).toBe(300);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration for existing connection', () => {
      const connectionId = 'config-update';
      healthManager.register(connectionId, { intervalMs: 1000 });

      // Update configuration
      healthManager.updateConfig(connectionId, {
        intervalMs: 2000,
        failureThreshold: 5,
      });

      // The updated config is internal, but we can test by checking behavior
      expect(() => healthManager.updateConfig(connectionId, { enabled: false })).not.toThrow();
    });

    it('should throw error when updating non-existent connection', () => {
      expect(() => {
        healthManager.updateConfig('non-existent', { intervalMs: 2000 });
      }).toThrow('Connection \'non-existent\' not registered');
    });
  });

  describe('Cleanup', () => {
    it('should clean up all resources on destroy', () => {
      const connectionIds = ['cleanup-1', 'cleanup-2', 'cleanup-3'];
      connectionIds.forEach(id => healthManager.register(id));

      expect(healthManager.getRegisteredConnections()).toHaveLength(3);

      healthManager.destroy();

      expect(healthManager.getRegisteredConnections()).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle health check on non-existent connection', async () => {
      await expect(
        healthManager.performHealthCheck('non-existent')
      ).rejects.toThrow('Connection \'non-existent\' not registered');
    });

    it('should handle missing custom health check function', async () => {
      const connectionId = 'no-custom-func';
      healthManager.register(connectionId, {
        method: 'custom',
        // customHealthCheck not provided
      });

      await expect(
        healthManager.performHealthCheck(connectionId)
      ).rejects.toThrow('Custom health check function not provided');
    });

    it('should handle pong received for unknown ping', () => {
      const connectionId = 'unknown-ping';
      healthManager.register(connectionId);

      // This should not throw
      expect(() => {
        healthManager.notifyPongReceived(connectionId, 'unknown-ping-id', 100);
      }).not.toThrow();
    });
  });
});

describe('Health Check Integration Tests', () => {
  let healthManager: ConnectionHealthManager;

  beforeEach(() => {
    vi.useFakeTimers();
    healthManager = new ConnectionHealthManager({
      enabled: true,
      intervalMs: 1000,
    });
  });

  afterEach(() => {
    healthManager.destroy();
    vi.useRealTimers();
  });

  it('should handle automatic periodic health checks', async () => {
    const connectionId = 'periodic-test';
    const healthCheckResults: any[] = [];

    healthManager.on('health:check', (result) => {
      healthCheckResults.push(result);
    });

    const mockHealthCheck = vi.fn().mockResolvedValue({ success: true, latencyMs: 100 });

    healthManager.register(connectionId, {
      method: 'custom',
      intervalMs: 1000,
      customHealthCheck: mockHealthCheck,
    });

    // Advance time to trigger several periodic checks
    vi.advanceTimersByTime(3500); // 3.5 seconds

    // Wait for any pending promises
    await vi.runAllTimersAsync();

    expect(mockHealthCheck).toHaveBeenCalledTimes(3);
    expect(healthCheckResults).toHaveLength(3);
  });

  it('should handle complex ping/pong interaction with multiple connections', () => {
    const connections = ['conn-1', 'conn-2', 'conn-3'];
    const pingEvents: any[] = [];
    const pongEvents: any[] = [];

    healthManager.on('ping:sent', (connId, pingId, timestamp) => {
      pingEvents.push({ connectionId: connId, pingId, timestamp });
    });

    healthManager.on('pong:received', (connId, pingId, latency) => {
      pongEvents.push({ connectionId: connId, pingId, latency });
    });

    // Register multiple connections
    connections.forEach(id => {
      healthManager.register(id, { method: 'ping' });
    });

    // Simulate ping/pong for each connection
    connections.forEach((id, index) => {
      const pingId = `ping-${id}`;
      const latency = (index + 1) * 50; // Different latencies

      healthManager.notifyPingSent(id, pingId, Date.now());
      healthManager.notifyPongReceived(id, pingId, latency);
    });

    expect(pingEvents).toHaveLength(3);
    expect(pongEvents).toHaveLength(3);

    // Verify each connection has correct latency
    connections.forEach((id, index) => {
      const state = healthManager.getHealthState(id);
      const expectedLatency = (index + 1) * 50;
      expect(state!.averageLatencyMs).toBe(expectedLatency);
    });
  });

  it('should handle reconnection cascade when multiple connections fail', async () => {
    const connections = ['cascade-1', 'cascade-2', 'cascade-3'];
    const reconnectEvents: any[] = [];

    healthManager.on('health:reconnect-required', (connId) => {
      reconnectEvents.push(connId);
    });

    // Register connections with low failure threshold
    connections.forEach(id => {
      const mockHealthCheck = vi.fn().mockResolvedValue({ success: false });
      healthManager.register(id, {
        method: 'custom',
        failureThreshold: 2,
        customHealthCheck: mockHealthCheck,
      });
    });

    // Trigger failures for all connections
    for (const id of connections) {
      await healthManager.performHealthCheck(id); // First failure
      await healthManager.performHealthCheck(id); // Second failure - triggers reconnect
    }

    expect(reconnectEvents).toHaveLength(3);
    expect(reconnectEvents).toEqual(expect.arrayContaining(connections));
  });
});