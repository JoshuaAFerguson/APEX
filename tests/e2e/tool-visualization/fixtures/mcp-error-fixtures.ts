/**
 * Test fixtures for MCP error display testing
 * Provides various MCP error scenarios to test error categorization and suggestion generation
 */

export interface MCPErrorFixture {
  name: string;
  description: string;
  error: Error;
  expectedCategory: string;
  expectedSuggestions: string[];
  toolContext: {
    toolName: string;
    input: any;
    operation: string;
  };
}

/**
 * Collection of MCP error test fixtures
 */
export const mcpErrorFixtures = {
  /**
   * Permission denied errors
   */
  permissionDenied: (): MCPErrorFixture => {
    const error = new Error('MCP permission denied: Cannot write to /system/protected');
    (error as any).code = 'PERMISSION_DENIED';
    (error as any).details = {
      resource: '/system/protected',
      requiredPermissions: ['write'],
      currentPermissions: ['read']
    };

    return {
      name: 'Permission Denied',
      description: 'MCP server denies access to protected resource',
      error,
      expectedCategory: 'Permission Issue',
      expectedSuggestions: [
        'Check file/directory permissions',
        'Verify user access rights',
        'Contact administrator for elevated permissions'
      ],
      toolContext: {
        toolName: 'Write',
        input: { file_path: '/system/protected/config.json', content: '{}' },
        operation: 'file_write'
      }
    };
  },

  /**
   * Connection timeout errors
   */
  connectionTimeout: (): MCPErrorFixture => {
    const error = new Error('MCP connection timeout after 30000ms');
    (error as any).code = 'ETIMEDOUT';
    (error as any).timeout = 30000;
    (error as any).details = {
      host: 'mcp-server.example.com',
      port: 8080,
      retryCount: 3
    };

    return {
      name: 'Connection Timeout',
      description: 'MCP server connection timed out',
      error,
      expectedCategory: 'Network Issue',
      expectedSuggestions: [
        'Check your internet connection and try again',
        'Increase timeout value',
        'Verify server availability'
      ],
      toolContext: {
        toolName: 'WebFetch',
        input: { url: 'https://slow-api.example.com/data' },
        operation: 'http_request'
      }
    };
  },

  /**
   * Tool not found errors
   */
  toolNotFound: (): MCPErrorFixture => {
    const error = new Error('MCP tool "custom-analyzer" not found on server');
    (error as any).code = 'TOOL_NOT_FOUND';
    (error as any).details = {
      requestedTool: 'custom-analyzer',
      availableTools: ['Read', 'Write', 'Bash', 'Grep', 'Glob']
    };

    return {
      name: 'Tool Not Found',
      description: 'Requested MCP tool is not available',
      error,
      expectedCategory: 'Resource Not Found',
      expectedSuggestions: [
        'Check tool name spelling',
        'Verify tool is installed on MCP server',
        'Use available alternative tools'
      ],
      toolContext: {
        toolName: 'custom-analyzer',
        input: { file_path: '/src/code.js', analysis_type: 'complexity' },
        operation: 'code_analysis'
      }
    };
  },

  /**
   * Protocol errors
   */
  protocolError: (): MCPErrorFixture => {
    const error = new Error('Invalid JSON-RPC message: missing "id" field');
    (error as any).code = 'PROTOCOL_ERROR';
    (error as any).details = {
      message: 'JSON-RPC message validation failed',
      field: 'id',
      received: '{"method": "tool/call", "params": {...}}',
      expected: '{"id": 1, "method": "tool/call", "params": {...}}'
    };

    return {
      name: 'Protocol Error',
      description: 'Invalid JSON-RPC message format',
      error,
      expectedCategory: 'Syntax Error',
      expectedSuggestions: [
        'Check the syntax of your input or configuration',
        'Verify JSON-RPC message format',
        'Update MCP client/server versions'
      ],
      toolContext: {
        toolName: 'Bash',
        input: { command: 'echo "test"' },
        operation: 'command_execution'
      }
    };
  },

  /**
   * Server disconnection errors
   */
  serverDisconnect: (): MCPErrorFixture => {
    const error = new Error('MCP server disconnected unexpectedly');
    (error as any).code = 'ECONNRESET';
    (error as any).details = {
      reason: 'Connection reset by peer',
      lastContact: new Date(Date.now() - 5000).toISOString(),
      reconnectAttempts: 2
    };

    return {
      name: 'Server Disconnect',
      description: 'MCP server connection was lost',
      error,
      expectedCategory: 'Network Issue',
      expectedSuggestions: [
        'Check your internet connection and try again',
        'Restart MCP server if possible',
        'Check server logs for errors'
      ],
      toolContext: {
        toolName: 'Read',
        input: { file_path: '/remote/data.txt' },
        operation: 'file_read'
      }
    };
  },

  /**
   * API key authentication errors
   */
  apiKeyError: (): MCPErrorFixture => {
    const error = new Error('Invalid API key for MCP marketplace authentication');
    (error as any).code = 'AUTHENTICATION_FAILED';
    (error as any).details = {
      keyPrefix: 'sk-...',
      provider: 'mcp-marketplace',
      validationError: 'Key format invalid or expired'
    };

    return {
      name: 'API Key Error',
      description: 'Authentication failed with provided API key',
      error,
      expectedCategory: 'API Key Issue',
      expectedSuggestions: [
        'Check your API key configuration',
        'Verify key is not expired',
        'Generate new API key if needed'
      ],
      toolContext: {
        toolName: 'WebSearch',
        input: { query: 'machine learning best practices', api_key: 'sk-invalid' },
        operation: 'search_request'
      }
    };
  },

  /**
   * Resource limits exceeded errors
   */
  resourceLimitsExceeded: (): MCPErrorFixture => {
    const error = new Error('MCP server resource limits exceeded: memory usage too high');
    (error as any).code = 'RESOURCE_EXHAUSTED';
    (error as any).details = {
      resource: 'memory',
      currentUsage: '2.1GB',
      limit: '2GB',
      suggestion: 'Reduce payload size or increase server memory'
    };

    return {
      name: 'Resource Limits Exceeded',
      description: 'MCP server has exceeded resource limits',
      error,
      expectedCategory: 'Resource Issue',
      expectedSuggestions: [
        'Reduce data payload size',
        'Process data in smaller chunks',
        'Contact administrator to increase limits'
      ],
      toolContext: {
        toolName: 'Grep',
        input: { pattern: 'error', path: '/massive-dataset', recursive: true },
        operation: 'file_search'
      }
    };
  },

  /**
   * Nested/chained errors
   */
  nestedError: (): MCPErrorFixture => {
    const rootCause = new Error('Network unreachable: DNS resolution failed');
    (rootCause as any).code = 'ENETUNREACH';

    const midLevel = new Error('Failed to connect to MCP server');
    (midLevel as any).code = 'ECONNREFUSED';
    (midLevel as any).cause = rootCause;

    const topLevel = new Error('MCP tool execution failed');
    (topLevel as any).code = 'EXECUTION_FAILED';
    (topLevel as any).cause = midLevel;

    return {
      name: 'Nested Error Chain',
      description: 'Error with multiple levels of causes',
      error: topLevel,
      expectedCategory: 'Network Issue',
      expectedSuggestions: [
        'Check your internet connection and try again',
        'Verify DNS settings',
        'Check MCP server status'
      ],
      toolContext: {
        toolName: 'WebFetch',
        input: { url: 'https://unreachable-server.example.com/api' },
        operation: 'api_call'
      }
    };
  },

  /**
   * Rate limiting errors
   */
  rateLimitError: (): MCPErrorFixture => {
    const error = new Error('MCP server rate limit exceeded: too many requests');
    (error as any).code = 'RATE_LIMITED';
    (error as any).details = {
      limit: 100,
      window: '1 hour',
      resetTime: new Date(Date.now() + 3600000).toISOString(),
      retryAfter: 3600
    };

    return {
      name: 'Rate Limit Exceeded',
      description: 'Too many requests to MCP server',
      error,
      expectedCategory: 'Rate Limit',
      expectedSuggestions: [
        'Wait before making more requests',
        'Implement request throttling',
        'Consider upgrading plan for higher limits'
      ],
      toolContext: {
        toolName: 'WebSearch',
        input: { query: 'rapid fire search query #100' },
        operation: 'search_request'
      }
    };
  },

  /**
   * Malformed input errors
   */
  malformedInput: (): MCPErrorFixture => {
    const error = new Error('MCP tool input validation failed: invalid file path format');
    (error as any).code = 'INVALID_INPUT';
    (error as any).details = {
      field: 'file_path',
      value: '///invalid//path////',
      expected: 'Valid absolute or relative path',
      validationRules: ['no double slashes', 'no trailing slashes', 'valid characters only']
    };

    return {
      name: 'Malformed Input',
      description: 'Tool input failed validation',
      error,
      expectedCategory: 'Input Validation',
      expectedSuggestions: [
        'Check input format and syntax',
        'Refer to tool documentation',
        'Validate input parameters'
      ],
      toolContext: {
        toolName: 'Read',
        input: { file_path: '///invalid//path////' },
        operation: 'file_read'
      }
    };
  },

  /**
   * Server maintenance errors
   */
  serverMaintenance: (): MCPErrorFixture => {
    const error = new Error('MCP server is temporarily unavailable due to maintenance');
    (error as any).code = 'SERVICE_UNAVAILABLE';
    (error as any).details = {
      maintenanceWindow: {
        start: new Date().toISOString(),
        estimatedEnd: new Date(Date.now() + 7200000).toISOString(),
        duration: '2 hours'
      },
      alternativeEndpoints: []
    };

    return {
      name: 'Server Maintenance',
      description: 'MCP server is under maintenance',
      error,
      expectedCategory: 'Service Unavailable',
      expectedSuggestions: [
        'Try again after maintenance window',
        'Check server status page',
        'Use alternative endpoints if available'
      ],
      toolContext: {
        toolName: 'Bash',
        input: { command: 'ls -la' },
        operation: 'command_execution'
      }
    };
  },

  /**
   * Get all error fixtures for comprehensive testing
   */
  getAllFixtures: (): MCPErrorFixture[] => {
    return [
      mcpErrorFixtures.permissionDenied(),
      mcpErrorFixtures.connectionTimeout(),
      mcpErrorFixtures.toolNotFound(),
      mcpErrorFixtures.protocolError(),
      mcpErrorFixtures.serverDisconnect(),
      mcpErrorFixtures.apiKeyError(),
      mcpErrorFixtures.resourceLimitsExceeded(),
      mcpErrorFixtures.nestedError(),
      mcpErrorFixtures.rateLimitError(),
      mcpErrorFixtures.malformedInput(),
      mcpErrorFixtures.serverMaintenance(),
    ];
  },

  /**
   * Get common error fixtures (most frequently occurring)
   */
  getCommonErrorFixtures: (): MCPErrorFixture[] => {
    return [
      mcpErrorFixtures.permissionDenied(),
      mcpErrorFixtures.connectionTimeout(),
      mcpErrorFixtures.toolNotFound(),
      mcpErrorFixtures.apiKeyError(),
      mcpErrorFixtures.serverDisconnect(),
    ];
  },

  /**
   * Get complex error fixtures (nested, multiple causes)
   */
  getComplexErrorFixtures: (): MCPErrorFixture[] => {
    return [
      mcpErrorFixtures.nestedError(),
      mcpErrorFixtures.resourceLimitsExceeded(),
      mcpErrorFixtures.protocolError(),
      mcpErrorFixtures.rateLimitError(),
    ];
  },

  /**
   * Get edge case error fixtures
   */
  getEdgeCaseErrorFixtures: (): MCPErrorFixture[] => {
    const fixtures: MCPErrorFixture[] = [];

    // Error with no message
    const emptyError = new Error('');
    fixtures.push({
      name: 'Empty Error Message',
      description: 'Error with empty message',
      error: emptyError,
      expectedCategory: 'Unknown Error',
      expectedSuggestions: ['Check logs for more details'],
      toolContext: {
        toolName: 'Unknown',
        input: {},
        operation: 'unknown'
      }
    });

    // Error with very long message
    const longMessage = 'MCP error: ' + 'A'.repeat(1000);
    const longError = new Error(longMessage);
    fixtures.push({
      name: 'Very Long Error Message',
      description: 'Error with extremely long message',
      error: longError,
      expectedCategory: 'Unknown Error',
      expectedSuggestions: [],
      toolContext: {
        toolName: 'Test',
        input: { data: 'test' },
        operation: 'test'
      }
    });

    // Error with special characters
    const unicodeError = new Error('MCP error: 特殊文字エラー 🚨💥 \n\t\r');
    fixtures.push({
      name: 'Unicode Error Message',
      description: 'Error with unicode and special characters',
      error: unicodeError,
      expectedCategory: 'Unknown Error',
      expectedSuggestions: [],
      toolContext: {
        toolName: 'Unicode',
        input: { text: '特殊文字' },
        operation: 'unicode_test'
      }
    });

    return fixtures;
  },
};

