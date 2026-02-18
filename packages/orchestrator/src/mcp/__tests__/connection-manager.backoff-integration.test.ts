/**
 * Integration tests for MCPConnectionManager with ExponentialBackoffReconnector
 *
 * Tests the integration between the MCP connection manager and the exponential
 * backoff reconnection logic to ensure proper connection lifecycle management.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { ApexConfig, MCPServerConfig } from '@apexcli/core';
import { ExponentialBackoffReconnector } from '@apexcli/core';

// Mock MCP transport that simulates connection behavior
class MockMCPTransport extends EventEmitter {
  private connected = false;
  private shouldFailConnection = false;
  private shouldFailAfterDelay = false;
  private connectionAttempts = 0;

  constructor(private config: any) {
    super();
  }

  async connect(): Promise<void> {
    this.connectionAttempts++;

    if (this.shouldFailConnection) {
      throw new Error(`Connection failed (attempt ${this.connectionAttempts})`);
    }

    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 10));

    if (this.shouldFailAfterDelay) {
      throw new Error('Connection timeout');
    }

    this.connected = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit('disconnected', 'Manual disconnect');
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectionAttempts(): number {
    return this.connectionAttempts;
  }

  // Test helpers
  setFailConnection(fail: boolean): void {
    this.shouldFailConnection = fail;
  }

  setFailAfterDelay(fail: boolean): void {
    this.shouldFailAfterDelay = fail;
  }

  simulateUnexpectedDisconnection(reason = 'Connection lost'): void {
    if (this.connected) {
      this.connected = false;
      this.emit('disconnected', reason);
    }
  }

  resetAttempts(): void {
    this.connectionAttempts = 0;
  }
}

// Mock MCPConnectionManager for testing
class MockMCPConnectionManager extends EventEmitter {
  private connections = new Map<string, MockMCPTransport>();
  private reconnectors = new Map<string, ExponentialBackoffReconnector>();
  private config: ApexConfig;
  private connectionConfig: any;

  constructor(config: ApexConfig) {
    super();
    this.config = config;
    this.connectionConfig = config.mcp?.connection || {};
  }

  async connect(serverId: string): Promise<MockMCPTransport> {
    const serverConfig = this.config.mcp?.servers?.[serverId];
    if (!serverConfig) {
      throw new Error(`Server configuration not found for ${serverId}`);
    }

    // Create transport
    const transport = new MockMCPTransport(serverConfig);
    this.connections.set(serverId, transport);

    // Create reconnector with server-specific or global config
    const reconnectorConfig = {
      ...this.connectionConfig,
      ...(serverConfig.connection || {}),
    };

    const reconnector = new ExponentialBackoffReconnector(reconnectorConfig);
    this.reconnectors.set(serverId, reconnector);

    // Set up reconnector event handlers
    this.setupReconnectorEvents(serverId, reconnector, transport);

    // Set up transport event handlers
    this.setupTransportEvents(serverId, transport, reconnector);

    // Initial connection attempt
    try {
      await transport.connect();
      reconnector.notifyConnected();
      this.emit('connected', { serverId, transport });
      return transport;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      reconnector.notifyConnectionFailed(errorMessage);
      this.scheduleReconnection(serverId, transport, reconnector);
      throw error;
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const transport = this.connections.get(serverId);
    const reconnector = this.reconnectors.get(serverId);

    if (transport) {
      await transport.disconnect();
      this.connections.delete(serverId);
    }

    if (reconnector) {
      reconnector.destroy();
      this.reconnectors.delete(serverId);
    }

    this.emit('disconnected', serverId);
  }

  private setupReconnectorEvents(
    serverId: string,
    reconnector: ExponentialBackoffReconnector,
    transport: MockMCPTransport
  ): void {
    reconnector.on('reconnect:attempt', (attempt, delayMs) => {
      this.emit('reconnecting', serverId, attempt, reconnector.getConfig().maxRetries);
    });

    reconnector.on('reconnect:success', (attempt, totalTime) => {
      this.emit('connected', { serverId, transport });
    });

    reconnector.on('reconnect:failure', (attempt, error) => {
      this.emit('error', serverId, new Error(error));
    });

    reconnector.on('reconnect:exhausted', (totalAttempts, lastError) => {
      this.emit('error', serverId, new Error(`Reconnection exhausted after ${totalAttempts} attempts: ${lastError}`));
    });

    reconnector.on('state:changed', (prev, next) => {
      this.emit('stateChange', serverId, prev, next);
    });
  }

  private setupTransportEvents(
    serverId: string,
    transport: MockMCPTransport,
    reconnector: ExponentialBackoffReconnector
  ): void {
    transport.on('disconnected', (reason) => {
      if (reconnector.isConnected()) {
        reconnector.notifyDisconnected(reason);
        this.scheduleReconnection(serverId, transport, reconnector);
      }
    });
  }

  private scheduleReconnection(
    serverId: string,
    transport: MockMCPTransport,
    reconnector: ExponentialBackoffReconnector
  ): void {
    reconnector.scheduleReconnect(async () => {
      try {
        await transport.connect();
        reconnector.notifyConnected();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        reconnector.notifyConnectionFailed(errorMessage);
        throw error;
      }
    });
  }

  // Test utilities
  getTransport(serverId: string): MockMCPTransport | undefined {
    return this.connections.get(serverId);
  }

  getReconnector(serverId: string): ExponentialBackoffReconnector | undefined {
    return this.reconnectors.get(serverId);
  }

  listConnections(): string[] {
    return Array.from(this.connections.keys());
  }
}

describe('MCPConnectionManager Exponential Backoff Integration', () => {
  let manager: MockMCPConnectionManager;
  let config: ApexConfig;

  beforeEach(() => {
    vi.useFakeTimers();

    config = {
      project: {
        name: 'test-project',
        version: '1.0.0',
        description: 'Test project',
      },
      mcp: {
        enabled: true,
        connection: {
          maxRetries: 3,
          timeoutMs: 30000,
          poolSize: 1,
          healthCheckIntervalMs: 30000,
          baseDelayMs: 1000,
          backoffFactor: 2,
          maxDelayMs: 10000,
          jitterStrategy: 'none' as const,
        },
        servers: {
          'test-server': {
            name: 'test-server',
            type: 'stdio',
            command: 'node',
            args: ['test-server.js'],
            autoStart: true,
            connection: {
              maxRetries: 5,
              baseDelayMs: 500,
            },
          },
          'backup-server': {
            name: 'backup-server',
            type: 'stdio',
            command: 'node',
            args: ['backup-server.js'],
            autoStart: false,
          },
        },
      },
    };

    manager = new MockMCPConnectionManager(config);
  });

  afterEach(() => {
    // Clean up all connections
    const connections = manager.listConnections();
    for (const serverId of connections) {
      manager.disconnect(serverId);
    }

    vi.useRealTimers();
  });

  describe('Connection Lifecycle with Backoff', () => {
    it('should use server-specific connection configuration', async () => {
      const events: string[] = [];
      manager.on('reconnecting', (serverId, attempt) => {
        events.push(`reconnecting:${serverId}:${attempt}`);
      });

      // Initial connection should fail
      const transport = manager.getTransport('test-server');
      if (transport) {
        transport.setFailConnection(true);
      }

      try {
        await manager.connect('test-server');
      } catch (error) {
        // Expected to fail
      }

      const reconnector = manager.getReconnector('test-server');
      expect(reconnector).toBeDefined();

      // Should use server-specific config (maxRetries: 5, baseDelayMs: 500)
      const reconnectorConfig = reconnector!.getConfig();
      expect(reconnectorConfig.maxRetries).toBe(5);
      expect(reconnectorConfig.baseDelayMs).toBe(500);

      // Allow reconnection to succeed
      const connectedTransport = manager.getTransport('test-server');
      if (connectedTransport) {
        connectedTransport.setFailConnection(false);
      }

      // Advance timer to trigger first reconnection attempt
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      expect(events[0]).toBe('reconnecting:test-server:1');
    });

    it('should fall back to global connection configuration', async () => {
      // backup-server doesn't have server-specific connection config
      try {
        await manager.connect('backup-server');
      } catch (error) {
        // Expected to fail initially
      }

      const reconnector = manager.getReconnector('backup-server');
      expect(reconnector).toBeDefined();

      // Should use global config
      const reconnectorConfig = reconnector!.getConfig();
      expect(reconnectorConfig.maxRetries).toBe(3); // From global config
      expect(reconnectorConfig.baseDelayMs).toBe(1000); // From global config
      expect(reconnectorConfig.jitterStrategy).toBe('none');
    });

    it('should handle successful reconnection after failure', async () => {
      const events: Array<{ type: string; serverId: string; data?: any }> = [];

      manager.on('connected', ({ serverId }) => {
        events.push({ type: 'connected', serverId });
      });
      manager.on('disconnected', (serverId) => {
        events.push({ type: 'disconnected', serverId });
      });
      manager.on('reconnecting', (serverId, attempt) => {
        events.push({ type: 'reconnecting', serverId, data: { attempt } });
      });

      // Initial successful connection
      const transport = await manager.connect('test-server');
      expect(transport.isConnected()).toBe(true);

      // Simulate unexpected disconnection
      transport.simulateUnexpectedDisconnection('network error');

      // Should trigger reconnection
      expect(events.some(e => e.type === 'reconnecting')).toBe(true);

      // Allow reconnection to succeed
      transport.setFailConnection(false);
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      // Should eventually reconnect
      const reconnectedEvents = events.filter(e => e.type === 'connected');
      expect(reconnectedEvents.length).toBeGreaterThanOrEqual(2); // Initial + reconnection
    });

    it('should handle multiple failed reconnection attempts', async () => {
      const reconnectionAttempts: number[] = [];

      manager.on('reconnecting', (serverId, attempt) => {
        reconnectionAttempts.push(attempt);
      });

      // Start with failed connection
      const transport = manager.getTransport('test-server');
      if (transport) {
        transport.setFailConnection(true);
      }

      try {
        await manager.connect('test-server');
      } catch (error) {
        // Expected
      }

      // Let multiple reconnection attempts fail
      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(500 * Math.pow(2, i));
        await vi.runAllTimersAsync();
      }

      expect(reconnectionAttempts).toEqual([1, 2, 3]);

      // Finally allow success
      const connectedTransport = manager.getTransport('test-server');
      if (connectedTransport) {
        connectedTransport.setFailConnection(false);
      }

      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      expect(connectedTransport?.isConnected()).toBe(true);
    });

    it('should exhaust reconnection attempts and emit error', async () => {
      const errors: Array<{ serverId: string; error: Error }> = [];

      manager.on('error', (serverId, error) => {
        errors.push({ serverId, error });
      });

      // Configure for quick exhaustion (backup-server uses global config: maxRetries = 3)
      const transport = manager.getTransport('backup-server');
      if (transport) {
        transport.setFailConnection(true);
      }

      try {
        await manager.connect('backup-server');
      } catch (error) {
        // Expected
      }

      // Let all attempts fail
      for (let i = 0; i < 4; i++) {
        vi.advanceTimersByTime(1000 * Math.pow(2, i));
        await vi.runAllTimersAsync();
      }

      // Should have emitted exhaustion error
      const exhaustionErrors = errors.filter(e =>
        e.error.message.includes('exhausted')
      );
      expect(exhaustionErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Connection State Management', () => {
    it('should track connection states through backoff cycle', async () => {
      const stateChanges: Array<{
        serverId: string;
        prev: string;
        next: string;
      }> = [];

      manager.on('stateChange', (serverId, prev, next) => {
        stateChanges.push({ serverId, prev, next });
      });

      // Initial connection
      const transport = await manager.connect('test-server');

      // Simulate disconnection
      transport.simulateUnexpectedDisconnection();

      // Wait for reconnection attempts
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      // Should have state transitions
      expect(stateChanges.length).toBeGreaterThan(0);
      expect(stateChanges.some(s => s.next === 'connected')).toBe(true);
      expect(stateChanges.some(s => s.next === 'reconnecting')).toBe(true);
    });

    it('should maintain separate state for multiple connections', async () => {
      const server1Events: string[] = [];
      const server2Events: string[] = [];

      manager.on('stateChange', (serverId, prev, next) => {
        if (serverId === 'test-server') {
          server1Events.push(`${prev}->${next}`);
        } else if (serverId === 'backup-server') {
          server2Events.push(`${prev}->${next}`);
        }
      });

      // Connect both servers
      const transport1 = await manager.connect('test-server');
      const transport2 = await manager.connect('backup-server');

      // Disconnect only one
      transport1.simulateUnexpectedDisconnection();

      // Wait for reconnection
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      // Only test-server should have reconnection state changes
      expect(server1Events.length).toBeGreaterThan(0);
      expect(server1Events.some(e => e.includes('reconnecting'))).toBe(true);

      // backup-server should remain stable
      expect(server2Events.every(e => !e.includes('reconnecting'))).toBe(true);
    });

    it('should clean up reconnector when explicitly disconnected', async () => {
      const transport = await manager.connect('test-server');

      // Verify reconnector exists
      let reconnector = manager.getReconnector('test-server');
      expect(reconnector).toBeDefined();

      // Explicitly disconnect
      await manager.disconnect('test-server');

      // Reconnector should be cleaned up
      reconnector = manager.getReconnector('test-server');
      expect(reconnector).toBeUndefined();

      // Should not appear in connections list
      expect(manager.listConnections()).not.toContain('test-server');
    });
  });

  describe('Backoff Algorithm Integration', () => {
    it('should apply exponential delays correctly', async () => {
      const attemptTimes: number[] = [];
      const startTime = Date.now();

      manager.on('reconnecting', () => {
        attemptTimes.push(Date.now() - startTime);
      });

      // Force connection failures
      const transport = manager.getTransport('test-server');
      if (transport) {
        transport.setFailConnection(true);
      }

      try {
        await manager.connect('test-server');
      } catch (error) {
        // Expected
      }

      // Trigger multiple reconnection attempts (test-server has baseDelayMs: 500, backoffFactor: 2)
      for (let i = 0; i < 3; i++) {
        const expectedDelay = 500 * Math.pow(2, i);
        vi.advanceTimersByTime(expectedDelay);
        await vi.runAllTimersAsync();
      }

      expect(attemptTimes.length).toBe(3);
      // Times should be approximately: 500ms, 1000ms, 2000ms (cumulative)
      expect(attemptTimes[0]).toBeGreaterThanOrEqual(500);
      expect(attemptTimes[1]).toBeGreaterThanOrEqual(1500);
      expect(attemptTimes[2]).toBeGreaterThanOrEqual(3500);
    });

    it('should respect maxDelayMs configuration', async () => {
      // Create config with low maxDelayMs for testing
      const testConfig = {
        ...config,
        mcp: {
          ...config.mcp!,
          servers: {
            'limited-server': {
              name: 'limited-server',
              type: 'stdio',
              command: 'node',
              autoStart: true,
              connection: {
                baseDelayMs: 1000,
                backoffFactor: 10, // Very high factor
                maxDelayMs: 2000,  // But low max delay
                maxRetries: 5,
              },
            },
          },
        },
      };

      const limitedManager = new MockMCPConnectionManager(testConfig);
      const delays: number[] = [];

      try {
        await limitedManager.connect('limited-server');
      } catch (error) {
        // Expected
      }

      const reconnector = limitedManager.getReconnector('limited-server');
      if (reconnector) {
        // Calculate delays for multiple attempts
        for (let attempt = 1; attempt <= 5; attempt++) {
          delays.push(reconnector.calculateDelay(attempt));
        }
      }

      // All delays should be capped at maxDelayMs
      expect(delays[0]).toBe(1000); // 1000 * 10^0
      expect(delays[1]).toBe(2000); // Would be 10000, capped at 2000
      expect(delays[2]).toBe(2000); // Capped
      expect(delays[3]).toBe(2000); // Capped
      expect(delays[4]).toBe(2000); // Capped
    });

    it('should handle jitter strategy configuration', async () => {
      // Create config with jitter
      const jitterConfig = {
        ...config,
        mcp: {
          ...config.mcp!,
          connection: {
            ...config.mcp!.connection!,
            jitterStrategy: 'full' as const,
          },
        },
      };

      const jitterManager = new MockMCPConnectionManager(jitterConfig);

      try {
        await jitterManager.connect('backup-server');
      } catch (error) {
        // Expected
      }

      const reconnector = jitterManager.getReconnector('backup-server');
      expect(reconnector).toBeDefined();

      // Calculate multiple delays - with jitter they should vary
      const delays: number[] = [];
      for (let i = 0; i < 10; i++) {
        delays.push(reconnector!.calculateDelay(2)); // Same attempt number
      }

      // With full jitter, delays should vary (not all the same)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);

      // All delays should be reasonable for attempt 2
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(2000); // Max for attempt 2 with factor 2
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle transport errors during reconnection', async () => {
      const errorMessages: string[] = [];

      manager.on('error', (serverId, error) => {
        errorMessages.push(error.message);
      });

      const transport = await manager.connect('test-server');

      // Simulate various error types
      transport.simulateUnexpectedDisconnection('Connection timeout');

      // Make next attempt fail with different error
      transport.setFailAfterDelay(true);
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      // Should capture different error types
      expect(errorMessages.length).toBeGreaterThan(0);
      expect(errorMessages.some(msg => msg.includes('timeout'))).toBe(true);
    });

    it('should recover gracefully from reconnector errors', async () => {
      const transport = await manager.connect('test-server');
      const reconnector = manager.getReconnector('test-server')!;

      // Force an error in the reconnector
      const originalScheduleReconnect = reconnector.scheduleReconnect;
      let errorThrown = false;

      vi.spyOn(reconnector, 'scheduleReconnect').mockImplementationOnce(() => {
        errorThrown = true;
        throw new Error('Reconnector error');
      });

      // Trigger disconnection
      transport.simulateUnexpectedDisconnection();

      // Should handle the error gracefully
      expect(errorThrown).toBe(true);
      expect(transport.isConnected()).toBe(false);

      // Restore original method for subsequent attempts
      vi.mocked(reconnector.scheduleReconnect).mockRestore();
    });

    it('should handle concurrent connection and disconnection', async () => {
      const transport = manager.getTransport('test-server');
      if (transport) {
        transport.setFailConnection(true);
      }

      // Start connection attempt
      const connectionPromise = manager.connect('test-server').catch(() => {
        // Expected to fail
      });

      // Immediately try to disconnect
      await manager.disconnect('test-server');

      await connectionPromise;

      // Should be cleanly disconnected
      expect(manager.listConnections()).not.toContain('test-server');
      expect(manager.getReconnector('test-server')).toBeUndefined();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle multiple servers with independent backoff timers', async () => {
      const servers = ['test-server', 'backup-server'];
      const transports: MockMCPTransport[] = [];

      // Connect multiple servers
      for (const serverId of servers) {
        try {
          const transport = await manager.connect(serverId);
          transports.push(transport);
        } catch (error) {
          // Some might fail initially
        }
      }

      // Disconnect all servers simultaneously
      transports.forEach(transport => {
        transport.simulateUnexpectedDisconnection('mass disconnect');
      });

      // Each should have independent reconnection timers
      const reconnectors = servers.map(id => manager.getReconnector(id)).filter(Boolean);
      expect(reconnectors.length).toBeGreaterThan(0);

      // Advance time - should handle multiple concurrent reconnections
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      // All reconnectors should still be active and independent
      reconnectors.forEach(reconnector => {
        expect(reconnector.getStats().state).toMatch(/idle|reconnecting|connecting|connected/);
      });
    });

    it('should clean up resources when manager is destroyed', async () => {
      const transport1 = await manager.connect('test-server');
      const transport2 = await manager.connect('backup-server');

      // Simulate disconnections to start reconnection cycles
      transport1.simulateUnexpectedDisconnection();
      transport2.simulateUnexpectedDisconnection();

      // Verify reconnectors are active
      expect(manager.getReconnector('test-server')).toBeDefined();
      expect(manager.getReconnector('backup-server')).toBeDefined();

      // Disconnect all connections (simulating manager cleanup)
      for (const serverId of manager.listConnections()) {
        await manager.disconnect(serverId);
      }

      // All resources should be cleaned up
      expect(manager.listConnections()).toHaveLength(0);
      expect(manager.getReconnector('test-server')).toBeUndefined();
      expect(manager.getReconnector('backup-server')).toBeUndefined();
    });
  });
});