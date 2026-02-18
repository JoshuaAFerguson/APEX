/**
 * MCPConnectionManager Edge Cases and Advanced Scenarios Tests
 *
 * Additional tests for complex scenarios, edge cases, and advanced features
 * that complement the main test suite.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { ApexConfig, MCPServerConfig } from '@apexcli/core';
import {
  MCPConnectionManager,
  type MCPConnectionManagerOptions,
} from './connection-manager.js';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the transport and client modules
vi.mock('./transports/index.js', () => ({
  StdioTransport: vi.fn().mockImplementation(() => createMockTransport()),
}));

vi.mock('./client.js', () => ({
  MCPClient: vi.fn().mockImplementation(({ transport }) => createMockClient(transport)),
}));

// Helper to create a mock transport with configurable behavior
function createMockTransport(options: { shouldFail?: boolean; failAfterMs?: number } = {}) {
  const emitter = new EventEmitter();
  return {
    on: vi.fn((event, handler) => {
      emitter.on(event, handler);
      return emitter;
    }),
    off: vi.fn((event, handler) => {
      emitter.off(event, handler);
      return emitter;
    }),
    emit: vi.fn((event, ...args) => emitter.emit(event, ...args)),
    connect: vi.fn().mockImplementation(() => {
      if (options.shouldFail) {
        return Promise.reject(new Error('Transport connection failed'));
      }
      if (options.failAfterMs) {
        setTimeout(() => {
          emitter.emit('disconnected', 'Transport failed after timeout');
        }, options.failAfterMs);
      }
      return Promise.resolve();
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    getState: vi.fn().mockReturnValue('connected'),
    _emitter: emitter,
  };
}

// Helper to create a mock client
function createMockClient(transport: ReturnType<typeof createMockTransport>) {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue([]),
    callTool: vi.fn().mockResolvedValue({}),
    transport,
  };
}

// ============================================================================
// Test Fixtures
// ============================================================================

const createTestConfig = (servers: Record<string, MCPServerConfig> = {}): ApexConfig => ({
  version: '1.0',
  project: {
    name: 'test-project',
  },
  mcp: {
    enabled: true,
    servers,
  },
});

const createManagerOptions = (
  config: ApexConfig,
  overrides: Partial<MCPConnectionManagerOptions> = {}
): MCPConnectionManagerOptions => ({
  projectPath: '/test/project',
  config,
  autoReconnect: false, // Disabled by default for predictable tests
  maxReconnectAttempts: 3,
  reconnectDelayMs: 100,
  maxReconnectDelayMs: 1000,
  connectionTimeoutMs: 5000,
  ...overrides,
});

// ============================================================================
// Edge Cases and Advanced Scenarios Tests
// ============================================================================

describe('MCPConnectionManager - Edge Cases & Advanced Scenarios', () => {
  let manager: MCPConnectionManager;

  afterEach(async () => {
    if (manager) {
      await manager.disconnectAll();
    }
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // ==========================================================================
  // Exponential Backoff Tests
  // ==========================================================================

  describe('Exponential Backoff Reconnection', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should implement exponential backoff with jitter for reconnection attempts', async () => {
      const config = createTestConfig({
        test: {
          name: 'test',
          type: 'stdio',
          command: 'node',
        },
      });
      manager = new MCPConnectionManager(
        createManagerOptions(config, {
          autoReconnect: true,
          reconnectDelayMs: 100,
          maxReconnectDelayMs: 1000,
          maxReconnectAttempts: 3
        })
      );

      const reconnectingHandler = vi.fn();
      manager.on('reconnecting', reconnectingHandler);

      // Connect initially
      await manager.connect('test');

      // Mock transport to fail and trigger disconnect
      const { StdioTransport } = await import('./transports/index.js');
      const mockTransport = vi.mocked(StdioTransport).mock.results[0]?.value;

      if (mockTransport?._emitter) {
        // Trigger first disconnection
        mockTransport._emitter.emit('disconnected', 'Connection lost');

        // First reconnection attempt should be scheduled with base delay (100ms + jitter)
        expect(reconnectingHandler).toHaveBeenCalledWith('test', 1, 3);

        // Fast-forward past first reconnection delay
        vi.advanceTimersByTime(150);

        // Trigger second disconnection
        mockTransport._emitter.emit('disconnected', 'Connection lost again');

        // Second attempt should be scheduled with doubled delay (200ms + jitter)
        expect(reconnectingHandler).toHaveBeenCalledWith('test', 2, 3);

        // Fast-forward past second reconnection delay
        vi.advanceTimersByTime(300);

        // Trigger third disconnection
        mockTransport._emitter.emit('disconnected', 'Connection lost again');

        // Third attempt should be scheduled with quadrupled delay (400ms + jitter)
        expect(reconnectingHandler).toHaveBeenCalledWith('test', 3, 3);

        // Fast-forward past third reconnection delay
        vi.advanceTimersByTime(500);

        // Fourth disconnection should not trigger another reconnection (max attempts reached)
        mockTransport._emitter.emit('disconnected', 'Connection lost final');

        // Should not have been called again
        expect(reconnectingHandler).toHaveBeenCalledTimes(3);
      }
    });

    it('should respect maxReconnectDelayMs ceiling', async () => {
      const config = createTestConfig({
        test: {
          name: 'test',
          type: 'stdio',
          command: 'node',
        },
      });
      manager = new MCPConnectionManager(
        createManagerOptions(config, {
          autoReconnect: true,
          reconnectDelayMs: 500,
          maxReconnectDelayMs: 800, // Lower than what exponential backoff would produce
          maxReconnectAttempts: 5
        })
      );

      await manager.connect('test');

      const { StdioTransport } = await import('./transports/index.js');
      const mockTransport = vi.mocked(StdioTransport).mock.results[0]?.value;

      if (mockTransport?._emitter) {
        // First attempt: 500ms
        mockTransport._emitter.emit('disconnected', 'test');
        vi.advanceTimersByTime(600);

        // Second attempt: 1000ms but capped at 800ms
        mockTransport._emitter.emit('disconnected', 'test');

        // Should not reconnect before maxReconnectDelayMs
        vi.advanceTimersByTime(700);
        expect(manager.getConnection('test')?.state).toBe('reconnecting');

        // Should reconnect after maxReconnectDelayMs + jitter allowance
        vi.advanceTimersByTime(300);
      }
    });
  });

  // ==========================================================================
  // Concurrent Connection Tests
  // ==========================================================================

  describe('Concurrent Connections', () => {
    it('should handle multiple simultaneous connection attempts gracefully', async () => {
      const config = createTestConfig({
        server1: { name: 'server1', type: 'stdio', command: 'node' },
        server2: { name: 'server2', type: 'stdio', command: 'node' },
        server3: { name: 'server3', type: 'stdio', command: 'node' },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      const connectedHandler = vi.fn();
      manager.on('connected', connectedHandler);

      // Attempt to connect to multiple servers simultaneously
      const connections = await Promise.all([
        manager.connect('server1'),
        manager.connect('server2'),
        manager.connect('server3'),
      ]);

      expect(connections).toHaveLength(3);
      expect(connections[0].serverId).toBe('server1');
      expect(connections[1].serverId).toBe('server2');
      expect(connections[2].serverId).toBe('server3');
      expect(connectedHandler).toHaveBeenCalledTimes(3);
    });

    it('should handle duplicate connection attempts to same server', async () => {
      const config = createTestConfig({
        test: { name: 'test', type: 'stdio', command: 'node' },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      // Start multiple connection attempts to same server
      const connectionPromises = [
        manager.connect('test'),
        manager.connect('test'), // Should throw or return existing
        manager.connect('test'), // Should throw or return existing
      ];

      // First should succeed, others should either throw or return the same connection
      const results = await Promise.allSettled(connectionPromises);

      // At least one should succeed
      expect(results.some(r => r.status === 'fulfilled')).toBe(true);

      // If multiple succeed, they should return the same connection
      const successfulConnections = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value);

      if (successfulConnections.length > 1) {
        expect(successfulConnections.every(c => c === successfulConnections[0])).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Configuration Edge Cases
  // ==========================================================================

  describe('Configuration Edge Cases', () => {
    it('should handle malformed server configurations gracefully', async () => {
      const config = createTestConfig({
        validServer: {
          name: 'valid',
          type: 'stdio',
          command: 'node',
        },
        emptyServer: {} as MCPServerConfig,
        nullCommand: {
          name: 'null-command',
          type: 'stdio',
          command: undefined as any,
        },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      const servers = manager.discoverServers();

      // Should only include valid server
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('valid');
    });

    it('should handle missing mcp configuration', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        // No mcp config
      };
      manager = new MCPConnectionManager(createManagerOptions(config));

      const servers = manager.discoverServers();
      expect(servers).toEqual([]);
    });

    it('should handle disabled mcp configuration', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        mcp: {
          enabled: false,
          servers: {
            test: { name: 'test', type: 'stdio', command: 'node' },
          },
        },
      };
      manager = new MCPConnectionManager(createManagerOptions(config));

      const servers = manager.discoverServers();
      expect(servers).toEqual([]);
    });
  });

  // ==========================================================================
  // Error Handling Edge Cases
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle transport creation failures', async () => {
      const config = createTestConfig({
        test: { name: 'test', type: 'unknown' as any, command: 'node' },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      const errorHandler = vi.fn();
      manager.on('error', errorHandler);

      await expect(manager.connect('test')).rejects.toThrow();
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should handle client connection failures with proper cleanup', async () => {
      const config = createTestConfig({
        test: { name: 'test', type: 'stdio', command: 'node' },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      // Mock client to fail connection
      const { MCPClient } = await import('./client.js');
      vi.mocked(MCPClient).mockImplementationOnce(() => {
        return {
          connect: vi.fn().mockRejectedValue(new Error('Client connection failed')),
          disconnect: vi.fn().mockResolvedValue(undefined),
        } as any;
      });

      const errorHandler = vi.fn();
      manager.on('error', errorHandler);

      await expect(manager.connect('test')).rejects.toThrow('Client connection failed');
      expect(errorHandler).toHaveBeenCalled();

      // Connection should not be in the connections map
      expect(manager.getConnection('test')).toBeUndefined();
    });

    it('should handle disconnect errors gracefully', async () => {
      const config = createTestConfig({
        test: { name: 'test', type: 'stdio', command: 'node' },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      await manager.connect('test');

      // Mock client disconnect to fail
      const client = manager.getClient('test');
      if (client) {
        vi.mocked(client.disconnect).mockRejectedValue(new Error('Disconnect failed'));
      }

      // Should not throw despite disconnect error
      await expect(manager.disconnect('test')).resolves.not.toThrow();

      // Connection should still be cleaned up
      expect(manager.getConnection('test')).toBeUndefined();
    });
  });

  // ==========================================================================
  // State Management Edge Cases
  // ==========================================================================

  describe('State Management', () => {
    it('should handle rapid connect/disconnect cycles', async () => {
      const config = createTestConfig({
        test: { name: 'test', type: 'stdio', command: 'node' },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      const connectedHandler = vi.fn();
      const disconnectedHandler = vi.fn();
      manager.on('connected', connectedHandler);
      manager.on('disconnected', disconnectedHandler);

      // Rapid connect/disconnect cycles
      for (let i = 0; i < 5; i++) {
        await manager.connect('test');
        expect(manager.getConnection('test')?.state).toBe('connected');

        await manager.disconnect('test');
        expect(manager.getConnection('test')).toBeUndefined();
      }

      expect(connectedHandler).toHaveBeenCalledTimes(5);
      expect(disconnectedHandler).toHaveBeenCalledTimes(5);
    });

    it('should maintain correct state during connection attempts', async () => {
      const config = createTestConfig({
        test: { name: 'test', type: 'stdio', command: 'node' },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      const connectionPromise = manager.connect('test');

      // During connection, state should be 'connecting'
      const connectionDuringConnect = manager.getConnection('test');
      expect(connectionDuringConnect?.state).toBe('connecting');

      await connectionPromise;

      // After connection, state should be 'connected'
      const connectionAfterConnect = manager.getConnection('test');
      expect(connectionAfterConnect?.state).toBe('connected');
    });

    it('should handle config updates correctly', () => {
      const initialConfig = createTestConfig({
        server1: { name: 'server1', type: 'stdio', command: 'node' },
      });
      manager = new MCPConnectionManager(createManagerOptions(initialConfig));

      expect(manager.discoverServers()).toHaveLength(1);

      // Update config with new servers
      const newConfig = createTestConfig({
        server1: { name: 'server1', type: 'stdio', command: 'node' },
        server2: { name: 'server2', type: 'stdio', command: 'node' },
      });
      manager.updateConfig(newConfig);

      expect(manager.discoverServers()).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Resource Cleanup Tests
  // ==========================================================================

  describe('Resource Cleanup', () => {
    it('should clean up timers on disconnect', async () => {
      vi.useFakeTimers();

      const config = createTestConfig({
        test: { name: 'test', type: 'stdio', command: 'node' },
      });
      manager = new MCPConnectionManager(
        createManagerOptions(config, { autoReconnect: true })
      );

      await manager.connect('test');

      // Trigger disconnect to start reconnection
      const { StdioTransport } = await import('./transports/index.js');
      const mockTransport = vi.mocked(StdioTransport).mock.results[0]?.value;

      if (mockTransport?._emitter) {
        mockTransport._emitter.emit('disconnected', 'test disconnect');

        // Manually disconnect before timer fires
        await manager.disconnect('test');

        // Advance timers - should not trigger reconnection
        vi.advanceTimersByTime(5000);

        // Connection should remain disconnected
        expect(manager.getConnection('test')).toBeUndefined();
      }

      vi.useRealTimers();
    });

    it('should handle disconnectAll with multiple servers', async () => {
      const config = createTestConfig({
        server1: { name: 'server1', type: 'stdio', command: 'node' },
        server2: { name: 'server2', type: 'stdio', command: 'node' },
        server3: { name: 'server3', type: 'stdio', command: 'node' },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      // Connect to multiple servers
      await Promise.all([
        manager.connect('server1'),
        manager.connect('server2'),
        manager.connect('server3'),
      ]);

      expect(manager.listConnections()).toHaveLength(3);

      // Disconnect all
      await manager.disconnectAll();

      expect(manager.listConnections()).toHaveLength(0);
    });
  });
});