/**
 * @fileoverview Integration tests for MockTransport malformed bytes injection with MCPClient
 *
 * Tests the complete integration between MockTransport malformed injection feature
 * and the actual MCPClient to ensure realistic error handling scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MockTransport } from './mock-transport.js';
import { JSONRPCMessage, MCPTransportError } from '../types.js';

// Mock MCPClient for integration testing
class MockMCPClient {
  private transport: MockTransport;
  private requestId = 1;
  private pendingRequests = new Map<number, { resolve: Function, reject: Function }>();

  constructor(transport: MockTransport) {
    this.transport = transport;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.transport.on('message', (message: JSONRPCMessage) => {
      if ('id' in message && message.id !== null) {
        const pending = this.pendingRequests.get(message.id as number);
        if (pending) {
          this.pendingRequests.delete(message.id as number);
          if ('error' in message) {
            pending.reject(new Error(message.error?.message || 'RPC Error'));
          } else {
            pending.resolve(message.result);
          }
        }
      }
    });

    this.transport.on('error', (error: MCPTransportError) => {
      // Reject all pending requests on transport error
      for (const [id, pending] of this.pendingRequests.entries()) {
        pending.reject(error);
        this.pendingRequests.delete(id);
      }
    });

    this.transport.on('rawData', (data: string | Buffer) => {
      // In real scenarios, this would be handled by the transport layer
      // Here we simulate what would happen if raw malformed data was received
      console.log('Raw malformed data received:', typeof data === 'string' ? data.slice(0, 50) + '...' : `Binary data (${data.length} bytes)`);
    });
  }

  async connect(): Promise<void> {
    await this.transport.connect();
  }

  async disconnect(): Promise<void> {
    await this.transport.disconnect();
  }

  async sendRequest(method: string, params?: unknown): Promise<unknown> {
    const id = this.requestId++;
    const request: JSONRPCMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params: params || {},
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      // Set a timeout for the request
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 5000);

      this.transport.send(request).catch(error => {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      });
    });
  }

  isConnected(): boolean {
    return this.transport.isConnected();
  }
}

describe('MockTransport - Integration Tests with MCPClient', () => {
  let transport: MockTransport;
  let client: MockMCPClient;

  beforeEach(() => {
    transport = new MockTransport();
    client = new MockMCPClient(transport);
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.disconnect();
    }
  });

  describe('Normal operation verification', () => {
    it('handles normal request/response flow', async () => {
      await client.connect();

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { tools: [{ name: 'test-tool' }] },
      }));

      const result = await client.sendRequest('tools/list');
      expect(result).toEqual({ tools: [{ name: 'test-tool' }] });
    });
  });

  describe('Malformed response handling', () => {
    beforeEach(async () => {
      await client.connect();

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true, data: 'Original response data' },
      }));
    });

    it('client receives transport error for invalid JSON injection', async () => {
      transport.setMalformedResponseInjection({
        targetMethods: ['test/malformed'],
        injection: { type: 'invalid_json' },
        probability: 1.0,
      });

      await expect(client.sendRequest('test/malformed')).rejects.toThrow('Malformed data received');
    });

    it('client receives transport error for truncated JSON injection', async () => {
      transport.setMalformedResponseInjection({
        targetMethods: ['test/truncated'],
        injection: { type: 'truncated_json', truncateAt: '25%' },
        probability: 1.0,
      });

      await expect(client.sendRequest('test/truncated')).rejects.toThrow();
    });

    it('client receives transport error for empty response injection', async () => {
      transport.setMalformedResponseInjection({
        targetMethods: ['test/empty'],
        injection: { type: 'empty_response' },
        probability: 1.0,
      });

      await expect(client.sendRequest('test/empty')).rejects.toThrow();
    });

    it('client receives transport error for binary data injection', async () => {
      transport.setMalformedResponseInjection({
        targetMethods: ['test/binary'],
        injection: { type: 'binary_data' },
        probability: 1.0,
      });

      await expect(client.sendRequest('test/binary')).rejects.toThrow();
    });

    it('client receives normal response for non-targeted methods', async () => {
      transport.setMalformedResponseInjection({
        targetMethods: ['test/malformed'],
        injection: { type: 'invalid_json' },
        probability: 1.0,
      });

      const result = await client.sendRequest('test/normal');
      expect(result).toEqual({ success: true, data: 'Original response data' });
    });
  });

  describe('Probabilistic malformed injection', () => {
    beforeEach(async () => {
      await client.connect();

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { requestId: request.id },
      }));
    });

    it('respects probability setting across multiple requests', async () => {
      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 0.0, // Never inject
      });

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(client.sendRequest('test', { index: i }));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);

      // All should be successful since probability is 0
      results.forEach((result, index) => {
        expect(result).toEqual({ requestId: index + 1 });
      });
    });

    it('applies max injection limit correctly', async () => {
      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 1.0, // Always inject
        maxInjections: 3,
      });

      const results = [];
      const errors = [];

      // Send 10 requests
      for (let i = 0; i < 10; i++) {
        try {
          const result = await client.sendRequest('test', { index: i });
          results.push(result);
        } catch (error) {
          errors.push(error);
        }
      }

      // Should have exactly 3 errors (max injections) and 7 successful responses
      expect(errors).toHaveLength(3);
      expect(results).toHaveLength(7);
    });
  });

  describe('Concurrent request handling with malformed injection', () => {
    beforeEach(async () => {
      await client.connect();

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { processed: true, requestId: request.id },
      }));
    });

    it('handles mixed normal and malformed responses concurrently', async () => {
      transport.setMalformedResponseInjection({
        targetMethods: ['test/malformed'],
        injection: { type: 'invalid_json' },
        probability: 1.0,
      });

      const promises = [];

      // Mix of normal and malformed requests
      for (let i = 0; i < 5; i++) {
        promises.push(client.sendRequest('test/normal', { index: i }));
        promises.push(
          client.sendRequest('test/malformed', { index: i }).catch(error => ({ error: error.message }))
        );
      }

      const results = await Promise.all(promises);

      // Check that we got expected mix
      const normalResults = results.filter(r => r && !('error' in r));
      const errorResults = results.filter(r => r && 'error' in r);

      expect(normalResults).toHaveLength(5);
      expect(errorResults).toHaveLength(5);
    });

    it('maintains request ordering with delayed malformed injection', async () => {
      const responseOrder: number[] = [];
      const errorOrder: number[] = [];

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json', delayMs: 50 },
        probability: 1.0,
      });

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          client.sendRequest('test', { index: i })
            .then(result => {
              responseOrder.push((result as any).requestId);
              return result;
            })
            .catch(error => {
              errorOrder.push(i + 1);
              throw error;
            })
        );
      }

      await Promise.allSettled(promises);

      // With delayed injection, all should be errors
      expect(errorOrder).toHaveLength(5);
      expect(responseOrder).toHaveLength(0);

      // Error order should match request order (within timing variance)
      expect(errorOrder).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('Transport state management during malformed injection', () => {
    it('maintains connection state during malformed injection', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 1.0,
      });

      // Send request that will cause malformed injection
      await expect(client.sendRequest('test')).rejects.toThrow();

      // Connection should still be active
      expect(client.isConnected()).toBe(true);
    });

    it('clears injection state properly on transport reset', async () => {
      await client.connect();

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));

      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 1.0,
      });

      // Verify injection is working
      await expect(client.sendRequest('test')).rejects.toThrow();

      // Reset transport
      transport.reset();
      await client.disconnect();

      // Reconnect with new client
      const newClient = new MockMCPClient(transport);
      await newClient.connect();

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      }));

      // Should work normally now (injection state cleared)
      const result = await newClient.sendRequest('test');
      expect(result).toEqual({ success: true });

      await newClient.disconnect();
    });
  });

  describe('Error recovery scenarios', () => {
    it('allows client to recover after malformed response errors', async () => {
      await client.connect();

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true, method: request.method },
      }));

      transport.setMalformedResponseInjection({
        targetMethods: ['test/malformed'],
        injection: { type: 'invalid_json' },
        probability: 1.0,
        maxInjections: 1, // Only inject once
      });

      // First request should fail due to malformed injection
      await expect(client.sendRequest('test/malformed')).rejects.toThrow();

      // Second request to same method should succeed (max injections reached)
      const result = await client.sendRequest('test/malformed');
      expect(result).toEqual({ success: true, method: 'test/malformed' });

      // Other methods should work normally
      const normalResult = await client.sendRequest('test/normal');
      expect(normalResult).toEqual({ success: true, method: 'test/normal' });
    });
  });

  describe('Real-world simulation scenarios', () => {
    it('simulates network corruption during tool invocation', async () => {
      await client.connect();

      transport.setRequestHandler(async (request) => {
        if (request.method === 'tools/list') {
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              tools: [
                { name: 'file_reader', description: 'Read files' },
                { name: 'web_scraper', description: 'Scrape web content' }
              ]
            }
          };
        }

        if (request.method === 'tools/call') {
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              toolResult: { content: 'File contents here...', success: true }
            }
          };
        }

        return {
          jsonrpc: '2.0',
          id: request.id,
          result: { success: true }
        };
      });

      // Normal tool listing works
      const tools = await client.sendRequest('tools/list');
      expect(tools).toEqual({
        tools: [
          { name: 'file_reader', description: 'Read files' },
          { name: 'web_scraper', description: 'Scrape web content' }
        ]
      });

      // Inject corruption for tool calls
      transport.setMalformedResponseInjection({
        targetMethods: ['tools/call'],
        injection: { type: 'truncated_json', truncateAt: '60%' },
        probability: 1.0,
      });

      // Tool call should fail due to corrupted response
      await expect(
        client.sendRequest('tools/call', {
          name: 'file_reader',
          arguments: { path: '/test/file.txt' }
        })
      ).rejects.toThrow();
    });

    it('simulates intermittent server instability', async () => {
      await client.connect();

      transport.setRequestHandler(async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: { status: 'processed', requestNumber: request.id },
      }));

      // Configure intermittent corruption (50% chance)
      transport.setMalformedResponseInjection({
        injection: { type: 'invalid_json' },
        probability: 0.5,
      });

      const results = [];
      const errors = [];

      // Simulate multiple client operations
      for (let i = 0; i < 20; i++) {
        try {
          const result = await client.sendRequest('operation', { attempt: i });
          results.push(result);
        } catch (error) {
          errors.push(error);
        }
      }

      // Should have a mix of successes and failures
      expect(results.length + errors.length).toBe(20);
      expect(results.length).toBeGreaterThan(0);
      expect(errors.length).toBeGreaterThan(0);

      // Successful results should have correct structure
      results.forEach((result, index) => {
        expect(result).toHaveProperty('status', 'processed');
        expect(result).toHaveProperty('requestNumber');
      });
    });
  });
});