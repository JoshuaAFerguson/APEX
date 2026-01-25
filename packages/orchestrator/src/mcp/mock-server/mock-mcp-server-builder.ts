/**
 * @fileoverview MockMCPServerBuilder - Fluent API for Mock Server Configuration
 *
 * Provides a chainable, fluent API for building MockMCPServerDefinition objects
 * with intuitive method names and easy configuration. This builder pattern
 * makes it simple to create mock servers for testing without dealing with
 * complex configuration objects directly.
 *
 * @module orchestrator/mcp/mock-server/mock-mcp-server-builder
 */

import type {
  MockMCPServerDefinition,
  MockMCPServerConfig,
  MockBehaviorConfig,
  MockToolHandler,
  MockDynamicHandler,
  MockResponseSequence,
  MockResponseDelay,
  MockErrorInjection,
  MockScenario,
  MockToolResultContent,
  MockDynamicHandlerFunction,
  MockTransportType,
  MCPServerCapabilities,
  MockErrorSimulationConfig,
  MockNetworkConditions,
  MockErrorScenarioPreset,
} from '@apexcli/core';
import { MockMCPServerFacade } from './mock-server-facade.js';
import { MockMCPServer } from './mock-mcp-server.js';

// ============================================================================
// MockMCPServerBuilder
// ============================================================================

/**
 * Fluent API builder for creating MockMCPServerDefinition objects.
 *
 * Provides chainable methods to configure server identity, transport settings,
 * tool responses, behavior simulation, and testing scenarios in a readable,
 * intuitive way.
 *
 * @example
 * ```typescript
 * const server = new MockMCPServerBuilder()
 *   .withName('test-filesystem')
 *   .withTool('read_file')
 *     .withStaticResponse([{ type: 'text', text: 'file content' }])
 *   .withTool('write_file')
 *     .withDynamicHandler(async (toolName, args, context) => ({
 *       content: [{ type: 'text', text: `Wrote to ${args.path}` }],
 *       isError: false,
 *     }))
 *   .withDelay(100, 200) // Random delay between 100-200ms
 *   .build();
 *
 * const client = new MCPClient({ transport: server.getTransport() });
 * ```
 */
export class MockMCPServerBuilder {
  private serverConfig: Partial<MockMCPServerConfig> = {};
  private defaultBehavior: Partial<MockBehaviorConfig> = {};
  private scenarios: MockScenario[] = [];
  private activeScenario?: string;

  /** Error simulation configuration (ADR-072) */
  private errorSimulationConfig?: MockErrorSimulationConfig;

  // Current tool being configured (for fluent tool configuration)
  private currentTool?: {
    toolName: string;
    handler?: MockToolHandler;
    dynamicHandler?: MockDynamicHandler;
    responseSequence?: MockResponseSequence;
  };

  /**
   * Set the server name and description.
   *
   * @param name - Unique server name
   * @param description - Optional human-readable description
   * @returns This builder instance for chaining
   *
   * @example
   * ```typescript
   * builder.withName('test-server', 'A test server for unit tests')
   * ```
   */
  withName(name: string, description?: string): this {
    this.serverConfig.name = name;
    if (description) {
      this.serverConfig.description = description;
    }
    return this;
  }

  /**
   * Set the transport type for the server.
   *
   * @param transport - Transport type ('stdio', 'http', 'sse')
   * @returns This builder instance for chaining
   *
   * @example
   * ```typescript
   * builder.withTransport('stdio')
   * ```
   */
  withTransport(transport: MockTransportType): this {
    this.serverConfig.transport = transport;
    return this;
  }

  /**
   * Set server capabilities to advertise during initialization.
   *
   * @param capabilities - MCP server capabilities
   * @returns This builder instance for chaining
   *
   * @example
   * ```typescript
   * builder.withCapabilities({ tools: { listChanged: true }, resources: {} })
   * ```
   */
  withCapabilities(capabilities: MCPServerCapabilities): this {
    this.serverConfig.capabilities = capabilities;
    return this;
  }

