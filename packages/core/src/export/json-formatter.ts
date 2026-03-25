/**
 * @fileoverview JSON Task Export Formatter Implementation
 *
 * This module provides a comprehensive JSON formatter for exporting Task data with
 * full details including logs, metrics, artifacts, and metadata. It implements the
 * architecture defined in ADR-019.
 *
 * ## Key Features
 * - Full Task data export with all fields and relationships
 * - Configurable output formatting (pretty printing, indentation)
 * - Field filtering (include/exclude lists)
 * - Array limiting for large datasets
 * - Date standardization to ISO 8601 format
 * - Optional export metadata wrapper
 * - Type-safe implementation with full TypeScript support
 *
 * ## Usage
 *
 * ```typescript
 * import { formatTasksToJSON } from '@apex/core/export/json-formatter';
 *
 * // Basic usage - export with default formatting
 * const jsonOutput = formatTasksToJSON(tasks);
 *
 * // Custom formatting options
 * const prettyJson = formatTasksToJSON(tasks, {
 *   pretty: true,
 *   indent: 4,
 *   includeMetadata: true,
 *   maxItems: 100
 * });
 * ```
 *
 * @module @apex/core/export/json-formatter
 */

import type {
  Task,
  TaskLog,
  TaskArtifact,
  TaskUsage,
  AgentMessage,
  WorkspaceConfig,
  TaskSessionData,
  ThoughtCapture,
  IterationHistory,
  TaskPolicyCheckResult,
  ApprovalState,
  MultimodalContext,
  TaskStatus,
  TaskPriority,
  TaskEffort,
  AutonomyLevel,
  SubtaskStrategy,
} from '../types.js';
import type {
  ExportOptions,
  PartialExportOptions,
} from './types.js';
import { createExportOptions } from './types.js';

// ============================================================================
// Export Schema Types
// ============================================================================

/**
 * Schema for the complete JSON export document when includeMetadata is true
 */
export interface TaskExportDocument {
  /** Export metadata */
  metadata: {
    exportedAt: string;        // ISO 8601 timestamp
    version: string;           // Export schema version
    taskCount: number;         // Number of tasks exported
    format: 'json';            // Export format identifier
  };
  /** Exported task data */
  tasks: ExportedTask[];
}

/**
 * Exported task representation with standardized field names and formats
 */
export interface ExportedTask {
  // Core identification
  id: string;
  description: string;
  acceptanceCriteria?: string;

  // Workflow & execution state
  workflow: string;
  autonomy: AutonomyLevel;
  status: TaskStatus;
  priority: TaskPriority;
  effort: TaskEffort;
  currentStage?: string;

  // Project context
  projectPath: string;
  branchName?: string;
  prUrl?: string;

  // Retry & resume state
  retryCount: number;
  maxRetries: number;
  resumeAttempts: number;

  // Dependencies
  dependsOn?: string[];
  blockedBy?: string[];

  // Subtask hierarchy
  parentTaskId?: string;
  subtaskIds?: string[];
  subtaskStrategy?: SubtaskStrategy;

  // Execution flags
  dryRun?: boolean;

  // Timestamps (ISO 8601 format)
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  pausedAt?: string;
  resumeAfter?: string;
  trashedAt?: string;
  archivedAt?: string;
  pauseReason?: string;

  // Metrics & usage
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    totalCostCents: number;
    executionTimeMs: number;
  };

  // Execution logs
  logs: Array<{
    timestamp: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    stage?: string;
    agent?: string;
    message: string;
    metadata?: Record<string, unknown>;
  }>;

  // Generated artifacts
  artifacts: Array<{
    name: string;
    type: 'file' | 'diff' | 'report' | 'log';
    path?: string;
    content?: string;
    createdAt: string;
  }>;

  // Error state
  error?: string;

  // Optional extended data (controlled by includeMetadata option)
  conversation?: AgentMessage[];
  workspace?: WorkspaceConfig;
  sessionData?: TaskSessionData;
  thoughtCaptures?: ThoughtCapture[];
  iterationHistory?: IterationHistory;
  policyCheckResult?: TaskPolicyCheckResult;
  approvalState?: ApprovalState;
  multimodalContext?: MultimodalContext;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default export options for JSON formatting
 */
const DEFAULT_JSON_OPTIONS: PartialExportOptions = {
  format: 'json',
  pretty: true,
  indent: 2,
  includeMetadata: false,
  sortKeys: false,
  includeNulls: true,
  includeEmpty: true,
  maxDepth: 0,        // unlimited
  maxItems: 0,        // unlimited
  includeFields: [],  // all fields
  excludeFields: [],  // no exclusions
};

/**
 * Current export schema version
 */
