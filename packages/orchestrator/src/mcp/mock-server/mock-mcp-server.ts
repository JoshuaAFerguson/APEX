/**
 * @fileoverview MockMCPServer - Base Mock MCP Server with Connection Lifecycle
 *
 * Provides the primary mock MCP server class that orchestrates transport,
 * protocol handling, and behavior simulation. Supports:
 * - Start/stop lifecycle management
 * - Client connection tracking
 * - Lifecycle event emission (connect, disconnect, error)
 * - Both stdio and SSE transport simulation
 * - Configurable behavior via MockMCPServerDefinition
 *
 * This is the top-level component of the mock server architecture,
 * wiring together MockTransport and MockBehaviorEngine.
 *
 * @module orchestrator/mcp/mock-server/mock-mcp-server
 */

import { EventEmitter } from 'eventemitter3';
import type {
  MockMCPServerConfig,
  MockMCPServerDefinition,
  MockBehaviorConfig,
  MockTransportType,
  MockErrorSimulationConfig,
  MockErrorScenarioPreset,
  MockMalformedResponseConfig,
} from '@apexcli/core';
import { MockTransport } from './mock-transport.js';
import { MockBehaviorEngine } from './mock-behavior-engine.js';
import type {
  MockTransportOptions,
  MockServerFacadeEvents,
  MockServerStats,
  ErrorSimulationState,
} from './types.js';
import {
  getErrorPreset,
  mergePresetWithOverrides,
} from './error-presets.js';
import type {
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
} from '../types.js';
import {
  MCPTransportError,
  isJSONRPCRequest,
  isJSONRPCNotification,
  createJSONRPCSuccessResponse,
  createJSONRPCErrorResponse,
  createJSONRPCNotification,
} from '../types.js';

// ============================================================================
// Client Connection Tracking
// ============================================================================

/**
 * Represents a connected client with metadata
 */
export interface ConnectedClient {
  /** Unique client identifier */
  id: string;
  /** The transport associated with this client */
  transport: MockTransport;
  /** Timestamp when the client connected */
  connectedAt: number;
  /** Number of requests received from this client */
  requestCount: number;
  /** Protocol state for this client */
  protocolState: 'uninitialized' | 'initializing' | 'initialized' | 'error';
  /** Client metadata from initialization */
  clientInfo?: {
    name: string;
    version: string;
  };
}

/**
 * Server lifecycle state
 */
export type MockServerState = 'stopped' | 'starting' | 'listening' | 'stopping';

// ============================================================================
// MockMCPServer Implementation
// ============================================================================

/**
 * Base Mock MCP Server with full connection lifecycle management.
 *
 * MockMCPServer provides a high-fidelity mock of an MCP server that can:
 * - Start and stop listening for connections
 * - Accept and track multiple client connections
 * - Emit lifecycle events for monitoring and testing
 * - Process JSON-RPC requests using the MCP protocol
 * - Support both stdio and SSE transport simulation
 * - Apply configurable behaviors (delays, errors, state machines)
 *
 * @example
 * ```typescript
 * const server = new MockMCPServer({
 *   serverConfig: {
 *     name: 'test-server',
 *     transport: 'stdio',
 *     capabilities: { tools: { listChanged: true } },
 *   },
 *   defaultBehavior: {
 *     toolHandlers: [{
 *       toolName: 'read_file',
 *       response: { content: [{ type: 'text', text: 'hello' }] },
 *     }],
 *   },
 * });
 *
 * // Start accepting connections
 * await server.start();
 *
 * // Create a transport for a client
 * const clientTransport = server.createClientTransport();
 * await clientTransport.connect();
 *
 * // Server is now tracking the connected client
 * console.log(server.getConnectedClients().length); // 1
 *
 * // Stop the server
 * await server.stop();
 * ```
 */
export class MockMCPServer extends EventEmitter<MockServerFacadeEvents> {
  /** Server configuration */
  private readonly serverConfig: MockMCPServerConfig;

  /** Default behavior configuration */
  private defaultBehavior: MockBehaviorConfig;

  /** Full server definition (includes scenarios) */
  private readonly definition: MockMCPServerDefinition;

  /** Behavior engine for response simulation */
  private behaviorEngine: MockBehaviorEngine;

  /** Connected clients by ID */
  private clients: Map<string, ConnectedClient> = new Map();

  /** All transports created by this server */
  private transports: MockTransport[] = [];

  /** Current server state */
  private serverState: MockServerState = 'stopped';

  /** Server start time (for uptime calculation) */
  private startTime?: number;

  /** Active scenario name */
  private activeScenario?: string;