  /**
   * Start configuring a tool handler. This sets the current tool context
   * for subsequent handler configuration methods.
   *
   * @param toolName - Name of the tool to configure
   * @returns This builder instance for chaining
   *
   * @example
   * ```typescript
   * builder
   *   .withTool('read_file')
   *     .withStaticResponse([{ type: 'text', text: 'content' }])
   *   .withTool('write_file')
   *     .withDynamicHandler(async (name, args) => ({ ... }))
   * ```
   */
  withTool(toolName: string): this {
    // Finalize any previous tool configuration
    this.finalizeTool();

    this.currentTool = { toolName };
    return this;
  }

  /**
   * Configure a static response for the current tool.
   * Must be called after withTool().
   *
   * @param content - Content items to return
   * @param isError - Whether to mark the response as an error (default: false)
   * @returns This builder instance for chaining
   *
   * @example
   * ```typescript
   * builder
   *   .withTool('read_file')
   *   .withStaticResponse([
   *     { type: 'text', text: 'Hello, World!' }
   *   ])
   * ```
   */
  withStaticResponse(content: MockToolResultContent[], isError = false): this {
    if (!this.currentTool) {
      throw new Error('withStaticResponse() must be called after withTool()');
    }

    this.currentTool.handler = {
      toolName: this.currentTool.toolName,
      response: { content, isError },
      priority: 50,
    };
    return this;
  }

  /**
   * Configure a dynamic handler function for the current tool.
   * Must be called after withTool().
   *
   * @param handler - Function that generates responses based on request
   * @param options - Optional configuration for the handler
   * @returns This builder instance for chaining
   *
   * @example
   * ```typescript
   * builder
   *   .withTool('search')
   *   .withDynamicHandler(async (toolName, args, context) => {
   *     const query = args.query as string;
   *     return {
   *       content: [{ type: 'text', text: `Results for: ${query}` }],
   *       isError: false,
   *     };
   *   }, { priority: 100, maxInvocations: 5 })
   * ```
   */
  withDynamicHandler(
    handler: MockDynamicHandlerFunction,
    options: {
      matchArgs?: Record<string, unknown>;
      delayMs?: number;
      maxInvocations?: number;
      priority?: number;
    } = {}
  ): this {
    if (!this.currentTool) {
      throw new Error('withDynamicHandler() must be called after withTool()');
    }

    this.currentTool.dynamicHandler = {
      toolName: this.currentTool.toolName,
      handler,
      matchArgs: options.matchArgs,
      delayMs: options.delayMs,
      maxInvocations: options.maxInvocations ?? 0,
      priority: options.priority ?? 50,
    };
    return this;
  }

  /**
   * Configure a sequence of responses for the current tool.
   * Must be called after withTool().
   *
   * @param responses - Array of responses to cycle through
   * @param cycleMode - What to do after reaching the end
   * @returns This builder instance for chaining
   *
   * @example
   * ```typescript
   * builder
   *   .withTool('get_status')
   *   .withResponseSequence([
   *     { content: [{ type: 'text', text: 'initializing' }], isError: false },
   *     { content: [{ type: 'text', text: 'ready' }], isError: false },
   *     { content: [{ type: 'text', text: 'complete' }], isError: false },
   *   ], 'stop_at_end')
   * ```
   */
  withResponseSequence(
    responses: Array<{
      content: MockToolResultContent[];
      isError?: boolean;
      delayMs?: number;
    }>,
    cycleMode: 'cycle' | 'repeat_last' | 'stop_at_end' = 'cycle'
  ): this {
    if (!this.currentTool) {
      throw new Error('withResponseSequence() must be called after withTool()');
    }

    this.currentTool.responseSequence = {
      toolName: this.currentTool.toolName,
      responses: responses.map(r => ({
        content: r.content,
        isError: r.isError ?? false,
        delayMs: r.delayMs,
      })),
      cycleMode,
      priority: 50,
    };
    return this;
  }

  /**
   * Configure response delays for all methods.
   *
   * @param fixedMs - Fixed delay in milliseconds, OR minimum delay if maxMs provided
   * @param maxMs - Optional maximum delay for random range
   * @param jitter - Whether to apply jitter (default: false)
   * @returns This builder instance for chaining
   *
   * @example
   * ```typescript
   * // Fixed 100ms delay
   * builder.withDelay(100)
   *
   * // Random delay between 50-150ms
   * builder.withDelay(50, 150)
   *
   * // Fixed delay with jitter
   * builder.withDelay(100, undefined, true)
   * ```
   */
  withDelay(fixedMs: number, maxMs?: number, jitter = false): this {
    const delayConfig: MockResponseDelay = {
      fixedMs: maxMs === undefined ? fixedMs : 0,
      minMs: maxMs !== undefined ? fixedMs : undefined,
      maxMs,
      jitter,
      perMethod: this.defaultBehavior.responseDelay?.perMethod,
    };

    this.defaultBehavior.responseDelay = delayConfig;
    return this;
  }

