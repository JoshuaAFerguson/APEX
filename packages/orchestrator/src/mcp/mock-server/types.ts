/**
 * @fileoverview Internal Types for Mock MCP Server
 *
 * Defines internal types used by the mock MCP server components.
 * These types complement the configuration types from @apex/core/mcp/mock-types.
 *
 * @module orchestrator/mcp/mock-server/types
 */

import type { JSONRPCRequest, JSONRPCResponse, JSONRPCNotification } from '../types.js';
import type { MockTransportType } from '@apexcli/core';

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
