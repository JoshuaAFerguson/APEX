/**
 * @fileoverview Mock MCP Marketplace Server for E2E Tests
 *
 * Provides configurable mock MCP servers that simulate marketplace-discovered
 * server behavior for E2E testing. These mocks support:
 * - Startup/shutdown lifecycle simulation
 * - Tool listing and invocation
 * - Configurable response behaviors (delays, errors)
 * - Request recording for assertions
 * - Health check simulation
 *
 * ## Architecture (ADR-071)
 *
 * This module builds on the existing MockMCPServer patterns from
 * `packages/orchestrator/src/__tests__/utils/mock-mcp-server.ts` while
 * adding marketplace-specific behaviors (install verification, config
 * generation, capability advertisement).
 *
 * @module tests/e2e/mocks/mock-marketplace-server
 */

import { EventEmitter } from 'events';
import type { MarketplaceEntry, ServerConfig } from '../fixtures/marketplace-data.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Configuration for mock marketplace server behavior
 */
export interface MockMarketplaceBehavior {
  /** Simulated startup delay in milliseconds */
  startupDelayMs?: number;
  /** Simulated request processing delay in milliseconds */
  requestDelayMs?: number;
  /** Whether to simulate startup failure */
  failOnStart?: boolean;
  /** Failure message when failOnStart is true */
  startupErrorMessage?: string;
  /** Error probability for random failures (0-1) */
  errorProbability?: number;
  /** Maximum concurrent tool executions */
  maxConcurrent?: number;
  /** Whether the server supports health checks */
  supportsHealthCheck?: boolean;
  /** Simulated health check response time */
  healthCheckDelayMs?: number;
  /** Whether to simulate connection drops after N requests */
  disconnectAfterRequests?: number;
  /** Simulate specific network error modes */
  networkErrorMode?: 'timeout' | 'refused' | 'reset';
  /** Delay before network error triggers */
  networkErrorAfterMs?: number;
  /** Simulate corrupted response data */
  corruptResponseMode?: 'malformed_json' | 'incomplete' | 'wrong_schema';
}

/**
 * Tool definition for mock servers
 */
export interface MockTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Recorded request for test assertions
 */
export interface RecordedRequest {
  method: string;
  params: unknown;
  timestamp: number;
  responseTime: number;
  success: boolean;
  error?: string;
}

/**
 * Mock server statistics
 */
export interface MockServerStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  isRunning: boolean;
  uptime: number;
  connectionCount: number;
}

/**
 * Server state for lifecycle tracking
 */
export type MockServerState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

// ============================================================================
// MockMarketplaceServer Class
// ============================================================================

/**
 * A configurable mock MCP server that simulates marketplace-discovered server behavior.
 *
 * This class provides:
 * - Full lifecycle management (start, stop, restart)
 * - Tool listing and invocation simulation
 * - Request recording for assertions
 * - Configurable error injection
 * - Health check simulation
 * - Event emission for integration monitoring
 *
 * @example
 * ```typescript
 * const server = new MockMarketplaceServer(FILESYSTEM_SERVER, {
 *   startupDelayMs: 100,
 *   supportsHealthCheck: true,
 * });
 *
 * await server.start();
 * const tools = await server.listTools();
 * const result = await server.callTool('file-read', { path: '/test.txt' });
 * await server.stop();
 *
 * // Assert request was recorded
 * expect(server.getRecordedRequests()).toHaveLength(2);
 * ```
 */
export class MockMarketplaceServer extends EventEmitter {
  private state: MockServerState = 'stopped';
  private requestCount = 0;
  private successCount = 0;
  private failCount = 0;
  private startTime?: number;
  private connectionCount = 0;
  private recordedRequests: RecordedRequest[] = [];
  private responseTimes: number[] = [];

  /** The marketplace entry this server is based on */
  readonly entry: MarketplaceEntry;

  /** Behavior configuration */
  readonly behavior: Required<MockMarketplaceBehavior>;

  /** Tools advertised by this server */
  private tools: MockTool[];

