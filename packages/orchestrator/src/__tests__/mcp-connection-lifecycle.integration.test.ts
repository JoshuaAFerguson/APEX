/**
 * MCP Connection Lifecycle Integration Tests
 *
 * Comprehensive end-to-end tests verifying MCP connection lifecycle
 * through the ApexOrchestrator, including:
 * - Initial connection establishment
 * - Graceful disconnection
 * - Connection error handling
 * - Reconnection scenarios
 * - Event verification through orchestrator
 *
 * These tests verify the complete integration between ApexOrchestrator
 * and MCPConnectionManager, ensuring events are properly forwarded
 * and data is correctly formatted.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { ApexOrchestrator } from '../index.js';
import { TaskStore } from '../store.js';
import type { MCPConnection, MCPConnectionState } from '@apexcli/core';
import fs from 'fs/promises';

// Mock dependencies
vi.mock('../store.js');
vi.mock('fs/promises');
vi.mock('js-yaml', () => ({
  parse: vi.fn().mockImplementation((content) => {
    // Simple YAML parsing mock for our test content
    if (content.includes('test-project')) {
      return {
        project: {
          name: 'test-project',
          description: 'Test project for MCP lifecycle integration',
          version: '1.0.0',
        },
        mcp: {
          enabled: true,
          connection: {
            maxRetries: 3,
            retryDelayMs: 1000,
            backoffFactor: 2,
            maxRetryDelayMs: 30000,
            connectionTimeoutMs: 10000,
            requestTimeoutMs: 30000,
            healthCheckIntervalMs: 5000,
            autoReconnect: true,
          },
          servers: {
            'test-server-1': {
              name: 'Test MCP Server 1',
              type: 'stdio',
              command: 'node',
              args: ['test-server-1.js'],
            },
            'test-server-2': {
              name: 'Test MCP Server 2',
              type: 'stdio',
              command: 'node',
              args: ['test-server-2.js'],
            },
          },
        },
        agents: {},
        workflows: {},
      };
    }
    return {};
  }),
}));

const MockTaskStore = vi.mocked(TaskStore);
const mockFS = vi.mocked(fs);

// ============================================================================
// Mock Infrastructure
// ============================================================================

/**
 * Realistic mock MCPConnectionManager that simulates connection behavior
 */
class RealisticMCPConnectionManager extends EventEmitter {
  private connections = new Map<string, MCPConnection>();
  private timers = new Set<NodeJS.Timeout>();

  constructor(public options: { projectPath: string; config: any }) {
    super();
  }

  discoverServers() {
    if (!this.options.config.mcp?.enabled) {
      return [];
    }

    const servers = this.options.config.mcp?.servers ?? {};
    return Object.entries(servers).map(([id, config]) => ({
      ...config,
      name: config.name ?? id,
    }));
  }

