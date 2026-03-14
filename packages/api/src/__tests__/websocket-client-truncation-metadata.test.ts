import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { generateTaskId } from '@apexcli/core';
import type { ApexEvent, TruncationMetadata } from '@apexcli/core';

/**
 * Tests for WebSocket client handling of truncation metadata.
 *
 * These tests simulate a WebSocket client receiving events with truncation
 * metadata and verify that the client can properly parse and handle
 * the truncated data and associated metadata.
 */
describe('WebSocket Client Truncation Metadata Handling', () => {
  let mockClient: any;
  let receivedEvents: ApexEvent[] = [];

  beforeEach(() => {
    receivedEvents = [];

    // Simulate a WebSocket client that receives and processes events
    mockClient = {
      onMessage: (messageHandler: (event: ApexEvent) => void) => {
        mockClient.messageHandler = messageHandler;
      },

      simulateReceive: (event: ApexEvent) => {
        const serialized = JSON.stringify(event);
        const parsed = JSON.parse(serialized);
        if (mockClient.messageHandler) {
          mockClient.messageHandler(parsed);
        }
      }
    };

    // Set up client message handler
    mockClient.onMessage((event: ApexEvent) => {
      receivedEvents.push(event);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('truncation metadata parsing', () => {
    it('should properly parse events with truncation metadata', () => {
      const taskId = generateTaskId();

      const truncatedEvent: ApexEvent & { _truncation?: TruncationMetadata } = {
        type: 'tool:complete',
        taskId,
        timestamp: new Date(),
        data: {
          toolName: 'dataProcessor',
          callId: 'call_123',
          result: {
            items: new Array(1000).fill('truncated-item'), // Truncated array
            summary: 'A'.repeat(50 * 1024) + '... [truncated]' // Truncated string
          },
          timing: {
            startTime: new Date(),
            endTime: new Date(),
            duration: 1500
          }
        },
        _truncation: {
          truncated: true,
          truncations: [
            {
              type: 'array',
              path: 'result.items',
              originalSize: 5000,
              truncatedSize: 1000
            },
            {
              type: 'string',
              path: 'result.summary',
              originalSize: 100000,
              truncatedSize: 50 * 1024
            }
          ]
        }
      };

      // Simulate receiving the event
      mockClient.simulateReceive(truncatedEvent);

      // Verify event was received and parsed correctly
      expect(receivedEvents).toHaveLength(1);
      const receivedEvent = receivedEvents[0] as any;

      // Verify basic event data
      expect(receivedEvent.type).toBe('tool:complete');
      expect(receivedEvent.taskId).toBe(taskId);
      expect(receivedEvent.data.toolName).toBe('dataProcessor');

      // Verify truncation metadata is present
      expect(receivedEvent._truncation).toBeDefined();
      expect(receivedEvent._truncation.truncated).toBe(true);
      expect(receivedEvent._truncation.truncations).toHaveLength(2);

      // Verify truncation details
      const arrayTruncation = receivedEvent._truncation.truncations[0];
      expect(arrayTruncation.type).toBe('array');
      expect(arrayTruncation.path).toBe('result.items');
      expect(arrayTruncation.originalSize).toBe(5000);
      expect(arrayTruncation.truncatedSize).toBe(1000);

      const stringTruncation = receivedEvent._truncation.truncations[1];
      expect(stringTruncation.type).toBe('string');
      expect(stringTruncation.path).toBe('result.summary');
      expect(stringTruncation.originalSize).toBe(100000);
      expect(stringTruncation.truncatedSize).toBe(50 * 1024);
    });

    it('should handle events without truncation metadata', () => {
      const taskId = generateTaskId();

      const normalEvent: ApexEvent = {
        type: 'agent:tool-use',
        taskId,
        timestamp: new Date(),
        data: {
          tool: 'simpleTool',
          input: {
            value: 'normal value',
            count: 5
          }
        }
      };

      mockClient.simulateReceive(normalEvent);

      expect(receivedEvents).toHaveLength(1);
      const receivedEvent = receivedEvents[0] as any;

      // Should not have truncation metadata
      expect(receivedEvent._truncation).toBeUndefined();
      expect(receivedEvent.data).toEqual(normalEvent.data);
    });
  });

  describe('client-side truncation detection', () => {
    it('should allow clients to detect if data was truncated', () => {
      const taskId = generateTaskId();

      const eventWithTruncation: ApexEvent & { _truncation?: TruncationMetadata } = {
        type: 'tool:complete',
        taskId,
        timestamp: new Date(),
        data: {
          toolName: 'analyzer',
          result: {
            analysis: 'Large analysis result'.repeat(1000) + '... [truncated]',
            confidence: 0.95
          }
        },
        _truncation: {
          truncated: true,
          truncations: [{
            type: 'string',
            path: 'result.analysis',
            originalSize: 75000,
            truncatedSize: 50000
          }]
        }
      };

      // Client utility function to check for truncation
      function isEventTruncated(event: any): boolean {
        return event._truncation?.truncated === true;
      }

      function getTruncationInfo(event: any): TruncationMetadata | null {
        return event._truncation || null;
      }

      mockClient.simulateReceive(eventWithTruncation);
      const receivedEvent = receivedEvents[0] as any;

      // Client should be able to detect truncation
      expect(isEventTruncated(receivedEvent)).toBe(true);

      const truncationInfo = getTruncationInfo(receivedEvent);
      expect(truncationInfo).not.toBeNull();
      expect(truncationInfo!.truncations).toHaveLength(1);
      expect(truncationInfo!.truncations[0].originalSize).toBe(75000);
    });

    it('should provide useful truncation statistics for client monitoring', () => {
      const taskId = generateTaskId();

      const complexTruncatedEvent: ApexEvent & { _truncation?: TruncationMetadata } = {
        type: 'tool:complete',
        taskId,
        timestamp: new Date(),
        data: {
          toolName: 'bulkProcessor',
          result: {
            processedItems: new Array(1000).fill('item'), // Truncated from 10,000
            logs: 'LOG: '.repeat(12500) + '... [truncated]', // Truncated from 200KB
            errors: new Array(500).fill('error'), // Truncated from 2,000
            summary: 'Processing completed with truncation'
          }
        },
        _truncation: {
          truncated: true,
          truncations: [
            {
              type: 'array',
              path: 'result.processedItems',
              originalSize: 10000,
              truncatedSize: 1000
            },
            {
              type: 'string',
              path: 'result.logs',
              originalSize: 200000,
              truncatedSize: 50000
            },
            {
              type: 'array',
              path: 'result.errors',
              originalSize: 2000,
              truncatedSize: 500
            }
          ]
        }
      };

      // Client utility to analyze truncation impact
      function analyzeTruncationImpact(event: any): {
        totalTruncations: number;
        arraysTruncated: number;
        stringsTruncated: number;
        totalDataReduction: number;
      } {
        if (!event._truncation?.truncated) {
          return {
            totalTruncations: 0,
            arraysTruncated: 0,
            stringsTruncated: 0,
            totalDataReduction: 0
          };
        }

        const truncations = event._truncation.truncations;
        const arraysTruncated = truncations.filter((t: any) => t.type === 'array').length;
        const stringsTruncated = truncations.filter((t: any) => t.type === 'string').length;

        const totalDataReduction = truncations.reduce((acc: number, t: any) => {
          return acc + (t.originalSize - t.truncatedSize);
        }, 0);

        return {
          totalTruncations: truncations.length,
          arraysTruncated,
          stringsTruncated,
          totalDataReduction
        };
      }

      mockClient.simulateReceive(complexTruncatedEvent);
      const receivedEvent = receivedEvents[0] as any;

      const impact = analyzeTruncationImpact(receivedEvent);

      expect(impact.totalTruncations).toBe(3);
      expect(impact.arraysTruncated).toBe(2);
      expect(impact.stringsTruncated).toBe(1);
      expect(impact.totalDataReduction).toBe(
        (10000 - 1000) + (200000 - 50000) + (2000 - 500)
      ); // 160,500 items/characters saved
    });
  });

  describe('client warning and notification handling', () => {
    it('should allow clients to warn users about truncated data', () => {
      const warnings: string[] = [];

      // Client utility to generate user warnings
      function generateTruncationWarnings(event: any): string[] {
        const eventWarnings: string[] = [];

        if (!event._truncation?.truncated) {
          return eventWarnings;
        }

        const truncations = event._truncation.truncations;

        truncations.forEach((truncation: any) => {
          const percentageKept = (truncation.truncatedSize / truncation.originalSize) * 100;

          if (truncation.type === 'array') {
            eventWarnings.push(
              `Array at ${truncation.path} was truncated: showing ${truncation.truncatedSize} of ${truncation.originalSize} items (${percentageKept.toFixed(1)}%)`
            );
          } else if (truncation.type === 'string') {
            const originalKB = (truncation.originalSize / 1024).toFixed(1);
            const truncatedKB = (truncation.truncatedSize / 1024).toFixed(1);
            eventWarnings.push(
              `Text at ${truncation.path} was truncated: showing ${truncatedKB}KB of ${originalKB}KB (${percentageKept.toFixed(1)}%)`
            );
          }
        });

        return eventWarnings;
      }

      const truncatedEvent: ApexEvent & { _truncation?: TruncationMetadata } = {
        type: 'tool:complete',
        taskId: generateTaskId(),
        timestamp: new Date(),
        data: {
          toolName: 'reporter',
          result: {
            items: new Array(500).fill('item'), // Truncated from 5000
            report: 'X'.repeat(25600) + '... [truncated]' // Truncated from 100KB
          }
        },
        _truncation: {
          truncated: true,
          truncations: [
            {
              type: 'array',
              path: 'result.items',
              originalSize: 5000,
              truncatedSize: 500
            },
            {
              type: 'string',
              path: 'result.report',
              originalSize: 102400, // 100KB
              truncatedSize: 25600   // 25KB
            }
          ]
        }
      };

      mockClient.onMessage((event: any) => {
        receivedEvents.push(event);
        const eventWarnings = generateTruncationWarnings(event);
        warnings.push(...eventWarnings);
      });

      mockClient.simulateReceive(truncatedEvent);

      expect(warnings).toHaveLength(2);
      expect(warnings[0]).toContain('Array at result.items was truncated: showing 500 of 5000 items (10.0%)');
      expect(warnings[1]).toContain('Text at result.report was truncated: showing 25.0KB of 100.0KB (25.0%)');
    });

    it('should handle edge cases in truncation metadata', () => {
      const edgeCases = [
        // Empty truncations array
        {
          event: {
            type: 'tool:complete' as const,
            taskId: generateTaskId(),
            timestamp: new Date(),
            data: { result: 'normal' },
            _truncation: {
              truncated: false,
              truncations: []
            }
          },
          expectedWarnings: 0
        },
        // Null/undefined values in truncation data
        {
          event: {
            type: 'agent:tool-use' as const,
            taskId: generateTaskId(),
            timestamp: new Date(),
            data: { tool: 'test' },
            _truncation: undefined
          },
          expectedWarnings: 0
        },
        // Very large truncation (99% reduction)
        {
          event: {
            type: 'tool:complete' as const,
            taskId: generateTaskId(),
            timestamp: new Date(),
            data: { result: { data: 'X'.repeat(1000) + '... [truncated]' } },
            _truncation: {
              truncated: true,
              truncations: [{
                type: 'string' as const,
                path: 'result.data',
                originalSize: 100000,
                truncatedSize: 1000
              }]
            }
          },
          expectedWarnings: 1
        }
      ];

      const allWarnings: string[] = [];

      function generateSafeWarnings(event: any): string[] {
        try {
          if (!event._truncation?.truncated || !Array.isArray(event._truncation.truncations)) {
            return [];
          }

          return event._truncation.truncations
            .filter((t: any) => t && typeof t === 'object' && t.type && t.path)
            .map((t: any) => {
              const percentage = t.originalSize > 0 ?
                (t.truncatedSize / t.originalSize) * 100 : 0;
              return `${t.type} at ${t.path}: ${percentage.toFixed(1)}% kept`;
            });
        } catch (error) {
          return ['Error parsing truncation metadata'];
        }
      }

      edgeCases.forEach(({ event, expectedWarnings }) => {
        const warnings = generateSafeWarnings(event);
        expect(warnings).toHaveLength(expectedWarnings);
        allWarnings.push(...warnings);
      });

      // Should handle edge cases gracefully
      expect(allWarnings).toHaveLength(1);
      expect(allWarnings[0]).toContain('string at result.data: 1.0% kept');
    });
  });

  describe('integration with real WebSocket message flow', () => {
    it('should handle serialization round-trip with truncation metadata', () => {
      const originalEvent = {
        type: 'tool:complete',
        taskId: generateTaskId(),
        timestamp: new Date(),
        data: {
          toolName: 'testTool',
          result: {
            items: new Array(1000).fill({ id: 1, value: 'test' }),
            log: 'A'.repeat(51200) + '... [truncated]'
          }
        },
        _truncation: {
          truncated: true,
          truncations: [
            {
              type: 'array',
              path: 'result.items',
              originalSize: 5000,
              truncatedSize: 1000
            },
            {
              type: 'string',
              path: 'result.log',
              originalSize: 200000,
              truncatedSize: 51200
            }
          ]
        }
      };

      // Simulate WebSocket serialization/deserialization
      const serialized = JSON.stringify(originalEvent);
      expect(() => JSON.parse(serialized)).not.toThrow();

      const deserialized = JSON.parse(serialized);

      // Verify data integrity after round-trip
      expect(deserialized.type).toBe(originalEvent.type);
      expect(deserialized._truncation.truncated).toBe(true);
      expect(deserialized._truncation.truncations).toHaveLength(2);
      expect(deserialized.data.result.items).toHaveLength(1000);
      expect(deserialized.data.result.log.endsWith('... [truncated]')).toBe(true);

      // Verify dates are properly serialized
      expect(typeof deserialized.timestamp).toBe('string');
      expect(new Date(deserialized.timestamp)).toEqual(originalEvent.timestamp);
    });

    it('should maintain compatibility with clients not expecting truncation metadata', () => {
      const eventWithTruncation = {
        type: 'tool:complete',
        taskId: generateTaskId(),
        timestamp: new Date(),
        data: {
          toolName: 'processor',
          result: { value: 'result' }
        },
        _truncation: {
          truncated: true,
          truncations: []
        }
      };

      // Legacy client that doesn't know about _truncation
      function processEventLegacy(event: any) {
        // Should be able to access standard fields without issues
        return {
          type: event.type,
          taskId: event.taskId,
          toolName: event.data?.toolName,
          result: event.data?.result
        };
      }

      const serialized = JSON.stringify(eventWithTruncation);
      const parsed = JSON.parse(serialized);

      const processed = processEventLegacy(parsed);

      // Legacy client should work fine, ignoring _truncation field
      expect(processed.type).toBe('tool:complete');
      expect(processed.toolName).toBe('processor');
      expect(processed.result).toEqual({ value: 'result' });

      // _truncation field should still be there for modern clients
      expect(parsed._truncation).toBeDefined();
    });
  });
});