  /** Counter for generating unique client IDs */
  private clientIdCounter = 0;

  /** Maximum concurrent connections allowed */
  private readonly maxConnections: number;

  /** Shutdown timeout in milliseconds */
  private readonly shutdownTimeoutMs: number;

  /** Error simulation configuration (ADR-072) */
  private errorSimulationConfig?: MockErrorSimulationConfig;

  /** Error simulation state tracking */
  private errorSimulationState: ErrorSimulationState = {
    requestCount: 0,
    sequenceIndex: 0,
    errorCount: 0,
    successCount: 0,
    startTime: 0,
  };

  /** Malformed response simulation configuration (ADR-072 Extension) */
  private malformedResponseConfig?: MockMalformedResponseConfig;

  /**
   * Create a new MockMCPServer instance
   *
   * @param definition - Complete server definition with config, behavior, and scenarios
   */
  constructor(definition: MockMCPServerDefinition) {
    super();

    this.definition = definition;
    this.serverConfig = definition.serverConfig;
    this.defaultBehavior = definition.defaultBehavior;
    this.maxConnections = this.serverConfig.maxConnections;
    this.shutdownTimeoutMs = this.serverConfig.shutdownTimeoutMs;

    // Initialize behavior engine with default behavior
    this.behaviorEngine = new MockBehaviorEngine(this.defaultBehavior);

    // Activate initial scenario if specified
    if (definition.activeScenario) {
      this.activateScenario(definition.activeScenario);
    }
  }

  // ==========================================================================
  // Server Lifecycle
  // ==========================================================================

  /**
   * Start the mock server, making it ready to accept connections.
   *
   * Transitions the server from 'stopped' to 'listening' state and
   * emits the 'started' event. If the server is already started, this
   * is a no-op.
   *
   * @throws {Error} If the server is in an invalid state for starting
   */
  async start(): Promise<void> {
    if (this.serverState === 'listening') {
      return; // Already started
    }

    if (this.serverState !== 'stopped') {
      throw new Error(
        `Cannot start server in state '${this.serverState}'. Must be 'stopped'.`
      );
    }

    this.serverState = 'starting';
    this.startTime = Date.now();

    // Simulate startup delay for stdio transport
    if (this.serverConfig.transport === 'stdio' && this.serverConfig.stdioConfig) {
      const delay = this.serverConfig.stdioConfig.startupDelayMs;
      if (delay > 0) {
        await this.delay(delay);
      }
    }

    this.serverState = 'listening';
    this.emit('started');
  }

  /**
   * Stop the mock server, disconnecting all clients and cleaning up.
   *
   * Gracefully disconnects all connected clients before stopping.
   * Uses the configured shutdown timeout to prevent hanging.
   *
   * @throws {Error} If the server is already stopped
   */
  async stop(): Promise<void> {
    if (this.serverState === 'stopped') {
      return; // Already stopped
    }

    if (this.serverState === 'stopping') {
      return; // Already stopping
    }

    this.serverState = 'stopping';

    // Disconnect all clients with a timeout
    const disconnectPromise = this.disconnectAllClients('Server shutting down');

    if (this.shutdownTimeoutMs > 0) {
      await Promise.race([
        disconnectPromise,
        this.delay(this.shutdownTimeoutMs),
      ]);
    } else {
      await disconnectPromise;
    }

    // Clean up transports
    for (const transport of this.transports) {
      if (transport.isConnected()) {
        await transport.disconnect('Server stopped');
      }
    }
    this.transports = [];
    this.clients.clear();

    this.serverState = 'stopped';
    this.startTime = undefined;
    this.emit('stopped');
  }

  /**
   * Get the current server state
   */
  getState(): MockServerState {
    return this.serverState;
  }

  /**
   * Check if the server is currently listening for connections
   */
  isListening(): boolean {
    return this.serverState === 'listening';
  }

  // ==========================================================================
  // Client Connection Management
  // ==========================================================================

