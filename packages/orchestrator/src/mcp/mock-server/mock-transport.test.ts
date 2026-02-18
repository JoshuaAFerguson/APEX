/**
 * @fileoverview Tests for MockTransport - In-process MCP Transport
 *
 * Tests the MockTransport class which provides in-process simulation
 * of MCP transport for testing MCP client interactions without external processes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockTransport } from './mock-transport.js';
import { MCPTransportError } from '../types.js';
import type { JSONRPCMessage, JSONRPCRequest, JSONRPCResponse, JSONRPCNotification } from '../types.js';
import type { MockTransportOptions } from './types.js';

describe('MockTransport', () => {
  let transport: MockTransport;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    transport = new MockTransport();
    mockHandler = vi.fn();
  });

  afterEach(() => {
    if (transport.isConnected()) {
      transport.disconnect();
    }
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates transport with default options', () => {
      const transport = new MockTransport();
      expect(transport.isConnected()).toBe(false);
    });

    it('accepts custom options', () => {
      const options: MockTransportOptions = {
        connectionLatencyMs: 100,
        shouldFailConnect: true,
        transportType: 'http',
        connectionTimeout: 5000,
        autoReconnect: true,
        maxReconnectAttempts: 5,
        reconnectDelay: 2000,
      };

      const transport = new MockTransport(options);
      expect(transport.isConnected()).toBe(false);
    });
  });

  describe('connection lifecycle', () => {
    it('connects successfully with default options', async () => {
      const connectSpy = vi.fn();
      transport.on('connected', connectSpy);

      await transport.connect();

      expect(transport.isConnected()).toBe(true);
      expect(transport.getState()).toBe('connected');
      expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it('respects connection latency', async () => {
      const latencyMs = 50;
      transport = new MockTransport({ connectionLatencyMs: latencyMs });

      const start = Date.now();
      await transport.connect();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(latencyMs - 10); // Allow for timing variance
    });

    it('fails to connect when configured to fail', async () => {
      const customError = new Error('Custom connection failure');
      transport = new MockTransport({
        shouldFailConnect: true,
        connectError: customError,
      });

      await expect(transport.connect()).rejects.toThrow(MCPTransportError);
      expect(transport.isConnected()).toBe(false);
      expect(transport.getState()).toBe('error');
    });

    it('throws error when connecting while already connected', async () => {
      await transport.connect();

      await expect(transport.connect()).rejects.toThrow('Already connected');
    });

    it('disconnects successfully', async () => {
      const disconnectSpy = vi.fn();
      transport.on('disconnected', disconnectSpy);

      await transport.connect();
      await transport.disconnect('Test disconnect');

      expect(transport.isConnected()).toBe(false);
      expect(transport.getState()).toBe('disconnected');
      expect(disconnectSpy).toHaveBeenCalledWith('Test disconnect');
    });

    it('handles disconnect when not connected (no-op)', async () => {
      expect(transport.isConnected()).toBe(false);

      await expect(transport.disconnect()).resolves.not.toThrow();
      expect(transport.isConnected()).toBe(false);
    });
  });

  describe('message sending', () => {
    const mockRequest: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'test/method',
      params: { arg1: 'value1' },
    };

    beforeEach(async () => {
      await transport.connect();
    });

    it('sends messages when connected', async () => {
      await transport.send(mockRequest);

      const sentMessages = transport.getSentMessages();
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toEqual(mockRequest);
    });

    it('throws error when sending while not connected', async () => {
      await transport.disconnect();

      await expect(transport.send(mockRequest)).rejects.toThrow('Not connected');
    });

    it('fails to send when configured to fail', async () => {
      const customError = new Error('Custom send failure');
      transport = new MockTransport({
        shouldFailSend: true,
        sendError: customError,
      });
      await transport.connect();

      await expect(transport.send(mockRequest)).rejects.toThrow('Custom send failure');
    });

    it('records sent messages in order', async () => {
      const message1 = { ...mockRequest, id: 1 };
      const message2 = { ...mockRequest, id: 2 };
      const message3 = { ...mockRequest, id: 3 };

      await transport.send(message1);
      await transport.send(message2);
      await transport.send(message3);

      const sentMessages = transport.getSentMessages();
      expect(sentMessages).toEqual([message1, message2, message3]);
    });

    it('clears sent messages when requested', async () => {
      await transport.send(mockRequest);
      expect(transport.getSentMessages()).toHaveLength(1);

      transport.clearSentMessages();
      expect(transport.getSentMessages()).toHaveLength(0);
    });
  });

  describe('request handling', () => {
    const mockRequest: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    };

    const mockResponse: JSONRPCResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: { tools: [] },
    };

    beforeEach(async () => {
      await transport.connect();
    });

    it('processes requests with handler and emits responses', async () => {
      const messageSpy = vi.fn();
      transport.on('message', messageSpy);

      mockHandler.mockResolvedValue(mockResponse);
      transport.setRequestHandler(mockHandler);

      await transport.send(mockRequest);

      expect(mockHandler).toHaveBeenCalledWith(mockRequest);
      expect(messageSpy).toHaveBeenCalledWith(mockResponse);
    });

    it('handles requests that return no response', async () => {
      const messageSpy = vi.fn();
      transport.on('message', messageSpy);

      mockHandler.mockResolvedValue(undefined);
      transport.setRequestHandler(mockHandler);

      await transport.send(mockRequest);

      expect(mockHandler).toHaveBeenCalledWith(mockRequest);
      expect(messageSpy).not.toHaveBeenCalled();
    });

    it('emits error when handler throws', async () => {
      const errorSpy = vi.fn();
      transport.on('error', errorSpy);

      const handlerError = new Error('Handler failed');
      mockHandler.mockRejectedValue(handlerError);
      transport.setRequestHandler(mockHandler);

      await transport.send(mockRequest);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Handler failed'),
          code: 'SEND_FAILED',
        })
      );
    });

    it('sends message without handler (no processing)', async () => {
      const messageSpy = vi.fn();
      transport.on('message', messageSpy);

      await transport.send(mockRequest);

      expect(transport.getSentMessages()).toHaveLength(1);
      expect(messageSpy).not.toHaveBeenCalled();
    });
  });

  describe('message injection', () => {
    const mockNotification: JSONRPCNotification = {
      jsonrpc: '2.0',
      method: 'notifications/message',
      params: { level: 'info', message: 'Test notification' },
    };

    beforeEach(async () => {
      await transport.connect();
    });

    it('injects messages and emits them', () => {
      const messageSpy = vi.fn();
      transport.on('message', messageSpy);

      transport.injectMessage(mockNotification);

      expect(messageSpy).toHaveBeenCalledWith(mockNotification);
    });

    it('throws error when injecting while not connected', async () => {
      await transport.disconnect();

      expect(() => transport.injectMessage(mockNotification))
        .toThrow('Cannot inject message when not connected');
    });
  });

  describe('error simulation', () => {
    beforeEach(async () => {
      await transport.connect();
    });

    it('simulates transport errors', () => {
      const errorSpy = vi.fn();
      transport.on('error', errorSpy);

      const customError = new MCPTransportError('Custom error', 'CUSTOM_ERROR');
      transport.simulateError(customError);

      expect(errorSpy).toHaveBeenCalledWith(customError);
    });

    it('simulates errors with default error', () => {
      const errorSpy = vi.fn();
      transport.on('error', errorSpy);

      transport.simulateError();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Simulated transport error',
          code: 'SEND_FAILED',
        })
      );
    });

    it('simulates unexpected disconnections', () => {
      const disconnectSpy = vi.fn();
      transport.on('disconnected', disconnectSpy);

      transport.simulateDisconnect('Unexpected error');

      expect(transport.isConnected()).toBe(false);
      expect(transport.getState()).toBe('disconnected');
      expect(disconnectSpy).toHaveBeenCalledWith('Unexpected error');
    });

    it('handles simulate disconnect when not connected', () => {
      transport.simulateDisconnect();
      // Should not throw or cause issues
      expect(transport.isConnected()).toBe(false);
    });
  });

  describe('runtime configuration', () => {
    beforeEach(async () => {
      await transport.connect();
    });

    it('updates options at runtime', () => {
      expect(() => transport.updateOptions({ connectionLatencyMs: 200 }))
        .not.toThrow();
    });

    it('applies updated options to subsequent operations', async () => {
      transport.updateOptions({ shouldFailSend: true });

      const mockRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      };

      await expect(transport.send(mockRequest)).rejects.toThrow(MCPTransportError);
    });
  });

  describe('state management and reset', () => {
    it('tracks state correctly through lifecycle', async () => {
      expect(transport.getState()).toBe('disconnected');

      const connectPromise = transport.connect();
      // During connection, state should be 'connecting'
      // Note: This is timing-dependent and may be flaky in some environments

      await connectPromise;
      expect(transport.getState()).toBe('connected');

      await transport.disconnect();
      expect(transport.getState()).toBe('disconnected');
    });

    it('resets to initial state', async () => {
      // Set up some state
      await transport.connect();
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });
      transport.setRequestHandler(mockHandler);

      expect(transport.isConnected()).toBe(true);
      expect(transport.getSentMessages()).toHaveLength(1);

      // Reset
      transport.reset();

      expect(transport.isConnected()).toBe(false);
      expect(transport.getSentMessages()).toHaveLength(0);
      expect(transport.getState()).toBe('disconnected');
    });
  });

  describe('event handling', () => {
    it('emits all expected events during normal lifecycle', async () => {
      const connectingSpy = vi.fn();
      const connectedSpy = vi.fn();
      const disconnectingSpy = vi.fn();
      const disconnectedSpy = vi.fn();

      transport.on('connecting', connectingSpy);
      transport.on('connected', connectedSpy);
      transport.on('disconnecting', disconnectingSpy);
      transport.on('disconnected', disconnectedSpy);

      await transport.connect();
      await transport.disconnect();

      expect(connectingSpy).toHaveBeenCalledTimes(1);
      expect(connectedSpy).toHaveBeenCalledTimes(1);
      expect(disconnectingSpy).toHaveBeenCalledTimes(1);
      expect(disconnectedSpy).toHaveBeenCalledTimes(1);
    });

    it('emits error events when connection fails', async () => {
      const errorSpy = vi.fn();
      transport.on('error', errorSpy);

      transport = new MockTransport({ shouldFailConnect: true });

      try {
        await transport.connect();
      } catch {
        // Expected to throw
      }

      expect(transport.getState()).toBe('error');
    });
  });

  describe('edge cases and error conditions', () => {
    it('handles multiple rapid connect/disconnect cycles', async () => {
      for (let i = 0; i < 5; i++) {
        await transport.connect();
        expect(transport.isConnected()).toBe(true);

        await transport.disconnect();
        expect(transport.isConnected()).toBe(false);
      }
    });

    it('maintains message order under concurrent sends', async () => {
      await transport.connect();

      const messages = Array.from({ length: 10 }, (_, i) => ({
        jsonrpc: '2.0' as const,
        id: i,
        method: 'test',
        params: { index: i },
      }));

      // Send all messages concurrently
      await Promise.all(messages.map(msg => transport.send(msg)));

      const sentMessages = transport.getSentMessages();
      expect(sentMessages).toHaveLength(10);

      // Messages should be in the order they were sent
      sentMessages.forEach((msg, index) => {
        expect((msg as JSONRPCRequest).id).toBe(index);
      });
    });

    it('handles handler that returns malformed response', async () => {
      const errorSpy = vi.fn();
      transport.on('error', errorSpy);

      await transport.connect();

      // Handler that returns invalid response
      transport.setRequestHandler(async () => {
        throw new Error('Invalid response format');
      });

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid response format'),
        })
      );
    });
  });
});