  constructor(
    entry: MarketplaceEntry,
    behavior?: MockMarketplaceBehavior,
    tools?: MockTool[]
  ) {
    super();
    this.entry = entry;
    this.behavior = {
      startupDelayMs: behavior?.startupDelayMs ?? 50,
      requestDelayMs: behavior?.requestDelayMs ?? 10,
      failOnStart: behavior?.failOnStart ?? false,
      startupErrorMessage: behavior?.startupErrorMessage ?? 'Mock startup failure',
      errorProbability: behavior?.errorProbability ?? 0,
      maxConcurrent: behavior?.maxConcurrent ?? 10,
      supportsHealthCheck: behavior?.supportsHealthCheck ?? true,
      healthCheckDelayMs: behavior?.healthCheckDelayMs ?? 5,
      disconnectAfterRequests: behavior?.disconnectAfterRequests ?? 0,
      networkErrorMode: behavior?.networkErrorMode,
      networkErrorAfterMs: behavior?.networkErrorAfterMs ?? 0,
      corruptResponseMode: behavior?.corruptResponseMode,
    };
    this.tools = tools ?? this.generateDefaultTools();
  }

  // ==========================================================================
  // Lifecycle Management
  // ==========================================================================

  /**
   * Start the mock server
   */
  async start(): Promise<void> {
    if (this.state === 'running') {
      return;
    }

    this.state = 'starting';
    this.emit('state:change', 'starting');

    await this.delay(this.behavior.startupDelayMs);

    if (this.behavior.failOnStart) {
      this.state = 'error';
      this.emit('state:change', 'error');
      this.emit('error', new Error(this.behavior.startupErrorMessage));
      throw new Error(this.behavior.startupErrorMessage);
    }

    this.state = 'running';
    this.startTime = Date.now();
    this.connectionCount++;
    this.emit('state:change', 'running');
    this.emit('started');
  }

  /**
   * Stop the mock server
   */
  async stop(): Promise<void> {
    if (this.state === 'stopped') {
      return;
    }

    this.state = 'stopping';
    this.emit('state:change', 'stopping');

    await this.delay(10);

    this.state = 'stopped';
    this.startTime = undefined;
    this.emit('state:change', 'stopped');
    this.emit('stopped');
  }

  /**
   * Restart the mock server
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * Get current server state
   */
  getState(): MockServerState {
    return this.state;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.state === 'running';
  }

  // ==========================================================================
  // Tool Operations
  // ==========================================================================

  /**
   * List available tools
   */
  async listTools(): Promise<MockTool[]> {
    this.ensureRunning();
    await this.simulateRequest('tools/list', {});
    return [...this.tools];
  }

