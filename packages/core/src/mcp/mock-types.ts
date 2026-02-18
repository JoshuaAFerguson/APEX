/**
 * @fileoverview Mock MCP Server Configuration Types
 *
 * Defines Zod schemas and TypeScript types for configuring mock MCP servers
 * used in testing and development scenarios. These types support:
 * - Mock server network and transport configuration
 * - Response behavior simulation (delays, errors, custom handlers)
 * - Expected request/response pair definitions
 * - Scenario-based behavior for integration testing
 * - Stateful mock behavior for complex interaction flows
 *
 * ## Architecture Decision Record (ADR-026)
 *
 * ### Context
 * APEX needs to test MCP client integrations without requiring real MCP servers.
 * Mock servers must be configurable to:
 * 1. Simulate various transport types (stdio, HTTP, SSE)
 * 2. Advertise specific capabilities during initialization
 * 3. Inject delays and errors for resilience testing
 * 4. Define expected request/response pairs for verification
 * 5. Support scenario-based testing with stateful transitions
 * 6. Trigger notifications at configurable points
 *
 * ### Decision
 * Define mock configuration types in a dedicated file using Zod schemas with inferred
 * TypeScript types, following the established pattern from protocol-types.ts. The design
 * separates concerns into:
 * - **MockMCPServerConfig**: Server identity, transport, and protocol configuration
 * - **MockBehaviorConfig**: Runtime behavior including delays, errors, handlers
 * - **MockRequestResponsePair**: Expected request/response definitions for verification
 * - **MockScenario**: Named collections of behaviors for scenario-based testing
 *
 * ### Consequences
 * - Clean separation between server configuration and behavior configuration
 * - Composable: scenarios can override base behavior for specific test cases
 * - Type-safe mock definitions with runtime validation via Zod
 * - Supports both simple stub responses and complex stateful interactions
 * - Extensible for future mock capabilities without breaking changes
 *
 * @module @apex/core/mcp/mock-types
 */

import { z } from 'zod';
import { MCPServerCapabilitiesSchema, MCPProtocolVersionSchema } from './protocol-types.js';

// ============================================================================
// Transport Configuration
// ============================================================================

/**
 * Transport types supported by mock MCP servers
 */
export const MockTransportTypeSchema = z.enum(['stdio', 'http', 'sse']);
export type MockTransportType = z.infer<typeof MockTransportTypeSchema>;

/**
 * HTTP-specific transport configuration for mock servers
 */
export const MockHttpTransportConfigSchema = z.object({
  /** Host to bind the mock server to */
  host: z.string().default('127.0.0.1'),
  /** Port to listen on (0 for auto-assign) */
  port: z.number().int().min(0).max(65535).default(0),
  /** Base path for the HTTP endpoints */
  basePath: z.string().default('/'),
  /** Whether to enable TLS (for testing HTTPS connections) */
  tls: z.boolean().default(false),
  /** Optional TLS certificate path (required if tls is true) */
  tlsCertPath: z.string().optional(),
  /** Optional TLS key path (required if tls is true) */
  tlsKeyPath: z.string().optional(),
});
export type MockHttpTransportConfig = z.infer<typeof MockHttpTransportConfigSchema>;

/**
 * SSE-specific transport configuration for mock servers
 */
export const MockSseTransportConfigSchema = z.object({
  /** Host to bind the SSE server to */
  host: z.string().default('127.0.0.1'),
  /** Port to listen on (0 for auto-assign) */
  port: z.number().int().min(0).max(65535).default(0),
  /** SSE endpoint path */
  endpoint: z.string().default('/events'),
  /** Keep-alive interval in milliseconds */
  keepAliveMs: z.number().int().min(0).default(15000),
});
export type MockSseTransportConfig = z.infer<typeof MockSseTransportConfigSchema>;

/**
 * Stdio-specific transport configuration for mock servers
 */
export const MockStdioTransportConfigSchema = z.object({
  /** Whether to buffer output (simulates batch mode) */
  bufferOutput: z.boolean().default(false),
  /** Simulated startup delay in milliseconds */
  startupDelayMs: z.number().int().min(0).default(0),
});
export type MockStdioTransportConfig = z.infer<typeof MockStdioTransportConfigSchema>;

// ============================================================================
// Mock MCP Server Configuration
// ============================================================================

/**
 * Configuration for a mock MCP server instance.
 *
 * Defines the server identity, transport layer, capabilities to advertise,
 * and protocol version for initialization handshake simulation.
 *
 * @example
 * ```typescript
 * const config: MockMCPServerConfig = {
 *   name: 'test-filesystem-server',
 *   transport: 'stdio',
 *   protocolVersion: '2024-11-05',
 *   capabilities: {
 *     tools: { listChanged: true },
 *     resources: { subscribe: true },
 *   },
 *   serverInfo: {
 *     name: 'mock-fs-server',
 *     version: '1.0.0',
 *   },
 * };
 * ```
 */
