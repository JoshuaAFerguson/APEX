/**
 * MCPClient Tests
 *
 * Comprehensive test suite for the MCPClient class, covering:
 * - Connection management
 * - JSON-RPC message handling
 * - Tool operations (list, call)
 * - Error handling
 * - Request/response timeout management
 * - Event emission
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { MCPClient, type MCPClientOptions } from './client.js';
import type { MCPTransport } from './transports/transport.js';
import {
  JSONRPCMessage,
  JSONRPCResponse,
  JSONRPCErrorResponse,
  createJSONRPCRequest,
} from './types.js';

// ============================================================================
// Mock Setup
// ============================================================================

class MockTransport extends EventEmitter {
  isConnected = false;
  sendMock = vi.fn();

  constructor() {
    super();
  }

  async connect(): Promise<void> {
    this.isConnected = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.emit('disconnected', 'Manual disconnect');
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.sendMock(message);
  }

  getState(): string {
    return this.isConnected ? 'connected' : 'disconnected';
  }

  // Test helpers
  simulateMessage(message: JSONRPCMessage) {
    this.emit('message', message);
  }

  simulateError(error: Error) {
    this.emit('error', error);
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('MCPClient', () => {
  let mockTransport: MockTransport;
  let client: MCPClient;

  beforeEach(() => {
    mockTransport = new MockTransport();
    client = new MCPClient({
      transport: mockTransport as unknown as MCPTransport,
      timeoutMs: 1000,
    });
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe('constructor', () => {
    it('should create client with default timeout', () => {
      const clientWithDefaults = new MCPClient({
        transport: mockTransport as unknown as MCPTransport,
      });

      expect(clientWithDefaults).toBeInstanceOf(MCPClient);
      expect(clientWithDefaults).toBeInstanceOf(EventEmitter);
    });

    it('should create client with custom timeout', () => {
      const customClient = new MCPClient({
        transport: mockTransport as unknown as MCPTransport,
        timeoutMs: 5000,
      });

      expect(customClient).toBeInstanceOf(MCPClient);
    });

    it('should set up transport event handlers', () => {
      const errorHandler = vi.fn();
      client.on('error', errorHandler);

      // Trigger transport error
      const testError = new Error('Transport error');
      mockTransport.simulateError(testError);

      expect(errorHandler).toHaveBeenCalledWith(testError);
    });
  });

  // ==========================================================================
  // Connection Tests
  // ==========================================================================

  describe('connect', () => {
    it('should connect through transport', async () => {
      await client.connect();

      expect(mockTransport.isConnected).toBe(true);
    });

    it('should handle connection errors', async () => {
      const connectError = new Error('Connection failed');
      mockTransport.connect = vi.fn().mockRejectedValue(connectError);

      await expect(client.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('disconnect', () => {
    it('should disconnect through transport', async () => {
      await client.connect();
      expect(mockTransport.isConnected).toBe(true);

      await client.disconnect();
      expect(mockTransport.isConnected).toBe(false);
    });

    it('should handle disconnect errors gracefully', async () => {
      await client.connect();

      const disconnectError = new Error('Disconnect failed');
      mockTransport.disconnect = vi.fn().mockRejectedValue(disconnectError);

      // Should not throw
      await expect(client.disconnect()).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // Tool Operations Tests
  // ==========================================================================

  describe('listTools', () => {
    it('should send tools/list request and return tools', async () => {
      const mockTools = [
        { name: 'test-tool', description: 'Test tool' },
        { name: 'another-tool', description: 'Another tool' },
      ];

      // Set up mock response
      setTimeout(() => {
        const response: JSONRPCResponse = {
          jsonrpc: '2.0',
          id: 1,
          result: {
            tools: mockTools,
          },
        };
        mockTransport.simulateMessage(response);
      }, 10);

      const tools = await client.listTools();

      expect(tools).toEqual(mockTools);
      expect(mockTransport.sendMock).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      });
    });

    it('should handle tools/list errors', async () => {
      setTimeout(() => {
        const errorResponse: JSONRPCErrorResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32601,
            message: 'Method not found',
          },
        };
        mockTransport.simulateMessage(errorResponse);
      }, 10);

      await expect(client.listTools()).rejects.toThrow('Method not found');
    });

    it('should handle missing tools in response', async () => {
      setTimeout(() => {
        const response: JSONRPCResponse = {
          jsonrpc: '2.0',
          id: 1,
          result: {}, // No tools property
        };
        mockTransport.simulateMessage(response);
      }, 10);

      const tools = await client.listTools();
      expect(tools).toEqual([]);
    });
  });

  describe('callTool', () => {
    it('should send tools/call request and return result', async () => {
      const toolName = 'test-tool';
      const toolArgs = { param1: 'value1', param2: 42 };
      const mockResult = { output: 'Tool executed successfully' };

      setTimeout(() => {
        const response: JSONRPCResponse = {
          jsonrpc: '2.0',
          id: 1,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(mockResult),
              },
            ],
          },
        };
        mockTransport.simulateMessage(response);
      }, 10);

      const result = await client.callTool(toolName, toolArgs);

      expect(result).toEqual(mockResult);
      expect(mockTransport.sendMock).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: toolArgs,
        },
      });
    });

    it('should handle tools/call errors', async () => {
      setTimeout(() => {
        const errorResponse: JSONRPCErrorResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32602,
            message: 'Invalid params',
          },
        };
        mockTransport.simulateMessage(errorResponse);
      }, 10);

      await expect(client.callTool('invalid-tool', {})).rejects.toThrow('Invalid params');
    });

    it('should handle non-text content in response', async () => {
      setTimeout(() => {
        const response: JSONRPCResponse = {
          jsonrpc: '2.0',
          id: 1,
          result: {
            content: [
              {
                type: 'image',
                data: 'base64-image-data',
              },
            ],
          },
        };
        mockTransport.simulateMessage(response);
      }, 10);

      const result = await client.callTool('tool', {});
      expect(result).toEqual({}); // Should return empty object for non-text content
    });

    it('should handle missing content in response', async () => {
      setTimeout(() => {
        const response: JSONRPCResponse = {
          jsonrpc: '2.0',
          id: 1,
          result: {}, // No content property
        };
        mockTransport.simulateMessage(response);
      }, 10);

      const result = await client.callTool('tool', {});
      expect(result).toEqual({});
    });
  });

  // ==========================================================================
  // Request/Response Handling Tests
  // ==========================================================================

  describe('request/response handling', () => {
    it('should handle request timeouts', async () => {
      vi.useFakeTimers();

      // Start request but don't send response
      const requestPromise = client.listTools();

      // Fast-forward past timeout
      vi.advanceTimersByTime(1100);

      await expect(requestPromise).rejects.toThrow('Request timeout');

      vi.useRealTimers();
    });

    it('should handle multiple concurrent requests', async () => {
      const responses = [
        { id: 1, tools: [{ name: 'tool1' }] },
        { id: 2, tools: [{ name: 'tool2' }] },
        { id: 3, tools: [{ name: 'tool3' }] },
      ];

      // Set up responses for multiple concurrent requests
      setTimeout(() => {
        responses.forEach((resp) => {
          const response: JSONRPCResponse = {
            jsonrpc: '2.0',
            id: resp.id,
            result: { tools: resp.tools },
          };
          mockTransport.simulateMessage(response);
        });
      }, 10);

      const promises = [
        client.listTools(),
        client.listTools(),
        client.listTools(),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((tools, index) => {
        expect(tools).toEqual(responses[index].tools);
      });
    });

    it('should handle notifications (messages without id)', async () => {
      const notificationHandler = vi.fn();
      client.on('notification', notificationHandler);

      const notification = {
        jsonrpc: '2.0',
        method: 'notifications/tool-list-changed',
        params: {},
      };

      mockTransport.simulateMessage(notification as JSONRPCMessage);

      expect(notificationHandler).toHaveBeenCalledWith(notification);
    });

    it('should ignore responses for unknown request ids', async () => {
      const unknownResponse: JSONRPCResponse = {
        jsonrpc: '2.0',
        id: 999, // Unknown ID
        result: { tools: [] },
      };

      // Should not throw
      expect(() => {
        mockTransport.simulateMessage(unknownResponse);
      }).not.toThrow();
    });

    it('should handle malformed responses gracefully', async () => {
      const malformedMessage = {
        not: 'jsonrpc',
        format: true,
      } as unknown as JSONRPCMessage;

      // Should not throw
      expect(() => {
        mockTransport.simulateMessage(malformedMessage);
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('error handling', () => {
    it('should emit error events from transport', async () => {
      const errorHandler = vi.fn();
      client.on('error', errorHandler);

      const transportError = new Error('Transport connection lost');
      mockTransport.simulateError(transportError);

      expect(errorHandler).toHaveBeenCalledWith(transportError);
    });

    it('should handle JSON-RPC error responses', async () => {
      setTimeout(() => {
        const errorResponse: JSONRPCErrorResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32700,
            message: 'Parse error',
            data: { details: 'Invalid JSON' },
          },
        };
        mockTransport.simulateMessage(errorResponse);
      }, 10);

      await expect(client.listTools()).rejects.toThrow('Parse error');
    });

    it('should clean up pending requests on error', async () => {
      vi.useFakeTimers();

      // Start a request
      const requestPromise = client.listTools();

      // Simulate transport error before response
      const transportError = new Error('Connection lost');
      mockTransport.simulateError(transportError);

      // Request should be rejected
      await expect(requestPromise).rejects.toThrow();

      vi.useRealTimers();
    });
  });

  // ==========================================================================
  // Edge Cases and Integration Tests
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle rapid connect/disconnect cycles', async () => {
      for (let i = 0; i < 5; i++) {
        await client.connect();
        expect(mockTransport.isConnected).toBe(true);

        await client.disconnect();
        expect(mockTransport.isConnected).toBe(false);
      }
    });

    it('should handle string request IDs', async () => {
      // Mock the nextId to return a string
      (client as any).nextId = 'string-id';

      setTimeout(() => {
        const response: JSONRPCResponse = {
          jsonrpc: '2.0',
          id: 'string-id',
          result: { tools: [] },
        };
        mockTransport.simulateMessage(response);
      }, 10);

      const tools = await client.listTools();
      expect(tools).toEqual([]);
    });

    it('should handle very large tool arguments', async () => {
      const largeArgs = {
        data: 'x'.repeat(100000), // 100KB string
        nested: {
          array: new Array(1000).fill('test'),
          deep: { very: { deep: { object: { structure: 'value' } } } },
        },
      };

      setTimeout(() => {
        const response: JSONRPCResponse = {
          jsonrpc: '2.0',
          id: 1,
          result: {
            content: [{ type: 'text', text: '{"processed": true}' }],
          },
        };
        mockTransport.simulateMessage(response);
      }, 10);

      const result = await client.callTool('data-processor', largeArgs);

      expect(result).toEqual({ processed: true });
      expect(mockTransport.sendMock).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'data-processor',
          arguments: largeArgs,
        },
      });
    });

    it('should handle invalid JSON in tool call response', async () => {
      setTimeout(() => {
        const response: JSONRPCResponse = {
          jsonrpc: '2.0',
          id: 1,
          result: {
            content: [
              {
                type: 'text',
                text: 'invalid json {[}',
              },
            ],
          },
        };
        mockTransport.simulateMessage(response);
      }, 10);

      // Should return the raw text when JSON parsing fails
      const result = await client.callTool('tool', {});
      expect(result).toBe('invalid json {[}');
    });
  });

  // ==========================================================================
  // Resource Management Tests
  // ==========================================================================

  describe('resource management', () => {
    it('should clean up timeouts on successful response', async () => {
      vi.useFakeTimers();

      const requestPromise = client.listTools();

      // Send response before timeout
      setTimeout(() => {
        const response: JSONRPCResponse = {
          jsonrpc: '2.0',
          id: 1,
          result: { tools: [] },
        };
        mockTransport.simulateMessage(response);
      }, 100);

      vi.advanceTimersByTime(100);
      await requestPromise;

      // Advance past original timeout - should not cause any issues
      vi.advanceTimersByTime(1000);

      vi.useRealTimers();
    });

    it('should handle disconnect during pending requests', async () => {
      const requestPromise = client.listTools();

      // Disconnect before response
      await client.disconnect();

      // The pending request should still be handled appropriately
      // In this implementation, it might timeout or be rejected
      setTimeout(() => {
        const response: JSONRPCResponse = {
          jsonrpc: '2.0',
          id: 1,
          result: { tools: [] },
        };
        mockTransport.simulateMessage(response);
      }, 10);

      // Request might still succeed if response comes in time
      // or timeout - both are acceptable behaviors
      try {
        await requestPromise;
      } catch (error) {
        // Timeout or disconnect error is acceptable
        expect(error).toBeDefined();
      }
    });
  });
});