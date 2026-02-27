/**
 * @fileoverview Internal Types for Mock MCP Server
 *
 * Defines all types used by the mock MCP server components.
 * These types are mock-server-specific and defined locally rather than
 * imported from @apexcli/core, since they are test infrastructure types.
 *
 * @module orchestrator/mcp/mock-server/types
 */

import type { JSONRPCRequest, JSONRPCResponse, JSONRPCNotification } from '../types.js';

// ============================================================================
// Mock Transport Type
// ============================================================================

/**
 * Transport types supported by the mock server
 */
export type MockTransportType = 'stdio' | 'http' | 'sse';

// ============================================================================
// MCP Server Capabilities
// ============================================================================

/**
 * MCP server capabilities advertised during initialization
 */
export interface MCPServerCapabilities {
  tools?: { listChanged?: boolean };
  resources?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
  logging?: Record<string, unknown>;
  [key: string]: unknown;
}

// ============================================================================
// Mock MCP Server Configuration Types
// ============================================================================

/**
 * Configuration for a mock MCP server instance
 */
export interface MockMCPServerConfig {
  /** Unique server name */
  name: string;
  /** Optional description */
  description?: string;
  /** Transport type */
  transport: MockTransportType;
  /** MCP protocol version to advertise */
  protocolVersion: string;
  /** Server capabilities to advertise */
  capabilities: MCPServerCapabilities;
  /** Server info for initialization response */
  serverInfo: { name: string; version: string };
  /** Optional instructions to send during initialization */
  instructions?: string;
  /** Whether to auto-start the server */
  autoStart: boolean;
  /** Maximum concurrent connections */
  maxConnections: number;
  /** Shutdown timeout in milliseconds */
  shutdownTimeoutMs: number;
  /** Stdio-specific configuration */
  stdioConfig?: {
    startupDelayMs?: number;
  };
}

/**
 * Content item in a tool result response
 */
export interface MockToolResultContent {
  /** Content type (text, image, etc.) */
  type: string;
  /** Text content */
  text?: string;
  /** Additional content properties */
  [key: string]: unknown;
}

/**
 * Static tool handler configuration
 */
export interface MockToolHandler {
  /** Name of the tool this handler handles */
  toolName: string;
  /** Static response to return */
  response: {
    content: MockToolResultContent[];
    isError: boolean;
  };
  /** Optional argument matching for conditional responses */
  matchArgs?: Record<string, unknown>;
  /** Maximum number of invocations (0 = unlimited) */
  maxInvocations?: number;
  /** Delay before responding in ms */
  delayMs?: number;
  /** Priority for handler selection (higher = preferred) */
  priority?: number;
}

/**
 * Function type for dynamic tool handlers
 */
export type MockDynamicHandlerFunction = (
  toolName: string,
  args: Record<string, unknown>,
  context: {
    requestId: string;
    invocationCount: number;
    timestamp: Date;
  }
) => Promise<{ content: MockToolResultContent[]; isError: boolean }>;

/**
 * Dynamic tool handler that generates responses programmatically
 */
export interface MockDynamicHandler {
  /** Name of the tool this handler handles */
  toolName: string;
  /** Handler function */
  handler: MockDynamicHandlerFunction;
  /** Optional argument matching */
  matchArgs?: Record<string, unknown>;
  /** Delay before responding in ms */
  delayMs?: number;
  /** Maximum number of invocations (0 = unlimited) */
  maxInvocations: number;
  /** Priority for handler selection */
  priority: number;
}

/**
 * Response sequence for a tool (returns different responses on successive calls)
 */
export interface MockResponseSequence {
  /** Name of the tool this sequence handles */
  toolName: string;
  /** Ordered list of responses */
  responses: Array<{
    content: MockToolResultContent[];
    isError: boolean;
    delayMs?: number;
  }>;
  /** Optional argument matching */
  matchArgs?: Record<string, unknown>;
  /** What to do when sequence is exhausted */
  cycleMode: 'cycle' | 'repeat_last' | 'stop_at_end';
  /** Priority for handler selection */
  priority: number;
}

