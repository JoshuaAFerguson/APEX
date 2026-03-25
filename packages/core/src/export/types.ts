/**
 * @fileoverview Export Formatter Types and Interfaces
 *
 * This module provides the core types and interfaces for export formatting
 * within the APEX platform. It defines the contract for implementing format-specific
 * exporters and provides standardized options and result types.
 *
 * ## Architecture Decision Record (ADR-018)
 *
 * ### Context
 * APEX needs a standardized way to export data in various formats (JSON, Markdown,
 * CSV, HTML, etc.). This is essential for:
 * - Generating reports from session data and execution results
 * - Exporting configuration and state for external tools
 * - Creating user-friendly output in different formats
 * - Supporting integration with downstream systems
 *
 * ### Decision
 * Implement an `ExportFormatter` interface and supporting types that:
 * 1. Defines a clear contract via `ExportFormatterInterface`
 * 2. Uses `ExportFormat` type for supported output formats
 * 3. Provides `ExportOptions` for flexible configuration
 * 4. Returns structured `ExportResult` with metadata
 * 5. Follows existing patterns from validation and error-formatter modules
 *
 * ### Consequences
 * - Consistent export formatting across all format implementations
 * - Easy to add new format support via concrete implementations
 * - Export results can be used for file writing, streaming, or direct display
 * - Extensible architecture for future export requirements
 *
 * @module @apex/core/export/types
 */

import { z } from 'zod';

// ============================================================================
// Export Formats
// ============================================================================

/**
 * Supported export formats.
 * This list can be extended as new format exporters are implemented.
 *
 * @example
 * ```typescript
 * const format: ExportFormat = 'json';
 * const validFormat = ExportFormatSchema.parse('markdown');
 * ```
 */
export const ExportFormatSchema = z.enum([
  'json',         // JSON format (with optional pretty-printing)
  'jsonl',        // JSON Lines format (one JSON object per line)
  'yaml',         // YAML format
  'toml',         // TOML format
  'markdown',     // Markdown format
  'html',         // HTML format
  'csv',          // CSV (Comma-Separated Values)
  'tsv',          // TSV (Tab-Separated Values)
  'xml',          // XML format
  'text',         // Plain text format
  'table',        // ASCII/Unicode table format (for terminal display)
]);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

/**
 * File extensions corresponding to each export format
 */
export const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  json: '.json',
  jsonl: '.jsonl',
  yaml: '.yaml',
  toml: '.toml',
  markdown: '.md',
  html: '.html',
  csv: '.csv',
  tsv: '.tsv',
  xml: '.xml',
  text: '.txt',
  table: '.txt',
};

/**
 * MIME types corresponding to each export format
 */
export const FORMAT_MIME_TYPES: Record<ExportFormat, string> = {
  json: 'application/json',
  jsonl: 'application/x-ndjson',
  yaml: 'application/x-yaml',
  toml: 'application/toml',
  markdown: 'text/markdown',
  html: 'text/html',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  xml: 'application/xml',
  text: 'text/plain',
  table: 'text/plain',
};

// ============================================================================
// Export Options
// ============================================================================

/**
 * Common options for all export operations.
 *
 * @example
 * ```typescript
 * const options: ExportOptions = {
 *   format: 'json',
 *   pretty: true,
 *   includeMetadata: true,
 *   maxDepth: 10,
 * };
 * ```
 */
