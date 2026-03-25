/**
 * @fileoverview Markdown Task Export Formatter Implementation
 *
 * This module provides a comprehensive Markdown formatter for exporting Task data with
 * configurable options for creating well-structured, human-readable documentation.
 * It implements the architecture defined in ADR-021.
 *
 * ## Architecture Decision Record (ADR-021)
 *
 * ### Context
 * APEX needs Markdown export capability for Task data to enable:
 * - Creating human-readable documentation and reports
 * - Generating project status updates and summaries
 * - Exporting task data for GitHub issues, wikis, and documentation
 * - Supporting integration with documentation systems and static site generators
 *
 * ### Decision
 * Implement `formatTasksToMarkdown` function that:
 * 1. Follows the same pattern as `formatTasksToJSON` and `formatTasksToCSV` for consistency
 * 2. Creates well-structured Markdown with tables, sections, and proper formatting
 * 3. Supports multiple layout strategies: table, list, detailed, and summary
 * 4. Handles nested data (logs, metrics, artifacts) with appropriate Markdown structures
 * 5. Provides options for customizing output format and content organization
 *
 * ### Layout Strategies
 * - `table`: Displays tasks in a Markdown table format (default)
 * - `list`: Shows tasks as a bulleted list with key information
 * - `detailed`: Full detailed view with sections for each task
 * - `summary`: Brief summary with essential information only
 *
 * ### Output Sections
 * 1. Document header with title and metadata (optional)
 * 2. Summary statistics and overview
 * 3. Tasks section with chosen layout
 * 4. Logs section (optional, configurable)
 * 5. Metrics section (optional, configurable)
 *
 * ### Consequences
 * - Markdown output is readable and suitable for documentation platforms
 * - Multiple layout options provide flexibility for different use cases
 * - Structured output with clear sections and proper formatting
 * - Compatible with GitHub-flavored Markdown and standard Markdown parsers
 *
 * @module @apex/core/export/markdown-formatter
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
// Markdown-Specific Types
// ============================================================================

/**
 * Strategy for organizing tasks in markdown output
 */
export type MarkdownLayoutStrategy = 'table' | 'list' | 'detailed' | 'summary';

/**
 * Strategy for handling nested data sections
 */
export type SectionStrategy = 'inline' | 'separate' | 'summary' | 'omit';

/**
 * Markdown-specific export options extending base export options
 */
export interface MarkdownExportOptions extends PartialExportOptions {
  /** Layout strategy for organizing tasks */
  layout?: MarkdownLayoutStrategy;
  /** Strategy for handling logs section */
  logsSection?: SectionStrategy;
  /** Strategy for handling metrics section */
  metricsSection?: SectionStrategy;
  /** Strategy for handling artifacts section */
  artifactsSection?: SectionStrategy;
  /** Whether to include document title and header */
  includeHeader?: boolean;
  /** Whether to include table of contents */
  includeToc?: boolean;
  /** Whether to include summary statistics */
  includeSummary?: boolean;
  /** Custom document title */
  documentTitle?: string;
  /** Maximum number of items to show in sections */
  sectionLimit?: number;
  /** Whether to use GitHub-flavored Markdown features */
  githubFlavored?: boolean;
  /** Whether to include task numbers in headings */
  numberTasks?: boolean;
}

/**
 * Merged options type combining base export options with Markdown-specific options
 */
interface MergedMarkdownOptions extends ExportOptions {
  layout: MarkdownLayoutStrategy;
  logsSection: SectionStrategy;
  metricsSection: SectionStrategy;
  artifactsSection: SectionStrategy;
  includeHeader: boolean;
  includeToc: boolean;
  includeSummary: boolean;
  documentTitle: string;
  sectionLimit: number;
  githubFlavored: boolean;
  numberTasks: boolean;
}

/**
 * Summary statistics for tasks
 */
interface TaskSummaryStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  totalLogs: number;
  totalArtifacts: number;
  totalExecutionTime: number;
  totalCost: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default export options for Markdown formatting
 */
const DEFAULT_MARKDOWN_OPTIONS: MarkdownExportOptions = {
  format: 'markdown',
  pretty: true,
  includeNulls: false,
  includeEmpty: false,
  maxItems: 0,
  includeFields: [],
  excludeFields: [],
  layout: 'table',
  logsSection: 'summary',
  metricsSection: 'summary',
  artifactsSection: 'summary',
  includeHeader: true,
  includeToc: false,
  includeSummary: true,
  documentTitle: 'Task Export Report',
  sectionLimit: 10,
  githubFlavored: true,
  numberTasks: false,
};

