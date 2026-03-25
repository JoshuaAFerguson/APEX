/**
 * @fileoverview CSV Task Export Formatter Implementation
 *
 * This module provides a comprehensive CSV formatter for exporting Task data with
 * configurable options for handling nested data structures like logs, metrics,
 * and artifacts. It implements the architecture defined in ADR-020.
 *
 * ## Architecture Decision Record (ADR-020)
 *
 * ### Context
 * APEX needs CSV export capability for Task data to enable:
 * - Importing task data into spreadsheet applications (Excel, Google Sheets)
 * - Integration with data analysis tools and pipelines
 * - Generating tabular reports for stakeholders
 * - Supporting batch processing and data warehousing scenarios
 *
 * ### Decision
 * Implement `formatTasksToCSV` function that:
 * 1. Follows the same pattern as `formatTasksToJSON` for consistency
 * 2. Handles nested data (logs, metrics, artifacts) via configurable flattening strategies
 * 3. Supports CSV-specific options (delimiter, quoting, headers)
 * 4. Properly escapes special characters per RFC 4180
 * 5. Provides multiple strategies for nested data: count, summary, flatten, or JSON
 *
 * ### Nested Data Handling Strategies
 * - `count`: Shows count of nested items (e.g., "5 logs")
 * - `summary`: Shows brief summary (e.g., "3 errors, 2 warnings")
 * - `flatten`: Creates separate columns for each nested item up to maxItems
 * - `json`: Embeds nested data as JSON string in single column
 * - `omit`: Excludes nested data entirely
 *
 * ### Consequences
 * - CSV output is compatible with RFC 4180 standard
 * - Nested data is handled gracefully without breaking CSV structure
 * - Users can choose appropriate strategy based on their needs
 * - Output is suitable for import into spreadsheet applications
 *
 * @module @apex/core/export/csv-formatter
 */

import type {
  Task,
  TaskLog,
  TaskArtifact,
  TaskUsage,
} from '../types.js';
import type {
  ExportOptions,
  PartialExportOptions,
} from './types.js';
import { createExportOptions } from './types.js';

// ============================================================================
// CSV-Specific Types
// ============================================================================

/**
 * Strategy for handling nested data in CSV export
 */
export type NestedDataStrategy = 'count' | 'summary' | 'flatten' | 'json' | 'omit';

/**
 * CSV-specific export options extending base export options
 */
export interface CSVExportOptions extends PartialExportOptions {
  /** Strategy for handling nested logs array */
  logsStrategy?: NestedDataStrategy;
  /** Strategy for handling nested artifacts array */
  artifactsStrategy?: NestedDataStrategy;
  /** Strategy for handling usage metrics object */
  usageStrategy?: 'inline' | 'flatten' | 'json';
  /** Whether to include a header row */
  includeHeader?: boolean;
  /** Maximum number of items to include when using 'flatten' strategy */
  flattenLimit?: number;
}

/**
 * Merged options type combining base export options with CSV-specific options
 */
interface MergedCSVOptions extends ExportOptions {
  logsStrategy: NestedDataStrategy;
  artifactsStrategy: NestedDataStrategy;
  usageStrategy: 'inline' | 'flatten' | 'json';
  includeHeader: boolean;
  flattenLimit: number;
}

/**
 * Exported task row representation for CSV
 */
