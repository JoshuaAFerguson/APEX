/**
 * @fileoverview Edge Cases and Error Scenario Tests for Export Infrastructure
 *
 * Tests boundary conditions, error handling, and edge cases that might
 * occur in real-world usage of the export formatting system.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  type ExportFormat,
  type ExportOptions,
  type ExportResult,
  ExportOptionsSchema,
  ExportResultSchema,
  ExportWarningSchema,
  createExportOptions,
  createSuccessResult,
  createErrorResult,
  createCancelledResult,
  isExportFormat,
  isExportFormatter,
  isSuccessfulExport,
  getFormatExtension,
  getFormatMimeType,
} from '../types.js';

describe('Export Infrastructure Edge Cases', () => {
  describe('Schema Validation Edge Cases', () => {
    it('should handle boundary values for numeric fields', () => {
      const edgeCases = [
        { field: 'maxDepth', values: [0, 1, Number.MAX_SAFE_INTEGER] },
        { field: 'maxItems', values: [0, 1, Number.MAX_SAFE_INTEGER] },
        { field: 'timeout', values: [0, 1, 600000] },
      ];

      for (const { field, values } of edgeCases) {
        for (const value of values) {
          const options = { format: 'json' as ExportFormat, [field]: value };
          expect(() => ExportOptionsSchema.parse(options)).not.toThrow(
            `Failed for ${field} = ${value}`
          );
        }
      }
    });

    it('should handle invalid numeric field values', () => {
      const invalidCases = [
        { field: 'maxDepth', values: [-1, -100, Number.NEGATIVE_INFINITY] },
        { field: 'maxItems', values: [-1, -100, Number.NEGATIVE_INFINITY] },
        { field: 'timeout', values: [-1, -100, Number.NEGATIVE_INFINITY] },
        { field: 'indent', values: [-1, -100] }, // negative indent
      ];

      for (const { field, values } of invalidCases) {
        for (const value of values) {
          const options = { format: 'json' as ExportFormat, [field]: value };
          expect(() => ExportOptionsSchema.parse(options)).toThrow();
        }
      }
    });

    it('should handle special number values', () => {
      const options = {
        format: 'json' as ExportFormat,
        maxDepth: Number.NaN,
      };

      expect(() => ExportOptionsSchema.parse(options)).toThrow();

      const optionsInfinity = {
        format: 'json' as ExportFormat,
        maxDepth: Number.POSITIVE_INFINITY,
      };

      expect(() => ExportOptionsSchema.parse(optionsInfinity)).toThrow();
    });

    it('should handle empty and whitespace strings', () => {
      // Empty arrays should be allowed
      const emptyArrays = ExportOptionsSchema.parse({
        format: 'json',
        includeFields: [],
        excludeFields: [],
        headers: [],
      });
      expect(emptyArrays.includeFields).toEqual([]);
      expect(emptyArrays.excludeFields).toEqual([]);
      expect(emptyArrays.headers).toEqual([]);

      // Empty strings in optional fields
      const options = ExportOptionsSchema.parse({
        format: 'json',
        dateFormat: '',
        timezone: '',
        template: '',
        title: '',
        description: '',
        delimiter: '',
        xmlRootElement: '',
        xmlAttributePrefix: '',
      });

      expect(options.dateFormat).toBe('');
      expect(options.timezone).toBe('');
      expect(options.template).toBe('');
    });

    it('should handle complex nested custom options', () => {
      const complexCustom = {
        format: 'json' as ExportFormat,
        custom: {
          nested: {
            deeply: {
              embedded: {
                value: 'test',
                array: [1, 2, 3, { inner: 'object' }],
                nullValue: null,
                undefinedValue: undefined,
                date: new Date(),
                regex: /test/g,
                buffer: Buffer.from('test'),
              },
            },
          },
          circularRef: {} as any,
        },
      };

      // Create circular reference
      complexCustom.custom.circularRef.self = complexCustom.custom.circularRef;

      // Should handle complex structures (Zod allows unknown types)
      expect(() => ExportOptionsSchema.parse(complexCustom)).not.toThrow();
    });

    it('should validate warning schema edge cases', () => {
      // Minimal warning
      const minimalWarning = {
        code: 'TEST',
        message: 'Test message',
      };
      expect(() => ExportWarningSchema.parse(minimalWarning)).not.toThrow();

      // Warning with all fields
      const fullWarning = {
        code: 'COMPLEX_WARNING',
        message: 'Complex warning with details',
        path: 'data.nested.array[10].field',
        details: {
          expected: 'string',
          actual: 'number',
          position: { line: 42, column: 15 },
          suggestions: ['Convert to string', 'Use different field'],
        },
      };
      expect(() => ExportWarningSchema.parse(fullWarning)).not.toThrow();

      // Invalid warnings
      expect(() => ExportWarningSchema.parse({
        code: '', // Empty code
        message: 'Test',
      })).toThrow();

      expect(() => ExportWarningSchema.parse({
        code: 'TEST',
        message: '', // Empty message
      })).toThrow();
    });

    it('should handle export result with extreme values', () => {
      const extremeResult = {
        status: 'success',
        content: 'x'.repeat(1000000), // 1MB content
        format: 'text',
        byteSize: 1000000,
        itemCount: Number.MAX_SAFE_INTEGER,
        duration: 3600000, // 1 hour
        warnings: Array.from({ length: 1000 }, (_, i) => ({
          code: `WARNING_${i}`,
          message: `Warning number ${i}`,
        })),
      };

      expect(() => ExportResultSchema.parse(extremeResult)).not.toThrow();
    });
  });

  describe('Type Guard Edge Cases', () => {
    describe('isExportFormat', () => {
      it('should handle type coercion attempts', () => {
        const coercionAttempts = [
          { valueOf: () => 'json' },
          { toString: () => 'json' },
          new String('json'),
          ['json'],
          { 0: 'j', 1: 's', 2: 'o', 3: 'n', length: 4 },
        ];

        for (const attempt of coercionAttempts) {
          expect(isExportFormat(attempt as any)).toBe(false);
        }
      });

      it('should handle case sensitivity', () => {
        expect(isExportFormat('JSON')).toBe(false);
        expect(isExportFormat('Json')).toBe(false);
        expect(isExportFormat('YAML')).toBe(false);
        expect(isExportFormat('CSV')).toBe(false);
      });

      it('should handle similar but invalid formats', () => {
        const similarFormats = [
          'json5', 'jsonp', 'jsons', 'json_',
          'yaml1', 'yml', 'yaml-spec',
          'csvs', 'csv-file', 'tsv-file',
          'htm', 'html5', 'xhtml',
          'txt', 'text-plain',
        ];

        for (const format of similarFormats) {
          expect(isExportFormat(format)).toBe(false);
        }
      });
    });

    describe('isExportFormatter', () => {
      it('should handle objects with partial interface implementation', () => {
        const partialImplementations = [
          { getSupportedFormats: () => [] },
          { supportsFormat: () => true },
          { export: async () => ({}) },
          { getSupportedFormats: () => [], supportsFormat: () => true },
          { getSupportedFormats: () => [], export: async () => ({}) },
          { supportsFormat: () => true, export: async () => ({}) },
        ];

        for (const impl of partialImplementations) {
          expect(isExportFormatter(impl)).toBe(false);
        }
      });

      it('should handle objects with wrong method types', () => {
        const wrongTypes = [
          {
            getSupportedFormats: 'not-a-function',
            supportsFormat: () => true,
            export: async () => ({}),
          },
          {
            getSupportedFormats: () => [],
            supportsFormat: 'not-a-function',
            export: async () => ({}),
          },
          {
            getSupportedFormats: () => [],
            supportsFormat: () => true,
            export: 'not-a-function',
          },
          {
            getSupportedFormats: null,
            supportsFormat: () => true,
            export: async () => ({}),
          },
        ];

        for (const wrongType of wrongTypes) {
          expect(isExportFormatter(wrongType)).toBe(false);
        }
      });

      it('should handle inheritance and prototype chains', () => {
        class BaseFormatter {
          getSupportedFormats() { return []; }
        }

        class PartialFormatter extends BaseFormatter {
          supportsFormat() { return true; }
        }

        class CompleteFormatter extends PartialFormatter {
          async export() { return {} as any; }
        }

        expect(isExportFormatter(new BaseFormatter())).toBe(false);
        expect(isExportFormatter(new PartialFormatter())).toBe(false);
        expect(isExportFormatter(new CompleteFormatter())).toBe(true);
      });
    });

    describe('isSuccessfulExport', () => {
      it('should handle all result status combinations', () => {
        const statusTests = [
          { status: 'success', expected: true },
          { status: 'partial', expected: true },
          { status: 'error', expected: false },
          { status: 'cancelled', expected: false },
        ] as const;

        for (const { status, expected } of statusTests) {
          const result = {
            status,
            content: '',
            format: 'json' as ExportFormat,
            byteSize: 0,
            warnings: [],
          };
          expect(isSuccessfulExport(result)).toBe(expected);
        }
      });
    });
  });

  describe('Utility Function Edge Cases', () => {
    describe('Format extension and MIME type utilities', () => {
      it('should handle all valid formats without error', () => {
        const allFormats: ExportFormat[] = [
          'json', 'jsonl', 'yaml', 'toml', 'markdown',
          'html', 'csv', 'tsv', 'xml', 'text', 'table'
        ];

        for (const format of allFormats) {
          expect(() => getFormatExtension(format)).not.toThrow();
          expect(() => getFormatMimeType(format)).not.toThrow();

          const extension = getFormatExtension(format);
          const mimeType = getFormatMimeType(format);

          expect(extension).toMatch(/^\.\w+$/);
          expect(mimeType).toMatch(/^\w+\/[\w-]+$/);
        }
      });
    });

    describe('createExportOptions edge cases', () => {
      it('should handle conflicting override options', () => {
        const conflictingOptions = {
          includeFields: ['name'],
          excludeFields: ['name'], // Same field in both arrays
          includeNulls: true,
          includeEmpty: false,
          pretty: true,
          indent: 0, // Pretty but no indent
        };

        const result = createExportOptions('json', conflictingOptions);

        // Should accept conflicting options (validation is formatter's responsibility)
        expect(result.includeFields).toEqual(['name']);
        expect(result.excludeFields).toEqual(['name']);
        expect(result.includeNulls).toBe(true);
        expect(result.includeEmpty).toBe(false);
        expect(result.pretty).toBe(true);
        expect(result.indent).toBe(0);
      });

      it('should handle type coercion in overrides', () => {
        // These should fail validation, not be coerced
        expect(() => createExportOptions('json', {
          pretty: 'true' as any,
        })).toThrow();

        expect(() => createExportOptions('json', {
          maxDepth: '10' as any,
        })).toThrow();

        expect(() => createExportOptions('json', {
          includeFields: 'name,value' as any,
        })).toThrow();
      });
    });

    describe('Result creation utilities edge cases', () => {
      it('should handle Unicode and special characters in content', () => {
        const unicodeContent = [
          '🚀 Rocket emoji',
          '中文内容',
          'العربية',
          '🔥💯✨🎉',
          '\u0000\u0001\u0002', // Control characters
          '\\n\\r\\t', // Escaped characters
          'a'.repeat(100000), // Large content
        ];

        for (const content of unicodeContent) {
          const result = createSuccessResult(content, 'text');
          expect(result.content).toBe(content);
          expect(result.byteSize).toBeGreaterThanOrEqual(content.length);
        }
      });

      it('should handle edge cases in error creation', () => {
        // Error with empty message
        const emptyError = new Error('');
        const result1 = createErrorResult('json', emptyError);
        expect(result1.error).toBe('');

        // Error with very long message
        const longMessage = 'Error: '.repeat(1000);
        const result2 = createErrorResult('json', longMessage);
        expect(result2.error).toBe(longMessage);

        // Error with special characters
        const specialError = new Error('Error: 🚨 Failed with \\n\\r\\t chars');
        const result3 = createErrorResult('json', specialError);
        expect(result3.error).toBe('Error: 🚨 Failed with \\n\\r\\t chars');
      });

      it('should handle circular references in error objects', () => {
        const circularError = new Error('Circular error') as any;
        circularError.circular = circularError;

        // Should handle without throwing
        const result = createErrorResult('json', circularError);
        expect(result.error).toBe('Circular error');
        expect(result.errorStack).toContain('Circular error');
      });

      it('should calculate byte sizes correctly for various encodings', () => {
        const testStrings = [
          { content: 'ASCII only', encoding: 'ascii' },
          { content: 'UTF-8: 中文', encoding: 'utf-8' },
          { content: 'UTF-16: 🚀🔥', encoding: 'utf-16' },
          { content: 'Latin-1: café', encoding: 'latin1' },
        ];

        for (const { content } of testStrings) {
          const result = createSuccessResult(content, 'text');
          // Buffer.byteLength uses UTF-8 by default
          expect(result.byteSize).toBe(Buffer.byteLength(content, 'utf-8'));
        }
      });
    });
  });

  describe('Performance and Memory Edge Cases', () => {
    it('should handle large content strings efficiently', () => {
      const sizes = [1000, 10000, 100000]; // Various sizes

      for (const size of sizes) {
        const largeContent = 'x'.repeat(size);
        const startTime = Date.now();
        const result = createSuccessResult(largeContent, 'text');
        const endTime = Date.now();

        expect(result.byteSize).toBe(size);
        expect(endTime - startTime).toBeLessThan(100); // Should be fast
      }
    });

    it('should handle many warnings efficiently', () => {
      const warningCounts = [100, 1000, 5000];

      for (const count of warningCounts) {
        const warnings = Array.from({ length: count }, (_, i) => ({
          code: `WARNING_${i}`,
          message: `Warning number ${i}`,
        }));

        const result = createSuccessResult('test', 'json', { warnings });
        expect(result.warnings).toHaveLength(count);
      }
    });

    it('should handle AbortSignal edge cases', () => {
      const controller = new AbortController();

      // Already aborted signal
      controller.abort();
      const options = createExportOptions('json', {
        signal: controller.signal,
      });

      expect(options.signal?.aborted).toBe(true);

      // Custom abort reason
      const controller2 = new AbortController();
      controller2.abort('Custom abort reason');
      const options2 = createExportOptions('json', {
        signal: controller2.signal,
      });

      expect(options2.signal?.aborted).toBe(true);
    });
  });

  describe('Integration Edge Cases', () => {
    it('should handle malformed schema data gracefully', () => {
      const malformedData = [
        { format: null },
        { format: 123 },
        { format: ['json'] },
        { format: { type: 'json' } },
        { format: 'json', pretty: 'yes' },
        { format: 'json', timeout: 'forever' },
        { format: 'json', custom: Symbol('test') },
      ];

      for (const data of malformedData) {
        expect(() => ExportOptionsSchema.parse(data)).toThrow();
      }
    });

    it('should maintain type safety with complex generic scenarios', () => {
      // Test that TypeScript types work correctly with edge cases
      const options: ExportOptions = createExportOptions('json', {
        custom: {
          deeply: {
            nested: {
              configuration: {
                with: ['arrays', 'of', 'strings'],
                and: { objects: true },
                numbers: [1, 2, 3, 4, 5],
              },
            },
          },
        },
      });

      expect(options.custom?.deeply).toBeDefined();
      expect(typeof options.custom?.deeply).toBe('object');
    });

    it('should handle concurrent validation scenarios', async () => {
      // Simulate concurrent validation calls
      const promises = Array.from({ length: 100 }, async (_, i) => {
        const options = createExportOptions('json', {
          custom: { index: i },
        });
        return ExportOptionsSchema.parseAsync(options);
      });

      const results = await Promise.all(promises);

      for (let i = 0; i < results.length; i++) {
        expect(results[i].custom?.index).toBe(i);
      }
    });
  });
});