  /**
   * Configure delay for a specific method.
   *
   * @param method - MCP method name (e.g., 'tools/call', 'initialize')
   * @param delayMs - Delay in milliseconds for this method
   * @returns This builder instance for chaining
   *
   * @example
   * ```typescript
   * builder
   *   .withDelay(50) // Default for all methods
   *   .withDelayForMethod('tools/call', 200) // Override for tool calls
   *   .withDelayForMethod('initialize', 10) // Fast initialization
   * ```
   */
  withDelayForMethod(method: string, delayMs: number): this {
    if (!this.defaultBehavior.responseDelay) {
      this.defaultBehavior.responseDelay = {
        fixedMs: 0,
        jitter: false,
        perMethod: {},
      };
    }

    this.defaultBehavior.responseDelay.perMethod = {
      ...this.defaultBehavior.responseDelay.perMethod,
      [method]: delayMs,
    };
    return this;
  }

  /**
   * Configure error injection for testing error handling.
   *
   * @param config - Error injection configuration
   * @returns This builder instance for chaining
   *
   * @note For deterministic error testing, prefer withErrorSimulation() instead.
   *
   * @example
   * ```typescript
   * builder.withErrorInjection({
   *   enabled: true,
   *   probability: 0.1, // 10% of requests fail
   *   errorMessage: 'Simulated network error',
   *   methods: ['tools/call'], // Only inject errors for tool calls
   * })
   * ```
   */
  withErrorInjection(config: Partial<MockErrorInjection>): this {
    this.defaultBehavior.errorInjection = {
      enabled: false,
      probability: 0,
      errorCode: -32603,
      errorMessage: 'Mock injected error',
      methods: [],
      afterRequestCount: 0,
      maxErrors: 0,
      simulateConnectionFailure: false,
      errorDelayMs: 0,
      ...config,
    };
    return this;
  }

  // ==========================================================================
  // Error Simulation (ADR-072)
  // ==========================================================================

  /**
   * Configure error simulation for deterministic error testing.
   *
   * Unlike probability-based error injection, error simulation modes provide
   * predictable, repeatable error patterns for testing specific scenarios.
   *
   * @param config - Error simulation configuration
   * @returns This builder instance for chaining
   *
   * @example
   * ```typescript
   * // Fail first 3 requests, then succeed
   * builder.withErrorSimulation({
   *   mode: 'fail_first_n',
   *   failCount: 3,
   *   customError: { code: -32603, message: 'Service starting up' }
   * });
   *
   * // Periodic failures (every 3rd request)
   * builder.withErrorSimulation({
   *   mode: 'periodic_fail',
   *   failPeriod: 3,
   *   preset: 'internal_error_with_details'
   * });
   *
   * // Specific error sequence
   * builder.withErrorSimulation({
   *   mode: 'sequence',
   *   sequence: [
   *     { outcome: 'error', error: { code: -32603, message: 'Retry' } },
   *     { outcome: 'success' },
   *   ]
   * });
   * ```
   */
  withErrorSimulation(config: MockErrorSimulationConfig): this {
    this.errorSimulationConfig = config;
    return this;
  }

  /**
   * Configure network condition simulation.
   *
   * Enables simulation of various network conditions for testing
   * resilience, retry logic, and timeout handling.
   *
   * @param conditions - Network conditions to simulate
   * @returns This builder instance for chaining
   *
   * @example
   * ```typescript
   * // Simulate slow network with jitter
   * builder.withNetworkConditions({
   *   latencyMs: 500,
   *   latencyJitter: 100,
   * });
   *
   * // Simulate unreliable network
   * builder.withNetworkConditions({
   *   latencyMs: 100,
   *   packetLoss: 0.05, // 5% packet loss
   * });
   * ```
   */
  withNetworkConditions(conditions: MockNetworkConditions): this {
    if (!this.errorSimulationConfig) {
      this.errorSimulationConfig = {
        mode: 'none',
        category: 'network',
        networkConditions: conditions,
        affectedClients: 'all',
      };
    } else {
      this.errorSimulationConfig.networkConditions = conditions;
    }
    return this;
  }