/**
 * Current export schema version
 */
const EXPORT_SCHEMA_VERSION = '1.0.0';

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Formats an array of tasks to Markdown string with full details
 *
 * This is the main export function that transforms Task objects into well-structured
 * Markdown suitable for documentation, reports, and human consumption.
 *
 * @param tasks - Array of Task objects to export
 * @param options - Optional MarkdownExportOptions for formatting control
 * @returns Markdown string representation of tasks
 * @throws {TypeError} if tasks is null/undefined or not an array
 * @throws {Error} if options validation fails
 *
 * @example
 * ```typescript
 * // Basic export
 * const markdown = formatTasksToMarkdown([task1, task2]);
 *
 * // With custom options
 * const detailedMarkdown = formatTasksToMarkdown(tasks, {
 *   layout: 'detailed',
 *   includeHeader: true,
 *   includeSummary: true,
 *   logsSection: 'separate',
 *   documentTitle: 'Sprint Report'
 * });
 * ```
 */
export function formatTasksToMarkdown(
  tasks: Task[],
  options?: MarkdownExportOptions
): string {
  // 1. Validate inputs
  validateInput(tasks, options);

  // 2. Merge with defaults
  const mergedOptions = mergeOptions(options);

  // 3. Handle empty tasks array
  if (tasks.length === 0) {
    return generateEmptyReport(mergedOptions);
  }

  // 4. Build markdown sections
  const sections: string[] = [];

  // Document header
  if (mergedOptions.includeHeader) {
    sections.push(generateHeader(mergedOptions));
  }

  // Table of contents
  if (mergedOptions.includeToc) {
    sections.push(generateTableOfContents(tasks, mergedOptions));
  }

  // Summary statistics
  if (mergedOptions.includeSummary) {
    sections.push(generateSummarySection(tasks, mergedOptions));
  }

  // Tasks section
  sections.push(generateTasksSection(tasks, mergedOptions));

  // Additional sections based on strategy
  if (mergedOptions.logsSection === 'separate') {
    sections.push(generateLogsSection(tasks, mergedOptions));
  }

  if (mergedOptions.metricsSection === 'separate') {
    sections.push(generateMetricsSection(tasks, mergedOptions));
  }

  if (mergedOptions.artifactsSection === 'separate') {
    sections.push(generateArtifactsSection(tasks, mergedOptions));
  }

  // Join sections with appropriate spacing
  return sections.filter(section => section.trim()).join('\n\n');
}

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Validates the input parameters for the formatTasksToMarkdown function
 *
 * @param tasks - Tasks array to validate
 * @param options - Options object to validate
 * @throws {TypeError} if validation fails
 */
function validateInput(tasks: Task[], options?: MarkdownExportOptions): void {
  if (tasks == null) {
    throw new TypeError('Tasks parameter cannot be null or undefined');
  }

  if (!Array.isArray(tasks)) {
    throw new TypeError('Tasks parameter must be an array');
  }

  // Validate options if provided
  if (options) {
    if (options.sectionLimit !== undefined && options.sectionLimit < 0) {
      throw new Error('sectionLimit must be a non-negative number');
    }

    if (options.layout !== undefined &&
        !['table', 'list', 'detailed', 'summary'].includes(options.layout)) {
      throw new Error('Invalid layout strategy value');
    }

    const validSectionStrategies = ['inline', 'separate', 'summary', 'omit'];

    if (options.logsSection !== undefined &&
        !validSectionStrategies.includes(options.logsSection)) {
      throw new Error('Invalid logsSection strategy value');
    }

    if (options.metricsSection !== undefined &&
        !validSectionStrategies.includes(options.metricsSection)) {
      throw new Error('Invalid metricsSection strategy value');
    }

    if (options.artifactsSection !== undefined &&
        !validSectionStrategies.includes(options.artifactsSection)) {
      throw new Error('Invalid artifactsSection strategy value');
    }
  }
}

/**
 * Merges user options with defaults
 */
