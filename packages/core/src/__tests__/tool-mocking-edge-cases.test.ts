/**
 * @fileoverview Edge Cases and Error Condition Tests for Tool Mocking Utilities
 *
 * This test suite validates the robustness of tool mocking utilities by testing
 * edge cases, error conditions, boundary values, and exceptional scenarios.
 * Ensures the mocking system handles unusual inputs and failure modes gracefully.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  MockToolsExecutor,
  createMockToolsExecutor,
  type MockToolsExecutorConfig,
} from '../test-utils/mock-tools-executor';

import {
  MockToolExecution,
  createMockToolExecution,
} from '../test-utils/claude-sdk-mock';

import type {
  MockTool,
  MockToolResponse,
  MockToolExecutor,
  MockToolValidationResult,
} from '../test-utils/mock-tool-types';

describe('Tool Mocking Edge Cases and Error Conditions', () => {
  describe('MockToolsExecutor Edge Cases', () => {
    let executor: MockToolsExecutor;

    beforeEach(() => {
      executor = new MockToolsExecutor();
    });

    afterEach(() => {
      executor.reset();
    });

    describe('Configuration Edge Cases', () => {
      it('should handle zero concurrent executions limit', () => {
        const config: MockToolsExecutorConfig = {
          maxConcurrentExecutions: 0
        };

        const zeroExecutor = new MockToolsExecutor(config);
        expect(zeroExecutor).toBeInstanceOf(MockToolsExecutor);
      });

      it('should handle negative timeout values', () => {
        const config: MockToolsExecutorConfig = {
          defaultTimeout: -1000
        };

        const negativeExecutor = new MockToolsExecutor(config);
        expect(negativeExecutor).toBeInstanceOf(MockToolsExecutor);
      });

      it('should handle extremely large configuration values', () => {
        const config: MockToolsExecutorConfig = {
          maxConcurrentExecutions: Number.MAX_SAFE_INTEGER,
          defaultTimeout: Number.MAX_SAFE_INTEGER
        };

        const largeExecutor = new MockToolsExecutor(config);
        expect(largeExecutor).toBeInstanceOf(MockToolsExecutor);
      });
    });

    describe('Tool Registration Edge Cases', () => {
      it('should handle tool registration with empty name', () => {
        const tool: MockTool = {
          name: '',
          description: 'Tool with empty name',
          parameters: { type: 'object', properties: {} },
          execute: async () => ({ success: true, content: [] })
        };

        executor.registerTool(tool);
        expect(executor.isToolRegistered('')).toBe(true);
      });

      it('should handle tool registration with unicode characters in name', () => {
        const tool: MockTool = {
          name: '🚀测试Tool_∆',
          description: 'Unicode name tool',
          parameters: { type: 'object', properties: {} },
          execute: async () => ({ success: true, content: [] })
        };

        executor.registerTool(tool);
        expect(executor.isToolRegistered('🚀测试Tool_∆')).toBe(true);
      });

      it('should handle tool registration with very long names', () => {
        const longName = 'a'.repeat(10000);
        const tool: MockTool = {
          name: longName,
          description: 'Tool with very long name',
          parameters: { type: 'object', properties: {} },
          execute: async () => ({ success: true, content: [] })
        };

        executor.registerTool(tool);
        expect(executor.isToolRegistered(longName)).toBe(true);
      });

      it('should handle tool overwriting without warning', () => {
        const tool1: MockTool = {
          name: 'DuplicateTool',
          description: 'First tool',
          parameters: { type: 'object', properties: {} },
          execute: async () => ({ success: true, content: [{ type: 'text', text: 'first' }] })
        };

        const tool2: MockTool = {
          name: 'DuplicateTool',
          description: 'Second tool',
          parameters: { type: 'object', properties: {} },
          execute: async () => ({ success: true, content: [{ type: 'text', text: 'second' }] })
        };

        executor.registerTool(tool1);
        executor.registerTool(tool2);

        // Should use the second tool
        return expect(executor.executeTool('DuplicateTool', {})).resolves.toMatchObject({
          success: true,
          content: [{ type: 'text', text: 'second' }]
        });
      });

      it('should handle massive parameter schemas', () => {
        const massiveProperties: Record<string, any> = {};
        for (let i = 0; i < 1000; i++) {
          massiveProperties[`param${i}`] = {
            type: 'string',
            description: `Parameter ${i}`,
            minLength: i % 10,
            maxLength: 100 + i
          };
        }

        const tool: MockTool = {
          name: 'MassiveTool',
          description: 'Tool with massive parameter schema',
          parameters: {
            type: 'object',
            properties: massiveProperties,
            required: ['param0', 'param500', 'param999']
          },
          execute: async () => ({ success: true, content: [] })
        };

        executor.registerTool(tool);
        expect(executor.isToolRegistered('MassiveTool')).toBe(true);
      });
    });

    describe('Tool Execution Edge Cases', () => {
      beforeEach(() => {
        const basicTool: MockTool = {
          name: 'EdgeCaseTool',
          description: 'Tool for edge case testing',
          parameters: {
            type: 'object',
            properties: {
              value: { type: 'string' }
            }
          },
          execute: async (params) => ({
            success: true,
            content: [{ type: 'text', text: `Value: ${params.value}` }]
          })
        };
        executor.registerTool(basicTool);
      });

      it('should handle execution with null parameters', async () => {
        const response = await executor.executeTool('EdgeCaseTool', {
          value: null
        });
        expect(response.success).toBe(true);
      });

      it('should handle execution with undefined parameters', async () => {
        const response = await executor.executeTool('EdgeCaseTool', {
          value: undefined
        });
        expect(response.success).toBe(true);
      });

      it('should handle execution with circular reference parameters', async () => {
        const circular: any = { self: null };
        circular.self = circular;

        const response = await executor.executeTool('EdgeCaseTool', {
          value: 'test',
          circular
        });
        expect(response.success).toBe(true);
      });

      it('should handle execution with extremely large parameters', async () => {
        const largeString = 'x'.repeat(1000000); // 1MB string
        const response = await executor.executeTool('EdgeCaseTool', {
          value: largeString
        });
        expect(response.success).toBe(true);
      });

      it('should handle tool execution that throws non-Error objects', async () => {
        const throwingTool: MockTool = {
          name: 'ThrowStringTool',
          description: 'Tool that throws non-Error objects',
          parameters: { type: 'object', properties: {} },
          execute: async () => {
            throw 'This is a string error';
          }
        };

        executor.registerTool(throwingTool);

        await expect(executor.executeTool('ThrowStringTool', {})).rejects.toThrow('This is a string error');
      });

      it('should handle tool execution that throws null', async () => {
        const throwingTool: MockTool = {
          name: 'ThrowNullTool',
          description: 'Tool that throws null',
          parameters: { type: 'object', properties: {} },
          execute: async () => {
            throw null;
          }
        };

        executor.registerTool(throwingTool);

        await expect(executor.executeTool('ThrowNullTool', {})).rejects.toThrow('null');
      });

      it('should handle tool execution with infinite loops in executor reset', async () => {
        class ProblematicExecutor implements MockToolExecutor {
          async execute(): Promise<MockToolResponse> {
            return { success: true, content: [] };
          }

          reset() {
            // Simulate infinite loop
            const start = Date.now();
            while (Date.now() - start < 100) {
              // Busy wait for 100ms to simulate long reset
            }
          }
        }

        const tool: MockTool = {
          name: 'ProblematicTool',
          description: 'Tool with problematic executor',
          parameters: { type: 'object', properties: {} },
          execute: new ProblematicExecutor()
        };

        executor.registerTool(tool);

        // Execute normally
        await executor.executeTool('ProblematicTool', {});

        // Reset should still work (might be slow)
        const resetStart = Date.now();
        executor.reset();
        const resetTime = Date.now() - resetStart;

        expect(resetTime).toBeGreaterThanOrEqual(100);
      });
    });

    describe('Parameter Validation Edge Cases', () => {
      it('should handle validation of deeply nested objects', async () => {
        const deepTool: MockTool = {
          name: 'DeepTool',
          description: 'Tool with deep parameter validation',
          parameters: {
            type: 'object',
            properties: {
              level1: {
                type: 'object',
                properties: {
                  level2: {
                    type: 'object',
                    properties: {
                      level3: {
                        type: 'string',
                        minLength: 5
                      }
                    },
                    required: ['level3']
                  }
                },
                required: ['level2']
              }
            },
            required: ['level1']
          },
          execute: async () => ({ success: true, content: [] })
        };

        executor.registerTool(deepTool);

        // Valid deep parameter
        await expect(executor.executeTool('DeepTool', {
          level1: {
            level2: {
              level3: 'validstring'
            }
          }
        })).resolves.toMatchObject({ success: true });

        // Invalid deep parameter (too short)
        await expect(executor.executeTool('DeepTool', {
          level1: {
            level2: {
              level3: 'hi'
            }
          }
        })).rejects.toThrow('Parameter validation failed');
      });

      it('should handle validation with conflicting type definitions', async () => {
        const conflictedTool: MockTool = {
          name: 'ConflictedTool',
          description: 'Tool with conflicting type definition',
          parameters: {
            type: 'object',
            properties: {
              conflicted: {
                type: ['string', 'number', 'boolean'] as any,
                minimum: 10, // Only applies to numbers
                minLength: 5  // Only applies to strings
              }
            }
          },
          execute: async () => ({ success: true, content: [] })
        };

        executor.registerTool(conflictedTool);

        // Should accept string
        await expect(executor.executeTool('ConflictedTool', {
          conflicted: 'hello world'
        })).resolves.toMatchObject({ success: true });

        // Should accept number
        await expect(executor.executeTool('ConflictedTool', {
          conflicted: 42
        })).resolves.toMatchObject({ success: true });

        // Should accept boolean
        await expect(executor.executeTool('ConflictedTool', {
          conflicted: true
        })).resolves.toMatchObject({ success: true });
      });

      it('should handle custom validation that throws errors', async () => {
        const throwingValidationTool: MockTool = {
          name: 'ThrowingValidationTool',
          description: 'Tool with validation that throws',
          parameters: { type: 'object', properties: {} },
          execute: async () => ({ success: true, content: [] }),
          validate: () => {
            throw new Error('Validation threw an error');
          }
        };

        executor.registerTool(throwingValidationTool);

        await expect(executor.executeTool('ThrowingValidationTool', {}))
          .rejects.toThrow('Parameter validation failed');
      });

      it('should handle custom validation with malformed results', async () => {
        const malformedValidationTool: MockTool = {
          name: 'MalformedValidationTool',
          description: 'Tool with malformed validation results',
          parameters: { type: 'object', properties: {} },
          execute: async () => ({ success: true, content: [] }),
          validate: (): any => ({
            // Missing 'valid' property
            errors: ['This should not be processed']
          })
        };

        executor.registerTool(malformedValidationTool);

        // Should handle malformed validation gracefully
        await expect(executor.executeTool('MalformedValidationTool', {}))
          .rejects.toThrow('Parameter validation failed');
      });
    });

    describe('Event System Edge Cases', () => {
      it('should handle event listeners that throw errors', async () => {
        const tool: MockTool = {
          name: 'EventTool',
          description: 'Tool for testing event edge cases',
          parameters: { type: 'object', properties: {} },
          execute: async () => ({ success: true, content: [] })
        };

        executor.registerTool(tool);

        // Add throwing event listener
        executor.on('tool:invoked', () => {
          throw new Error('Event listener error');
        });

        // Tool execution should still succeed despite listener error
        const response = await executor.executeTool('EventTool', {});
        expect(response.success).toBe(true);
      });

      it('should handle event listener memory leaks', () => {
        const tool: MockTool = {
          name: 'LeakTool',
          description: 'Tool for testing memory leaks',
          parameters: { type: 'object', properties: {} },
          execute: async () => ({ success: true, content: [] })
        };

        executor.registerTool(tool);

        // Add many listeners
        for (let i = 0; i < 1000; i++) {
          executor.on('tool:event', () => {
            // Empty listener
          });
        }

        expect(executor.listenerCount('tool:event')).toBe(1000);

        // Reset should not affect event listeners (they're separate from tool state)
        executor.reset();
        expect(executor.listenerCount('tool:event')).toBe(1000);
      });
    });

    describe('Concurrency Edge Cases', () => {
      it('should handle concurrent execution with disabled validation', async () => {
        const concurrentExecutor = new MockToolsExecutor({
          maxConcurrentExecutions: 2,
          validateParameters: false,
          validateResponses: false
        });

        const tool: MockTool = {
          name: 'ConcurrentTool',
          description: 'Tool for concurrency testing',
          parameters: { type: 'object', properties: {} },
          responseDelay: 100,
          execute: async () => ({ success: true, content: [] })
        };

        concurrentExecutor.registerTool(tool);

        // Start executions that fill the limit
        const exec1 = concurrentExecutor.executeTool('ConcurrentTool', {});
        const exec2 = concurrentExecutor.executeTool('ConcurrentTool', {});

        // This should fail immediately
        await expect(concurrentExecutor.executeTool('ConcurrentTool', {}))
          .rejects.toThrow('Maximum concurrent executions (2) reached');

        // Wait for completion
        await Promise.all([exec1, exec2]);
      });

      it('should handle rapid successive executions', async () => {
        const fastTool: MockTool = {
          name: 'FastTool',
          description: 'Tool with no delay',
          parameters: { type: 'object', properties: {} },
          execute: async () => ({ success: true, content: [] })
        };

        executor.registerTool(fastTool);

        // Execute many tools rapidly
        const executions: Promise<any>[] = [];
        for (let i = 0; i < 100; i++) {
          executions.push(executor.executeTool('FastTool', { iteration: i }));
        }

        const results = await Promise.all(executions);
        expect(results).toHaveLength(100);
        expect(results.every(r => r.success)).toBe(true);

        // Verify all invocations were recorded
        expect(executor.getInvocations('FastTool')).toHaveLength(100);
      });
    });

    describe('Memory Management Edge Cases', () => {
      it('should handle invocation history overflow', async () => {
        const tool: MockTool = {
          name: 'HistoryTool',
          description: 'Tool for testing history overflow',
          parameters: { type: 'object', properties: {} },
          execute: async () => ({ success: true, content: [] })
        };

        executor.registerTool(tool);

        // Execute more than the internal limit (1000+ invocations)
        for (let i = 0; i < 1100; i++) {
          await executor.executeTool('HistoryTool', { iteration: i });
        }

        const invocations = executor.getInvocations('HistoryTool');

        // Should be limited to prevent memory issues
        expect(invocations.length).toBeLessThanOrEqual(1000);

        // Should keep the most recent invocations
        const lastInvocation = invocations[invocations.length - 1];
        expect(lastInvocation.parameters.iteration).toBe(1099);
      });

      it('should handle reset with massive amounts of data', async () => {
        const dataTool: MockTool = {
          name: 'DataTool',
          description: 'Tool that returns large data',
          parameters: { type: 'object', properties: {} },
          execute: async () => ({
            success: true,
            content: [{
              type: 'text',
              text: 'x'.repeat(100000) // Large response
            }],
            metadata: {
              largeArray: new Array(10000).fill('data')
            }
          })
        };

        executor.registerTool(dataTool);

        // Execute tool multiple times to accumulate large data
        for (let i = 0; i < 10; i++) {
          await executor.executeTool('DataTool', {});
        }

        // Reset should clean up all data
        const resetStart = Date.now();
        executor.reset();
        const resetTime = Date.now() - resetStart;

        // Reset should be reasonably fast even with large data
        expect(resetTime).toBeLessThan(1000);
        expect(executor.getInvocations()).toHaveLength(0);
      });
    });
  });

  describe('MockToolExecution Edge Cases', () => {
    let mockExecution: MockToolExecution;

    beforeEach(() => {
      mockExecution = createMockToolExecution();
    });

    afterEach(() => {
      mockExecution.reset();
    });

    describe('Response Generation Edge Cases', () => {
      it('should handle response generator that returns invalid responses', async () => {
        mockExecution.mockToolDynamic('InvalidTool', () => {
          // Return invalid response structure
          return null as any;
        });

        await expect(mockExecution.executeTool('InvalidTool', {}))
          .rejects.toThrow();
      });

      it('should handle response generator that takes extremely long', async () => {
        mockExecution.mockToolDynamic('SlowGeneratorTool', async () => {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return { success: true, output: 'finally done' };
        });

        const response = await mockExecution.executeTool('SlowGeneratorTool', {});
        expect(response.result.success).toBe(true);
        expect(response.result.output).toBe('finally done');
      });

      it('should handle response generator with memory leaks', async () => {
        const leakyData: any[] = [];

        mockExecution.mockToolDynamic('LeakyTool', () => {
          // Simulate memory leak by accumulating data
          leakyData.push(new Array(10000).fill('leak'));
          return { success: true, output: `Leak size: ${leakyData.length}` };
        });

        // Execute multiple times
        for (let i = 0; i < 10; i++) {
          await mockExecution.executeTool('LeakyTool', {});
        }

        // Data should have accumulated
        expect(leakyData.length).toBe(10);

        // Reset doesn't clean external leaks (by design)
        mockExecution.reset();
        expect(leakyData.length).toBe(10);
      });
    });

    describe('Retry Logic Edge Cases', () => {
      it('should handle retry with changing failure counts', async () => {
        let callCount = 0;
        const dynamicFailureCount = () => callCount++;

        mockExecution.mockToolDynamic('DynamicRetryTool', () => {
          const currentCount = callCount++;
          if (currentCount < 3) {
            return { success: false, error: `Failure ${currentCount}` };
          }
          return { success: true, output: 'Finally succeeded' };
        });

        // Should eventually succeed after dynamic failures
        const response = await mockExecution.executeTool('DynamicRetryTool', {});
        expect(response.result.success).toBe(false);

        const response2 = await mockExecution.executeTool('DynamicRetryTool', {});
        expect(response2.result.success).toBe(false);

        const response3 = await mockExecution.executeTool('DynamicRetryTool', {});
        expect(response3.result.success).toBe(true);
      });

      it('should handle retry tool with zero failure count', async () => {
        mockExecution.mockToolRetry('ZeroFailTool', 0, { success: true });

        const response = await mockExecution.executeTool('ZeroFailTool', {});
        expect(response.result.success).toBe(true);
      });

      it('should handle retry tool with negative failure count', async () => {
        mockExecution.mockToolRetry('NegativeFailTool', -1, { success: true });

        const response = await mockExecution.executeTool('NegativeFailTool', {});
        expect(response.result.success).toBe(true);
      });
    });

    describe('Call Tracking Edge Cases', () => {
      it('should handle parameter matching with complex nested objects', async () => {
        await mockExecution.executeTool('ComplexTool', {
          config: {
            nested: {
              array: [1, 2, { deep: 'value' }],
              map: new Map([['key', 'value']]),
              date: new Date('2023-01-01'),
              regex: /test/gi,
              func: () => 'function'
            }
          }
        });

        // Exact match should work
        expect(mockExecution.wasToolCalledWith('ComplexTool', {
          config: {
            nested: {
              array: [1, 2, { deep: 'value' }]
            }
          }
        })).toBe(true);

        // Partial match should work
        expect(mockExecution.wasToolCalledWith('ComplexTool', {
          config: {
            nested: {
              deep: 'value'
            }
          }
        })).toBe(false); // Deep matching not implemented
      });

      it('should handle order checking with duplicate tool names', async () => {
        await mockExecution.executeTool('DuplicateTool', { step: 1 });
        await mockExecution.executeTool('OtherTool', {});
        await mockExecution.executeTool('DuplicateTool', { step: 2 });
        await mockExecution.executeTool('DuplicateTool', { step: 3 });
        await mockExecution.executeTool('OtherTool', {});

        // Should handle duplicates in order checking
        expect(mockExecution.wereToolsCalledInOrder(['DuplicateTool', 'OtherTool', 'DuplicateTool']))
          .toBe(true);

        expect(mockExecution.wereToolsCalledInOrder(['OtherTool', 'DuplicateTool', 'OtherTool']))
          .toBe(false); // Wrong order
      });

      it('should handle empty tool name in tracking', async () => {
        await mockExecution.executeTool('', { param: 'value' });

        expect(mockExecution.wasToolCalled('')).toBe(true);
        expect(mockExecution.getCallCount('')).toBe(1);

        const calls = mockExecution.getCallsForTool('');
        expect(calls).toHaveLength(1);
        expect(calls[0].toolName).toBe('');
      });
    });

    describe('Assertion Edge Cases', () => {
      it('should handle assertions with floating point call counts', async () => {
        await mockExecution.executeTool('FloatTool', {});

        // Should handle non-integer expected counts gracefully
        expect(() => mockExecution.assertToolCalledTimes('FloatTool', 1.5 as any))
          .toThrow();
      });

      it('should handle assertions with very large expected counts', async () => {
        await mockExecution.executeTool('LargeTool', {});

        expect(() => mockExecution.assertToolCalledTimes('LargeTool', Number.MAX_SAFE_INTEGER))
          .toThrow(/Expected LargeTool to be called \d+ times, but was called 1 times/);
      });

      it('should handle assertion error messages with special characters', async () => {
        const toolName = 'Tool$With#Special@Characters!';
        await mockExecution.executeTool(toolName, {});

        try {
          mockExecution.assertToolCalledTimes(toolName, 0);
        } catch (error) {
          expect(error.message).toContain(toolName);
          expect(error.message).toContain('Expected');
          expect(error.message).toContain('to be called');
        }
      });

      it('should handle parameter assertions with circular references', async () => {
        const circular: any = { ref: null };
        circular.ref = circular;

        await mockExecution.executeTool('CircularTool', {
          normal: 'param',
          circular
        });

        // Should not crash on circular reference in assertion
        expect(() => {
          mockExecution.assertToolCalledWith('CircularTool', { normal: 'param' });
        }).not.toThrow();
      });
    });

    describe('State Management Edge Cases', () => {
      it('should handle reset during active tool execution', async () => {
        let executionStarted = false;
        let executionCompleted = false;

        mockExecution.mockToolDynamic('SlowTool', async () => {
          executionStarted = true;
          await new Promise(resolve => setTimeout(resolve, 100));
          executionCompleted = true;
          return { success: true, output: 'completed' };
        });

        // Start execution
        const execPromise = mockExecution.executeTool('SlowTool', {});

        // Wait for execution to start
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(executionStarted).toBe(true);
        expect(executionCompleted).toBe(false);

        // Reset while execution is in progress
        mockExecution.reset();

        // Execution should still complete
        const response = await execPromise;
        expect(response.result.success).toBe(true);
        expect(executionCompleted).toBe(true);

        // But the call should not be recorded (reset cleared it)
        expect(mockExecution.getCapturedCalls()).toHaveLength(0);
      });

      it('should handle multiple rapid resets', () => {
        // Add some data
        mockExecution.mockToolSuccess('TestTool', { data: 'test' });

        // Rapid resets should not cause issues
        for (let i = 0; i < 100; i++) {
          mockExecution.reset();
        }

        // Should still be functional
        expect(mockExecution.getCapturedCalls()).toHaveLength(0);
      });

      it('should handle reset calls with different reset types', () => {
        mockExecution.mockToolSuccess('Tool1', { data: 'test1' });
        mockExecution.mockToolSuccess('Tool2', { data: 'test2' });

        // Test partial resets
        mockExecution.resetCalls();
        mockExecution.resetBehaviors();

        // Then full reset
        mockExecution.reset();

        expect(mockExecution.getCapturedCalls()).toHaveLength(0);
      });
    });
  });

  describe('Boundary Value Testing', () => {
    let executor: MockToolsExecutor;

    beforeEach(() => {
      executor = new MockToolsExecutor();
    });

    afterEach(() => {
      executor.reset();
    });

    it('should handle minimum valid configuration values', () => {
      const minConfig: MockToolsExecutorConfig = {
        recordInvocations: true,
        emitEvents: true,
        defaultTimeout: 1,
        maxConcurrentExecutions: 1,
        validateParameters: true,
        validateResponses: true,
        globalBehavior: {
          delay: 0,
          errorProbability: 0.0,
          trackInvocations: true,
          maxConcurrent: 1,
          timeout: 1
        }
      };

      const minExecutor = new MockToolsExecutor(minConfig);
      expect(minExecutor).toBeInstanceOf(MockToolsExecutor);
    });

    it('should handle maximum reasonable configuration values', () => {
      const maxConfig: MockToolsExecutorConfig = {
        recordInvocations: true,
        emitEvents: true,
        defaultTimeout: 300000, // 5 minutes
        maxConcurrentExecutions: 1000,
        validateParameters: true,
        validateResponses: true,
        globalBehavior: {
          delay: 10000, // 10 seconds
          errorProbability: 1.0,
          trackInvocations: true,
          maxConcurrent: 1000,
          timeout: 300000
        }
      };

      const maxExecutor = new MockToolsExecutor(maxConfig);
      expect(maxExecutor).toBeInstanceOf(MockToolsExecutor);
    });

    it('should handle boundary values in parameter validation', async () => {
      const boundaryTool: MockTool = {
        name: 'BoundaryTool',
        description: 'Tool with boundary value parameters',
        parameters: {
          type: 'object',
          properties: {
            minString: { type: 'string', minLength: 0, maxLength: 0 },
            maxInteger: { type: 'integer', minimum: Number.MAX_SAFE_INTEGER },
            minNumber: { type: 'number', maximum: Number.MIN_VALUE },
            exactEnum: { type: 'string', enum: ['exact'] },
            emptyArray: { type: 'array', minItems: 0, maxItems: 0 }
          }
        },
        execute: async () => ({ success: true, content: [] })
      };

      executor.registerTool(boundaryTool);

      // Test boundary values
      await expect(executor.executeTool('BoundaryTool', {
        minString: '',
        maxInteger: Number.MAX_SAFE_INTEGER,
        minNumber: Number.MIN_VALUE,
        exactEnum: 'exact',
        emptyArray: []
      })).resolves.toMatchObject({ success: true });

      // Test values outside boundaries
      await expect(executor.executeTool('BoundaryTool', {
        minString: 'too long',
        exactEnum: 'wrong'
      })).rejects.toThrow('Parameter validation failed');
    });

    it('should handle tools with no parameters', async () => {
      const noParamTool: MockTool = {
        name: 'NoParamTool',
        description: 'Tool with no parameters',
        parameters: {
          type: 'object',
          properties: {}
        },
        execute: async () => ({ success: true, content: [] })
      };

      executor.registerTool(noParamTool);

      // Should work with empty object
      await expect(executor.executeTool('NoParamTool', {}))
        .resolves.toMatchObject({ success: true });

      // Should work with unexpected parameters
      await expect(executor.executeTool('NoParamTool', { unexpected: 'param' }))
        .resolves.toMatchObject({ success: true });
    });
  });
});