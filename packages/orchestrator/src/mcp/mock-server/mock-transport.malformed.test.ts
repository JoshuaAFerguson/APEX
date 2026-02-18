/**
 * @fileoverview Unit tests for MockTransport malformed bytes injection (ADR-073)
 *
 * Tests the transport-layer malformed data injection capabilities that simulate
 * real-world transport corruption scenarios.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MockTransport } from './mock-transport.js';
import { JSONRPCMessage, MCPTransportError } from '../types.js';
import type { MalformedBytesInjectionConfig } from './types.js';

describe('MockTransport - Malformed Bytes Injection (ADR-073)', () => {
  let transport: MockTransport;
  const mockHandler = jest.fn();

  beforeEach(() => {
    transport = new MockTransport();
    mockHandler.mockClear();
  });

  describe('injectMalformedBytes()', () => {
    beforeEach(async () => {
      await transport.connect();
    });

    it('throws when not connected', () => {
      const disconnectedTransport = new MockTransport();

      expect(() => {
        disconnectedTransport.injectMalformedBytes({
          type: 'invalid_json',
        });
      }).toThrow(MCPTransportError);
    });

    it('emits rawData event for invalid JSON', () => {
      const rawDataEvents: (string | Buffer)[] = [];
      const errorEvents: MCPTransportError[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));
      transport.on('error', (error) => errorEvents.push(error));

      transport.injectMalformedBytes({
        type: 'invalid_json',
        invalidContent: '{"result": undefined}',
      });

      expect(rawDataEvents).toHaveLength(1);
      expect(rawDataEvents[0]).toBe('{"result": undefined}');
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].code).toBe('PARSE_ERROR');
    });

    it('emits rawData event for truncated JSON', () => {
      const rawDataEvents: (string | Buffer)[] = [];
      const errorEvents: MCPTransportError[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));
      transport.on('error', (error) => errorEvents.push(error));

      transport.injectMalformedBytes({
        type: 'truncated_json',
        truncateAt: '50%',
      });

      expect(rawDataEvents).toHaveLength(1);
      const truncatedData = rawDataEvents[0] as string;
      expect(truncatedData.length).toBeGreaterThan(0);
      expect(() => JSON.parse(truncatedData)).toThrow();
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].code).toBe('PARSE_ERROR');
    });

    it('emits rawData event for empty response', () => {
      const rawDataEvents: (string | Buffer)[] = [];
      const errorEvents: MCPTransportError[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));
      transport.on('error', (error) => errorEvents.push(error));

      transport.injectMalformedBytes({
        type: 'empty_response',
      });

      expect(rawDataEvents).toHaveLength(1);
      expect(rawDataEvents[0]).toBe('');
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].code).toBe('PARSE_ERROR');
    });

    it('emits rawData event for binary data', () => {
      const rawDataEvents: (string | Buffer)[] = [];
      const errorEvents: MCPTransportError[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));
      transport.on('error', (error) => errorEvents.push(error));

      transport.injectMalformedBytes({
        type: 'binary_data',
      });

      expect(rawDataEvents).toHaveLength(1);
      expect(Buffer.isBuffer(rawDataEvents[0])).toBe(true);
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].code).toBe('PARSE_ERROR');
    });

    it('emits rawData event for custom data', () => {
      const rawDataEvents: (string | Buffer)[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));

      const customData = 'custom malformed data';
      transport.injectMalformedBytes({
        type: 'custom',
        rawBytes: customData,
      });

      expect(rawDataEvents).toHaveLength(1);
      expect(rawDataEvents[0]).toBe(customData);
    });

    it('applies delay before injection', async () => {
      const rawDataEvents: (string | Buffer)[] = [];
      const startTime = Date.now();

      transport.on('rawData', () => {
        rawDataEvents.push('received');
      });

      transport.injectMalformedBytes({
        type: 'empty_response',
        delayMs: 50,
      });

      // Should not emit immediately
      expect(rawDataEvents).toHaveLength(0);

      // Wait for delay + buffer
      await new Promise(resolve => setTimeout(resolve, 80));

      expect(rawDataEvents).toHaveLength(1);
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some variance
    });

    it('handles percentage-based truncation', () => {
      const rawDataEvents: (string | Buffer)[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));

      transport.injectMalformedBytes({
        type: 'truncated_json',
        truncateAt: '25%',
      });

      const fullResponse = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { data: 'some response data that will be truncated' }
      });

      const expected = Math.floor(fullResponse.length * 0.25);
      const actual = (rawDataEvents[0] as string).length;

      expect(actual).toBe(expected);
    });

    it('handles absolute position truncation', () => {
      const rawDataEvents: (string | Buffer)[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));

      transport.injectMalformedBytes({
        type: 'truncated_json',
        truncateAt: 10,
      });

      expect((rawDataEvents[0] as string).length).toBe(10);
    });

    it('throws for unknown malformed type', () => {
      expect(() => {
        transport.injectMalformedBytes({
          type: 'unknown_type' as any,
        });
      }).toThrow(MCPTransportError);
    });
  });

  describe('setMalformedResponseInjection()', () => {
    beforeEach(async () => {
      await transport.connect();
    });

    it('intercepts responses for all methods when targetMethods is empty', async () => {
      const rawDataEvents: (string | Buffer)[] = [];
      transport.on('rawData', (data) => rawDataEvents.push(data));

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 1.0,
      });

      const request: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      };

      await transport.send(request);

      expect(rawDataEvents.length).toBeGreaterThan(0);
    });

    it('intercepts responses for specific target methods', async () => {
      const rawDataEvents: (string | Buffer)[] = [];
      const messageEvents: JSONRPCMessage[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));
      transport.on('message', (message) => messageEvents.push(message));

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));

      transport.setMalformedResponseInjection({
        targetMethods: ['tools/call'],
        injection: { type: 'invalid_json' },
        probability: 1.0,
      });

      // This should be intercepted (malformed)
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'test' },
      });

      // This should NOT be intercepted (normal)
      await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      });

      expect(rawDataEvents).toHaveLength(1);
      expect(messageEvents).toHaveLength(1); // Only the non-intercepted one
    });

    it('respects probability setting', async () => {
      const rawDataEvents: (string | Buffer)[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));

      // Set to 0% probability - should never inject
      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 0.0,
      });

      // Send multiple requests
      for (let i = 0; i < 10; i++) {
        await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'test',
          params: {},
        });
      }

      expect(rawDataEvents).toHaveLength(0);
    });

    it('respects maxInjections limit', async () => {
      const rawDataEvents: (string | Buffer)[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 1.0,
        maxInjections: 2, // Limit to 2 injections
      });

      // Send 5 requests - only first 2 should be malformed
      for (let i = 0; i < 5; i++) {
        await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'test',
          params: {},
        });
      }

      expect(rawDataEvents).toHaveLength(2);
    });

    it('handles truncated responses with original response data', async () => {
      const rawDataEvents: (string | Buffer)[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));

      const originalResult = {
        data: 'this is the original response that should be truncated'
      };

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: originalResult,
      }));

      transport.setMalformedResponseInjection({
        injection: { type: 'truncated_json', truncateAt: '50%' },
        probability: 1.0,
      });

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      expect(rawDataEvents).toHaveLength(1);
      const truncatedData = rawDataEvents[0] as string;

      // Should contain part of the original response data
      expect(truncatedData).toContain('"data":"this is the original');
    });

    it('applies injection delay', async () => {
      const rawDataEvents: (string | Buffer)[] = [];
      const startTime = Date.now();

      transport.on('rawData', () => {
        rawDataEvents.push('received');
      });

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json', delayMs: 50 },
        probability: 1.0,
      });

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      // Wait for delay + buffer
      await new Promise(resolve => setTimeout(resolve, 80));

      expect(rawDataEvents).toHaveLength(1);
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some variance
    });
  });

  describe('clearMalformedResponseInjection()', () => {
    beforeEach(async () => {
      await transport.connect();
    });

    it('clears all injection configurations', async () => {
      const rawDataEvents: (string | Buffer)[] = [];
      const messageEvents: JSONRPCMessage[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));
      transport.on('message', (message) => messageEvents.push(message));

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 1.0,
      });

      // Clear injections
      transport.clearMalformedResponseInjection();

      // This should NOT be intercepted after clearing
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      expect(rawDataEvents).toHaveLength(0);
      expect(messageEvents).toHaveLength(1); // Normal response
    });
  });

  describe('reset()', () => {
    it('clears malformed interceptors', async () => {
      await transport.connect();

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 1.0,
      });

      transport.reset();

      // After reset, interceptors should be cleared
      const rawDataEvents: (string | Buffer)[] = [];
      const messageEvents: JSONRPCMessage[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));
      transport.on('message', (message) => messageEvents.push(message));

      await transport.connect();

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      expect(rawDataEvents).toHaveLength(0);
      expect(messageEvents).toHaveLength(1); // Normal response
    });
  });

  describe('integration with existing functionality', () => {
    it('works alongside normal request handling', async () => {
      await transport.connect();

      let handlerCallCount = 0;

      transport.setRequestHandler(async (request) => {
        handlerCallCount++;
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: { callCount: handlerCallCount },
        };
      });

      const messageEvents: JSONRPCMessage[] = [];
      transport.on('message', (message) => messageEvents.push(message));

      // Send a normal request (no malformed injection)
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      expect(handlerCallCount).toBe(1);
      expect(messageEvents).toHaveLength(1);
      expect((messageEvents[0] as any).result.callCount).toBe(1);
    });

    it('maintains sent message history during malformed injection', async () => {
      await transport.connect();

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 1.0,
      });

      const request: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: { data: 'test' },
      };

      await transport.send(request);

      const sentMessages = transport.getSentMessages();
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toEqual(request);
    });
  });
});