  /**
   * Create a new client transport connected to this server.
   *
   * This creates a MockTransport instance pre-configured to communicate
   * with this server. The transport's request handler is wired to the
   * server's protocol processing pipeline.
   *
   * @param options - Optional transport configuration overrides
   * @returns A new MockTransport instance for the client to use
   * @throws {Error} If the server is not listening
   * @throws {Error} If maximum connections would be exceeded
   */
  createClientTransport(options?: Partial<MockTransportOptions>): MockTransport {
    if (this.serverState !== 'listening') {
      throw new Error(
        `Cannot create client transport: server is not listening (state: '${this.serverState}')`
      );
    }

    if (this.clients.size >= this.maxConnections) {
      throw new Error(
        `Cannot create client transport: maximum connections reached (${this.maxConnections})`
      );
    }

    const clientId = this.generateClientId();
    const transportType = this.serverConfig.transport;

    const transport = new MockTransport({
      transportType,
      connectionLatencyMs: options?.connectionLatencyMs ?? 0,
      shouldFailConnect: options?.shouldFailConnect ?? false,
      connectionTimeout: options?.connectionTimeout ?? 30000,
      autoReconnect: options?.autoReconnect ?? false,
      maxReconnectAttempts: options?.maxReconnectAttempts ?? 3,
      reconnectDelay: options?.reconnectDelay ?? 1000,
      ...options,
    });

    // Wire up connection lifecycle events
    this.wireTransportEvents(transport, clientId);

    this.transports.push(transport);
    return transport;
  }

  /**
   * Get a list of currently connected clients
   */
  getConnectedClients(): ConnectedClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get a connected client by ID
   */
  getClient(clientId: string): ConnectedClient | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get the number of currently connected clients
   */
  getConnectionCount(): number {
    return this.clients.size;
  }

  /**
   * Disconnect a specific client by ID
   *
   * @param clientId - ID of the client to disconnect
   * @param reason - Reason for disconnection
   */
  async disconnectClient(clientId: string, reason?: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (client) {
      await client.transport.disconnect(reason ?? 'Server initiated disconnect');
    }
  }

  /**
   * Disconnect all connected clients
   *
   * @param reason - Reason for disconnecting all clients
   */
  async disconnectAllClients(reason?: string): Promise<void> {
    const disconnectPromises = Array.from(this.clients.values()).map(
      client => client.transport.disconnect(reason ?? 'Server shutdown')
    );
    await Promise.allSettled(disconnectPromises);
  }

  // ==========================================================================
  // Protocol Message Processing
  // ==========================================================================

  /**
   * Process an incoming JSON-RPC message from a client.
   *
   * Routes the message through behavior engine (delays, errors) and
   * protocol handlers (initialize, tools/list, tools/call, etc.).
   *
   * @param message - The incoming JSON-RPC message
   * @param clientId - ID of the client that sent the message
   * @returns The response message, or undefined for notifications
   */
  private async processMessage(
    message: JSONRPCMessage,
    clientId: string
  ): Promise<JSONRPCMessage | undefined> {
    if (isJSONRPCRequest(message)) {
      return this.handleRequest(message, clientId);
    }

    if (isJSONRPCNotification(message)) {
      this.handleNotification(message, clientId);
      return undefined;
    }

    // Response messages from client (rare in server context)
    return undefined;
  }

  /**
   * Handle a JSON-RPC request and produce a response
   */
  private async handleRequest(
    request: JSONRPCRequest,
    clientId: string
  ): Promise<JSONRPCResponse> {
    const client = this.clients.get(clientId);
    if (client) {
      client.requestCount++;
    }

    const startTime = Date.now();

    // Emit request event
    this.emit('request', request);

    try {
      // Apply response delay
      await this.behaviorEngine.applyDelay(request.method);

      // Check error injection (legacy)
      const errorResult = this.behaviorEngine.checkErrorInjection(request.method);
      if (errorResult.shouldInject) {
        if (errorResult.delayMs && errorResult.delayMs > 0) {
          await this.delay(errorResult.delayMs);
        }

        const errorResponse = createJSONRPCErrorResponse(
          request.id,
          errorResult.errorCode ?? -32603,
          errorResult.errorMessage ?? 'Injected error',
          errorResult.errorData
        );

        this.emit('error:injected', request, errorResult);
        this.recordRequest(request, errorResponse, startTime, true, clientId);
        this.emit('response', request, errorResponse);

        return errorResponse;
      }

      // Check error simulation (ADR-072)
      const params = request.params as Record<string, unknown> | undefined;
      const errorSimulationResult = this.checkErrorSimulation(request.method, clientId, params);
      if (errorSimulationResult.shouldSimulate) {
        // Apply error simulation delay if configured
        if (errorSimulationResult.delayMs && errorSimulationResult.delayMs > 0) {
          await this.delay(errorSimulationResult.delayMs);
        }

        const errorResponse = createJSONRPCErrorResponse(
          request.id,
          errorSimulationResult.errorCode ?? -32603,
          errorSimulationResult.errorMessage ?? 'Simulated error',
          errorSimulationResult.errorData
        );

        // Emit error:injected event for consistency (error simulation is a type of error injection)
        this.emit('error:injected', request, {
          shouldInject: true,
          errorCode: errorSimulationResult.errorCode,
          errorMessage: errorSimulationResult.errorMessage,
          errorData: errorSimulationResult.errorData,
          delayMs: errorSimulationResult.delayMs,
        });

        this.recordRequest(request, errorResponse, startTime, true, clientId);
        this.emit('response', request, errorResponse);

        return errorResponse;
      }

      // Check state machine transition
      const transitionResult = this.behaviorEngine.transition(request.method, params);
      if (transitionResult) {
        this.emit('state:change', transitionResult.from, transitionResult.to, request.method);
      }

      // Route to method handler
      const result = await this.routeRequest(request, clientId);
      const response = createJSONRPCSuccessResponse(request.id, result);

      // Record the request
      this.recordRequest(request, response, startTime, false, clientId);

      // Check notification triggers
      this.checkAndFireNotifications(request.method, clientId);

      this.emit('response', request, response);
      return response;

    } catch (error) {
      const errorResponse = createJSONRPCErrorResponse(
        request.id,
        -32603,
        error instanceof Error ? error.message : String(error)
      );

      this.recordRequest(request, errorResponse, startTime, false, clientId);
      this.emit('response', request, errorResponse);
      return errorResponse;
    }
  }

