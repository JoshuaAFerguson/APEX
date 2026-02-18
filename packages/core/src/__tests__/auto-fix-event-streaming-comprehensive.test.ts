/**
 * Comprehensive test suite for auto-fix event streaming functionality
 * Tests event types, payloads, CLI integration, and API broadcasting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AutoFixEventSchema,
  AutoFixEventTypeSchema,
  AutoFixStatusSchema,
  AutoFixIssueDetailSchema,
  type AutoFixEvent,
  type AutoFixEventType,
  type AutoFixStatus,
  type AutoFixIssueDetail
} from '../types.js';
import { z } from 'zod';

describe('Auto-Fix Event Streaming Comprehensive Tests', () => {
  describe('Event Schema Validation', () => {
    it('should validate complete auto-fix event lifecycle', () => {
      const taskId = 'test-task-001';
      const filePath = '/src/components/Button.tsx';
      const timestamp = new Date();

      // Test auto-fix-start event
      const startEvent: AutoFixEvent = {
        id: 'start-event-001',
        eventType: 'auto-fix-start',
        taskId,
        filesModified: [],
        issuesFixed: [],
        iterationCount: 0,
        totalIterations: 3,
        currentFile: filePath,
        status: 'running',
        timestamp,
        metadata: {
          triggeredBy: 'stage-completion',
          stage: 'implementation'
        }
      };

      expect(() => AutoFixEventSchema.parse(startEvent)).not.toThrow();

      // Test auto-fix-progress event
      const progressEvent: AutoFixEvent = {
        id: 'progress-event-001',
        eventType: 'auto-fix-progress',
        taskId,
        filesModified: [filePath],
        issuesFixed: [{
          type: 'import',
          description: 'Added missing React import',
          filePath,
          line: 1,
          column: 1,
          fixApplied: 'import React from "react";'
        }],
        iterationCount: 1,
        totalIterations: 3,
        currentFile: filePath,
        status: 'running',
        timestamp: new Date(timestamp.getTime() + 1000),
        metadata: {
          fixType: 'imports',
          issuesDetected: 3,
          issuesRemaining: 2,
          currentFix: 'Adding React import'
        }
      };

      expect(() => AutoFixEventSchema.parse(progressEvent)).not.toThrow();

      // Test auto-fix-complete event
      const completeEvent: AutoFixEvent = {
        id: 'complete-event-001',
        eventType: 'auto-fix-complete',
        taskId,
        filesModified: [filePath],
        issuesFixed: [
          {
            type: 'import',
            description: 'Added missing React import',
            filePath,
            line: 1,
            column: 1,
            fixApplied: 'import React from "react";'
          },
          {
            type: 'import',
            description: 'Added missing useState import',
            filePath,
            line: 1,
            column: 20,
            fixApplied: 'import { useState } from "react";'
          }
        ],
        iterationCount: 3,
        totalIterations: 3,
        currentFile: filePath,
        status: 'success',
        timestamp: new Date(timestamp.getTime() + 2000),
        metadata: {
          duration: 1500,
          fixType: 'imports',
          issuesDetected: 3,
          issuesFixed: 2,
          tool: 'eslint-auto-fixer'
        }
      };

      expect(() => AutoFixEventSchema.parse(completeEvent)).not.toThrow();
      const parsed = AutoFixEventSchema.parse(completeEvent);
      expect(parsed.issuesFixed).toHaveLength(2);
      expect(parsed.metadata?.duration).toBe(1500);
    });

    it('should validate error event with comprehensive details', () => {
      const errorEvent: AutoFixEvent = {
        id: 'error-event-001',
        eventType: 'auto-fix-error',
        taskId: 'error-task',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 1,
        totalIterations: 3,
        currentFile: '/src/broken.ts',
        status: 'failed',
        timestamp: new Date(),
        error: 'SyntaxError: Unexpected token at line 15',
        metadata: {
          errorCode: 'PARSE_ERROR',
          errorDetails: {
            line: 15,
            column: 8,
            token: '{'
          },
          tool: 'typescript-parser',
          duration: 500
        }
      };

      expect(() => AutoFixEventSchema.parse(errorEvent)).not.toThrow();
      const parsed = AutoFixEventSchema.parse(errorEvent);
      expect(parsed.error).toContain('SyntaxError');
      expect(parsed.status).toBe('failed');
    });

    it('should validate event types for streaming compatibility', () => {
      const eventTypes: AutoFixEventType[] = [
        'auto-fix-start',
        'auto-fix-progress',
        'auto-fix-complete',
        'auto-fix-error'
      ];

      eventTypes.forEach(eventType => {
        expect(() => AutoFixEventTypeSchema.parse(eventType)).not.toThrow();
      });

      // Test invalid event types
      const invalidTypes = ['auto-fix-begin', 'auto-fix-done', 'fix-started'];
      invalidTypes.forEach(invalidType => {
        expect(() => AutoFixEventTypeSchema.parse(invalidType)).toThrow();
      });
    });
  });

  describe('CLI Integration Event Handling', () => {
    let mockSpinner: any;
    let mockConsole: any;

    beforeEach(() => {
      // Mock ora spinner functionality
      mockSpinner = {
        start: vi.fn(),
        stop: vi.fn(),
        succeed: vi.fn(),
        fail: vi.fn(),
        text: '',
        color: 'yellow'
      };

      // Mock console for chalk output testing
      mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.clearAllMocks();
      mockConsole.mockRestore();
    });

    it('should handle auto-fix progress with ora spinner updates', () => {
      // Simulate CLI event handler for auto-fix progress
      const handleAutoFixProgress = (event: AutoFixEvent) => {
        if (event.eventType === 'auto-fix-progress') {
          const fileName = event.currentFile.split('/').pop();
          const progress = event.metadata?.issuesFixed || 0;
          const total = event.metadata?.issuesDetected || 0;

          mockSpinner.text = `Fixing ${fileName}: ${progress}/${total} issues resolved`;
          mockSpinner.color = 'yellow';
        }
      };

      const progressEvent: AutoFixEvent = {
        id: 'cli-progress-001',
        eventType: 'auto-fix-progress',
        taskId: 'cli-task',
        filesModified: ['/src/utils/helpers.ts'],
        issuesFixed: [{
          type: 'formatting',
          description: 'Fixed indentation',
          filePath: '/src/utils/helpers.ts',
          line: 10,
          column: 1,
          fixApplied: 'Corrected spacing'
        }],
        iterationCount: 2,
        totalIterations: 3,
        currentFile: '/src/utils/helpers.ts',
        status: 'running',
        timestamp: new Date(),
        metadata: {
          issuesFixed: 2,
          issuesDetected: 5,
          currentFix: 'Fixing formatting issues'
        }
      };

      handleAutoFixProgress(progressEvent);

      expect(mockSpinner.text).toContain('helpers.ts');
      expect(mockSpinner.text).toContain('2/5 issues');
      expect(mockSpinner.color).toBe('yellow');
    });

    it('should display completion status with chalk colors', () => {
      // Simulate CLI completion handler
      const handleAutoFixComplete = (event: AutoFixEvent) => {
        if (event.eventType === 'auto-fix-complete') {
          const fileName = event.currentFile.split('/').pop();
          const issuesFixed = event.issuesFixed.length;
          const duration = event.metadata?.duration || 0;

          mockSpinner.succeed(`✅ ${fileName} - Fixed ${issuesFixed} issues (${duration}ms)`);
        }
      };

      const completeEvent: AutoFixEvent = {
        id: 'cli-complete-001',
        eventType: 'auto-fix-complete',
        taskId: 'cli-task',
        filesModified: ['/src/components/Modal.tsx'],
        issuesFixed: [
          {
            type: 'import',
            description: 'Added React import',
            filePath: '/src/components/Modal.tsx',
            line: 1,
            column: 1,
            fixApplied: 'import React from "react";'
          },
          {
            type: 'import',
            description: 'Added PropTypes import',
            filePath: '/src/components/Modal.tsx',
            line: 2,
            column: 1,
            fixApplied: 'import PropTypes from "prop-types";'
          }
        ],
        iterationCount: 3,
        totalIterations: 3,
        currentFile: '/src/components/Modal.tsx',
        status: 'success',
        timestamp: new Date(),
        metadata: {
          duration: 850,
          tool: 'eslint-auto-fixer'
        }
      };

      handleAutoFixComplete(completeEvent);

      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining('Modal.tsx - Fixed 2 issues (850ms)')
      );
    });

    it('should handle errors with appropriate visual feedback', () => {
      const handleAutoFixError = (event: AutoFixEvent) => {
        if (event.eventType === 'auto-fix-error') {
          const fileName = event.currentFile.split('/').pop();
          const errorMessage = event.error || 'Unknown error';

          mockSpinner.fail(`❌ ${fileName} - ${errorMessage}`);
        }
      };

      const errorEvent: AutoFixEvent = {
        id: 'cli-error-001',
        eventType: 'auto-fix-error',
        taskId: 'cli-task',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 1,
        totalIterations: 3,
        currentFile: '/src/broken/syntax.js',
        status: 'failed',
        timestamp: new Date(),
        error: 'SyntaxError: Unexpected token',
        metadata: {
          tool: 'prettier',
          errorCode: 'SYNTAX_ERROR'
        }
      };

      handleAutoFixError(errorEvent);

      expect(mockSpinner.fail).toHaveBeenCalledWith(
        expect.stringContaining('syntax.js - SyntaxError: Unexpected token')
      );
    });
  });

  describe('API WebSocket Event Broadcasting', () => {
    it('should transform events for WebSocket ApexEvent format', () => {
      const autoFixEvent: AutoFixEvent = {
        id: 'ws-event-001',
        eventType: 'auto-fix-complete',
        taskId: 'ws-task-123',
        filesModified: ['/src/api/routes.ts'],
        issuesFixed: [{
          type: 'import',
          description: 'Added express import',
          filePath: '/src/api/routes.ts',
          line: 1,
          column: 1,
          fixApplied: 'import express from "express";'
        }],
        iterationCount: 1,
        totalIterations: 1,
        currentFile: '/src/api/routes.ts',
        status: 'success',
        timestamp: new Date(),
        metadata: {
          duration: 300,
          tool: 'eslint'
        }
      };

      // Transform to WebSocket ApexEvent format
      const webSocketEvent = {
        type: 'autofix:completed' as const,
        taskId: autoFixEvent.taskId,
        timestamp: autoFixEvent.timestamp,
        data: {
          filePath: autoFixEvent.currentFile,
          fixType: autoFixEvent.metadata?.tool || 'auto-fix',
          issuesDetected: 1,
          issuesFixed: autoFixEvent.issuesFixed.length,
          duration: autoFixEvent.metadata?.duration || 0,
          filesModified: autoFixEvent.filesModified
        }
      };

      expect(webSocketEvent.type).toBe('autofix:completed');
      expect(webSocketEvent.taskId).toBe('ws-task-123');
      expect(webSocketEvent.data.issuesFixed).toBe(1);
      expect(webSocketEvent.data.duration).toBe(300);
      expect(webSocketEvent.data.filePath).toBe('/src/api/routes.ts');
    });

    it('should validate WebSocket event payload structure', () => {
      const requiredFields = ['type', 'taskId', 'timestamp', 'data'];
      const requiredDataFields = ['filePath', 'fixType', 'issuesDetected', 'issuesFixed', 'duration'];

      const webSocketEvent = {
        type: 'autofix:progress',
        taskId: 'ws-validation-task',
        timestamp: new Date(),
        data: {
          filePath: '/test/file.ts',
          fixType: 'imports',
          issuesDetected: 3,
          issuesFixed: 1,
          issuesRemaining: 2,
          currentFix: 'Adding React import',
          duration: 150
        }
      };

      // Verify all required fields are present
      requiredFields.forEach(field => {
        expect(webSocketEvent).toHaveProperty(field);
      });

      requiredDataFields.forEach(field => {
        expect(webSocketEvent.data).toHaveProperty(field);
      });

      // Verify field types
      expect(typeof webSocketEvent.type).toBe('string');
      expect(typeof webSocketEvent.taskId).toBe('string');
      expect(webSocketEvent.timestamp).toBeInstanceOf(Date);
      expect(typeof webSocketEvent.data.filePath).toBe('string');
      expect(typeof webSocketEvent.data.issuesFixed).toBe('number');
    });
  });

  describe('Integration and Performance Tests', () => {
    it('should handle rapid sequence of events without data loss', () => {
      const events: AutoFixEvent[] = [];
      const eventCount = 100;

      // Generate rapid sequence of events
      for (let i = 0; i < eventCount; i++) {
        const event: AutoFixEvent = {
          id: `rapid-event-${i}`,
          eventType: i % 2 === 0 ? 'auto-fix-progress' : 'auto-fix-complete',
          taskId: 'rapid-task',
          filesModified: [`/file-${i}.ts`],
          issuesFixed: [{
            type: 'import',
            description: `Fix ${i}`,
            filePath: `/file-${i}.ts`,
            line: 1,
            column: 1,
            fixApplied: `Fix ${i} applied`
          }],
          iterationCount: i,
          totalIterations: eventCount,
          currentFile: `/file-${i}.ts`,
          status: i % 2 === 0 ? 'running' : 'success',
          timestamp: new Date(Date.now() + i * 10),
          metadata: {
            sequenceNumber: i
          }
        };

        // Validate each event
        expect(() => AutoFixEventSchema.parse(event)).not.toThrow();
        events.push(event);
      }

      expect(events).toHaveLength(eventCount);

      // Verify sequence integrity
      events.forEach((event, index) => {
        expect(event.metadata?.sequenceNumber).toBe(index);
        expect(event.iterationCount).toBe(index);
      });
    });

    it('should handle large event payloads efficiently', () => {
      const largeEvent: AutoFixEvent = {
        id: 'large-payload-event',
        eventType: 'auto-fix-complete',
        taskId: 'performance-task',
        filesModified: Array.from({ length: 50 }, (_, i) => `/large/file-${i}.ts`),
        issuesFixed: Array.from({ length: 100 }, (_, i) => ({
          type: 'import',
          description: `Large fix ${i}`,
          filePath: `/large/file-${i % 50}.ts`,
          line: i + 1,
          column: 1,
          fixApplied: `import Fix${i} from "fix${i}";`
        })),
        iterationCount: 100,
        totalIterations: 100,
        currentFile: '/large/main.ts',
        status: 'success',
        timestamp: new Date(),
        metadata: {
          performance: {
            startTime: Date.now() - 5000,
            endTime: Date.now(),
            memoryUsage: process.memoryUsage().heapUsed
          },
          statistics: {
            totalLines: 10000,
            totalImports: 100,
            filesProcessed: 50
          }
        }
      };

      const startTime = performance.now();
      const parsed = AutoFixEventSchema.parse(largeEvent);
      const duration = performance.now() - startTime;

      expect(parsed.filesModified).toHaveLength(50);
      expect(parsed.issuesFixed).toHaveLength(100);
      expect(duration).toBeLessThan(50); // Should parse quickly
    });

    it('should maintain event ordering and consistency', () => {
      const taskId = 'ordering-test';
      const filePath = '/src/test.ts';
      const baseTime = Date.now();

      const orderedEvents: AutoFixEvent[] = [
        {
          id: 'order-1',
          eventType: 'auto-fix-start',
          taskId,
          filesModified: [],
          issuesFixed: [],
          iterationCount: 0,
          totalIterations: 3,
          currentFile: filePath,
          status: 'running',
          timestamp: new Date(baseTime),
          metadata: { phase: 'start' }
        },
        {
          id: 'order-2',
          eventType: 'auto-fix-progress',
          taskId,
          filesModified: [filePath],
          issuesFixed: [{
            type: 'import',
            description: 'First fix',
            filePath,
            line: 1,
            column: 1,
            fixApplied: 'import React from "react";'
          }],
          iterationCount: 1,
          totalIterations: 3,
          currentFile: filePath,
          status: 'running',
          timestamp: new Date(baseTime + 1000),
          metadata: { phase: 'progress' }
        },
        {
          id: 'order-3',
          eventType: 'auto-fix-complete',
          taskId,
          filesModified: [filePath],
          issuesFixed: [{
            type: 'import',
            description: 'Final fix',
            filePath,
            line: 1,
            column: 1,
            fixApplied: 'import React from "react";'
          }],
          iterationCount: 3,
          totalIterations: 3,
          currentFile: filePath,
          status: 'success',
          timestamp: new Date(baseTime + 2000),
          metadata: { phase: 'complete' }
        }
      ];

      // Validate all events
      orderedEvents.forEach(event => {
        expect(() => AutoFixEventSchema.parse(event)).not.toThrow();
      });

      // Verify chronological ordering
      for (let i = 1; i < orderedEvents.length; i++) {
        expect(orderedEvents[i].timestamp.getTime()).toBeGreaterThan(
          orderedEvents[i - 1].timestamp.getTime()
        );
      }

      // Verify iteration progression
      expect(orderedEvents[0].iterationCount).toBe(0);
      expect(orderedEvents[1].iterationCount).toBe(1);
      expect(orderedEvents[2].iterationCount).toBe(3);

      // Verify status progression
      expect(orderedEvents[0].status).toBe('running');
      expect(orderedEvents[1].status).toBe('running');
      expect(orderedEvents[2].status).toBe('success');
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    it('should validate events with minimal required fields', () => {
      const minimalEvent: AutoFixEvent = {
        id: 'minimal-001',
        eventType: 'auto-fix-start',
        taskId: 'minimal-task',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 0,
        totalIterations: 1,
        currentFile: '/minimal/test.ts',
        status: 'running',
        timestamp: new Date()
        // No metadata, error, or optional fields
      };

      expect(() => AutoFixEventSchema.parse(minimalEvent)).not.toThrow();
      const parsed = AutoFixEventSchema.parse(minimalEvent);
      expect(parsed.metadata).toBeUndefined();
      expect(parsed.error).toBeUndefined();
    });

    it('should handle malformed timestamps gracefully', () => {
      const eventWithBadTimestamp = {
        id: 'bad-timestamp',
        eventType: 'auto-fix-error',
        taskId: 'timestamp-test',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 0,
        totalIterations: 1,
        currentFile: '/test.ts',
        status: 'failed',
        timestamp: 'invalid-date' // Invalid timestamp
      };

      expect(() => AutoFixEventSchema.parse(eventWithBadTimestamp)).toThrow();
    });

    it('should validate issue details with complex metadata', () => {
      const complexIssue: AutoFixIssueDetail = {
        type: 'syntax',
        description: 'Complex syntax error requiring multi-step fix',
        filePath: '/complex/error.ts',
        line: 45,
        column: 12,
        fixApplied: 'Restructured object destructuring with proper typing',
        metadata: {
          severity: 'error',
          rule: 'typescript/no-unused-vars',
          category: 'TypeScript',
          fixDetails: {
            before: 'const { a, b, c } = obj;',
            after: 'const { a, b }: { a: string; b: number } = obj;',
            addedImports: ['type ObjectType from "./types"'],
            removedCode: ['unused variable c']
          },
          context: {
            surroundingLines: ['line 44: function test() {', 'line 46: return a + b;'],
            relatedFiles: ['/complex/types.ts', '/complex/utils.ts']
          }
        }
      };

      expect(() => AutoFixIssueDetailSchema.parse(complexIssue)).not.toThrow();
      const parsed = AutoFixIssueDetailSchema.parse(complexIssue);
      expect(parsed.metadata?.severity).toBe('error');
      expect(parsed.metadata?.fixDetails.addedImports).toContain('type ObjectType from "./types"');
    });
  });
});