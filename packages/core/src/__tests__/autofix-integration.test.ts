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
} from '../index.js'; // Import from main package index

describe('AutoFix Integration Tests', () => {
  describe('Package Export Validation', () => {
    it('exports all AutoFix schemas from main package', () => {
      expect(AutoFixConfigSchema).toBeDefined();
      expect(AutoFixResultSchema).toBeDefined();
      expect(AutoFixEventSchema).toBeDefined();
      expect(AutoFixEventTypeSchema).toBeDefined();
      expect(AutoFixStatusSchema).toBeDefined();
      expect(AutoFixIssueDetailSchema).toBeDefined();
    });

    it('provides working schema constructors', () => {
      expect(typeof AutoFixConfigSchema.parse).toBe('function');
      expect(typeof AutoFixResultSchema.parse).toBe('function');
      expect(typeof AutoFixEventSchema.parse).toBe('function');
      expect(typeof AutoFixEventTypeSchema.parse).toBe('function');
      expect(typeof AutoFixStatusSchema.parse).toBe('function');
      expect(typeof AutoFixIssueDetailSchema.parse).toBe('function');
    });
  });

  describe('Type Safety Integration', () => {
    it('enforces type safety at compile and runtime', () => {
      // This test verifies TypeScript types work correctly
      const config: AutoFixConfig = {
        enabled: true,
        syntax: {
          enabled: true,
          types: ['missing_semicolons']
        }
      };

      // Runtime validation should match TypeScript types
      const validated = AutoFixConfigSchema.parse(config);
      expect(validated.enabled).toBe(true);
      expect(validated.syntax?.enabled).toBe(true);
    });

    it('provides proper type inference', () => {
      const result = AutoFixResultSchema.parse({
        id: 'test-123',
        taskId: 'task-456',
        filePath: '/src/file.ts',
        fixType: 'syntax',
        success: true,
        description: 'Fixed issues',
        timestamp: new Date()
      });

      // TypeScript should infer the correct type
      const id: string = result.id;
      const success: boolean = result.success;
      const timestamp: Date = result.timestamp;

      expect(typeof id).toBe('string');
      expect(typeof success).toBe('boolean');
      expect(timestamp instanceof Date).toBe(true);
    });
  });

  describe('End-to-End AutoFix Workflow', () => {
    it('simulates complete auto-fix lifecycle', () => {
      const taskId = 'task-workflow-test';
      const filePath = '/src/components/Button.tsx';

      // 1. Configuration phase
      const config: AutoFixConfig = {
        enabled: true,
        syntax: {
          enabled: true,
          types: ['missing_semicolons', 'quotes']
        },
        imports: {
          enabled: true,
          addMissing: true,
          removeUnused: true,
          sort: false
        }
      };

      const validatedConfig = AutoFixConfigSchema.parse(config);
      expect(validatedConfig.enabled).toBe(true);

      // 2. Event tracking
      const events: AutoFixEvent[] = [];

      // Request event
      const requestEvent: AutoFixEvent = {
        id: 'event-request-1',
        eventType: 'auto-fix-start',
        taskId,
        filesModified: [],
        issuesFixed: [],
        iterationCount: 0,
        totalIterations: 3,
        currentFile: filePath,
        status: 'running',
        timestamp: new Date()
      };
      events.push(AutoFixEventSchema.parse(requestEvent));

      // Progress event
      const progressEvent: AutoFixEvent = {
        id: 'event-progress-1',
        eventType: 'auto-fix-progress',
        taskId,
        filesModified: [filePath],
        issuesFixed: [
          {
            type: 'syntax-error',
            description: 'Missing semicolon fixed',
            filePath,
            line: 1,
            severity: 'error'
          }
        ],
        iterationCount: 1,
        totalIterations: 3,
        currentFile: filePath,
        status: 'running',
        timestamp: new Date(),
        metadata: {
          duration: 600,
          tool: 'prettier'
        }
      };
      events.push(AutoFixEventSchema.parse(progressEvent));

      // Completion event
      const completeEvent: AutoFixEvent = {
        id: 'event-complete-1',
        eventType: 'auto-fix-complete',
        taskId,
        filesModified: [filePath],
        issuesFixed: [
          {
            type: 'syntax-error',
            description: 'Missing semicolon fixed',
            filePath,
            line: 1,
            severity: 'error'
          },
          {
            type: 'syntax-error',
            description: 'Missing quotes fixed',
            filePath,
            line: 2,
            severity: 'error'
          },
          {
            type: 'syntax-error',
            description: 'Indentation fixed',
            filePath,
            line: 3,
            severity: 'warning'
          },
          {
            type: 'syntax-error',
            description: 'Missing bracket fixed',
            filePath,
            line: 4,
            severity: 'error'
          }
        ],
        iterationCount: 3,
        totalIterations: 3,
        currentFile: filePath,
        status: 'success',
        timestamp: new Date(),
        metadata: {
          duration: 1200,
          tool: 'prettier'
        }
      };
      events.push(AutoFixEventSchema.parse(completeEvent));

      // 3. Result generation
      const result: AutoFixResult = {
        id: 'fix-result-1',
        taskId,
        filePath,
        fixType: 'syntax',
        success: true,
        description: 'Fixed 4 out of 5 syntax issues',
        timestamp: new Date(),
        issuesFixed: 4,
        originalContent: 'const name = "test"\nconst value = 42',
        fixedContent: 'const name = "test";\nconst value = 42;',
        metadata: {
          tool: 'prettier',
          duration: 1200,
          rulesApplied: ['semicolons', 'quotes']
        }
      };

      const validatedResult = AutoFixResultSchema.parse(result);

      // Verify workflow integrity
      expect(events).toHaveLength(3);
      expect(events[0].eventType).toBe('auto-fix-start');
      expect(events[1].eventType).toBe('auto-fix-progress');
      expect(events[2].eventType).toBe('auto-fix-complete');
      expect(validatedResult.success).toBe(true);
      expect(validatedResult.issuesFixed).toBe(4);

      // All events and results should have consistent data
      events.forEach(event => {
        expect(event.taskId).toBe(taskId);
        expect(event.currentFile).toBe(filePath);
      });
      expect(validatedResult.taskId).toBe(taskId);
      expect(validatedResult.filePath).toBe(filePath);
    });

    it('handles auto-fix failure scenario', () => {
      const taskId = 'task-failure-test';
      const filePath = '/src/broken-file.js';

      // Failed event
      const failedEvent: AutoFixEvent = {
        id: 'event-failed-1',
        eventType: 'auto-fix-error',
        taskId,
        filesModified: [],
        issuesFixed: [],
        iterationCount: 1,
        totalIterations: 3,
        currentFile: filePath,
        status: 'failed',
        timestamp: new Date(),
        error: 'Unable to resolve import paths',
        metadata: {
          errorCode: 'UNRESOLVED_IMPORT',
          attemptedFixes: ['relative-path', 'absolute-path'],
          duration: 5000
        }
      };

      const validatedEvent = AutoFixEventSchema.parse(failedEvent);
      expect(validatedEvent.eventType).toBe('auto-fix-error');
      expect(validatedEvent.error).toContain('Unable to resolve');

      // Failed result
      const failedResult: AutoFixResult = {
        id: 'fix-failed-1',
        taskId,
        filePath,
        fixType: 'imports',
        success: false,
        description: 'Auto-fix failed due to unresolvable imports',
        timestamp: new Date(),
        issuesFixed: 0,
        error: 'Unable to resolve import paths',
        originalContent: 'import { Component } from "./missing-file";',
        metadata: {
          errorCode: 'UNRESOLVED_IMPORT'
        }
      };

      const validatedResult = AutoFixResultSchema.parse(failedResult);
      expect(validatedResult.success).toBe(false);
      expect(validatedResult.error).toBeDefined();
      expect(validatedResult.issuesFixed).toBe(0);
    });

    it('handles auto-fix skip scenario', () => {
      const taskId = 'task-skip-test';
      const filePath = '/src/already-perfect.ts';

      // Skip event when no fixes needed
      const skipEvent: AutoFixEvent = {
        id: 'event-skip-1',
        eventType: 'auto-fix-complete',
        taskId,
        filesModified: [],
        issuesFixed: [],
        iterationCount: 1,
        totalIterations: 1,
        currentFile: filePath,
        status: 'success',
        timestamp: new Date(),
        metadata: {
          reason: 'no_issues_detected',
          scanDuration: 250
        }
      };

      const validatedEvent = AutoFixEventSchema.parse(skipEvent);
      expect(validatedEvent.eventType).toBe('auto-fix-complete');
      expect(validatedEvent.metadata?.reason).toBe('no_issues_detected');

      // Result when no fixes were needed
      const skipResult: AutoFixResult = {
        id: 'fix-skip-1',
        taskId,
        filePath,
        fixType: 'syntax',
        success: true,
        description: 'No issues found, auto-fix skipped',
        timestamp: new Date(),
        issuesFixed: 0,
        originalContent: 'const perfectCode = "no issues here";',
        fixedContent: 'const perfectCode = "no issues here";',
        metadata: {
          reason: 'no_issues_detected'
        }
      };

      const validatedResult = AutoFixResultSchema.parse(skipResult);
      expect(validatedResult.success).toBe(true);
      expect(validatedResult.issuesFixed).toBe(0);
      expect(validatedResult.originalContent).toBe(validatedResult.fixedContent);
    });
  });

  describe('Configuration Validation Scenarios', () => {
    it('validates production configuration', () => {
      const productionConfig: AutoFixConfig = {
        enabled: false, // Disabled in production
        syntax: {
          enabled: false,
          types: []
        },
        imports: {
          enabled: false,
          addMissing: false,
          removeUnused: false,
          sort: false
        }
      };

      const validated = AutoFixConfigSchema.parse(productionConfig);
      expect(validated.enabled).toBe(false);
      expect(validated.syntax?.enabled).toBe(false);
      expect(validated.imports?.enabled).toBe(false);
    });

    it('validates development configuration', () => {
      const devConfig: AutoFixConfig = {
        enabled: true,
        syntax: {
          enabled: true,
          types: ['missing_semicolons', 'missing_brackets', 'indentation', 'quotes']
        },
        imports: {
          enabled: true,
          addMissing: true,
          removeUnused: true,
          sort: true
        }
      };

      const validated = AutoFixConfigSchema.parse(devConfig);
      expect(validated.enabled).toBe(true);
      expect(validated.syntax?.types).toHaveLength(4);
      expect(validated.imports?.addMissing).toBe(true);
    });

    it('validates selective feature configuration', () => {
      const selectiveConfig: AutoFixConfig = {
        enabled: true,
        syntax: {
          enabled: true,
          types: ['missing_semicolons'] // Only specific fixes
        },
        imports: {
          enabled: true,
          addMissing: false, // Don't add imports
          removeUnused: true, // But remove unused ones
          sort: false        // Don't sort
        }
      };

      const validated = AutoFixConfigSchema.parse(selectiveConfig);
      expect(validated.syntax?.types).toEqual(['missing_semicolons']);
      expect(validated.imports?.addMissing).toBe(false);
      expect(validated.imports?.removeUnused).toBe(true);
    });
  });

  describe('Real-world Data Patterns', () => {
    it('handles realistic file paths', () => {
      const realPaths = [
        '/Users/dev/project/src/components/Button.tsx',
        'C:\\Projects\\app\\src\\utils\\helpers.js',
        './relative/path/file.ts',
        '../parent/directory/file.vue',
        'src/deeply/nested/directory/structure/file.jsx',
        '/workspace/monorepo/packages/ui/src/index.ts'
      ];

      realPaths.forEach(filePath => {
        const result = {
          id: `fix-${Date.now()}`,
          taskId: 'task-real-paths',
          filePath,
          fixType: 'syntax',
          success: true,
          description: 'Test with real path',
          timestamp: new Date()
        };

        expect(() => AutoFixResultSchema.parse(result)).not.toThrow();
      });
    });

    it('handles realistic error messages', () => {
      const realErrors = [
        'SyntaxError: Unexpected token } in JSON at position 42',
        'TypeError: Cannot read property \'map\' of undefined',
        'ReferenceError: Component is not defined',
        'ESLint: Missing semicolon (semi)',
        'Prettier: Line too long (exceeds 80 characters)',
        'TypeScript: Type \'string\' is not assignable to type \'number\''
      ];

      realErrors.forEach(error => {
        const result = {
          id: `fix-error-${Date.now()}`,
          taskId: 'task-real-errors',
          filePath: '/test.js',
          fixType: 'syntax',
          success: false,
          description: 'Failed to fix',
          timestamp: new Date(),
          error
        };

        const parsed = AutoFixResultSchema.parse(result);
        expect(parsed.error).toBe(error);
      });
    });

    it('handles realistic timestamp patterns', () => {
      const timestamps = [
        new Date(), // Current time
        new Date('2023-12-25T10:30:00Z'), // Specific UTC time
        new Date('2024-01-01T00:00:00.000Z'), // Year boundary
        new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        new Date(Date.now() + 1000 * 60 * 5)   // 5 minutes from now
      ];

      timestamps.forEach((timestamp, index) => {
        const event = {
          id: `event-time-${index}`,
          eventType: 'auto-fix-complete',
          taskId: 'task-timestamps',
          filesModified: ['/test.js'],
          issuesFixed: [],
          iterationCount: 1,
          totalIterations: 1,
          currentFile: '/test.js',
          status: 'success',
          timestamp
        };

        const parsed = AutoFixEventSchema.parse(event);
        expect(parsed.timestamp).toEqual(timestamp);
      });
    });
  });
});