export const MockMCPServerConfigSchema = z.object({
  /** Unique name identifying this mock server instance */
  name: z.string().trim().min(1),

  /** Optional human-readable description */
  description: z.string().optional(),

  /** Transport type for client-server communication */
  transport: MockTransportTypeSchema.default('stdio'),

  /** HTTP transport configuration (used when transport is 'http') */
  httpConfig: MockHttpTransportConfigSchema.optional(),

  /** SSE transport configuration (used when transport is 'sse') */
  sseConfig: MockSseTransportConfigSchema.optional(),

  /** Stdio transport configuration (used when transport is 'stdio') */
  stdioConfig: MockStdioTransportConfigSchema.optional(),

  /** MCP protocol version to advertise during initialization */
  protocolVersion: MCPProtocolVersionSchema.default('2024-11-05'),

  /** Server capabilities to advertise during initialization handshake */
  capabilities: MCPServerCapabilitiesSchema.default({}),

  /** Server implementation info returned during initialization */
  serverInfo: z.object({
    /** Server name */
    name: z.string().default('apex-mock-mcp-server'),
    /** Server version */
    version: z.string().default('1.0.0'),
  }).default({}),

  /** Optional instructions string returned during initialization */
  instructions: z.string().optional(),

  /** Whether the mock server should auto-start when referenced */
  autoStart: z.boolean().default(true),

  /** Maximum concurrent connections (for HTTP/SSE transports) */
  maxConnections: z.number().int().min(1).default(10),

  /** Shutdown timeout in milliseconds */
  shutdownTimeoutMs: z.number().int().min(0).default(5000),
});
export type MockMCPServerConfig = z.infer<typeof MockMCPServerConfigSchema>;

// ============================================================================
// Response Delay Configuration
// ============================================================================

/**
 * Configuration for simulating response delays.
 * Supports fixed delays, ranges, and per-method overrides.
 */
export const MockResponseDelaySchema = z.object({
  /** Fixed delay in milliseconds applied to all responses (overridden by range or per-method) */
  fixedMs: z.number().int().min(0).default(0),

  /** Minimum delay in milliseconds (for random range simulation) */
  minMs: z.number().int().min(0).optional(),

  /** Maximum delay in milliseconds (for random range simulation) */
  maxMs: z.number().int().min(0).optional(),

  /** Per-method delay overrides (key: MCP method name, value: delay in ms) */
  perMethod: z.record(z.string(), z.number().int().min(0)).optional(),

  /** Whether to apply jitter to delays (adds randomness within +/- 10%) */
  jitter: z.boolean().default(false),
});
export type MockResponseDelay = z.infer<typeof MockResponseDelaySchema>;

// ============================================================================
// Error Simulation Configuration Types (ADR-072)
// ============================================================================

/**
 * Error simulation modes for deterministic testing.
 *
 * Unlike probability-based error injection, these modes provide
 * predictable, repeatable error patterns for testing specific scenarios.
 *
 * @see ADR-072 for detailed architecture documentation
 */
export const MockErrorModeSchema = z.enum([
  /** No error simulation (default behavior) */
  'none',
  /** All requests fail with configured error */
  'always_fail',
  /** Requests fail in a repeating pattern (e.g., fail every 3rd request) */
  'periodic_fail',
  /** Requests fail until a specific request count is reached */
  'fail_until',
  /** First N requests fail, then succeed */
  'fail_first_n',
  /** Succeed first N requests, then fail */
  'fail_after_n',
  /** Requests fail based on method name pattern (regex) */
  'method_pattern',
  /** Requests fail based on argument content matching */
  'argument_pattern',
  /** Custom error sequence with specific outcomes per request */
  'sequence',
]);
export type MockErrorMode = z.infer<typeof MockErrorModeSchema>;

/**
 * Categories of errors that can be simulated.
 *
 * Helps organize error presets and enables appropriate error
 * handling testing at different protocol layers.
 */
export const MockErrorCategorySchema = z.enum([
  /** JSON-RPC level errors (parse error, invalid request, method not found) */
  'jsonrpc',
  /** MCP protocol errors (initialization failure, capability mismatch) */
  'protocol',
  /** Transport level errors (connection lost, timeout, malformed data) */
  'transport',
  /** Application level errors (tool execution failure, resource not found) */
  'application',
  /** Network level errors (latency spikes, intermittent connectivity) */
  'network',
]);
export type MockErrorCategory = z.infer<typeof MockErrorCategorySchema>;

/**
 * Predefined error scenarios for common test cases.
 *
 * These presets encapsulate realistic error conditions that MCP clients
 * should handle, making it easy to test against known failure modes.
 */
