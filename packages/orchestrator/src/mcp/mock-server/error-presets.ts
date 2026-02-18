/**
 * @fileoverview Error Preset Definitions for MockMCPServer
 *
 * Defines preset configurations for common error scenarios that MCP clients
 * should handle. These presets encapsulate realistic failure modes and
 * make it easy to test against known error conditions.
 *
 * @module orchestrator/mcp/mock-server/error-presets
 * @see ADR-072 for architecture documentation
 */

import type {
  MockErrorScenarioPreset,
  MockErrorSimulationConfig,
} from '@apexcli/core';

/**
 * Map of preset names to their configurations.
 *
 * Each preset provides sensible defaults for simulating a specific
 * error scenario. Custom configuration can override these defaults.
 */
export const ERROR_SIMULATION_PRESETS: Record<
  MockErrorScenarioPreset,
  Partial<MockErrorSimulationConfig>
> = {
  /**
   * Server rejects initialization with invalid protocol version.
   * Simulates client/server version mismatch during handshake.
   */
  'init_protocol_mismatch': {
    mode: 'method_pattern',
    methodPattern: '^initialize$',
    category: 'protocol',
    customError: {
      code: -32600,
      message: 'Protocol version not supported. Server requires version 2024-11-05',
      data: {
        supportedVersions: ['2024-11-05'],
        requestedVersion: 'unknown',
      },
    },
    description: 'Protocol version mismatch during initialization',
  },

  /**
   * Server rejects initialization with capability negotiation failure.
   * Simulates missing required capabilities during handshake.
   */
  'init_capability_rejection': {
    mode: 'method_pattern',
    methodPattern: '^initialize$',
    category: 'protocol',
    customError: {
      code: -32601,
      message: 'Required capabilities not available',
      data: {
        missingCapabilities: ['tools', 'resources'],
      },
    },
    description: 'Capability negotiation failure during initialization',
  },

  /**
   * Server drops connection during initialization handshake.
   * Simulates abrupt connection termination early in the lifecycle.
   */
  'init_connection_drop': {
    mode: 'method_pattern',
    methodPattern: '^initialize$',
    category: 'transport',
    customError: {
      code: -32000,
      message: 'Connection closed unexpectedly during initialization',
    },
    description: 'Connection dropped during initialization handshake',
  },

  /**
   * Server sends malformed JSON in response.
   * Simulates JSON parse errors in the transport layer.
   */
  'malformed_response': {
    mode: 'always_fail',
    category: 'transport',
    customError: {
      code: -32700,
      message: 'Parse error: Unexpected token in JSON at position 0',
      data: {
        rawResponse: '{ invalid json }',
      },
    },
    description: 'Malformed JSON response from server',
  },

  /**
   * Server sends response with mismatched request ID.
   * Simulates out-of-order or corrupted response routing.
   */
  'response_id_mismatch': {
    mode: 'always_fail',
    category: 'protocol',
    customError: {
      code: -32603,
      message: 'Response ID does not match any pending request',
      data: {
        expectedId: 1,
        receivedId: 999,
      },
    },
    description: 'Response ID mismatch in JSON-RPC exchange',
  },

  /**
   * Server sends partial response then disconnects.
   * Simulates mid-response connection failures.
   */
  'partial_response': {
    mode: 'always_fail',
    category: 'transport',
    customError: {
      code: -32000,
      message: 'Incomplete response received: connection closed mid-stream',
      data: {
        bytesReceived: 128,
        expectedBytes: 1024,
      },
    },
    description: 'Partial response with disconnection',
  },

  /**
   * Server becomes unresponsive (infinite delay).
   * Simulates server hang without explicit error.
   */
  'server_hang': {
    mode: 'always_fail',
    category: 'network',
    networkConditions: {
      // connectionTimeout of 0 means infinite wait
      connectionTimeout: 0,
    },
    customError: {
      code: -32000,
      message: 'Server not responding',
    },
    description: 'Server hang with no response',
  },

  /**
   * Server rate limits requests.
   * Simulates HTTP 429-style rate limiting.
   */
  'rate_limit': {
    mode: 'always_fail',
    category: 'application',
    customError: {
      code: -32429,
      message: 'Too many requests. Please retry after 60 seconds',
      data: {
        retryAfter: 60,
        limit: 100,
        remaining: 0,
        resetAt: Date.now() + 60000,
      },
    },
    description: 'Rate limit exceeded',
  },

  /**
   * Server authentication/authorization failure.
   * Simulates missing or invalid credentials.
   */
  'auth_failure': {
    mode: 'always_fail',
    category: 'protocol',
    customError: {
      code: -32401,
      message: 'Authentication required or invalid credentials',
      data: {
        realm: 'MCP Server',
        scheme: 'Bearer',
      },
    },
    description: 'Authentication failure',
  },

  /**
   * Server internal error with stack trace.
   * Simulates unhandled server exception with debug info.
   */
  'internal_error_with_details': {
    mode: 'always_fail',
    category: 'application',
    customError: {
      code: -32603,
      message: 'Internal server error',
      data: {
        stack: 'Error: Internal failure\n' +
          '    at Server.processRequest (/server/handler.js:42:11)\n' +
          '    at async RequestHandler.handle (/server/router.js:88:5)',
        timestamp: new Date().toISOString(),
        requestId: 'req_12345',
      },
    },
    description: 'Internal server error with stack trace',
  },

  /**
   * Tool not found error.
   * Simulates calling a non-existent tool.
   */
  'tool_not_found': {
    mode: 'method_pattern',
    methodPattern: '^tools/call$',
    category: 'application',
    customError: {
      code: -32601,
      message: 'Tool not found',
      data: {
        availableTools: ['read_file', 'write_file', 'list_directory'],
      },
    },
    description: 'Tool not found error',
  },

  /**
   * Resource access denied.
   * Simulates permission/authorization failure for resources.
   */
  'resource_access_denied': {
    mode: 'method_pattern',
    methodPattern: '^resources/',
    category: 'application',
    customError: {
      code: -32600,
      message: 'Access denied: insufficient permissions for this resource',
      data: {
        requiredPermission: 'read',
        userPermissions: [],
      },
    },
    description: 'Resource access denied',
  },

  /**
   * Request timeout.
   * Simulates request taking too long to process.
   */
  'request_timeout': {
    mode: 'always_fail',
    category: 'network',
    networkConditions: {
      connectionTimeout: 1, // Immediate timeout
    },
    customError: {
      code: -32000,
      message: 'Request timed out after 30000ms',
      data: {
        timeout: 30000,
        operation: 'processRequest',
      },
    },
    description: 'Request timeout',
  },

  /**
   * Connection reset by peer.
   * Simulates abrupt connection termination.
   */
  'connection_reset': {
    mode: 'always_fail',
    category: 'transport',
    customError: {
      code: -32000,
      message: 'Connection reset by peer (ECONNRESET)',
      data: {
        errno: 'ECONNRESET',
        syscall: 'read',
      },
    },
    description: 'Connection reset by peer',
  },

  /**
   * Wrong schema: response missing required id field.
   * Simulates response without required JSON-RPC id field.
   */
  'wrong_schema_missing_id': {
    mode: 'always_fail',
    category: 'transport',
    customError: {
      code: -32700,
      message: 'Response missing required field: id',
      data: {
        invalidResponse: { jsonrpc: '2.0', result: {} },
        missingFields: ['id'],
        specification: 'JSON-RPC 2.0',
      },
    },
    description: 'Response missing required id field',
  },

  /**
   * Wrong schema: response has invalid result structure.
   * Simulates response with unexpected result structure.
   */
  'wrong_schema_invalid_result': {
    mode: 'always_fail',
    category: 'transport',
    customError: {
      code: -32700,
      message: 'Response result field has invalid structure',
      data: {
        invalidResponse: {
          jsonrpc: '2.0',
          id: 1,
          result: 'should be object or null',
        },
        expectedTypes: ['object', 'null'],
        receivedType: 'string',
        specification: 'JSON-RPC 2.0',
      },
    },
    description: 'Response has invalid result structure',
  },

  /**
   * Wrong schema: response contains extra unexpected fields.
   * Simulates response with additional unknown fields.
   */
  'wrong_schema_extra_fields': {
    mode: 'always_fail',
    category: 'transport',
    customError: {
      code: -32700,
      message: 'Response contains unexpected fields',
      data: {
        invalidResponse: {
          jsonrpc: '2.0',
          id: 1,
          result: {},
          unexpectedField: 'not allowed',
          anotherExtra: 123,
        },
        extraFields: ['unexpectedField', 'anotherExtra'],
        allowedFields: ['jsonrpc', 'id', 'result', 'error'],
        specification: 'JSON-RPC 2.0',
      },
    },
    description: 'Response contains extra unexpected fields',
  },
};

