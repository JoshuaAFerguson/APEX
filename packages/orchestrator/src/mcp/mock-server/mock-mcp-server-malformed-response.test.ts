/**
 * @fileoverview Tests for MockMCPServer Malformed Response Mode Methods
 *
 * Tests the newly implemented malformed response simulation functionality in MockMCPServer:
 * - setMalformedResponseMode() - Configure transport-level malformed response simulation
 * - clearMalformedResponseMode() - Clear malformed response configuration
 * - getMalformedResponseMode() - Get current malformed response configuration
 *
 * These methods enable testing client resilience against protocol violations and corrupted data.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockMCPServer } from './mock-mcp-server.js';
import { MockTransport } from './mock-transport.js';
import type { MockMCPServerDefinition, MockMalformedResponseConfig } from '@apexcli/core';
import type { MalformedResponseInterceptorConfig, MalformedBytesInjectionConfig } from './types.js';

describe('MockMCPServer - Malformed Response Mode Methods', () => {
  let server: MockMCPServer;
  let serverDefinition: MockMCPServerDefinition;

  beforeEach(() => {
    serverDefinition = {
      serverConfig: {
        name: 'test-server',
        transport: 'stdio',
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
          resources: { listChanged: false },
          prompts: { listChanged: false },
        },
        serverInfo: {
          name: 'test-server',
          version: '1.0.0',
        },
        maxConnections: 10,
        shutdownTimeoutMs: 5000,
        stdioConfig: {
          startupDelayMs: 0,
        },
      },
      defaultBehavior: {
        responseDelay: { fixedMs: 0 },
        errorInjection: { enabled: false },
        toolHandlers: [
          {
            toolName: 'test_tool',
            response: {
              content: [{ type: 'text', text: 'test response' }],
              isError: false,
            },
          },
        ],
        notificationTriggers: [],
        defaultToolResponse: undefined,
      },
      scenarios: [],
    };

    server = new MockMCPServer(serverDefinition);
  });

  afterEach(async () => {
    if (server.isListening()) {
      await server.stop();
    }
    vi.clearAllMocks();
  });

  describe('setMalformedResponseMode', () => {
    it('should set truncated_json malformed response configuration', () => {
      const config: MockMalformedResponseConfig = {
        type: 'truncated_json',
        truncateAt: '50%',
        affectedMethods: ['tools/call'],
        probability: 1.0,
        description: 'Test truncated JSON responses',
      };

      server.setMalformedResponseMode(config);

      const retrievedConfig = server.getMalformedResponseMode();
      expect(retrievedConfig).toEqual(config);
    });

    it('should set invalid_json malformed response configuration', () => {
      const config: MockMalformedResponseConfig = {
        type: 'invalid_json',
        invalidJsonContent: '{"result": undefined, "error": null',
        affectedMethods: ['initialize', 'tools/list'],
        probability: 0.8,
        description: 'Test invalid JSON syntax',
      };

      server.setMalformedResponseMode(config);

      const retrievedConfig = server.getMalformedResponseMode();
      expect(retrievedConfig).toEqual(config);
    });

    it('should set wrong_schema malformed response configuration', () => {
      const config: MockMalformedResponseConfig = {
        type: 'wrong_schema',
        wrongSchemaPayload: {
          unexpected: 'structure',
          missing: 'required fields',
          extraField: 'should not be here',
        },
        affectedMethods: [],
        probability: 1.0,
        description: 'Test wrong schema responses',
      };

      server.setMalformedResponseMode(config);

      const retrievedConfig = server.getMalformedResponseMode();
      expect(retrievedConfig).toEqual(config);
    });

    it('should set malformed_headers configuration', () => {
      const config: MockMalformedResponseConfig = {
        type: 'malformed_headers',
        affectedMethods: ['tools/call', 'resources/list'],
        probability: 0.5,
        description: 'Test malformed HTTP headers',
      };

      server.setMalformedResponseMode(config);

      const retrievedConfig = server.getMalformedResponseMode();
      expect(retrievedConfig).toEqual(config);
    });

    it('should set empty_response configuration', () => {
      const config: MockMalformedResponseConfig = {
        type: 'empty_response',
        affectedMethods: ['ping'],
        probability: 1.0,
        description: 'Test completely empty responses',
      };

      server.setMalformedResponseMode(config);

      const retrievedConfig = server.getMalformedResponseMode();
      expect(retrievedConfig).toEqual(config);
    });

    it('should set binary_garbage configuration', () => {
      const config: MockMalformedResponseConfig = {
        type: 'binary_garbage',
        affectedMethods: [],
        probability: 0.3,
        description: 'Test binary garbage responses',
      };

      server.setMalformedResponseMode(config);

      const retrievedConfig = server.getMalformedResponseMode();
      expect(retrievedConfig).toEqual(config);
    });

    it('should use default values for optional fields', () => {
      const config: MockMalformedResponseConfig = {
        type: 'truncated_json',
      };

      server.setMalformedResponseMode(config);

      const retrievedConfig = server.getMalformedResponseMode();
      expect(retrievedConfig).toEqual({
        type: 'truncated_json',
        affectedMethods: [],
        probability: 1.0,
      });
    });

    it('should emit scenario:activated event with correct name', () => {
      const scenarioActivatedSpy = vi.fn();
      server.on('scenario:activated', scenarioActivatedSpy);

      const config: MockMalformedResponseConfig = {
        type: 'invalid_json',
        invalidJsonContent: '{"broken": json}',
      };

      server.setMalformedResponseMode(config);

      expect(scenarioActivatedSpy).toHaveBeenCalledWith('malformed:invalid_json');
    });

    it('should overwrite previous malformed response configuration', () => {
      const firstConfig: MockMalformedResponseConfig = {
        type: 'truncated_json',
        truncateAt: '25%',
        probability: 0.5,
      };

      const secondConfig: MockMalformedResponseConfig = {
        type: 'wrong_schema',
        wrongSchemaPayload: { different: 'payload' },
        probability: 1.0,
      };

      server.setMalformedResponseMode(firstConfig);
      expect(server.getMalformedResponseMode()).toEqual({
        ...firstConfig,
        affectedMethods: [],
      });

      server.setMalformedResponseMode(secondConfig);
      expect(server.getMalformedResponseMode()).toEqual({
        ...secondConfig,
        affectedMethods: [],
      });
    });
  });

  describe('clearMalformedResponseMode', () => {
    it('should clear malformed response configuration', () => {
      const config: MockMalformedResponseConfig = {
        type: 'invalid_json',
        invalidJsonContent: '{"broken": json}',
        affectedMethods: ['tools/call'],
        probability: 1.0,
      };

      server.setMalformedResponseMode(config);
      expect(server.getMalformedResponseMode()).toEqual({
        ...config,
      });

      server.clearMalformedResponseMode();
      expect(server.getMalformedResponseMode()).toBeUndefined();
    });

    it('should be safe to call when no configuration is set', () => {
      expect(server.getMalformedResponseMode()).toBeUndefined();

      expect(() => server.clearMalformedResponseMode()).not.toThrow();
      expect(server.getMalformedResponseMode()).toBeUndefined();
    });

    it('should be safe to call multiple times', () => {
      const config: MockMalformedResponseConfig = {
        type: 'truncated_json',
        truncateAt: 100,
      };

      server.setMalformedResponseMode(config);
      server.clearMalformedResponseMode();
      server.clearMalformedResponseMode(); // Second call should be safe

      expect(server.getMalformedResponseMode()).toBeUndefined();
    });
  });

  describe('getMalformedResponseMode', () => {
    it('should return undefined when no configuration is set', () => {
      expect(server.getMalformedResponseMode()).toBeUndefined();
    });

    it('should return current configuration after setting', () => {
      const config: MockMalformedResponseConfig = {
        type: 'wrong_schema',
        wrongSchemaPayload: {
          invalidField: 'value',
          missingRequiredFields: true,
        },
        affectedMethods: ['initialize', 'tools/list', 'tools/call'],
        probability: 0.7,
        description: 'Complex wrong schema test',
      };

      server.setMalformedResponseMode(config);

      const retrievedConfig = server.getMalformedResponseMode();
      expect(retrievedConfig).toEqual(config);
      expect(retrievedConfig).not.toBe(config); // Should be a copy, not the same reference
    });

    it('should return undefined after clearing configuration', () => {
      const config: MockMalformedResponseConfig = {
        type: 'binary_garbage',
        probability: 1.0,
      };

      server.setMalformedResponseMode(config);
      expect(server.getMalformedResponseMode()).toBeDefined();

      server.clearMalformedResponseMode();
      expect(server.getMalformedResponseMode()).toBeUndefined();
    });

    it('should return deep copy of configuration (immutable)', () => {
      const config: MockMalformedResponseConfig = {
        type: 'wrong_schema',
        wrongSchemaPayload: {
          mutableField: 'original',
          nestedObject: {
            property: 'value',
          },
        },
        affectedMethods: ['tools/call'],
        probability: 1.0,
      };

      server.setMalformedResponseMode(config);

      const retrievedConfig = server.getMalformedResponseMode();
      expect(retrievedConfig).toEqual(config);

      // Modify the retrieved config
      if (retrievedConfig && typeof retrievedConfig.wrongSchemaPayload === 'object' && retrievedConfig.wrongSchemaPayload !== null) {
        (retrievedConfig.wrongSchemaPayload as any).mutableField = 'modified';
        (retrievedConfig.wrongSchemaPayload as any).nestedObject.property = 'modified';
      }
      retrievedConfig!.affectedMethods.push('new/method');

      // Original configuration in server should remain unchanged
      const originalConfig = server.getMalformedResponseMode();
      expect(originalConfig).toEqual(config);
      expect((originalConfig!.wrongSchemaPayload as any).mutableField).toBe('original');
      expect((originalConfig!.wrongSchemaPayload as any).nestedObject.property).toBe('value');
      expect(originalConfig!.affectedMethods).toEqual(['tools/call']);
    });
  });

  describe('Integration with Server Lifecycle', () => {
    it('should maintain malformed response configuration during server start/stop cycle', async () => {
      const config: MockMalformedResponseConfig = {
        type: 'truncated_json',
        truncateAt: '75%',
        affectedMethods: ['tools/call'],
        probability: 0.9,
      };

      server.setMalformedResponseMode(config);

      await server.start();
      expect(server.getMalformedResponseMode()).toEqual({
        ...config,
      });

      await server.stop();
      expect(server.getMalformedResponseMode()).toEqual({
        ...config,
      });
    });

    it('should allow configuration changes while server is running', async () => {
      await server.start();

      const firstConfig: MockMalformedResponseConfig = {
        type: 'invalid_json',
        invalidJsonContent: '{"first": "config"}',
      };

      server.setMalformedResponseMode(firstConfig);
      expect(server.getMalformedResponseMode()).toEqual({
        ...firstConfig,
        affectedMethods: [],
        probability: 1.0,
      });

      const secondConfig: MockMalformedResponseConfig = {
        type: 'wrong_schema',
        wrongSchemaPayload: { second: 'config' },
      };

      server.setMalformedResponseMode(secondConfig);
      expect(server.getMalformedResponseMode()).toEqual({
        ...secondConfig,
        affectedMethods: [],
        probability: 1.0,
      });

      await server.stop();
    });

    it('should allow clearing configuration while server is running', async () => {
      const config: MockMalformedResponseConfig = {
        type: 'empty_response',
        affectedMethods: ['ping'],
        probability: 1.0,
      };

      server.setMalformedResponseMode(config);

      await server.start();
      expect(server.getMalformedResponseMode()).toBeDefined();

      server.clearMalformedResponseMode();
      expect(server.getMalformedResponseMode()).toBeUndefined();

      await server.stop();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle complex nested wrongSchemaPayload', () => {
      const complexPayload = {
        level1: {
          level2: {
            level3: {
              array: [1, 2, { nested: 'object' }],
              boolean: true,
              null_value: null,
              undefined_value: undefined,
            },
          },
        },
        functions: () => 'should be serialized',
        symbol: Symbol('test'),
        date: new Date('2024-01-01'),
      };

      const config: MockMalformedResponseConfig = {
        type: 'wrong_schema',
        wrongSchemaPayload: complexPayload,
        probability: 1.0,
      };

      server.setMalformedResponseMode(config);

      const retrievedConfig = server.getMalformedResponseMode();
      expect(retrievedConfig).toBeDefined();
      expect(retrievedConfig!.type).toBe('wrong_schema');
      expect(retrievedConfig!.wrongSchemaPayload).toBeDefined();
    });

    it('should handle very long invalidJsonContent', () => {
      const longInvalidJson = '{"data": "' + 'x'.repeat(10000) + '", "broken": json}';

      const config: MockMalformedResponseConfig = {
        type: 'invalid_json',
        invalidJsonContent: longInvalidJson,
        probability: 1.0,
      };

      server.setMalformedResponseMode(config);

      const retrievedConfig = server.getMalformedResponseMode();
      expect(retrievedConfig).toEqual({
        ...config,
        affectedMethods: [],
      });
      expect(retrievedConfig!.invalidJsonContent).toHaveLength(longInvalidJson.length);
    });

    it('should handle empty affectedMethods array', () => {
      const config: MockMalformedResponseConfig = {
        type: 'binary_garbage',
        affectedMethods: [],
        probability: 1.0,
      };

      server.setMalformedResponseMode(config);

      const retrievedConfig = server.getMalformedResponseMode();
      expect(retrievedConfig!.affectedMethods).toEqual([]);
    });

    it('should handle large affectedMethods array', () => {
      const manyMethods = Array.from({ length: 100 }, (_, i) => `method/test_${i}`);

      const config: MockMalformedResponseConfig = {
        type: 'truncated_json',
        truncateAt: 50,
        affectedMethods: manyMethods,
        probability: 0.5,
      };

      server.setMalformedResponseMode(config);

      const retrievedConfig = server.getMalformedResponseMode();
      expect(retrievedConfig!.affectedMethods).toEqual(manyMethods);
      expect(retrievedConfig!.affectedMethods).toHaveLength(100);
    });

    it('should handle boundary probability values', () => {
      // Test minimum probability (0.0)
      const configMin: MockMalformedResponseConfig = {
        type: 'empty_response',
        probability: 0.0,
      };

      server.setMalformedResponseMode(configMin);
      expect(server.getMalformedResponseMode()!.probability).toBe(0.0);

      // Test maximum probability (1.0)
      const configMax: MockMalformedResponseConfig = {
        type: 'empty_response',
        probability: 1.0,
      };

      server.setMalformedResponseMode(configMax);
      expect(server.getMalformedResponseMode()!.probability).toBe(1.0);
    });
  });

  describe('Type Safety and Validation', () => {
    it('should handle all supported malformed response types', () => {
      const supportedTypes: MockMalformedResponseConfig['type'][] = [
        'truncated_json',
        'invalid_json',
        'wrong_schema',
        'malformed_headers',
        'empty_response',
        'binary_garbage',
      ];

      for (const type of supportedTypes) {
        const config: MockMalformedResponseConfig = {
          type,
          probability: 1.0,
        };

        server.setMalformedResponseMode(config);

        const retrievedConfig = server.getMalformedResponseMode();
        expect(retrievedConfig!.type).toBe(type);
        expect(retrievedConfig!.probability).toBe(1.0);
      }
    });

    it('should maintain type information correctly', () => {
      const config: MockMalformedResponseConfig = {
        type: 'truncated_json',
        truncateAt: '33%',
        affectedMethods: ['test/method'],
        probability: 0.8,
        description: 'Test description',
      };

      server.setMalformedResponseMode(config);

      const retrievedConfig = server.getMalformedResponseMode();

      // Type guards to ensure correct typing
      expect(typeof retrievedConfig!.type).toBe('string');
      expect(typeof retrievedConfig!.probability).toBe('number');
      expect(Array.isArray(retrievedConfig!.affectedMethods)).toBe(true);

      if (retrievedConfig!.truncateAt !== undefined) {
        expect(
          typeof retrievedConfig!.truncateAt === 'string' ||
          typeof retrievedConfig!.truncateAt === 'number'
        ).toBe(true);
      }

      if (retrievedConfig!.description !== undefined) {
        expect(typeof retrievedConfig!.description).toBe('string');
      }
    });
  });

  describe('Client Error Handling Integration Tests', () => {
    let clientTransport: MockTransport;

    beforeEach(async () => {
      await server.start();
      clientTransport = server.createClientTransport();
      await clientTransport.connect();
    });

    afterEach(async () => {
      if (clientTransport && clientTransport.isConnected()) {
        await clientTransport.disconnect();
      }
    });

    describe('Invalid JSON Response Handling', () => {
      it('should configure and verify invalid JSON malformed response mode', async () => {
        // Test the server configuration for invalid JSON responses
        const config: MockMalformedResponseConfig = {
          type: 'invalid_json',
          invalidJsonContent: '{"result": undefined, "broken": json}',
          affectedMethods: ['tools/call'],
          probability: 1.0,
          description: 'Test invalid JSON response handling',
        };

        server.setMalformedResponseMode(config);

        // Verify configuration was set
        const retrievedConfig = server.getMalformedResponseMode();
        expect(retrievedConfig).toEqual(config);
      });

      it('should handle transport-level invalid JSON injection', () => {
        // Test that transport can inject invalid JSON responses
        let capturedError: Error | undefined;
        clientTransport.on('error', (error: Error) => {
          capturedError = error;
        });

        // Directly inject malformed bytes to test client error handling
        clientTransport.injectMalformedBytes({
          type: 'invalid_json',
          invalidContent: '{"broken": json syntax}',
        });

        // Verify that an error was captured
        expect(capturedError).toBeDefined();
        expect(capturedError!.message).toContain('Malformed data received');
      });

    });

    describe('Truncated JSON Response Handling', () => {
      it('should configure truncated JSON malformed response mode', () => {
        const config: MockMalformedResponseConfig = {
          type: 'truncated_json',
          truncateAt: '50%',
          affectedMethods: ['ping'],
          probability: 1.0,
        };

        server.setMalformedResponseMode(config);

        const retrievedConfig = server.getMalformedResponseMode();
        expect(retrievedConfig).toEqual(config);
      });

      it('should handle transport-level truncated JSON injection', () => {
        let capturedError: Error | undefined;
        let rawDataReceived: string | undefined;

        clientTransport.on('error', (error: Error) => {
          capturedError = error;
        });

        clientTransport.on('rawData', (data: string) => {
          rawDataReceived = data;
        });

        // Inject truncated JSON directly
        clientTransport.injectMalformedBytes({
          type: 'truncated_json',
          truncateAt: '50%',
        });

        // Verify that truncated data and error were captured
        expect(rawDataReceived).toBeDefined();
        expect(capturedError).toBeDefined();
        expect(capturedError!.message).toContain('Malformed data received');
      });

      it('should handle numeric truncateAt values', () => {
        const config: MockMalformedResponseConfig = {
          type: 'truncated_json',
          truncateAt: 25,
          affectedMethods: ['tools/list'],
          probability: 1.0,
        };

        server.setMalformedResponseMode(config);

        const retrievedConfig = server.getMalformedResponseMode();
        expect(retrievedConfig).toEqual(config);
      });
    });

    describe('Wrong Schema Response Handling', () => {
      it('should configure wrong schema malformed response mode', () => {
        const config: MockMalformedResponseConfig = {
          type: 'wrong_schema',
          wrongSchemaPayload: {
            unexpected: 'structure',
            missing: 'required fields',
            extraField: 'should not be here',
          },
          affectedMethods: ['resources/list'],
          probability: 1.0,
        };

        server.setMalformedResponseMode(config);

        const retrievedConfig = server.getMalformedResponseMode();
        expect(retrievedConfig).toEqual(config);
      });

      it('should handle complex nested wrong schema payloads', () => {
        const complexPayload = {
          level1: {
            level2: {
              array: [1, 2, { nested: 'object' }],
              boolean: true,
              null_value: null,
            },
          },
          unexpectedRoot: 'value',
        };

        const config: MockMalformedResponseConfig = {
          type: 'wrong_schema',
          wrongSchemaPayload: complexPayload,
          affectedMethods: ['prompts/list'],
          probability: 1.0,
        };

        server.setMalformedResponseMode(config);

        const retrievedConfig = server.getMalformedResponseMode();
        expect(retrievedConfig).toEqual(config);
        expect(retrievedConfig!.wrongSchemaPayload).toEqual(complexPayload);
      });
    });

    describe('Empty Response Handling', () => {
      it('should configure empty response malformed mode', () => {
        const config: MockMalformedResponseConfig = {
          type: 'empty_response',
          affectedMethods: ['ping'],
          probability: 1.0,
        };

        server.setMalformedResponseMode(config);

        const retrievedConfig = server.getMalformedResponseMode();
        expect(retrievedConfig).toEqual(config);
      });

      it('should handle transport-level empty response injection', () => {
        let capturedError: Error | undefined;
        let rawDataReceived: any;

        clientTransport.on('error', (error: Error) => {
          capturedError = error;
        });

        clientTransport.on('rawData', (data: any) => {
          rawDataReceived = data;
        });

        // Inject empty response directly
        clientTransport.injectMalformedBytes({
          type: 'empty_response',
        });

        // Should receive empty data and trigger error
        expect(rawDataReceived).toBeDefined();
        expect(rawDataReceived).toBe('');
        expect(capturedError).toBeDefined();
        expect(capturedError!.message).toContain('Malformed data received');
      });
    });

    describe('Binary Garbage Response Handling', () => {
      it('should configure binary garbage malformed response mode', () => {
        const config: MockMalformedResponseConfig = {
          type: 'binary_garbage',
          affectedMethods: ['tools/call'],
          probability: 1.0,
        };

        server.setMalformedResponseMode(config);

        const retrievedConfig = server.getMalformedResponseMode();
        expect(retrievedConfig).toEqual(config);
      });

      it('should handle transport-level binary garbage injection', () => {
        let capturedError: Error | undefined;
        let rawDataReceived: any;

        clientTransport.on('error', (error: Error) => {
          capturedError = error;
        });

        clientTransport.on('rawData', (data: any) => {
          rawDataReceived = data;
        });

        // Inject binary data directly
        clientTransport.injectMalformedBytes({
          type: 'binary_data',
        });

        // Should receive binary data and trigger error
        expect(rawDataReceived).toBeDefined();
        expect(capturedError).toBeDefined();
        expect(capturedError!.message).toContain('Malformed data received');
      });
    });

    describe('Probability-based Malformed Response Configuration', () => {
      it('should configure malformed responses with various probability values', () => {
        const probabilityConfigs = [
          { probability: 0.0, description: 'zero probability' },
          { probability: 0.5, description: 'fifty percent probability' },
          { probability: 1.0, description: 'full probability' },
        ];

        for (const { probability, description } of probabilityConfigs) {
          const config: MockMalformedResponseConfig = {
            type: 'invalid_json',
            invalidJsonContent: '{"broken": json}',
            affectedMethods: ['ping'],
            probability,
            description,
          };

          server.setMalformedResponseMode(config);

          const retrievedConfig = server.getMalformedResponseMode();
          expect(retrievedConfig).toEqual(config);
          expect(retrievedConfig!.probability).toBe(probability);
        }
      });
    });

    describe('Method-specific Malformed Response Targeting', () => {
      it('should configure method-specific targeting', () => {
        const config: MockMalformedResponseConfig = {
          type: 'invalid_json',
          invalidJsonContent: '{"broken": json}',
          affectedMethods: ['tools/call'], // Only affect tools/call
          probability: 1.0,
        };

        server.setMalformedResponseMode(config);

        const retrievedConfig = server.getMalformedResponseMode();
        expect(retrievedConfig).toEqual(config);
        expect(retrievedConfig!.affectedMethods).toEqual(['tools/call']);
      });

      it('should handle empty affected methods array', () => {
        const config: MockMalformedResponseConfig = {
          type: 'truncated_json',
          truncateAt: '25%',
          affectedMethods: [], // Empty array affects all methods
          probability: 1.0,
        };

        server.setMalformedResponseMode(config);

        const retrievedConfig = server.getMalformedResponseMode();
        expect(retrievedConfig).toEqual(config);
        expect(retrievedConfig!.affectedMethods).toEqual([]);
      });
    });

    describe('Configuration Management', () => {
      it('should allow clearing malformed mode configuration', () => {
        const config: MockMalformedResponseConfig = {
          type: 'invalid_json',
          invalidJsonContent: '{"broken": json}',
          affectedMethods: ['ping'],
          probability: 1.0,
        };

        // Set configuration
        server.setMalformedResponseMode(config);
        expect(server.getMalformedResponseMode()).toEqual(config);

        // Clear configuration
        server.clearMalformedResponseMode();
        expect(server.getMalformedResponseMode()).toBeUndefined();
      });

      it('should allow transport-level malformed injection cleanup', () => {
        const config: MalformedBytesInjectionConfig = {
          type: 'invalid_json',
          invalidContent: '{"broken": json}',
        };

        // Configure injection
        clientTransport.setMalformedResponseInjection({
          targetMethods: ['ping'],
          injection: config,
          probability: 1.0,
        });

        // Clear injection
        clientTransport.clearMalformedResponseInjection();

        // Should not throw error when cleared
        expect(() => clientTransport.clearMalformedResponseInjection()).not.toThrow();
      });
    });
  });
});
});