const EXPORT_SCHEMA_VERSION = '1.0.0';

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Formats an array of tasks to JSON string with full details
 *
 * This is the main export function that transforms Task objects into a standardized
 * JSON format suitable for persistence, integration, or analysis. The function
 * applies various formatting options and handles complex data transformations.
 *
 * @param tasks - Array of Task objects to export
 * @param options - Optional ExportOptions for formatting control
 * @returns JSON string representation of tasks
 * @throws {TypeError} if tasks is null/undefined or not an array
 * @throws {Error} if options validation fails or serialization encounters circular references
 *
 * @example
 * ```typescript
 * // Basic export
 * const json = formatTasksToJSON([task1, task2]);
 *
 * // With custom options
 * const prettyJson = formatTasksToJSON(tasks, {
 *   pretty: true,
 *   indent: 4,
 *   includeMetadata: true,
 *   excludeFields: ['conversation', 'thoughtCaptures']
 * });
 * ```
 */
export function formatTasksToJSON(
  tasks: Task[],
  options?: PartialExportOptions
): string {
  // 1. Validate inputs
  validateInput(tasks, options);

  // 2. Merge with defaults and validate
  const mergedOptions = createExportOptions('json', {
    ...DEFAULT_JSON_OPTIONS,
    ...options,
  });

  // 3. Transform tasks to export format
  const transformedTasks = tasks.map(task =>
    transformTask(task, mergedOptions)
  );

  // 4. Build output structure
  const output = mergedOptions.includeMetadata
    ? buildDocumentWithMetadata(transformedTasks, mergedOptions)
    : transformedTasks;

  // 5. Serialize to JSON with formatting options
  return serializeToJSON(output, mergedOptions);
}

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Validates the input parameters for the formatTasksToJSON function
 *
 * @param tasks - Tasks array to validate
 * @param options - Options object to validate
 * @throws {TypeError} if validation fails
 */
function validateInput(tasks: Task[], options?: PartialExportOptions): void {
  if (tasks == null) {
    throw new TypeError('Tasks parameter cannot be null or undefined');
  }

  if (!Array.isArray(tasks)) {
    throw new TypeError('Tasks parameter must be an array');
  }

  // Note: options validation is handled by createExportOptions via Zod
}

// ============================================================================
// Task Transformation
// ============================================================================

/**
 * Transforms a single task to the export format with all specified options applied
 *
 * @param task - Task object to transform
 * @param options - Validated export options
 * @returns Transformed task object ready for serialization
 */
function transformTask(task: Task, options: ExportOptions): Record<string, unknown> {
  // Start with core task data and apply transformations
  let transformed: Record<string, unknown> = {
    // Core identification
    id: task.id,
    description: task.description,
    acceptanceCriteria: task.acceptanceCriteria,

    // Workflow & execution state
    workflow: task.workflow,
    autonomy: task.autonomy,
    status: task.status,
    priority: task.priority,
    effort: task.effort,
    currentStage: task.currentStage,

    // Project context
    projectPath: task.projectPath,
    branchName: task.branchName,
    prUrl: task.prUrl,

    // Retry & resume state
    retryCount: task.retryCount,
    maxRetries: task.maxRetries,
    resumeAttempts: task.resumeAttempts,

    // Dependencies
    dependsOn: task.dependsOn,
    blockedBy: task.blockedBy,

    // Subtask hierarchy
    parentTaskId: task.parentTaskId,
    subtaskIds: task.subtaskIds,
    subtaskStrategy: task.subtaskStrategy,

    // Execution flags
    dryRun: task.dryRun,

    // Timestamps (convert to ISO strings)
    createdAt: serializeDate(task.createdAt),
    updatedAt: serializeDate(task.updatedAt),
    completedAt: task.completedAt ? serializeDate(task.completedAt) : undefined,
    pausedAt: task.pausedAt ? serializeDate(task.pausedAt) : undefined,
    resumeAfter: task.resumeAfter ? serializeDate(task.resumeAfter) : undefined,
    trashedAt: task.trashedAt ? serializeDate(task.trashedAt) : undefined,
    archivedAt: task.archivedAt ? serializeDate(task.archivedAt) : undefined,
    pauseReason: task.pauseReason,

    // Metrics & usage
    usage: transformTaskUsage(task.usage),

    // Execution logs
    logs: limitArrays(transformTaskLogs(task.logs), options.maxItems),

    // Generated artifacts
    artifacts: limitArrays(transformTaskArtifacts(task.artifacts), options.maxItems),

    // Error state
    error: task.error,

    // Optional extended data
    conversation: task.conversation,
    workspace: task.workspace,
    sessionData: task.sessionData,
    thoughtCaptures: task.thoughtCaptures,
    iterationHistory: task.iterationHistory,
    policyCheckResult: task.policyCheckResult,
    approvalState: task.approvalState,
    multimodalContext: task.multimodalContext,
  };

  // Apply field filtering
  transformed = filterFields(transformed, options);

  // Remove empty values if configured
  if (!options.includeEmpty) {
    transformed = removeEmptyValues(transformed) as Record<string, unknown>;
  }

  // Remove null/undefined values if configured
  if (!options.includeNulls) {
    transformed = removeNullValues(transformed) as Record<string, unknown>;
  }

  // Sort keys if requested
  if (options.sortKeys) {
    transformed = sortObjectKeys(transformed) as Record<string, unknown>;
  }

  return transformed;
}

