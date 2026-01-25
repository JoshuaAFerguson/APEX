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
// Error Injection Configuration
// ============================================================================

/**
 * Defines how errors should be injected into mock server responses.
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