  /**
   * Call a tool with the given arguments
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<{ content: Array<{ type: string; text: string }>; isError: boolean }> {
    this.ensureRunning();

    const startTime = Date.now();

    // Check disconnect threshold
    if (
      this.behavior.disconnectAfterRequests > 0 &&
      this.requestCount >= this.behavior.disconnectAfterRequests
    ) {
      this.state = 'error';
      this.emit('disconnected', 'Request limit reached');
      throw new Error('Connection lost: request limit reached');
    }

    // Simulate random errors
    if (this.behavior.errorProbability > 0 && Math.random() < this.behavior.errorProbability) {
      const error = new Error(`Random error on tool call: ${toolName}`);
      this.recordRequest('tools/call', { name: toolName, args }, startTime, false, error.message);
      throw error;
    }

    await this.delay(this.behavior.requestDelayMs);

    const tool = this.tools.find((t) => t.name === toolName);
    if (!tool) {
      const error = `Tool not found: ${toolName}`;
      this.recordRequest('tools/call', { name: toolName, args }, startTime, false, error);
      throw new Error(error);
    }

    const result = this.generateToolResponse(toolName, args);
    this.recordRequest('tools/call', { name: toolName, args }, startTime, true);

    return result;
  }

  /**
   * Simulate an initialize handshake
   */
  async initialize(): Promise<{
    protocolVersion: string;
    capabilities: Record<string, unknown>;
    serverInfo: { name: string; version: string };
  }> {
    this.ensureRunning();
    await this.simulateRequest('initialize', {});

    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: false },
      },
      serverInfo: {
        name: this.entry.name,
        version: this.entry.version,
      },
    };
  }

  /**
   * Simulate a health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number }> {
    if (!this.behavior.supportsHealthCheck) {
      throw new Error('Health check not supported');
    }

    const start = Date.now();
    await this.delay(this.behavior.healthCheckDelayMs);

    return {
      status: this.state === 'running' ? 'healthy' : 'unhealthy',
      latency: Date.now() - start,
    };
  }

  // ==========================================================================
  // Tool Management
  // ==========================================================================

  /**
   * Add a tool to this server
   */
  addTool(tool: MockTool): void {
    this.tools.push(tool);
    this.emit('tools:changed', this.tools);
  }

  /**
   * Remove a tool from this server
   */
  removeTool(name: string): boolean {
    const index = this.tools.findIndex((t) => t.name === name);
    if (index >= 0) {
      this.tools.splice(index, 1);
      this.emit('tools:changed', this.tools);
      return true;
    }
    return false;
  }

  /**
   * Get current tool count
   */
  getToolCount(): number {
    return this.tools.length;
  }

  // ==========================================================================
  // Statistics and Recording
  // ==========================================================================

  /**
   * Get server statistics
   */
  getStats(): MockServerStats {
    return {
      totalRequests: this.requestCount,
      successfulRequests: this.successCount,
      failedRequests: this.failCount,
      averageResponseTime:
        this.responseTimes.length > 0
          ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
          : 0,
      isRunning: this.state === 'running',
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      connectionCount: this.connectionCount,
    };
  }

  /**
   * Get all recorded requests
   */
  getRecordedRequests(): RecordedRequest[] {
    return [...this.recordedRequests];
  }

  /**
   * Get requests filtered by method
   */
  getRequestsByMethod(method: string): RecordedRequest[] {
    return this.recordedRequests.filter((r) => r.method === method);
  }

  /**
   * Clear recorded requests
   */
  clearRecords(): void {
    this.recordedRequests = [];
    this.responseTimes = [];
  }

  /**
   * Reset all server state
   */
  reset(): void {
    this.state = 'stopped';
    this.requestCount = 0;
    this.successCount = 0;
    this.failCount = 0;
    this.startTime = undefined;
    this.connectionCount = 0;
    this.recordedRequests = [];
    this.responseTimes = [];
  }

  // ==========================================================================
  // Config Generation (for testing install workflows)
  // ==========================================================================

  /**
   * Generate the expected server config that would be written to config.yaml
   */
  getExpectedConfig(): ServerConfig {
    return { ...this.entry.serverConfig };
  }

  /**
   * Generate install metadata
   */
  getInstallMetadata(): {
    name: string;
    version: string;
    installedAt: string;
    source: string;
  } {
    return {
      name: this.entry.name,
      version: this.entry.version,
      installedAt: new Date().toISOString(),
      source: 'marketplace',
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private ensureRunning(): void {
    if (this.state !== 'running') {
      throw new Error(`Server ${this.entry.name} is not running (state: ${this.state})`);
    }
  }

  private async simulateRequest(method: string, params: unknown): Promise<void> {
    const startTime = Date.now();
    this.requestCount++;

    await this.delay(this.behavior.requestDelayMs);

    this.recordRequest(method, params, startTime, true);
  }

  private recordRequest(
    method: string,
    params: unknown,
    startTime: number,
    success: boolean,
    error?: string
  ): void {
    const responseTime = Date.now() - startTime;
    this.responseTimes.push(responseTime);

    if (success) {
      this.successCount++;
    } else {
      this.failCount++;
    }

    this.recordedRequests.push({
      method,
      params,
      timestamp: startTime,
      responseTime,
      success,
      error,
    });

    this.requestCount++;
  }

  private generateToolResponse(
    toolName: string,
    args: Record<string, unknown>
  ): { content: Array<{ type: string; text: string }>; isError: boolean } {
    // Generate contextual responses based on tool name patterns
    const responseText = this.getToolResponseText(toolName, args);

    return {
      content: [{ type: 'text', text: responseText }],
      isError: false,
    };
  }

  private getToolResponseText(toolName: string, args: Record<string, unknown>): string {
    // Provide realistic mock responses based on tool patterns
    if (toolName.includes('read') || toolName.includes('get')) {
      return JSON.stringify({
        content: `Mock content for ${args.path || args.key || 'unknown'}`,
        size: 42,
      });
    }
    if (toolName.includes('write') || toolName.includes('set')) {
      return JSON.stringify({
        success: true,
        path: args.path || args.key || 'unknown',
      });
    }
    if (toolName.includes('list') || toolName.includes('search')) {
      return JSON.stringify({
        results: [
          { name: 'item-1', type: 'file' },
          { name: 'item-2', type: 'directory' },
        ],
        count: 2,
      });
    }
    if (toolName.includes('delete') || toolName.includes('remove')) {
      return JSON.stringify({ deleted: true });
    }

    return JSON.stringify({
      result: `Mock execution of ${toolName}`,
      args,
      timestamp: new Date().toISOString(),
    });
  }

  private generateDefaultTools(): MockTool[] {
    // Generate tools based on server capabilities
    const capabilities = this.entry.capabilities || [];
    const tools: MockTool[] = [];

    for (const cap of capabilities) {
      const [domain, action] = cap.split(':');
      if (domain && action) {
        tools.push({
          name: `${domain}-${action}`,
          description: `${action} operation for ${domain}`,
          inputSchema: {
            type: 'object',
            properties: {
              target: { type: 'string', description: `Target for ${action}` },
            },
            required: ['target'],
          },
        });
      }
    }

    // Ensure at least one tool exists
    if (tools.length === 0) {
      tools.push({
        name: `${this.entry.name}-default`,
        description: `Default tool for ${this.entry.name}`,
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Input parameter' },
          },
        },
      });
    }

    return tools;
  }

  private delay(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a mock marketplace server from a marketplace entry
 */
export function createMockMarketplaceServer(
  entry: MarketplaceEntry,
  behavior?: MockMarketplaceBehavior
): MockMarketplaceServer {
  return new MockMarketplaceServer(entry, behavior);
}

/**
 * Create a mock server that simulates startup failure
 */
export function createFailingServer(
  entry: MarketplaceEntry,
  errorMessage = 'Server failed to start'
): MockMarketplaceServer {
  return new MockMarketplaceServer(entry, {
    failOnStart: true,
    startupErrorMessage: errorMessage,
  });
}

/**
 * Create a slow mock server (for timeout testing)
 */
export function createSlowServer(
  entry: MarketplaceEntry,
  delayMs = 2000
): MockMarketplaceServer {
  return new MockMarketplaceServer(entry, {
    startupDelayMs: delayMs,
    requestDelayMs: delayMs / 2,
  });
}

/**
 * Create an unreliable mock server (random failures)
 */
export function createUnreliableServer(
  entry: MarketplaceEntry,
  errorProbability = 0.3
): MockMarketplaceServer {
  return new MockMarketplaceServer(entry, {
    errorProbability,
  });
}

/**
 * Create a server that disconnects after N requests
 */
export function createDisconnectingServer(
  entry: MarketplaceEntry,
  disconnectAfter = 5
): MockMarketplaceServer {
  return new MockMarketplaceServer(entry, {
    disconnectAfterRequests: disconnectAfter,
  });
}

// ============================================================================
// Mock Server Manager (for managing multiple servers in a test)
// ============================================================================

/**
 * Manages multiple mock marketplace servers for complex E2E test scenarios.
 *
 * @example
 * ```typescript
 * const manager = new MockServerManager();
 * manager.addServer(FILESYSTEM_SERVER);
 * manager.addServer(MEMORY_SERVER);
 *
 * await manager.startAll();
 * // ... run tests ...
 * await manager.stopAll();
 * ```
 */
export class MockServerManager extends EventEmitter {
  private servers: Map<string, MockMarketplaceServer> = new Map();

  /**
   * Add a server to the manager
   */
  addServer(
    entry: MarketplaceEntry,
    behavior?: MockMarketplaceBehavior
  ): MockMarketplaceServer {
    const server = createMockMarketplaceServer(entry, behavior);
    this.servers.set(entry.name, server);

    // Forward events
    server.on('started', () => this.emit('server:started', entry.name));
    server.on('stopped', () => this.emit('server:stopped', entry.name));
    server.on('error', (err) => this.emit('server:error', entry.name, err));

    return server;
  }

  /**
   * Get a server by name
   */
  getServer(name: string): MockMarketplaceServer | undefined {
    return this.servers.get(name);
  }

  /**
   * Start all servers
   */
  async startAll(): Promise<void> {
    const startPromises = Array.from(this.servers.values()).map((s) =>
      s.start().catch((err) => {
        this.emit('server:error', s.entry.name, err);
      })
    );
    await Promise.all(startPromises);
  }

  /**
   * Stop all servers
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.servers.values()).map((s) => s.stop());
    await Promise.all(stopPromises);
  }

  /**
   * Get all server stats
   */
  getAllStats(): Map<string, MockServerStats> {
    const stats = new Map<string, MockServerStats>();
    for (const [name, server] of this.servers) {
      stats.set(name, server.getStats());
    }
    return stats;
  }

  /**
   * Get count of running servers
   */
  getRunningCount(): number {
    return Array.from(this.servers.values()).filter((s) => s.isRunning()).length;
  }

  /**
   * Reset all servers
   */
  resetAll(): void {
    for (const server of this.servers.values()) {
      server.reset();
    }
  }

  /**
   * Remove all servers
   */
  clear(): void {
    this.servers.clear();
  }

  /**
   * Get all server names
   */
  getServerNames(): string[] {
    return Array.from(this.servers.keys());
  }

  /**
   * Get total request count across all servers
   */
  getTotalRequests(): number {
    let total = 0;
    for (const server of this.servers.values()) {
      total += server.getStats().totalRequests;
    }
    return total;
  }
}

// ============================================================================
// Error Scenario Factory Functions (ADR-076)
// ============================================================================

/**
 * Creates a mock server that simulates network failures
 *
 * @param entry - Marketplace entry for the server
 * @param errorMode - Type of network error to simulate
 * @returns MockMarketplaceServer configured for network failures
 */
export function createFailingServer(
  entry: MarketplaceEntry,
  errorMode: 'timeout' | 'refused' | 'reset' = 'refused'
): MockMarketplaceServer {
  return createMockMarketplaceServer(entry, {
    failOnStart: true,
    startupErrorMessage: `Network error: ${errorMode}`,
    networkErrorMode: errorMode,
    networkErrorAfterMs: 100,
    errorProbability: 1.0, // Always fail
  });
}

/**
 * Creates a mock server that simulates slow responses and timeouts
 *
 * @param entry - Marketplace entry for the server
 * @param delayMs - Delay in milliseconds (default: 30000 for timeout)
 * @returns MockMarketplaceServer configured for slow responses
 */
export function createSlowServer(
  entry: MarketplaceEntry,
  delayMs: number = 30000
): MockMarketplaceServer {
  return createMockMarketplaceServer(entry, {
    startupDelayMs: delayMs,
    requestDelayMs: delayMs / 2,
    healthCheckDelayMs: delayMs / 4,
    networkErrorAfterMs: delayMs,
  });
}

/**
 * Creates a mock server that returns corrupted responses
 *
 * @param entry - Marketplace entry for the server
 * @param corruptMode - Type of corruption to simulate
 * @returns MockMarketplaceServer configured for corrupted responses
 */
export function createCorruptedServer(
  entry: MarketplaceEntry,
  corruptMode: 'malformed_json' | 'incomplete' | 'wrong_schema' = 'malformed_json'
): MockMarketplaceServer {
  return createMockMarketplaceServer(entry, {
    corruptResponseMode: corruptMode,
    errorProbability: 0.8, // High chance of corruption
  });
}

/**
 * Creates a mock server that crashes during operation
 *
 * @param entry - Marketplace entry for the server
 * @param crashAfterRequests - Number of requests before crash (default: 3)
 * @returns MockMarketplaceServer configured to crash
 */
export function createCrashingServer(
  entry: MarketplaceEntry,
  crashAfterRequests: number = 3
): MockMarketplaceServer {
  return createMockMarketplaceServer(entry, {
    disconnectAfterRequests: crashAfterRequests,
    errorProbability: 0.5,
    startupErrorMessage: 'Server crashed during operation',
  });
}