export const MockErrorScenarioPresetSchema = z.enum([
  /** Server rejects initialization with invalid protocol version */
  'init_protocol_mismatch',
  /** Server rejects initialization with capability negotiation failure */
  'init_capability_rejection',
  /** Server drops connection during initialization handshake */
  'init_connection_drop',
  /** Server sends malformed JSON in response */
  'malformed_response',
  /** Server sends response with mismatched request ID */
  'response_id_mismatch',
  /** Server sends partial response then disconnects */
  'partial_response',
  /** Server becomes unresponsive (infinite delay) */
  'server_hang',
  /** Server rate limits requests */
  'rate_limit',
  /** Server authentication/authorization failure */
  'auth_failure',
  /** Server internal error with stack trace */
  'internal_error_with_details',
  /** Tool not found error */
  'tool_not_found',
  /** Resource access denied */
  'resource_access_denied',
  /** Request timeout */
  'request_timeout',
  /** Connection reset by peer */
  'connection_reset',
  /** Wrong schema: response missing required id field */
  'wrong_schema_missing_id',
  /** Wrong schema: response has invalid result structure */
  'wrong_schema_invalid_result',
  /** Wrong schema: response contains extra unexpected fields */
  'wrong_schema_extra_fields',
]);
export type MockErrorScenarioPreset = z.infer<typeof MockErrorScenarioPresetSchema>;

/**
 * Network condition simulation configuration.
 *
 * Enables simulation of various network conditions for testing
 * resilience, retry logic, and timeout handling.
 */
export const MockNetworkConditionsSchema = z.object({
  /** Base latency to add to all responses (ms) */
  latencyMs: z.number().int().min(0).optional(),

  /** Latency variance for jitter simulation (ms, +/- from base) */
  latencyJitter: z.number().int().min(0).optional(),

  /** Packet loss probability (0.0 to 1.0) */
  packetLoss: z.number().min(0).max(1).optional(),

  /** Bandwidth throttle in bytes per second (0 = unlimited) */
  bandwidth: z.number().int().min(0).optional(),

  /** Connection timeout in milliseconds (0 = infinite, simulates hang) */
  connectionTimeout: z.number().int().min(0).optional(),
});
export type MockNetworkConditions = z.infer<typeof MockNetworkConditionsSchema>;

/**
 * A single outcome in an error sequence.
 *
 * Used with 'sequence' error mode to define exactly what happens
 * on each successive request.
 */
export const MockErrorSequenceItemSchema = z.object({
  /** Whether this request should succeed or fail */
  outcome: z.enum(['success', 'error']),

  /** Error details if outcome is 'error' */
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
  }).optional(),

  /** Optional delay before returning this outcome (ms) */
  delayMs: z.number().int().min(0).optional(),
});
export type MockErrorSequenceItem = z.infer<typeof MockErrorSequenceItemSchema>;

/**
 * Complete error simulation configuration.
 *
 * Provides comprehensive control over error behavior for deterministic
 * testing of error handling, recovery, and retry logic.
 *
 * @example
 * ```typescript
 * // Fail first 3 requests, then succeed
 * const config: MockErrorSimulationConfig = {
 *   mode: 'fail_first_n',
 *   failCount: 3,
 *   category: 'network',
 *   customError: { code: -32000, message: 'Connection refused' },
 * };
 *
 * // Use a preset for common scenarios
 * const config: MockErrorSimulationConfig = {
 *   mode: 'method_pattern',
 *   methodPattern: 'initialize',
 *   preset: 'init_protocol_mismatch',
 * };
 *
 * // Define a specific sequence of outcomes
 * const config: MockErrorSimulationConfig = {
 *   mode: 'sequence',
 *   sequence: [
 *     { outcome: 'error', error: { code: -32603, message: 'First failure' } },
 *     { outcome: 'success' },
 *     { outcome: 'error', error: { code: -32603, message: 'Retry once more' } },
 *     { outcome: 'success' },
 *   ],
 * };
 * ```
 */
export const MockErrorSimulationConfigSchema = z.object({
  /** Error simulation mode (determines how errors are triggered) */
  mode: MockErrorModeSchema.default('none'),

  /** Error category for classification and preset defaults */
  category: MockErrorCategorySchema.default('jsonrpc'),

  /** Use a predefined error scenario preset (sets default error values) */
  preset: MockErrorScenarioPresetSchema.optional(),

  /** Custom error configuration (overrides preset defaults) */
  customError: z.object({
    /** JSON-RPC error code */
    code: z.number(),
    /** Error message */
    message: z.string(),
    /** Additional error data (stack traces, details, etc.) */
    data: z.unknown().optional(),
  }).optional(),

  /** For periodic_fail mode: fail every Nth request (1 = all, 2 = every other, etc.) */
  failPeriod: z.number().int().min(1).optional(),

  /** For fail_first_n and fail_until modes: number of initial failures */
  failCount: z.number().int().min(0).optional(),

  /** For fail_after_n mode: number of successful requests before failing */
  succeedCount: z.number().int().min(0).optional(),

  /** For method_pattern mode: regex pattern to match method names */
  methodPattern: z.string().optional(),

  /** For argument_pattern mode: JSON path and value to match in request args */
  argumentMatcher: z.object({
    /** JSON path expression (e.g., 'name', 'options.verbose') */
    path: z.string(),
    /** Value to match at the path */
    value: z.unknown(),
  }).optional(),

  /** For sequence mode: ordered list of outcomes for successive requests */
  sequence: z.array(MockErrorSequenceItemSchema).optional(),

  /** Network condition simulation (latency, jitter, packet loss) */
  networkConditions: MockNetworkConditionsSchema.optional(),

  /** Which clients are affected ('all' or specific client IDs) */
  affectedClients: z.union([
    z.literal('all'),
    z.array(z.string()),
  ]).default('all'),

  /** Optional description for test documentation */
  description: z.string().optional(),
});
export type MockErrorSimulationConfig = z.infer<typeof MockErrorSimulationConfigSchema>;

