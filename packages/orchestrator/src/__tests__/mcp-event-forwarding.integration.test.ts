/**
 * MCP Event Forwarding Integration Tests
 *
 * End-to-end integration tests that verify MCP event forwarding works correctly
 * in realistic scenarios with actual MCPConnectionManager behavior patterns.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { ApexOrchestrator } from '../index.js';
import { TaskStore } from '../store.js';
import type { ApexConfig } from '@apexcli/core';
import fs from 'fs/promises';

// Mock dependencies
vi.mock('../store.js');
vi.mock('fs/promises');
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  tool: vi.fn((config) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() })),
}));

// Create a realistic mock MCPConnectionManager with state management
class RealisticMCPConnectionManager extends EventEmitter {
  private connections = new Map<string, any>();
  private connectionStates = new Map<string, string>();

  public discoverServers = vi.fn().mockReturnValue([]);
  public connect = vi.fn().mockResolvedValue({});
  public disconnect = vi.fn().mockResolvedValue(undefined);
  public disconnectAll = vi.fn().mockResolvedValue(undefined);
  public listConnections = vi.fn().mockReturnValue([]);
  public getConnection = vi.fn();
  public getClient = vi.fn().mockReturnValue(undefined);
  public updateConfig = vi.fn();

  constructor() {
    super();
    this.getConnection.mockImplementation((serverId: string) => {
      return this.connections.get(serverId) || null;
    });
  }

  // Simulate realistic connection lifecycle
  public simulateConnectionLifecycle(serverId: string, serverName: string) {
    const connection = {
      serverId,
      serverName,
      status: 'connected',
      config: {
        url: `stdio://${serverId}.js`,
        type: 'stdio' as const,
      },
    };

    // Store connection
    this.connections.set(serverId, connection);
    this.connectionStates.set(serverId, 'disconnected');

    // Simulate connection sequence
    setTimeout(() => {
      this.connectionStates.set(serverId, 'connecting');
      this.emit('stateChange', serverId, 'disconnected', 'connecting');
    }, 10);

    setTimeout(() => {
      this.connectionStates.set(serverId, 'connected');
      this.emit('stateChange', serverId, 'connecting', 'connected');
      this.emit('connected', connection);
    }, 20);

    setTimeout(() => {
      this.emit('healthCheck', serverId, {
        isHealthy: true,
        responseTimeMs: 150,
        timestamp: new Date(),
      });
    }, 30);

    setTimeout(() => {
      this.emit('poolChange', serverId, 1, 1);
    }, 40);
  }

  // Simulate connection failure and reconnection
  public simulateReconnectionScenario(serverId: string) {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    setTimeout(() => {
      this.connectionStates.set(serverId, 'error');
      this.emit('stateChange', serverId, 'connected', 'error');
      this.emit('error', serverId, new Error('Network timeout'));
    }, 10);

    setTimeout(() => {
      this.connectionStates.set(serverId, 'reconnecting');
      this.emit('stateChange', serverId, 'error', 'reconnecting');
      this.emit('reconnecting', serverId, 1, 3);
    }, 20);

    setTimeout(() => {
      this.connectionStates.set(serverId, 'connected');
      this.emit('stateChange', serverId, 'reconnecting', 'connected');
      this.emit('connected', { ...connection, status: 'connected' });
    }, 30);
  }

  // Simulate graceful disconnection
  public simulateDisconnection(serverId: string, reason: string = 'User requested') {
    setTimeout(() => {
      this.connectionStates.set(serverId, 'disconnecting');
      this.emit('stateChange', serverId, 'connected', 'disconnecting');
    }, 10);

    setTimeout(() => {
      this.connectionStates.set(serverId, 'disconnected');
      this.emit('stateChange', serverId, 'disconnecting', 'disconnected');
      this.emit('disconnected', serverId, reason);
      this.connections.delete(serverId);
    }, 20);
  }

  // Simulate multiple servers scenario
  public simulateMultiServerEnvironment() {
    const servers = [
      { id: 'server-1', name: 'Primary MCP Server' },
      { id: 'server-2', name: 'Secondary MCP Server' },
      { id: 'server-3', name: 'Backup MCP Server' },
    ];

    servers.forEach((server, index) => {
      setTimeout(() => {
        this.simulateConnectionLifecycle(server.id, server.name);
      }, index * 100);
    });

    // After all are connected, simulate pool changes
    setTimeout(() => {
      this.emit('poolChange', 'pool-manager', 3, 3);
    }, 500);
  }
}

// Mock the MCPConnectionManager module
vi.mock('../mcp/connection-manager.js', () => ({
  MCPConnectionManager: RealisticMCPConnectionManager
}));

const MockTaskStore = vi.mocked(TaskStore);
const mockFS = vi.mocked(fs);

describe('MCP Event Forwarding - Integration Tests', () => {
  let testProjectPath: string;
  let testConfig: ApexConfig;
  let orchestrator: ApexOrchestrator;
  let mockMCPManager: RealisticMCPConnectionManager;

  beforeEach(async () => {
    vi.clearAllMocks();

    testProjectPath = '/tmp/test-apex-project';

    testConfig = {
      project: {
        name: 'integration-test-project',
        description: 'Integration test project for MCP event forwarding',
        version: '1.0.0',
      },
      mcp: {
        enabled: true,
        connection: {
          maxRetries: 3,
          retryDelayMs: 1000,
          connectionTimeoutMs: 10000,
          healthCheckIntervalMs: 30000,
          autoReconnect: true,
        },
        servers: {
          'primary-server': {
            name: 'Primary MCP Server',
            type: 'stdio',
            command: 'node',
            args: ['primary-server.js'],
          },
          'secondary-server': {
            name: 'Secondary MCP Server',
            type: 'stdio',
            command: 'node',
            args: ['secondary-server.js'],
          }
        }
      },
      agents: {},
      workflows: {},
    };

    // Mock file system operations
    mockFS.access.mockResolvedValue(undefined);
    mockFS.mkdir.mockResolvedValue(undefined);
    mockFS.readFile.mockResolvedValue('{}');
    mockFS.writeFile.mockResolvedValue(undefined);

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

    orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });
    mockMCPManager = (RealisticMCPConnectionManager as any).mock.results[0]?.value;
  });

  afterEach(async () => {
    if (orchestrator) {
      try {
        await orchestrator.disconnectAll?.();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
    vi.clearAllMocks();
  });

  describe('Complete Connection Lifecycle', () => {
    it('should forward all events during a complete connection lifecycle', async () => {
      const allEvents: Array<{ type: string; data: any; timestamp: Date }> = [];

      // Listen to all MCP events
      const eventTypes = ['connected', 'disconnected', 'error', 'reconnecting', 'health-check', 'state-change', 'pool-change'];
      eventTypes.forEach(eventType => {
        orchestrator.on(`mcp:${eventType}`, (data) => {
          allEvents.push({ type: eventType, data, timestamp: new Date() });
        });
      });

      // Start connection lifecycle
      mockMCPManager.simulateConnectionLifecycle('lifecycle-test-server', 'Lifecycle Test Server');

      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify we received the expected events in sequence
      expect(allEvents.length).toBeGreaterThanOrEqual(4); // At minimum: 2 state-change, 1 connected, 1 health-check, 1 pool-change

      // Check for state change events
      const stateChangeEvents = allEvents.filter(e => e.type === 'state-change');
      expect(stateChangeEvents.length).toBeGreaterThanOrEqual(2);

      // Verify state transitions
      const stateChanges = stateChangeEvents.map(e => ({
        from: e.data.previousState,
        to: e.data.newState
      }));

      expect(stateChanges).toEqual(
        expect.arrayContaining([
          { from: 'disconnected', to: 'connecting' },
          { from: 'connecting', to: 'connected' }
        ])
      );

      // Check connected event
      const connectedEvents = allEvents.filter(e => e.type === 'connected');
      expect(connectedEvents).toHaveLength(1);
      expect(connectedEvents[0].data.serverId).toBe('lifecycle-test-server');
      expect(connectedEvents[0].data.serverName).toBe('Lifecycle Test Server');

      // Check health check event
      const healthCheckEvents = allEvents.filter(e => e.type === 'health-check');
      expect(healthCheckEvents).toHaveLength(1);
      expect(healthCheckEvents[0].data.isHealthy).toBe(true);
      expect(healthCheckEvents[0].data.responseTimeMs).toBe(150);

      // Check pool change event
      const poolChangeEvents = allEvents.filter(e => e.type === 'pool-change');
      expect(poolChangeEvents).toHaveLength(1);
      expect(poolChangeEvents[0].data.poolSize).toBe(1);
      expect(poolChangeEvents[0].data.activeConnections).toBe(1);
    });
  });

  describe('Reconnection Scenarios', () => {
    it('should forward all events during connection failure and recovery', async () => {
      const allEvents: Array<{ type: string; data: any; timestamp: Date }> = [];

      // Listen to all MCP events
      const eventTypes = ['connected', 'disconnected', 'error', 'reconnecting', 'health-check', 'state-change', 'pool-change'];
      eventTypes.forEach(eventType => {
        orchestrator.on(`mcp:${eventType}`, (data) => {
          allEvents.push({ type: eventType, data, timestamp: new Date() });
        });
      });

      // First establish connection
      mockMCPManager.simulateConnectionLifecycle('reconnection-test-server', 'Reconnection Test Server');
      await new Promise(resolve => setTimeout(resolve, 100));

      const initialEventCount = allEvents.length;

      // Now simulate reconnection scenario
      mockMCPManager.simulateReconnectionScenario('reconnection-test-server');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that we got additional events
      expect(allEvents.length).toBeGreaterThan(initialEventCount);

      const newEvents = allEvents.slice(initialEventCount);

      // Should have error, reconnecting, state changes, and final connection
      const errorEvents = newEvents.filter(e => e.type === 'error');
      const reconnectingEvents = newEvents.filter(e => e.type === 'reconnecting');
      const finalConnectedEvents = newEvents.filter(e => e.type === 'connected');

      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].data.message).toBe('Network timeout');

      expect(reconnectingEvents).toHaveLength(1);
      expect(reconnectingEvents[0].data.attempt).toBe(1);
      expect(reconnectingEvents[0].data.maxAttempts).toBe(3);

      expect(finalConnectedEvents).toHaveLength(1);
      expect(finalConnectedEvents[0].data.serverId).toBe('reconnection-test-server');
    });
  });

  describe('Graceful Disconnection', () => {
    it('should forward disconnection events with proper reason', async () => {
      const disconnectionEvents: any[] = [];
      const stateChangeEvents: any[] = [];

      orchestrator.on('mcp:disconnected', (data) => disconnectionEvents.push(data));
      orchestrator.on('mcp:state-change', (data) => stateChangeEvents.push(data));

      // Establish connection first
      mockMCPManager.simulateConnectionLifecycle('disconnection-test-server', 'Disconnection Test Server');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Clear events from connection setup
      disconnectionEvents.length = 0;
      stateChangeEvents.length = 0;

      // Now disconnect
      mockMCPManager.simulateDisconnection('disconnection-test-server', 'Scheduled maintenance');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify disconnection events
      expect(disconnectionEvents).toHaveLength(1);
      expect(disconnectionEvents[0]).toEqual({
        serverId: 'disconnection-test-server',
        serverName: 'Disconnection Test Server',
        reason: 'Scheduled maintenance',
        timestamp: expect.any(Date),
      });

      // Verify state change events for disconnection
      const disconnectionStateChanges = stateChangeEvents.filter(e =>
        e.newState === 'disconnecting' || e.newState === 'disconnected'
      );
      expect(disconnectionStateChanges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Multi-Server Environment', () => {
    it('should handle events from multiple servers independently', async () => {
      const allEvents: Array<{ type: string; serverId: string; serverName: string; timestamp: Date }> = [];

      // Listen to key events
      ['connected', 'state-change', 'pool-change'].forEach(eventType => {
        orchestrator.on(`mcp:${eventType}`, (data) => {
          allEvents.push({
            type: eventType,
            serverId: data.serverId,
            serverName: data.serverName,
            timestamp: new Date()
          });
        });
      });

      // Simulate multi-server environment
      mockMCPManager.simulateMultiServerEnvironment();
      await new Promise(resolve => setTimeout(resolve, 600));

      // Group events by server
      const server1Events = allEvents.filter(e => e.serverId === 'server-1');
      const server2Events = allEvents.filter(e => e.serverId === 'server-2');
      const server3Events = allEvents.filter(e => e.serverId === 'server-3');
      const poolEvents = allEvents.filter(e => e.serverId === 'pool-manager');

      // Each server should have connection events
      expect(server1Events.length).toBeGreaterThan(0);
      expect(server2Events.length).toBeGreaterThan(0);
      expect(server3Events.length).toBeGreaterThan(0);

      // Verify server names
      expect(server1Events[0]?.serverName).toBe('Primary MCP Server');
      expect(server2Events[0]?.serverName).toBe('Secondary MCP Server');
      expect(server3Events[0]?.serverName).toBe('Backup MCP Server');

      // Should have pool change event
      expect(poolEvents).toHaveLength(1);
      expect(poolEvents[0].type).toBe('pool-change');
    });
  });

  describe('Event Ordering and Timing', () => {
    it('should maintain correct event ordering even with rapid events', async () => {
      const eventSequence: Array<{ type: string; serverId: string; timestamp: number }> = [];

      orchestrator.on('mcp:state-change', (data) => {
        eventSequence.push({
          type: 'state-change',
          serverId: data.serverId,
          timestamp: Date.now()
        });
      });

      orchestrator.on('mcp:connected', (data) => {
        eventSequence.push({
          type: 'connected',
          serverId: data.serverId,
          timestamp: Date.now()
        });
      });

      // Start multiple connection lifecycles rapidly
      for (let i = 0; i < 3; i++) {
        mockMCPManager.simulateConnectionLifecycle(`rapid-server-${i}`, `Rapid Server ${i}`);
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify we got events for all servers
      const server0Events = eventSequence.filter(e => e.serverId === 'rapid-server-0');
      const server1Events = eventSequence.filter(e => e.serverId === 'rapid-server-1');
      const server2Events = eventSequence.filter(e => e.serverId === 'rapid-server-2');

      expect(server0Events.length).toBeGreaterThan(0);
      expect(server1Events.length).toBeGreaterThan(0);
      expect(server2Events.length).toBeGreaterThan(0);

      // Verify events are timestamped (basic temporal ordering check)
      for (let i = 1; i < eventSequence.length; i++) {
        expect(eventSequence[i].timestamp).toBeGreaterThanOrEqual(eventSequence[i - 1].timestamp);
      }
    });
  });

  describe('Real-world Error Scenarios', () => {
    it('should handle intermittent connection issues gracefully', async () => {
      const errorEvents: any[] = [];
      const stateChangeEvents: any[] = [];
      const reconnectingEvents: any[] = [];

      orchestrator.on('mcp:error', (data) => errorEvents.push(data));
      orchestrator.on('mcp:state-change', (data) => stateChangeEvents.push(data));
      orchestrator.on('mcp:reconnecting', (data) => reconnectingEvents.push(data));

      // Establish connection
      mockMCPManager.simulateConnectionLifecycle('intermittent-server', 'Intermittent Server');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate multiple reconnection attempts
      for (let attempt = 1; attempt <= 3; attempt++) {
        // Simulate error
        mockMCPManager.emit('error', 'intermittent-server', new Error(`Connection attempt ${attempt} failed`));

        // Simulate reconnection attempt
        mockMCPManager.emit('reconnecting', 'intermittent-server', attempt, 3);

        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Finally succeed
      mockMCPManager.emit('connected', {
        serverId: 'intermittent-server',
        serverName: 'Intermittent Server',
        status: 'connected',
        config: {
          url: 'stdio://intermittent-server.js',
          type: 'stdio' as const,
        },
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify we captured all the retry attempts
      expect(errorEvents.length).toBeGreaterThanOrEqual(3);
      expect(reconnectingEvents.length).toBeGreaterThanOrEqual(3);

      // Verify attempt numbers are correct
      reconnectingEvents.forEach((event, index) => {
        expect(event.attempt).toBe(index + 1);
        expect(event.maxAttempts).toBe(3);
      });
    });
  });

  describe('Event Data Integrity', () => {
    it('should preserve all event metadata through the forwarding process', async () => {
      const capturedEvents: any[] = [];

      // Capture all types of events
      const eventTypes = ['connected', 'disconnected', 'error', 'reconnecting', 'health-check', 'state-change', 'pool-change'];
      eventTypes.forEach(eventType => {
        orchestrator.on(`mcp:${eventType}`, (data) => {
          capturedEvents.push({ type: eventType, originalData: data });
        });
      });

      // Generate comprehensive events
      mockMCPManager.simulateConnectionLifecycle('integrity-test-server', 'Integrity Test Server');
      await new Promise(resolve => setTimeout(resolve, 100));

      mockMCPManager.simulateReconnectionScenario('integrity-test-server');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify all events have required properties
      capturedEvents.forEach(({ type, originalData }) => {
        // All events should have serverId and timestamp
        expect(originalData.serverId).toBeDefined();
        expect(originalData.timestamp).toBeInstanceOf(Date);

        // Check type-specific properties
        switch (type) {
          case 'connected':
            expect(originalData.serverName).toBeDefined();
            expect(originalData.status).toBeDefined();
            expect(originalData.connectionInfo).toBeDefined();
            break;

          case 'disconnected':
            expect(originalData.reason).toBeDefined();
            break;

          case 'error':
            expect(originalData.error).toBeDefined();
            expect(originalData.message).toBeDefined();
            expect(originalData.code).toBeDefined();
            break;

          case 'reconnecting':
            expect(originalData.attempt).toBeDefined();
            expect(originalData.maxAttempts).toBeDefined();
            break;

          case 'health-check':
            expect(originalData.result).toBeDefined();
            expect(originalData.isHealthy).toBeDefined();
            break;

          case 'state-change':
            expect(originalData.previousState).toBeDefined();
            expect(originalData.newState).toBeDefined();
            break;

          case 'pool-change':
            expect(originalData.poolSize).toBeDefined();
            expect(originalData.activeConnections).toBeDefined();
            break;
        }
      });

      // Verify we captured a good variety of events
      const capturedEventTypes = [...new Set(capturedEvents.map(e => e.type))];
      expect(capturedEventTypes.length).toBeGreaterThan(3);
    });
  });
});