/**
 * Response delay configuration
 */
export interface MockResponseDelay {
  /** Fixed delay in milliseconds */
  fixedMs?: number;
  /** Minimum delay for random range */
  minMs?: number;
  /** Maximum delay for random range */
  maxMs?: number;
  /** Whether to apply jitter (±10%) */
  jitter?: boolean;
  /** Per-method delay overrides */
  perMethod?: Record<string, number>;
}

/**
 * Error injection configuration
 */
export interface MockErrorInjection {
  /** Whether error injection is enabled */
  enabled: boolean;
  /** Probability of injecting an error (0.0 to 1.0) */
  probability: number;
  /** Error code to return */
  errorCode: number;
  /** Error message to return */
  errorMessage: string;
  /** Optional error data */
  errorData?: unknown;
  /** Methods to inject errors for (empty = all methods) */
  methods: string[];
  /** Only start injecting after this many requests */
  afterRequestCount: number;
  /** Maximum number of errors to inject (0 = unlimited) */
  maxErrors: number;
  /** Whether to simulate connection failure */
  simulateConnectionFailure: boolean;
  /** Delay before returning error response in ms */
  errorDelayMs: number;
}

/**
 * Notification trigger configuration
 */
export interface MockNotificationTrigger {
  /** Trigger condition type */
  condition: 'after_request_count' | 'after_method' | 'after_delay' | 'periodic';
  /** Value for the trigger condition */
  conditionValue: string | number;
  /** Notification method to send */
  method: string;
  /** Notification params to send */
  params?: Record<string, unknown>;
  /** Whether the trigger fires only once */
  once: boolean;
  /** Delay before sending the notification in ms */
  delayMs?: number;
}

/**
 * State transition in a stateful behavior configuration
 */
export interface MockStateTransition {
  /** Source state */
  from: string;
  /** Target state */
  to: string;
  /** Method that triggers this transition */
  onMethod: string;
  /** Optional argument condition */
  whenArgs?: Record<string, unknown>;
  /** Optional notification to emit on transition */
  emitNotification?: {
    method: string;
    params?: Record<string, unknown>;
  };
}

/**
 * Behavior overrides for a specific state
 */
export interface MockStateBehavior {
  /** State name this behavior applies to */
  state: string;
  /** Tool handlers active in this state */
  toolHandlers: MockToolHandler[];
  /** Dynamic handlers active in this state */
  dynamicHandlers: MockDynamicHandler[];
  /** Response sequences active in this state */
  responseSequences: MockResponseSequence[];
  /** Response delay override for this state */
  responseDelay?: MockResponseDelay;
  /** Error injection override for this state */
  errorInjection?: MockErrorInjection;
}

/**
 * Stateful behavior configuration (state machine)
 */
export interface MockStatefulBehaviorConfig {
  /** Initial state */
  initialState: string;
  /** State transitions */
  transitions: MockStateTransition[];
  /** Per-state behavior overrides */
  stateBehaviors: MockStateBehavior[];
}

/**
 * Mock behavior configuration
 */
export interface MockBehaviorConfig {
  /** Static tool handlers */
  toolHandlers: MockToolHandler[];
  /** Dynamic tool handlers */
  dynamicHandlers?: MockDynamicHandler[];
  /** Response sequences */
  responseSequences?: MockResponseSequence[];
  /** Response delay configuration */
  responseDelay?: MockResponseDelay;
  /** Error injection configuration */
  errorInjection?: MockErrorInjection;
  /** Default response for unhandled tools */
  defaultToolResponse?: {
    content: MockToolResultContent[];
    isError: boolean;
  };
  /** Whether to record requests */
  recordRequests: boolean;
  /** Maximum recorded requests to keep */
  maxRecordedRequests: number;
  /** Whether to validate incoming requests */
  validateRequests: boolean;
  /** Whether to enable debug logging */
  enableDebugLogging: boolean;
  /** Notification triggers */
  notificationTriggers: MockNotificationTrigger[];
  /** Stateful behavior (state machine) */
  statefulBehavior?: MockStatefulBehaviorConfig;
  /** State machine (alias for statefulBehavior) */
  stateMachine?: MockStatefulBehaviorConfig;
  /** Test expectations */
  expectations: unknown[];
}

