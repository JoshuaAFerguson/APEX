/**
 * Comprehensive verification tests for all 4 tool visualization features
 *
 * This test suite specifically verifies:
 * 1. Circular reference handling in tool inputs/outputs
 * 2. Large payload truncation mechanisms
 * 3. Timing events streaming and duration display
 * 4. MCP error display and error handling
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolCall, type ToolCallProps } from '../ToolCall.js';

// Mock the ink-spinner component
vi.mock('ink-spinner', () => ({
  default: () => '⠋',
}));

describe('ToolCall Component - Verification Tests for 4 Tool Visualization Features', () => {
  let defaultProps: ToolCallProps;

  beforeEach(() => {
    defaultProps = {
      toolName: 'TestTool',
      status: 'pending',
    };
  });

  describe('Feature 1: Circular Reference Handling', () => {
    it('should handle simple circular references without crashing', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      const props: ToolCallProps = {
        ...defaultProps,
        input: { data: circular },
        status: 'success',
      };

      expect(() => render(<ToolCall {...props} />)).not.toThrow();

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('TestTool');
      expect(lastFrame()).toContain('✓');
    });

    it('should handle complex circular references with multiple levels', () => {
      const obj1: any = { id: 1 };
      const obj2: any = { id: 2 };
      const obj3: any = { id: 3 };

      obj1.ref = obj2;
      obj2.ref = obj3;
      obj3.ref = obj1; // Create cycle

      const props: ToolCallProps = {
        ...defaultProps,
        input: { complex: obj1 },
        status: 'success',
      };

      expect(() => render(<ToolCall {...props} />)).not.toThrow();

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('TestTool');
      expect(lastFrame()).toContain('1 params');
    });

    it('should handle circular references in arrays', () => {
      const arr: any[] = [1, 2, 3];
      arr.push(arr); // Self-reference

      const props: ToolCallProps = {
        ...defaultProps,
        input: { arrayData: arr },
        status: 'success',
      };

      expect(() => render(<ToolCall {...props} />)).not.toThrow();

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('TestTool');
    });

    it('should handle deeply nested circular references', () => {
      const deep: any = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {}
              }
            }
          }
        }
      };

      // Create circular reference at deep level
      deep.level1.level2.level3.level4.level5.backToRoot = deep;

      const props: ToolCallProps = {
        ...defaultProps,
        input: { deepData: deep },
        status: 'success',
      };

      expect(() => render(<ToolCall {...props} />)).not.toThrow();

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('TestTool');
    });

    it('should handle mutual circular references between objects', () => {
      const objA: any = { name: 'A' };
      const objB: any = { name: 'B' };

      objA.refB = objB;
      objB.refA = objA; // Mutual reference

      const props: ToolCallProps = {
        ...defaultProps,
        input: { objectA: objA, objectB: objB },
        status: 'success',
      };

      expect(() => render(<ToolCall {...props} />)).not.toThrow();

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('TestTool');
      expect(lastFrame()).toContain('2 params');
    });

    it('should sanitize circular reference data when displaying input', () => {
      const circular: any = { validKey: 'validValue' };
      circular.circular = circular;

      const props: ToolCallProps = {
        ...defaultProps,
        input: circular, // Direct circular object as input
        status: 'success',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('validKey');
      expect(lastFrame()).toContain('validValue');
    });
  });

  describe('Feature 2: Large Payload Truncation', () => {
    it('should truncate extremely long string inputs', () => {
      const massiveString = 'A'.repeat(1000);

      const props: ToolCallProps = {
        ...defaultProps,
        input: { largeData: massiveString },
        status: 'success',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('...');
      expect(lastFrame()).not.toContain('A'.repeat(100)); // Shouldn't contain full string
    });

    it('should handle massive output truncation in normal mode', () => {
      const massiveOutput = Array(100).fill('This is a very long line of output that repeats many times').join('\n');

      const props: ToolCallProps = {
        ...defaultProps,
        output: massiveOutput,
        status: 'success',
        displayMode: 'normal',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('more lines');
    });

    it('should show full output in verbose mode even for large payloads', () => {
      const largeOutput = Array(10).fill('Line of output').join('\n');

      const props: ToolCallProps = {
        ...defaultProps,
        output: largeOutput,
        status: 'success',
        displayMode: 'verbose',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Line of output');
      // In verbose mode, should show more content
      expect(lastFrame()).toBeDefined();
    });

    it('should handle large input parameter objects with many keys', () => {
      const largeInput: Record<string, any> = {};
      for (let i = 0; i < 50; i++) {
        largeInput[`key_${i}`] = `value_${i}`;
      }

      const props: ToolCallProps = {
        ...defaultProps,
        input: largeInput,
        status: 'success',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      // Should show first key or param count, not all 50 params
      expect(lastFrame()).toBeDefined();
      expect(lastFrame()).not.toContain('key_49'); // Shouldn't show last key
    });

    it('should truncate very long parameter keys', () => {
      const longKey = 'this_is_an_extremely_long_parameter_key_that_should_be_truncated';

      const props: ToolCallProps = {
        ...defaultProps,
        input: { [longKey]: 'short_value' },
        status: 'success',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      // Key should be truncated and sanitized
      const frame = lastFrame();
      expect(frame).toContain('this_is_an_extremely_long_para'); // Should be truncated to ~30 chars
      expect(frame).not.toContain(longKey); // Should not contain full long key
    });

    it('should handle binary-like data in parameters', () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE]).toString('base64');

      const props: ToolCallProps = {
        ...defaultProps,
        input: { binaryData },
        status: 'success',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('binaryData');
    });

    it('should gracefully handle JSON payloads that are too large', () => {
      const largeObject = {
        data: Array(1000).fill(0).map((_, i) => ({ id: i, value: `item_${i}` }))
      };

      const props: ToolCallProps = {
        ...defaultProps,
        input: largeObject,
        status: 'success',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('TestTool');
      // Should show param count, not full object
      expect(lastFrame()).toContain('1 params');
    });

    it('should handle output with extremely long single lines', () => {
      const longLine = 'X'.repeat(10000);

      const props: ToolCallProps = {
        ...defaultProps,
        output: longLine,
        status: 'success',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('TestTool');
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('Feature 3: Timing Events Streaming', () => {
    it('should display precise millisecond durations for very fast operations', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        status: 'success',
        duration: 1, // 1ms
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('1ms');
    });

    it('should display second durations for moderate operations', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        status: 'success',
        duration: 2750, // 2.75 seconds
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('2.8s'); // Should round to 2.8s
    });

    it('should display minute:second format for long operations', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        status: 'success',
        duration: 95000, // 1m 35s
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('1m');
      expect(lastFrame()).toContain('35s');
    });

    it('should handle extremely long duration formatting', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        status: 'success',
        duration: 7265000, // 2h 1m 5s
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('h');
      expect(lastFrame()).toContain('m');
    });

    it('should not display duration for pending operations', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        status: 'pending',
        duration: 5000, // Should be ignored
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).not.toContain('5.0s');
      expect(lastFrame()).toContain('○'); // Should show pending icon
    });

    it('should not display duration for running operations', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        status: 'running',
        duration: 3000, // Should be ignored for running state
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).not.toContain('3.0s');
      expect(lastFrame()).toContain('⠋'); // Should show spinner
    });

    it('should display duration for failed operations', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        status: 'error',
        duration: 1500,
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('1.5s');
      expect(lastFrame()).toContain('✗'); // Should show error icon
    });

    it('should handle zero duration edge case', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        status: 'success',
        duration: 0,
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('0ms');
    });

    it('should handle fractional millisecond durations', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        status: 'success',
        duration: 0.5, // Half millisecond
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('0.5ms');
    });

    it('should display duration correctly in compact mode', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        status: 'success',
        duration: 2500,
        displayMode: 'compact',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('2.5s');
    });
  });

  describe('Feature 4: MCP Error Display', () => {
    it('should properly display MCP connection errors', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        toolName: 'MCPTool',
        status: 'error',
        output: 'MCP connection failed: Unable to establish connection to server localhost:8080',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).toContain('MCP connection failed');
      expect(lastFrame()).toContain('localhost:8080');
    });

    it('should handle MCP protocol errors', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        toolName: 'MCPTool',
        status: 'error',
        output: 'JSONRPC parse error: Invalid message format in request',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).toContain('JSONRPC parse error');
    });

    it('should display MCP timeout errors with duration', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        toolName: 'MCPTool',
        status: 'error',
        output: 'MCP request timeout: Operation exceeded 30 second limit',
        duration: 30000,
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).toContain('timeout');
      expect(lastFrame()).toContain('30.0s');
    });

    it('should handle MCP authentication errors', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        toolName: 'MCPTool',
        status: 'error',
        output: 'MCP authentication failed: Invalid credentials provided',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).toContain('authentication failed');
    });

    it('should display MCP server crash errors', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        toolName: 'MCPTool',
        status: 'error',
        output: 'MCP server process crashed unexpectedly (exit code: 1)',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).toContain('server process crashed');
      expect(lastFrame()).toContain('exit code: 1');
    });

    it('should handle generic MCP transport errors', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        toolName: 'MCPTool',
        status: 'error',
        output: 'MCP transport error: Failed to send message over WebSocket',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).toContain('transport error');
    });

    it('should show error indicator in compact mode for MCP errors', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        toolName: 'MCPTool',
        status: 'error',
        output: 'MCP connection failed',
        displayMode: 'compact',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('(error)');
    });

    it('should handle long MCP error messages with truncation', () => {
      const longErrorMessage = 'MCP connection failed due to network timeout while attempting to establish connection to remote server at address 192.168.1.100:8080 with authentication token that may have expired or been revoked by the server administrator. Please check your network connection and verify that your credentials are still valid.';

      const props: ToolCallProps = {
        ...defaultProps,
        toolName: 'MCPTool',
        status: 'error',
        output: longErrorMessage,
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).toContain('MCP connection failed');
    });

    it('should handle MCP errors with stack traces', () => {
      const errorWithStack = `MCP server error: Unhandled exception
at MCPServer.handleRequest (/app/mcp-server.js:123:45)
at WebSocket.onMessage (/app/websocket.js:67:12)
at WebSocket.emit (events.js:314:20)
at Receiver.receiverOnMessage (/node_modules/ws/lib/websocket.js:789:20)`;

      const props: ToolCallProps = {
        ...defaultProps,
        toolName: 'MCPTool',
        status: 'error',
        output: errorWithStack,
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).toContain('Unhandled exception');
    });

    it('should handle empty MCP error output gracefully', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        toolName: 'MCPTool',
        status: 'error',
        output: '',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).toContain('MCPTool');
    });

    it('should display network-related error messages', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        toolName: 'WebFetch',
        status: 'error',
        output: 'Network request failed: ECONNREFUSED - Connection refused by target host',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).toContain('Network request failed');
      expect(lastFrame()).toContain('ECONNREFUSED');
    });
  });

  describe('Integration Tests - Combined Features', () => {
    it('should handle large circular data with errors and timing', () => {
      const circular: any = { data: Array(100).fill('large data') };
      circular.self = circular;

      const props: ToolCallProps = {
        ...defaultProps,
        input: { large: circular },
        status: 'error',
        output: 'Processing failed due to circular reference in data',
        duration: 5500,
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).toContain('5.5s');
      expect(lastFrame()).toContain('Processing failed');
      expect(lastFrame()).toContain('1 params');
    });

    it('should handle all features in verbose mode', () => {
      const complexData: any = {
        config: { timeout: 30000 },
        largeArray: Array(1000).fill('data')
      };
      complexData.circular = complexData;

      const props: ToolCallProps = {
        ...defaultProps,
        input: complexData,
        status: 'error',
        output: 'MCP connection timeout after processing large dataset',
        duration: 30000,
        displayMode: 'verbose',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).toContain('[error]');
      expect(lastFrame()).toContain('30.0s');
      expect(lastFrame()).toContain('MCP connection timeout');
    });

    it('should handle all features in compact mode', () => {
      const circular: any = { ref: null };
      circular.ref = circular;

      const props: ToolCallProps = {
        ...defaultProps,
        input: { data: circular, extra: 'value' },
        status: 'error',
        output: 'Error occurred',
        duration: 1250,
        displayMode: 'compact',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('(error)');
      expect(lastFrame()).toContain('1.3s');
      expect(lastFrame()).toContain('2 params');
    });
  });

  describe('Edge Cases and Robustness', () => {
    it('should handle null/undefined values without crashing', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        input: null as any,
        output: undefined,
        duration: undefined,
        status: 'success',
      };

      expect(() => render(<ToolCall {...props} />)).not.toThrow();

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('TestTool');
      expect(lastFrame()).toContain('✓');
    });

    it('should handle malformed JSON in output', () => {
      const props: ToolCallProps = {
        ...defaultProps,
        status: 'error',
        output: '{"incomplete": json, missing closing brace',
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).toContain('incomplete');
    });

    it('should handle Unicode and emoji in all fields', () => {
      const props: ToolCallProps = {
        toolName: 'UnicodeTest',
        input: { message: 'Hello 世界 🌍', emoji: '🚀💻⭐' },
        output: 'Success! ✅ Operation completed with 中文 support',
        status: 'success',
        duration: 1337,
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('🌍');
      expect(lastFrame()).toContain('世界');
      expect(lastFrame()).toContain('✅');
      expect(lastFrame()).toContain('中文');
    });
  });
});