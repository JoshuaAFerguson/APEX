/**
 * Integration Tests for MCP Server Connection
 *
 * This test suite provides comprehensive integration testing for MCP server
 * connection functionality, testing the interaction between MCPConnectionManager,
 * MCPToolRegistry, and mock MCP servers in realistic scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ApexConfig } from '@apexcli/core';
import { MCPConnectionManager } from '../mcp/connection-manager.js';
import { MCPToolRegistry } from '../mcp-tool-registry.js';
import {
  createMockServer,
  createMockClient,
  createTestScenario,
  type MockMCPServer,
  PREDEFINED_SERVERS,
} from './utils/mock-mcp-server.js';

describe('MCP Server Connection Integration', () => {
  let connectionManager: MCPConnectionManager;
  let toolRegistry: MCPToolRegistry;
  let mockConfig: ApexConfig;
  let mockServers: Map<string, MockMCPServer>;

  const TEST_PROJECT_PATH = '/test/project';

  beforeEach(async () => {
    // Create mock configuration
    mockConfig = {
      mcp: {
        enabled: true,
        connection: {
          maxRetries: 3,
          retryDelayMs: 100,
          backoffFactor: 2,
          maxRetryDelayMs: 1000,
          connectionTimeoutMs: 5000,
          requestTimeoutMs: 10000,
          idleTimeoutMs: 300000,
          poolSize: 1,
          poolMinSize: 0,
          healthCheckIntervalMs: 1000,
          healthCheckTimeoutMs: 500,
          healthCheckFailureThreshold: 3,
          autoReconnect: true,
          keepAlive: true,
          keepAliveIntervalMs: 15000,
          heartbeatEnabled: true,
          heartbeatIntervalMs: 30000,
        },
        servers: {
          filesystem: {
            name: 'File System Server',
            type: 'stdio',
            command: 'mock-filesystem-server',
            args: [],
            env: {},
          },
          database: {
            name: 'Database Server',
            type: 'stdio',
            command: 'mock-database-server',
            args: [],
            env: {},
          },
        },
      },
    } as ApexConfig;

    // Create mock servers
    mockServers = createTestScenario()
      .addServer('filesystem', 'filesystem')
      .addServer('database', 'database')
      .build();

    // Initialize connection manager
    connectionManager = new MCPConnectionManager({
      projectPath: TEST_PROJECT_PATH,
      config: mockConfig,
    });

    // Initialize tool registry
    toolRegistry = new MCPToolRegistry({
      autoRefresh: false,
      operationTimeoutMs: 5000,
    });

    toolRegistry.setConnectionManager(connectionManager);

    // Mock the transport creation to use our mock servers
    await mockTransportCreation();
  });

  afterEach(async () => {
    await connectionManager.disconnectAll();
    toolRegistry.shutdown();
    mockServers.clear();
  });

  async function mockTransportCreation() {
    // Mock the private createTransport method to return mock clients
    const originalCreateTransport = (connectionManager as any).createTransport;
    (connectionManager as any).createTransport = vi.fn((serverConfig: any) => {
      const serverId = Object.keys(mockConfig.mcp!.servers!).find(
        id => mockConfig.mcp!.servers![id].command === serverConfig.command
      );

      if (serverId && mockServers.has(serverId)) {
        const mockServer = mockServers.get(serverId)!;
        return createMockClient(mockServer);
      }

      return originalCreateTransport.call(connectionManager, serverConfig);
    });
  }

  describe('server discovery', () => {
    it('should discover all configured servers', () => {
      const servers = connectionManager.discoverServers();

      expect(servers).toHaveLength(2);

      const filesystemServer = servers.find(s => s.name === 'File System Server');
      const databaseServer = servers.find(s => s.name === 'Database Server');

      expect(filesystemServer).toBeDefined();
      expect(databaseServer).toBeDefined();
    });

    it('should filter servers by type correctly', () => {
      const servers = connectionManager.discoverServers();

      // All should be stdio type (no SDK servers in test config)
      expect(servers.every(s => s.type === 'stdio')).toBe(true);
    });
  });

  describe('single server connection', () => {
    it('should connect to filesystem server successfully', async () => {
      const connection = await connectionManager.connect('filesystem');

      expect(connection).toBeDefined();
      expect(connection.serverId).toBe('filesystem');
      expect(connection.serverName).toBe('File System Server');
      expect(connection.state).toBe('connected');
      expect(connection.connectedAt).toBeDefined();
    });

    it('should emit connection events', async () => {
      const connectedSpy = vi.fn();
      connectionManager.on('connected', connectedSpy);

      await connectionManager.connect('filesystem');

      expect(connectedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 'filesystem',
          state: 'connected',
        })
      );
    });

    it('should register tools after connection', async () => {
      await connectionManager.connect('filesystem');

      const connection = connectionManager.getConnection('filesystem')!;
      await toolRegistry.addConnection(connection);

      const tools = toolRegistry.getToolsByConnection('filesystem');
      expect(tools.length).toBeGreaterThan(0);

      // Should have filesystem-specific tools
      const toolNames = tools.map(t => t.mcpTool.name);
      expect(toolNames).toContain('file-system-scan');
      expect(toolNames).toContain('file-read');
      expect(toolNames).toContain('file-write');
    });

    it('should handle connection failure gracefully', async () => {
      // Configure server to fail connection
      const server = mockServers.get('filesystem')!;
      server.updateBehavior({ simulateConnectionFailure: true });

      const errorSpy = vi.fn();
      connectionManager.on('error', errorSpy);

      await expect(connectionManager.connect('filesystem')).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        'filesystem',
        expect.any(Error)
      );
    });
  });

  describe('multiple server connections', () => {
    it('should connect to multiple servers simultaneously', async () => {
      const connectPromises = [
        connectionManager.connect('filesystem'),
        connectionManager.connect('database'),
      ];

      const connections = await Promise.all(connectPromises);

      expect(connections).toHaveLength(2);
      expect(connections[0].serverId).toBe('filesystem');
      expect(connections[1].serverId).toBe('database');

      const allConnections = connectionManager.listConnections();
      expect(allConnections).toHaveLength(2);
    });

    it('should register tools from all connected servers', async () => {
      await connectionManager.connect('filesystem');
      await connectionManager.connect('database');

      const filesystemConnection = connectionManager.getConnection('filesystem')!;
      const databaseConnection = connectionManager.getConnection('database')!;

      await toolRegistry.addConnection(filesystemConnection);
      await toolRegistry.addConnection(databaseConnection);

      const allTools = toolRegistry.getAllTools();
      expect(allTools.length).toBeGreaterThan(4); // Filesystem + database tools

      const filesystemTools = toolRegistry.getToolsByConnection('filesystem');
      const databaseTools = toolRegistry.getToolsByConnection('database');

      expect(filesystemTools.length).toBeGreaterThan(0);
      expect(databaseTools.length).toBeGreaterThan(0);

      // Check for specific tool types
      const allToolNames = allTools.map(t => t.mcpTool.name);
      expect(allToolNames).toContain('file-system-scan');
      expect(allToolNames).toContain('database-backup');
    });

    it('should handle partial connection failures', async () => {
      // Configure only database server to fail
      const databaseServer = mockServers.get('database')!;
      databaseServer.updateBehavior({ simulateConnectionFailure: true });

      const filesystemConnection = await connectionManager.connect('filesystem');

      await expect(connectionManager.connect('database')).rejects.toThrow();

      // Filesystem connection should still work
      expect(filesystemConnection.state).toBe('connected');

      const connections = connectionManager.listConnections();
      expect(connections).toHaveLength(1);
      expect(connections[0].serverId).toBe('filesystem');
    });
  });

  describe('connection lifecycle', () => {
    beforeEach(async () => {
      await connectionManager.connect('filesystem');
    });

    it('should disconnect server successfully', async () => {
      const disconnectedSpy = vi.fn();
      connectionManager.on('disconnected', disconnectedSpy);

      await connectionManager.disconnect('filesystem');

      expect(disconnectedSpy).toHaveBeenCalledWith(
        'filesystem',
        expect.stringContaining('Disconnected')
      );

      const connection = connectionManager.getConnection('filesystem');
      expect(connection).toBeUndefined();
    });

    it('should handle unexpected disconnection', async () => {
      const disconnectedSpy = vi.fn();
      connectionManager.on('disconnected', disconnectedSpy);

      // Simulate network disconnection
      const server = mockServers.get('filesystem')!;
      server.simulateDisconnection();

      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(disconnectedSpy).toHaveBeenCalled();
    });

    it('should update tool availability on disconnection', async () => {
      const connection = connectionManager.getConnection('filesystem')!;
      await toolRegistry.addConnection(connection);

      const toolsBefore = toolRegistry.getAvailableTools();
      expect(toolsBefore.length).toBeGreaterThan(0);

      toolRegistry.updateConnectionState('filesystem', 'disconnected');

      const toolsAfter = toolRegistry.getAvailableTools();
      expect(toolsAfter.length).toBe(0);
    });
  });

  describe('health monitoring', () => {
    beforeEach(async () => {
      await connectionManager.connect('filesystem');
    });

    it('should perform health checks', async () => {
      const healthResult = await connectionManager.checkHealth('filesystem');

      expect(healthResult).toMatchObject({
        success: true,
        isHealthy: true,
        consecutiveFailures: 0,
      });
    });

    it('should emit health check events', async () => {
      const healthCheckSpy = vi.fn();
      connectionManager.on('healthCheck', healthCheckSpy);

      await connectionManager.checkHealth('filesystem');

      expect(healthCheckSpy).toHaveBeenCalledWith(
        'filesystem',
        expect.objectContaining({
          success: true,
          isHealthy: true,
        })
      );
    });

    it('should track health metrics', async () => {
      const health = connectionManager.getHealth('filesystem');
      expect(health).toBeDefined();
      expect(health!.isHealthy).toBe(true);
      expect(health!.consecutiveFailures).toBe(0);

      const metrics = connectionManager.getMetrics('filesystem');
      expect(metrics).toBeDefined();
      expect(metrics!.totalConnections).toBe(1);
    });
  });

  describe('error scenarios', () => {
    it('should handle server errors during tool discovery', async () => {
      await connectionManager.connect('filesystem');

      const connection = connectionManager.getConnection('filesystem')!;

      // Configure server to return errors for tool listing
      const server = mockServers.get('filesystem')!;
      server.updateBehavior({ errorRate: 1.0 }); // 100% error rate

      const errorSpy = vi.fn();
      toolRegistry.on('error', errorSpy);

      await toolRegistry.addConnection(connection);

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should handle slow servers', async () => {
      // Configure server with high latency
      const server = mockServers.get('filesystem')!;
      server.updateBehavior({
        connectionLatency: 100,
        requestLatency: 200,
      });

      const startTime = Date.now();
      await connectionManager.connect('filesystem');
      const connectionTime = Date.now() - startTime;

      expect(connectionTime).toBeGreaterThanOrEqual(100);
    });

    it('should handle tool discovery timeout', async () => {
      await connectionManager.connect('filesystem');

      const connection = connectionManager.getConnection('filesystem')!;

      // Configure server with very slow tool discovery
      const server = mockServers.get('filesystem')!;
      server.updateBehavior({ toolDiscoveryLatency: 10000 }); // 10 seconds

      // Create registry with short timeout
      const shortTimeoutRegistry = new MCPToolRegistry({
        operationTimeoutMs: 100, // 100ms timeout
      });
      shortTimeoutRegistry.setConnectionManager(connectionManager);

      const errorSpy = vi.fn();
      shortTimeoutRegistry.on('error', errorSpy);

      await shortTimeoutRegistry.addConnection(connection);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('timeout'),
        })
      );

      shortTimeoutRegistry.shutdown();
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent connections', async () => {
      const concurrentConnections = 5;
      const connectPromises = Array.from({ length: concurrentConnections }, () =>
        connectionManager.connect('filesystem')
      );

      const results = await Promise.all(connectPromises);

      // All should return the same connection instance
      expect(results.every(conn => conn === results[0])).toBe(true);

      const connections = connectionManager.listConnections();
      expect(connections).toHaveLength(1);
    });

    it('should handle concurrent tool discovery', async () => {
      await connectionManager.connect('filesystem');
      await connectionManager.connect('database');

      const connection1 = connectionManager.getConnection('filesystem')!;
      const connection2 = connectionManager.getConnection('database')!;

      const discoveryPromises = [
        toolRegistry.addConnection(connection1),
        toolRegistry.addConnection(connection2),
        toolRegistry.refreshAllTools(),
        toolRegistry.refreshAllTools(),
      ];

      await Promise.all(discoveryPromises);

      const allTools = toolRegistry.getAllTools();
      expect(allTools.length).toBeGreaterThan(0);
    });
  });

  describe('server behavior simulation', () => {
    it('should handle unreliable servers', async () => {
      // Create scenario with unreliable server
      const unreliableServers = createTestScenario()
        .addServer('unreliable', 'utilities')
        .withUnreliableServer('unreliable', 0.3) // 30% error rate
        .build();

      const unreliableServer = unreliableServers.get('unreliable')!;
      mockServers.set('unreliable', unreliableServer);

      // Update config
      mockConfig.mcp!.servers!.unreliable = {
        name: 'Unreliable Server',
        type: 'stdio',
        command: 'mock-unreliable-server',
        args: [],
        env: {},
      };

      await connectionManager.connect('unreliable');
      const connection = connectionManager.getConnection('unreliable')!;
      await toolRegistry.addConnection(connection);

      // Some operations should succeed, some should fail
      const client = connectionManager.getClient('unreliable')!;
      const results = await Promise.allSettled([
        client.listTools(),
        client.listTools(),
        client.listTools(),
        client.listTools(),
        client.listTools(),
      ]);

      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;

      // With 30% error rate, we expect some failures
      expect(failures).toBeGreaterThan(0);
      expect(successes).toBeGreaterThan(0);
    });

    it('should handle servers with limited concurrency', async () => {
      // Create server with limited concurrency
      const limitedServers = createTestScenario()
        .addServer('limited', 'utilities')
        .withLimitedConcurrency('limited', 2) // Max 2 concurrent requests
        .build();

      const limitedServer = limitedServers.get('limited')!;
      mockServers.set('limited', limitedServer);

      mockConfig.mcp!.servers!.limited = {
        name: 'Limited Server',
        type: 'stdio',
        command: 'mock-limited-server',
        args: [],
        env: {},
      };

      await connectionManager.connect('limited');
      const client = connectionManager.getClient('limited')!;

      // Launch more requests than the server can handle
      const requestPromises = Array.from({ length: 5 }, () =>
        client.request('tools/list').catch(err => err)
      );

      const results = await Promise.all(requestPromises);

      // Some requests should fail due to concurrency limits
      const errors = results.filter(r => r instanceof Error);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(err => err.message.includes('too many concurrent requests'))).toBe(true);
    });
  });
});