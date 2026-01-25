/**
 * @fileoverview MockMCPServerFacade - Top-Level Mock Server API
 *
 * Provides a unified, test-friendly interface for creating and managing
 * mock MCP servers. Orchestrates MockTransport, MockMCPProtocolHandler,
 * and MockBehaviorEngine into a cohesive testing tool.
 *
 * @module orchestrator/mcp/mock-server/mock-server-facade
 */

import { EventEmitter } from 'eventemitter3';
import type {
  MockMCPServerDefinition,
  MockMCPServerConfig,
  MockBehaviorConfig,
  MockToolHandler,
  MockErrorInjection,
  MockResponseDelay,
  MockScenario,
  MockErrorSimulationConfig,
  MockErrorScenarioPreset,
} from '@apexcli/core';
import type {
  JSONRPCMessage,
  JSONRPCNotification,
} from '../types.js';
import {
  isJSONRPCRequest,
  createJSONRPCNotification,
} from '../types.js';
import { MockTransport } from './mock-transport.js';
import { MockMCPProtocolHandler } from './mock-protocol-handler.js';
import type {
  MockServerFacadeEvents,
  MockServerStats,
  RecordedRequest,
  MockAssertionError as MockAssertionErrorType,
  MockTransportOptions,
  ErrorSimulationState,
} from './types.js';
import { MockAssertionError } from './types.js';
import {
  getErrorPreset,
  mergePresetWithOverrides,
} from './error-presets.js';

// ============================================================================
// MockMCPServerFacade
// ============================================================================

/**
 * Top-level API for creating and managing mock MCP servers in tests.
 *
 * The facade orchestrates all mock server components (transport, protocol handler,
 * behavior engine) and provides a simple, test-friendly interface for:
 * - Creating mock servers from configuration definitions
 * - Activating/switching test scenarios
 * - Making assertions about server interactions
 * - Dynamically modifying server behavior
 *
 * @example
 * ```typescript
 * // Create a mock server with tool handlers
 * const server = new MockMCPServerFacade({
 *   serverConfig: {
 *     name: 'test-server',
 *     transport: 'stdio',
 *     capabilities: { tools: { listChanged: true } },
 *   },
 *   defaultBehavior: {
 *     toolHandlers: [{
 *       toolName: 'read_file',
 *       response: { content: [{ type: 'text', text: 'file content' }] },
 *     }],
 *   },
 * });
 *
 * // Use with MCPClient
 * const client = new MCPClient({ transport: server.getTransport() });
 * await client.connect();
 * await client.listTools();
 *
 * // Assert interactions
 * server.assertMethodCalled('tools/list', 1);
 * ```
 */
export class MockMCPServerFacade extends EventEmitter<MockServerFacadeEvents> {
  private definition: MockMCPServerDefinition;
  private transport: MockTransport;
  private protocolHandler: MockMCPProtocolHandler;
  private activeScenario?: string;
  private started = false;
  private startTime = 0;

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

