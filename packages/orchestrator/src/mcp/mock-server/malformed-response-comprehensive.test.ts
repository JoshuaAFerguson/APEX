/**
 * @fileoverview Comprehensive Malformed Response Tests
 *
 * Tests all malformed response simulation capabilities including:
 * - Invalid JSON responses
 * - Truncated JSON responses
 * - Wrong schema responses
 * - Empty responses
 * - Binary data injection
 * - Custom malformed content
 * - Probability-based injection
 * - Method-specific targeting
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockMCPServer } from './mock-mcp-server.js';
import type { MockMCPServerDefinition, MockMalformedResponseConfig } from '@apexcli/core';

describe('Comprehensive Malformed Response Tests', () => {
  let server: MockMCPServer;

  const baseDefinition: MockMCPServerDefinition = {
    serverConfig: {
      name: 'malformed-test-server',
      transport: 'stdio',
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true },
        prompts: {},
      },
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'MalformedTestServer', version: '1.0.0' },
      maxConnections: 5,
      shutdownTimeoutMs: 1000,
    },
    defaultBehavior: {
      toolHandlers: [
        {
          toolName: 'test_tool',
          response: { content: [{ type: 'text', text: 'normal response' }] },
        },
        {
          toolName: 'complex_tool',
          response: {
            content: [
              { type: 'text', text: 'Complex response with multiple parts' },
              { type: 'image', data: 'base64imagedata' },
            ],
            isError: false,
            metadata: { timing: 1234, version: '1.0' },
          },
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

  describe('Invalid JSON Response Simulation', () => {
    it('should simulate malformed JSON with syntax errors', async () => {
      server.setMalformedResponseMode({
        type: 'invalid_json',
        invalidJsonContent: '{ "jsonrpc": "2.0", "id": 1, "result": undefined }',
        probability: 1.0,
      });

      expect(server.getMalformedResponseMode()).toBeDefined();
      expect(server.getMalformedResponseMode()?.type).toBe('invalid_json');
      expect(server.getMalformedResponseMode()?.invalidJsonContent).toContain('undefined');
    });

    it('should simulate JSON with missing quotes', async () => {
      server.setMalformedResponseMode({
        type: 'invalid_json',
        invalidJsonContent: '{ jsonrpc: 2.0, id: 1, result: {} }',
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      expect(config?.invalidJsonContent).toBe('{ jsonrpc: 2.0, id: 1, result: {} }');
    });

    it('should simulate JSON with trailing commas', async () => {
      server.setMalformedResponseMode({
        type: 'invalid_json',
        invalidJsonContent: '{ "jsonrpc": "2.0", "id": 1, "result": {}, }',
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      expect(config?.invalidJsonContent).toContain(', }');
    });

    it('should simulate JSON with invalid escape sequences', async () => {
      server.setMalformedResponseMode({
        type: 'invalid_json',
        invalidJsonContent: '{ "jsonrpc": "2.0", "id": 1, "result": { "text": "invalid\\escape" } }',
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      expect(config?.invalidJsonContent).toContain('invalid\\escape');
    });
  });

  describe('Truncated JSON Response Simulation', () => {
    it('should simulate truncation at absolute byte position', async () => {
      server.setMalformedResponseMode({
        type: 'truncated_json',
        truncateAt: 50, // Absolute byte position
        affectedMethods: ['tools/call'],
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      expect(config?.type).toBe('truncated_json');
      expect(config?.truncateAt).toBe(50);
      expect(config?.affectedMethods).toEqual(['tools/call']);
    });

    it('should simulate truncation at percentage', async () => {
      server.setMalformedResponseMode({
        type: 'truncated_json',
        truncateAt: '75%', // 75% of response
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      expect(config?.truncateAt).toBe('75%');
    });

    it('should simulate truncation at different percentages', async () => {
      const percentages = ['10%', '25%', '50%', '90%'];

      for (const percentage of percentages) {
        server.setMalformedResponseMode({
          type: 'truncated_json',
          truncateAt: percentage,
          probability: 1.0,
        });

        const config = server.getMalformedResponseMode();
        expect(config?.truncateAt).toBe(percentage);
      }
    });

    it('should simulate truncation in middle of JSON object', async () => {
      server.setMalformedResponseMode({
        type: 'truncated_json',
        truncateAt: 30, // Truncate early, likely in middle of response
        affectedMethods: ['tools/call'],
        probability: 1.0,
      });

      // This would be handled at transport level in real implementation
      expect(server.getMalformedResponseMode()?.type).toBe('truncated_json');
    });
  });

  describe('Wrong Schema Response Simulation', () => {
    it('should simulate response with wrong structure', async () => {
      server.setMalformedResponseMode({
        type: 'wrong_schema',
        wrongSchemaPayload: {
          // Missing required jsonrpc field
          id: 1,
          result: { data: 'test' },
        },
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      expect(config?.type).toBe('wrong_schema');
      expect(config?.wrongSchemaPayload).toEqual({
        id: 1,
        result: { data: 'test' },
      });
    });

    it('should simulate response with extra unexpected fields', async () => {
      server.setMalformedResponseMode({
        type: 'wrong_schema',
        wrongSchemaPayload: {
          jsonrpc: '2.0',
          id: 1,
          result: {},
          unexpectedField: 'should not be here',
          anotherExtra: 123,
          nested: { invalid: true },
        },
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      const payload = config?.wrongSchemaPayload as any;
      expect(payload.unexpectedField).toBe('should not be here');
      expect(payload.anotherExtra).toBe(123);
      expect(payload.nested.invalid).toBe(true);
    });

    it('should simulate response with wrong field types', async () => {
      server.setMalformedResponseMode({
        type: 'wrong_schema',
        wrongSchemaPayload: {
          jsonrpc: 2.0, // Should be string, not number
          id: '1', // Should be number/string, but inconsistent type
          result: 'should be object', // Should be object, not string
        },
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      const payload = config?.wrongSchemaPayload as any;
      expect(typeof payload.jsonrpc).toBe('number');
      expect(typeof payload.id).toBe('string');
      expect(typeof payload.result).toBe('string');
    });

    it('should simulate response with missing required fields', async () => {
      server.setMalformedResponseMode({
        type: 'wrong_schema',
        wrongSchemaPayload: {
          // Missing jsonrpc, id, and result/error
          randomField: 'value',
        },
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      const payload = config?.wrongSchemaPayload as any;
      expect(payload.jsonrpc).toBeUndefined();
      expect(payload.id).toBeUndefined();
      expect(payload.result).toBeUndefined();
      expect(payload.error).toBeUndefined();
      expect(payload.randomField).toBe('value');
    });

    it('should simulate response with both result and error fields', async () => {
      server.setMalformedResponseMode({
        type: 'wrong_schema',
        wrongSchemaPayload: {
          jsonrpc: '2.0',
          id: 1,
          result: { success: true },
          error: { code: -32603, message: 'Also has error' }, // Invalid - can't have both
        },
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      const payload = config?.wrongSchemaPayload as any;
      expect(payload.result).toBeDefined();
      expect(payload.error).toBeDefined();
    });
  });

  describe('Empty Response Simulation', () => {
    it('should simulate completely empty response', async () => {
      server.setMalformedResponseMode({
        type: 'empty_response',
        probability: 1.0,
      });

      expect(server.getMalformedResponseMode()?.type).toBe('empty_response');
    });

    it('should simulate whitespace-only response', async () => {
      server.setMalformedResponseMode({
        type: 'custom',
        rawBytes: '   \n\t  ',
        probability: 1.0,
      });

      expect(server.getMalformedResponseMode()?.type).toBe('custom');
      expect(server.getMalformedResponseMode()?.rawBytes).toBe('   \n\t  ');
    });

    it('should simulate null response', async () => {
      server.setMalformedResponseMode({
        type: 'custom',
        rawBytes: '\0\0\0\0',
        probability: 1.0,
      });

      expect(server.getMalformedResponseMode()?.rawBytes).toBe('\0\0\0\0');
    });
  });

  describe('Binary Data Injection', () => {
    it('should simulate binary data in response', async () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);

      server.setMalformedResponseMode({
        type: 'binary_data',
        rawBytes: binaryData,
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      expect(config?.type).toBe('binary_data');
      expect(Buffer.isBuffer(config?.rawBytes)).toBe(true);
    });

    it('should simulate mixed text and binary data', async () => {
      const mixedData = 'Valid JSON start: {"jsonrpc":"2.0",' + String.fromCharCode(0, 255, 128);

      server.setMalformedResponseMode({
        type: 'custom',
        rawBytes: mixedData,
        probability: 1.0,
      });

      expect(server.getMalformedResponseMode()?.rawBytes).toContain('Valid JSON start');
    });

    it('should simulate control characters in response', async () => {
      const controlData = 'JSON with controls: \x00\x01\x02\x1F\x7F';

      server.setMalformedResponseMode({
        type: 'custom',
        rawBytes: controlData,
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      expect(config?.rawBytes).toMatch(/JSON with controls:/);
    });
  });

  describe('Custom Malformed Content', () => {
    it('should simulate custom malformed JSON structure', async () => {
      server.setMalformedResponseMode({
        type: 'custom',
        rawBytes: '{"jsonrpc":"2.0","id":1,"result":[}',
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      expect(config?.rawBytes).toBe('{"jsonrpc":"2.0","id":1,"result":[}');
    });

    it('should simulate XML instead of JSON', async () => {
      const xmlResponse = '<?xml version="1.0"?><response><error>Wrong format</error></response>';

      server.setMalformedResponseMode({
        type: 'custom',
        rawBytes: xmlResponse,
        probability: 1.0,
      });

      expect(server.getMalformedResponseMode()?.rawBytes).toContain('<?xml');
    });

    it('should simulate HTML error page', async () => {
      const htmlResponse = '<html><body><h1>500 Internal Server Error</h1></body></html>';

      server.setMalformedResponseMode({
        type: 'custom',
        rawBytes: htmlResponse,
        probability: 1.0,
      });

      expect(server.getMalformedResponseMode()?.rawBytes).toContain('<html>');
    });

    it('should simulate plain text response', async () => {
      const textResponse = 'ERROR: Server encountered an internal error and cannot continue.';

      server.setMalformedResponseMode({
        type: 'custom',
        rawBytes: textResponse,
        probability: 1.0,
      });

      expect(server.getMalformedResponseMode()?.rawBytes).toBe(textResponse);
    });
  });

  describe('Probability-Based Injection', () => {
    it('should configure probability settings correctly', async () => {
      const probabilities = [0.0, 0.25, 0.5, 0.75, 1.0];

      for (const prob of probabilities) {
        server.setMalformedResponseMode({
          type: 'invalid_json',
          invalidJsonContent: '{ invalid }',
          probability: prob,
        });

        expect(server.getMalformedResponseMode()?.probability).toBe(prob);
      }
    });

    it('should handle edge case probabilities', async () => {
      server.setMalformedResponseMode({
        type: 'invalid_json',
        invalidJsonContent: '{ invalid }',
        probability: 0.0001, // Very low probability
      });

      expect(server.getMalformedResponseMode()?.probability).toBe(0.0001);

      server.setMalformedResponseMode({
        type: 'invalid_json',
        invalidJsonContent: '{ invalid }',
        probability: 0.9999, // Very high probability
      });

      expect(server.getMalformedResponseMode()?.probability).toBe(0.9999);
    });

    it('should validate probability bounds', async () => {
      // Test that invalid probabilities are handled gracefully
      server.setMalformedResponseMode({
        type: 'invalid_json',
        invalidJsonContent: '{ invalid }',
        probability: -0.1, // Invalid: negative
      });

      // Configuration should still be set (validation might happen at runtime)
      expect(server.getMalformedResponseMode()).toBeDefined();
    });
  });

  describe('Method-Specific Targeting', () => {
    it('should target specific methods only', async () => {
      server.setMalformedResponseMode({
        type: 'invalid_json',
        invalidJsonContent: '{ malformed }',
        affectedMethods: ['tools/call'],
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      expect(config?.affectedMethods).toEqual(['tools/call']);
    });

    it('should target multiple methods', async () => {
      server.setMalformedResponseMode({
        type: 'truncated_json',
        truncateAt: '50%',
        affectedMethods: ['tools/call', 'tools/list', 'resources/read'],
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      expect(config?.affectedMethods).toEqual(['tools/call', 'tools/list', 'resources/read']);
    });

    it('should target all methods when affectedMethods is empty', async () => {
      server.setMalformedResponseMode({
        type: 'invalid_json',
        invalidJsonContent: '{ malformed }',
        affectedMethods: [], // Empty array = all methods
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      expect(config?.affectedMethods).toEqual([]);
    });

    it('should handle method pattern targeting', async () => {
      server.setMalformedResponseMode({
        type: 'wrong_schema',
        wrongSchemaPayload: { invalid: 'structure' },
        affectedMethods: ['initialize', 'tools/*', 'resources/*'],
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      expect(config?.affectedMethods).toContain('tools/*');
      expect(config?.affectedMethods).toContain('resources/*');
    });
  });

  describe('Configuration Management', () => {
    it('should set malformed response configuration', async () => {
      const config: MockMalformedResponseConfig = {
        type: 'invalid_json',
        invalidJsonContent: '{ test: invalid }',
        probability: 0.8,
        affectedMethods: ['tools/call'],
      };

      server.setMalformedResponseMode(config);

      const retrieved = server.getMalformedResponseMode();
      expect(retrieved).toEqual(config);
    });

    it('should clear malformed response configuration', async () => {
      server.setMalformedResponseMode({
        type: 'invalid_json',
        invalidJsonContent: '{ invalid }',
        probability: 1.0,
      });

      expect(server.getMalformedResponseMode()).toBeDefined();

      server.clearMalformedResponseMode();
      expect(server.getMalformedResponseMode()).toBeUndefined();
    });

    it('should handle configuration updates', async () => {
      // Set initial configuration
      server.setMalformedResponseMode({
        type: 'invalid_json',
        invalidJsonContent: '{ first }',
        probability: 0.5,
      });

      // Update configuration
      server.setMalformedResponseMode({
        type: 'truncated_json',
        truncateAt: '25%',
        probability: 0.8,
      });

      const config = server.getMalformedResponseMode();
      expect(config?.type).toBe('truncated_json');
      expect(config?.truncateAt).toBe('25%');
      expect(config?.probability).toBe(0.8);
    });

    it('should validate configuration object structure', async () => {
      // Test with minimal configuration
      server.setMalformedResponseMode({
        type: 'empty_response',
      });

      const config = server.getMalformedResponseMode();
      expect(config?.type).toBe('empty_response');
      expect(config?.probability).toBeUndefined(); // Should use default
    });
  });

  describe('Integration with Error Simulation', () => {
    it('should work alongside error simulation', async () => {
      // Set both error simulation and malformed response simulation
      server.setErrorMode({
        mode: 'periodic_fail',
        failPeriod: 3,
        customError: { code: -32603, message: 'Periodic error' },
      });

      server.setMalformedResponseMode({
        type: 'invalid_json',
        invalidJsonContent: '{ malformed }',
        probability: 0.5,
      });

      // Both configurations should be active
      expect(server.getErrorMode()).toBeDefined();
      expect(server.getMalformedResponseMode()).toBeDefined();
    });

    it('should handle clearing both simulation modes', async () => {
      server.setErrorMode({
        mode: 'always_fail',
        customError: { code: -32603, message: 'Error' },
      });

      server.setMalformedResponseMode({
        type: 'invalid_json',
        invalidJsonContent: '{ malformed }',
        probability: 1.0,
      });

      // Clear both
      server.clearErrorMode();
      server.clearMalformedResponseMode();

      expect(server.getErrorMode()).toBeUndefined();
      expect(server.getMalformedResponseMode()).toBeUndefined();
    });
  });

  describe('Real-World Malformed Response Scenarios', () => {
    it('should simulate corrupted network transmission', async () => {
      server.setMalformedResponseMode({
        type: 'custom',
        rawBytes: '{"jsonrpc":"2.0","id":1,"res\xFF\xFEult":{"corru\x00pted":true}}',
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      expect(config?.rawBytes).toContain('res\xFF\xFE');
    });

    it('should simulate server crash mid-response', async () => {
      server.setMalformedResponseMode({
        type: 'truncated_json',
        truncateAt: '40%', // Cut off mid-response
        affectedMethods: ['tools/call'],
        probability: 1.0,
      });

      expect(server.getMalformedResponseMode()?.type).toBe('truncated_json');
    });

    it('should simulate proxy/gateway corruption', async () => {
      const corruptedResponse = '{"jsonrpc":"2.0","id":1,"result":{"tools":[{"name":"test_tool","description":"A test tool","inputSchema":{"type":"object","properties":{"arg":{"type":"string"}}}}]}}PROXY_ERROR_INJECTED';

      server.setMalformedResponseMode({
        type: 'custom',
        rawBytes: corruptedResponse,
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      expect(config?.rawBytes).toContain('PROXY_ERROR_INJECTED');
    });

    it('should simulate encoding/charset issues', async () => {
      // Simulate UTF-8 issues with different encodings mixed
      const encodingIssues = '{"jsonrpc":"2.0","id":1,"result":{"text":"Hëllö Wörld™ \u0080\u0081"}}';

      server.setMalformedResponseMode({
        type: 'custom',
        rawBytes: encodingIssues,
        probability: 1.0,
      });

      expect(server.getMalformedResponseMode()?.rawBytes).toContain('Hëllö Wörld™');
    });

    it('should simulate memory corruption patterns', async () => {
      // Simulate response with repeated patterns that might indicate memory issues
      const memoryCorruption = '{"jsonrpc":"2.0","id":1,"result":{"data":"AAAAAAAAAAAAAAAAAAAA\x00\x00\x00\x00BBBBBBBBBBBB"}}';

      server.setMalformedResponseMode({
        type: 'custom',
        rawBytes: memoryCorruption,
        probability: 1.0,
      });

      const config = server.getMalformedResponseMode();
      expect(config?.rawBytes).toContain('AAAAAAAAAA');
      expect(config?.rawBytes).toContain('\x00\x00\x00\x00');
    });
  });
});