  /**
   * Handle a JSON-RPC notification (no response)
   */
  private handleNotification(
    notification: JSONRPCNotification,
    _clientId: string
  ): void {
    this.emit('notification:sent', notification);
  }

  /**
   * Route a request to the appropriate method handler
   */
  private async routeRequest(
    request: JSONRPCRequest,
    clientId: string
  ): Promise<unknown> {
    const { method, params } = request;
    const client = this.clients.get(clientId);

    switch (method) {
      case 'initialize':
        return this.handleInitialize(params as Record<string, unknown>, clientId);

      case 'initialized':
        // Notification in practice, but handle it if sent as request
        if (client) {
          client.protocolState = 'initialized';
        }
        return {};

      case 'ping':
        return {};

      case 'tools/list':
        return this.handleToolsList();

      case 'tools/call':
        return this.handleToolCall(params as Record<string, unknown>);

      case 'resources/list':
        return this.handleResourcesList();

      case 'resources/read':
        return this.handleResourceRead(params as Record<string, unknown>);

      case 'prompts/list':
        return this.handlePromptsList();

      case 'prompts/get':
        return this.handlePromptsGet(params as Record<string, unknown>);

      default:
        throw new Error(`Method not found: ${method}`);
    }
  }

  // ==========================================================================
  // MCP Protocol Method Handlers
  // ==========================================================================

  /**
   * Handle the 'initialize' request
   */
  private handleInitialize(
    params: Record<string, unknown>,
    clientId: string
  ): unknown {
    const client = this.clients.get(clientId);
    if (client) {
      client.protocolState = 'initialized';
      if (params?.clientInfo && typeof params.clientInfo === 'object') {
        const info = params.clientInfo as { name?: string; version?: string };
        client.clientInfo = {
          name: info.name ?? 'unknown',
          version: info.version ?? 'unknown',
        };
      }
    }

    return {
      protocolVersion: this.serverConfig.protocolVersion,
      capabilities: this.serverConfig.capabilities,
      serverInfo: this.serverConfig.serverInfo,
      ...(this.serverConfig.instructions ? { instructions: this.serverConfig.instructions } : {}),
    };
  }

  /**
   * Handle 'tools/list' request
   */
  private handleToolsList(): unknown {
    // Return tools from behavior engine's tool handlers
    const handlers = this.defaultBehavior.toolHandlers;
    const tools = handlers.map(h => ({
      name: h.toolName,
      description: `Mock tool: ${h.toolName}`,
      inputSchema: { type: 'object' as const, properties: {} },
    }));
    return { tools };
  }

  /**
   * Handle 'tools/call' request
   */
  private handleToolCall(params: Record<string, unknown>): unknown {
    const toolName = params?.name as string;
    const args = (params?.arguments ?? {}) as Record<string, unknown>;

    if (!toolName) {
      throw new Error('Tool name is required');
    }

    // Check behavior engine for a matching handler
    const handler = this.behaviorEngine.findToolHandler(toolName, args);
    if (handler) {
      if (handler.delayMs && handler.delayMs > 0) {
        // We can't await here in a sync context, but the delay was
        // already applied by applyDelay in handleRequest
      }
      return handler.response;
    }

    // Check default tool response
    const defaultResponse = this.behaviorEngine.getDefaultToolResponse();
    if (defaultResponse) {
      return defaultResponse;
    }

    // No handler found - return generic response
    return {
      content: [{ type: 'text', text: `No handler for tool: ${toolName}` }],
      isError: true,
    };
  }

