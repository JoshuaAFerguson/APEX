/**
 * @fileoverview Additional Test Coverage for MockMCPServerBuilder
 *
 * Tests for specific edge cases and scenarios that enhance the existing test coverage.
 * Focuses on real-world usage patterns and boundary conditions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockMCPServerBuilder, createMockServerBuilder } from '../mock-mcp-server-builder.js';
import type { MockDynamicHandlerFunction } from '@apexcli/core';

describe('MockMCPServerBuilder - Additional Coverage', () => {
  let builder: MockMCPServerBuilder;

  beforeEach(() => {
    builder = new MockMCPServerBuilder();
  });

  describe('Response Sequence Advanced Scenarios', () => {
    it('should handle response sequences with mixed content types', () => {
      const mixedResponses = [
        { content: [{ type: 'text', text: 'Text response' }], isError: false },
        { content: [{ type: 'image', data: 'base64-image-data', mimeType: 'image/png' }], isError: false },
        { content: [{ type: 'text', text: 'Error response' }], isError: true },
        { content: [
          { type: 'text', text: 'Multi-content response' },
          { type: 'image', data: 'another-image', mimeType: 'image/jpeg' }
        ], isError: false }
      ];

      const definition = builder
        .withName('mixed-content-test')
        .withTool('mixed-sequence')
        .withResponseSequence(mixedResponses, 'repeat_last')
        .buildDefinition();

      const sequence = definition.defaultBehavior.responseSequences![0];
      expect(sequence.responses).toHaveLength(4);
      expect(sequence.cycleMode).toBe('repeat_last');
      expect(sequence.responses[1].content[0].type).toBe('image');
      expect(sequence.responses[2].isError).toBe(true);
      expect(sequence.responses[3].content).toHaveLength(2);
    });

    it('should handle empty response sequences gracefully', () => {
      expect(() => {
        builder
          .withName('empty-sequence-test')
          .withTool('empty-sequence')
          .withResponseSequence([], 'cycle')
          .buildDefinition();
      }).not.toThrow();

      const definition = builder
        .withName('empty-sequence-test')
        .withTool('empty-sequence')
        .withResponseSequence([], 'cycle')
        .buildDefinition();

      const sequence = definition.defaultBehavior.responseSequences![0];
      expect(sequence.responses).toHaveLength(0);
    });

    it('should handle response sequences with variable delays', () => {
      const responsesWithDelays = [
        { content: [{ type: 'text', text: 'Instant response' }], delayMs: 0 },
        { content: [{ type: 'text', text: 'Fast response' }], delayMs: 50 },
        { content: [{ type: 'text', text: 'Slow response' }], delayMs: 500 },
        { content: [{ type: 'text', text: 'Very slow response' }], delayMs: 1000 }
      ];

      const definition = builder
        .withName('variable-delay-test')
        .withTool('delayed-sequence')
        .withResponseSequence(responsesWithDelays, 'stop_at_end')
        .buildDefinition();

      const sequence = definition.defaultBehavior.responseSequences![0];
      expect(sequence.responses[0].delayMs).toBe(0);
      expect(sequence.responses[1].delayMs).toBe(50);
      expect(sequence.responses[2].delayMs).toBe(500);
      expect(sequence.responses[3].delayMs).toBe(1000);
    });
  });

  describe('Dynamic Handler Advanced Patterns', () => {
    it('should handle async handlers with Promise.resolve', async () => {
      const asyncHandler: MockDynamicHandlerFunction = (toolName, args) =>
        Promise.resolve({
          content: [{ type: 'text', text: `Async ${toolName} with ${JSON.stringify(args)}` }],
          isError: false,
        });

      const definition = builder
        .withName('async-handler-test')
        .withTool('async-tool')
        .withDynamicHandler(asyncHandler)
        .buildDefinition();

      expect(definition.defaultBehavior.dynamicHandlers![0].handler).toBe(asyncHandler);
    });

    it('should handle handlers with complex argument matching', () => {
      const complexMatcher = {
        type: 'file',
        operation: 'read',
        metadata: { required: true, format: 'json' }
      };

      const handler: MockDynamicHandlerFunction = async (toolName, args) => ({
        content: [{ type: 'text', text: `Matched complex args for ${toolName}` }],
        isError: false,
      });

      const definition = builder
        .withName('complex-matcher-test')
        .withTool('complex-tool')
        .withDynamicHandler(handler, { matchArgs: complexMatcher, priority: 90 })
        .buildDefinition();

      const dynamicHandler = definition.defaultBehavior.dynamicHandlers![0];
      expect(dynamicHandler.matchArgs).toEqual(complexMatcher);
      expect(dynamicHandler.priority).toBe(90);
    });

    it('should handle handlers with zero max invocations', () => {
      const handler: MockDynamicHandlerFunction = async () => ({
        content: [{ type: 'text', text: 'Should not be called' }],
        isError: false,
      });

      const definition = builder
        .withName('zero-invocation-test')
        .withTool('limited-tool')
        .withDynamicHandler(handler, { maxInvocations: 0 })
        .buildDefinition();

      expect(definition.defaultBehavior.dynamicHandlers![0].maxInvocations).toBe(0);
    });
  });

  describe('Scenario Configuration Edge Cases', () => {
    it('should handle scenarios with identical names (overwrites)', () => {
      const definition = builder
        .withName('duplicate-scenario-test')
        .withScenario('duplicate', scenario => scenario
          .withTool('tool1')
          .withStaticResponse([{ type: 'text', text: 'First scenario' }])
        )
        .withScenario('duplicate', scenario => scenario
          .withTool('tool2')
          .withStaticResponse([{ type: 'text', text: 'Second scenario' }])
        )
        .buildDefinition();

      // Should have both scenarios (they have different configurations)
      expect(definition.scenarios).toHaveLength(2);
      expect(definition.scenarios[0].name).toBe('duplicate');
      expect(definition.scenarios[1].name).toBe('duplicate');
    });

    it('should handle scenario configuration with all optional parameters', () => {
      const definition = builder
        .withName('minimal-scenario-test')
        .withScenario('minimal', scenario => scenario)
        .buildDefinition();

      const scenario = definition.scenarios[0];
      expect(scenario.name).toBe('minimal');
      expect(scenario.behaviorConfig.toolHandlers).toHaveLength(0);
    });

    it('should handle nested scenario configurations', () => {
      const definition = builder
        .withName('nested-scenario-test')
        .withTool('base-tool')
        .withStaticResponse([{ type: 'text', text: 'Base response' }])
        .withScenario('nested', scenario => scenario
          .withTool('scenario-tool')
          .withStaticResponse([{ type: 'text', text: 'Scenario response' }])
          .withDelay(100)
          .withErrorInjection({ enabled: true, probability: 0.5 })
        )
        .buildDefinition();

      const scenario = definition.scenarios[0];
      expect(scenario.behaviorConfig.toolHandlers).toHaveLength(1);
      expect(scenario.behaviorConfig.responseDelay?.fixedMs).toBe(100);
      expect(scenario.behaviorConfig.errorInjection?.enabled).toBe(true);
    });
  });

  describe('Server Configuration Edge Cases', () => {
    it('should handle all supported transport types', () => {
      const transports = ['stdio', 'http', 'sse'] as const;

      transports.forEach(transport => {
        const definition = builder
          .withName(`${transport}-test`)
          .withTransport(transport)
          .buildDefinition();

        expect(definition.serverConfig.transport).toBe(transport);
      });
    });

    it('should handle complex capabilities configuration', () => {
      const complexCapabilities = {
        tools: {
          listChanged: true,
        },
        resources: {
          subscribe: true,
          listChanged: false,
        },
        prompts: {
          listChanged: true,
        },
        logging: {},
      };

      const definition = builder
        .withName('complex-capabilities-test')
        .withCapabilities(complexCapabilities)
        .buildDefinition();

      expect(definition.serverConfig.capabilities).toEqual(complexCapabilities);
    });

    it('should handle server names with special characters and Unicode', () => {
      const specialNames = [
        'test-server_123',
        'тест-сервер',
        '测试服务器',
        'test.server@domain.com',
        'server-with-émojis-🚀',
        '!@#$%^&*()_+-=[]{}|;:,.<>?'
      ];

      specialNames.forEach(name => {
        const definition = builder
          .withName(name)
          .buildDefinition();

        expect(definition.serverConfig.name).toBe(name);
      });
    });
  });

  describe('Method Chaining Corner Cases', () => {
    it('should handle rapid switching between tool configurations', () => {
      const definition = builder
        .withName('rapid-switch-test')
        .withTool('tool1')
        .withStaticResponse([{ type: 'text', text: 'response1' }])
        .withTool('tool2')
        .withDynamicHandler(async () => ({ content: [{ type: 'text', text: 'dynamic' }], isError: false }))
        .withTool('tool3')
        .withResponseSequence([
          { content: [{ type: 'text', text: 'seq1' }] },
          { content: [{ type: 'text', text: 'seq2' }] }
        ])
        .withTool('tool4')
        .withStaticResponse([{ type: 'text', text: 'final' }])
        .buildDefinition();

      expect(definition.defaultBehavior.toolHandlers).toHaveLength(2); // tool1 and tool4
      expect(definition.defaultBehavior.dynamicHandlers).toHaveLength(1); // tool2
      expect(definition.defaultBehavior.responseSequences).toHaveLength(1); // tool3
    });

    it('should handle configuration methods called multiple times', () => {
      const definition = builder
        .withName('multiple-calls-test')
        .withDelay(100)
        .withDelay(200, 300) // Should override previous
        .withTransport('stdio')
        .withTransport('http') // Should override previous
        .buildDefinition();

      expect(definition.defaultBehavior.responseDelay?.minMs).toBe(200);
      expect(definition.defaultBehavior.responseDelay?.maxMs).toBe(300);
      expect(definition.serverConfig.transport).toBe('http');
    });
  });

  describe('Factory Function Scenarios', () => {
    it('should create independent builders via factory', () => {
      const builder1 = createMockServerBuilder();
      const builder2 = createMockServerBuilder();

      builder1.withName('factory-1');
      builder2.withName('factory-2');

      const def1 = builder1.buildDefinition();
      const def2 = builder2.buildDefinition();

      expect(def1.serverConfig.name).toBe('factory-1');
      expect(def2.serverConfig.name).toBe('factory-2');
    });

    it('should support fluent chaining from factory', () => {
      const definition = createMockServerBuilder()
        .withName('factory-chain')
        .withTool('chain-tool')
        .withStaticResponse([{ type: 'text', text: 'factory response' }])
        .buildDefinition();

      expect(definition.serverConfig.name).toBe('factory-chain');
      expect(definition.defaultBehavior.toolHandlers[0].toolName).toBe('chain-tool');
    });
  });

  describe('Real-World Usage Patterns', () => {
    it('should support file system operation mocking pattern', () => {
      const definition = createMockServerBuilder()
        .withName('filesystem-mock')
        .withTool('read_file')
        .withDynamicHandler(async (toolName, args) => {
          const path = args.path as string;
          if (path.endsWith('.json')) {
            return {
              content: [{ type: 'text', text: '{"mock": "json content"}' }],
              isError: false,
            };
          }
          return {
            content: [{ type: 'text', text: 'mock file content' }],
            isError: false,
          };
        })
        .withTool('write_file')
        .withStaticResponse([{ type: 'text', text: 'File written successfully' }])
        .withTool('list_directory')
        .withResponseSequence([
          { content: [{ type: 'text', text: 'file1.txt\nfile2.json' }] },
          { content: [{ type: 'text', text: 'file1.txt\nfile2.json\nfile3.md' }] }
        ], 'repeat_last')
        .withDelay(10, 50) // Simulate file system latency
        .buildDefinition();

      expect(definition.defaultBehavior.toolHandlers).toHaveLength(1); // write_file
      expect(definition.defaultBehavior.dynamicHandlers).toHaveLength(1); // read_file
      expect(definition.defaultBehavior.responseSequences).toHaveLength(1); // list_directory
    });

    it('should support API client mocking pattern', () => {
      const definition = createMockServerBuilder()
        .withName('api-client-mock')
        .withTool('http_get')
        .withDynamicHandler(async (toolName, args) => {
          const url = args.url as string;
          const statusCode = url.includes('error') ? 500 : 200;
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                status: statusCode,
                data: url.includes('users') ? { id: 1, name: 'John' } : { message: 'success' }
              })
            }],
            isError: statusCode >= 400,
          };
        })
        .withTool('http_post')
        .withStaticResponse([{
          type: 'text',
          text: JSON.stringify({ status: 201, data: { id: 123, created: true } })
        }])
        .withScenario('network-error', scenario => scenario
          .withErrorInjection({
            enabled: true,
            probability: 1.0,
            errorMessage: 'Network timeout',
            errorCode: -32002
          })
        )
        .withScenario('slow-network', scenario => scenario
          .withDelay(1000, 3000)
        )
        .buildDefinition();

      expect(definition.scenarios).toHaveLength(2);
      expect(definition.scenarios[0].behaviorConfig.errorInjection?.errorMessage).toBe('Network timeout');
      expect(definition.scenarios[1].behaviorConfig.responseDelay?.minMs).toBe(1000);
    });
  });
});