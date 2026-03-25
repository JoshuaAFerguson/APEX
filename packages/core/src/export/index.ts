/**
 * @fileoverview Export module exports
 *
 * This module exports the core export formatting infrastructure for APEX,
 * including interfaces, types, and utility functions for data export
 * in various formats (JSON, Markdown, CSV, HTML, etc.).
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   ExportFormat,
 *   ExportOptions,
 *   ExportResult,
 *   ExportFormatterInterface,
 *   createExportOptions,
 *   isExportFormat,
 * } from '@apexcli/core/export';
 *
 * // Create export options
 * const options = createExportOptions('json', { pretty: true });
 *
 * // Check if a format is valid
 * if (isExportFormat('yaml')) {
 *   console.log('YAML is supported!');
 * }
 * ```
 *
 * @module @apex/core/export
 */

// Types and interfaces
export {
  // Format type and schema
  ExportFormatSchema,
  type ExportFormat,

  // Format constants
  FORMAT_EXTENSIONS,
  FORMAT_MIME_TYPES,

  // Options type and schema
  ExportOptionsSchema,
  type ExportOptions,
  type PartialExportOptions,

  // Result types and schemas
  ExportStatusSchema,
  type ExportStatus,
  ExportWarningSchema,
  type ExportWarning,
  ExportResultSchema,
  type ExportResult,

  // Interface types
  type ExportFormatterInterface,
  type BaseExportFormatterOptions,

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
} from './types.js';

// Formatter functions
export {
  formatTasksToJSON,
  type TaskExportDocument,
  type ExportedTask,
} from './json-formatter.js';

// CSV Formatter
export {
  formatTasksToCSV,
  type CSVExportOptions,
  type CSVTaskRow,
  type NestedDataStrategy,
} from './csv-formatter.js';

// Markdown Formatter
export {
  formatTasksToMarkdown,
  type MarkdownExportOptions,
  type MarkdownLayoutStrategy,
  type SectionStrategy,
} from './markdown-formatter.js';
