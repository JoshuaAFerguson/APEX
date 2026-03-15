/**
 * @fileoverview MCP Error Fixtures
 *
 * Enhanced error scenarios for MCP protocol testing.
 * Extends the existing error-presets.ts with additional scenarios and better integration.
 */

import type { ErrorSimulationOptions } from '../types.js';

/**
 * JSON-RPC error object (defined locally as not exported from core types)
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * JSON-RPC error response (defined locally as not exported from core types)
 */
export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: JsonRpcError;
}

/**
 * Mock error scenario preset (defined locally as not exported from core types)
 */
export interface MockErrorScenarioPreset {
  mode: string;
  methodPattern?: string;
  category: string;
  customError: JsonRpcError;
  description: string;
}

/**
 * Mock error simulation config (defined locally as not exported from core types)
 */
export interface MockErrorSimulationConfig {
  mode: string;
  methodPattern?: string;
  errorProbability?: number;
  sequence?: Array<{ type: string; count: number }>;
  category: string;
  customError: JsonRpcError;
  description: string;
}

/**
 * Standard JSON-RPC error codes
 */
export const JSONRPCErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR: -32000, // Server-defined errors range from -32000 to -32099
} as const;

/**
 * MCP-specific error codes
 */
export const MCPErrorCodes = {
  PROTOCOL_MISMATCH: -32600,
  CAPABILITY_MISMATCH: -32601,
  TRANSPORT_ERROR: -32000,
  TIMEOUT: -32001,
  RATE_LIMITED: -32002,
  RESOURCE_NOT_FOUND: -32003,
  AUTHORIZATION_FAILED: -32004,
} as const;

/**
 * Creates a JSON-RPC error object
 */
export const createJSONRPCError = (
  code: number,
  message: string,
  data?: unknown
): JsonRpcError => ({
  code,
  message,
  ...(data && { data }),
});

/**
 * Creates a JSON-RPC error response
 */
export const createJSONRPCErrorResponse = (
  id: string | number | null,
  error: JsonRpcError
): JsonRpcErrorResponse => ({
  jsonrpc: '2.0',
  id,
  error,
});

/**
 * MCP protocol error fixtures
 */
export const MCPProtocolErrors = {
  /** Protocol version mismatch during initialization */
  protocolMismatch: createJSONRPCError(
    MCPErrorCodes.PROTOCOL_MISMATCH,
    'Protocol version not supported. Server requires version 2024-11-05',
    {
      supportedVersions: ['2024-11-05'],
      requestedVersion: '2024-10-15',
      serverInfo: { name: 'test-mcp-server', version: '1.0.0' },
    }
  ),

  /** Invalid request structure */
  invalidRequest: createJSONRPCError(
    JSONRPCErrorCodes.INVALID_REQUEST,
    'Invalid Request. Missing required field: method'
  ),

  /** Method not found */
  methodNotFound: createJSONRPCError(
    JSONRPCErrorCodes.METHOD_NOT_FOUND,
    'Method not found: unknown_method',
    { method: 'unknown_method' }
  ),

  /** Invalid parameters */
  invalidParams: createJSONRPCError(
    JSONRPCErrorCodes.INVALID_PARAMS,
    'Invalid params. Expected object with "name" property',
    { received: ['string', 'number'], expected: 'object' }
  ),

  /** Server internal error */
  internalError: createJSONRPCError(
    JSONRPCErrorCodes.INTERNAL_ERROR,
    'Internal server error occurred',
    {
      errorId: 'ERR-2024-001',
      timestamp: new Date().toISOString(),
      trace: 'MockError for testing',
    }
  ),

  /** Capability negotiation failure */
  capabilityMismatch: createJSONRPCError(
    MCPErrorCodes.CAPABILITY_MISMATCH,
    'Required capability not supported: tools',
    {
      requiredCapabilities: ['tools', 'resources'],
      supportedCapabilities: ['resources'],
    }
  ),

  /** Transport-level errors */
  transportError: createJSONRPCError(
    MCPErrorCodes.TRANSPORT_ERROR,
    'Connection lost',
    { reason: 'unexpected_disconnect', reconnectAfter: 5000 }
  ),

  /** Request timeout */
  timeout: createJSONRPCError(
    MCPErrorCodes.TIMEOUT,
    'Request timed out after 30 seconds',
    { timeout: 30000, operation: 'tools/call' }
  ),

  /** Rate limiting */
  rateLimited: createJSONRPCError(
    MCPErrorCodes.RATE_LIMITED,
    'Rate limit exceeded. Too many requests',
    {
      limit: 100,
      window: 60000,
      retryAfter: 15000,
    }
  ),

  /** Resource not found */
  resourceNotFound: createJSONRPCError(
    MCPErrorCodes.RESOURCE_NOT_FOUND,
    'Resource not found: file://nonexistent.txt',
    { uri: 'file://nonexistent.txt', resourceType: 'file' }
  ),

  /** Authorization failed */
  authorizationFailed: createJSONRPCError(
    MCPErrorCodes.AUTHORIZATION_FAILED,
    'Insufficient permissions to access resource',
    { required: 'read', granted: 'none' }
  ),
} as const;

