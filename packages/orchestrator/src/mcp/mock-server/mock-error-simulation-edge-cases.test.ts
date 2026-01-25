/**
 * @fileoverview Edge Case Tests for MockMCPServer Intermittent Failure Simulation
 *
 * Tests comprehensive edge cases for the intermittent failure simulation feature including:
 * - Zero and negative failPeriod values
 * - Very large failPeriod values
 * - Failure period changes during operation
 * - Request count overflow scenarios
 * - Concurrent client behavior with different failure periods
 * - Integration with other error modes and categories
 *
 * @module orchestrator/mcp/mock-server/mock-error-simulation-edge-cases.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockMCPServer } from './mock-mcp-server.js';
import type {
  MockMCPServerDefinition,
  MockErrorSimulationConfig,
} from '@apexcli/core';
import type { JSONRPCRequest, JSONRPCResponse } from '../types.js';

describe('MockMCPServer - Intermittent Failure Simulation Edge Cases', () => {
  let server: MockMCPServer;
  let serverDefinition: MockMCPServerDefinition;

  beforeEach(async () => {
    serverDefinition = {
      serverConfig: {
        name: 'edge-case-test-server',
        transport: 'stdio',
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
        },
        maxConnections: 10,
        shutdownTimeoutMs: 5000,
      },
      defaultBehavior: {
        responseDelay: { fixedMs: 0 },
        errorInjection: { enabled: false },
        toolHandlers: [
          {
            toolName: 'test_tool',
            response: {
              content: [{ type: 'text', text: 'success response' }],
              isError: false,
            },
          },
        ],
      },
      scenarios: [],
    };

    server = new MockMCPServer(serverDefinition);
    await server.start();
  });

  afterEach(async () => {
    if (server.isListening()) {
      await server.stop();
    }
    vi.clearAllMocks();
  });

  describe('Edge Cases for failPeriod Values', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should handle zero failPeriod gracefully (no failures)', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 0,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Should not fail with zero period' },
      });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      };

      // Should not fail even after many requests
      for (let i = 1; i <= 10; i++) {
        const response = await transport.send({ ...request, id: i }) as JSONRPCResponse;
        expect(response.result).toBeDefined();
        expect(response.error).toBeUndefined();
      }

      const errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(10);
      expect(errorState.errorCount).toBe(0);
      expect(errorState.successCount).toBe(10);
    });

    it('should handle negative failPeriod gracefully (no failures)', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: -5,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Should not fail with negative period' },
      });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      };

      // Should not fail even after many requests
      for (let i = 1; i <= 10; i++) {
        const response = await transport.send({ ...request, id: i }) as JSONRPCResponse;
        expect(response.result).toBeDefined();
        expect(response.error).toBeUndefined();
      }

      const errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(10);
      expect(errorState.errorCount).toBe(0);
      expect(errorState.successCount).toBe(10);
    });

    it('should handle very large failPeriod values', async () => {
      const largePeriod = 1000000; // 1 million
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: largePeriod,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Large period test' },
      });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      };

      // First 999,999 requests should succeed
      for (let i = 1; i <= 100; i++) {
        const response = await transport.send({ ...request, id: i }) as JSONRPCResponse;
        expect(response.result).toBeDefined();
        expect(response.error).toBeUndefined();
      }

      const errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(100);
      expect(errorState.errorCount).toBe(0);
      expect(errorState.successCount).toBe(100);
    });

    it('should handle floating point failPeriod values (rounded down)', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 2.7, // Should be treated as 2
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Float period test' },
      });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      };

      // First request succeeds
      const response1 = await transport.send({ ...request, id: 1 }) as JSONRPCResponse;
      expect(response1.result).toBeDefined();

      // Second request should fail (2.7 floored to 2)
      const response2 = await transport.send({ ...request, id: 2 }) as JSONRPCResponse;
      expect(response2.error).toBeDefined();
      expect(response2.error!.message).toBe('Float period test');

      const errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(2);
      expect(errorState.errorCount).toBe(1);
      expect(errorState.successCount).toBe(1);
    });
  });

  describe('Dynamic Configuration Changes', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should handle failPeriod changes during operation', async () => {
      // Start with period of 3
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 3,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Initial period' },
      });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      };

      // Make 2 requests (should succeed)
      await transport.send({ ...request, id: 1 });
      await transport.send({ ...request, id: 2 });

      // Change period to 2 before the third request
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 2,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Changed period' },
      });

      // The request counter was reset, so next request (now request #1 in new config) should succeed
      const response3 = await transport.send({ ...request, id: 3 }) as JSONRPCResponse;
      expect(response3.result).toBeDefined();

      // Next request (request #2 in new config) should fail
      const response4 = await transport.send({ ...request, id: 4 }) as JSONRPCResponse;
      expect(response4.error).toBeDefined();
      expect(response4.error!.message).toBe('Changed period');
    });

    it('should reset request count when error mode is changed', async () => {
      // Set initial mode
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 3,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'First mode' },
      });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      };

      // Make some requests to accumulate count
      await transport.send({ ...request, id: 1 });
      await transport.send({ ...request, id: 2 });

      let errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(2);

      // Change to always_fail mode - should reset count
      server.setErrorMode({
        mode: 'always_fail',
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Always fail' },
      });

      errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(0);
      expect(errorState.errorCount).toBe(0);
      expect(errorState.successCount).toBe(0);
    });
  });

  describe('Request Count Overflow Scenarios', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should handle request count approaching JavaScript MAX_SAFE_INTEGER', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 5,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'High count test' },
      });

      // Manually set a very high request count to test overflow behavior
      const highCount = Number.MAX_SAFE_INTEGER - 2;
      (server as any).errorSimulationState.requestCount = highCount;

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      };

      // Should still work with very high numbers
      const response = await transport.send(request) as JSONRPCResponse;

      // The behavior should still be predictable
      const newCount = server.getErrorSimulationState().requestCount;
      expect(newCount).toBe(highCount + 1);

      // Should fail if it's divisible by 5
      const shouldFail = (newCount % 5) === 0;
      if (shouldFail) {
        expect(response.error).toBeDefined();
      } else {
        expect(response.result).toBeDefined();
      }
    });
  });

  describe('Multi-Client Intermittent Failures', () => {
    let transport1: any;
    let transport2: any;

    beforeEach(async () => {
      transport1 = server.createClientTransport();
      transport2 = server.createClientTransport();
      await transport1.connect();
      await transport2.connect();
    });

    it('should apply periodic failures globally across all clients', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 2, // Every 2nd request fails across all clients
        affectedClients: 'all',
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Global periodic' },
      });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      };

      // First request from client1 (request #1) - should succeed
      const response1 = await transport1.send({ ...request, id: 1 }) as JSONRPCResponse;
      expect(response1.result).toBeDefined();

      // First request from client2 (request #2 globally) - should fail
      const response2 = await transport2.send({ ...request, id: 2 }) as JSONRPCResponse;
      expect(response2.error).toBeDefined();

      // Second request from client1 (request #3 globally) - should succeed
      const response3 = await transport1.send({ ...request, id: 3 }) as JSONRPCResponse;
      expect(response3.result).toBeDefined();

      // Second request from client2 (request #4 globally) - should fail
      const response4 = await transport2.send({ ...request, id: 4 }) as JSONRPCResponse;
      expect(response4.error).toBeDefined();

      const errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(4);
      expect(errorState.errorCount).toBe(2);
      expect(errorState.successCount).toBe(2);
    });

    it('should target specific clients for periodic failures', async () => {
      const clients = server.getConnectedClients();
      expect(clients).toHaveLength(2);

      const client1Id = clients[0].id;

      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 1, // Every request fails for targeted client
        affectedClients: [client1Id],
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Client specific periodic' },
      });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      };

      // Client1 requests should fail
      const client1Response = await transport1.send(request) as JSONRPCResponse;
      expect(client1Response.error).toBeDefined();
      expect(client1Response.error!.message).toBe('Client specific periodic');

      // Client2 requests should succeed
      const client2Response = await transport2.send(request) as JSONRPCResponse;
      expect(client2Response.result).toBeDefined();
      expect(client2Response.error).toBeUndefined();
    });
  });

  describe('Integration with Error Categories', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should combine periodic_fail with different error categories correctly', async () => {
      const testCases = [
        { category: 'jsonrpc', expectedCode: -32603 },
        { category: 'application', expectedCode: -32001 },
        { category: 'network', expectedCode: -32000 },
        { category: 'transport', expectedCode: -32700 },
      ];

      for (const testCase of testCases) {
        server.resetErrorSimulation(); // Clear previous state

        server.setErrorMode({
          mode: 'periodic_fail',
          failPeriod: 1, // Every request fails
          category: testCase.category as any,
          customError: {
            code: testCase.expectedCode,
            message: `${testCase.category} category error`,
          },
        });

        const response = await transport.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        }) as JSONRPCResponse;

        expect(response.error).toBeDefined();
        expect(response.error!.code).toBe(testCase.expectedCode);
        expect(response.error!.message).toBe(`${testCase.category} category error`);
      }
    });
  });

  describe('Combination with Other Error Modes', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should work when switching from periodic_fail to other modes', async () => {
      // Start with periodic_fail
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 2,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Periodic mode' },
      });

      // Make one request that should succeed
      const response1 = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      }) as JSONRPCResponse;
      expect(response1.result).toBeDefined();

      // Switch to always_fail
      server.setErrorMode({
        mode: 'always_fail',
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Always fail mode' },
      });

      // Next request should fail with new message
      const response2 = await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'ping',
      }) as JSONRPCResponse;
      expect(response2.error).toBeDefined();
      expect(response2.error!.message).toBe('Always fail mode');
    });

    it('should work when switching to periodic_fail from other modes', async () => {
      // Start with always_fail
      server.setErrorMode({
        mode: 'always_fail',
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Always fail mode' },
      });

      // Make one request that should fail
      const response1 = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      }) as JSONRPCResponse;
      expect(response1.error).toBeDefined();
      expect(response1.error!.message).toBe('Always fail mode');

      // Switch to periodic_fail with period 3
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 3,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Periodic mode' },
      });

      // Next 2 requests should succeed (request count was reset)
      for (let i = 1; i <= 2; i++) {
        const response = await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'ping',
        }) as JSONRPCResponse;
        expect(response.result).toBeDefined();
      }

      // Third request should fail
      const response3 = await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'ping',
      }) as JSONRPCResponse;
      expect(response3.error).toBeDefined();
      expect(response3.error!.message).toBe('Periodic mode');
    });
  });

  describe('State Persistence and Reset', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should persist state across requests within same session', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 5,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Persistence test' },
      });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      };

      // Make 4 requests (should all succeed)
      for (let i = 1; i <= 4; i++) {
        const response = await transport.send({ ...request, id: i }) as JSONRPCResponse;
        expect(response.result).toBeDefined();
        expect(response.error).toBeUndefined();
      }

      // 5th request should fail
      const response5 = await transport.send({ ...request, id: 5 }) as JSONRPCResponse;
      expect(response5.error).toBeDefined();
      expect(response5.error!.message).toBe('Persistence test');

      const errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(5);
      expect(errorState.errorCount).toBe(1);
      expect(errorState.successCount).toBe(4);
    });

    it('should reset state when resetErrorSimulation is called', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 3,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Before reset' },
      });

      // Make some requests
      await transport.send({ jsonrpc: '2.0', id: 1, method: 'ping' });
      await transport.send({ jsonrpc: '2.0', id: 2, method: 'ping' });

      let errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(2);

      // Reset simulation
      server.resetErrorSimulation();

      errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(0);
      expect(errorState.errorCount).toBe(0);
      expect(errorState.successCount).toBe(0);
      expect(server.getErrorMode()).toBeUndefined();

      // Next request should succeed (no error mode active)
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'ping',
      }) as JSONRPCResponse;
      expect(response.result).toBeDefined();
      expect(response.error).toBeUndefined();
    });
  });

  describe('Method-Specific Intermittent Failures', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should combine periodic_fail with method pattern filtering', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 2, // Every 2nd request fails
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Periodic with method filter' },
      });

      // Make a ping request (1st request) - should succeed
      const pingResponse = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      }) as JSONRPCResponse;
      expect(pingResponse.result).toBeDefined();

      // Make a tools/list request (2nd request) - should fail
      const toolsResponse = await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      }) as JSONRPCResponse;
      expect(toolsResponse.error).toBeDefined();
      expect(toolsResponse.error!.message).toBe('Periodic with method filter');

      const errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(2);
      expect(errorState.errorCount).toBe(1);
      expect(errorState.successCount).toBe(1);
    });
  });

  describe('Concurrent Stress Testing', () => {
    it('should handle multiple clients making concurrent requests with periodic failures', async () => {
      const transports: any[] = [];
      const numClients = 3;

      // Create multiple clients
      for (let i = 0; i < numClients; i++) {
        const transport = server.createClientTransport();
        await transport.connect();
        transports.push(transport);
      }

      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 3, // Every 3rd request fails
        affectedClients: 'all',
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Concurrent test' },
      });

      const requestPromises: Promise<any>[] = [];

      // Make 9 concurrent requests (3 from each client)
      for (let clientIndex = 0; clientIndex < numClients; clientIndex++) {
        for (let requestIndex = 1; requestIndex <= 3; requestIndex++) {
          const promise = transports[clientIndex].send({
            jsonrpc: '2.0',
            id: clientIndex * 3 + requestIndex,
            method: 'ping',
          });
          requestPromises.push(promise);
        }
      }

      const responses = await Promise.all(requestPromises);

      // Should have exactly 3 failures (every 3rd request: #3, #6, #9)
      const failures = responses.filter((r: any) => r.error !== undefined);
      const successes = responses.filter((r: any) => r.result !== undefined);

      expect(failures).toHaveLength(3);
      expect(successes).toHaveLength(6);

      const errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(9);
      expect(errorState.errorCount).toBe(3);
      expect(errorState.successCount).toBe(6);

      // Clean up transports
      for (const transport of transports) {
        await transport.disconnect();
      }
    });
  });
});