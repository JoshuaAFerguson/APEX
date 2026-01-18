/**
 * Comprehensive Mock MCP Server Utilities
 *
 * This module provides reusable mock MCP servers and utilities for testing
 * MCP integration scenarios across the APEX codebase.
 */

import { EventEmitter } from 'eventemitter3';
import type { MCPConnection, MCPConnectionState, MCPServerConfig } from '@apexcli/core';
import type { MCPToolDefinition } from '../../mcp/client.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface MockServerBehavior {
  /** Connection establishment latency in ms */
  connectionLatency?: number;
  /** Request processing latency in ms */
  requestLatency?: number;
  /** Probability of random errors (0-1) */
  errorRate?: number;
  /** Disconnect after N requests */
  disconnectAfter?: number;
  /** Maximum concurrent requests */
  maxConcurrent?: number;
  /** Simulate connection failures */
  simulateConnectionFailure?: boolean;
  /** Tool discovery latency */
  toolDiscoveryLatency?: number;
  /** Memory usage simulation */
  memoryUsage?: number;
}

export interface MockServerConfig {
  id: string;
  name: string;
  tools: MCPToolDefinition[];
  behavior: MockServerBehavior;
  metadata?: Record<string, any>;
}

export interface MockServerStats {
  requestCount: number;
  errorCount: number;
  connectionCount: number;
  disconnectionCount: number;
  averageLatency: number;
  uptime: number;
  activeRequests: number;
}

export interface ToolExecutionContext {
  toolName: string;
  args: Record<string, unknown>;
  serverId: string;
  requestId: string;
  startTime: number;
}

// ============================================================================
// Mock MCP Server Implementation
// ============================================================================

export class MockMCPServer extends EventEmitter {
  private connected = false;
  private requestCount = 0;
  private errorCount = 0;
  private connectionCount = 0;
  private disconnectionCount = 0;
  private activeRequests = 0;
  private connectionTime?: number;
  private latencyHistory: number[] = [];

