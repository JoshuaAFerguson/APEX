/**
 * @fileoverview Extended Tests for Mock Types Infrastructure
 *
 * Tests the error simulation types and validation including:
 * - MockErrorSimulationConfig validation
 * - Network conditions validation
 * - Error sequence validation
 * - Preset integration validation
 * - Configuration merging behavior
 *
 * @module core/mcp/mock-types-extended.test
 */

import { describe, it, expect } from 'vitest';
import {
  MockErrorSimulationConfigSchema,
  MockErrorSequenceItemSchema,
  MockNetworkConditionsSchema,
  MockMCPServerDefinitionSchema,
  MockBehaviorConfigSchema,
  MockToolHandlerSchema,
  MockResponseSequenceSchema,
  MockDynamicHandlerSchema,
  type MockErrorSimulationConfig,
  type MockErrorSequenceItem,
  type MockNetworkConditions,
  type MockMCPServerDefinition,
  type MockBehaviorConfig,
} from './mock-types.js';

describe('Mock Types - Error Simulation', () => {
  describe('MockErrorSimulationConfig validation', () => {
    it('should validate basic error simulation config', () => {
      const config: MockErrorSimulationConfig = {
        mode: 'always_fail',
        category: 'jsonrpc',
        customError: {
          code: -32603,
          message: 'Test error',
        },
      };

      const result = MockErrorSimulationConfigSchema.parse(config);
      expect(result).toEqual(config);
    });

    it('should apply default values', () => {
      const config = {};

      const result = MockErrorSimulationConfigSchema.parse(config);
      expect(result.mode).toBe('none');
      expect(result.category).toBe('jsonrpc');
      expect(result.affectedClients).toBe('all');
    });

    it('should validate periodic_fail mode with failPeriod', () => {
      const config: MockErrorSimulationConfig = {
        mode: 'periodic_fail',
        failPeriod: 3,
        customError: { code: -32603, message: 'Periodic error' },
      };

      const result = MockErrorSimulationConfigSchema.parse(config);
      expect(result.failPeriod).toBe(3);
    });

    it('should validate fail_first_n mode with failCount', () => {
      const config: MockErrorSimulationConfig = {
        mode: 'fail_first_n',
        failCount: 5,
        customError: { code: -32603, message: 'First N error' },
      };

      const result = MockErrorSimulationConfigSchema.parse(config);
      expect(result.failCount).toBe(5);
    });

    it('should validate fail_after_n mode with succeedCount', () => {
      const config: MockErrorSimulationConfig = {
        mode: 'fail_after_n',
        succeedCount: 2,
        customError: { code: -32603, message: 'After N error' },
      };

      const result = MockErrorSimulationConfigSchema.parse(config);
      expect(result.succeedCount).toBe(2);
    });

    it('should validate method_pattern mode with methodPattern', () => {
      const config: MockErrorSimulationConfig = {
        mode: 'method_pattern',
        methodPattern: '^tools/',
        customError: { code: -32603, message: 'Method pattern error' },
      };

      const result = MockErrorSimulationConfigSchema.parse(config);
      expect(result.methodPattern).toBe('^tools/');
    });

    it('should validate argument_pattern mode with argumentMatcher', () => {
      const config: MockErrorSimulationConfig = {
        mode: 'argument_pattern',
        argumentMatcher: {
          path: 'options.verbose',
          value: true,
        },
        customError: { code: -32603, message: 'Argument pattern error' },
      };

      const result = MockErrorSimulationConfigSchema.parse(config);
      expect(result.argumentMatcher).toEqual({
        path: 'options.verbose',
        value: true,
      });
    });

    it('should validate sequence mode with sequence array', () => {
      const config: MockErrorSimulationConfig = {
        mode: 'sequence',
        sequence: [
          { outcome: 'error', error: { code: -32603, message: 'First' } },
          { outcome: 'success' },
          { outcome: 'error', error: { code: -32604, message: 'Second' }, delayMs: 100 },
        ],
      };

      const result = MockErrorSimulationConfigSchema.parse(config);
      expect(result.sequence).toHaveLength(3);
      expect(result.sequence![0].outcome).toBe('error');
      expect(result.sequence![1].outcome).toBe('success');
      expect(result.sequence![2].delayMs).toBe(100);
    });

    it('should validate networkConditions', () => {
      const config: MockErrorSimulationConfig = {
        mode: 'always_fail',
        networkConditions: {
          latencyMs: 100,
          latencyJitter: 20,
          packetLoss: 0.1,
          bandwidth: 1000000,
          connectionTimeout: 30000,
        },
        customError: { code: -32603, message: 'Network error' },
      };

      const result = MockErrorSimulationConfigSchema.parse(config);
      expect(result.networkConditions).toEqual({
        latencyMs: 100,
        latencyJitter: 20,
        packetLoss: 0.1,
        bandwidth: 1000000,
        connectionTimeout: 30000,
      });
    });

    it('should validate affectedClients as array', () => {
      const config: MockErrorSimulationConfig = {
        mode: 'always_fail',
        affectedClients: ['client-1', 'client-2'],
        customError: { code: -32603, message: 'Targeted error' },
      };

      const result = MockErrorSimulationConfigSchema.parse(config);
      expect(result.affectedClients).toEqual(['client-1', 'client-2']);
    });

    it('should validate preset configuration', () => {
      const config: MockErrorSimulationConfig = {
        mode: 'always_fail',
        preset: 'rate_limit',
        customError: { code: -32429, message: 'Custom rate limit' },
      };

      const result = MockErrorSimulationConfigSchema.parse(config);
      expect(result.preset).toBe('rate_limit');
    });

    it('should reject invalid error codes', () => {
      expect(() => {
        MockErrorSimulationConfigSchema.parse({
          mode: 'always_fail',
          customError: {
            code: 'invalid' as any,
            message: 'Test error',
          },
        });
      }).toThrow();
    });

    it('should reject invalid packet loss values', () => {
      expect(() => {
        MockErrorSimulationConfigSchema.parse({
          mode: 'always_fail',
          networkConditions: {
            packetLoss: 1.5, // > 1.0
          },
        });
      }).toThrow();
    });

    it('should reject negative values for timing fields', () => {
      expect(() => {
        MockErrorSimulationConfigSchema.parse({
          mode: 'always_fail',
          networkConditions: {
            latencyMs: -100,
          },
        });
      }).toThrow();
    });
  });

  describe('MockErrorSequenceItem validation', () => {
    it('should validate success outcome', () => {
      const item: MockErrorSequenceItem = {
        outcome: 'success',
        delayMs: 100,
      };

      const result = MockErrorSequenceItemSchema.parse(item);
      expect(result.outcome).toBe('success');
      expect(result.delayMs).toBe(100);
      expect(result.error).toBeUndefined();
    });

    it('should validate error outcome with error details', () => {
      const item: MockErrorSequenceItem = {
        outcome: 'error',
        error: {
          code: -32603,
          message: 'Sequence error',
          data: { details: 'extra info' },
        },
        delayMs: 50,
      };

      const result = MockErrorSequenceItemSchema.parse(item);
      expect(result.outcome).toBe('error');
      expect(result.error).toEqual({
        code: -32603,
        message: 'Sequence error',
        data: { details: 'extra info' },
      });
    });

    it('should reject error outcome without error details', () => {
      expect(() => {
        MockErrorSequenceItemSchema.parse({
          outcome: 'error',
          // Missing error field
        });
      }).toThrow();
    });

    it('should allow error outcome with optional error field', () => {
      const item = {
        outcome: 'error' as const,
        error: undefined,
      };

      // This should be valid since error is optional in the schema
      const result = MockErrorSequenceItemSchema.parse(item);
      expect(result.outcome).toBe('error');
    });
  });

  describe('MockNetworkConditions validation', () => {
    it('should validate all network condition fields', () => {
      const conditions: MockNetworkConditions = {
        latencyMs: 100,
        latencyJitter: 20,
        packetLoss: 0.05,
        bandwidth: 1000000,
        connectionTimeout: 30000,
      };

      const result = MockNetworkConditionsSchema.parse(conditions);
      expect(result).toEqual(conditions);
    });

    it('should allow empty network conditions', () => {
      const result = MockNetworkConditionsSchema.parse({});
      expect(result).toEqual({});
    });

    it('should reject negative latency', () => {
      expect(() => {
        MockNetworkConditionsSchema.parse({
          latencyMs: -50,
        });
      }).toThrow();
    });

    it('should reject packet loss > 1.0', () => {
      expect(() => {
        MockNetworkConditionsSchema.parse({
          packetLoss: 1.5,
        });
      }).toThrow();
    });

    it('should reject packet loss < 0.0', () => {
      expect(() => {
        MockNetworkConditionsSchema.parse({
          packetLoss: -0.1,
        });
      }).toThrow();
    });

    it('should allow connectionTimeout of 0 (infinite)', () => {
      const result = MockNetworkConditionsSchema.parse({
        connectionTimeout: 0,
      });
      expect(result.connectionTimeout).toBe(0);
    });
  });

  describe('Integration with MockBehaviorConfig', () => {
    it('should validate behavior config with error simulation', () => {
      const behavior: MockBehaviorConfig = {
        responseDelay: { fixedMs: 100 },
        errorInjection: { enabled: true, probability: 0.1 },
        toolHandlers: [
          {
            toolName: 'test_tool',
            response: {
              content: [{ type: 'text', text: 'test' }],
              isError: false,
            },
          },
        ],
        recordRequests: true,
        maxRecordedRequests: 1000,
      };

      const result = MockBehaviorConfigSchema.parse(behavior);
      expect(result.toolHandlers).toHaveLength(1);
      expect(result.recordRequests).toBe(true);
      expect(result.maxRecordedRequests).toBe(1000);
    });

    it('should apply behavior config defaults', () => {
      const result = MockBehaviorConfigSchema.parse({});
      expect(result.toolHandlers).toEqual([]);
      expect(result.dynamicHandlers).toEqual([]);
      expect(result.responseSequences).toEqual([]);
      expect(result.notificationTriggers).toEqual([]);
      expect(result.expectations).toEqual([]);
      expect(result.recordRequests).toBe(true);
      expect(result.maxRecordedRequests).toBe(1000);
      expect(result.validateRequests).toBe(true);
      expect(result.enableDebugLogging).toBe(false);
    });
  });

  describe('Tool Handler Validation', () => {
    it('should validate basic tool handler', () => {
      const handler = {
        toolName: 'test_tool',
        response: {
          content: [
            { type: 'text', text: 'test response' },
          ],
          isError: false,
        },
      };

      const result = MockToolHandlerSchema.parse(handler);
      expect(result.toolName).toBe('test_tool');
      expect(result.response.content).toHaveLength(1);
      expect(result.priority).toBe(50); // default
    });

    it('should validate tool handler with argument matching', () => {
      const handler = {
        toolName: 'read_file',
        response: {
          content: [{ type: 'text', text: 'file content' }],
        },
        matchArgs: { path: '/test/file.txt' },
        priority: 75,
        delayMs: 100,
        maxInvocations: 5,
      };

      const result = MockToolHandlerSchema.parse(handler);
      expect(result.matchArgs).toEqual({ path: '/test/file.txt' });
      expect(result.priority).toBe(75);
      expect(result.delayMs).toBe(100);
      expect(result.maxInvocations).toBe(5);
    });

    it('should validate different content types', () => {
      const handler = {
        toolName: 'multi_content_tool',
        response: {
          content: [
            { type: 'text', text: 'text content' },
            {
              type: 'image',
              data: 'base64encodeddata',
              mimeType: 'image/png',
            },
            {
              type: 'resource',
              resource: {
                uri: 'file:///test.txt',
                mimeType: 'text/plain',
                text: 'resource content',
              },
            },
          ],
        },
      };

      const result = MockToolHandlerSchema.parse(handler);
      expect(result.response.content).toHaveLength(3);
      expect(result.response.content[0].type).toBe('text');
      expect(result.response.content[1].type).toBe('image');
      expect(result.response.content[2].type).toBe('resource');
    });

    it('should reject invalid content types', () => {
      expect(() => {
        MockToolHandlerSchema.parse({
          toolName: 'test',
          response: {
            content: [
              { type: 'invalid', text: 'test' },
            ],
          },
        });
      }).toThrow();
    });

    it('should reject empty tool name', () => {
      expect(() => {
        MockToolHandlerSchema.parse({
          toolName: '',
          response: {
            content: [{ type: 'text', text: 'test' }],
          },
        });
      }).toThrow();
    });
  });

  describe('Response Sequence Validation', () => {
    it('should validate basic response sequence', () => {
      const sequence = {
        toolName: 'status_tool',
        responses: [
          {
            content: [{ type: 'text', text: 'initializing' }],
            isError: false,
          },
          {
            content: [{ type: 'text', text: 'ready' }],
            isError: false,
          },
        ],
      };

      const result = MockResponseSequenceSchema.parse(sequence);
      expect(result.responses).toHaveLength(2);
      expect(result.cycleMode).toBe('cycle'); // default
      expect(result.priority).toBe(50); // default
    });

    it('should validate response sequence with all options', () => {
      const sequence = {
        toolName: 'complex_tool',
        responses: [
          {
            content: [{ type: 'text', text: 'first' }],
            isError: false,
            delayMs: 100,
          },
          {
            content: [{ type: 'text', text: 'error response' }],
            isError: true,
            delayMs: 50,
          },
        ],
        matchArgs: { mode: 'test' },
        cycleMode: 'repeat_last' as const,
        priority: 80,
      };

      const result = MockResponseSequenceSchema.parse(sequence);
      expect(result.cycleMode).toBe('repeat_last');
      expect(result.priority).toBe(80);
      expect(result.matchArgs).toEqual({ mode: 'test' });
      expect(result.responses[0].delayMs).toBe(100);
      expect(result.responses[1].isError).toBe(true);
    });

    it('should reject empty responses array', () => {
      expect(() => {
        MockResponseSequenceSchema.parse({
          toolName: 'test',
          responses: [],
        });
      }).toThrow();
    });

    it('should validate cycle modes', () => {
      const validModes = ['cycle', 'repeat_last', 'stop_at_end'];

      for (const mode of validModes) {
        const sequence = {
          toolName: 'test',
          responses: [
            { content: [{ type: 'text', text: 'test' }] },
          ],
          cycleMode: mode as any,
        };

        const result = MockResponseSequenceSchema.parse(sequence);
        expect(result.cycleMode).toBe(mode);
      }
    });
  });

  describe('MockMCPServerDefinition Validation', () => {
    it('should validate complete server definition', () => {
      const definition: MockMCPServerDefinition = {
        serverConfig: {
          name: 'test-server',
          transport: 'stdio',
          capabilities: {
            tools: { listChanged: true },
          },
        },
        defaultBehavior: {
          toolHandlers: [
            {
              toolName: 'test_tool',
              response: {
                content: [{ type: 'text', text: 'test' }],
              },
            },
          ],
        },
        scenarios: [
          {
            name: 'test-scenario',
            serverConfig: {
              name: 'test-server',
              transport: 'stdio',
            },
            behaviorConfig: {
              responseDelay: { fixedMs: 100 },
            },
          },
        ],
        activeScenario: 'test-scenario',
      };

      const result = MockMCPServerDefinitionSchema.parse(definition);
      expect(result.serverConfig.name).toBe('test-server');
      expect(result.scenarios).toHaveLength(1);
      expect(result.activeScenario).toBe('test-scenario');
    });

    it('should apply defaults to server definition', () => {
      const definition = {
        serverConfig: {
          name: 'minimal-server',
        },
      };

      const result = MockMCPServerDefinitionSchema.parse(definition);
      expect(result.defaultBehavior).toBeDefined();
      expect(result.scenarios).toEqual([]);
      expect(result.activeScenario).toBeUndefined();
      expect(result.serverConfig.transport).toBe('stdio'); // default
    });

    it('should validate nested configurations', () => {
      const definition = {
        serverConfig: {
          name: 'nested-test',
          httpConfig: {
            host: '0.0.0.0',
            port: 8080,
            basePath: '/api',
          },
          sseConfig: {
            endpoint: '/events',
            keepAliveMs: 30000,
          },
        },
        defaultBehavior: {
          errorInjection: {
            enabled: true,
            probability: 0.5,
            methods: ['tools/call'],
          },
        },
      };

      const result = MockMCPServerDefinitionSchema.parse(definition);
      expect(result.serverConfig.httpConfig?.port).toBe(8080);
      expect(result.serverConfig.sseConfig?.keepAliveMs).toBe(30000);
      expect(result.defaultBehavior.errorInjection?.probability).toBe(0.5);
    });
  });
});