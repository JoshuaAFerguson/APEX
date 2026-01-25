/**
 * @fileoverview Tests for MockMCPServer Error Simulation Infrastructure
 *
 * Tests the comprehensive error simulation infrastructure including:
 * - Error simulation mode configuration (setErrorMode, clearErrorMode, getErrorMode)
 * - Error scenario presets (applyErrorPreset, preset configurations)
 * - Error simulation modes (always_fail, periodic_fail, fail_first_n, etc.)
 * - Error simulation state tracking
 * - Network conditions simulation
 * - Client-specific error targeting
 * - Integration with behavior engine
 *
 * @module orchestrator/mcp/mock-server/mock-error-simulation.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockMCPServer } from './mock-mcp-server.js';
import type {
  MockMCPServerDefinition,
  MockErrorSimulationConfig,
  MockErrorScenarioPreset,
} from '@apexcli/core';
import type { JSONRPCRequest, JSONRPCResponse } from '../types.js';

describe('MockMCPServer - Error Simulation Infrastructure', () => {
  let server: MockMCPServer;
  let serverDefinition: MockMCPServerDefinition;

  beforeEach(async () => {
    serverDefinition = {
      serverConfig: {
        name: 'error-sim-test-server',
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

  describe('Error Mode Configuration', () => {
    it('should initially have no error mode configured', () => {
      expect(server.getErrorMode()).toBeUndefined();

      const errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(0);
      expect(errorState.errorCount).toBe(0);
      expect(errorState.successCount).toBe(0);
    });

    it('should configure error mode successfully', () => {
      const errorConfig: MockErrorSimulationConfig = {
        mode: 'always_fail',
        category: 'jsonrpc',
        customError: {
          code: -32603,
          message: 'Simulated error for testing',
        },
      };

      server.setErrorMode(errorConfig);

      const configuredMode = server.getErrorMode();
      expect(configuredMode).toEqual(errorConfig);
    });

    it('should clear error mode successfully', () => {
      const errorConfig: MockErrorSimulationConfig = {
        mode: 'always_fail',
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Test error' },
      };

      server.setErrorMode(errorConfig);
      expect(server.getErrorMode()).toBeDefined();

      server.clearErrorMode();
      expect(server.getErrorMode()).toBeUndefined();

      const errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(0);
      expect(errorState.errorCount).toBe(0);
      expect(errorState.successCount).toBe(0);
    });

    it('should emit scenario:activated event when setting error mode', () => {
      const scenarioActivatedSpy = vi.fn();
      server.on('scenario:activated', scenarioActivatedSpy);

      server.setErrorMode({
        mode: 'always_fail',
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Test error' },
      });

      expect(scenarioActivatedSpy).toHaveBeenCalledWith('error:always_fail');
    });
  });

  describe('Error Simulation Modes', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    describe('always_fail mode', () => {
      it('should fail all requests', async () => {
        server.setErrorMode({
          mode: 'always_fail',
          category: 'jsonrpc',
          customError: { code: -32603, message: 'Always fail test' },
        });

        const request: JSONRPCRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        };

        const response = await transport.send(request) as JSONRPCResponse;

        expect(response.error).toBeDefined();
        expect(response.error!.code).toBe(-32603);
        expect(response.error!.message).toBe('Always fail test');

        const errorState = server.getErrorSimulationState();
        expect(errorState.requestCount).toBe(1);
        expect(errorState.errorCount).toBe(1);
        expect(errorState.successCount).toBe(0);
      });
    });

    describe('periodic_fail mode', () => {
      it('should fail every Nth request based on failPeriod', async () => {
        server.setErrorMode({
          mode: 'periodic_fail',
          failPeriod: 3, // Fail every 3rd request
          category: 'jsonrpc',
          customError: { code: -32603, message: 'Periodic fail test' },
        });

        const request: JSONRPCRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        };

        // First two requests should succeed
        for (let i = 1; i <= 2; i++) {
          const response = await transport.send({ ...request, id: i }) as JSONRPCResponse;
          expect(response.result).toBeDefined();
          expect(response.error).toBeUndefined();
        }

        // Third request should fail
        const thirdResponse = await transport.send({ ...request, id: 3 }) as JSONRPCResponse;
        expect(thirdResponse.error).toBeDefined();
        expect(thirdResponse.error!.message).toBe('Periodic fail test');

        const errorState = server.getErrorSimulationState();
        expect(errorState.requestCount).toBe(3);
        expect(errorState.errorCount).toBe(1);
        expect(errorState.successCount).toBe(2);
      });
    });

    describe('fail_first_n mode', () => {
      it('should fail only the first N requests', async () => {
        server.setErrorMode({
          mode: 'fail_first_n',
          failCount: 2, // Fail first 2 requests
          category: 'jsonrpc',
          customError: { code: -32603, message: 'Fail first N test' },
        });

        const request: JSONRPCRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        };

        // First two requests should fail
        for (let i = 1; i <= 2; i++) {
          const response = await transport.send({ ...request, id: i }) as JSONRPCResponse;
          expect(response.error).toBeDefined();
          expect(response.error!.message).toBe('Fail first N test');
        }

        // Third request should succeed
        const thirdResponse = await transport.send({ ...request, id: 3 }) as JSONRPCResponse;
        expect(thirdResponse.result).toBeDefined();
        expect(thirdResponse.error).toBeUndefined();

        const errorState = server.getErrorSimulationState();
        expect(errorState.requestCount).toBe(3);
        expect(errorState.errorCount).toBe(2);
        expect(errorState.successCount).toBe(1);
      });
    });

    describe('fail_after_n mode', () => {
      it('should fail requests after N successful ones', async () => {
        server.setErrorMode({
          mode: 'fail_after_n',
          succeedCount: 2, // Succeed first 2 requests, then fail
          category: 'jsonrpc',
          customError: { code: -32603, message: 'Fail after N test' },
        });

        const request: JSONRPCRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        };

        // First two requests should succeed
        for (let i = 1; i <= 2; i++) {
          const response = await transport.send({ ...request, id: i }) as JSONRPCResponse;
          expect(response.result).toBeDefined();
          expect(response.error).toBeUndefined();
        }

        // Third request should fail
        const thirdResponse = await transport.send({ ...request, id: 3 }) as JSONRPCResponse;
        expect(thirdResponse.error).toBeDefined();
        expect(thirdResponse.error!.message).toBe('Fail after N test');

        const errorState = server.getErrorSimulationState();
        expect(errorState.requestCount).toBe(3);
        expect(errorState.errorCount).toBe(1);
        expect(errorState.successCount).toBe(2);
      });
    });

    describe('method_pattern mode', () => {
      it('should fail requests matching method pattern', async () => {
        server.setErrorMode({
          mode: 'method_pattern',
          methodPattern: '^tools/', // Fail requests to tools/* methods
          category: 'jsonrpc',
          customError: { code: -32603, message: 'Method pattern test' },
        });

        // ping should succeed (doesn't match pattern)
        const pingResponse = await transport.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        }) as JSONRPCResponse;
        expect(pingResponse.result).toBeDefined();
        expect(pingResponse.error).toBeUndefined();

        // tools/list should fail (matches pattern)
        const toolsListResponse = await transport.send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
        }) as JSONRPCResponse;
        expect(toolsListResponse.error).toBeDefined();
        expect(toolsListResponse.error!.message).toBe('Method pattern test');

        const errorState = server.getErrorSimulationState();
        expect(errorState.requestCount).toBe(2);
        expect(errorState.errorCount).toBe(1);
        expect(errorState.successCount).toBe(1);
      });

      it('should handle invalid regex patterns gracefully', async () => {
        server.setErrorMode({
          mode: 'method_pattern',
          methodPattern: '[invalid(regex',
          category: 'jsonrpc',
          customError: { code: -32603, message: 'Invalid regex test' },
        });

        // Request should succeed since regex is invalid
        const response = await transport.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        }) as JSONRPCResponse;
        expect(response.result).toBeDefined();
        expect(response.error).toBeUndefined();
      });
    });

    describe('argument_pattern mode', () => {
      it('should fail requests with matching argument patterns', async () => {
        server.setErrorMode({
          mode: 'argument_pattern',
          argumentMatcher: {
            path: 'name',
            value: 'fail_tool',
          },
          category: 'jsonrpc',
          customError: { code: -32603, message: 'Argument pattern test' },
        });

        // tools/call with different tool should succeed
        const successResponse = await transport.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'test_tool', arguments: {} },
        }) as JSONRPCResponse;
        expect(successResponse.result).toBeDefined();
        expect(successResponse.error).toBeUndefined();

        // tools/call with fail_tool should fail
        const failResponse = await transport.send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'fail_tool', arguments: {} },
        }) as JSONRPCResponse;
        expect(failResponse.error).toBeDefined();
        expect(failResponse.error!.message).toBe('Argument pattern test');

        const errorState = server.getErrorSimulationState();
        expect(errorState.requestCount).toBe(2);
        expect(errorState.errorCount).toBe(1);
        expect(errorState.successCount).toBe(1);
      });

      it('should handle nested argument paths', async () => {
        server.setErrorMode({
          mode: 'argument_pattern',
          argumentMatcher: {
            path: 'options.verbose',
            value: true,
          },
          category: 'jsonrpc',
          customError: { code: -32603, message: 'Nested argument test' },
        });

        // Request without nested path should succeed
        const successResponse = await transport.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'test_tool', arguments: {} },
        }) as JSONRPCResponse;
        expect(successResponse.result).toBeDefined();

        // Request with matching nested path should fail
        const failResponse = await transport.send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'test_tool', options: { verbose: true } },
        }) as JSONRPCResponse;
        expect(failResponse.error).toBeDefined();
        expect(failResponse.error!.message).toBe('Nested argument test');
      });
    });

    describe('sequence mode', () => {
      it('should follow predefined sequence of outcomes', async () => {
        server.setErrorMode({
          mode: 'sequence',
          sequence: [
            { outcome: 'error', error: { code: -32603, message: 'First error' } },
            { outcome: 'success' },
            { outcome: 'error', error: { code: -32604, message: 'Second error' } },
            { outcome: 'success' },
          ],
        });

        // First request - should fail with first error
        const response1 = await transport.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        }) as JSONRPCResponse;
        expect(response1.error).toBeDefined();
        expect(response1.error!.message).toBe('First error');

        // Second request - should succeed
        const response2 = await transport.send({
          jsonrpc: '2.0',
          id: 2,
          method: 'ping',
        }) as JSONRPCResponse;
        expect(response2.result).toBeDefined();

        // Third request - should fail with second error
        const response3 = await transport.send({
          jsonrpc: '2.0',
          id: 3,
          method: 'ping',
        }) as JSONRPCResponse;
        expect(response3.error).toBeDefined();
        expect(response3.error!.message).toBe('Second error');

        // Fourth request - should succeed
        const response4 = await transport.send({
          jsonrpc: '2.0',
          id: 4,
          method: 'ping',
        }) as JSONRPCResponse;
        expect(response4.result).toBeDefined();

        const errorState = server.getErrorSimulationState();
        expect(errorState.requestCount).toBe(4);
        expect(errorState.errorCount).toBe(2);
        expect(errorState.successCount).toBe(2);
      });

      it('should cycle through sequence when reaching the end', async () => {
        server.setErrorMode({
          mode: 'sequence',
          sequence: [
            { outcome: 'error', error: { code: -32603, message: 'Cycle error' } },
            { outcome: 'success' },
          ],
        });

        // First two requests - initial sequence
        await transport.send({ jsonrpc: '2.0', id: 1, method: 'ping' });
        await transport.send({ jsonrpc: '2.0', id: 2, method: 'ping' });

        // Third request - should start cycle again (error)
        const response3 = await transport.send({
          jsonrpc: '2.0',
          id: 3,
          method: 'ping',
        }) as JSONRPCResponse;
        expect(response3.error).toBeDefined();
        expect(response3.error!.message).toBe('Cycle error');

        // Fourth request - should be success again
        const response4 = await transport.send({
          jsonrpc: '2.0',
          id: 4,
          method: 'ping',
        }) as JSONRPCResponse;
        expect(response4.result).toBeDefined();
      });
    });
  });

  describe('Error Presets', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should apply init_protocol_mismatch preset correctly', async () => {
      server.applyErrorPreset('init_protocol_mismatch');

      const initRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
      };

      const response = await transport.send(initRequest) as JSONRPCResponse;

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32600);
      expect(response.error!.message).toContain('Protocol version not supported');
      expect(response.error!.data).toEqual({
        supportedVersions: ['2024-11-05'],
        requestedVersion: 'unknown',
      });
    });

    it('should apply tool_not_found preset correctly', async () => {
      server.applyErrorPreset('tool_not_found');

      const toolCallRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'nonexistent_tool', arguments: {} },
      };

      const response = await transport.send(toolCallRequest) as JSONRPCResponse;

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32601);
      expect(response.error!.message).toBe('Tool not found');
      expect(response.error!.data).toEqual({
        availableTools: ['read_file', 'write_file', 'list_directory'],
      });
    });

    it('should apply rate_limit preset correctly', async () => {
      server.applyErrorPreset('rate_limit');

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      };

      const response = await transport.send(request) as JSONRPCResponse;

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32429);
      expect(response.error!.message).toContain('Too many requests');
      expect(response.error!.data).toHaveProperty('retryAfter', 60);
    });

    it('should throw error for unknown preset', () => {
      expect(() => {
        server.applyErrorPreset('unknown_preset' as any);
      }).toThrow('Unknown error preset: unknown_preset');
    });
  });

  describe('Network Conditions Simulation', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should apply network latency from error config', async () => {
      server.setErrorMode({
        mode: 'always_fail',
        category: 'network',
        networkConditions: {
          latencyMs: 100,
        },
        customError: { code: -32603, message: 'Network delay test' },
      });

      const startTime = Date.now();
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      });
      const elapsed = Date.now() - startTime;

      // Should have at least the configured latency
      expect(elapsed).toBeGreaterThanOrEqual(95); // Allow some tolerance
    });

    it('should handle request_timeout preset with network conditions', async () => {
      server.applyErrorPreset('request_timeout');

      const config = server.getErrorMode();
      expect(config?.networkConditions?.connectionTimeout).toBe(1);
      expect(config?.customError?.message).toContain('Request timed out');
    });
  });

  describe('Client-Specific Error Targeting', () => {
    let transport1: any;
    let transport2: any;

    beforeEach(async () => {
      transport1 = server.createClientTransport();
      transport2 = server.createClientTransport();
      await transport1.connect();
      await transport2.connect();
    });

    it('should affect all clients by default', async () => {
      server.setErrorMode({
        mode: 'always_fail',
        affectedClients: 'all',
        category: 'jsonrpc',
        customError: { code: -32603, message: 'All clients error' },
      });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      };

      const response1 = await transport1.send(request) as JSONRPCResponse;
      const response2 = await transport2.send(request) as JSONRPCResponse;

      expect(response1.error).toBeDefined();
      expect(response2.error).toBeDefined();
      expect(response1.error!.message).toBe('All clients error');
      expect(response2.error!.message).toBe('All clients error');
    });

    it('should target specific clients when configured', async () => {
      // Get client IDs
      const clients = server.getConnectedClients();
      expect(clients).toHaveLength(2);

      const client1Id = clients[0].id;

      server.setErrorMode({
        mode: 'always_fail',
        affectedClients: [client1Id],
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Targeted error' },
      });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      };

      const response1 = await transport1.send(request) as JSONRPCResponse;
      const response2 = await transport2.send(request) as JSONRPCResponse;

      // Client 1 should get error, client 2 should succeed
      expect(response1.error).toBeDefined();
      expect(response1.error!.message).toBe('Targeted error');

      expect(response2.error).toBeUndefined();
      expect(response2.result).toBeDefined();
    });
  });

  describe('Error State Tracking', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should track error simulation state correctly', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 2, // Fail every 2nd request
        category: 'jsonrpc',
        customError: { code: -32603, message: 'State tracking test' },
      });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      };

      // Send 4 requests
      for (let i = 1; i <= 4; i++) {
        await transport.send({ ...request, id: i });
      }

      const errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(4);
      expect(errorState.errorCount).toBe(2); // 2nd and 4th requests failed
      expect(errorState.successCount).toBe(2); // 1st and 3rd requests succeeded
      expect(errorState.startTime).toBeGreaterThan(0);
    });

    it('should reset state when clearing error mode', async () => {
      server.setErrorMode({
        mode: 'always_fail',
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Reset test' },
      });

      // Make some requests to accumulate state
      await transport.send({ jsonrpc: '2.0', id: 1, method: 'ping' });
      await transport.send({ jsonrpc: '2.0', id: 2, method: 'ping' });

      let errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBeGreaterThan(0);

      server.clearErrorMode();

      errorState = server.getErrorSimulationState();
      expect(errorState.requestCount).toBe(0);
      expect(errorState.errorCount).toBe(0);
      expect(errorState.successCount).toBe(0);
      expect(errorState.startTime).toBe(0);
    });
  });

  describe('Preset Configuration Merging', () => {
    it('should merge preset with custom overrides correctly', () => {
      // Use preset but override the error message
      server.setErrorMode({
        mode: 'always_fail',
        preset: 'rate_limit',
        customError: {
          code: -32429,
          message: 'Custom rate limit message',
          data: { customField: 'custom value' },
        },
      });

      const config = server.getErrorMode();
      expect(config?.customError?.message).toBe('Custom rate limit message');
      expect(config?.customError?.code).toBe(-32429);
      expect(config?.customError?.data).toEqual({ customField: 'custom value' });
      expect(config?.category).toBe('application'); // From preset
    });

    it('should merge network conditions from preset and overrides', () => {
      server.setErrorMode({
        preset: 'request_timeout',
        networkConditions: {
          latencyMs: 200, // Override preset value
          bandwidth: 1000, // Add new value
        },
      });

      const config = server.getErrorMode();
      expect(config?.networkConditions?.connectionTimeout).toBe(1); // From preset
      expect(config?.networkConditions?.latencyMs).toBe(200); // Override
      expect(config?.networkConditions?.bandwidth).toBe(1000); // Added
    });
  });

  describe('Error Injection Integration', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should emit error:injected event for simulated errors', async () => {
      const errorInjectedSpy = vi.fn();
      server.on('error:injected', errorInjectedSpy);

      server.setErrorMode({
        mode: 'always_fail',
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Injection test' },
      });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      };

      await transport.send(request);

      expect(errorInjectedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'ping' }),
        expect.objectContaining({
          shouldInject: true,
          errorCode: -32603,
          errorMessage: 'Injection test',
        })
      );
    });

    it('should work with behavior engine error injection', async () => {
      // Test that error simulation works alongside existing error injection
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 2,
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Simulation error' },
      });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      };

      // First request should succeed
      const response1 = await transport.send(request) as JSONRPCResponse;
      expect(response1.result).toBeDefined();

      // Second request should fail due to periodic simulation
      const response2 = await transport.send({ ...request, id: 2 }) as JSONRPCResponse;
      expect(response2.error).toBeDefined();
      expect(response2.error!.message).toBe('Simulation error');
    });
  });
});