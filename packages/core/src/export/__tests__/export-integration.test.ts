/**
 * @fileoverview Integration Tests for Export Formatter Infrastructure
 *
 * Tests the complete export workflow including mock implementations
 * of the ExportFormatterInterface and real-world usage scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  type ExportFormat,
  type ExportOptions,
  type ExportResult,
  type ExportFormatterInterface,
  type BaseExportFormatterOptions,
  createExportOptions,
  createSuccessResult,
  createErrorResult,
  createCancelledResult,
  isExportFormatter,
  isSuccessfulExport,
  getFormatExtension,
  getFormatMimeType,
} from '../types.js';

/**
 * Mock JSON formatter implementation for testing
 */
class MockJsonFormatter implements ExportFormatterInterface {
  constructor(private options: BaseExportFormatterOptions) {}

  getSupportedFormats(): ExportFormat[] {
    return this.options.formats;
  }

  supportsFormat(format: string): boolean {
    return this.options.formats.includes(format as ExportFormat);
  }

  async export(data: unknown, options: ExportOptions): Promise<ExportResult> {
    const startTime = Date.now();

    try {
      // Simulate format validation
      if (!this.supportsFormat(options.format)) {
        return createErrorResult(
          options.format,
          `Unsupported format: ${options.format}`
        );
      }

      // Handle cancellation
      if (options.signal?.aborted) {
        return createCancelledResult(options.format);
      }

      // Simulate export process
      let content: string;
      const warnings = [];

      switch (options.format) {
        case 'json':
          content = JSON.stringify(data, null, options.pretty ? options.indent as number : 0);
          // Handle cases where JSON.stringify returns undefined (e.g., for undefined input)
          if (content === undefined) {
            content = 'null';
          }
          break;
        case 'jsonl':
          content = Array.isArray(data)
            ? data.map(item => {
                const itemStr = JSON.stringify(item);
                return itemStr === undefined ? 'null' : itemStr;
              }).join('\n')
            : (() => {
                const itemStr = JSON.stringify(data);
                return itemStr === undefined ? 'null' : itemStr;
              })();
          break;
        default:
          return createErrorResult(options.format, 'Format not implemented');
      }

      // Apply field filtering if specified
      if (options.includeFields.length > 0 || options.excludeFields.length > 0) {
        warnings.push({
          code: 'FIELD_FILTERING_APPLIED',
          message: 'Field filtering was applied to the output',
        });
      }

      // Check size limits
      if (options.maxItems > 0 && Array.isArray(data) && data.length > options.maxItems) {
        warnings.push({
          code: 'ITEMS_TRUNCATED',
          message: `Output truncated to ${options.maxItems} items`,
          details: { limit: options.maxItems, total: data.length },
        });
      }

      const duration = Date.now() - startTime;

      return createSuccessResult(content, options.format, {
        itemCount: Array.isArray(data) ? data.length : 1,
        duration,
        warnings,
        metadata: {
          exportedAt: new Date(),
          source: 'mock-formatter',
          exporterVersion: this.options.version || '1.0.0',
          schemaVersion: '1.0',
          custom: options.custom,
        },
      });
    } catch (error) {
      return createErrorResult(
        options.format,
        error instanceof Error ? error : String(error)
      );
    }
  }
}

/**
 * Mock failing formatter for error testing
 */
class MockFailingFormatter implements ExportFormatterInterface {
  getSupportedFormats(): ExportFormat[] {
    return ['text'];
  }

  supportsFormat(format: string): boolean {
    return format === 'text';
  }

  async export(data: unknown, options: ExportOptions): Promise<ExportResult> {
    return createErrorResult(options.format, 'Mock formatter always fails');
  }
}

/**
 * Mock slow formatter for timeout testing
 */
class MockSlowFormatter implements ExportFormatterInterface {
  getSupportedFormats(): ExportFormat[] {
    return ['csv'];
  }

  supportsFormat(format: string): boolean {
    return format === 'csv';
  }

  async export(data: unknown, options: ExportOptions): Promise<ExportResult> {
    // Simulate slow processing
    await new Promise(resolve => setTimeout(resolve, 100));

    if (options.signal?.aborted) {
      return createCancelledResult(options.format);
    }

    return createSuccessResult('slow,export,result', 'csv');
  }
}