/**
 * Test scenario configuration
 */
export interface MockScenario {
  /** Scenario name */
  name: string;
  /** Server config overrides for this scenario */
  serverConfig: MockMCPServerConfig;
  /** Behavior config overrides for this scenario */
  behaviorConfig: MockBehaviorConfig;
  /** Tags for categorizing scenarios */
  tags: string[];
  /** Actions on client connect */
  onConnect: unknown[];
  /** Actions on client disconnect */
  onDisconnect: unknown[];
}

/**
 * Complete mock MCP server definition
 */
export interface MockMCPServerDefinition {
  /** Server configuration */
  serverConfig: MockMCPServerConfig;
  /** Default behavior configuration */
  defaultBehavior: MockBehaviorConfig;
  /** Named test scenarios */
  scenarios: MockScenario[];
  /** Active scenario name */
  activeScenario?: string;
}

// ============================================================================
// Error Simulation Types (ADR-072)
// ============================================================================

/**
 * Preset error scenario names
 */
export type MockErrorScenarioPreset =
  | 'init_protocol_mismatch'
  | 'init_capability_rejection'
  | 'init_connection_drop'
  | 'malformed_response'
  | 'response_id_mismatch'
  | 'partial_response'
  | 'server_hang'
  | 'rate_limit'
  | 'auth_failure'
  | 'internal_error_with_details'
  | 'tool_not_found'
  | 'resource_access_denied'
  | 'request_timeout'
  | 'connection_reset'
  | 'wrong_schema_missing_id'
  | 'wrong_schema_invalid_result'
  | 'wrong_schema_extra_fields';

/**
 * Network condition simulation configuration
 */
export interface MockNetworkConditions {
  /** Connection timeout in ms */
  connectionTimeout?: number;
  /** Simulated latency in ms */
  latencyMs?: number;
  /** Latency jitter in ms */
  latencyJitter?: number;
  /** Packet loss probability (0.0 to 1.0) */
  packetLoss?: number;
}

/**
 * Error simulation configuration
 */
export interface MockErrorSimulationConfig {
  /** Simulation mode */
  mode: string;
  /** Error category */
  category?: string;
  /** Preset to use as a base */
  preset?: MockErrorScenarioPreset;
  /** Custom error to return */
  customError?: {
    code: number;
    message: string;
    data?: unknown;
  };
  /** Network conditions to simulate */
  networkConditions?: MockNetworkConditions;
  /** Method pattern (regex) for method_pattern mode */
  methodPattern?: string;
  /** Number of requests to fail in fail_first_n mode */
  failCount?: number;
  /** Number of requests to succeed before failing in fail_after_n mode */
  succeedCount?: number;
  /** Period for periodic_fail mode */
  failPeriod?: number;
  /** Argument matcher for argument_pattern mode */
  argumentMatcher?: {
    path: string;
    value: unknown;
  };
  /** Sequence of outcomes for sequence mode */
  sequence?: Array<{
    outcome: 'error' | 'success';
    error?: { code: number; message: string; data?: unknown };
    delayMs?: number;
  }>;
  /** Which clients are affected */
  affectedClients?: string;
  /** Description of the error scenario */
  description?: string;
}

/**
 * Malformed response configuration (protocol-level)
 */
export interface MockMalformedResponseConfig {
  /** Type of malformed response */
  type: 'invalid_json' | 'truncated_json' | 'empty_response' | 'wrong_schema';
  /** Truncation position */
  truncateAt?: number | string;
  /** Invalid JSON content to inject */
  invalidJsonContent?: string;
  /** Wrong schema payload to inject */
  wrongSchemaPayload?: unknown;
  /** Methods affected (empty = all) */
  affectedMethods?: string[];
  /** Probability of malformation (0.0 to 1.0) */
  probability?: number;
  /** Description */
  description?: string;
}