/**
 * Error response fixtures with different ID types
 */
export const MCPErrorResponses = {
  /** Numeric ID */
  withNumericId: (error: JsonRpcError) => createJSONRPCErrorResponse(1, error),

  /** String ID */
  withStringId: (error: JsonRpcError) => createJSONRPCErrorResponse('req-123', error),

  /** Null ID (for malformed requests) */
  withNullId: (error: JsonRpcError) => createJSONRPCErrorResponse(null, error),
} as const;

/**
 * Extended error simulation configurations
 * Based on the existing error-presets.ts but with enhanced scenarios
 */
export const MCPErrorSimulationConfigs: Record<
  string,
  Partial<MockErrorSimulationConfig>
> = {
  /** Initialization errors */
  init_protocol_mismatch: {
    mode: 'method_pattern',
    methodPattern: '^initialize$',
    category: 'protocol',
    customError: MCPProtocolErrors.protocolMismatch,
    description: 'Protocol version mismatch during initialization',
  },

  init_capability_rejection: {
    mode: 'method_pattern',
    methodPattern: '^initialize$',
    category: 'protocol',
    customError: MCPProtocolErrors.capabilityMismatch,
    description: 'Required capability not supported',
  },

  /** Tool execution errors */
  tool_not_found: {
    mode: 'method_pattern',
    methodPattern: '^tools/call$',
    category: 'runtime',
    customError: MCPProtocolErrors.methodNotFound,
    description: 'Requested tool not found',
  },

  tool_invalid_params: {
    mode: 'method_pattern',
    methodPattern: '^tools/call$',
    category: 'validation',
    customError: MCPProtocolErrors.invalidParams,
    description: 'Invalid parameters for tool call',
  },

  tool_execution_timeout: {
    mode: 'method_pattern',
    methodPattern: '^tools/call$',
    category: 'timeout',
    customError: MCPProtocolErrors.timeout,
    description: 'Tool execution timed out',
  },

  /** Resource access errors */
  resource_not_found: {
    mode: 'method_pattern',
    methodPattern: '^resources/read$',
    category: 'runtime',
    customError: MCPProtocolErrors.resourceNotFound,
    description: 'Requested resource does not exist',
  },

  resource_access_denied: {
    mode: 'method_pattern',
    methodPattern: '^resources/',
    category: 'security',
    customError: MCPProtocolErrors.authorizationFailed,
    description: 'Insufficient permissions for resource',
  },

  /** Network and transport errors */
  connection_lost: {
    mode: 'probability',
    errorProbability: 0.1,
    category: 'transport',
    customError: MCPProtocolErrors.transportError,
    description: 'Simulates intermittent connection issues',
  },

  rate_limit_exceeded: {
    mode: 'sequence',
    sequence: [
      { type: 'success', count: 5 },
      { type: 'error', count: 3 },
      { type: 'success', count: 5 },
    ],
    category: 'policy',
    customError: MCPProtocolErrors.rateLimited,
    description: 'Rate limiting after burst of requests',
  },

  /** Server overload scenarios */
  server_overload: {
    mode: 'probability',
    errorProbability: 0.15,
    category: 'resource',
    customError: MCPProtocolErrors.internalError,
    description: 'Server under high load',
  },
} as const;

/**
 * Utility function to create MCP error scenario with options
 */
export const createMCPError = (
  baseError: JsonRpcError,
  options: ErrorSimulationOptions = {}
): JsonRpcError => ({
  ...baseError,
  data: {
    ...(baseError.data as Record<string, unknown>),
    category: options.category || 'protocol',
    severity: options.severity || 'medium',
    retryable: options.retryable ?? true,
    timestamp: new Date().toISOString(),
    ...options.data,
  },
});

/**
 * Error preset collections organized by category
 */
export const MCPErrorPresets = {
  /** Protocol-level errors */
  protocol: {
    mismatch: () => MCPProtocolErrors.protocolMismatch,
    invalidRequest: () => MCPProtocolErrors.invalidRequest,
    capabilityMismatch: () => MCPProtocolErrors.capabilityMismatch,
  },

  /** Transport and network errors */
  transport: {
    connectionLost: () => MCPProtocolErrors.transportError,
    timeout: () => MCPProtocolErrors.timeout,
  },

  /** Runtime execution errors */
  runtime: {
    methodNotFound: () => MCPProtocolErrors.methodNotFound,
    invalidParams: () => MCPProtocolErrors.invalidParams,
    internalError: () => MCPProtocolErrors.internalError,
    resourceNotFound: () => MCPProtocolErrors.resourceNotFound,
  },

  /** Policy and security errors */
  policy: {
    rateLimited: () => MCPProtocolErrors.rateLimited,
    authorizationFailed: () => MCPProtocolErrors.authorizationFailed,
  },
} as const;