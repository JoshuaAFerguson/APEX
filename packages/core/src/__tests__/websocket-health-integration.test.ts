/**
 * WebSocket health check integration tests
 *
 * Tests the integration between ConnectionHealthManager and WebSocket connections,
 * focusing on real-world scenarios and edge cases specific to WebSocket health monitoring.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { ConnectionHealthManager } from '../connection-health.js';

// Mock WebSocket-like connection class
class MockWebSocketConnection extends EventEmitter {
  public readyState: number = 1; // OPEN
  public url: string;
  public closeCode?: number;
  public closeReason?: string;
  private messageQueue: string[] = [];
  private isConnected = true;

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  constructor(url: string) {
    super();
    this.url = url;

    // Simulate connection establishment
    setTimeout(() => {
      this.emit('open');
    }, 10);
  }

  send(data: string): void {
    if (!this.isConnected || this.readyState !== MockWebSocketConnection.OPEN) {
      throw new Error('WebSocket is not connected');
    }
    this.messageQueue.push(data);

    // Auto-respond to ping messages
    try {
      const message = JSON.parse(data);
      if (message.type === 'ping') {
        setTimeout(() => {
          this.simulateMessage(JSON.stringify({
            type: 'pong',
            id: message.id,
            timestamp: message.timestamp,
            serverTimestamp: Date.now()
          }));
        }, 50);
      }
    } catch {
      // Ignore non-JSON messages
    }
  }

  close(code = 1000, reason = ''): void {
    this.readyState = MockWebSocketConnection.CLOSING;
    this.closeCode = code;
    this.closeReason = reason;
    this.isConnected = false;

    setTimeout(() => {
      this.readyState = MockWebSocketConnection.CLOSED;
      this.emit('close', { code, reason });
    }, 10);
  }

  simulateMessage(data: string): void {
    if (this.isConnected) {
      this.emit('message', { data });
    }
  }

  simulateError(error: Error): void {
    this.emit('error', error);
  }

  simulateNetworkIssue(): void {
    this.isConnected = false;
    this.readyState = MockWebSocketConnection.CLOSED;
    this.emit('close', { code: 1006, reason: 'Network error' });
  }

  getMessageQueue(): string[] {
    return [...this.messageQueue];
  }

  clearMessageQueue(): void {
    this.messageQueue = [];
  }
}

// WebSocket Health Manager that integrates with ConnectionHealthManager
class WebSocketHealthManager {
  private healthManager: ConnectionHealthManager;
  private connections = new Map<string, MockWebSocketConnection>();
  private healthStates = new Map<string, { isHealthy: boolean; lastCheckTime: number }>();

  constructor() {
    this.healthManager = new ConnectionHealthManager({
      enabled: true,
      method: 'ping',
      intervalMs: 5000,
      timeoutMs: 3000,
      failureThreshold: 3
    });

    // Listen for health events
    this.healthManager.on('health:reconnect-required', (connectionId) => {
      this.handleReconnectRequired(connectionId);
    });

    this.healthManager.on('health:unhealthy', (connectionId, state, result) => {
      this.handleUnhealthy(connectionId, state, result);
    });

    this.healthManager.on('health:recovered', (connectionId, state, result) => {
      this.handleRecovered(connectionId, state, result);
    });

    this.healthManager.on('ping:sent', (connectionId, pingId, timestamp) => {
      this.handlePingSent(connectionId, pingId, timestamp);
    });
  }

  registerConnection(connectionId: string, url: string): MockWebSocketConnection {
    const connection = new MockWebSocketConnection(url);
    this.connections.set(connectionId, connection);
    this.healthStates.set(connectionId, { isHealthy: true, lastCheckTime: Date.now() });

    // Register with health manager
    this.healthManager.register(connectionId, {
      method: 'ping',
      intervalMs: 2000, // Frequent checks for testing
      timeoutMs: 1000
    });

    // Set up WebSocket event handlers
    this.setupConnectionHandlers(connectionId, connection);

    return connection;
  }

  private setupConnectionHandlers(connectionId: string, connection: MockWebSocketConnection): void {
    connection.on('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'pong') {
          this.handlePongReceived(connectionId, message);
        } else if (message.type === 'ping') {
          this.handlePingReceived(connectionId, connection, message);
        }
      } catch {
        // Ignore non-JSON messages
      }
    });

    connection.on('close', () => {
      this.handleConnectionClose(connectionId);
    });

    connection.on('error', (error) => {
      this.handleConnectionError(connectionId, error);
    });
  }

  private handlePingSent(connectionId: string, pingId: string, timestamp: number): void {
    const connection = this.connections.get(connectionId);
    if (connection && connection.readyState === MockWebSocketConnection.OPEN) {
      try {
        connection.send(JSON.stringify({
          type: 'ping',
          id: pingId,
          timestamp
        }));
      } catch (error) {
        // Handle send failure
        this.healthManager.notifyPingTimeout(connectionId, pingId);
      }
    } else {
      // Connection not available, mark ping as timeout
      this.healthManager.notifyPingTimeout(connectionId, pingId);
    }
  }

  private handlePongReceived(connectionId: string, message: any): void {
    if (message.id && message.timestamp) {
      const latency = Date.now() - message.timestamp;
      this.healthManager.notifyPongReceived(connectionId, message.id, latency);
    }
  }

  private handlePingReceived(connectionId: string, connection: MockWebSocketConnection, message: any): void {
    // Respond with pong
    try {
      connection.send(JSON.stringify({
        type: 'pong',
        id: message.id,
        timestamp: message.timestamp,
        serverTimestamp: Date.now()
      }));
    } catch {
      // Ignore send failures
    }
  }

  private handleReconnectRequired(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.close(1006, 'Health check failed');
      // In a real implementation, this would trigger reconnection logic
    }
  }

  private handleUnhealthy(connectionId: string, state: any, result: any): void {
    const healthState = this.healthStates.get(connectionId);
    if (healthState) {
      healthState.isHealthy = false;
    }
  }

  private handleRecovered(connectionId: string, state: any, result: any): void {
    const healthState = this.healthStates.get(connectionId);
    if (healthState) {
      healthState.isHealthy = true;
    }
  }

  private handleConnectionClose(connectionId: string): void {
    // Mark as unhealthy when connection closes
    const healthState = this.healthStates.get(connectionId);
    if (healthState) {
      healthState.isHealthy = false;
    }
  }

  private handleConnectionError(connectionId: string, error: Error): void {
    // Mark as unhealthy on connection error
    const healthState = this.healthStates.get(connectionId);
    if (healthState) {
      healthState.isHealthy = false;
    }
  }

  getConnection(connectionId: string): MockWebSocketConnection | undefined {
    return this.connections.get(connectionId);
  }

  getHealthState(connectionId: string): any {
    return this.healthManager.getHealthState(connectionId);
  }

  isHealthy(connectionId: string): boolean {
    const state = this.healthStates.get(connectionId);
    return state?.isHealthy ?? false;
  }

  cleanup(): void {
    this.connections.forEach(conn => conn.close());
    this.connections.clear();
    this.healthStates.clear();
    this.healthManager.destroy();
  }
}

describe('WebSocket Health Check Integration Tests', () => {
  let wsHealthManager: WebSocketHealthManager;

  beforeEach(() => {
    vi.useFakeTimers();
    wsHealthManager = new WebSocketHealthManager();
  });

  afterEach(() => {
    wsHealthManager.cleanup();
    vi.useRealTimers();
  });

  describe('Connection Health Monitoring', () => {
    it('should monitor WebSocket connection health with ping/pong', async () => {
      const connectionId = 'ws-health-test';
      const connection = wsHealthManager.registerConnection(connectionId, 'wss://example.com');

      // Wait for connection to establish
      await vi.advanceTimersByTimeAsync(20);
      expect(connection.readyState).toBe(MockWebSocketConnection.OPEN);

      // Clear initial messages
      connection.clearMessageQueue();

      // Trigger health check by advancing time
      await vi.advanceTimersByTimeAsync(2000);

      // Should have sent a ping
      const messages = connection.getMessageQueue();
      expect(messages.length).toBeGreaterThan(0);

      const pingMessage = JSON.parse(messages[0]);
      expect(pingMessage.type).toBe('ping');
      expect(pingMessage.id).toBeTruthy();

      // Wait for pong response
      await vi.advanceTimersByTimeAsync(100);

      // Connection should be healthy
      expect(wsHealthManager.isHealthy(connectionId)).toBe(true);

      const healthState = wsHealthManager.getHealthState(connectionId);
      expect(healthState?.isHealthy).toBe(true);
      expect(healthState?.latencyHistory.length).toBeGreaterThan(0);
    });

    it('should detect connection failures through health check timeouts', async () => {
      const connectionId = 'ws-timeout-test';
      const connection = wsHealthManager.registerConnection(connectionId, 'wss://example.com');

      await vi.advanceTimersByTimeAsync(20);

      // Simulate connection becoming unresponsive (no pong responses)
      vi.spyOn(connection, 'send').mockImplementation((data: string) => {
        const message = JSON.parse(data);
        if (message.type === 'ping') {
          // Don't send pong response - simulate timeout
          return;
        }
      });

      // Trigger health check
      await vi.advanceTimersByTimeAsync(2000);

      // Wait for timeout
      await vi.advanceTimersByTimeAsync(1200);

      // Connection should be marked as unhealthy
      const healthState = wsHealthManager.getHealthState(connectionId);
      expect(healthState?.isHealthy).toBe(false);
      expect(healthState?.consecutiveFailures).toBeGreaterThan(0);
    });

    it('should handle network disconnections gracefully', async () => {
      const connectionId = 'ws-disconnect-test';
      const connection = wsHealthManager.registerConnection(connectionId, 'wss://example.com');

      await vi.advanceTimersByTimeAsync(20);
      expect(wsHealthManager.isHealthy(connectionId)).toBe(true);

      // Simulate network disconnection
      connection.simulateNetworkIssue();
      await vi.advanceTimersByTimeAsync(10);

      // Should be marked as unhealthy
      expect(wsHealthManager.isHealthy(connectionId)).toBe(false);
    });
  });

  describe('Automatic Reconnection Scenarios', () => {
    it('should trigger reconnection after health check failure threshold', async () => {
      const connectionId = 'ws-reconnect-test';
      const connection = wsHealthManager.registerConnection(connectionId, 'wss://example.com');

      await vi.advanceTimersByTimeAsync(20);

      const closeEvents: any[] = [];
      connection.on('close', (event) => {
        closeEvents.push(event);
      });

      // Make connection unresponsive to trigger failures
      vi.spyOn(connection, 'send').mockImplementation(() => {
        throw new Error('Connection lost');
      });

      // Trigger multiple health check failures
      for (let i = 0; i < 4; i++) { // More than failure threshold
        await vi.advanceTimersByTimeAsync(2000);
        await vi.advanceTimersByTimeAsync(1200); // Wait for timeout
      }

      // Should have triggered connection close for reconnection
      expect(closeEvents.length).toBeGreaterThan(0);
      expect(closeEvents[0].code).toBe(1006);
      expect(closeEvents[0].reason).toBe('Health check failed');
    });

    it('should recover health state after successful reconnection', async () => {
      const connectionId = 'ws-recovery-test';
      const connection = wsHealthManager.registerConnection(connectionId, 'wss://example.com');

      await vi.advanceTimersByTimeAsync(20);

      // Cause a failure
      vi.spyOn(connection, 'send').mockImplementation(() => {
        throw new Error('Temporary failure');
      });

      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(1200);

      const healthState1 = wsHealthManager.getHealthState(connectionId);
      expect(healthState1?.isHealthy).toBe(false);

      // Restore normal operation
      (connection.send as any).mockRestore();

      // Wait for next health check
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(100);

      // Should recover
      const healthState2 = wsHealthManager.getHealthState(connectionId);
      expect(healthState2?.isHealthy).toBe(true);
      expect(healthState2?.consecutiveFailures).toBe(0);
    });
  });

  describe('Multiple Connection Management', () => {
    it('should manage health for multiple WebSocket connections independently', async () => {
      const connections = [
        { id: 'ws-1', url: 'wss://service1.com' },
        { id: 'ws-2', url: 'wss://service2.com' },
        { id: 'ws-3', url: 'wss://service3.com' }
      ];

      const connObjects = connections.map(conn => {
        const connection = wsHealthManager.registerConnection(conn.id, conn.url);
        return { id: conn.id, connection };
      });

      await vi.advanceTimersByTimeAsync(20);

      // Make second connection unhealthy
      const unhealthyConn = connObjects[1];
      vi.spyOn(unhealthyConn.connection, 'send').mockImplementation(() => {
        throw new Error('Connection 2 is down');
      });

      // Trigger health checks for all
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(1200);

      // Check individual health states
      expect(wsHealthManager.isHealthy('ws-1')).toBe(true);
      expect(wsHealthManager.isHealthy('ws-2')).toBe(false);
      expect(wsHealthManager.isHealthy('ws-3')).toBe(true);

      // Health states should be independent
      const state1 = wsHealthManager.getHealthState('ws-1');
      const state2 = wsHealthManager.getHealthState('ws-2');
      const state3 = wsHealthManager.getHealthState('ws-3');

      expect(state1?.consecutiveFailures).toBe(0);
      expect(state2?.consecutiveFailures).toBeGreaterThan(0);
      expect(state3?.consecutiveFailures).toBe(0);
    });

    it('should handle concurrent health checks efficiently', async () => {
      const connectionCount = 10;
      const connections: { id: string; connection: MockWebSocketConnection }[] = [];

      // Register many connections
      for (let i = 0; i < connectionCount; i++) {
        const id = `ws-concurrent-${i}`;
        const connection = wsHealthManager.registerConnection(id, `wss://service${i}.com`);
        connections.push({ id, connection });
      }

      await vi.advanceTimersByTimeAsync(20);

      const startTime = Date.now();

      // Trigger concurrent health checks
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(200);

      const endTime = Date.now();

      // All connections should be healthy
      connections.forEach(({ id }) => {
        expect(wsHealthManager.isHealthy(id)).toBe(true);
      });

      // Should complete efficiently
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(1000); // Should be much faster with fake timers
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed ping/pong messages gracefully', async () => {
      const connectionId = 'ws-malformed-test';
      const connection = wsHealthManager.registerConnection(connectionId, 'wss://example.com');

      await vi.advanceTimersByTimeAsync(20);

      // Simulate receiving malformed pong
      connection.simulateMessage('invalid json');
      connection.simulateMessage('{"type": "pong"}'); // Missing required fields
      connection.simulateMessage('{"type": "pong", "id": "wrong-id"}'); // Wrong ping ID

      // Should not crash and maintain normal operation
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(100);

      // Should still function normally
      expect(wsHealthManager.isHealthy(connectionId)).toBe(true);
    });

    it('should handle WebSocket send failures during ping', async () => {
      const connectionId = 'ws-send-fail-test';
      const connection = wsHealthManager.registerConnection(connectionId, 'wss://example.com');

      await vi.advanceTimersByTimeAsync(20);

      // Mock send to fail intermittently
      let sendCallCount = 0;
      vi.spyOn(connection, 'send').mockImplementation((data: string) => {
        sendCallCount++;
        if (sendCallCount % 2 === 0) {
          throw new Error('Send failed');
        }
        // Let every other send succeed normally
        (connection as any).__proto__.send.call(connection, data);
      });

      // Trigger multiple health checks
      for (let i = 0; i < 4; i++) {
        await vi.advanceTimersByTimeAsync(2000);
        await vi.advanceTimersByTimeAsync(200);
      }

      // Should handle failures and still track health appropriately
      const healthState = wsHealthManager.getHealthState(connectionId);
      expect(healthState).toBeDefined();
    });

    it('should handle rapid connection state changes', async () => {
      const connectionId = 'ws-rapid-changes-test';
      const connection = wsHealthManager.registerConnection(connectionId, 'wss://example.com');

      await vi.advanceTimersByTimeAsync(20);

      // Rapidly change connection state
      connection.close(1000, 'Normal close');
      await vi.advanceTimersByTimeAsync(10);

      // Simulate reconnection by creating a new connection with same ID
      const newConnection = new MockWebSocketConnection('wss://example.com');

      // Trigger health check during state transition
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(100);

      // Should handle gracefully without crashing
      const healthState = wsHealthManager.getHealthState(connectionId);
      expect(healthState).toBeDefined();
    });

    it('should handle server-initiated ping messages', async () => {
      const connectionId = 'ws-server-ping-test';
      const connection = wsHealthManager.registerConnection(connectionId, 'wss://example.com');

      await vi.advanceTimersByTimeAsync(20);
      connection.clearMessageQueue();

      // Simulate server sending ping
      connection.simulateMessage(JSON.stringify({
        type: 'ping',
        timestamp: Date.now()
      }));

      await vi.advanceTimersByTimeAsync(10);

      // Should have responded with pong
      const messages = connection.getMessageQueue();
      expect(messages.length).toBeGreaterThan(0);

      const pongMessage = JSON.parse(messages[0]);
      expect(pongMessage.type).toBe('pong');
      expect(pongMessage.timestamp).toBeTruthy();
      expect(pongMessage.serverTimestamp).toBeTruthy();
    });
  });

  describe('Latency Tracking and Metrics', () => {
    it('should track latency metrics accurately', async () => {
      const connectionId = 'ws-latency-test';
      const connection = wsHealthManager.registerConnection(connectionId, 'wss://example.com');

      await vi.advanceTimersByTimeAsync(20);

      // Override pong handling to simulate different latencies
      const latencies = [50, 100, 150, 75, 200];
      let latencyIndex = 0;

      const originalSend = connection.send;
      vi.spyOn(connection, 'send').mockImplementation((data: string) => {
        const message = JSON.parse(data);
        if (message.type === 'ping') {
          // Simulate pong with specific latency
          setTimeout(() => {
            const latency = latencies[latencyIndex % latencies.length];
            latencyIndex++;

            connection.simulateMessage(JSON.stringify({
              type: 'pong',
              id: message.id,
              timestamp: message.timestamp,
              serverTimestamp: Date.now()
            }));
          }, latencies[latencyIndex % latencies.length] || 50);
        }
      });

      // Perform multiple health checks
      for (let i = 0; i < latencies.length; i++) {
        await vi.advanceTimersByTimeAsync(2000);
        await vi.advanceTimersByTimeAsync(250);
      }

      const healthState = wsHealthManager.getHealthState(connectionId);
      expect(healthState?.latencyHistory.length).toBeGreaterThan(0);
      expect(healthState?.averageLatencyMs).toBeGreaterThan(0);

      // Average should be reasonable
      const expectedAverage = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      expect(Math.abs(healthState?.averageLatencyMs - expectedAverage)).toBeLessThan(50);
    });
  });
});