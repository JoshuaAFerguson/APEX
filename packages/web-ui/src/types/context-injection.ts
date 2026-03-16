/**
 * Context Injection Types
 *
 * Type definitions for the Visual Kanban context injection feature.
 * Context injection allows dynamic insertion of contextual information
 * into tasks, agents, or other components based on various sources.
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Enums and Type Unions
// ============================================================================

/**
 * Types of context sources that can provide contextual information
 *
 * @remarks
 * - `file` - Context extracted from files (e.g., code, documents)
 * - `task` - Context from related tasks or task history
 * - `agent` - Context from agent execution state or history
 * - `user` - Context from user preferences or input
 * - `system` - Context from system state or configuration
 * - `external` - Context from external sources (APIs, databases)
 */
export type ContextSourceType =
  | 'file'
  | 'task'
  | 'agent'
  | 'user'
  | 'system'
  | 'external'

/**
 * Types of targets that can receive injected context
 *
 * @remarks
 * - `task` - Inject context into a task definition or prompt
 * - `agent` - Inject context into an agent's working memory
 * - `prompt` - Inject context into a prompt template
 * - `panel` - Inject context into a UI panel for display
 * - `workflow` - Inject context into a workflow execution
 */
export type ContextTargetType =
  | 'task'
  | 'agent'
  | 'prompt'
  | 'panel'
  | 'workflow'

/**
 * Priority levels for context injection ordering
 *
 * @remarks
 * Higher priority contexts are injected first and may override
 * lower priority contexts when conflicts arise.
 */
export type ContextInjectionPriority =
  | 'critical'
  | 'high'
  | 'normal'
  | 'low'

/**
 * Status of a context injection operation
 */
export type ContextInjectionStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'failed'
  | 'skipped'

/**
 * Injection mode determines how context is merged with existing content
 *
 * @remarks
 * - `prepend` - Insert context before existing content
 * - `append` - Insert context after existing content
 * - `replace` - Replace existing content with context
 * - `merge` - Intelligently merge context with existing content
 */
export type ContextInjectionMode =
  | 'prepend'
  | 'append'
  | 'replace'
  | 'merge'

// ============================================================================
// Source and Target Interfaces
// ============================================================================

/**
 * Represents a source of contextual information
 */
export interface ContextSource {
  /**
   * Unique identifier for this context source
   */
  id: string

  /**
   * Type of context source
   */
  type: ContextSourceType

  /**
   * Human-readable name for the context source
   */
  name: string

  /**
   * Optional description of what this source provides
   */
  description?: string

  /**
   * URI or path to the source (e.g., file path, task ID, API endpoint)
   */
  uri: string

  /**
   * MIME type of the content (e.g., 'text/plain', 'application/json')
   * @default 'text/plain'
   */
  mimeType?: string

  /**
   * Whether this source is currently available
   * @default true
   */
  available?: boolean

  /**
   * Timestamp when the source was last modified
   */
  lastModified?: Date

  /**
   * Size of the content in bytes (if known)
   */
  contentSize?: number

  /**
   * Custom metadata for the source
   */
  metadata?: Record<string, unknown>
}

/**
 * Represents a target that can receive injected context
 */
export interface ContextTarget {
  /**
   * Unique identifier for this context target
   */
  id: string

  /**
   * Type of context target
   */
  type: ContextTargetType

  /**
   * Human-readable name for the context target
   */
  name: string

  /**
   * Optional description of the target
   */
  description?: string

  /**
   * URI or identifier of the target (e.g., task ID, panel ID)
   */
  uri: string

  /**
   * Whether this target can currently accept context
   * @default true
   */
  available?: boolean

  /**
   * Maximum content size this target can accept (in bytes)
   */
  maxContentSize?: number

  /**
   * Accepted MIME types for this target
   */
  acceptedMimeTypes?: string[]

  /**
   * Custom metadata for the target
   */
  metadata?: Record<string, unknown>
}

// ============================================================================
// Configuration Interface
// ============================================================================

/**
 * Configuration options for context injection behavior
 */
export interface ContextInjectionConfig {
  /**
   * Whether context injection is enabled
   * @default true
   */
  enabled: boolean

  /**
   * How context should be merged with existing content
   * @default 'append'
   */
  mode: ContextInjectionMode

  /**
   * Priority level for this injection
   * @default 'normal'
   */
  priority: ContextInjectionPriority

