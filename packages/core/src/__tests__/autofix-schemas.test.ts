import { describe, it, expect } from 'vitest';
import {
  AutoFixConfigSchema,
  AutoFixResultSchema,
  AutoFixEventSchema,
  AutoFixEventTypeSchema,
  AutoFixStatusSchema,
  AutoFixIssueDetailSchema,
  type AutoFixConfig,
  type AutoFixResult,
  type AutoFixEvent,
  type AutoFixEventType,
  type AutoFixStatus,
  type AutoFixIssueDetail
} from '../types.js';
import { z } from 'zod';

describe('AutoFix Schemas', () => {
  describe('AutoFixConfigSchema', () => {
    it('validates minimal config', () => {
      const config = {};
      const result = AutoFixConfigSchema.parse(config);
      expect(result.enabled).toBe(false);
    });

    it('validates full config', () => {
      const config: AutoFixConfig = {
        enabled: true,
        syntax: {
          enabled: true,
          types: ['missing_semicolons', 'indentation']
        },
        imports: {
          enabled: true,
          addMissing: true,
          removeUnused: true,
          sort: true
        }
      };
      const result = AutoFixConfigSchema.parse(config);
      expect(result.enabled).toBe(true);
      expect(result.syntax?.enabled).toBe(true);
      expect(result.imports?.enabled).toBe(true);
    });

    it('applies default values', () => {
      const config = { enabled: true };
      const result = AutoFixConfigSchema.parse(config);
      expect(result.enabled).toBe(true);
    });
  });

  describe('AutoFixResultSchema', () => {
    it('validates result object', () => {
      const result: AutoFixResult = {
        id: 'test-fix-123',
        taskId: 'task-456',
        filePath: '/path/to/file.ts',
        fixType: 'syntax',
        success: true,
        description: 'Fixed missing semicolons',
        issuesFixed: 3,
        timestamp: new Date()
      };
      const parsed = AutoFixResultSchema.parse(result);
      expect(parsed.id).toBe('test-fix-123');
      expect(parsed.fixType).toBe('syntax');
      expect(parsed.success).toBe(true);
      expect(parsed.issuesFixed).toBe(3);
    });

    it('validates result with optional fields', () => {
      const result = {
        id: 'test-fix-123',
        taskId: 'task-456',
        filePath: '/path/to/file.ts',
        fixType: 'imports',
        success: false,
        description: 'Failed to fix imports',
        timestamp: new Date(),
        error: 'Import not found',
        originalContent: 'old code',
        fixedContent: 'new code',
        metadata: { tool: 'eslint' }
      };
      const parsed = AutoFixResultSchema.parse(result);
      expect(parsed.error).toBe('Import not found');
      expect(parsed.metadata?.tool).toBe('eslint');
    });

    it('applies default issuesFixed value', () => {
      const result = {
        id: 'test-fix-123',
        taskId: 'task-456',
        filePath: '/path/to/file.ts',
        fixType: 'formatting',
        success: true,
        description: 'Fixed formatting',
        timestamp: new Date()
      };
      const parsed = AutoFixResultSchema.parse(result);
      expect(parsed.issuesFixed).toBe(0);
    });
  });

  describe('AutoFixEventTypeSchema', () => {
    it('validates event types', () => {
      const types: AutoFixEventType[] = [
        'auto-fix-start',
        'auto-fix-progress',
        'auto-fix-complete',
        'auto-fix-error'
      ];

      types.forEach(type => {
        expect(() => AutoFixEventTypeSchema.parse(type)).not.toThrow();
      });
    });

    it('rejects invalid event types', () => {
      expect(() => AutoFixEventTypeSchema.parse('invalid:type')).toThrow();
    });
  });

  describe('AutoFixStatusSchema', () => {
    it('validates status types', () => {
      const statuses: AutoFixStatus[] = [
        'running',
        'success',
        'failed'
      ];

      statuses.forEach(status => {
        expect(() => AutoFixStatusSchema.parse(status)).not.toThrow();
      });
    });

    it('rejects invalid status types', () => {
      expect(() => AutoFixStatusSchema.parse('pending')).toThrow();
    });
  });

  describe('AutoFixIssueDetailSchema', () => {
    it('validates minimal issue detail', () => {
      const issue: AutoFixIssueDetail = {
        type: 'syntax-error',
        description: 'Missing semicolon',
        filePath: '/src/test.ts'
      };
      const result = AutoFixIssueDetailSchema.parse(issue);
      expect(result.type).toBe('syntax-error');
      expect(result.description).toBe('Missing semicolon');
    });

    it('validates issue detail with all fields', () => {
      const issue = {
        type: 'import-error',
        description: 'Unused import detected',
        filePath: '/src/utils.ts',
        line: 5,
        column: 12,
        severity: 'warning'
      };
      const result = AutoFixIssueDetailSchema.parse(issue);
      expect(result.line).toBe(5);
      expect(result.severity).toBe('warning');
    });

    it('rejects invalid severity', () => {
      const issue = {
        type: 'syntax-error',
        description: 'Test',
        filePath: '/test.ts',
        severity: 'critical'
      };
      expect(() => AutoFixIssueDetailSchema.parse(issue)).toThrow();
    });
  });

  describe('AutoFixEventSchema', () => {
    it('validates minimal event', () => {
      const event: AutoFixEvent = {
        id: 'event-123',
        eventType: 'auto-fix-start',
        taskId: 'task-456',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 0,
        totalIterations: 3,
        currentFile: '/path/to/file.ts',
        status: 'running',
        timestamp: new Date()
      };
      const parsed = AutoFixEventSchema.parse(event);
      expect(parsed.eventType).toBe('auto-fix-start');
      expect(parsed.taskId).toBe('task-456');
      expect(parsed.status).toBe('running');
    });

    it('validates event with all fields', () => {
      const event = {
        id: 'event-123',
        eventType: 'auto-fix-complete',
        taskId: 'task-456',
        filesModified: ['/src/utils.ts', '/src/main.ts'],
        issuesFixed: [
          {
            type: 'syntax-error',
            description: 'Missing semicolon',
            filePath: '/src/utils.ts',
            line: 10,
            column: 15,
            severity: 'error'
          },
          {
            type: 'import-error',
            description: 'Unused import',
            filePath: '/src/main.ts',
            line: 3,
            severity: 'warning'
          }
        ],
        iterationCount: 2,
        totalIterations: 3,
        currentFile: '/src/main.ts',
        status: 'success',
        timestamp: new Date(),
        metadata: { duration: 1500 }
      };
      const parsed = AutoFixEventSchema.parse(event);
      expect(parsed.filesModified).toHaveLength(2);
      expect(parsed.issuesFixed).toHaveLength(2);
      expect(parsed.iterationCount).toBe(2);
      expect(parsed.totalIterations).toBe(3);
    });

    it('validates failed event with error', () => {
      const event = {
        id: 'event-123',
        eventType: 'auto-fix-error',
        taskId: 'task-456',
        filesModified: ['/src/broken.ts'],
        issuesFixed: [],
        iterationCount: 1,
        totalIterations: 3,
        currentFile: '/src/broken.ts',
        status: 'failed',
        timestamp: new Date(),
        error: 'Syntax error could not be fixed'
      };
      const parsed = AutoFixEventSchema.parse(event);
      expect(parsed.error).toBe('Syntax error could not be fixed');
      expect(parsed.status).toBe('failed');
    });
  });

  // ============================================================================
  // Edge Cases and Error Path Testing
  // ============================================================================

  describe('AutoFixConfigSchema - Edge Cases', () => {
    it('rejects invalid syntax fix types', () => {
      const config = {
        enabled: true,
        syntax: {
          enabled: true,
          types: ['invalid_fix_type']
        }
      };
      expect(() => AutoFixConfigSchema.parse(config)).toThrow(z.ZodError);
    });

    it('handles empty syntax types array', () => {
      const config = {
        enabled: true,
        syntax: {
          enabled: true,
          types: []
        }
      };
      const result = AutoFixConfigSchema.parse(config);
      expect(result.syntax?.types).toEqual([]);
    });

    it('validates all valid syntax fix types', () => {
      const config = {
        enabled: true,
        syntax: {
          enabled: true,
          types: ['missing_semicolons', 'missing_brackets', 'indentation', 'quotes']
        }
      };
      const result = AutoFixConfigSchema.parse(config);
      expect(result.syntax?.types).toHaveLength(4);
    });

    it('handles null/undefined values gracefully', () => {
      const configs = [
        { enabled: null },
        { enabled: undefined },
        { syntax: null },
        { imports: null },
        {}
      ];

      configs.forEach(config => {
        expect(() => AutoFixConfigSchema.parse(config)).not.toThrow();
      });
    });

    it('applies correct default values for nested objects', () => {
      const config = {
        enabled: true,
        syntax: {},
        imports: {}
      };
      const result = AutoFixConfigSchema.parse(config);

      expect(result.syntax?.enabled).toBe(false);
      expect(result.syntax?.types).toEqual([]);
      expect(result.imports?.enabled).toBe(false);
      expect(result.imports?.addMissing).toBe(false);
      expect(result.imports?.removeUnused).toBe(false);
      expect(result.imports?.sort).toBe(false);
    });

    it('handles boolean coercion edge cases', () => {
      // Test that non-boolean values are properly rejected
      const invalidConfigs = [
        { enabled: 'true' },
        { enabled: 1 },
        { enabled: 0 },
        { syntax: { enabled: 'false' } },
        { imports: { addMissing: 'yes' } }
      ];

      invalidConfigs.forEach(config => {
        expect(() => AutoFixConfigSchema.parse(config)).toThrow(z.ZodError);
      });
    });
  });

  describe('AutoFixResultSchema - Edge Cases', () => {
    it('validates minimal required fields only', () => {
      const result = {
        id: 'test-fix',
        taskId: 'task-123',
        filePath: '/test.js',
        fixType: 'syntax',
        success: true,
        description: 'Test fix',
        timestamp: new Date()
      };
      expect(() => AutoFixResultSchema.parse(result)).not.toThrow();
    });

    it('rejects empty or whitespace-only strings', () => {
      const invalidResults = [
        { id: '', taskId: 'task', filePath: '/test', fixType: 'syntax', success: true, description: 'Test', timestamp: new Date() },
        { id: '   ', taskId: 'task', filePath: '/test', fixType: 'syntax', success: true, description: 'Test', timestamp: new Date() },
        { id: 'test', taskId: '', filePath: '/test', fixType: 'syntax', success: true, description: 'Test', timestamp: new Date() },
        { id: 'test', taskId: 'task', filePath: '', fixType: 'syntax', success: true, description: 'Test', timestamp: new Date() }
      ];

      invalidResults.forEach(result => {
        expect(() => AutoFixResultSchema.parse(result)).toThrow(z.ZodError);
      });
    });

    it('validates fix type enum values', () => {
      const validFixTypes = ['syntax', 'imports', 'formatting'];
      const invalidFixTypes = ['unknown', 'style', 'linting', ''];

      validFixTypes.forEach(fixType => {
        const result = {
          id: 'test',
          taskId: 'task',
          filePath: '/test',
          fixType,
          success: true,
          description: 'Test',
          timestamp: new Date()
        };
        expect(() => AutoFixResultSchema.parse(result)).not.toThrow();
      });

      invalidFixTypes.forEach(fixType => {
        const result = {
          id: 'test',
          taskId: 'task',
          filePath: '/test',
          fixType,
          success: true,
          description: 'Test',
          timestamp: new Date()
        };
        expect(() => AutoFixResultSchema.parse(result)).toThrow(z.ZodError);
      });
    });

    it('validates issuesFixed is non-negative', () => {
      const result = {
        id: 'test',
        taskId: 'task',
        filePath: '/test',
        fixType: 'syntax',
        success: true,
        description: 'Test',
        timestamp: new Date(),
        issuesFixed: -1
      };
      expect(() => AutoFixResultSchema.parse(result)).toThrow(z.ZodError);
    });

    it('handles large issuesFixed numbers', () => {
      const result = {
        id: 'test',
        taskId: 'task',
        filePath: '/test',
        fixType: 'syntax',
        success: true,
        description: 'Test',
        timestamp: new Date(),
        issuesFixed: Number.MAX_SAFE_INTEGER
      };
      expect(() => AutoFixResultSchema.parse(result)).not.toThrow();
    });

    it('validates timestamp is a Date object', () => {
      const invalidTimestamps = [
        '2023-01-01T00:00:00Z',
        1672531200000,
        'invalid date',
        null,
        undefined
      ];

      invalidTimestamps.forEach(timestamp => {
        const result = {
          id: 'test',
          taskId: 'task',
          filePath: '/test',
          fixType: 'syntax',
          success: true,
          description: 'Test',
          timestamp
        };
        expect(() => AutoFixResultSchema.parse(result)).toThrow(z.ZodError);
      });
    });

    it('handles arbitrary metadata values', () => {
      const metadataTestCases = [
        { simpleString: 'value' },
        { nestedObject: { deep: { value: true } } },
        { arrayValues: [1, 2, 3] },
        { mixedTypes: { str: 'text', num: 42, bool: true, arr: [1, 2] } },
        { nullValue: null },
        { undefinedValue: undefined }
      ];

      metadataTestCases.forEach(metadata => {
        const result = {
          id: 'test',
          taskId: 'task',
          filePath: '/test',
          fixType: 'syntax',
          success: true,
          description: 'Test',
          timestamp: new Date(),
          metadata
        };
        expect(() => AutoFixResultSchema.parse(result)).not.toThrow();
      });
    });

    it('handles very long content strings', () => {
      const longContent = 'x'.repeat(100000); // 100KB of content
      const result = {
        id: 'test',
        taskId: 'task',
        filePath: '/test',
        fixType: 'syntax',
        success: true,
        description: 'Test',
        timestamp: new Date(),
        originalContent: longContent,
        fixedContent: longContent + '\n// Fixed'
      };
      expect(() => AutoFixResultSchema.parse(result)).not.toThrow();
    });
  });

  describe('AutoFixEventSchema - Edge Cases', () => {
    it('rejects empty ID strings', () => {
      const event = {
        id: '',
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
      expect(() => AutoFixEventSchema.parse(event)).toThrow(z.ZodError);
    });

    it('validates all event types from the enum', () => {
      const eventTypes = ['auto-fix-start', 'auto-fix-progress', 'auto-fix-complete', 'auto-fix-error'];

      eventTypes.forEach(eventType => {
        const event = {
          id: 'event-123',
          eventType,
          taskId: 'task-456',
          filesModified: [],
          issuesFixed: [],
          iterationCount: 0,
          totalIterations: 1,
          currentFile: '/test.ts',
          status: 'running',
          timestamp: new Date()
        };
        expect(() => AutoFixEventSchema.parse(event)).not.toThrow();
      });
    });

    it('validates iterationCount and totalIterations are non-negative', () => {
      const negativeValues = [-1, -10, -0.5];

      negativeValues.forEach(value => {
        const eventIteration = {
          id: 'event-123',
          eventType: 'auto-fix-complete',
          taskId: 'task-456',
          filesModified: [],
          issuesFixed: [],
          iterationCount: value,
          totalIterations: 3,
          currentFile: '/test.ts',
          status: 'success',
          timestamp: new Date()
        };
        expect(() => AutoFixEventSchema.parse(eventIteration)).toThrow(z.ZodError);

        const eventTotal = {
          id: 'event-123',
          eventType: 'auto-fix-complete',
          taskId: 'task-456',
          filesModified: [],
          issuesFixed: [],
          iterationCount: 1,
          totalIterations: value,
          currentFile: '/test.ts',
          status: 'success',
          timestamp: new Date()
        };
        expect(() => AutoFixEventSchema.parse(eventTotal)).toThrow(z.ZodError);
      });
    });

    it('handles zero values for iteration counts', () => {
      const event = {
        id: 'event-123',
        eventType: 'auto-fix-start',
        taskId: 'task-456',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 0,
        totalIterations: 1,
        currentFile: '/test.ts',
        status: 'running',
        timestamp: new Date()
      };
      expect(() => AutoFixEventSchema.parse(event)).not.toThrow();
    });

    it('validates totalIterations must be at least 1', () => {
      const event = {
        id: 'event-123',
        eventType: 'auto-fix-start',
        taskId: 'task-456',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 0,
        totalIterations: 0, // Should be at least 1
        currentFile: '/test.ts',
        status: 'running',
        timestamp: new Date()
      };
      expect(() => AutoFixEventSchema.parse(event)).toThrow(z.ZodError);
    });

    it('validates empty arrays are allowed for filesModified and issuesFixed', () => {
      const event = {
        id: 'event-123',
        eventType: 'auto-fix-start',
        taskId: 'task-456',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 0,
        totalIterations: 1,
        currentFile: '/test.ts',
        status: 'running',
        timestamp: new Date()
      };
      expect(() => AutoFixEventSchema.parse(event)).not.toThrow();
    });

    it('handles complex metadata structures', () => {
      const complexMetadata = {
        performance: {
          startTime: Date.now(),
          endTime: Date.now() + 1000,
          memoryUsage: { heapUsed: 50000000 }
        },
        fixDetails: {
          rules: ['semicolons', 'quotes'],
          filesProcessed: 5,
          config: { strict: true }
        },
        errors: [
          { line: 10, message: 'Missing semicolon' },
          { line: 15, message: 'Incorrect quotes' }
        ]
      };

      const event = {
        id: 'event-123',
        eventType: 'auto-fix-complete',
        taskId: 'task-456',
        filesModified: ['/test.ts'],
        issuesFixed: [],
        iterationCount: 1,
        totalIterations: 1,
        currentFile: '/test.ts',
        status: 'success',
        timestamp: new Date(),
        metadata: complexMetadata
      };

      const parsed = AutoFixEventSchema.parse(event);
      expect(parsed.metadata).toEqual(complexMetadata);
    });
  });

  // ============================================================================
  // Integration and Serialization Tests
  // ============================================================================

  describe('Schema Serialization and Deserialization', () => {
    it('survives JSON round-trip for AutoFixConfig', () => {
      const config: AutoFixConfig = {
        enabled: true,
        syntax: {
          enabled: true,
          types: ['missing_semicolons', 'indentation']
        },
        imports: {
          enabled: true,
          addMissing: true,
          removeUnused: false,
          sort: true
        }
      };

      const serialized = JSON.stringify(config);
      const deserialized = JSON.parse(serialized);
      const validated = AutoFixConfigSchema.parse(deserialized);

      expect(validated).toEqual(config);
    });

    it('survives JSON round-trip for AutoFixResult', () => {
      const result: AutoFixResult = {
        id: 'fix-123',
        taskId: 'task-456',
        filePath: '/src/test.ts',
        fixType: 'syntax',
        success: true,
        description: 'Fixed missing semicolons',
        timestamp: new Date('2023-01-01T12:00:00Z'),
        issuesFixed: 5,
        originalContent: 'const x = 1\nconst y = 2',
        fixedContent: 'const x = 1;\nconst y = 2;',
        metadata: { tool: 'prettier', duration: 150 }
      };

      // Note: We need to handle Date serialization manually
      const serialized = JSON.stringify(result);
      const deserialized = JSON.parse(serialized);
      deserialized.timestamp = new Date(deserialized.timestamp);

      const validated = AutoFixResultSchema.parse(deserialized);
      expect(validated.id).toBe(result.id);
      expect(validated.fixType).toBe(result.fixType);
      expect(validated.timestamp).toEqual(result.timestamp);
    });

    it('survives JSON round-trip for AutoFixEvent', () => {
      const event: AutoFixEvent = {
        id: 'event-789',
        eventType: 'auto-fix-complete',
        taskId: 'task-123',
        filesModified: ['/src/utils.js', '/src/main.js'],
        issuesFixed: [
          {
            type: 'import-error',
            description: 'Unused import removed',
            filePath: '/src/utils.js',
            line: 5,
            severity: 'warning'
          }
        ],
        iterationCount: 2,
        totalIterations: 3,
        currentFile: '/src/main.js',
        status: 'success',
        timestamp: new Date('2023-01-01T14:30:00Z'),
        metadata: { duration: 750, rules: ['unused-imports'] }
      };

      const serialized = JSON.stringify(event);
      const deserialized = JSON.parse(serialized);
      deserialized.timestamp = new Date(deserialized.timestamp);

      const validated = AutoFixEventSchema.parse(deserialized);
      expect(validated).toEqual(event);
    });
  });

  describe('Cross-Schema Consistency', () => {
    it('maintains consistent fix types across schemas', () => {
      const fixTypes = ['syntax', 'imports', 'formatting'];

      // These fix types should be valid in both AutoFixResult and issue details in AutoFixEvent
      fixTypes.forEach(fixType => {
        const result = {
          id: 'test',
          taskId: 'task',
          filePath: '/test',
          fixType,
          success: true,
          description: 'Test',
          timestamp: new Date()
        };

        const event = {
          id: 'event',
          eventType: 'auto-fix-complete',
          taskId: 'task',
          filesModified: ['/test'],
          issuesFixed: [
            {
              type: fixType,
              description: 'Test issue',
              filePath: '/test'
            }
          ],
          iterationCount: 1,
          totalIterations: 1,
          currentFile: '/test',
          status: 'success',
          timestamp: new Date()
        };

        expect(() => AutoFixResultSchema.parse(result)).not.toThrow();
        expect(() => AutoFixEventSchema.parse(event)).not.toThrow();
      });
    });

    it('validates event type consistency', () => {
      const eventTypes = ['auto-fix-start', 'auto-fix-progress', 'auto-fix-complete', 'auto-fix-error'];

      eventTypes.forEach(eventType => {
        expect(() => AutoFixEventTypeSchema.parse(eventType)).not.toThrow();

        const event = {
          id: 'event',
          eventType,
          taskId: 'task',
          filesModified: [],
          issuesFixed: [],
          iterationCount: 0,
          totalIterations: 1,
          currentFile: '/test',
          status: 'running',
          timestamp: new Date()
        };
        expect(() => AutoFixEventSchema.parse(event)).not.toThrow();
      });
    });
  });

  describe('Performance and Memory Tests', () => {
    it('handles many syntax fix types efficiently', () => {
      const config = {
        enabled: true,
        syntax: {
          enabled: true,
          types: Array(100).fill('missing_semicolons') // Large array of valid types
        }
      };

      const start = performance.now();
      const result = AutoFixConfigSchema.parse(config);
      const duration = performance.now() - start;

      expect(result.syntax?.types).toHaveLength(100);
      expect(duration).toBeLessThan(100); // Should parse quickly
    });

    it('handles large metadata objects efficiently', () => {
      const largeMetadata = Array(1000).fill(null).reduce((acc, _, i) => {
        acc[`key${i}`] = `value${i}`;
        return acc;
      }, {});

      const event = {
        id: 'event-123',
        eventType: 'auto-fix-complete',
        taskId: 'task-456',
        filesModified: ['/test.ts'],
        issuesFixed: [],
        iterationCount: 1,
        totalIterations: 1,
        currentFile: '/test.ts',
        status: 'success',
        timestamp: new Date(),
        metadata: largeMetadata
      };

      const start = performance.now();
      const parsed = AutoFixEventSchema.parse(event);
      const duration = performance.now() - start;

      expect(Object.keys(parsed.metadata || {})).toHaveLength(1000);
      expect(duration).toBeLessThan(100); // Should parse quickly
    });
  });
});