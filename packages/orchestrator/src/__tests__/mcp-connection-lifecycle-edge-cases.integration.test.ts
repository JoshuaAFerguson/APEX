/**
 * MCP Connection Lifecycle Edge Cases Integration Tests
 *
 * Additional integration tests for edge cases and comprehensive coverage
 * of MCP connection lifecycle scenarios not covered in main test suites.
 * These tests ensure robustness in unusual or stress conditions.
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
  parse: vi.fn().mockImplementation((content) => ({
    project: {
      name: 'edge-case-test-project',
      description: 'Edge case test project for MCP lifecycle',
      version: '1.0.0',
    },
    mcp: {
      enabled: true,
      connection: {
        maxRetries: 5,
        retryDelayMs: 500,
        backoffFactor: 1.5,
        maxRetryDelayMs: 10000,
        connectionTimeoutMs: 5000,
        requestTimeoutMs: 15000,
        healthCheckIntervalMs: 2000,
        autoReconnect: true,
      },
      servers: {
        'edge-test-server': {
          name: 'Edge Case Test Server',
          type: 'stdio',
          command: 'node',
          args: ['edge-server.js'],
        },
      },
    },
    agents: {},
    workflows: {},
  })),
}));

const MockTaskStore = vi.mocked(TaskStore);
const mockFS = vi.mocked(fs);

/**
 * Enhanced mock MCPConnectionManager for edge case testing
 */
class EdgeCaseMCPConnectionManager extends EventEmitter {
  private connections = new Map<string, MCPConnection>();
  private timers = new Set<NodeJS.Timeout>();
  private simulatingNetworkConditions = false;
  private connectionAttempts = new Map<string, number>();

  constructor(public options: { projectPath: string; config: any }) {
    super();
  }