  /**
   * Maximum content size to inject (in bytes)
   * @default 50000
   */
  maxContentSize: number

  /**
   * Whether to truncate content that exceeds maxContentSize
   * @default true
   */
  truncateOnOverflow: boolean

  /**
   * Whether to cache the injected context
   * @default true
   */
  cacheEnabled: boolean

  /**
   * Cache TTL in milliseconds
   * @default 300000 (5 minutes)
   */
  cacheTtlMs: number

  /**
   * Whether to validate content before injection
   * @default true
   */
  validateContent: boolean

  /**
   * Custom transformation function name to apply to content
   */
  transformFunction?: string

  /**
   * Whether to log injection operations for debugging
   * @default false
   */
  debugMode: boolean

  /**
   * Retry configuration for failed injections
   */
  retry?: {
    /** Maximum number of retry attempts */
    maxAttempts: number
    /** Delay between retries in milliseconds */
    delayMs: number
    /** Whether to use exponential backoff */
    exponentialBackoff: boolean
  }

  /**
   * Custom filters to apply before injection
   */
  filters?: string[]
}

// ============================================================================
// Main Interfaces
// ============================================================================

/**
 * Represents a single context injection operation
 */
export interface ContextInjection {
  /**
   * Unique identifier for this injection
   */
  id: string

  /**
   * Source providing the context
   */
  source: ContextSource

  /**
   * Target receiving the context
   */
  target: ContextTarget

  /**
   * Configuration for this injection
   */
  config: ContextInjectionConfig

  /**
   * Current status of the injection
   * @default 'pending'
   */
  status: ContextInjectionStatus

  /**
   * The actual content being injected (may be null if not yet fetched)
   */
  content?: string | null

  /**
   * Error message if injection failed
   */
  error?: string | null

  /**
   * Timestamp when the injection was created
   */
  createdAt: Date

  /**
   * Timestamp when the injection was last updated
   */
  updatedAt: Date

  /**
   * Timestamp when the injection was executed (if completed)
   */
  executedAt?: Date

  /**
   * Duration of the injection operation in milliseconds
   */
  durationMs?: number

  /**
   * Number of retry attempts made
   */
  retryCount?: number

  /**
   * Additional metadata about the injection
   */
  metadata?: Record<string, unknown>
}

/**
 * Props for components that display or manage context injections
 */
export interface ContextInjectionProps {
  /**
   * Array of context injections to display or manage
   */
  injections: ContextInjection[]

  /**
   * Whether the component is in a loading state
   * @default false
   */
  loading?: boolean

  /**
   * Error message to display
   */
  error?: string | null

  /**
   * Callback when an injection is selected
   */
  onSelect?: (injection: ContextInjection) => void

  /**
   * Callback when an injection is created
   */
  onCreate?: (injection: Omit<ContextInjection, 'id' | 'createdAt' | 'updatedAt'>) => void

  /**
   * Callback when an injection is updated
   */
  onUpdate?: (id: string, updates: Partial<ContextInjection>) => void

  /**
   * Callback when an injection is deleted
   */
  onDelete?: (id: string) => void

  /**
   * Callback when an injection is executed
   */
  onExecute?: (id: string) => void

  /**
   * Callback when an injection is retried
   */
  onRetry?: (id: string) => void

  /**
   * Whether to show status indicators
   * @default true
   */
  showStatus?: boolean

  /**
   * Whether to show source/target details
   * @default true
   */
  showDetails?: boolean

  /**
   * Whether to allow editing injections
   * @default true
   */
  editable?: boolean

  /**
   * Custom CSS class name
   */
  className?: string