export const ExportOptionsSchema = z.object({
  /** Target export format */
  format: ExportFormatSchema,

  /** Whether to include formatting/indentation for readability */
  pretty: z.boolean().optional().default(true),

  /** Indentation string or number of spaces (for formats that support it) */
  indent: z.union([z.string(), z.number().int().min(0)]).optional().default(2),

  /** Whether to include export metadata in the output */
  includeMetadata: z.boolean().optional().default(false),

  /** Maximum depth for nested structures (0 = unlimited) */
  maxDepth: z.number().int().min(0).optional().default(0),

  /** Maximum number of items in arrays/collections (0 = unlimited) */
  maxItems: z.number().int().min(0).optional().default(0),

  /** Fields to include in export (empty = all fields) */
  includeFields: z.array(z.string()).optional().default([]),

  /** Fields to exclude from export */
  excludeFields: z.array(z.string()).optional().default([]),

  /** Whether to sort object keys alphabetically */
  sortKeys: z.boolean().optional().default(false),

  /** Whether to include null/undefined values */
  includeNulls: z.boolean().optional().default(true),

  /** Whether to include empty strings/arrays/objects */
  includeEmpty: z.boolean().optional().default(true),

  /** Custom date format string (for formats that support it) */
  dateFormat: z.string().optional(),

  /** Timezone for date formatting */
  timezone: z.string().optional(),

  /** Encoding for output (mainly for text-based formats) */
  encoding: z.enum(['utf-8', 'utf-16', 'ascii', 'latin1']).optional().default('utf-8'),

  /** Line ending style */
  lineEnding: z.enum(['lf', 'crlf', 'cr']).optional().default('lf'),

  /** Custom headers for CSV/TSV export */
  headers: z.array(z.string()).optional(),

  /** Delimiter for CSV export (default: comma) */
  delimiter: z.string().optional(),

  /** Whether to quote all values in CSV/TSV */
  quoteAll: z.boolean().optional().default(false),

  /** Template name or path for format-specific templates */
  template: z.string().optional(),

  /** Custom CSS classes for HTML export */
  cssClasses: z.record(z.string(), z.string()).optional(),

  /** Title for HTML/Markdown documents */
  title: z.string().optional(),

  /** Description for document metadata */
  description: z.string().optional(),

  /** XML root element name */
  xmlRootElement: z.string().optional().default('root'),

  /** XML attribute prefix for JSON-to-XML conversion */
  xmlAttributePrefix: z.string().optional().default('@'),

  /** Timeout in milliseconds for export operation */
  timeout: z.number().int().min(0).optional(),

  /** Abort signal for cancellation support */
  signal: z.instanceof(AbortSignal).optional(),

  /** Custom options for format-specific settings */
  custom: z.record(z.string(), z.unknown()).optional(),
});
export type ExportOptions = z.infer<typeof ExportOptionsSchema>;

/**
 * Partial export options for convenience
 */
export type PartialExportOptions = Partial<z.input<typeof ExportOptionsSchema>>;

// ============================================================================
// Export Result
// ============================================================================

/**
 * Export operation status
 */
export const ExportStatusSchema = z.enum([
  'success',      // Export completed successfully
  'partial',      // Export completed with some data truncated/skipped
  'error',        // Export failed
  'cancelled',    // Export was cancelled
]);
export type ExportStatus = z.infer<typeof ExportStatusSchema>;

/**
 * Warning or info about the export operation
 */
