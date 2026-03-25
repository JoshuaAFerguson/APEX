/**
 * @fileoverview Tests for Export Formatter Types and Interfaces
 *
 * Comprehensive test suite for the export formatting infrastructure
 * including types, schemas, type guards, and utility functions.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  // Types and schemas
  ExportFormatSchema,
  type ExportFormat,
  ExportOptionsSchema,
  type ExportOptions,
  type PartialExportOptions,
  ExportStatusSchema,
  type ExportStatus,
  ExportWarningSchema,
  type ExportWarning,
  ExportResultSchema,
  type ExportResult,
  type ExportFormatterInterface,
  type BaseExportFormatterOptions,

  // Constants
  FORMAT_EXTENSIONS,
  FORMAT_MIME_TYPES,

  // Type guards
  isExportFormat,
  isExportFormatter,
  isSuccessfulExport,

  // Utility functions
  getFormatExtension,
  getFormatMimeType,
  createExportOptions,
  createSuccessResult,
  createErrorResult,
  createCancelledResult,
} from '../types.js';

describe('Export Formatter Types and Infrastructure', () => {
  describe('ExportFormat Type and Schema', () => {
    it('should validate all supported export formats', () => {
      const validFormats: ExportFormat[] = [
        'json', 'jsonl', 'yaml', 'toml', 'markdown',
        'html', 'csv', 'tsv', 'xml', 'text', 'table'
      ];

      for (const format of validFormats) {
        expect(ExportFormatSchema.parse(format)).toBe(format);
        expect(() => ExportFormatSchema.parse(format)).not.toThrow();
      }
    });

    it('should reject invalid export formats', () => {
      const invalidFormats = [
        'pdf', 'docx', 'excel', 'invalid', '', null, undefined, 123, {}
      ];

      for (const format of invalidFormats) {
        expect(() => ExportFormatSchema.parse(format)).toThrow();
      }
    });

    it('should have consistent format constants', () => {
      const allFormats = ExportFormatSchema.options;

      // All formats should have extensions
      for (const format of allFormats) {
        expect(FORMAT_EXTENSIONS[format]).toBeDefined();
        expect(FORMAT_EXTENSIONS[format]).toMatch(/^\.\w+$/);
      }

      // All formats should have MIME types
      for (const format of allFormats) {
        expect(FORMAT_MIME_TYPES[format]).toBeDefined();
        expect(FORMAT_MIME_TYPES[format]).toMatch(/^\w+\/[\w-]+$/);
      }
    });

    it('should have expected file extensions', () => {
      expect(FORMAT_EXTENSIONS.json).toBe('.json');
      expect(FORMAT_EXTENSIONS.jsonl).toBe('.jsonl');
      expect(FORMAT_EXTENSIONS.yaml).toBe('.yaml');
      expect(FORMAT_EXTENSIONS.toml).toBe('.toml');
      expect(FORMAT_EXTENSIONS.markdown).toBe('.md');
      expect(FORMAT_EXTENSIONS.html).toBe('.html');
      expect(FORMAT_EXTENSIONS.csv).toBe('.csv');
      expect(FORMAT_EXTENSIONS.tsv).toBe('.tsv');
      expect(FORMAT_EXTENSIONS.xml).toBe('.xml');
      expect(FORMAT_EXTENSIONS.text).toBe('.txt');
      expect(FORMAT_EXTENSIONS.table).toBe('.txt');
    });

    it('should have expected MIME types', () => {
      expect(FORMAT_MIME_TYPES.json).toBe('application/json');
      expect(FORMAT_MIME_TYPES.jsonl).toBe('application/x-ndjson');
      expect(FORMAT_MIME_TYPES.yaml).toBe('application/x-yaml');
      expect(FORMAT_MIME_TYPES.toml).toBe('application/toml');
      expect(FORMAT_MIME_TYPES.markdown).toBe('text/markdown');
      expect(FORMAT_MIME_TYPES.html).toBe('text/html');
      expect(FORMAT_MIME_TYPES.csv).toBe('text/csv');
      expect(FORMAT_MIME_TYPES.tsv).toBe('text/tab-separated-values');
      expect(FORMAT_MIME_TYPES.xml).toBe('application/xml');
      expect(FORMAT_MIME_TYPES.text).toBe('text/plain');
      expect(FORMAT_MIME_TYPES.table).toBe('text/plain');
    });
  });

  describe('ExportOptions Schema and Types', () => {
    it('should validate minimal export options', () => {
      const minimalOptions = {
        format: 'json' as ExportFormat,
      };

      const result = ExportOptionsSchema.parse(minimalOptions);
      expect(result.format).toBe('json');
      expect(result.pretty).toBe(true); // default
      expect(result.indent).toBe(2); // default
      expect(result.includeMetadata).toBe(false); // default
    });

    it('should validate full export options', () => {
      const fullOptions: ExportOptions = {
        format: 'csv',
        pretty: false,
        indent: 4,
        includeMetadata: true,
        maxDepth: 10,
        maxItems: 1000,
        includeFields: ['name', 'value'],
        excludeFields: ['internal'],
        sortKeys: true,
        includeNulls: false,
        includeEmpty: false,
        dateFormat: 'iso',
        timezone: 'UTC',
        encoding: 'utf-8',
        lineEnding: 'lf',
        headers: ['Name', 'Value'],
        delimiter: ',',
        quoteAll: true,
        template: 'default',
        cssClasses: { table: 'table-striped' },
        title: 'Export Report',
        description: 'Generated export',
        xmlRootElement: 'data',
        xmlAttributePrefix: '@',
        timeout: 30000,
        custom: { compression: 'gzip' },
      };

      const result = ExportOptionsSchema.parse(fullOptions);
      expect(result).toEqual(fullOptions);
    });

    it('should apply default values correctly', () => {
      const options = ExportOptionsSchema.parse({ format: 'yaml' });

      expect(options.pretty).toBe(true);
      expect(options.indent).toBe(2);
      expect(options.includeMetadata).toBe(false);
      expect(options.maxDepth).toBe(0);
      expect(options.maxItems).toBe(0);
      expect(options.includeFields).toEqual([]);
      expect(options.excludeFields).toEqual([]);
      expect(options.sortKeys).toBe(false);
      expect(options.includeNulls).toBe(true);
      expect(options.includeEmpty).toBe(true);
      expect(options.encoding).toBe('utf-8');
      expect(options.lineEnding).toBe('lf');
      expect(options.quoteAll).toBe(false);
      expect(options.xmlRootElement).toBe('root');
      expect(options.xmlAttributePrefix).toBe('@');
    });

    it('should validate indent options', () => {
      // String indent
      const stringIndent = ExportOptionsSchema.parse({
        format: 'json',
        indent: '\t'
      });
      expect(stringIndent.indent).toBe('\t');

      // Number indent
      const numberIndent = ExportOptionsSchema.parse({
        format: 'json',
        indent: 4
      });
      expect(numberIndent.indent).toBe(4);

      // Invalid indent
      expect(() => ExportOptionsSchema.parse({
        format: 'json',
        indent: -1
      })).toThrow();
    });

    it('should validate encoding options', () => {
      const validEncodings = ['utf-8', 'utf-16', 'ascii', 'latin1'];

      for (const encoding of validEncodings) {
        const options = ExportOptionsSchema.parse({
          format: 'text',
          encoding
        });
        expect(options.encoding).toBe(encoding);
      }

      expect(() => ExportOptionsSchema.parse({
        format: 'text',
        encoding: 'invalid'
      })).toThrow();
    });

    it('should validate line ending options', () => {
      const validLineEndings = ['lf', 'crlf', 'cr'];

      for (const lineEnding of validLineEndings) {
        const options = ExportOptionsSchema.parse({
          format: 'text',
          lineEnding
        });
        expect(options.lineEnding).toBe(lineEnding);
      }

      expect(() => ExportOptionsSchema.parse({
        format: 'text',
        lineEnding: 'invalid'
      })).toThrow();
    });

    it('should handle AbortSignal in options', () => {
      const controller = new AbortController();
      const options = ExportOptionsSchema.parse({
        format: 'json',
        signal: controller.signal
      });

      expect(options.signal).toBe(controller.signal);
    });
  });

  describe('ExportResult Schema and Types', () => {
    it('should validate successful export result', () => {
      const successResult: ExportResult = {
        status: 'success',
        content: '{"test": true}',
        format: 'json',
        byteSize: 14,
        itemCount: 1,
        duration: 100,
        warnings: [],
      };

      const result = ExportResultSchema.parse(successResult);
      expect(result).toEqual(successResult);
    });

    it('should validate error export result', () => {
      const errorResult: ExportResult = {
        status: 'error',
        content: '',
        format: 'json',
        byteSize: 0,
        warnings: [],
        error: 'Export failed',
        errorStack: 'Error: Export failed\n  at ...',
      };

      const result = ExportResultSchema.parse(errorResult);
      expect(result).toEqual(errorResult);
    });

    it('should validate export result with metadata', () => {
      const resultWithMetadata: ExportResult = {
        status: 'success',
        content: 'test data',
        format: 'text',
        byteSize: 9,
        metadata: {
          exportedAt: new Date('2023-10-15T10:00:00Z'),
          source: 'test-session',
          exporterVersion: '1.0.0',
          schemaVersion: '1.0',
          custom: { compression: 'none' },
        },
      };

      const result = ExportResultSchema.parse(resultWithMetadata);
      expect(result.metadata?.exportedAt).toEqual(new Date('2023-10-15T10:00:00Z'));
      expect(result.metadata?.source).toBe('test-session');
    });

    it('should validate export warnings', () => {
      const warning: ExportWarning = {
        code: 'TRUNCATED_CONTENT',
        message: 'Content was truncated due to size limits',
        path: 'data.items[100]',
        details: { limit: 100, actual: 150 },
      };

      const result = ExportWarningSchema.parse(warning);
      expect(result).toEqual(warning);

      // Test warning without optional fields
      const minimalWarning = {
        code: 'EMPTY_CONTENT',
        message: 'No content to export',
      };

      const minimalResult = ExportWarningSchema.parse(minimalWarning);
      expect(minimalResult.code).toBe('EMPTY_CONTENT');
      expect(minimalResult.message).toBe('No content to export');
    });

    it('should validate export status enum', () => {
      const validStatuses: ExportStatus[] = ['success', 'partial', 'error', 'cancelled'];

      for (const status of validStatuses) {
        expect(ExportStatusSchema.parse(status)).toBe(status);
      }

      expect(() => ExportStatusSchema.parse('invalid')).toThrow();
    });
  });

  describe('Type Guards', () => {
    describe('isExportFormat', () => {
      it('should return true for valid export formats', () => {
        const validFormats = [
          'json', 'jsonl', 'yaml', 'toml', 'markdown',
          'html', 'csv', 'tsv', 'xml', 'text', 'table'
        ];

        for (const format of validFormats) {
          expect(isExportFormat(format)).toBe(true);
        }
      });

      it('should return false for invalid export formats', () => {
        const invalidFormats = [
          'pdf', 'docx', 'excel', '', 'invalid', null, undefined
        ];

        for (const format of invalidFormats) {
          expect(isExportFormat(format as any)).toBe(false);
        }
      });
    });

    describe('isExportFormatter', () => {
      it('should return true for valid export formatter', () => {
        const validFormatter: ExportFormatterInterface = {
          getSupportedFormats: () => ['json', 'yaml'],
          supportsFormat: (format: string) => ['json', 'yaml'].includes(format),
          export: async () => ({
            status: 'success',
            content: '{}',
            format: 'json',
            byteSize: 2,
            warnings: [],
          }),
        };

        expect(isExportFormatter(validFormatter)).toBe(true);
      });

      it('should return false for invalid export formatter', () => {
        const invalidFormatters = [
          null,
          undefined,
          {},
          { getSupportedFormats: 'not-a-function' },
          { getSupportedFormats: () => [], supportsFormat: 'not-a-function' },
          { getSupportedFormats: () => [], supportsFormat: () => true },
          {
            getSupportedFormats: () => [],
            supportsFormat: () => true,
            export: 'not-a-function'
          },
        ];

        for (const formatter of invalidFormatters) {
          expect(isExportFormatter(formatter)).toBe(false);
        }
      });
    });

    describe('isSuccessfulExport', () => {
      it('should return true for successful exports', () => {
        const successResult: ExportResult = {
          status: 'success',
          content: 'data',
          format: 'json',
          byteSize: 4,
          warnings: [],
        };

        const partialResult: ExportResult = {
          status: 'partial',
          content: 'partial data',
          format: 'json',
          byteSize: 12,
          warnings: [],
        };

        expect(isSuccessfulExport(successResult)).toBe(true);
        expect(isSuccessfulExport(partialResult)).toBe(true);
      });

      it('should return false for unsuccessful exports', () => {
        const errorResult: ExportResult = {
          status: 'error',
          content: '',
          format: 'json',
          byteSize: 0,
          warnings: [],
          error: 'Failed',
        };

        const cancelledResult: ExportResult = {
          status: 'cancelled',
          content: '',
          format: 'json',
          byteSize: 0,
          warnings: [],
        };

        expect(isSuccessfulExport(errorResult)).toBe(false);
        expect(isSuccessfulExport(cancelledResult)).toBe(false);
      });
    });
  });

  describe('Utility Functions', () => {
    describe('getFormatExtension', () => {
      it('should return correct extensions for all formats', () => {
        expect(getFormatExtension('json')).toBe('.json');
        expect(getFormatExtension('jsonl')).toBe('.jsonl');
        expect(getFormatExtension('yaml')).toBe('.yaml');
        expect(getFormatExtension('toml')).toBe('.toml');
        expect(getFormatExtension('markdown')).toBe('.md');
        expect(getFormatExtension('html')).toBe('.html');
        expect(getFormatExtension('csv')).toBe('.csv');
        expect(getFormatExtension('tsv')).toBe('.tsv');
        expect(getFormatExtension('xml')).toBe('.xml');
        expect(getFormatExtension('text')).toBe('.txt');
        expect(getFormatExtension('table')).toBe('.txt');
      });
    });

    describe('getFormatMimeType', () => {
      it('should return correct MIME types for all formats', () => {
        expect(getFormatMimeType('json')).toBe('application/json');
        expect(getFormatMimeType('jsonl')).toBe('application/x-ndjson');
        expect(getFormatMimeType('yaml')).toBe('application/x-yaml');
        expect(getFormatMimeType('toml')).toBe('application/toml');
        expect(getFormatMimeType('markdown')).toBe('text/markdown');
        expect(getFormatMimeType('html')).toBe('text/html');
        expect(getFormatMimeType('csv')).toBe('text/csv');
        expect(getFormatMimeType('tsv')).toBe('text/tab-separated-values');
        expect(getFormatMimeType('xml')).toBe('application/xml');
        expect(getFormatMimeType('text')).toBe('text/plain');
        expect(getFormatMimeType('table')).toBe('text/plain');
      });
    });

    describe('createExportOptions', () => {
      it('should create default options for a format', () => {
        const options = createExportOptions('json');

        expect(options.format).toBe('json');
        expect(options.pretty).toBe(true);
        expect(options.indent).toBe(2);
        expect(options.includeMetadata).toBe(false);
      });

      it('should apply overrides to default options', () => {
        const options = createExportOptions('yaml', {
          pretty: false,
          indent: 4,
          includeMetadata: true,
          maxDepth: 5,
        });

        expect(options.format).toBe('yaml');
        expect(options.pretty).toBe(false);
        expect(options.indent).toBe(4);
        expect(options.includeMetadata).toBe(true);
        expect(options.maxDepth).toBe(5);
      });

      it('should validate overrides', () => {
        expect(() => createExportOptions('json', {
          indent: -1
        })).toThrow();

        expect(() => createExportOptions('invalid' as ExportFormat)).toThrow();
      });
    });

    describe('createSuccessResult', () => {
      it('should create basic success result', () => {
        const result = createSuccessResult('{"test": true}', 'json');

        expect(result.status).toBe('success');
        expect(result.content).toBe('{"test": true}');
        expect(result.format).toBe('json');
        expect(result.byteSize).toBe(14);
        expect(result.warnings).toEqual([]);
      });

      it('should create success result with additional options', () => {
        const result = createSuccessResult('test data', 'text', {
          itemCount: 5,
          duration: 250,
          warnings: [{
            code: 'INFO',
            message: 'Export completed successfully'
          }],
        });

        expect(result.status).toBe('success');
        expect(result.content).toBe('test data');
        expect(result.format).toBe('text');
        expect(result.byteSize).toBe(9);
        expect(result.itemCount).toBe(5);
        expect(result.duration).toBe(250);
        expect(result.warnings).toHaveLength(1);
      });
    });

    describe('createErrorResult', () => {
      it('should create error result from string', () => {
        const result = createErrorResult('json', 'Export failed');

        expect(result.status).toBe('error');
        expect(result.content).toBe('');
        expect(result.format).toBe('json');
        expect(result.byteSize).toBe(0);
        expect(result.warnings).toEqual([]);
        expect(result.error).toBe('Export failed');
        expect(result.errorStack).toBeUndefined();
      });

      it('should create error result from Error object', () => {
        const error = new Error('Export failed');
        error.stack = 'Error: Export failed\n  at test...';

        const result = createErrorResult('csv', error);

        expect(result.status).toBe('error');
        expect(result.content).toBe('');
        expect(result.format).toBe('csv');
        expect(result.byteSize).toBe(0);
        expect(result.warnings).toEqual([]);
        expect(result.error).toBe('Export failed');
        expect(result.errorStack).toBe('Error: Export failed\n  at test...');
      });
    });

    describe('createCancelledResult', () => {
      it('should create cancelled result', () => {
        const result = createCancelledResult('yaml');

        expect(result.status).toBe('cancelled');
        expect(result.content).toBe('');
        expect(result.format).toBe('yaml');
        expect(result.byteSize).toBe(0);
        expect(result.warnings).toEqual([]);
        expect(result.error).toBeUndefined();
        expect(result.errorStack).toBeUndefined();
      });
    });
  });

  describe('BaseExportFormatterOptions Interface', () => {
    it('should support minimal formatter options', () => {
      const options: BaseExportFormatterOptions = {
        name: 'Test Formatter',
        formats: ['json', 'yaml'],
      };

      expect(options.name).toBe('Test Formatter');
      expect(options.formats).toEqual(['json', 'yaml']);
      expect(options.description).toBeUndefined();
      expect(options.defaultOptions).toBeUndefined();
      expect(options.version).toBeUndefined();
    });

    it('should support full formatter options', () => {
      const options: BaseExportFormatterOptions = {
        name: 'Advanced JSON Formatter',
        description: 'High-performance JSON exporter with custom features',
        formats: ['json', 'jsonl'],
        defaultOptions: {
          pretty: true,
          sortKeys: true,
          includeMetadata: true,
        },
        version: '2.1.0',
      };

      expect(options.name).toBe('Advanced JSON Formatter');
      expect(options.description).toBe('High-performance JSON exporter with custom features');
      expect(options.formats).toEqual(['json', 'jsonl']);
      expect(options.defaultOptions?.pretty).toBe(true);
      expect(options.defaultOptions?.sortKeys).toBe(true);
      expect(options.defaultOptions?.includeMetadata).toBe(true);
      expect(options.version).toBe('2.1.0');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty content gracefully', () => {
      const result = createSuccessResult('', 'json');
      expect(result.byteSize).toBe(0);
      expect(result.content).toBe('');
    });

    it('should handle Unicode content correctly', () => {
      const unicodeContent = '{"emoji": "🚀", "chinese": "你好"}';
      const result = createSuccessResult(unicodeContent, 'json');

      // Buffer.byteLength counts bytes, not characters
      expect(result.byteSize).toBeGreaterThan(unicodeContent.length);
    });

    it('should handle large custom options', () => {
      const largeCustomOptions = {
        format: 'json' as ExportFormat,
        custom: {
          largeArray: new Array(1000).fill('test'),
          nestedObject: {
            level1: { level2: { level3: 'deep' } }
          },
        },
      };

      expect(() => ExportOptionsSchema.parse(largeCustomOptions)).not.toThrow();
    });

    it('should handle date serialization in metadata', () => {
      const now = new Date();
      const result: ExportResult = {
        status: 'success',
        content: 'test',
        format: 'json',
        byteSize: 4,
        warnings: [],
        metadata: {
          exportedAt: now,
          source: 'test',
        },
      };

      const validated = ExportResultSchema.parse(result);
      expect(validated.metadata?.exportedAt).toEqual(now);
    });

    it('should validate maximum values', () => {
      // Test very large valid values
      const options = {
        format: 'json' as ExportFormat,
        maxDepth: Number.MAX_SAFE_INTEGER,
        maxItems: Number.MAX_SAFE_INTEGER,
        timeout: 600000, // 10 minutes
      };

      expect(() => ExportOptionsSchema.parse(options)).not.toThrow();
    });

    it('should reject negative values where inappropriate', () => {
      expect(() => ExportOptionsSchema.parse({
        format: 'json',
        maxDepth: -1
      })).toThrow();

      expect(() => ExportOptionsSchema.parse({
        format: 'json',
        maxItems: -1
      })).toThrow();

      expect(() => ExportOptionsSchema.parse({
        format: 'json',
        timeout: -1
      })).toThrow();

      expect(() => ExportResultSchema.parse({
        status: 'success',
        content: 'test',
        format: 'json',
        byteSize: -1,
        warnings: []
      })).toThrow();

      expect(() => ExportResultSchema.parse({
        status: 'success',
        content: 'test',
        format: 'json',
        byteSize: 4,
        itemCount: -1,
        warnings: []
      })).toThrow();

      expect(() => ExportResultSchema.parse({
        status: 'success',
        content: 'test',
        format: 'json',
        byteSize: 4,
        duration: -1,
        warnings: []
      })).toThrow();
    });
  });
});