// ============================================================================
// Recorded Request Types
// ============================================================================

/**
 * A recorded request with metadata for assertion/verification
 */
export interface RecordedRequest {
  /** The original JSON-RPC request */
  request: JSONRPCRequest;
  /** Timestamp when the request was received */
  timestamp: number;
  /** The response that was sent (if any) */
  response?: JSONRPCResponse;
  /** Duration of processing in milliseconds */
  durationMs: number;
  /** Whether an error was injected for this request */
  errorInjected: boolean;
  /** The server state when this request was processed */
  serverState: string;
}

/**
 * A recorded notification with metadata
 */
export interface RecordedNotification {
  /** The notification that was sent */
  notification: JSONRPCNotification;
  /** Timestamp when the notification was sent */
  timestamp: number;
  /** Trigger condition that fired the notification */
  triggerCondition?: string;
}

// ============================================================================
// Mock Transport Options
// ============================================================================

/**
 * Options for the MockTransport
 */
export interface MockTransportOptions {
  /** Simulated connection latency in milliseconds */
  connectionLatencyMs?: number;
  /** Whether connect() should fail */
  shouldFailConnect?: boolean;
  /** Error to throw on connect failure */
  connectError?: Error;
  /** Whether send() should fail */
  shouldFailSend?: boolean;
  /** Error to throw on send failure */
  sendError?: Error;
  /** Simulated transport type being mocked */
  transportType?: MockTransportType;
  /** Connection timeout override in ms */
  connectionTimeout?: number;
  /** Whether to auto-reconnect on unexpected disconnect */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Delay between reconnection attempts in ms */
  reconnectDelay?: number;
}

// ============================================================================
// Protocol Handler Types
// ============================================================================

/**
 * State of the MCP protocol lifecycle
 */
export type ProtocolState = 'uninitialized' | 'initializing' | 'initialized' | 'error';

/**
 * Method handler function type
 */
export type MethodHandler = (
  params: Record<string, unknown> | undefined
) => Promise<unknown>;

/**
 * Registered method handler with metadata
 */
export interface RegisteredHandler {
  /** The handler function */
  handler: MethodHandler;
  /** Whether initialization is required before this method can be called */
  requiresInit: boolean;
}

// ============================================================================
// Behavior Engine Types
// ============================================================================

/**
 * Result of checking whether to inject an error
 */
export interface ErrorInjectionResult {
  /** Whether to inject an error */
  shouldInject: boolean;
  /** The error code to use */
  errorCode?: number;
  /** The error message */
  errorMessage?: string;
  /** Optional error data */
  errorData?: unknown;
  /** Delay before returning the error */
  delayMs?: number;
}

/**
 * Computed delay for a response
 */
export interface ComputedDelay {
  /** Total delay in milliseconds */
  delayMs: number;
  /** Whether jitter was applied */
  jitterApplied: boolean;
  /** Source of the delay (fixed, range, per-method) */
  source: 'fixed' | 'range' | 'per-method' | 'none';
}

// ============================================================================
// Server Facade Types
// ============================================================================

/**
 * Events emitted by the MockMCPServerFacade
 */
export interface MockServerFacadeEvents {
  /** Emitted when a request is received */
  'request': (request: JSONRPCRequest) => void;
  /** Emitted when a response is sent */
  'response': (request: JSONRPCRequest, response: JSONRPCResponse) => void;
  /** Emitted when a notification is sent to the client */
  'notification:sent': (notification: JSONRPCNotification) => void;
  /** Emitted when the server state changes (state machine) */
  'state:change': (from: string, to: string, trigger: string) => void;
  /** Emitted when an error is injected */
  'error:injected': (request: JSONRPCRequest, error: ErrorInjectionResult) => void;
  /** Emitted when a scenario is activated */
  'scenario:activated': (name: string) => void;
  /** Emitted when the server is started */
  'started': () => void;
  /** Emitted when the server is stopped */
  'stopped': () => void;
}

/**
 * Statistics about mock server usage
 */
