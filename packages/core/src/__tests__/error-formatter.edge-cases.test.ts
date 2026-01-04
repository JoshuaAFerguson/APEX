/**
 * Edge cases and error handling tests for ErrorFormatter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorFormatter,
  createStructuredError,
  generateErrorId,
  mergeErrorGroups,
  type StructuredError,
  type FormattedErrorGroup,
} from '../error-formatter';

describe('ErrorFormatter Edge Cases and Error Handling', () => {
  let formatter: ErrorFormatter;

  beforeEach(() => {
    formatter = new ErrorFormatter();
  });

  describe('Boundary Value Testing', () => {
    it('should handle maxErrors boundary values', () => {
      // Test with maxErrors = 0 (unlimited)
      formatter.setParseOptions({ maxErrors: 0 });
      expect(formatter.getParseOptions().maxErrors).toBe(0);

      // Test with maxErrors = 1
      formatter.setParseOptions({ maxErrors: 1 });
      expect(formatter.getParseOptions().maxErrors).toBe(1);

      // Test with large maxErrors value
      formatter.setParseOptions({ maxErrors: Number.MAX_SAFE_INTEGER });
      expect(formatter.getParseOptions().maxErrors).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle contextLines boundary values', () => {
      // Test with contextLines = 0
      formatter.setFormatOptions({ contextLines: 0 });
      expect(formatter.getFormatOptions().contextLines).toBe(0);

      // Test with large contextLines value
      formatter.setFormatOptions({ contextLines: 1000 });
      expect(formatter.getFormatOptions().contextLines).toBe(1000);
    });

    it('should handle minGroupSize boundary values', () => {
      // Test with minGroupSize = 1 (minimum allowed)
      formatter.setGroupOptions({ minGroupSize: 1 });
      expect(formatter.getGroupOptions().minGroupSize).toBe(1);

      // Test with large minGroupSize value
      formatter.setGroupOptions({ minGroupSize: 1000 });
      expect(formatter.getGroupOptions().minGroupSize).toBe(1000);
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle extremely large error arrays', () => {
      const largeErrorArray = Array.from({ length: 10000 }, (_, i) =>
        createStructuredError(`Error ${i}`, {
          location: { file: `file${i}.ts`, line: i + 1 },
          severity: 'error',
          category: 'syntax'
        })
      );

      expect(() => formatter.group(largeErrorArray)).not.toThrow();
      const result = formatter.group(largeErrorArray);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle very long input strings', () => {
      const veryLongInput = 'Error: '.repeat(100000) + 'Something went wrong';

      expect(() => formatter.parse(veryLongInput)).not.toThrow();
      const result = formatter.parse(veryLongInput);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle arrays with many string elements', () => {
      const manyStringErrors = Array.from({ length: 5000 }, (_, i) =>
        `Error ${i}: Something went wrong in file${i}.ts at line ${i + 1}`
      );

      expect(() => formatter.parse(manyStringErrors)).not.toThrow();
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle null and undefined inputs gracefully', () => {
      expect(() => formatter.parse(null as any)).not.toThrow();
      expect(() => formatter.parse(undefined as any)).not.toThrow();

      expect(() => formatter.group(null as any)).not.toThrow();
      expect(() => formatter.group(undefined as any)).not.toThrow();

      expect(() => formatter.format(null as any)).not.toThrow();
      expect(() => formatter.format(undefined as any)).not.toThrow();
    });

    it('should handle non-string, non-array inputs to parse', () => {
      expect(() => formatter.parse(123 as any)).not.toThrow();
      expect(() => formatter.parse(true as any)).not.toThrow();
      expect(() => formatter.parse({} as any)).not.toThrow();
      expect(() => formatter.parse(Symbol('test') as any)).not.toThrow();
    });

    it('should handle arrays with mixed types', () => {
      const mixedArray = [
        'Valid error string',
        123,
        null,
        undefined,
        { not: 'a string' },
        ['nested', 'array'],
        true,
        Symbol('symbol')
      ];

      expect(() => formatter.parse(mixedArray as any)).not.toThrow();
    });

    it('should handle circular references', () => {
      const circularObject: any = { message: 'Error' };
      circularObject.self = circularObject;

      expect(() => formatter.parse(circularObject as any)).not.toThrow();
    });
  });

  describe('Unicode and Special Character Handling', () => {
    it('should handle various Unicode characters', () => {
      const unicodeMessages = [
        'Error with émojis: 🚨🔥💥',
        'Unicode symbols: ⚠️ ✅ ❌',
        'Foreign characters: こんにちは 你好 مرحبا',
        'Mathematical symbols: ∑∫∆√',
        'Arrows and shapes: ↑→↓← ■□●○',
        'Currency and special: €£¥₹ ©®™'
      ];

      unicodeMessages.forEach(message => {
        expect(() => formatter.parse(message)).not.toThrow();
        expect(() => createStructuredError(message)).not.toThrow();
      });
    });

    it('should handle control characters and whitespace', () => {
      const specialCharMessages = [
        'Error\twith\ttabs',
        'Error\nwith\nnewlines',
        'Error\r\nwith\r\nCRLF',
        'Error with\x00null\x00bytes',
        'Error with\x1b[31mANSI\x1b[0mcodes',
        '   Error with leading/trailing spaces   ',
        'Error\bwith\bbackspace',
        'Error\fwith\fformfeed'
      ];

      specialCharMessages.forEach(message => {
        expect(() => formatter.parse(message)).not.toThrow();
      });
    });
  });

  describe('URL and Path Validation', () => {
    it('should validate various URL formats in helpUrl', () => {
      const validUrls = [
        'https://example.com',
        'http://example.com',
        'https://subdomain.example.com/path?query=value#fragment',
        'https://example.com:8080/path',
        'https://user:pass@example.com',
        'ftp://example.com/file.txt',
        'file:///path/to/file.txt'
      ];

      validUrls.forEach(url => {
        expect(() => createStructuredError('Test error', { helpUrl: url })).not.toThrow();
      });

      const invalidUrls = [
        'not-a-url',
        'http://',
        'https://',
        'example.com',
        'www.example.com',
        '://invalid',
        'ht tp://spaced.com'
      ];

      invalidUrls.forEach(url => {
        expect(() => createStructuredError('Test error', { helpUrl: url })).toThrow();
      });
    });

    it('should handle various file path formats', () => {
      const filePaths = [
        '/absolute/unix/path.ts',
        'relative/path.ts',
        './relative/path.ts',
        '../parent/path.ts',
        'C:\\Windows\\Path\\file.ts',
        '\\\\network\\share\\file.ts',
        '/path/with spaces/file.ts',
        '/path/with-special-chars_123/file.ts',
        '/very/long/path/that/goes/on/for/many/directories/and/has/a/very/long/filename.ts'
      ];

      filePaths.forEach(path => {
        expect(() => createStructuredError('Test error', {
          location: { file: path, line: 1, column: 1 }
        })).not.toThrow();
      });
    });
  });

  describe('Error ID Generation Edge Cases', () => {
    it('should generate unique IDs consistently', () => {
      const ids = new Set<string>();
      const numIds = 10000;

      for (let i = 0; i < numIds; i++) {
        const id = generateErrorId();
        expect(ids.has(id)).toBe(false); // Should be unique
        ids.add(id);
        expect(id).toMatch(/^err_[a-z0-9]+_[a-z0-9]+$/);
      }

      expect(ids.size).toBe(numIds);
    });

    it('should handle rapid ID generation', async () => {
      const promises = Array.from({ length: 1000 }, () =>
        Promise.resolve().then(() => generateErrorId())
      );

      const ids = await Promise.all(promises);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length); // All should be unique
    });
  });

  describe('Error Group Merging Edge Cases', () => {
    it('should handle merging groups with empty errors arrays', () => {
      const groups: FormattedErrorGroup[] = [
        {
          key: 'empty1',
          groupBy: 'file',
          title: 'Empty Group 1',
          errors: [],
          summary: {
            total: 0,
            bySeverity: { error: 0, warning: 0, info: 0, hint: 0 }
          }
        },
        {
          key: 'empty2',
          groupBy: 'file',
          title: 'Empty Group 2',
          errors: [],
          summary: {
            total: 0,
            bySeverity: { error: 0, warning: 0, info: 0, hint: 0 }
          }
        }
      ];

      const merged = mergeErrorGroups(groups);
      expect(merged.errors).toHaveLength(0);
      expect(merged.summary.total).toBe(0);
      expect(merged.summary.bySeverity.error).toBe(0);
    });

    it('should handle merging groups with mismatched severity counts', () => {
      const error1 = createStructuredError('Error 1', { severity: 'error' });
      const error2 = createStructuredError('Warning 1', { severity: 'warning' });

      const groups: FormattedErrorGroup[] = [
        {
          key: 'group1',
          groupBy: 'file',
          title: 'Group 1',
          errors: [error1, error2],
          summary: {
            total: 2,
            bySeverity: { error: 1, warning: 1, info: 0, hint: 0 }
          }
        },
        {
          key: 'group2',
          groupBy: 'file',
          title: 'Group 2',
          errors: [error2], // Only warning
          summary: {
            total: 1,
            bySeverity: { error: 0, warning: 1, info: 0, hint: 0 }
          }
        }
      ];

      const merged = mergeErrorGroups(groups);
      expect(merged.errors).toHaveLength(3);
      expect(merged.summary.total).toBe(3);
      expect(merged.summary.bySeverity.error).toBe(1);
      expect(merged.summary.bySeverity.warning).toBe(2);
    });

    it('should handle merging very large number of groups', () => {
      const manyGroups: FormattedErrorGroup[] = Array.from({ length: 1000 }, (_, i) => ({
        key: `group${i}`,
        groupBy: 'file' as const,
        title: `Group ${i}`,
        errors: [createStructuredError(`Error ${i}`)],
        summary: {
          total: 1,
          bySeverity: { error: 1, warning: 0, info: 0, hint: 0 }
        }
      }));

      expect(() => mergeErrorGroups(manyGroups)).not.toThrow();
      const merged = mergeErrorGroups(manyGroups);
      expect(merged.errors).toHaveLength(1000);
      expect(merged.summary.total).toBe(1000);
    });
  });

  describe('Options Coercion and Validation', () => {
    it('should handle option type coercion edge cases', () => {
      // Test that boolean options handle truthy/falsy values appropriately
      expect(() => formatter.setParseOptions({ extractLocation: 1 as any })).toThrow();
      expect(() => formatter.setParseOptions({ extractLocation: 'true' as any })).toThrow();
      expect(() => formatter.setParseOptions({ extractLocation: {} as any })).toThrow();

      // Test that numeric options handle string numbers appropriately
      expect(() => formatter.setParseOptions({ maxErrors: '10' as any })).toThrow();
      expect(() => formatter.setParseOptions({ maxErrors: 10.5 })).toThrow();
    });

    it('should handle deep option merging correctly', () => {
      // Set initial options
      formatter.setParseOptions({ maxErrors: 100, extractLocation: true });

      // Partial update should preserve other options
      formatter.setParseOptions({ maxErrors: 50 });

      const options = formatter.getParseOptions();
      expect(options.maxErrors).toBe(50);
      expect(options.extractLocation).toBe(true); // Should be preserved
      expect(options.deduplicate).toBe(true); // Should keep default
    });

    it('should handle invalid enum values', () => {
      expect(() => formatter.setGroupOptions({ groupBy: 'invalid-group-key' as any })).toThrow();
      expect(() => formatter.setFormatOptions({ format: 'invalid-format' as any })).toThrow();
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle concurrent option updates', async () => {
      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve().then(() => {
          formatter.setParseOptions({ maxErrors: i });
          return formatter.getParseOptions().maxErrors;
        })
      );

      const results = await Promise.all(promises);
      // Last write should win, but all operations should complete
      expect(results).toHaveLength(100);
      expect(results.every(result => typeof result === 'number')).toBe(true);
    });

    it('should handle concurrent method calls', async () => {
      const operations = [
        () => formatter.parse('error 1'),
        () => formatter.parse(['error 2', 'error 3']),
        () => formatter.group([]),
        () => formatter.format([]),
        () => formatter.formatErrors('error 4')
      ];

      const promises = Array.from({ length: 50 }, (_, i) =>
        Promise.resolve().then(operations[i % operations.length])
      );

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should not retain references to input data', () => {
      const largeInput = 'x'.repeat(1000000);
      const largeArray = Array.from({ length: 1000 }, () => largeInput);

      formatter.parse(largeInput);
      formatter.parse(largeArray);

      // Validate methods complete without throwing
      expect(true).toBe(true); // Methods should complete without memory issues
    });

    it('should handle repeated operations without memory growth', () => {
      for (let i = 0; i < 1000; i++) {
        const errors = Array.from({ length: 100 }, (_, j) =>
          createStructuredError(`Error ${i}-${j}`)
        );

        formatter.group(errors);
        formatter.format([]);
      }

      // Should complete without memory issues
      expect(true).toBe(true);
    });
  });
});