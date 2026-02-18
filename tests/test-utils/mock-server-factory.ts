/**
 * @fileoverview Enhanced Mock Server Factory for MCP Testing
 *
 * Provides comprehensive mock server creation for various testing scenarios
 * including edge cases, error conditions, and performance testing.
 *
 * ## Features
 *
 * - **Scenario-based mocks**: Pre-configured mocks for common test scenarios
 * - **Error injection**: Configurable failures for testing error handling
 * - **Performance simulation**: Simulate slow, fast, and timeout scenarios
 * - **Lifecycle management**: Advanced startup, shutdown, and restart behaviors
 * - **Request recording**: Detailed request/response recording for assertions
 * - **Realistic responses**: Generate realistic MCP protocol responses
 *
 * ## Usage
 *
 * ```typescript
 * import { mockServerFactory } from '@test/mock-server-factory';
 *
 * // Create a standard mock server
 * const server = mockServerFactory.createFileSystemServer();
 *
 * // Create a server with specific behavior
 * const slowServer = mockServerFactory.createSlowServer(MEMORY_SERVER, 2000);
 *
 * // Create a failing server
 * const failingServer = mockServerFactory.createFailingServer(
 *   GITHUB_SERVER,
 *   'Authentication failed'
 * );
 *
 * // Create a custom scenario
 * const customServer = mockServerFactory.createCustomServer({
 *   entry: POSTGRES_SERVER,
 *   behavior: { errorProbability: 0.2, startupDelayMs: 500 }
 * });
 * ```
 *
 * @module tests/test-utils/mock-server-factory
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface MockServerEntry {
  name: string;
  description: string;
  version: string;
  author?: string;
  verified?: boolean;
  category?: string;
  capabilities?: string[];
  serverConfig: MockServerConfig;
  tags?: string[];
}

export interface MockServerConfig {
  name: string;
  type?: 'stdio' | 'http' | 'sse' | 'sdk';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  autoStart?: boolean;
  capabilities?: string[];
}

export interface MockServerBehavior {
  /** Startup delay in milliseconds */
  startupDelayMs?: number;
  /** Request processing delay in milliseconds */
  requestDelayMs?: number;
  /** Probability of random failures (0-1) */
  errorProbability?: number;
  /** Should server fail on startup */
  failOnStart?: boolean;
  /** Custom startup error message */
  startupErrorMessage?: string;
  /** Maximum concurrent requests */
  maxConcurrentRequests?: number;
  /** Memory limit before failing */
  memoryLimitMB?: number;
  /** Request count before disconnecting */
  disconnectAfterRequests?: number;
  /** Should server support health checks */
  supportsHealthCheck?: boolean;
  /** Custom response generators */
  customResponses?: Record<string, (args: any) => any>;
}

export interface MockServerStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  peakMemoryUsage: number;
  uptime: number;
  connectionCount: number;
  isRunning: boolean;
  lastError?: string;
}

export interface MockTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  handler?: (args: Record<string, any>) => any;
}

export interface MockServerOptions {
  entry: MockServerEntry;
  behavior?: MockServerBehavior;
  tools?: MockTool[];
}

export type MockServerState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'crashed';

export interface RecordedRequest {
  id: string;
  method: string;
  params: any;
  timestamp: number;
  responseTime: number;
  success: boolean;
  error?: string;
  memoryUsage?: number;
}

// ============================================================================
// Enhanced Mock Server Implementation
// ============================================================================

export class EnhancedMockServer extends EventEmitter {
  private state: MockServerState = 'stopped';
  private stats: MockServerStats;
  private requests: RecordedRequest[] = [];
  private tools: MockTool[] = [];
  private startTime?: number;
  private memoryUsage = 0;
  private requestCount = 0;
  private connectionId = 0;

  readonly entry: MockServerEntry;
  readonly behavior: Required<MockServerBehavior>;

  constructor(options: MockServerOptions) {
    super();
    this.entry = options.entry;
    this.behavior = this.normalizedBehavior(options.behavior);
    this.tools = options.tools || this.generateDefaultTools();

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      peakMemoryUsage: 0,
      uptime: 0,
      connectionCount: 0,
      isRunning: false,
    };

