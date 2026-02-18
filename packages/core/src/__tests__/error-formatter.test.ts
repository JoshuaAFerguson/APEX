/**
 * Tests for ErrorFormatter core types and functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorFormatter,
  StructuredErrorSchema,
  ErrorContextSchema,
  FormattedErrorGroupSchema,
  ErrorSeveritySchema,
  ErrorCategorySchema,
  createStructuredError,
  generateErrorId,
  mergeErrorGroups,
  type StructuredError,
  type ErrorContext,
  type FormattedErrorGroup,
} from '../error-formatter';

describe('ErrorFormatter Core Types', () => {
  describe('Zod Schemas', () => {
    it('should validate StructuredError correctly', () => {
      const validError = {
        id: 'test-id',
        message: 'Test error message',
        severity: 'error' as const,
        category: 'syntax' as const,
        location: {
          file: '/path/to/file.ts',
          line: 10,
          column: 5,
        },
        context: {
          tool: 'typescript',
          timestamp: new Date(),
        },
      };

      expect(() => StructuredErrorSchema.parse(validError)).not.toThrow();
    });

    it('should validate ErrorContext correctly', () => {
      const validContext = {
        tool: 'eslint',
        stage: 'lint',
        agent: 'reviewer',
        taskId: 'task-123',
        timestamp: new Date(),
        workingDir: '/workspace',
        command: 'npm run lint',
        exitCode: 1,
        metadata: { rule: 'no-unused-vars' },
      };

      expect(() => ErrorContextSchema.parse(validContext)).not.toThrow();
    });

    it('should validate FormattedErrorGroup correctly', () => {
      const validGroup = {
        key: 'src/components/Button.tsx',
        groupBy: 'file' as const,
        title: 'Button.tsx',
        errors: [],
        summary: {
          total: 0,
          bySeverity: {
            error: 0,
            warning: 0,
            info: 0,
            hint: 0,
          },
        },
        collapsed: false,
      };

      expect(() => FormattedErrorGroupSchema.parse(validGroup)).not.toThrow();
    });

    it('should validate ErrorSeverity enum values', () => {
      const validSeverities = ['error', 'warning', 'info', 'hint'];
      validSeverities.forEach((severity) => {
        expect(() => ErrorSeveritySchema.parse(severity)).not.toThrow();
      });
    });

    it('should validate ErrorCategory enum values', () => {
      const validCategories = [
        'syntax', 'type', 'lint', 'test', 'runtime',
        'build', 'dependency', 'config', 'permission',
        'network', 'unknown'
      ];
      validCategories.forEach((category) => {
        expect(() => ErrorCategorySchema.parse(category)).not.toThrow();
      });
    });

    describe('Schema Edge Cases and Invalid Inputs', () => {
      describe('StructuredError validation', () => {
        it('should require id field', () => {
          const errorWithoutId = {
            message: 'Test error',
            severity: 'error' as const,
            category: 'syntax' as const,
          };
          expect(() => StructuredErrorSchema.parse(errorWithoutId)).toThrow();
        });

        it('should require message field', () => {
          const errorWithoutMessage = {
            id: 'test-id',
            severity: 'error' as const,
            category: 'syntax' as const,
          };
          expect(() => StructuredErrorSchema.parse(errorWithoutMessage)).toThrow();
        });

        it('should require severity field', () => {
          const errorWithoutSeverity = {
            id: 'test-id',
            message: 'Test error',
            category: 'syntax' as const,
          };
          expect(() => StructuredErrorSchema.parse(errorWithoutSeverity)).toThrow();
        });

        it('should require category field', () => {
          const errorWithoutCategory = {
            id: 'test-id',
            message: 'Test error',
            severity: 'error' as const,
          };
          expect(() => StructuredErrorSchema.parse(errorWithoutCategory)).toThrow();
        });

        it('should reject invalid severity values', () => {
          const errorWithInvalidSeverity = {
            id: 'test-id',
            message: 'Test error',
            severity: 'critical',
            category: 'syntax' as const,
          };
          expect(() => StructuredErrorSchema.parse(errorWithInvalidSeverity)).toThrow();
        });

        it('should reject invalid category values', () => {
          const errorWithInvalidCategory = {
            id: 'test-id',
            message: 'Test error',
            severity: 'error' as const,
            category: 'invalid-category',
          };
          expect(() => StructuredErrorSchema.parse(errorWithInvalidCategory)).toThrow();
        });

        it('should validate helpUrl as proper URL', () => {
          const errorWithInvalidUrl = {
            id: 'test-id',
            message: 'Test error',
            severity: 'error' as const,
            category: 'syntax' as const,
            helpUrl: 'not-a-url',
          };
          expect(() => StructuredErrorSchema.parse(errorWithInvalidUrl)).toThrow();

          const errorWithValidUrl = {
            id: 'test-id',
            message: 'Test error',
            severity: 'error' as const,
            category: 'syntax' as const,
            helpUrl: 'https://example.com/help',
          };
          expect(() => StructuredErrorSchema.parse(errorWithValidUrl)).not.toThrow();
        });

        it('should handle all optional fields as undefined', () => {
          const minimalError = {
            id: 'test-id',
            message: 'Test error',
            severity: 'error' as const,
            category: 'syntax' as const,
          };
          const result = StructuredErrorSchema.parse(minimalError);
          expect(result.location).toBeUndefined();
          expect(result.context).toBeUndefined();
          expect(result.code).toBeUndefined();
          expect(result.rawText).toBeUndefined();
          expect(result.stack).toBeUndefined();
          expect(result.relatedErrors).toBeUndefined();
          expect(result.suggestion).toBeUndefined();
          expect(result.helpUrl).toBeUndefined();
        });
      });

      describe('ErrorLocation validation', () => {
        it('should validate line numbers are positive integers', () => {
          expect(() => StructuredErrorSchema.parse({
            id: 'test',
            message: 'test',
            severity: 'error' as const,
            category: 'syntax' as const,
            location: { line: 0 }
          })).toThrow();

          expect(() => StructuredErrorSchema.parse({
            id: 'test',
            message: 'test',
            severity: 'error' as const,
            category: 'syntax' as const,
            location: { line: -1 }
          })).toThrow();

          expect(() => StructuredErrorSchema.parse({
            id: 'test',
            message: 'test',
            severity: 'error' as const,
            category: 'syntax' as const,
            location: { line: 1.5 }
          })).toThrow();
        });

        it('should validate column numbers are positive integers', () => {
          expect(() => StructuredErrorSchema.parse({
            id: 'test',
            message: 'test',
            severity: 'error' as const,
            category: 'syntax' as const,
            location: { column: 0 }
          })).toThrow();

          expect(() => StructuredErrorSchema.parse({
            id: 'test',
            message: 'test',
            severity: 'error' as const,
            category: 'syntax' as const,
            location: { column: -5 }
          })).toThrow();
        });

        it('should accept valid location with all fields', () => {
          const validLocation = {
            file: '/path/to/file.ts',
            line: 10,
            column: 5,
            endLine: 12,
            endColumn: 10,
          };
          expect(() => StructuredErrorSchema.parse({
            id: 'test',
            message: 'test',
            severity: 'error' as const,
            category: 'syntax' as const,
            location: validLocation
          })).not.toThrow();
        });
      });

      describe('ErrorContext validation', () => {
        it('should validate exitCode as integer', () => {
          expect(() => ErrorContextSchema.parse({ exitCode: 1.5 })).toThrow();
          expect(() => ErrorContextSchema.parse({ exitCode: '1' })).toThrow();
          expect(() => ErrorContextSchema.parse({ exitCode: -1 })).not.toThrow();
          expect(() => ErrorContextSchema.parse({ exitCode: 0 })).not.toThrow();
          expect(() => ErrorContextSchema.parse({ exitCode: 255 })).not.toThrow();
        });

        it('should validate timestamp as Date object', () => {
          expect(() => ErrorContextSchema.parse({ timestamp: '2023-01-01' })).toThrow();
          expect(() => ErrorContextSchema.parse({ timestamp: 1672531200000 })).toThrow();
          expect(() => ErrorContextSchema.parse({ timestamp: new Date() })).not.toThrow();
        });

        it('should accept empty context object', () => {
          expect(() => ErrorContextSchema.parse({})).not.toThrow();
        });
      });

      describe('FormattedErrorGroup validation', () => {
        it('should require all mandatory fields', () => {
          expect(() => FormattedErrorGroupSchema.parse({
            key: 'test',
            // missing groupBy, title, errors, summary
          })).toThrow();
        });

        it('should validate groupBy enum', () => {
          expect(() => FormattedErrorGroupSchema.parse({
            key: 'test',
            groupBy: 'invalid-group',
            title: 'Test',
            errors: [],
            summary: { total: 0, bySeverity: { error: 0, warning: 0, info: 0, hint: 0 } },
          })).toThrow();
        });

        it('should validate summary structure', () => {
          expect(() => FormattedErrorGroupSchema.parse({
            key: 'test',
            groupBy: 'file' as const,
            title: 'Test',
            errors: [],
            summary: { total: -1, bySeverity: { error: 0, warning: 0, info: 0, hint: 0 } },
          })).toThrow();

          expect(() => FormattedErrorGroupSchema.parse({
            key: 'test',
            groupBy: 'file' as const,
            title: 'Test',
            errors: [],
            summary: { total: 0, bySeverity: { error: -1, warning: 0, info: 0, hint: 0 } },
          })).toThrow();
        });

        it('should have default value for collapsed', () => {
          const group = FormattedErrorGroupSchema.parse({
            key: 'test',
            groupBy: 'file' as const,
            title: 'Test',
            errors: [],
            summary: { total: 0, bySeverity: { error: 0, warning: 0, info: 0, hint: 0 } },
          });
          expect(group.collapsed).toBe(false);
        });
      });

      describe('Options schemas validation', () => {
        it('should validate ErrorParseOptions', () => {
          const { ErrorParseOptionsSchema } = await import('../error-formatter');

          // Valid options
          expect(() => ErrorParseOptionsSchema.parse({})).not.toThrow();
          expect(() => ErrorParseOptionsSchema.parse({
            extractLocation: true,
            deduplicate: false,
            maxErrors: 100,
          })).not.toThrow();

          // Invalid options
          expect(() => ErrorParseOptionsSchema.parse({ extractLocation: 'yes' })).toThrow();
          expect(() => ErrorParseOptionsSchema.parse({ maxErrors: -1 })).toThrow();
          expect(() => ErrorParseOptionsSchema.parse({ maxErrors: 1.5 })).toThrow();
        });

        it('should validate ErrorGroupOptions', () => {
          const { ErrorGroupOptionsSchema } = await import('../error-formatter');

          expect(() => ErrorGroupOptionsSchema.parse({
            groupBy: 'invalid',
          })).toThrow();

          expect(() => ErrorGroupOptionsSchema.parse({
            minGroupSize: 0,
          })).toThrow();

          expect(() => ErrorGroupOptionsSchema.parse({
            sortGroups: 'true',
          })).toThrow();
        });

        it('should validate ErrorFormatOptions', () => {
          const { ErrorFormatOptionsSchema } = await import('../error-formatter');

          expect(() => ErrorFormatOptionsSchema.parse({
            format: 'pdf',
          })).toThrow();

          expect(() => ErrorFormatOptionsSchema.parse({
            contextLines: -1,
          })).toThrow();

          expect(() => ErrorFormatOptionsSchema.parse({
            maxMessageLength: -5,
          })).toThrow();
        });
      });
    });
  });

  describe('Utility Functions', () => {
    it('should generate unique error IDs', () => {
      const id1 = generateErrorId();
      const id2 = generateErrorId();

      expect(id1).toMatch(/^err_[a-z0-9]+_[a-z0-9]+$/);
      expect(id2).toMatch(/^err_[a-z0-9]+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should create structured errors with defaults', () => {
      const error = createStructuredError('Test message');

      expect(error.message).toBe('Test message');
      expect(error.severity).toBe('error');
      expect(error.category).toBe('unknown');
      expect(error.id).toMatch(/^err_[a-z0-9]+_[a-z0-9]+$/);
    });

    it('should create structured errors with custom options', () => {
      const error = createStructuredError('Warning message', {
        severity: 'warning',
        category: 'lint',
        location: { file: 'test.ts', line: 5 },
      });

      expect(error.message).toBe('Warning message');
      expect(error.severity).toBe('warning');
      expect(error.category).toBe('lint');
      expect(error.location?.file).toBe('test.ts');
      expect(error.location?.line).toBe(5);
    });

    it('should merge multiple error groups', () => {
      const group1: FormattedErrorGroup = {
        key: 'file1',
        groupBy: 'file',
        title: 'File 1',
        errors: [
          createStructuredError('Error 1', { severity: 'error' }),
          createStructuredError('Warning 1', { severity: 'warning' }),
        ],
        summary: {
          total: 2,
          bySeverity: { error: 1, warning: 1, info: 0, hint: 0 },
        },
      };

      const group2: FormattedErrorGroup = {
        key: 'file2',
        groupBy: 'file',
        title: 'File 2',
        errors: [
          createStructuredError('Error 2', { severity: 'error' }),
        ],
        summary: {
          total: 1,
          bySeverity: { error: 1, warning: 0, info: 0, hint: 0 },
        },
      };

      const merged = mergeErrorGroups([group1, group2]);

      expect(merged.key).toBe('merged');
      expect(merged.title).toBe('All Errors');
      expect(merged.errors).toHaveLength(3);
      expect(merged.summary.total).toBe(3);
      expect(merged.summary.bySeverity.error).toBe(2);
      expect(merged.summary.bySeverity.warning).toBe(1);
    });

    it('should handle merging empty groups', () => {
      const merged = mergeErrorGroups([]);

      expect(merged.key).toBe('merged');
      expect(merged.title).toBe('All Errors');
      expect(merged.errors).toHaveLength(0);
      expect(merged.summary.total).toBe(0);
      expect(merged.summary.bySeverity.error).toBe(0);
    });
  });
});

describe('ErrorFormatter Class', () => {
  let formatter: ErrorFormatter;

  beforeEach(() => {
    formatter = new ErrorFormatter();
  });

  it('should create with default options', () => {
    const parseOptions = formatter.getParseOptions();
    const groupOptions = formatter.getGroupOptions();
    const formatOptions = formatter.getFormatOptions();

    expect(parseOptions.extractLocation).toBe(true);
    expect(parseOptions.deduplicate).toBe(true);
    expect(parseOptions.maxErrors).toBe(0);

    expect(groupOptions.groupBy).toBe('file');
    expect(groupOptions.sortGroups).toBe(true);
    expect(groupOptions.sortBySeverity).toBe(true);
    expect(groupOptions.minGroupSize).toBe(1);

    expect(formatOptions.format).toBe('text');
    expect(formatOptions.includeContext).toBe(true);
    expect(formatOptions.contextLines).toBe(2);
    expect(formatOptions.showCodes).toBe(true);
    expect(formatOptions.showSuggestions).toBe(true);
    expect(formatOptions.showStackTraces).toBe(false);
    expect(formatOptions.colors).toBe(true);
    expect(formatOptions.showSummary).toBe(true);
  });

  it('should create with custom options', () => {
    const customFormatter = new ErrorFormatter({
      parse: { maxErrors: 100 },
      group: { groupBy: 'category' },
      format: { format: 'json' },
    });

    expect(customFormatter.getParseOptions().maxErrors).toBe(100);
    expect(customFormatter.getGroupOptions().groupBy).toBe('category');
    expect(customFormatter.getFormatOptions().format).toBe('json');
  });

  it('should update parse options', () => {
    formatter.setParseOptions({ maxErrors: 50 });
    expect(formatter.getParseOptions().maxErrors).toBe(50);
  });

  it('should update group options', () => {
    formatter.setGroupOptions({ groupBy: 'severity' });
    expect(formatter.getGroupOptions().groupBy).toBe('severity');
  });

  it('should update format options', () => {
    formatter.setFormatOptions({ format: 'markdown' });
    expect(formatter.getFormatOptions().format).toBe('markdown');
  });

  describe('Options Validation', () => {
    it('should validate parse options with Zod schema', () => {
      expect(() => formatter.setParseOptions({ maxErrors: -1 })).toThrow();
      expect(() => formatter.setParseOptions({ extractLocation: 'invalid' as any })).toThrow();
      expect(() => formatter.setParseOptions({ deduplicate: 123 as any })).toThrow();
    });

    it('should validate group options with Zod schema', () => {
      expect(() => formatter.setGroupOptions({ groupBy: 'invalid' as any })).toThrow();
      expect(() => formatter.setGroupOptions({ minGroupSize: 0 })).toThrow();
      expect(() => formatter.setGroupOptions({ sortGroups: 'yes' as any })).toThrow();
    });

    it('should validate format options with Zod schema', () => {
      expect(() => formatter.setFormatOptions({ format: 'xml' as any })).toThrow();
      expect(() => formatter.setFormatOptions({ contextLines: -1 })).toThrow();
      expect(() => formatter.setFormatOptions({ maxMessageLength: -5 })).toThrow();
    });

    it('should merge options correctly', () => {
      formatter.setParseOptions({ maxErrors: 10 });
      formatter.setParseOptions({ extractLocation: false });

      const options = formatter.getParseOptions();
      expect(options.maxErrors).toBe(10);
      expect(options.extractLocation).toBe(false);
      expect(options.deduplicate).toBe(true); // Should keep default
    });
  });

  describe('Method Stubs', () => {
    it('should have parse method that returns empty array', () => {
      const result = formatter.parse('some error text');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should accept string array input for parse', () => {
      const result = formatter.parse(['error 1', 'error 2', 'error 3']);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should pass through parse options to parse method', () => {
      const result = formatter.parse('error', { maxErrors: 5, extractLocation: false });
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should have group method that returns empty array', () => {
      const errors: StructuredError[] = [createStructuredError('test')];
      const result = formatter.group(errors);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should pass through group options to group method', () => {
      const errors: StructuredError[] = [createStructuredError('test')];
      const result = formatter.group(errors, { groupBy: 'category', sortGroups: false });
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should have format method that returns empty string', () => {
      const groups: FormattedErrorGroup[] = [];
      const result = formatter.format(groups);
      expect(typeof result).toBe('string');
      expect(result).toBe('');
    });

    it('should pass through format options to format method', () => {
      const groups: FormattedErrorGroup[] = [];
      const result = formatter.format(groups, { format: 'json', showSummary: false });
      expect(typeof result).toBe('string');
      expect(result).toBe('');
    });

    it('should have formatErrors convenience method', () => {
      const result = formatter.formatErrors('some error text');
      expect(typeof result).toBe('string');
      expect(result).toBe('');
    });

    it('should pass through all options in formatErrors', () => {
      const result = formatter.formatErrors('error', {
        parse: { maxErrors: 10 },
        group: { groupBy: 'severity' },
        format: { format: 'markdown' },
      });
      expect(typeof result).toBe('string');
      expect(result).toBe('');
    });

    it('should handle empty input gracefully', () => {
      expect(() => formatter.parse('')).not.toThrow();
      expect(() => formatter.parse([])).not.toThrow();
      expect(() => formatter.group([])).not.toThrow();
      expect(() => formatter.format([])).not.toThrow();
      expect(() => formatter.formatErrors('')).not.toThrow();
    });
  });
});

describe('ErrorFormatter Integration Tests', () => {
  describe('Real-world Error Parsing Scenarios', () => {
    it('should handle TypeScript compiler errors', () => {
      const formatter = new ErrorFormatter();
      const typescriptErrors = [
        "src/components/Button.tsx(15,25): error TS2339: Property 'doesNotExist' does not exist on type 'ButtonProps'.",
        "src/utils/helpers.ts(42,10): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.",
        "src/app.tsx(8,1): error TS1005: ';' expected."
      ];

      // Even though parse() returns empty array (stub), it should not throw
      expect(() => formatter.parse(typescriptErrors)).not.toThrow();
      const result = formatter.parse(typescriptErrors);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle ESLint errors', () => {
      const formatter = new ErrorFormatter();
      const eslintErrors = [
        "/workspace/src/components/Card.tsx:23:15: error: 'React' must be in scope when using JSX (react/react-in-jsx-scope)",
        "/workspace/src/utils/api.ts:45:1: warning: Unexpected console statement (no-console)",
        "/workspace/src/hooks/useAuth.ts:12:5: error: 'user' is assigned a value but never used (no-unused-vars)"
      ];

      expect(() => formatter.parse(eslintErrors)).not.toThrow();
      const result = formatter.parse(eslintErrors);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle Jest test failures', () => {
      const formatter = new ErrorFormatter();
      const jestErrors = [
        "FAIL src/components/__tests__/Button.test.tsx",
        "● Button › should render with correct text",
        "expect(received).toBe(expected) // Object.is equality",
        "Expected: \"Click me\"",
        "Received: \"Click\"",
        "  20 |     const button = screen.getByRole('button');",
        "  21 |     expect(button).toBeInTheDocument();",
        "> 22 |     expect(button).toBe('Click me');",
        "     |                    ^",
        "  23 |   });",
        "  24 | });"
      ];

      expect(() => formatter.parse(jestErrors.join('\n'))).not.toThrow();
    });

    it('should handle build tool errors', () => {
      const formatter = new ErrorFormatter();
      const buildErrors = [
        "ERROR in ./src/index.ts",
        "Module not found: Error: Can't resolve './missing-module' in '/workspace/src'",
        "@ ./src/index.ts 5:0-30",
        "",
        "ERROR in ./src/components/Layout.tsx",
        "Module parse failed: Unexpected token (15:2)",
        "You may need an appropriate loader to handle this file type."
      ];

      expect(() => formatter.parse(buildErrors.join('\n'))).not.toThrow();
    });

    it('should handle stack traces', () => {
      const formatter = new ErrorFormatter();
      const stackTrace = `
Error: Cannot read property 'length' of undefined
    at processArray (/workspace/src/utils/array.ts:15:23)
    at Array.forEach (<anonymous>)
    at main (/workspace/src/app.ts:42:5)
    at Object.<anonymous> (/workspace/src/app.ts:50:1)
    at Module._compile (internal/modules/cjs/loader.js:1063:30)
    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)
`;

      expect(() => formatter.parse(stackTrace)).not.toThrow();
    });
  });

  describe('Error Grouping Scenarios', () => {
    it('should handle grouping with different group keys', () => {
      const formatter = new ErrorFormatter();
      const errors = [
        createStructuredError('Error 1', {
          location: { file: 'file1.ts' },
          category: 'syntax',
          context: { tool: 'typescript' }
        }),
        createStructuredError('Error 2', {
          location: { file: 'file1.ts' },
          category: 'type',
          context: { tool: 'typescript' }
        }),
        createStructuredError('Error 3', {
          location: { file: 'file2.ts' },
          category: 'syntax',
          context: { tool: 'eslint' }
        }),
      ];

      // Test grouping by different keys
      expect(() => formatter.group(errors, { groupBy: 'file' })).not.toThrow();
      expect(() => formatter.group(errors, { groupBy: 'category' })).not.toThrow();
      expect(() => formatter.group(errors, { groupBy: 'tool' })).not.toThrow();
      expect(() => formatter.group(errors, { groupBy: 'severity' })).not.toThrow();
    });

    it('should handle empty error arrays for grouping', () => {
      const formatter = new ErrorFormatter();
      const result = formatter.group([]);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should handle large number of errors', () => {
      const formatter = new ErrorFormatter();
      const manyErrors = Array.from({ length: 1000 }, (_, i) =>
        createStructuredError(`Error ${i}`, {
          location: { file: `file${i % 10}.ts`, line: i + 1 },
          severity: i % 2 === 0 ? 'error' : 'warning'
        })
      );

      expect(() => formatter.group(manyErrors)).not.toThrow();
    });
  });

  describe('Error Formatting Scenarios', () => {
    it('should handle different output formats', () => {
      const formatter = new ErrorFormatter();
      const groups = [
        {
          key: 'test-group',
          groupBy: 'file' as const,
          title: 'Test Group',
          errors: [createStructuredError('Test error')],
          summary: {
            total: 1,
            bySeverity: { error: 1, warning: 0, info: 0, hint: 0 }
          }
        }
      ];

      // Test all output formats
      expect(() => formatter.format(groups, { format: 'text' })).not.toThrow();
      expect(() => formatter.format(groups, { format: 'ansi' })).not.toThrow();
      expect(() => formatter.format(groups, { format: 'json' })).not.toThrow();
      expect(() => formatter.format(groups, { format: 'markdown' })).not.toThrow();
      expect(() => formatter.format(groups, { format: 'html' })).not.toThrow();
    });

    it('should handle format options edge cases', () => {
      const formatter = new ErrorFormatter();
      const groups = [];

      expect(() => formatter.format(groups, {
        contextLines: 0,
        maxMessageLength: 0,
        colors: false,
        showSummary: false
      })).not.toThrow();
    });
  });

  describe('End-to-End Workflow', () => {
    it('should complete full parse -> group -> format workflow', () => {
      const formatter = new ErrorFormatter({
        parse: { extractLocation: true, deduplicate: true },
        group: { groupBy: 'file', sortGroups: true },
        format: { format: 'text', showSummary: true }
      });

      const errorOutput = [
        "src/app.ts:10:5: error: Variable 'x' is never used",
        "src/utils.ts:20:10: warning: Consider using const instead of let",
        "src/app.ts:15:1: error: Missing semicolon"
      ];

      expect(() => {
        const errors = formatter.parse(errorOutput);
        const groups = formatter.group(errors);
        const formatted = formatter.format(groups);
        return formatted;
      }).not.toThrow();
    });

    it('should handle formatErrors convenience method with complex input', () => {
      const formatter = new ErrorFormatter();
      const complexErrorOutput = `
ERROR in ./src/components/Button.tsx
Module build failed (from ./node_modules/@typescript-eslint/eslint-plugin/index.js):
Error: Cannot find module '@typescript-eslint/types'
    at Function.Module._resolveFilename (internal/modules/cjs/loader.js:902:15)
    at Function.Module._load (internal/modules/cjs/loader.js:746:27)

FAIL src/__tests__/integration.test.ts
  ● Integration tests › should handle API calls
    TypeError: Cannot read property 'data' of undefined
      at Object.<anonymous> (src/__tests__/integration.test.ts:45:23)
`;

      expect(() => formatter.formatErrors(complexErrorOutput, {
        parse: { maxErrors: 50, extractLocation: true },
        group: { groupBy: 'category', minGroupSize: 2 },
        format: { format: 'markdown', showStackTraces: true }
      })).not.toThrow();

      const result = formatter.formatErrors(complexErrorOutput);
      expect(typeof result).toBe('string');
      expect(result).toBe(''); // Stub returns empty string
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle very long error messages', () => {
      const formatter = new ErrorFormatter();
      const veryLongMessage = 'A'.repeat(10000);

      expect(() => createStructuredError(veryLongMessage)).not.toThrow();
      expect(() => formatter.parse(veryLongMessage)).not.toThrow();
    });

    it('should handle special characters in error messages', () => {
      const formatter = new ErrorFormatter();
      const specialCharsMessage = 'Error with émojis 🚨 and ünïcödé characters: "quotes", <tags>, & symbols!';

      expect(() => formatter.parse(specialCharsMessage)).not.toThrow();
    });

    it('should handle malformed input gracefully', () => {
      const formatter = new ErrorFormatter();

      expect(() => formatter.parse(null as any)).not.toThrow();
      expect(() => formatter.parse(undefined as any)).not.toThrow();
      expect(() => formatter.parse(123 as any)).not.toThrow();
      expect(() => formatter.parse({} as any)).not.toThrow();
    });

    it('should handle concurrent operations', async () => {
      const formatter = new ErrorFormatter();
      const operations = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve().then(() => formatter.parse(`Error ${i}`))
      );

      await expect(Promise.all(operations)).resolves.toBeDefined();
    });
  });
});