// ============================================================================
// Malformed Response Simulation (ADR-072 Extension)
// ============================================================================

/**
 * Types of malformed responses that can be simulated.
 *
 * These types provide fine-grained control over malformed response testing,
 * enabling verification of client resilience against various protocol violations.
 *
 * @see ADR-072 for error simulation architecture
 */
export const MalformedResponseTypeSchema = z.enum([
  /** Response is not valid JSON (causes JSON.parse to throw) */
  'invalid_json',
  /** Response is valid JSON but cut off mid-stream (simulates connection drop) */
  'truncated_json',
  /** Response is valid JSON but doesn't match expected MCP schema */
  'wrong_schema',
  /** Response body is empty (zero bytes) */
  'empty_response',
]);
export type MalformedResponseType = z.infer<typeof MalformedResponseTypeSchema>;

/**
 * Configuration for simulating malformed responses.
 *
 * Provides detailed control over how malformed responses are generated,
 * allowing testing of client error handling for various protocol violations.
 *
 * @example
 * ```typescript
 * // Simulate truncated JSON responses
 * const config: MockMalformedResponseConfig = {
 *   type: 'truncated_json',
 *   truncateAt: '50%',
 *   affectedMethods: ['tools/call'],
 *   probability: 1.0,
 * };
 *
 * // Simulate invalid JSON
 * const config: MockMalformedResponseConfig = {
 *   type: 'invalid_json',
 *   invalidJsonContent: '{"result": undefined}',
 *   affectedMethods: [],
 *   probability: 0.5,
 * };
 *
 * // Simulate wrong schema responses
 * const config: MockMalformedResponseConfig = {
 *   type: 'wrong_schema',
 *   wrongSchemaPayload: { unexpected: 'structure', missing: 'required fields' },
 * };
 * ```
 */
export const MockMalformedResponseConfigSchema = z.object({
  /** Type of malformed response to simulate */
  type: MalformedResponseTypeSchema,

  /**
   * For truncated_json: position where to truncate the response.
   * - Number: byte position (e.g., 100 = truncate at byte 100)
   * - String with %: percentage of response (e.g., '50%' = truncate at halfway point)
   */
  truncateAt: z.union([
    z.number().int().min(0),
    z.string().regex(/^\d+%$/),
  ]).optional(),

  /** For wrong_schema: the invalid payload structure to return instead of valid response */
  wrongSchemaPayload: z.unknown().optional(),

  /** For invalid_json: specific invalid JSON content to return (e.g., '{"key": undefined}') */
  invalidJsonContent: z.string().optional(),

  /** Which MCP methods to apply this malformation to (empty array = all methods) */
  affectedMethods: z.array(z.string()).default([]),

  /** Probability of returning malformed response (0.0 to 1.0, default 1.0 = always) */
  probability: z.number().min(0).max(1).default(1.0),

  /** Optional description for test documentation */
  description: z.string().optional(),
});
export type MockMalformedResponseConfig = z.infer<typeof MockMalformedResponseConfigSchema>;

// ============================================================================
// Error Injection Configuration (Legacy - Probability-Based)
// ============================================================================

/**
 * Defines how errors should be injected into mock server responses.
 *
 * @note For deterministic error testing, prefer MockErrorSimulationConfig.
 * This probability-based configuration is retained for backward compatibility
 * and scenarios where random error injection is desired.
 */
export const MockErrorInjectionSchema = z.object({
  /** Whether error injection is enabled */
  enabled: z.boolean().default(false),

  /** Probability of error (0.0 to 1.0) for random error injection */
  probability: z.number().min(0).max(1).default(0),

  /** JSON-RPC error code to return (defaults to -32603 Internal Error) */
  errorCode: z.number().default(-32603),

  /** Error message to return */
  errorMessage: z.string().default('Mock injected error'),

  /** Optional error data payload */
  errorData: z.unknown().optional(),

  /** Methods to apply error injection to (empty = all methods) */
  methods: z.array(z.string()).default([]),

  /** Number of requests after which to start injecting errors (0 = immediately) */
  afterRequestCount: z.number().int().min(0).default(0),

  /** Maximum number of errors to inject (0 = unlimited) */
  maxErrors: z.number().int().min(0).default(0),

  /** Whether to simulate connection-level failures (transport errors) */
  simulateConnectionFailure: z.boolean().default(false),

  /** Delay before returning error response (simulates slow failures) */
  errorDelayMs: z.number().int().min(0).default(0),
});
export type MockErrorInjection = z.infer<typeof MockErrorInjectionSchema>;

