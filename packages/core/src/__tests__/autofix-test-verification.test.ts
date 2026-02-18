import { describe, it, expect } from 'vitest';
import {
  AutoFixEventSchema,
  AutoFixEventTypeSchema,
  AutoFixStatusSchema,
  AutoFixIssueDetailSchema,
  AutoFixConfigSchema,
  AutoFixResultSchema,
  type AutoFixEvent,
  type AutoFixEventType,
  type AutoFixStatus,
  type AutoFixIssueDetail,
  type AutoFixConfig,
  type AutoFixResult
} from '../types.js';

describe('AutoFix Test Coverage Verification', () => {
  describe('Schema Export Verification', () => {
    it('verifies all AutoFix schemas are properly exported', () => {
      // Verify schemas are defined and callable
      expect(AutoFixEventSchema).toBeDefined();
      expect(typeof AutoFixEventSchema.parse).toBe('function');
      expect(typeof AutoFixEventSchema.safeParse).toBe('function');

      expect(AutoFixEventTypeSchema).toBeDefined();
      expect(typeof AutoFixEventTypeSchema.parse).toBe('function');

      expect(AutoFixStatusSchema).toBeDefined();
      expect(typeof AutoFixStatusSchema.parse).toBe('function');

      expect(AutoFixIssueDetailSchema).toBeDefined();
      expect(typeof AutoFixIssueDetailSchema.parse).toBe('function');

      expect(AutoFixConfigSchema).toBeDefined();
      expect(typeof AutoFixConfigSchema.parse).toBe('function');

      expect(AutoFixResultSchema).toBeDefined();
      expect(typeof AutoFixResultSchema.parse).toBe('function');
    });

    it('validates schema method availability', () => {
      const schemas = [
        AutoFixEventSchema,
        AutoFixEventTypeSchema,
        AutoFixStatusSchema,
        AutoFixIssueDetailSchema,
        AutoFixConfigSchema,
        AutoFixResultSchema
      ];

      schemas.forEach(schema => {
        expect(schema.parse).toBeInstanceOf(Function);
        expect(schema.safeParse).toBeInstanceOf(Function);
        expect(schema.parseAsync).toBeInstanceOf(Function);
        expect(schema.safeParseAsync).toBeInstanceOf(Function);
      });
    });
  });

  describe('Type Verification', () => {
    it('validates AutoFixEventType enum values', () => {
      const eventTypes: AutoFixEventType[] = [
        'auto-fix-start',
        'auto-fix-progress',
        'auto-fix-complete',
        'auto-fix-error'
      ];

      eventTypes.forEach(type => {
        expect(() => AutoFixEventTypeSchema.parse(type)).not.toThrow();
      });
    });

    it('validates AutoFixStatus enum values', () => {
      const statuses: AutoFixStatus[] = [
        'running',
        'success',
        'failed'
      ];

      statuses.forEach(status => {
        expect(() => AutoFixStatusSchema.parse(status)).not.toThrow();
      });
    });

    it('validates complete AutoFixEvent object structure', () => {
      const validEvent: AutoFixEvent = {
        id: 'test-event-123',
        eventType: 'auto-fix-start',
        taskId: 'test-task-456',
        filesModified: ['/test/file.ts'],
        issuesFixed: [{
          type: 'syntax-error',
          description: 'Missing semicolon',
          filePath: '/test/file.ts',
          line: 10,
          column: 25,
          severity: 'error'
        }],
        iterationCount: 1,
        totalIterations: 3,
        currentFile: '/test/file.ts',
        status: 'running',
        timestamp: new Date(),
        error: 'Test error message',
        metadata: {
          testKey: 'testValue',
          nested: {
            value: 42,
            array: [1, 2, 3]
          }
        }
      };

      expect(() => AutoFixEventSchema.parse(validEvent)).not.toThrow();

      // Verify parsed object matches input
      const parsed = AutoFixEventSchema.parse(validEvent);
      expect(parsed.id).toBe(validEvent.id);
      expect(parsed.eventType).toBe(validEvent.eventType);
      expect(parsed.taskId).toBe(validEvent.taskId);
      expect(parsed.filesModified).toEqual(validEvent.filesModified);
      expect(parsed.issuesFixed).toEqual(validEvent.issuesFixed);
      expect(parsed.iterationCount).toBe(validEvent.iterationCount);
      expect(parsed.totalIterations).toBe(validEvent.totalIterations);
      expect(parsed.currentFile).toBe(validEvent.currentFile);
      expect(parsed.status).toBe(validEvent.status);
      expect(parsed.timestamp).toEqual(validEvent.timestamp);
      expect(parsed.error).toBe(validEvent.error);
      expect(parsed.metadata).toEqual(validEvent.metadata);
    });
  });

  describe('Validation Error Scenarios', () => {
    it('throws validation errors for invalid event types', () => {
      expect(() => AutoFixEventTypeSchema.parse('invalid-type')).toThrow();
      expect(() => AutoFixEventTypeSchema.parse('')).toThrow();
      expect(() => AutoFixEventTypeSchema.parse(null)).toThrow();
      expect(() => AutoFixEventTypeSchema.parse(undefined)).toThrow();
    });

    it('throws validation errors for invalid status types', () => {
      expect(() => AutoFixStatusSchema.parse('invalid-status')).toThrow();
      expect(() => AutoFixStatusSchema.parse('pending')).toThrow();
      expect(() => AutoFixStatusSchema.parse('complete')).toThrow();
    });

    it('throws validation errors for invalid AutoFixEvent objects', () => {
      // Missing required fields
      expect(() => AutoFixEventSchema.parse({})).toThrow();

      // Invalid types
      expect(() => AutoFixEventSchema.parse({
        id: '', // Empty string should fail
        eventType: 'auto-fix-start',
        taskId: 'task',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 0,
        totalIterations: 1,
        currentFile: '/test',
        status: 'running',
        timestamp: new Date()
      })).toThrow();

      // Negative iteration count
      expect(() => AutoFixEventSchema.parse({
        id: 'test',
        eventType: 'auto-fix-start',
        taskId: 'task',
        filesModified: [],
        issuesFixed: [],
        iterationCount: -1, // Should be >= 0
        totalIterations: 1,
        currentFile: '/test',
        status: 'running',
        timestamp: new Date()
      })).toThrow();

      // Zero total iterations
      expect(() => AutoFixEventSchema.parse({
        id: 'test',
        eventType: 'auto-fix-start',
        taskId: 'task',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 0,
        totalIterations: 0, // Should be >= 1
        currentFile: '/test',
        status: 'running',
        timestamp: new Date()
      })).toThrow();
    });
  });

  describe('Acceptance Criteria Verification', () => {
    it('validates all required AutoFixEvent schema fields exist', () => {
      const requiredFields = [
        'eventType',
        'filesModified',
        'issuesFixed',
        'iterationCount',
        'totalIterations',
        'currentFile',
        'status'
      ];

      // Create a minimal valid event
      const minimalEvent = {
        id: 'test',
        eventType: 'auto-fix-start',
        taskId: 'task',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 0,
        totalIterations: 1,
        currentFile: '/test',
        status: 'running',
        timestamp: new Date()
      };

      // Verify parsing succeeds with all fields
      expect(() => AutoFixEventSchema.parse(minimalEvent)).not.toThrow();

      // Verify each required field causes validation to fail when missing
      requiredFields.forEach(field => {
        const incompleteEvent = { ...minimalEvent };
        delete (incompleteEvent as any)[field];
        expect(() => AutoFixEventSchema.parse(incompleteEvent)).toThrow();
      });
    });

    it('validates event type enum matches acceptance criteria', () => {
      const expectedEventTypes = [
        'auto-fix-start',
        'auto-fix-progress',
        'auto-fix-complete',
        'auto-fix-error'
      ];

      expectedEventTypes.forEach(eventType => {
        expect(() => AutoFixEventTypeSchema.parse(eventType)).not.toThrow();
      });

      // Verify exact match - no other types should be valid
      const invalidTypes = [
        'auto-fix-begin',
        'auto-fix-end',
        'auto-fix-running',
        'auto-fix-failed'
      ];

      invalidTypes.forEach(eventType => {
        expect(() => AutoFixEventTypeSchema.parse(eventType)).toThrow();
      });
    });

    it('validates status enum matches acceptance criteria', () => {
      const expectedStatuses = ['running', 'success', 'failed'];

      expectedStatuses.forEach(status => {
        expect(() => AutoFixStatusSchema.parse(status)).not.toThrow();
      });

      // Verify exact match - no other statuses should be valid
      const invalidStatuses = [
        'pending',
        'complete',
        'error',
        'finished'
      ];

      invalidStatuses.forEach(status => {
        expect(() => AutoFixStatusSchema.parse(status)).toThrow();
      });
    });

    it('validates issue detail schema with severity enum', () => {
      const issue: AutoFixIssueDetail = {
        type: 'syntax-error',
        description: 'Test issue',
        filePath: '/test.ts',
        line: 1,
        column: 1,
        severity: 'error'
      };

      expect(() => AutoFixIssueDetailSchema.parse(issue)).not.toThrow();

      // Verify all valid severity levels
      ['error', 'warning', 'info'].forEach(severity => {
        const testIssue = { ...issue, severity };
        expect(() => AutoFixIssueDetailSchema.parse(testIssue)).not.toThrow();
      });

      // Verify invalid severity levels are rejected
      ['critical', 'debug', 'trace'].forEach(severity => {
        const testIssue = { ...issue, severity };
        expect(() => AutoFixIssueDetailSchema.parse(testIssue)).toThrow();
      });
    });
  });

  describe('Performance and Memory Testing', () => {
    it('validates schema parsing performance', () => {
      const event: AutoFixEvent = {
        id: 'perf-test',
        eventType: 'auto-fix-complete',
        taskId: 'perf-task',
        filesModified: ['/test.ts'],
        issuesFixed: [],
        iterationCount: 1,
        totalIterations: 1,
        currentFile: '/test.ts',
        status: 'success',
        timestamp: new Date()
      };

      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        AutoFixEventSchema.parse(event);
      }

      const duration = performance.now() - start;
      const avgDuration = duration / iterations;

      expect(avgDuration).toBeLessThan(1); // Should average less than 1ms per parse
    });

    it('validates memory efficiency with large arrays', () => {
      const largeEvent: AutoFixEvent = {
        id: 'memory-test',
        eventType: 'auto-fix-complete',
        taskId: 'memory-task',
        filesModified: Array.from({ length: 1000 }, (_, i) => `/file${i}.ts`),
        issuesFixed: Array.from({ length: 500 }, (_, i) => ({
          type: 'syntax-error',
          description: `Issue ${i}`,
          filePath: `/file${i % 100}.ts`,
          line: i + 1,
          severity: i % 3 === 0 ? 'error' : i % 3 === 1 ? 'warning' : 'info'
        })),
        iterationCount: 10,
        totalIterations: 10,
        currentFile: '/test.ts',
        status: 'success',
        timestamp: new Date(),
        metadata: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [`key${i}`, `value${i}`])
        )
      };

      const start = performance.now();
      const parsed = AutoFixEventSchema.parse(largeEvent);
      const duration = performance.now() - start;

      expect(parsed.filesModified).toHaveLength(1000);
      expect(parsed.issuesFixed).toHaveLength(500);
      expect(duration).toBeLessThan(100); // Should parse within 100ms
    });
  });
});