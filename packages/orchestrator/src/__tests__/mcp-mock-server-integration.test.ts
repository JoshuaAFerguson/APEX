/**
 * Mock MCP Server Integration Tests
 *
 * This test suite provides comprehensive integration testing with mock MCP servers
 * to ensure all acceptance criteria are met:
 *
 * 1. Mock MCP server for testing ✅
 * 2. Integration tests verifying MCP server connection and tool invocation ✅
 * 3. End-to-end workflow with mocked MCP tools ✅
 * 4. Error handling and resilience testing ✅
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { MCPConnectionManager } from '../mcp/connection-manager.js';
import { MCPToolRegistry } from '../mcp-tool-registry.js';
import { MCPClient } from '../mcp/client.js';
import { StdioTransport } from '../mcp/transports/stdio-transport.js';
import type { ApexConfig, MCPConnection, MCPServerConfig } from '@apexcli/core';
import type { MCPToolDefinition } from '../mcp/client.js';

// Mock transport that simulates a real MCP server
class MockMCPTransport extends EventEmitter {
  private connected = false;
  private tools: MCPToolDefinition[] = [];

  constructor(private config: { tools?: MCPToolDefinition[]; simulateErrors?: boolean } = {}) {
    super();
    this.tools = config.tools || [];
  }

  async connect(): Promise<void> {
    if (this.config.simulateErrors) {
      throw new Error('Mock connection failure');
    }
    this.connected = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit('disconnected', 'Intentional disconnect');
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Simulate server requests
  async request(method: string, params: any): Promise<any> {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }

    switch (method) {
      case 'tools/list':
        return { tools: this.tools };

      case 'tools/call':
        return this.handleToolCall(params.name, params.arguments);

      case 'ping':
        return { result: 'pong' };

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private async handleToolCall(toolName: string, args: any): Promise<any> {
    const tool = this.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    // Simulate different tool behaviors
    switch (toolName) {
      case 'file-read':
        if (!args.path) {
          throw new Error('Missing required parameter: path');
        }
        return {
          content: `Mock file content for ${args.path}`,
          size: 42,
          lastModified: new Date().toISOString()
        };

      case 'file-write':
        if (!args.path || !args.content) {
          throw new Error('Missing required parameters');
        }
        return {
          bytesWritten: args.content.length,
          path: args.path
        };

      case 'database-query':
        if (args.query?.includes('DROP')) {
          throw new Error('Destructive queries not allowed');
        }
        return {
          rows: [
            { id: 1, name: 'Mock Record 1' },
            { id: 2, name: 'Mock Record 2' }
          ],
          count: 2
        };

      case 'slow-operation':
        // Simulate a slow operation
        await new Promise(resolve => setTimeout(resolve, 100));
        return { result: 'Operation completed after delay' };

      case 'failing-tool':
        throw new Error('This tool always fails');

      default:
        return { result: `Mock response for ${toolName}`, args };
    }
  }

  // Simulate network issues
  simulateDisconnection(): void {
    if (this.connected) {
      this.connected = false;
      this.emit('disconnected', 'Network error');
    }
  }

  simulateError(): void {
    this.emit('error', new Error('Simulated transport error'));
  }
}

// Mock MCP Server configurations
const MOCK_SERVERS = {
  filesystem: {
    tools: [
      {
        name: 'file-read',
        description: 'Read a file from the filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the file' }
          },
          required: ['path']
        }
      },
      {
        name: 'file-write',
        description: 'Write content to a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the file' },
            content: { type: 'string', description: 'Content to write' }
          },
          required: ['path', 'content']
        }
      }
    ]
  },
  database: {
    tools: [
      {
        name: 'database-query',
        description: 'Execute a database query',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'SQL query to execute' },
            params: { type: 'array', description: 'Query parameters' }
          },
          required: ['query']
        }
      }
    ]
  },
  utilities: {
    tools: [
      {
        name: 'slow-operation',
        description: 'A slow operation for testing timeouts',
        inputSchema: {
          type: 'object',
          properties: {
            delay: { type: 'number', description: 'Delay in milliseconds' }
          }
        }
      },
      {
        name: 'failing-tool',
        description: 'A tool that always fails for testing error handling',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  }
};

// Mock the transport and client dependencies
vi.mock('../mcp/client.js');
vi.mock('../mcp/transports/stdio-transport.js');
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
      performHealthCheck: vi.fn(),
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

describe('Mock MCP Server Integration Tests', () => {
  let connectionManager: MCPConnectionManager;
  let toolRegistry: MCPToolRegistry;
  let mockConfig: ApexConfig;
  let mockTransports: Map<string, MockMCPTransport>;
  let mockClients: Map<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTransports = new Map();
    mockClients = new Map();

    // Setup mock configuration
    mockConfig = {
      project: { name: 'mock-test-project', version: '1.0.0' },
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
            name: 'Filesystem Server',
            type: 'stdio',
            command: 'mock-filesystem-server',
            args: ['--root', '/workspace']
          },
          database: {
            name: 'Database Server',
            type: 'stdio',
            command: 'mock-database-server',
            args: ['--db', 'test.db']
          },
          utilities: {
            name: 'Utilities Server',
            type: 'stdio',
            command: 'mock-utilities-server'
          }
        } as Record<string, MCPServerConfig>,
        connection: {
          maxRetries: 3,
          retryDelayMs: 100,
          connectionTimeoutMs: 1000,
          autoReconnect: true,
          healthCheckIntervalMs: 5000
        }
      },
      autonomy: { level: 'manual' as const },
      agents: {},
      workflows: {}
    };

    // Setup mock transport factory
    (StdioTransport as any).mockImplementation((options: any) => {
      const serverId = options.command.replace('mock-', '').replace('-server', '');
      const serverConfig = MOCK_SERVERS[serverId as keyof typeof MOCK_SERVERS];
      const transport = new MockMCPTransport({ tools: serverConfig?.tools });
      mockTransports.set(serverId, transport);
      return transport;
    });

    // Setup mock client factory
    (MCPClient as any).mockImplementation(({ transport }: any) => {
      const client = {
        connect: vi.fn().mockImplementation(() => transport.connect()),
        disconnect: vi.fn().mockImplementation(() => transport.disconnect()),
        listTools: vi.fn().mockImplementation(() => transport.request('tools/list', {})),
        callTool: vi.fn().mockImplementation((name: string, args: any) =>
          transport.request('tools/call', { name, arguments: args })
        ),
        ping: vi.fn().mockImplementation(() => transport.request('ping', {})),
        on: vi.fn(),
        off: vi.fn()
      };

      // Store client reference based on transport
      const serverId = Array.from(mockTransports.entries())
        .find(([, t]) => t === transport)?.[0];
      if (serverId) {
        mockClients.set(serverId, client);
      }

      return client;
    });

    // Create instances
    connectionManager = new MCPConnectionManager({
      projectPath: '/mock/project',
      config: mockConfig
    });

    toolRegistry = new MCPToolRegistry({
      autoRefresh: false,
      operationTimeoutMs: 2000
    });

    toolRegistry.setConnectionManager(connectionManager);
  });

  afterEach(async () => {
    await connectionManager.disconnectAll();
    toolRegistry.shutdown();
    mockTransports.clear();
    mockClients.clear();
  });

  describe('🔗 Mock Server Connection', () => {
    it('should connect to multiple mock MCP servers', async () => {
      const connectedSpy = vi.fn();
      connectionManager.on('connected', connectedSpy);

      // Connect to all mock servers
      const connections = await Promise.all([
        connectionManager.connect('filesystem'),
        connectionManager.connect('database'),
        connectionManager.connect('utilities')
      ]);

      expect(connections).toHaveLength(3);
      expect(connectedSpy).toHaveBeenCalledTimes(3);

      // Verify all connections are active
      const activeConnections = connectionManager.listConnections();
      expect(activeConnections).toHaveLength(3);
      expect(activeConnections.every(conn => conn.state === 'connected')).toBe(true);
    });

    it('should handle connection failures gracefully', async () => {
      // Mock a server that fails to connect
      const failingTransport = new MockMCPTransport({ simulateErrors: true });
      mockTransports.set('failing', failingTransport);

      (StdioTransport as any).mockImplementationOnce(() => failingTransport);

      const errorSpy = vi.fn();
      connectionManager.on('error', errorSpy);

      await expect(connectionManager.connect('utilities'))
        .rejects.toThrow('Mock connection failure');

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should discover tools from connected mock servers', async () => {
      await connectionManager.connect('filesystem');
      await toolRegistry.addConnection(connectionManager.getConnection('filesystem')!);

      const tools = toolRegistry.getToolsByConnection('filesystem');
      expect(tools).toHaveLength(2);

      const toolNames = tools.map(t => t.mcpTool.name);
      expect(toolNames).toContain('file-read');
      expect(toolNames).toContain('file-write');
    });
  });

  describe('🛠️ Mock Tool Invocation', () => {
    beforeEach(async () => {
      await connectionManager.connect('filesystem');
      await connectionManager.connect('database');
      await connectionManager.connect('utilities');

      // Register tools
      for (const serverId of ['filesystem', 'database', 'utilities']) {
        const connection = connectionManager.getConnection(serverId)!;
        await toolRegistry.addConnection(connection);
      }
    });

    it('should execute mock tools successfully', async () => {
      const toolCompleteSpy = vi.fn();
      connectionManager.on('tool:complete', toolCompleteSpy);

      // Test file read
      const fileReadResult = await connectionManager.executeTool(
        'filesystem',
        'file-read',
        { path: '/test/file.txt' }
      );

      expect(fileReadResult).toEqual({
        content: 'Mock file content for /test/file.txt',
        size: 42,
        lastModified: expect.any(String)
      });

      // Test database query
      const dbQueryResult = await connectionManager.executeTool(
        'database',
        'database-query',
        { query: 'SELECT * FROM users' }
      );

      expect(dbQueryResult).toEqual({
        rows: [
          { id: 1, name: 'Mock Record 1' },
          { id: 2, name: 'Mock Record 2' }
        ],
        count: 2
      });

      expect(toolCompleteSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle tool execution errors', async () => {
      const toolErrorSpy = vi.fn();
      connectionManager.on('tool:error', toolErrorSpy);

      // Test tool with missing parameters
      await expect(connectionManager.executeTool(
        'filesystem',
        'file-read',
        {} // Missing required 'path' parameter
      )).rejects.toThrow('Missing required parameter: path');

      // Test destructive database operation
      await expect(connectionManager.executeTool(
        'database',
        'database-query',
        { query: 'DROP TABLE users' }
      )).rejects.toThrow('Destructive queries not allowed');

      // Test tool that always fails
      await expect(connectionManager.executeTool(
        'utilities',
        'failing-tool',
        {}
      )).rejects.toThrow('This tool always fails');

      expect(toolErrorSpy).toHaveBeenCalledTimes(3);
    });

    it('should handle slow tool operations', async () => {
      const startTime = Date.now();

      const result = await connectionManager.executeTool(
        'utilities',
        'slow-operation',
        { delay: 100 }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result).toEqual({
        result: 'Operation completed after delay'
      });

      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it('should validate tool schemas', () => {
      const fileReadTool = toolRegistry.getTool('file-read');
      expect(fileReadTool).toBeDefined();
      expect(fileReadTool!.mcpTool.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          path: { type: 'string' }
        },
        required: ['path']
      });

      const dbQueryTool = toolRegistry.getTool('database-query');
      expect(dbQueryTool).toBeDefined();
      expect(dbQueryTool!.mcpTool.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          query: { type: 'string' },
          params: { type: 'array' }
        },
        required: ['query']
      });
    });
  });

  describe('🔄 Connection Resilience', () => {
    beforeEach(async () => {
      await connectionManager.connect('filesystem');
    });

    it('should handle unexpected disconnections', async () => {
      const disconnectedSpy = vi.fn();
      connectionManager.on('disconnected', disconnectedSpy);

      // Simulate network disconnection
      const transport = mockTransports.get('filesystem')!;
      transport.simulateDisconnection();

      expect(disconnectedSpy).toHaveBeenCalledWith('filesystem', 'Network error');
    });

    it('should handle transport errors', async () => {
      const errorSpy = vi.fn();
      connectionManager.on('error', errorSpy);

      // Simulate transport error
      const transport = mockTransports.get('filesystem')!;
      transport.simulateError();

      expect(errorSpy).toHaveBeenCalledWith(
        'filesystem',
        expect.any(Error)
      );
    });

    it('should update tool availability based on connection state', async () => {
      await toolRegistry.addConnection(connectionManager.getConnection('filesystem')!);

      // Initially available
      expect(toolRegistry.isToolAvailable('file-read')).toBe(true);

      // Simulate disconnection
      const transport = mockTransports.get('filesystem')!;
      transport.simulateDisconnection();

      // Update registry state
      toolRegistry.updateConnectionState('filesystem', 'disconnected');

      // Should no longer be available
      expect(toolRegistry.isToolAvailable('file-read')).toBe(false);
    });
  });

  describe('📊 Integration Statistics', () => {
    beforeEach(async () => {
      // Connect to all servers and register tools
      for (const serverId of ['filesystem', 'database', 'utilities']) {
        await connectionManager.connect(serverId);
        const connection = connectionManager.getConnection(serverId)!;
        await toolRegistry.addConnection(connection);
      }
    });

    it('should provide comprehensive registry statistics', () => {
      const stats = toolRegistry.getStats();

      expect(stats).toMatchObject({
        totalTools: 4, // 2 filesystem + 1 database + 1 utilities
        availableTools: 4,
        activeConnections: 3,
        toolsByConnection: {
          filesystem: 2,
          database: 1,
          utilities: 2
        }
      });
    });

    it('should track connection metrics', async () => {
      // Execute some tools to generate metrics
      await connectionManager.executeTool('filesystem', 'file-read', { path: '/test.txt' });
      await connectionManager.executeTool('database', 'database-query', { query: 'SELECT 1' });

      const fsMetrics = connectionManager.getMetrics('filesystem');
      const dbMetrics = connectionManager.getMetrics('database');

      expect(fsMetrics).toMatchObject({
        totalConnections: 1,
        totalRequests: 1,
        totalErrors: 0
      });

      expect(dbMetrics).toMatchObject({
        totalConnections: 1,
        totalRequests: 1,
        totalErrors: 0
      });
    });

    it('should track health check results', async () => {
      const healthCheckSpy = vi.fn();
      connectionManager.on('healthCheck', healthCheckSpy);

      await connectionManager.checkHealth('filesystem');

      expect(healthCheckSpy).toHaveBeenCalledWith(
        'filesystem',
        expect.objectContaining({
          success: true,
          isHealthy: true,
          consecutiveFailures: 0
        })
      );
    });
  });

  describe('🧪 End-to-End Workflow', () => {
    it('should execute a complete mock workflow', async () => {
      // Step 1: Connect to servers
      await connectionManager.connect('filesystem');
      await connectionManager.connect('database');

      // Step 2: Discover and register tools
      for (const serverId of ['filesystem', 'database']) {
        const connection = connectionManager.getConnection(serverId)!;
        await toolRegistry.addConnection(connection);
      }

      // Step 3: Verify tools are available
      expect(toolRegistry.isToolAvailable('file-read')).toBe(true);
      expect(toolRegistry.isToolAvailable('database-query')).toBe(true);

      // Step 4: Execute a workflow sequence
      const results = [];

      // Read configuration
      results.push(await connectionManager.executeTool(
        'filesystem',
        'file-read',
        { path: '/config/app.json' }
      ));

      // Query database
      results.push(await connectionManager.executeTool(
        'database',
        'database-query',
        { query: 'SELECT version FROM migrations ORDER BY id DESC LIMIT 1' }
      ));

      // Write results
      results.push(await connectionManager.executeTool(
        'filesystem',
        'file-write',
        {
          path: '/output/workflow-results.json',
          content: JSON.stringify(results)
        }
      ));

      // Verify all operations succeeded
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
      });

      // Verify metrics were updated
      const fsMetrics = connectionManager.getMetrics('filesystem');
      const dbMetrics = connectionManager.getMetrics('database');

      expect(fsMetrics?.totalRequests).toBe(2); // read + write
      expect(dbMetrics?.totalRequests).toBe(1); // query
    });

    it('should handle partial failures in workflows', async () => {
      await connectionManager.connect('filesystem');
      await connectionManager.connect('utilities');

      // Step 1: Successful operation
      const readResult = await connectionManager.executeTool(
        'filesystem',
        'file-read',
        { path: '/config.txt' }
      );

      expect(readResult).toBeDefined();

      // Step 2: Failing operation
      await expect(connectionManager.executeTool(
        'utilities',
        'failing-tool',
        {}
      )).rejects.toThrow('This tool always fails');

      // Step 3: Recovery with another successful operation
      const writeResult = await connectionManager.executeTool(
        'filesystem',
        'file-write',
        { path: '/error-log.txt', content: 'Workflow partially failed' }
      );

      expect(writeResult).toBeDefined();

      // Verify metrics track both successes and failures
      const metrics = connectionManager.getMetrics('filesystem');
      expect(metrics?.totalRequests).toBe(2);
      expect(metrics?.totalErrors).toBe(0);

      const utilMetrics = connectionManager.getMetrics('utilities');
      expect(utilMetrics?.totalRequests).toBe(1);
      expect(utilMetrics?.totalErrors).toBe(1);
    });
  });
});