    this.setupEventHandlers();
  }

  // ==========================================================================
  // Lifecycle Management
  // ==========================================================================

  async start(): Promise<void> {
    if (this.state === 'running') {
      return;
    }

    this.setState('starting');
    await this.delay(this.behavior.startupDelayMs);

    if (this.behavior.failOnStart) {
      this.setState('error');
      const error = new Error(this.behavior.startupErrorMessage);
      this.emit('error', error);
      throw error;
    }

    this.setState('running');
    this.startTime = Date.now();
    this.stats.connectionCount++;
    this.connectionId = Date.now();
    this.emit('started', { connectionId: this.connectionId });
  }

  async stop(): Promise<void> {
    if (this.state === 'stopped') {
      return;
    }

    this.setState('stopping');
    await this.delay(10);

    this.setState('stopped');
    this.startTime = undefined;
    this.emit('stopped', { connectionId: this.connectionId });
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  crash(reason: string): void {
    this.setState('crashed');
    this.stats.lastError = reason;
    this.emit('crashed', { reason, connectionId: this.connectionId });
  }

  getState(): MockServerState {
    return this.state;
  }

  isRunning(): boolean {
    return this.state === 'running';
  }

  // ==========================================================================
  // Tool Operations
  // ==========================================================================

  async listTools(): Promise<MockTool[]> {
    this.ensureRunning();
    await this.simulateRequest('tools/list', {});
    return [...this.tools];
  }

  async callTool(toolName: string, args: Record<string, any> = {}): Promise<{
    content: Array<{ type: string; text: string }>;
    isError: boolean;
  }> {
    this.ensureRunning();
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Check memory limits
      this.checkMemoryLimits();

      // Check request limits
      this.checkRequestLimits();

      // Check random failures
      this.checkRandomFailures();

      // Simulate processing delay
      await this.delay(this.behavior.requestDelayMs);

      // Find tool and execute
      const tool = this.tools.find(t => t.name === toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      const result = this.executeToolHandler(tool, args);
      this.recordSuccessfulRequest(requestId, 'tools/call', { name: toolName, args }, startTime);

      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        isError: false,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.recordFailedRequest(requestId, 'tools/call', { name: toolName, args }, startTime, errorMsg);
      throw error;
    }
  }

  async initialize(): Promise<{
    protocolVersion: string;
    capabilities: Record<string, any>;
    serverInfo: { name: string; version: string };
  }> {
    this.ensureRunning();
    await this.simulateRequest('initialize', {});

    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: false },
        logging: { level: 'info' },
        experimental: this.entry.capabilities || [],
      },
      serverInfo: {
        name: this.entry.name,
        version: this.entry.version,
      },
    };
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: Record<string, any> }> {
    if (!this.behavior.supportsHealthCheck) {
      throw new Error('Health checks not supported');
    }

    const start = Date.now();
    await this.delay(Math.random() * 50); // Simulate health check delay

    const isHealthy = this.state === 'running' && this.memoryUsage < this.behavior.memoryLimitMB;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      details: {
        uptime: this.stats.uptime,
        memoryUsage: this.memoryUsage,
        requestCount: this.stats.totalRequests,
        lastError: this.stats.lastError,
        responseTime: Date.now() - start,
      },
    };
  }

  // ==========================================================================
  // Statistics and Monitoring
  // ==========================================================================

  getStats(): MockServerStats {
    const now = Date.now();
    const responseTimes = this.requests.map(r => r.responseTime).filter(t => t > 0);

    return {
      ...this.stats,
      uptime: this.startTime ? now - this.startTime : 0,
      averageResponseTime: responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0,
      isRunning: this.state === 'running',
      peakMemoryUsage: Math.max(this.stats.peakMemoryUsage, this.memoryUsage),
    };
  }

  getRecordedRequests(): RecordedRequest[] {
    return [...this.requests];
  }

  getRequestsByMethod(method: string): RecordedRequest[] {
    return this.requests.filter(r => r.method === method);
  }

  getFailedRequests(): RecordedRequest[] {
    return this.requests.filter(r => !r.success);
  }

  clearRequests(): void {
    this.requests = [];
  }

  // ==========================================================================
  // Tool Management
  // ==========================================================================

  addTool(tool: MockTool): void {
    this.tools.push(tool);
    this.emit('tools:changed', this.tools);
  }

  removeTool(name: string): boolean {
    const index = this.tools.findIndex(t => t.name === name);
    if (index >= 0) {
      this.tools.splice(index, 1);
      this.emit('tools:changed', this.tools);
      return true;
    }
    return false;
  }

  updateToolHandler(name: string, handler: (args: any) => any): boolean {
    const tool = this.tools.find(t => t.name === name);
    if (tool) {
      tool.handler = handler;
      return true;
    }
    return false;
  }

  // ==========================================================================
  // Private Implementation
  // ==========================================================================

  private normalizedBehavior(behavior?: MockServerBehavior): Required<MockServerBehavior> {
    return {
      startupDelayMs: behavior?.startupDelayMs ?? 50,
      requestDelayMs: behavior?.requestDelayMs ?? 10,
      errorProbability: behavior?.errorProbability ?? 0,
      failOnStart: behavior?.failOnStart ?? false,
      startupErrorMessage: behavior?.startupErrorMessage ?? 'Mock startup failure',
      maxConcurrentRequests: behavior?.maxConcurrentRequests ?? 10,
      memoryLimitMB: behavior?.memoryLimitMB ?? 512,
      disconnectAfterRequests: behavior?.disconnectAfterRequests ?? 0,
      supportsHealthCheck: behavior?.supportsHealthCheck ?? true,
      customResponses: behavior?.customResponses ?? {},
    };
  }

  private setupEventHandlers(): void {
    this.on('request:start', () => {
      this.requestCount++;
      this.memoryUsage += Math.random() * 10; // Simulate memory usage
    });

    this.on('request:end', () => {
      this.memoryUsage = Math.max(0, this.memoryUsage - Math.random() * 5);
    });
  }

  private setState(newState: MockServerState): void {
    const oldState = this.state;
    this.state = newState;
    this.stats.isRunning = newState === 'running';
    this.emit('state:change', { from: oldState, to: newState });
  }

  private ensureRunning(): void {
    if (this.state !== 'running') {
      throw new Error(`Server ${this.entry.name} is not running (state: ${this.state})`);
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async simulateRequest(method: string, params: any): Promise<void> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.emit('request:start', { requestId, method, params });

    await this.delay(this.behavior.requestDelayMs);

    this.recordSuccessfulRequest(requestId, method, params, startTime);
    this.emit('request:end', { requestId, method, success: true });
  }

  private recordSuccessfulRequest(id: string, method: string, params: any, startTime: number): void {
    const request: RecordedRequest = {
      id,
      method,
      params,
      timestamp: startTime,
      responseTime: Date.now() - startTime,
      success: true,
      memoryUsage: this.memoryUsage,
    };

    this.requests.push(request);
    this.stats.totalRequests++;
    this.stats.successfulRequests++;
  }

  private recordFailedRequest(
    id: string,
    method: string,
    params: any,
    startTime: number,
    error: string
  ): void {
    const request: RecordedRequest = {
      id,
      method,
      params,
      timestamp: startTime,
      responseTime: Date.now() - startTime,
      success: false,
      error,
      memoryUsage: this.memoryUsage,
    };

    this.requests.push(request);
    this.stats.totalRequests++;
    this.stats.failedRequests++;
    this.stats.lastError = error;
  }

  private checkMemoryLimits(): void {
    if (this.memoryUsage > this.behavior.memoryLimitMB) {
      throw new Error(`Memory limit exceeded: ${this.memoryUsage}MB > ${this.behavior.memoryLimitMB}MB`);
    }
  }

  private checkRequestLimits(): void {
    if (
      this.behavior.disconnectAfterRequests > 0 &&
      this.stats.totalRequests >= this.behavior.disconnectAfterRequests
    ) {
      this.crash('Request limit reached');
      throw new Error('Connection lost: request limit reached');
    }
  }

  private checkRandomFailures(): void {
    if (this.behavior.errorProbability > 0 && Math.random() < this.behavior.errorProbability) {
      throw new Error('Random error occurred');
    }
  }

  private executeToolHandler(tool: MockTool, args: Record<string, any>): any {
    // Use custom handler if available
    if (tool.handler) {
      return tool.handler(args);
    }

    // Use behavior-specific custom responses
    if (this.behavior.customResponses[tool.name]) {
      return this.behavior.customResponses[tool.name](args);
    }

    // Generate default response based on tool name
    return this.generateDefaultResponse(tool.name, args);
  }

  private generateDefaultResponse(toolName: string, args: Record<string, any>): any {
    const timestamp = new Date().toISOString();

    if (toolName.includes('read') || toolName.includes('get')) {
      return {
        success: true,
        data: `Mock data for ${args.path || args.key || 'unknown'}`,
        timestamp,
      };
    }

    if (toolName.includes('write') || toolName.includes('set') || toolName.includes('create')) {
      return {
        success: true,
        created: args.path || args.key || 'unknown',
        timestamp,
      };
    }

    if (toolName.includes('list') || toolName.includes('search')) {
      return {
        success: true,
        results: [
          { name: 'mock-item-1', type: 'file', size: 1024 },
          { name: 'mock-item-2', type: 'directory' },
        ],
        count: 2,
        timestamp,
      };
    }

    if (toolName.includes('delete') || toolName.includes('remove')) {
      return {
        success: true,
        deleted: args.path || args.target || 'unknown',
        timestamp,
      };
    }

    return {
      success: true,
      result: `Mock execution of ${toolName}`,
      args,
      timestamp,
    };
  }

  private generateDefaultTools(): MockTool[] {
    const capabilities = this.entry.capabilities || [];
    const tools: MockTool[] = [];

    for (const capability of capabilities) {
      const [domain, action] = capability.split(':');
      if (domain && action) {
        tools.push({
          name: `${domain}-${action}`,
          description: `${action} operation for ${domain}`,
          inputSchema: {
            type: 'object',
            properties: {
              target: { type: 'string', description: `Target for ${action}` },
            },
            required: action === 'delete' ? ['target'] : [],
          },
        });
      }
    }

    // Ensure at least one tool exists
    if (tools.length === 0) {
      tools.push({
        name: `${this.entry.name}-info`,
        description: `Get information about ${this.entry.name}`,
        inputSchema: {
          type: 'object',
          properties: {},
        },
      });
    }

    return tools;
  }

  private delay(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Predefined Server Entries
// ============================================================================

export const MOCK_FILESYSTEM_SERVER: MockServerEntry = {
  name: 'filesystem',
  description: 'Mock filesystem server for testing',
  version: '1.0.0',
  author: 'APEX Testing',
  verified: true,
  category: 'filesystem',
  capabilities: ['file:read', 'file:write', 'file:delete', 'directory:list'],
  serverConfig: {
    name: 'filesystem',
    type: 'stdio',
    command: 'mock-filesystem-server',
    autoStart: true,
  },
  tags: ['filesystem', 'files', 'directories'],
};

export const MOCK_MEMORY_SERVER: MockServerEntry = {
  name: 'memory',
  description: 'Mock memory server for testing',
  version: '1.0.0',
  author: 'APEX Testing',
  verified: true,
  category: 'database',
  capabilities: ['memory:get', 'memory:set', 'memory:delete', 'memory:list'],
  serverConfig: {
    name: 'memory',
    type: 'stdio',
    command: 'mock-memory-server',
    autoStart: false,
  },
  tags: ['memory', 'cache', 'storage'],
};

export const MOCK_HTTP_SERVER: MockServerEntry = {
  name: 'http-api',
  description: 'Mock HTTP API server for testing',
  version: '2.0.0',
  author: 'APEX Testing',
  verified: true,
  category: 'web',
  capabilities: ['http:get', 'http:post', 'http:put', 'http:delete'],
  serverConfig: {
    name: 'http-api',
    type: 'http',
    url: 'http://localhost:3000/mcp',
    headers: { 'Content-Type': 'application/json' },
    autoStart: false,
  },
  tags: ['http', 'api', 'web'],
};

// ============================================================================
// Server Factory Functions
// ============================================================================

export const mockServerFactory = {
  /**
   * Create a standard filesystem mock server
   */
  createFileSystemServer(behavior?: MockServerBehavior): EnhancedMockServer {
    return new EnhancedMockServer({
      entry: MOCK_FILESYSTEM_SERVER,
      behavior,
    });
  },

  /**
   * Create a memory mock server
   */
  createMemoryServer(behavior?: MockServerBehavior): EnhancedMockServer {
    return new EnhancedMockServer({
      entry: MOCK_MEMORY_SERVER,
      behavior,
    });
  },

  /**
   * Create an HTTP API mock server
   */
  createHttpServer(behavior?: MockServerBehavior): EnhancedMockServer {
    return new EnhancedMockServer({
      entry: MOCK_HTTP_SERVER,
      behavior,
    });
  },

  /**
   * Create a slow server (for timeout testing)
   */
  createSlowServer(entry: MockServerEntry, delayMs = 2000): EnhancedMockServer {
    return new EnhancedMockServer({
      entry,
      behavior: {
        startupDelayMs: delayMs,
        requestDelayMs: delayMs / 2,
      },
    });
  },

  /**
   * Create a failing server
   */
  createFailingServer(entry: MockServerEntry, errorMessage?: string): EnhancedMockServer {
    return new EnhancedMockServer({
      entry,
      behavior: {
        failOnStart: true,
        startupErrorMessage: errorMessage || 'Mock server startup failed',
      },
    });
  },

  /**
   * Create an unreliable server (random failures)
   */
  createUnreliableServer(entry: MockServerEntry, errorProbability = 0.3): EnhancedMockServer {
    return new EnhancedMockServer({
      entry,
      behavior: {
        errorProbability,
      },
    });
  },

  /**
   * Create a memory-limited server
   */
  createMemoryLimitedServer(entry: MockServerEntry, limitMB = 64): EnhancedMockServer {
    return new EnhancedMockServer({
      entry,
      behavior: {
        memoryLimitMB: limitMB,
      },
    });
  },

  /**
   * Create a server that disconnects after N requests
   */
  createDisconnectingServer(entry: MockServerEntry, requestLimit = 5): EnhancedMockServer {
    return new EnhancedMockServer({
      entry,
      behavior: {
        disconnectAfterRequests: requestLimit,
      },
    });
  },

  /**
   * Create a custom configured server
   */
  createCustomServer(options: MockServerOptions): EnhancedMockServer {
    return new EnhancedMockServer(options);
  },

  /**
   * Create a realistic server with typical behavior
   */
  createRealisticServer(entry: MockServerEntry): EnhancedMockServer {
    return new EnhancedMockServer({
      entry,
      behavior: {
        startupDelayMs: 100 + Math.random() * 200, // 100-300ms startup
        requestDelayMs: 5 + Math.random() * 15,    // 5-20ms requests
        errorProbability: 0.01,                    // 1% random failures
        supportsHealthCheck: true,
      },
    });
  },

  /**
   * Create a performance testing server
   */
  createPerformanceServer(entry: MockServerEntry, scenario: 'fast' | 'slow' | 'variable'): EnhancedMockServer {
    let behavior: MockServerBehavior;

    switch (scenario) {
      case 'fast':
        behavior = {
          startupDelayMs: 10,
          requestDelayMs: 1,
        };
        break;
      case 'slow':
        behavior = {
          startupDelayMs: 1000,
          requestDelayMs: 500,
        };
        break;
      case 'variable':
        behavior = {
          startupDelayMs: Math.random() * 500,
          requestDelayMs: Math.random() * 100,
        };
        break;
    }

    return new EnhancedMockServer({
      entry,
      behavior,
    });
  },
};

// Export main types and classes
export { EnhancedMockServer };
export type {
  MockServerEntry,
  MockServerConfig,
  MockServerBehavior,
  MockServerStats,
  MockTool,
  MockServerOptions,
  MockServerState,
  RecordedRequest,
};