// ============================================================================
// Custom Tool Handlers
// ============================================================================

/**
 * Content item for mock tool responses (text, image, or resource).
 */
export const MockToolResultContentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    /** Text content to return */
    text: z.string(),
  }),
  z.object({
    type: z.literal('image'),
    /** Base64-encoded image data */
    data: z.string(),
    /** MIME type of the image */
    mimeType: z.string(),
  }),
  z.object({
    type: z.literal('resource'),
    resource: z.object({
      /** Resource URI */
      uri: z.string(),
      /** Resource MIME type */
      mimeType: z.string().optional(),
      /** Text content */
      text: z.string().optional(),
      /** Base64-encoded binary content */
      blob: z.string().optional(),
    }),
  }),
]);
export type MockToolResultContent = z.infer<typeof MockToolResultContentSchema>;

/**
 * Dynamic handler function signature for callback-based responses.
 * Allows generating responses based on the actual request parameters.
 *
 * @param toolName - The name of the tool being invoked
 * @param args - The arguments passed to the tool
 * @param context - Additional context about the request
 * @returns Promise resolving to the response content and error status
 */
export type MockDynamicHandlerFunction = (
  toolName: string,
  args: Record<string, unknown>,
  context: {
    requestId: string;
    invocationCount: number;
    timestamp: Date;
  }
) => Promise<{
  content: MockToolResultContent[];
  isError: boolean;
}>;

/**
 * Configuration for a dynamic mock tool handler that generates responses via callback.
 *
 * Dynamic handlers provide maximum flexibility by allowing custom JavaScript functions
 * to generate responses based on the actual request parameters and context.
 *
 * @example
 * ```typescript
 * const dynamicHandler: MockDynamicHandler = {
 *   toolName: 'search',
 *   handler: async (toolName, args, context) => {
 *     const query = args.query as string;
 *     return {
 *       content: [{ type: 'text', text: `Results for: ${query}` }],
 *       isError: false,
 *     };
 *   },
 *   matchArgs: { type: 'web' },
 *   priority: 100,
 * };
 * ```
 */
export const MockDynamicHandlerSchema = z.object({
  /** Name of the tool this handler responds to */
  toolName: z.string().min(1),

  /** Dynamic handler function that generates responses */
  handler: z.function().args(
    z.string(),
    z.record(z.string(), z.unknown()),
    z.object({
      requestId: z.string(),
      invocationCount: z.number(),
      timestamp: z.date(),
    })
  ).returns(z.promise(z.object({
    content: z.array(MockToolResultContentSchema),
    isError: z.boolean(),
  }))),

  /** Optional argument matching: only apply this handler when arguments match */
  matchArgs: z.record(z.string(), z.unknown()).optional(),

  /** Optional delay before executing the handler (ms) */
  delayMs: z.number().int().min(0).optional(),

  /** Maximum number of times this handler should be invoked (0 = unlimited) */
  maxInvocations: z.number().int().min(0).default(0),

  /** Priority level for handler resolution (higher = preferred, default: 50) */
  priority: z.number().int().min(0).default(50),
});
export type MockDynamicHandler = z.infer<typeof MockDynamicHandlerSchema>;

/**
 * Configuration for sequential responses that cycle through predefined responses.
 *
 * Response sequences are useful for testing scenarios where a tool should return
 * different responses on successive calls, such as paginated results or state changes.
 *
 * @example
 * ```typescript
 * const responseSequence: MockResponseSequence = {
 *   toolName: 'get_status',
 *   responses: [
 *     { content: [{ type: 'text', text: 'initializing' }], isError: false },
 *     { content: [{ type: 'text', text: 'ready' }], isError: false },
 *     { content: [{ type: 'text', text: 'complete' }], isError: false },
 *   ],
 *   cycleMode: 'stop_at_end',
 *   priority: 75,
 * };
 * ```
 */
export const MockResponseSequenceSchema = z.object({
  /** Name of the tool this sequence responds to */
  toolName: z.string().min(1),

  /** Ordered array of responses to cycle through */
  responses: z.array(z.object({
    /** Content items to return */
    content: z.array(MockToolResultContentSchema),
    /** Whether to mark the response as an error */
    isError: z.boolean().default(false),
    /** Optional delay before returning this specific response */
    delayMs: z.number().int().min(0).optional(),
  })).min(1),

  /** Optional argument matching: only apply this sequence when arguments match */
  matchArgs: z.record(z.string(), z.unknown()).optional(),

  /**
   * Behavior after reaching the end of the response sequence:
   * - 'cycle': Start over from the beginning (default)
   * - 'repeat_last': Keep returning the last response
   * - 'stop_at_end': Stop handling (falls back to other handlers)
   */
  cycleMode: z.enum(['cycle', 'repeat_last', 'stop_at_end']).default('cycle'),

  /** Priority level for handler resolution (higher = preferred, default: 50) */
  priority: z.number().int().min(0).default(50),
});
export type MockResponseSequence = z.infer<typeof MockResponseSequenceSchema>;

