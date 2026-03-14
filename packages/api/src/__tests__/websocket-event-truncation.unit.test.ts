import { describe, it, expect } from 'vitest';
import { truncatePayload, generateTaskId } from '@apexcli/core';
import type { ToolCallCompleteEvent, TruncationMetadata } from '@apexcli/core';

/**
 * Unit tests for WebSocket event payload truncation.
 *
 * These tests verify that the truncation logic applied to agent:tool-use
 * and tool:complete events produces correct results and metadata.
 */
describe('WebSocket Event Payload Truncation', () => {
  describe('agent:tool-use event truncation', () => {
    it('should truncate large input arrays with correct metadata', () => {
      const taskId = generateTaskId();

      // Create large input data as would be passed to agent:tool-use handler
      const largeInputArray = new Array(5000).fill(0).map((_, i) => ({
        id: `item_${i}`,
        data: `Content for item ${i}`,
        metadata: {
          timestamp: new Date().toISOString(),
          processed: i % 2 === 0
        }
      }));

      const originalData = {
        tool: 'processLargeDataset',
        input: {
          items: largeInputArray,
          config: {
            batchSize: 100,
            parallel: true
          }
        }
      };

      // Apply truncation as done in the agent:tool-use handler
      const truncatedData = truncatePayload(originalData, {
        maxArrayItems: 1000,
        maxStringLength: 50 * 1024,
      });

      // Verify truncation occurred
      expect(truncatedData._truncation).toBeDefined();
      expect(truncatedData._truncation!.truncated).toBe(true);
      expect(truncatedData._truncation!.truncations).toHaveLength(1);

      // Verify array was truncated correctly
      expect(truncatedData.data.input.items).toHaveLength(1000);
      expect(truncatedData.data.input.items[0]).toEqual({
        id: 'item_0',
        data: 'Content for item 0',
        metadata: {
          timestamp: expect.any(String),
          processed: true
        }
      });

      // Verify metadata details
      const truncation = truncatedData._truncation!.truncations[0];
      expect(truncation.type).toBe('array');
      expect(truncation.path).toBe('input.items');
      expect(truncation.originalSize).toBe(5000);
      expect(truncation.truncatedSize).toBe(1000);

      // Verify other data is preserved
      expect(truncatedData.data.tool).toBe('processLargeDataset');
      expect(truncatedData.data.input.config).toEqual({
        batchSize: 100,
        parallel: true
      });
    });

    it('should truncate large input strings with correct metadata', () => {
      // Create large string input (100KB)
      const largeStringContent = 'X'.repeat(100 * 1024);

      const originalData = {
        tool: 'processTextData',
        input: {
          content: largeStringContent,
          format: 'text',
          options: {
            encoding: 'utf-8'
          }
        }
      };

      // Apply truncation as done in the agent:tool-use handler
      const truncatedData = truncatePayload(originalData, {
        maxArrayItems: 1000,
        maxStringLength: 50 * 1024,
      });

      // Verify string was truncated to 50KB limit
      expect(truncatedData.data.input.content).toHaveLength(50 * 1024 + '... [truncated]'.length);
      expect(truncatedData.data.input.content.endsWith('... [truncated]')).toBe(true);

      // Verify truncation metadata
      expect(truncatedData._truncation!.truncated).toBe(true);
      expect(truncatedData._truncation!.truncations[0].type).toBe('string');
      expect(truncatedData._truncation!.truncations[0].originalSize).toBe(100 * 1024);
      expect(truncatedData._truncation!.truncations[0].truncatedSize).toBe(50 * 1024);
      expect(truncatedData._truncation!.truncations[0].path).toBe('input.content');

      // Verify other fields preserved
      expect(truncatedData.data.input.format).toBe('text');
      expect(truncatedData.data.input.options.encoding).toBe('utf-8');
    });

    it('should preserve normal-sized agent:tool-use data without truncation metadata', () => {
      const normalInput = {
        tool: 'normalTool',
        input: {
          items: [1, 2, 3, 4, 5], // Small array
          description: 'A reasonable description', // Short string
          config: {
            maxRetries: 3,
            timeout: 5000
          }
        }
      };

      const result = truncatePayload(normalInput, {
        maxArrayItems: 1000,
        maxStringLength: 50 * 1024,
      });

      // Should not have truncation metadata
      expect(result._truncation).toBeUndefined();
      expect(result.data).toEqual(normalInput);
    });
  });

  describe('tool:complete event truncation', () => {
    it('should truncate large result arrays with correct metadata', () => {
      const taskId = generateTaskId();

      // Create large result with many items
      const largeResultArray = new Array(3000).fill(0).map((_, i) => ({
        id: `result_${i}`,
        value: `Result value ${i}`,
        score: Math.random(),
        metadata: {
          processedAt: new Date().toISOString(),
          source: `batch_${Math.floor(i / 100)}`
        }
      }));

      const originalData = {
        toolName: 'bulkDataProcessor',
        callId: 'call_bulk_123',
        result: {
          items: largeResultArray,
          summary: 'Processed bulk data successfully',
          statistics: {
            totalProcessed: largeResultArray.length,
            successCount: largeResultArray.length,
            errorCount: 0
          }
        },
        timing: {
          startTime: '2024-01-01T00:00:00.000Z',
          endTime: '2024-01-01T00:00:05.000Z',
          duration: 2500
        }
      };

      // Apply truncation as done in the tool:complete handler
      const truncatedData = truncatePayload(originalData, {
        maxArrayItems: 1000,
        maxStringLength: 50 * 1024,
      });

      // Verify array truncation
      expect(truncatedData.data.result.items).toHaveLength(1000);
      expect(truncatedData._truncation!.truncated).toBe(true);
      expect(truncatedData._truncation!.truncations[0].type).toBe('array');
      expect(truncatedData._truncation!.truncations[0].originalSize).toBe(3000);
      expect(truncatedData._truncation!.truncations[0].path).toBe('result.items');

      // Verify other data is preserved
      expect(truncatedData.data.result.summary).toBe('Processed bulk data successfully');
      expect(truncatedData.data.timing).toEqual(originalData.timing);
      expect(truncatedData.data.toolName).toBe('bulkDataProcessor');
      expect(truncatedData.data.callId).toBe('call_bulk_123');
    });

    it('should truncate large result strings with correct metadata', () => {
      const taskId = generateTaskId();

      // Simulate a tool that returns large log output
      const massiveLogOutput = 'LOG ERROR: Something went wrong\n'.repeat(10000); // ~300KB

      const originalData = {
        toolName: 'logAnalyzer',
        callId: 'call_log_456',
        result: {
          fullLog: massiveLogOutput,
          errorCount: 10000,
          analysis: 'Multiple recurring errors detected',
          recommendations: ['Check configuration', 'Restart service']
        },
        timing: {
          startTime: '2024-01-01T00:00:00.000Z',
          endTime: '2024-01-01T00:00:01.200Z',
          duration: 1200
        }
      };

      // Apply truncation as done in the tool:complete handler
      const truncatedData = truncatePayload(originalData, {
        maxArrayItems: 1000,
        maxStringLength: 50 * 1024,
      });

      // Verify string truncation
      expect(truncatedData.data.result.fullLog).toHaveLength(50 * 1024 + '... [truncated]'.length);
      expect(truncatedData.data.result.fullLog.endsWith('... [truncated]')).toBe(true);

      // Verify truncation metadata
      expect(truncatedData._truncation!.truncated).toBe(true);
      expect(truncatedData._truncation!.truncations[0].type).toBe('string');
      expect(truncatedData._truncation!.truncations[0].path).toBe('result.fullLog');

      // Other fields should be preserved
      expect(truncatedData.data.result.errorCount).toBe(10000);
      expect(truncatedData.data.result.analysis).toBe('Multiple recurring errors detected');
    });

    it('should handle mixed large content in tool:complete events', () => {
      // Mixed large content: both large array and large strings
      const mixedResult = {
        toolName: 'complexProcessor',
        callId: 'call_mixed_789',
        result: {
          dataItems: new Array(2000).fill('data'),
          logOutput: 'Y'.repeat(75000),
          errorMessages: new Array(1500).fill('error'),
          debugInfo: 'Z'.repeat(60000)
        },
        timing: {
          startTime: '2024-01-01T00:00:00.000Z',
          endTime: '2024-01-01T00:00:03.000Z',
          duration: 3000
        }
      };

      // Apply truncation as done in the tool:complete handler
      const truncatedData = truncatePayload(mixedResult, {
        maxArrayItems: 1000,
        maxStringLength: 50 * 1024,
      });

      // Should have multiple truncations
      expect(truncatedData._truncation!.truncated).toBe(true);
      expect(truncatedData._truncation!.truncations.length).toBe(4); // 2 arrays + 2 strings

      // Verify arrays were truncated
      expect(truncatedData.data.result.dataItems).toHaveLength(1000);
      expect(truncatedData.data.result.errorMessages).toHaveLength(1000);

      // Verify strings were truncated
      expect(truncatedData.data.result.logOutput).toHaveLength(50 * 1024 + '... [truncated]'.length);
      expect(truncatedData.data.result.debugInfo).toHaveLength(50 * 1024 + '... [truncated]'.length);

      // Check truncation types
      const truncations = truncatedData._truncation!.truncations;
      const arrayTruncations = truncations.filter(t => t.type === 'array');
      const stringTruncations = truncations.filter(t => t.type === 'string');

      expect(arrayTruncations).toHaveLength(2);
      expect(stringTruncations).toHaveLength(2);

      // Verify paths are correct
      const paths = truncations.map(t => t.path).sort();
      expect(paths).toEqual([
        'result.dataItems',
        'result.debugInfo',
        'result.errorMessages',
        'result.logOutput'
      ]);
    });

    it('should preserve normal-sized tool:complete data without truncation metadata', () => {
      const normalResult = {
        toolName: 'simpleProcessor',
        callId: 'call_simple_123',
        result: {
          status: 'success',
          message: 'Processing completed successfully',
          data: [1, 2, 3, 4, 5],
          metadata: {
            duration: 150,
            itemsProcessed: 5
          }
        },
        timing: {
          startTime: '2024-01-01T00:00:00.000Z',
          endTime: '2024-01-01T00:00:00.150Z',
          duration: 150
        }
      };

      const result = truncatePayload(normalResult, {
        maxArrayItems: 1000,
        maxStringLength: 50 * 1024,
      });

      // Should not have truncation metadata
      expect(result._truncation).toBeUndefined();
      expect(result.data).toEqual(normalResult);
    });
  });

  describe('WebSocket event serialization', () => {
    it('should create events that can be JSON serialized with truncation metadata', () => {
      const largeData = {
        toolName: 'testTool',
        result: {
          items: new Array(2000).fill('item'),
          log: 'X'.repeat(75000)
        }
      };

      const truncatedData = truncatePayload(largeData, {
        maxArrayItems: 1000,
        maxStringLength: 50 * 1024,
      });

      // Create a WebSocket event as would be done in the broadcast handler
      const event = {
        type: 'tool:complete' as const,
        taskId: generateTaskId(),
        timestamp: new Date(),
        data: truncatedData.data,
        _truncation: truncatedData._truncation,
      };

      // Should be serializable
      expect(() => JSON.stringify(event)).not.toThrow();

      const serialized = JSON.stringify(event);
      expect(serialized.length).toBeLessThan(200000); // Should be reasonable size

      // Should be parseable
      const parsed = JSON.parse(serialized);
      expect(parsed.type).toBe('tool:complete');
      expect(parsed._truncation.truncated).toBe(true);
      expect(parsed.data.result.items).toHaveLength(1000);
    });

    it('should handle circular references in original data', () => {
      const dataWithCircular: any = {
        tool: 'circularTool',
        input: {
          data: new Array(1500).fill('item'),
          circular: {}
        }
      };
      dataWithCircular.input.circular.self = dataWithCircular;

      const truncatedData = truncatePayload(dataWithCircular, {
        maxArrayItems: 1000,
        maxStringLength: 50 * 1024,
      });

      // Should handle circular references and still truncate
      expect(truncatedData.data.input.data).toHaveLength(1000);
      expect(truncatedData.data.input.circular.self).toBe('[Circular]');
      expect(truncatedData._truncation!.truncated).toBe(true);

      // Should be serializable
      expect(() => JSON.stringify(truncatedData)).not.toThrow();
    });
  });

  describe('performance with large payloads', () => {
    it('should handle truncation efficiently for very large data', () => {
      const startTime = Date.now();

      // Create extremely large payload
      const largePayload = {
        arrays: {
          items1: new Array(10000).fill('item'),
          items2: new Array(8000).fill('data'),
          items3: new Array(12000).fill('value')
        },
        strings: {
          log1: 'A'.repeat(500000), // 500KB
          log2: 'B'.repeat(300000), // 300KB
          log3: 'C'.repeat(400000)  // 400KB
        }
      };

      const truncated = truncatePayload(largePayload, {
        maxArrayItems: 1000,
        maxStringLength: 50 * 1024,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly (less than 100ms)
      expect(duration).toBeLessThan(100);

      // Should have truncated everything
      expect(truncated._truncation!.truncated).toBe(true);
      expect(truncated._truncation!.truncations).toHaveLength(6); // 3 arrays + 3 strings

      // Verify truncations
      expect(truncated.data.arrays.items1).toHaveLength(1000);
      expect(truncated.data.arrays.items2).toHaveLength(1000);
      expect(truncated.data.arrays.items3).toHaveLength(1000);

      expect(truncated.data.strings.log1).toHaveLength(50 * 1024 + '... [truncated]'.length);
      expect(truncated.data.strings.log2).toHaveLength(50 * 1024 + '... [truncated]'.length);
      expect(truncated.data.strings.log3).toHaveLength(50 * 1024 + '... [truncated]'.length);
    });
  });
});