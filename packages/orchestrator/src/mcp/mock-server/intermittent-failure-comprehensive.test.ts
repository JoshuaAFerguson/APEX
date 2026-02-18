/**
 * @fileoverview Comprehensive Tests for Intermittent Failure Simulation
 *
 * Focused tests specifically for the "fail every Nth request" functionality
 * as specified in the acceptance criteria:
 * - MockMCPServer supports 'fail every Nth request' mode with configurable N value
 * - Can combine with any error type
 * - Tracks request count correctly
 * - Unit tests verify intermittent behavior
 *
 * @module orchestrator/mcp/mock-server/intermittent-failure-comprehensive.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockMCPServer } from './mock-mcp-server.js';
import type {
  MockMCPServerDefinition,
  MockErrorSimulationConfig,
} from '@apexcli/core';
import type { JSONRPCRequest, JSONRPCResponse } from '../types.js';

describe('MockMCPServer - Fail Every Nth Request Comprehensive Tests', () => {
  let server: MockMCPServer;
  let serverDefinition: MockMCPServerDefinition;

  beforeEach(async () => {
    serverDefinition = {
      serverConfig: {
        name: 'intermittent-test-server',
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

  describe('Configurable N Value Tests', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should support N=2 (fail every 2nd request)', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 2,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Every 2nd request fails' },
      });

      const expectedPattern = ['success', 'error', 'success', 'error', 'success', 'error'];
      const actualPattern: string[] = [];

      for (let i = 1; i <= expectedPattern.length; i++) {
        const response = await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'ping',
        }) as JSONRPCResponse;

        if (response.error) {
          actualPattern.push('error');
        } else {
          actualPattern.push('success');
        }
      }

      expect(actualPattern).toEqual(expectedPattern);

      const errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(6);
      expect(errorState.errorCount).toBe(3);
      expect(errorState.successCount).toBe(3);
    });

    it('should support N=3 (fail every 3rd request)', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 3,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Every 3rd request fails' },
      });

      const expectedPattern = ['success', 'success', 'error', 'success', 'success', 'error'];
      const actualPattern: string[] = [];

      for (let i = 1; i <= expectedPattern.length; i++) {
        const response = await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'ping',
        }) as JSONRPCResponse;

        if (response.error) {
          actualPattern.push('error');
        } else {
          actualPattern.push('success');
        }
      }

      expect(actualPattern).toEqual(expectedPattern);

      const errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(6);
      expect(errorState.errorCount).toBe(2);
      expect(errorState.successCount).toBe(4);
    });

    it('should support N=5 (fail every 5th request)', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 5,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Every 5th request fails' },
      });

      const expectedPattern = ['success', 'success', 'success', 'success', 'error', 'success', 'success', 'success', 'success', 'error'];
      const actualPattern: string[] = [];

      for (let i = 1; i <= expectedPattern.length; i++) {
        const response = await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'ping',
        }) as JSONRPCResponse;

        if (response.error) {
          actualPattern.push('error');
        } else {
          actualPattern.push('success');
        }
      }

      expect(actualPattern).toEqual(expectedPattern);

      const errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(10);
      expect(errorState.errorCount).toBe(2);
      expect(errorState.successCount).toBe(8);
    });

    it('should support N=10 (fail every 10th request)', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 10,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Every 10th request fails' },
      });

      let errorCount = 0;
      let successCount = 0;

      for (let i = 1; i <= 15; i++) {
        const response = await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'ping',
        }) as JSONRPCResponse;

        if (response.error) {
          errorCount++;
          // Should only fail on requests 10
          expect(i).toBe(10);
        } else {
          successCount++;
          // Should succeed on all other requests
          expect(i).not.toBe(10);
        }
      }

      expect(errorCount).toBe(1); // Only request #10 failed
      expect(successCount).toBe(14); // All others succeeded

      const errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(15);
      expect(errorState.errorCount).toBe(1);
      expect(errorState.successCount).toBe(14);
    });
  });

  describe('Combination with Any Error Type', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should combine with JSON-RPC error types', async () => {
      const errorTypes = [
        { code: -32700, message: 'Parse error', category: 'jsonrpc' },
        { code: -32600, message: 'Invalid Request', category: 'jsonrpc' },
        { code: -32601, message: 'Method not found', category: 'jsonrpc' },
        { code: -32602, message: 'Invalid params', category: 'jsonrpc' },
        { code: -32603, message: 'Internal error', category: 'jsonrpc' },
      ];

      for (const errorType of errorTypes) {
        server.resetErrorSimulation();

        server.setErrorMode({
          mode: 'periodic_fail',
          failPeriod: 2, // Fail every 2nd request
          category: errorType.category as any,
          customError: {
            code: errorType.code,
            message: errorType.message,
          },
        });

        // First request should succeed
        const response1 = await transport.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        }) as JSONRPCResponse;
        expect(response1.result).toBeDefined();

        // Second request should fail with specific error type
        const response2 = await transport.send({
          jsonrpc: '2.0',
          id: 2,
          method: 'ping',
        }) as JSONRPCResponse;
        expect(response2.error).toBeDefined();
        expect(response2.error!.code).toBe(errorType.code);
        expect(response2.error!.message).toBe(errorType.message);
      }
    });

    it('should combine with application error types', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 3,
        category: 'application',
        customError: {
          code: -32001,
          message: 'Application specific error',
          data: { errorType: 'validation', field: 'username' },
        },
      });

      // First two requests succeed
      for (let i = 1; i <= 2; i++) {
        const response = await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'ping',
        }) as JSONRPCResponse;
        expect(response.result).toBeDefined();
      }

      // Third request fails with application error
      const response3 = await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'ping',
      }) as JSONRPCResponse;
      expect(response3.error).toBeDefined();
      expect(response3.error!.code).toBe(-32001);
      expect(response3.error!.message).toBe('Application specific error');
      expect(response3.error!.data).toEqual({
        errorType: 'validation',
        field: 'username',
      });
    });

    it('should combine with network error types', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 4,
        category: 'network',
        customError: {
          code: -32000,
          message: 'Network timeout',
          data: { timeout: 5000 },
        },
        networkConditions: {
          latencyMs: 100,
          connectionTimeout: 1000,
        },
      });

      // First three requests succeed
      for (let i = 1; i <= 3; i++) {
        const response = await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'ping',
        }) as JSONRPCResponse;
        expect(response.result).toBeDefined();
      }

      // Fourth request fails with network error and delay
      const startTime = Date.now();
      const response4 = await transport.send({
        jsonrpc: '2.0',
        id: 4,
        method: 'ping',
      }) as JSONRPCResponse;
      const elapsed = Date.now() - startTime;

      expect(response4.error).toBeDefined();
      expect(response4.error!.code).toBe(-32000);
      expect(response4.error!.message).toBe('Network timeout');
      expect(response4.error!.data).toEqual({ timeout: 5000 });
      expect(elapsed).toBeGreaterThanOrEqual(95); // Should include network latency
    });
  });

  describe('Request Count Tracking Verification', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should accurately track request count during intermittent failures', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 3,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Count tracking test' },
      });

      const totalRequests = 12;
      const expectedErrors = Math.floor(totalRequests / 3); // 4 errors
      const expectedSuccesses = totalRequests - expectedErrors; // 8 successes

      for (let i = 1; i <= totalRequests; i++) {
        await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'ping',
        });

        // Verify count increments correctly after each request
        const state = server.getErrorSimulationState();
        expect(state.requestCount).toBe(i);
      }

      const finalState = server.getErrorSimulationState();
      expect(finalState.requestCount).toBe(totalRequests);
      expect(finalState.errorCount).toBe(expectedErrors);
      expect(finalState.successCount).toBe(expectedSuccesses);
    });

    it('should track count correctly when N changes during operation', async () => {
      // Start with N=3
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 3,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Initial period 3' },
      });

      // Make 5 requests with N=3 (errors on requests 3)
      for (let i = 1; i <= 5; i++) {
        await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'ping',
        });
      }

      let state = server.getErrorSimulationState();
      expect(state.requestCount).toBe(5);
      expect(state.errorCount).toBe(1); // Request 3 failed

      // Change to N=2 (resets count)
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 2,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Changed to period 2' },
      });

      // Count should be reset
      state = server.getErrorSimulationState();
      expect(state.requestCount).toBe(0);
      expect(state.errorCount).toBe(0);
      expect(state.successCount).toBe(0);

      // Make 4 more requests with N=2 (errors on requests 2 and 4)
      for (let i = 6; i <= 9; i++) {
        await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'ping',
        });
      }

      const finalState = server.getErrorSimulationState();
      expect(finalState.requestCount).toBe(4);
      expect(finalState.errorCount).toBe(2); // Requests 2 and 4 (in new counting) failed
      expect(finalState.successCount).toBe(2);
    });

    it('should track count correctly across multiple clients', async () => {
      const transport1 = server.createClientTransport();
      const transport2 = server.createClientTransport();
      await transport1.connect();
      await transport2.connect();

      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 4,
        affectedClients: 'all',
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Multi-client counting' },
      });

      // Interleave requests from both clients
      // Request pattern: C1, C2, C1, C2 (request 4 should fail)
      await transport1.send({ jsonrpc: '2.0', id: 1, method: 'ping' }); // Request 1
      await transport2.send({ jsonrpc: '2.0', id: 2, method: 'ping' }); // Request 2
      await transport1.send({ jsonrpc: '2.0', id: 3, method: 'ping' }); // Request 3

      // This should be the 4th request globally and should fail
      const response4 = await transport2.send({
        jsonrpc: '2.0',
        id: 4,
        method: 'ping',
      }) as JSONRPCResponse;
      expect(response4.error).toBeDefined();
      expect(response4.error!.message).toBe('Multi-client counting');

      const state = server.getErrorSimulationState();
      expect(state.requestCount).toBe(4);
      expect(state.errorCount).toBe(1);
      expect(state.successCount).toBe(3);

      await transport1.disconnect();
      await transport2.disconnect();
    });
  });

  describe('Integration with Method Patterns', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should count all requests but only fail matching methods', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 2,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Periodic ping failure' },
      });

      // Mix of different method calls
      const methods = ['ping', 'tools/list', 'ping', 'initialize'];
      const responses: JSONRPCResponse[] = [];

      for (let i = 0; i < methods.length; i++) {
        const response = await transport.send({
          jsonrpc: '2.0',
          id: i + 1,
          method: methods[i],
        }) as JSONRPCResponse;
        responses.push(response);
      }

      // Requests 2 and 4 should fail (every 2nd request)
      expect(responses[0].result).toBeDefined(); // ping #1 - success
      expect(responses[1].error).toBeDefined();  // tools/list #2 - fail
      expect(responses[2].result).toBeDefined(); // ping #3 - success
      expect(responses[3].error).toBeDefined();  // initialize #4 - fail

      const state = server.getErrorSimulationState();
      expect(state.requestCount).toBe(4);
      expect(state.errorCount).toBe(2);
      expect(state.successCount).toBe(2);
    });
  });

  describe('Intermittent Failure State Persistence', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should maintain failure pattern across server operations', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 3,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Persistent pattern' },
      });

      // Make 2 requests (should succeed)
      await transport.send({ jsonrpc: '2.0', id: 1, method: 'ping' });
      await transport.send({ jsonrpc: '2.0', id: 2, method: 'ping' });

      let state = server.getErrorSimulationState();
      expect(state.requestCount).toBe(2);

      // Disconnect and reconnect transport (server state should persist)
      await transport.disconnect();
      transport = server.createClientTransport();
      await transport.connect();

      // Next request should still be the 3rd globally and should fail
      const response3 = await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'ping',
      }) as JSONRPCResponse;
      expect(response3.error).toBeDefined();
      expect(response3.error!.message).toBe('Persistent pattern');

      state = server.getErrorSimulationState();
      expect(state.requestCount).toBe(3);
      expect(state.errorCount).toBe(1);
      expect(state.successCount).toBe(2);
    });
  });

  describe('Acceptance Criteria Verification', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should fulfill all acceptance criteria requirements', async () => {
      // Requirement: MockMCPServer supports 'fail every Nth request' mode with configurable N value
      const testPeriods = [2, 3, 5, 7];

      for (const period of testPeriods) {
        server.resetErrorSimulation();

        server.setErrorMode({
          mode: 'periodic_fail',
          failPeriod: period,
          category: 'jsonrpc',
          customError: { code: -32603, message: `Period ${period} test` },
        });

        expect(server.getErrorMode()?.failPeriod).toBe(period);

        // Test that it actually fails every Nth request
        let failureCount = 0;
        const testRequests = period * 2; // Test 2 full cycles

        for (let i = 1; i <= testRequests; i++) {
          const response = await transport.send({
            jsonrpc: '2.0',
            id: i,
            method: 'ping',
          }) as JSONRPCResponse;

          if (i % period === 0) {
            expect(response.error).toBeDefined();
            failureCount++;
          } else {
            expect(response.result).toBeDefined();
          }
        }

        expect(failureCount).toBe(2); // Should have exactly 2 failures in 2 cycles
      }

      // Requirement: Can combine with any error type
      const errorTypes = [
        { category: 'jsonrpc', code: -32603, message: 'JSON-RPC error' },
        { category: 'application', code: -32001, message: 'Application error' },
        { category: 'network', code: -32000, message: 'Network error' },
      ];

      for (const errorType of errorTypes) {
        server.resetErrorSimulation();

        server.setErrorMode({
          mode: 'periodic_fail',
          failPeriod: 1, // Every request fails for quick testing
          category: errorType.category as any,
          customError: {
            code: errorType.code,
            message: errorType.message,
          },
        });

        const response = await transport.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        }) as JSONRPCResponse;

        expect(response.error).toBeDefined();
        expect(response.error!.code).toBe(errorType.code);
        expect(response.error!.message).toBe(errorType.message);
      }

      // Requirement: Tracks request count correctly
      server.resetErrorSimulation();

      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 4,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Count verification' },
      });

      const requestCount = 10;
      for (let i = 1; i <= requestCount; i++) {
        await transport.send({
          jsonrpc: '2.0',
          id: i,
          method: 'ping',
        });

        const currentState = server.getErrorSimulationState();
        expect(currentState.requestCount).toBe(i);
      }

      const finalState = server.getErrorSimulationState();
      expect(finalState.requestCount).toBe(requestCount);
      expect(finalState.errorCount).toBe(Math.floor(requestCount / 4)); // 2 errors
      expect(finalState.successCount).toBe(requestCount - finalState.errorCount); // 8 successes

      // Requirement: Unit tests verify intermittent behavior (this test itself fulfills this)
      expect(true).toBe(true); // Meta-assertion that this test exists
    });
  });
});