/**
 * Defines a custom handler for a specific tool in the mock server.
 * Specifies what the mock server should return when a tool is called.
 *
 * @example
 * ```typescript
 * const handler: MockToolHandler = {
 *   toolName: 'read_file',
 *   response: {
 *     content: [{ type: 'text', text: 'file contents here' }],
 *     isError: false,
 *   },
 *   matchArgs: { path: '/test/file.txt' },
 *   priority: 75,
 * };
 * ```
 */
export const MockToolHandlerSchema = z.object({
  /** Name of the tool this handler responds to */
  toolName: z.string().min(1),

  /** Static response to return for this tool */
  response: z.object({
    /** Content items to return */
    content: z.array(MockToolResultContentSchema),
    /** Whether to mark the response as an error */
    isError: z.boolean().default(false),
  }),

  /** Optional argument matching: only apply this handler when arguments match */
  matchArgs: z.record(z.string(), z.unknown()).optional(),

  /** Optional delay before returning this specific tool's response */
  delayMs: z.number().int().min(0).optional(),

  /** Maximum number of times this handler should be invoked (0 = unlimited) */
  maxInvocations: z.number().int().min(0).default(0),

  /** Priority level for handler resolution (higher = preferred, default: 50) */
  priority: z.number().int().min(0).default(50),
});
export type MockToolHandler = z.infer<typeof MockToolHandlerSchema>;

// ============================================================================
// Notification Triggers
// ============================================================================

/**
 * Trigger conditions for sending notifications from the mock server.
 */
export const MockNotificationTriggerConditionSchema = z.enum([
  /** Trigger after a specific request count */
  'after_request_count',
  /** Trigger after a specific method is called */
  'after_method',
  /** Trigger after a specified delay from server start */
  'after_delay',
  /** Trigger on every Nth request */
  'periodic',
]);
export type MockNotificationTriggerCondition = z.infer<typeof MockNotificationTriggerConditionSchema>;

/**
 * Configuration for triggering server-to-client notifications.
 *
 * @example
 * ```typescript
 * const trigger: MockNotificationTrigger = {
 *   condition: 'after_method',
 *   method: 'notifications/tools/list_changed',
 *   params: {},
 *   conditionValue: 'tools/call',
 * };
 * ```
 */
export const MockNotificationTriggerSchema = z.object({
  /** Condition that triggers the notification */
  condition: MockNotificationTriggerConditionSchema,

  /** MCP notification method to send (e.g., 'notifications/tools/list_changed') */
  method: z.string().min(1),

  /** Parameters to include in the notification */
  params: z.record(z.string(), z.unknown()).default({}),

  /**
   * Value associated with the condition:
   * - after_request_count: number of requests
   * - after_method: method name that triggers it
   * - after_delay: delay in milliseconds
   * - periodic: interval (every N requests)
   */
  conditionValue: z.union([z.string(), z.number()]),

  /** Whether this trigger fires only once or repeats */
  once: z.boolean().default(true),

  /** Optional delay before sending the notification (ms) */
  delayMs: z.number().int().min(0).default(0),
});
export type MockNotificationTrigger = z.infer<typeof MockNotificationTriggerSchema>;

// ============================================================================
// Stateful Behavior
// ============================================================================

/**
 * Defines a state transition in the mock server's state machine.
 */
export const MockStateTransitionSchema = z.object({
  /** Current state name */
  from: z.string().min(1),

  /** Target state name */
  to: z.string().min(1),

  /** MCP method that triggers this transition */
  onMethod: z.string().min(1),

  /** Optional argument conditions that must match for the transition */
  whenArgs: z.record(z.string(), z.unknown()).optional(),

  /** Optional side effects: notification to emit during transition */
  emitNotification: z.object({
    method: z.string(),
    params: z.record(z.string(), z.unknown()).default({}),
  }).optional(),
});
export type MockStateTransition = z.infer<typeof MockStateTransitionSchema>;

/**
 * Defines state-specific behavior overrides for the mock server.
 * When the mock server is in a particular state, these overrides apply.
 */
export const MockStateBehaviorSchema = z.object({
  /** State name this behavior applies to */
  state: z.string().min(1),

  /** Tool handlers active only in this state */
  toolHandlers: z.array(MockToolHandlerSchema).default([]),

  /** Dynamic tool handlers active only in this state */
  dynamicHandlers: z.array(MockDynamicHandlerSchema).default([]),

  /** Response sequences active only in this state */
  responseSequences: z.array(MockResponseSequenceSchema).default([]),

  /** Error injection config active only in this state */
  errorInjection: MockErrorInjectionSchema.optional(),

  /** Response delay config active only in this state */
  responseDelay: MockResponseDelaySchema.optional(),

  /** Additional capabilities to advertise in this state (merged with base) */
  capabilities: MCPServerCapabilitiesSchema.optional(),
});
export type MockStateBehavior = z.infer<typeof MockStateBehaviorSchema>;