  /**
   * Empty state message when no injections exist
   * @default 'No context injections configured'
   */
  emptyMessage?: string
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Summary statistics for context injections
 */
export interface ContextInjectionSummary {
  /** Total number of injections */
  total: number
  /** Number of pending injections */
  pending: number
  /** Number of active injections */
  active: number
  /** Number of completed injections */
  completed: number
  /** Number of failed injections */
  failed: number
  /** Number of skipped injections */
  skipped: number
  /** Average execution time in milliseconds */
  avgDurationMs: number
  /** Success rate (0-1) */
  successRate: number
}

/**
 * Result of a context injection operation
 */
export interface ContextInjectionResult {
  /** The injection that was executed */
  injection: ContextInjection
  /** Whether the operation was successful */
  success: boolean
  /** Content that was injected (if successful) */
  content?: string
  /** Size of injected content in bytes */
  contentSize?: number
  /** Duration of the operation in milliseconds */
  durationMs: number
  /** Error details if failed */
  error?: {
    code: string
    message: string
    details?: unknown
  }
  /** Warnings generated during injection */
  warnings?: string[]
}

/**
 * Batch operation for multiple injections
 */
export interface ContextInjectionBatch {
  /** Unique identifier for the batch */
  id: string
  /** Injections in this batch */
  injections: ContextInjection[]
  /** Whether to execute sequentially or in parallel */
  parallel: boolean
  /** Whether to stop on first error */
  stopOnError: boolean
  /** Overall batch status */
  status: ContextInjectionStatus
  /** Results of completed injections */
  results: ContextInjectionResult[]
  /** Timestamp when batch was started */
  startedAt?: Date
  /** Timestamp when batch completed */
  completedAt?: Date
}

// ============================================================================
// Default Values and Constants
// ============================================================================

/**
 * Default configuration for context injection
 */
export const DEFAULT_CONTEXT_INJECTION_CONFIG: ContextInjectionConfig = {
  enabled: true,
  mode: 'append',
  priority: 'normal',
  maxContentSize: 50000,
  truncateOnOverflow: true,
  cacheEnabled: true,
  cacheTtlMs: 300000,
  validateContent: true,
  debugMode: false,
}

/**
 * Default props for context injection components
 */
export const DEFAULT_CONTEXT_INJECTION_PROPS: Required<
  Pick<
    ContextInjectionProps,
    | 'loading'
    | 'showStatus'
    | 'showDetails'
    | 'editable'
    | 'emptyMessage'
  >
> = {
  loading: false,
  showStatus: true,
  showDetails: true,
  editable: true,
  emptyMessage: 'No context injections configured',
}

/**
 * Empty context injection summary
 */
export const EMPTY_CONTEXT_INJECTION_SUMMARY: ContextInjectionSummary = {
  total: 0,
  pending: 0,
  active: 0,
  completed: 0,
  failed: 0,
  skipped: 0,
  avgDurationMs: 0,
  successRate: 0,
}

/**
 * Status labels for display
 */
export const CONTEXT_INJECTION_STATUS_LABELS: Record<ContextInjectionStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  completed: 'Completed',
  failed: 'Failed',
  skipped: 'Skipped',
}

/**
 * Priority labels for display
 */
export const CONTEXT_INJECTION_PRIORITY_LABELS: Record<ContextInjectionPriority, string> = {
  critical: 'Critical',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
}

/**
 * Source type labels for display
 */
export const CONTEXT_SOURCE_TYPE_LABELS: Record<ContextSourceType, string> = {
  file: 'File',
  task: 'Task',
  agent: 'Agent',
  user: 'User',
  system: 'System',
  external: 'External',
}

/**
 * Target type labels for display
 */
export const CONTEXT_TARGET_TYPE_LABELS: Record<ContextTargetType, string> = {
  task: 'Task',
  agent: 'Agent',
  prompt: 'Prompt',
  panel: 'Panel',
  workflow: 'Workflow',
}

/**
 * Status styling for UI components
 */
export const CONTEXT_INJECTION_STATUS_STYLES = {
  pending: {
    bg: 'bg-gray-950/50',
    text: 'text-gray-400',
    border: 'border-gray-900',
    icon: 'text-gray-500',
    dot: 'bg-gray-500',
  },
  active: {
    bg: 'bg-apex-950/50',
    text: 'text-apex-400',
    border: 'border-apex-900',
    icon: 'text-apex-500',
    dot: 'bg-apex-500',
  },
  completed: {
    bg: 'bg-green-950/50',
    text: 'text-green-400',
    border: 'border-green-900',
    icon: 'text-green-500',
    dot: 'bg-green-500',
  },
  failed: {
    bg: 'bg-red-950/50',
    text: 'text-red-400',
    border: 'border-red-900',
    icon: 'text-red-500',
    dot: 'bg-red-500',
  },
  skipped: {
    bg: 'bg-yellow-950/50',
    text: 'text-yellow-400',
    border: 'border-yellow-900',
    icon: 'text-yellow-500',
    dot: 'bg-yellow-500',
  },
} as const