export interface CSVTaskRow {
  [key: string]: string | number | boolean | null | undefined;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default export options for CSV formatting
 */
const DEFAULT_CSV_OPTIONS: CSVExportOptions = {
  format: 'csv',
  pretty: false,
  delimiter: ',',
  quoteAll: false,
  includeNulls: true,
  includeEmpty: true,
  maxItems: 0,
  includeFields: [],
  excludeFields: [],
  logsStrategy: 'count',
  artifactsStrategy: 'count',
  usageStrategy: 'inline',
  includeHeader: true,
  flattenLimit: 5,
};

/**
 * Column order for CSV export (maintains consistent output)
 */
const COLUMN_ORDER: string[] = [
  // Core identification
  'id',
  'description',
  'acceptanceCriteria',
  // Workflow & execution state
  'workflow',
  'autonomy',
  'status',
  'priority',
  'effort',
  'currentStage',
  // Project context
  'projectPath',
  'branchName',
  'prUrl',
  // Retry & resume state
  'retryCount',
  'maxRetries',
  'resumeAttempts',
  // Dependencies
  'dependsOn',
  'blockedBy',
  // Subtask hierarchy
  'parentTaskId',
  'subtaskIds',
  'subtaskStrategy',
  // Execution flags
  'dryRun',
  // Timestamps
  'createdAt',
  'updatedAt',
  'completedAt',
  'pausedAt',
  'resumeAfter',
  'trashedAt',
  'archivedAt',
  'pauseReason',
  // Error
  'error',
];

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Formats an array of tasks to CSV string with full details
 *
 * This is the main export function that transforms Task objects into CSV format
 * suitable for spreadsheet applications and data analysis tools.
 *
 * @param tasks - Array of Task objects to export
 * @param options - Optional CSVExportOptions for formatting control
 * @returns CSV string representation of tasks
 * @throws {TypeError} if tasks is null/undefined or not an array
 * @throws {Error} if options validation fails
 *
 * @example
 * ```typescript
 * // Basic export
 * const csv = formatTasksToCSV([task1, task2]);
 *
 * // With custom options
 * const customCsv = formatTasksToCSV(tasks, {
 *   delimiter: ';',
 *   logsStrategy: 'summary',
 *   includeHeader: true,
 *   excludeFields: ['conversation', 'workspace']
 * });
 * ```
 */
export function formatTasksToCSV(
  tasks: Task[],
  options?: CSVExportOptions
): string {
  // 1. Validate inputs
  validateInput(tasks, options);

  // 2. Merge with defaults
  const mergedOptions = mergeOptions(options);

  // 3. Handle empty tasks array
  if (tasks.length === 0) {
    return mergedOptions.includeHeader ? buildHeaderRow(mergedOptions) : '';
  }

  // 4. Transform tasks to CSV rows
  const rows = tasks.map(task => transformTaskToRow(task, mergedOptions));

  // 5. Build column list based on actual data and options
  const columns = buildColumnList(rows, mergedOptions);

  // 6. Generate CSV output
  return generateCSV(rows, columns, mergedOptions);
}

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Validates the input parameters for the formatTasksToCSV function
 *
 * @param tasks - Tasks array to validate
 * @param options - Options object to validate
 * @throws {TypeError} if validation fails
 */
function validateInput(tasks: Task[], options?: CSVExportOptions): void {
  if (tasks == null) {
    throw new TypeError('Tasks parameter cannot be null or undefined');
  }

  if (!Array.isArray(tasks)) {
    throw new TypeError('Tasks parameter must be an array');
  }

  // Validate options if provided
  if (options) {
    if (options.flattenLimit !== undefined && options.flattenLimit < 0) {
      throw new Error('flattenLimit must be a non-negative number');
    }

    if (options.logsStrategy !== undefined &&
        !['count', 'summary', 'flatten', 'json', 'omit'].includes(options.logsStrategy)) {
      throw new Error('Invalid logsStrategy value');
    }

    if (options.artifactsStrategy !== undefined &&
        !['count', 'summary', 'flatten', 'json', 'omit'].includes(options.artifactsStrategy)) {
      throw new Error('Invalid artifactsStrategy value');
    }

    if (options.usageStrategy !== undefined &&
        !['inline', 'flatten', 'json'].includes(options.usageStrategy)) {
      throw new Error('Invalid usageStrategy value');
    }
  }
}

/**
 * Merges user options with defaults
 */
function mergeOptions(options?: CSVExportOptions): MergedCSVOptions {
  const baseOptions = createExportOptions('csv', {
    ...DEFAULT_CSV_OPTIONS,
    ...options,
  });

  return {
    ...baseOptions,
    logsStrategy: options?.logsStrategy ?? DEFAULT_CSV_OPTIONS.logsStrategy!,
    artifactsStrategy: options?.artifactsStrategy ?? DEFAULT_CSV_OPTIONS.artifactsStrategy!,
    usageStrategy: options?.usageStrategy ?? DEFAULT_CSV_OPTIONS.usageStrategy!,
    includeHeader: options?.includeHeader ?? DEFAULT_CSV_OPTIONS.includeHeader!,
    flattenLimit: options?.flattenLimit ?? DEFAULT_CSV_OPTIONS.flattenLimit!,
  };
}

// ============================================================================
// Task Transformation
// ============================================================================

/**
 * Transforms a single task to a CSV row object
 *
 * @param task - Task object to transform
 * @param options - Validated export options
 * @returns Object with string keys and CSV-compatible values
 */
function transformTaskToRow(
  task: Task,
  options: MergedCSVOptions
): CSVTaskRow {
  let row: CSVTaskRow = {
    // Core identification
    id: task.id,
    description: task.description,
    acceptanceCriteria: task.acceptanceCriteria ?? null,

    // Workflow & execution state
    workflow: task.workflow,
    autonomy: task.autonomy,
    status: task.status,
    priority: task.priority,
    effort: task.effort,
    currentStage: task.currentStage ?? null,

    // Project context
    projectPath: task.projectPath,
    branchName: task.branchName ?? null,
    prUrl: task.prUrl ?? null,

    // Retry & resume state
    retryCount: task.retryCount,
    maxRetries: task.maxRetries,
    resumeAttempts: task.resumeAttempts,

    // Dependencies (arrays to strings)
    dependsOn: serializeArray(task.dependsOn),
    blockedBy: serializeArray(task.blockedBy),

    // Subtask hierarchy
    parentTaskId: task.parentTaskId ?? null,
    subtaskIds: serializeArray(task.subtaskIds),
    subtaskStrategy: task.subtaskStrategy ?? null,

    // Execution flags
    dryRun: task.dryRun ?? false,

    // Timestamps
    createdAt: serializeDate(task.createdAt),
    updatedAt: serializeDate(task.updatedAt),
    completedAt: task.completedAt ? serializeDate(task.completedAt) : null,
    pausedAt: task.pausedAt ? serializeDate(task.pausedAt) : null,
    resumeAfter: task.resumeAfter ? serializeDate(task.resumeAfter) : null,
    trashedAt: task.trashedAt ? serializeDate(task.trashedAt) : null,
    archivedAt: task.archivedAt ? serializeDate(task.archivedAt) : null,
    pauseReason: task.pauseReason ?? null,

    // Error
    error: task.error ?? null,
  };

  // Handle usage metrics
  row = addUsageMetrics(row, task.usage, options);

  // Handle logs
  row = addNestedLogs(row, task.logs, options);

  // Handle artifacts
  row = addNestedArtifacts(row, task.artifacts, options);

  // Apply field filtering
  row = filterFields(row, options);

  // Remove empty/null values if configured
  if (!options.includeEmpty) {
    row = removeEmptyValues(row);
  }
  if (!options.includeNulls) {
    row = removeNullValues(row);
  }

  return row;
}

/**
 * Adds usage metrics to the row based on strategy
 */
function addUsageMetrics(
  row: CSVTaskRow,
  usage: TaskUsage,
  options: MergedCSVOptions
): CSVTaskRow {
  switch (options.usageStrategy) {
    case 'inline':
      // Add usage fields directly to row
      row.inputTokens = usage.inputTokens;
      row.outputTokens = usage.outputTokens;
      row.totalTokens = usage.totalTokens;
      row.estimatedCost = usage.estimatedCost;
      row.totalCostCents = usage.totalCostCents;
      row.executionTimeMs = usage.executionTimeMs;
      break;

    case 'flatten':
      // Same as inline with prefixed names
      row['usage.inputTokens'] = usage.inputTokens;
      row['usage.outputTokens'] = usage.outputTokens;
      row['usage.totalTokens'] = usage.totalTokens;
      row['usage.estimatedCost'] = usage.estimatedCost;
      row['usage.totalCostCents'] = usage.totalCostCents;
      row['usage.executionTimeMs'] = usage.executionTimeMs;
      break;

    case 'json':
      row.usage = JSON.stringify(usage);
      break;
  }

  return row;
}

/**
 * Adds nested logs to the row based on strategy
 */
function addNestedLogs(
  row: CSVTaskRow,
  logs: TaskLog[],
  options: MergedCSVOptions
): CSVTaskRow {
  switch (options.logsStrategy) {
    case 'count':
      row.logsCount = logs.length;
      break;

    case 'summary':
      row.logsSummary = summarizeLogs(logs);
      break;

    case 'flatten':
      const flattenLimit = options.flattenLimit;
      for (let i = 0; i < Math.min(logs.length, flattenLimit); i++) {
        const log = logs[i];
        row[`log_${i + 1}_level`] = log.level;
        row[`log_${i + 1}_message`] = log.message;
        row[`log_${i + 1}_timestamp`] = serializeDate(log.timestamp);
      }
      if (logs.length > flattenLimit) {
        row.logsRemaining = logs.length - flattenLimit;
      }
      break;

    case 'json':
      row.logs = JSON.stringify(logs.map(log => ({
        timestamp: serializeDate(log.timestamp),
        level: log.level,
        stage: log.stage,
        agent: log.agent,
        message: log.message,
        metadata: log.metadata,
      })));
      break;

    case 'omit':
      // Don't add any log columns
      break;
  }

  return row;
}

/**
 * Adds nested artifacts to the row based on strategy
 */
function addNestedArtifacts(
  row: CSVTaskRow,
  artifacts: TaskArtifact[],
  options: MergedCSVOptions
): CSVTaskRow {
  switch (options.artifactsStrategy) {
    case 'count':
      row.artifactsCount = artifacts.length;
      break;

    case 'summary':
      row.artifactsSummary = summarizeArtifacts(artifacts);
      break;

    case 'flatten':
      const flattenLimit = options.flattenLimit;
      for (let i = 0; i < Math.min(artifacts.length, flattenLimit); i++) {
        const artifact = artifacts[i];
        row[`artifact_${i + 1}_name`] = artifact.name;
        row[`artifact_${i + 1}_type`] = artifact.type;
        row[`artifact_${i + 1}_path`] = artifact.path ?? null;
      }
      if (artifacts.length > flattenLimit) {
        row.artifactsRemaining = artifacts.length - flattenLimit;
      }
      break;

    case 'json':
      row.artifacts = JSON.stringify(artifacts.map(artifact => ({
        name: artifact.name,
        type: artifact.type,
        path: artifact.path,
        createdAt: serializeDate(artifact.createdAt),
      })));
      break;

    case 'omit':
      // Don't add any artifact columns
      break;
  }

  return row;
}

// ============================================================================
// Summarization Helpers
// ============================================================================

/**
 * Creates a summary string for logs
 */
function summarizeLogs(logs: TaskLog[]): string {
  if (logs.length === 0) return 'No logs';

  const counts: Record<string, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
  };