/**
 * Configuration for stateful mock server behavior.
 * Implements a simple state machine for modeling complex interaction sequences.
 *
 * @example
 * ```typescript
 * const stateful: MockStatefulBehaviorConfig = {
 *   initialState: 'idle',
 *   transitions: [
 *     { from: 'idle', to: 'active', onMethod: 'tools/call' },
 *     { from: 'active', to: 'idle', onMethod: 'tools/call', whenArgs: { action: 'reset' } },
 *   ],
 *   stateBehaviors: [
 *     { state: 'active', toolHandlers: [...] },
 *   ],
 * };
 * ```
 */
export const MockStatefulBehaviorConfigSchema = z.object({
  /** Initial state name when the mock server starts */
  initialState: z.string().min(1).default('default'),

  /** State transitions defining the state machine */
  transitions: z.array(MockStateTransitionSchema).default([]),

  /** Per-state behavior overrides */
  stateBehaviors: z.array(MockStateBehaviorSchema).default([]),

  /** Whether to reset state between test scenarios */
  resetOnDisconnect: z.boolean().default(true),
});
export type MockStatefulBehaviorConfig = z.infer<typeof MockStatefulBehaviorConfigSchema>;

// ============================================================================
// Request/Response Pairs (Expectations)
// ============================================================================

/**
 * Request matcher for defining expected request patterns.
 */
export const MockRequestMatcherSchema = z.object({
  /** MCP method name to match */
  method: z.string().min(1),

  /** Optional parameter patterns to match (partial match - all specified keys must match) */
  params: z.record(z.string(), z.unknown()).optional(),

  /** Whether to match params exactly (strict) or partially (default: partial) */
  strictParamMatch: z.boolean().default(false),
});
export type MockRequestMatcher = z.infer<typeof MockRequestMatcherSchema>;

/**
 * Response definition for a matched request.
 */
export const MockResponseDefinitionSchema = z.object({
  /** JSON-RPC result to return on success */
  result: z.unknown().optional(),

  /** JSON-RPC error to return (if simulating an error response) */
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
  }).optional(),

  /** Delay before returning this response (ms) */
  delayMs: z.number().int().min(0).default(0),
});
export type MockResponseDefinition = z.infer<typeof MockResponseDefinitionSchema>;

/**
 * Defines an expected request/response pair for verification.
 * Used to assert that specific requests were made and to provide controlled responses.
 *
 * @example
 * ```typescript
 * const pair: MockRequestResponsePair = {
 *   name: 'list-tools',
 *   request: { method: 'tools/list' },
 *   response: {
 *     result: { tools: [{ name: 'read_file', inputSchema: { type: 'object' } }] },
 *   },
 *   expectedCallCount: 1,
 * };
 * ```
 */
export const MockRequestResponsePairSchema = z.object({
  /** Human-readable name for this expectation */
  name: z.string().min(1),

  /** Request pattern to match */
  request: MockRequestMatcherSchema,

  /** Response to return when the request is matched */
  response: MockResponseDefinitionSchema,

  /** Expected number of times this pair should be matched (0 = any number) */
  expectedCallCount: z.number().int().min(0).default(0),

  /** Whether this pair must be matched at least once for the test to pass */
  required: z.boolean().default(false),

  /** Order index: if set, pairs are matched in order (useful for sequential expectations) */
  order: z.number().int().min(0).optional(),
});
export type MockRequestResponsePair = z.infer<typeof MockRequestResponsePairSchema>;

// ============================================================================
// Mock Behavior Configuration
// ============================================================================

/**
 * Complete behavior configuration for a mock MCP server.
 *
 * Defines how the mock server should respond to requests, including
 * delays, errors, custom tool handlers, notifications, and stateful behavior.
 *
 * @example
 * ```typescript
 * const behavior: MockBehaviorConfig = {
 *   responseDelay: { fixedMs: 100, jitter: true },
 *   errorInjection: { enabled: true, probability: 0.1 },
 *   toolHandlers: [
 *     {
 *       toolName: 'read_file',
 *       response: { content: [{ type: 'text', text: 'mock content' }] },
 *     },
 *   ],
 *   notificationTriggers: [
 *     {
 *       condition: 'after_request_count',
 *       method: 'notifications/tools/list_changed',
 *       params: {},
 *       conditionValue: 5,
 *     },
 *   ],
 * };
 * ```
 */
