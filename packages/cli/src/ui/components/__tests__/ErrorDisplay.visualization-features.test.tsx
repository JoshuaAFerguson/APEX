/**
 * Comprehensive verification tests for ErrorDisplay component focusing on 4 tool visualization features
 *
 * This test suite specifically verifies:
 * 1. Circular reference handling in error context and stack traces
 * 2. Large payload truncation in error messages and context
 * 3. Timing events in error display (error timestamps and duration context)
 * 4. MCP error display with comprehensive MCP-specific error handling
 */

import React from 'react';
import { render, screen } from '../../__tests__/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorDisplay, ErrorSummary, ValidationError, type ErrorSuggestion, type ErrorDisplayProps } from '../ErrorDisplay';
import { useStdoutDimensions } from '../../hooks/index.js';

// Mock the useStdoutDimensions hook
vi.mock('../../hooks/index.js', () => ({
  useStdoutDimensions: vi.fn(() => ({
    width: 80,
    height: 24,
    breakpoint: 'normal' as const,
    isNarrow: false,
    isCompact: false,
    isNormal: true,
    isWide: false,
    isAvailable: true,
  })),
}));

const mockUseStdoutDimensions = vi.mocked(useStdoutDimensions);

describe('ErrorDisplay Component - Verification Tests for 4 Tool Visualization Features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseStdoutDimensions.mockReturnValue({
      width: 80,
      height: 24,
      breakpoint: 'normal',
      isNarrow: false,
      isCompact: false,
      isNormal: true,
      isWide: false,
      isAvailable: true,
    });
  });

  describe('Feature 1: Circular Reference Handling', () => {
    it('should handle circular references in error context without crashing', () => {
      const circular: any = { name: 'test', level: 1 };
      circular.self = circular;
      circular.nested = { parent: circular };

      const context = {
        user: 'testUser',
        config: circular,
        metadata: { timestamp: Date.now() }
      };

      expect(() => render(
        <ErrorDisplay error="Test error with circular context" context={context} />
      )).not.toThrow();

      expect(screen.getByText('Test error with circular context')).toBeInTheDocument();
      expect(screen.getByText('Context:')).toBeInTheDocument();
      expect(screen.getByText(/user: testUser/)).toBeInTheDocument();
    });

    it('should handle deeply nested circular references in context', () => {
      const deep: any = {
        level1: {
          level2: {
            level3: {
              level4: {
                data: 'deep data'
              }
            }
          }
        }
      };

      // Create circular reference at deep level
      deep.level1.level2.level3.level4.backToRoot = deep;

      const context = {
        deepStructure: deep,
        simpleValue: 'test'
      };

      expect(() => render(
        <ErrorDisplay error="Deep circular reference error" context={context} />
      )).not.toThrow();

      expect(screen.getByText('Deep circular reference error')).toBeInTheDocument();
      expect(screen.getByText('Context:')).toBeInTheDocument();
    });

    it('should handle mutual circular references in context objects', () => {
      const objA: any = { name: 'ObjectA', id: 1 };
      const objB: any = { name: 'ObjectB', id: 2 };

      objA.referenceB = objB;
      objB.referenceA = objA;

      const context = {
        primary: objA,
        secondary: objB,
        metadata: { type: 'mutual_reference' }
      };

      expect(() => render(
        <ErrorDisplay error="Mutual circular reference error" context={context} />
      )).not.toThrow();

      expect(screen.getByText('Mutual circular reference error')).toBeInTheDocument();
      expect(screen.getByText(/metadata:/)).toBeInTheDocument();
    });

    it('should handle circular references in Error object properties', () => {
      const error = new Error('Circular error test');

      // Add circular reference to error object
      const circular: any = { errorDetails: 'test' };
      circular.self = circular;
      (error as any).additionalData = circular;

      expect(() => render(
        <ErrorDisplay error={error} showStack={true} />
      )).not.toThrow();

      expect(screen.getByText('Circular error test')).toBeInTheDocument();
    });

    it('should handle circular arrays in context', () => {
      const circularArray: any[] = [1, 2, 3];
      circularArray.push(circularArray); // Self-reference in array

      const context = {
        items: circularArray,
        count: 4
      };

      expect(() => render(
        <ErrorDisplay error="Circular array error" context={context} />
      )).not.toThrow();

      expect(screen.getByText('Circular array error')).toBeInTheDocument();
      expect(screen.getByText(/count: 4/)).toBeInTheDocument();
    });

    it('should handle circular references with null and undefined values', () => {
      const circular: any = {
        validValue: 'test',
        nullValue: null,
        undefinedValue: undefined
      };
      circular.circular = circular;

      const context = {
        data: circular,
        status: 'error'
      };

      expect(() => render(
        <ErrorDisplay error="Circular with null/undefined" context={context} />
      )).not.toThrow();

      expect(screen.getByText(/status: error/)).toBeInTheDocument();
    });
  });

  describe('Feature 2: Large Payload Truncation', () => {
    it('should truncate extremely long error messages', () => {
      const massiveErrorMessage = 'Error: '.repeat(1000) + 'This is the end of a very long error message';

      const props: ErrorDisplayProps = {
        error: massiveErrorMessage,
      };

      render(<ErrorDisplay {...props} />);

      expect(screen.getByText(/Error:/)).toBeInTheDocument();
      // Should truncate the message (indicated by ...)
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    });

    it('should handle massive context objects with truncation', () => {
      const largeContext: Record<string, any> = {};

      // Create large context with many keys
      for (let i = 0; i < 100; i++) {
        largeContext[`key_${i}`] = `${'value'.repeat(100)}_${i}`;
      }

      largeContext.specialKey = 'This should be visible';

      render(
        <ErrorDisplay
          error="Large context error"
          context={largeContext}
        />
      );

      expect(screen.getByText('Large context error')).toBeInTheDocument();
      expect(screen.getByText('Context:')).toBeInTheDocument();
      // Context values should be truncated
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    });

    it('should truncate very long stack traces', () => {
      const error = new Error('Stack trace test');

      // Create massive stack trace
      const stackLines = [];
      for (let i = 0; i < 100; i++) {
        stackLines.push(`    at function${i} (file${i}.js:${i}:${i})`);
      }
      error.stack = `Error: Stack trace test\n${stackLines.join('\n')}`;

      render(
        <ErrorDisplay
          error={error}
          showStack={true}
          verbose={false} // Normal mode should limit stack trace
        />
      );

      expect(screen.getByText('Stack trace test')).toBeInTheDocument();
      expect(screen.getByText(/Stack Trace.*lines/)).toBeInTheDocument();
      // Should show truncation indicator
      expect(screen.getByText(/more lines/)).toBeInTheDocument();
    });

    it('should show full stack trace in verbose mode', () => {
      const error = new Error('Verbose stack test');

      const stackLines = [];
      for (let i = 0; i < 10; i++) {
        stackLines.push(`    at function${i} (file${i}.js:${i}:${i})`);
      }
      error.stack = `Error: Verbose stack test\n${stackLines.join('\n')}`;

      render(
        <ErrorDisplay
          error={error}
          showStack={true}
          verbose={true} // Verbose mode should show more
        />
      );

      expect(screen.getByText('Verbose stack test')).toBeInTheDocument();
      expect(screen.getByText(/function0/)).toBeInTheDocument();
    });

    it('should truncate long error suggestion descriptions', () => {
      const longSuggestions: ErrorSuggestion[] = [
        {
          title: 'Long Suggestion',
          description: 'This is an extremely long suggestion description that goes on and on and should be truncated because it exceeds the reasonable display length for terminal output',
          priority: 'high',
          command: 'very-long-command-that-might-also-need-truncation',
        }
      ];

      render(
        <ErrorDisplay
          error="Test error"
          suggestions={longSuggestions}
          showSuggestions={true}
        />
      );

      expect(screen.getByText('Long Suggestion')).toBeInTheDocument();
      expect(screen.getByText(/extremely long suggestion/)).toBeInTheDocument();
    });

    it('should handle massive context values with proper truncation', () => {
      const massiveValue = {
        largeArray: Array(10000).fill('data'),
        hugeString: 'x'.repeat(100000),
        deepObject: {}
      };

      // Create deep object structure
      let current = massiveValue.deepObject;
      for (let i = 0; i < 50; i++) {
        current = current[`level_${i}`] = {};
      }

      const context = {
        massiveData: massiveValue,
        simpleValue: 'normal'
      };

      const startTime = Date.now();
      render(
        <ErrorDisplay
          error="Massive data error"
          context={context}
        />
      );
      const endTime = Date.now();

      // Should render quickly despite massive data
      expect(endTime - startTime).toBeLessThan(1000);
      expect(screen.getByText('Massive data error')).toBeInTheDocument();
      expect(screen.getByText(/simpleValue: normal/)).toBeInTheDocument();
    });

    it('should truncate context values in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40,
        height: 20,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const context = {
        longKey: 'This is a very long context value that should be truncated in narrow mode'
      };

      render(
        <ErrorDisplay error="Narrow terminal error" context={context} />
      );

      expect(screen.getByText('Narrow terminal error')).toBeInTheDocument();
      // Should be truncated due to narrow terminal
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    });

    it('should handle very wide terminals with full display', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 50,
        breakpoint: 'wide',
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        isAvailable: true,
      });

      const context = {
        normalValue: 'This is a normal context value that should display fully in wide mode',
        anotherValue: 'Another value that has reasonable length'
      };

      render(
        <ErrorDisplay error="Wide terminal error" context={context} />
      );

      expect(screen.getByText('Wide terminal error')).toBeInTheDocument();
      expect(screen.getByText(/normal context value that should display fully/)).toBeInTheDocument();
    });
  });

  describe('Feature 3: Timing Events in Error Display', () => {
    it('should display error with timing context for operations', () => {
      const context = {
        operation: 'file_write',
        startTime: new Date(Date.now() - 5000).toISOString(),
        endTime: new Date().toISOString(),
        duration: 5000,
        attemptCount: 3
      };

      render(
        <ErrorDisplay
          error="Operation failed after timeout"
          context={context}
        />
      );

      expect(screen.getByText('Operation failed after timeout')).toBeInTheDocument();
      expect(screen.getByText(/duration: 5000/)).toBeInTheDocument();
      expect(screen.getByText(/attemptCount: 3/)).toBeInTheDocument();
    });

    it('should show timing-related error suggestions', () => {
      const timeoutError = 'Request timeout after 30 seconds';

      render(<ErrorDisplay error={timeoutError} />);

      expect(screen.getByText(timeoutError)).toBeInTheDocument();
      expect(screen.getByText('Timeout')).toBeInTheDocument();
      expect(screen.getByText(/operation took too long/)).toBeInTheDocument();
    });

    it('should handle timestamp formatting in error context', () => {
      const context = {
        timestamp: new Date('2024-01-01T12:00:00Z').toISOString(),
        lastRetry: new Date('2024-01-01T11:59:45Z').toISOString(),
        nextRetry: new Date('2024-01-01T12:01:00Z').toISOString()
      };

      render(
        <ErrorDisplay
          error="Timing-sensitive operation failed"
          context={context}
        />
      );

      expect(screen.getByText(/timestamp:/)).toBeInTheDocument();
      expect(screen.getByText(/2024-01-01/)).toBeInTheDocument();
    });

    it('should show duration-based error suggestions', () => {
      const context = {
        operationDuration: 120000, // 2 minutes
        expectedDuration: 5000,    // 5 seconds
        timeoutLimit: 30000        // 30 seconds
      };

      render(
        <ErrorDisplay
          error="Operation exceeded time limits"
          context={context}
        />
      );

      expect(screen.getByText(/operationDuration: 120000/)).toBeInTheDocument();
      expect(screen.getByText(/timeoutLimit: 30000/)).toBeInTheDocument();
    });

    it('should handle rapid error sequences with timestamps', () => {
      const errors = [
        {
          id: '1',
          message: 'First timeout error',
          timestamp: new Date(Date.now() - 3000),
          severity: 'error' as const,
          resolved: false,
        },
        {
          id: '2',
          message: 'Second timeout error',
          timestamp: new Date(Date.now() - 2000),
          severity: 'error' as const,
          resolved: false,
        },
        {
          id: '3',
          message: 'Third timeout error',
          timestamp: new Date(Date.now() - 1000),
          severity: 'error' as const,
          resolved: false,
        }
      ];

      render(<ErrorSummary errors={errors} showTimestamps={true} />);

      expect(screen.getByText('First timeout error')).toBeInTheDocument();
      expect(screen.getByText('Second timeout error')).toBeInTheDocument();
      expect(screen.getByText('Third timeout error')).toBeInTheDocument();

      // Should show timestamps for rapid sequence
      const timestampElements = screen.getAllByText(/\[\d{1,2}:\d{2}:\d{2}\]/);
      expect(timestampElements.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle timezone-aware timestamp display', () => {
      const context = {
        utcTime: new Date().toISOString(),
        localTime: new Date().toLocaleString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      render(
        <ErrorDisplay
          error="Timezone-related error"
          context={context}
        />
      );

      expect(screen.getByText(/timezone:/)).toBeInTheDocument();
    });

    it('should show real-time error occurrence tracking', () => {
      const context = {
        errorRate: '5 errors/minute',
        lastOccurrence: new Date(Date.now() - 30000).toISOString(),
        frequency: 'increasing',
        pattern: 'timeout_sequence'
      };

      render(
        <ErrorDisplay
          error="High frequency timeout errors detected"
          context={context}
        />
      );

      expect(screen.getByText(/errorRate: 5 errors\/minute/)).toBeInTheDocument();
      expect(screen.getByText(/frequency: increasing/)).toBeInTheDocument();
    });
  });

  describe('Feature 4: MCP Error Display', () => {
    it('should display comprehensive MCP connection errors', () => {
      const mcpError = 'MCP connection failed: Unable to establish WebSocket connection to server at ws://localhost:8080';

      render(<ErrorDisplay error={mcpError} />);

      expect(screen.getByText(mcpError)).toBeInTheDocument();
      expect(screen.getByText('MCP Connection Failed')).toBeInTheDocument();
      expect(screen.getByText(/Unable to connect to MCP server/)).toBeInTheDocument();
      expect(screen.getByText('apex mcp status')).toBeInTheDocument();
    });

    it('should handle MCP protocol and JSONRPC errors', () => {
      const protocolError = 'MCP protocol error: JSONRPC parse error - Invalid message format in request payload';

      render(<ErrorDisplay error={protocolError} />);

      expect(screen.getByText(protocolError)).toBeInTheDocument();
      expect(screen.getByText('MCP Protocol Error')).toBeInTheDocument();
      expect(screen.getByText(/Protocol incompatibility/)).toBeInTheDocument();
      expect(screen.getByText('apex mcp validate-config')).toBeInTheDocument();
    });

    it('should display MCP server process errors', () => {
      const processError = 'MCP server process crashed: Exit code 1 - Python executable not found';

      render(<ErrorDisplay error={processError} />);

      expect(screen.getByText(processError)).toBeInTheDocument();
      expect(screen.getByText('MCP Server Process Issue')).toBeInTheDocument();
      expect(screen.getByText(/process failed to start or crashed/)).toBeInTheDocument();
      expect(screen.getByText('apex mcp logs')).toBeInTheDocument();
    });

    it('should handle MCP authentication and permission errors', () => {
      const authError = 'MCP authentication failed: Invalid API key or unauthorized access to server resources';

      render(<ErrorDisplay error={authError} />);

      expect(screen.getByText(authError)).toBeInTheDocument();
      expect(screen.getByText('MCP Authentication Error')).toBeInTheDocument();
      expect(screen.getByText(/Authentication failed with MCP server/)).toBeInTheDocument();
      expect(screen.getByText('apex mcp update-credentials')).toBeInTheDocument();
    });

    it('should display MCP timeout errors with context', () => {
      const timeoutError = 'MCP request timeout: Operation exceeded 30 second limit while processing large dataset';
      const context = {
        operation: 'dataset_processing',
        requestId: 'req_12345',
        timeout: 30000,
        serverEndpoint: 'ws://localhost:8080'
      };

      render(
        <ErrorDisplay
          error={timeoutError}
          context={context}
        />
      );

      expect(screen.getByText(timeoutError)).toBeInTheDocument();
      expect(screen.getByText('MCP Timeout')).toBeInTheDocument();
      expect(screen.getByText(/Check server performance/)).toBeInTheDocument();
      expect(screen.getByText('apex mcp health-check')).toBeInTheDocument();
      expect(screen.getByText(/requestId: req_12345/)).toBeInTheDocument();
    });

    it('should handle MCP transport and communication errors', () => {
      const transportError = 'MCP transport error: Failed to send message - WebSocket connection closed unexpectedly';

      render(<ErrorDisplay error={transportError} />);

      expect(screen.getByText(transportError)).toBeInTheDocument();
      expect(screen.getByText('MCP Transport Error')).toBeInTheDocument();
      expect(screen.getByText(/Message transport failed/)).toBeInTheDocument();
    });

    it('should show specific MCP error code handling', () => {
      const errorCodes = [
        'MCP_CONNECTION_FAILED',
        'MCP_DISCONNECTED',
        'MCP_SPAWN_FAILED',
        'MCP_PROCESS_CRASHED',
        'MCP_PARSE_ERROR',
        'MCP_SEND_FAILED',
        'MCP_TIMEOUT'
      ];

      errorCodes.forEach(errorCode => {
        render(
          <ErrorDisplay
            error={`Error ${errorCode}: MCP operation failed`}
          />
        );

        expect(screen.getByText(new RegExp(errorCode))).toBeInTheDocument();
      });
    });

    it('should handle complex MCP error with stack trace and context', () => {
      const mcpError = new Error('MCP server internal error: Database connection failed');
      mcpError.stack = `Error: MCP server internal error
    at MCPServer.handleRequest (mcp-server.js:123:45)
    at WebSocketHandler.onMessage (websocket.js:67:12)
    at WebSocket.emit (events.js:314:20)`;

      const context = {
        mcpVersion: '1.2.3',
        serverPid: 12345,
        lastHeartbeat: new Date(Date.now() - 60000).toISOString(),
        connectionCount: 5,
        memoryUsage: '256MB'
      };

      render(
        <ErrorDisplay
          error={mcpError}
          context={context}
          showStack={true}
        />
      );

      expect(screen.getByText('MCP server internal error: Database connection failed')).toBeInTheDocument();
      expect(screen.getByText('MCP Server Issue')).toBeInTheDocument();
      expect(screen.getByText(/mcpVersion: 1.2.3/)).toBeInTheDocument();
      expect(screen.getByText(/serverPid: 12345/)).toBeInTheDocument();
    });

    it('should display MCP configuration errors', () => {
      const configError = 'MCP configuration invalid: Missing required field "server_endpoint" in mcp.config.json';
      const context = {
        configFile: '/path/to/mcp.config.json',
        missingFields: ['server_endpoint', 'api_key'],
        validationErrors: 3
      };

      render(
        <ErrorDisplay
          error={configError}
          context={context}
        />
      );

      expect(screen.getByText(configError)).toBeInTheDocument();
      expect(screen.getByText(/configFile:/)).toBeInTheDocument();
      expect(screen.getByText(/validationErrors: 3/)).toBeInTheDocument();
    });

    it('should show MCP version compatibility errors', () => {
      const versionError = 'MCP version mismatch: Client v2.0.0 incompatible with server v1.5.0';
      const context = {
        clientVersion: '2.0.0',
        serverVersion: '1.5.0',
        minimumRequired: '1.8.0',
        compatibility: 'incompatible'
      };

      render(
        <ErrorDisplay
          error={versionError}
          context={context}
        />
      );

      expect(screen.getByText(versionError)).toBeInTheDocument();
      expect(screen.getByText(/clientVersion: 2.0.0/)).toBeInTheDocument();
      expect(screen.getByText(/compatibility: incompatible/)).toBeInTheDocument();
    });

    it('should handle multiple MCP error scenarios with suggestions', () => {
      const complexMcpError = `Multiple MCP issues detected:
1. Connection timeout to primary server
2. Authentication failed on backup server
3. Protocol version mismatch on tertiary server`;

      render(<ErrorDisplay error={complexMcpError} />);

      expect(screen.getByText(/Multiple MCP issues detected/)).toBeInTheDocument();
      expect(screen.getByText('MCP Server Issue')).toBeInTheDocument();
      expect(screen.getByText('apex mcp diagnose')).toBeInTheDocument();
    });

    it('should handle MCP errors with suggested configuration fixes', () => {
      const configSuggestions: ErrorSuggestion[] = [
        {
          title: 'Update MCP Configuration',
          description: 'Add missing server endpoint and API key to configuration',
          command: 'apex mcp config --endpoint ws://localhost:8080 --key YOUR_API_KEY',
          priority: 'high',
        },
        {
          title: 'Restart MCP Server',
          description: 'Restart the server to apply configuration changes',
          command: 'apex mcp restart',
          priority: 'medium',
        }
      ];

      render(
        <ErrorDisplay
          error="MCP configuration incomplete"
          suggestions={configSuggestions}
          showSuggestions={true}
        />
      );

      expect(screen.getByText('Update MCP Configuration')).toBeInTheDocument();
      expect(screen.getByText('Restart MCP Server')).toBeInTheDocument();
      expect(screen.getByText(/apex mcp config/)).toBeInTheDocument();
      expect(screen.getByText(/apex mcp restart/)).toBeInTheDocument();
    });
  });

  describe('Integration Tests - Combined Features', () => {
    it('should handle all features together in complex error scenario', () => {
      // Large circular context
      const complexCircular: any = {
        mcpConfig: {
          endpoint: 'ws://localhost:8080',
          timeout: 30000,
          retries: 3
        },
        errorHistory: Array(100).fill('previous error'),
        timestamp: Date.now()
      };
      complexCircular.mcpConfig.parent = complexCircular;
      complexCircular.self = complexCircular;

      // Complex MCP error with timing
      const complexError = `MCP operation failed: Server connection lost during large payload transmission.
Connection details: ws://localhost:8080
Duration: 45 seconds
Payload size: 10MB
Error code: MCP_CONNECTION_LOST`;

      const suggestions: ErrorSuggestion[] = [
        {
          title: 'Increase Timeout',
          description: 'The operation may need more time for large payloads',
          command: 'apex config set mcp.timeout 60000',
          priority: 'high',
        },
        {
          title: 'Check Network Stability',
          description: 'Verify network connection and server availability',
          action: 'retry',
          priority: 'medium',
        }
      ];

      const startTime = Date.now();
      expect(() => render(
        <ErrorDisplay
          error={complexError}
          context={complexCircular}
          suggestions={suggestions}
          showSuggestions={true}
          showStack={true}
          verbose={true}
        />
      )).not.toThrow();
      const endTime = Date.now();

      // Should render quickly despite complex data
      expect(endTime - startTime).toBeLessThan(2000);

      expect(screen.getByText(/MCP operation failed/)).toBeInTheDocument();
      expect(screen.getByText('Context:')).toBeInTheDocument();
      expect(screen.getByText('Increase Timeout')).toBeInTheDocument();
      expect(screen.getByText('Check Network Stability')).toBeInTheDocument();
    });

    it('should handle error recovery scenarios with all features', () => {
      const errorHistory = [
        {
          id: '1',
          message: 'MCP connection failed (attempt 1)',
          timestamp: new Date(Date.now() - 10000),
          severity: 'error' as const,
          resolved: false,
        },
        {
          id: '2',
          message: 'MCP connection failed (attempt 2)',
          timestamp: new Date(Date.now() - 8000),
          severity: 'error' as const,
          resolved: false,
        },
        {
          id: '3',
          message: 'MCP connection timeout (attempt 3)',
          timestamp: new Date(Date.now() - 5000),
          severity: 'error' as const,
          resolved: false,
        },
        {
          id: '4',
          message: 'MCP connection successful (retry worked)',
          timestamp: new Date(Date.now() - 1000),
          severity: 'info' as const,
          resolved: true,
        }
      ];

      render(<ErrorSummary errors={errorHistory} showTimestamps={true} />);

      expect(screen.getByText(/MCP connection failed.*attempt 1/)).toBeInTheDocument();
      expect(screen.getByText(/MCP connection successful/)).toBeInTheDocument();
      expect(screen.getByText('3 unresolved')).toBeInTheDocument(); // 3 errors, 1 info
    });

    it('should handle massive error context with timing and MCP details', () => {
      const massiveContext: any = {
        mcpDetails: {
          servers: Array(50).fill(0).map((_, i) => ({
            id: i,
            endpoint: `ws://server${i}.example.com:8080`,
            status: i % 3 === 0 ? 'failed' : 'connected',
            lastPing: Date.now() - (i * 1000)
          }))
        },
        diagnostics: {
          totalRequests: 10000,
          failedRequests: 1250,
          averageResponseTime: 2500,
          errors: Array(1000).fill('timeout error')
        },
        timing: {
          startTime: new Date(Date.now() - 300000).toISOString(),
          currentTime: new Date().toISOString(),
          totalDuration: 300000
        }
      };

      // Create circular reference
      massiveContext.mcpDetails.parent = massiveContext;

      const startTime = Date.now();
      render(
        <ErrorDisplay
          error="Massive MCP infrastructure failure"
          context={massiveContext}
        />
      );
      const endTime = Date.now();

      // Should handle massive data efficiently
      expect(endTime - startTime).toBeLessThan(3000);

      expect(screen.getByText('Massive MCP infrastructure failure')).toBeInTheDocument();
      expect(screen.getByText('Context:')).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Resilience', () => {
    it('should handle malformed JSON in context without crashing', () => {
      const context = {
        malformedJson: '{"incomplete": json, missing bracket',
        validData: 'normal value'
      };

      expect(() => render(
        <ErrorDisplay error="JSON parsing error" context={context} />
      )).not.toThrow();

      expect(screen.getByText(/validData: normal value/)).toBeInTheDocument();
    });

    it('should handle null and undefined values gracefully', () => {
      const context = {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        zeroValue: 0,
        falseValue: false
      };

      expect(() => render(
        <ErrorDisplay error="Null/undefined handling test" context={context} />
      )).not.toThrow();

      expect(screen.getByText(/nullValue: null/)).toBeInTheDocument();
      expect(screen.getByText(/emptyString: /)).toBeInTheDocument();
      expect(screen.getByText(/zeroValue: 0/)).toBeInTheDocument();
    });

    it('should handle Unicode and special characters in all fields', () => {
      const unicodeError = 'Unicode test: 你好世界 🌍 Ñiño café résumé';
      const context = {
        emoji: '🚀💻⭐🔥💯',
        chinese: '中文测试',
        accents: 'àáâãäåæçèéêëìíîïñòóôõöøùúûüý',
        symbols: '∑∆∇∂∫∏∐∪∩⊂⊃'
      };

      render(
        <ErrorDisplay
          error={unicodeError}
          context={context}
        />
      );

      expect(screen.getByText(/你好世界 🌍 Ñiño café résumé/)).toBeInTheDocument();
      expect(screen.getByText(/🚀💻⭐🔥💯/)).toBeInTheDocument();
      expect(screen.getByText(/中文测试/)).toBeInTheDocument();
    });
  });
});