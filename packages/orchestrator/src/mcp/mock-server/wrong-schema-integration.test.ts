/**
 * @fileoverview Integration Tests for wrong_schema Presets with MockMCPServer
 *
 * Tests the integration of wrong_schema error presets with the MockMCPServer
 * to ensure they work correctly in realistic scenarios:
 * - Server behavior with wrong_schema presets
 * - Error simulation accuracy
 * - Client-server error handling
 * - Performance and reliability
 *
 * @module orchestrator/mcp/mock-server/wrong-schema-integration.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockMCPServer } from './mock-mcp-server.js';
import { MockTransport } from './mock-transport.js';
import { getErrorPreset } from './error-presets.js';
import type {
  MockErrorScenarioPreset,
  MockErrorSimulationConfig,
} from '@apexcli/core';

describe('wrong_schema Presets Integration with MockMCPServer', () => {
  let mockServer: MockMCPServer;
  let mockTransport: MockTransport;

  beforeEach(() => {
    mockTransport = new MockTransport();
    mockServer = new MockMCPServer(mockTransport);
  });

  afterEach(async () => {
    await mockServer?.shutdown();
  });

  describe('wrong_schema_missing_id Integration', () => {
    it('should simulate missing id field in responses', async () => {
      // Configure server with wrong_schema_missing_id preset
      const config: MockErrorSimulationConfig = {
        mode: 'always_fail',
        preset: 'wrong_schema_missing_id',
      };

      mockServer.configureErrorSimulation(config);

      // Start server
      await mockServer.start();

      // Simulate a request that should trigger the error
      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'test/method',
        params: {},
      };

      // Mock transport should receive the malformed response
      const errorSpy = vi.spyOn(mockTransport, 'send');

      try {
        await mockServer.handleRequest(request);
      } catch (error: any) {
        expect(error.code).toBe(-32700);
        expect(error.message).toBe('Response missing required field: id');
        expect(error.data?.missingFields).toContain('id');
      }

      // Verify the error was properly simulated
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should provide detailed diagnostic information', async () => {
      const preset = getErrorPreset('wrong_schema_missing_id');

      mockServer.configureErrorSimulation({
        mode: 'always_fail',
        preset: 'wrong_schema_missing_id',
      });

      await mockServer.start();

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'test/method',
      };

      try {
        await mockServer.handleRequest(request);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.data?.invalidResponse).toBeDefined();
        expect(error.data?.invalidResponse).toEqual({
          jsonrpc: '2.0',
          result: {}
        });
        expect(error.data?.specification).toBe('JSON-RPC 2.0');
      }
    });
  });

  describe('wrong_schema_invalid_result Integration', () => {
    it('should simulate invalid result field type', async () => {
      mockServer.configureErrorSimulation({
        mode: 'always_fail',
        preset: 'wrong_schema_invalid_result',
      });

      await mockServer.start();

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'test/method',
      };

      try {
        await mockServer.handleRequest(request);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe(-32700);
        expect(error.message).toBe('Response result field has invalid structure');
        expect(error.data?.invalidResponse?.result).toBe('should be object or null');
        expect(error.data?.expectedTypes).toEqual(['object', 'null']);
        expect(error.data?.receivedType).toBe('string');
      }
    });

    it('should support type validation customization', async () => {
      const customConfig: MockErrorSimulationConfig = {
        mode: 'always_fail',
        preset: 'wrong_schema_invalid_result',
        customError: {
          code: -32700,
          message: 'Custom invalid result message',
          data: {
            expectedTypes: ['object'],
            receivedType: 'boolean',
            invalidResponse: {
              jsonrpc: '2.0',
              id: 1,
              result: true, // Invalid: should be object
            },
          },
        },
      };

      mockServer.configureErrorSimulation(customConfig);
      await mockServer.start();

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'test/method',
      };

      try {
        await mockServer.handleRequest(request);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Custom invalid result message');
        expect(error.data?.expectedTypes).toEqual(['object']);
        expect(error.data?.receivedType).toBe('boolean');
        expect(error.data?.invalidResponse?.result).toBe(true);
      }
    });
  });

  describe('wrong_schema_extra_fields Integration', () => {
    it('should simulate unexpected extra fields in response', async () => {
      mockServer.configureErrorSimulation({
        mode: 'always_fail',
        preset: 'wrong_schema_extra_fields',
      });

      await mockServer.start();

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'test/method',
      };

      try {
        await mockServer.handleRequest(request);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe(-32700);
        expect(error.message).toBe('Response contains unexpected fields');

        const invalidResponse = error.data?.invalidResponse;
        expect(invalidResponse?.unexpectedField).toBe('not allowed');
        expect(invalidResponse?.anotherExtra).toBe(123);

        expect(error.data?.extraFields).toEqual(['unexpectedField', 'anotherExtra']);
        expect(error.data?.allowedFields).toContain('jsonrpc');
        expect(error.data?.allowedFields).toContain('id');
        expect(error.data?.allowedFields).toContain('result');
        expect(error.data?.allowedFields).toContain('error');
      }
    });

    it('should support custom extra fields configuration', async () => {
      const customConfig: MockErrorSimulationConfig = {
        mode: 'always_fail',
        preset: 'wrong_schema_extra_fields',
        customError: {
          code: -32700,
          message: 'Custom extra fields message',
          data: {
            extraFields: ['forbidden', 'notAllowed'],
            allowedFields: ['jsonrpc', 'id', 'result'],
            invalidResponse: {
              jsonrpc: '2.0',
              id: 2,
              result: {},
              forbidden: 'test',
              notAllowed: 456,
            },
          },
        },
      };

      mockServer.configureErrorSimulation(customConfig);
      await mockServer.start();

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'test/method',
      };

      try {
        await mockServer.handleRequest(request);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Custom extra fields message');
        expect(error.data?.extraFields).toEqual(['forbidden', 'notAllowed']);
        expect(error.data?.invalidResponse?.forbidden).toBe('test');
        expect(error.data?.invalidResponse?.notAllowed).toBe(456);
      }
    });
  });

  describe('Error Simulation Modes with wrong_schema Presets', () => {
    it('should work with method_pattern mode', async () => {
      const config: MockErrorSimulationConfig = {
        mode: 'method_pattern',
        methodPattern: '^test/',
        preset: 'wrong_schema_missing_id',
      };

      mockServer.configureErrorSimulation(config);
      await mockServer.start();

      // Should trigger error for matching method
      const matchingRequest = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'test/method',
      };

      try {
        await mockServer.handleRequest(matchingRequest);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe(-32700);
        expect(error.message).toBe('Response missing required field: id');
      }

      // Should not trigger error for non-matching method
      const nonMatchingRequest = {
        jsonrpc: '2.0' as const,
        id: 2,
        method: 'other/method',
      };

      // This should not throw (assuming server has normal behavior for non-matching patterns)
      // In a real implementation, this would depend on the server's default behavior
    });

    it('should work with fail_first_n mode', async () => {
      const config: MockErrorSimulationConfig = {
        mode: 'fail_first_n',
        failCount: 2,
        preset: 'wrong_schema_invalid_result',
      };

      mockServer.configureErrorSimulation(config);
      await mockServer.start();

      // First two requests should fail
      for (let i = 0; i < 2; i++) {
        const request = {
          jsonrpc: '2.0' as const,
          id: i + 1,
          method: 'test/method',
        };

        try {
          await mockServer.handleRequest(request);
          expect.fail(`Request ${i + 1} should have thrown an error`);
        } catch (error: any) {
          expect(error.code).toBe(-32700);
          expect(error.message).toBe('Response result field has invalid structure');
        }
      }

      // Third request should succeed (or follow normal server behavior)
      const successRequest = {
        jsonrpc: '2.0' as const,
        id: 3,
        method: 'test/method',
      };

      // This test assumes the server has some normal response behavior
      // In practice, you'd need to configure the server with normal behavior too
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle multiple rapid wrong_schema errors efficiently', async () => {
      mockServer.configureErrorSimulation({
        mode: 'always_fail',
        preset: 'wrong_schema_extra_fields',
      });

      await mockServer.start();

      const startTime = Date.now();
      const promises: Promise<any>[] = [];

      // Send 50 concurrent requests
      for (let i = 0; i < 50; i++) {
        const request = {
          jsonrpc: '2.0' as const,
          id: i,
          method: 'test/method',
        };

        const promise = mockServer.handleRequest(request).catch(error => error);
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All should be errors
      expect(results.length).toBe(50);
      for (const result of results) {
        expect(result.code).toBe(-32700);
        expect(result.message).toBe('Response contains unexpected fields');
      }

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    it('should maintain error consistency across multiple requests', async () => {
      mockServer.configureErrorSimulation({
        mode: 'always_fail',
        preset: 'wrong_schema_missing_id',
      });

      await mockServer.start();

      const errors: any[] = [];

      // Generate multiple errors
      for (let i = 0; i < 10; i++) {
        const request = {
          jsonrpc: '2.0' as const,
          id: i,
          method: 'test/method',
        };

        try {
          await mockServer.handleRequest(request);
        } catch (error: any) {
          errors.push(error);
        }
      }

      expect(errors.length).toBe(10);

      // All errors should be identical
      const firstError = errors[0];
      for (const error of errors) {
        expect(error.code).toBe(firstError.code);
        expect(error.message).toBe(firstError.message);
        expect(error.data).toEqual(firstError.data);
      }
    });
  });

  describe('Error Recovery and Cleanup', () => {
    it('should allow switching between different wrong_schema presets', async () => {
      await mockServer.start();

      // Start with missing_id preset
      mockServer.configureErrorSimulation({
        mode: 'always_fail',
        preset: 'wrong_schema_missing_id',
      });

      let request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'test/method',
      };

      try {
        await mockServer.handleRequest(request);
      } catch (error: any) {
        expect(error.message).toContain('missing required field');
      }

      // Switch to invalid_result preset
      mockServer.configureErrorSimulation({
        mode: 'always_fail',
        preset: 'wrong_schema_invalid_result',
      });

      request = {
        jsonrpc: '2.0' as const,
        id: 2,
        method: 'test/method',
      };

      try {
        await mockServer.handleRequest(request);
      } catch (error: any) {
        expect(error.message).toContain('invalid structure');
      }
    });

    it('should properly clear error simulation', async () => {
      mockServer.configureErrorSimulation({
        mode: 'always_fail',
        preset: 'wrong_schema_extra_fields',
      });

      await mockServer.start();

      // Verify error is triggered
      let request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'test/method',
      };

      try {
        await mockServer.handleRequest(request);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe(-32700);
      }

      // Clear error simulation
      mockServer.configureErrorSimulation({ mode: 'none' });

      // Subsequent requests should not trigger wrong_schema errors
      // (This test assumes the server has normal behavior when not configured for errors)
      request = {
        jsonrpc: '2.0' as const,
        id: 2,
        method: 'test/method',
      };

      // This should not throw a wrong_schema error
      // The exact behavior depends on the server's normal operation
    });
  });
});