  for (const log of logs) {
    // Safely increment count, defaulting to 0 if level is unknown
    const level = log.level as string;
    counts[level] = (counts[level] ?? 0) + 1;
  }

  const parts: string[] = [];
  if (counts.error > 0) parts.push(`${counts.error} error${counts.error > 1 ? 's' : ''}`);
  if (counts.warn > 0) parts.push(`${counts.warn} warning${counts.warn > 1 ? 's' : ''}`);
  if (counts.info > 0) parts.push(`${counts.info} info`);
  if (counts.debug > 0) parts.push(`${counts.debug} debug`);

  return parts.length > 0 ? parts.join(', ') : 'No logs';
}

/**
 * Creates a summary string for artifacts
 */
function summarizeArtifacts(artifacts: TaskArtifact[]): string {
  if (artifacts.length === 0) return 'No artifacts';

  const counts: Record<string, number> = {
    file: 0,
    diff: 0,
    report: 0,
    log: 0,
  };

  for (const artifact of artifacts) {
    // Safely increment count, defaulting to 0 if type is unknown
    const type = artifact.type as string;
    counts[type] = (counts[type] ?? 0) + 1;
  }

  const parts: string[] = [];
  if (counts.file > 0) parts.push(`${counts.file} file${counts.file > 1 ? 's' : ''}`);
  if (counts.diff > 0) parts.push(`${counts.diff} diff${counts.diff > 1 ? 's' : ''}`);
  if (counts.report > 0) parts.push(`${counts.report} report${counts.report > 1 ? 's' : ''}`);
  if (counts.log > 0) parts.push(`${counts.log} log${counts.log > 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(', ') : 'No artifacts';
}

// ============================================================================
// Field Filtering
// ============================================================================

/**
 * Filters row fields based on include/exclude options
 */
function filterFields(
  row: CSVTaskRow,
  options: MergedCSVOptions
): CSVTaskRow {
  let result = { ...row };

  // Apply include filter (if specified)
  if (options.includeFields.length > 0) {
    const filtered: CSVTaskRow = {};
    for (const field of options.includeFields) {
      if (field in result) {
        filtered[field] = result[field];
      }
    }
    result = filtered;
  }

  // Apply exclude filter
  if (options.excludeFields.length > 0) {
    for (const field of options.excludeFields) {
      delete result[field];
    }
  }

  return result;
}

/**
 * Removes empty strings, empty arrays from row
 */
function removeEmptyValues(row: CSVTaskRow): CSVTaskRow {
  const result: CSVTaskRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string' && value.trim() === '') continue;
    result[key] = value;
  }
  return result;
}

/**
 * Removes null and undefined values from row
 */
function removeNullValues(row: CSVTaskRow): CSVTaskRow {
  const result: CSVTaskRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== null && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

// ============================================================================
// CSV Generation
// ============================================================================

/**
 * Builds the list of columns to include in the CSV output
 */
function buildColumnList(
  rows: CSVTaskRow[],
  options: MergedCSVOptions
): string[] {
  // Collect all unique keys from all rows
  const allKeys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      allKeys.add(key);
    }
  }

  // Sort columns: prioritize COLUMN_ORDER, then alphabetically
  const columns: string[] = [];

  // Add columns in preferred order
  for (const col of COLUMN_ORDER) {
    if (allKeys.has(col)) {
      columns.push(col);
      allKeys.delete(col);
    }
  }

  // Add usage columns in order (if present)
  const usageColumns = [
    'inputTokens', 'outputTokens', 'totalTokens',
    'estimatedCost', 'totalCostCents', 'executionTimeMs',
    'usage.inputTokens', 'usage.outputTokens', 'usage.totalTokens',
    'usage.estimatedCost', 'usage.totalCostCents', 'usage.executionTimeMs',
    'usage'
  ];
  for (const col of usageColumns) {
    if (allKeys.has(col)) {
      columns.push(col);
      allKeys.delete(col);
    }
  }

  // Add remaining columns alphabetically
  const remaining = Array.from(allKeys).sort();
  columns.push(...remaining);

  return columns;
}

/**
 * Builds the header row for empty datasets
 */
function buildHeaderRow(options: MergedCSVOptions): string {
  // For empty datasets, use default column order filtered by options
  let columns = [...COLUMN_ORDER];

  // Add usage columns based on strategy
  if (options.usageStrategy === 'inline') {
    columns.push('inputTokens', 'outputTokens', 'totalTokens',
                 'estimatedCost', 'totalCostCents', 'executionTimeMs');
  } else if (options.usageStrategy === 'flatten') {
    columns.push('usage.inputTokens', 'usage.outputTokens', 'usage.totalTokens',
                 'usage.estimatedCost', 'usage.totalCostCents', 'usage.executionTimeMs');
  } else {
    columns.push('usage');
  }

  // Add nested data columns based on strategy
  if (options.logsStrategy === 'count') {
    columns.push('logsCount');
  } else if (options.logsStrategy === 'summary') {
    columns.push('logsSummary');
  }

  if (options.artifactsStrategy === 'count') {
    columns.push('artifactsCount');
  } else if (options.artifactsStrategy === 'summary') {
    columns.push('artifactsSummary');
  }

  // Apply field filtering
  if (options.includeFields.length > 0) {
    columns = columns.filter(c => options.includeFields.includes(c));
  }
  if (options.excludeFields.length > 0) {
    columns = columns.filter(c => !options.excludeFields.includes(c));
  }

  const delimiter = options.delimiter || ',';
  return columns.map(col => escapeCSVValue(col, delimiter, options.quoteAll)).join(delimiter);
}

/**
 * Generates the complete CSV output
 */
function generateCSV(
  rows: CSVTaskRow[],
  columns: string[],
  options: MergedCSVOptions
): string {
  const delimiter = options.delimiter || ',';
  const quoteAll = options.quoteAll;
  const lines: string[] = [];

  // Add header row
  if (options.includeHeader) {
    const headerLine = columns
      .map(col => escapeCSVValue(col, delimiter, quoteAll))
      .join(delimiter);
    lines.push(headerLine);
  }

  // Add data rows
  for (const row of rows) {
    const values = columns.map(col => {
      const value = row[col];
      return escapeCSVValue(formatValue(value), delimiter, quoteAll);
    });
    lines.push(values.join(delimiter));
  }

  // Use appropriate line ending
  const lineEnding = getLineEnding(options.lineEnding);
  return lines.join(lineEnding);
}

/**
 * Formats a value for CSV output
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return String(value);
}

/**
 * Escapes a value for CSV per RFC 4180
 *
 * Rules:
 * - If value contains delimiter, newline, or double quote, it must be quoted
 * - Double quotes within quoted fields are escaped by doubling them
 */
function escapeCSVValue(value: string, delimiter: string, quoteAll: boolean): string {
  const needsQuoting = quoteAll ||
    value.includes(delimiter) ||
    value.includes('\n') ||
    value.includes('\r') ||
    value.includes('"');

  if (needsQuoting) {
    // Escape double quotes by doubling them
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return value;
}

/**
 * Gets the line ending string based on option
 */
function getLineEnding(option: 'lf' | 'crlf' | 'cr'): string {
  switch (option) {
    case 'crlf': return '\r\n';
    case 'cr': return '\r';
    case 'lf':
    default: return '\n';
  }
}

// ============================================================================
// Serialization Helpers
// ============================================================================

/**
 * Serializes a Date to ISO 8601 string
 */
function serializeDate(date: Date): string {
  return date.toISOString();
}

/**
 * Serializes an array to a delimited string
 */
function serializeArray(arr: string[] | undefined): string {
  if (!arr || arr.length === 0) return '';
  return arr.join('; ');
}