  /**
   * Handle 'resources/list' request
   */
  private handleResourcesList(): unknown {
    return { resources: [] };
  }

  /**
   * Handle 'resources/read' request
   */
  private handleResourceRead(params: Record<string, unknown>): unknown {
    const uri = params?.uri as string;
    return {
      contents: [{
        uri: uri ?? 'unknown',
        mimeType: 'text/plain',
        text: `Mock resource content for ${uri}`,
      }],
    };
  }

  /**
   * Handle 'prompts/list' request
   */
  private handlePromptsList(): unknown {
    return { prompts: [] };
  }

  /**
   * Handle 'prompts/get' request
   */
  private handlePromptsGet(params: Record<string, unknown>): unknown {
    const name = params?.name as string;
    return {
      description: `Mock prompt: ${name}`,
      messages: [{
        role: 'user',
        content: { type: 'text', text: `Mock prompt content for ${name}` },
      }],
    };
  }

  // ==========================================================================
  // Scenario Management
  // ==========================================================================

  /**
   * Activate a named scenario, overriding the default behavior.
   *
   * @param name - Name of the scenario to activate
   * @throws {Error} If the scenario doesn't exist
   */
  activateScenario(name: string): void {
    const scenario = this.definition.scenarios.find(s => s.name === name);
    if (!scenario) {
      throw new Error(`Scenario '${name}' not found`);
    }

    this.activeScenario = name;
    this.behaviorEngine.updateConfig(scenario.behaviorConfig);
    this.emit('scenario:activated', name);
  }

  /**
   * Reset to default behavior (deactivate any active scenario)
   */
  resetToDefault(): void {
    this.activeScenario = undefined;
    this.behaviorEngine.updateConfig(this.defaultBehavior);
    this.behaviorEngine.reset();
  }

  /**
   * Get the active scenario name, if any
   */
  getActiveScenario(): string | undefined {
    return this.activeScenario;
  }

  // ==========================================================================
  // Statistics and Inspection
  // ==========================================================================

  /**
   * Get comprehensive server statistics
   */
  getStats(): MockServerStats {
    const recorded = this.behaviorEngine.getRecordedRequests();
    const requestsByMethod: Record<string, number> = {};
    const toolCallsByName: Record<string, number> = {};

    for (const req of recorded) {
      const method = req.request.method;
      requestsByMethod[method] = (requestsByMethod[method] ?? 0) + 1;

      if (method === 'tools/call') {
        const params = req.request.params as Record<string, unknown> | undefined;
        const toolName = params?.name as string | undefined;
        if (toolName) {
          toolCallsByName[toolName] = (toolCallsByName[toolName] ?? 0) + 1;
        }
      }
    }

    return {
      totalRequests: this.behaviorEngine.getRequestCount(),
      totalErrorsInjected: this.behaviorEngine.getErrorCount(),
      totalNotificationsSent: 0, // TODO: Track in future
      requestsByMethod,
      toolCallsByName,
      currentState: this.behaviorEngine.getCurrentState(),
      activeScenario: this.activeScenario,
      uptimeMs: this.startTime ? Date.now() - this.startTime : 0,
    };
  }

  /**
   * Get server configuration
   */
  getServerConfig(): MockMCPServerConfig {
    return this.serverConfig;
  }

  /**
   * Get the server name
   */
  getName(): string {
    return this.serverConfig.name;
  }

  /**
   * Get the transport type
   */
  getTransportType(): MockTransportType {
    return this.serverConfig.transport;
  }

  // ==========================================================================
  // Assertion Helpers
  // ==========================================================================

  /**
   * Assert that a tool was called a specific number of times
   *
   * @param toolName - Name of the tool
   * @param times - Expected call count (undefined = at least once)
   * @throws {Error} If assertion fails
   */
  assertToolCalled(toolName: string, times?: number): void {
    const recorded = this.behaviorEngine.getRecordedRequests();
    const toolCalls = recorded.filter(r => {
      if (r.request.method !== 'tools/call') return false;
      const params = r.request.params as Record<string, unknown> | undefined;
      return params?.name === toolName;
    });

    if (times !== undefined) {
      if (toolCalls.length !== times) {
        throw new Error(
          `Expected tool '${toolName}' to be called ${times} time(s), but was called ${toolCalls.length} time(s)`
        );
      }
    } else {
      if (toolCalls.length === 0) {
        throw new Error(
          `Expected tool '${toolName}' to be called at least once, but it was never called`
        );
      }
    }
  }

