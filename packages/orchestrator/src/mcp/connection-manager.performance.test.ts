/**
 * MCPConnectionManager Performance Tests
 *
 * Tests focused on performance characteristics and resource usage
 * of the MCPConnectionManager under various load conditions.
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

vi.mock('./transports/index.js', () => ({
  StdioTransport: vi.fn().mockImplementation(() => createMockTransport()),
}));

vi.mock('./client.js', () => ({
  MCPClient: vi.fn().mockImplementation(({ transport }) => createMockClient(transport)),
}));

function createMockTransport() {
  const emitter = new EventEmitter();
  return {
    on: vi.fn((event, handler) => emitter.on(event, handler)),
    off: vi.fn((event, handler) => emitter.off(event, handler)),
    emit: vi.fn((event, ...args) => emitter.emit(event, ...args)),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    getState: vi.fn().mockReturnValue('connected'),
    _emitter: emitter,
  };
}

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
  project: { name: 'test-project' },
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
  autoReconnect: false,
  maxReconnectAttempts: 3,
  reconnectDelayMs: 100,
  maxReconnectDelayMs: 1000,
  connectionTimeoutMs: 5000,
  ...overrides,
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('MCPConnectionManager - Performance', () => {
  let manager: MCPConnectionManager;

  afterEach(async () => {
    if (manager) {
      await manager.disconnectAll();
    }
    vi.clearAllMocks();
  });

  describe('High Volume Operations', () => {
    it('should handle large number of server discoveries efficiently', () => {
      const startTime = performance.now();

      // Create config with many servers
      const servers: Record<string, MCPServerConfig> = {};
      for (let i = 0; i < 1000; i++) {
        servers[`server${i}`] = {
          name: `server${i}`,
          type: 'stdio',
          command: 'node',
          args: [`server${i}.js`],
        };
      }

      const config = createTestConfig(servers);
      manager = new MCPConnectionManager(createManagerOptions(config));

      const discoveredServers = manager.discoverServers();

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(discoveredServers).toHaveLength(1000);
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    it('should efficiently manage memory with many connections', async () => {
      // Create config with multiple servers
      const servers: Record<string, MCPServerConfig> = {};
      for (let i = 0; i < 50; i++) {
        servers[`server${i}`] = {
          name: `server${i}`,
          type: 'stdio',
          command: 'node',
        };
      }

      const config = createTestConfig(servers);
      manager = new MCPConnectionManager(createManagerOptions(config));

      const startTime = performance.now();

      // Connect to all servers
      const connectPromises = Object.keys(servers).map(serverId =>
        manager.connect(serverId)
      );

      const connections = await Promise.all(connectPromises);
      const connectTime = performance.now() - startTime;

      expect(connections).toHaveLength(50);
      expect(manager.listConnections()).toHaveLength(50);
      expect(connectTime).toBeLessThan(1000); // Should complete within 1 second

      // Disconnect all and measure cleanup time
      const disconnectStartTime = performance.now();
      await manager.disconnectAll();
      const disconnectTime = performance.now() - disconnectStartTime;

      expect(manager.listConnections()).toHaveLength(0);
      expect(disconnectTime).toBeLessThan(500); // Should cleanup within 500ms
    });

    it('should handle rapid event emission without memory leaks', async () => {
      const config = createTestConfig({
        test: { name: 'test', type: 'stdio', command: 'node' },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      // Add many event listeners
      const eventHandlers = [];
      for (let i = 0; i < 100; i++) {
        const handler = vi.fn();
        manager.on('connected', handler);
        manager.on('disconnected', handler);
        manager.on('error', handler);
        manager.on('reconnecting', handler);
        eventHandlers.push(handler);
      }

      await manager.connect('test');

      // Emit many events
      for (let i = 0; i < 1000; i++) {
        manager.emit('connected', { serverId: 'test' } as any);
      }

      // Each handler should have been called 1001 times (1 real + 1000 emitted)
      eventHandlers.forEach(handler => {
        expect(handler).toHaveBeenCalledTimes(1001);
      });

      await manager.disconnect('test');
    });
  });

  describe('Resource Usage', () => {
    it('should properly clean up resources on disconnect', async () => {
      const config = createTestConfig({
        test: { name: 'test', type: 'stdio', command: 'node' },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      await manager.connect('test');

      // Verify connection is tracked
      expect(manager.getConnection('test')).toBeDefined();
      expect(manager.getClient('test')).toBeDefined();

      await manager.disconnect('test');

      // Verify resources are cleaned up
      expect(manager.getConnection('test')).toBeUndefined();
      expect(manager.getClient('test')).toBeUndefined();
    });

    it('should handle timer cleanup correctly with autoReconnect', async () => {
      vi.useFakeTimers();

      const config = createTestConfig({
        test: { name: 'test', type: 'stdio', command: 'node' },
      });
      manager = new MCPConnectionManager(
        createManagerOptions(config, { autoReconnect: true })
      );

      await manager.connect('test');

      // Get transport and trigger disconnect
      const { StdioTransport } = await import('./transports/index.js');
      const mockTransport = vi.mocked(StdioTransport).mock.results[0]?.value;

      if (mockTransport?._emitter) {
        // Trigger disconnect - should schedule reconnection
        mockTransport._emitter.emit('disconnected', 'test');

        // Disconnect before timer fires - should cleanup timer
        await manager.disconnect('test');

        // Advance timers significantly
        vi.advanceTimersByTime(10000);

        // Should not have reconnected
        expect(manager.getConnection('test')).toBeUndefined();
      }

      vi.useRealTimers();
    });
  });

  describe('Configuration Processing', () => {
    it('should efficiently filter configurations', () => {
      // Create config with mix of valid and invalid servers
      const servers: Record<string, MCPServerConfig> = {};

      // Valid servers
      for (let i = 0; i < 100; i++) {
        servers[`valid${i}`] = {
          name: `valid${i}`,
          type: 'stdio',
          command: 'node',
        };
      }

      // Invalid servers (missing command)
      for (let i = 0; i < 100; i++) {
        servers[`invalid${i}`] = {
          name: `invalid${i}`,
          type: 'stdio',
        } as any;
      }

      // SDK servers (should be filtered)
      for (let i = 0; i < 100; i++) {
        servers[`sdk${i}`] = {
          name: `sdk${i}`,
          type: 'sdk',
          command: 'node',
        };
      }

      const config = createTestConfig(servers);
      manager = new MCPConnectionManager(createManagerOptions(config));

      const startTime = performance.now();
      const discovered = manager.discoverServers();
      const endTime = performance.now();

      expect(discovered).toHaveLength(100); // Only valid servers
      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
    });

    it('should handle config updates efficiently', () => {
      const initialConfig = createTestConfig({
        server1: { name: 'server1', type: 'stdio', command: 'node' },
      });

      manager = new MCPConnectionManager(createManagerOptions(initialConfig));

      // Update config multiple times
      for (let i = 0; i < 1000; i++) {
        const newServers: Record<string, MCPServerConfig> = {};
        for (let j = 0; j < 10; j++) {
          newServers[`server_${i}_${j}`] = {
            name: `server_${i}_${j}`,
            type: 'stdio',
            command: 'node',
          };
        }

        const newConfig = createTestConfig(newServers);

        const startTime = performance.now();
        manager.updateConfig(newConfig);
        const endTime = performance.now();

        expect(endTime - startTime).toBeLessThan(10); // Should be very fast
        expect(manager.discoverServers()).toHaveLength(10);
      }
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent connect/disconnect operations', async () => {
      const config = createTestConfig({
        test1: { name: 'test1', type: 'stdio', command: 'node' },
        test2: { name: 'test2', type: 'stdio', command: 'node' },
        test3: { name: 'test3', type: 'stdio', command: 'node' },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      const startTime = performance.now();

      // Concurrent operations
      const operations = [
        manager.connect('test1'),
        manager.connect('test2'),
        manager.connect('test3'),
        manager.connect('test1'), // Duplicate - should handle gracefully
        manager.connect('test2'), // Duplicate - should handle gracefully
      ];

      const results = await Promise.allSettled(operations);
      const endTime = performance.now();

      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(1000);

      // Should have 3 connections (duplicates should be handled)
      expect(manager.listConnections()).toHaveLength(3);

      // Most operations should succeed
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThanOrEqual(3);
    });
  });
});