function mergeOptions(options?: MarkdownExportOptions): MergedMarkdownOptions {
  const baseOptions = createExportOptions('markdown', {
    ...DEFAULT_MARKDOWN_OPTIONS,
    ...options,
  });

  return {
    ...baseOptions,
    layout: options?.layout ?? DEFAULT_MARKDOWN_OPTIONS.layout!,
    logsSection: options?.logsSection ?? DEFAULT_MARKDOWN_OPTIONS.logsSection!,
    metricsSection: options?.metricsSection ?? DEFAULT_MARKDOWN_OPTIONS.metricsSection!,
    artifactsSection: options?.artifactsSection ?? DEFAULT_MARKDOWN_OPTIONS.artifactsSection!,
    includeHeader: options?.includeHeader ?? DEFAULT_MARKDOWN_OPTIONS.includeHeader!,
    includeToc: options?.includeToc ?? DEFAULT_MARKDOWN_OPTIONS.includeToc!,
    includeSummary: options?.includeSummary ?? DEFAULT_MARKDOWN_OPTIONS.includeSummary!,
    documentTitle: options?.documentTitle ?? DEFAULT_MARKDOWN_OPTIONS.documentTitle!,
    sectionLimit: options?.sectionLimit ?? DEFAULT_MARKDOWN_OPTIONS.sectionLimit!,
    githubFlavored: options?.githubFlavored ?? DEFAULT_MARKDOWN_OPTIONS.githubFlavored!,
    numberTasks: options?.numberTasks ?? DEFAULT_MARKDOWN_OPTIONS.numberTasks!,
  };
}

// ============================================================================
// Section Generators
// ============================================================================

/**
 * Generates the document header with title and metadata
 */