export const MockBehaviorConfigSchema = z.object({
  /** Response delay simulation configuration */
  responseDelay: MockResponseDelaySchema.optional(),

  /** Error injection configuration */
  errorInjection: MockErrorInjectionSchema.optional(),

  /** Custom tool handlers defining mock responses for specific tools */
  toolHandlers: z.array(MockToolHandlerSchema).default([]),

  /** Dynamic tool handlers with callback-based response generation */
  dynamicHandlers: z.array(MockDynamicHandlerSchema).default([]),

  /** Response sequences for tools that return different responses on successive calls */
  responseSequences: z.array(MockResponseSequenceSchema).default([]),

  /** Notification triggers for server-to-client notifications */
  notificationTriggers: z.array(MockNotificationTriggerSchema).default([]),

  /** Stateful behavior configuration (state machine) */
  statefulBehavior: MockStatefulBehaviorConfigSchema.optional(),

  /** Expected request/response pairs for verification */
  expectations: z.array(MockRequestResponsePairSchema).default([]),

  /** Whether to record all requests for later assertion (default: true) */
  recordRequests: z.boolean().default(true),

  /** Maximum number of requests to record (prevents memory issues in long tests) */
  maxRecordedRequests: z.number().int().min(0).default(1000),

  /** Default response for unhandled tool calls (if not matched by any handler) */
  defaultToolResponse: z.object({
    content: z.array(MockToolResultContentSchema),
    isError: z.boolean().default(false),
  }).optional(),

  /** Whether to validate incoming requests against the MCP protocol schema */
  validateRequests: z.boolean().default(true),

  /** Whether to log all requests/responses for debugging */
  enableDebugLogging: z.boolean().default(false),
});
export type MockBehaviorConfig = z.infer<typeof MockBehaviorConfigSchema>;

// ============================================================================
// Mock Scenarios
// ============================================================================

/**
 * A named scenario combining server config and behavior for a specific test case.
 *
 * Scenarios allow defining reusable, named configurations for common test patterns
 * such as "slow server", "flaky connection", "capability negotiation failure", etc.
 *
 * @example
 * ```typescript
 * const scenario: MockScenario = {
 *   name: 'slow-filesystem-server',
 *   description: 'Simulates a filesystem server with high latency',
 *   serverConfig: {
 *     name: 'slow-fs',
 *     transport: 'stdio',
 *     capabilities: { tools: {} },
 *   },
 *   behaviorConfig: {
 *     responseDelay: { minMs: 500, maxMs: 2000, jitter: true },
 *     toolHandlers: [{
 *       toolName: 'read_file',
 *       response: { content: [{ type: 'text', text: 'delayed content' }] },
 *     }],
 *   },
 * };
 * ```
 */
export const MockScenarioSchema = z.object({
  /** Unique scenario name */
  name: z.string().min(1),

  /** Human-readable description of what this scenario tests */
  description: z.string().optional(),

  /** Server configuration for this scenario */
  serverConfig: MockMCPServerConfigSchema,

  /** Behavior configuration for this scenario */
  behaviorConfig: MockBehaviorConfigSchema.default({}),

  /** Tags for categorizing and filtering scenarios */
  tags: z.array(z.string()).default([]),

  /** Setup hook: notifications to emit immediately on connection */
  onConnect: z.array(z.object({
    method: z.string(),
    params: z.record(z.string(), z.unknown()).default({}),
    delayMs: z.number().int().min(0).default(0),
  })).default([]),

  /** Teardown hook: notifications to emit before disconnection */
  onDisconnect: z.array(z.object({
    method: z.string(),
    params: z.record(z.string(), z.unknown()).default({}),
  })).default([]),
});
export type MockScenario = z.infer<typeof MockScenarioSchema>;

// ============================================================================
// Complete Mock Server Definition
// ============================================================================

/**
 * Complete mock MCP server definition combining server config, behavior, and scenarios.
 *
 * This is the top-level type used to fully define a mock MCP server for testing.
 * It includes the base server configuration, default behavior, and optional
 * named scenarios that can override the defaults.
 *
 * @example
 * ```typescript
 * const mockServer: MockMCPServerDefinition = {
 *   serverConfig: {
 *     name: 'test-server',
 *     transport: 'stdio',
 *     capabilities: { tools: { listChanged: true } },
 *   },
 *   defaultBehavior: {
 *     toolHandlers: [...],
 *     recordRequests: true,
 *   },
 *   scenarios: [
 *     { name: 'error-mode', behaviorConfig: { errorInjection: { enabled: true, probability: 1.0 } } },
 *   ],
 * };
 * ```
 */
export const MockMCPServerDefinitionSchema = z.object({
  /** Base server configuration */
  serverConfig: MockMCPServerConfigSchema,

  /** Default behavior applied when no scenario is active */
  defaultBehavior: MockBehaviorConfigSchema.default({}),

  /** Named scenarios that override the default behavior */
  scenarios: z.array(MockScenarioSchema).default([]),

  /** Active scenario name (if set, this scenario's config is used) */
  activeScenario: z.string().optional(),
});
export type MockMCPServerDefinition = z.infer<typeof MockMCPServerDefinitionSchema>;
