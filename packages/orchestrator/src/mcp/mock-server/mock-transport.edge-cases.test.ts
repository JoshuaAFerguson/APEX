/**
 * @fileoverview Edge case tests for MockTransport malformed bytes injection
 *
 * Tests boundary conditions, error scenarios, and edge cases for the malformed
 * response injection feature to ensure robust error handling.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MockTransport } from './mock-transport.js';
import { JSONRPCMessage, MCPTransportError } from '../types.js';

describe('MockTransport - Malformed Bytes Injection Edge Cases', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = new MockTransport();
  });

  describe('Boundary conditions', () => {
    beforeEach(async () => {
      await transport.connect();
    });

    it('handles zero-length truncation', () => {
      const rawDataEvents: (string | Buffer)[] = [];
      transport.on('rawData', (data) => rawDataEvents.push(data));

      transport.injectMalformedBytes({
        type: 'truncated_json',
        truncateAt: 0,
      });

      expect(rawDataEvents).toHaveLength(1);
      expect(rawDataEvents[0]).toBe('');
    });

    it('handles truncation beyond string length', () => {
      const rawDataEvents: (string | Buffer)[] = [];
      transport.on('rawData', (data) => rawDataEvents.push(data));

      transport.injectMalformedBytes({
        type: 'truncated_json',
        truncateAt: 99999, // Much larger than any response
      });

      expect(rawDataEvents).toHaveLength(1);
      const data = rawDataEvents[0] as string;

      // Should not truncate if position exceeds length
      expect(data.length).toBeGreaterThan(0);
      expect(() => JSON.parse(data)).not.toThrow(); // Should be valid JSON
    });

    it('handles 100% truncation', () => {
      const rawDataEvents: (string | Buffer)[] = [];
      const errorEvents: MCPTransportError[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));
      transport.on('error', (error) => errorEvents.push(error));

      transport.injectMalformedBytes({
        type: 'truncated_json',
        truncateAt: '100%',
      });

      expect(rawDataEvents).toHaveLength(1);

      const fullResponse = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { data: 'some response data that will be truncated' }
      });

      // 100% should keep the full response, which should be valid
      expect(rawDataEvents[0]).toBe(fullResponse);
      expect(errorEvents).toHaveLength(0); // No error for valid JSON
    });

    it('handles negative truncation position', () => {
      const rawDataEvents: (string | Buffer)[] = [];
      transport.on('rawData', (data) => rawDataEvents.push(data));

      transport.injectMalformedBytes({
        type: 'truncated_json',
        truncateAt: -10,
      });

      expect(rawDataEvents).toHaveLength(1);
      expect(rawDataEvents[0]).toBe(''); // Negative position should result in empty string
    });

    it('handles very small percentage truncation', () => {
      const rawDataEvents: (string | Buffer)[] = [];
      transport.on('rawData', (data) => rawDataEvents.push(data));

      transport.injectMalformedBytes({
        type: 'truncated_json',
        truncateAt: '0.1%',
      });

      expect(rawDataEvents).toHaveLength(1);
      const data = rawDataEvents[0] as string;
      expect(data.length).toBeGreaterThanOrEqual(0);
      expect(data.length).toBeLessThanOrEqual(2); // Very small percentage should yield tiny string
    });
  });

  describe('Invalid configuration handling', () => {
    beforeEach(async () => {
      await transport.connect();
    });

    it('handles invalid percentage format', () => {
      const rawDataEvents: (string | Buffer)[] = [];
      transport.on('rawData', (data) => rawDataEvents.push(data));

      transport.injectMalformedBytes({
        type: 'truncated_json',
        truncateAt: 'not-a-percentage', // Invalid format
      });

      expect(rawDataEvents).toHaveLength(1);
      // Should handle gracefully, likely treating as 0
      expect((rawDataEvents[0] as string).length).toBe(0);
    });

    it('handles undefined rawBytes for custom type', () => {
      const rawDataEvents: (string | Buffer)[] = [];
      transport.on('rawData', (data) => rawDataEvents.push(data));

      transport.injectMalformedBytes({
        type: 'custom',
        // rawBytes intentionally undefined
      });

      expect(rawDataEvents).toHaveLength(1);
      expect(rawDataEvents[0]).toBe(''); // Should default to empty string
    });

    it('handles undefined invalidContent for invalid_json type', () => {
      const rawDataEvents: (string | Buffer)[] = [];
      transport.on('rawData', (data) => rawDataEvents.push(data));

      transport.injectMalformedBytes({
        type: 'invalid_json',
        // invalidContent intentionally undefined
      });

      expect(rawDataEvents).toHaveLength(1);
      // Should use default invalid JSON
      expect(rawDataEvents[0]).toBe('{"result": undefined, broken json here}');
    });

    it('throws for completely unknown type', () => {
      expect(() => {
        transport.injectMalformedBytes({
          type: 'completely-unknown-type' as any,
        });
      }).toThrow(MCPTransportError);
    });
  });

  describe('Probability edge cases', () => {
    beforeEach(async () => {
      await transport.connect();

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));
    });

    it('handles probability exactly 0.0', async () => {
      const rawDataEvents: (string | Buffer)[] = [];
      const messageEvents: JSONRPCMessage[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));
      transport.on('message', (message) => messageEvents.push(message));

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 0.0, // Exactly zero
      });

      // Send many requests
      for (let i = 0; i < 100; i++) {
        await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'test',
          params: {},
        });
      }

      expect(rawDataEvents).toHaveLength(0);
      expect(messageEvents).toHaveLength(100);
    });

    it('handles probability exactly 1.0', async () => {
      const rawDataEvents: (string | Buffer)[] = [];
      const messageEvents: JSONRPCMessage[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));
      transport.on('message', (message) => messageEvents.push(message));

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 1.0, // Exactly one
      });

      // Send many requests
      for (let i = 0; i < 10; i++) {
        await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'test',
          params: {},
        });
      }

      expect(rawDataEvents).toHaveLength(10);
      expect(messageEvents).toHaveLength(0);
    });

    it('handles probability greater than 1.0', async () => {
      const rawDataEvents: (string | Buffer)[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 1.5, // Greater than 1.0
      });

      // Send requests
      for (let i = 0; i < 10; i++) {
        await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'test',
          params: {},
        });
      }

      // Should still inject (treat > 1.0 as always inject)
      expect(rawDataEvents).toHaveLength(10);
    });

    it('handles negative probability', async () => {
      const rawDataEvents: (string | Buffer)[] = [];
      const messageEvents: JSONRPCMessage[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));
      transport.on('message', (message) => messageEvents.push(message));

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: -0.5, // Negative probability
      });

      // Send requests
      for (let i = 0; i < 10; i++) {
        await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'test',
          params: {},
        });
      }

      // Should treat negative as 0 (never inject)
      expect(rawDataEvents).toHaveLength(0);
      expect(messageEvents).toHaveLength(10);
    });
  });

  describe('MaxInjections edge cases', () => {
    beforeEach(async () => {
      await transport.connect();

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));
    });

    it('handles maxInjections of 0 (unlimited)', async () => {
      const rawDataEvents: (string | Buffer)[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 1.0,
        maxInjections: 0, // Unlimited
      });

      // Send many requests
      for (let i = 0; i < 50; i++) {
        await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'test',
          params: {},
        });
      }

      expect(rawDataEvents).toHaveLength(50); // All should be injected
    });

    it('handles maxInjections of 1', async () => {
      const rawDataEvents: (string | Buffer)[] = [];
      const messageEvents: JSONRPCMessage[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));
      transport.on('message', (message) => messageEvents.push(message));

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 1.0,
        maxInjections: 1, // Only one injection allowed
      });

      // Send requests
      for (let i = 0; i < 10; i++) {
        await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'test',
          params: {},
        });
      }

      expect(rawDataEvents).toHaveLength(1); // Only first should be injected
      expect(messageEvents).toHaveLength(9); // Rest should be normal
    });

    it('handles negative maxInjections', async () => {
      const rawDataEvents: (string | Buffer)[] = [];
      const messageEvents: JSONRPCMessage[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));
      transport.on('message', (message) => messageEvents.push(message));

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 1.0,
        maxInjections: -5, // Negative value
      });

      // Send requests
      for (let i = 0; i < 10; i++) {
        await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'test',
          params: {},
        });
      }

      // Should treat negative as 0 (unlimited) or disabled
      // Implementation dependent - document the behavior
      expect(rawDataEvents.length + messageEvents.length).toBe(10);
    });
  });

  describe('Delay edge cases', () => {
    beforeEach(async () => {
      await transport.connect();
    });

    it('handles zero delay', async () => {
      const rawDataEvents: (string | Buffer)[] = [];
      const startTime = Date.now();

      transport.on('rawData', () => {
        rawDataEvents.push(Date.now() - startTime);
      });

      transport.injectMalformedBytes({
        type: 'empty_response',
        delayMs: 0,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(rawDataEvents).toHaveLength(1);
      expect(rawDataEvents[0]).toBeLessThan(10); // Should be immediate
    });

    it('handles negative delay', async () => {
      const rawDataEvents: (string | Buffer)[] = [];
      const startTime = Date.now();

      transport.on('rawData', () => {
        rawDataEvents.push(Date.now() - startTime);
      });

      transport.injectMalformedBytes({
        type: 'empty_response',
        delayMs: -100, // Negative delay
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(rawDataEvents).toHaveLength(1);
      expect(rawDataEvents[0]).toBeLessThan(10); // Should be treated as immediate
    });

    it('handles very large delay', async () => {
      const rawDataEvents: (string | Buffer)[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));

      transport.injectMalformedBytes({
        type: 'empty_response',
        delayMs: 5000, // 5 second delay
      });

      // Should not emit immediately
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(rawDataEvents).toHaveLength(0);

      // Note: We don't wait the full 5 seconds in the test
      // This is just to verify the delay mechanism works
    });
  });

  describe('Method targeting edge cases', () => {
    beforeEach(async () => {
      await transport.connect();

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { method: request.method },
      }));
    });

    it('handles empty targetMethods array', async () => {
      const rawDataEvents: (string | Buffer)[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));

      transport.setMalformedResponseInjection({
        targetMethods: [], // Empty array should match all methods
        injection: { type: 'invalid_json' },
        probability: 1.0,
      });

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'any-method',
        params: {},
      });

      expect(rawDataEvents).toHaveLength(1);
    });

    it('handles method names with special characters', async () => {
      const rawDataEvents: (string | Buffer)[] = [];
      const messageEvents: JSONRPCMessage[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));
      transport.on('message', (message) => messageEvents.push(message));

      transport.setMalformedResponseInjection({
        targetMethods: ['test/with-dashes', 'test.with.dots', 'test_with_underscores'],
        injection: { type: 'invalid_json' },
        probability: 1.0,
      });

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'test/with-dashes',
        params: {},
      });

      await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'test.with.dots',
        params: {},
      });

      await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'test_with_underscores',
        params: {},
      });

      await transport.send({
        jsonrpc: '2.0',
        id: 4,
        method: 'normal-method',
        params: {},
      });

      expect(rawDataEvents).toHaveLength(3); // Three special methods
      expect(messageEvents).toHaveLength(1); // One normal method
    });

    it('handles undefined method in request', async () => {
      const rawDataEvents: (string | Buffer)[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));

      transport.setMalformedResponseInjection({
        targetMethods: ['specific-method'],
        injection: { type: 'invalid_json' },
        probability: 1.0,
      });

      // Send request without method (notification-style)
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        // method intentionally missing
        params: {},
      } as any);

      // Should not match and not inject
      expect(rawDataEvents).toHaveLength(0);
    });
  });

  describe('Connection state edge cases', () => {
    it('handles malformed injection configuration when disconnected', () => {
      // Should not throw when setting injection config while disconnected
      expect(() => {
        transport.setMalformedResponseInjection({
          injection: { type: 'invalid_json' },
          probability: 1.0,
        });
      }).not.toThrow();
    });

    it('preserves injection configuration across connection cycles', async () => {
      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 1.0,
        maxInjections: 2,
      });

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));

      // Connect, use one injection, disconnect, reconnect
      await transport.connect();

      const rawDataEvents: (string | Buffer)[] = [];
      transport.on('rawData', (data) => rawDataEvents.push(data));

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      expect(rawDataEvents).toHaveLength(1);

      await transport.disconnect();
      await transport.connect();

      // Should still have one more injection available
      await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'test',
        params: {},
      });

      expect(rawDataEvents).toHaveLength(2);

      // Third request should be normal (max reached)
      const messageEvents: JSONRPCMessage[] = [];
      transport.on('message', (message) => messageEvents.push(message));

      await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'test',
        params: {},
      });

      expect(rawDataEvents).toHaveLength(2);
      expect(messageEvents).toHaveLength(1);
    });
  });

  describe('Binary data handling edge cases', () => {
    beforeEach(async () => {
      await transport.connect();
    });

    it('handles empty buffer injection', () => {
      const rawDataEvents: (string | Buffer)[] = [];
      transport.on('rawData', (data) => rawDataEvents.push(data));

      transport.injectMalformedBytes({
        type: 'custom',
        rawBytes: Buffer.alloc(0), // Empty buffer
      });

      expect(rawDataEvents).toHaveLength(1);
      expect(Buffer.isBuffer(rawDataEvents[0])).toBe(true);
      expect((rawDataEvents[0] as Buffer).length).toBe(0);
    });

    it('handles very large binary data', () => {
      const rawDataEvents: (string | Buffer)[] = [];
      transport.on('rawData', (data) => rawDataEvents.push(data));

      const largeBuffer = Buffer.alloc(10 * 1024 * 1024, 0xFF); // 10MB of 0xFF

      transport.injectMalformedBytes({
        type: 'custom',
        rawBytes: largeBuffer,
      });

      expect(rawDataEvents).toHaveLength(1);
      expect(Buffer.isBuffer(rawDataEvents[0])).toBe(true);
      expect((rawDataEvents[0] as Buffer).length).toBe(10 * 1024 * 1024);
    });

    it('handles buffer with null bytes', () => {
      const rawDataEvents: (string | Buffer)[] = [];
      transport.on('rawData', (data) => rawDataEvents.push(data));

      const bufferWithNulls = Buffer.from([0x00, 0x01, 0x00, 0x02, 0x00]);

      transport.injectMalformedBytes({
        type: 'custom',
        rawBytes: bufferWithNulls,
      });

      expect(rawDataEvents).toHaveLength(1);
      expect(Buffer.isBuffer(rawDataEvents[0])).toBe(true);
      expect((rawDataEvents[0] as Buffer)).toEqual(bufferWithNulls);
    });
  });

  describe('Multiple interceptor configurations', () => {
    beforeEach(async () => {
      await transport.connect();

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));
    });

    it('handles multiple interceptors for same method', async () => {
      const rawDataEvents: (string | Buffer)[] = [];
      transport.on('rawData', (data) => rawDataEvents.push(data));

      // Add multiple interceptors for the same method
      transport.setMalformedResponseInjection({
        targetMethods: ['test'],
        injection: { type: 'invalid_json' },
        probability: 1.0,
        maxInjections: 1,
      });

      transport.setMalformedResponseInjection({
        targetMethods: ['test'],
        injection: { type: 'empty_response' },
        probability: 1.0,
        maxInjections: 1,
      });

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      // Should trigger one of the interceptors (first match wins)
      expect(rawDataEvents).toHaveLength(1);
    });

    it('handles interceptor order correctly', async () => {
      const rawDataEvents: (string | Buffer)[] = [];
      transport.on('rawData', (data) => rawDataEvents.push(data));

      // First interceptor with limited injections
      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 1.0,
        maxInjections: 1,
      });

      // Second interceptor with unlimited injections
      transport.setMalformedResponseInjection({
        injection: { type: 'empty_response' },
        probability: 1.0,
      });

      // First request should use first interceptor
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      // Second request should use second interceptor (first is exhausted)
      await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'test',
        params: {},
      });

      expect(rawDataEvents).toHaveLength(2);
    });
  });
});