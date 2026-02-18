/**
 * MCPConnectionManager Integration Tests
 *
 * Tests that verify MCPConnectionManager works correctly with actual
 * transport and client implementations (mocked but realistic).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { ApexConfig, MCPServerConfig } from '@apexcli/core';
import {
  MCPConnectionManager,
  type MCPConnectionManagerOptions,
} from './connection-manager.js';

// ============================================================================
// Realistic Mock Setup
// ============================================================================

// Mock realistic transport behavior
class MockStdioTransport extends EventEmitter {
  private connected = false;
  private connectionDelay: number;

  constructor(private options: any) {
    super();
    this.connectionDelay = options.connectionTimeout || 1000;
  }

  async connect(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50)); // Simulate real connection time
    this.connected = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 20)); // Simulate real disconnection time
    this.connected = false;
    this.emit('disconnected', 'Manual disconnect');
  }

  isConnected(): boolean {
    return this.connected;
  }

  getState(): string {
    return this.connected ? 'connected' : 'disconnected';
  }

  async send(message: any): Promise<any> {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    return { id: message.id, result: {} };
  }

  // Simulate transport failures
  simulateDisconnection(reason = 'Connection lost') {
    if (this.connected) {
      this.connected = false;
      this.emit('disconnected', reason);
    }
  }

  simulateError(error: Error) {
    this.emit('error', error);
  }
}

// Mock realistic client behavior
class MockMCPClient {
  private initializationTime = Math.random() * 100;

  constructor(private transport: MockStdioTransport) {}

  async connect(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.initializationTime));
    await this.transport.connect();

    // Simulate initialization protocol
    await this.transport.send({ method: 'initialize', params: {} });
  }

  async disconnect(): Promise<void> {
    try {
      // Simulate cleanup protocol
      await this.transport.send({ method: 'shutdown', params: {} });
    } catch (error) {
      // Ignore send errors during shutdown
    }
    await this.transport.disconnect();
  }

  async listTools(): Promise<any[]> {
    const response = await this.transport.send({ method: 'tools/list', params: {} });
    return response.result?.tools || [];
  }

  async callTool(name: string, args: any): Promise<any> {
    const response = await this.transport.send({
      method: 'tools/call',
      params: { name, arguments: args }
    });
    return response.result;
  }
}

// Mock the modules to use realistic implementations
vi.mock('./transports/index.js', () => ({
  StdioTransport: vi.fn().mockImplementation((options) => new MockStdioTransport(options)),
}));

vi.mock('./client.js', () => ({
  MCPClient: vi.fn().mockImplementation(({ transport }) => new MockMCPClient(transport)),
}));

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
  autoReconnect: true,
  maxReconnectAttempts: 3,
  reconnectDelayMs: 100,
  maxReconnectDelayMs: 1000,
  connectionTimeoutMs: 5000,
  ...overrides,
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('MCPConnectionManager - Integration', () => {
  let manager: MCPConnectionManager;

  afterEach(async () => {
    if (manager) {
      await manager.disconnectAll();
    }
    vi.clearAllMocks();
  });

  describe('Realistic Connection Scenarios', () => {
    it('should successfully establish connections with realistic timing', async () => {
      const config = createTestConfig({
        filesystem: {
          name: 'Filesystem',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
          env: { NODE_ENV: 'test' },
        },
        memory: {
          name: 'Memory',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-memory'],
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      const connectedEvents: any[] = [];
      manager.on('connected', (connection) => connectedEvents.push(connection));

      const startTime = Date.now();

      // Connect to both servers
      const [fsConnection, memConnection] = await Promise.all([
        manager.connect('filesystem'),
        manager.connect('memory'),
      ]);

      const endTime = Date.now();
      const connectionTime = endTime - startTime;

      // Verify connections
      expect(fsConnection.serverId).toBe('filesystem');
      expect(fsConnection.serverName).toBe('Filesystem');
      expect(fsConnection.state).toBe('connected');
      expect(fsConnection.connectedAt).toBeInstanceOf(Date);

      expect(memConnection.serverId).toBe('memory');
      expect(memConnection.serverName).toBe('Memory');
      expect(memConnection.state).toBe('connected');

      expect(connectedEvents).toHaveLength(2);
      expect(connectionTime).toBeLessThan(1000); // Should connect relatively quickly
    });

    it('should handle connection failures gracefully', async () => {
      const config = createTestConfig({
        failing: {
          name: 'Failing Server',
          type: 'stdio',
          command: 'non-existent-command',
        },
        working: {
          name: 'Working Server',
          type: 'stdio',
          command: 'node',
          args: ['-e', 'console.log("MCP Server")'],
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      const errorEvents: any[] = [];
      manager.on('error', (serverId, error) => errorEvents.push({ serverId, error }));

      // Override the transport for the failing server to actually fail
      const { StdioTransport } = await import('./transports/index.js');
      let callCount = 0;
      vi.mocked(StdioTransport).mockImplementation((options) => {
        callCount++;
        if (callCount === 1) {
          // First call (failing server)
          const transport = new MockStdioTransport(options);
          transport.connect = vi.fn().mockRejectedValue(new Error('Command not found'));
          return transport as any;
        }
        return new MockStdioTransport(options);
      });

      // Attempt connections
      const results = await Promise.allSettled([
        manager.connect('failing'),
        manager.connect('working'),
      ]);

      // Failing server should reject
      expect(results[0].status).toBe('rejected');

      // Working server should succeed
      expect(results[1].status).toBe('fulfilled');
      if (results[1].status === 'fulfilled') {
        expect(results[1].value.serverId).toBe('working');
        expect(results[1].value.state).toBe('connected');
      }

      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].serverId).toBe('failing');
    });

    it('should properly handle disconnection scenarios', async () => {
      const config = createTestConfig({
        test: {
          name: 'Test Server',
          type: 'stdio',
          command: 'node',
          args: ['-e', 'require("net").createServer().listen(0)'],
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      const disconnectedEvents: any[] = [];
      manager.on('disconnected', (serverId, reason) => {
        disconnectedEvents.push({ serverId, reason });
      });

      // Connect
      const connection = await manager.connect('test');
      expect(connection.state).toBe('connected');

      // Get the transport instance
      const transport = manager.getClient('test')?.transport as MockStdioTransport;
      expect(transport).toBeDefined();

      // Simulate unexpected disconnection
      transport.simulateDisconnection('Network error');

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(disconnectedEvents).toHaveLength(1);
      expect(disconnectedEvents[0].serverId).toBe('test');
      expect(disconnectedEvents[0].reason).toBe('Network error');

      // Manual disconnect
      await manager.disconnect('test');
      expect(manager.getConnection('test')).toBeUndefined();
    });
  });

  describe('Auto-Reconnection Integration', () => {
    it('should successfully reconnect after connection loss', async () => {
      vi.useFakeTimers();

      const config = createTestConfig({
        unstable: {
          name: 'Unstable Server',
          type: 'stdio',
          command: 'node',
          args: ['-e', 'process.exit(0)'],
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config, {
        autoReconnect: true,
        reconnectDelayMs: 100,
        maxReconnectAttempts: 2,
      }));

      const reconnectingEvents: any[] = [];
      const connectedEvents: any[] = [];

      manager.on('reconnecting', (serverId, attempt, maxAttempts) => {
        reconnectingEvents.push({ serverId, attempt, maxAttempts });
      });

      manager.on('connected', (connection) => {
        connectedEvents.push(connection);
      });

      // Initial connection
      await manager.connect('unstable');
      expect(connectedEvents).toHaveLength(1);

      // Get transport and simulate disconnection
      const client = manager.getClient('unstable');
      const transport = client?.transport as MockStdioTransport;

      // Simulate connection loss
      transport.simulateDisconnection('Process exited');

      // Wait for reconnection event
      await new Promise(resolve => setImmediate(resolve));

      expect(reconnectingEvents).toHaveLength(1);
      expect(reconnectingEvents[0].serverId).toBe('unstable');
      expect(reconnectingEvents[0].attempt).toBe(1);
      expect(reconnectingEvents[0].maxAttempts).toBe(2);

      // Advance timers to trigger reconnection
      vi.advanceTimersByTime(150);
      await new Promise(resolve => setImmediate(resolve));

      // Should have reconnected
      expect(connectedEvents).toHaveLength(2);
      expect(manager.getConnection('unstable')?.state).toBe('connected');

      vi.useRealTimers();
    });

    it('should stop reconnecting after max attempts', async () => {
      vi.useFakeTimers();

      const config = createTestConfig({
        unreliable: {
          name: 'Unreliable Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config, {
        autoReconnect: true,
        reconnectDelayMs: 50,
        maxReconnectAttempts: 2,
      }));

      const reconnectingEvents: any[] = [];
      manager.on('reconnecting', (serverId, attempt, maxAttempts) => {
        reconnectingEvents.push({ serverId, attempt, maxAttempts });
      });

      // Connect initially
      await manager.connect('unreliable');

      // Get transport and simulate repeated failures
      const client = manager.getClient('unreliable');
      const transport = client?.transport as MockStdioTransport;

      // Override connect to always fail after initial connection
      let reconnectAttempts = 0;
      const originalConnect = transport.connect.bind(transport);
      transport.connect = vi.fn().mockImplementation(async () => {
        if (reconnectAttempts > 0) {
          throw new Error('Reconnection failed');
        }
        return originalConnect();
      });

      // Simulate first disconnection
      transport.simulateDisconnection('Connection lost');
      await new Promise(resolve => setImmediate(resolve));

      // Fast forward through first reconnection attempt
      reconnectAttempts++;
      vi.advanceTimersByTime(100);
      await new Promise(resolve => setImmediate(resolve));

      // Should emit second reconnection event
      expect(reconnectingEvents).toHaveLength(2);

      // Fast forward through second reconnection attempt
      reconnectAttempts++;
      vi.advanceTimersByTime(150);
      await new Promise(resolve => setImmediate(resolve));

      // Should not emit more reconnection events (max attempts reached)
      expect(reconnectingEvents).toHaveLength(2);
      expect(reconnectingEvents[1].attempt).toBe(2);

      vi.useRealTimers();
    });
  });

  describe('Multiple Server Management', () => {
    it('should manage multiple servers independently', async () => {
      const config = createTestConfig({
        server1: {
          name: 'Server 1',
          type: 'stdio',
          command: 'node',
          args: ['-e', 'console.log("Server 1")'],
        },
        server2: {
          name: 'Server 2',
          type: 'stdio',
          command: 'node',
          args: ['-e', 'console.log("Server 2")'],
        },
        server3: {
          name: 'Server 3',
          type: 'stdio',
          command: 'node',
          args: ['-e', 'console.log("Server 3")'],
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      // Connect to all servers
      const connections = await Promise.all([
        manager.connect('server1'),
        manager.connect('server2'),
        manager.connect('server3'),
      ]);

      expect(connections).toHaveLength(3);
      expect(manager.listConnections()).toHaveLength(3);

      // Test individual server operations
      const server1Client = manager.getClient('server1');
      expect(server1Client).toBeDefined();

      // Disconnect one server
      await manager.disconnect('server2');
      expect(manager.listConnections()).toHaveLength(2);
      expect(manager.getConnection('server2')).toBeUndefined();
      expect(manager.getConnection('server1')).toBeDefined();
      expect(manager.getConnection('server3')).toBeDefined();

      // Reconnect to disconnected server
      const newConnection = await manager.connect('server2');
      expect(newConnection.serverId).toBe('server2');
      expect(manager.listConnections()).toHaveLength(3);

      // Disconnect all
      await manager.disconnectAll();
      expect(manager.listConnections()).toHaveLength(0);
    });
  });

  describe('Tool Integration', () => {
    it('should support tool listing and calling through connected clients', async () => {
      const config = createTestConfig({
        toolServer: {
          name: 'Tool Server',
          type: 'stdio',
          command: 'node',
          args: ['-e', 'console.log("Tool server with mock tools")'],
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      await manager.connect('toolServer');

      const client = manager.getClient('toolServer');
      expect(client).toBeDefined();

      if (client) {
        // Test tool listing
        const tools = await client.listTools();
        expect(Array.isArray(tools)).toBe(true);

        // Test tool calling (mock will return empty result)
        const result = await client.callTool('test-tool', { param: 'value' });
        expect(result).toBeDefined();
      }
    });
  });

  describe('Error Recovery', () => {
    it('should recover gracefully from transport errors', async () => {
      const config = createTestConfig({
        errorProne: {
          name: 'Error Prone Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      const errorEvents: any[] = [];
      manager.on('error', (serverId, error) => {
        errorEvents.push({ serverId, error });
      });

      await manager.connect('errorProne');

      // Get transport and simulate error
      const client = manager.getClient('errorProne');
      const transport = client?.transport as MockStdioTransport;

      transport.simulateError(new Error('Transport protocol error'));

      // Wait for error event
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].serverId).toBe('errorProne');
      expect(errorEvents[0].error.message).toBe('Transport protocol error');

      // Connection should still be usable
      expect(manager.getConnection('errorProne')).toBeDefined();
    });
  });
});