/**
 * Get the preset configuration for a given preset name.
 *
 * @param preset - The preset name to look up
 * @returns The preset configuration, or undefined if not found
 */
export function getErrorPreset(
  preset: MockErrorScenarioPreset
): Partial<MockErrorSimulationConfig> | undefined {
  return ERROR_SIMULATION_PRESETS[preset];
}

/**
 * Merge a preset with custom overrides.
 *
 * Custom configuration takes precedence over preset defaults.
 *
 * @param preset - The preset name to use as a base
 * @param overrides - Custom configuration to apply on top
 * @returns Merged configuration
 */
export function mergePresetWithOverrides(
  preset: MockErrorScenarioPreset,
  overrides: Partial<MockErrorSimulationConfig> = {}
): Partial<MockErrorSimulationConfig> {
  const presetConfig = ERROR_SIMULATION_PRESETS[preset];
  if (!presetConfig) {
    return overrides;
  }

  return {
    ...presetConfig,
    ...overrides,
    // Deep merge customError if both exist
    customError: overrides.customError ?? presetConfig.customError,
    // Deep merge networkConditions if both exist
    networkConditions: {
      ...presetConfig.networkConditions,
      ...overrides.networkConditions,
    },
  };
}

/**
 * Get all available preset names.
 *
 * @returns Array of all preset names
 */
export function getAvailablePresets(): MockErrorScenarioPreset[] {
  return Object.keys(ERROR_SIMULATION_PRESETS) as MockErrorScenarioPreset[];
}

/**
 * Get presets by category.
 *
 * @param category - The error category to filter by
 * @returns Array of preset names in the given category
 */
export function getPresetsByCategory(
  category: 'jsonrpc' | 'protocol' | 'transport' | 'application' | 'network'
): MockErrorScenarioPreset[] {
  return (Object.entries(ERROR_SIMULATION_PRESETS) as Array<
    [MockErrorScenarioPreset, Partial<MockErrorSimulationConfig>]
  >)
    .filter(([_, config]) => config.category === category)
    .map(([name]) => name);
}
