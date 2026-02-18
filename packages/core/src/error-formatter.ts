/**
 * ErrorFormatter - Core types and utilities for structured error parsing and formatting
 *
 * This module provides:
 * - StructuredError: Parsed representation of an error with context
 * - ErrorContext: Metadata about where/when an error occurred
 * - FormattedErrorGroup: Collection of related errors for display
 * - ErrorFormatter: Class for parsing, grouping, and formatting errors
 *
 * @module error-formatter
 */

import { z } from 'zod';

// ============================================================================
// Error Severity and Categories
// ============================================================================

/**
 * Severity level of an error
 * Used for filtering and prioritizing error display
 */
export const ErrorSeveritySchema = z.enum([
  'error',      // Critical errors that prevent execution
  'warning',    // Non-critical issues that should be addressed
  'info',       // Informational messages
  'hint',       // Suggestions or recommendations
]);
export type ErrorSeverity = z.infer<typeof ErrorSeveritySchema>;

/**
 * Category of error for grouping and filtering
 * Helps organize errors by their source or nature
 */
export const ErrorCategorySchema = z.enum([
  'syntax',       // Syntax errors (parsing, compilation)
  'type',         // Type errors (TypeScript, type checking)
  'lint',         // Linting errors (ESLint, Prettier)
  'test',         // Test failures
  'runtime',      // Runtime errors
  'build',        // Build/compilation errors
  'dependency',   // Dependency resolution errors
  'config',       // Configuration errors
  'permission',   // Permission/access errors
  'network',      // Network-related errors
  'unknown',      // Unclassified errors
]);
export type ErrorCategory = z.infer<typeof ErrorCategorySchema>;

// ============================================================================
// Error Context
// ============================================================================

/**
 * Source location information for an error
 * Points to the exact location in source code where the error occurred
 */
export const ErrorLocationSchema = z.object({
  /** File path where the error occurred */
  file: z.string().optional(),
  /** Line number (1-based) */
  line: z.number().int().min(1).optional(),
  /** Column number (1-based) */
  column: z.number().int().min(1).optional(),
  /** End line for multi-line errors */
  endLine: z.number().int().min(1).optional(),
  /** End column for multi-line errors */
  endColumn: z.number().int().min(1).optional(),
});
export type ErrorLocation = z.infer<typeof ErrorLocationSchema>;

/**
 * Context information about when and where an error occurred
 * Provides metadata for error tracking and debugging
 */
