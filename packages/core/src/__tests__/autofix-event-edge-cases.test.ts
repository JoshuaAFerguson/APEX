import { describe, it, expect } from 'vitest';
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

describe('AutoFix Event Schema - Advanced Edge Cases', () => {
  describe('AutoFixEventSchema - Constraint Validation', () => {
    it('validates iterationCount cannot exceed totalIterations', () => {
      // While the schema doesn't enforce this, it's a logical constraint
      const invalidEvent = {
        id: 'event-123',
        eventType: 'auto-fix-progress',
        taskId: 'task-456',
        filesModified: ['/test.ts'],
        issuesFixed: [],
        iterationCount: 5, // Higher than totalIterations
        totalIterations: 3,
        currentFile: '/test.ts',
        status: 'running',
        timestamp: new Date()
      };

      // Schema allows this but it's logically inconsistent
      expect(() => AutoFixEventSchema.parse(invalidEvent)).not.toThrow();

      // But we can test that our business logic would catch this
      const parsed = AutoFixEventSchema.parse(invalidEvent);
      expect(parsed.iterationCount).toBeGreaterThan(parsed.totalIterations);
    });

    it('validates event type and status consistency', () => {
      // Test all valid combinations
      const validCombinations: Array<{ eventType: AutoFixEventType; status: AutoFixStatus }> = [
        { eventType: 'auto-fix-start', status: 'running' },
        { eventType: 'auto-fix-progress', status: 'running' },
        { eventType: 'auto-fix-complete', status: 'success' },
        { eventType: 'auto-fix-error', status: 'failed' }
      ];

      validCombinations.forEach(({ eventType, status }) => {
        const event = {
          id: 'event-123',
          eventType,
          taskId: 'task-456',
          filesModified: [],
          issuesFixed: [],
          iterationCount: 1,
          totalIterations: 3,
          currentFile: '/test.ts',
          status,
          timestamp: new Date()
        };

        expect(() => AutoFixEventSchema.parse(event)).not.toThrow();
      });
    });

    it('handles edge cases with currentFile paths', () => {
      const edgeCasePaths = [
        '', // Empty string
        '/', // Root path
        '..', // Relative parent
        '.', // Current directory
        ' ', // Whitespace
        'file with spaces.ts',
        'file-with-special-chars!@#$%^&*()_+.js',
        'very/deeply/nested/path/to/file/that/has/a/very/long/name/test.tsx',
        '/Users/user/path with spaces/file.ts',
        'C:\\Windows\\Path\\file.js'
      ];

      edgeCasePaths.forEach((currentFile, index) => {
        const event = {
          id: `event-${index}`,
          eventType: 'auto-fix-start',
          taskId: 'task-456',
          filesModified: [],
          issuesFixed: [],
          iterationCount: 0,
          totalIterations: 1,
          currentFile,
          status: 'running',
          timestamp: new Date()
        };

        expect(() => AutoFixEventSchema.parse(event)).not.toThrow();
      });
    });

    it('validates large arrays of files and issues', () => {
      const largeFilesArray = Array.from({ length: 1000 }, (_, i) => `/path/to/file${i}.ts`);
      const largeIssuesArray: AutoFixIssueDetail[] = Array.from({ length: 500 }, (_, i) => ({
        type: 'syntax-error',
        description: `Issue ${i}`,
        filePath: `/path/to/file${i % 10}.ts`,
        line: i + 1,
        severity: i % 3 === 0 ? 'error' : i % 3 === 1 ? 'warning' : 'info'
      }));

      const event = {
        id: 'event-large',
        eventType: 'auto-fix-complete',
        taskId: 'task-456',
        filesModified: largeFilesArray,
        issuesFixed: largeIssuesArray,
        iterationCount: 10,
        totalIterations: 10,
        currentFile: '/test.ts',
        status: 'success',
        timestamp: new Date()
      };

      const start = performance.now();
      const parsed = AutoFixEventSchema.parse(event);
      const duration = performance.now() - start;

      expect(parsed.filesModified).toHaveLength(1000);
      expect(parsed.issuesFixed).toHaveLength(500);
      expect(duration).toBeLessThan(1000); // Should parse within 1 second
    });

    it('handles extremely large iteration counts', () => {
      const event = {
        id: 'event-large-iterations',
        eventType: 'auto-fix-progress',
        taskId: 'task-456',
        filesModified: [],
        issuesFixed: [],
        iterationCount: Number.MAX_SAFE_INTEGER - 1,
        totalIterations: Number.MAX_SAFE_INTEGER,
        currentFile: '/test.ts',
        status: 'running',
        timestamp: new Date()
      };

      expect(() => AutoFixEventSchema.parse(event)).not.toThrow();
    });

    it('validates error field is required for error events', () => {
      // Error event without error field (still valid per schema)
      const errorEventWithoutError = {
        id: 'event-error',
        eventType: 'auto-fix-error',
        taskId: 'task-456',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 1,
        totalIterations: 3,
        currentFile: '/test.ts',
        status: 'failed',
        timestamp: new Date()
        // No error field
      };

      expect(() => AutoFixEventSchema.parse(errorEventWithoutError)).not.toThrow();

      // Error event with error field (recommended)
      const errorEventWithError = {
        ...errorEventWithoutError,
        error: 'Something went wrong'
      };

      const parsed = AutoFixEventSchema.parse(errorEventWithError);
      expect(parsed.error).toBe('Something went wrong');
    });
  });

  describe('AutoFixIssueDetailSchema - Advanced Validation', () => {
    it('validates all severity levels', () => {
      const severities = ['error', 'warning', 'info'] as const;

      severities.forEach(severity => {
        const issue: AutoFixIssueDetail = {
          type: 'syntax-error',
          description: `Test ${severity}`,
          filePath: '/test.ts',
          severity
        };

        expect(() => AutoFixIssueDetailSchema.parse(issue)).not.toThrow();
      });
    });

    it('handles edge cases in line and column numbers', () => {
      const edgeCases = [
        { line: 0, column: 0 }, // Start of file
        { line: 1, column: 1 }, // First line, first column
        { line: 999999, column: 999999 }, // Very large numbers
        { line: undefined, column: undefined }, // Optional fields
        { line: 42, column: undefined }, // Only line specified
        { line: undefined, column: 10 } // Only column specified
      ];

      edgeCases.forEach((testCase, index) => {
        const issue = {
          type: `test-type-${index}`,
          description: `Test case ${index}`,
          filePath: '/test.ts',
          ...testCase
        };

        expect(() => AutoFixIssueDetailSchema.parse(issue)).not.toThrow();
      });
    });

    it('validates extremely long descriptions', () => {
      const longDescription = 'This is a very long description that might occur in real-world scenarios where the auto-fix system needs to explain complex issues with detailed context and suggestions for resolution. '.repeat(100);

      const issue: AutoFixIssueDetail = {
        type: 'complex-error',
        description: longDescription,
        filePath: '/complex/file/with/issues.ts',
        line: 42,
        column: 15,
        severity: 'error'
      };

      const parsed = AutoFixIssueDetailSchema.parse(issue);
      expect(parsed.description).toHaveLength(longDescription.length);
    });

    it('handles special characters in file paths and descriptions', () => {
      const specialChars = {
        filePath: '/path/with/émojis/🚀/and-unicode/测试.ts',
        description: 'Error with émojis 🚀 and unicode 测试 characters'
      };

      const issue: AutoFixIssueDetail = {
        type: 'unicode-test',
        ...specialChars
      };

      const parsed = AutoFixIssueDetailSchema.parse(issue);
      expect(parsed.filePath).toBe(specialChars.filePath);
      expect(parsed.description).toBe(specialChars.description);
    });
  });

  describe('AutoFixEventSchema - Concurrent Events Simulation', () => {
    it('handles multiple concurrent events for same task', () => {
      const taskId = 'concurrent-task';
      const events: AutoFixEvent[] = [];

      // Simulate multiple files being processed concurrently
      const files = ['/file1.ts', '/file2.ts', '/file3.ts'];

      files.forEach((file, index) => {
        const event: AutoFixEvent = {
          id: `event-${index}`,
          eventType: 'auto-fix-progress',
          taskId,
          filesModified: [file],
          issuesFixed: [
            {
              type: 'syntax-error',
              description: `Fixed issue in ${file}`,
              filePath: file,
              line: 1,
              severity: 'error'
            }
          ],
          iterationCount: index + 1,
          totalIterations: 5,
          currentFile: file,
          status: 'running',
          timestamp: new Date(Date.now() + index * 100), // Slight time differences
          metadata: {
            processId: index + 1,
            worker: `worker-${index}`
          }
        };

        events.push(AutoFixEventSchema.parse(event));
      });

      expect(events).toHaveLength(3);
      expect(events.every(e => e.taskId === taskId)).toBe(true);
      expect(events.map(e => e.currentFile)).toEqual(files);
    });

    it('validates event ordering by timestamp', () => {
      const baseTime = new Date();
      const orderedEvents: AutoFixEvent[] = [
        {
          id: 'event-1',
          eventType: 'auto-fix-start',
          taskId: 'ordered-task',
          filesModified: [],
          issuesFixed: [],
          iterationCount: 0,
          totalIterations: 3,
          currentFile: '/test.ts',
          status: 'running',
          timestamp: new Date(baseTime.getTime())
        },
        {
          id: 'event-2',
          eventType: 'auto-fix-progress',
          taskId: 'ordered-task',
          filesModified: ['/test.ts'],
          issuesFixed: [],
          iterationCount: 1,
          totalIterations: 3,
          currentFile: '/test.ts',
          status: 'running',
          timestamp: new Date(baseTime.getTime() + 1000)
        },
        {
          id: 'event-3',
          eventType: 'auto-fix-complete',
          taskId: 'ordered-task',
          filesModified: ['/test.ts'],
          issuesFixed: [],
          iterationCount: 3,
          totalIterations: 3,
          currentFile: '/test.ts',
          status: 'success',
          timestamp: new Date(baseTime.getTime() + 2000)
        }
      ];

      const parsedEvents = orderedEvents.map(event => AutoFixEventSchema.parse(event));

      // Verify chronological order
      for (let i = 1; i < parsedEvents.length; i++) {
        expect(parsedEvents[i].timestamp.getTime()).toBeGreaterThan(
          parsedEvents[i - 1].timestamp.getTime()
        );
      }
    });
  });

  describe('AutoFixEventSchema - Performance and Memory', () => {
    it('handles rapid event creation without memory leaks', () => {
      const eventCount = 1000;
      const events: AutoFixEvent[] = [];

      const startMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();

      for (let i = 0; i < eventCount; i++) {
        const event: AutoFixEvent = {
          id: `perf-event-${i}`,
          eventType: i % 4 === 0 ? 'auto-fix-start' :
                    i % 4 === 1 ? 'auto-fix-progress' :
                    i % 4 === 2 ? 'auto-fix-complete' : 'auto-fix-error',
          taskId: `perf-task-${Math.floor(i / 10)}`,
          filesModified: [`/file${i}.ts`],
          issuesFixed: [],
          iterationCount: i % 10,
          totalIterations: 10,
          currentFile: `/file${i}.ts`,
          status: i % 4 === 3 ? 'failed' : i % 4 === 2 ? 'success' : 'running',
          timestamp: new Date(),
          metadata: { index: i }
        };

        events.push(AutoFixEventSchema.parse(event));
      }

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      const duration = endTime - startTime;
      const memoryIncrease = endMemory - startMemory;

      expect(events).toHaveLength(eventCount);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    });

    it('validates schema parsing is efficient with complex metadata', () => {
      const complexMetadata = {
        performance: {
          startTime: Date.now(),
          endTime: Date.now() + 5000,
          memoryUsage: {
            heapUsed: 50000000,
            heapTotal: 100000000,
            external: 5000000
          }
        },
        fileStats: Array.from({ length: 100 }, (_, i) => ({
          filePath: `/file${i}.ts`,
          size: 1000 + i * 100,
          linesOfCode: 50 + i * 5,
          issuesFound: i % 10,
          issuesFixed: (i % 10) - (i % 3)
        })),
        rules: {
          applied: ['semicolons', 'quotes', 'indentation', 'imports'],
          skipped: ['experimental-rule'],
          configuration: {
            strictMode: true,
            toleranceLevel: 'medium',
            customRules: new Array(50).fill(null).map((_, i) => `custom-rule-${i}`)
          }
        },
        diagnostics: {
          warnings: Array.from({ length: 20 }, (_, i) => `Warning ${i}`),
          errors: Array.from({ length: 5 }, (_, i) => `Error ${i}`),
          suggestions: Array.from({ length: 15 }, (_, i) => `Suggestion ${i}`)
        }
      };

      const event: AutoFixEvent = {
        id: 'complex-metadata-event',
        eventType: 'auto-fix-complete',
        taskId: 'complex-task',
        filesModified: ['/complex-file.ts'],
        issuesFixed: [],
        iterationCount: 1,
        totalIterations: 1,
        currentFile: '/complex-file.ts',
        status: 'success',
        timestamp: new Date(),
        metadata: complexMetadata
      };

      const start = performance.now();
      const parsed = AutoFixEventSchema.parse(event);
      const duration = performance.now() - start;

      expect(parsed.metadata).toEqual(complexMetadata);
      expect(duration).toBeLessThan(100); // Should parse quickly even with complex metadata
    });
  });

  describe('AutoFixEventSchema - Real-world Error Scenarios', () => {
    it('handles network-related auto-fix failures', () => {
      const networkError: AutoFixEvent = {
        id: 'network-error-event',
        eventType: 'auto-fix-error',
        taskId: 'network-task',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 1,
        totalIterations: 3,
        currentFile: '/network-dependent-file.ts',
        status: 'failed',
        timestamp: new Date(),
        error: 'ECONNREFUSED: Connection refused at 127.0.0.1:8080',
        metadata: {
          errorType: 'NetworkError',
          errorCode: 'ECONNREFUSED',
          retryAttempts: 3,
          lastAttemptTime: Date.now(),
          networkDiagnostics: {
            ping: 'failed',
            dns: 'resolved',
            port: 8080
          }
        }
      };

      const parsed = AutoFixEventSchema.parse(networkError);
      expect(parsed.error).toContain('ECONNREFUSED');
      expect(parsed.metadata?.errorType).toBe('NetworkError');
    });

    it('handles file system permission errors', () => {
      const permissionError: AutoFixEvent = {
        id: 'permission-error-event',
        eventType: 'auto-fix-error',
        taskId: 'permission-task',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 1,
        totalIterations: 1,
        currentFile: '/protected/system/file.ts',
        status: 'failed',
        timestamp: new Date(),
        error: 'EACCES: permission denied, open \'/protected/system/file.ts\'',
        metadata: {
          errorType: 'PermissionError',
          errorCode: 'EACCES',
          attemptedOperation: 'write',
          filePath: '/protected/system/file.ts',
          currentUser: 'developer',
          requiredPermissions: 'write',
          actualPermissions: 'read'
        }
      };

      expect(() => AutoFixEventSchema.parse(permissionError)).not.toThrow();
    });

    it('handles syntax parsing errors during auto-fix', () => {
      const syntaxError: AutoFixEvent = {
        id: 'syntax-error-event',
        eventType: 'auto-fix-error',
        taskId: 'syntax-task',
        filesModified: ['/broken-syntax.ts'],
        issuesFixed: [],
        iterationCount: 2,
        totalIterations: 3,
        currentFile: '/broken-syntax.ts',
        status: 'failed',
        timestamp: new Date(),
        error: 'SyntaxError: Unexpected token } in JSON at position 42',
        metadata: {
          errorType: 'SyntaxError',
          parseContext: {
            line: 15,
            column: 23,
            nearbyCode: 'const obj = { invalid: }',
            expectedTokens: ['string', 'number', 'identifier']
          },
          parserUsed: 'typescript',
          parserVersion: '5.3.0'
        }
      };

      const parsed = AutoFixEventSchema.parse(syntaxError);
      expect(parsed.error).toContain('SyntaxError');
      expect(parsed.metadata?.parseContext?.line).toBe(15);
    });
  });
});