  /**
   * Apply a preset error scenario.
   *
   * This is a convenience method for common error testing scenarios.
   *
   * @param preset - The preset scenario to apply
   * @returns This builder instance for chaining
   *
   * @example
   * ```typescript
   * // Simulate initialization failure
   * builder.withErrorPreset('init_connection_drop');
   *
   * // Simulate rate limiting
   * builder.withErrorPreset('rate_limit');
   *
   * // Simulate authentication failure
   * builder.withErrorPreset('auth_failure');
   * ```
   */
  withErrorPreset(preset: MockErrorScenarioPreset): this {
    this.errorSimulationConfig = {
      mode: 'always_fail',
      category: 'jsonrpc',
      preset,
      affectedClients: 'all',
    };
    return this;
  }

  /**
   * Add a named scenario with specific configuration overrides.
   * Scenarios allow switching behavior during tests.
   *
   * @param name - Unique scenario name
   * @param configureScenario - Function to configure the scenario
   * @returns This builder instance for chaining
   *
   * @example
   * ```typescript
   * builder
   *   .withScenario('error-mode', scenario => scenario
   *     .withErrorInjection({ enabled: true, probability: 1.0 })
   *   )
   *   .withScenario('slow-mode', scenario => scenario
   *     .withDelay(1000, 2000)
   *   )
   * ```
   */
  withScenario(name: string, configureScenario: (builder: MockMCPServerBuilder) => MockMCPServerBuilder): this {
    // Create a new builder for the scenario configuration
    const scenarioBuilder = new MockMCPServerBuilder();

    // Copy the base server config to the scenario
    scenarioBuilder.serverConfig = { ...this.serverConfig };

    // Let the user configure the scenario
    const configuredScenario = configureScenario(scenarioBuilder);

    // Finalize any tool configuration
    configuredScenario.finalizeTool();

    // Create the scenario object
    const scenario: MockScenario = {
      name,
      serverConfig: {
        name: 'mock-server',
        transport: 'stdio',
        protocolVersion: '2024-11-05',
        capabilities: {},
        serverInfo: { name: 'mock-server', version: '1.0.0' },
        autoStart: true,
        maxConnections: 10,
        shutdownTimeoutMs: 5000,
        ...configuredScenario.serverConfig,
      } as MockMCPServerConfig,
      behaviorConfig: {
        toolHandlers: [],
        recordRequests: true,
        maxRecordedRequests: 1000,
        validateRequests: true,
        enableDebugLogging: false,
        notificationTriggers: [],
        expectations: [],
        ...configuredScenario.defaultBehavior,
      } as MockBehaviorConfig,
      tags: [],
      onConnect: [],
      onDisconnect: [],
    };

    this.scenarios.push(scenario);
    return this;
  }

  /**
   * Set which scenario should be active by default.
   *
   * @param scenarioName - Name of the scenario to activate
   * @returns This builder instance for chaining
   *
   * @example
   * ```typescript
   * builder
   *   .withScenario('test-mode', scenario => scenario.withDelay(100))
   *   .withActiveScenario('test-mode')
   * ```
   */
  withActiveScenario(scenarioName: string): this {
    this.activeScenario = scenarioName;
    return this;
  }

  /**
   * Build and return a MockMCPServerFacade instance.
   * This is the most convenient way to get a ready-to-use mock server.
   *
   * @returns Configured MockMCPServerFacade
   *
   * @example
   * ```typescript
   * const server = new MockMCPServerBuilder()
   *   .withName('test-server')
   *   .withTool('ping').withStaticResponse([{ type: 'text', text: 'pong' }])
   *   .build();
   *
   * const client = new MCPClient({ transport: server.getTransport() });
   * ```
   */
  build(): MockMCPServerFacade {
    const facade = new MockMCPServerFacade(this.buildDefinition());

    // Apply error simulation if configured
    if (this.errorSimulationConfig) {
      facade.setErrorMode(this.errorSimulationConfig);
    }

    return facade;
  }