export interface MockServerStats {
  /** Total requests received */
  totalRequests: number;
  /** Total errors injected */
  totalErrorsInjected: number;
  /** Total notifications sent */
  totalNotificationsSent: number;
  /** Requests by method */
  requestsByMethod: Record<string, number>;
  /** Tool calls by name */
  toolCallsByName: Record<string, number>;
  /** Current state (if stateful) */
  currentState: string;
  /** Active scenario name */
  activeScenario?: string;
  /** Server uptime in ms */
  uptimeMs: number;
}

/**
 * Assertion error thrown when mock server assertions fail
 */
export class MockAssertionError extends Error {
  constructor(
    message: string,
    public readonly expected: unknown,
    public readonly actual: unknown
  ) {
    super(message);
    this.name = 'MockAssertionError';
  }
}

// ============================================================================
// Error Simulation Internal Types (ADR-072)
// ============================================================================

/**
 * Result of checking whether an error should be simulated.
 * Used internally by the error simulation decision logic.
 */
export interface ErrorSimulationCheckResult {
  /** Whether to simulate an error */
  shouldSimulate: boolean;
  /** The error category being simulated */
  category?: string;
  /** The error code to use */
  errorCode?: number;
  /** The error message */
  errorMessage?: string;
  /** Optional error data */
  errorData?: unknown;
  /** Delay before returning the error (ms) */
  delayMs?: number;
  /** Whether this is a transport-level error (should affect connection) */
  isTransportError?: boolean;
  /** Description of the error scenario being simulated */
  scenarioDescription?: string;
}

/**
 * State tracking for error simulation.
 * Tracks request counts and sequence position for deterministic modes.
 */
export interface ErrorSimulationState {
  /** Total number of requests processed since error mode was set */
  requestCount: number;
  /** Current position in the sequence (for 'sequence' mode) */
  sequenceIndex: number;
  /** Number of errors that have been simulated */
  errorCount: number;
  /** Number of successful responses returned */
  successCount: number;
  /** Timestamp when error mode was set */
  startTime: number;
}

/**
 * Events emitted by error simulation hooks
 */
export interface ErrorSimulationEvents {
  /** Emitted when error simulation mode is set */
  'error:mode:set': (mode: string, description?: string) => void;
  /** Emitted when error simulation mode is cleared */
  'error:mode:clear': () => void;
  /** Emitted when an error is simulated */
  'error:simulated': (result: ErrorSimulationCheckResult) => void;
  /** Emitted when a request passes through without error simulation */
  'error:passed': (method: string, requestCount: number) => void;
}

// ============================================================================
// Malformed Bytes Injection Types (ADR-073)
// ============================================================================

/**
 * Configuration for injecting malformed bytes at the transport layer.
 *
 * Unlike MockMalformedResponseConfig which operates at the protocol level,
 * this configuration enables injection of actual malformed data that
 * simulates transport-level corruption.
 */
export interface MalformedBytesInjectionConfig {
  /** Type of malformed data to inject */
  type: 'invalid_json' | 'truncated_json' | 'empty_response' | 'binary_data' | 'custom';

  /**
   * For truncated_json: position to truncate at.
   * - number: absolute byte position
   * - string with %: percentage of full response (e.g., '50%')
   */
  truncateAt?: number | string;

  /** For custom type: exact raw bytes to inject */
  rawBytes?: Buffer | string;

  /** For invalid_json: specific invalid JSON content to inject */
  invalidContent?: string;

  /** Delay before injection (ms) */
  delayMs?: number;

  /** Optional description for test documentation */
  description?: string;
}

/**
 * Configuration for automatic malformed response interception.
 */
export interface MalformedResponseInterceptorConfig {
  /** Request method(s) to target (empty array = all methods) */
  targetMethods?: string[];

  /** Malformed injection configuration */
  injection: MalformedBytesInjectionConfig;

  /** Probability of injection (0.0 to 1.0, default 1.0) */
  probability?: number;

  /** Maximum number of injections (0 = unlimited) */
  maxInjections?: number;
}
