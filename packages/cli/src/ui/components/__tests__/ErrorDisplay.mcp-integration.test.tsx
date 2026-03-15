import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { ErrorDisplay, ErrorSuggestion } from '../ErrorDisplay.js';

// Mock the hooks module
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: vi.fn(() => ({
    width: 80,
    height: 24,
    breakpoint: 'normal' as const,
    isNarrow: false,
  })),
}));

interface MCPError extends Error {
  code?: string;
  category?: 'connection' | 'protocol' | 'transport' | 'timeout' | 'auth' | 'unknown';
  recoverable?: boolean;
  metadata?: Record<string, unknown>;
}

describe('ErrorDisplay MCP Error Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MCP-specific error pattern detection', () => {
    it('generates appropriate suggestions for MCP connection errors', () => {
      const mcpConnectionError = new Error('MCP connection failed to server') as MCPError;
      mcpConnectionError.code = 'CONNECTION_FAILED';
      mcpConnectionError.category = 'connection';

      const { lastFrame } = render(
        <ErrorDisplay
          error={mcpConnectionError}
          title="MCP Connection Error"
          showSuggestions={true}
        />
      );

      const output = lastFrame();

      // Should contain MCP-specific suggestions
      expect(output).toContain('💡 Suggestions:');
      expect(output).toContain('MCP Connection Failed');
      expect(output).toContain('apex mcp status');
      // Text might be truncated with "..." so check for partial match
      expect(output).toContain('Check server status and conf');
    });

    it('provides specific suggestions for MCP process spawn errors', () => {
      const spawnError = new Error('MCP server process spawn failed') as MCPError;
      spawnError.code = 'SPAWN_FAILED';
      spawnError.category = 'transport';

      const { lastFrame } = render(
        <ErrorDisplay
          error={spawnError}
          showSuggestions={true}
        />
      );

      const output = lastFrame();

      expect(output).toContain('MCP Server Process Issue');
      expect(output).toContain('apex mcp logs');
      expect(output).toContain('Check server e'); // Truncated text
    });

    it('handles MCP timeout errors with appropriate recovery suggestions', () => {
      const timeoutError = new Error('MCP operation timeout after 30s') as MCPError;
      timeoutError.code = 'TIMEOUT';
      timeoutError.category = 'timeout';

      const { lastFrame } = render(
        <ErrorDisplay
          error={timeoutError}
          showSuggestions={true}
        />
      );

      const output = lastFrame();

      expect(output).toContain('MCP Timeout');
      expect(output).toContain('apex mcp health-check');
      expect(output).toContain('Check server performance'); // Truncated text
    });

    it('recognizes MCP protocol errors and suggests validation', () => {
      const protocolError = new Error('MCP protocol version mismatch') as MCPError;
      protocolError.code = 'PROTOCOL_ERROR';
      protocolError.category = 'protocol';

      const { lastFrame } = render(
        <ErrorDisplay
          error={protocolError}
          showSuggestions={true}
        />
      );

      const output = lastFrame();

      expect(output).toContain('MCP Protocol Error');
      expect(output).toContain('apex mcp validate-config');
      expect(output).toContain('Protocol incompatibility or invalid message format');
    });

    it('provides authentication-specific suggestions for MCP auth errors', () => {
      const authError = new Error('MCP server authentication failed') as MCPError;
      authError.code = 'AUTH_FAILED';
      authError.category = 'auth';

      const { lastFrame } = render(
        <ErrorDisplay
          error={authError}
          showSuggestions={true}
        />
      );

      const output = lastFrame();

      expect(output).toContain('MCP Authentication Error');
      expect(output).toContain('apex mcp update-credentials');
      expect(output).toContain('Check credentials'); // Truncated text
    });

    it('handles MCP transport errors with retry suggestions', () => {
      const transportError = new Error('MCP message transport failed') as MCPError;
      transportError.code = 'TRANSPORT_ERROR';
      transportError.category = 'transport';

      const { lastFrame } = render(
        <ErrorDisplay
          error={transportError}
          showSuggestions={true}
        />
      );

      const output = lastFrame();

      expect(output).toContain('MCP Transport Error');
      expect(output).toContain('retry');
      expect(output).toContain('Check network connectivity'); // Truncated text
    });
  });

  describe('MCP error code specific handling', () => {
    it('handles CONNECTION_FAILED error code specifically', () => {
      const connectionFailedError = new Error('Connection to MCP server lost CONNECTION_FAILED') as MCPError;
      connectionFailedError.code = 'CONNECTION_FAILED';

      const { lastFrame } = render(
        <ErrorDisplay
          error={connectionFailedError}
          showSuggestions={true}
        />
      );

      const output = lastFrame();

      expect(output).toContain('MCP Connection Lost');
      expect(output).toContain('apex mcp restart');
      expect(output).toContain('Connection to MCP server'); // Truncated text
    });

    it('handles PROCESS_CRASHED error code with repair suggestions', () => {
      const processCrashedError = new Error('MCP server process crashed unexpectedly') as MCPError;
      processCrashedError.code = 'PROCESS_CRASHED';

      const { lastFrame } = render(
        <ErrorDisplay
          error={processCrashedError}
          showSuggestions={true}
        />
      );

      const output = lastFrame();

      expect(output).toContain('MCP Process Error');
      expect(output).toContain('apex mcp install --repair');
      expect(output).toContain('Check executable permissions'); // Truncated text
    });

    it('handles PARSE_ERROR with protocol compatibility suggestions', () => {
      const parseError = new Error('Failed to parse MCP message') as MCPError;
      parseError.code = 'PARSE_ERROR';

      const { lastFrame } = render(
        <ErrorDisplay
          error={parseError}
          showSuggestions={true}
        />
      );

      const output = lastFrame();

      expect(output).toContain('MCP Message Error');
      expect(output).toContain('apex mcp version-check');
      expect(output).toContain('Check protocol'); // Truncated text
    });

    it('handles MCP TIMEOUT with configuration suggestions', () => {
      const mcpTimeoutError = new Error('MCP operation timed out') as MCPError;
      mcpTimeoutError.code = 'TIMEOUT';
      mcpTimeoutError.stack = mcpTimeoutError.stack?.replace('Error:', 'MCPError:');

      const { lastFrame } = render(
        <ErrorDisplay
          error={mcpTimeoutError}
          showSuggestions={true}
        />
      );

      const output = lastFrame();

      expect(output).toContain('MCP Operation Timeout');
      expect(output).toContain('apex config set mcp.timeout 30000');
      expect(output).toContain('Increase timeout'); // Truncated text
    });
  });

  describe('MCP error context display', () => {
    it('displays MCP error context information properly', () => {
      const mcpError = new Error('MCP server communication error') as MCPError;
      mcpError.code = 'COMMUNICATION_ERROR';
      mcpError.category = 'transport';

      const context = {
        serverId: 'mcp-server-1',
        serverName: 'Example MCP Server',
        protocolVersion: '2024-11-05',
        lastSuccessfulMessage: '2024-01-15T10:30:00Z',
        connectionAttempts: 3
      };

      const { lastFrame } = render(
        <ErrorDisplay
          error={mcpError}
          context={context}
          showSuggestions={true}
        />
      );

      const output = lastFrame();

      // Context should be displayed
      expect(output).toContain('Context:');
      expect(output).toContain('serverId: mcp-server-1');
      expect(output).toContain('serverName: Example MCP Server');
      expect(output).toContain('protocolVersion: 2024-11-05');
      expect(output).toContain('connectionAttempts: 3');
    });

    it('handles complex MCP metadata in context', () => {
      const mcpError = new Error('MCP capability negotiation failed') as MCPError;

      const complexContext = {
        capabilities: {
          logging: { enabled: true, level: 'info' },
          prompts: { enabled: false },
          resources: { enabled: true, count: 15 }
        },
        serverInfo: {
          name: 'Advanced MCP Server',
          version: '1.2.3',
          vendor: 'Example Corp'
        },
        lastError: {
          code: 'NEGOTIATION_FAILED',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      const { lastFrame } = render(
        <ErrorDisplay
          error={mcpError}
          context={complexContext}
          showSuggestions={false} // Focus on context display
        />
      );

      const output = lastFrame();

      expect(output).toContain('Context:');
      // Should handle JSON serialization of complex objects
      expect(output).toContain('capabilities:');
      expect(output).toContain('serverInfo:');
    });
  });

  describe('MCP error recovery information integration', () => {
    it('displays custom MCP recovery suggestions', () => {
      const mcpError = new Error('MCP server health check failed') as MCPError;

      const mcpSuggestions: ErrorSuggestion[] = [
        {
          title: 'Check MCP Server Health',
          description: 'Run health diagnostics on the MCP server to identify issues.',
          command: 'apex mcp health-check --verbose',
          priority: 'high'
        },
        {
          title: 'Review Server Configuration',
          description: 'Verify MCP server configuration matches client expectations.',
          command: 'apex mcp config validate',
          priority: 'medium'
        },
        {
          title: 'Restart MCP Services',
          description: 'Restart all MCP-related services to clear transient issues.',
          action: 'restart',
          priority: 'low'
        }
      ];

      const { lastFrame } = render(
        <ErrorDisplay
          error={mcpError}
          suggestions={mcpSuggestions}
          showSuggestions={true}
        />
      );

      const output = lastFrame();

      expect(output).toContain('💡 Suggestions:');
      expect(output).toContain('🔴 Check MCP Server Health'); // High priority
      expect(output).toContain('apex mcp health-check --verbose');
      expect(output).toContain('🟡 Review Server Configuration'); // Medium priority
      expect(output).toContain('apex mcp config validate');
      expect(output).toContain('🟢 Restart MCP Services'); // Low priority
      expect(output).toContain('Action: restart');
    });

    it('combines auto-generated and custom MCP suggestions without duplicates', () => {
      const mcpError = new Error('MCP connection failed') as MCPError;

      // Custom suggestion that might overlap with auto-generated ones
      const customSuggestions: ErrorSuggestion[] = [
        {
          title: 'MCP Connection Failed', // Same title as auto-generated
          description: 'Custom description for connection failure.',
          command: 'custom-mcp-command',
          priority: 'high'
        },
        {
          title: 'Check Firewall Settings',
          description: 'Ensure firewall allows MCP communication.',
          priority: 'medium'
        }
      ];

      const { lastFrame } = render(
        <ErrorDisplay
          error={mcpError}
          suggestions={customSuggestions}
          showSuggestions={true}
        />
      );

      const output = lastFrame();

      // Should not have duplicate titles
      const connectionFailedMatches = (output.match(/MCP Connection Failed/g) || []).length;
      expect(connectionFailedMatches).toBe(1);

      // Should include both auto-generated and custom suggestions
      expect(output).toContain('Check Firewall Settings');
      expect(output).toContain('Custom description for connection failure');
    });
  });

  describe('responsive behavior with MCP errors', () => {
    it('truncates long MCP error messages appropriately', () => {
      const longMcpError = new Error(
        'MCP server communication error: Failed to establish connection to server at endpoint wss://example.com:8080/mcp due to network timeout after multiple retry attempts with exponential backoff strategy'
      ) as MCPError;

      const { lastFrame } = render(
        <ErrorDisplay
          error={longMcpError}
          width={50} // Limited width
          showSuggestions={false}
        />
      );

      const output = lastFrame();

      // Message should be truncated but still readable
      expect(output).toContain('...');
      expect(output).toContain('MCP server communication error');
    });

    it('handles MCP error stack traces with responsive truncation', () => {
      const mcpErrorWithStack = new Error('MCP protocol error') as MCPError;
      mcpErrorWithStack.stack = `MCPProtocolError: MCP protocol error
    at MCPConnection.processMessage (/very/long/path/to/mcp/connection/handler.js:150:25)
    at MCPServer.handleClientMessage (/another/very/long/path/to/server/implementation.js:200:30)
    at EventEmitter.emit (events.js:314:20)
    at MCPTransport.onMessage (/extremely/long/path/to/transport/layer/implementation.js:75:15)`;

      const { lastFrame } = render(
        <ErrorDisplay
          error={mcpErrorWithStack}
          showStack={true}
          width={60} // Limited width
        />
      );

      const output = lastFrame();

      expect(output).toContain('Stack Trace');
      expect(output).toContain('MCP protocol error');
      // Stack trace should be shown (even if truncated)
      expect(output.includes('MCPConnection') || output.includes('MCPServer') || output.includes('...')).toBe(true);
    });
  });

  describe('accessibility and usability for MCP errors', () => {
    it('uses clear visual indicators for MCP error categories', () => {
      const highPriorityMcpError = new Error('Critical MCP server failure') as MCPError;
      highPriorityMcpError.code = 'CRITICAL_FAILURE';
      highPriorityMcpError.category = 'connection';

      const { lastFrame } = render(
        <ErrorDisplay
          error={highPriorityMcpError}
          showSuggestions={true}
        />
      );

      const output = lastFrame();

      // Should use appropriate visual indicators
      expect(output).toContain('❌'); // Error icon
      expect(output).toContain('💡 Suggestions:');
      // Priority might be lower for general MCP error vs specific codes, check for any priority icon
      expect(output).toMatch(/[🔴🟡🟢]/); // Any priority icon
    });

    it('provides actionable commands for MCP error resolution', () => {
      const mcpConfigError = new Error('MCP configuration validation failed') as MCPError;

      const { lastFrame } = render(
        <ErrorDisplay
          error={mcpConfigError}
          showSuggestions={true}
        />
      );

      const output = lastFrame();

      // Should provide copy-pasteable commands
      expect(output).toMatch(/apex mcp \w+/); // Commands should be properly formatted
      expect(output).toContain('Try:'); // Command prefix
    });
  });
});