  /**
   * Assert that a method was called a specific number of times
   *
   * @param method - MCP method name
   * @param times - Expected call count (undefined = at least once)
   * @throws {Error} If assertion fails
   */
  assertMethodCalled(method: string, times?: number): void {
    const recorded = this.behaviorEngine.getRecordedRequests();
    const calls = recorded.filter(r => r.request.method === method);

    if (times !== undefined) {
      if (calls.length !== times) {
        throw new Error(
          `Expected method '${method}' to be called ${times} time(s), but was called ${calls.length} time(s)`
        );
      }
    } else {
      if (calls.length === 0) {
        throw new Error(
          `Expected method '${method}' to be called at least once, but it was never called`
        );
      }
    }
  }

  /**
   * Assert that at least one client has completed initialization
   *
   * @throws {Error} If no client is initialized
   */
  assertInitialized(): void {
    const initializedClients = Array.from(this.clients.values())
      .filter(c => c.protocolState === 'initialized');

    if (initializedClients.length === 0) {
      throw new Error('Expected at least one client to be initialized, but none are');
    }
  }

  /**
   * Get request history from the behavior engine
   */
  getRequestHistory() {
    return this.behaviorEngine.getRecordedRequests();
  }

  // ==========================================================================
  // Dynamic Behavior Modification
  // ==========================================================================

  /**
   * Update the behavior engine configuration
   */
  updateBehavior(config: Partial<MockBehaviorConfig>): void {
    const merged = { ...this.defaultBehavior, ...config };
    this.defaultBehavior = merged as MockBehaviorConfig;
    this.behaviorEngine.updateConfig(this.defaultBehavior);
  }

  /**
   * Reset the behavior engine state (counters, recordings, etc.)
   */
  resetBehavior(): void {
    this.behaviorEngine.reset();
  }

  // ==========================================================================
  // Error Simulation (ADR-072)
  // ==========================================================================

  /**
   * Set the error simulation mode for deterministic error testing.
   *
   * Unlike probability-based error injection, error simulation modes provide
   * predictable, repeatable error patterns for testing specific scenarios.
   *
   * @param config - Error simulation configuration
   *
   * @example
   * ```typescript
   * // All requests fail with timeout
   * server.setErrorMode({
   *   mode: 'always_fail',
   *   preset: 'request_timeout'
   * });
   *
   * // First 3 requests fail, then succeed
   * server.setErrorMode({
   *   mode: 'fail_first_n',
   *   failCount: 3,
   *   customError: { code: -32603, message: 'Service starting up' }
   * });
   *
   * // Use a specific error sequence
   * server.setErrorMode({
   *   mode: 'sequence',
   *   sequence: [
   *     { outcome: 'error', error: { code: -32603, message: 'First failure' } },
   *     { outcome: 'success' },
   *     { outcome: 'error', error: { code: -32603, message: 'Second failure' } },
   *     { outcome: 'success' },
   *   ]
   * });
   * ```
   */
  setErrorMode(config: MockErrorSimulationConfig): void {
    // If a preset is specified, merge preset defaults with custom config
    if (config.preset) {
      const mergedConfig = mergePresetWithOverrides(config.preset, config);
      this.errorSimulationConfig = {
        ...mergedConfig,
        mode: config.mode ?? mergedConfig.mode ?? 'always_fail',
        category: config.category ?? mergedConfig.category ?? 'jsonrpc',
        affectedClients: config.affectedClients ?? 'all',
      } as MockErrorSimulationConfig;
    } else {
      this.errorSimulationConfig = config;
    }

    // Reset simulation state
    this.errorSimulationState = {
      requestCount: 0,
      sequenceIndex: 0,
      errorCount: 0,
      successCount: 0,
      startTime: Date.now(),
    };

    // Emit event for monitoring
    this.emit('scenario:activated', `error:${config.mode}`);
  }

  /**
   * Clear the error simulation mode, returning to normal operation.
   *
   * This removes any active error simulation and resets the simulation state.
   */
  clearErrorMode(): void {
    this.errorSimulationConfig = undefined;
    this.errorSimulationState = {
      requestCount: 0,
      sequenceIndex: 0,
      errorCount: 0,
      successCount: 0,
      startTime: 0,
    };
  }

  /**
   * Reset error simulation state and clear any active error simulation.
   * This is an alias for clearErrorMode() for backward compatibility.
   */
  resetErrorSimulation(): void {
    this.clearErrorMode();
  }

  /**
   * Get the current error simulation configuration.
   *
   * @returns The current error simulation config, or undefined if not set
   */
  getErrorMode(): MockErrorSimulationConfig | undefined {
    return this.errorSimulationConfig;
  }

