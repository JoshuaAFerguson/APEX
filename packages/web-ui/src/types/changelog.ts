/**
 * APEX Web UI Changelog Type Definitions
 *
 * This module exports TypeScript interfaces and types for the
 * Automated Changelog Display component system.
 */

import type { Task, TaskArtifact, TaskLog } from '@apexcli/core'

/**
 * Represents a single changelog entry derived from a completed task
 */
export interface ChangelogEntry {
  /** Unique entry ID (task ID) */
  id: string

  /** Short summary/title of the change (from task description) */
  title: string

  /** Detailed description of changes */
  description?: string

  /** When the change was completed */
  timestamp: Date

  /** Workflow that produced this change */
  workflow: string

  /** Task status when changelog was generated */
  status: 'completed' | 'failed' | 'cancelled'

  /** Git-related information */
  git?: {
    branchName?: string
    prUrl?: string
    commitHash?: string
  }

  /** File changes with diffs */
  changes: ChangelogFileChange[]

  /** Statistics about the change */
  stats: {
    filesModified: number
    linesAdded: number
    linesRemoved: number
  }

  /** Original task for reference */
  taskId: string
}

/**
 * Represents a file change within a changelog entry
 */
export interface ChangelogFileChange {
  /** File path */
  path: string

  /** Type of change */
  type: 'added' | 'modified' | 'deleted' | 'renamed'

  /** Original path (for renames) */
  originalPath?: string

  /** Unified diff content */
  diff?: string

  /** Lines added/removed in this file */
  stats: {
    additions: number
    deletions: number
  }
}

/**
 * Filter options for changelog display
 */
export interface ChangelogFilters {
  /** Start date for filtering */
  startDate?: Date

  /** End date for filtering */
  endDate?: Date

  /** Workflow names to include */
  workflows?: string[]

  /** Search query for title/description */
  search?: string

  /** Status filter */
  status?: ('completed' | 'failed' | 'cancelled')[]

  /** Limit results */
  limit?: number

  /** Offset for pagination */
  offset?: number
}

/**
 * Props for ChangelogDisplay component
 */
export interface ChangelogDisplayProps {
  /** Pre-loaded entries (if not using hook) */
  entries?: ChangelogEntry[]

  /** Whether to fetch entries automatically */
  autoFetch?: boolean

  /** Initial filter configuration */
  initialFilters?: Partial<ChangelogFilters>

  /** Whether to show filter controls */
  showFilters?: boolean

  /** Whether to enable expandable diffs */
  showDiffPreview?: boolean

  /** Maximum height before scrolling */
  maxHeight?: number | string

  /** Callback when entry is clicked */
  onEntryClick?: (entry: ChangelogEntry) => void

  /** Loading state */
  loading?: boolean

  /** Custom className */
  className?: string

  /** Component title */
  title?: string

  /** Empty state message */
  emptyMessage?: string
}

/**
 * Props for ChangelogEntry component
 */
export interface ChangelogEntryProps {
  /** The entry to display */
  entry: ChangelogEntry

  /** Whether diff preview is expanded */
  isExpanded?: boolean

  /** Toggle expansion callback */
  onToggleExpand?: () => void

  /** Whether to show diff preview toggle */
  showDiffToggle?: boolean

  /** Click handler */
  onClick?: () => void

  /** Compact mode */
  compact?: boolean

  /** Custom className */
  className?: string
}

/**
 * Props for ChangelogFilters component
 */
export interface ChangelogFiltersProps {
  /** Current filter values */
  filters: ChangelogFilters

  /** Filter change handler */
  onFiltersChange: (filters: ChangelogFilters) => void

  /** Available workflows for filter dropdown */
  availableWorkflows?: string[]

  /** Compact mode */
  compact?: boolean

  /** Custom className */
  className?: string
}

/**
 * Props for ChangelogDiffPreview component
 */
export interface ChangelogDiffPreviewProps {
  /** File changes to display */
  changes: ChangelogFileChange[]

  /** Whether to show file headers */
  showFileHeaders?: boolean

