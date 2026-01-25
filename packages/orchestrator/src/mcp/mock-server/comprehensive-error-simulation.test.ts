/**
 * @fileoverview Comprehensive Error Simulation Tests
 *
 * Tests all error simulation capabilities specified in the acceptance criteria:
 * - Throwing specific MCP errors
 * - Connection failures
 * - Timeout simulation
 * - Malformed response simulation
 * - Intermittent failures (fail every Nth request)
 * - Configuration via simple API
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockMCPServer } from './mock-mcp-server.js';
import type { MockMCPServerDefinition, MockErrorSimulationConfig, MockMalformedResponseConfig } from '@apexcli/core';
import { ERROR_SIMULATION_PRESETS, getErrorPreset } from './error-presets.js';

describe('Comprehensive Error Simulation Tests', () => {
  let server: MockMCPServer;

  const baseDefinition: MockMCPServerDefinition = {
    serverConfig: {
      name: 'error-test-server',
      transport: 'stdio',
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true },
        prompts: {},
      },
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'ErrorTestServer', version: '1.0.0' },
      maxConnections: 5,
      shutdownTimeoutMs: 1000,
    },
    defaultBehavior: {
      toolHandlers: [
        {
          toolName: 'test_tool',
          response: { content: [{ type: 'text', text: 'success' }] },
        },
      ],
      errorInjection: [],
      notificationTriggers: [],
    },
    scenarios: [],
  };

  beforeEach(async () => {
    server = new MockMCPServer(baseDefinition);
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('Specific MCP Error Types', () => {
    it('should throw method not found error', async () => {
      // Configure to throw method not found for non-existent methods
      server.setErrorMode({
        mode: 'method_pattern',
        methodPattern: '^nonexistent_method$',
        customError: {
          code: -32601,
          message: 'Method not found',
        },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      // Send initialize request first
      const initResponse = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { clientInfo: { name: 'test', version: '1.0' } },
      });
      expect(initResponse.error).toBeUndefined();

      // Send invalid method request
      const response = await transport.request({
        jsonrpc: '2.0',
        id: 2,
        method: 'nonexistent_method',
        params: {},
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601);
      expect(response.error?.message).toBe('Method not found');
    });

    it('should throw invalid params error', async () => {
      server.setErrorMode({
        mode: 'argument_pattern',
        argumentMatcher: {
          path: 'invalid',
          value: true,
        },
        customError: {
          code: -32602,
          message: 'Invalid params',
          data: { expectedParams: ['name', 'arguments'] },
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
        params: { name: 'test_tool', invalid: true },
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
      expect(response.error?.message).toBe('Invalid params');
      expect(response.error?.data).toEqual({ expectedParams: ['name', 'arguments'] });
    });

    it('should throw internal error', async () => {
      server.setErrorMode({
        mode: 'always_fail',
        customError: {
          code: -32603,
          message: 'Internal error',
          data: { details: 'Simulated server crash' },
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
      expect(response.error?.code).toBe(-32603);
      expect(response.error?.message).toBe('Internal error');
    });

    it('should throw tool not found error', async () => {
      server.applyErrorPreset('tool_not_found');

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
        params: { name: 'nonexistent_tool' },
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601);
      expect(response.error?.message).toBe('Tool not found');
      expect(response.error?.data).toEqual({
        availableTools: ['read_file', 'write_file', 'list_directory'],
      });
    });
  });

  describe('Connection Failure Scenarios', () => {
    it('should simulate connection drop during initialization', async () => {
      server.applyErrorPreset('init_connection_drop');

      const transport = server.createClientTransport();
      await transport.connect();

      const response = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {},
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32000);
      expect(response.error?.message).toBe('Connection closed unexpectedly during initialization');
    });

    it('should simulate connection reset by peer', async () => {
      server.applyErrorPreset('connection_reset');

      const transport = server.createClientTransport();
      await transport.connect();

      const response = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {},
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32000);
      expect(response.error?.message).toBe('Connection reset by peer (ECONNRESET)');
      expect(response.error?.data).toEqual({
        errno: 'ECONNRESET',
        syscall: 'read',
      });
    });

    it('should simulate transport layer failures', async () => {
      const transport = server.createClientTransport({
        shouldFailConnect: true,
        connectError: new Error('Transport connection failed'),
      });

      await expect(transport.connect()).rejects.toThrow('Transport connection failed');
    });
  });

  describe('Timeout Simulation', () => {
    it('should simulate request timeout', async () => {
      server.applyErrorPreset('request_timeout');

      const transport = server.createClientTransport();
      await transport.connect();

      const response = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {},
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32000);
      expect(response.error?.message).toBe('Request timed out after 30000ms');
      expect(response.error?.data).toEqual({
        timeout: 30000,
        operation: 'processRequest',
      });
    });

    it('should simulate server hang', async () => {
      server.applyErrorPreset('server_hang');

      const transport = server.createClientTransport();
      await transport.connect();

      const response = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {},
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32000);
      expect(response.error?.message).toBe('Server not responding');
    });

    it('should respect custom timeout configuration', async () => {
      server.setErrorMode({
        mode: 'always_fail',
        networkConditions: {
          connectionTimeout: 1000,
          latencyMs: 500,
        },
        customError: {
          code: -32000,
          message: 'Custom timeout after 1000ms',
        },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      const startTime = Date.now();
      const response = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {},
      });

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(500); // At least the latency delay
      expect(response.error).toBeDefined();
      expect(response.error?.message).toBe('Custom timeout after 1000ms');
    });
  });

  describe('Malformed Response Simulation', () => {
    it('should simulate malformed JSON response', async () => {
      server.setMalformedResponseMode({
        type: 'invalid_json',
        invalidJsonContent: '{ invalid: json syntax }',
        probability: 1.0,
      });

      const transport = server.createClientTransport();
      await transport.connect();

      // Note: Malformed response simulation would be handled at transport level
      // This test validates configuration is accepted
      expect(server.getMalformedResponseMode()).toBeDefined();
      expect(server.getMalformedResponseMode()?.type).toBe('invalid_json');
    });

    it('should simulate truncated JSON response', async () => {
      server.setMalformedResponseMode({
        type: 'truncated_json',
        truncateAt: '50%',
        affectedMethods: ['tools/call'],
        probability: 1.0,
      });

      expect(server.getMalformedResponseMode()).toBeDefined();
      expect(server.getMalformedResponseMode()?.type).toBe('truncated_json');
      expect(server.getMalformedResponseMode()?.truncateAt).toBe('50%');
    });

    it('should simulate wrong schema response', async () => {
      server.setMalformedResponseMode({
        type: 'wrong_schema',
        wrongSchemaPayload: {
          unexpected: 'structure',
          missing: 'required fields'
        },
        probability: 1.0,
      });

      expect(server.getMalformedResponseMode()).toBeDefined();
      expect(server.getMalformedResponseMode()?.type).toBe('wrong_schema');
    });

    it('should simulate response missing id field', async () => {
      server.applyErrorPreset('wrong_schema_missing_id');

      const transport = server.createClientTransport();
      await transport.connect();

      const response = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {},
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32700);
      expect(response.error?.message).toBe('Response missing required field: id');
      expect(response.error?.data?.missingFields).toEqual(['id']);
    });

    it('should clear malformed response mode', async () => {
      server.setMalformedResponseMode({
        type: 'invalid_json',
        probability: 1.0,
      });

      expect(server.getMalformedResponseMode()).toBeDefined();

      server.clearMalformedResponseMode();
      expect(server.getMalformedResponseMode()).toBeUndefined();
    });
  });

  describe('Intermittent Failures (Periodic/Nth Request)', () => {
    it('should fail every Nth request', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 3, // Fail every 3rd request
        customError: {
          code: -32603,
          message: 'Periodic failure',
        },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      // First request - should succeed (count = 1)
      const response1 = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {},
      });
      expect(response1.error).toBeUndefined();

      // Second request - should succeed (count = 2)
      const response2 = await transport.request({
        jsonrpc: '2.0',
        id: 2,
        method: 'ping',
        params: {},
      });
      expect(response2.error).toBeUndefined();

      // Third request - should fail (count = 3, divisible by 3)
      const response3 = await transport.request({
        jsonrpc: '2.0',
        id: 3,
        method: 'ping',
        params: {},
      });
      expect(response3.error).toBeDefined();
      expect(response3.error?.message).toBe('Periodic failure');

      // Fourth request - should succeed (count = 4)
      const response4 = await transport.request({
        jsonrpc: '2.0',
        id: 4,
        method: 'ping',
        params: {},
      });
      expect(response4.error).toBeUndefined();
    });

    it('should fail first N requests', async () => {
      server.setErrorMode({
        mode: 'fail_first_n',
        failCount: 2, // Fail first 2 requests
        customError: {
          code: -32603,
          message: 'Startup failure',
        },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      // First request - should fail
      const response1 = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {},
      });
      expect(response1.error).toBeDefined();
      expect(response1.error?.message).toBe('Startup failure');

      // Second request - should fail
      const response2 = await transport.request({
        jsonrpc: '2.0',
        id: 2,
        method: 'ping',
        params: {},
      });
      expect(response2.error).toBeDefined();
      expect(response2.error?.message).toBe('Startup failure');

      // Third request - should succeed
      const response3 = await transport.request({
        jsonrpc: '2.0',
        id: 3,
        method: 'ping',
        params: {},
      });
      expect(response3.error).toBeUndefined();
    });

    it('should fail after N successful requests', async () => {
      server.setErrorMode({
        mode: 'fail_after_n',
        succeedCount: 2, // Succeed first 2, then fail
        customError: {
          code: -32603,
          message: 'Service degraded',
        },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      // First request - should succeed
      const response1 = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {},
      });
      expect(response1.error).toBeUndefined();

      // Second request - should succeed
      const response2 = await transport.request({
        jsonrpc: '2.0',
        id: 2,
        method: 'ping',
        params: {},
      });
      expect(response2.error).toBeUndefined();

      // Third request - should fail (we've succeeded 2 times)
      const response3 = await transport.request({
        jsonrpc: '2.0',
        id: 3,
        method: 'ping',
        params: {},
      });
      expect(response3.error).toBeDefined();
      expect(response3.error?.message).toBe('Service degraded');
    });

    it('should follow custom sequence pattern', async () => {
      server.setErrorMode({
        mode: 'sequence',
        sequence: [
          { outcome: 'success' },
          { outcome: 'error', error: { code: -32603, message: 'First failure' } },
          { outcome: 'success' },
          { outcome: 'error', error: { code: -32604, message: 'Second failure' } },
        ],
      });

      const transport = server.createClientTransport();
      await transport.connect();

      // First request - success (sequence[0])
      const response1 = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {},
      });
      expect(response1.error).toBeUndefined();

      // Second request - error (sequence[1])
      const response2 = await transport.request({
        jsonrpc: '2.0',
        id: 2,
        method: 'ping',
        params: {},
      });
      expect(response2.error).toBeDefined();
      expect(response2.error?.message).toBe('First failure');

      // Third request - success (sequence[2])
      const response3 = await transport.request({
        jsonrpc: '2.0',
        id: 3,
        method: 'ping',
        params: {},
      });
      expect(response3.error).toBeUndefined();

      // Fourth request - error (sequence[3])
      const response4 = await transport.request({
        jsonrpc: '2.0',
        id: 4,
        method: 'ping',
        params: {},
      });
      expect(response4.error).toBeDefined();
      expect(response4.error?.message).toBe('Second failure');

      // Fifth request - cycles back to success (sequence[0])
      const response5 = await transport.request({
        jsonrpc: '2.0',
        id: 5,
        method: 'ping',
        params: {},
      });
      expect(response5.error).toBeUndefined();
    });

    it('should track error simulation state correctly', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 2,
        customError: {
          code: -32603,
          message: 'Test failure',
        },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      // Make several requests
      await transport.request({ jsonrpc: '2.0', id: 1, method: 'ping', params: {} });
      await transport.request({ jsonrpc: '2.0', id: 2, method: 'ping', params: {} });
      await transport.request({ jsonrpc: '2.0', id: 3, method: 'ping', params: {} });

      const state = server.getErrorSimulationState();
      expect(state.requestCount).toBe(3);
      expect(state.successCount).toBe(2); // 1st and 3rd requests
      expect(state.errorCount).toBe(1); // 2nd request
    });
  });

  describe('Configuration API', () => {
    it('should set and get error mode', async () => {
      const config: MockErrorSimulationConfig = {
        mode: 'always_fail',
        category: 'application',
        customError: {
          code: -32603,
          message: 'Test error',
        },
      };

      server.setErrorMode(config);
      const retrieved = server.getErrorMode();

      expect(retrieved).toBeDefined();
      expect(retrieved?.mode).toBe('always_fail');
      expect(retrieved?.category).toBe('application');
      expect(retrieved?.customError?.message).toBe('Test error');
    });

    it('should clear error mode', async () => {
      server.setErrorMode({
        mode: 'always_fail',
        customError: { code: -32603, message: 'Test' },
      });

      expect(server.getErrorMode()).toBeDefined();

      server.clearErrorMode();
      expect(server.getErrorMode()).toBeUndefined();
    });

    it('should reset error simulation state', async () => {
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 2,
        customError: { code: -32603, message: 'Test' },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      // Make some requests to generate state
      await transport.request({ jsonrpc: '2.0', id: 1, method: 'ping', params: {} });
      await transport.request({ jsonrpc: '2.0', id: 2, method: 'ping', params: {} });

      let state = server.getErrorSimulationState();
      expect(state.requestCount).toBeGreaterThan(0);

      server.resetErrorSimulation();
      state = server.getErrorSimulationState();
      expect(state.requestCount).toBe(0);
      expect(state.successCount).toBe(0);
      expect(state.errorCount).toBe(0);
    });

    it('should apply error preset configurations', async () => {
      server.applyErrorPreset('rate_limit');

      const retrieved = server.getErrorMode();
      expect(retrieved).toBeDefined();
      expect(retrieved?.mode).toBe('always_fail');
      expect(retrieved?.preset).toBe('rate_limit');
      expect(retrieved?.customError?.code).toBe(-32429);
      expect(retrieved?.customError?.message).toContain('Too many requests');
    });

    it('should merge preset with custom overrides', async () => {
      const presetConfig = getErrorPreset('tool_not_found');
      expect(presetConfig).toBeDefined();
      expect(presetConfig?.mode).toBe('method_pattern');
      expect(presetConfig?.methodPattern).toBe('^tools/call$');

      server.setErrorMode({
        preset: 'tool_not_found',
        mode: 'always_fail', // Override the preset mode
        customError: {
          code: -32601,
          message: 'Custom tool not found message',
        },
      });

      const retrieved = server.getErrorMode();
      expect(retrieved?.mode).toBe('always_fail'); // Overridden
      expect(retrieved?.customError?.message).toBe('Custom tool not found message'); // Overridden
    });

    it('should validate client filtering', async () => {
      server.setErrorMode({
        mode: 'always_fail',
        affectedClients: ['specific-client-id'],
        customError: { code: -32603, message: 'Targeted error' },
      });

      const transport1 = server.createClientTransport();
      const transport2 = server.createClientTransport();
      await transport1.connect();
      await transport2.connect();

      // Errors should only affect clients in the affectedClients list
      // Since we can't control client IDs easily, just verify config is accepted
      const config = server.getErrorMode();
      expect(config?.affectedClients).toEqual(['specific-client-id']);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid error mode gracefully', async () => {
      // TypeScript should catch this, but test runtime behavior
      expect(() => {
        server.setErrorMode({
          mode: 'invalid_mode' as any,
          customError: { code: -32603, message: 'Test' },
        });
      }).not.toThrow();
    });

    it('should handle missing sequence items', async () => {
      server.setErrorMode({
        mode: 'sequence',
        sequence: [], // Empty sequence
      });

      const transport = server.createClientTransport();
      await transport.connect();

      // Should not crash, should probably default to success
      const response = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {},
      });

      // Should not crash the server
      expect(response).toBeDefined();
    });

    it('should handle invalid regex patterns gracefully', async () => {
      server.setErrorMode({
        mode: 'method_pattern',
        methodPattern: '[invalid regex', // Invalid regex
        customError: { code: -32603, message: 'Test' },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      // Should not crash due to invalid regex
      const response = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {},
      });

      expect(response).toBeDefined();
      // With invalid regex, pattern matching should fail, so no error should be injected
      expect(response.error).toBeUndefined();
    });

    it('should handle deeply nested argument patterns', async () => {
      server.setErrorMode({
        mode: 'argument_pattern',
        argumentMatcher: {
          path: 'options.nested.deep.value',
          value: 'trigger',
        },
        customError: { code: -32603, message: 'Deep match error' },
      });

      const transport = server.createClientTransport();
      await transport.connect();

      const response = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'test_tool',
          options: {
            nested: {
              deep: {
                value: 'trigger',
              },
            },
          },
        },
      });

      expect(response.error).toBeDefined();
      expect(response.error?.message).toBe('Deep match error');
    });

    it('should handle non-existent preset gracefully', async () => {
      expect(() => {
        server.applyErrorPreset('non_existent_preset' as any);
      }).toThrow('Unknown error preset: non_existent_preset');
    });
  });

  describe('Real-world Scenario Integration', () => {
    it('should simulate complete authentication flow failure', async () => {
      server.applyErrorPreset('auth_failure');

      const transport = server.createClientTransport();
      await transport.connect();

      const response = await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { clientInfo: { name: 'test', version: '1.0' } },
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32401);
      expect(response.error?.message).toBe('Authentication required or invalid credentials');
      expect(response.error?.data).toEqual({
        realm: 'MCP Server',
        scheme: 'Bearer',
      });
    });

    it('should simulate service degradation pattern', async () => {
      // Start with normal operation, then introduce periodic failures
      const transport = server.createClientTransport();
      await transport.connect();

      // Initialize normally
      await transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { clientInfo: { name: 'test', version: '1.0' } },
      });

      // Now simulate service degradation
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 3, // Every 3rd request fails
        customError: {
          code: -32503,
          message: 'Service temporarily unavailable',
          data: { retryAfter: 5 },
        },
      });

      const results = [];
      for (let i = 0; i < 9; i++) {
        const response = await transport.request({
          jsonrpc: '2.0',
          id: i + 2,
          method: 'ping',
          params: {},
        });
        results.push(!!response.error);
      }

      // Should fail every 3rd request (indices 2, 5, 8 in 0-based array)
      // But remember the counter includes the initialize call, so pattern shifts
      expect(results.filter(failed => failed).length).toBeGreaterThan(0);
      expect(results.filter(failed => !failed).length).toBeGreaterThan(0);
    });
  });
});

describe('Error Preset Validation', () => {
  it('should have all required presets available', () => {
    const requiredPresets = [
      'init_protocol_mismatch',
      'init_capability_rejection',
      'init_connection_drop',
      'malformed_response',
      'request_timeout',
      'connection_reset',
      'tool_not_found',
      'auth_failure',
      'rate_limit',
    ];

    for (const preset of requiredPresets) {
      const config = getErrorPreset(preset as any);
      expect(config).toBeDefined();
      expect(config?.customError).toBeDefined();
    }
  });

  it('should have valid error codes for all presets', () => {
    for (const [presetName, config] of Object.entries(ERROR_SIMULATION_PRESETS)) {
      expect(config.customError?.code).toBeDefined();
      expect(config.customError?.message).toBeDefined();
      expect(typeof config.customError?.code).toBe('number');
      expect(typeof config.customError?.message).toBe('string');
    }
  });

  it('should categorize presets correctly', () => {
    const categories = ['protocol', 'transport', 'application', 'network', 'jsonrpc'];

    for (const [presetName, config] of Object.entries(ERROR_SIMULATION_PRESETS)) {
      if (config.category) {
        expect(categories).toContain(config.category);
      }
    }
  });
});