  constructor(private config: MockServerConfig) {
    super();
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  async connect(): Promise<void> {
    if (this.config.behavior.simulateConnectionFailure) {
      this.errorCount++;
      throw new Error(`Mock connection failure for ${this.config.id}`);
    }

    await this.delay(this.config.behavior.connectionLatency || 0);

    this.connected = true;
    this.connectionTime = Date.now();
    this.connectionCount++;

    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.disconnectionCount++;
    this.emit('disconnected', 'Manual disconnect');
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ==========================================================================
  // Request Processing
  // ==========================================================================

  async request(method: string, params: any = {}): Promise<any> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    if (!this.connected) {
      throw new Error(`Server ${this.config.id} not connected`);
    }

    // Check concurrent request limits
    if (this.config.behavior.maxConcurrent &&
        this.activeRequests >= this.config.behavior.maxConcurrent) {
      this.errorCount++;
      throw new Error(`Server busy - too many concurrent requests (${this.activeRequests}/${this.config.behavior.maxConcurrent})`);
    }

    this.activeRequests++;
    this.requestCount++;

    try {
      // Simulate disconnection after certain requests
      if (this.config.behavior.disconnectAfter &&
          this.requestCount >= this.config.behavior.disconnectAfter) {
        this.connected = false;
        this.disconnectionCount++;
        this.emit('disconnected', 'Connection lost');
        throw new Error('Connection lost during request');
      }

      // Simulate random errors
      if (this.config.behavior.errorRate &&
          Math.random() < this.config.behavior.errorRate) {
        this.errorCount++;
        throw new Error(`Random server error on request ${this.requestCount}`);
      }

      await this.delay(this.config.behavior.requestLatency || 0);

      let result: any;
      switch (method) {
        case 'tools/list':
          result = await this.handleToolsList();
          break;
        case 'tools/call':
          result = await this.handleToolCall(params.name, params.arguments, requestId);
          break;
        case 'ping':
          result = await this.handlePing();
          break;
        case 'initialize':
          result = await this.handleInitialize(params);
          break;
        case 'resources/list':
          result = await this.handleResourcesList();
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }

      // Track latency
      const latency = Date.now() - startTime;
      this.latencyHistory.push(latency);
      if (this.latencyHistory.length > 100) {
        this.latencyHistory.shift();
      }

      return result;
    } finally {
      this.activeRequests--;
    }
  }

  // ==========================================================================
  // Method Handlers
  // ==========================================================================

  private async handleToolsList(): Promise<{ tools: MCPToolDefinition[] }> {
    await this.delay(this.config.behavior.toolDiscoveryLatency || 0);
    return { tools: [...this.config.tools] };
  }

  private async handleToolCall(toolName: string, args: any, requestId: string): Promise<any> {
    const tool = this.config.tools.find(t => t.name === toolName);
    if (!tool) {
      this.errorCount++;
      throw new Error(`Tool ${toolName} not found on server ${this.config.id}`);
    }

    const context: ToolExecutionContext = {
      toolName,
      args,
      serverId: this.config.id,
      requestId,
      startTime: Date.now()
    };

    this.emit('tool:start', context);

    try {
      const result = await this.executeToolLogic(toolName, args, context);

      this.emit('tool:complete', {
        ...context,
        result,
        duration: Date.now() - context.startTime
      });

      return result;
    } catch (error) {
      this.errorCount++;
      this.emit('tool:error', {
        ...context,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - context.startTime
      });
      throw error;
    }
  }

  private async handlePing(): Promise<{ result: string }> {
    return { result: 'pong' };
  }

  private async handleInitialize(params: any): Promise<any> {
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true }
      },
      serverInfo: {
        name: this.config.name,
        version: '1.0.0'
      }
    };
  }

  private async handleResourcesList(): Promise<any> {
    return {
      resources: [
        {
          uri: `mock://${this.config.id}/resource1`,
          name: 'Test Resource 1',
          mimeType: 'text/plain'
        }
      ]
    };
  }

  // ==========================================================================
  // Tool Execution Logic
  // ==========================================================================

  private async executeToolLogic(toolName: string, args: any, context: ToolExecutionContext): Promise<any> {
    // Built-in tool behaviors
    switch (toolName) {
      case 'file-system-scan':
        return this.simulateFilesystemScan(args);

      case 'file-read':
        return this.simulateFileRead(args);

      case 'file-write':
        return this.simulateFileWrite(args);

      case 'database-backup':
        return this.simulateDatabaseBackup(args);

      case 'database-query':
        return this.simulateDatabaseQuery(args);

      case 'api-health-check':
        return this.simulateApiHealthCheck(args);

      case 'system-metrics':
        return this.simulateSystemMetrics(args);

      case 'log-analysis':
        return this.simulateLogAnalysis(args);

      case 'slow-operation':
        return this.simulateSlowOperation(args);

      case 'error-tool':
        throw new Error('This tool is designed to always fail');

      case 'timeout-tool':
        await this.delay(30000); // Very long delay
        return { result: 'Should have timed out' };

      case 'memory-intensive':
        return this.simulateMemoryIntensiveOperation(args);

      default:
        return {
          result: `Mock result for ${toolName}`,
          args,
          serverId: this.config.id,
          timestamp: new Date().toISOString()
        };
    }
  }

  // ==========================================================================
  // Simulation Methods
  // ==========================================================================

  private async simulateFilesystemScan(args: any): Promise<any> {
    const { path, maxFiles = 10, pattern } = args;

    if (!path) {
      throw new Error('Missing required parameter: path');
    }

    await this.delay(50); // Simulate scan time

    const files = Array.from({ length: Math.min(maxFiles, 100) }, (_, i) => ({
      path: `${path}/file-${i}.txt`,
      size: Math.floor(Math.random() * 100000),
      modified: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      type: 'file',
      permissions: 'rw-r--r--'
    }));

    return {
      path,
      files: pattern ? files.filter(f => f.path.includes(pattern)) : files,
      totalFound: files.length,
      scanDuration: '0.05s'
    };
  }

  private async simulateFileRead(args: any): Promise<any> {
    const { path } = args;

    if (!path) {
      throw new Error('Missing required parameter: path');
    }

    await this.delay(25);

    return {
      content: `Mock file content for ${path}\nLine 2\nLine 3`,
      size: 42,
      encoding: 'utf8',
      lastModified: new Date().toISOString()
    };
  }

  private async simulateFileWrite(args: any): Promise<any> {
    const { path, content } = args;

    if (!path || content === undefined) {
      throw new Error('Missing required parameters: path, content');
    }

    await this.delay(30);

    return {
      path,
      bytesWritten: content.length,
      success: true
    };
  }

  private async simulateDatabaseBackup(args: any): Promise<any> {
    const { database, compression = true } = args;

    if (!database) {
      throw new Error('Missing required parameter: database');
    }

    await this.delay(200); // Simulate backup time

    return {
      backupId: `backup-${Date.now()}`,
      database,
      size: compression ? '150MB' : '300MB',
      compression,
      duration: '2.1s',
      location: `/backups/${database}-${Date.now()}.sql${compression ? '.gz' : ''}`
    };
  }

  private async simulateDatabaseQuery(args: any): Promise<any> {
    const { query, params = [] } = args;

    if (!query) {
      throw new Error('Missing required parameter: query');
    }

    if (query.toUpperCase().includes('DROP')) {
      throw new Error('Destructive operations not allowed in mock mode');
    }

    await this.delay(100);

    const rowCount = Math.floor(Math.random() * 100) + 1;
    const rows = Array.from({ length: rowCount }, (_, i) => ({
      id: i + 1,
      name: `Record ${i + 1}`,
      value: Math.floor(Math.random() * 1000)
    }));

    return {
      query,
      rows,
      rowCount,
      executionTime: '0.1s'
    };
  }

  private async simulateApiHealthCheck(args: any): Promise<any> {
    const { services = ['auth', 'database', 'cache'], timeout = 5000 } = args;

    await this.delay(Math.min(timeout / 10, 100));

    const serviceResults = services.map((service: string) => ({
      name: service,
      status: Math.random() > 0.1 ? 'healthy' : 'degraded',
      latency: Math.floor(Math.random() * 200) + 'ms',
      lastCheck: new Date().toISOString()
    }));

    const overallStatus = serviceResults.every(s => s.status === 'healthy') ? 'healthy' : 'degraded';

    return {
      overall: overallStatus,
      services: serviceResults,
      checkDuration: '0.05s'
    };
  }

  private async simulateSystemMetrics(args: any): Promise<any> {
    const { interval = 1, metrics = ['cpu', 'memory', 'disk'] } = args;

    await this.delay(50);

    const result: any = {
      timestamp: new Date().toISOString(),
      interval
    };

    if (metrics.includes('cpu')) {
      result.cpu = {
        usage: Math.random() * 100,
        cores: 8,
        loadAverage: [Math.random() * 2, Math.random() * 2, Math.random() * 2]
      };
    }

    if (metrics.includes('memory')) {
      const total = 16 * 1024 * 1024 * 1024; // 16GB
      const used = Math.random() * total;
      result.memory = {
        total,
        used,
        free: total - used,
        usage: (used / total) * 100
      };
    }

    if (metrics.includes('disk')) {
      result.disk = {
        usage: Math.random() * 100,
        total: '1TB',
        used: '500GB',
        free: '500GB'
      };
    }

    if (metrics.includes('network')) {
      result.network = {
        rx: Math.floor(Math.random() * 1000) + 'MB',
        tx: Math.floor(Math.random() * 500) + 'MB',
        connections: Math.floor(Math.random() * 1000)
      };
    }

    return result;
  }

  private async simulateLogAnalysis(args: any): Promise<any> {
    const { logFile, timeRange, level = 'info' } = args;

    if (!logFile) {
      throw new Error('Missing required parameter: logFile');
    }

    await this.delay(150);

    return {
      logFile,
      timeRange,
      level,
      summary: {
        totalLines: Math.floor(Math.random() * 10000) + 1000,
        errors: Math.floor(Math.random() * 50),
        warnings: Math.floor(Math.random() * 200),
        info: Math.floor(Math.random() * 5000)
      },
      patterns: [
        { pattern: 'ERROR.*timeout', count: Math.floor(Math.random() * 20) },
        { pattern: 'WARN.*retry', count: Math.floor(Math.random() * 50) },
        { pattern: 'INFO.*request', count: Math.floor(Math.random() * 1000) }
      ],
      topErrors: [
        'Connection timeout',
        'Database unavailable',
        'Invalid request format'
      ]
    };
  }

  private async simulateSlowOperation(args: any): Promise<any> {
    const { delay = 1000 } = args;
    await this.delay(delay);
    return {
      result: 'Operation completed',
      delay,
      completedAt: new Date().toISOString()
    };
  }

  private async simulateMemoryIntensiveOperation(args: any): Promise<any> {
    const { size = 1000 } = args;

    // Simulate memory usage
    const memoryUsed = this.config.behavior.memoryUsage || 0;
    if (memoryUsed > 100) {
      throw new Error('Server memory exhausted');
    }

    await this.delay(size / 10);

    return {
      result: 'Memory operation completed',
      memoryUsed: size + 'MB',
      duration: `${size / 10}ms`
    };
  }

  // ==========================================================================
  // Server Management
  // ==========================================================================

  addTool(tool: MCPToolDefinition): void {
    this.config.tools.push(tool);
    this.emit('tools:changed');
  }

  removeTool(name: string): void {
    const index = this.config.tools.findIndex(t => t.name === name);
    if (index >= 0) {
      this.config.tools.splice(index, 1);
      this.emit('tools:changed');
    }
  }

  updateTool(name: string, updates: Partial<MCPToolDefinition>): void {
    const tool = this.config.tools.find(t => t.name === name);
    if (tool) {
      Object.assign(tool, updates);
      this.emit('tools:changed');
    }
  }

  updateBehavior(updates: Partial<MockServerBehavior>): void {
    Object.assign(this.config.behavior, updates);
  }

  getStats(): MockServerStats {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      connectionCount: this.connectionCount,
      disconnectionCount: this.disconnectionCount,
      averageLatency: this.latencyHistory.length > 0
        ? this.latencyHistory.reduce((sum, lat) => sum + lat, 0) / this.latencyHistory.length
        : 0,
      uptime: this.connectionTime ? Date.now() - this.connectionTime : 0,
      activeRequests: this.activeRequests
    };
  }

  reset(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.connectionCount = 0;
    this.disconnectionCount = 0;
    this.activeRequests = 0;
    this.latencyHistory = [];
    this.connectionTime = undefined;
    this.connected = false;
  }

  // ==========================================================================
  // Test Utilities
  // ==========================================================================

  simulateDisconnection(): void {
    if (this.connected) {
      this.connected = false;
      this.disconnectionCount++;
      this.emit('disconnected', 'Network error');
    }
  }

  simulateError(): void {
    this.emit('error', new Error('Simulated server error'));
  }

  simulateToolsChanged(): void {
    this.emit('tools:changed');
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Predefined Server Configurations
// ============================================================================

export const PREDEFINED_SERVERS: Record<string, Omit<MockServerConfig, 'id'>> = {
  filesystem: {
    name: 'File System Server',
    tools: [
      {
        name: 'file-system-scan',
        description: 'Scan filesystem for files',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to scan' },
            maxFiles: { type: 'number', minimum: 1, maximum: 1000 },
            pattern: { type: 'string', description: 'File pattern to match' }
          },
          required: ['path']
        }
      },
      {
        name: 'file-read',
        description: 'Read file contents',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to file' },
            encoding: { type: 'string', enum: ['utf8', 'binary'], default: 'utf8' }
          },
          required: ['path']
        }
      },
      {
        name: 'file-write',
        description: 'Write content to file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to file' },
            content: { type: 'string', description: 'Content to write' },
            mode: { type: 'string', enum: ['overwrite', 'append'], default: 'overwrite' }
          },
          required: ['path', 'content']
        }
      }
    ],
    behavior: {
      connectionLatency: 50,
      requestLatency: 25
    }
  },

  database: {
    name: 'Database Server',
    tools: [
      {
        name: 'database-backup',
        description: 'Create database backup',
        inputSchema: {
          type: 'object',
          properties: {
            database: { type: 'string', description: 'Database name' },
            compression: { type: 'boolean', default: true }
          },
          required: ['database']
        }
      },
      {
        name: 'database-query',
        description: 'Execute database query',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'SQL query' },
            params: { type: 'array', items: { type: 'string' } },
            timeout: { type: 'number', minimum: 1000, maximum: 30000 }
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
    name: 'System Monitoring Server',
    tools: [
      {
        name: 'system-metrics',
        description: 'Get system performance metrics',
        inputSchema: {
          type: 'object',
          properties: {
            interval: { type: 'number', minimum: 1, maximum: 3600 },
            metrics: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['cpu', 'memory', 'disk', 'network']
              }
            }
          }
        }
      },
      {
        name: 'log-analysis',
        description: 'Analyze system logs',
        inputSchema: {
          type: 'object',
          properties: {
            logFile: { type: 'string', description: 'Path to log file' },
            timeRange: { type: 'string', description: 'Time range to analyze' },
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
  },

  utilities: {
    name: 'Utilities Server',
    tools: [
      {
        name: 'slow-operation',
        description: 'A slow operation for testing timeouts',
        inputSchema: {
          type: 'object',
          properties: {
            delay: { type: 'number', minimum: 0, maximum: 60000 }
          }
        }
      },
      {
        name: 'error-tool',
        description: 'A tool that always fails',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'timeout-tool',
        description: 'A tool that times out',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'memory-intensive',
        description: 'Memory intensive operation',
        inputSchema: {
          type: 'object',
          properties: {
            size: { type: 'number', minimum: 1, maximum: 1000 }
          }
        }
      }
    ],
    behavior: {
      connectionLatency: 10,
      requestLatency: 20
    }
  }
};

// ============================================================================
// Factory Functions
// ============================================================================

export function createMockServer(
  id: string,
  preset?: keyof typeof PREDEFINED_SERVERS,
  overrides?: Partial<MockServerConfig>
): MockMCPServer {
  let config: MockServerConfig;

  if (preset && PREDEFINED_SERVERS[preset]) {
    config = {
      id,
      ...PREDEFINED_SERVERS[preset],
      ...overrides
    };
  } else {
    config = {
      id,
      name: `Mock Server ${id}`,
      tools: [],
      behavior: {},
      ...overrides
    };
  }

  return new MockMCPServer(config);
}

export function createMockConnection(
  serverId: string,
  state: MCPConnectionState = 'connected',
  serverName?: string,
  config?: Partial<MCPServerConfig>
): MCPConnection {
  return {
    serverId,
    serverName: serverName || `Server ${serverId}`,
    state,
    config: {
      name: serverId,
      command: 'mock-command',
      args: [],
      env: {},
      ...config
    },
    connectedAt: state === 'connected' ? new Date() : undefined,
    lastHeartbeat: state === 'connected' ? new Date() : undefined,
    heartbeatInterval: 30000,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
  };
}

export function createMockClient(server: MockMCPServer): any {
  return {
    connect: () => server.connect(),
    disconnect: () => server.disconnect(),
    listTools: async () => {
      const result = await server.request('tools/list');
      return result.tools;
    },
    callTool: (name: string, args: any) =>
      server.request('tools/call', { name, arguments: args }),
    ping: () => server.request('ping'),
    on: (event: string, handler: Function) => server.on(event, handler),
    off: (event: string, handler: Function) => server.off(event, handler),
    server
  };
}

// ============================================================================
// Test Scenario Builders
// ============================================================================

export class MockScenarioBuilder {
  private servers: Map<string, MockMCPServer> = new Map();

  addServer(id: string, preset?: keyof typeof PREDEFINED_SERVERS, overrides?: Partial<MockServerConfig>): this {
    const server = createMockServer(id, preset, overrides);
    this.servers.set(id, server);
    return this;
  }

  withUnreliableServer(id: string, errorRate: number = 0.3): this {
    const server = this.servers.get(id);
    if (server) {
      server.updateBehavior({ errorRate });
    }
    return this;
  }

  withSlowServer(id: string, latency: number = 1000): this {
    const server = this.servers.get(id);
    if (server) {
      server.updateBehavior({ requestLatency: latency });
    }
    return this;
  }

  withLimitedConcurrency(id: string, maxConcurrent: number = 2): this {
    const server = this.servers.get(id);
    if (server) {
      server.updateBehavior({ maxConcurrent });
    }
    return this;
  }

  withDisconnectionAfter(id: string, requestCount: number): this {
    const server = this.servers.get(id);
    if (server) {
      server.updateBehavior({ disconnectAfter: requestCount });
    }
    return this;
  }

  build(): Map<string, MockMCPServer> {
    return new Map(this.servers);
  }
}

export function createTestScenario(): MockScenarioBuilder {
  return new MockScenarioBuilder();
}