describe('Export Formatter Integration Tests', () => {
  let jsonFormatter: MockJsonFormatter;
  let failingFormatter: MockFailingFormatter;
  let slowFormatter: MockSlowFormatter;

  beforeEach(() => {
    jsonFormatter = new MockJsonFormatter({
      name: 'Mock JSON Formatter',
      description: 'Test JSON formatter',
      formats: ['json', 'jsonl'],
      version: '1.0.0',
      defaultOptions: {
        pretty: true,
        sortKeys: false,
      },
    });

    failingFormatter = new MockFailingFormatter();
    slowFormatter = new MockSlowFormatter();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('ExportFormatterInterface Implementation', () => {
    it('should validate formatter interface compliance', () => {
      expect(isExportFormatter(jsonFormatter)).toBe(true);
      expect(isExportFormatter(failingFormatter)).toBe(true);
      expect(isExportFormatter(slowFormatter)).toBe(true);

      // Test interface methods
      expect(jsonFormatter.getSupportedFormats()).toEqual(['json', 'jsonl']);
      expect(jsonFormatter.supportsFormat('json')).toBe(true);
      expect(jsonFormatter.supportsFormat('yaml')).toBe(false);
      expect(typeof jsonFormatter.export).toBe('function');
    });

    it('should export simple data successfully', async () => {
      const data = { name: 'test', value: 42 };
      const options = createExportOptions('json', { pretty: true });

      const result = await jsonFormatter.export(data, options);

      expect(result.status).toBe('success');
      expect(result.format).toBe('json');
      expect(result.content).toBe(JSON.stringify(data, null, 2));
      expect(result.byteSize).toBeGreaterThan(0);
      expect(result.itemCount).toBe(1);
      expect(result.duration).toBeTypeOf('number');
      expect(result.metadata?.source).toBe('mock-formatter');
      expect(result.metadata?.exporterVersion).toBe('1.0.0');
    });

    it('should export array data with item count', async () => {
      const data = [
        { id: 1, name: 'first' },
        { id: 2, name: 'second' },
        { id: 3, name: 'third' },
      ];
      const options = createExportOptions('json');

      const result = await jsonFormatter.export(data, options);

      expect(result.status).toBe('success');
      expect(result.itemCount).toBe(3);
      expect(result.content).toContain('first');
      expect(result.content).toContain('second');
      expect(result.content).toContain('third');
    });

    it('should export to JSONL format', async () => {
      const data = [
        { id: 1, name: 'first' },
        { id: 2, name: 'second' },
      ];
      const options = createExportOptions('jsonl');

      const result = await jsonFormatter.export(data, options);

      expect(result.status).toBe('success');
      expect(result.format).toBe('jsonl');
      expect(result.content).toBe(
        '{"id":1,"name":"first"}\n{"id":2,"name":"second"}'
      );
    });

    it('should handle unsupported formats', async () => {
      const data = { test: true };
      const options = createExportOptions('yaml' as ExportFormat);

      const result = await jsonFormatter.export(data, options);

      expect(result.status).toBe('error');
      expect(result.error).toContain('Unsupported format: yaml');
      expect(result.content).toBe('');
      expect(result.byteSize).toBe(0);
    });
  });

  describe('Export Options Integration', () => {
    it('should apply pretty printing option', async () => {
      const data = { nested: { value: 123 } };

      const prettyResult = await jsonFormatter.export(
        data,
        createExportOptions('json', { pretty: true })
      );

      const compactResult = await jsonFormatter.export(
        data,
        createExportOptions('json', { pretty: false })
      );

      expect(prettyResult.content).toContain('\n');
      expect(prettyResult.content).toContain('  ');
      expect(compactResult.content).not.toContain('\n');
      expect(compactResult.byteSize).toBeLessThan(prettyResult.byteSize);
    });

    it('should generate warnings for field filtering', async () => {
      const data = { id: 1, name: 'test', internal: 'secret' };
      const options = createExportOptions('json', {
        excludeFields: ['internal'],
      });

      const result = await jsonFormatter.export(data, options);

      expect(result.status).toBe('success');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings![0].code).toBe('FIELD_FILTERING_APPLIED');
    });

    it('should handle maxItems truncation', async () => {
      const data = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
      const options = createExportOptions('json', {
        maxItems: 50,
      });

      const result = await jsonFormatter.export(data, options);

      expect(result.status).toBe('success');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings![0].code).toBe('ITEMS_TRUNCATED');
      expect(result.warnings![0].details).toEqual({
        limit: 50,
        total: 100,
      });
    });

    it('should include custom metadata in results', async () => {
      const data = { test: 'data' };
      const options = createExportOptions('json', {
        custom: {
          userId: 'user123',
          sessionId: 'session456',
        },
      });

      const result = await jsonFormatter.export(data, options);

      expect(result.metadata?.custom).toEqual({
        userId: 'user123',
        sessionId: 'session456',
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle formatter errors gracefully', async () => {
      const data = { test: true };
      const options = createExportOptions('text');

      const result = await failingFormatter.export(data, options);

      expect(result.status).toBe('error');
      expect(result.error).toBe('Mock formatter always fails');
      expect(result.content).toBe('');
      expect(result.byteSize).toBe(0);
    });

    it('should handle cancellation signals', async () => {
      const controller = new AbortController();
      const data = { test: 'data' };
      const options = createExportOptions('csv', {
        signal: controller.signal,
      });

      // Cancel before export
      controller.abort();

      const result = await slowFormatter.export(data, options);

      expect(result.status).toBe('cancelled');
      expect(result.content).toBe('');
      expect(result.byteSize).toBe(0);
    });

    it('should handle cancellation during export', async () => {
      const controller = new AbortController();
      const data = { test: 'data' };
      const options = createExportOptions('csv', {
        signal: controller.signal,
      });

      // Cancel after 50ms
      setTimeout(() => controller.abort(), 50);

      const result = await slowFormatter.export(data, options);

      expect(result.status).toBe('cancelled');
    });

    it('should handle complex nested data', async () => {
      const complexData = {
        users: [
          {
            id: 1,
            profile: {
              name: 'Alice',
              settings: {
                theme: 'dark',
                notifications: {
                  email: true,
                  push: false,
                },
              },
            },
            tags: ['admin', 'power-user'],
          },
        ],
        metadata: {
          version: '1.0',
          generatedAt: new Date().toISOString(),
        },
      };

      const options = createExportOptions('json', { pretty: true });
      const result = await jsonFormatter.export(complexData, options);

      expect(result.status).toBe('success');
      expect(result.content).toContain('Alice');
      expect(result.content).toContain('admin');
      expect(result.byteSize).toBeGreaterThan(100);

      // Ensure the exported content is valid JSON
      expect(() => JSON.parse(result.content)).not.toThrow();
    });

    it('should handle empty data gracefully', async () => {
      const testCases = [
        { data: null, expectValid: true },
        { data: undefined, expectValid: true },
        { data: {}, expectValid: true },
        { data: [], expectValid: true },
        { data: '', expectValid: true },
        { data: 0, expectValid: true },
        { data: false, expectValid: true },
      ];

      for (const { data, expectValid } of testCases) {
        const options = createExportOptions('json');
        const result = await jsonFormatter.export(data, options);

        expect(result.status).toBe('success');
        expect(result.content).toBeDefined();
        if (expectValid) {
          expect(() => JSON.parse(result.content)).not.toThrow();
        }
      }
    });
  });

  describe('Utility Function Integration', () => {
    it('should integrate with format utility functions', async () => {
      const data = { test: 'export' };

      for (const format of jsonFormatter.getSupportedFormats()) {
        const options = createExportOptions(format);
        const result = await jsonFormatter.export(data, options);

        if (result.status === 'success') {
          // Test utility functions with actual format
          expect(getFormatExtension(format)).toMatch(/^\.\w+$/);
          expect(getFormatMimeType(format)).toMatch(/^\w+\/[\w-]+$/);

          // Verify result format matches requested format
          expect(result.format).toBe(format);
        }
      }
    });

    it('should validate export results with type guards', async () => {
      const data = { success: true };
      const options = createExportOptions('json');

      const result = await jsonFormatter.export(data, options);
      expect(isSuccessfulExport(result)).toBe(true);

      const failingResult = await failingFormatter.export({}, createExportOptions('text'));
      expect(isSuccessfulExport(failingResult)).toBe(false);
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle session data export scenario', async () => {
      const sessionData = {
        sessionId: 'session-123',
        userId: 'user-456',
        startTime: new Date('2023-10-15T10:00:00Z').toISOString(),
        endTime: new Date('2023-10-15T11:30:00Z').toISOString(),
        commands: [
          {
            id: 'cmd-1',
            type: 'file:read',
            timestamp: new Date('2023-10-15T10:05:00Z').toISOString(),
            parameters: { path: '/src/app.js' },
            result: { success: true, size: 1024 },
          },
          {
            id: 'cmd-2',
            type: 'file:write',
            timestamp: new Date('2023-10-15T10:15:00Z').toISOString(),
            parameters: { path: '/src/app.js', content: 'updated code' },
            result: { success: true, size: 1100 },
          },
        ],
        summary: {
          totalCommands: 2,
          successfulCommands: 2,
          totalTime: 5400000, // 1.5 hours in milliseconds
        },
      };

      const options = createExportOptions('json', {
        pretty: true,
        includeMetadata: true,
        title: 'Session Export Report',
        description: 'Complete session data export',
      });

      const result = await jsonFormatter.export(sessionData, options);

      expect(result.status).toBe('success');
      expect(result.itemCount).toBe(1);
      expect(result.metadata?.source).toBe('mock-formatter');
      expect(result.content).toContain('session-123');
      expect(result.content).toContain('user-456');
      expect(result.content).toContain('totalCommands');

      // Verify the exported data can be parsed back
      const parsed = JSON.parse(result.content);
      expect(parsed.sessionId).toBe('session-123');
      expect(parsed.commands).toHaveLength(2);
      expect(parsed.summary.totalCommands).toBe(2);
    });

    it('should handle configuration export scenario', async () => {
      const configData = {
        version: '1.0.0',
        project: {
          name: 'apex-test-project',
          language: 'typescript',
          framework: 'react',
        },
        agents: [
          {
            name: 'code-reviewer',
            model: 'sonnet',
            tools: ['Read', 'Write', 'Bash'],
            prompt: 'You are a code reviewer...',
          },
          {
            name: 'test-writer',
            model: 'haiku',
            tools: ['Read', 'Write'],
            prompt: 'You are a test writer...',
          },
        ],
        workflow: {
          stages: ['planning', 'implementation', 'testing', 'review'],
          autoApprove: false,
        },
      };

      const options = createExportOptions('json', {
        sortKeys: true,
        includeMetadata: true,
        custom: {
          exportType: 'configuration',
          includeSecrets: false,
        },
      });

      const result = await jsonFormatter.export(configData, options);

      expect(result.status).toBe('success');
      expect(result.metadata?.custom?.exportType).toBe('configuration');
      expect(result.content).toContain('apex-test-project');
      expect(result.content).toContain('code-reviewer');
      expect(result.content).toContain('test-writer');

      // Verify structure is preserved
      const parsed = JSON.parse(result.content);
      expect(parsed.agents).toHaveLength(2);
      expect(parsed.workflow.stages).toHaveLength(4);
    });

    it('should handle large dataset export with warnings', async () => {
      // Generate a large dataset
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: i + 1,
        data: `Item ${i + 1}`,
        timestamp: new Date(2023, 0, 1, 0, 0, i).toISOString(),
        metadata: {
          tags: [`tag-${i % 10}`, `category-${i % 5}`],
          score: Math.random() * 100,
        },
      }));

      const options = createExportOptions('jsonl', {
        maxItems: 1000, // Limit to trigger warnings
        includeMetadata: true,
      });

      const result = await jsonFormatter.export(largeDataset, options);

      expect(result.status).toBe('success');
      expect(result.itemCount).toBe(10000);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings![0].code).toBe('ITEMS_TRUNCATED');
      expect(result.warnings![0].details?.total).toBe(10000);
      expect(result.warnings![0].details?.limit).toBe(1000);
      expect(result.byteSize).toBeGreaterThan(1000);

      // Verify JSONL format
      const lines = result.content.split('\n');
      expect(lines.length).toBeGreaterThan(0);
      lines.forEach(line => {
        if (line.trim()) {
          expect(() => JSON.parse(line)).not.toThrow();
        }
      });
    });
  });
});