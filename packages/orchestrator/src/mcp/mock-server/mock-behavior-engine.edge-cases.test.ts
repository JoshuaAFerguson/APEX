/**
 * @fileoverview Edge case tests for MockBehaviorEngine dynamic handlers and response sequences
 *
 * Tests edge cases, error conditions, and boundary scenarios for the new functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockBehaviorEngine } from './mock-behavior-engine.js';
import type {
  MockBehaviorConfig,
  MockDynamicHandler,
  MockResponseSequence,
  MockDynamicHandlerFunction,
} from '@apexcli/core';

describe('MockBehaviorEngine Edge Cases', () => {
  let engine: MockBehaviorEngine;
  let baseConfig: MockBehaviorConfig;

  beforeEach(() => {
    baseConfig = {
      recordRequests: true,
      maxRecordedRequests: 100,
      validateRequests: true,
      enableDebugLogging: false,
      responseDelay: undefined,
      errorInjection: undefined,
      toolHandlers: [],
      notificationTriggers: [],
      defaultToolResponse: undefined,
      statefulBehavior: undefined,
      dynamicHandlers: [],
      responseSequences: [],
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Dynamic Handler Edge Cases', () => {
    it('should handle dynamic handlers that throw exceptions', async () => {
      const throwingHandler: MockDynamicHandlerFunction = vi.fn(async () => {
        throw new Error('Handler implementation error');
      });

      const dynamicHandler: MockDynamicHandler = {
        toolName: 'throwing_tool',
        handler: throwingHandler,
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        dynamicHandlers: [dynamicHandler],
      };
      engine = new MockBehaviorEngine(config);

      // Should propagate the exception
      await expect(engine.executeToolHandler('throwing_tool')).rejects.toThrow('Handler implementation error');
    });

    it('should handle dynamic handlers with zero maxInvocations', async () => {
      const handler: MockDynamicHandlerFunction = vi.fn(async () => ({
        content: [{ type: 'text', text: 'Should not be called' }],
        isError: false
      }));

      const dynamicHandler: MockDynamicHandler = {
        toolName: 'zero_invocation_tool',
        handler: handler,
        maxInvocations: 0, // Should never be available
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        dynamicHandlers: [dynamicHandler],
      };
      engine = new MockBehaviorEngine(config);

      const found = engine.findDynamicHandler('zero_invocation_tool');
      expect(found).toBeUndefined();
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle dynamic handlers with negative delays', async () => {
      const handler: MockDynamicHandlerFunction = vi.fn(async () => ({
        content: [{ type: 'text', text: 'Negative delay response' }],
        isError: false
      }));

      const dynamicHandler: MockDynamicHandler = {
        toolName: 'negative_delay_tool',
        handler: handler,
        delayMs: -50, // Negative delay should be treated as 0
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        dynamicHandlers: [dynamicHandler],
      };
      engine = new MockBehaviorEngine(config);

      const startTime = Date.now();
      const result = await engine.executeToolHandler('negative_delay_tool');
      const elapsedTime = Date.now() - startTime;

      expect(result!.content[0].text).toBe('Negative delay response');
      // Should not wait for negative delay
      expect(elapsedTime).toBeLessThan(10);
    });

    it('should handle dynamic handlers with complex argument validation', async () => {
      const handler: MockDynamicHandlerFunction = vi.fn(async (toolName, args) => ({
        content: [{ type: 'text', text: `Args: ${JSON.stringify(args)}` }],
        isError: false
      }));

      const dynamicHandler: MockDynamicHandler = {
        toolName: 'complex_args_tool',
        handler: handler,
        matchArgs: {
          nested: {
            deep: {
              value: 'specific'
            }
          },
          array: [1, 2, 3],
          boolean: true
        },
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        dynamicHandlers: [dynamicHandler],
      };
      engine = new MockBehaviorEngine(config);

      // Should not match partial args
      const notFound1 = engine.findDynamicHandler('complex_args_tool', {
        nested: { deep: { value: 'wrong' } }
      });
      expect(notFound1).toBeUndefined();

      // Should not match missing nested structure
      const notFound2 = engine.findDynamicHandler('complex_args_tool', {
        nested: { wrong: 'structure' }
      });
      expect(notFound2).toBeUndefined();

      // Should match exact structure with additional fields
      const found = engine.findDynamicHandler('complex_args_tool', {
        nested: {
          deep: { value: 'specific' },
          extra: 'ignored'
        },
        array: [1, 2, 3],
        boolean: true,
        extraField: 'should be ignored'
      });
      expect(found).toBe(dynamicHandler);
    });

    it('should handle extremely high invocation counts', async () => {
      const handler: MockDynamicHandlerFunction = vi.fn(async (toolName, args, context) => ({
        content: [{ type: 'text', text: `Count: ${context.invocationCount}` }],
        isError: false
      }));

      const dynamicHandler: MockDynamicHandler = {
        toolName: 'high_count_tool',
        handler: handler,
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        dynamicHandlers: [dynamicHandler],
      };
      engine = new MockBehaviorEngine(config);

      // Execute many times to test high invocation counts
      let lastResult;
      for (let i = 1; i <= 1000; i++) {
        lastResult = await engine.executeToolHandler('high_count_tool');
        expect(lastResult!.content[0].text).toBe(`Count: ${i}`);
      }

      // Verify final count
      expect(lastResult!.content[0].text).toBe('Count: 1000');
    });
  });

  describe('Response Sequence Edge Cases', () => {
    it('should handle empty response sequences', async () => {
      const emptySequence: MockResponseSequence = {
        toolName: 'empty_sequence',
        responses: [], // Empty array
        cycleMode: 'cycle',
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        responseSequences: [emptySequence],
      };
      engine = new MockBehaviorEngine(config);

      // Should return undefined for empty sequence
      const result = await engine.executeToolHandler('empty_sequence');
      expect(result).toBeUndefined();
    });

    it('should handle response sequences with invalid cycle modes', async () => {
      const sequence: MockResponseSequence = {
        toolName: 'invalid_cycle_tool',
        responses: [
          { content: [{ type: 'text', text: 'Only response' }], isError: false },
        ],
        cycleMode: 'invalid_mode' as any, // Invalid cycle mode
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        responseSequences: [sequence],
      };
      engine = new MockBehaviorEngine(config);

      // Should default to cycling behavior
      const result1 = await engine.executeToolHandler('invalid_cycle_tool');
      expect(result1!.content[0].text).toBe('Only response');

      const result2 = await engine.executeToolHandler('invalid_cycle_tool');
      expect(result2!.content[0].text).toBe('Only response'); // Should cycle
    });

    it('should handle response sequences with negative delays', async () => {
      const sequence: MockResponseSequence = {
        toolName: 'negative_delay_sequence',
        responses: [
          {
            content: [{ type: 'text', text: 'Negative delay response' }],
            isError: false,
            delayMs: -100 // Negative delay
          },
        ],
        cycleMode: 'cycle',
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        responseSequences: [sequence],
      };
      engine = new MockBehaviorEngine(config);

      const startTime = Date.now();
      const result = await engine.executeToolHandler('negative_delay_sequence');
      const elapsedTime = Date.now() - startTime;

      expect(result!.content[0].text).toBe('Negative delay response');
      // Should not wait for negative delay
      expect(elapsedTime).toBeLessThan(10);
    });

    it('should handle concurrent calls to the same sequence tool', async () => {
      const sequence: MockResponseSequence = {
        toolName: 'concurrent_sequence',
        responses: [
          { content: [{ type: 'text', text: 'Response-1' }], isError: false, delayMs: 50 },
          { content: [{ type: 'text', text: 'Response-2' }], isError: false, delayMs: 30 },
          { content: [{ type: 'text', text: 'Response-3' }], isError: false, delayMs: 10 },
        ],
        cycleMode: 'cycle',
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        responseSequences: [sequence],
      };
      engine = new MockBehaviorEngine(config);

      // Start three concurrent calls
      const promises = [
        engine.executeToolHandler('concurrent_sequence'),
        engine.executeToolHandler('concurrent_sequence'),
        engine.executeToolHandler('concurrent_sequence'),
      ];

      const results = await Promise.all(promises);

      // Each call should get the correct response based on when it was initiated
      // Note: Due to the way invocation counts work, the order depends on when findResponseSequence is called
      expect(results[0]!.content[0].text).toMatch(/^Response-[1-3]$/);
      expect(results[1]!.content[0].text).toMatch(/^Response-[1-3]$/);
      expect(results[2]!.content[0].text).toMatch(/^Response-[1-3]$/);

      // All responses should be different (since they're processed sequentially in terms of invocation counting)
      const responseTexts = results.map(r => r!.content[0].text);
      expect(new Set(responseTexts).size).toBe(3); // All different responses
    });

    it('should handle extremely long response sequences', async () => {
      // Create a sequence with 1000 responses
      const responses = Array.from({ length: 1000 }, (_, i) => ({
        content: [{ type: 'text', text: `Response-${i + 1}` }],
        isError: false
      }));

      const longSequence: MockResponseSequence = {
        toolName: 'long_sequence',
        responses,
        cycleMode: 'cycle',
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        responseSequences: [longSequence],
      };
      engine = new MockBehaviorEngine(config);

      // Test random access within the long sequence
      for (let i = 1; i <= 10; i++) {
        const result = await engine.executeToolHandler('long_sequence');
        expect(result!.content[0].text).toBe(`Response-${i}`);
      }

      // Jump to near the end
      for (let i = 11; i <= 1000; i++) {
        await engine.executeToolHandler('long_sequence');
      }

      // Should cycle back to beginning
      const cycledResult = await engine.executeToolHandler('long_sequence');
      expect(cycledResult!.content[0].text).toBe('Response-1');
    });
  });

  describe('Priority Resolution Edge Cases', () => {
    it('should handle handlers with same priority', async () => {
      const staticHandler = {
        toolName: 'same_priority',
        response: { content: [{ type: 'text', text: 'Static' }], isError: false },
        priority: 50,
      };

      const dynamicHandler: MockDynamicHandler = {
        toolName: 'same_priority',
        handler: vi.fn(async () => ({
          content: [{ type: 'text', text: 'Dynamic' }],
          isError: false
        })),
        priority: 50, // Same priority
      };

      const sequenceHandler: MockResponseSequence = {
        toolName: 'same_priority',
        responses: [
          { content: [{ type: 'text', text: 'Sequence' }], isError: false },
        ],
        cycleMode: 'cycle',
        priority: 50, // Same priority
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        toolHandlers: [staticHandler],
        dynamicHandlers: [dynamicHandler],
        responseSequences: [sequenceHandler],
      };
      engine = new MockBehaviorEngine(config);

      // With same priority, order in the candidates array determines precedence
      // Implementation detail: the order should be predictable based on the findBestToolHandler method
      const result = await engine.executeToolHandler('same_priority');
      expect(result).toBeDefined();
      // The result will be one of the handlers - exact behavior depends on implementation
    });

    it('should handle priority values at extreme bounds', async () => {
      const veryLowPriority: MockDynamicHandler = {
        toolName: 'extreme_priority',
        handler: vi.fn(async () => ({
          content: [{ type: 'text', text: 'Very Low' }],
          isError: false
        })),
        priority: Number.MIN_SAFE_INTEGER,
      };

      const veryHighPriority: MockResponseSequence = {
        toolName: 'extreme_priority',
        responses: [
          { content: [{ type: 'text', text: 'Very High' }], isError: false },
        ],
        cycleMode: 'cycle',
        priority: Number.MAX_SAFE_INTEGER,
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        dynamicHandlers: [veryLowPriority],
        responseSequences: [veryHighPriority],
      };
      engine = new MockBehaviorEngine(config);

      const result = await engine.executeToolHandler('extreme_priority');
      expect(result!.content[0].text).toBe('Very High');
    });

    it('should handle undefined priority values', async () => {
      const noPriorityDynamic: MockDynamicHandler = {
        toolName: 'no_priority',
        handler: vi.fn(async () => ({
          content: [{ type: 'text', text: 'No Priority Dynamic' }],
          isError: false
        })),
        // No priority field - should default to 50
      };

      const lowPrioritySequence: MockResponseSequence = {
        toolName: 'no_priority',
        responses: [
          { content: [{ type: 'text', text: 'Low Priority Sequence' }], isError: false },
        ],
        cycleMode: 'cycle',
        priority: 30, // Lower than default 50
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        dynamicHandlers: [noPriorityDynamic],
        responseSequences: [lowPrioritySequence],
      };
      engine = new MockBehaviorEngine(config);

      // Dynamic handler should be chosen due to higher default priority (50 > 30)
      const result = await engine.executeToolHandler('no_priority');
      expect(result!.content[0].text).toBe('No Priority Dynamic');
    });
  });

  describe('State-based Handler Selection Edge Cases', () => {
    it('should handle state-specific handlers that become unavailable', async () => {
      const globalDynamic: MockDynamicHandler = {
        toolName: 'state_test',
        handler: vi.fn(async () => ({
          content: [{ type: 'text', text: 'Global Dynamic' }],
          isError: false
        })),
        maxInvocations: 5,
      };

      const stateDynamic: MockDynamicHandler = {
        toolName: 'state_test',
        handler: vi.fn(async () => ({
          content: [{ type: 'text', text: 'State Dynamic' }],
          isError: false
        })),
        maxInvocations: 2, // Limited invocations
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        dynamicHandlers: [globalDynamic],
        statefulBehavior: {
          initialState: 'active',
          stateBehaviors: [{
            state: 'active',
            dynamicHandlers: [stateDynamic],
            toolHandlers: [],
            responseSequences: [],
            responseDelay: undefined,
            errorInjection: undefined,
          }],
          transitions: [],
        },
      };
      engine = new MockBehaviorEngine(config);

      // First two calls should use state-specific handler
      const result1 = await engine.executeToolHandler('state_test');
      expect(result1!.content[0].text).toBe('State Dynamic');

      const result2 = await engine.executeToolHandler('state_test');
      expect(result2!.content[0].text).toBe('State Dynamic');

      // Third call should fall back to global handler (state handler exhausted)
      const result3 = await engine.executeToolHandler('state_test');
      expect(result3!.content[0].text).toBe('Global Dynamic');
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle tool names with special characters', async () => {
      const specialNameHandler: MockDynamicHandler = {
        toolName: 'tool-with_special.characters@2024!',
        handler: vi.fn(async () => ({
          content: [{ type: 'text', text: 'Special name response' }],
          isError: false
        })),
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        dynamicHandlers: [specialNameHandler],
      };
      engine = new MockBehaviorEngine(config);

      const result = await engine.executeToolHandler('tool-with_special.characters@2024!');
      expect(result!.content[0].text).toBe('Special name response');
    });

    it('should handle very large response content', async () => {
      const largeContentHandler: MockDynamicHandler = {
        toolName: 'large_content',
        handler: vi.fn(async () => {
          const largeText = 'x'.repeat(10000); // 10KB of text
          return {
            content: [{ type: 'text', text: largeText }],
            isError: false
          };
        }),
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        dynamicHandlers: [largeContentHandler],
      };
      engine = new MockBehaviorEngine(config);

      const result = await engine.executeToolHandler('large_content');
      expect(result!.content[0].text).toHaveLength(10000);
    });
  });
});