  discoverServers() {
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

    const attempts = this.connectionAttempts.get(serverId) || 0;
    this.connectionAttempts.set(serverId, attempts + 1);

    const connection: MCPConnection = {
      serverId,
      serverName: serverConfig.name ?? serverId,
      config: serverConfig,
      state: 'connecting',
      reconnectAttempts: attempts,
    };

    this.connections.set(serverId, connection);
    this.emit('stateChange', serverId, 'disconnected' as MCPConnectionState, 'connecting' as MCPConnectionState);

    // Simulate various edge case scenarios
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const now = new Date();
        connection.state = 'connected';
        connection.connectedAt = now;
        connection.lastActivityAt = now;

        this.emit('stateChange', serverId, 'connecting' as MCPConnectionState, 'connected' as MCPConnectionState);
        this.emit('connected', connection);

        resolve(connection);
      }, this.simulatingNetworkConditions ? 200 : 50);

      this.timers.add(timer);
    });
  }

  async disconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    const previousState = connection.state;
    connection.state = 'disconnected';

    this.emit('stateChange', serverId, previousState, 'disconnected');
    this.emit('disconnected', serverId, `Disconnected from state: ${previousState}`);

    this.connections.delete(serverId);
    this.connectionAttempts.delete(serverId);
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

  // Edge case simulation methods

  /**
   * Simulate rapid connection/disconnection cycles
   */
  simulateConnectionFlapping(serverId: string, cycles: number = 5): void {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    let currentCycle = 0;

    const flap = () => {
      if (currentCycle >= cycles) return;

      // Disconnect
      this.emit('stateChange', serverId, 'connected', 'disconnected');
      this.emit('disconnected', serverId, 'Connection flap');

      setTimeout(() => {
        // Reconnect
        this.emit('stateChange', serverId, 'disconnected', 'connecting');
        setTimeout(() => {
          this.emit('stateChange', serverId, 'connecting', 'connected');
          this.emit('connected', connection);

          currentCycle++;
          if (currentCycle < cycles) {
            setTimeout(flap, 100);
          }
        }, 30);
      }, 50);
    };

    flap();
  }

  /**
   * Simulate concurrent connection attempts to same server
   */
  simulateConcurrentConnectionAttempts(serverId: string, count: number = 3): void {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        this.emit('stateChange', serverId, 'disconnected', 'connecting');
        if (i === count - 1) {
          // Last attempt succeeds
          setTimeout(() => {
            const connection = this.connections.get(serverId) || {
              serverId,
              serverName: 'Concurrent Test Server',
              state: 'connected' as MCPConnectionState,
              config: {},
              reconnectAttempts: 0,
            };
            this.emit('stateChange', serverId, 'connecting', 'connected');
            this.emit('connected', connection);
          }, 50);
        } else {
          // Earlier attempts fail
          setTimeout(() => {
            this.emit('stateChange', serverId, 'connecting', 'error');
            this.emit('error', serverId, new Error(`Concurrent connection attempt ${i + 1} failed`));
          }, 25);
        }
      }, i * 10);
    }
  }

  /**
   * Simulate health check degradation
   */
  simulateHealthDegradation(serverId: string): void {
    let consecutiveFailures = 0;
    const maxFailures = 3;

    const performHealthCheck = () => {
      if (!this.connections.has(serverId)) return;

      consecutiveFailures++;
      const isHealthy = consecutiveFailures <= maxFailures;

      const healthResult = {
        success: isHealthy,
        error: isHealthy ? undefined : new Error('Health check failed'),
        consecutiveFailures,
        isHealthy,
        timestamp: new Date(),
        latencyMs: isHealthy ? Math.random() * 100 + 50 : undefined,
      };

      this.emit('healthCheck', serverId, healthResult);

      if (!isHealthy && consecutiveFailures === maxFailures) {
        // Trigger disconnection after max failures
        setTimeout(() => {
          this.simulateReconnectionWithBackoff(serverId, 3);
        }, 100);
      } else if (isHealthy) {
        // Reset on successful health check
        consecutiveFailures = Math.max(0, consecutiveFailures - 2);
        setTimeout(performHealthCheck, 1000);
      } else {
        setTimeout(performHealthCheck, 500);
      }
    };

    // Start health degradation
    setTimeout(performHealthCheck, 100);
  }

  /**
   * Simulate reconnection with exponential backoff
   */
  simulateReconnectionWithBackoff(serverId: string, maxAttempts: number): void {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    // Initial disconnection
    connection.state = 'disconnected';
    this.emit('stateChange', serverId, 'connected', 'disconnected');
    this.emit('disconnected', serverId, 'Health check failures exceeded threshold');

    let attempt = 0;
    const baseDelay = 500;
    const backoffFactor = 1.5;

    const attemptReconnect = () => {
      attempt++;
      connection.reconnectAttempts = attempt;

      this.emit('reconnecting', serverId, attempt, maxAttempts);
      this.emit('stateChange', serverId, 'disconnected', 'reconnecting');

      const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt - 1), 5000);

      const timer = setTimeout(() => {
        if (attempt === maxAttempts) {
          // Final attempt succeeds
          connection.state = 'connected';
          connection.connectedAt = new Date();
          connection.lastActivityAt = new Date();
          connection.reconnectAttempts = 0;

          this.emit('stateChange', serverId, 'reconnecting', 'connected');
          this.emit('connected', connection);
        } else {
          // Failed attempt
          this.emit('error', serverId, new Error(`Reconnection attempt ${attempt} failed`));
          if (attempt < maxAttempts) {
            setTimeout(attemptReconnect, 100);
          }
        }
      }, delay);

      this.timers.add(timer);
    };

    attemptReconnect();
  }

  /**
   * Simulate network conditions
   */
  enableNetworkConditionSimulation(enabled: boolean = true): void {
    this.simulatingNetworkConditions = enabled;
  }

  private clearAllTimers(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
}

// Mock MCPConnectionManager
vi.mock('../mcp/connection-manager.js', () => ({
  MCPConnectionManager: EdgeCaseMCPConnectionManager,
}));

