/**
 * Comprehensive MCP Integration Tests
 *
 * This test suite provides end-to-end integration testing for the complete
 * MCP stack including ConnectionManager, ToolRegistry, and real-world scenarios.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { ApexConfig, MCPServerConfig, MCPConnection } from '@apexcli/core';
import { MCPConnectionManager } from '../mcp/connection-manager.js';
import { MCPToolRegistry } from '../mcp-tool-registry.js';
import type { MCPToolDefinition } from '../mcp/client.js';

// ============================================================================
// Advanced Mock Infrastructure
// ============================================================================

interface MockServerConfig {
  id: string;
  name: string;
  tools: MCPToolDefinition[];
  behavior: {
    connectionLatency?: number;
    requestLatency?: number;
    errorRate?: number;
    disconnectAfter?: number;
    maxConcurrent?: number;
  };
}

class IntegratedMockServer extends EventEmitter {
  private connected = false;
  private requestCount = 0;
  private activeRequests = 0;

  constructor(private config: MockServerConfig) {
    super();
  }

  async connect(): Promise<void> {
    await this.delay(this.config.behavior.connectionLatency || 0);
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

  async request(method: string, params: any = {}): Promise<any> {
    if (!this.connected) {
      throw new Error('Server not connected');
    }

    // Simulate concurrent request limits
    if (this.config.behavior.maxConcurrent &&
        this.activeRequests >= this.config.behavior.maxConcurrent) {
      throw new Error('Server busy - too many concurrent requests');
    }

    this.activeRequests++;
    this.requestCount++;

    try {
      // Simulate random disconnections
      if (this.config.behavior.disconnectAfter &&
          this.requestCount >= this.config.behavior.disconnectAfter) {
        this.connected = false;
        this.emit('disconnected', 'Connection lost');
        throw new Error('Connection lost during request');
      }

      // Simulate random errors
      if (this.config.behavior.errorRate &&
          Math.random() < this.config.behavior.errorRate) {
        throw new Error(`Server error on request ${this.requestCount}`);
      }

      await this.delay(this.config.behavior.requestLatency || 0);

      switch (method) {
        case 'tools/list':
          return { tools: this.config.tools };

        case 'tools/call':
          return await this.handleToolCall(params.name, params.arguments);

        case 'ping':
          return { result: 'pong' };

        default:
          throw new Error(`Unsupported method: ${method}`);
      }
    } finally {
      this.activeRequests--;
    }
  }

  private async handleToolCall(toolName: string, args: any): Promise<any> {
    const tool = this.config.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    // Simulate tool-specific behaviors
    switch (toolName) {
      case 'file-system-scan':
        return {
          files: Array.from({ length: args.maxFiles || 10 }, (_, i) => ({
            path: `/path/file-${i}.txt`,
            size: Math.floor(Math.random() * 10000),
            modified: new Date().toISOString()
          }))
        };

      case 'database-backup':
        await this.delay(100); // Simulate long operation
        return {
          backupId: `backup-${Date.now()}`,
          size: '150MB',
          duration: '2.3s'
        };

      case 'api-health-check':
        const services = args.services || ['auth', 'database', 'cache'];
        return {
          overall: 'healthy',
          services: services.map((service: string) => ({
            name: service,
            status: Math.random() > 0.1 ? 'healthy' : 'degraded',
            latency: Math.floor(Math.random() * 100) + 'ms'
          }))
        };

      case 'log-analysis':
        return {
          summary: {
            totalLines: Math.floor(Math.random() * 10000),
            errors: Math.floor(Math.random() * 50),
            warnings: Math.floor(Math.random() * 200)
          },
          patterns: [
            { pattern: 'ERROR.*timeout', count: Math.floor(Math.random() * 20) },
            { pattern: 'WARN.*retry', count: Math.floor(Math.random() * 50) }
          ]
        };

      case 'system-metrics':
        return {
          cpu: Math.random() * 100,
          memory: Math.random() * 100,
          disk: Math.random() * 100,
          network: {
            rx: Math.floor(Math.random() * 1000) + 'MB',
            tx: Math.floor(Math.random() * 500) + 'MB'
          }
        };

      default:
        return { result: `Called ${toolName}`, args };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test utilities
  simulateDisconnection(): void {
    if (this.connected) {
      this.connected = false;
      this.emit('disconnected', 'Network error');
    }
  }

  addTool(tool: MCPToolDefinition): void {
    this.config.tools.push(tool);
  }

  removeTool(name: string): void {
    const index = this.config.tools.findIndex(t => t.name === name);
    if (index >= 0) {
      this.config.tools.splice(index, 1);
    }
  }
}

// Predefined server configurations for different scenarios
const SERVER_CONFIGS: Record<string, MockServerConfig> = {
  filesystem: {
    id: 'filesystem',
    name: 'File System Server',
    tools: [
      {
        name: 'file-system-scan',
        description: 'Scan filesystem for files',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            maxFiles: { type: 'number', minimum: 1, maximum: 1000 }
          },
          required: ['path']
        }
      },
      {
        name: 'file-watch',
        description: 'Watch directory for changes',
        inputSchema: {
          type: 'object',
          properties: {
            directory: { type: 'string' },
            pattern: { type: 'string' }
          },
          required: ['directory']
        }
      }
    ],
    behavior: {
      connectionLatency: 50,
      requestLatency: 25
    }
  },

  database: {
    id: 'database',
    name: 'Database Management Server',
    tools: [
      {
        name: 'database-backup',
        description: 'Create database backup',
        inputSchema: {
          type: 'object',
          properties: {
            database: { type: 'string' },
            compression: { type: 'boolean', default: true }
          },
          required: ['database']
        }
      },
      {
        name: 'query-optimizer',
        description: 'Optimize database queries',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            explain: { type: 'boolean', default: false }
          },
          required: ['query']
        }
      }
    ],
    behavior: {
      connectionLatency: 100,
      requestLatency: 150
    }
  },

  monitoring: {
    id: 'monitoring',
    name: 'System Monitoring Server',
    tools: [
      {
        name: 'system-metrics',
        description: 'Get system performance metrics',
        inputSchema: {
          type: 'object',
          properties: {
            interval: { type: 'number', minimum: 1, maximum: 3600 },
            metrics: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      {
        name: 'log-analysis',
        description: 'Analyze system logs',
        inputSchema: {
          type: 'object',
          properties: {
            logFile: { type: 'string' },
            timeRange: { type: 'string' },
            level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] }
          },
          required: ['logFile']
        }
      },
      {
        name: 'api-health-check',
        description: 'Check API endpoint health',
        inputSchema: {
          type: 'object',
          properties: {
            services: { type: 'array', items: { type: 'string' } },
            timeout: { type: 'number', minimum: 1000, maximum: 30000 }
          }
        }
      }
    ],
    behavior: {
      connectionLatency: 25,
      requestLatency: 50
    }
  }
};

// Mock setup
function setupMockInfrastructure() {
  const mockServers = new Map<string, IntegratedMockServer>();
  const mockTransports = new Map<string, any>();
  const mockClients = new Map<string, any>();

  // Mock transport factory
  const { StdioTransport } = require('../mcp/transports/index.js');
  StdioTransport.mockImplementation((options: any) => {
    const serverId = Object.keys(SERVER_CONFIGS).find(id =>
      options.command.includes(id)
    ) || 'default';

    const serverConfig = SERVER_CONFIGS[serverId];
    if (!serverConfig) {
      throw new Error(`No config for server: ${serverId}`);
    }

    const server = new IntegratedMockServer(serverConfig);
    mockServers.set(serverId, server);

    const transport = {
      connect: () => server.connect(),
      disconnect: () => server.disconnect(),
      isConnected: () => server.isConnected(),
      send: (message: any) => server.request(message.method, message.params),
      on: (event: string, handler: Function) => server.on(event, handler),
      off: (event: string, handler: Function) => server.off(event, handler),
      emit: (event: string, ...args: any[]) => server.emit(event, ...args)
    };

    mockTransports.set(serverId, transport);
    return transport;
  });

  // Mock client factory
  const { MCPClient } = require('../mcp/client.js');
  MCPClient.mockImplementation(({ transport }: any) => {
    const client = {
      connect: () => transport.connect(),
      disconnect: () => transport.disconnect(),
      listTools: () => transport.send({ method: 'tools/list' }).then((r: any) => r.tools),
      callTool: (name: string, args: any) =>
        transport.send({ method: 'tools/call', params: { name, arguments: args } }),
      ping: () => transport.send({ method: 'ping' }),
      on: (event: string, handler: Function) => transport.on(event, handler),
      off: (event: string, handler: Function) => transport.off(event, handler),
      transport
    };

    // Find server ID for this client
    const serverId = Array.from(mockTransports.entries())
      .find(([, t]) => t === transport)?.[0];
    if (serverId) {
      mockClients.set(serverId, client);
    }

    return client;
  });

  return { mockServers, mockTransports, mockClients };
}

// Mock dependencies
vi.mock('../mcp/transports/index.js', () => ({
  StdioTransport: vi.fn()
}));

vi.mock('../mcp/client.js', () => ({
  MCPClient: vi.fn()
}));

vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    ExponentialBackoffReconnector: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      scheduleReconnect: vi.fn(),
      notifyConnected: vi.fn(),
      notifyDisconnected: vi.fn(),
      notifyConnectionFailed: vi.fn(),
      isExhausted: vi.fn().mockReturnValue(false),
      destroy: vi.fn()
    })),
    ConnectionHealthManager: vi.fn().mockImplementation(() => ({
      register: vi.fn(),
      unregister: vi.fn(),
      performHealthCheck: vi.fn().mockResolvedValue({
        success: true,
        latencyMs: 50,
        consecutiveFailures: 0,
        isHealthy: true,
        startedAt: new Date()
      }),
      getHealthState: vi.fn(),
      getHealthStats: vi.fn(),
      notifyPingSent: vi.fn(),
      notifyPongReceived: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn()
    })),
    getMCPServers: vi.fn().mockImplementation((config: ApexConfig) => config.mcp?.servers || {})
  };
});

// ============================================================================
// Test Configuration
// ============================================================================

function createIntegrationConfig(): ApexConfig {
  return {
    project: { name: 'integration-test-project', version: '1.0.0' },
    limits: {
      maxConcurrentTasks: 10,
      maxDailyTasks: 100,
      maxTokensPerTask: 100000,
      maxTurns: 10
    },
    mcp: {
      enabled: true,
      servers: {
        filesystem: {
          name: 'File System Server',
          type: 'stdio',
          command: 'mock-filesystem-server'
        },
        database: {
          name: 'Database Server',
          type: 'stdio',
          command: 'mock-database-server'
        },
        monitoring: {
          name: 'Monitoring Server',
          type: 'stdio',
          command: 'mock-monitoring-server'
        }
      } as Record<string, MCPServerConfig>,
      connection: {
        maxRetries: 3,
        retryDelayMs: 100,
        connectionTimeoutMs: 5000,
        autoReconnect: true,
        healthCheckIntervalMs: 10000
      }
    },
    autonomy: { level: 'manual' as const },
    agents: {},
    workflows: {}
  };
}

// ============================================================================
// Integration Test Suite
// ============================================================================

describe('Comprehensive MCP Integration Tests', () => {
  let connectionManager: MCPConnectionManager;
  let toolRegistry: MCPToolRegistry;
  let mockInfrastructure: ReturnType<typeof setupMockInfrastructure>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInfrastructure = setupMockInfrastructure();

    const config = createIntegrationConfig();
    connectionManager = new MCPConnectionManager({
      projectPath: '/test/project',
      config
    });

    toolRegistry = new MCPToolRegistry({
      autoRefresh: false,
      operationTimeoutMs: 10000
    });

    toolRegistry.setConnectionManager(connectionManager);
  });

  afterEach(async () => {
    await connectionManager.disconnectAll();
    toolRegistry.shutdown();
    mockInfrastructure.mockServers.clear();
    mockInfrastructure.mockTransports.clear();
    mockInfrastructure.mockClients.clear();
  });

  // ==========================================================================
  // Full System Integration
  // ==========================================================================

  describe('Full System Integration', () => {
    test('should perform complete system setup and tool discovery', async () => {
      // Track all events during setup
      const events: Array<{ type: string; data: any }> = [];

      connectionManager.on('connected', (conn) =>
        events.push({ type: 'connected', data: conn.serverId }));
      connectionManager.on('error', (serverId, error) =>
        events.push({ type: 'error', data: { serverId, error: error.message } }));

      toolRegistry.on('tool:registered', (event) =>
        events.push({ type: 'tool:registered', data: event.toolName }));
      toolRegistry.on('registry:refreshed', (event) =>
        events.push({ type: 'registry:refreshed', data: event }));

      // Connect to all servers
      const connectionPromises = ['filesystem', 'database', 'monitoring']
        .map(serverId => connectionManager.connect(serverId));

      const connections = await Promise.all(connectionPromises);

      // Register tools from all connections
      for (const connection of connections) {
        await toolRegistry.addConnection(connection);
      }

      await toolRegistry.refreshAllTools();

      // Verify system state
      expect(connections).toHaveLength(3);
      expect(connectionManager.listConnections()).toHaveLength(3);

      const stats = toolRegistry.getStats();
      expect(stats.totalTools).toBe(7); // Total tools across all servers
      expect(stats.activeConnections).toBe(3);
      expect(stats.availableTools).toBe(7);

      // Verify events were emitted correctly
      const connectedEvents = events.filter(e => e.type === 'connected');
      const registeredEvents = events.filter(e => e.type === 'tool:registered');

      expect(connectedEvents).toHaveLength(3);
      expect(registeredEvents).toHaveLength(7);

      // Verify specific tools are available
      expect(toolRegistry.hasTool('file-system-scan')).toBe(true);
      expect(toolRegistry.hasTool('database-backup')).toBe(true);
      expect(toolRegistry.hasTool('system-metrics')).toBe(true);
    });

    test('should handle complex workflow execution across multiple servers', async () => {
      // Setup all servers
      await connectionManager.connect('filesystem');
      await connectionManager.connect('database');
      await connectionManager.connect('monitoring');

      for (const serverId of ['filesystem', 'database', 'monitoring']) {
        const connection = connectionManager.getConnection(serverId)!;
        await toolRegistry.addConnection(connection);
      }

      await toolRegistry.refreshAllTools();

      // Execute a complex workflow
      const workflowResults = [];

      // Step 1: Check system health
      const healthResult = await connectionManager.executeTool(
        'monitoring',
        'api-health-check',
        { services: ['database', 'filesystem'] }
      );
      workflowResults.push({ step: 'health-check', result: healthResult });

      // Step 2: Scan filesystem
      const scanResult = await connectionManager.executeTool(
        'filesystem',
        'file-system-scan',
        { path: '/data', maxFiles: 50 }
      );
      workflowResults.push({ step: 'filesystem-scan', result: scanResult });

      // Step 3: Create database backup
      const backupResult = await connectionManager.executeTool(
        'database',
        'database-backup',
        { database: 'production', compression: true }
      );
      workflowResults.push({ step: 'database-backup', result: backupResult });

      // Step 4: Analyze logs
      const logResult = await connectionManager.executeTool(
        'monitoring',
        'log-analysis',
        { logFile: '/var/log/app.log', level: 'error' }
      );
      workflowResults.push({ step: 'log-analysis', result: logResult });

      // Step 5: Get system metrics
      const metricsResult = await connectionManager.executeTool(
        'monitoring',
        'system-metrics',
        { metrics: ['cpu', 'memory', 'disk'] }
      );
      workflowResults.push({ step: 'system-metrics', result: metricsResult });

      // Verify all steps completed successfully
      expect(workflowResults).toHaveLength(5);
      workflowResults.forEach(({ step, result }) => {
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
      });

      // Verify metrics tracking
      const fsMetrics = connectionManager.getMetrics('filesystem');
      const dbMetrics = connectionManager.getMetrics('database');
      const monitoringMetrics = connectionManager.getMetrics('monitoring');

      expect(fsMetrics?.totalRequests).toBe(1);
      expect(dbMetrics?.totalRequests).toBe(1);
      expect(monitoringMetrics?.totalRequests).toBe(3);

      expect(fsMetrics?.totalErrors).toBe(0);
      expect(dbMetrics?.totalErrors).toBe(0);
      expect(monitoringMetrics?.totalErrors).toBe(0);
    });

    test('should handle partial system failures gracefully', async () => {
      // Configure one server to be unreliable
      const unreliableServer = mockInfrastructure.mockServers.get('database')!;
      unreliableServer.config.behavior.errorRate = 0.8;

      const errorSpy = vi.fn();
      connectionManager.on('error', errorSpy);
      connectionManager.on('tool:error', errorSpy);

      // Connect to all servers
      await connectionManager.connect('filesystem');
      await connectionManager.connect('monitoring');

      // Database connection might fail
      try {
        await connectionManager.connect('database');
      } catch (error) {
        // Expected for unreliable server
      }

      // Register available connections
      for (const serverId of ['filesystem', 'monitoring']) {
        const connection = connectionManager.getConnection(serverId);
        if (connection) {
          await toolRegistry.addConnection(connection);
        }
      }

      await toolRegistry.refreshAllTools();

      // System should still be partially functional
      const stats = toolRegistry.getStats();
      expect(stats.availableTools).toBeGreaterThan(0);

      // Test workflow with fallback
      const results = [];

      // This should work (filesystem server is reliable)
      try {
        const scanResult = await connectionManager.executeTool(
          'filesystem',
          'file-system-scan',
          { path: '/data' }
        );
        results.push(scanResult);
      } catch (error) {
        // Should not happen
        throw error;
      }

      // This should work (monitoring server is reliable)
      try {
        const metricsResult = await connectionManager.executeTool(
          'monitoring',
          'system-metrics',
          {}
        );
        results.push(metricsResult);
      } catch (error) {
        // Should not happen
        throw error;
      }

      // Database operations might fail, but system continues
      const dbConnection = connectionManager.getConnection('database');
      if (dbConnection) {
        try {
          const backupResult = await connectionManager.executeTool(
            'database',
            'database-backup',
            { database: 'test' }
          );
          results.push(backupResult);
        } catch (error) {
          // Expected for unreliable server
        }
      }

      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================================================
  // Performance and Concurrency
  // ==========================================================================

  describe('Performance and Concurrency', () => {
    test('should handle high-throughput tool execution', async () => {
      await connectionManager.connect('monitoring');
      const connection = connectionManager.getConnection('monitoring')!;
      await toolRegistry.addConnection(connection);

      const concurrentRequests = 20;
      const startTime = Date.now();

      // Execute many tools concurrently
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        connectionManager.executeTool(
          'monitoring',
          'system-metrics',
          { interval: 1, metrics: [`metric-${i}`] }
        )
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result).toBeDefined();
      });

      // Should complete reasonably quickly
      expect(duration).toBeLessThan(5000);

      // Verify metrics
      const metrics = connectionManager.getMetrics('monitoring');
      expect(metrics?.totalRequests).toBe(concurrentRequests);
      expect(metrics?.totalErrors).toBe(0);
    });

    test('should handle concurrent server operations', async () => {
      // Connect to all servers concurrently
      const connectionPromises = ['filesystem', 'database', 'monitoring']
        .map(serverId => connectionManager.connect(serverId));

      await Promise.all(connectionPromises);

      // Register tools concurrently
      const registrationPromises = ['filesystem', 'database', 'monitoring']
        .map(async serverId => {
          const connection = connectionManager.getConnection(serverId)!;
          await toolRegistry.addConnection(connection);
        });

      await Promise.all(registrationPromises);

      // Refresh all tools
      await toolRegistry.refreshAllTools();

      // Execute tools on all servers concurrently
      const executionPromises = [
        connectionManager.executeTool('filesystem', 'file-system-scan', { path: '/test1' }),
        connectionManager.executeTool('database', 'database-backup', { database: 'db1' }),
        connectionManager.executeTool('monitoring', 'system-metrics', {}),
        connectionManager.executeTool('filesystem', 'file-watch', { directory: '/test2' }),
        connectionManager.executeTool('monitoring', 'log-analysis', { logFile: '/test.log' })
      ];

      const results = await Promise.all(executionPromises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    test('should handle server with limited concurrency', async () => {
      // Configure monitoring server to accept only 2 concurrent requests
      const monitoringServer = mockInfrastructure.mockServers.get('monitoring')!;
      monitoringServer.config.behavior.maxConcurrent = 2;

      await connectionManager.connect('monitoring');

      const errorSpy = vi.fn();
      connectionManager.on('tool:error', errorSpy);

      // Try to execute more requests than the server can handle
      const promises = Array.from({ length: 5 }, (_, i) =>
        connectionManager.executeTool(
          'monitoring',
          'system-metrics',
          { interval: 1 }
        ).catch(error => ({ error: error.message }))
      );

      const results = await Promise.all(promises);

      // Some should succeed, some should fail due to concurrency limits
      const successes = results.filter(r => !('error' in r));
      const failures = results.filter(r => 'error' in r);

      expect(successes.length).toBeGreaterThan(0);
      expect(failures.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Resilience and Recovery
  // ==========================================================================

  describe('Resilience and Recovery', () => {
    test('should handle cascading server failures', async () => {
      // Set up servers with different failure characteristics
      const filesystemServer = mockInfrastructure.mockServers.get('filesystem')!;
      const databaseServer = mockInfrastructure.mockServers.get('database')!;

      filesystemServer.config.behavior.disconnectAfter = 3;
      databaseServer.config.behavior.disconnectAfter = 5;

      // Connect all servers
      await connectionManager.connect('filesystem');
      await connectionManager.connect('database');
      await connectionManager.connect('monitoring');

      for (const serverId of ['filesystem', 'database', 'monitoring']) {
        const connection = connectionManager.getConnection(serverId)!;
        await toolRegistry.addConnection(connection);
      }

      await toolRegistry.refreshAllTools();

      const disconnectionEvents: string[] = [];
      connectionManager.on('disconnected', (serverId) => {
        disconnectionEvents.push(serverId);
      });

      let operationCount = 0;
      const maxOperations = 10;

      // Perform operations until servers start failing
      while (operationCount < maxOperations) {
        const availableConnections = connectionManager.listConnections()
          .filter(conn => conn.state === 'connected');

        if (availableConnections.length === 0) break;

        // Try each available server
        for (const conn of availableConnections) {
          try {
            if (conn.serverId === 'filesystem' && toolRegistry.isToolAvailable('file-system-scan')) {
              await connectionManager.executeTool(conn.serverId, 'file-system-scan', { path: `/test${operationCount}` });
            } else if (conn.serverId === 'database' && toolRegistry.isToolAvailable('database-backup')) {
              await connectionManager.executeTool(conn.serverId, 'database-backup', { database: `db${operationCount}` });
            } else if (conn.serverId === 'monitoring' && toolRegistry.isToolAvailable('system-metrics')) {
              await connectionManager.executeTool(conn.serverId, 'system-metrics', {});
            }
            operationCount++;
          } catch (error) {
            // Server may have disconnected
            break;
          }
        }
      }

      // Should have experienced some disconnections
      expect(disconnectionEvents.length).toBeGreaterThan(0);

      // Monitoring server should still be available (no disconnect limit)
      const monitoringConnection = connectionManager.getConnection('monitoring');
      expect(monitoringConnection?.state).toBe('connected');
    });

    test('should recover from network partitions', async () => {
      await connectionManager.connect('filesystem');
      await connectionManager.connect('monitoring');

      const fsConnection = connectionManager.getConnection('filesystem')!;
      const monitoringConnection = connectionManager.getConnection('monitoring')!;

      await toolRegistry.addConnection(fsConnection);
      await toolRegistry.addConnection(monitoringConnection);
      await toolRegistry.refreshAllTools();

      // Initially all tools should be available
      expect(toolRegistry.getStats().availableTools).toBe(5); // 2 fs + 3 monitoring

      // Simulate network partition
      const filesystemServer = mockInfrastructure.mockServers.get('filesystem')!;
      filesystemServer.simulateDisconnection();

      // Update registry state
      toolRegistry.updateConnectionState('filesystem', 'disconnected');

      // Should now only have monitoring tools available
      expect(toolRegistry.getStats().availableTools).toBe(3);
      expect(toolRegistry.isToolAvailable('file-system-scan')).toBe(false);
      expect(toolRegistry.isToolAvailable('system-metrics')).toBe(true);

      // Simulate network recovery
      await filesystemServer.connect();
      toolRegistry.updateConnectionState('filesystem', 'connected');

      // All tools should be available again
      expect(toolRegistry.getStats().availableTools).toBe(5);
      expect(toolRegistry.isToolAvailable('file-system-scan')).toBe(true);
    });

    test('should handle gradual system degradation', async () => {
      // Set up servers with increasing latency over time
      const servers = mockInfrastructure.mockServers;

      await connectionManager.connect('filesystem');
      await connectionManager.connect('database');
      await connectionManager.connect('monitoring');

      for (const serverId of ['filesystem', 'database', 'monitoring']) {
        const connection = connectionManager.getConnection(serverId)!;
        await toolRegistry.addConnection(connection);
      }

      await toolRegistry.refreshAllTools();

      // Track performance degradation
      const performanceMetrics: Array<{ iteration: number; duration: number; errors: number }> = [];

      for (let i = 0; i < 5; i++) {
        // Increase latency for all servers
        servers.forEach(server => {
          server.config.behavior.requestLatency = (server.config.behavior.requestLatency || 0) + 50;
        });

        const startTime = Date.now();
        let errorCount = 0;

        // Execute batch of operations
        const operations = [
          connectionManager.executeTool('filesystem', 'file-system-scan', { path: '/test' }),
          connectionManager.executeTool('database', 'database-backup', { database: 'test' }),
          connectionManager.executeTool('monitoring', 'system-metrics', {})
        ];

        const results = await Promise.allSettled(operations);
        errorCount = results.filter(r => r.status === 'rejected').length;

        const duration = Date.now() - startTime;
        performanceMetrics.push({ iteration: i, duration, errors: errorCount });
      }

      // Performance should degrade over time
      expect(performanceMetrics[0].duration).toBeLessThan(performanceMetrics[4].duration);

      // But system should remain functional
      expect(performanceMetrics.every(m => m.errors <= m.iteration + 1)).toBe(true);
    });
  });

  // ==========================================================================
  // Real-world Scenarios
  // ==========================================================================

  describe('Real-world Scenarios', () => {
    test('should handle system maintenance scenario', async () => {
      // Initial full system setup
      await connectionManager.connect('filesystem');
      await connectionManager.connect('database');
      await connectionManager.connect('monitoring');

      for (const serverId of ['filesystem', 'database', 'monitoring']) {
        const connection = connectionManager.getConnection(serverId)!;
        await toolRegistry.addConnection(connection);
      }

      await toolRegistry.refreshAllTools();

      // Phase 1: Normal operations
      await connectionManager.executeTool('filesystem', 'file-system-scan', { path: '/data' });
      await connectionManager.executeTool('monitoring', 'system-metrics', {});

      // Phase 2: Database maintenance (take database offline)
      await connectionManager.disconnect('database');
      toolRegistry.updateConnectionState('database', 'disconnected');

      // Should still be able to use other services
      await connectionManager.executeTool('filesystem', 'file-system-scan', { path: '/backup' });
      await connectionManager.executeTool('monitoring', 'log-analysis', { logFile: '/maintenance.log' });

      expect(toolRegistry.isToolAvailable('database-backup')).toBe(false);
      expect(toolRegistry.isToolAvailable('file-system-scan')).toBe(true);

      // Phase 3: Database back online
      await connectionManager.connect('database');
      const dbConnection = connectionManager.getConnection('database')!;
      await toolRegistry.addConnection(dbConnection);
      toolRegistry.updateConnectionState('database', 'connected');

      // All services should be available again
      await connectionManager.executeTool('database', 'database-backup', { database: 'post-maintenance' });
      expect(toolRegistry.getStats().availableTools).toBe(7);
    });

    test('should handle load balancing across multiple similar servers', async () => {
      // Add multiple monitoring servers
      const monitoringServer1 = mockInfrastructure.mockServers.get('monitoring')!;

      // Create second monitoring server
      const monitoringConfig2 = { ...SERVER_CONFIGS.monitoring };
      monitoringConfig2.id = 'monitoring-2';
      monitoringConfig2.name = 'Monitoring Server 2';
      const monitoringServer2 = new IntegratedMockServer(monitoringConfig2);
      mockInfrastructure.mockServers.set('monitoring-2', monitoringServer2);

      // Mock additional transport for second server
      const transport2 = {
        connect: () => monitoringServer2.connect(),
        disconnect: () => monitoringServer2.disconnect(),
        isConnected: () => monitoringServer2.isConnected(),
        send: (message: any) => monitoringServer2.request(message.method, message.params),
        on: (event: string, handler: Function) => monitoringServer2.on(event, handler),
        off: (event: string, handler: Function) => monitoringServer2.off(event, handler),
        emit: (event: string, ...args: any[]) => monitoringServer2.emit(event, ...args)
      };

      // Update connection manager config
      const config = createIntegrationConfig();
      config.mcp!.servers!['monitoring-2'] = {
        name: 'Monitoring Server 2',
        type: 'stdio',
        command: 'mock-monitoring-2-server'
      };

      connectionManager.updateConfig(config);

      // Connect to both monitoring servers
      await connectionManager.connect('monitoring');

      // Mock the second connection manually since our mock setup is simplified
      const connection2: MCPConnection = {
        serverId: 'monitoring-2',
        serverName: 'Monitoring Server 2',
        state: 'connected',
        config: config.mcp!.servers!['monitoring-2'],
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
        heartbeatInterval: 30000,
        maxReconnectAttempts: 5,
        reconnectDelay: 1000
      };

      // Add both to tool registry
      const connection1 = connectionManager.getConnection('monitoring')!;
      await toolRegistry.addConnection(connection1);
      await toolRegistry.addConnection(connection2);

      await toolRegistry.refreshAllTools();

      // Should have tools from both servers (though they might overlap)
      const stats = toolRegistry.getStats();
      expect(stats.activeConnections).toBe(2);
      expect(stats.toolsByConnection['monitoring']).toBeGreaterThan(0);
      expect(stats.toolsByConnection['monitoring-2']).toBeGreaterThan(0);

      // Test load distribution
      const results1 = await connectionManager.executeTool('monitoring', 'system-metrics', {});
      expect(results1).toBeDefined();

      // Both servers should be capable of handling requests
      const metrics1 = connectionManager.getMetrics('monitoring');
      expect(metrics1?.totalRequests).toBe(1);
    });
  });
});