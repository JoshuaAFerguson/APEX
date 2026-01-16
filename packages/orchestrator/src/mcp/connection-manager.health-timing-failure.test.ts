/**
 * MCP Connection Health Check Timing and Failure Detection Unit Tests
 *
 * This test suite comprehensively verifies the MCP connection health check system:
 * 1. Health check interval timing accuracy using mocked timers
 * 2. Consecutive failure threshold detection and counting
 * 3. Automatic reconnection triggering after failure threshold
 * 4. Health status event emission patterns and data
 * 5. Configurable timeout handling with various configurations
 *
 * Uses mocked timers for deterministic, reliable timing assertions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { MCPConnectionManager, type MCPConnectionManagerOptions } from './connection-manager.js';
import type { ApexConfig, MCPConnectionConfig } from '@apexcli/core';

// ============================================================================
// Test Configuration Helpers
// ============================================================================

interface HealthTestConfig {
  healthCheckIntervalMs?: number;
  healthCheckTimeoutMs?: number;
  healthCheckFailureThreshold?: number;
  heartbeatEnabled?: boolean;
  autoReconnect?: boolean;
}

function createHealthTestConfig(overrides: HealthTestConfig = {}): ApexConfig {
  const defaults: MCPConnectionConfig = {
    healthCheckIntervalMs: 1000,
    healthCheckTimeoutMs: 500,
    healthCheckFailureThreshold: 3,
    heartbeatEnabled: true,
    autoReconnect: true,
    maxRetries: 5,
    retryDelayMs: 100,
    connectionTimeoutMs: 5000,
    requestTimeoutMs: 10000,
  };

  return {
    version: '1.0',
    project: { name: 'test-project' },
    mcp: {
      enabled: true,
      servers: {
        'health-test-server': {
          name: 'Health Test Server',
          type: 'stdio' as const,
          command: 'test-health',
        },
      },
      connection: { ...defaults, ...overrides },
    },
  } as ApexConfig;
}

// ============================================================================
// Mock Infrastructure
// ============================================================================

// Simple mock implementations for testing
const createMockTransport = () => {
  const emitter = new EventEmitter();
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn(),
    on: vi.fn((event: string, handler: Function) => emitter.on(event, handler)),
    off: vi.fn((event: string, handler: Function) => emitter.off(event, handler)),
    emit: vi.fn((event: string, ...args: any[]) => emitter.emit(event, ...args)),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    _emitter: emitter,
  };
};

const createMockClient = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  listTools: vi.fn().mockResolvedValue([]),
  callTool: vi.fn().mockResolvedValue({}),
  ping: vi.fn().mockResolvedValue(undefined),
  transport: createMockTransport(),
});

// Mock the transport and client modules
vi.mock('./transports/index.js', () => ({
  StdioTransport: vi.fn().mockImplementation(createMockTransport),
}));

vi.mock('./client.js', () => ({
  MCPClient: vi.fn().mockImplementation(createMockClient),
}));

// Mock core dependencies with minimal implementation
vi.mock('@apexcli/core', () => ({
  ExponentialBackoffReconnector: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    notifyConnected: vi.fn(),
    notifyDisconnected: vi.fn(),
    scheduleReconnect: vi.fn(),
    isExhausted: vi.fn(() => false),
    destroy: vi.fn(),
  })),
  ConnectionHealthManager: vi.fn().mockImplementation(() => ({
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
    getHealthState: vi.fn(() => ({
      isHealthy: true,
      consecutiveFailures: 0,
      lastHealthyAt: new Date(),
    })),
    on: vi.fn(),
  })),
}));

// ============================================================================
// Health Check Interval Timing Accuracy Tests
// ============================================================================

describe('MCP Health Check Timing and Failure Detection', () => {
  let manager: MCPConnectionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (manager) {
      manager.removeAllListeners();
    }
    vi.useRealTimers();
  });

  describe('Health Check Interval Timing Accuracy', () => {
    it('should execute health checks at exact configured intervals with mocked timers', async () => {
      const config = createHealthTestConfig({
        healthCheckIntervalMs: 2000, // 2-second intervals
      });

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      const healthCheckEvents: any[] = [];
      manager.on('healthCheck', (serverId, result) => {
        healthCheckEvents.push({ timestamp: Date.now(), serverId, result });
      });

      await manager.connect('health-test-server');

      // Clear events from connection phase
      healthCheckEvents.length = 0;

      // Verify no immediate health check
      expect(healthCheckEvents).toHaveLength(0);

      // First interval: advance by 1.9s - should not trigger
      vi.advanceTimersByTime(1900);
      await vi.runAllTimersAsync();
      expect(healthCheckEvents).toHaveLength(0);

      // Cross the 2s threshold - should trigger first health check
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();
      expect(healthCheckEvents).toHaveLength(1);

      // Verify precise timing for subsequent intervals
      const firstCheckTime = healthCheckEvents[0].timestamp;

      // Second interval
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();
      expect(healthCheckEvents).toHaveLength(2);
      expect(healthCheckEvents[1].timestamp - firstCheckTime).toBe(2000);

      // Third interval
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();
      expect(healthCheckEvents).toHaveLength(3);
      expect(healthCheckEvents[2].timestamp - firstCheckTime).toBe(4000);
    });

    it('should handle various interval configurations with timing precision', async () => {
      const intervals = [500, 1500, 3000, 5000];

      for (const interval of intervals) {
        const config = createHealthTestConfig({
          healthCheckIntervalMs: interval,
        });

        manager = new MCPConnectionManager({
          projectPath: '/test',
          config,
        });

        const healthCheckSpy = vi.fn();
        manager.on('healthCheck', healthCheckSpy);

        await manager.connect('health-test-server');
        healthCheckSpy.mockClear();

        // Test 3 intervals for timing accuracy
        for (let i = 1; i <= 3; i++) {
          vi.advanceTimersByTime(interval);
          await vi.runAllTimersAsync();
          expect(healthCheckSpy).toHaveBeenCalledTimes(i);
        }

        await manager.disconnect('health-test-server');
        manager.removeAllListeners();
      }
    });

    it('should maintain timing accuracy when health checks have varying response times', async () => {
      const config = createHealthTestConfig({
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 3000, // Allow long responses
      });

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      const healthCheckTimes: number[] = [];
      manager.on('healthCheck', () => {
        healthCheckTimes.push(Date.now());
      });

      await manager.connect('health-test-server');

      // Get the mock client to control response times
      const context = (manager as any).connections?.get('health-test-server');
      if (context?.client?.ping) {
        let callCount = 0;
        context.client.ping.mockImplementation(() => {
          const delay = [100, 800, 50, 1500][callCount++ % 4]; // Varying delays
          return new Promise(resolve => setTimeout(resolve, delay));
        });
      }

      healthCheckTimes.length = 0;

      // Trigger 4 health checks with varying response times
      for (let i = 0; i < 4; i++) {
        vi.advanceTimersByTime(1000);
        if (i < 3) vi.advanceTimersByTime(1500); // Allow longest response to complete
        await vi.runAllTimersAsync();
      }

      // Verify intervals remain consistent (1000ms apart)
      expect(healthCheckTimes).toHaveLength(4);
      for (let i = 1; i < healthCheckTimes.length; i++) {
        expect(healthCheckTimes[i] - healthCheckTimes[i - 1]).toBe(1000);
      }
    });
  });

  // ============================================================================
  // Consecutive Failure Threshold Detection Tests
  // ============================================================================

  describe('Consecutive Failure Threshold Detection', () => {
    it('should accurately count consecutive failures up to custom threshold', async () => {
      const config = createHealthTestConfig({
        healthCheckIntervalMs: 1000,
        healthCheckFailureThreshold: 5, // Custom threshold
      });

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      const healthResults: any[] = [];
      manager.on('healthCheck', (serverId, result) => {
        healthResults.push(result);
      });

      await manager.connect('health-test-server');

      // Configure client to fail health checks
      const context = (manager as any).connections?.get('health-test-server');
      if (context?.client?.ping) {
        context.client.ping.mockRejectedValue(new Error('Health check failed'));
      }

      healthResults.length = 0;

      // Trigger failures up to threshold
      for (let i = 1; i <= 5; i++) {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();

        const lastResult = healthResults[healthResults.length - 1];
        expect(lastResult.success).toBe(false);
        expect(lastResult.consecutiveFailures).toBe(i);
        expect(lastResult.isHealthy).toBe(i < 5); // Healthy until threshold reached
      }

      // Verify final unhealthy state
      const healthState = manager.getHealth('health-test-server');
      expect(healthState?.consecutiveFailures).toBe(5);
      expect(healthState?.isHealthy).toBe(false);
    });

    it('should reset consecutive failure count on successful recovery', async () => {
      const config = createHealthTestConfig({
        healthCheckIntervalMs: 800,
        healthCheckFailureThreshold: 3,
      });

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      const healthResults: any[] = [];
      manager.on('healthCheck', (serverId, result) => {
        healthResults.push({ ...result });
      });

      await manager.connect('health-test-server');

      const context = (manager as any).connections?.get('health-test-server');
      if (!context?.client?.ping) {
        return; // Skip if no client available
      }

      healthResults.length = 0;

      // Generate 2 failures
      context.client.ping.mockRejectedValue(new Error('Network error'));

      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();
      expect(healthResults[0].consecutiveFailures).toBe(1);

      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();
      expect(healthResults[1].consecutiveFailures).toBe(2);

      // Recovery: successful health check
      context.client.ping.mockResolvedValue(undefined);

      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      const recoveryResult = healthResults[2];
      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.consecutiveFailures).toBe(0);
      expect(recoveryResult.isHealthy).toBe(true);

      // Verify internal health state is reset
      const healthState = manager.getHealth('health-test-server');
      expect(healthState?.consecutiveFailures).toBe(0);
      expect(healthState?.isHealthy).toBe(true);
    });

    it('should handle different failure threshold values correctly', async () => {
      const thresholds = [1, 2, 4, 7];

      for (const threshold of thresholds) {
        const config = createHealthTestConfig({
          healthCheckIntervalMs: 500,
          healthCheckFailureThreshold: threshold,
        });

        manager = new MCPConnectionManager({
          projectPath: '/test',
          config,
        });

        const healthResults: any[] = [];
        manager.on('healthCheck', (serverId, result) => {
          healthResults.push(result);
        });

        await manager.connect('health-test-server');

        const context = (manager as any).connections?.get('health-test-server');
        if (context?.client?.ping) {
          context.client.ping.mockRejectedValue(new Error('Failure'));
        }

        healthResults.length = 0;

        // Trigger failures up to threshold
        for (let i = 1; i <= threshold; i++) {
          vi.advanceTimersByTime(500);
          await vi.runAllTimersAsync();

          const result = healthResults[i - 1];
          expect(result.consecutiveFailures).toBe(i);
          expect(result.isHealthy).toBe(i < threshold);
        }

        await manager.disconnect('health-test-server');
        manager.removeAllListeners();
      }
    });

    it('should distinguish between timeout and network failure types', async () => {
      const config = createHealthTestConfig({
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 200,
        healthCheckFailureThreshold: 3,
      });

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      const healthResults: any[] = [];
      manager.on('healthCheck', (serverId, result) => {
        healthResults.push(result);
      });

      await manager.connect('health-test-server');

      const context = (manager as any).connections?.get('health-test-server');
      if (!context?.client?.ping) {
        return;
      }

      healthResults.length = 0;

      // Network error failure
      context.client.ping.mockRejectedValue(new Error('Connection refused'));
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(healthResults[0].success).toBe(false);
      expect(healthResults[0].consecutiveFailures).toBe(1);
      expect(healthResults[0].error?.message).toBe('Connection refused');

      // Timeout failure
      context.client.ping.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 1000)) // Longer than timeout
      );
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(healthResults[1].success).toBe(false);
      expect(healthResults[1].consecutiveFailures).toBe(2);
      expect(healthResults[1].error?.message).toBe('Health check timeout');

      // Both should count toward consecutive failures
      const healthState = manager.getHealth('health-test-server');
      expect(healthState?.consecutiveFailures).toBe(2);
    });
  });

  // ============================================================================
  // Automatic Reconnection Triggering Tests
  // ============================================================================

  describe('Automatic Reconnection Triggering After Threshold', () => {
    it('should trigger reconnection exactly when failure threshold is reached', async () => {
      const config = createHealthTestConfig({
        healthCheckIntervalMs: 1000,
        healthCheckFailureThreshold: 3,
        autoReconnect: true,
      });

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      const stateChanges: any[] = [];
      manager.on('stateChange', (serverId, prevState, newState) => {
        stateChanges.push({ serverId, prevState, newState, timestamp: Date.now() });
      });

      await manager.connect('health-test-server');

      const context = (manager as any).connections?.get('health-test-server');
      if (context?.client?.ping) {
        context.client.ping.mockRejectedValue(new Error('Health failure'));
      }

      stateChanges.length = 0;

      // First 2 failures - should not trigger reconnection
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(stateChanges).toHaveLength(0); // No state changes yet

      // 3rd failure - should trigger reconnection
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(stateChanges).toHaveLength(1);
      expect(stateChanges[0]).toEqual({
        serverId: 'health-test-server',
        prevState: 'connected',
        newState: 'disconnected',
        timestamp: expect.any(Number),
      });
    });

    it('should not trigger reconnection when autoReconnect is disabled', async () => {
      const config = createHealthTestConfig({
        healthCheckIntervalMs: 500,
        healthCheckFailureThreshold: 2,
        autoReconnect: false, // Disabled
      });

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      const stateChanges: any[] = [];
      manager.on('stateChange', (serverId, prevState, newState) => {
        stateChanges.push({ serverId, prevState, newState });
      });

      await manager.connect('health-test-server');

      const context = (manager as any).connections?.get('health-test-server');
      if (context?.client?.ping) {
        context.client.ping.mockRejectedValue(new Error('Failure'));
      }

      stateChanges.length = 0;

      // Trigger failures beyond threshold
      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();
      }

      // Should mark as unhealthy but not trigger reconnection
      const healthState = manager.getHealth('health-test-server');
      expect(healthState?.isHealthy).toBe(false);
      expect(stateChanges).toHaveLength(0); // No reconnection triggered
    });

    it('should trigger reconnection only once per failure episode', async () => {
      const config = createHealthTestConfig({
        healthCheckIntervalMs: 800,
        healthCheckFailureThreshold: 2,
        autoReconnect: true,
      });

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      const stateChanges: any[] = [];
      manager.on('stateChange', (serverId, prevState, newState) => {
        stateChanges.push({ serverId, prevState, newState });
      });

      await manager.connect('health-test-server');

      const context = (manager as any).connections?.get('health-test-server');
      if (context?.client?.ping) {
        context.client.ping.mockRejectedValue(new Error('Persistent failure'));
      }

      stateChanges.length = 0;

      // Trigger threshold failures (2)
      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();
      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      expect(stateChanges).toHaveLength(1); // One reconnection triggered

      // Additional failures should not trigger more reconnections
      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(800);
        await vi.runAllTimersAsync();
      }

      expect(stateChanges).toHaveLength(1); // Still only one reconnection
    });

    it('should reset reconnection trigger after successful recovery', async () => {
      const config = createHealthTestConfig({
        healthCheckIntervalMs: 1000,
        healthCheckFailureThreshold: 2,
        autoReconnect: true,
      });

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      const stateChanges: any[] = [];
      manager.on('stateChange', (serverId, prevState, newState) => {
        stateChanges.push({ serverId, prevState, newState, episode: stateChanges.length + 1 });
      });

      await manager.connect('health-test-server');

      const context = (manager as any).connections?.get('health-test-server');
      if (!context?.client?.ping) {
        return;
      }

      stateChanges.length = 0;

      // First failure episode
      context.client.ping.mockRejectedValue(new Error('First episode'));

      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(stateChanges).toHaveLength(1);
      expect(stateChanges[0].episode).toBe(1);

      // Recovery
      context.client.ping.mockResolvedValue(undefined);
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // Second failure episode should trigger another reconnection
      context.client.ping.mockRejectedValue(new Error('Second episode'));

      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(stateChanges).toHaveLength(2);
      expect(stateChanges[1].episode).toBe(2);
    });
  });

  // ============================================================================
  // Health Status Event Emission Tests
  // ============================================================================

  describe('Health Status Event Emission', () => {
    it('should emit healthCheck events with complete and accurate result data', async () => {
      const config = createHealthTestConfig({
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 500,
      });

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      const healthEvents: any[] = [];
      manager.on('healthCheck', (serverId, result) => {
        healthEvents.push({
          serverId,
          result: { ...result }, // Clone to avoid mutations
          timestamp: Date.now(),
        });
      });

      await manager.connect('health-test-server');
      healthEvents.length = 0;

      // Trigger successful health check
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(healthEvents).toHaveLength(1);
      const event = healthEvents[0];

      expect(event.serverId).toBe('health-test-server');
      expect(event.result).toMatchObject({
        success: true,
        latencyMs: expect.any(Number),
        consecutiveFailures: 0,
        isHealthy: true,
        timestamp: expect.any(Date),
        error: undefined,
      });

      expect(event.result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(event.result.timestamp).toBeInstanceOf(Date);
    });

    it('should emit healthCheck events with detailed error information on failures', async () => {
      const config = createHealthTestConfig({
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 200,
      });

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      const healthEvents: any[] = [];
      manager.on('healthCheck', (serverId, result) => {
        healthEvents.push({ serverId, result: { ...result } });
      });

      await manager.connect('health-test-server');

      const context = (manager as any).connections?.get('health-test-server');
      if (context?.client?.ping) {
        const testError = new Error('Connection timeout');
        context.client.ping.mockRejectedValue(testError);
      }

      healthEvents.length = 0;

      // Trigger failed health check
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(healthEvents).toHaveLength(1);
      const event = healthEvents[0];

      expect(event.result).toMatchObject({
        success: false,
        latencyMs: undefined,
        consecutiveFailures: 1,
        isHealthy: true, // Still healthy until threshold
        timestamp: expect.any(Date),
        error: expect.objectContaining({
          message: 'Connection timeout',
        }),
      });
    });

    it('should emit stateChange events when health status transitions occur', async () => {
      const config = createHealthTestConfig({
        healthCheckIntervalMs: 1000,
        healthCheckFailureThreshold: 2,
        autoReconnect: true,
      });

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      const stateEvents: any[] = [];
      manager.on('stateChange', (serverId, prevState, newState) => {
        stateEvents.push({
          serverId,
          prevState,
          newState,
          timestamp: Date.now(),
        });
      });

      await manager.connect('health-test-server');

      const context = (manager as any).connections?.get('health-test-server');
      if (context?.client?.ping) {
        context.client.ping.mockRejectedValue(new Error('Health failure'));
      }

      stateEvents.length = 0;

      // First failure - no state change
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      expect(stateEvents).toHaveLength(0);

      // Second failure - should trigger state change
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(stateEvents).toHaveLength(1);
      expect(stateEvents[0]).toMatchObject({
        serverId: 'health-test-server',
        prevState: 'connected',
        newState: 'disconnected',
        timestamp: expect.any(Number),
      });
    });

    it('should emit events in correct chronological sequence during failure scenarios', async () => {
      const config = createHealthTestConfig({
        healthCheckIntervalMs: 800,
        healthCheckFailureThreshold: 2,
        autoReconnect: true,
      });

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      const allEvents: Array<{ type: string; data: any; timestamp: number }> = [];

      manager.on('healthCheck', (serverId, result) => {
        allEvents.push({
          type: 'healthCheck',
          data: { serverId, result: { ...result } },
          timestamp: Date.now(),
        });
      });

      manager.on('stateChange', (serverId, prevState, newState) => {
        allEvents.push({
          type: 'stateChange',
          data: { serverId, prevState, newState },
          timestamp: Date.now(),
        });
      });

      await manager.connect('health-test-server');

      const context = (manager as any).connections?.get('health-test-server');
      if (context?.client?.ping) {
        context.client.ping.mockRejectedValue(new Error('Health failure'));
      }

      allEvents.length = 0;

      // Trigger failure sequence
      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      // Verify event sequence and timing
      expect(allEvents).toHaveLength(3);

      // Events should be in chronological order
      for (let i = 1; i < allEvents.length; i++) {
        expect(allEvents[i].timestamp).toBeGreaterThanOrEqual(allEvents[i - 1].timestamp);
      }

      // Verify specific event sequence
      expect(allEvents[0].type).toBe('healthCheck');
      expect(allEvents[0].data.result.consecutiveFailures).toBe(1);

      expect(allEvents[1].type).toBe('healthCheck');
      expect(allEvents[1].data.result.consecutiveFailures).toBe(2);

      expect(allEvents[2].type).toBe('stateChange');
      expect(allEvents[2].data.newState).toBe('disconnected');
    });
  });

  // ============================================================================
  // Configurable Timeout Handling Tests
  // ============================================================================

  describe('Configurable Timeout Handling', () => {
    it('should respect various custom health check timeout configurations', async () => {
      const timeouts = [100, 300, 800, 2000];

      for (const timeout of timeouts) {
        const config = createHealthTestConfig({
          healthCheckIntervalMs: 3000,
          healthCheckTimeoutMs: timeout,
          healthCheckFailureThreshold: 1,
        });

        manager = new MCPConnectionManager({
          projectPath: '/test',
          config,
        });

        const healthEvents: any[] = [];
        manager.on('healthCheck', (serverId, result) => {
          healthEvents.push(result);
        });

        await manager.connect('health-test-server');

        const context = (manager as any).connections?.get('health-test-server');
        if (context?.client?.ping) {
          // Mock ping to take longer than timeout
          context.client.ping.mockImplementation(() =>
            new Promise(resolve => setTimeout(resolve, timeout + 200))
          );
        }

        healthEvents.length = 0;

        // Trigger health check and advance past timeout
        vi.advanceTimersByTime(3000);
        vi.advanceTimersByTime(timeout + 300);
        await vi.runAllTimersAsync();

        expect(healthEvents).toHaveLength(1);
        expect(healthEvents[0].success).toBe(false);
        expect(healthEvents[0].error?.message).toBe('Health check timeout');

        await manager.disconnect('health-test-server');
        manager.removeAllListeners();
      }
    });

    it('should not timeout when responses are within configured limits', async () => {
      const config = createHealthTestConfig({
        healthCheckIntervalMs: 2000,
        healthCheckTimeoutMs: 1000,
      });

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      const healthEvents: any[] = [];
      manager.on('healthCheck', (serverId, result) => {
        healthEvents.push(result);
      });

      await manager.connect('health-test-server');

      const context = (manager as any).connections?.get('health-test-server');
      if (context?.client?.ping) {
        // Mock ping to respond within timeout
        context.client.ping.mockImplementation(() =>
          new Promise(resolve => setTimeout(resolve, 800)) // Less than 1000ms timeout
        );
      }

      healthEvents.length = 0;

      // Trigger health check
      vi.advanceTimersByTime(2000);
      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      expect(healthEvents).toHaveLength(1);
      expect(healthEvents[0].success).toBe(true);
      expect(healthEvents[0].latencyMs).toBeGreaterThanOrEqual(800);
    });

    it('should handle timeout edge cases with millisecond precision', async () => {
      const config = createHealthTestConfig({
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 500,
      });

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      const healthEvents: any[] = [];
      manager.on('healthCheck', (serverId, result) => {
        healthEvents.push(result);
      });

      await manager.connect('health-test-server');

      const context = (manager as any).connections?.get('health-test-server');
      if (!context?.client?.ping) {
        return;
      }

      healthEvents.length = 0;

      // Test exactly at timeout boundary (should succeed)
      context.client.ping.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 499)) // Just under timeout
      );

      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      expect(healthEvents[0].success).toBe(true);

      // Test just over timeout boundary (should fail)
      context.client.ping.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 501)) // Just over timeout
      );

      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(502);
      await vi.runAllTimersAsync();

      expect(healthEvents[1].success).toBe(false);
      expect(healthEvents[1].error?.message).toBe('Health check timeout');
    });

    it('should track accurate latency measurements for different response times', async () => {
      const config = createHealthTestConfig({
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 2000,
      });

      manager = new MCPConnectionManager({
        projectPath: '/test',
        config,
      });

      const latencyMeasurements: number[] = [];
      manager.on('healthCheck', (serverId, result) => {
        if (result.success && result.latencyMs !== undefined) {
          latencyMeasurements.push(result.latencyMs);
        }
      });

      await manager.connect('health-test-server');

      const context = (manager as any).connections?.get('health-test-server');
      if (!context?.client?.ping) {
        return;
      }

      const responseTimes = [50, 100, 250, 500, 750, 1000];

      for (const responseTime of responseTimes) {
        context.client.ping.mockImplementation(() =>
          new Promise(resolve => setTimeout(resolve, responseTime))
        );

        vi.advanceTimersByTime(1000);
        vi.advanceTimersByTime(responseTime);
        await vi.runAllTimersAsync();
      }

      expect(latencyMeasurements).toHaveLength(responseTimes.length);

      // Verify latency measurements are accurate (within reasonable tolerance)
      for (let i = 0; i < responseTimes.length; i++) {
        expect(latencyMeasurements[i]).toBeGreaterThanOrEqual(responseTimes[i] - 10);
        expect(latencyMeasurements[i]).toBeLessThanOrEqual(responseTimes[i] + 10);
      }
    });

    it('should apply timeouts correctly for both heartbeat and listTools health checks', async () => {
      const timeoutTests = [
        { heartbeatEnabled: true, description: 'heartbeat ping method' },
        { heartbeatEnabled: false, description: 'listTools fallback method' },
      ];

      for (const test of timeoutTests) {
        const config = createHealthTestConfig({
          healthCheckIntervalMs: 1000,
          healthCheckTimeoutMs: 300,
          heartbeatEnabled: test.heartbeatEnabled,
        });

        manager = new MCPConnectionManager({
          projectPath: '/test',
          config,
        });

        const healthEvents: any[] = [];
        manager.on('healthCheck', (serverId, result) => {
          healthEvents.push(result);
        });

        await manager.connect('health-test-server');

        const context = (manager as any).connections?.get('health-test-server');
        if (!context?.client) {
          continue;
        }

        // Mock appropriate method to timeout
        if (test.heartbeatEnabled && context.client.ping) {
          context.client.ping.mockImplementation(() =>
            new Promise(resolve => setTimeout(resolve, 400)) // Over timeout
          );
          if (context.client.listTools) {
            context.client.listTools.mockResolvedValue([]);
          }
        } else if (context.client.listTools) {
          context.client.listTools.mockImplementation(() =>
            new Promise(resolve => setTimeout(resolve, 400)) // Over timeout
          );
          if (context.client.ping) {
            context.client.ping.mockResolvedValue(undefined);
          }
        }

        healthEvents.length = 0;

        // Trigger health check
        vi.advanceTimersByTime(1000);
        vi.advanceTimersByTime(400);
        await vi.runAllTimersAsync();

        expect(healthEvents).toHaveLength(1);
        expect(healthEvents[0].success).toBe(false);
        expect(healthEvents[0].error?.message).toBe('Health check timeout');

        await manager.disconnect('health-test-server');
        manager.removeAllListeners();
      }
    });
  });
});