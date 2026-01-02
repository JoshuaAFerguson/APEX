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

  describe('Method Stubs', () => {
    it('should have parse method that returns empty array', () => {
      const result = formatter.parse('some error text');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should have group method that returns empty array', () => {
      const errors: StructuredError[] = [createStructuredError('test')];
      const result = formatter.group(errors);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should have format method that returns empty string', () => {
      const groups: FormattedErrorGroup[] = [];
      const result = formatter.format(groups);
      expect(typeof result).toBe('string');
      expect(result).toBe('');
    });

    it('should have formatErrors convenience method', () => {
      const result = formatter.formatErrors('some error text');
      expect(typeof result).toBe('string');
      expect(result).toBe('');
    });
  });
});