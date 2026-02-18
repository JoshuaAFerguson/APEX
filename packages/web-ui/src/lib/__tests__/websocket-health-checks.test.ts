/**
 * Unit tests for WebSocket health check timing and failure detection
 *
 * Tests the health check mechanisms in ApexWebSocketClient including:
 * - Health check interval timing
 * - Ping/pong timeout detection
 * - Health status tracking
 * - Reconnection trigger on health failure
 * - Health event emission
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexWebSocketClient, type HealthCheckEvent, type WebSocketHealthConfig } from '../websocket-client';

// Mock WebSocket with health check support
class MockWebSocket {
  public static CONNECTING = 0;
  public static OPEN = 1;
  public static CLOSING = 2;
  public static CLOSED = 3;

  public readyState = MockWebSocket.CONNECTING;
  public url: string;
  public onopen: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;

  private sentMessages: string[] = [];
  public autoRespondToPing = true;
  public pingResponseDelay = 10;
  public shouldFailPing = false;

  constructor(url: string) {
    this.url = url;
    // Simulate connection delay
    setTimeout(() => {
      if (this.readyState === MockWebSocket.CONNECTING) {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.(new Event('open'));
      }
    }, 10);
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }

    this.sentMessages.push(data);

    // Auto-respond to ping if enabled
    if (this.autoRespondToPing && !this.shouldFailPing) {
      try {
        const message = JSON.parse(data);
        if (message.type === 'ping') {
          setTimeout(() => {
            const pongMessage = {
              type: 'pong',
              id: message.id,
              timestamp: message.timestamp,
              serverTimestamp: Date.now()
            };
            this.onmessage?.(new MessageEvent('message', {
              data: JSON.stringify(pongMessage)
            }));
          }, this.pingResponseDelay);
        }
      } catch (error) {
        // Ignore non-JSON messages
      }
    }
  }

  getSentMessages(): string[] {
    return [...this.sentMessages];
  }

  clearSentMessages(): void {
    this.sentMessages = [];
  }

  // Simulate server sending ping
  simulateServerPing(timestamp = Date.now()): void {
    if (this.readyState === MockWebSocket.OPEN) {
      const pingMessage = {
        type: 'ping',
        timestamp
      };
      this.onmessage?.(new MessageEvent('message', {
        data: JSON.stringify(pingMessage)
      }));
    }
  }
}

// Mock global WebSocket and crypto
global.WebSocket = MockWebSocket as any;
global.crypto = {
  randomUUID: () => `mock-uuid-${Math.random().toString(36).substr(2, 9)}`
} as any;

describe('WebSocket Health Check Tests', () => {
  let client: ApexWebSocketClient;
  let mockWs: MockWebSocket;
  let consoleLogs: string[] = [];
  let consoleWarnings: string[] = [];

  beforeEach(() => {
    vi.useFakeTimers();

    // Capture console output
    consoleLogs = [];
    consoleWarnings = [];

    vi.spyOn(console, 'log').mockImplementation((message) => {
      consoleLogs.push(message);
    });
    vi.spyOn(console, 'warn').mockImplementation((message) => {
      consoleWarnings.push(message);
    });
  });

  afterEach(() => {
    client?.disconnect();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Health Check Interval Timing', () => {
    it('should start health check timer on connection with default interval', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000 // 1 second for testing
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);
      client.connect();

      // Wait for connection
      await vi.advanceTimersByTimeAsync(20);
      mockWs = client['ws'] as unknown as MockWebSocket;
      expect(mockWs.readyState).toBe(MockWebSocket.OPEN);

      // Clear initial messages
      mockWs.clearSentMessages();

      // Advance time by health check interval
      await vi.advanceTimersByTimeAsync(1000);

      // Should have sent a ping message
      const sentMessages = mockWs.getSentMessages();
      expect(sentMessages).toHaveLength(1);

      const pingMessage = JSON.parse(sentMessages[0]);
      expect(pingMessage.type).toBe('ping');
      expect(pingMessage.id).toBeTruthy();
      expect(pingMessage.timestamp).toBeTruthy();
    });

    it('should respect custom health check interval', async () => {
      const customInterval = 5000;
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: customInterval
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);
      client.connect();

      await vi.advanceTimersByTimeAsync(20);
      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.clearSentMessages();

      // Should not send ping before custom interval
      await vi.advanceTimersByTimeAsync(customInterval - 100);
      expect(mockWs.getSentMessages()).toHaveLength(0);

      // Should send ping after custom interval
      await vi.advanceTimersByTimeAsync(200);
      expect(mockWs.getSentMessages()).toHaveLength(1);
    });

    it('should continue sending pings at regular intervals', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 500
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);
      client.connect();

      await vi.advanceTimersByTimeAsync(20);
      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.clearSentMessages();

      // Advance through multiple intervals
      await vi.advanceTimersByTimeAsync(500);
      expect(mockWs.getSentMessages()).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(500);
      expect(mockWs.getSentMessages()).toHaveLength(2);

      await vi.advanceTimersByTimeAsync(500);
      expect(mockWs.getSentMessages()).toHaveLength(3);
    });

    it('should not send health checks when disabled', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: false,
        healthCheckIntervalMs: 1000
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);
      client.connect();

      await vi.advanceTimersByTimeAsync(20);
      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.clearSentMessages();

      // Wait longer than interval
      await vi.advanceTimersByTimeAsync(2000);

      // Should not have sent any pings
      expect(mockWs.getSentMessages()).toHaveLength(0);
    });
  });

  describe('Ping/Pong Timeout Detection', () => {
    it('should detect ping timeout and mark connection as unhealthy', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 500
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      const healthEvents: HealthCheckEvent[] = [];
      client.onHealth((event) => {
        healthEvents.push(event);
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.autoRespondToPing = false; // Disable auto-response to simulate timeout
      mockWs.clearSentMessages();

      // Trigger health check
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockWs.getSentMessages()).toHaveLength(1);

      // Wait for timeout
      await vi.advanceTimersByTimeAsync(500);

      // Should have marked connection as unhealthy
      expect(client.isHealthy()).toBe(false);

      // Should have emitted health event
      const unhealthyEvents = healthEvents.filter(e => e.type === 'health:unhealthy');
      expect(unhealthyEvents).toHaveLength(1);
      expect(unhealthyEvents[0].error).toContain('Ping timeout');
    });

    it('should handle successful ping/pong and maintain healthy status', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 500
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      const healthEvents: HealthCheckEvent[] = [];
      client.onHealth((event) => {
        healthEvents.push(event);
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.autoRespondToPing = true;
      mockWs.pingResponseDelay = 50; // Respond within timeout
      mockWs.clearSentMessages();

      // Trigger health check
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockWs.getSentMessages()).toHaveLength(1);

      // Wait for pong response
      await vi.advanceTimersByTimeAsync(100);

      // Should remain healthy
      expect(client.isHealthy()).toBe(true);

      // Should have emitted health check event
      const healthCheckEvents = healthEvents.filter(e => e.type === 'health:check');
      expect(healthCheckEvents.length).toBeGreaterThan(0);

      const lastCheckEvent = healthCheckEvents[healthCheckEvents.length - 1];
      expect(lastCheckEvent.isHealthy).toBe(true);
      expect(lastCheckEvent.latencyMs).toBeTruthy();
    });

    it('should calculate and track latency metrics', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 500
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.autoRespondToPing = true;
      mockWs.pingResponseDelay = 100;

      // Perform multiple health checks to build latency history
      for (let i = 0; i < 3; i++) {
        mockWs.clearSentMessages();
        await vi.advanceTimersByTimeAsync(1000);
        await vi.advanceTimersByTimeAsync(150);
      }

      // Check health state has latency metrics
      const healthState = client.getHealthState();
      expect(healthState.averageLatencyMs).toBeGreaterThan(0);
      expect(healthState.lastPingAt).toBeTruthy();
      expect(healthState.lastPongAt).toBeTruthy();
    });
  });

  describe('Health Status Tracking', () => {
    it('should track consecutive failure count', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 300,
        healthCheckFailureThreshold: 3
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      const healthEvents: HealthCheckEvent[] = [];
      client.onHealth((event) => {
        healthEvents.push(event);
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.autoRespondToPing = false; // Simulate ping failures

      // Trigger multiple failed health checks
      for (let i = 0; i < 2; i++) {
        mockWs.clearSentMessages();
        await vi.advanceTimersByTimeAsync(1000); // Trigger ping
        await vi.advanceTimersByTimeAsync(400);   // Wait for timeout
      }

      // Check consecutive failures are tracked
      const healthState = client.getHealthState();
      expect(healthState.consecutiveFailures).toBe(2);
      expect(healthState.isHealthy).toBe(false);

      // Check health events
      const unhealthyEvents = healthEvents.filter(e => !e.isHealthy);
      expect(unhealthyEvents.length).toBe(2);
      expect(unhealthyEvents[1].consecutiveFailures).toBe(2);
    });

    it('should reset consecutive failures on successful health check', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 300
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;

      // First, simulate a failure
      mockWs.autoRespondToPing = false;
      mockWs.clearSentMessages();
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(400);

      expect(client.getHealthState().consecutiveFailures).toBe(1);

      // Then, simulate success
      mockWs.autoRespondToPing = true;
      mockWs.clearSentMessages();
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(100);

      // Consecutive failures should be reset
      const healthState = client.getHealthState();
      expect(healthState.consecutiveFailures).toBe(0);
      expect(healthState.isHealthy).toBe(true);
    });

    it('should update last healthy timestamp on successful checks', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 500
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      const initialHealthState = client.getHealthState();
      const initialHealthyAt = initialHealthState.lastHealthyAt;

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.autoRespondToPing = true;

      // Wait a bit then trigger health check
      await vi.advanceTimersByTimeAsync(100);
      mockWs.clearSentMessages();
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(100);

      const updatedHealthState = client.getHealthState();
      expect(updatedHealthState.lastHealthyAt).toBeTruthy();
      if (initialHealthyAt) {
        expect(updatedHealthState.lastHealthyAt!.getTime()).toBeGreaterThan(initialHealthyAt.getTime());
      }
    });
  });

  describe('Reconnection Trigger on Health Failure', () => {
    it('should trigger reconnection after reaching failure threshold', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 300,
        healthCheckFailureThreshold: 2
      };

      client = new ApexWebSocketClient('ws://localhost:3000', {
        baseDelayMs: 100,
        maxRetries: 5
      }, healthConfig);

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.autoRespondToPing = false;

      // Spy on WebSocket close method
      const closeSpy = vi.spyOn(mockWs, 'close');

      // Trigger failures to reach threshold
      for (let i = 0; i < 2; i++) {
        mockWs.clearSentMessages();
        await vi.advanceTimersByTimeAsync(1000);
        await vi.advanceTimersByTimeAsync(400);
      }

      // Should have triggered reconnection by closing connection
      expect(closeSpy).toHaveBeenCalledWith(1006, 'Health check failed');

      // Should log warning about health check failures
      const warningLogs = consoleWarnings.filter(log =>
        log.includes('Health check failed') && log.includes('triggering reconnection')
      );
      expect(warningLogs.length).toBeGreaterThan(0);
    });

    it('should not trigger reconnection before reaching threshold', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 300,
        healthCheckFailureThreshold: 3
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.autoRespondToPing = false;

      const closeSpy = vi.spyOn(mockWs, 'close');

      // Trigger failures but not reaching threshold
      for (let i = 0; i < 2; i++) {
        mockWs.clearSentMessages();
        await vi.advanceTimersByTimeAsync(1000);
        await vi.advanceTimersByTimeAsync(400);
      }

      // Should not have closed connection yet
      expect(closeSpy).not.toHaveBeenCalled();
      expect(client.getHealthState().consecutiveFailures).toBe(2);
    });

    it('should not trigger reconnection when shouldReconnect is false', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 300,
        healthCheckFailureThreshold: 1
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      // Disable reconnection
      client['shouldReconnect'] = false;

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.autoRespondToPing = false;

      const closeSpy = vi.spyOn(mockWs, 'close');

      // Trigger failure
      mockWs.clearSentMessages();
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(400);

      // Should not have closed connection
      expect(closeSpy).not.toHaveBeenCalled();
    });
  });

  describe('Health Event Emission', () => {
    it('should emit health:healthy event on initial connection', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      const healthEvents: HealthCheckEvent[] = [];
      client.onHealth((event) => {
        healthEvents.push(event);
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      // Should emit healthy event on connection
      const healthyEvents = healthEvents.filter(e => e.type === 'health:healthy');
      expect(healthyEvents).toHaveLength(1);
      expect(healthyEvents[0].isHealthy).toBe(true);
      expect(healthyEvents[0].consecutiveFailures).toBe(0);
    });

    it('should emit health:unhealthy event on first failure', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 300
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      const healthEvents: HealthCheckEvent[] = [];
      client.onHealth((event) => {
        healthEvents.push(event);
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.autoRespondToPing = false;

      // Clear initial events
      healthEvents.length = 0;

      // Trigger failure
      mockWs.clearSentMessages();
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(400);

      // Should emit unhealthy event
      const unhealthyEvents = healthEvents.filter(e => e.type === 'health:unhealthy');
      expect(unhealthyEvents).toHaveLength(1);
      expect(unhealthyEvents[0].isHealthy).toBe(false);
      expect(unhealthyEvents[0].consecutiveFailures).toBe(1);
      expect(unhealthyEvents[0].error).toContain('Ping timeout');
    });

    it('should emit health:recovered event when recovering from unhealthy state', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 300
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      const healthEvents: HealthCheckEvent[] = [];
      client.onHealth((event) => {
        healthEvents.push(event);
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;

      // First cause a failure
      mockWs.autoRespondToPing = false;
      healthEvents.length = 0; // Clear initial events

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(400);
      expect(client.isHealthy()).toBe(false);

      // Then recover
      mockWs.autoRespondToPing = true;
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(100);

      // Should emit recovered event
      const recoveredEvents = healthEvents.filter(e => e.type === 'health:recovered');
      expect(recoveredEvents).toHaveLength(1);
      expect(recoveredEvents[0].isHealthy).toBe(true);
      expect(recoveredEvents[0].consecutiveFailures).toBe(0);
    });

    it('should emit health:check events for ongoing checks', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 500
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      const healthEvents: HealthCheckEvent[] = [];
      client.onHealth((event) => {
        healthEvents.push(event);
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.autoRespondToPing = true;

      healthEvents.length = 0; // Clear initial events

      // Trigger multiple health checks
      for (let i = 0; i < 3; i++) {
        mockWs.clearSentMessages();
        await vi.advanceTimersByTimeAsync(1000);
        await vi.advanceTimersByTimeAsync(100);
      }

      // Should have health:check events for ongoing monitoring
      const checkEvents = healthEvents.filter(e => e.type === 'health:check');
      expect(checkEvents.length).toBe(3);

      checkEvents.forEach(event => {
        expect(event.isHealthy).toBe(true);
        expect(event.latencyMs).toBeGreaterThan(0);
        expect(event.consecutiveFailures).toBe(0);
      });
    });

    it('should handle health event handler errors gracefully', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 500
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      // Add a handler that throws an error
      client.onHealth(() => {
        throw new Error('Handler error');
      });

      // Add a working handler
      const workingEvents: HealthCheckEvent[] = [];
      client.onHealth((event) => {
        workingEvents.push(event);
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      // Should still emit events to working handlers
      expect(workingEvents.length).toBeGreaterThan(0);

      // Should not crash the client
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('Manual Health Check', () => {
    it('should support manual health check trigger', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: false, // Disable automatic checks
        healthCheckTimeoutMs: 500
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.autoRespondToPing = true;
      mockWs.clearSentMessages();

      // Trigger manual health check
      const healthCheckPromise = client.checkHealth();
      await vi.advanceTimersByTimeAsync(100);

      const result = await healthCheckPromise;

      // Should have sent a ping
      const sentMessages = mockWs.getSentMessages();
      expect(sentMessages).toHaveLength(1);

      const pingMessage = JSON.parse(sentMessages[0]);
      expect(pingMessage.type).toBe('ping');

      // Should return health check result
      expect(result.type).toBe('health:check');
      expect(result.isHealthy).toBe(true);
      expect(result.latencyMs).toBeTruthy();
    });

    it('should handle manual health check when not connected', async () => {
      client = new ApexWebSocketClient('ws://localhost:3000');

      // Don't connect
      const result = await client.checkHealth();

      expect(result.type).toBe('health:check');
      expect(result.isHealthy).toBe(false);
      expect(result.error).toBe('Not connected');
    });

    it('should timeout manual health check', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckTimeoutMs: 200
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.autoRespondToPing = false; // Don't respond to ping

      // Trigger manual health check
      const healthCheckPromise = client.checkHealth();
      await vi.advanceTimersByTimeAsync(300);

      const result = await healthCheckPromise;

      expect(result.type).toBe('health:check');
      expect(result.isHealthy).toBe(false);
      expect(result.error).toBe('Health check timeout');
    });
  });

  describe('Health Check Cleanup', () => {
    it('should stop health checks on disconnect', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.clearSentMessages();

      // Disconnect
      client.disconnect();

      // Advance time past health check interval
      await vi.advanceTimersByTimeAsync(2000);

      // Should not have sent any pings after disconnect
      expect(mockWs.getSentMessages()).toHaveLength(0);
    });

    it('should clear pending ping timeouts on disconnect', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 5000
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.autoRespondToPing = false;

      // Trigger health check
      await vi.advanceTimersByTimeAsync(1000);
      expect(client['pendingPingId']).toBeTruthy();

      // Disconnect before timeout
      client.disconnect();

      // Should have cleared pending ping
      expect(client['pingTimeoutTimer']).toBeNull();
    });

    it('should mark as unhealthy on connection close', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      const healthEvents: HealthCheckEvent[] = [];
      client.onHealth((event) => {
        healthEvents.push(event);
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      expect(client.isHealthy()).toBe(true);

      // Simulate connection close
      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.close(1006, 'Connection lost');

      // Should be marked as unhealthy
      expect(client.isHealthy()).toBe(false);

      // Should emit unhealthy event
      const unhealthyEvents = healthEvents.filter(e => !e.isHealthy);
      expect(unhealthyEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle WebSocket send failures gracefully', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;

      // Mock send to throw error
      vi.spyOn(mockWs, 'send').mockImplementation(() => {
        throw new Error('Network error');
      });

      // Trigger health check
      await vi.advanceTimersByTimeAsync(1000);

      // Should handle error gracefully and mark as unhealthy
      expect(client.isHealthy()).toBe(false);
    });

    it('should handle invalid pong responses', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 500
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      const healthEvents: HealthCheckEvent[] = [];
      client.onHealth((event) => {
        healthEvents.push(event);
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.autoRespondToPing = false;

      // Trigger health check
      await vi.advanceTimersByTimeAsync(1000);
      const sentMessages = mockWs.getSentMessages();
      const pingMessage = JSON.parse(sentMessages[0]);

      // Send invalid pong (wrong ID)
      const invalidPongMessage = {
        type: 'pong',
        id: 'wrong-id',
        timestamp: pingMessage.timestamp,
        serverTimestamp: Date.now()
      };

      mockWs.onmessage?.(new MessageEvent('message', {
        data: JSON.stringify(invalidPongMessage)
      }));

      // Wait for timeout since invalid pong shouldn't count
      await vi.advanceTimersByTimeAsync(500);

      // Should still timeout and be marked unhealthy
      expect(client.isHealthy()).toBe(false);
    });

    it('should handle concurrent ping/pong cycles correctly', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 500,
        healthCheckTimeoutMs: 200
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.autoRespondToPing = true;
      mockWs.pingResponseDelay = 50;

      // Let multiple ping cycles run
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(500);
        await vi.advanceTimersByTimeAsync(100);
      }

      // Should maintain healthy status throughout
      expect(client.isHealthy()).toBe(true);

      // Should have proper latency tracking
      const healthState = client.getHealthState();
      expect(healthState.averageLatencyMs).toBeGreaterThan(0);
    });

    it('should handle server-initiated ping messages', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.clearSentMessages();

      // Simulate server sending a ping
      mockWs.simulateServerPing(Date.now());

      // Wait a moment for processing
      await vi.advanceTimersByTimeAsync(10);

      // Should have responded with pong
      const sentMessages = mockWs.getSentMessages();
      expect(sentMessages).toHaveLength(1);

      const pongMessage = JSON.parse(sentMessages[0]);
      expect(pongMessage.type).toBe('pong');
      expect(pongMessage.timestamp).toBeTruthy();
      expect(pongMessage.serverTimestamp).toBeTruthy();
    });

    it('should handle rapid connection state changes during health checks', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 100,
        healthCheckTimeoutMs: 50
      };

      client = new ApexWebSocketClient('ws://localhost:3000', {
        baseDelayMs: 10,
        maxRetries: 3
      }, healthConfig);

      // Simulate rapid connect/disconnect cycles
      for (let i = 0; i < 3; i++) {
        client.connect();
        await vi.advanceTimersByTimeAsync(50);

        if (client['ws']) {
          (client['ws'] as unknown as MockWebSocket).close(1006, 'Rapid disconnect');
        }
        await vi.advanceTimersByTimeAsync(20);
      }

      // Should handle this gracefully without crashing
      expect(client['healthCheckTimer']).toBeNull();
    });

    it('should validate health check configuration parameters', () => {
      // Test with zero interval (should disable health checks)
      const zeroIntervalConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 0
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, zeroIntervalConfig);
      expect(client['healthConfig'].healthCheckIntervalMs).toBe(0);

      // Test with very large timeout
      const largeTimeoutConfig: Partial<WebSocketHealthConfig> = {
        healthCheckTimeoutMs: 60000 // 1 minute
      };

      const client2 = new ApexWebSocketClient('ws://localhost:3000', undefined, largeTimeoutConfig);
      expect(client2['healthConfig'].healthCheckTimeoutMs).toBe(60000);

      client2.disconnect();
    });

    it('should track health state correctly across multiple event listeners', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1000,
        healthCheckTimeoutMs: 500
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      const listener1Events: HealthCheckEvent[] = [];
      const listener2Events: HealthCheckEvent[] = [];
      const listener3Events: HealthCheckEvent[] = [];

      client.onHealth((event) => listener1Events.push(event));
      client.onHealth((event) => listener2Events.push(event));
      client.onHealth((event) => listener3Events.push(event));

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.autoRespondToPing = true;

      // Trigger health check
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(100);

      // All listeners should receive the same events
      expect(listener1Events.length).toBeGreaterThan(0);
      expect(listener2Events.length).toBe(listener1Events.length);
      expect(listener3Events.length).toBe(listener1Events.length);

      // Events should have same content
      for (let i = 0; i < listener1Events.length; i++) {
        expect(listener2Events[i].type).toBe(listener1Events[i].type);
        expect(listener3Events[i].type).toBe(listener1Events[i].type);
      }
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle high frequency health checks efficiently', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 10, // Very frequent checks
        healthCheckTimeoutMs: 5
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.autoRespondToPing = true;
      mockWs.pingResponseDelay = 1;

      const startTime = Date.now();

      // Run many health check cycles
      for (let i = 0; i < 100; i++) {
        await vi.advanceTimersByTimeAsync(10);
        await vi.advanceTimersByTimeAsync(2);
      }

      const endTime = Date.now();

      // Should complete efficiently
      expect(endTime - startTime).toBeLessThan(1000);
      expect(client.isHealthy()).toBe(true);
    });

    it('should maintain bounded memory usage with long-running health checks', async () => {
      const healthConfig: Partial<WebSocketHealthConfig> = {
        healthCheckEnabled: true,
        healthCheckIntervalMs: 100,
        healthCheckTimeoutMs: 50
      };

      client = new ApexWebSocketClient('ws://localhost:3000', undefined, healthConfig);

      const healthEvents: HealthCheckEvent[] = [];
      client.onHealth((event) => {
        healthEvents.push(event);
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      mockWs = client['ws'] as unknown as MockWebSocket;
      mockWs.autoRespondToPing = true;

      // Run for many cycles to test memory usage
      for (let i = 0; i < 50; i++) {
        await vi.advanceTimersByTimeAsync(100);
        await vi.advanceTimersByTimeAsync(10);
      }

      // Latency history should be bounded (max 10 entries as per implementation)
      const latencyHistory = client['latencyHistory'];
      expect(latencyHistory.length).toBeLessThanOrEqual(10);

      // Health events should accumulate but not grow unbounded
      expect(healthEvents.length).toBeLessThan(200); // Should be reasonable
    });
  });
});