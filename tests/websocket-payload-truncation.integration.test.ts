import { describe, it, expect } from 'vitest';
import { truncatePayload, generateTaskId } from '@apexcli/core';

/**
 * Integration tests for WebSocket payload truncation feature.
 *
 * These tests verify that large payloads are properly handled without
 * crashing the WebSocket connection or overwhelming clients.
 */

describe('WebSocket Payload Truncation Integration', () => {
  describe('Large Payload Handling', () => {
    it('should handle extremely large arrays without crashing', () => {
      // Create a massive array that would normally cause issues
      const largeArray = new Array(50000).fill(0).map((_, i) => ({
        id: i,
        data: `Item ${i}`,
        metadata: {
          timestamp: new Date().toISOString(),
          processed: i % 2 === 0,
          tags: [`tag${i}`, `category${i % 10}`]
        }
      }));

      const largePayload = {
        type: 'tool:complete',
        taskId: generateTaskId(),
        timestamp: new Date(),
        data: {
          toolName: 'massiveDataProcessor',
          callId: 'call_large_test',
          result: {
            items: largeArray,
            summary: 'Processed massive dataset',
            statistics: {
              totalItems: largeArray.length,
              processedItems: largeArray.filter(item => item.metadata.processed).length
            }
          }
        }
      };

      // Apply truncation to prevent crashes
      const truncated = truncatePayload(largePayload, {
        maxArrayItems: 1000,
        maxStringLength: 50 * 1024
      });

      // Verify truncation occurred
      expect(truncated._truncation?.truncated).toBe(true);
      expect(truncated.data.data.result.items).toHaveLength(1000);
      expect(truncated._truncation?.truncations[0].type).toBe('array');
      expect(truncated._truncation?.truncations[0].originalSize).toBe(50000);

      // Test that the truncated payload can be serialized without issues
      expect(() => {
        JSON.stringify(truncated);
      }).not.toThrow();

      // Test payload size is reasonable
      const serialized = JSON.stringify(truncated);
      expect(serialized.length).toBeLessThan(1000000); // Should be under 1MB
    });

    it('should handle extremely large strings without crashing', () => {
      // Create a massive string (simulate large log output)
      const largeLogOutput = 'ERROR: '.repeat(200000) + 'Stack trace: '.repeat(100000);

      const largeStringPayload = {
        type: 'tool:complete',
        taskId: generateTaskId(),
        timestamp: new Date(),
        data: {
          toolName: 'logAnalyzer',
          result: {
            fullLog: largeLogOutput,
            errorCount: 200000,
            analysis: 'X'.repeat(100000) // Another large string
          }
        }
      };

      // Apply truncation
      const truncated = truncatePayload(largeStringPayload, {
        maxArrayItems: 1000,
        maxStringLength: 50 * 1024
      });

      // Verify truncation occurred
      expect(truncated._truncation?.truncated).toBe(true);
      expect(truncated.data.data.result.fullLog).toHaveLength(50 * 1024 + '... [truncated]'.length);
      expect(truncated._truncation?.truncations.length).toBeGreaterThanOrEqual(2);

      // Test serialization doesn't crash
      expect(() => {
        JSON.stringify(truncated);
      }).not.toThrow();

      // Test payload size is reasonable
      const serialized = JSON.stringify(truncated);
      expect(serialized.length).toBeLessThan(500000); // Should be under 500KB
    });

    it('should handle moderate nested structures without crashing', () => {
      // Create moderately nested structure with large arrays and strings
      const nestedPayload = {
        type: 'agent:tool-use',
        taskId: generateTaskId(),
        data: {
          tool: 'complexDataProcessor',
          input: {
            config: {
              items: new Array(2000).fill('config-item'),
              description: 'Y'.repeat(10000)
            },
            options: {
              recursive: true,
              maxDepth: 10
            }
          }
        }
      };

      // Apply truncation
      const truncated = truncatePayload(nestedPayload, {
        maxArrayItems: 100,
        maxStringLength: 5000
      });

      // Verify it doesn't crash and creates reasonable output
      expect(truncated._truncation?.truncated).toBe(true);
      expect(() => {
        JSON.stringify(truncated);
      }).not.toThrow();

      const serialized = JSON.stringify(truncated);
      expect(serialized.length).toBeLessThan(50000);
    });
  });

  describe('Serialization and Parsing', () => {
    it('should successfully serialize and parse truncated large payloads', () => {
      // Create a large payload that would typically be sent over WebSocket
      const largePayload = {
        type: 'test',
        taskId: generateTaskId(),
        data: {
          largeArray: new Array(10000).fill('data'),
          largeString: 'LARGE_DATA_'.repeat(10000)
        }
      };

      // Truncate before sending
      const truncated = truncatePayload(largePayload, {
        maxArrayItems: 500,
        maxStringLength: 10000
      });

      // Verify it serializes without issues
      const serialized = JSON.stringify(truncated);
      expect(serialized.length).toBeLessThan(100000); // Should be much smaller

      // Verify it can be parsed back
      const parsed = JSON.parse(serialized);
      expect(parsed._truncation?.truncated).toBe(true);
      expect(parsed.data.data.largeArray).toHaveLength(500);
    });

    it('should handle multiple truncated payloads efficiently', () => {
      const payloads = [];

      // Create multiple large payloads
      for (let i = 0; i < 10; i++) {
        const largePayload = {
          type: 'burst-test',
          taskId: generateTaskId(),
          index: i,
          data: {
            items: new Array(2000).fill(`item-${i}`),
            content: `CONTENT_${i}_`.repeat(1000)
          }
        };

        const truncated = truncatePayload(largePayload, {
          maxArrayItems: 200,
          maxStringLength: 5000
        });

        payloads.push(truncated);
      }

      // Verify all payloads are truncated
      expect(payloads).toHaveLength(10);
      payloads.forEach((payload, index) => {
        expect(payload._truncation?.truncated).toBe(true);
        expect(payload.data.data.items).toHaveLength(200);

        const serialized = JSON.stringify(payload);
        expect(serialized.length).toBeLessThan(50000);
      });
    });
  });

  describe('Memory Efficiency', () => {
    it('should not cause memory leaks with repeated truncation operations', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many truncation operations
      for (let i = 0; i < 1000; i++) {
        const largePayload = {
          iteration: i,
          data: new Array(1000).fill(`data-${i}`),
          text: 'MEMORY_TEST_'.repeat(1000)
        };

        const truncated = truncatePayload(largePayload, {
          maxArrayItems: 100,
          maxStringLength: 1000
        });

        // Ensure truncation happened
        expect(truncated.data.data).toHaveLength(100);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB for 1000 operations)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Edge Cases', () => {
    it('should handle payloads with mixed large content types', () => {
      const mixedPayload = {
        arrays: {
          numbers: new Array(5000).fill(0).map((_, i) => i),
          objects: new Array(3000).fill(0).map((_, i) => ({ id: i, value: `item-${i}` })),
          nested: [
            new Array(2000).fill('nested-item'),
            new Array(1500).fill({ nested: true })
          ]
        },
        strings: {
          large1: 'A'.repeat(75000),
          large2: 'B'.repeat(60000),
          medium: 'C'.repeat(30000)
        },
        mixed: {
          array: new Array(4000).fill('mixed'),
          string: 'D'.repeat(80000)
        }
      };

      const truncated = truncatePayload(mixedPayload, {
        maxArrayItems: 1000,
        maxStringLength: 25000
      });

      expect(truncated._truncation?.truncated).toBe(true);
      expect(truncated._truncation?.truncations.length).toBeGreaterThan(5);

      // Verify serialization works
      expect(() => JSON.stringify(truncated)).not.toThrow();
    });

    it('should preserve important metadata during truncation', () => {
      const payloadWithMetadata = {
        type: 'tool:complete',
        taskId: 'important-task',
        timestamp: new Date(),
        criticalData: {
          status: 'success',
          errorCount: 0,
          warnings: []
        },
        largeData: {
          items: new Array(5000).fill('item'),
          logs: 'LOG_ENTRY_'.repeat(20000)
        }
      };

      const truncated = truncatePayload(payloadWithMetadata, {
        maxArrayItems: 500,
        maxStringLength: 10000
      });

      // Critical data should be preserved
      expect(truncated.data.type).toBe('tool:complete');
      expect(truncated.data.taskId).toBe('important-task');
      expect(truncated.data.criticalData.status).toBe('success');

      // Large data should be truncated but accessible
      expect(truncated.data.largeData.items).toHaveLength(500);
      expect(truncated._truncation?.truncated).toBe(true);
    });
  });
});