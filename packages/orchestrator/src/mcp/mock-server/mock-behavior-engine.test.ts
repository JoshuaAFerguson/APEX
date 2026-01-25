/**
 * @fileoverview Tests for MockBehaviorEngine - Configurable Behavior Simulation
 *
 * Tests the MockBehaviorEngine which handles response delays, error injection,
 * state machine transitions, notification triggers, tool handlers, and request recording.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockBehaviorEngine } from './mock-behavior-engine.js';
import type {
  MockBehaviorConfig,
  MockResponseDelay,
  MockErrorInjection,
  MockToolHandler,
  MockDynamicHandler,
  MockDynamicHandlerFunction,
  MockResponseSequence,
  MockNotificationTrigger,
  MockStatefulBehaviorConfig,
  MockStateTransition,
  MockStateBehavior,
} from '@apexcli/core';
import type { JSONRPCRequest, JSONRPCResponse } from '../types.js';
import type { RecordedRequest, ErrorInjectionResult, ComputedDelay } from './types.js';

describe('MockBehaviorEngine', () => {
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
    };
    engine = new MockBehaviorEngine(baseConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('initializes with default state', () => {
      expect(engine.getCurrentState()).toBe('default');
      expect(engine.getRequestCount()).toBe(0);
      expect(engine.getErrorCount()).toBe(0);
      expect(engine.getRecordedRequests()).toHaveLength(0);
    });

    it('initializes with custom initial state', () => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        statefulBehavior: {
          initialState: 'custom',
          stateBehaviors: [],
          transitions: [],
        },
      };
      const customEngine = new MockBehaviorEngine(config);
      expect(customEngine.getCurrentState()).toBe('custom');
    });
  });

  describe('response delay computation', () => {
    it('returns zero delay when no delay config', () => {
      const result = engine.computeDelay('test/method');
      expect(result).toEqual({
        delayMs: 0,
        jitterApplied: false,
        source: 'none',
      });
    });

    it('computes fixed delay without jitter', () => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        responseDelay: { fixedMs: 100, jitter: false },
      };
      engine = new MockBehaviorEngine(config);

      const result = engine.computeDelay('test/method');
      expect(result).toEqual({
        delayMs: 100,
        jitterApplied: false,
        source: 'fixed',
      });
    });

    it('computes fixed delay with jitter', () => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        responseDelay: { fixedMs: 100, jitter: true },
      };
      engine = new MockBehaviorEngine(config);

      const result = engine.computeDelay('test/method');
      expect(result.delayMs).toBeGreaterThan(85); // ~90-110 with 10% jitter
      expect(result.delayMs).toBeLessThan(115);
      expect(result.jitterApplied).toBe(true);
      expect(result.source).toBe('fixed');
    });

    it('computes range delay', () => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        responseDelay: { minMs: 50, maxMs: 150, jitter: false },
      };
      engine = new MockBehaviorEngine(config);

      const result = engine.computeDelay('test/method');
      expect(result.delayMs).toBeGreaterThanOrEqual(50);
      expect(result.delayMs).toBeLessThanOrEqual(150);
      expect(result.source).toBe('range');
    });

    it('prefers per-method delay over fixed delay', () => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        responseDelay: {
          fixedMs: 100,
          perMethod: { 'tools/call': 200 },
        },
      };
      engine = new MockBehaviorEngine(config);

      const generalResult = engine.computeDelay('ping');
      expect(generalResult.delayMs).toBe(100);
      expect(generalResult.source).toBe('fixed');

      const methodResult = engine.computeDelay('tools/call');
      expect(methodResult.delayMs).toBe(200);
      expect(methodResult.source).toBe('per-method');
    });

    it('applies delay asynchronously', async () => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        responseDelay: { fixedMs: 50, jitter: false },
      };
      engine = new MockBehaviorEngine(config);

      const start = Date.now();
      const result = await engine.applyDelay('test/method');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow for timing variance
      expect(result.delayMs).toBe(50);
    });
  });

  describe('error injection', () => {
    it('returns no injection when disabled', () => {
      const result = engine.checkErrorInjection('test/method');
      expect(result.shouldInject).toBe(false);
    });

    it('returns no injection when config is undefined', () => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        errorInjection: undefined,
      };
      engine = new MockBehaviorEngine(config);

      const result = engine.checkErrorInjection('test/method');
      expect(result.shouldInject).toBe(false);
    });

    it('injects errors with 100% probability', () => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        errorInjection: {
          enabled: true,
          probability: 1.0,
          methods: [],
          afterRequestCount: 0,
          maxErrors: 0,
          errorCode: -32603,
          errorMessage: 'Test error',
          errorData: { test: true },
          errorDelayMs: 10,
          simulateConnectionFailure: false,
        },
      };
      engine = new MockBehaviorEngine(config);

      const result = engine.checkErrorInjection('test/method');
      expect(result).toEqual({
        shouldInject: true,
        errorCode: -32603,
        errorMessage: 'Test error',
        errorData: { test: true },
        delayMs: 10,
      });
      expect(engine.getErrorCount()).toBe(1);
    });

    it('respects method filter', () => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        errorInjection: {
          enabled: true,
          probability: 1.0,
          methods: ['tools/call'],
          afterRequestCount: 0,
          maxErrors: 0,
          errorCode: -32603,
          errorMessage: 'Test error',
          simulateConnectionFailure: false,
        },
      };
      engine = new MockBehaviorEngine(config);

      const allowedResult = engine.checkErrorInjection('tools/call');
      expect(allowedResult.shouldInject).toBe(true);

      const blockedResult = engine.checkErrorInjection('ping');
      expect(blockedResult.shouldInject).toBe(false);
    });

    it('respects afterRequestCount threshold', () => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        errorInjection: {
          enabled: true,
          probability: 1.0,
          methods: [],
          afterRequestCount: 2,
          maxErrors: 0,
          errorCode: -32603,
          errorMessage: 'Test error',
          simulateConnectionFailure: false,
        },
      };
      engine = new MockBehaviorEngine(config);

      // Should not inject before threshold
      const earlyResult = engine.checkErrorInjection('test/method');
      expect(earlyResult.shouldInject).toBe(false);

      // Simulate requests to reach threshold
      engine.recordRequest({
        request: { jsonrpc: '2.0', id: 1, method: 'test' },
        timestamp: Date.now(),
        durationMs: 10,
        errorInjected: false,
        serverState: 'default',
      });
      engine.recordRequest({
        request: { jsonrpc: '2.0', id: 2, method: 'test' },
        timestamp: Date.now(),
        durationMs: 10,
        errorInjected: false,
        serverState: 'default',
      });

      // Should inject after threshold
      const lateResult = engine.checkErrorInjection('test/method');
      expect(lateResult.shouldInject).toBe(true);
    });

    it('respects maxErrors limit', () => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        errorInjection: {
          enabled: true,
          probability: 1.0,
          methods: [],
          afterRequestCount: 0,
          maxErrors: 1,
          errorCode: -32603,
          errorMessage: 'Test error',
          simulateConnectionFailure: false,
        },
      };
      engine = new MockBehaviorEngine(config);

      // First injection should work
      const firstResult = engine.checkErrorInjection('test/method');
      expect(firstResult.shouldInject).toBe(true);
      expect(engine.getErrorCount()).toBe(1);

      // Second should be blocked by limit
      const secondResult = engine.checkErrorInjection('test/method');
      expect(secondResult.shouldInject).toBe(false);
      expect(engine.getErrorCount()).toBe(1);
    });

    it('applies probability correctly', () => {
      // Mock Math.random to return predictable values
      const originalRandom = Math.random;
      let callCount = 0;
      Math.random = vi.fn(() => {
        // Alternate between 0.3 (< 0.5) and 0.7 (> 0.5)
        return callCount++ % 2 === 0 ? 0.3 : 0.7;
      });

      const config: MockBehaviorConfig = {
        ...baseConfig,
        errorInjection: {
          enabled: true,
          probability: 0.5,
          methods: [],
          afterRequestCount: 0,
          maxErrors: 0,
          errorCode: -32603,
          errorMessage: 'Test error',
          simulateConnectionFailure: false,
        },
      };
      engine = new MockBehaviorEngine(config);

      // First call: 0.3 < 0.5, should inject
      const firstResult = engine.checkErrorInjection('test/method');
      expect(firstResult.shouldInject).toBe(true);

      // Reset error count for second test
      engine.reset();
      engine = new MockBehaviorEngine(config);

      // Second call: 0.7 > 0.5, should not inject
      const secondResult = engine.checkErrorInjection('test/method');
      expect(secondResult.shouldInject).toBe(false);

      Math.random = originalRandom;
    });

    it('checks connection failure simulation', () => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        errorInjection: {
          enabled: true,
          probability: 1.0,
          methods: [],
          afterRequestCount: 0,
          maxErrors: 0,
          errorCode: -32603,
          errorMessage: 'Test error',
          simulateConnectionFailure: true,
        },
      };
      engine = new MockBehaviorEngine(config);

      expect(engine.shouldSimulateConnectionFailure()).toBe(true);

      // Test with undefined config
      engine = new MockBehaviorEngine({ ...baseConfig, errorInjection: undefined });
      expect(engine.shouldSimulateConnectionFailure()).toBe(false);
    });
  });

  describe('tool handlers', () => {
    const mockToolHandlers: MockToolHandler[] = [
      {
        toolName: 'read_file',
        response: { content: [{ type: 'text', text: 'file content' }] },
      },
      {
        toolName: 'write_file',
        matchArgs: { path: '/test' },
        response: { success: true },
      },
      {
        toolName: 'limited_tool',
        maxInvocations: 2,
        response: { available: true },
      },
    ];

    beforeEach(() => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        toolHandlers: mockToolHandlers,
      };
      engine = new MockBehaviorEngine(config);
    });

    it('finds handler for tool without args', () => {
      const handler = engine.findToolHandler('read_file');
      expect(handler).toEqual(mockToolHandlers[0]);
    });

    it('finds handler with matching args', () => {
      const handler = engine.findToolHandler('write_file', { path: '/test' });
      expect(handler).toEqual(mockToolHandlers[1]);
    });

    it('does not find handler with non-matching args', () => {
      const handler = engine.findToolHandler('write_file', { path: '/other' });
      expect(handler).toBeUndefined();
    });

    it('does not find handler when args required but not provided', () => {
      const handler = engine.findToolHandler('write_file');
      expect(handler).toBeUndefined();
    });

    it('respects maxInvocations limit', () => {
      // First two invocations should work
      const first = engine.findToolHandler('limited_tool');
      expect(first).toEqual(mockToolHandlers[2]);

      const second = engine.findToolHandler('limited_tool');
      expect(second).toEqual(mockToolHandlers[2]);

      // Third should be blocked
      const third = engine.findToolHandler('limited_tool');
      expect(third).toBeUndefined();
    });

    it('returns undefined for unknown tool', () => {
      const handler = engine.findToolHandler('unknown_tool');
      expect(handler).toBeUndefined();
    });

    it('handles complex argument matching', () => {
      const complexHandler: MockToolHandler = {
        toolName: 'complex_tool',
        matchArgs: {
          config: { debug: true, level: 2 },
          flags: ['verbose', 'strict'],
        },
        response: { result: 'complex' },
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        toolHandlers: [complexHandler],
      };
      engine = new MockBehaviorEngine(config);

      // Exact match should work
      const exactMatch = engine.findToolHandler('complex_tool', {
        config: { debug: true, level: 2 },
        flags: ['verbose', 'strict'],
        extra: 'ignored', // Extra fields are ignored (partial match)
      });
      expect(exactMatch).toEqual(complexHandler);

      // Partial mismatch should fail
      const partialMismatch = engine.findToolHandler('complex_tool', {
        config: { debug: false, level: 2 }, // debug: false instead of true
        flags: ['verbose', 'strict'],
      });
      expect(partialMismatch).toBeUndefined();
    });
  });

  describe('dynamic handlers', () => {
    const mockDynamicHandler: MockDynamicHandler = {
      toolName: 'dynamic_tool',
      handler: vi.fn(async (toolName, args, context) => {
        return {
          content: [{ type: 'text', text: `Dynamic response for ${toolName} with args ${JSON.stringify(args)} (call #${context.invocationCount})` }],
          isError: false
        };
      }),
      priority: 75,
    };

    const mockDynamicHandlerWithArgs: MockDynamicHandler = {
      toolName: 'conditional_dynamic',
      handler: vi.fn(async (toolName, args, context) => {
        const mode = args.mode as string;
        return {
          content: [{ type: 'text', text: `Mode: ${mode}` }],
          isError: false
        };
      }),
      matchArgs: { mode: 'advanced' },
      priority: 60,
    };

    const mockLimitedDynamicHandler: MockDynamicHandler = {
      toolName: 'limited_dynamic',
      handler: vi.fn(async (toolName, args, context) => {
        return {
          content: [{ type: 'text', text: 'Limited response' }],
          isError: false
        };
      }),
      maxInvocations: 2,
      priority: 50,
    };

    beforeEach(() => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        dynamicHandlers: [mockDynamicHandler, mockDynamicHandlerWithArgs, mockLimitedDynamicHandler],
      };
      engine = new MockBehaviorEngine(config);

      // Reset mocks
      vi.mocked(mockDynamicHandler.handler).mockClear();
      vi.mocked(mockDynamicHandlerWithArgs.handler).mockClear();
      vi.mocked(mockLimitedDynamicHandler.handler).mockClear();
    });

    it('finds and executes dynamic handler', async () => {
      const handler = engine.findDynamicHandler('dynamic_tool');
      expect(handler).toEqual(mockDynamicHandler);

      const result = await engine.executeDynamicHandler(handler!, 'dynamic_tool', { test: 'value' });
      expect(result.content).toEqual([{ type: 'text', text: `Dynamic response for dynamic_tool with args {"test":"value"} (call #1)` }]);
      expect(result.isError).toBe(false);

      expect(mockDynamicHandler.handler).toHaveBeenCalledWith(
        'dynamic_tool',
        { test: 'value' },
        expect.objectContaining({
          requestId: expect.any(String),
          invocationCount: 1,
          timestamp: expect.any(Date)
        })
      );
    });

    it('finds dynamic handler with matching args', async () => {
      const handler = engine.findDynamicHandler('conditional_dynamic', { mode: 'advanced' });
      expect(handler).toEqual(mockDynamicHandlerWithArgs);

      const result = await engine.executeDynamicHandler(handler!, 'conditional_dynamic', { mode: 'advanced' });
      expect(result.content).toEqual([{ type: 'text', text: 'Mode: advanced' }]);
    });

    it('does not find dynamic handler with non-matching args', () => {
      const handler = engine.findDynamicHandler('conditional_dynamic', { mode: 'basic' });
      expect(handler).toBeUndefined();
    });

    it('respects maxInvocations for dynamic handlers', async () => {
      // First two calls should work
      const first = engine.findDynamicHandler('limited_dynamic');
      expect(first).toEqual(mockLimitedDynamicHandler);

      const second = engine.findDynamicHandler('limited_dynamic');
      expect(second).toEqual(mockLimitedDynamicHandler);

      // Execute them to increment counters
      await engine.executeDynamicHandler(first!, 'limited_dynamic');
      await engine.executeDynamicHandler(second!, 'limited_dynamic');

      // Third should be blocked
      const third = engine.findDynamicHandler('limited_dynamic');
      expect(third).toBeUndefined();
    });

    it('tracks invocation counts correctly', async () => {
      const handler = engine.findDynamicHandler('dynamic_tool');
      await engine.executeDynamicHandler(handler!, 'dynamic_tool', {});

      // Second call should have incremented count
      await engine.executeDynamicHandler(handler!, 'dynamic_tool', {});

      expect(mockDynamicHandler.handler).toHaveBeenCalledTimes(2);
      expect(mockDynamicHandler.handler).toHaveBeenLastCalledWith(
        'dynamic_tool',
        {},
        expect.objectContaining({
          invocationCount: 2
        })
      );
    });

    it('applies delay before executing dynamic handler', async () => {
      const handlerWithDelay: MockDynamicHandler = {
        toolName: 'slow_dynamic',
        handler: vi.fn(async () => ({ content: [], isError: false })),
        delayMs: 50,
      };

      const start = Date.now();
      await engine.executeDynamicHandler(handlerWithDelay, 'slow_dynamic', {});
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow for timing variance
    });
  });

  describe('response sequences', () => {
    const mockResponseSequence: MockResponseSequence = {
      toolName: 'sequence_tool',
      responses: [
        { content: [{ type: 'text', text: 'First response' }], isError: false },
        { content: [{ type: 'text', text: 'Second response' }], isError: false },
        { content: [{ type: 'text', text: 'Third response' }], isError: false },
      ],
      cycleMode: 'cycle',
      priority: 80,
    };

    const mockLimitedSequence: MockResponseSequence = {
      toolName: 'limited_sequence',
      responses: [
        { content: [{ type: 'text', text: 'Only response' }], isError: false },
      ],
      cycleMode: 'stop_at_end',
      priority: 50,
    };

    const mockRepeatSequence: MockResponseSequence = {
      toolName: 'repeat_sequence',
      responses: [
        { content: [{ type: 'text', text: 'Initial' }], isError: false },
        { content: [{ type: 'text', text: 'Final' }], isError: false },
      ],
      cycleMode: 'repeat_last',
      priority: 60,
    };

    beforeEach(() => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        responseSequences: [mockResponseSequence, mockLimitedSequence, mockRepeatSequence],
      };
      engine = new MockBehaviorEngine(config);
    });

    it('finds response sequence', () => {
      const sequence = engine.findResponseSequence('sequence_tool');
      expect(sequence).toEqual(mockResponseSequence);
    });

    it('executes sequence responses in order', async () => {
      const sequence = engine.findResponseSequence('sequence_tool')!;

      const first = await engine.executeResponseSequence(sequence, 'sequence_tool');
      expect(first?.content).toEqual([{ type: 'text', text: 'First response' }]);

      const second = await engine.executeResponseSequence(sequence, 'sequence_tool');
      expect(second?.content).toEqual([{ type: 'text', text: 'Second response' }]);

      const third = await engine.executeResponseSequence(sequence, 'sequence_tool');
      expect(third?.content).toEqual([{ type: 'text', text: 'Third response' }]);
    });

    it('cycles through responses when using cycle mode', async () => {
      const sequence = engine.findResponseSequence('sequence_tool')!;

      // Go through all responses
      await engine.executeResponseSequence(sequence, 'sequence_tool');
      await engine.executeResponseSequence(sequence, 'sequence_tool');
      await engine.executeResponseSequence(sequence, 'sequence_tool');

      // Fourth call should cycle back to first
      const fourth = await engine.executeResponseSequence(sequence, 'sequence_tool');
      expect(fourth?.content).toEqual([{ type: 'text', text: 'First response' }]);
    });

    it('stops at end when using stop_at_end mode', async () => {
      const sequence = engine.findResponseSequence('limited_sequence')!;

      // First call should work
      const first = await engine.executeResponseSequence(sequence, 'limited_sequence');
      expect(first?.content).toEqual([{ type: 'text', text: 'Only response' }]);

      // Second call should return undefined
      const second = await engine.executeResponseSequence(sequence, 'limited_sequence');
      expect(second).toBeUndefined();
    });

    it('repeats last response when using repeat_last mode', async () => {
      const sequence = engine.findResponseSequence('repeat_sequence')!;

      await engine.executeResponseSequence(sequence, 'repeat_sequence'); // Initial
      await engine.executeResponseSequence(sequence, 'repeat_sequence'); // Final

      // Third and fourth calls should repeat the last response
      const third = await engine.executeResponseSequence(sequence, 'repeat_sequence');
      expect(third?.content).toEqual([{ type: 'text', text: 'Final' }]);

      const fourth = await engine.executeResponseSequence(sequence, 'repeat_sequence');
      expect(fourth?.content).toEqual([{ type: 'text', text: 'Final' }]);
    });

    it('applies response-specific delay', async () => {
      const sequenceWithDelay: MockResponseSequence = {
        toolName: 'slow_sequence',
        responses: [
          { content: [{ type: 'text', text: 'Slow response' }], isError: false, delayMs: 50 },
        ],
        cycleMode: 'cycle',
      };

      const start = Date.now();
      await engine.executeResponseSequence(sequenceWithDelay, 'slow_sequence');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow for timing variance
    });
  });

  describe('priority-based handler resolution', () => {
    const lowPriorityStatic: MockToolHandler = {
      toolName: 'multi_handler',
      response: { content: [{ type: 'text', text: 'Static handler' }], isError: false },
      priority: 30,
    };

    const highPriorityDynamic: MockDynamicHandler = {
      toolName: 'multi_handler',
      handler: vi.fn(async () => ({
        content: [{ type: 'text', text: 'Dynamic handler' }],
        isError: false
      })),
      priority: 80,
    };

    const mediumPrioritySequence: MockResponseSequence = {
      toolName: 'multi_handler',
      responses: [
        { content: [{ type: 'text', text: 'Sequence handler' }], isError: false },
      ],
      cycleMode: 'cycle',
      priority: 60,
    };

    beforeEach(() => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        toolHandlers: [lowPriorityStatic],
        dynamicHandlers: [highPriorityDynamic],
        responseSequences: [mediumPrioritySequence],
      };
      engine = new MockBehaviorEngine(config);
      vi.mocked(highPriorityDynamic.handler).mockClear();
    });

    it('finds best handler based on priority', () => {
      const best = engine.findBestToolHandler('multi_handler');

      expect(best).toEqual({
        type: 'dynamic',
        handler: highPriorityDynamic
      });
    });

    it('executes highest priority handler', async () => {
      const result = await engine.executeToolHandler('multi_handler');

      expect(result?.content).toEqual([{ type: 'text', text: 'Dynamic handler' }]);
      expect(highPriorityDynamic.handler).toHaveBeenCalled();
    });

    it('falls back to lower priority when high priority is unavailable', async () => {
      // Make the dynamic handler unavailable by exceeding maxInvocations
      const limitedDynamic: MockDynamicHandler = {
        ...highPriorityDynamic,
        maxInvocations: 1,
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        toolHandlers: [lowPriorityStatic],
        dynamicHandlers: [limitedDynamic],
        responseSequences: [mediumPrioritySequence],
      };
      engine = new MockBehaviorEngine(config);

      // First call should use dynamic
      await engine.executeToolHandler('multi_handler');

      // Second call should fall back to sequence
      const result = await engine.executeToolHandler('multi_handler');
      expect(result?.content).toEqual([{ type: 'text', text: 'Sequence handler' }]);
    });
  });

  describe('state machine', () => {
    const transitions: MockStateTransition[] = [
      { from: 'idle', to: 'busy', onMethod: 'tools/call' },
      { from: 'busy', to: 'idle', onMethod: 'tools/complete' },
      {
        from: 'idle',
        to: 'error',
        onMethod: 'tools/call',
        whenArgs: { fail: true },
      },
    ];

    const stateBehaviors: MockStateBehavior[] = [
      {
        state: 'busy',
        responseDelay: { fixedMs: 200 },
        toolHandlers: [{ toolName: 'busy_tool', response: { busy: true } }],
      },
    ];

    beforeEach(() => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        statefulBehavior: {
          initialState: 'idle',
          stateBehaviors,
          transitions,
        },
      };
      engine = new MockBehaviorEngine(config);
    });

    it('starts in initial state', () => {
      expect(engine.getCurrentState()).toBe('idle');
    });

    it('transitions on matching method', () => {
      const result = engine.transition('tools/call');
      expect(result).toEqual({
        from: 'idle',
        to: 'busy',
        transition: transitions[0],
      });
      expect(engine.getCurrentState()).toBe('busy');
    });

    it('does not transition on non-matching method', () => {
      const result = engine.transition('ping');
      expect(result).toBeUndefined();
      expect(engine.getCurrentState()).toBe('idle');
    });

    it('transitions with argument conditions', () => {
      const result = engine.transition('tools/call', { fail: true });
      expect(result).toEqual({
        from: 'idle',
        to: 'error',
        transition: transitions[2],
      });
      expect(engine.getCurrentState()).toBe('error');
    });

    it('does not transition when args do not match', () => {
      const result = engine.transition('tools/call', { fail: false });
      expect(result).toEqual({
        from: 'idle',
        to: 'busy',
        transition: transitions[0],
      });
      expect(engine.getCurrentState()).toBe('busy');
    });

    it('gets state-specific behavior', () => {
      engine.transition('tools/call'); // Move to 'busy'
      const stateBehavior = engine.getCurrentStateBehavior();
      expect(stateBehavior).toEqual(stateBehaviors[0]);
    });

    it('uses state-specific delay configuration', () => {
      engine.transition('tools/call'); // Move to 'busy'
      const delay = engine.computeDelay('test');
      expect(delay.delayMs).toBe(200);
      expect(delay.source).toBe('fixed');
    });
  });

  describe('notification triggers', () => {
    const triggers: MockNotificationTrigger[] = [
      {
        condition: 'after_request_count',
        conditionValue: '3',
        method: 'notifications/progress',
        params: { progress: 50 },
        once: false,
        delayMs: 0,
      },
      {
        condition: 'after_method',
        conditionValue: 'tools/call',
        method: 'notifications/tool_called',
        params: { tool: 'called' },
        once: true,
        delayMs: 100,
      },
      {
        condition: 'periodic',
        conditionValue: '2',
        method: 'notifications/heartbeat',
        params: { timestamp: Date.now() },
        once: false,
        delayMs: 0,
      },
    ];

    beforeEach(() => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        notificationTriggers: triggers,
      };
      engine = new MockBehaviorEngine(config);
    });

    it('triggers after request count', () => {
      // Add requests to reach count
      for (let i = 0; i < 3; i++) {
        engine.recordRequest({
          request: { jsonrpc: '2.0', id: i, method: 'test' },
          timestamp: Date.now(),
          durationMs: 10,
          errorInjected: false,
          serverState: 'default',
        });
      }

      const fired = engine.checkNotificationTriggers('any');
      expect(fired).toHaveLength(1);
      expect(fired[0]).toEqual(triggers[0]);
    });

    it('triggers after specific method', () => {
      const fired = engine.checkNotificationTriggers('tools/call');
      expect(fired).toHaveLength(1);
      expect(fired[0]).toEqual(triggers[1]);
    });

    it('does not re-fire once-only triggers', () => {
      // First call should fire
      const first = engine.checkNotificationTriggers('tools/call');
      expect(first).toHaveLength(1);

      // Second call should not fire
      const second = engine.checkNotificationTriggers('tools/call');
      expect(second).toHaveLength(0);
    });

    it('triggers periodic notifications', () => {
      // Add one request
      engine.recordRequest({
        request: { jsonrpc: '2.0', id: 1, method: 'test' },
        timestamp: Date.now(),
        durationMs: 10,
        errorInjected: false,
        serverState: 'default',
      });

      // Should not trigger on request 1
      const first = engine.checkNotificationTriggers('any');
      expect(first.filter(t => t.condition === 'periodic')).toHaveLength(0);

      // Add second request
      engine.recordRequest({
        request: { jsonrpc: '2.0', id: 2, method: 'test' },
        timestamp: Date.now(),
        durationMs: 10,
        errorInjected: false,
        serverState: 'default',
      });

      // Should trigger on request 2 (2 % 2 === 0)
      const second = engine.checkNotificationTriggers('any');
      const periodic = second.filter(t => t.condition === 'periodic');
      expect(periodic).toHaveLength(1);
    });

    it('triggers after delay', async () => {
      const delayTrigger: MockNotificationTrigger = {
        condition: 'after_delay',
        conditionValue: '50', // 50ms
        method: 'notifications/delayed',
        params: {},
        once: false,
        delayMs: 0,
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        notificationTriggers: [delayTrigger],
      };
      engine = new MockBehaviorEngine(config);

      // Should not trigger immediately
      const immediate = engine.checkNotificationTriggers('any');
      expect(immediate).toHaveLength(0);

      // Wait for delay
      await new Promise(resolve => setTimeout(resolve, 60));

      // Should trigger after delay
      const delayed = engine.checkNotificationTriggers('any');
      expect(delayed).toHaveLength(1);
    });
  });

  describe('request recording', () => {
    it('records requests when enabled', () => {
      const request: RecordedRequest = {
        request: { jsonrpc: '2.0', id: 1, method: 'test' },
        timestamp: Date.now(),
        durationMs: 50,
        errorInjected: false,
        serverState: 'default',
      };

      engine.recordRequest(request);

      expect(engine.getRecordedRequests()).toEqual([request]);
      expect(engine.getRequestCount()).toBe(1);
    });

    it('does not record when disabled', () => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        recordRequests: false,
      };
      engine = new MockBehaviorEngine(config);

      const request: RecordedRequest = {
        request: { jsonrpc: '2.0', id: 1, method: 'test' },
        timestamp: Date.now(),
        durationMs: 50,
        errorInjected: false,
        serverState: 'default',
      };

      engine.recordRequest(request);

      expect(engine.getRecordedRequests()).toHaveLength(0);
      expect(engine.getRequestCount()).toBe(1); // Still counts
    });

    it('trims old requests when over limit', () => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        maxRecordedRequests: 2,
      };
      engine = new MockBehaviorEngine(config);

      const requests = Array.from({ length: 4 }, (_, i) => ({
        request: { jsonrpc: '2.0' as const, id: i, method: 'test' },
        timestamp: Date.now() + i,
        durationMs: 10,
        errorInjected: false,
        serverState: 'default',
      }));

      requests.forEach(req => engine.recordRequest(req));

      const recorded = engine.getRecordedRequests();
      expect(recorded).toHaveLength(2);
      expect(recorded[0]).toEqual(requests[2]); // Should keep the latest 2
      expect(recorded[1]).toEqual(requests[3]);
    });
  });

  describe('configuration and state management', () => {
    it('updates configuration', () => {
      const newConfig: MockBehaviorConfig = {
        ...baseConfig,
        responseDelay: { fixedMs: 200 },
      };

      engine.updateConfig(newConfig);

      const delay = engine.computeDelay('test');
      expect(delay.delayMs).toBe(200);
    });

    it('resets state correctly', () => {
      // Set up some state
      engine.recordRequest({
        request: { jsonrpc: '2.0', id: 1, method: 'test' },
        timestamp: Date.now(),
        durationMs: 10,
        errorInjected: false,
        serverState: 'default',
      });

      engine.checkErrorInjection('test'); // Increment error count

      expect(engine.getRequestCount()).toBe(1);
      expect(engine.getErrorCount()).toBe(0);
      expect(engine.getRecordedRequests()).toHaveLength(1);

      // Reset
      engine.reset();

      expect(engine.getRequestCount()).toBe(0);
      expect(engine.getErrorCount()).toBe(0);
      expect(engine.getRecordedRequests()).toHaveLength(0);
      expect(engine.getCurrentState()).toBe('default');
    });

    it('provides default tool response', () => {
      const defaultResponse = { fallback: true };
      const config: MockBehaviorConfig = {
        ...baseConfig,
        defaultToolResponse: defaultResponse,
      };
      engine = new MockBehaviorEngine(config);

      expect(engine.getDefaultToolResponse()).toEqual(defaultResponse);
    });

    it('checks validation and debug settings', () => {
      expect(engine.shouldValidateRequests()).toBe(true);
      expect(engine.isDebugLoggingEnabled()).toBe(false);

      const config: MockBehaviorConfig = {
        ...baseConfig,
        validateRequests: false,
        enableDebugLogging: true,
      };
      engine = new MockBehaviorEngine(config);

      expect(engine.shouldValidateRequests()).toBe(false);
      expect(engine.isDebugLoggingEnabled()).toBe(true);
    });
  });

  describe('edge cases and error conditions', () => {
    it('handles empty configuration gracefully', () => {
      const emptyConfig: MockBehaviorConfig = {
        recordRequests: false,
        maxRecordedRequests: 0,
        validateRequests: false,
        enableDebugLogging: false,
        toolHandlers: [],
        notificationTriggers: [],
      };
      engine = new MockBehaviorEngine(emptyConfig);

      expect(engine.computeDelay('test').delayMs).toBe(0);
      expect(engine.checkErrorInjection('test').shouldInject).toBe(false);
      expect(engine.findToolHandler('test')).toBeUndefined();
      expect(engine.checkNotificationTriggers('test')).toHaveLength(0);
    });

    it('handles malformed argument matching', () => {
      const handler: MockToolHandler = {
        toolName: 'test_tool',
        matchArgs: { nested: { deep: 'value' } },
        response: { success: true },
      };

      const config: MockBehaviorConfig = {
        ...baseConfig,
        toolHandlers: [handler],
      };
      engine = new MockBehaviorEngine(config);

      // Should handle undefined args gracefully
      const result = engine.findToolHandler('test_tool');
      expect(result).toBeUndefined();

      // Should handle partial nested matching
      const partial = engine.findToolHandler('test_tool', { nested: {} });
      expect(partial).toBeUndefined();

      // Should match complete nested structure
      const complete = engine.findToolHandler('test_tool', {
        nested: { deep: 'value' },
      });
      expect(complete).toEqual(handler);
    });

    it('handles invalid transition conditions', () => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        statefulBehavior: {
          initialState: 'start',
          stateBehaviors: [],
          transitions: [
            {
              from: 'start',
              to: 'end',
              onMethod: 'test',
              whenArgs: { required: true },
            },
          ],
        },
      };
      engine = new MockBehaviorEngine(config);

      // Should not transition when args don't match
      const result = engine.transition('test', { required: false });
      expect(result).toBeUndefined();
      expect(engine.getCurrentState()).toBe('start');
    });

    it('handles zero and negative delays', () => {
      const config: MockBehaviorConfig = {
        ...baseConfig,
        responseDelay: { fixedMs: 0 },
      };
      engine = new MockBehaviorEngine(config);

      const result = engine.computeDelay('test');
      expect(result.delayMs).toBe(0);

      // Test with negative range (should handle gracefully)
      const negativeConfig: MockBehaviorConfig = {
        ...baseConfig,
        responseDelay: { minMs: 100, maxMs: 50 }, // Invalid range
      };
      engine = new MockBehaviorEngine(negativeConfig);

      const negativeResult = engine.computeDelay('test');
      // Should handle gracefully (minMs + negative range)
      expect(typeof negativeResult.delayMs).toBe('number');
    });
  });
});