/**
 * @fileoverview Edge cases and error handling tests for Mock Tool Types
 *
 * This test file focuses on:
 * - Edge cases and boundary conditions
 * - Error handling and recovery
 * - Malformed data and input validation
 * - Resource constraints and limits
 * - Concurrent access and race conditions
 * - Network failure simulations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type {
  MockTool,
  MockToolResponse,
  ToolInvocation,
  ToolInvocationContext,
  MockToolExecutor,
  MockToolValidationResult,
} from '../test-utils/mock-tool-types.js';

import {
  MockToolResponseSchema,
  ToolInvocationSchema,
  MockToolSchema,
} from '../test-utils/mock-tool-types.js';

describe('Mock Tool Types Edge Cases and Error Handling', () => {
  describe('Boundary conditions', () => {
    it('should handle empty and null parameters gracefully', async () => {
      const boundaryTool: MockTool = {
        name: 'BoundaryTool',
        description: 'Tool for testing boundary conditions',
        parameters: {
          type: 'object',
          properties: {
            optionalParam: { type: 'string' },
            requiredParam: { type: 'string' },
          },
          required: ['requiredParam'],
        },
        execute: async (params) => {
          if (!params.requiredParam) {
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: 'Required parameter missing',
                  code: 'MISSING_REQUIRED_PARAM',
                },
              ],
            };
          }

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Processed: required=${params.requiredParam}, optional=${params.optionalParam || 'null'}`,
              },
            ],
            metadata: {
              hasOptional: !!params.optionalParam,
              paramCount: Object.keys(params).length,
            },
          };
        },
      };

      // Test with null parameters
      const nullResponse = await (boundaryTool.execute as Function)({
        requiredParam: null,
      });
      expect(nullResponse.success).toBe(false);

      // Test with undefined parameters
      const undefinedResponse = await (boundaryTool.execute as Function)({
        requiredParam: undefined,
      });
      expect(undefinedResponse.success).toBe(false);

      // Test with empty string (valid)
      const emptyStringResponse = await (boundaryTool.execute as Function)({
        requiredParam: '',
      });
      expect(emptyStringResponse.success).toBe(true);
      expect(emptyStringResponse.metadata?.hasOptional).toBe(false);

      // Test with valid parameters
      const validResponse = await (boundaryTool.execute as Function)({
        requiredParam: 'test',
        optionalParam: 'optional',
      });
      expect(validResponse.success).toBe(true);
      expect(validResponse.metadata?.hasOptional).toBe(true);
      expect(validResponse.metadata?.paramCount).toBe(2);
    });

    it('should handle extremely large inputs', async () => {
      class LargeInputExecutor implements MockToolExecutor {
        private maxInputSize = 1024 * 1024; // 1MB

        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          const input = params.input as string;

          if (!input) {
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: 'Input is required',
                  code: 'MISSING_INPUT',
                },
              ],
            };
          }

          if (input.length > this.maxInputSize) {
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: `Input too large: ${input.length} bytes exceeds maximum of ${this.maxInputSize} bytes`,
                  code: 'INPUT_TOO_LARGE',
                  details: {
                    inputSize: input.length,
                    maxSize: this.maxInputSize,
                  },
                },
              ],
            };
          }

          // Process large input with memory usage tracking
          const startMemory = process.memoryUsage().heapUsed;
          const processed = input.toUpperCase(); // Simple transformation
          const endMemory = process.memoryUsage().heapUsed;

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Processed ${input.length} characters successfully`,
              },
            ],
            metadata: {
              inputSize: input.length,
              outputSize: processed.length,
              memoryUsed: endMemory - startMemory,
              isLargeInput: input.length > 100000,
            },
          };
        }

        reset() {
          // No state to reset
        }
      }

      const executor = new LargeInputExecutor();

      // Test normal input
      const normalResponse = await executor.execute({ input: 'normal text' });
      expect(normalResponse.success).toBe(true);
      expect(normalResponse.metadata?.isLargeInput).toBe(false);

      // Test large input (100KB)
      const largeInput = 'x'.repeat(100000);
      const largeResponse = await executor.execute({ input: largeInput });
      expect(largeResponse.success).toBe(true);
      expect(largeResponse.metadata?.isLargeInput).toBe(true);
      expect(largeResponse.metadata?.inputSize).toBe(100000);

      // Test too large input (2MB)
      const tooLargeInput = 'x'.repeat(2 * 1024 * 1024);
      const tooLargeResponse = await executor.execute({ input: tooLargeInput });
      expect(tooLargeResponse.success).toBe(false);
      expect(tooLargeResponse.content[0].code).toBe('INPUT_TOO_LARGE');
    });

    it('should handle deeply nested objects', async () => {
      const createDeepObject = (depth: number): any => {
        if (depth === 0) {
          return 'leaf';
        }
        return {
          level: depth,
          child: createDeepObject(depth - 1),
          array: Array(3).fill(null).map((_, i) => ({ index: i, value: `item_${i}` })),
        };
      };

      class DeepObjectExecutor implements MockToolExecutor {
        private maxDepth = 100;

        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          const data = params.data;

          if (!data) {
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: 'Data parameter is required',
                  code: 'MISSING_DATA',
                },
              ],
            };
          }

          try {
            const depth = this.calculateDepth(data);

            if (depth > this.maxDepth) {
              return {
                success: false,
                isError: true,
                content: [
                  {
                    type: 'error',
                    message: `Object nesting too deep: ${depth} levels exceeds maximum of ${this.maxDepth}`,
                    code: 'NESTING_TOO_DEEP',
                  },
                ],
              };
            }

            const serialized = JSON.stringify(data);
            const parsed = JSON.parse(serialized);

            return {
              success: true,
              content: [
                {
                  type: 'text',
                  text: `Successfully processed object with ${depth} levels of nesting`,
                },
              ],
              metadata: {
                depth,
                serializedSize: serialized.length,
                nodeCount: this.countNodes(data),
              },
            };
          } catch (error) {
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: `Failed to process object: ${error instanceof Error ? error.message : String(error)}`,
                  code: 'PROCESSING_ERROR',
                },
              ],
            };
          }
        }

        private calculateDepth(obj: any, currentDepth = 0): number {
          if (obj === null || typeof obj !== 'object') {
            return currentDepth;
          }

          let maxChildDepth = currentDepth;

          if (Array.isArray(obj)) {
            for (const item of obj) {
              const childDepth = this.calculateDepth(item, currentDepth + 1);
              maxChildDepth = Math.max(maxChildDepth, childDepth);
            }
          } else {
            for (const value of Object.values(obj)) {
              const childDepth = this.calculateDepth(value, currentDepth + 1);
              maxChildDepth = Math.max(maxChildDepth, childDepth);
            }
          }

          return maxChildDepth;
        }

        private countNodes(obj: any): number {
          if (obj === null || typeof obj !== 'object') {
            return 1;
          }

          let count = 1;

          if (Array.isArray(obj)) {
            for (const item of obj) {
              count += this.countNodes(item);
            }
          } else {
            for (const value of Object.values(obj)) {
              count += this.countNodes(value);
            }
          }

          return count;
        }

        reset() {
          // No state to reset
        }
      }

      const executor = new DeepObjectExecutor();

      // Test shallow object
      const shallowResponse = await executor.execute({
        data: { a: 1, b: 2, c: { d: 3 } },
      });
      expect(shallowResponse.success).toBe(true);
      expect(shallowResponse.metadata?.depth).toBe(2);

      // Test moderately deep object
      const moderatelyDeepData = createDeepObject(10);
      const moderateResponse = await executor.execute({ data: moderatelyDeepData });
      expect(moderateResponse.success).toBe(true);
      expect(moderateResponse.metadata?.depth).toBe(10);

      // Test extremely deep object
      const extremelyDeepData = createDeepObject(150);
      const extremeResponse = await executor.execute({ data: extremelyDeepData });
      expect(extremeResponse.success).toBe(false);
      expect(extremeResponse.content[0].code).toBe('NESTING_TOO_DEEP');
    });
  });

  describe('Error recovery and resilience', () => {
    it('should handle transient failures with retry logic', async () => {
      class RetryableExecutor implements MockToolExecutor {
        private attemptCount = 0;
        private failureRate = 0.7; // 70% failure rate initially

        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          this.attemptCount++;
          const maxRetries = (params.maxRetries as number) || 3;
          const retryDelay = (params.retryDelay as number) || 100;

          const shouldFail = Math.random() < this.failureRate;

          // Reduce failure rate with each attempt (simulate transient issues)
          this.failureRate = Math.max(0.1, this.failureRate - 0.2);

          if (shouldFail && this.attemptCount <= maxRetries) {
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: `Transient failure on attempt ${this.attemptCount}`,
                  code: 'TRANSIENT_FAILURE',
                  details: {
                    attempt: this.attemptCount,
                    maxRetries,
                    willRetry: this.attemptCount < maxRetries,
                  },
                },
              ],
              metadata: {
                retryable: this.attemptCount < maxRetries,
                nextRetryDelay: retryDelay * this.attemptCount,
              },
            };
          }

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Operation succeeded on attempt ${this.attemptCount}`,
              },
            ],
            metadata: {
              attemptsRequired: this.attemptCount,
              finalFailureRate: this.failureRate,
            },
          };
        }

        reset() {
          this.attemptCount = 0;
          this.failureRate = 0.7;
        }
      }

      const executor = new RetryableExecutor();

      // Test retry logic
      let response = await executor.execute({ maxRetries: 5, retryDelay: 50 });

      while (!response.success && response.metadata?.retryable) {
        vi.advanceTimersByTime(response.metadata?.nextRetryDelay as number);
        response = await executor.execute({ maxRetries: 5, retryDelay: 50 });
      }

      expect(response.success).toBe(true);
      expect(response.metadata?.attemptsRequired).toBeGreaterThan(1);
    });

    it('should handle memory exhaustion scenarios', async () => {
      class MemoryAwareExecutor implements MockToolExecutor {
        private memoryLimit = 100 * 1024 * 1024; // 100MB simulated limit

        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          const allocateSize = (params.allocateSize as number) || 0;

          // Simulate memory check
          const currentMemory = process.memoryUsage().heapUsed;
          const wouldExceedLimit = currentMemory + allocateSize > this.memoryLimit;

          if (wouldExceedLimit) {
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: `Memory allocation would exceed limit: ${allocateSize} bytes would bring total to ${currentMemory + allocateSize} bytes (limit: ${this.memoryLimit})`,
                  code: 'MEMORY_LIMIT_EXCEEDED',
                  details: {
                    requestedAllocation: allocateSize,
                    currentMemory,
                    memoryLimit: this.memoryLimit,
                    availableMemory: this.memoryLimit - currentMemory,
                  },
                },
              ],
            };
          }

          // Simulate memory allocation and cleanup
          const buffer = allocateSize > 0 ? Buffer.alloc(allocateSize, 'x') : null;
          const afterAllocation = process.memoryUsage().heapUsed;

          // Clean up immediately
          if (buffer) {
            buffer.fill(0);
          }

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Successfully allocated and cleaned up ${allocateSize} bytes`,
              },
            ],
            metadata: {
              allocatedSize: allocateSize,
              memoryBefore: currentMemory,
              memoryAfter: afterAllocation,
              memoryDelta: afterAllocation - currentMemory,
            },
          };
        }

        reset() {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
      }

      const executor = new MemoryAwareExecutor();

      // Test normal allocation
      const normalResponse = await executor.execute({ allocateSize: 1024 });
      expect(normalResponse.success).toBe(true);

      // Test large allocation that should succeed
      const largeResponse = await executor.execute({ allocateSize: 1024 * 1024 });
      expect(largeResponse.success).toBe(true);

      // Test allocation that exceeds limit
      const tooLargeResponse = await executor.execute({ allocateSize: 200 * 1024 * 1024 });
      expect(tooLargeResponse.success).toBe(false);
      expect(tooLargeResponse.content[0].code).toBe('MEMORY_LIMIT_EXCEEDED');
    });

    it('should handle circular references gracefully', async () => {
      class CircularReferenceExecutor implements MockToolExecutor {
        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          try {
            // Try to serialize the parameters to detect circular references
            const serialized = JSON.stringify(params);

            return {
              success: true,
              content: [
                {
                  type: 'text',
                  text: `Parameters serialized successfully (${serialized.length} chars)`,
                },
              ],
              metadata: {
                serializedLength: serialized.length,
                parameterKeys: Object.keys(params),
              },
            };
          } catch (error) {
            const isCircularError = error instanceof Error && error.message.includes('circular');

            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: isCircularError
                    ? 'Circular reference detected in parameters'
                    : `Serialization failed: ${error instanceof Error ? error.message : String(error)}`,
                  code: isCircularError ? 'CIRCULAR_REFERENCE' : 'SERIALIZATION_ERROR',
                  details: {
                    isCircular: isCircularError,
                    parameterKeys: Object.keys(params),
                  },
                },
              ],
            };
          }
        }

        reset() {
          // No state to reset
        }
      }

      const executor = new CircularReferenceExecutor();

      // Test normal object
      const normalResponse = await executor.execute({
        data: { a: 1, b: { c: 2 } },
      });
      expect(normalResponse.success).toBe(true);

      // Test circular reference
      const circularObj: any = { name: 'parent' };
      circularObj.child = { name: 'child', parent: circularObj };

      const circularResponse = await executor.execute({ data: circularObj });
      expect(circularResponse.success).toBe(false);
      expect(circularResponse.content[0].code).toBe('CIRCULAR_REFERENCE');
    });
  });

  describe('Malformed data handling', () => {
    it('should handle invalid UTF-8 sequences', async () => {
      class UTF8ValidatorExecutor implements MockToolExecutor {
        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          const text = params.text as string;

          if (typeof text !== 'string') {
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: 'Text parameter must be a string',
                  code: 'INVALID_TYPE',
                },
              ],
            };
          }

          // Check for common invalid UTF-8 patterns
          const hasInvalidChars = /[\uFFFD]/.test(text); // Replacement character
          const hasNullBytes = text.includes('\0');
          const hasSurrogateIssues = /[\uD800-\uDFFF]/.test(text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''));

          if (hasInvalidChars || hasNullBytes || hasSurrogateIssues) {
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: 'Invalid UTF-8 sequence detected',
                  code: 'INVALID_UTF8',
                  details: {
                    hasInvalidChars,
                    hasNullBytes,
                    hasSurrogateIssues,
                    textLength: text.length,
                    textPreview: text.substring(0, 100),
                  },
                },
              ],
            };
          }

          // Process valid UTF-8 text
          const byteLength = Buffer.byteLength(text, 'utf8');
          const charLength = text.length;

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Valid UTF-8 text processed successfully`,
              },
            ],
            metadata: {
              characterCount: charLength,
              byteCount: byteLength,
              isMultibyte: byteLength > charLength,
              encoding: 'utf-8',
            },
          };
        }

        reset() {
          // No state to reset
        }
      }

      const executor = new UTF8ValidatorExecutor();

      // Test valid ASCII text
      const asciiResponse = await executor.execute({ text: 'Hello, World!' });
      expect(asciiResponse.success).toBe(true);
      expect(asciiResponse.metadata?.isMultibyte).toBe(false);

      // Test valid UTF-8 with multibyte characters
      const unicodeResponse = await executor.execute({ text: '🚀 Hello, 世界! 🌍' });
      expect(unicodeResponse.success).toBe(true);
      expect(unicodeResponse.metadata?.isMultibyte).toBe(true);

      // Test text with null bytes
      const nullByteResponse = await executor.execute({ text: 'Hello\0World' });
      expect(nullByteResponse.success).toBe(false);
      expect(nullByteResponse.content[0].code).toBe('INVALID_UTF8');

      // Test text with replacement characters (simulating invalid UTF-8)
      const replacementResponse = await executor.execute({ text: 'Hello\uFFFDWorld' });
      expect(replacementResponse.success).toBe(false);
      expect(replacementResponse.content[0].code).toBe('INVALID_UTF8');
    });

    it('should handle malformed JSON gracefully', async () => {
      class JSONProcessorExecutor implements MockToolExecutor {
        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          const jsonString = params.json as string;

          if (typeof jsonString !== 'string') {
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: 'JSON parameter must be a string',
                  code: 'INVALID_TYPE',
                },
              ],
            };
          }

          try {
            const parsed = JSON.parse(jsonString);
            const stringified = JSON.stringify(parsed, null, 2);

            return {
              success: true,
              content: [
                {
                  type: 'text',
                  text: 'JSON processed successfully',
                },
                {
                  type: 'resource',
                  uri: 'data:application/json;base64,' + Buffer.from(stringified).toString('base64'),
                  mimeType: 'application/json',
                  text: stringified,
                },
              ],
              metadata: {
                originalLength: jsonString.length,
                formattedLength: stringified.length,
                objectType: Array.isArray(parsed) ? 'array' : typeof parsed,
                keyCount: typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).length : 0,
              },
            };
          } catch (error) {
            const err = error as Error;
            const errorInfo = this.analyzeJSONError(jsonString, err.message);

            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: `Invalid JSON: ${err.message}`,
                  code: 'INVALID_JSON',
                  details: {
                    originalError: err.message,
                    ...errorInfo,
                  },
                },
              ],
            };
          }
        }

        private analyzeJSONError(jsonString: string, errorMessage: string): Record<string, unknown> {
          const analysis: Record<string, unknown> = {
            length: jsonString.length,
            hasContent: jsonString.trim().length > 0,
          };

          // Extract position information from error message
          const positionMatch = errorMessage.match(/position (\d+)/);
          if (positionMatch) {
            const position = parseInt(positionMatch[1]);
            analysis.errorPosition = position;
            analysis.errorContext = jsonString.substring(Math.max(0, position - 10), position + 10);
          }

          // Check for common JSON errors
          const trimmed = jsonString.trim();
          if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
            analysis.likelyIssue = 'Does not start with { or [';
          } else if (!trimmed.endsWith('}') && !trimmed.endsWith(']')) {
            analysis.likelyIssue = 'Does not end with } or ]';
          } else if (errorMessage.includes('Unexpected token')) {
            analysis.likelyIssue = 'Contains unexpected characters';
          } else if (errorMessage.includes('Unexpected end')) {
            analysis.likelyIssue = 'Incomplete JSON structure';
          }

          return analysis;
        }

        reset() {
          // No state to reset
        }
      }

      const executor = new JSONProcessorExecutor();

      // Test valid JSON
      const validResponse = await executor.execute({
        json: '{"name": "test", "value": 42, "active": true}',
      });
      expect(validResponse.success).toBe(true);
      expect(validResponse.metadata?.objectType).toBe('object');
      expect(validResponse.metadata?.keyCount).toBe(3);

      // Test valid JSON array
      const arrayResponse = await executor.execute({
        json: '[1, 2, 3, "test"]',
      });
      expect(arrayResponse.success).toBe(true);
      expect(arrayResponse.metadata?.objectType).toBe('array');

      // Test malformed JSON - missing quotes
      const missingQuotesResponse = await executor.execute({
        json: '{name: "test", value: 42}',
      });
      expect(missingQuotesResponse.success).toBe(false);
      expect(missingQuotesResponse.content[0].code).toBe('INVALID_JSON');

      // Test malformed JSON - trailing comma
      const trailingCommaResponse = await executor.execute({
        json: '{"name": "test", "value": 42,}',
      });
      expect(trailingCommaResponse.success).toBe(false);
      expect(trailingCommaResponse.content[0].code).toBe('INVALID_JSON');

      // Test incomplete JSON
      const incompleteResponse = await executor.execute({
        json: '{"name": "test", "value":',
      });
      expect(incompleteResponse.success).toBe(false);
      expect(incompleteResponse.content[0].details?.likelyIssue).toContain('Incomplete');
    });
  });

  describe('Schema validation edge cases', () => {
    it('should handle schema validation with extreme cases', () => {
      // Test very large response object
      const largeContentArray = Array(1000).fill(null).map((_, index) => ({
        type: 'text' as const,
        text: `Content block ${index}: ${'x'.repeat(100)}`,
      }));

      const largeResponse: MockToolResponse = {
        success: true,
        content: largeContentArray,
        duration: 5000,
        metadata: {
          contentBlocks: largeContentArray.length,
          largeResponse: true,
          processingTime: 5000,
          memoryUsage: {
            before: 50 * 1024 * 1024,
            after: 75 * 1024 * 1024,
            delta: 25 * 1024 * 1024,
          },
        },
      };

      const validation = MockToolResponseSchema.safeParse(largeResponse);
      expect(validation.success).toBe(true);

      if (validation.success) {
        expect(validation.data.content).toHaveLength(1000);
        expect(validation.data.metadata?.contentBlocks).toBe(1000);
      }
    });

    it('should validate complex nested invocation contexts', () => {
      const complexInvocation: ToolInvocation = {
        id: 'complex_nested_validation_test',
        toolName: 'NestedComplexTool',
        parameters: {
          config: {
            deeply: {
              nested: {
                configuration: {
                  values: [1, 2, 3, { nested: true }],
                  settings: {
                    timeout: 30000,
                    retries: 5,
                    endpoints: {
                      primary: 'https://api1.example.com',
                      fallback: 'https://api2.example.com',
                      monitoring: {
                        health: 'https://health.example.com',
                        metrics: 'https://metrics.example.com',
                      },
                    },
                  },
                },
              },
            },
          },
          metadata: {
            requestId: 'req_12345',
            traceId: 'trace_67890',
            spanId: 'span_abcdef',
            user: {
              id: 'user_123',
              roles: ['admin', 'developer'],
              permissions: ['read', 'write', 'execute'],
            },
          },
        },
        invokedAt: new Date('2024-01-01T12:00:00.000Z'),
        completedAt: new Date('2024-01-01T12:00:30.500Z'),
        duration: 30500,
        context: {
          taskId: 'complex_task_789',
          agentName: 'complex_agent',
          stageName: 'complex_processing',
          workingDirectory: '/complex/workspace/path',
          requestId: 'context_req_456',
        },
        response: {
          success: true,
          content: [
            {
              type: 'text',
              text: 'Complex nested processing completed successfully',
            },
            {
              type: 'resource',
              uri: 'file:///complex/output/result.json',
              mimeType: 'application/json',
              text: JSON.stringify({
                processedItems: 1500,
                successRate: 0.98,
                errors: [
                  { code: 'MINOR_ERROR', count: 30 },
                ],
                performance: {
                  avgProcessingTime: 20.5,
                  maxProcessingTime: 45.2,
                  minProcessingTime: 5.1,
                },
              }),
            },
          ],
          duration: 30500,
          metadata: {
            complexProcessing: true,
            itemsProcessed: 1500,
            errorCount: 30,
            warningCount: 5,
            performanceMetrics: {
              cpu: 85.5,
              memory: 2048.7,
              io: 125.3,
            },
          },
        },
      };

      const validation = ToolInvocationSchema.safeParse(complexInvocation);
      expect(validation.success).toBe(true);

      if (validation.success) {
        const data = validation.data;
        expect(data.duration).toBe(30500);
        expect(data.context?.taskId).toBe('complex_task_789');
        expect(data.response?.success).toBe(true);
        expect(data.response?.content).toHaveLength(2);
        expect(data.response?.metadata?.itemsProcessed).toBe(1500);
      }
    });

    it('should handle schema validation failures gracefully', () => {
      // Test invalid tool response
      const invalidResponse = {
        success: 'not a boolean', // Should be boolean
        content: 'not an array', // Should be array
        duration: 'not a number', // Should be number
        metadata: 'not an object', // Should be object
      };

      const responseValidation = MockToolResponseSchema.safeParse(invalidResponse);
      expect(responseValidation.success).toBe(false);

      if (!responseValidation.success) {
        const errors = responseValidation.error.errors;
        expect(errors.some(err => err.path.includes('success'))).toBe(true);
        expect(errors.some(err => err.path.includes('content'))).toBe(true);
      }

      // Test invalid tool invocation
      const invalidInvocation = {
        id: 123, // Should be string
        toolName: null, // Should be string
        parameters: 'not an object', // Should be object
        invokedAt: 'not a date', // Should be Date
      };

      const invocationValidation = ToolInvocationSchema.safeParse(invalidInvocation);
      expect(invocationValidation.success).toBe(false);

      if (!invocationValidation.success) {
        const errors = invocationValidation.error.errors;
        expect(errors.some(err => err.path.includes('id'))).toBe(true);
        expect(errors.some(err => err.path.includes('toolName'))).toBe(true);
        expect(errors.some(err => err.path.includes('parameters'))).toBe(true);
        expect(errors.some(err => err.path.includes('invokedAt'))).toBe(true);
      }
    });
  });

  describe('Resource constraints', () => {
    it('should handle timeout scenarios', async () => {
      class TimeoutSimulatorExecutor implements MockToolExecutor {
        async execute(params: Record<string, unknown>, context?: ToolInvocationContext): Promise<MockToolResponse> {
          const duration = (params.duration as number) || 1000;
          const timeout = (params.timeout as number) || 5000;

          const startTime = Date.now();

          // Simulate work that can be interrupted
          return new Promise((resolve) => {
            const workTimer = setTimeout(() => {
              const actualDuration = Date.now() - startTime;
              resolve({
                success: true,
                content: [
                  {
                    type: 'text',
                    text: `Work completed in ${actualDuration}ms`,
                  },
                ],
                duration: actualDuration,
              });
            }, duration);

            const timeoutTimer = setTimeout(() => {
              clearTimeout(workTimer);
              const actualDuration = Date.now() - startTime;
              resolve({
                success: false,
                isError: true,
                content: [
                  {
                    type: 'error',
                    message: `Operation timed out after ${actualDuration}ms (limit: ${timeout}ms)`,
                    code: 'TIMEOUT',
                    details: {
                      requestedDuration: duration,
                      timeoutLimit: timeout,
                      actualDuration,
                    },
                  },
                ],
                duration: actualDuration,
              });
            }, timeout);

            // Handle cancellation signal
            if (context?.signal) {
              const abortHandler = () => {
                clearTimeout(workTimer);
                clearTimeout(timeoutTimer);
                const actualDuration = Date.now() - startTime;
                resolve({
                  success: false,
                  isError: true,
                  content: [
                    {
                      type: 'error',
                      message: `Operation cancelled after ${actualDuration}ms`,
                      code: 'CANCELLED',
                    },
                  ],
                  duration: actualDuration,
                });
              };

              if (context.signal.aborted) {
                abortHandler();
              } else {
                context.signal.addEventListener('abort', abortHandler);
              }
            }
          });
        }

        reset() {
          // No state to reset
        }
      }

      const executor = new TimeoutSimulatorExecutor();

      vi.useFakeTimers();

      // Test successful completion within timeout
      const successPromise = executor.execute({
        duration: 1000,
        timeout: 5000,
      });
      vi.advanceTimersByTime(1000);
      const successResponse = await successPromise;

      expect(successResponse.success).toBe(true);
      expect(successResponse.duration).toBe(1000);

      // Test timeout scenario
      const timeoutPromise = executor.execute({
        duration: 10000,
        timeout: 2000,
      });
      vi.advanceTimersByTime(2000);
      const timeoutResponse = await timeoutPromise;

      expect(timeoutResponse.success).toBe(false);
      expect(timeoutResponse.content[0].code).toBe('TIMEOUT');
      expect(timeoutResponse.duration).toBe(2000);

      // Test cancellation
      const abortController = new AbortController();
      const cancellationPromise = executor.execute(
        { duration: 5000, timeout: 10000 },
        { signal: abortController.signal }
      );

      vi.advanceTimersByTime(1500);
      abortController.abort();

      const cancellationResponse = await cancellationPromise;
      expect(cancellationResponse.success).toBe(false);
      expect(cancellationResponse.content[0].code).toBe('CANCELLED');

      vi.useRealTimers();
    });
  });
});