export const ExportWarningSchema = z.object({
  /** Warning code for programmatic handling */
  code: z.string().min(1),
  /** Human-readable warning message */
  message: z.string().min(1),
  /** Path to the affected data (if applicable) */
  path: z.string().optional(),
  /** Additional details */
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ExportWarning = z.infer<typeof ExportWarningSchema>;

/**
 * Result of an export operation.
 *
 * @example
 * ```typescript
 * const result: ExportResult = {
 *   status: 'success',
 *   content: '{"name": "test"}',
 *   format: 'json',
 *   byteSize: 16,
 *   itemCount: 1,
 *   duration: 5,
 *   warnings: [],
 * };
 * ```
 */
export const ExportResultSchema = z.object({
  /** Status of the export operation */
  status: ExportStatusSchema,

  /** Exported content as string */
  content: z.string(),

  /** Format that was used for export */
  format: ExportFormatSchema,

  /** Size of the exported content in bytes */
  byteSize: z.number().int().min(0),

  /** Number of items/records exported */
  itemCount: z.number().int().min(0).optional(),

  /** Export duration in milliseconds */
  duration: z.number().min(0).optional(),

  /** Warnings generated during export */
  warnings: z.array(ExportWarningSchema).optional().default([]),

  /** Error message if status is 'error' */
  error: z.string().optional(),

  /** Stack trace if status is 'error' and available */
  errorStack: z.string().optional(),

  /** Metadata about the export */
  metadata: z.object({
    /** Timestamp when export was created */
    exportedAt: z.date().optional(),
    /** Source of the data (e.g., session ID, file path) */
    source: z.string().optional(),
    /** Version of the exporter used */
    exporterVersion: z.string().optional(),
    /** Schema version of the exported data */
    schemaVersion: z.string().optional(),
    /** Additional custom metadata */
    custom: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
});
export type ExportResult = z.infer<typeof ExportResultSchema>;

// ============================================================================
// Export Formatter Interface
// ============================================================================

/**
 * Interface defining the contract for export formatters.
 *
 * Export formatters are responsible for converting data to a specific output format.
 * They should:
 * - Support one or more output formats
 * - Handle various data types consistently
 * - Apply export options appropriately
 * - Return structured results with metadata
 *
 * @example
 * ```typescript
 * class JsonExporter implements ExportFormatterInterface {
 *   getSupportedFormats(): ExportFormat[] {
 *     return ['json', 'jsonl'];
 *   }
 *
 *   supportsFormat(format: string): boolean {
 *     return ['json', 'jsonl'].includes(format);
 *   }
 *
 *   async export(
 *     data: unknown,
 *     options: ExportOptions
 *   ): Promise<ExportResult> {
 *     const content = JSON.stringify(data, null, options.pretty ? 2 : 0);
 *     return {
 *       status: 'success',
 *       content,
 *       format: options.format,
 *       byteSize: Buffer.byteLength(content, 'utf-8'),
 *       warnings: [],
 *     };
 *   }
 * }
 * ```
 */
export interface ExportFormatterInterface {
  /**
   * Returns the list of formats this exporter can handle.
   *
   * @returns Array of supported format identifiers
   */
  getSupportedFormats(): ExportFormat[];

  /**
   * Checks if this exporter supports a specific format.
   *
   * @param format - Format identifier to check
   * @returns true if the format is supported, false otherwise
   */
  supportsFormat(format: string): boolean;

  /**
   * Exports data to the specified format.
   *
   * This is the main export method. It should:
   * - Validate and prepare the data
   * - Apply formatting options
   * - Handle errors gracefully
   * - Return a structured result
   *
   * @param data - The data to export
   * @param options - Export configuration options
   * @returns A promise resolving to the export result
   */
  export(data: unknown, options: ExportOptions): Promise<ExportResult>;
}

// ============================================================================
// Base Export Formatter Options
// ============================================================================

/**
 * Options for configuring a BaseExportFormatter instance.
 */
export interface BaseExportFormatterOptions {
  /** Human-readable name for this formatter */
  name: string;

  /** Description of what this formatter does */
  description?: string;

  /** Formats this formatter supports */
  formats: ExportFormat[];

  /** Default export options */
  defaultOptions?: PartialExportOptions;

  /** Version string for the formatter */
  version?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a string is a valid export format
 *
 * @param format - String to check
 * @returns true if the string is a valid ExportFormat
 */
export function isExportFormat(format: string): format is ExportFormat {
  return ExportFormatSchema.safeParse(format).success;
}

/**
 * Type guard to check if an object implements ExportFormatterInterface
 *
 * @param obj - Object to check
 * @returns true if the object implements ExportFormatterInterface
 */
export function isExportFormatter(obj: unknown): obj is ExportFormatterInterface {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'getSupportedFormats' in obj &&
    typeof (obj as ExportFormatterInterface).getSupportedFormats === 'function' &&
    'supportsFormat' in obj &&
    typeof (obj as ExportFormatterInterface).supportsFormat === 'function' &&
    'export' in obj &&
    typeof (obj as ExportFormatterInterface).export === 'function'
  );
}

/**
 * Type guard to check if an ExportResult indicates success
 *
 * @param result - Export result to check
 * @returns true if the export was successful
 */
export function isSuccessfulExport(result: ExportResult): boolean {
  return result.status === 'success' || result.status === 'partial';
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the file extension for a given export format
 *
 * @param format - Export format
 * @returns File extension including the dot (e.g., '.json')
 */
export function getFormatExtension(format: ExportFormat): string {
  return FORMAT_EXTENSIONS[format];
}

/**
 * Get the MIME type for a given export format
 *
 * @param format - Export format
 * @returns MIME type string
 */
export function getFormatMimeType(format: ExportFormat): string {
  return FORMAT_MIME_TYPES[format];
}

/**
 * Create default export options for a given format
 *
 * @param format - Target export format
 * @param overrides - Optional overrides for default options
 * @returns Complete export options
 */
export function createExportOptions(
  format: ExportFormat,
  overrides?: PartialExportOptions
): ExportOptions {
  return ExportOptionsSchema.parse({
    format,
    ...overrides,
  });
}

/**
 * Create a successful export result
 *
 * @param content - Exported content
 * @param format - Format used
 * @param options - Additional result options
 * @returns Complete export result
 */
export function createSuccessResult(
  content: string,
  format: ExportFormat,
  options?: Partial<Omit<ExportResult, 'status' | 'content' | 'format' | 'byteSize'>>
): ExportResult {
  return {
    status: 'success',
    content,
    format,
    byteSize: Buffer.byteLength(content, 'utf-8'),
    warnings: [],
    ...options,
  };
}

/**
 * Create an error export result
 *
 * @param format - Format that was attempted
 * @param error - Error message or Error object
 * @returns Error export result
 */
export function createErrorResult(
  format: ExportFormat,
  error: string | Error
): ExportResult {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  return {
    status: 'error',
    content: '',
    format,
    byteSize: 0,
    warnings: [],
    error: errorMessage,
    errorStack,
  };
}

/**
 * Create a cancelled export result
 *
 * @param format - Format that was attempted
 * @returns Cancelled export result
 */
export function createCancelledResult(format: ExportFormat): ExportResult {
  return {
    status: 'cancelled',
    content: '',
    format,
    byteSize: 0,
    warnings: [],
  };
}