  /**
   * Get the current error simulation state.
   *
   * @returns Statistics about the current error simulation session
   */
  getErrorSimulationState(): ErrorSimulationState {
    return { ...this.errorSimulationState };
  }

  /**
   * Apply a preset error scenario for common test cases.
   *
   * This is a convenience method that sets the error mode using a
   * predefined preset configuration.
   *
   * @param preset - Predefined error scenario name
   *
   * @example
   * ```typescript
   * // Simulate connection drop during initialization
   * server.applyErrorPreset('init_connection_drop');
   *
   * // Simulate rate limiting
   * server.applyErrorPreset('rate_limit');
   * ```
   */
  applyErrorPreset(preset: MockErrorScenarioPreset): void {
    const presetConfig = getErrorPreset(preset);
    if (!presetConfig) {
      throw new Error(`Unknown error preset: ${preset}`);
    }

    this.setErrorMode({
      ...presetConfig,
      preset,
      mode: presetConfig.mode ?? 'always_fail',
      category: presetConfig.category ?? 'jsonrpc',
      affectedClients: 'all',
    } as MockErrorSimulationConfig);
  }

  /**
   * Check if error simulation should trigger for a given request.
   *
   * This is the internal hook called during request processing to
   * determine whether to simulate an error based on the current
   * error simulation configuration.
   *
   * @param method - The MCP method name
   * @param clientId - The ID of the client making the request
   * @param args - The request arguments (for argument_pattern mode)
   * @returns Whether to simulate an error and the error details
   *
   * @internal
   */
  protected checkErrorSimulation(
    method: string,
    clientId: string,
    args?: Record<string, unknown>
  ): {
    shouldSimulate: boolean;
    errorCode?: number;
    errorMessage?: string;
    errorData?: unknown;
    delayMs?: number;
  } {
    const config = this.errorSimulationConfig;
    if (!config || config.mode === 'none') {
      return { shouldSimulate: false };
    }

    // Check if this client is affected
    if (config.affectedClients !== 'all') {
      if (!config.affectedClients.includes(clientId)) {
        return { shouldSimulate: false };
      }
    }

    // Track request for simulation state
    this.errorSimulationState.requestCount++;

    // Determine if we should simulate an error based on mode
    let shouldSimulate = false;

    switch (config.mode) {
      case 'always_fail':
        shouldSimulate = true;
        break;

      case 'periodic_fail':
        if (config.failPeriod && config.failPeriod > 0) {
          shouldSimulate = this.errorSimulationState.requestCount % config.failPeriod === 0;
        }
        break;

      case 'fail_first_n':
        shouldSimulate = this.errorSimulationState.requestCount <= (config.failCount ?? 0);
        break;

      case 'fail_after_n':
        shouldSimulate = this.errorSimulationState.successCount >= (config.succeedCount ?? 0);
        break;

      case 'fail_until':
        shouldSimulate = this.errorSimulationState.requestCount <= (config.failCount ?? 0);
        break;

      case 'method_pattern':
        if (config.methodPattern) {
          try {
            const regex = new RegExp(config.methodPattern);
            shouldSimulate = regex.test(method);
          } catch {
            // Invalid regex, don't simulate
            shouldSimulate = false;
          }
        }
        break;

      case 'argument_pattern':
        if (config.argumentMatcher && args) {
          shouldSimulate = this.matchArgumentPattern(
            args,
            config.argumentMatcher.path,
            config.argumentMatcher.value
          );
        }
        break;

      case 'sequence':
        if (config.sequence && config.sequence.length > 0) {
          const index = this.errorSimulationState.sequenceIndex % config.sequence.length;
          const item = config.sequence[index];
          shouldSimulate = item.outcome === 'error';
          this.errorSimulationState.sequenceIndex++;

          if (shouldSimulate && item.error) {
            return {
              shouldSimulate: true,
              errorCode: item.error.code,
              errorMessage: item.error.message,
              errorData: item.error.data,
              delayMs: item.delayMs,
            };
          }
        }
        break;
    }

    // Track success/error counts
    if (shouldSimulate) {
      this.errorSimulationState.errorCount++;
    } else {
      this.errorSimulationState.successCount++;
    }

    if (!shouldSimulate) {
      return { shouldSimulate: false };
    }

    // Get error details from custom error or preset
    const errorDetails = config.customError ?? {
      code: -32603,
      message: 'Simulated error',
    };

    return {
      shouldSimulate: true,
      errorCode: errorDetails.code,
      errorMessage: errorDetails.message,
      errorData: errorDetails.data,
      delayMs: config.networkConditions?.latencyMs,
    };
  }

