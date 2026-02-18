/**
 * MCPConnectionManager Unit Tests
 *
 * Tests for the MCPConnectionManager class, verifying:
 * - Server discovery from configuration
 * - Connection establishment and state tracking
 * - Disconnection handling
 * - Event emission (connected, disconnected, error, reconnecting)
 * - Auto-reconnection with exponential backoff
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

// Helper to create a mock transport
function createMockTransport() {
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
    connect: vi.fn().mockResolvedValue(undefined),
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
    ping: vi.fn().mockResolvedValue(undefined), // Mock heartbeat ping
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
  autoReconnect: false, // Disable for most tests
  maxReconnectAttempts: 3,
  reconnectDelayMs: 100,
  maxReconnectDelayMs: 1000,
  connectionTimeoutMs: 5000,
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('MCPConnectionManager', () => {
  let manager: MCPConnectionManager;

  afterEach(async () => {
    if (manager) {
      await manager.disconnectAll();
    }
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe('constructor', () => {
    it('should create a new instance with default options', () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(config));

      expect(manager).toBeInstanceOf(MCPConnectionManager);
      expect(manager).toBeInstanceOf(EventEmitter);
    });

    it('should accept custom options', () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(
        createManagerOptions(config, {
          autoReconnect: true,
          maxReconnectAttempts: 5,
          reconnectDelayMs: 2000,
        })
      );

      expect(manager).toBeInstanceOf(MCPConnectionManager);
    });
  });

  // ==========================================================================
  // discoverServers() Tests
  // ==========================================================================

  describe('discoverServers()', () => {
    it('should return empty array when MCP is disabled', () => {
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

    it('should return empty array when no servers configured', () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(config));

      const servers = manager.discoverServers();

      expect(servers).toEqual([]);
    });

    it('should discover stdio servers with valid configuration', () => {
      const config = createTestConfig({
        filesystem: {
          name: 'filesystem',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
        },
        memory: {
          name: 'memory',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-memory'],
        },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      const servers = manager.discoverServers();

      expect(servers).toHaveLength(2);
      expect(servers.map(s => s.name)).toContain('filesystem');
      expect(servers.map(s => s.name)).toContain('memory');
    });

    it('should filter out SDK type servers', () => {
      const config = createTestConfig({
        stdio: {
          name: 'stdio',
          type: 'stdio',
          command: 'node',
        },
        sdk: {
          name: 'sdk',
          type: 'sdk',
          command: 'node',
        },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      const servers = manager.discoverServers();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('stdio');
    });

    it('should filter out stdio servers without command', () => {
      const config = createTestConfig({
        valid: {
          name: 'valid',
          type: 'stdio',
          command: 'node',
        },
        invalid: {
          name: 'invalid',
          type: 'stdio',
          // Missing command
        },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      const servers = manager.discoverServers();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('valid');
    });

    it('should filter out http/sse servers without URL', () => {
      const config = createTestConfig({
        httpValid: {
          name: 'httpValid',
          type: 'http',
          url: 'http://localhost:3000',
        },
        httpInvalid: {
          name: 'httpInvalid',
          type: 'http',
          // Missing URL
        },
        sseValid: {
          name: 'sseValid',
          type: 'sse',
          url: 'http://localhost:3001',
        },
        sseInvalid: {
          name: 'sseInvalid',
          type: 'sse',
          // Missing URL
        },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      const servers = manager.discoverServers();

      expect(servers).toHaveLength(2);
      expect(servers.map(s => s.name)).toContain('httpValid');
      expect(servers.map(s => s.name)).toContain('sseValid');
    });

    it('should use serverId as name when name is not set', () => {
      const config = createTestConfig({
        'my-server': {
          type: 'stdio',
          command: 'node',
        } as MCPServerConfig,
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      const servers = manager.discoverServers();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('my-server');
    });
  });

  // ==========================================================================
  // connect() Tests
  // ==========================================================================

  describe('connect()', () => {
    it('should connect to a valid stdio server', async () => {
      const config = createTestConfig({
        test: {
          name: 'test',
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
        },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      const connection = await manager.connect('test');

      expect(connection).toBeDefined();
      expect(connection.serverId).toBe('test');
      expect(connection.serverName).toBe('test');
      expect(connection.state).toBe('connected');
      expect(connection.connectedAt).toBeInstanceOf(Date);
      expect(connection.reconnectAttempts).toBe(0);
    });

    it('should emit connected event on successful connection', async () => {
      const config = createTestConfig({
        test: {
          name: 'test',
          type: 'stdio',
          command: 'node',
        },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      const connectedHandler = vi.fn();
      manager.on('connected', connectedHandler);

      await manager.connect('test');

      expect(connectedHandler).toHaveBeenCalledTimes(1);
      expect(connectedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 'test',
          state: 'connected',
        })
      );
    });

    it('should return existing connection if already connected', async () => {
      const config = createTestConfig({
        test: {
          name: 'test',
          type: 'stdio',
          command: 'node',
        },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      const first = await manager.connect('test');
      const second = await manager.connect('test');

      expect(first).toBe(second);
    });

    it('should throw error for non-existent server', async () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(config));

      await expect(manager.connect('nonexistent')).rejects.toThrow(
        "MCP server 'nonexistent' not found in configuration"
      );
    });

    it('should throw error for unsupported transport types', async () => {
      const config = createTestConfig({
        http: {
          name: 'http',
          type: 'http',
          url: 'http://localhost:3000',
        },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      await expect(manager.connect('http')).rejects.toThrow(
        "Transport type 'http' is not yet implemented"
      );
    });

    it('should emit error event on connection failure', async () => {
      // Override mock to fail
      const { StdioTransport } = await import('./transports/index.js');
      vi.mocked(StdioTransport).mockImplementationOnce(() => {
        const transport = createMockTransport();
        return transport;
      });

      const { MCPClient } = await import('./client.js');
      vi.mocked(MCPClient).mockImplementationOnce(() => {
        return {
          connect: vi.fn().mockRejectedValue(new Error('Connection refused')),
          disconnect: vi.fn().mockResolvedValue(undefined),
        } as any;
      });

      const config = createTestConfig({
        test: {
          name: 'test',
          type: 'stdio',
          command: 'node',
        },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      const errorHandler = vi.fn();
      manager.on('error', errorHandler);

      await expect(manager.connect('test')).rejects.toThrow('Connection refused');

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith('test', expect.any(Error));
    });
  });

  // ==========================================================================
  // disconnect() Tests
  // ==========================================================================

  describe('disconnect()', () => {
    it('should disconnect from a connected server', async () => {
      const config = createTestConfig({
        test: {
          name: 'test',
          type: 'stdio',
          command: 'node',
        },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      await manager.connect('test');
      await manager.disconnect('test');

      const connection = manager.getConnection('test');
      expect(connection).toBeUndefined();
    });

    it('should emit disconnected event', async () => {
      const config = createTestConfig({
        test: {
          name: 'test',
          type: 'stdio',
          command: 'node',
        },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      const disconnectedHandler = vi.fn();
      manager.on('disconnected', disconnectedHandler);

      await manager.connect('test');
      await manager.disconnect('test');

      expect(disconnectedHandler).toHaveBeenCalledTimes(1);
      expect(disconnectedHandler).toHaveBeenCalledWith('test', expect.any(String));
    });

    it('should not throw if server is not connected', async () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(config));

      await expect(manager.disconnect('nonexistent')).resolves.not.toThrow();
    });

    it('should be idempotent', async () => {
      const config = createTestConfig({
        test: {
          name: 'test',
          type: 'stdio',
          command: 'node',
        },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      await manager.connect('test');
      await manager.disconnect('test');
      await manager.disconnect('test');

      expect(manager.getConnection('test')).toBeUndefined();
    });
  });

  // ==========================================================================
  // getConnection() Tests
  // ==========================================================================

  describe('getConnection()', () => {
    it('should return connection for connected server', async () => {
      const config = createTestConfig({
        test: {
          name: 'test',
          type: 'stdio',
          command: 'node',
        },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      await manager.connect('test');
      const connection = manager.getConnection('test');

      expect(connection).toBeDefined();
      expect(connection?.serverId).toBe('test');
      expect(connection?.state).toBe('connected');
    });

    it('should return undefined for non-connected server', () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(config));

      const connection = manager.getConnection('nonexistent');

      expect(connection).toBeUndefined();
    });
  });

  // ==========================================================================
  // listConnections() Tests
  // ==========================================================================

  describe('listConnections()', () => {
    it('should return empty array when no connections', () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(config));

      const connections = manager.listConnections();

      expect(connections).toEqual([]);
    });

    it('should return all connections', async () => {
      const config = createTestConfig({
        server1: {
          name: 'server1',
          type: 'stdio',
          command: 'node',
        },
        server2: {
          name: 'server2',
          type: 'stdio',
          command: 'node',
        },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      await manager.connect('server1');
      await manager.connect('server2');

      const connections = manager.listConnections();

      expect(connections).toHaveLength(2);
      expect(connections.map(c => c.serverId)).toContain('server1');
      expect(connections.map(c => c.serverId)).toContain('server2');
    });
  });

  // ==========================================================================
  // getClient() Tests
  // ==========================================================================

  describe('getClient()', () => {
    it('should return client for connected server', async () => {
      const config = createTestConfig({
        test: {
          name: 'test',
          type: 'stdio',
          command: 'node',
        },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      await manager.connect('test');
      const client = manager.getClient('test');

      expect(client).toBeDefined();
    });

    it('should return undefined for non-connected server', () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(config));

      const client = manager.getClient('nonexistent');

      expect(client).toBeUndefined();
    });
  });

  // ==========================================================================
  // updateConfig() Tests
  // ==========================================================================

  describe('updateConfig()', () => {
    it('should update configuration', () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(config));

      const newConfig = createTestConfig({
        newServer: {
          name: 'newServer',
          type: 'stdio',
          command: 'node',
        },
      });

      manager.updateConfig(newConfig);
      const servers = manager.discoverServers();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('newServer');
    });
  });

  // ==========================================================================
  // disconnectAll() Tests
  // ==========================================================================

  describe('disconnectAll()', () => {
    it('should disconnect all connected servers', async () => {
      const config = createTestConfig({
        server1: {
          name: 'server1',
          type: 'stdio',
          command: 'node',
        },
        server2: {
          name: 'server2',
          type: 'stdio',
          command: 'node',
        },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      await manager.connect('server1');
      await manager.connect('server2');

      expect(manager.listConnections()).toHaveLength(2);

      await manager.disconnectAll();

      expect(manager.listConnections()).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Event Emission Tests
  // ==========================================================================

  describe('Event Emission', () => {
    it('should extend EventEmitter', () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(config));

      expect(manager).toBeInstanceOf(EventEmitter);
      expect(typeof manager.on).toBe('function');
      expect(typeof manager.off).toBe('function');
      expect(typeof manager.emit).toBe('function');
    });

    it('should support all required event types', async () => {
      const config = createTestConfig({
        test: {
          name: 'test',
          type: 'stdio',
          command: 'node',
        },
      });
      manager = new MCPConnectionManager(createManagerOptions(config));

      const connectedHandler = vi.fn();
      const disconnectedHandler = vi.fn();
      const errorHandler = vi.fn();
      const reconnectingHandler = vi.fn();

      manager.on('connected', connectedHandler);
      manager.on('disconnected', disconnectedHandler);
      manager.on('error', errorHandler);
      manager.on('reconnecting', reconnectingHandler);

      await manager.connect('test');
      await manager.disconnect('test');

      expect(connectedHandler).toHaveBeenCalled();
      expect(disconnectedHandler).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Reconnection Tests
  // ==========================================================================

  describe('Reconnection', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should emit reconnecting event on transport disconnect when autoReconnect is enabled', async () => {
      vi.useRealTimers(); // Use real timers for async operations

      const config = createTestConfig({
        test: {
          name: 'test',
          type: 'stdio',
          command: 'node',
        },
      });
      manager = new MCPConnectionManager(
        createManagerOptions(config, { autoReconnect: true })
      );

      const reconnectingHandler = vi.fn();
      manager.on('reconnecting', reconnectingHandler);

      await manager.connect('test');

      // Get the transport's internal emitter and trigger disconnect
      const { StdioTransport } = await import('./transports/index.js');
      const mockTransportInstance = vi.mocked(StdioTransport).mock.results[0]?.value;
      if (mockTransportInstance?._emitter) {
        mockTransportInstance._emitter.emit('disconnected', 'test disconnect');
      }

      // Wait a tick for async operations
      await new Promise(resolve => setImmediate(resolve));

      expect(reconnectingHandler).toHaveBeenCalledWith('test', 1, 3);
    });
  });
});
