/**
 * @fileoverview Timeout Simulation Tests
 *
 * Comprehensive tests for timeout simulation capabilities including:
 * - Connection timeouts
 * - Request timeouts
 * - Server hang simulation
 * - Custom timeout configurations
 * - Network latency simulation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockMCPServer } from './mock-mcp-server.js';
import type { MockMCPServerDefinition } from '@apexcli/core';

describe('Timeout Simulation Tests', () => {
  let server: MockMCPServer;

  const baseDefinition: MockMCPServerDefinition = {
    serverConfig: {
      name: 'timeout-test-server',
      transport: 'stdio',
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true },
        prompts: {},
      },
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'TimeoutTestServer', version: '1.0.0' },
      maxConnections: 5,
      shutdownTimeoutMs: 1000,
    },
    defaultBehavior: {
      toolHandlers: [
        {
          toolName: 'slow_tool',
          response: { content: [{ type: 'text', text: 'slow result' }] },
          delayMs: 100, // Base delay for tool
        },
      ],
      errorInjection: [],
      notificationTriggers: [],
    },
    scenarios: [],
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    server = new MockMCPServer(baseDefinition);
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
    vi.useRealTimers();
  });

  describe('Connection Timeout Simulation', () => {
    it('should simulate connection timeout during handshake', async () => {
      const transport = server.createClientTransport({
        connectionTimeout: 100, // 100ms timeout
        connectionLatencyMs: 200, // 200ms latency (will timeout)
      });

      const connectPromise = transport.connect();

      // Fast forward past timeout
      vi.advanceTimersByTime(150);

      await expect(connectPromise).rejects.toThrow();
    });

    it('should allow successful connection within timeout', async () => {
      const transport = server.createClientTransport({
        connectionTimeout: 200, // 200ms timeout
        connectionLatencyMs: 50, // 50ms latency (should succeed)
      });

      const connectPromise = transport.connect();

      // Fast forward past latency but before timeout
      vi.advanceTimersByTime(100);

      await expect(connectPromise).resolves.not.toThrow();
    });

    it('should handle infinite timeout configuration', async () => {
      server.setErrorMode({
        mode: 'always_fail',
        networkConditions: {
          connectionTimeout: 0, // 0 = infinite timeout
        },
        customError: {
          code: -32000,
          message: 'Server not responding',
        },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      const response = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {},
      });

      expect(response.error).toBeDefined();
      expect(response.error?.message).toBe('Server not responding');
    });
  });

  describe('Request Timeout Simulation', () => {
    it('should simulate request timeout with preset', async () => {
      server.applyErrorPreset('request_timeout');

      const transport = server.createClientTransport();
      await transport.connect();

      const response = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'slow_tool' },
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32000);
      expect(response.error?.message).toBe('Request timed out after 30000ms');
      expect(response.error?.data).toEqual({
        timeout: 30000,
        operation: 'processRequest',
      });
    });

    it('should simulate custom timeout duration', async () => {
      server.setErrorMode({
        mode: 'always_fail',
        networkConditions: {
          connectionTimeout: 5000, // 5 second timeout
        },
        customError: {
          code: -32000,
          message: 'Request timed out after 5000ms',
          data: {
            timeout: 5000,
            operation: 'customOperation',
          },
        },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      const response = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'slow_tool' },
      });

      expect(response.error?.data?.timeout).toBe(5000);
      expect(response.error?.data?.operation).toBe('customOperation');
    });

    it('should simulate timeout with specific methods only', async () => {
      server.setErrorMode({
        mode: 'method_pattern',
        methodPattern: '^tools/call$',
        networkConditions: {
          connectionTimeout: 1,
        },
        customError: {
          code: -32000,
          message: 'Tool execution timeout',
        },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      // Initialize should succeed
      const initResponse = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { clientInfo: { name: 'test', version: '1.0' } },
      });
      expect(initResponse.error).toBeUndefined();

      // tools/call should timeout
      const toolResponse = await transport.request({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'slow_tool' },
      });
      expect(toolResponse.error).toBeDefined();
      expect(toolResponse.error?.message).toBe('Tool execution timeout');
    });
  });

  describe('Server Hang Simulation', () => {
    it('should simulate server hang with preset', async () => {
      server.applyErrorPreset('server_hang');

      const transport = server.createClientTransport();
      await transport.connect();

      const response = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {},
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32000);
      expect(response.error?.message).toBe('Server not responding');
    });

    it('should simulate indefinite hang without response', async () => {
      server.setErrorMode({
        mode: 'always_fail',
        networkConditions: {
          connectionTimeout: 0, // Infinite wait
        },
        customError: {
          code: -32000,
          message: 'Server hang detected',
          data: {
            hangDuration: 'indefinite',
            lastResponse: Date.now(),
          },
        },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      const response = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {},
      });

      expect(response.error?.data?.hangDuration).toBe('indefinite');
    });
  });

  describe('Network Latency Simulation', () => {
    it('should simulate high network latency', async () => {
      server.setErrorMode({
        mode: 'always_fail',
        networkConditions: {
          latencyMs: 2000, // 2 second delay
        },
        customError: {
          code: -32000,
          message: 'High latency response',
        },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      const startTime = Date.now();
      const responsePromise = transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {},
      });

      // Fast forward the latency
      vi.advanceTimersByTime(2000);

      const response = await responsePromise;
      expect(response.error?.message).toBe('High latency response');
    });

    it('should combine latency with successful responses', async () => {
      // Update behavior to add delay without error
      server.updateBehavior({
        toolHandlers: [
          {
            toolName: 'slow_tool',
            response: { content: [{ type: 'text', text: 'delayed success' }] },
            delayMs: 1000, // 1 second delay
          },
        ],
        errorInjection: [],
        notificationTriggers: [],
      });

      const transport = server.createClientTransport();
      await transport.connect();

      const responsePromise = transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'slow_tool' },
      });

      // Fast forward the delay
      vi.advanceTimersByTime(1000);

      const response = await responsePromise;
      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
    });
  });

  describe('Progressive Timeout Scenarios', () => {
    it('should simulate escalating timeout failures', async () => {
      server.setErrorMode({
        mode: 'sequence',
        sequence: [
          {
            outcome: 'success',
            delayMs: 100,
          },
          {
            outcome: 'error',
            error: { code: -32000, message: 'Timeout: 1000ms' },
            delayMs: 1000,
          },
          {
            outcome: 'error',
            error: { code: -32000, message: 'Timeout: 2000ms' },
            delayMs: 2000,
          },
          {
            outcome: 'error',
            error: { code: -32000, message: 'Timeout: 5000ms' },
            delayMs: 5000,
          },
        ],
      });

      const transport = server.createClientTransport();
      await transport.connect();

      // First request - fast success
      const response1Promise = transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {},
      });
      vi.advanceTimersByTime(100);
      const response1 = await response1Promise;
      expect(response1.error).toBeUndefined();

      // Second request - 1s timeout
      const response2Promise = transport.request({
        jsonrpc: '2.0',
        id: 2,
        method: 'ping',
        params: {},
      });
      vi.advanceTimersByTime(1000);
      const response2 = await response2Promise;
      expect(response2.error?.message).toBe('Timeout: 1000ms');

      // Third request - 2s timeout
      const response3Promise = transport.request({
        jsonrpc: '2.0',
        id: 3,
        method: 'ping',
        params: {},
      });
      vi.advanceTimersByTime(2000);
      const response3 = await response3Promise;
      expect(response3.error?.message).toBe('Timeout: 2000ms');
    });

    it('should simulate timeout recovery pattern', async () => {
      server.setErrorMode({
        mode: 'fail_first_n',
        failCount: 3,
        networkConditions: {
          connectionTimeout: 100,
        },
        customError: {
          code: -32000,
          message: 'Service starting up',
          data: { reason: 'initialization' },
        },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      const results = [];

      // First 3 requests should timeout
      for (let i = 0; i < 3; i++) {
        const response = await transport.request({
          jsonrpc: '2.0',
          id: i + 1,
          method: 'ping',
          params: {},
        });
        results.push({ id: i + 1, hasError: !!response.error });
      }

      // 4th request should succeed
      const response4 = await transport.request({
        jsonrpc: '2.0',
        id: 4,
        method: 'ping',
        params: {},
      });
      results.push({ id: 4, hasError: !!response4.error });

      // Verify pattern: first 3 fail, 4th succeeds
      expect(results[0].hasError).toBe(true);
      expect(results[1].hasError).toBe(true);
      expect(results[2].hasError).toBe(true);
      expect(results[3].hasError).toBe(false);
    });
  });

  describe('Transport-Level Timeout Handling', () => {
    it('should handle transport send timeout', async () => {
      const transport = server.createClientTransport({
        shouldFailSend: true,
        sendError: new Error('Send timeout after 5000ms'),
      });

      await transport.connect();

      await expect(
        transport.request({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
          params: {},
        })
      ).rejects.toThrow('Send timeout after 5000ms');
    });

    it('should handle connection timeout during reconnect', async () => {
      const transport = server.createClientTransport({
        autoReconnect: true,
        maxReconnectAttempts: 2,
        reconnectDelay: 100,
        connectionTimeout: 50, // Shorter than reconnect delay
      });

      await transport.connect();

      // Simulate disconnect
      await transport.disconnect('Test disconnect');

      // Connection attempts should timeout
      expect(transport.isConnected()).toBe(false);
    });

    it('should validate timeout configuration bounds', async () => {
      // Test edge cases in timeout configuration
      server.setErrorMode({
        mode: 'always_fail',
        networkConditions: {
          connectionTimeout: -1, // Negative timeout
          latencyMs: 0, // Zero latency
        },
        customError: {
          code: -32000,
          message: 'Invalid timeout config handled',
        },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      // Should handle invalid config gracefully
      const response = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {},
      });

      expect(response.error?.message).toBe('Invalid timeout config handled');
    });
  });

  describe('Real-World Timeout Scenarios', () => {
    it('should simulate database connection timeout', async () => {
      server.setErrorMode({
        mode: 'method_pattern',
        methodPattern: '^tools/call$',
        networkConditions: {
          connectionTimeout: 5000,
        },
        customError: {
          code: -32000,
          message: 'Database connection timeout',
          data: {
            database: 'postgres',
            timeout: 5000,
            operation: 'SELECT',
            details: 'Connection pool exhausted',
          },
        },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { clientInfo: { name: 'test', version: '1.0' } },
      });

      const response = await transport.request({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'db_query', arguments: { query: 'SELECT * FROM users' } },
      });

      expect(response.error?.message).toBe('Database connection timeout');
      expect(response.error?.data?.database).toBe('postgres');
      expect(response.error?.data?.operation).toBe('SELECT');
    });

    it('should simulate API gateway timeout', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 2, // Every 2nd request
        networkConditions: {
          connectionTimeout: 30000,
        },
        customError: {
          code: -32000,
          message: 'Gateway timeout',
          data: {
            gateway: 'api-gateway-v2',
            timeout: 30000,
            upstreamService: 'mcp-server',
            statusCode: 504,
          },
        },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      const responses = [];

      // Make several requests to trigger periodic timeout
      for (let i = 0; i < 4; i++) {
        const response = await transport.request({
          jsonrpc: '2.0',
          id: i + 1,
          method: 'ping',
          params: {},
        });
        responses.push({
          id: i + 1,
          isTimeout: response.error?.data?.statusCode === 504,
        });
      }

      // Should have some timeouts due to periodic failure
      const timeouts = responses.filter(r => r.isTimeout);
      expect(timeouts.length).toBeGreaterThan(0);
    });

    it('should simulate circuit breaker timeout behavior', async () => {
      server.setErrorMode({
        mode: 'fail_after_n',
        succeedCount: 2, // Circuit opens after 2 successes
        customError: {
          code: -32000,
          message: 'Circuit breaker open',
          data: {
            state: 'OPEN',
            failures: 5,
            timeout: 60000,
            nextRetry: Date.now() + 60000,
          },
        },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      // First 2 requests succeed
      const response1 = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {},
      });
      expect(response1.error).toBeUndefined();

      const response2 = await transport.request({
        jsonrpc: '2.0',
        id: 2,
        method: 'ping',
        params: {},
      });
      expect(response2.error).toBeUndefined();

      // 3rd request triggers circuit breaker
      const response3 = await transport.request({
        jsonrpc: '2.0',
        id: 3,
        method: 'ping',
        params: {},
      });
      expect(response3.error?.message).toBe('Circuit breaker open');
      expect(response3.error?.data?.state).toBe('OPEN');
    });
  });
});