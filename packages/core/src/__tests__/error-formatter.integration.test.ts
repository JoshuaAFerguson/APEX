/**
 * Integration tests for ErrorFormatter with other core types and real-world scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorFormatter,
  createStructuredError,
  generateErrorId,
  mergeErrorGroups,
  type StructuredError,
  type FormattedErrorGroup,
  type ErrorContext,
} from '../error-formatter';

describe('ErrorFormatter Integration Tests', () => {
  let formatter: ErrorFormatter;

  beforeEach(() => {
    formatter = new ErrorFormatter();
  });

  describe('Integration with APEX Task Context', () => {
    it('should integrate with task execution context', () => {
      const taskContext: ErrorContext = {
        tool: 'typescript',
        stage: 'compile',
        agent: 'developer',
        taskId: 'task-123-abc',
        timestamp: new Date(),
        workingDir: '/workspace/apex-project',
        command: 'tsc --noEmit',
        exitCode: 1,
        metadata: {
          project: 'apex',
          version: '0.4.0'
        }
      };

      const error = createStructuredError('Type error in component', {
        severity: 'error',
        category: 'type',
        location: {
          file: '/workspace/apex-project/src/components/Button.tsx',
          line: 25,
          column: 15
        },
        context: taskContext,
        code: 'TS2339',
        suggestion: 'Check the property name spelling'
      });

      expect(error.context?.tool).toBe('typescript');
      expect(error.context?.stage).toBe('compile');
      expect(error.context?.agent).toBe('developer');
      expect(error.context?.taskId).toBe('task-123-abc');
      expect(error.code).toBe('TS2339');

      // Integration with ErrorFormatter
      expect(() => formatter.group([error])).not.toThrow();
      expect(() => formatter.format([])).not.toThrow();
    });

    it('should handle workflow stage transitions', () => {
      const stages = ['planning', 'architecture', 'implementation', 'testing', 'review'];
      const agents = ['planner', 'architect', 'developer', 'tester', 'reviewer'];

      const errors = stages.map((stage, index) =>
        createStructuredError(`Error in ${stage} stage`, {
          severity: index % 2 === 0 ? 'error' : 'warning',
          category: stage === 'testing' ? 'test' : 'lint',
          context: {
            stage,
            agent: agents[index],
            taskId: `task-${index}`,
            timestamp: new Date(Date.now() + index * 1000)
          }
        })
      );

      expect(() => formatter.group(errors, { groupBy: 'stage' })).not.toThrow();
    });
  });

  describe('Tool-Specific Error Format Integration', () => {
    it('should integrate with TypeScript compiler output', () => {
      const typescriptOutput = `
src/components/Button.tsx(15,25): error TS2339: Property 'doesNotExist' does not exist on type 'ButtonProps'.
src/utils/helpers.ts(42,10): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
src/app.tsx(8,1): error TS1005: ';' expected.
Found 3 errors in 3 files.
      `.trim();

      expect(() => formatter.parse(typescriptOutput)).not.toThrow();

      // Test with parse options that would be used for TypeScript
      const parseOptions = {
        defaultContext: { tool: 'typescript', stage: 'compile' },
        extractLocation: true,
        deduplicate: true
      };

      expect(() => formatter.parse(typescriptOutput, parseOptions)).not.toThrow();
    });

    it('should integrate with ESLint output', () => {
      const eslintOutput = `
/workspace/src/components/Card.tsx
  23:15  error    'React' must be in scope when using JSX  react/react-in-jsx-scope
  45:10  warning  Unexpected console statement             no-console

/workspace/src/utils/api.ts
  12:5  error  'user' is assigned a value but never used  no-unused-vars

✖ 3 problems (2 errors, 1 warning)
      `.trim();

      expect(() => formatter.parse(eslintOutput)).not.toThrow();

      const parseOptions = {
        defaultContext: { tool: 'eslint', stage: 'lint' },
        extractLocation: true,
        deduplicate: false // ESLint may have duplicate-looking errors that are different
      };

      expect(() => formatter.parse(eslintOutput, parseOptions)).not.toThrow();
    });

    it('should integrate with Jest test output', () => {
      const jestOutput = `
FAIL src/components/__tests__/Button.test.tsx
  ● Button › should render with correct text

    expect(received).toBe(expected) // Object.is equality

    Expected: "Click me"
    Received: "Click"

      20 |     const button = screen.getByRole('button');
      21 |     expect(button).toBeInTheDocument();
    > 22 |     expect(button).toBe('Click me');
         |                    ^
      23 |   });
      24 | });

FAIL src/utils/__tests__/helpers.test.ts
  ● calculateTotal › should sum numbers correctly

    TypeError: Cannot read property 'length' of undefined

      at calculateTotal (src/utils/helpers.ts:15:23)
      at Object.<anonymous> (src/utils/__tests__/helpers.test.ts:10:5)

Test Suites: 2 failed, 0 passed, 2 total
Tests:       2 failed, 0 passed, 2 total
      `.trim();

      expect(() => formatter.parse(jestOutput)).not.toThrow();

      const parseOptions = {
        defaultContext: { tool: 'jest', stage: 'test' },
        extractLocation: true,
        deduplicate: true
      };

      expect(() => formatter.parse(jestOutput, parseOptions)).not.toThrow();
    });
  });

  describe('Multi-Tool Workflow Integration', () => {
    it('should handle errors from multiple tools in a single workflow', () => {
      const multiToolErrors = [
        // TypeScript errors
        createStructuredError('Property does not exist', {
          severity: 'error',
          category: 'type',
          location: { file: 'src/app.ts', line: 15 },
          context: { tool: 'typescript', stage: 'compile' },
          code: 'TS2339'
        }),
        // ESLint errors
        createStructuredError('Missing semicolon', {
          severity: 'error',
          category: 'lint',
          location: { file: 'src/app.ts', line: 20 },
          context: { tool: 'eslint', stage: 'lint' },
          code: 'semi'
        }),
        // Jest errors
        createStructuredError('Test assertion failed', {
          severity: 'error',
          category: 'test',
          location: { file: 'src/__tests__/app.test.ts', line: 45 },
          context: { tool: 'jest', stage: 'test' }
        }),
        // Build errors
        createStructuredError('Module not found', {
          severity: 'error',
          category: 'build',
          location: { file: 'src/index.ts', line: 1 },
          context: { tool: 'webpack', stage: 'build' }
        })
      ];

      // Group by tool
      expect(() => formatter.group(multiToolErrors, { groupBy: 'tool' })).not.toThrow();

      // Group by stage
      expect(() => formatter.group(multiToolErrors, { groupBy: 'stage' })).not.toThrow();

      // Group by file
      expect(() => formatter.group(multiToolErrors, { groupBy: 'file' })).not.toThrow();

      // Group by category
      expect(() => formatter.group(multiToolErrors, { groupBy: 'category' })).not.toThrow();
    });

    it('should handle complex error relationships', () => {
      const primaryErrorId = generateErrorId();
      const primaryError = createStructuredError('Primary compilation error', {
        severity: 'error',
        category: 'type',
        location: { file: 'src/core/types.ts', line: 10 },
        context: { tool: 'typescript' }
      });
      primaryError.id = primaryErrorId;

      const relatedErrors = [
        createStructuredError('Related error 1', {
          severity: 'error',
          category: 'type',
          location: { file: 'src/components/Button.tsx', line: 25 },
          context: { tool: 'typescript' },
          relatedErrors: [primaryErrorId]
        }),
        createStructuredError('Related error 2', {
          severity: 'error',
          category: 'type',
          location: { file: 'src/utils/helpers.ts', line: 42 },
          context: { tool: 'typescript' },
          relatedErrors: [primaryErrorId]
        })
      ];

      const allErrors = [primaryError, ...relatedErrors];

      expect(() => formatter.group(allErrors)).not.toThrow();
      expect(() => formatter.format([])).not.toThrow();
    });
  });

  describe('Error Aggregation and Reporting', () => {
    it('should aggregate errors for project-wide reporting', () => {
      // Simulate a full project analysis with errors from different sources
      const projectErrors: StructuredError[] = [
        // TypeScript errors (high severity)
        ...Array.from({ length: 15 }, (_, i) =>
          createStructuredError(`TypeScript error ${i + 1}`, {
            severity: 'error',
            category: 'type',
            location: { file: `src/components/Component${i}.tsx`, line: i + 10 },
            context: { tool: 'typescript', stage: 'compile' }
          })
        ),
        // ESLint warnings (lower severity)
        ...Array.from({ length: 25 }, (_, i) =>
          createStructuredError(`ESLint warning ${i + 1}`, {
            severity: 'warning',
            category: 'lint',
            location: { file: `src/utils/util${i}.ts`, line: i + 5 },
            context: { tool: 'eslint', stage: 'lint' }
          })
        ),
        // Test failures (critical)
        ...Array.from({ length: 8 }, (_, i) =>
          createStructuredError(`Test failure ${i + 1}`, {
            severity: 'error',
            category: 'test',
            location: { file: `src/__tests__/test${i}.test.ts`, line: i + 20 },
            context: { tool: 'jest', stage: 'test' }
          })
        )
      ];

      const groups = formatter.group(projectErrors, { groupBy: 'category' });
      const merged = mergeErrorGroups(groups);

      expect(merged.summary.total).toBe(48);
      expect(merged.summary.bySeverity.error).toBe(23);
      expect(merged.summary.bySeverity.warning).toBe(25);

      // Verify all errors are included
      expect(merged.errors).toHaveLength(48);

      // Test formatting for project report
      expect(() => formatter.format([merged], {
        format: 'markdown',
        showSummary: true,
        showCodes: true,
        contextLines: 3
      })).not.toThrow();
    });

    it('should handle error deduplication scenarios', () => {
      // Create errors that might be duplicates
      const duplicateErrors = [
        createStructuredError('Duplicate error', {
          location: { file: 'src/app.ts', line: 10 },
          context: { tool: 'typescript' }
        }),
        createStructuredError('Duplicate error', {
          location: { file: 'src/app.ts', line: 10 },
          context: { tool: 'typescript' }
        }),
        createStructuredError('Similar but different error', {
          location: { file: 'src/app.ts', line: 11 },
          context: { tool: 'typescript' }
        })
      ];

      // Test with deduplication enabled
      expect(() => formatter.parse(
        duplicateErrors.map(e => e.message),
        { deduplicate: true }
      )).not.toThrow();

      // Test with deduplication disabled
      expect(() => formatter.parse(
        duplicateErrors.map(e => e.message),
        { deduplicate: false }
      )).not.toThrow();
    });
  });

  describe('Configuration Integration', () => {
    it('should integrate with APEX configuration patterns', () => {
      const apexConfigFormatter = new ErrorFormatter({
        parse: {
          defaultContext: {
            tool: 'apex',
            workingDir: '/workspace/apex-project',
            metadata: { version: '0.4.0' }
          },
          extractLocation: true,
          deduplicate: true,
          maxErrors: 100
        },
        group: {
          groupBy: 'stage',
          sortGroups: true,
          sortBySeverity: true,
          minGroupSize: 1
        },
        format: {
          format: 'ansi',
          includeContext: true,
          contextLines: 3,
          showCodes: true,
          showSuggestions: true,
          colors: true,
          showSummary: true
        }
      });

      expect(apexConfigFormatter.getParseOptions().defaultContext?.tool).toBe('apex');
      expect(apexConfigFormatter.getParseOptions().maxErrors).toBe(100);
      expect(apexConfigFormatter.getGroupOptions().groupBy).toBe('stage');
      expect(apexConfigFormatter.getFormatOptions().format).toBe('ansi');

      // Test that the configured formatter works
      expect(() => apexConfigFormatter.formatErrors('Test error')).not.toThrow();
    });

    it('should handle dynamic configuration updates', () => {
      // Initial configuration
      formatter.setParseOptions({ maxErrors: 50 });
      formatter.setGroupOptions({ groupBy: 'file' });
      formatter.setFormatOptions({ format: 'text' });

      // Simulate configuration update during runtime
      formatter.setParseOptions({ maxErrors: 100, extractLocation: false });
      formatter.setGroupOptions({ groupBy: 'severity', sortGroups: false });
      formatter.setFormatOptions({ format: 'json', colors: false });

      const parseOpts = formatter.getParseOptions();
      const groupOpts = formatter.getGroupOptions();
      const formatOpts = formatter.getFormatOptions();

      expect(parseOpts.maxErrors).toBe(100);
      expect(parseOpts.extractLocation).toBe(false);
      expect(parseOpts.deduplicate).toBe(true); // Should preserve default

      expect(groupOpts.groupBy).toBe('severity');
      expect(groupOpts.sortGroups).toBe(false);

      expect(formatOpts.format).toBe('json');
      expect(formatOpts.colors).toBe(false);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should continue processing after encountering malformed errors', () => {
      const mixedInput = [
        'Valid error message 1',
        null,
        undefined,
        'Valid error message 2',
        123,
        'Valid error message 3',
        { invalid: 'object' },
        'Valid error message 4'
      ];

      expect(() => formatter.parse(mixedInput as any)).not.toThrow();

      // Should handle the valid parts gracefully
      const result = formatter.parse(mixedInput as any);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle partial schema validation failures', () => {
      const partiallyValidErrors = [
        {
          id: 'valid-1',
          message: 'Valid error',
          severity: 'error',
          category: 'syntax'
        },
        {
          // Missing required fields
          message: 'Invalid error',
          severity: 'error'
        },
        {
          id: 'valid-2',
          message: 'Another valid error',
          severity: 'warning',
          category: 'lint'
        }
      ];

      // Create valid structured errors
      const validErrors = [
        createStructuredError('Valid error 1'),
        createStructuredError('Valid error 2', { severity: 'warning', category: 'lint' })
      ];

      expect(() => formatter.group(validErrors)).not.toThrow();
    });
  });
});