export const ErrorContextSchema = z.object({
  /** Tool or command that produced the error */
  tool: z.string().optional(),
  /** Stage in the workflow where the error occurred */
  stage: z.string().optional(),
  /** Agent that encountered the error */
  agent: z.string().optional(),
  /** Task ID associated with the error */
  taskId: z.string().optional(),
  /** Timestamp when the error occurred */
  timestamp: z.date().optional(),
  /** Working directory when the error occurred */
  workingDir: z.string().optional(),
  /** Command or operation that was being executed */
  command: z.string().optional(),
  /** Exit code if applicable */
  exitCode: z.number().int().optional(),
  /** Additional metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ErrorContext = z.infer<typeof ErrorContextSchema>;

// ============================================================================
// Structured Error
// ============================================================================

/**
 * A parsed and structured representation of an error
 * Normalizes errors from various sources into a consistent format
 */
export const StructuredErrorSchema = z.object({
  /** Unique identifier for this error instance */
  id: z.string(),
  /** Human-readable error message */
  message: z.string(),
  /** Error severity level */
  severity: ErrorSeveritySchema,
  /** Error category for grouping */
  category: ErrorCategorySchema,
  /** Source location information */
  location: ErrorLocationSchema.optional(),
  /** Context about when/where the error occurred */
  context: ErrorContextSchema.optional(),
  /** Error code if available (e.g., TS2339, ESLint rule name) */
  code: z.string().optional(),
  /** Original raw error text before parsing */
  rawText: z.string().optional(),
  /** Stack trace if available */
  stack: z.string().optional(),
  /** Related errors (e.g., caused by, see also) */
  relatedErrors: z.array(z.string()).optional(),
  /** Suggested fix or action */
  suggestion: z.string().optional(),
  /** Documentation or help URL */
  helpUrl: z.string().url().optional(),
});
export type StructuredError = z.infer<typeof StructuredErrorSchema>;

// ============================================================================
// Formatted Error Group
// ============================================================================

/**
 * Group key for organizing errors
 * Defines how errors should be grouped together
 */
export const ErrorGroupKeySchema = z.enum([
  'file',       // Group by file path
  'category',   // Group by error category
  'severity',   // Group by severity level
  'tool',       // Group by tool that produced the error
  'code',       // Group by error code
  'stage',      // Group by workflow stage
]);
export type ErrorGroupKey = z.infer<typeof ErrorGroupKeySchema>;

/**
 * A collection of related errors grouped for display
 * Used for presenting errors in an organized manner
 */
export const FormattedErrorGroupSchema = z.object({
  /** Group identifier (e.g., file path, category name) */
  key: z.string(),
  /** Type of grouping used */
  groupBy: ErrorGroupKeySchema,
  /** Human-readable title for the group */
  title: z.string(),
  /** Errors in this group */
  errors: z.array(StructuredErrorSchema),
  /** Summary statistics for the group */
  summary: z.object({
    /** Total number of errors in the group */
    total: z.number().int().min(0),
    /** Count by severity */
    bySeverity: z.record(ErrorSeveritySchema, z.number().int().min(0)),
    /** Count by category */
    byCategory: z.record(ErrorCategorySchema, z.number().int().min(0)).optional(),
  }),
  /** Whether the group has been collapsed in display */
  collapsed: z.boolean().optional().default(false),
});
export type FormattedErrorGroup = z.infer<typeof FormattedErrorGroupSchema>;

// ============================================================================
// Error Formatter Options
// ============================================================================

/**
 * Output format for formatted errors
 */
export const ErrorOutputFormatSchema = z.enum([
  'text',       // Plain text format
  'ansi',       // ANSI-colored terminal output
  'json',       // JSON format
  'markdown',   // Markdown format
  'html',       // HTML format
]);
export type ErrorOutputFormat = z.infer<typeof ErrorOutputFormatSchema>;

/**
 * Options for parsing errors
 */
export const ErrorParseOptionsSchema = z.object({
  /** Default context to apply to parsed errors */
  defaultContext: ErrorContextSchema.optional(),
  /** Whether to attempt to extract location from message */
  extractLocation: z.boolean().optional().default(true),
  /** Whether to deduplicate identical errors */
  deduplicate: z.boolean().optional().default(true),
  /** Maximum number of errors to parse (0 = unlimited) */
  maxErrors: z.number().int().min(0).optional().default(0),
});
export type ErrorParseOptions = z.infer<typeof ErrorParseOptionsSchema>;

/**
 * Options for grouping errors
 */
export const ErrorGroupOptionsSchema = z.object({
  /** How to group errors */
  groupBy: ErrorGroupKeySchema.optional().default('file'),
  /** Whether to sort groups alphabetically */
  sortGroups: z.boolean().optional().default(true),
  /** Whether to sort errors within groups by severity */
  sortBySeverity: z.boolean().optional().default(true),
  /** Minimum errors required to form a group (others go to "Other") */
  minGroupSize: z.number().int().min(1).optional().default(1),
});
export type ErrorGroupOptions = z.infer<typeof ErrorGroupOptionsSchema>;

/**
 * Options for formatting error output
 */
export const ErrorFormatOptionsSchema = z.object({
  /** Output format */
  format: ErrorOutputFormatSchema.optional().default('text'),
  /** Whether to include source code context */
  includeContext: z.boolean().optional().default(true),
  /** Number of lines of context to show around error */
  contextLines: z.number().int().min(0).optional().default(2),
  /** Whether to show error codes */
  showCodes: z.boolean().optional().default(true),
  /** Whether to show suggestions */
  showSuggestions: z.boolean().optional().default(true),
  /** Whether to show full stack traces */
  showStackTraces: z.boolean().optional().default(false),
  /** Whether to colorize output (for ansi format) */
  colors: z.boolean().optional().default(true),
  /** Maximum message length before truncation (0 = no truncation) */
  maxMessageLength: z.number().int().min(0).optional().default(0),
  /** Whether to show summary at the end */
  showSummary: z.boolean().optional().default(true),
});
export type ErrorFormatOptions = z.infer<typeof ErrorFormatOptionsSchema>;

// ============================================================================
// Error Formatter Class
// ============================================================================

/**
 * ErrorFormatter - Parses, groups, and formats errors from various sources
 *
 * This class provides a unified interface for handling errors from different
 * tools (TypeScript, ESLint, Jest, etc.) and presenting them in a consistent,
 * readable format.
 *
 * @example
 * ```typescript
 * const formatter = new ErrorFormatter();
 *
 * // Parse raw error output
 * const errors = formatter.parse(rawOutput, { defaultContext: { tool: 'typescript' } });
 *
 * // Group errors by file
 * const groups = formatter.group(errors, { groupBy: 'file' });
 *
 * // Format for display
 * const output = formatter.format(groups, { format: 'ansi', colors: true });
 * ```
 */
export class ErrorFormatter {
  private parseOptions: ErrorParseOptions;
  private groupOptions: ErrorGroupOptions;
  private formatOptions: ErrorFormatOptions;

  /**
   * Creates a new ErrorFormatter instance
   *
   * @param options - Default options for parsing, grouping, and formatting
   */
  constructor(options?: {
    parse?: ErrorParseOptions;
    group?: ErrorGroupOptions;
    format?: ErrorFormatOptions;
  }) {
    this.parseOptions = ErrorParseOptionsSchema.parse(options?.parse ?? {});
    this.groupOptions = ErrorGroupOptionsSchema.parse(options?.group ?? {});
    this.formatOptions = ErrorFormatOptionsSchema.parse(options?.format ?? {});
  }

  /**
   * Parse raw error output into structured errors
   *
   * Analyzes raw error text from tools and extracts structured information
   * including message, location, severity, and category.
   *
   * @param input - Raw error output string or array of strings
   * @param options - Options to override defaults for this parse operation
   * @returns Array of structured errors
   */
  parse(input: string | string[], options?: ErrorParseOptions): StructuredError[] {
    const _opts = { ...this.parseOptions, ...options };
    // TODO: Implement parsing logic for various error formats
    // - TypeScript errors (TS####)
    // - ESLint errors (rule names)
    // - Jest test failures
    // - Generic stack traces
    // - Build tool output
    void _opts;
    void input;
    return [];
  }

  /**
   * Group structured errors by a specified key
   *
   * Organizes errors into groups for easier navigation and display.
   * Groups can be sorted and filtered based on options.
   *
   * @param errors - Array of structured errors to group
   * @param options - Options to override defaults for this group operation
   * @returns Array of formatted error groups
   */
  group(errors: StructuredError[], options?: ErrorGroupOptions): FormattedErrorGroup[] {
    const _opts = { ...this.groupOptions, ...options };
    // TODO: Implement grouping logic
    // - Group by file, category, severity, tool, etc.
    // - Calculate summary statistics
    // - Sort groups and errors within groups
    void _opts;
    void errors;
    return [];
  }

  /**
   * Format error groups into a displayable output
   *
   * Converts grouped errors into a formatted string suitable for
   * terminal display, file output, or other uses.
   *
   * @param groups - Array of error groups to format
   * @param options - Options to override defaults for this format operation
   * @returns Formatted error output string
   */
  format(groups: FormattedErrorGroup[], options?: ErrorFormatOptions): string {
    const _opts = { ...this.formatOptions, ...options };
    // TODO: Implement formatting logic
    // - Plain text output
    // - ANSI-colored terminal output
    // - JSON output
    // - Markdown output
    // - HTML output
    void _opts;
    void groups;
    return '';
  }

  /**
   * Convenience method to parse, group, and format in one call
   *
   * @param input - Raw error output
   * @param options - Combined options for all operations
   * @returns Formatted error output string
   */
  formatErrors(
    input: string | string[],
    options?: {
      parse?: ErrorParseOptions;
      group?: ErrorGroupOptions;
      format?: ErrorFormatOptions;
    }
  ): string {
    const errors = this.parse(input, options?.parse);
    const groups = this.group(errors, options?.group);
    return this.format(groups, options?.format);
  }

  /**
   * Get default parse options
   */
  getParseOptions(): ErrorParseOptions {
    return { ...this.parseOptions };
  }

  /**
   * Get default group options
   */
  getGroupOptions(): ErrorGroupOptions {
    return { ...this.groupOptions };
  }

  /**
   * Get default format options
   */
  getFormatOptions(): ErrorFormatOptions {
    return { ...this.formatOptions };
  }

  /**
   * Update default parse options
   */
  setParseOptions(options: Partial<ErrorParseOptions>): void {
    this.parseOptions = ErrorParseOptionsSchema.parse({
      ...this.parseOptions,
      ...options,
    });
  }

  /**
   * Update default group options
   */
  setGroupOptions(options: Partial<ErrorGroupOptions>): void {
    this.groupOptions = ErrorGroupOptionsSchema.parse({
      ...this.groupOptions,
      ...options,
    });
  }

  /**
   * Update default format options
   */
  setFormatOptions(options: Partial<ErrorFormatOptions>): void {
    this.formatOptions = ErrorFormatOptionsSchema.parse({
      ...this.formatOptions,
      ...options,
    });
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique error ID
 *
 * @returns A unique identifier for an error instance
 */
export function generateErrorId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `err_${timestamp}_${random}`;
}

/**
 * Create a structured error from basic information
 *
 * @param message - Error message
 * @param options - Additional error properties
 * @returns A structured error object
 */
export function createStructuredError(
  message: string,
  options?: Partial<Omit<StructuredError, 'id' | 'message'>>
): StructuredError {
  return StructuredErrorSchema.parse({
    id: generateErrorId(),
    message,
    severity: options?.severity ?? 'error',
    category: options?.category ?? 'unknown',
    ...options,
  });
}

/**
 * Merge multiple error groups into one
 *
 * @param groups - Array of error groups to merge
 * @returns A single merged error group
 */
export function mergeErrorGroups(groups: FormattedErrorGroup[]): FormattedErrorGroup {
  if (groups.length === 0) {
    return {
      key: 'merged',
      groupBy: 'category',
      title: 'All Errors',
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
  }

  const allErrors = groups.flatMap((g) => g.errors);
  const bySeverity: Record<ErrorSeverity, number> = {
    error: 0,
    warning: 0,
    info: 0,
    hint: 0,
  };

  for (const error of allErrors) {
    bySeverity[error.severity]++;
  }

  return {
    key: 'merged',
    groupBy: groups[0].groupBy,
    title: 'All Errors',
    errors: allErrors,
    summary: {
      total: allErrors.length,
      bySeverity,
    },
    collapsed: false,
  };
}
