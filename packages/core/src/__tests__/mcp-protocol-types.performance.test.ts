import { describe, it, expect, beforeEach } from 'vitest';
import {
  MCPToolsCallParamsSchema,
  MCPToolsCallResultSchema,
  MCPPromptsGetResultSchema,
  MCPResourcesListResultSchema,
  MCPInitializeParamsSchema,
  JsonRpcRequestSchema,
  type MCPToolsCallParams,
  type MCPToolsCallResult,
} from '../mcp/protocol-types.js';

describe('MCP Protocol Types - Performance Tests', () => {
  let performanceData: {
    largeText: string;
    deepObject: any;
    manyTools: any[];
    manyMessages: any[];
  };

  beforeEach(() => {
    // Prepare test data once per test suite
    performanceData = {
      largeText: 'x'.repeat(100000), // 100KB text
      deepObject: createDeepObject(50),
      manyTools: createManyTools(1000),
      manyMessages: createManyMessages(500),
    };
  });

  function createDeepObject(depth: number): any {
    if (depth === 0) return { value: 'leaf' };
    return {
      level: depth,
      data: `level-${depth}-data`,
      child: createDeepObject(depth - 1),
    };
  }

  function createManyTools(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      name: `tool_${i}`,
      description: `Tool number ${i} for testing purposes`,
      inputSchema: {
        type: 'object',
        properties: {
          param1: { type: 'string' },
          param2: { type: 'number' },
          param3: { type: 'boolean' },
        },
        required: ['param1'],
      },
    }));
  }

  function createManyMessages(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: {
        type: 'text',
        text: `Message ${i}: ${Math.random().toString(36).substring(2)}`,
      },
    }));
  }

  describe('Large Text Content Performance', () => {
    it('validates large text content efficiently', () => {
      const toolResult: MCPToolsCallResult = {
        content: [
          {
            type: 'text',
            text: performanceData.largeText,
          },
        ],
        isError: false,
      };

      const startTime = performance.now();
      const result = MCPToolsCallResultSchema.parse(toolResult);
      const endTime = performance.now();

      expect(result.content[0].type).toBe('text');
      expect((result.content[0] as any).text).toHaveLength(100000);

      // Should complete within 50ms even for large content
      expect(endTime - startTime).toBeLessThan(50);
    });

    it('handles multiple large text blocks', () => {
      const toolResult: MCPToolsCallResult = {
        content: [
          { type: 'text', text: performanceData.largeText },
          { type: 'text', text: performanceData.largeText },
          { type: 'text', text: performanceData.largeText },
        ],
        isError: false,
      };

      const startTime = performance.now();
      const result = MCPToolsCallResultSchema.parse(toolResult);
      const endTime = performance.now();

      expect(result.content).toHaveLength(3);
      // Should still be reasonably fast even with multiple large blocks
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Deep Object Validation Performance', () => {
    it('validates deeply nested arguments efficiently', () => {
      const toolCall: MCPToolsCallParams = {
        name: 'deep_analysis',
        arguments: performanceData.deepObject,
      };

      const startTime = performance.now();
      const result = MCPToolsCallParamsSchema.parse(toolCall);
      const endTime = performance.now();

      expect(result.name).toBe('deep_analysis');
      expect(result.arguments).toEqual(performanceData.deepObject);

      // Deep validation should be fast
      expect(endTime - startTime).toBeLessThan(30);
    });

    it('handles very wide objects with many properties', () => {
      const wideObject: Record<string, any> = {};
      for (let i = 0; i < 1000; i++) {
        wideObject[`prop_${i}`] = {
          value: i,
          text: `Property ${i}`,
          enabled: i % 2 === 0,
        };
      }

      const toolCall: MCPToolsCallParams = {
        name: 'wide_analysis',
        arguments: wideObject,
      };

      const startTime = performance.now();
      const result = MCPToolsCallParamsSchema.parse(toolCall);
      const endTime = performance.now();

      expect(result.arguments).toEqual(wideObject);
      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe('Large Array Validation Performance', () => {
    it('validates many tools efficiently', () => {
      const toolsList = {
        tools: performanceData.manyTools,
      };

      const startTime = performance.now();
      const result = MCPResourcesListResultSchema.parse({
        resources: toolsList.tools.map(tool => ({
          uri: `tool://${tool.name}`,
          name: tool.name,
          description: tool.description,
        })),
      });
      const endTime = performance.now();

      expect(result.resources).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('validates many prompt messages efficiently', () => {
      const promptResult = {
        messages: performanceData.manyMessages,
      };

      const startTime = performance.now();
      const result = MCPPromptsGetResultSchema.parse(promptResult);
      const endTime = performance.now();

      expect(result.messages).toHaveLength(500);
      expect(endTime - startTime).toBeLessThan(75);
    });

    it('handles large content arrays with mixed types', () => {
      const mixedContent = Array.from({ length: 100 }, (_, i) => {
        if (i % 3 === 0) {
          return { type: 'text' as const, text: `Text content ${i}` };
        } else if (i % 3 === 1) {
          return {
            type: 'image' as const,
            data: `imagedata${i}`,
            mimeType: 'image/png',
          };
        } else {
          return {
            type: 'resource' as const,
            resource: {
              uri: `file:///resource${i}.txt`,
              text: `Resource content ${i}`,
            },
          };
        }
      });

      const toolResult: MCPToolsCallResult = {
        content: mixedContent,
        isError: false,
      };

      const startTime = performance.now();
      const result = MCPToolsCallResultSchema.parse(toolResult);
      const endTime = performance.now();

      expect(result.content).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe('Repeated Validation Performance', () => {
    it('maintains performance with repeated validations', () => {
      const toolCall: MCPToolsCallParams = {
        name: 'test_tool',
        arguments: { param: 'value' },
      };

      const iterations = 10000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        MCPToolsCallParamsSchema.parse(toolCall);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const timePerValidation = totalTime / iterations;

      // Each validation should be very fast
      expect(timePerValidation).toBeLessThan(0.01); // Less than 0.01ms per validation
      expect(totalTime).toBeLessThan(100); // Total time under 100ms
    });

    it('handles concurrent validations efficiently', async () => {
      const toolCall: MCPToolsCallParams = {
        name: 'concurrent_tool',
        arguments: { data: 'test' },
      };

      const concurrentValidations = 1000;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentValidations }, () =>
        Promise.resolve(MCPToolsCallParamsSchema.parse(toolCall))
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();

      expect(results).toHaveLength(concurrentValidations);
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Memory Usage Testing', () => {
    it('does not accumulate memory with repeated validations', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Run many validations
      for (let i = 0; i < 10000; i++) {
        const toolCall: MCPToolsCallParams = {
          name: `tool_${i}`,
          arguments: { iteration: i, data: `data_${i}` },
        };
        MCPToolsCallParamsSchema.parse(toolCall);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('handles large objects without excessive memory allocation', () => {
      const largeArguments: Record<string, any> = {};

      // Create a moderately large object
      for (let i = 0; i < 1000; i++) {
        largeArguments[`key_${i}`] = {
          index: i,
          text: `Value for key ${i}`.repeat(10), // ~200 chars each
          nested: {
            subkey: i * 2,
            data: Array.from({ length: 10 }, (_, j) => j + i),
          },
        };
      }

      const toolCall: MCPToolsCallParams = {
        name: 'large_object_tool',
        arguments: largeArguments,
      };

      const initialMemory = process.memoryUsage().heapUsed;
      const result = MCPToolsCallParamsSchema.parse(toolCall);
      const finalMemory = process.memoryUsage().heapUsed;

      expect(result.arguments).toEqual(largeArguments);

      // Memory usage should be reasonable (object might be copied, but not excessively)
      const memoryIncrease = finalMemory - initialMemory;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });
  });

  describe('JSON-RPC Message Performance', () => {
    it('validates complex JSON-RPC messages efficiently', () => {
      const complexRequest = {
        jsonrpc: '2.0',
        id: 'complex-request-123',
        method: 'tools/call',
        params: {
          name: 'complex_analysis',
          arguments: {
            data: performanceData.deepObject,
            files: Array.from({ length: 100 }, (_, i) => `file_${i}.txt`),
            config: {
              analysis_type: 'comprehensive',
              options: {
                deep_scan: true,
                include_metadata: true,
                format: 'detailed',
              },
            },
          },
        },
      };

      const startTime = performance.now();
      const result = JsonRpcRequestSchema.parse(complexRequest);
      const endTime = performance.now();

      expect(result.method).toBe('tools/call');
      expect(endTime - startTime).toBeLessThan(20);
    });

    it('validates initialization with many capabilities efficiently', () => {
      const complexInitialization = {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
          experimental: {
            feature1: { enabled: true, version: '1.0' },
            feature2: { enabled: false, beta: true },
            advanced: {
              multiModal: true,
              streaming: true,
              batch: { maxSize: 100, timeout: 30000 },
              customProtocol: {
                version: '2.0',
                extensions: Array.from({ length: 50 }, (_, i) => `ext_${i}`),
              },
            },
          },
        },
        clientInfo: {
          name: 'apex-performance-test-client',
          version: '1.0.0',
        },
      };

      const startTime = performance.now();
      const result = MCPInitializeParamsSchema.parse(complexInitialization);
      const endTime = performance.now();

      expect(result.clientInfo.name).toBe('apex-performance-test-client');
      expect(endTime - startTime).toBeLessThan(15);
    });
  });

  describe('Stress Testing Edge Cases', () => {
    it('handles maximum reasonable content size', () => {
      const maxReasonableText = 'x'.repeat(10 * 1024 * 1024); // 10MB text

      const toolResult: MCPToolsCallResult = {
        content: [
          {
            type: 'text',
            text: maxReasonableText,
          },
        ],
        isError: false,
      };

      const startTime = performance.now();
      const result = MCPToolsCallResultSchema.parse(toolResult);
      const endTime = performance.now();

      expect(result.content[0].type).toBe('text');
      expect((result.content[0] as any).text).toHaveLength(10 * 1024 * 1024);

      // Should complete within reasonable time even for very large content
      expect(endTime - startTime).toBeLessThan(500); // 500ms threshold
    });

    it('handles maximum depth nesting', () => {
      const maxDepthObject = createDeepObject(500); // Very deep nesting

      const toolCall: MCPToolsCallParams = {
        name: 'max_depth_tool',
        arguments: maxDepthObject,
      };

      // This might be slow but shouldn't crash
      const startTime = performance.now();
      const result = MCPToolsCallParamsSchema.parse(toolCall);
      const endTime = performance.now();

      expect(result.name).toBe('max_depth_tool');
      // Allow more time for very deep objects
      expect(endTime - startTime).toBeLessThan(1000); // 1 second threshold
    });

    it('maintains accuracy under stress', () => {
      // Run many validations with different data to ensure accuracy is maintained
      const results: boolean[] = [];

      for (let i = 0; i < 1000; i++) {
        try {
          const toolCall: MCPToolsCallParams = {
            name: `stress_test_tool_${i}`,
            arguments: {
              iteration: i,
              random: Math.random(),
              timestamp: Date.now(),
              data: Array.from({ length: i % 10 }, (_, j) => `item_${j}`),
            },
          };

          const result = MCPToolsCallParamsSchema.parse(toolCall);
          results.push(result.name === `stress_test_tool_${i}`);
        } catch {
          results.push(false);
        }
      }

      // All validations should succeed
      expect(results.every(Boolean)).toBe(true);
    });
  });
});