/**
 * Helper function to extract error details for display
 */
export function extractErrorDetails(error: Error): {
  message: string;
  code?: string;
  details?: any;
  stack?: string;
  cause?: Error;
} {
  return {
    message: error.message,
    code: (error as any).code,
    details: (error as any).details,
    stack: error.stack,
    cause: (error as any).cause,
  };
}

/**
 * Helper function to categorize MCP errors
 */
export function categorizeMCPError(error: Error): {
  category: string;
  priority: 'high' | 'medium' | 'low';
  suggestions: string[];
} {
  const message = error.message.toLowerCase();
  const code = (error as any).code;

  // Permission errors
  if (message.includes('permission') || code === 'PERMISSION_DENIED') {
    return {
      category: 'Permission Issue',
      priority: 'high',
      suggestions: [
        'Check file/directory permissions',
        'Verify user access rights',
        'Contact administrator for elevated permissions'
      ]
    };
  }

  // Network/connection errors
  if (message.includes('timeout') || message.includes('connection') ||
      ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'].includes(code)) {
    return {
      category: 'Network Issue',
      priority: 'medium',
      suggestions: [
        'Check your internet connection and try again',
        'Verify server availability',
        'Increase timeout value'
      ]
    };
  }

  // Authentication errors
  if (message.includes('api') && message.includes('key') ||
      code === 'AUTHENTICATION_FAILED') {
    return {
      category: 'API Key Issue',
      priority: 'high',
      suggestions: [
        'Check your API key configuration',
        'Verify key is not expired',
        'Generate new API key if needed'
      ]
    };
  }

  // Resource/tool not found
  if (message.includes('not found') || code === 'TOOL_NOT_FOUND') {
    return {
      category: 'Resource Not Found',
      priority: 'medium',
      suggestions: [
        'Check resource name spelling',
        'Verify resource exists',
        'Use available alternatives'
      ]
    };
  }

  // Protocol/syntax errors
  if (message.includes('syntax') || message.includes('json-rpc') ||
      code === 'PROTOCOL_ERROR') {
    return {
      category: 'Syntax Error',
      priority: 'high',
      suggestions: [
        'Check the syntax of your input or configuration',
        'Verify message format',
        'Refer to documentation'
      ]
    };
  }

  // Rate limiting
  if (message.includes('rate limit') || code === 'RATE_LIMITED') {
    return {
      category: 'Rate Limit',
      priority: 'medium',
      suggestions: [
        'Wait before making more requests',
        'Implement request throttling',
        'Consider upgrading plan'
      ]
    };
  }

  // Default/unknown
  return {
    category: 'Unknown Error',
    priority: 'medium',
    suggestions: [
      'Check logs for more details',
      'Contact support if issue persists'
    ]
  };
}

/**
 * Helper function to simulate error context
 */
export function createErrorContext(fixture: MCPErrorFixture): Record<string, unknown> {
  return {
    tool: fixture.toolContext.toolName,
    operation: fixture.toolContext.operation,
    input: fixture.toolContext.input,
    timestamp: new Date().toISOString(),
    errorCode: (fixture.error as any).code,
    details: (fixture.error as any).details,
  };
}

export default mcpErrorFixtures;