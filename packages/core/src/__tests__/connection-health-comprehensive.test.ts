/**
 * Comprehensive integration tests for connection health checks
 *
 * Tests integration scenarios, edge cases, and real-world usage patterns
 * that complement the core connection-health.test.ts unit tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import {
  ConnectionHealthManager,
  type HealthCheckConfig,
  type HealthCheckResult,
  type ConnectionHealthState,
  globalHealthManager
} from '../connection-health.js';

describe('Connection Health - Comprehensive Integration Tests', () => {
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

  describe('Multi-Connection Health Management', () => {
    it('should handle health checks for multiple connection types simultaneously', async () => {
      const connections = [
        { id: 'websocket-conn-1', method: 'ping' as const },
        { id: 'mcp-conn-1', method: 'heartbeat' as const },
        { id: 'api-conn-1', method: 'custom' as const, customHealthCheck: vi.fn().mockResolvedValue({ success: true, latencyMs: 100 }) },
        { id: 'pool-conn-1', method: 'pooled' as const }
      ];

      const healthEvents: any[] = [];
      healthManager.on('health:check', (result) => {
        healthEvents.push(result);
      });

      // Register all connections
      connections.forEach(conn => {
        healthManager.register(conn.id, {
          method: conn.method,
          customHealthCheck: conn.customHealthCheck
        });
      });

      // Simulate ping/pong for ping-based connections
      const pingConnections = connections.filter(c => c.method === 'ping');
      pingConnections.forEach(conn => {
        const pingId = 'test-ping-id';
        healthManager.notifyPingSent(conn.id, pingId, Date.now());
        healthManager.notifyPongReceived(conn.id, pingId, 120);
      });

      // Simulate heartbeat for heartbeat-based connections
      const heartbeatConnections = connections.filter(c => c.method === 'heartbeat');
      heartbeatConnections.forEach(conn => {
        const state = healthManager.getHealthState(conn.id);
        if (state) {
          state.lastPingAt = new Date(Date.now() - 500);
          state.lastPongAt = new Date(Date.now() - 400);
        }
      });

      // Perform health checks
      const healthCheckPromises = connections.map(conn =>
        healthManager.performHealthCheck(conn.id)
      );

      const results = await Promise.all(healthCheckPromises);

      // Verify all connections were checked
      expect(results).toHaveLength(connections.length);
      results.forEach(result => {
        expect(result.connectionId).toBeTruthy();
        expect(['ping', 'heartbeat', 'custom', 'pooled']).toContain(result.method);
      });

      // Verify events were emitted
      expect(healthEvents.length).toBeGreaterThanOrEqual(connections.length);
    });

    it('should isolate health failures between different connections', async () => {
      const goodConnection = 'stable-conn';
      const badConnection = 'failing-conn';

      const goodHealthCheck = vi.fn().mockResolvedValue({ success: true, latencyMs: 50 });
      const badHealthCheck = vi.fn().mockResolvedValue({ success: false, error: 'Connection timeout' });

      healthManager.register(goodConnection, {
        method: 'custom',
        customHealthCheck: goodHealthCheck
      });

      healthManager.register(badConnection, {
        method: 'custom',
        customHealthCheck: badHealthCheck,
        failureThreshold: 1 // Fail fast for testing
      });

      const reconnectEvents: string[] = [];
      healthManager.on('health:reconnect-required', (connId) => {
        reconnectEvents.push(connId);
      });

      // Perform health checks
      await healthManager.performHealthCheck(goodConnection);
      await healthManager.performHealthCheck(badConnection);

      // Good connection should remain healthy
      const goodState = healthManager.getHealthState(goodConnection);
      expect(goodState?.isHealthy).toBe(true);
      expect(goodState?.consecutiveFailures).toBe(0);

      // Bad connection should be unhealthy and trigger reconnect
      const badState = healthManager.getHealthState(badConnection);
      expect(badState?.isHealthy).toBe(false);
      expect(badState?.consecutiveFailures).toBe(1);
      expect(reconnectEvents).toContain(badConnection);
      expect(reconnectEvents).not.toContain(goodConnection);
    });
  });

  describe('Health Check Timing and Scheduling', () => {
    it('should handle rapid configuration updates during health checks', async () => {
      const connectionId = 'rapid-config-test';
      healthManager.register(connectionId, {
        method: 'custom',
        intervalMs: 1000,
        customHealthCheck: mockCustomHealthCheck.mockResolvedValue({ success: true })
      });

      // Start automatic monitoring
      vi.advanceTimersByTime(10);

      // Rapidly update configuration multiple times
      for (let i = 0; i < 5; i++) {
        healthManager.updateConfig(connectionId, {
          intervalMs: 500 + (i * 100),
          failureThreshold: 2 + i
        });
        await vi.advanceTimersByTimeAsync(100);
      }

      // Should handle config changes gracefully
      const state = healthManager.getHealthState(connectionId);
      expect(state).toBeDefined();
      expect(state?.isHealthy).toBe(true);
    });

    it('should handle overlapping ping/pong cycles correctly', async () => {
      const connectionId = 'overlap-test';
      healthManager.register(connectionId, { method: 'ping' });

      const pingEvents: string[] = [];
      const pongEvents: string[] = [];

      healthManager.on('ping:sent', (connId, pingId) => {
        pingEvents.push(pingId);
      });

      healthManager.on('pong:received', (connId, pingId) => {
        pongEvents.push(pingId);
      });

      // Send multiple overlapping pings
      const ping1 = 'ping-1';
      const ping2 = 'ping-2';
      const ping3 = 'ping-3';

      healthManager.notifyPingSent(connectionId, ping1, Date.now());
      await vi.advanceTimersByTimeAsync(50);

      healthManager.notifyPingSent(connectionId, ping2, Date.now()); // Should replace pending ping
      await vi.advanceTimersByTimeAsync(50);

      healthManager.notifyPingSent(connectionId, ping3, Date.now()); // Should replace pending ping
      await vi.advanceTimersByTimeAsync(50);

      // Only the latest ping should be tracked
      const state = healthManager.getHealthState(connectionId);
      expect(state?.pendingPingId).toBe(ping3);

      // Respond to the latest ping
      healthManager.notifyPongReceived(connectionId, ping3, 150);

      // Should clear pending ping and update latency
      const updatedState = healthManager.getHealthState(connectionId);
      expect(updatedState?.pendingPingId).toBeUndefined();
      expect(updatedState?.averageLatencyMs).toBe(150);
    });

    it('should handle health check timeouts during connection state changes', async () => {
      const connectionId = 'timeout-during-change';

      // Set a long timeout for this test
      mockCustomHealthCheck.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 1000))
      );

      healthManager.register(connectionId, {
        method: 'custom',
        timeoutMs: 500, // Shorter than the mock delay
        customHealthCheck: mockCustomHealthCheck
      });

      // Start health check
      const healthCheckPromise = healthManager.performHealthCheck(connectionId);

      // Unregister connection while health check is in progress
      vi.advanceTimersByTime(200);
      healthManager.unregister(connectionId);

      // Wait for timeout
      vi.advanceTimersByTime(400);

      // Health check should complete with error
      const result = await healthCheckPromise;
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe('Event-Driven Health Monitoring', () => {
    it('should emit appropriate events during connection lifecycle', async () => {
      const connectionId = 'lifecycle-test';
      const events: { type: string; data: any }[] = [];

      // Track all health events
      const eventTypes = ['health:healthy', 'health:unhealthy', 'health:recovered', 'health:reconnect-required'];
      eventTypes.forEach(eventType => {
        healthManager.on(eventType as any, (...args: any[]) => {
          events.push({ type: eventType, data: args });
        });
      });

      // Register connection
      healthManager.register(connectionId, {
        method: 'custom',
        failureThreshold: 2,
        customHealthCheck: mockCustomHealthCheck
      });

      // Test initial healthy state
      mockCustomHealthCheck.mockResolvedValueOnce({ success: true, latencyMs: 100 });
      await healthManager.performHealthCheck(connectionId);

      const healthyEvents = events.filter(e => e.type === 'health:healthy');
      expect(healthyEvents.length).toBeGreaterThan(0);

      // Test transition to unhealthy
      events.length = 0; // Clear events
      mockCustomHealthCheck.mockResolvedValueOnce({ success: false, error: 'Network error' });
      await healthManager.performHealthCheck(connectionId);

      const unhealthyEvents = events.filter(e => e.type === 'health:unhealthy');
      expect(unhealthyEvents).toHaveLength(1);

      // Test failure threshold triggering reconnect
      mockCustomHealthCheck.mockResolvedValueOnce({ success: false, error: 'Still failing' });
      await healthManager.performHealthCheck(connectionId);

      const reconnectEvents = events.filter(e => e.type === 'health:reconnect-required');
      expect(reconnectEvents).toHaveLength(1);

      // Test recovery
      mockCustomHealthCheck.mockResolvedValueOnce({ success: true, latencyMs: 80 });
      await healthManager.performHealthCheck(connectionId);

      const recoveredEvents = events.filter(e => e.type === 'health:recovered');
      expect(recoveredEvents).toHaveLength(1);
    });

    it('should handle event listener errors gracefully', async () => {
      const connectionId = 'error-listener-test';

      // Add event listeners that throw errors
      healthManager.on('health:check', () => {
        throw new Error('Listener error 1');
      });

      healthManager.on('health:check', () => {
        throw new Error('Listener error 2');
      });

      // Add a working listener to verify it still gets called
      const workingListenerEvents: any[] = [];
      healthManager.on('health:check', (result) => {
        workingListenerEvents.push(result);
      });

      healthManager.register(connectionId, {
        method: 'custom',
        customHealthCheck: mockCustomHealthCheck.mockResolvedValue({ success: true })
      });

      // Should not throw and working listener should still receive events
      await expect(healthManager.performHealthCheck(connectionId)).resolves.toBeDefined();
      expect(workingListenerEvents).toHaveLength(1);
    });
  });

  describe('Global Health Manager Integration', () => {
    it('should work with the global health manager instance', async () => {
      const connectionId = 'global-test';

      // Clean up any existing connections
      globalHealthManager.unregister(connectionId);

      const customCheck = vi.fn().mockResolvedValue({ success: true, latencyMs: 200 });

      globalHealthManager.register(connectionId, {
        method: 'custom',
        customHealthCheck: customCheck
      });

      const result = await globalHealthManager.performHealthCheck(connectionId);

      expect(result.success).toBe(true);
      expect(result.connectionId).toBe(connectionId);
      expect(result.latencyMs).toBe(200);

      // Clean up
      globalHealthManager.unregister(connectionId);
      expect(globalHealthManager.getHealthState(connectionId)).toBeUndefined();
    });

    it('should isolate instances from each other', async () => {
      const connectionId = 'isolation-test';

      const instance1 = new ConnectionHealthManager();
      const instance2 = new ConnectionHealthManager();

      const check1 = vi.fn().mockResolvedValue({ success: true, latencyMs: 100 });
      const check2 = vi.fn().mockResolvedValue({ success: false, error: 'Instance 2 error' });

      instance1.register(connectionId, {
        method: 'custom',
        customHealthCheck: check1
      });

      instance2.register(connectionId, {
        method: 'custom',
        customHealthCheck: check2
      });

      const result1 = await instance1.performHealthCheck(connectionId);
      const result2 = await instance2.performHealthCheck(connectionId);

      // Results should be independent
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);

      // States should be independent
      expect(instance1.getHealthState(connectionId)?.isHealthy).toBe(true);
      expect(instance2.getHealthState(connectionId)?.isHealthy).toBe(false);

      instance1.destroy();
      instance2.destroy();
    });
  });

  describe('Memory Management and Resource Cleanup', () => {
    it('should prevent memory leaks with long-running health checks', async () => {
      const connections: string[] = [];

      // Create and destroy many connections to test memory cleanup
      for (let i = 0; i < 50; i++) {
        const connectionId = `memory-test-${i}`;
        connections.push(connectionId);

        healthManager.register(connectionId, {
          method: 'custom',
          customHealthCheck: vi.fn().mockResolvedValue({ success: true })
        });

        // Perform a health check
        await healthManager.performHealthCheck(connectionId);

        // Unregister every other connection
        if (i % 2 === 0) {
          healthManager.unregister(connectionId);
        }
      }

      // Check that unregistered connections are cleaned up
      const registeredConnections = healthManager.getRegisteredConnections();
      expect(registeredConnections.length).toBe(25); // Half should remain

      // Clean up remaining connections
      connections.forEach(id => healthManager.unregister(id));
      expect(healthManager.getRegisteredConnections()).toHaveLength(0);
    });

    it('should clear timers and pending operations on destroy', async () => {
      const connectionIds = ['timer-test-1', 'timer-test-2', 'timer-test-3'];

      // Register connections with automatic monitoring
      connectionIds.forEach(id => {
        healthManager.register(id, {
          enabled: true,
          intervalMs: 1000,
          method: 'custom',
          customHealthCheck: mockCustomHealthCheck.mockResolvedValue({ success: true })
        });
      });

      // Start some ping operations
      connectionIds.forEach(id => {
        healthManager.notifyPingSent(id, `ping-${id}`, Date.now());
      });

      // Verify timers are active
      const states = connectionIds.map(id => healthManager.getHealthState(id));
      states.forEach(state => {
        expect(state?.healthCheckTimer).toBeDefined();
      });

      // Destroy health manager
      healthManager.destroy();

      // Verify cleanup
      expect(healthManager.getRegisteredConnections()).toHaveLength(0);
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle concurrent health checks efficiently', async () => {
      const connectionCount = 20;
      const connections: string[] = [];

      // Register many connections
      for (let i = 0; i < connectionCount; i++) {
        const connectionId = `concurrent-test-${i}`;
        connections.push(connectionId);

        healthManager.register(connectionId, {
          method: 'custom',
          customHealthCheck: vi.fn().mockResolvedValue({
            success: true,
            latencyMs: Math.random() * 200 + 50 // 50-250ms
          })
        });
      }

      const startTime = Date.now();

      // Perform all health checks concurrently
      const healthCheckPromises = connections.map(id =>
        healthManager.performHealthCheck(id)
      );

      const results = await Promise.all(healthCheckPromises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All checks should succeed
      expect(results).toHaveLength(connectionCount);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete reasonably quickly (concurrent execution)
      expect(totalTime).toBeLessThan(1000); // Less than 1 second
    });

    it('should handle rapid ping/pong cycles without performance degradation', async () => {
      const connectionId = 'rapid-ping-test';
      healthManager.register(connectionId, { method: 'ping' });

      const iterations = 100;
      const startTime = Date.now();

      // Rapidly send ping/pong cycles
      for (let i = 0; i < iterations; i++) {
        const pingId = `ping-${i}`;
        healthManager.notifyPingSent(connectionId, pingId, Date.now());
        healthManager.notifyPongReceived(connectionId, pingId, Math.random() * 100);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete quickly
      expect(totalTime).toBeLessThan(500); // Less than 500ms

      // Final state should be healthy with proper metrics
      const state = healthManager.getHealthState(connectionId);
      expect(state?.isHealthy).toBe(true);
      expect(state?.averageLatencyMs).toBeGreaterThan(0);
      expect(state?.latencyHistory.length).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover gracefully from custom health check exceptions', async () => {
      const connectionId = 'exception-test';

      const faultyHealthCheck = vi.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new TypeError('Invalid response'))
        .mockResolvedValueOnce({ success: true, latencyMs: 150 }); // Recovery

      healthManager.register(connectionId, {
        method: 'custom',
        customHealthCheck: faultyHealthCheck
      });

      // First check should handle exception
      const result1 = await healthManager.performHealthCheck(connectionId);
      expect(result1.success).toBe(false);
      expect(result1.error).toBeInstanceOf(Error);

      // Second check should also handle exception
      const result2 = await healthManager.performHealthCheck(connectionId);
      expect(result2.success).toBe(false);

      // Third check should succeed and recover
      const result3 = await healthManager.performHealthCheck(connectionId);
      expect(result3.success).toBe(true);
      expect(result3.latencyMs).toBe(150);

      // State should reflect recovery
      const state = healthManager.getHealthState(connectionId);
      expect(state?.isHealthy).toBe(true);
      expect(state?.consecutiveFailures).toBe(0);
    });

    it('should handle invalid configurations gracefully', async () => {
      const connectionId = 'invalid-config-test';

      // Test invalid timeout (negative value)
      expect(() => {
        healthManager.register(connectionId, {
          timeoutMs: -100,
          method: 'custom',
          customHealthCheck: mockCustomHealthCheck
        });
      }).not.toThrow(); // Should handle gracefully, not crash

      // Test missing custom health check for custom method
      healthManager.register(connectionId, {
        method: 'custom'
        // Missing customHealthCheck
      });

      await expect(healthManager.performHealthCheck(connectionId))
        .rejects.toThrow('Custom health check function not provided');
    });
  });
});