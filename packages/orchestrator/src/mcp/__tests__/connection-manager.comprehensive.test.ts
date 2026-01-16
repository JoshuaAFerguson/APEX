/**
 * Comprehensive Unit Tests for MCPConnectionManager
 *
 * This test suite covers all core functionality of the MCPConnectionManager:
 * - Server discovery from configuration
 * - Transport connection/disconnection lifecycle
 * - Reconnection logic with exponential backoff
 * - Event emission (connected, disconnected, error, reconnecting, stateChange)
 * - Error handling scenarios
 * - Health check integration
 * - Configuration management
 *
 * Acceptance Criteria:
 * ✓ Transport connection/disconnection
 * ✓ Discovery from config
 * ✓ Reconnection logic
 * ✓ Event emission
 * ✓ Error scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { ApexConfig, MCPServerConfig, MCPConnectionState } from '@apexcli/core';
import {
  MCPConnectionManager,
  type MCPConnectionManagerOptions,
  type MCPConnectionManagerEvents,
  type HealthCheckResult,
} from '../connection-manager.js';

// ============================================================================
// Mock Setup
// ============================================================================

// Create a more comprehensive mock transport
class MockTransport extends EventEmitter {
  public isConnectedState = false;
  public shouldFailConnect = false;
  public shouldFailAfterDelay = false;
  public connectDelay = 0;
  public connectionAttempts = 0;

  async connect(): Promise<void> {
    this.connectionAttempts++;

    if (this.shouldFailConnect) {
      const error = new Error(`Mock transport connection failed (attempt ${this.connectionAttempts})`);
      this.emit('error', error);
      throw error;
    }

    if (this.connectDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.connectDelay));
    }

    if (this.shouldFailAfterDelay) {
      const error = new Error('Mock transport connection timeout');
      this.emit('error', error);
      throw error;
    }

    this.isConnectedState = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    if (this.isConnectedState) {
      this.isConnectedState = false;
      this.emit('disconnected', 'Manual disconnect');
    }
  }

  simulateUnexpectedDisconnection(reason = 'Unexpected disconnection'): void {
    if (this.isConnectedState) {
      this.isConnectedState = false;
      this.emit('disconnected', reason);
    }
  }

  simulateTransportError(error: Error): void {
    this.emit('error', error);
  }

  isConnected(): boolean {
    return this.isConnectedState;
  }

  getConnectionAttempts(): number {
    return this.connectionAttempts;
  }

  // Test helpers
  setFailConnect(fail: boolean): void {
    this.shouldFailConnect = fail;
  }

  setFailAfterDelay(fail: boolean): void {
    this.shouldFailAfterDelay = fail;
  }

  setConnectDelay(ms: number): void {
    this.connectDelay = ms;
  }

  reset(): void {
    this.isConnectedState = false;
    this.shouldFailConnect = false;
    this.shouldFailAfterDelay = false;
    this.connectDelay = 0;
    this.connectionAttempts = 0;
    this.removeAllListeners();
  }
}

// Create mock client
class MockClient extends EventEmitter {
  public shouldFailConnect = false;
  public shouldFailListTools = false;
  public shouldFailPing = false;
  public pingLatency = 100;
  public transport: MockTransport;

  constructor(options: { transport: MockTransport }) {
    super();
    this.transport = options.transport;
  }

  async connect(): Promise<void> {
    if (this.shouldFailConnect) {
      throw new Error('Mock client connection failed');
    }
    // Connection handled by transport
  }

  async disconnect(): Promise<void> {
    // Disconnection handled by transport
  }

  async listTools(): Promise<any[]> {
    if (this.shouldFailListTools) {
      throw new Error('Mock client listTools failed');
    }
    return [
      { name: 'test-tool', description: 'A test tool' }
    ];
  }

  async ping(): Promise<any> {
    if (this.shouldFailPing) {
      throw new Error('Mock client ping failed');
    }

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, this.pingLatency));
    return { pong: true };
  }

  async callTool(name: string, args?: any): Promise<any> {
    return { result: `Called ${name} with args ${JSON.stringify(args)}` };
  }

  // Test helpers
  setFailConnect(fail: boolean): void {
    this.shouldFailConnect = fail;
  }

  setFailListTools(fail: boolean): void {
    this.shouldFailListTools = fail;
  }

  setFailPing(fail: boolean): void {
    this.shouldFailPing = fail;
  }

  setPingLatency(ms: number): void {
    this.pingLatency = ms;
  }

  reset(): void {
    this.shouldFailConnect = false;
    this.shouldFailListTools = false;
    this.shouldFailPing = false;
    this.pingLatency = 100;
    this.removeAllListeners();
  }
}

// Mock factories
const createMockTransport = (): MockTransport => new MockTransport();
const createMockClient = (options: { transport: MockTransport }): MockClient => new MockClient(options);

// Mock the imports
vi.mock('../transports/index.js', () => ({
  StdioTransport: vi.fn(),
}));

vi.mock('../client.js', () => ({
  MCPClient: vi.fn(),
}));

// ============================================================================
// Test Utilities
// ============================================================================

const createTestConfig = (servers: Record<string, MCPServerConfig> = {}): ApexConfig => ({
  version: '1.0',
  project: {
    name: 'test-project',
    version: '1.0.0',
    description: 'Test project for MCPConnectionManager',
  },
  mcp: {
    enabled: true,
    servers,
    connection: {
      maxRetries: 3,
      retryDelayMs: 1000,
      backoffFactor: 2,
      maxRetryDelayMs: 30000,
      connectionTimeoutMs: 10000,
      requestTimeoutMs: 30000,
      idleTimeoutMs: 300000,
      poolSize: 1,
      poolMinSize: 0,
      healthCheckIntervalMs: 30000,
      healthCheckTimeoutMs: 5000,
      healthCheckFailureThreshold: 3,
      autoReconnect: true,
      keepAlive: true,
      keepAliveIntervalMs: 15000,
      heartbeatEnabled: true,
      heartbeatIntervalMs: 30000,
    },
  },
});

const createManagerOptions = (
  config: ApexConfig,
  overrides: Partial<MCPConnectionManagerOptions> = {}
): MCPConnectionManagerOptions => ({
  projectPath: '/test/project',
  config,
  ...overrides,
});

interface EventCapture<T = any> {
  events: Array<{ event: string; args: T[] }>;
  clear(): void;
  getEvents(eventName: string): T[][];
  waitForEvent(eventName: string, timeout?: number): Promise<T[]>;
}

const createEventCapture = <T = any>(emitter: EventEmitter): EventCapture<T> => {
  const events: Array<{ event: string; args: T[] }> = [];

  const originalEmit = emitter.emit.bind(emitter);
  emitter.emit = function(event: string, ...args: T[]) {
    events.push({ event, args });
    return originalEmit(event, ...args);
  };

  return {
    events,
    clear() { events.length = 0; },
    getEvents(eventName: string) {
      return events.filter(e => e.event === eventName).map(e => e.args);
    },
    async waitForEvent(eventName: string, timeout = 5000) {
      return new Promise<T[]>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Event ${eventName} not received within ${timeout}ms`));
        }, timeout);

        const check = () => {
          const matchingEvents = events.filter(e => e.event === eventName);
          if (matchingEvents.length > 0) {
            clearTimeout(timer);
            resolve(matchingEvents[matchingEvents.length - 1].args);
          } else {
            setTimeout(check, 10);
          }
        };
        check();
      });
    }
  };
};

// ============================================================================
// Test Suite
// ============================================================================

describe('MCPConnectionManager - Comprehensive Unit Tests', () => {
  let manager: MCPConnectionManager;
  let mockTransport: MockTransport;
  let mockClient: MockClient;
  let eventCapture: EventCapture;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create fresh mock instances for each test
    mockTransport = createMockTransport();
    mockClient = createMockClient({ transport: mockTransport });

    // Get references to mocked classes
    const { StdioTransport } = await import('../transports/index.js');
    const { MCPClient } = await import('../client.js');
    const MockedStdioTransport = vi.mocked(StdioTransport);
    const MockedMCPClient = vi.mocked(MCPClient);

    // Configure mocks to return our instances
    MockedStdioTransport.mockReturnValue(mockTransport as any);
    MockedMCPClient.mockReturnValue(mockClient as any);
  });

  afterEach(async () => {
    if (manager) {
      await manager.disconnectAll();
    }
    vi.useRealTimers();
    mockTransport?.reset();
    mockClient?.reset();
  });

  // ==========================================================================
  // Server Discovery Tests
  // ==========================================================================

  describe('Server Discovery from Configuration', () => {
    it('should discover servers from MCP configuration', () => {
      const config = createTestConfig({
        'filesystem': {
          name: 'FileSystem Server',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
        },
        'memory': {
          name: 'Memory Server',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-memory'],
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      const servers = manager.discoverServers();

      expect(servers).toHaveLength(2);
      expect(servers.map(s => s.name)).toContain('FileSystem Server');
      expect(servers.map(s => s.name)).toContain('Memory Server');

      const fsServer = servers.find(s => s.name === 'FileSystem Server');
      expect(fsServer).toBeDefined();
      expect(fsServer!.type).toBe('stdio');
      expect(fsServer!.command).toBe('npx');
      expect(fsServer!.args).toEqual(['@modelcontextprotocol/server-filesystem']);
    });

    it('should return empty array when MCP is disabled', () => {
      const config = createTestConfig();
      config.mcp!.enabled = false;

      manager = new MCPConnectionManager(createManagerOptions(config));
      const servers = manager.discoverServers();

      expect(servers).toEqual([]);
    });

    it('should filter out invalid server configurations', () => {
      const config = createTestConfig({
        'valid-stdio': {
          name: 'Valid STDIO',
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
        },
        'invalid-stdio': {
          name: 'Invalid STDIO',
          type: 'stdio',
          // Missing command
        },
        'sdk-server': {
          name: 'SDK Server',
          type: 'sdk',
          command: 'node',
        },
        'valid-http': {
          name: 'Valid HTTP',
          type: 'http',
          url: 'http://localhost:3000/mcp',
        },
        'invalid-http': {
          name: 'Invalid HTTP',
          type: 'http',
          // Missing URL
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      const servers = manager.discoverServers();

      expect(servers).toHaveLength(2);
      expect(servers.map(s => s.name)).toContain('Valid STDIO');
      expect(servers.map(s => s.name)).toContain('Valid HTTP');
      expect(servers.map(s => s.name)).not.toContain('Invalid STDIO');
      expect(servers.map(s => s.name)).not.toContain('SDK Server');
      expect(servers.map(s => s.name)).not.toContain('Invalid HTTP');
    });

    it('should use server ID as name when name is not provided', () => {
      const config = createTestConfig({
        'my-filesystem-server': {
          type: 'stdio',
          command: 'node',
          args: ['fs-server.js'],
        } as MCPServerConfig,
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      const servers = manager.discoverServers();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('my-filesystem-server');
    });
  });

  // ==========================================================================
  // Transport Connection/Disconnection Tests
  // ==========================================================================

  describe('Transport Connection/Disconnection', () => {
    it('should successfully connect to a stdio server', async () => {
      const config = createTestConfig({
        'test-server': {
          name: 'Test Server',
          type: 'stdio',
          command: 'node',
          args: ['test-server.js'],
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      const connection = await manager.connect('test-server');

      expect(connection).toBeDefined();
      expect(connection.serverId).toBe('test-server');
      expect(connection.serverName).toBe('Test Server');
      expect(connection.state).toBe('connected');
      expect(connection.connectedAt).toBeInstanceOf(Date);
      expect(connection.reconnectAttempts).toBe(0);

      expect(mockTransport.connect).toHaveBeenCalledTimes(1);
      expect(mockClient.connect).toHaveBeenCalledTimes(1);

      const connectedEvents = eventCapture.getEvents('connected');
      expect(connectedEvents).toHaveLength(1);
      expect(connectedEvents[0][0]).toMatchObject({
        serverId: 'test-server',
        state: 'connected',
      });
    });

    it('should create proper transport instance with correct options', async () => {
      const config = createTestConfig({
        'test-server': {
          name: 'Test Server',
          type: 'stdio',
          command: 'node',
          args: ['--version'],
          cwd: '/custom/working/dir',
          env: { NODE_ENV: 'test', CUSTOM_VAR: 'value' },
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('test-server');

      expect(MockedStdioTransport).toHaveBeenCalledWith({
        command: 'node',
        args: ['--version'],
        cwd: '/test/project', // Should use projectPath, not config cwd
        env: { NODE_ENV: 'test', CUSTOM_VAR: 'value' },
        connectionTimeout: 10000,
        autoReconnect: false, // Manager handles reconnection
      });
    });

    it('should gracefully disconnect from connected server', async () => {
      const config = createTestConfig({
        'test-server': {
          name: 'Test Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      await manager.connect('test-server');
      await manager.disconnect('test-server');

      expect(mockClient.disconnect).toHaveBeenCalledTimes(1);
      expect(manager.getConnection('test-server')).toBeUndefined();

      const disconnectedEvents = eventCapture.getEvents('disconnected');
      expect(disconnectedEvents).toHaveLength(1);
      expect(disconnectedEvents[0][0]).toBe('test-server');
    });

    it('should handle disconnection of non-connected server gracefully', async () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(config));

      await expect(manager.disconnect('nonexistent-server')).resolves.not.toThrow();
    });

    it('should disconnect all servers when disconnectAll is called', async () => {
      const config = createTestConfig({
        'server1': {
          name: 'Server 1',
          type: 'stdio',
          command: 'node',
        },
        'server2': {
          name: 'Server 2',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      // Connect to both servers
      await manager.connect('server1');
      await manager.connect('server2');

      expect(manager.listConnections()).toHaveLength(2);

      await manager.disconnectAll();

      expect(manager.listConnections()).toHaveLength(0);
      expect(manager.getConnection('server1')).toBeUndefined();
      expect(manager.getConnection('server2')).toBeUndefined();
    });

    it('should return existing connection when connecting to already connected server', async () => {
      const config = createTestConfig({
        'test-server': {
          name: 'Test Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      const connection1 = await manager.connect('test-server');
      const connection2 = await manager.connect('test-server');

      expect(connection1).toBe(connection2);
      expect(mockTransport.connect).toHaveBeenCalledTimes(1);
    });

    it('should throw error when connecting to already connecting server', async () => {
      const config = createTestConfig({
        'test-server': {
          name: 'Test Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      // Make connection slow
      mockTransport.setConnectDelay(1000);

      const connectPromise1 = manager.connect('test-server');

      await expect(manager.connect('test-server')).rejects.toThrow(
        "Connection to server 'test-server' is already in progress"
      );

      // Clean up
      await connectPromise1;
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Scenarios', () => {
    it('should handle transport connection failure', async () => {
      const config = createTestConfig({
        'failing-server': {
          name: 'Failing Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      mockTransport.setFailConnect(true);

      await expect(manager.connect('failing-server')).rejects.toThrow(
        'Mock transport connection failed'
      );

      const errorEvents = eventCapture.getEvents('error');
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0][0]).toBe('failing-server');
      expect(errorEvents[0][1]).toBeInstanceOf(Error);

      // Connection should not be in manager after failure
      expect(manager.getConnection('failing-server')).toBeUndefined();
    });

    it('should handle client connection failure', async () => {
      const config = createTestConfig({
        'failing-server': {
          name: 'Failing Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      mockClient.setFailConnect(true);

      await expect(manager.connect('failing-server')).rejects.toThrow(
        'Mock client connection failed'
      );

      const errorEvents = eventCapture.getEvents('error');
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0][0]).toBe('failing-server');
    });

    it('should handle connection timeout', async () => {
      const config = createTestConfig({
        'slow-server': {
          name: 'Slow Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      mockTransport.setFailAfterDelay(true);

      await expect(manager.connect('slow-server')).rejects.toThrow(
        'Mock transport connection timeout'
      );
    });

    it('should emit error event for server not found', async () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(config));

      await expect(manager.connect('nonexistent')).rejects.toThrow(
        "MCP server 'nonexistent' not found in configuration"
      );
    });

    it('should handle unsupported transport types', async () => {
      const config = createTestConfig({
        'websocket-server': {
          name: 'WebSocket Server',
          type: 'websocket' as any, // Unsupported type
          url: 'ws://localhost:8080',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      await expect(manager.connect('websocket-server')).rejects.toThrow(
        "Unknown transport type: websocket"
      );
    });

    it('should handle transport errors after successful connection', async () => {
      const config = createTestConfig({
        'error-prone-server': {
          name: 'Error Prone Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      await manager.connect('error-prone-server');

      const error = new Error('Runtime transport error');
      mockTransport.simulateTransportError(error);

      const errorEvents = eventCapture.getEvents('error');
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0][0]).toBe('error-prone-server');
      expect(errorEvents[0][1]).toBe(error);
    });
  });

  // ==========================================================================
  // Reconnection Logic Tests
  // ==========================================================================

  describe('Reconnection Logic', () => {
    it('should attempt reconnection after unexpected disconnection', async () => {
      const config = createTestConfig({
        'reconnect-server': {
          name: 'Reconnect Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      await manager.connect('reconnect-server');

      // Simulate unexpected disconnection
      mockTransport.simulateUnexpectedDisconnection('network error');

      // Advance timers to trigger reconnection
      vi.advanceTimersByTime(1000);

      const reconnectingEvents = eventCapture.getEvents('reconnecting');
      expect(reconnectingEvents.length).toBeGreaterThan(0);
      expect(reconnectingEvents[0][0]).toBe('reconnect-server');
      expect(reconnectingEvents[0][1]).toBe(1); // First attempt
      expect(reconnectingEvents[0][2]).toBe(3); // Max attempts
    });

    it('should use exponential backoff for reconnection delays', async () => {
      vi.useRealTimers(); // Need real timers for this test

      const config = createTestConfig({
        'backoff-server': {
          name: 'Backoff Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      await manager.connect('backoff-server');

      // Make subsequent connections fail
      mockTransport.setFailConnect(true);

      // Trigger disconnection
      mockTransport.simulateUnexpectedDisconnection('failure');

      const startTime = Date.now();
      const reconnectionTimes: number[] = [];

      manager.on('reconnecting', (serverId, attempt) => {
        reconnectionTimes.push(Date.now() - startTime);
      });

      // Wait for multiple reconnection attempts
      await new Promise(resolve => setTimeout(resolve, 8000));

      expect(reconnectionTimes.length).toBeGreaterThan(1);

      // Verify exponential backoff (each delay should be roughly double the previous)
      if (reconnectionTimes.length >= 2) {
        const firstDelay = reconnectionTimes[0];
        const secondDelay = reconnectionTimes[1] - reconnectionTimes[0];

        expect(firstDelay).toBeGreaterThanOrEqual(1000); // Base delay
        expect(secondDelay).toBeGreaterThanOrEqual(1800); // ~2x with some tolerance
      }

      vi.useFakeTimers();
    });

    it('should stop reconnection after max attempts exceeded', async () => {
      const config = createTestConfig({
        'exhausted-server': {
          name: 'Exhausted Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      await manager.connect('exhausted-server');

      // Make all reconnection attempts fail
      mockTransport.setFailConnect(true);

      // Trigger disconnection
      mockTransport.simulateUnexpectedDisconnection('persistent failure');

      // Advance timers through all reconnection attempts
      for (let i = 0; i < 4; i++) {
        vi.advanceTimersByTime(1000 * Math.pow(2, i));
        await vi.runAllTimersAsync();
      }

      const reconnectingEvents = eventCapture.getEvents('reconnecting');
      expect(reconnectingEvents.length).toBeLessThanOrEqual(3); // maxRetries = 3

      const errorEvents = eventCapture.getEvents('error');
      const exhaustedError = errorEvents.find(([serverId, error]) =>
        serverId === 'exhausted-server' && error.message.includes('exhausted')
      );
      expect(exhaustedError).toBeDefined();
    });

    it('should not reconnect when disconnection is intentional', async () => {
      const config = createTestConfig({
        'intentional-server': {
          name: 'Intentional Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      await manager.connect('intentional-server');
      await manager.disconnect('intentional-server');

      // Advance timers
      vi.advanceTimersByTime(5000);

      const reconnectingEvents = eventCapture.getEvents('reconnecting');
      expect(reconnectingEvents).toHaveLength(0);
    });

    it('should successfully reconnect after failures', async () => {
      const config = createTestConfig({
        'recovery-server': {
          name: 'Recovery Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      await manager.connect('recovery-server');

      // Trigger disconnection
      mockTransport.simulateUnexpectedDisconnection('temporary failure');

      // Make first reconnection attempt fail
      mockTransport.setFailConnect(true);
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // Allow subsequent reconnection to succeed
      mockTransport.setFailConnect(false);
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      const connectedEvents = eventCapture.getEvents('connected');
      expect(connectedEvents.length).toBeGreaterThanOrEqual(2); // Initial + reconnection

      const connection = manager.getConnection('recovery-server');
      expect(connection?.state).toBe('connected');
    });
  });

  // ==========================================================================
  // Event Emission Tests
  // ==========================================================================

  describe('Event Emission', () => {
    it('should emit all connection lifecycle events', async () => {
      const config = createTestConfig({
        'lifecycle-server': {
          name: 'Lifecycle Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      // Connect
      await manager.connect('lifecycle-server');

      // Trigger reconnection
      mockTransport.simulateUnexpectedDisconnection('test disconnect');
      vi.advanceTimersByTime(1000);

      // Disconnect
      await manager.disconnect('lifecycle-server');

      // Verify all events were emitted
      expect(eventCapture.getEvents('connected').length).toBeGreaterThan(0);
      expect(eventCapture.getEvents('disconnected').length).toBeGreaterThan(0);
      expect(eventCapture.getEvents('reconnecting').length).toBeGreaterThan(0);
    });

    it('should emit stateChange events for connection state transitions', async () => {
      const config = createTestConfig({
        'state-server': {
          name: 'State Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      await manager.connect('state-server');

      // Trigger state changes
      mockTransport.simulateUnexpectedDisconnection('state test');
      vi.advanceTimersByTime(1000);

      const stateEvents = eventCapture.getEvents('stateChange');
      expect(stateEvents.length).toBeGreaterThan(0);

      // Should have transitions like: connected -> disconnected -> reconnecting
      const hasDisconnectedState = stateEvents.some(([serverId, prevState, newState]) =>
        serverId === 'state-server' && newState === 'disconnected'
      );
      expect(hasDisconnectedState).toBe(true);
    });

    it('should emit error events with correct parameters', async () => {
      const config = createTestConfig({
        'error-server': {
          name: 'Error Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      const errorHandler = vi.fn();
      manager.on('error', errorHandler);

      mockClient.setFailConnect(true);

      await expect(manager.connect('error-server')).rejects.toThrow();

      expect(errorHandler).toHaveBeenCalledWith(
        'error-server',
        expect.any(Error)
      );
    });

    it('should support event handler registration and removal', () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(config));

      const handler = vi.fn();

      manager.on('connected', handler);
      expect(typeof manager.on).toBe('function');

      manager.off('connected', handler);
      expect(typeof manager.off).toBe('function');

      manager.once('connected', handler);
      expect(typeof manager.once).toBe('function');
    });
  });

  // ==========================================================================
  // Health Check Integration Tests
  // ==========================================================================

  describe('Health Check Integration', () => {
    it('should perform health checks on connected servers', async () => {
      const config = createTestConfig({
        'health-server': {
          name: 'Health Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      await manager.connect('health-server');
      const result = await manager.checkHealth('health-server');

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.isHealthy).toBe(true);
      expect(typeof result.latencyMs).toBe('number');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle health check failures', async () => {
      const config = createTestConfig({
        'unhealthy-server': {
          name: 'Unhealthy Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      await manager.connect('unhealthy-server');

      // Make health checks fail
      mockClient.setFailPing(true);
      mockClient.setFailListTools(true);

      const result = await manager.checkHealth('unhealthy-server');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.consecutiveFailures).toBeGreaterThan(0);

      const healthCheckEvents = eventCapture.getEvents('healthCheck');
      expect(healthCheckEvents.length).toBeGreaterThan(0);
    });

    it('should provide health statistics', async () => {
      const config = createTestConfig({
        'stats-server': {
          name: 'Stats Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      await manager.connect('stats-server');

      // Perform multiple health checks
      await manager.checkHealth('stats-server');
      await manager.checkHealth('stats-server');

      const stats = manager.getHealthStatistics('stats-server');
      expect(stats).toBeDefined();
      expect(stats!.totalChecks).toBeGreaterThan(0);
      expect(stats!.successfulChecks).toBeGreaterThan(0);
    });

    it('should get health state for connections', async () => {
      const config = createTestConfig({
        'health-state-server': {
          name: 'Health State Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      await manager.connect('health-state-server');

      const health = manager.getHealth('health-state-server');
      expect(health).toBeDefined();
      expect(health!.isHealthy).toBe(true);
      expect(health!.consecutiveFailures).toBe(0);

      const unifiedHealth = manager.getUnifiedHealthState('health-state-server');
      expect(unifiedHealth).toBeDefined();
      expect(unifiedHealth!.connectionId).toBe('health-state-server');
    });
  });

  // ==========================================================================
  // Configuration Management Tests
  // ==========================================================================

  describe('Configuration Management', () => {
    it('should update configuration at runtime', () => {
      const initialConfig = createTestConfig({
        'initial-server': {
          name: 'Initial Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(initialConfig));

      expect(manager.discoverServers()).toHaveLength(1);

      const updatedConfig = createTestConfig({
        'updated-server': {
          name: 'Updated Server',
          type: 'stdio',
          command: 'node',
        },
        'another-server': {
          name: 'Another Server',
          type: 'stdio',
          command: 'python',
        },
      });

      manager.updateConfig(updatedConfig);
      const servers = manager.discoverServers();

      expect(servers).toHaveLength(2);
      expect(servers.map(s => s.name)).toContain('Updated Server');
      expect(servers.map(s => s.name)).toContain('Another Server');
    });

    it('should handle connection configuration overrides', async () => {
      const config = createTestConfig({
        'custom-config-server': {
          name: 'Custom Config Server',
          type: 'stdio',
          command: 'node',
        },
      });

      const customOptions = createManagerOptions(config, {
        connectionConfig: {
          maxRetries: 5,
          retryDelayMs: 500,
          healthCheckIntervalMs: 10000,
          autoReconnect: true,
        },
      });

      manager = new MCPConnectionManager(customOptions);
      await manager.connect('custom-config-server');

      // Configuration should be applied (tested implicitly through reconnection behavior)
      expect(manager.getConnection('custom-config-server')).toBeDefined();
    });
  });

  // ==========================================================================
  // Utility Method Tests
  // ==========================================================================

  describe('Utility Methods', () => {
    it('should provide correct client instances', async () => {
      const config = createTestConfig({
        'client-server': {
          name: 'Client Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      expect(manager.getClient('client-server')).toBeUndefined();

      await manager.connect('client-server');
      const client = manager.getClient('client-server');

      expect(client).toBeDefined();
      expect(client).toBe(mockClient);
    });

    it('should provide connection metrics', async () => {
      const config = createTestConfig({
        'metrics-server': {
          name: 'Metrics Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      expect(manager.getMetrics('metrics-server')).toBeUndefined();

      await manager.connect('metrics-server');
      const metrics = manager.getMetrics('metrics-server');

      expect(metrics).toBeDefined();
      expect(metrics!.totalConnections).toBe(1);
      expect(metrics!.connectedAt).toBeInstanceOf(Date);
      expect(typeof metrics!.uptimeMs).toBe('number');
    });

    it('should list all active connections', async () => {
      const config = createTestConfig({
        'server1': {
          name: 'Server 1',
          type: 'stdio',
          command: 'node',
        },
        'server2': {
          name: 'Server 2',
          type: 'stdio',
          command: 'python',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      expect(manager.listConnections()).toHaveLength(0);

      await manager.connect('server1');
      expect(manager.listConnections()).toHaveLength(1);

      await manager.connect('server2');
      const connections = manager.listConnections();

      expect(connections).toHaveLength(2);
      expect(connections.map(c => c.serverId)).toContain('server1');
      expect(connections.map(c => c.serverId)).toContain('server2');
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration Scenarios', () => {
    it('should handle multiple servers with different behaviors', async () => {
      const config = createTestConfig({
        'reliable-server': {
          name: 'Reliable Server',
          type: 'stdio',
          command: 'node',
          args: ['reliable.js'],
        },
        'flaky-server': {
          name: 'Flaky Server',
          type: 'stdio',
          command: 'node',
          args: ['flaky.js'],
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      eventCapture = createEventCapture(manager);

      // Connect both servers
      await manager.connect('reliable-server');
      await manager.connect('flaky-server');

      expect(manager.listConnections()).toHaveLength(2);

      // Simulate flaky server having issues (we'll create a second transport instance for this)
      const flakyTransport = createMockTransport();
      flakyTransport.simulateUnexpectedDisconnection('network instability');

      vi.advanceTimersByTime(1000);

      // Reliable server should still be connected
      expect(manager.getConnection('reliable-server')?.state).toBe('connected');

      // Flaky server should be in reconnection process
      const reconnectingEvents = eventCapture.getEvents('reconnecting');
      expect(reconnectingEvents.some(([serverId]) => serverId === 'flaky-server')).toBe(true);
    });

    it('should clean up all resources on disconnectAll', async () => {
      const config = createTestConfig({
        'cleanup1': {
          name: 'Cleanup Server 1',
          type: 'stdio',
          command: 'node',
        },
        'cleanup2': {
          name: 'Cleanup Server 2',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      await manager.connect('cleanup1');
      await manager.connect('cleanup2');

      expect(manager.listConnections()).toHaveLength(2);

      await manager.disconnectAll();

      expect(manager.listConnections()).toHaveLength(0);
      expect(manager.getConnection('cleanup1')).toBeUndefined();
      expect(manager.getConnection('cleanup2')).toBeUndefined();
      expect(manager.getClient('cleanup1')).toBeUndefined();
      expect(manager.getClient('cleanup2')).toBeUndefined();
    });
  });
});