  async connect(serverId: string): Promise<MCPConnection> {
    const servers = this.options.config.mcp?.servers ?? {};
    const serverConfig = servers[serverId];

    if (!serverConfig) {
      throw new Error(`MCP server '${serverId}' not found in configuration`);
    }

    const connection: MCPConnection = {
      serverId,
      serverName: serverConfig.name ?? serverId,
      config: serverConfig,
      state: 'connecting',
      reconnectAttempts: 0,
    };

    this.connections.set(serverId, connection);

    // Emit state change to connecting
    this.emit('stateChange', serverId, 'disconnected' as MCPConnectionState, 'connecting' as MCPConnectionState);

    // Simulate connection process
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const now = new Date();
        connection.state = 'connected';
        connection.connectedAt = now;
        connection.lastActivityAt = now;

        // Emit state change to connected
        this.emit('stateChange', serverId, 'connecting' as MCPConnectionState, 'connected' as MCPConnectionState);

        // Emit connected event
        this.emit('connected', connection);

        // Start health monitoring
        this.startHealthMonitoring(serverId);

        resolve(connection);
      }, 50); // Small delay to simulate realistic timing

      this.timers.add(timer);
    });
  }

  async disconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return; // Already disconnected
    }

    const previousState = connection.state;
    connection.state = 'disconnected';

    this.emit('stateChange', serverId, previousState, 'disconnected');
    this.emit('disconnected', serverId, `Disconnected from state: ${previousState}`);

    this.connections.delete(serverId);
    this.clearHealthMonitoring(serverId);
  }

  async disconnectAll(): Promise<void> {
    const serverIds = Array.from(this.connections.keys());
    await Promise.all(serverIds.map(id => this.disconnect(id)));
    this.clearAllTimers();
  }

  listConnections(): MCPConnection[] {
    return Array.from(this.connections.values());
  }

  getConnection(serverId: string): MCPConnection | undefined {
    return this.connections.get(serverId);
  }

  getClient(serverId: string) {
    return this.connections.has(serverId) ? {} : undefined;
  }

  updateConfig(config: any): void {
    this.options.config = config;
  }

  // ========================================================================
  // Simulation Methods for Testing
  // ========================================================================

  /**
   * Simulate connection failure during connect
   */
  simulateConnectionFailure(serverId: string, errorMessage: string = 'Connection failed'): void {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    const error = new Error(errorMessage);
    connection.state = 'error';
    connection.lastError = errorMessage;

    this.emit('stateChange', serverId, 'connecting', 'error');
    this.emit('error', serverId, error);
  }

  /**
   * Simulate transport error on active connection
   */
  simulateTransportError(serverId: string, errorMessage: string = 'Transport error'): void {
    const connection = this.connections.get(serverId);
    if (!connection || connection.state !== 'connected') return;

    const error = new Error(errorMessage);
    connection.lastError = errorMessage;

    this.emit('error', serverId, error);
  }

  /**
   * Simulate reconnection scenario
   */
  simulateReconnectionScenario(serverId: string, attempts: number, finalSuccess: boolean = true): void {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    // Start reconnection process
    connection.state = 'disconnected';
    this.emit('stateChange', serverId, 'connected', 'disconnected');
    this.emit('disconnected', serverId, 'Connection lost');

    let attempt = 0;

    const attemptReconnect = () => {
      attempt++;
      connection.reconnectAttempts = attempt;

      this.emit('reconnecting', serverId, attempt, attempts);

      if (attempt < attempts || finalSuccess) {
        const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
        const timer = setTimeout(() => {
          if (attempt === attempts && finalSuccess) {
            // Final successful reconnection
            connection.state = 'connected';
            connection.connectedAt = new Date();
            connection.lastActivityAt = new Date();
            connection.reconnectAttempts = 0;

            this.emit('stateChange', serverId, 'reconnecting', 'connected');
            this.emit('connected', connection);
            this.startHealthMonitoring(serverId);
          } else if (attempt < attempts) {
            // Failed attempt, try again
            this.emit('error', serverId, new Error(`Reconnection attempt ${attempt} failed`));
            attemptReconnect();
          } else {
            // All attempts exhausted
            connection.state = 'error';
            this.emit('stateChange', serverId, 'reconnecting', 'error');
            this.emit('error', serverId, new Error(`Reconnection exhausted after ${attempts} attempts`));
          }
        }, delay);

        this.timers.add(timer);
      }
    };

    attemptReconnect();
  }

  /**
   * Simulate graceful disconnection with reason
   */
  simulateGracefulDisconnection(serverId: string, reason: string = 'User requested'): void {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    const previousState = connection.state;
    connection.state = 'disconnected';

    this.emit('stateChange', serverId, previousState, 'disconnected');
    this.emit('disconnected', serverId, reason);

    this.connections.delete(serverId);
    this.clearHealthMonitoring(serverId);
  }

  /**
   * Simulate health check failure
   */
  simulateHealthCheckFailure(serverId: string): void {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    const healthResult = {
      success: false,
      error: new Error('Health check failed'),
      consecutiveFailures: 3,
      isHealthy: false,
      timestamp: new Date(),
    };

    this.emit('healthCheck', serverId, healthResult);

    // Trigger disconnection after health check failure
    setTimeout(() => {
      if (this.connections.has(serverId)) {
        this.simulateReconnectionScenario(serverId, 3, true);
      }
    }, 100);
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  private startHealthMonitoring(serverId: string): void {
    const timer = setInterval(() => {
      if (this.connections.has(serverId)) {
        const healthResult = {
          success: true,
          latencyMs: Math.random() * 100 + 50, // 50-150ms
          consecutiveFailures: 0,
          isHealthy: true,
          timestamp: new Date(),
        };
        this.emit('healthCheck', serverId, healthResult);
      }
    }, 5000); // Health check every 5 seconds in tests

    this.timers.add(timer);
  }

  private clearHealthMonitoring(serverId: string): void {
    // In a real implementation, we would track per-server timers
    // For testing, we clear all timers on disconnect
  }

  private clearAllTimers(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
}

// Mock MCPConnectionManager
vi.mock('../mcp/connection-manager.js', () => ({
  MCPConnectionManager: RealisticMCPConnectionManager,
}));

// ============================================================================
// Test Suite
// ============================================================================

describe('MCP Connection Lifecycle - Integration Tests', () => {
  let testProjectPath: string;
  let orchestrator: ApexOrchestrator;
  let connectionManager: RealisticMCPConnectionManager;

  // Event capture arrays
  let capturedEvents: Array<{ type: string; data: any; timestamp: Date }> = [];

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedEvents = [];

    testProjectPath = '/tmp/test-apex-project';

    // Mock file system operations
    mockFS.access.mockResolvedValue(undefined);
    mockFS.mkdir.mockResolvedValue(undefined);
    mockFS.writeFile.mockResolvedValue(undefined);

    // Mock config file reading to return our test config
    mockFS.readFile.mockImplementation(async (path: any) => {
      if (path.includes('config.yaml')) {
        // Return YAML string of our test config
        const yamlContent = `
project:
  name: test-project
  description: Test project for MCP lifecycle integration
  version: 1.0.0

mcp:
  enabled: true
  connection:
    maxRetries: 3
    retryDelayMs: 1000
    backoffFactor: 2
    maxRetryDelayMs: 30000
    connectionTimeoutMs: 10000
    requestTimeoutMs: 30000
    healthCheckIntervalMs: 5000
    autoReconnect: true
  servers:
    test-server-1:
      name: Test MCP Server 1
      type: stdio
      command: node
      args:
        - test-server-1.js
    test-server-2:
      name: Test MCP Server 2
      type: stdio
      command: node
      args:
        - test-server-2.js

agents: {}
workflows: {}
`;
        return yamlContent;
      } else if (path.includes('hooks.yaml')) {
        // Return empty hooks config or throw ENOENT
        const error = new Error('ENOENT') as any;
        error.code = 'ENOENT';
        throw error;
      }
      return '{}';
    });

    // Mock TaskStore
    const mockStore = {
      getTasks: vi.fn().mockResolvedValue([]),
      getTaskById: vi.fn().mockResolvedValue(null),
      createTask: vi.fn().mockResolvedValue('task-1'),
      updateTask: vi.fn().mockResolvedValue(undefined),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    MockTaskStore.mockImplementation(() => mockStore as any);

    // Create orchestrator
    orchestrator = new ApexOrchestrator({
      projectPath: testProjectPath,
      apiUrl: 'http://localhost:3000',
    });

    // Initialize orchestrator to trigger MCPConnectionManager creation
    await orchestrator.initialize();

    // Get the mocked connection manager instance
    const { MCPConnectionManager } = await import('../mcp/connection-manager.js');
    const lastCall = vi.mocked(MCPConnectionManager).mock.instances.slice(-1)[0];
    connectionManager = lastCall as any;

    // Set up event capture for orchestrator events
    setupEventCapture();
  });

  afterEach(async () => {
    if (orchestrator && connectionManager) {
      try {
        await connectionManager.disconnectAll();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
    vi.clearAllTimers();
  });

  function setupEventCapture(): void {
    const eventTypes = [
      'mcp:connected',
      'mcp:disconnected',
      'mcp:error',
      'mcp:reconnecting',
      'mcp:healthCheck',
      'mcp:stateChange',
      'mcp:poolChange',
    ];

    eventTypes.forEach(eventType => {
      orchestrator.on(eventType, (data) => {
        capturedEvents.push({
          type: eventType,
          data: { ...data },
          timestamp: new Date(),
        });
      });
    });
  }

  function getEventsByType(eventType: string) {
    return capturedEvents.filter(e => e.type === eventType);
  }

  function getEventsForServer(serverId: string) {
    return capturedEvents.filter(e => e.data?.serverId === serverId);
  }

  // ==========================================================================
  // Initial Connection Establishment Tests
  // ==========================================================================

  describe('Initial Connection Establishment', () => {
    it('should successfully establish connection to a single server and emit proper events', async () => {
      const serverId = 'test-server-1';

      // Connect to server
      const connection = await connectionManager.connect(serverId);

      // Wait for events to be emitted
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify connection object
      expect(connection).toBeDefined();
      expect(connection.serverId).toBe(serverId);
      expect(connection.serverName).toBe('Test MCP Server 1');
      expect(connection.state).toBe('connected');
      expect(connection.connectedAt).toBeInstanceOf(Date);

      // Verify events were emitted through orchestrator
      const stateChangeEvents = getEventsByType('mcp:stateChange');
      const connectedEvents = getEventsByType('mcp:connected');
      const healthCheckEvents = getEventsByType('mcp:healthCheck');

      // Should have state changes: disconnected -> connecting -> connected
      expect(stateChangeEvents).toHaveLength(2);
      expect(stateChangeEvents[0].data.previousState).toBe('disconnected');
      expect(stateChangeEvents[0].data.newState).toBe('connecting');
      expect(stateChangeEvents[1].data.previousState).toBe('connecting');
      expect(stateChangeEvents[1].data.newState).toBe('connected');

      // Should have connected event
      expect(connectedEvents).toHaveLength(1);
      expect(connectedEvents[0].data.serverId).toBe(serverId);
      expect(connectedEvents[0].data.serverName).toBe('Test MCP Server 1');

      // Should start receiving health check events
      await new Promise(resolve => setTimeout(resolve, 6000)); // Wait for health check
      const healthEvents = getEventsByType('mcp:healthCheck');
      expect(healthEvents.length).toBeGreaterThan(0);
      expect(healthEvents[0].data.serverId).toBe(serverId);
      expect(healthEvents[0].data.result.success).toBe(true);
    });

    it('should handle connection to multiple servers independently', async () => {
      const server1Id = 'test-server-1';
      const server2Id = 'test-server-2';

      // Connect to both servers
      const [connection1, connection2] = await Promise.all([
        connectionManager.connect(server1Id),
        connectionManager.connect(server2Id),
      ]);

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify both connections
      expect(connection1.serverId).toBe(server1Id);
      expect(connection2.serverId).toBe(server2Id);
      expect(connection1.state).toBe('connected');
      expect(connection2.state).toBe('connected');

      // Verify events for both servers
      const server1Events = getEventsForServer(server1Id);
      const server2Events = getEventsForServer(server2Id);

      expect(server1Events.length).toBeGreaterThan(0);
      expect(server2Events.length).toBeGreaterThan(0);

      // Each server should have its own connected event
      const connectedEvents = getEventsByType('mcp:connected');
      expect(connectedEvents).toHaveLength(2);

      const server1Connected = connectedEvents.find(e => e.data.serverId === server1Id);
      const server2Connected = connectedEvents.find(e => e.data.serverId === server2Id);

      expect(server1Connected).toBeDefined();
      expect(server2Connected).toBeDefined();
    });

    it('should handle connection timeout and emit error events', async () => {
      const serverId = 'test-server-1';

      // Start connection and immediately simulate failure
      const connectionPromise = connectionManager.connect(serverId);

      // Simulate connection failure
      setTimeout(() => {
        connectionManager.simulateConnectionFailure(serverId, 'Connection timeout');
      }, 25);

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify error events were emitted
      const errorEvents = getEventsByType('mcp:error');
      const stateChangeEvents = getEventsByType('mcp:stateChange');

      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].data.serverId).toBe(serverId);
      expect(errorEvents[0].data.error).toBeInstanceOf(Error);
      expect(errorEvents[0].data.message).toContain('Connection timeout');

      // Should have state change to error
      const errorStateChange = stateChangeEvents.find(e =>
        e.data.newState === 'error' && e.data.serverId === serverId
      );
      expect(errorStateChange).toBeDefined();
    });
  });

  // ==========================================================================
  // Graceful Disconnection Tests
  // ==========================================================================

  describe('Graceful Disconnection', () => {
    beforeEach(async () => {
      // Establish connection before each disconnection test
      await connectionManager.connect('test-server-1');
      await new Promise(resolve => setTimeout(resolve, 100));
      capturedEvents = []; // Clear events from setup
    });

    it('should handle explicit disconnection with proper events', async () => {
      const serverId = 'test-server-1';

      // Disconnect the server
      await connectionManager.disconnect(serverId);

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify disconnection events
      const disconnectedEvents = getEventsByType('mcp:disconnected');
      const stateChangeEvents = getEventsByType('mcp:stateChange');

      expect(disconnectedEvents).toHaveLength(1);
      expect(disconnectedEvents[0].data.serverId).toBe(serverId);
      expect(disconnectedEvents[0].data.reason).toContain('Disconnected from state');

      // Should have state change to disconnected
      expect(stateChangeEvents).toHaveLength(1);
      expect(stateChangeEvents[0].data.newState).toBe('disconnected');
      expect(stateChangeEvents[0].data.serverId).toBe(serverId);

      // Verify connection is removed
      expect(connectionManager.getConnection(serverId)).toBeUndefined();
    });

    it('should disconnect all servers when calling disconnectAll', async () => {
      // Connect second server
      await connectionManager.connect('test-server-2');
      await new Promise(resolve => setTimeout(resolve, 100));
      capturedEvents = []; // Clear setup events

      // Disconnect all
      await connectionManager.disconnectAll();

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify both servers were disconnected
      const disconnectedEvents = getEventsByType('mcp:disconnected');
      expect(disconnectedEvents).toHaveLength(2);

      const server1Disconnected = disconnectedEvents.find(e => e.data.serverId === 'test-server-1');
      const server2Disconnected = disconnectedEvents.find(e => e.data.serverId === 'test-server-2');

      expect(server1Disconnected).toBeDefined();
      expect(server2Disconnected).toBeDefined();

      // Verify all connections are removed
      expect(connectionManager.listConnections()).toHaveLength(0);
    });

    it('should handle graceful disconnection with custom reason', async () => {
      const serverId = 'test-server-1';
      const customReason = 'User requested shutdown';

      // Simulate graceful disconnection
      connectionManager.simulateGracefulDisconnection(serverId, customReason);

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify disconnection with custom reason
      const disconnectedEvents = getEventsByType('mcp:disconnected');
      expect(disconnectedEvents).toHaveLength(1);
      expect(disconnectedEvents[0].data.reason).toBe(customReason);
      expect(disconnectedEvents[0].data.serverId).toBe(serverId);
    });
  });

  // ==========================================================================
  // Connection Error Handling Tests
  // ==========================================================================

  describe('Connection Error Handling', () => {
    beforeEach(async () => {
      // Establish connection before each error test
      await connectionManager.connect('test-server-1');
      await new Promise(resolve => setTimeout(resolve, 100));
      capturedEvents = []; // Clear events from setup
    });

    it('should handle transport errors and emit error events', async () => {
      const serverId = 'test-server-1';
      const errorMessage = 'Transport connection lost';

      // Simulate transport error
      connectionManager.simulateTransportError(serverId, errorMessage);

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify error event
      const errorEvents = getEventsByType('mcp:error');
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].data.serverId).toBe(serverId);
      expect(errorEvents[0].data.error).toBeInstanceOf(Error);
      expect(errorEvents[0].data.message).toContain(errorMessage);
      expect(errorEvents[0].data.timestamp).toBeInstanceOf(Date);
    });

    it('should handle multiple cascading errors independently', async () => {
      const serverId = 'test-server-1';

      // Connect second server
      await connectionManager.connect('test-server-2');
      await new Promise(resolve => setTimeout(resolve, 100));
      capturedEvents = []; // Clear setup events

      // Simulate errors on both servers
      connectionManager.simulateTransportError('test-server-1', 'Error 1');
      connectionManager.simulateTransportError('test-server-2', 'Error 2');

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify both errors were emitted
      const errorEvents = getEventsByType('mcp:error');
      expect(errorEvents).toHaveLength(2);

      const server1Error = errorEvents.find(e => e.data.serverId === 'test-server-1');
      const server2Error = errorEvents.find(e => e.data.serverId === 'test-server-2');

      expect(server1Error).toBeDefined();
      expect(server2Error).toBeDefined();
      expect(server1Error!.data.message).toContain('Error 1');
      expect(server2Error!.data.message).toContain('Error 2');
    });

    it('should handle connection refusal during initial connect', async () => {
      const serverId = 'test-server-2'; // Use different server

      try {
        // Start connection
        const connectionPromise = connectionManager.connect(serverId);

        // Immediately simulate connection failure
        setTimeout(() => {
          connectionManager.simulateConnectionFailure(serverId, 'Connection refused');
        }, 25);

        // Wait for the failure to propagate
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        // Connection may throw or just emit events
      }

      // Verify error event was emitted
      const errorEvents = getEventsByType('mcp:error');
      expect(errorEvents.length).toBeGreaterThan(0);

      const connectionRefusedError = errorEvents.find(e =>
        e.data.serverId === serverId && e.data.message.includes('Connection refused')
      );
      expect(connectionRefusedError).toBeDefined();
    });
  });

  // ==========================================================================
  // Reconnection Scenarios Tests
  // ==========================================================================

  describe('Reconnection Scenarios', () => {
    beforeEach(async () => {
      // Establish connection before each reconnection test
      await connectionManager.connect('test-server-1');
      await new Promise(resolve => setTimeout(resolve, 100));
      capturedEvents = []; // Clear events from setup
    });

    it('should handle successful reconnection with proper event sequence', async () => {
      const serverId = 'test-server-1';

      // Simulate reconnection scenario (3 attempts, success on final)
      connectionManager.simulateReconnectionScenario(serverId, 3, true);

      // Wait for reconnection to complete
      await new Promise(resolve => setTimeout(resolve, 8000)); // Account for exponential backoff

      // Verify event sequence
      const reconnectingEvents = getEventsByType('mcp:reconnecting');
      const stateChangeEvents = getEventsByType('mcp:stateChange');
      const connectedEvents = getEventsByType('mcp:connected');
      const disconnectedEvents = getEventsByType('mcp:disconnected');

      // Should have initial disconnection
      expect(disconnectedEvents).toHaveLength(1);
      expect(disconnectedEvents[0].data.serverId).toBe(serverId);

      // Should have reconnection attempts
      expect(reconnectingEvents.length).toBeGreaterThan(0);
      expect(reconnectingEvents[0].data.serverId).toBe(serverId);
      expect(reconnectingEvents[0].data.attempt).toBe(1);

      // Should eventually reconnect
      expect(connectedEvents).toHaveLength(1);
      expect(connectedEvents[0].data.serverId).toBe(serverId);

      // Should have final state change to connected
      const finalStateChange = stateChangeEvents.find(e =>
        e.data.newState === 'connected' && e.data.previousState === 'reconnecting'
      );
      expect(finalStateChange).toBeDefined();
    });

    it('should handle exhausted reconnection attempts', async () => {
      const serverId = 'test-server-1';

      // Simulate failed reconnection scenario (3 attempts, all fail)
      connectionManager.simulateReconnectionScenario(serverId, 3, false);

      // Wait for all attempts to complete
      await new Promise(resolve => setTimeout(resolve, 8000)); // Account for exponential backoff

      // Verify event sequence
      const reconnectingEvents = getEventsByType('mcp:reconnecting');
      const errorEvents = getEventsByType('mcp:error');
      const stateChangeEvents = getEventsByType('mcp:stateChange');

      // Should have multiple reconnection attempts
      expect(reconnectingEvents).toHaveLength(3);
      expect(reconnectingEvents[2].data.attempt).toBe(3);

      // Should have errors for failed attempts
      expect(errorEvents.length).toBeGreaterThan(0);

      const exhaustionError = errorEvents.find(e =>
        e.data.message.includes('exhausted')
      );
      expect(exhaustionError).toBeDefined();

      // Should have final state change to error
      const errorStateChange = stateChangeEvents.find(e =>
        e.data.newState === 'error'
      );
      expect(errorStateChange).toBeDefined();
    });

    it('should handle health check failure triggering reconnection', async () => {
      const serverId = 'test-server-1';

      // Simulate health check failure
      connectionManager.simulateHealthCheckFailure(serverId);

      // Wait for reconnection to be triggered
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify event sequence
      const healthCheckEvents = getEventsByType('mcp:healthCheck');
      const reconnectingEvents = getEventsByType('mcp:reconnecting');

      // Should have health check failure
      expect(healthCheckEvents).toHaveLength(1);
      expect(healthCheckEvents[0].data.result.success).toBe(false);
      expect(healthCheckEvents[0].data.result.isHealthy).toBe(false);

      // Should trigger reconnection
      expect(reconnectingEvents.length).toBeGreaterThan(0);
      expect(reconnectingEvents[0].data.serverId).toBe(serverId);
    });
  });

  // ==========================================================================
  // Event Verification Through Orchestrator Tests
  // ==========================================================================

  describe('Event Verification Through Orchestrator', () => {
    it('should ensure all events have required fields', async () => {
      const serverId = 'test-server-1';

      // Connect and perform various operations
      await connectionManager.connect(serverId);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate some operations
      connectionManager.simulateTransportError(serverId, 'Test error');
      await connectionManager.disconnect(serverId);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify all events have required fields
      capturedEvents.forEach(event => {
        expect(event.timestamp).toBeInstanceOf(Date);
        expect(event.type).toMatch(/^mcp:/);

        if (event.data) {
          expect(event.data.serverId).toBeDefined();
          expect(typeof event.data.serverId).toBe('string');

          if (event.data.serverName) {
            expect(typeof event.data.serverName).toBe('string');
          }
        }
      });
    });

    it('should maintain proper event ordering', async () => {
      const serverId = 'test-server-1';

      // Clear events and connect
      capturedEvents = [];
      await connectionManager.connect(serverId);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Analyze event sequence
      const events = getEventsForServer(serverId);
      const eventTypes = events.map(e => e.type);

      // Should start with state change to connecting
      expect(eventTypes[0]).toBe('mcp:stateChange');
      expect(events[0].data.newState).toBe('connecting');

      // Should follow with state change to connected
      const connectedStateChange = events.find(e =>
        e.type === 'mcp:stateChange' && e.data.newState === 'connected'
      );
      expect(connectedStateChange).toBeDefined();

      // Should have connected event
      const connectedEvent = events.find(e => e.type === 'mcp:connected');
      expect(connectedEvent).toBeDefined();

      // Connected event should come after or at same time as state change to connected
      const connectedStateIndex = events.indexOf(connectedStateChange!);
      const connectedEventIndex = events.indexOf(connectedEvent!);
      expect(connectedEventIndex).toBeGreaterThanOrEqual(connectedStateIndex);
    });

    it('should handle multiple event listeners correctly', async () => {
      const serverId = 'test-server-1';
      const additionalEvents: any[] = [];

      // Add second listener
      orchestrator.on('mcp:connected', (data) => {
        additionalEvents.push({ type: 'mcp:connected', data });
      });

      // Connect server
      await connectionManager.connect(serverId);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify both listeners received events
      const mainConnectedEvents = getEventsByType('mcp:connected');
      expect(mainConnectedEvents).toHaveLength(1);
      expect(additionalEvents).toHaveLength(1);

      // Verify data is identical
      expect(mainConnectedEvents[0].data).toEqual(additionalEvents[0].data);
    });

    it('should ensure event timestamps are consistent and chronological', async () => {
      const serverId = 'test-server-1';

      // Clear events and connect
      capturedEvents = [];
      await connectionManager.connect(serverId);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get events for this server
      const events = getEventsForServer(serverId);

      // Verify timestamps are chronological
      for (let i = 1; i < events.length; i++) {
        expect(events[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          events[i - 1].timestamp.getTime()
        );
      }

      // Verify all timestamps are recent (within last few seconds)
      const now = Date.now();
      events.forEach(event => {
        const eventTime = event.timestamp.getTime();
        expect(eventTime).toBeGreaterThan(now - 10000); // Within last 10 seconds
        expect(eventTime).toBeLessThanOrEqual(now + 1000); // Not in the future
      });
    });
  });
});