  constructor(definition: MockMCPServerDefinition) {
    super();
    this.definition = definition;

    // Determine active behavior
    const activeBehavior = this.resolveActiveBehavior();

    // Create transport
    this.transport = this.createTransport(definition.serverConfig);

    // Create protocol handler
    this.protocolHandler = new MockMCPProtocolHandler(
      definition.serverConfig,
      activeBehavior
    );

    // Wire transport to protocol handler
    this.wireTransport();

    // Set active scenario if specified
    if (definition.activeScenario) {
      this.activateScenario(definition.activeScenario);
    }
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Get the mock transport for use with MCPClient.
   */
  getTransport(): MockTransport {
    return this.transport;
  }

  /**
   * Start the mock server (marks it as ready to accept connections).
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    this.startTime = Date.now();
    this.emit('started');
  }

  /**
   * Stop the mock server.
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    // Disconnect transport if connected
    if (this.transport.isConnected()) {
      await this.transport.disconnect('Server stopped');
    }

    this.started = false;
    this.emit('stopped');
  }

  /**
   * Check if the server is started.
   */
  isStarted(): boolean {
    return this.started;
  }

  // ==========================================================================
  // Scenario Management
  // ==========================================================================

  /**
   * Activate a named scenario, switching the server's behavior configuration.
   *
   * @param name - The scenario name to activate
   * @throws Error if the scenario is not found
   */
  activateScenario(name: string): void {
    const scenario = this.definition.scenarios.find(s => s.name === name);
    if (!scenario) {
      throw new Error(
        `Scenario '${name}' not found. Available: ${this.definition.scenarios.map(s => s.name).join(', ')}`
      );
    }

    this.activeScenario = name;
    this.protocolHandler.updateServerConfig(scenario.serverConfig);
    this.protocolHandler.updateBehaviorConfig(scenario.behaviorConfig);
    this.emit('scenario:activated', name);
  }

  /**
   * Reset to default behavior (deactivate any active scenario).
   */
  resetToDefault(): void {
    this.activeScenario = undefined;
    this.protocolHandler.updateServerConfig(this.definition.serverConfig);
    this.protocolHandler.updateBehaviorConfig(this.definition.defaultBehavior);
    this.protocolHandler.reset();
  }

  /**
   * Get the name of the currently active scenario.
   */
  getActiveScenario(): string | undefined {
    return this.activeScenario;
  }

  /**
   * Get all available scenario names.
   */
  getAvailableScenarios(): string[] {
    return this.definition.scenarios.map(s => s.name);
  }

  // ==========================================================================
  // Assertions
  // ==========================================================================

  /**
   * Assert that a specific tool was called a certain number of times.
   *
   * @param toolName - The tool name to check
   * @param times - Expected number of calls (undefined = at least once)
   * @throws MockAssertionError if assertion fails
   */
  assertToolCalled(toolName: string, times?: number): void {
    const history = this.getRequestHistory();
    const toolCalls = history.filter(r =>
      r.request.method === 'tools/call' &&
      (r.request.params as Record<string, unknown>)?.name === toolName
    );

    if (times !== undefined) {
      if (toolCalls.length !== times) {
        throw new MockAssertionError(
          `Expected tool '${toolName}' to be called ${times} times, but was called ${toolCalls.length} times`,
          times,
          toolCalls.length
        );
      }
    } else {
      if (toolCalls.length === 0) {
        throw new MockAssertionError(
          `Expected tool '${toolName}' to be called at least once, but it was never called`,
          'at least 1',
          0
        );
      }
    }
  }

  /**
   * Assert that a specific method was called a certain number of times.
   *
   * @param method - The MCP method name to check
   * @param times - Expected number of calls (undefined = at least once)
   * @throws MockAssertionError if assertion fails
   */
  assertMethodCalled(method: string, times?: number): void {
    const history = this.getRequestHistory();
    const methodCalls = history.filter(r => r.request.method === method);

    if (times !== undefined) {
      if (methodCalls.length !== times) {
        throw new MockAssertionError(
          `Expected method '${method}' to be called ${times} times, but was called ${methodCalls.length} times`,
          times,
          methodCalls.length
        );
      }
    } else {
      if (methodCalls.length === 0) {
        throw new MockAssertionError(
          `Expected method '${method}' to be called at least once, but it was never called`,
          'at least 1',
          0
        );
      }
    }
  }

  /**
   * Assert that the server was initialized via the MCP handshake.
   *
   * @throws MockAssertionError if not initialized
   */
  assertInitialized(): void {
    if (!this.protocolHandler.isInitialized()) {
      throw new MockAssertionError(
        'Expected server to be initialized, but it is not',
        'initialized',
        this.protocolHandler.getProtocolState()
      );
    }
  }

  /**
   * Assert that no errors were injected during the test.
   *
   * @throws MockAssertionError if errors were injected
   */
  assertNoErrorsInjected(): void {
    const history = this.getRequestHistory();
    const errors = history.filter(r => r.errorInjected);
    if (errors.length > 0) {
      throw new MockAssertionError(
        `Expected no errors to be injected, but ${errors.length} were injected`,
        0,
        errors.length
      );
    }
  }

  /**
   * Assert that the server is in a specific state (state machine).
   *
   * @param state - Expected state name
   * @throws MockAssertionError if not in expected state
   */
  assertState(state: string): void {
    const currentState = this.protocolHandler.getServerState();
    if (currentState !== state) {
      throw new MockAssertionError(
        `Expected server state '${state}', but current state is '${currentState}'`,
        state,
        currentState
      );
    }
  }

  // ==========================================================================
  // Request History
  // ==========================================================================

  /**
   * Get the full request history.
   */
  getRequestHistory(): RecordedRequest[] {
    return this.protocolHandler.getRequestHistory();
  }

  /**
   * Get request history filtered by method.
   */
  getRequestsByMethod(method: string): RecordedRequest[] {
    return this.getRequestHistory().filter(r => r.request.method === method);
  }

  /**
   * Get tool call history filtered by tool name.
   */
  getToolCalls(toolName: string): RecordedRequest[] {
    return this.getRequestHistory().filter(r =>
      r.request.method === 'tools/call' &&
      (r.request.params as Record<string, unknown>)?.name === toolName
    );
  }

  // ==========================================================================
  // Dynamic Behavior Modification
  // ==========================================================================

  /**
   * Add a tool handler dynamically.
   */
  addToolHandler(handler: MockToolHandler): void {
    // Update the definition's default behavior with the new handler
    this.definition.defaultBehavior.toolHandlers.push(handler);
    // Refresh the protocol handler
    this.protocolHandler.updateBehaviorConfig(this.resolveActiveBehavior());
  }

  /**
   * Remove a tool handler by tool name.
   */
  removeToolHandler(toolName: string): void {
    this.definition.defaultBehavior.toolHandlers =
      this.definition.defaultBehavior.toolHandlers.filter(h => h.toolName !== toolName);
    this.protocolHandler.updateBehaviorConfig(this.resolveActiveBehavior());
  }

  /**
   * Set error injection configuration.
   */
  setErrorInjection(config: MockErrorInjection): void {
    this.definition.defaultBehavior.errorInjection = config;
    this.protocolHandler.updateBehaviorConfig(this.resolveActiveBehavior());
  }

  /**
   * Set response delay configuration.
   */
  setResponseDelay(config: MockResponseDelay): void {
    this.definition.defaultBehavior.responseDelay = config;
    this.protocolHandler.updateBehaviorConfig(this.resolveActiveBehavior());
  }

  /**
   * Send a notification from the server to the client.
   */
  sendNotification(method: string, params?: Record<string, unknown>): void {
    if (!this.transport.isConnected()) {
      throw new Error('Cannot send notification: transport not connected');
    }
    const notification = createJSONRPCNotification(method, params);
    this.transport.injectMessage(notification);
    this.emit('notification:sent', notification);
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
   * @param preset - Predefined error scenario name
   *
   * @example
   * ```typescript
   * server.applyErrorPreset('init_connection_drop');
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

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get usage statistics for the mock server.
   */
  getStats(): MockServerStats {
    const history = this.getRequestHistory();
    const requestsByMethod: Record<string, number> = {};
    const toolCallsByName: Record<string, number> = {};

    for (const entry of history) {
      const method = entry.request.method;
      requestsByMethod[method] = (requestsByMethod[method] ?? 0) + 1;

      if (method === 'tools/call') {
        const toolName = (entry.request.params as Record<string, unknown>)?.name as string;
        if (toolName) {
          toolCallsByName[toolName] = (toolCallsByName[toolName] ?? 0) + 1;
        }
      }
    }

    return {
      totalRequests: history.length,
      totalErrorsInjected: history.filter(r => r.errorInjected).length,
      totalNotificationsSent: this.protocolHandler.getSentNotifications().length,
      requestsByMethod,
      toolCallsByName,
      currentState: this.protocolHandler.getServerState(),
      activeScenario: this.activeScenario,
      uptimeMs: this.started ? Date.now() - this.startTime : 0,
    };
  }

  // ==========================================================================
  // Reset
  // ==========================================================================

  /**
   * Reset the mock server to its initial state.
   * Clears all recorded requests, resets state machine, and disconnects transport.
   */
  async reset(): Promise<void> {
    if (this.transport.isConnected()) {
      await this.transport.disconnect('Reset');
    }
    this.transport.reset();
    this.protocolHandler.reset();
    this.activeScenario = undefined;
    this.started = false;
    this.startTime = 0;

    // Re-wire transport
    this.wireTransport();
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Create the mock transport from server config.
   */
  private createTransport(serverConfig: MockMCPServerConfig): MockTransport {
    const transportOptions: MockTransportOptions = {
      transportType: serverConfig.transport,
      connectionTimeout: serverConfig.shutdownTimeoutMs,
    };

    // Apply stdio-specific settings
    if (serverConfig.transport === 'stdio' && serverConfig.stdioConfig) {
      transportOptions.connectionLatencyMs = serverConfig.stdioConfig.startupDelayMs;
    }

    return new MockTransport(transportOptions);
  }

  /**
   * Wire the transport to the protocol handler.
   * When the transport receives a send(), it routes to the protocol handler.
   */
  private wireTransport(): void {
    this.transport.setRequestHandler(async (message: JSONRPCMessage) => {
      if (!isJSONRPCRequest(message)) {
        // Handle notifications from client
        await this.protocolHandler.handleMessage(message);
        return undefined;
      }

      this.emit('request', message);

      // Process through protocol handler
      const { response, notifications } = await this.protocolHandler.handleMessage(message);

      // Emit any pending notifications
      for (const notif of notifications) {
        // Schedule notification emission (slightly delayed to simulate async)
        setTimeout(() => {
          if (this.transport.isConnected()) {
            this.transport.injectMessage(notif);
            this.emit('notification:sent', notif);
          }
        }, 0);
      }

      if (response) {
        this.emit('response', message, response);
      }

      return response;
    });
  }

  /**
   * Resolve the active behavior config (considering active scenario).
   */
  private resolveActiveBehavior(): MockBehaviorConfig {
    if (this.activeScenario) {
      const scenario = this.definition.scenarios.find(
        s => s.name === this.activeScenario
      );
      if (scenario) {
        return scenario.behaviorConfig;
      }
    }
    return this.definition.defaultBehavior;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a simple mock MCP server with tool handlers.
 * Convenience factory for the most common test case.
 *
 * @param name - Server name
 * @param toolHandlers - Tool handlers to register
 * @returns Configured MockMCPServerFacade
 *
 * @example
 * ```typescript
 * const server = createSimpleMockServer('test', [
 *   {
 *     toolName: 'read_file',
 *     response: { content: [{ type: 'text', text: 'hello' }] },
 *   },
 * ]);
 * const client = new MCPClient({ transport: server.getTransport() });
 * ```
 */
export function createSimpleMockServer(
  name: string,
  toolHandlers: MockToolHandler[] = []
): MockMCPServerFacade {
  return new MockMCPServerFacade({
    serverConfig: {
      name,
      transport: 'stdio',
      protocolVersion: '2024-11-05',
      capabilities: { tools: { listChanged: true } },
      serverInfo: { name, version: '1.0.0' },
      autoStart: true,
      maxConnections: 10,
      shutdownTimeoutMs: 5000,
    },
    defaultBehavior: {
      toolHandlers,
      recordRequests: true,
      maxRecordedRequests: 1000,
      validateRequests: true,
      enableDebugLogging: false,
      notificationTriggers: [],
      expectations: [],
    },
    scenarios: [],
  });
}

/**
 * Create a mock MCP server that simulates errors.
 * Convenience factory for error testing scenarios.
 *
 * @param name - Server name
 * @param errorConfig - Error injection configuration
 * @returns Configured MockMCPServerFacade
 */
export function createErrorMockServer(
  name: string,
  errorConfig: Partial<MockErrorInjection> = {}
): MockMCPServerFacade {
  return new MockMCPServerFacade({
    serverConfig: {
      name,
      transport: 'stdio',
      protocolVersion: '2024-11-05',
      capabilities: {},
      serverInfo: { name, version: '1.0.0' },
      autoStart: true,
      maxConnections: 10,
      shutdownTimeoutMs: 5000,
    },
    defaultBehavior: {
      errorInjection: {
        enabled: true,
        probability: 1.0,
        errorCode: -32603,
        errorMessage: 'Mock injected error',
        methods: [],
        afterRequestCount: 0,
        maxErrors: 0,
        simulateConnectionFailure: false,
        errorDelayMs: 0,
        ...errorConfig,
      },
      toolHandlers: [],
      recordRequests: true,
      maxRecordedRequests: 1000,
      validateRequests: true,
      enableDebugLogging: false,
      notificationTriggers: [],
      expectations: [],
    },
    scenarios: [],
  });
}

/**
 * Create a mock MCP server with configurable latency.
 * Convenience factory for timeout and performance testing.
 *
 * @param name - Server name
 * @param delayConfig - Response delay configuration
 * @returns Configured MockMCPServerFacade
 */
export function createSlowMockServer(
  name: string,
  delayConfig: Partial<MockResponseDelay> = {}
): MockMCPServerFacade {
  return new MockMCPServerFacade({
    serverConfig: {
      name,
      transport: 'stdio',
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name, version: '1.0.0' },
      autoStart: true,
      maxConnections: 10,
      shutdownTimeoutMs: 5000,
    },
    defaultBehavior: {
      responseDelay: {
        fixedMs: 1000,
        jitter: false,
        ...delayConfig,
      },
      toolHandlers: [],
      recordRequests: true,
      maxRecordedRequests: 1000,
      validateRequests: true,
      enableDebugLogging: false,
      notificationTriggers: [],
      expectations: [],
    },
    scenarios: [],
  });
}
