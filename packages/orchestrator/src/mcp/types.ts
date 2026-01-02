/**
 * MCP (Model Context Protocol) Type Definitions
 *
 * This module defines the core types for MCP transport communication,
 * following the JSON-RPC 2.0 specification used by MCP.
 *
 * @module orchestrator/mcp/types
 */

// ============================================================================
// JSON-RPC 2.0 Message Types
// ============================================================================

/**
 * JSON-RPC error object
 */
export interface JSONRPCError {
  /** Error code (standard JSON-RPC codes or application-defined) */
  code: number;
  /** Human-readable error message */
  message: string;
  /** Optional additional error data */
  data?: unknown;
}

/**
 * JSON-RPC 2.0 request message
 */
export interface JSONRPCRequest {
  /** JSON-RPC version - must be "2.0" */
  jsonrpc: '2.0';
  /** Request identifier for matching responses */
  id: string | number;
  /** Method name to invoke */
  method: string;
  /** Optional method parameters */
  params?: unknown;
}

/**
 * JSON-RPC 2.0 response message (success)
 */
export interface JSONRPCSuccessResponse {
  /** JSON-RPC version - must be "2.0" */
  jsonrpc: '2.0';
  /** Request identifier this response matches */
  id: string | number | null;
  /** Result of the method invocation */
  result: unknown;
}

/**
 * JSON-RPC 2.0 response message (error)
 */
export interface JSONRPCErrorResponse {
  /** JSON-RPC version - must be "2.0" */
  jsonrpc: '2.0';
  /** Request identifier this response matches */
  id: string | number | null;
  /** Error details */
  error: JSONRPCError;
}

/**
 * JSON-RPC 2.0 response message (success or error)
 */
export type JSONRPCResponse = JSONRPCSuccessResponse | JSONRPCErrorResponse;

/**
 * JSON-RPC 2.0 notification (no id, no response expected)
 */
export interface JSONRPCNotification {
  /** JSON-RPC version - must be "2.0" */
  jsonrpc: '2.0';
  /** Method name to invoke */
  method: string;
  /** Optional method parameters */
  params?: unknown;
}

/**
 * Union type for all JSON-RPC message types
 */
export type JSONRPCMessage = JSONRPCRequest | JSONRPCResponse | JSONRPCNotification;

// ============================================================================
// Standard JSON-RPC Error Codes
// ============================================================================

/**
 * Standard JSON-RPC 2.0 error codes
 */
export const JSONRPCErrorCodes = {
  /** Invalid JSON was received */
  PARSE_ERROR: -32700,
  /** The JSON sent is not a valid Request object */
  INVALID_REQUEST: -32600,
  /** The method does not exist / is not available */
  METHOD_NOT_FOUND: -32601,
  /** Invalid method parameter(s) */
  INVALID_PARAMS: -32602,
  /** Internal JSON-RPC error */
  INTERNAL_ERROR: -32603,
  /** Server error range start (-32000 to -32099 reserved for implementation-defined server errors) */
  SERVER_ERROR_START: -32099,
  /** Server error range end */
  SERVER_ERROR_END: -32000,
} as const;

// ============================================================================
// Transport Error Types
// ============================================================================

/**
 * Error codes for MCP transport operations
 */
export type MCPTransportErrorCode =
  | 'CONNECTION_FAILED'   // Failed to establish connection
  | 'DISCONNECTED'        // Connection was lost
  | 'SEND_FAILED'         // Failed to send message
  | 'PROCESS_CRASHED'     // Child process crashed unexpectedly
  | 'SPAWN_FAILED'        // Failed to spawn child process
  | 'PARSE_ERROR'         // Failed to parse incoming message
  | 'TIMEOUT'             // Operation timed out
  | 'ALREADY_CONNECTED'   // Attempted to connect when already connected
  | 'NOT_CONNECTED';      // Attempted operation when not connected

/**
 * Custom error class for MCP transport operations
 *
 * Follows existing codebase patterns (DaemonError, WorktreeError)
 */
export class MCPTransportError extends Error {
  /**
   * Create a new MCPTransportError
   *
   * @param message - Human-readable error message
   * @param code - Error code for programmatic handling
   * @param cause - Optional underlying error
   */
  constructor(
    message: string,
    public readonly code: MCPTransportErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'MCPTransportError';

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MCPTransportError);
    }
  }
}

// ============================================================================
// Transport Event Types
// ============================================================================

/**
 * Events emitted by MCP transports
 */
export interface MCPTransportEvents {
  /** Emitted when a message is received from the MCP server */
  'message': (message: JSONRPCMessage) => void;

  /** Emitted when an error occurs */
  'error': (error: MCPTransportError) => void;

  /** Emitted when connection is established */
  'connected': () => void;

  /** Emitted when connection is closed */
  'disconnected': (reason?: string) => void;

  /** Emitted when stderr output is received (stdio transport only) */
  'stderr': (data: string) => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Type guard to check if a message is a JSON-RPC request
 */
export function isJSONRPCRequest(message: JSONRPCMessage): message is JSONRPCRequest {
  return 'id' in message && 'method' in message;
}

/**
 * Type guard to check if a message is a JSON-RPC response
 */
export function isJSONRPCResponse(message: JSONRPCMessage): message is JSONRPCResponse {
  return 'id' in message && ('result' in message || 'error' in message);
}

/**
 * Type guard to check if a message is a JSON-RPC notification
 */
export function isJSONRPCNotification(message: JSONRPCMessage): message is JSONRPCNotification {
  return 'method' in message && !('id' in message);
}

/**
 * Type guard to check if a response is an error response
 */
export function isJSONRPCErrorResponse(response: JSONRPCResponse): response is JSONRPCErrorResponse {
  return 'error' in response;
}

/**
 * Type guard to check if a response is a success response
 */
export function isJSONRPCSuccessResponse(response: JSONRPCResponse): response is JSONRPCSuccessResponse {
  return 'result' in response;
}

/**
 * Create a JSON-RPC request message
 */
export function createJSONRPCRequest(
  id: string | number,
  method: string,
  params?: unknown
): JSONRPCRequest {
  const request: JSONRPCRequest = {
    jsonrpc: '2.0',
    id,
    method,
  };
  if (params !== undefined) {
    request.params = params;
  }
  return request;
}

/**
 * Create a JSON-RPC notification message
 */
export function createJSONRPCNotification(
  method: string,
  params?: unknown
): JSONRPCNotification {
  const notification: JSONRPCNotification = {
    jsonrpc: '2.0',
    method,
  };
  if (params !== undefined) {
    notification.params = params;
  }
  return notification;
}

/**
 * Create a JSON-RPC success response
 */
export function createJSONRPCSuccessResponse(
  id: string | number | null,
  result: unknown
): JSONRPCSuccessResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * Create a JSON-RPC error response
 */
export function createJSONRPCErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): JSONRPCErrorResponse {
  const response: JSONRPCErrorResponse = {
    jsonrpc: '2.0',
    id,
    error: { code, message },
  };
  if (data !== undefined) {
    response.error.data = data;
  }
  return response;
}
