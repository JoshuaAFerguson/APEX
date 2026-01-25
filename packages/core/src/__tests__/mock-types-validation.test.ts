/**
 * @fileoverview Basic validation tests for new mock response types
 *
 * Essential tests to verify the new MockDynamicHandler, MockResponseSequence,
 * and updated MockToolHandler types work correctly and are properly exported.
 *
 * @module @apex/core/__tests__/mock-types-validation.test
 */

import { describe, it, expect, vi } from 'vitest';
import {
  MockDynamicHandlerSchema,
  MockResponseSequenceSchema,
  MockToolHandlerSchema,
  MockBehaviorConfigSchema,
  type MockDynamicHandler,
  type MockResponseSequence,
  type MockToolHandler,
  type MockDynamicHandlerFunction,
} from '../mcp/mock-types.js';

describe('New Mock Types Validation', () => {
  describe('MockDynamicHandler', () => {
    it('should validate basic dynamic handler', () => {
      const handler = {
        toolName: 'test-tool',
        handler: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'response' }],
          isError: false,
        }),
      };

      const result = MockDynamicHandlerSchema.parse(handler);
      expect(result.toolName).toBe('test-tool');
      expect(result.priority).toBe(50); // default
    });

    it('should validate dynamic handler with all fields', () => {
      const handler: MockDynamicHandler = {
        toolName: 'advanced-tool',
        handler: vi.fn().mockResolvedValue({ content: [], isError: false }),
        matchArgs: { mode: 'advanced' },
        delayMs: 100,
        maxInvocations: 10,
        priority: 80,
      };

      const result = MockDynamicHandlerSchema.parse(handler);
      expect(result.matchArgs).toEqual({ mode: 'advanced' });
      expect(result.priority).toBe(80);
    });

    it('should work with typed function', async () => {
      const mockFunc: MockDynamicHandlerFunction = async (toolName, args, context) => {
        return {
          content: [{ type: 'text', text: `${toolName}: ${context.invocationCount}` }],
          isError: false,
        };
      };

      const handler = MockDynamicHandlerSchema.parse({
        toolName: 'typed-tool',
        handler: mockFunc,
      });

      const response = await handler.handler(
        'typed-tool',
        {},
        { requestId: 'req-1', invocationCount: 5, timestamp: new Date() }
      );

      expect(response.content[0]).toEqual({
        type: 'text',
        text: 'typed-tool: 5',
      });
    });
  });

  describe('MockResponseSequence', () => {
    it('should validate basic sequence', () => {
      const sequence = {
        toolName: 'seq-tool',
        responses: [
          { content: [{ type: 'text', text: 'step 1' }], isError: false },
          { content: [{ type: 'text', text: 'step 2' }], isError: false },
        ],
      };

      const result = MockResponseSequenceSchema.parse(sequence);
      expect(result.responses).toHaveLength(2);
      expect(result.cycleMode).toBe('cycle'); // default
    });

    it('should validate sequence with all options', () => {
      const sequence: MockResponseSequence = {
        toolName: 'complex-seq',
        responses: [
          { content: [{ type: 'text', text: 'start' }], isError: false, delayMs: 100 },
          { content: [{ type: 'text', text: 'error' }], isError: true },
          { content: [{ type: 'text', text: 'end' }], isError: false, delayMs: 200 },
        ],
        matchArgs: { operation: 'complex' },
        cycleMode: 'repeat_last',
        priority: 90,
      };

      const result = MockResponseSequenceSchema.parse(sequence);
      expect(result.cycleMode).toBe('repeat_last');
      expect(result.priority).toBe(90);
      expect(result.responses[1].isError).toBe(true);
    });

    it('should reject empty responses array', () => {
      expect(() =>
        MockResponseSequenceSchema.parse({
          toolName: 'empty-seq',
          responses: [],
        })
      ).toThrow();
    });

    it('should validate cycle mode options', () => {
      const validModes = ['cycle', 'repeat_last', 'stop_at_end'];
      validModes.forEach(mode => {
        const sequence = {
          toolName: 'test',
          responses: [{ content: [], isError: false }],
          cycleMode: mode,
        };
        expect(() => MockResponseSequenceSchema.parse(sequence)).not.toThrow();
      });
    });
  });

  describe('Updated MockToolHandler', () => {
    it('should include priority field', () => {
      const handler = {
        toolName: 'priority-tool',
        response: { content: [], isError: false },
        priority: 75,
      };

      const result = MockToolHandlerSchema.parse(handler);
      expect(result.priority).toBe(75);
    });

    it('should use default priority when not specified', () => {
      const handler = {
        toolName: 'default-tool',
        response: { content: [], isError: false },
      };

      const result = MockToolHandlerSchema.parse(handler);
      expect(result.priority).toBe(50); // default value
    });

    it('should maintain type compatibility', () => {
      const handler: MockToolHandler = {
        toolName: 'typed-tool',
        response: {
          content: [{ type: 'text', text: 'typed response' }],
          isError: false,
        },
        matchArgs: { category: 'test' },
        delayMs: 50,
        maxInvocations: 3,
        priority: 85,
      };

      const result = MockToolHandlerSchema.parse(handler);
      expect(result.priority).toBe(85);
    });
  });

  describe('MockBehaviorConfig Integration', () => {
    it('should support all new handler types together', () => {
      const config = {
        toolHandlers: [
          {
            toolName: 'static-tool',
            response: { content: [{ type: 'text', text: 'static' }], isError: false },
            priority: 40,
          },
        ],
        dynamicHandlers: [
          {
            toolName: 'dynamic-tool',
            handler: vi.fn().mockResolvedValue({ content: [], isError: false }),
            priority: 80,
          },
        ],
        responseSequences: [
          {
            toolName: 'sequence-tool',
            responses: [{ content: [], isError: false }],
            priority: 60,
          },
        ],
      };

      const result = MockBehaviorConfigSchema.parse(config);

      expect(result.toolHandlers).toHaveLength(1);
      expect(result.dynamicHandlers).toHaveLength(1);
      expect(result.responseSequences).toHaveLength(1);

      expect(result.toolHandlers[0].priority).toBe(40);
      expect(result.dynamicHandlers[0].priority).toBe(80);
      expect(result.responseSequences[0].priority).toBe(60);
    });

    it('should handle priority-based handler resolution scenarios', () => {
      const config = {
        // Multiple handlers for the same tool with different priorities
        toolHandlers: [
          {
            toolName: 'multi-tool',
            response: { content: [{ type: 'text', text: 'low priority' }], isError: false },
            priority: 30,
          },
          {
            toolName: 'multi-tool',
            response: { content: [{ type: 'text', text: 'high priority' }], isError: false },
            priority: 90,
          },
        ],
        dynamicHandlers: [
          {
            toolName: 'multi-tool',
            handler: vi.fn().mockResolvedValue({
              content: [{ type: 'text', text: 'dynamic' }],
              isError: false,
            }),
            priority: 70,
          },
        ],
        responseSequences: [
          {
            toolName: 'multi-tool',
            responses: [{ content: [{ type: 'text', text: 'sequence' }], isError: false }],
            priority: 50,
          },
        ],
      };

      const result = MockBehaviorConfigSchema.parse(config);

      // All handlers should be preserved
      expect(result.toolHandlers).toHaveLength(2);
      expect(result.dynamicHandlers).toHaveLength(1);
      expect(result.responseSequences).toHaveLength(1);

      // Verify priority ordering: high static (90), dynamic (70), sequence (50), low static (30)
      const priorities = [
        ...result.toolHandlers.map(h => h.priority),
        ...result.dynamicHandlers.map(h => h.priority),
        ...result.responseSequences.map(h => h.priority),
      ].sort((a, b) => b - a);

      expect(priorities).toEqual([90, 70, 50, 30]);
    });
  });

  describe('Error Handling', () => {
    it('should reject negative priorities', () => {
      expect(() =>
        MockToolHandlerSchema.parse({
          toolName: 'test',
          response: { content: [], isError: false },
          priority: -1,
        })
      ).toThrow();

      expect(() =>
        MockDynamicHandlerSchema.parse({
          toolName: 'test',
          handler: vi.fn().mockResolvedValue({ content: [], isError: false }),
          priority: -5,
        })
      ).toThrow();

      expect(() =>
        MockResponseSequenceSchema.parse({
          toolName: 'test',
          responses: [{ content: [], isError: false }],
          priority: -10,
        })
      ).toThrow();
    });

    it('should reject invalid cycle modes', () => {
      expect(() =>
        MockResponseSequenceSchema.parse({
          toolName: 'test',
          responses: [{ content: [], isError: false }],
          cycleMode: 'invalid-mode',
        })
      ).toThrow();
    });

    it('should validate required fields', () => {
      expect(() =>
        MockDynamicHandlerSchema.parse({
          // Missing toolName
          handler: vi.fn().mockResolvedValue({ content: [], isError: false }),
        })
      ).toThrow();

      expect(() =>
        MockResponseSequenceSchema.parse({
          // Missing responses
          toolName: 'test',
        })
      ).toThrow();
    });
  });
});