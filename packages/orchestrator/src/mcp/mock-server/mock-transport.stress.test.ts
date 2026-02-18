/**
 * @fileoverview Stress tests for MockTransport malformed bytes injection
 *
 * Tests high-volume scenarios, concurrent injections, and performance characteristics
 * of the malformed response injection feature.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MockTransport } from './mock-transport.js';
import { JSONRPCMessage, MCPTransportError } from '../types.js';

describe('MockTransport - Malformed Bytes Injection Stress Tests', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = new MockTransport();
  });

  describe('High-volume malformed injection', () => {
    beforeEach(async () => {
      await transport.connect();
    });

    it('handles many concurrent malformed injections', async () => {
      const rawDataEvents: (string | Buffer)[] = [];
      const errorEvents: MCPTransportError[] = [];

      transport.on('rawData', (data) => rawDataEvents.push(data));
      transport.on('error', (error) => errorEvents.push(error));

      // Configure handler
      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { data: `response-${request.id}` },
      }));

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 1.0,
      });

      // Send many concurrent requests
      const promises: Promise<void>[] = [];
      for (let i = 0; i < 100; i++) {
        const promise = transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'test',
          params: { index: i },
        });
        promises.push(promise);
      }

      await Promise.all(promises);

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(rawDataEvents).toHaveLength(100);
      expect(errorEvents).toHaveLength(100);
    });

    it('maintains performance with many interceptors', async () => {
      const startTime = Date.now();

      // Set up multiple interceptors
      for (let i = 0; i < 10; i++) {
        transport.setMalformedResponseInjection({
          targetMethods: [`method-${i}`],
          injection: { type: 'invalid_json' },
          probability: 0.5,
          maxInjections: 5,
        });
      }

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));

      // Send requests to various methods
      for (let i = 0; i < 100; i++) {
        await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: `method-${i % 10}`,
          params: {},
        });
      }

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(1000); // Should complete within 1 second
    });

    it('handles rapid malformed injection configuration changes', async () => {
      const events: string[] = [];
      transport.on('rawData', () => events.push('rawData'));
      transport.on('message', () => events.push('message'));

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));

      // Rapidly change injection configurations
      for (let i = 0; i < 20; i++) {
        transport.clearMalformedResponseInjection();

        if (i % 2 === 0) {
          transport.setMalformedResponseInjection({
            injection: { type: 'invalid_json' },
            probability: 1.0,
          });
        }

        await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'test',
          params: {},
        });
      }

      // Should have some mix of normal messages and raw data
      const rawDataCount = events.filter(e => e === 'rawData').length;
      const messageCount = events.filter(e => e === 'message').length;

      expect(rawDataCount + messageCount).toBe(20);
      expect(rawDataCount).toBeGreaterThan(0);
      expect(messageCount).toBeGreaterThan(0);
    });

    it('handles large malformed payloads efficiently', async () => {
      const rawDataEvents: (string | Buffer)[] = [];
      transport.on('rawData', (data) => rawDataEvents.push(data));

      // Create large custom malformed data
      const largePayload = 'X'.repeat(1024 * 1024); // 1MB of data

      const startTime = Date.now();
      transport.injectMalformedBytes({
        type: 'custom',
        rawBytes: largePayload,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const elapsed = Date.now() - startTime;

      expect(rawDataEvents).toHaveLength(1);
      expect((rawDataEvents[0] as string).length).toBe(1024 * 1024);
      expect(elapsed).toBeLessThan(100); // Should be fast even with large payload
    });
  });

  describe('Memory and resource management', () => {
    it('does not leak memory with many malformed injections', async () => {
      await transport.connect();

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { data: 'test'.repeat(1000) }, // Moderately large response
      }));

      transport.setMalformedResponseInjection({
        injection: { type: 'truncated_json', truncateAt: '50%' },
        probability: 1.0,
      });

      // Generate many malformed responses
      for (let i = 0; i < 1000; i++) {
        await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'test',
          params: {},
        });

        // Clear event listeners periodically to avoid accumulation
        if (i % 100 === 0) {
          transport.removeAllListeners('rawData');
          transport.removeAllListeners('error');
        }
      }

      // Test should complete without memory issues
      expect(transport.getSentMessages()).toHaveLength(1000);
    });

    it('cleans up properly after many injection configurations', () => {
      // Set up many injection configurations
      for (let i = 0; i < 100; i++) {
        transport.setMalformedResponseInjection({
          targetMethods: [`method-${i}`],
          injection: { type: 'invalid_json' },
          probability: 0.5,
        });
      }

      // Clear all configurations
      transport.clearMalformedResponseInjection();

      // Reset should clean everything
      transport.reset();

      // Transport should be in clean state
      expect(transport.isConnected()).toBe(false);
      expect(transport.getSentMessages()).toHaveLength(0);
    });
  });

  describe('Error handling under stress', () => {
    it('handles malformed injection during transport errors gracefully', async () => {
      await transport.connect();

      const errorEvents: MCPTransportError[] = [];
      transport.on('error', (error) => errorEvents.push(error));

      transport.setRequestHandler(async () => {
        throw new Error('Handler failure');
      });

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 1.0,
      });

      // Send request that will cause handler error
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      // Should have at least one error (from handler failure)
      expect(errorEvents.length).toBeGreaterThan(0);
      expect(errorEvents.some(e => e.message.includes('Handler error'))).toBe(true);
    });

    it('maintains injection state across connection cycles', async () => {
      // Set up injection before connecting
      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 1.0,
        maxInjections: 5,
      });

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));

      // Connect, send requests, disconnect, reconnect
      await transport.connect();

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      await transport.disconnect();
      await transport.connect();

      await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'test',
        params: {},
      });

      // Injection configuration should persist across connection cycles
      const rawDataEvents: (string | Buffer)[] = [];
      transport.on('rawData', (data) => rawDataEvents.push(data));

      await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'test',
        params: {},
      });

      expect(rawDataEvents).toHaveLength(1);
    });
  });

  describe('Complex injection scenarios', () => {
    it('handles overlapping injection configurations', async () => {
      await transport.connect();

      const events: { type: string, data?: any }[] = [];
      transport.on('rawData', (data) => events.push({ type: 'rawData', data }));
      transport.on('message', (message) => events.push({ type: 'message', data: message }));

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));

      // Set up multiple overlapping configurations
      transport.setMalformedResponseInjection({
        targetMethods: ['test'],
        injection: { type: 'invalid_json' },
        probability: 0.5,
        maxInjections: 2,
      });

      transport.setMalformedResponseInjection({
        targetMethods: ['test'],
        injection: { type: 'truncated_json' },
        probability: 0.5,
        maxInjections: 2,
      });

      // Send many requests to see mixed behavior
      for (let i = 0; i < 20; i++) {
        await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'test',
          params: {},
        });
      }

      const rawDataEvents = events.filter(e => e.type === 'rawData');
      const messageEvents = events.filter(e => e.type === 'message');

      // Should have some of both types due to overlapping configurations
      expect(rawDataEvents.length).toBeGreaterThan(0);
      expect(messageEvents.length).toBeGreaterThan(0);
      expect(rawDataEvents.length + messageEvents.length).toBe(20);
    });

    it('handles delayed injections with high concurrency', async () => {
      await transport.connect();

      const timestamps: number[] = [];
      transport.on('rawData', () => timestamps.push(Date.now()));

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json', delayMs: 50 },
        probability: 1.0,
      });

      const startTime = Date.now();

      // Send many concurrent requests with delayed injection
      const promises: Promise<void>[] = [];
      for (let i = 0; i < 10; i++) {
        const promise = transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'test',
          params: {},
        });
        promises.push(promise);
      }

      await Promise.all(promises);

      // Wait for all delayed injections
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(timestamps).toHaveLength(10);

      // All timestamps should be at least 40ms after start (allowing variance)
      const minExpectedTime = startTime + 40;
      timestamps.forEach(timestamp => {
        expect(timestamp).toBeGreaterThan(minExpectedTime);
      });
    });
  });
});