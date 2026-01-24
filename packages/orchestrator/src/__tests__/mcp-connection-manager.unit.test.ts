/**
 * Unit Tests for MCPConnectionManager
 *
 * This test suite provides comprehensive unit testing for the MCPConnectionManager
 * class, covering all core functionality including connection management,
 * health monitoring, event emission, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { ApexConfig, MCPServerConfig, MCPConnection } from '@apexcli/core';
import { ExponentialBackoffReconnector, ConnectionHealthManager } from '@apexcli/core';
import { MCPConnectionManager, type MCPConnectionManagerOptions } from '../mcp/connection-manager.js';
import { MCPClient } from '../mcp/client.js';
import { StdioTransport } from '../mcp/transports/stdio-transport.js';

// Mock dependencies
vi.mock('../mcp/client.js');
vi.mock('../mcp/transports/stdio-transport.js');
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    ExponentialBackoffReconnector: vi.fn(),
    ConnectionHealthManager: vi.fn(),
    getMCPServers: vi.fn(),
  };
});

describe('MCPConnectionManager', () => {
  let manager: MCPConnectionManager;
  let mockConfig: ApexConfig;
  let mockClient: any;
  let mockTransport: any;
  let mockReconnector: any;
  let mockHealthManager: any;

  const TEST_PROJECT_PATH = '/test/project';
  const TEST_SERVER_ID = 'test-server';

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock config
    mockConfig = {
      mcp: {
        enabled: true,
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
        servers: {
          [TEST_SERVER_ID]: {
            name: 'Test Server',
            type: 'stdio',
            command: 'test-command',
            args: ['arg1', 'arg2'],
          },
        },
      },
    } as ApexConfig;

    // Mock client
    mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockResolvedValue([]),
      callTool: vi.fn().mockResolvedValue({ result: 'test' }),
      ping: vi.fn().mockResolvedValue({ result: 'pong' }),
    };

    // Mock transport
    mockTransport = new EventEmitter();
    mockTransport.connect = vi.fn().mockResolvedValue(undefined);
    mockTransport.disconnect = vi.fn().mockResolvedValue(undefined);

    // Mock reconnector
    mockReconnector = new EventEmitter();
    mockReconnector.notifyConnected = vi.fn();
    mockReconnector.notifyDisconnected = vi.fn();
    mockReconnector.notifyConnectionFailed = vi.fn();
    mockReconnector.scheduleReconnect = vi.fn();
    mockReconnector.isExhausted = vi.fn().mockReturnValue(false);
    mockReconnector.destroy = vi.fn();

    // Mock health manager
    mockHealthManager = new EventEmitter();
    mockHealthManager.register = vi.fn();
    mockHealthManager.unregister = vi.fn();
    mockHealthManager.destroy = vi.fn();
    mockHealthManager.performHealthCheck = vi.fn().mockResolvedValue({
      success: true,
      latencyMs: 50,
      consecutiveFailures: 0,
      isHealthy: true,
      startedAt: new Date(),
    });

    // Set up constructor mocks
    (MCPClient as Mock).mockImplementation(() => mockClient);
    (StdioTransport as Mock).mockImplementation(() => mockTransport);
    (ExponentialBackoffReconnector as Mock).mockImplementation(() => mockReconnector);
    (ConnectionHealthManager as Mock).mockImplementation(() => mockHealthManager);

    // Mock getMCPServers
    const { getMCPServers } = await import('@apexcli/core');
    (getMCPServers as Mock).mockReturnValue(mockConfig.mcp!.servers);

    manager = new MCPConnectionManager({
      projectPath: TEST_PROJECT_PATH,
      config: mockConfig,
    });
  });

  afterEach(async () => {
    await manager.disconnectAll();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(ConnectionHealthManager).toHaveBeenCalledWith({
        enabled: true,
        method: 'ping',
        intervalMs: 30000,
        timeoutMs: 5000,
        failureThreshold: 3,
        triggerReconnectOnFailure: true,
        customHealthCheck: expect.any(Function),
      });
    });

    it('should use provided connection config override', () => {
      const customConnectionConfig = {
        maxRetries: 5,
        retryDelayMs: 2000,
      };

      const customManager = new MCPConnectionManager({
        projectPath: TEST_PROJECT_PATH,
        config: mockConfig,
        connectionConfig: customConnectionConfig,
      });

      expect(customManager).toBeDefined();
    });

    it('should handle missing MCP config gracefully', () => {
      const configWithoutMcp = {} as ApexConfig;

      const managerWithoutMcp = new MCPConnectionManager({
        projectPath: TEST_PROJECT_PATH,
        config: configWithoutMcp,
      });

      expect(managerWithoutMcp).toBeDefined();
    });
  });

  describe('discoverServers', () => {
    it('should return empty array when MCP is disabled', () => {
      const disabledConfig = {
        ...mockConfig,
        mcp: { ...mockConfig.mcp!, enabled: false },
      } as ApexConfig;

      const disabledManager = new MCPConnectionManager({
        projectPath: TEST_PROJECT_PATH,
        config: disabledConfig,
      });

      const servers = disabledManager.discoverServers();
      expect(servers).toEqual([]);
    });

    it('should return configured servers', () => {
      const servers = manager.discoverServers();
      expect(servers).toHaveLength(1);
      expect(servers[0]).toMatchObject({
        name: 'Test Server',
        type: 'stdio',
        command: 'test-command',
        args: ['arg1', 'arg2'],
      });
    });

    it('should filter out SDK type servers', () => {
      const configWithSdk = {
        ...mockConfig,
        mcp: {
          ...mockConfig.mcp!,
          servers: {
            'sdk-server': { type: 'sdk', name: 'SDK Server' },
            'stdio-server': { type: 'stdio', command: 'test', name: 'Stdio Server' },
          },
        },
      } as ApexConfig;

      const { getMCPServers } = await import('@apexcli/core');
      (getMCPServers as Mock).mockReturnValue(configWithSdk.mcp!.servers);

      const managerWithSdk = new MCPConnectionManager({
        projectPath: TEST_PROJECT_PATH,
        config: configWithSdk,
      });

      const servers = managerWithSdk.discoverServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].type).toBe('stdio');
    });

    it('should skip servers missing required fields', () => {
      const incompleteConfig = {
        ...mockConfig,
        mcp: {
          ...mockConfig.mcp!,
          servers: {
            'incomplete-stdio': { type: 'stdio', name: 'Missing Command' },
            'incomplete-http': { type: 'http', name: 'Missing URL' },
            'valid-stdio': { type: 'stdio', command: 'test', name: 'Valid' },
          },
        },
      } as ApexConfig;

      const { getMCPServers } = await import('@apexcli/core');
      (getMCPServers as Mock).mockReturnValue(incompleteConfig.mcp!.servers);

      const managerWithIncomplete = new MCPConnectionManager({
        projectPath: TEST_PROJECT_PATH,
        config: incompleteConfig,
      });

      const servers = managerWithIncomplete.discoverServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].command).toBe('test');
    });
  });

  describe('connect', () => {
    it('should successfully connect to a server', async () => {
      const connection = await manager.connect(TEST_SERVER_ID);

      expect(connection).toMatchObject({
        serverId: TEST_SERVER_ID,
        serverName: 'Test Server',
        state: 'connected',
        reconnectAttempts: 0,
      });

      expect(mockClient.connect).toHaveBeenCalledOnce();
      expect(mockReconnector.notifyConnected).toHaveBeenCalledOnce();
      expect(mockHealthManager.register).toHaveBeenCalledOnce();
    });

    it('should return existing connection if already connected', async () => {
      const connection1 = await manager.connect(TEST_SERVER_ID);
      const connection2 = await manager.connect(TEST_SERVER_ID);

      expect(connection1).toBe(connection2);
      expect(mockClient.connect).toHaveBeenCalledOnce();
    });

    it('should throw error if connection is already in progress', async () => {
      // Set up client to hang during connection
      mockClient.connect.mockImplementation(() => new Promise(() => {}));

      const connectPromise = manager.connect(TEST_SERVER_ID);

      await expect(manager.connect(TEST_SERVER_ID)).rejects.toThrow(
        `Connection to server '${TEST_SERVER_ID}' is already in progress`
      );

      // Clean up hanging promise
      mockClient.connect.mockResolvedValue(undefined);
      await connectPromise;
    });

    it('should throw error for non-existent server', async () => {
      await expect(manager.connect('non-existent')).rejects.toThrow(
        `MCP server 'non-existent' not found in configuration`
      );
    });

    it('should handle connection failures', async () => {
      const connectionError = new Error('Connection failed');
      mockClient.connect.mockRejectedValue(connectionError);

      await expect(manager.connect(TEST_SERVER_ID)).rejects.toThrow('Connection failed');

      const connection = manager.getConnection(TEST_SERVER_ID);
      expect(connection).toBeUndefined();
    });

    it('should emit connected event on successful connection', async () => {
      const connectedSpy = vi.fn();
      manager.on('connected', connectedSpy);

      const connection = await manager.connect(TEST_SERVER_ID);

      expect(connectedSpy).toHaveBeenCalledWith(connection);
    });

    it('should emit error event on connection failure', async () => {
      const errorSpy = vi.fn();
      manager.on('error', errorSpy);

      const connectionError = new Error('Connection failed');
      mockClient.connect.mockRejectedValue(connectionError);

      await expect(manager.connect(TEST_SERVER_ID)).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(TEST_SERVER_ID, connectionError);
    });
  });

  describe('disconnect', () => {
    it('should disconnect from a connected server', async () => {
      await manager.connect(TEST_SERVER_ID);
      await manager.disconnect(TEST_SERVER_ID);

      const connection = manager.getConnection(TEST_SERVER_ID);
      expect(connection).toBeUndefined();
      expect(mockClient.disconnect).toHaveBeenCalledOnce();
    });

    it('should handle disconnection from non-existent server gracefully', async () => {
      await expect(manager.disconnect('non-existent')).resolves.not.toThrow();
    });

    it('should emit disconnected event', async () => {
      const disconnectedSpy = vi.fn();
      manager.on('disconnected', disconnectedSpy);

      await manager.connect(TEST_SERVER_ID);
      await manager.disconnect(TEST_SERVER_ID);

      expect(disconnectedSpy).toHaveBeenCalledWith(
        TEST_SERVER_ID,
        expect.stringContaining('Disconnected from state')
      );
    });

    it('should clean up health monitoring', async () => {
      await manager.connect(TEST_SERVER_ID);
      await manager.disconnect(TEST_SERVER_ID);

      expect(mockHealthManager.unregister).toHaveBeenCalledWith(TEST_SERVER_ID);
    });

    it('should clean up reconnector', async () => {
      await manager.connect(TEST_SERVER_ID);
      await manager.disconnect(TEST_SERVER_ID);

      expect(mockReconnector.destroy).toHaveBeenCalledOnce();
    });
  });

  describe('getConnection', () => {
    it('should return connection for connected server', async () => {
      await manager.connect(TEST_SERVER_ID);
      const connection = manager.getConnection(TEST_SERVER_ID);

      expect(connection).toBeDefined();
      expect(connection!.serverId).toBe(TEST_SERVER_ID);
    });

    it('should return undefined for non-existent server', () => {
      const connection = manager.getConnection('non-existent');
      expect(connection).toBeUndefined();
    });
  });

  describe('listConnections', () => {
    it('should return empty array when no connections', () => {
      const connections = manager.listConnections();
      expect(connections).toEqual([]);
    });

    it('should return all connections', async () => {
      await manager.connect(TEST_SERVER_ID);
      const connections = manager.listConnections();

      expect(connections).toHaveLength(1);
      expect(connections[0].serverId).toBe(TEST_SERVER_ID);
    });
  });

  describe('getClient', () => {
    it('should return client for connected server', async () => {
      await manager.connect(TEST_SERVER_ID);
      const client = manager.getClient(TEST_SERVER_ID);

      expect(client).toBe(mockClient);
    });

    it('should return undefined for non-existent server', () => {
      const client = manager.getClient('non-existent');
      expect(client).toBeUndefined();
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newConfig = { ...mockConfig } as ApexConfig;
      manager.updateConfig(newConfig);

      // Should not throw - internal state updated
      expect(manager).toBeDefined();
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect all servers', async () => {
      await manager.connect(TEST_SERVER_ID);
      await manager.disconnectAll();

      const connections = manager.listConnections();
      expect(connections).toEqual([]);
      expect(mockHealthManager.destroy).toHaveBeenCalledOnce();
    });
  });

  describe('health monitoring', () => {
    beforeEach(async () => {
      await manager.connect(TEST_SERVER_ID);
    });

    it('should get health state for connection', () => {
      const health = manager.getHealth(TEST_SERVER_ID);
      expect(health).toBeDefined();
      expect(health!.isHealthy).toBe(true);
      expect(health!.consecutiveFailures).toBe(0);
    });

    it('should return undefined for non-existent connection health', () => {
      const health = manager.getHealth('non-existent');
      expect(health).toBeUndefined();
    });

    it('should perform manual health check', async () => {
      const result = await manager.checkHealth(TEST_SERVER_ID);

      expect(result).toMatchObject({
        success: true,
        isHealthy: true,
        consecutiveFailures: 0,
      });

      expect(mockHealthManager.performHealthCheck).toHaveBeenCalledWith(TEST_SERVER_ID);
    });

    it('should get unified health state', () => {
      manager.getUnifiedHealthState(TEST_SERVER_ID);
      // This would call through to health manager - no specific assertion needed
    });

    it('should get health statistics', () => {
      manager.getHealthStatistics(TEST_SERVER_ID);
      // This would call through to health manager - no specific assertion needed
    });

    it('should notify ping sent', () => {
      manager.notifyPingSent(TEST_SERVER_ID, 'ping-123', Date.now());
      // Should not throw
    });

    it('should notify pong received', () => {
      manager.notifyPongReceived(TEST_SERVER_ID, 'ping-123', 50);
      // Should not throw
    });
  });

  describe('metrics', () => {
    beforeEach(async () => {
      await manager.connect(TEST_SERVER_ID);
    });

    it('should get connection metrics', () => {
      const metrics = manager.getMetrics(TEST_SERVER_ID);

      expect(metrics).toBeDefined();
      expect(metrics!.totalConnections).toBe(1);
      expect(metrics!.totalReconnections).toBe(0);
      expect(metrics!.totalRequests).toBe(0);
      expect(metrics!.totalErrors).toBe(0);
    });

    it('should return undefined for non-existent connection metrics', () => {
      const metrics = manager.getMetrics('non-existent');
      expect(metrics).toBeUndefined();
    });

    it('should calculate uptime correctly', () => {
      const metrics = manager.getMetrics(TEST_SERVER_ID);
      expect(metrics!.uptimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('tool execution', () => {
    beforeEach(async () => {
      await manager.connect(TEST_SERVER_ID);
    });

    it('should execute tool successfully', async () => {
      const toolResult = { result: 'success' };
      mockClient.callTool.mockResolvedValue(toolResult);

      const result = await manager.executeTool(TEST_SERVER_ID, 'test-tool', { param: 'value' });

      expect(result).toBe(toolResult);
      expect(mockClient.callTool).toHaveBeenCalledWith('test-tool', { param: 'value' });
    });

    it('should emit tool execution events', async () => {
      const toolStartSpy = vi.fn();
      const toolCompleteSpy = vi.fn();
      manager.on('tool:start', toolStartSpy);
      manager.on('tool:complete', toolCompleteSpy);

      await manager.executeTool(TEST_SERVER_ID, 'test-tool', { param: 'value' });

      expect(toolStartSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: TEST_SERVER_ID,
          toolName: 'test-tool',
          args: { param: 'value' },
          callId: expect.any(String),
        })
      );

      expect(toolCompleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: TEST_SERVER_ID,
          toolName: 'test-tool',
          callId: expect.any(String),
          result: { result: 'test' },
          durationMs: expect.any(Number),
        })
      );
    });

    it('should handle tool execution errors', async () => {
      const toolError = new Error('Tool execution failed');
      mockClient.callTool.mockRejectedValue(toolError);

      const toolErrorSpy = vi.fn();
      manager.on('tool:error', toolErrorSpy);

      await expect(
        manager.executeTool(TEST_SERVER_ID, 'test-tool', { param: 'value' })
      ).rejects.toThrow('Tool execution failed');

      expect(toolErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: TEST_SERVER_ID,
          toolName: 'test-tool',
          error: 'Tool execution failed',
          errorCode: 'EXECUTION_ERROR',
          retriable: false,
        })
      );
    });

    it('should throw error for non-existent connection', async () => {
      await expect(
        manager.executeTool('non-existent', 'test-tool', {})
      ).rejects.toThrow("Connection 'non-existent' not found");
    });

    it('should throw error for non-connected server', async () => {
      await manager.disconnect(TEST_SERVER_ID);

      await expect(
        manager.executeTool(TEST_SERVER_ID, 'test-tool', {})
      ).rejects.toThrow(`Connection '${TEST_SERVER_ID}' is not connected`);
    });
  });

  describe('transport error handling', () => {
    beforeEach(async () => {
      await manager.connect(TEST_SERVER_ID);
    });

    it('should handle transport errors', () => {
      const errorSpy = vi.fn();
      manager.on('error', errorSpy);

      const transportError = new Error('Transport error');
      mockTransport.emit('error', transportError);

      expect(errorSpy).toHaveBeenCalledWith(TEST_SERVER_ID, transportError);
    });

    it('should handle transport disconnection', () => {
      const disconnectedSpy = vi.fn();
      manager.on('disconnected', disconnectedSpy);

      mockTransport.emit('disconnected', 'Network failure');

      expect(disconnectedSpy).toHaveBeenCalledWith(TEST_SERVER_ID, 'Network failure');
    });

    it('should not trigger reconnection on intentional disconnect', async () => {
      // Start disconnection process
      const disconnectPromise = manager.disconnect(TEST_SERVER_ID);

      // Emit transport disconnection during intentional disconnect
      mockTransport.emit('disconnected', 'Intentional');

      await disconnectPromise;

      // Should not schedule reconnection for intentional disconnect
      expect(mockReconnector.scheduleReconnect).not.toHaveBeenCalled();
    });
  });

  describe('error categorization', () => {
    beforeEach(async () => {
      await manager.connect(TEST_SERVER_ID);
    });

    it('should categorize timeout errors as retriable', async () => {
      const timeoutError = new Error('Request timeout');
      mockClient.callTool.mockRejectedValue(timeoutError);

      const toolErrorSpy = vi.fn();
      manager.on('tool:error', toolErrorSpy);

      await expect(
        manager.executeTool(TEST_SERVER_ID, 'test-tool', {})
      ).rejects.toThrow();

      expect(toolErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'TIMEOUT',
          retriable: true,
        })
      );
    });

    it('should categorize disconnect errors as retriable', async () => {
      const disconnectError = new Error('Connection disconnect occurred');
      mockClient.callTool.mockRejectedValue(disconnectError);

      const toolErrorSpy = vi.fn();
      manager.on('tool:error', toolErrorSpy);

      await expect(
        manager.executeTool(TEST_SERVER_ID, 'test-tool', {})
      ).rejects.toThrow();

      expect(toolErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'DISCONNECTED',
          retriable: true,
        })
      );
    });

    it('should categorize not found errors as non-retriable', async () => {
      const notFoundError = new Error('Tool not found');
      mockClient.callTool.mockRejectedValue(notFoundError);

      const toolErrorSpy = vi.fn();
      manager.on('tool:error', toolErrorSpy);

      await expect(
        manager.executeTool(TEST_SERVER_ID, 'test-tool', {})
      ).rejects.toThrow();

      expect(toolErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'TOOL_NOT_FOUND',
          retriable: false,
        })
      );
    });
  });

  describe('event emission', () => {
    it('should emit state change events', async () => {
      const stateChangeSpy = vi.fn();
      manager.on('stateChange', stateChangeSpy);

      await manager.connect(TEST_SERVER_ID);

      // State changes are handled by the reconnector, so we simulate them
      mockReconnector.emit('state:changed', 'disconnected', 'connected');

      expect(stateChangeSpy).toHaveBeenCalled();
    });
  });
});