describe('MCP Connection Lifecycle Edge Cases - Integration Tests', () => {
  let testProjectPath: string;
  let orchestrator: ApexOrchestrator;
  let connectionManager: EdgeCaseMCPConnectionManager;
  let capturedEvents: Array<{ type: string; data: any; timestamp: Date }> = [];

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedEvents = [];

    testProjectPath = '/tmp/test-apex-edge-cases';

    // Mock file system operations
    mockFS.access.mockResolvedValue(undefined);
    mockFS.mkdir.mockResolvedValue(undefined);
    mockFS.writeFile.mockResolvedValue(undefined);
    mockFS.readFile.mockImplementation(async (path: any) => {
      if (path.includes('config.yaml')) {
        return `
project:
  name: edge-case-test-project
  description: Edge case test project for MCP lifecycle
  version: 1.0.0

mcp:
  enabled: true
  connection:
    maxRetries: 5
    retryDelayMs: 500
    backoffFactor: 1.5
    maxRetryDelayMs: 10000
    connectionTimeoutMs: 5000
    requestTimeoutMs: 15000
    healthCheckIntervalMs: 2000
    autoReconnect: true
  servers:
    edge-test-server:
      name: Edge Case Test Server
      type: stdio
      command: node
      args:
        - edge-server.js

agents: {}
workflows: {}
`;
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

    await orchestrator.initialize();

    // Get the mocked connection manager instance
    const { MCPConnectionManager } = await import('../mcp/connection-manager.js');
    const lastCall = vi.mocked(MCPConnectionManager).mock.instances.slice(-1)[0];
    connectionManager = lastCall as any;

    // Set up event capture
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

  describe('Connection Flapping Scenarios', () => {
    it('should handle rapid connection/disconnection cycles gracefully', async () => {
      const serverId = 'edge-test-server';

      // Establish initial connection
      await connectionManager.connect(serverId);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Clear initial connection events
      capturedEvents = [];

      // Simulate connection flapping
      connectionManager.simulateConnectionFlapping(serverId, 3);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify we captured flapping events
      const disconnectedEvents = getEventsByType('mcp:disconnected');
      const connectedEvents = getEventsByType('mcp:connected');
      const stateChangeEvents = getEventsByType('mcp:stateChange');

      expect(disconnectedEvents.length).toBeGreaterThanOrEqual(3);
      expect(connectedEvents.length).toBeGreaterThanOrEqual(3);
      expect(stateChangeEvents.length).toBeGreaterThanOrEqual(6); // 2 per cycle

      // Verify events maintain proper serverId
      disconnectedEvents.forEach(event => {
        expect(event.data.serverId).toBe(serverId);
        expect(event.data.reason).toBe('Connection flap');
      });
    });
  });

  describe('Concurrent Connection Attempts', () => {
    it('should handle multiple simultaneous connection attempts to same server', async () => {
      const serverId = 'edge-test-server';

      // Simulate concurrent connection attempts
      connectionManager.simulateConcurrentConnectionAttempts(serverId, 4);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify error events for failed attempts
      const errorEvents = getEventsByType('mcp:error');
      const connectedEvents = getEventsByType('mcp:connected');
      const stateChangeEvents = getEventsByType('mcp:stateChange');

      expect(errorEvents.length).toBe(3); // 3 failed attempts
      expect(connectedEvents).toHaveLength(1); // 1 successful connection
      expect(stateChangeEvents.length).toBeGreaterThan(3);

      // Verify error messages contain attempt information
      errorEvents.forEach((event, index) => {
        expect(event.data.message).toContain(`Concurrent connection attempt ${index + 1} failed`);
      });

      // Verify final successful connection
      expect(connectedEvents[0].data.serverId).toBe(serverId);
    });
  });

  describe('Health Check Degradation', () => {
    it('should handle gradual health deterioration and recovery', async () => {
      const serverId = 'edge-test-server';

      // Establish connection
      await connectionManager.connect(serverId);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Clear initial events
      capturedEvents = [];

      // Simulate health degradation
      connectionManager.simulateHealthDegradation(serverId);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify health check events
      const healthCheckEvents = getEventsByType('mcp:healthCheck');
      const reconnectingEvents = getEventsByType('mcp:reconnecting');
      const errorEvents = getEventsByType('mcp:error');

      expect(healthCheckEvents.length).toBeGreaterThan(0);

      // Verify health deterioration progression
      const failedHealthChecks = healthCheckEvents.filter(e => !e.data.result.isHealthy);
      expect(failedHealthChecks.length).toBeGreaterThan(0);

      // Verify reconnection triggered after health failures
      if (reconnectingEvents.length > 0) {
        expect(reconnectingEvents[0].data.serverId).toBe(serverId);
      }
    });
  });

  describe('Exponential Backoff Verification', () => {
    it('should implement proper exponential backoff during reconnection', async () => {
      const serverId = 'edge-test-server';

      // Establish connection
      await connectionManager.connect(serverId);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Clear initial events
      capturedEvents = [];

      // Trigger reconnection with backoff
      connectionManager.simulateReconnectionWithBackoff(serverId, 4);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify reconnection attempts
      const reconnectingEvents = getEventsByType('mcp:reconnecting');
      const errorEvents = getEventsByType('mcp:error');
      const connectedEvents = getEventsByType('mcp:connected');

      expect(reconnectingEvents.length).toBe(4);
      expect(errorEvents.length).toBe(3); // Failed attempts before success
      expect(connectedEvents).toHaveLength(1); // Final successful connection

      // Verify attempt numbering
      reconnectingEvents.forEach((event, index) => {
        expect(event.data.attempt).toBe(index + 1);
        expect(event.data.maxAttempts).toBe(4);
      });

      // Verify timing increases (basic validation)
      const eventTimestamps = reconnectingEvents.map(e => e.timestamp.getTime());
      for (let i = 1; i < eventTimestamps.length; i++) {
        expect(eventTimestamps[i] - eventTimestamps[i - 1]).toBeGreaterThan(0);
      }
    });
  });

  describe('Event Ordering Under Stress', () => {
    it('should maintain event ordering during high-frequency operations', async () => {
      const serverId = 'edge-test-server';

      // Enable network condition simulation
      connectionManager.enableNetworkConditionSimulation(true);

      // Perform multiple operations rapidly
      await connectionManager.connect(serverId);
      connectionManager.simulateConnectionFlapping(serverId, 2);

      // Add some delay for concurrent operations
      setTimeout(() => {
        connectionManager.simulateHealthDegradation(serverId);
      }, 50);

      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify event timestamps are monotonically increasing
      const eventTimestamps = capturedEvents.map(e => e.timestamp.getTime());
      for (let i = 1; i < eventTimestamps.length; i++) {
        expect(eventTimestamps[i]).toBeGreaterThanOrEqual(eventTimestamps[i - 1]);
      }

      // Verify all events have proper structure
      capturedEvents.forEach(event => {
        expect(event.type).toMatch(/^mcp:/);
        expect(event.timestamp).toBeInstanceOf(Date);
        expect(event.data.serverId).toBeDefined();
      });
    });
  });

  describe('Resource Cleanup Verification', () => {
    it('should properly clean up resources during disconnection scenarios', async () => {
      const serverId = 'edge-test-server';

      // Establish connection
      await connectionManager.connect(serverId);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Start multiple ongoing operations
      connectionManager.simulateConnectionFlapping(serverId, 5);
      connectionManager.simulateHealthDegradation(serverId);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Force disconnect all
      await connectionManager.disconnectAll();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify final disconnection events
      const disconnectedEvents = getEventsByType('mcp:disconnected');
      expect(disconnectedEvents.length).toBeGreaterThan(0);

      // Verify no connections remain
      expect(connectionManager.listConnections()).toHaveLength(0);
      expect(connectionManager.getConnection(serverId)).toBeUndefined();
    });
  });
});