  /**
   * Match an argument pattern against request arguments.
   *
   * @param args - The request arguments
   * @param path - JSON path to check (e.g., 'name', 'options.verbose')
   * @param value - Expected value at the path
   * @returns Whether the pattern matches
   */
  private matchArgumentPattern(
    args: Record<string, unknown>,
    path: string,
    value: unknown
  ): boolean {
    const parts = path.split('.');
    let current: unknown = args;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return false;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return JSON.stringify(current) === JSON.stringify(value);
  }

  // ==========================================================================
  // Malformed Response Simulation (ADR-072 Extension)
  // ==========================================================================

  /**
   * Set the malformed response mode for transport-level malformed response testing.
   *
   * This enables simulation of various transport-level malformed responses that help
   * test client resilience against protocol violations and corrupted data.
   *
   * @param config - Malformed response configuration
   *
   * @example
   * ```typescript
   * // Simulate truncated JSON responses
   * server.setMalformedResponseMode({
   *   type: 'truncated_json',
   *   truncateAt: '50%',
   *   affectedMethods: ['tools/call'],
   *   probability: 1.0,
   * });
   *
   * // Simulate invalid JSON
   * server.setMalformedResponseMode({
   *   type: 'invalid_json',
   *   invalidJsonContent: '{"result": undefined}',
   *   affectedMethods: [],
   *   probability: 0.5,
   * });
   *
   * // Simulate wrong schema responses
   * server.setMalformedResponseMode({
   *   type: 'wrong_schema',
   *   wrongSchemaPayload: { unexpected: 'structure', missing: 'required fields' },
   * });
   * ```
   */
  setMalformedResponseMode(config: MockMalformedResponseConfig): void {
    this.malformedResponseConfig = config;

    // Emit event for monitoring
    this.emit('scenario:activated', `malformed:${config.type}`);
  }

  /**
   * Clear the malformed response mode, returning to normal response generation.
   *
   * This removes any active malformed response simulation and restores
   * standard JSON-RPC response formatting.
   */
  clearMalformedResponseMode(): void {
    this.malformedResponseConfig = undefined;
  }

  /**
   * Get the current malformed response configuration.
   *
   * @returns The current malformed response config, or undefined if not set
   */
  getMalformedResponseMode(): MockMalformedResponseConfig | undefined {
    return this.malformedResponseConfig;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Wire transport events to track client connection lifecycle
   */
  private wireTransportEvents(transport: MockTransport, clientId: string): void {
    // When client connects
    transport.on('connected', () => {
      const client: ConnectedClient = {
        id: clientId,
        transport,
        connectedAt: Date.now(),
        requestCount: 0,
        protocolState: 'uninitialized',
      };
      this.clients.set(clientId, client);
      this.emit('request', { jsonrpc: '2.0', id: 0, method: '__connect__' } as JSONRPCRequest);
    });

    // When client disconnects
    transport.on('disconnected', (reason?: string) => {
      this.clients.delete(clientId);
    });

    // Wire up the request handler to process messages
    transport.setRequestHandler(async (message: JSONRPCMessage) => {
      return this.processMessage(message, clientId);
    });

    // Forward transport errors
    transport.on('error', (error: MCPTransportError) => {
      // Transport errors don't disconnect by default
    });
  }

  /**
   * Record a request in the behavior engine
   */
  private recordRequest(
    request: JSONRPCRequest,
    response: JSONRPCResponse,
    startTime: number,
    errorInjected: boolean,
    _clientId: string
  ): void {
    this.behaviorEngine.recordRequest({
      request,
      response,
      timestamp: startTime,
      durationMs: Date.now() - startTime,
      errorInjected,
      serverState: this.behaviorEngine.getCurrentState(),
    });
  }

  /**
   * Check and fire notification triggers after a request
   */
  private checkAndFireNotifications(method: string, clientId: string): void {
    const triggers = this.behaviorEngine.checkNotificationTriggers(method);

    for (const trigger of triggers) {
      const notification = createJSONRPCNotification(trigger.method, trigger.params);

      // Send notification to the specific client
      const client = this.clients.get(clientId);
      if (client && client.transport.isConnected()) {
        // Inject the notification as a received message on the client's transport
        if (trigger.delayMs > 0) {
          setTimeout(() => {
            if (client.transport.isConnected()) {
              client.transport.injectMessage(notification);
              this.emit('notification:sent', notification);
            }
          }, trigger.delayMs);
        } else {
          client.transport.injectMessage(notification);
          this.emit('notification:sent', notification);
        }
      }
    }
  }

  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    return `client-${++this.clientIdCounter}-${Date.now().toString(36)}`;
  }

  /**
   * Create a delay promise
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
