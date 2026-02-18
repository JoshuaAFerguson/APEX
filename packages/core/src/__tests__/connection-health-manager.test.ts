import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ConnectionHealthManager,
  HealthCheckResult,
  ConnectionHealthState,
  HealthCheckMethod,
  HealthCheckStatus
} from '../connection-health.js';

describe('ConnectionHealthManager', () => {
  let healthManager: ConnectionHealthManager;
  let mockHealthCheck: vi.MockedFunction<() => Promise<boolean>>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockHealthCheck = vi.fn();
    healthManager = new ConnectionHealthManager();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    healthManager.stop();
  });

  describe('Health Check Registration', () => {
    it('should register a connection for health monitoring', () => {
      const connectionId = 'test-connection';

      healthManager.registerConnection(connectionId, {
        method: 'ping',
        intervalMs: 5000,
        timeoutMs: 1000,
        maxFailures: 3,
        healthCheckFn: mockHealthCheck
      });

      expect(healthManager.isRegistered(connectionId)).toBe(true);
    });

    it('should unregister a connection', () => {
      const connectionId = 'test-connection';

      healthManager.registerConnection(connectionId, {
        method: 'ping',
        intervalMs: 5000,
        timeoutMs: 1000,
        maxFailures: 3,
        healthCheckFn: mockHealthCheck
      });

      expect(healthManager.isRegistered(connectionId)).toBe(true);

      healthManager.unregisterConnection(connectionId);
      expect(healthManager.isRegistered(connectionId)).toBe(false);
    });

    it('should allow updating health check configuration', () => {
      const connectionId = 'test-connection';

      healthManager.registerConnection(connectionId, {
        method: 'ping',
        intervalMs: 5000,
        timeoutMs: 1000,
        maxFailures: 3,
        healthCheckFn: mockHealthCheck
      });

      // Update configuration
      healthManager.updateHealthCheckConfig(connectionId, {
        intervalMs: 3000,
        maxFailures: 5
      });

      const state = healthManager.getConnectionState(connectionId);
      expect(state?.config.intervalMs).toBe(3000);
      expect(state?.config.maxFailures).toBe(5);
    });
  });

  describe('Health Check Execution', () => {
    it('should perform health check and update state', async () => {
      const connectionId = 'test-connection';
      mockHealthCheck.mockResolvedValue(true);

      healthManager.registerConnection(connectionId, {
        method: 'ping',
        intervalMs: 5000,
        timeoutMs: 1000,
        maxFailures: 3,
        healthCheckFn: mockHealthCheck
      });

      const result = await healthManager.performHealthCheck(connectionId);

      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
      expect(result?.status).toBe('healthy');
      expect(result?.connectionId).toBe(connectionId);
      expect(mockHealthCheck).toHaveBeenCalledTimes(1);
    });

    it('should handle health check failures', async () => {
      const connectionId = 'test-connection';
      const error = new Error('Connection failed');
      mockHealthCheck.mockRejectedValue(error);

      healthManager.registerConnection(connectionId, {
        method: 'ping',
        intervalMs: 5000,
        timeoutMs: 1000,
        maxFailures: 3,
        healthCheckFn: mockHealthCheck
      });

      const result = await healthManager.performHealthCheck(connectionId);

      expect(result).toBeDefined();
      expect(result?.success).toBe(false);
      expect(result?.status).toBe('unhealthy');
      expect(result?.error).toBe(error);
      expect(result?.consecutiveFailures).toBe(1);
    });

    it('should track consecutive failures', async () => {
      const connectionId = 'test-connection';
      mockHealthCheck.mockRejectedValue(new Error('Failed'));

      healthManager.registerConnection(connectionId, {
        method: 'ping',
        intervalMs: 5000,
        timeoutMs: 1000,
        maxFailures: 3,
        healthCheckFn: mockHealthCheck
      });

      // Perform multiple failed checks
      for (let i = 1; i <= 3; i++) {
        const result = await healthManager.performHealthCheck(connectionId);
        expect(result?.consecutiveFailures).toBe(i);
        expect(result?.success).toBe(false);
      }
    });

    it('should reset consecutive failures on successful check', async () => {
      const connectionId = 'test-connection';

      healthManager.registerConnection(connectionId, {
        method: 'ping',
        intervalMs: 5000,
        timeoutMs: 1000,
        maxFailures: 3,
        healthCheckFn: mockHealthCheck
      });

      // Fail once
      mockHealthCheck.mockRejectedValueOnce(new Error('Failed'));
      const failResult = await healthManager.performHealthCheck(connectionId);
      expect(failResult?.consecutiveFailures).toBe(1);

      // Then succeed
      mockHealthCheck.mockResolvedValue(true);
      const successResult = await healthManager.performHealthCheck(connectionId);
      expect(successResult?.consecutiveFailures).toBe(0);
    });

    it('should calculate response latency for successful checks', async () => {
      const connectionId = 'test-connection';

      // Mock a delay in the health check
      mockHealthCheck.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return true;
      });

      healthManager.registerConnection(connectionId, {
        method: 'ping',
        intervalMs: 5000,
        timeoutMs: 1000,
        maxFailures: 3,
        healthCheckFn: mockHealthCheck
      });

      vi.useRealTimers(); // Use real timers for latency measurement
      const result = await healthManager.performHealthCheck(connectionId);

      expect(result?.latencyMs).toBeDefined();
      expect(result?.latencyMs).toBeGreaterThan(0);
    });
  });

  describe('Automatic Health Monitoring', () => {
    it('should start and stop automatic monitoring', () => {
      const connectionId = 'test-connection';
      mockHealthCheck.mockResolvedValue(true);

      healthManager.registerConnection(connectionId, {
        method: 'ping',
        intervalMs: 1000,
        timeoutMs: 500,
        maxFailures: 3,
        healthCheckFn: mockHealthCheck
      });

      healthManager.start();
      expect(healthManager.isRunning()).toBe(true);

      healthManager.stop();
      expect(healthManager.isRunning()).toBe(false);
    });

    it('should perform periodic health checks when started', async () => {
      const connectionId = 'test-connection';
      mockHealthCheck.mockResolvedValue(true);

      healthManager.registerConnection(connectionId, {
        method: 'ping',
        intervalMs: 1000,
        timeoutMs: 500,
        maxFailures: 3,
        healthCheckFn: mockHealthCheck
      });

      healthManager.start();

      // Advance time to trigger health checks
      await vi.advanceTimersByTimeAsync(2500);

      expect(mockHealthCheck).toHaveBeenCalledTimes(2);

      healthManager.stop();
    });

    it('should emit events on health state changes', () => {
      const connectionId = 'test-connection';
      const healthyCallback = vi.fn();
      const unhealthyCallback = vi.fn();

      healthManager.on('healthy', healthyCallback);
      healthManager.on('unhealthy', unhealthyCallback);

      healthManager.registerConnection(connectionId, {
        method: 'ping',
        intervalMs: 1000,
        timeoutMs: 500,
        maxFailures: 1,
        healthCheckFn: mockHealthCheck
      });

      // Simulate healthy state
      mockHealthCheck.mockResolvedValueOnce(true);
      healthManager.performHealthCheck(connectionId);

      // Simulate unhealthy state
      mockHealthCheck.mockRejectedValueOnce(new Error('Failed'));
      healthManager.performHealthCheck(connectionId);

      // Events are emitted asynchronously
      setTimeout(() => {
        expect(healthyCallback).toHaveBeenCalled();
        expect(unhealthyCallback).toHaveBeenCalled();
      }, 10);
    });
  });

  describe('Health State Management', () => {
    it('should maintain connection health state', async () => {
      const connectionId = 'test-connection';
      mockHealthCheck.mockResolvedValue(true);

      healthManager.registerConnection(connectionId, {
        method: 'ping',
        intervalMs: 5000,
        timeoutMs: 1000,
        maxFailures: 3,
        healthCheckFn: mockHealthCheck
      });

      await healthManager.performHealthCheck(connectionId);

      const state = healthManager.getConnectionState(connectionId);
      expect(state).toBeDefined();
      expect(state?.connectionId).toBe(connectionId);
      expect(state?.isHealthy).toBe(true);
      expect(state?.lastHealthyAt).toBeDefined();
      expect(state?.consecutiveFailures).toBe(0);
    });

    it('should provide all connection states', async () => {
      const connectionIds = ['conn1', 'conn2', 'conn3'];
      mockHealthCheck.mockResolvedValue(true);

      connectionIds.forEach(id => {
        healthManager.registerConnection(id, {
          method: 'ping',
          intervalMs: 5000,
          timeoutMs: 1000,
          maxFailures: 3,
          healthCheckFn: mockHealthCheck
        });
      });

      const allStates = healthManager.getAllConnectionStates();
      expect(allStates).toHaveLength(3);
      expect(allStates.map(s => s.connectionId)).toEqual(connectionIds);
    });

    it('should calculate overall health status', async () => {
      mockHealthCheck.mockResolvedValue(true);

      // Register multiple connections
      ['conn1', 'conn2'].forEach(id => {
        healthManager.registerConnection(id, {
          method: 'ping',
          intervalMs: 5000,
          timeoutMs: 1000,
          maxFailures: 3,
          healthCheckFn: mockHealthCheck
        });
      });

      // All healthy
      await Promise.all(['conn1', 'conn2'].map(id =>
        healthManager.performHealthCheck(id)
      ));

      let overallHealth = healthManager.getOverallHealth();
      expect(overallHealth.status).toBe('healthy');
      expect(overallHealth.healthyCount).toBe(2);
      expect(overallHealth.unhealthyCount).toBe(0);

      // Make one unhealthy
      mockHealthCheck.mockRejectedValueOnce(new Error('Failed'));
      await healthManager.performHealthCheck('conn1');

      overallHealth = healthManager.getOverallHealth();
      expect(overallHealth.status).toBe('degraded');
      expect(overallHealth.healthyCount).toBe(1);
      expect(overallHealth.unhealthyCount).toBe(1);
    });
  });

  describe('Health Check Timeouts', () => {
    it('should handle health check timeouts', async () => {
      const connectionId = 'test-connection';

      // Mock a health check that takes longer than timeout
      mockHealthCheck.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(true), 2000))
      );

      healthManager.registerConnection(connectionId, {
        method: 'ping',
        intervalMs: 5000,
        timeoutMs: 1000, // 1 second timeout
        maxFailures: 3,
        healthCheckFn: mockHealthCheck
      });

      vi.useRealTimers(); // Use real timers for timeout test
      const result = await healthManager.performHealthCheck(connectionId);

      expect(result?.success).toBe(false);
      expect(result?.error).toContain('timeout');
    });

    it('should not timeout for fast health checks', async () => {
      const connectionId = 'test-connection';

      mockHealthCheck.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return true;
      });

      healthManager.registerConnection(connectionId, {
        method: 'ping',
        intervalMs: 5000,
        timeoutMs: 2000,
        maxFailures: 3,
        healthCheckFn: mockHealthCheck
      });

      vi.useRealTimers();
      const result = await healthManager.performHealthCheck(connectionId);

      expect(result?.success).toBe(true);
      expect(result?.latencyMs).toBeLessThan(2000);
    });
  });

  describe('Health Check Methods', () => {
    it('should support different health check methods', () => {
      const methods: HealthCheckMethod[] = ['ping', 'heartbeat', 'custom', 'pooled'];

      methods.forEach(method => {
        const connectionId = `test-${method}`;

        healthManager.registerConnection(connectionId, {
          method,
          intervalMs: 5000,
          timeoutMs: 1000,
          maxFailures: 3,
          healthCheckFn: mockHealthCheck
        });

        const state = healthManager.getConnectionState(connectionId);
        expect(state?.config.method).toBe(method);
      });
    });

    it('should provide health check statistics', async () => {
      const connectionId = 'test-connection';
      mockHealthCheck
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(true);

      healthManager.registerConnection(connectionId, {
        method: 'ping',
        intervalMs: 5000,
        timeoutMs: 1000,
        maxFailures: 3,
        healthCheckFn: mockHealthCheck
      });

      // Perform multiple checks
      await healthManager.performHealthCheck(connectionId);
      await healthManager.performHealthCheck(connectionId);
      await healthManager.performHealthCheck(connectionId);

      const stats = healthManager.getHealthStatistics(connectionId);
      expect(stats).toBeDefined();
      expect(stats?.totalChecks).toBe(3);
      expect(stats?.successfulChecks).toBe(2);
      expect(stats?.failedChecks).toBe(1);
      expect(stats?.successRate).toBe(2/3);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle unregistered connection gracefully', async () => {
      const result = await healthManager.performHealthCheck('non-existent');
      expect(result).toBeNull();
    });

    it('should handle multiple registrations of same connection', () => {
      const connectionId = 'test-connection';

      healthManager.registerConnection(connectionId, {
        method: 'ping',
        intervalMs: 5000,
        timeoutMs: 1000,
        maxFailures: 3,
        healthCheckFn: mockHealthCheck
      });

      // Re-register should update configuration
      const newMockFn = vi.fn();
      healthManager.registerConnection(connectionId, {
        method: 'heartbeat',
        intervalMs: 3000,
        timeoutMs: 500,
        maxFailures: 5,
        healthCheckFn: newMockFn
      });

      const state = healthManager.getConnectionState(connectionId);
      expect(state?.config.method).toBe('heartbeat');
      expect(state?.config.intervalMs).toBe(3000);
    });

    it('should handle health check function throwing synchronously', async () => {
      const connectionId = 'test-connection';

      mockHealthCheck.mockImplementation(() => {
        throw new Error('Synchronous error');
      });

      healthManager.registerConnection(connectionId, {
        method: 'ping',
        intervalMs: 5000,
        timeoutMs: 1000,
        maxFailures: 3,
        healthCheckFn: mockHealthCheck
      });

      const result = await healthManager.performHealthCheck(connectionId);

      expect(result?.success).toBe(false);
      expect(result?.error).toContain('Synchronous error');
    });

    it('should clean up resources when stopped', () => {
      const connectionIds = ['conn1', 'conn2', 'conn3'];

      connectionIds.forEach(id => {
        healthManager.registerConnection(id, {
          method: 'ping',
          intervalMs: 1000,
          timeoutMs: 500,
          maxFailures: 3,
          healthCheckFn: mockHealthCheck
        });
      });

      healthManager.start();
      expect(healthManager.isRunning()).toBe(true);

      healthManager.stop();
      expect(healthManager.isRunning()).toBe(false);

      // Should not perform any more health checks after stopping
      vi.advanceTimersByTime(5000);
      expect(mockHealthCheck).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate health check configuration', () => {
      const connectionId = 'test-connection';

      // Valid configuration should work
      expect(() => {
        healthManager.registerConnection(connectionId, {
          method: 'ping',
          intervalMs: 5000,
          timeoutMs: 1000,
          maxFailures: 3,
          healthCheckFn: mockHealthCheck
        });
      }).not.toThrow();

      // Invalid configurations should throw
      expect(() => {
        healthManager.registerConnection('invalid1', {
          method: 'ping',
          intervalMs: -1000, // Invalid interval
          timeoutMs: 1000,
          maxFailures: 3,
          healthCheckFn: mockHealthCheck
        });
      }).toThrow();

      expect(() => {
        healthManager.registerConnection('invalid2', {
          method: 'ping',
          intervalMs: 5000,
          timeoutMs: -500, // Invalid timeout
          maxFailures: 3,
          healthCheckFn: mockHealthCheck
        });
      }).toThrow();

      expect(() => {
        healthManager.registerConnection('invalid3', {
          method: 'ping',
          intervalMs: 5000,
          timeoutMs: 1000,
          maxFailures: 0, // Invalid max failures
          healthCheckFn: mockHealthCheck
        });
      }).toThrow();
    });

    it('should validate timeout is less than interval', () => {
      const connectionId = 'test-connection';

      expect(() => {
        healthManager.registerConnection(connectionId, {
          method: 'ping',
          intervalMs: 1000,
          timeoutMs: 2000, // Timeout > interval
          maxFailures: 3,
          healthCheckFn: mockHealthCheck
        });
      }).toThrow();
    });
  });
});