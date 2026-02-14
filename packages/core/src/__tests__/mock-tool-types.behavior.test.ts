/**
 * @fileoverview Behavior tests for Mock Tool Types
 *
 * This test file focuses on testing the behavioral aspects of mock tools:
 * - Response sequences and state management
 * - Error probability and randomness
 * - Concurrent execution limits
 * - Tool lifecycle events
 * - Dynamic behavior modification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type {
  MockTool,
  MockToolResponse,
  MockToolExecutor,
  MockToolBehaviorConfig,
  ToolInvocation,
  ToolInvocationContext,
} from '../test-utils/mock-tool-types.js';

describe('Mock Tool Behavior Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Response sequences', () => {
    it('should cycle through response sequences', async () => {
      const responses: MockToolResponse[] = [
        {
          success: true,
          content: [{ type: 'text', text: 'First response' }],
        },
        {
          success: false,
          isError: true,
          content: [{ type: 'error', message: 'Second response error', code: 'ERROR_2' }],
        },
        {
          success: true,
          content: [{ type: 'text', text: 'Third response' }],
        },
      ];

      let sequenceIndex = 0;

      const sequenceTool: MockTool = {
        name: 'SequenceTool',
        description: 'Tool with response sequence',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
        },
        execute: async () => {
          const response = responses[sequenceIndex % responses.length];
          sequenceIndex++;
          return response;
        },
        responseSequence: responses,
      };

      // First invocation
      const response1 = await (sequenceTool.execute as Function)({});
      expect(response1.content[0].text).toBe('First response');

      // Second invocation
      const response2 = await (sequenceTool.execute as Function)({});
      expect(response2.isError).toBe(true);
      expect(response2.content[0].message).toBe('Second response error');

      // Third invocation
      const response3 = await (sequenceTool.execute as Function)({});
      expect(response3.content[0].text).toBe('Third response');

      // Fourth invocation (cycles back)
      const response4 = await (sequenceTool.execute as Function)({});
      expect(response4.content[0].text).toBe('First response');
    });

    it('should handle empty response sequences gracefully', async () => {
      const tool: MockTool = {
        name: 'EmptySequenceTool',
        description: 'Tool with empty sequence',
        parameters: {
          type: 'object',
          properties: {},
        },
        execute: async () => ({
          success: true,
          content: [{ type: 'text', text: 'Fallback response' }],
        }),
        responseSequence: [],
      };

      const response = await (tool.execute as Function)({});
      expect(response.content[0].text).toBe('Fallback response');
    });
  });

  describe('Response delays', () => {
    it('should simulate response delays', async () => {
      const delayedTool: MockTool = {
        name: 'DelayedTool',
        description: 'Tool with response delay',
        parameters: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const startTime = Date.now();
          await new Promise(resolve => setTimeout(resolve, 100));
          const endTime = Date.now();

          return {
            success: true,
            content: [{ type: 'text', text: 'Delayed response' }],
            duration: endTime - startTime,
          };
        },
        responseDelay: 100,
      };

      const startTime = Date.now();
      vi.advanceTimersByTime(100);

      const response = await (delayedTool.execute as Function)({});

      expect(response.success).toBe(true);
      expect(response.duration).toBeGreaterThanOrEqual(100);
    });

    it('should handle variable delays based on parameters', async () => {
      class VariableDelayExecutor implements MockToolExecutor {
        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          const delayMs = (params.delay as number) || 0;
          const startTime = Date.now();

          if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }

          const endTime = Date.now();

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Completed with ${delayMs}ms delay`,
              },
            ],
            duration: endTime - startTime,
            metadata: { requestedDelay: delayMs },
          };
        }

        reset() {
          // No state to reset
        }
      }

      const tool: MockTool = {
        name: 'VariableDelayTool',
        description: 'Tool with variable delays',
        parameters: {
          type: 'object',
          properties: {
            delay: { type: 'number', minimum: 0, maximum: 1000 },
          },
        },
        execute: new VariableDelayExecutor(),
      };

      const executor = tool.execute as VariableDelayExecutor;

      // Test no delay
      const response1 = await executor.execute({ delay: 0 });
      expect(response1.metadata?.requestedDelay).toBe(0);

      // Test with delay
      vi.advanceTimersByTime(50);
      const response2 = await executor.execute({ delay: 50 });
      expect(response2.metadata?.requestedDelay).toBe(50);
    });
  });

  describe('Error probability simulation', () => {
    it('should simulate random errors based on probability', async () => {
      const mockMath = vi.spyOn(Math, 'random');

      const probabilisticTool: MockTool = {
        name: 'ProbabilisticTool',
        description: 'Tool with error probability',
        parameters: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const errorProbability = 0.3; // 30% chance of error
          const random = Math.random();

          if (random < errorProbability) {
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: `Simulated error (random: ${random})`,
                  code: 'SIMULATED_ERROR',
                },
              ],
            };
          }

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Success (random: ${random})`,
              },
            ],
          };
        },
      };

      // Force error
      mockMath.mockReturnValue(0.2); // Below 0.3 threshold
      const errorResponse = await (probabilisticTool.execute as Function)({});
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.content[0].code).toBe('SIMULATED_ERROR');

      // Force success
      mockMath.mockReturnValue(0.5); // Above 0.3 threshold
      const successResponse = await (probabilisticTool.execute as Function)({});
      expect(successResponse.success).toBe(true);

      mockMath.mockRestore();
    });

    it('should track error rates over multiple invocations', async () => {
      const results: boolean[] = [];
      let invocationCount = 0;

      const trackingTool: MockTool = {
        name: 'TrackingTool',
        description: 'Tool that tracks error rates',
        parameters: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          invocationCount++;
          const errorProbability = 0.4;
          const isError = Math.random() < errorProbability;
          results.push(!isError); // Track success

          return {
            success: !isError,
            isError,
            content: isError
              ? [{ type: 'error', message: 'Probabilistic error', code: 'PROB_ERROR' }]
              : [{ type: 'text', text: `Success #${invocationCount}` }],
          };
        },
      };

      // Run multiple invocations
      const numTests = 100;
      const promises = Array(numTests).fill(null).map(() =>
        (trackingTool.execute as Function)({})
      );

      await Promise.all(promises);

      // Check that we got a reasonable distribution
      const successCount = results.filter(success => success).length;
      const successRate = successCount / numTests;

      // With 40% error rate, we expect ~60% success rate (with some variance)
      expect(successRate).toBeGreaterThan(0.4);
      expect(successRate).toBeLessThan(0.8);
      expect(invocationCount).toBe(numTests);
    });
  });

  describe('Concurrent execution limits', () => {
    it('should limit concurrent executions', async () => {
      let concurrentCount = 0;
      let maxConcurrentReached = 0;
      const maxConcurrent = 3;

      class ConcurrencyLimitedExecutor implements MockToolExecutor {
        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          concurrentCount++;
          maxConcurrentReached = Math.max(maxConcurrentReached, concurrentCount);

          if (concurrentCount > maxConcurrent) {
            concurrentCount--;
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: `Too many concurrent executions. Limit: ${maxConcurrent}`,
                  code: 'CONCURRENCY_LIMIT_EXCEEDED',
                },
              ],
            };
          }

          // Simulate work
          const delay = (params.delay as number) || 100;
          await new Promise(resolve => setTimeout(resolve, delay));

          concurrentCount--;

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Completed execution (max concurrent was ${maxConcurrentReached})`,
              },
            ],
            metadata: { maxConcurrentReached },
          };
        }

        reset() {
          concurrentCount = 0;
          maxConcurrentReached = 0;
        }
      }

      const executor = new ConcurrencyLimitedExecutor();
      const tool: MockTool = {
        name: 'ConcurrencyTool',
        description: 'Tool with concurrency limits',
        parameters: {
          type: 'object',
          properties: {
            delay: { type: 'number' },
          },
        },
        execute: executor,
      };

      // Start multiple concurrent executions
      const promises = Array(5).fill(null).map((_, i) =>
        executor.execute({ delay: 50 })
      );

      vi.advanceTimersByTime(60);
      const results = await Promise.all(promises);

      // Some should succeed, some should fail due to concurrency limits
      const successes = results.filter(r => r.success);
      const failures = results.filter(r => !r.success);

      expect(successes.length).toBe(3); // Max concurrent
      expect(failures.length).toBe(2); // Rejected due to limit
      expect(failures[0].content[0].code).toBe('CONCURRENCY_LIMIT_EXCEEDED');
    });
  });

  describe('Tool state persistence', () => {
    it('should maintain state across invocations', async () => {
      class StatefulCounterExecutor implements MockToolExecutor {
        private count = 0;
        private history: string[] = [];

        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          const operation = params.operation as string;

          switch (operation) {
            case 'increment':
              this.count++;
              this.history.push(`increment to ${this.count}`);
              break;

            case 'decrement':
              this.count--;
              this.history.push(`decrement to ${this.count}`);
              break;

            case 'reset':
              this.count = 0;
              this.history.push('reset to 0');
              break;
          }

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Counter is now ${this.count}`,
              },
            ],
            metadata: {
              count: this.count,
              operation,
              historyLength: this.history.length,
              lastOperations: this.history.slice(-3),
            },
          };
        }

        reset() {
          this.count = 0;
          this.history = [];
        }

        getState() {
          return {
            count: this.count,
            history: [...this.history],
          };
        }
      }

      const executor = new StatefulCounterExecutor();

      // Test increment operations
      const inc1 = await executor.execute({ operation: 'increment' });
      expect(inc1.metadata?.count).toBe(1);

      const inc2 = await executor.execute({ operation: 'increment' });
      expect(inc2.metadata?.count).toBe(2);

      // Test decrement
      const dec1 = await executor.execute({ operation: 'decrement' });
      expect(dec1.metadata?.count).toBe(1);

      // Test state persistence
      const state = executor.getState();
      expect(state.count).toBe(1);
      expect(state.history).toEqual([
        'increment to 1',
        'increment to 2',
        'decrement to 1',
      ]);

      // Test reset
      const reset = await executor.execute({ operation: 'reset' });
      expect(reset.metadata?.count).toBe(0);

      const resetState = executor.getState();
      expect(resetState.count).toBe(0);
      expect(resetState.history).toHaveLength(4); // History includes reset operation
    });
  });

  describe('Context-aware behavior', () => {
    it('should adapt behavior based on invocation context', async () => {
      class ContextAwareExecutor implements MockToolExecutor {
        async execute(params: Record<string, unknown>, context?: ToolInvocationContext): Promise<MockToolResponse> {
          const input = params.input as string;
          const contextInfo: string[] = [];

          // Behavior varies based on context
          if (context?.agentName === 'developer') {
            contextInfo.push('Enhanced debugging information enabled');
          }

          if (context?.stageName === 'testing') {
            contextInfo.push('Additional validation checks performed');
          }

          if (context?.workingDirectory?.includes('production')) {
            contextInfo.push('Production safety checks enabled');

            // Be more cautious in production
            if (input.includes('delete') || input.includes('remove')) {
              return {
                success: false,
                isError: true,
                content: [
                  {
                    type: 'error',
                    message: 'Destructive operations not allowed in production context',
                    code: 'PRODUCTION_SAFETY',
                  },
                ],
              };
            }
          }

          const responseText = [
            `Processed: ${input}`,
            ...contextInfo,
          ].join('\n');

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: responseText,
              },
            ],
            metadata: {
              contextAgent: context?.agentName,
              contextStage: context?.stageName,
              contextWorkingDir: context?.workingDirectory,
              contextualBehaviorsApplied: contextInfo.length,
            },
          };
        }

        reset() {
          // No persistent state to reset
        }
      }

      const executor = new ContextAwareExecutor();

      // Test with developer context
      const devResponse = await executor.execute(
        { input: 'debug function' },
        {
          agentName: 'developer',
          stageName: 'implementation',
          workingDirectory: '/workspace/dev',
        }
      );

      expect(devResponse.success).toBe(true);
      expect(devResponse.content[0].text).toContain('Enhanced debugging information enabled');
      expect(devResponse.metadata?.contextualBehaviorsApplied).toBe(1);

      // Test with testing context
      const testResponse = await executor.execute(
        { input: 'validate data' },
        {
          agentName: 'tester',
          stageName: 'testing',
          workingDirectory: '/workspace/test',
        }
      );

      expect(testResponse.content[0].text).toContain('Additional validation checks performed');
      expect(testResponse.metadata?.contextualBehaviorsApplied).toBe(1);

      // Test production safety
      const prodResponse = await executor.execute(
        { input: 'delete old files' },
        {
          agentName: 'devops',
          stageName: 'deployment',
          workingDirectory: '/workspace/production',
        }
      );

      expect(prodResponse.success).toBe(false);
      expect(prodResponse.content[0].code).toBe('PRODUCTION_SAFETY');

      // Test safe operation in production
      const safeProdResponse = await executor.execute(
        { input: 'backup database' },
        {
          agentName: 'devops',
          stageName: 'deployment',
          workingDirectory: '/workspace/production',
        }
      );

      expect(safeProdResponse.success).toBe(true);
      expect(safeProdResponse.content[0].text).toContain('Production safety checks enabled');
    });

    it('should handle cancellation signals', async () => {
      class CancellableExecutor implements MockToolExecutor {
        async execute(params: Record<string, unknown>, context?: ToolInvocationContext): Promise<MockToolResponse> {
          const duration = (params.duration as number) || 1000;
          const checkInterval = 100;
          let elapsed = 0;

          while (elapsed < duration) {
            if (context?.signal?.aborted) {
              return {
                success: false,
                isError: true,
                content: [
                  {
                    type: 'error',
                    message: `Operation cancelled after ${elapsed}ms`,
                    code: 'CANCELLED',
                  },
                ],
                duration: elapsed,
              };
            }

            await new Promise(resolve => setTimeout(resolve, checkInterval));
            elapsed += checkInterval;
          }

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Operation completed in ${elapsed}ms`,
              },
            ],
            duration: elapsed,
          };
        }

        reset() {
          // No state to reset
        }
      }

      const executor = new CancellableExecutor();

      // Test normal execution
      vi.advanceTimersByTime(500);
      const normalResponse = await executor.execute({ duration: 500 });
      expect(normalResponse.success).toBe(true);
      expect(normalResponse.duration).toBe(500);

      // Test cancellation
      const abortController = new AbortController();
      setTimeout(() => {
        abortController.abort();
      }, 300);

      vi.advanceTimersByTime(300);
      const cancelledResponse = await executor.execute(
        { duration: 1000 },
        { signal: abortController.signal }
      );

      expect(cancelledResponse.success).toBe(false);
      expect(cancelledResponse.content[0].code).toBe('CANCELLED');
      expect(cancelledResponse.duration).toBeLessThan(1000);
    });
  });
});