  /** Maximum height for diff viewer */
  maxHeight?: number

  /** Custom className */
  className?: string

  /** Whether files are initially collapsed */
  defaultCollapsed?: boolean
}

/**
 * Props for ChangelogHeader component
 */
export interface ChangelogHeaderProps {
  /** Total number of entries */
  totalEntries: number

  /** Number of currently filtered entries */
  filteredEntries: number

  /** Date range of entries */
  dateRange?: {
    from: Date
    to: Date
  }

  /** Active filters summary */
  activeFilters?: {
    workflows: number
    status: number
    search: boolean
  }

  /** Custom className */
  className?: string
}

/**
 * Data returned from useChangelog hook
 */
export interface UseChangelogReturn {
  /** Changelog entries */
  entries: ChangelogEntry[]

  /** Loading state */
  isLoading: boolean

  /** Error state */
  error: Error | null

  /** Current filters */
  filters: ChangelogFilters

  /** Update filters */
  setFilters: (filters: ChangelogFilters) => void

  /** Fetch next page */
  fetchMore: () => Promise<void>

  /** Has more entries to load */
  hasMore: boolean

  /** Total count */
  total: number

  /** Refresh entries */
  refresh: () => Promise<void>

  /** Available workflows for filtering */
  availableWorkflows: string[]
}

/**
 * Options for useChangelog hook
 */
export interface UseChangelogOptions {
  /** Initial filters */
  initialFilters?: ChangelogFilters

  /** Auto-fetch on mount */
  autoFetch?: boolean

  /** Refresh interval in ms (0 = disabled) */
  refreshInterval?: number

  /** Items per page for pagination */
  pageSize?: number
}

/**
 * Response from getChangelog API method
 */
export interface ChangelogResponse {
  entries: ChangelogEntry[]
  total: number
  hasMore: boolean
  workflows: string[]
}

/**
 * Transform a completed Task into a ChangelogEntry
 */
export function taskToChangelogEntry(task: Task): ChangelogEntry {
  // Extract file changes from task artifacts
  const changes: ChangelogFileChange[] = task.artifacts
    .filter(artifact => artifact.type === 'file' || artifact.type === 'diff')
    .map(artifact => ({
      path: artifact.path || artifact.name,
      type: determineChangeType(artifact),
      diff: artifact.content,
      stats: {
        additions: artifact.content ? countAdditions(artifact.content) : 0,
        deletions: artifact.content ? countDeletions(artifact.content) : 0,
      },
    }))

  // Calculate aggregate stats
  const stats = {
    filesModified: changes.length,
    linesAdded: changes.reduce((sum, c) => sum + c.stats.additions, 0),
    linesRemoved: changes.reduce((sum, c) => sum + c.stats.deletions, 0),
  }

  return {
    id: task.id,
    title: truncateText(task.description, 80),
    description: task.description,
    timestamp: task.completedAt || task.updatedAt,
    workflow: task.workflow,
    status: task.status as 'completed' | 'failed' | 'cancelled',
    git: {
      branchName: task.branchName,
      prUrl: task.prUrl,
    },
    changes,
    stats,
    taskId: task.id,
  }
}

/**
 * Determine the type of change from a TaskArtifact
 */
export function determineChangeType(artifact: TaskArtifact): ChangelogFileChange['type'] {
  if (!artifact.content) return 'modified'

  // Basic heuristics based on diff content
  const content = artifact.content.toLowerCase()
  if (content.includes('new file mode')) return 'added'
  if (content.includes('deleted file mode')) return 'deleted'
  if (content.includes('rename from') && content.includes('rename to')) return 'renamed'

  return 'modified'
}

/**
 * Count additions in diff content
 */
export function countAdditions(diff: string): number {
  if (!diff) return 0
  return (diff.match(/^\+(?!\+)/gm) || []).length
}

/**
 * Count deletions in diff content
 */
export function countDeletions(diff: string): number {
  if (!diff) return 0
  return (diff.match(/^-(?!-)/gm) || []).length
}

/**
 * Truncate text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}