function generateHeader(options: MergedMarkdownOptions): string {
  const lines: string[] = [];

  // Main title
  lines.push(`# ${options.documentTitle}`);

  if (options.includeMetadata) {
    lines.push('');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**Export Version:** ${EXPORT_SCHEMA_VERSION}`);
    lines.push(`**Format:** Markdown`);
  }

  return lines.join('\n');
}

/**
 * Generates table of contents
 */
function generateTableOfContents(tasks: Task[], options: MergedMarkdownOptions): string {
  const lines: string[] = [];
  lines.push('## Table of Contents');
  lines.push('');

  if (options.includeSummary) {
    lines.push('- [Summary](#summary)');
  }

  lines.push('- [Tasks](#tasks)');

  if (options.logsSection === 'separate') {
    lines.push('- [Execution Logs](#execution-logs)');
  }

  if (options.metricsSection === 'separate') {
    lines.push('- [Metrics](#metrics)');
  }

  if (options.artifactsSection === 'separate') {
    lines.push('- [Artifacts](#artifacts)');
  }

  return lines.join('\n');
}

/**
 * Generates summary statistics section
 */
function generateSummarySection(tasks: Task[], options: MergedMarkdownOptions): string {
  const stats = calculateSummaryStats(tasks);
  const lines: string[] = [];

  lines.push('## Summary');
  lines.push('');
  lines.push(`**Total Tasks:** ${stats.total}`);
  lines.push('');

  // Status breakdown
  lines.push('### Status Breakdown');
  lines.push('');
  for (const [status, count] of Object.entries(stats.byStatus)) {
    const percentage = ((count / stats.total) * 100).toFixed(1);
    lines.push(`- **${capitalizeFirst(status)}:** ${count} (${percentage}%)`);
  }
  lines.push('');

  // Priority breakdown
  lines.push('### Priority Breakdown');
  lines.push('');
  for (const [priority, count] of Object.entries(stats.byPriority)) {
    const percentage = ((count / stats.total) * 100).toFixed(1);
    lines.push(`- **${capitalizeFirst(priority)}:** ${count} (${percentage}%)`);
  }
  lines.push('');

  // Additional statistics
  lines.push('### Overall Statistics');
  lines.push('');

  if (options.logsSection !== 'omit') {
    lines.push(`- **Total Logs:** ${stats.totalLogs}`);
  }

  if (options.artifactsSection !== 'omit') {
    lines.push(`- **Total Artifacts:** ${stats.totalArtifacts}`);
  }

  lines.push(`- **Total Execution Time:** ${formatDuration(stats.totalExecutionTime)}`);
  lines.push(`- **Total Cost:** $${(stats.totalCost / 100).toFixed(3)}`);

  return lines.join('\n');
}

/**
 * Generates the main tasks section based on layout strategy
 */
function generateTasksSection(tasks: Task[], options: MergedMarkdownOptions): string {
  const filteredTasks = applyFieldFiltering(tasks, options);

  switch (options.layout) {
    case 'table':
      return generateTasksTable(filteredTasks, options);
    case 'list':
      return generateTasksList(filteredTasks, options);
    case 'detailed':
      return generateTasksDetailed(filteredTasks, options);
    case 'summary':
      return generateTasksSummary(filteredTasks, options);
    default:
      return generateTasksTable(filteredTasks, options);
  }
}

/**
 * Generates tasks in table format
 */
function generateTasksTable(tasks: Task[], options: MergedMarkdownOptions): string {
  const lines: string[] = [];
  lines.push('## Tasks');
  lines.push('');

  if (tasks.length === 0) {
    lines.push('*No tasks to display.*');
    return lines.join('\n');
  }

  // Table header
  const headers = ['ID', 'Description', 'Status', 'Priority', 'Effort', 'Workflow'];

  if (options.metricsSection === 'inline') {
    headers.push('Duration', 'Cost');
  }

  if (options.logsSection === 'inline') {
    headers.push('Logs');
  }

  if (options.artifactsSection === 'inline') {
    headers.push('Artifacts');
  }

  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`|${headers.map(() => ' --- ').join('|')}|`);

  // Table rows
  for (const task of tasks) {
    const row: string[] = [];

    // Core fields
    row.push(escapeTableCell(task.id));
    row.push(escapeTableCell(truncateText(task.description, 50)));
    row.push(formatBadge(task.status, 'status', options.githubFlavored));
    row.push(formatBadge(task.priority, 'priority', options.githubFlavored));
    row.push(formatBadge(task.effort, 'effort', options.githubFlavored));
    row.push(escapeTableCell(task.workflow));

    // Optional inline sections
    if (options.metricsSection === 'inline') {
      row.push(formatDuration(task.usage.executionTimeMs));
      row.push(`$${(task.usage.totalCostCents / 100).toFixed(3)}`);
    }

    if (options.logsSection === 'inline') {
      row.push(`${task.logs.length} entries`);
    }

    if (options.artifactsSection === 'inline') {
      row.push(`${task.artifacts.length} files`);
    }

    lines.push(`| ${row.join(' | ')} |`);
  }

  return lines.join('\n');
}

/**
 * Generates tasks in list format
 */
function generateTasksList(tasks: Task[], options: MergedMarkdownOptions): string {
  const lines: string[] = [];
  lines.push('## Tasks');
  lines.push('');

  if (tasks.length === 0) {
    lines.push('*No tasks to display.*');
    return lines.join('\n');
  }

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const prefix = options.numberTasks ? `${i + 1}. ` : '- ';

    lines.push(`${prefix}**${escapeLightly(task.id)}** - ${escapeLightly(task.description)}`);
    lines.push(`  - Status: ${formatBadge(task.status, 'status', options.githubFlavored)}`);
    lines.push(`  - Priority: ${formatBadge(task.priority, 'priority', options.githubFlavored)}`);
    lines.push(`  - Effort: ${formatBadge(task.effort, 'effort', options.githubFlavored)}`);

    if (options.metricsSection === 'inline') {
      lines.push(`  - Duration: ${formatDuration(task.usage.executionTimeMs)}`);
      lines.push(`  - Cost: $${(task.usage.totalCostCents / 100).toFixed(3)}`);
    }

    if (task.error) {
      lines.push(`  - ⚠️ Error: ${escapeLightly(task.error)}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generates tasks in detailed format
 */
function generateTasksDetailed(tasks: Task[], options: MergedMarkdownOptions): string {
  const lines: string[] = [];
  lines.push('## Tasks');
  lines.push('');

  if (tasks.length === 0) {
    lines.push('*No tasks to display.*');
    return lines.join('\n');
  }

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const taskNumber = options.numberTasks ? ` ${i + 1}` : '';

    lines.push(`### Task${taskNumber}: ${escapeLightly(task.id)}`);
    lines.push('');
    lines.push(`**Description:** ${escapeLightly(task.description)}`);

    if (task.acceptanceCriteria) {
      lines.push(`**Acceptance Criteria:** ${escapeLightly(task.acceptanceCriteria)}`);
    }

    lines.push('');
    lines.push('**Details:**');
    lines.push(`- Status: ${formatBadge(task.status, 'status', options.githubFlavored)}`);
    lines.push(`- Priority: ${formatBadge(task.priority, 'priority', options.githubFlavored)}`);
    lines.push(`- Effort: ${formatBadge(task.effort, 'effort', options.githubFlavored)}`);
    lines.push(`- Workflow: ${escapeMetadata(task.workflow)}`);
    lines.push(`- Autonomy: ${escapeMetadata(task.autonomy)}`);

    if (task.currentStage) {
      lines.push(`- Current Stage: ${escapeLightly(task.currentStage)}`);
    }

    lines.push('');
    lines.push('**Timestamps:**');
    lines.push(`- Created: ${formatTimestamp(task.createdAt)}`);
    lines.push(`- Updated: ${formatTimestamp(task.updatedAt)}`);

    if (task.completedAt) {
      lines.push(`- Completed: ${formatTimestamp(task.completedAt)}`);
    }

    // Include metrics if requested
    if (options.metricsSection === 'inline') {
      lines.push('');
      lines.push('**Metrics:**');
      lines.push(`- Execution Time: ${formatDuration(task.usage.executionTimeMs)}`);
      lines.push(`- Input Tokens: ${task.usage.inputTokens.toLocaleString()}`);
      lines.push(`- Output Tokens: ${task.usage.outputTokens.toLocaleString()}`);
      lines.push(`- Total Cost: $${(task.usage.totalCostCents / 100).toFixed(3)}`);
    }

    // Include logs summary if requested
    if (options.logsSection === 'inline' && task.logs.length > 0) {
      lines.push('');
      lines.push('**Logs Summary:**');
      const logSummary = summarizeLogs(task.logs);
      lines.push(`- Total: ${task.logs.length} entries`);
      lines.push(`- Breakdown: ${logSummary}`);
    }

    // Include artifacts summary if requested
    if (options.artifactsSection === 'inline' && task.artifacts.length > 0) {
      lines.push('');
      lines.push('**Artifacts:**');
      const artifactSummary = summarizeArtifacts(task.artifacts);
      lines.push(`- Total: ${task.artifacts.length} files`);
      lines.push(`- Types: ${artifactSummary}`);
    }

    if (task.error) {
      lines.push('');
      lines.push('**⚠️ Error:**');
      lines.push(`\`\`\`\n${escapeLightly(task.error)}\n\`\`\``);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generates tasks in summary format
 */
function generateTasksSummary(tasks: Task[], options: MergedMarkdownOptions): string {
  const lines: string[] = [];
  lines.push('## Tasks Summary');
  lines.push('');

  if (tasks.length === 0) {
    lines.push('*No tasks to display.*');
    return lines.join('\n');
  }

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const status = formatBadge(task.status, 'status', options.githubFlavored);
    const priority = formatBadge(task.priority, 'priority', options.githubFlavored);

    lines.push(`- **${escapeLightly(task.id)}**: ${escapeLightly(truncateText(task.description, 80))} (${status}, ${priority})`);
  }

  return lines.join('\n');
}

/**
 * Generates separate logs section
 */
function generateLogsSection(tasks: Task[], options: MergedMarkdownOptions): string {
  const lines: string[] = [];
  lines.push('## Execution Logs');
  lines.push('');

  const allLogs = tasks.flatMap(task =>
    task.logs.map(log => ({ ...log, taskId: task.id }))
  );

  if (allLogs.length === 0) {
    lines.push('*No logs to display.*');
    return lines.join('\n');
  }

  // Sort by timestamp
  allLogs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Limit if specified
  const limitedLogs = options.sectionLimit > 0
    ? allLogs.slice(0, options.sectionLimit)
    : allLogs;

  for (const log of limitedLogs) {
    const level = formatBadge(log.level, 'log-level', options.githubFlavored);
    const timestamp = formatTimestamp(log.timestamp);

    lines.push(`- **[${log.taskId}]** ${level} ${timestamp}: ${escapeLightly(log.message)}`);

    if (log.stage) {
      lines.push(`  - Stage: ${escapeLightly(log.stage)}`);
    }

    if (log.agent) {
      lines.push(`  - Agent: ${escapeLightly(log.agent)}`);
    }
  }

  if (options.sectionLimit > 0 && allLogs.length > options.sectionLimit) {
    lines.push('');
    lines.push(`*Showing first ${options.sectionLimit} of ${allLogs.length} log entries.*`);
  }

  return lines.join('\n');
}

/**
 * Generates separate metrics section
 */
function generateMetricsSection(tasks: Task[], options: MergedMarkdownOptions): string {
  const lines: string[] = [];
  lines.push('## Metrics');
  lines.push('');

  if (tasks.length === 0) {
    lines.push('*No metrics to display.*');
    return lines.join('\n');
  }

  // Aggregate metrics
  const totalTokens = tasks.reduce((sum, task) => sum + task.usage.totalTokens, 0);
  const totalCost = tasks.reduce((sum, task) => sum + task.usage.totalCostCents, 0);
  const totalTime = tasks.reduce((sum, task) => sum + task.usage.executionTimeMs, 0);

  lines.push('### Aggregate Metrics');
  lines.push('');
  lines.push(`- **Total Execution Time:** ${formatDuration(totalTime)}`);
  lines.push(`- **Total Tokens:** ${totalTokens.toLocaleString()}`);
  lines.push(`- **Total Cost:** $${(totalCost / 100).toFixed(3)}`);
  lines.push('');

  // Per-task breakdown
  lines.push('### Per-Task Breakdown');
  lines.push('');
  lines.push('| Task ID | Duration | Tokens | Cost |');
  lines.push('| --- | --- | --- | --- |');

  for (const task of tasks) {
    const duration = formatDuration(task.usage.executionTimeMs);
    const tokens = task.usage.totalTokens.toLocaleString();
    const cost = `$${(task.usage.totalCostCents / 100).toFixed(3)}`;

    lines.push(`| ${escapeTableCell(task.id)} | ${duration} | ${tokens} | ${cost} |`);
  }

  return lines.join('\n');
}

/**
 * Generates separate artifacts section
 */
function generateArtifactsSection(tasks: Task[], options: MergedMarkdownOptions): string {
  const lines: string[] = [];
  lines.push('## Artifacts');
  lines.push('');

  const allArtifacts = tasks.flatMap(task =>
    task.artifacts.map(artifact => ({ ...artifact, taskId: task.id }))
  );

  if (allArtifacts.length === 0) {
    lines.push('*No artifacts to display.*');
    return lines.join('\n');
  }

  // Group by type
  const groupedArtifacts = groupBy(allArtifacts, 'type');

  for (const [type, artifacts] of Object.entries(groupedArtifacts)) {
    lines.push(`### ${capitalizeFirst(type)} Artifacts`);
    lines.push('');

    // Limit if specified
    const limitedArtifacts = options.sectionLimit > 0
      ? artifacts.slice(0, options.sectionLimit)
      : artifacts;

    for (const artifact of limitedArtifacts) {
      lines.push(`- **${escapeLightly(artifact.name)}** (${artifact.taskId})`);

      if (artifact.path) {
        lines.push(`  - Path: \`${artifact.path}\``);
      }

      lines.push(`  - Created: ${formatTimestamp(artifact.createdAt)}`);
    }

    if (options.sectionLimit > 0 && artifacts.length > options.sectionLimit) {
      lines.push(`  - *... ${artifacts.length - options.sectionLimit} more artifacts*`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generates empty report for when no tasks are provided
 */
function generateEmptyReport(options: MergedMarkdownOptions): string {
  const lines: string[] = [];

  if (options.includeHeader) {
    lines.push(generateHeader(options));
    lines.push('');
  }

  lines.push('## Summary');
  lines.push('');
  lines.push('*No tasks found.*');

  return lines.join('\n');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculates summary statistics for tasks
 */
function calculateSummaryStats(tasks: Task[]): TaskSummaryStats {
  const stats: TaskSummaryStats = {
    total: tasks.length,
    byStatus: {},
    byPriority: {},
    totalLogs: 0,
    totalArtifacts: 0,
    totalExecutionTime: 0,
    totalCost: 0,
  };

  for (const task of tasks) {
    // Count by status
    stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;

    // Count by priority
    stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;

    // Aggregate totals
    stats.totalLogs += task.logs.length;
    stats.totalArtifacts += task.artifacts.length;
    stats.totalExecutionTime += task.usage.executionTimeMs;
    stats.totalCost += task.usage.totalCostCents;
  }

  return stats;
}

/**
 * Applies field filtering to tasks based on options
 */
function applyFieldFiltering(tasks: Task[], options: MergedMarkdownOptions): Task[] {
  // Note: For markdown, field filtering is applied at the display level
  // rather than transforming the task objects themselves
  return tasks;
}

/**
 * Formats a timestamp for display
 */
function formatTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', ' UTC');
}

/**
 * Formats a duration in milliseconds to human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Formats a badge for status, priority, etc.
 */
function formatBadge(value: string, type: string, githubFlavored: boolean): string {
  if (!githubFlavored) {
    return `**${capitalizeFirst(value)}**`;
  }

  // GitHub-flavored markdown badges (using color schemes)
  const colors: Record<string, Record<string, string>> = {
    status: {
      pending: 'yellow',
      queued: 'blue',
      planning: 'purple',
      'in-progress': 'blue',
      'awaiting-approval': 'orange',
      paused: 'gray',
      completed: 'green',
      failed: 'red',
      cancelled: 'gray',
    },
    priority: {
      low: 'green',
      normal: 'blue',
      high: 'orange',
      urgent: 'red',
    },
    effort: {
      xs: 'green',
      small: 'green',
      medium: 'yellow',
      large: 'orange',
      xl: 'red',
    },
    'log-level': {
      debug: 'gray',
      info: 'blue',
      warn: 'yellow',
      error: 'red',
    },
  };

  const color = colors[type]?.[value] || 'gray';
  // Convert label for display (replace hyphens with spaces for better readability)
  const displayLabel = capitalizeWords(value.replace(/-/g, ' '));

  return `![${displayLabel}](https://img.shields.io/badge/${encodeURIComponent(displayLabel)}-${color})`;
}

/**
 * Escapes Markdown special characters
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!|]/g, '\\$&');
}

/**
 * Escapes content for table cells (less aggressive escaping)
 */
function escapeTableCell(text: string): string {
  // Only escape pipe characters which would break table structure
  return text.replace(/\|/g, '\\|');
}

/**
 * Escapes content lightly (preserves common characters like hyphens in IDs and descriptions)
 */
function escapeLightly(text: string): string {
  // Escape only characters that would break markdown structure, but keep hyphens
  return text.replace(/[\\`*_{}[\]()#+!|]/g, '\\$&');
}

/**
 * Escapes metadata fields (with hyphen escaping for better markdown compatibility)
 */
function escapeMetadata(text: string): string {
  // Escape markdown special characters including hyphens in metadata
  return text.replace(/[\\`*_{}[\]()#+\-.!|]/g, '\\$&');
}

/**
 * Truncates text to specified length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalizes first letter of a string
 */
function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Capitalizes each word in a string (title case)
 */
function capitalizeWords(text: string): string {
  return text
    .split(' ')
    .map(word => capitalizeFirst(word))
    .join(' ');
}

/**
 * Groups array items by a property
 */
function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
  return items.reduce((groups, item) => {
    const groupKey = String(item[key]);
    groups[groupKey] = groups[groupKey] || [];
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Summarizes logs by level
 */
function summarizeLogs(logs: TaskLog[]): string {
  const counts: Record<string, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
  };

  for (const log of logs) {
    counts[log.level] = (counts[log.level] || 0) + 1;
  }

  const parts: string[] = [];
  if (counts.error > 0) parts.push(`${counts.error} error${counts.error > 1 ? 's' : ''}`);
  if (counts.warn > 0) parts.push(`${counts.warn} warning${counts.warn > 1 ? 's' : ''}`);
  if (counts.info > 0) parts.push(`${counts.info} info`);
  if (counts.debug > 0) parts.push(`${counts.debug} debug`);

  return parts.length > 0 ? parts.join(', ') : 'No logs';
}

/**
 * Summarizes artifacts by type
 */
function summarizeArtifacts(artifacts: TaskArtifact[]): string {
  const counts: Record<string, number> = {
    file: 0,
    diff: 0,
    report: 0,
    log: 0,
  };

  for (const artifact of artifacts) {
    counts[artifact.type] = (counts[artifact.type] || 0) + 1;
  }

  const parts: string[] = [];
  if (counts.file > 0) parts.push(`${counts.file} file${counts.file > 1 ? 's' : ''}`);
  if (counts.diff > 0) parts.push(`${counts.diff} diff${counts.diff > 1 ? 's' : ''}`);
  if (counts.report > 0) parts.push(`${counts.report} report${counts.report > 1 ? 's' : ''}`);
  if (counts.log > 0) parts.push(`${counts.log} log${counts.log > 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(', ') : 'No artifacts';
}