/**
 * Priority styling for UI components
 */
export const CONTEXT_INJECTION_PRIORITY_STYLES = {
  critical: {
    bg: 'bg-red-950/50',
    text: 'text-red-400',
    border: 'border-red-900',
  },
  high: {
    bg: 'bg-orange-950/50',
    text: 'text-orange-400',
    border: 'border-orange-900',
  },
  normal: {
    bg: 'bg-apex-950/50',
    text: 'text-apex-400',
    border: 'border-apex-900',
  },
  low: {
    bg: 'bg-gray-950/50',
    text: 'text-gray-400',
    border: 'border-gray-900',
  },
} as const

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate summary statistics from an array of context injections
 *
 * @param injections - Array of context injections to summarize
 * @returns Summary statistics for the injections
 */
export function calculateInjectionSummary(injections: ContextInjection[]): ContextInjectionSummary {
  if (injections.length === 0) {
    return { ...EMPTY_CONTEXT_INJECTION_SUMMARY }
  }

  const counts = {
    pending: 0,
    active: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  }

  let totalDuration = 0
  let durationCount = 0

  for (const injection of injections) {
    counts[injection.status]++
    if (injection.durationMs !== undefined) {
      totalDuration += injection.durationMs
      durationCount++
    }
  }

  const avgDurationMs = durationCount > 0 ? totalDuration / durationCount : 0
  const total = injections.length
  const successRate = total > 0 ? counts.completed / total : 0

  return {
    total,
    ...counts,
    avgDurationMs,
    successRate,
  }
}

/**
 * Validate a context source configuration
 *
 * @param source - The source to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateContextSource(source: Partial<ContextSource>): string[] {
  const errors: string[] = []

  if (!source.id || typeof source.id !== 'string') {
    errors.push('Source ID is required and must be a string')
  }

  if (!source.type) {
    errors.push('Source type is required')
  }

  if (!source.name || typeof source.name !== 'string') {
    errors.push('Source name is required and must be a string')
  }

  if (!source.uri || typeof source.uri !== 'string') {
    errors.push('Source URI is required and must be a string')
  }

  return errors
}

/**
 * Validate a context target configuration
 *
 * @param target - The target to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateContextTarget(target: Partial<ContextTarget>): string[] {
  const errors: string[] = []

  if (!target.id || typeof target.id !== 'string') {
    errors.push('Target ID is required and must be a string')
  }

  if (!target.type) {
    errors.push('Target type is required')
  }

  if (!target.name || typeof target.name !== 'string') {
    errors.push('Target name is required and must be a string')
  }

  if (!target.uri || typeof target.uri !== 'string') {
    errors.push('Target URI is required and must be a string')
  }

  return errors
}

/**
 * Check if content size is within limits
 *
 * @param content - The content to check
 * @param config - The injection configuration
 * @returns Object with validation result and details
 */
export function checkContentSize(
  content: string,
  config: ContextInjectionConfig
): { valid: boolean; size: number; maxSize: number; overflow: number } {
  const size = new TextEncoder().encode(content).length
  const maxSize = config.maxContentSize
  const overflow = Math.max(0, size - maxSize)
  const valid = size <= maxSize

  return { valid, size, maxSize, overflow }
}

/**
 * Truncate content to fit within size limits
 *
 * @param content - The content to truncate
 * @param maxSize - Maximum size in bytes
 * @param suffix - Suffix to append when truncated
 * @returns Truncated content
 */
export function truncateContent(
  content: string,
  maxSize: number,
  suffix: string = '...[truncated]'
): string {
  const encoder = new TextEncoder()
  const suffixBytes = encoder.encode(suffix).length
  const effectiveMaxSize = maxSize - suffixBytes

  if (effectiveMaxSize <= 0) {
    return suffix.substring(0, maxSize)
  }

  const contentBytes = encoder.encode(content)
  if (contentBytes.length <= maxSize) {
    return content
  }

  // Binary search for the right truncation point
  let low = 0
  let high = content.length

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2)
    const truncated = content.substring(0, mid)
    const truncatedBytes = encoder.encode(truncated).length

    if (truncatedBytes <= effectiveMaxSize) {
      low = mid
    } else {
      high = mid - 1
    }
  }

  return content.substring(0, low) + suffix
}