  /**
   * Build and return a MockMCPServer instance.
   * Use this for lower-level server control and multi-client scenarios.
   *
   * @returns Configured MockMCPServer
   *
   * @example
   * ```typescript
   * const server = new MockMCPServerBuilder()
   *   .withName('multi-client-server')
   *   .buildServer();
   *
   * await server.start();
   * const transport1 = server.createClientTransport();
   * const transport2 = server.createClientTransport();
   * ```
   */
  buildServer(): MockMCPServer {
    const server = new MockMCPServer(this.buildDefinition());

    // Apply error simulation if configured
    if (this.errorSimulationConfig) {
      server.setErrorMode(this.errorSimulationConfig);
    }

    return server;
  }

  /**
   * Build and return the raw MockMCPServerDefinition.
   * Use this for advanced scenarios or custom server implementations.
   *
   * @returns Complete MockMCPServerDefinition
   */
  buildDefinition(): MockMCPServerDefinition {
    // Finalize any pending tool configuration
    this.finalizeTool();

    // Build default server configuration
    const serverConfig: MockMCPServerConfig = {
      name: 'mock-server',
      transport: 'stdio',
      protocolVersion: '2024-11-05',
      capabilities: {},
      serverInfo: { name: 'mock-server', version: '1.0.0' },
      autoStart: true,
      maxConnections: 10,
      shutdownTimeoutMs: 5000,
      ...this.serverConfig,
    };

    // Build default behavior configuration
    const defaultBehavior: MockBehaviorConfig = {
      toolHandlers: [],
      recordRequests: true,
      maxRecordedRequests: 1000,
      validateRequests: true,
      enableDebugLogging: false,
      notificationTriggers: [],
      expectations: [],
      ...this.defaultBehavior,
    };

    // Ensure the server name is set
    if (!serverConfig.name) {
      throw new Error('Server name is required. Call withName() to set it.');
    }

    return {
      serverConfig,
      defaultBehavior,
      scenarios: this.scenarios,
      activeScenario: this.activeScenario,
    };
  }

  /**
   * Finalize the current tool configuration and add it to the behavior config
   */
  private finalizeTool(): void {
    if (!this.currentTool) {
      return;
    }

    // Ensure we have at least one handler configured
    const hasHandler = !!(
      this.currentTool.handler ||
      this.currentTool.dynamicHandler ||
      this.currentTool.responseSequence
    );

    if (!hasHandler) {
      throw new Error(
        `Tool '${this.currentTool.toolName}' was declared with withTool() but no handler was configured. ` +
        'Use withStaticResponse(), withDynamicHandler(), or withResponseSequence().'
      );
    }

    // Initialize tool handler arrays if needed
    if (!this.defaultBehavior.toolHandlers) {
      this.defaultBehavior.toolHandlers = [];
    }
    if (!this.defaultBehavior.dynamicHandlers) {
      this.defaultBehavior.dynamicHandlers = [];
    }
    if (!this.defaultBehavior.responseSequences) {
      this.defaultBehavior.responseSequences = [];
    }

    // Add the configured handler(s)
    if (this.currentTool.handler) {
      this.defaultBehavior.toolHandlers.push(this.currentTool.handler);
    }
    if (this.currentTool.dynamicHandler) {
      this.defaultBehavior.dynamicHandlers.push(this.currentTool.dynamicHandler);
    }
    if (this.currentTool.responseSequence) {
      this.defaultBehavior.responseSequences.push(this.currentTool.responseSequence);
    }

    // Clear current tool
    this.currentTool = undefined;
  }
}

/**
 * Create a new MockMCPServerBuilder instance.
 * Convenience function for starting the fluent API.
 *
 * @returns New builder instance
 *
 * @example
 * ```typescript
 * import { createMockServerBuilder } from '@apexcli/orchestrator/mcp/mock-server';
 *
 * const server = createMockServerBuilder()
 *   .withName('test-server')
 *   .withTool('ping').withStaticResponse([{ type: 'text', text: 'pong' }])
 *   .build();
 * ```
 */
export function createMockServerBuilder(): MockMCPServerBuilder {
  return new MockMCPServerBuilder();
}