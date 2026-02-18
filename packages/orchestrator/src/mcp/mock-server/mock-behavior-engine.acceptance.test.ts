/**
 * @fileoverview Acceptance tests for MockBehaviorEngine dynamic handlers and response sequences
 *
 * These tests specifically validate the acceptance criteria:
 * - MockBehaviorEngine can execute dynamic handler callbacks
 * - Track call counts per tool for sequences
 * - Return the correct response based on invocation order
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockBehaviorEngine } from './mock-behavior-engine.js';
import type {
  MockBehaviorConfig,
  MockDynamicHandler,
  MockResponseSequence,
  MockDynamicHandlerFunction,
} from '@apexcli/core';

describe('MockBehaviorEngine Acceptance Tests', () => {
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

  describe('Dynamic Handler Execution', () => {
    it('should execute dynamic handler callbacks with correct context', async () => {
      const mockHandler: MockDynamicHandlerFunction = vi.fn(async (toolName, args, context) => {
        // Validate the context passed to the dynamic handler
        expect(context.requestId).toMatch(/^req_\d+_[a-z0-9]{9}$/);
        expect(context.invocationCount).toBeGreaterThan(0);
        expect(context.timestamp).toBeInstanceOf(Date);

        return {
          content: [{
            type: 'text',
            text: `Dynamic response for ${toolName} with requestId ${context.requestId}, call ${context.invocationCount}`
          }],
          isError: false
        };
      });

      const dynamicHandler: MockDynamicHandler = {
        toolName: 'test_dynamic_tool',
        handler: mockHandler,
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        dynamicHandlers: [dynamicHandler],
      };
      engine = new MockBehaviorEngine(config);

      // First execution
      const result1 = await engine.executeToolHandler('test_dynamic_tool', { param: 'value1' });
      expect(result1).toBeDefined();
      expect(result1!.content[0]).toMatchObject({
        type: 'text',
        text: expect.stringContaining('Dynamic response for test_dynamic_tool')
      });
      expect(result1!.content[0].text).toContain('call 1');

      // Second execution - should increment invocation count
      const result2 = await engine.executeToolHandler('test_dynamic_tool', { param: 'value2' });
      expect(result2!.content[0].text).toContain('call 2');

      // Verify the handler was called twice with correct parameters
      expect(mockHandler).toHaveBeenCalledTimes(2);
      expect(mockHandler).toHaveBeenNthCalledWith(
        1,
        'test_dynamic_tool',
        { param: 'value1' },
        expect.objectContaining({ invocationCount: 1 })
      );
      expect(mockHandler).toHaveBeenNthCalledWith(
        2,
        'test_dynamic_tool',
        { param: 'value2' },
        expect.objectContaining({ invocationCount: 2 })
      );
    });

    it('should execute dynamic handlers that return errors', async () => {
      const errorHandler: MockDynamicHandlerFunction = vi.fn(async (toolName, args, context) => {
        return {
          content: [{
            type: 'text',
            text: `Error in ${toolName}: Invalid operation`
          }],
          isError: true
        };
      });

      const dynamicHandler: MockDynamicHandler = {
        toolName: 'error_tool',
        handler: errorHandler,
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        dynamicHandlers: [dynamicHandler],
      };
      engine = new MockBehaviorEngine(config);

      const result = await engine.executeToolHandler('error_tool');
      expect(result).toBeDefined();
      expect(result!.isError).toBe(true);
      expect(result!.content[0]).toMatchObject({
        type: 'text',
        text: 'Error in error_tool: Invalid operation'
      });
    });

    it('should apply dynamic handler delay correctly', async () => {
      const delayedHandler: MockDynamicHandler = {
        toolName: 'delayed_tool',
        handler: vi.fn(async () => ({
          content: [{ type: 'text', text: 'Delayed response' }],
          isError: false
        })),
        delayMs: 50,
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        dynamicHandlers: [delayedHandler],
      };
      engine = new MockBehaviorEngine(config);

      const startTime = Date.now();
      await engine.executeToolHandler('delayed_tool');
      const elapsedTime = Date.now() - startTime;

      expect(elapsedTime).toBeGreaterThanOrEqual(45); // Allow for timing variance
    });
  });

  describe('Response Sequence Call Count Tracking', () => {
    it('should track call counts per tool for sequences independently', async () => {
      const sequence1: MockResponseSequence = {
        toolName: 'sequence_tool_1',
        responses: [
          { content: [{ type: 'text', text: 'Tool1-Response1' }], isError: false },
          { content: [{ type: 'text', text: 'Tool1-Response2' }], isError: false },
          { content: [{ type: 'text', text: 'Tool1-Response3' }], isError: false },
        ],
        cycleMode: 'cycle',
      };

      const sequence2: MockResponseSequence = {
        toolName: 'sequence_tool_2',
        responses: [
          { content: [{ type: 'text', text: 'Tool2-Response1' }], isError: false },
          { content: [{ type: 'text', text: 'Tool2-Response2' }], isError: false },
        ],
        cycleMode: 'cycle',
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        responseSequences: [sequence1, sequence2],
      };
      engine = new MockBehaviorEngine(config);

      // Test interleaved calls to both tools
      const tool1_call1 = await engine.executeToolHandler('sequence_tool_1');
      expect(tool1_call1!.content[0].text).toBe('Tool1-Response1');

      const tool2_call1 = await engine.executeToolHandler('sequence_tool_2');
      expect(tool2_call1!.content[0].text).toBe('Tool2-Response1');

      const tool1_call2 = await engine.executeToolHandler('sequence_tool_1');
      expect(tool1_call2!.content[0].text).toBe('Tool1-Response2');

      const tool2_call2 = await engine.executeToolHandler('sequence_tool_2');
      expect(tool2_call2!.content[0].text).toBe('Tool2-Response2');

      const tool1_call3 = await engine.executeToolHandler('sequence_tool_1');
      expect(tool1_call3!.content[0].text).toBe('Tool1-Response3');

      // Tool2's third call should cycle back to first response
      const tool2_call3 = await engine.executeToolHandler('sequence_tool_2');
      expect(tool2_call3!.content[0].text).toBe('Tool2-Response1');
    });

    it('should handle different cycle modes correctly based on invocation order', async () => {
      const cycleSequence: MockResponseSequence = {
        toolName: 'cycle_tool',
        responses: [
          { content: [{ type: 'text', text: 'Cycle-1' }], isError: false },
          { content: [{ type: 'text', text: 'Cycle-2' }], isError: false },
        ],
        cycleMode: 'cycle',
      };

      const repeatLastSequence: MockResponseSequence = {
        toolName: 'repeat_tool',
        responses: [
          { content: [{ type: 'text', text: 'Repeat-1' }], isError: false },
          { content: [{ type: 'text', text: 'Repeat-2' }], isError: false },
        ],
        cycleMode: 'repeat_last',
      };

      const stopAtEndSequence: MockResponseSequence = {
        toolName: 'stop_tool',
        responses: [
          { content: [{ type: 'text', text: 'Stop-1' }], isError: false },
        ],
        cycleMode: 'stop_at_end',
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        responseSequences: [cycleSequence, repeatLastSequence, stopAtEndSequence],
      };
      engine = new MockBehaviorEngine(config);

      // Test cycle mode
      expect((await engine.executeToolHandler('cycle_tool'))!.content[0].text).toBe('Cycle-1');
      expect((await engine.executeToolHandler('cycle_tool'))!.content[0].text).toBe('Cycle-2');
      expect((await engine.executeToolHandler('cycle_tool'))!.content[0].text).toBe('Cycle-1'); // Cycles back

      // Test repeat_last mode
      expect((await engine.executeToolHandler('repeat_tool'))!.content[0].text).toBe('Repeat-1');
      expect((await engine.executeToolHandler('repeat_tool'))!.content[0].text).toBe('Repeat-2');
      expect((await engine.executeToolHandler('repeat_tool'))!.content[0].text).toBe('Repeat-2'); // Repeats last
      expect((await engine.executeToolHandler('repeat_tool'))!.content[0].text).toBe('Repeat-2'); // Still repeats

      // Test stop_at_end mode
      expect((await engine.executeToolHandler('stop_tool'))!.content[0].text).toBe('Stop-1');
      expect(await engine.executeToolHandler('stop_tool')).toBeUndefined(); // Stops after sequence
    });
  });

  describe('Correct Response Based on Invocation Order', () => {
    it('should return correct responses in sequence based on call order across multiple tools', async () => {
      // Set up multiple tools with different sequence lengths
      const sequences: MockResponseSequence[] = [
        {
          toolName: 'short_sequence',
          responses: [
            { content: [{ type: 'text', text: 'Short-1' }], isError: false },
            { content: [{ type: 'text', text: 'Short-2' }], isError: false },
          ],
          cycleMode: 'cycle',
        },
        {
          toolName: 'long_sequence',
          responses: [
            { content: [{ type: 'text', text: 'Long-1' }], isError: false },
            { content: [{ type: 'text', text: 'Long-2' }], isError: false },
            { content: [{ type: 'text', text: 'Long-3' }], isError: false },
            { content: [{ type: 'text', text: 'Long-4' }], isError: false },
          ],
          cycleMode: 'cycle',
        },
      ];

      const config: MockBehaviorConfig = {
        ...baseConfig,
        responseSequences: sequences,
      };
      engine = new MockBehaviorEngine(config);

      // Perform mixed calls and verify each response is correct for its sequence position
      const results: { tool: string; expected: string; actual: string }[] = [];

      // Call pattern: short, long, short, long, long, short, long
      const callPattern = [
        { tool: 'short_sequence', expected: 'Short-1' },
        { tool: 'long_sequence', expected: 'Long-1' },
        { tool: 'short_sequence', expected: 'Short-2' },
        { tool: 'long_sequence', expected: 'Long-2' },
        { tool: 'long_sequence', expected: 'Long-3' },
        { tool: 'short_sequence', expected: 'Short-1' }, // Cycles back
        { tool: 'long_sequence', expected: 'Long-4' },
        { tool: 'short_sequence', expected: 'Short-2' },
        { tool: 'long_sequence', expected: 'Long-1' }, // Cycles back
      ];

      for (const call of callPattern) {
        const result = await engine.executeToolHandler(call.tool);
        const actualText = result!.content[0].text;
        results.push({
          tool: call.tool,
          expected: call.expected,
          actual: actualText
        });
        expect(actualText).toBe(call.expected);
      }

      // Additional verification: ensure no cross-contamination between tool call counts
      expect(results.filter(r => r.tool === 'short_sequence')).toHaveLength(4);
      expect(results.filter(r => r.tool === 'long_sequence')).toHaveLength(5);
    });

    it('should maintain separate invocation counts for dynamic handlers vs response sequences', async () => {
      const dynamicHandler: MockDynamicHandler = {
        toolName: 'shared_tool_name',
        handler: vi.fn(async (toolName, args, context) => ({
          content: [{ type: 'text', text: `Dynamic-${context.invocationCount}` }],
          isError: false
        })),
        priority: 30, // Lower priority
      };

      const responseSequence: MockResponseSequence = {
        toolName: 'shared_tool_name',
        responses: [
          { content: [{ type: 'text', text: 'Sequence-1' }], isError: false },
          { content: [{ type: 'text', text: 'Sequence-2' }], isError: false },
        ],
        cycleMode: 'cycle',
        priority: 80, // Higher priority - should be used
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        dynamicHandlers: [dynamicHandler],
        responseSequences: [responseSequence],
      };
      engine = new MockBehaviorEngine(config);

      // Since sequence has higher priority, it should be used
      const result1 = await engine.executeToolHandler('shared_tool_name');
      expect(result1!.content[0].text).toBe('Sequence-1');

      const result2 = await engine.executeToolHandler('shared_tool_name');
      expect(result2!.content[0].text).toBe('Sequence-2');

      // Verify dynamic handler was not called due to priority
      expect(dynamicHandler.handler).not.toHaveBeenCalled();
    });

    it('should handle response sequence delays based on invocation order', async () => {
      const sequenceWithDelays: MockResponseSequence = {
        toolName: 'delayed_sequence',
        responses: [
          { content: [{ type: 'text', text: 'Fast' }], isError: false, delayMs: 10 },
          { content: [{ type: 'text', text: 'Slow' }], isError: false, delayMs: 50 },
          { content: [{ type: 'text', text: 'Medium' }], isError: false, delayMs: 25 },
        ],
        cycleMode: 'cycle',
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        responseSequences: [sequenceWithDelays],
      };
      engine = new MockBehaviorEngine(config);

      // Test first call (10ms delay)
      const start1 = Date.now();
      const result1 = await engine.executeToolHandler('delayed_sequence');
      const elapsed1 = Date.now() - start1;
      expect(result1!.content[0].text).toBe('Fast');
      expect(elapsed1).toBeGreaterThanOrEqual(8); // Allow for timing variance

      // Test second call (50ms delay)
      const start2 = Date.now();
      const result2 = await engine.executeToolHandler('delayed_sequence');
      const elapsed2 = Date.now() - start2;
      expect(result2!.content[0].text).toBe('Slow');
      expect(elapsed2).toBeGreaterThanOrEqual(45);

      // Test third call (25ms delay)
      const start3 = Date.now();
      const result3 = await engine.executeToolHandler('delayed_sequence');
      const elapsed3 = Date.now() - start3;
      expect(result3!.content[0].text).toBe('Medium');
      expect(elapsed3).toBeGreaterThanOrEqual(20);
    });
  });

  describe('Integration Tests', () => {
    it('should correctly handle mixed static, dynamic, and sequence handlers with priority resolution', async () => {
      const staticHandler = {
        toolName: 'multi_handler',
        response: { content: [{ type: 'text', text: 'Static' }], isError: false },
        priority: 40,
      };

      const dynamicHandler: MockDynamicHandler = {
        toolName: 'multi_handler',
        handler: vi.fn(async () => ({
          content: [{ type: 'text', text: 'Dynamic' }],
          isError: false
        })),
        priority: 60,
      };

      const sequenceHandler: MockResponseSequence = {
        toolName: 'multi_handler',
        responses: [
          { content: [{ type: 'text', text: 'Sequence-1' }], isError: false },
          { content: [{ type: 'text', text: 'Sequence-2' }], isError: false },
        ],
        cycleMode: 'cycle',
        priority: 80, // Highest priority
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        toolHandlers: [staticHandler],
        dynamicHandlers: [dynamicHandler],
        responseSequences: [sequenceHandler],
      };
      engine = new MockBehaviorEngine(config);

      // Sequence should be used due to highest priority
      const result1 = await engine.executeToolHandler('multi_handler');
      expect(result1!.content[0].text).toBe('Sequence-1');

      const result2 = await engine.executeToolHandler('multi_handler');
      expect(result2!.content[0].text).toBe('Sequence-2');

      // Verify other handlers were not called
      expect(dynamicHandler.handler).not.toHaveBeenCalled();
    });

    it('should reset all handler invocation counts when engine is reset', async () => {
      const dynamicHandler: MockDynamicHandler = {
        toolName: 'reset_test_dynamic',
        handler: vi.fn(async (toolName, args, context) => ({
          content: [{ type: 'text', text: `Call-${context.invocationCount}` }],
          isError: false
        })),
      };

      const sequence: MockResponseSequence = {
        toolName: 'reset_test_sequence',
        responses: [
          { content: [{ type: 'text', text: 'First' }], isError: false },
          { content: [{ type: 'text', text: 'Second' }], isError: false },
        ],
        cycleMode: 'cycle',
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        dynamicHandlers: [dynamicHandler],
        responseSequences: [sequence],
      };
      engine = new MockBehaviorEngine(config);

      // Make some calls
      await engine.executeToolHandler('reset_test_dynamic');
      await engine.executeToolHandler('reset_test_sequence');

      // Verify counts progressed
      const result1 = await engine.executeToolHandler('reset_test_dynamic');
      expect(result1!.content[0].text).toBe('Call-2');

      const result2 = await engine.executeToolHandler('reset_test_sequence');
      expect(result2!.content[0].text).toBe('Second');

      // Reset engine
      engine.reset();

      // Verify counts are reset
      const resetResult1 = await engine.executeToolHandler('reset_test_dynamic');
      expect(resetResult1!.content[0].text).toBe('Call-1');

      const resetResult2 = await engine.executeToolHandler('reset_test_sequence');
      expect(resetResult2!.content[0].text).toBe('First');
    });
  });
});