/**
 * Transforms TaskUsage object to export format
 */
function transformTaskUsage(usage: TaskUsage): Record<string, unknown> {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    estimatedCost: usage.estimatedCost,
    totalCostCents: usage.totalCostCents,
    executionTimeMs: usage.executionTimeMs,
  };
}

/**
 * Transforms TaskLog array to export format
 */
function transformTaskLogs(logs: TaskLog[]): Array<Record<string, unknown>> {
  return logs.map(log => ({
    timestamp: serializeDate(log.timestamp),
    level: log.level,
    stage: log.stage,
    agent: log.agent,
    message: log.message,
    metadata: log.metadata,
  }));
}

/**
 * Transforms TaskArtifact array to export format
 */
function transformTaskArtifacts(artifacts: TaskArtifact[]): Array<Record<string, unknown>> {
  return artifacts.map(artifact => ({
    name: artifact.name,
    type: artifact.type,
    path: artifact.path,
    content: artifact.content,
    createdAt: serializeDate(artifact.createdAt),
  }));
}

// ============================================================================
// Metadata Document Builder
// ============================================================================

/**
 * Builds a complete export document with metadata wrapper
 *
 * @param tasks - Transformed tasks array
 * @param options - Export options
 * @returns Complete export document with metadata
 */
function buildDocumentWithMetadata(
  tasks: unknown[],
  options: ExportOptions
): TaskExportDocument {
  return {
    metadata: {
      exportedAt: new Date().toISOString(),
      version: EXPORT_SCHEMA_VERSION,
      taskCount: tasks.length,
      format: 'json',
    },
    tasks: tasks as ExportedTask[],
  };
}

// ============================================================================
// JSON Serialization
// ============================================================================

/**
 * Serializes data to JSON string with formatting options applied
 *
 * @param data - Data to serialize
 * @param options - Export options controlling formatting
 * @returns JSON string
 */
function serializeToJSON(data: unknown, options: ExportOptions): string {
  try {
    if (options.pretty) {
      const indent = typeof options.indent === 'string' ? options.indent : ' '.repeat(options.indent);
      return JSON.stringify(data, null, indent);
    } else {
      return JSON.stringify(data);
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('circular')) {
      throw new Error('Failed to serialize tasks: circular reference detected');
    }
    throw new Error(`Failed to serialize tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Date Handling
// ============================================================================

/**
 * Serializes a Date object to ISO 8601 string
 *
 * @param date - Date to serialize
 * @returns ISO 8601 date string
 */
function serializeDate(date: Date): string {
  return date.toISOString();
}

// ============================================================================
// Data Filtering and Processing
// ============================================================================

/**
 * Filters object fields based on include/exclude options
 *
 * @param obj - Object to filter
 * @param options - Export options with field filters
 * @returns Filtered object
 */
function filterFields(obj: Record<string, unknown>, options: ExportOptions): Record<string, unknown> {
  let result = { ...obj };

  // Apply include filter (if specified)
  if (options.includeFields.length > 0) {
    const filtered: Record<string, unknown> = {};
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
 * Limits array length based on maxItems option
 *
 * @param arr - Array to potentially limit
 * @param maxItems - Maximum items to keep (0 = unlimited)
 * @returns Limited array
 */
function limitArrays<T>(arr: T[], maxItems: number): T[] {
  if (maxItems <= 0 || arr.length <= maxItems) {
    return arr;
  }
  return arr.slice(0, maxItems);
}

/**
 * Removes empty arrays, objects, and strings from object
 *
 * @param obj - Object to clean
 * @returns Object without empty values
 */
function removeEmptyValues(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    const cleaned = obj.map(removeEmptyValues).filter(item => {
      if (Array.isArray(item)) return item.length > 0;
      if (typeof item === 'object' && item !== null) return Object.keys(item as Record<string, unknown>).length > 0;
      if (typeof item === 'string') return item.trim() !== '';
      return true;
    });
    return cleaned;
  }

  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const cleanedValue = removeEmptyValues(value);

      // Skip empty values
      if (Array.isArray(cleanedValue) && cleanedValue.length === 0) continue;
      if (typeof cleanedValue === 'object' && cleanedValue !== null && Object.keys(cleanedValue as Record<string, unknown>).length === 0) continue;
      if (typeof cleanedValue === 'string' && cleanedValue.trim() === '') continue;

      cleaned[key] = cleanedValue;
    }
    return cleaned;
  }

  return obj;
}

/**
 * Removes null and undefined values from object
 *
 * @param obj - Object to clean
 * @returns Object without null/undefined values
 */
function removeNullValues(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  if (Array.isArray(obj)) {
    return obj.map(removeNullValues).filter(item => item !== undefined);
  }

  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const cleanedValue = removeNullValues(value);
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    }
    return cleaned;
  }

  return obj;
}

/**
 * Sorts object keys alphabetically
 *
 * @param obj - Object to sort
 * @returns Object with sorted keys
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  if (typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return obj;
}